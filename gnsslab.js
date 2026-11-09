/* Birdbird – gnsslab.js: the GNSS and RNAV lab (gnss.html).
   Maths in gnsscore.js (GNSSCORE, tested in tests/gnsscore.test.mjs), projection from navcore.js (NAVCORE),
   the HSI from navgauges.js (NAVG), the plan-view map (relief, coastline, symbols, labels) from navmap.js (NAVMAP).
   Strings are EN/NO through LAB.L. */
(function(){
'use strict';
const G=window.GNSSCORE, N=window.NAVCORE, {L,el,nf}=LAB, t2=(en,no)=>({en,no});
const D2R=Math.PI/180, TAU=Math.PI*2, NM=1852;
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const FM='"IBM Plex Mono", ui-monospace, monospace', FB='"Public Sans", system-ui, sans-serif';
const COL=Object.assign({},NAVMAP.COL,{path:'#F06BB4',leg:'rgba(230,235,239,.5)',in:'#4f9fc2',out:'#2c5468',sat:'#63D9A0',low:'#66727C',ok:'#71CC93',vert:'#7FCBE8'});
const fmt=(v,d)=>nf(v,d);

/* ---------- the place: Bergen (same frame as the radio navigation simulator, centred on FLS) ---------- */
const BGN=NAVMAP.build('bergen'), I17=BGN.ILS[0];
const ARP=I17.arp, RWY={crs:I17.crs,len:I17.len,elev:I17.elev,tch:50};
const U=a=>[Math.sin(a*D2R),Math.cos(a*D2R)];
const THR=I17.thr, REND=I17.end;
const pol=(b,d)=>({x:THR.x+U(b)[0]*d,y:THR.y+U(b)[1]*d});
/* the VOR/DMEs for DME/DME reversion: Flesland, Vollo, Stord */
const DMES=BGN.NAV.filter(n=>n.type==='VOR').map(n=>({x:n.x,y:n.y,id:n.id,elev:n.elev}));
/* an illustrative route (not a published procedure): two en route fixes, then an RNP approach to RWY 17 */
const WPS=[
 {n:'ENR A',...pol(35,44),alt:10000},
 {n:'ENR B',...pol(20,27),alt:6000,turn:1},
 {n:'IAF',...pol(30,13),alt:3000,turn:1},
 {n:'IF',...pol(354,9),alt:0,turn:1},
 {n:'FAF',...pol(354,5),alt:0,t:'by'},
 {n:'MAPt',...THR,alt:RWY.elev+RWY.tch,t:'over'},
 {n:'MAHF',...pol(174,7),alt:3000}];
const FAFALT=Math.round(RWY.elev+G.pathHt(5,3,RWY.tch)); WPS[3].alt=FAFALT; WPS[4].alt=FAFALT;
/* specification on each leg (leg i = WPS[i] → WPS[i+1]); gnss: needs GNSS (cannot be flown on DME/DME) */
const LEGS=[{sp:'RNAV 5',rnp:5,mon:false,gnss:false},{sp:'RNP 1',rnp:1,mon:true,gnss:true},{sp:'RNP APCH',rnp:1,mon:true,gnss:true},{sp:'RNP APCH',rnp:1,mon:true,gnss:true},
  {sp:'RNP APCH',rnp:0.3,mon:true,gnss:true},{sp:'RNP APCH',rnp:1,mon:true,gnss:true}];
/* illustrative minima (height above the threshold) */
const MIN={lnav:{k:'LNAV',ht:450,da:false,v:false},lnavvnav:{k:'LNAV/VNAV',ht:350,da:true,v:true},lpv:{k:'LPV',ht:250,da:true,v:true}};

/* ---------- satellites: presets for a sky over Bergen ---------- */
const PRE={
 good:[[40,72],[300,55],[130,48],[215,35],[75,22],[165,14],[255,18],[340,26],[20,40]],
 bunch:[[88,28],[112,44],[136,32],[100,62],[150,52],[126,72],[160,24]],
 few:[[60,58],[170,42],[250,30],[335,16],[10,82]]};
const PRN=[2,5,7,12,13,15,18,24,29,30,31,10];
const mkSats=k=>PRE[k].map((a,i)=>({az:a[0],el:a[1],id:'G'+String(PRN[i]).padStart(2,'0')}));

/* ---------- state ---------- */
const S={pre:'good',sats:mkSats('good'),mask:5,sbas:'on',wpT:'by',gs:220,bank:25,off:0.2,voff:0,min:'lpv',show:{cont:true,turn:false},jam:false,s:9,fly:false,view:'follow'};
let P=null, sF=0, sM=0, sI=0, sB=0, sA=0;
function build(){ const W=WPS.map((w,i)=>({x:w.x,y:w.y,t:w.turn?S.wpT:(w.t||'by')}));
  P=G.path(W,G.turnRadius(S.gs,S.bank));
  const sAt=w=>{ let b=0, bd=1e9; for(const p of P.pts){ const d=Math.hypot(p.x-w.x,p.y-w.y); if(d<bd){ bd=d; b=p.s; } } return b; };
  sF=sAt(WPS[4]); sM=sAt(WPS[5]); sI=sAt(WPS[3]); sB=sAt(WPS[1]); sA=sAt(WPS[2]); }
build();

/* ---------- derived values ---------- */
const X={};
function nomAlt(s){ /* nominal altitude along the path: linear between the waypoint altitudes (on the 3° path after the FAF) */
  const sw=[0,sB,null,sI,sF,sM,P.len]; if(sw[2]===null){ let b=0,bd=1e9; for(const p of P.pts){ const d=Math.hypot(p.x-WPS[2].x,p.y-WPS[2].y); if(d<bd){ bd=d; b=p.s; } } sw[2]=b; }
  for(let i=0;i<sw.length-1;i++){ if(s<=sw[i+1]){ const f=(s-sw[i])/Math.max(1e-6,sw[i+1]-sw[i]); return WPS[i].alt+(WPS[i+1].alt-WPS[i].alt)*Math.max(0,Math.min(1,f)); } }
  return WPS[WPS.length-1].alt; }
function derive(){
  const vis=S.jam?[]:G.visible(S.sats,S.mask), D=G.dop(vis), sb=S.sbas==='on';
  X.vis=vis; X.D=D; X.E=G.err95(D,sb?1:4);
  const a=G.at(P,S.s), rp=[Math.cos(a.trk*D2R),-Math.sin(a.trk*D2R)];
  X.pa=a; X.ac={x:a.x+rp[0]*S.off,y:a.y+rp[1]*S.off}; X.trk=a.trk; X.leg=Math.min(LEGS.length-1,a.leg);
  const w1=WPS[X.leg], w2=WPS[X.leg+1]; X.dtk=G.bearing(w2.x-w1.x,w2.y-w1.y); X.spec=LEGS[X.leg];
  X.dDest=Math.hypot(X.ac.x-ARP.x,X.ac.y-ARP.y); X.dFaf=sF-S.s; X.dThr=sM-S.s; X.past=S.s>sM+0.02;
  X.ph=G.phase(X.dDest,X.dFaf,X.past); if(X.ph==='terminal'&&X.leg>=4) X.ph='approach';
  X.hal=X.ph==='enroute'?G.HAL.enroute:X.ph==='approach'?G.HAL.approach:G.HAL.terminal;
  X.r=G.raim(vis,X.hal); X.rApp=G.raim(vis,G.HAL.approach); X.sb=sb&&D?G.sbas(vis):null;
  const rOk=r=>r.state==='detect'||r.state==='fde';
  X.integ=!!D&&(rOk(X.r)||(X.sb&&X.sb.hpl<=X.hal));
  X.lnav=!!D&&(rOk(X.rApp)||(X.sb&&X.sb.hpl<=G.HAL.approach)); X.lpv=!!(X.sb&&X.sb.ok);
  X.av={lnav:X.lnav,lnavvnav:X.lnav,lpv:X.lpv};
  X.lvl= X.av[S.min]? S.min : X.lnav? 'lnav' : null;   /* receivers downgrade LPV to LNAV when SBAS integrity is not met */
  X.fs=G.fsd(X.ph,{dFaf:X.dFaf,angular:X.lvl==='lpv',dThr:X.dThr,rwy:RWY.len});
  /* navigation source: GNSS, or DME/DME when the signals are jammed */
  if(S.jam){ const alt=nomAlt(S.s)+S.voff, st=DMES.filter(d=>Math.hypot(d.x-X.ac.x,d.y-X.ac.y)<=N.losRange(alt,d.elev)); const dd=G.dmedme(st,X.ac,0.1);
    X.src=dd?'DME/DME':'IRS'; X.epu=dd?dd.e95:2; }
  else { X.src='GNSS'; X.epu=X.E?X.E.h/NM:null; }
  X.usable= S.jam? !X.spec.gnss : X.integ;   /* can the current leg be flown with this source? */
  X.alt=nomAlt(S.s)+S.voff;
  X.vg=!!(X.lvl&&MIN[X.lvl].v&&X.usable&&!S.jam&&S.s>=sI-0.01&&!X.past);
  const dG=X.dThr+RWY.tch/Math.tan(3*D2R)/G.K.FT; X.vdev=Math.atan2(X.alt-RWY.elev,Math.max(0.05,dG)*G.K.FT)/D2R-3;
  return X; }

/* ---------- sky plot ---------- */
const SK=LAB.fit(el('gnSky'),()=>drawSky(),2); let SKR=1, SKX=0, SKY=0;
function skyXY(s){ const r=SKR*(90-s.el)/90, a=s.az*D2R; return [SKX+Math.sin(a)*r,SKY-Math.cos(a)*r]; }
function drawSky(){ const g=SK.ctx, W=SK.w, H=SK.h; if(!W) return; g.clearRect(0,0,W,H);
  SKX=W/2; SKY=H/2; SKR=Math.min(W,H)/2-20; const rr=e=>SKR*(90-e)/90;
  /* below the mask angle */
  g.fillStyle='rgba(240,180,64,.09)'; g.beginPath(); g.arc(SKX,SKY,SKR,0,TAU); g.arc(SKX,SKY,rr(S.mask),0,TAU,true); g.fill();
  g.strokeStyle='rgba(160,190,210,.16)'; g.lineWidth=1; for(const e of [0,30,60]){ g.beginPath(); g.arc(SKX,SKY,rr(e),0,TAU); g.stroke(); }
  g.beginPath(); g.moveTo(SKX-SKR,SKY); g.lineTo(SKX+SKR,SKY); g.moveTo(SKX,SKY-SKR); g.lineTo(SKX,SKY+SKR); g.stroke();
  if(S.mask>0){ g.strokeStyle='rgba(240,180,64,.55)'; g.setLineDash([3,3]); g.beginPath(); g.arc(SKX,SKY,rr(S.mask),0,TAU); g.stroke(); g.setLineDash([]); }
  g.font=`500 10px ${FM}`; g.fillStyle=COL.ink3; g.textAlign='center'; g.textBaseline='middle';
  g.fillText('N',SKX,SKY-SKR-10); g.fillText('S',SKX,SKY+SKR+10); g.fillText('E',SKX+SKR+10,SKY); g.fillText('W',SKX-SKR-10,SKY);
  g.textAlign='left'; g.fillText('60°',SKX+3,SKY-rr(60)-6); g.fillText('30°',SKX+3,SKY-rr(30)-6);
  /* the SBAS geostationary satellite low in the south (not used for ranging in this model) */
  if(S.sbas==='on'){ const [x,y]=skyXY({az:200,el:21}); g.save(); g.translate(x,y); g.rotate(Math.PI/4); g.fillStyle=S.jam?'rgba(236,90,71,.5)':'rgba(127,203,232,.85)'; g.fillRect(-4,-4,8,8); g.restore();
    g.fillStyle=S.jam?'rgba(236,90,71,.7)':'rgba(127,203,232,.9)'; g.font=`500 9px ${FM}`; g.textAlign='center'; g.fillText('EGNOS',x,y+12); }
  /* lines of sight from you when few satellites: the geometry */
  for(const s of S.sats){ const [x,y]=skyXY(s), used=!S.jam&&s.el>=S.mask; s._x=x; s._y=y;
    g.lineWidth=1.6; if(used){ g.fillStyle='rgba(99,217,160,.18)'; g.strokeStyle=COL.sat; } else { g.fillStyle='rgba(20,26,32,.85)'; g.strokeStyle=S.jam?COL.bad:COL.low; }
    g.beginPath(); g.arc(x,y,11,0,TAU); g.fill(); g.stroke();
    g.fillStyle=used?'#DFF7EA':S.jam?'#F3A79B':'#8E99A4'; g.font=`600 9px ${FM}`; g.textAlign='center'; g.fillText(s.id.slice(1),x,y+0.5);
    if(S.jam){ g.strokeStyle=COL.bad; g.lineWidth=1.4; g.beginPath(); g.moveTo(x-6,y-6); g.lineTo(x+6,y+6); g.moveTo(x+6,y-6); g.lineTo(x-6,y+6); g.stroke(); } }
  /* you */
  g.fillStyle=COL.ink; g.beginPath(); g.arc(SKX,SKY,2.5,0,TAU); g.fill();
  if(S.jam){ const tx_=L(t2('Jammed: no signals tracked','Jammet: ingen signaler fanges opp')); g.font=`600 11px ${FB}`; const tw=g.measureText(tx_).width+14; g.fillStyle='rgba(12,15,18,.9)'; g.fillRect(SKX-tw/2,SKY-11,tw,22); g.strokeStyle='rgba(236,90,71,.7)'; g.lineWidth=1; g.strokeRect(SKX-tw/2+0.5,SKY-10.5,tw-1,21); g.fillStyle='#F3A79B'; g.textAlign='center'; g.fillText(tx_,SKX,SKY+0.5); } }
/* drag a satellite */
(function(){ const cv=el('gnSky'); let dg=-1;
  cv.addEventListener('pointerdown',e=>{ const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top; let b=-1, bd=18;
    S.sats.forEach((s,i)=>{ const d=Math.hypot(s._x-x,s._y-y); if(d<bd){ bd=d; b=i; } }); dg=b; if(b>=0){ cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); e.preventDefault(); } });
  cv.addEventListener('pointermove',e=>{ if(dg<0) return; const r=cv.getBoundingClientRect(), x=e.clientX-r.left-SKX, y=e.clientY-r.top-SKY;
    const d=Math.min(SKR,Math.hypot(x,y)); S.sats[dg].az=G.norm(Math.atan2(x,-y)/D2R); S.sats[dg].el=Math.round(90-d/SKR*90); S.pre=''; preSync(); update(); });
  const up=()=>{ dg=-1; cv.classList.remove('drag'); }; cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up); })();

