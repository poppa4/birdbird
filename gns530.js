/* NORDAP – GNS 530 trainer.
   A generic, simplified GPS/NAV/COM navigator of the GNS 530 kind, for learning the unit: the knobs and the cursor, COM and NAV
   tuning with 8.33 kHz channels, the flight plan, direct to, OBS and SUSP, procedures (departure, arrival, approach, vectors to
   final), the CDI key with GPS and VLOC, CDI scaling (ENR, TERM, APR/LPV), the nearest pages and the missed approach.
   Navigation data is fictional (training area around Nordvik, Skarhamn and Fjellby). Not for navigation.
   Coordinates are in NM on a flat plane (x east, y north); tracks are true = magnetic in the training area.
   The core runs without a DOM (tests/gns530.test.mjs); the page is built by init() when gns530.html loads it. */
(function(){
'use strict';
const G=typeof window!=='undefined'?window:globalThis;
const HASDOM=typeof document!=='undefined';
const LB=()=>G.LAB, Lx=o=>typeof o==='string'?o:(LB()?LB().L(o):o.en), isNo=()=>!!(LB()&&LB().lang==='no');
const tt=(en,no)=>({en,no});
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const R2=Math.PI/180;
const w360=a=>{ a=Math.round(a)%360; return a<=0?a+360:a; };
const w180=a=>{ a=((a+180)%360+360)%360; return a-180; };
const p3=n=>String(w360(n)).padStart(3,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* =========================================================== database */
const P={};
function pt(id,x,y,t,o){ P[id]=Object.assign({id,x,y,t},o||{}); return P[id]; }
const along=(p,b,d)=>({x:p.x+d*Math.sin(b*R2),y:p.y+d*Math.cos(b*R2)});
function ptA(id,p,b,d,t,o){ const q=along(p,b,d); return pt(id,q.x,q.y,t||'WPT',o); }
const dist=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const n360=a=>{ a=((a%360)+360)%360; return a===0?360:a; };
const brg=(a,b)=>n360(Math.atan2(b.x-a.x,b.y-a.y)/R2);

const APT={
  XNDV:{name:'NORDVIK',elev:56,x:0,y:0,rwy:{'01':{crs:10,len:3000,sfc:'HARD'},'19':{crs:190,len:3000,sfc:'HARD',ils:'INV'}},frq:[['ATIS','127.425'],['GROUND','121.805'],['TOWER','118.305'],['APPROACH','124.575']]},
  XSKH:{name:'SKARHAMN',elev:180,x:180,y:140,rwy:{'07':{crs:70,len:2500,sfc:'HARD',ils:'ISO'},'25':{crs:250,len:2500,sfc:'HARD',ils:'ISK'}},frq:[['ATIS','126.025'],['APPROACH','119.455'],['TOWER','118.710'],['GROUND','121.930']]},
  XFJB:{name:'FJELLBY',elev:410,x:215,y:90,rwy:{'16':{crs:160,len:2200,sfc:'HARD'},'34':{crs:340,len:2200,sfc:'HARD',ils:'IFJ'}},frq:[['ATIS','128.180'],['TOWER','120.130'],['GROUND','121.655']]},
  XBRK:{name:'BREKKA',elev:30,x:128,y:72,rwy:{'05':{crs:50,len:900,sfc:'HARD'},'23':{crs:230,len:900,sfc:'HARD'}},frq:[['AFIS','123.505']]},
  XVLD:{name:'VALDA',elev:520,x:160,y:112,rwy:{'14':{crs:140,len:1200,sfc:'HARD'},'32':{crs:320,len:1200,sfc:'HARD'}},frq:[['AFIS','122.880']]},
  XHLM:{name:'HOLMEN',elev:12,x:38,y:44,rwy:{'09':{crs:90,len:800,sfc:'GRASS'},'27':{crs:270,len:800,sfc:'GRASS'}},frq:[['RADIO','123.455']]}
};
for(const a in APT){ const A=APT[a]; pt(a,A.x,A.y,'APT',{name:A.name}); for(const r in A.rwy){ const R=A.rwy[r]; R.th=along(P[a],R.crs+180,R.len/1852/2); R.end=along(P[a],R.crs,R.len/1852/2); } }
const thr=(a,r)=>APT[a].rwy[r].th;
/* the runway as a waypoint of an approach (the missed approach point) */
for(const [a,r] of [['XSKH','25'],['XSKH','07'],['XFJB','34'],['XNDV','19']]){ const t=thr(a,r); pt('RW'+r,t.x,t.y,'RWY',{apt:a,name:a+' RWY '+r}); }

/* navaids */
pt('NDV',1.2,-0.4,'VOR',{f:'114.30',name:'NORDVIK'});
pt('HVL',90,72,'VOR',{f:'115.20',name:'HVALOY'});
pt('GRV',118,36,'VOR',{f:'113.90',name:'GRAVA'});
pt('SKH',181,141.6,'VOR',{f:'112.70',name:'SKARHAMN'});
pt('FJB',215.6,90.7,'VOR',{f:'116.90',name:'FJELLBY'});
const ILS={INV:{f:'109.50',apt:'XNDV',rwy:'19'},ISK:{f:'110.30',apt:'XSKH',rwy:'25'},ISO:{f:'109.70',apt:'XSKH',rwy:'07'},IFJ:{f:'108.90',apt:'XFJB',rwy:'34'}};
for(const k in ILS){ const L=ILS[k], R=APT[L.apt].rwy[L.rwy]; L.id=k; L.crs=R.crs; L.ant=along(R.end,R.crs,0.2); L.name=L.apt+' ILS '+L.rwy; }

/* waypoints */
ptA('NV190',thr('XNDV','19'),190,6); ptA('NV010',thr('XNDV','01'),10,6);
pt('TOSOK',16,-8,'WPT'); pt('ROKUS',40,20,'WPT'); pt('KRAKE',-14,10,'WPT'); pt('TINDA',10,46,'WPT');
pt('GAPOT',68,48,'WPT'); pt('KAVLO',52,62,'WPT'); pt('SELKA',124,98,'WPT'); pt('ODRUP',150,118,'WPT'); pt('BREMO',204,178,'WPT'); pt('TOLKA',166,152,'WPT'); pt('VIKSA',140,60,'WPT');
pt('SK260',198,156,'WPT'); pt('SK070',158,128,'WPT');
ptA('FI25',thr('XSKH','25'),70,6); ptA('FF25',thr('XSKH','25'),70,6); ptA('SK255',thr('XSKH','25'),70,11);
ptA('FI07',thr('XSKH','07'),250,6); ptA('SK075',thr('XSKH','07'),250,11);
ptA('FI34',thr('XFJB','34'),160,6); ptA('FJ340',thr('XFJB','34'),160,11);
ptA('FI19',thr('XNDV','19'),10,6);

/* procedures. Legs: [ident, role]; roles: iaf, if, faf, map, mahp (shown as suffixes on the flight plan, as on the unit) */
const PROC={
  XNDV:{dep:{ROKUS1A:{rwy:['19'],legs:['NV190','TOSOK','ROKUS']},TINDA1A:{rwy:['19'],legs:['NV190','KRAKE','TINDA']},ROKUS1B:{rwy:['01'],legs:['NV010','ROKUS']},TINDA1B:{rwy:['01'],legs:['NV010','TINDA']}},
        arr:{},app:{'ILS 19':{rwy:'19',ils:'INV',gps:false,trans:{VECTORS:[]},legs:[['FI19','faf'],['RW19','map']],miss:[['NDV','mahp']]}}},
  XSKH:{dep:{},
        arr:{ODRUP2W:{legs:['ODRUP','TOLKA','SK260']},BREMO1W:{legs:['BREMO','SK260']},ODRUP2E:{legs:['ODRUP','SK070']},BREMO1E:{legs:['BREMO','TOLKA','SK070']}},
        app:{'ILS 25':{rwy:'25',ils:'ISK',gps:false,trans:{VECTORS:[],SK260:[['SK260','iaf']]},legs:[['SK255','if'],['FI25','faf'],['RW25','map']],miss:[['SKH','mahp']]},
             'RNAV 25':{rwy:'25',ils:null,gps:true,lpv:true,trans:{VECTORS:[],SK260:[['SK260','iaf']]},legs:[['SK255','if'],['FF25','faf'],['RW25','map']],miss:[['SKH','mahp']]},
             'ILS 07':{rwy:'07',ils:'ISO',gps:false,trans:{VECTORS:[],SK070:[['SK070','iaf']]},legs:[['SK075','if'],['FI07','faf'],['RW07','map']],miss:[['SKH','mahp']]}}},
  XFJB:{dep:{},arr:{},app:{'ILS 34':{rwy:'34',ils:'IFJ',gps:false,trans:{VECTORS:[],FJ340:[]},legs:[['FJ340','if'],['FI34','faf'],['RW34','map']],miss:[['FJB','mahp']]}}}
};
/* the database idents a pilot can enter (runway points belong to procedures and are not entered by hand) */
const IDENTS=Object.keys(P).filter(k=>P[k].t!=='RWY').sort();
function complete(pre){ if(!pre) return null; return IDENTS.find(k=>k.startsWith(pre))||null; }
const llOf=q=>{ const lat=60+q.y/60, lon=10+q.x/30; const dm=(v,h,w)=>{ const d=Math.floor(Math.abs(v)), m=(Math.abs(v)-d)*60; return h+String(d).padStart(w,'0')+'°'+m.toFixed(2).padStart(5,'0')+"'"; }; return [dm(lat,'N',2),dm(lon,'E',3)]; };
const typeTxt=p=>({APT:'AIRPORT',VOR:'VOR',WPT:'INTERSECTION',RWY:'RUNWAY'})[p.t]||p.t;

/* =========================================================== radios: 8.33 kHz COM channels, 50 kHz NAV */
const ENDS=['000','005','010','015','025','030','035','040','050','055','060','065','075','080','085','090'];
function comStep(s,big,d){ let [M,k]=s.split('.'); M=+M; k=+k;
  if(big){ M+=d; if(M>136) M=118; if(M<118) M=136; return M+'.'+String(k).padStart(3,'0'); }
  const blk=Math.floor(k/100)*100, sub=k%100; /* the 16 channel names repeat every 100 kHz: x00 x05 x10 x15 x25 … x90 */
  let i=ENDS.map(e=>+e).indexOf(sub); if(i<0) i=0; let b=blk;
  i+=d; if(i>=ENDS.length){ i=0; b+=100; } if(i<0){ i=ENDS.length-1; b-=100; }
  if(b>900) b=0; if(b<0) b=900;
  return M+'.'+String(b+(+ENDS[i])).padStart(3,'0'); }
function navStep(s,big,d){ let [M,k]=s.split('.'); M=+M; k=+k;
  if(big){ M+=d; if(M>117) M=108; if(M<108) M=117; }
  else { k+=5*d; if(k>95) k=0; if(k<0) k=95; }
  return M+'.'+String(k).padStart(2,'0'); }
function stationOf(f){ for(const k in ILS) if(ILS[k].f===f) return Object.assign({loc:true},ILS[k]); for(const k in P) if(P[k].t==='VOR'&&P[k].f===f) return P[k]; return null; }
const MORSE={A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..'};

/* =========================================================== state */
let S=null;
const W=(id,o)=>Object.assign({id,seg:'enr',role:''},o||{});
function blank(){
  return {
    pos:{x:0,y:0}, trk:190, gs:0, air:false, run:false, ap:'NAV', hdg:190, alt:0,
    com:{act:'118.305',stby:'127.425'}, nav:{act:'114.30',stby:'109.50'}, tune:'COM', idOn:false,
    group:'NAV', pg:{NAV:0,WPT:0,NRST:0}, ovl:null, popup:null, crsr:{on:false,i:0}, ed:null,
    fpl:{wps:[],act:0,dep:null,arr:null,app:null}, legFrom:null, dto:null, obs:false, susp:false,
    cdi:'GPS', crs:190, rng:3, msgs:[], msgNew:false, wptId:'XSKH', rwyI:0, ncI:0, procI:0, dtoPg:null, psel:null, flash:null,
    log:[], seen:{}, setCrsWarned:null
  };
}
const fplIds=()=>S.fpl.wps.map(w=>w.id);
const has=id=>fplIds().includes(id);
const enrWps=()=>S.fpl.wps.filter(w=>w.seg==='enr');
function destApt(){ if(S.fpl.app) return S.fpl.app.apt; if(S.fpl.arr) return S.fpl.arr.apt; const e=enrWps(); for(let i=e.length-1;i>0;i--) if(P[e[i].id].t==='APT') return e[i].id; return null; }
function origApt(){ const w=S.fpl.wps[0]; return w&&P[w.id].t==='APT'?w.id:null; }
function msg(t){ /* a message for the MSG page; MSG flashes until it is read */ if(S.msgs.some(m=>m.t===t)) return; S.msgs.unshift({t}); S.msgNew=true; }
function unmsg(re){ S.msgs=S.msgs.filter(m=>!re.test(m.t)); if(!S.msgs.length) S.msgNew=false; }
function flashTxt(t){ S.flash={t,until:Date.now()+2600}; }

/* =========================================================== flight plan */
function rebuild(){ /* rebuild the plan from its enroute part and the loaded procedures, keeping the active waypoint */
  const actW=S.fpl.wps[S.fpl.act]; const actKey=actW?actW.id+'|'+actW.seg:null;
  const enr=enrWps(); let out=[];
  const dep=S.fpl.dep, arr=S.fpl.arr, app=S.fpl.app, dest=destApt();
  const o=enr[0]&&P[enr[0].id].t==='APT'?enr[0]:null;
  if(o) out.push(o);
  if(dep){ PROC[dep.apt].dep[dep.name].legs.forEach(id=>out.push(W(id,{seg:'dep'}))); }
  /* the destination airport closes the plan; with an approach loaded, the approach takes its place */
  enr.slice(o?1:0).forEach(w=>{ if(dest&&w.id===dest&&P[w.id].t==='APT') return; out.push(w); });
  if(arr){ PROC[arr.apt].arr[arr.name].legs.forEach(id=>out.push(W(id,{seg:'arr'}))); }
  if(!app&&dest&&(arr||enr.some((w,i)=>i>0&&w.id===dest))) out.push(W(dest));
  if(app){ const A=PROC[app.apt].app[app.name]; (A.trans[app.trans]||[]).forEach(l=>out.push(W(l[0],{seg:'app',role:l[1]}))); A.legs.forEach(l=>out.push(W(l[0],{seg:'app',role:l[1]}))); A.miss.forEach(l=>out.push(W(l[0],{seg:'miss',role:l[1]}))); }
  /* no two of the same in a row (an enroute fix that is also the first of the arrival, the end of the arrival and the IAF) */
  const t=[]; for(const w of out){ const l=t[t.length-1]; if(l&&l.id===w.id){ if(w.seg!=='enr') t[t.length-1]=Object.assign({},w,{role:w.role||l.role}); continue; } t.push(w); }
  S.fpl.wps=t;
  let ni=actKey?t.findIndex(w=>w.id+'|'+w.seg===actKey):-1; if(ni<0&&actW) ni=t.findIndex(w=>w.id===actW.id);
  S.fpl.act=ni>=0?ni:Math.min(S.fpl.act,Math.max(0,t.length-1));
}
function setPlan(ids,act){ S.fpl={wps:ids.map(id=>W(id)),act:act||0,dep:null,arr:null,app:null}; S.legFrom=null; S.dto=null; S.obs=false; S.susp=false; }
function insertWp(idx,id){ /* insert before index idx (idx = length: at the end) */
  const wps=S.fpl.wps; const ref=wps[idx]; const seg=ref?(ref.seg==='app'||ref.seg==='miss'?null:ref.seg):'enr';
  if(seg===null){ flashTxt('CANNOT EDIT APPROACH'); return false; }
  /* inserting into the procedures: it becomes part of the enroute plan only at the end of enroute */
  wps.splice(idx,0,W(id,{seg:seg==='dep'||seg==='arr'?seg:'enr'}));
  if(wps.length===1){ S.fpl.act=0; }
  else if(idx<=S.fpl.act){ if(idx===S.fpl.act){ /* the new waypoint becomes the active one */ } else S.fpl.act++; }
  if(S.fpl.act===0&&wps.length>1&&!S.air) S.fpl.act=1;
  S.legFrom=idx===S.fpl.act?null:S.legFrom;
  return true;
}
function removeWp(idx){ const w=S.fpl.wps[idx]; if(!w) return; if(w.seg==='app'||w.seg==='miss'){ flashTxt('CANNOT EDIT APPROACH'); return; }
  S.fpl.wps.splice(idx,1); if(idx<S.fpl.act) S.fpl.act--; else if(idx===S.fpl.act){ S.legFrom=null; } if(S.fpl.act>=S.fpl.wps.length) S.fpl.act=Math.max(0,S.fpl.wps.length-1); }
function activateLeg(idx){ if(idx<=0||idx>=S.fpl.wps.length) return; S.fpl.act=idx; S.legFrom=null; S.dto=null; S.obs=false; S.susp=false; }

/* =========================================================== procedures */
function procApt(kind){ if(kind==='dep') return origApt(); if(S.dto&&P[S.dto.id].t==='APT') return S.dto.id; return destApt()||(S.fpl.app&&S.fpl.app.apt)||null; }
function loadProc(kind,apt,name,trans,activate){
  if(!apt||!PROC[apt]) return;
  if(kind==='dep'){ S.fpl.dep={apt,name,rwy:trans}; rebuild(); if(!S.air){ S.fpl.act=Math.min(1,S.fpl.wps.length-1); S.legFrom=null; } return; }
  /* a procedure for another airport than the plan's destination: that airport becomes the destination */
  if(destApt()!==apt){ const old=destApt(); const keep=enrWps().filter((w,i)=>!(i>0&&w.id===old&&P[w.id].t==='APT'));
    S.fpl.arr=null; S.fpl.app=null; S.fpl.wps=keep.concat([W(apt)]); if(S.fpl.act>=S.fpl.wps.length) S.fpl.act=S.fpl.wps.length-1; }
  if(kind==='arr'){ S.fpl.arr={apt,name}; rebuild(); return; }
  S.fpl.app={apt,name,trans,active:false,vtf:false};
  const A=PROC[apt].app[name];
  if(A.ils){ S.nav.stby=ILS[A.ils].f; } /* the localizer frequency goes to NAV standby when an ILS is loaded */
  rebuild();
  if(S.dto&&S.dto.id===apt){ /* a direct to the airport stays active until an approach is activated */ }
  if(activate) activateAppr(trans==='VECTORS');
}
function activateAppr(vtf){
  const a=S.fpl.app; if(!a) return false; const A=PROC[a.apt].app[a.name];
  const i0=S.fpl.wps.findIndex(w=>w.seg==='app'); if(i0<0) return false;
  a.active=true; S.dto=null; S.obs=false; S.susp=false;
  if(vtf){ const fi=S.fpl.wps.findIndex(w=>w.role==='faf'); a.vtf=true; S.fpl.act=fi; const F=P[S.fpl.wps[fi].id], crs=APT[a.apt].rwy[A.rwy].crs; S.legFrom=along(F,crs+180,25); }
  else { a.vtf=false; S.fpl.act=i0; S.legFrom={x:S.pos.x,y:S.pos.y}; }
  return true;
}

/* =========================================================== navigation */
function target(){ if(S.dto) return P[S.dto.id]; const w=S.fpl.wps[S.fpl.act]; return w?P[w.id]:null; }
function legStart(){ if(S.dto) return S.dto.from; if(S.legFrom) return S.legFrom; const i=S.fpl.act; if(i>0&&S.fpl.wps[i-1]) return P[S.fpl.wps[i-1].id]; return S.pos; }
function nav(){
  const B=target(); if(!B) return null; const A=legStart();
  let dtk=S.obs?S.crs:(dist(A,B)<0.05?brg(S.pos,B):brg(A,B));
  const r=dtk*R2, ux=Math.sin(r), uy=Math.cos(r), dx=S.pos.x-B.x, dy=S.pos.y-B.y;
  const al=dx*ux+dy*uy, xtk=dx*uy-dy*ux;
  return {id:B.id,B,A,dtk:n360(dtk),xtk,along:al,dis:dist(S.pos,B),brg:brg(S.pos,B),to:al<0};
}
function cdiMode(){
  const a=S.fpl.app, w=S.fpl.wps[S.fpl.act];
  if(a&&a.active&&!S.dto&&w&&w.seg==='app'){ const A=PROC[a.apt].app[a.name]; const n=nav();
    if(A.gps&&(w.role==='map'||w.role==='faf'&&n&&n.dis<=2.05)) return A.lpv?'LPV':'APR'; }
  if(w&&!S.dto&&(w.seg!=='enr')) return 'TERM';
  for(const ap of [origApt(),destApt(),S.dto&&P[S.dto.id].t==='APT'?S.dto.id:null]) if(ap&&dist(S.pos,P[ap])<=30) return 'TERM';
  return 'ENR';
}
const SCALE={ENR:2,TERM:1,APR:0.3,LPV:0.3};
function gpsNeedle(){ const n=nav(); if(!n) return null; return {v:clamp(-n.xtk/SCALE[cdiMode()],-1.2,1.2),to:n.to}; }
function vloc(){
  const st=stationOf(S.nav.act); if(!st) return null;
  if(st.loc){ const d=dist(S.pos,st.ant), off=Math.abs(w180(brg(st.ant,S.pos)-(st.crs+180)));
    if(d>25||off>35) return {kind:'LOC',id:st.id,valid:false};
    const dev=w180(brg(S.pos,st.ant)-st.crs); return {kind:'LOC',id:st.id,valid:true,dev,v:clamp(dev/2.5,-1.2,1.2),to:true,crs:st.crs}; }
  if(dist(S.pos,st)>80) return {kind:'VOR',id:st.id,valid:false};
  const rad=brg(st,S.pos), dif=Math.abs(w180(rad-S.crs)), from=dif<90;
  const dev=from?w180(S.crs-rad):w180(w360(rad+180)-S.crs);
  return {kind:'VOR',id:st.id,valid:true,v:clamp(dev/10,-1.2,1.2),to:!from,rad,dev};
}
/* what the external CDI shows */
function cdiOut(){ if(S.cdi==='GPS'){ const g=gpsNeedle(); return g?{src:'GPS',valid:true,v:g.v,to:g.to}:{src:'GPS',valid:false}; } const v=vloc(); return v&&v.valid?{src:'VLOC',valid:true,v:v.v,to:v.to,kind:v.kind}:{src:'VLOC',valid:false}; }
function courseMsg(){ /* the unit tells you when the CDI's course pointer does not match the desired track */
  const n=nav(); const want=S.cdi==='GPS'&&n&&!S.obs?w360(n.dtk):(S.cdi==='VLOC'&&stationOf(S.nav.act)&&stationOf(S.nav.act).loc?stationOf(S.nav.act).crs:null);
  S.msgs=S.msgs.filter(m=>!/^Set course to/.test(m.t));
  if(want!=null&&Math.abs(w180(want-S.crs))>3) { if(S.setCrsWarned!==want){ S.setCrsWarned=want; S.msgNew=true; } S.msgs.unshift({t:'Set course to '+p3(want)+'°'}); }
  else S.setCrsWarned=null;
  if(!S.msgs.length) S.msgNew=false;
}
function sequence(){
  if(S.obs||S.susp||S.dto) return; const n=nav(); if(!n||!S.air) return;
  if(n.along>-0.4&&n.dis<3){ const w=S.fpl.wps[S.fpl.act];
    if(w&&w.role==='map'){ S.susp=true; return; }
    if(w&&w.role==='mahp'){ S.susp=true; return; }
    if(S.fpl.act<S.fpl.wps.length-1&&P[S.fpl.wps[S.fpl.act+1].id]){ S.fpl.act++; S.legFrom=null; } }
}
function stepFlight(dt){
  if(!S||!S.air) return;
  let want=S.trk;
  if(S.ap==='HDG') want=S.hdg;
  else if(S.cdi==='VLOC'){ const v=vloc(); if(v&&v.valid){ const base=v.kind==='LOC'?v.crs:S.crs; want=base+clamp(v.kind==='LOC'?v.dev*14:v.dev*3,-40,40); } }
  else { const n=nav(); if(n){ if(S.susp&&n.along>0.5&&(S.fpl.wps[S.fpl.act]||{}).role==='mahp') want=S.trk+20; else want=n.dtk+clamp(-n.xtk*30,-45,45); } }
  const d=w180(want-S.trk); S.trk=((S.trk+clamp(d,-3*dt,3*dt))%360+360)%360;
  const s=S.gs/3600*dt; S.pos=along(S.pos,S.trk,s);
  sequence(); courseMsg();
}

/* =========================================================== pages */
const GROUPS=['NAV','WPT','NRST'];
const PAGES={NAV:['navdef','map','navcom','pos'],WPT:['aptloc','aptrwy','aptfrq'],NRST:['nrstapt','nrstvor']};
const curPage=()=>S.ovl||PAGES[S.group][S.pg[S.group]];
function go(group,i){ S.group=group; S.pg[group]=i; S.ovl=null; S.crsr={on:false,i:0}; S.ed=null; S.popup=null; S.seen[curPage()]=1; }
function nrstApts(){ return Object.keys(APT).map(id=>({id,d:dist(S.pos,P[id]),b:brg(S.pos,P[id])})).sort((a,b)=>a.d-b.d); }
function nrstVors(){ return Object.keys(P).filter(k=>P[k].t==='VOR').map(id=>({id,d:dist(S.pos,P[id]),b:brg(S.pos,P[id])})).sort((a,b)=>a.d-b.d); }
function aptTypes(id){ const A=PROC[id]; if(!A) return 'VFR'; const n=Object.keys(A.app); if(!n.length) return 'VFR'; return n.some(x=>/^ILS/.test(x))?'ILS':'RNAV'; }
function navcomApts(){ const a=[origApt(),destApt()].filter(Boolean); const out=[]; a.forEach(x=>{ if(!out.includes(x)) out.push(x); }); if(!out.length) out.push('XNDV'); return out; }
function frqList(apt){ const A=APT[apt]; const l=A.frq.map(([n,f])=>({n,f,k:'COM'})); for(const r in A.rwy){ const L=A.rwy[r].ils; if(L) l.push({n:'ILS '+r+' '+L,f:ILS[L].f,k:'NAV'}); } return l; }

/* cursor items for each page: what the cursor can sit on, and what ENT and the small knob do there */
function items(pg){
  pg=pg||curPage();
  if(pg==='fpl'){ const l=S.fpl.wps.map((w,i)=>({k:'wp',i,id:w.id})); l.push({k:'blank',i:S.fpl.wps.length}); return l; }
  if(pg==='aptloc'||pg==='aptrwy'||pg==='aptfrq'){ const l=[{k:'ident'}]; if(pg==='aptrwy') l.push({k:'rwy'}); if(pg==='aptfrq') frqList(S.wptId).forEach(f=>l.push({k:'frq',f})); return l; }
  if(pg==='navcom'){ const l=[{k:'ncapt'}]; frqList(navcomApts()[S.ncI%navcomApts().length]).forEach(f=>l.push({k:'frq',f})); return l; }
  if(pg==='nrstapt') return nrstApts().slice(0,7).map(a=>({k:'apt',id:a.id}));
  if(pg==='nrstvor') return nrstVors().slice(0,6).flatMap(v=>[{k:'vor',id:v.id},{k:'frq',f:{n:v.id,f:P[v.id].f,k:'NAV'}}]);
  if(pg==='navdef'||pg==='map') return [];
  if(pg==='pos') return [];
  return [];
}
function procOpts(){ const a=S.fpl.app; const l=[];
  if(a&&PROC[a.apt].app[a.name].trans.VECTORS) l.push({k:'vtf',t:'Activate Vector-To-Final?'});
  if(a&&!a.active) l.push({k:'act',t:'Activate Approach?'});
  l.push({k:'app',t:'Select Approach?'},{k:'arr',t:'Select Arrival?'},{k:'dep',t:'Select Departure?'});
  return l; }

/* =========================================================== keys */
function startEdit(ctx,first,dir){ const cur=(first||'').padEnd(5,'_').slice(0,5).split(''); S.ed={c:cur,pos:0,ctx}; if(dir) charStep(dir); }
const CHARS='_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function charStep(d){ const e=S.ed; const i=CHARS.indexOf(e.c[e.pos]); e.c[e.pos]=CHARS[(i+d+CHARS.length)%CHARS.length]; for(let k=e.pos+1;k<5;k++) e.c[k]='_'; }
function edPre(){ const e=S.ed; return e.c.slice(0,e.pos+1).join('').replace(/_+$/,'').replace(/_/g,''); }
function edVal(){ const p=edPre(); return complete(p)||p; }
function edType(ch){ const e=S.ed; e.c[e.pos]=ch; for(let k=e.pos+1;k<5;k++) e.c[k]='_'; if(e.pos<4) e.pos++; }
function edCommit(){ const e=S.ed; const v=complete(edPre().replace(/_/g,''))||null; const pre=edPre();
  const id=pre&&P[pre]?pre:v; if(!id){ flashTxt('WAYPOINT NOT FOUND'); return; }
  S.ed=null; e.ctx.done(id); }
function prefillDto(){ /* the waypoint under the cursor, else the active waypoint */
  const pg=curPage(); if(S.crsr.on){ const it=items(pg)[S.crsr.i]; if(it&&(it.k==='wp'||it.k==='apt'||it.k==='vor')&&it.id) return it.id; if(it&&it.k==='ident') return S.wptId; }
  if(pg==='aptloc'||pg==='aptrwy'||pg==='aptfrq') return S.wptId;
  const t=target(); return t?t.id:''; }
function press(k){ press0(k); courseMsg(); }
function press0(k){
  S.log.push(k); if(S.log.length>200) S.log.shift();
  const pg=curPage();
  /* radios first: they work on every page */
  if(k==='LL+'||k==='LL-'||k==='LS+'||k==='LS-'){ const big=k[1]==='L', d=k[2]==='+'?1:-1; if(S.tune==='COM') S.com.stby=comStep(S.com.stby,big,d); else S.nav.stby=navStep(S.nav.stby,big,d); return; }
  if(k==='LPUSH'){ S.tune=S.tune==='COM'?'NAV':'COM'; return; }
  if(k==='CFF'){ const t=S.com.act; S.com.act=S.com.stby; S.com.stby=t; return; }
  if(k==='CFFL'){ S.com.act='121.500'; return; }
  if(k==='VFF'){ const t=S.nav.act; S.nav.act=S.nav.stby; S.nav.stby=t; S.idOn=false; return; }
  if(k==='ID'){ S.idOn=!S.idOn; return; }
  if(k==='CDI'){ S.cdi=S.cdi==='GPS'?'VLOC':'GPS'; return; }
  if(k==='OBS'){ if(S.susp){ S.susp=false; const w=S.fpl.wps[S.fpl.act]; if(w&&w.role==='map'&&S.fpl.act<S.fpl.wps.length-1){ S.fpl.act++; S.legFrom=null; } return; }
    if(S.obs){ S.obs=false; if(S.dto) S.dto.from={x:S.pos.x,y:S.pos.y}; else S.legFrom={x:S.pos.x,y:S.pos.y}; return; }
    if(target()){ S.obs=true; } return; }
  if(k==='RNGU'){ S.rng=Math.min(RANGES.length-1,S.rng+1); return; }
  if(k==='RNGD'){ S.rng=Math.max(0,S.rng-1); return; }
  if(k==='CLRL'){ S.popup=null; S.ed=null; S.ovl=null; S.psel=null; S.dtoPg=null; go('NAV',0); return; }
  /* popups (menus and questions) take the right knobs, ENT and CLR */
  if(S.popup){ const P_=S.popup;
    if(k==='RL+'||k==='RS+') P_.sel=Math.min(P_.items.length-1,P_.sel+1);
    else if(k==='RL-'||k==='RS-') P_.sel=Math.max(0,P_.sel-1);
    else if(k==='ENT'){ const it=P_.items[P_.sel]; S.popup=null; if(it&&it.go) it.go(); }
    else if(k==='CLR'||(k==='MENU'&&P_.menu)) S.popup=null;
    return; }
  if(S.ed){
    if(k==='RS+'||k==='RS-'){ charStep(k==='RS+'?1:-1); return; }
    if(k==='RL+'){ const e=S.ed; const v=complete(edPre()); if(e.pos<4){ if(e.c[e.pos]==='_'&&v) e.c[e.pos]=v[e.pos]||'_'; if(v&&e.c[e.pos+1]==='_') e.c[e.pos+1]=v[e.pos+1]||'_'; e.pos++; } return; }
    if(k==='RL-'){ if(S.ed.pos>0) S.ed.pos--; return; }
    if(k==='ENT'){ edCommit(); return; }
    if(k==='CLR'||k==='RPUSH'){ S.ed=null; return; }
    if(/^[A-Z0-9]$/.test(k)){ edType(k); return; }
  }
  if(/^[A-Z0-9]$/.test(k)){ /* typing starts an entry where the cursor sits on an ident */
    const it=S.crsr.on?items(pg)[S.crsr.i]:null;
    if(pg==='dto'){ startEdit(dtoCtx(),''); edType(k); return; }
    if(it&&(it.k==='wp'||it.k==='blank')){ startEdit(insCtx(it.i),''); edType(k); return; }
    if(it&&it.k==='ident'){ startEdit(wptCtx(),''); edType(k); return; }
    return; }
  if(k==='DTO'){ const id=prefillDto(); S.ovl='dto'; S.dtoPg={id,sel:'id'}; S.crsr={on:true,i:0}; S.ed=null; S.seen.dto=1; return; }
  if(k==='FPL'){ if(S.ovl==='fpl'){ S.ovl=null; S.crsr={on:false,i:0}; } else { S.ovl='fpl'; S.crsr={on:false,i:0}; S.seen.fpl=1; } S.ed=null; return; }
  if(k==='PROC'){ if(S.ovl==='proc'||S.ovl==='psel'){ S.ovl=null; S.psel=null; } else { S.ovl='proc'; S.procI=0; S.seen.proc=1; } S.ed=null; S.crsr={on:false,i:0}; return; }
  if(k==='MSG'){ if(S.ovl==='msg'){ S.ovl=null; } else { S.ovl='msg'; S.msgNew=false; S.seen.msg=1; } return; }
  if(k==='VNAV'){ S.ovl=S.ovl==='vnav'?null:'vnav'; if(S.ovl) S.seen.vnav=1; return; }
  if(k==='MENU'){ openMenu(pg); return; }
  if(pg==='msg'||pg==='vnav'){ if(k==='CLR'||k==='ENT') S.ovl=null; return; }
  if(pg==='proc'){ const o=procOpts();
    if(k==='RL+'||k==='RS+') S.procI=Math.min(o.length-1,S.procI+1); else if(k==='RL-'||k==='RS-') S.procI=Math.max(0,S.procI-1);
    else if(k==='CLR') S.ovl=null;
    else if(k==='ENT'){ const it=o[S.procI]; if(!it) return;
      if(it.k==='vtf'){ activateAppr(true); S.ovl=null; return; }
      if(it.k==='act'){ activateAppr(false); S.ovl=null; return; }
      const apt=procApt(it.k); if(!apt||!Object.keys(PROC[apt]&&PROC[apt][it.k]||{}).length){ flashTxt(it.k==='dep'?'NO DEPARTURES':it.k==='arr'?'NO ARRIVALS':'NO APPROACHES'); return; }
      S.psel={kind:it.k,apt,name:null,trans:null,stage:'name',sel:0,opt:0}; S.ovl='psel'; S.seen['psel-'+it.k]=1; }
    return; }
  if(pg==='psel'){ pselKey(k); return; }
  if(pg==='dto'){ const D=S.dtoPg;
    if(k==='RS+'||k==='RS-'){ if(D.sel==='id'){ startEdit(dtoCtx(),D.id,k==='RS+'?1:-1); } return; }
    if(k==='RL+'||k==='RL-'){ D.sel=D.sel==='id'?'act':'id'; return; }
    if(k==='ENT'){ if(D.sel==='id'){ if(P[D.id]) D.sel='act'; return; } doDto(D.id); return; }
    if(k==='CLR'){ S.ovl=null; S.dtoPg=null; S.crsr={on:false,i:0}; return; }
    if(k==='RPUSH'){ return; }
    return; }
  /* the cursor */
  const its=items(pg);
  if(k==='RPUSH'){ if(!its.length){ return; } S.crsr.on=!S.crsr.on; if(S.crsr.on){ S.crsr.i=pg==='fpl'?Math.min(S.fpl.act,its.length-1):pg==='nrstvor'?0:0; } S.seen['crsr-'+pg]=1; return; }
  if(S.crsr.on){ const it=its[S.crsr.i];
    if(k==='RL+'){ S.crsr.i=Math.min(its.length-1,S.crsr.i+1); return; }
    if(k==='RL-'){ S.crsr.i=Math.max(0,S.crsr.i-1); return; }
    if(k==='RS+'||k==='RS-'){ const d=k==='RS+'?1:-1;
      if(!it) return;
      if(it.k==='wp'||it.k==='blank'){ startEdit(insCtx(it.i),'',d); return; }
      if(it.k==='ident'){ startEdit(wptCtx(),S.wptId,d); return; }
      if(it.k==='rwy'){ const n=Object.keys(APT[S.wptId].rwy).length; S.rwyI=(S.rwyI+d+n)%n; return; }
      if(it.k==='ncapt'){ const n=navcomApts().length; S.ncI=(S.ncI+d+n)%n; return; }
      return; }
    if(k==='ENT'){ if(!it) return;
      if(it.k==='frq'){ if(it.f.k==='COM'){ S.com.stby=it.f.f; S.tune='COM'; } else { S.nav.stby=it.f.f; S.tune='NAV'; } flashTxt(it.f.f+' TO '+(it.f.k==='COM'?'COM':'NAV')+' STBY'); return; }
      return; }
    if(k==='CLR'){ if(it&&it.k==='wp'){ const w=S.fpl.wps[it.i]; S.popup={items:[{t:'Yes',go:()=>{ removeWp(it.i); S.crsr.i=Math.min(S.crsr.i,items('fpl').length-1); }},{t:'No'}],sel:0,q:'Remove '+w.id+'?'}; return; } S.crsr.on=false; return; }
    return; }
  if(k==='CLR'){ if(S.ovl){ S.ovl=null; } return; }
  if(S.ovl==='fpl') return;
  /* no cursor: the large knob chooses the page group, the small knob the page */
  if(k==='RL+'||k==='RL-'){ const g=(GROUPS.indexOf(S.group)+(k==='RL+'?1:-1)+GROUPS.length)%GROUPS.length; S.group=GROUPS[g]; S.ovl=null; S.seen[curPage()]=1; return; }
  if(k==='RS+'||k==='RS-'){ const n=PAGES[S.group].length; S.pg[S.group]=(S.pg[S.group]+(k==='RS+'?1:-1)+n)%n; S.seen[curPage()]=1; return; }
}
function insCtx(idx){ return {kind:'ins',idx,done:id=>{ if(insertWp(idx,id)){ S.crsr.i=Math.min(idx+1,items('fpl').length-1); } }}; }
function wptCtx(){ return {kind:'wpt',done:id=>{ if(P[id].t!=='APT'){ flashTxt('NOT AN AIRPORT'); return; } S.wptId=id; S.rwyI=0; }}; }
function dtoCtx(){ return {kind:'dto',done:id=>{ S.dtoPg.id=id; S.dtoPg.sel='act'; }}; }
function doDto(id){ if(!P[id]) return; const i=S.fpl.wps.findIndex((w,j)=>w.id===id&&j>=Math.min(S.fpl.act,S.fpl.wps.length-1));
  const j=i>=0?i:S.fpl.wps.findIndex(w=>w.id===id);
  S.obs=false; S.susp=false;
  if(j>0||(j===0&&S.fpl.wps.length===1)){ S.fpl.act=j; S.dto=null; S.legFrom={x:S.pos.x,y:S.pos.y}; S.directFpl=id; }
  else { S.dto={id,from:{x:S.pos.x,y:S.pos.y}}; S.directFpl=null; }
  if(P[id].t==='APT'){ S.wptId=id; S.rwyI=0; } S.ovl=null; S.dtoPg=null; S.crsr={on:false,i:0}; S.lastDto=id; S.group='NAV'; S.pg.NAV=S.pg.NAV===1?1:0; }
function directActive(){ return S.dto?S.dto.id:(S.legFrom&&S.lastDto&&target()&&target().id===S.lastDto?S.lastDto:null); }
function openMenu(pg){
  if(S.popup&&S.popup.menu){ S.popup=null; return; }
  let it;
  if(pg==='fpl'){ const c=S.crsr.on?items('fpl')[S.crsr.i]:null;
    it=[{t:'Activate Leg?',go:()=>{ if(c&&c.k==='wp') activateLeg(c.i); else flashTxt('SELECT A WAYPOINT'); }},
        {t:'Invert Flight Plan?',go:()=>{ const e=enrWps().slice().reverse(); setPlan(e.map(w=>w.id),S.air?Math.min(1,e.length-1):1); }},
        {t:'Delete Flight Plan?',go:()=>{ setPlan([],0); }}]; }
  else if(pg==='dto'){ it=[{t:'Cancel Direct-To NAV?',go:()=>{ S.dto=null; S.legFrom=null; S.ovl=null; S.dtoPg=null; S.lastDto=null; }}]; }
  else if(pg==='map'||pg==='navdef'){ it=[{t:'Restore Defaults?',go:()=>{ S.rng=3; }}]; }
  else it=[{t:'No options on this page',go:()=>{}}];
  S.popup={items:it,sel:0,menu:true,q:pg==='fpl'?'Flight Plan Menu':pg==='dto'?'Direct-To Menu':'Page Menu'}; S.seen['menu-'+pg]=1;
}
function pselKey(k){
  const Q=S.psel, D=PROC[Q.apt][Q.kind];
  const names=Object.keys(D).filter(n=>Q.kind!=='dep'||true);
  const list=Q.stage==='name'?names:Q.stage==='trans'?transOf(Q):[];
  if(k==='CLR'){ if(Q.stage==='name'){ S.ovl='proc'; S.psel=null; } else if(Q.stage==='trans'){ Q.stage='name'; Q.sel=Math.max(0,names.indexOf(Q.name)); } else { Q.stage=transOf(Q).length?'trans':'name'; Q.sel=0; } return; }
  if(Q.stage==='name'||Q.stage==='trans'){
    if(k==='RS+'||k==='RL+') Q.sel=Math.min(list.length-1,Q.sel+1);
    else if(k==='RS-'||k==='RL-') Q.sel=Math.max(0,Q.sel-1);
    else if(k==='ENT'){ if(Q.stage==='name'){ Q.name=list[Q.sel]; const tr=transOf(Q); if(tr.length){ Q.stage='trans'; Q.sel=0; } else { Q.trans=null; Q.stage='load'; Q.opt=0; } } else { Q.trans=list[Q.sel]; Q.stage='load'; Q.opt=0; } }
    return; }
  if(k==='RL+'||k==='RL-'||k==='RS+'||k==='RS-'){ if(Q.kind==='app') Q.opt=Q.opt?0:1; return; }
  if(k==='ENT'){ const act=Q.kind==='app'&&Q.opt===1; loadProc(Q.kind,Q.apt,Q.name,Q.trans,act); S.ovl=null; S.psel=null; S.crsr={on:false,i:0}; if(S.ovl===null){ S.group='NAV'; } return; }
}
function transOf(Q){ if(!Q.name) return []; const D=PROC[Q.apt][Q.kind][Q.name]; if(Q.kind==='dep') return D.rwy.map(r=>'RW'+r); if(Q.kind==='app') return Object.keys(D.trans); return []; }

/* =========================================================== drawing (SVG, 600 × 400) */
const RANGES=[1,2,5,10,20,50,100,200];
const VW=600, VH=400, LW=150, BAR=372;
let o=[];
const T=(x,y,s,c,sz,an,w)=>o.push(`<text x="${x}" y="${y}" class="${c||'w'}" font-size="${sz||18}"${an?` text-anchor="${an}"`:''}${w?` font-weight="${w}"`:''}>${esc(s)}</text>`);
const R=(x,y,w,h,c,extra)=>o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c}"${extra||''}/>`);
const Ln=(x1,y1,x2,y2,c,extra)=>o.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${c}"${extra||''}/>`);
const chW=sz=>sz*0.6;
function hl(x,y,s,sz,an,c){ /* a field under the cursor: dark text on cyan */ const w=String(s).length*chW(sz)+8, X=an==='end'?x-w+4:an==='middle'?x-w/2:x-4; R(X,y-sz*0.86,w,sz*1.12,'cur'); T(x,y,s,'inv',sz,an); }
function field(x,y,label,val,c,sz){ T(x,y,label,'lb',14); T(x,y+26,val,c||'g',sz||24); }
function freqCol(){
  R(0,0,LW,BAR,'bg2');
  const box=(y,on)=>{ if(on) R(4,y-21,LW-8,28,'tbox'); };
  T(8,20,'COM','lb',14); T(8,51,S.com.act,'g',28); box(82,S.tune==='COM'); T(10,82,S.com.stby,'w',24);
  T(8,116,'VLOC','lb',14); T(8,147,S.nav.act,'g',28); box(178,S.tune==='NAV'); T(10,178,S.nav.stby,'w',24);
  const v=stationOf(S.nav.act), r=v&&vloc();
  if(r&&r.valid){ T(LW-6,114,v.id||'','g',14,'end'); }
  Ln(6,192,LW-6,192,'rule');
  if(S.idOn&&r&&r.valid){ const id=v.id||''; T(8,214,'ID','lb',13); T(8,236,id,'g',18); T(8,256,id.split('').map(c=>MORSE[c]||'').join(' '),'g',13); }
  else if(r&&r.valid&&r.kind==='VOR'){ T(8,214,'RAD','lb',13); T(8,236,p3(r.rad)+'° '+(r.to?'TO':'FR'),'g',18); }
  /* the CDI source sits at the bottom of this column, above the CDI key */
  R(0,BAR,LW,VH-BAR,'bar'); T(LW/2,VH-8,S.cdi,'g',18,'middle',600);
}
function bar(){
  R(LW,BAR,VW-LW,VH-BAR,'bar');
  Ln(LW,BAR,VW,BAR,'rule');
  const m=cdiMode(); T(LW+40,VH-8,m,m==='ENR'?'w':'g',17,'middle',600);
  if(S.susp) T(LW+120,VH-8,'SUSP','y',17,'middle',600); else if(S.obs) T(LW+120,VH-8,'OBS','y',17,'middle',600);
  if(S.msgs.length||S.msgNew){ if(S.msgNew){ R(LW+168,BAR+3,52,VH-BAR-6,'msgon'); T(LW+194,VH-8,'MSG','inv',17,'middle',600); } else T(LW+194,VH-8,'MSG','w',17,'middle',600); }
  /* the page group and the page within it */
  const ov={fpl:'FPL',proc:'PROC',psel:'PROC',dto:'D→',msg:'MSG',vnav:'VNAV'}[S.ovl];
  if(ov){ T(VW-10,VH-8,ov,'c',17,'end',600); return; }
  const n=PAGES[S.group].length; T(VW-14-n*16,VH-8,S.group,'c',17,'end',600);
  for(let i=0;i<n;i++) R(VW-10-(n-i)*16+2,VH-20,11,11,i===S.pg[S.group]?'pgon':'pgoff');
}
function mapAt(x0,y0,w,h,rng,opts){
  const cx=x0+w/2, cy=y0+h/2, k=(h/2)/rng, sc=p=>({x:cx+(p.x-S.pos.x)*k,y:cy-(p.y-S.pos.y)*k});
  o.push(`<svg x="${x0}" y="${y0}" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}" overflow="hidden">`);
  R(x0,y0,w,h,'mapbg');
  /* the flight plan: white legs, the active leg magenta */
  const wps=S.fpl.wps; const n=nav();
  for(let i=1;i<wps.length;i++){ const a=sc(P[wps[i-1].id]), b=sc(P[wps[i].id]); if(wps[i].seg==='miss') Ln(a.x,a.y,b.x,b.y,'fplm'); else Ln(a.x,a.y,b.x,b.y,'fplw'); }
  if(n){ if(S.obs){ const a=sc(along(n.B,S.crs+180,40)), b=sc(along(n.B,S.crs,40)); Ln(a.x,a.y,b.x,b.y,'fpla'); }
    else { const a=sc(n.A), b=sc(n.B); Ln(a.x,a.y,b.x,b.y,'fpla'); } }
  /* the database around: VORs, airports, the plan's waypoints */
  const shown={};
  const lab=(p,c)=>{ const q=sc(p); if(q.x<x0-20||q.x>x0+w+20||q.y<y0-20||q.y>y0+h+20) return; T(q.x+8,q.y-7,p.id,c||'w',14); };
  for(const id in P){ const p=P[id]; if(p.t==='RWY') continue; const q=sc(p); if(q.x<x0-10||q.x>x0+w+10||q.y<y0-10||q.y>y0+h+10) continue;
    const inPlan=has(id)||(S.dto&&S.dto.id===id);
    if(p.t==='VOR'){ o.push(`<polygon points="${[0,60,120,180,240,300].map(a=>(q.x+6*Math.sin(a*R2)).toFixed(1)+','+(q.y-6*Math.cos(a*R2)).toFixed(1)).join(' ')}" class="vor"/>`); if(rng<=50||inPlan) lab(p,'c'); }
    else if(p.t==='APT'){ o.push(`<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="6" class="apt"/>`); for(const r in APT[id].rwy){ const R_=APT[id].rwy[r]; const a=sc(R_.th), b=sc(R_.end); Ln(a.x,a.y,b.x,b.y,'rwy'); break; } if(rng<=100||inPlan) lab(p,'w'); }
    else if(inPlan||rng<=20){ o.push(`<path d="M${q.x.toFixed(1)} ${(q.y-5).toFixed(1)}L${(q.x+5).toFixed(1)} ${q.y.toFixed(1)}L${q.x.toFixed(1)} ${(q.y+5).toFixed(1)}L${(q.x-5).toFixed(1)} ${q.y.toFixed(1)}Z" class="${inPlan?'wpt':'wpto'}"/>`); if(rng<=10||inPlan&&(rng<=20||n&&n.id===id)) lab(p,inPlan?'w':'dim'); }
    shown[id]=1; }
  if(n){ const b=sc(n.B); o.push(`<circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="9" class="tgt"/>`); }
  /* the aircraft: north up, the symbol turned to the track */
  o.push(`<g transform="translate(${cx} ${cy}) rotate(${S.trk})"><path d="M0 -12L3 -2L11 3L11 6L3 4L2 10L5 13L5 15L0 14L-5 15L-5 13L-2 10L-3 4L-11 6L-11 3L-3 -2Z" class="acft"/></g>`);
  T(x0+8,y0+h-10,rng+'nm','c',15);
  if(opts&&opts.north) T(x0+8,y0+20,'N↑','c',14);
  o.push('</svg>');
}
function cdiBar(x,y,w){ /* the CDI on the default NAV page: always the GPS course, five dots each side */
  const n=nav(); const g=gpsNeedle();
  const cx=x+w/2;
  for(let i=-5;i<=5;i++){ if(i===0) continue; o.push(`<circle cx="${cx+i*w/12}" cy="${y}" r="3.5" class="dot"/>`); }
  if(g){ const nx=cx+clamp(g.v,-1.1,1.1)*w*5/12; R(nx-3,y-17,6,34,'ndl'); o.push(`<path d="M${cx-9} ${y+(g.to?6:-6)}L${cx} ${y+(g.to?-8:8)}L${cx+9} ${y+(g.to?6:-6)}Z" class="flag"/>`); }
  else T(cx,y+6,'– – – – –','dim',16,'middle');
}
const ete=d=>{ if(!S.gs) return '__:__'; const m=d/S.gs*60; return String(Math.floor(m/60)).padStart(2,'0')+':'+String(Math.round(m%60)).padStart(2,'0'); };
const PGD={};
PGD.navdef=()=>{ const n=nav(), x=LW+12;
  T(LW+ (VW-LW)/2,24,n?(S.dto||directActive()?'D→ ':'')+n.id:'_____','m',20,'middle',600);
  cdiBar(LW+20,48,VW-LW-40);
  Ln(LW,74,VW,74,'rule');
  const f=[['DTK',n?p3(n.dtk)+'°':'___°'],['TRK',S.air?p3(S.trk)+'°':'___°'],['DIS',n?n.dis.toFixed(1)+'nm':'__._nm'],['GS',S.air?Math.round(S.gs)+'kt':'___kt'],['BRG',n?p3(n.brg)+'°':'___°'],['ETE',n?ete(n.dis):'__:__']];
  f.forEach((q,i)=>field(x+(i%2)*104,104+Math.floor(i/2)*84,q[0],q[1]));
  mapAt(LW+216,78,VW-LW-216,BAR-80,RANGES[Math.min(S.rng,4)],{north:1});
};
PGD.map=()=>{ mapAt(LW,0,VW-LW-124,BAR,RANGES[S.rng],{north:1}); const n=nav(); const x=VW-114; Ln(VW-124,0,VW-124,BAR,'rule');
  field(x,26,'DTK',n?p3(n.dtk)+'°':'___°','g',20); field(x,94,'DIS',n?n.dis.toFixed(1)+'nm':'__._nm','g',20); field(x,162,'ETE',n?ete(n.dis):'__:__','g',20); field(x,230,'GS',S.air?Math.round(S.gs)+'kt':'___kt','g',20); };
PGD.navcom=()=>{ const its=items('navcom'); const aps=navcomApts(), a=aps[S.ncI%aps.length];
  T(LW+12,26,'NAVCOM','c',15,null,600); T(VW-12,26,(S.ncI%aps.length===0&&aps.length>1?'DEPARTURE':aps.length>1?'ARRIVAL':'AIRPORT'),'lb',13,'end');
  const ci=S.crsr.on?S.crsr.i:-1; if(ci===0) hl(LW+12,58,a+'  '+APT[a].name,18); else T(LW+12,58,a+'  '+APT[a].name,'w',18);
  its.slice(1).forEach((it,i)=>{ const y=96+i*32; T(LW+12,y,it.f.n,'w',16); if(ci===i+1) hl(VW-14,y,it.f.f,18,'end'); else T(VW-14,y,it.f.f,'g',18,'end'); });
};
PGD.pos=()=>{ const ll=llOf(S.pos); T(LW+12,26,'POSITION','c',15,null,600);
  field(LW+12,56,'PRESENT POSN',ll[0],'g',22); T(LW+12,104,ll[1],'g',22);
  field(LW+12,140,'TRACK',S.air?p3(S.trk)+'°':'___°'); field(LW+190,140,'SPEED',S.air?Math.round(S.gs)+'kt':'___kt');
  const v=nrstVors()[0]; T(LW+12,226,'REF VOR','lb',13); T(LW+12,252,v.id,'c',20); T(LW+90,252,'RAD '+p3(brg(P[v.id],S.pos))+'°','g',20); T(LW+260,252,'DIS '+dist(P[v.id],S.pos).toFixed(1)+'nm','g',20);
};
function wptHdr(title){ const ci=S.crsr.on?S.crsr.i:-1; T(LW+12,26,title,'c',15,null,600);
  if(S.ed&&S.ed.ctx.kind==='wpt') edDraw(LW+12,58,20); else if(ci===0) hl(LW+12,58,S.wptId,20); else T(LW+12,58,S.wptId,'w',20);
  T(LW+100,58,APT[S.wptId].name,'w',18); Ln(LW,72,VW,72,'rule'); }
PGD.aptloc=()=>{ wptHdr('APT LOCATION'); const p=P[S.wptId], ll=llOf(p);
  field(LW+12,100,'POSITION',ll[0],'g',20); T(LW+12,146,ll[1],'g',20);
  field(LW+12,180,'ELEV',APT[S.wptId].elev+'ft','g',20); field(LW+180,180,'APPROACH',aptTypes(S.wptId),'g',20);
  field(LW+12,250,'BRG / DIS',p3(brg(S.pos,p))+'°  '+dist(S.pos,p).toFixed(1)+'nm','g',20); };
PGD.aptrwy=()=>{ wptHdr('APT RUNWAYS'); const rs=Object.keys(APT[S.wptId].rwy), r=rs[S.rwyI%rs.length], R_=APT[S.wptId].rwy[r];
  const ci=S.crsr.on?S.crsr.i:-1; T(LW+12,100,'RUNWAY','lb',13); const rt=r+'-'+rs.map(x=>x).filter(x=>x!==r)[0]; if(ci===1) hl(LW+12,126,rt,22); else T(LW+12,126,rt,'g',22);
  field(LW+12,160,'LENGTH',R_.len+' m','g',20); field(LW+180,160,'SURFACE',R_.sfc,'g',20);
  field(LW+12,226,'ILS',R_.ils?ILS[R_.ils].f+' '+R_.ils:'NONE','g',20);
  /* a small drawing of the runway */
  const x=VW-120, y=140, a=R_.crs*R2; Ln(x-46*Math.sin(a),y+46*Math.cos(a),x+46*Math.sin(a),y-46*Math.cos(a),'rwyb'); };
PGD.aptfrq=()=>{ wptHdr('APT FREQUENCIES'); const ci=S.crsr.on?S.crsr.i:-1;
  frqList(S.wptId).forEach((f,i)=>{ const y=104+i*32; T(LW+12,y,f.n,'w',16); if(ci===i+1) hl(VW-14,y,f.f,18,'end'); else T(VW-14,y,f.f,'g',18,'end'); }); };
PGD.nrstapt=()=>{ T(LW+12,26,'NEAREST AIRPORT','c',15,null,600); T(LW+250,26,'BRG','lb',12); T(LW+316,26,'DIS','lb',12); T(LW+376,26,'APR','lb',12);
  const ci=S.crsr.on?S.crsr.i:-1;
  nrstApts().slice(0,7).forEach((a,i)=>{ const y=58+i*44; if(ci===i) hl(LW+12,y,a.id,20); else T(LW+12,y,a.id,'c',20); T(LW+88,y,APT[a.id].name,'w',13);
    T(LW+250,y,p3(a.b)+'°','g',17); T(LW+316,y,a.d.toFixed(1),'g',17); T(LW+376,y,aptTypes(a.id),'g',15);
    const rw=Object.values(APT[a.id].rwy)[0]; T(LW+88,y+18,'RWY '+rw.len+' m '+(rw.sfc==='GRASS'?'GRASS':'HARD'),'dim',12); }); };
PGD.nrstvor=()=>{ T(LW+12,26,'NEAREST VOR','c',15,null,600); T(LW+200,26,'FREQ','lb',12); T(LW+300,26,'BRG','lb',12); T(LW+372,26,'DIS','lb',12);
  const ci=S.crsr.on?S.crsr.i:-1;
  nrstVors().slice(0,6).forEach((v,i)=>{ const y=60+i*48; if(ci===2*i) hl(LW+12,y,v.id,20); else T(LW+12,y,v.id,'c',20); T(LW+70,y,P[v.id].name,'w',12);
    if(ci===2*i+1) hl(LW+200,y,P[v.id].f,18); else T(LW+200,y,P[v.id].f,'g',18); T(LW+300,y,p3(v.b)+'°','g',17); T(LW+372,y,v.d.toFixed(1),'g',17); }); };
const ROLE={iaf:'iaf',if:'',faf:'faf',map:'map',mahp:'mahp'};
PGD.fpl=()=>{ const wps=S.fpl.wps; const its=items('fpl'); const ci=S.crsr.on?S.crsr.i:-1;
  T(LW+12,24,'ACTIVE FLIGHT PLAN','c',15,null,600);
  const o_=wps[0]?wps[0].id:'', d=destApt()||(S.fpl.app&&S.fpl.app.apt)||''; T(VW-12,24,(o_&&d&&o_!==d?o_+' / '+d:''),'w',15,'end');
  T(LW+250,48,'DTK','lb',12); T(LW+350,48,'DIS','lb',12); Ln(LW,54,VW,54,'rule');
  /* rows: section headers for the procedures, then the waypoints */
  const rows=[]; let last='';
  wps.forEach((w,i)=>{ const sec=w.seg==='dep'&&S.fpl.dep?'DEPARTURE '+S.fpl.dep.name:w.seg==='arr'&&S.fpl.arr?'ARRIVAL '+S.fpl.arr.name:(w.seg==='app'||w.seg==='miss')&&S.fpl.app?'APPROACH '+S.fpl.app.name+' '+S.fpl.app.apt:''; if(sec&&sec!==last) rows.push({h:sec}); if(!sec&&last&&w.seg==='enr') rows.push({h:'ENROUTE'}); last=sec; rows.push({w,i}); });
  rows.push({w:null,i:wps.length});
  const RH=30, max=Math.floor((BAR-66)/RH);
  const focus=ci>=0?its[ci].i:S.fpl.act; let fr=rows.findIndex(r=>r.w!==undefined&&r.i===focus); let start=Math.max(0,Math.min(fr-Math.floor(max/2),rows.length-max));
  rows.slice(start,start+max).forEach((r,k)=>{ const y=80+k*RH;
    if(r.h){ T(LW+12,y,r.h,'lb',13); return; }
    const w=r.w, i=r.i, isAct=w&&!S.dto&&i===S.fpl.act&&S.air!==undefined&&(S.air||i>0);
    const sel=ci>=0&&its[ci].i===i;
    if(!w){ if(sel){ if(S.ed&&S.ed.ctx.kind==='ins'&&S.ed.ctx.idx===i) edDraw(LW+34,y,19); else hl(LW+34,y,'_____',19); } else T(LW+34,y,'_____','dim',19); return; }
    const name=w.id+(ROLE[w.role]?' '+ROLE[w.role]:'');
    if(S.ed&&S.ed.ctx.kind==='ins'&&S.ed.ctx.idx===i){ edDraw(LW+34,y,19); T(LW+34,y+RH,'','w',1); }
    else if(sel) hl(LW+34,y,name,19); else T(LW+34,y,name,isAct?'m':'w',19);
    if(isAct) T(LW+12,y,'➔','m',18);
    const prev=i>0?P[wps[i-1].id]:null;
    if(prev){ T(LW+250,y,p3(brg(prev,P[w.id]))+'°',isAct?'m':'g',17); T(LW+350,y,dist(prev,P[w.id]).toFixed(1)+'nm',isAct?'m':'g',17); }
  });
};
PGD.dto=()=>{ const D=S.dtoPg; T(LW+12,26,'DIRECT TO','c',15,null,600); Ln(LW,38,VW,38,'rule');
  T(LW+12,72,'WPT','lb',13);
  if(S.ed&&S.ed.ctx.kind==='dto') edDraw(LW+60,74,26); else if(D.sel==='id') hl(LW+60,74,D.id||'_____',26); else T(LW+60,74,D.id||'_____','c',26);
  const p=P[D.id];
  if(p){ if(p.name) T(LW+12,110,p.name,'w',17); T(p.name?VW-12:LW+12,110,typeTxt(p),'lb',13,p.name?'end':null); const ll=llOf(p); T(LW+12,150,ll[0],'g',18); T(LW+12,176,ll[1],'g',18);
    T(LW+12,226,'BRG '+p3(brg(S.pos,p))+'°','g',18); T(LW+200,226,'DIS '+dist(S.pos,p).toFixed(1)+'nm','g',18);
    if(has(D.id)) T(LW+12,260,'IN THE FLIGHT PLAN','dim',13); }
  if(D.sel==='act') hl(VW-20,330,'Activate?',20,'end'); else T(VW-20,330,'Activate?','w',20,'end'); };
PGD.proc=()=>{ T(LW+12,26,'PROCEDURES','c',15,null,600); Ln(LW,38,VW,38,'rule'); const a=S.fpl.app;
  if(a) T(LW+12,66,'APR '+a.apt+' '+a.name+(a.trans&&a.trans!=='VECTORS'?' '+a.trans:a.trans==='VECTORS'?' VECTORS':'')+(a.active?(a.vtf?' (VTF)':' (ACTIVE)'):''),'g',15);
  procOpts().forEach((it,i)=>{ const y=110+i*44; if(i===S.procI) hl(LW+40,y,it.t,19); else T(LW+40,y,it.t,'w',19); }); };
PGD.psel=()=>{ const Q=S.psel; const K={app:'APPROACH',arr:'ARRIVAL',dep:'DEPARTURE'}[Q.kind];
  T(LW+12,26,'SELECT '+K,'c',15,null,600); Ln(LW,38,VW,38,'rule');
  T(LW+12,70,'APT','lb',13); T(LW+70,70,Q.apt,'w',18); T(LW+140,70,APT[Q.apt].name,'w',14);
  T(LW+12,110,Q.kind==='app'?'IAP':Q.kind==='arr'?'STAR':'SID','lb',13); T(LW+70,110,Q.name||'______',Q.stage==='name'?'dim':'g',18);
  const tr=Q.name?transOf(Q):[];
  if(Q.kind!=='arr'){ T(LW+12,150,Q.kind==='dep'?'RWY':'TRANS','lb',13); T(LW+70,150,Q.trans||(tr.length?'______':''),Q.stage==='trans'?'dim':'g',18); }
  if(Q.kind==='app'&&Q.name){ const A=PROC[Q.apt].app[Q.name]; if(!A.gps) T(LW+12,188,'NOT APPROVED FOR GPS','y',14); else if(A.lpv) T(LW+12,188,'LPV','g',14); }
  if(Q.stage==='name'||Q.stage==='trans'){ const list=Q.stage==='name'?Object.keys(PROC[Q.apt][Q.kind]):tr; const x=LW+250, y0=Q.stage==='name'?96:136;
    R(x-8,y0-20,VW-x-4,list.length*30+14,'popbox'); list.forEach((n,i)=>{ const y=y0+6+i*30; if(i===Q.sel) hl(x,y,n,18); else T(x,y,n,'w',18); }); }
  if(Q.stage==='load'){ if(Q.opt===0) hl(LW+40,330,'Load?',20); else T(LW+40,330,'Load?','w',20); if(Q.kind==='app'){ if(Q.opt===1) hl(LW+200,330,'Activate?',20); else T(LW+200,330,'Activate?','w',20); } }
};
PGD.msg=()=>{ T(LW+12,26,'MESSAGES','c',15,null,600); Ln(LW,38,VW,38,'rule');
  if(!S.msgs.length) T(LW+12,74,'No messages','dim',18);
  S.msgs.slice(0,8).forEach((m,i)=>T(LW+12,74+i*36,m.t,'w',18)); };
PGD.vnav=()=>{ T(LW+12,26,'VERTICAL NAVIGATION','c',15,null,600); Ln(LW,38,VW,38,'rule'); T(LW+12,80,'Not part of this trainer.','dim',16); T(LW+12,108,'Press VNAV again or CLR.','dim',16); };
function edDraw(x,y,sz){ const e=S.ed; const v=complete(edPre()); const show=e.c.map((c,i)=>i<e.pos||c!=='_'&&i===e.pos?c:(v&&v[i]?v[i]:'_'));
  show.forEach((c,i)=>{ const X=x+i*chW(sz); if(i===e.pos){ R(X-1,y-sz*0.86,chW(sz)+2,sz*1.12,'cur'); T(X,y,c,'inv',sz); } else T(X,y,c,i<e.pos?'c':'dim',sz); });
  if(v&&P[v]) T(x+5*chW(sz)+10,y,(P[v].name||typeTxt(P[v])).slice(0,16),'dim',Math.min(14,sz)); }
function popup(){ const Q=S.popup; if(!Q) return; const w=330, h=Q.items.length*34+(Q.q?44:16), x=LW+(VW-LW-w)/2, y=(BAR-h)/2;
  R(x,y,w,h,'popbox'); let yy=y+30; if(Q.q){ T(x+14,yy,Q.q,'c',15,null,600); yy+=34; }
  Q.items.forEach((it,i)=>{ if(i===Q.sel) hl(x+20,yy,it.t,18); else T(x+20,yy,it.t,'w',18); yy+=34; }); }
function draw(){
  o=[]; o.push(`<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" class="gscr" role="img" aria-label="GNS display">`);
  R(0,0,VW,VH,'bg'); freqCol(); Ln(LW,0,LW,BAR,'rule');
  const pg=curPage(); (PGD[pg]||PGD.navdef)();
  popup();
  if(S.flash&&Date.now()<S.flash.until){ const w=S.flash.t.length*10+30; R(LW+(VW-LW-w)/2,BAR-46,w,32,'popbox'); T(LW+(VW-LW)/2,BAR-24,S.flash.t,'y',16,'middle'); }
  bar();
  o.push('</svg>'); return o.join('');
}

/* =========================================================== scenarios */
function ground(){ S.air=false; S.gs=0; S.pos={x:P.XNDV.x+0.3,y:P.XNDV.y+0.2}; S.trk=190; }
function inAir(x,y,trk,gs){ S.air=true; S.pos={x,y}; S.trk=trk; S.hdg=trk; S.gs=gs||140; }
function basePlan(){ setPlan(['XNDV','ROKUS','HVL','ODRUP','XSKH'],1); }
function nearSkh(){ basePlan(); S.fpl.arr={apt:'XSKH',name:'ODRUP2W'}; rebuild(); S.com={act:'119.455',stby:'118.710'}; S.nav={act:'112.70',stby:'115.20'}; }
const SCN=[
 {id:'tour',cat:'pre',t:tt('The unit: pages, knobs and the cursor','Enheten: sider, knotter og cursoren'),
  d:tt('Get to know the unit on the ground at Nordvik. The large right knob chooses the page group (NAV, WPT, NRST), the small right knob the page in the group. Pushing the small knob (CRSR) puts the cursor on the page.','Bli kjent med enheten på bakken i Nordvik. Den store høyre knotten velger sidegruppe (NAV, WPT, NRST), den lille høyre knotten siden i gruppen. Trykker du inn den lille knotten (CRSR), kommer cursoren på siden.'),
  setup(){ ground(); basePlan(); },docs:['unit'],
  steps:[
   {t:tt('Turn the small right knob: Default NAV → MAP. Use RNG to zoom the map in and out.','Vri den lille høyre knotten: Default NAV → MAP. Bruk RNG for å zoome kartet inn og ut.'),keys:['RS+','RNGD'],ok:()=>S.seen.map&&S.log.some(k=>k==='RNGD'||k==='RNGU')},
   {t:tt('Turn the large right knob to the WPT group. Page 1 shows the destination airport, Skarhamn.','Vri den store høyre knotten til WPT-gruppen. Side 1 viser destinasjonsflyplassen, Skarhamn.'),keys:['RL+'],ok:()=>!!S.seen.aptloc},
   {t:tt('Small right knob to page 2 (runways): how long is runway 25 at XSKH?','Lille høyre knott til side 2 (rullebaner): hvor lang er rullebane 25 på XSKH?'),keys:['RS+'],ok:()=>!!S.seen.aptrwy},
   {t:tt('Push the small knob (CRSR): the cursor lands on the identifier. Type XFJB with the small knob (letters) and the large knob (next letter), or on your keyboard. ENT.','Trykk inn den lille knotten (CRSR): cursoren havner på identen. Skriv XFJB med lille knott (bokstaver) og store knott (neste bokstav), eller på tastaturet. ENT.'),keys:['RPUSH','RS+','RL+','ENT'],type:'XFJB',ok:()=>S.wptId==='XFJB'},
   {t:tt('Large right knob to the NRST group: the nearest airports, with bearing and distance.','Store høyre knott til NRST-gruppen: nærmeste flyplasser, med peiling og distanse.'),keys:['RPUSH','RL+'],ok:()=>!!S.seen.nrstapt},
   {t:tt('Hold CLR: back to the Default NAV page from anywhere.','Hold inne CLR: tilbake til Default NAV-siden uansett hvor du er.'),keys:['CLRL'],ok:()=>S.log.includes('CLRL')&&curPage()==='navdef'}
  ]},
 {id:'radio',cat:'pre',t:tt('COM and NAV: tune, flip, identify','COM og NAV: still inn, bytt, identifiser'),
  d:tt('On stand at Nordvik. Listen to the ATIS 127.425, then tune the tower from the database, and set up the Nordvik VOR 114.30 and identify it.','På standplass i Nordvik. Lytt på ATIS 127.425, still så inn tårnet fra databasen, og sett opp Nordvik VOR 114.30 og identifiser den.'),
  setup(){ ground(); basePlan(); S.com={act:'121.805',stby:'118.000'}; S.nav={act:'108.00',stby:'110.30'}; S.tune='COM'; },docs:['frqndv'],
  steps:[
   {t:tt('COM standby to 127.425: large left knob for the MHz, small left knob for the kHz (8.33 kHz channels).','COM standby til 127.425: store venstre knott for MHz, lille venstre knott for kHz (8,33 kHz-kanaler).'),keys:['LL+','LS+'],type:'127.425',ok:()=>S.com.stby==='127.425'||S.com.act==='127.425'},
   {t:tt('Flip it to active with the COM flip-flop key (C).','Bytt den til aktiv med COM flip-flop-tasten (C).'),keys:['CFF'],ok:()=>S.com.act==='127.425'},
   {t:tt('Tower from the database: NAV page 3 (NAVCOM), CRSR, large knob to TOWER 118.305, ENT puts it in COM standby.','Tårnet fra databasen: NAV side 3 (NAVCOM), CRSR, store knott til TOWER 118.305, ENT legger den i COM standby.'),keys:['RS+','RS+','RPUSH','RL+','ENT'],ok:()=>S.com.stby==='118.305'||S.com.act==='118.305'},
   {t:tt('Push the small left knob: the tuning box moves to NAV. Tune 114.30 in NAV standby.','Trykk inn den lille venstre knotten: innstillingsboksen flyttes til NAV. Still inn 114.30 i NAV standby.'),keys:['LPUSH','LL+','LS+'],type:'114.30',ok:()=>S.nav.stby==='114.30'||S.nav.act==='114.30'},
   {t:tt('Flip it active (V), then push ID on the volume knob and check the Morse code: NDV.','Bytt den aktiv (V), trykk så ID på volumknotten og sjekk morsekoden: NDV.'),keys:['VFF','ID'],ok:()=>S.nav.act==='114.30'&&S.idOn}
  ]},
 {id:'fpl',cat:'pre',t:tt('Build the flight plan','Bygg flyplanen'),
  d:tt('An IFR flight Nordvik–Skarhamn. Enter the route from the nav log: XNDV ROKUS HVL ODRUP XSKH.','En IFR-flyging Nordvik–Skarhamn. Legg inn ruten fra navigasjonsloggen: XNDV ROKUS HVL ODRUP XSKH.'),
  setup(){ ground(); setPlan([],0); },docs:['navlog'],
  steps:[
   {t:tt('FPL opens the active flight plan. Push CRSR: the cursor is on the first empty line.','FPL åpner den aktive flyplanen. Trykk CRSR: cursoren står på første tomme linje.'),keys:['FPL','RPUSH'],ok:()=>S.ovl==='fpl'&&S.crsr.on||S.fpl.wps.length>0},
   {t:tt('Turn the small knob to start the entry, spell XNDV (small knob = letter, large knob = next letter) and press ENT.','Vri den lille knotten for å starte, stav XNDV (lille knott = bokstav, store knott = neste bokstav) og trykk ENT.'),keys:['RS+','RL+','ENT'],type:'XNDV',ok:()=>fplIds()[0]==='XNDV'},
   {t:tt('The cursor moves to the next empty line. Enter ROKUS, then HVL.','Cursoren flyttes til neste tomme linje. Legg inn ROKUS, så HVL.'),keys:['RS+','ENT'],type:'ROKUS · HVL',ok:()=>has('ROKUS')&&has('HVL')&&fplIds().indexOf('ROKUS')<fplIds().indexOf('HVL')},
   {t:tt('Then ODRUP and the destination XSKH.','Så ODRUP og destinasjonen XSKH.'),keys:['RS+','ENT'],type:'ODRUP · XSKH',ok:()=>fplIds().join(' ')==='XNDV ROKUS HVL ODRUP XSKH'},
   {t:tt('Check every DTK and DIS against the nav log, then push CRSR to remove the cursor.','Sjekk hver DTK og DIS mot navigasjonsloggen, og trykk CRSR for å fjerne cursoren.'),keys:['RPUSH'],ok:()=>fplIds().join(' ')==='XNDV ROKUS HVL ODRUP XSKH'&&!S.crsr.on&&!S.ed}
  ]},
 {id:'xchk',cat:'pre',t:tt('Flight plan crosscheck','Kryssjekk av flyplanen'),
  d:tt('The other pilot has entered the route. Check it against the nav log: one waypoint is wrong and one is missing.','Den andre piloten har lagt inn ruten. Sjekk den mot navigasjonsloggen: ett waypoint er feil og ett mangler.'),
  setup(){ ground(); setPlan(['XNDV','ROKUS','KAVLO','XSKH'],1); go('NAV',0); },docs:['navlog'],
  steps:[
   {t:tt('FPL, CRSR, and compare with the nav log.','FPL, CRSR, og sammenlign med navigasjonsloggen.'),keys:['FPL','RPUSH'],ok:()=>!!S.seen['crsr-fpl']},
   {t:tt('KAVLO should be HVL. Large knob to KAVLO, CLR, and ENT on “Yes”.','KAVLO skal være HVL. Store knott til KAVLO, CLR, og ENT på «Yes».'),keys:['RL+','CLR','ENT'],hint2:tt('The nav log says ROKUS, HVL, ODRUP.','Navigasjonsloggen sier ROKUS, HVL, ODRUP.'),ok:()=>!has('KAVLO')},
   {t:tt('With the cursor on XSKH, enter HVL (it goes in before XSKH), then ODRUP.','Med cursoren på XSKH, legg inn HVL (den kommer foran XSKH), så ODRUP.'),keys:['RS+','ENT'],type:'HVL · ODRUP',ok:()=>fplIds().join(' ')==='XNDV ROKUS HVL ODRUP XSKH'}
  ]},
 {id:'dep',cat:'pre',t:tt('Load a departure (SID)','Last inn en avgang (SID)'),
  d:tt('ATC: “NDP21, cleared to Skarhamn, runway 19, ROKUS1A departure.” Load it with PROC.','ATC: «NDP21, cleared to Skarhamn, runway 19, ROKUS1A departure.» Last den inn med PROC.'),
  setup(){ ground(); basePlan(); },docs:['clr'],
  steps:[
   {t:tt('PROC, large knob to “Select Departure?”, ENT.','PROC, store knott til «Select Departure?», ENT.'),keys:['PROC','RL+','ENT'],ok:()=>!!S.seen['psel-dep']||!!S.fpl.dep},
   {t:tt('Choose ROKUS1A in the list, ENT; then runway 19 (RW19), ENT.','Velg ROKUS1A i listen, ENT; så rullebane 19 (RW19), ENT.'),keys:['RS+','ENT','ENT'],ok:()=>!!S.psel&&S.psel.stage==='load'||!!S.fpl.dep},
   {t:tt('“Load?” ENT. The flight plan shows the SID under DEPARTURE. Check it: NV190, TOSOK, ROKUS.','«Load?» ENT. Flyplanen viser SID-en under DEPARTURE. Sjekk den: NV190, TOSOK, ROKUS.'),keys:['ENT'],ok:()=>S.fpl.dep&&S.fpl.dep.name==='ROKUS1A'}
  ]},
 {id:'dto',cat:'fly',t:tt('Direct to','Direct to'),
  d:tt('Cruise between HVL and SELKA. ATC: “NDP21, proceed direct ODRUP.” ODRUP is in the flight plan, so go direct from the flight plan and keep the rest of the route.','Marsj mellom HVL og SELKA. ATC: «NDP21, proceed direct ODRUP.» ODRUP ligger i flyplanen, så gå direkte fra flyplanen og behold resten av ruten.'),
  setup(){ basePlan(); setPlan(['XNDV','ROKUS','HVL','SELKA','ODRUP','XSKH'],3); inAir(102,70,53); S.legFrom=null; S.crs=53; },docs:['atc_dct'],
  steps:[
   {t:tt('FPL, CRSR, and the large knob to ODRUP.','FPL, CRSR, og store knott til ODRUP.'),keys:['FPL','RPUSH','RL+'],ok:()=>S.ovl==='fpl'&&S.crsr.on&&(items('fpl')[S.crsr.i]||{}).id==='ODRUP'||S.lastDto==='ODRUP'},
   {t:tt('D→: ODRUP is already in the field. ENT, then ENT on “Activate?”.','D→: ODRUP står allerede i feltet. ENT, så ENT på «Activate?».'),keys:['DTO','ENT','ENT'],ok:()=>S.lastDto==='ODRUP'&&target()&&target().id==='ODRUP'&&!S.dto},
   {t:tt('MSG flashes: set the CDI course to the new DTK (the OBS on the CDI beside the map).','MSG blinker: sett CDI-kursen til ny DTK (OBS på CDI-en ved siden av kartet).'),keys:['MSG'],ok:()=>{ const n=nav(); return n&&n.id==='ODRUP'&&Math.abs(w180(n.dtk-S.crs))<=3; }}
  ]},
 {id:'obs',cat:'fly',t:tt('OBS: hold at a VOR','OBS: holding på en VOR'),
  d:tt('ATC: “NDP21, proceed direct SKH, hold inbound track 250, left turns.” Go direct, then use OBS to set the inbound course.','ATC: «NDP21, proceed direct SKH, hold inbound track 250, left turns.» Gå direkte, og bruk OBS for å sette inbound-kursen.'),
  setup(){ nearSkh(); inAir(160,118,30); S.fpl.act=fplIds().indexOf('TOLKA'); S.crs=30; },docs:['atc_hold'],
  steps:[
   {t:tt('D→, enter SKH (it is not in the flight plan), ENT, ENT.','D→, legg inn SKH (den ligger ikke i flyplanen), ENT, ENT.'),keys:['DTO','RS+','ENT','ENT'],type:'SKH',ok:()=>S.dto&&S.dto.id==='SKH'||S.obs&&target()&&target().id==='SKH'},
   {t:tt('Press OBS: the unit stops sequencing and the course comes from the CDI.','Trykk OBS: enheten slutter å sekvensere og kursen kommer fra CDI-en.'),keys:['OBS'],ok:()=>S.obs&&target()&&target().id==='SKH'},
   {t:tt('Set 250 on the CDI’s OBS. The magenta line on the map is now the inbound course of the hold.','Sett 250 på CDI-ens OBS. Den magenta linjen på kartet er nå inbound-kursen i holdingen.'),keys:[],type:'250',ok:()=>S.obs&&S.crs===250&&target().id==='SKH'}
  ]},
 {id:'arr',cat:'fly',t:tt('Arrival and approach','Arrival og innflyging'),
  d:tt('Before the descent. ATIS: runway 25, ILS approach, expect ODRUP2W arrival, transition SK260. Load the arrival and the approach.','Før nedstigningen. ATIS: rullebane 25, ILS-innflyging, forvent ODRUP2W arrival, transition SK260. Last inn arrivalen og innflygingen.'),
  setup(){ basePlan(); inAir(108,85,50); S.fpl.act=3; S.crs=50; },docs:['atis'],
  steps:[
   {t:tt('PROC, “Select Arrival?” (large knob), ENT.','PROC, «Select Arrival?» (store knott), ENT.'),keys:['PROC','RL+','ENT'],ok:()=>!!S.seen['psel-arr']||!!S.fpl.arr},
   {t:tt('ODRUP2W in the list, ENT, then “Load?” ENT.','ODRUP2W i listen, ENT, så «Load?» ENT.'),keys:['RS+','ENT','ENT'],ok:()=>S.fpl.arr&&S.fpl.arr.name==='ODRUP2W'},
   {t:tt('PROC, “Select Approach?”, ENT: ILS 25, ENT; transition SK260, ENT.','PROC, «Select Approach?», ENT: ILS 25, ENT; transition SK260, ENT.'),keys:['PROC','ENT','ENT','RS+','ENT'],ok:()=>S.psel&&S.psel.kind==='app'&&S.psel.name==='ILS 25'&&S.psel.trans==='SK260'||S.fpl.app&&S.fpl.app.name==='ILS 25'},
   {t:tt('“Load?” ENT (not Activate: you are still en route). The ILS frequency 110.30 is now in NAV standby.','«Load?» ENT (ikke Activate: du er fortsatt en route). ILS-frekvensen 110.30 står nå i NAV standby.'),keys:['ENT'],ok:()=>S.fpl.app&&S.fpl.app.name==='ILS 25'&&S.fpl.app.trans==='SK260'&&!S.fpl.app.active},
   {t:tt('FPL: check the arrival and the approach waypoints against the chart.','FPL: sjekk arrivalen og innflygingswaypointene mot kartet.'),keys:['FPL'],ok:()=>S.ovl==='fpl'&&S.fpl.app&&S.fpl.arr}
  ]},
 {id:'ils',cat:'fly',t:tt('ILS 25 with vectors to final','ILS 25 med vektorer til final'),
  d:tt('ILS 25 is loaded. Approach: “NDP21, turn left heading 220, vectors ILS 25.” Activate vectors to final, set up the ILS and fly it: the ILS is flown on VLOC, not on GPS.','ILS 25 er lastet inn. Approach: «NDP21, turn left heading 220, vectors ILS 25.» Aktiver vectors to final, sett opp ILS-en og fly den: ILS-en flys på VLOC, ikke på GPS.'),
  setup(){ nearSkh(); loadProc('app','XSKH','ILS 25','SK260'); inAir(203,152,220); S.fpl.act=fplIds().indexOf('SK260'); S.ap='HDG'; S.hdg=220; S.crs=220; },docs:['atc_vec','chart_ils'],
  steps:[
   {t:tt('PROC, “Activate Vector-To-Final?”, ENT. The magenta line is now the final course through FI25.','PROC, «Activate Vector-To-Final?», ENT. Den magenta linjen er nå finalkursen gjennom FI25.'),keys:['PROC','ENT'],ok:()=>S.fpl.app&&S.fpl.app.active&&S.fpl.app.vtf},
   {t:tt('110.30 is in NAV standby: flip it (V) and identify it (ID): ISK.','110.30 står i NAV standby: bytt den (V) og identifiser den (ID): ISK.'),keys:['VFF','ID'],ok:()=>S.nav.act==='110.30'&&S.idOn},
   {t:tt('CDI key to VLOC, and the CDI course to 250.','CDI-tasten til VLOC, og CDI-kursen til 250.'),keys:['CDI'],type:'250',ok:()=>S.cdi==='VLOC'&&S.crs===250},
   {t:tt('▶ to fly. Keep HDG 220 until the needle comes alive, then NAV: the autopilot captures the localizer.','▶ for å fly. Hold HDG 220 til nålen begynner å bevege seg, og så NAV: autopiloten fanger localizeren.'),keys:[],ok:()=>{ const v=vloc(); return S.ap==='NAV'&&S.cdi==='VLOC'&&v&&v.valid&&Math.abs(v.dev)<1; }}
  ]},
 {id:'rnp',cat:'fly',t:tt('RNAV 25 with LPV','RNAV 25 med LPV'),
  d:tt('ATC: “NDP21, cleared RNAV approach runway 25 via SK260.” Select it, activate it and watch the CDI scale go from TERM to LPV before FF25.','ATC: «NDP21, cleared RNAV approach runway 25 via SK260.» Velg den, aktiver den og se CDI-skalaen gå fra TERM til LPV før FF25.'),
  setup(){ nearSkh(); inAir(204,163,200); S.fpl.act=fplIds().indexOf('SK260'); S.crs=190; },docs:['atc_rnp','chart_rnp'],
  steps:[
   {t:tt('PROC, “Select Approach?”: RNAV 25, ENT; transition SK260, ENT.','PROC, «Select Approach?»: RNAV 25, ENT; transition SK260, ENT.'),keys:['PROC','ENT','RS+','ENT','RS+','ENT'],ok:()=>S.psel&&S.psel.name==='RNAV 25'&&S.psel.trans==='SK260'||S.fpl.app&&S.fpl.app.name==='RNAV 25'},
   {t:tt('Large knob to “Activate?”, ENT: the unit goes direct to SK260 and the approach is active.','Store knott til «Activate?», ENT: enheten går direkte til SK260 og innflygingen er aktiv.'),keys:['RL+','ENT'],ok:()=>S.fpl.app&&S.fpl.app.name==='RNAV 25'&&S.fpl.app.active},
   {t:tt('The CDI stays on GPS. ▶ to fly, and watch the annunciation under the map: TERM, then LPV within 2 NM of FF25.','CDI-en blir på GPS. ▶ for å fly, og følg annunciatoren under kartet: TERM, så LPV innenfor 2 NM fra FF25.'),keys:[],ok:()=>S.cdi==='GPS'&&cdiMode()==='LPV'}
  ]},
 {id:'miss',cat:'fly',t:tt('Missed approach: SUSP and OBS','Bomflyging: SUSP og OBS'),
  d:tt('On the RNAV 25, just before the runway. No visual reference at the minimum: go around. The unit suspends at the MAP (SUSP); OBS releases it to the missed approach.','På RNAV 25, rett før rullebanen. Ingen visuelle referanser på minimum: gå rundt. Enheten stopper på MAP (SUSP); OBS slipper den videre til bomflygingen.'),
  setup(){ nearSkh(); loadProc('app','XSKH','RNAV 25','SK260'); activateAppr(false); S.fpl.act=fplIds().indexOf('RW25'); const f=thr('XSKH','25'); const q=along(f,70,1.5); inAir(q.x,q.y,250,120); S.legFrom=null; S.crs=250; S.run=false; },docs:['chart_rnp'],
  steps:[
   {t:tt('▶ to fly over the runway. SUSP comes on at the MAP: the unit does not go on to the missed approach by itself.','▶ for å fly over rullebanen. SUSP tennes på MAP: enheten går ikke videre til bomflygingen av seg selv.'),keys:[],ok:()=>S.susp||target()&&target().id==='SKH'},
   {t:tt('Press OBS: SUSP goes out and the active leg is to SKH, the missed approach holding point.','Trykk OBS: SUSP slukker og aktivt leg er til SKH, holdingpunktet for bomflygingen.'),keys:['OBS'],ok:()=>!S.susp&&target()&&target().id==='SKH'},
   {t:tt('Check the CDI scale (TERM) and the course to SKH on the Default NAV page.','Sjekk CDI-skalaen (TERM) og kursen til SKH på Default NAV-siden.'),keys:['CLRL'],ok:()=>target()&&target().id==='SKH'&&curPage()==='navdef'}
  ]},
 {id:'nrst',cat:'fly',t:tt('Rough engine: nearest airport','Motoren går ujevnt: nærmeste flyplass'),
  d:tt('Cruise near GRAVA, the engine starts running rough. Find the nearest airport with a hard runway, go direct and tune its frequency.','Marsj nær GRAVA, motoren begynner å gå ujevnt. Finn nærmeste flyplass med fast dekke, gå direkte og still inn frekvensen.'),
  setup(){ basePlan(); setPlan(['XNDV','ROKUS','HVL','GRV','VIKSA','XFJB'],3); inAir(110,52,110); S.crs=110; },docs:['emer'],
  steps:[
   {t:tt('Large right knob to NRST: the nearest airport is at the top.','Store høyre knott til NRST: nærmeste flyplass står øverst.'),keys:['RL-'],ok:()=>!!S.seen.nrstapt},
   {t:tt('CRSR on the first airport (XBRK, BREKKA), then D→, ENT, ENT.','CRSR på første flyplass (XBRK, BREKKA), så D→, ENT, ENT.'),keys:['RPUSH','DTO','ENT','ENT'],ok:()=>S.dto&&S.dto.id==='XBRK'},
   {t:tt('Its AFIS frequency: WPT page 3 (frequencies) for XBRK, CRSR to 123.505, ENT, then C.','AFIS-frekvensen: WPT side 3 (frekvenser) for XBRK, CRSR til 123.505, ENT, så C.'),keys:['RL+','RS-','RPUSH','RL+','ENT','CFF'],ok:()=>S.com.act==='123.505'}
  ]},
 {id:'div',cat:'fly',t:tt('Diversion to Fjellby','Diversjon til Fjellby'),
  d:tt('Skarhamn is closed. Company: divert to Fjellby (XFJB), ILS 34, vectors. Go direct, then load and activate the ILS 34 with vectors.','Skarhamn er stengt. Selskapet: diverter til Fjellby (XFJB), ILS 34, vektorer. Gå direkte, og last inn og aktiver ILS 34 med vektorer.'),
  setup(){ nearSkh(); inAir(150,120,40); S.fpl.act=fplIds().indexOf('TOLKA'); S.crs=40; },docs:['atc_altn'],
  steps:[
   {t:tt('D→ XFJB, ENT, ENT.','D→ XFJB, ENT, ENT.'),keys:['DTO','RS+','ENT','ENT'],type:'XFJB',ok:()=>S.dto&&S.dto.id==='XFJB'||S.fpl.app&&S.fpl.app.apt==='XFJB'},
   {t:tt('PROC, “Select Approach?”: the airport is now XFJB. ILS 34, ENT; VECTORS, ENT.','PROC, «Select Approach?»: flyplassen er nå XFJB. ILS 34, ENT; VECTORS, ENT.'),keys:['PROC','ENT','ENT','ENT'],ok:()=>S.psel&&S.psel.apt==='XFJB'&&S.psel.trans==='VECTORS'||S.fpl.app&&S.fpl.app.apt==='XFJB'},
   {t:tt('“Activate?” (large knob), ENT. The final course 340 is magenta, and 108.90 is in NAV standby.','«Activate?» (store knott), ENT. Finalkursen 340 er magenta, og 108.90 står i NAV standby.'),keys:['RL+','ENT'],ok:()=>S.fpl.app&&S.fpl.app.apt==='XFJB'&&S.fpl.app.active&&S.fpl.app.vtf},
   {t:tt('Flip 108.90 active and identify IFJ.','Bytt 108.90 til aktiv og identifiser IFJ.'),keys:['VFF','ID'],ok:()=>S.nav.act==='108.90'&&S.idOn}
  ]},
 {id:'free',cat:'free',t:tt('Free flight','Fri flyging'),d:tt('En route from Nordvik to Skarhamn with the flight plan active. Try anything: ▶ flies the aircraft.','En route fra Nordvik til Skarhamn med aktiv flyplan. Prøv hva du vil: ▶ flyr flyet.'),
  setup(){ basePlan(); inAir(60,40,50); S.fpl.act=2; S.crs=50; },docs:['navlog'],steps:[]},
 {id:'drill',cat:'hidden',t:tt('Find the page','Finn siden'),d:tt('Find the page or field the trainer names.','Finn siden eller feltet treneren nevner.'),setup(){ basePlan(); inAir(60,40,50); S.fpl.act=2; },docs:[],steps:[]}
];

function docHtml(k){
  const D={
    unit:[tt('The unit','Enheten'),'NAV   1 Default NAV  2 MAP\n      3 NAVCOM       4 POSITION\nWPT   1 LOCATION  2 RUNWAYS\n      3 FREQUENCIES\nNRST  1 AIRPORTS  2 VOR'],
    frqndv:[tt('Nordvik (XNDV)','Nordvik (XNDV)'),'ATIS      127.425\nGROUND    121.805\nTOWER     118.305\nNDV VOR   114.30'],
    navlog:[tt('Nav log','Navigasjonslogg'),'NDP21  XNDV → XSKH   IFR\nWPT     TRK   DIST\nROKUS   051°   34\nHVL     069°   73\nODRUP   051°   75\nXSKH    068°   37'],
    clr:['ATC','NDP21 cleared to Skarhamn,\nrunway 19, ROKUS1A departure,\nclimb FL060, squawk 4521'],
    atc_dct:['ATC','NDP21, proceed direct ODRUP'],
    atc_hold:['ATC','NDP21, proceed direct SKH,\nhold inbound track 250,\nleft turns, expect further\nclearance at 1530'],
    atis:['ATIS XSKH','SKARHAMN INFO C\nRWY 25 IN USE, ILS APPROACH\nEXPECT ODRUP2W, TRANSITION SK260\n240/15 9999 FEW030 04/M01 Q1008'],
    atc_vec:['ATC','NDP21, turn left heading 220,\nvectors ILS runway 25'],
    chart_ils:['ILS 25 XSKH','LOC ISK 110.30   FAC 250°\nFAF FI25 2200 ft (6 NM)\nIF SK255 3800 ft\nDA 380 ft\nMISSED: climb to 3000, to SKH, hold'],
    atc_rnp:['ATC','NDP21, cleared RNAV approach\nrunway 25 via SK260'],
    chart_rnp:['RNAV (GNSS) 25 XSKH','IAF SK260  IF SK255\nFAF FF25 2200 ft (6 NM)\nLPV DA 380 ft\nMISSED: climb to 3000, to SKH, hold'],
    emer:[tt('Situation','Situasjon'),isNo()?'Motoren går ujevnt, effekten\nfaller. Nærmeste flyplass\nmed fast dekke, nå.':'Rough engine, power dropping.\nNearest airport with a hard\nrunway, now.'],
    atc_altn:[tt('Company','Selskapet'),'Skarhamn closed until 1700.\nDivert to Fjellby (XFJB),\nILS 34, vectors.']
  };
  const d=D[k]; if(!d) return '';
  return `<div class="mdoc"><b>${esc(Lx(d[0]))}</b><pre>${esc(d[1])}</pre></div>`;
}

/* =========================================================== course: modules, quizzes, find-the-page drill */
const DRILL_T=[
 {id:'map',q:tt('Open the moving map','Åpne kartet'),pg:()=>curPage()==='map',a:tt('NAV group · small knob to page 2','NAV-gruppen · lille knott til side 2'),k:'RS+'},
 {id:'navdef',q:tt('Open the Default NAV page','Åpne Default NAV-siden'),pg:()=>curPage()==='navdef'&&S.log.length>0,a:tt('Hold CLR, or NAV group page 1','Hold CLR, eller NAV-gruppen side 1'),k:'CLRL'},
 {id:'navcom',q:tt('Find the tower frequency of the destination','Finn tårnfrekvensen på destinasjonen'),pg:()=>curPage()==='navcom'||curPage()==='aptfrq',a:tt('NAV page 3 (NAVCOM), or WPT page 3','NAV side 3 (NAVCOM), eller WPT side 3'),k:'RS+'},
 {id:'pos',q:tt('Find your position in latitude and longitude','Finn posisjonen din i bredde og lengde'),pg:()=>curPage()==='pos',a:tt('NAV group · page 4','NAV-gruppen · side 4'),k:'RS-'},
 {id:'rwy',q:tt('Find the runway length at the destination','Finn rullebanelengden på destinasjonen'),pg:()=>curPage()==='aptrwy',a:tt('WPT group · page 2','WPT-gruppen · side 2'),k:'RL+'},
 {id:'elev',q:tt('Find the elevation of the destination','Finn høyden over havet på destinasjonen'),pg:()=>curPage()==='aptloc',a:tt('WPT group · page 1','WPT-gruppen · side 1'),k:'RL+'},
 {id:'nrst',q:tt('Find the nearest airport','Finn nærmeste flyplass'),pg:()=>curPage()==='nrstapt',a:tt('NRST group · page 1','NRST-gruppen · side 1'),k:'RL-'},
 {id:'nvor',q:tt('Find the nearest VOR and its frequency','Finn nærmeste VOR og frekvensen'),pg:()=>curPage()==='nrstvor',a:tt('NRST group · page 2','NRST-gruppen · side 2'),k:'RL-'},
 {id:'fpl',q:tt('Open the active flight plan','Åpne den aktive flyplanen'),pg:()=>curPage()==='fpl',a:'FPL',k:'FPL'},
 {id:'proc',q:tt('Open the procedures (approach, arrival, departure)','Åpne prosedyrene (innflyging, arrival, avgang)'),pg:()=>curPage()==='proc'||curPage()==='psel',a:'PROC',k:'PROC'},
 {id:'dto',q:tt('Open the Direct-To page','Åpne Direct-To-siden'),pg:()=>curPage()==='dto',a:'D→',k:'DTO'},
 {id:'msg',q:tt('Read the messages','Les meldingene'),pg:()=>curPage()==='msg',a:'MSG',k:'MSG'},
 {id:'fmenu',q:tt('Open the flight plan menu (Activate Leg, Invert, Delete)','Åpne flyplanmenyen (Activate Leg, Invert, Delete)'),pg:()=>curPage()==='fpl'&&S.popup&&S.popup.menu,a:'FPL · MENU',k:'FPL'},
 {id:'selapp',q:tt('Open the approach list for the destination','Åpne innflygingslisten for destinasjonen'),pg:()=>curPage()==='psel'&&S.psel&&S.psel.kind==='app',a:tt('PROC · Select Approach? · ENT','PROC · Select Approach? · ENT'),k:'PROC'}
];
const COURSE=[
 {id:'m1',t:tt('The unit in ten minutes','Enheten på ti minutter'),s:tt('Knobs, pages, the cursor, ENT and CLR','Knotter, sider, cursoren, ENT og CLR'),
  pts:[tt('Left of the screen: the radios. Right: the navigator. The left knobs tune COM and NAV, the right knobs move through the pages and enter data.','Til venstre for skjermen: radioene. Til høyre: navigatoren. De venstre knottene stiller inn COM og NAV, de høyre knottene blar i sidene og legger inn data.'),
       tt('Pages come in groups: NAV, WPT and NRST (and AUX on the real unit). The large right knob chooses the group, the small right knob the page. The boxes at the bottom right show where you are.','Sidene ligger i grupper: NAV, WPT og NRST (og AUX på den ekte enheten). Den store høyre knotten velger gruppe, den lille høyre knotten side. Boksene nederst til høyre viser hvor du er.'),
       tt('Push the small right knob (CRSR) to put the cursor on the page. With the cursor on, the large knob moves it and the small knob changes the field or starts an entry.','Trykk inn den lille høyre knotten (CRSR) for å få cursoren på siden. Med cursoren på flytter den store knotten den, og den lille knotten endrer feltet eller starter en inntasting.'),
       tt('Entering an ident: small knob = the letter, large knob = the next letter. The unit completes the ident from the database as you spell it. ENT accepts, CLR cancels.','Legge inn en ident: lille knott = bokstaven, store knott = neste bokstav. Enheten fullfører identen fra databasen mens du staver. ENT godtar, CLR avbryter.'),
       tt('Hold CLR to get back to the Default NAV page from anywhere. FPL, PROC, D→ and MSG open their own pages; press the key again to go back.','Hold inne CLR for å komme tilbake til Default NAV-siden uansett hvor du er. FPL, PROC, D→ og MSG åpner egne sider; trykk tasten igjen for å gå tilbake.')],
  tasks:['tour','free'],drill:['map','navdef','pos','rwy','elev','nrst','nvor','navcom'],
  quiz:[{q:tt('How do you get to the WPT pages?','Hvordan kommer du til WPT-sidene?'),a:[tt('Turn the large right knob','Vri den store høyre knotten'),tt('Turn the small right knob','Vri den lille høyre knotten'),tt('Press MENU','Trykk MENU')],c:0,w:tt('The large knob chooses the group, the small knob the page in it.','Den store knotten velger gruppe, den lille siden i gruppen.')},
        {q:tt('You are lost in the pages. Fastest way back?','Du har gått deg vill i sidene. Raskeste vei tilbake?'),a:[tt('Hold CLR','Hold inne CLR'),tt('Press ENT twice','Trykk ENT to ganger'),tt('Turn the unit off','Slå av enheten')],c:0,w:tt('Holding CLR always returns to the Default NAV page.','Å holde inne CLR går alltid tilbake til Default NAV-siden.')},
        {q:tt('What does pushing the small right knob do?','Hva gjør det å trykke inn den lille høyre knotten?'),a:[tt('Turns the cursor on or off (CRSR)','Slår cursoren på eller av (CRSR)'),tt('Swaps the COM frequencies','Bytter COM-frekvensene'),tt('Opens Direct-To','Åpner Direct-To')],c:0,w:tt('CRSR: the cursor is what lets you select and change fields.','CRSR: cursoren er det som lar deg velge og endre felt.')},
        {q:tt('“MSG” is flashing at the bottom of the screen. What do you do?','«MSG» blinker nederst på skjermen. Hva gjør du?'),a:[tt('Press MSG and read the message','Trykk MSG og les meldingen'),tt('Ignore it, it goes away','Ignorer den, den går bort'),tt('Press CLR','Trykk CLR')],c:0,w:tt('A message can be anything from a course to set to a lost integrity warning. Always read it.','En melding kan være alt fra en kurs som skal settes til tap av integritet. Les den alltid.')}]},
 {id:'m2',t:tt('COM and NAV radios','COM- og NAV-radioene'),s:tt('Tune, flip, 8.33 kHz, identify','Still inn, bytt, 8,33 kHz, identifiser'),
  pts:[tt('You always tune the standby frequency (in the box), then flip it to active with C (COM) or V (NAV). The active frequency is the one in use.','Du stiller alltid inn standby-frekvensen (i boksen), og bytter den til aktiv med C (COM) eller V (NAV). Den aktive frekvensen er den som er i bruk.'),
       tt('Large left knob: MHz. Small left knob: kHz. Push the small left knob to move the box between COM and NAV.','Store venstre knott: MHz. Lille venstre knott: kHz. Trykk inn den lille venstre knotten for å flytte boksen mellom COM og NAV.'),
       tt('In Europe, COM uses 8.33 kHz channels. The display shows the channel name: 118.305 is a channel name, so tune exactly what ATC or the chart gives you.','I Europa bruker COM 8,33 kHz-kanaler. Displayet viser kanalnavnet: 118.305 er et kanalnavn, så still inn nøyaktig det ATC eller kartet gir deg.'),
       tt('Frequencies from the database: on NAVCOM, WPT frequencies or NRST, put the cursor on the frequency and press ENT: it goes to standby.','Frekvenser fra databasen: på NAVCOM, WPT-frekvenser eller NRST, sett cursoren på frekvensen og trykk ENT: den havner i standby.'),
       tt('Always identify a navaid before you use it: push ID and check the Morse code against the chart.','Identifiser alltid en navaid før du bruker den: trykk ID og sjekk morsekoden mot kartet.'),
       tt('Hold C for about two seconds: 121.500 goes straight to active COM.','Hold inne C i omtrent to sekunder: 121.500 går rett til aktiv COM.')],
  tasks:['radio'],drill:['navcom','nvor'],
  quiz:[{q:tt('Which frequency do you change with the left knobs?','Hvilken frekvens endrer du med de venstre knottene?'),a:[tt('The standby frequency in the box','Standby-frekvensen i boksen'),tt('The active frequency','Den aktive frekvensen'),tt('Both','Begge')],c:0,w:tt('Then flip it to active. You never lose the frequency you are on while you tune.','Så bytter du den til aktiv. Du mister aldri frekvensen du er på mens du stiller inn.')},
        {q:tt('Emergency, no time: how do you get 121.500?','Nødsituasjon, ingen tid: hvordan får du 121.500?'),a:[tt('Hold the COM flip-flop key (C) for about two seconds','Hold inne COM flip-flop-tasten (C) i omtrent to sekunder'),tt('Hold CLR','Hold inne CLR'),tt('Press NRST','Trykk NRST')],c:0,w:tt('It tunes 121.500 directly into active COM.','Den stiller 121.500 rett inn som aktiv COM.')},
        {q:tt('ATC: “contact Skarhamn approach 119.455”. What do you set?','ATC: «contact Skarhamn approach 119.455». Hva stiller du inn?'),a:[tt('119.455 exactly','Nøyaktig 119.455'),tt('119.450','119.450'),tt('119.460','119.460')],c:0,w:tt('With 8.33 kHz channel names, the last digits matter: tune the channel name you were given.','Med kanalnavn for 8,33 kHz betyr de siste sifrene noe: still inn kanalnavnet du fikk.')}]},
 {id:'m3',t:tt('The flight plan','Flyplanen'),s:tt('Build, check, insert, delete, activate a leg','Bygg, sjekk, sett inn, slett, aktiver et leg'),
  pts:[tt('FPL opens the active flight plan. Push CRSR, then turn the small knob on an empty line (or on a waypoint) to enter a waypoint. It goes in before the highlighted line.','FPL åpner den aktive flyplanen. Trykk CRSR, og vri den lille knotten på en tom linje (eller på et waypoint) for å legge inn et waypoint. Det kommer foran linjen som er markert.'),
       tt('Delete: cursor on the waypoint, CLR, ENT on “Yes”.','Slette: cursor på waypointet, CLR, ENT på «Yes».'),
       tt('The magenta arrow marks the active leg. To fly another leg, put the cursor on its waypoint, MENU, “Activate Leg?”, ENT.','Den magenta pilen viser aktivt leg. For å fly et annet leg, sett cursoren på waypointet, MENU, «Activate Leg?», ENT.'),
       tt('Check every DTK and distance against the nav log. A wrong waypoint with a similar name is a classic error: look at the distances, they give it away.','Sjekk hver DTK og distanse mot navigasjonsloggen. Et feil waypoint med lignende navn er en klassisk feil: se på distansene, de avslører det.'),
       tt('Procedures (departure, arrival, approach) are loaded with PROC, not typed in. Their waypoints cannot be edited one by one.','Prosedyrer (avgang, arrival, innflyging) lastes inn med PROC, de skrives ikke inn. Waypointene i dem kan ikke endres enkeltvis.')],
  tasks:['fpl','xchk','dep'],drill:['fpl','fmenu','proc'],
  quiz:[{q:tt('The cursor is on HVL and you enter GAPOT. Where does GAPOT go?','Cursoren står på HVL og du legger inn GAPOT. Hvor havner GAPOT?'),a:[tt('Before HVL','Foran HVL'),tt('After HVL','Etter HVL'),tt('It replaces HVL','Den erstatter HVL')],c:0,w:tt('A new waypoint is inserted in front of the highlighted one.','Et nytt waypoint settes inn foran det som er markert.')},
        {q:tt('How do you fly a leg further down the plan?','Hvordan flyr du et leg lenger ned i planen?'),a:[tt('Cursor on its waypoint, MENU, “Activate Leg?”, ENT','Cursor på waypointet, MENU, «Activate Leg?», ENT'),tt('Delete the waypoints before it','Slett waypointene foran'),tt('Press OBS','Trykk OBS')],c:0,w:tt('Activate Leg flies the leg as drawn, from the previous waypoint. Direct-To would fly straight from your position.','Activate Leg flyr leget slik det er tegnet, fra forrige waypoint. Direct-To flyr rett fra posisjonen din.')}]},
 {id:'m4',t:tt('Direct to, OBS and NRST','Direct to, OBS og NRST'),s:tt('D→ ENT ENT, holds with OBS, the nearest airport','D→ ENT ENT, holding med OBS, nærmeste flyplass'),
  pts:[tt('D→ opens Direct-To with the waypoint under the cursor, or the active waypoint. ENT confirms the waypoint, ENT again on “Activate?”.','D→ åpner Direct-To med waypointet under cursoren, eller det aktive waypointet. ENT bekrefter waypointet, ENT igjen på «Activate?».'),
       tt('Direct to a waypoint in the flight plan: the plan continues after it. Direct to a waypoint that is not in the plan: the unit goes there and then stops. MENU on the D→ page cancels a Direct-To.','Direct to et waypoint i flyplanen: planen fortsetter etterpå. Direct to et waypoint som ikke er i planen: enheten går dit og stopper. MENU på D→-siden avbryter en Direct-To.'),
       tt('OBS stops the sequencing and takes the course from the CDI’s OBS: use it for a hold or for a course to a fix. Press OBS again to go back to normal sequencing.','OBS stopper sekvenseringen og tar kursen fra CDI-ens OBS: bruk den for en holding eller en kurs til et fix. Trykk OBS igjen for å gå tilbake til normal sekvensering.'),
       tt('With a mechanical CDI the unit cannot turn the course pointer: when the DTK changes, MSG says “Set course to …”. Turn the OBS to it.','Med en mekanisk CDI kan ikke enheten dreie kurspilen: når DTK endres, sier MSG «Set course to …». Vri OBS til den.'),
       tt('NRST APT lists the nearest airports with bearing, distance and runway. Cursor on one, D→, ENT, ENT: the fastest way to an airport in an emergency.','NRST APT viser nærmeste flyplasser med peiling, distanse og rullebane. Cursor på én, D→, ENT, ENT: den raskeste veien til en flyplass i en nødsituasjon.')],
  tasks:['dto','obs','nrst'],drill:['dto','nrst','msg'],
  quiz:[{q:tt('ATC: “proceed direct ODRUP”. ODRUP is in the plan. Best way?','ATC: «proceed direct ODRUP». ODRUP ligger i planen. Beste måte?'),a:[tt('FPL, cursor on ODRUP, D→, ENT, ENT','FPL, cursor på ODRUP, D→, ENT, ENT'),tt('D→, type ODRUP, ENT, ENT','D→, skriv ODRUP, ENT, ENT'),tt('Delete the waypoints before ODRUP','Slett waypointene foran ODRUP')],c:0,w:tt('Both work here, but from the flight plan you pick the right ODRUP and the route after it stays.','Begge virker her, men fra flyplanen velger du riktig ODRUP og ruten etter den blir værende.')},
        {q:tt('OBS is shown at the bottom of the screen. What does it mean?','OBS vises nederst på skjermen. Hva betyr det?'),a:[tt('Waypoints are not sequenced; the course comes from the CDI','Waypoints sekvenseres ikke; kursen kommer fra CDI-en'),tt('The GPS has failed','GPS-en har feilet'),tt('The approach is active','Innflygingen er aktiv')],c:0,w:tt('Forgetting OBS mode on is a common reason the unit does not go on to the next leg.','Å glemme OBS-modus på er en vanlig grunn til at enheten ikke går videre til neste leg.')},
        {q:tt('Engine trouble. Fastest way to the nearest airport?','Motortrøbbel. Raskeste vei til nærmeste flyplass?'),a:[tt('NRST, cursor on the airport, D→, ENT, ENT','NRST, cursor på flyplassen, D→, ENT, ENT'),tt('Build a new flight plan','Bygg en ny flyplan'),tt('PROC, Select Approach','PROC, Select Approach')],c:0,w:tt('Then check the runway length and surface on the same page.','Sjekk så rullebanelengde og dekke på samme side.')}]},
 {id:'m5',t:tt('Procedures and approaches','Prosedyrer og innflyginger'),s:tt('Load or activate, VTF, ILS on VLOC, LPV','Load eller activate, VTF, ILS på VLOC, LPV'),
  pts:[tt('PROC: Select Departure, Arrival or Approach, choose the procedure and the transition, then “Load?” or “Activate?”. Load adds it to the plan; Activate also starts flying it.','PROC: Select Departure, Arrival eller Approach, velg prosedyren og transitionen, og så «Load?» eller «Activate?». Load legger den til i planen; Activate begynner også å fly den.'),
       tt('Load the approach early, en route, when you know which one to expect. Activate it when cleared, or use “Activate Vector-To-Final?” when ATC gives vectors: the magenta line becomes the final course through the FAF.','Last inn innflygingen tidlig, en route, når du vet hvilken du kan forvente. Aktiver den når du er klarert, eller bruk «Activate Vector-To-Final?» når ATC gir vektorer: den magenta linjen blir finalkursen gjennom FAF.'),
       tt('An ILS is flown on VLOC, not on GPS: the unit shows “NOT APPROVED FOR GPS”. It puts the localizer frequency in NAV standby: flip it, identify it, set the course, and press CDI for VLOC. Some installations switch to VLOC by themselves; know your aircraft.','En ILS flys på VLOC, ikke på GPS: enheten viser «NOT APPROVED FOR GPS». Den legger localizer-frekvensen i NAV standby: bytt den, identifiser den, sett kursen, og trykk CDI for VLOC. Noen installasjoner bytter til VLOC selv; kjenn flyet ditt.'),
       tt('CDI scale, shown under the map: ENR (2 NM full scale), TERM within 30 NM of the airport (1 NM), and APR or LPV within 2 NM of the FAF on an active GPS approach (0.3 NM, angular on LPV).','CDI-skala, vist under kartet: ENR (2 NM fullt utslag), TERM innenfor 30 NM fra flyplassen (1 NM), og APR eller LPV innenfor 2 NM fra FAF på en aktiv GPS-innflyging (0,3 NM, vinkelbasert på LPV).'),
       tt('No LPV (or APR) before the FAF: do not continue the GPS approach to the LPV minimum. Check the annunciation before the FAF, every time.','Ingen LPV (eller APR) før FAF: ikke fortsett GPS-innflygingen ned til LPV-minimum. Sjekk annunciatoren før FAF, hver gang.')],
  tasks:['arr','ils','rnp'],drill:['proc','selapp','fpl'],
  quiz:[{q:tt('You are en route and expect the ILS 25. Load or activate?','Du er en route og forventer ILS 25. Load eller activate?'),a:[tt('Load','Load'),tt('Activate','Activate'),tt('Neither, wait for ATC','Ingen av dem, vent på ATC')],c:0,w:tt('Activate would take you off the route towards the approach now.','Activate ville tatt deg vekk fra ruten mot innflygingen nå.')},
        {q:tt('On the ILS, the CDI shows GPS. What is wrong?','På ILS-en viser CDI-en GPS. Hva er feil?'),a:[tt('The CDI key has not been pressed to VLOC','CDI-tasten er ikke trykket til VLOC'),tt('Nothing, GPS is fine for the ILS','Ingenting, GPS er greit for ILS'),tt('The approach is not loaded','Innflygingen er ikke lastet inn')],c:0,w:tt('The ILS is not approved on GPS: fly the localizer and glideslope on VLOC.','ILS-en er ikke godkjent på GPS: fly localizer og glidebane på VLOC.')},
        {q:tt('2 NM before the FAF on the RNAV 25 it still says TERM. What do you do?','2 NM før FAF på RNAV 25 står det fortsatt TERM. Hva gjør du?'),a:[tt('Do not descend on the approach; go missed or ask for another approach','Ikke gå ned på innflygingen; gå rundt eller be om en annen innflyging'),tt('Continue, it will change','Fortsett, det endrer seg'),tt('Press CDI','Trykk CDI')],c:0,w:tt('Without APR or LPV, the unit is not giving approach integrity and scaling.','Uten APR eller LPV gir ikke enheten integritet og skala for innflyging.')}]},
 {id:'m6',t:tt('Missed approach and diversion','Bomflyging og diversjon'),s:tt('SUSP, OBS, a new destination','SUSP, OBS, ny destinasjon'),
  pts:[tt('The unit does not go on to the missed approach by itself: at the MAP it shows SUSP and keeps the final course. Press OBS to go on to the missed approach.','Enheten går ikke videre til bomflygingen av seg selv: på MAP viser den SUSP og holder finalkursen. Trykk OBS for å gå videre til bomflygingen.'),
       tt('Fly the first part of the missed approach (climb, heading) by the chart, then OBS. After an ILS, set the CDI back to GPS for the missed approach.','Fly første del av bomflygingen (stigning, kurs) etter kartet, og så OBS. Etter en ILS setter du CDI-en tilbake til GPS for bomflygingen.'),
       tt('Diversion: D→ the new airport, then PROC: the approach list is for the airport you are going direct to. Load or activate its approach as usual.','Diversjon: D→ den nye flyplassen, og så PROC: innflygingslisten gjelder flyplassen du går direkte til. Last inn eller aktiver innflygingen som vanlig.')],
  tasks:['miss','div'],drill:['dto','selapp','nrst'],
  quiz:[{q:tt('After the MAP, SUSP is on. What does it mean?','Etter MAP er SUSP på. Hva betyr det?'),a:[tt('Sequencing is suspended: press OBS for the missed approach','Sekvenseringen er stoppet: trykk OBS for bomflygingen'),tt('The GPS signal is lost','GPS-signalet er borte'),tt('The approach is finished and deleted','Innflygingen er ferdig og slettet')],c:0,w:tt('SUSP stops the unit from turning you away before you have decided to go around.','SUSP hindrer at enheten svinger deg bort før du har bestemt deg for å gå rundt.')},
        {q:tt('You are going direct to XFJB and open PROC, Select Approach. Which airport’s approaches do you see?','Du går direkte til XFJB og åpner PROC, Select Approach. Hvilken flyplass sine innflyginger ser du?'),a:[tt('XFJB','XFJB'),tt('XSKH, the planned destination','XSKH, den planlagte destinasjonen'),tt('XNDV','XNDV')],c:0,w:tt('A direct-to an airport makes it the airport for the approach.','En direct-to til en flyplass gjør den til flyplassen for innflygingen.')}]}
];

/* =========================================================== UI (only in the browser) */
const el=id=>HASDOM?document.getElementById(id):null;
let SC=null, MODE='guided', DONE=false, CHECKED=false, HINT=-1, LATCH=[], LASTSCR='', LASTCDI='', MOD=null, DRL=null;
function stepIdx(){ if(!SC) return -1; for(let i=0;i<SC.steps.length;i++){ if(LATCH[i]) continue; if(SC.steps[i].ok()){ LATCH[i]=true; continue; } return i; } return SC.steps.length; }
const stepOk=i=>!!LATCH[i]||SC.steps[i].ok();
function latchAll(){ if(!SC) return; SC.steps.forEach((s,i)=>{ if(!LATCH[i]&&s.ok()) LATCH[i]=true; }); }

/* faceplate */
function knob(side){ /* outer ring = large knob, inner = small knob, the centre = push. Left half turns left, right half right. */
  const s=side; return `<svg class="kb" viewBox="0 0 100 100" aria-hidden="false">
   <defs>
    <radialGradient id="kgo${s}" cx="42%" cy="30%" r="78%"><stop offset="0" stop-color="#5E656B"/><stop offset=".5" stop-color="#33383D"/><stop offset="1" stop-color="#15181B"/></radialGradient>
    <radialGradient id="kgi${s}" cx="42%" cy="30%" r="78%"><stop offset="0" stop-color="#727980"/><stop offset=".55" stop-color="#40464B"/><stop offset="1" stop-color="#1C1F22"/></radialGradient>
    <radialGradient id="kgp${s}" cx="42%" cy="32%" r="75%"><stop offset="0" stop-color="#868D93"/><stop offset=".6" stop-color="#50565C"/><stop offset="1" stop-color="#2A2E32"/></radialGradient>
    <filter id="kgs${s}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6"/></filter>
   </defs>
   <circle cx="50.5" cy="54.5" r="47" fill="#000" opacity=".6" filter="url(#kgs${s})"/>
   <circle cx="50" cy="50" r="48" class="kbo" style="fill:url(#kgo${s})"/>
   <circle cx="50" cy="50" r="46.4" fill="none" stroke="#0B0D0F" stroke-width="3.2" stroke-dasharray="1.25 1.8" opacity=".85"/>
   <path d="M17 27A40 40 0 0 1 83 27" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1.2" stroke-linecap="round"/>
   <circle cx="50.5" cy="53" r="30" fill="#000" opacity=".55" filter="url(#kgs${s})"/>
   <circle cx="50" cy="50" r="30" class="kbi" style="fill:url(#kgi${s})"/>
   <circle cx="50" cy="50" r="28.6" fill="none" stroke="#0E1012" stroke-width="2.4" stroke-dasharray="1 1.45" opacity=".8"/>
   <path d="M31 38A23 23 0 0 1 69 38" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1" stroke-linecap="round"/>
   <circle cx="50.3" cy="51.6" r="12.5" fill="#000" opacity=".5" filter="url(#kgs${s})"/>
   <path data-k="${s}L-" d="M50 2A48 48 0 0 0 50 98L50 80A30 30 0 0 1 50 20Z" class="kz" role="button" aria-label="${s==='R'?'Right':'Left'} large knob, turn left"><title>${s==='R'?'Large knob ⟲':'MHz ⟲'}</title></path>
   <path data-k="${s}L+" d="M50 2A48 48 0 0 1 50 98L50 80A30 30 0 0 0 50 20Z" class="kz" role="button" aria-label="${s==='R'?'Right':'Left'} large knob, turn right"><title>${s==='R'?'Large knob ⟳':'MHz ⟳'}</title></path>
   <path data-k="${s}S-" d="M50 20A30 30 0 0 0 50 80L50 63A13 13 0 0 1 50 37Z" class="kz in" role="button" aria-label="${s==='R'?'Right':'Left'} small knob, turn left"><title>${s==='R'?'Small knob ⟲':'kHz ⟲'}</title></path>
   <path data-k="${s}S+" d="M50 20A30 30 0 0 1 50 80L50 63A13 13 0 0 0 50 37Z" class="kz in" role="button" aria-label="${s==='R'?'Right':'Left'} small knob, turn right"><title>${s==='R'?'Small knob ⟳':'kHz ⟳'}</title></path>
   <circle data-k="${s}PUSH" cx="50" cy="50" r="12" class="kz kp" role="button" aria-label="${s==='R'?'Push CRSR':'Push: COM or NAV'}"><title>${s==='R'?'PUSH CRSR':'PUSH C/V'}</title></circle>
   <text x="10" y="54" class="ka">‹</text><text x="90" y="54" class="ka" text-anchor="end">›</text><text x="34" y="54" class="ka sm">‹</text><text x="66" y="54" class="ka sm" text-anchor="end">›</text>
  </svg>`; }
function buildUnit(){
  const m=el('gns'); if(!m) return;
  const K=(k,t,c)=>`<button type="button" class="k ${c||''}" data-k="${k}">${t}</button>`;
  m.innerHTML=`<div class="gtop">
    <div class="gl">
      <div class="gvk"><span class="gv">COM<br>VOL</span>${K('ID','VOL<br><b>ID</b>','idk')}</div>
      <div class="gff">${K('CFF','C','ff')}${K('VFF','V','ff')}</div>
      <div class="gkw">${knob('L')}<span class="gkl">COM · NAV</span></div>
    </div>
    <div class="gmid"><div class="gscrw" id="gscr"></div>
      <div class="gbk">${K('CDI','CDI')}${K('OBS','OBS')}${K('MSG','MSG')}${K('FPL','FPL')}${K('VNAV','VNAV')}${K('PROC','PROC')}</div></div>
    <div class="gr">
      <div class="grng">${K('RNGU','<span>▲</span>','rg')}<i>RNG</i>${K('RNGD','<span>▼</span>','rg')}</div>
      ${K('DTO','D<span class="dto">→</span>','ak')}${K('MENU','MENU','ak')}${K('CLR','CLR','ak')}${K('ENT','ENT','ak')}
      <div class="gkw">${knob('R')}<span class="gkl">PUSH CRSR</span></div>
    </div></div>`;
  let hold=null, longDone=false;
  const longKeys={CLR:'CLRL',CFF:'CFFL'};
  m.addEventListener('pointerdown',e=>{ const b=e.target.closest('[data-k]'); if(!b) return; ACT=true; b.classList.add('dn'); const lk=longKeys[b.dataset.k]; if(lk){ longDone=false; hold=setTimeout(()=>{ longDone=true; key(lk); },lk==='CFFL'?1800:700); } });
  const up=()=>{ m.querySelectorAll('.dn').forEach(x=>x.classList.remove('dn')); if(hold){ clearTimeout(hold); hold=null; } };
  m.addEventListener('pointerup',up); m.addEventListener('pointerleave',up); m.addEventListener('pointercancel',up);
  m.addEventListener('click',e=>{ const b=e.target.closest('[data-k]'); if(!b) return; const k=b.dataset.k; if(longKeys[k]&&longDone){ longDone=false; return; } key(k); });
  /* the mouse wheel turns a knob: the inner part the small knob, the ring the large one */
  let wl=0; m.addEventListener('wheel',e=>{ const z=e.target.closest('.kz'); if(!z) return; e.preventDefault(); const now=Date.now(); if(now-wl<90) return; wl=now; const k=z.dataset.k; if(/PUSH$/.test(k)) return; key(k.slice(0,2)+(e.deltaY>0?'+':'-')); },{passive:false});
}
let ACT=false;
function keyEvents(){
  document.addEventListener('pointerdown',e=>{ ACT=!!e.target.closest('#gns'); },true);
  document.addEventListener('keydown',e=>{
    if(!S||e.ctrlKey||e.metaKey||e.altKey) return;
    const t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable)) return;
    const sec=el('app'); if(!sec) return; const r=sec.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight) return;
    let k=null; const c=e.key;
    if(/^[a-zA-Z0-9]$/.test(c)&&(S.ed||S.crsr.on||S.ovl==='dto')) k=c.toUpperCase();
    else if(c==='Enter'&&(ACT||S.ed||S.crsr.on||S.ovl)) k='ENT'; else if(c==='Backspace'||c==='Escape') k='CLR';
    else if(ACT&&c==='ArrowUp') k='RS+'; else if(ACT&&c==='ArrowDown') k='RS-'; else if(ACT&&c==='ArrowRight') k='RL+'; else if(ACT&&c==='ArrowLeft') k='RL-';
    if(!k) return; e.preventDefault(); key(k); flash(k);
  });
}
function flash(k){ const b=document.querySelector(`#gns [data-k="${k}"]`); if(!b) return; b.classList.add('dn'); setTimeout(()=>b.classList.remove('dn'),110); }
function key(k){ if(drillKey(k)){ refresh(); return; } press(k); clearHl(); refresh(); if(S.flash) setTimeout(refresh,2700); }
function clearHl(){ if(HASDOM) document.querySelectorAll('#gns .hl').forEach(b=>b.classList.remove('hl')); }

