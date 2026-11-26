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
       qnh:null,temp:null,wind:null,mda:null,dh:null,ldgConf:'FULL',ilsFreq:'110.30',ilsCrs:360,ilsId:'IASN',transAlt:5000,altn:'',
       vor1:null,vor2:null,vor1Crs:null,vor2Crs:null,appr:'ILS36',star:'',via:''},
    fpln:[],act:0,fixes:fixes||{},changed:1,tmpy:null,sec:null,lr:null,hold:null,dirRad:null};
}
/* default route: departure runway 36, SID straight to OSVIK, then the procedure turn back to the ILS 36 (a practice circuit) */
const ROUTES={
  OSVIK1N:['RW36','D005','OSVIK'],
  PATTERN:['RW36','HOLAN','OSVIK','TUSKA','ALPOR','RONAX','FAPSO','RW36']
};
/* practice-area procedures (fictional): STARs to RONAX, approaches to runway 36, and the alternate ENRA */
const STARS={'TUSK1A':['TUSKA','ALPOR','RONAX'],'OSVI1A':['OSVIK','TUSKA','ALPOR','RONAX'],'HOLA1A':['HOLAN','OSVIK','TUSKA','ALPOR','RONAX']};
const APPRS={'ILS36':['RONAX','FAPSO','RW36'],'RNAV36':['RONAX','FAPSO','RW36'],'VOR36':['RONAX','FAPSO','RW36']};
const ALTN={ENRA:{N:-28*NM,E:22*NM}};
function wp(K,id){ const f=K.fixes[id]; if(f) return {id,N:f.N,E:f.E}; if(id==='D005') return {id,N:5*NM,E:0}; if(ALTN[id]) return {id,N:ALTN[id].N,E:ALTN[id].E,apt:true}; return null; }
const cp=L=>L.map(p=>Object.assign({},p,p.cst?{cst:Object.assign({},p.cst)}:{},p.hold?{hold:Object.assign({},p.hold)}:{}));
function tmpy(K){ if(!K.tmpy) K.tmpy={fp:cp(K.fpln),act:K.act,dest:K.d.to}; return K.tmpy; }
function insertTmpy(K,api){ const t=K.tmpy; if(!t) return; K.fpln=t.fp; K.act=Math.min(t.act,K.fpln.length-1); if(t.dest) K.d.to=t.dest; if(t.appr) K.d.appr=t.appr; if(t.star!=null) K.d.star=t.star; K.tmpy=null; K.hold=null; api&&api.dirTo&&api.dirTo(); }
/* altitude constraints on the practice circuit (ft): A at or above, B at or below, AT at */
const CST={HOLAN:{alt:4000,t:'A'},OSVIK:{alt:6000,t:'AT'},TUSKA:{alt:5000,t:'B'},ALPOR:{alt:3000,t:'AT'},RONAX:{alt:3000,t:'AT'},FAPSO:{alt:1650,t:'AT'}};
function build(K){ const L=[]; if(K.d.from) L.push({id:'ENRD36',N:0,E:0,rwy:true}); ROUTES.PATTERN.slice(1).forEach(id=>{ const p=wp(K,id); if(p){ if(id==='RW36') p.rwy=true; if(CST[id]) p.cst=Object.assign({},CST[id]); L.push(p); } }); return L; }
function cstTxt(c){ return c?(c.t==='A'?'+':c.t==='B'?'-':'')+c.alt:''; }
/* vertical guidance for managed CLB / DES: the next constraint that limits the climb or the descent, and the distance to it */
function vnav(K,M,climb,fcuAlt){
  if(!K.fpln.length||K.act<1) return null; let d=0, prev={N:M.N,E:M.E}; const h=M.h/0.3048;
  for(let i=K.act;i<K.fpln.length;i++){ const p=K.fpln[i]; d+=Math.hypot(p.N-prev.N,p.E-prev.E)/NM; prev=p; const c=p.cst; if(!c) continue;
    if(climb){ if((c.t==='B'||c.t==='AT')&&c.alt<fcuAlt&&c.alt>h-50) return {alt:c.alt,dist:d,id:p.id,t:c.t}; }
    else { if(c.alt<h-50){ const floor=(c.t==='A'||c.t==='AT')&&c.alt>fcuAlt; return {alt:floor?c.alt:Math.max(fcuAlt,c.alt),pathAlt:c.alt,dist:d,id:p.id,t:c.t,floor}; } if((c.t==='A'||c.t==='AT')&&c.alt>fcuAlt&&Math.abs(c.alt-h)<=50) return {alt:c.alt,pathAlt:c.alt,dist:d,id:p.id,t:c.t,floor:true}; } }
  return null; }
