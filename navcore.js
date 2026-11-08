/* Birdbird – navcore.js: the pure geometry engine behind the radio navigation simulator.
   No DOM, no state. Loaded in the page as window.NAVCORE and in Node (tests/navcore.test.mjs) through vm.
   Frame: a flat local projection around the area's reference point, x east and y north in NM, true north up.
   Angles in degrees. Variation is East-positive: magnetic = true − variation.
   Needle convention for every course deviation indicator: dev > 0 means the needle is right of centre,
   so the selected course lies to the right ("fly towards the needle" when heading roughly along the course).
   Glide slope: dev > 0 means the aircraft is above the path, so the needle is below centre (fly down). */
(function(root){
'use strict';
const R2D=180/Math.PI, D2R=Math.PI/180, FT_NM=6076.12;
const VOR_FS=10, VOR_DOT=2, LOC_FS=2.5, LOC_DOT=0.5, GS_FS=0.7, GS_DOT=0.14, AMB=2;

/* ---------- angles ---------- */
const norm=a=>{ a=a%360; if(a<0) a+=360; return a===360||Object.is(a,-0)?0:a; };
/* three-digit compass text, 0 → 360 */
const d3=a=>{ const v=Math.round(norm(a))%360; return String(v===0?360:v).padStart(3,'0'); };
/* signed difference a − b in (−180, 180] */
const diff=(a,b)=>{ let d=norm(a-b); if(d>180) d-=360; return d; };
const clamp=(v,lo,hi)=>v<lo?lo:v>hi?hi:v;
/* true bearing of a vector (east, north) */
const bearing=(dx,dy)=>norm(Math.atan2(dx,dy)*R2D);
const dist=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const toMag=(t,v)=>norm(t-(v||0));
const toTrue=(m,v)=>norm(m+(v||0));

/* flat local projection (equirectangular around lat0/lon0), NM */
function proj(lat,lon,lat0,lon0){ return {x:(lon-lon0)*60*Math.cos(lat0*D2R), y:(lat-lat0)*60}; }

/* ---------- bearings to and from a station ---------- */
/* true bearing from the station to the aircraft */
const brgFrom=(st,ac)=>bearing(ac.x-st.x,ac.y-st.y);
/* magnetic radial the aircraft is on (VOR radials use the station's declination) */
const radial=(st,ac)=>toMag(brgFrom(st,ac),st.var);
/* magnetic bearing to the station (QDM) */
const qdm=(st,ac)=>norm(radial(st,ac)+180);

/* line-of-sight range in NM for heights in feet (1.23 × (√h1 + √h2)) */
const losRange=(hAc,hSt)=>1.23*(Math.sqrt(Math.max(0,hAc))+Math.sqrt(Math.max(0,hSt||0)));

/* DME: ground distance and slant range (height difference from altitude and station elevation) */
function dme(st,ac,altFt){ const g=dist(st,ac), h=Math.max(0,(altFt||0)-(st.elev||0))/FT_NM; return {ground:g,slant:Math.hypot(g,h),h}; }
/* rate of closure on a DME (kt, + = closing), from the ground velocity (vx, vy in kt) */
function dmeRate(st,ac,vx,vy,altFt){ const dx=ac.x-st.x, dy=ac.y-st.y, s=dme(st,ac,altFt).slant; if(s<1e-9) return 0; return -(dx*vx+dy*vy)/s; }

/* VOR receiver with an OBS.
   flag: 'TO' | 'FROM' | 'OFF'. OFF when abeam (course within AMB° of 90° from the bearing), in the cone of
   confusion (inside the cone of half-angle `cone`° over the station) or beyond line of sight when opt.los is set.
   dev = signed angle between the selected course and the aircraft's position (deg), dots = needle dots (2° each, ±5). */
function vor(st,ac,obs,opt){
  opt=opt||{}; const R=radial(st,ac), Q=norm(R+180), D=dme(st,ac,opt.alt);
  const off=diff(obs,Q), to=Math.abs(off)<90;
  let dev= to? diff(Q,obs) : diff(obs,R);
  let flag= to?'TO':'FROM', why='';
  if(Math.abs(Math.abs(off)-90)<=AMB){ flag='OFF'; why='abeam'; }
  const cone=opt.cone===undefined?45:opt.cone;
  if(cone>0 && D.ground<=D.h*Math.tan(cone*D2R)){ flag='OFF'; why='cone'; }
  if(D.ground<1e-6){ flag='OFF'; why='cone'; dev=0; }
  if(opt.los && D.slant>losRange(opt.alt,st.elev)){ flag='OFF'; why='range'; }
  return {radial:R,qdm:Q,to,flag,why,dev,dots:clamp(dev/VOR_DOT,-5,5),fs:Math.abs(dev)>=VOR_FS,dist:D.ground,slant:D.slant};
}

/* ILS. ils = {x,y: localiser antenna, crs: true inbound course, gp:{x,y} glide path antenna, gpa: glide angle, elev: threshold elevation ft}.
   Localiser: angle off the centreline seen from the antenna. Behind the antenna (back course) the
   needle keeps the front-course sense, so flying the back course inbound it reads reversed (back:true). */
function loc(ils,ac){
  const b=bearing(ac.x-ils.x,ac.y-ils.y), d=Math.hypot(ac.x-ils.x,ac.y-ils.y);
  const phi=diff(b,ils.crs+180);              /* front: angle from the approach centreline (+ = clockwise) */
  const back=Math.abs(phi)>90;
  /* lateral position seen along the front course: + = right of the centreline */
  const s=Math.sin(D2R*(ils.crs+90)), c=Math.cos(D2R*(ils.crs+90)); const lat=(ac.x-ils.x)*s+(ac.y-ils.y)*c;
  const ang= back? Math.abs(diff(b,ils.crs)) : Math.abs(phi);   /* angular offset from the (extended) centreline */
  const dev= lat>0? -ang : lat<0? ang : 0;       /* right of the front centreline → needle left */
  const valid= d>0.05 && ((ang<=10&&d<=25)||(ang<=35&&d<=17));
  return {dev,dots:clamp(dev/LOC_DOT,-5,5),back,valid,lat,dist:d};
}
/* glide slope: elevation angle of the aircraft seen from the GP antenna */
function gs(ils,ac,altFt){
  const d=Math.hypot(ac.x-ils.gp.x,ac.y-ils.gp.y), h=(altFt||0)-(ils.elev||0);
  const ang=Math.atan2(h,d*FT_NM)*R2D, dev=ang-(ils.gpa||3);
  const lc=loc(ils,ac), valid=!lc.back && Math.abs(lc.dev)<=8 && d<=10 && d>0.02 && h>0;
  return {angle:ang,dev,dots:clamp(-dev/GS_DOT,-5,5),valid,dist:d,h,pathFt:(ils.elev||0)+Math.tan((ils.gpa||3)*D2R)*d*FT_NM};
}

/* ADF / RMI */
const relBearing=(trueBrgToStation,trueHdg)=>norm(trueBrgToStation-trueHdg);
function adf(st,ac,trueHdg){ return relBearing(bearing(st.x-ac.x,st.y-ac.y),trueHdg); }
/* magnetic bearing to the station from the needle: MB = MH + RB */
const mbFrom=(mh,rb)=>norm(mh+rb);
/* HSI geometry: course pointer angle on the face (relative to the lubber line) and the bar */
function hsi(mh,obs,v){ return {crsRel:diff(obs,mh),dev:v.dev,dots:v.dots,flag:v.flag}; }

/* ---------- wind ---------- */
/* heading (true) + wind → track, ground speed, drift (+ = drift right of heading) */
function windTriangle(tas,hdg,wdir,wspd){
  const ax=tas*Math.sin(hdg*D2R), ay=tas*Math.cos(hdg*D2R), wx=-wspd*Math.sin(wdir*D2R), wy=-wspd*Math.cos(wdir*D2R);
  const gx=ax+wx, gy=ay+wy, gsp=Math.hypot(gx,gy), trk=gsp>1e-9?bearing(gx,gy):hdg;
  return {trk,gs:gsp,drift:diff(trk,hdg),vx:gx,vy:gy};
}
/* wind components on a track: head (+ = headwind), cross (+ = from the right) */
function windComp(trk,wdir,wspd){ const a=(wdir-trk)*D2R; return {head:wspd*Math.cos(a),cross:wspd*Math.sin(a)}; }
/* heading to make good a track: wca (+ = heading right of track), ok = false if the wind is too strong */
function headingFor(tas,trk,wdir,wspd){
  const c=windComp(trk,wdir,wspd); if(Math.abs(c.cross)>=tas) return {ok:false,hdg:trk,wca:0,gs:0};
  const wca=Math.asin(c.cross/tas)*R2D, gsp=tas*Math.cos(wca*D2R)-c.head;
  return {ok:gsp>0,hdg:norm(trk+wca),wca,gs:gsp};
}
/* time in minutes */
const timeTo=(dNm,gsKt)=>gsKt>0?dNm/gsKt*60:Infinity;
/* time to station from a bearing change abeam: minutes = seconds / degrees */
const tsBearing=(sec,deg)=>deg>0?sec/deg:Infinity;
/* 1 in 60: track error (deg) from distance off (NM) after distance flown (NM) */
const oneIn60=(off,along)=>along>0?60*off/along:0;

/* ---------- holding ---------- */
/* ICAO entry for a hold with inbound course `inb` (same reference as hdg), turns dir (+1 right, −1 left),
   aircraft heading to the fix `hdg`. rel = heading measured from the outbound course towards the non-holding side.
   Sector 1 parallel (110°), sector 2 teardrop/offset (70°), sector 3 direct (180°). near = within 5° of a boundary. */
function holdEntry(inb,dir,hdg){
  const out=norm(inb+180), rel= dir>0? norm(out-hdg) : norm(hdg-out);
  const e= rel<70? 'teardrop' : rel>=250? 'parallel' : 'direct';
  const dB=x=>Math.abs(diff(rel,x));
  const near=Math.min(dB(70),dB(250),dB(0))<=5;
  return {entry:e,rel,near};
}
/* still-air rate-one turn limited to 25° bank: deg/s */
const turnRate=tas=>Math.min(3,1091*Math.tan(25*D2R)/Math.max(1,tas));
const turnRadius=(tas,rate)=>tas/3600/((rate||turnRate(tas))*D2R);

root.NAVCORE={norm,d3,diff,clamp,bearing,dist,toMag,toTrue,proj,brgFrom,radial,qdm,losRange,dme,dmeRate,vor,loc,gs,relBearing,adf,mbFrom,hsi,
  windTriangle,windComp,headingFor,timeTo,tsBearing,oneIn60,holdEntry,turnRate,turnRadius,
  K:{FT_NM,VOR_FS,VOR_DOT,LOC_FS,LOC_DOT,GS_FS,GS_DOT,AMB}};
})(typeof window!=='undefined'?window:globalThis);
