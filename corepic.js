/* NORDAP – corepic.js: "The essentials in one picture", the first thing in every lab's Understand step.
   One dark, animated picture that is built up step by step (the most central idea first), with a numbered
   step list beside it, Previous / Play / Next and a scrubber. The lab's own Key concepts and model follow.

   CORE.mount(hostEl, cfg) with cfg:
     title, sub      {en,no}  heading and one-line purpose
     label           {en,no}  aria-label of the picture
     steps           [{t:{en,no}, d:{en,no}, go?:{en,no,fn}}]  t = short title, d = one or two plain sentences
     draw(g,W,H,p,tm)          draws the picture; p = continuous step position (0 … n-1), tm = seconds (ambient motion)
     aspect          width/height of the picture (default 16/8.4); aspectSm the same below 600 px
     dwell           seconds on each step while playing (default 5.5)
     foot            {en,no}  small note under the list (scale, model)
   CORE.U holds shared drawing helpers (text, pills, arrows, easing, a side-view airliner).
   Own design; illustrative teaching values only. */
(function(){
'use strict';
if(window.CORE) return;
const css=`
.cpic{margin:6px 0 30px;scroll-margin-top:72px}
.cpic-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;margin:0 0 12px}
.cpic-h .k{font-family:var(--f-mono);font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.cpic-h h3{font-family:var(--f-display);font-stretch:90%;font-weight:700;font-size:22px;line-height:1.15;margin:0;color:var(--ink);flex-basis:100%}
.cpic-h p{margin:2px 0 0;color:var(--ink-2);font-size:14.5px;line-height:1.5;max-width:78ch;flex-basis:100%}
.cpic-g{display:grid;grid-template-columns:minmax(0,1fr) 318px;border:1px solid #0a1015;border-radius:var(--radius-lg);overflow:hidden;background:#0f151b;color:#E2E8EE}
.cpic-st{position:relative;min-width:0;background:radial-gradient(120% 95% at 50% 20%,#24303c 0%,#16202a 55%,#0e141a 100%);display:flex;flex-direction:column}
.cpic-st canvas{display:block;width:100%;outline:0;flex:none}
.cpic-st canvas:focus-visible{box-shadow:inset 0 0 0 2px var(--focus-dark)}
.cpic-tr{margin-top:auto;display:flex;align-items:center;gap:8px;padding:9px 12px 11px;border-top:1px solid rgba(255,255,255,.06);background:rgba(8,12,16,.35)}
.cpic-tr button{font-family:var(--f-body);font-size:12.5px;font-weight:500;background:rgba(18,22,26,.62);color:#C3CCD4;border:1px solid rgba(255,255,255,.12);border-radius:4px;padding:5px 11px;min-height:32px;cursor:pointer;white-space:nowrap}
.cpic-tr button:hover{color:#fff;border-color:rgba(255,255,255,.3)}
.cpic-tr button:focus-visible{outline:2px solid var(--focus-dark);outline-offset:2px}
.cpic-tr button.pl{background:#E6EBEF;color:#13181D;border-color:#E6EBEF;font-weight:600;min-width:84px}
.cpic-tr .sc{flex:1;position:relative;min-width:60px;height:32px;display:flex;align-items:center}
.cpic-tr .sc input{width:100%;margin:0;accent-color:#E46BAE;position:relative;z-index:1;background:transparent}
.cpic-tr .sc .tk{position:absolute;left:8px;right:8px;top:50%;height:0;pointer-events:none}
.cpic-tr .sc .tk i{position:absolute;top:-9px;width:2px;height:6px;background:rgba(255,255,255,.28);transform:translateX(-1px)}
.cpic-tr .n{font-family:var(--f-mono);font-size:11.5px;color:#8E99A4;min-width:44px;text-align:right}
.cpic-ls{background:#121a21;border-left:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;min-width:0}
.cpic-ls ol{list-style:none;margin:0;padding:8px 0;flex:1;overflow:auto;counter-reset:cs}
.cpic-ls li{margin:0;display:block;padding:0}
.cpic-ls li>button{all:unset;box-sizing:border-box;display:grid;grid-template-columns:26px minmax(0,1fr);gap:0 10px;width:100%;padding:8px 16px 8px 14px;cursor:pointer;color:#8E99A4;border-left:3px solid transparent}
.cpic-ls li>button:hover{color:#E2E8EE;background:rgba(255,255,255,.03)}
.cpic-ls li>button:focus-visible{outline:2px solid var(--focus-dark);outline-offset:-2px}
.cpic-ls li i{font-style:normal;font-family:var(--f-mono);font-size:11px;width:22px;height:22px;border-radius:50%;border:1px solid rgba(255,255,255,.22);display:grid;place-items:center;margin-top:1px;color:#AEB8C1}
.cpic-ls li b{font-family:var(--f-display);font-stretch:92%;font-weight:650;font-size:14.5px;line-height:1.3;color:inherit;align-self:center}
.cpic-ls li p{grid-column:2;margin:5px 0 2px;font-size:13.5px;line-height:1.5;color:#C9D2DA;display:none}
.cpic-ls li p em{font-style:normal;color:#fff;font-weight:600}
.cpic-ls li .go{display:none;margin:-2px 0 8px 53px;font-size:12px;font-weight:600;color:#F29AC8;background:none;border:0;padding:2px 0;cursor:pointer}
.cpic-ls li .go:hover{text-decoration:underline}
.cpic-ls li.c-on>button{color:#fff;border-left-color:#E46BAE;background:rgba(228,107,174,.07)}
.cpic-ls li.c-on i{background:#E46BAE;border-color:#E46BAE;color:#13181D;font-weight:600}
.cpic-ls li.c-on p,.cpic-ls li.c-on .go{display:block}
.cpic-ls li.c-past i{border-color:rgba(228,107,174,.55);color:#E9A9CC}
.cpic-ls .ft{margin:0;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.06);font-size:11.5px;line-height:1.45;color:#7F8B96}
.cpic-cap{display:none}
.cpic-more{margin:22px 0 0;border-top:1px solid var(--rule-2)}
.cpic-more>summary{list-style:none;cursor:pointer;display:flex;align-items:baseline;gap:10px;padding:14px 0 4px;font-family:var(--f-display);font-stretch:92%;font-weight:650;font-size:17px;color:var(--ink)}
.cpic-more>summary::-webkit-details-marker{display:none}
.cpic-more>summary::before{content:"+";font-family:var(--f-mono);color:var(--accent);width:14px}
.cpic-more[open]>summary::before{content:"−"}
.cpic-more>summary small{font-family:var(--f-body);font-weight:400;font-size:13.5px;color:var(--ink-2)}
.cpic-more>summary:hover{color:var(--accent)}
body.depth-instructor .cpic-ls li b{font-size:16px}
body.depth-instructor .cpic-ls li p{font-size:15.5px}
body.depth-instructor .cpic-g{grid-template-columns:minmax(0,1fr) 360px}
@media (max-width:1100px){.cpic-g{grid-template-columns:minmax(0,1fr) 270px}}
@media (max-width:900px){
 .cpic-g{grid-template-columns:minmax(0,1fr)}
 .cpic-ls{border-left:0;border-top:1px solid rgba(255,255,255,.07)}
 .cpic-ls ol{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px 4px}
 .cpic-ls li>button{display:block;padding:0;border:0;width:auto}
 .cpic-ls li>button b,.cpic-ls li p,.cpic-ls li .go{display:none!important}
 .cpic-ls li.c-on>button{background:none}
 .cpic-ls li i{width:30px;height:30px;font-size:12px}
 .cpic-cap{display:block;padding:4px 14px 12px}
 .cpic-cap b{display:block;font-family:var(--f-display);font-stretch:92%;font-weight:650;font-size:16px;color:#fff;margin:2px 0 4px}
 .cpic-cap p{margin:0;font-size:14px;line-height:1.5;color:#C9D2DA}
 .cpic-cap p em{font-style:normal;color:#fff;font-weight:600}
 .cpic-cap .go{margin-top:6px;font-size:13px;font-weight:600;color:#F29AC8;background:none;border:0;padding:4px 0;cursor:pointer}
 .cpic-tr{flex-wrap:wrap}.cpic-tr .sc{order:5;flex-basis:100%}
}
@media (pointer:coarse){.cpic-tr button{min-height:44px}}
`;
const sty=document.createElement('style'); sty.textContent=css; document.head.appendChild(sty);
const L=o=>window.LAB?LAB.L(o):(o&&o.en!==undefined?o.en:o);
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------------- shared drawing helpers ---------------- */
const FONT={mono:'"IBM Plex Mono", ui-monospace, monospace',body:'"IBM Plex Sans", system-ui, sans-serif'};
const C={ink:'#E2E8EE',dim:'#8E99A4',faint:'rgba(255,255,255,.12)',mag:'#E46BAE',blue:'#7FC6EE',green:'#71CC93',amber:'#F0B440',red:'#EC5A47',violet:'#B9A3F2',white:'#F4F7F9'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,k)=>a+(b-a)*k;
const ease=k=>k<0?0:k>1?1:k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
/* how far into step i the picture is: 0 before, 0..1 while arriving, 1 after */
const at=(p,i,span)=>clamp((p-(i-(span||1)))/(span||1),0,1);
function txt(g,s,x,y,o){ o=o||{}; g.font=(o.w||(o.mono?500:600))+' '+(o.size||12)+'px '+(o.mono?FONT.mono:FONT.body);
  g.fillStyle=o.col||C.ink; g.textAlign=o.al||'left'; g.textBaseline=o.bl||'alphabetic'; const ga=g.globalAlpha; if(o.a!=null) g.globalAlpha=ga*o.a; g.fillText(s,x,y); g.globalAlpha=ga; g.textBaseline='alphabetic'; return g.measureText(s).width; }
function pill(g,s,x,y,o){ o=o||{}; const fs=o.size||11.5; g.font=(o.w||600)+' '+fs+'px '+(o.mono?FONT.mono:FONT.body);
  const w=g.measureText(s).width+(o.pad||14), h=fs+(o.ph||9); let x0=o.al==='right'?x-w:o.al==='center'?x-w/2:x; if(o.fit) x0=clamp(x0,4,o.fit-w-4);
  g.save(); if(o.a!=null) g.globalAlpha*=o.a;
  g.fillStyle=o.bg||'rgba(13,20,27,.9)'; g.strokeStyle=o.bd||o.col||'rgba(255,255,255,.2)'; g.lineWidth=1;
  g.beginPath(); g.roundRect?g.roundRect(x0,y-h/2,w,h,o.r!=null?o.r:h/2):g.rect(x0,y-h/2,w,h); g.fill(); g.stroke();
  g.fillStyle=o.tc||o.col||C.ink; g.textAlign='center'; g.textBaseline='middle'; g.fillText(s,x0+w/2,y+.5); g.textBaseline='alphabetic'; g.restore(); return {x0,w,h}; }
function arrow(g,x0,y0,x1,y1,col,o){ o=o||{}; const a=Math.atan2(y1-y0,x1-x0), hs=o.head||8;
  g.save(); if(o.a!=null) g.globalAlpha*=o.a; g.strokeStyle=col; g.fillStyle=col; g.lineWidth=o.lw||2; g.lineCap='round'; if(o.dash) g.setLineDash(o.dash);
  g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1-Math.cos(a)*hs*.6,y1-Math.sin(a)*hs*.6); g.stroke(); g.setLineDash([]);
  g.beginPath(); g.moveTo(x1,y1); g.lineTo(x1-hs*Math.cos(a-.42),y1-hs*Math.sin(a-.42)); g.lineTo(x1-hs*Math.cos(a+.42),y1-hs*Math.sin(a+.42)); g.closePath(); g.fill(); g.restore(); }
function rr(g,x,y,w,h,r){ g.beginPath(); g.roundRect?g.roundRect(x,y,w,h,r):g.rect(x,y,w,h); }

/* A generic twin-jet airliner, side view, nose to the right (own design, A320-size proportions).
   Origin = main-gear contact point; x forward, z up, metres. o: {x,y (screen px of the origin), s (px per m), pitch (deg, nose up),
   gear 0..1 (1 = down), eng:[left,right] 1 = running 0 = failed, tm (s, exhaust shimmer), alpha, ghost} */
const FUS_T=[[17.2,3.55],[16.4,4.75,15.2,5.55,13.2,5.9],[11.5,6.05],[-9.5,6.05],[-13.5,6.0,-17.5,5.75,-20.6,5.1]];
const FUS_B=[[-20.6,4.75],[-17.2,3.6,-13.2,2.45,-9.6,2.05],[10.6,2.02],[13.6,2.08,16.2,2.6,17.2,3.55]];
function jet(g,o){
  const s=o.s, th=-(o.pitch||0)*Math.PI/180, gear=o.gear==null?1:o.gear;
  g.save(); g.translate(o.x,o.y); g.rotate(th); if(o.alpha!=null) g.globalAlpha=o.alpha;
  const P=(x,z)=>[x*s,-z*s];
  const path=pts=>{ pts.forEach((p,i)=>{ if(p.length===2){ const a=P(p[0],p[1]); i?g.lineTo(a[0],a[1]):g.moveTo(a[0],a[1]); } else { const a=P(p[0],p[1]),b=P(p[2],p[3]),c=P(p[4],p[5]); g.bezierCurveTo(a[0],a[1],b[0],b[1],c[0],c[1]); } }); };
  const ghost=!!o.ghost, body=ghost?'rgba(226,232,238,.16)':null;
  // far wing / engine silhouette (behind the fuselage)
  g.fillStyle=ghost?'rgba(200,210,220,.08)':'#5E6B76';
  g.beginPath(); path([[3.2,3.15],[-5.6,3.6],[-8.8,4.35],[-8.2,4.45],[-1.5,3.75],[4.8,3.3]]); g.closePath(); g.fill();
  // gear (behind the body, drawn first)
  const gs=gear; if(gs>0.02){
    const mg=(x,len)=>{ const L=len*gs; g.strokeStyle=ghost?'rgba(220,228,235,.2)':'#8C98A2'; g.lineWidth=Math.max(1.2,0.32*s); g.lineCap='round';
      const a=P(x,2.1), b=P(x,2.1-L+0.55); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke();
      g.fillStyle=ghost?'rgba(20,28,36,.3)':'#1A2128'; g.strokeStyle=ghost?'rgba(220,228,235,.25)':'#56626C'; g.lineWidth=Math.max(1,0.12*s);
      g.beginPath(); g.arc(b[0],b[1],0.56*s,0,7); g.fill(); g.stroke();
      g.fillStyle='#6E7A84'; g.beginPath(); g.arc(b[0],b[1],0.2*s,0,7); g.fill(); };
    mg(0,2.1); mg(12.6,2.1);
  }
  // fuselage
  const grd=g.createLinearGradient(0,-6.1*s,0,-2*s);
  grd.addColorStop(0,ghost?'rgba(240,244,247,.12)':'#F7F9FA'); grd.addColorStop(.55,ghost?'rgba(225,232,238,.1)':'#E4E9ED'); grd.addColorStop(1,ghost?'rgba(160,172,182,.1)':'#AEB9C2');
  g.fillStyle=grd; g.strokeStyle=ghost?'rgba(226,232,238,.35)':'rgba(10,16,21,.55)'; g.lineWidth=1;
  g.beginPath(); path(FUS_T); path(FUS_B); g.closePath(); g.fill(); g.stroke();
  if(!ghost){
    // belly shade and a cheat line in the brand colour
    g.fillStyle='rgba(24,40,58,.10)'; g.beginPath(); path([[-9.6,2.05],[10.6,2.02],[10.6,2.75],[-9.6,2.8]]); g.closePath(); g.fill();
    g.strokeStyle='rgba(154,30,104,.55)'; g.lineWidth=Math.max(1,0.16*s); g.beginPath(); const c0=P(13.2,3.85), c1=P(-15.5,3.85); g.moveTo(c0[0],c0[1]); g.lineTo(c1[0],c1[1]); g.stroke();
    // windows
    g.fillStyle='#2B3B4A'; for(let x=11.2;x>-13.4;x-=0.84){ const a=P(x,4.62); g.beginPath(); g.ellipse(a[0],a[1],0.17*s,0.24*s,0,0,7); g.fill(); }
    // doors
    g.strokeStyle='rgba(60,75,88,.45)'; g.lineWidth=1; [[12.2],[-12.9]].forEach(([x])=>{ const a=P(x,2.45),b=P(x+0.82,5.15); g.strokeRect(a[0],b[1],b[0]-a[0],a[1]-b[1]); });
    // cockpit
    g.fillStyle='#16222D'; g.beginPath(); path([[16.15,4.62],[15.55,5.22],[14.55,5.48],[14.4,4.98]]); g.closePath(); g.fill();
  }
  // fin and tailplane
  g.fillStyle=ghost?'rgba(226,232,238,.12)':'#EEF2F4'; g.strokeStyle=ghost?'rgba(226,232,238,.35)':'rgba(10,16,21,.55)';
  g.beginPath(); path([[-12.6,6.0],[-17.7,11.9],[-20.1,11.9],[-21.0,5.35],[-20.6,5.1]]); g.closePath(); g.fill(); g.stroke();
  if(!ghost){ g.fillStyle='#9A1E68'; g.beginPath(); path([[-15.6,8.4],[-17.7,11.9],[-20.1,11.9],[-20.55,8.6]]); g.closePath(); g.fill();
    g.fillStyle='#E46BAE'; g.beginPath(); path([[-14.9,7.6],[-15.6,8.4],[-20.55,8.6],[-20.65,7.85]]); g.closePath(); g.fill(); }
  g.fillStyle=ghost?'rgba(226,232,238,.12)':'#D5DCE2';
  g.beginPath(); path([[-16.6,5.35],[-21.5,5.95],[-21.8,5.6],[-17.6,5.0]]); g.closePath(); g.fill(); g.stroke();
  // near wing
  g.fillStyle=ghost?'rgba(226,232,238,.14)':'#C9D1D8';
  g.beginPath(); path([[4.6,2.55],[-3.4,2.75],[-7.2,3.25],[-7.5,3.05],[-3.0,2.25],[4.2,2.15]]); g.closePath(); g.fill(); g.stroke();
  // near engine + pylon
  const eng=o.eng||[1,1];
  g.fillStyle=ghost?'rgba(226,232,238,.12)':'#B9C3CB'; g.beginPath(); path([[5.4,2.3],[3.6,2.35],[3.0,1.95],[5.8,1.95]]); g.closePath(); g.fill();
  const ng=g.createLinearGradient(0,-2.5*s,0,-0.55*s); ng.addColorStop(0,ghost?'rgba(240,244,247,.12)':'#F2F5F7'); ng.addColorStop(1,ghost?'rgba(140,150,160,.1)':'#97A3AD');
  g.fillStyle=ng; g.beginPath(); path([[8.0,2.45],[8.25,1.55,8.25,1.0,8.0,0.62],[3.4,0.85],[3.0,1.3],[3.4,2.25]]); g.closePath(); g.fill(); g.stroke();
  if(!ghost){ g.fillStyle='#1C262F'; g.beginPath(); const e0=P(8.0,1.55); g.ellipse(e0[0],e0[1],0.22*s,0.86*s,0,0,7); g.fill(); }
  // exhaust: shimmer when running, red mark when failed
  const ex=P(2.7,1.55);
  if(!ghost&&eng[0]>0.02){ for(let k=0;k<3;k++){ const ph=((o.tm||0)*3.2+k/3)%1; g.strokeStyle=`rgba(255,200,150,${(0.22*(1-ph))*eng[0]})`; g.lineWidth=Math.max(1,.18*s);
      g.beginPath(); g.moveTo(ex[0]-ph*5*s,ex[1]-0.45*s); g.quadraticCurveTo(ex[0]-ph*5*s-1.2*s,ex[1],ex[0]-ph*5*s,ex[1]+0.45*s); g.stroke(); } }
  if(!ghost&&eng[0]<0.98){ g.globalAlpha=(o.alpha==null?1:o.alpha)*(1-eng[0]); g.strokeStyle=C.red; g.lineWidth=Math.max(2,.34*s); const c=P(5.6,1.5), r=0.9*s;
    g.beginPath(); g.moveTo(c[0]-r,c[1]-r); g.lineTo(c[0]+r,c[1]+r); g.moveTo(c[0]+r,c[1]-r); g.lineTo(c[0]-r,c[1]+r); g.stroke(); g.globalAlpha=o.alpha==null?1:o.alpha; }
  g.restore();
}

/* clouds: a cumulus / cumulonimbus with a flat base built from shaded lobes, and a layer-cloud deck between two curves */
function cumulus(g,x,base,top,w,o){ o=o||{}; const h=base-top; if(h<4) return; const lobes=[];
  let seed=Math.round(Math.abs(x)*7+w*3+(o.seed||0)); const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
  const n=Math.max(6,Math.round(h/(w*.18)));
  for(let i=0;i<n;i++){ const k=i/(n-1), y=base-h*k*.9, ww=w*(0.6+0.4*Math.sin(Math.PI*Math.min(1,k*1.3)))*(k>.85?0.75:1); const m=2+Math.round(rnd()*2);
    for(let j=0;j<m;j++) lobes.push([x+(rnd()-.5)*ww*.85, y-(rnd()*h*.04), ww*(0.26+rnd()*.18)]); }
  if(!o.anvil){ lobes.push([x,top+w*.2,w*.3]); lobes.push([x-w*.17,top+w*.28,w*.24]); lobes.push([x+w*.19,top+w*.26,w*.25]); }
  const dark=o.dark?1:0, a=o.alpha==null?1:o.alpha;
  g.save(); g.beginPath(); g.rect(x-w*3,top-w*3,w*6,base-(top-w*3)); g.clip();
  lobes.forEach(([lx,ly,r])=>{ const shade=clamp((ly-top)/h,0,1)*.55*(dark?1.5:1); const gr=g.createRadialGradient(lx-r*.35,ly-r*.45,r*.1,lx,ly,r);
    const c0=Math.round(252-60*shade), c1=Math.round(222-80*shade), c2=Math.round(160-70*shade);
    gr.addColorStop(0,`rgba(${c0},${c0+1},${c0+2},${.97*a})`); gr.addColorStop(.7,`rgba(${c1},${c1+6},${c1+12},${.93*a})`); gr.addColorStop(1,`rgba(${c2},${c2+10},${c2+20},${.86*a})`);
    g.fillStyle=gr; g.beginPath(); g.arc(lx,ly,r,0,7); g.fill(); });
  g.restore();
  const bg=g.createLinearGradient(0,base-14,0,base); bg.addColorStop(0,'rgba(90,104,118,0)'); bg.addColorStop(1,`rgba(80,94,108,${.7*a})`); g.fillStyle=bg; g.fillRect(x-w*.62,base-14,w*1.24,14);
  if(o.anvil){ const aw=o.anvil, ay=top+w*.3; const gr=g.createLinearGradient(0,ay-w*.25,0,ay+w*.2); gr.addColorStop(0,`rgba(245,248,250,${.95*a})`); gr.addColorStop(1,`rgba(170,182,194,${.85*a})`); g.fillStyle=gr;
    g.beginPath(); g.moveTo(x-w*.5,ay+w*.08); g.bezierCurveTo(x-w*.62,ay-w*.22,x-w*.3,ay-w*.36,x+w*.1,ay-w*.36); g.bezierCurveTo(x+aw*.45,ay-w*.36,x+aw*.8,ay-w*.3,x+aw,ay-w*.24); g.lineTo(x+aw*1.02,ay-w*.14); g.bezierCurveTo(x+aw*.6,ay-w*.1,x+w*.4,ay-w*.04,x+w*.36,ay+w*.12); g.closePath(); g.fill(); } }
function deck(g,x0,x1,bot,topf,o){ o=o||{}; const a=o.alpha==null?1:o.alpha, step=o.step||6;
  // body
  g.save(); g.beginPath(); g.moveTo(x0,bot(x0)); for(let x=x0;x<=x1;x+=step) g.lineTo(x,topf(x)); for(let x=x1;x>=x0;x-=step) g.lineTo(x,bot(x)); g.closePath();
  const yT=Math.min(topf(x0),topf(x1),topf((x0+x1)/2)), yB=Math.max(bot(x0),bot(x1),bot((x0+x1)/2));
  const gr=g.createLinearGradient(0,yT,0,yB); gr.addColorStop(0,`rgba(${o.light||'226,232,238'},${.9*a})`); gr.addColorStop(1,`rgba(${o.dark||'120,134,148'},${.92*a})`); g.fillStyle=gr; g.fill(); g.restore();
  // billowy top edge
  for(let x=x0+step;x<x1-step;x+=step*2.2){ const th=bot(x)-topf(x); if(th<3) continue; const r=Math.min(th*.55,o.billow||14); const y=topf(x)+r*.55;
    const rg=g.createRadialGradient(x-r*.3,y-r*.4,r*.1,x,y,r); rg.addColorStop(0,`rgba(${o.light||'236,241,245'},${.9*a})`); rg.addColorStop(1,`rgba(${o.light||'226,232,238'},0)`); g.fillStyle=rg; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); } }
