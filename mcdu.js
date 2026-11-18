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
  const d=totalDist(p); if(!(d>0)) return null;
  const trip=+(0.55+0.0058*d).toFixed(1), time=Math.round(14+d/7.2);
  const al=altnOf(); const ad=al&&P[al]&&P[p.to]?dist(P[p.to],P[al])*1.15:0;
  const altn=al?+(0.45+0.0065*ad).toFixed(1):0, atime=al?Math.round(8+ad/6):0;
  const fin=1.1, rsv=+(trip*0.05).toFixed(1);
  const r={trip,time,altn,atime,fin,rsv,dist:d,mdf:+(altn+fin).toFixed(1)};
  if(f.block!=null){ r.extra=+(f.block-f.taxi-trip-rsv-altn-fin).toFixed(1); r.efob=+(f.block-f.taxi-trip).toFixed(1); }
  if(f.zfw!=null&&f.block!=null){ r.tow=+(f.zfw+f.block-f.taxi).toFixed(1); r.lw=+(r.tow-trip).toFixed(1); }
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
PG.menu={draw(){ title('MCDU MENU'); prompt(1,'L','<FMGC','g'); lbl(1,'R','SELECT DESIRED SYSTEM'); prompt(2,'L','<ATSU'); prompt(3,'L','<AIDS'); prompt(4,'L','<CFDS'); putR(DR(1),'(REQ)','w',1); },
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
    const f=S.fb, F=fuel();
    title('INIT B'); putR(0,'←','w');
    lbl(1,'L','TAXI'); prompt(1,'L',f.taxi.toFixed(1),'c');
    lbl(1,'R','ZFW/ZFWCG'); prompt(1,'R',(f.zfw!=null?f.zfw.toFixed(1):box(4))+'/'+(f.cg!=null?f.cg.toFixed(1):box(4)),f.zfw!=null&&f.cg!=null?'c':'a');
    lbl(2,'L','TRIP /TIME'); prompt(2,'L',F&&f.block!=null?F.trip.toFixed(1)+'/'+hhmm(F.time):'---.-/----','g');
    lbl(2,'R','BLOCK'); prompt(2,'R',f.block!=null?f.block.toFixed(1):box(4),f.block!=null?'c':'a');
    lbl(3,'L','RTE RSV/%'); prompt(3,'L',F&&f.block!=null?F.rsv.toFixed(1)+'/5.0':'---.-/5.0',F&&f.block!=null?'g':'c');
    lbl(4,'L','ALTN /TIME'); prompt(4,'L',F&&f.block!=null&&altnOf()?F.altn.toFixed(1)+'/'+hhmm(F.atime):'---.-/----','g');
    lbl(4,'R','TOW/   LW'); prompt(4,'R',F&&F.tow!=null?F.tow.toFixed(1)+'/'+F.lw.toFixed(1):'---.-/---.-','g');
    lbl(5,'L','FINAL/TIME'); prompt(5,'L',F&&f.block!=null?F.fin.toFixed(1)+'/0030':'---.-/0030','c');
    lbl(5,'R','TRIP WIND'); prompt(5,'R','HD000','c');
    lbl(6,'L','MIN DEST FOB'); prompt(6,'L',F&&f.block!=null?F.mdf.toFixed(1):'---.-','g');
    lbl(6,'R','EXTRA/TIME'); prompt(6,'R',F&&F.extra!=null?F.extra.toFixed(1)+'/'+hhmm(F.extra/2.4*60):'---.-/----','g');
  },
  lsk(s,n){
    const v=S.sp, f=S.fb;
    if(S.clr){ msg('NOT ALLOWED'); return; }
    if(s==='R'&&n===1){ if(!v) return; const m=/^(\d{1,2}(?:\.\d)?)?(?:\/(\d{1,2}(?:\.\d)?))?$/.exec(v); if(!m||(!m[1]&&!m[2])){ msg('FORMAT ERROR'); return; } if(m[1]){ const z=+m[1]; if(z<35||z>64.3){ msg('ENTRY OUT OF RANGE'); return; } f.zfw=z; } if(m[2]){ const c=+m[2]; if(c<8||c>50){ msg('ENTRY OUT OF RANGE'); return; } f.cg=c; } take(); return; }
    if(s==='R'&&n===2){ if(!v) return; const b=ckNum(v,1,19,1); if(b==null) return; f.block=b; take(); return; }
    if(s==='L'&&n===1){ if(!v) return; const t=ckNum(v,0,9.9,1); if(t==null) return; f.taxi=t; take(); return; }
    if(v) msg('NOT ALLOWED');
  },
  slew(){ go('init'); }
};

