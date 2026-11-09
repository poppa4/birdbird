/* Birdbird – gennavcore.js: the pure maths behind the General navigation lab (gennav.html).
   No DOM, no state. Loaded in the page as window.GNAV and in Node (tests/gennav.test.mjs) through vm.
   Uses NAVCORE (navcore.js) for the flat wind triangle when it is present, so both labs share one solver.
   Angles in degrees, distances in NM, speeds in kt, times in minutes unless stated.
   Variation and deviation are East-positive: magnetic = true − variation, compass = magnetic − deviation.
   Earth: a sphere of radius 10800/π ≈ 3437.7 NM, so 1 minute of arc of a great circle = 1 NM. */
(function(root){
'use strict';
const D2R=Math.PI/180, R2D=180/Math.PI, RE=10800/Math.PI;   // 1 minute of arc = 1 NM exactly
const norm=a=>{ a=a%360; if(a<0) a+=360; return a===360||Object.is(a,-0)?0:a; };
const diff=(a,b)=>{ let d=norm(a-b); if(d>180) d-=360; return d; };
const clamp=(v,lo,hi)=>v<lo?lo:v>hi?hi:v;

/* ---------- true, magnetic, compass ---------- */
const toMag=(t,varE)=>norm(t-(varE||0));
const toTrue=(m,varE)=>norm(m+(varE||0));
const toCompass=(m,devE)=>norm(m-(devE||0));
const fromCompass=(c,devE)=>norm(c+(devE||0));

/* ---------- wind triangle (exact, flat) ---------- */
/* wind components on a track: head (+ = headwind), cross (+ = wind from the right) */
function windComp(trk,wdir,wspd){ const a=(wdir-trk)*D2R; return {head:wspd*Math.cos(a),cross:wspd*Math.sin(a)}; }
/* heading for a desired track (the CRP-5 / E6B problem). wca > 0: nose right of track.
   ok = false when the crosswind is at least the TAS or the groundspeed would not be positive. */
function headingFor(tas,trk,wdir,wspd){
  const N=root.NAVCORE; if(N&&N.headingFor){ const r=N.headingFor(tas,trk,wdir,wspd); const c=windComp(trk,wdir,wspd);
    return {ok:r.ok,hdg:r.hdg,trk:norm(trk),gs:r.gs,wca:r.wca,drift:-r.wca,head:c.head,cross:c.cross}; }
  const c=windComp(trk,wdir,wspd); if(Math.abs(c.cross)>=tas) return {ok:false,hdg:norm(trk),trk:norm(trk),gs:0,wca:0,drift:0,head:c.head,cross:c.cross};
  const wca=Math.asin(c.cross/tas)*R2D, gs=tas*Math.cos(wca*D2R)-c.head;
  return {ok:gs>0,hdg:norm(trk+wca),trk:norm(trk),gs,wca,drift:-wca,head:c.head,cross:c.cross};
}
/* track and groundspeed from a heading. drift > 0: track right of heading. */
function trackFrom(tas,hdg,wdir,wspd){
  const ax=tas*Math.sin(hdg*D2R), ay=tas*Math.cos(hdg*D2R), gx=ax-wspd*Math.sin(wdir*D2R), gy=ay-wspd*Math.cos(wdir*D2R);
  const gs=Math.hypot(gx,gy), trk=gs>1e-9?norm(Math.atan2(gx,gy)*R2D):norm(hdg), drift=diff(trk,hdg), c=windComp(trk,wdir,wspd);
  return {ok:gs>1e-9,hdg:norm(hdg),trk,gs,drift,wca:-drift,head:c.head,cross:c.cross};
}
/* rule-of-thumb WCA: crosswind / TAS × 60 (the 1 in 60 rule applied to the wind) */
const wcaQuick=(cross,tas)=>tas>0?cross/tas*60:0;

/* ---------- leg: time and fuel ---------- */
const legTime=(dist,gs)=>gs>0?dist/gs*60:Infinity;          // minutes
const legFuel=(minutes,ff)=>isFinite(minutes)?minutes/60*ff:Infinity;

/* ---------- 1 in 60 ---------- */
/* off: NM off track (right +), flown: NM along the planned track, togo: NM along the planned track still to go */
function offTrack(off,flown,togo){
  const te60=flown>0?60*off/flown:0, ca60=togo>0?60*off/togo:0;
  const te=Math.atan2(off,flown)*R2D, ca=Math.atan2(off,togo)*R2D;
  return {te60,ca60,te,ca,turn60:te60+ca60,turn:te+ca};   // turn > 0 means turn LEFT when off right
}
/* off-track distance after flying `dist` NM with a track error `te` degrees: rule and exact */
const offAfter=(te,dist)=>({rule:te*dist/60,exact:Math.sin(te*D2R)*dist});

/* ---------- sphere: great circle and rhumb line ---------- */
const r=x=>x*D2R;
function gcDist(la1,lo1,la2,lo2){ const p1=r(la1),p2=r(la2),dl=r(lo2-lo1);
  const h=Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2; return 2*Math.asin(Math.min(1,Math.sqrt(h)))*RE; }
function gcTrack(la1,lo1,la2,lo2){ const p1=r(la1),p2=r(la2),dl=r(lo2-lo1);
  return norm(Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))*R2D); }