const U={FONT,C,clamp,lerp,ease,at,txt,pill,arrow,rr,jet,cumulus,deck};

/* ---------------- the component ---------------- */
function mount(host,cfg){
  if(!host) return null;
  const n=cfg.steps.length, asp=cfg.aspect||16/8.4, dwell=(cfg.dwell||5.5)*1000;
  const root=document.createElement('div'); root.className='cpic'; root.id=cfg.id||'core';
  root.innerHTML=`<div class="cpic-h"><span class="k"></span><h3></h3><p></p></div>
  <div class="cpic-g"><div class="cpic-st"><canvas tabindex="0"></canvas>
    <div class="cpic-tr"><button type="button" class="pv" aria-label="Previous step">‹</button><button type="button" class="pl"></button><button type="button" class="nx" aria-label="Next step">›</button>
      <div class="sc"><input type="range" min="0" max="${n-1}" step="0.01" value="0"><div class="tk">${cfg.steps.map((_,i)=>`<i style="left:${n>1?i/(n-1)*100:0}%"></i>`).join('')}</div></div><span class="n" aria-hidden="true"></span></div>
    <div class="cpic-cap" aria-hidden="true"></div></div>
    <div class="cpic-ls"><ol></ol><p class="ft"></p></div></div>
  <span class="sr-only" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"></span>`;
  host.appendChild(root);
  const cv=root.querySelector('canvas'), g=cv.getContext('2d'), ol=root.querySelector('ol'), sc=root.querySelector('.sc input'),
    pl=root.querySelector('.pl'), nEl=root.querySelector('.n'), cap=root.querySelector('.cpic-cap'), live=root.querySelector('[aria-live]');
  cv.style.aspectRatio=String(asp);
  const api={}; let VG=null, touched=false, autoDone=false; let p=0, from=0, to=0, t0=0, dur=1, playing=false, arrived=0, cur=0, vis=true, raf=0, W=0, H=0, dpr=1, dragging=false;
  const now=()=>performance.now();
  function size(){ const a=root.getBoundingClientRect().width<600?(cfg.aspectSm||asp):asp; if(cv.style.aspectRatio!==String(a)) cv.style.aspectRatio=String(a);
    const r=cv.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1); W=Math.max(1,r.width); H=Math.max(1,r.width/a);
    cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  function list(){
    const i0=Math.round(p);
    root.querySelector('.cpic-h .k').textContent=L({en:'Start here · the essentials in one picture',no:'Start her · det viktigste i ett bilde'});
    root.querySelector('.cpic-h h3').textContent=L(cfg.title); root.querySelector('.cpic-h p').textContent=cfg.sub?L(cfg.sub):'';
    ol.innerHTML=cfg.steps.map((s,i)=>`<li class="${i===i0?'c-on':i<i0?'c-past':''}"><button type="button" data-i="${i}" aria-current="${i===i0?'step':'false'}"><i>${i+1}</i><b>${esc(L(s.t))}</b><p>${L(s.d)}</p></button>${s.go?`<button type="button" class="go" data-g="${i}">${esc(L(s.go))} →</button>`:''}</li>`).join('');
    const s=cfg.steps[i0]; cap.innerHTML=`<b>${i0+1} · ${esc(L(s.t))}</b><p>${L(s.d)}</p>${s.go?`<button type="button" class="go" data-g="${i0}">${esc(L(s.go))} →</button>`:''}`;
    root.querySelector('.ft').textContent=cfg.foot?L(cfg.foot):'';
    pl.textContent=playing?L({en:'❚❚ Pause',no:'❚❚ Pause'}):(i0>=n-1&&!playing?L({en:'↺ Replay',no:'↺ Spill av'}):L({en:'▶ Play',no:'▶ Spill av'}));
    root.querySelector('.pv').setAttribute('aria-label',L({en:'Previous step',no:'Forrige steg'})); root.querySelector('.nx').setAttribute('aria-label',L({en:'Next step',no:'Neste steg'}));
    sc.setAttribute('aria-label',L({en:'Position in the picture',no:'Posisjon i bildet'})); sc.setAttribute('aria-valuetext',`${i0+1} / ${n}: ${L(s.t)}`);
    nEl.textContent=`${i0+1} / ${n}`; cv.setAttribute('role','img'); cv.setAttribute('aria-label',(cfg.label?L(cfg.label)+' ':'')+`${i0+1}/${n}: ${L(s.t)}`);
    cur=i0;
  }
  function go(i,inst){ i=clamp(Math.round(i),0,n-1); from=p; to=i; t0=now(); const d=Math.abs(to-from);
    dur=(inst||reduced())?1:Math.min(2600,900+700*Math.sqrt(d)); if(inst||reduced()) p=to;
    if(i!==cur){ list(); live.textContent=`${i+1} / ${n}: ${L(cfg.steps[i].t)}. ${L(cfg.steps[i].d).replace(/<[^>]+>/g,'')}`; } kick(); }
  function setPlay(v){ playing=v; arrived=now();
    if(v){ if(Math.round(p)>=n-1){ go(0,true); arrived=now()-dwell*.6; } else go(Math.round(p)+1); }
    list(); kick(); }
  function frame(){
    raf=0; const t=now();
    if(!dragging&&p!==to){ const k=dur<=1?1:clamp((t-t0)/dur,0,1); p=from+(to-from)*ease(k); if(k>=1){ p=to; arrived=t; } }
    if(playing&&!dragging&&p===to&&t-arrived>dwell){ if(to<n-1) go(to+1); else { playing=false; list(); } }
    if(!dragging) sc.value=String(p);
    if(Math.round(p)!==cur) list();
    g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
    try{ cfg.draw(g,W,H,p,t/1000); }catch(e){ if(!api.err){ api.err=1; console.error(e); } }
    if(!VG||VG.w!==W||VG.h!==H){ VG=g.createRadialGradient(W/2,H*.45,Math.min(W,H)*.35,W/2,H*.5,Math.max(W,H)*.75); VG.addColorStop(0,'rgba(0,0,0,0)'); VG.addColorStop(1,'rgba(0,0,0,.28)'); VG.w=W; VG.h=H; }
    g.fillStyle=VG; g.fillRect(0,0,W,H);
    if(vis) raf=requestAnimationFrame(frame);
  }
  function kick(){ if(!raf&&vis) raf=requestAnimationFrame(frame); }
  pl.addEventListener('click',()=>setPlay(!playing));
  root.querySelector('.pv').addEventListener('click',()=>{ playing=false; go(Math.ceil(p-1e-6)-1); });
  root.querySelector('.nx').addEventListener('click',()=>{ playing=false; go(Math.floor(p+1e-6)+1); });
  root.addEventListener('click',e=>{ const b=e.target.closest('[data-i]'); if(b){ playing=false; go(+b.dataset.i); return; }
    const gb=e.target.closest('[data-g]'); if(gb){ const s=cfg.steps[+gb.dataset.g]; if(s&&s.go&&s.go.fn) s.go.fn(); } });
  sc.addEventListener('input',()=>{ dragging=true; playing=false; p=+sc.value; from=to=p; kick(); });
  const rel=()=>{ if(!dragging) return; dragging=false; go(Math.round(p)); };
  sc.addEventListener('change',rel); sc.addEventListener('pointerup',rel); sc.addEventListener('blur',rel);
  cv.addEventListener('keydown',e=>{ if(e.key==='ArrowRight'){ playing=false; go(Math.floor(p+1e-6)+1); e.preventDefault(); } else if(e.key==='ArrowLeft'){ playing=false; go(Math.ceil(p-1e-6)-1); e.preventDefault(); } else if(e.key===' '){ setPlay(!playing); e.preventDefault(); } });
  cv.addEventListener('click',()=>{ if(!playing) go(Math.floor(p+1e-6)+1>n-1?0:Math.floor(p+1e-6)+1); });
  root.addEventListener('pointerdown',()=>{ touched=true; },true); root.addEventListener('keydown',()=>{ touched=true; },true);
  if('IntersectionObserver' in window){ new IntersectionObserver(es=>{ vis=es[0].isIntersecting; if(vis) kick(); }).observe(cv);
    new IntersectionObserver(es=>{ const e=es[0]; if(e.isIntersecting&&e.intersectionRatio>=.55&&!autoDone&&!touched&&!reduced()){ autoDone=true; setTimeout(()=>{ if(!touched&&!playing) setPlay(true); },500); } },{threshold:[.55]}).observe(cv); }
  new ResizeObserver(()=>{ size(); kick(); }).observe(cv);
  size(); list();
  const fold=()=>{ const sec=root.closest('section'); if(!sec||sec.querySelector('.cpic-more')) return; const grid=sec.querySelector('.kcgrid,#kcGrid'); if(!grid||!grid.children.length) return false;
    const intro=sec.querySelector('.kintro'); const d=document.createElement('details'); d.className='cpic-more';
    const sm=document.createElement('summary'); d.appendChild(sm); grid.parentNode.insertBefore(d,grid); if(intro&&intro.compareDocumentPosition(grid)&Node.DOCUMENT_POSITION_FOLLOWING) d.appendChild(intro); d.appendChild(grid);
    const lab=()=>{ sm.innerHTML=`${L({en:'All key concepts',no:'Alle nøkkelbegreper'})} <small>${grid.children.length} ${L({en:'cards, each linked to the model',no:'kort, hvert koblet til modellen'})}</small>`; }; lab(); if(window.LAB&&LAB.onLang) LAB.onLang(lab);
    grid.addEventListener('click',e=>{ if(e.target.closest('.kgo')) d.open=true; }); return true; };
  if(cfg.fold!==false){ let n=0; const tryFold=()=>{ if(fold()===false&&n++<20) setTimeout(tryFold,150); }; setTimeout(tryFold,0); }
  if(window.LAB&&LAB.onLang) LAB.onLang(()=>{ list(); kick(); });
  document.addEventListener('labdepth',()=>{ setTimeout(()=>{ size(); kick(); },30); });
  Object.assign(api,{go:i=>{ playing=false; go(i); }, step:()=>cur, el:root, redraw:kick});
  return api;
}
window.CORE={mount,U};
})();