/* the CDI beside the map: course pointer card, needle, TO/FROM, the OBS knob */
function cdiSvg(){
  const c=cdiOut(); const v=c.valid?clamp(c.v,-1.15,1.15):0; const r=80;
  let h=`<svg viewBox="0 0 200 200" class="cdisvg" role="img" aria-label="CDI">`;
  h+=`<circle cx="100" cy="100" r="96" class="cbez"/><circle cx="100" cy="100" r="84" class="cface"/>`;
  h+=`<g transform="rotate(${-S.crs} 100 100)">`;
  for(let a=0;a<360;a+=10){ const L=a%30===0?10:5; const x1=100+r*Math.sin(a*R2), y1=100-r*Math.cos(a*R2), x2=100+(r-L)*Math.sin(a*R2), y2=100-(r-L)*Math.cos(a*R2); h+=`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="ctk"/>`;
    if(a%30===0){ const tx=100+(r-20)*Math.sin(a*R2), ty=100-(r-20)*Math.cos(a*R2); h+=`<text x="${tx.toFixed(1)}" y="${(ty+4).toFixed(1)}" class="cnum" text-anchor="middle" transform="rotate(${a} ${tx.toFixed(1)} ${ty.toFixed(1)})">${a===0?'N':a===90?'E':a===180?'S':a===270?'W':a/10}</text>`; } }
  h+='</g>';
  h+=`<path d="M100 8L94 20L106 20Z" class="cidx"/>`;
  for(let i=-5;i<=5;i++){ if(i===0) continue; h+=`<circle cx="${100+i*11}" cy="128" r="2.6" class="cdot"/>`; }
  h+=`<line x1="${(100+v*55).toFixed(1)}" y1="62" x2="${(100+v*55).toFixed(1)}" y2="162" class="cndl${c.valid?'':' off'}"/>`;
  if(c.valid) h+=`<path d="${c.to?'M100 70L91 84L109 84Z':'M100 92L91 78L109 78Z'}" class="cflag"/>`; else h+=`<rect x="70" y="72" width="60" height="18" class="cnav"/><text x="100" y="85.5" class="cnavt" text-anchor="middle">NAV</text>`;
  h+=`<text x="4" y="14" class="csrc">${c.src}</text>`;
  return h+'</svg>';
}
function drawCdi(){ const b=el('gcdi'); if(!b) return; const s=cdiSvg(); if(s!==LASTCDI){ b.innerHTML=s; LASTCDI=s; } const i=el('gobs'); if(i&&document.activeElement!==i) i.value=p3(S.crs); drawAp(); }
function cdiUi(){
  const step=d=>{ S.crs=w360(S.crs+d); courseMsg(); refresh(); };
  el('gobsm').onclick=()=>step(-1); el('gobsp').onclick=()=>step(1); el('gobsm5').onclick=()=>step(-10); el('gobsp5').onclick=()=>step(10);
  const i=el('gobs'); i.onchange=()=>{ const v=parseInt(i.value,10); if(v>=0&&v<=360){ S.crs=w360(v||360); courseMsg(); } refresh(); i.blur(); };
  i.onkeydown=e=>{ if(e.key==='Enter') i.onchange(); e.stopPropagation(); };
  el('gcdi').addEventListener('wheel',e=>{ e.preventDefault(); step(e.deltaY>0?1:-1); },{passive:false});
}
/* the simple autopilot that lets you see the unit fly */
let TIMER=null;
function loop(){ if(TIMER) return; let last=performance.now(); TIMER=setInterval(()=>{ if(!S||!S.run){ clearInterval(TIMER); TIMER=null; drawAp(); return; } const now=performance.now(), dt=Math.min(1,(now-last)/1000); last=now; if(document.hidden) return; stepFlight(dt*12); refresh(); },100); }
function drawAp(){ const b=el('gap'); if(!b) return; b.hidden=!S.air; if(!S.air) return; el('gaprun').setAttribute('aria-pressed',S.run?'true':'false'); el('gaprun').textContent=S.run?'❚❚':'▶'; el('gapnav').setAttribute('aria-pressed',S.ap==='NAV'?'true':'false'); el('gaphdg').setAttribute('aria-pressed',S.ap==='HDG'?'true':'false'); const h=el('gaph'); if(document.activeElement!==h) h.value=p3(S.ap==='HDG'?S.hdg:S.trk); }
function apUi(){
  el('gaprun').onclick=()=>{ S.run=!S.run; if(S.run) loop(); refresh(); };
  el('gapnav').onclick=()=>{ S.ap='NAV'; refresh(); };
  el('gaphdg').onclick=()=>{ if(S.ap!=='HDG') S.hdg=w360(Math.round(S.trk)); S.ap='HDG'; refresh(); };
  const st=d=>{ const b=S.ap==='HDG'?S.hdg:S.trk; S.hdg=w360(Math.round((b+d)/5)*5); S.ap='HDG'; refresh(); };
  el('gaphm').onclick=()=>st(-5); el('gaphp').onclick=()=>st(5);
  const h=el('gaph'); h.onchange=()=>{ const v=parseInt(h.value,10); if(v>=0&&v<=360){ S.hdg=w360(v||360); S.ap='HDG'; } refresh(); h.blur(); }; h.onkeydown=e=>{ if(e.key==='Enter') h.onchange(); e.stopPropagation(); };
}

