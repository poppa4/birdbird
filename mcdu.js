/* NORDAP – A320-family MCDU trainer.
   A generic, simplified FMGS for learning the MCDU: INIT A/B, F-PLN with temporary flight plan and discontinuities,
   departures, arrivals, airways, DIR TO (incl. radial in), hold, ENABLE ALTN, SEC F-PLN, RAD NAV, PERF and DATA.
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
    act:newPlan(),sec:null,tmpy:null,
    init:{flt:'',ci:null,crz:null,temp:null,altn:null,co:'',irs:false},
    fb:{zfw:null,cg:null,block:null,taxi:0.2},
    perf:{v1:null,vr:null,v2:null,ta:null,thr:null,acc:null,flaps:null,ths:null,flex:null,eoa:null,qnh:null,tmp:null,wd:null,ws:null,baro:null,radio:null,ldg:'FULL',gthr:null,gacc:null,geoa:null,confirm:false},
    rad:{v1:null,c1:null,v2:null,c2:null,ils:null,ic:null,a1:null,a2:null},
    page:'menu',lastFm:'init',view:'act',off:0,lr:null,dep:null,arr:null,awy:null,hold:null,dir:null,pp:null,
    sp:'',msg:null,clr:false,seen:{},log:[]};
}
const altnOf=()=>S.act.altn||S.init.altn;
function msg(t,amb){ S.msg={t,a:!!amb}; S.clr=false; }
function take(){ const s=S.sp; S.sp=''; S.clr=false; return s; }
function planFor(view){ return S.tmpy&&S.tmpy.tgt===view?S.tmpy.plan:S[view]; }
function startTmpy(view){ if(S.tmpy&&S.tmpy.tgt!==view){ msg('TMPY F-PLN EXISTS',true); return null; } if(!S.tmpy) S.tmpy={tgt:view,plan:clone(S[view])}; return S.tmpy.plan; }
function insertTmpy(){
  if(!S.tmpy) return; const t=S.tmpy, old=S[t.tgt];
  S[t.tgt]=t.plan; S.tmpy=null;
  if(t.tgt==='act') afterActChange(old);
}
function afterActChange(old){
  const P_=S.perf;
  if(S.phase==='PRE'&&old&&old.dRwy&&old.dRwy!==S.act.dRwy&&(P_.v1||P_.vr||P_.v2)){ P_.old={v1:P_.v1,vr:P_.vr,v2:P_.v2}; P_.v1=P_.vr=P_.v2=null; msg('CHECK TAKE OFF DATA',true); }
}
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
function scratch(){
  if(S.msg) put(13,0,S.msg.t.slice(0,COLS),S.msg.a?'a':'w');
  else if(S.clr) put(13,0,'CLR','w');
  else put(13,0,S.sp.slice(-COLS),'w');
}
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

/* =========================================================== pages */
const PG={};
function go(page,o){ S.page=page; S.seen[page]=1; if(o) Object.assign(S,o); }
function fmFrom(view){ const p=planFor(view); return p; }

/* ---------- MCDU MENU ---------- */
PG.menu={draw(){ title('MCDU MENU'); prompt(1,'L','<FMGC','g'); if(!S.sp&&!S.msg&&!S.clr) put(13,0,'SELECT DESIRED SYSTEM','w'); prompt(2,'L','<ATSU'); prompt(3,'L','<AIDS'); prompt(4,'L','<CFDS'); putR(DR(1),'(REQ)','w',1); },
  lsk(s,n){ if(s==='L'&&n===1){ go(S.lastFm||'init'); return; } if(s==='L'&&n<=4){ msg('NOT AVAILABLE'); return; } }};

