/* NORDAP – Boeing 737-800 CDU / FMC (b737.html): the pages a crew uses to set up and fly a flight in the practice area.
   IDENT, POS INIT, RTE (origin, destination, runway, flight number, route), RTE LEGS (direct-to, insert, delete, altitude
   constraints), PERF INIT, N1 LIMIT, TAKEOFF REF (V1 / VR / V2 accepted from the FMC values), APPROACH REF (VREF), CLB, CRZ,
   DES, PROGRESS, NAV RAD, DEP/ARR, MENU. Entry rules as on the aircraft: type into the scratchpad, press the line select key;
   CLR deletes the last character (or a message), DEL puts DELETE in the scratchpad; a change to the active route makes a MOD
   page and lights EXEC, which makes it active. The flight plan is the same object the A320 FMS uses (a320mcdu.js), so the
   lateral and vertical guidance (LNAV / VNAV) is shared. Practice-area data (fictional): field ENRD runway 36. */
(function(G){
'use strict';
const C={g:'#3dff4e',c:'#38e8ff',a:'#ffb21a',w:'#ffffff',m:'#ff4cff'};
const NM=1852, D2R=Math.PI/180;
const pad=(s,n)=>String(s).padEnd(n,' '), lpad=(s,n)=>String(s).padStart(n,' ');
const brg=(a,b)=>Math.round(((Math.atan2(b.E-a.E,b.N-a.N)/D2R)+360)%360)||360, dist=(a,b)=>Math.hypot(b.N-a.N,b.E-a.E)/NM;
function cstTxt(c){ return c?String(c.alt)+(c.t==='A'?'A':c.t==='B'?'B':''):''; }
function parseCst(s){ // "250/5000A", "/5000", "5000B", "FL100"
  let spd=null, alt=s; if(s.includes('/')){ const [a,b]=s.split('/'); if(a) spd=+a; alt=b; }
  if(!alt) return spd?{spd}:null; let t='AT'; if(/[AB]$/.test(alt)){ t=alt.slice(-1); alt=alt.slice(0,-1); }
  let v=alt.startsWith('FL')?+alt.slice(2)*100:+alt; if(!isFinite(v)||v<0||v>41000) return undefined; if(v<1000&&!alt.startsWith('FL')&&alt.length<=3) v*=100;
  return {alt:Math.round(v),t,spd}; }
function wpt(K,id){ if(id==='RW36') return {id:'RW36',N:0,E:0,rwy:true}; const f=K.fixes[id]; return f?{id,N:f.N,E:f.E}:null; }
const PAGES_GND=['ident','pos','rte','perf','n1','to'];
/* ---------- what the FMC computes ---------- */
function vspeeds(K,A){ const gw=(A&&A.gw)||62000, f=K.d.toFlaps||5, k=Math.sqrt(gw/60000), d=f===1?6:f===15?-6:f===10?-3:0;
  return {v1:Math.round(138*k+d),vr:Math.round(141*k+d),v2:Math.round(146*k+d+1)}; }
function vrefs(A){ const gw=(A&&A.gw)||58000, k=Math.sqrt(gw/58000); return [[15,Math.round(147*k)],[30,Math.round(140*k)],[40,Math.round(134*k)]]; }
function trimFor(K){ const cg=K.d.cg||22; return Math.max(2,Math.min(8,(8.3-cg*0.15)+(K.d.toFlaps===1?0.5:0))).toFixed(2); }
function pend(K,label,fn){ K.exec=fn; K.execLabel=label; K.changed++; }
function plan(K){ return K.mod||K.fpln; }

function render(K,M,A){
  const d=K.d, lines=[], P={title:'',lines,scratch:K.msg||K.sp,scratchC:C.w,pg:''};
  const l=(row,txt,col,al,sz)=>lines.push([row,txt,col||C.w,al||'l',sz]);
  const act=K.active, modT=K.mod?'MOD ':act?'ACT ':'';
  switch(K.page){
    case 'ident': P.title='IDENT'; P.pg='1/2';
      l(1,' MODEL'); l(2,'737-800'); l(1,'ENG RATING ','','r'); l(2,'26K','','r');
      l(3,' NAV DATA'); l(4,'NRD2611001'); l(3,'ACTIVE ','','r'); l(4,'NOV13DEC10/26','','r');
      l(7,' OP PROGRAM'); l(8,'NORDAP-737'); l(11,'','',''); l(12,'<INDEX'); l(12,'POS INIT>','','r'); P.dash=true; break;
    case 'index': P.title='INIT/REF INDEX'; P.pg='1/1';
      l(2,'<IDENT'); l(4,'<POS'); l(6,'<PERF'); l(8,'<TAKEOFF'); l(10,'<APPROACH'); l(12,'<OFFSET'); l(2,'NAV DATA>','','r'); l(12,'MAINT>','','r'); break;
    case 'pos': P.title='POS INIT'; P.pg='1/3';
      l(1,'','',''); l(1,'LAST POS ','','r'); l(2,'N59°10.6 E010°15.3','','r');
      l(3,' REF AIRPORT'); l(4,d.refApt||'----',d.refApt?C.w:C.w); l(5,' GATE'); l(6,'-----');
      l(7,'SET IRS POS ','','r'); l(8,K.irsSet?'N59°10.6 E010°15.3':'□□□°□□.□ □□□□°□□.□','','r');
      { const t=new Date(); l(9,' GMT-MON/DY'); l(10,String(t.getUTCHours()).padStart(2,'0')+String(t.getUTCMinutes()).padStart(2,'0')+'.'+Math.floor(t.getUTCSeconds()/6)+'z '+String(t.getUTCMonth()+1).padStart(2,'0')+'/'+String(t.getUTCDate()).padStart(2,'0')); }
      P.dash=true; l(12,'<INDEX'); l(12,'ROUTE>','','r'); break;
    case 'rte': { const pg=K.sub>0?2:1; P.title=modT+'RTE 1'; P.pg=pg+'/2';
      if(pg===1){ l(1,' ORIGIN'); l(2,d.from||'□□□□'); l(1,'DEST ','','r'); l(2,d.to||'□□□□','','r');
        l(3,' RUNWAY'); l(4,d.rwy||'-----'); l(3,'FLT NO. ','','r'); l(4,d.fltNbr||'--------','','r');
        l(5,' CO ROUTE'); l(6,'----------'); P.dash=true; l(12,'<RTE 2'); l(12,K.mod||K.exec?'':(act?'PERF INIT>':'ACTIVATE>'),'','r'); }
      else { l(1,' VIA'); l(1,'TO ','','r'); const fp=plan(K); const ids=fp.filter(p=>!p.rwy).map(p=>p.id); const st=K.sub2||0;
        for(let i=0;i<5;i++){ const id=ids[st+i]; if(id){ l(2+i*2,'DIRECT'); l(2+i*2,id,'','r'); } else if(i===ids.length-st){ l(2+i*2,'-----'); l(2+i*2,'-----','','r'); break; } }
        P.dash=true; l(12,K.mod?'<ERASE':'<RTE 1'); l(12,act&&!K.mod?'PERF INIT>':'ACTIVATE>','','r'); }
      break; }
    case 'legs': { const fp=plan(K); P.title=(K.mod?'MOD ':act?'ACT ':'')+'RTE 1 LEGS'; const first=Math.max(1,K.mod?K.modAct:K.act); const n=Math.max(1,Math.ceil((fp.length-first)/5)); const pg=Math.min(K.sub,n-1); P.pg=(pg+1)+'/'+n;
      if(!fp.length){ l(2,'THE ROUTE IS EMPTY',C.w,'c'); l(4,'ENTER IT ON RTE',C.w,'c'); break; }
      for(let i=0;i<5;i++){ const k=first+pg*5+i; if(k>=fp.length){ if(k===fp.length&&i<5){ l(2+i*2,'----- END OF ROUTE -----',C.w,'c'); } break; }
        const p=fp[k], prev=fp[k-1]||{N:M?M.N:0,E:M?M.E:0}, isAct=k===(K.mod?K.modAct:K.act)&&act&&!K.mod, col=isAct?C.m:C.w;
        const cr=lpad(brg(prev,p),3)+'°', ds=dist(k===(K.mod?K.modAct:K.act)&&M&&!M.gnd?{N:M.N,E:M.E}:prev,p);
        l(1+i*2,' '+cr+' '.repeat(Math.max(1,6-String(Math.round(ds)).length))+(ds<10?ds.toFixed(1):Math.round(ds))+'NM',C.w);
        l(2+i*2,p.id,col); const c=p.cst; if(c&&c.alt) l(2+i*2,(c.spd?c.spd:'---')+'/'+lpad(cstTxt(c),6),C.w,'r'); else l(2+i*2,(p.rwy?'137/':' ---/')+(p.rwy?' 0':'------'),C.w,'r','s'); }
      P.dash=true; l(12,K.mod?'<ERASE':'<RTE 2 LEGS'); l(12,!act&&!K.mod?'ACTIVATE>':'RTE DATA>','','r'); break; }
    case 'perf': { P.title='PERF INIT'; P.pg='1/2'; const gw=A?A.gw:62000, fuel=A?A.fuel.fob:0;
      l(1,' GW/CRZ CG'); l(2,d.zfw?(gw/1000).toFixed(1)+'/ 22.0%':'□□□.□/ 22.0%'); l(1,'TRIP/CRZ ALT ','','r'); l(2,'---/'+(d.crzFl?'FL'+String(d.crzFl).padStart(3,'0'):'□□□□□'),'','r');
      l(3,' PLAN/FUEL'); l(4,'---/ '+(fuel/1000).toFixed(1)); l(3,'CRZ WIND ','','r'); l(4,'---°/---','','r');
      l(5,' ZFW'); l(6,d.zfw?(d.zfw/1000).toFixed(1):'□□□.□'); l(5,'ISA DEV ','','r'); l(6,'0°C','','r');
      l(7,' RESERVES'); l(8,d.res!=null?d.res.toFixed(1):'□□.□'); l(7,'T/C OAT ','','r'); l(8,(d.crzFl?Math.round(15-d.crzFl*100*0.00198):'---')+'°C','','r');
      l(9,' COST INDEX'); l(10,d.ci!=null?String(d.ci):'□□□□'); l(9,'TRANS ALT ','','r'); l(10,String(d.transAlt||5000),'','r');
      P.dash=true; l(12,'<INDEX'); l(12,'N1 LIMIT>','','r'); break; }
    case 'n1': { P.title='N1 LIMIT'; P.pg='1/1'; const sel=d.n1sel||'TO', n1=K.n1||{};
      l(1,' SEL/OAT'); l(2,'--/+'+(d.oat!=null?d.oat:15)+'°C'); l(1,'26K N1 ','','r'); l(2,(n1.to||96.4).toFixed(1)+'/ '+(n1.to||96.4).toFixed(1),C.g,'r');
      const row=(r,k,t,v)=>{ l(r,(sel===k?'<SEL>':'<ACT>').replace('<ACT>','     ')+' '+t+' '+v.toFixed(1),sel===k?C.g:C.w); };
      l(4,'<'+(sel==='TO'?'SEL>':'    ')+' TO      '+(n1.to||96.4).toFixed(1),sel==='TO'?C.g:C.w); l(6,'<'+(sel==='TO-1'?'SEL>':'    ')+' TO-1    '+(n1.to1||93.1).toFixed(1),sel==='TO-1'?C.g:C.w); l(8,'<'+(sel==='TO-2'?'SEL>':'    ')+' TO-2    '+(n1.to2||89.8).toFixed(1),sel==='TO-2'?C.g:C.w);
      l(4,'CLB>','','r'); l(6,'CLB-1>','','r'); l(8,'CLB-2>','','r'); l(3,'','','');
      P.dash=true; l(12,'<PERF INIT'); l(12,'TAKEOFF>','','r'); break; }
    case 'to': { P.title='TAKEOFF REF'; P.pg='1/2'; const s=vspeeds(K,A);
      l(1,' FLAPS'); l(2,d.toFlaps!=null?String(d.toFlaps).padStart(2,'0')+'°':'□□°');
      l(1,'V1 ','','r'); l(3,'VR ','','r'); l(5,'V2 ','','r');
      for(const [r,k] of [[2,'v1'],[4,'vr'],[6,'v2']]){ if(d[k]!=null) l(r,d[k]+' KT','','r'); else if(d.toFlaps!=null) l(r,s[k]+'>  ',C.w,'r','s'); else l(r,'---','','r'); }
      l(3,' 26K N1'); l(4,((K.n1&&K.n1.to)||96.4).toFixed(1)+'/'+((K.n1&&K.n1.to)||96.4).toFixed(1)+'%',C.w);
      l(5,' CG'); l(6,(d.cg||22.0).toFixed(1)+'%'); l(7,' RW WIND'); l(8,'360°/ 5'); l(7,'TRIM ','','r'); l(8,d.toFlaps!=null?trimFor(K):'-.--','','r');
      l(9,' RW/POS'); l(10,d.rwy?d.rwy+'/----':'-----'); if(d.v1&&d.vr&&d.v2&&d.zfw) l(11,'PRE-FLT COMPLETE',C.w,'c');
      P.dash=true; l(12,'<INDEX'); l(12,'POS INIT>','','r'); break; }
    case 'appr': { P.title='APPROACH REF'; P.pg='1/1'; const v=vrefs(A);
      l(1,' GROSS WT'); l(2,A?(A.gw/1000).toFixed(1):'---.-'); l(1,'FLAPS    VREF ','','r'); v.forEach(([f,s],i)=>l(2+i*2,String(f).padStart(2,'0')+'°   '+s+'KT','','r'));
      l(5,' RW36'); l(6,'9843FT  3000M'); l(7,' ILS1 - MLS'); l(8,d.ilsFreq+d.ilsId+'/'+String(d.ilsCrs).padStart(3,'0')+'°',C.g);
      l(7,'FLAP/SPD ','','r'); l(8,d.vref?String(d.vrefF).padStart(2,'0')+'/'+d.vref:'--/---','','r');
      P.dash=true; l(12,'<INDEX'); l(12,'','','r'); break; }
    case 'clb': { P.title=(M&&M.ap.clbPh&&!M.gnd?'ACT ':'')+'ECON CLB'; P.pg='1/1';
      l(1,' CRZ ALT'); l(2,d.crzFl?'FL'+String(d.crzFl).padStart(3,'0'):'□□□□□'); const vn=M&&M.ap.vn; l(1,(vn?'AT '+vn.id:'')+' ','','r'); l(2,vn?cstTxt({alt:vn.alt,t:vn.t}):'','','r');
      l(3,' ECON SPD'); l(4,'280/.780'); l(5,' SPD REST'); l(6,'250/10000'); l(7,'','',''); l(8,'<MAX RATE'); l(10,'<MAX ANGLE');
      P.dash=true; l(12,'<ECON'); l(12,'ENG OUT>','','r'); break; }
    case 'crz': { P.title='ECON CRZ'; P.pg='1/1';
      l(1,' CRZ ALT'); l(2,d.crzFl?'FL'+String(d.crzFl).padStart(3,'0'):'□□□□□'); l(1,'STEP TO ','','r'); l(2,'NONE','','r');
      l(3,' ECON SPD'); l(4,'.780'); l(3,'AT ','','r'); l(4,'-----','','r'); l(5,' N1'); l(6,'85.2/ 85.2%'); l(5,'FUEL AT ENRD ','','r'); l(6,A?((A.fuel.fob-300)/1000).toFixed(1):'--','','r');
      P.dash=true; l(12,'<ECON'); l(12,'LRC>','','r'); break; }
    case 'des': { P.title=(M&&!M.ap.clbPh&&!M.gnd?'ACT ':'')+'ECON PATH DES'; P.pg='1/1'; const fp=K.fpln; const last=[...fp].reverse().find(p=>p.cst&&!p.rwy);
      l(1,' E/D ALT'); l(2,last?String(last.cst.alt):'-----'); l(1,(last?'AT '+last.id:'')+' ','','r'); l(2,last?(last.cst.spd||'---')+'/'+cstTxt(last.cst):'','','r');
      l(3,' TGT SPD'); l(4,'.780/280'); l(3,'TO T/D ','','r'); l(4,'-----','','r'); l(5,' SPD REST'); l(6,'240/10000'); l(5,'WPT/ALT ','','r'); l(6,'----/-----','','r');
      l(7,'','',''); l(8,'<FORECAST'); l(7,'FPA  V/B  V/S ','','r'); l(8,'3.0  3.0  '+(M?Math.round(M.gs/0.514444*5.3):'---'),'','r');
      P.dash=true; l(12,'<ECON'); l(12,'DES NOW>','','r'); break; }
    case 'prog': { P.title=(d.from||'')+' PROGRESS'; P.pg='1/4'; const fp=K.fpln;
      l(1,' FROM'); l(2,fp[K.act-1]?fp[K.act-1].id:'-----'); l(1,'ALT   ATA  ','','r');
      l(3,'          DTG   ETA','',''); const gs=M?Math.max(120,M.gs/0.514444):250; let dsum=0, prev=M?{N:M.N,E:M.E}:null;
      const now=new Date(), eta=dd=>{ const t=new Date(now.getTime()+dd/gs*3600e3); return String(t.getUTCHours()).padStart(2,'0')+String(t.getUTCMinutes()).padStart(2,'0')+'.'+Math.floor(t.getUTCSeconds()/6)+'z'; };
      const rows=[[K.act,4,C.m],[K.act+1,6,C.w]];
      for(const [k,r,col] of rows){ const p=fp[k]; if(!p||!prev) continue; dsum+=dist(prev,p); prev=p; l(r,pad(p.id,7)+lpad(Math.round(dsum),5)+'  '+eta(dsum),col); }
      if(fp.length&&prev){ let dd=0, pp=M?{N:M.N,E:M.E}:fp[0]; for(let k=K.act;k<fp.length;k++){ dd+=dist(pp,fp[k]); pp=fp[k]; } l(8,pad(d.to||'ENRD',7)+lpad(Math.round(dd),5)+'  '+eta(dd)); l(7,' DEST'); }
      l(9,' TO T/D'); l(10,'-----'); l(9,'FUEL QTY ','','r'); l(10,A?(A.fuel.fob/1000).toFixed(1):'--','','r');
      l(11,'','',''); l(12,'<POS REPORT'); l(12,'POS REF>','','r'); break; }
    case 'navrad': P.title='NAV RADIO'; P.pg='1/1';
      l(1,' VOR L'); l(2,'116.50M'); l(1,'VOR R ','','r'); l(2,'M116.50','','r'); l(3,' CRS'); l(4,'360'); l(3,'CRS ','','r'); l(4,'360','','r');
      l(5,' RADIAL'); l(6,'---'); l(7,' ADF L'); l(8,'385.0'); l(7,'ADF R ','','r'); l(8,'385.0','','r');
      l(9,' ILS - MLS'); l(10,d.ilsFreq+'/'+String(d.ilsCrs).padStart(3,'0')+'°',C.g); P.dash=true; break;
    case 'deparr': P.title='DEP/ARR INDEX'; P.pg='1/1';
      l(1,' ACT RTE 1',C.w,'c'); l(2,'<DEP     '+(d.from||'----')+'     ARR>'); l(4,'                ARR>'); l(4,'  '+(d.to||'----'),'',''); l(9,'DEP      OTHER      ARR',C.w,'c'); l(10,'<----              ---->'); break;
    case 'arr': P.title=(d.to||'ENRD')+' ARRIVALS'; P.pg='1/1';
      l(1,' STARS'); l(1,'APPROACHES ','','r'); l(2,'-NONE-'); l(2,(K.arr==='ILS36'?'<SEL> ':'')+'ILS36','','r'); l(4,'VOR36','','r'); l(3,'','',''); l(5,'','',''); l(6,'','',''); l(5,'RUNWAYS ','','r'); l(6,'RW36','','r');
      P.dash=true; l(12,'<INDEX'); l(12,'ROUTE>','','r'); break;
    case 'hold': P.title='HOLD'; l(2,'HOLD AT',C.w); l(4,'□□□□□'); l(8,'NOT IN THIS VERSION',C.a,'c','s'); break;
    case 'fix': P.title='FIX INFO'; P.pg='1/2'; l(1,' FIX'); l(2,K.fix||'□□□□□'); if(K.fix&&M){ const f=wpt(K,K.fix); if(f){ l(1,'BRG/DIS FR ','','r'); l(2,String(brg(f,{N:M.N,E:M.E})).padStart(3,'0')+'/'+dist(f,{N:M.N,E:M.E}).toFixed(1),'','r'); } } break;
    case 'menu': P.title='MENU'; l(2,'<FMC',C.w); l(1,'','',''); l(4,'<ACARS'); l(6,'<DFDAU'); l(8,'<SAT'); l(12,'<CDU MAINT'); break;
    default: K.page='ident'; return render(K,M,A);
  }
  if(K.exec){ P.title=P.title.replace(/^(ACT |MOD )?/,'MOD '); }
  if(K.msg) P.scratchC=C.w;
  return P;
}

function key(K,k,M,A,api){
  const d=K.d, sp=K.sp; K.changed++;
  const msg=m=>{ K.msg=m; };
  const take=()=>{ const s=K.sp; K.sp=''; return s; };
  if(K.msg&&k!=='CLR'){ K.msg=''; }
  // page keys
  const pages={'INIT REF':null,'RTE':'rte','CLB':'clb','CRZ':'crz','DES':'des','MENU':'menu','LEGS':'legs','DEP ARR':'deparr','HOLD':'hold','PROG':'prog','N1 LIMIT':'n1','FIX':'fix'};
  if(k in pages){ K.sub=0; K.sub2=0; if(k==='INIT REF') K.page=M&&!M.gnd?'appr':(d.v1&&d.zfw?'to':K.irsSet?(d.zfw?'to':'perf'):'ident'); else K.page=pages[k]; return; }
  if(k==='NAV RAD'){ K.page='navrad'; return; }
  if(k==='NEXT PAGE'){ if(K.page==='rte'){ if(K.sub===0) K.sub=1; else K.sub2=(K.sub2||0)+5; } else if(K.page==='legs'){ K.sub++; } else if(K.page==='ident') K.page='ident'; return; }
  if(k==='PREV PAGE'){ if(K.page==='rte'){ if(K.sub2) K.sub2=Math.max(0,K.sub2-5); else K.sub=0; } else K.sub=Math.max(0,K.sub-1); return; }
  if(k==='EXEC'){ if(K.exec){ const f=K.exec; K.exec=null; K.execPage=null; f(); if(api&&api.say) api.say(K.execLabel||'Route active'); } return; }
  if(k==='CLR'){ if(K.msg){ K.msg=''; return; } K.sp=K.sp.slice(0,-1); return; }
  if(k==='DEL'){ if(!K.sp) K.sp='DELETE'; return; }
  if(k==='SP'){ K.sp+=' '; return; }
  if(k==='+/-'){ K.sp+=K.sp.endsWith('-')?'':'-'; return; }
  if(/^[A-Z0-9./]$/.test(k)){ if(K.sp==='DELETE') K.sp=''; if(K.sp.length<22) K.sp+=k; return; }
  const m=/^([LR])([1-6])$/.exec(k); if(!m) return; const side=m[1], n=+m[2];
  const inv=()=>msg('INVALID ENTRY'), fp=()=>{ if(!K.mod){ K.mod=K.fpln.map(p=>Object.assign({},p,{cst:p.cst?Object.assign({},p.cst):undefined})); K.modAct=K.act; } return K.mod; };
  const commit=()=>{ if(!K.active){ K.fpln=K.mod; K.act=K.modAct; K.mod=null; return; } pend(K,'Route modification active',()=>{ K.fpln=K.mod; K.act=K.modAct; K.mod=null; K.changed++; }); };
  switch(K.page){
    case 'ident': if(k==='L6') K.page='index'; if(k==='R6') K.page='pos'; break;
    case 'index': { const g={L1:'ident',L2:'pos',L3:'perf',L4:'to',L5:'appr'}[k]; if(g){ K.page=g; K.sub=0; } break; }
    case 'pos':
      if(k==='L2'){ const s=take(); if(s==='ENRD') d.refApt=s; else if(s) { K.sp=s; msg('NOT IN DATA BASE'); } }
      else if(k==='R1'){ K.sp='N59°10.6E010°15.3'; }
      else if(k==='R4'){ if(K.sp.startsWith('N59')){ K.sp=''; K.irsSet=true; if(api&&api.say) api.say('IRS position set'); } else if(K.sp) inv(); }
      else if(k==='L6') K.page='index'; else if(k==='R6'){ K.page='rte'; K.sub=0; }
      break;
    case 'rte':
      if(K.sub===0){
        if(k==='L1'){ const s=take(); if(s==='ENRD'){ d.from=s; if(!K.fpln.length){ K.fpln=[{id:'ENRD36',N:0,E:0,rwy:true}]; K.act=1; } } else if(s){ K.sp=s; msg('NOT IN DATA BASE'); } }
        else if(k==='R1'){ const s=take(); if(s==='ENRD') d.to=s; else if(s){ K.sp=s; msg('NOT IN DATA BASE'); } }
        else if(k==='L2'){ const s=take(); if(s==='RW36'||s==='36'){ d.rwy='RW36'; } else if(s){ K.sp=s; inv(); } }
        else if(k==='R2'){ const s=take(); if(s&&s.length<=8) d.fltNbr=s; }
        else if(k==='L6'){ K.sub=1; }
        else if(k==='R6'){ if(!K.active){ if(!d.from||!d.to||K.fpln.length<2&&!K.mod){ msg('ROUTE INCOMPLETE'); break; } if(K.mod){ K.fpln=K.mod; K.act=K.modAct; K.mod=null; } pend(K,'Route 1 active',()=>{ K.active=true; K.act=Math.max(1,K.act); K.changed++; }); } else K.page='perf'; }
      } else {
        const ids=plan(K).filter(p=>!p.rwy), st=K.sub2||0;
        if(side==='R'&&n<=5){ const s=take(); if(!s) break; const idx=st+n-1;
          if(s==='DELETE'){ const p=ids[idx]; if(!p) break; const L=fp(); const j=L.indexOf(L.find(x=>x.id===p.id)); if(j>0){ L.splice(j,1); if(K.modAct>j) K.modAct--; } commit(); break; }
          const w=wpt(K,s); if(!w){ K.sp=s; msg('NOT IN DATA BASE'); break; }
          const L=fp(); const before=ids[idx]; let j=before?L.findIndex(x=>x.id===before.id):L.length; if(L.length&&L[L.length-1].id==='RW36'&&!before) j=L.length-1; L.splice(j,0,w); commit(); }
        else if(k==='L6'){ if(K.mod){ K.mod=null; K.exec=null; } else K.sub=0; }
        else if(k==='R6'){ if(!K.active) { if(K.mod){ K.fpln=K.mod; K.act=K.modAct; K.mod=null; } pend(K,'Route 1 active',()=>{ K.active=true; K.act=Math.max(1,K.act); K.changed++; }); } else K.page='perf'; }
      }
      break;
    case 'legs': {
      const L0=plan(K), first=Math.max(1,K.mod?K.modAct:K.act), k0=first+K.sub*5+n-1;
      if(k==='L6'){ if(K.mod){ K.mod=null; K.exec=null; } break; }
      if(k==='R6'){ if(!K.active) pend(K,'Route 1 active',()=>{ K.active=true; K.changed++; }); break; }
      if(side==='L'){ const s=K.sp;
        if(!s){ if(L0[k0]) K.sp=L0[k0].id; break; }
        if(s==='DELETE'){ take(); const L=fp(); if(k0<L.length&&!L[k0].rwy){ L.splice(k0,1); if(K.modAct>k0) K.modAct--; commit(); } break; }
        take(); const L=fp(); const j=L.findIndex((p,i)=>i>=K.modAct&&p.id===s);
        if(j>=0){ // a downpath waypoint: everything before it goes (on line 1: direct to it)
          if(j>k0){ L.splice(k0,j-k0); } if(n===1&&K.sub===0){ K.dirTo=true; } commit(); break; }
        const w=wpt(K,s); if(!w){ K.sp=s; msg('NOT IN DATA BASE'); K.mod=K.exec?K.mod:null; break; }
        L.splice(Math.min(k0,L.length),0,w); if(n===1&&K.sub===0) K.dirTo=true; commit(); }
      else { const s=take(); if(!s){ break; } const L=fp(); const p=L[k0]; if(!p){ inv(); break; }
        if(s==='DELETE'){ p.cst=undefined; commit(); break; } const c=parseCst(s); if(c===undefined||!c){ K.sp=s; inv(); K.mod=K.exec?K.mod:null; break; } p.cst=c.alt!=null?{alt:c.alt,t:c.t,spd:c.spd}:p.cst; commit(); }
      break; }
    case 'perf':
      if(k==='L3'){ const s=take(); const v=parseFloat(s); if(v>35&&v<70){ d.zfw=Math.round(v*1000); if(api&&api.weights) api.weights({zfw:d.zfw}); } else if(s){ K.sp=s; inv(); } }
      else if(k==='L4'){ const s=take(); const v=parseFloat(s); if(v>=0&&v<20) d.res=v; else if(s){ K.sp=s; inv(); } }
      else if(k==='L5'){ const s=take(); const v=parseInt(s,10); if(v>=0&&v<=500) d.ci=v; else if(s){ K.sp=s; inv(); } }
      else if(k==='R1'){ const s=take(); let v=s.startsWith('FL')?+s.slice(2):+s; if(v>500) v=v/100; if(v>=10&&v<=410) d.crzFl=Math.round(v); else if(s){ K.sp=s; inv(); } }
      else if(k==='R5'){ const s=take(); const v=+s; if(v>=1000&&v<=18000) d.transAlt=v; else if(s){ K.sp=s; inv(); } }
      else if(k==='L6') K.page='index'; else if(k==='R6') K.page='n1';
      break;
    case 'n1': { const sel={L2:'TO',L3:'TO-1',L4:'TO-2'}[k]; if(sel){ d.n1sel=sel; if(api&&api.n1sel) api.n1sel(sel); } if(k==='L6') K.page='perf'; if(k==='R6') K.page='to'; break; }
    case 'to': {
      if(k==='L1'){ const s=take(); const v=+s; if([1,5,10,15,25].includes(v)){ d.toFlaps=v; d.v1=d.vr=d.v2=null; } else if(s){ K.sp=s; inv(); } }
      else if(['R1','R2','R3'].includes(k)){ const key_={R1:'v1',R2:'vr',R3:'v2'}[k]; const s=take(); const fmc=vspeeds(K,A);
        if(!s){ if(d.toFlaps==null){ msg('FLAPS ENTRY REQUIRED'); break; } d[key_]=fmc[key_]; }
        else if(s==='DELETE') d[key_]=null; else { const v=+s; if(v>=100&&v<=200) d[key_]=v; else { K.sp=s; inv(); break; } }
        if(api&&api.perf) api.perf({v1:d.v1,vr:d.vr,v2:d.v2,thrRed:d.thrRed||1500,acc:d.acc||1500,flex:0,trim:d.toFlaps!=null?+trimFor(K):null}); }
      else if(k==='L3'){ const s=take(); const v=+s; if(v>=5&&v<=35) d.cg=v; else if(s){ K.sp=s; inv(); } }
      else if(k==='L6') K.page='index'; else if(k==='R6') K.page='pos';
      break; }
    case 'appr': {
      const v=vrefs(A);
      if(['R1','R2','R3'].includes(k)&&!K.sp){ const [f,s]=v[n-1]; K.sp=f+'/'+s; }
      else if(k==='R4'){ const s=take(); const mm=/^(\d{2})\/(\d{3})$/.exec(s); if(mm&&[15,30,40].includes(+mm[1])){ d.vrefF=+mm[1]; d.vref=+mm[2]; if(api&&api.vref) api.vref(d.vref,d.vrefF); } else if(s==='DELETE'){ d.vref=null; } else if(s){ K.sp=s; inv(); } }
      else if(k==='L6') K.page='index';
      break; }
    case 'deparr': if(k==='R1'||k==='R2'){ K.page='arr'; } break;
    case 'arr': if(k==='R1'){ K.arr='ILS36'; if(api&&api.say) api.say('ILS 36 selected'); } if(k==='L6') K.page='index'; if(k==='R6'){ K.page='rte'; K.sub=0; } break;
    case 'fix': if(k==='L1'){ const s=take(); if(wpt(K,s)) K.fix=s; else if(s){ K.sp=s; msg('NOT IN DATA BASE'); } } break;
    case 'menu': if(k==='L1') K.page=M&&!M.gnd?'legs':'ident'; break;
    case 'clb': case 'crz': case 'des':
      if(k==='L1'){ const s=take(); let v=s.startsWith('FL')?+s.slice(2):+s; if(v>500) v=v/100; if(v>=10&&v<=410) d.crzFl=Math.round(v); else if(s){ K.sp=s; inv(); } }
      break;
  }
}
G.B737CDU={render,key,vspeeds,vrefs,trimFor,cstTxt};
})(typeof window!=='undefined'?window:globalThis);