function fmt(n,w){ return String(n).padStart(w||3,' '); }
function v3(v){ return v==null?'___':String(v); }

function render(K,M,A){
  const d=K.d, lines=[], P={title:'',lines,scratch:K.msg||K.sp,scratchC:K.msg?C.a:C.w};
  const l=(row,txt,col,al,size)=>lines.push([row,txt,col||C.w,al||'l',size]);
  switch(K.page){
    case 'menu': P.title='MCDU MENU'; l(2,'<FMGC',C.g); l(4,'<ATSU'); l(6,'<AIDS'); l(8,'<CFDS'); l(12,'SELECT DESIRED SYSTEM',C.w,'c',36); break;
    case 'init': P.title='INIT'; P.arrows=true;
      l(1,' CO RTE',C.w); l(2,d.from?'NONE':'__________',d.from?C.c:C.a); l(1,'FROM/TO ',C.w,'r'); l(2,d.from?d.from+'/'+d.to:'____/____',d.from?C.c:C.a,'r');
      l(3,'ALTN/CO RTE',C.w); l(4,d.altn?d.altn+'/NONE':(d.from?'[  ]/[        ]':'----/---------'),d.altn||d.from?C.c:C.w); l(5,'FLT NBR',C.w); l(6,d.fltNbr||'________',d.fltNbr?C.c:C.a);
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
    case 'fpln': { const T_=K.tmpy; P.title=T_?'TMPY':'FROM'; if(T_) P.titleC=C.y; const fp=T_?T_.fp:K.fpln, act=T_?T_.act:K.act; if(!fp.length){ l(2,'------END OF F-PLN------',C.w,'c'); l(4,'NO F-PLN: ENTER FROM/TO',C.w,'c',34); l(6,'ON INIT PAGE',C.w,'c',34); break; }
      const st=K.sub; for(let i=0;i<5;i++){ const k=st+i; const row=2+i*2; if(k>=fp.length){ if(k===fp.length) l(row,'------END OF F-PLN------',C.w,'c'); break; }
        const p=fp[k], col=T_?C.y:k===act?C.w:C.g, prev=fp[k-1];
        if(prev){ const brg=Math.round(((Math.atan2(p.E-prev.E,p.N-prev.N)*180/Math.PI)+360)%360), dst=Math.round(Math.hypot(p.N-prev.N,p.E-prev.E)/NM); l(row-1,(p.hold?' HOLD '+(p.hold.turn==='L'?'L':'R'):' C'+String(brg).padStart(3,'0')+'°')+'   '+dst+'NM',T_?C.y:k===act?C.w:C.g,'l',36); }
        l(row,(p.id).padEnd(8,' '),col); l(row,(k===0?'0000 ':'---- ')+'  '+(p.cst?cstTxt(p.cst):(k===0?'0':'-----')),T_?C.y:p.cst?C.m:(k===act?C.w:C.g),'r'); }
      if(T_){ l(12,'<ERASE',C.a); l(12,'INSERT*',C.a,'r'); break; }
      l(11,'DEST    TIME  DIST  EFOB',C.w); l(12,(d.to||'ENRD')+(d.to==='ENRA'?'    ':'36  ')+'----  '+String(Math.round(remDist(K,M))).padStart(4,' ')+'  '+(A?(A.fuel.fob/1000).toFixed(1):'--.-'),C.w); break; }
    case 'latrev': { const t=K.tmpy?K.tmpy.fp:K.fpln, p=t[K.lr]; if(!p){ K.page='fpln'; return render(K,M,A); } P.title='LAT REV FROM '+p.id; const isDest=p.rwy&&K.lr>0||p.apt;
      if(K.lr===0) l(2,'<DEPARTURE',C.w); l(4,'<OFFSET',C.w); if(!p.rwy&&!p.apt) l(6,'<HOLD',C.w); if(d.altn&&!isDest) l(8,'<ENABLE ALTN',C.c);
      if(isDest) l(2,'ARRIVAL>',C.w,'r'); l(5,'NEXT WPT ',C.w,'r'); l(6,'[    ]',C.c,'r'); l(7,'NEW DEST ',C.w,'r'); l(8,'[  ]',C.c,'r'); l(12,'<RETURN',C.w); break; }
    case 'arr': { P.title='ARRIVAL TO '+(d.to||'ENRD'); const sel=K.arrSel||{appr:d.appr,star:d.star};
      l(1,' APPR',C.w); l(2,sel.appr||'------',C.y); l(1,'STAR ',C.w,'r'); l(2,sel.star||'------',C.y,'r');
      const ks=K.arrTab==='star'?['NO STAR',...Object.keys(STARS)]:Object.keys(APPRS); l(3,K.arrTab==='star'?' STARS':' APPR AVAILABLE',C.w); l(3,K.arrTab==='star'?'<APPR':'STAR>',C.w,'r');
      ks.slice(0,3).forEach((x,i)=>l(4+i*2,(x===(K.arrTab==='star'?sel.star||'NO STAR':sel.appr)?' ':'<')+x,C.c));
      l(12,'<TMPY F-PLN',C.y); break; }
    case 'hold': { const h=K.hold; if(!h){ K.page='fpln'; return render(K,M,A); } P.title='HOLD AT '+h.id; P.titleC=C.y;
      l(1,'INB CRS',C.w); l(2,String(h.crs).padStart(3,'0')+'°',C.c); l(3,'TURN',C.w); l(4,h.turn,C.c); l(5,'TIME/DIST',C.w); l(6,h.time.toFixed(1)+'/'+(h.time*3.5).toFixed(1),C.c);
      l(1,h.db?'DATABASE':'COMPUTED',C.g,'r'); l(2,h.db?'COMPUTED>':'DATABASE>',C.w,'r'); l(5,'LAST EXIT',C.w,'r'); l(6,'----  --.-',C.g,'r'); l(12,'<TMPY F-PLN',C.y); l(12,'INSERT*',C.a,'r'); break; }
    case 'sec': { P.title='SEC INDEX'; l(2,'<COPY ACTIVE',C.w); l(4,'<SEC F-PLN',C.w); if(K.sec&&!(M&&M.ap.lat==='NAV')) l(8,'*ACTIVATE SEC',C.c); if(K.sec) l(10,'<DELETE SEC',C.w); l(12,K.sec?'SEC: '+K.sec.fp.map(p=>p.id).slice(1,5).join(' '):'NO SEC F-PLN',C.w,'l',34); break; }
    case 'dir': P.title='DIR TO'; l(1,' WAYPOINT',C.w); l(2,K.dirSel?'['+K.dirSel+']':'[     ]',C.c); K.fpln.slice(K.act,K.act+4).forEach((p,i)=>l(4+i*2,'<'+p.id,C.c));
      l(5,'RADIAL IN ',C.w,'r'); l(6,K.dirRad!=null?String(K.dirRad).padStart(3,'0')+'°':'[ ]°',C.c,'r'); l(7,'RADIAL OUT ',C.w,'r'); l(8,'[ ]°',C.c,'r'); if(K.dirSel&&K.dirPend) l(12,'DIR TO*',C.a,'r'); break;
    case 'perf': { const ph=K.perfPh||'to';
      if(ph==='to'){ P.title='TAKE OFF'; P.titleC=C.g;
        l(1,' V1',C.w); l(2,v3(d.v1),d.v1?C.c:C.a); l(3,' VR',C.w); l(4,v3(d.vr),d.vr?C.c:C.a); l(5,' V2',C.w); l(6,v3(d.v2),d.v2?C.c:C.a);
        l(1,'RWY',C.w,'c'); l(2,'36',C.g,'c'); l(3,'TO SHIFT',C.w,'c'); l(4,'[M][  ]*',C.c,'c');
        l(7,'TRANS ALT',C.w); l(8,String(d.transAlt),C.c); l(9,'THR RED/ACC',C.w); l(10,d.thrRed+'/'+d.acc,C.c);
        l(1,'FLAPS/THS',C.w,'r'); l(2,d.flaps?d.flaps+'/'+(d.ths||'UP0.0'):'[]/[    ]',C.c,'r'); l(3,'FLEX TO TEMP',C.w,'r'); l(4,d.flex!=null?d.flex+'°':'[ ]°',C.c,'r');
        l(5,'ENG OUT ACC',C.w,'r'); l(6,String(d.acc),C.c,'r');
        l(12,'<UPLINK          NEXT',C.w); l(12,'PHASE>',C.w,'r'); }
      else if(ph==='ga'){ P.title='GO AROUND'; l(9,'THR RED/ACC',C.w); l(10,d.thrRed+'/'+d.acc,C.c); l(9,'ENG OUT ACC',C.w,'r'); l(10,String(d.acc),C.c,'r'); l(12,'<PREV',C.w); }
      else if(ph==='clb'){ P.title='CLB'; P.titleC=C.w; l(1,' ACT MODE',C.w); l(2,'SELECTED',C.g); l(3,' CI',C.w); l(4,d.ci!=null?String(d.ci):'---',C.c); l(5,' MANAGED',C.w); l(6,'250/.78',C.m); l(12,M&&!M.gnd&&!M.ap.apprPh?(K.apprConf?'CONFIRM APPR PHASE*':'<ACTIVATE APPR PHASE'):'<PREV',K.apprConf?C.a:C.w); l(12,'NEXT PHASE>',C.w,'r'); }
      else if(ph==='crz'){ P.title='CRZ'; l(1,' ACT MODE',C.w); l(2,'MANAGED',C.g); l(3,' CI',C.w); l(4,d.ci!=null?String(d.ci):'---',C.c); l(5,' MANAGED',C.w); l(6,'.78',C.m); l(12,M&&!M.gnd&&!M.ap.apprPh?(K.apprConf?'CONFIRM APPR PHASE*':'<ACTIVATE APPR PHASE'):'<PREV',K.apprConf?C.a:C.w); l(12,'NEXT PHASE>',C.w,'r'); }
      else if(ph==='des'){ P.title='DES'; l(1,' ACT MODE',C.w); l(2,'MANAGED',C.g); l(5,' MANAGED',C.w); l(6,'.78/300',C.m); l(12,M&&!M.gnd&&!M.ap.apprPh?(K.apprConf?'CONFIRM APPR PHASE*':'<ACTIVATE APPR PHASE'):'<PREV',K.apprConf?C.a:C.w); l(12,'NEXT PHASE>',C.w,'r'); }
      else { P.title='APPR'; P.titleC=C.w;
        l(1,'QNH',C.w); l(2,d.qnh?String(d.qnh):'[    ]',d.qnh?C.c:C.a); l(3,'TEMP',C.w); l(4,d.temp!=null?d.temp+'°':'[ ]°',C.c); l(5,'MAG WIND',C.w); l(6,d.wind||'[ ]°/[ ]',C.c);
        l(7,'TRANS FL',C.w); l(8,'FL070',C.c); l(9,'VAPP',C.w); l(10,M?String(Math.round(M.ap.vapp)):'---',C.c);
        l(1,'FINAL',C.w,'r'); l(2,d.appr||'ILS36',C.g,'r'); l(3,'BARO',C.w,'r'); l(4,d.mda?String(d.mda):'[    ]',C.c,'r'); l(5,'RADIO',C.w,'r'); l(6,d.dh!=null?String(d.dh):'[    ]',C.c,'r');
        l(7,'LDG CONF',C.w,'r'); l(8,d.ldgConf==='3'?'CONF3*':'FULL',C.c,'r'); l(9,'',C.w,'r'); l(10,d.ldgConf==='3'?'FULL*':'CONF3*',C.c,'r');
        if(M){ const s=M.spds||{}; l(5,'',C.w,'c'); l(1,'FLP RETR',C.w,'c'); l(2,'F='+(s.F?Math.round(s.F):'---'),C.g,'c'); l(3,'SLT RETR',C.w,'c'); l(4,'S='+(s.S?Math.round(s.S):'---'),C.g,'c'); l(5,'CLEAN',C.w,'c'); l(6,'O='+(s.gd?Math.round(s.gd):'---'),C.g,'c'); l(9,'VLS',C.w,'c'); l(10,String(s.vs1g?Math.round(s.vs1g*1.23):'---'),C.g,'c'); }
        l(1,'',C.w); l(2,'',C.w); if(M&&M.ap.apprPh) P.titleC=C.g; l(12,'<PREV',C.w); l(12,'NEXT PHASE>',C.w,'r'); }
      break; }
    case 'radnav': P.title='RADIO NAV'; l(1,'VOR1/FREQ',C.w); l(2,d.vor1?'ASN/113.30':'ASN/113.30',C.c,'l',d.vor1?null:34); l(1,'FREQ/VOR2',C.w,'r'); l(2,d.vor2?'113.30/ASN':'[  ]/[    ]',C.c,'r'); l(3,'CRS',C.w); l(4,d.vor1Crs!=null?String(d.vor1Crs).padStart(3,'0'):'---',C.c); l(3,'CRS',C.w,'r'); l(4,d.vor2Crs!=null?String(d.vor2Crs).padStart(3,'0'):'---',C.c,'r');
      l(5,'LS /FREQ',C.w); l(6,d.ilsId+'/'+d.ilsFreq,C.m); l(7,'CRS',C.w); l(8,String(d.ilsCrs).padStart(3,'0'),C.m); l(9,'ADF1/FREQ',C.w); l(10,'AN/375.0',C.c); break;
    case 'prog': { P.title=M&&M.gnd?'PREFLIGHT':'CRZ '+(d.crzFl?'FL'+d.crzFl:''); P.titleC=C.g;
      l(1,' CRZ',C.w); l(2,d.crzFl?'FL'+d.crzFl:'-----',C.c); l(1,'OPT     REC MAX',C.w,'r'); l(2,'FL350  FL393',C.g,'r');
      l(3,'<REPORT',C.w); l(5,' POSITION UPDATE AT',C.w); l(6,'*[     ]',C.c); l(7,'  BRG /DIST',C.w); l(8,'---°/----.-',C.g);
      l(9,'  PREDICTIVE',C.w); l(10,'<GPS        GPS PRIMARY',C.g); l(11,'REQUIRED ACCUR ESTIMATED',C.w); l(12,'1.0NM   HIGH      0.06NM',C.g); break; }
    case 'fuel': P.title='FUEL PRED'; l(1,'AT',C.w); l(2,(d.to||'----')+' ----',C.g); l(5,'GW/CG',C.w); l(6,A?(A.gw/1000).toFixed(1)+'/28.0':'---',C.g); l(5,'FOB',C.w,'r'); l(6,A?(A.fuel.fob/1000).toFixed(1):'--.-',C.g,'r'); break;
    case 'data': P.title='DATA INDEX'; l(2,'<POSITION MONITOR',C.w); l(4,'<IRS MONITOR',C.w); l(6,'<GPS MONITOR',C.w); l(8,'<A/C STATUS',C.w); l(2,'WAYPOINTS>',C.w,'r'); l(4,'NAVAIDS>',C.w,'r'); l(6,'RUNWAYS>',C.w,'r'); break;
    case 'status': P.title='A320-251N'; l(1,' ENG',C.w); l(2,'LEAP-1A26',C.g); l(3,' ACTIVE NAV DATA BASE',C.w); l(4,' NORDAP PRACTICE AREA',C.c); l(5,' SECOND NAV DATA BASE',C.w); l(6,' NONE',C.c); l(9,'CHG CODE',C.w); l(10,'[  ]',C.c); l(11,'IDLE/PERF',C.w); l(12,'+0.0/+0.0',C.g); break;
    case 'atc': P.title='ATC MENU'; l(6,'NO ATSU IN THIS AIRCRAFT',C.w,'c',34); break;
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
  if(pages[k]){ K.page=pages[k]; K.sub=0; K.apprConf=false; if(k==='AIRPORT'&&K.fpln.length) K.sub=Math.max(0,(K.tmpy?K.tmpy.fp:K.fpln).length-5); if(k==='PERF') K.perfPh=M&&!M.gnd?(M.ap.appr||M.conf>0&&!M.ap.clbPh?'appr':'clb'):'to'; if(k==='DIR'){ K.dirSel=null; K.dirRad=null; K.dirPend=false; } return true; }
  if(k==='CLR'){ K.sp=K.sp?K.sp.slice(0,-1):'CLR'; return true; }
  if(k==='OVFY'){ K.sp+='Δ'; return true; }
  if(k==='SP'){ K.sp+=' '; return true; }
  if(k==='+/-'){ if(K.sp.endsWith('-')) K.sp=K.sp.slice(0,-1)+'+'; else K.sp+='-'; return true; }
  if(k==='NEXT'||k==='→'||k==='←'){ if(K.page==='init') K.page='initb'; else if(K.page==='initb') K.page='init'; else if(K.page==='arr') K.arrTab=K.arrTab==='star'?'appr':'star'; return true; }
  if(k==='↑'){ if(K.page==='fpln'){ const n_=(K.tmpy?K.tmpy.fp:K.fpln).length; K.sub=Math.max(0,K.sub+1>=n_?K.sub:K.sub+1); } return true; }
  if(k==='↓'){ if(K.page==='fpln') K.sub=Math.max(0,K.sub-1); return true; }
  if(/^[A-Z0-9./]$/.test(k)){ if(K.sp==='CLR') K.sp=''; if(K.sp.length<22) K.sp+=k; return true; }
  // line select keys: L1..L6, R1..R6
  const m=/^([LR])([1-6])$/.exec(k); if(!m) return false;
  const side=m[1], n=+m[2], s=K.sp.trim(), clr=K.sp==='CLR';
  const take=()=>{ K.sp=''; };
  switch(K.page){
    case 'init':
      if(side==='R'&&n===1){ const x=/^([A-Z]{4})\/([A-Z]{4})$/.exec(s); if(!x) return err(),true; d.from=x[1]; d.to=x[2]; K.fpln=build(K); K.act=1; take(); api&&api.say&&api.say('Flight plan: practice circuit loaded (F-PLN)'); }
      else if(side==='L'&&n===2){ if(clr){ d.altn=''; take(); } else { if(!ALTN[s]) return err('NOT IN DATA BASE'),true; d.altn=s; take(); } }
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
        else if(side==='R'&&n===6){ K.perfPh='ga'; }
        api&&api.perf&&api.perf(d);
      } else if(K.perfPh==='ga'){ if(side==='L'&&n===6) K.perfPh='appr'; else if(side==='L'&&n===5){ const x=/^(\d{3,5})?\/?(\d{3,5})?$/.exec(s); if(!x||!s) return err(),true; if(x[1]) d.thrRed=+x[1]; if(x[2]) d.acc=+x[2]; take(); api&&api.perf&&api.perf(d); } }
      else { if(side==='L'&&n===6){ if(M&&!M.gnd&&!M.ap.apprPh){ if(K.apprConf){ M.ap.apprPh=true; K.apprConf=false; K.perfPh='appr'; } else K.apprConf=true; } else K.perfPh=K.perfPh==='des'?'crz':K.perfPh==='crz'?'clb':'to'; } if(side==='R'&&n===6){ K.apprConf=false; K.perfPh=K.perfPh==='clb'?'crz':K.perfPh==='crz'?'des':'appr'; } }
      break;
    case 'fpln': {
      if(K.tmpy&&n===6){ if(side==='L'){ K.tmpy=null; } else { insertTmpy(K,api); } break; }
      const i=K.sub+n-1; if(side!=='L'||n===6) break;
      const fp=K.tmpy?K.tmpy.fp:K.fpln;
      if(clr){ if(i>(K.tmpy?K.tmpy.act:K.act)-1&&i<fp.length&&i>0){ const t=tmpy(K); t.fp.splice(i,1); take(); } else err('NOT ALLOWED'); break; }
      if(s){ const p=wp(K,s); if(!p) return err('NOT IN DATA BASE'),true; const t=tmpy(K); t.fp.splice(Math.max(i,1),0,p); take(); break; }
      if(i<fp.length){ K.lr=i; K.page='latrev'; }
      break; }
    case 'latrev': { const t0=K.tmpy?K.tmpy.fp:K.fpln, p=t0[K.lr]; if(!p) break;
      if(side==='L'&&n===6){ K.page='fpln'; break; }
      if(side==='L'&&n===3&&!p.rwy&&!p.apt){ const nx=t0[K.lr+1]||p, pv=t0[K.lr-1]||{N:p.N-1,E:p.E}; const crs=Math.round(((Math.atan2(p.E-pv.E,p.N-pv.N)*180/Math.PI)+360)%360); K.hold={id:p.id,idx:K.lr,crs,turn:'R',time:1.0,db:false}; tmpy(K); K.page='hold'; break; }
      if(side==='L'&&n===4&&d.altn){ const t=tmpy(K); const a=wp(K,d.altn); t.fp=t.fp.slice(0,Math.max(t.act,1)).concat([{id:'(T/P)',N:M?M.N:p.N,E:M?M.E:p.E},a]); t.act=Math.max(1,t.fp.length-1); t.dest=d.altn; K.page='fpln'; K.sub=Math.max(0,t.act-1); break; }
      if(side==='R'&&n===1&&(p.rwy&&K.lr>0||p.apt)){ K.page='arr'; K.arrTab='appr'; K.arrSel={appr:d.appr,star:d.star}; break; }
      if(side==='R'&&n===3&&s){ const q=wp(K,s); if(!q) return err('NOT IN DATA BASE'),true; const t=tmpy(K); t.fp.splice(K.lr+1,0,q); take(); K.page='fpln'; break; }
      if(side==='R'&&n===4&&s){ const q=wp(K,s); if(!q||!(q.apt||s==='ENRD')) return err('NOT IN DATA BASE'),true; const t=tmpy(K); t.fp=t.fp.slice(0,K.lr+1).concat([q]); t.dest=s; take(); K.page='fpln'; break; }
      break; }
    case 'arr': { const sel=K.arrSel=K.arrSel||{appr:d.appr,star:d.star};
      if(side==='R'&&n===2){ K.arrTab=K.arrTab==='star'?'appr':'star'; break; }
      if(side==='L'&&n>=2&&n<=4){ const ks=K.arrTab==='star'?['NO STAR',...Object.keys(STARS)]:Object.keys(APPRS), x=ks[n-2]; if(!x) break; if(K.arrTab==='star') sel.star=x==='NO STAR'?'':x; else { sel.appr=x; K.arrTab='star'; }
        // rebuild the temporary flight plan: present legs up to the active waypoint, then STAR and approach
        const t=tmpy(K), keep=t.fp.slice(0,Math.max(1,t.act)), legs=[...(sel.star?STARS[sel.star]:[]),...APPRS[sel.appr||'ILS36']];
        const rest=[]; legs.forEach(id=>{ if(rest.some(r=>r.id===id)) return; const q=id==='RW36'?{id:'RW36',N:0,E:0,rwy:true}:wp(K,id); if(q){ if(CST[id]) q.cst=Object.assign({},CST[id]); rest.push(q); } });
        t.fp=keep.concat(rest); t.act=Math.min(Math.max(1,t.act),t.fp.length-1); t.appr=sel.appr; t.star=sel.star; break; }
      if(side==='L'&&n===6){ K.page='fpln'; break; }
      break; }
    case 'hold': { const h=K.hold; if(!h) break;
      if(side==='L'&&n===1){ if(!/^\d{1,3}$/.test(s)||+s>360) return err(),true; h.crs=+s%360; take(); }
      else if(side==='L'&&n===2){ if(!/^[LR]$/.test(s)) return err(),true; h.turn=s; take(); }
      else if(side==='L'&&n===3){ const x=/^(\d(?:\.\d)?)/.exec(s); if(!x) return err(),true; h.time=Math.max(0.5,Math.min(3,+x[1])); take(); }
      else if(side==='R'&&n===2){ h.db=!h.db; }
      else if(side==='L'&&n===6||side==='R'&&n===6){ const t=tmpy(K); const q=t.fp[h.idx]; if(q) q.hold={crs:h.crs,turn:h.turn,time:h.time}; K.page='fpln'; if(side==='R') insertTmpy(K,api); }
      break; }
    case 'sec':
      if(side==='L'&&n===1){ K.sec={fp:cp(K.fpln),act:K.act,dest:d.to}; api&&api.say&&api.say('Active flight plan copied to SEC'); }
      else if(side==='L'&&n===2){ if(K.sec){ K.tmpy={fp:cp(K.sec.fp),act:K.sec.act,dest:K.sec.dest}; K.page='fpln'; } }
      else if(side==='L'&&n===4&&K.sec&&!(M&&M.ap.lat==='NAV')){ K.fpln=cp(K.sec.fp); K.act=Math.min(K.sec.act,K.fpln.length-1); d.to=K.sec.dest||d.to; K.tmpy=null; api&&api.dirTo&&api.dirTo(); K.page='fpln'; }
      else if(side==='L'&&n===5){ K.sec=null; }
      break;
    case 'dir':
      if(side==='L'&&n===1&&s){ const p=wp(K,s); if(!p) return err('NOT IN DATA BASE'),true; const j=K.fpln.findIndex(x=>x.id===s); if(j>=0){ K.act=j; } else { K.fpln.splice(K.act,0,p); } K.dirSel=s; take(); api&&api.dirTo&&api.dirTo(); K.page='fpln'; K.sub=Math.max(0,K.act-1); }
      else if(side==='R'&&n===3){ if(!/^\d{1,3}$/.test(s)||!K.dirSel) return err(K.dirSel?'FORMAT ERROR':'SELECT WAYPOINT FIRST'),true; K.dirRad=+s%360; take(); const j=K.fpln.findIndex(x=>x.id===K.dirSel); if(j>0){ const f=K.fpln[j], r=K.dirRad*Math.PI/180; K.fpln.splice(j,0,{id:'CF'+String(K.dirRad).padStart(3,'0'),N:f.N-Math.cos(r)*30*NM,E:f.E-Math.sin(r)*30*NM,synth:true}); K.act=j+1; api&&api.dirTo&&api.dirTo(); K.page='fpln'; K.sub=Math.max(0,K.act-1); } }
      else if(side==='L'&&n>=3){ const j=K.act+(n-3); if(K.fpln[j]){ K.act=j; K.dirSel=K.fpln[j].id; api&&api.dirTo&&api.dirTo(); K.page='fpln'; K.sub=Math.max(0,K.act-1); } }
      break;
    case 'radnav':
      if(side==='L'&&n===3){ if(!/^1\d{2}\.\d{1,2}$/.test(s)&&!/^[A-Z]{4}$/.test(s)) return err(),true; if(/^[A-Z]/.test(s)){ if(s!=='IASN') return err('NOT IN DATA BASE'),true; } else d.ilsFreq=s; take(); }
      else if(side==='L'&&n===4){ if(!/^\d{1,3}$/.test(s)) return err(),true; d.ilsCrs=+s; take(); }
      else if(n===1){ const k_=side==='L'?'vor1':'vor2'; if(clr){ d[k_]=null; take(); } else { if(s!=='ASN'&&s!=='113.30'&&s!=='113.3') return err('NOT IN DATA BASE'),true; d[k_]='ASN'; take(); } }
      else if(n===2){ const k_=side==='L'?'vor1Crs':'vor2Crs'; if(clr){ d[k_]=null; take(); } else { if(!/^\d{1,3}$/.test(s)) return err(),true; d[k_]=+s%360; take(); } }
      break;
    case 'menu': if(side==='L'&&n===1) K.page='init'; if(side==='L'&&n===4) K.page='status'; break;
    case 'data': if(side==='L'&&n===4) K.page='status'; break;
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
  // turn anticipation: sequence when the turn to the next leg should start
  const c=K.fpln[K.act+1];
  let ant=0.6*NM; if(c){ const n2=((Math.atan2(c.E-b.E,c.N-b.N)*180/Math.PI)+360)%360; const dA=Math.abs(((n2-dtk+540)%360)-180); const r=gs*gs/(9.81*Math.tan(25*Math.PI/180)); ant=Math.min(6*NM,r*Math.tan(dA*Math.PI/360)); }
  if(toGo<ant&&K.act<K.fpln.length-1&&!b.hold){ K.act++; K.changed++; return lnav(K,M); }
  return {dtk,xtkCorr:Math.max(-35,Math.min(35,-xtk/NM*35)),toWpt:b.id,toDist:Math.hypot(b.N-M.N,b.E-M.E)/NM,toBrg:((Math.atan2(b.E-M.E,b.N-M.N)*180/Math.PI)+360)%360,xtk:xtk/NM};
}
G.A320MCDU={create,render,key,lnav,vnav,build,CST,STARS,APPRS,ALTN,holdShape};
})(typeof window!=='undefined'?window:globalThis);