/* readout under the sky plot */
const RAIMT={nofix:t2('No 3D fix','Ingen 3D-posisjon'),none:t2('No check (4 sats)','Ingen kontroll (4 sat.)'),unavail:t2('Not available','Ikke tilgjengelig'),detect:t2('Detect only','Kun oppdage'),fde:t2('Detect and exclude','Oppdage og utelate')};
function drawRo(){ const D=X.D, E=X.E; let h='';
  h+=`<div class="r"><span>${L(t2('Satellites used','Satellitter brukt'))}</span><b class="${X.vis.length<4?'x':X.vis.length<5?'a':''}">${X.vis.length} / ${S.sats.length}</b></div>`;
  h+=`<div class="r"><span>HDOP · VDOP</span><b class="${D&&D.h>3?'a':''}">${D?fmt(D.h,1)+' · '+fmt(D.v,1):'—'}</b></div>`;
  h+=`<div class="r"><span>${L(t2('Accuracy (95 %)','Nøyaktighet (95 %)'))}</span><b>${E?'H '+fmt(E.h,0)+' m · V '+fmt(E.v,0)+' m':'—'}</b></div>`;
  const st=X.r.state, useSb=!!(X.sb&&!S.jam), sbI=useSb&&X.sb.hpl<=X.hal;
  const iv= S.jam? L(t2('Lost','Tapt')) : useSb? (sbI?'SBAS ✓':'SBAS ✗') : L(RAIMT[st]);
  const cls= S.jam? 'x' : useSb? (sbI?'g':'x') : st==='fde'||st==='detect'?'g':st==='none'?'a':'x';
  h+=`<div class="r"><span>${useSb?L(t2('Integrity','Integritet')):'RAIM'} <small>(${fmt(X.hal/NM,X.hal<NM?1:0)} NM)</small></span><b class="${cls}">${iv}</b></div>`;
  if(LAB.depth==='deep'){ h+=`<div class="r"><span>${X.sb&&X.D?'SBAS HPL · VPL':'RAIM HPL'}</span><b>${X.sb&&X.D?fmt(X.sb.hpl,0)+' · '+fmt(X.sb.vpl,0)+' m':Number.isFinite(X.r.hpl)?fmt(X.r.hpl,0)+' m':'—'}</b></div>`; }
  h+=`<div class="r"><span>${L(t2('Approach','Innflyging'))}</span><b class="gn-ap">${['lnav','lnavvnav','lpv'].map(k=>`<i class="${X.av[k]?'':'no'}">${MIN[k].k}</i>`).join('')}</b></div>`;
  el('gnRo').innerHTML=h; }

/* ---------- map: navmap.js (the radio navigation simulator's relief, coastline, symbols and labels) ---------- */
const MC=LAB.fit(el('gnMap'),()=>{ camSnap=true; kick(); },2);
const map=NAVMAP.create(el('gnMap'),{region:'bergen',onLoad:()=>kick()});
const CAM={k:10,ox:0,oy:0}, CT={k:10,ox:0,oy:0}; let camSnap=true;
const RANGE={enroute:10,terminal:5.5,approach:2.8,missed:2.8};
function camTarget(){ const W=MC.w, H=MC.h; if(S.view==='route'){ let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; for(const w of WPS){ x0=Math.min(x0,w.x); x1=Math.max(x1,w.x); y0=Math.min(y0,w.y); y1=Math.max(y1,w.y); }
    const top=(el('gnChip').offsetHeight||40)+16, f=NAVMAP.fit({x0,x1,y0,y1},W,H,{t:top,b:24},{pad:3});   /* b: room for the scale bar */ CT.k=f.k; CT.ox=f.ox; CT.oy=f.oy+(f.cy-H/2)/f.k; }
  else { CT.k=Math.min(W,H)/2/RANGE[X.ph]; CT.ox=X.ac.x; CT.oy=X.ac.y; } }
let SX=0, SY=0; function PT(x,y){ map.P(x,y); SX=map.sx; SY=map.sy; }
const unPT=map.unP;
const LAY=document.createElement('canvas');
function drawMap(){ const g=MC.ctx, W=MC.w, H=MC.h; if(!W) return;
  map.set({k:CAM.k,ox:CAM.ox,oy:CAM.oy,cx:W/2,cy:H/2,rot:0});
  map.drawBase(g,W,H);
  /* runway 17 */
  map.drawRunway(g,THR,REND);
  /* containment: ±1×RNP (accuracy, 95 %) and ±2×RNP (containment) round each leg, drawn opaque in a layer and blended once */
  if(S.show.cont){ if(LAY.width!==Math.round(W*MC.dpr)||LAY.height!==Math.round(H*MC.dpr)){ LAY.width=Math.round(W*MC.dpr); LAY.height=Math.round(H*MC.dpr); }
    const q=LAY.getContext('2d'); q.setTransform(MC.dpr,0,0,MC.dpr,0,0); q.clearRect(0,0,W,H); q.lineCap='round'; q.lineJoin='round';
    for(const pass of [2,1]) for(let i=0;i<LEGS.length;i++){ const l=LEGS[i]; if(pass===2&&!l.mon) continue;
      PT(WPS[i].x,WPS[i].y); const x0=SX,y0=SY; PT(WPS[i+1].x,WPS[i+1].y); q.strokeStyle=pass===2?COL.out:COL.in; q.lineWidth=2*pass*l.rnp*CAM.k; q.beginPath(); q.moveTo(x0,y0); q.lineTo(SX,SY); q.stroke(); }
    g.save(); g.globalAlpha=0.32; g.setTransform(1,0,0,1,0,0); g.drawImage(LAY,0,0); g.restore(); }
  /* the legs (TF: track between fixes) */
  g.strokeStyle=COL.leg; g.lineWidth=1.2; g.setLineDash([5,5]); g.beginPath(); WPS.forEach((w,i)=>{ PT(w.x,w.y); if(i) g.lineTo(SX,SY); else g.moveTo(SX,SY); }); g.stroke(); g.setLineDash([]);
  /* the path the FMS flies, with its turns */
  g.strokeStyle=COL.path; g.lineWidth=2.4; g.lineJoin='round'; g.beginPath(); P.pts.forEach((p,i)=>{ PT(p.x,p.y); if(i) g.lineTo(SX,SY); else g.moveTo(SX,SY); }); g.stroke();
  /* turn construction for the next turn */
  const nt=nextTurn(); if(S.show.turn&&nt){ const w=WPS[nt.i]; PT(w.x,w.y); const wx=SX, wy=SY;
    if(nt.lead>0){ const a1=G.bearing(w.x-WPS[nt.i-1].x,w.y-WPS[nt.i-1].y), u=U(a1); PT(w.x-u[0]*nt.lead,w.y-u[1]*nt.lead);
      g.strokeStyle=COL.warn; g.lineWidth=2; g.beginPath(); g.moveTo(SX,SY); g.lineTo(wx,wy); g.stroke(); g.beginPath(); g.arc(SX,SY,4,0,TAU); g.fillStyle=COL.warn; g.fill();
      map.label(SX,SY,L(t2('turn starts','svingen starter'))+' '+fmt(nt.lead,1)+' NM',COL.warn); }
    else if(nt.over>0){ const a2=G.bearing(WPS[nt.i+1].x-w.x,WPS[nt.i+1].y-w.y); let best=null, bd=-1;
      for(const p of P.pts){ if(p.leg!==nt.i) continue; const d=G.xtk(w,WPS[nt.i+1],p).xt*(nt.dA>0?-1:1); if(d>bd){ bd=d; best=p; } }
      if(best){ PT(best.x,best.y); const bx=SX, by=SY; const f=G.xtk(w,WPS[nt.i+1],best); PT(w.x+U(a2)[0]*f.at,w.y+U(a2)[1]*f.at); g.strokeStyle=COL.warn; g.lineWidth=2; g.beginPath(); g.moveTo(bx,by); g.lineTo(SX,SY); g.stroke(); map.label(bx,by,fmt(nt.over,1)+' NM '+L(t2('beyond the leg','utenfor etappen')),COL.warn); } } }
  /* waypoints */
  WPS.forEach(w=>{ PT(w.x,w.y); if(SX<-40||SY<-40||SX>W+40||SY>H+40) return;
    NAVMAP.drawWaypoint(g,SX,SY,{over:(w.turn?S.wpT:w.t)==='over'}); map.label(SX,SY,w.n,COL.wp); });
  /* aircraft, its offset from the path and the position uncertainty */
  PT(X.pa.x,X.pa.y); const px=SX, py=SY; PT(X.ac.x,X.ac.y); const ax=SX, ay=SY;
  if(Math.abs(S.off)>0.01&&Math.hypot(ax-px,ay-py)>6){ g.strokeStyle='rgba(240,180,64,.8)'; g.lineWidth=1; g.setLineDash([2,3]); g.beginPath(); g.moveTo(px,py); g.lineTo(ax,ay); g.stroke(); g.setLineDash([]); }
  if(X.epu!=null){ const rp=X.epu*CAM.k; if(rp>3){ g.fillStyle=S.jam?'rgba(240,180,64,.12)':'rgba(127,203,232,.12)'; g.strokeStyle=S.jam?'rgba(240,180,64,.8)':'rgba(127,203,232,.8)'; g.lineWidth=1.2; g.setLineDash([4,3]); g.beginPath(); g.arc(ax,ay,rp,0,TAU); g.fill(); g.stroke(); g.setLineDash([]); } }
  map.drawAircraft(g,X.ac.x,X.ac.y,X.trk,{size:15});
  /* north and scale, then the labels (clear of them and of the chip) */
  map.drawNorth(g,H); map.drawScaleBar(g,H);
  map.reserveEl(el('gnChip')); map.flushLabels(g,W,H); }
function nextTurn(){ const T=P.turns.filter(t=>Math.abs(t.dA)>=1); let best=null; for(const t of T){ const w=WPS[t.i]; let sw=0,bd=1e9; for(const p of P.pts){ const d=Math.hypot(p.x-w.x,p.y-w.y); if(d<bd){ bd=d; sw=p.s; } }
    if(sw-(t.lead||0)>=S.s-0.05){ best=t; break; } } return best||T[T.length-1]; }

