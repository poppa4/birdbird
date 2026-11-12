/* Birdbird – zoom gestures shared by the 2D cockpit trainers (C172, DA42, King Air B200) and their 3D pages.
   The panels zoom between named areas (REG); this file adds the gestures on top of each page's own zoomTo():
   - single click / tap on the panel (not on a control): whole-panel view → zoom to the area under the pointer;
     zoomed → a click outside the zoomed area goes back to the whole panel (pages with their own click logic pass click:false)
   - two-finger pinch (touch, and Safari's gesture events on iPad / Mac trackpad): the panel follows the fingers (scale and pan)
     and stays where it is left; pinching out all the way lands on the whole panel. Any two fingers count.
   - mouse wheel / trackpad: zooms about the pointer; drag on bare panel pans a zoomed panel (as in the 3D cockpits)
   - zoomed: two quick taps on bare panel go back to the whole panel (as do the page's ← Back button and Esc)
   Limits: whole panel (1×) … about 4×. No magnifiers, no zoom slider, no other zoom mode.
   Performance: the blocking wheel listener is attached only while a mouse is over the stage (Chrome rebuilds a wheel region for
   every painted part below one on each repaint), never on touch devices. Pointer and gesture listeners are cheap; nothing runs
   per frame except the short glide after a pan. */
