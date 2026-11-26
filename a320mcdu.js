/* NORDAP – A320 MCDU (a320.html): the FMGC pages a crew uses to prepare and fly a flight in the practice area, laid out
   line by line as on the aircraft (Honeywell FMS as fitted to the A320 family).
   INIT (FROM/TO, ALTN, FLT NBR, IRS INIT, COST INDEX, CRZ FL/TEMP, TROPO) and INIT FUEL PREDICTION (TAXI, ZFW/ZFWCG, BLOCK,
   TRIP/TIME, RTE RSV, ALTN, FINAL, MIN DEST FOB, TOW/LW, EXTRA), F-PLN with predictions (UTC or TIME, SPD/ALT, constraints
   with the magenta star, DEST UTC/DIST/EFOB), LAT REV (DEPARTURE, ARRIVAL, HOLD, ENABLE ALTN, NEXT WPT, NEW DEST), VERT REV
   (SPD LIM, SPD CSTR, ALT CSTR), DIR TO (temporary, INSERT / ERASE, RADIAL IN), HOLD (COMPUTED / DATABASE, LAST EXIT),
   PERF TAKE OFF / CLB / CRZ / DES / APPR / GO AROUND, RAD NAV, PROG, FUEL PRED, SEC INDEX, DATA INDEX and MCDU MENU.
   Entry rules as on the aircraft: type into the scratchpad, press the line select key; CLR clears the scratchpad or, with an
   empty scratchpad, puts CLR in it to delete a field or a waypoint; wrong formats give FORMAT ERROR.
   Practice-area data (fictional, as in the other NORDAP sims): NORDAP field "ENRD" runway 36, fixes from airproc.js. */
