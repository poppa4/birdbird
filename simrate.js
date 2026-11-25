/* NORDAP – time speed for the cockpit trainers (simrate.js).
   The toolbar's 1× button (key T) cycles 1× → 2× → 4× → 8×: the page runs that many simulation steps per frame (the same
   physics, only more of it), so a long ILS or a cross-country leg passes quicker. It works in the air above 500 ft and drops
   back to 1× below 500 ft and on the ground, where the take-off and the landing need real time.
   SIMRATE.attach({ground:()=>bool, agl:()=>ft, say:text=>void, L}) returns k(): the number of steps for this frame. */
(function(G){
'use strict';
const RATES=[1,2,4,8];
function attach(o){
  const btn=document.getElementById('bRate'), L=o.L||(t=>typeof t==='string'?t:t.en); let r=1;
  const sync=()=>{ if(btn){ btn.textContent=r+'×'; btn.classList.toggle('on',r>1); btn.setAttribute('aria-pressed',r>1); } };
  const low=()=>o.ground()||!(o.agl()>=500);
  const step=()=>{ if(low()){ o.say(L({en:'Time speed works in the air, above 500 ft',no:'Tidsfart virker i lufta, over 500 ft'})); return; } r=RATES[(RATES.indexOf(r)+1)%RATES.length]; sync(); };
  if(btn) btn.onclick=step;
  addEventListener('keydown',e=>{ if(e.metaKey||e.ctrlKey||e.altKey||e.repeat) return; if(e.target.closest&&e.target.closest('input,select,textarea')) return; if(e.key==='t'||e.key==='T') step(); });
  sync();
  return ()=>{ if(r>1&&low()){ r=1; sync(); o.say(L({en:'Time speed back to 1× (below 500 ft)',no:'Tidsfart tilbake til 1× (under 500 ft)'})); } return r; };
}
G.SIMRATE={attach};
})(window);