/* map: drag sideways to move off track; arrow keys */
(function(){ const cv=el('gnMap'); let dn=null;
  cv.addEventListener('pointerdown',e=>{ dn={x:e.clientX}; cv.setPointerCapture(e.pointerId); setOff(e); });
  cv.addEventListener('pointermove',e=>{ if(dn) setOff(e); });
  const up=()=>{ dn=null; }; cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  function setOff(e){ const r=cv.getBoundingClientRect(), w=unPT(e.clientX-r.left,e.clientY-r.top), a=X.pa, rp=[Math.cos(a.trk*D2R),-Math.sin(a.trk*D2R)];
    S.off=Math.max(-3,Math.min(3,Math.round(((w.x-a.x)*rp[0]+(w.y-a.y)*rp[1])*100)/100)); offSl.set(Math.max(-1.5,Math.min(1.5,S.off))); update(); }
  cv.addEventListener('keydown',e=>{ let d=true; if(e.key==='ArrowLeft') S.off=Math.round((S.off-0.05)*100)/100; else if(e.key==='ArrowRight') S.off=Math.round((S.off+0.05)*100)/100;
    else if(e.key==='ArrowUp') S.s=Math.min(P.len,S.s+0.5); else if(e.key==='ArrowDown') S.s=Math.max(0,S.s-0.5); else d=false; if(d){ e.preventDefault(); offSl.set(S.off); update(); } }); })();

/* ---------- HSI (navgauges.js) ---------- */
const HSI=NAVG.make(el('gnHsi'),'hsi'), HV={};
function setHsi(){ const ann= S.jam? 'DME/DME' : X.ph==='enroute'? 'GPS ENR' : X.ph==='terminal'? 'GPS TERM' : X.ph==='missed'? 'GPS MAPR' : X.lvl? 'GPS '+(X.lvl==='lnavvnav'?'L/VNAV':MIN[X.lvl].k) : 'GPS';
  HV.hdg=X.trk; HV.crs=X.dtk; HV.bug=X.trk; HV.hsiDots=X.usable?G.dots(S.off,X.fs,2.3):0; HV.flag=X.usable?'TO':'OFF'; HV.flagTxt=S.jam?'NAV':'LOI';
  HV.ils=X.vg; HV.gsValid=X.vg; HV.gsDots2=Math.max(-2.4,Math.min(2.4,-X.vdev/0.35)); HV.ann=ann; HV.annC=S.jam||(X.lvl&&X.lvl!==S.min&&X.ph==='approach')?COL.warn:'#63D9A0';
  HSI.set(HV); }

/* ---------- approach profile ---------- */
const PC=LAB.fit(el('gnProf'),()=>drawProf(),2);
function drawProf(){ const g=PC.ctx, W=PC.w, H=PC.h; if(!W) return; g.clearRect(0,0,W,H);
  const d0=10.5, d1=-2, a0=0, a1=Math.max(3400,FAFALT+600), l=34, r=12, t=10, b=20;
  const xp=d=>l+(d0-d)/(d0-d1)*(W-l-r), yp=a=>H-b-(a-a0)/(a1-a0)*(H-t-b);
  g.font=`500 9.5px ${FM}`; g.fillStyle=COL.ink3; g.strokeStyle='rgba(160,190,210,.12)'; g.lineWidth=1; g.textBaseline='middle';
  for(let a=1000;a<a1;a+=1000){ g.beginPath(); g.moveTo(l,yp(a)); g.lineTo(W-r,yp(a)); g.stroke(); g.textAlign='right'; g.fillText(a/1000+'k',l-4,yp(a)); }
  g.textAlign='center'; for(let d=0;d<=10;d+=2) g.fillText(d+(d?'':' NM'),xp(d),H-8);
  /* ground and runway */
  g.fillStyle='rgba(60,80,92,.55)'; g.fillRect(l,yp(RWY.elev),W-l-r,H-b-yp(RWY.elev)); g.fillStyle='#C9D2D8'; g.fillRect(xp(0),yp(RWY.elev)-2,xp(-RWY.len)-xp(0),3);
  /* the nominal profile: level at the FAF altitude from the IF, then 3° to the threshold */
  const dF=sM-sF, dI=sM-sI, m=MIN[S.min], lv=X.lvl?MIN[X.lvl]:m;
  g.strokeStyle=lv.v?COL.vert:'rgba(127,203,232,.6)'; g.lineWidth=2; if(!lv.v) g.setLineDash([5,4]);
  g.beginPath(); g.moveTo(xp(Math.min(d0,dI)),yp(FAFALT)); g.lineTo(xp(dF),yp(FAFALT)); g.lineTo(xp(0),yp(RWY.elev+RWY.tch)); g.stroke(); g.setLineDash([]);
  /* FAF and MAPt */
  for(const [d,n] of [[dF,'FAF'],[0,'MAPt']]){ g.strokeStyle='rgba(230,235,239,.35)'; g.beginPath(); g.moveTo(xp(d),t); g.lineTo(xp(d),H-b); g.stroke(); g.fillStyle=COL.ink2; g.textAlign='center'; g.fillText(n,xp(d),t+4); }
  /* minimum: MDA (LNAV) or DA */
  const minA=RWY.elev+lv.ht, xm0=xp(Math.min(3.2,dF)); g.strokeStyle=COL.warn; g.lineWidth=1.6; g.beginPath(); g.moveTo(xm0,yp(minA)); g.lineTo(xp(lv.da?0.9:0),yp(minA)); g.stroke();
  g.fillStyle=COL.warn; g.textAlign='right'; g.fillText((lv.da?'DA ':'MDA ')+minA+' ft',xm0-4,yp(minA));
  /* aircraft */
  const d=X.dThr, al=X.alt; g.fillStyle='#fff';
  if(d<=d0&&d>=d1){ g.beginPath(); g.arc(xp(d),yp(Math.min(a1,al)),4,0,TAU); g.fill(); }
  else if(d>d0){ g.textAlign='left'; g.fillStyle=COL.ink2; g.font=`500 9.5px ${FM}`; g.fillText('← '+L(t2('aircraft','flyet'))+' '+fmt(d,0)+' NM',l+4,t+4); }
  const pm=el('profM'), mt=!X.lvl?L(t2('No RNP approach available','Ingen RNP-innflyging tilgjengelig')):lv.v?(X.lvl==='lpv'?L(t2('LPV: SBAS glide path','LPV: SBAS-glidebane')):L(t2('LNAV/VNAV: baro-VNAV path','LNAV/VNAV: baro-VNAV-bane'))):L(t2('LNAV: no vertical guidance (CDFA)','LNAV: ingen vertikal ledning (CDFA)'));
  if(pm.textContent!==mt){ pm.textContent=mt; } pm.className=lv.v&&X.lvl?'':'n'; }

/* ---------- chip, "what you're seeing", legend ---------- */
const PHT={enroute:t2('En route','Underveis'),terminal:t2('Terminal','Terminal'),approach:t2('Approach','Innflyging'),missed:t2('Missed approach','Bortflyging')};
const side=v=>Math.abs(v)<0.005?'':v>0?' R':' L';
function chip(){ const xr=Math.abs(S.off), rnp=X.spec.rnp, xc= xr>2*rnp&&X.spec.mon?'r':xr>rnp?'a':'';
  let h=`<span><i>${L(t2('PHASE','FASE'))}</i><b>${L(PHT[X.ph])}</b></span><span><i>${L(t2('SPEC','SPES.'))}</i><b>${X.spec.sp}${X.spec.sp==='RNP APCH'?' · '+fmt(rnp,rnp<1?1:0):''}</b></span>`;
  h+=`<span><i>${L(t2('CDI FULL SCALE','CDI FULLT UTSLAG'))}</i><b>${X.fs<0.3-1e-6?fmt(X.fs*NM,0)+' m':fmt(X.fs,X.fs<1?2:0)+' NM'}</b></span>`;
  h+=`<span><i>XTK</i><b class="${xc}">${fmt(xr,2)} NM${side(S.off)}</b></span>`;
  h+=`<span><i>${L(t2('SOURCE','KILDE'))}</i><b class="${S.jam?'a':X.integ?'g':'r'}">${S.jam?X.src:X.integ?'GNSS':'GNSS · LOI'}</b></span>`;
  if(LAB.depth==='deep'&&X.epu!=null) h+=`<span class="hx"><i>EPU</i><b>${X.epu<0.1?fmt(X.epu*NM,0)+' m':fmt(X.epu,2)+' NM'}</b></span>`;
  const c=el('gnChip'); if(c._h!==h){ c._h=h; c.innerHTML=h; } }
function see(){ let t;
  const dts=Math.abs(G.dots(S.off,X.fs,9)), ff=X.fs<0.3-1e-6?fmt(X.fs*NM,0)+' m':fmt(X.fs,X.fs<1?2:0)+' NM';
  if(S.jam) t=t2(`<b>Jamming.</b> No satellite can be tracked, so GNSS and EGNOS are lost together. The FMS reverts to ${X.src} (95 % error about ${fmt(X.epu,2)} NM): enough for RNAV 5 and RNAV 1, but RNP 1 and RNP APCH need GNSS. ${X.spec.gnss?'Here you are on '+X.spec.sp+': tell ATC, ask for vectors or the ILS.':'On this RNAV 5 leg you can continue.'}`,
    `<b>Jamming.</b> Ingen satellitter kan følges, så GNSS og EGNOS forsvinner samtidig. FMS-en går over til ${X.src} (95 % feil rundt ${fmt(X.epu,2)} NM): nok for RNAV 5 og RNAV 1, men RNP 1 og RNP APCH krever GNSS. ${X.spec.gnss?'Her er du på '+X.spec.sp+': si fra til ATC, be om vektorer eller ILS.':'På denne RNAV 5-etappen kan du fortsette.'}`);
  else if(!X.D) t=t2('<b>No 3D fix.</b> Each satellite gives one range, but there are four unknowns: three for position and one for the receiver clock. Bring at least four satellites above the mask angle.','<b>Ingen 3D-posisjon.</b> Hver satellitt gir én avstand, men det er fire ukjente: tre for posisjonen og én for mottakerens klokke. Få minst fire satellitter over maskevinkelen.');
  else if(!X.integ) t=t2(`<b>Loss of integrity.</b> The position may still be good, but RAIM cannot prove it: ${X.r.state==='none'?'with only four satellites there is nothing to cross-check':'the protection level, '+fmt(X.r.hpl,0)+' m, is above the '+fmt(X.hal,0)+' m alert limit'}. The receiver shows LOI and the flag drops: do not use GNSS for this phase.`,
    `<b>Tap av integritet.</b> Posisjonen kan fortsatt være god, men RAIM kan ikke bevise det: ${X.r.state==='none'?'med bare fire satellitter er det ingenting å kryssjekke':'beskyttelsesnivået, '+fmt(X.r.hpl,0)+' m, er over alarmgrensen på '+fmt(X.hal,0)+' m'}. Mottakeren viser LOI og flagget faller: ikke bruk GNSS i denne fasen.`);
  else if(S.min==='lpv'&&!X.lpv&&X.ph!=='enroute') t=t2(`<b>LPV not available.</b> ${S.sbas==='on'?'EGNOS is received, but with this geometry the vertical protection level ('+fmt(X.sb.vpl,0)+' m) exceeds 50 m.':'Without SBAS there is no LPV.'} The receiver drops to LNAV: higher minimum, no glide path.`,
    `<b>LPV ikke tilgjengelig.</b> ${S.sbas==='on'?'EGNOS mottas, men med denne geometrien er det vertikale beskyttelsesnivået ('+fmt(X.sb.vpl,0)+' m) over 50 m.':'Uten SBAS er det ingen LPV.'} Mottakeren går ned til LNAV: høyere minimum, ingen glidebane.`);
  else if(X.ph==='approach'&&X.dFaf<0) t=t2(`<b>Final approach.</b> Full scale is now ${ff}${X.lvl==='lpv'?', angular like a localiser, narrowing towards the runway':''}. Your ${fmt(Math.abs(S.off),2)} NM off track puts the bar ${fmt(dts,1)} dots out (2 dots = full scale). ${X.vg?'The glide path pointer gives vertical guidance to the DA.':'LNAV has no vertical guidance: fly the CDFA to the MDA.'}`,
    `<b>Finalen.</b> Fullt utslag er nå ${ff}${X.lvl==='lpv'?', vinkelbasert som en localizer, smalere mot rullebanen':''}. Dine ${fmt(Math.abs(S.off),2)} NM fra tracken gir ${fmt(dts,1)} prikker utslag (2 prikker = fullt utslag). ${X.vg?'Glidebanepekeren gir vertikal ledning ned til DA.':'LNAV har ingen vertikal ledning: fly CDFA ned til MDA.'}`);
  else if(X.ph==='approach') t=t2(`<b>Approach mode.</b> In the last 2 NM before the FAF the full scale shrinks from 1 NM to 0.3 NM; now ${ff}. The bar moves further for the same error.`,`<b>Innflygingsmodus.</b> De siste 2 NM før FAF krymper fullt utslag fra 1 NM til 0,3 NM; nå ${ff}. Streken går lenger ut for samme feil.`);
  else if(X.ph==='enroute') t=t2(`<b>En route, ${X.spec.sp}.</b> CDI full scale 2 NM: your ${fmt(Math.abs(S.off),2)} NM off track is only ${fmt(dts,1)} dots. RNAV 5 asks for ±5 NM 95 % of the time and has no on-board alerting.`,`<b>Underveis, ${X.spec.sp}.</b> CDI fullt utslag 2 NM: dine ${fmt(Math.abs(S.off),2)} NM fra tracken er bare ${fmt(dts,1)} prikker. RNAV 5 krever ±5 NM 95 % av tiden og har ingen varsling om bord.`);
  else if(!X.spec.mon) t=t2(`<b>Terminal area, still on an ${X.spec.sp} leg.</b> Within 30 NM of the destination the CDI full scale drops to 1 NM. RNAV 5 itself only asks for ±5 NM 95 % of the time, with no on-board alerting.`,`<b>Terminalområdet, fortsatt på en ${X.spec.sp}-etappe.</b> Innenfor 30 NM fra destinasjonen går fullt utslag ned til 1 NM. RNAV 5 krever bare ±5 NM 95 % av tiden, uten varsling om bord.`);
  else t=t2(`<b>Terminal, ${X.spec.sp}.</b> Full scale 1 NM. The inner band is ±1×RNP (where you must be 95 % of the time), the outer ±2×RNP (the containment the system alerts on). ${S.wpT==='by'?'Fly-by turns start early and cut inside.':'Fly-over turns swing outside before rejoining.'}`,`<b>Terminal, ${X.spec.sp}.</b> Fullt utslag 1 NM. Det indre båndet er ±1×RNP (der du skal være 95 % av tiden), det ytre ±2×RNP (inneslutningen systemet varsler på). ${S.wpT==='by'?'Fly-by-svinger starter tidlig og kutter innenfor.':'Fly-over-svinger svinger ut før de går tilbake.'}`);
  const e=el('gnSee'), h=L(t); if(e._h!==h){ e._h=h; e.innerHTML=h; } }