/* ---------- F-PLN ---------- */
function fplnRows(view){
  const p=planFor(view), rows=[], fl=flyingPlan()&&view==='act';
  p.items.forEach((it,i)=>rows.push({it,i}));
  if(p.miss&&p.miss.length) p.miss.forEach(m=>rows.push({it:m,miss:1}));
  rows.push({end:'------END OF F-PLN------'});
  const al=p.altn||(view==='act'?S.init.altn:null);
  if(al&&destOf(p)&&destOf(p).id!==al){ rows.push({it:{k:'wpt',id:al==='XFJB'?'FJB':al,seg:'altn'},alt:1}); rows.push({it:{k:'dest',id:al,seg:'altn'},alt:1}); rows.push({end:'---END OF ALTN F-PLN---'}); }
  rows.push({end:'-----NO ALTN F-PLN------',hide:1});
  return rows.filter(r=>!r.hide);
}
function predict(view){
  /* cumulative distance and time for each item index */
  const p=planFor(view), fl=flyingPlan()&&view==='act';
  const out=[]; let prev=fl?S.pos:null, cum=0;
  p.items.forEach((it,i)=>{ const c=coord(it); if(fl&&i===0){ out[i]={d:0,t:null}; return; } if(c&&prev) cum+=dist(prev,c); if(c) prev=c; out[i]={d:cum}; });
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
      if(!(n===1&&S.off===0)){
        const prevRow=rows[S.off+n-2]; const prv=prevRow&&prevRow.it&&!prevRow.end?prevRow.it:null;
        const a=prv?coord(prv):null, b=coord(it);
        if(it.via) put(lr,0,String(it.via).slice(0,7),'w',1);
        if(it.rin!=null) put(lr,0,'IN'+p3(it.rin)+'°','w',1);
        if(a&&b&&prv.k!=='disc'){ put(lr,8,'C'+p3(brg(a,b))+'°','w',1); putR(lr,Math.round(dist(a,b))+'NM','w',1,6); }
      }
      /* time and spd/alt */
      const q=r.i!=null?pr[r.i]:null;
      if(q&&!(fl&&isFrom)){ const t=fl?hhmm(S.utc+q.d/7.2):hhmm(q.d?2+q.d/7:0); put(dr,8,t,tm?'y':'g'); }
      else if(fl&&isFrom){ put(dr,8,hhmm(S.utc-6),'w'); }
      let spd='---', altT;
      if(it.k==='apt'||it.k==='dest') altT=String(P[it.id].elev);
      else if(it.alt) altT=String(it.alt);
      else if(fl&&it.seg==='enr'&&S.init.crz){ altT='FL'+p3(S.init.crz); spd='.78'; }
      else altT='-----';
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
      if(r.end||r.miss||r.alt||!r.it||r.it.k!=='wpt'||r.it.id==='T-P'||(fl0&&r.i===0)){ if(S.sp||S.clr) msg('NOT ALLOWED'); return; }
      const it0=p0.items[r.i];
      if(S.clr){ S.clr=false; delete it0.alt; delete it0.spd; return; }
      if(S.sp){ const m=/^(\d{3})?\/(.*)$/.exec(S.sp); if(!m){ msg('FORMAT ERROR'); return; } let a=null; if(m[2]){ a=parseAlt(m[2]); if(!a){ msg('FORMAT ERROR'); return; } if(a==='RANGE'){ msg('ENTRY OUT OF RANGE'); return; } } if(!m[1]&&!a){ msg('FORMAT ERROR'); return; } if(m[1]){ const v=+m[1]; if(v<100||v>350){ msg('ENTRY OUT OF RANGE'); return; } it0.spd=v; } if(a) it0.alt=a; take(); return; }
      S.vr={view,i:r.i}; go('vrev'); return;
    }
    if(r.end||r.miss||r.alt){ if(S.sp||S.clr) msg('NOT ALLOWED'); return; }
    const p=planFor(view), it=r.it, i=r.i, fl=flyingPlan()&&view==='act';
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
PG.latrev={
  draw(){
    const L=S.lr, p=planFor(L.view), it=p.items[L.i]||{}, tm=S.tmpy&&S.tmpy.tgt===L.view;
    put(0,1,'LAT REV','w'); put(0,9,'FROM','w',1); put(0,14,(it.id||'')+(it.rwy&&it.k==='apt'?it.rwy:''),tm?'y':'g');
    if(it.k==='apt'){ prompt(1,'L','<DEPARTURE'); prompt(1,'R','FIX INFO>'); lbl(3,'R','NEXT WPT '); prompt(3,'R','[    ]','c'); lbl(4,'R','NEW DEST '); prompt(4,'R','[  ]','c'); }
    else if(it.k==='dest'){ prompt(1,'R','ARRIVAL>'); prompt(1,'L','<ALTN','w'); prompt(2,'R','FIX INFO>'); }
    else {
      prompt(1,'R','FIX INFO>'); prompt(2,'L','<OFFSET'); prompt(3,'L','<HOLD');
      if(flyingPlan()&&L.view==='act'&&(S.act.altn||S.init.altn)) prompt(4,'L','<ENABLE ALTN');
      lbl(3,'R','NEXT WPT '); prompt(3,'R','[    ]','c'); lbl(4,'R','NEW DEST '); prompt(4,'R','[  ]','c'); prompt(5,'R','AIRWAYS>');
    }
    if(tm){ prompt(6,'L','<TMPY F-PLN','y'); prompt(6,'R','INSERT*','a'); } else prompt(6,'L','<RETURN');
  },
  lsk(s,n){
    const L=S.lr, p=planFor(L.view), it=p.items[L.i]||{}, v=S.sp;
    if(n===6){ if(s==='L'){ go('fpln',{view:L.view}); return; } if(s==='R'&&S.tmpy&&S.tmpy.tgt===L.view){ insertTmpy(); go('fpln',{view:L.view}); return; } return; }
    if(it.k==='apt'&&s==='L'&&n===1){ if(v){ msg('NOT ALLOWED'); return; } S.dep={stage:'rwy',off:0}; go('dep'); return; }
    if(it.k==='dest'&&s==='R'&&n===1){ if(v){ msg('NOT ALLOWED'); return; } S.arr={stage:'app',off:0}; go('arr'); return; }
    if(it.k==='dest'&&s==='L'&&n===1){ msg('NOT AVAILABLE'); return; }
    if(s==='R'&&(n===1||n===2)&&!v){ msg('NOT AVAILABLE'); return; }
    if(it.k!=='apt'&&it.k!=='dest'){
      if(s==='L'&&n===2){ msg('NOT AVAILABLE'); return; }
      if(s==='L'&&n===3){ if(v){ msg('NOT ALLOWED'); return; } openHold(L.view,L.i,false); return; }
      if(s==='L'&&n===4&&flyingPlan()&&L.view==='act'){ const al=S.act.altn||S.init.altn; if(!al) return; const tp=startTmpy('act'); if(!tp) return; enableAltn(tp,L.i,al); go('fpln',{view:'act',off:0}); return; }
      if(s==='R'&&n===5){ if(v){ msg('NOT ALLOWED'); return; } S.awy={view:L.view,i:L.i,from:it.id,rows:[]}; go('awy'); return; }
    }
    if(s==='R'&&n===3&&it.k!=='dest'){ if(!v) return; if(!P[v]||P[v].t==='APT'){ msg('NOT IN DATA BASE'); return; } const tp=startTmpy(L.view); if(!tp) return; insertAt(tp,L.i+1,v); take(); go('fpln',{view:L.view}); return; }
    if(s==='R'&&n===4&&it.k!=='dest'){ if(!v) return; if(!AP[v]){ msg('NOT IN DATA BASE'); return; } const tp=startTmpy(L.view); if(!tp) return; tp.items=tp.items.slice(0,L.i+1).concat([{k:'disc',seg:'enr'},{k:'dest',id:v,seg:'d'}]); tp.to=v; tp.miss=[]; tp.appr=tp.star=tp.via=null; take(); go('fpln',{view:L.view}); return; }
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
    const view=S.lr.view, p=planFor(view), tm=S.tmpy&&S.tmpy.tgt===view, A=AP[p.from], D=S.dep;
    put(0,1,'DEPARTURES','w'); put(0,12,'FROM','w',1); put(0,17,p.from,'g'); putR(0,'→','w');
    lbl(1,'L',' RWY'); putC(LR(1),'SID','w',1); lbl(1,'R','TRANS ');
    prompt(1,'L',p.dRwy||'---',tm?'y':'g'); putC(DR(1),p.sid||(p.noSid?'NONE':'------'),tm?'y':'g'); prompt(1,'R',p.trans||'------',tm?'y':'g');
    const list=depList(p);
    lbl(3,'L',D.stage==='rwy'?'AVAILABLE RUNWAYS':D.stage==='sid'?'SIDS':'TRANS');
    if(D.stage==='sid') putR(LR(3),'AVAILABLE','w',1);
    list.slice(D.off,D.off+3).forEach((x,j)=>{ const n=3+j; prompt(n,'L','←'+x.t,'c'); if(x.r) put(DR(n),10,x.r,'c',1); });
    if(list.length>3) putR(LR(5),'↓↑','w');
    if(tm){ prompt(6,'L','<TMPY F-PLN','y'); prompt(6,'R','INSERT*','a'); } else prompt(6,'L','<RETURN');
  },
  lsk(s,n){
    const view=S.lr.view, D=S.dep;
    if(n===6){ if(s==='L'){ go('fpln',{view,off:0}); return; } if(s==='R'&&S.tmpy&&S.tmpy.tgt===view){ insertTmpy(); go('fpln',{view,off:0}); return; } return; }
    if(S.sp){ msg('NOT ALLOWED'); return; }
    if(n===1){ D.stage=s==='L'?'rwy':'sid'; D.off=0; return; }
    if(n>=3&&n<=5&&s==='L'){
      const p0=planFor(view), list=depList(p0), x=list[D.off+n-3]; if(!x) return;
      const tp=startTmpy(view); if(!tp) return;
      if(D.stage==='rwy'){ setDeparture(tp,x.v,null,null); tp.noSid=false; D.stage='sid'; D.off=0; }
      else if(D.stage==='sid'){ setDeparture(tp,tp.dRwy,x.v,null); tp.noSid=!x.v; D.stage='trans'; D.off=0; }
      else { tp.trans=x.v; }
    }
  },
  scroll(d){ const p=planFor(S.lr.view); S.dep.off=Math.max(0,Math.min(Math.max(0,depList(p).length-3),S.dep.off+d)); }
};
function depList(p){
  const A=AP[p.from], D=S.dep;
  if(D.stage==='rwy') return Object.keys(A.rwy).sort().map(r=>({t:r,v:r,r:A.rwy[r].len+'M '+p3(A.rwy[r].crs)+(A.rwy[r].ils?' '+A.rwy[r].ils:'')}));
  if(D.stage==='sid') return Object.keys(A.sid).filter(k=>A.sid[k].rwy===p.dRwy).sort().map(k=>({t:k,v:k})).concat([{t:'NO SID',v:null}]);
  return [{t:'NO TRANS',v:null}];
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
    lbl(2,'R','TRANS '); prompt(2,'R','------','w');
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
    lbl(4,'R','LAST EXIT'); put(DR(4),COLS-11,'UTC   FUEL','w',1); prompt(5,'R','----  ---.-','g');
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
      lbl(1,'L','ACT MODE'); prompt(1,'L','MANAGED','g');
      lbl(2,'L','CI'); prompt(2,'L',S.init.ci!=null?String(S.init.ci):'---','c');
      lbl(3,'L','MANAGED'); prompt(3,'L',ph==='CRZ'?'.78':ph==='DES'?'.78/290':'280/.78','g');
      if(ph==='CRZ'){ lbl(1,'R','CRZ'); prompt(1,'R',S.init.crz?'FL'+p3(S.init.crz):'-----','c'); lbl(2,'R','OPT   REC MAX'); prompt(2,'R','FL'+p3(Math.min(390,(S.init.crz||350)+10))+'  FL398','g'); }
      if(ph==='CRZ'){ lbl(5,'R','DES CABIN RATE'); prompt(5,'R','-350FT/MN','c'); }
    }
    else if(ph==='APPR'){
      const d=destOf(p), e=d?P[d.id].elev:0;
      lbl(1,'L','QNH'); prompt(1,'L',P_.qnh!=null?String(P_.qnh):box(4),P_.qnh!=null?'c':'a');
      lbl(2,'L','TEMP'); prompt(2,'L',P_.tmp!=null?P_.tmp+'°':'[ ]°','c');
      lbl(3,'L','MAG WIND'); prompt(3,'L',P_.wd!=null?p3(P_.wd)+'°/'+String(P_.ws).padStart(3,'0'):'[ ]°/[ ]','c');
      lbl(4,'L','TRANS ALT'); prompt(4,'L',d?String(AP[d.id].ta):'-----','c'); scr[DR(4)].forEach((x,i)=>{ if(i<6) x.s=1; });
      lbl(5,'L','VAPP'); prompt(5,'L',P_.ldg==='FULL'?'136':'141','c'); scr[DR(5)].forEach((x,i)=>{ if(i<4) x.s=1; });
      lbl(2,'R','BARO'); prompt(2,'R',P_.baro!=null?String(P_.baro):'[    ]','c');
      lbl(3,'R','RADIO'); prompt(3,'R',P_.radio!=null?String(P_.radio):'[    ]','c');
      lbl(4,'R','LDG CONF'); prompt(4,'R',P_.ldg==='3'?'CONF3':'*CONF3',P_.ldg==='3'?'c':'c'); prompt(5,'R',P_.ldg==='FULL'?'FULL':'*FULL','c');
      put(LR(1),11,'FINAL','w',1); put(DR(1),11,p.appr||'---','g');
      ['FLP','SLT','CLN','VLS'].forEach((t,i)=>{ put(DR(2+i),10,t+'='+[139,177,210,131][i],'g',1); });
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
    const ph=S.pp||actPhase(), P_=S.perf, v=S.sp;
    if(n===6&&s==='R'&&ph==='TO'&&P_.old&&S.phase==='PRE'){ ['v1','vr','v2'].forEach(k=>{ if(P_[k]==null) P_[k]=P_.old[k]; }); P_.old=null; return; }
    if(n===6&&s==='R'&&ph!=='GA'){ S.pp=PH[PH.indexOf(ph)+1]; P_.confirm=false; return; }
    if(n===6&&s==='L'){
      if(ph==='APPR'&&ph!==actPhase()){ if(!P_.confirm){ P_.confirm=true; return; } S.phase='APP'; P_.confirm=false; return; }
      if(PH.indexOf(ph)>0){ S.pp=PH[PH.indexOf(ph)-1]; return; } return;
    }
    if(S.clr){ if(ph==='TO'&&s==='L'&&n<=3){ P_[['v1','vr','v2'][n-1]]=null; take(); return; } if(ph==='APPR'&&s==='R'&&(n===2||n===3)){ P_[n===2?'baro':'radio']=null; take(); return; } msg('NOT ALLOWED'); return; }
    if(!v) { if(ph==='APPR'&&s==='R'&&(n===4||n===5)){ P_.ldg=n===4?'3':'FULL'; } return; }
    if(ph==='TO'){
      if(S.phase!=='PRE'){ msg('NOT ALLOWED'); return; }
      if(s==='L'&&n<=3){ const c=ckNum(v,90,180); if(c==null) return; P_[['v1','vr','v2'][n-1]]=c; take(); if(P_.old&&P_.v1!=null&&P_.vr!=null&&P_.v2!=null) P_.old=null; vcheck(); return; }
      if(s==='L'&&n===4){ const c=ckNum(v,1000,39000); if(c==null) return; P_.ta=Math.round(c/10)*10; take(); return; }
      if(s==='L'&&n===5){ const m=/^(\d{3,5})?(?:\/(\d{3,5}))?$/.exec(v); if(!m||(!m[1]&&!m[2])){ msg('FORMAT ERROR'); return; } if(m[1]) P_.thr=+m[1]; if(m[2]) P_.acc=+m[2]; if(P_.thr&&P_.acc&&P_.acc<P_.thr) P_.acc=P_.thr; take(); return; }
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
      if(s==='R'&&n===3){ const c=ckNum(v.replace('NO','0'),0,700); if(c==null) return; P_.radio=c; P_.baro=null; take(); return; }
    }
    if(ph==='GA'){
      if(s==='L'&&n===5){ const m=/^(\d{3,5})?(?:\/(\d{3,5}))?$/.exec(v); if(!m||(!m[1]&&!m[2])){ msg('FORMAT ERROR'); return; } if(m[1]) P_.gthr=+m[1]; if(m[2]) P_.gacc=+m[2]; take(); return; }
      if(s==='R'&&n===5){ const c=ckNum(v,500,39000); if(c==null) return; P_.geoa=c; take(); return; }
    }
    msg('NOT ALLOWED');
  }
};
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
    lbl(4,'L','CRS'); prompt(4,'L',R.ic!=null?p3(R.ic):(il?p3(ILS[il].crs):'[ ]'),'c'); if(R.ic==null&&il) scr[DR(4)].forEach((x,i)=>{ if(i<3) x.s=1; });
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
    if(n===3&&s==='L'){ let id=null; if(/^\d{3}\.\d{1,2}$/.test(v)){ const f=(+v).toFixed(2); id=Object.keys(ILS).find(k=>ILS[k].f===f); } else if(ILS[v]) id=v; if(!id){ msg('NOT IN DATA BASE'); return; } R.ils=id; R.ic=null; take(); return; }
    if(n===4&&s==='L'){ const c=ckNum(v,0,360); if(c==null) return; R.ic=c===0?360:c; take(); return; }
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
    if(s==='L'&&n===4&&canActSec()){ if(S.tmpy){ msg('TMPY F-PLN EXISTS',true); return; } const old=S.act; S.act=S.sec; S.sec=null; S.hz=null; afterActChange(old); go('fpln',{view:'act',off:0}); return; }
    if(s==='R'){ msg('NOT AVAILABLE'); return; }
  }
};

