/* Birdbird – zoom gestures shared by the 2D cockpit trainers (C172, DA42, King Air B200) and their 3D pages.
   The panels zoom between named areas (REG); this file adds the gestures on top of each page's own zoomTo():
   - single click / tap on the panel (not on a control): whole-panel view → zoom to the area under the pointer;
     zoomed → a click outside the zoomed area goes back to the whole panel (pages with their own click logic pass click:false)
   - double-click / double-tap: toggle between the area and the whole panel (ignored right after a single-click zoom)
   - two-finger pinch on a touch screen: spread → zoom to the area between the fingers, pinch → whole panel
   - trackpad pinch: Ctrl+wheel (Chrome, Edge, Firefox; also Ctrl/⌘ + mouse wheel) and gesture events (Safari)
   - the magnifier glyphs keep a usable size on screen whatever the panel scale
   Performance: no blocking wheel listener sits on the stage in normal use (Chrome rebuilds a wheel region for every painted part
   below one on each repaint). A passive listener spots the first Ctrl+wheel / pinch, then the blocking one is attached until the
   pointer leaves the stage; it is also attached while Ctrl or ⌘ is held. Pointer and gesture listeners are cheap. */
(function(G){
'use strict';
const CSS=`.psvg .mags .mag{transform-box:fill-box;transform-origin:center;transform:scale(var(--mk,1))}`;
function attach(o){ // o:{stage, Z, zoomTo, regionAt, toWorld, inR?, regs:()=>REG, emptyAt, off:selector, d3:()=>D3|null, click:bool, mags:Element|null}
  if(!document.getElementById('pzcss')){ const s=document.createElement('style'); s.id='pzcss'; s.textContent=CSS; document.head.appendChild(s); }
  const st=o.stage, Z=o.Z, now=()=>performance.now();
  const OFF=o.off||'.zback,.more,.pill,.tip,.touch,.rot,.d3t,.d3v,.otwmsg,.afban,.afnow,button,select,a,input';
  const inR=(p,r)=>!!r&&p.x>=r[0]&&p.x<=r[0]+r[2]&&p.y>=r[1]&&p.y<=r[1]+r[3];
  const d3=()=>o.d3?o.d3():null;
  const api={clickT:-1e9,gestT:-1e9,togT:-1e9};
  const blocked=()=>Z.lock||now()-api.gestT<450;
  /* zoom in at a screen point: whole panel → the area there; zoomed → nothing (already close) */
  function zin(x,y){ if(Z.lock) return; const D=d3(); const p=o.toWorld({clientX:x,clientY:y}); const k=o.regionAt(p);
    if(D&&D.on){ if(k&&k!==Z.reg) o.zoomTo(k); return; }
    if(Z.reg==='overview'&&k) o.zoomTo(k); }
  function zout(){ if(Z.lock) return; if(Z.reg!=='overview') o.zoomTo('overview'); }
  /* ---- single click / tap ---- */
  let pdn=null;
  if(o.click!==false){
    st.addEventListener('pointerdown',e=>{ pdn={x:e.clientX,y:e.clientY,t:now(),ok:o.emptyAt(e)&&!e.target.closest(OFF)}; },true);
    st.addEventListener('click',e=>{ const d=pdn; pdn=null;
      if(!d||!d.ok||e.button>0||Math.hypot(e.clientX-d.x,e.clientY-d.y)>8||now()-d.t>700||blocked()||now()-api.togT<400) return; // (the click of a double-tap's 2nd tap)
      if(!o.emptyAt(e)||e.target.closest(OFF)) return; const D=d3(); if(D&&D.on&&D.dragging) return;
      const p=o.toWorld(e), cur=Z.reg, R=o.regs(); let to=null;
      if(cur==='overview') to=o.regionAt(p);
      else if(!R[cur]||!inR(p,R[cur])) to=D&&D.on?(o.regionAt(p)||'overview'):'overview';
      if(to&&to!==cur){ api.clickT=now(); o.zoomTo(to); } });
  }
  /* ---- double-click / double-tap: toggle ---- */
  if(o.dbl!==false){
    // a double-tap also fires click and dblclick: toggle once (api.togT also stops the single-click zoom)
    const tog=(e)=>{ if(blocked()||now()-api.clickT<600||now()-api.togT<500) return; api.togT=now(); const k=o.regionAt(o.toWorld(e)); const D=d3();
      if(D&&D.on){ o.zoomTo(k&&k!==Z.reg?k:'overview'); } else if(Z.reg!=='overview') o.zoomTo('overview'); else if(k) o.zoomTo(k); };
    st.addEventListener('dblclick',e=>{ if(!o.emptyAt(e)||e.target.closest(OFF)) return; tog(e); });
    let lt={t:0,x:0,y:0};
    st.addEventListener('pointerup',e=>{ if(e.pointerType!=='touch'||!o.emptyAt(e)||e.target.closest(OFF)) return; const n=now();
      if(n-lt.t<320&&Math.hypot(e.clientX-lt.x,e.clientY-lt.y)<24){ lt.t=0; tog(e); } else lt={t:n,x:e.clientX,y:e.clientY}; });
  }
  /* ---- two-finger pinch (touch, pen) ---- */
  const pts=new Map(); let pin=null;
  const dist=()=>{ const a=[...pts.values()]; return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); };
  st.addEventListener('pointerdown',e=>{ if(e.pointerType==='mouse') return; const D=d3(); if(D&&D.on) return; // the 3D view has its own pinch
    if(e.target.closest('.tz,.touch,.afnow,.efx')) return; // touch stick / rudder zones: flying, not zooming
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY,ok:o.emptyAt(e)&&!e.target.closest(OFF)});
    // a pinch needs at least one finger on bare panel (two fingers both on controls: the user is working them)
    if(pts.size===2&&[...pts.values()].some(q=>q.ok)){ pin={d0:Math.max(20,dist()),done:false}; api.gestT=now(); } },true);
  st.addEventListener('pointermove',e=>{ const p=pts.get(e.pointerId); if(!p) return; p.x=e.clientX; p.y=e.clientY;
    if(!pin||pin.done||pts.size<2) return; const r=dist()/pin.d0; api.gestT=now();
    if(r>1.25||r<0.8){ pin.done=true; const a=[...pts.values()]; if(r>1) zin((a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2); else zout(); } },{passive:true});
  const up=e=>{ if(!pts.delete(e.pointerId)) return; if(pin) api.gestT=now(); if(pts.size<2) pin=null; };
  st.addEventListener('pointerup',up,{passive:true}); st.addEventListener('pointercancel',up,{passive:true});
  /* ---- trackpad pinch and Ctrl/⌘ + wheel ---- */
  let acc=0, accT=0, coolT=0, armed=false;
  const wact=e=>{ const n=now(); if(n-accT>260) acc=0; accT=n; acc+=(e.deltaMode?e.deltaY*33:e.deltaY); api.gestT=n;
    if(n<coolT) { acc=0; return; }
    if(acc<-24){ acc=0; coolT=n+420; zin(e.clientX,e.clientY); } else if(acc>24){ acc=0; coolT=n+420; zout(); } };
  const blk=e=>{ if(!(e.ctrlKey||e.metaKey)) return; e.preventDefault(); wact(e); };
  const arm=v=>{ if(v===armed) return; armed=v; if(v) st.addEventListener('wheel',blk,{passive:false}); else st.removeEventListener('wheel',blk,{passive:false}); };
  st.addEventListener('wheel',e=>{ if(armed||!(e.ctrlKey||e.metaKey)) return; const D=d3(); if(D&&D.on) return; arm(true); wact(e); },{passive:true});
  st.addEventListener('pointerleave',()=>{ if(!keyHeld) arm(false); },{passive:true});
  let keyHeld=false;
  G.addEventListener('keydown',e=>{ if(e.key==='Control'||e.key==='Meta'){ keyHeld=true; const D=d3(); if(!(D&&D.on)) arm(true); } },true);
  G.addEventListener('keyup',e=>{ if(e.key==='Control'||e.key==='Meta'){ keyHeld=false; arm(false); } },true);
  G.addEventListener('blur',()=>{ keyHeld=false; arm(false); });
  // Safari: trackpad pinch arrives as gesture events (and would zoom the whole page)
  let gs=1, gdone=false;
  st.addEventListener('gesturestart',e=>{ e.preventDefault(); gs=1; gdone=false; api.gestT=now(); },{passive:false});
  st.addEventListener('gesturechange',e=>{ e.preventDefault(); api.gestT=now(); if(gdone) return; gs=e.scale||1;
    if(gs>1.2){ gdone=true; zin(e.clientX||lastX,e.clientY||lastY); } else if(gs<0.83){ gdone=true; zout(); } },{passive:false});
  st.addEventListener('gestureend',e=>{ e.preventDefault(); api.gestT=now(); },{passive:false});
  let lastX=0, lastY=0; st.addEventListener('pointermove',e=>{ if(e.pointerType==='mouse'){ lastX=e.clientX; lastY=e.clientY; } },{passive:true});
  /* ---- magnifier glyphs: at least ~18 px across on screen (24 px on touch screens) ---- */
  const coarse=G.matchMedia?G.matchMedia('(pointer:coarse)'):{matches:false};
  api.sync=function(){ if(!o.mags) return; const k=Math.max(1,Math.min(4.5,(coarse.matches?12:9)/(11*(Z.s||1)))); const v=k.toFixed(2); if(api._mk!==v){ api._mk=v; o.mags.style.setProperty('--mk',v); } };
  return api;
}
/* whole-panel view, the same rule for every type: the glareshield lip sits at a fixed share of the
   stage height (34 %, phones 28 %), and the panel is as large as fits from the lip down to the last essential control row
   (power levers / throttle quadrant); below that (yoke columns, floor, lower pedestal) may run off the bottom and is reached
   by zooming. Never wider than the stage, never a gap under the panel. */
function fit(o){ // o:{w,h,x0,width,H,lip,need,sky,otw}; outside view off: only a strip of windshield (the compass) above the lip
  const L=o.otw===false?0.2:o.h<520?0.28:0.34; let s=Math.min(o.w/o.width,o.h*(1-L)/(o.need-o.lip));
  const tx=o.w/2-(o.x0+o.width/2)*s; let ty=Math.min(L*o.h-o.lip*s,o.sky*s); ty=Math.max(ty,o.h-o.H*s);
  return {s,tx,ty}; }
G.PANELZOOM={attach,fit};
})(window);