function legend(){ el('gnLeg').innerHTML=`<span><i style="--c:${COL.path}"></i>${L(t2('path flown','banen som flys'))}</span><span><i class="d" style="--c:#c9d2d8"></i>${L(t2('legs (TF)','etapper (TF)'))}</span>`+
  (S.show.cont?`<span><i class="band" style="--c:${COL.in}"></i>±1×RNP</span><span><i class="band" style="--c:${COL.out}"></i>±2×RNP</span>`:'')+
  `<span><i class="dot" style="--c:#fff"></i>${L(t2('fly-by ✦ · fly-over ⊛','fly-by ✦ · fly-over ⊛'))}</span>`+(S.jam?`<span><i class="dot" style="--c:${COL.warn}"></i>${L(t2('DME/DME position error (95 %)','DME/DME-posisjonsfeil (95 %)'))}</span>`:''); }

/* ---------- controls ---------- */
LAB.add({},{'Mask angle':'Maskevinkel','Ground speed':'Fart over bakken','Bank angle':'Krengning','Off track (+ right)':'Utenfor tracken (+ høyre)','Height off the profile':'Høyde over/under profilen',
  'Spread':'Spredt','Bunched':'Samlet','Only 5':'Bare 5','On':'På','Off':'Av','Fly-by':'Fly-by','Fly-over':'Fly-over','LNAV':'LNAV','LNAV/VNAV':'LNAV/VNAV','LPV':'LPV'});
const preSeg=LAB.seg(el('cPre'),[['good','Spread'],['bunch','Bunched'],['few','Only 5']],S.pre,v=>{ S.pre=v; S.sats=mkSats(v); update(); });
function preSync(){ preSeg.set(S.pre); }
const maskSl=LAB.slider(el('cMask'),{label:'Mask angle',min:0,max:30,step:1,v:S.mask,f:v=>v+'°',on:v=>{ S.mask=v; update(); }});
const sbSeg=LAB.seg(el('cSbas'),[['on','On'],['off','Off']],S.sbas,v=>{ S.sbas=v; update(); });
const wpSeg=LAB.seg(el('cWp'),[['by','Fly-by'],['over','Fly-over']],S.wpT,v=>{ S.wpT=v; rebuild(); });
const gsSl=LAB.slider(el('cTurn'),{label:'Ground speed',min:120,max:320,step:10,v:S.gs,f:v=>v+' kt',on:v=>{ S.gs=v; rebuild(); }});
const bkSl=LAB.slider(el('cTurn'),{label:'Bank angle',min:10,max:30,step:1,v:S.bank,f:v=>v+'°',on:v=>{ S.bank=v; rebuild(); }});
const offSl=LAB.slider(el('cTurn'),{label:'Off track (+ right)',min:-1.5,max:1.5,step:0.05,v:S.off,f:v=>(v>0?'+':'')+fmt(v,2)+' NM',on:v=>{ S.off=v; update(); }});
const minSeg=LAB.seg(el('cMin'),[['lnav','LNAV'],['lnavvnav','LNAV/VNAV'],['lpv','LPV']],S.min,v=>{ S.min=v; update(); });
const vSl=LAB.slider(el('cOff'),{label:'Height off the profile',min:-300,max:300,step:10,v:S.voff,f:v=>(v>0?'+':'')+v+' ft',on:v=>{ S.voff=v; update(); }});
function rebuild(){ const f=S.s/(P.len||1); build(); S.s=Math.min(P.len,f*P.len); update(); }
function togs(){ const b=el('cShow'); b.innerHTML=[['cont',t2('RNP containment','RNP-inneslutning'),''],['turn',t2('Turn construction','Svingkonstruksjon'),'deep']].map(([k,n,c])=>`<button type="button" class="xtog ${c}" data-k="${k}" aria-pressed="${!!S.show[k]}">${L(n)}</button>`).join(''); }
el('cShow').addEventListener('click',e=>{ const b=e.target.closest('[data-k]'); if(!b) return; S.show[b.dataset.k]=!S.show[b.dataset.k]; togs(); update(); });
function turnRo(){ const t=nextTurn(), r=G.turnRadius(S.gs,S.bank); if(!t){ el('turnRo').innerHTML=''; return; }
  const dir=t.dA>0?L(t2('right','høyre')):L(t2('left','venstre'));
  el('turnRo').innerHTML=`<div class="rrow"><span>${L(t2('Next turn','Neste sving'))}</span><b>${WPS[t.i].n} · ${fmt(Math.abs(t.dA),0)}° ${dir}</b></div><div class="rrow"><span>${L(t2('Turn radius','Svingradius'))}</span><b>${fmt(r,2)} NM</b></div>`+
    (t.lead>0?`<div class="rrow"><span>${L(t2('Starts before the waypoint','Starter før veipunktet'))}</span><b>${fmt(t.lead,2)} NM</b></div>`:`<div class="rrow"><span>${L(t2('Swings beyond the new leg','Svinger utenfor ny etappe'))}</span><b>${fmt(t.over,2)} NM</b></div>`); }
function hints(){ el('hintSky').textContent=L(t2('Drag the satellites in the sky plot. Below the mask angle a satellite is ignored.','Dra satellittene i himmelplottet. Under maskevinkelen blir en satellitt ignorert.'));
  const m=MIN[S.min]; el('minHint').textContent=L(t2(`${m.k}: ${m.da?'DA':'MDA'} ${RWY.elev+m.ht} ft (${m.ht} ft above the threshold, illustrative). ${S.min==='lpv'?'Needs SBAS.':S.min==='lnavvnav'?'Baro-VNAV: not below the chart temperature limit.':'2D: fly as a CDFA.'}`,`${m.k}: ${m.da?'DA':'MDA'} ${RWY.elev+m.ht} ft (${m.ht} ft over terskelen, illustrativt). ${S.min==='lpv'?'Krever SBAS.':S.min==='lnavvnav'?'Baro-VNAV: ikke under temperaturgrensen på kartet.':'2D: flys som CDFA.'}`)); }
const HEADS={hSat:t2('Satellites','Satellitter'),gSbas:t2('SBAS (EGNOS)','SBAS (EGNOS)'),hRoute:t2('Route and turns','Rute og svinger'),gWp:t2('Turn waypoints','Svingpunkter'),hApp:t2('Approach','Innflyging'),gMin:t2('Minima','Minima'),hShow:t2('Show','Vis'),ctlS:t2('Controls','Kontroller'),skyH:t2('Sky above you','Himmelen over deg'),profH:t2('Final approach','Sluttinnflyging'),tryH:t2('Try it','Prøv selv'),ddH:t2('Deep dive','Dypdykk'),
  sp1:t2('PBN navigation specifications','PBN-navigasjonsspesifikasjoner'),sp1s:t2('accuracy and where they are used','nøyaktighet og hvor de brukes'),sp2:t2('RNP APCH minima','RNP APCH-minima'),sp2s:t2('LNAV, LNAV/VNAV, LP, LPV','LNAV, LNAV/VNAV, LP, LPV'),sp3:t2('How RAIM decides','Slik avgjør RAIM'),sp3s:t2('the protection level','beskyttelsesnivået'),disc:t2('Training simulation · not for navigation','Opplæringssimulering · ikke for navigasjon'),
  tryLead:t2('Six short tasks, one at a time. Each sets up the lab; change it until the check says yes.','Seks korte oppgaver, én om gangen. Hver setter opp labben; endre den til sjekken sier ja.')};
function heads(){ for(const k in HEADS){ const e=el(k); if(e) e.textContent=L(HEADS[k]); } }

/* phase tabs and tools */
const TABS=[['route',t2('Route','Rute')],['enroute',t2('En route','Underveis')],['terminal',t2('Terminal','Terminal')],['approach',t2('Approach','Innflyging')]];
function tabOn(){ return S.view==='route'?'route':X.ph==='missed'?'approach':X.ph; }
function tabs(){ const on=tabOn(); el('gnTabs').innerHTML=TABS.map(([k,n])=>`<button type="button" role="tab" data-t="${k}" class="${on===k?'on':''}" aria-selected="${on===k}">${L(n)}</button>`).join(''); }
el('gnTabs').addEventListener('click',e=>{ const b=e.target.closest('[data-t]'); if(!b) return; goPhase(b.dataset.t); });
function goPhase(k){ if(k==='route') S.view='route'; else { S.view='follow'; S.fly=false; S.s= k==='enroute'? 9 : k==='terminal'? sA-3.2 : sF+1.2; } update(); }
function tools(){ el('gnTools').innerHTML=`<button type="button" class="go" id="gnFly" aria-pressed="${S.fly}">${S.fly?'❚❚ '+L(t2('Pause','Pause')):'▶ '+L(t2('Fly','Fly'))}</button><button type="button" class="jam" id="gnJam" aria-pressed="${S.jam}">${L(t2('Jamming','Jamming'))}</button>`; }
el('gnTools').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
  if(b.id==='gnFly'){ S.fly=!S.fly; if(S.fly&&S.s>=P.len-0.05) S.s=0; if(S.fly&&S.view==='route') S.view='follow'; }
  if(b.id==='gnJam') S.jam=!S.jam; update(); });

/* ---------- loop ---------- */
let raf=0, lastT=0, vis=true;
LAB.visible(el('gnVp'),v=>{ vis=v; if(v) kick(); });
function kick(){ if(!raf) raf=requestAnimationFrame(frame); }
function frame(t){ raf=0; const dt=Math.min(0.1,lastT?(t-lastT)/1000:0.016); lastT=t; if(!vis){ lastT=0; return; }
  let more=false;
  if(S.fly){ const k=X.ph==='approach'||X.ph==='missed'?12:30; S.s+=S.gs/3600*dt*k; if(S.s>=P.len){ S.s=P.len; S.fly=false; tools(); } more=true; derive(); setHsi(); slowUi(dt); }
  camTarget(); if(camSnap||reduced()){ CAM.k=CT.k; CAM.ox=CT.ox; CAM.oy=CT.oy; camSnap=false; }
  else { const f=1-Math.exp(-dt*(S.fly?8:5)); CAM.k=Math.exp(Math.log(CAM.k)+(Math.log(CT.k)-Math.log(CAM.k))*f); CAM.ox+=(CT.ox-CAM.ox)*f; CAM.oy+=(CT.oy-CAM.oy)*f;
    if(Math.abs(Math.log(CT.k/CAM.k))>0.002||Math.hypot(CT.ox-CAM.ox,CT.oy-CAM.oy)*CAM.k>0.5) more=true; }
  drawMap(); if(HSI.tick(dt)) more=true; HSI.draw();
  if(more) kick(); else lastT=0; }