/* final great-circle track at B (direction of travel) */
const gcFinal=(la1,lo1,la2,lo2)=>norm(gcTrack(la2,lo2,la1,lo1)+180);
/* points along the great circle (n+1 points, [lat,lon] in degrees) */
function gcPoints(la1,lo1,la2,lo2,n){ const p1=r(la1),l1=r(lo1),p2=r(la2),l2=r(lo1+diff(lo2,lo1)), d=gcDist(la1,lo1,la2,lo2)/RE, out=[];
  for(let i=0;i<=n;i++){ const f=i/n; if(d<1e-12){ out.push([la1,lo1]); continue; }
    const A=Math.sin((1-f)*d)/Math.sin(d), B=Math.sin(f*d)/Math.sin(d);
    const x=A*Math.cos(p1)*Math.cos(l1)+B*Math.cos(p2)*Math.cos(l2), y=A*Math.cos(p1)*Math.sin(l1)+B*Math.cos(p2)*Math.sin(l2), z=A*Math.sin(p1)+B*Math.sin(p2);
    out.push([Math.atan2(z,Math.hypot(x,y))*R2D,Math.atan2(y,x)*R2D]); } return out; }
const psi=lat=>Math.log(Math.tan(Math.PI/4+r(lat)/2));
/* rhumb line: constant true track and its length */
function rhumb(la1,lo1,la2,lo2){ const dl=r(diff(lo2,lo1)), dp=r(la2-la1), ds=psi(la2)-psi(la1);
  const q=Math.abs(ds)>1e-12?dp/ds:Math.cos(r(la1)); return {trk:norm(Math.atan2(dl,ds)*R2D),dist:Math.hypot(dp,q*dl)*RE}; }
function rhumbPoints(la1,lo1,la2,lo2,n){ const s1=psi(la1), ds=psi(la2)-s1, dl=diff(lo2,lo1), out=[];
  for(let i=0;i<=n;i++){ const f=i/n; out.push([Math.abs(ds)<1e-12?la1+(la2-la1)*f:(2*Math.atan(Math.exp(s1+f*ds))-Math.PI/2)*R2D, lo1+f*dl]); } return out; }
/* departure along a parallel: dlong (deg) × 60 × cos lat */
const departure=(dlongDeg,lat)=>Math.abs(dlongDeg)*60*Math.cos(r(lat));
/* convergency between the meridians of A and B: the change of the great-circle track from A to B.
   exact (spherical, Napier's analogy): tan(γ/2) = sin(mean lat) · tan(dlong/2) / cos(dlat/2)
   approx (the exam formula):            γ ≈ dlong × sin(mean lat) */
function convergency(la1,lo1,la2,lo2){ const dl=diff(lo2,lo1), ml=(la1+la2)/2, dp=la2-la1;
  const exact=2*Math.atan(Math.sin(r(ml))*Math.tan(r(dl)/2)/Math.cos(r(dp)/2))*R2D, approx=dl*Math.sin(r(ml));
  return {exact,approx,conversion:approx/2}; }
/* everything about a route at once */
function route(la1,lo1,la2,lo2){ const gc=gcDist(la1,lo1,la2,lo2), ini=gcTrack(la1,lo1,la2,lo2), fin=gcFinal(la1,lo1,la2,lo2), rl=rhumb(la1,lo1,la2,lo2), cv=convergency(la1,lo1,la2,lo2);
  return {gc,rl:rl.dist,rlTrk:rl.trk,ini,fin,change:diff(fin,ini),conv:cv.exact,convApprox:cv.approx,conversion:cv.conversion,caA:diff(rl.trk,ini),dlong:diff(lo2,lo1),mlat:(la1+la2)/2}; }

