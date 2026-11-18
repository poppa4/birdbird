/* NORDAP – Boeing 737 FMC (CDU) trainer.
   A generic, simplified 737 FMC for learning the CDU: preflight from IDENT to TAKEOFF REF, RTE with ACTIVATE and EXEC,
   DEP/ARR, LEGS with MOD/EXEC, direct to and intercept course, discontinuities, constraints, HOLD, N1 LIMIT and APPROACH REF.
   Navigation data is fictional (training area around Nordvik, Skarhamn and Fjellby). Not for navigation.
   Coordinates are in NM on a flat plane (x east, y north); tracks are true = magnetic in the training area. */
(function(){
'use strict';
const LB=()=>window.LAB, Lx=o=>LB()?LB().L(o):o.en, isNo=()=>LB()&&LB().lang==='no';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const R2=Math.PI/180;
const w360=a=>{ a=Math.round(a)%360; return a<=0?a+360:a; };
const p3=n=>String(Math.round(n)).padStart(3,'0');

/* =========================================================== database */
const P={};
function pt(id,x,y,t,o){ P[id]=Object.assign({id,x,y,t},o||{}); return P[id]; }
const along=(p,brg,d)=>({x:p.x+d*Math.sin(brg*R2),y:p.y+d*Math.cos(brg*R2)});
function ptA(id,p,brg,d,t,o){ const q=along(p,brg,d); return pt(id,q.x,q.y,t||'WPT',o); }
const dist=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const brg=(a,b)=>w360(Math.atan2(b.x-a.x,b.y-a.y)/R2);

pt('XNDV',0,0,'APT',{name:'NORDVIK',elev:56});
pt('XSKH',180,140,'APT',{name:'SKARHAMN',elev:180});
pt('XFJB',215,90,'APT',{name:'FJELLBY',elev:410});
const AP={
  XNDV:{ta:7000,rwy:{'01':{crs:10,len:3000,ils:null},'19':{crs:190,len:3000,ils:'INV'}},sid:{},star:{},app:{}},
  XSKH:{ta:5000,rwy:{'07':{crs:70,len:2500,ils:'ISO'},'25':{crs:250,len:2500,ils:'ISK'}},sid:{},star:{},app:{}},
  XFJB:{ta:5000,rwy:{'16':{crs:160,len:2200,ils:null},'34':{crs:340,len:2200,ils:'IFJ'}},sid:{},star:{},app:{}}
};
/* runway thresholds */
for(const a in AP){ for(const r in AP[a].rwy){ const R=AP[a].rwy[r]; const half=R.len/1852/2; const th=along(P[a],R.crs+180,half); pt('RW'+r+'@'+a,th.x,th.y,'RWY',{apt:a,rwy:r}); R.th=P['RW'+r+'@'+a]; } }
const thr=(a,r)=>AP[a].rwy[r].th;

/* navaids */
pt('NDV',1.2,-0.4,'VOR',{f:'114.30',name:'NORDVIK'});
pt('HVL',90,72,'VOR',{f:'115.20',name:'HVALOY'});
pt('GRV',118,36,'VOR',{f:'113.90',name:'GRAVA'});
pt('SKH',181,141.6,'VOR',{f:'112.70',name:'SKARHAMN'});
pt('FJB',215.6,90.7,'VOR',{f:'116.90',name:'FJELLBY'});
pt('NV',0.4,-9,'NDB',{f:'375',name:'NORDVIK'});
pt('SK',190,143.5,'NDB',{f:'402',name:'SKARHAMN'});
const ILS={INV:{f:'109.50',crs:190,apt:'XNDV',rwy:'19'},ISK:{f:'110.30',crs:250,apt:'XSKH',rwy:'25'},ISO:{f:'109.70',crs:70,apt:'XSKH',rwy:'07'},IFJ:{f:'108.90',crs:340,apt:'XFJB',rwy:'34'}};

/* waypoints */
ptA('NV190',thr('XNDV','19'),190,6); ptA('NV010',thr('XNDV','01'),10,6);
pt('TOSOK',16,-8,'WPT'); pt('ROKUS',40,20,'WPT'); pt('KRAKE',-14,10,'WPT'); pt('TINDA',10,46,'WPT');
pt('GAPOT',68,48,'WPT'); pt('KAVLO',52,62,'WPT'); pt('SELKA',124,98,'WPT'); pt('ODRUP',150,118,'WPT'); pt('BREMO',204,178,'WPT'); pt('TOLKA',166,152,'WPT'); pt('VIKSA',140,60,'WPT');
ptA('FI25',thr('XSKH','25'),70,6); ptA('SK255',thr('XSKH','25'),70,12); pt('SK260',198,156,'WPT');
ptA('FI07',thr('XSKH','07'),250,6); ptA('SK075',thr('XSKH','07'),250,12); pt('SK070',158,128,'WPT');
ptA('FF25',thr('XSKH','25'),70,6.2); ptA('FF07',thr('XSKH','07'),250,6.2);
ptA('FI34',thr('XFJB','34'),160,6); ptA('FJ340',thr('XFJB','34'),160,12);

const AWY={M611:['ROKUS','GAPOT','HVL'],L44:['KAVLO','HVL','SELKA','ODRUP'],T55:['TINDA','KAVLO'],N12:['HVL','GRV','VIKSA','FJB'],Z8:['ODRUP','TOLKA','BREMO']};

const S_=AP.XNDV.sid;
S_.ROKUS1A={rwy:'19',legs:[['NV190','+3000'],['TOSOK',''],['ROKUS','+5000']]};
S_.ROKUS1B={rwy:'01',legs:[['NV010','+3000'],['ROKUS','+5000']]};
S_.TINDA1A={rwy:'19',legs:[['NV190','+3000'],['KRAKE',''],['TINDA','+5000']]};
S_.TINDA1B={rwy:'01',legs:[['NV010','+3000'],['TINDA','+5000']]};
const T_=AP.XSKH.star;
T_.ODRUP2W={rwys:['25'],legs:[['ODRUP','FL110'],['TOLKA','+FL070'],['SK260','5000']]};
T_.ODRUP2E={rwys:['07'],legs:[['ODRUP','FL110'],['SK070','5000']]};
T_.BREMO1W={rwys:['25'],legs:[['BREMO','FL110'],['SK260','5000']]};
T_.BREMO1E={rwys:['07'],legs:[['BREMO','FL110'],['TOLKA','+FL070'],['SK070','5000']]};
const A_=AP.XSKH.app;
A_.ILS25={rwy:'25',ils:'ISK',vias:{SK260:[['SK260','5000']]},legs:[['SK255','3800'],['FI25','2200']],miss:[['SKH','3000']]};
A_.RNP25={rwy:'25',ils:null,vias:{SK260:[['SK260','5000']]},legs:[['SK255','3800'],['FF25','2200']],miss:[['SKH','3000']]};
A_.ILS07={rwy:'07',ils:'ISO',vias:{SK070:[['SK070','5000']]},legs:[['SK075','3800'],['FI07','2200']],miss:[['SKH','3000']]};
A_.RNP07={rwy:'07',ils:null,vias:{SK070:[['SK070','5000']]},legs:[['SK075','3800'],['FF07','2200']],miss:[['SKH','3000']]};
AP.XFJB.app.ILS34={rwy:'34',ils:'IFJ',vias:{},legs:[['FJ340','4000'],['FI34','2400']],miss:[['FJB','4000']]};
AP.XNDV.app.ILS19={rwy:'19',ils:'INV',vias:{},legs:[],miss:[]};
/* database holds */
const DBH={SKH:{crs:250,turn:'L',time:1.0},ODRUP:{crs:52,turn:'R',time:1.0},FJB:{crs:340,turn:'R',time:1.0},HVL:{crs:52,turn:'R',time:1.0}};
/* company route */
const CORTE={NDVSKH01:{from:'XNDV',to:'XSKH',altn:'XFJB',route:[['ROKUS',''],['GAPOT','M611'],['HVL','M611'],['SELKA','L44'],['ODRUP','L44']]}};

/* AIRAC cycle from today (2601 starts 22 JAN 2026, 28-day cycles) */
const MON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function airac(){
  const e=Date.UTC(2026,0,22), now=Date.now(), n=Math.floor((now-e)/(28*864e5));
  const st=new Date(e+n*28*864e5), en=new Date(e+(n+1)*28*864e5-864e5);
  const f=d=>String(d.getUTCDate()).padStart(2,'0')+MON[d.getUTCMonth()];
  let yr=st.getUTCFullYear(), first=Date.UTC(yr,0,1), k=0; for(let t=e;t<=st.getTime();t+=28*864e5){ const d=new Date(t); if(d.getUTCFullYear()===yr) k++; }
  return {act:f(st)+'-'+f(en), sec:f(new Date(en.getTime()+864e5))+'-'+f(new Date(en.getTime()+28*864e5)), id:'NP'+String(yr%100)+String(k).padStart(2,'0')};
}

/* =========================================================== flight plan */
const clone=o=>JSON.parse(JSON.stringify(o));
const W=(id,o)=>Object.assign({k:'wpt',id},o||{});
const isW=it=>it&&(it.k==='wpt');
function coord(it){ if(!it) return null; if(it.k==='apt'){ return it.rwy&&AP[it.id].rwy[it.rwy]?thr(it.id,it.rwy):P[it.id]; } if(it.k==='dest'){ return it.rwy&&AP[it.id]&&AP[it.id].rwy[it.rwy]?thr(it.id,it.rwy):P[it.id]; } if(it.k==='wpt') return it.pos||P[it.id]; return null; }
function newPlan(from,to){ return {from:from||null,to:to||null,items:from?[{k:'apt',id:from,seg:'o'},{k:'disc',seg:'enr'},{k:'dest',id:to,seg:'d'}]:[],dRwy:null,sid:null,trans:null,aRwy:null,appr:null,star:null,via:null,miss:[]}; }
function join(a,b){
  if(!b.length) return a.slice();
  if(!a.length){ const bb=b[0].k==='disc'?b:[{k:'disc',seg:b[0].seg}].concat(b); return bb; }
  const last=a[a.length-1];
  if(isW(last)){ const i=b.findIndex(x=>isW(x)&&x.id===last.id); if(i>=0&&b.slice(0,i).every(x=>x.k!=='dest')) return a.concat(b.slice(i+1)); }
  const first=b.find(x=>isW(x)); if(first&&b[0]===first){ const ai=a.map(x=>isW(x)?x.id:'').lastIndexOf(first.id); if(ai>=0) return a.slice(0,ai+1).concat(b.slice(1)); }
  if(last.k==='disc') return a.concat(b[0].k==='disc'?b.slice(1):b);
  return a.concat(b[0].k==='disc'?b:[{k:'disc',seg:b[0].seg}].concat(b));
}
const legsOf=(arr,seg,via)=>arr.map(l=>W(l[0],{seg,via,alt:l[1]||''}));
function setDeparture(p,rwy,sid,trans){
  const o=p.items[0]; if(!o||o.k!=='apt') return;
  let rest=p.items.slice(1).filter(it=>it.seg!=='sid'); while(rest[0]&&rest[0].k==='disc') rest.shift();
  const legs=sid?legsOf(AP[o.id].sid[sid].legs,'sid',sid):[];
  p.dRwy=rwy; p.sid=sid||null; p.trans=trans||null;
  p.items=[Object.assign({},o,{rwy})].concat(legs.length?join(legs,rest):join([],rest));
  tidy(p);
}
function setArrival(p,appr,star,via){
  const d=p.items.find(x=>x.k==='dest'); if(!d) return;
  let head=p.items.filter(it=>!['star','via','app'].includes(it.seg)&&it.k!=='dest');
  while(head.length>1&&head[head.length-1].k==='disc') head.pop();
  const A=AP[d.id];
  const sl=star&&A.star[star]?legsOf(A.star[star].legs,'star',star):[];
  const ap=appr&&A.app[appr]?A.app[appr]:null;
  const vl=ap&&via&&ap.vias[via]?legsOf(ap.vias[via],'via',appr):[];
  const al=ap?legsOf(ap.legs,'app',appr):[];
  let tail=sl;
  if(vl.length||al.length) tail=tail.length?join(tail,vl.concat(al)):[{k:'disc',seg:'app'}].concat(vl,al);
  let items=tail.length?join(head,tail):head.concat([{k:'disc',seg:'enr'}]);
  if(!ap) { if(items[items.length-1].k!=='disc') items.push({k:'disc',seg:'app'}); }
  items.push(Object.assign({},d,{rwy:ap?ap.rwy:null}));
  p.items=items; p.appr=appr||null; p.star=star||null; p.via=via||null; p.aRwy=ap?ap.rwy:null;
  p.miss=ap?legsOf(ap.miss,'miss','MISSED'):[];
  tidy(p);
}
function tidy(p){ const out=[]; for(const it of p.items){ const l=out[out.length-1]; if(it.k==='disc'&&l&&l.k==='disc') continue; out.push(it); } p.items=out; }
function addAirways(p,fromIdx,rows){
  /* rows: [{via,to}] complete ones. Returns error string or null */
  let cur=p.items[fromIdx]; if(!isW(cur)) return 'NOT ALLOWED';
  let at=cur.id, legs=[];
  for(const r of rows){
    if(r.via==='DCT'){ if(!P[r.to]) return 'NOT IN DATA BASE'; legs.push(W(r.to,{seg:'enr',via:'DCT'})); at=r.to; continue; }
    const A=AWY[r.via]; if(!A) return 'NOT IN DATA BASE';
    const i=A.indexOf(at), j=A.indexOf(r.to); if(i<0||j<0||i===j) return 'AWY/WPT MISMATCH';
    const seq=i<j?A.slice(i+1,j+1):A.slice(j,i).reverse();
    for(const id of seq) legs.push(W(id,{seg:'enr',via:r.via})); at=r.to;
  }
  const before=p.items.slice(0,fromIdx+1), after=p.items.slice(fromIdx+1);
  p.items=join(before.concat(legs),after); tidy(p); return null;
}
function insertAt(p,idx,id){
  /* new waypoint becomes the item at idx; if it exists downstream the items between are removed */
  const down=p.items.findIndex((x,i)=>i>=idx&&isW(x)&&x.id===id&&x.seg!=='miss');
  const seg=(p.items[idx]&&p.items[idx].seg&&p.items[idx].seg!=='d')?p.items[idx].seg:'enr';
  if(down>=0){ p.items.splice(idx,down-idx); }
  else { p.items.splice(idx,0,W(id,{seg,via:''}),{k:'disc',seg}); }
  tidy(p);
}
function routeDist(p){ let d=0, prev=null; for(const it of p.items){ const c=coord(it); if(it.k==='disc'){ prev=null; continue; } if(c){ if(prev) d+=dist(prev,c); prev=c; } } return d; }
function totalDist(p){ /* along the route, bridging discontinuities directly */ let d=0, prev=null; for(const it of p.items){ const c=coord(it); if(c){ if(prev) d+=dist(prev,c); prev=c; } } return d; }
const destOf=p=>p.items.find(x=>x.k==='dest');

/* =========================================================== state */
let S=null;
function blank(){
  return {phase:'PRE',ap:'NAV',hdg:360,trk:360,run:false,hz:null,pos:{x:0,y:0},alt:0,utc:14*60+32,
    act:newPlan(),tmpy:null,rte:'none',
    init:{flt:'',ci:null,crz:null,altn:null,co:''},
    fb:{zfw:null,block:7.8,taxi:0.2},
    b:{ref:null,gate:null,irs:false,res:null,ccg:25.0,wind:null,oat:null,tocg:null,app:null},
    n1:{sel:null,oat:15,rating:'TO',clb:'CLB'},
    perf:{v1:null,vr:null,v2:null,ta:null,flaps:null},
    page:'ident',lastFm:'ident',rpg:1,lpg:1,hpg:0,vpg:null,rteVia:null,holdAt:false,perfPend:false,exitReq:false,exitArm:false,efc:null,fixId:null,
    sp:'',msg:null,seen:{},log:[]};
}
const altnOf=()=>S.act.altn||S.init.altn;
function msg(t){ S.msg={t}; }
function take(){ const s=S.sp; S.sp=''; return s; }
function planFor(view){ return S.tmpy&&S.tmpy.tgt===view?S.tmpy.plan:S[view]; }
const flyingPlan=()=>S.phase!=='PRE';

/* =========================================================== fuel model (teaching numbers, tonnes) */
function fuel(){
  const f=S.fb, p=S.act; if(!p.from) return null;
  if(S.phase!=='PRE'&&S.fob!=null){
    const rem=remainDist(p), trip=+(0.2+0.0058*rem).toFixed(1), time=Math.round(rem/7.2);
    const al=altnOf(); const dd=destOf(p); const ad=al&&dd&&P[al]&&P[dd.id]?dist(P[dd.id],P[al])*1.15:0;
    const altn=al&&dd&&dd.id!==al?+(0.45+0.0065*ad).toFixed(1):0, atime=altn?Math.round(8+ad/6):0, fin=1.1, mdf=+(altn+fin).toFixed(1);
    const efob=+(S.fob-trip).toFixed(1), r={trip,time,altn,atime,fin,rsv:0,dist:rem,mdf,efob,extra:+(efob-mdf).toFixed(1),fob:+S.fob.toFixed(1)};
    if(f.zfw!=null){ r.gw=+(f.zfw+S.fob).toFixed(1); r.lw=+(f.zfw+efob).toFixed(1); }
    return r;
  }
  const d=totalDist(p); if(!(d>0)) return null;
  const trip=+(0.55+0.0058*d).toFixed(1), time=Math.round(14+d/7.2);
  const al=altnOf(); const ad=al&&P[al]&&P[p.to]?dist(P[p.to],P[al])*1.15:0;
  const altn=al?+(0.45+0.0065*ad).toFixed(1):0, atime=al?Math.round(8+ad/6):0;
  const fin=1.1, rsv=+(trip*0.05).toFixed(1);
  const r={trip,time,altn,atime,fin,rsv,dist:d,mdf:+(altn+fin).toFixed(1)};
  if(f.block!=null){ r.extra=+(f.block-f.taxi-trip-rsv-altn-fin).toFixed(1); r.efob=+(f.block-f.taxi-trip).toFixed(1); }
  if(f.zfw!=null&&f.block!=null){ r.tow=+(f.zfw+f.block-f.taxi).toFixed(1); r.lw=+(r.tow-trip).toFixed(1); }
  r.pred=f.zfw!=null&&f.block!=null&&!!S.init.crz;
  return r;
}
const hhmm=m=>{ m=Math.max(0,Math.round(m)); return String(Math.floor(m/60)%24).padStart(2,'0')+String(m%60).padStart(2,'0'); };

/* =========================================================== screen */
const ROWS=14, COLS=24;
let scr;
function cls(){ scr=Array.from({length:ROWS},()=>Array.from({length:COLS},()=>({c:' ',k:'w',s:0}))); }
function put(r,c,t,k,s){ t=String(t); for(let i=0;i<t.length;i++){ const x=c+i; if(x>=0&&x<COLS) scr[r][x]={c:t[i],k:k||'w',s:s?1:0}; } }
const putR=(r,t,k,s,pad)=>put(r,COLS-String(t).length-(pad||0),t,k,s);
const putC=(r,t,k,s)=>put(r,Math.floor((COLS-String(t).length)/2),t,k,s);
const LR=n=>2*n-1, DR=n=>2*n;   /* label row and data row of line n (1..6) */
const box=n=>'§'.repeat(n);
function title(t,k){ putC(0,t,k||'w',0); }
function prompt(n,side,t,k){ if(side==='L') put(DR(n),0,t,k||'w'); else putR(DR(n),t,k||'w'); }
function lbl(n,side,t){ if(side==='L') put(LR(n),0,t,'w',1); else if(side==='R') putR(LR(n),t,'w',1); else putC(LR(n),t,'w',1); }
function html(){
  let h='';
  for(let r=0;r<ROWS;r++){
    h+='<div class="mr">';
    for(let c=0;c<COLS;c++){ const x=scr[r][c]; if(x.c==='§'){ h+='<i class="bx"></i>'; continue; } h+='<i class="'+x.k+(x.s?' s':'')+'">'+(x.c===' '?'&nbsp;':esc(x.c))+'</i>'; }
    h+='</div>';
  }
  return h;
}

/* =========================================================== parsing */
const num=(s,lo,hi,dec)=>{ if(!/^[-+]?\d+(\.\d+)?$/.test(s)) return null; const v=parseFloat(s); if(v<lo||v>hi) return NaN; if(!dec&&v!==Math.round(v)) return null; return v; };
function ckNum(s,lo,hi,dec){ const v=num(s,lo,hi,dec); if(v===null){ msg('FORMAT ERROR'); return null; } if(Number.isNaN(v)){ msg('ENTRY OUT OF RANGE'); return null; } return v; }
function parseFL(s){ s=s.replace(/^FL/,''); if(!/^\d{2,3}$/.test(s)) return null; const v=+s; if(v<10||v>398) return NaN; return v; }

/* =========================================================== pages (Boeing 737 FMC / CDU) */
const PG={};
function go(page,o){ S.page=page; S.seen[page]=1; if(o) Object.assign(S,o); }
const llOf=q=>{ const lat=60+q.y/60, lon=10+q.x/30; const dm=(v,h,w)=>{ const d=Math.floor(Math.abs(v)), m=(Math.abs(v)-d)*60; return h+String(d).padStart(w,'0')+'°'+m.toFixed(1).padStart(4,'0'); }; return dm(lat,'N',2)+' '+dm(lon,'E',3); };
function remainDist(p){ let d=0, prev=S.pos; p.items.forEach((it,i)=>{ if(i===0) return; const c=coord(it); if(c){ if(prev) d+=dist(prev,c); prev=c; } }); return d; }
const rteAct=()=>S.rte==='act';
/* changes to an active route become a MOD (shown in the title, EXEC lights); before activation they go straight in */
function modPlan(){ if(!rteAct()) return S.act; if(!S.tmpy) S.tmpy={tgt:'act',plan:clone(S.act)}; return S.tmpy.plan; }
const cur=()=>S.tmpy?S.tmpy.plan:S.act;
const isMod=()=>!!S.tmpy;
const execLit=()=>!!S.tmpy||S.rte==='pend'||S.perfPend||S.exitReq;
function exec(){
  if(S.tmpy){ const old=S.act; S.act=S.tmpy.plan; S.tmpy=null; afterActChange(old); return; }
  if(S.exitReq){ S.exitReq=false; S.exitArm=true; return; }
  if(S.rte==='pend'){ S.rte='act'; return; }
  if(S.perfPend){ S.perfPend=false; return; }
}
function afterActChange(old){
  const P_=S.perf;
  if(S.phase==='PRE'&&old&&old.dRwy!==S.act.dRwy) delV();
  if(S.phase!=='PRE'){ const h=S.act.items[1]; if(!(h&&h.k==='hold')) S.hz=null; }
}
function vprof(){
  const p=S.act, fl=flyingPlan(), F=fuel(), d0=destOf(p);
  if(!S.init.crz||!d0||!p.items.length) return null;
  if(!fl&&!(F&&F.pred)) return null;
  const crz=S.init.crz*100, eD=P[d0.id]?P[d0.id].elev:0, eO=p.from&&P[p.from]?P[p.from].elev:0;
  const cum=[]; let prev=fl?S.pos:null, c=0;
  p.items.forEach((it,i)=>{ const q=coord(it); if(fl&&i===0){ cum[i]=0; return; } if(q&&prev) c+=dist(prev,q); if(q) prev=q; cum[i]=c; });
  const total=cum[p.items.indexOf(d0)]||c;
  const top=fl?(S.phase==='CRZ'?crz:Math.min(crz,S.alt)):crz;
  const alt=d=>Math.max(0,Math.min(top,fl?Infinity:eO+270*d,eD+318*(total-d)));
  const tc=fl?-1:(crz-eO)/270, td=total-(top-eD)/318;
  const ps=[]; if(!fl&&tc<td) ps.push({n:'(T/C)',d:tc}); if(td>0&&tc<td) ps.push({n:'(T/D)',d:td});
  const ai=p.items.findIndex(x=>x.seg==='app'&&isW(x)); if(ai>0&&cum[ai]!=null) ps.push({n:'(DECEL)',d:Math.max(0,cum[ai]-0.01),decel:1});
  ps.sort((a,b)=>a.d-b.d);
  const ta=d=>(!fl&&d<tc)?(S.perf.ta||7000):(AP[d0.id]?AP[d0.id].ta:5000);
  const fa=d=>{ const a=alt(d); return a<ta(d)?String(Math.round(a/10)*10):'FL'+p3(Math.round(a/100)); };
  const sp=d=>{ const a=alt(d); if(!fl&&d<tc) return a<10000?'250':(a<27000?'280':'.780'); if(d>=td) return a<10000?'250':(a<27000?'280':'.780'); return '.780'; };
  return {cum,total,ps,fa,sp,alt,fl};
}
function delV(){ const P_=S.perf; if(P_.v1!=null||P_.vr!=null||P_.v2!=null){ P_.v1=P_.vr=P_.v2=null; msg('TAKEOFF SPEEDS DELETED'); } }
const gw=()=>S.fb.zfw!=null&&S.fb.block!=null?+(S.fb.zfw+S.fb.block).toFixed(1):null;
function toSpeeds(){ const g=gw(), f=S.perf.flaps; if(g==null||f==null||S.b.tocg==null) return null; const adj={1:0,5:5,10:7,15:9,25:12}[f]||5; const v2=Math.round(118+(g-50)*1.9-adj); return {v1:v2-7,vr:v2-4,v2}; }
const trimOf=cg=>(7.5-cg*0.12).toFixed(2);
const n1Of=()=>{ const sel=S.n1.sel, base={TO:95.8,'TO-1':93.1,'TO-2':90.4}[S.n1.rating]; return (sel!=null?base-Math.max(0,(sel-S.n1.oat)*0.21):base).toFixed(1); };
function vrefs(){ const F=fuel(); const lw=F&&F.lw!=null?F.lw:(gw()!=null?gw()-1.9:60); const v30=Math.round(97+lw*0.73); return {lw,v15:v30+7,v30,v40:v30-4}; }

/* ---------- MENU ---------- */
PG.menu={draw(){ title('MENU'); prompt(1,'L','<FMC','w'); putR(DR(1),'<ACT>','g',1); prompt(2,'L','<ACARS'); prompt(3,'L','<DFDAU'); prompt(6,'L','<MAINT'); },
  lsk(s,n){ if(s==='L'&&n===1){ go(S.lastFm||'ident'); return; } if(s==='L'){ msg('INVALID ENTRY'); } }};

/* ---------- INIT/REF INDEX ---------- */
PG.index={draw(){ title('INIT/REF INDEX'); prompt(1,'L','<IDENT'); prompt(2,'L','<POS'); prompt(3,'L','<PERF'); prompt(4,'L','<TAKEOFF'); prompt(5,'L','<APPROACH'); prompt(6,'L','<OFFSET'); prompt(1,'R','NAV DATA>'); prompt(6,'R','MAINT>'); },
  lsk(s,n){ if(S.sp){ msg('INVALID ENTRY'); return; } const m={L1:'ident',L2:'posinit',L3:'perfinit',L4:'takeoff',L5:'appref'}[s+n]; if(m){ go(m); return; } msg('INVALID ENTRY'); }};

/* ---------- IDENT ---------- */
PG.ident={draw(){ const a=airac(); title('IDENT'); lbl(1,'L',' MODEL'); prompt(1,'L','737-800','w'); lbl(1,'R','ENG RATING '); prompt(1,'R','26K','w');
  lbl(2,'L',' NAV DATA'); prompt(2,'L',a.id,'w'); lbl(2,'R','ACTIVE'); prompt(2,'R',a.act.replace('-','')+'/26','w');
  prompt(3,'R',a.sec.replace('-','')+'/26','w'); scr[DR(3)].forEach(x=>x.s=1);
  lbl(4,'L',' OP PROGRAM'); prompt(4,'L','549849-001 (U10.8A)','w'); scr[DR(4)].forEach(x=>x.s=1);
  lbl(5,'L',' DRAG/F-F'); prompt(5,'L','+0.0/-0.0','w');
  put(LR(6),0,'------------------------','w',1); prompt(6,'L','<INDEX'); prompt(6,'R','POS INIT>'); },
  lsk(s,n){ if(s==='L'&&n===6){ go('index'); return; } if(s==='R'&&n===6){ go('posinit'); return; } if(s==='R'&&n===3){ msg('INVALID ENTRY'); return; } if(S.sp) msg('INVALID ENTRY'); },
  next(){ go('posinit'); }};

/* ---------- POS INIT ---------- */
PG.posinit={draw(){ const B=S.b, r=B.ref&&P[B.ref]; title('POS INIT'); putR(0,'1/3 ','w',1);
  lbl(1,'R','LAST POS '); prompt(1,'R',llOf(P.XNDV),'w'); scr[DR(1)].forEach((x,i)=>{ if(i>5) x.s=1; });
  lbl(2,'L',' REF AIRPORT'); prompt(2,'L',B.ref||'§§§§','w'); if(r) prompt(2,'R',llOf(r),'w');
  lbl(3,'L',' GATE'); prompt(3,'L',B.gate||'-----','w');
  lbl(4,'L',' UTC (GPS)'); prompt(4,'L',hhmm(S.utc)+'z','w'); lbl(4,'R','GPS POS '); prompt(4,'R',llOf(P.XNDV),'w'); scr[DR(4)].forEach((x,i)=>{ if(i>5) x.s=1; });
  lbl(5,'R','SET IRS POS '); prompt(5,'R',B.irs?llOf(P.XNDV):'§§§°§§.§ §§§§°§§.§','w');
  put(LR(6),0,'------------------------','w',1); prompt(6,'L','<INDEX'); prompt(6,'R','ROUTE>'); },
  lsk(s,n){ const v=S.sp, B=S.b;
    if(s==='L'&&n===6){ go('index'); return; } if(s==='R'&&n===6){ go('rte',{rpg:1}); return; }
    if(s==='L'&&n===2){ if(!v) return; if(!AP[v]){ msg('NOT IN DATA BASE'); return; } B.ref=v; take(); return; }
    if(s==='L'&&n===3){ if(!v) return; if(!/^[A-Z0-9]{1,5}$/.test(v)){ msg('INVALID ENTRY'); return; } B.gate=v; take(); return; }
    if(s==='R'&&(n===1||n===4)){ if(v){ msg('INVALID ENTRY'); return; } S.sp=llOf(P.XNDV); return; }
    if(s==='R'&&n===5){ if(!v) return; if(v!==llOf(P.XNDV)){ msg('INVALID ENTRY'); return; } B.irs=true; take(); return; }
    if(v) msg('INVALID ENTRY'); },
  next(){ go('rte',{rpg:1}); }, prev(){ go('ident'); }};

/* ---------- RTE ---------- */
function rteRows(p){
  /* VIA/TO rows built from the plan, the way the RTE page shows them */
  const rows=[]; let i=1;
  while(i<p.items.length){ const it=p.items[i];
    if(it.k==='dest'||it.k==='hold'||it.k==='disc'){ i++; continue; }
    if(!isW(it)){ i++; continue; }
    let via; if(it.seg==='sid') via=p.sid; else if(it.seg==='star') via=p.star; else if(it.seg==='via'||it.seg==='app') via=p.appr; else via=(it.via&&AWY[it.via])?it.via:'DIRECT';
    const last=rows[rows.length-1];
    if(last&&last.via===via&&via!=='DIRECT') last.to=it.id; else rows.push({via,to:it.id});
    i++;
  }
  return rows;
}
function lastEnr(p){ let k=0; p.items.forEach((x,i)=>{ if((x.seg==='o'||x.seg==='sid'||x.seg==='enr')&&(isW(x)||x.k==='apt')) k=i; }); return k; }
PG.rte={
  draw(){
    const p=cur(), act=rteAct(), pg=S.rpg||1, rows=rteRows(p), np=1+Math.max(1,Math.ceil((rows.length+1)/5));
    const t=(isMod()?'MOD ':act?'ACT ':'')+'RTE 1'; put(0,1,t,'w'); putR(0,pg+'/'+np+' ','w',1);
    if(pg===1){
      lbl(1,'L',' ORIGIN'); prompt(1,'L',p.from||'§§§§','w'); lbl(1,'R','DEST '); prompt(1,'R',p.to||'§§§§','w');
      lbl(2,'L',' CO ROUTE'); prompt(2,'L',S.init.co||'----------','w'); lbl(2,'R','FLT NO. '); prompt(2,'R',S.init.flt||'--------','w');
      lbl(3,'L',' RUNWAY'); prompt(3,'L',p.dRwy?'RW'+p.dRwy:'-----','w');
      put(LR(6),0,'------------------------','w',1);
      if(isMod()) prompt(6,'L','<ERASE'); else prompt(6,'L','<RTE 2');
      if(S.rte==='inactive'&&p.from&&p.to) prompt(6,'R','ACTIVATE>'); else if(S.rte==='pend') prompt(6,'R','ACTIVATE>'); else if(act&&S.phase==='PRE') prompt(6,'R','PERF INIT>');
      return;
    }
    lbl(1,'L',' VIA'); lbl(1,'R','TO ');
    const all=rows.concat(S.rteVia?[{via:S.rteVia,to:null,pend:1}]:[]).concat([{blank:1}]);
    all.slice((pg-2)*5,(pg-2)*5+5).forEach((r,j)=>{ const n=j+1; if(r.blank){ prompt(n,'L','-----','w'); prompt(n,'R','-----','w'); return; } prompt(n,'L',r.via,'w'); prompt(n,'R',r.to||'§§§§§','w'); });
    put(LR(6),0,'------------------------','w',1);
    if(isMod()) prompt(6,'L','<ERASE'); else prompt(6,'L','<RTE 2');
    if(S.rte==='inactive'&&p.from&&p.to) prompt(6,'R','ACTIVATE>');
  },
  lsk(s,n){
    const v=S.sp, pg=S.rpg||1;
    if(n===6){
      if(s==='L'&&isMod()){ S.tmpy=null; S.rteVia=null; return; }
      if(s==='R'&&S.rte==='inactive'&&S.act.from&&S.act.to){ S.rte='pend'; return; }
      if(s==='R'&&rteAct()&&S.phase==='PRE'&&pg===1){ go('perfinit'); return; }
      if(s==='L'){ msg('INVALID ENTRY'); }
      return;
    }
    if(pg===1){
      if(s==='L'&&n===1||s==='R'&&n===1){ if(!v) return; if(!AP[v]){ msg('NOT IN DATA BASE'); return; }
        if(s==='L'){ if(rteAct()&&S.phase!=='PRE'){ msg('INVALID ENTRY'); return; } S.act=newPlan(v,S.act.to||null); if(!S.act.to){ S.act.items=[{k:'apt',id:v,seg:'o'}]; } if(S.rte==='none') S.rte='inactive'; take(); return; }
        const p=S.act.from?(rteAct()?modPlan():S.act):null; if(!p){ msg('INVALID ENTRY'); return; }
        if(!p.items.some(x=>x.k==='dest')){ p.items=[p.items[0],{k:'disc',seg:'enr'},{k:'dest',id:v,seg:'d'}]; p.to=v; if(S.rte==='none') S.rte='inactive'; take(); return; }
        const k=lastEnr(p); p.items=p.items.slice(0,k+1).concat([{k:'disc',seg:'enr'},{k:'dest',id:v,seg:'d'}]); p.to=v; p.miss=[]; p.appr=p.star=p.via=null; take(); return; }
      if(s==='L'&&n===2){ if(!v) return; if(!CORTE[v]){ msg('NOT IN DATA BASE'); return; } const c=CORTE[v]; const p=newPlan(c.from,c.to); p.items=[{k:'apt',id:c.from,seg:'o'}].concat(c.route.map(r=>W(r[0],{seg:'enr',via:r[1]||'DIRECT'})),[{k:'disc',seg:'enr'},{k:'dest',id:c.to,seg:'d'}]); S.act=p; S.init.co=v; if(S.rte==='none') S.rte='inactive'; take(); return; }
      if(s==='R'&&n===2){ if(!v) return; if(!/^[A-Z0-9]{1,8}$/.test(v)){ msg('INVALID ENTRY'); return; } S.init.flt=v; take(); return; }
      if(s==='L'&&n===3){ if(!v) return; const r=v.replace(/^RW/,''); if(!S.act.from||!AP[S.act.from].rwy[r]){ msg('NOT IN DATA BASE'); return; } const p=rteAct()?modPlan():S.act; setDeparture(p,r,p.sid&&AP[p.from].sid[p.sid].rwy===r?p.sid:null,null); take(); return; }
      if(v) msg('INVALID ENTRY'); return;
    }
    if(!S.act.from||!S.act.to){ msg('INVALID ENTRY'); return; }
    const p0=cur(), rows=rteRows(p0), idx=(pg-2)*5+n-1, blankIdx=rows.length+(S.rteVia?1:0);
    if(idx<rows.length){ if(v==='DELETE'){ msg('INVALID DELETE'); take(); return; } if(v) msg('INVALID ENTRY'); return; }
    if(idx===rows.length&&S.rteVia){ /* the pending airway row: TO */
      if(s==='R'){ if(!v) return; const p=rteAct()?modPlan():S.act; const k=lastEnr(p); const from=p.items[k]; const A=AWY[S.rteVia]; if(!P[v]){ msg('NOT IN DATA BASE'); return; } if(A.indexOf(v)<0){ msg('INVALID ENTRY'); return; } const e=addAirways(p,k,[{via:S.rteVia,to:v}]); if(e){ msg('INVALID ENTRY'); return; } S.rteVia=null; take(); return; }
      if(s==='L'&&v==='DELETE'){ S.rteVia=null; take(); return; }
      if(v) msg('INVALID ENTRY'); return;
    }
    if(idx===blankIdx){
      if(!v) return;
      if(s==='L'){ if(v==='DIRECT') return; if(!AWY[v]){ msg('NOT IN DATA BASE'); return; } const p=cur(); const last=p.items[lastEnr(p)]; if(!last||AWY[v].indexOf(last.id)<0){ msg('INVALID ENTRY'); return; } S.rteVia=v; take(); return; }
      if(s==='R'){ if(!P[v]||P[v].t==='APT'||P[v].t==='RWY'){ msg('NOT IN DATA BASE'); return; } const p=rteAct()?modPlan():S.act; const k=lastEnr(p); const before=p.items.slice(0,k+1).concat([W(v,{seg:'enr',via:'DIRECT'})]), after=p.items.slice(k+1); p.items=join(before,after); tidy(p); take(); return; }
    }
    if(v) msg('INVALID ENTRY');
  },
  next(){ const rows=rteRows(cur()); const np=1+Math.max(1,Math.ceil((rows.length+1)/5)); S.rpg=(S.rpg||1)>=np?1:(S.rpg||1)+1; },
  prev(){ const rows=rteRows(cur()); const np=1+Math.max(1,Math.ceil((rows.length+1)/5)); S.rpg=(S.rpg||1)<=1?np:(S.rpg||1)-1; }
};

/* ---------- DEP/ARR ---------- */
PG.deparr={draw(){ const p=cur(); title('DEP/ARR INDEX'); if(!p.from){ put(DR(3),2,'NO ACTIVE OR MODIFIED','w'); put(DR(4),9,'ROUTE','w'); return; }
  lbl(1,'C','RTE 1'); prompt(1,'L','<DEP'); putC(DR(1),p.from,'w');
  if(p.to){ putC(DR(2),p.to,'w'); prompt(2,'R','ARR>'); }
  put(LR(6),0,'------------------------','w',1); lbl(6,'C','OTHER'); prompt(6,'L','<DEP'); prompt(6,'R','ARR>'); },
  lsk(s,n){ const p=cur(); if(S.sp){ msg('INVALID ENTRY'); return; } if(!p.from) return;
    if(s==='L'&&n===1){ S.dep={pg:0}; go('dep'); return; } if(s==='R'&&n===2&&p.to){ S.arr={pg:0}; go('arr'); return; } if(s==='R'&&n===1){ msg('INVALID ENTRY'); return; } msg('INVALID ENTRY'); }};
function mark(sel,actv){ return sel?(actv?'<ACT>':'<SEL>'):''; }
PG.dep={
  draw(){
    const p=cur(), A=AP[p.from], a0=S.act;
    put(0,1,p.from+' DEPARTURES','w');
    lbl(1,'L',' SIDS'); lbl(1,'R','RUNWAYS ');
    const sids=Object.keys(A.sid).filter(k=>!p.dRwy||A.sid[k].rwy===p.dRwy).sort();
    sids.slice(0,5).forEach((k,j)=>{ const sel=p.sid===k; prompt(j+1,'L',k+(sel?' '+mark(1,!isMod()&&a0.sid===k&&rteAct()):''),'w'); if(sel) scr[DR(j+1)].forEach((x,i)=>{ if(i>k.length&&i<=k.length+5) x.k='g'; }); });
    const rws=Object.keys(A.rwy).sort();
    rws.forEach((r,j)=>{ const sel=p.dRwy===r; const t=(sel?mark(1,!isMod()&&a0.dRwy===r&&rteAct())+' ':'')+'RW'+r; prompt(j+1,'R',t,'w'); if(sel) scr[DR(j+1)].forEach((x,i)=>{ if(i>=COLS-t.length&&i<COLS-t.length+5) x.k='g'; }); });
    if(p.sid&&sids.length<5){ lbl(sids.length+1,'L',' TRANS'); prompt(sids.length+1,'L','NONE','w'); }
    put(LR(6),0,'------------------------','w',1);
    prompt(6,'L',isMod()?'<ERASE':'<INDEX'); prompt(6,'R','ROUTE>');
  },
  lsk(s,n){
    const p0=cur(), A=AP[p0.from];
    if(n===6){ if(s==='L'){ if(isMod()) S.tmpy=null; else go('deparr'); return; } go('rte',{rpg:1}); return; }
    if(S.sp){ msg('INVALID ENTRY'); return; }
    if(s==='L'){ const sids=Object.keys(A.sid).filter(k=>!p0.dRwy||A.sid[k].rwy===p0.dRwy).sort(); const k=sids[n-1]; if(!k) return; const p=modPlan(); if(p.sid===k){ setDeparture(p,p.dRwy,null,null); return; } setDeparture(p,A.sid[k].rwy,k,null); return; }
    const rws=Object.keys(A.rwy).sort(); const r=rws[n-1]; if(!r) return; const p=modPlan(); if(p.dRwy===r){ setDeparture(p,null,null,null); return; } setDeparture(p,r,p.sid&&A.sid[p.sid].rwy===r?p.sid:null,null);
  }
};
PG.arr={
  draw(){
    const p=cur(), d=destOf(p), A=AP[d.id], a0=S.act;
    put(0,1,d.id+' ARRIVALS','w');
    lbl(1,'L',' STARS'); lbl(1,'R','APPROACHES ');
    const stars=Object.keys(A.star).filter(k=>!p.aRwy||A.star[k].rwys.includes(p.aRwy)).sort();
    stars.slice(0,4).forEach((k,j)=>{ const sel=p.star===k; prompt(j+1,'L',k+(sel?' '+mark(1,!isMod()&&a0.star===k):''),'w'); });
    const apps=Object.keys(A.app).sort();
    let rr=1;
    apps.forEach(k=>{ if(rr>5) return; const sel=p.appr===k; prompt(rr,'R',(sel?mark(1,!isMod()&&a0.appr===k)+' ':'')+k,'w'); rr++; if(sel){ const vs=Object.keys(A.app[k].vias); if(vs.length&&rr<=5){ lbl(rr,'R','TRANS '); vs.forEach(vk=>{ if(rr>5) return; const vsel=p.via===vk; prompt(rr,'R',(vsel?mark(1,!isMod()&&a0.via===vk)+' ':'')+vk,'w'); rr++; }); } } });
    put(LR(6),0,'------------------------','w',1);
    prompt(6,'L',isMod()?'<ERASE':'<INDEX'); prompt(6,'R','ROUTE>');
  },
  lsk(s,n){
    const p0=cur(), d=destOf(p0), A=AP[d.id];
    if(n===6){ if(s==='L'){ if(isMod()) S.tmpy=null; else go('deparr'); return; } go('rte',{rpg:1}); return; }
    if(S.sp){ msg('INVALID ENTRY'); return; }
    if(s==='L'){ const stars=Object.keys(A.star).filter(k=>!p0.aRwy||A.star[k].rwys.includes(p0.aRwy)).sort(); const k=stars[n-1]; if(!k) return; const p=modPlan(); setArrival(p,p.appr,p.star===k?null:k,p.via); return; }
    /* right column: approaches with the transitions of the selected one under it */
    const list=[]; Object.keys(A.app).sort().forEach(k=>{ list.push({t:'app',k}); if(p0.appr===k) Object.keys(A.app[k].vias).forEach(vk=>list.push({t:'via',k:vk})); });
    const x=list[n-1]; if(!x) return; const p=modPlan();
    if(x.t==='app'){ if(p.appr===x.k) setArrival(p,null,p.star,null); else { const st=p.star&&!A.star[p.star].rwys.includes(A.app[x.k].rwy)?null:p.star; setArrival(p,x.k,st,null); } return; }
    if(x.t==='via'){ setArrival(p,p.appr,p.star,p.via===x.k?null:x.k); return; }
  }
};

/* ---------- LEGS ---------- */
function legsRows(){ const p=cur(), rows=[]; p.items.forEach((it,i)=>{ if(i===0) return; rows.push({it,i}); }); if(p.miss) p.miss.forEach(m=>rows.push({it:m,miss:1})); return rows; }
PG.legs={
  draw(){
    const p=cur(), rows=legsRows(), np=Math.max(1,Math.ceil(rows.length/5)); S.lpg=Math.min(S.lpg||1,np); const pg=S.lpg;
    put(0,1,(isMod()?'MOD ':rteAct()?'ACT ':'')+'RTE 1 LEGS','w'); putR(0,pg+'/'+np+' ','w',1);
    const V=!isMod()?vprof():null, fl=flyingPlan();
    rows.slice((pg-1)*5,pg*5).forEach((r,j)=>{
      const n=j+1, it=r.it;
      if(it.k==='disc'){ putC(LR(n),'- ROUTE DISCONTINUITY -','w',1); prompt(n,'L','§§§§§','w'); return; }
      if(it.k==='hold'){ lbl(n,'L',' HOLD AT'); prompt(n,'L',it.at,'w'); putR(DR(n),it.turn+' TURN '+p3(it.crs)+'°','w',1); return; }
      const prv=r.miss?null:(()=>{ let k=r.i-1; while(k>0&&p.items[k]&&p.items[k].k==='hold') k--; return p.items[k]; })();
      const a=r.i===1&&fl?S.pos:(prv&&prv.k!=='disc'?coord(prv):null), b=coord(it);
      if(a&&b){ put(LR(n),1,p3(it.rin!=null?w360(it.rin+180):brg(a,b))+'°','w',1); put(LR(n),9,Math.round(dist(a,b))+' NM','w',1); }
      const id=it.k==='dest'?'RW'+(it.rwy||'')+(it.rwy?'':it.id):it.id;
      const active=rteAct()&&!isMod()&&r.i===1&&!r.miss;
      prompt(n,'L',(it.k==='dest'&&!it.rwy)?it.id:id,active?'m':'w');
      let spd='---', alt='-----', big=false;
      if(it.k==='dest'){ alt=String(P[it.id].elev); }
      else if(V&&V.cum[r.i]!=null){ spd=V.sp(V.cum[r.i]); alt=V.fa(V.cum[r.i]); }
      if(it.alt){ alt=cstrTxt(it.alt); big=true; } if(it.spd){ spd=String(it.spd); big=true; }
      const t=spd+'/'+alt.padStart(6,' '); putR(DR(n),t,active?'m':'w'); if(!big) scr[DR(n)].forEach((x,i)=>{ if(i>=COLS-t.length) x.s=1; });
      else { scr[DR(n)].forEach((x,i)=>{ if(i>=COLS-t.length&&!((it.spd&&i<COLS-7)||(it.alt&&i>=COLS-6))) x.s=1; }); }
    });
    if(!(S.holdAt&&!isMod())&&!(isMod()&&fl&&S.tmpy.dir)) put(LR(6),0,'------------------------','w',1);
    if(S.holdAt&&!isMod()){ lbl(6,'L',' HOLD AT'); prompt(6,'L','§§§§§','w'); prompt(6,'R','PPOS>'); return; }
    if(isMod()) prompt(6,'L','<ERASE'); else prompt(6,'L','<RTE 2 LEGS');
    if(isMod()&&fl&&S.tmpy.dir){ lbl(6,'R','INTC CRS '); prompt(6,'R',S.tmpy.intc!=null?p3(S.tmpy.intc)+'°':'---°','w'); }
    else prompt(6,'R','RTE DATA>');
  },
  lsk(s,n){
    const v=S.sp, rows=legsRows(), pg=S.lpg||1, fl=flyingPlan();
    if(n===6){
      if(S.holdAt&&!isMod()){ if(s==='L'){ if(!v) return; const i=S.act.items.findIndex((x,j)=>j>=1&&isW(x)&&x.id===v); if(i<0){ msg(P[v]?'INVALID ENTRY':'NOT IN DATA BASE'); return; } take(); S.holdAt=false; makeHold(i); return; } if(s==='R'){ if(!fl){ msg('INVALID ENTRY'); return; } S.holdAt=false; makeHold(0,true); return; } return; }
      if(s==='L'&&isMod()){ S.tmpy=null; return; }
      if(s==='R'&&isMod()&&fl&&S.tmpy.dir){ if(!v) return; const c=num(v,0,360); if(c==null||Number.isNaN(c)){ msg('INVALID ENTRY'); return; } const t=S.tmpy.plan.items[1]; S.tmpy.intc=c===0?360:c; t.rin=w360(S.tmpy.intc+180); take(); return; }
      if(s==='R'){ msg('INVALID ENTRY'); return; }
      return;
    }
    const r=rows[(pg-1)*5+n-1]; if(!r){ if(v) msg('INVALID ENTRY'); return; }
    if(r.miss){ if(v) msg('INVALID ENTRY'); else S.sp=r.it.id; return; }
    const it=r.it, i=r.i;
    if(s==='R'){
      if(it.k!=='wpt'){ if(v) msg('INVALID ENTRY'); return; }
      if(!v) return;
      const p=modPlan(), t=p.items[i];
      if(v==='DELETE'){ if(!t.alt&&!t.spd){ msg('INVALID DELETE'); take(); return; } delete t.alt; delete t.spd; take(); return; }
      const m=/^(\d{3})?(?:\/)?([0-9A-Z]*)$/.exec(v.includes('/')?v:'/'+v); const parts=v.split('/');
      let sp=null, al=null;
      if(parts.length===2){ if(parts[0]){ const x=+parts[0]; if(!/^\d{3}$/.test(parts[0])||x<100||x>350){ msg('INVALID ENTRY'); return; } sp=x; } if(parts[1]){ al=parseBAlt(parts[1]); if(!al){ msg('INVALID ENTRY'); return; } } }
      else { al=parseBAlt(v); if(!al){ msg('INVALID ENTRY'); return; } }
      if(sp!=null&&!al&&!t.alt){ msg('INVALID ENTRY'); return; }
      if(sp!=null) t.spd=sp; if(al) t.alt=al; take(); return;
    }
    /* left keys */
    if(!v){ if(it.k==='disc'){ return; } S.sp=it.k==='hold'?it.at:(it.k==='dest'?(it.rwy?'RW'+it.rwy:it.id):it.id); return; }
    if(v==='DELETE'){
      if(it.k==='dest'){ msg('INVALID DELETE'); take(); return; }
      if(fl&&i===1&&S.ap==='NAV'){ msg('INVALID DELETE'); take(); return; }
      const p=modPlan(); p.items.splice(i,1); tidy(p); take(); return;
    }
    if(!/^[A-Z0-9]{2,7}$/.test(v)){ msg('INVALID ENTRY'); return; }
    if(!P[v]&&!cur().items.some(x=>isW(x)&&x.id===v)){ msg('NOT IN DATA BASE'); return; }
    if(P[v]&&(P[v].t==='APT'||P[v].t==='RWY')){ msg('INVALID ENTRY'); return; }
    const p=modPlan();
    if(fl&&i===1){ /* direct to: PPOS to the waypoint */
      const tp={k:'wpt',id:'T-P',seg:'enr',pos:{x:S.pos.x,y:S.pos.y}};
      const j=p.items.findIndex((x,k)=>k>=1&&isW(x)&&x.id===v);
      p.items=j>=1?[tp].concat(p.items.slice(j)):[tp,W(v,{seg:'enr',via:'DIRECT'}),{k:'disc',seg:'enr'}].concat(p.items.slice(1));
      tidy(p); S.tmpy.dir=1; S.tmpy.intc=null; take(); return;
    }
    if(it.k==='disc'){ const j=p.items.findIndex((x,k)=>k>i&&isW(x)&&x.id===v); if(j>i){ p.items.splice(i,j-i); } else { p.items.splice(i,1,W(v,{seg:p.items[i+1]?p.items[i+1].seg:'enr',via:'DIRECT'}),{k:'disc',seg:'enr'}); } tidy(p); take(); return; }
    insertAt(p,i,v); take();
  },
  next(){ const np=Math.max(1,Math.ceil(legsRows().length/5)); S.lpg=(S.lpg||1)>=np?1:(S.lpg||1)+1; },
  prev(){ const np=Math.max(1,Math.ceil(legsRows().length/5)); S.lpg=(S.lpg||1)<=1?np:(S.lpg||1)-1; }
};
function parseBAlt(v){ const m=/^(?:FL(\d{2,3})|(\d{3,5}))([AB])?$/.exec(v); if(!m) return null; let a; if(m[1]) a=+m[1]*100; else a=+m[2]; if(a<100||a>41000) return null; const s=m[3]==='A'?'+':m[3]==='B'?'-':''; return s+(a>=18000||m[1]?'FL'+p3(Math.round(a/100)):String(a)); }
function cstrTxt(a){ const s=a[0]==='+'?'A':a[0]==='-'?'B':''; const b=a.replace(/^[+-]/,''); return b+s; }

/* ---------- HOLD ---------- */
function makeHold(i,ppos){
  const p=modPlan(); let fix=p.items[i];
  if(ppos){ fix={k:'wpt',id:'PPOS',seg:'enr',pos:{x:S.pos.x,y:S.pos.y}}; p.items.splice(1,0,fix); i=1; }
  const prev=p.items.slice(0,i).reverse().find(x=>coord(x)); const a=prev?coord(prev):S.pos, b=coord(fix);
  const crs=a&&b&&a!==b?brg(a,b):w360(S.trk);
  p.items.splice(i+1,0,{k:'hold',at:fix.id,crs,turn:'R',time:S.alt>14000?1.5:1.0,seg:fix.seg,dflt:1});
  S.hpg=i+1; go('hold');
}
PG.hold={
  draw(){
    const p=cur(), h=p.items[S.hpg]; if(!h||h.k!=='hold'){ go('legs'); return; }
    put(0,1,(isMod()?'MOD ':'ACT ')+'RTE 1 HOLD','w');
    lbl(1,'L',' FIX'); prompt(1,'L',h.at,'w');
    lbl(2,'L',' QUAD/RADIAL'); prompt(2,'L','--/---','w');
    lbl(3,'L',' INBD CRS/DIR'); prompt(3,'L',p3(h.crs)+'°/'+h.turn+' TURN','w'); if(h.dflt&&!h.pc) scr[DR(3)].forEach((x,i)=>{ if(i<12) x.s=1; });
    lbl(4,'L',' LEG TIME'); prompt(4,'L',(h.time||1).toFixed(1)+' MIN','w'); if(!h.ptm) scr[DR(4)].forEach((x,i)=>{ if(i<8) x.s=1; });
    lbl(5,'L',' LEG DIST'); prompt(5,'L','--.-NM','w');
    const F=fuel();
    lbl(1,'R','SPD/TGT ALT '); prompt(1,'R','220/FL'+p3(Math.round(S.alt/100)||350),'w'); scr[DR(1)].forEach((x,i)=>{ if(i>13) x.s=1; });
    lbl(2,'R','FIX ETA '); prompt(2,'R',hhmm(S.utc+(S.phase==='PRE'?0:8))+'z','w');
    lbl(3,'R','EFC TIME '); prompt(3,'R',S.efc?S.efc+'z':'----z','w');
    lbl(4,'R','HOLD AVAIL '); prompt(4,'R',F&&F.fob!=null?(()=>{ const m=Math.max(0,((F.efob-S.b.res)/2.2)*60); return Math.floor(m/60)+'+'+String(Math.round(m%60)).padStart(2,'0'); })():'-+--','w');
    lbl(5,'R','BEST SPEED '); prompt(5,'R','220KT','w');
    put(LR(6),0,'------------------------','w',1);
    if(isMod()) prompt(6,'L','<ERASE'); else prompt(6,'L','<NEXT HOLD');
    if(!isMod()&&flyingPlan()&&S.hz) prompt(6,'R',S.exitArm?'EXIT ARMED':'EXIT HOLD>','w');
    if(S.exitReq) put(0,1,'MOD','w');
  },
  lsk(s,n){
    const v=S.sp;
    if(n===6){ if(s==='L'&&isMod()){ S.tmpy=null; go('legs'); return; } if(s==='L'){ S.holdAt=true; go('legs'); return; } if(s==='R'&&S.hz&&!isMod()&&!S.exitArm){ S.exitReq=true; return; } return; }
    if(s==='R'&&n===3){ if(!v) return; if(!/^\d{4}$/.test(v)){ msg('INVALID ENTRY'); return; } S.efc=v; take(); return; }
    if(!v) return;
    const p=modPlan(), h=p.items[S.hpg];
    if(s==='L'&&n===3){ const m=/^(\d{1,3})?(?:\/([LR]))?$/.exec(v); if(!m||(!m[1]&&!m[2])){ msg('INVALID ENTRY'); return; } if(m[1]){ const c=+m[1]; if(c>360){ msg('INVALID ENTRY'); return; } h.crs=c===0?360:c; h.pc=1; } if(m[2]){ h.turn=m[2]; h.pc=1; } take(); return; }
    if(s==='L'&&n===4){ const t=parseFloat(v); if(!(t>=0.5&&t<=9.9)){ msg('INVALID ENTRY'); return; } h.time=t; h.ptm=1; take(); return; }
    msg('INVALID ENTRY');
  }
};

/* ---------- PERF INIT ---------- */
PG.perfinit={
  draw(){
    const B=S.b, f=S.fb, g=gw();
    title('PERF INIT');
    lbl(1,'L',' GW/CRZ CG'); prompt(1,'L',(g!=null?g.toFixed(1):'---.-')+'/'+B.ccg.toFixed(1)+'%','w'); scr[DR(1)].forEach(x=>x.s=1);
    lbl(2,'L',' PLAN/FUEL'); prompt(2,'L','  '+(f.block!=null?f.block.toFixed(1):'---.-'),'w'); scr[DR(2)].forEach(x=>x.s=1);
    lbl(3,'L',' ZFW'); prompt(3,'L',f.zfw!=null?f.zfw.toFixed(1):'§§§.§','w');
    lbl(4,'L',' RESERVES'); prompt(4,'L',B.res!=null?B.res.toFixed(1):'§§.§','w');
    lbl(5,'L',' COST INDEX'); prompt(5,'L',S.init.ci!=null?String(S.init.ci):'§§§§','w');
    lbl(1,'R','CRZ ALT '); prompt(1,'R',S.init.crz?'FL'+p3(S.init.crz):'§§§§§','w');
    lbl(2,'R','CRZ WIND '); prompt(2,'R',B.wind||'---°/---','w');
    lbl(3,'R','ISA DEV  T/C OAT '); prompt(3,'R',(B.oat!=null?(B.oat+55>0?'+':'')+(B.oat+55)+'°C':'---°C')+'  '+(B.oat!=null?(B.oat>0?'+':'')+B.oat+'°C':'---°C'),'w'); scr[DR(3)].forEach((x,i)=>{ if(i>=COLS-17&&i<COLS-7) x.s=1; });
    lbl(4,'R','TRANS ALT '); prompt(4,'R',String(S.perf.ta||7000),'w'); if(!S.perf.ta) scr[DR(4)].forEach((x,i)=>{ if(i>18) x.s=1; });
    put(LR(6),0,'------------------------','w',1); prompt(6,'L','<INDEX'); prompt(6,'R','N1 LIMIT>');
  },
  lsk(s,n){
    const v=S.sp, B=S.b, f=S.fb;
    if(n===6){ if(s==='L') go('index'); else go('n1'); return; }
    if(!v) return;
    const pend=()=>{ if(rteAct()) S.perfPend=true; };
    if(s==='L'&&n===3){ const z=num(v,35,62.7,1); if(z==null||Number.isNaN(z)){ msg('INVALID ENTRY'); return; } const ch=f.zfw!==z; f.zfw=z; take(); pend(); if(ch&&S.phase==='PRE') delV(); return; }
    if(s==='L'&&n===4){ const r=num(v,0,9.9,1); if(r==null||Number.isNaN(r)){ msg('INVALID ENTRY'); return; } B.res=r; take(); pend(); return; }
    if(s==='L'&&n===5){ const c=num(v,0,500); if(c==null||Number.isNaN(c)){ msg('INVALID ENTRY'); return; } S.init.ci=c; take(); pend(); return; }
    if(s==='R'&&n===1){ const m=/^\/?(?:FL)?(\d{3}|\d{5})$/.exec(v); if(!m){ msg('INVALID ENTRY'); return; } let a=+m[1]; if(a>1000) a=Math.round(a/100); if(a<10||a>410){ msg('INVALID ENTRY'); return; } S.init.crz=a; take(); pend(); return; }
    if(s==='R'&&n===2){ if(!/^\d{3}\/\d{1,3}$/.test(v)){ msg('INVALID ENTRY'); return; } B.wind=v.replace('/','°/'); take(); return; }
    if(s==='R'&&n===3){ const c=num(v.replace(/^\+/,''),-99,30); if(c==null||Number.isNaN(c)){ msg('INVALID ENTRY'); return; } B.oat=c; take(); return; }
    if(s==='R'&&n===4){ const c=num(v.replace(/^FL/,''),1000,18000); if(c==null||Number.isNaN(c)){ msg('INVALID ENTRY'); return; } S.perf.ta=c; take(); return; }
    if(s==='L'&&n===1){ msg('INVALID ENTRY'); return; }
    msg('INVALID ENTRY');
  },
  next(){ go('n1'); }
};

/* ---------- N1 LIMIT ---------- */
PG.n1={
  draw(){
    const N=S.n1; title('N1 LIMIT'); putR(0,'1/1 ','w',1);
    lbl(1,'L',' SEL/OAT'); prompt(1,'L',(N.sel!=null?N.sel+'°':'--°')+'/'+(N.oat>0?'+':'')+N.oat+'°C','w');
    lbl(1,'R','26K N1 '); prompt(1,'R',n1Of()+'/'+n1Of(),'w'); scr[DR(1)].forEach((x,i)=>{ if(i>12) x.s=1; });
    [['TO','26K'],['TO-1','24K'],['TO-2','22K']].forEach(([k,t],j)=>{ const sel=N.rating===k; prompt(2+j,'L',(sel?'<ACT> ':'<')+k+(k==='TO'?'':'')+' '+t,'w'); if(sel) scr[DR(2+j)].forEach((x,i)=>{ if(i<5) x.k='g'; }); });
    [['CLB'],['CLB-1'],['CLB-2']].forEach(([k],j)=>{ const sel=N.clb===k; const t=k+(sel?' <ACT>':'>'); prompt(2+j,'R',t,'w'); if(sel) scr[DR(2+j)].forEach((x,i)=>{ if(i>=COLS-5) x.k='g'; }); });
    put(LR(6),0,'------------------------','w',1); prompt(6,'L','<PERF INIT'); prompt(6,'R','TAKEOFF>');
  },
  lsk(s,n){
    const v=S.sp, N=S.n1;
    if(n===6){ if(s==='L') go('perfinit'); else go('takeoff'); return; }
    if(s==='L'&&n===1){ if(!v) return; if(v==='DELETE'){ N.sel=null; take(); delV(); return; } const m=/^(\d{1,2})?(?:\/([-+]?\d{1,2}))?$/.exec(v.replace(/[C°]/g,'')); if(!m||(m[1]==null&&m[2]==null)){ msg('INVALID ENTRY'); return; } if(m[1]!=null){ const t=+m[1]; if(t>70||t<=N.oat){ msg('INVALID ENTRY'); return; } N.sel=t; } if(m[2]!=null) N.oat=+m[2]; take(); delV(); return; }
    if(v){ msg('INVALID ENTRY'); return; }
    if(s==='L'&&n>=2&&n<=4){ const r=['TO','TO-1','TO-2'][n-2]; if(N.rating!==r){ N.rating=r; N.clb=['CLB','CLB-1','CLB-2'][n-2]; delV(); } return; }
    if(s==='R'&&n>=2&&n<=4){ N.clb=['CLB','CLB-1','CLB-2'][n-2]; return; }
  },
  prev(){ go('perfinit'); }, next(){ go('takeoff'); }
};

/* ---------- TAKEOFF REF ---------- */
PG.takeoff={
  draw(){
    const P_=S.perf, B=S.b, c=toSpeeds(), g=gw();
    title('TAKEOFF REF'); putR(0,'1/2 ','w',1);
    lbl(1,'L',' FLAPS'); prompt(1,'L',P_.flaps!=null?P_.flaps+'°':'§§°','w');
    lbl(2,'L',' 26K N1'); prompt(2,'L',n1Of()+'/'+n1Of(),'w'); scr[DR(2)].forEach((x,i)=>{ if(i<10) x.s=1; });
    lbl(3,'L',' CG'); prompt(3,'L',B.tocg!=null?B.tocg.toFixed(1)+'%':'§§.§%','w'); if(B.tocg!=null){ put(LR(3),8,'TRIM','w',1); put(DR(3),8,trimOf(B.tocg),'w'); }
    lbl(4,'L',' RUNWAY'); prompt(4,'L',S.act.dRwy?'RW'+S.act.dRwy:'-----','w');
    lbl(5,'L',' POS'); prompt(5,'L','+0000','w'); scr[DR(5)].forEach(x=>x.s=1);
    [['v1','V1'],['vr','VR'],['v2','V2']].forEach(([k,t],j)=>{ lbl(1+j,'R',t+' '); const sel=P_[k]!=null; const txt=sel?String(P_[k])+' KT':(c?String(c[k])+' KT':'--- KT'); prompt(1+j,'R',txt,'w'); if(!sel) scr[DR(1+j)].forEach((x,i)=>{ if(i>=COLS-txt.length) x.s=1; }); });
    lbl(4,'R','GW/TOW '); prompt(4,'R',g!=null?g.toFixed(1)+'/'+(g-0.2).toFixed(1):'---.-/---.-','w'); scr[DR(4)].forEach((x,i)=>{ if(i>12) x.s=1; });
    const miss=preMiss();
    put(LR(6),0,miss?'------------------------':'----PRE-FLT COMPLETE----','w',1);
    prompt(6,'L','<INDEX'); if(miss&&miss[1]) prompt(6,'R',miss[1]);
  },
  lsk(s,n){
    const v=S.sp, P_=S.perf, B=S.b;
    if(n===6){ if(s==='L') go('index'); else { const m=preMiss(); if(m&&m[1]) go(m[0],m[0]==='rte'?{rpg:1}:null); } return; }
    if(s==='L'&&n===1){ if(!v) return; const f=+v; if(![1,5,10,15,25].includes(f)||!/^\d{1,2}$/.test(v)){ msg('INVALID ENTRY'); return; } const ch=P_.flaps!==f; P_.flaps=f; take(); if(ch) delV(); return; }
    if(s==='L'&&n===3){ if(!v) return; const c=num(v,5,35,1); if(c==null||Number.isNaN(c)){ msg('INVALID ENTRY'); return; } const ch=B.tocg!==c; B.tocg=c; take(); if(ch) delV(); return; }
    if(s==='R'&&n>=1&&n<=3){ const k=['v1','vr','v2'][n-1];
      if(v==='DELETE'){ P_[k]=null; take(); return; }
      if(!v){ const c=toSpeeds(); if(!c||P_[k]!=null) return; P_[k]=c[k]; vchk(); return; }
      const x=num(v,90,200); if(x==null||Number.isNaN(x)){ msg('INVALID ENTRY'); return; } P_[k]=x; take(); vchk(); return; }
    if(v) msg('INVALID ENTRY');
  },
  prev(){ go('n1'); }
};
function preMiss(){ if(!rteAct()||execLit()) return ['rte','ROUTE>']; if(S.fb.zfw==null||S.b.res==null||S.init.ci==null||!S.init.crz) return ['perfinit','PERF INIT>']; const P_=S.perf; if(P_.flaps==null||S.b.tocg==null||P_.v1==null||P_.vr==null||P_.v2==null) return ['takeoff',null]; return null; }
function vchk(){ const p=S.perf; if(p.v1&&p.vr&&p.v1>p.vr||p.vr&&p.v2&&p.vr>p.v2) msg('V1/VR/V2 DISAGREE'); }

/* ---------- APPROACH REF ---------- */
PG.appref={
  draw(){
    const R_=vrefs(), d=destOf(S.act), A=S.b.app;
    title('APPROACH REF');
    lbl(1,'L',' GROSS WT'); prompt(1,'L',R_.lw.toFixed(1),'w'); scr[DR(1)].forEach((x,i)=>{ if(i<6) x.s=1; });
    lbl(1,'R','FLAPS    VREF '); prompt(1,'R','15°   '+R_.v15+'KT','w'); prompt(2,'R','30°   '+R_.v30+'KT','w'); prompt(3,'R','40°   '+R_.v40+'KT','w');
    [1,2,3].forEach(n=>scr[DR(n)].forEach((x,i)=>{ if(i>11) x.s=1; }));
    if(d&&d.rwy){ lbl(4,'L',' '+d.id+d.rwy); prompt(4,'L','2500M','w'); const il=AP[d.id].rwy[d.rwy].ils; if(il){ lbl(5,'L',' ILS'+d.rwy+'/CRS'); prompt(5,'L',ILS[il].f+'/'+p3(ILS[il].crs)+'°','w'); } }
    lbl(4,'R','FLAP/SPD '); prompt(4,'R',A?A.f+'/'+A.v:'§§/§§§','w');
    lbl(5,'R','WIND CORR '); prompt(5,'R','+5KT','w'); scr[DR(5)].forEach((x,i)=>{ if(i>18) x.s=1; });
    put(LR(6),0,'------------------------','w',1); prompt(6,'L','<INDEX');
  },
  lsk(s,n){
    const v=S.sp, R_=vrefs();
    if(n===6){ if(s==='L') go('index'); return; }
    if(s==='R'&&n>=1&&n<=3){ if(v){ msg('INVALID ENTRY'); return; } const f=[15,30,40][n-1], vr=[R_.v15,R_.v30,R_.v40][n-1]; S.sp=f+'/'+vr; return; }
    if(s==='R'&&n===4){ if(!v) return; if(v==='DELETE'){ S.b.app=null; take(); return; } const m=/^(15|30|40)\/(\d{3})$/.exec(v); if(!m){ msg('INVALID ENTRY'); return; } S.b.app={f:+m[1],v:+m[2]}; take(); return; }
    if(v) msg('INVALID ENTRY');
  }
};

/* ---------- CLB / CRZ / DES ---------- */
PG.vnav={
  draw(){
    const ph=S.vpg||({PRE:'CLB',CRZ:'CRZ',DES:'DES',APP:'DES'}[S.phase]), act=({PRE:'CLB',CRZ:'CRZ',DES:'DES',APP:'DES'}[S.phase])===ph&&S.phase!=='PRE';
    const crz=S.init.crz?'FL'+p3(S.init.crz):'-----';
    put(0,1,(act?'ACT ':'')+'ECON '+(ph==='CLB'?'CLB':ph==='CRZ'?'CRZ':'DES'),'w');
    if(ph==='CLB'){ lbl(1,'L',' CRZ ALT'); prompt(1,'L',S.init.crz?crz:'§§§§§','w'); lbl(2,'L',' TGT SPD'); prompt(2,'L','280/.780','w'); lbl(3,'L',' SPD REST'); prompt(3,'L','250/10000','w'); lbl(1,'R','AT '); prompt(1,'R','-----','w'); }
    else if(ph==='CRZ'){ lbl(1,'L',' CRZ ALT'); prompt(1,'L',crz,'w'); lbl(2,'L',' TGT SPD'); prompt(2,'L','.780','w'); lbl(1,'R','STEP TO '); prompt(1,'R','NONE','w'); lbl(4,'L',' OPT     MAX'); prompt(4,'L','FL'+p3(Math.min(390,(S.init.crz||350)+10))+'   FL410','w'); scr[DR(4)].forEach(x=>x.s=1); }
    else { lbl(1,'L',' E/D ALT'); prompt(1,'L','1680','w'); lbl(2,'L',' TGT SPD'); prompt(2,'L','.780/280','w'); lbl(3,'L',' SPD REST'); prompt(3,'L','240/10000','w'); lbl(1,'R','AT XSKH25 '); prompt(1,'R','---/ 1680','w'); prompt(5,'R','FORECAST>'); }
    put(LR(6),0,'------------------------','w',1); prompt(6,'L','<ECON'); prompt(6,'R',ph==='DES'?'DES DIR>':'ENG OUT>');
  },
  lsk(s,n){ if(S.sp) msg('INVALID ENTRY'); }
};

/* ---------- PROG ---------- */
PG.prog={
  draw(){
    const p=S.act, F=fuel(), fl=flyingPlan();
    put(0,1,(S.init.flt||'')+' PROGRESS','w'); putR(0,'1/4 ','w',1);
    lbl(1,'L',' FROM'); put(LR(1),8,'ALT','w',1); put(LR(1),14,'ATA','w',1); putR(LR(1),'FUEL','w',1);
    if(fl&&p.items[0]){ prompt(1,'L',p.items[0].id,'w'); put(DR(1),8,'FL'+p3(Math.round(S.alt/100)),'w'); put(DR(1),14,hhmm(S.utc-6)+'z','w'); putR(DR(1),F&&F.fob!=null?F.fob.toFixed(1):'--.-','w'); }
    lbl(2,'L',''); put(LR(2),9,'DTG','w',1); put(LR(2),14,'ETA','w',1); putR(LR(2),'FUEL','w',1);
    const rows=[]; if(fl){ const t=p.items[1]; if(t&&coord(t)) rows.push([t.id||t.at,dist(S.pos,coord(t))]); const nx=p.items.slice(2).find(x=>isW(x)); if(nx) rows.push([nx.id,remainDist({items:p.items.slice(0,p.items.indexOf(nx)+1)})]); }
    const d=destOf(p); if(d) rows.push([d.id,fl?remainDist(p):totalDist(p)]);
    rows.slice(0,3).forEach(([id,dg],j)=>{ const n=2+j; prompt(n,'L',id,j===0&&fl?'m':'w'); put(DR(n),8,String(Math.round(dg)).padStart(4,' '),'w'); put(DR(n),14,fl?hhmm(S.utc+dg/7.2)+'z':'----z','w'); putR(DR(n),F&&F.fob!=null?(F.fob-0.0058*dg).toFixed(1):'--.-','w'); });
    lbl(5,'L',' TO T/D'); prompt(5,'L',fl&&S.phase==='CRZ'?hhmm(S.utc+8)+'z/ 60NM':'----z/----NM','w');
    lbl(6,'L',' FUEL QTY'); prompt(6,'L',F&&F.fob!=null?'TOTALIZER':'CALCULATED','w'); scr[DR(6)].forEach(x=>x.s=1);
  },
  lsk(){ if(S.sp) msg('INVALID ENTRY'); }
};
/* ---------- FIX ---------- */
PG.fix={
  draw(){ title('FIX INFO'); putR(0,'1/2 ','w',1); lbl(1,'L',' FIX'); lbl(1,'R','RAD/DIS FR '); const f=S.fixId&&P[S.fixId];
    prompt(1,'L',S.fixId||'§§§§§','w'); if(f){ const from=S.phase==='PRE'?P.XNDV:S.pos; prompt(1,'R',p3(brg(f,from))+'/'+dist(f,from).toFixed(1),'w'); }
    lbl(2,'L',' RAD/DIS'); lbl(2,'R','ETA  DTG  ALT '); for(let n=2;n<=4;n++) prompt(n,'L','---/---','w');
    put(LR(6),0,'------------------------','w',1); prompt(6,'L','<ERASE FIX'); },
  lsk(s,n){ const v=S.sp; if(s==='L'&&n===1){ if(!v) return; if(!P[v]){ msg('NOT IN DATA BASE'); return; } S.fixId=v; take(); return; } if(s==='L'&&n===6){ S.fixId=null; return; } if(v) msg('INVALID ENTRY'); }
};


/* =========================================================== flight (LNAV/HDG SEL, sequencing, hold) */
const w180=a=>{ a=((a+180)%360+360)%360; return a-180; };
function stepFlight(dt){
  if(S.phase==='PRE') return;
  const p=S.act; let gs=S.hz?230:(S.phase==='CRZ'?450:290);
  let want=S.trk;
  const t=p.items[1];
  if(S.ap==='HDG') want=S.hdg;
  else if(S.hz){ const h=p.items[1], f=P[h.at]||coord(p.items[0]); const H=S.hz, side=h.turn==='L'?-1:1, leg=(h.time||1)*230/60;
    if(H.st==='in'){ want=brg(S.pos,f); if(dist(S.pos,f)<0.6){ if(S.exitArm){ p.items.splice(1,1); S.hz=null; S.exitArm=false; } else H.st='turn1'; } }
    else if(H.st==='turn1'){ want=S.trk+side*40; if(Math.abs(w180(S.trk-(h.crs+180)))<6){ H.st='out'; H.d=0; } }
    else if(H.st==='out'){ want=h.crs+180; H.d=(H.d||0)+gs*dt/3600; if(H.d>=leg) H.st='turn2'; }
    else if(H.st==='turn2'){ want=S.trk+side*40; if(Math.abs(w180(S.trk-h.crs))<12) H.st='in'; } }
  if(S.ap==='NAV'&&!S.hz&&t&&(isW(t)||t.k==='dest')){ const c=coord(t); if(t.rin!=null){ const C=w360(t.rin+180), d=dist(c,S.pos), off=w180(brg(c,S.pos)-t.rin), xtk=d*Math.sin(off*R2); if(t._q==null) t._q=Math.abs(off)>100?1:0; const Q=along(c,t.rin,10); if(t._q&&dist(S.pos,Q)<1.5) t._q=0; want=t._q?brg(S.pos,Q):C+Math.max(-45,Math.min(45,xtk*25)); } else want=brg(S.pos,c); }
  else if(S.ap==='NAV'&&!S.hz&&(!t||t.k==='disc')){ S.ap='HDG'; S.hdg=Math.round(w360(S.trk)); msg('DISCONTINUITY'); }
  const dturn=w180(want-S.trk), rate=3*dt; S.trk=w360(S.trk+Math.max(-rate,Math.min(rate,dturn)));
  const d=gs*dt/3600; S.pos={x:S.pos.x+d*Math.sin(S.trk*R2),y:S.pos.y+d*Math.cos(S.trk*R2)}; S.utc+=dt/60;
  if(S.fob!=null) S.fob-=(S.hz?2.2:(S.phase==='CRZ'?2.4:1.6))*dt/3600;
  if(!S.flags) S.flags={};
  { const F=fuel(); if(F&&F.efob!=null&&F.efob<F.mdf&&!S.flags.ebm){ S.flags.ebm=1; msg('INSUFFICIENT FUEL'); } }
  if(S.ap==='NAV'&&!S.hz&&t&&(isW(t)||t.k==='dest')){ const c=coord(t), lim=Math.max(0.8,d*1.5);
    const wrongSide=t.rin!=null&&Math.abs(w180(S.trk-(t.rin+180)))>60;
    if(dist(S.pos,c)<lim&&!wrongSide){ if(t.k==='dest'){ S.run=false; msg('END OF ROUTE'); return; }
      p.items.shift(); if(p.items[1]&&p.items[1].k==='hold'&&p.items[1].at===t.id) S.hz={st:'turn1'}; } }
}
function fcu(cmd,val){
  if(!S||S.phase==='PRE') return;
  if(cmd==='hdg'){ S.ap='HDG'; S.hdg=w360(Math.round(val)); }
  else if(cmd==='nav'){ const t=S.act.items[1]; if(t&&t.k!=='disc'&&rteAct()) S.ap='NAV'; else msg('NOT ON INTERCEPT HEADING'); }
  else if(cmd==='run') S.run=!S.run;
}

/* =========================================================== input */
function initRef(){
  if(S.phase!=='PRE') return 'appref';
  if(!S.b.irs) return S.seen.ident?'posinit':'ident';
  if(!rteAct()) return 'rte';
  if(S.fb.zfw==null||S.init.crz==null) return 'perfinit';
  return 'takeoff';
}
const PAGEKEY={INITREF:1,RTE:1,CLB:1,CRZ:1,DES:1,MENU:1,LEGS:1,DEPARR:1,HOLD:1,PROG:1,N1LIM:1,FIX:1};
function press(k){
  if(!S) return;
  if(PAGEKEY[k]){
    if(k!=='HOLD') S.holdAt=false;
    if(k==='INITREF') go(initRef());
    else if(k==='RTE') go('rte',{rpg:1});
    else if(k==='CLB'||k==='CRZ'||k==='DES') go('vnav',{vpg:k});
    else if(k==='MENU'){ if(S.page!=='menu') S.lastFm=S.page; go('menu'); }
    else if(k==='LEGS') go('legs',{lpg:1});
    else if(k==='DEPARR') go('deparr');
    else if(k==='HOLD'){ const p=cur(), i=p.items.findIndex(x=>x.k==='hold'); if(i>0&&S.page!=='hold'){ S.hpg=i; go('hold'); } else { S.holdAt=true; go('legs',{lpg:1}); } }
    else if(k==='PROG') go('prog');
    else if(k==='N1LIM') go('n1');
    else if(k==='FIX') go('fix');
  }
  else if(k==='EXEC'){ if(execLit()) exec(); }
  else if(k==='NEXT'||k==='PREV'){ const pg=PG[S.page]; if(pg&&pg[k==='NEXT'?'next':'prev']) pg[k==='NEXT'?'next':'prev'](); }
  else if(/^[LR][1-6]$/.test(k)){ const pg=PG[S.page]; if(pg&&pg.lsk) pg.lsk(k[0],+k[1]); }
  else if(k==='CLR'){ if(S.msg) S.msg=null; else if(S.sp==='DELETE') S.sp=''; else if(S.sp) S.sp=S.sp.slice(0,-1); }
  else if(k==='CLRALL'){ S.msg=null; S.sp=''; }
  else if(k==='DEL'){ if(!S.sp&&!S.msg) S.sp='DELETE'; }
  else if(k==='PM'){ S.msg=null; if(S.sp==='DELETE') S.sp=''; const l=S.sp.slice(-1); if(l==='-') S.sp=S.sp.slice(0,-1)+'+'; else if(l==='+') S.sp=S.sp.slice(0,-1)+'-'; else if(S.sp.length<22) S.sp+='-'; }
  else { const ch=k==='SP'?' ':k==='SLASH'?'/':k==='DOT'?'.':k; if(ch.length===1){ if(S.msg) S.msg=null; if(S.sp==='DELETE') S.sp=''; if(S.sp.length<22) S.sp+=ch; } }
  S.log.push(k);
  if(S.log.length>400) S.log.shift();
}
function scratch(){ if(S.msg) put(13,0,S.msg.t.slice(0,COLS),'w'); else put(13,0,S.sp.slice(-COLS),'w'); }
function draw(){ cls(); const pg=PG[S.page]||PG.menu; pg.draw(); scratch(); return html(); }

/* =========================================================== scenarios */
function buildPrep(st){
  /* a complete, correct preflight (used as the starting point for later scenarios) */
  S.act=newPlan('XNDV','XSKH');
  setDeparture(S.act,'19','ROKUS1A',null);
  const i=S.act.items.findIndex(x=>isW(x)&&x.id==='ROKUS'); addAirways(S.act,i,[{via:'M611',to:'HVL'},{via:'L44',to:'ODRUP'}]);
  S.rte='act'; S.seen.ident=1;
  Object.assign(S.init,{flt:'NDP101',ci:30,crz:350});
  Object.assign(S.b,{ref:'XNDV',irs:true,res:2.6,tocg:22.5});
  S.fb.zfw=58.4; S.perf.ta=7000; S.perf.flaps=5; S.n1.sel=52;
  if(st) st(S);
  const c=toSpeeds(); if(c) Object.assign(S.perf,c);
}
function fly(toId,frac,phase,alt){
  /* place the aircraft on the leg into toId; items before the FROM waypoint are sequenced */
  const p=S.act, j=p.items.findIndex(x=>isW(x)&&x.id===toId); const prev=p.items.slice(0,j).reverse().find(x=>coord(x));
  const pi=p.items.indexOf(prev); p.items=p.items.slice(pi);
  const F0=fuel();
  const a=coord(prev), b=coord(p.items[1]); S.pos={x:a.x+(b.x-a.x)*frac,y:a.y+(b.y-a.y)*frac};
  S.phase=phase||'CRZ'; S.alt=alt||35000; S.trk=brg(S.pos,b); S.hdg=Math.round(S.trk);
  if(F0&&S.fb.block!=null){ const flown=Math.max(0,F0.dist-remainDist(S.act)); S.fob=+(S.fb.block-S.fb.taxi-F0.trip*Math.min(1,flown/F0.dist)).toFixed(2); }
}
const tt=(en,no)=>({en,no});
const has=(p,id)=>p.items.some(x=>isW(x)&&x.id===id);
const noMod=()=>!S.tmpy;
const spdOk=()=>{ const c=toSpeeds(), P_=S.perf; return !!c&&P_.v1===c.v1&&P_.vr===c.vr&&P_.v2===c.v2; };
const SCN=[
 {id:'prep',cat:'pre',
  t:tt('Preflight: set up the FMC','Preflight: sett opp FMC-en'),
  d:tt('The whole FMC preflight in the standard order: IDENT, POS INIT, RTE, DEPARTURES, PERF INIT, N1 LIMIT and TAKEOFF REF. The prompt at the bottom right (6R) takes you to the next page.','Hele FMC-preflighten i standardrekkefølgen: IDENT, POS INIT, RTE, DEPARTURES, PERF INIT, N1 LIMIT og TAKEOFF REF. Prompten nederst til høyre (6R) tar deg til neste side.'),
  setup(){ go('ident'); },
  docs:['ofp','load','perf','clr'],
  steps:[
   {t:tt('IDENT: check the model and that the active nav database is current. Then POS INIT (6R).','IDENT: sjekk modellen og at den aktive navigasjonsdatabasen er gyldig. Så POS INIT (6R).'),keys:['R6'],ok:()=>!!S.seen.posinit},
   {t:tt('REF AIRPORT XNDV (2L).','REF AIRPORT XNDV (2L).'),keys:['L2'],type:'XNDV',ok:()=>S.b.ref==='XNDV'},
   {t:tt('Copy the GPS position to the scratchpad (4R), then put it in SET IRS POS (5R).','Kopier GPS-posisjonen til scratchpad (4R), og legg den i SET IRS POS (5R).'),keys:['R4','R5'],ok:()=>S.b.irs},
   {t:tt('ROUTE (6R). RTE page 1: ORIGIN XNDV (1L).','ROUTE (6R). RTE side 1: ORIGIN XNDV (1L).'),keys:['R6','L1'],type:'XNDV',ok:()=>S.act.from==='XNDV'},
   {t:tt('DEST XSKH (1R).','DEST XSKH (1R).'),keys:['R1'],type:'XSKH',ok:()=>S.act.to==='XSKH'},
   {t:tt('FLT NO. NDP101 (2R).','FLT NO. NDP101 (2R).'),keys:['R2'],type:'NDP101',ok:()=>S.init.flt==='NDP101'},
   {t:tt('NEXT PAGE to RTE page 2. First line: TO ROKUS (1R). VIA becomes DIRECT.','NEXT PAGE til RTE side 2. Første linje: TO ROKUS (1R). VIA blir DIRECT.'),keys:['NEXT','R1'],type:'ROKUS',ok:()=>has(cur(),'ROKUS')},
   {t:tt('Next line: VIA M611 (2L), then TO HVL (2R).','Neste linje: VIA M611 (2L), så TO HVL (2R).'),keys:['L2','R2'],type:'M611 · HVL',ok:()=>has(cur(),'GAPOT')&&has(cur(),'HVL')},
   {t:tt('VIA L44 (3L), then TO ODRUP (3R). Check the route against the OFP.','VIA L44 (3L), så TO ODRUP (3R). Sjekk ruten mot OFP-en.'),keys:['L3','R3'],type:'L44 · ODRUP',ok:()=>has(cur(),'SELKA')&&has(cur(),'ODRUP')},
   {t:tt('ACTIVATE (6R). The EXEC light comes on: press EXEC. The title now says ACT RTE 1.','ACTIVATE (6R). EXEC-lyset tennes: trykk EXEC. Tittelen viser nå ACT RTE 1.'),keys:['R6','EXEC'],ok:()=>S.rte==='act'&&noMod()},
   {t:tt('DEP ARR, <DEP (1L): runway 19 (R2), then SID ROKUS1A (L1). Check the MOD route and EXEC.','DEP ARR, <DEP (1L): rullebane 19 (R2), så SID ROKUS1A (L1). Sjekk MOD-ruten og EXEC.'),keys:['DEPARR','L1','R2','L1','EXEC'],ok:()=>S.act.dRwy==='19'&&S.act.sid==='ROKUS1A'&&noMod()},
   {t:tt('LEGS: page through with NEXT PAGE and check the waypoints, courses and distances against the OFP.','LEGS: bla med NEXT PAGE og sjekk waypointene, kursene og distansene mot OFP-en.'),keys:['LEGS','NEXT'],ok:()=>S.seen.legs&&S.log.includes('NEXT')&&S.log.lastIndexOf('NEXT')>S.log.lastIndexOf('LEGS')},
   {t:tt('PERF INIT (INIT REF): ZFW 58.4 (3L). The FMC adds the fuel and shows the gross weight at 1L.','PERF INIT (INIT REF): ZFW 58.4 (3L). FMC-en legger til drivstoffet og viser bruttovekten på 1L.'),keys:['INITREF','L3'],type:'58.4',ok:()=>S.fb.zfw===58.4},
   {t:tt('RESERVES 2.6 (4L) and COST INDEX 30 (5L).','RESERVES 2.6 (4L) og COST INDEX 30 (5L).'),keys:['L4','L5'],type:'2.6 · 30',ok:()=>S.b.res===2.6&&S.init.ci===30},
   {t:tt('CRZ ALT FL350 (1R), then EXEC.','CRZ ALT FL350 (1R), så EXEC.'),keys:['R1','EXEC'],type:'FL350',ok:()=>S.init.crz===350&&!S.perfPend},
   {t:tt('N1 LIMIT (6R): assumed temperature 52 in SEL (1L) for a reduced take-off.','N1 LIMIT (6R): antatt temperatur 52 i SEL (1L) for redusert avgang.'),keys:['R6','L1'],type:'52',ok:()=>S.n1.sel===52},
   {t:tt('TAKEOFF (6R): FLAPS 5 (1L) and CG 22.5 (3L). The stab trim appears beside the CG.','TAKEOFF (6R): FLAPS 5 (1L) og CG 22.5 (3L). Stab trim vises ved siden av CG.'),keys:['R6','L1','L3'],type:'5 · 22.5',ok:()=>S.perf.flaps===5&&S.b.tocg===22.5},
   {t:tt('V1, VR and V2 are computed in small letters. Select each one with its key (1R, 2R, 3R) so it turns large, and check them against the take-off data. PRE-FLT COMPLETE.','V1, VR og V2 er beregnet med små bokstaver. Velg hver av dem med tasten (1R, 2R, 3R) så de blir store, og sjekk dem mot take-off-dataene. PRE-FLT COMPLETE.'),keys:['R1','R2','R3'],ok:()=>spdOk()&&!preMiss()}
  ]},
 {id:'xchk',cat:'pre',
  t:tt('FMC crosscheck (PM)','FMC-kryssjekk (PM)'),
  d:tt('The captain has set up the FMC. You check every page against the paperwork and correct what is wrong. Three entries are wrong.','Kapteinen har satt opp FMC-en. Du sjekker hver side mot papirene og retter det som er feil. Tre verdier er feil.'),
  setup(){ buildPrep(s=>{ s.fb.zfw=54.8; s.init.crz=330; s.n1.sel=25; }); go('rte',{rpg:1}); },
  docs:['ofp','load','perf'],
  steps:[
   {t:tt('RTE and LEGS: check origin, destination, runway, SID and route against the OFP.','RTE og LEGS: sjekk origin, destinasjon, rullebane, SID og rute mot OFP-en.'),keys:['RTE','NEXT','LEGS'],ok:()=>!!S.seen.legs},
   {t:tt('PERF INIT (INIT REF, <INDEX, PERF): check ZFW against the loadsheet and correct it.','PERF INIT (INIT REF, <INDEX, PERF): sjekk ZFW mot loadsheeten og rett den.'),keys:['INITREF','L6','L3','L3'],type:'58.4',hint2:tt('ZFW 54.8 has its digits swapped: the loadsheet says 58.4.','ZFW 54.8 har byttet om sifrene: loadsheeten sier 58.4.'),ok:()=>S.fb.zfw===58.4},
   {t:tt('CRZ ALT against the OFP, then EXEC.','CRZ ALT mot OFP-en, så EXEC.'),keys:['R1','EXEC'],type:'FL350',hint2:tt('The OFP says FL350.','OFP-en sier FL350.'),ok:()=>S.init.crz===350&&!S.perfPend},
   {t:tt('N1 LIMIT: SEL against the take-off data.','N1 LIMIT: SEL mot take-off-dataene.'),keys:['N1LIM','L1'],type:'52',hint2:tt('SEL 25 is wrong: the take-off data says 52.','SEL 25 er feil: take-off-dataene sier 52.'),ok:()=>S.n1.sel===52},
   {t:tt('TAKEOFF REF: the corrections deleted the V-speeds. Select the new ones (1R–3R) and check them against the card.','TAKEOFF REF: rettingene slettet V-hastighetene. Velg de nye (1R–3R) og sjekk dem mot kortet.'),keys:['N1LIM','R6','R1','R2','R3'],ok:()=>S.fb.zfw===58.4&&S.init.crz===350&&S.n1.sel===52&&spdOk()}
  ]},
 {id:'rwy',cat:'pre',
  t:tt('Runway change before take-off','Rullebanebytte før avgang'),
  d:tt('Ready for runway 19. ATC: “NDP101, runway change, runway 01, ROKUS1B departure.” Change the departure, then the take-off data.','Klar for rullebane 19. ATC: «NDP101, runway change, runway 01, ROKUS1B departure.» Endre avgangen, og så take-off-dataene.'),
  setup(){ buildPrep(); go('takeoff'); },
  docs:['clr2','perf2'],
  steps:[
   {t:tt('DEP ARR, <DEP: select runway 01 (R1). The SID list shows the SIDs for runway 01.','DEP ARR, <DEP: velg rullebane 01 (R1). SID-listen viser SID-ene for rullebane 01.'),keys:['DEPARR','L1','R1'],ok:()=>cur().dRwy==='01'},
   {t:tt('Select ROKUS1B (L1). Check the MOD route on LEGS, then EXEC.','Velg ROKUS1B (L1). Sjekk MOD-ruten på LEGS, så EXEC.'),keys:['L1','EXEC'],ok:()=>S.act.dRwy==='01'&&S.act.sid==='ROKUS1B'&&noMod()},
   {t:tt('TAKEOFF SPEEDS DELETED: the speeds belonged to runway 19. N1 LIMIT: SEL 48 (1L) for runway 01.','TAKEOFF SPEEDS DELETED: hastighetene hørte til rullebane 19. N1 LIMIT: SEL 48 (1L) for rullebane 01.'),keys:['N1LIM','L1'],type:'48',ok:()=>S.n1.sel===48},
   {t:tt('TAKEOFF REF: check runway 01 at 4L, then select V1, VR and V2 again.','TAKEOFF REF: sjekk rullebane 01 på 4L, og velg V1, VR og V2 på nytt.'),keys:['R6','R1','R2','R3'],ok:()=>S.act.dRwy==='01'&&S.n1.sel===48&&spdOk()}
  ]},
 {id:'dct',cat:'fly',
  t:tt('Direct to a waypoint','Direkte til et waypoint'),
  d:tt('Cruise at FL350 towards HVL. ATC: “NDP101, proceed direct ODRUP.”','Marsj i FL350 mot HVL. ATC: «NDP101, proceed direct ODRUP.»'),
  setup(){ buildPrep(); fly('HVL',0.4); go('legs',{lpg:1}); },
  docs:['atc_dct'],
  steps:[
   {t:tt('LEGS: copy ODRUP to the scratchpad (press its key with an empty scratchpad), or type it.','LEGS: kopier ODRUP til scratchpad (trykk tasten ved den med tom scratchpad), eller skriv det.'),keys:['LEGS'],type:'ODRUP',ok:()=>S.sp==='ODRUP'||(S.tmpy&&S.tmpy.dir)||S.act.items[1].id==='ODRUP'},
   {t:tt('Put it on 1L, the active waypoint. The title shows MOD and the dashed white line on the ND shows the new path.','Legg det på 1L, det aktive waypointet. Tittelen viser MOD, og den hvite stiplede linjen på ND-en viser den nye veien.'),keys:['L1'],ok:()=>(S.tmpy&&S.tmpy.plan.items[1].id==='ODRUP')||S.act.items[1].id==='ODRUP'},
   {t:tt('Check, then EXEC. The aircraft turns towards ODRUP.','Sjekk, så EXEC.  Flyet svinger mot ODRUP.'),keys:['EXEC'],ok:()=>S.act.items[1].id==='ODRUP'&&S.act.items[0].id==='T-P'&&noMod()}
  ]},
 {id:'intc',cat:'fly',
  t:tt('Intercept a course to a waypoint','Intercept en kurs til et waypoint'),
  d:tt('Descending on the ODRUP2W for the ILS25. ATC: “NDP101, intercept the 250 course to SK255.” Build it in the FMC so LNAV flies the intercept and you see the final course on the ND.','Nedstigning på ODRUP2W for ILS25. ATC: «NDP101, intercept the 250 course to SK255.» Lag det i FMC-en så LNAV flyr interceptet og du ser finalkursen på ND-en.'),
  setup(){ buildPrep(); setArrival(S.act,'ILS25','ODRUP2W','SK260'); fly('TOLKA',0.5,'DES',11000); go('legs',{lpg:1}); },
  docs:['atc_intc'],
  steps:[
   {t:tt('LEGS: type SK255 and put it on 1L.','LEGS: skriv SK255 og legg det på 1L.'),keys:['L1'],type:'SK255',ok:()=>(S.tmpy&&S.tmpy.dir&&S.tmpy.plan.items[1].id==='SK255')||S.act.items[1].id==='SK255'},
   {t:tt('INTC CRS appears at 6R. Type 250 and press 6R.','INTC CRS vises på 6R. Skriv 250 og trykk 6R.'),keys:['R6'],type:'250',ok:()=>(S.tmpy&&S.tmpy.intc===250)||(S.act.items[1].id==='SK255'&&S.act.items[1].rin===70)},
   {t:tt('EXEC. The ND shows the 250 course into SK255.','EXEC. ND-en viser 250-kursen inn til SK255.'),keys:['EXEC'],ok:()=>S.act.items[1].id==='SK255'&&S.act.items[1].rin===70&&noMod()}
  ]},
 {id:'app',cat:'fly',
  t:tt('Select the arrival and approach','Velg arrival og innflyging'),
  d:tt('Cruise at FL350 before ODRUP. ATIS Skarhamn: runway 25 in use, ILS approach. Expect ODRUP2W arrival, transition SK260.','Marsj i FL350 før ODRUP. ATIS Skarhamn: rullebane 25 i bruk, ILS-innflyging. Forvent ODRUP2W arrival, transition SK260.'),
  setup(){ buildPrep(); fly('SELKA',0.5); go('legs',{lpg:1}); },
  docs:['atis'],
  steps:[
   {t:tt('DEP ARR, then ARR> for XSKH (2R).','DEP ARR, så ARR> for XSKH (2R).'),keys:['DEPARR','R2'],ok:()=>S.page==='arr'||(S.tmpy&&S.tmpy.plan.appr)||S.act.appr==='ILS25'},
   {t:tt('Select the approach ILS25 on the right (R2).','Velg innflygingen ILS25 til høyre (R2).'),keys:['R2'],ok:()=>cur().appr==='ILS25'},
   {t:tt('Select the transition SK260, now listed under ILS25 (R3).','Velg transition SK260, som nå står under ILS25 (R3).'),keys:['R3'],ok:()=>cur().via==='SK260'},
   {t:tt('Select the STAR ODRUP2W on the left. The list only shows STARs for runway 25.','Velg STAR-en ODRUP2W til venstre. Listen viser bare STAR-er for rullebane 25.'),keys:['L2'],ok:()=>cur().star==='ODRUP2W'},
   {t:tt('Check the MOD route on LEGS (no discontinuity between the STAR and the approach), then EXEC.','Sjekk MOD-ruten på LEGS (ingen diskontinuitet mellom STAR-en og innflygingen), så EXEC.'),keys:['LEGS','EXEC'],ok:()=>S.act.appr==='ILS25'&&S.act.star==='ODRUP2W'&&S.act.via==='SK260'&&noMod()}
  ]},
 {id:'disc',cat:'fly',
  t:tt('Close a route discontinuity','Lukk en rutediskontinuitet'),
  d:tt('The ILS25 was selected without a transition, so there is a ROUTE DISCONTINUITY between SK260 and SK255. ATC clears you via SK260 and SK255. Close it.','ILS25 ble valgt uten transition, så det er en ROUTE DISCONTINUITY mellom SK260 og SK255. ATC klarerer deg via SK260 og SK255. Lukk den.'),
  setup(){ buildPrep(); setArrival(S.act,'ILS25','ODRUP2W',null); fly('SELKA',0.8,'DES',30000); go('legs',{lpg:1}); },
  docs:['atc_disc'],
  steps:[
   {t:tt('LEGS: NEXT PAGE until you see the boxes and – ROUTE DISCONTINUITY –.','LEGS: NEXT PAGE til du ser boksene og – ROUTE DISCONTINUITY –.'),keys:['NEXT'],ok:()=>{ if(closed()) return true; const rows=legsRows(), pg=S.lpg||1; return S.page==='legs'&&rows.slice((pg-1)*5,pg*5).some(r=>r.it.k==='disc'); }},
   {t:tt('Press the key beside SK255 (under the boxes) with an empty scratchpad: SK255 is copied to the scratchpad.','Trykk tasten ved SK255 (under boksene) med tom scratchpad: SK255 kopieres til scratchpad.'),keys:[],ok:()=>S.sp==='SK255'||closed()},
   {t:tt('Press the key beside the boxes. The discontinuity is gone in the MOD route.','Trykk tasten ved boksene. Diskontinuiteten er borte i MOD-ruten.'),keys:[],ok:()=>closed(cur())},
   {t:tt('Check, then EXEC.','Sjekk, så EXEC.'),keys:['EXEC'],ok:()=>closed(S.act)&&noMod()}
  ]},
 {id:'hold',cat:'fly',
  t:tt('Enter a holding','Legg inn en holding'),
  d:tt('Cruise towards ODRUP. ATC: “NDP101, hold at ODRUP, inbound course 230, left turns, one-minute legs, expect further clearance at 50.”','Marsj mot ODRUP. ATC: «NDP101, hold at ODRUP, inbound course 230, left turns, one-minute legs, expect further clearance at 50.»'),
  setup(){ buildPrep(); fly('SELKA',0.6); go('legs',{lpg:1}); },
  docs:['atc_hold'],
  steps:[
   {t:tt('Press HOLD. LEGS shows HOLD AT with boxes at 6L.','Trykk HOLD. LEGS viser HOLD AT med bokser på 6L.'),keys:['HOLD'],ok:()=>S.holdAt||cur().items.some(x=>x.k==='hold')},
   {t:tt('Type ODRUP (or copy it from its line) and press 6L. The HOLD page opens as a MOD.','Skriv ODRUP (eller kopier det fra linjen) og trykk 6L. HOLD-siden åpnes som MOD.'),keys:['L6'],type:'ODRUP',ok:()=>cur().items.some(x=>x.k==='hold'&&x.at==='ODRUP')},
   {t:tt('INBD CRS/DIR 230/L (3L) and LEG TIME 1 (4L). Above FL140 the default is 1.5 minutes.','INBD CRS/DIR 230/L (3L) og LEG TIME 1 (4L). Over FL140 er standard 1.5 minutter.'),keys:['L3','L4'],type:'230/L · 1',ok:()=>{ const h=cur().items.find(x=>x.k==='hold'); return h&&h.crs===230&&h.turn==='L'&&h.time===1; }},
   {t:tt('EFC TIME 0050 (3R), then EXEC.','EFC TIME 0050 (3R), så EXEC.'),keys:['R3','EXEC'],type:'0050',ok:()=>{ const h=S.act.items.find(x=>x.k==='hold'); return h&&h.at==='ODRUP'&&h.crs===230&&h.turn==='L'&&h.time===1&&noMod(); }}
  ]},
 {id:'cstr',cat:'fly',
  t:tt('Altitude and speed constraint','Høyde- og fartsrestriksjon'),
  d:tt('Cruise towards SELKA. ATC: “NDP101, cross ODRUP at FL110, speed 250 knots.” Put it on the LEGS page.','Marsj mot SELKA. ATC: «NDP101, cross ODRUP at FL110, speed 250 knots.» Legg det inn på LEGS-siden.'),
  setup(){ buildPrep(); fly('SELKA',0.3); go('legs',{lpg:1}); },
  docs:['atc_cstr'],
  steps:[
   {t:tt('LEGS: type 250/FL110 and press the RIGHT key beside ODRUP (2R).','LEGS: skriv 250/FL110 og trykk HØYRE tast ved ODRUP (2R).'),keys:['LEGS','R2'],type:'250/FL110',ok:()=>cur().items.some(x=>x.id==='ODRUP'&&x.alt==='FL110'&&x.spd===250)},
   {t:tt('The constraint shows in large letters in the MOD route. EXEC.','Restriksjonen vises med store bokstaver i MOD-ruten. EXEC.'),keys:['EXEC'],ok:()=>S.act.items.some(x=>x.id==='ODRUP'&&x.alt==='FL110'&&x.spd===250)&&noMod()}
  ]},
 {id:'altn',cat:'fly',
  t:tt('Divert to another airport','Diverter til en annen flyplass'),
  d:tt('Cruise towards HVL. Company: “Skarhamn is closed, divert to Fjellby, ILS 34.”','Marsj mot HVL. Selskapet: «Skarhamn er stengt, diverter til Fjellby, ILS 34.»'),
  setup(){ buildPrep(); fly('HVL',0.5); go('rte',{rpg:1}); },
  docs:['atc_altn'],
  steps:[
   {t:tt('RTE page 1: DEST XFJB (1R). The route ends with a discontinuity before XFJB.','RTE side 1: DEST XFJB (1R). Ruten slutter med en diskontinuitet før XFJB.'),keys:['RTE','R1'],type:'XFJB',ok:()=>destOf(cur()).id==='XFJB'},
   {t:tt('EXEC.','EXEC.'),keys:['EXEC'],ok:()=>destOf(S.act).id==='XFJB'&&noMod()},
   {t:tt('DEP ARR, ARR> for XFJB (2R), ILS34 (R1), EXEC.','DEP ARR, ARR> for XFJB (2R), ILS34 (R1), EXEC.'),keys:['DEPARR','R2','R1','EXEC'],ok:()=>S.act.appr==='ILS34'&&noMod()},
   {t:tt('PROG: check the distance and fuel at XFJB.','PROG: sjekk distansen og drivstoffet ved XFJB.'),keys:['PROG'],ok:()=>S.page==='prog'&&S.act.appr==='ILS34'}
  ]},
 {id:'appref',cat:'fly',
  t:tt('APPROACH REF and VREF','APPROACH REF og VREF'),
  d:tt('Descending on the ODRUP2W for the ILS25. Landing flaps 30. Set the approach speed in the FMC.','Nedstigning på ODRUP2W for ILS25. Landingsklaff 30. Sett innflygingsfarten i FMC-en.'),
  setup(){ buildPrep(); setArrival(S.act,'ILS25','ODRUP2W','SK260'); fly('TOLKA',0.3,'DES',14000); go('legs',{lpg:1}); },
  docs:['atis2'],
  steps:[
   {t:tt('INIT REF. In flight it opens APPROACH REF, with VREF for flaps 15, 30 and 40 for the landing weight.','INIT REF. I lufta åpner den APPROACH REF, med VREF for klaff 15, 30 og 40 for landingsvekten.'),keys:['INITREF'],ok:()=>S.page==='appref'||!!S.b.app},
   {t:tt('Press 2R (flaps 30): it is copied to the scratchpad.','Trykk 2R (klaff 30): den kopieres til scratchpad.'),keys:['R2'],ok:()=>/^30\/\d{3}$/.test(S.sp)||(S.b.app&&S.b.app.f===30)},
   {t:tt('Press 4R FLAP/SPD. VREF 30 now shows on the speed tape. Minimums and QNH are set on the EFIS control panel, not in the FMC.','Trykk 4R FLAP/SPD. VREF 30 vises nå på fartsbåndet. Minima og QNH settes på EFIS-panelet, ikke i FMC-en.'),keys:['R4'],ok:()=>S.b.app&&S.b.app.f===30&&S.b.app.v===vrefs().v30}
  ]},
 {id:'drill',cat:'hidden',t:tt('Find the field','Finn feltet'),d:tt('Find the page and the line key for each field.','Finn siden og linjetasten for hvert felt.'),setup(){ buildPrep(); go('ident'); },docs:[],steps:[]},
 {id:'free',cat:'free',
  t:tt('Free practice','Fri trening'),
  d:tt('An empty FMC on the ground at XNDV. Use the paperwork and set it up yourself, or try any page.','En tom FMC på bakken på XNDV. Bruk papirene og sett den opp selv, eller prøv hvilken som helst side.'),
  setup(){ go('ident'); }, docs:['ofp','load','perf','clr'], steps:[]}
];
function closed(p){ p=p||S.act; const it=p.items, i=it.findIndex(x=>isW(x)&&x.id==='SK260'); return i>=0&&it[i+1]&&isW(it[i+1])&&it[i+1].id==='SK255'; }

/* paperwork shown beside the CDU (fictional, for training) */
function docHtml(k){
  const no=isNo();
  const D={
    ofp:['OFP',`NDP101  XNDV → XSKH
B737-800     CI 30     FL350
ROUTE  ROKUS1A ROKUS M611 HVL L44 ODRUP
       (arrival to be assigned)
RESERVES 2.6 t     DIST 245 NM`],
    load:[no?'Loadsheet':'Loadsheet',`ZFW     58.4 t
FUEL     7.8 t
TOW     66.0 t      CG 22.5 %MAC`],
    perf:[no?'Take-off-data':'Take-off data',`XNDV  RWY 19
FLAPS 5     SEL TEMP 52 °C   26K
V1 137   VR 140   V2 144
CG 22.5 %`],
    perf2:[no?'Take-off-data, nye':'Take-off data, new',`XNDV  RWY 01
FLAPS 5     SEL TEMP 48 °C   26K
V1 137   VR 140   V2 144`],
    clr:['ATC',`NDP101 cleared to Skarhamn,
runway 19, ROKUS1A departure,
climb FL060, squawk 4521`],
    clr2:['ATC',`NDP101, runway change,
runway 01, ROKUS1B departure,
rest unchanged`],
    atc_dct:['ATC','NDP101, proceed direct ODRUP'],
    atc_intc:['ATC',`NDP101, intercept the
250 course to SK255`],
    atc_cstr:['ATC',`NDP101, cross ODRUP at FL110,
speed 250 knots`],
    atc_hold:['ATC',`NDP101, hold at ODRUP,
inbound course 230, left turns,
one-minute legs,
expect further clearance at 50`],
    atc_disc:['ATC',`NDP101, cleared ODRUP2W arrival,
then via SK260 and SK255
for the ILS runway 25`],
    atc_altn:[no?'Selskapet':'Company',`Skarhamn closed until 1700.
Divert to Fjellby (XFJB), ILS 34.`],
    atis:['ATIS XSKH',`SKARHAMN INFO C
RWY 25 IN USE, ILS APPROACH
EXPECT ODRUP2W, TRANSITION SK260
240/15 9999 FEW030 04/M01 Q1008`],
    atis2:['ATIS XSKH',`SKARHAMN INFO C
RWY 25 IN USE, ILS APPROACH
240/15 9999 FEW030 04/M01 Q1008
LANDING FLAPS 30, ILS 25 DA 380 FT`]
  };
  const d=D[k]; if(!d) return '';
  return `<div class="mdoc"><b>${esc(d[0])}</b><pre>${esc(d[1])}</pre></div>`;
}

/* =========================================================== UI */
const el=id=>document.getElementById(id);
/* =========================================================== ND (PLAN mode) */
/* North up. On LEGS it is centred on the first waypoint of the page (like the <CTR> step in plan mode); in flight on page 1 on the aircraft.
   Magenta = active route, white dashed = MOD, cyan dashed = inactive route and missed approach. */
const RANGES=[10,20,40,80,160,320];
let NDR=2, NDC=null;
function ndCentre(){
  const fl=S.phase!=='PRE';
  if(S.page==='legs'&&!(fl&&(S.lpg||1)===1)){ const rows=legsRows(), pg=S.lpg||1; for(const r of rows.slice((pg-1)*5,pg*5)){ const c=coord(r.it); if(c&&r.it.id!=='T-P'){ NDC={x:c.x,y:c.y}; return NDC; } } }
  if(S.page==='hold'){ const h=cur().items[S.hpg]; if(h&&h.k==='hold'){ const f=coord(cur().items[S.hpg-1])||P[h.at]; if(f){ NDC={x:f.x,y:f.y}; return NDC; } } }
  if(fl) return NDC={x:S.pos.x,y:S.pos.y};
  if(S.page==='arr'){ const d=destOf(cur()); if(d&&P[d.id]) return NDC={x:P[d.id].x,y:P[d.id].y}; }
  if(NDC&&S.page!=='legs') return NDC;
  return NDC={x:0,y:0};
}
function ndSvg(){
  const R=170, cx=200, cy=205, rng=RANGES[NDR], k=R/(rng/2), c=ndCentre();
  const X=p=>cx+(p.x-c.x)*k, Y=p=>cy-(p.y-c.y)*k, IN=p=>Math.hypot(X(p)-cx,Y(p)-cy)<R-6;
  const out=[];
  out.push(`<defs><clipPath id="ndc"><circle cx="${cx}" cy="${cy}" r="${R+12}"/></clipPath></defs>`);
  out.push(`<rect width="400" height="410" fill="#030604"/>`);
  out.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#ECEFF1" stroke-width="1.2"/><circle cx="${cx}" cy="${cy}" r="${R/2}" fill="none" stroke="#ECEFF1" stroke-width="1" stroke-dasharray="3 5" opacity=".7"/>`);
  for(const a of [0,90,180,270]){ const s=Math.sin(a*R2), co=Math.cos(a*R2); out.push(`<line x1="${cx+s*(R-8)}" y1="${cy-co*(R-8)}" x2="${cx+s*(R+8)}" y2="${cy-co*(R+8)}" stroke="#ECEFF1"/>`); }
  out.push(`<text x="${cx}" y="${cy-R-14}" class="ndt w" text-anchor="middle">N</text><text x="${cx+R/2*0.71+4}" y="${cy-R/2*0.71-4}" class="ndt c">${rng/4}</text>`);
  out.push(`<g clip-path="url(#ndc)">`);
  /* navaids and airports in the area (small, for orientation) */
  for(const id in P){ const p=P[id]; if(p.t==='VOR'){ out.push(`<g transform="translate(${X(p)},${Y(p)})" opacity=".55"><path d="M-5 0L-2.5-4.3h5L5 0l-2.5 4.3h-5z" fill="none" stroke="#F45BFF" stroke-width="1"/></g>`); } }
  const lines=[], marks=[], labels=new Set();
  const plan=(p,col,dash,w,tag)=>{
    if(!p||!p.items||!p.items.length) return;
    let prev=null, segs=[], cur=[];
    const fl=flyingPlan()&&tag==='act';
    p.items.forEach((it,i)=>{
      if(it.k==='disc'){ if(cur.length>1) segs.push(cur); cur=[]; prev=null; return; }
      if(it.k==='hold'){ const f=P[it.at]; if(f) lines.push(holdPath(f,it,X,Y,col,dash)); return; }
      const q=coord(it); if(!q) return;
      cur.push(q); prev=q;
      if(it.k==='wpt'&&it.id!=='T-P'&&IN(q)){ const lc=tag==='act'?(fl&&i===1&&rteAct()?'#F45BFF':'#ECEFF1'):col; marks.push(`<g transform="translate(${X(q)},${Y(q)})"><path d="M0-5L5 0 0 5-5 0z" fill="none" stroke="${lc}" stroke-width="1.4"/></g>`); if(!labels.has(it.id+tag)){ labels.add(it.id+tag); marks.push(`<text x="${X(q)+8}" y="${Y(q)+4}" class="ndt" fill="${lc}">${esc(it.id)}${it.ov?'Δ':''}</text>`); } }
      if(it.rin!=null){ const o=along(q,it.rin,Math.min(rng*0.6,25)); lines.push(`<line x1="${X(q)}" y1="${Y(q)}" x2="${X(o)}" y2="${Y(o)}" stroke="${col}" stroke-width="${w}" stroke-dasharray="6 5"/>`); }
    });
    if(cur.length>1) segs.push(cur);
    for(const sg of segs) lines.push(`<polyline points="${sg.map(q=>X(q).toFixed(1)+','+Y(q).toFixed(1)).join(' ')}" fill="none" stroke="${col}" stroke-width="${w}" ${dash?`stroke-dasharray="${dash}"`:''} stroke-linejoin="round"/>`);
    /* missed approach */
    const d=destOf(p); if(p.miss&&p.miss.length&&d){ let a=coord(d); for(const m of p.miss){ const b=coord(m); if(a&&b) lines.push(`<line x1="${X(a)}" y1="${Y(a)}" x2="${X(b)}" y2="${Y(b)}" stroke="#3CC8F5" stroke-width="1.6" stroke-dasharray="6 5"/>`); if(b&&IN(b)) marks.push(`<text x="${X(b)+8}" y="${Y(b)+4}" class="ndt c">${esc(m.id)}</text>`); a=b; } }
  };
  const act=S.act, tm=S.tmpy;
  plan(act,rteAct()?'#F45BFF':'#3CC8F5',rteAct()?null:'7 5',2.2,'act');
  if(tm) plan(tm.plan,'#ECEFF1','8 5',2.2,'tmp');
  /* alternate */
  const al=act.altn||S.init.altn, dd=destOf(act); if(al&&dd&&P[al]&&dd.id!==al){ const a=coord(dd), b=P[al]; lines.push(`<line x1="${X(a)}" y1="${Y(a)}" x2="${X(b)}" y2="${Y(b)}" stroke="#3CC8F5" stroke-width="1.4" stroke-dasharray="4 6" opacity=".8"/>`); }
  /* airports with the runway in use */
  for(const a in AP){ const A=AP[a], p=P[a]; let rw=null; if(act.from===a&&act.dRwy) rw=act.dRwy; const de=destOf(act); if(de&&de.id===a&&de.rwy) rw=de.rwy;
    const rws=rw?[rw]:Object.keys(A.rwy).slice(0,1);
    for(const r of rws){ const R_=A.rwy[r], h=R_.len/1852/2, t1=along(p,R_.crs+180,h), t2=along(p,R_.crs,h); marks.push(`<line x1="${X(t1)}" y1="${Y(t1)}" x2="${X(t2)}" y2="${Y(t2)}" stroke="#ECEFF1" stroke-width="${rw?3:2}"/>`); }
    if(IN(p)) marks.push(`<text x="${X(p)+9}" y="${Y(p)+14}" class="ndt w">${a}${rw?rw:''}</text>`); }
  /* pseudo waypoints along the active route */
  { const V=!S.tmpy&&rteAct()?vprof():null; if(V){ const it=act.items; for(const ps of V.ps){ let k=-1; for(let i=1;i<it.length;i++){ if(V.cum[i]!=null&&coord(it[i])&&V.cum[i]>=ps.d){ k=i; break; } } if(k<1) continue; let j=k-1; while(j>0&&!coord(it[j])) j--; const a=j===0&&V.fl?S.pos:coord(it[j]), b=coord(it[k]); if(!a||!b||it[k-1].k==='disc') continue; const seg=(V.cum[k]-(j===0&&V.fl?0:V.cum[j]))||1, f=Math.max(0,Math.min(1,1-(V.cum[k]-ps.d)/seg)); const q={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f}; if(!IN(q)) continue; const col=ps.decel?'#F45BFF':'#3BE37A'; marks.push(`<circle cx="${X(q)}" cy="${Y(q)}" r="3.2" fill="none" stroke="${col}" stroke-width="1.4"/><text x="${X(q)+6}" y="${Y(q)-6}" class="ndt" style="font-size:11px" fill="${col}">${esc(ps.n.replace(/[()]/g,''))}</text>`); } } }
  out.push(lines.join(''), marks.join(''));
  /* aircraft */
  if(S.phase!=='PRE'){ const to=coord(act.items[1]); const hd=to?brg(S.pos,to):0; out.push(`<g transform="translate(${X(S.pos)},${Y(S.pos)}) rotate(${hd})"><path d="M0-11V12M-10-1H10M-4 9H4" stroke="#FFE14D" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`); }
  out.push('</g>');
  const gsn=S.hz?230:(S.phase==='CRZ'?450:290); const tl=S.phase==='PRE'?'':`GS ${gsn} TAS ${gsn+20}`;
  out.push(`<text x="10" y="18" class="ndt w">${tl}</text><text x="390" y="18" class="ndt" fill="#F45BFF" text-anchor="end">${esc(act.items[1]&&isW(act.items[1])&&S.phase!=='PRE'?act.items[1].id:'')}</text>`);
  out.push(`<text x="10" y="400" class="ndt c">PLAN</text><text x="390" y="400" class="ndt w" text-anchor="end">${rng} NM</text>`);
  return `<svg viewBox="0 0 400 410" role="img" aria-label="Navigation display, plan mode">${out.join('')}</svg>`;
}
function holdPath(f,h,X,Y,col,dash){
  /* racetrack: inbound leg ends at the fix */
  const leg=Math.max(3,(h.time||1)*3.8), rad=1.6, crs=h.crs, side=h.turn==='L'?-1:1;
  const b=f, a=along(b,crs+180,leg);                 /* start of inbound leg */
  const off=along(b,crs+90*side,2*rad), off2=along(a,crs+90*side,2*rad);
  const P1=`${X(a)},${Y(a)}`, P2=`${X(b)},${Y(b)}`, P3=`${X(off)},${Y(off)}`, P4=`${X(off2)},${Y(off2)}`;
  const r=Math.abs(X(along(b,90,rad))-X(b)), sw=side>0?1:0;
  return `<path d="M${P1}L${P2}A${r} ${r} 0 0 ${sw} ${P3}L${P4}A${r} ${r} 0 0 ${sw} ${P1}" fill="none" stroke="${col}" stroke-width="2" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
}
function drawNd(){ const n=el('mnd'); if(!n) return; const sv=ndSvg(); if(sv!==LASTND){ n.innerHTML=sv; LASTND=sv; } const r=el('mndr'); if(r) r.textContent=RANGES[NDR]+' NM'; drawFcu(); }
function drawFcu(){
  const b=el('mfcu'); if(!b) return; const air=S&&S.phase!=='PRE'; b.hidden=!air; if(!air) return;
  const run=el('mfrun'); run.textContent=S.run?'❚❚':'▶'; run.setAttribute('aria-label',S.run?Lx(tt('Pause','Pause')):Lx(tt('Fly','Fly'))); run.setAttribute('aria-pressed',S.run?'true':'false');
  el('mfnav').setAttribute('aria-pressed',S.ap==='NAV'?'true':'false'); el('mfhdgm').setAttribute('aria-pressed',S.ap==='HDG'?'true':'false');
  const h=el('mfhdg'); if(document.activeElement!==h) h.value=S.ap==='HDG'?p3(S.hdg):'---';
}
let TIMER=null;
function loop(){ if(TIMER) return; let last=performance.now(); TIMER=setInterval(()=>{ if(!S||!S.run){ clearInterval(TIMER); TIMER=null; drawFcu(); return; } const now=performance.now(), dt=Math.min(1,(now-last)/1000); last=now; if(document.hidden) return; stepFlight(dt*8); refresh(); },100); }
function fcuUi(){
  const b=el('mfcu'); if(!b) return;
  el('mfrun').onclick=()=>{ fcu('run'); if(S.run) loop(); refresh(); };
  el('mfnav').onclick=()=>{ fcu('nav'); refresh(); };
  el('mfhdgm').onclick=()=>{ fcu('hdg',S.ap==='HDG'?S.hdg:S.trk); refresh(); };
  const step=d=>{ const base=S.ap==='HDG'?S.hdg:Math.round(S.trk); fcu('hdg',Math.round((base+d)/5)*5||360); refresh(); };
  el('mfm').onclick=()=>step(-5); el('mfp').onclick=()=>step(5);
  const h=el('mfhdg'); h.onchange=()=>{ const v=parseInt(h.value,10); if(v>=0&&v<=360){ fcu('hdg',v||360); } refresh(); h.blur(); };
  h.onkeydown=e=>{ if(e.key==='Enter') h.onchange(); e.stopPropagation(); };
}


let SC=null, MODE='guided', DONE=false, CHECKED=false, HINT=-1;
const KEYS_TOP=[['INITREF','INIT REF'],['RTE','RTE'],['CLB','CLB'],['CRZ','CRZ'],['DES','DES'],['',''],['MENU','MENU'],['LEGS','LEGS'],['DEPARR','DEP ARR'],['HOLD','HOLD'],['PROG','PROG'],['EXEC','EXEC'],['N1LIM','N1 LIMIT'],['FIX','FIX'],['','','sp'],['','','sp'],['','','sp'],['',''],['PREV','PREV PAGE'],['NEXT','NEXT PAGE']];
function buildMcdu(){
  const m=el('mcdu'); if(!m) return;
  let lsk=side=>{ let h=`<div class="mlsk ${side}">`; for(let n=1;n<=6;n++) h+=`<button type="button" class="k lk" data-k="${side}${n}" style="grid-row:${2*n+1}" aria-label="${side==='L'?'Left':'Right'} line key ${n}"><span></span></button>`; return h+'</div>'; };
  let h=`<div class="mtop">${lsk('L')}<div class="mscr" id="mscr" role="img" aria-label="CDU display"></div>${lsk('R')}</div>`;
  h+='<div class="mpk">'+KEYS_TOP.map(([k,t])=>k?`<button type="button" class="k pk${k==='EXEC'?' ex':''}" data-k="${k}">${t.replace(' ','<br>')}</button>`:'<span></span>').join('')+'</div>';
  const nums=['1','2','3','4','5','6','7','8','9','DOT','0','PM'].map(k=>`<button type="button" class="k nk" data-k="${k}">${k==='DOT'?'.':k==='PM'?'+/−':k}</button>`).join('');
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat(['SP','DEL','SLASH','CLR']).map(k=>`<button type="button" class="k ck${k==='CLR'||k==='DEL'?' clr':''}" data-k="${k}">${k==='SLASH'?'/':k}</button>`).join('');
  h+=`<div class="mkb"><div class="mkl"><div class="mnum">${nums}</div></div><div class="mlet">${letters}</div></div>`;
  m.innerHTML=h;
  let hold=null, longDone=false;
  m.addEventListener('pointerdown',e=>{ const b=e.target.closest('.k'); if(!b) return; ACT=true; b.classList.add('dn'); if(b.dataset.k==='CLR'){ longDone=false; hold=setTimeout(()=>{ longDone=true; key('CLRALL'); },700); } });
  const up=e=>{ m.querySelectorAll('.k.dn').forEach(x=>x.classList.remove('dn')); if(hold){ clearTimeout(hold); hold=null; } };
  m.addEventListener('pointerup',up); m.addEventListener('pointerleave',up); m.addEventListener('pointercancel',up);
  m.addEventListener('click',e=>{ const b=e.target.closest('.k'); if(!b) return; const k=b.dataset.k; if(k==='BRT'||k==='DIM') return; if(k==='CLR'&&longDone){ longDone=false; return; } key(k); });
}
let ACT=false;
document.addEventListener('pointerdown',e=>{ ACT=!!e.target.closest('#mcdu'); },true);
document.addEventListener('keydown',e=>{
  if(!S||e.ctrlKey||e.metaKey||e.altKey) return;
  const t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable)) return;
  const sec=el('app'); if(!sec) return; const r=sec.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight) return;
  let k=null; const c=e.key;
  if(/^[a-zA-Z]$/.test(c)) k=c.toUpperCase(); else if(/^[0-9]$/.test(c)) k=c; else if(c==='/') k='SLASH'; else if(c==='.'||c===',') k='DOT'; else if(c==='-'||c==='+') k='PM'; else if(c===' '&&ACT) k='SP'; else if(c==='Backspace') k='CLR'; else if(c==='Delete') k='DEL';
  else if(ACT&&(c==='ArrowLeft'||c==='ArrowUp')) k='PREV'; else if(ACT&&(c==='ArrowRight'||c==='ArrowDown')) k='NEXT';
  if(!k) return; e.preventDefault(); key(k); flash(k);
});
function flash(k){ const b=document.querySelector(`#mcdu .k[data-k="${k}"]`); if(!b) return; b.classList.add('dn'); setTimeout(()=>b.classList.remove('dn'),110); }
function key(k){ if(drillKey(k)){ refresh(); return; } press(k); clearHl(); refresh(); }
function clearHl(){ document.querySelectorAll('#mcdu .k.hl').forEach(b=>b.classList.remove('hl')); }

let LATCH=[];
function stepIdx(){ if(!SC) return -1; for(let i=0;i<SC.steps.length;i++){ if(LATCH[i]) continue; if(SC.steps[i].ok()){ LATCH[i]=true; continue; } return i; } return SC.steps.length; }
const stepOk=i=>!!LATCH[i]||SC.steps[i].ok();
let LASTSCR='', LASTND='';
function refresh(){
  const h=draw(); if(h!==LASTSCR){ el('mscr').innerHTML=h; LASTSCR=h; } drawNd();
  const ex=document.querySelector('#mcdu .k[data-k="EXEC"]'); if(ex) ex.classList.toggle('lit',execLit());
  if(!SC) return;
  if(MODE==='drill'){ drillNow(); drillSteps(); return; }
  const n=SC.steps.length, i=stepIdx();
  const now=el('mnow');
  if(MODE==='guided'&&n){
    if(i>=n){ now.innerHTML=`<b>${esc(Lx(tt('Done.','Ferdig.')))}</b> ${esc(Lx(tt('Every step is complete. Now try the same task “On your own”, without the steps.','Alle stegene er gjort. Prøv nå samme oppgave «På egen hånd», uten stegene.')))}`; now.className='mnow ok'; if(!DONE){ DONE=true; } }
    else { const st=SC.steps[i]; now.className='mnow'; now.innerHTML=`<span class="mst">${esc(Lx(tt('Step','Steg')))} ${i+1}/${n}</span><span class="mtx">${esc(Lx(st.t))}</span><button type="button" class="mhint" id="mhint">${esc(Lx(tt('Hint','Hint')))}</button><div class="mhk" id="mhk" hidden></div>`; el('mhint').onclick=()=>{ HINT=i; showHint(st); }; if(HINT===i) showHint(st); }
  } else if(MODE==='practice'&&n){
    now.className='mnow pr'; now.innerHTML=`<span class="mtx">${esc(Lx(SC.d))}</span><button type="button" class="mhint" id="mchk">${esc(Lx(tt('Check my setup','Sjekk oppsettet')))}</button>`; el('mchk').onclick=check;
  } else { now.className='mnow pr'; now.innerHTML=`<span class="mtx">${esc(Lx(SC.d))}</span>`; }
  drawSteps(i);
}
function keyName(k){ return ({INITREF:'INIT REF',DEPARR:'DEP ARR',N1LIM:'N1 LIMIT',PREV:'PREV PAGE',NEXT:'NEXT PAGE',SLASH:'/',PM:'+/−'})[k]||(/^[LR][1-6]$/.test(k)?k[1]+k[0]:k); }
function showHint(st){
  const box=el('mhk'); if(!box) return; clearHl();
  let h=st.keys.map(k=>`<kbd>${esc(keyName(k))}</kbd>`).join(' ');
  if(st.type) h+=` <span class="mty">${esc(Lx(tt('type','skriv')))} <code>${esc(st.type)}</code></span>`;
  if(st.hint2) h+=`<p>${esc(Lx(st.hint2))}</p>`;
  if(!h) h=esc(Lx(tt('Look at the page and the paperwork.','Se på siden og papirene.')));
  box.innerHTML=h; box.hidden=false;
  st.keys.forEach(k=>{ const b=document.querySelector(`#mcdu .k[data-k="${k}"]`); if(b) b.classList.add('hl'); });
}
function drawSteps(cur){
  const box=el('msteps'); if(!box) return;
  if(!SC.steps.length){ box.innerHTML=''; return; }
  if(MODE==='practice'&&!CHECKED){ box.innerHTML=`<p class="note">${esc(Lx(tt('On your own, the steps are hidden. Do the task from the paperwork, then press “Check my setup”.','På egen hånd er stegene skjult. Gjør oppgaven etter papirene, og trykk «Sjekk oppsettet».')))}</p>`; return; }
  box.innerHTML='<ol class="msl">'+SC.steps.map((s,i)=>{ const ok=stepOk(i); const cl=MODE==='practice'?(ok?'ok':'no'):(i<cur?'ok':i===cur?'cur':''); return `<li class="${cl}">${esc(Lx(s.t))}</li>`; }).join('')+'</ol>';
}
function check(){ CHECKED=true; stepIdx(); const n=SC.steps.length, ok=SC.steps.filter((s,i)=>stepOk(i)).length; drawSteps(stepIdx()); const r=el('mres'); r.hidden=false; r.className='mres '+(ok===n?'ok':'part'); r.textContent=ok===n?Lx(tt(`All ${n} items correct.`,`Alle ${n} punktene er riktige.`)):Lx(tt(`${ok} of ${n} correct. The list shows what is missing.`,`${ok} av ${n} riktige. Listen viser hva som mangler.`)); }
function loadScn(id){
  if(S) S.run=false; SC=SCN.find(s=>s.id===id)||SCN[0]; S=blank(); SC.setup(); S.log=[]; S.seen={}; S.seen[S.page]=1; HINT=-1; LATCH=[]; NDC=null; NDR=S.phase==='PRE'?2:3;
  DONE=false; CHECKED=false; const r=el('mres'); if(r) r.hidden=true;
  const ph=el('mphase'); if(ph) ph.textContent=S.phase==='PRE'?Lx(tt('On stand, XNDV','På standplass, XNDV')):S.phase==='CRZ'?Lx(tt('Cruise FL350','Marsj FL350')):Lx(tt('Descent','Nedstigning'));
  el('mdocs').innerHTML=SC.docs.map(docHtml).join('');
  el('mtitle').textContent=Lx(SC.t);
  document.querySelectorAll('#mlist button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===SC.id?'true':'false'));
  if(SC.cat!=='hidden'){ try{ localStorage.setItem('bb-fmc-scn',SC.id); }catch(e){} }
  refresh();
}
function buildList(){
  const box=el('mlist'); if(!box) return;
  const grp=[['pre',tt('On the ground','På bakken')],['fly',tt('In flight','I lufta')],['free',tt('Free','Fri')]];
  box.innerHTML=grp.map(([g,t])=>`<div class="mlg"><span>${esc(Lx(t))}</span>${SCN.filter(s=>s.cat===g).map(s=>`<button type="button" data-s="${s.id}" aria-pressed="false">${esc(Lx(s.t))}</button>`).join('')}</div>`).join('');
  box.onclick=e=>{ const b=e.target.closest('button[data-s]'); if(b){ if(MODE==='drill') setMode('guided'); loadScn(b.dataset.s); const a=el('mcdu'); if(a&&innerWidth<980) a.scrollIntoView({block:'nearest',behavior:'smooth'}); } };
}
function setMode(m){ if(m!=='drill'&&MODE==='drill'&&SC&&SC.id==='drill'){ MODE=m; loadScn('prep'); } if(m==='drill'&&(!DRL||DRL.i>=DRL.list.length)&&MODE!=='drill'){ MODE='drill'; startDrill(null); return; } MODE=m; CHECKED=false; const r=el('mres'); if(r) r.hidden=true; document.querySelectorAll('#mmode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===m?'true':'false')); clearHl(); refresh(); }
function init(){
  if(!el('mcdu')) return;
  buildMcdu(); buildList();
  el('mmode').onclick=e=>{ const b=e.target.closest('button[data-m]'); if(b) setMode(b.dataset.m); };
  el('mreset').onclick=()=>loadScn(SC.id);
  fcuUi();
  const zi=el('mndin'), zo=el('mndout'); if(zi) zi.onclick=()=>{ NDR=Math.max(0,NDR-1); drawNd(); }; if(zo) zo.onclick=()=>{ NDR=Math.min(RANGES.length-1,NDR+1); drawNd(); };
  let first='prep'; try{ const s=localStorage.getItem('bb-fmc-scn'); if(s&&SCN.some(x=>x.id===s)) first=s; }catch(e){}
  const h=location.hash.replace('#',''); if(SCN.some(x=>x.id===h)) first=h;
  loadScn(first);
  courseUi(); refUi();
  if(LB()) LB().onLang(()=>{ buildList(); loadScnKeep(); courseUi(); refUi(); });
}
function loadScnKeep(){ /* language change: redraw texts without resetting the state */ el('mdocs').innerHTML=SC.docs.map(docHtml).join(''); el('mtitle').textContent=Lx(SC.t); document.querySelectorAll('#mlist button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===SC.id?'true':'false')); refresh(); }

/* =========================================================== course: modules, quizzes, find-the-field drill, reference */
const DRILL_T=[
 {id:'refapt',q:tt('Enter the reference airport','Legg inn referanseflyplassen'),pg:()=>S.page==='posinit',k:'L2',a:'POS INIT · 2L'},
 {id:'irs',q:tt('Set the IRS position','Sett IRS-posisjonen'),pg:()=>S.page==='posinit',k:'R5',a:'POS INIT · 5R'},
 {id:'gps',q:tt('Copy the GPS position to the scratchpad','Kopier GPS-posisjonen til scratchpad'),pg:()=>S.page==='posinit',k:'R4',a:'POS INIT · 4R'},
 {id:'orig',q:tt('Enter the origin airport','Legg inn avgangsflyplassen'),pg:()=>S.page==='rte'&&(S.rpg||1)===1,k:'L1',a:'RTE · 1L'},
 {id:'dest',q:tt('Change the destination','Endre destinasjonen'),pg:()=>S.page==='rte'&&(S.rpg||1)===1,k:'R1',a:'RTE · 1R'},
 {id:'flt',q:tt('Enter the flight number','Legg inn flightnummeret'),pg:()=>S.page==='rte'&&(S.rpg||1)===1,k:'R2',a:'RTE · 2R'},
 {id:'corte',q:tt('Enter a company route','Legg inn en selskapsrute'),pg:()=>S.page==='rte'&&(S.rpg||1)===1,k:'L2',a:'RTE · 2L'},
 {id:'zfw',q:tt('Enter the ZFW','Legg inn ZFW'),pg:()=>S.page==='perfinit',k:'L3',a:'PERF INIT · 3L'},
 {id:'res',q:tt('Enter the reserves','Legg inn reservene'),pg:()=>S.page==='perfinit',k:'L4',a:'PERF INIT · 4L'},
 {id:'ci',q:tt('Enter the cost index','Legg inn cost index'),pg:()=>S.page==='perfinit',k:'L5',a:'PERF INIT · 5L'},
 {id:'crz',q:tt('Enter the cruise altitude','Legg inn marsjhøyden'),pg:()=>S.page==='perfinit',k:'R1',a:'PERF INIT · 1R'},
 {id:'wind',q:tt('Enter the cruise wind','Legg inn vinden i marsjhøyde'),pg:()=>S.page==='perfinit',k:'R2',a:'PERF INIT · 2R'},
 {id:'ta',q:tt('Change the transition altitude','Endre overgangshøyden'),pg:()=>S.page==='perfinit',k:'R4',a:'PERF INIT · 4R'},
 {id:'sel',q:tt('Enter the assumed temperature','Legg inn antatt temperatur'),pg:()=>S.page==='n1',k:'L1',a:'N1 LIMIT · 1L'},
 {id:'to2',q:tt('Select the take-off derate TO-2','Velg avgangsderate TO-2'),pg:()=>S.page==='n1',k:'L4',a:'N1 LIMIT · 4L'},
 {id:'clb1',q:tt('Select climb derate CLB-1','Velg stigederate CLB-1'),pg:()=>S.page==='n1',k:'R3',a:'N1 LIMIT · 3R'},
 {id:'flaps',q:tt('Enter the take-off flaps','Legg inn avgangsklaffen'),pg:()=>S.page==='takeoff',k:'L1',a:'TAKEOFF REF · 1L'},
 {id:'cg',q:tt('Enter the take-off CG (for the stab trim)','Legg inn CG for avgang (for stab trim)'),pg:()=>S.page==='takeoff',k:'L3',a:'TAKEOFF REF · 3L'},
 {id:'v1',q:tt('Select V1','Velg V1'),pg:()=>S.page==='takeoff',k:'R1',a:'TAKEOFF REF · 1R'},
 {id:'v2',q:tt('Select V2','Velg V2'),pg:()=>S.page==='takeoff',k:'R3',a:'TAKEOFF REF · 3R'},
 {id:'dep',q:tt('Open the departures (runway and SID)','Åpne avgangene (rullebane og SID)'),pg:()=>S.page==='deparr',k:'L1',a:'DEP ARR · 1L'},
 {id:'arr',q:tt('Open the arrivals at the destination','Åpne arrivals på destinasjonen'),pg:()=>S.page==='deparr',k:'R2',a:'DEP ARR · 2R'},
 {id:'holdat',q:tt('Enter the holding fix','Legg inn holdingfixet'),pg:()=>S.page==='legs'&&S.holdAt,k:'L6',a:'HOLD · 6L'},
 {id:'ppos',q:tt('Hold at the present position','Hold på nåværende posisjon'),pg:()=>S.page==='legs'&&S.holdAt,k:'R6',a:'HOLD · 6R'},
 {id:'vref',q:tt('Copy VREF for flaps 30','Kopier VREF for klaff 30'),pg:()=>S.page==='appref',k:'R2',a:'INIT REF · INDEX · 5L · 2R'},
 {id:'fspd',q:tt('Set the landing FLAP/SPD','Sett FLAP/SPD for landing'),pg:()=>S.page==='appref',k:'R4',a:'INIT REF · INDEX · 5L · 4R'},
 {id:'pos',q:tt('Open POS INIT from the index','Åpne POS INIT fra indeksen'),pg:()=>S.page==='index',k:'L2',a:'INIT REF · INDEX · 2L'},
 {id:'fix',q:tt('Enter a fix on FIX INFO','Legg inn et fix på FIX INFO'),pg:()=>S.page==='fix',k:'L1',a:'FIX · 1L'}
];
const COURSE=[
 {id:'m1',t:tt('The CDU in ten minutes','CDU-en på ti minutter'),s:tt('Keys, scratchpad, MOD and EXEC','Taster, scratchpad, MOD og EXEC'),
  pts:[tt('The function keys open pages. The six line select keys on each side (1L–6L, 1R–6R) select the line beside them. Page numbers sit top right; NEXT PAGE and PREV PAGE turn them.','Funksjonstastene åpner sider. De seks linjetastene på hver side (1L–6L, 1R–6R) velger linjen ved siden av. Sidenummeret står øverst til høyre; NEXT PAGE og PREV PAGE blar.'),
       tt('Type in the scratchpad (bottom line), then press the line key beside the field. With an empty scratchpad, a line key copies that line to the scratchpad.','Skriv i scratchpad (nederste linje), og trykk linjetasten ved feltet. Med tom scratchpad kopierer en linjetast linjen til scratchpad.'),
       tt('Boxes must be filled. Dashes are optional. Small letters are computed or default values; large letters are entered or selected.','Bokser må fylles ut. Streker er valgfrie. Små bokstaver er beregnede verdier eller standardverdier; store bokstaver er lagt inn eller valgt.'),
       tt('A change to the active route or performance becomes a modification: MOD in the title, the route dashed white on the ND and the EXEC light on. Check it, then press EXEC, or ERASE to cancel.','En endring i aktiv rute eller ytelse blir en modifikasjon: MOD i tittelen, ruten hvit stiplet på ND-en og EXEC-lyset på. Sjekk den, og trykk EXEC, eller ERASE for å avbryte.'),
       tt('CLR removes one character (hold it for all) and clears a message. DEL writes DELETE in the scratchpad; the line key then deletes that field.','CLR fjerner ett tegn (hold inne for alle) og fjerner en melding. DEL skriver DELETE i scratchpad; linjetasten sletter så feltet.')],
  tasks:['free'],drill:['orig','dest','flt','zfw','ci','crz','flaps','v1'],
  quiz:[{q:tt('The EXEC light is on. What does it mean?','EXEC-lyset er på. Hva betyr det?'),a:[tt('A modification is waiting: check it, then EXEC','En modifikasjon venter: sjekk den, så EXEC'),tt('The FMC has failed','FMC-en har feilet'),tt('The route is complete','Ruten er ferdig')],c:0,w:tt('Nothing in the active route changes until you press EXEC.','Ingenting i den aktive ruten endres før du trykker EXEC.')},
        {q:tt('How do you remove a speed/altitude constraint on LEGS?','Hvordan fjerner du en fart-/høyderestriksjon på LEGS?'),a:[tt('CLR, then the right key','CLR, så høyre tast'),tt('DEL, then the right key beside it, then EXEC','DEL, så høyre tast ved den, så EXEC'),tt('Type 0 on the right key','Skriv 0 på høyre tast')],c:1,w:tt('DEL puts DELETE in the scratchpad; the line key deletes, and EXEC makes it active.','DEL legger DELETE i scratchpad; linjetasten sletter, og EXEC gjør det aktivt.')},
        {q:tt('You press the key beside ODRUP on LEGS with an empty scratchpad. What happens?','Du trykker tasten ved ODRUP på LEGS med tom scratchpad. Hva skjer?'),a:[tt('ODRUP is deleted','ODRUP slettes'),tt('ODRUP is copied to the scratchpad','ODRUP kopieres til scratchpad'),tt('A hold is built at ODRUP','En holding lages på ODRUP')],c:1,w:tt('Copying a waypoint is the quickest way to do a direct-to or close a discontinuity.','Å kopiere et waypoint er den raskeste måten å gjøre direct-to eller lukke en diskontinuitet.')},
        {q:tt('V1, VR and V2 show in small letters. Why?','V1, VR og V2 står med små bokstaver. Hvorfor?'),a:[tt('They are computed, not yet selected','De er beregnet, ikke valgt ennå'),tt('They are wrong','De er feil'),tt('They are for the other runway','De er for den andre rullebanen')],c:0,w:tt('Press each key to select the speeds; they turn large and go to the speed tape.','Trykk hver tast for å velge hastighetene; de blir store og går til fartsbåndet.')}]},
 {id:'m2',t:tt('Preflight','Preflight'),s:tt('IDENT to TAKEOFF REF, and the crosscheck','IDENT til TAKEOFF REF, og kryssjekken'),
  pts:[tt('The order: IDENT, POS INIT, RTE, DEPARTURES, PERF INIT, N1 LIMIT, TAKEOFF REF. The prompt at 6R leads to the next page.','Rekkefølgen: IDENT, POS INIT, RTE, DEPARTURES, PERF INIT, N1 LIMIT, TAKEOFF REF. Prompten på 6R leder til neste side.'),
       tt('POS INIT: the IRSs need a position to align. Copy the GPS position into SET IRS POS.','POS INIT: IRS-ene trenger en posisjon for å aligne. Kopier GPS-posisjonen til SET IRS POS.'),
       tt('RTE: origin, destination and flight number on page 1, the route as VIA and TO on page 2. Then ACTIVATE and EXEC: until then the route is not active.','RTE: origin, destinasjon og flightnummer på side 1, ruten som VIA og TO på side 2. Så ACTIVATE og EXEC: før det er ruten ikke aktiv.'),
       tt('PERF INIT: enter the ZFW from the loadsheet. The fuel is sensed, so the FMC adds it and shows the gross weight. Then reserves, cost index and cruise altitude.','PERF INIT: legg inn ZFW fra loadsheeten. Drivstoffet måles, så FMC-en legger det til og viser bruttovekten. Så reserver, cost index og marsjhøyde.'),
       tt('When TAKEOFF REF is complete, the bottom line shows PRE-FLT COMPLETE. The other pilot then checks every page against the paperwork.','Når TAKEOFF REF er ferdig, viser nederste linje PRE-FLT COMPLETE. Den andre piloten sjekker så hver side mot papirene.')],
  tasks:['prep','xchk'],drill:['refapt','gps','irs','orig','dest','flt','zfw','res','ci','crz','sel','flaps','cg','v1'],
  quiz:[{q:tt('Which weight goes into PERF INIT?','Hvilken vekt legges inn på PERF INIT?'),a:[tt('ZFW','ZFW'),tt('Take-off weight','Avgangsvekt'),tt('Landing weight','Landingsvekt')],c:0,w:tt('The FMC adds the sensed fuel to the ZFW to get the gross weight.','FMC-en legger målt drivstoff til ZFW for å få bruttovekten.')},
        {q:tt('You have entered the whole route but the title still says RTE 1, not ACT RTE 1. What is missing?','Du har lagt inn hele ruten, men tittelen viser fortsatt RTE 1, ikke ACT RTE 1. Hva mangler?'),a:[tt('ACTIVATE and EXEC','ACTIVATE og EXEC'),tt('The SID','SID-en'),tt('The cost index','Cost index')],c:0,w:tt('A route is only active after ACTIVATE and EXEC.','En rute er bare aktiv etter ACTIVATE og EXEC.')},
        {q:tt('ZFW on the loadsheet is 58.4, the FMC shows 54.8. What do you do?','ZFW på loadsheeten er 58.4, FMC-en viser 54.8. Hva gjør du?'),a:[tt('Accept it, it is close','Godtar, det er nært'),tt('Correct it, tell the other pilot, and reselect the V-speeds','Retter, sier det til den andre piloten, og velger V-hastighetene på nytt'),tt('Change the fuel instead','Endrer drivstoffet i stedet')],c:1,w:tt('Swapped digits are a classic error. A new weight deletes the take-off speeds.','Ombyttede sifre er en klassisk feil. En ny vekt sletter avgangshastighetene.')},
        {q:tt('Where does the assumed temperature go?','Hvor legges antatt temperatur inn?'),a:[tt('N1 LIMIT, SEL (1L)','N1 LIMIT, SEL (1L)'),tt('PERF INIT, T/C OAT','PERF INIT, T/C OAT'),tt('TAKEOFF REF, 1L','TAKEOFF REF, 1L')],c:0,w:tt('SEL is the assumed temperature for a reduced take-off. T/C OAT is the temperature at top of climb.','SEL er antatt temperatur for redusert avgang. T/C OAT er temperaturen på toppen av stigningen.')}]},
 {id:'m3',t:tt('The route and LEGS','Ruten og LEGS'),s:tt('VIA/TO, discontinuities and constraints','VIA/TO, diskontinuiteter og restriksjoner'),
  pts:[tt('RTE page 2: VIA on the left (an airway or DIRECT), TO on the right. An airway must start at the previous TO.','RTE side 2: VIA til venstre (en luftvei eller DIRECT), TO til høyre. En luftvei må starte på forrige TO.'),
       tt('LEGS shows every waypoint with course and distance, and speed/altitude on the right. The active waypoint is magenta.','LEGS viser hvert waypoint med kurs og distanse, og fart/høyde til høyre. Det aktive waypointet er magenta.'),
       tt('A ROUTE DISCONTINUITY shows as boxes. LNAV does not fly past it. Close it by copying the next waypoint into the boxes, but only when that is what ATC cleared.','En ROUTE DISCONTINUITY vises som bokser. LNAV flyr ikke forbi den. Lukk den ved å kopiere neste waypoint inn i boksene, men bare når det er det ATC har klarert.'),
       tt('Constraints go on the right key: 250/FL110 is speed and altitude, 5000A is at or above, 5000B is at or below.','Restriksjoner legges på høyre tast: 250/FL110 er fart og høyde, 5000A er at or above, 5000B er at or below.')],
  tasks:['disc','cstr'],drill:['orig','corte','dest','dep','arr','fix'],
  quiz:[{q:tt('“Cross ODRUP at or above FL110” is entered as …','«Cross ODRUP at or above FL110» legges inn som …'),a:[tt('FL110','FL110'),tt('FL110A','FL110A'),tt('FL110B','FL110B')],c:1,w:tt('A is at or above, B at or below, no letter is “at”.','A er at or above, B er at or below, uten bokstav er «at».')},
        {q:tt('How do you close a route discontinuity?','Hvordan lukker du en rutediskontinuitet?'),a:[tt('Copy the next waypoint into the boxes, then EXEC','Kopier neste waypoint inn i boksene, så EXEC'),tt('Press CLR on the boxes','Trykk CLR på boksene'),tt('It closes by itself','Den lukker seg selv')],c:0,w:tt('DEL on the boxes also works. Always check that the joined route is what ATC cleared.','DEL på boksene virker også. Sjekk alltid at den sammenkoblede ruten er det ATC har klarert.')},
        {q:tt('What does the aircraft do at a discontinuity in LNAV?','Hva gjør flyet ved en diskontinuitet i LNAV?'),a:[tt('Flies direct to the next waypoint','Flyr direkte til neste waypoint'),tt('LNAV drops out and the aircraft keeps its heading','LNAV faller ut og flyet holder headingen'),tt('Enters a hold','Går inn i holding')],c:1,w:tt('Select a heading or close the discontinuity in time.','Velg heading eller lukk diskontinuiteten i tide.')}]},
 {id:'m4',t:tt('Take-off performance','Take-off-ytelse'),s:tt('N1 LIMIT, TAKEOFF REF and runway changes','N1 LIMIT, TAKEOFF REF og rullebanebytte'),
  pts:[tt('N1 LIMIT: TO, TO-1 and TO-2 are the full rating and two derates. SEL is the assumed temperature. The FMC picks a matching climb derate, which you can change.','N1 LIMIT: TO, TO-1 og TO-2 er full rating og to derates. SEL er antatt temperatur. FMC-en velger en tilsvarende stigederate, som du kan endre.'),
       tt('TAKEOFF REF: FLAPS at 1L and CG at 3L (the FMC shows the stab trim). V1, VR and V2 are computed in small letters: select them with 1R–3R and check them against the take-off data.','TAKEOFF REF: FLAPS på 1L og CG på 3L (FMC-en viser stab trim). V1, VR og V2 beregnes med små bokstaver: velg dem med 1R–3R og sjekk dem mot take-off-dataene.'),
       tt('A new runway, flap setting, assumed temperature or weight deletes the selected speeds: TAKEOFF SPEEDS DELETED. Check the new data and select them again.','Ny rullebane, klaff, antatt temperatur eller vekt sletter de valgte hastighetene: TAKEOFF SPEEDS DELETED. Sjekk de nye dataene og velg dem på nytt.'),
       tt('A runway change is done on DEPARTURES: new runway, new SID, check the MOD route, EXEC.','Et rullebanebytte gjøres på DEPARTURES: ny rullebane, ny SID, sjekk MOD-ruten, EXEC.')],
  tasks:['rwy'],drill:['sel','to2','clb1','flaps','cg','v1','v2','dep'],
  quiz:[{q:tt('You change the flaps from 5 to 1 on TAKEOFF REF. What happens to the selected V-speeds?','Du endrer klaffen fra 5 til 1 på TAKEOFF REF. Hva skjer med de valgte V-hastighetene?'),a:[tt('Nothing','Ingenting'),tt('They are deleted and must be selected again','De slettes og må velges på nytt'),tt('They change by themselves','De endrer seg selv')],c:1,w:tt('The FMC deletes them so old speeds are never used by mistake.','FMC-en sletter dem så gamle hastigheter aldri brukes ved en feil.')},
        {q:tt('What is the CG on TAKEOFF REF used for?','Hva brukes CG på TAKEOFF REF til?'),a:[tt('The stab trim setting','Stab trim-innstillingen'),tt('The fuel','Drivstoffet'),tt('The cruise altitude','Marsjhøyden')],c:0,w:tt('Set the trim from the value beside the CG and check it against the paperwork.','Sett trimmen fra verdien ved siden av CG og sjekk den mot papirene.')},
        {q:tt('V1 145, VR 140, V2 146 is entered. What does the CDU say?','V1 145, VR 140, V2 146 legges inn. Hva sier CDU-en?'),a:[tt('Nothing','Ingenting'),tt('V1/VR/V2 DISAGREE','V1/VR/V2 DISAGREE'),tt('INVALID ENTRY','INVALID ENTRY')],c:1,w:tt('The rule is V1 ≤ VR ≤ V2.','Regelen er V1 ≤ VR ≤ V2.')}]},
 {id:'m5',t:tt('In flight','I lufta'),s:tt('Direct to, intercept, holding and constraints','Direct to, intercept, holding og restriksjoner'),
  pts:[tt('Direct to: put the waypoint on 1L of LEGS (copy it or type it), check the MOD on the ND, EXEC.','Direct to: legg waypointet på 1L på LEGS (kopier eller skriv det), sjekk MOD på ND-en, EXEC.'),
       tt('Intercept course: the same, then INTC CRS at 6R with the course to the waypoint (for example 250 to SK255), EXEC.','Intercept course: det samme, så INTC CRS på 6R med kursen til waypointet (for eksempel 250 til SK255), EXEC.'),
       tt('Hold: HOLD key, the fix at HOLD AT 6L (or PPOS at 6R), then INBD CRS/DIR (230/L) and LEG TIME, EXEC.','Holding: HOLD-tasten, fixet på HOLD AT 6L (eller PPOS på 6R), så INBD CRS/DIR (230/L) og LEG TIME, EXEC.'),
       tt('Leaving the hold: EXIT HOLD (6R), EXEC. EXIT ARMED: the aircraft leaves when it next reaches the fix.','Ut av holdingen: EXIT HOLD (6R), EXEC. EXIT ARMED: flyet går ut neste gang det når fixet.')],
  tasks:['dct','intc','hold','cstr'],drill:['holdat','ppos','fix','dest'],
  quiz:[{q:tt('ATC: “Intercept the 250 course to SK255.” What do you enter at INTC CRS?','ATC: «Intercept the 250 course to SK255.» Hva legger du inn på INTC CRS?'),a:[tt('250','250'),tt('070','070'),tt('SK255','SK255')],c:0,w:tt('INTC CRS is the inbound course to the waypoint, as ATC says it.','INTC CRS er kursen inn til waypointet, slik ATC sier den.')},
        {q:tt('You are in the hold and ATC clears you on. What do you press?','Du er i holding, og ATC klarerer deg videre. Hva trykker du?'),a:[tt('EXIT HOLD (6R), then EXEC','EXIT HOLD (6R), så EXEC'),tt('DEL on the hold','DEL på holdingen'),tt('HDG SEL on the MCP','HDG SEL på MCP-en')],c:0,w:tt('EXIT ARMED: the aircraft finishes the hold at the fix and continues the route.','EXIT ARMED: flyet fullfører holdingen ved fixet og fortsetter ruten.')},
        {q:tt('After a direct-to, the title shows MOD RTE 1 LEGS. Is the aircraft turning yet?','Etter en direct-to viser tittelen MOD RTE 1 LEGS. Svinger flyet ennå?'),a:[tt('Yes','Ja'),tt('No, not until EXEC','Nei, ikke før EXEC'),tt('Only in HDG SEL','Bare i HDG SEL')],c:1,w:tt('A MOD is only a proposal until it is executed.','En MOD er bare et forslag til den er utført.')}]},
 {id:'m6',t:tt('Arrival and approach','Arrival og innflyging'),s:tt('ARRIVALS and APPROACH REF','ARRIVALS og APPROACH REF'),
  pts:[tt('Prepare in cruise from the ATIS: DEP ARR, ARR> for the destination, the approach and its transition on the right, the STAR on the left, check LEGS, EXEC.','Forbered i marsjhøyde etter ATIS: DEP ARR, ARR> for destinasjonen, innflygingen og transition til høyre, STAR-en til venstre, sjekk LEGS, EXEC.'),
       tt('Choose the transition that joins the STAR to the approach, so no discontinuity is left between them.','Velg transition som kobler STAR-en til innflygingen, så det ikke blir igjen en diskontinuitet mellom dem.'),
       tt('APPROACH REF (INIT REF in flight): VREF for flaps 15, 30 and 40 for the landing weight. Press the line to copy it, then 4R FLAP/SPD.','APPROACH REF (INIT REF i lufta): VREF for klaff 15, 30 og 40 for landingsvekten. Trykk linjen for å kopiere den, så 4R FLAP/SPD.'),
       tt('Minimums and the altimeter setting are not entered in the FMC: they are set on the EFIS control panel.','Minima og høydemålerinnstilling legges ikke inn i FMC-en: de settes på EFIS-panelet.')],
  tasks:['app','appref'],drill:['arr','vref','fspd','dep'],
  quiz:[{q:tt('ILS with DA 380 ft. Where do you set it?','ILS med DA 380 ft. Hvor setter du den?'),a:[tt('APPROACH REF','APPROACH REF'),tt('The MINS selector on the EFIS control panel','MINS-velgeren på EFIS-panelet'),tt('PERF INIT','PERF INIT')],c:1,w:tt('BARO minimums for a DA, RADIO for a radio altimeter DH.','BARO-minima for en DA, RADIO for en DH på radiohøydemåler.')},
        {q:tt('After choosing ILS25 and ODRUP2W, a discontinuity sits between SK260 and SK255. Most likely cause?','Etter ILS25 og ODRUP2W ligger det en diskontinuitet mellom SK260 og SK255. Mest sannsynlig årsak?'),a:[tt('Wrong runway','Feil rullebane'),tt('No transition was selected','Ingen transition ble valgt'),tt('The STAR is closed','STAR-en er stengt')],c:1,w:tt('Select the transition SK260, or close the discontinuity on LEGS.','Velg transition SK260, eller lukk diskontinuiteten på LEGS.')},
        {q:tt('How do you put VREF 30 into FLAP/SPD?','Hvordan legger du VREF 30 i FLAP/SPD?'),a:[tt('Press 2R (copies 30/VREF), then 4R','Trykk 2R (kopierer 30/VREF), så 4R'),tt('Type 30 on 4R','Skriv 30 på 4R'),tt('It is set automatically','Den settes automatisk')],c:0,w:tt('The selected flap and speed go to the speed tape.','Valgt klaff og fart går til fartsbåndet.')}]},
 {id:'m7',t:tt('When the plan changes','Når planen endres'),s:tt('Diversion and checking the fuel','Diversjon og drivstoffsjekk'),
  pts:[tt('Diversion: RTE page 1, new DEST (1R), EXEC. The route to the new destination ends with a discontinuity: add an approach on ARRIVALS, or a direct-to.','Diversjon: RTE side 1, ny DEST (1R), EXEC. Ruten til den nye destinasjonen slutter med en diskontinuitet: legg til en innflyging på ARRIVALS, eller en direct-to.'),
       tt('PROG shows distance, ETA and predicted fuel at the next waypoints and the destination. Check it after every change.','PROG viser distanse, ETA og beregnet drivstoff ved de neste waypointene og destinasjonen. Sjekk den etter hver endring.'),
       tt('ERASE throws away a MOD you do not want. Nothing changes until EXEC, so read the MOD route on LEGS and on the ND before you press it.','ERASE kaster en MOD du ikke vil ha. Ingenting endres før EXEC, så les MOD-ruten på LEGS og på ND-en før du trykker.')],
  tasks:['altn','rwy'],drill:['dest','arr','fix','holdat'],
  quiz:[{q:tt('Where do you change the destination for a diversion?','Hvor endrer du destinasjonen ved en diversjon?'),a:[tt('RTE page 1, DEST (1R)','RTE side 1, DEST (1R)'),tt('PERF INIT','PERF INIT'),tt('PROG','PROG')],c:0,w:tt('Then EXEC, the arrival, and a fuel check on PROG.','Så EXEC, arrival og drivstoffsjekk på PROG.')},
        {q:tt('You made a MOD by mistake. How do you get rid of it?','Du laget en MOD ved en feil. Hvordan blir du kvitt den?'),a:[tt('ERASE (6L)','ERASE (6L)'),tt('Press EXEC twice','Trykk EXEC to ganger'),tt('Turn the CDU off','Slå av CDU-en')],c:0,w:tt('ERASE returns to the active route unchanged.','ERASE går tilbake til den aktive ruten uendret.')}]}
];
let MOD=null, DRL=null;

function courseUi(){
  const g=el('mcourse'); if(!g) return;
  g.innerHTML=COURSE.map((m,i)=>`<button type="button" class="mcard${MOD===m.id?' on':''}" data-m="${m.id}" aria-expanded="${MOD===m.id}"><span class="n">${String(i+1).padStart(2,'0')}</span><b>${esc(Lx(m.t))}</b><small>${esc(Lx(m.s))}</small></button>`).join('')+
    `<button type="button" class="mcard dr" data-m="drill"><span class="n">⌖</span><b>${esc(Lx(tt('Find the field','Finn feltet')))}</b><small>${esc(Lx(tt('12 random fields: find the page and the key','12 tilfeldige felt: finn siden og tasten')))}</small></button>`;
  g.onclick=e=>{ const b=e.target.closest('button[data-m]'); if(!b) return; if(b.dataset.m==='drill'){ startDrill(null); return; } MOD=MOD===b.dataset.m?null:b.dataset.m; courseUi(); if(MOD){ const p=el('mcmod'); if(p) p.scrollIntoView({block:'nearest',behavior:'smooth'}); } };
  const p=el('mcmod'); if(!p) return; const m=COURSE.find(x=>x.id===MOD); if(!m){ p.hidden=true; p.innerHTML=''; return; }
  p.hidden=false;
  const tsk=m.tasks.map(id=>{ const sc=SCN.find(s=>s.id===id); return `<li><b>${esc(Lx(sc.t))}</b><span class="go"><button type="button" class="btn sm" data-try="${id}" data-mode="guided">${esc(Lx(tt('With help','Med hjelp')))}</button>${sc.steps.length?`<button type="button" class="btn sm ghost" data-try="${id}" data-mode="practice">${esc(Lx(tt('On your own','På egen hånd')))}</button>`:''}</span></li>`; }).join('');
  p.innerHTML=`<div class="mcm-h"><h3>${esc(Lx(m.t))}</h3><button type="button" class="mrst" data-close="1">${esc(Lx(tt('Close','Lukk')))}</button></div>
   <div class="mcm-g"><div><h4>${esc(Lx(tt('Key points','Det viktigste')))}</h4><ul class="mpts">${m.pts.map(x=>`<li>${esc(Lx(x))}</li>`).join('')}</ul></div>
   <div><h4>${esc(Lx(tt('Tasks','Oppgaver')))}</h4><ol class="mtsk">${tsk}</ol>
   <h4>${esc(Lx(tt('Find the field','Finn feltet')))}</h4><p class="note">${esc(Lx(tt('Drill the fields of this module until you find them without thinking.','Drill feltene i denne modulen til du finner dem uten å tenke.')))}</p><button type="button" class="btn sm" data-drill="${m.id}">${esc(Lx(tt('Start the drill','Start drillen')))}</button></div></div>
   <h4>${esc(Lx(tt('Check yourself','Test deg selv')))}</h4><div class="mquiz">${m.quiz.map((q,i)=>`<div class="mq" data-q="${i}"><p>${esc(Lx(q.q))}</p><div class="mqa">${q.a.map((a,j)=>`<button type="button" data-a="${j}">${esc(Lx(a))}</button>`).join('')}</div><p class="mqw" hidden></p></div>`).join('')}</div>`;
  p.onclick=e=>{
    const c=e.target.closest('[data-close]'); if(c){ MOD=null; courseUi(); return; }
    const t=e.target.closest('[data-try]'); if(t){ setMode(t.dataset.mode); loadScn(t.dataset.try); setMode(t.dataset.mode); el('app').scrollIntoView({behavior:'smooth'}); return; }
    const d=e.target.closest('[data-drill]'); if(d){ startDrill(d.dataset.drill); return; }
    const a=e.target.closest('.mqa button'); if(a){ const box=a.closest('.mq'), q=m.quiz[+box.dataset.q], j=+a.dataset.a; box.querySelectorAll('.mqa button').forEach(b=>{ b.disabled=true; const k=+b.dataset.a; if(k===q.c) b.classList.add('ok'); else if(k===j) b.classList.add('no'); }); const w=box.querySelector('.mqw'); w.hidden=false; w.textContent=(j===q.c?Lx(tt('Correct. ','Riktig. ')):Lx(tt('Not quite. ','Ikke helt. ')))+Lx(q.w); }
  };
}
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function startDrill(mid){
  const m=mid&&COURSE.find(x=>x.id===mid);
  const ids=m?m.drill:shuffle(DRILL_T.map(t=>t.id)).slice(0,12);
  DRL={list:shuffle(ids).map(id=>DRILL_T.find(t=>t.id===id)).filter(Boolean),i:0,found:[],helped:0,tries:0,shown:false,mod:mid};
  setMode('drill'); loadScn('drill'); setMode('drill'); el('app').scrollIntoView({behavior:'smooth'});
}
function drillKey(k){
  if(MODE!=='drill'||!DRL||DRL.i>=DRL.list.length) return false;
  const t=DRL.list[DRL.i]; if(!/^[LR][1-6]$/.test(k)) return false;
  if(t.pg()&&(t.any?k[0]===t.k:k===t.k)){ DRL.found.push({t,help:DRL.shown}); if(DRL.shown) DRL.helped++; DRL.i++; DRL.shown=false; DRL.flash='ok'; clearHl(); return true; }
  if(t.pg()){ DRL.tries++; DRL.flash='no'; return true; }
  return false;
}
function drillNow(){
  const now=el('mnow');
  if(!DRL){ now.className='mnow pr'; now.innerHTML=''; return; }
  if(DRL.i>=DRL.list.length){ now.className='mnow ok'; now.innerHTML=`<b>${esc(Lx(tt('Done.','Ferdig.')))}</b> <span class="mtx">${esc(Lx(tt(`You found all ${DRL.list.length}, ${DRL.helped} with help.`,`Du fant alle ${DRL.list.length}, ${DRL.helped} med hjelp.`)))}</span><button type="button" class="mhint" id="mdragain">${esc(Lx(tt('Again','Igjen')))}</button>`; el('mdragain').onclick=()=>startDrill(DRL.mod); return; }
  const t=DRL.list[DRL.i];
  now.className='mnow'+(DRL.flash==='no'?' bad':DRL.flash==='ok'?' good':'');
  now.innerHTML=`<span class="mst">${DRL.i+1}/${DRL.list.length}</span><span class="mtx"><b>${esc(Lx(tt('Find:','Finn:')))}</b> ${esc(Lx(t.q))}${DRL.flash==='no'?` <em>${esc(Lx(tt('Right page, wrong line.','Riktig side, feil linje.')))}</em>`:''}</span><button type="button" class="mhint" id="mdshow">${esc(Lx(tt('Show me','Vis meg')))}</button><button type="button" class="mhint" id="mdskip">${esc(Lx(tt('Skip','Hopp over')))}</button>${DRL.shown?`<div class="mhk"><kbd>${esc(typeof t.a==='string'?t.a:Lx(t.a))}</kbd></div>`:''}`;
  DRL.flash=null;
  el('mdshow').onclick=()=>{ DRL.shown=true; drillNow(); const pg0=(typeof t.a==='string'?t.a:t.a.en).split(' · ')[0], first=({'POS INIT':'INITREF','PERF INIT':'INITREF','TAKEOFF REF':'INITREF','INIT REF':'INITREF','N1 LIMIT':'N1LIM','DEP ARR':'DEPARR'})[pg0]||pg0; const b=document.querySelector(`#mcdu .k[data-k="${first}"]`); if(b) b.classList.add('hl'); };
  el('mdskip').onclick=()=>{ DRL.list.push(DRL.list.splice(DRL.i,1)[0]); DRL.shown=false; drillNow(); };
}
function drillSteps(){
  const box=el('msteps'); if(!box) return;
  if(!DRL){ box.innerHTML=''; return; }
  box.innerHTML='<ol class="msl">'+DRL.found.map(f=>`<li class="ok">${esc(Lx(f.t.q))} · <b>${esc(typeof f.t.a==='string'?f.t.a:Lx(f.t.a))}</b></li>`).join('')+'</ol>'+(DRL.found.length?'':`<p class="note">${esc(Lx(tt('Navigate with the page keys, then press the line key of the field. The fields you find are listed here with the way to them.','Naviger med sidetastene, og trykk linjetasten til feltet. Feltene du finner, listes her med veien dit.')))}</p>`);
}
function refUi(){
  const r=el('mref'); if(!r) return;
  const R=[
   ['INIT REF','IDENT · POS INIT',tt('Start of preflight','Starten på preflight'),'IDENT: 6R POS INIT · POS INIT: 2L REF AIRPORT · 3L GATE · 4R GPS POS · 5R SET IRS POS · 6R ROUTE'],
   ['RTE','RTE 1/x',tt('Route','Rute'),tt('Page 1: 1L ORIGIN · 1R DEST · 2L CO ROUTE · 2R FLT NO. · 3L RUNWAY · 6R ACTIVATE. Page 2+: VIA (left) / TO (right)','Side 1: 1L ORIGIN · 1R DEST · 2L CO ROUTE · 2R FLT NO. · 3L RUNWAY · 6R ACTIVATE. Side 2+: VIA (venstre) / TO (høyre)')],
   ['DEP ARR','DEP/ARR INDEX',tt('SID, STAR, approach','SID, STAR, innflyging'),tt('1L <DEP (origin) · 2R ARR> (destination). DEPARTURES: SIDs left, runways right. ARRIVALS: STARs left, approaches and transitions right','1L <DEP (avgang) · 2R ARR> (destinasjon). DEPARTURES: SID-er til venstre, rullebaner til høyre. ARRIVALS: STAR-er til venstre, innflyginger og transitions til høyre')],
   ['LEGS','RTE LEGS',tt('The route, leg by leg','Ruten, leg for leg'),tt('Left key: waypoint (copy, insert, 1L = direct to, DEL) · right key: speed/altitude · 6R INTC CRS after a direct to · 6L ERASE on a MOD','Venstre tast: waypoint (kopier, sett inn, 1L = direct to, DEL) · høyre tast: fart/høyde · 6R INTC CRS etter direct to · 6L ERASE på en MOD')],
   ['EXEC','EXEC',tt('Makes a MOD active','Gjør en MOD aktiv'),tt('Lit when a modification (MOD) waits: route, ACTIVATE, PERF INIT, EXIT HOLD','Lyser når en modifikasjon (MOD) venter: rute, ACTIVATE, PERF INIT, EXIT HOLD')],
   ['INIT REF','PERF INIT',tt('Weights and cruise','Vekter og marsj'),'1L GW/CRZ CG · 2L FUEL · 3L ZFW · 4L RESERVES · 5L COST INDEX · 1R CRZ ALT · 2R CRZ WIND · 3R T/C OAT · 4R TRANS ALT · 6R N1 LIMIT'],
   ['N1 LIMIT','N1 LIMIT',tt('Thrust','Skyvekraft'),'1L SEL/OAT · 2L–4L TO, TO-1, TO-2 · 2R–4R CLB, CLB-1, CLB-2 · 6R TAKEOFF'],
   ['INIT REF','TAKEOFF REF',tt('Take-off','Avgang'),'1L FLAPS · 2L N1 · 3L CG/TRIM · 4L RUNWAY · 1R V1 · 2R VR · 3R V2 · 4R GW/TOW'],
   ['HOLD','HOLD',tt('Holding','Holding'),tt('LEGS: 6L HOLD AT (fix) · 6R PPOS. HOLD page: 1L FIX · 3L INBD CRS/DIR · 4L LEG TIME · 3R EFC TIME · 4R HOLD AVAIL · 6R EXIT HOLD','LEGS: 6L HOLD AT (fix) · 6R PPOS. HOLD-siden: 1L FIX · 3L INBD CRS/DIR · 4L LEG TIME · 3R EFC TIME · 4R HOLD AVAIL · 6R EXIT HOLD')],
   [tt('INIT REF (in flight)','INIT REF (i lufta)'),'APPROACH REF',tt('Landing','Landing'),'1L GROSS WT · 1R–3R VREF 15/30/40 · 4R FLAP/SPD'],
   ['PROG','PROGRESS',tt('Progress and fuel','Fremdrift og drivstoff'),'FROM · next waypoints · DEST: DTG, ETA, FUEL · TO T/D'],
   ['CLB · CRZ · DES','ECON CLB/CRZ/DES',tt('Vertical','Vertikalt'),'CRZ ALT · TGT SPD · SPD REST'],
   ['INIT REF · 6L','INIT/REF INDEX',tt('All reference pages','Alle referansesidene'),'1L IDENT · 2L POS · 3L PERF · 4L TAKEOFF · 5L APPROACH']
  ];
  const S2=x=>typeof x==='string'?x:Lx(x);
  r.innerHTML=`<table class="mreft"><thead><tr><th>${esc(Lx(tt('Key','Tast')))}</th><th>${esc(Lx(tt('Page','Side')))}</th><th>${esc(Lx(tt('For','Til')))}</th><th>${esc(Lx(tt('Line keys','Linjetaster')))}</th></tr></thead><tbody>${R.map(x=>`<tr><td><kbd>${esc(S2(x[0]))}</kbd></td><td><b>${esc(x[1])}</b></td><td>${esc(S2(x[2]))}</td><td>${esc(S2(x[3]))}</td></tr>`).join('')}</tbody></table>`;
  const c=el('mvs'); if(c) c.innerHTML=`<table class="mreft"><thead><tr><th></th><th>Airbus MCDU</th><th>Boeing FMC/CDU</th></tr></thead><tbody>${[
   [tt('Changing the route','Endre ruten'),tt('Temporary flight plan (yellow), INSERT or ERASE','Midlertidig flyplan (gul), INSERT eller ERASE'),tt('MOD (white dashed), EXEC or ERASE','MOD (hvit stiplet), EXEC eller ERASE')],
   [tt('Direct to','Direct to'),tt('DIR key, choose the waypoint, DIR TO*','DIR-tasten, velg waypointet, DIR TO*'),tt('Waypoint on 1L of LEGS, EXEC','Waypoint på 1L på LEGS, EXEC')],
   [tt('Course to a fix','Kurs til et fix'),tt('RADIAL IN (the radial, 070 for course 250)','RADIAL IN (radialen, 070 for kurs 250)'),tt('INTC CRS (the course, 250)','INTC CRS (kursen, 250)')],
   [tt('Mandatory fields','Obligatoriske felt'),tt('Amber boxes','Oransje bokser'),tt('White boxes','Hvite bokser')],
   [tt('Weights','Vekter'),tt('INIT B: ZFW/ZFWCG and BLOCK','INIT B: ZFW/ZFWCG og BLOCK'),tt('PERF INIT: ZFW (fuel is sensed)','PERF INIT: ZFW (drivstoffet måles)')],
   [tt('Reduced take-off thrust','Redusert avgangsskyvekraft'),tt('FLEX on PERF TAKE OFF','FLEX på PERF TAKE OFF'),tt('SEL (assumed temperature) on N1 LIMIT','SEL (antatt temperatur) på N1 LIMIT')],
   [tt('V-speeds','V-hastigheter'),tt('Typed in from the take-off data','Skrives inn fra take-off-dataene'),tt('Computed by the FMC, selected and checked','Beregnet av FMC-en, valgt og sjekket')],
   [tt('Delete a field','Slette et felt'),tt('CLR on an empty scratchpad, then the line key','CLR på tom scratchpad, så linjetasten'),tt('DEL, then the line key','DEL, så linjetasten')],
   [tt('Minimums','Minima'),tt('PERF APPR (BARO/RADIO)','PERF APPR (BARO/RADIO)'),tt('EFIS control panel (MINS)','EFIS-panelet (MINS)')]
  ].map(x=>`<tr><td><b>${esc(Lx(x[0]))}</b></td><td>${esc(Lx(x[1]))}</td><td>${esc(Lx(x[2]))}</td></tr>`).join('')}</tbody></table>`;
}

window.FMC={drill:startDrill,drillState:()=>DRL,course:COURSE,drillT:DRILL_T,progress:()=>stepIdx(),tick:(n,dt)=>{ for(let i=0;i<(n||1);i++) stepFlight(dt||0.8); refresh(); },fcu:(c,v)=>{ fcu(c,v); refresh(); },press:k=>{ key(k); },state:()=>S,load:loadScn,scn:SCN,mode:setMode,exec:execLit,screen:()=>{ cls(); (PG[S.page]||PG.menu).draw(); scratch(); return scr.map(r=>r.map(c=>c.c==='§'?'#':c.c).join('')).join('\n'); }};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