let uiT=0, lastPh='';
function slowUi(dt){ uiT+=dt; if(uiT<0.12&&X.ph===lastPh) return; uiT=0; chip(); drawProf(); turnRo(); if(X.ph!==lastPh){ lastPh=X.ph; tabs(); see(); drawRo(); drawSky(); } else see(); live(); }
function update(){ derive(); setHsi(); drawSky(); drawRo(); chip(); see(); legend(); tabs(); tools(); turnRo(); hints(); drawProf(); lastPh=X.ph; live(); kick(); }

/* ---------- set the lab up (cards, tasks) ---------- */
function setS(o){ o=o||{}; S.fly=false;
  if(o.pre){ S.pre=o.pre; S.sats=mkSats(o.pre); } if(o.mask!=null) S.mask=o.mask; if(o.sbas) S.sbas=o.sbas; if(o.wpT) S.wpT=o.wpT; if(o.gs) S.gs=o.gs; if(o.bank) S.bank=o.bank;
  if(o.off!=null) S.off=o.off; if(o.voff!=null) S.voff=o.voff; if(o.min) S.min=o.min; if(o.jam!=null) S.jam=o.jam; if(o.show) Object.assign(S.show,o.show);
  build(); preSync(); maskSl.set(S.mask); sbSeg.set(S.sbas); wpSeg.set(S.wpT); gsSl.set(S.gs); bkSl.set(S.bank); offSl.set(S.off); minSeg.set(S.min); vSl.set(S.voff); togs();
  if(o.ph) goPhase(o.ph); else update(); }
const toModel=()=>{ const t=el('gnVp'); if(t) t.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'center'}); document.querySelectorAll('details.xpanel').forEach(d=>{ d.open=true; }); };

/* ---------- Understand: key concept cards ---------- */
if(window.KCS){ const {sv,tx,ar}=KCS;
  const sky=(pts)=>`<circle cx="100" cy="32" r="28" fill="none" stroke="#3a4a56"/><circle cx="100" cy="32" r="14" fill="none" stroke="#2a3640"/>${pts.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3.2" fill="#63D9A0"/>`).join('')}`;
  const C=(o,ph)=>()=>setS(Object.assign({},o,ph?{ph}:{}));
  const KC=[
   {k:'fix',t:t2('Position from ranges','Posisjon fra avstander'),d:t2('Each satellite gives a <b>pseudorange</b>: signal travel time × the speed of light, still holding the receiver clock error. Three position unknowns plus the clock: <b>four satellites</b> for a 3D fix.','Hver satellitt gir en <b>pseudoavstand</b>: signalets gangtid × lyshastigheten, der mottakerens klokkefeil fortsatt er med. Tre ukjente for posisjonen pluss klokken: <b>fire satellitter</b> for en 3D-posisjon.'),
    ill:()=>sv(`<circle cx="100" cy="40" r="3" fill="#fff"/>${[[40,10],[80,6],[130,8],[170,14]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3" fill="#63D9A0"/><line x1="${x}" y1="${y}" x2="100" y2="40" stroke="rgba(99,217,160,.45)"/>`).join('')}${tx(100,58,'x · y · z · clock','#c9d2da','middle')}`),click:C({pre:'good',mask:5,jam:false}),to:'#gnVp'},
   {k:'dop',t:t2('Geometry and DOP','Geometri og DOP'),d:t2('Spread-out satellites make the ranges cross at wide angles; bunched ones multiply every range error. <b>Error ≈ DOP × range error</b>: HDOP for horizontal, VDOP for vertical.','Satellitter spredt over himmelen gir avstander som krysser i store vinkler; samlede satellitter forstørrer hver avstandsfeil. <b>Feil ≈ DOP × avstandsfeil</b>: HDOP horisontalt, VDOP vertikalt.'),
    ill:()=>sv(`${sky([[100,8],[76,40],[124,40],[100,52]]).replace(/cx="100" cy="32" r="28"/,'cx="52" cy="32" r="28"').replace(/cx="100" cy="32" r="14"/,'cx="52" cy="32" r="14"').replace(/cx="(\d+)" cy="(\d+)" r="3.2"/g,(m,x,y)=>`cx="${x-48}" cy="${y}" r="3.2"`)}${tx(52,62,'low DOP','#63D9A0','middle')}<circle cx="148" cy="32" r="28" fill="none" stroke="#3a4a56"/>${[[160,14],[166,22],[156,22],[163,10]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3.2" fill="#F0B440"/>`).join('')}${tx(148,62,'high DOP','#F0B440','middle')}`),click:C({pre:'bunch',jam:false,sbas:'off'}),to:'#gnVp'},
   {k:'raim',t:t2('RAIM and FDE','RAIM og FDE'),d:t2('Integrity is knowing when <b>not</b> to trust the position. With <b>5</b> satellites RAIM can detect a fault, with <b>6</b> it can exclude it (FDE), but only if the geometry meets the alert limit for the phase.','Integritet er å vite når du <b>ikke</b> kan stole på posisjonen. Med <b>5</b> satellitter kan RAIM oppdage en feil, med <b>6</b> kan den utelate den (FDE), men bare hvis geometrien oppfyller alarmgrensen for fasen.'),
    ill:()=>sv(`${tx(30,26,'4','#7d8b95','middle',14)}${tx(30,46,'fix','#7d8b95','middle')}${tx(85,26,'5','#63D9A0','middle',14)}${tx(85,46,'detect','#63D9A0','middle')}${tx(150,26,'6','#7FCBE8','middle',14)}${tx(150,46,'exclude','#7FCBE8','middle')}${ar(42,22,70,22,'#55626e')}${ar(97,22,135,22,'#55626e')}`),click:C({pre:'few',sbas:'off',jam:false},'approach'),to:'#gnVp',dd:t2('Before an approach without SBAS, check that RAIM is predicted for the ETA (NOTAM, a prediction service or the FMS predictive page).','Før en innflyging uten SBAS: sjekk at RAIM er forventet tilgjengelig ved ETA (NOTAM, en prediksjonstjeneste eller FMS-ens prediksjonsside).')},
   {k:'sbas',t:t2('SBAS (EGNOS)','SBAS (EGNOS)'),d:t2('Geostationary satellites broadcast <b>corrections and integrity</b> for every GNSS satellite. Smaller errors and a fast, trusted alarm make <b>LPV</b> possible: ILS-like guidance down to 200 ft.','Geostasjonære satellitter sender <b>korreksjoner og integritet</b> for hver GNSS-satellitt. Mindre feil og en rask, pålitelig alarm gjør <b>LPV</b> mulig: ILS-lignende ledning ned til 200 ft.'),
    ill:()=>sv(`<rect x="94" y="4" width="12" height="8" fill="#7FCBE8" transform="rotate(45 100 8)"/>${tx(116,12,'EGNOS','#7FCBE8')}${ar(100,14,60,44,'#7FCBE8')}${ar(100,14,140,44,'#7FCBE8')}<line x1="20" y1="54" x2="180" y2="54" stroke="#55626e"/>${tx(100,50,'corr. + integrity','#c9d2da','middle')}`),click:C({sbas:'on',min:'lpv',jam:false,pre:'good'},'approach'),to:'#gnVp'},
   {k:'rnp',t:t2('RNAV and RNP','RNAV og RNP'),d:t2('Both fly between waypoints. <b>RNP</b> adds on-board <b>performance monitoring and alerting</b>: stay within ±1×RNP 95 % of the time, and be warned before the error can exceed 2×RNP.','Begge flyr mellom veipunkter. <b>RNP</b> legger til <b>overvåking av ytelse og varsling</b> om bord: hold deg innenfor ±1×RNP 95 % av tiden, og bli varslet før feilen kan bli større enn 2×RNP.'),
    ill:()=>sv(`<rect x="10" y="14" width="180" height="36" fill="rgba(44,84,104,.6)"/><rect x="10" y="23" width="180" height="18" fill="rgba(79,159,194,.55)"/><line x1="10" y1="32" x2="190" y2="32" stroke="#F06BB4" stroke-width="1.6"/>${tx(186,20,'2×RNP','#c9d2da','end')}${tx(186,38,'1×RNP','#fff','end')}`),click:C({show:{cont:true},jam:false},'terminal'),to:'#gnVp'},
   {k:'spec',t:t2('PBN specifications','PBN-spesifikasjoner'),d:t2('The number is the accuracy in NM, 95 % of the flight time: <b>RNAV 10, RNP 4</b> oceanic, <b>RNAV 5</b> en route, <b>RNAV 1, RNP 1</b> SIDs and STARs, <b>RNP APCH</b> and <b>RNP AR APCH</b> approaches.','Tallet er nøyaktigheten i NM, 95 % av flytiden: <b>RNAV 10, RNP 4</b> over hav, <b>RNAV 5</b> underveis, <b>RNAV 1, RNP 1</b> SID og STAR, <b>RNP APCH</b> og <b>RNP AR APCH</b> innflyging.'),
    ill:()=>sv(`${[['10',8],['5',52],['1',100],['0.3',146]].map(([n,x])=>`<rect x="${x}" y="${32-Math.min(26,+n*2.6+3)}" width="40" height="${2*Math.min(26,+n*2.6+3)}" fill="rgba(79,159,194,.35)"/>${tx(x+20,35,n,'#fff','middle',10)}`).join('')}`),click:()=>{ S.view='route'; S.show.cont=true; togs(); update(); },to:'#gnVp'},
   {k:'turn',t:t2('Fly-by and fly-over','Fly-by og fly-over'),d:t2('At a <b>fly-by</b> waypoint the turn starts <b>r·tan(ΔTrack/2)</b> early and cuts the corner. A <b>fly-over</b> waypoint must be overflown, so the aircraft overshoots and comes back: more airspace.','Ved et <b>fly-by</b>-veipunkt starter svingen <b>r·tan(Δtrack/2)</b> før og kutter hjørnet. Et <b>fly-over</b>-veipunkt skal overflys, så flyet skyter over og kommer tilbake: mer luftrom.'),
    ill:()=>sv(`<path d="M10,56 L60,8 L110,56" fill="none" stroke="rgba(230,235,239,.4)" stroke-dasharray="3 3"/><path d="M10,56 L44,24 Q60,6 76,24 L110,56" fill="none" stroke="#F06BB4" stroke-width="1.8"/><path d="M60,8 l3,6 l-6,0z" fill="#fff"/><path d="M110,56 L160,8 L196,44" fill="none" stroke="rgba(230,235,239,.4)" stroke-dasharray="3 3"/><path d="M110,56 L160,8 Q186,-8 190,22 Q190,34 196,44" fill="none" stroke="#F06BB4" stroke-width="1.8"/><circle cx="160" cy="8" r="4" fill="none" stroke="#fff"/>`),
    click:C({wpT:'over',gs:250,show:{turn:true,cont:true},jam:false},'terminal'),to:'#gnVp'},
   {k:'cdi',t:t2('CDI scaling','CDI-skalering'),d:t2('In GPS mode full scale follows the phase: <b>2 NM</b> en route, <b>1 NM</b> terminal, <b>0.3 NM</b> on final (LPV: angular, like a localiser). The same error moves the bar further on final.','I GPS-modus følger fullt utslag fasen: <b>2 NM</b> underveis, <b>1 NM</b> terminal, <b>0,3 NM</b> på finalen (LPV: vinkelbasert, som en localizer). Samme feil gir større utslag på finalen.'),
    ill:()=>sv(`${[[30,'2'],[100,'1'],[170,'0.3']].map(([x,n],i)=>`<line x1="${x-24}" y1="30" x2="${x+24}" y2="30" stroke="#55626e"/>${[-2,-1,1,2].map(k=>`<circle cx="${x+k*11}" cy="30" r="1.6" fill="#c9d2da"/>`).join('')}<line x1="${x+[1.5,3,15][i]}" y1="16" x2="${x+[1.5,3,15][i]}" y2="44" stroke="#F06BB4" stroke-width="2"/>${tx(x,58,n+' NM','#c9d2da','middle')}`).join('')}`),click:C({off:0.2,min:'lnav',jam:false},'approach'),to:'#gnVp'},
   {k:'min',t:t2('LNAV, LNAV/VNAV, LPV','LNAV, LNAV/VNAV, LPV'),d:t2('<b>LNAV</b>: 2D to an MDA, flown as a CDFA. <b>LNAV/VNAV</b>: adds a vertical path, usually baro-VNAV, to a DA (mind the temperature limit). <b>LPV</b>: SBAS lateral and vertical guidance to a DA.','<b>LNAV</b>: 2D til en MDA, flydd som CDFA. <b>LNAV/VNAV</b>: legger til en vertikal bane, vanligvis baro-VNAV, til en DA (pass på temperaturgrensen). <b>LPV</b>: SBAS-ledning sideveis og vertikalt til en DA.'),
    ill:()=>sv(`<line x1="10" y1="56" x2="190" y2="56" stroke="#55626e"/><line x1="20" y1="14" x2="170" y2="54" stroke="#7FCBE8" stroke-width="1.6"/>${[[38,'#F0B440','MDA'],[46,'#c9d2da','DA'],[52,'#63D9A0','LPV']].map(([y,c,n])=>`<line x1="110" y1="${y}" x2="190" y2="${y}" stroke="${c}" stroke-dasharray="3 2"/>${tx(108,y+3,n,c,'end')}`).join('')}`),click:C({min:'lnavvnav',sbas:'on',jam:false,pre:'good'},'approach'),to:'#gnVp',dd:t2('A baro-VNAV path follows the altimeter, so in cold air it lies too low; below the chart temperature limit use LNAV, or LPV which is not affected.','En baro-VNAV-bane følger høydemåleren, så i kald luft ligger den for lavt; under temperaturgrensen på kartet bruker du LNAV, eller LPV som ikke påvirkes.')},
   {k:'pt',dp:true,t:t2('Path terminators','Baneavslutninger'),d:t2('Each leg in the database has a two-letter code: <b>TF</b> track between fixes (the usual one), <b>DF</b> direct to a fix, <b>CF</b> course to a fix, <b>RF</b> a fixed-radius arc. RF needs aircraft capability and approval.','Hver etappe i databasen har en kode på to bokstaver: <b>TF</b> track mellom fixer (den vanligste), <b>DF</b> direkte til en fix, <b>CF</b> kurs til en fix, <b>RF</b> en bue med fast radius. RF krever kapabilitet og godkjenning.'),
    ill:()=>sv(`<path d="M10,50 L60,20" stroke="#F06BB4" stroke-width="1.6"/>${tx(30,58,'TF','#fff','middle')}<path d="M80,50 Q95,10 130,24" fill="none" stroke="#F06BB4" stroke-width="1.6"/>${tx(100,58,'RF','#fff','middle')}<path d="M150,50 L190,18" stroke="#F06BB4" stroke-width="1.6" stroke-dasharray="4 2"/>${tx(170,58,'DF','#fff','middle')}`),click:()=>{ S.view='route'; update(); },to:'#gnVp',dd:t2('The approach must come from a current AIRAC database and must not be built or edited by hand; check it against the chart.','Innflygingen må komme fra en gyldig AIRAC-database og skal ikke bygges eller redigeres for hånd; sjekk den mot kartet.')},
   {k:'jam',t:t2('Jamming and spoofing','Jamming og spoofing'),d:t2('<b>Jamming</b> drowns the weak signals: GNSS and EGNOS go together and the FMS reverts to DME/DME or IRS. <b>Spoofing</b> sends false signals: the position drifts while everything looks normal, so cross-check.','<b>Jamming</b> overdøver de svake signalene: GNSS og EGNOS forsvinner sammen, og FMS-en går over til DME/DME eller IRS. <b>Spoofing</b> sender falske signaler: posisjonen driver mens alt ser normalt ut, så kryssjekk.'),
    ill:()=>sv(`${[0,1,2,3,4].map(i=>`<path d="M${20+i*6},${32-i*5} Q${40+i*8},32 ${20+i*6},${32+i*5}" fill="none" stroke="rgba(236,90,71,${0.9-i*0.15})"/>`).join('')}<circle cx="150" cy="32" r="3" fill="#fff"/><circle cx="150" cy="32" r="16" fill="none" stroke="#F0B440" stroke-dasharray="3 2"/>${tx(150,58,'DME/DME','#F0B440','middle')}`),click:C({jam:true},'terminal'),to:'#gnVp',dd:t2('Interference is common near conflict areas, including Finnmark and around the Baltic. Report it to ATC and in an occurrence report.','Forstyrrelser er vanlige nær konfliktområder, også i Finnmark og rundt Østersjøen. Rapporter det til ATC og i en hendelsesrapport.')}];
  KCS.render(el('kcGrid'),KC); }

/* ---------- deep dive tables ---------- */
function tables(){
  const R=[['RNAV 10',t2('Oceanic and remote (formerly RNP 10)','Hav og avsidesliggende områder (tidligere RNP 10)'),'10',0],['RNAV 5',t2('En route, continental (formerly B-RNAV)','Underveis over land (tidligere B-RNAV)'),'5',0],['RNAV 2 · RNAV 1',t2('En route (2); SIDs and STARs (1, formerly P-RNAV)','Underveis (2); SID og STAR (1, tidligere P-RNAV)'),'2 · 1',0],
   ['RNP 4 · RNP 2',t2('Oceanic and remote; en route','Hav og avsidesliggende; underveis'),'4 · 2',1],['RNP 1',t2('SIDs and STARs','SID og STAR'),'1',1],['A-RNP',t2('En route to approach, with RF legs and scalable RNP','Underveis til innflyging, med RF-etapper og skalerbar RNP'),'2 · 1 · 0.3',1],
   ['RNP APCH',t2('Approach: 1 NM initial, intermediate and missed; 0.3 NM final','Innflyging: 1 NM initial, intermediate og bortflyging; 0,3 NM final'),'1 · 0.3',1],['RNP AR APCH',t2('Approaches with special authorisation: tight, curved paths','Innflyginger med særskilt godkjenning: trange, buede baner'),'0.3 – 0.1',1]];
  el('stab').innerHTML=`<tr><th>${L(t2('Specification','Spesifikasjon'))}</th><th>${L(t2('Used for','Brukes til'))}</th><th>${L(t2('Accuracy, NM (95 %)','Nøyaktighet, NM (95 %)'))}</th><th>${L(t2('On-board monitoring and alerting','Overvåking og varsling om bord'))}</th></tr>`+
    R.map(r=>`<tr><td><b>${r[0]}</b></td><td>${L(r[1])}</td><td>${r[2]}</td><td>${L(r[3]?t2('Yes','Ja'):t2('No','Nei'))}</td></tr>`).join('');
  el('stabN').textContent=L(t2('RNAV 5 may use VOR/DME, DME/DME, INS or GNSS; RNAV 1 DME/DME or GNSS. RNP 1, RNP APCH and RNP AR in practice need GNSS, so they are lost when GNSS is jammed.','RNAV 5 kan bruke VOR/DME, DME/DME, INS eller GNSS; RNAV 1 DME/DME eller GNSS. RNP 1, RNP APCH og RNP AR krever i praksis GNSS, så de forsvinner når GNSS jammes.'));
  const M=[['LNAV','2D',t2('GNSS with RAIM, or SBAS','GNSS med RAIM, eller SBAS'),'MDA',t2('Fly as a CDFA','Flys som CDFA')],['LNAV/VNAV','3D',t2('GNSS + baro-VNAV (or SBAS)','GNSS + baro-VNAV (eller SBAS)'),'DA',t2('Temperature limits for baro-VNAV','Temperaturgrenser for baro-VNAV')],['LP','2D','SBAS','MDA',t2('Angular lateral guidance, no vertical','Vinkelbasert sideledning, ingen vertikal')],['LPV','3D','SBAS','DA',t2('ILS-like, down to 200 ft','ILS-lignende, ned til 200 ft')]];
  el('mtab').innerHTML=`<tr><th>${L(t2('Minima','Minima'))}</th><th>2D/3D</th><th>${L(t2('Needs','Krever'))}</th><th>${L(t2('Minimum','Minimum'))}</th><th>${L(t2('Note','Merknad'))}</th></tr>`+M.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${L(typeof r[2]==='string'?t2(r[2],r[2]):r[2])}</td><td>${r[3]}</td><td>${L(r[4])}</td></tr>`).join('');
  el('mtabN').textContent=L(t2('Approach charts are titled RNP (formerly RNAV (GNSS)) and list every line of minima the procedure supports; the crew uses the lowest one the aircraft, the approval and the conditions allow.','Innflygingskart har tittelen RNP (tidligere RNAV (GNSS)) og viser hver linje med minima prosedyren har; besetningen bruker den laveste som flyet, godkjenningen og forholdene tillater.')); }

