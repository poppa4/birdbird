/* Birdbird – navsim.js: the radio navigation simulator (plan view, profile, instrument panel, controls, guide).
   Geometry comes from navcore.js (NAVCORE), the gauges from navgauges.js (NAVG), the lessons, practice tasks,
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
const COL={bg0:'#0d151c',bg1:'#121d26',land:'#1a2833',landE:'rgba(140,170,190,.3)',ring:'rgba(160,190,210,.13)',ringT:'rgba(170,195,215,.55)',rose:'rgba(200,215,228,.55)',ink:'#E6EBEF',ink2:'#AEB8C1',ink3:'#7D8B95',
  crs:'#F06BB4',to:'rgba(90,160,240,.10)',from:'rgba(99,217,160,.09)',vor:'#63D9A0',ndb:'#E8A85C',adf:'#F5BC4C',ils:'#7FCBE8',ac:'#FFFFFF',trace:'240,107,180',wind:'#7FCBE8',air:'#E6EBEF',gnd:'#63D9A0',hold:'#C9A6F5',warn:'#F0B440',bad:'#EC5A47'};

/* ---------- navaids (OurAirports, public domain, as used by Route Explorer) ---------- */
const AREAS={
 bergen:{n:t2('Bergen (ENBR)','Bergen (ENBR)'),ref:[60.3113,5.2122],varW:2.8,
  nav:[['FLS','Flesland','VOR',115.55,60.3113,5.2122,213],['VOO','Vollo','VOR',114.85,60.5489,5.1288,1050],['STD','Stord','VOR',113.40,59.7873,5.3443,222],
       ['ASK','Askøy','NDB',360,60.422,5.1803,187],['BTA','Bratta','NDB',336,60.0491,5.3005,157]],
  apt:[['ENBR',60.2934,5.2181,170]],
  ils:[{id:'I17',name:'ILS RWY 17',apt:'ENBR',arp:[60.2934,5.2181],len:1.614,crs:174,elev:170}]},
 oslo:{n:t2('Oslo (ENGM)','Oslo (ENGM)'),ref:[60.1918,11.0744],varW:5.2,
  nav:[['GRM','Gardermoen','VOR',115.95,60.1918,11.0744,692],['BBU','Brandbu','VOR',112.75,60.4718,10.3389,2148],['DRA','Drammen','VOR',114.80,59.7333,10.1125,1398],
       ['SLB','Solberg','NDB',414,60.0125,10.9739,600],['OPA','Oppaker','NDB',334,60.2043,11.52,500]],
  apt:[['ENGM',60.1939,11.1004,681]], ils:[]}
};
/* coastline (Natural Earth 1:50m, public domain), clipped to ±60 NM and projected to NM around each area's VOR */
const COAST={"bergen":[[-7.5,46.1,-10.2,45.5,-12.2,46.1,-11.7,52.1,-10.5,52.7,-8.7,53.3,-7.2,50.3,-7.5,46.1],[-3.6,-0.1,-3.6,-7.3,-6.3,-6.7,-7.5,-4.3,-8.1,-2.5,-7.8,1.7,-8.4,5.9,-7.5,8.3,-6.6,8.3,-4.8,4.7,-3.6,-0.1],[22.4,-60.0,24.9,-56.5,29.4,-52.3,32.6,-48.1,35.9,-45.7,35.3,-45.1,31.7,-46.9,28.2,-49.3,24.0,-54.1,19.0,-57.7,15.1,-58.9,13.4,-60.0,-1.8,-60.0,-0.7,-51.7,0.8,-45.1,2.6,-40.3,5.6,-39.1,7.7,-36.1,9.4,-36.1,10.9,-37.3,16.6,-39.1,19.5,-34.9,23.1,-34.3,29.9,-29.5,29.7,-28.9,25.2,-29.5,22.5,-30.1,18.4,-31.3,16.3,-30.1,15.4,-27.1,16.9,-24.1,23.4,-16.9,25.5,-13.9,26.7,-10.9,26.7,-8.5,27.6,-4.9,33.8,2.3,38.9,5.9,40.4,2.9,39.2,-6.1,39.2,-9.7,43.0,3.5,44.8,6.5,46.9,8.3,51.6,10.1,53.1,11.9,47.5,11.3,33.8,6.5,27.9,2.3,26.4,-1.3,22.5,-6.1,20.4,-9.7,19.8,-14.5,17.5,-16.9,14.5,-18.1,10.3,-24.1,8.3,-28.9,4.1,-33.1,1.4,-36.1,0.5,-37.3,-0.7,-40.3,-1.8,-40.3,-3.0,-38.5,-3.3,-34.9,-2.7,-28.9,-0.7,-24.1,0.2,-19.9,-1.3,-15.7,-0.1,-13.3,1.7,-13.3,5.0,-14.5,8.3,-14.5,14.2,-11.5,13.3,-9.7,10.6,-9.1,6.2,-9.7,2.3,-6.1,-1.0,-0.1,-2.1,8.3,-1.3,10.1,10.0,18.5,13.0,22.7,11.2,22.7,7.1,18.5,0.8,15.5,-2.7,19.7,-4.8,23.9,-6.0,32.9,-5.7,37.7,-6.0,43.7,-3.3,45.5,-0.7,44.3,2.3,44.3,8.8,44.9,22.8,48.5,32.0,46.1,35.9,46.1,41.5,49.7,46.6,49.7,50.2,47.3,52.2,44.9,52.5,40.7,54.3,38.3,55.5,39.5,54.6,42.5,54.3,46.7,60.0,48.7,60.0,51.9,58.2,51.5,51.3,50.9,46.9,52.7,43.0,53.9,41.5,55.1,42.1,58.1,41.2,58.7,39.5,55.7,38.0,50.3,34.7,49.1,25.8,51.5,13.0,50.3,7.1,47.3,3.2,47.9,-3.0,52.7,-5.7,56.3,-6.1,60.0,60.0,60.0,60.0,-60.0]],"oslo":[[-7.6,-60.0,-10.0,-53.5,-13.0,-48.1,-13.3,-45.7,-13.3,-35.5,-14.1,-30.7,-14.1,-25.9,-16.2,-29.5,-15.0,-36.1,-17.4,-39.1,-20.1,-40.3,-19.8,-43.9,-18.6,-45.1,-18.6,-48.7,-19.2,-54.7,-21.5,-60.0,-60.0,-60.0,-60.0,60.0,60.0,60.0,60.0,-60.0]]};