/* ---------- DATA ---------- */
PG.data={
  draw(){ title('DATA INDEX'); putR(0,'→','w');
    prompt(1,'L','<POSITION MONITOR'); prompt(2,'L','<IRS MONITOR'); prompt(3,'L','<GPS MONITOR'); prompt(4,'L','<A/C STATUS'); prompt(5,'L','<CLOSEST AIRPORTS'); prompt(6,'L','<EQUITIME POINT'); },
  lsk(s,n){ if(S.sp){ msg('NOT ALLOWED'); return; } if(s==='L'&&n===4){ go('acstat'); return; } if(s==='L'&&n===1){ go('posmon'); return; } msg('NOT AVAILABLE'); },
  slew(){ msg('NOT AVAILABLE'); }
};
PG.acstat={
  draw(){ const a=airac(); title('A320-200'); lbl(1,'L',' ENG'); prompt(1,'L','CFM56-5B4','g'); lbl(2,'L',' ACTIVE NAV DATA BASE'); prompt(2,'L',' '+a.act,'c'); putR(DR(2),a.id,'g'); lbl(3,'L',' SECOND NAV DATA BASE'); prompt(3,'L','<'+a.sec,'c'); lbl(5,'L','CHG CODE'); prompt(5,'L','[  ]','c'); lbl(6,'L','IDLE/PERF'); prompt(6,'L','+0.0/+0.0','g'); prompt(6,'R','STATUS/XLOAD>','w'); },
  lsk(s,n){ if(s==='L'&&n===3){ msg('NOT ALLOWED'); return; } if(S.sp) msg('NOT ALLOWED'); }
};
PG.posmon={
  draw(){ title('POSITION MONITOR'); const ll='6000.0N/01000.0E'; ['FMGC1','FMGC2','GPIRS','MIX IRS'].forEach((t,i)=>{ put(DR(1+i),0,t,'w'); putR(DR(1+i),ll,'g'); }); lbl(1,'R','3IRS/GPS'); put(DR(5),0,'IRS1 NAV IRS2 NAV IRS3 NAV','g',1); prompt(6,'L','<FREEZE'); prompt(6,'R','SEL NAVAIDS>'); },
  lsk(){ msg('NOT AVAILABLE'); }
};
/* ---------- PROG ---------- */
PG.prog={
  draw(){ const ph={PRE:'PREFLIGHT',CRZ:'CRZ',DES:'DES',APP:'APPR'}[S.phase]; put(0,1,ph,'g'); putR(0,S.init.flt||'','w',1,1);
    lbl(1,'L',' CRZ'); prompt(1,'L',S.init.crz?'FL'+p3(S.init.crz):'-----','c'); lbl(1,'R','OPT   REC MAX'); prompt(1,'R',S.init.crz?'FL'+p3(Math.min(390,S.init.crz+10))+'  FL398':'-----  -----','g');
    prompt(2,'L','<REPORT'); lbl(3,'L',' POSITION UPDATE AT'); prompt(3,'L','*[    ]','c'); lbl(4,'L','  BRG /DIST'); prompt(4,'L','---° /----.-','g'); put(DR(4),13,'TO','w',1); put(DR(4),16,'[    ]','c');
    prompt(5,'L','<PREDICTIVE'); put(DR(5)+1,0,'','w'); lbl(6,'L','REQUIRED ACCUR ESTIMATED'); prompt(6,'L','1.0NM','c'); putC(DR(6),'HIGH','g'); prompt(6,'R','0.08NM','g'); },
  lsk(){ msg('NOT AVAILABLE'); }
};
/* ---------- FUEL PRED ---------- */
PG.fuel={
  draw(){ const F=fuel(), p=S.act, d=destOf(p); title('FUEL PRED');
    lbl(1,'L','AT'); put(LR(1),8,'UTC','w',1); putR(LR(1),'EFOB','w',1);
    if(d){ prompt(1,'L',d.id+(d.rwy||''),'g'); put(DR(1),8,S.phase==='PRE'?'----':hhmm(S.utc+remainDist(p)/7.2),'g'); putR(DR(1),F&&F.efob!=null?F.efob.toFixed(1):'--.-','g'); }
    const al=p.altn||S.init.altn; if(al){ prompt(2,'L',al,'g'); putR(DR(2),F&&F.efob!=null?(F.efob-F.altn).toFixed(1):'--.-','g'); }
    lbl(3,'L','GW'); prompt(3,'L',F&&F.tow!=null?F.tow.toFixed(1):'---.-','g'); lbl(3,'R','FOB'); prompt(3,'R',S.fb.block!=null?(S.fb.block-S.fb.taxi).toFixed(1):'---.-','g');
    lbl(4,'L','RTE RSV/%'); prompt(4,'L',F&&S.fb.block!=null?F.rsv.toFixed(1)+'/5.0':'---.-/5.0','c');
    lbl(5,'L','FINAL/TIME'); prompt(5,'L','1.1/0030','c'); lbl(6,'L','MIN DEST FOB'); prompt(6,'L',F?F.mdf.toFixed(1):'---.-','c'); lbl(6,'R','EXTRA/TIME'); prompt(6,'R',F&&F.extra!=null?F.extra.toFixed(1)+'/'+hhmm(F.extra/2.4*60):'---.-/----','g'); },
  lsk(){ if(S.sp) msg('NOT ALLOWED'); }
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
  if(S.ap==='NAV'&&!S.hz&&t&&(isW(t)||t.k==='dest')){ const c=coord(t), lim=Math.max(0.8,d*1.5);
    const wrongSide=t.rin!=null&&Math.abs(w180(S.trk-(t.rin+180)))>60;
    if(dist(S.pos,c)<lim&&!wrongSide){ if(t.k==='dest'){ S.run=false; msg('DEST REACHED',false); return; }
      p.items.shift(); if(p.items[1]&&p.items[1].k==='hold'&&p.items[1].at===t.id) S.hz={st:'turn1'}; } }
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
function draw(){ cls(); const pg=PG[S.page]||PG.menu; pg.draw(); if(S.page!=='fpln') scratch(); return html(); }

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
  const a=coord(prev), b=coord(p.items[1]); S.pos={x:a.x+(b.x-a.x)*frac,y:a.y+(b.y-a.y)*frac};
  S.phase=phase||'CRZ'; S.alt=alt||35000; S.trk=brg(S.pos,b); S.hdg=Math.round(S.trk);
}
const tt=(en,no)=>({en,no});
const has=(p,id)=>p.items.some(x=>isW(x)&&x.id===id);
const noTmpy=()=>!S.tmpy;
const SCN=[
 {id:'prep',cat:'pre',
  t:tt('Cockpit preparation: set up the FMS','Cockpit preparation: sett opp FMS-en'),
  d:tt('The whole FMS preparation in the standard order D-I-F-R-I-P: DATA, INIT A, F-PLN, RAD NAV, INIT B and PERF.','Hele FMS-forberedelsen i standardrekkefølgen D-I-F-R-I-P: DATA, INIT A, F-PLN, RAD NAV, INIT B og PERF.'),
  setup(){},
  docs:['ofp','load','perf','clr'],
  steps:[
   {t:tt('DATA: open A/C STATUS and check that the active navigation database is current.','DATA: åpne A/C STATUS og sjekk at den aktive navigasjonsdatabasen er gyldig.'),keys:['DATA','L4'],ok:()=>!!S.seen.acstat},
   {t:tt('INIT A: enter FROM/TO XNDV/XSKH.','INIT A: legg inn FROM/TO XNDV/XSKH.'),keys:['INIT','R1'],type:'XNDV/XSKH',ok:()=>S.act.from==='XNDV'&&S.act.to==='XSKH'},
   {t:tt('ROUTE SELECTION shows the company route NDVSKH01. You build the route from the OFP yourself, so press RETURN (L6).','ROUTE SELECTION viser selskapsruten NDVSKH01. Du bygger ruten selv etter OFP-en, så trykk RETURN (L6).'),keys:['L6'],ok:()=>!!S.seen.rtesel&&S.page!=='rtesel'},
   {t:tt('Enter the alternate XFJB.','Legg inn alternativ flyplass XFJB.'),keys:['L2'],type:'XFJB',ok:()=>altnOf()==='XFJB'},
   {t:tt('Enter the flight number NDP101.','Legg inn flightnummeret NDP101.'),keys:['L3'],type:'NDP101',ok:()=>S.init.flt==='NDP101'},
   {t:tt('Enter cost index 30.','Legg inn cost index 30.'),keys:['L5'],type:'30',ok:()=>S.init.ci===30},
   {t:tt('Enter CRZ FL/TEMP: FL350, −54 °C.','Legg inn CRZ FL/TEMP: FL350, −54 °C.'),keys:['L6'],type:'350/-54',ok:()=>S.init.crz===350&&S.init.temp===-54},
   {t:tt('F-PLN: lateral revision at XNDV, DEPARTURE: runway 19, SID ROKUS1A, then INSERT.','F-PLN: lateral revisjon på XNDV, DEPARTURE: rullebane 19, SID ROKUS1A, så INSERT.'),keys:['FPLN','L1','L1','L4','L3','R6'],ok:()=>S.act.dRwy==='19'&&S.act.sid==='ROKUS1A'&&noTmpy()},
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
   {t:tt('Open the SEC F-PLN, lateral revision at XNDV, DEPARTURE: runway 01, ROKUS1B, then INSERT.','Åpne SEC F-PLN, lateral revisjon på XNDV, DEPARTURE: rullebane 01, ROKUS1B, så INSERT.'),keys:['L2','L1','L1','L3','L3','R6'],ok:()=>(S.sec&&S.sec.dRwy==='01'&&S.sec.sid==='ROKUS1B'&&noTmpy())||S.act.dRwy==='01'},
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
 {id:'free',cat:'free',
  t:tt('Free practice','Fri trening'),
  d:tt('An empty FMS on the ground at XNDV. Use the paperwork and set it up your own way, or try any page.','En tom FMS på bakken på XNDV. Bruk papirene og sett den opp på din måte, eller prøv hvilken som helst side.'),
  setup(){}, docs:['ofp','load','perf','clr'], steps:[]}
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
function drawNd(){ const n=el('mnd'); if(!n) return; n.innerHTML=ndSvg(); const r=el('mndr'); if(r) r.textContent=RANGES[NDR]+' NM'; drawFcu(); }
function drawFcu(){
  const b=el('mfcu'); if(!b) return; const air=S&&S.phase!=='PRE'; b.hidden=!air; if(!air) return;
  const run=el('mfrun'); run.textContent=S.run?'❚❚':'▶'; run.setAttribute('aria-label',S.run?Lx(tt('Pause','Pause')):Lx(tt('Fly','Fly'))); run.setAttribute('aria-pressed',S.run?'true':'false');
  el('mfnav').setAttribute('aria-pressed',S.ap==='NAV'?'true':'false'); el('mfhdgm').setAttribute('aria-pressed',S.ap==='HDG'?'true':'false');
  const h=el('mfhdg'); if(document.activeElement!==h) h.value=S.ap==='HDG'?p3(S.hdg):'---';
}
let TIMER=null;
function loop(){ if(TIMER) return; TIMER=setInterval(()=>{ if(!S||!S.run){ clearInterval(TIMER); TIMER=null; drawFcu(); return; } stepFlight(0.1*8); refresh(); },100); }
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
function key(k){ press(k); clearHl(); refresh(); }
function clearHl(){ document.querySelectorAll('#mcdu .k.hl').forEach(b=>b.classList.remove('hl')); }

let LATCH=[];
function stepIdx(){ if(!SC) return -1; for(let i=0;i<SC.steps.length;i++){ if(LATCH[i]) continue; if(SC.steps[i].ok()){ LATCH[i]=true; continue; } return i; } return SC.steps.length; }
const stepOk=i=>!!LATCH[i]||SC.steps[i].ok();
function refresh(){
  el('mscr').innerHTML=draw(); drawNd();
  if(!SC) return;
  const n=SC.steps.length, i=stepIdx();
  const now=el('mnow');
  if(MODE==='guided'&&n){
    if(i>=n){ now.innerHTML=`<b>${esc(Lx(tt('Done.','Ferdig.')))}</b> ${esc(Lx(tt('Every step is complete. Try the same task in Practice mode without the steps.','Alle stegene er gjort. Prøv samme oppgave i Øv-modus uten stegene.')))}`; now.className='mnow ok'; if(!DONE){ DONE=true; } }
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
  if(MODE==='practice'&&!CHECKED){ box.innerHTML=`<p class="note">${esc(Lx(tt('The steps are hidden in Practice. Do the task from the paperwork, then press “Check my setup”.','Stegene er skjult i Øv-modus. Gjør oppgaven etter papirene, og trykk «Sjekk oppsettet».')))}</p>`; return; }
  box.innerHTML='<ol class="msl">'+SC.steps.map((s,i)=>{ const ok=stepOk(i); const cl=MODE==='practice'?(ok?'ok':'no'):(i<cur?'ok':i===cur?'cur':''); return `<li class="${cl}">${esc(Lx(s.t))}</li>`; }).join('')+'</ol>';
}
function check(){ CHECKED=true; stepIdx(); const n=SC.steps.length, ok=SC.steps.filter((s,i)=>stepOk(i)).length; drawSteps(stepIdx()); const r=el('mres'); r.hidden=false; r.className='mres '+(ok===n?'ok':'part'); r.textContent=ok===n?Lx(tt(`All ${n} items correct.`,`Alle ${n} punktene er riktige.`)):Lx(tt(`${ok} of ${n} correct. The list shows what is missing.`,`${ok} av ${n} riktige. Listen viser hva som mangler.`)); }
function loadScn(id){
  if(S) S.run=false; SC=SCN.find(s=>s.id===id)||SCN[0]; S=blank(); SC.setup(); S.log=[]; S.seen={}; HINT=-1; LATCH=[]; NDC=null; NDR=S.phase==='PRE'?2:3;
  DONE=false; CHECKED=false; const r=el('mres'); if(r) r.hidden=true;
  const ph=el('mphase'); if(ph) ph.textContent=S.phase==='PRE'?Lx(tt('On stand, XNDV','På standplass, XNDV')):S.phase==='CRZ'?Lx(tt('Cruise FL350','Marsj FL350')):Lx(tt('Descent','Nedstigning'));
  el('mdocs').innerHTML=SC.docs.map(docHtml).join('');
  el('mtitle').textContent=Lx(SC.t);
  document.querySelectorAll('#mlist button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===SC.id?'true':'false'));
  try{ localStorage.setItem('mcdu-scn',SC.id); }catch(e){}
  refresh();
}
function buildList(){
  const box=el('mlist'); if(!box) return;
  const grp=[['pre',tt('On the ground','På bakken')],['fly',tt('In flight','I lufta')],['free',tt('Free','Fri')]];
  box.innerHTML=grp.map(([g,t])=>`<div class="mlg"><span>${esc(Lx(t))}</span>${SCN.filter(s=>s.cat===g).map(s=>`<button type="button" data-s="${s.id}" aria-pressed="false">${esc(Lx(s.t))}</button>`).join('')}</div>`).join('');
  box.onclick=e=>{ const b=e.target.closest('button[data-s]'); if(b){ loadScn(b.dataset.s); const a=el('mcdu'); if(a&&innerWidth<980) a.scrollIntoView({block:'nearest',behavior:'smooth'}); } };
}
function setMode(m){ MODE=m; CHECKED=false; const r=el('mres'); if(r) r.hidden=true; document.querySelectorAll('#mmode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===m?'true':'false')); clearHl(); refresh(); }
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
  if(LB()) LB().onLang(()=>{ buildList(); loadScnKeep(); });
}
function loadScnKeep(){ /* language change: redraw texts without resetting the state */ el('mdocs').innerHTML=SC.docs.map(docHtml).join(''); el('mtitle').textContent=Lx(SC.t); document.querySelectorAll('#mlist button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===SC.id?'true':'false')); refresh(); }

window.MCDU={progress:()=>stepIdx(),tick:(n,dt)=>{ for(let i=0;i<(n||1);i++) stepFlight(dt||0.8); refresh(); },fcu:(c,v)=>{ fcu(c,v); refresh(); },press:k=>{ key(k); },state:()=>S,load:loadScn,scn:SCN,mode:setMode,screen:()=>{ cls(); (PG[S.page]||PG.menu).draw(); if(S.page!=='fpln') scratch(); return scr.map(r=>r.map(c=>c.c==='§'?'#':c.c).join('')).join('\n'); }};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
