/* NORDAP – concepts.js: the "Key concepts" card grid from the wind tunnel, shared by the other labs.
   KCS.render(gridEl, items) with items {k, t, d, dd, ill, click, to, dp}:
   t, d, dd are {en,no}; d is one or two sentences (the first is shown, the rest goes under "More" with dd);
   ill() returns a 200×64 SVG (KCS.sv / KCS.ar / KCS.tx help); click is a CSS selector of a control to press
   (a preset button) or a function; to is the selector of the model to scroll to and highlight.
   dp: true puts the card in .deep (hidden in Short). Same look as tunnel.html's .kc cards.
   Cards are numbered 01, 02 … in order (CSS counter, so hidden deep cards leave no gap): order them basics first.
   href + hl ({en,no}) instead of click/to: the button links to the place in another lab that shows it (use other.html#kc-<key>).
   An item {grp:{en,no}, sub?:{en,no}} is a full-width group heading inside the ladder; it is not numbered. */
(function(){
'use strict';
if(window.KCS) return;
const css=`
.kcgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(156px,1fr));gap:8px;margin-top:12px;counter-reset:kc}
.kcgrid>.kc{counter-increment:kc}
.kc .kh{display:flex;align-items:baseline;gap:7px;margin-top:2px}
.kc .kn{flex:none;font-family:var(--f-mono);font-size:11px;font-weight:600;color:var(--smoke,#9A1E68);min-width:1.6em;letter-spacing:.02em}
.kc .kn::before{content:counter(kc,decimal-leading-zero)}
.kc .kh h3{margin:0}
.kcgrid>.kgrp{grid-column:1/-1;display:flex;align-items:baseline;gap:10px;margin:12px 0 0;padding-top:10px;border-top:1px solid var(--rule-2,#DCE3E6);font-family:var(--f-mono);font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-2,#4C5B66)}
.kcgrid>.kgrp:first-child{margin-top:2px;padding-top:0;border-top:0}
.kcgrid>.kgrp small{font-family:var(--f-body);font-size:12.5px;font-weight:400;letter-spacing:0;text-transform:none;color:var(--ink-3,#6A7884)}
.kladder{margin:6px 0 0;color:var(--ink-2,#4C5B66);font-size:13px;max-width:80ch}
.kladder b{color:var(--ink,#13202A);font-weight:600}
.kc{background:var(--panel-2,#F6F8F6);border:1px solid var(--line,#C6D0D3);border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:5px;min-width:0}
.kc svg{display:block;width:100%;height:auto;aspect-ratio:200/64;background:#0f161d;border-radius:4px}
.kc h3{font-family:var(--f-display);font-stretch:92%;font-weight:650;font-size:14.5px;margin:2px 0 0;color:var(--fg,#13202A);line-height:1.2}
.kc p{margin:0;font-size:12.5px;color:var(--muted,#4C5B66);line-height:1.45}
.kc p b{color:var(--fg,#13202A);font-weight:600}
.kc .kgo{align-self:flex-start;margin-top:auto;font-family:var(--f-body);font-size:12px;font-weight:600;background:none;border:0;color:var(--smoke,#9A1E68);padding:2px 0;cursor:pointer}
.kc .kgo:hover{text-decoration:underline}
.kc a.kgo{text-decoration:none}
.kc .kmore summary{cursor:pointer;font-size:12px;color:var(--muted,#4C5B66);list-style:none}
.kc .kmore summary::-webkit-details-marker{display:none}
.kc .kmore summary::before{content:"▸ ";color:var(--smoke,#9A1E68)}.kc .kmore[open] summary::before{content:"▾ "}
.kc .kmore p{font-size:12px;color:var(--fg,#13202A);margin:5px 0 0}
.kintro{margin:0;color:var(--muted,#4C5B66);font-size:13px;max-width:80ch}
.kfull{margin-top:14px}
.kfull>summary{cursor:pointer;font-size:13.5px;color:var(--ink-2);width:max-content;list-style:none}
.kfull>summary::-webkit-details-marker{display:none}
.kfull>summary::before{content:"▸ ";color:var(--accent)}.kfull[open]>summary::before{content:"▾ "}
.kfull>summary:hover{color:var(--ink)}
.kfull>div{margin-top:12px}
@keyframes kcflash{0%{box-shadow:0 0 0 0 rgba(255,214,102,.0)}20%{box-shadow:0 0 0 3px rgba(255,214,102,.95)}100%{box-shadow:0 0 0 3px rgba(255,214,102,0)}}
.kc-flash{animation:kcflash 1.8s ease-out 1}
`;
const sty=document.createElement('style'); sty.textContent=css; document.head.appendChild(sty);
const L=o=>window.LAB?LAB.L(o):o.en;
const split=s=>{ const i=s.search(/\.\s/); return i>0&&i<s.length-2?[s.slice(0,i+1),s.slice(i+2)]:[s,'']; };
/* SVG helpers (same vocabulary as the tunnel's illustrations) */
const sv=b=>`<svg viewBox="0 0 200 64" aria-hidden="true">${b}</svg>`;
const tx=(x,y,s,c,a,sz)=>`<text x="${x}" y="${y}" fill="${c||'#c9d2da'}" font-size="${sz||8}" font-family="IBM Plex Mono, monospace" text-anchor="${a||'start'}">${s}</text>`;
const ar=(x1,y1,x2,y2,c,w)=>{ const a=Math.atan2(y2-y1,x2-x1), h=5; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w||1.6}"/><path d="M${x2},${y2} L${(x2-h*Math.cos(a-0.45)).toFixed(1)},${(y2-h*Math.sin(a-0.45)).toFixed(1)} L${(x2-h*Math.cos(a+0.45)).toFixed(1)},${(y2-h*Math.sin(a+0.45)).toFixed(1)} Z" fill="${c}"/>`; };
function render(grid,items){
  if(!grid) return;
  const draw=()=>{ grid.innerHTML=items.map(it=>{ if(it.grp) return `<div class="kgrp${it.dp?' deep':''}" role="presentation">${L(it.grp)}${it.sub?` <small>${L(it.sub)}</small>`:''}</div>`; const [a,b]=split(L(it.d));
    return `<div class="kc${it.dp?' deep':''}">${it.ill?it.ill():''}<div class="kh"><span class="kn" aria-hidden="true"></span><h3>${L(it.t)}</h3></div><p>${a}</p>${b||it.dd?`<details class="deep kmore"><summary>${L({en:'More',no:'Mer'})}</summary>${b?`<p>${b}</p>`:''}${it.dd?`<p>${L(it.dd)}</p>`:''}</details>`:''}${it.href?`<a class="kgo" href="${it.href}">${L(it.hl)} →</a>`:it.click||it.to?`<button class="kgo" type="button" data-k="${it.k}">${L({en:'Show in the model →',no:'Vis i modellen →'})}</button>`:''}</div>`; }).join(''); };
  grid.classList.add('kcgrid'); draw(); if(window.LAB) LAB.onLang(draw);
  ladder(grid);
  /* a link like lab.html#kc-<key> (from another lab's card) opens that card's place in this model */
  const m=/^#kc-([\w-]+)$/.exec(location.hash); if(m){ const go=()=>{ const b=grid.querySelector(`.kgo[data-k="${m[1]}"]`); if(b) b.click(); }; setTimeout(go,400); }
  grid.addEventListener('click',e=>{ const b=e.target.closest('.kgo'); if(!b) return; const it=items.find(x=>x.k===b.dataset.k); if(!it) return;
    if(typeof it.click==='function') it.click(); else if(it.click){ const c=document.querySelector(it.click); if(c) c.click(); }
    const t=it.to?document.querySelector(it.to):null; if(!t) return;
    const tg=t.closest('.view')||t; tg.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:tg.getBoundingClientRect().height>innerHeight-120?'start':'center'}); /* a model taller than the screen: show its top (tabs) below the sticky step bar */
    tg.classList.remove('kc-flash'); void tg.offsetWidth; tg.classList.add('kc-flash'); });
}
/* The same ladder line above the cards in every lab. */
const LADDER={en:'<b>Read them in order.</b> Card 1 is the foundation and each card builds on the one before. “Show in the model” sets the lab up so you see it.',
  no:'<b>Les dem i rekkefølge.</b> Kort 1 er grunnmuren, og hvert kort bygger på det før. «Vis i modellen» setter opp labben så du ser det.'};
function ladder(grid){ if(!grid||grid.previousElementSibling&&grid.previousElementSibling.classList.contains('kladder')) return;
  const p=document.createElement('p'); p.className='kladder'; grid.before(p); const w=()=>{ p.innerHTML=L(LADDER); }; w(); if(window.LAB) LAB.onLang(w); }
/* KCS.order(items, keys): the same cards in ladder order (keys first, in that order; any others keep their place after). */
const order=(items,keys)=>{ const by=k=>{ const i=keys.indexOf(k); return i<0?keys.length:i; }; return items.map((it,i)=>[it,i]).sort((a,b)=>by(a[0].k)-by(b[0].k)||a[1]-b[1]).map(x=>x[0]); };
window.KCS={render,sv,tx,ar,ladder,LADDER,order};
})();