/* ---------- state ---------- */
const S={area:'bergen',ac:{x:0,y:0,th:90,alt:4000,tas:120,vs:0},sel:{hdg:90,trk:90,alt:4000,vs:1000},ap:'HDG',nav1:'FLS',obs:90,adf:'ASK',adfMov:false,adfCard:0,
  wind:{dir:270,spd:0},varE:0,run:false,speed:1,t:0,
  view:{north:true,range:20,profile:false,trace:true,course:true,tofrom:false,rings:true,labels:true,sectors:false,tri:false,brg:true,hideMap:false,hideAns:false,centre:'st'},
  hold:{fix:'st',rad:180,dme:10,inb:360,dir:1,leg:1},mode:'learn',guide:true};
let ST={}, NAV=[], ILS=[], APT=[], LAND=[];
function buildArea(){ const A=AREAS[S.area], [la0,lo0]=A.ref; ST={}; NAV=[]; ILS=[]; APT=[];
  A.nav.forEach(n=>{ const p=N.proj(n[4],n[5],la0,lo0); const o={id:n[0],name:n[1],type:n[2],f:n[3],x:p.x,y:p.y,elev:n[6],var:S.varE}; ST[o.id]=o; NAV.push(o); });
  A.apt.forEach(a=>{ const p=N.proj(a[1],a[2],la0,lo0); APT.push({id:a[0],x:p.x,y:p.y,elev:a[3]}); });
  A.ils.forEach(i=>{ const p=N.proj(i.arp[0],i.arp[1],la0,lo0), u=[Math.sin(i.crs*D2R),Math.cos(i.crs*D2R)], h=i.len/2;
    const thr={x:p.x-u[0]*h,y:p.y-u[1]*h}, end={x:p.x+u[0]*h,y:p.y+u[1]*h};
    const o={id:i.id,name:i.name,type:'ILS',apt:i.apt,crs:i.crs,elev:i.elev,thr,end,x:end.x+u[0]*0.16,y:end.y+u[1]*0.16,gp:{x:thr.x+u[0]*0.16,y:thr.y+u[1]*0.16},gpa:3,var:S.varE};
    ST[o.id]=o; ILS.push(o); NAV.push(o); });
  LAND=(COAST[S.area]||[]).map(a=>Float32Array.from(a));
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
let lastHdg=0, rateNow=0, navCap=false;
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
  turnToward(want,dir,dt);
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
/* view transform (module-level numbers, no allocation) */
const M={cx:0,cy:0,k:1,ox:0,oy:0,c:1,s:0,rot:0};
function setView(){ const W=MC.w,H=MC.h, v=S.view, a=S.ac;
  M.k=Math.min(W,H)/2/v.range*0.92; M.rot= v.north?0:a.th; M.c=Math.cos(M.rot*D2R); M.s=Math.sin(M.rot*D2R);
  if(!v.north){ M.ox=a.x; M.oy=a.y; M.cx=W/2; M.cy=H*0.62; }
  else if(v.centre==='ac'){ M.ox=a.x; M.oy=a.y; M.cx=W/2; M.cy=H/2; }
  else { const c=refCentre(); M.ox=c.x; M.oy=c.y; M.cx=W/2; M.cy=H/2; } }
const refCentre=()=>{ const n=nav1(); return n.type==='ILS'?n.thr:n; };
let SX=0, SY=0;
function P(x,y){ const dx=x-M.ox, dy=y-M.oy; const rx=dx*M.c-dy*M.s, ry=dx*M.s+dy*M.c; SX=M.cx+rx*M.k; SY=M.cy-ry*M.k; }
function unP(sx,sy){ const rx=(sx-M.cx)/M.k, ry=(M.cy-sy)/M.k; return {x:M.ox+rx*M.c+ry*M.s, y:M.oy-rx*M.s+ry*M.c}; }
/* screen angle (radians, canvas rotate) for a true bearing */
const SA=b=>(b-M.rot)*D2R;

/* ---------- labels that never overlap ---------- */
const LB=[]; for(let i=0;i<48;i++) LB.push({x:0,y:0,w:0,h:0,t:'',c:'',bg:'',f:'',pr:0});
const PLACED=new Float32Array(48*4); let lbN=0;
function label(x,y,t,c,f,bg){ if(lbN>=LB.length) return; const o=LB[lbN++]; o.x=x; o.y=y; o.t=t; o.c=c; o.f=f||`500 11px ${FM}`; o.bg=bg||'rgba(9,13,17,.78)'; }
const OFFS=[[9,-9],[9,13],[-9,-9],[-9,13],[0,-16],[0,20],[16,3],[-16,3]];
function flushLabels(g,W,H){ let np=0; g.textBaseline='middle';
  for(let i=0;i<lbN;i++){ const o=LB[i]; g.font=o.f; const w=g.measureText(o.t).width+10, h=17; let ok=false, bx=0, by=0;
    for(let j=0;j<OFFS.length&&!ok;j++){ const ox=OFFS[j][0], oy=OFFS[j][1]; bx= ox>0?o.x+ox: ox<0? o.x+ox-w : o.x-w/2; by=o.y+oy-h/2;
      if(bx<2||by<2||bx+w>W-2||by+h>H-2) continue; ok=true;
      for(let k=0;k<np;k++){ const px=PLACED[k*4],py=PLACED[k*4+1],pw=PLACED[k*4+2],ph=PLACED[k*4+3]; if(bx<px+pw&&bx+w>px&&by<py+ph&&by+h>py){ ok=false; break; } } }
    if(!ok) continue;
    PLACED[np*4]=bx; PLACED[np*4+1]=by; PLACED[np*4+2]=w; PLACED[np*4+3]=h; np++;
    g.fillStyle=o.bg; rrect(g,bx,by,w,h,3); g.fill(); g.fillStyle=o.c; g.textAlign='left'; g.fillText(o.t,bx+5,by+h/2+0.5); }
  lbN=0; }
function rrect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function arrowHead(g,x,y,ang,sz,col){ g.fillStyle=col; g.beginPath(); g.moveTo(x+Math.sin(ang)*sz,y-Math.cos(ang)*sz); g.lineTo(x+Math.sin(ang+2.6)*sz*0.8,y-Math.cos(ang+2.6)*sz*0.8); g.lineTo(x+Math.sin(ang-2.6)*sz*0.8,y-Math.cos(ang-2.6)*sz*0.8); g.closePath(); g.fill(); }

/* ---------- the plan view ---------- */
function drawBg(g,W,H){
  const gr=g.createRadialGradient(W*0.5,H*0.4,0,W*0.5,H*0.5,Math.max(W,H)*0.75); gr.addColorStop(0,COL.bg1); gr.addColorStop(1,COL.bg0); g.fillStyle=gr; g.fillRect(0,0,W,H);
  /* land */
  g.fillStyle=COL.land; g.strokeStyle=COL.landE; g.lineWidth=1;
  for(const poly of LAND){ g.beginPath(); for(let i=0;i<poly.length;i+=2){ P(poly[i],poly[i+1]); if(i) g.lineTo(SX,SY); else g.moveTo(SX,SY); } g.closePath(); g.fill(); g.stroke(); }
  /* faint grid every 10 NM */
  g.strokeStyle='rgba(255,255,255,.025)'; const step=S.view.range>40?20:10, ext=S.view.range*2;
  for(let i=-ext;i<=ext;i+=step){ P(M.ox+i-((M.ox)%step),M.oy-ext); const x1=SX,y1=SY; P(M.ox+i-((M.ox)%step),M.oy+ext); g.beginPath(); g.moveTo(x1,y1); g.lineTo(SX,SY); g.stroke();
    P(M.ox-ext,M.oy+i-((M.oy)%step)); const x2=SX,y2=SY; P(M.ox+ext,M.oy+i-((M.oy)%step)); g.beginPath(); g.moveTo(x2,y2); g.lineTo(SX,SY); g.stroke(); }
  const v=refVor();
  /* DME rings */
  if(S.view.rings){ const rs=S.view.range<=10?2:S.view.range<=20?5:S.view.range<=40?10:20; P(v.x,v.y); const cx=SX, cy=SY;
    g.font=`500 10px ${FM}`; g.textAlign='center'; g.textBaseline='middle';
    for(let r=rs;r<=S.view.range*2.2;r+=rs){ g.strokeStyle=COL.ring; g.lineWidth=1; g.setLineDash(r%(rs*2)?[2,5]:[]); g.beginPath(); g.arc(cx,cy,r*M.k,0,TAU); g.stroke(); g.setLineDash([]);
      const a=SA(N.toTrue(135,S.varE)); g.fillStyle=COL.ringT; g.fillText(String(r),cx+Math.sin(a)*r*M.k,cy-Math.cos(a)*r*M.k); } }
  /* compass rose round the VOR (magnetic) */
  P(v.x,v.y); roseAt(g,SX,SY,Math.min(W,H)*0.36,v.var);
  /* airports and runways */
  for(const ap of APT){ P(ap.x,ap.y); g.strokeStyle='rgba(230,235,239,.5)'; g.lineWidth=1.2; g.beginPath(); g.arc(SX,SY,5,0,TAU); g.stroke(); }
  for(const i of ILS){ P(i.thr.x,i.thr.y); const x1=SX,y1=SY; P(i.end.x,i.end.y); g.strokeStyle='#C9D2D8'; g.lineWidth=Math.max(3,0.03*M.k); g.lineCap='butt'; g.beginPath(); g.moveTo(x1,y1); g.lineTo(SX,SY); g.stroke(); }
}
function roseAt(g,cx,cy,R,vr){ g.save(); g.translate(cx,cy); g.rotate(SA(N.toTrue(0,vr)));
  g.strokeStyle=COL.rose; g.fillStyle=COL.rose; g.font=`500 10px ${FM}`; g.textAlign='center'; g.textBaseline='middle';
  for(let a=0;a<360;a+=5){ const t=a*D2R, l=a%30===0?10:a%10===0?6:3; g.lineWidth=a%30===0?1.3:0.8; g.globalAlpha=a%10===0?1:0.6; g.beginPath(); g.moveTo(Math.sin(t)*R,-Math.cos(t)*R); g.lineTo(Math.sin(t)*(R-l),-Math.cos(t)*(R-l)); g.stroke(); }
  g.globalAlpha=1; for(let a=0;a<360;a+=30){ const t=a*D2R; g.save(); g.translate(Math.sin(t)*(R-20),-Math.cos(t)*(R-20)); g.rotate(-SA(N.toTrue(0,vr))); g.fillText(a===0?'N':d3(a),0,0); g.restore(); }
  g.restore(); }
function vorSym(g,x,y,sel){ g.save(); g.translate(x,y); g.strokeStyle=sel?COL.vor:'rgba(99,217,160,.6)'; g.lineWidth=1.6; g.fillStyle='rgba(10,16,20,.9)';
  g.beginPath(); for(let i=0;i<6;i++){ const t=i*Math.PI/3; if(i) g.lineTo(Math.cos(t)*8,Math.sin(t)*8); else g.moveTo(8,0); } g.closePath(); g.fill(); g.stroke();
  g.strokeRect(-10,-8,20,16); g.fillStyle=sel?COL.vor:'rgba(99,217,160,.6)'; g.beginPath(); g.arc(0,0,1.8,0,TAU); g.fill(); g.restore(); }
function ndbSym(g,x,y,sel){ g.fillStyle=sel?COL.ndb:'rgba(232,168,92,.55)'; for(let r=4;r<=12;r+=4){ const n=r*1.6|0; for(let i=0;i<n;i++){ const t=i*TAU/n; g.beginPath(); g.arc(x+Math.cos(t)*r,y+Math.sin(t)*r,1.1,0,TAU); g.fill(); } } g.beginPath(); g.arc(x,y,2.2,0,TAU); g.fill(); }
function acShape(g,sz){ /* top view of a light twin, nose up, size = half span */
  const s=sz/12; g.beginPath(); g.moveTo(0,-11*s); g.bezierCurveTo(1.4*s,-10.5*s,1.6*s,-8*s,1.6*s,-5*s); g.lineTo(1.6*s,-2.4*s); g.lineTo(12*s,-0.6*s); g.lineTo(12*s,1.2*s); g.lineTo(1.6*s,1.6*s);
  g.lineTo(1.1*s,7*s); g.lineTo(4.6*s,8.2*s); g.lineTo(4.6*s,9.6*s); g.lineTo(0,9.2*s); g.lineTo(-4.6*s,9.6*s); g.lineTo(-4.6*s,8.2*s); g.lineTo(-1.1*s,7*s); g.lineTo(-1.6*s,1.6*s); g.lineTo(-12*s,1.2*s); g.lineTo(-12*s,-0.6*s); g.lineTo(-1.6*s,-2.4*s); g.lineTo(-1.6*s,-5*s); g.bezierCurveTo(-1.6*s,-8*s,-1.4*s,-10.5*s,0,-11*s); g.closePath();
  g.moveTo(5.6*s,-3.4*s); g.lineTo(5.6*s,-0.6*s); g.moveTo(-5.6*s,-3.4*s); g.lineTo(-5.6*s,-0.6*s); }
let hoverAc=false;
function drawMap(){
  const g=MC.ctx, W=MC.w, H=MC.h; if(!W) return; setView();
  const fixedBg=S.view.north&&S.view.centre!=='ac';
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
  for(const i of ILS){ const sel=n===i, back=N.norm(i.crs+180); P(i.x,i.y); const lx=SX, ly=SY; const an=SA(back);
    g.save(); g.strokeStyle=sel?'rgba(127,203,232,.9)':'rgba(127,203,232,.35)'; g.lineWidth=1.2; g.setLineDash([8,6]); g.beginPath(); g.moveTo(lx,ly); g.lineTo(lx+Math.sin(an)*M.k*18,ly-Math.cos(an)*M.k*18); g.stroke(); g.setLineDash([]);
    const f=M.k*12, sp=2.5*D2R; g.fillStyle=sel?'rgba(127,203,232,.16)':'rgba(127,203,232,.06)'; g.beginPath(); g.moveTo(lx,ly); g.lineTo(lx+Math.sin(an-sp)*f,ly-Math.cos(an-sp)*f); g.lineTo(lx+Math.sin(an)*f*0.94,ly-Math.cos(an)*f*0.94); g.lineTo(lx+Math.sin(an+sp)*f,ly-Math.cos(an+sp)*f); g.closePath(); g.fill(); g.stroke(); g.restore();
    label(lx+Math.sin(an)*f,ly-Math.cos(an)*f,i.name,COL.ils); }
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
    const tr=N.toTrue(D.trk,S.varE), L2=D.gs/30*M.k, ta=SA(tr); g.strokeStyle='rgba(230,235,239,.35)'; g.lineWidth=1; g.setLineDash([4,4]); g.beginPath(); g.moveTo(ax,ay); g.lineTo(ax+Math.sin(ta)*L2,ay-Math.cos(ta)*L2); g.stroke(); g.setLineDash([]);
    /* wind triangle */
    if(S.view.tri) drawTri(g,ax,ay);
    /* aircraft */
    const ha=SA(a.th); g.save(); g.translate(ax,ay); g.rotate(ha);
    if(hoverAc||drag){ g.strokeStyle='rgba(127,203,232,.5)'; g.lineWidth=1; g.beginPath(); g.arc(0,0,22,0,TAU); g.stroke(); }
    g.shadowColor='rgba(0,0,0,.6)'; g.shadowBlur=6; g.shadowOffsetY=2; g.fillStyle=COL.ac; acShape(g,15); g.fill(); g.shadowBlur=0; g.shadowOffsetY=0;
    g.strokeStyle='rgba(13,21,28,.8)'; g.lineWidth=0.8; g.stroke();
    /* heading handle */
    g.strokeStyle='rgba(127,203,232,.7)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(0,-18); g.lineTo(0,-30); g.stroke(); g.fillStyle='#7FCBE8'; g.beginPath(); g.arc(0,-34,4.5,0,TAU); g.fill(); g.restore();
    if(!hideA) label(ax,ay,'HDG '+d3(D.mh),COL.ink,`600 11px ${FM}`);
    /* off the map: an arrow on the edge */
    if(ax<0||ay<0||ax>W||ay>H){ const cx=W/2, cy=H/2, an=Math.atan2(ax-cx,cy-ay), ex=clamp(ax,18,W-18), ey=clamp(ay,18,H-18); arrowHead(g,ex,ey,an,12,COL.warn); label(ex,ey,L(t2('aircraft','flyet'))+' '+nf(Math.hypot(a.x-M.ox,a.y-M.oy),0)+' NM',COL.warn); }
  } else { g.fillStyle='rgba(9,13,17,.7)'; g.fillRect(0,H-40,W,40); g.fillStyle=COL.warn; g.font=`600 13px ${FB}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(L(t2('Map hidden: read the instruments','Kartet er skjult: les instrumentene')),W/2,H-20); }
  flushLabels(g,W,H);
  /* wind arrow (top right), north arrow, scale */
  windBadge(g,W);
  g.save(); g.translate(22,H-46); g.rotate(SA(0)); g.fillStyle=COL.ink2; g.beginPath(); g.moveTo(0,-11); g.lineTo(5,5); g.lineTo(0,2); g.lineTo(-5,5); g.closePath(); g.fill(); g.restore(); g.fillStyle=COL.ink2; g.font=`600 10px ${FM}`; g.textAlign='center'; g.fillText('N',22,H-62);
  const nmL=S.view.range>=40?10:S.view.range>=20?5:S.view.range>=10?2:1, px=nmL*M.k; g.strokeStyle=COL.ink2; g.lineWidth=1.4; g.beginPath(); g.moveTo(14,H-16); g.lineTo(14+px,H-16); g.moveTo(14,H-20); g.lineTo(14,H-12); g.moveTo(14+px,H-20); g.lineTo(14+px,H-12); g.stroke();
  g.textAlign='left'; g.fillText(nmL+' NM',20+px,H-15);
  g.textAlign='right'; g.fillStyle=COL.ink3; g.font=`500 10px ${FM}`; g.fillText(S.view.north?L(t2('NORTH UP','NORD OPP')):L(t2('HEADING UP','KURS OPP')),W-10,H-12);
  mapDirty=false; }
function windBadge(g,W){ const x=W-40, y=42; g.fillStyle='rgba(9,13,17,.7)'; g.beginPath(); g.arc(x,y,26,0,TAU); g.fill(); g.strokeStyle='rgba(127,203,232,.25)'; g.lineWidth=1; g.stroke();
  if(S.wind.spd>0){ const an=SA(S.wind.dir+180); g.strokeStyle=COL.wind; g.lineWidth=2; g.beginPath(); g.moveTo(x-Math.sin(an)*16,y+Math.cos(an)*16); g.lineTo(x+Math.sin(an)*12,y-Math.cos(an)*12); g.stroke(); arrowHead(g,x+Math.sin(an)*16,y-Math.cos(an)*16,an,7,COL.wind); }
  g.fillStyle=COL.ink; g.font=`600 10.5px ${FM}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(S.wind.spd>0?d3(S.wind.dir)+'/'+Math.round(S.wind.spd):L(t2('CALM','STILLE')),x,y+38); g.fillStyle=COL.ink3; g.font=`500 9px ${FM}`; g.fillText(L(t2('WIND','VIND')),x,y-34); }
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
  const u=[Math.sin(I*D2R),Math.cos(I*D2R)], nn=[u[1]*d,-u[0]*d];
  P(f.x,f.y); const fx=SX, fy=SY;
  /* racetrack: inbound leg ends at the fix; outbound leg offset 2R to the holding side */
  const p1x=f.x-u[0]*legNm, p1y=f.y-u[1]*legNm, c1x=f.x+nn[0]*R, c1y=f.y+nn[1]*R, c2x=p1x+nn[0]*R, c2y=p1y+nn[1]*R;
  g.strokeStyle=COL.hold; g.fillStyle='rgba(201,166,245,.07)'; g.lineWidth=2.2; g.lineJoin='round'; g.beginPath(); P(p1x,p1y); g.moveTo(SX,SY); P(f.x,f.y); g.lineTo(SX,SY);
  const steps=24; for(let i=1;i<=steps;i++){ const t=(i/steps)*Math.PI, cx=c1x-nn[0]*R*Math.cos(t)+u[0]*R*Math.sin(t), cy=c1y-nn[1]*R*Math.cos(t)+u[1]*R*Math.sin(t); P(cx,cy); g.lineTo(SX,SY); }
  P(c2x+nn[0]*R,c2y+nn[1]*R); g.lineTo(SX,SY);
  for(let i=1;i<=steps;i++){ const t=(i/steps)*Math.PI, cx=c2x+nn[0]*R*Math.cos(t)-u[0]*R*Math.sin(t), cy=c2y+nn[1]*R*Math.cos(t)-u[1]*R*Math.sin(t); P(cx,cy); g.lineTo(SX,SY); }
  g.closePath(); g.fill(); g.stroke(); arrowHead(g,fx,fy,SA(I),9,COL.hold);
  /* fix */
  g.fillStyle=COL.hold; g.beginPath(); g.moveTo(fx,fy-7); g.lineTo(fx+6,fy+5); g.lineTo(fx-6,fy+5); g.closePath(); g.fill();
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
  if(TXT.chip!==h){ TXT.chip=h; c.innerHTML=h; } }

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
  PN.innerHTML=`<summary class="xsum"><span></span><span class="xsv" id="nsSv"></span></summary><div class="xbody"></div>`;
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
  const bt=div(sm2,'btns ns-mt'); bt.innerHTML=`<button type="button" class="btn sm" id="nsClr"></button><button type="button" class="btn sm" id="nsSave"></button><button type="button" class="btn sm" id="nsLoad"></button><button type="button" class="btn sm quiet" id="nsReset"></button>`;
  const sn=div(sm2,'note ns-snap'); sn.id='nsSnapN';
  const bd=()=>{ el('nsClr').textContent=L(t2('Clear trace','Fjern spor')); el('nsSave').textContent=L(t2('Save snapshot','Lagre øyeblikksbilde')); el('nsLoad').textContent=L(t2('Load snapshot','Hent øyeblikksbilde')); el('nsReset').textContent=L(t2('Reset','Tilbakestill')); }; bd(); LAB.onLang(bd);
  el('nsClr').onclick=()=>{ trClear(); redraw(); }; el('nsSave').onclick=snapSave; el('nsLoad').onclick=snapLoad; el('nsReset').onclick=()=>{ if(API.reset) API.reset(); };
  /* advanced */
  const adv=sec('nsAdvSec',t2('Advanced','Avansert'),false);
  grp(adv,t2('Area','Område')); segment(div(adv),()=>Object.keys(AREAS).map(k=>[k,AREAS[k].n]),()=>S.area,v=>{ S.area=v; buildArea(); placeRel(refVor(),S.obs,15); trClear(); },'area');
  grp(adv,t2('Magnetic variation','Misvisning'));
  segment(div(adv),()=>[['0',t2('None','Ingen')],['a',t2(`Area (${AREAS[S.area].varW}° E)`,`Område (${AREAS[S.area].varW}° Ø)`)]],()=>S.varE?'a':'0',v=>{ setVar(v==='a'?AREAS[S.area].varW:0); bgDirty=true; },'var');
  const vn=div(adv,'note'); const vnd=()=>{ vn.textContent=L(t2('Variation from the World Magnetic Model 2025 for 2026. Radials, headings and courses are magnetic; the wind is true. One value is used for the whole area.','Misvisning fra World Magnetic Model 2025 for 2026. Radialer, kurser og kurslinjer er magnetiske; vinden er rettvisende. Én verdi brukes for hele området.')); }; vnd(); LAB.onLang(vnd);
  grp(adv,t2('Map','Kart')); segment(div(adv),()=>[['st',t2('Centre on the station','Midt på stasjonen')],['ac',t2('Centre on the aircraft','Midt på flyet')]],()=>S.view.centre,v=>{ S.view.centre=v; bgDirty=true; },'view');
}
const APN=[];
function apSync(){ segsSync(); APN.forEach(f=>f()); }