(function(G){
'use strict';
const C={g:'#2bff4a',c:'#29e4ff',a:'#ffa21a',w:'#ffffff',m:'#ff58ff',y:'#ffff32'};
const NM=1852, FT=0.3048, KT=1852/3600, SM=40, BG=52; // small and large MCDU fonts
function create(fixes){
  return {page:'init',sp:'',spC:C.w,msg:'',sub:0,fixes:fixes||{},changed:1,tmpy:null,sec:null,lr:null,hold:null,vr:null,dirSel:null,dirRad:null,
    pass:{},flown:false,toT:null,now:()=>Date.now(),dataPg:1,arrOff:0,depOff:0,
    d:{from:'',to:'',fltNbr:'',ci:null,crzFl:null,crzT:null,tropo:36090,altn:'',zfw:null,zfwcg:null,block:null,taxi:200,rsvPct:5.0,finalT:30,
       v1:null,vr:null,v2:null,flaps:null,ths:null,flex:null,thrRed:1500,acc:1500,eoAcc:1500,thrRedP:false,accP:false,eoAccP:false,transAlt:5000,
       qnh:null,temp:null,wind:null,mda:null,dh:null,ldgConf:'FULL',vapp:null,ilsFreq:'110.30',ilsCrs:360,ilsId:'IASN',ilsMan:false,
       vor1:null,vor2:null,vor1Crs:null,vor2Crs:null,appr:'ILS36',star:'',via:'',sid:'',rwy:'36',spdLim:{spd:250,alt:10000},desLim:{spd:250,alt:10000}},
    fpln:[],act:0};
}
/* practice-area data base (fictional) */
const ROUTES={PATTERN:['RW36','HOLAN','OSVIK','TUSKA','ALPOR','RONAX','FAPSO','RW36']};
const SIDS={'HOLA1N':['HOLAN'],'OSVI1N':['D005','OSVIK']};
const STARS={'TUSK1A':['TUSKA','ALPOR','RONAX'],'OSVI1A':['OSVIK','TUSKA','ALPOR','RONAX'],'HOLA1A':['HOLAN','OSVIK','TUSKA','ALPOR','RONAX']};
const APPRS={'ILS36':['RONAX','FAPSO','RW36'],'RNAV36':['RONAX','FAPSO','RW36'],'VOR36':['RONAX','FAPSO','RW36']};
const APPR_INFO={ILS36:'IASN/110.30',RNAV36:'',VOR36:'ASN/113.30'};
const HOLDS={RONAX:{crs:360,turn:'R',time:1.0},HOLAN:{crs:180,turn:'L',time:1.0}}; // published holds
const ALTN={ENRA:{N:-28*NM,E:22*NM}};
const RWY_LEN=3000;
function wp(K,id){ if(id==='RW36') return {id,N:0,E:0,rwy:true}; const f=K.fixes[id]; if(f) return {id,N:f.N,E:f.E}; if(id==='D005') return {id,N:5*NM,E:0}; if(ALTN[id]) return {id,N:ALTN[id].N,E:ALTN[id].E,apt:true}; return null; }
const cp=L=>L.map(p=>Object.assign({},p,p.cst?{cst:Object.assign({},p.cst)}:{},p.hold?{hold:Object.assign({},p.hold)}:{}));
function tmpy(K){ if(!K.tmpy) K.tmpy={fp:cp(K.fpln),act:K.act,dest:K.d.to}; return K.tmpy; }
function insertTmpy(K,api){ const t=K.tmpy; if(!t) return; K.fpln=t.fp; K.act=Math.min(t.act,K.fpln.length-1); if(t.dest) K.d.to=t.dest; if(t.appr) K.d.appr=t.appr; if(t.star!=null) K.d.star=t.star; if(t.sid!=null) K.d.sid=t.sid;
  if(t.appr&&APPR_INFO[t.appr]&&/^ILS/.test(t.appr)&&!K.d.ilsMan){ K.d.ilsId='IASN'; K.d.ilsFreq='110.30'; K.d.ilsCrs=360; }
  K.tmpy=null; K.hold=null; K.dirSel=null; K.dirRad=null; api&&api.dirTo&&api.dirTo(); }
/* altitude constraints (ft): A at or above, B at or below, AT at */
const CST={HOLAN:{alt:4000,t:'A'},OSVIK:{alt:6000,t:'AT'},TUSKA:{alt:5000,t:'B'},ALPOR:{alt:3000,t:'AT'},RONAX:{alt:3000,t:'AT'},FAPSO:{alt:1650,t:'AT'}};
function build(K){ const L=[]; if(K.d.from) L.push({id:'ENRD36',N:0,E:0,rwy:true,orig:true}); ROUTES.PATTERN.slice(1).forEach(id=>{ const p=wp(K,id); if(p){ if(id==='RW36') p.rwy=true; if(CST[id]) p.cst=Object.assign({},CST[id]); if(APPRS.ILS36.includes(id)){ p.via=K.d.appr||'ILS36'; p.ann='C'; } L.push(p); } }); return L; }
function cstTxt(c){ return c?(c.t==='A'?'+':c.t==='B'?'-':'')+c.alt:''; }
/* vertical guidance for managed CLB / DES: the next constraint that limits the climb or the descent, and the distance to it */
function vnav(K,M,climb,fcuAlt){
  if(!K.fpln.length||K.act<1) return null; let d=0, prev={N:M.N,E:M.E}; const h=M.h/0.3048;
  for(let i=K.act;i<K.fpln.length;i++){ const p=K.fpln[i]; d+=Math.hypot(p.N-prev.N,p.E-prev.E)/NM; prev=p; const c=p.cst; if(!c) continue;
    if(climb){ if((c.t==='B'||c.t==='AT')&&c.alt<fcuAlt&&c.alt>h-50) return {alt:c.alt,dist:d,id:p.id,t:c.t}; }
    else { if(c.alt<h-50){ const floor=(c.t==='A'||c.t==='AT')&&c.alt>fcuAlt; return {alt:floor?c.alt:Math.max(fcuAlt,c.alt),pathAlt:c.alt,dist:d,id:p.id,t:c.t,floor}; } if((c.t==='A'||c.t==='AT')&&c.alt>fcuAlt&&Math.abs(c.alt-h)<=50) return {alt:c.alt,pathAlt:c.alt,dist:d,id:p.id,t:c.t,floor:true}; } }
  return null; }
/* managed speed: speed constraint at the TO waypoint (or the last one passed in the descent) */
function spdCst(K,M){ if(!M||!K.fpln.length||K.act<1) return 0; const b=K.fpln[K.act]; let v=b&&b.spd||0; if(!(M.ap&&M.ap.clbPh)){ const a=K.fpln[K.act-1]; if(a&&a.spd) v=v?Math.min(v,a.spd):a.spd; } return v; }

/* ---------- predictions (practice-area performance model, in step with the simulator's engines) ---------- */
const BURN=2.1; // t/h, two LEAP-1A at 250 kt, low level, 66 t
const hhmm=min=>{ min=Math.max(0,Math.round(min)); return String(Math.floor(min/60)%24).padStart(2,'0')+String(min%60).padStart(2,'0'); };
const utc=ms=>{ const d=new Date(ms); return String(d.getUTCHours()).padStart(2,'0')+String(d.getUTCMinutes()).padStart(2,'0'); };
function phase(K,M){ if(!M) return 'PREFLIGHT'; const a=M.ap||{};
  if(!M.gnd&&!K.flown){ K.flown=true; K.toT=K.now(); }
  if(M.gnd) return K.flown?(M.ias>40?'APPR':'DONE'):(M.toPower?'TAKE OFF':'PREFLIGHT');
  if(a.gaMode) return 'GO AROUND'; if(a.vert==='SRS') return 'TAKE OFF';
  if(a.apprPh||a.appr||a.vert&&(a.vert.startsWith('G/S')||a.vert==='FINAL APP'||a.vert==='LAND'||a.vert==='FLARE')) return 'APPR';
  const h=M.h/FT, crz=K.d.crzFl?K.d.crzFl*100:1e9;
  if(a.clbPh) return h>crz-60?'CRZ':'CLB';
  return Math.abs(h-crz)<200&&!/DES/.test(a.vert||'')?'CRZ':'DES'; }
const PH={'PREFLIGHT':'to','TAKE OFF':'to','CLB':'clb','CRZ':'crz','DES':'des','APPR':'appr','GO AROUND':'ga','DONE':'to'};
const PHO=['to','clb','crz','des','appr','ga'];
function apprSpds(K,M,A,lw){ const s=M&&M.spds; if(!s) return null; const gw=M.gw||(A&&A.gw)||64000, k=Math.sqrt((lw||gw)/gw);
  const vls=(K.d.ldgConf==='3'?s.vls3:s.vlsF)*k; const hw=windHead(K.d.wind); const vapp=K.d.vapp||Math.round(vls+Math.max(5,Math.min(15,hw/3)));
  return {vls:Math.round(vls),vapp,F:Math.round(s.F*k),S:Math.round(s.S*k),O:Math.round(s.gd+((lw||gw)-gw)/500)}; }
function windHead(w){ const x=/^(\d{1,3})\/(\d{1,3})$/.exec(w||''); if(!x) return 0; return Math.max(0,+x[2]*Math.cos((+x[1]-360)*Math.PI/180)); }
function vappOf(K,M,A){ const s=apprSpds(K,M,A); return s?s.vapp:137; }
function pred(K,M,A,fp,act){
  const d=K.d; if(!fp||fp.length<2) return null; const fly=!!(M&&!M.gnd);
  if(!fly&&!(d.zfw&&d.block&&d.crzFl&&d.ci!=null)) return null;
  const sp=M&&M.spds||{}, last=fp.length-1, gw=fly&&A?A.gw:(d.zfw&&d.block?d.zfw+d.block-d.taxi:64000), lim=d.spdLim||{spd:250,alt:10000};
  const as=apprSpds(K,M,A,gw)||{vapp:137,F:155,S:185,O:205};
  const out=new Array(fp.length).fill(null);
  let pos=fly?{N:M.N,E:M.E}:fp[0], i0=fly?Math.max(1,act):1, h=fly?M.h/FT:0, t=0, cum=0;
  let fuel=fly&&A?A.fuel.fob/1000:((d.block||(A?A.fuel.fob:6000))-d.taxi)/1000; const f0=fuel; let td=null;
  if(!fly){ t=1.0; fuel-=0.12; out[0]={t:0,spd:d.v1||null,h:0,efob:fuel+0.12,cum:0}; }
  const anchor=j=>{ const q=fp[j]; if(j===last&&q.rwy) return 50; return q.cst?q.cst.alt:null; };
  for(let i=i0;i<=last;i++){ const p=fp[i], leg=Math.hypot(p.N-pos.N,p.E-pos.E)/NM;
    // next altitude anchor ahead
    let j=i, Dj=leg, aj=null; for(let q=i,pp=pos;q<=last;q++){ if(q>i) Dj+=Math.hypot(fp[q].N-pp.N,fp[q].E-pp.E)/NM; pp=fp[q]; const a=anchor(q); if(a!=null){ aj=a; j=q; break; } }
    let hn=h; if(aj==null) hn=h; else if(aj>=h) hn=Math.min(aj,h+500*leg);
    else { const sd=Dj-(h-aj)/318; if(leg>sd){ if(td==null) td={cum:cum+Math.max(0,sd),t:null}; hn=Math.max(aj,h-318*(leg-Math.max(0,sd))); } }
    if(p.rwy&&i===last) hn=50; // threshold crossing height
    const c=p.cst; let met=true; if(c){ met=c.t==='AT'?Math.abs(hn-c.alt)<150:c.t==='A'?hn>=c.alt-150:hn<=c.alt+150; }
    const k=last-i; let ias;
    if(p.via&&p.via===d.appr||k<=1&&p.rwy){ ias=k===0?as.vapp:k===1?as.F:k===2?as.S:as.O; }
    else ias=hn<lim.alt?Math.max(lim.spd,as.O):300;
    if(p.spd) ias=Math.min(ias,p.spd);
    const hm=(h+hn)/2, gs=(i===i0&&fly&&M.gs>30*KT)?M.gs/KT:ias*(1+0.017*hm/1000);
    const dt=leg/Math.max(gs,80)*60; if(td&&td.t==null) td.t=t+dt*Math.min(1,(td.cum-cum)/Math.max(leg,0.01));
    const rate=(k<=1&&p.via===d.appr?1.9:BURN+0.03*hm/1000)*gw/66000;
    fuel-=rate*dt/60+Math.max(0,hn-h)/1000*0.02-Math.max(0,h-hn)/1000*0.008;
    t+=dt; cum+=leg; h=hn; pos=p; out[i]={t,spd:Math.round(ias),h:Math.round(hn),efob:fuel,cum,met};
  }
  const dst=out[last]||{t:0,cum:0,efob:fuel};
  return {w:out,destT:dst.t,destDist:dst.cum,destEfob:dst.efob,trip:f0-dst.efob+(fly?0:0),tripT:dst.t,td,fly,gw}; }
/* fuel planning (INIT FUEL PREDICTION / FUEL PRED) */
function fuelPlan(K,M,A){ const d=K.d; const P=pred(K,M,A,K.fpln,K.act); if(!P) return null;
  const lw=(P.fly&&A?A.gw:d.zfw+d.block-d.taxi)-(P.trip*1000);
  const altn=d.altn?(()=>{ const a=ALTN[d.altn]; const dist=Math.hypot(a.N,a.E)/NM; const tt=dist/270*60+6; return {f:0.3+tt/60*BURN*lw/66000,t:tt}; })():{f:0,t:0};
  const fin=d.finalT/60*2.0*lw/66000, rsv=P.trip*d.rsvPct/100, mdf=altn.f+fin;
  const fob0=P.fly&&A?A.fuel.fob/1000:(d.block-d.taxi)/1000;
  const extra=fob0-P.trip-rsv-altn.f-fin;
  return {P,trip:P.trip,tripT:P.tripT,rsv,altn,fin,mdf,extra,extraT:Math.max(0,extra)/(2.0*lw/66000)*60,tow:d.zfw&&d.block?(d.zfw+d.block-d.taxi)/1000:null,lw:lw/1000}; }

function fmt1(x){ return (Math.round(x*10)/10).toFixed(1); }
function altF(h,ta){ h=Math.round(h/10)*10; return h>ta?'FL'+String(Math.round(h/100)).padStart(3,'0'):String(h); }
function v3(v){ return v==null?'___':String(v); }
function brg(a,b){ return ((Math.atan2(b.E-a.E,b.N-a.N)*180/Math.PI)+360)%360; }
const d3=x=>String(Math.round(x)%360||360).padStart(3,'0');
/* F-PLN display list: waypoints, hold, end of flight plan and alternate */
function fplnRows(K,fp,act,isTmpy){ const R=[], st=Math.max(0,act-1);
  for(let i=st;i<fp.length;i++){ R.push({k:'wpt',i}); if(fp[i].hold){ R.push({k:'hold',i}); R.push({k:'hx',i}); } }
  R.push({k:'end'}); const dest=isTmpy&&K.tmpy?K.tmpy.dest:K.d.to;
  if(K.d.altn&&dest!==K.d.altn){ R.push({k:'altn'}); R.push({k:'endaltn'}); } else R.push({k:'noaltn'});
  return R; }

function render(K,M,A){
  const d=K.d, lines=[], P={title:'',lines,scratch:K.msg||K.sp,scratchC:K.msg?C.a:C.w};
  const l=(row,txt,col,al,size)=>{ if(txt!=null&&txt!=='') lines.push([row,String(txt),col||C.w,al==null?'l':al,size]); };
  const seg=(row,parts,al)=>{ const n=parts.reduce((s,p)=>s+String(p[0]).length,0); let x=al==='r'?24-n:al==='c'?Math.floor((24-n)/2):(typeof al==='number'?al:0);
    for(const p of parts){ const s=String(p[0]); if(s) lines.push([row,s,p[1]||C.w,x,p[2]]); x+=s.length; } };
  const title=(parts,al)=>{ P.title=parts.map(p=>p[0]).join(''); P.titleSeg=parts; if(al) P.titleAl=al; };
  const ph=phase(K,M), phK=PH[ph], fly=!!(M&&!M.gnd), tHdr=fly?'UTC':'TIME';
  const tFmt=min=>fly?utc(K.now()+min*60000):hhmm(min);
  switch(K.page){
    case 'menu': P.title='MCDU MENU'; l(2,'<FMGC',C.g); l(4,'<ATSU'); l(6,'<AIDS'); l(8,'<CFDS'); l(12,'SELECT DESIRED SYSTEM',C.w,'c',SM); break;
    case 'init': P.title='INIT'; P.arrows=true;
      l(1,' CO RTE'); if(!d.from) l(2,'__________',C.a); l(1,'FROM/TO ',C.w,'r'); l(2,d.from?d.from+'/'+d.to:'____|____',d.from?C.c:C.a,'r');
      l(3,'ALTN/CO RTE'); l(4,d.altn?d.altn:(d.from?'[  ]/[        ]':'----/----------'),d.altn||d.from?C.c:C.w); l(5,'FLT NBR'); l(6,d.fltNbr||'________',d.fltNbr?C.c:C.a);
      if(d.from) l(6,'IRS INIT>',C.w,'r');
      l(9,'COST INDEX'); l(10,d.ci!=null?String(d.ci):'___',d.ci!=null?C.c:C.a); l(10,'WIND>',C.w,'r');
      l(11,'CRZ FL/TEMP'); l(12,d.crzFl?('FL'+String(d.crzFl).padStart(3,'0')+' /'+(d.crzT!=null?d.crzT:Math.round(15-d.crzFl*100*0.00198))+'°'):'_____ /___°',d.crzFl?C.c:C.a); l(11,'TROPO',C.w,'r'); l(12,String(d.tropo),C.c,'r',SM);
      break;
    case 'initb': { title([['INIT FUEL PREDICTION']]); P.titleAl=1; P.arrows=true; const FP=fuelPlan(K,M,A);
      l(1,'TAXI'); l(2,fmt1(d.taxi/1000),C.c); l(1,'ZFW/ZFWCG',C.w,'r'); l(2,d.zfw?(d.zfw/1000).toFixed(1)+'/'+(d.zfwcg||28.0).toFixed(1):'___._/__._',d.zfw?C.c:C.a,'r');
      l(3,'TRIP /TIME'); l(3,'BLOCK',C.w,'r'); l(4,d.block?(d.block/1000).toFixed(1):'__._',d.block?C.c:C.a,'r');
      l(5,'RTE RSV/%'); l(7,'ALTN /TIME'); l(9,'FINAL/TIME'); l(11,'MIN DEST FOB'); l(7,'TOW/   LW',C.w,'r'); l(9,'TRIP WIND',C.w,'r'); l(11,'EXTRA/TIME',C.w,'r');
      if(FP){ seg(4,[[fmt1(FP.trip)+'/'+hhmm(FP.tripT),C.g]]); seg(6,[[fmt1(FP.rsv)+'/',C.g],[d.rsvPct.toFixed(1),C.c]]); seg(8,[[fmt1(FP.altn.f)+'/',C.g],[d.altn?hhmm(FP.altn.t):'----',C.g]]);
        seg(10,[[fmt1(FP.fin)+'/',C.c],[hhmm(d.finalT),C.c]]); l(12,fmt1(FP.mdf),C.c); seg(8,[[FP.tow!=null?fmt1(FP.tow):'---.-',C.g],['/ ',C.g],[fmt1(FP.lw),C.g]],'r'); l(10,'HD000',C.c,'r',SM);
        l(12,fmt1(Math.max(0,FP.extra))+'/'+hhmm(FP.extraT),FP.extra<0?C.a:C.g,'r'); }
      else { l(4,'---.-/----'); seg(6,[['---.-/'],[d.rsvPct.toFixed(1),C.c]]); l(8,'---.-/----'); seg(10,[['---.-/'],[hhmm(d.finalT),C.c]]); l(12,'---.-'); l(8,'---.-/---.-',C.w,'r'); l(10,'---',C.w,'r'); l(12,'---.-/----',C.w,'r'); }
      break; }
    case 'irsinit': { P.title='IRS INIT'; l(1,'LAT',C.w,1); l(1,'REFERENCE',C.w,'c'); l(1,'LONG ',C.w,'r'); l(2,'----.--',C.w,0); l(2,d.from||'----',C.g,'c'); l(2,'-----.--',C.w,'r');
      l(3,'LAT',C.w,1); l(3,'GPS POSITION',C.w,'c'); l(3,'LONG ',C.w,'r'); l(4,'----.--',C.w,0); l(4,'-----.--',C.w,'r');
      (A&&A.irs||[]).forEach((r,i)=>{ const st=r.st===2?'ALIGNED':r.st===1?'ALIGNING':'OFF'; l(6+i*2,'IRS'+(i+1)+' '+st,r.st===2?C.g:r.st===1?C.c:C.w,0,SM); });
      l(12,'<RETURN'); break; }
    case 'wind': { P.title='CLIMB WIND'; l(1,'TRU WIND/ALT'); for(let i=0;i<5;i++) l(2+i*2,(d.clbWind&&d.clbWind[i])||(i===0||(d.clbWind&&d.clbWind[i-1])?'[ ]°/[ ]/[   ]':''),C.c); l(12,'<RETURN'); break; }
    case 'fpln': case 'secfp': {
      const isSec=K.page==='secfp', T_=!isSec&&K.tmpy, fp=isSec?(K.sec?K.sec.fp:[]):T_?T_.fp:K.fpln, act=isSec?(K.sec?K.sec.act:0):T_?T_.act:K.act;
      P.arrows=true; P.vert=true; if(isSec) P.title='SEC'; else if(T_) title([['TMPY',C.y]]);
      if(d.fltNbr) l(0,d.fltNbr+'  ',C.w,'r',SM);
      if(!fp.length){ l(1,tHdr,C.w,8,SM); l(1,'SPD/ALT   ',C.w,'r',SM); l(2,'PPOS',C.g); l(2,'----',C.w,8); l(2,'   /  -----',C.w,'r');
        l(4,'---F-PLN DISCONTINUITY--',C.w,'c'); l(6,'------END OF F-PLN------',C.w,'c'); l(8,'-----NO ALTN F-PLN------',C.w,'c'); l(11,' DEST',C.w); l(11,tHdr,C.w,8,SM); l(11,'DIST  EFOB',C.w,'r'); l(12,'-------'); l(12,'----',C.w,8,SM); l(12,'---- ---.-',C.w,'r',SM); break; }
      const R=fplnRows(K,fp,act,!!T_), PR=pred(K,M,A,fp,act), w=PR?PR.w:[];
      K.sub=Math.max(0,Math.min(K.sub,R.length-1)); const st=K.sub; if(st===0&&act>0&&!T_&&!isSec) l(0,' FROM',C.w,0,SM); else if(st===0&&act>0&&T_) l(0,' FROM',C.w,0,SM);
      if(T_) P.titleAl=6;
      let prevSpd=null, prevAlt=null, nmShown=false;
      for(let r=0;r<5;r++){ const e=R[st+r]; if(!e) break; const row=2+r*2, lab=row-1;
        if(r===0){ l(lab,tHdr,C.w,8,SM); l(lab,'SPD/ALT   ',C.w,'r',SM); }
        if(e.k==='end'){ l(row,'------END OF F-PLN------',C.w,'c'); continue; }
        if(e.k==='noaltn'){ l(row,'-----NO ALTN F-PLN------',C.w,'c'); continue; }
        if(e.k==='endaltn'){ l(row,'---END OF ALTN F-PLN---',C.w,'c'); continue; }
        if(e.k==='altn'){ l(row,d.altn,C.c); l(row,'----',C.c,8,SM); l(row,'---/ -----',C.c,'r',SM); const a=ALTN[d.altn], q=fp[fp.length-1]; if(r>0){ l(lab,String(Math.round(Math.hypot(a.N-q.N,a.E-q.E)/NM)),C.c,'r'); } continue; }
        const p=fp[e.i], col=T_?C.y:isSec?C.w:e.i===act?C.w:C.g;
        if(e.k==='hold'){ l(lab,'HOLD',C.w,1,SM); l(row,'HOLD '+p.hold.turn,col); seg(row,[['SPD ',C.w,SM],[String(Math.round(M&&M.spds?Math.max(210,M.spds.gd):210)),col]],8); prevSpd=prevAlt=null; continue; }
        if(e.k==='hx'){ l(lab,' C'+d3(p.hold.crs)+'°',C.w,0,SM); l(row,p.id,col); l(row,'----',C.w,8,SM); l(row,'---/ -----',C.w,'r',SM); prevSpd=prevAlt=null; continue; }
        // label line: annotation, BRG / TRK, distance
        const prev=fp[e.i-1];
        if(r>0||e.i>0){ let ann=''; if(prev){ ann=p.ann==='C'?'C'+d3(brg(prev,p))+'°':(p.via||''); } if(ann) l(lab,' '+ann,C.w,0,SM);
          if(r>0&&prev){ const dist=Math.round(Math.hypot(p.N-prev.N,p.E-prev.E)/NM); const fpa=p.rwy&&p.via&&/^(ILS|RNAV|VOR)/.test(p.via)&&e.i===fp.length-1;
            if(fpa) seg(lab,[[String(dist),col],['-3.0°',C.w,SM],['  ']],'r'); else seg(lab,[[String(dist),col],[nmShown?'':'NM',col,SM],[nmShown?'     ':'   ']],'r'); nmShown=true;
            if(!isSec&&e.i===act&&M) l(lab,'BRG'+d3(brg({N:M.N,E:M.E},p))+'°',C.g,8,SM); else if(!isSec&&e.i===act+1) l(lab,'TRK'+d3(brg(prev,p))+'°',C.g,8,SM); } }
        // waypoint line
        l(row,p.id+(p.ovfy?'Δ':''),col);
        const q=w[e.i], isFrom=e.i===act-1&&!isSec;
        if(isFrom){ const ps=K.pass[e.i]; l(row,e.i===0&&!fly?'0000':ps?utc(ps.t):e.i===0&&K.toT?utc(K.toT):'----',col,8,SM);
          const hh=ps?ps.h:e.i===0?0:null; seg(row,[[e.i===0&&d.v1&&!fly?String(d.v1):'   ',col,BG],['/',col],[hh!=null?altF(hh,d.transAlt).padStart(6,' '):' -----',col]],'r'); prevSpd=prevAlt=null; continue; }
        if(q&&!isSec){ l(row,tFmt(q.t),col,8,SM);
          const sTxt=q.spd===prevSpd?' " ':String(q.spd).padStart(3,' '), aT=altF(q.h,d.transAlt), aTxt=aT===prevAlt?'  " ':aT.padStart(5,' ');
          const parts=[]; if(p.spd) parts.push(['*',C.m,BG]); parts.push([sTxt,col,SM]); parts.push(['/',col]); parts.push([p.cst?'*':' ',q.met?C.m:C.a,BG]); parts.push([aTxt,col,SM]); seg(row,parts,'r'); prevSpd=q.spd; prevAlt=aT; }
        else { l(row,'----',C.w,8,SM); const parts=[[p.spd?String(p.spd):'---',p.spd?C.m:C.w,SM],['/',C.w]]; parts.push([p.cst?cstTxt(p.cst).padStart(6,' '):' -----',p.cst?C.m:C.w,SM]); seg(row,parts,'r'); }
      }
      if(T_){ l(11,'TMPY',C.a); l(12,'<ERASE',C.a); l(11,'TMPY',C.a,'r'); l(12,'INSERT*',C.a,'r'); break; }
      const dI=fp.length-1, dp=fp[dI];
      l(11,' DEST'); l(11,tHdr,C.w,8,SM); l(11,'DIST  EFOB',C.w,'r'); l(12,dp.rwy?(d.to||'ENRD')+(d.rwy||'36'):dp.id);
      if(PR&&!isSec){ l(12,tFmt(PR.destT),C.w,8,SM); seg(12,[[String(Math.round(PR.destDist)).padStart(4,' '),C.w,SM],[' ',C.w],[fmt1(PR.destEfob).padStart(5,' '),C.w,SM]],'r'); }
      else { l(12,'----',C.w,8,SM); l(12,'---- ---.-',C.w,'r',SM); }
      break; }
    case 'latrev': { const t=K.tmpy?K.tmpy.fp:K.fpln, p=t[K.lr]; if(!p){ K.page='fpln'; return render(K,M,A); }
      title([['LAT REV '],['FROM ',C.w,SM],[p.id,C.g]]); const isDest=K.lr===t.length-1&&K.lr>0, isOrig=K.lr===0&&p.orig;
      if(isOrig) l(2,'<DEPARTURE');
      if(isDest){ l(2,'ARRIVAL>',C.w,'r'); l(8,'<ALTN'); if(d.altn&&d.to!==d.altn){ l(9,' ENABLE',C.c); l(10,'<ALTN',C.c); } }
      else { if(!isOrig&&!p.rwy&&!p.apt) l(6,'<HOLD'); if(d.altn&&!isOrig&&(K.tmpy?K.tmpy.dest:d.to)!==d.altn){ l(7,' ENABLE',C.c); l(8,'<ALTN',C.c); }
        l(7,'NEW DEST ',C.w,'r'); l(8,'[   ]',C.c,'r'); l(10,'AIRWAYS>',C.w,'r'); }
      l(5,'NEXT WPT ',C.w,'r'); l(6,'[     ]',C.c,'r'); l(12,'<RETURN'); break; }
    case 'altnsel': { P.title='ALTERNATE'; l(1,' ALTN'); Object.keys(ALTN).forEach((k,i)=>{ const a=ALTN[k]; l(2+i*2,(d.altn===k?' ':'<')+k,C.c); l(2+i*2,String(Math.round(Math.hypot(a.N,a.E)/NM))+'NM',C.g,'r',SM); }); l(12,'<RETURN'); break; }
    case 'airways': { const p=(K.tmpy?K.tmpy.fp:K.fpln)[K.lr]; title([['AIRWAYS '],['FROM ',C.w,SM],[p?p.id:'',C.g]]); l(1,' VIA'); l(2,'[    ]',C.c); l(1,'TO ',C.w,'r'); l(2,'[   ]',C.c,'r'); l(12,'<RETURN'); break; }
    case 'dep': { title([['DEPARTURES '],['FROM ',C.w,SM],[d.from||'ENRD',C.g]]); P.arrows=true; const T_=K.tmpy, sid=T_&&T_.sid!=null?T_.sid:d.sid, chg=T_&&T_.sid!=null;
      l(1,' RWY'); l(1,'SID',C.w,'c'); l(1,'TRANS ',C.w,'r'); l(2,d.rwy||'---',chg?C.y:C.g); l(2,sid||(chg?'NONE':'------'),chg?C.y:C.g,'c'); l(2,sid?'NONE':'------',chg?C.y:C.g,'r');
      if(K.depTab!=='sid'){ l(3,'AVAILABLE RUNWAYS ',C.w,'r'); l(4,(d.rwy==='36'?' ':'<')+'36 -ILS  '+RWY_LEN+'M',C.c); l(5,'   360  IASN/110.30',C.c,0,SM); }
      else { l(3,'SIDS'); l(3,'AVAILABLE',C.w,'c'); l(3,'TRANS ',C.w,'r'); const ks=[...Object.keys(SIDS),'NO SID'].slice(K.depOff,K.depOff+4); ks.forEach((x,i)=>l(4+i*2,((x==='NO SID'?'':x)===(sid||'')&&chg||x===sid?' ':'<')+x,C.c)); if(Object.keys(SIDS).length+1>4) P.vert=true; }
      if(T_){ l(11,' TMPY',C.y); l(12,'<F-PLN',C.y); } else l(12,'<RETURN'); break; }
    case 'arr': { title([['ARRIVAL '],['TO ',C.w,SM],[d.to||'ENRD',C.g]]); P.arrows=true; const T_=K.tmpy, sel=K.arrSel||{appr:d.appr,star:d.star}, chg=!!T_;
      l(1,' APPR'); l(1,'VIA',C.w,'c'); l(1,'STAR ',C.w,'r'); l(2,sel.appr||'------',chg?C.y:C.g); l(2,'NONE',chg?C.y:C.g,'c'); l(2,sel.star||'NONE',chg?C.y:C.g,'r');
      l(3,'TRANS ',C.w,'r'); l(4,'NONE',chg?C.y:C.g,'r');
      if(K.arrTab==='star'){ l(3,' APPR'); l(4,'<VIAS'); l(5,'STARS'); l(5,'AVAILABLE',C.w,'c'); l(5,'TRANS ',C.w,'r');
        const ks=[...Object.keys(STARS),'NO STAR'], vis=ks.slice(K.arrOff,K.arrOff+3); vis.forEach((x,i)=>l(6+i*2,((x==='NO STAR'?'':x)===(sel.star||'')&&(sel.star||chg)?' ':'<')+x,C.c)); if(ks.length>3) P.vert=true; }
      else { l(5,'APPR'); l(5,'AVAILABLE',C.w,7); Object.keys(APPRS).slice(K.arrOff,K.arrOff+3).forEach((x,i)=>{ l(6+i*2,(x===sel.appr?' ':'<')+x,C.c); l(6+i*2,RWY_LEN+'M',C.c,9); l(6+i*2,'CRS360',C.c,'r',SM); if(APPR_INFO[x]) l(7+i*2,APPR_INFO[x],C.c,7,SM); }); }
      if(T_){ l(11,' TMPY',C.y); l(12,'<F-PLN',C.y); } else l(12,'<RETURN'); break; }
    case 'vias': { title([['APPROACH VIAS',K.tmpy?C.y:C.w]]); const sel=K.arrSel||{appr:d.appr,star:d.star}; l(1,' APPR'); l(1,'VIA',C.w,'c'); l(1,'STAR ',C.w,'r'); l(2,sel.appr,C.y); l(2,'NONE',C.y,'c'); l(2,sel.star||'NONE',C.y,'r'); l(3,' APPR VIAS'); l(4,' NO VIA',C.c); l(12,'<RETURN'); break; }
    case 'hold': { const h=K.hold; if(!h){ K.page='fpln'; return render(K,M,A); } const T_=!!K.tmpy, col=T_?C.y:C.c;
      title([[(h.db?'DATABASE':'COMPUTED')+' HOLD ',T_?C.y:C.w],['AT ',C.w,SM],[h.id,C.g]]);
      l(1,'INB CRS'); l(2,d3(h.crs)+'°',col); l(3,'TURN'); l(4,h.turn,col); l(5,'TIME/DIST'); seg(6,[[h.time.toFixed(1)+'/',col],[(h.time*3.5).toFixed(1),col,SM]]);
      if(h.db){ l(1,'REVERT TO',C.w,'r'); l(2,'COMPUTED>',C.c,'r'); l(4,'DATABASE',col,'r'); } else { l(2,'COMPUTED',col,'r'); if(HOLDS[h.id]) l(4,'DATABASE>',C.c,'r'); }
      const FP=fuelPlan(K,M,A); l(7,'LAST EXIT',C.w,'c'); l(9,(fly?'UTC ':'TIME')+'   FUEL',C.w,'c',SM);
      // last exit: the time the holding can go on and still land with the minimum destination fuel (ALTN + FINAL)
      const fpH=K.tmpy?K.tmpy.fp:K.fpln, PR=FP&&pred(K,M,A,fpH,K.tmpy?K.tmpy.act:K.act), q=PR&&PR.w[h.idx];
      if(q){ const spare=Math.max(0,PR.destEfob-FP.mdf), tx=q.t+spare/(2.0*PR.gw/66000)*60; l(10,(fly?utc(K.now()+tx*60000):hhmm(tx))+'   '+fmt1(q.efob-spare),C.m,'c'); }
      else l(10,'----   ---.-',C.w,'c');
      if(T_){ l(11,' TMPY',C.y); l(12,'<F-PLN',C.y); } else l(12,'<RETURN'); break; }
    case 'vrev': { const t=K.tmpy?K.tmpy.fp:K.fpln, p=t[K.vr]; if(!p){ K.page='fpln'; return render(K,M,A); } const isDest=K.vr===t.length-1&&p.rwy;
      title([['VERT REV '],['AT ',C.w,SM],[p.id,C.g]]); const PR=pred(K,M,A,t,K.tmpy?K.tmpy.act:K.act), q=PR&&PR.w[K.vr], FP=fuelPlan(K,M,A);
      seg(1,[[' EFOB=',C.w,SM],[q?fmt1(q.efob):'---.-',q?C.g:C.w,SM],['     EXTRA=',C.w,SM],[FP?fmt1(Math.max(0,FP.extra)):'---.-',FP?C.g:C.w,SM]],0);
      const des=isDest||PR&&q&&K.vr>0&&PR.w[K.vr-1]&&q.h<PR.w[K.vr-1].h-50, lim=des?d.desLim:d.spdLim;
      l(3,des?' DES SPD LIM':' CLB SPD LIM'); l(4,lim?String(lim.spd).padStart(3,'0')+'/'+altF(lim.alt,des?7000:d.transAlt):'*[ ]/[   ]',lim?C.m:C.c,'l',lim&&lim.p?BG:SM); l(4,'RTA>',C.w,'r');
      l(5,' SPD CSTR'); l(6,p.spd?String(p.spd):'*[   ]',p.spd?C.m:C.c);
      if(!isDest&&!p.orig){ l(5,'ALT CSTR ',C.w,'r'); l(6,p.cst?cstTxt(p.cst):'[    ]*',p.cst?C.m:C.c,'r'); }
      if(isDest){ l(7,' QNH'); l(8,d.qnh?String(d.qnh):'[  ]',C.c); }
      l(10,'<WIND'); l(12,'<RETURN'); break; }
    case 'sec': { P.title='SEC INDEX'; l(2,'<COPY ACTIVE',C.c); l(4,'<SEC F-PLN'); if(K.sec) l(6,'<DELETE SEC',C.c); if(K.sec&&!(M&&M.ap.lat==='NAV')) l(8,'*ACTIVATE SEC',C.a); break; }
    case 'dir': { const T_=K.tmpy&&K.tmpy.dir?K.tmpy:null; P.title='DIR TO'; P.titleC=T_?C.y:C.w; P.vert=true;
      l(1,'WAYPOINT'); l(1,tHdr,C.w,13,SM); l(1,'DIST ',C.w,'r');
      if(T_){ const tgt=T_.fp[T_.act]; l(2,K.dirSel,C.y); if(tgt&&M){ const dist=Math.hypot(tgt.N-M.N,tgt.E-M.E)/NM, gs=Math.max(M.gs/KT,180); l(2,fly?utc(K.now()+dist/gs*3600000):hhmm(dist/gs*60),C.y,13); l(2,String(Math.round(dist)).padStart(4,' '),C.y,'r'); } }
      else l(2,'[     ]',C.c);
      l(3,'F-PLN WPTS'); const lst=K.fpln.slice(K.act).filter(p=>!p.synth); const o=Math.min(K.dirOff||0,Math.max(0,lst.length-4)); lst.slice(o,o+4).forEach((p,i)=>l(4+i*2,(p.id===K.dirSel?' ':'<')+p.id,C.c));
      l(4,'DIRECT TO>',C.c,'r'); l(5,'WITH ',C.w,'r'); l(6,'ABEAM PTS>',C.c,'r'); l(7,'RADIAL IN ',C.w,'r'); l(8,K.dirRad!=null?d3(K.dirRad)+'°':'[ ]°',C.c,'r'); l(9,'RADIAL OUT',C.w,'r'); l(10,'[ ]°',C.c,'r');
      if(T_){ l(11,' DIR TO',C.a); l(12,'<ERASE',C.a); l(11,'DIR TO ',C.a,'r'); l(12,'INSERT*',C.a,'r'); }
      break; }
    case 'perf': { const pp=K.perfPh||'to', act=phK===pp&&(pp!=='to'||ph==='TAKE OFF'), tc=act?C.g:C.w, s=M&&M.spds;
      const bottom=()=>{ const i=PHO.indexOf(pp), ai=PHO.indexOf(phK);
        if(fly&&act&&['clb','crz','des'].includes(pp)){ if(K.apprConf){ l(11,' CONFIRM',C.a); l(12,'*APPR PHASE',C.a); } else { l(11,' ACTIVATE',C.c); l(12,'<APPR PHASE',C.c); } }
        else if(i>0&&i-1>=ai&&pp!=='to'&&!(pp==='ga'&&false)){ l(11,' PREV'); l(12,'<PHASE'); }
        if(pp!=='ga'){ l(11,'NEXT ',C.w,'r'); l(12,'PHASE>',C.w,'r'); } };
      if(pp==='to'){ title([['TAKE OFF RWY ',tc],[d.rwy||'36',C.g]]);
        const tow=d.zfw&&d.block?d.zfw+d.block-d.taxi:null, k=tow&&M&&M.gw?Math.sqrt(tow/M.gw):1, sv=x=>s&&tow?String(Math.round(x*k)):'---', o=s&&tow?String(Math.round(s.gd+(tow-M.gw)/500)):'---', vc=act?C.g:C.c;
        l(1,' V1  FLP RETR'); seg(2,[[v3(d.v1),d.v1?vc:C.a],['   F=',C.w],[sv(s&&s.F),C.g]]); l(3,' VR  SLT RETR'); seg(4,[[v3(d.vr),d.vr?vc:C.a],['   S=',C.w],[sv(s&&s.S),C.g]]);
        l(5,' V2     CLEAN'); seg(6,[[v3(d.v2),d.v2?vc:C.a],['   O=',C.w],[o,C.g]]);
        l(7,'TRANS ALT'); l(8,String(d.transAlt),vc,'l',SM); l(9,'THR RED/ACC'); seg(10,[[String(d.thrRed).padStart(5,' '),vc,d.thrRedP?BG:SM],['/',vc],[String(d.acc),vc,d.accP?BG:SM]]);
        l(3,'TO SHIFT ',C.w,'r'); seg(4,[['[M]',C.c,SM],['[   ]*',C.c]],'r'); l(5,'FLAPS/THS',C.w,'r'); l(6,d.flaps?d.flaps+'/'+(d.ths||'UP0.0'):'[]/[   ]',C.c,'r');
        l(7,'FLEX TO TEMP',C.w,'r'); l(8,d.flex!=null?d.flex+'°':'[  ]°',d.flex!=null?vc:C.c,'r'); l(9,'ENG OUT ACC',C.w,'r'); l(10,String(d.eoAcc),vc,'r',d.eoAccP?BG:SM);
        l(11,' UPLINK'); l(12,'<TO DATA'); l(11,'NEXT ',C.w,'r'); l(12,'PHASE>',C.w,'r'); }
      else if(pp==='clb'||pp==='des'){ title([[pp==='clb'?'CLB':'DES',tc]]); const man=!!(M&&M.ap.spd.man), PR=pred(K,M,A,K.fpln,K.act);
        l(1,'ACT MODE'); l(2,man?'SELECTED':'MANAGED',C.g); l(3,'CI'); l(4,d.ci!=null?String(d.ci):'___',d.ci!=null?C.c:C.a);
        if(pp==='des'&&PR){ l(1,tHdr,C.w,9,SM); l(1,'DEST EFOB',C.w,'r'); l(2,tFmt(PR.destT),C.g,9); l(2,fmt1(PR.destEfob),C.g,'r'); }
        l(5,'MANAGED'); l(6,pp==='clb'?'300/.78':(d.crzFl>=250?'.78/300':'300'),C.g,'l',SM);
        if(fly&&M){ const fcu=M.ap.alt.v, h=M.h/FT; if(pp==='clb'?fcu>h+100:fcu<h-100){ const vs=pp==='clb'?2000:1500, tmin=Math.abs(fcu-h)/vs, dist=tmin*(M.gs/KT)/60; seg(4,[['PRED TO ',C.w,SM],[altF(fcu,d.transAlt),C.c]],'r'); l(5,tHdr,C.w,9,SM); l(5,'DIST',C.w,'r'); l(6,utc(K.now()+tmin*60000),C.g,9); l(6,String(Math.round(dist)),C.g,'r'); } }
        if(man){ l(7,' SELECTED'); l(8,String(M.ap.spd.v),C.c); } else { l(7,' PRESEL'); l(8,'[ ]',C.c); }
        bottom(); }
      else if(pp==='crz'){ title([['CRZ',tc]]); const PR=pred(K,M,A,K.fpln,K.act);
        l(1,'ACT MODE'); l(2,M&&M.ap.spd.man?'SELECTED':'MANAGED',C.g); l(3,'CI'); l(4,d.ci!=null?String(d.ci):'___',d.ci!=null?C.c:C.a);
        l(1,tHdr,C.w,9,SM); l(1,'DEST EFOB',C.w,'r'); if(PR){ l(2,tFmt(PR.destT),C.g,9); l(2,fmt1(PR.destEfob),C.g,'r'); }
        l(5,'MANAGED'); l(6,d.crzFl>=250?'.78':'300',C.g,'l',SM);
        seg(4,[['TO ',C.w,SM],['(T/D)',C.g]],'r'); l(5,tHdr,C.w,9,SM); l(5,'DIST',C.w,'r'); if(PR&&PR.td&&PR.td.t!=null){ l(6,tFmt(PR.td.t),C.g,9); l(6,String(Math.round(PR.td.cum)),C.g,'r'); } else { l(6,'----',C.w,9); l(6,'----',C.w,'r'); }
        l(9,'DES CABIN RATE',C.w,'r'); seg(10,[['-350',C.c],['FT/MN',C.w,SM]],'r'); bottom(); }
      else if(pp==='appr'){ title([['APPR',tc]]); l(0,' DEST',C.w,0,SM); const FP=fuelPlan(K,M,A), S=apprSpds(K,M,A,FP?FP.lw*1000:null);
        l(1,'QNH'); l(2,d.qnh?String(d.qnh):'____',d.qnh?C.c:C.a); l(3,'TEMP'); l(4,d.temp!=null?d.temp+'°':'[ ]°',C.c); l(5,'MAG WIND'); l(6,d.wind?d.wind.replace(/^(\d+)\/(\d+)$/,(m,a,b)=>a.padStart(3,'0')+'°/'+b.padStart(3,'0')):'[ ]°/[ ]',C.c);
        l(7,'TRANS ALT'); l(8,String(d.transAlt),C.c,'l',SM); l(9,'VAPP'); l(10,S?String(S.vapp):'---',C.c,'l',d.vapp?BG:SM);
        l(1,'FLP RETR',C.w,'c'); seg(2,[['F=',C.w],[S?String(S.F):'---',C.g]],'c'); l(3,'SLT RETR',C.w,'c'); seg(4,[['S=',C.w],[S?String(S.S):'---',C.g]],'c'); l(5,'CLEAN',C.w,'c'); seg(6,[['O=',C.w],[S?String(S.O):'---',C.g]],'c'); l(9,'VLS',C.w,'c'); l(10,S?String(S.vls):'---',C.g,'c');
        l(1,'FINAL',C.w,'r'); l(2,d.appr||'------',C.g,'r'); l(3,'MDA',C.w,'r'); l(4,d.mda?String(d.mda):'[    ]',C.c,'r'); l(5,'DH',C.w,'r'); l(6,d.dh!=null?(d.dh==='NO'?'NO DH':String(d.dh)):'[  ]',C.c,'r');
        l(7,'LDG CONF',C.w,'r'); l(8,d.ldgConf==='3'?'CONF3':'CONF3*',C.c,'r',d.ldgConf==='3'?BG:SM); l(10,d.ldgConf==='3'?'FULL*':'FULL',C.c,'r',d.ldgConf==='3'?SM:BG);
        bottom(); }
      else { title([['GO AROUND',tc]]); const S=apprSpds(K,M,A);
        l(1,'FLP RETR',C.w,'c'); seg(2,[['F=',C.w],[S?String(S.F):'---',C.g]],'c'); l(3,'SLT RETR',C.w,'c'); seg(4,[['S=',C.w],[S?String(S.S):'---',C.g]],'c'); l(5,'CLEAN',C.w,'c'); seg(6,[['O=',C.w],[S?String(S.O):'---',C.g]],'c');
        l(9,'THR RED/ACC'); seg(10,[[String(d.thrRed),C.c,d.thrRedP?BG:SM],['/',C.c],[String(d.acc),C.c,d.accP?BG:SM]]); l(9,'ENG OUT ACC',C.w,'r'); l(10,String(d.eoAcc),C.c,'r',d.eoAccP?BG:SM);
        l(11,' PREV'); l(12,'<PHASE'); }
      break; }
    case 'radnav': { P.title='RADIO NAV';
      l(1,'VOR1/FREQ'); l(2,'ASN/113.30',C.c,'l',d.vor1?BG:SM); l(1,'FREQ/VOR2',C.w,'r'); l(2,'113.30/ASN',C.c,'r',d.vor2?BG:SM);
      l(3,'CRS'); l(4,d.vor1Crs!=null?d3(d.vor1Crs):'[ ]',C.c); l(3,'CRS',C.w,'r'); l(4,d.vor2Crs!=null?d3(d.vor2Crs):'[ ]',C.c,'r');
      l(5,'ILS /FREQ'); l(6,d.ilsId+'/'+d.ilsFreq,C.c,'l',d.ilsMan?BG:SM); l(5,'CHAN/ MLS',C.w,'r'); l(6,'[ ]/[  ]',C.c,'r');
      l(7,'CRS'); l(8,'F'+d3(d.ilsCrs),C.c,'l',d.ilsMan?BG:SM); l(7,'SLOPE   CRS',C.w,'r'); seg(8,[['-.-  ',C.w],['[ ]',C.c]],'r');
      l(9,'ADF1/FREQ'); l(10,'[ ]/[  .]',C.c); l(9,'FREQ/ADF2',C.w,'r'); l(10,'[  .]/[ ]',C.c,'r'); break; }
    case 'prog': { title([[ph,C.g]],'l'); P.titleAl=Math.max(0,11-ph.length); if(d.fltNbr) l(0,d.fltNbr,C.w,13,SM);
      l(1,' CRZ'); l(2,d.crzFl?'FL'+String(d.crzFl).padStart(3,'0'):'-----',C.c); l(1,'OPT    REC MAX',C.w,'r'); l(2,'FL370   FL398 ',C.g,'r');
      l(4,'<REPORT'); l(7,'  BRG / DIST');
      const pf=K.progFix&&wp(K,K.progFix); if(pf&&M){ l(8,d3(brg({N:M.N,E:M.E},pf))+'°/'+(Math.hypot(pf.N-M.N,pf.E-M.E)/NM).toFixed(1),C.g); } else l(8,' ---°/----.-',C.w);
      seg(8,[['TO ',C.w,SM],[K.progFix||'[    ]',C.c]],'r');
      l(9,' PREDICTIVE'); l(10,'<GPS'); l(10,'GPS PRIMARY',C.g,'r'); l(11,'REQUIRED'); l(11,'ACCUR',C.w,'c'); l(11,'ESTIMATED',C.w,'r'); seg(12,[['1.0',C.c],['NM',C.c,SM]]); l(12,'HIGH',C.g,'c'); l(12,'0.06NM',C.g,'r',SM); break; }
    case 'fuel': { P.title='FUEL PRED'; const FP=fuelPlan(K,M,A), PR=FP&&FP.P;
      l(1,' AT'); l(1,tHdr,C.w,11,SM); l(1,'EFOB',C.w,'r'); l(2,d.to?d.to+(d.rwy||''):'NONE',C.g); l(4,d.altn||'NONE',C.g);
      if(PR){ l(2,tFmt(PR.destT),C.g,11); l(2,fmt1(PR.destEfob),C.g,'r'); if(d.altn){ l(4,tFmt(PR.destT+FP.altn.t),C.g,11); l(4,fmt1(PR.destEfob-FP.altn.f),C.g,'r'); } }
      else { l(2,'----',C.w,11); l(2,'---.-',C.w,'r'); l(4,'----',C.w,11); l(4,'---.-',C.w,'r'); }
      l(5,'RTE RSV/%'); l(5,'ZFW/ZFWCG',C.w,'r'); l(6,d.zfw?(d.zfw/1000).toFixed(1)+'/'+(d.zfwcg||28).toFixed(1):'___._/__._',d.zfw?C.c:C.a,'r');
      l(7,'ALTN /TIME'); l(7,'FOB      ',C.w,'r'); l(8,A?fmt1(A.fuel.fob/1000)+'/FF+FQ':'---.-',C.g,'r',SM);
      l(9,'FINAL/TIME'); l(9,'GW/   CG',C.w,'r'); l(10,A?(A.gw/1000).toFixed(1)+'/ 28.0':'---.-/--.-',C.g,'r',SM);
      l(11,'MIN DEST FOB'); l(11,'EXTRA/TIME',C.w,'r');
      if(FP){ seg(6,[[fmt1(FP.rsv)+'/',C.g],[d.rsvPct.toFixed(1),C.c]]); l(8,fmt1(FP.altn.f)+'/'+(d.altn?hhmm(FP.altn.t):'----'),C.g,'l',SM); seg(10,[[fmt1(FP.fin)+'/',C.c],[hhmm(d.finalT),C.c]]); l(12,fmt1(FP.mdf),C.c,'l',SM); l(12,fmt1(Math.max(0,FP.extra))+'/'+hhmm(FP.extraT),FP.extra<0?C.a:C.g,'r'); }
      else { l(6,'---.-/--.-'); l(8,'---.-/----'); l(10,'---.-/----'); l(12,'---.-'); l(12,'---.-/----',C.w,'r'); }
      break; }
    case 'data': P.title='DATA INDEX'; P.arrows=true; P.page=K.dataPg===2?'2/2':'1/2';
      if(K.dataPg===2){ l(1,'STORED ',C.w,'r'); l(2,'<WAYPOINTS'); l(2,'WAYPOINTS>',C.w,'r'); l(3,'STORED ',C.w,'r'); l(4,'<NAVAIDS'); l(4,'NAVAIDS>',C.w,'r'); l(5,'STORED ',C.w,'r'); l(6,'<RUNWAYS'); l(6,'RUNWAYS>',C.w,'r'); l(7,'STORED ',C.w,'r'); l(8,'<ROUTES'); l(8,'ROUTES>',C.w,'r'); }
      else { l(1,' POSITION'); l(2,'<MONITOR'); l(3,' IRS'); l(4,'<MONITOR'); l(5,' GPS'); l(6,'<MONITOR'); l(8,'<A/C STATUS'); l(9,' CLOSEST'); l(10,'<AIRPORTS'); l(11,' EQUITIME'); l(12,'<POINT'); l(11,'ACARS/PRINT ',C.w,'r'); l(12,'FUNCTION>',C.w,'r'); }
      break;
    case 'irsmon': { P.title='IRS MONITOR'; (A&&A.irs||[{},{},{}]).forEach((r,i)=>{ l(2+i*2,'<IRS'+(i+1)); l(1+i*2,r.st===2?'NAV':r.st===1?'ALIGN':'OFF',r.st===2?C.g:C.w,'c',SM); }); break; }
    case 'gpsmon': { P.title='GPS MONITOR'; [1,2].forEach((n,i)=>{ l(1+i*6,'GPS'+n+' POSITION'); l(2+i*6,'NAV',C.g); l(3+i*6,'MODE/SAT',C.w,'r'); l(4+i*6,'NAV/9',C.g,'r'); }); break; }
    case 'closest': { P.title='CLOSEST AIRPORTS'; l(1,'           BRG   DIST',C.w,0,SM); const L_=[['ENRD',{N:0,E:0}],...Object.keys(ALTN).map(k=>[k,ALTN[k]])].map(([id,p])=>[id,M?brg({N:M.N,E:M.E},p):0,M?Math.hypot(p.N-M.N,p.E-M.E)/NM:0]).sort((a,b)=>a[2]-b[2]);
      L_.forEach((x,i)=>{ l(2+i*2,x[0],C.g); l(2+i*2,d3(x[1])+'°  '+String(Math.round(x[2])).padStart(4,' '),C.g,10); }); l(12,'<RETURN'); break; }
    case 'status': P.title='A320-251N'; l(1,' ENG'); l(2,'LEAP-1A26',C.g); l(3,' ACTIVE NAV DATA BASE'); l(4,' NORDAP PRACTICE AREA',C.c); l(5,' SECOND NAV DATA BASE'); l(6,' NONE',C.c); l(9,'CHG CODE'); l(10,'[  ]',C.c); l(11,'IDLE/PERF'); l(12,'+0.0/+0.0',C.g); break;
    default: P.title=K.page.toUpperCase(); l(12,'<RETURN');
  }
  return P;
}
function remDist(K,M){ if(!M||!K.fpln.length) return 0; let d=0, prev={N:M.N,E:M.E}; for(let i=K.act;i<K.fpln.length;i++){ const p=K.fpln[i]; d+=Math.hypot(p.N-prev.N,p.E-prev.E); prev=p; } return d/NM; }
/* speed / altitude constraint entry: "250/", "/5000", "/+5000", "/-FL100", "250/+5000", CLR */
function parseCst(s){ const x=/^(\d{3})?(?:\/(?:([+-])?(FL)?(\d{2,5}))?)?$/.exec(s); if(!x||!x[1]&&!x[4]) return null; const o={};
  if(x[1]){ const v=+x[1]; if(v<100||v>350) return {err:'ENTRY OUT OF RANGE'}; o.spd=v; }
  if(x[4]){ let a=+x[4]; if(x[3]||x[4].length<=3) a*=100; if(a<0||a>39000) return {err:'ENTRY OUT OF RANGE'}; o.cst={alt:a,t:x[2]==='+'?'A':x[2]==='-'?'B':'AT'}; }
  return o; }

/* key press: returns true when the screen changed */
function key(K,k,M,A,api){
  const d=K.d; K.changed++;
  if(K.msg){ K.msg=''; if(k==='CLR') return true; }
  const err=m=>{ K.msg=m||'FORMAT ERROR'; };
  const pages={DIR:'dir',PROG:'prog',PERF:'perf',INIT:'init',DATA:'data','F-PLN':'fpln','RAD NAV':'radnav','FUEL PRED':'fuel','MCDU MENU':'menu','SEC F-PLN':'sec','ATC COMM':'menu',AIRPORT:'fpln'};
  if(pages[k]){ const was=K.page; K.page=pages[k]; K.apprConf=false;
    if(k==='F-PLN'){ K.sub=0; }
    if(k==='AIRPORT'){ const R=fplnRows(K,K.tmpy?K.tmpy.fp:K.fpln,K.tmpy?K.tmpy.act:K.act,!!K.tmpy); const di=R.findIndex(e=>e.k==='end'), ai=R.findIndex(e=>e.k==='altn');
      K.apC=was==='fpln'?((K.apC||0)+1)%(ai>=0?3:2):1; K.sub=K.apC===0?0:K.apC===1?Math.max(0,di-4):Math.max(0,ai-1); }
    if(k==='PERF') K.perfPh=PH[phase(K,M)]||'to';
    if(k==='DATA') K.dataPg=1;
    if(k==='DIR'){ if(!(K.tmpy&&K.tmpy.dir)){ K.dirSel=null; K.dirRad=null; } K.dirOff=0; }
    return true; }
  if(k==='CLR'){ K.sp=K.sp&&K.sp!=='CLR'?K.sp.slice(0,-1):K.sp==='CLR'?'':'CLR'; return true; }
  if(k==='OVFY'){ K.sp+='Δ'; return true; }
  if(k==='SP'){ K.sp+=' '; return true; }
  if(k==='+/-'){ if(K.sp==='CLR') K.sp=''; if(K.sp.endsWith('-')) K.sp=K.sp.slice(0,-1)+'+'; else K.sp+='-'; return true; }
  if(k==='+'||k==='-'){ if(K.sp==='CLR') K.sp=''; K.sp+=k; return true; } // from the PC keyboard
  if(k==='NEXT'||k==='→'||k==='←'){ if(K.page==='init') K.page='initb'; else if(K.page==='initb') K.page='init'; else if(K.page==='arr'){ K.arrTab=K.arrTab==='star'?'appr':'star'; K.arrOff=0; } else if(K.page==='dep'){ K.depTab=K.depTab==='sid'?'rwy':'sid'; K.depOff=0; } else if(K.page==='data') K.dataPg=K.dataPg===2?1:2; return true; }
  if(k==='↑'||k==='↓'){ const up=k==='↑';
    if(K.page==='fpln'||K.page==='secfp'){ const fp=K.page==='secfp'?(K.sec?K.sec.fp:[]):K.tmpy?K.tmpy.fp:K.fpln, R=fplnRows(K,fp,K.page==='secfp'?(K.sec?K.sec.act:0):K.tmpy?K.tmpy.act:K.act,!!K.tmpy); K.sub=Math.max(0,Math.min(R.length-1,K.sub+(up?1:-1))); }
    else if(K.page==='arr'){ const n=K.arrTab==='star'?Object.keys(STARS).length+1:Object.keys(APPRS).length; K.arrOff=Math.max(0,Math.min(Math.max(0,n-3),K.arrOff+(up?1:-1))); }
    else if(K.page==='dep'&&K.depTab==='sid'){ K.depOff=Math.max(0,Math.min(Math.max(0,Object.keys(SIDS).length+1-4),K.depOff+(up?1:-1))); }
    else if(K.page==='dir') K.dirOff=Math.max(0,(K.dirOff||0)+(up?1:-1));
    return true; }
  if(/^[A-Z0-9./]$/.test(k)){ if(K.sp==='CLR') K.sp=''; if(K.sp.length<22) K.sp+=k; return true; }
  // line select keys: L1..L6, R1..R6
  const m=/^([LR])([1-6])$/.exec(k); if(!m) return false;
  const side=m[1], n=+m[2], s=K.sp.trim(), clr=K.sp==='CLR';
  const take=()=>{ K.sp=''; };
  const ph=phase(K,M);
  switch(K.page){
    case 'init':
      if(side==='R'&&n===1){ const x=/^([A-Z]{4})\/([A-Z]{4})$/.exec(s); if(!x) return err(),true; d.from=x[1]; d.to=x[2]; K.fpln=build(K); K.act=1; K.tmpy=null; take(); api&&api.say&&api.say('Flight plan: practice circuit loaded (F-PLN)'); }
      else if(side==='L'&&n===2){ if(clr){ d.altn=''; take(); } else { if(!ALTN[s]) return err('NOT IN DATA BASE'),true; d.altn=s; take(); } }
      else if(side==='L'&&n===3){ if(!/^[A-Z0-9]{1,8}$/.test(s)) return err(),true; d.fltNbr=s; take(); }
      else if(side==='L'&&n===5){ if(!/^\d{1,3}$/.test(s)) return err(),true; if(+s>999) return err('ENTRY OUT OF RANGE'),true; d.ci=+s; take(); }
      else if(side==='L'&&n===6){ const x=/^(?:FL)?(\d{2,3})(?:\/(-?\d{1,2}))?$/.exec(s)||/^\/(-?\d{1,2})$/.exec(s); if(!x) return err(),true; if(/^\//.test(s)){ d.crzT=+x[1]; } else { if(+x[1]>398) return err('ENTRY OUT OF RANGE'),true; d.crzFl=+x[1]; if(x[2]!=null) d.crzT=+x[2]; } take(); }
      else if(side==='R'&&n===3&&d.from){ K.page='irsinit'; }
      else if(side==='R'&&n===5){ K.page='wind'; }
      else if(side==='R'&&n===6){ if(!/^\d{4,5}$/.test(s)) return err(),true; d.tropo=+s; take(); }
      break;
    case 'initb':
      if(side==='R'&&n===1){ const x=/^(\d{2}(?:\.\d)?)?(?:\/(\d{1,2}(?:\.\d)?))?$/.exec(s); if(!x||!s) return err(),true; if(x[1]){ if(+x[1]<35||+x[1]>80) return err('ENTRY OUT OF RANGE'),true; d.zfw=+x[1]*1000; } if(x[2]) d.zfwcg=+x[2]; if(!d.zfw) return err(),true; take(); api&&api.weights&&api.weights(d); }
      else if(side==='R'&&n===2){ const x=/^(\d{1,2}(?:\.\d)?)$/.exec(s); if(!x) return err(),true; d.block=+x[1]*1000; take(); api&&api.weights&&api.weights(d); }
      else if(side==='L'&&n===1){ const x=/^\d?\.?\d$/.exec(s); if(!x) return err(),true; d.taxi=Math.round(+s*1000); take(); }
      else if(side==='L'&&n===3){ const x=/^\/(\d{1,2}(?:\.\d)?)$/.exec(s); if(!x) return err(),true; if(+x[1]>15) return err('ENTRY OUT OF RANGE'),true; d.rsvPct=+x[1]; take(); }
      else if(side==='L'&&n===5){ const x=/^\/(\d{1,4})$/.exec(s); if(!x) return err(),true; const v=+x[1], mn=v>=100?Math.floor(v/100)*60+v%100:v; if(mn<0||mn>90) return err('ENTRY OUT OF RANGE'),true; d.finalT=mn; take(); }
      break;
    case 'irsinit': case 'wind': case 'altnsel': case 'airways': case 'closest':
      if(side==='L'&&n===6){ K.page=K.page==='irsinit'||K.page==='wind'?'init':K.page==='closest'?'data':K.page==='altnsel'||K.page==='airways'?'latrev':'fpln'; break; }
      if(K.page==='wind'&&side==='L'&&n<=5){ const x=/^(\d{3})\/(\d{1,3})\/(FL\d{3}|\d{3,5})$/.exec(s); if(!x) return err(),true; d.clbWind=d.clbWind||[]; d.clbWind[n-1]=x[1]+'°/'+x[2].padStart(3,'0')+'/'+x[3]; take(); }
      if(K.page==='altnsel'&&side==='L'&&n<=5){ const ks=Object.keys(ALTN), x=ks[n-1]; if(x){ d.altn=x; K.page='latrev'; } }
      if(K.page==='airways'&&n===1&&s){ err('NOT IN DATA BASE'); }
      break;
    case 'perf': {
      const pp=K.perfPh||'to';
      const nav=()=>{ const i=PHO.indexOf(pp), ai=PHO.indexOf(PH[ph]||'to');
        if(side==='R'&&n===6&&pp!=='ga'){ K.apprConf=false; K.perfPh=PHO[i+1]; return true; }
        if(side==='L'&&n===6){ if(M&&!M.gnd&&PH[ph]===pp&&['clb','crz','des'].includes(pp)){ if(K.apprConf){ M.ap.apprPh=true; K.apprConf=false; K.perfPh='appr'; } else K.apprConf=true; return true; }
          if(i>0&&i-1>=ai){ K.perfPh=PHO[i-1]; return true; } }
        return false; };
      const alts=(fR,fA)=>{ const x=/^(\d{3,5})?(?:\/(\d{3,5}))?$/.exec(s); if(!x||!s) return err(),false; if(x[1]){ d[fR]=+x[1]; d[fR+'P']=true; } if(fA&&x[2]){ d[fA]=+x[2]; d[fA+'P']=true; } take(); return true; };
      if(pp==='to'){
        const sp_=(f,lo,hi)=>{ if(clr){ d[f]=null; take(); return true; } if(!/^\d{3}$/.test(s)||+s<lo||+s>hi) return err('ENTRY OUT OF RANGE'),false; d[f]=+s; take(); if(d.v1&&d.vr&&d.v1>d.vr||d.vr&&d.v2&&d.vr>d.v2||d.v1&&d.v2&&d.v1>d.v2) err('V1/VR/V2 DISAGREE'); return true; };
        if(side==='L'&&n===1) sp_('v1',90,180); else if(side==='L'&&n===2) sp_('vr',100,185); else if(side==='L'&&n===3) sp_('v2',105,190);
        else if(side==='L'&&n===4){ if(!/^\d{3,5}$/.test(s)) return err(),true; d.transAlt=+s; take(); }
        else if(side==='L'&&n===5) alts('thrRed','acc');
        else if(side==='R'&&n===2) err('NOT ALLOWED');
        else if(side==='R'&&n===3){ const x=/^([123])?(?:\/((?:UP|DN)\d(?:\.\d)?|\d(?:\.\d)?(?:UP|DN)))?$/.exec(s); if(!x||!s) return err(),true; if(x[1]) d.flaps=+x[1]; if(x[2]){ const y=/^(UP|DN)(.+)$/.exec(x[2])||/^(.+)(UP|DN)$/.exec(x[2]); d.ths=/^(UP|DN)/.test(x[2])?x[2]:y[2]+y[1]; } take(); }
        else if(side==='R'&&n===4){ if(clr){ d.flex=null; take(); } else { if(!/^-?\d{1,2}$/.test(s)) return err(),true; if(+s>75) return err('ENTRY OUT OF RANGE'),true; d.flex=+s; take(); } }
        else if(side==='R'&&n===5) alts('eoAcc');
        else if(side==='L'&&n===6) err('NOT ALLOWED');
        else nav();
        api&&api.perf&&api.perf(d);
      } else if(pp==='appr'){
        if(side==='L'&&n===1){ if(/^\d{3,4}$/.test(s)&&+s>=745&&+s<=1100) d.qnh=+s; else if(/^\d{2}\.\d{2}$/.test(s)) d.qnh=Math.round(+s*33.8639); else return err(),true; take(); }
        else if(side==='L'&&n===2){ if(!/^[+-]?\d{1,2}$/.test(s)) return err(),true; d.temp=+s; take(); }
        else if(side==='L'&&n===3){ if(!/^\d{1,3}\/\d{1,3}$/.test(s)) return err(),true; const [a,b]=s.split('/'); if(+a>360) return err('ENTRY OUT OF RANGE'),true; d.wind=a+'/'+b; take(); }
        else if(side==='L'&&n===4){ if(!/^\d{3,5}$/.test(s)) return err(),true; d.transAlt=+s; take(); }
        else if(side==='L'&&n===5){ if(clr){ d.vapp=null; take(); } else { if(!/^\d{3}$/.test(s)||+s<90||+s>350) return err('ENTRY OUT OF RANGE'),true; d.vapp=+s; take(); } }
        else if(side==='R'&&n===2){ if(clr){ d.mda=null; take(); } else { if(!/^\d{2,4}$/.test(s)) return err(),true; d.mda=+s; d.dh=null; take(); } }
        else if(side==='R'&&n===3){ if(clr){ d.dh=null; take(); } else { if(!/^\d{1,3}$|^NO$/.test(s)) return err(),true; if(s!=='NO'&&+s>700) return err('ENTRY OUT OF RANGE'),true; d.dh=s==='NO'?'NO':+s; d.mda=null; take(); } }
        else if(side==='R'&&n===4){ d.ldgConf='3'; }
        else if(side==='R'&&n===5){ d.ldgConf='FULL'; }
        else nav();
        api&&api.perf&&api.perf(d);
      } else if(pp==='ga'){ if(side==='L'&&n===5){ alts('thrRed','acc'); api&&api.perf&&api.perf(d); } else if(side==='R'&&n===5) alts('eoAcc'); else if(side==='L'&&n===6) K.perfPh='appr'; }
      else { if(side==='L'&&n===2){ if(!/^\d{1,3}$/.test(s)) return err(),true; d.ci=+s; take(); } else nav(); }
      break; }
    case 'fpln': {
      if(K.tmpy&&n===6){ if(side==='L'){ K.tmpy=null; K.hold=null; K.dirSel=null; K.dirRad=null; } else insertTmpy(K,api); break; }
      const fp=K.tmpy?K.tmpy.fp:K.fpln, act=K.tmpy?K.tmpy.act:K.act;
      if(n===6){ if(side==='L'&&!s&&fp.length){ K.lr=fp.length-1; K.page='latrev'; } break; }
      const R=fplnRows(K,fp,act,!!K.tmpy), e=R[K.sub+n-1]; if(!e) break;
      if(e.k==='hold'){ const p=fp[e.i]; K.hold=Object.assign({id:p.id,idx:e.i},p.hold); K.page='hold'; break; }
      if(e.k!=='wpt'&&e.k!=='hx') break; const i=e.i, p=fp[i];
      if(side==='R'){
        if(clr){ if(p.cst||p.spd){ const t=K.tmpy?K.tmpy.fp:K.fpln; delete t[i].cst; delete t[i].spd; take(); } else err('NOT ALLOWED'); break; }
        if(s){ if(p.orig||i<act) return err('NOT ALLOWED'),true; const o=parseCst(s); if(!o) return err(),true; if(o.err) return err(o.err),true; if(o.cst&&p.rwy) return err('NOT ALLOWED'),true; const q=(K.tmpy?K.tmpy.fp:K.fpln)[i]; if(o.spd) q.spd=o.spd; if(o.cst) q.cst=o.cst; take(); break; }
        K.vr=i; K.page='vrev'; break; }
      if(clr){ if(i>act-1&&i<fp.length-1&&i>0){ const t=tmpy(K); t.fp.splice(i,1); take(); } else err('NOT ALLOWED'); break; }
      if(s==='Δ'){ const q=(K.tmpy?K.tmpy.fp:K.fpln)[i]; q.ovfy=!q.ovfy; take(); break; }
      if(s){ const q=wp(K,s.replace('Δ','')); if(!q) return err('NOT IN DATA BASE'),true; if(i<act) return err('NOT ALLOWED'),true; const t=tmpy(K); t.fp.splice(Math.max(i,1),0,q); take(); break; }
      K.lr=i; K.page='latrev';
      break; }
    case 'secfp': break;
    case 'latrev': { const t0=K.tmpy?K.tmpy.fp:K.fpln, p=t0[K.lr]; if(!p) break; const isDest=K.lr===t0.length-1&&K.lr>0, isOrig=K.lr===0&&p.orig;
      if(side==='L'&&n===6){ K.page='fpln'; break; }
      if(side==='L'&&n===1&&isOrig){ if(M&&!M.gnd) return err('NOT ALLOWED'),true; K.page='dep'; K.depTab=d.rwy?'sid':'rwy'; K.depOff=0; break; }
      if(side==='R'&&n===1&&isDest){ K.page='arr'; K.arrTab='appr'; K.arrOff=0; K.arrSel={appr:d.appr,star:d.star}; break; }
      if(side==='L'&&n===3&&!isDest&&!isOrig&&!p.rwy&&!p.apt){ const pv=t0[K.lr-1]||{N:p.N-1,E:p.E}; const db=HOLDS[p.id]; const t=tmpy(K);
        const h=db?{crs:db.crs,turn:db.turn,time:db.time,db:true}:{crs:Math.round(brg(pv,p)),turn:'R',time:1.0,db:false}; t.fp[K.lr].hold={crs:h.crs,turn:h.turn,time:h.time};
        K.hold=Object.assign({id:p.id,idx:K.lr},h); K.page='hold'; break; }
      if(side==='L'&&n===4&&isDest){ K.page='altnsel'; break; }
      if(side==='L'&&(isDest?n===5:n===4)&&d.altn&&!isOrig&&(K.tmpy?K.tmpy.dest:d.to)!==d.altn){ const t=tmpy(K); const a=wp(K,d.altn); const from=isDest?t.act:K.lr;
        t.fp=t.fp.slice(0,Math.max(Math.min(from,t.act),1)).concat([{id:'T-P',N:M?M.N:p.N,E:M?M.E:p.E,synth:true},a]); t.act=Math.max(1,t.fp.length-1); t.dest=d.altn; K.page='fpln'; K.sub=0; break; }
      if(side==='R'&&n===3&&s){ const q=wp(K,s); if(!q) return err('NOT IN DATA BASE'),true; if(isDest) return err('NOT ALLOWED'),true; const t=tmpy(K); t.fp.splice(K.lr+1,0,q); take(); K.page='fpln'; break; }
      if(side==='R'&&n===4&&s&&!isDest){ const q=wp(K,s); if(!q||!(q.apt||s==='ENRD')) return err('NOT IN DATA BASE'),true; const t=tmpy(K); t.fp=t.fp.slice(0,K.lr+1).concat([q]); t.dest=s; take(); K.page='fpln'; break; }
      if(side==='R'&&n===5&&!isDest){ K.page='airways'; break; }
      break; }
    case 'dep': {
      if(side==='L'&&n===6){ K.page='fpln'; K.sub=0; break; }
      if(K.depTab!=='sid'){ if(side==='L'&&n===2){ d.rwy='36'; K.depTab='sid'; K.depOff=0; } break; }
      if(side==='L'&&n>=2&&n<=5){ const ks=[...Object.keys(SIDS),'NO SID'], x=ks[K.depOff+n-2]; if(!x) break; const t=tmpy(K), sid=x==='NO SID'?'':x;
        // remove the legs of the SID in use, then put the new SID between the runway and the first en-route waypoint
        let fp=[]; t.fp.forEach((q,j)=>{ if(j>0&&q.via&&SIDS[q.via]){ const L=SIDS[q.via]; if(q.id!==L[L.length-1]) return; const c=Object.assign({},q); delete c.via; fp.push(c); } else fp.push(q); });
        if(sid){ const legs=SIDS[sid], endId=legs[legs.length-1]; let j=fp.findIndex((q,i)=>i>0&&q.id===endId);
          const add=legs.map(id=>{ const q=wp(K,id); if(CST[id]) q.cst=Object.assign({},CST[id]); q.via=sid; return q; });
          if(j>0) fp=[fp[0]].concat(add,fp.slice(j+1)); else fp=[fp[0]].concat(add,fp.slice(1)); }
        t.fp=fp; t.act=Math.min(Math.max(1,t.act),fp.length-1); t.sid=sid; }
      break; }
    case 'arr': { const sel=K.arrSel=K.arrSel||{appr:d.appr,star:d.star};
      if(side==='L'&&n===6){ K.page='fpln'; K.sub=0; break; }
      if(K.arrTab==='star'&&side==='L'&&n===2){ K.page='vias'; break; }
      if(side==='L'&&n>=3&&n<=5){ const ks=K.arrTab==='star'?[...Object.keys(STARS),'NO STAR']:Object.keys(APPRS), x=ks[K.arrOff+n-3]; if(!x) break; if(K.arrTab==='star') sel.star=x==='NO STAR'?'':x; else { sel.appr=x; K.arrTab='star'; K.arrOff=0; }
        // rebuild the temporary flight plan: present legs up to the active waypoint, then STAR and approach
        const t=tmpy(K), legs=[...(sel.star?STARS[sel.star].map(id=>[id,sel.star]):[]),...APPRS[sel.appr||'ILS36'].map(id=>[id,sel.appr])];
        const rest=[]; legs.forEach(([id,via])=>{ if(rest.some(r=>r.id===id)) return; const q=id==='RW36'?{id:'RW36',N:0,E:0,rwy:true}:wp(K,id); if(q){ if(CST[id]) q.cst=Object.assign({},CST[id]); q.via=via; if(via in APPRS) q.ann='C'; rest.push(q); } });
        // en-route part kept (the old STAR / approach legs and the destination runway go), joined where the new STAR starts
        const last=t.fp.length-1; let base=t.fp.filter((q,j)=>j===0||j<t.act-1||!(q.via&&(q.via in STARS||q.via in APPRS))&&!(j===last&&q.rwy));
        const cut=base.findIndex((q,j)=>j>0&&j>=t.act&&rest.some(r=>r.id===q.id)); if(cut>0) base=base.slice(0,cut);
        t.fp=base.concat(rest); t.act=Math.min(Math.max(1,t.act),t.fp.length-1); t.appr=sel.appr; t.star=sel.star; }
      break; }
    case 'vias': if(side==='L'&&(n===6||n===2)) K.page='arr'; break;
    case 'hold': { const h=K.hold; if(!h) break; const upd=()=>{ const t=tmpy(K), q=t.fp[h.idx]; if(q) q.hold={crs:h.crs,turn:h.turn,time:h.time}; };
      if(side==='L'&&n===1){ if(!/^\d{1,3}$/.test(s)||+s>360) return err(),true; h.crs=+s%360; take(); upd(); }
      else if(side==='L'&&n===2){ if(!/^[LR]$/.test(s)) return err(),true; h.turn=s; take(); upd(); }
      else if(side==='L'&&n===3){ const x=/^(\d(?:\.\d)?)(?:\/.*)?$/.exec(s); if(!x) return err(),true; h.time=Math.max(0.5,Math.min(3,+x[1])); take(); upd(); }
      else if(side==='R'&&n===1&&h.db){ const t=K.tmpy?K.tmpy.fp:K.fpln, pv=t[h.idx-1]||{N:0,E:0}; Object.assign(h,{crs:Math.round(brg(pv,t[h.idx])),turn:'R',time:1.0,db:false}); upd(); }
      else if(side==='R'&&n===2&&!h.db){ const db=HOLDS[h.id]; if(!db) return err('NOT IN DATA BASE'),true; Object.assign(h,db,{db:true}); upd(); }
      else if(side==='L'&&n===6){ K.page='fpln'; }
      break; }
    case 'vrev': { const t=K.tmpy?K.tmpy.fp:K.fpln, p=t[K.vr]; if(!p) break; const isDest=K.vr===t.length-1&&p.rwy;
      if(side==='L'&&n===6){ K.page='fpln'; break; }
      if(side==='L'&&n===2){ if(clr){ d.spdLim=null; take(); break; } const x=/^(\d{3})\/(FL)?(\d{2,5})$/.exec(s); if(!x) return err(),true; d.spdLim={spd:+x[1],alt:x[2]||+x[3]<=450?+x[3]*100:+x[3],p:true}; take(); break; }
      if(side==='L'&&n===3){ if(clr){ delete p.spd; take(); break; } if(!/^\d{3}$/.test(s)) return err(),true; if(+s<100||+s>350) return err('ENTRY OUT OF RANGE'),true; p.spd=+s; take(); break; }
      if(side==='R'&&n===3&&!isDest&&!p.orig){ if(clr){ delete p.cst; take(); break; } const o=parseCst('/'+s.replace(/^\//,'')); if(!o||!o.cst) return err(o&&o.err||'FORMAT ERROR'),true; p.cst=o.cst; take(); break; }
      if(side==='L'&&n===4&&isDest){ if(!/^\d{3,4}$/.test(s)) return err(),true; d.qnh=+s; take(); break; }
      if(side==='L'&&n===5){ K.page='wind'; break; }
      if(side==='R'&&n===2) err('NOT ALLOWED');
      break; }
    case 'sec':
      if(side==='L'&&n===1){ K.sec={fp:cp(K.fpln),act:K.act,dest:d.to}; api&&api.say&&api.say('Active flight plan copied to SEC'); }
      else if(side==='L'&&n===2){ K.page='secfp'; K.sub=0; }
      else if(side==='L'&&n===3&&K.sec){ K.sec=null; }
      else if(side==='L'&&n===4&&K.sec&&!(M&&M.ap.lat==='NAV')){ K.fpln=cp(K.sec.fp); K.act=Math.min(K.sec.act,K.fpln.length-1); d.to=K.sec.dest||d.to; K.tmpy=null; K.page='fpln'; K.sub=0; }
      break;
    case 'dir': {
      const dirTmpy=()=>K.tmpy&&K.tmpy.dir;
      const select=id=>{ if(K.tmpy&&!K.tmpy.dir) return err('TMPY F-PLN EXISTS'),false; const base=cp(K.fpln); let j=base.findIndex((x,i)=>i>=K.act&&x.id===id), q;
        if(j<0){ q=wp(K,id); if(!q) return err('NOT IN DATA BASE'),false; j=Math.max(1,K.act); base.splice(j,0,q); }
        const tp={id:'T-P',N:M?M.N:base[Math.max(0,j-1)].N,E:M?M.E:base[Math.max(0,j-1)].E,synth:true}; base.splice(j,0,tp);
        K.tmpy={fp:base,act:j+1,dest:d.to,dir:true}; K.dirSel=id; K.dirRad=null; return true; };
      if(side==='L'&&n===1&&s){ select(s)&&take(); }
      else if(side==='L'&&n>=2&&n<=5){ const lst=K.fpln.slice(K.act).filter(p=>!p.synth), o=Math.min(K.dirOff||0,Math.max(0,lst.length-4)), p=lst[o+n-2]; if(p) select(p.id); }
      else if(side==='R'&&n===2&&dirTmpy()){ const id=K.dirSel; K.tmpy=null; select(id); }
      else if(side==='R'&&n===3) err('NOT ALLOWED');
      else if(side==='R'&&n===4){ if(!dirTmpy()) return err('NOT ALLOWED'),true; if(!/^\d{1,3}$/.test(s)||+s>360) return err(),true; const r=+s%360, t=K.tmpy, j=t.act, f=t.fp[j], a=r*Math.PI/180;
        // the leg into the waypoint along the inbound course (radial + 180°), NAV intercepts it
        t.fp.splice(j-1,1,{id:'IN'+d3(r),N:f.N+Math.cos(a)*30*NM,E:f.E+Math.sin(a)*30*NM,synth:true}); K.dirRad=r; take(); }
      else if(side==='R'&&n===5){ err('NOT ALLOWED'); }
      else if(side==='L'&&n===6&&dirTmpy()){ K.tmpy=null; K.dirSel=null; K.dirRad=null; }
      else if(side==='R'&&n===6&&dirTmpy()){ insertTmpy(K,api); K.page='fpln'; K.sub=0; }
      break; }
    case 'radnav':
      if(side==='L'&&n===3){ if(clr){ d.ilsMan=false; take(); break; } if(!/^1\d{2}\.\d{1,2}$/.test(s)&&!/^[A-Z]{3,4}$/.test(s)) return err(),true; if(/^[A-Z]/.test(s)){ if(s!=='IASN') return err('NOT IN DATA BASE'),true; } else d.ilsFreq=(+s).toFixed(2); d.ilsMan=true; take(); }
      else if(side==='L'&&n===4){ const x=/^F?(\d{1,3})$/.exec(s); if(!x) return err(),true; d.ilsCrs=+x[1]%360||360; take(); }
      else if(n===1){ const k_=side==='L'?'vor1':'vor2'; if(clr){ d[k_]=null; take(); } else { if(s!=='ASN'&&s!=='113.30'&&s!=='113.3') return err('NOT IN DATA BASE'),true; d[k_]='ASN'; take(); } }
      else if(n===2){ const k_=side==='L'?'vor1Crs':'vor2Crs'; if(clr){ d[k_]=null; take(); } else { if(!/^\d{1,3}$/.test(s)) return err(),true; d[k_]=+s%360; take(); } }
      else if(n===5&&side==='L'||n===5&&side==='R'||n===3&&side==='R'||n===4&&side==='R') err('NOT IN DATA BASE');
      break;
    case 'prog':
      if(side==='R'&&n===4){ if(clr){ K.progFix=null; take(); } else { if(!wp(K,s)&&s!=='ENRD') return err('NOT IN DATA BASE'),true; K.progFix=s==='ENRD'?null:s; take(); } }
      else if(side==='L'&&n===2) err('NOT ALLOWED');
      break;
    case 'menu': if(side==='L'&&n===1) K.page='init'; break;
    case 'data':
      if(K.dataPg===2){ err('NOT ALLOWED'); break; }
      if(side==='L'&&n===2) K.page='irsmon'; else if(side==='L'&&n===3) K.page='gpsmon'; else if(side==='L'&&n===4) K.page='status'; else if(side==='L'&&n===5) K.page='closest'; else err('NOT ALLOWED');
      break;
    default: if(side==='L'&&n===6) K.page='fpln';
  }
  return true;
}
/* lateral navigation along the flight plan (TF legs, sequencing): desired track and a cross-track correction */
/* holding pattern geometry (racetrack) at fix F: inbound course crs, turns L/R, outbound time (min), radius for the speed */
function holdGeo(F,h,gs){ const c=h.crs*Math.PI/180, u={N:Math.cos(c),E:Math.sin(c)}, sg=h.turn==='L'?-1:1, pr={N:-u.E*sg,E:u.N*sg};
  const v=Math.max(gs||110,90), r=Math.max(1.2*NM,v*v/(9.81*Math.tan(25*Math.PI/180))), L=Math.max(0.5,h.time)*60*v;
  const C1={N:F.N+pr.N*r,E:F.E+pr.E*r}, C2={N:C1.N-u.N*L,E:C1.E-u.E*L}; return {u,pr,sg,r,L,C1,C2}; }
function holdShape(F,h){ const g=holdGeo(F,h,110), P=[]; const arc=(C,a0)=>{ for(let i=0;i<=12;i++){ const a=a0+g.sg*Math.PI*i/12; P.push({N:C.N+Math.cos(a)*g.r,E:C.E+Math.sin(a)*g.r}); } };
  const a1=Math.atan2(F.E-g.C1.E,F.N-g.C1.N); arc(g.C1,a1); const a2=a1+Math.PI; arc(g.C2,a2); P.push({N:F.N,E:F.E}); return P; }
function holdNav(K,M,F,h){ const g=holdGeo(F,h,M.gs), S=K.inHold, d=(p,q)=>({N:p.N-q.N,E:p.E-q.E}), dot=(a,b)=>a.N*b.N+a.E*b.E, pos={N:M.N,E:M.E};
  const brg=(dN,dE)=>((Math.atan2(dE,dN)*180/Math.PI)+360)%360;
  const circ=C=>{ const v=d(pos,C), dist=Math.hypot(v.N,v.E), tan=(brg(v.N,v.E)+90*g.sg+360)%360, e=(dist-g.r)/NM; return {dtk:tan,xtkCorr:Math.max(-35,Math.min(35,g.sg*e*40))}; };
  const tf=(A,dir)=>{ const v=d(pos,A), xtk=v.E*dir.N-v.N*dir.E; return {dtk:brg(dir.N,dir.E),xtkCorr:Math.max(-35,Math.min(35,-xtk/NM*35)),along:dot(v,dir)}; };
  if(S.ph==='t1'){ const v=d(pos,g.C1); if(dot(v,g.pr)>0&&dot(v,g.u)<0) S.ph='out'; }
  if(S.ph==='out'){ const A={N:g.C1.N+g.pr.N*g.r,E:g.C1.E+g.pr.E*g.r}, r=tf(A,{N:-g.u.N,E:-g.u.E}); if(r.along>=g.L) S.ph='t2'; else return r; }
  if(S.ph==='t2'){ const v=d(pos,g.C2); if(dot(v,g.pr)<0&&dot(v,g.u)>0) S.ph='in'; else return circ(g.C2); }
  if(S.ph==='in'){ const A={N:F.N-g.u.N*g.L,E:F.E-g.u.E*g.L}, r=tf(A,g.u); if(r.along>=g.L-0.15*NM){ S.ph='t1'; } else return r; }
  return circ(g.C1); }
function lnav(K,M){
  if(!K.fpln.length||K.act>=K.fpln.length||K.act<1) return null;
  const a=K.fpln[K.act-1], b=K.fpln[K.act];
  if(K.inHold&&K.inHold.id!==b.id) K.inHold=null;
  if(b.hold){ const dist=Math.hypot(b.N-M.N,b.E-M.E); if(!K.inHold&&dist<0.4*NM) K.inHold={id:b.id,ph:'t1'};
    if(K.inHold){ const r=holdNav(K,M,b,b.hold); return {dtk:r.dtk,xtkCorr:r.xtkCorr,toWpt:b.id,toDist:dist/NM,toBrg:((Math.atan2(b.E-M.E,b.N-M.N)*180/Math.PI)+360)%360,xtk:0,hold:true}; } }
  const lx=b.E-a.E, ly=b.N-a.N, len=Math.hypot(lx,ly)||1, ux=lx/len, uy=ly/len;
  const px=M.E-a.E, py=M.N-a.N, along=px*ux+py*uy, xtk=px*uy-py*ux; // xtk > 0: right of the leg
  const dtk=((Math.atan2(lx,ly)*180/Math.PI)+360)%360;
  const toGo=len-along, gs=Math.max(M.gs,60);
  // turn anticipation: sequence when the turn to the next leg should start (an overfly waypoint is sequenced overhead)
  const c=K.fpln[K.act+1];
  let ant=0.6*NM; if(c&&!b.ovfy){ const n2=((Math.atan2(c.E-b.E,c.N-b.N)*180/Math.PI)+360)%360; const dA=Math.abs(((n2-dtk+540)%360)-180); const r=gs*gs/(9.81*Math.tan(25*Math.PI/180)); ant=Math.min(6*NM,r*Math.tan(dA*Math.PI/360)); } else if(b.ovfy) ant=0.1*NM;
  if(toGo<ant&&K.act<K.fpln.length-1&&!b.hold){ K.pass[K.act]={t:K.now?K.now():Date.now(),h:M.h/FT}; K.act++; K.changed++; return lnav(K,M); }
  return {dtk,xtkCorr:Math.max(-35,Math.min(35,-xtk/NM*35)),toWpt:b.id,toDist:Math.hypot(b.N-M.N,b.E-M.E)/NM,toBrg:((Math.atan2(b.E-M.E,b.N-M.N)*180/Math.PI)+360)%360,xtk:xtk/NM};
}
G.A320MCDU={create,render,key,lnav,vnav,build,CST,STARS,APPRS,SIDS,ALTN,HOLDS,holdShape,pred,fuelPlan,phase,spdCst,vappOf,remDist};
})(typeof window!=='undefined'?window:globalThis);
