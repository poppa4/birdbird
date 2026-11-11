/* Birdbird – shared keyboard and mouse flying for all six simulator pages (2D and 3D).
   W / S (or ↑ / ↓): nose down / nose up, like pushing and pulling a control wheel.
   A / D (or ← / →): roll left / right. Q / E rudder (pages keep their own rudder logic).
   Home / End (or [ / ]): elevator trim nose down / nose up. , / . : rudder trim left / right (the twins; the pages apply it).
   Holding a key moves the control gradually (about half travel in 0.6 s, full in 1.5 s); a short tap is a small
   correction; letting go returns the control smoothly to centre. In the flight model the elevator works on top of
   the trim, so "centre" is the trimmed position. Shift moves the controls twice as fast and allows full travel.
   The ramp model and the drag shaping are pure functions (tested in tests/flightkeys.test.mjs). */
(function(G){
'use strict';
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const RAMP={t50:0.6, tFull:1.5, tauRet:0.16, minRet:0.5, rev:3};

/* one axis, one frame. v: current deflection −1…1, dir: −1, 0 or 1 (key held), dt in s, fast: rate multiplier. */
function step(v,dir,dt,fast){
  const R=RAMP; fast=fast||1; if(!(dt>0)) return v;
  if(!dir){ // let go: exponential return with a small linear tail so it really reaches centre
    const a=Math.abs(v); if(a<1e-4) return 0;
    const n=Math.max(0,Math.min(a*Math.exp(-dt/R.tauRet),a-R.minRet*dt));
    return Math.sign(v)*n; }
  let t=dt;
  if(v*dir<0){ // pushing the other way: unwind quickly through centre first
    const need=Math.abs(v)/(R.rev*fast); if(need>=t) return v+dir*R.rev*fast*t; t-=need; v=0; }
  let a=Math.abs(v); const r1=0.5/R.t50*fast, r2=0.5/(R.tFull-R.t50)*fast;
  if(a<0.5){ const d=Math.min(0.5-a,r1*t); a+=d; t-=d/r1; }
  if(t>0) a=Math.min(1,a+r2*t);
  return dir*a;
}

/* keyboard state → control axes. keys: a Set holding lowercase e.key values (the pages already collect these). */
const has=(K,...k)=>k.some(x=>K.has(x));
function dirs(K){ return {
  x:(has(K,'d','ArrowRight')?1:0)-(has(K,'a','ArrowLeft')?1:0),
  y:(has(K,'s','ArrowDown')?1:0)-(has(K,'w','ArrowUp')?1:0),   // +y = pull = nose up
  trim:(has(K,'End',']')?1:0)-(has(K,'Home','[')?1:0),         // +trim = nose up
  rtrim:(has(K,'.')?1:0)-(has(K,',')?1:0),                      // +rtrim = rudder trim right (nose right)
  fast:has(K,'Shift','shift') }; }

/* per-aircraft authority: what a fully held key gives without Shift (Shift always allows 1.0) */
const AUTH={C172:{x:0.7,y:0.28}, DA42:{x:0.7,y:0.28}, B200:{x:0.75,y:0.32}};
function create(type){ const au=AUTH[type]||AUTH.C172;
  const s={x:0,y:0,rx:0,ry:0,held:false,trim:0,rtrim:0,
    tick(K,dt){ const d=dirs(K), f=d.fast?2:1; s.rx=step(s.rx,d.x,dt,f); s.ry=step(s.ry,d.y,dt,f);
      const gx=d.fast?1:au.x, gy=d.fast?1:au.y; // authority blends smoothly, no jump when Shift is pressed
      s.gx=(s.gx==null?gx:s.gx+clamp(gx-s.gx,-dt*2,dt*2)); s.gy=(s.gy==null?gy:s.gy+clamp(gy-s.gy,-dt*2,dt*2));
      s.x=s.rx*s.gx; s.y=s.ry*s.gy; s.held=!!(d.x||d.y); s.trim=d.trim; s.rtrim=d.rtrim; return s; },
    reset(){ s.x=s.y=s.rx=s.ry=0; s.held=false; } };
  return s; }

/* mouse / touch drag → stick. dx, dy in screen pixels from where the drag started.
   Mouse: low gain (full travel at 170 px across, 140 px up/down), 3 px dead zone, expo curve so a small move is a small input.
   Touch: unchanged from the touch stick tuning (dead zone 10 %, expo, capped at 0.8) over a 90 px radius. */
const expo=(u,lin)=>{ const a=Math.abs(u); return Math.sign(u)*(lin*a+(1-lin)*a*a*a); };
function shapeDrag(dx,dy,ptype){
  if(ptype==='touch'||ptype==='pen'){ const R=90; let ux=dx/R, uy=dy/R; const m=Math.hypot(ux,uy); if(m>1){ ux/=m; uy/=m; }
    const sh=v=>{ const a=Math.abs(v), d=0.1, u=a<d?0:(a-d)/(1-d); return Math.sign(v)*(0.3*u+0.7*u*u*u)*0.8; }; return {x:sh(ux),y:sh(uy)}; }
  const dz=(v,full)=>{ const a=Math.abs(v); return a<3?0:Math.sign(v)*Math.min(1,(a-3)/(full-3)); };
  return {x:expo(dz(dx,170),0.3), y:expo(dz(dy,140),0.3)}; }
/* absolute pad (the yoke pad under the panel): position −1…1 → shaped */
const shapePad=v=>expo(clamp(v,-1,1),0.3);

/* drag spring-back: when the mouse lets go the stick glides back to centre instead of snapping */
function spring(inp,dt){
  if(inp.stick){ inp._spr={x:inp.stick.x,y:inp.stick.y}; return inp.stick; }
  const s=inp._spr; if(!s) return null;
  s.x=step(s.x,0,dt); s.y=step(s.y,0,dt); if(!s.x&&!s.y){ inp._spr=null; return null; } return s; }

/* key filter shared by the pages */
const typing=()=>{ const a=document.activeElement; if(!a) return false; const t=a.tagName;
  return (t==='INPUT'&&!/^(range|checkbox|radio|button)$/.test(a.type))||t==='TEXTAREA'||t==='SELECT'||a.isContentEditable||a.getAttribute('role')==='spinbutton'; };
const mod=e=>e.metaKey||e.ctrlKey||e.altKey;
const FLY=['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'];

/* help strings (bilingual) */
const TXT={
  hint:{en:'Fly with the keyboard: <kbd>W</kbd> <kbd>S</kbd> nose down / up · <kbd>A</kbd> <kbd>D</kbd> roll · <kbd>Q</kbd> <kbd>E</kbd> rudder · <kbd>Home</kbd> <kbd>End</kbd> trim. Hold to move further, tap for small corrections.',
        no:'Fly med tastaturet: <kbd>W</kbd> <kbd>S</kbd> nese ned / opp · <kbd>A</kbd> <kbd>D</kbd> krengning · <kbd>Q</kbd> <kbd>E</kbd> sideror · <kbd>Home</kbd> <kbd>End</kbd> trim. Hold for mer utslag, trykk kort for små korreksjoner.'},
  ok:{en:'Got it',no:'Skjønner'} };
const NO={
  'Nose down and nose up (W pushes, S pulls) · roll left and right. Hold to move the control further, tap for small corrections; let go and it eases back to centre (your trim).':
  'Nese ned og nese opp (W skyver, S trekker) · krengning venstre og høyre. Hold for mer utslag, trykk kort for små korreksjoner; slipp, så går rattet rolig tilbake til midten (trimmen).',
  'Faster, and full travel, with the flight keys':'Raskere, og fullt utslag, med flytastene',
  'Elevator trim nose down and up':'Trim nese ned og opp','or the arrow keys':'eller piltastene','or':'eller' };
function lang(){ return G.LAB&&G.LAB.lang==='no'?'no':'en'; }

/* first-visit hint: small, calm, dismissible, remembered. Desktop (fine pointer) only. */
const KEY='bb-flykeys-hint';
function hint(host){
  if(G.LAB&&G.LAB.add) G.LAB.add({},NO);
  try{ if(localStorage.getItem(KEY)) return null; }catch(e){ return null; }
  if(G.matchMedia&&!G.matchMedia('(pointer:fine)').matches) return null;
  // the cockpit trainers' shell has one notification area: the hint waits there until it is free (shown once)
  if(G.SIMSHELL&&G.SIMSHELL.tip){ G.SIMSHELL.tip(TXT.hint[lang()],KEY,9000); return null; }
  host=host||document.body; const d=document.createElement('div'); d.className='fkhint'; d.setAttribute('role','note');
  if(!document.getElementById('fkhintcss')){ const st=document.createElement('style'); st.id='fkhintcss';
    st.textContent='.fkhint{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);z-index:30;max-width:min(560px,calc(100% - 24px));display:flex;gap:10px;align-items:center;padding:8px 10px 8px 14px;border-radius:10px;background:rgba(14,20,27,.88);border:1px solid rgba(255,255,255,.14);color:#dfe7ee;font:12.5px/1.45 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);pointer-events:auto}.fkhint kbd{color:inherit;font:11px/1 ui-monospace,monospace;padding:2px 5px;border-radius:4px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18)}.fkhint button{flex:none;font:inherit;font-size:12px;padding:4px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:inherit;cursor:pointer}.fkhint button:hover{background:rgba(255,255,255,.16)}';
    document.head.appendChild(st); }
  const fill=()=>{ const l=lang(); d.innerHTML=`<span>${TXT.hint[l]}</span><button type="button">${TXT.ok[l]}</button>`; d.querySelector('button').onclick=close; };
  const close=()=>{ try{ localStorage.setItem(KEY,'1'); }catch(e){} d.remove(); };
  d.addEventListener('pointerdown',e=>e.stopPropagation()); // not a look-around drag or a panel click in the 3D cockpits
  fill(); if(G.LAB&&G.LAB.onLang) G.LAB.onLang(()=>{ if(d.isConnected) fill(); });
  if(getComputedStyle(host).position==='static') host.style.position='relative';
  host.appendChild(d);
  // using the keys counts as having read it
  const used=e=>{ if(!mod(e)&&FLY.includes(e.key.length===1?e.key.toLowerCase():e.key)){ setTimeout(close,4000); removeEventListener('keydown',used); } };
  addEventListener('keydown',used);
  return d; }

G.FK={RAMP,AUTH,step,dirs,create,expo,shapeDrag,shapePad,spring,typing,mod,FLY,hint,TXT,NO};
})(typeof window!=='undefined'?window:globalThis);
