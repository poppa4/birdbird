/* Birdbird – gyrocore.js: the pure maths behind the Attitude and heading lab (gyros.html).
   No DOM, no state. Loaded in the page as window.GYC and in Node (tests/gyros.test.mjs) through vm.
   Angles in degrees, headings 0–360 clockwise from north, latitude north positive, speeds in kt, rates in °/h unless stated. */
(function(root){
'use strict';
const R=Math.PI/180, G=9.80665, KT=0.514444;
const OMEGA=15.041;                 // earth rotation, °/h (one sidereal day)
const REARTH=6371000;               // m
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const norm=a=>((a%360)+360)%360;
const wrap=a=>((a%360)+540)%360-180;   // −180 … 180

/* ---------- the magnetic compass ---------- */
/* dip (inclination) of a dipole field at magnetic latitude lat: tan I = 2 tan lat (north positive, field points down in the north) */
const dip=lat=>Math.atan(2*Math.tan(clamp(lat,-89.9,89.9)*R))/R;
/* true → magnetic → compass. Variation and deviation east positive: subtract east, add west */
const magFromTrue=(th,vari)=>norm(th-vari);
const compFromMag=(mh,dev)=>norm(mh-dev);
const trueFromComp=(ch,dev,vari)=>norm(ch+dev+vari);
/* deviation from the aircraft's own magnetism, coefficients B (sin) and C (cos) and a constant A */
const deviation=(mh,B,C,A)=>(A||0)+(B||0)*Math.sin(mh*R)+(C||0)*Math.cos(mh*R);
/* The pendulous magnet system. The centre of gravity hangs on the equator side of the pivot so that its weight balances the
   vertical field Z. Under a horizontal acceleration a the magnet lines up with H·north + (Z/g)·a (derived from the potential
   −M·u·(H n + Z a / g)), so its north end swings towards the acceleration by
     ψ = atan2(k sin β, 1 + k cos β),  k = (a/g)·tan(dip),
   β the direction of the acceleration from magnetic north. The card follows the magnet, so the compass reads mh − ψ.
   Southern hemisphere: dip and k are negative and every error reverses. kmax limits the card tilt (the card hits its stops). */
function swing(k,beta,kmax){ const kk=kmax==null?k:clamp(k,-kmax,kmax); return Math.atan2(kk*Math.sin(beta*R),1+kk*Math.cos(beta*R))/R; }
const kOf=(acc,lat)=>acc/G*Math.tan(dip(lat)*R);
/* acceleration from a speed change (kt per second) and from a coordinated turn at a bank angle */
const accLinear=ktps=>ktps*KT;
const accTurn=bank=>G*Math.tan(Math.abs(bank)*R);
/* direction of the acceleration: speeding up → along the heading, slowing → opposite, turning → towards the turn centre */
function accDir(mh,man){ return man==='acc'?mh: man==='dec'?mh+180: man==='tr'?mh+90: man==='tl'?mh-90: 0; }
/* what the compass shows (no deviation) for a manoeuvre at magnetic heading mh. o: {man, lat, ktps, bank, kmax} */
function compassReads(mh,o){ if(!o||o.man==='steady'||!o.man) return norm(mh);
  const a=o.man==='acc'||o.man==='dec'?accLinear(o.ktps||0):accTurn(o.bank||0);
  return norm(mh-swing(kOf(a,o.lat),accDir(mh,o.man),o.kmax)); }
/* compass error = reading − real heading (−180 … 180) */
const compassErr=(mh,o)=>wrap(compassReads(mh,o)-mh);

/* ---------- turns ---------- */
const turnRate=(tas,bank)=>G*Math.tan(bank*R)/(tas*KT)/R;               // °/s
const bankFor=(tas,rate)=>Math.atan(tas*KT*rate*R/G)/R;                   // ° for a rate in °/s
const rateOneBank=tas=>bankFor(tas,3);
const rateOneThumb=tas=>tas/10+7;
const turnRadiusNm=(tas,bank)=>(tas*KT)**2/(G*Math.tan(bank*R))/1852;

/* ---------- gyroscopes ---------- */
/* angular momentum H = I ω (kg m²/s); rpm → rad/s */
const angMom=(I,rpm)=>I*rpm*2*Math.PI/60;
/* precession rate (rad/s) from a torque (N m) */
const precRate=(torque,H)=>H>0?torque/H:Infinity;
/* the rule of precession: a push at rim angle θ acts 90° further on in the direction of rotation (dir +1 or −1) */
const effectAt=(theta,dir)=>norm(theta+90*(dir<0?-1:1));
/* 3-D precession step: spin axis n (unit vector), push F (vector) at rim point r, angular momentum H, dt. Returns the new n. */
function precess(n,r,F,H,dt){ const t=[r[1]*F[2]-r[2]*F[1],r[2]*F[0]-r[0]*F[2],r[0]*F[1]-r[1]*F[0]];
  const m=[n[0]*H+t[0]*dt,n[1]*H+t[1]*dt,n[2]*H+t[2]*dt], l=Math.hypot(...m); return m.map(v=>v/l); }

/* ---------- directional gyro drift (change of the reading, °/h; positive = reading increases) ---------- */
const earthRate=lat=>OMEGA*Math.sin(lat*R);                               // vertical component: the apparent drift
const earthRateH=lat=>OMEGA*Math.cos(lat*R);                              // horizontal component: what an IRS uses to find north
const transportWander=(vEast,lat)=>vEast/60*Math.tan(clamp(lat,-89,89)*R);  // convergency of the meridians, east positive
const latNut=latSet=>latSet==null?0:OMEGA*Math.sin(latSet*R);              // fixed correcting precession
/* reading drift: earth rate and easterly transport wander make the reading fall in the northern hemisphere */
const diDrift=(lat,vEast,latSet,real)=>-(earthRate(lat)+transportWander(vEast,lat))+latNut(latSet)+(real||0);

/* ---------- inertial reference ---------- */
/* latitude from the measured earth-rate components (gyrocompassing) */
const latFromRates=(wv,wh)=>Math.atan2(wv,wh)/R;
/* Schuler period: a pendulum as long as the earth's radius, 2π√(R/g), minutes */
const schulerMin=()=>2*Math.PI*Math.sqrt(REARTH/G)/60;
/* typical alignment time (min): about 9 at the equator, about 17 at 78°; no alignment beyond ALIGN_MAX (typical figures) */
const ALIGN_MAX=78;
const alignMin=lat=>Math.abs(lat)>ALIGN_MAX?Infinity:5+4/Math.pow(Math.cos(Math.abs(lat)*R),0.7);
/* typical free-inertial position error (NM): linear drift plus the Schuler oscillation */
const inertialErr=(hours,rate,amp)=>Math.max(0,rate*hours+(amp==null?0.3*rate:amp)*Math.sin(2*Math.PI*hours*60/schulerMin()));

root.GYC={R,G,OMEGA,norm,wrap,clamp,dip,magFromTrue,compFromMag,trueFromComp,deviation,swing,kOf,accLinear,accTurn,accDir,compassReads,compassErr,
  turnRate,bankFor,rateOneBank,rateOneThumb,turnRadiusNm,angMom,precRate,effectAt,precess,earthRate,earthRateH,transportWander,latNut,diDrift,
  latFromRates,schulerMin,ALIGN_MAX,alignMin,inertialErr};
})(typeof window!=='undefined'?window:globalThis);
