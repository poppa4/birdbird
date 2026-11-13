/* Birdbird – navsim.js: the radio navigation simulator (plan view, profile, instrument panel, controls, guide).
   Geometry comes from navcore.js (NAVCORE), the gauges from navgauges.js (NAVG), the plan-view map (relief, symbols, labels,
   scale) from navmap.js (NAVMAP), the lessons, practice tasks,
   scenarios and the "Why?" sentences from navlessons.js (NAVLESSONS). Strings are EN/NO through LAB.L.
   Model: flat local projection around the area's main VOR, one magnetic variation for the whole area,
   a rate-one turn (max 25° bank), constant TAS, no instrument errors except DME slant range, the VOR cone of
   confusion and line-of-sight range. Training simulation, not for navigation. */
(function(){
'use strict';
const N=window.NAVCORE, {L,el,nf}=LAB;
const t2=(en,no)=>({en,no});
const D2R=Math.PI/180, TAU=Math.PI*2;
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const d3=N.d3, norm=N.norm, diff=N.diff, clamp=N.clamp;
const FM='"IBM Plex Mono", ui-monospace, monospace', FB='"Public Sans", system-ui, sans-serif', FD='Archivo, "Public Sans", sans-serif';
const NM_=window.NAVMAP, COL=Object.assign({},NM_.COL,{crs:'#F06BB4',to:'rgba(90,160,240,.10)',from:'rgba(99,217,160,.09)',adf:'#F5BC4C',trace:'240,107,180',air:'#E6EBEF',gnd:'#63D9A0'});

/* ---------- navaids and coastline: navmap.js (NAVMAP.REGIONS) ---------- */
const AREAS=NM_.REGIONS;

/* ---------- state ---------- */
const S={area:'bergen',ac:{x:0,y:0,th:90,alt:4000,tas:120,vs:0},sel:{hdg:90,trk:90,alt:4000,vs:1000},ap:'HDG',nav1:'FLS',obs:90,adf:'ASK',adfMov:false,adfCard:0,
  wind:{dir:270,spd:0},varE:0,run:false,speed:1,t:0,
  view:{north:true,range:20,profile:false,trace:true,course:true,tofrom:false,rings:true,labels:true,sectors:false,tri:false,brg:true,hideMap:false,hideAns:false,centre:'st'},
  hold:{fix:'st',rad:180,dme:10,inb:360,dir:1,leg:1},mode:'learn',guide:true};
const HOLD0=Object.assign({},S.hold);
let ST={}, NAV=[], ILS=[], APT=[];
function buildArea(){ const B=NM_.build(S.area,S.varE); ST=B.ST; NAV=B.NAV; ILS=B.ILS; APT=B.APT; map.setRegion(S.area);
  if(!ST[S.nav1]||ST[S.nav1].type==='NDB') S.nav1=NAV.find(n=>n.type==='VOR').id;
  if(!ST[S.adf]||ST[S.adf].type!=='NDB') S.adf=NAV.find(n=>n.type==='NDB').id;
  bgDirty=true; }
function setVar(v){ S.varE=v; NAV.forEach(n=>n.var=v); }
const nav1=()=>ST[S.nav1], adfSt=()=>ST[S.adf], isILS=()=>nav1()&&nav1().type==='ILS';
/* the VOR/DME used for position fields: NAV1 if it is a VOR, else the area's main VOR */
const refVor=()=>{ const n=nav1(); return n&&n.type==='VOR'?n:NAV.find(x=>x.type==='VOR'); };
const mh=()=>N.toMag(S.ac.th,S.varE);

/* ---------- derived values (one reused object) ---------- */
const D={rad:0,qdm:0,flag:'OFF',why:'',dev:0,dots:0,hsiDots:0,dist:0,slant:0,dmeGs:0,dmeMin:Infinity,dmeOk:false,rb:0,qdmA:0,adfOk:true,mh:0,trk:0,gs:0,drift:0,
  ils:false,locDev:0,locDots:0,locOk:false,back:false,lat:0,gsDev:0,gsDots:0,gsOk:false,thrDist:0,vorOk:true,wca:0,ias:0,rate:0,bank:0,pitch:0,holdEntry:'',vorQdm:0,crsSide:0};
function derive(){
  const a=S.ac, n=nav1(), v=refVor();
  D.mh=mh(); const w=N.windTriangle(a.tas,a.th,S.wind.dir,S.wind.spd); D.trk=N.toMag(w.trk,S.varE); D.gs=w.gs; D.drift=w.drift; D.vx=w.vx; D.vy=w.vy;
  D.ils=n.type==='ILS';
  const vr=N.vor(D.ils?v:n,a,S.obs,{alt:a.alt,los:true});
  D.rad=vr.radial; D.qdm=vr.qdm; D.vorQdm=vr.qdm; D.vorOk=vr.flag!=='OFF'||vr.why==='abeam';
  if(D.ils){ const lc=N.loc(n,a), g=N.gs(n,a,a.alt); D.locDev=lc.dev; D.locDots=lc.dots; D.locOk=lc.valid; D.back=lc.back; D.lat=lc.lat;
    D.gsDev=g.dev; D.gsDots=g.dots; D.gsOk=g.valid; D.thrDist=N.dist(a,n.thr); D.pathFt=g.pathFt;
    D.flag=lc.valid?'TO':'OFF'; D.why=lc.valid?'':'range'; D.dev=lc.dev; D.dots=lc.dots; D.hsiDots=clamp(lc.dev/1.25,-2.5,2.5); }
  else { D.flag=vr.flag; D.why=vr.why; D.dev=vr.dev; D.dots=vr.dots; D.hsiDots=clamp(vr.dev/5,-2.5,2.5); D.gsOk=false; }
  /* DME is co-located with the VOR (for the ILS: the area VOR/DME) */
  const ds=D.ils?v:n, dm=N.dme(ds,a,a.alt); D.dist=dm.ground; D.slant=dm.slant; D.dmeOk=dm.slant<=N.losRange(a.alt,ds.elev);
  D.dmeGs=N.dmeRate(ds,a,w.vx,w.vy,a.alt); D.dmeMin=D.dmeGs>30?D.slant/D.dmeGs*60:Infinity;
  const ad=adfSt(); D.rb=N.adf(ad,a,a.th); D.qdmA=N.mbFrom(D.mh,D.rb); D.adfDist=N.dist(a,ad); D.adfOk=D.adfDist>0.05&&D.adfDist<80;
  const sig=Math.pow(Math.max(0.2,1-6.8756e-6*a.alt),4.2559); D.ias=a.tas*Math.sqrt(sig);
  const hf=N.headingFor(a.tas,N.toTrue(S.sel.trk,S.varE),S.wind.dir,S.wind.spd); D.wca=hf.wca; D.trkOk=hf.ok;
  if(S.view.sectors||S.ap==='HOLD'){ const f=holdFix(), inb=N.toTrue(S.hold.inb,S.varE); D.holdEntry=N.holdEntry(inb,S.hold.dir,N.bearing(f.x-a.x,f.y-a.y)).entry; }
  return D; }

/* ---------- hold fix ---------- */
const HF={x:0,y:0};
function holdFix(){ const v=refVor(); if(S.hold.fix==='st'){ HF.x=v.x; HF.y=v.y; } else { const b=N.toTrue(S.hold.rad,v.var)*D2R; HF.x=v.x+Math.sin(b)*S.hold.dme; HF.y=v.y+Math.cos(b)*S.hold.dme; } return HF; }

/* ---------- flight model and autopilot ---------- */
const HS={mode:'tofix',ph:0,tm:0,laps:0,entry:'',fixD:99};
function holdReset(){ HS.mode='tofix'; HS.ph=0; HS.tm=0; HS.laps=0; HS.entry=''; }
let lastHdg=0, rateNow=0, navCap=false, apWant=0, apDir=0;
function turnToward(want,dir,dt){ const a=S.ac, r=N.turnRate(a.tas)*dt; let d=diff(want,a.th);
  if(dir>0&&d<-1) d+=360; if(dir<0&&d>1) d-=360;
  if(Math.abs(d)<=r){ a.th=norm(want); return true; } a.th=norm(a.th+Math.sign(d)*r); return false; }
function apStep(dt){
  const a=S.ac, V=S.varE, tas=a.tas, W=S.wind;
  const hfor=t=>{ const h=N.headingFor(tas,t,W.dir,W.spd); return h.ok?h.hdg:t; };
  let want=a.th, dir=0;
  switch(S.ap){
    case 'HDG': want=N.toTrue(S.sel.hdg,V); break;
    case 'TRK': want=hfor(N.toTrue(S.sel.trk,V)); break;
    case 'HOME': { const s=adfSt(); want=N.bearing(s.x-a.x,s.y-a.y); break; }
    case 'NAV': case 'APP': {
      const n=nav1();
      /* armed until the needle comes off the stop: hold the heading bug, then capture */
      if(n.type==='ILS'){ const lc=N.loc(n,a); if(Math.abs(lc.dots)>=4.9&&!navCap) want=N.toTrue(S.sel.hdg,V); else { navCap=true; const xt=-lc.lat; want=hfor(norm(n.crs+clamp(xt*45,-30,30))); } }
      else { const v=N.vor(n,a,S.obs,{alt:0,cone:0}); if(Math.abs(v.dev)>=9.5&&!navCap&&v.dist>0.6) want=N.toTrue(S.sel.hdg,V); else { navCap=true; const crs=N.toTrue(S.obs,V); const xt=v.dist*Math.sin(clamp(v.dev,-89,89)*D2R); want=hfor(norm(crs+(v.dist<0.6?0:clamp(xt*25,-45,45)))); } }
      break; }
    case 'HOLD': { const r=holdStep(dt); want=r.want; dir=r.dir; break; }
  }
  apWant=want; apDir=dir; turnToward(want,dir,dt);
  /* vertical: selected altitude at the selected rate, or the glide path in APP */
  let tvs=0; const dAlt=S.sel.alt-a.alt;
  if(S.ap==='APP'&&isILS()){ const n=nav1(), g=N.gs(n,a,a.alt); if(g.valid&&g.dev<0.7){ const gsk=Math.hypot(D.vx||0,D.vy||0)||tas; tvs=-gsk*101.27*Math.tan(3*D2R)+(g.pathFt-a.alt)*1.2; if(a.alt<n.elev+60) tvs=0; } else tvs=clamp(dAlt*2,-S.sel.vs,S.sel.vs); }
  else tvs=clamp(dAlt*2,-S.sel.vs,S.sel.vs);
  a.vs+= (tvs-a.vs)*Math.min(1,dt*1.5); a.alt=Math.max(0,a.alt+a.vs/60*dt);
}
function holdStep(dt){
  const a=S.ac, f=holdFix(), I=N.toTrue(S.hold.inb,S.varE), d=S.hold.dir, tas=a.tas, W=S.wind, leg=S.hold.leg*60;
  const hin=N.headingFor(tas,I,W.dir,W.spd), wca=hin.ok?hin.wca:0, gsIn=hin.ok?hin.gs:tas;
  const hout=N.headingFor(tas,norm(I+180),W.dir,W.spd), gsOut=hout.ok?hout.gs:tas;
  const hOut=norm(I+180-3*wca), tOut=clamp(leg*gsIn/Math.max(20,gsOut),20,leg*3);
  const dx=a.x-f.x, dy=a.y-f.y, toFix=N.bearing(-dx,-dy), dist=Math.hypot(dx,dy);
  const along=dx*Math.sin(I*D2R)+dy*Math.cos(I*D2R), xt=dx*Math.cos(I*D2R)-dy*Math.sin(I*D2R);
  HS.fixD=dist;
  const track=()=>norm(I+wca-clamp(xt*90,-45,45));
  let want=a.th, dir=0;
  switch(HS.mode){
    case 'tofix': want=toFix; if(dist<0.12||(dist<1.5&&Math.abs(diff(toFix,a.th))>100)){ HS.entry=N.holdEntry(I,d,a.th).entry; HS.mode=HS.entry; HS.ph=0; HS.tm=0; } break;
    case 'direct': if(HS.ph===0){ want=hOut; dir=d; if(Math.abs(diff(a.th,hOut))<1){ HS.ph=1; HS.tm=0; } } else if(HS.ph===1){ want=hOut; HS.tm+=dt; if(HS.tm>=tOut) HS.ph=2; } else { want=norm(I+wca); dir=d; if(Math.abs(diff(a.th,want))<2) HS.mode='inbound'; } break;
    case 'teardrop': { const off=norm(I+180-d*30-wca); if(HS.ph===0){ want=off; if(Math.abs(diff(a.th,off))<1){ HS.ph=1; HS.tm=0; } } else if(HS.ph===1){ want=off; HS.tm+=dt; if(HS.tm>=leg) HS.ph=2; } else { want=norm(I-d*20); dir=d; if(Math.abs(diff(a.th,want))<2) HS.mode='inbound'; } break; }
    case 'parallel': { const out=norm(I+180-wca); if(HS.ph===0){ want=out; if(Math.abs(diff(a.th,out))<1){ HS.ph=1; HS.tm=0; } } else if(HS.ph===1){ want=out; HS.tm+=dt; if(HS.tm>=leg) HS.ph=2; } else { want=norm(I+d*45); dir=-d; if(Math.abs(diff(a.th,want))<2) HS.mode='return'; } break; }
    case 'return': want=toFix; if(dist<0.15){ HS.mode='hold'; HS.ph=0; HS.laps++; } break;
    case 'inbound': want=track(); if(along>=-0.02&&along<0.4&&Math.abs(xt)<0.8){ HS.mode='hold'; HS.ph=0; HS.laps++; } break;
    case 'hold': if(HS.ph===0){ want=hOut; dir=d; if(Math.abs(diff(a.th,hOut))<1){ HS.ph=1; HS.tm=0; } } else if(HS.ph===1){ want=hOut; HS.tm+=dt; if(HS.tm>=tOut) HS.ph=2; } else { want=norm(I+wca); dir=d; if(Math.abs(diff(a.th,want))<2) HS.mode='inbound'; } break;
  }
  HS.hIn=norm(I+wca); HS.hOut=hOut; HS.tOut=tOut; HS.wca=wca;
  const R=holdRet; R.want=want; R.dir=dir; return R; }
const holdRet={want:0,dir:0};

/* trace: ring buffer of positions */
const TRN=3000, TR=new Float32Array(TRN*2); let trI=0, trN=0, trLx=1e9, trLy=1e9;
function trPush(x,y){ if(Math.hypot(x-trLx,y-trLy)<0.06) return; TR[trI*2]=x; TR[trI*2+1]=y; trI=(trI+1)%TRN; if(trN<TRN) trN++; trLx=x; trLy=y; }
function trClear(){ trI=0; trN=0; trLx=trLy=1e9; mapDirty=true; }

function simStep(dt){
  const a=S.ac; const h0=a.th; apStep(dt);
  const w=N.windTriangle(a.tas,a.th,S.wind.dir,S.wind.spd); a.x+=w.vx*dt/3600; a.y+=w.vy*dt/3600; S.t+=dt;
  rateNow=diff(a.th,h0)/Math.max(1e-6,dt);
  if(S.view.trace) trPush(a.x,a.y);
  if(Math.hypot(a.x,a.y)>140){ S.run=false; toolsSync(); }
}

/* ---------- canvases ---------- */
const mapCv=el('nsMap'), profCv=el('nsProf');
const MC=LAB.fit(mapCv,()=>{ bgDirty=true; mapDirty=true; },2.5), PC=LAB.fit(profCv,()=>{ profDirty=true; },2.5);
let bgDirty=true, mapDirty=true, profDirty=true, instDirty=true;
const BG=document.createElement('canvas');
/* the map (navmap.js) and its view transform M (numbers, no allocation) */
const map=NM_.create(mapCv,{onLoad:()=>{ bgDirty=true; redraw(); }}), M=map.v;
/* camera: the view eases to its new target after a zoom, North-up/Heading-up or centre change, then follows directly */
const CT={k:1,rot:0,ox:0,oy:0,cx:0,cy:0}, CF={k:1,rot:0,ox:0,oy:0,cx:0,cy:0}, CAM={t:1};
function camTarget(){ const W=MC.w,H=MC.h, v=S.view, a=S.ac;
  CT.k=Math.min(W,H)/2/v.range*0.92; CT.rot= v.north?0:a.th;
  if(!v.north){ CT.ox=a.x; CT.oy=a.y; CT.cx=W/2; CT.cy=H*0.62; }
  else if(v.centre==='ac'){ CT.ox=a.x; CT.oy=a.y; CT.cx=W/2; CT.cy=H/2; }
  else { const c=refCentre(); CT.ox=c.x; CT.oy=c.y; CT.cx=W/2; CT.cy=H/2; } }
function camStart(){ if(reduced()||!MC.w){ CAM.t=1; return; } CF.k=M.k; CF.rot=M.rot; CF.ox=M.ox; CF.oy=M.oy; CF.cx=M.cx; CF.cy=M.cy; CAM.t=0; kick(); }
function setView(){ camTarget();
  /* zoom in log space so it feels even */
  if(CAM.t<1){ const t=CAM.t, e=t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; NM_.lerpView(CF,CT,e,M); }
  else map.set(CT); }
const refCentre=()=>{ const n=nav1(); return n.type==='ILS'?n.thr:n; };
let SX=0, SY=0;
function P(x,y){ map.P(x,y); SX=map.sx; SY=map.sy; }
const unP=map.unP;
/* screen angle (radians, canvas rotate) for a true bearing */
const SA=map.sa;

/* ---------- labels that never overlap (navmap.js), symbols ---------- */
const label=map.label, arrowHead=NM_.arrowHead, vorSym=NM_.drawVor, ndbSym=NM_.drawNdb;
const CHIP=document.getElementById('nsChip'); let chipW=0, chipH=0;
function flushLabels(g,W,H){
  /* keep clear of the chip, the wind badge and the orientation text (navmap keeps the north arrow and scale clear) */
  if(chipW) map.reserve(0,0,chipW+12,chipH+10);
  map.reserve(W-82,0,82,92); map.reserve(W-120,H-26,120,26); map.flushLabels(g,W,H); }

/* ---------- the plan view ---------- */
function drawBg(g,W,H){
  /* background, relief and coastline, grid */
  map.drawBase(g,W,H,{range:S.view.range});
  const v=refVor();
  /* DME rings */
  if(S.view.rings){ const rs=S.view.range<=10?2:S.view.range<=20?5:S.view.range<=40?10:20; map.drawRings(g,v.x,v.y,rs,S.view.range*2.2,N.toTrue(135,S.varE)); }
  /* compass rose round the VOR (magnetic) */
  map.drawRose(g,v.x,v.y,Math.min(W,H)*0.36,v.var);
  /* airports and runways */
  for(const ap of APT){ P(ap.x,ap.y); NM_.drawAirport(g,SX,SY); }
  for(const i of ILS) map.drawRunway(g,i.thr,i.end);
}
let hoverAc=false;
function drawMap(){
  const g=MC.ctx, W=MC.w, H=MC.h; if(!W) return; setView();
  const fixedBg=S.view.north&&S.view.centre!=='ac'&&CAM.t>=1;
  if(fixedBg){ if(bgDirty||BG.width!==Math.round(W*MC.dpr)){ BG.width=Math.round(W*MC.dpr); BG.height=Math.round(H*MC.dpr); const bg=BG.getContext('2d'); bg.setTransform(MC.dpr,0,0,MC.dpr,0,0); drawBg(bg,W,H); bgDirty=false; }
    g.setTransform(1,0,0,1,0,0); g.drawImage(BG,0,0); g.setTransform(MC.dpr,0,0,MC.dpr,0,0); }
  else drawBg(g,W,H);
  const a=S.ac, n=nav1(), v=refVor(), hideAc=S.view.hideMap, hideA=S.view.hideAns;
  /* TO / FROM regions */
  if(S.view.tofrom&&!D.ils){ const c=N.toTrue(S.obs,v.var); P(v.x,v.y); const cx=SX, cy=SY, R=Math.hypot(W,H);
    g.save(); g.translate(cx,cy); g.rotate(SA(c)); g.fillStyle=COL.from; g.fillRect(-R,-R,2*R,R); g.fillStyle=COL.to; g.fillRect(-R,0,2*R,R);
    g.strokeStyle='rgba(240,180,64,.55)'; g.setLineDash([6,6]); g.lineWidth=1.2; g.beginPath(); g.moveTo(-R,0); g.lineTo(R,0); g.stroke(); g.setLineDash([]); g.restore();
    label(cx+Math.sin(SA(c))*M.k*S.view.range*0.55,cy-Math.cos(SA(c))*M.k*S.view.range*0.55,'FROM','#9FE8C3'); label(cx-Math.sin(SA(c))*M.k*S.view.range*0.55,cy+Math.cos(SA(c))*M.k*S.view.range*0.55,'TO','#9CC6F5'); }
  /* selected course line, glowing */
  if(S.view.course&&!D.ils){ const c=N.toTrue(S.obs,v.var); P(v.x,v.y); const cx=SX, cy=SY, R=M.k*S.view.range*3, an=SA(c);
    g.save(); g.lineCap='round'; g.shadowColor=COL.crs; g.shadowBlur=reduced()?0:10; g.strokeStyle='rgba(240,107,180,.85)'; g.lineWidth=2;
    g.beginPath(); g.moveTo(cx-Math.sin(an)*R,cy+Math.cos(an)*R); g.lineTo(cx+Math.sin(an)*R,cy-Math.cos(an)*R); g.stroke(); g.restore();
    for(const f of [0.35,0.75]){ arrowHead(g,cx+Math.sin(an)*M.k*S.view.range*f,cy-Math.cos(an)*M.k*S.view.range*f,an,8,COL.crs); arrowHead(g,cx-Math.sin(an)*M.k*S.view.range*f,cy+Math.cos(an)*M.k*S.view.range*f,an,8,COL.crs); }
    if(!hideA) label(cx+Math.sin(an)*M.k*S.view.range*0.55,cy-Math.cos(an)*M.k*S.view.range*0.55,'CRS '+d3(S.obs),COL.crs,`600 11px ${FM}`); }
  /* ILS feather and centreline */
  for(const i of ILS) map.drawIls(g,i,n===i,{label:i.name});
  /* hold */
  if(S.view.sectors||S.ap==='HOLD') drawHold(g);
  /* navaids */
  for(const s of NAV){ if(s.type==='ILS') continue; P(s.x,s.y); if(SX<-30||SY<-30||SX>W+30||SY>H+30) continue;
    if(s.type==='VOR') vorSym(g,SX,SY,s===n||s===v); else ndbSym(g,SX,SY,s===adfSt());
    label(SX,SY,s.id+' '+(s.type==='NDB'?s.f:s.f.toFixed(2)),s.type==='NDB'?COL.ndb:COL.vor,`600 11px ${FM}`); }
  for(const ap of APT){ P(ap.x,ap.y); label(SX,SY,ap.id,COL.ink2); }
  if(!hideAc){
    /* trace */
    if(S.view.trace&&trN>1){ g.lineWidth=2; g.lineCap='round'; g.lineJoin='round'; const seg=4, per=Math.ceil(trN/seg);
      for(let sgi=0;sgi<seg;sgi++){ const i0=sgi*per, i1=Math.min(trN-1,(sgi+1)*per); if(i1<=i0) continue; g.strokeStyle=`rgba(${COL.trace},${(0.18+0.6*(sgi+1)/seg).toFixed(2)})`; g.beginPath();
        for(let i=i0;i<=i1;i++){ const k=((trI-trN+i)%TRN+TRN)%TRN; P(TR[k*2],TR[k*2+1]); if(i===i0) g.moveTo(SX,SY); else g.lineTo(SX,SY); } g.stroke(); } }
    P(a.x,a.y); const ax=SX, ay=SY;
    /* radial line from the VOR to the aircraft */
    if(!D.ils){ P(v.x,v.y); g.strokeStyle='rgba(99,217,160,.55)'; g.lineWidth=1.2; g.setLineDash([3,5]); g.beginPath(); g.moveTo(SX,SY); g.lineTo(ax,ay); g.stroke(); g.setLineDash([]);
      if(!hideA) label((SX+ax)/2,(SY+ay)/2,'R'+d3(D.rad)+' · '+nf(D.slant,1)+' NM',COL.vor); }
    /* ADF bearing */
    if(S.view.brg){ const s=adfSt(); P(s.x,s.y); g.strokeStyle='rgba(245,188,76,.5)'; g.lineWidth=1.1; g.setLineDash([1,5]); g.beginPath(); g.moveTo(ax,ay); g.lineTo(SX,SY); g.stroke(); g.setLineDash([]); }
    /* predicted track (2 min) */
    if(S.run&&Math.abs(diff(apWant,a.th))>1.5) predictor(g); else { const tr=N.toTrue(D.trk,S.varE), L2=D.gs/30*M.k, ta=SA(tr); g.strokeStyle='rgba(230,235,239,.35)'; g.lineWidth=1; g.setLineDash([4,4]); g.beginPath(); g.moveTo(ax,ay); g.lineTo(ax+Math.sin(ta)*L2,ay-Math.cos(ta)*L2); g.stroke(); g.setLineDash([]); }
    /* wind triangle */
    if(S.view.tri) drawTri(g,ax,ay);
    /* aircraft */
    /* aircraft, with its heading handle (and a ring while hovered or dragged) */
    NM_.aircraftAt(g,ax,ay,SA(a.th),{size:15,ring:!!(hoverAc||drag),handle:true});
    if(!hideA) label(ax,ay,'HDG '+d3(D.mh),COL.ink,`600 11px ${FM}`);
    /* off the map: an arrow on the edge */
    if(ax<0||ay<0||ax>W||ay>H){ const cx=W/2, cy=H/2, an=Math.atan2(ax-cx,cy-ay), ex=clamp(ax,18,W-18), ey=clamp(ay,18,H-18); arrowHead(g,ex,ey,an,12,COL.warn); label(ex,ey,L(t2('aircraft','flyet'))+' '+nf(Math.hypot(a.x-M.ox,a.y-M.oy),0)+' NM',COL.warn); }
  } else { g.fillStyle='rgba(9,13,17,.7)'; g.fillRect(0,H-40,W,40); g.fillStyle=COL.warn; g.font=`600 13px ${FB}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(L(t2('Map hidden: read the instruments','Kartet er skjult: les instrumentene')),W/2,H-20); }
  /* north arrow and scale (they keep their corner clear of labels), labels, wind arrow (top right) */
  map.drawNorth(g,H); map.drawScaleBar(g,H,S.view.range>=40?10:S.view.range>=20?5:S.view.range>=10?2:1);
  flushLabels(g,W,H);
  windBadge(g,W);
  g.textAlign='right'; g.fillStyle=COL.ink3; g.font=`500 10px ${FM}`; g.fillText(S.view.north?L(t2('NORTH UP','NORD OPP')):L(t2('HEADING UP','KURS OPP')),W-10,H-12);
  mapDirty=false; }
/* predictor: where the aircraft will be over the next 90 s (dots every 30 s), rolling out on the autopilot's target heading (wind included) */
const PRN=91, PR=new Float32Array(PRN*2);
function predictor(g){ const a=S.ac, W=S.wind; let x=a.x, y=a.y, h=a.th; const r=N.turnRate(a.tas);
  for(let i=0;i<PRN;i++){ P(x,y); PR[i*2]=SX; PR[i*2+1]=SY;
    let d=diff(apWant,h); if(apDir>0&&d<-1) d+=360; if(apDir<0&&d>1) d-=360; h=Math.abs(d)<=r?apWant:norm(h+Math.sign(d)*r);
    const sh=Math.sin(h*D2R), ch=Math.cos(h*D2R), ws=Math.sin(W.dir*D2R), wc=Math.cos(W.dir*D2R);
    x+=(a.tas*sh-W.spd*ws)/3600; y+=(a.tas*ch-W.spd*wc)/3600; }
  g.save(); g.lineCap='round'; g.lineJoin='round';
  /* soft halo, then a tapering cyan arc */
  g.strokeStyle='rgba(127,203,232,.16)'; g.lineWidth=7; g.beginPath(); g.moveTo(PR[0],PR[1]); for(let i=1;i<PRN;i++) g.lineTo(PR[i*2],PR[i*2+1]); g.stroke();
  for(let s0=0;s0<PRN-1;s0+=15){ g.strokeStyle=`rgba(127,203,232,${(0.95-s0/PRN*0.7).toFixed(2)})`; g.lineWidth=2.2-s0/PRN*1.2; g.beginPath(); g.moveTo(PR[s0*2],PR[s0*2+1]); for(let i=s0+1;i<=Math.min(PRN-1,s0+15);i++) g.lineTo(PR[i*2],PR[i*2+1]); g.stroke(); }
  g.fillStyle='#7FCBE8'; for(let i=30;i<PRN;i+=30){ g.beginPath(); g.arc(PR[i*2],PR[i*2+1],2.4,0,TAU); g.fill(); }
  g.restore(); }
const windBadge=(g,W)=>map.drawWind(g,W,S.wind.dir,S.wind.spd);
function drawTri(g,ax,ay){ const a=S.ac, k=Math.min(MC.w,MC.h)*0.26/Math.max(80,a.tas); /* px per kt */
  const ha=SA(a.th), hx=ax+Math.sin(ha)*a.tas*k, hy=ay-Math.cos(ha)*a.tas*k;
  const wa=SA(S.wind.dir+180), wx=hx+Math.sin(wa)*S.wind.spd*k, wy=hy-Math.cos(wa)*S.wind.spd*k;
  g.lineWidth=2.2; g.lineCap='round';
  g.strokeStyle=COL.air; g.beginPath(); g.moveTo(ax,ay); g.lineTo(hx,hy); g.stroke(); arrowHead(g,hx,hy,ha,8,COL.air);
  if(S.wind.spd>0.5){ g.strokeStyle=COL.wind; g.beginPath(); g.moveTo(hx,hy); g.lineTo(wx,wy); g.stroke(); arrowHead(g,wx,wy,wa,8,COL.wind); }
  const ga=Math.atan2(wx-ax,ay-wy); g.strokeStyle=COL.gnd; g.beginPath(); g.moveTo(ax,ay); g.lineTo(wx,wy); g.stroke(); arrowHead(g,wx,wy,ga,8,COL.gnd);
  if(Math.abs(D.drift)>0.5){ const r=a.tas*k*0.42, dr=D.drift*D2R; g.strokeStyle='rgba(240,180,64,.85)'; g.lineWidth=1.4; g.beginPath(); const a0=ha-Math.PI/2; g.arc(ax,ay,r,a0,a0+dr,dr<0); g.stroke();
    const mid=ha+dr/2; label(ax+Math.sin(mid)*r,ay-Math.cos(mid)*r,L(t2('drift ','avdrift '))+nf(Math.abs(D.drift),0)+'°',COL.warn); }
  label(hx,hy,'HDG '+d3(D.mh)+' · TAS '+Math.round(a.tas),COL.air); if(S.wind.spd>0.5) label((hx+wx)/2,(hy+wy)/2,'W/V '+d3(S.wind.dir)+'/'+Math.round(S.wind.spd),COL.wind); label(wx,wy,'TRK '+d3(D.trk)+' · GS '+Math.round(D.gs),COL.gnd); }
function drawHold(g){ const f=holdFix(), I=N.toTrue(S.hold.inb,S.varE), d=S.hold.dir, tas=S.ac.tas, R=N.turnRadius(tas), legNm=tas/3600*S.hold.leg*60;
  P(f.x,f.y); const fx=SX, fy=SY;
  /* racetrack: inbound leg ends at the fix; outbound leg offset 2R to the holding side */
  map.racetrack(g,f,I,d,R,legNm,{col:COL.hold,fill:'rgba(201,166,245,.07)',lw:2.2,arrow:'fix',sz:9});
  /* fix */
  NM_.drawFix(g,fx,fy,COL.hold);
  if(S.view.sectors){ /* entry sectors: the inbound course line and the 70° line through the fix */
    const Rr=M.k*S.view.range*2; g.save(); g.strokeStyle='rgba(201,166,245,.55)'; g.setLineDash([5,5]); g.lineWidth=1.2;
    const l1=SA(I), l2=SA(norm(I+180-d*70)); for(const an of [l1,l2]){ g.beginPath(); g.moveTo(fx-Math.sin(an)*Rr,fy+Math.cos(an)*Rr); g.lineTo(fx+Math.sin(an)*Rr,fy-Math.cos(an)*Rr); g.stroke(); } g.restore();
    /* sector names: where an aircraft comes FROM; the label sits on the side the aircraft arrives from */
    const rr=M.k*Math.min(S.view.range*0.7,legNm*2.4+3), put=(hdg,txt)=>{ const fromB=norm(hdg+180), an=SA(fromB); label(fx+Math.sin(an)*rr,fy-Math.cos(an)*rr,txt,'#DCC6FA',`700 11px ${FB}`,'rgba(30,20,45,.82)'); };
    const out=norm(I+180); put(norm(out-d*35),L(t2('TEARDROP','DRÅPE'))); put(norm(out+d*55),L(t2('PARALLEL','PARALLELL'))); put(norm(out-d*160),L(t2('DIRECT','DIREKTE'))); }
  label(fx,fy,(S.hold.fix==='st'?refVor().id:refVor().id+' R'+d3(S.hold.rad)+'/'+S.hold.dme)+' · '+d3(S.hold.inb)+(d>0?' R':' L'),COL.hold); }

/* ---------- profile view ---------- */
function drawProf(){ const g=PC.ctx, W=PC.w, H=PC.h; if(!W) return; g.clearRect(0,0,W,H);
  const gr=g.createLinearGradient(0,0,0,H); gr.addColorStop(0,'#14212b'); gr.addColorStop(1,'#0e161d'); g.fillStyle=gr; g.fillRect(0,0,W,H);
  const a=S.ac, n=nav1(), pad=34, x0=pad, x1=W-12, yb=H-22, yt=12;
  g.font=`500 10px ${FM}`; g.textBaseline='middle';
  if(D.ils){ /* distance from threshold along the approach (right = further out) */
    const maxD=12, maxA=Math.max(4500,a.alt+500), X=d=>x0+d/maxD*(x1-x0), Y=h=>yb-(h-n.elev)/(maxA-n.elev)*(yb-yt);
    const u=[Math.sin(n.crs*D2R),Math.cos(n.crs*D2R)], along=-((a.x-n.thr.x)*u[0]+(a.y-n.thr.y)*u[1]);
    g.fillStyle='rgba(127,203,232,.08)'; g.beginPath(); const gpo=0.16; const hAt=(d,ang)=>n.elev+Math.tan(ang*D2R)*(d+gpo)*6076.12; g.moveTo(X(0),Y(hAt(0,3.7))); g.lineTo(X(maxD),Y(hAt(maxD,3.7))); g.lineTo(X(maxD),Y(hAt(maxD,2.3))); g.lineTo(X(0),Y(hAt(0,2.3))); g.closePath(); g.fill();
    g.strokeStyle=COL.ils; g.lineWidth=1.6; g.beginPath(); g.moveTo(X(0),Y(hAt(0,3))); g.lineTo(X(maxD),Y(hAt(maxD,3))); g.stroke();
    g.strokeStyle='#C9D2D8'; g.lineWidth=4; g.beginPath(); g.moveTo(X(0)-14,yb); g.lineTo(X(0),yb); g.stroke();
    g.strokeStyle='rgba(255,255,255,.12)'; g.lineWidth=1; g.beginPath(); g.moveTo(x0-16,yb); g.lineTo(x1,yb); g.stroke();
    g.fillStyle=COL.ink3; g.textAlign='center'; for(let d=0;d<=maxD;d+=2) g.fillText(String(d),X(d),yb+11);
    g.textAlign='left'; g.fillStyle=COL.ils; g.fillText('3° · '+L(t2('~300 ft per NM','~300 ft per NM')),X(maxD*0.22),Y(hAt(maxD*0.22,3))-12);
    if(along>-0.5&&along<maxD+1&&!S.view.hideMap){ const px=X(clamp(along,0,maxD)), py=Y(a.alt); g.strokeStyle='rgba(230,235,239,.3)'; g.setLineDash([3,4]); g.beginPath(); g.moveTo(px,py); g.lineTo(px,yb); g.stroke(); g.setLineDash([]);
      g.fillStyle=COL.ac; g.save(); g.translate(px,py); g.rotate(Math.atan2(a.vs/60,D.gs*101.27/60)); g.beginPath(); g.moveTo(-8,0); g.lineTo(8,0); g.lineTo(4,-3); g.lineTo(-6,-3); g.lineTo(-8,-7); g.lineTo(-9,-7); g.closePath(); g.fill(); g.restore();
      g.fillStyle=COL.ink; g.textAlign='left'; g.fillText(Math.round(a.alt)+' ft · '+L(t2('path','bane'))+' '+Math.round(D.pathFt||0)+' ft',Math.min(px+10,W-170),py-12); }
    g.fillStyle=COL.ink3; g.textAlign='left'; g.fillText(L(t2('NM from threshold','NM fra terskel')),x0,yt+2);
  } else { const v=refVor(), maxD=Math.max(4,Math.min(S.view.range,Math.ceil((D.dist+2)/5)*5)), maxA=Math.max(8000,Math.ceil((a.alt+1500)/2000)*2000), X=d=>x0+d/maxD*(x1-x0), Y=h=>yb-(h-v.elev)/(maxA-v.elev)*(yb-yt);
    g.strokeStyle='rgba(255,255,255,.12)'; g.lineWidth=1; g.beginPath(); g.moveTo(x0,yb); g.lineTo(x1,yb); g.stroke();
    g.fillStyle=COL.ink3; g.textAlign='center'; for(let d=0;d<=maxD;d+=maxD>20?10:maxD>8?2:1) g.fillText(String(d),X(d),yb+11);
    vorSym(g,X(0),yb-2,true);
    if(!S.view.hideMap){ const px=X(Math.min(maxD,D.dist)), py=Y(a.alt);
      g.strokeStyle=COL.vor; g.lineWidth=1.6; g.beginPath(); g.moveTo(X(0),yb); g.lineTo(px,py); g.stroke();
      g.strokeStyle='rgba(230,235,239,.35)'; g.setLineDash([3,4]); g.beginPath(); g.moveTo(px,py); g.lineTo(px,yb); g.stroke(); g.setLineDash([]);
      g.fillStyle=COL.ac; g.beginPath(); g.arc(px,py,5,0,TAU); g.fill();
      g.textAlign='left'; g.fillStyle=COL.vor; const lx=Math.min(Math.max(X(0)+10,(X(0)+px)/2-60),W-200); g.fillText(L(t2('slant ','skrå '))+nf(D.slant,2)+' NM (DME)',lx,(yb+py)/2-10);
      g.fillStyle=COL.ink2; g.fillText(L(t2('ground ','bakke '))+nf(D.dist,2)+' NM',Math.min(px+8,W-140),yb-10); g.fillStyle=COL.ink; g.fillText(Math.round(a.alt)+' ft',Math.min(px+8,W-80),py-10); }
    g.fillStyle=COL.ink3; g.textAlign='left'; g.fillText(L(t2('NM from ','NM fra '))+v.id,x0,yt+2); }
  profDirty=false; }

/* ---------- gauges ---------- */
const GA={}; ['cdi','hsi','rmi','adf','asi','ai','alt','tc','dg','vsi'].forEach(k=>{ const c=document.querySelector(`[data-g="${k}"] canvas`); if(c) GA[k]=NAVG.make(c,k); });
const GV={cdi:{},hsi:{},rmi:{},adf:{},asi:{},ai:{},alt:{},tc:{},dg:{},vsi:{}};
function setGauges(){ const a=S.ac;
  let o=GV.cdi; o.obs=S.obs; o.dots=D.flag==='OFF'&&D.why==='cone'?D.dots*0.3:D.dots; o.flag=D.flag; o.valid=D.flag!=='OFF'; o.ils=D.ils; o.gsValid=D.gsOk; o.gsDots=D.gsDots; GA.cdi.set(o);
  o=GV.hsi; o.hdg=D.mh; o.crs=D.ils?N.toMag(nav1().crs,S.varE):S.obs; o.hsiDots=D.hsiDots; o.flag=D.flag; o.ils=D.ils; o.gsValid=D.gsOk; o.gsDots2=clamp(D.gsDots*0.4,-2.4,2.4); o.bug=S.ap==='TRK'?S.sel.trk:S.sel.hdg; GA.hsi.set(o);
  o=GV.rmi; o.hdg=D.mh; o.qdmV=D.vorQdm; o.qdmA=D.qdmA; o.vorOk=D.vorOk&&D.dist>0.05; o.adfOk=D.adfOk; GA.rmi.set(o);
  o=GV.adf; o.movable=S.adfMov; o.card=S.adfCard; o.rb=D.rb; o.adfOk=D.adfOk; GA.adf.set(o);
  o=GV.asi; o.ias=D.ias; o.tas=a.tas; GA.asi.set(o);
  const rate=S.run?rateNow:0, bank=Math.atan(rate*D2R*a.tas*0.5144/9.81)/D2R; o=GV.ai; o.bank=clamp(bank,-35,35); o.pitch=clamp(a.vs/Math.max(60,a.tas*101.27)/D2R+2,-15,15); GA.ai.set(o);
  o=GV.alt; o.alt=a.alt; GA.alt.set(o); o=GV.tc; o.rate=rate; GA.tc.set(o); o=GV.dg; o.hdg=D.mh; o.bug=S.sel.hdg; GA.dg.set(o); o=GV.vsi; o.vs=S.run?a.vs:0; GA.vsi.set(o); }

/* DME box and the readout chip (text only when changed) */
const dmeEl={id:el('dmeId'),nm:el('dmeNm'),kt:el('dmeKt'),mn:el('dmeMin')}, TXT={};
function setT(e,k,v){ if(TXT[k]!==v){ TXT[k]=v; e.textContent=v; } }
function readouts(){ const v=D.ils?refVor():nav1(), hide=S.view.hideAns&&S.mode!=='learn';
  setT(dmeEl.id,'di',v.id+' '+v.f.toFixed(2));
  if(!D.dmeOk){ setT(dmeEl.nm,'dn','---.-'); setT(dmeEl.kt,'dk','---'); setT(dmeEl.mn,'dm','--'); }
  else { setT(dmeEl.nm,'dn',D.slant<100?D.slant.toFixed(1):Math.round(D.slant)+''); setT(dmeEl.kt,'dk',String(Math.max(0,Math.round(Math.abs(D.dmeGs))))); setT(dmeEl.mn,'dm',Number.isFinite(D.dmeMin)&&D.dmeMin<100?String(Math.round(D.dmeMin)):'--'); }
  const c=el('nsChip'); let h='';
  if(!hide){ h+= D.ils? `<span><i>LOC</i><b>${D.locOk?(Math.abs(D.locDots)<0.3?L(t2('centred','midt')):nf(Math.abs(D.locDots),1)+(D.locDots>0?' R':' L')):'—'}</b></span><span><i>GS</i><b>${D.gsOk?(Math.abs(D.gsDots)<0.3?L(t2('centred','midt')):nf(Math.abs(D.gsDots),1)+(D.gsDots>0?' ▲':' ▼')):'—'}</b></span>`
      : `<span><i>${L(t2('RADIAL','RADIAL'))}</i><b>${d3(D.rad)}</b></span><span><i>${L(t2('FLAG','FLAGG'))}</i><b class="${D.flag==='OFF'?'r':''}">${D.flag}</b></span>`;
    h+=`<span class="hx"><i>DME</i><b>${nf(D.slant,1)}</b></span>`; }
  h+=`<span><i>HDG</i><b>${d3(D.mh)}</b></span><span><i>TRK</i><b>${d3(D.trk)}</b></span><span class="hx"><i>GS</i><b>${Math.round(D.gs)}</b></span>`;
  if(S.ap==='TRK'&&!D.trkOk) h+=`<span><i>TRK</i><b class="a">${L(t2('wind too strong','for sterk vind'))}</b></span>`;
  if(TXT.chip!==h){ TXT.chip=h; c.innerHTML=h; chipW=c.offsetWidth; chipH=c.offsetHeight; } }

/* ---------- main loop ---------- */
let lastT=0, uiT=0, visible=true, flagPrev='';
LAB.visible(el('nsvp'),v=>{ visible=v; if(v) kick(); });
let raf=0; function kick(){ if(!raf) raf=requestAnimationFrame(frame); }
function frame(t){ raf=0; const dt=Math.min(0.1,lastT?(t-lastT)/1000:0.016); lastT=t;
  if(!visible){ lastT=0; return; }
  let moving=false;
  if(S.run){ let sim=dt*S.speed; while(sim>1e-6){ const h=Math.min(0.1,sim); simStep(h); sim-=h; } mapDirty=true; profDirty=true; instDirty=true; }
  if(instDirty||mapDirty){ derive(); setGauges(); instDirty=false; }
  for(const k in GA){ if(GA[k].tick(dt)) moving=true; if(GA[k].dirty||moving) GA[k].draw(); }
  if(CAM.t<1){ CAM.t=Math.min(1,CAM.t+dt/0.5); mapDirty=true; if(CAM.t>=1) bgDirty=true; moving=true; }
  if(mapDirty) drawMap(); if(S.view.profile&&profDirty) drawProf();
  uiT+=dt; if(uiT>0.1||!S.run){ uiT=0; readouts(); if(API.onTick) API.onTick(dt); fieldsSync(); }
  if(D.flag!==flagPrev){ if(flagPrev&&S.run&&API.onFlag) API.onFlag(flagPrev,D.flag); flagPrev=D.flag; }
  if(S.run||moving) kick(); else lastT=0; }
function redraw(){ mapDirty=true; profDirty=true; instDirty=true; kick(); }

/* ---------- actions (every user change goes through act, which also asks for a "Why?" sentence) ---------- */
function act(kind,fn){ const b=API.snap?API.snap():null; fn(); if(kind==='ap'||kind==='obs'||kind==='nav'||kind==='pos'||kind==='seg') navCap=false; if(!S.run){ trClear(); } derive(); redraw(); if(API.why&&b) API.why(kind,b); fieldsSync(true); }
function setPos(x,y){ S.ac.x=x; S.ac.y=y; }
function placeRel(st,rad,dme){ const s=typeof st==='string'?ST[st]:st, b=N.toTrue(rad,s.var)*D2R; setPos(s.x+Math.sin(b)*dme,s.y+Math.cos(b)*dme); }
function setHdg(m){ m=norm(m); S.sel.hdg=m; if(!S.run||S.ap!=='HDG'){ if(!S.run) S.ac.th=N.toTrue(m,S.varE); } if(S.ap!=='HDG'&&S.ap!=='TRK'&&S.run){ S.ap='HDG'; apSync(); } }
function setAlt(v){ S.sel.alt=clamp(v,0,25000); if(!S.run) S.ac.alt=S.sel.alt; }

/* ---------- number fields: type, +/−, scrub the label, scroll, arrow keys ---------- */
const FIELDS=[];
function numField(box,o){ const w=document.createElement('div'); w.className='nf'; w.dataset.k=o.k;
  w.innerHTML=`<label class="nfl" for="nf-${o.k}"><span></span><small></small></label><div class="nfw"><button type="button" class="nfb" data-d="-1" aria-label="−">−</button><input id="nf-${o.k}" inputmode="decimal" autocomplete="off" spellcheck="false"><button type="button" class="nfb" data-d="1" aria-label="+">+</button></div>`;
  box.appendChild(w); const inp=w.querySelector('input'), lab=w.querySelector('label span'), unit=w.querySelector('label small');
  const fmt=v=>o.wrap?d3(v):o.dec?nf(v,o.dec):String(Math.round(v));
  const put=(v,kind)=>{ if(o.wrap) v=norm(v); else v=clamp(v,o.min,o.max); act(o.why||o.k,()=>o.set(v)); };
  const F={o,w,inp,sync(force){ if(document.activeElement===inp&&!force) return; const t=o.secret&&S.view.hideAns&&S.mode!=='learn'?'···':fmt(o.get()); if(inp.value!==t) inp.value=t; },
    lang(){ lab.textContent=L(o.label); unit.textContent=o.unit?L(o.unit):''; const b=w.querySelectorAll('.nfb'); b[0].setAttribute('aria-label',L(t2('Decrease ','Minsk '))+L(o.label)); b[1].setAttribute('aria-label',L(t2('Increase ','Øk '))+L(o.label)); }};
  F.lang(); F.sync(); FIELDS.push(F);
  const commit=()=>{ const v=parseFloat(String(inp.value).replace(',','.')); if(!Number.isFinite(v)||(!o.wrap&&(v<o.min||v>o.max))){ w.classList.add('bad'); return; } w.classList.remove('bad'); put(o.wrap&&v===360?0:v); };
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ commit(); inp.select(); } else if(e.key==='Escape'){ w.classList.remove('bad'); F.sync(true); inp.blur(); }
    else if(e.key==='ArrowUp'||e.key==='ArrowDown'){ e.preventDefault(); put(o.get()+(e.key==='ArrowUp'?1:-1)*(e.shiftKey?o.big:o.step)); F.sync(true); } });
  inp.addEventListener('blur',()=>{ if(inp.value!==fmt(o.get())) commit(); });
  inp.addEventListener('focus',()=>setTimeout(()=>inp.select(),0));
  inp.addEventListener('wheel',e=>{ if(document.activeElement!==inp) return; e.preventDefault(); put(o.get()+(e.deltaY<0?1:-1)*(e.shiftKey?o.big:o.step)); F.sync(true); },{passive:false});
  /* press and hold the buttons */
  let rep=0, rt=0; const stop=()=>{ clearTimeout(rt); clearInterval(rep); rep=0; };
  w.querySelectorAll('.nfb').forEach(b=>{ const d=+b.dataset.d;
    b.addEventListener('pointerdown',e=>{ e.preventDefault(); put(o.get()+d*(e.shiftKey?o.big:o.step)); F.sync(true); stop(); rt=setTimeout(()=>{ rep=setInterval(()=>{ put(o.get()+d*o.step); F.sync(true); },70); },380); });
    b.addEventListener('pointerup',stop); b.addEventListener('pointerleave',stop); b.addEventListener('pointercancel',stop);
    b.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); put(o.get()+d*o.step); F.sync(true); } }); });
  /* scrub: drag the label sideways */
  const lb=w.querySelector('label'); let sx=null, sv=0;
  lb.addEventListener('pointerdown',e=>{ sx=e.clientX; sv=o.get(); lb.setPointerCapture(e.pointerId); });
  lb.addEventListener('pointermove',e=>{ if(sx===null) return; const dd=Math.round((e.clientX-sx)/6); if(dd){ put(sv+dd*o.step); F.sync(true); w.classList.add('scrub'); } });
  const up=()=>{ sx=null; w.classList.remove('scrub'); }; lb.addEventListener('pointerup',up); lb.addEventListener('pointercancel',up);
  return F; }
function fieldsSync(force){ for(const f of FIELDS) f.sync(force); }

/* segmented choice with EN/NO labels */
function segment(box,items,get,set,why){ box.classList.add('seg','nseg');
  const draw=()=>{ const v=get(); box.innerHTML=items().map(([k,t,dis])=>`<button type="button" data-v="${k}" class="${String(k)===String(v)?'on':''}"${dis?' disabled':''} aria-pressed="${String(k)===String(v)}">${typeof t==='string'?t:L(t)}</button>`).join(''); };
  box.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b||b.disabled) return; act(why||'seg',()=>set(b.dataset.v)); draw(); });
  draw(); LAB.onLang(draw); SEGS.push(draw); return draw; }
const SEGS=[];
function segsSync(){ SEGS.forEach(f=>f()); }
function toggle(box,key,lab,why){ const b=document.createElement('button'); b.type='button'; b.className='xtog'; box.appendChild(b);
  const draw=()=>{ b.textContent=L(lab); b.setAttribute('aria-pressed',String(!!S.view[key])); };
  b.addEventListener('click',()=>{ act(why||'view',()=>{ S.view[key]=!S.view[key]; if(key==='profile') profSync(); }); draw(); bgDirty=true; }); draw(); LAB.onLang(draw); TOGS.push(draw); return b; }
const TOGS=[];

/* ---------- panel ---------- */
const PN=el('nsPanel');
function sec(id,title,open,extra){ const d=document.createElement('details'); d.className='xsec ns-sec'; d.id=id; if(open) d.open=true; d.innerHTML=`<summary></summary><div class="ns-secb"></div>`; PN.querySelector('.xbody').appendChild(d);
  const s=d.querySelector('summary'); const dr=()=>{ s.innerHTML=L(title)+(extra?`<small>${L(extra)}</small>`:''); }; dr(); LAB.onLang(dr); return d.querySelector('.ns-secb'); }
function grp(box,t){ const e=document.createElement('div'); e.className='grp'; box.appendChild(e); const dr=()=>{ e.textContent=L(t); }; dr(); LAB.onLang(dr); return e; }
function div(box,cls){ const e=document.createElement('div'); if(cls) e.className=cls; box.appendChild(e); return e; }
function buildPanel(){
  PN.innerHTML=`<summary class="xsum"><span></span><span class="xsv" id="nsSv"></span></summary><button type="button" class="ns-drawer" id="nsDrawer" aria-controls="nsPanel"><span class="ns-dri" aria-hidden="true"></span><span class="ns-drt"></span></button><div class="xbody"></div>`;
  el('nsDrawer').addEventListener('click',()=>panelSet(!APP.classList.contains('ns-collapsed'),true));
  const sm=PN.querySelector('.xsum span'); const ds=()=>{ sm.textContent=L(t2('Controls','Kontroller')); }; ds(); LAB.onLang(ds);
  /* mode-specific block (lesson list, practice tasks, scenarios) lives at the top */
  const top=sec('nsTopSec',t2('Lessons','Leksjoner'),true); top.id='nsTop';
  /* aircraft */
  const ac=sec('nsAcSec',t2('Aircraft','Fly'),true);
  grp(ac,t2('Position from the VOR/DME','Posisjon fra VOR/DME'));
  const pos=div(ac,'ns-two');
  numField(pos,{k:'rad',secret:1,label:t2('Radial','Radial'),unit:t2('°M','°M'),wrap:1,step:1,big:10,get:()=>N.radial(refVor(),S.ac),set:v=>placeRel(refVor(),v,Math.max(0.01,N.dist(refVor(),S.ac))),why:'pos'});
  numField(pos,{k:'dme',secret:1,label:t2('Distance','Avstand'),unit:t2('NM','NM'),min:0,max:100,step:0.5,big:5,dec:1,get:()=>N.dist(refVor(),S.ac),set:v=>placeRel(refVor(),N.radial(refVor(),S.ac),Math.max(0.0001,v)),why:'pos'});
  const hd=div(ac,'ns-two');
  numField(hd,{k:'hdg',label:t2('Heading','Kurs'),unit:t2('°M','°M'),wrap:1,step:1,big:10,get:()=>S.run?S.sel.hdg:D.mh,set:v=>setHdg(v),why:'hdg'});
  numField(hd,{k:'alt',label:t2('Altitude','Høyde'),unit:t2('ft','ft'),min:0,max:25000,step:100,big:1000,get:()=>S.run?S.sel.alt:S.ac.alt,set:v=>setAlt(v),why:'alt'});
  const sp=div(ac,'ns-two');
  numField(sp,{k:'tas',label:t2('True airspeed','Sann fart'),unit:t2('kt','kt'),min:60,max:300,step:5,big:20,get:()=>S.ac.tas,set:v=>{ S.ac.tas=v; },why:'tas'});
  numField(sp,{k:'vs',label:t2('Climb/descent','Stige/synke'),unit:t2('ft/min','ft/min'),min:200,max:3000,step:100,big:500,get:()=>S.sel.vs,set:v=>{ S.sel.vs=v; },why:'vs'});
  grp(ac,t2('Autopilot','Autopilot'));
  segment(div(ac),()=>[['HDG','HDG'],['TRK','TRK'],['NAV','NAV'],['APP','APP',!isILS()],['HOLD','HOLD',isILS()],['HOME','HOME']],()=>S.ap,v=>{ S.ap=v; if(v==='HOLD') holdReset(); if(v==='TRK'&&!S.run) S.sel.trk=Math.round(D.trk); },'ap');
  const trw=div(ac,'ns-two'); numField(trw,{k:'trk',label:t2('Selected track','Valgt track'),unit:t2('°M','°M'),wrap:1,step:1,big:10,get:()=>S.sel.trk,set:v=>{ S.sel.trk=v; if(S.ap!=='TRK'){ S.ap='TRK'; } },why:'ap'});
  const apn=div(trw,'note ns-apn'); const apd=()=>{ apn.textContent=L({HDG:t2('Holds the heading bug.','Holder kursmerket.'),TRK:t2('Holds a track: corrects for wind.','Holder en track: korrigerer for vind.'),NAV:t2('Flies the OBS course (or the localiser).','Flyr OBS-kursen (eller localizeren).'),APP:t2('Localiser and glide slope.','Localizer og glidebane.'),HOLD:t2('Flies to the fix and holds.','Flyr til fiksen og holder.'),HOME:t2('Keeps the ADF needle on the nose.','Holder ADF-nålen på nesen.')}[S.ap]); }; APN.push(apd); apd(); LAB.onLang(apd);
  /* radios */
  const rd=sec('nsRadSec',t2('Radios','Radioer'),true);
  grp(rd,t2('NAV 1 (VOR or ILS)','NAV 1 (VOR eller ILS)'));
  segment(div(rd),()=>NAV.filter(n=>n.type!=='NDB').map(n=>[n.id,n.type==='ILS'?n.name:n.id+' '+n.f.toFixed(2)]),()=>S.nav1,v=>{ S.nav1=v; if(isILS()){ S.view.course=true; if(S.ap==='HOLD') S.ap='HDG'; } else if(S.ap==='APP') S.ap='NAV'; bgDirty=true; },'nav');
  const ob=div(rd,'ns-two'); numField(ob,{k:'obs',label:t2('OBS / course','OBS / kurs'),unit:t2('°M','°M'),wrap:1,step:1,big:10,get:()=>S.obs,set:v=>{ S.obs=v; },why:'obs'});
  const obn=div(ob,'note ns-apn'); const obd=()=>{ obn.textContent=isILS()?L(t2('The OBS does not move a localiser needle; set it to the front course anyway.','OBS flytter ikke localizernålen; sett den likevel til frontkursen.')):L(t2('Also the CRS knob on the HSI.','Også CRS-knappen på HSI-en.')); }; APN.push(obd); obd(); LAB.onLang(obd);
  grp(rd,t2('ADF (NDB)','ADF (NDB)'));
  segment(div(rd),()=>NAV.filter(n=>n.type==='NDB').map(n=>[n.id,n.id+' '+n.f]),()=>S.adf,v=>{ S.adf=v; },'adf');
  segment(div(rd,'ns-mt'),()=>[['0',t2('Fixed card','Fast skive')],['1',t2('Movable card','Bevegelig skive')]],()=>S.adfMov?'1':'0',v=>{ S.adfMov=v==='1'; if(S.adfMov) S.adfCard=Math.round(D.mh); },'adfcard');
  /* wind */
  const wd=sec('nsWindSec',t2('Wind','Vind'),true);
  const ww=div(wd,'ns-two');
  numField(ww,{k:'wdir',label:t2('From','Fra'),unit:t2('°T','°R'),wrap:1,step:5,big:30,get:()=>S.wind.dir,set:v=>{ S.wind.dir=v; },why:'wind'});
  numField(ww,{k:'wspd',label:t2('Speed','Fart'),unit:t2('kt','kt'),min:0,max:120,step:1,big:10,get:()=>S.wind.spd,set:v=>{ S.wind.spd=v; },why:'wind'});
  /* show */
  const sh=sec('nsShowSec',t2('Show','Vis'),true); const tg=div(sh,'xtogs');
  [['trace',t2('Trace','Spor')],['course',t2('Course line','Kurslinje')],['tofrom',t2('TO/FROM regions','TO/FROM-områder')],['rings',t2('DME rings','DME-ringer')],['tri',t2('Wind triangle','Vindtrekant')],['brg',t2('ADF bearing','ADF-peiling')],['sectors',t2('Hold and entry sectors','Holding og entry-sektorer')],['profile',t2('Profile view','Profilvisning')]].forEach(([k,l])=>toggle(tg,k,l));
  /* holding */
  const ho=sec('nsHoldSec',t2('Holding','Holding'),false);
  segment(div(ho),()=>[['st',t2('At the VOR','Over VOR-en')],['dme',t2('At a DME fix','På en DME-fiks')]],()=>S.hold.fix,v=>{ S.hold.fix=v; holdReset(); },'hold');
  const h2=div(ho,'ns-two');
  numField(h2,{k:'hrad',label:t2('Fix radial','Fiks-radial'),unit:t2('°M','°M'),wrap:1,step:5,big:30,get:()=>S.hold.rad,set:v=>{ S.hold.rad=v; S.hold.fix='dme'; holdReset(); },why:'hold'});
  numField(h2,{k:'hdme',label:t2('Fix DME','Fiks-DME'),unit:t2('NM','NM'),min:1,max:40,step:1,big:5,get:()=>S.hold.dme,set:v=>{ S.hold.dme=v; S.hold.fix='dme'; holdReset(); },why:'hold'});
  const h3=div(ho,'ns-two');
  numField(h3,{k:'hinb',label:t2('Inbound course','Inngående kurs'),unit:t2('°M','°M'),wrap:1,step:5,big:30,get:()=>S.hold.inb,set:v=>{ S.hold.inb=v; holdReset(); },why:'hold'});
  numField(h3,{k:'hleg',label:t2('Leg','Legg'),unit:t2('min','min'),min:1,max:1.5,step:0.5,big:0.5,dec:1,get:()=>S.hold.leg,set:v=>{ S.hold.leg=v; },why:'hold'});
  segment(div(ho,'ns-mt'),()=>[['1',t2('Right turns','Høyresvinger')],['-1',t2('Left turns','Venstresvinger')]],()=>String(S.hold.dir),v=>{ S.hold.dir=+v; holdReset(); },'hold');
  /* simulation */
  const sm2=sec('nsSimSec',t2('Simulation','Simulering'),true);
  grp(sm2,t2('Speed','Hastighet')); segment(div(sm2),()=>[['1','×1'],['2','×2'],['4','×4'],['8','×8'],['16','×16']],()=>String(S.speed),v=>{ S.speed=+v; },'speed');
  const bt=div(sm2,'btns ns-mt'); bt.innerHTML=`<button type="button" class="btn sm" id="nsClr"></button><button type="button" class="btn sm" id="nsSave"></button><button type="button" class="btn sm" id="nsLoad"></button>`;
  const sn=div(sm2,'note ns-snap'); sn.id='nsSnapN';
  const bd=()=>{ el('nsClr').textContent=L(t2('Clear trace','Fjern spor')); el('nsSave').textContent=L(t2('Save snapshot','Lagre øyeblikksbilde')); el('nsLoad').textContent=L(t2('Load snapshot','Hent øyeblikksbilde')); }; bd(); LAB.onLang(bd);
  el('nsClr').onclick=()=>{ trClear(); redraw(); }; el('nsSave').onclick=snapSave; el('nsLoad').onclick=snapLoad;
  /* Reset: the shell's button in the viewport bar (lesson, task or free flight starts again) */
  LAB.reset(()=>{ if(API.reset) API.reset(); },'nsvp');
  /* advanced */
  const adv=sec('nsAdvSec',t2('Advanced','Avansert'),false);
  grp(adv,t2('Area','Område')); segment(div(adv),()=>Object.keys(AREAS).map(k=>[k,AREAS[k].n]),()=>S.area,v=>{ S.area=v; buildArea(); placeRel(refVor(),S.obs,15); trClear(); },'area');
  grp(adv,t2('Magnetic variation','Misvisning'));
  segment(div(adv),()=>[['0',t2('None','Ingen')],['a',t2(`Area (${AREAS[S.area].varW}° E)`,`Område (${AREAS[S.area].varW}° Ø)`)]],()=>S.varE?'a':'0',v=>{ setVar(v==='a'?AREAS[S.area].varW:0); bgDirty=true; },'var');
  const vn=div(adv,'note'); const vnd=()=>{ vn.textContent=L(t2('Variation from the World Magnetic Model 2025 for 2026. Radials, headings and courses are magnetic; the wind is true. One value is used for the whole area.','Misvisning fra World Magnetic Model 2025 for 2026. Radialer, kurser og kurslinjer er magnetiske; vinden er rettvisende. Én verdi brukes for hele området.')); }; vnd(); LAB.onLang(vnd);
  grp(adv,t2('Map','Kart')); segment(div(adv),()=>[['st',t2('Centre on the station','Midt på stasjonen')],['ac',t2('Centre on the aircraft','Midt på flyet')]],()=>S.view.centre,v=>{ camStart(); S.view.centre=v; bgDirty=true; },'view');
}
const APN=[];
/* the control panel folds into a slim drawer on desktop, so the instruments can grow.
   Default: open in Learn and Practice, folded in Explore and Instructor; a choice the user makes is remembered per mode. */
const APP=el('nsapp');
function panelPref(){ try{ const v=localStorage.getItem('birdbird-navsim-panel-'+S.mode); if(v==='1'||v==='0') return v==='1'; }catch(e){} return S.mode==='explore'||S.mode==='instructor'; }
function panelSet(col,save){ APP.classList.toggle('ns-collapsed',!!col); if(save){ try{ localStorage.setItem('birdbird-navsim-panel-'+S.mode,col?'1':'0'); }catch(e){} }
  const b=el('nsDrawer'); if(b){ b.setAttribute('aria-expanded',String(!col)); b.querySelector('.ns-drt').textContent=col?L(t2('Controls','Kontroller')):L(t2('Hide controls','Skjul kontroller')); b.title=col?L(t2('Show the controls','Vis kontrollene')):L(t2('Fold the controls away for bigger instruments','Legg bort kontrollene for større instrumenter')); }
  bgDirty=true; redraw(); }
/* phones: the instruments the current step needs stay large; the others go into a strip you swipe sideways */
const PHONE=matchMedia('(max-width:640px)'), STRIP=el('nsStrip'), INST=el('nsInst'), DME=el('nsDme'); let focusList=null;
function phoneLayout(){ const gs=['cdi','hsi','rmi','adf'].map(k=>INST.querySelector(`[data-g="${k}"]`)||STRIP.querySelector(`[data-g="${k}"]`));
  const strip=PHONE.matches&&focusList&&focusList.length&&gs.some(w=>focusList.includes(w.dataset.g));
  let nf=0; gs.forEach(w=>{ const inF=!strip||focusList.includes(w.dataset.g); if(inF) nf++; const tgt=inF?INST:STRIP.querySelector('.ns-strw'); if(w.parentNode!==tgt){ if(inF) INST.insertBefore(w,DME); else tgt.appendChild(w); } });
  /* keep the original order inside each container */
  gs.forEach(w=>{ w.parentNode.appendChild(w); }); INST.appendChild(DME);
  STRIP.hidden=!strip; INST.classList.toggle('one',!!strip&&nf===1); }
if(PHONE.addEventListener) PHONE.addEventListener('change',phoneLayout);
function apSync(){ segsSync(); APN.forEach(f=>f()); }

/* ---------- viewport bar: modes and tools ---------- */
const MODES=[['learn',t2('Learn','Lær')],['practice',t2('Practice','Øv')],['explore',t2('Explore','Utforsk')],['instructor',t2('Instructor','Instruktør')]];
function modesDraw(){ el('nsModes').innerHTML=MODES.map(([k,n])=>`<button type="button" role="tab" data-m="${k}" class="${S.mode===k?'on':''}" aria-selected="${S.mode===k}">${L(n)}</button>`).join(''); }
el('nsModes').addEventListener('click',e=>{ const b=e.target.closest('[data-m]'); if(b&&API.setMode) API.setMode(b.dataset.m); });
function toolsDraw(){ const T=el('nsTools'); T.innerHTML=
  `<button type="button" class="go" id="nsRun" aria-keyshortcuts="Space"></button>`+
  `<button type="button" id="nsNorth" aria-keyshortcuts="N"></button><button type="button" id="nsProfB" aria-keyshortcuts="P"></button>`+
  `<button type="button" id="nsZo" aria-label="Zoom out" aria-keyshortcuts="-">−</button><span class="ns-rng" id="nsRng"></span><button type="button" id="nsZi" aria-label="Zoom in" aria-keyshortcuts="+">+</button>`+
  `<button type="button" id="nsKeys" aria-label="Controls" aria-keyshortcuts="?">?</button>`;
  toolsSync(); }
function toolsSync(){ const r=el('nsRun'); if(!r) return; r.textContent=S.run?L(t2('❚❚ Pause','❚❚ Pause')):L(t2('▶ Fly','▶ Fly')); r.setAttribute('aria-pressed',String(S.run));
  el('nsNorth').textContent=S.view.north?L(t2('North up','Nord opp')):L(t2('Heading up','Kurs opp')); el('nsProfB').textContent=L(t2('Profile','Profil')); el('nsProfB').setAttribute('aria-pressed',String(S.view.profile));
  el('nsRng').textContent=S.view.range+' NM'; el('nsKeys').setAttribute('aria-label',L(t2('Controls','Kontroller'))); TOGS.forEach(f=>f()); }
const RANGES=[5,10,20,40,80];
function zoom(d){ camStart(); const i=RANGES.indexOf(S.view.range); S.view.range=RANGES[clamp((i<0?2:i)+d,0,RANGES.length-1)]; bgDirty=true; toolsSync(); redraw(); }
function run(on){ S.run=on===undefined?!S.run:on; if(S.run){ S.sel.hdg=Math.round(D.mh); if(S.ap==='TRK'&&!S.sel.trk) S.sel.trk=Math.round(D.trk); S.sel.alt=Math.round(S.ac.alt); if(S.ap==='HOLD'&&HS.mode==='tofix') holdReset(); } toolsSync(); redraw(); if(API.onRun) API.onRun(S.run); }
el('nsTools').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
  if(b.id==='nsRun') run(); else if(b.id==='nsNorth'){ camStart(); S.view.north=!S.view.north; bgDirty=true; toolsSync(); redraw(); }
  else if(b.id==='nsProfB'){ S.view.profile=!S.view.profile; profSync(); toolsSync(); redraw(); } else if(b.id==='nsZo') zoom(1); else if(b.id==='nsZi') zoom(-1); else if(b.id==='nsKeys') keysSheet(); });
function profSync(){ el('nsProfW').hidden=!S.view.profile; profDirty=true; }

/* ---------- map pointer: drag the aircraft, turn it by its nose handle, tap to place ---------- */
let drag=null;
function hit(e){ const r=mapCv.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top; setView(); P(S.ac.x,S.ac.y); const ax=SX, ay=SY, ha=SA(S.ac.th);
  const hx=ax+Math.sin(ha)*34, hy=ay-Math.cos(ha)*34; return {x,y,ac:Math.hypot(x-ax,y-ay)<26,nose:Math.hypot(x-hx,y-hy)<14,ax,ay}; }
mapCv.addEventListener('pointerdown',e=>{ if(S.view.hideMap) return; const h=hit(e); mapCv.focus({preventScroll:true});
  drag={mode:h.nose?'rot':h.ac?'move':'tap',x0:h.x,y0:h.y,moved:false,b:API.snap?API.snap():null,ox:0,oy:0};
  if(drag.mode==='move'){ const p=unP(h.x,h.y); drag.ox=S.ac.x-p.x; drag.oy=S.ac.y-p.y; }
  mapCv.setPointerCapture(e.pointerId); });
mapCv.addEventListener('pointermove',e=>{ const h=hit(e);
  if(!drag){ const o=hoverAc; hoverAc=h.ac||h.nose; mapCv.style.cursor=h.nose?'grab':h.ac?'move':'crosshair'; if(o!==hoverAc) redraw(); return; }
  if(Math.hypot(h.x-drag.x0,h.y-drag.y0)>3) drag.moved=true;
  if(drag.mode==='move'&&drag.moved){ const p=unP(h.x,h.y); setPos(p.x+drag.ox,p.y+drag.oy); if(!S.run) trClear(); redraw(); }
  else if(drag.mode==='rot'){ const ang=Math.atan2(h.x-h.ax,h.ay-h.y)/D2R+M.rot; S.ac.th=norm(Math.round(N.toMag(ang,S.varE))+S.varE); S.sel.hdg=Math.round(N.toMag(S.ac.th,S.varE)); if(S.run&&S.ap!=='HDG'){ S.ap='HDG'; apSync(); } redraw(); } });
function endDrag(){ if(!drag) return; const d=drag; drag=null;
  if(d.mode==='tap'&&!d.moved){ const p=unP(d.x0,d.y0); act('pos',()=>setPos(p.x,p.y)); return; }
  if(d.moved||d.mode==='rot'){ derive(); redraw(); if(API.why&&d.b) API.why(d.mode==='rot'?'hdg':'pos',d.b); fieldsSync(true); } }
mapCv.addEventListener('pointerup',endDrag); mapCv.addEventListener('pointercancel',()=>{ drag=null; });
mapCv.addEventListener('pointerleave',()=>{ if(hoverAc){ hoverAc=false; redraw(); } });
mapCv.addEventListener('wheel',e=>{ if(document.activeElement!==mapCv) return; e.preventDefault(); zoom(e.deltaY>0?1:-1); },{passive:false});

/* profile: drag up/down to change altitude */
let pdrag=null;
profCv.addEventListener('pointerdown',e=>{ pdrag={y:e.clientY,a:S.ac.alt,b:API.snap?API.snap():null}; profCv.setPointerCapture(e.pointerId); });
profCv.addEventListener('pointermove',e=>{ if(!pdrag) return; const H=PC.h, maxA=D.ils?Math.max(4500,pdrag.a+500):Math.max(8000,Math.ceil((pdrag.a+1500)/2000)*2000); const v=clamp(Math.round((pdrag.a-(e.clientY-pdrag.y)/(H-34)*maxA)/50)*50,0,25000); S.ac.alt=v; S.sel.alt=v; redraw(); });
profCv.addEventListener('pointerup',()=>{ if(pdrag&&API.why&&pdrag.b){ derive(); API.why('alt',pdrag.b); fieldsSync(true); } pdrag=null; });

/* gauge knobs: drag, wheel, keys; and the caption buttons */
function knobSet(id,dv){ act(id==='hdg'?'hdg':id==='card'?'adfcard':'obs',()=>{ if(id==='obs'||id==='crs') S.obs=norm(Math.round(S.obs+dv)); else if(id==='hdg') setHdg(Math.round(S.sel.hdg+dv)); else if(id==='card'){ S.adfMov=true; S.adfCard=norm(Math.round(S.adfCard+dv)); segsSync(); } }); }
document.querySelectorAll('.ns-g').forEach(w=>{ const k=w.dataset.g, G=GA[k], cv=w.querySelector('canvas'); if(!G) return;
  let kd=null;
  const find=e=>{ const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top; return G.knobs.find(q=>Math.hypot(x-q.x,y-q.y)<q.r); };
  cv.addEventListener('pointerdown',e=>{ const q=find(e); if(!q) return; e.preventDefault(); kd={q,y:e.clientY,x:e.clientX,acc:0}; cv.setPointerCapture(e.pointerId); cv.classList.add('turning'); });
  cv.addEventListener('pointermove',e=>{ if(!kd){ cv.style.cursor=find(e)?'ns-resize':''; return; } const d=(kd.y-e.clientY)+(e.clientX-kd.x); kd.x=e.clientX; kd.y=e.clientY; kd.acc+=d; const st=Math.trunc(kd.acc/4); if(st){ kd.acc-=st*4; knobSet(kd.q.id,st); } });
  const up=()=>{ kd=null; cv.classList.remove('turning'); }; cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{ const q=find(e); if(!q) return; e.preventDefault(); knobSet(q.id,(e.deltaY<0?1:-1)*(e.shiftKey?10:1)); },{passive:false});
  cv.addEventListener('keydown',e=>{ const q=G.knobs[e.altKey&&G.knobs[1]?1:0]; if(!q) return; if(e.key==='ArrowRight'||e.key==='ArrowUp'){ e.preventDefault(); e.stopPropagation(); knobSet(q.id,e.shiftKey?10:1); } if(e.key==='ArrowLeft'||e.key==='ArrowDown'){ e.preventDefault(); e.stopPropagation(); knobSet(q.id,e.shiftKey?-10:-1); } });
  w.querySelectorAll('[data-kn]').forEach(b=>{ let rt=0, rp=0; const st=()=>{ clearTimeout(rt); clearInterval(rp); };
    b.addEventListener('pointerdown',e=>{ e.preventDefault(); const dv=+b.dataset.d*(e.shiftKey?10:1); knobSet(b.dataset.kn,dv); st(); rt=setTimeout(()=>{ rp=setInterval(()=>knobSet(b.dataset.kn,+b.dataset.d),60); },380); });
    b.addEventListener('pointerup',st); b.addEventListener('pointerleave',st); b.addEventListener('pointercancel',st);
    b.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); knobSet(b.dataset.kn,+b.dataset.d); } }); }); });

/* ---------- keyboard ---------- */
const VP=el('nsvp');
VP.addEventListener('keydown',e=>{ const tg=e.target; if(tg.closest('input,select,textarea')||e.metaKey||e.ctrlKey) return; if(tg.closest('canvas')&&tg!==mapCv&&e.key.startsWith('Arrow')) return;
  const k=e.key, sh=e.shiftKey; let done=true;
  if(k==='ArrowLeft'||k==='ArrowRight') act('hdg',()=>setHdg(Math.round((S.run?S.sel.hdg:D.mh)+(k==='ArrowRight'?1:-1)*(sh?1:5))));
  else if(k==='ArrowUp'||k==='ArrowDown') act('alt',()=>setAlt((S.run?S.sel.alt:S.ac.alt)+(k==='ArrowUp'?1:-1)*(sh?100:500)));
  else if(k==='['||k===']') act('obs',()=>{ S.obs=norm(S.obs+(k===']'?1:-1)*(sh?1:5)); });
  else if(k===' '){ run(); } else if(k==='n'||k==='N'){ camStart(); S.view.north=!S.view.north; bgDirty=true; toolsSync(); redraw(); }
  else if(k==='p'||k==='P'){ S.view.profile=!S.view.profile; profSync(); toolsSync(); redraw(); }
  else if(k==='t'||k==='T'){ S.view.trace=!S.view.trace; toolsSync(); redraw(); } else if(k==='w'||k==='W'){ S.view.tri=!S.view.tri; toolsSync(); redraw(); }
  else if(k==='+'||k==='=') zoom(-1); else if(k==='-'||k==='_') zoom(1);
  else if(k==='g'||k==='G'){ if(API.guideToggle) API.guideToggle(); } else if(k==='?') keysSheet(); else if(k==='Escape'){ const s=el('nsSheet'); if(s&&!s.hidden){ s.hidden=true; } else done=false; }
  else if(k>='1'&&k<='5'&&!sh){ S.speed=[1,2,4,8,16][+k-1]; segsSync(); }
  else done=false;
  if(done) e.preventDefault(); });
const KEYS=[['Space',t2('Fly / pause','Fly / pause')],['← →',t2('Heading −5 / +5 (Shift: 1°)','Kurs −5 / +5 (Shift: 1°)')],['↑ ↓',t2('Altitude ±500 ft (Shift: 100)','Høyde ±500 ft (Shift: 100)')],['[ ]',t2('OBS −5 / +5 (Shift: 1°)','OBS −5 / +5 (Shift: 1°)')],['1 – 5',t2('Speed ×1 … ×16','Hastighet ×1 … ×16')],['N',t2('North up / heading up','Nord opp / kurs opp')],['P',t2('Profile view','Profilvisning')],['T',t2('Trace on/off','Spor av/på')],['W',t2('Wind triangle','Vindtrekant')],['+ −',t2('Zoom','Zoom')],['G',t2('Guide on/off','Veileder av/på')],['?',t2('This list','Denne listen')],[L(t2('Map','Kart')),t2('Drag the aircraft · drag the blue dot to turn · tap to place','Dra flyet · dra den blå prikken for å svinge · trykk for å plassere')],[L(t2('Knobs','Knapper')),t2('Drag, scroll or use the ◂ ▸ buttons; arrow keys when focused','Dra, rull eller bruk ◂ ▸; piltaster når den har fokus')],[L(t2('Fields','Felt')),t2('Type and Enter, ↑ ↓, scroll, or drag the label','Skriv og Enter, ↑ ↓, rull, eller dra etiketten')]];
function keysSheet(){ const s=el('nsSheet'); if(!s.hidden){ s.hidden=true; return; }
  s.innerHTML=`<div class="ns-sh-h"><b>${L(t2('Controls','Kontroller'))}</b><button type="button" class="ns-x" aria-label="${L(t2('Close','Lukk'))}">×</button></div><dl>${KEYS.map(([k,d])=>`<div><dt><kbd>${k}</kbd></dt><dd>${L(d)}</dd></div>`).join('')}</dl>`;
  s.hidden=false; s.querySelector('.ns-x').onclick=()=>{ s.hidden=true; VP.focus({preventScroll:true}); }; s.querySelector('.ns-x').focus(); }

/* ---------- snapshots ---------- */
const SNK='birdbird-navsim-snap';
function snapSave(){ try{ localStorage.setItem(SNK,JSON.stringify({S:{area:S.area,ac:S.ac,sel:S.sel,ap:S.ap,nav1:S.nav1,obs:S.obs,adf:S.adf,adfMov:S.adfMov,adfCard:S.adfCard,wind:S.wind,varE:S.varE,speed:S.speed,view:S.view,hold:S.hold},t:Date.now()})); snapNote(t2('Snapshot saved in this browser.','Øyeblikksbildet er lagret i denne nettleseren.')); }
  catch(e){ snapNote(t2('Could not save: storage is blocked in this browser.','Kunne ikke lagre: lagring er blokkert i denne nettleseren.')); } }
function snapLoad(){ let j=null; try{ j=JSON.parse(localStorage.getItem(SNK)||'null'); }catch(e){ j=null; }
  if(!j||!j.S){ snapNote(t2('No snapshot saved yet.','Ingen øyeblikksbilder lagret ennå.')); return; }
  act('load',()=>{ const s=j.S; run(false); S.area=AREAS[s.area]?s.area:'bergen'; buildArea(); Object.assign(S.ac,s.ac); Object.assign(S.sel,s.sel); S.ap=s.ap; S.nav1=ST[s.nav1]?s.nav1:S.nav1; S.obs=s.obs; S.adf=ST[s.adf]?s.adf:S.adf; S.adfMov=!!s.adfMov; S.adfCard=s.adfCard||0; Object.assign(S.wind,s.wind); setVar(s.varE||0); S.speed=s.speed||1; Object.assign(S.view,s.view); Object.assign(S.hold,s.hold); profSync(); bgDirty=true; });
  apSync(); toolsSync(); snapNote(t2('Snapshot loaded.','Øyeblikksbildet er hentet.')); }
function snapNote(m){ const n=el('nsSnapN'); n.textContent=L(m); }

/* ---------- focus (dim what the current activity does not use) and masks ---------- */
function focus(list,mask){ focusList=list&&list.length?list:null; phoneLayout(); if(PHONE.matches&&focusList&&focusList.includes('dg')){ const six=el('nsSix'); if(six) six.open=true; } document.querySelectorAll('.ns-inst .ns-g,.ns-strip .ns-g,.ns-dme,.ns-mapw').forEach(w=>{ const k=w.dataset.g||(w.classList.contains('ns-dme')?'dme':'map'); w.classList.toggle('is-dim',!!(list&&list.length&&!list.includes(k))); w.classList.toggle('is-focus',!!(list&&list.includes(k))); w.classList.toggle('is-mask',!!(mask&&mask.includes(k))); });
  const six=el('nsSix'); if(six) six.classList.toggle('is-dim',!!(list&&list.length&&!list.includes('six'))); }

/* ---------- API for navlessons.js ---------- */
const API={S,D,N,ST,HS,t2,L,d3,nf,AREAS,get NAV(){ return NAV; },nav1,adfSt,refVor,holdFix,holdReset,derive,redraw,act,placeRel,setPos,setHdg,setAlt,setVar,buildArea,run,toolsSync,apSync,segsSync,fieldsSync,profSync,trClear,focus,zoom,
  setArea(a){ S.area=a; buildArea(); }, kick, keysSheet, panel(c,save){ panelSet(c===undefined?panelPref():c,save); }, get panelFolded(){ return APP.classList.contains('ns-collapsed'); }, uncap(){ navCap=false; },
  /* fast-forward the simulation (tests and "Show me"): sec of sim time in 0.1 s steps, with the lesson ticks */
  ff(sec){ const n=Math.round(sec/0.1); for(let i=0;i<n;i++){ if(!S.run) break; simStep(0.1); derive(); if(API.onTick) API.onTick(0.1/S.speed); } redraw(); },
  /* a clean state for a lesson or task */
  base(o){ o=o||{}; S.run=false; S.speed=o.speed||1; { const ar=o.area||'bergen'; if(ar!==S.area){ S.area=ar; buildArea(); } }   /* lessons, tasks and Reset are written for Bergen unless they name an area: without this a Reset after changing the area tuned a station that is not there */ setVar(o.varE||0); S.wind.dir=o.wdir??270; S.wind.spd=o.wspd||0;
    S.nav1=o.nav1||refVor().id; S.adf=o.adf||NAV.find(n=>n.type==='NDB').id; S.obs=o.obs??0; S.adfMov=!!o.adfMov; S.adfCard=0; S.ac.tas=o.tas||120; S.ac.alt=o.alt??4000; S.ac.vs=0; S.sel.alt=S.ac.alt; S.sel.vs=1000; S.ap=o.ap||'HDG';
    const v=refVor(); placeRel(o.at||v,o.rad??90,o.dme??15); S.ac.th=N.toTrue(o.hdg??90,S.varE); S.sel.hdg=o.hdg??90; S.sel.trk=o.trk??(o.hdg??90);
    Object.assign(S.view,{north:true,range:o.range||20,profile:!!o.profile,trace:true,course:o.course!==false,tofrom:!!o.tofrom,rings:true,tri:!!o.tri,brg:o.brg!==false,sectors:!!o.sectors,hideMap:!!o.hideMap,centre:'st'});
    if(S.mode!=='instructor') S.view.hideAns=!!(o.hideMap||o.hideAns);
    Object.assign(S.hold,HOLD0,o.hold||{}); holdReset(); trClear();   /* the hold is part of the starting values too (a Reset used to keep a changed hold) */ bgDirty=true; CAM.t=1; profSync(); derive(); apSync(); toolsSync(); segsSync(); fieldsSync(true); redraw(); }};
API.GA=GA; window.NSIM=API;

/* ---------- start ---------- */
buildArea(); buildPanel(); toolsDraw(); modesDraw(); if(PHONE.matches){ const six=el('nsSix'); if(six) six.open=false; }
LAB.onLang(()=>{ modesDraw(); toolsSync(); FIELDS.forEach(f=>f.lang()); panelSet(APP.classList.contains('ns-collapsed')); bgDirty=true; redraw(); });
placeRel('FLS',90,15); S.ac.th=270; S.sel.hdg=270; S.obs=270; derive(); for(const k in GA) GA[k].snap();
if(window.NAVLESSONS&&!API.LESSONS) window.NAVLESSONS(API);
redraw();
})();
