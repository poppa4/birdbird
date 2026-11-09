/* Birdbird – navmap.js: the shared plan-view map of the navigation labs (radionav.html, gnss.html, holding.html).
   One look everywhere: relief and coastline (data/navsim-<region>.png/.json, Mapzen/AWS Terrain Tiles via terrain/hr),
   palette, navaid/fix/waypoint symbols, runways, ILS feathers, racetracks, the aircraft, labels that never overlap,
   wind badge, north arrow and scale bar.
   Frame: the same flat local projection as navcore.js (NAVCORE.proj around the region's main VOR), x east, y north, NM.
   Pure parts (views, transforms, fitting, label placement, region geometry) need no DOM and are tested in
   tests/navmap.test.mjs; the drawing parts take a CanvasRenderingContext2D in CSS pixels.
   Usage:  const m=NAVMAP.create(canvas,{region:'bergen',onLoad:redraw});  m.set({cx,cy,k,ox,oy,rot});
           m.drawBase(g,W,H);  m.P(x,y) → m.sx, m.sy;  m.label(...);  m.drawNorth(g,H);  m.drawScaleBar(g,H);  m.flushLabels(g,W,H). */
(function(root){
'use strict';
const D2R=Math.PI/180, TAU=Math.PI*2;
const FM='"IBM Plex Mono", ui-monospace, monospace', FB='"Public Sans", system-ui, sans-serif';
const COL={bg0:'#0d151c',bg1:'#121d26',land:'#1a2833',landE:'rgba(140,170,190,.3)',coast:'rgba(150,182,204,.38)',grid:'rgba(255,255,255,.025)',
  ring:'rgba(160,190,210,.13)',ringT:'rgba(170,195,215,.55)',rose:'rgba(200,215,228,.55)',ink:'#E6EBEF',ink2:'#AEB8C1',ink3:'#7D8B95',
  vor:'#63D9A0',ndb:'#E8A85C',ils:'#7FCBE8',rwy:'#C9D2D8',ac:'#FFFFFF',wind:'#7FCBE8',hold:'#C9A6F5',warn:'#F0B440',bad:'#EC5A47',wp:'#E6EBEF',lbBg:'rgba(9,13,17,.78)'};
const t2=(en,no)=>({en,no});
const L=o=>root.LAB&&root.LAB.L?root.LAB.L(o):o.en;
const norm=a=>{ a=a%360; if(a<0) a+=360; return a; };
const d3=a=>{ const v=Math.round(norm(a))%360; return String(v===0?360:v).padStart(3,'0'); };
const proj=(lat,lon,lat0,lon0)=>({x:(lon-lon0)*60*Math.cos(lat0*D2R),y:(lat-lat0)*60});

/* ---------- regions: navaids (OurAirports, public domain, as used by Route Explorer) ---------- */
const REGIONS={
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
/* coarse coastline (Natural Earth 1:50m, public domain), clipped to ±60 NM and projected to NM around each region's VOR: shown until the relief loads */
const COAST={"bergen":[[-7.5,46.1,-10.2,45.5,-12.2,46.1,-11.7,52.1,-10.5,52.7,-8.7,53.3,-7.2,50.3,-7.5,46.1],[-3.6,-0.1,-3.6,-7.3,-6.3,-6.7,-7.5,-4.3,-8.1,-2.5,-7.8,1.7,-8.4,5.9,-7.5,8.3,-6.6,8.3,-4.8,4.7,-3.6,-0.1],[22.4,-60.0,24.9,-56.5,29.4,-52.3,32.6,-48.1,35.9,-45.7,35.3,-45.1,31.7,-46.9,28.2,-49.3,24.0,-54.1,19.0,-57.7,15.1,-58.9,13.4,-60.0,-1.8,-60.0,-0.7,-51.7,0.8,-45.1,2.6,-40.3,5.6,-39.1,7.7,-36.1,9.4,-36.1,10.9,-37.3,16.6,-39.1,19.5,-34.9,23.1,-34.3,29.9,-29.5,29.7,-28.9,25.2,-29.5,22.5,-30.1,18.4,-31.3,16.3,-30.1,15.4,-27.1,16.9,-24.1,23.4,-16.9,25.5,-13.9,26.7,-10.9,26.7,-8.5,27.6,-4.9,33.8,2.3,38.9,5.9,40.4,2.9,39.2,-6.1,39.2,-9.7,43.0,3.5,44.8,6.5,46.9,8.3,51.6,10.1,53.1,11.9,47.5,11.3,33.8,6.5,27.9,2.3,26.4,-1.3,22.5,-6.1,20.4,-9.7,19.8,-14.5,17.5,-16.9,14.5,-18.1,10.3,-24.1,8.3,-28.9,4.1,-33.1,1.4,-36.1,0.5,-37.3,-0.7,-40.3,-1.8,-40.3,-3.0,-38.5,-3.3,-34.9,-2.7,-28.9,-0.7,-24.1,0.2,-19.9,-1.3,-15.7,-0.1,-13.3,1.7,-13.3,5.0,-14.5,8.3,-14.5,14.2,-11.5,13.3,-9.7,10.6,-9.1,6.2,-9.7,2.3,-6.1,-1.0,-0.1,-2.1,8.3,-1.3,10.1,10.0,18.5,13.0,22.7,11.2,22.7,7.1,18.5,0.8,15.5,-2.7,19.7,-4.8,23.9,-6.0,32.9,-5.7,37.7,-6.0,43.7,-3.3,45.5,-0.7,44.3,2.3,44.3,8.8,44.9,22.8,48.5,32.0,46.1,35.9,46.1,41.5,49.7,46.6,49.7,50.2,47.3,52.2,44.9,52.5,40.7,54.3,38.3,55.5,39.5,54.6,42.5,54.3,46.7,60.0,48.7,60.0,51.9,58.2,51.5,51.3,50.9,46.9,52.7,43.0,53.9,41.5,55.1,42.1,58.1,41.2,58.7,39.5,55.7,38.0,50.3,34.7,49.1,25.8,51.5,13.0,50.3,7.1,47.3,3.2,47.9,-3.0,52.7,-5.7,56.3,-6.1,60.0,60.0,60.0,60.0,-60.0]],"oslo":[[-7.6,-60.0,-10.0,-53.5,-13.0,-48.1,-13.3,-45.7,-13.3,-35.5,-14.1,-30.7,-14.1,-25.9,-16.2,-29.5,-15.0,-36.1,-17.4,-39.1,-20.1,-40.3,-19.8,-43.9,-18.6,-45.1,-18.6,-48.7,-19.2,-54.7,-21.5,-60.0,-60.0,-60.0,-60.0,60.0,60.0,60.0,60.0,-60.0]]};

/* region geometry in NM (fresh objects each call): stations, airports, ILS (threshold, runway end, LOC and GP antennas) */
function build(region,varE){ const A=REGIONS[region], [la0,lo0]=A.ref, ST={}, NAV=[], APT=[], ILS=[]; varE=varE||0;
  A.nav.forEach(n=>{ const p=proj(n[4],n[5],la0,lo0); const o={id:n[0],name:n[1],type:n[2],f:n[3],x:p.x,y:p.y,elev:n[6],var:varE}; ST[o.id]=o; NAV.push(o); });
  A.apt.forEach(a=>{ const p=proj(a[1],a[2],la0,lo0); APT.push({id:a[0],x:p.x,y:p.y,elev:a[3]}); });
  A.ils.forEach(i=>{ const p=proj(i.arp[0],i.arp[1],la0,lo0), u=[Math.sin(i.crs*D2R),Math.cos(i.crs*D2R)], h=i.len/2;
    const thr={x:p.x-u[0]*h,y:p.y-u[1]*h}, end={x:p.x+u[0]*h,y:p.y+u[1]*h};
    const o={id:i.id,name:i.name,type:'ILS',apt:i.apt,crs:i.crs,elev:i.elev,len:i.len,arp:{x:p.x,y:p.y},u,thr,end,x:end.x+u[0]*0.16,y:end.y+u[1]*0.16,gp:{x:thr.x+u[0]*0.16,y:thr.y+u[1]*0.16},gpa:3,var:varE};
    ST[o.id]=o; ILS.push(o); NAV.push(o); });
  return {ST,NAV,APT,ILS,ref:A.ref,varW:A.varW}; }

/* ---------- views and transforms (pure) ---------- */
/* a view: screen centre (cx, cy px) shows the point (ox, oy NM); k px per NM; rot = the true bearing that points up (0 = north up) */
function view(o){ return setView({cx:0,cy:0,k:1,ox:0,oy:0,rot:0,c:1,s:0},o); }
function setView(v,o){ if(o) for(const k in o) if(k!=='c'&&k!=='s') v[k]=o[k]; v.c=Math.cos(v.rot*D2R); v.s=Math.sin(v.rot*D2R); return v; }
function toPx(v,x,y,out){ const dx=x-v.ox, dy=y-v.oy; out=out||{x:0,y:0}; out.x=v.cx+(dx*v.c-dy*v.s)*v.k; out.y=v.cy-(dx*v.s+dy*v.c)*v.k; return out; }
function toNm(v,sx,sy,out){ const rx=(sx-v.cx)/v.k, ry=(v.cy-sy)/v.k; out=out||{x:0,y:0}; out.x=v.ox+rx*v.c+ry*v.s; out.y=v.oy-rx*v.s+ry*v.c; return out; }
/* canvas rotation (radians) that points along a true bearing on screen */
const screenAngle=(v,brg)=>(brg-v.rot)*D2R;
/* fit a box {x0,x1,y0,y1} (NM) in W×H px with pixel margins m {l,r,t,b}, an NM pad round it, a minimum NM span and a zoom cap */
function fit(b,W,H,m,o){ m=m||{}; o=o||{}; const l=m.l||0, r=m.r||0, t=m.t||0, bt=m.b||0, pad=o.pad||0, mn=o.min||1e-6;
  const k=Math.min((W-l-r)/Math.max(mn,b.x1-b.x0+2*pad),(H-t-bt)/Math.max(mn,b.y1-b.y0+2*pad));
  return {k:Math.min(k,o.maxK||Infinity),ox:(b.x0+b.x1)/2,oy:(b.y0+b.y1)/2,cx:l+(W-l-r)/2,cy:t+(H-t-bt)/2,rot:0}; }
/* ease between two views (e 0..1): zoom in log space, rotation the short way round */
function lerpView(a,b,e,out){ const l=(p,q)=>p+(q-p)*e; let dr=norm(b.rot-a.rot); if(dr>180) dr-=360;
  return setView(out||view(),{k:Math.exp(l(Math.log(a.k),Math.log(b.k))),rot:norm(a.rot+dr*e),ox:l(a.ox,b.ox),oy:l(a.oy,b.oy),cx:l(a.cx,b.cx),cy:l(a.cy,b.cy)}); }
/* scale bar length: the first of the nice lengths at least minPx long */
const NICE=[0.5,1,2,5,10,20,50];
function niceScale(k,minPx){ minPx=minPx||50; for(const v of NICE) if(v*k>=minPx) return v; return NICE[NICE.length-1]; }

/* label placement: try the offsets round the anchor in order; the first box inside W×H that hits no earlier box wins.
   boxes: Float32Array of x,y,w,h quads (n used). Returns true and writes the box to out, or false. */
const OFFS=[[9,-9],[9,13],[-9,-9],[-9,13],[0,-16],[0,20],[16,3],[-16,3]], OFFC=[[0,0]].concat(OFFS);
function placeLabel(x,y,w,h,W,H,boxes,n,out,offs){ offs=offs||OFFS;
  for(let j=0;j<offs.length;j++){ const ox=offs[j][0], oy=offs[j][1], bx= ox>0?x+ox: ox<0? x+ox-w : x-w/2, by=y+oy-h/2;
    if(bx<2||by<2||bx+w>W-2||by+h>H-2) continue; let ok=true;
    for(let k=0;k<n;k++){ const px=boxes[k*4],py=boxes[k*4+1],pw=boxes[k*4+2],ph=boxes[k*4+3]; if(bx<px+pw&&bx+w>px&&by<py+ph&&by+h>py){ ok=false; break; } }
    if(ok){ out.x=bx; out.y=by; return true; } }
  return false; }

/* ---------- relief and coastline (one load per region, shared by every map on the page) ---------- */
const TLO=[19,29,37], THI=[56,69,78], TER={};
function load(region){ let t=TER[region]; if(t) return t.p;
  t=TER[region]={path:null,cv:null,R:62,subs:[],p:null}; const tell=()=>{ for(const f of t.subs) try{ f(region); }catch(e){} };
  const pj=(typeof fetch==='function'?fetch('data/navsim-'+region+'.json').then(r=>r.ok?r.json():null):Promise.resolve(null)).then(j=>{ if(!j) return; const u=j.unit, p=new Path2D();
    for(const q of j.rings){ for(let i=0;i<q.length;i+=2){ const x=q[i]*u, y=-q[i+1]*u; if(i) p.lineTo(x,y); else p.moveTo(x,y); } p.closePath(); }
    t.path=p; t.R=j.R; tell(); }).catch(()=>{});
  const pi=new Promise(res=>{ if(typeof Image!=='function') return res(); const im=new Image();
    im.onload=()=>{ try{ const c=document.createElement('canvas'); c.width=im.width; c.height=im.height; const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(im,0,0);
        const id=g.getImageData(0,0,c.width,c.height), d=id.data;
        for(let i=0;i<d.length;i+=4){ const v=d[i]; const s=v?Math.min(1,(v-6)/249):0; d[i]=TLO[0]+(THI[0]-TLO[0])*s; d[i+1]=TLO[1]+(THI[1]-TLO[1])*s; d[i+2]=TLO[2]+(THI[2]-TLO[2])*s; d[i+3]=255; }
        g.putImageData(id,0,0); t.cv=c; tell(); }catch(e){} res(); };
    im.onerror=()=>res(); im.src='data/navsim-'+region+'.png'; });
  t.p=Promise.all([pj,pi]).then(()=>t); return t.p; }

/* ---------- symbols (screen px, any context) ---------- */
function rrect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function arrowHead(g,x,y,ang,sz,col){ g.fillStyle=col; g.beginPath(); g.moveTo(x+Math.sin(ang)*sz,y-Math.cos(ang)*sz); g.lineTo(x+Math.sin(ang+2.6)*sz*0.8,y-Math.cos(ang+2.6)*sz*0.8); g.lineTo(x+Math.sin(ang-2.6)*sz*0.8,y-Math.cos(ang-2.6)*sz*0.8); g.closePath(); g.fill(); }
function drawVor(g,x,y,sel){ g.save(); g.translate(x,y); g.strokeStyle=sel?COL.vor:'rgba(99,217,160,.6)'; g.lineWidth=1.6; g.fillStyle='rgba(10,16,20,.9)';
  g.beginPath(); for(let i=0;i<6;i++){ const t=i*Math.PI/3; if(i) g.lineTo(Math.cos(t)*8,Math.sin(t)*8); else g.moveTo(8,0); } g.closePath(); g.fill(); g.stroke();
  g.strokeRect(-10,-8,20,16); g.fillStyle=sel?COL.vor:'rgba(99,217,160,.6)'; g.beginPath(); g.arc(0,0,1.8,0,TAU); g.fill(); g.restore(); }
function drawNdb(g,x,y,sel){ g.fillStyle=sel?COL.ndb:'rgba(232,168,92,.55)'; for(let r=4;r<=12;r+=4){ const n=r*1.6|0; for(let i=0;i<n;i++){ const t=i*TAU/n; g.beginPath(); g.arc(x+Math.cos(t)*r,y+Math.sin(t)*r,1.1,0,TAU); g.fill(); } } g.beginPath(); g.arc(x,y,2.2,0,TAU); g.fill(); }
/* a fix (triangle), e.g. a holding fix or an approach fix */
function drawFix(g,x,y,col){ g.fillStyle=col||COL.ink; g.strokeStyle='rgba(9,13,17,.9)'; g.lineWidth=1.5; g.lineJoin='miter'; g.beginPath(); g.moveTo(x,y-7); g.lineTo(x+6,y+5); g.lineTo(x-6,y+5); g.closePath(); g.stroke(); g.fill(); }
/* an RNAV waypoint (four-point star), circled when fly-over */
function drawWaypoint(g,x,y,o){ o=o||{}; const r=8; g.fillStyle='rgba(10,16,20,.9)'; g.strokeStyle=o.col||COL.wp; g.lineWidth=1.5; g.lineJoin='miter';
  if(o.over){ g.beginPath(); g.arc(x,y,9,0,TAU); g.fill(); g.stroke(); }
  g.beginPath(); for(let i=0;i<8;i++){ const a=i*Math.PI/4, q=i%2?r*0.38:r; g.lineTo(x+Math.sin(a)*q,y-Math.cos(a)*q); } g.closePath(); g.fill(); g.stroke(); }
function drawAirport(g,x,y){ g.strokeStyle='rgba(230,235,239,.5)'; g.lineWidth=1.2; g.beginPath(); g.arc(x,y,5,0,TAU); g.stroke(); }
/* top view of a light twin, nose up, size = half span */
function acShape(g,sz){ const s=sz/12; g.beginPath(); g.moveTo(0,-11*s); g.bezierCurveTo(1.4*s,-10.5*s,1.6*s,-8*s,1.6*s,-5*s); g.lineTo(1.6*s,-2.4*s); g.lineTo(12*s,-0.6*s); g.lineTo(12*s,1.2*s); g.lineTo(1.6*s,1.6*s);
  g.lineTo(1.1*s,7*s); g.lineTo(4.6*s,8.2*s); g.lineTo(4.6*s,9.6*s); g.lineTo(0,9.2*s); g.lineTo(-4.6*s,9.6*s); g.lineTo(-4.6*s,8.2*s); g.lineTo(-1.1*s,7*s); g.lineTo(-1.6*s,1.6*s); g.lineTo(-12*s,1.2*s); g.lineTo(-12*s,-0.6*s); g.lineTo(-1.6*s,-2.4*s); g.lineTo(-1.6*s,-5*s); g.bezierCurveTo(-1.6*s,-8*s,-1.4*s,-10.5*s,0,-11*s); g.closePath();
  g.moveTo(5.6*s,-3.4*s); g.lineTo(5.6*s,-0.6*s); g.moveTo(-5.6*s,-3.4*s); g.lineTo(-5.6*s,-0.6*s); }
/* the aircraft at screen x, y pointing along screen angle ang (radians); o.size, o.ring (hover/drag ring), o.handle (heading handle) */
function aircraftAt(g,x,y,ang,o){ o=o||{}; g.save(); g.translate(x,y); g.rotate(ang);
  if(o.ring){ g.strokeStyle='rgba(127,203,232,.5)'; g.lineWidth=1; g.beginPath(); g.arc(0,0,22,0,TAU); g.stroke(); }
  g.shadowColor='rgba(0,0,0,.6)'; g.shadowBlur=6; g.shadowOffsetY=2; g.fillStyle=o.col||COL.ac; acShape(g,o.size||15); g.fill(); g.shadowBlur=0; g.shadowOffsetY=0;
  g.strokeStyle='rgba(13,21,28,.8)'; g.lineWidth=0.8; g.stroke();
  if(o.handle){ g.strokeStyle='rgba(127,203,232,.7)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(0,-18); g.lineTo(0,-30); g.stroke(); g.fillStyle='#7FCBE8'; g.beginPath(); g.arc(0,-34,4.5,0,TAU); g.fill(); }
  g.restore(); }

/* ---------- a map ---------- */
function create(canvas,o){ o=o||{};
  const m={canvas:canvas||null,v:view(),sx:0,sy:0,region:null,onLoad:o.onLoad||null,COL,FM,FB};
  const v=m.v, sub=r=>{ if(r===m.region&&m.onLoad) m.onLoad(r); };
  m.set=p=>setView(v,p);
  /* NM → screen px into m.sx, m.sy (no allocation); and back */
  m.P=(x,y)=>{ const dx=x-v.ox, dy=y-v.oy; m.sx=v.cx+(dx*v.c-dy*v.s)*v.k; m.sy=v.cy-(dx*v.s+dy*v.c)*v.k; };
  m.unP=(sx,sy)=>toNm(v,sx,sy);
  m.sa=b=>(b-v.rot)*D2R;
  /* pointer event → canvas px (and NM) */
  m.evPx=e=>{ const r=m.canvas.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; };
  m.evNm=e=>{ const p=m.evPx(e); return toNm(v,p.x,p.y); };
  m.setRegion=r=>{ if(m.region===r) return; m.region=r; const t=TER[r]; load(r); if(TER[r].subs.indexOf(sub)<0) TER[r].subs.push(sub); return t; };
  m.terrain=()=>TER[m.region]||null;
  if(o.region) m.setRegion(o.region);

  /* background, relief (or the coarse coastline while it loads) and a faint 10/20 NM grid. o.range: half the view in NM (grid extent) */
  m.drawBase=(g,W,H,op)=>{ op=op||{};
    const gr=g.createRadialGradient(W*0.5,H*0.4,0,W*0.5,H*0.5,Math.max(W,H)*0.75); gr.addColorStop(0,COL.bg1); gr.addColorStop(1,COL.bg0); g.fillStyle=gr; g.fillRect(0,0,W,H);
    const T=m.terrain();
    if(T&&T.path){ g.save(); g.translate(v.cx,v.cy); g.rotate(-v.rot*D2R); g.scale(v.k,v.k); g.translate(-v.ox,v.oy);
      if(T.cv){ g.save(); g.clip(T.path,'evenodd'); g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high'; g.drawImage(T.cv,-T.R,-T.R,2*T.R,2*T.R); g.restore(); } else { g.fillStyle=COL.land; g.fill(T.path,'evenodd'); }
      g.strokeStyle=COL.coast; g.lineWidth=1/v.k; g.lineJoin='round'; g.stroke(T.path);
      g.restore(); }
    else { g.fillStyle=COL.land; g.strokeStyle=COL.landE; g.lineWidth=1;
      for(const poly of (COAST[m.region]||[])){ g.beginPath(); for(let i=0;i<poly.length;i+=2){ m.P(poly[i],poly[i+1]); if(i) g.lineTo(m.sx,m.sy); else g.moveTo(m.sx,m.sy); } g.closePath(); g.fill(); g.stroke(); } }
    if(op.grid===false) return;
    const range=op.range||Math.max(W,H)/2/v.k; g.strokeStyle=COL.grid; const step=range>40?20:10, ext=range*2;
    for(let i=-ext;i<=ext;i+=step){ m.P(v.ox+i-((v.ox)%step),v.oy-ext); const x1=m.sx,y1=m.sy; m.P(v.ox+i-((v.ox)%step),v.oy+ext); g.beginPath(); g.moveTo(x1,y1); g.lineTo(m.sx,m.sy); g.stroke();
      m.P(v.ox-ext,v.oy+i-((v.oy)%step)); const x2=m.sx,y2=m.sy; m.P(v.ox+ext,v.oy+i-((v.oy)%step)); g.beginPath(); g.moveTo(x2,y2); g.lineTo(m.sx,m.sy); g.stroke(); } };
  /* DME rings round (x, y NM) every step NM out to max, numbered along the true bearing labelBrg */
  m.drawRings=(g,x,y,step,max,labelBrg)=>{ m.P(x,y); const cx=m.sx, cy=m.sy;
    g.font=`500 10px ${FM}`; g.textAlign='center'; g.textBaseline='middle';
    for(let r=step;r<=max;r+=step){ g.strokeStyle=COL.ring; g.lineWidth=1; g.setLineDash(r%(step*2)?[2,5]:[]); g.beginPath(); g.arc(cx,cy,r*v.k,0,TAU); g.stroke(); g.setLineDash([]);
      const a=m.sa(labelBrg); g.fillStyle=COL.ringT; g.fillText(String(r),cx+Math.sin(a)*r*v.k,cy-Math.cos(a)*r*v.k); } };
  /* magnetic compass rose (radius R px) round (x, y NM), variation varE (East +) */
  m.drawRose=(g,x,y,R,varE)=>{ m.P(x,y); const rn=m.sa(norm(varE||0)); g.save(); g.translate(m.sx,m.sy); g.rotate(rn);
    g.strokeStyle=COL.rose; g.fillStyle=COL.rose; g.font=`500 10px ${FM}`; g.textAlign='center'; g.textBaseline='middle';
    for(let a=0;a<360;a+=5){ const t=a*D2R, l=a%30===0?10:a%10===0?6:3; g.lineWidth=a%30===0?1.3:0.8; g.globalAlpha=a%10===0?1:0.6; g.beginPath(); g.moveTo(Math.sin(t)*R,-Math.cos(t)*R); g.lineTo(Math.sin(t)*(R-l),-Math.cos(t)*(R-l)); g.stroke(); }
    g.globalAlpha=1; for(let a=0;a<360;a+=30){ const t=a*D2R; g.save(); g.translate(Math.sin(t)*(R-20),-Math.cos(t)*(R-20)); g.rotate(-rn); g.fillText(a===0?'N':d3(a),0,0); g.restore(); }
    g.restore(); };
  m.drawRunway=(g,thr,end)=>{ m.P(thr.x,thr.y); const x1=m.sx,y1=m.sy; m.P(end.x,end.y); g.strokeStyle=COL.rwy; g.lineWidth=Math.max(3,0.03*v.k); g.lineCap='butt'; g.beginPath(); g.moveTo(x1,y1); g.lineTo(m.sx,m.sy); g.stroke(); };
  /* ILS: dashed extended centreline (o.cl NM) and the localiser feather (12 NM); o.label: text at the feather's end */
  m.drawIls=(g,i,sel,op)=>{ op=op||{}; m.P(i.x,i.y); const lx=m.sx, ly=m.sy, an=m.sa(norm(i.crs+180)), cl=op.cl||18;
    g.save(); g.strokeStyle=sel?'rgba(127,203,232,.9)':'rgba(127,203,232,.35)'; g.lineWidth=1.2; g.setLineDash([8,6]); g.beginPath(); g.moveTo(lx,ly); g.lineTo(lx+Math.sin(an)*v.k*cl,ly-Math.cos(an)*v.k*cl); g.stroke(); g.setLineDash([]);
    const f=v.k*12, sp=2.5*D2R; g.fillStyle=sel?'rgba(127,203,232,.16)':'rgba(127,203,232,.06)'; g.beginPath(); g.moveTo(lx,ly); g.lineTo(lx+Math.sin(an-sp)*f,ly-Math.cos(an-sp)*f); g.lineTo(lx+Math.sin(an)*f*0.94,ly-Math.cos(an)*f*0.94); g.lineTo(lx+Math.sin(an+sp)*f,ly-Math.cos(an+sp)*f); g.closePath(); g.fill(); g.stroke(); g.restore();
    if(op.label) m.label(lx+Math.sin(an)*f,ly-Math.cos(an)*f,op.label,COL.ils); };
  /* a holding racetrack (still air): inbound leg on the true course inb ending at fix f, turns dir (+1 right), radius R and leg length legNm (NM).
     o: col, fill, lw, dash, arrow ('fix': at the fix, 'mid': halfway down the inbound leg), sz */
  m.racetrack=(g,f,inb,dir,R,legNm,op)=>{ op=op||{}; const u=[Math.sin(inb*D2R),Math.cos(inb*D2R)], nn=[u[1]*dir,-u[0]*dir], col=op.col||COL.hold;
    const p1={x:f.x-u[0]*legNm,y:f.y-u[1]*legNm}, c1={x:f.x+nn[0]*R,y:f.y+nn[1]*R}, c2={x:p1.x+nn[0]*R,y:p1.y+nn[1]*R};
    g.save(); g.strokeStyle=col; g.lineWidth=op.lw||2.2; g.setLineDash(op.dash||[]); g.lineJoin='round'; g.beginPath(); m.P(p1.x,p1.y); g.moveTo(m.sx,m.sy); m.P(f.x,f.y); g.lineTo(m.sx,m.sy);
    for(let i=1;i<=24;i++){ const t=i/24*Math.PI; m.P(c1.x-nn[0]*R*Math.cos(t)+u[0]*R*Math.sin(t),c1.y-nn[1]*R*Math.cos(t)+u[1]*R*Math.sin(t)); g.lineTo(m.sx,m.sy); }
    m.P(c2.x+nn[0]*R,c2.y+nn[1]*R); g.lineTo(m.sx,m.sy);
    for(let i=1;i<=24;i++){ const t=i/24*Math.PI; m.P(c2.x+nn[0]*R*Math.cos(t)-u[0]*R*Math.sin(t),c2.y+nn[1]*R*Math.cos(t)-u[1]*R*Math.sin(t)); g.lineTo(m.sx,m.sy); }
    g.closePath(); if(op.fill){ g.fillStyle=op.fill; g.fill(); } g.stroke(); g.restore();
    if(op.arrow==='mid'){ m.P(f.x-u[0]*legNm*0.5,f.y-u[1]*legNm*0.5); arrowHead(g,m.sx,m.sy,m.sa(inb),op.sz||7,col); }
    else if(op.arrow!==false){ m.P(f.x,f.y); arrowHead(g,m.sx,m.sy,m.sa(inb),op.sz||9,col); }
    return {p1,c1,c2,u,nn,mid:{x:f.x-u[0]*legNm*0.5+nn[0]*R,y:f.y-u[1]*legNm*0.5+nn[1]*R}}; };
  m.drawVor=drawVor; m.drawNdb=drawNdb; m.drawFix=drawFix; m.drawWaypoint=drawWaypoint; m.drawAirport=drawAirport; m.arrowHead=arrowHead; m.rrect=rrect;
  /* navaid at its NM position: VOR or NDB symbol */
  m.drawNavaid=(g,s,sel)=>{ m.P(s.x,s.y); if(s.type==='NDB') drawNdb(g,m.sx,m.sy,sel); else drawVor(g,m.sx,m.sy,sel); };
  /* the aircraft at (x, y NM) on the true heading hdg; o as aircraftAt */
  m.drawAircraft=(g,x,y,hdg,op)=>{ m.P(x,y); aircraftAt(g,m.sx,m.sy,m.sa(hdg),op); };
  /* wind badge (top right): wind from dir (true) at spd kt */
  m.drawWind=(g,W,dir,spd)=>{ const x=W-40, y=42; g.fillStyle='rgba(9,13,17,.7)'; g.beginPath(); g.arc(x,y,26,0,TAU); g.fill(); g.strokeStyle='rgba(127,203,232,.25)'; g.lineWidth=1; g.stroke();
    if(spd>0){ const an=m.sa(dir+180); g.strokeStyle=COL.wind; g.lineWidth=2; g.beginPath(); g.moveTo(x-Math.sin(an)*16,y+Math.cos(an)*16); g.lineTo(x+Math.sin(an)*12,y-Math.cos(an)*12); g.stroke(); arrowHead(g,x+Math.sin(an)*16,y-Math.cos(an)*16,an,7,COL.wind); }
    g.fillStyle=COL.ink; g.font=`600 10.5px ${FM}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(spd>0?d3(dir)+'/'+Math.round(spd):L(t2('CALM','STILLE')),x,y+38); g.fillStyle=COL.ink3; g.font=`500 9px ${FM}`; g.fillText(L(t2('WIND','VIND')),x,y-34); };
  m.windBox=W=>[W-82,0,82,92];
  /* north arrow and scale bar (bottom left). Draw them before flushLabels(): they reserve their boxes, so no label covers them */
  m.drawNorth=(g,H)=>{ m.reserve(12,H-70,20,40); g.save(); g.translate(22,H-46); g.rotate(m.sa(0)); g.fillStyle=COL.ink2; g.beginPath(); g.moveTo(0,-11); g.lineTo(5,5); g.lineTo(0,2); g.lineTo(-5,5); g.closePath(); g.fill(); g.restore();
    g.fillStyle=COL.ink2; g.font=`600 10px ${FM}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText('N',22,H-62); };
  m.drawScaleBar=(g,H,nm)=>{ nm=nm||niceScale(v.k); const px=nm*v.k; g.strokeStyle=COL.ink2; g.lineWidth=1.4; g.beginPath(); g.moveTo(14,H-16); g.lineTo(14+px,H-16); g.moveTo(14,H-20); g.lineTo(14,H-12); g.moveTo(14+px,H-20); g.lineTo(14+px,H-12); g.stroke();
    const t=(root.LAB&&root.LAB.nf&&nm<1?root.LAB.nf(nm,1):String(nm))+' NM';
    g.fillStyle=COL.ink2; g.font=`600 10px ${FM}`; g.textBaseline='middle'; g.textAlign='left'; g.fillText(t,20+px,H-15); m.reserve(10,H-22,px+g.measureText(t).width+12,13); };

  /* labels that never overlap: queue with label(), keep areas clear with reserve() / reserveEl(), draw with flushLabels() */
  const LB=[]; for(let i=0;i<64;i++) LB.push({x:0,y:0,t:'',c:'',bg:'',f:'',cen:false});
  const PLACED=new Float32Array(80*4), PO={x:0,y:0}; let lbN=0, np=0;
  m.label=(x,y,t,c,f,bg,centre)=>{ if(lbN>=LB.length) return; const q=LB[lbN++]; q.x=x; q.y=y; q.t=t; q.c=c||COL.ink; q.f=f||`500 11px ${FM}`; q.bg=bg||COL.lbBg; q.cen=!!centre; };
  m.reserve=(x,y,w,h)=>{ if(np>=80) return; PLACED[np*4]=x; PLACED[np*4+1]=y; PLACED[np*4+2]=w; PLACED[np*4+3]=h; np++; };
  /* reserve the box of an element over the canvas (a chip, a badge) */
  m.reserveEl=(e,pad)=>{ if(!e||!m.canvas||e.hidden) return; const r=e.getBoundingClientRect(); if(!r.width) return; const c=m.canvas.getBoundingClientRect(); pad=pad||6; m.reserve(r.left-c.left-pad,r.top-c.top-pad,r.width+2*pad,r.height+2*pad); };
  m.flushLabels=(g,W,H)=>{ g.textBaseline='middle';
    for(let i=0;i<lbN;i++){ const q=LB[i]; g.font=q.f; const w=g.measureText(q.t).width+10, h=17;
      if(!placeLabel(q.x,q.y,w,h,W,H,PLACED,np,PO,q.cen?OFFC:OFFS)) continue;
      m.reserve(PO.x,PO.y,w,h);
      g.fillStyle=q.bg; rrect(g,PO.x,PO.y,w,h,3); g.fill(); g.fillStyle=q.c; g.textAlign='left'; g.fillText(q.t,PO.x+5,PO.y+h/2+0.5); }
    lbN=0; np=0; };
  return m; }

root.NAVMAP={REGIONS,COAST,COL,FM,FB,build,load,create,view,setView,toPx,toNm,screenAngle,fit,lerpView,niceScale,placeLabel,OFFS,
  rrect,arrowHead,drawVor,drawNdb,drawFix,drawWaypoint,drawAirport,acShape,aircraftAt};
})(typeof window!=='undefined'?window:globalThis);