function refresh(){
  if(!HASDOM||!S) return;
  const h=draw(); if(h!==LASTSCR){ el('gscr').innerHTML=h; LASTSCR=h; } drawCdi();
  const m=document.querySelector('#gns [data-k="MSG"]'); if(m) m.classList.toggle('lit',!!S.msgNew);
  if(!SC) return;
  if(MODE==='drill'){ drillNow(); drillSteps(); return; }
  if(MODE==='practice') latchAll();
  const n=SC.steps.length, i=stepIdx(); const now=el('mnow');
  if(MODE==='guided'&&n){
    if(i>=n){ now.innerHTML=`<b>${esc(Lx(tt('Done.','Ferdig.')))}</b> ${esc(Lx(tt('Every step is complete. Now try the same task “On your own”, without the steps.','Alle stegene er gjort. Prøv nå samme oppgave «På egen hånd», uten stegene.')))}`; now.className='mnow ok'; DONE=true; }
    else { const st=SC.steps[i]; now.className='mnow'; now.innerHTML=`<span class="mst">${esc(Lx(tt('Step','Steg')))} ${i+1}/${n}</span><span class="mtx">${esc(Lx(st.t))}</span><button type="button" class="mhint" id="mhint">${esc(Lx(tt('Hint','Hint')))}</button><div class="mhk" id="mhk" hidden></div>`; el('mhint').onclick=()=>{ HINT=i; showHint(st); }; if(HINT===i) showHint(st); }
  } else if(MODE==='practice'&&n){ now.className='mnow pr'; now.innerHTML=`<span class="mtx">${esc(Lx(SC.d))}</span><button type="button" class="mhint" id="mchk">${esc(Lx(tt('Check my setup','Sjekk oppsettet')))}</button>`; el('mchk').onclick=check; }
  else { now.className='mnow pr'; now.innerHTML=`<span class="mtx">${esc(Lx(SC.d))}</span>`; }
  drawSteps(i);
}
const KN={RPUSH:tt('push the small right knob (CRSR)','trykk inn lille høyre knott (CRSR)'),'RS+':tt('small right knob ⟳','lille høyre knott ⟳'),'RS-':tt('small right knob ⟲','lille høyre knott ⟲'),'RL+':tt('large right knob ⟳','store høyre knott ⟳'),'RL-':tt('large right knob ⟲','store høyre knott ⟲'),
  LPUSH:tt('push the small left knob','trykk inn lille venstre knott'),'LS+':tt('small left knob (kHz)','lille venstre knott (kHz)'),'LS-':tt('small left knob (kHz)','lille venstre knott (kHz)'),'LL+':tt('large left knob (MHz)','store venstre knott (MHz)'),'LL-':tt('large left knob (MHz)','store venstre knott (MHz)'),
  CFF:'C',VFF:'V',DTO:'D→',CLRL:tt('hold CLR','hold inne CLR'),CFFL:tt('hold C','hold inne C'),RNGU:'RNG ▲',RNGD:'RNG ▼',ID:'ID'};
