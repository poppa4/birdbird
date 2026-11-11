/* Birdbird – panel layers. A sim panel is one large SVG; Chrome repaints (re-records) the whole SVG when any needle in it moves,
   because only an <svg> root gets its own paint layer. This splits the drawing into sibling <svg> layers stacked in the panel's
   own order, all with the same viewBox, so a moving needle repaints only its own small layer and the static artwork (bezels,
   placards, ~2,000 labels) is painted once:
     main  (P.svg)  static artwork + <defs> + the controls' touch zones (g.ctls > g.hits)   – painted once
     dyn × n        one per moving unit (gauge, display, annunciator panel), no pointer events
     ctl × n        the controls, in their original order (focus order and stacking unchanged): runs of up to 40 controls,
                    and continuously driven controls (levers, trim wheels, yokes) on their own
     top            magnifier buttons and the area highlight (P.top)
   Lifted units keep their ancestors' transforms, classes and clip paths (shallow copies of the ancestor groups), so they look
   exactly as before. P.svg.querySelector/All search every layer (and the 3D sub-planes, which live inside the same .world). */
(function(G){
'use strict';
const NS='http://www.w3.org/2000/svg';
let cssDone=false;
function css(){ if(cssDone) return; cssDone=true; const s=document.createElement('style'); s.textContent=
  '.psvg.pdyn,.psvg.pdyn *{pointer-events:none!important}.psvg.pctl,.psvg.ptop{pointer-events:none}.psvg.pctl>*,.psvg.ptop>*{pointer-events:visiblePainted}';
  document.head.appendChild(s); }
function layerSvg(main,cls){ const s=document.createElementNS(NS,'svg'); s.setAttribute('class',(main.getAttribute('class')||'psvg')+' '+cls); s.setAttribute('viewBox',main.getAttribute('viewBox')); if(cls==='pdyn') s.setAttribute('aria-hidden','true'); return s; }
// copy of the ancestor chain of n up to (not including) stop, without ids; returns [outer, inner]
function chain(n,stop){ const anc=[]; for(let p=n.parentNode;p&&p!==stop;p=p.parentNode) anc.unshift(p); let outer=null, inner=null;
  anc.forEach(a=>{ const c=a.cloneNode(false); c.removeAttribute('id'); if(inner) inner.appendChild(c); else outer=c; inner=c; }); return [outer,inner]; }
/* opts.dyn: selector of the moving units in the artwork; opts.hot(c): control driven continuously */
function lift(P,opts){
  if(!P||!P.svg||P.layered||!(G.SVGElement)) return P; css(); opts=opts||{};
  const svg=P.svg, world=P.world, host=svg.querySelector('g.ctls'); if(!host) return P;
  const qs=Element.prototype.querySelector, qsa=Element.prototype.querySelectorAll;
  const after=[]; // layers in order, inserted right after the main svg (before any HTML displays in the panel)
  // moving units: outermost matches outside the controls
  const all=opts.dyn?[...qsa.call(svg,opts.dyn)].filter(u=>!host.contains(u)&&!u.closest('defs,.mags')):[];
  const set=new Set(all); const units=all.filter(u=>{ for(let p=u.parentNode;p&&p!==svg;p=p.parentNode) if(set.has(p)) return false; return true; });
  const dyn=[];
  units.forEach(u=>{ const d=layerSvg(svg,'pdyn'); const [o,i]=chain(u,svg); u.parentNode.insertBefore(document.createComment('↑ '+(u.getAttribute('class')||u.tagName)),u);
    if(o){ i.appendChild(u); d.appendChild(o); } else d.appendChild(u); d._unit=u; dyn.push(d); after.push(d); });
  // controls: chunks in document order
  const hot=opts.hot||(()=>false), ctls=[...host.children].filter(n=>n.matches&&n.matches('g.ctl')), chunks=[]; let cur=null, n=0;
  const newChunk=()=>{ const s=layerSvg(svg,'pctl'); const g=document.createElementNS(NS,'g'); g.setAttribute('class','ctls ctlc'); s.appendChild(g); s._g=g; chunks.push(s); after.push(s); return s; };
  ctls.forEach(g=>{ const o=P.byId[g.dataset.id], h=o&&hot(o.c);
    if(h){ newChunk()._g.appendChild(g); cur=null; return; }
    if(!cur||n>=40){ cur=newChunk(); n=0; } cur._g.appendChild(g); n++; });
  // top: magnifier buttons, area highlight
  const top=layerSvg(svg,'ptop'); const mags=qs.call(svg,'g.mags'); if(mags) top.appendChild(mags); after.push(top);
  let ref=svg; after.forEach(l=>{ ref.parentNode.insertBefore(l,ref.nextSibling); ref=l; });
  svg.querySelector=s=>qs.call(svg,s)||world.querySelector(s);
  svg.querySelectorAll=s=>world.querySelectorAll(s);
  Object.assign(P,{layered:true,top,dynLayers:dyn,ctlLayers:chunks});
  svg._pl={dyn,chunks,top}; // read by cockpit3d.js when it lifts parts of the panel onto 3D sub-planes
  return P;
}
G.PANEL_LAYERS={lift};
})(window);
