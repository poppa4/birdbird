/* Birdbird – holdcore.js: pure maths for the holding and instrument approach lab (holding.html).
   Builds on navcore.js (NAVCORE): same frame (x east, y north in NM, true angles, degrees), no DOM, no state.
   Loaded in the page as window.HOLDCORE and in Node (tests/holdcore.test.mjs) through vm, after navcore.js.
   Sources: ICAO Doc 8168 (PANS-OPS) Vol I for holding entries, timing, speeds and bank; ICAO Annex 6 for
   2D/3D, Type A/B and CAT I/II/III. Training model, not for navigation. */
(function(root){
'use strict';
const N=root.NAVCORE;
const D2R=Math.PI/180, FT_NM=N.K.FT_NM;
const norm=N.norm, diff=N.diff, clamp=N.clamp;

/* ---------- holding: rules ---------- */
/* still-air outbound time (s): 1 min at or below 14 000 ft, 1.5 min above */
const legSec=altFt=>altFt<=14000?60:90;
/* maximum holding IAS (PANS-OPS). o.turb: turbulence speeds (280 kt / M0.8, only with ATC clearance unless published);
   o.catAB: a hold limited to Cat A and B aircraft (170 kt up to 14 000 ft). Returns {kt, mach} (one of them null). */
function holdSpeed(altFt,o){ o=o||{};
  if(altFt<=14000) return {kt:o.catAB?170:(o.turb?280:230),mach:null};
  if(altFt<=20000) return {kt:o.turb?280:240,mach:null};
  if(altFt<=34000) return o.turb?{kt:280,mach:0.8}:{kt:265,mach:null};
  return {kt:null,mach:0.83}; }

/* entry with the 5° flexibility: alt is the neighbouring entry when within 5° of a sector boundary.
   rel (from NAVCORE.holdEntry) = heading measured from the outbound course towards the non-holding side:
   0–70 offset (teardrop), 70–250 direct, 250–360 parallel. */
function entry(inb,dir,hdg){ const e=N.holdEntry(inb,dir,hdg), r=e.rel; let alt=null;
  if(Math.abs(r-70)<=5) alt= e.entry==='teardrop'?'direct':'teardrop';
  else if(Math.abs(r-250)<=5) alt= e.entry==='direct'?'parallel':'direct';
  else if(r<=5||r>=355) alt= e.entry==='teardrop'?'parallel':'teardrop';
  return {entry:e.entry,rel:r,alt}; }
/* the entry for an aircraft arriving from true bearing b (seen from the fix): heading = b + 180 */
const entryFrom=(inb,dir,b)=>entry(inb,dir,norm(b+180));

/* wind in the hold. Inbound: the normal drift correction (wca, + = heading right of track).
   Outbound: three times the inbound correction, the other way (it also covers the drift in the two turns).
   Outbound time: so that the inbound leg takes legS seconds, counting the along-track drift during the two
   180° turns and starting the clock over or abeam the fix, whichever is later. Also the rule of thumb
   (1 s per kt of along-track wind for a 1-min leg, 1.5 s for 1.5 min). */
function holdWind(inb,tas,wdir,wspd,legS){
  const hin=N.headingFor(tas,inb,wdir,wspd), hout=N.headingFor(tas,norm(inb+180),wdir,wspd);
  const wca=hin.ok?hin.wca:0, gsIn=hin.ok?hin.gs:tas, gsOut=hout.ok?hout.gs:tas;
  const T=180/N.turnRate(tas), wa=-N.windComp(inb,wdir,wspd).head;   /* wa + = tailwind on the inbound leg */
  const startAlong=Math.min(wa*T,0);                                   /* where the clock starts (kt·s) */
  const hdgOut=norm(inb+180-3*wca), g=N.windTriangle(tas,hdgOut,wdir,wspd);
  const along=-(g.vx*Math.sin(inb*D2R)+g.vy*Math.cos(inb*D2R));      /* ground speed along the outbound course */
  const tOut=clamp((gsIn*legS+startAlong+wa*T)/Math.max(20,along),10,legS*3);
  const tRule=clamp(legS+wa*legS/60,10,legS*3);                        /* outbound headwind (= inbound tailwind) → longer */
  return {wca,hdgIn:norm(inb+wca),hdgOut,gsIn,gsOut,tOut,tRule,wa,turnS:T,ok:hin.ok&&hout.ok}; }
/* racetrack geometry (still air) for drawing: radius and leg length in NM */
function racetrack(tas,legS){ return {R:N.turnRadius(tas),leg:tas/3600*legS}; }

/* ---------- holding: a flown path ----------
   o = {fix:{x,y}, inb (true), dir (+1 right, -1 left), tas, wdir, wspd, legS, start:{x,y,hdg} or arrive:{hdg,dist},
        entry (optional: force one of the two entries allowed by the 5° flexibility), laps (after the entry), dt}
   The aircraft tracks to the fix, flies the ICAO entry (direct, offset 30°, parallel), then the hold with
   wind correction (×3 outbound, adjusted outbound time). Turns: rate one, max 25° bank.
   Returns arrays t, x, y, h (true heading), ph (phase index into PH), and per-lap inbound times. */
const PH=['tofix','e_out','e_turn','e_back','turnOut','outbound','turnIn','inbound','done'];
function flyHold(o){
  const dt=o.dt||0.5, tas=o.tas, I=o.inb, d=o.dir, legS=o.legS, f=o.fix, W=holdWind(I,tas,o.wdir,o.wspd,legS);
  const rate=N.turnRate(tas), u=[Math.sin(I*D2R),Math.cos(I*D2R)];
  const hfor=t=>{ const h=N.headingFor(tas,t,o.wdir,o.wspd); return h.ok?h.hdg:t; };
  let x,y,h,arrH;
  if(o.start){ x=o.start.x; y=o.start.y; h=o.start.hdg; arrH=o.start.hdg; }
  else { arrH=o.arrive.hdg; const b=norm(arrH+180)*D2R; x=f.x+Math.sin(b)*o.arrive.dist; y=f.y+Math.cos(b)*o.arrive.dist; h=hfor(arrH); }
  let en=o.entry||entry(I,d,arrH).entry;
  const out={t:[],x:[],y:[],h:[],ph:[],entry:en,arrH,W,legIn:[],lapT:[]};
  let ph=0, t=0, tm=0, clk=false, laps=0, inT0=-1, rec=false;
  const along=()=>(x-f.x)*u[0]+(y-f.y)*u[1], xt=()=>(x-f.x)*u[1]-(y-f.y)*u[0];  /* along + = past the fix; xt + = right of the inbound course */
  const turn=(want,dir)=>{ const r=rate*dt; let e=diff(want,h); if(dir>0&&e<-1) e+=360; if(dir<0&&e>1) e-=360;
    if(Math.abs(e)<=r){ h=norm(want); return true; } h=norm(h+Math.sign(e)*r); return false; };
  const inTrack=()=>hfor(norm(I-clamp(xt()*60,-40,40)));
  const maxT=o.tMax||(600+(o.laps||2)*(4*legS+240));
  let prevAlong=along(), offH=0, entryDir=0;
  for(let k=0;k<1e6&&t<=maxT;k++){
    out.t.push(t); out.x.push(x); out.y.push(y); out.h.push(h); out.ph.push(ph);
    if(PH[ph]==='done') break;
    const a=along(), dist=Math.hypot(x-f.x,y-f.y);
    switch(PH[ph]){
      case 'tofix': { const b=N.bearing(f.x-x,f.y-y), want=dist>0.3?hfor(b):h; turn(want,o.turnDir&&Math.abs(diff(want,h))>90?o.turnDir:0);
        if(dist<0.08||(dist<0.6&&Math.abs(diff(N.bearing(f.x-x,f.y-y),h))>90)){
          if(o.start&&!o.entry){ en=entry(I,d,h).entry; out.entry=en; }   /* flown from a start point: the heading at the fix decides */
          tm=0; if(en==='direct'){ ph=PH.indexOf('turnOut'); clk=false; }
          else { ph=1; offH= en==='teardrop'? hfor(norm(I+180-d*30)) : hfor(norm(I+180));
            const e=diff(offH,h); entryDir= Math.abs(e)<1?0: (Math.abs(Math.abs(e)-180)<15? -d : Math.sign(e)); } }
        break; }
      case 'e_out': { const done=turn(offH,entryDir); tm+=dt; if(done&&tm>=legS){ ph=2; } break; }
      case 'e_turn': { /* offset: turn in the hold direction onto the inbound course; parallel: turn towards the holding side
           (against the hold direction) through more than 180°, then fly back to the fix */
        if(en==='teardrop'){ if(turn(hfor(I),d)){ ph=PH.indexOf('inbound'); rec=false; } }
        else { if(turn(hfor(norm(I-d*30)),-d)) ph=3; }
        break; }
      case 'e_back': { const b=N.bearing(f.x-x,f.y-y); turn(hfor(b),0); if(a>=0&&prevAlong<0){ ph=PH.indexOf('turnOut'); clk=false; laps++; out.lapT.push(t); } break; }
      case 'turnOut': { if(turn(W.hdgOut,d)){ ph=5; tm=0; clk=a<=0; } break; }
      case 'outbound': { turn(W.hdgOut,0); if(!clk&&a<=0) clk=true; if(clk) tm+=dt; if(clk&&tm>=W.tOut) ph=6; break; }
      case 'turnIn': { if(turn(W.hdgIn,d)){ ph=7; inT0=t; rec=true; } break; }
      case 'inbound': { turn(inTrack(),0);
        if(a>=0&&prevAlong<0){ if(rec) out.legIn.push(t-inT0); laps++; out.lapT.push(t); ph= laps>(o.laps??2)? 8 : 4; } break; }
    }
    const w=N.windTriangle(tas,h,o.wdir,o.wspd); x+=w.vx*dt/3600; y+=w.vy*dt/3600; t+=dt; prevAlong=a;
  }
  out.n=out.t.length; return out; }

/* ---------- approach ---------- */
/* height lost per NM on a path angle, rate of descent (exact and the ×5 rule), climb on a gradient */
const ftPerNm=ang=>Math.tan((ang??3)*D2R)*FT_NM;
const rod=(gsKt,ang)=>gsKt*ftPerNm(ang)/60;
const rodRule=gsKt=>gsKt*5;
const climbFtNm=pct=>pct/100*FT_NM;
const climbFpm=(gsKt,pct)=>gsKt*climbFtNm(pct)/60;
/* altitude on the glide path at dNm from the threshold (the path origin, the GP antenna abeam point, lies gpo NM past it) */
const pathAlt=(dNm,elev,ang,gpo)=>(elev||0)+Math.tan((ang??3)*D2R)*(dNm+(gpo??0.16))*FT_NM;
/* distance from the threshold where a level altitude meets the path */
const pathDist=(alt,elev,ang,gpo)=>(alt-(elev||0))/ftPerNm(ang)-(gpo??0.16);
/* ICAO Annex 6: 3D with vertical guidance (decision altitude), 2D lateral only (minimum descent altitude);
   Type A: minimum (MDH or DH) at or above 250 ft; Type B: DH below 250 ft (CAT I, II, III) */
function classify(minFt,vertical){ return {dim:vertical?'3D':'2D',type:minFt>=250?'A':'B',minima:vertical?'DA/H':'MDA/H'}; }
/* precision approach category from the decision height (ft) */
const ilsCat=dh=>dh>=200?'CAT I':dh>=100?'CAT II':'CAT III';
/* derived decision altitude for a CDFA: MDA plus the operator's add-on (if any), so the go-around
   that starts there does not take the aircraft below the MDA */
const dda=(mda,addOn)=>mda+(addOn||0);

root.HOLDCORE={legSec,holdSpeed,entry,entryFrom,holdWind,racetrack,flyHold,PH,ftPerNm,rod,rodRule,climbFtNm,climbFpm,pathAlt,pathDist,classify,ilsCat,dda};
})(typeof window!=='undefined'?window:globalThis);