/* ---------- INIT A ---------- */
PG.init={
  draw(){
    const p=S.act, I=S.init;
    title('INIT'); putR(0,'→','w');
    lbl(1,'L',' CO RTE'); prompt(1,'L',I.co?I.co:box(10),I.co?'c':'a');
    lbl(1,'R','FROM/TO  '); prompt(1,'R',p.from?p.from+'/'+p.to:box(4)+'/'+box(4),p.from?'c':'a');
    lbl(2,'L','ALTN/CO RTE'); prompt(2,'L',(altnOf()||'----')+'/'+(altnOf()?'NONE':'------'),altnOf()?'c':'w');
    lbl(2,'R','INIT '); prompt(2,'R','REQUEST*','a');
    lbl(3,'L','FLT NBR'); prompt(3,'L',I.flt||box(8),I.flt?'c':'a');
    prompt(3,'R','IRS INIT>','w');
    lbl(4,'L','LAT'); lbl(4,'R','LONG');
    if(p.from){ const a=P[p.from]; const lat=60+a.y/60, lon=10+a.x/30; const dm=(v,h,w)=>{ const d=Math.floor(Math.abs(v)), m=(Math.abs(v)-d)*60; return String(d).padStart(w,'0')+m.toFixed(1).padStart(4,'0')+h; }; prompt(4,'L',dm(lat,'N',2),'c'); prompt(4,'R',dm(lon,'E',3),'c'); }
    else { prompt(4,'L','----.-','w'); prompt(4,'R','-----.--','w'); }
    lbl(5,'L','COST INDEX'); prompt(5,'L',I.ci!=null?String(I.ci):(p.from?box(3):'---'),I.ci!=null?'c':(p.from?'a':'w'));
    prompt(5,'R','WIND/TEMP>','w');
    lbl(6,'L','CRZ FL/TEMP'); prompt(6,'L',I.crz?('FL'+p3(I.crz)+'/'+(I.temp!=null?(I.temp>0?'+':'')+I.temp+'°':'---°')):(p.from?box(5)+'/'+box(3)+'°':'-----/---°'),I.crz?'c':(p.from?'a':'w'));
    lbl(6,'R','TROPO'); prompt(6,'R','36090','c'); scr[DR(6)].forEach((x,i)=>{ if(i>=19) x.s=1; });
  },
  lsk(s,n){
    const v=S.sp, I=S.init;
    if(S.clr){ if(s==='L'&&n===2&&altnOf()){ S.act.altn=null; S.init.altn=null; take(); return; } if(s==='L'&&n===5){ I.ci=null; take(); return; } msg('NOT ALLOWED'); return; }
    if(s==='R'&&n===1){ if(!v) return; const m=/^([A-Z]{4})\/([A-Z]{4})$/.exec(v); if(!m){ msg('FORMAT ERROR'); return; } if(!AP[m[1]]||!AP[m[2]]){ msg('NOT IN DATA BASE'); return; } S.act=newPlan(m[1],m[2]); S.act.altn=null; S.init.altn=null; S.init.co=''; S.tmpy=null; take(); const rs=Object.keys(CORTE).filter(k=>CORTE[k].from===m[1]&&CORTE[k].to===m[2]); go('rtesel',{rsel:{list:rs,i:0}}); return; }
    if(s==='L'&&n===1){ if(!v) return; const c=CORTE[v]; if(!c){ msg('NOT IN DATA BASE'); return; } const p=newPlan(c.from,c.to); p.items=[{k:'apt',id:c.from,seg:'o'},{k:'disc',seg:'enr'}].concat(c.route.map(r=>W(r[0],{seg:'enr',via:r[1]})),[{k:'disc',seg:'enr'},{k:'dest',id:c.to,seg:'d'}]); p.altn=c.altn; S.act=p; S.init.altn=c.altn; S.init.co=v; take(); return; }
    if(s==='L'&&n===2){ if(!v) return; const a=v.split('/')[0]; if(!S.act.from){ msg('NOT ALLOWED'); return; } if(!AP[a]){ msg('NOT IN DATA BASE'); return; } S.act.altn=a; S.init.altn=a; take(); return; }
    if(s==='L'&&n===3){ if(!v) return; if(!/^[A-Z0-9]{1,8}$/.test(v)){ msg('FORMAT ERROR'); return; } I.flt=v; take(); return; }
    if(s==='R'&&n===2){ msg('NOT AVAILABLE'); return; }
    if(s==='R'&&n===3){ go('irs'); return; }
    if(s==='R'&&n===5){ msg('NOT AVAILABLE'); return; }
    if(s==='L'&&n===5){ if(!v) return; if(!S.act.from){ msg('NOT ALLOWED'); return; } const c=ckNum(v,0,999); if(c==null) return; I.ci=c; take(); return; }
    if(s==='L'&&n===6){ if(!v) return; if(!S.act.from){ msg('NOT ALLOWED'); return; } const m=/^(?:FL)?(\d{2,3})?(?:\/([-+]?\d{1,2}))?$/.exec(v); if(!m||(!m[1]&&m[2]==null)){ msg('FORMAT ERROR'); return; } if(m[1]){ const f=+m[1]; if(f<10||f>398){ msg('ENTRY OUT OF RANGE'); return; } I.crz=f; if(m[2]==null&&I.temp==null) I.temp=Math.round(15-2*f/10); } if(m[2]!=null) I.temp=+m[2]; take(); return; }
    if(s==='R'&&n===6){ if(v) msg('NOT ALLOWED'); return; }
    if(v) msg('NOT ALLOWED');
  },
  slew(){ go('initb'); }
};
PG.rtesel={
  draw(){ const R=S.rsel||{list:[]}, k=R.list[R.i], c=k?CORTE[k]:null;
    put(0,1,'ROUTE SELECTION','w'); if(R.list.length) putR(0,(R.i+1)+'/'+R.list.length+' ','w',1);
    if(c){ put(LR(1),1,'CO RTE','w',1); prompt(1,'L',k,'g'); putR(DR(1),c.from+'/'+c.to,'g');
      const via=[c.route[0][0]]; c.route.forEach((r,i)=>{ if(!i) return; const nx=c.route[i+1]; if(r[1]){ if(!nx||nx[1]!==r[1]) via.push(r[1],r[0]); } else via.push(r[0]); });
      lbl(2,'L','ROUTE'); const line=via.join(' '); put(DR(2),0,line.slice(0,24),'g'); if(line.length>24) put(DR(3),0,line.slice(24,48),'g');
      lbl(4,'L','ALTN'); prompt(4,'L',c.altn,'g'); prompt(6,'R','INSERT*','a'); }
    else { putC(DR(2),'NONE','w'); }
    prompt(6,'L','<RETURN'); },
  lsk(s,n){ const R=S.rsel||{list:[]}, k=R.list[R.i];
    if(s==='L'&&n===6){ go('init'); return; }
    if(s==='R'&&n===6&&k){ const c=CORTE[k]; const p=newPlan(c.from,c.to); p.items=[{k:'apt',id:c.from,seg:'o'},{k:'disc',seg:'enr'}].concat(c.route.map(r=>W(r[0],{seg:'enr',via:r[1]})),[{k:'disc',seg:'enr'},{k:'dest',id:c.to,seg:'d'}]); p.altn=c.altn; S.act=p; S.init.altn=c.altn; S.init.co=k; go('init'); return; }
    if(S.sp) msg('NOT ALLOWED'); },
  slew(d){ const R=S.rsel; if(R&&R.list.length) R.i=(R.i+d+R.list.length)%R.list.length; }
};
function parseAlt(v){ const m=/^([+-]?)(?:FL(\d{2,3})|(\d{3,5}))$/.exec(v); if(!m) return null; if(m[2]){ const f=+m[2]; if(f<10||f>398) return 'RANGE'; return m[1]+'FL'+p3(f); } const a=+m[3]; if(a<0||a>39000) return 'RANGE'; return m[1]+String(Math.round(a/10)*10); }
PG.vrev={
  draw(){ const V=S.vr, p=planFor(V.view), it=p.items[V.i]; if(!it){ go('fpln'); return; }
    put(0,1,'VERT REV','w'); put(0,10,'AT','w',1); put(0,13,it.id,'g');
    const F=fuel(); lbl(1,'L',' EFOB='+(F&&F.efob!=null?(F.efob+F.trip*0.3).toFixed(1):'---.-')); putR(LR(1),'EXTRA='+(F&&F.extra!=null?F.extra.toFixed(1):'---.-'),'w',1);
    const des=['star','via','app'].includes(it.seg);
    lbl(2,'L',des?'DES SPD LIM':'CLB SPD LIM'); prompt(2,'L','250/FL100','m'); scr[DR(2)].forEach((x,i)=>{ if(i<9) x.s=1; });
    prompt(2,'R','RTA>');
    lbl(3,'L',' SPD CSTR'); prompt(3,'L',it.spd?'*'+it.spd:'[ ]',it.spd?'m':'c');
    lbl(3,'R','ALT CSTR '); prompt(3,'R',it.alt?String(it.alt):'[    ]',it.alt?'m':'c');
    prompt(4,'L','<WIND'); prompt(4,'R','STEP ALTS>');
    prompt(6,'L','<RETURN');
  },
  lsk(s,n){ const V=S.vr, p=planFor(V.view), it=p.items[V.i], v=S.sp;
    if(n===6&&s==='L'){ go('fpln',{view:V.view}); return; }
    if(S.clr){ S.clr=false; if(s==='L'&&n===3){ delete it.spd; return; } if(s==='R'&&n===3){ delete it.alt; return; } msg('NOT ALLOWED'); return; }
    if(s==='L'&&n===3){ if(!v) return; const c=ckNum(v.replace(/^\*/,''),100,350); if(c==null) return; it.spd=c; take(); return; }
    if(s==='R'&&n===3){ if(!v) return; const a=parseAlt(v.replace(/^\//,'')); if(!a){ msg('FORMAT ERROR'); return; } if(a==='RANGE'){ msg('ENTRY OUT OF RANGE'); return; } it.alt=a; take(); return; }
    if((s==='R'&&(n===2||n===4))||(s==='L'&&n===4)){ msg('NOT AVAILABLE'); return; }
    if(v) msg('NOT ALLOWED'); }
};
PG.irs={draw(){ title('IRS INIT'); lbl(1,'L','LAT'); lbl(1,'R','LONG'); prompt(1,'L','6000.0N','c'); prompt(1,'R','01000.0E','c'); lbl(2,'L','REFERENCE'); prompt(2,'L',S.act.from||'----','g'); lbl(3,'L','GPS POSITION'); prompt(3,'L','6000.0N/01000.0E','g'); put(DR(4),0,'IRS1 ALIGN ON GPS','g'); put(DR(4)+1,0,'IRS2 ALIGN ON GPS','g'); prompt(6,'L','<RETURN'); prompt(6,'R',S.init.irs?'ALIGNED':'ALIGN ON REF*',S.init.irs?'g':'a'); },
  lsk(s,n){ if(s==='L'&&n===6){ go('init'); return; } if(s==='R'&&n===6){ S.init.irs=true; return; } if(S.sp) msg('NOT ALLOWED'); }};

/* ---------- INIT B (fuel prediction) ---------- */
PG.initb={
  draw(){
    const f=S.fb, F=fuel(), pr=F&&F.pred;
    putC(0,f.block!=null?'INIT FUEL PREDICTION':'INIT','w'); putR(0,'←','w');
    lbl(1,'L','TAXI'); prompt(1,'L',f.taxi.toFixed(1),'c'); if(!f.taxiSet) scr[DR(1)].forEach((x,i)=>{ if(i<4) x.s=1; });
    lbl(1,'R','ZFW/ZFWCG'); prompt(1,'R',(f.zfw!=null?f.zfw.toFixed(1):box(4))+'/'+(f.cg!=null?f.cg.toFixed(1):box(4)),'c'); if(f.zfw==null||f.cg==null){ const t=(f.zfw!=null?f.zfw.toFixed(1):box(4))+'/'+(f.cg!=null?f.cg.toFixed(1):box(4)); scr[DR(1)].forEach((x,i)=>{ if(i>=COLS-t.length&&x.c==='/') x.k='w'; }); }
    lbl(2,'L','TRIP /TIME'); prompt(2,'L',pr?F.trip.toFixed(1)+'/'+hhmm(F.time):'---.-/----','g');
    lbl(2,'R','BLOCK'); prompt(2,'R',f.block!=null?f.block.toFixed(1):(f.fp!=null?f.fp.toFixed(1):box(4)),f.block!=null||f.fp!=null?'c':'a'); if(f.block==null&&f.fp!=null) scr[DR(2)].forEach((x,i)=>{ if(i>18) x.s=1; });
    lbl(3,'L','RTE RSV/%'); prompt(3,'L',(pr?F.rsv.toFixed(1):'---.-')+'/5.0','c');
    if(f.zfw!=null&&f.block==null){ prompt(3,'R',f.fp!=null?'BLOCK CONFIRM*':'FUEL PLANNING }','a'); }
    lbl(4,'L','ALTN /TIME'); prompt(4,'L',pr&&altnOf()?F.altn.toFixed(1)+'/'+hhmm(F.atime):'---.-/----','c'); if(pr&&altnOf()) scr[DR(4)].forEach((x,i)=>{ if(i>=5&&i<9) x.k='g'; });
    lbl(4,'R','TOW/   LW'); prompt(4,'R',pr&&F.tow!=null?F.tow.toFixed(1)+'/'+F.lw.toFixed(1):'---.-/---.-','g');
    lbl(5,'L','FINAL/TIME'); prompt(5,'L',(pr?F.fin.toFixed(1):'---.-')+'/0030','c');
    lbl(5,'R','TRIP WIND'); prompt(5,'R','HD000','c'); scr[DR(5)].forEach((x,i)=>{ if(i>18) x.s=1; });
    lbl(6,'L','MIN DEST FOB'); prompt(6,'L',pr?F.mdf.toFixed(1):'---.-','c');
    lbl(6,'R','EXTRA/TIME'); prompt(6,'R',pr&&F.extra!=null?F.extra.toFixed(1)+'/'+hhmm(Math.max(0,F.extra)/2.4*60):'---.-/----','g');
  },
  lsk(s,n){
    const v=S.sp, f=S.fb;
    if(S.clr){ msg('NOT ALLOWED'); return; }
    if(S.phase!=='PRE'){ msg('NOT ALLOWED'); return; }
    if(s==='R'&&n===1){ if(!v) return; const m=/^(\d{1,2}(?:\.\d)?)?(?:\/(\d{1,2}(?:\.\d)?))?$/.exec(v); if(!m||(!m[1]&&!m[2])){ msg('FORMAT ERROR'); return; } if(m[1]){ const z=+m[1]; if(z<35||z>64.3){ msg('ENTRY OUT OF RANGE'); return; } f.zfw=z; } if(m[2]){ const c=+m[2]; if(c<8||c>50){ msg('ENTRY OUT OF RANGE'); return; } f.cg=c; } take(); return; }
    if(s==='R'&&n===2){ if(!v) return; const b=ckNum(v,1,19,1); if(b==null) return; f.block=b; f.fp=null; take(); return; }
    if(s==='R'&&n===3&&f.zfw!=null&&f.block==null){ if(v){ msg('NOT ALLOWED'); return; } if(f.fp!=null){ f.block=f.fp; f.fp=null; return; } const F=fuel(); if(!F){ msg('NOT ALLOWED'); return; } f.fp=+(f.taxi+F.trip+F.rsv+F.altn+F.fin).toFixed(1); return; }
    if(s==='L'&&n===1){ if(!v) return; const t=ckNum(v,0,9.9,1); if(t==null) return; f.taxi=t; f.taxiSet=1; take(); return; }
    if(v) msg('NOT ALLOWED');
  },
  slew(){ go('init'); }
};

/* ---------- F-PLN ---------- */
function vprof(view){
  /* teaching vertical profile: climb ~270 ft/NM, 3° descent ~318 ft/NM; only when predictions are available */
  const p=planFor(view), fl=flyingPlan()&&view==='act', F=fuel(), d0=destOf(p);
  if(!S.init.crz||!d0||!p.items.length) return null;
  if(!fl&&!(F&&F.pred)) return null;
  const crz=S.init.crz*100, eD=P[d0.id]?P[d0.id].elev:0, eO=p.from&&P[p.from]?P[p.from].elev:0;
  const cum=[]; let prev=fl?S.pos:null, c=0;
  p.items.forEach((it,i)=>{ const q=coord(it); if(fl&&i===0){ cum[i]=0; return; } if(q&&prev) c+=dist(prev,q); if(q) prev=q; cum[i]=c; });
  const total=cum[p.items.indexOf(d0)]||c;
  const top=fl?(S.phase==='CRZ'?crz:Math.min(crz,S.alt)):crz;
  const alt=d=>Math.max(0,Math.min(top,fl?Infinity:eO+270*d,eD+318*(total-d)));
  const tc=fl?-1:(crz-eO)/270, td=total-(top-eD)/318;
  const ps=[];
  if(!fl){ if(10000>eO&&(10000-eO)/270<tc) ps.push({n:'(LIM)',d:(10000-eO)/270}); if(tc<td) ps.push({n:'(T/C)',d:tc}); }
  if(td>0&&tc<td) ps.push({n:'(T/D)',d:td});
  const ld=total-(10000-eD)/318; if(top>10000&&ld>0&&ld>td) ps.push({n:'(LIM)',d:ld,des:1});
  const ai=p.items.findIndex(x=>x.seg==='app'&&isW(x)); if(ai>0&&cum[ai]!=null) ps.push({n:'(DECEL)',d:Math.max(0,cum[ai]-0.01),decel:1});
  ps.sort((a,b)=>a.d-b.d);
  const ta=d=>(!fl&&d<tc)?(AP[p.from]?AP[p.from].ta:7000):(AP[d0.id]?AP[d0.id].ta:5000);
  const fa=d=>{ const a=alt(d); return a<ta(d)?String(Math.round(a/10)*10):'FL'+p3(Math.round(a/100)); };
  const dec=ps.find(x=>x.decel);
  const sp=d=>{ const a=alt(d); if(dec&&d>=dec.d) return '137'; if(!fl&&d<tc) return a<10000?'250':(a<28000?'300':'.78'); if(d>=td) return a<10000?'250':(a<28000?'290':'.78'); return '.78'; };
  return {cum,total,ps,fa,sp,alt,fl};
}
function fplnRows(view){
  const p=planFor(view), rows=[], tm=S.tmpy&&S.tmpy.tgt===view, V=tm?null:vprof(view);
  const ps=V?V.ps.slice():[];
  p.items.forEach((it,i)=>{
    if(V&&i>0&&coord(it)){ while(ps.length&&ps[0].d<V.cum[i]){ const x=ps.shift(); if(x.d>=0) rows.push({ps:x}); } }
    rows.push({it,i});
  });
  if(p.miss&&p.miss.length) p.miss.forEach(m=>rows.push({it:m,miss:1}));
  rows.push({end:'------END OF F-PLN------'});
  const al=p.altn||(view==='act'?S.init.altn:null);
  if(al&&destOf(p)&&destOf(p).id!==al){ rows.push({it:{k:'wpt',id:al==='XFJB'?'FJB':al,seg:'altn'},alt:1}); rows.push({it:{k:'dest',id:al,seg:'altn'},alt:1}); rows.push({end:'---END OF ALTN F-PLN---'}); }
  else rows.push({end:'-----NO ALTN F-PLN-----'});
  return rows;
}
function predict(view){
  const V=vprof(view); if(V) return V.cum.map(d=>({d}));
  const p=planFor(view), fl=flyingPlan()&&view==='act';
  const out=[]; let prev=fl?S.pos:null, cum=0;
  p.items.forEach((it,i)=>{ const c=coord(it); if(fl&&i===0){ out[i]={d:0}; return; } if(c&&prev) cum+=dist(prev,c); if(c) prev=c; out[i]={d:cum}; });
  return out;
}
PG.fpln={
  draw(){
    const view=S.view||'act', p=planFor(view), tm=S.tmpy&&S.tmpy.tgt===view, fl=flyingPlan()&&view==='act';
    if(!p.from){ title(view==='sec'?'SEC':''); put(0,1,view==='sec'?'SEC':'','w'); put(4,0,'------END OF F-PLN------','w'); put(6,0,'---NO ALTN F-PLN-------','w'); scratch(); return; }
    put(0,1,tm?'TMPY':(view==='sec'?'SEC':'FROM'),tm?'y':'w',tm?0:1);
    if(view==='sec'&&!tm) put(0,5,'FROM','w',1);
    putR(0,S.init.flt||'','w',1,1);
    const rows=fplnRows(view), pr=predict(view);
    const ord=destOf(p);
    S.off=Math.max(0,Math.min(S.off,rows.length-1));
    if(S.off===0){ put(LR(1),8,fl?'UTC':'TIME','w',1); putR(LR(1),'SPD/ALT   ','w',1); }
    for(let n=1;n<=5;n++){
      const r=rows[S.off+n-1]; if(!r) break;
      const dr=DR(n), lr=LR(n);
      if(r.end){ put(dr,0,r.end,'w'); continue; }
      if(r.ps){ const V=vprof(view); put(dr,0,r.ps.n,view==='sec'?'w':'g'); const t=fl?hhmm(S.utc+r.ps.d/7.2):hhmm(2+r.ps.d/7); put(dr,8,t,'g'); putR(dr,V.sp(r.ps.d)+'/'+V.fa(r.ps.d).padStart(6,' '),'g'); continue; }
      const it=r.it;
      if(it.k==='disc'){ put(dr,0,'---F-PLN DISCONTINUITY--','w'); continue; }
      const col=tm?'y':(r.miss||r.alt?'c':(view==='sec'?'w':'g'));
      const isFrom=r.i===0, isTo=r.i===1&&view==='act';
      if(it.k==='hold'){ put(dr,0,'HOLD '+it.turn,col); if(fl&&S.hz&&r.i===1&&!tm){ put(lr,9,'INB'+p3(it.crs)+'°','w',1); putR(dr,'IMM EXIT*','a'); } else { put(dr,9,'INB'+p3(it.crs)+'°',col,1); putR(dr,(it.time||1).toFixed(1)+'MIN',col,1); } continue; }
      if(it.k==='man'){ put(dr,0,'MANUAL',col); continue; }
      let id=it.k==='apt'?it.id+(it.rwy||''):it.k==='dest'?it.id+(it.rwy||''):it.id;
      if(it.ov) id+='Δ';
      const c=tm?'y':(r.miss||r.alt)?'c':((isFrom||isTo)&&view==='act')?'w':col;
      put(dr,0,id.slice(0,8),c);
      /* label line: via / track / distance */
      if(!(n===1&&S.off===0)&&r.i>0){
        let pj=r.i-1; while(pj>0&&p.items[pj]&&p.items[pj].k==='hold') pj--;
        const prv=r.miss||r.alt?null:p.items[pj];
        const a=prv&&prv.k!=='disc'?coord(prv):null, b=coord(it);
        if(it.via) put(lr,0,String(it.via).slice(0,7),'w',1);
        if(it.rin!=null) put(lr,0,'IN'+p3(it.rin)+'°','w',1);
        if(a&&b){ const isToLeg=r.i===1&&view==='act'&&!tm; const from=isToLeg&&fl?S.pos:a; const pre=isToLeg?'BRG':(['sid','star','via','app'].includes(it.seg)?'C':'TRK'); put(lr,8,pre+p3(brg(from,b))+'°','w',1); putR(lr,Math.round(dist(a,b))+'NM','w',1,4); }
      }
      /* time and spd/alt */
      const q=r.i!=null?pr[r.i]:null;
      if(q&&!(fl&&isFrom)){ const t=fl?hhmm(S.utc+q.d/7.2):hhmm(q.d?2+q.d/7:0); put(dr,8,t,tm?'y':'g'); }
      else if(fl&&isFrom){ put(dr,8,hhmm(S.utc-6),'w'); }
      const V=tm||r.miss||r.alt?null:vprof(view);
      let spd='---', altT;
      if(it.k==='apt'){ altT=String(P[it.id].elev); if(S.perf.v1&&view==='act') spd=String(S.perf.v1); }
      else if(it.k==='dest') altT=String(P[it.id].elev);
      else if(it.alt) altT=String(it.alt);
      else if(V&&V.cum[r.i]!=null){ altT=V.fa(V.cum[r.i]); spd=V.sp(V.cum[r.i]); }
      else altT='-----';
      if(V&&V.cum[r.i]!=null&&!it.spd&&it.k==='wpt') spd=V.sp(V.cum[r.i]);
      if(it.spd) spd='*'+it.spd;
      const base=tm?'y':(r.miss||r.alt?'c':'g');
      putR(dr,spd+'/'+altT.padStart(6,' '),base);
      if(it.k==='wpt'&&!tm){ if(it.alt) putR(dr,altT.padStart(6,' '),'m'); if(it.spd) put(dr,COLS-7-spd.length,spd,'m'); }
    }
    /* line 6 */
    if(tm){ prompt(6,'L','<ERASE','a'); prompt(6,'R','INSERT*','a'); put(LR(6),0,' TMPY','y',1); }
    else if(ord){
      put(LR(6),0,'DEST','w',1); put(LR(6),8,fl?'UTC':'TIME','w',1); put(LR(6),13,'DIST','w',1); putR(LR(6),'EFOB','w',1);
      const F=fuel(), rest=fl?remainDist(p):totalDist(p);
      put(DR(6),0,ord.id+(ord.rwy||''),'w'); put(DR(6),8,fl?hhmm(S.utc+rest/7.2):hhmm(2+rest/7),'g'); put(DR(6),13,String(Math.round(rest)).padStart(4,' '),'g'); putR(DR(6),F&&F.efob!=null?F.efob.toFixed(1):'--.-',F&&F.efob!=null&&F.efob<F.mdf?'a':'g');
    }
    scratch();
  },
  rows(){ return fplnRows(S.view||'act'); },
  lsk(s,n){
    const view=S.view||'act', rows=fplnRows(view);
    if(n===6){
      if(S.tmpy&&S.tmpy.tgt===view){ if(s==='L'){ S.tmpy=null; S.clr=false; return; } if(s==='R'){ insertTmpy(); return; } }
      if(s==='L'){ const p=planFor(view); const di=p.items.findIndex(x=>x.k==='dest'); if(di<0) return; if(S.sp&&!S.clr){ msg('NOT ALLOWED'); return; } openLatRev(view,di); return; }
      if(s==='R'){ msg('NOT AVAILABLE'); return; }
      return;
    }
    const r=rows[S.off+n-1]; if(!r) return;
    if(s==='R'){
      const p0=planFor(view), fl0=flyingPlan()&&view==='act';
      if(r.it&&r.it.k==='hold'&&fl0&&S.hz&&r.i===1&&!S.sp&&!S.clr){ p0.items.splice(1,1); S.hz=null; return; }
      if(r.ps||r.end||r.miss||r.alt||!r.it||r.it.k!=='wpt'||r.it.id==='T-P'||(fl0&&r.i===0)){ if(S.sp||S.clr) msg('NOT ALLOWED'); return; }
      const it0=p0.items[r.i];
      if(S.clr){ S.clr=false; delete it0.alt; delete it0.spd; return; }
      if(S.sp){ const m=/^(\d{3})?\/(.*)$/.exec(S.sp); if(!m){ msg('FORMAT ERROR'); return; } let a=null; if(m[2]){ a=parseAlt(m[2]); if(!a){ msg('FORMAT ERROR'); return; } if(a==='RANGE'){ msg('ENTRY OUT OF RANGE'); return; } } if(!m[1]&&!a){ msg('FORMAT ERROR'); return; } if(m[1]){ const v=+m[1]; if(v<100||v>350){ msg('ENTRY OUT OF RANGE'); return; } it0.spd=v; } if(a) it0.alt=a; take(); return; }
      S.vr={view,i:r.i}; go('vrev'); return;
    }
    if(r.end||r.miss||r.alt||r.ps){ if(S.sp||S.clr){ msg('NOT ALLOWED'); S.clr=false; } return; }
    const p=planFor(view), it=r.it, i=r.i, fl=flyingPlan()&&view==='act';
    if(fl&&i===1&&S.ap==='NAV'&&(S.clr||(S.sp&&S.sp!=='Δ'))&&it.k!=='disc'){ S.clr=false; msg('NOT ALLOWED IN NAV'); return; }
    if(S.clr){
      S.clr=false;
      if(it.k==='disc'){ p.items.splice(i,1); tidy(p); return; }
      if(it.k==='hold'){ p.items.splice(i,1); return; }
      if(it.k==='apt'||it.k==='dest'||(fl&&i===0)){ msg('NOT ALLOWED'); return; }
      p.items.splice(i,1,{k:'disc',seg:it.seg}); tidy(p); return;
    }
    if(S.sp){
      const v=S.sp;
      if(v==='Δ'){ if(it.k!=='wpt'){ msg('NOT ALLOWED'); return; } const tp=startTmpy(view); if(!tp) return; tp.items[i].ov=!tp.items[i].ov; take(); return; }
      if(i===0||it.k==='apt'){ msg('NOT ALLOWED'); return; }
      if(!/^[A-Z0-9]{2,7}$/.test(v)){ msg('FORMAT ERROR'); return; }
      const inPlan=p.items.some(x=>isW(x)&&x.id===v);
      if(!P[v]||P[v].t==='APT'||P[v].t==='RWY'){ if(!inPlan){ msg('NOT IN DATA BASE'); return; } }
      if(S.tmpy&&S.tmpy.tgt!==view){ msg('TMPY F-PLN EXISTS',true); return; } insertAt(p,i,v); take(); return;
    }
    if(it.k==='disc'){ return; }
    if(it.k==='hold'){ openHold(view,i-1,true); return; }
    openLatRev(view,i);
  },
  scroll(d){ const n=fplnRows(S.view||'act').length; S.off=Math.max(0,Math.min(n-1,S.off+d)); },
  airport(){ const rows=fplnRows(S.view||'act'); const idx=[0]; rows.forEach((r,i)=>{ if(r.it&&r.it.k==='dest') idx.push(Math.max(0,i-4)); }); const cur=idx.indexOf(S.off); S.off=idx[(cur+1)%idx.length]; }
};
function remainDist(p){ let d=0, prev=S.pos; p.items.forEach((it,i)=>{ if(i===0) return; const c=coord(it); if(c){ if(prev) d+=dist(prev,c); prev=c; } }); return d; }

/* ---------- LAT REV ---------- */
function openLatRev(view,i){ const p=planFor(view); S.lr={view,i,id:p.items[i].id,k:p.items[i].k}; go('latrev'); }
const llOf=q=>{ const lat=60+q.y/60, lon=10+q.x/30; const dm=(v,h,w)=>{ const d=Math.floor(Math.abs(v)), m=(Math.abs(v)-d)*60; return String(d).padStart(w,'0')+m.toFixed(1).padStart(4,'0')+h; }; return dm(lat,'N',2)+'/'+dm(lon,'E',3); };
PG.latrev={
  draw(){
    const L=S.lr, p=planFor(L.view), it=p.items[L.i]||{}, tm=S.tmpy&&S.tmpy.tgt===L.view, fl=flyingPlan()&&L.view==='act';
    const ppos=fl&&L.i===0, from=L.i===0, q=coord(it);
    put(0,1,'LAT REV','w'); put(0,9,'FROM','w',1); put(0,14,ppos?'PPOS':(it.id||'')+(it.rwy&&it.k==='apt'?it.rwy:''),tm?'y':'g');
    put(LR(1),3,llOf(ppos?S.pos:(q||{x:0,y:0})),'g',1);
    if(it.k==='apt'){ prompt(1,'L','<DEPARTURE'); if(from) prompt(1,'R','FIX INFO>'); lbl(2,'R','LL XING/INCR/NO'); prompt(2,'R','[ ]°/[ ]°/[]','c'); lbl(3,'R','NEXT WPT '); prompt(3,'R','[    ]','c'); lbl(4,'R','NEW DEST '); prompt(4,'R','[  ]','c'); }
    else if(it.k==='dest'){ prompt(1,'R','ARRIVAL>'); if(fl&&(S.act.altn||S.init.altn)) prompt(4,'L','<ENABLE ALTN'); prompt(5,'L','<ALTN'); }
    else if(ppos){ prompt(1,'R','FIX INFO>'); prompt(2,'L','<OFFSET'); lbl(2,'R','LL XING/INCR/NO'); prompt(2,'R','[ ]°/[ ]°/[]','c'); prompt(3,'L','<HOLD'); }
    else {
      if(from) prompt(1,'R','FIX INFO>');
      prompt(2,'L','<OFFSET'); lbl(2,'R','LL XING/INCR/NO'); prompt(2,'R','[ ]°/[ ]°/[]','c'); prompt(3,'L','<HOLD');
      if(fl&&(S.act.altn||S.init.altn)) prompt(4,'L','<ENABLE ALTN');
      lbl(3,'R','NEXT WPT '); prompt(3,'R','[    ]','c'); lbl(4,'R','NEW DEST '); prompt(4,'R','[  ]','c'); prompt(5,'R','AIRWAYS>');
    }
    if(tm){ prompt(6,'L','<TMPY F-PLN','y'); prompt(6,'R','INSERT*','a'); } else prompt(6,'L','<RETURN');
  },
  lsk(s,n){
    const L=S.lr, p=planFor(L.view), it=p.items[L.i]||{}, v=S.sp, fl=flyingPlan()&&L.view==='act', ppos=fl&&L.i===0;
    if(n===6){ if(s==='L'){ go('fpln',{view:L.view}); return; } if(s==='R'&&S.tmpy&&S.tmpy.tgt===L.view){ insertTmpy(); go('fpln',{view:L.view}); return; } return; }
    const ena=()=>{ const al=S.act.altn||S.init.altn; if(!al) return; const tp=startTmpy('act'); if(!tp) return; enableAltn(tp,L.i,al); go('fpln',{view:'act',off:0}); };
    if(it.k==='apt'&&s==='L'&&n===1){ if(v){ msg('NOT ALLOWED'); return; } S.dep={stage:'rwy',off:0}; go('dep'); return; }
    if(it.k==='dest'){
      if(s==='R'&&n===1){ if(v){ msg('NOT ALLOWED'); return; } S.arr={stage:'app',off:0}; go('arr'); return; }
      if(s==='L'&&n===4&&fl){ ena(); return; }
      if(s==='L'&&n===5){ msg('NOT AVAILABLE'); return; }
      if(v) msg('NOT ALLOWED'); return;
    }
    if(s==='R'&&n===1&&L.i===0){ msg('NOT AVAILABLE'); return; }
    if(s==='R'&&n===2){ msg('NOT AVAILABLE'); return; }
    if(it.k!=='apt'){
      if(s==='L'&&n===2){ msg('NOT AVAILABLE'); return; }
      if(s==='L'&&n===3){ if(v){ msg('NOT ALLOWED'); return; } openHold(L.view,L.i,false); return; }
      if(ppos){ if(v) msg('NOT ALLOWED'); return; }
      if(s==='L'&&n===4&&fl){ ena(); return; }
      if(s==='R'&&n===5){ if(v){ msg('NOT ALLOWED'); return; } S.awy={view:L.view,i:L.i,from:it.id,rows:[]}; go('awy'); return; }
    }
    if(s==='R'&&n===3){ if(!v) return; if(!P[v]||P[v].t==='APT'){ msg('NOT IN DATA BASE'); return; } const tp=startTmpy(L.view); if(!tp) return; insertAt(tp,L.i+1,v); take(); go('fpln',{view:L.view}); return; }
    if(s==='R'&&n===4){ if(!v) return; if(!AP[v]){ msg('NOT IN DATA BASE'); return; } const tp=startTmpy(L.view); if(!tp) return; tp.items=tp.items.slice(0,L.i+1).concat([{k:'disc',seg:'enr'},{k:'dest',id:v,seg:'d'}]); tp.to=v; tp.miss=[]; tp.appr=tp.star=tp.via=null; take(); go('fpln',{view:L.view}); return; }
    if(v) msg('NOT ALLOWED');
  }
};
function enableAltn(p,i,al){
  const keep=p.items.slice(0,i+1);
  p.items=keep.concat([W(al==='XFJB'?'FJB':al,{seg:'enr',via:''}),{k:'dest',id:al,seg:'d'}]);
  p.to=al; p.altn=null; p.miss=[]; p.appr=p.star=p.via=null; p.aRwy=null;
}

/* ---------- DEPARTURES ---------- */
PG.dep={
  draw(){
    const view=S.lr.view, p=planFor(view), tm=S.tmpy&&S.tmpy.tgt===view, D=S.dep, k=tm?'y':'g';
    put(0,1,'DEPARTURES','w'); put(0,12,'FROM','w',1); put(0,17,p.from,'g'); putR(0,'→','w');
    lbl(1,'L',' RWY'); putC(LR(1),'SID','w',1); lbl(1,'R','TRANS ');
    prompt(1,'L',p.dRwy||'---',k); putC(DR(1),p.sid||(p.noSid?'NONE':'------'),k); prompt(1,'R',p.trans||(p.noTrans?'NONE':'------'),k);
    const list=depList(p);
    if(D.stage==='rwy') lbl(2,'L','AVAILABLE RUNWAYS'); else { lbl(2,'L','SIDS'); putC(LR(2),'AVAILABLE','w',1); lbl(2,'R','TRANS'); prompt(2,'R','NO TRANS→','c'); }
    list.slice(D.off,D.off+4).forEach((x,j)=>{ const n=2+j; const sel=(D.stage==='rwy'&&x.v===p.dRwy)||(D.stage==='sid'&&x.v&&x.v===p.sid); prompt(n,'L',(sel?' ':'←')+x.t,sel?k:'c'); if(x.r) put(DR(n),6,x.r,'c',1); });
    if(list.length>4) putR(LR(6),'↓↑','w');
    if(tm){ prompt(6,'L','<TMPY F-PLN','y'); prompt(6,'R','INSERT*','a'); } else prompt(6,'L','<RETURN');
  },
  lsk(s,n){
    const view=S.lr.view, D=S.dep;
    if(n===6){ if(s==='L'){ go('fpln',{view,off:0}); return; } if(s==='R'&&S.tmpy&&S.tmpy.tgt===view){ insertTmpy(); go('fpln',{view,off:0}); return; } return; }
    if(S.sp){ msg('NOT ALLOWED'); return; }
    if(n===1){ D.stage=s==='L'?'rwy':'sid'; D.off=0; return; }
    if(s==='R'&&n===2&&D.stage==='sid'){ const tp=startTmpy(view); if(!tp) return; tp.trans=null; tp.noTrans=true; return; }
    if(n>=2&&n<=5&&s==='L'){
      const p0=planFor(view), list=depList(p0), x=list[D.off+n-2]; if(!x) return;
      const tp=startTmpy(view); if(!tp) return;
      if(D.stage==='rwy'){ setDeparture(tp,x.v,null,null); tp.noSid=false; tp.noTrans=false; D.stage='sid'; D.off=0; }
      else { setDeparture(tp,tp.dRwy,x.v,null); tp.noSid=!x.v; tp.noTrans=false; }
    }
  },
  scroll(d){ const p=planFor(S.lr.view); S.dep.off=Math.max(0,Math.min(Math.max(0,depList(p).length-4),S.dep.off+d)); }
};
function depList(p){
  const A=AP[p.from], D=S.dep;
  if(D.stage==='rwy') return Object.keys(A.rwy).sort().map(r=>({t:r,v:r,r:p3(A.rwy[r].crs)+'° '+A.rwy[r].len+'M'+(A.rwy[r].ils?' '+A.rwy[r].ils:'')}));
  if(D.stage==='sid') return Object.keys(A.sid).filter(k=>A.sid[k].rwy===p.dRwy).sort().map(k=>({t:k,v:k})).concat([{t:'NO SID',v:null}]);
  return Object.keys(A.sid).filter(k=>A.sid[k].rwy===p.dRwy).sort().map(k=>({t:k,v:k})).concat([{t:'NO SID',v:null}]);
}

/* ---------- ARRIVAL ---------- */
function arrList(p){
  const d=destOf(p), A=AP[d.id], st=S.arr.stage;
  if(st==='app') return Object.keys(A.app).sort().map(k=>({t:k,v:k,r:p3(AP[d.id].rwy[A.app[k].rwy].crs)+'  '+AP[d.id].rwy[A.app[k].rwy].len+'M'}));
  if(st==='star'){ const r=p.aRwy; return Object.keys(A.star).filter(k=>!r||A.star[k].rwys.includes(r)).sort().map(k=>({t:k,v:k})).concat([{t:'NO STAR',v:null}]); }
  const ap=p.appr?A.app[p.appr]:null; return (ap?Object.keys(ap.vias).sort().map(k=>({t:k,v:k})):[]).concat([{t:'NO VIA',v:null}]);
}
PG.arr={
  draw(){
    const view=S.lr.view, p=planFor(view), tm=S.tmpy&&S.tmpy.tgt===view, d=destOf(p), st=S.arr.stage;
    put(0,1,'ARRIVAL','w'); put(0,9,'TO','w',1); put(0,12,d.id,'g'); putR(0,'←→','w');
    lbl(1,'L',' APPR'); putC(LR(1),'VIA','w',1); lbl(1,'R','STAR ');
    const k=tm?'y':'g';
    prompt(1,'L',p.appr||'------',k); putC(DR(1),p.via||(p.noVia?'NONE':'------'),k); prompt(1,'R',p.star||(p.noStar?'NONE':'------'),k);
    lbl(2,'R','TRANS '); prompt(2,'R','------','w'); if(p.appr) prompt(2,'L','<VIAS');
    const list=arrList(p);
    lbl(3,'L',st==='app'?'APPR':st==='star'?'STARS':'APPR VIAS'); putR(LR(3),'AVAILABLE','w',1);
    list.slice(S.arr.off,S.arr.off+3).forEach((x,j)=>{ const n=3+j; prompt(n,'L','←'+x.t,'c'); if(x.r) putR(DR(n),x.r,'c',1); });
    if(list.length>3) putR(LR(5),'↓↑','w');
    if(tm){ prompt(6,'L','<TMPY F-PLN','y'); prompt(6,'R','INSERT*','a'); } else prompt(6,'L','<RETURN');
  },
  lsk(s,n){
    const view=S.lr.view, A=S.arr;
    if(n===6){ if(s==='L'){ go('fpln',{view}); return; } if(s==='R'&&S.tmpy&&S.tmpy.tgt===view){ insertTmpy(); go('fpln',{view}); return; } return; }
    if(S.sp){ msg('NOT ALLOWED'); return; }
    if(n===1){ A.stage=s==='L'?'app':'star'; A.off=0; return; }
    if(n===2&&s==='L'){ A.stage='via'; A.off=0; return; }
    if(n>=3&&n<=5&&s==='L'){
      const p0=planFor(view), x=arrList(p0)[A.off+n-3]; if(!x) return;
      const tp=startTmpy(view); if(!tp) return;
      if(A.stage==='app'){ setArrival(tp,x.v,null,null); tp.noStar=tp.noVia=false; A.stage='star'; }
      else if(A.stage==='star'){ setArrival(tp,tp.appr,x.v,null); tp.noStar=!x.v; tp.noVia=false; A.stage='via'; }
      else { setArrival(tp,tp.appr,tp.star,x.v); tp.noVia=!x.v; }
      A.off=0;
    }
  },
  scroll(d){ const p=planFor(S.lr.view); S.arr.off=Math.max(0,Math.min(Math.max(0,arrList(p).length-3),S.arr.off+d)); }
};

/* ---------- AIRWAYS ---------- */
PG.awy={
  draw(){
    const a=S.awy, tm=S.tmpy&&S.tmpy.tgt===a.view;
    put(0,1,'AIRWAYS','w'); put(0,9,'FROM','w',1); put(0,14,a.from,'g');
    const lst=a.rows[a.rows.length-1]; const rows=lst&&!(lst.via&&lst.to)?a.rows.slice():a.rows.concat([{}]);
    rows.slice(0,5).forEach((r,j)=>{ const n=j+1; lbl(n,'L',' VIA'); lbl(n,'R','TO '); prompt(n,'L',r.via||'[   ]',r.via?(tm?'y':'c'):'c'); prompt(n,'R',r.to||'[   ]',r.to?(tm?'y':'c'):'c'); });
    if(tm){ prompt(6,'L','<TMPY F-PLN','y'); prompt(6,'R','INSERT*','a'); } else prompt(6,'L','<RETURN');
  },
  lsk(s,n){
    const a=S.awy, v=S.sp;
    if(n===6){ if(s==='L'){ go('fpln',{view:a.view}); return; } if(s==='R'&&S.tmpy&&S.tmpy.tgt===a.view){ insertTmpy(); go('fpln',{view:a.view}); return; } return; }
    if(!v) return;
    const j=n-1; if(j>a.rows.length){ msg('NOT ALLOWED'); return; }
    const row=a.rows[j]||{};
    if(s==='L'){ if(!AWY[v]&&v!=='DCT'){ msg('NOT IN DATA BASE'); return; } const prevTo=j===0?a.from:(a.rows[j-1]&&a.rows[j-1].to); if(!prevTo){ msg('NOT ALLOWED'); return; } if(v!=='DCT'&&AWY[v].indexOf(prevTo)<0){ msg('AWY/WPT MISMATCH'); return; } a.rows[j]={via:v,to:row.to||null}; take(); }
    else { if(!row.via){ if(P[v]&&P[v].t!=='APT'){ a.rows[j]={via:'DCT',to:v}; } else { msg('NOT IN DATA BASE'); return; } } else { if(!P[v]){ msg('NOT IN DATA BASE'); return; } if(row.via!=='DCT'&&AWY[row.via].indexOf(v)<0){ msg('AWY/WPT MISMATCH'); return; } a.rows[j]={via:row.via,to:v}; } take(); }
    const done=a.rows.filter(r=>r.via&&r.to);
    if(done.length===a.rows.length){
      if(S.tmpy&&S.tmpy.tgt===a.view&&!a.base) { /* restart from a clean copy each time so rows can be edited */ }
      if(S.tmpy&&S.tmpy.tgt!==a.view){ msg('TMPY F-PLN EXISTS',true); return; }
      if(!a.base) a.base=clone(S.tmpy&&S.tmpy.tgt===a.view?S.tmpy.plan:S[a.view]);
      const tp=clone(a.base); const fi=tp.items.findIndex((x,i)=>i>=0&&isW(x)&&x.id===a.from);
      const e=addAirways(tp,fi<0?a.i:fi,done); if(e){ msg(e); a.rows.pop(); return; }
      S.tmpy={tgt:a.view,plan:tp};
    }
  }
};

/* ---------- HOLD ---------- */
function openHold(view,i,existing){
  const p0=planFor(view), fix=p0.items[i]; if(!fix||!isW(fix)){ msg('NOT ALLOWED'); return; }
  const tp=startTmpy(view); if(!tp) return;
  let hi=tp.items.findIndex((x,j)=>j===i+1&&x.k==='hold');
  if(hi<0){
    const prev=tp.items.slice(0,i).reverse().find(x=>coord(x)); const a=prev?coord(prev):S.pos, b=coord(fix);
    const crs=a&&b?brg(a,b):360;
    tp.items.splice(i+1,0,{k:'hold',at:fix.id,crs,ccrs:crs,turn:'R',time:S.alt>14000?1.5:1.0,mode:'COMPUTED',seg:fix.seg}); hi=i+1;
  }
  S.hold={view,i:hi}; go('hold');
}
PG.hold={
  draw(){
    const h=planFor(S.hold.view).items[S.hold.i]; if(!h){ go('fpln'); return; }
    const tm=S.tmpy&&S.tmpy.tgt===S.hold.view, k=tm?'y':'g';
    const ht=(h.mode==='DATABASE'?'DATABASE ':h.mode==='PILOT'?'':'COMPUTED ')+'HOLD'; put(0,1,ht,'w'); put(0,2+ht.length,'AT','w',1); put(0,5+ht.length,h.at,k);
    const sm=n=>scr[DR(n)].forEach((x,i)=>{ if(i<10) x.s=1; });
    lbl(1,'L','INB CRS'); prompt(1,'L',p3(h.crs)+'°','c'); if(!h.pc) sm(1);
    lbl(2,'L','TURN'); prompt(2,'L',h.turn,'c'); if(!h.pt) sm(2);
    lbl(3,'L','TIME/DIST'); prompt(3,'L',(h.time||1).toFixed(1)+'/'+((h.time||1)*4.3).toFixed(1),'c'); if(!h.ptm) sm(3);
    if(h.mode==='PILOT'){ lbl(1,'R','REVERT TO'); prompt(2,'R',(h.from==='DATABASE'?'DATABASE':'COMPUTED')+'*','c'); }
    else if(DBH[h.at]){ prompt(1,'R',h.mode==='COMPUTED'?'COMPUTED':'COMPUTED*','c'); prompt(2,'R',h.mode==='DATABASE'?'DATABASE':'DATABASE*','c'); }
    lbl(4,'R','LAST EXIT'); put(DR(4),COLS-11,'UTC   FUEL','w',1); { const F=fuel(); if(F&&F.fob!=null&&S.phase!=='PRE'){ const hrs=Math.max(0,F.extra)/2.2; prompt(5,'R',hhmm(S.utc+hrs*60)+'  '+(F.trip+F.mdf).toFixed(1).padStart(5,' '),'m'); } else prompt(5,'R','----  ---.-','g'); }
    if(tm){ prompt(6,'L','<TMPY F-PLN','y'); prompt(6,'R','INSERT*','a'); } else prompt(6,'L','<RETURN');
  },
  lsk(s,n){
    const H=S.hold, p=planFor(H.view), h=p.items[H.i], v=S.sp;
    if(n===6){ if(s==='L'){ go('fpln',{view:H.view}); return; } if(s==='R'&&S.tmpy&&S.tmpy.tgt===H.view){ insertTmpy(); go('fpln',{view:H.view}); return; } return; }
    if(S.clr&&h){ msg('NOT ALLOWED'); return; }
    const tp=startTmpy(H.view); if(!tp) return; const hh=tp.items[H.i];
    const toDb=()=>{ const d=DBH[hh.at]; Object.assign(hh,{crs:d.crs,turn:d.turn,time:d.time,mode:'DATABASE',pc:0,pt:0,ptm:0,from:null}); };
    const toComp=()=>{ Object.assign(hh,{crs:hh.ccrs||hh.crs,turn:'R',time:S.alt>14000?1.5:1.0,mode:'COMPUTED',pc:0,pt:0,ptm:0,from:null}); };
    if(!v&&hh.mode==='PILOT'&&s==='R'&&n===2){ if(hh.from==='DATABASE'&&DBH[hh.at]) toDb(); else toComp(); return; }
    if(!v&&DBH[hh.at]&&hh.mode!=='PILOT'){ if(s==='R'&&n===2){ toDb(); return; } if(s==='R'&&n===1){ toComp(); return; } }
    if(!v) return;
    const pil=()=>{ if(hh.mode!=='PILOT'){ hh.from=hh.mode; hh.mode='PILOT'; } };
    if(s==='L'&&n===1){ const c=ckNum(v,0,360); if(c==null) return; pil(); hh.crs=c===0?360:c; hh.pc=1; take(); return; }
    if(s==='L'&&n===2){ if(v!=='L'&&v!=='R'){ msg('FORMAT ERROR'); return; } pil(); hh.turn=v; hh.pt=1; take(); return; }
    if(s==='L'&&n===3){ const m=/^(\d(?:\.\d)?)/.exec(v); if(!m){ msg('FORMAT ERROR'); return; } const t=+m[1]; if(t<0.5||t>9.9){ msg('ENTRY OUT OF RANGE'); return; } pil(); hh.time=t; hh.ptm=1; take(); return; }
    msg('NOT ALLOWED');
  }
};

/* ---------- DIR TO ---------- */
function dirList(){ const p=S.act; return p.items.map((x,i)=>({x,i})).filter(o=>o.i>=1&&isW(o.x)&&o.x.id!=='T-P'); }
PG.dir={
  draw(){
    const d=S.dir||(S.dir={tgt:null,rin:null,rout:null,off:0});
    title('DIR TO','w');
    lbl(1,'L','DIR TO'); prompt(1,'L',d.tgt?d.tgt:'[      ]',d.tgt?'y':'c');
    if(d.tgt) put(DR(1),8,'←','y');
    const list=dirList().slice(d.off,d.off+4);
    if(list.length) lbl(2,'L','F-PLN WPTS');
    list.forEach((o,j)=>prompt(2+j,'L',o.x.id,'c'));
    lbl(3,'R','WITH   '); prompt(3,'R','ABEAM PTS→','c');
    lbl(4,'R','RADIAL IN '); prompt(4,'R',d.rin!=null?p3(d.rin)+'°':'[ ]°',d.rin!=null?'y':'c');
    lbl(5,'R','RADIAL OUT'); prompt(5,'R',d.rout!=null?p3(d.rout)+'°':'[ ]°',d.rout!=null?'y':'c');
    if(d.tgt){ prompt(6,'L','<ERASE','a'); prompt(6,'R','DIR TO*','a'); }
  },
  lsk(s,n){
    const d=S.dir, v=S.sp;
    if(S.phase==='PRE'){ msg('NOT ALLOWED'); return; }
    if(S.tmpy&&S.tmpy.tgt==='act'&&!d.tgt){ msg('TMPY F-PLN EXISTS',true); return; }
    if(s==='L'&&n===1){ if(!v) return; if(!P[v]||P[v].t==='APT'&&!AP[v]){ msg('NOT IN DATA BASE'); return; } d.tgt=v; take(); return; }
    if(s==='L'&&n>=2&&n<=5){ const o=dirList()[d.off+n-2]; if(!o) return; if(v){ msg('NOT ALLOWED'); return; } d.tgt=o.x.id; d.idx=o.i; return; }
    if(s==='R'&&(n===4||n===5)){ if(!v) return; if(!d.tgt){ msg('NOT ALLOWED'); return; } const c=ckNum(v,0,360); if(c==null) return; if(n===4){ d.rin=c===0?360:c; d.rout=null; } else { d.rout=c===0?360:c; d.rin=null; } take(); return; }
    if(s==='R'&&n===3){ msg('NOT AVAILABLE'); return; }
    if(n===6&&d.tgt){ if(s==='L'){ S.dir={tgt:null,rin:null,rout:null,off:0}; return; } if(s==='R'){ doDirTo(d); S.dir={tgt:null,rin:null,rout:null,off:0}; go('fpln',{view:'act',off:0}); return; } }
    if(v) msg('NOT ALLOWED');
  },
  scroll(x){ const d=S.dir; d.off=Math.max(0,Math.min(Math.max(0,dirList().length-4),d.off+x)); }
};
function doDirTo(d){
  const p=S.act, tp={k:'wpt',id:'T-P',seg:'enr',pos:{x:S.pos.x,y:S.pos.y}};
  let j=p.items.findIndex((x,i)=>i>=1&&isW(x)&&x.id===d.tgt);
  let items;
  if(j>=1){ items=[tp].concat(p.items.slice(j)); }
  else items=[tp,W(d.tgt,{seg:'enr',via:''}),{k:'disc',seg:'enr'}].concat(p.items.slice(1));
  const t=items[1]; t.via='DIR'; if(d.rin!=null){ t.rin=d.rin; t.via=''; } if(d.rout!=null){ t.rout=d.rout; }
  p.items=items; tidy(p); S.tmpy=null; S.lastDir={tgt:d.tgt,rin:d.rin,rout:d.rout}; S.ap='NAV'; S.hz=null;
}

/* ---------- PERF ---------- */
const PH=['TO','CLB','CRZ','DES','APPR','GA'];
const actPhase=()=>({PRE:'TO',CRZ:'CRZ',DES:'DES',APP:'APPR'})[S.phase]||'TO';
PG.perf={
  draw(){
    const ph=S.pp||actPhase(), act=ph===actPhase(), P_=S.perf, p=S.act;
    const T={TO:'TAKE OFF',CLB:'CLB',CRZ:'CRZ',DES:'DES',APPR:'APPR',GA:'GO AROUND'}[ph];
    putC(0,T,act?'g':'w');
    if(ph==='TO'){
      const e=p.from?P[p.from].elev:0;
      lbl(1,'R','RWY'); prompt(1,'R',p.dRwy||'--','g');
      [['v1','V1'],['vr','VR'],['v2','V2']].forEach(([k,t],i)=>{ lbl(1+i,'L',t); prompt(1+i,'L',P_[k]!=null?String(P_[k]):box(3),P_[k]!=null?'c':'a'); if(P_[k]==null&&P_.old&&P_.old[k]!=null) put(DR(1+i),3,String(P_.old[k]),'c',1); });
      lbl(4,'L','TRANS ALT'); prompt(4,'L',String(P_.ta||(p.from?AP[p.from].ta:'-----')),'c'); if(!P_.ta) scr[DR(4)].forEach((x,i)=>{ if(i<6) x.s=1; });
      lbl(5,'L','THR RED/ACC'); prompt(5,'L',(P_.thr||(p.from?e+1500:'----'))+'/'+(P_.acc||(p.from?e+1500:'----')),'c'); if(!P_.thr) scr[DR(5)].forEach((x,i)=>{ if(i<10) x.s=1; });
      lbl(2,'R','TO SHIFT'); prompt(2,'R','[M][ ]*','c');
      lbl(3,'R','FLAPS/THS'); prompt(3,'R',(P_.flaps!=null?String(P_.flaps):'[]')+'/'+(P_.ths||'[   ]'),'c');
      lbl(4,'R','FLEX TO TEMP'); prompt(4,'R',P_.flex!=null?P_.flex+'°':'[ ]°','c');
      lbl(5,'R','ENG OUT ACC'); prompt(5,'R',String(P_.eoa||(p.from?e+1500:'----')),'c'); if(!P_.eoa) scr[DR(5)].forEach((x,i)=>{ if(i>18) x.s=1; });
      ['FLP RETR','SLT RETR','CLEAN'].forEach((t,i)=>{ put(LR(1+i),7,t,'w',1); put(DR(1+i),8,P_.v2?['F='+(P_.v2+10),'S='+(P_.v2+28),'O='+(P_.v2+60)][i]:'---','g'); });
    }
    else if(ph==='CLB'||ph==='CRZ'||ph==='DES'){
      const F=fuel();
      lbl(1,'L','ACT MODE'); prompt(1,'L','MANAGED','g');
      lbl(2,'L',' CI'); prompt(2,'L',S.init.ci!=null?String(S.init.ci):'---','c');
      lbl(3,'L',' MANAGED'); prompt(3,'L',ph==='CRZ'?'.78':ph==='DES'?'.78/290':'300/.78',act?'g':'c');
      if(ph!=='DES'){ lbl(4,'L',' PRESEL'); prompt(4,'L','[ ]','c'); }
      if(ph!=='CLB'){ put(LR(1),11,S.phase==='PRE'?'TIME':'UTC','w',1); putR(LR(1),'DEST EFOB','w',1); const d=destOf(p); if(d&&F){ put(DR(1),11,S.phase==='PRE'?hhmm(F.time):hhmm(S.utc+F.dist/7.2),'g'); putR(DR(1),F.efob!=null?F.efob.toFixed(1):'--.-','g'); } }
      if(ph==='CLB'||ph==='DES'){ lbl(2,'R','PRED TO '); prompt(2,'R',ph==='CLB'?'FL'+p3(S.init.crz||350):'[ ]','c'); }
      if(ph==='CRZ'){ lbl(4,'R','DES CABIN RATE'); prompt(4,'R','-350FT/MN','c'); scr[DR(4)].forEach((x,i)=>{ if(i>13) x.s=1; }); prompt(5,'R','STEP ALTS>'); }
    }
    else if(ph==='APPR'){
      const d=destOf(p), e=d?P[d.id].elev:0;
      const near=S.phase!=='PRE'&&remainDist(p)<180;
      lbl(1,'L','QNH'); prompt(1,'L',P_.qnh!=null?String(P_.qnh):(near?box(4):'[    ]'),P_.qnh!=null||!near?'c':'a');
      lbl(2,'L','TEMP'); prompt(2,'L',P_.tmp!=null?P_.tmp+'°':'[ ]°','c');
      lbl(3,'L','MAG WIND'); prompt(3,'L',P_.wd!=null?p3(P_.wd)+'°/'+String(P_.ws).padStart(3,'0'):'[ ]°/[ ]','c');
      lbl(4,'L','TRANS ALT'); prompt(4,'L',d?String(AP[d.id].ta):'-----','c'); scr[DR(4)].forEach((x,i)=>{ if(i<6) x.s=1; });
      const A=appSpeeds(); lbl(5,'L','VAPP'); prompt(5,'L',String(P_.vapp||A.vapp),'c'); if(!P_.vapp) scr[DR(5)].forEach((x,i)=>{ if(i<4) x.s=1; });
      lbl(2,'R','BARO'); prompt(2,'R',P_.baro!=null?String(P_.baro):'[    ]','c');
      lbl(3,'R','RADIO'); prompt(3,'R',P_.radio!=null?String(P_.radio):'[    ]','c');
      lbl(4,'R','LDG CONF'); prompt(4,'R',P_.ldg==='3'?'CONF3':'*CONF3',P_.ldg==='3'?'c':'c'); prompt(5,'R',P_.ldg==='FULL'?'FULL':'*FULL','c');
      put(LR(1),11,'FINAL','w',1); put(DR(1),11,p.appr||'---','g');
      [['O=',A.o],['S=',A.s],['F=',A.f]].forEach(([t,v],i)=>{ put(DR(2+i),10,t+v,'g'); }); put(LR(5),10,'VLS','w',1); put(DR(5),10,String(A.vls),'g');
      put(DR(1),COLS-1,'','w');
    }
    else if(ph==='GA'){
      const d=destOf(p), e=d?P[d.id].elev:0;
      lbl(5,'L','THR RED/ACC'); prompt(5,'L',(P_.gthr||e+1500)+'/'+(P_.gacc||e+1500),'c'); if(!P_.gthr) scr[DR(5)].forEach((x,i)=>{ if(i<10) x.s=1; });
      lbl(5,'R','ENG OUT ACC'); prompt(5,'R',String(P_.geoa||e+1500),'c'); if(!P_.geoa) scr[DR(5)].forEach((x,i)=>{ if(i>18) x.s=1; });
      ['FLP RETR','SLT RETR','CLEAN'].forEach((t,i)=>{ put(LR(1+i),7,t,'w',1); put(DR(1+i),8,['F=139','S=177','O=210'][i],'g'); });
    }
    /* bottom line */
    if(ph==='APPR'&&!act){ if(P_.confirm){ put(LR(6),0,' CONFIRM','a',1); put(DR(6),0,'*APPR PHASE','a'); } else { put(LR(6),0,' ACTIVATE','w',1); put(DR(6),0,'<APPR PHASE','c'); } }
    else if(!act&&PH.indexOf(ph)>0&&ph!=='GA') prompt(6,'L','<PREV PHASE');
    else if(ph==='GA') prompt(6,'L','<PREV PHASE');
    if(ph==='TO'&&P_.old&&S.phase==='PRE'){ lbl(6,'R','CONFIRM '); prompt(6,'R','TO DATA*','a'); }
    else if(ph!=='GA'){ lbl(6,'R','NEXT '); prompt(6,'R','PHASE>'); }
  },
  lsk(s,n){
    const ph=S.pp||actPhase(), P_=S.perf, v=S.sp, p=S.act;
    if(n===6&&s==='R'&&ph==='TO'&&P_.old&&S.phase==='PRE'){ ['v1','vr','v2'].forEach(k=>{ if(P_[k]==null) P_[k]=P_.old[k]; }); P_.old=null; return; }
    if(n===6&&s==='R'&&ph!=='GA'){ S.pp=PH[PH.indexOf(ph)+1]; P_.confirm=false; return; }
    if(n===6&&s==='L'){
      if(ph==='APPR'&&ph!==actPhase()){ if(!P_.confirm){ P_.confirm=true; return; } S.phase='APP'; P_.confirm=false; return; }
      if(PH.indexOf(ph)>0){ S.pp=PH[PH.indexOf(ph)-1]; return; } return;
    }
    if(S.clr&&ph==='APPR'&&s==='L'&&n===5){ P_.vapp=null; take(); return; }
    if(S.clr){ if(ph==='TO'&&s==='L'&&n<=3){ P_[['v1','vr','v2'][n-1]]=null; take(); return; } if(ph==='APPR'&&s==='R'&&(n===2||n===3)){ P_[n===2?'baro':'radio']=null; take(); return; } msg('NOT ALLOWED'); return; }
    if(!v) { if(ph==='APPR'&&s==='R'&&(n===4||n===5)){ P_.ldg=n===4?'3':'FULL'; } return; }
    if(ph==='TO'){
      if(S.phase!=='PRE'){ msg('NOT ALLOWED'); return; }
      if(s==='L'&&n<=3){ const c=ckNum(v,90,180); if(c==null) return; P_[['v1','vr','v2'][n-1]]=c; take(); if(P_.old&&P_.v1!=null&&P_.vr!=null&&P_.v2!=null) P_.old=null; vcheck(); return; }
      if(s==='L'&&n===4){ const c=ckNum(v,1000,39000); if(c==null) return; P_.ta=Math.round(c/10)*10; take(); return; }
      if(s==='L'&&n===5){ const m=/^(\d{3,5})?(?:\/(\d{3,5}))?$/.exec(v); if(!m||(!m[1]&&!m[2])){ msg('FORMAT ERROR'); return; } const e0=p.from?P[p.from].elev:0; if((m[1]&&+m[1]<e0+400)||(m[2]&&+m[2]<e0+400)){ msg('ENTRY OUT OF RANGE'); return; } if(m[1]) P_.thr=+m[1]; if(m[2]) P_.acc=+m[2]; if(P_.thr&&P_.acc&&P_.acc<P_.thr) P_.acc=P_.thr; take(); return; }
      if(s==='R'&&n===3){ const m=/^([0-3])?(?:\/((?:UP|DN)\d(?:\.\d)?|\d(?:\.\d)?(?:UP|DN)))?$/.exec(v); if(!m||(!m[1]&&!m[2])){ msg('FORMAT ERROR'); return; } if(m[1]) P_.flaps=+m[1]; if(m[2]){ let t=m[2]; const mm=/^(\d(?:\.\d)?)(UP|DN)$/.exec(t); if(mm) t=mm[2]+mm[1]; if(!/\./.test(t)) t+='.0'; P_.ths=t; } take(); return; }
      if(s==='R'&&n===4){ const c=ckNum(v.replace(/^\+/,''),-99,99); if(c==null) return; P_.flex=c; take(); return; }
      if(s==='R'&&n===5){ const c=ckNum(v,500,39000); if(c==null) return; P_.eoa=c; take(); return; }
      if(s==='R'&&n===2){ msg('NOT AVAILABLE'); return; }
      if(s==='R'&&n===1){ msg('NOT ALLOWED'); return; }
    }
    if(ph==='APPR'){
      if(s==='L'&&n===1){ const c=ckNum(v,745,1100); if(c==null){ const c2=num(v,22,32.48,1); if(c2==null||Number.isNaN(c2)) return; S.msg=null; P_.qnh=c2; take(); return; } P_.qnh=c; take(); return; }
      if(s==='L'&&n===2){ const c=ckNum(v.replace(/^\+/,''),-99,99); if(c==null) return; P_.tmp=c; take(); return; }
      if(s==='L'&&n===3){ const m=/^(\d{1,3})?(?:\/(\d{1,3}))?$/.exec(v); if(!m||(m[1]==null&&m[2]==null)){ msg('FORMAT ERROR'); return; } if(m[1]!=null){ const d=+m[1]; if(d>360){ msg('ENTRY OUT OF RANGE'); return; } P_.wd=d===0?360:d; } if(m[2]!=null) P_.ws=+m[2]; if(P_.ws==null) P_.ws=0; take(); return; }
      if(s==='R'&&n===2){ const c=ckNum(v,0,20000); if(c==null) return; P_.baro=c; P_.radio=null; take(); return; }
      if(s==='R'&&n===3){ const vv=/^NO ?DH$|^NO$/.test(v)?'NO':v; if(vv==='NO'){ P_.radio='NO'; P_.baro=null; take(); return; } const c=ckNum(vv,0,700); if(c==null) return; P_.radio=c; P_.baro=null; take(); return; }
      if(s==='L'&&n===5){ const c=ckNum(v,90,200); if(c==null) return; P_.vapp=c; take(); return; }
    }
    if(ph==='GA'){
      if(s==='L'&&n===5){ const m=/^(\d{3,5})?(?:\/(\d{3,5}))?$/.exec(v); if(!m||(!m[1]&&!m[2])){ msg('FORMAT ERROR'); return; } if(m[1]) P_.gthr=+m[1]; if(m[2]) P_.gacc=+m[2]; take(); return; }
      if(s==='R'&&n===5){ const c=ckNum(v,500,39000); if(c==null) return; P_.geoa=c; take(); return; }
    }
    msg('NOT ALLOWED');
  }
};
function appSpeeds(){
  /* teaching numbers: VLS from landing weight, VAPP = VLS + 1/3 headwind (min +5, max +15) */
  const F=fuel(), lw=F&&F.lw!=null?F.lw:60, P_=S.perf, d=destOf(S.act);
  const full=P_.ldg!=='3', vls=Math.round(97+lw*0.52+(full?0:4));
  let hw=0; if(P_.wd!=null&&d&&d.rwy&&AP[d.id]){ const crs=AP[d.id].rwy[d.rwy].crs; hw=Math.max(0,(P_.ws||0)*Math.cos((P_.wd-crs)*R2)); }
  const add=Math.max(5,Math.min(15,Math.round(hw/3)));
  return {vls,vapp:vls+add,f:Math.round(vls*1.07),s:Math.round(vls*1.33),o:Math.round(vls*1.58)};
}
function vcheck(){ const p=S.perf; if(p.v1&&p.vr&&p.v1>p.vr||p.vr&&p.v2&&p.vr>p.v2||p.v1&&p.v2&&p.v1>p.v2) msg('V1/VR/V2 DISAGREE',true); }

/* ---------- RAD NAV ---------- */
function autoVors(){ const v=Object.values(P).filter(x=>x.t==='VOR').sort((a,b)=>dist(a,S.pos)-dist(b,S.pos)); return [v[0],v[1]]; }
function autoIls(){
  if(S.phase==='PRE'){ const p=S.act; if(p.from&&p.dRwy){ const r=AP[p.from].rwy[p.dRwy]; return r.ils; } return null; }
  const p=S.act, d=destOf(p); if(d&&p.appr){ const a=AP[d.id].app[p.appr]; return a&&a.ils; } return null;
}
PG.rad={
  draw(){
    const R=S.rad, av=autoVors();
    title('RADIO NAV');
    const vor=(man,auto,left)=>{ const x=man?P[man]:auto; if(!x) return left?'[  ]/[    ]':'[    ]/[  ]'; return left?x.id+'/'+x.f:x.f+'/'+x.id; };
    lbl(1,'L','VOR1/FREQ'); prompt(1,'L',vor(R.v1,av[0],1),'c'); if(!R.v1) scr[DR(1)].forEach((x,i)=>{ if(i<11) x.s=1; });
    lbl(1,'R','FREQ/VOR2'); prompt(1,'R',vor(R.v2,av[1],0),'c'); if(!R.v2) scr[DR(1)].forEach((x,i)=>{ if(i>12) x.s=1; });
    lbl(2,'L','CRS'); prompt(2,'L',R.c1!=null?p3(R.c1):'[ ]','c'); lbl(2,'R','CRS'); prompt(2,'R',R.c2!=null?p3(R.c2):'[ ]','c');
    const ai=autoIls(), il=R.ils||ai;
    lbl(3,'L','ILS /FREQ'); prompt(3,'L',il?il+'/'+ILS[il].f:'[  ]/[    ]','c'); if(!R.ils&&il) scr[DR(3)].forEach((x,i)=>{ if(i<11) x.s=1; });
    lbl(4,'L','CRS'); prompt(4,'L',R.ic!=null?'F'+p3(R.ic):(il?'F'+p3(ILS[il].crs):'[ ]'),'c'); if(R.ic==null&&il) scr[DR(4)].forEach((x,i)=>{ if(i<4) x.s=1; });
    lbl(5,'L','ADF1/FREQ'); prompt(5,'L',R.a1?R.a1+'/'+P[R.a1].f:'[  ]/[    ]','c');
    lbl(5,'R','FREQ/ADF2'); prompt(5,'R',R.a2?P[R.a2].f+'/'+R.a2:'[    ]/[  ]','c');
  },
  lsk(s,n){
    const R=S.rad, v=S.sp;
    if(S.clr){ S.clr=false; const k={L1:'v1',R1:'v2',L2:'c1',R2:'c2',L3:'ils',L4:'ic',L5:'a1',R5:'a2'}[s+n]; if(k){ R[k]=null; if(k==='v1') R.c1=null; if(k==='v2') R.c2=null; if(k==='ils') R.ic=null; } return; }
    if(!v) return;
    const findF=(f,t)=>Object.values(P).find(x=>x.t===t&&x.f===f);
    if(n===1){ let x=null; if(/^\d{3}\.\d{1,2}$/.test(v)){ x=findF((+v).toFixed(2),'VOR'); } else x=P[v]&&P[v].t==='VOR'?P[v]:null; if(!x){ msg(P[v]?'NOT ALLOWED':'NOT IN DATA BASE'); return; } R[s==='L'?'v1':'v2']=x.id; take(); return; }
    if(n===2){ const c=ckNum(v,0,360); if(c==null) return; R[s==='L'?'c1':'c2']=c===0?360:c; take(); return; }
    if(n===3&&s==='L'){ let id=null; if(/^\d{3}\.\d{1,2}$/.test(v)){ const f=(+v).toFixed(2); id=Object.keys(ILS).find(k=>ILS[k].f===f); } else if(ILS[v]) id=v; if(!id){ msg('NOT IN DATA BASE'); return; } R.ils=id; R.ic=null; take(); const ai=autoIls(); if(ai&&ai!==id) msg('RWY/LS MISMATCH',true); return; }
    if(n===4&&s==='L'){ const c=ckNum(v.replace(/^[FB]/,''),0,360); if(c==null) return; R.ic=c===0?360:c; take(); return; }
    if(n===5){ let x=null; if(/^\d{3,4}(\.\d)?$/.test(v)) x=findF(String(+v),'NDB'); else x=P[v]&&P[v].t==='NDB'?P[v]:null; if(!x){ msg('NOT IN DATA BASE'); return; } R[s==='L'?'a1':'a2']=x.id; take(); return; }
    msg('NOT ALLOWED');
  }
};

/* ---------- SEC INDEX ---------- */
const canActSec=()=>!!S.sec&&(S.phase==='PRE'||S.ap==='HDG'||(S.sec.items[1]&&S.act.items[1]&&S.sec.items[1].id===S.act.items[1].id&&S.sec.items[0].id===S.act.items[0].id));
PG.sec={
  draw(){
    title('SEC INDEX');
    prompt(1,'L','<COPY ACTIVE'); prompt(2,'L','<SEC F-PLN'); if(S.sec){ prompt(3,'L','<DELETE SEC'); if(canActSec()) prompt(4,'L','*ACTIVATE SEC','a'); }
    prompt(1,'R','INIT>'); prompt(2,'R','PERF>');
  },
  lsk(s,n){
    if(S.sp){ msg('NOT ALLOWED'); return; }
    if(s==='L'&&n===1){ if(!S.act.from){ msg('NOT ALLOWED'); return; } if(S.tmpy&&S.tmpy.tgt==='sec') S.tmpy=null; S.sec=clone(S.act); return; }
    if(s==='L'&&n===2){ if(!S.sec){ S.sec=newPlan(); } go('fpln',{view:'sec',off:0}); return; }
    if(s==='L'&&n===3&&S.sec){ S.sec=null; if(S.tmpy&&S.tmpy.tgt==='sec') S.tmpy=null; return; }
    if(s==='L'&&n===4&&canActSec()){ if(S.tmpy){ msg('TMPY F-PLN EXISTS',true); return; } const old=S.act; S.act=S.sec; S.sec=null; S.hz=null; afterActChange(old); if(S.phase==='PRE'&&!S.msg&&(S.perf.v1||S.perf.vr||S.perf.v2)) msg('CHECK TAKE OFF DATA',true); go('fpln',{view:'act',off:0}); return; }
    if(s==='R'){ msg('NOT AVAILABLE'); return; }
  }
};

/* ---------- DATA ---------- */
PG.data={
  draw(){ const pg2=S.dpg===2; putC(0,'DATA INDEX','w'); putR(0,(pg2?'2/2':'1/2')+' →','w',1);
    if(!pg2){ lbl(1,'L',' POSITION'); prompt(1,'L','<MONITOR'); lbl(2,'L',' IRS'); prompt(2,'L','<MONITOR'); lbl(3,'L',' GPS'); prompt(3,'L','<MONITOR'); prompt(4,'L','<A/C STATUS'); lbl(5,'L',' CLOSEST'); prompt(5,'L','<AIRPORTS'); lbl(6,'L',' EQUITIME'); prompt(6,'L','<POINT'); lbl(5,'R','ACARS/PRINT '); prompt(5,'R','FUNCTION>'); lbl(6,'R','AOC '); prompt(6,'R','FUNCTION>'); }
    else { prompt(1,'L','<WAYPOINTS'); prompt(2,'L','<NAVAIDS'); prompt(3,'L','<RUNWAYS'); prompt(4,'L','<ROUTES'); lbl(1,'R','PILOTS '); prompt(1,'R','WAYPOINTS>'); prompt(2,'R','NAVAIDS>'); prompt(3,'R','RUNWAYS>'); prompt(4,'R','ROUTES>'); } },
  lsk(s,n){ if(S.sp){ msg('NOT ALLOWED'); return; } if(S.dpg!==2){ if(s==='L'&&n===4){ go('acstat'); return; } if(s==='L'&&n===1){ go('posmon'); return; } } msg('NOT AVAILABLE'); },
  slew(){ S.dpg=S.dpg===2?1:2; }
};
PG.acstat={
  draw(){ const a=airac(); putC(0,'A320-200','w'); lbl(1,'L',' ENG'); prompt(1,'L','CFM56-5B4','g'); lbl(2,'L',' ACTIVE NAV DATA BASE'); prompt(2,'L',' '+a.act,'c'); putR(DR(2),a.id,'g'); lbl(3,'L',' SECOND NAV DATA BASE'); prompt(3,'L','←'+a.sec,'c'); scr[DR(3)].forEach(x=>x.s=1); lbl(5,'L','CHG CODE'); prompt(5,'L','[  ]','c'); lbl(6,'L','IDLE/PERF'); prompt(6,'L','+0.0/+0.0','g'); scr[DR(6)].forEach((x,i)=>{ if(i<9) x.s=1; }); prompt(6,'R','STATUS/XLOAD>','w'); },
  lsk(s,n){ if(s==='L'&&n===3){ msg('NOT ALLOWED'); return; } if(s==='R'&&n===6){ msg('NOT AVAILABLE'); return; } if(S.sp) msg('NOT ALLOWED'); }
};
PG.posmon={
  draw(){ const q=S.phase==='PRE'?P[S.act.from||'XNDV']||{x:0,y:0}:S.pos; const ll=llOf(q).replace('/',' ');
    putC(0,'POSITION MONITOR','w');
    lbl(1,'L','FMS1'); prompt(1,'L',ll,'g'); lbl(1,'R','3IRS/GPS');
    lbl(2,'L','FMS2'); prompt(2,'L',ll,'g'); lbl(2,'R','3IRS/GPS');
    lbl(3,'L','GPIRS'); prompt(3,'L',ll,'g');
    lbl(4,'L','MIX IRS'); prompt(4,'L',ll,'g');
    put(LR(5),0,'   IRS1    IRS2    IRS3','w',1); put(DR(5),0,'NAV 0.0 NAV 0.1 NAV 0.0','g');
    prompt(6,'L','<FREEZE'); lbl(6,'R','SEL '); prompt(6,'R','NAVAIDS>'); },
  lsk(s,n){ if(S.sp){ msg('NOT ALLOWED'); return; } msg('NOT AVAILABLE'); }
};
PG.prog={
  draw(){ const ph={PRE:'PREFLIGHT',CRZ:'CRZ',DES:'DES',APP:'APPR'}[S.phase]; put(0,1,ph,'g'); putR(0,S.init.flt||'','w',1,1);
    const crz=S.init.crz; lbl(1,'L',' CRZ'); putC(LR(1),'OPT','w',1); lbl(1,'R','REC MAX ');
    prompt(1,'L',crz&&S.phase!=='DES'&&S.phase!=='APP'?'FL'+p3(crz):'-----','c'); putC(DR(1),crz?'FL'+p3(Math.min(390,crz+10)):'-----','g'); prompt(1,'R','FL398','m');
    prompt(2,'L','<REPORT');
    lbl(3,'L',' UPDATE AT'); prompt(3,'L','*[    ]','c');
    lbl(4,'L','  BRG /DIST'); const t=S.progTo&&P[S.progTo]; const from=S.phase==='PRE'?(P[S.act.from]||{x:0,y:0}):S.pos;
    prompt(4,'L',t?p3(brg(from,t))+'°/'+dist(from,t).toFixed(1):'---°/----.-','g'); put(DR(4),13,'TO','w',1); prompt(4,'R',S.progTo||'[    ]','c');
    prompt(5,'L','<PREDICTIVE'); put(LR(5),1,'','w'); put(DR(5),1,'','w'); lbl(5,'L',''); prompt(5,'R','GPS PRIMARY','g');
    lbl(6,'L','REQUIRED'); putC(LR(6),'ACCUR','w',1); lbl(6,'R','ESTIMATED'); prompt(6,'L',S.phase==='CRZ'?'2.00NM':S.phase==='APP'?'0.30NM':'1.00NM','c'); putC(DR(6),'HIGH','g'); prompt(6,'R','0.08NM','g'); },
  lsk(s,n){ const v=S.sp;
    if(s==='R'&&n===4){ if(S.clr){ S.clr=false; S.progTo=null; return; } if(!v) return; const id=v.replace(/^(X[A-Z]{3})(\d\d)$/,'$1'); if(!P[id]){ msg('NOT IN DATA BASE'); return; } S.progTo=id; take(); return; }
    if(s==='L'&&(n===2||n===5)){ msg('NOT AVAILABLE'); return; }
    if(s==='L'&&n===3){ if(!v) return; msg('NOT AVAILABLE'); return; }
    if(v) msg('NOT ALLOWED'); }
};
PG.fuel={
  draw(){ const F=fuel(), p=S.act, d=destOf(p), air=S.phase!=='PRE'&&F&&F.fob!=null; putC(0,'FUEL PRED','w');
    put(LR(1),0,'AT','w',1); put(LR(1),9,air?'UTC':'TIME','w',1); putR(LR(1),'EFOB','w',1);
    if(d){ prompt(1,'L',d.id+(d.rwy||''),'g'); put(DR(1),9,air?hhmm(S.utc+F.time):'----',air?'g':'w'); putR(DR(1),air?F.efob.toFixed(1):'--.-',air&&F.efob<F.mdf?'a':(air?'g':'w')); }
    const al=p.altn||S.init.altn; if(al&&d&&d.id!==al){ prompt(2,'L',al,'g'); put(DR(2),9,air?hhmm(S.utc+F.time+F.atime):'----',air?'g':'w'); putR(DR(2),air?(F.efob-F.altn).toFixed(1):'--.-',air?'g':'w'); }
    lbl(3,'L','RTE RSV/%'); prompt(3,'L',air?'---.-/---':'---.-/---','w');
    lbl(4,'L','ALTN /TIME'); prompt(4,'L',air&&al?F.altn.toFixed(1)+'/'+hhmm(F.atime):'---.-/----',air?'c':'w');
    lbl(5,'L','FINAL/TIME'); prompt(5,'L',air?'1.1/0030':'---.-/----',air?'c':'w');
    lbl(6,'L','MIN DEST FOB'); prompt(6,'L',air?F.mdf.toFixed(1):'---.-',air?'c':'w');
    lbl(3,'R','ZFW/ZFWCG'); prompt(3,'R',S.fb.zfw!=null?S.fb.zfw.toFixed(1)+'/'+(S.fb.cg!=null?S.fb.cg.toFixed(1):'--.-'):'---.-/--.-',air?'c':'w');
    lbl(4,'R','FOB    '); prompt(4,'R',air?F.fob.toFixed(1)+'/FF+FQ':'---.-','g');
    lbl(5,'R','GW/   CG'); prompt(5,'R',air&&F.gw!=null?F.gw.toFixed(1)+'/'+(S.fb.cg!=null?(S.fb.cg+0.6).toFixed(1):'--.-'):'---.-/--.-','g');
    lbl(6,'R','EXTRA/TIME'); prompt(6,'R',air?F.extra.toFixed(1)+'/'+hhmm(Math.max(0,F.extra)/2.2*60):'---.-/----','g'); scr[DR(6)].forEach((x,i)=>{ if(i>13) x.s=1; }); },
  lsk(s,n){ if(S.sp) msg(S.phase==='PRE'?'NOT ALLOWED':'NOT AVAILABLE'); }
};

/* =========================================================== flight (NAV/HDG, sequencing, hold) */
const w180=a=>{ a=((a+180)%360+360)%360; return a-180; };
function stepFlight(dt){
  if(S.phase==='PRE') return;
  const p=S.act; let gs=S.hz?230:(S.phase==='CRZ'?450:290);
  let want=S.trk;
  const t=p.items[1];
  if(S.ap==='HDG') want=S.hdg;
  else if(S.hz){ const h=p.items[1], f=P[h.at]||coord(p.items[0]); const H=S.hz, side=h.turn==='L'?-1:1, leg=(h.time||1)*230/60;
    if(H.st==='in'){ want=brg(S.pos,f); if(dist(S.pos,f)<0.6) H.st='turn1'; }
    else if(H.st==='turn1'){ want=S.trk+side*40; if(Math.abs(w180(S.trk-(h.crs+180)))<6){ H.st='out'; H.d=0; } }
    else if(H.st==='out'){ want=h.crs+180; H.d=(H.d||0)+gs*dt/3600; if(H.d>=leg) H.st='turn2'; }
    else if(H.st==='turn2'){ want=S.trk+side*40; if(Math.abs(w180(S.trk-h.crs))<12) H.st='in'; } }
  else if(t&&(isW(t)||t.k==='dest')){ const c=coord(t); if(t.rin!=null){ const C=w360(t.rin+180), d=dist(c,S.pos), off=w180(brg(c,S.pos)-t.rin), xtk=d*Math.sin(off*R2); if(t._q==null) t._q=Math.abs(off)>100?1:0; const Q=along(c,t.rin,10); if(t._q&&dist(S.pos,Q)<1.5) t._q=0; want=t._q?brg(S.pos,Q):C+Math.max(-45,Math.min(45,xtk*25)); } else want=brg(S.pos,c); }
  else if(S.ap==='NAV'&&(!t||t.k==='disc')){ S.ap='HDG'; S.hdg=Math.round(w360(S.trk)); msg('F-PLN DISCONTINUITY',true); }
  const dturn=w180(want-S.trk), rate=3*dt; S.trk=w360(S.trk+Math.max(-rate,Math.min(rate,dturn)));
  const d=gs*dt/3600; S.pos={x:S.pos.x+d*Math.sin(S.trk*R2),y:S.pos.y+d*Math.cos(S.trk*R2)}; S.utc+=dt/60;
  if(S.fob!=null) S.fob-=(S.hz?2.2:(S.phase==='CRZ'?2.4:1.6))*dt/3600;
  if(!S.flags) S.flags={};
  const rem=remainDist(p);
  if(rem<180&&(S.perf.qnh==null||S.perf.tmp==null||S.perf.wd==null)&&!S.flags.edd){ S.flags.edd=1; msg('ENTER DEST DATA',true); }
  if(S.ap==='NAV'&&t&&isW(t)&&p.items[2]&&p.items[2].k==='disc'&&!t._ld&&dist(S.pos,coord(t))/gs*3600<30){ t._ld=1; msg('LAT DISCONT AHEAD',true); }
  { const F=fuel(); if(F&&F.efob!=null&&F.efob<F.mdf&&!S.flags.ebm){ S.flags.ebm=1; msg('DEST EFOB BELOW MIN',true); } }
  if(S.ap==='NAV'&&!S.hz&&t&&(isW(t)||t.k==='dest')){ const c=coord(t), lim=Math.max(0.8,d*1.5);
    const wrongSide=t.rin!=null&&Math.abs(w180(S.trk-(t.rin+180)))>60;
    if(dist(S.pos,c)<lim&&!wrongSide){ if(t.k==='dest'){ S.run=false; msg('DEST REACHED',false); return; }
      p.items.shift(); if(p.items[1]&&p.items[1].k==='hold'&&p.items[1].at===t.id){ S.hz={st:'turn1'}; if(!S.msg) msg('SET HOLD SPEED'); } } }
}
function fcu(cmd,val){
  if(!S||S.phase==='PRE') return;
  if(cmd==='hdg'){ S.ap='HDG'; S.hdg=w360(Math.round(val)); }
  else if(cmd==='nav'){ const t=S.act.items[1]; if(t&&t.k!=='disc') S.ap='NAV'; else msg('NAV NOT AVAILABLE',true); }
  else if(cmd==='run') S.run=!S.run;
}

/* =========================================================== input */
const PAGEKEY={DIR:'dir',PROG:'prog',PERF:'perf',INIT:'init',DATA:'data',FPLN:'fpln',RAD:'rad',FUEL:'fuel',SEC:'sec',ATC:'menu',MENU:'menu'};
function press(k){
  if(!S) return;
  if(PAGEKEY[k]){
    const pg=PAGEKEY[k];
    if(pg==='fpln'){ go('fpln',{view:'act',off:0}); }
    else if(pg==='perf'){ S.pp=null; S.perf.confirm=false; go('perf'); }
    else if(pg==='dir'){ if(!S.dir||!S.dir.tgt) S.dir={tgt:null,rin:null,rout:null,off:0}; go('dir'); }
    else { if(pg==='menu'&&S.page!=='menu') S.lastFm=S.page; go(pg); }
    S.clr=false;
  }
  else if(k==='AIRPORT'){ if(S.page!=='fpln') go('fpln',{view:'act',off:0}); PG.fpln.airport(); }
  else if(/^[LR][1-6]$/.test(k)){ const pg=PG[S.page]; if(pg&&pg.lsk) pg.lsk(k[0],+k[1]); }
  else if(k==='CLR'){ if(S.msg) S.msg=null; else if(S.sp) S.sp=S.sp.slice(0,-1); else S.clr=!S.clr; }
  else if(k==='CLRALL'){ S.msg=null; S.sp=''; S.clr=false; }
  else if(k==='UP'||k==='DOWN'){ const pg=PG[S.page]; if(pg&&pg.scroll) pg.scroll(k==='UP'?1:-1); }
  else if(k==='LEFT'||k==='RIGHT'){ const pg=PG[S.page]; if(pg&&pg.slew) pg.slew(k==='RIGHT'?1:-1); }
  else if(k==='OVFY'){ if(!S.sp&&!S.msg) S.sp='Δ'; }
  else if(k==='PM'){ S.msg=null; S.clr=false; const l=S.sp.slice(-1); if(l==='-') S.sp=S.sp.slice(0,-1)+'+'; else if(l==='+') S.sp=S.sp.slice(0,-1)+'-'; else if(S.sp.length<22) S.sp+='-'; }
  else { const ch=k==='SP'?' ':k==='SLASH'?'/':k==='DOT'?'.':k; if(ch.length===1){ if(S.msg) S.msg=null; if(S.clr){ S.clr=false; } if(S.sp==='Δ') S.sp=''; if(S.sp.length<22) S.sp+=ch; } }
  S.log.push(k);
  if(S.log.length>400) S.log.shift();
}
function draw(){ cls(); const pg=PG[S.page]||PG.menu; pg.draw(); if(S.page!=='fpln'&&(S.page!=='menu'||S.sp||S.msg||S.clr)) scratch(); return html(); }

/* =========================================================== scenarios */
const OFP={flt:'NDP101',from:'XNDV',to:'XSKH',altn:'XFJB',ci:30,fl:350,temp:-54,route:'ROKUS1A ROKUS M611 HVL L44 ODRUP',zfw:58.4,cg:28.5,block:7.8,v1:142,vr:144,v2:146,flaps:1,ths:'UP0.4',flex:52};
function buildPrep(st){
  /* a complete, correct cockpit preparation (used as the starting point for later scenarios) */
  S.act=newPlan('XNDV','XSKH'); S.act.altn='XFJB'; S.init.altn='XFJB';
  setDeparture(S.act,'19','ROKUS1A',null);
  const i=S.act.items.findIndex(x=>isW(x)&&x.id==='ROKUS'); addAirways(S.act,i,[{via:'M611',to:'HVL'},{via:'L44',to:'ODRUP'}]);
  Object.assign(S.init,{flt:'NDP101',ci:30,crz:350,temp:-54,irs:true});
  Object.assign(S.fb,{zfw:58.4,cg:28.5,block:7.8});
  Object.assign(S.perf,{v1:142,vr:144,v2:146,flaps:1,ths:'UP0.4',flex:52});
  if(st) st(S);
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
const noTmpy=()=>!S.tmpy;
const SCN=[
 {id:'prep',cat:'pre',
  t:tt('Cockpit preparation: set up the FMS','Cockpit preparation: sett opp FMS-en'),
  d:tt('The whole FMS preparation in the standard order D-I-F-R-I-P: DATA, INIT A, F-PLN, RAD NAV, INIT B and PERF.','Hele FMS-forberedelsen i standardrekkefølgen D-I-F-R-I-P: DATA, INIT A, F-PLN, RAD NAV, INIT B og PERF.'),
  setup(){ go('acstat'); },
  docs:['ofp','load','perf','clr'],
  steps:[
   {t:tt('DATA: at power-up the MCDU shows A/C STATUS (the DATA key, then A/C STATUS, brings it back). Check that the active nav database is current, then press INIT.','DATA: når MCDU-en starter, viser den A/C STATUS (DATA-tasten og A/C STATUS henter den fram igjen). Sjekk at den aktive navigasjonsdatabasen er gyldig, og trykk INIT.'),keys:['INIT'],ok:()=>!!S.seen.acstat&&S.page!=='acstat'},
   {t:tt('INIT A: enter FROM/TO XNDV/XSKH.','INIT A: legg inn FROM/TO XNDV/XSKH.'),keys:['INIT','R1'],type:'XNDV/XSKH',ok:()=>S.act.from==='XNDV'&&S.act.to==='XSKH'},
   {t:tt('ROUTE SELECTION shows the company route NDVSKH01. You build the route from the OFP yourself, so press RETURN (L6).','ROUTE SELECTION viser selskapsruten NDVSKH01. Du bygger ruten selv etter OFP-en, så trykk RETURN (L6).'),keys:['L6'],ok:()=>!!S.seen.rtesel&&S.page!=='rtesel'},
   {t:tt('Enter the alternate XFJB.','Legg inn alternativ flyplass XFJB.'),keys:['L2'],type:'XFJB',ok:()=>altnOf()==='XFJB'},
   {t:tt('Enter the flight number NDP101.','Legg inn flightnummeret NDP101.'),keys:['L3'],type:'NDP101',ok:()=>S.init.flt==='NDP101'},
   {t:tt('Enter cost index 30.','Legg inn cost index 30.'),keys:['L5'],type:'30',ok:()=>S.init.ci===30},
   {t:tt('Enter CRZ FL/TEMP: FL350, −54 °C.','Legg inn CRZ FL/TEMP: FL350, −54 °C.'),keys:['L6'],type:'350/-54',ok:()=>S.init.crz===350&&S.init.temp===-54},
   {t:tt('F-PLN: lateral revision at XNDV, DEPARTURE: runway 19, SID ROKUS1A, then INSERT.','F-PLN: lateral revisjon på XNDV, DEPARTURE: rullebane 19, SID ROKUS1A, så INSERT.'),keys:['FPLN','L1','L1','L3','L2','R6'],ok:()=>S.act.dRwy==='19'&&S.act.sid==='ROKUS1A'&&noTmpy()},
   {t:tt('Route: lateral revision at ROKUS, AIRWAYS: M611 to HVL, then L44 to ODRUP. Check the TMPY F-PLN and INSERT.','Rute: lateral revisjon på ROKUS, AIRWAYS: M611 til HVL, så L44 til ODRUP. Sjekk TMPY F-PLN og INSERT.'),keys:['FPLN','L4','R5','L1','R1','L2','R2','R6'],type:'M611 · HVL · L44 · ODRUP',ok:()=>has(S.act,'HVL')&&has(S.act,'SELKA')&&has(S.act,'ODRUP')&&noTmpy()},
   {t:tt('Scroll through the F-PLN and check it against the OFP. The discontinuity before XSKH stays until you insert the arrival in cruise.','Bla gjennom F-PLN og sjekk den mot OFP-en. Diskontinuiteten før XSKH blir stående til du legger inn arrival i marsjhøyde.'),keys:['UP'],ok:()=>S.log.includes('UP')},
   {t:tt('SEC F-PLN: COPY ACTIVE, so a copy is ready if the runway changes.','SEC F-PLN: COPY ACTIVE, så en kopi er klar hvis rullebanen endres.'),keys:['SEC','L1'],ok:()=>!!S.sec&&S.sec.sid==='ROKUS1A'},
   {t:tt('RAD NAV: tune NDV on VOR 1 and set course 190 for raw data on the SID.','RAD NAV: tune NDV på VOR 1 og sett kurs 190 for rådata på SID-en.'),keys:['RAD','L1','L2'],type:'NDV · 190',ok:()=>S.rad.v1==='NDV'&&S.rad.c1===190},
   {t:tt('D-I-F-R is done. The loadsheet has arrived, so now the last I-P: INIT B (INIT, then →), ZFW/ZFWCG 58.4/28.5.','D-I-F-R er gjort. Loadsheeten er kommet, så nå de siste I-P: INIT B (INIT, så →), ZFW/ZFWCG 58.4/28.5.'),keys:['INIT','RIGHT','R1'],type:'58.4/28.5',ok:()=>S.fb.zfw===58.4&&S.fb.cg===28.5},
   {t:tt('BLOCK fuel 7.8. Check TRIP, ALTN, FINAL and EXTRA.','BLOCK fuel 7.8. Sjekk TRIP, ALTN, FINAL og EXTRA.'),keys:['R2'],type:'7.8',ok:()=>S.fb.block===7.8},
   {t:tt('PERF TAKE OFF: V1 142, VR 144, V2 146.','PERF TAKE OFF: V1 142, VR 144, V2 146.'),keys:['PERF','L1','L2','L3'],type:'142 · 144 · 146',ok:()=>S.perf.v1===142&&S.perf.vr===144&&S.perf.v2===146},
   {t:tt('FLAPS/THS 1/UP0.4 and FLEX 52.','FLAPS/THS 1/UP0.4 og FLEX 52.'),keys:['R3','R4'],type:'1/UP0.4 · 52',ok:()=>S.perf.flaps===1&&S.perf.ths==='UP0.4'&&S.perf.flex===52},
   {t:tt('Check TRANS ALT 7000 and THR RED/ACC against the take-off data. The FMS is ready for the FMS data crosscheck.','Sjekk TRANS ALT 7000 og THR RED/ACC mot take-off-dataene. FMS-en er klar for FMS data crosscheck.'),keys:[],ok:()=>S.page==='perf'&&S.perf.flex===52,auto:1}
  ]},
 {id:'xchk',cat:'pre',
  t:tt('FMS data crosscheck (PM)','FMS data crosscheck (PM)'),
  d:tt('PF: “I’ve set up the FMGS, please check it.” You are PM. Check the position, then D-I-F-R-I-P against the paperwork and correct what is wrong. Three entries are wrong.','PF: «I’ve set up the FMGS, please check it.» Du er PM. Sjekk posisjonen, så D-I-F-R-I-P mot papirene, og rett det som er feil. Tre verdier er feil.'),
  setup(){ buildPrep(); S.init.crz=330; S.fb.zfw=54.8; S.perf.flex=25; S.sec=clone(S.act); go('fpln',{view:'act'}); },
  docs:['ofp','load','perf'],
  steps:[
   {t:tt('DATA, POSITION MONITOR: the IRSs are in NAV and the positions agree with the FMS (within 5 NM).','DATA, POSITION MONITOR: IRS-ene er i NAV og posisjonene stemmer med FMS-en (innenfor 5 NM).'),keys:['DATA','L1'],ok:()=>!!S.seen.posmon},
   {t:tt('INIT A: check FROM/TO, ALTN, FLT NBR, COST INDEX and CRZ FL against the OFP.','INIT A: sjekk FROM/TO, ALTN, FLT NBR, COST INDEX og CRZ FL mot OFP-en.'),keys:['INIT','L6'],type:'350/-54',ok:()=>S.init.crz===350,hint2:tt('The cruise level is wrong: the OFP says FL350.','Marsjhøyden er feil: OFP-en sier FL350.')},
   {t:tt('INIT B: check ZFW/ZFWCG and BLOCK against the loadsheet.','INIT B: sjekk ZFW/ZFWCG og BLOCK mot loadsheeten.'),keys:['INIT','RIGHT','R1'],type:'58.4',ok:()=>S.fb.zfw===58.4,hint2:tt('ZFW 54.8 has its digits swapped: the loadsheet says 58.4.','ZFW 54.8 har byttet om sifrene: loadsheeten sier 58.4.')},
   {t:tt('PERF TAKE OFF: check V-speeds, FLAPS/THS and FLEX against the take-off data.','PERF TAKE OFF: sjekk V-hastigheter, FLAPS/THS og FLEX mot take-off-dataene.'),keys:['PERF','R4'],type:'52',ok:()=>S.perf.flex===52,hint2:tt('FLEX 25 is wrong: the take-off data says 52.','FLEX 25 er feil: take-off-dataene sier 52.')},
   {t:tt('Everything else matches. Check the F-PLN once more: runway 19, ROKUS1A, M611 and L44.','Resten stemmer. Sjekk F-PLN en gang til: rullebane 19, ROKUS1A, M611 og L44.'),keys:['FPLN'],ok:()=>S.init.crz===350&&S.fb.zfw===58.4&&S.perf.flex===52&&S.perf.v1===142&&S.perf.v2===146&&S.act.sid==='ROKUS1A'&&S.page==='fpln',auto:1}
  ]},
 {id:'rwy',cat:'pre',
  t:tt('Runway change with the SEC F-PLN','Rullebanebytte med SEC F-PLN'),
  d:tt('Ready on stand for runway 19. ATC: “NDP101, runway change, runway 01, ROKUS1B departure.” Build the new departure in the SEC F-PLN, activate it and enter the new take-off data.','Klar på standplass for rullebane 19. ATC: «NDP101, runway change, runway 01, ROKUS1B departure.» Bygg den nye avgangen i SEC F-PLN, aktiver den og legg inn nye take-off-data.'),
  setup(){ buildPrep(); go('fpln',{view:'act'}); },
  docs:['clr2','perf2'],
  steps:[
   {t:tt('SEC F-PLN: COPY ACTIVE.','SEC F-PLN: COPY ACTIVE.'),keys:['SEC','L1'],ok:()=>!!S.sec||S.act.dRwy==='01'},
   {t:tt('Open the SEC F-PLN, lateral revision at XNDV, DEPARTURE: runway 01, ROKUS1B, then INSERT.','Åpne SEC F-PLN, lateral revisjon på XNDV, DEPARTURE: rullebane 01, ROKUS1B, så INSERT.'),keys:['L2','L1','L1','L2','L2','R6'],ok:()=>(S.sec&&S.sec.dRwy==='01'&&S.sec.sid==='ROKUS1B'&&noTmpy())||S.act.dRwy==='01'},
   {t:tt('SEC INDEX: *ACTIVATE SEC.','SEC INDEX: *ACTIVATE SEC.'),keys:['SEC','L4'],ok:()=>S.act.dRwy==='01'&&S.act.sid==='ROKUS1B'},
   {t:tt('CHECK TAKE OFF DATA: the speeds are invalidated, with the old ones in small figures. CONFIRM TO DATA* would keep them, but they belong to runway 19. Clear the message, then enter V1 138, VR 140, V2 143.','CHECK TAKE OFF DATA: hastighetene er ugyldige, og de gamle står med små tall. CONFIRM TO DATA* ville beholdt dem, men de hører til rullebane 19. Fjern meldingen med CLR, og legg inn V1 138, VR 140, V2 143.'),keys:['CLR','PERF','L1','L2','L3'],type:'138 · 140 · 143',ok:()=>S.perf.v1===138&&S.perf.vr===140&&S.perf.v2===143},
   {t:tt('FLEX 50 for runway 01.','FLEX 50 for rullebane 01.'),keys:['R4'],type:'50',ok:()=>S.perf.flex===50}
  ]},
 {id:'dct',cat:'fly',
  t:tt('Direct to a waypoint','Direkte til et waypoint'),
  d:tt('Cruise at FL350 towards HVL. ATC: “NDP101, proceed direct ODRUP.”','Marsj i FL350 mot HVL. ATC: «NDP101, proceed direct ODRUP.»'),
  setup(){ buildPrep(); fly('HVL',0.4); go('fpln',{view:'act'}); },
  docs:['atc_dct'],
  steps:[
   {t:tt('Press DIR and select ODRUP from the list (or type it at L1).','Trykk DIR og velg ODRUP fra listen (eller skriv det på L1).'),keys:['DIR','L4'],ok:()=>(S.dir&&S.dir.tgt==='ODRUP')||(S.act.items[1]&&S.act.items[1].id==='ODRUP')},
   {t:tt('Check the TMPY, then DIR TO* (R6). The aircraft turns towards ODRUP.','Sjekk TMPY, så DIR TO* (R6). Flyet svinger mot ODRUP.'),keys:['R6'],ok:()=>S.act.items[1]&&S.act.items[1].id==='ODRUP'&&S.act.items[0].id==='T-P'}
  ]},
 {id:'app',cat:'fly',
  t:tt('Select the arrival and approach','Velg arrival og innflyging'),
  d:tt('Cruise at FL350 before ODRUP. ATIS Skarhamn: runway 25 in use, ILS approach. Expect ODRUP2W arrival, via SK260.','Marsj i FL350 før ODRUP. ATIS Skarhamn: rullebane 25 i bruk, ILS-innflyging. Forvent ODRUP2W arrival, via SK260.'),
  setup(){ buildPrep(); fly('SELKA',0.5); go('fpln',{view:'act'}); },
  docs:['atis'],
  steps:[
   {t:tt('F-PLN: L6 for a lateral revision at the destination, then ARRIVAL (R1).','F-PLN: L6 for lateral revisjon på destinasjonen, så ARRIVAL (R1).'),keys:['FPLN','L6','R1'],ok:()=>S.page==='arr'||(S.tmpy&&S.tmpy.plan.appr)||S.act.appr==='ILS25'},
   {t:tt('Select the approach ILS25.','Velg innflygingen ILS25.'),keys:['L4'],ok:()=>(S.tmpy&&S.tmpy.plan.appr==='ILS25')||S.act.appr==='ILS25'},
   {t:tt('Select the STAR ODRUP2W.','Velg STAR-en ODRUP2W.'),keys:['L4'],ok:()=>(S.tmpy&&S.tmpy.plan.star==='ODRUP2W')||S.act.star==='ODRUP2W'},
   {t:tt('Select the VIA SK260, so the STAR joins the approach without a discontinuity.','Velg VIA SK260, så STAR-en henger sammen med innflygingen uten diskontinuitet.'),keys:['L3'],ok:()=>(S.tmpy&&S.tmpy.plan.via==='SK260')||S.act.via==='SK260'},
   {t:tt('Back to the TMPY F-PLN (L6), check it, then INSERT (R6).','Tilbake til TMPY F-PLN (L6), sjekk den, så INSERT (R6).'),keys:['L6','R6'],ok:()=>S.act.appr==='ILS25'&&S.act.star==='ODRUP2W'&&S.act.via==='SK260'&&noTmpy()}
  ]},
 {id:'disc',cat:'fly',
  t:tt('Clear a F-PLN discontinuity','Fjern en F-PLN discontinuity'),
  d:tt('The ILS25 was inserted with NO VIA, so there is a discontinuity between SK260 and SK255. ATC clears you via SK260 and SK255. Clear it.','ILS25 ble lagt inn med NO VIA, så det er en diskontinuitet mellom SK260 og SK255. ATC klarerer deg via SK260 og SK255. Fjern den.'),
  setup(){ buildPrep(); setArrival(S.act,'ILS25','ODRUP2W',null); fly('SELKA',0.8,'DES',30000); go('fpln',{view:'act'}); },
  docs:['atc_disc'],
  steps:[
   {t:tt('F-PLN: scroll (↑) until the F-PLN DISCONTINUITY is visible.','F-PLN: bla (↑) til F-PLN DISCONTINUITY er synlig.'),keys:['FPLN','UP'],ok:()=>{ const rows=fplnRows('act'); const it=S.act.items, i=it.findIndex(x=>isW(x)&&x.id==='SK260'); if(i>=0&&it[i+1]&&isW(it[i+1])&&it[i+1].id==='SK255') return true; return S.page==='fpln'&&rows.slice(S.off,S.off+5).some(r=>r.it&&r.it.k==='disc'&&r.it.seg!=='enr'); }},
   {t:tt('Press CLR (the scratchpad shows CLR), then the left key next to the DISCONTINUITY.','Trykk CLR (scratchpad viser CLR), så venstre tast ved DISCONTINUITY.'),keys:['CLR'],ok:()=>{ const it=S.act.items, i=it.findIndex(x=>isW(x)&&x.id==='SK260'); return i>=0&&it[i+1]&&isW(it[i+1])&&it[i+1].id==='SK255'; }}
  ]},
 {id:'ctr',cat:'fly',
  t:tt('Extend the runway centreline','Forleng senterlinjen'),
  d:tt('Descending on the ODRUP2W for the ILS25. ATC: “NDP101, fly heading 040, vectors for ILS 25.” Build a centreline extension through SK255 so you see the final on the ND.','Nedstigning på ODRUP2W for ILS25. ATC: «NDP101, fly heading 040, vectors for ILS 25.» Lag en senterlinjeforlengelse gjennom SK255 så du ser finalen på ND-en.'),
  setup(){ buildPrep(); setArrival(S.act,'ILS25','ODRUP2W','SK260'); fly('TOLKA',0.5,'DES',11000); go('fpln',{view:'act'}); },
  docs:['atc_ctr'],
  steps:[
   {t:tt('DIR, then select SK255 (the point on final).','DIR, så velg SK255 (punktet på finalen).'),keys:['DIR','L4'],ok:()=>(S.dir&&S.dir.tgt==='SK255')||(S.lastDir&&S.lastDir.tgt==='SK255')},
   {t:tt('RADIAL IN: the opposite of the inbound course 250, so 070. Enter it at R4.','RADIAL IN: motsatt av innflygingskursen 250, altså 070. Legg det inn på R4.'),keys:['R4'],type:'070',ok:()=>(S.dir&&S.dir.rin===70)||(S.lastDir&&S.lastDir.rin===70)},
   {t:tt('DIR TO* (R6). The extended centreline shows as a dashed line on the ND.','DIR TO* (R6). Den forlengede senterlinjen vises som en stiplet linje på ND-en.'),keys:['R6'],ok:()=>S.lastDir&&S.lastDir.tgt==='SK255'&&S.lastDir.rin===70}
  ]},
 {id:'hold',cat:'fly',
  t:tt('Enter a holding','Legg inn en holding'),
  d:tt('Cruise towards ODRUP. ATC: “NDP101, hold at ODRUP, inbound course 230, left turns, one-minute legs, expect onward clearance at 50.”','Marsj mot ODRUP. ATC: «NDP101, hold at ODRUP, inbound course 230, left turns, one-minute legs, expect onward clearance at 50.»'),
  setup(){ buildPrep(); fly('SELKA',0.6); go('fpln',{view:'act'}); },
  docs:['atc_hold'],
  steps:[
   {t:tt('F-PLN: lateral revision at ODRUP (the left key next to it).','F-PLN: lateral revisjon på ODRUP (venstre tast ved siden av).'),keys:['FPLN','L3'],ok:()=>(S.page==='latrev'&&S.lr&&S.lr.id==='ODRUP')||S.page==='hold'||S.act.items.some(x=>x.k==='hold')},
   {t:tt('HOLD (L3), then DATABASE* (R2) to start from the published hold.','HOLD (L3), så DATABASE* (R2) for å starte fra den publiserte holdingen.'),keys:['L3','R2'],ok:()=>S.page==='hold'||S.act.items.some(x=>x.k==='hold')},
   {t:tt('INB CRS 230 at L1 and TURN L at L2.','INB CRS 230 på L1 og TURN L på L2.'),keys:['L1','L2'],type:'230 · L',ok:()=>{ const h=(S.tmpy?S.tmpy.plan:S.act).items.find(x=>x.k==='hold'); return h&&h.crs===230&&h.turn==='L'; }},
   {t:tt('Back to the TMPY F-PLN (L6), check the HOLD L line, then INSERT.','Tilbake til TMPY F-PLN (L6), sjekk HOLD L-linjen, så INSERT.'),keys:['L6','R6'],ok:()=>{ const h=S.act.items.find(x=>x.k==='hold'); return h&&h.at==='ODRUP'&&h.crs===230&&h.turn==='L'&&noTmpy(); }}
  ]},
 {id:'altn',cat:'fly',
  t:tt('Divert: enable the alternate','Diverter: aktiver alternativ flyplass'),
  d:tt('Cruise towards HVL. Company: “Skarhamn is closed, divert to the alternate Fjellby.”','Marsj mot HVL. Selskapet: «Skarhamn er stengt, diverter til alternativ flyplass Fjellby.»'),
  setup(){ buildPrep(); fly('HVL',0.5); go('fpln',{view:'act'}); },
  docs:['atc_altn'],
  steps:[
   {t:tt('F-PLN: lateral revision at an active waypoint, for example HVL.','F-PLN: lateral revisjon på et aktivt waypoint, for eksempel HVL.'),keys:['FPLN','L2'],ok:()=>(S.page==='latrev')||destOf(S.act).id==='XFJB'||(S.tmpy&&destOf(S.tmpy.plan).id==='XFJB')},
   {t:tt('ENABLE ALTN (L4).','ENABLE ALTN (L4).'),keys:['L4'],ok:()=>(S.tmpy&&destOf(S.tmpy.plan).id==='XFJB')||destOf(S.act).id==='XFJB'},
   {t:tt('Check the TMPY F-PLN: new destination XFJB. INSERT.','Sjekk TMPY F-PLN: ny destinasjon XFJB. INSERT.'),keys:['R6'],ok:()=>destOf(S.act).id==='XFJB'&&noTmpy()}
  ]},
 {id:'nav',cat:'fly',
  t:tt('Tune a navaid','Tune en navaid'),
  d:tt('Cruise near HVL. You want raw data from FJB, the VOR at the alternate: tune it on VOR 2 and set course 160.','Marsj nær HVL. Du vil ha rådata fra FJB, VOR-en på alternativ flyplass: tune den på VOR 2 og sett kurs 160.'),
  setup(){ buildPrep(); fly('HVL',0.7); go('fpln',{view:'act'}); },
  docs:['atc_nav'],
  steps:[
   {t:tt('RAD NAV. The auto-tuned VORs are in small letters.','RAD NAV. De autotunede VOR-ene står med små bokstaver.'),keys:['RAD'],ok:()=>S.page==='rad'||S.rad.v2==='FJB'},
   {t:tt('Type FJB (or 116.90) and press R1. Now it is hard-tuned and in large letters.','Skriv FJB (eller 116.90) og trykk R1. Nå er den hard-tunet og står med store bokstaver.'),keys:['R1'],type:'FJB',ok:()=>S.rad.v2==='FJB'},
   {t:tt('Type 160 and press R2 for the course.','Skriv 160 og trykk R2 for kursen.'),keys:['R2'],type:'160',ok:()=>S.rad.v2==='FJB'&&S.rad.c2===160}
  ]},
 {id:'appr',cat:'fly',
  t:tt('PERF APPR and GO AROUND','PERF APPR og GO AROUND'),
  d:tt('Cruise, ILS25 inserted. ATIS: wind 240/15, temperature 4, QNH 1008. ILS 25 DA 380 ft. MSA in the go-around sector 3700 ft. Do not activate the approach phase yet.','Marsj, ILS25 lagt inn. ATIS: vind 240/15, temperatur 4, QNH 1008. ILS 25 DA 380 ft. MSA i go-around-sektoren 3700 ft. Ikke aktiver approach-fasen ennå.'),
  setup(){ buildPrep(); setArrival(S.act,'ILS25','ODRUP2W','SK260'); fly('SELKA',0.5); go('fpln',{view:'act'}); },
  docs:['atis2'],
  steps:[
   {t:tt('PERF, then NEXT PHASE (R6) until the APPR page: CRZ → DES → APPR.','PERF, så NEXT PHASE (R6) til APPR-siden: CRZ → DES → APPR.'),keys:['PERF','R6','R6'],ok:()=>S.page==='perf'&&S.pp==='APPR'||S.perf.qnh!=null},
   {t:tt('QNH 1008 (L1), TEMP 4 (L2), MAG WIND 240/15 (L3).','QNH 1008 (L1), TEMP 4 (L2), MAG WIND 240/15 (L3).'),keys:['L1','L2','L3'],type:'1008 · 4 · 240/15',hint2:tt('Watch the QNH field: a temperature typed there by mistake, such as 22, is accepted as 22 inHg.','Pass på QNH-feltet: en temperatur skrevet der ved en feil, for eksempel 22, godtas som 22 inHg.'),ok:()=>S.perf.qnh===1008&&S.perf.tmp===4&&S.perf.wd===240&&S.perf.ws===15},
   {t:tt('BARO 380 (R2): on a CAT I ILS the DA goes in the BARO field.','BARO 380 (R2): på en CAT I ILS går DA i BARO-feltet.'),keys:['R2'],type:'380',ok:()=>S.perf.baro===380},
   {t:tt('NEXT PHASE to GO AROUND: THR RED/ACC 1180/1180 (L5), 1000 ft above the aerodrome.','NEXT PHASE til GO AROUND: THR RED/ACC 1180/1180 (L5), 1000 ft over flyplassen.'),keys:['R6','L5'],type:'1180/1180',ok:()=>S.perf.gthr===1180&&S.perf.gacc===1180},
   {t:tt('ENG OUT ACC 3700 (R5), the highest MSA in the go-around sector.','ENG OUT ACC 3700 (R5), høyeste MSA i go-around-sektoren.'),keys:['R5'],type:'3700',ok:()=>S.perf.geoa===3700&&S.phase!=='APP'}
  ]},
 {id:'cstr',cat:'fly',
  t:tt('Altitude and speed constraint','Høyde- og fartsrestriksjon'),
  d:tt('Cruise towards SELKA. ATC: “NDP101, cross ODRUP at FL110, speed 250 knots.” Put it into the F-PLN with a vertical revision.','Marsj mot SELKA. ATC: «NDP101, cross ODRUP at FL110, speed 250 knots.» Legg det inn i F-PLN med en vertikal revisjon.'),
  setup(){ buildPrep(); fly('SELKA',0.3); go('fpln',{view:'act'}); },
  docs:['atc_cstr'],
  steps:[
   {t:tt('F-PLN: the RIGHT key next to ODRUP opens VERT REV AT ODRUP.','F-PLN: HØYRE tast ved ODRUP åpner VERT REV AT ODRUP.'),keys:['FPLN','R3'],ok:()=>(S.page==='vrev'&&S.vr&&S.act.items[S.vr.i]&&S.act.items[S.vr.i].id==='ODRUP')||S.act.items.some(x=>x.id==='ODRUP'&&x.alt==='FL110')},
   {t:tt('ALT CSTR: type FL110 and press R3. “At” is written without a sign; +FL110 would be at or above.','ALT CSTR: skriv FL110 og trykk R3. «At» skrives uten fortegn; +FL110 ville vært «at or above».'),keys:['R3'],type:'FL110',ok:()=>S.act.items.some(x=>x.id==='ODRUP'&&x.alt==='FL110')},
   {t:tt('SPD CSTR: type 250 and press L3.','SPD CSTR: skriv 250 og trykk L3.'),keys:['L3'],type:'250',ok:()=>S.act.items.some(x=>x.id==='ODRUP'&&x.spd===250)},
   {t:tt('RETURN (L6): ODRUP now shows *250/FL110 in magenta. Tip: on the F-PLN page you can also type 250/FL110 straight onto the right key.','RETURN (L6): ODRUP viser nå *250/FL110 i magenta. Tips: på F-PLN-siden kan du også skrive 250/FL110 rett på høyre tast.'),keys:['L6'],ok:()=>S.page==='fpln'&&S.act.items.some(x=>x.id==='ODRUP'&&x.alt==='FL110'&&x.spd===250)}
  ]},
 {id:'secair',cat:'fly',
  t:tt('Runway change in flight with the SEC F-PLN','Rullebanebytte i lufta med SEC F-PLN'),
  d:tt('Descending on the ODRUP2W for the ILS25. ATC: “NDP101, runway change, turn left heading 270, expect ILS runway 07 via SK070.” In NAV the *ACTIVATE SEC prompt is hidden: select heading first.','Nedstigning på ODRUP2W for ILS25. ATC: «NDP101, runway change, turn left heading 270, expect ILS runway 07 via SK070.» I NAV er *ACTIVATE SEC skjult: velg heading først.'),
  setup(){ buildPrep(); setArrival(S.act,'ILS25','ODRUP2W','SK260'); fly('TOLKA',0.25,'DES',12000); go('fpln',{view:'act'}); },
  docs:['atc_secair'],
  steps:[
   {t:tt('FCU (above the ND): select heading 270 with the HDG buttons, so the aircraft is in HDG.','FCU (over ND-en): velg heading 270 med HDG-knappene, så flyet er i HDG.'),keys:[],hint2:tt('Use − and + next to HDG until it shows 270 (it switches to HDG), or type the heading in the HDG box.','Bruk − og + ved HDG til det står 270 (den går over i HDG), eller skriv headingen i HDG-feltet.'),ok:()=>S.ap==='HDG'&&S.hdg===270},
   {t:tt('SEC F-PLN: COPY ACTIVE.','SEC F-PLN: COPY ACTIVE.'),keys:['SEC','L1'],ok:()=>!!S.sec||S.act.appr==='ILS07'},
   {t:tt('SEC F-PLN (L2), L6 for XSKH, ARRIVAL: ILS07, NO STAR, VIA SK070, then INSERT.','SEC F-PLN (L2), L6 for XSKH, ARRIVAL: ILS07, NO STAR, VIA SK070, så INSERT.'),keys:['L2','L6','R1','L3','L5','L3','R6'],ok:()=>(S.sec&&S.sec.appr==='ILS07'&&S.sec.via==='SK070'&&!(S.tmpy&&S.tmpy.tgt==='sec'))||S.act.appr==='ILS07'},
   {t:tt('SEC INDEX: *ACTIVATE SEC (L4). It is there because you are in HDG.','SEC INDEX: *ACTIVATE SEC (L4). Den vises fordi du er i HDG.'),keys:['SEC','L4'],ok:()=>S.act.appr==='ILS07'&&S.act.via==='SK070'},
   {t:tt('ATC: “Cleared direct SK070.” DIR, SK070, DIR TO*. NAV engages again.','ATC: «Cleared direct SK070.» DIR, SK070, DIR TO*. NAV kobles inn igjen.'),keys:['DIR','L2','R6'],ok:()=>S.act.appr==='ILS07'&&S.act.items[1]&&S.act.items[1].id==='SK070'&&S.ap==='NAV'}
  ]},
 {id:'drill',cat:'hidden',t:tt('Find the field','Finn feltet'),d:tt('Find the page and the line key for each field.','Finn siden og linjetasten for hvert felt.'),setup(){ buildPrep(); S.sec=clone(S.act); go('acstat'); },docs:[],steps:[]},
 {id:'free',cat:'free',
  t:tt('Free practice','Fri trening'),
  d:tt('An empty FMS on the ground at XNDV. Use the paperwork and set it up your own way, or try any page.','En tom FMS på bakken på XNDV. Bruk papirene og sett den opp på din måte, eller prøv hvilken som helst side.'),
  setup(){ go('acstat'); }, docs:['ofp','load','perf','clr'], steps:[]}
];

/* paperwork shown beside the MCDU (fictional, for training) */
function docHtml(k){
  const no=isNo();
  const D={
    ofp:['OFP',`NDP101  XNDV → XSKH   ALTN XFJB
A320-214     CI 30     FL350  ISA −54 °C
ROUTE  ROKUS1A ROKUS M611 HVL L44 ODRUP
       (arrival to be assigned)
DIST 245 NM`],
    load:[no?'Loadsheet (foreløpig)':'Loadsheet (preliminary)',`ZFW     58.4 t      ZFWCG 28.5 %
BLOCK    7.8 t      TAXI   0.2 t
TOW     66.0 t`],
    perf:[no?'Take-off-data':'Take-off data',`XNDV  RWY 19  FULL LENGTH
CONF 1+F    FLEX 52 °C
V1 142   VR 144   V2 146
THS UP0.4   TRANS ALT 7000`],
    perf2:[no?'Take-off-data, nye':'Take-off data, new',`XNDV  RWY 01  FULL LENGTH
CONF 1+F    FLEX 50 °C
V1 138   VR 140   V2 143
THS UP0.4`],
    clr:['ATC',`NDP101 cleared to Skarhamn,
runway 19, ROKUS1A departure,
climb FL060, squawk 4521`],
    clr2:['ATC',`NDP101, runway change,
runway 01, ROKUS1B departure,
rest unchanged`],
    atc_dct:['ATC','NDP101, proceed direct ODRUP'],
    atc_cstr:['ATC',`NDP101, cross ODRUP at FL110,
speed 250 knots`],
    atc_secair:['ATC',`NDP101, runway change,
turn left heading 270,
expect ILS runway 07 via SK070`],
    atc_hold:['ATC',`NDP101, hold at ODRUP,
inbound course 230, left turns,
one-minute legs,
expect onward clearance at 50`],
    atc_ctr:['ATC',`NDP101, fly heading 040,
vectors for ILS runway 25`],
    atc_disc:['ATC',`NDP101, cleared ODRUP2W arrival,
then via SK260 and SK255
for the ILS runway 25`],
    atc_altn:[no?'Selskapet':'Company',`Skarhamn closed until 1700.
Divert to Fjellby (XFJB).`],
    atc_nav:[no?'Oppgave':'Task',`Hard-tune FJB 116.90 on VOR 2,
course 160`],
    atis:['ATIS XSKH',`SKARHAMN INFO C
RWY 25 IN USE, ILS APPROACH
EXPECT ODRUP2W VIA SK260
240/15 9999 FEW030 04/M01 Q1008`],
    atis2:['ATIS XSKH',`SKARHAMN INFO C
RWY 25 IN USE, ILS APPROACH
240/15 9999 FEW030 04/M01 Q1008
ILS 25 DA 380 FT
MSA GO-AROUND SECTOR 3700 FT`]
  };
  const d=D[k]; if(!d) return '';
  return `<div class="mdoc"><b>${esc(d[0])}</b><pre>${esc(d[1])}</pre></div>`;
}

/* =========================================================== UI */
const el=id=>document.getElementById(id);
/* =========================================================== ND (PLAN mode) */
/* North up, centred like the aircraft: on the waypoint on the second line of the F-PLN page you are looking at.
   Green = active F-PLN, yellow dashed = TMPY, white dashed = SEC, cyan dashed = missed approach and alternate. */
const RANGES=[10,20,40,80,160,320];
let NDR=2, NDC=null;
function ndCentre(){
  if(S.page==='fpln'){ const rows=fplnRows(S.view||'act'); for(const k of [1,0,2,3]){ const r=rows[S.off+k]; const c=r&&r.it?coord(r.it):null; if(c&&!(r.it.id==='T-P')){ NDC={x:c.x,y:c.y}; return NDC; } } }
  if(S.page==='latrev'&&S.lr){ const it=planFor(S.lr.view).items[S.lr.i]; const c=coord(it); if(c){ NDC={x:c.x,y:c.y}; return NDC; } }
  if(S.page==='hold'&&S.hold){ const h=planFor(S.hold.view).items[S.hold.i]; if(h&&P[h.at]){ NDC={x:P[h.at].x,y:P[h.at].y}; return NDC; } }
  if(S.page==='dir'&&S.dir&&S.dir.tgt&&P[S.dir.tgt]){ NDC={x:P[S.dir.tgt].x,y:P[S.dir.tgt].y}; return NDC; }
  if(NDC) return NDC;
  if(S.phase!=='PRE') return NDC={x:S.pos.x,y:S.pos.y};
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
      if(it.k==='wpt'&&it.id!=='T-P'&&IN(q)){ const lc=tag==='act'&&fl&&i===1?'#ECEFF1':col; marks.push(`<g transform="translate(${X(q)},${Y(q)})"><path d="M0-5L5 0 0 5-5 0z" fill="none" stroke="${lc}" stroke-width="1.4"/></g>`); if(!labels.has(it.id+tag)){ labels.add(it.id+tag); marks.push(`<text x="${X(q)+8}" y="${Y(q)+4}" class="ndt" fill="${lc}">${esc(it.id)}${it.ov?'Δ':''}</text>`); } }
      if(it.rin!=null){ const o=along(q,it.rin,Math.min(rng*0.6,25)); lines.push(`<line x1="${X(q)}" y1="${Y(q)}" x2="${X(o)}" y2="${Y(o)}" stroke="${col}" stroke-width="${w}" stroke-dasharray="6 5"/>`); }
    });
    if(cur.length>1) segs.push(cur);
    for(const sg of segs) lines.push(`<polyline points="${sg.map(q=>X(q).toFixed(1)+','+Y(q).toFixed(1)).join(' ')}" fill="none" stroke="${col}" stroke-width="${w}" ${dash?`stroke-dasharray="${dash}"`:''} stroke-linejoin="round"/>`);
    /* missed approach */
    const d=destOf(p); if(p.miss&&p.miss.length&&d){ let a=coord(d); for(const m of p.miss){ const b=coord(m); if(a&&b) lines.push(`<line x1="${X(a)}" y1="${Y(a)}" x2="${X(b)}" y2="${Y(b)}" stroke="#3CC8F5" stroke-width="1.6" stroke-dasharray="6 5"/>`); if(b&&IN(b)) marks.push(`<text x="${X(b)+8}" y="${Y(b)+4}" class="ndt c">${esc(m.id)}</text>`); a=b; } }
  };
  const act=S.act, tm=S.tmpy;
  if(S.view==='sec'&&S.sec&&S.page==='fpln') plan(tm&&tm.tgt==='sec'?tm.plan:S.sec,'#ECEFF1','7 5',1.8,'sec');
  plan(act,'#3BE37A',null,2.2,'act');
  if(tm&&tm.tgt==='act') plan(tm.plan,'#FFE14D','8 5',2.2,'tmp');
  /* alternate */
  const al=act.altn||S.init.altn, dd=destOf(act); if(al&&dd&&P[al]&&dd.id!==al){ const a=coord(dd), b=P[al]; lines.push(`<line x1="${X(a)}" y1="${Y(a)}" x2="${X(b)}" y2="${Y(b)}" stroke="#3CC8F5" stroke-width="1.4" stroke-dasharray="4 6" opacity=".8"/>`); }
  /* airports with the runway in use */
  for(const a in AP){ const A=AP[a], p=P[a]; let rw=null; if(act.from===a&&act.dRwy) rw=act.dRwy; const de=destOf(act); if(de&&de.id===a&&de.rwy) rw=de.rwy;
    const rws=rw?[rw]:Object.keys(A.rwy).slice(0,1);
    for(const r of rws){ const R_=A.rwy[r], h=R_.len/1852/2, t1=along(p,R_.crs+180,h), t2=along(p,R_.crs,h); marks.push(`<line x1="${X(t1)}" y1="${Y(t1)}" x2="${X(t2)}" y2="${Y(t2)}" stroke="#ECEFF1" stroke-width="${rw?3:2}"/>`); }
    if(IN(p)) marks.push(`<text x="${X(p)+9}" y="${Y(p)+14}" class="ndt w">${a}${rw?rw:''}</text>`); }
  /* pending DIR TO */
  if(S.page==='dir'&&S.dir&&S.dir.tgt&&P[S.dir.tgt]&&S.phase!=='PRE'){ const t=P[S.dir.tgt]; lines.push(`<line x1="${X(S.pos)}" y1="${Y(S.pos)}" x2="${X(t)}" y2="${Y(t)}" stroke="#FFE14D" stroke-width="2.2" stroke-dasharray="8 5"/>`); if(S.dir.rin!=null){ const o=along(t,S.dir.rin,Math.min(rng*0.6,25)); lines.push(`<line x1="${X(t)}" y1="${Y(t)}" x2="${X(o)}" y2="${Y(o)}" stroke="#FFE14D" stroke-width="2" stroke-dasharray="6 5"/>`); } }
  /* pseudo waypoints along the active route */
  { const V=!S.tmpy?vprof('act'):null; if(V){ const it=act.items; for(const ps of V.ps){ let k=-1; for(let i=1;i<it.length;i++){ if(V.cum[i]!=null&&coord(it[i])&&V.cum[i]>=ps.d){ k=i; break; } } if(k<1) continue; let j=k-1; while(j>0&&!coord(it[j])) j--; const a=j===0&&V.fl?S.pos:coord(it[j]), b=coord(it[k]); if(!a||!b||it[k-1].k==='disc') continue; const seg=(V.cum[k]-(j===0&&V.fl?0:V.cum[j]))||1, f=Math.max(0,Math.min(1,1-(V.cum[k]-ps.d)/seg)); const q={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f}; if(!IN(q)) continue; const col=ps.decel?'#F45BFF':'#3BE37A'; marks.push(`<circle cx="${X(q)}" cy="${Y(q)}" r="3.2" fill="none" stroke="${col}" stroke-width="1.4"/><text x="${X(q)+6}" y="${Y(q)-6}" class="ndt" style="font-size:11px" fill="${col}">${esc(ps.n.replace(/[()]/g,''))}</text>`); } } }
  out.push(lines.join(''), marks.join(''));
  /* aircraft */
  if(S.phase!=='PRE'){ const to=coord(act.items[1]); const hd=to?brg(S.pos,to):0; out.push(`<g transform="translate(${X(S.pos)},${Y(S.pos)}) rotate(${hd})"><path d="M0-11V12M-10-1H10M-4 9H4" stroke="#FFE14D" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`); }
  out.push('</g>');
  const gsn=S.hz?230:(S.phase==='CRZ'?450:290); const tl=S.phase==='PRE'?'':`GS ${gsn} TAS ${gsn+20}`;
  out.push(`<text x="10" y="18" class="ndt w">${tl}</text><text x="390" y="18" class="ndt g" text-anchor="end">${esc(act.items[1]&&isW(act.items[1])&&S.phase!=='PRE'?act.items[1].id:'')}</text>`);
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
const KEYS_TOP=[['DIR','DIR'],['PROG','PROG'],['PERF','PERF'],['INIT','INIT'],['DATA','DATA'],['',''],['BRT','BRT'],['FPLN','F-PLN'],['RAD','RAD NAV'],['FUEL','FUEL PRED'],['SEC','SEC F-PLN'],['ATC','ATC COMM'],['MENU','MCDU MENU'],['DIM','DIM'],['AIRPORT','AIR PORT']];
function buildMcdu(){
  const m=el('mcdu'); if(!m) return;
  let lsk=side=>{ let h=`<div class="mlsk ${side}">`; for(let n=1;n<=6;n++) h+=`<button type="button" class="k lk" data-k="${side}${n}" style="grid-row:${2*n+1}" aria-label="${side==='L'?'Left':'Right'} line key ${n}"><span></span></button>`; return h+'</div>'; };
  let h=`<div class="mtop">${lsk('L')}<div class="mscr" id="mscr" role="img" aria-label="MCDU display"></div>${lsk('R')}</div>`;
  h+='<div class="mpk">'+KEYS_TOP.map(([k,t])=>k?`<button type="button" class="k pk${k==='BRT'||k==='DIM'?' sm':''}" data-k="${k}">${t.replace(' ','<br>')}</button>`:'<span></span>').join('')+'</div>';
  const arrows=[['LEFT','←'],['UP','↑'],['RIGHT','→'],['DOWN','↓']].map(([k,t])=>`<button type="button" class="k ak" data-k="${k}" aria-label="${k.toLowerCase()}">${t}</button>`).join('');
  const nums=['1','2','3','4','5','6','7','8','9','DOT','0','PM'].map(k=>`<button type="button" class="k nk" data-k="${k}">${k==='DOT'?'.':k==='PM'?'+/−':k}</button>`).join('');
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat(['SLASH','SP','OVFY','CLR']).map(k=>`<button type="button" class="k ck${k==='CLR'?' clr':''}" data-k="${k}">${k==='SLASH'?'/':k==='OVFY'?'OVFY<br>Δ':k}</button>`).join('');
  h+=`<div class="mkb"><div class="mkl"><div class="mar">${arrows}</div><div class="mnum">${nums}</div></div><div class="mlet">${letters}</div></div>`;
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
  if(/^[a-zA-Z]$/.test(c)) k=c.toUpperCase(); else if(/^[0-9]$/.test(c)) k=c; else if(c==='/') k='SLASH'; else if(c==='.'||c===',') k='DOT'; else if(c==='-'||c==='+') k='PM'; else if(c===' '&&ACT) k='SP'; else if(c==='Backspace'||c==='Delete') k='CLR';
  else if(ACT&&c==='ArrowUp') k='UP'; else if(ACT&&c==='ArrowDown') k='DOWN'; else if(ACT&&c==='ArrowLeft') k='LEFT'; else if(ACT&&c==='ArrowRight') k='RIGHT';
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
function keyName(k){ return ({FPLN:'F-PLN',RAD:'RAD NAV',FUEL:'FUEL PRED',SEC:'SEC F-PLN',MENU:'MCDU MENU',UP:'↑',DOWN:'↓',LEFT:'←',RIGHT:'→',SLASH:'/',PM:'+/−'})[k]||k; }
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
  if(SC.cat!=='hidden'){ try{ localStorage.setItem('mcdu-scn',SC.id); }catch(e){} }
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
  let first='prep'; try{ const s=localStorage.getItem('mcdu-scn'); if(s&&SCN.some(x=>x.id===s)) first=s; }catch(e){}
  const h=location.hash.replace('#',''); if(SCN.some(x=>x.id===h)) first=h;
  loadScn(first);
  courseUi(); refUi();
  if(LB()) LB().onLang(()=>{ buildList(); loadScnKeep(); courseUi(); refUi(); });
}
function loadScnKeep(){ /* language change: redraw texts without resetting the state */ el('mdocs').innerHTML=SC.docs.map(docHtml).join(''); el('mtitle').textContent=Lx(SC.t); document.querySelectorAll('#mlist button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===SC.id?'true':'false')); refresh(); }


/* =========================================================== course: modules, quizzes, find-the-field drill, reference */
const DRILL_T=[
 {id:'fromto',q:tt('Enter FROM/TO','Legg inn FROM/TO'),pg:()=>S.page==='init',k:'R1',a:'INIT · R1'},
 {id:'altn',q:tt('Enter the alternate','Legg inn alternativ flyplass'),pg:()=>S.page==='init',k:'L2',a:'INIT · L2'},
 {id:'flt',q:tt('Enter the flight number','Legg inn flightnummeret'),pg:()=>S.page==='init',k:'L3',a:'INIT · L3'},
 {id:'ci',q:tt('Enter the cost index','Legg inn cost index'),pg:()=>S.page==='init',k:'L5',a:'INIT · L5'},
 {id:'crz',q:tt('Enter the cruise level and temperature','Legg inn marsjhøyde og temperatur'),pg:()=>S.page==='init',k:'L6',a:'INIT · L6'},
 {id:'irs',q:tt('Open IRS INIT','Åpne IRS INIT'),pg:()=>S.page==='init',k:'R3',a:'INIT · R3'},
 {id:'zfw',q:tt('Enter ZFW and ZFWCG','Legg inn ZFW og ZFWCG'),pg:()=>S.page==='initb',k:'R1',a:'INIT · → · R1'},
 {id:'block',q:tt('Enter the block fuel','Legg inn block fuel'),pg:()=>S.page==='initb',k:'R2',a:'INIT · → · R2'},
 {id:'taxi',q:tt('Change the taxi fuel','Endre taxi fuel'),pg:()=>S.page==='initb',k:'L1',a:'INIT · → · L1'},
 {id:'v1',q:tt('Enter V1','Legg inn V1'),pg:()=>S.page==='perf'&&(S.pp||actPhase())==='TO',k:'L1',a:'PERF · L1'},
 {id:'v2',q:tt('Enter V2','Legg inn V2'),pg:()=>S.page==='perf'&&(S.pp||actPhase())==='TO',k:'L3',a:'PERF · L3'},
 {id:'ths',q:tt('Enter FLAPS/THS for take-off','Legg inn FLAPS/THS for avgang'),pg:()=>S.page==='perf'&&(S.pp||actPhase())==='TO',k:'R3',a:'PERF · R3'},
 {id:'flex',q:tt('Enter the FLEX temperature','Legg inn FLEX-temperaturen'),pg:()=>S.page==='perf'&&(S.pp||actPhase())==='TO',k:'R4',a:'PERF · R4'},
 {id:'thr',q:tt('Change THR RED/ACC for take-off','Endre THR RED/ACC for avgang'),pg:()=>S.page==='perf'&&(S.pp||actPhase())==='TO',k:'L5',a:'PERF · L5'},
 {id:'ta',q:tt('Change the departure transition altitude','Endre overgangshøyden for avgangen'),pg:()=>S.page==='perf'&&(S.pp||actPhase())==='TO',k:'L4',a:'PERF · L4'},
 {id:'qnh',q:tt('Enter the destination QNH','Legg inn QNH på destinasjonen'),pg:()=>S.page==='perf'&&(S.pp||actPhase())==='APPR',k:'L1',a:'PERF · NEXT PHASE ×4 · L1'},
 {id:'baro',q:tt('Enter the BARO minimum (DA on a CAT I ILS)','Legg inn BARO-minimum (DA på en CAT I ILS)'),pg:()=>S.page==='perf'&&(S.pp||actPhase())==='APPR',k:'R2',a:'PERF · NEXT PHASE ×4 · R2'},
 {id:'ldg',q:tt('Select landing CONF FULL','Velg landing CONF FULL'),pg:()=>S.page==='perf'&&(S.pp||actPhase())==='APPR',k:'R5',a:'PERF · NEXT PHASE ×4 · R5'},
 {id:'eoa',q:tt('Enter the go-around ENG OUT ACC','Legg inn ENG OUT ACC for go-around'),pg:()=>S.page==='perf'&&(S.pp||actPhase())==='GA',k:'R5',a:'PERF · NEXT PHASE ×5 · R5'},
 {id:'vor1',q:tt('Hard-tune VOR 1','Hard-tune VOR 1'),pg:()=>S.page==='rad',k:'L1',a:'RAD NAV · L1'},
 {id:'crs2',q:tt('Set the course for VOR 2','Sett kursen for VOR 2'),pg:()=>S.page==='rad',k:'R2',a:'RAD NAV · R2'},
 {id:'ils',q:tt('Tune an ILS manually','Tune en ILS manuelt'),pg:()=>S.page==='rad',k:'L3',a:'RAD NAV · L3'},
 {id:'copy',q:tt('Copy the active flight plan to the SEC','Kopier aktiv flyplan til SEC'),pg:()=>S.page==='sec',k:'L1',a:'SEC F-PLN · L1'},
 {id:'acst',q:tt('Open A/C STATUS (nav database)','Åpne A/C STATUS (navigasjonsdatabasen)'),pg:()=>S.page==='data'&&S.dpg!==2,k:'L4',a:'DATA · L4'},
 {id:'posm',q:tt('Open POSITION MONITOR','Åpne POSITION MONITOR'),pg:()=>S.page==='data'&&S.dpg!==2,k:'L1',a:'DATA · L1'},
 {id:'dep',q:tt('Open DEPARTURE to choose runway and SID','Åpne DEPARTURE for å velge rullebane og SID'),pg:()=>S.page==='latrev'&&S.lr&&(planFor(S.lr.view).items[S.lr.i]||{}).k==='apt',k:'L1',a:'F-PLN · L1 (XNDV) · L1'},
 {id:'arr',q:tt('Open ARRIVAL at the destination','Åpne ARRIVAL på destinasjonen'),pg:()=>S.page==='latrev'&&S.lr&&(planFor(S.lr.view).items[S.lr.i]||{}).k==='dest',k:'R1',a:'F-PLN · L6 · R1'},
 {id:'awy',q:tt('Open AIRWAYS from a waypoint','Åpne AIRWAYS fra et waypoint'),pg:()=>S.page==='latrev'&&S.lr&&(planFor(S.lr.view).items[S.lr.i]||{}).k==='wpt',k:'R5',a:tt('F-PLN · left key at the waypoint · R5','F-PLN · venstre tast ved waypointet · R5')},
 {id:'hold',q:tt('Open HOLD at a waypoint','Åpne HOLD på et waypoint'),pg:()=>S.page==='latrev'&&S.lr&&(planFor(S.lr.view).items[S.lr.i]||{}).k==='wpt',k:'L3',a:tt('F-PLN · left key at the waypoint · L3','F-PLN · venstre tast ved waypointet · L3')},
 {id:'cstr',q:tt('Open the vertical revision (constraints) at a waypoint','Åpne vertikal revisjon (restriksjoner) på et waypoint'),pg:()=>S.page==='fpln'&&(S.view||'act')==='act',k:'R',a:tt('F-PLN · RIGHT key at the waypoint','F-PLN · HØYRE tast ved waypointet'),any:1},
 {id:'brg',q:tt('Get bearing and distance to a point','Få peiling og avstand til et punkt'),pg:()=>S.page==='prog',k:'R4',a:'PROG · R4'}
];
const COURSE=[
 {id:'m1',t:tt('The MCDU in ten minutes','MCDU-en på ti minutter'),s:tt('Keys, scratchpad, colours and CLR','Taster, scratchpad, farger og CLR'),
  pts:[tt('The page keys open pages. The six keys on each side (L1–L6, R1–R6) select the line beside them.','Sidetastene åpner sider. De seks tastene på hver side (L1–L6, R1–R6) velger linjen ved siden av.'),
       tt('Write first, then “throw” it: type in the scratchpad, then press the line key beside the field.','Skriv først, «kast» det så: skriv i scratchpad, og trykk linjetasten ved feltet.'),
       tt('Colours: amber boxes must be filled, cyan you can change, green is computed by the FMS, magenta are constraints, yellow is the temporary flight plan. Small letters are default or computed values, large letters are entries.','Farger: oransje bokser må fylles ut, cyan kan du endre, grønt er beregnet av FMS-en, magenta er restriksjoner, gult er den midlertidige flyplanen. Små bokstaver er standard- eller beregnede verdier, store bokstaver er innlagte verdier.'),
       tt('CLR deletes one character. On an empty scratchpad it writes CLR: then the line key deletes that field. CLR also removes a message.','CLR sletter ett tegn. På tom scratchpad skriver den CLR: da sletter linjetasten feltet. CLR fjerner også en melding.'),
       tt('← and → change between pages of one function (INIT A and INIT B). ↑ and ↓ scroll lists and the flight plan.','← og → bytter mellom sidene i én funksjon (INIT A og INIT B). ↑ og ↓ blar i lister og i flyplanen.')],
  tasks:['free'],drill:['fromto','altn','ci','crz','zfw','block','vor1','acst'],
  quiz:[{q:tt('An entry is shown in amber boxes. What does it mean?','En verdi vises som oransje bokser. Hva betyr det?'),a:[tt('It must be filled in','Den må fylles ut'),tt('It is optional','Den er valgfri'),tt('It is computed by the FMS','Den er beregnet av FMS-en')],c:0,w:tt('Amber boxes are mandatory data. Cyan brackets are optional.','Oransje bokser er obligatoriske data. Cyan klammer er valgfrie.')},
        {q:tt('How do you delete the cost index on INIT A?','Hvordan sletter du cost index på INIT A?'),a:[tt('Press CLR until it is gone','Trykk CLR til den er borte'),tt('CLR on an empty scratchpad, then L5','CLR på tom scratchpad, så L5'),tt('Type 0 and press L5','Skriv 0 og trykk L5')],c:1,w:tt('CLR on an empty scratchpad shows CLR; the line key then deletes the field.','CLR på tom scratchpad viser CLR; linjetasten sletter så feltet.')},
        {q:tt('Waypoints in yellow on the F-PLN mean …','Gule waypoints i F-PLN betyr …'),a:[tt('the active flight plan','den aktive flyplanen'),tt('a temporary flight plan that is not inserted yet','en midlertidig flyplan som ikke er satt inn ennå'),tt('the secondary flight plan','den sekundære flyplanen')],c:1,w:tt('Yellow is TMPY. Check it, then INSERT or ERASE.','Gult er TMPY. Sjekk den, så INSERT eller ERASE.')},
        {q:tt('How do you get from INIT A to INIT B?','Hvordan kommer du fra INIT A til INIT B?'),a:[tt('The → key','→-tasten'),tt('R6','R6'),tt('The FUEL PRED key','FUEL PRED-tasten')],c:0,w:tt('The slew key → turns the page. After engine start INIT B is replaced by FUEL PRED.','Slew-tasten → blar til neste side. Etter motorstart erstattes INIT B av FUEL PRED.')}]},
 {id:'m2',t:tt('Cockpit preparation: D-I-F-R-I-P','Cockpit preparation: D-I-F-R-I-P'),s:tt('The order, who does what, and the crosscheck','Rekkefølgen, hvem gjør hva, og crosschecken'),
  pts:[tt('D-I-F-R-I-P: DATA (A/C STATUS, database), INIT A, F-PLN (with the SEC), RAD NAV, INIT B, PERF.','D-I-F-R-I-P: DATA (A/C STATUS, database), INIT A, F-PLN (med SEC), RAD NAV, INIT B, PERF.'),
       tt('Only D-I-F-R before the loadsheet. INIT B and PERF come when the loadsheet and take-off data are there.','Bare D-I-F-R før loadsheeten. INIT B og PERF kommer når loadsheet og take-off-data er der.'),
       tt('The F-PLN is checked against the OFP: runway, SID, airways, distance. A discontinuity before the destination stays until the arrival is inserted in cruise.','F-PLN sjekkes mot OFP-en: rullebane, SID, luftveier, distanse. En diskontinuitet før destinasjonen blir stående til arrival legges inn i marsjhøyde.'),
       tt('Predictions (times, levels, T/C and T/D) appear only when ZFW, BLOCK and the cruise level are entered.','Prediksjoner (tider, høyder, T/C og T/D) kommer først når ZFW, BLOCK og marsjhøyde er lagt inn.'),
       tt('PF sets up, then: “I’ve set up the FMGS, please check it.” PM checks every page against the paperwork.','PF setter opp, så: «I’ve set up the FMGS, please check it.» PM sjekker hver side mot papirene.')],
  tasks:['prep','xchk'],drill:['acst','fromto','flt','crz','dep','copy','vor1','zfw','block','v1','ths','flex'],
  quiz:[{q:tt('What can you do before the loadsheet has arrived?','Hva kan du gjøre før loadsheeten er kommet?'),a:[tt('D-I-F-R','D-I-F-R'),tt('Everything','Alt'),tt('Only DATA','Bare DATA')],c:0,w:tt('INIT B (weights) and PERF (speeds) depend on the loadsheet and the take-off data.','INIT B (vekter) og PERF (hastigheter) avhenger av loadsheet og take-off-data.')},
        {q:tt('Why are there no times or levels in the F-PLN yet?','Hvorfor står det ingen tider eller høyder i F-PLN ennå?'),a:[tt('The SID is missing','SID-en mangler'),tt('ZFW and BLOCK (INIT B) are not entered','ZFW og BLOCK (INIT B) er ikke lagt inn'),tt('The IRS is not aligned','IRS er ikke alignet')],c:1,w:tt('Without weights the FMS cannot compute a speed profile and predictions.','Uten vekter kan ikke FMS-en beregne fartsprofil og prediksjoner.')},
        {q:tt('What is COPY ACTIVE in the SEC F-PLN for on the ground?','Hva brukes COPY ACTIVE i SEC F-PLN til på bakken?'),a:[tt('A backup in case the FMS fails','En reserve hvis FMS-en svikter'),tt('A ready plan for a likely runway change','En klar plan for et sannsynlig rullebanebytte'),tt('To send the plan to ATC','For å sende planen til ATC')],c:1,w:tt('You copy, change the departure in the SEC, and activate it if the runway changes.','Du kopierer, endrer avgangen i SEC og aktiverer den hvis rullebanen endres.')},
        {q:tt('ZFW on the loadsheet is 58.4, the FMS shows 54.8. What do you do?','ZFW på loadsheeten er 58.4, FMS-en viser 54.8. Hva gjør du?'),a:[tt('Accept it, it is close','Godtar, det er nært'),tt('Correct it on INIT B and tell PF','Retter på INIT B og sier det til PF'),tt('Change BLOCK instead','Endrer BLOCK i stedet')],c:1,w:tt('Swapped digits are a classic error. Weight errors affect speeds, trim and performance.','Ombyttede siffer er en klassisk feil. Vektfeil påvirker hastigheter, trim og ytelse.')}]},
 {id:'m3',t:tt('The flight plan','Flyplanen'),s:tt('TMPY, discontinuities, airways and revisions','TMPY, diskontinuiteter, luftveier og revisjoner'),
  pts:[tt('Left key on a waypoint: lateral revision (route). Right key: vertical revision (speed and altitude constraints).','Venstre tast ved et waypoint: lateral revisjon (rute). Høyre tast: vertikal revisjon (fart- og høyderestriksjoner).'),
       tt('Changes from LAT REV, DEPARTURE, ARRIVAL and HOLD become a TMPY (yellow). Check it, then INSERT or ERASE.','Endringer fra LAT REV, DEPARTURE, ARRIVAL og HOLD blir en TMPY (gul). Sjekk den, så INSERT eller ERASE.'),
       tt('A waypoint typed straight onto an F-PLN line goes directly into the plan, followed by a F-PLN DISCONTINUITY.','Et waypoint skrevet rett på en F-PLN-linje går direkte inn i planen, etterfulgt av en F-PLN DISCONTINUITY.'),
       tt('The aircraft does not fly past a discontinuity in NAV. Clear it with CLR and the key beside it, but only when the route on both sides is what ATC cleared.','Flyet flyr ikke forbi en diskontinuitet i NAV. Fjern den med CLR og tasten ved siden av, men bare når ruten på begge sider er det ATC har klarert.'),
       tt('AIRWAYS: LAT REV on the first point, VIA (airway) on the left, TO (end point) on the right.','AIRWAYS: LAT REV på første punkt, VIA (luftvei) til venstre, TO (sluttpunkt) til høyre.')],
  tasks:['disc','cstr'],drill:['awy','hold','cstr','dep','arr'],
  quiz:[{q:tt('You type ODRUP onto the F-PLN line of SELKA. What happens?','Du skriver ODRUP på F-PLN-linjen til SELKA. Hva skjer?'),a:[tt('A TMPY is created','En TMPY lages'),tt('ODRUP goes into the plan at that line; if ODRUP is further down, the points in between are removed','ODRUP går inn i planen på den linjen; ligger ODRUP lenger ned, fjernes punktene imellom'),tt('Nothing, it must be done via LAT REV','Ingenting, det må gjøres via LAT REV')],c:1,w:tt('Direct F-PLN entries go straight into the plan. A new waypoint brings a discontinuity after it.','Direkte F-PLN-endringer går rett inn i planen. Et nytt waypoint gir en diskontinuitet etter seg.')},
        {q:tt('“Cross ODRUP at or above FL110” is entered as …','«Cross ODRUP at or above FL110» legges inn som …'),a:[tt('FL110','FL110'),tt('+FL110','+FL110'),tt('-FL110','-FL110')],c:1,w:tt('+ is at or above, − at or below, no sign is “at”.','+ er at or above, − er at or below, uten fortegn er «at».')},
        {q:tt('What does the aircraft do at a F-PLN DISCONTINUITY in NAV?','Hva gjør flyet ved en F-PLN DISCONTINUITY i NAV?'),a:[tt('Flies direct to the next waypoint','Flyr direkte til neste waypoint'),tt('Keeps its heading; NAV is lost','Holder headingen; NAV forsvinner'),tt('Enters a hold','Går inn i holding')],c:1,w:tt('NAV reverts and the aircraft holds the current heading. LAT DISCONT AHEAD warns you in advance.','NAV faller ut og flyet holder headingen. LAT DISCONT AHEAD varsler på forhånd.')}]},
 {id:'m4',t:tt('Take-off performance','Take-off-ytelse'),s:tt('PERF TAKE OFF and runway changes','PERF TAKE OFF og rullebanebytte'),
  pts:[tt('PERF TAKE OFF: V1, VR and V2 on L1–L3, always V1 ≤ VR ≤ V2. Without V2 there is no SRS at take-off.','PERF TAKE OFF: V1, VR og V2 på L1–L3, alltid V1 ≤ VR ≤ V2. Uten V2 får du ikke SRS ved avgang.'),
       tt('FLAPS/THS on R3 (e.g. 1/UP0.4), FLEX on R4. THR RED/ACC default to 1500 ft above the runway.','FLAPS/THS på R3 (f.eks. 1/UP0.4), FLEX på R4. THR RED/ACC er som standard 1500 ft over rullebanen.'),
       tt('Runway change: CHECK TAKE OFF DATA. The speeds are invalidated and must be entered again, or confirmed only if they are valid for the new runway.','Rullebanebytte: CHECK TAKE OFF DATA. Hastighetene blir ugyldige og må legges inn på nytt, eller bekreftes bare hvis de gjelder for den nye rullebanen.'),
       tt('The FLEX and V-speeds come from the take-off data for that runway, never from memory.','FLEX og V-hastigheter kommer fra take-off-dataene for den rullebanen, aldri fra hukommelsen.')],
  tasks:['rwy'],drill:['v1','v2','ths','flex','thr','ta','copy'],
  quiz:[{q:tt('V1 142, VR 140, V2 146 is entered. What does the MCDU say?','V1 142, VR 140, V2 146 legges inn. Hva sier MCDU-en?'),a:[tt('Nothing','Ingenting'),tt('V1/VR/V2 DISAGREE','V1/VR/V2 DISAGREE'),tt('FORMAT ERROR','FORMAT ERROR')],c:1,w:tt('The rule is V1 ≤ VR ≤ V2.','Regelen er V1 ≤ VR ≤ V2.')},
        {q:tt('After a runway change the speeds are invalidated. When may you use CONFIRM TO DATA?','Etter rullebanebytte er hastighetene ugyldige. Når kan du bruke CONFIRM TO DATA?'),a:[tt('Always, it saves time','Alltid, det sparer tid'),tt('Only if the old speeds are valid for the new runway','Bare hvis de gamle hastighetene gjelder for den nye rullebanen'),tt('Never','Aldri')],c:1,w:tt('Speeds for the wrong runway are a known cause of tail strikes and overruns.','Hastigheter for feil rullebane er en kjent årsak til tail strikes og overruns.')}]},
 {id:'m5',t:tt('In flight','I lufta'),s:tt('Direct to, holding, constraints and navaids','Direct to, holding, restriksjoner og navaids'),
  pts:[tt('DIR, choose or type the waypoint, check, then DIR TO*. In NAV the TO waypoint is only changed with DIR.','DIR, velg eller skriv waypointet, sjekk, så DIR TO*. I NAV endres TO-waypointet bare med DIR.'),
       tt('RADIAL IN is the radial from the fix you fly inbound on: the opposite of the inbound course (ILS 25 → 070).','RADIAL IN er radialen fra fixet du flyr inn på: motsatt av innflygingskursen (ILS 25 → 070).'),
       tt('HOLD: LAT REV at the fix, HOLD, INB CRS and TURN, then INSERT. IMM EXIT* leaves the hold. LAST EXIT shows when fuel forces you out.','HOLD: LAT REV på fixet, HOLD, INB CRS og TURN, så INSERT. IMM EXIT* tar deg ut av holdingen. LAST EXIT viser når drivstoffet tvinger deg ut.'),
       tt('RAD NAV: auto-tuned navaids are small letters. Type an ident to hard-tune it (large letters) for raw data.','RAD NAV: autotunede navaids står med små bokstaver. Skriv en ident for å hard-tune (store bokstaver) for rådata.')],
  tasks:['dct','hold','nav','cstr'],drill:['hold','vor1','crs2','ils','cstr','brg','posm'],
  quiz:[{q:tt('Vectors for ILS 25. What RADIAL IN do you enter on the point on final?','Vektorer til ILS 25. Hvilken RADIAL IN legger du inn på punktet på finalen?'),a:[tt('250','250'),tt('070','070'),tt('160','160')],c:1,w:tt('The radial is measured from the fix: the inbound course 250 lies on radial 070.','Radialen måles fra fixet: innflygingskursen 250 ligger på radial 070.')},
        {q:tt('You are holding and ATC clears you on. What do you press?','Du er i holding, og ATC klarerer deg videre. Hva trykker du?'),a:[tt('IMM EXIT* on the F-PLN','IMM EXIT* på F-PLN'),tt('CLR on the hold','CLR på holdingen'),tt('HDG on the FCU','HDG på FCU-en')],c:0,w:tt('IMM EXIT leaves the hold and continues the flight plan.','IMM EXIT tar deg ut av holdingen og videre langs flyplanen.')},
        {q:tt('In NAV you try to clear the TO waypoint. What happens?','I NAV prøver du å slette TO-waypointet. Hva skjer?'),a:[tt('It is deleted','Det slettes'),tt('NOT ALLOWED IN NAV','NOT ALLOWED IN NAV'),tt('A TMPY is created','En TMPY lages')],c:1,w:tt('Use DIR TO to change where the aircraft is going.','Bruk DIR TO for å endre hvor flyet skal.')}]},
 {id:'m6',t:tt('Arrival and approach','Arrival og innflyging'),s:tt('ARRIVAL, PERF APPR and GO AROUND','ARRIVAL, PERF APPR og GO AROUND'),
  pts:[tt('Prepare in cruise from the ATIS: F-PLN, L6 (destination), ARRIVAL: approach, STAR, VIA, check the TMPY, INSERT.','Forbered i marsjhøyde etter ATIS: F-PLN, L6 (destinasjonen), ARRIVAL: innflyging, STAR, VIA, sjekk TMPY, INSERT.'),
       tt('Choose the VIA that joins the STAR to the approach, so no discontinuity is left between them.','Velg VIA-en som kobler STAR-en til innflygingen, så det ikke blir igjen en diskontinuitet mellom dem.'),
       tt('PERF APPR: QNH, TEMP, MAG WIND, minimum (BARO for CAT I and non-precision, RADIO for CAT II/III) and LDG CONF. VAPP is computed from the wind.','PERF APPR: QNH, TEMP, MAG WIND, minimum (BARO for CAT I og ikke-presisjon, RADIO for CAT II/III) og LDG CONF. VAPP beregnes ut fra vinden.'),
       tt('GO AROUND: THR RED/ACC (often 1000 ft above the aerodrome) and ENG OUT ACC. Do not activate the approach phase until it is time.','GO AROUND: THR RED/ACC (ofte 1000 ft over flyplassen) og ENG OUT ACC. Ikke aktiver approach-fasen før det er tid.'),
       tt('Watch the QNH field: a temperature typed there by mistake is accepted as inches of mercury.','Pass på QNH-feltet: en temperatur skrevet der ved en feil godtas som inches of mercury.')],
  tasks:['app','appr','ctr'],drill:['arr','qnh','baro','ldg','eoa','ils'],
  quiz:[{q:tt('CAT I ILS with DA 380 ft. Where does the minimum go?','CAT I ILS med DA 380 ft. Hvor skal minimum?'),a:[tt('BARO','BARO'),tt('RADIO','RADIO'),tt('Nowhere','Ingen steder')],c:0,w:tt('RADIO is for CAT II/III decision heights.','RADIO er for beslutningshøyder på CAT II/III.')},
        {q:tt('After choosing ILS25 and ODRUP2W, a discontinuity sits between SK260 and SK255. Most likely cause?','Etter ILS25 og ODRUP2W ligger det en diskontinuitet mellom SK260 og SK255. Mest sannsynlig årsak?'),a:[tt('Wrong runway','Feil rullebane'),tt('NO VIA was chosen instead of the VIA SK260','NO VIA ble valgt i stedet for VIA SK260'),tt('The STAR is closed','STAR-en er stengt')],c:1,w:tt('The VIA is the transition that joins the STAR to the approach.','VIA-en er overgangen som kobler STAR-en til innflygingen.')},
        {q:tt('Headwind 15 kt, VLS 131. What does the FMS add for VAPP?','Motvind 15 kt, VLS 131. Hva legger FMS-en til for VAPP?'),a:[tt('+15','+15'),tt('+5 (one third of the headwind, at least 5)','+5 (en tredjedel av motvinden, minst 5)'),tt('+0','+0')],c:1,w:tt('VAPP = VLS + 1/3 of the headwind, between +5 and +15.','VAPP = VLS + 1/3 av motvinden, mellom +5 og +15.')}]},
 {id:'m7',t:tt('When the plan changes','Når planen endres'),s:tt('SEC F-PLN in the air and diversion','SEC F-PLN i lufta og diversjon'),
  pts:[tt('Prepare the likely change in the SEC before it comes: other runway, other approach, diversion.','Forbered den sannsynlige endringen i SEC før den kommer: annen rullebane, annen innflyging, diversjon.'),
       tt('In flight *ACTIVATE SEC appears only in HDG, or when both plans have the same active leg. Select HDG first, activate, then DIR TO to get NAV back.','I lufta vises *ACTIVATE SEC bare i HDG, eller når begge planene har samme aktive leg. Velg HDG først, aktiver, og bruk så DIR TO for å få NAV tilbake.'),
       tt('Diversion: LAT REV at a waypoint, ENABLE ALTN, check the new destination in the TMPY, INSERT. Then the fuel: EFOB and EXTRA.','Diversjon: LAT REV på et waypoint, ENABLE ALTN, sjekk ny destinasjon i TMPY, INSERT. Så drivstoffet: EFOB og EXTRA.')],
  tasks:['secair','altn'],drill:['copy','hold','arr'],
  quiz:[{q:tt('You are in NAV and *ACTIVATE SEC is missing. Why?','Du er i NAV, og *ACTIVATE SEC mangler. Hvorfor?'),a:[tt('The SEC is empty','SEC er tom'),tt('In flight it shows only in HDG or with the same active leg','I lufta vises den bare i HDG eller med samme aktive leg'),tt('It is only for the ground','Den er bare for bakken')],c:1,w:tt('Select a heading first, then activate.','Velg heading først, og aktiver så.')},
        {q:tt('After ENABLE ALTN, what do you check first?','Hva sjekker du først etter ENABLE ALTN?'),a:[tt('The new destination and the fuel (EFOB, EXTRA)','Ny destinasjon og drivstoffet (EFOB, EXTRA)'),tt('The cost index','Cost index'),tt('The SID','SID-en')],c:0,w:tt('The diversion only works if the fuel does.','Diversjonen fungerer bare hvis drivstoffet gjør det.')}]}
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
  el('mdshow').onclick=()=>{ DRL.shown=true; drillNow(); const first=(typeof t.a==='string'?t.a:t.a.en).split(' · ')[0].replace('F-PLN','FPLN').replace('RAD NAV','RAD').replace('SEC F-PLN','SEC'); const b=document.querySelector(`#mcdu .k[data-k="${first}"]`); if(b) b.classList.add('hl'); };
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
   ['INIT','INIT A',tt('Before the route','Før ruten'),'R1 FROM/TO · L1 CO RTE · L2 ALTN · L3 FLT NBR · R3 IRS INIT · L5 COST INDEX · L6 CRZ FL/TEMP · R6 TROPO'],
   ['INIT →','INIT B',tt('Loadsheet','Loadsheet'),'R1 ZFW/ZFWCG · R2 BLOCK · R3 FUEL PLANNING · L1 TAXI · L2 TRIP · L3 RTE RSV · L4 ALTN · L5 FINAL · L6 MIN DEST FOB · R4 TOW/LW · R6 EXTRA'],
   ['F-PLN','F-PLN',tt('The route','Ruten'),tt('Left key: LAT REV · right key: VERT REV · L6: destination · ↑↓ scroll · AIRPORT jumps to the next airport','Venstre tast: LAT REV · høyre tast: VERT REV · L6: destinasjon · ↑↓ blar · AIRPORT hopper til neste flyplass')],
   [tt('F-PLN, left key','F-PLN, venstre tast'),'LAT REV',tt('Change the route','Endre ruten'),tt('L1 DEPARTURE (origin) · R1 ARRIVAL (destination) · L3 HOLD · R3 NEXT WPT · L4 ENABLE ALTN · R4 NEW DEST · R5 AIRWAYS · R1 FIX INFO (FROM)','L1 DEPARTURE (avgang) · R1 ARRIVAL (destinasjon) · L3 HOLD · R3 NEXT WPT · L4 ENABLE ALTN · R4 NEW DEST · R5 AIRWAYS · R1 FIX INFO (FROM)')],
   [tt('F-PLN, right key','F-PLN, høyre tast'),'VERT REV',tt('Constraints','Restriksjoner'),'L3 SPD CSTR · R3 ALT CSTR · L2 SPD LIM'],
   ['PERF','TAKE OFF',tt('Take-off','Avgang'),'L1 V1 · L2 VR · L3 V2 · L4 TRANS ALT · L5 THR RED/ACC · R1 RWY · R2 TO SHIFT · R3 FLAPS/THS · R4 FLEX · R5 ENG OUT ACC · R6 NEXT PHASE'],
   ['PERF ·R6','CLB · CRZ · DES',tt('En route','Underveis'),'L1 ACT MODE · L2 CI · L3 MANAGED · L4 PRESEL · R4 DES CABIN RATE (CRZ)'],
   ['PERF ·R6','APPR',tt('Approach','Innflyging'),'L1 QNH · L2 TEMP · L3 MAG WIND · L4 TRANS ALT · L5 VAPP · R2 BARO · R3 RADIO · R4 CONF3 · R5 FULL · L6 ACTIVATE APPR PHASE'],
   ['PERF ·R6','GO AROUND',tt('Missed approach','Missed approach'),'L5 THR RED/ACC · R5 ENG OUT ACC'],
   ['RAD NAV','RADIO NAV',tt('Navaids','Navaids'),'L1 VOR1 · R1 VOR2 · L2/R2 CRS · L3 ILS · L4 ILS CRS · L5 ADF1 · R5 ADF2'],
   ['DIR','DIR TO',tt('Direct','Direkte'),'L1 DIR TO · L2–L5 F-PLN WPTS · R4 RADIAL IN · R5 RADIAL OUT · R6 DIR TO* · L6 ERASE'],
   ['SEC F-PLN','SEC INDEX',tt('Secondary plan','Sekundærplan'),'L1 COPY ACTIVE · L2 SEC F-PLN · L3 DELETE SEC · L4 ACTIVATE SEC'],
   ['FUEL PRED','FUEL PRED',tt('Fuel after engine start','Drivstoff etter motorstart'),'L1 DEST · L2 ALTN · R3 ZFW/ZFWCG · R4 FOB · R5 GW/CG · R6 EXTRA'],
   ['PROG','PROG',tt('Progress','Fremdrift'),'L1 CRZ · M OPT · R1 REC MAX · L4/R4 BRG/DIST TO · L6 REQUIRED · R6 ESTIMATED'],
   ['DATA','DATA INDEX',tt('Status','Status'),'L1 POSITION MONITOR · L4 A/C STATUS · → DATA 2/2']
  ];
  const S2=x=>typeof x==='string'?x:Lx(x);
  r.innerHTML=`<table class="mreft"><thead><tr><th>${esc(Lx(tt('Key','Tast')))}</th><th>${esc(Lx(tt('Page','Side')))}</th><th>${esc(Lx(tt('For','Til')))}</th><th>${esc(Lx(tt('Line keys','Linjetaster')))}</th></tr></thead><tbody>${R.map(x=>`<tr><td><kbd>${esc(S2(x[0]))}</kbd></td><td><b>${esc(x[1])}</b></td><td>${esc(S2(x[2]))}</td><td>${esc(S2(x[3]))}</td></tr>`).join('')}</tbody></table>`;
}

window.MCDU={drill:startDrill,drillState:()=>DRL,course:COURSE,drillT:DRILL_T,progress:()=>stepIdx(),tick:(n,dt)=>{ for(let i=0;i<(n||1);i++) stepFlight(dt||0.8); refresh(); },fcu:(c,v)=>{ fcu(c,v); refresh(); },press:k=>{ key(k); },state:()=>S,load:loadScn,scn:SCN,mode:setMode,screen:()=>{ cls(); (PG[S.page]||PG.menu).draw(); if(S.page!=='fpln') scratch(); return scr.map(r=>r.map(c=>c.c==='§'?'#':c.c).join('')).join('\n'); }};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