/* ---------- chart projections (unit sphere; x east, y north on the chart) ---------- */
function projection(kind,o){ o=o||{}; const l0=o.lon0||0, dL=lo=>r(diff(lo,l0));
  if(kind==='merc') return {kind,f:(la,lo)=>[dL(lo),psi(clamp(la,-85,85))],k:la=>1/Math.cos(r(la)),n:0,chartConv:()=>0};
  if(kind==='polar') return {kind,f:(la,lo)=>{ const q=2*Math.tan(Math.PI/4-r(la)/2); return [q*Math.sin(dL(lo)),-q*Math.cos(dL(lo))]; },k:la=>2/(1+Math.sin(r(la))),n:1,chartConv:dl=>dl};
  if(kind==='lcc'){ const p1=r(o.s1), p2=r(o.s2), t=p=>Math.tan(Math.PI/4+p/2);
    const n=Math.abs(p1-p2)<1e-9?Math.sin(p1):Math.log(Math.cos(p1)/Math.cos(p2))/Math.log(t(p2)/t(p1)), F=Math.cos(p1)*Math.pow(t(p1),n)/n, rho=la=>F/Math.pow(t(Math.min(r(la),r(89.9))),n);
    return {kind,n,s1:o.s1,s2:o.s2,f:(la,lo)=>{ const q=rho(la), th=n*dL(lo); return [q*Math.sin(th),-q*Math.cos(th)]; },k:la=>n*rho(la)/Math.cos(r(la)),chartConv:dl=>n*dl}; }
  /* orthographic globe centred on lat0/lon0: [x,y,visible] */
  const pc=r(o.lat0||0);
  return {kind:'globe',f:(la,lo)=>{ const p=r(la), l=dL(lo), cc=Math.sin(pc)*Math.sin(p)+Math.cos(pc)*Math.cos(p)*Math.cos(l);
    return [Math.cos(p)*Math.sin(l),Math.cos(pc)*Math.sin(p)-Math.sin(pc)*Math.cos(p)*Math.cos(l),cc>=0]; },k:()=>1,n:null,chartConv:null}; }
/* standard parallels for a Lambert chart covering lat a..b (one sixth in from each edge) */
function lccParallels(a,b){ const lo=Math.min(a,b), hi=Math.max(a,b), span=hi-lo, m=(lo+hi)/2; let s1,s2;
  if(span<6){ s1=m-3; s2=m+3; } else { s1=lo+span/6; s2=hi-span/6; } s1=clamp(s1,2,82); s2=clamp(s2,s1+0.5,84); return [s1,s2]; }

/* ---------- PET and PNR ---------- */
/* PET (critical point) from A: D × H / (O + H), O and H the groundspeeds on and home at the TAS for the failure case.
   Time to PET is flown at the normal cruise groundspeed (gsOut). */
function pet(D,O,H,gsOut){ const d=O+H>0?D*H/(O+H):NaN; return {dist:d,tAfter:d/H*60,tTo:gsOut>0?d/gsOut*60:NaN}; }
/* PNR (point of safe return): E safe endurance in hours, O and H normal groundspeeds out and home.
   T = E × H / (O + H) (hours), distance = T × O. */
function pnr(E,O,H){ const t=O+H>0?E*H/(O+H):NaN; return {t:t*60,dist:t*O}; }

/* ---------- Mach and TAS ---------- */
function isaTemp(ft){ return ft<=36089?15-0.0019812*ft:-56.5; }
const speedOfSound=tC=>38.967854*Math.sqrt(tC+273.15);   // kt
const machToTas=(m,tC)=>m*speedOfSound(tC);

/* ---------- time ---------- */
const arcToTime=lonDeg=>lonDeg*4;                         // minutes, east +
const lmtFromUtc=(utcH,lonDeg)=>((utcH+lonDeg/15)%24+24)%24;

root.GNAV={RE,norm,diff,clamp,toMag,toTrue,toCompass,fromCompass,windComp,headingFor,trackFrom,wcaQuick,legTime,legFuel,offTrack,offAfter,
  gcDist,gcTrack,gcFinal,gcPoints,rhumb,rhumbPoints,departure,convergency,route,projection,lccParallels,pet,pnr,isaTemp,speedOfSound,machToTas,arcToTime,lmtFromUtc};
})(typeof window!=='undefined'?window:globalThis);
