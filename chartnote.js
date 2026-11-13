/* Birdbird – chartnote.js: a plain-language frame around a lab chart.
   CN.add(canvas, {read, take, full, tog, status}) puts a one-line "How to read" above the chart,
   one "Takeaway" sentence below it, and (optionally) a quiet "Show full chart" toggle.
   The chart's own draw code asks CN.full(key) to decide whether to draw the secondary layers.
   Strings are {en,no} objects and follow the lab language. <abbr class="cn-t" data-tip="…"> terms
   expand on tap (title on hover). No per-frame work: text is written only when it changes. */
(function(){
'use strict';
if(window.CN) return;
const css=`
.cn{display:flex;flex-direction:column;min-width:0}
.cn-read{margin:0 0 6px;font-size:13px;line-height:1.45;color:var(--ink-2)}
.cn-read b{color:var(--ink);font-weight:600}
.cn-foot{display:flex;align-items:flex-start;gap:10px 14px;margin-top:8px;flex-wrap:wrap}
.cn-take{flex:1 1 260px;margin:0;font-size:13.5px;line-height:1.45;color:var(--ink);border-left:2px solid var(--accent);padding:1px 0 1px 10px}
.cn-take b{font-weight:600}
.cn-stat{margin:6px 0 0;font-size:13px;line-height:1.4;color:var(--ink);font-weight:500}
.cn-stat i{font-style:normal;display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:0;background:var(--c,#71CC93)}
.cn-tog{flex:0 0 auto;margin-left:auto;font:inherit;font-size:12.5px;font-weight:500;color:var(--ink-2);background:transparent;border:1px solid var(--rule);border-radius:var(--radius,4px);padding:4px 10px;cursor:pointer;white-space:nowrap}
.cn-tog:hover{color:var(--ink);background:var(--wash)}
.cn-tog[aria-pressed="true"]{color:var(--ink);border-color:var(--ink-3)}
.cn-tog::before{content:"+ ";font-family:var(--f-mono,monospace)}
.cn-tog[aria-pressed="true"]::before{content:"− "}
abbr.cn-t{text-decoration:underline dotted;text-underline-offset:3px;cursor:help}
abbr.cn-t.open::after{content:" (" attr(data-tip) ")";color:var(--ink-2);font-weight:400}
.cn-in .cn-read,.cn-in.cn-read{margin-top:6px;color:inherit;opacity:.82}
.cn-in .cn-read b,.cn-in.cn-read b,.cn-in .cn-take,.cn-in.cn-take{color:inherit}
.cn-in .cn-tog,.cn-in.cn-tog{color:inherit;opacity:.8;border-color:rgba(127,140,150,.45)}
.cn-in .cn-tog:hover,.cn-in.cn-tog:hover{background:rgba(127,140,150,.15);opacity:1}
@media (max-width:640px){.cn-take{flex-basis:100%}.cn-tog{margin-left:0}}
`;
const sty=document.createElement('style'); sty.textContent=css; document.head.appendChild(sty);
const L=o=>o?(typeof o==='function'?o():typeof o==='string'?o:window.LAB?LAB.L(o):o.en):'';
const FULL={}, items=[];
const RD={en:'How to read',no:'Slik leser du den'}, TK={en:'Takeaway',no:'Ta med deg'};
const SHOW={en:'Show full chart',no:'Vis hele diagrammet'};
function draw(it){
  if(it.r) it.r.innerHTML=`<b>${L(RD)}:</b> ${L(it.o.read)}`;
  if(it.t) it.t.innerHTML=`<b>${L(TK)}:</b> ${L(it.o.take)}`;
  if(it.b){ it.b.textContent=L(it.o.tog||SHOW); it.b.setAttribute('aria-pressed',String(!!FULL[it.k])); }
  if(it.s&&it.sv!=null) it.s.innerHTML=it.sv;
}
function add(cv,o){
  cv=typeof cv==='string'?document.getElementById(cv):cv; if(!cv) return null;
  const k=o.key||cv.id; FULL[k]=!!o.on;
  let box=cv.closest('.view'), wrap;
  if(box){ wrap=document.createElement('div'); wrap.className='cn'; box.parentNode.insertBefore(wrap,box); wrap.appendChild(box); }
  else { box=cv; wrap=cv.parentNode; wrap.classList.add('cn-in'); }
  let r=null; if(o.read){ r=document.createElement('p'); r.className='cn-read'; box.parentNode.insertBefore(r,box); }
  let s=null; if(o.status){ s=document.createElement('p'); s.className='cn-stat'; s.setAttribute('aria-live','polite'); box.after(s); }
  const f=document.createElement('div'); f.className='cn-foot'; (s||box).after(f);
  let t=null; if(o.take){ t=document.createElement('p'); t.className='cn-take'; f.appendChild(t); }
  let b=null; if(o.full){ b=document.createElement('button'); b.type='button'; b.className='cn-tog'; f.appendChild(b);
    b.addEventListener('click',()=>{ FULL[k]=!FULL[k]; b.setAttribute('aria-pressed',String(FULL[k])); o.full(FULL[k]); }); }
  const it={k,o,r,t,b,s,sv:null}; items.push(it); draw(it);
  return { refresh(){ draw(it); }, status(html,col){ const v=(col?`<i style="--c:${col}"></i>`:'')+html; if(v===it.sv) return; it.sv=v; if(s) s.innerHTML=v; }, get full(){ return FULL[k]; } };
}
/* tap to expand a term (hover shows the title) */
document.addEventListener('click',e=>{ const a=e.target.closest('abbr.cn-t'); if(a) a.classList.toggle('open'); });
/* a term with its explanation: CN.t('VA', {en:'…',no:'…'}) */
function term(s,tip){ const x=L(tip).replace(/"/g,'&quot;'); return `<abbr class="cn-t" title="${x}" data-tip="${x}" tabindex="0">${s}</abbr>`; }
function init(){ if(window.LAB) LAB.onLang(()=>items.forEach(draw)); }
if(window.LAB) init(); else document.addEventListener('DOMContentLoaded',init);
window.CN={ add, full:k=>!!FULL[k], t:term };
})();