const keyName=k=>{ const v=KN[k]; return v?Lx(v):k; };
function showHint(st){ const box=el('mhk'); if(!box) return; clearHl();
  let h=st.keys.map(k=>`<kbd>${esc(keyName(k))}</kbd>`).join(' ');
  if(st.type) h+=` <span class="mty">${esc(Lx(tt('enter','legg inn')))} <code>${esc(st.type)}</code></span>`;
  if(st.hint2) h+=`<p>${esc(Lx(st.hint2))}</p>`;
  if(!st.keys.length&&!st.type) h=esc(Lx(tt('Use ▶ and the CDI beside the map.','Bruk ▶ og CDI-en ved siden av kartet.')));
  box.innerHTML=h; box.hidden=false;
  st.keys.forEach(k=>{ const kk=k==='CLRL'?'CLR':k==='CFFL'?'CFF':k; document.querySelectorAll(`#gns [data-k="${kk}"]`).forEach(b=>b.classList.add('hl')); }); }
function drawSteps(cur){ const box=el('msteps'); if(!box) return;
  if(!SC.steps.length){ box.innerHTML=''; return; }
  if(MODE==='practice'&&!CHECKED){ box.innerHTML=`<p class="note">${esc(Lx(tt('On your own, the steps are hidden. Do the task from the paperwork, then press “Check my setup”.','På egen hånd er stegene skjult. Gjør oppgaven etter papirene, og trykk «Sjekk oppsettet».')))}</p>`; return; }
  box.innerHTML='<ol class="msl">'+SC.steps.map((s,i)=>{ const ok=stepOk(i); const cl=MODE==='practice'?(ok?'ok':'no'):(i<cur?'ok':i===cur?'cur':''); return `<li class="${cl}">${esc(Lx(s.t))}</li>`; }).join('')+'</ol>'; }