/* ---------- viewport bar: modes and tools ---------- */
const MODES=[['learn',t2('Learn','Lær')],['practice',t2('Practice','Øv')],['explore',t2('Explore','Utforsk')],['instructor',t2('Instructor','Instruktør')]];
function modesDraw(){ el('nsModes').innerHTML=MODES.map(([k,n])=>`<button type="button" role="tab" data-m="${k}" class="${S.mode===k?'on':''}" aria-selected="${S.mode===k}">${L(n)}</button>`).join(''); }
el('nsModes').addEventListener('click',e=>{ const b=e.target.closest('[data-m]'); if(b&&API.setMode) API.setMode(b.dataset.m); });
function toolsDraw(){ const T=el('nsTools'); T.innerHTML=
  `<button type="button" class="go" id="nsRun" aria-keyshortcuts="Space"></button>`+
  `<button type="button" id="nsNorth" aria-keyshortcuts="N"></button><button type="button" id="nsProfB" aria-keyshortcuts="P"></button>`+
  `<button type="button" id="nsZo" aria-label="Zoom out" aria-keyshortcuts="-">−</button><span class="ns-rng" id="nsRng"></span><button type="button" id="nsZi" aria-label="Zoom in" aria-keyshortcuts="+">+</button>`+
  `<button type="button" id="nsKeys" aria-label="Keyboard shortcuts" aria-keyshortcuts="?">?</button>`;
  toolsSync(); }
