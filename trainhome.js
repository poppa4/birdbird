/* NORDAP – shared home for the trainers (IFR trainer, Radio). Styles: trainhome.css.
   TRAINHOME.track(box, current, onPick)       the two tracks: Learn the basics / Refresher for pilots
   TRAINHOME.promise(box, items)               the three numbered steps under the lead
   TRAINHOME.guideBtn()                        markup for the "Guide me" button
   TRAINHOME.guide(cfg)                        a short dialog: two or three questions, then one place to start
     cfg = {title, steps:[{id, q:{en,no}, sub?, opts:[{v, t:{en,no}, d:{en,no}}], when?(answers)}],
            result(answers) -> {t:{en,no}, why:{en,no}, plan?:[{en,no}], go:{label:{en,no}, run()}, alt?:{label, run()}}} */
(function(){
'use strict';
const L=o=>LAB.L(o);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const TRACKS=[['basics',{en:'Learn the basics',no:'Lær det grunnleggende'}],['refresh',{en:'Refresher for pilots',no:'Oppfriskning for piloter'}]];

function track(box,cur,subs,onPick){ if(!box) return;
  box.setAttribute('role','tablist');
  box.innerHTML=TRACKS.map(([k,t])=>`<button type="button" role="tab" data-m="${k}" aria-selected="${cur===k}"><b>${esc(L(t))}</b><span>${esc(L(subs[k]))}</span></button>`).join('');
  box.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ if(b.dataset.m!==cur) onPick(b.dataset.m); }); }

function promise(box,items){ if(!box) return;
  box.innerHTML=items.map(([a,b],i)=>`<li><i>${i+1}</i><b>${esc(L(a))}</b><span>${esc(L(b))}</span></li>`).join(''); }

const ICON='<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.6 5.4 9.1 9.1 5.4 10.6 6.9 6.9z" fill="currentColor"/></svg>';
function guideBtn(id){ return `<button class="btn2 thgbtn lg" type="button" id="${id||'thGuide'}" aria-haspopup="dialog">${ICON}${esc(L({en:'Guide me',no:'Guide meg'}))}</button>`; }

let dlg=null;
function guide(cfg){
  if(!dlg){ dlg=document.createElement('dialog'); dlg.className='thg'; dlg.setAttribute('aria-labelledby','thgH'); document.body.appendChild(dlg);
    dlg.addEventListener('click',e=>{ if(e.target===dlg) dlg.close(); }); }
  const ans={}; let hist=[];
  const steps=()=>cfg.steps.filter(s=>!s.when||s.when(ans));
  const head=(i,n)=>`<div class="top"><span class="k">${esc(L(cfg.title))}</span><span class="bar" aria-hidden="true">${Array.from({length:n},(_,k)=>`<i class="${k<=i?'on':''}"></i>`).join('')}</span><button class="x" type="button" data-x aria-label="${esc(L({en:'Close',no:'Lukk'}))}">×</button></div>`;
  const wire=()=>{ dlg.querySelector('[data-x]').onclick=()=>dlg.close(); const bk=dlg.querySelector('[data-back]'); if(bk) bk.onclick=()=>{ const id=hist.pop(); delete ans[id]; draw(); }; };
  function draw(){
    const ss=steps(), s=ss.find(x=>ans[x.id]==null), n=ss.length+1;
    if(s){ const i=ss.indexOf(s);
      dlg.innerHTML=`<div class="in">${head(i,n)}<h2 id="thgH">${esc(L(s.q))}</h2>${s.sub?`<p class="sub">${esc(L(s.sub))}</p>`:''}
        <div class="opts">${s.opts.map(o=>`<button class="opt" type="button" data-v="${esc(o.v)}"><b>${esc(L(o.t))}</b>${o.d?`<span>${esc(L(o.d))}</span>`:''}</button>`).join('')}</div>
        ${hist.length?`<button class="back" type="button" data-back>← ${esc(L({en:'Back',no:'Tilbake'}))}</button>`:''}</div>`;
      dlg.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{ ans[s.id]=b.dataset.v; hist.push(s.id); draw(); });
      wire(); const f=dlg.querySelector('.opt'); if(f) f.focus(); return; }
    const r=cfg.result(ans);
    dlg.innerHTML=`<div class="in">${head(n-1,n)}<h2 id="thgH">${esc(L({en:'Start here',no:'Start her'}))}</h2>
      <div class="res"><b>${esc(L(r.t))}</b><p>${esc(L(r.why))}</p>${r.plan&&r.plan.length?`<ol>${r.plan.map(p=>`<li>${esc(L(p))}</li>`).join('')}</ol>`:''}</div>
      <div class="acts"><button class="btn2 pri" type="button" data-go>${esc(L(r.go.label))}</button>${r.alt?`<button class="btn2" type="button" data-alt>${esc(L(r.alt.label))}</button>`:''}</div>
      <button class="back" type="button" data-back>← ${esc(L({en:'Change my answers',no:'Endre svarene'}))}</button></div>`;
    dlg.querySelector('[data-go]').onclick=()=>{ dlg.close(); r.go.run(); };
    if(r.alt) dlg.querySelector('[data-alt]').onclick=()=>{ dlg.close(); r.alt.run(); };
    wire(); dlg.querySelector('[data-go]').focus();
    if(cfg.done) cfg.done(ans,r);
  }
  draw(); if(!dlg.open) dlg.showModal();
}
window.TRAINHOME={track,promise,guideBtn,guide,esc};
})();