(function(G){
'use strict';
function attach(o){ // o:{stage, Z, zoomTo, regionAt, toWorld, regs:()=>REG, emptyAt, off:selector, d3:()=>D3|null, click:bool,
  //    world:Element, size:()=>[W,H] (panel units), onFree:()=>void (after a free zoom settles)}
  const st=o.stage, Z=o.Z, now=()=>performance.now();
  const OFF=o.off||'.zback,.more,.pill,.tip,.touch,.rot,.d3t,.d3v,.otwmsg,.afban,.afnow,button,select,a,input';
  const inR=(p,r)=>!!r&&p.x>=r[0]&&p.x<=r[0]+r[2]&&p.y>=r[1]&&p.y<=r[1]+r[3];
  const d3=()=>o.d3?o.d3():null;
  const api={clickT:-1e9,gestT:-1e9};
  /* two quick taps on a zoomed panel: back to the whole panel. Returns true when it handled the tap (pages with their own click
     logic call api.tap(e) first). */
  let lastTap=null;
  api.tap=e=>{ const t=now(), l=lastTap; lastTap={t,x:e.clientX,y:e.clientY};
    if(Z.reg==='overview'||!l||t-l.t>380||t-api.clickT<450||Math.hypot(e.clientX-l.x,e.clientY-l.y)>40) return false;
    lastTap=null; api.clickT=t; o.zoomTo('overview'); return true; };
  const blocked=()=>Z.lock||now()-api.gestT<450;
  /* zoom in at a screen point: whole panel → the area there; zoomed → nothing (already close) */
  function zin(x,y){ if(Z.lock) return false; const D=d3(); const p=o.toWorld({clientX:x,clientY:y}); const k=o.regionAt(p);
    if(D&&D.on){ if(k&&k!==Z.reg){ o.zoomTo(k); return true; } return false; }
    if(Z.reg==='overview'&&k){ o.zoomTo(k); return true; } return false; }
  function zout(){ if(Z.lock) return false; if(Z.reg!=='overview'){ o.zoomTo('overview'); return true; } return false; }
  /* ---- single click / tap ---- */
  let pdn=null;
  if(o.click!==false){
    st.addEventListener('pointerdown',e=>{ pdn={x:e.clientX,y:e.clientY,t:now(),ok:o.emptyAt(e)&&!e.target.closest(OFF)}; },true);
    st.addEventListener('click',e=>{ const d=pdn; pdn=null;
      if(!d||!d.ok||e.button>0||Math.hypot(e.clientX-d.x,e.clientY-d.y)>8||now()-d.t>700||blocked()) return;
      if(!o.emptyAt(e)||e.target.closest(OFF)) return; const D=d3(); if(D&&D.on&&D.dragging) return;
      if(api.tap(e)) return;
      const p=o.toWorld(e), cur=Z.reg, R=o.regs(); let to=null;
      if(cur==='overview') to=o.regionAt(p);
      else if(!R[cur]||!inR(p,R[cur])) to=D&&D.on?(o.regionAt(p)||'overview'):'overview';
      if(to&&to!==cur){ api.clickT=now(); o.zoomTo(to); } });
  }
  /* ---- free zoom and pan, the same feel as the 3D cockpits (cockpit3d.js): pinch, wheel and drag move the panel continuously and
     it stays where you leave it; pinching / scrolling all the way out lands on the whole-panel view. Limits: whole panel … about
     4× (the area zoom's limit). One transform write per input event, no transition while a finger or the wheel drives it. ---- */
  const W=o.world||null, SZ=o.size||null; let ov=null;
  api.sync=function(){ if(Z.reg==='overview') ov={s:Z.s,tx:Z.tx,ty:Z.ty}; };
  const canFree=()=>!!(W&&SZ&&ov&&!Z.lock&&!(d3()&&d3().on));
  const smax=()=>Math.max(ov.s*1.5,Math.min(ov.s*4.2,4.5));
  const clp=(v,lo,hi)=>lo>hi?(lo+hi)/2:Math.max(lo,Math.min(hi,v));
  let freeOn=false, commitT=0;
  function put(sc,tx,ty){ const [pw,ph]=SZ(), w=st.clientWidth, h=st.clientHeight; sc=Math.max(ov.s,Math.min(smax(),sc));
    tx=clp(tx,Math.min(w-pw*sc,ov.tx),Math.max(0,ov.tx)); ty=clp(ty,Math.min(h-ph*sc,ov.ty),Math.max(0,ov.ty));
    Z.s=sc; Z.tx=tx; Z.ty=ty; if(!freeOn){ freeOn=true; W.classList.add('nt'); dim(st,Z,null); }
    W.style.transform=`translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${sc.toFixed(4)})`; }
  /* scale by k about a stage point (client coords) */
  function zoomAt(k,x,y){ const b=st.getBoundingClientRect(), mx=x-b.left, my=y-b.top; const sc=Math.max(ov.s,Math.min(smax(),Z.s*k)), f=sc/Z.s;
    put(sc,mx-(mx-Z.tx)*f,my-(my-Z.ty)*f); }
  /* settle after a gesture: close to the whole panel → the whole-panel view; otherwise this is a zoomed view of the area at the centre */
  function commit(){ clearTimeout(commitT); if(!freeOn) return; freeOn=false; W.classList.remove('nt');
    if(Z.s<=ov.s*1.04){ o.zoomTo('overview',false,true); return; }
    const b=st.getBoundingClientRect(); const k=o.regionAt(o.toWorld({clientX:b.left+b.width/2,clientY:b.top+b.height/2}));
    if(Z.reg==='overview'||!Z.reg) Z.reg=k||Object.keys(o.regs()).find(x=>x!=='overview')||'overview';
    st.classList.add('zoomed'); if(o.onFree) o.onFree(); }
  /* ---- two-finger pinch (touch, pen): any two fingers, also on controls ---- */
  const pts=new Map(); let pin=null;
  const dist=()=>{ const a=[...pts.values()]; return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); };
  const mid=()=>{ const a=[...pts.values()]; return [(a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2]; };
  st.addEventListener('pointerdown',e=>{ if(e.pointerType==='mouse') return; const D=d3(); if(D&&D.on) return; // the 3D view has its own pinch
    if(e.target.closest('.more,.efx,.pill,.drawer')) return;
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===2){ pan=null; const m=mid(); pin={d:Math.max(20,dist()),m,r0:1,done:false}; api.gestT=now(); } },true);
  st.addEventListener('pointermove',e=>{ const p=pts.get(e.pointerId); if(!p) return; p.x=e.clientX; p.y=e.clientY;
    if(!pin||pts.size<2) return; api.gestT=now(); const d=Math.max(20,dist()), m=mid();
    if(canFree()){ zoomAt(d/pin.d,m[0],m[1]); if(freeOn){ Z.tx+=m[0]-pin.m[0]; Z.ty+=m[1]-pin.m[1]; put(Z.s,Z.tx,Z.ty); } pin.d=d; pin.m=m; }
    else if(!pin.done){ const r=d/pin.d; if(r>1.25||r<0.8){ pin.done=true; if(r>1) zin(m[0],m[1]); else zout(); } } },{passive:true});
  const up=e=>{ if(!pts.delete(e.pointerId)) return; if(pin) api.gestT=now(); if(pts.size<2&&pin){ pin=null; commit(); } };
  st.addEventListener('pointerup',up,{passive:true}); st.addEventListener('pointercancel',up,{passive:true});
  /* ---- one-finger / mouse drag on bare panel pans a zoomed panel (the 3D look-around), with a little glide after release ---- */
  let pan=null, glide=0;
  st.addEventListener('pointerdown',e=>{ if(e.button>0||pts.size>1||!canFree()||Z.reg==='overview') return;
    if(!o.emptyAt(e)||e.target.closest(OFF)) return; if(G.SIMSHELL&&G.SIMSHELL.touchOwns&&G.SIMSHELL.touchOwns(e)) return;
    cancelAnimationFrame(glide); pan={id:e.pointerId,x:e.clientX,y:e.clientY,t:now(),vx:0,vy:0,moved:0}; },true);
  st.addEventListener('pointermove',e=>{ if(!pan||e.pointerId!==pan.id||pin) return; const dx=e.clientX-pan.x, dy=e.clientY-pan.y; pan.moved+=Math.abs(dx)+Math.abs(dy);
    if(pan.moved<8) return; const n=now(), dt=Math.max(8,n-pan.t); pan.vx=pan.vx*0.6+dx/dt*0.4; pan.vy=pan.vy*0.6+dy/dt*0.4; pan.x=e.clientX; pan.y=e.clientY; pan.t=n;
    put(Z.s,Z.tx+dx,Z.ty+dy); api.gestT=n; },{passive:true});
  const panUp=e=>{ if(!pan||e.pointerId!==pan.id) return; const P=pan; pan=null; if(P.moved<8||!freeOn) return;
    let vx=now()-P.t>120?0:P.vx*16, vy=now()-P.t>120?0:P.vy*16;
    const step=()=>{ if(Math.abs(vx)+Math.abs(vy)<0.4){ commit(); return; } put(Z.s,Z.tx+vx,Z.ty+vy); vx*=0.88; vy*=0.88; glide=requestAnimationFrame(step); };
    glide=requestAnimationFrame(step); };
  st.addEventListener('pointerup',panUp,{passive:true}); st.addEventListener('pointercancel',panUp,{passive:true});
  /* ---- wheel: zooms about the pointer like the 3D cockpit (Ctrl / trackpad pinch faster). The blocking listener is attached
     only while a mouse is over the stage (Chrome keeps a wheel region for every repaint below a blocking listener). ---- */
  let armed=false;
  const wheel=e=>{ const D=d3(); if(D&&D.on) return; if(Z.lock||e.defaultPrevented) return; // a knob or display under the pointer took it
    if(!o.emptyAt(e)||e.target.closest('.more,.drawer,.pill,.efx')) return; e.preventDefault(); api.gestT=now();
    const d=(e.deltaMode?e.deltaY*40:e.deltaY)*(e.ctrlKey?3:1);
    if(canFree()){ zoomAt(Math.exp(-d*0.0012),e.clientX,e.clientY); clearTimeout(commitT); commitT=setTimeout(commit,180); }
    else if(Math.abs(d)>20){ if(d<0) zin(e.clientX,e.clientY); else zout(); } };
  const arm=v=>{ if(v===armed) return; armed=v; if(v) st.addEventListener('wheel',wheel,{passive:false}); else st.removeEventListener('wheel',wheel,{passive:false}); };
  st.addEventListener('pointerenter',e=>{ if(e.pointerType==='mouse') arm(true); },{passive:true});
  st.addEventListener('pointerleave',e=>{ if(e.pointerType==='mouse') arm(false); },{passive:true});
  // Safari: a pinch also arrives as gesture events (iPad touch and Mac trackpad); never let it zoom the whole page. On iPad the
  // pointer pinch above already drives the panel; a Mac trackpad has only these, so they drive the same free zoom.
  let gs=1, gown=false, lastX=0, lastY=0;
  st.addEventListener('pointermove',e=>{ if(e.pointerType==='mouse'){ lastX=e.clientX; lastY=e.clientY; } },{passive:true});
  const gx=e=>e.clientX||lastX, gy=e=>e.clientY||lastY;
  st.addEventListener('gesturestart',e=>{ e.preventDefault(); gs=1; api.gestT=now(); const D=d3(); gown=!pin&&pts.size<2&&!(D&&D.on); },{passive:false});
  st.addEventListener('gesturechange',e=>{ e.preventDefault(); api.gestT=now(); if(!gown) return; const sc=e.scale||1;
    if(canFree()){ zoomAt(sc/gs,gx(e),gy(e)); gs=sc; } else if(Math.abs(Math.log(sc))>0.2){ gown=false; if(sc>1) zin(gx(e),gy(e)); else zout(); } },{passive:false});
  st.addEventListener('gestureend',e=>{ e.preventDefault(); api.gestT=now(); if(gown) commit(); gown=false; },{passive:false});
  return api;
}
/* the dimmed surround of a zoomed area: one element whose wide shadow darkens everything outside the area (set once per zoom) */
function dim(stage,Z,r){ let d=stage.querySelector(':scope>.zdim'); if(!d){ d=document.createElement('div'); d.className='zdim'; d.setAttribute('aria-hidden','true'); stage.appendChild(d); }
  if(!r){ d.classList.remove('on'); return; }
  d.style.left=(Z.tx+r[0]*Z.s).toFixed(1)+'px'; d.style.top=(Z.ty+r[1]*Z.s).toFixed(1)+'px'; d.style.width=(r[2]*Z.s).toFixed(1)+'px'; d.style.height=(r[3]*Z.s).toFixed(1)+'px';
  d.classList.add('on'); }
G.PANELZOOM={attach,dim};
})(window);