/* ---------- Try it: one task at a time ---------- */
let ti=0; const ans={}, touched={};
const TASKS=[
 {k:'scale',model:1,q:t2('You are 0.2 NM right of track en route. Without moving sideways, take the aircraft onto final (Approach) and read the HSI.','Du er 0,2 NM til høyre for tracken underveis. Uten å flytte deg sideveis: ta flyet inn på finalen (Innflyging) og les HSI-en.'),pre:{pre:'good',sbas:'on',min:'lnav',off:0.2,voff:0,jam:false,ph:'enroute'},
  check:()=>{ if(Math.abs(Math.abs(S.off)-0.2)>0.03) return {ok:0,m:t2('Keep the aircraft 0.2 NM off track (Off track slider).','Hold flyet 0,2 NM fra tracken (glidebryteren Utenfor tracken).')};
    if(!(X.ph==='approach'&&X.dFaf<0)) return {ok:0,m:t2(`Now ${fmt(Math.abs(G.dots(S.off,X.fs,9)),1)} dots at ${fmt(X.fs,X.fs<1?2:0)} NM full scale. Press the Approach tab (or Fly).`,`Nå ${fmt(Math.abs(G.dots(S.off,X.fs,9)),1)} prikker med ${fmt(X.fs,X.fs<1?2:0)} NM fullt utslag. Trykk fanen Innflyging (eller Fly).`)};
    return {ok:1,m:t2(`Yes: on final full scale is ${fmt(X.fs,2)} NM, so the same 0.2 NM is ${fmt(Math.abs(G.dots(S.off,X.fs,9)),1)} of 2 dots. En route it was 0.2 dots. Check the annunciation (here LNAV) before the FAF: it tells you which scale you are on.`,`Ja: på finalen er fullt utslag ${fmt(X.fs,2)} NM, så de samme 0,2 NM blir ${fmt(Math.abs(G.dots(S.off,X.fs,9)),1)} av 2 prikker. Underveis var det 0,2 prikker. Sjekk annonseringen (her LNAV) før FAF: den forteller hvilken skala du er på.`)}; }},
 {k:'raim',model:1,q:t2('EGNOS is off. Make RAIM unavailable for the approach while you still have a 3D fix: drag satellites or raise the mask angle.','EGNOS er av. Gjør RAIM utilgjengelig for innflygingen mens du fortsatt har en 3D-posisjon: dra satellitter eller øk maskevinkelen.'),pre:{pre:'good',mask:5,sbas:'off',min:'lnav',jam:false,ph:'approach'},
  check:()=>{ if(S.sbas==='on') return {ok:0,m:t2('Keep SBAS off for this one.','La SBAS være av her.')}; if(!X.D) return {ok:0,m:t2('Too far: no 3D fix now. Bring back at least four satellites.','For langt: ingen 3D-posisjon nå. Få tilbake minst fire satellitter.')};
    const r=X.rApp; if(r.state==='unavail'||r.state==='none') return {ok:1,m:t2(`Yes: ${r.n} satellites, ${r.state==='none'?'none spare to cross-check':'protection level '+fmt(r.hpl,0)+' m against the 556 m (0.3 NM) alert limit'}. The position may still be accurate, but nothing proves it: no RNP approach. That is what the RAIM prediction before departure is for.`,`Ja: ${r.n} satellitter, ${r.state==='none'?'ingen til overs til å kryssjekke':'beskyttelsesnivå '+fmt(r.hpl,0)+' m mot alarmgrensen på 556 m (0,3 NM)'}. Posisjonen kan fortsatt være nøyaktig, men ingenting beviser det: ingen RNP-innflyging. Det er derfor du sjekker RAIM-prediksjonen før avgang.`)};
    return {ok:0,m:t2(`RAIM is still available (${r.n} satellites, HPL ${fmt(r.hpl,0)} m). Bunch them up, or raise the mask angle.`,`RAIM er fortsatt tilgjengelig (${r.n} satellitter, HPL ${fmt(r.hpl,0)} m). Samle dem, eller øk maskevinkelen.`)}; }},
 {k:'fde',q:t2('Five satellites in view, good geometry, RAIM available. One satellite starts sending a wrong range. What happens?','Fem satellitter i sikte, god geometri, RAIM tilgjengelig. Én satellitt begynner å sende feil avstand. Hva skjer?'),
  opts:[t2('RAIM detects it and alerts, but cannot tell which one: GNSS can no longer be used','RAIM oppdager det og varsler, men vet ikke hvilken: GNSS kan ikke lenger brukes'),t2('RAIM excludes the faulty satellite and navigation continues','RAIM utelater den feile satellitten, og navigasjonen fortsetter'),t2('Nothing: five satellites are enough to ignore one','Ingenting: fem satellitter er nok til å se bort fra én'),t2('SBAS takes over the ranging','SBAS overtar avstandsmålingen')],c:0,
  e:t2('Detection needs one spare measurement (5). Exclusion needs two (6): the receiver tests each subset without one satellite and keeps the one that agrees (FDE).','Å oppdage krever én ekstra måling (5). Å utelate krever to (6): mottakeren tester hvert utvalg uten én satellitt og beholder det som stemmer (FDE).'),show:{pre:'few',sbas:'off',jam:false,ph:'approach'}},
 {k:'over',model:1,q:t2('Make the turn waypoints fly-over and fly at 250 kt or more. Where does the path first leave the ±1×RNP band?','Gjør svingpunktene til fly-over og fly i 250 kt eller mer. Hvor forlater banen først ±1×RNP-båndet?'),pre:{wpT:'by',gs:220,bank:25,show:{cont:true,turn:true},jam:false,ph:'terminal'},
  check:()=>{ if(S.wpT!=='over') return {ok:0,m:t2('Choose Fly-over under Turn waypoints.','Velg Fly-over under Svingpunkter.')}; if(S.gs<250) return {ok:0,m:t2('Now raise the ground speed to 250 kt or more.','Øk nå farten over bakken til 250 kt eller mer.')};
    const r=G.turnRadius(S.gs,S.bank), T=P.turns.filter(t=>Math.abs(t.dA)>=1).map(t=>({n:WPS[t.i].n,o:G.flyOver(r,t.dA).over,c:G.flyByCut(r,t.dA),rnp:LEGS[t.i].rnp})), f=T.find(t=>t.o>t.rnp);
    if(!f) return {ok:0,m:t2('Still inside: try a lower bank angle too.','Fortsatt innenfor: prøv også mindre krengning.')};
    return {ok:1,m:t2(`At ${f.n}: the aircraft swings ${fmt(f.o,2)} NM beyond the new leg, outside ±1 NM, before it rejoins. As fly-by it would have cut ${fmt(f.c,2)} NM inside. That is why fly-over waypoints get bigger protected areas and are used only where overflying matters, such as the MAPt.`,`Ved ${f.n}: flyet svinger ${fmt(f.o,2)} NM utenfor den nye etappen, utenfor ±1 NM, før det går tilbake. Som fly-by ville det kuttet ${fmt(f.c,2)} NM innenfor. Derfor får fly-over-punkter større beskyttede områder og brukes bare der overflyging betyr noe, som MAPt.`)}; }},
 {k:'lpv',model:1,q:t2('EGNOS is on and LPV is selected. Drag satellites (or raise the mask) until LPV is lost but LNAV is still available.','EGNOS er på og LPV er valgt. Dra satellitter (eller øk masken) til LPV forsvinner mens LNAV fortsatt er tilgjengelig.'),pre:{pre:'good',mask:5,sbas:'on',min:'lpv',jam:false,ph:'approach'},
  check:()=>{ if(S.sbas!=='on') return {ok:0,m:t2('Keep SBAS on.','La SBAS være på.')}; if(!X.D) return {ok:0,m:t2('No fix at all now: bring back some satellites.','Ingen posisjon nå: få tilbake noen satellitter.')};
    if(X.lpv) return {ok:0,m:t2(`LPV still available: VPL ${fmt(X.sb.vpl,0)} m (limit 50 m). Weaken the vertical geometry: remove the high and the low satellites.`,`LPV fortsatt tilgjengelig: VPL ${fmt(X.sb.vpl,0)} m (grense 50 m). Svekk den vertikale geometrien: fjern de høye og de lave satellittene.`)};
    if(!X.lnav) return {ok:0,m:t2('Too far: LNAV is gone as well.','For langt: LNAV er også borte.')};
    return {ok:1,m:t2(`Yes: VPL ${fmt(X.sb.vpl,0)} m is above 50 m, while the horizontal protection still meets 0.3 NM. The receiver annunciates the downgrade to LNAV: use the LNAV MDA. LPV needs good vertical geometry, so VDOP is what matters here.`,`Ja: VPL ${fmt(X.sb.vpl,0)} m er over 50 m, mens den horisontale beskyttelsen fortsatt holder for 0,3 NM. Mottakeren melder nedgraderingen til LNAV: bruk LNAV-MDA. LPV krever god vertikal geometri, så det er VDOP som teller her.`)}; }},
 {k:'jam',q:t2('On the intermediate segment of an RNP approach in Finnmark, GNSS is lost, the FMS shows DME/DME and EGNOS is gone too. What do you do?','På intermediate-segmentet av en RNP-innflyging i Finnmark forsvinner GNSS, FMS-en viser DME/DME, og EGNOS er også borte. Hva gjør du?'),
  opts:[t2('Discontinue the RNP approach, tell ATC, ask for vectors to a conventional approach and report the interference','Avbryt RNP-innflygingen, si fra til ATC, be om vektorer til en konvensjonell innflyging og rapporter forstyrrelsen'),t2('Continue: DME/DME is accurate enough for RNP APCH','Fortsett: DME/DME er nøyaktig nok for RNP APCH'),t2('Continue to the LNAV minima instead of LPV','Fortsett til LNAV-minima i stedet for LPV'),t2('Switch SBAS off and on to restore the signal','Slå SBAS av og på for å få tilbake signalet')],c:0,
  e:t2('RNP APCH needs GNSS, and EGNOS uses the same frequencies, so it is jammed too. Have a conventional plan (ILS, VOR, radar) ready wherever interference is known.','RNP APCH krever GNSS, og EGNOS bruker de samme frekvensene, så den jammes også. Ha en konvensjonell plan (ILS, VOR, radar) klar der forstyrrelser er kjent.'),show:{jam:true,ph:'terminal'}}];
