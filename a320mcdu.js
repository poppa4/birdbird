/* NORDAP – A320 MCDU (a320.html): the pages a crew uses to prepare and fly a flight in the practice area.
   INIT A (FROM/TO, FLT NBR, COST INDEX, CRZ FL), INIT B (ZFW, BLOCK), F-PLN (the active flight plan with SID / approach legs,
   DIR TO, insert / delete with CLR), PERF (TAKE OFF: V1, VR, V2, FLAPS/THS, FLEX TO TEMP, THR RED / ACC; APPR: QNH, TEMP,
   WIND, MINIMUMS, LDG CONF, VAPP), RAD NAV (ILS ident / frequency / course), PROG, DATA, FUEL PRED and MCDU MENU.
   Entry rules as on the aircraft: type into the scratchpad, press the line select key; CLR clears the scratchpad or, with an
   empty scratchpad, puts CLR in it to delete a field or a waypoint; wrong formats give FORMAT ERROR.
   Practice-area data (fictional, as in the other NORDAP sims): NORDAP field "ENRD" runway 36, fixes from airproc.js. */
(function(G){
'use strict';
const C={g:'#2bff4a',c:'#29e4ff',a:'#ffa21a',w:'#ffffff',m:'#ff58ff',y:'#ffff32'};
const NM=1852;
function create(fixes){
  return {page:'init',sp:'',spC:C.w,msg:'',sub:0,dirSel:null,
    d:{from:'',to:'',fltNbr:'',ci:null,crzFl:null,crzT:null,zfw:null,zfwcg:null,block:null,v1:null,vr:null,v2:null,flaps:null,ths:null,flex:null,thrRed:1500,acc:1500,
       qnh:null,temp:null,wind:null,mda:null,dh:null,ldgConf:'FULL',ilsFreq:'110.30',ilsCrs:360,ilsId:'IASN',transAlt:5000},
    fpln:[],act:0,fixes:fixes||{},changed:1};
}
/* default route: departure runway 36, SID straight to OSVIK, then the procedure turn back to the ILS 36 (a practice circuit) */
const ROUTES={
  OSVIK1N:['RW36','D005','OSVIK'],
  PATTERN:['RW36','HOLAN','OSVIK','TUSKA','ALPOR','RONAX','FAPSO','RW36']
};
function wp(K,id){ const f=K.fixes[id]; if(f) return {id,N:f.N,E:f.E}; if(id==='D005') return {id,N:5*NM,E:0}; return null; }
function build(K){ const L=[]; if(K.d.from) L.push({id:'ENRD36',N:0,E:0,rwy:true}); ROUTES.PATTERN.slice(1).forEach(id=>{ const p=wp(K,id); if(p) L.push(p); }); return L; }
function fmt(n,w){ return String(n).padStart(w||3,' '); }
function v3(v){ return v==null?'___':String(v); }

function render(K,M,A){
  const d=K.d, lines=[], P={title:'',lines,scratch:K.msg||K.sp,scratchC:K.msg?C.a:C.w};
  const l=(row,txt,col,al,size)=>lines.push([row,txt,col||C.w,al||'l',size]);
  switch(K.page){
    case 'menu': P.title='MCDU MENU'; l(2,'<FMGC',C.g); l(4,'<ATSU'); l(6,'<AIDS'); l(8,'<CFDS'); l(12,'SELECT DESIRED SYSTEM',C.w,'c',36); break;
    case 'init': P.title='INIT'; P.arrows=true;
      l(1,' CO RTE',C.w); l(2,d.from?'NONE':'__________',d.from?C.c:C.a); l(1,'FROM/TO ',C.w,'r'); l(2,d.from?d.from+'/'+d.to:'____/____',d.from?C.c:C.a,'r');
      l(3,'ALTN/CO RTE',C.w); l(4,'----/---------',C.w); l(5,'FLT NBR',C.w); l(6,d.fltNbr||'________',d.fltNbr?C.c:C.a);
      l(7,'LAT',C.w); l(8,'----.--',C.w); l(7,'LONG',C.w,'r'); l(8,'-----.--',C.w,'r');
      l(9,'COST INDEX',C.w); l(10,d.ci!=null?String(d.ci):'___',d.ci!=null?C.c:C.a); l(9,'WIND/TEMP>',C.w,'r');
      l(11,'CRZ FL/TEMP',C.w); l(12,d.crzFl?('FL'+String(d.crzFl).padStart(3,'0')+'/'+(d.crzT!=null?d.crzT:Math.round(15-d.crzFl*100*0.00198))+'°'):'_____/___°',d.crzFl?C.c:C.a); l(11,'TROPO',C.w,'r'); l(12,'36090',C.c,'r');
      break;
    case 'initb': P.title='INIT B'; P.arrows=true;
      l(1,'TAXI',C.w); l(2,'0.2',C.c); l(1,'ZFW/ZFWCG',C.w,'r'); l(2,d.zfw?(d.zfw/1000).toFixed(1)+'/'+(d.zfwcg||28.0).toFixed(1):'___._/__._',d.zfw?C.c:C.a,'r');
      l(3,'TRIP/TIME',C.w); l(4,'---.-/----',C.w); l(3,'BLOCK',C.w,'r'); l(4,d.block?(d.block/1000).toFixed(1):'__._',d.block?C.c:C.a,'r');
      l(5,'RTE RSV/%',C.w); l(6,'---.-/5.0',C.w); l(7,'ALTN/TIME',C.w); l(8,'---.-/----',C.w); l(9,'FINAL/TIME',C.w); l(10,'---.-/0030',C.w);
      l(11,'MIN DEST FOB',C.w); l(12,'---.-',C.w); l(5,'TOW',C.w,'r'); l(6,d.zfw&&d.block?((d.zfw+d.block-200)/1000).toFixed(1):'---.-',C.g,'r'); l(7,'LW',C.w,'r'); l(8,'---.-',C.w,'r');
      break;
    case 'fpln': { P.title='FROM'; const fp=K.fpln; if(!fp.length){ l(2,'------END OF F-PLN------',C.w,'c'); l(4,'NO F-PLN: ENTER FROM/TO',C.w,'c',34); l(6,'ON INIT PAGE',C.w,'c',34); break; }
      const st=K.sub; for(let i=0;i<5;i++){ const k=st+i; const row=2+i*2; if(k>=fp.length){ if(k===fp.length) l(row,'------END OF F-PLN------',C.w,'c'); break; }
        const p=fp[k], col=k===K.act?C.w:C.g, prev=fp[k-1];
        if(prev){ const brg=Math.round(((Math.atan2(p.E-prev.E,p.N-prev.N)*180/Math.PI)+360)%360), dst=Math.round(Math.hypot(p.N-prev.N,p.E-prev.E)/NM); l(row-1,' C'+String(brg).padStart(3,'0')+'°   '+dst+'NM',k===K.act?C.w:C.g,'l',36); }
        l(row,(p.id).padEnd(8,' '),col); l(row,(k===0?'0000 ':'---- ')+'  '+(p.alt?p.alt:(k===0?'0':'-----')),k===K.act?C.w:C.g,'r'); }
      l(11,'DEST    TIME  DIST  EFOB',C.w); l(12,(d.to||'ENRD')+'36  ----  '+String(Math.round(remDist(K,M))).padStart(4,' ')+'  '+(A?(A.fuel.fob/1000).toFixed(1):'--.-'),C.w); break; }
    case 'dir': P.title='DIR TO'; l(1,' WAYPOINT',C.w); l(2,K.dirSel?'['+K.dirSel+']':'[     ]',C.c); K.fpln.slice(K.act,K.act+5).forEach((p,i)=>l(4+i*2,'<'+p.id,C.c)); break;
    case 'perf': { const ph=K.perfPh||'to';
      if(ph==='to'){ P.title='TAKE OFF'; P.titleC=C.g;
        l(1,' V1',C.w); l(2,v3(d.v1),d.v1?C.c:C.a); l(3,' VR',C.w); l(4,v3(d.vr),d.vr?C.c:C.a); l(5,' V2',C.w); l(6,v3(d.v2),d.v2?C.c:C.a);
        l(1,'RWY',C.w,'c'); l(2,'36',C.g,'c'); l(3,'TO SHIFT',C.w,'c'); l(4,'[M][  ]*',C.c,'c');
        l(7,'TRANS ALT',C.w); l(8,String(d.transAlt),C.c); l(9,'THR RED/ACC',C.w); l(10,d.thrRed+'/'+d.acc,C.c);
        l(1,'FLAPS/THS',C.w,'r'); l(2,d.flaps?d.flaps+'/'+(d.ths||'UP0.0'):'[]/[    ]',C.c,'r'); l(3,'FLEX TO TEMP',C.w,'r'); l(4,d.flex!=null?d.flex+'°':'[ ]°',C.c,'r');
        l(5,'ENG OUT ACC',C.w,'r'); l(6,String(d.acc),C.c,'r');
        l(12,'<UPLINK          NEXT',C.w); l(12,'PHASE>',C.w,'r'); }
      else if(ph==='clb'){ P.title='CLB'; P.titleC=C.w; l(1,' ACT MODE',C.w); l(2,'SELECTED',C.g); l(3,' CI',C.w); l(4,d.ci!=null?String(d.ci):'---',C.c); l(5,' MANAGED',C.w); l(6,'250/.78',C.m); l(12,'<PREV           NEXT',C.w); l(12,'PHASE>',C.w,'r'); }
      else if(ph==='crz'){ P.title='CRZ'; l(1,' ACT MODE',C.w); l(2,'MANAGED',C.g); l(3,' CI',C.w); l(4,d.ci!=null?String(d.ci):'---',C.c); l(5,' MANAGED',C.w); l(6,'.78',C.m); l(12,'<PREV',C.w); l(12,'NEXT PHASE>',C.w,'r'); }
      else if(ph==='des'){ P.title='DES'; l(1,' ACT MODE',C.w); l(2,'MANAGED',C.g); l(5,' MANAGED',C.w); l(6,'.78/300',C.m); l(12,'<PREV',C.w); l(12,'NEXT PHASE>',C.w,'r'); }
      else { P.title='APPR'; P.titleC=C.w;
        l(1,'QNH',C.w); l(2,d.qnh?String(d.qnh):'[    ]',d.qnh?C.c:C.a); l(3,'TEMP',C.w); l(4,d.temp!=null?d.temp+'°':'[ ]°',C.c); l(5,'MAG WIND',C.w); l(6,d.wind||'[ ]°/[ ]',C.c);
        l(7,'TRANS FL',C.w); l(8,'FL070',C.c); l(9,'VAPP',C.w); l(10,M?String(Math.round(M.ap.vapp)):'---',C.c);
        l(1,'FINAL',C.w,'r'); l(2,'ILS36',C.g,'r'); l(3,'BARO',C.w,'r'); l(4,d.mda?String(d.mda):'[    ]',C.c,'r'); l(5,'RADIO',C.w,'r'); l(6,d.dh!=null?String(d.dh):'[    ]',C.c,'r');
        l(7,'LDG CONF',C.w,'r'); l(8,d.ldgConf==='3'?'CONF3*':'FULL',C.c,'r'); l(9,'',C.w,'r'); l(10,d.ldgConf==='3'?'FULL*':'CONF3*',C.c,'r');
        if(M){ const s=M.spds||{}; l(5,'',C.w,'c'); l(1,'FLP RETR',C.w,'c'); l(2,'F='+(s.F?Math.round(s.F):'---'),C.g,'c'); l(3,'SLT RETR',C.w,'c'); l(4,'S='+(s.S?Math.round(s.S):'---'),C.g,'c'); l(5,'CLEAN',C.w,'c'); l(6,'O='+(s.gd?Math.round(s.gd):'---'),C.g,'c'); l(9,'VLS',C.w,'c'); l(10,String(s.vs1g?Math.round(s.vs1g*1.23):'---'),C.g,'c'); }
        l(12,'<PREV',C.w); l(12,'NEXT PHASE>',C.w,'r'); }
      break; }
    case 'radnav': P.title='RADIO NAV'; l(1,'VOR1/FREQ',C.w); l(2,'ASN/113.30',C.c); l(1,'FREQ/VOR2',C.w,'r'); l(2,'[  ]/[    ]',C.c,'r'); l(3,'CRS',C.w); l(4,'---',C.c);
      l(5,'LS /FREQ',C.w); l(6,d.ilsId+'/'+d.ilsFreq,C.m); l(7,'CRS',C.w); l(8,String(d.ilsCrs).padStart(3,'0'),C.m); l(9,'ADF1/FREQ',C.w); l(10,'AN/375.0',C.c); break;
    case 'prog': { P.title=M&&M.gnd?'PREFLIGHT':'CRZ '+(d.crzFl?'FL'+d.crzFl:''); P.titleC=C.g;
      l(1,' CRZ',C.w); l(2,d.crzFl?'FL'+d.crzFl:'-----',C.c); l(1,'OPT     REC MAX',C.w,'r'); l(2,'FL350  FL393',C.g,'r');
      l(3,'<REPORT',C.w); l(5,' POSITION UPDATE AT',C.w); l(6,'*[     ]',C.c); l(7,'  BRG /DIST',C.w); l(8,'---°/----.-',C.g);
      l(9,'  PREDICTIVE',C.w); l(10,'<GPS        GPS PRIMARY',C.g); l(11,'REQUIRED ACCUR ESTIMATED',C.w); l(12,'1.0NM   HIGH      0.06NM',C.g); break; }
    case 'fuel': P.title='FUEL PRED'; l(1,'AT',C.w); l(2,(d.to||'----')+' ----',C.g); l(5,'GW/CG',C.w); l(6,A?(A.gw/1000).toFixed(1)+'/28.0':'---',C.g); l(5,'FOB',C.w,'r'); l(6,A?(A.fuel.fob/1000).toFixed(1):'--.-',C.g,'r'); break;
    case 'data': P.title='DATA INDEX'; l(2,'<POSITION MONITOR',C.w); l(4,'<IRS MONITOR',C.w); l(6,'<GPS MONITOR',C.w); l(8,'<A/C STATUS',C.w); l(2,'WAYPOINTS>',C.w,'r'); l(4,'NAVAIDS>',C.w,'r'); l(6,'RUNWAYS>',C.w,'r'); break;
    case 'status': P.title='A320-271N'; l(1,' ENG',C.w); l(2,'LEAP-1A26',C.g); l(3,' ACTIVE NAV DATA BASE',C.w); l(4,' NORDAP PRACTICE AREA',C.c); l(5,' SECOND NAV DATA BASE',C.w); l(6,' NONE',C.c); l(9,'CHG CODE',C.w); l(10,'[  ]',C.c); l(11,'IDLE/PERF',C.w); l(12,'+0.0/+0.0',C.g); break;
    default: P.title=K.page.toUpperCase(); l(6,'NOT AVAILABLE IN THIS VERSION',C.w,'c',34);
  }
  return P;
}
function remDist(K,M){ if(!M||!K.fpln.length) return 0; let d=0, prev={N:M.N,E:M.E}; for(let i=K.act;i<K.fpln.length;i++){ const p=K.fpln[i]; d+=Math.hypot(p.N-prev.N,p.E-prev.E); prev=p; } return d/NM; }

/* key press: returns true when the screen changed */
function key(K,k,M,A,api){
  const d=K.d; K.changed++;
  if(K.msg){ K.msg=''; if(k!=='CLR') {} else return true; }
  const err=m=>{ K.msg=m||'FORMAT ERROR'; };
  const pages={DIR:'dir',PROG:'prog',PERF:'perf',INIT:'init',DATA:'data','F-PLN':'fpln','RAD NAV':'radnav','FUEL PRED':'fuel','MCDU MENU':'menu','SEC F-PLN':'sec','ATC COMM':'atc',AIRPORT:'fpln'};
  if(pages[k]){ K.page=pages[k]; K.sub=0; if(k==='PERF') K.perfPh=M&&!M.gnd?(M.ap.appr||M.conf>0&&!M.ap.clbPh?'appr':'clb'):'to'; if(k==='DIR') K.dirSel=null; return true; }
  if(k==='CLR'){ K.sp=K.sp?K.sp.slice(0,-1):'CLR'; return true; }
  if(k==='OVFY'){ K.sp+='Δ'; return true; }
  if(k==='SP'){ K.sp+=' '; return true; }
  if(k==='+/-'){ if(K.sp.endsWith('-')) K.sp=K.sp.slice(0,-1)+'+'; else K.sp+='-'; return true; }
  if(k==='NEXT'||k==='→'||k==='←'){ if(K.page==='init') K.page='initb'; else if(K.page==='initb') K.page='init'; return true; }
  if(k==='↑'){ if(K.page==='fpln') K.sub=Math.max(0,K.sub+1>=K.fpln.length?K.sub:K.sub+1); return true; }
  if(k==='↓'){ if(K.page==='fpln') K.sub=Math.max(0,K.sub-1); return true; }
  if(/^[A-Z0-9./]$/.test(k)){ if(K.sp==='CLR') K.sp=''; if(K.sp.length<22) K.sp+=k; return true; }
  // line select keys: L1..L6, R1..R6
  const m=/^([LR])([1-6])$/.exec(k); if(!m) return false;
  const side=m[1], n=+m[2], s=K.sp.trim(), clr=K.sp==='CLR';
  const take=()=>{ K.sp=''; };
  switch(K.page){
    case 'init':
      if(side==='R'&&n===1){ const x=/^([A-Z]{4})\/([A-Z]{4})$/.exec(s); if(!x) return err(),true; d.from=x[1]; d.to=x[2]; K.fpln=build(K); K.act=1; take(); api&&api.say&&api.say('Flight plan: practice circuit loaded (F-PLN)'); }
      else if(side==='L'&&n===3){ if(!/^[A-Z0-9]{1,8}$/.test(s)) return err(),true; d.fltNbr=s; take(); }
      else if(side==='L'&&n===5){ if(!/^\d{1,3}$/.test(s)) return err(),true; d.ci=+s; take(); }
      else if(side==='L'&&n===6){ const x=/^(?:FL)?(\d{2,3})(?:\/(-?\d{1,2}))?$/.exec(s); if(!x) return err(),true; d.crzFl=+x[1]; if(x[2]!=null) d.crzT=+x[2]; take(); }
      break;
    case 'initb':
      if(side==='R'&&n===1){ const x=/^(\d{2}(?:\.\d)?)(?:\/(\d{2}(?:\.\d)?))?$/.exec(s); if(!x) return err(),true; d.zfw=+x[1]*1000; if(x[2]) d.zfwcg=+x[2]; take(); api&&api.weights&&api.weights(d); }
      else if(side==='R'&&n===2){ const x=/^(\d{1,2}(?:\.\d)?)$/.exec(s); if(!x) return err(),true; d.block=+x[1]*1000; take(); api&&api.weights&&api.weights(d); }
      break;
    case 'perf':
      if((K.perfPh||'to')==='to'){
        const sp_=(f,lo,hi)=>{ if(!/^\d{3}$/.test(s)||+s<lo||+s>hi) return err('ENTRY OUT OF RANGE'),false; d[f]=+s; take(); return true; };
        if(side==='L'&&n===1){ sp_('v1',90,180); } else if(side==='L'&&n===2){ sp_('vr',100,185); } else if(side==='L'&&n===3){ sp_('v2',105,190); }
        else if(side==='L'&&n===5){ const x=/^(\d{3,5})?\/?(\d{3,5})?$/.exec(s); if(!x||!s) return err(),true; if(x[1]) d.thrRed=+x[1]; if(x[2]) d.acc=+x[2]; take(); }
        else if(side==='R'&&n===1){ const x=/^([123])(?:\/((?:UP|DN)\d(?:\.\d)?))?$/.exec(s); if(!x) return err(),true; d.flaps=+x[1]; if(x[2]) d.ths=x[2]; take(); }
        else if(side==='R'&&n===2){ if(!/^\d{1,2}$/.test(s)) return err(),true; d.flex=+s; take(); }
        else if(side==='R'&&n===6){ K.perfPh='clb'; }
        api&&api.perf&&api.perf(d);
      } else if(K.perfPh==='appr'){
        if(side==='L'&&n===1){ if(!/^\d{3,4}$/.test(s)) return err(),true; d.qnh=+s; take(); }
        else if(side==='L'&&n===2){ if(!/^-?\d{1,2}$/.test(s)) return err(),true; d.temp=+s; take(); }
        else if(side==='L'&&n===3){ if(!/^\d{3}\/\d{1,3}$/.test(s)) return err(),true; d.wind=s; take(); }
        else if(side==='R'&&n===2){ if(clr){ d.mda=null; take(); } else { if(!/^\d{2,4}$/.test(s)) return err(),true; d.mda=+s; d.dh=null; take(); } }
        else if(side==='R'&&n===3){ if(clr){ d.dh=null; take(); } else { if(!/^\d{1,3}$|^NO$/.test(s)) return err(),true; d.dh=s==='NO'?'NO':+s; d.mda=null; take(); } }
        else if(side==='R'&&n===5){ d.ldgConf=d.ldgConf==='3'?'FULL':'3'; }
        else if(side==='L'&&n===6){ K.perfPh='des'; }
        api&&api.perf&&api.perf(d);
      } else { if(side==='L'&&n===6) K.perfPh=K.perfPh==='des'?'crz':K.perfPh==='crz'?'clb':'to'; if(side==='R'&&n===6) K.perfPh=K.perfPh==='clb'?'crz':K.perfPh==='crz'?'des':'appr'; }
      break;
    case 'fpln': {
      const i=K.sub+n-1; if(side!=='L') break;
      if(clr){ if(i>K.act-0&&i<K.fpln.length){ K.fpln.splice(i,1); take(); } else err('NOT ALLOWED'); break; }
      if(s){ const p=wp(K,s); if(!p) return err('NOT IN DATA BASE'),true; K.fpln.splice(Math.max(i,1),0,p); take(); }
      break; }
    case 'dir':
      if(side==='L'&&n===1&&s){ const p=wp(K,s); if(!p) return err('NOT IN DATA BASE'),true; const j=K.fpln.findIndex(x=>x.id===s); if(j>=0){ K.act=j; } else { K.fpln.splice(K.act,0,p); } K.dirSel=s; take(); api&&api.dirTo&&api.dirTo(); K.page='fpln'; K.sub=Math.max(0,K.act-1); }
      else if(side==='L'&&n>=3){ const j=K.act+(n-3); if(K.fpln[j]){ K.act=j; K.dirSel=K.fpln[j].id; api&&api.dirTo&&api.dirTo(); K.page='fpln'; K.sub=Math.max(0,K.act-1); } }
      break;
    case 'radnav':
      if(side==='L'&&n===3){ if(!/^1\d{2}\.\d{1,2}$/.test(s)&&!/^[A-Z]{4}$/.test(s)) return err(),true; if(/^[A-Z]/.test(s)){ if(s!=='IASN') return err('NOT IN DATA BASE'),true; } else d.ilsFreq=s; take(); }
      else if(side==='L'&&n===4){ if(!/^\d{1,3}$/.test(s)) return err(),true; d.ilsCrs=+s; take(); }
      break;
    case 'menu': if(side==='L'&&n===1) K.page='init'; if(side==='L'&&n===4) K.page='status'; break;
    case 'data': if(side==='L'&&n===4) K.page='status'; break;
  }
  return true;
}
/* lateral navigation along the flight plan (TF legs, sequencing): desired track and a cross-track correction */
function lnav(K,M){
  if(!K.fpln.length||K.act>=K.fpln.length||K.act<1) return null;
  const a=K.fpln[K.act-1], b=K.fpln[K.act];
  const lx=b.E-a.E, ly=b.N-a.N, len=Math.hypot(lx,ly)||1, ux=lx/len, uy=ly/len;
  const px=M.E-a.E, py=M.N-a.N, along=px*ux+py*uy, xtk=px*uy-py*ux; // xtk > 0: right of the leg
  const dtk=((Math.atan2(lx,ly)*180/Math.PI)+360)%360;
  const toGo=len-along, gs=Math.max(M.gs,60);
  // turn anticipation: sequence when the turn to the next leg should start
  const c=K.fpln[K.act+1];
  let ant=0.6*NM; if(c){ const n2=((Math.atan2(c.E-b.E,c.N-b.N)*180/Math.PI)+360)%360; const dA=Math.abs(((n2-dtk+540)%360)-180); const r=gs*gs/(9.81*Math.tan(25*Math.PI/180)); ant=Math.min(6*NM,r*Math.tan(dA*Math.PI/360)); }
  if(toGo<ant&&K.act<K.fpln.length-1){ K.act++; K.changed++; return lnav(K,M); }
  return {dtk,xtkCorr:Math.max(-35,Math.min(35,-xtk/NM*35)),toWpt:b.id,toDist:Math.hypot(b.N-M.N,b.E-M.E)/NM,toBrg:((Math.atan2(b.E-M.E,b.N-M.N)*180/Math.PI)+360)%360,xtk:xtk/NM};
}
G.A320MCDU={create,render,key,lnav,build};
})(typeof window!=='undefined'?window:globalThis);