function toolsSync(){ const r=el('nsRun'); if(!r) return; r.textContent=S.run?L(t2('❚❚ Pause','❚❚ Pause')):L(t2('▶ Fly','▶ Fly')); r.setAttribute('aria-pressed',String(S.run));
  el('nsNorth').textContent=S.view.north?L(t2('North up','Nord opp')):L(t2('Heading up','Kurs opp')); el('nsProfB').textContent=L(t2('Profile','Profil')); el('nsProfB').setAttribute('aria-pressed',String(S.view.profile));
  el('nsRng').textContent=S.view.range+' NM'; TOGS.forEach(f=>f()); }
const RANGES=[5,10,20,40,80];
function zoom(d){ const i=RANGES.indexOf(S.view.range); S.view.range=RANGES[clamp((i<0?2:i)+d,0,RANGES.length-1)]; bgDirty=true; toolsSync(); redraw(); }
function run(on){ S.run=on===undefined?!S.run:on; if(S.run){ S.sel.hdg=Math.round(D.mh); if(S.ap==='TRK'&&!S.sel.trk) S.sel.trk=Math.round(D.trk); S.sel.alt=Math.round(S.ac.alt); if(S.ap==='HOLD'&&HS.mode==='tofix') holdReset(); } toolsSync(); redraw(); if(API.onRun) API.onRun(S.run); }
el('nsTools').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
  if(b.id==='nsRun') run(); else if(b.id==='nsNorth'){ S.view.north=!S.view.north; bgDirty=true; toolsSync(); redraw(); }
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
  else if(k===' '){ run(); } else if(k==='n'||k==='N'){ S.view.north=!S.view.north; bgDirty=true; toolsSync(); redraw(); }
  else if(k==='p'||k==='P'){ S.view.profile=!S.view.profile; profSync(); toolsSync(); redraw(); }
  else if(k==='t'||k==='T'){ S.view.trace=!S.view.trace; toolsSync(); redraw(); } else if(k==='w'||k==='W'){ S.view.tri=!S.view.tri; toolsSync(); redraw(); }
  else if(k==='+'||k==='=') zoom(-1); else if(k==='-'||k==='_') zoom(1);
  else if(k==='g'||k==='G'){ if(API.guideToggle) API.guideToggle(); } else if(k==='?') keysSheet(); else if(k==='Escape'){ const s=el('nsSheet'); if(s&&!s.hidden){ s.hidden=true; } else done=false; }
  else if(k>='1'&&k<='5'&&!sh){ S.speed=[1,2,4,8,16][+k-1]; segsSync(); }
  else done=false;
  if(done) e.preventDefault(); });