function drawTask(){ const t=TASKS[ti], a=ans[t.k], n=TASKS.length;
  let h=`<div class="th"><span class="n">${L(t2('Task','Oppgave'))} ${ti+1} ${L(t2('of','av'))} ${n}</span><span class="dots">${TASKS.map((x,i)=>`<button type="button" data-i="${i}" class="${i===ti?'on':''}" aria-label="${L(t2('Task','Oppgave'))} ${i+1}"></button>`).join('')}</span></div><p class="q">${L(t.q)}</p>`;
  if(t.model) h+=`<span class="fb" id="tfbS"></span><div class="nav"><button type="button" class="btn pri sm" data-go="1">${L(t2('Set it up in the lab','Sett det opp i labben'))} ↑</button>`;
  else h+=`<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${a!=null?'<b>'+L(a===t.c?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(t.e):''}</span><div class="nav"><button type="button" class="btn sm" data-show="1">${L(t2('Show it in the lab','Vis i labben'))} ↑</button>`;
  h+=`<span class="sp"></span><button type="button" class="btn sm" data-p="1" ${ti===0?'disabled':''}>← ${L(t2('Previous','Forrige'))}</button><button type="button" class="btn sm" data-n="1" ${ti===n-1?'disabled':''}>${L(t2('Next','Neste'))} →</button></div>`;
  el('tstep').innerHTML=h; drawTbox(); live(); }
function drawTbox(){ const b=el('tbox'), t=TASKS[ti]; if(!t.model||!touched[t.k]){ b.hidden=true; return; }
  b.hidden=false; b.innerHTML=`<span class="k">${L(t2('Task','Oppgave'))} ${ti+1}<button type="button" aria-label="${L(t2('Close the task','Lukk oppgaven'))}" id="tclose">×</button></span>${L(t.q)}<span class="fb" id="tfb"></span>`;
  el('tclose').onclick=()=>{ touched[t.k]=0; drawTbox(); live(); }; }
function live(){ if(typeof TASKS==='undefined') return; const t=TASKS[ti]; if(!t||!t.model) return; const f=el('tfbS'), g=el('tfb'); if(!touched[t.k]){ if(f) f.innerHTML=''; return; }
  const r=t.check(), h=(r.ok?'<b>✓</b> ':'')+L(r.m); for(const x of [f,g]) if(x&&x.innerHTML!==h){ x.innerHTML=h; x.classList.toggle('ok',!!r.ok); } }
el('tstep').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const t=TASKS[ti];
  if(b.dataset.i!=null){ ti=+b.dataset.i; drawTask(); return; } if(b.dataset.p){ ti=Math.max(0,ti-1); drawTask(); return; } if(b.dataset.n){ ti=Math.min(TASKS.length-1,ti+1); drawTask(); return; }
  if(b.dataset.go){ touched[t.k]=1; setS(t.pre); drawTbox(); live(); toModel(); return; }
  if(b.dataset.o!=null){ ans[t.k]=+b.dataset.o; drawTask(); return; }
  if(b.dataset.show){ setS(t.show); toModel(); } });

/* ---------- Test yourself: key points, memory aid, quiz ---------- */
const TAKE=[
 t2('<b>Error ≈ DOP × range error.</b> Satellites spread across the sky give a low DOP; bunched or low ones a high DOP.','<b>Feil ≈ DOP × avstandsfeil.</b> Satellitter spredt over himmelen gir lav DOP; samlede eller lave gir høy DOP.'),
 t2('<b>Integrity is not accuracy.</b> RAIM or SBAS must prove the position for the phase’s alert limit; without SBAS, check the RAIM prediction for the ETA.','<b>Integritet er ikke nøyaktighet.</b> RAIM eller SBAS må bevise posisjonen for fasens alarmgrense; uten SBAS sjekker du RAIM-prediksjonen for ETA.'),
 t2('<b>RNP = RNAV + monitoring and alerting.</b> ±1×RNP 95 % of the time; the system alerts before the error can pass 2×RNP.','<b>RNP = RNAV + overvåking og varsling.</b> ±1×RNP 95 % av tiden; systemet varsler før feilen kan passere 2×RNP.'),
 t2('<b>Check the scale before the FAF.</b> Full scale 2 NM en route, 1 NM terminal, 0.3 NM on final (LPV angular); the annunciation tells you which.','<b>Sjekk skalaen før FAF.</b> Fullt utslag 2 NM underveis, 1 NM terminal, 0,3 NM på finalen (LPV vinkelbasert); annonseringen forteller hvilken.'),
 t2('<b>Fly-by cuts inside, fly-over swings outside.</b> The turn starts r·tan(ΔTrack/2) early, and r grows with the square of ground speed.','<b>Fly-by kutter innenfor, fly-over svinger utenfor.</b> Svingen starter r·tan(Δtrack/2) før, og r vokser med kvadratet av farten over bakken.'),
 t2('<b>Minima:</b> LNAV to an MDA (CDFA), LNAV/VNAV to a DA within the baro-VNAV temperature limits, LPV to a DA with SBAS.','<b>Minima:</b> LNAV til en MDA (CDFA), LNAV/VNAV til en DA innenfor temperaturgrensene for baro-VNAV, LPV til en DA med SBAS.'),
 t2('<b>The procedure comes from the database,</b> current AIRAC and unmodified; check it against the chart.','<b>Prosedyren kommer fra databasen,</b> gyldig AIRAC og uendret; sjekk den mot kartet.'),
 t2('<b>Jamming takes GNSS and SBAS together.</b> Expect reversion to DME/DME or IRS, lose RNP 1 and RNP APCH, keep a conventional plan and report it.','<b>Jamming tar GNSS og SBAS samtidig.</b> Regn med overgang til DME/DME eller IRS, mist RNP 1 og RNP APCH, ha en konvensjonell plan og rapporter det.')];