function check(){ CHECKED=true; latchAll(); const n=SC.steps.length, ok=SC.steps.filter((s,i)=>stepOk(i)).length; drawSteps(stepIdx()); const r=el('mres'); r.hidden=false; r.className='mres '+(ok===n?'ok':'part'); r.textContent=ok===n?Lx(tt(`All ${n} items correct.`,`Alle ${n} punktene er riktige.`)):Lx(tt(`${ok} of ${n} correct. The list shows what is missing.`,`${ok} av ${n} riktige. Listen viser hva som mangler.`)); }
function loadScn(id){
  if(S) S.run=false; SC=SCN.find(s=>s.id===id)||SCN[0]; S=blank(); SC.setup(); S.log=[]; S.seen={}; S.seen[curPage()]=1; courseMsg(); S.msgNew=false;
  HINT=-1; LATCH=[]; DONE=false; CHECKED=false;
  if(!HASDOM) return;
  const r=el('mres'); if(r) r.hidden=true;
  el('mdocs').innerHTML=SC.docs.map(docHtml).join('');
  el('mtitle').textContent=Lx(SC.t);
  const ph=el('mphase'); if(ph) ph.textContent=S.air?Lx(tt('In flight','I lufta')):Lx(tt('On stand, Nordvik','På standplass, Nordvik'));
  document.querySelectorAll('#mlist button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===SC.id?'true':'false'));
  if(SC.cat!=='hidden'){ try{ localStorage.setItem('bb-gns-scn',SC.id); }catch(e){} }
  refresh();
}
function buildList(){ const box=el('mlist'); if(!box) return;
  const grp=[['pre',tt('On the ground','På bakken')],['fly',tt('In flight','I lufta')],['free',tt('Free','Fri')]];
  box.innerHTML=grp.map(([g,t])=>`<div class="mlg"><span>${esc(Lx(t))}</span>${SCN.filter(s=>s.cat===g).map(s=>`<button type="button" data-s="${s.id}" aria-pressed="false">${esc(Lx(s.t))}</button>`).join('')}</div>`).join('');
  box.onclick=e=>{ const b=e.target.closest('button[data-s]'); if(b){ if(MODE==='drill') setMode('guided'); loadScn(b.dataset.s); const a=el('gns'); if(a&&innerWidth<980) a.scrollIntoView({block:'nearest',behavior:'smooth'}); } }; }
function setMode(m){ if(m!=='drill'&&MODE==='drill'&&SC&&SC.id==='drill'){ MODE=m; loadScn('tour'); }
  if(m==='drill'&&MODE!=='drill'&&(!DRL||DRL.i>=DRL.list.length)){ MODE='drill'; startDrill(null); return; }
  MODE=m; CHECKED=false; const r=el('mres'); if(r) r.hidden=true; document.querySelectorAll('#mmode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===m?'true':'false')); clearHl(); refresh(); }

function courseUi(){
  const g=el('mcourse'); if(!g) return;
  g.innerHTML=COURSE.map((m,i)=>`<button type="button" class="mcard${MOD===m.id?' on':''}" data-m="${m.id}" aria-expanded="${MOD===m.id}"><span class="n">${String(i+1).padStart(2,'0')}</span><b>${esc(Lx(m.t))}</b><small>${esc(Lx(m.s))}</small></button>`).join('')+
    `<button type="button" class="mcard dr" data-m="drill"><span class="n">⌖</span><b>${esc(Lx(tt('Find the page','Finn siden')))}</b><small>${esc(Lx(tt('10 random pages: find them with the knobs and keys','10 tilfeldige sider: finn dem med knottene og tastene')))}</small></button>`;
  g.onclick=e=>{ const b=e.target.closest('button[data-m]'); if(!b) return; if(b.dataset.m==='drill'){ startDrill(null); return; } MOD=MOD===b.dataset.m?null:b.dataset.m; courseUi(); if(MOD){ const p=el('mcmod'); if(p) p.scrollIntoView({block:'nearest',behavior:'smooth'}); } };
  const p=el('mcmod'); if(!p) return; const m=COURSE.find(x=>x.id===MOD); if(!m){ p.hidden=true; p.innerHTML=''; return; }
  p.hidden=false;
  const tsk=m.tasks.map(id=>{ const sc=SCN.find(s=>s.id===id); return `<li><b>${esc(Lx(sc.t))}</b><span class="go"><button type="button" class="btn sm" data-try="${id}" data-mode="guided">${esc(Lx(tt('With help','Med hjelp')))}</button>${sc.steps.length?`<button type="button" class="btn sm ghost" data-try="${id}" data-mode="practice">${esc(Lx(tt('On your own','På egen hånd')))}</button>`:''}</span></li>`; }).join('');
  p.innerHTML=`<div class="mcm-h"><h3>${esc(Lx(m.t))}</h3><button type="button" class="mrst" data-close="1">${esc(Lx(tt('Close','Lukk')))}</button></div>
   <div class="mcm-g"><div><h4>${esc(Lx(tt('Key points','Det viktigste')))}</h4><ul class="mpts">${m.pts.map(x=>`<li>${esc(Lx(x))}</li>`).join('')}</ul></div>
   <div><h4>${esc(Lx(tt('Tasks','Oppgaver')))}</h4><ol class="mtsk">${tsk}</ol>
   <h4>${esc(Lx(tt('Find the page','Finn siden')))}</h4><p class="note">${esc(Lx(tt('Drill the pages of this module until you find them without thinking.','Drill sidene i denne modulen til du finner dem uten å tenke.')))}</p><button type="button" class="btn sm" data-drill="${m.id}">${esc(Lx(tt('Start the drill','Start drillen')))}</button></div></div>
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
  const ids=m?m.drill:shuffle(DRILL_T.map(t=>t.id)).slice(0,10);
  DRL={list:shuffle(ids).map(id=>DRILL_T.find(t=>t.id===id)).filter(Boolean),i:0,found:[],helped:0,shown:false,mod:mid};
  MODE='drill'; document.querySelectorAll('#mmode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m==='drill'?'true':'false'));
  loadScn('drill'); drillReset(); refresh(); const a=el('app'); if(a) a.scrollIntoView({behavior:'smooth'});
}
function drillReset(){ /* each item starts from the Default NAV page with nothing open */ S.ovl=null; S.popup=null; S.ed=null; S.crsr={on:false,i:0}; S.psel=null; S.dtoPg=null; go('NAV',0); S.log=[]; }
function drillKey(k){ return false; }
function drillCheck(){ if(MODE!=='drill'||!DRL||DRL.i>=DRL.list.length) return; const t=DRL.list[DRL.i]; if(t.pg()&&S.log.length){ DRL.found.push({t,help:DRL.shown}); if(DRL.shown) DRL.helped++; DRL.i++; DRL.shown=false; DRL.flash='ok'; if(DRL.i<DRL.list.length){ setTimeout(()=>{ if(MODE==='drill'){ drillReset(); refresh(); } },650); } } }
function drillNow(){
  drillCheck();
  const now=el('mnow');
  if(!DRL){ now.className='mnow pr'; now.innerHTML=''; return; }
  if(DRL.i>=DRL.list.length){ now.className='mnow ok'; now.innerHTML=`<b>${esc(Lx(tt('Done.','Ferdig.')))}</b> <span class="mtx">${esc(Lx(tt(`You found all ${DRL.list.length}, ${DRL.helped} with help.`,`Du fant alle ${DRL.list.length}, ${DRL.helped} med hjelp.`)))}</span><button type="button" class="mhint" id="mdragain">${esc(Lx(tt('Again','Igjen')))}</button>`; el('mdragain').onclick=()=>startDrill(DRL.mod); return; }
  const t=DRL.list[DRL.i];
  now.className='mnow'+(DRL.flash==='ok'?' good':'');
  now.innerHTML=`<span class="mst">${DRL.i+1}/${DRL.list.length}</span><span class="mtx"><b>${esc(Lx(tt('Find:','Finn:')))}</b> ${esc(Lx(t.q))}</span><button type="button" class="mhint" id="mdshow">${esc(Lx(tt('Show me','Vis meg')))}</button><button type="button" class="mhint" id="mdskip">${esc(Lx(tt('Skip','Hopp over')))}</button>${DRL.shown?`<div class="mhk"><kbd>${esc(Lx(t.a))}</kbd></div>`:''}`;
  DRL.flash=null;
  el('mdshow').onclick=()=>{ DRL.shown=true; drillNow(); document.querySelectorAll(`#gns [data-k="${t.k==='CLRL'?'CLR':t.k}"]`).forEach(b=>b.classList.add('hl')); };
  el('mdskip').onclick=()=>{ DRL.list.push(DRL.list.splice(DRL.i,1)[0]); DRL.shown=false; drillReset(); refresh(); };
}
function drillSteps(){ const box=el('msteps'); if(!box) return; if(!DRL){ box.innerHTML=''; return; }
  box.innerHTML='<ol class="msl">'+DRL.found.map(f=>`<li class="ok">${esc(Lx(f.t.q))} · <b>${esc(Lx(f.t.a))}</b></li>`).join('')+'</ol>'+(DRL.found.length?'':`<p class="note">${esc(Lx(tt('Use the knobs and keys to get to the page. Each find starts again from the Default NAV page. The pages you find are listed here with the way to them.','Bruk knottene og tastene for å komme til siden. Hver gang starter du fra Default NAV-siden. Sidene du finner, listes her med veien dit.')))}</p>`); }
function refUi(){
  const r=el('mref'); if(!r) return;
  const S2=x=>typeof x==='string'?x:Lx(x);
  const Rw=[
   [tt('Large left knob','Store venstre knott'),tt('COM or NAV standby, MHz','COM eller NAV standby, MHz'),tt('The box shows which one you are tuning','Boksen viser hvilken du stiller inn')],
   [tt('Small left knob','Lille venstre knott'),tt('kHz (COM in 8.33 kHz channels, NAV in 50 kHz). Push: box between COM and NAV','kHz (COM i 8,33 kHz-kanaler, NAV i 50 kHz). Trykk: boksen mellom COM og NAV'),''],
   ['C · V',tt('Flip standby and active, COM (C) or NAV (V)','Bytt standby og aktiv, COM (C) eller NAV (V)'),tt('Hold C about 2 s: 121.500 active','Hold C ca. 2 s: 121.500 aktiv')],
   [tt('VOL / ID','VOL / ID'),tt('Push for the navaid’s Morse ident','Trykk for navaidens morseident'),tt('Identify before use','Identifiser før bruk')],
   [tt('Large right knob','Store høyre knott'),tt('Page group: NAV, WPT, NRST. With the cursor: moves the cursor','Sidegruppe: NAV, WPT, NRST. Med cursor: flytter cursoren'),tt('In an entry: the next letter','I en inntasting: neste bokstav')],
   [tt('Small right knob','Lille høyre knott'),tt('The page in the group. With the cursor: changes the field or starts an entry. Push: CRSR','Siden i gruppen. Med cursor: endrer feltet eller starter en inntasting. Trykk: CRSR'),tt('In an entry: the letter','I en inntasting: bokstaven')],
   ['D→',tt('Direct-To: the waypoint under the cursor or the active one; ENT, ENT','Direct-To: waypointet under cursoren eller det aktive; ENT, ENT'),tt('MENU on the page: Cancel Direct-To','MENU på siden: Cancel Direct-To')],
   ['MENU',tt('The page’s options','Sidens valg'),tt('FPL: Activate Leg, Invert, Delete','FPL: Activate Leg, Invert, Delete')],
   ['CLR',tt('Cancels an entry or a question; removes a waypoint on FPL','Avbryter en inntasting eller et spørsmål; fjerner et waypoint på FPL'),tt('Hold: Default NAV page','Hold: Default NAV-siden')],
   ['ENT',tt('Accepts an entry, answers yes, puts a frequency in standby','Godtar en inntasting, svarer ja, legger en frekvens i standby'),''],
   ['RNG',tt('Map range ▲ out, ▼ in','Kartskala ▲ ut, ▼ inn'),''],
   ['CDI',tt('The CDI source: GPS or VLOC','CDI-kilden: GPS eller VLOC'),tt('Shown bottom left of the screen','Vises nederst til venstre på skjermen')],
   ['OBS',tt('OBS mode on or off; releases SUSP after the MAP','OBS-modus av eller på; slipper SUSP etter MAP'),tt('OBS or SUSP shown at the bottom','OBS eller SUSP vises nederst')],
   ['MSG',tt('The message page','Meldingssiden'),tt('MSG flashes when there is a new message','MSG blinker når det er en ny melding')],
   ['FPL',tt('The active flight plan','Den aktive flyplanen'),tt('CRSR to edit','CRSR for å endre')],
   ['PROC',tt('Departures, arrivals, approaches; Activate Approach and Vector-To-Final','Avganger, arrivals, innflyginger; Activate Approach og Vector-To-Final'),tt('Load or Activate','Load eller Activate')],
   ['VNAV',tt('Vertical navigation','Vertikal navigasjon'),tt('Not part of this trainer','Ikke med i denne treneren')]
  ];
  r.innerHTML=`<table class="mreft"><thead><tr><th>${esc(Lx(tt('Key or knob','Tast eller knott')))}</th><th>${esc(Lx(tt('What it does','Hva den gjør')))}</th><th>${esc(Lx(tt('Good to know','Greit å vite')))}</th></tr></thead><tbody>${Rw.map(x=>`<tr><td><kbd>${esc(S2(x[0]))}</kbd></td><td>${esc(S2(x[1]))}</td><td>${esc(S2(x[2]))}</td></tr>`).join('')}</tbody></table>`;
  const p=el('mpages'); if(p) p.innerHTML=`<table class="mreft"><thead><tr><th>${esc(Lx(tt('Group','Gruppe')))}</th><th>${esc(Lx(tt('Pages (small right knob)','Sider (lille høyre knott)')))}</th></tr></thead><tbody>${[
   ['NAV',tt('1 Default NAV (CDI, DTK, DIS, GS, ETE and a map) · 2 Map · 3 NAVCOM (frequencies of the departure and destination) · 4 Position','1 Default NAV (CDI, DTK, DIS, GS, ETE og kart) · 2 Kart · 3 NAVCOM (frekvensene på avgangs- og destinasjonsflyplassen) · 4 Posisjon')],
   ['WPT',tt('1 Airport location and elevation · 2 Runways · 3 Frequencies','1 Flyplassens posisjon og høyde · 2 Rullebaner · 3 Frekvenser')],
   ['NRST',tt('1 Nearest airports · 2 Nearest VORs','1 Nærmeste flyplasser · 2 Nærmeste VOR-er')],
   [tt('Keys','Taster'),tt('FPL, PROC, D→, MSG and VNAV open their own pages on top','FPL, PROC, D→, MSG og VNAV åpner egne sider oppå')]
  ].map(x=>`<tr><td><b>${esc(x[0])}</b></td><td>${esc(Lx(x[1]))}</td></tr>`).join('')}</tbody></table>`;
  const c=el('mvs'); if(c) c.innerHTML=`<table class="mreft"><thead><tr><th></th><th>GNS 430 / 530</th><th>GTN 650 / 750</th></tr></thead><tbody>${[
   [tt('Controls','Betjening'),tt('Keys and two dual knobs; a cursor you move with the knobs','Taster og to doble knotter; en cursor du flytter med knottene'),tt('Touchscreen with a home page of icons, and one dual knob','Berøringsskjerm med en hjemmeside med ikoner, og én dobbel knott')],
   [tt('Pages','Sider'),tt('Page groups (NAV, WPT, NRST, AUX) with the large and small knob','Sidegrupper (NAV, WPT, NRST, AUX) med store og lille knott'),tt('Apps you touch: Flight Plan, Procedures, Map, Nearest, Waypoint Info','Apper du trykker på: Flight Plan, Procedures, Map, Nearest, Waypoint Info')],
   [tt('Direct to','Direct to'),'D→, ENT, ENT','D→, '+Lx(tt('choose the waypoint','velg waypointet'))+', Activate'],
   [tt('Approaches','Innflyginger'),tt('PROC, Select Approach, Load or Activate, Vector-To-Final','PROC, Select Approach, Load eller Activate, Vector-To-Final'),tt('The same logic: Procedures, Approach, Load or Activate, Vectors-To-Final','Samme logikk: Procedures, Approach, Load eller Activate, Vectors-To-Final')],
   [tt('Missed approach','Bomflyging'),tt('SUSP at the MAP, OBS to go on','SUSP på MAP, OBS for å gå videre'),tt('SUSP at the MAP, unsuspend on the screen','SUSP på MAP, unsuspend på skjermen')],
   [tt('430 or 530','430 eller 530'),tt('The same keys and logic. The 530 has a bigger screen, so the map shows beside the navigation data','Samme taster og logikk. 530 har større skjerm, så kartet vises ved siden av navigasjonsdataene'),'']
  ].map(x=>`<tr><td><b>${esc(Lx(x[0]))}</b></td><td>${esc(typeof x[1]==='string'?x[1]:Lx(x[1]))}</td><td>${esc(typeof x[2]==='string'?x[2]:Lx(x[2]))}</td></tr>`).join('')}</tbody></table>`;
}
function init(){
  if(!el('gns')) return;
  buildUnit(); buildList(); keyEvents(); cdiUi(); apUi();
  el('mmode').onclick=e=>{ const b=e.target.closest('button[data-m]'); if(b) setMode(b.dataset.m); };
  el('mreset').onclick=()=>{ if(MODE==='drill') startDrill(DRL&&DRL.mod); else loadScn(SC.id); };
  let first='tour'; try{ const s=localStorage.getItem('bb-gns-scn'); if(s&&SCN.some(x=>x.id===s)) first=s; }catch(e){}
  const h=location.hash.replace('#',''); if(SCN.some(x=>x.id===h)) first=h;
  loadScn(first); courseUi(); refUi();
  if(LB()&&LB().onLang) LB().onLang(()=>{ buildList(); el('mdocs').innerHTML=SC.docs.map(docHtml).join(''); el('mtitle').textContent=Lx(SC.t); document.querySelectorAll('#mlist button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===SC.id?'true':'false')); courseUi(); refUi(); LASTSCR=''; refresh(); });
}

G.GNS={press:k=>{ if(HASDOM) key(k); else press(k); },state:()=>S,load:loadScn,scn:SCN,course:COURSE,drillT:DRILL_T,tick:(n,dt)=>{ for(let i=0;i<(n||1);i++) stepFlight(dt||0.8); if(HASDOM) refresh(); },
  nav,vloc,cdiMode,cdiOut,screen:draw,items,setCrs:c=>{ S.crs=w360(c); courseMsg(); if(HASDOM) refresh(); },ap:(m,h)=>{ S.ap=m; if(h!=null) S.hdg=h; },progress:()=>stepIdx(),mode:m=>{ if(HASDOM) setMode(m); else MODE=m; },
  comStep,navStep,complete,P,ILS,PROC,ENDS};
if(HASDOM){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init(); }
})();