const KEYS=[['Space',t2('Fly / pause','Fly / pause')],['← →',t2('Heading −5 / +5 (Shift: 1°)','Kurs −5 / +5 (Shift: 1°)')],['↑ ↓',t2('Altitude ±500 ft (Shift: 100)','Høyde ±500 ft (Shift: 100)')],['[ ]',t2('OBS −5 / +5 (Shift: 1°)','OBS −5 / +5 (Shift: 1°)')],['1 – 5',t2('Speed ×1 … ×16','Hastighet ×1 … ×16')],['N',t2('North up / heading up','Nord opp / kurs opp')],['P',t2('Profile view','Profilvisning')],['T',t2('Trace on/off','Spor av/på')],['W',t2('Wind triangle','Vindtrekant')],['+ −',t2('Zoom','Zoom')],['G',t2('Guide on/off','Veileder av/på')],['?',t2('This list','Denne listen')],[L(t2('Map','Kart')),t2('Drag the aircraft · drag the blue dot to turn · tap to place','Dra flyet · dra den blå prikken for å svinge · trykk for å plassere')],[L(t2('Knobs','Knapper')),t2('Drag, scroll or use the ◂ ▸ buttons; arrow keys when focused','Dra, rull eller bruk ◂ ▸; piltaster når den har fokus')],[L(t2('Fields','Felt')),t2('Type and Enter, ↑ ↓, scroll, or drag the label','Skriv og Enter, ↑ ↓, rull, eller dra etiketten')]];
function keysSheet(){ const s=el('nsSheet'); if(!s.hidden){ s.hidden=true; return; }
  s.innerHTML=`<div class="ns-sh-h"><b>${L(t2('Keyboard and touch','Tastatur og berøring'))}</b><button type="button" class="ns-x" aria-label="${L(t2('Close','Lukk'))}">×</button></div><dl>${KEYS.map(([k,d])=>`<div><dt><kbd>${k}</kbd></dt><dd>${L(d)}</dd></div>`).join('')}</dl>`;
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
function focus(list,mask){ document.querySelectorAll('.ns-inst .ns-g,.ns-dme,.ns-mapw').forEach(w=>{ const k=w.dataset.g||(w.classList.contains('ns-dme')?'dme':'map'); w.classList.toggle('is-dim',!!(list&&list.length&&!list.includes(k))); w.classList.toggle('is-focus',!!(list&&list.includes(k))); w.classList.toggle('is-mask',!!(mask&&mask.includes(k))); });
  const six=el('nsSix'); if(six) six.classList.toggle('is-dim',!!(list&&list.length&&!list.includes('six'))); }

/* ---------- API for navlessons.js ---------- */
const API={S,D,N,ST,HS,t2,L,d3,nf,AREAS,get NAV(){ return NAV; },nav1,adfSt,refVor,holdFix,holdReset,derive,redraw,act,placeRel,setPos,setHdg,setAlt,setVar,buildArea,run,toolsSync,apSync,segsSync,fieldsSync,profSync,trClear,focus,zoom,
  setArea(a){ S.area=a; buildArea(); }, kick, keysSheet, uncap(){ navCap=false; },
  /* fast-forward the simulation (tests and "Show me"): sec of sim time in 0.1 s steps, with the lesson ticks */
  ff(sec){ const n=Math.round(sec/0.1); for(let i=0;i<n;i++){ if(!S.run) break; simStep(0.1); derive(); if(API.onTick) API.onTick(0.1/S.speed); } redraw(); },
  /* a clean state for a lesson or task */
  base(o){ o=o||{}; S.run=false; S.speed=o.speed||1; if(o.area&&o.area!==S.area){ S.area=o.area; buildArea(); } setVar(o.varE||0); S.wind.dir=o.wdir??270; S.wind.spd=o.wspd||0;
    S.nav1=o.nav1||refVor().id; S.adf=o.adf||NAV.find(n=>n.type==='NDB').id; S.obs=o.obs??0; S.adfMov=!!o.adfMov; S.adfCard=0; S.ac.tas=o.tas||120; S.ac.alt=o.alt??4000; S.ac.vs=0; S.sel.alt=S.ac.alt; S.sel.vs=1000; S.ap=o.ap||'HDG';
    const v=refVor(); placeRel(o.at||v,o.rad??90,o.dme??15); S.ac.th=N.toTrue(o.hdg??90,S.varE); S.sel.hdg=o.hdg??90; S.sel.trk=o.trk??(o.hdg??90);
    Object.assign(S.view,{north:true,range:o.range||20,profile:!!o.profile,trace:true,course:o.course!==false,tofrom:!!o.tofrom,rings:true,tri:!!o.tri,brg:o.brg!==false,sectors:!!o.sectors,hideMap:!!o.hideMap,centre:'st'});
    if(S.mode!=='instructor') S.view.hideAns=!!(o.hideMap||o.hideAns);
    if(o.hold) Object.assign(S.hold,o.hold); holdReset(); trClear(); bgDirty=true; profSync(); derive(); apSync(); toolsSync(); segsSync(); fieldsSync(true); redraw(); }};
API.GA=GA; window.NSIM=API;

/* ---------- start ---------- */
buildArea(); buildPanel(); toolsDraw(); modesDraw();
LAB.onLang(()=>{ modesDraw(); toolsSync(); FIELDS.forEach(f=>f.lang()); bgDirty=true; redraw(); });
placeRel('FLS',90,15); S.ac.th=270; S.sel.hdg=270; S.obs=270; derive(); for(const k in GA) GA[k].snap();
if(window.NAVLESSONS&&!API.LESSONS) window.NAVLESSONS(API);
redraw();
})();