function drawTake(){ el('take').innerHTML=TAKE.map(x=>`<li>${L(x)}</li>`).join('');
  el('maid').innerHTML=`<span class="k">${L(t2('Memory aid','Huskeregel'))}</span><b>${L(t2('“Four to fix, five to detect, six to exclude.”','«Fire for posisjon, fem for å oppdage, seks for å utelate.»'))}</b><p>${L(t2('Four ranges solve x, y, z and the clock. Every extra satellite is a cross-check: one spare lets RAIM see that something is wrong, two let it find which one and carry on (FDE), if the geometry is good enough.','Fire avstander løser x, y, z og klokken. Hver ekstra satellitt er en kryssjekk: én til overs lar RAIM se at noe er galt, to lar den finne hvilken og fortsette (FDE), hvis geometrien er god nok.'))}</p>`; }
LAB.quiz(el('qbox'),'gnss',()=>LAB.shuffle([
 {q:t2('Why does a GNSS receiver need four satellites for a 3D position, not three?','Hvorfor trenger en GNSS-mottaker fire satellitter for en 3D-posisjon, ikke tre?'),a:[t2('The receiver clock error is a fourth unknown','Feilen i mottakerens klokke er en fjerde ukjent'),t2('One satellite is always kept in reserve','Én satellitt holdes alltid i reserve'),t2('The fourth gives the magnetic variation','Den fjerde gir misvisningen')],c:0,e:t2('Three position coordinates plus the clock offset: four unknowns, four pseudoranges.','Tre posisjonskoordinater pluss klokkefeilen: fire ukjente, fire pseudoavstander.')},
 {q:t2('All satellites are low in the same part of the sky. The DOP will be…','Alle satellittene står lavt i samme del av himmelen. DOP blir …'),a:[t2('high: poor accuracy','høy: dårlig nøyaktighet'),t2('low: good accuracy','lav: god nøyaktighet'),t2('unchanged','uendret')],c:0,e:t2('The ranges cross at shallow angles, so each range error moves the fix a lot.','Avstandene krysser i spisse vinkler, så hver avstandsfeil flytter posisjonen mye.')},
 {q:t2('How many satellites does RAIM need to detect a faulty one, and to exclude it?','Hvor mange satellitter trenger RAIM for å oppdage en feil satellitt, og for å utelate den?'),a:[t2('5 to detect, 6 to exclude','5 for å oppdage, 6 for å utelate'),t2('4 to detect, 5 to exclude','4 for å oppdage, 5 for å utelate'),t2('6 to detect, 8 to exclude','6 for å oppdage, 8 for å utelate')],c:0,e:t2('One spare measurement to see a disagreement, two to find which one. Baro-aiding can replace one satellite.','Én ekstra måling for å se uenighet, to for å finne hvilken. Baro-aiding kan erstatte én satellitt.')},
 {q:t2('What separates RNP from RNAV?','Hva skiller RNP fra RNAV?'),a:[t2('On-board performance monitoring and alerting','Overvåking av ytelse og varsling om bord'),t2('RNP only uses VOR/DME','RNP bruker bare VOR/DME'),t2('RNAV is always more accurate','RNAV er alltid mer nøyaktig')],c:0,e:t2('RNP tells the crew when it cannot meet the required performance.','RNP sier fra til besetningen når den ikke klarer den påkrevde ytelsen.')},
 {q:t2('On an RNP 1 STAR, what does the 1 mean?','Hva betyr 1 på en RNP 1 STAR?'),a:[t2('Lateral total system error within ±1 NM for 95 % of the flight time','Total sidefeil innenfor ±1 NM i 95 % av flytiden'),t2('The CDI full scale is always 1 dot','CDI har alltid 1 prikk fullt utslag'),t2('One GNSS satellite may fail','Én GNSS-satellitt kan falle ut')],c:0,e:t2('The system must also alert before the error is likely to exceed 2 NM (2×RNP).','Systemet må også varsle før feilen sannsynligvis passerer 2 NM (2×RNP).')},
 {q:t2('Which minima need SBAS?','Hvilke minima krever SBAS?'),a:[t2('LPV (and LP)','LPV (og LP)'),t2('LNAV','LNAV'),t2('LNAV/VNAV with baro-VNAV','LNAV/VNAV med baro-VNAV')],c:0,e:t2('LPV uses SBAS corrections and integrity for ILS-like guidance down to 200 ft.','LPV bruker SBAS-korreksjoner og integritet for ILS-lignende ledning ned til 200 ft.')},
 {q:t2('It is −25 °C and the chart says baro-VNAV not below −15 °C. You…','Det er −25 °C og kartet sier baro-VNAV ikke under −15 °C. Du …'),a:[t2('use LNAV (or LPV) minima','bruker LNAV- (eller LPV-) minima'),t2('fly LNAV/VNAV but add 50 ft','flyr LNAV/VNAV, men legger til 50 ft'),t2('set a lower QNH','setter lavere QNH')],c:0,e:t2('In cold air the baro-VNAV path lies below the design path. LPV does not depend on the altimeter.','I kald luft ligger baro-VNAV-banen under den konstruerte banen. LPV avhenger ikke av høydemåleren.')},
 {q:t2('At a fly-by waypoint, what happens to the start of the turn if ground speed goes up?','Hva skjer med starten av svingen ved et fly-by-punkt hvis farten over bakken øker?'),a:[t2('It starts earlier: the radius grows with GS²','Den starter tidligere: radien vokser med GS²'),t2('It starts later','Den starter senere'),t2('It always starts overhead','Den starter alltid over punktet')],c:0,e:t2('Lead = r·tan(ΔTrack/2) and r = GS²/(g·tan bank).','Forvarsel = r·tan(Δtrack/2) og r = GS²/(g·tan krengning).')},
 {q:t2('Why does a fly-over waypoint need more airspace than a fly-by?','Hvorfor trenger et fly-over-punkt mer luftrom enn et fly-by?'),a:[t2('The turn starts overhead, so the aircraft overshoots the next leg and comes back','Svingen starter over punktet, så flyet skyter over neste etappe og kommer tilbake'),t2('It must be flown slower','Det må flys saktere'),t2('It is always followed by a hold','Det følges alltid av en holding')],c:0,e:t2('A fly-by turn starts early and cuts the corner; a fly-over cannot.','En fly-by-sving starter tidlig og kutter hjørnet; en fly-over kan ikke det.')},
 {q:t2('On final of an RNP APCH flown to LNAV minima, what is the GPS CDI full scale?','Hva er fullt utslag på GPS-CDI-en på finalen av en RNP APCH til LNAV-minima?'),a:[t2('0.3 NM','0,3 NM'),t2('1 NM','1 NM'),t2('2 NM','2 NM')],c:0,e:t2('It ramps from 1 NM to 0.3 NM over the 2 NM before the FAF; with LPV it is angular instead.','Den går fra 1 NM til 0,3 NM over de 2 NM før FAF; med LPV er den vinkelbasert.')},
 {q:t2('GNSS is jammed. Which still works?','GNSS jammes. Hva virker fortsatt?'),a:[t2('DME/DME and IRS navigation, and RNAV 5 and RNAV 1 if approved for DME/DME','DME/DME- og IRS-navigasjon, og RNAV 5 og RNAV 1 hvis godkjent for DME/DME'),t2('LPV, because EGNOS uses other satellites','LPV, fordi EGNOS bruker andre satellitter'),t2('RNP APCH to LNAV minima','RNP APCH til LNAV-minima')],c:0,e:t2('EGNOS rides on the same frequencies, so it is lost too; RNP 1 and RNP APCH need GNSS.','EGNOS bruker de samme frekvensene, så den forsvinner også; RNP 1 og RNP APCH krever GNSS.')},
 {q:t2('May you insert or move a waypoint in a published RNP approach in the FMS?','Kan du legge inn eller flytte et veipunkt i en publisert RNP-innflyging i FMS-en?'),a:[t2('No: the approach must come unmodified from a current database','Nei: innflygingen må komme uendret fra en gyldig database'),t2('Yes, if ATC agrees','Ja, hvis ATC godtar det'),t2('Yes, on the intermediate segment only','Ja, bare på intermediate-segmentet')],c:0,e:t2('The procedure is only protected as coded and checked. Check it against the chart, but do not edit it.','Prosedyren er bare beskyttet slik den er kodet og kontrollert. Sjekk den mot kartet, men ikke rediger den.')}
]),10);

/* ---------- start ---------- */
LAB.tx({
 lead:'GNSS forteller deg hvor du er; RAIM og SBAS forteller om du kan stole på det; RNAV og RNP bestemmer hvor nøyaktig du må fly. Flytt satellittene, og fly så en RNAV-rute og en RNP-innflyging til Bergen og se HSI-en, inneslutningen og minima svare.',
 u0:'To spørsmål går gjennom hele emnet: <b>hvor nøyaktig</b> er posisjonen min, og <b>hvordan vet jeg</b> at den er riktig? Hvert kort viser ideen i labben.',
 e1:'I himmelplottet: <b>dra satellittene</b> og se nøyaktighet og integritet endre seg. På kartet: en RNAV-rute og en RNP-innflyging til rullebane 17 i Bergen: velg en fase eller trykk Fly, <b>dra sidelengs på kartet</b> for å komme ut av tracken, og les HSI-en.',
 raimdd:'<p>Med fem eller flere satellitter har mottakeren flere målinger enn ukjente. Den løser posisjonen med minste kvadraters metode og ser på det som blir til overs (residualene). En stor residual betyr at én avstand ikke stemmer med de andre.</p><p>Bare ut fra geometrien, før noen feil, regner den ut den største posisjonsfeilen en feil kunne gitt uten å bli oppdaget: det <b>horisontale beskyttelsesnivået (HPL)</b>. Er HPL større enn <b>alarmgrensen</b> for fasen (2 NM underveis, 1 NM terminal, 0,3 NM innflyging), er RAIM <b>ikke tilgjengelig</b>, og mottakeren sier fra. Med seks eller flere kan den teste hvert utvalg uten én satellitt og slik <b>utelate</b> den feile (FDE).</p><p>Geometrien teller altså to ganger: høy DOP gjør posisjonen mindre nøyaktig, og svak geometri gjør en feil vanskeligere å se.</p>',
 foot:'<b>Modell og begrensninger.</b> Opplæringssimulering, ikke for navigasjon; ruten, veipunktene og minima er illustrative, ikke en publisert prosedyre. DOP fra minste kvadraters metode på satellittene du plasserer (like vekter). Nøyaktighet: 95 % horisontalt = 2 × HDOP × σ, vertikalt = 1,96 × VDOP × σ, med σ = 4 m for GPS alene og 1 m med SBAS-korreksjoner. RAIM: øyeblikksbilde med helninger fra minste kvadrater, σ = 33,3 m, falsk alarm 1/15 000 og tapt deteksjon 0,001 (de konservative verdiene i den opprinnelige RTCA-standarden for tilgjengelighet); FDE når hvert utvalg uten én satellitt fortsatt oppfyller alarmgrensen; ingen baro-aiding. SBAS: HPL = 6,0 × σ × d<sub>major</sub>, VPL = 5,33 × σ × VDOP med σ = 2,5 m; LPV krever HPL ≤ 40 m og VPL ≤ 50 m. Svinger i stille luft: r = GS² / (g · tan krengning); fly-by starter r · tan(Δtrack / 2) før; fly-over svinger over punktet og går tilbake med opptil 30° avskjæringsvinkel. CDI fullt utslag 2 NM underveis (lenger ut enn 30 NM), 1 NM terminal, ned til 0,3 NM over de 2 NM før FAF; LPV vinkelbasert, 105 m ved terskelen og høyst 0,3 NM. Vertikalt avvik ±0,7° fullt utslag for både baro-VNAV og LPV (ekte baro-VNAV-visning er ofte lineær). DME/DME-reserve bruker Flesland, Vollo og Stord med σ = 0,1 NM. Ingen vind, ingen misvisning; kystlinje og relieff som i radionavigasjonssimulatoren (Mapzen/AWS Terrain Tiles).'});
LAB.add({},{'GNSS and RNAV':'GNSS og RNAV','Birdbird Virtual Lab · Navigation and instrument procedures':'Birdbird Virtual Lab · Navigasjon og instrumentprosedyrer','1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Test yourself':'3 · Test deg selv',
  'Key concepts':'Nøkkelbegreper','The GNSS and RNP lab':'GNSS- og RNP-labben','Key points':'Det viktigste','Test yourself':'Test deg selv','GNSS and RNP lab':'GNSS- og RNP-labben','Try it':'Prøv selv'});
heads(); togs(); tables(); drawTake(); drawTask(); update(); camSnap=true;
LAB.start('gnss');
LAB.onLang(()=>{ heads(); togs(); tables(); drawTake(); drawTask(); update(); });
document.addEventListener('labdepth',()=>{ togs(); update(); });
})();
