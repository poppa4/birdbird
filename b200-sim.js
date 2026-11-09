/* Birdbird – King Air B200 type rating trainer: cockpit system simulators.
   Teaching models of the system logic a type-rating candidate must master. Own drawings and simplified
   behaviour; numbers are typical B200 values for learning only. Verify everything in your AFM/POH. */
(function(G){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf=(v,d)=>Number.isFinite(v)?v.toLocaleString('en-GB',{minimumFractionDigits:d||0,maximumFractionDigits:d||0}):'–';

/* ---------- shared UI ---------- */
function row(box,label,items,v,on){ const w=document.createElement('div'); w.className='srow'; w.innerHTML=`<span>${esc(label)}</span><div></div>`; box.appendChild(w);
  const s=w.querySelector('div'); s.classList.add('seg');
  const api={v:String(v),set(x){ api.v=String(x); draw(); }};
  function draw(){ s.innerHTML=items.map(([k,t])=>`<button type="button" data-v="${k}" class="${String(k)===api.v?'on':''}">${esc(t)}</button>`).join(''); }
  s.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; api.v=b.dataset.v; draw(); on&&on(api.v); });
  draw(); return api; }
function slider(box,o){ const w=document.createElement('div'); w.className='ctl'; const id='s'+Math.random().toString(36).slice(2);
  w.innerHTML=`<label for="${id}"><span>${esc(o.label)}</span><output></output></label><input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step}" value="${o.v}">`;
  box.appendChild(w); const inp=w.querySelector('input'), out=w.querySelector('output');
  const api={get v(){ return +inp.value; },set(x){ inp.value=x; out.textContent=o.f(+inp.value); },inp};
  out.textContent=o.f(+inp.value); inp.addEventListener('input',()=>{ out.textContent=o.f(+inp.value); o.on&&o.on(+inp.value); }); return api; }
function chk(box,label,on){ const l=document.createElement('label'); l.className='chk'; l.innerHTML=`<input type="checkbox"> ${esc(label)}`; box.appendChild(l); const i=l.querySelector('input'); i.addEventListener('change',()=>on&&on(i.checked)); return {get v(){ return i.checked; },set(x){ i.checked=!!x; }}; }
function grp(box,t){ const d=document.createElement('div'); d.className='grp'; d.textContent=t; box.appendChild(d); return d; }
function btns(box,list){ const d=document.createElement('div'); d.className='btns'; d.style.margin='4px 0 6px'; list.forEach(([t,f,cls])=>{ const b=document.createElement('button'); b.type='button'; b.className='btn '+(cls||''); b.textContent=t; b.onclick=f; d.appendChild(b); }); box.appendChild(d); return d; }
/* annunciators: [label, colour r|a|g, lit] */
function ann(box,list){ const anyR=list.some(x=>x[1]==='r'&&x[2]), anyA=list.some(x=>x[1]==='a'&&x[2]&&!x[3]);
  box.innerHTML=`<div class="mflash"><span class="${anyR?'r on':'r'}">MASTER WARNING</span><span class="${anyA?'a on':'a'}">MASTER CAUTION</span></div><div class="ann">${list.map(([t,c,on])=>`<span class="${on?c+' on':''}">${esc(t)}</span>`).join('')}</div>`; }
function notice(box,items){ box.innerHTML=`<b>What to notice</b><ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul>`; }
/* run a loop only while the element is on screen and the tab is visible */
function loop(elm,step){ let on=false, raf=0, last=0; const f=t=>{ if(!on) return; const dt=last?Math.min(0.1,(t-last)/1000):0; last=t; step(dt); raf=requestAnimationFrame(f); };
  const api={start(){ if(on) return; on=true; last=0; raf=requestAnimationFrame(f); },stop(){ on=false; cancelAnimationFrame(raf); },get on(){ return on; }};
  new IntersectionObserver(es=>{ const vis=es[0].isIntersecting&&elm.offsetParent!==null; if(vis&&api.want) api.start(); else api.stop(); }).observe(elm);
  api.want=true; return api; }
function canvasFit(cv,draw){ const st={w:0,h:0,ctx:cv.getContext('2d')}; const rs=()=>{ if(!cv.clientWidth) return; const d=Math.min(window.devicePixelRatio||1,2); st.w=cv.clientWidth; st.h=cv.clientHeight; cv.width=st.w*d; cv.height=st.h*d; st.ctx.setTransform(d,0,0,d,0,0); draw(); }; new ResizeObserver(rs).observe(cv); return st; }

/* =====================================================================
   (a) ELECTRICAL
   ===================================================================== */
function elec(root){
  root.innerHTML=`<p class="lead">A 28-volt DC aircraft. One battery and two starter-generators feed a group of buses that are tied together through current limiters, so that one fault cannot take everything with it. Fail things and watch which buses stay powered, what the loadmeters do and which lights come on.</p>
  <div class="simgrid"><div class="simview"><div class="view svgwrap"><svg viewBox="0 0 640 350" class="schem" role="img" aria-label="Simplified DC electrical system: battery, two generators, generator buses, centre bus, dual-fed buses and inverters"></svg></div>
    <div class="annp" data-ann></div>
    <div class="ro meters" data-ro></div></div>
    <div class="panel" data-ctl></div></div>
  <div class="cols"><div class="box"><b class="t">What still works</b><ul class="works" data-works></ul></div><div class="box"><b class="t">What is happening</b><div data-expl class="expl"></div></div></div>
  <div class="notice" data-notice></div>`;
  const svg=root.querySelector('svg'), ctl=root.querySelector('[data-ctl]');
  const S={bat:'on',g1:'on',g2:'on',eng:'both',gpu:'off',inv:'1',ph:'cruise',load:150,f1:'ok',f2:'ok',limL:false,limR:false,batF:false,inv1F:false,inv2F:false,shed:false};
  grp(ctl,'Scenarios');
  btns(ctl,[['Normal cruise',()=>preset({})],['Gen 1 fails',()=>preset({f1:'fail'})],['Gen 2 trips',()=>preset({f2:'trip'})],['Both gens fail',()=>preset({f1:'fail',f2:'fail'})],['Left limiter open',()=>preset({limL:true})],['Before start, battery',()=>preset({eng:'none',ph:'ground',load:60})],['GPU on ground',()=>preset({eng:'none',ph:'ground',gpu:'on',load:120})]]);
  grp(ctl,'Master switch (gang bar)');
  const cB=row(ctl,'BAT',[['on','ON'],['off','OFF']],S.bat,v=>{ S.bat=v; upd(); });
  const cG1=row(ctl,'GEN 1',[['on','ON'],['off','OFF']],S.g1,v=>{ S.g1=v; upd(); });
  const cG2=row(ctl,'GEN 2',[['on','ON'],['off','OFF']],S.g2,v=>{ S.g2=v; upd(); });
  btns(ctl,[['GEN 1 RESET',()=>reset(1)],['GEN 2 RESET',()=>reset(2)]]);
  grp(ctl,'Situation');
  const cE=row(ctl,'Engines running',[['both','Both'],['l','Left'],['r','Right'],['none','None']],S.eng,v=>{ S.eng=v; upd(); });
  const cP=row(ctl,'Phase',[['ground','Ground'],['cruise','≤ FL310'],['high','> FL310']],S.ph,v=>{ S.ph=v; upd(); });
  const cX=row(ctl,'Ground power',[['off','Not connected'],['on','Connected']],S.gpu,v=>{ S.gpu=v; upd(); });
  const cI=row(ctl,'Inverter select',[['1','No. 1'],['2','No. 2']],S.inv,v=>{ S.inv=v; upd(); });
  const cL=slider(ctl,{label:'Total DC load',min:40,max:330,step:5,v:S.load,f:v=>v+' A',on:v=>{ S.load=v; upd(); }});
  const cS=chk(ctl,'Load shed (non-essential loads off)',v=>{ S.shed=v; upd(); });
  grp(ctl,'Failures');
  const cF1=row(ctl,'Generator 1',[['ok','Normal'],['trip','Trips off'],['fail','Failed']],S.f1,v=>{ S.f1=v; upd(); });
  const cF2=row(ctl,'Generator 2',[['ok','Normal'],['trip','Trips off'],['fail','Failed']],S.f2,v=>{ S.f2=v; upd(); });
  const fw=document.createElement('div'); fw.className='sw'; ctl.appendChild(fw);
  const cLL=chk(fw,'Left 325 A limiter open',v=>{ S.limL=v; upd(); }), cLR=chk(fw,'Right 325 A limiter open',v=>{ S.limR=v; upd(); });
  const cBF=chk(fw,'Battery fault',v=>{ S.batF=v; upd(); }), cI1=chk(fw,'No. 1 inverter fails',v=>{ S.inv1F=v; upd(); }), cI2=chk(fw,'No. 2 inverter fails',v=>{ S.inv2F=v; upd(); });
  let msg='';
  function reset(n){ const k='f'+n; if(S[k]==='trip'){ S[k]='ok'; (n===1?cF1:cF2).set('ok'); msg=`GEN ${n} held in RESET for a second, then ON: the fault was a trip, so the generator is back on line.`; }
    else if(S[k]==='fail'){ msg=`GEN ${n} reset attempted: no change. A real internal fault will not reset. Switch it OFF and manage the load on the remaining generator.`; } else msg=`GEN ${n} is already working; reset does nothing.`; upd(true); }
  function preset(p){ Object.assign(S,{bat:'on',g1:'on',g2:'on',eng:'both',gpu:'off',inv:'1',ph:'cruise',load:150,f1:'ok',f2:'ok',limL:false,limR:false,batF:false,inv1F:false,inv2F:false,shed:false},p);
    cB.set(S.bat);cG1.set(S.g1);cG2.set(S.g2);cE.set(S.eng);cP.set(S.ph);cX.set(S.gpu);cI.set(S.inv);cL.set(S.load);cS.set(S.shed);cF1.set(S.f1);cF2.set(S.f2);cLL.set(S.limL);cLR.set(S.limR);cBF.set(S.batF);cI1.set(S.inv1F);cI2.set(S.inv2F); msg=''; upd(); }
  function model(){
    const e1=S.eng==='both'||S.eng==='l', e2=S.eng==='both'||S.eng==='r';
    const G1=e1&&S.g1==='on'&&S.f1==='ok', G2=e2&&S.g2==='on'&&S.f2==='ok';
    const batOK=!S.batF, B=S.bat==='on'&&batOK, GPU=S.gpu==='on'&&S.bat==='on';
    // nodes: L gen bus, centre (main battery + isolation bus), R gen bus. Limiters join them.
    const isoSrc=B||GPU, Lc=!S.limL, Rc=!S.limR;
    const isoGen=(G1&&Lc)||(G2&&Rc);
    const iso=isoSrc||isoGen;
    const L=G1||(Lc&&iso), R=G2||(Rc&&iso);
    const hot=batOK||(S.bat==='on'&&iso);
    const dual=L||R;
    const inv1=L&&!S.inv1F, inv2=R&&!S.inv2F; const ac=S.inv==='1'?inv1:inv2;
    let load=S.shed? Math.round(S.load*0.55) : S.load; if(!dual) load=Math.min(load,8);
    // loads: 20 % on each generator bus alone, 60 % shared (dual-fed and centre)
    const lOnly=L?load*0.2:0, rOnly=R?load*0.2:0, shared=dual?load*0.6:0;
    const charge=(G1||G2||GPU)&&B? (S.ph==='ground'&&S.eng!=='none'?18:4) : 0;
    let a1=0,a2=0,aB=0,aX=0;
    const g1Feeds=G1, g2Feeds=G2;
    if(GPU&&!G1&&!G2){ aX=lOnly+rOnly+shared+charge; }
    else if(g1Feeds||g2Feeds){
      // own bus loads
      if(G1) a1+=lOnly; else if(L){ if(G2&&Lc&&Rc) a2+=lOnly; else if(B) aB+=lOnly; }
      if(G2) a2+=rOnly; else if(R){ if(G1&&Lc&&Rc) a1+=rOnly; else if(B) aB+=rOnly; }
      // shared (dual-fed get both sides through diodes)
      if(G1&&G2){ a1+=shared/2; a2+=shared/2; } else if(G1) a1+=shared; else a2+=shared;
      const chg=charge; if(G1&&Lc&&G2&&Rc){ a1+=chg/2; a2+=chg/2; } else if(G1&&Lc) a1+=chg; else if(G2&&Rc) a2+=chg;
      aB= aB? -aB : (B&&((G1&&Lc)||(G2&&Rc))? chg : 0);
    } else if(B){ aB=-(lOnly+rOnly+shared); }
    const lim=S.ph==='ground'?85:S.ph==='high'?88:100;
    const p1=a1/250*100, p2=a2/250*100;
    const vBus=(G1||G2||GPU)?28.2:(B?24.1:0);
    const endur= aB<0? Math.round(42*0.75/(-aB)*60) : null;
    return {e1,e2,G1,G2,B,GPU,iso,L,R,hot,dual,inv1,inv2,ac,a1,a2,aB,aX,p1,p2,lim,vBus,endur,load,batOK};
  }
  function upd(keepMsg){ if(!keepMsg) msg=''; const m=model(); draw(m);
    const lit=[['L DC GEN','a',!m.G1],['R DC GEN','a',!m.G2],['INVERTER','r',m.dual&&!m.ac],['EXT PWR','a',S.gpu==='on'],['L GEN OVHT','r',false],['R GEN OVHT','r',false]];
    ann(root.querySelector('[data-ann]'),lit.map(x=>[x[0],x[1],x[2]&&(m.hot||m.iso)]));
    const ro=root.querySelector('[data-ro]');
    const cls=p=>p>m.lim?'bad':p>m.lim-10?'warn':'';
    ro.innerHTML=`<div class="rrow"><span>Gen 1 loadmeter</span><b class="${cls(m.p1)}">${m.G1?nf(m.p1)+' % ('+nf(m.a1)+' A)':'0 % (off line)'}</b></div>
      <div class="rrow"><span>Gen 2 loadmeter</span><b class="${cls(m.p2)}">${m.G2?nf(m.p2)+' % ('+nf(m.a2)+' A)':'0 % (off line)'}</b></div>
      <div class="rrow"><span>Battery ammeter</span><b class="${m.aB<0?'warn':''}">${m.B?(m.aB>0?'+':'')+nf(m.aB)+' A':'–'}</b></div>
      <div class="rrow"><span>Bus voltage</span><b>${m.vBus?nf(m.vBus,1)+' V':'0 V'}</b></div>
      <div class="rrow"><span>Generator load limit now</span><b>${m.lim} %</b></div>
      ${m.endur!=null?`<div class="rrow"><span>Battery only: rough endurance</span><b class="bad">≈ ${m.endur} min</b></div>`:''}`;
    const W=[[m.hot,'Hot battery bus: fire extinguishers, firewall shutoff valves, entry lights, clock'],[m.iso,'Centre bus (main battery and isolation bus): starter path, links the two sides'],[m.L,'Left generator bus: No. 1 inverter and heavy left-side loads'],[m.R,'Right generator bus: No. 2 inverter and heavy right-side loads'],[m.dual,'Dual-fed buses: most DC equipment, paired L/R items split between them'],[m.ac,'AC (selected inverter): AC-powered engine and avionics indications']];
    root.querySelector('[data-works]').innerHTML=W.map(([on,t])=>`<li class="${on?'y':'n'}">${t}</li>`).join('');
    root.querySelector('[data-expl]').innerHTML=(msg?`<p class="callout blue">${esc(msg)}</p>`:'')+explain(m).map(x=>`<p>${x}</p>`).join('');
  }
  function explain(m){ const o=[];
    if(!m.hot&&!m.iso) return ['Nothing is powered. With the battery switch off and no generator on line, only an intact battery keeps the hot battery bus alive.'];
    if(S.bat==='off'&&(m.G1||m.G2)) o.push('<b>Battery switch OFF with generators on line:</b> the generators still power the buses, but the battery is no longer charged and is not available as a backup if both generators drop off.');
    if(m.GPU&&!m.G1&&!m.G2) o.push('<b>Ground power:</b> the external power relay only closes with the battery switch ON, correct polarity and a voltage that is not too high (on most serials). The GPU feeds the centre bus and from there the whole system. Start on GPU when you can: it spares the battery and gives a cooler start.');
    if(S.gpu==='on'&&S.bat==='off') o.push('<b>GPU connected but BAT OFF:</b> on most serials the external power relay will not close. The battery switch has to be ON.');
    if(m.G1&&m.G2&&!S.limL&&!S.limR) o.push('Both generators are on line and paralleled through the centre bus, sharing the load roughly equally. The battery is being charged; a small positive charge rate is what you want before take-off.');
    if(!m.G1!==!m.G2&&(m.G1||m.G2)){ const w=m.G1?1:2, d=w===1?2:1; o.push(`<b>Generator ${d} off line:</b> DC GEN light on its side. Generator ${w} now carries the whole load (${nf(w===1?m.p1:m.p2)} %). Check it is within the limit (${m.lim} % in this phase); the limit is lower on the ground and at high altitude. Reset once; if it does not come back, switch it OFF and reduce load if needed.`); }
    if(!m.G1&&!m.G2&&m.B&&!m.GPU&&S.eng!=='none') o.push('<b>Both generators off line:</b> the battery is now the only source and is discharging. Shed every non-essential load, try a reset of each generator once, and land at the nearest suitable airport. Endurance depends entirely on the load you leave on.');
    if(S.limL||S.limR){ const s=S.limL?'left':'right'; o.push(`<b>The ${s} current limiter is open:</b> that generator bus is cut from the centre bus. Its generator still runs its own bus and still feeds the dual-fed buses through the diodes, so little is lost, but the battery is no longer charged from that side${(S.limL&&!m.G1)||(S.limR&&!m.G2)?' and, because that generator is also off, the isolated bus has lost power':''}. Indication varies by serial: watch the bus voltage and what goes dark.`); }
    if(S.batF) o.push('<b>Battery fault:</b> the hot battery bus now depends on the generators through the battery relay. If the generators are lost as well, the fire extinguishers and firewall valves lose power.');
    if(m.dual&&!m.ac) o.push('<b>INVERTER warning:</b> the selected inverter has no output. Select the other one. AC-powered indications return as soon as the other inverter runs.');
    if(m.dual&&m.ac&&(S.inv1F||S.inv2F)) o.push('One inverter has failed but the selected one is fine, so there is no warning. That is why you check both inverters before flight.');
    if(S.ph==='ground'&&(m.p1>85||m.p2>85)) o.push('<b>Ground load:</b> above about 85 % on the ground the generator lacks cooling air. Increase N1 or reduce the load.');
    if(!o.length) o.push('Normal.');
    return o; }
  function draw(m){
    const on='#35c27a', off='#3a4752', txt='#d6dee5', dim='#7d8a94';
    const ln=(x1,y1,x2,y2,p,w)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${p?on:off}" stroke-width="${w||3}" stroke-linecap="round"/>`;
    const box=(x,y,w,h,t,p,sub,warn)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${p?'#123526':'#1b252d'}" stroke="${warn?'#e0a100':p?on:off}" stroke-width="1.6"/><text x="${x+w/2}" y="${y+h/2+(sub?-2:5)}" text-anchor="middle" fill="${p?txt:dim}" font-size="14" font-weight="600">${t}</text>${sub?`<text x="${x+w/2}" y="${y+h/2+14}" text-anchor="middle" fill="${dim}" font-size="11">${sub}</text>`:''}`;
    const bus=(x1,x2,y,t,p,tx,anc,ty)=>`<rect x="${x1}" y="${y-6}" width="${x2-x1}" height="12" rx="2" fill="${p?on:off}"/><text x="${tx}" y="${ty||y-12}" text-anchor="${anc}" fill="${p?txt:dim}" font-size="12">${t}</text>`;
    const lim=(x,y,open,p)=>`<rect x="${x-14}" y="${y-10}" width="28" height="20" rx="3" fill="#0f171d" stroke="${open?'#e05a47':p?on:off}" stroke-width="1.6"/>${open?`<path d="M${x-8} ${y-6}L${x+8} ${y+6}M${x+8} ${y-6}L${x-8} ${y+6}" stroke="#e05a47" stroke-width="2"/>`:`<text x="${x}" y="${y+4}" text-anchor="middle" fill="${dim}" font-size="9">325A</text>`}`;
    let s='';
    // generators and battery
    s+=ln(70,72,70,142,m.G1)+ln(570,72,570,142,m.G2)+ln(320,92,320,142,m.B||m.GPU||m.iso&&S.bat==='on')+ln(320,60,320,72,m.hot);
    s+=box(20,20,100,52,'GEN 1',m.G1,m.G1?'on line':(m.e1?'off line':'engine off'),!m.G1&&m.e1)+box(520,20,100,52,'GEN 2',m.G2,m.G2?'on line':(m.e2?'off line':'engine off'),!m.G2&&m.e2);
    s+=box(262,72,116,40,'BATTERY',m.B,S.batF?'fault':(S.bat==='on'?'relay closed':'switch off'),S.batF);
    s+=box(262,14,116,40,'HOT BAT BUS',m.hot);
    s+=box(420,82,78,36,'GPU',m.GPU,S.gpu==='on'?(S.bat==='on'?'connected':'relay open'):'—')+ln(420,100,378,100,m.GPU,2);
    // gen buses + centre bus with limiters
    s+=bus(20,190,148,'LEFT GEN BUS',m.L,80,'start')+bus(450,620,148,'RIGHT GEN BUS',m.R,560,'end')+bus(250,390,148,'CENTRE BUS',m.iso,320,'middle',170);
    s+=ln(190,148,206,148,m.L&&!S.limL)+ln(234,148,250,148,m.iso&&!S.limL)+lim(220,148,S.limL,m.L&&m.iso)+ln(390,148,406,148,m.iso&&!S.limR)+ln(434,148,450,148,m.R&&!S.limR)+lim(420,148,S.limR,m.R&&m.iso);
    // dual-fed buses
    [0,1,2,3].forEach(i=>{ const y=196+i*24; s+=`<rect x="232" y="${y-5}" width="176" height="10" rx="2" fill="${m.dual?on:off}"/><text x="320" y="${y+4}" text-anchor="middle" fill="#0f171d" font-size="9" font-weight="700">DUAL-FED ${i+1}</text>`;
      s+=ln(150,154,150,y,m.L,2)+ln(150,y,232,y,m.L,2)+ln(490,154,490,y,m.R,2)+ln(408,y,490,y,m.R,2);
      s+=`<path d="M${206} ${y-5}L${214} ${y}L${206} ${y+5}Z" fill="${m.L?on:off}"/><path d="M${434} ${y-5}L${426} ${y}L${434} ${y+5}Z" fill="${m.R?on:off}"/>`; });
    // inverters + AC
    s+=ln(60,154,60,286,m.L,2)+ln(580,154,580,286,m.R,2);
    s+=box(20,286,84,40,'INV 1',m.inv1&&S.inv==='1',S.inv1F?'failed':(S.inv==='1'?'selected':'standby'),S.inv1F)+box(536,286,84,40,'INV 2',m.inv2&&S.inv==='2',S.inv2F?'failed':(S.inv==='2'?'selected':'standby'),S.inv2F);
    s+=box(262,300,116,36,'AC 115/26 V',m.ac);
    s+=ln(104,318,262,318,m.ac&&S.inv==='1',2)+ln(378,318,536,318,m.ac&&S.inv==='2',2);
    s+=`<text x="320" y="185" text-anchor="middle" fill="${dim}" font-size="9.5">diodes keep a fault on one side from back-feeding</text>`;
    svg.innerHTML=s; }
  notice(root.querySelector('[data-notice]'),[
    'The battery switch only connects the battery to the centre bus. The hot battery bus is live whenever the battery is fitted and charged, so the fire extinguishers and firewall valves never depend on a switch.',
    'With one generator failed the other takes the whole load through the centre bus and limiters. Watch its loadmeter against the limit, which is lower on the ground and above FL310.',
    'An open current limiter splits the system rather than killing it: the dual-fed buses still get power from both sides through diodes.',
    'With both generators lost, the battery has a limited life. Load shedding is what buys time.',
    'Only one inverter runs at a time. A failure of the one you are not using gives no warning, so both are checked before flight.']);
  upd();
}

/* =====================================================================
   (b) FUEL
   ===================================================================== */
function fuel(root){
  root.innerHTML=`<p class="lead">Each wing is its own fuel system feeding its own engine. The engine always draws from the nacelle tank; the wing tanks top it up by gravity, and the auxiliary tank, used first, is pumped into it by a jet pump driven by fuel pressure. Run the clock and watch the order in which the tanks empty.</p>
  <div class="simgrid"><div class="simview"><div class="view svgwrap"><svg viewBox="0 0 640 300" class="schem" role="img" aria-label="Fuel system for both wings: auxiliary, wing and nacelle tanks, pumps, crossfeed and firewall valves"></svg></div>
    <div class="annp" data-ann></div><div class="ro meters" data-ro></div></div>
    <div class="panel" data-ctl></div></div>
  <div class="box"><b class="t">What is happening</b><div data-expl class="expl"></div></div>
  <div class="notice" data-notice></div>`;
  const svg=root.querySelector('svg'), ctl=root.querySelector('[data-ctl]');
  const FULL={aux:529,wing:911,nac:382};
  let F; function init(){ F={t:0,run:false,warp:60,side:[0,1].map(()=>({aux:FULL.aux,wing:FULL.wing,nac:FULL.nac,eng:true,ffw:true,stby:false,bpF:false,mfF:false,ovr:false,xfer:false,grav:false,burn:0})),xf:'off',ff:330,log:[]}; }
  init();
  grp(ctl,'Clock');
  const bb=btns(ctl,[['Run',()=>{ F.run=!F.run; bb.firstChild.textContent=F.run?'Pause':'Run'; if(F.run) L.start(); }],['Reset',()=>{ init(); syncCtl(); bb.firstChild.textContent='Run'; upd(); }]]);
  const cW=row(ctl,'Time speed',[['60','1 min/s'],['300','5 min/s']],'60',v=>{ F.warp=+v; });
  const cFF=slider(ctl,{label:'Fuel flow per engine',min:120,max:600,step:10,v:330,f:v=>v+' lb/h',on:v=>{ F.ff=v; upd(); }});
  grp(ctl,'Fuel panel');
  const cSL=row(ctl,'L standby pump',[['off','OFF'],['on','ON']],'off',v=>{ F.side[0].stby=v==='on'; upd(); });
  const cSR=row(ctl,'R standby pump',[['off','OFF'],['on','ON']],'off',v=>{ F.side[1].stby=v==='on'; upd(); });
  const cX=row(ctl,'Crossfeed',[['off','OFF'],['lr','L tanks → R eng'],['rl','R tanks → L eng']],'off',v=>{ F.xf=v; upd(); });
  const cOL=row(ctl,'L aux transfer',[['auto','AUTO'],['ovr','OVERRIDE']],'auto',v=>{ F.side[0].ovr=v==='ovr'; upd(); });
  const cOR=row(ctl,'R aux transfer',[['auto','AUTO'],['ovr','OVERRIDE']],'auto',v=>{ F.side[1].ovr=v==='ovr'; upd(); });
  const cVL=row(ctl,'L firewall valve',[['open','OPEN'],['closed','CLOSED']],'open',v=>{ F.side[0].ffw=v==='open'; if(!F.side[0].ffw) F.side[0].eng=false; upd(); });
  const cVR=row(ctl,'R firewall valve',[['open','OPEN'],['closed','CLOSED']],'open',v=>{ F.side[1].ffw=v==='open'; if(!F.side[1].ffw) F.side[1].eng=false; upd(); });
  grp(ctl,'Failures');
  const fw=document.createElement('div'); fw.className='sw'; ctl.appendChild(fw);
  const cB1=chk(fw,'L engine-driven boost pump fails',v=>{ F.side[0].bpF=v; upd(); });
  const cM1=chk(fw,'L transfer control fails',v=>{ F.side[0].mfF=v; upd(); });
  const cE2=chk(fw,'R engine shut down',v=>{ F.side[1].eng=!v; upd(); });
  function syncCtl(){ cSL.set('off');cSR.set('off');cX.set('off');cOL.set('auto');cOR.set('auto');cVL.set('open');cVR.set('open');cB1.set(false);cM1.set(false);cE2.set(false);cFF.set(330); }
  const L=loop(root,dt=>{ if(F.run) step(dt*F.warp/3600); });
  function press(i){ const s=F.side[i]; const o=F.side[1-i]; // low-pressure supply to the engine on side i
    const own=(s.eng&&!s.bpF)||s.stby||(F.xf==='lr'&&i===0)||(F.xf==='rl'&&i===1); const xFrom=(F.xf==='lr'&&i===1)||(F.xf==='rl'&&i===0);
    return xFrom? true : own; }
  function motive(i){ const s=F.side[i]; return (s.eng&&!s.bpF)||s.stby||(F.xf==='lr'&&i===0)||(F.xf==='rl'&&i===1); }
  function step(h){ F.t+=h*3600;
    F.side.forEach((s,i)=>{ s.xfer=false; s.grav=false; });
    F.side.forEach((s,i)=>{ if(!s.eng) return; const from= F.xf==='lr'&&i===1? 0 : F.xf==='rl'&&i===0? 1 : i; const src=F.side[from];
      let need=F.ff*h; const take=Math.min(need,src.nac); src.nac-=take; s.burn+=take; if(take<need-1e-6){ s.eng=false; F.log.push(`${i?'Right':'Left'} engine flamed out: no fuel in the tank it was drawing from.`); } });
    F.side.forEach((s,i)=>{ const room=FULL.nac-s.nac; if(room<=0) return;
      const tx=s.aux>0&&motive(i)&&(!s.mfF||s.ovr); if(tx){ const q=Math.min(room,s.aux,1400*h); s.aux-=q; s.nac+=q; s.xfer=q>0; }
      const r2=FULL.nac-s.nac; if(r2>0&&s.wing>0){ const q=Math.min(r2,s.wing,2400*h); s.wing-=q; s.nac+=q; s.grav=q>0; } });
    upd(); }
  function upd(){ const S=F.side; const total=S.reduce((a,s)=>a+s.aux+s.wing+s.nac,0);
    const lp=[0,1].map(i=>S[i].eng&&!press(i));
    const noX=[0,1].map(i=>S[i].aux>1&&(S[i].mfF&&!S[i].ovr||!motive(i))&&(S[i].eng||S[i].stby));
    ann(root.querySelector('[data-ann]'),[['L FUEL PRESS','r',lp[0]],['R FUEL PRESS','r',lp[1]],['L NO TRANSFER','a',noX[0],1],['R NO TRANSFER','a',noX[1],1],['FUEL CROSSFEED','g',F.xf!=='off']]);
    const main=i=>S[i].wing+S[i].nac, side=i=>main(i)+S[i].aux, imb=Math.abs(side(0)-side(1));
    const burn=S.filter(s=>s.eng).length*F.ff; const hh=Math.floor(F.t/3600), mm=Math.floor(F.t/60)%60;
    root.querySelector('[data-ro]').innerHTML=`<div class="rrow"><span>Elapsed</span><b>${hh}:${String(mm).padStart(2,'0')} h</b></div>
      <div class="rrow"><span>Gauges L / R: MAIN</span><b>${nf(main(0))} / ${nf(main(1))} lb</b></div>
      <div class="rrow"><span>Gauges L / R: AUX</span><b>${nf(S[0].aux)} / ${nf(S[1].aux)} lb</b></div>
      <div class="rrow"><span>Total usable</span><b>${nf(total)} lb</b></div>
      <div class="rrow"><span>Imbalance (limit 1,000 lb)</span><b class="${imb>1000?'bad':imb>700?'warn':''}">${nf(imb)} lb</b></div>
      <div class="rrow"><span>Endurance at this flow</span><b>${burn?nf(total/burn,1)+' h':'–'}</b></div>
      <div class="rrow"><span>Take-off allowed (≥ 265 lb each gauge)</span><b class="${Math.min(main(0),main(1))<265?'bad':'good'}">${Math.min(main(0),main(1))<265?'No':'Yes'}</b></div>`;
    draw(lp); explain(lp,noX,imb); }
  function explain(lp,noX,imb){ const S=F.side, o=[];
    if(F.t===0) o.push('Full tanks: 79 US gal auxiliary and 193 US gal main per side (typical B200, about 3,640 lb usable in total). Press Run.');
    if(S.some(s=>s.xfer)) o.push('<b>Auxiliary fuel first:</b> boost-pump pressure drives the jet pump, which keeps the nacelle full from the auxiliary tank. The wing tanks do not move yet because the nacelle has no room for them.');
    if(S.some(s=>s.grav&&!s.xfer)) o.push('<b>Gravity feed:</b> with the auxiliary tank empty the wing tanks drain into the nacelle by gravity. The MAIN gauge now falls.');
    if(S.some((s,i)=>s.eng&&s.wing<1&&s.aux<1)) o.push('<b>Nacelle only:</b> once the wing is empty the nacelle tank level falls. This is the last fuel on that side.');
    if(lp[0]||lp[1]){ const i=lp[0]?0:1; o.push(`<b>${i?'R':'L'} FUEL PRESS:</b> low pressure on the engine inlet side. Switch the ${i?'right':'left'} standby pump ON; the light should go out. The engine-driven high-pressure pump can keep the engine running on suction for a while, but that time counts against the pump (typically 10 hours) and must be logged.`); }
    if(S[0].bpF&&S[0].stby) o.push('The standby pump has taken over from the failed engine-driven boost pump. It also provides the motive flow for the auxiliary transfer.');
    if(noX[0]||noX[1]) o.push('<b>NO TRANSFER:</b> the auxiliary tank has fuel but nothing is moving it. Select OVERRIDE to open the motive flow valve directly. If the light stays on, that auxiliary fuel is unusable: re-plan.');
    if(F.xf!=='off'){ const from=F.xf==='lr'?'left':'right', to=F.xf==='lr'?'right':'left'; o.push(`<b>Crossfeed:</b> the ${from} standby pump pushes ${from} fuel through the crossfeed valve to the ${to} engine. Crossfeed is for single-engine operation. Note that it only takes fuel from the ${from} nacelle, which is refilled from the ${from} wing and auxiliary tanks, so it is a way to balance fuel, not to transfer it between tanks.`); if(!S[F.xf==='lr'?1:0].eng) o.push(`<span class="bad">The ${to} engine is not running</span>, so this crossfeed feeds nothing. To use the dead side's fuel, crossfeed the other way: ${to} tanks to the ${from} engine.`); }
    if(!S[1].eng&&F.xf==='off') o.push('<b>Right engine shut down:</b> its fuel is now unusable unless you crossfeed it to the left engine. Watch the imbalance grow.');
    if(imb>1000) o.push('<b>Imbalance above the typical 1,000 lb limit.</b> Crossfeed from the heavy side to the running engine.');
    if(!S[0].ffw||!S[1].ffw) o.push('<b>Firewall shutoff valve closed:</b> fuel is stopped at the firewall and the engine on that side stops. This valve is for a fire or for securing an engine, and it is powered from the hot battery bus so it works even with the master switch off.');
    root.querySelector('[data-expl]').innerHTML=(o.length?o:['Normal operation.']).map(x=>`<p>${x}</p>`).join('')+(F.log.length?`<p class="bad">${esc(F.log.slice(-1)[0])}</p>`:''); }
  function draw(lp){ const S=F.side; const on='#35c27a', off='#3a4752', fuelC='#c99a2e', txt='#d6dee5', dim='#7d8a94';
    const tank=(x,y,w,h,v,max,t,inside)=>{ const f=clamp(v/max,0,1); return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#1b252d" stroke="#53616c"/><rect x="${x+1}" y="${y+1+(h-2)*(1-f)}" width="${w-2}" height="${(h-2)*f}" rx="3" fill="${fuelC}" opacity=".85"/><text x="${x+w/2}" y="${inside?y+15:y-6}" text-anchor="middle" fill="${inside?(f>.2?'#0f171d':txt):txt}" font-size="${inside?10:12}">${t}</text><text x="${x+w/2}" y="${y+h/2+(inside?10:5)}" text-anchor="middle" fill="#0f171d" font-size="12" font-weight="700" style="paint-order:stroke" stroke="${f>.45?'none':'#1b252d'}">${nf(v)}</text>`; };
    const arrow=(x1,y1,x2,y2,a)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${a?on:off}" stroke-width="3" ${a?'stroke-dasharray="7 5" class="flow"':''}/>`;
    let s='';
    [0,1].forEach(i=>{ const m=i?-1:1, cx=i?640:0; const X=v=>i?640-v:v; const sd=S[i];
      // wing (outboard) – aux (inboard) – nacelle (middle)
      s+=tank(X(i?130:20),70,110,120,sd.wing,FULL.wing,'WING')+tank(X(i?250:140)-(0),70,110,120,sd.aux,FULL.aux,'AUX');
      s+=tank(X(i?190:80)-0,214,110,60,sd.nac,FULL.nac,'NACELLE',true);
      s+=arrow(X(75),190,X(110),214,sd.grav)+arrow(X(195),190,X(160),214,sd.xfer);
      const ex=X(i?300:190)+(i?-0:0);
      s+=`<circle cx="${X(250)}" cy="${244}" r="18" fill="${sd.eng?'#123526':'#2a1b1b'}" stroke="${sd.eng?on:'#e05a47'}" stroke-width="2"/><text x="${X(250)}" y="248" text-anchor="middle" fill="${txt}" font-size="11">ENG</text>`;
      s+=arrow(X(190),244,X(232),244,sd.eng&&!lp[i]);
      s+=`<rect x="${X(i?212:196)}" y="232" width="16" height="24" rx="2" fill="${sd.ffw?'#123526':'#5a1d18'}" stroke="${sd.ffw?on:'#e05a47'}"/>`;
      s+=`<text x="${X(135)}" y="292" text-anchor="middle" fill="${on}" font-size="10">${sd.stby||(F.xf==='lr'&&i===0)||(F.xf==='rl'&&i===1)?'standby pump ON':''}</text>`;
      s+=`<text x="${X(i?62:62)}" y="30" text-anchor="${i?'end':'start'}" fill="${txt}" font-size="15" font-weight="700">${i?'RIGHT':'LEFT'}</text>`;
    });
    const xa=F.xf!=='off'; s+=`<path d="M190 268 H450" stroke="${xa?on:off}" stroke-width="3" ${xa?'stroke-dasharray="7 5" class="flow'+(F.xf==='rl'?' rev':'')+'"':''} fill="none"/><text x="320" y="290" text-anchor="middle" fill="${xa?txt:dim}" font-size="11">CROSSFEED ${F.xf==='off'?'closed':F.xf==='lr'?'L → R':'R → L'}</text>`;
    svg.innerHTML=s; }
  notice(root.querySelector('[data-notice]'),[
    'The order of use is automatic: auxiliary first (by jet-pump transfer), then the wing by gravity, and the nacelle level only falls at the end. The MAIN gauge stays full while auxiliary fuel is being used.',
    'Transfer needs motive flow, which comes from boost-pump pressure. That is why the standby pump matters for transfer and crossfeed, not just as a backup for the engine.',
    'A red FUEL PRESS light does not mean the engine stops. It means the high-pressure pump is working without a boost and that time is limited.',
    'Crossfeed only moves fuel out of the supplying nacelle. It is used with one engine inoperative, to use or balance fuel.',
    'Take-off is not allowed with less than about 265 lb on either MAIN gauge (yellow arc). The imbalance limit is typically 1,000 lb.']);
  upd();
}

/* =====================================================================
   (c) PT6A ENGINE START
   ===================================================================== */
function start(root){
  root.innerHTML=`<p class="lead">Start the left PT6A. The starter spins the gas generator (N1/Ng); you give it fuel with the condition lever when there is enough airflow, then watch ITT and the acceleration to idle. The start is a balance between air and fuel, and every abnormal start is a lack of air or a surplus of fuel.</p>
  <div class="simgrid"><div class="simview"><div class="view"><canvas class="gauges" aria-label="Engine gauges: ITT, Ng (N1), torque and oil pressure"></canvas></div>
    <div class="annp" data-ann></div><div class="duty" data-duty></div></div>
    <div class="panel" data-ctl></div></div>
  <div class="cols"><div class="box"><b class="t">Start log</b><ol class="slog" data-log></ol></div><div class="box"><b class="t">Assessment</b><div data-expl class="expl"></div></div></div>
  <div class="notice" data-notice></div>`;
  const cv=root.querySelector('canvas'), ctl=root.querySelector('[data-ctl]');
  let E; function init(keepDuty){ const d=E&&keepDuty?E.duty:{on:0,cyc:0,cool:0,need:0,viol:false};
    E={t:0,ng:0,itt:20,tq:0,oil:0,ff:0,np:0,sw:'off',cl:'cut',lit:false,litT:null,fuelT:null,ngFuel:null,wet:0,peak:20,over:0,hungT:0,gen:false,log:[],done:false,res:null,duty:d}; }
  init();
  let src='gpu', scen='normal';
  grp(ctl,'Before the start');
  row(ctl,'Power source',[['gpu','GPU'],['bat','Battery'],['cross','Battery + other gen']],src,v=>{ src=v; });
  row(ctl,'Scenario',[['normal','Normal'],['hot','Weak start'],['hung','Hung start']],scen,v=>{ scen=v; });
  btns(ctl,[['New start',()=>{ init(true); upd(); }]]);
  grp(ctl,'IGNITION AND ENGINE START');
  const cSw=row(ctl,'Switch',[['off','OFF'],['on','ON'],['stonly','STARTER ONLY']],'off',v=>{ setSw(v); });
  grp(ctl,'Condition lever');
  const cCl=row(ctl,'Lever',[['cut','FUEL CUTOFF'],['low','LOW IDLE'],['high','HIGH IDLE']],'cut',v=>{ setCl(v); });
  grp(ctl,'After the start');
  btns(ctl,[['GEN 1 RESET → ON',()=>{ if(E.ng>50&&E.lit){ E.gen=true; log('Generator on line.'); } else log('Generator will not come on line: engine not at idle.'); upd(); }],['Let 1 min pass (cooling)',()=>{ advanceCool(60); }],['Let 30 min pass',()=>{ advanceCool(1800); }]]);
  const L=loop(root,dt=>step(dt));
  function log(t){ E.log.push(`<b>${nf(E.t,1)} s</b> · ${t}`); }
  function advanceCool(s){ const d=E.duty; if(d.on>0) return; d.cool+=s; if(s>=1800&&d.cool>=1800) d.cyc=0; E.itt=Math.max(20,E.itt-s*8); log(`${s>=600?'30 min':'1 min'} passes. Starter cool-down ${d.cool>=d.need?'complete':'in progress'}.`); upd(); }
  function starterOn(){ return (E.sw==='on'||E.sw==='stonly'); }
  function setSw(v){ const was=starterOn(); E.sw=v;
    if(starterOn()&&!was){ const d=E.duty; if(d.cool<d.need){ d.viol=true; log(`<span class="bad">Starter engaged before the cool-down was complete (${nf(d.cool)} of ${nf(d.need)} s).</span>`); } d.on=0.0001; d.cyc++; log(v==='on'?'Switch ON: starter and ignition. IGNITION ON light.':'STARTER ONLY: motoring without ignition.'); }
    if(!starterOn()&&was){ const d=E.duty; d.need= d.cyc>=3? 1800 : 60; d.cool=0; log(`Starter off at ${nf(E.ng,1)} % Ng after ${nf(d.on)} s of cranking.`); d.on=0; }
    if(v==='on'&&E.cl!=='cut'&&!E.lit&&E.ng>=5) E.ignT=E.t;
    upd(); }
  function setCl(v){ const prev=E.cl; E.cl=v;
    if(prev==='cut'&&v!=='cut'){ E.fuelT=E.t; E.ngFuel=E.ng; log(`Condition lever ${v==='low'?'LOW IDLE':'HIGH IDLE'}: fuel at ${nf(E.ng,1)} % Ng.`+(E.ng<12?' <span class="bad">Below 12 %: too little air for the fuel.</span>':'')); }
    if(v==='cut'&&prev!=='cut'){ log('Condition lever FUEL CUTOFF: fuel off.'); if(E.lit){ E.lit=false; if(E.ng<50) E.res=E.res||'aborted'; } }
    upd(); }
  function step(dt){ if(!dt) return; E.t+=dt; const d=E.duty;
    const st=starterOn();
    if(st){ d.on+=dt; } else if(d.need) d.cool+=dt;
    // starter target and authority
    const sTgt= src==='gpu'?24 : src==='cross'?21 : 17; const tgt=scen==='hot'?11.5:sTgt;
    let acc=0;
    if(st) acc+= E.lit? Math.max(0,tgt+30-E.ng)*0.12 : (tgt-E.ng)*0.55;
    const fuelOn=E.cl!=='cut';
    // light-off
    if(fuelOn&&!E.lit){ if(E.sw==='on'&&E.ng>=5){ if(E.fuelT==null) E.fuelT=E.t; const since=E.t-Math.max(E.fuelT,E.ignT||0); if(since>1.8){ E.lit=true; E.litT=E.t; const wetBump=E.wet*260; E.peakBias=wetBump+(scen==='hot'?300:src==='bat'?270:src==='cross'?210:160); log(`Light-off. ITT rising.`+(E.wet>0.5?` <span class="bad">Fuel had pooled for ${nf(E.wet,1)} s without ignition: expect a hot light-off.</span>`:'')); E.wet=0; } }
      else if(E.ng>2) E.wet+=dt; }
    if(E.lit){ const idle=E.cl==='high'?70:E.cl==='low'?60:0; let cap=idle; if(scen==='hung') cap=Math.min(cap,38.5);
      let a= E.ng>=cap? (cap-E.ng)*0.5 : (cap-E.ng)*0.075+0.6; if(!st&&E.ng<30&&a>0) a*=0.3; if(scen==='hot'&&a>0) a*=0.45; acc+=a; }
    if(!st&&!E.lit) acc+= -E.ng*0.18;
    E.ng=clamp(E.ng+acc*dt,0,104); if(E.lit&&scen==='hung') E.ng=Math.min(E.ng,38.5);
    // ITT
    let ittT=20;
    if(E.lit){ const kp= scen==='hot'?24 : src==='bat'?10.5 : src==='cross'?8.5 : 7; const early=E.ngFuel!=null&&E.ngFuel<12? (12-E.ngFuel)*45 : 0;
      if(E.ng<55) ittT=560+Math.max(0,48-E.ng)*kp+early+(E.peakBias||0); else ittT= E.cl==='high'?560:600;
      if(scen==='hung'&&E.ng>36){ E.hungT+=dt; ittT=620+E.hungT*16; }
      if(E.gen&&src==='bat') ittT+=25; }
    else ittT= st? Math.max(20,E.itt>200?150:20) : 20;
    const tau=E.lit?(ittT>E.itt?0.8:2.5):(st?5:14); E.itt+= (ittT-E.itt)*Math.min(1,dt/tau);
    if(E.peakBias) E.peakBias=Math.max(0,E.peakBias-dt*40);
    E.peak=Math.max(E.peak,E.itt);
    if(E.itt>1000){ E.over+=dt; }
    E.oil= clamp(E.ng<8?E.ng*2:E.ng*1.35+(E.lit?2:0),0,135); E.tq= E.lit? clamp((E.ng-45)*9,0,180) : 0; E.np=E.lit? clamp((E.ng-25)*28,0,1000):clamp(E.ng*8,0,200);
    E.ff= fuelOn? (E.lit? (E.ng<55? 140+E.ng*1.2 : 150) : (E.sw==='on'||E.ng>5?60:0)) : 0;
    // evaluate
    if(!E.res&&E.over>5){ E.res='hot'; log('<span class="bad">ITT above 1,000 °C for more than 5 s: start limit exceeded.</span>'); }
    if(!E.res&&E.lit&&E.ng>=59&&E.cl!=='cut'){ E.res='ok'; log(`Stabilised at ${E.cl==='high'?'high':'low'} idle, ${nf(E.ng,1)} % Ng. Peak ITT ${nf(E.peak)} °C.`); }
    if(E.fuelT!=null&&!E.lit&&E.sw==='on'&&E.t-E.fuelT>10&&!E.noLight){ E.noLight=true; log('<span class="bad">No light-off 10 s after fuel: abort (condition lever CUTOFF, keep motoring to clear the fuel).</span>'); }
    if(d.on>40&&!d.warn40){ d.warn40=true; log('<span class="bad">Starter on for 40 s: the cranking limit for this cycle.</span>'); }
    if(!st) d.warn40=false;
    upd(); }
  function upd(){ drawG(); const d=E.duty;
    ann(root.querySelector('[data-ann]'),[['L IGNITION ON','g',E.sw==='on'],['L DC GEN','a',!E.gen],['L FUEL PRESS','r',false],['L OIL PRESS','r',E.lit&&E.oil<40],['L CHIP DETECT','r',false]]);
    const onP=clamp(d.on/40*100,0,100), need=d.need, cool=Math.min(d.cool,need);
    root.querySelector('[data-duty]').innerHTML=`<div class="rrow"><span>Starter cycle ${d.cyc||'–'} · cranking</span><b class="${d.on>40?'bad':''}">${starterOn()?nf(d.on)+' / 40 s':'off'}</b></div><div class="bar"><i style="width:${starterOn()?onP:0}%" class="${d.on>35?'w':''}"></i></div>
      <div class="rrow"><span>Cool-down before next use</span><b>${need&&!starterOn()?(cool>=need?'complete':nf(need-cool)+' s left'):'–'}</b></div>`;
    root.querySelector('[data-log]').innerHTML=E.log.slice(-12).map(x=>`<li>${x}</li>`).join('')||'<li>Set the source and scenario, then switch ON.</li>';
    const o=[];
    const v=E.res;
    if(!E.log.length) o.push(scen==='normal'?'A normal start. The usual sequence: switch ON, check the IGNITION ON light and rising Ng, at 12 % Ng or more (stable) condition lever to LOW IDLE, watch for light-off and the ITT peak, starter off once the engine accelerates on its own towards idle, then generator on.':scen==='hot'?'This time the starter is weak (cold battery, a lot of load). Ng will hang low. Decide when, and whether, to give it fuel, and be ready to stop the start.':'This time the engine will light normally but will stop accelerating short of idle. Recognise it and react.');
    if(v==='ok') o.push(`<span class="good">Good start.</span> Fuel at ${nf(E.ngFuel,1)} % Ng, peak ITT ${nf(E.peak)} °C${E.peak>800?' (warm: on a battery start, more airflow before fuel would have helped)':''}.`);
    if(v==='hot') o.push('<span class="bad">Hot start.</span> The correct reaction is condition lever to FUEL CUTOFF the moment ITT is heading for the limit, not when it gets there, and keep the starter motoring to blow the heat out, within the starter limits. An ITT above 1,000 °C for more than about 5 s requires a maintenance action: record peak and duration.');
    if(scen==='hot'&&!v&&E.ngFuel==null&&E.ng>8) o.push('Ng is stuck below 12 %. Giving fuel now means too little air for the fuel. Options: abort (switch OFF, wait out the cool-down) and use ground power, or start the other engine first and use its generator for a cross-start.');
    if(scen==='hung'&&E.lit&&E.ng>36&&E.ng<50) o.push('<span class="warn">Ng has stopped rising and ITT is creeping up: a hung start.</span> Condition lever FUEL CUTOFF, keep motoring briefly to cool, starter OFF. Do not try to "push" it through with more fuel.');
    if(E.res==='aborted'||(E.cl==='cut'&&E.ngFuel!=null&&!E.lit&&E.ng>0)) o.push('Start aborted. Before another attempt: let the ITT cool, observe the starter cool-down (60 s after the first and second cycles, 30 min after the third) and, after a failure to light, motor with STARTER ONLY to clear fuel from the engine.');
    if(E.lit&&!v&&E.ng<59&&scen!=='hung') o.push(`Accelerating: ${nf(E.ng,1)} % Ng, ITT ${nf(E.itt)} °C. Watch the ITT trend until the engine settles at idle.`);
    if(d.viol) o.push('<span class="bad">Starter duty cycle not respected.</span> The starter-generator overheats: typically 40 s on, 60 s off, 40 s on, 60 s off, 40 s on, then 30 min off.');
    if(E.gen&&src==='bat') o.push('Generator on line straight after a battery start: the battery recharge current is high at first. Watch the loadmeter and the ITT; the extra load raises ITT at low idle.');
    root.querySelector('[data-expl]').innerHTML=o.map(x=>`<p>${x}</p>`).join(''); }
  const st=canvasFit(cv,()=>drawG());
  function gauge(c,x,y,r,v,min,max,lab,unit,arcs,red,fmt){ const a0=Math.PI*0.75, a1=Math.PI*2.25; const ang=u=>a0+(clamp(u,min,max)-min)/(max-min)*(a1-a0);
    c.lineWidth=r*0.12; arcs.forEach(([f,t,col])=>{ c.strokeStyle=col; c.beginPath(); c.arc(x,y,r*0.86,ang(f),ang(t)); c.stroke(); });
    c.strokeStyle='#5b6873'; c.lineWidth=1; for(let i=0;i<=10;i++){ const a=a0+i/10*(a1-a0); c.beginPath(); c.moveTo(x+Math.cos(a)*r*0.72,y+Math.sin(a)*r*0.72); c.lineTo(x+Math.cos(a)*r*0.8,y+Math.sin(a)*r*0.8); c.stroke(); }
    if(red!=null){ const a=ang(red); c.strokeStyle='#e05a47'; c.lineWidth=3; c.beginPath(); c.moveTo(x+Math.cos(a)*r*0.7,y+Math.sin(a)*r*0.7); c.lineTo(x+Math.cos(a)*r*1.0,y+Math.sin(a)*r*1.0); c.stroke(); }
    const a=ang(v); c.strokeStyle='#f2f5f7'; c.lineWidth=3; c.beginPath(); c.moveTo(x,y); c.lineTo(x+Math.cos(a)*r*0.78,y+Math.sin(a)*r*0.78); c.stroke(); c.fillStyle='#f2f5f7'; c.beginPath(); c.arc(x,y,4,0,7); c.fill();
    c.textAlign='center'; c.fillStyle= (red!=null&&v>red)?'#ff8e7e':'#e8eef2'; c.font=`500 ${Math.round(r*0.27)}px "IBM Plex Mono",monospace`; c.lineWidth=5; c.strokeStyle='#0F171D'; c.strokeText(fmt(v),x,y+r*0.45); c.fillText(fmt(v),x,y+r*0.45);
    c.fillStyle='#9aa7b1'; c.font=`600 ${Math.round(r*0.16)}px "IBM Plex Mono",monospace`; c.strokeText(lab+' '+unit,x,y+r*0.78); c.fillText(lab+' '+unit,x,y+r*0.78); }
  function drawG(){ if(!st||!st.w) return; const c=st.ctx, w=st.w, h=st.h; c.clearRect(0,0,w,h);
    const cols=w<480?2:4, rows=cols===2?2:1, cw=w/cols, ch=(h-26)/rows, r=Math.min(cw,ch)*0.42;
    const G=[[E.itt,0,1200,'ITT','°C',[[400,800,'#2c9a55'],[800,1000,'#c99a2e']],1000,v=>nf(v)],[E.ng,0,110,'Ng (N1)','%',[[52,101.5,'#2c9a55']],101.5,v=>nf(v,1)],[E.tq,0,2400,'TORQUE','ft-lb',[[0,2230,'#2c9a55']],2230,v=>nf(v)],[E.oil,0,200,'OIL PRESS','psi',[[60,100,'#c99a2e'],[100,135,'#2c9a55']],135,v=>nf(v)]];
    G.forEach((g,i)=>{ const cx=(i%cols+0.5)*cw, cy=Math.floor(i/cols)*ch+ch*0.52; gauge(c,cx,cy,r,...g); });
    c.fillStyle='#9aa7b1'; c.font='12px "IBM Plex Mono",monospace'; c.textAlign='left'; c.fillText(`FUEL FLOW ${nf(E.ff)} lb/h   PROP ${nf(E.np)} rpm   t ${nf(E.t,1)} s`,10,h-9); }
  notice(root.querySelector('[data-notice]'),[
    'Fuel goes in only when the starter has made enough airflow: about 12 % Ng or more and stable. Less air for the same fuel is the classic route to a hot start.',
    'The ITT peak comes a few seconds after light-off. React to the trend: a fast-rising ITT at low Ng needs FUEL CUTOFF before the limit (typically 1,000 °C for 5 s), not after.',
    'A hung start lights normally but stops accelerating. Ng flat, ITT creeping up. More fuel will not fix a lack of air.',
    'GPU starts are cooler than battery starts because the starter turns the engine faster. A cross-start with the other generator on line sits in between.',
    'The starter is also the generator and gets hot: typically 40 s on / 60 s off, twice, then 40 s on / 30 min off.',
    'The PT6A is a free-turbine engine: the propeller is not on the gas-generator shaft, so the starter only has to turn the compressor. That is why the start is relatively easy and why the prop can stay in feather.']);
  upd();
}

/* =====================================================================
   (d) ENGINE FAILURE, AUTOFEATHER, YAW
   ===================================================================== */
function efail(root){
  root.innerHTML=`<p class="lead">Take-off power, autofeather armed. Fail an engine and fly it: keep the aircraft straight with rudder, identify and verify the dead engine, and see how the autofeather logic and the feathered propeller change the yaw and the climb. For the theory of V<sub>MCA</sub>, see the <a href="propeller.html#lt">propeller lab</a>.</p>
  <div class="simgrid"><div class="simview"><div class="view"><canvas class="topv" aria-label="Top view of the aircraft with yaw, rudder and slip indication"></canvas></div>
    <div class="annp" data-ann></div><div class="ro meters" data-ro></div></div>
    <div class="panel" data-ctl></div></div>
  <div class="box"><b class="t">Drill</b><div data-expl class="expl"></div></div>
  <div class="notice" data-notice></div>`;
  const cv=root.querySelector('canvas'), ctl=root.querySelector('[data-ctl]');
  let A; function init(){ A={t:0,fail:-1,failT:0,tq:[2230,2230],pw:[100,100],prop:['run','run'],fth:[false,false],dump:[false,false],hdg:0,yawR:0,id:null,ver:false,steps:[],afSw:af?af.v:'arm',done:false}; }
  let af=null; init();
  let ias=110, bank='live', rud=0, boost=true, gear='up', flap='0';
  grp(ctl,'Set-up');
  af=row(ctl,'AUTOFEATHER',[['arm','ARM'],['off','OFF']],'arm',v=>{ A.afSw=v; upd(); });
  row(ctl,'Rudder boost',[['on','ON'],['off','OFF']],'on',v=>{ boost=v==='on'; upd(); });
  row(ctl,'Gear',[['up','UP'],['down','DOWN']],'up',v=>{ gear=v; upd(); });
  row(ctl,'Flaps',[['0','UP'],['app','APPROACH']],'0',v=>{ flap=v; upd(); });
  btns(ctl,[['Fail LEFT engine',()=>failE(0),'pri'],['Fail RIGHT engine',()=>failE(1),'pri'],['Reset',()=>{ init(); cR.set(0); rud=0; cPL.set(100); cPR.set(100); upd(); }]]);
  grp(ctl,'Fly it');
  const cIas=slider(ctl,{label:'Indicated airspeed',min:75,max:150,step:1,v:110,f:v=>v+' KIAS',on:v=>{ ias=v; upd(); }});
  const cR=slider(ctl,{label:'Rudder (left ← → right)',min:-100,max:100,step:1,v:0,f:v=>(v<0?'L ':v>0?'R ':'')+Math.abs(v)+' %',on:v=>{ rud=v; upd(); }});
  row(ctl,'Bank',[['live','5° toward live engine'],['level','Wings level'],['dead','5° toward dead']],'live',v=>{ bank=v; upd(); });
  const cPL=slider(ctl,{label:'Left power lever',min:0,max:100,step:1,v:100,f:v=>v===100?'take-off':v<=2?'IDLE':v+' %',on:v=>{ A.pw[0]=v; pl(0); }});
  const cPR=slider(ctl,{label:'Right power lever',min:0,max:100,step:1,v:100,f:v=>v===100?'take-off':v<=2?'IDLE':v+' %',on:v=>{ A.pw[1]=v; pl(1); }});
  grp(ctl,'Identify · verify · feather');
  btns(ctl,[['Dead: LEFT',()=>ident(0)],['Dead: RIGHT',()=>ident(1)],['Feather LEFT prop',()=>feather(0)],['Feather RIGHT prop',()=>feather(1)]]);
  function note(t){ A.steps.push(`<b>${nf(A.t,1)} s</b> · ${t}`); }
  function failE(i){ if(A.fail>=0) return; A.fail=i; A.failT=A.t; note(`${i?'Right':'Left'} engine fails.`); L.start(); }
  function ident(i){ if(A.fail<0) return; A.id=i; note(i===A.fail?`Identified: ${i?'right':'left'} (dead foot, dead engine).`:`<span class="bad">Wrong engine identified.</span> The foot that is doing nothing is on the dead side.`); upd(); }
  function pl(i){ if(A.fail>=0){ if(i===A.fail&&A.pw[i]<10&&!A.ver){ A.ver=true; note('Verified: power lever of the dead engine closed, no change in yaw.'); } if(i!==A.fail&&A.pw[i]<70&&!A.badPull){ A.badPull=true; note('<span class="bad">Power reduced on the LIVE engine.</span> Yaw changes and climb is lost: that is the verify step catching a wrong identification.'); } } upd(); }
  function feather(i){ if(A.fail<0&&i>=0){ note('Feathering a running engine: not in this drill.'); return; } A.prop[i]='fth'; if(i===A.fail){ if(!A.fth[i]) note(A.ver?'Prop lever to FEATHER: propeller feathered.':'Prop lever to FEATHER before verifying. Always verify with the power lever first.'); A.fth[i]=true; } else { note('<span class="bad">You feathered the LIVE engine.</span> Both propellers now give no thrust.'); A.fth[i]=true; } upd(); }
  const L=loop(root,dt=>step(dt));
  function armed(){ return A.afSw==='arm'&&A.pw[0]>=90&&A.pw[1]>=90; }
  function step(dt){ if(!dt) return; A.t+=dt;
    [0,1].forEach(i=>{ const tgt= (i===A.fail||A.fth[i]&&i!==A.fail)? (i===A.fail?0:0) : 2230*A.pw[i]/100; A.tq[i]+= (tgt-A.tq[i])*Math.min(1,dt/(i===A.fail?0.45:0.8)); });
    // autofeather: each 400 ft-lb switch arms the opposite engine; 200 ft-lb on the failing engine dumps it
    if(A.fail>=0&&armed()&&!A.dump[A.fail]&&A.tq[A.fail]<200&&A.tq[1-A.fail]>400){ A.dump[A.fail]=true; A.fth[A.fail]=true; note('Autofeather: torque below about 200 ft-lb, dump valve opens, propeller feathers.'); }
    // yaw model
    const y=yawReq(); const err=(y.need-rud)/100; A.yawR+= (-err*18 - A.yawR)*Math.min(1,dt*1.5); A.hdg+=A.yawR*dt; A.hdg=clamp(A.hdg,-60,60);
    if(Math.abs(A.yawR)<0.5&&Math.abs(err)<0.05) A.hdg*= (1-dt*0.1);
    upd(); if(A.fail<0&&A.t>1) L.stop(); }
  function yawReq(){ // + = right rudder needed
    const thr=i=> (A.fail===i||A.fth[i]&&i!==A.fail)? 0 : A.tq[i]/2230*(A.pw[i]>0?1:0);
    const drag=i=> i===A.fail||A.fth[i]? (A.fth[i]? 0.03 : 0.28*clamp(1-A.tq[i]/2230,0,1)) : 0;
    const Fl=thr(0)-drag(0), Fr=thr(1)-drag(1); const asym=Fl-Fr; // left more thrust → yaw right → need left rudder (negative)
    const q=(ias/86)**2; const deadSide= A.fail<0?0:(A.fail===0?-1:1);
    const bf= bank==='live'?1 : bank==='level'?1.18 : 1.35;
    const need=-asym/1.28*100/q*bf; const sat=Math.abs(need)>100;
    return {need:clamp(need,-140,140),sat,asym,q}; }
  function climb(){ if(A.fail<0) return null; const live=1-A.fail; let r=650*(A.tq[live]/2230);
    if(!A.fth[A.fail]) r-=480*clamp(1-A.tq[A.fail]/2230,0,1); if(gear==='down') r-=330; if(flap==='app') r-=170; r-=Math.abs(ias-121)*7; if(bank==='level') r-=60; if(bank==='dead') r-=150; if(Math.abs(yawReq().need-rud)>15) r-=Math.min(400,Math.abs(yawReq().need-rud)*6); if(A.fth[live]) r=-1500; return r; }
  function upd(){ const y=yawReq(); const r=climb(); const ar=armed();
    const afL= ar&&!A.dump[0]&&A.tq[1]>400&&A.tq[0]>200, afR= ar&&!A.dump[1]&&A.tq[0]>400&&A.tq[1]>200;
    ann(root.querySelector('[data-ann]'),[['L AUTOFEATHER','g',afL],['R AUTOFEATHER','g',afR],['L IGNITION ON','g',A.tq[0]<400],['R IGNITION ON','g',A.tq[1]<400],['RUDDER BOOST OFF','a',!boost],['L FUEL PRESS','r',false],['R FUEL PRESS','r',false]]);
    const force=Math.round(Math.abs(rud)/100*y.q*150*(boost&&A.fail>=0&&!A.fth[1-A.fail]?0.45:1));
    root.querySelector('[data-ro]').innerHTML=`<div class="rrow"><span>Torque L / R</span><b>${nf(A.tq[0])} / ${nf(A.tq[1])} ft-lb</b></div>
      <div class="rrow"><span>Props L / R</span><b>${A.fth[0]?'feathered':A.fail===0?'windmilling':'2,000 rpm'} / ${A.fth[1]?'feathered':A.fail===1?'windmilling':'2,000 rpm'}</b></div>
      <div class="rrow"><span>Rudder needed to stay straight</span><b class="${y.sat?'bad':Math.abs(y.need)>85?'warn':''}">${A.fail<0?'–':(y.need<0?'L ':'R ')+nf(Math.min(100,Math.abs(y.need)))+' %'+(y.sat?' (not enough)':'')}</b></div>
      <div class="rrow"><span>Heading drift</span><b class="${Math.abs(A.yawR)>3?'warn':''}">${nf(A.hdg)}° (${A.yawR>0.3?'yawing right':A.yawR<-0.3?'yawing left':'steady'})</b></div>
      <div class="rrow"><span>Pedal force (rough)</span><b>${force} lb${boost&&A.fail>=0?' with boost':''}</b></div>
      <div class="rrow"><span>Climb, one engine (teaching value)</span><b class="${r!=null&&r<0?'bad':''}">${r==null?'–':(r>0?'+':'')+nf(Math.round(r/10)*10)+' ft/min'}</b></div>`;
    const o=[];
    if(A.fail<0) o.push(`Both engines at take-off power. Autofeather is ${ar?'<b>armed</b>: both green AUTOFEATHER lights on (power levers above about 90 % N1 and the other engine above about 400 ft-lb)':'<b>not armed</b>'}. Choose an engine to fail.`);
    else { if(y.sat) o.push(`<span class="bad">Below the speed where full rudder can hold it.</span> At ${ias} KIAS the rudder cannot balance the thrust. Reduce power on the live engine and lower the nose: control first, performance second. Published V<sub>MCA</sub> is typically 86 KIAS (take-off power, critical engine windmilling or as certified, up to 5° bank toward the live engine).`);
      if(!A.fth[A.fail]) o.push('The dead propeller is windmilling: it is being driven by the airflow and creates a lot of drag on the dead side, which adds to the yaw and costs several hundred ft/min of climb.'+(A.afSw==='arm'&&!ar?' Autofeather did not act because it was not armed (both power levers must be above the arming position).':''));
      else o.push('The dead propeller is feathered: drag on that side is small, the rudder needed drops, and the climb improves.');
      if(A.dump[A.fail]) o.push('Sequence: the failing engine\'s torque fell through about 400 ft-lb, which disarmed the <i>other</i> engine\'s autofeather (its green light went out) so only one propeller can ever be feathered automatically. At about 200 ft-lb the dump valve opened and oil left the propeller hub; counterweights and the feathering spring turned the blades to feather.');
      o.push(`Sequence so far: ${A.steps.slice(1).map(s=>s.replace(/<b>.*?<\/b> · /,'').replace(/\.$/,'')).join(' → ')||'nothing yet'}. A full drill: maintain control (rudder, bank 5° toward the live engine, speed), power up, identify (dead foot, dead engine), verify (close the suspected power lever: nothing changes), feather, then clean up and fly blue line (V<sub>YSE</sub>, typically 121 KIAS).`);
      if(gear==='down'||flap==='app') o.push('Gear and flaps out cost a lot of single-engine climb. Clean up as soon as a positive climb is established.'); }
    root.querySelector('[data-expl]').innerHTML=o.map(x=>`<p>${x}</p>`).join('');
    drawT(); }
  const st=canvasFit(cv,()=>drawT());
  function drawT(){ if(!st||!st.w) return; const c=st.ctx,w=st.w,h=st.h; c.clearRect(0,0,w,h); const cx=w/2, cy=h*0.46, s=Math.min(w,h)/330;
    c.save(); c.translate(cx,cy); c.rotate(A.hdg*Math.PI/180*0.6);
    c.fillStyle='#c9d3da'; c.strokeStyle='#e8eef2'; c.lineWidth=1.2;
    // fuselage
    c.beginPath(); c.moveTo(0,-118*s); c.bezierCurveTo(12*s,-110*s,13*s,-70*s,13*s,-40*s); c.lineTo(10*s,95*s); c.lineTo(3*s,128*s); c.lineTo(-3*s,128*s); c.lineTo(-10*s,95*s); c.lineTo(-13*s,-40*s); c.bezierCurveTo(-13*s,-70*s,-12*s,-110*s,0,-118*s); c.fill();
    // wings
    c.beginPath(); c.moveTo(-13*s,-30*s); c.lineTo(-150*s,-8*s); c.lineTo(-150*s,8*s); c.lineTo(-13*s,8*s); c.closePath(); c.fill(); c.beginPath(); c.moveTo(13*s,-30*s); c.lineTo(150*s,-8*s); c.lineTo(150*s,8*s); c.lineTo(13*s,8*s); c.closePath(); c.fill();
    // T-tail
    c.fillRect(-48*s,112*s,96*s,11*s);
    const rd=clamp(rud,-100,100)/100; c.strokeStyle='#f2c14e'; c.lineWidth=4*s; c.beginPath(); c.moveTo(0,122*s); c.lineTo(-rd*14*s,140*s); c.stroke();
    // nacelles + props
    [-1,1].forEach(sd=>{ const i=sd<0?0:1, x=sd*58*s; c.fillStyle='#aab6bf'; c.fillRect(x-8*s,-52*s,16*s,64*s);
      c.save(); c.translate(x,-56*s); const dead=A.fail===i; if(A.fth[i]){ c.strokeStyle='#e8eef2'; c.lineWidth=3*s; c.beginPath(); c.moveTo(-2*s,0); c.lineTo(-2*s,-2*s); c.moveTo(-32*s,-2*s); c.lineTo(32*s,-2*s); c.stroke(); }
      else { c.fillStyle= dead?'rgba(224,90,71,.35)':'rgba(140,200,255,.25)'; c.beginPath(); c.ellipse(0,-2*s,34*s,4*s,0,0,7); c.fill(); }
      c.restore();
      if(!dead&&!A.fth[i]){ const len=A.tq[i]/2230*60*s; c.strokeStyle='#35c27a'; c.lineWidth=3; c.beginPath(); c.moveTo(x,-75*s); c.lineTo(x,-75*s-len); c.stroke(); c.beginPath(); c.moveTo(x-5,-75*s-len+8); c.lineTo(x,-75*s-len); c.lineTo(x+5,-75*s-len+8); c.stroke(); }
      if(dead&&!A.fth[i]){ const len=0.28*50*s; c.strokeStyle='#e05a47'; c.lineWidth=3; c.beginPath(); c.moveTo(x,-40*s); c.lineTo(x,-40*s+len+12*s); c.stroke(); }
    });
    c.restore();
    // yaw arrow
    if(Math.abs(A.yawR)>0.3){ c.strokeStyle='#f2c14e'; c.lineWidth=3; const dir=Math.sign(A.yawR); c.beginPath(); if(dir>0) c.arc(cx,cy,140*s,-Math.PI/2,-Math.PI/2+0.5); else c.arc(cx,cy,140*s,-Math.PI/2-0.5,-Math.PI/2); c.stroke(); c.fillStyle='#f2c14e'; c.font='600 13px "Public Sans",sans-serif'; c.textAlign='center'; c.fillText(dir>0?'yaw right →':'← yaw left',cx,cy-150*s-6); }
    // slip ball
    const by=h-34, bw=Math.min(180,w*0.45); c.strokeStyle='#7d8a94'; c.lineWidth=1.5; c.beginPath(); c.moveTo(cx-bw/2,by-10); c.quadraticCurveTo(cx,by+18,cx+bw/2,by-10); c.stroke(); c.beginPath(); c.moveTo(cx-11,by-6); c.lineTo(cx-11,by+10); c.moveTo(cx+11,by-6); c.lineTo(cx+11,by+10); c.stroke();
    const err=A.fail<0?0:(yawReq().need-rud); const bankBall= A.fail<0?0: bank==='live'? (A.fail===0?1:-1)*14 : bank==='dead'?(A.fail===0?-1:1)*14:0; const bx=clamp(cx+err*0.6+bankBall*0.6,cx-bw/2+10,cx+bw/2-10);
    c.fillStyle='#e8eef2'; c.beginPath(); c.arc(bx,by+2,8,0,7); c.fill();
    // speed tape
    c.fillStyle='#9aa7b1'; c.font='12px "IBM Plex Mono",monospace'; c.textAlign='left'; c.fillText(`${ias} KIAS`,12,22); c.fillStyle= ias<86?'#ff8e7e':'#7d8a94'; c.fillText('VMCA 86 (typ.)',12,40); c.fillStyle='#7fb2ff'; c.fillText('VYSE 121 (typ.)',12,58);
    c.fillStyle='#7d8a94'; c.textAlign='right'; c.fillText('green = thrust  red = windmill drag',w-10,h-8); }
  notice(root.querySelector('[data-notice]'),[
    'Autofeather is armed only with the switch at ARM <i>and</i> both power levers high (about 90 % N1 position). On a reduced-power take-off or a go-around with less power it may not be armed.',
    'The first sign is the other engine\'s AUTOFEATHER light going out (the failing engine dropped below about 400 ft-lb). The failed engine\'s own light goes out as it feathers.',
    'A windmilling PT6A propeller does not feather by itself in flight; governor action keeps the blades fine. Without autofeather, the prop lever is the only way.',
    'Rudder needed rises with the square of falling airspeed. Bank toward the live engine reduces it; wings level or bank toward the dead engine increases it.',
    'Rudder boost reduces the pedal force by sensing the bleed-pressure difference between the engines; it does not give you more rudder.',
    'Verify by closing the power lever you believe is dead. If nothing changes, you have the right engine. Pulling the live one shows up immediately.']);
  upd();
}

/* =====================================================================
   (e) PRESSURISATION
   ===================================================================== */
function press(root){
  root.innerHTML=`<p class="lead">Bleed air flows in all the time; the controller sets the cabin altitude by modulating how fast the outflow valve lets it out. You set the cabin altitude you want and the rate at which the cabin may change. The structure sets the rest: the cabin may never be more than about 6.5 psi above outside.</p>
  <div class="simgrid"><div class="simview"><div class="paper"><canvas class="pplot" aria-label="Aircraft altitude and cabin altitude against time"></canvas></div>
    <div class="annp dark" data-ann></div><div class="ro meters" data-ro></div></div>
    <div class="panel" data-ctl></div></div>
  <div class="box"><b class="t">What is happening</b><div data-expl class="expl"></div></div>
  <div class="notice" data-notice></div>`;
  const cv=root.querySelector('canvas'), ctl=root.querySelector('[data-ctl]');
  const pA=hh=>14.696*Math.pow(1-6.87559e-6*hh,5.25588), aP=p=>(1-Math.pow(p/14.696,1/5.25588))/6.87559e-6;
  const DP=6.5;
  let P; function init(){ P={t:0,ac:500,tgt:500,vs:1500,cab:500,cabVS:0,sel:3000,rate:500,bl:[1,1],dump:false,hist:[],run:false,field:500}; }
  init();
  grp(ctl,'Scenarios');
  btns(ctl,[['Climb to FL250',()=>scen(25000,4500,1500)],['Forgot the controller',()=>scen(31000,0,1500)],['Descent to field',()=>{ init(); P.ac=P.tgt=24000; P.cab=P.sel=aP(pA(24000)+DP*0.97); P.tgt=500; P.vs=1500; syncC(); run(); }],['Bleed air lost at FL280',()=>{ scen(28000,8000,1800); P.ac=28000; P.cab=aP(pA(28000)+6.4); P.failAt=10; }]]);
  const bb=btns(ctl,[['Run',()=>{ P.run?stop():run(); }],['Reset',()=>{ init(); syncC(); stop(); upd(); }]]);
  grp(ctl,'Pressurisation controller');
  const cSel=slider(ctl,{label:'CABIN ALT selected',min:-1000,max:15000,step:100,v:P.sel,f:v=>v.toLocaleString('en-GB')+' ft',on:v=>{ P.sel=v; upd(); }});
  const cRate=slider(ctl,{label:'RATE',min:200,max:2000,step:50,v:P.rate,f:v=>v+' ft/min',on:v=>{ P.rate=v; }});
  const cP=row(ctl,'CABIN PRESS switch',[['press','PRESS'],['dump','DUMP']],'press',v=>{ P.dump=v==='dump'; upd(); });
  const cBL=row(ctl,'L BLEED AIR',[['1','OPEN'],['0','ENVIR OFF']],'1',v=>{ P.bl[0]=+v; upd(); });
  const cBR=row(ctl,'R BLEED AIR',[['1','OPEN'],['0','ENVIR OFF']],'1',v=>{ P.bl[1]=+v; upd(); });
  grp(ctl,'Aircraft');
  const cTgt=slider(ctl,{label:'Target altitude',min:0,max:35000,step:500,v:P.tgt,f:v=>v.toLocaleString('en-GB')+' ft',on:v=>{ P.tgt=v; }});
  const cVs=slider(ctl,{label:'Climb / descent rate',min:500,max:4000,step:100,v:P.vs,f:v=>v+' ft/min',on:v=>{ P.vs=v; }});
  function syncC(){ cSel.set(P.sel); cRate.set(P.rate); cTgt.set(P.tgt); cVs.set(P.vs); cP.set('press'); cBL.set('1'); cBR.set('1'); }
  function scen(tgt,sel,vs){ init(); P.tgt=tgt; P.sel=sel; P.vs=vs; syncC(); run(); }
  function run(){ P.run=true; bb.firstChild.textContent='Pause'; L.start(); }
  function stop(){ P.run=false; bb.firstChild.textContent='Run'; }
  const L=loop(root,dt=>{ if(P.run) step(dt*30); });
  function step(dt){ P.t+=dt;
    if(P.failAt!=null&&P.t>P.failAt){ P.bl=[0,0]; cBL.set('0'); cBR.set('0'); P.failAt=null; P.failed=true; }
    const d=P.tgt-P.ac; const vs=Math.sign(d)*Math.min(Math.abs(d)/dt,P.vs/60); P.ac+=vs*dt;
    const pa=pA(P.ac), inflow=P.bl[0]||P.bl[1];
    const prev=P.cab; let c=P.cab;
    if(P.dump){ c+= Math.sign(P.ac-c)*Math.min(Math.abs(P.ac-c),4000/60*dt); }
    else if(!inflow){ if(c<P.ac) c+= Math.min(P.ac-c,(1200+ (pA(c)-pa)*400)/60*dt); }
    else { const dd=P.sel-c; c+= Math.sign(dd)*Math.min(Math.abs(dd),P.rate/60*dt); }
    // structural limits: max differential and no negative differential
    const cMin=aP(pa+DP); if(c<cMin) c=cMin; if(c>P.ac) c=P.ac;
    // on the ground the safety valve keeps it unpressurised (gear switch)
    if(P.ac<=P.field+1&&P.tgt<=P.field) c=P.ac;
    P.cab=c; P.cabVS=(c-prev)/dt*60;
    P.hist.push([P.t,P.ac,P.cab]); if(P.hist.length>1500) P.hist.splice(0,P.hist.length-1500);
    upd(); }
  function upd(){ const pa=pA(P.ac), pc=pA(P.cab), dp=pc-pa; const maxAc=aP(pA(P.sel)-DP);
    const lit=[['ALT WARN','r',P.cab>=12500],['L BL AIR OFF','g',!P.bl[0]],['R BL AIR OFF','g',!P.bl[1]],['L BL AIR FAIL','r',false],['R BL AIR FAIL','r',false]];
    ann(root.querySelector('[data-ann]'),lit);
    root.querySelector('[data-ro]').innerHTML=`<div class="rrow"><span>Aircraft altitude</span><b>${nf(Math.round(P.ac/10)*10)} ft</b></div>
      <div class="rrow"><span>Cabin altitude</span><b class="${P.cab>=12500?'bad':P.cab>10000?'warn':''}">${nf(Math.round(P.cab/10)*10)} ft</b></div>
      <div class="rrow"><span>Cabin rate</span><b>${P.cabVS>0?'+':''}${nf(Math.round(P.cabVS/10)*10)} ft/min</b></div>
      <div class="rrow"><span>Differential pressure</span><b class="${dp>6.45?'warn':''}">${nf(dp,2)} psi</b></div>
      <div class="rrow"><span>ACFT ALT scale (highest altitude for this cabin setting)</span><b>${nf(Math.round(maxAc/100)*100)} ft</b></div>`;
    const o=[]; const atMax=dp>6.45;
    if(atMax&&P.ac>P.sel) o.push(`<b>At maximum differential.</b> The aircraft is above ${nf(Math.round(maxAc/100)*100)} ft, the highest altitude at which this cabin setting can be held. The outflow and safety valves now limit the differential, so the cabin climbs with the aircraft. Reset the controller: the ACFT ALT scale should read about 500–1,000 ft above the planned cruise altitude.`);
    if(P.cab>=12500) o.push('<span class="bad">ALT WARN: cabin above 12,500 ft.</span> Oxygen masks on, 100 %, then descend. Check the bleed air switches, the controller and the dump switch.');
    if(!P.bl[0]&&!P.bl[1]) o.push('<b>No bleed air inflow.</b> The cabin can only leak; it climbs towards the aircraft altitude. With one bleed open the system works normally: one engine can supply enough air.');
    else if(!P.bl[0]||!P.bl[1]) o.push('One bleed air valve closed: the other side alone keeps the cabin pressurised (with less margin for heating and leaks).');
    if(P.dump) o.push('<b>DUMP:</b> the safety valve opens and the cabin goes straight to the aircraft altitude. That is a rapid cabin climb, so masks first if you are high.');
    if(P.cab>=P.ac-50&&P.ac>P.field+200&&!P.dump&&(P.bl[0]||P.bl[1])&&P.sel>=P.ac) o.push('The aircraft is below the selected cabin altitude, so the outflow valve stays open: the cabin is not pressurised and simply follows the aircraft.');
    if(P.tgt<=P.field+10&&P.sel<P.field+300&&P.ac>P.field) o.push('For landing, set the cabin about 500 ft above the field pressure altitude, so the cabin is unpressurised by touchdown. Set it lower and you land pressurised: when the gear switch opens the safety valve there is a sudden pressure bump, and the doors are loaded.');
    if(!o.length) o.push('The cabin is moving towards the selected altitude at the selected rate, well inside the differential limit. Typical B200 figures: at 6.5 psi a cabin of about 2,800 ft at FL200 and about 10,400 ft at FL350.');
    root.querySelector('[data-expl]').innerHTML=o.map(x=>`<p>${x}</p>`).join('');
    drawP(); }
  const st=canvasFit(cv,()=>drawP());
  function drawP(){ if(!st||!st.w) return; const c=st.ctx,w=st.w,h=st.h; c.clearRect(0,0,w,h); const l=52,r=w-12,t=14,b=h-30;
    const Y=v=>b-(v+1000)/(36000)*(b-t); const H=P.hist; const t0=H.length?H[0][0]:0, t1=Math.max(t0+600,H.length?H[H.length-1][0]:600); const X=v=>l+(v-t0)/(t1-t0)*(r-l);
    c.strokeStyle='#DCE3E4'; c.lineWidth=1; c.fillStyle='#4C5B66'; c.font='11px "IBM Plex Mono",monospace'; c.textAlign='right';
    for(let a=0;a<=35000;a+=5000){ c.beginPath(); c.moveTo(l,Y(a)); c.lineTo(r,Y(a)); c.stroke(); c.fillText(a/1000+'k',l-6,Y(a)+4); }
    c.strokeStyle='rgba(179,38,30,.6)'; c.setLineDash([5,4]); c.beginPath(); c.moveTo(l,Y(12500)); c.lineTo(r,Y(12500)); c.stroke(); c.setLineDash([]); c.fillStyle='#B3261E'; c.textAlign='left'; c.fillText('ALT WARN 12,500',l+4,Y(12500)-4);
    c.strokeStyle='#9A1E68'; c.setLineDash([2,4]); c.beginPath(); c.moveTo(l,Y(P.sel)); c.lineTo(r,Y(P.sel)); c.stroke(); c.setLineDash([]);
    const line=(k,col,wd)=>{ if(!H.length) return; c.strokeStyle=col; c.lineWidth=wd; c.beginPath(); H.forEach((p,i)=>{ const x=X(p[0]), y=Y(p[k]); i?c.lineTo(x,y):c.moveTo(x,y); }); c.stroke(); };
    line(1,'#13202A',2.2); line(2,'#1E5E9E',2.6);
    c.fillStyle='#13202A'; c.textAlign='left'; c.font='12px "Public Sans",sans-serif'; c.fillText('aircraft',l+6,b+20); c.fillStyle='#1E5E9E'; c.fillText('cabin',l+70,b+20); c.fillStyle='#9A1E68'; c.fillText('selected cabin',l+120,b+20);
    c.fillStyle='#4C5B66'; c.textAlign='right'; c.fillText(`time ×30 · ${nf(P.t/60,1)} min`,r-4,t+12); }
  notice(root.querySelector('[data-notice]'),[
    'The controller sets a cabin altitude and a rate; the outflow valve does the work. Before take-off the ACFT ALT scale is set about 500–1,000 ft above the planned cruise altitude.',
    'Above the altitude that matches your setting, the differential limit takes over and the cabin climbs with the aircraft. That is the most common pressurisation "failure".',
    'Cabin altitude can never be above aircraft altitude (negative relief), and on the ground the safety valve keeps the cabin unpressurised through the left gear safety switch.',
    'One bleed air source is enough to pressurise. Losing both means a cabin climb at the leak rate; ALT WARN at 12,500 ft cabin.',
    'For landing set field elevation plus about 500 ft, so you arrive unpressurised.']);
  upd();
}

G.B200SIM={elec,fuel,start,efail,press};
})(window);

/* =====================================================================
   CONTENT: study modules, key numbers, oral prompts, phases, scenarios.
   Own words. Typical B200 values; verify in the AFM/POH.
   ===================================================================== */
(function(G){
'use strict';
const mods=[
{id:'gen',t:'Aircraft general',sub:'The airframe, the two-sided layout and the annunciator philosophy',ch:['gen','light','warn','misc'],oral:'aircraft general, dimensions and design, annunciator and master warning/caution philosophy, lighting, doors, oxygen, stall warning',
 body:`<p>The B200 is a pressurised twin turboprop with a T-tail, certified in the normal category and approved for day and night VFR and IFR and for flight in known icing. Almost every system is built as <b>two sides</b>: each engine has its own fuel system, generator, bleed air and propeller controls, and the sides are joined by a crossfeed line, a centre electrical bus and shared pneumatic plumbing. Most system questions come down to "which side feeds what, and what links the sides".</p>
<p>The annunciators follow one logic. <b>Red</b> lights on the warning panel and the flashing MASTER WARNING demand immediate action. <b>Amber</b> cautions with MASTER CAUTION need attention but not an immediate reaction. <b>Green</b> advisories report a state, not a fault. A few amber lights on the fuel panel do not trigger MASTER CAUTION, so they are found by scanning.</p>
<p>Learn the cockpit by flows rather than by panels: what is on the left subpanel (master switch, ignition and start, autofeather), the pedestal (power, prop and condition levers, flaps, trims, pressurisation controller), the fuel panel and the overhead.</p>`,
 sees:['A red light: immediate action, normally a memory item or a QRH procedure.','A failed annunciator bulb hides a fault, which is why the test is in every before-start flow.','Stall warning needs electrical power: with the master switch off it is silent.'],
 know:['The difference between warning, caution and advisory, with an example of each.','Which systems are "per engine" and how the two sides are linked.','Where the pilot and copilot instruments get their pitot and static pressure.'],
 nums:[['Maximum take-off weight','12,500 lb'],['Maximum ramp weight','12,590 lb'],['Maximum landing weight','12,500 lb'],['Maximum zero-fuel weight','11,000 lb'],['Maximum operating altitude','35,000 ft'],['Engines','2 × PT6A-42, 850 shp'],['Maximum cabin differential','6.5 psi'],['VMO / MMO','259 KIAS / 0.52 M']],
 labs:[['stability.html','CG and stability'],['airdata.html#blockages','Pitot-static']]},
{id:'elec',t:'Electrical power',sub:'28 V DC, battery, two starter-generators, buses, inverters',ch:['elec'],sim:'elec',oral:'electrical system: battery, starter-generators, GCU, hot battery bus, generator buses, centre/isolation bus, current limiters, dual-fed buses, inverters, external power, load limits, failures',
 body:`<p>A 28-volt DC system. A 24-volt battery and two 250-amp <b>starter-generators</b> are the sources; external power can be plugged in under the right wing. The same machine that cranks the engine becomes the generator once the engine runs, so the start is the heaviest electrical event of the flight.</p>
<p>The <b>hot battery bus</b> is wired straight to the battery and is live regardless of the battery switch: it powers the things that must never depend on a switch, such as the fire extinguishers and the firewall shutoff valves. The battery switch closes the battery relay to the main battery bus and the centre (isolation) bus. Each generator feeds its own <b>generator bus</b>; the generator buses are tied to the centre bus through <b>325-amp current limiters</b>. With everything intact the whole system works as one bus and the generators share the load.</p>
<p>Most equipment sits on the <b>dual-fed buses</b>, each fed from both generator buses through a limiter, a diode and a circuit breaker. The diodes stop a fault on one side from pulling the other side down, so a single failure costs a generator or a bus, not the aircraft. Many later aircraft describe a similar arrangement with one more feed ("triple-fed"); the principle is the same. Two <b>inverters</b>, one selected at a time, make AC for avionics and some engine indications.</p>
<p>The <b>generator control units</b> regulate voltage and take a generator off line for over- or undervoltage and other faults. The generator switch has a RESET position that must be held for about a second before ON.</p>`,
 sees:['Generator off line: amber DC GEN on that side, the other loadmeter rises to carry everything. Reset once; if it stays off, switch it OFF and keep the load inside the remaining generator\'s limit.','Both generators lost: battery only, discharging. Shed load immediately, land at the nearest suitable airport.','A current limiter open: one generator bus isolated from the centre. Little is lost because the dual-fed buses still get both sides.','INVERTER (red): the selected inverter has no output. Select the other one.','Excessive battery charge (NiCad aircraft): BATTERY CHG. A normal brief indication after a battery start.'],
 know:['Why the hot battery bus exists and what is on it.','What happens to the load, the battery and the buses after a single generator failure.','Why a battery start is hotter than a GPU start, and why the generator is brought on line after the start.','The generator load limits on the ground, in flight and above FL310.'],
 nums:[['System voltage','28 V DC (generators 28.25 V)'],['Battery','24 V, 42 Ah lead-acid (older: 34/36 Ah NiCad)'],['Starter-generators','2 × 250 A (300 A optional)'],['Bus tie current limiters','325 A'],['Generator load, flight to FL310','100 %'],['Generator load above FL310','88 %'],['Generator load on the ground','85 % (with minimum N1)'],['Inverter output limits','105–120 V, 380–420 Hz'],['GPU','max 32 V; about 1,000 A for starting, 300 A continuous'],['Battery charge before take-off','0 to about +10 A']],
 labs:[['jetsystems.html#elec','Transport-category electrics']]},
{id:'fuel',t:'Fuel system',sub:'Nacelle, wing and auxiliary tanks, transfer, pumps, crossfeed',ch:['fuel'],sim:'fuel',oral:'fuel system: tanks and capacities, gravity feed, auxiliary transfer and motive flow, boost and standby pumps, crossfeed, firewall shutoff valves, fuel pressure warning, limitations, approved fuels',
 body:`<p>Each wing is a separate fuel system for its own engine. The <b>main</b> system on each side is the nacelle tank plus the wing tanks (leading-edge, box-section and integral tanks); the wing tanks drain into the nacelle tank by gravity, and the engine always feeds from the nacelle. The <b>auxiliary</b> tank in the inboard wing has its own filler and is used first.</p>
<p>Auxiliary fuel is moved by a <b>jet transfer pump</b>, a venturi with no moving parts, driven by fuel pressure (motive flow) from the boost pump. The transfer system keeps the nacelle full, so while auxiliary fuel lasts the MAIN gauge stays full. A short time delay after start lets the full boost pressure go to the start first. If motive flow is lost while the auxiliary tank still has fuel, an amber <b>NO TRANSFER</b> light on the fuel panel shows it; OVERRIDE opens the motive flow valve directly.</p>
<p>Each engine has an engine-driven low-pressure <b>boost pump</b> and an engine-driven high-pressure pump. An electric <b>standby pump</b> in the nacelle tank backs up the boost pump, supplies motive flow and provides pressure for crossfeed. Red <b>FUEL PRESS</b> means low pressure ahead of the high-pressure pump: switch the standby pump on. The <b>crossfeed</b> joins the two sides for single-engine operation. The red-guarded <b>firewall shutoff valves</b> are powered from the hot battery bus.</p>`,
 sees:['FUEL PRESS (red): boost pressure lost. Standby pump ON; if the light goes out, continue. Time run on the high-pressure pump alone is limited and must be recorded.','NO TRANSFER (amber, fuel panel, no master caution): auxiliary fuel not moving. OVERRIDE; if it stays on, that fuel is unusable.','Imbalance growing after an engine shutdown: crossfeed from the heavy side to the running engine.','A failed standby pump on one side means no crossfeed from that side.'],
 know:['The order in which the tanks empty, and why the MAIN gauge does not move at first.','How the jet pump works and what it needs.','The three jobs of the standby pump.','What crossfeed can and cannot do.'],
 nums:[['Usable fuel, total','544 US gal (≈ 3,645 lb at 6.7 lb/gal)'],['Main system per side','193 US gal'],['Auxiliary per side','79 US gal'],['Nacelle tank','57 US gal'],['Minimum for take-off','265 lb per MAIN gauge (not in yellow arc)'],['Maximum imbalance','1,000 lb'],['Transfer start delay','30–50 s after start'],['Normal boost pressure','about 25–30 psi'],['Running with FUEL PRESS on','10 h, then HP pump overhaul'],['Avgas (emergency fuel)','time-limited per engine']],
 labs:[['jetsystems.html#fuelbleed','Fuel, bleed and fire (A320)']]},
{id:'power',t:'Powerplant: PT6A-42',sub:'Free turbine, controls, limits, ignition, oil, starting',ch:['power'],sim:'start',oral:'PT6A-42 engine: free power turbine, reverse flow, compressor and turbines, fuel control, power and condition levers, ITT, torque, N1, oil system, chip detector, ignition and autoignition, starting, inertial separator, limits',
 body:`<p>The PT6A is a <b>free-turbine, reverse-flow</b> engine. Air enters at the back through a screen, turns forward through three axial and one centrifugal compressor stage, burns in an annular combustor and flows back out through the turbines and exhausts at the front. A single-stage <b>compressor turbine</b> drives the compressor (that speed is N1 or Ng); a separate two-stage <b>power turbine</b> drives the propeller through the reduction gearbox. There is no shaft between them.</p>
<p>That split explains the handling. The starter only turns the gas generator, so starts are easy and the propeller can stay feathered. The <b>power lever</b> sets gas-generator speed through the fuel control; the <b>propeller lever</b> sets the rpm the governor holds; the <b>condition lever</b> is the fuel cut-off and selects low or high idle. Torque is the power arriving at the propeller; ITT is the hot-section limit; N1 is the third limit. Whichever reaches its limit first sets the power.</p>
<p><b>Autoignition</b>, armed for all flight, fires the igniters whenever torque falls below about 400 ft-lb, to relight a flame-out. The <b>inertial separator</b> (ice vanes) deflects the inlet air so heavy particles and water carry on overboard; it costs some torque and raises ITT. A <b>chip detector</b> in the gearbox gives a red light when metal is found in the oil.</p>`,
 sees:['Hot start: ITT racing up at low N1. Condition lever CUTOFF before the limit, keep motoring.','Hung start: N1 stops short of idle, ITT creeps up. CUTOFF.','CHIP DETECT: metal in the oil; check the engine indications and follow the QRH.','Oil pressure 60–85 psi: caution range, reduce power; below 60: unsafe, shut down or land at the nearest suitable airport.','Flame-out: torque below about 400 ft-lb triggers autoignition and the green IGNITION ON light.'],
 know:['Gas flow through the engine and which turbine drives what.','What each of the three levers controls.','The start sequence and the starter duty cycle.','Why the power is limited by torque, ITT or N1 depending on conditions.'],
 nums:[['Power','850 shp'],['Torque, maximum','2,230 ft-lb (1,600–2,000 prop rpm)'],['Torque below 1,600 prop rpm','1,100 ft-lb'],['ITT, take-off and max continuous','800 °C'],['ITT, normal cruise','770 °C'],['ITT, starting','1,000 °C, 5 s'],['N1 maximum','101.5 %'],['Low idle N1','61 % (56 % on earlier serials)'],['High idle N1','about 70 %'],['Oil pressure (normal)','100–135 psi'],['Oil temperature','0 to 99 °C'],['Starter','40 s on, 60 s off, 40 on, 60 off, 40 on, 30 min off'],['Fuel introduced at','12 % N1 or more']],
 labs:[['engines.html','Aircraft engines lab'],['performance.html','Performance lab']]},
{id:'prop',t:'Propellers: governing, feather, beta and reverse',sub:'Constant speed, overspeed protection, autofeather, ground fine and reverse',ch:['power'],sim:'efail',oral:'propeller system: primary governor, speeder spring and flyweights, oil pressure and counterweights, feathering, unfeathering, overspeed governor, fuel topping governor, beta and reverse, low pitch stop, autofeather arming and operation, synchrophaser, prop deice, limits',
 body:`<p>Full-feathering, constant-speed, reversing propellers. The <b>primary governor</b> balances flyweights (actual rpm) against a speeder spring (the prop lever). Oil pressure from the governor pump drives the blades towards <b>fine</b> pitch; counterweights and a spring drive them towards <b>coarse</b> and feather. So loss of oil pressure lets the blades go towards feather — but a windmilling propeller in flight will not feather by itself, because airflow and governor action keep it turning in fine pitch. Feathering in flight is done with the prop lever, or by the autofeather.</p>
<p>Two back-ups protect against overspeed: an <b>overspeed governor</b> set about 6 % above maximum rpm, and a <b>fuel-topping</b> function on the power turbine that cuts fuel if the propeller runs away. Both are tested on the ground.</p>
<p>Lift the power levers over the idle gate and you are in <b>beta</b>: the power lever now sets blade angle directly, near zero thrust for taxi; further aft gives <b>reverse</b> with power. Never move the power levers into beta or reverse with the engine stopped or the propeller feathered — it damages the linkage.</p>
<p><b>Autofeather</b> arms with the switch at ARM and both power levers above about 90 % N1. Each engine's torque switches arm the <i>other</i> engine: when one engine's torque falls below about 400 ft-lb the other side disarms (its green light goes out), and at about 200 ft-lb the failing engine's dump valve releases the oil and the blades feather. Only one propeller can ever be feathered automatically.</p>`,
 sees:['Both green AUTOFEATHER lights on during take-off = armed. One goes out = the opposite engine is losing torque.','Propeller rpm above 2,000 and stable at about 2,120: primary governor failed, overspeed governor in control. Reduce power; flight can continue with limits.','Engine failure without autofeather: large yaw and drag from the windmilling propeller until you feather it.'],
 know:['Which force feathers the blades and which force unfeathers them.','The autofeather arming conditions and the sequence after an engine failure.','What beta is and why the power levers must not go into it with props feathered.','How the overspeed governor and fuel topping protect you.'],
 nums:[['Maximum propeller rpm','2,000 rpm'],['Governing range','1,600–2,000 rpm'],['Overspeed governor','about 2,120 rpm (106 %)'],['Transient overspeed','2,200 rpm, 5 s'],['Reverse, maximum','1,900 rpm'],['Reverse, other limits','ITT 750 °C, N1 88 %, 1 min'],['Autofeather arms','power levers ≥ ~90 % N1, torque > ~400 ft-lb'],['Autofeather dumps oil','~200 ft-lb on the failing engine'],['Overspeed governor test','about 1,830–1,910 rpm']],
 labs:[['propeller.html#lt','Twin propeller and VMCA lab'],['engines.html','Engines lab']]},
{id:'fire',t:'Fire protection',sub:'Detection, extinguishing, firewall valves, smoke',ch:['fire'],oral:'fire protection: engine fire detection, test, fire warning lights, engine fire extinguishers, firewall shutoff valve, portable extinguishers, engine fire procedures, smoke and fumes, distinguishing fire from bleed air failure',
 body:`<p>Each engine nacelle has a fire-detection system: a temperature-sensing cable loop on later aircraft, individual detectors on earlier ones. Heat makes the circuit and the red <b>ENG FIRE</b> light for that side comes on, together with the MASTER WARNING. A test switch checks the circuits before flight.</p>
<p>Engine fire extinguishers, where fitted, have one bottle per engine: <b>one shot, one side</b>. They and the firewall shutoff valves are on the hot battery bus, so they work with the master switch off. The idea of the engine fire drill is to <b>remove fuel, air and ignition</b> from the fire zone: power lever idle, propeller feathered, condition lever cut-off, firewall valve closed, then discharge the extinguisher on the correct side. Identify the side twice before acting; shutting down the good engine is the real danger.</p>
<p>Smoke and fumes are a different problem: the source may be electrical, environmental or an engine leak into the bleed air. The logic is to protect the crew (oxygen, smoke goggles), then isolate sources one at a time while preparing to land.</p>`,
 sees:['ENG FIRE (red) + MASTER WARNING: confirm the side with ITT, torque and any visible signs.','A fire light that goes out after the power is reduced may have been a bleed leak or a sensor fault: still treat it as a fire until proven otherwise.','BL AIR FAIL is not a fire warning; it is a ruptured bleed line melting a sensing tube.'],
 know:['Why the extinguishers are on the hot battery bus.','The order of the engine fire drill and why that order.','How you avoid securing the wrong engine.'],
 nums:[['Extinguisher bottles','one per engine (where fitted), one shot'],['Power for detection and extinguishing','hot battery bus'],['Portable extinguishers','in the cockpit and the cabin']],
 labs:[]},
{id:'pneu',t:'Bleed air, pneumatics and ice protection',sub:'Bleed air, regulated pneumatics, vacuum, boots, engine and electrical anti-ice',ch:['pneu','ice'],oral:'bleed air and pneumatics: sources, flow control units, regulated pneumatic pressure, vacuum ejector, bleed air failure warning, rudder boost supply, door seal; ice protection: surface deice boots, engine inlet lip heat, inertial separator / ice vanes, propeller deice, windshield heat, pitot and stall warning heat, fuel vent heat, brake deice, limits in icing',
 body:`<p>Each engine supplies high-pressure compressor bleed air. Part of it goes through a <b>flow control unit</b> to the cabin for pressurisation and heating; part is tapped off, regulated to a low pressure (about 18 psi) and used for the <b>pneumatic</b> services: surface deice boots, rudder boost, door seal, the bleed-air warning lines and, through an ejector, the vacuum. One engine can supply all of it.</p>
<p>The bleed lines are paralleled by small plastic tubes carrying regulated pressure. If a hot bleed line ruptures, the tube melts, the pressure drops and the red <b>BL AIR FAIL</b> light for that side comes on. The reaction is to close that side's bleed valve (instrument and environmental off).</p>
<p>Ice protection is split by energy source. <b>Pneumatic boots</b> on the wing and tailplane leading edges are inflated to break off ice that has formed. <b>Engine</b>: the inlet lip is heated by exhaust gas, and the <b>ice vanes</b> (inertial separator) are lowered in visible moisture at low temperatures; green ENG ANTI-ICE confirms them, amber ENG ICE FAIL says they did not get there (standby actuator, and check for the torque drop). <b>Electric</b> heat is used for the propellers, windshields, pitot masts, stall warning vane and fuel vents.</p>`,
 sees:['BL AIR FAIL (red): that bleed valve to INSTR & ENVIR OFF. The other side keeps pressurisation; rudder boost needs bleed on both sides.','ENG ICE FAIL (amber): vanes not in the selected position. Use the standby actuator; a torque drop and ITT rise confirm the vanes moved.','Propeller deice ammeter out of range or uneven heating: vibration from asymmetric ice shedding.','Ice on unprotected surfaces: maintain at least the minimum speed in icing and leave the conditions.'],
 know:['Which services use bleed air and which use regulated pneumatic pressure.','How the bleed-air failure warning works.','When the ice vanes must be down, what they cost and why they must come up in warm conditions.','Why there is a minimum speed in sustained icing.'],
 nums:[['Regulated pneumatic pressure','about 18 psi'],['Minimum speed in sustained icing','140 KIAS'],['Windshield heat effective to','226 KIAS'],['Ice vanes','down in visible moisture near or below +5 °C; up above about +15 °C'],['Rudder boost activates at','bleed pressure difference of about 60 psi'],['Brake deice','needs both bleed sources; times out after gear up']],
 labs:[['hazards.html#icing','Icing lab']]},
{id:'env',t:'Environmental and pressurisation',sub:'Heating, air conditioning, pressurisation controller, outflow and safety valves, oxygen',ch:['air','press'],sim:'press',oral:'environmental system and pressurisation: bleed air heating, flow control units, ambient air, vapour-cycle air conditioning, AIR COND N1 LOW, pressurisation controller and settings, outflow valve, safety valve, dump and test, maximum differential, ALT WARN, oxygen system, depressurisation',
 body:`<p>Cabin air comes from engine bleed air through the <b>flow control units</b>, mixed with ambient air in flight for volume and cooled or heated as needed. On the ground, with the gear safety switch compressed, ambient air is shut off. Cooling comes from a <b>vapour-cycle</b> air conditioner (a refrigerant compressor on the right engine), which is switched off when N1 is too low (green AIR COND N1 LOW).</p>
<p><b>Pressurisation</b> works by restriction: air is pumped in continuously and the <b>outflow valve</b> on the rear pressure bulkhead, modulated by the controller, decides how fast it leaves. You select a cabin altitude and a rate of change. The <b>safety valve</b> next to it limits the maximum differential, relieves negative pressure, keeps the cabin unpressurised on the ground through the left gear safety switch, and opens fully when you select DUMP.</p>
<p>The structure allows about 6.5 psi. If the aircraft climbs above the altitude that matches your selected cabin altitude at that differential, the valves hold the differential and the cabin climbs with the aircraft. At 12,500 ft cabin the red <b>ALT WARN</b> comes on: oxygen.</p>`,
 sees:['Cabin climbing with the aircraft and differential at the maximum: controller set too low for the cruise altitude. Reset it.','ALT WARN (red): masks on, 100 %, check bleed air switches, controller and dump switch; descend if the cabin does not come back.','Landing pressurised (controller set below field elevation): a pressure bump when the safety valve opens on touchdown.','AIR COND N1 LOW: increase N1 on the ground or accept no cooling.'],
 know:['How the outflow and safety valves share the job.','How you set the controller for take-off, cruise and landing.','What gives a cabin altitude of about 10,400 ft at FL350.','The depressurisation drill and why masks come first.'],
 nums:[['Maximum differential','6.5 psi (green arc to 6.6)'],['Cabin at FL200 / FL310 / FL350','≈ 2,800 / 8,600 / 10,400 ft'],['ALT WARN','cabin 12,500 ft'],['Controller cabin range','−1,000 to 15,000 ft'],['Controller rate','about 200–2,000 ft/min'],['Before take-off','ACFT ALT scale 500–1,000 ft above cruise'],['For landing','cabin about 500 ft above field'],['Air conditioning cut-out','below about 62 % N1 (right engine)']],
 labs:[['pressurisation.html','Pressurisation and hypoxia lab']]},
{id:'gear',t:'Landing gear, brakes and hydraulics',sub:'Gear actuation, indication and warning, manual extension, brakes, steering',ch:['hyd','gear'],oral:'landing gear: electro-hydraulic or electric actuation, gear handle and down-lock solenoid, down lock release, indications, warning horn logic, manual extension procedure, gear limits; brakes and parking brake; nosewheel steering; brake deice',
 body:`<p>The tricycle gear is retracted and extended by an electrically driven hydraulic power pack on later aircraft (an electric motor and gearbox on earlier ones). A solenoid locks the gear handle down while the aircraft is on the ground; a red down-lock release button overrides it. Three green lights show each leg down and locked; red lights in the handle show the gear in transit or not matching the handle.</p>
<p>The <b>warning horn</b> compares the gear with the flaps and the power levers: gear not down with power levers retarded sounds a horn you can silence (it re-arms when power is added); gear not down with flaps beyond approach sounds a horn you cannot silence. The idea is that you cannot configure for landing without the gear.</p>
<p><b>Manual extension</b>: take power away from the normal system (landing gear relay circuit breaker), handle DOWN, then pump the hand pump until three green (hydraulic gear) or engage and crank the emergency drive (electric gear). Plan time and a stable speed for it.</p>
<p>Brakes are hydraulic, from master cylinders on the toe pedals; the parking brake traps that pressure. Nosewheel steering is mechanical through the rudder pedals and centres itself on retraction.</p>`,
 sees:['No three green after selecting down: check the bulbs (press to test), recycle if allowed, then manual extension.','Red handle lights stay on after retraction: a leg not up and locked, or the pump still running.','Horn on approach with flaps beyond approach: gear not down. It will not be silenced.'],
 know:['The gear warning logic and what each horn means.','The manual extension steps and why the circuit breaker comes first.','The speeds for gear operation and why retraction is slower.'],
 nums:[['VLO extend','181 KIAS'],['VLO retract','163 KIAS'],['VLE','181 KIAS'],['Gear actuation','electro-hydraulic (later) / electric (earlier)'],['Manual extension','hand pump (hydraulic) or crank (electric)']],
 labs:[['jetsystems.html#gear','Gear and hydraulics lab (jet)']]},
{id:'flt',t:'Flight controls',sub:'Cable controls, trims, flaps, rudder boost, yaw damper, stall warning',ch:['flt'],oral:'flight controls: cable-operated primary controls, T-tail, trim tabs and electric elevator trim, flaps and flap positions, rudder boost operation and test, yaw damper and its altitude limit, stall warning, control locks, load factor limits',
 body:`<p>The primary controls are cable-operated with no power assistance: ailerons, elevators on a T-tail and the rudder, with trim tabs in all three axes and electric elevator trim. Flaps are electric with an approach (about 40 %) and a full-down position.</p>
<p>Two systems help with yaw. The <b>rudder boost</b> senses the bleed-air pressure from each engine; a large difference, as after an engine failure, opens a valve that sends regulated pneumatic pressure to a servo on the rudder cables, pushing the rudder the right way. It reduces pedal force, it does not add rudder authority, and it needs bleed air from both sides. The <b>yaw damper</b> damps Dutch roll and is required above about 17,000 ft.</p>
<p>Stall warning uses a heated vane or transducer on the wing and needs electrical power. Control locks must be removed before towing (they lock the rudder and nosewheel steering linkage) and before flight.</p>`,
 sees:['Electric trim runaway: hold the wheel, disconnect, then manual trim.','Rudder boost inoperative: higher pedal forces after an engine failure, same control limits.','Yaw damper failed: descend to 17,000 ft or below.','Flap asymmetry or failure: plan a flapless or partial-flap approach with more runway.'],
 know:['How the rudder boost senses an engine failure and how you test it on the run-up.','Why the yaw damper has an altitude limit.','Flap speeds and load factor limits with flaps up and down.'],
 nums:[['VFE approach (40 %)','200 KIAS'],['VFE full (100 %)','157 KIAS'],['VA (manoeuvring)','181 KIAS'],['Yaw damper required above','17,000 ft'],['Load factor, flaps up','+3.17 g / −1.27 g'],['Load factor, flaps down','+2.0 g / 0 g']],
 labs:[['stability.html','Stability lab'],['tunnel.html','Wind tunnel']]},
{id:'avio',t:'Avionics, autopilot and pitot-static',sub:'Your fit, instrument sources, autopilot and trim protection',ch:['avio'],oral:'avionics: pitot and static sources, alternate static, heating, flight instruments and their power sources, standby instruments, autopilot and flight director modes, autopilot disconnect, trim monitoring, yaw damper, navigation and communication equipment as fitted',
 body:`<p>Avionics differ more than anything else between B200s, from older electromechanical panels to integrated glass cockpits. Study your aircraft's fit from your own documents, and organise it the same way for any fit: <b>where each display gets its data</b>, <b>which bus powers it</b> and <b>what you have left</b> after a failure.</p>
<p>The pilot's instruments use the left pitot mast and the copilot's the right; static ports on each side feed both, with an alternate static source for the pilot. Pitot masts and the stall vane are heated. Know what an inverter failure, a generator failure and a dual generator failure take away from your panel, and what the standby instruments run on.</p>
<p>For the autopilot: how it engages and disconnects, what the annunciators mean (disconnect, trim fail), what the yaw damper does on its own, and how you recover from a trim runaway. Know which modes you will use on a departure, a non-precision and a precision approach.</p>`,
 sees:['Airspeed disagreement: compare with the other side and the standby, check pitot heat, consider the alternate static source.','A/P TRIM FAIL or disconnect warning: hold the controls, disconnect, retrim manually.','Loss of AC: AC-powered displays go blank until the other inverter is selected.'],
 know:['The pitot and static sources for each instrument.','Which displays are lost with each electrical failure in your fit.','The autopilot disconnect methods and trim protection.'],
 nums:[['Pilot instruments','left pitot mast'],['Copilot instruments','right pitot mast'],['Yaw damper required above','17,000 ft'],['Inverters','2, one selected at a time']],
 labs:[['airdata.html#blockages','Pitot-static lab'],['autoflight.html','Autoflight lab'],['gyros.html','Gyro instruments lab']]},
{id:'lim',t:'Limitations',sub:'Speeds, weights, engine, systems and operating limits',ch:['lim'],oral:'limitations: airspeed limits and markings, weights, load factors, altitude limits, engine operating limits, propeller limits, starter limits, generator limits, fuel limits, pressurisation limits, icing limits',
 body:`<p>The limitations chapter is learnt by heart, but it sticks better if each number is tied to a reason. VMO protects the structure and MMO the high-speed handling; VA is the speed above which a full control deflection could overstress the structure; flap and gear speeds protect the mechanisms and doors; VMCA is set by rudder power; the blue line is where single-engine climb is best.</p>
<p>Engine limits are three different things: <b>torque</b> protects the gearbox and propeller shaft, <b>ITT</b> protects the turbine, <b>N1</b> protects the gas generator. Time-limited values (start ITT, transient torque and N1, reverse) say how long the metal can take it. System limits follow from the system: generator load from cooling, starter duty from heat, pressurisation from the structure, imbalance from roll control.</p>
<p>Use the flashcards for the numbers and the scenarios for applying them.</p>`,
 sees:['An exceedance is recorded with its value and duration for maintenance, even if it was brief.'],
 know:['Each speed limit and its reason.','The engine operating limits table for take-off, climb and cruise.','Every time-limited value and its time.'],
 nums:[['VMO / MMO','259 KIAS / 0.52 M'],['VA','181 KIAS'],['VFE approach / full','200 / 157 KIAS'],['VLO extend / retract, VLE','181 / 163, 181 KIAS'],['VMCA','86 KIAS'],['VYSE (blue line)','121 KIAS'],['Maximum altitude','35,000 ft (yaw damper above 17,000 ft)'],['Torque / ITT / N1','2,230 ft-lb / 800 °C / 101.5 %'],['Prop rpm','2,000 rpm (reverse 1,900)'],['Maximum differential','6.5 psi']],
 labs:[['performance.html#limits','Performance limits lab']]},
{id:'wbp',t:'Weight and balance, performance',sub:'Weights, loading, CG, take-off and landing data, single-engine performance',ch:['wb','perf'],oral:'weight and balance: definitions, maximum weights, zero fuel weight, CG limits, loading and fuel moments; performance: take-off distance, accelerate-stop and accelerate-go, single-engine climb, effects of altitude, temperature, wind, slope and contamination, landing distance, use of the charts',
 body:`<p>Weight and balance works with the usual definitions: basic empty weight, zero-fuel weight, ramp, take-off and landing weights, and a CG envelope in inches from the datum. The <b>maximum zero-fuel weight</b> exists because fuel in the wings relieves wing bending: everything above it must be fuel. Fuel moves the CG as it burns, so check the CG at take-off and at landing.</p>
<p>Performance comes from the AFM charts. Which rules apply depends on the operation and on the data in your AFM, but the planning tools are the same: take-off distance, <b>accelerate-stop</b> and <b>accelerate-go</b> distances, and the one-engine-inoperative climb gradient against obstacles. Hot, high and heavy each cut single-engine performance, and together they can take it to nothing: know the weight-altitude-temperature limit for your departure before you start.</p>
<p>Work real examples with your charts and compare with the <a href="performance.html">performance lab</a> and the <a href="massbalance.html">mass and balance lab</a>.</p>`,
 sees:['A take-off that needs more runway than accelerate-stop allows: reduce weight, choose another runway or wait for cooler air.','A departure where single-engine climb cannot meet the obstacle gradient: an engine-failure procedure or a lower weight.'],
 know:['Why there is a maximum zero-fuel weight.','How to read the take-off, accelerate-stop and single-engine climb charts.','The effect of each variable on take-off and climb performance.'],
 nums:[['Maximum ramp weight','12,590 lb'],['Maximum take-off weight','12,500 lb'],['Maximum landing weight','12,500 lb'],['Maximum zero-fuel weight','11,000 lb'],['Fuel density for planning','about 6.7 lb/US gal'],['VYSE','121 KIAS']],
 labs:[['performance.html','Performance lab'],['massbalance.html','Mass and balance lab']]},
{id:'flows',t:'Normal procedures and flows',sub:'The reason behind each phase from before start to shutdown',ch:null,oral:'normal procedures: preflight, before start, engine start with battery and with ground power, after start, taxi, run-up and system tests (autofeather, overspeed governor, rudder boost, ice protection), take-off, climb, cruise power setting, descent, approach, landing, reverse, after landing, shutdown',
 body:`<p>Normal procedures are where the systems knowledge is used. The <a href="#flows">procedures section</a> below explains the reason behind each phase. The drill questions for this module are taken from every chapter where the question is about a phase of flight.</p>
<p>For the check, know your operator's flows and checklist by heart and be able to say <b>why</b> each item is there: what system it configures or tests, and what would happen if it were missed. The examiner will often ask "why" after "what".</p>`,
 sees:['A test that fails on the run-up (autofeather, overspeed governor, rudder boost) means a system you cannot count on in flight: it is a go/no-go decision against the MEL.'],
 know:['The run-up tests and what each proves.','When autofeather, autoignition and the yaw damper are on and off.','How you set power for take-off, climb and cruise and what limits it.'],
 nums:[['Fuel introduced at start','12 % N1 or more'],['Autoignition','armed for all flight'],['Autofeather','armed for take-off and approach'],['Pressurisation for landing','field + about 500 ft']],
 labs:[['holding.html#explore','Holding and instrument approach lab'],['briefing.html','Briefing trainer']]},
{id:'emer',t:'Abnormal and emergency procedures',sub:'Engine failures, fire, electrical, fuel, pressurisation and gear abnormals',ch:['emer'],sim:'efail',oral:'emergency and abnormal procedures: engine failure on the take-off roll and after lift-off, engine fire, engine shutdown and air start, propeller overspeed, electrical failures, fuel pressure warning, chip detector, bleed air failure, depressurisation and emergency descent, smoke, gear and flap malfunctions, icing abnormals',
 body:`<p>The emergency procedures follow a few patterns. <b>Engine failure</b>: control first (rudder, bank toward the live engine, speed), then power, then identify (dead foot, dead engine), verify (close the suspected power lever, nothing changes), feather, and clean up at blue line. Before rotation, abort; after lift-off with runway left, land again if possible.</p>
<p><b>Fire</b>: identify, then remove fuel, air and ignition from the zone. <b>Electrical</b>: isolate, reset once, shed load, land when the battery is the only source. <b>Pressurisation</b>: oxygen first, then descend. <b>Fuel</b>: understand what the light is telling you before you touch anything.</p>
<p>Memory items are drilled until automatic; everything else is done from the checklist, at a pace the situation allows. The simulator and the scenario of the day practise the decision points.</p>`,
 sees:['Every warning light: confirm with a second indication before an irreversible action (feather, firewall valve, extinguisher).'],
 know:['The memory items of your operator\'s QRH, word for word.','The engine failure drill at each phase of the take-off.','When to land at the nearest suitable airport and when to continue.'],
 nums:[['VMCA','86 KIAS'],['VYSE (blue line)','121 KIAS'],['ALT WARN','12,500 ft cabin'],['Battery-only endurance','limited: shed load at once']],
 labs:[['propeller.html#lt','VMCA and engine failure'],['pressurisation.html#decomp','Decompression lab']]}
];
const keynums=[
 ['Maximum take-off weight','12,500 lb'],['Maximum ramp weight','12,590 lb'],['Maximum landing weight','12,500 lb'],['Maximum zero-fuel weight','11,000 lb','Fuel in the wings relieves bending, so weight above this must be fuel.'],
 ['VMO / MMO','259 KIAS / 0.52 M'],['VA (manoeuvring speed)','181 KIAS'],['VFE, approach flap (40 %)','200 KIAS'],['VFE, full flap (100 %)','157 KIAS'],['VLO extend / retract','181 / 163 KIAS'],['VLE','181 KIAS'],
 ['VMCA','86 KIAS','Take-off power on the live engine, up to 5° bank toward it.'],['VYSE (blue line)','121 KIAS'],['Maximum operating altitude','35,000 ft'],['Yaw damper required above','17,000 ft'],
 ['Load factor limits, flaps up','+3.17 g / −1.27 g'],['Load factor limits, flaps down','+2.0 g / 0 g'],
 ['Engine type and power','PT6A-42, 850 shp'],['Maximum torque','2,230 ft-lb','Within 1,600–2,000 propeller rpm.'],['Torque limit below 1,600 propeller rpm','1,100 ft-lb'],
 ['Maximum ITT, take-off and max continuous','800 °C'],['Maximum ITT, normal cruise','770 °C'],['Maximum ITT during start','1,000 °C for 5 s'],['Maximum ITT, transient','850 °C (time-limited)'],
 ['Maximum N1','101.5 %'],['N1 transient limit','102.6 % for 10 s'],['Low idle N1 (later serials)','61 % minimum','56 % on earlier serials.'],['High idle N1','about 70 %'],
 ['Maximum propeller rpm','2,000 rpm'],['Maximum propeller rpm in reverse','1,900 rpm'],['Propeller transient overspeed','2,200 rpm for 5 s'],['Overspeed governor setting','about 2,120 rpm (106 %)'],
 ['Reverse limits: ITT / N1 / time','750 °C / 88 % / 1 min'],
 ['Normal oil pressure','100–135 psi','85–135 psi accepted at 21,000 ft and above.'],['Oil pressure 60–85 psi','Caution: reduced power, complete the flight'],['Oil pressure below 60 psi','Unsafe: shut down or land at nearest suitable airport'],['Oil temperature range','0 to 99 °C','Up to 104 °C for 10 min.'],
 ['Starter duty cycle','40 s on, 60 s off, 40 on, 60 off, 40 on, then 30 min off'],['Minimum N1 before fuel on start','12 %'],
 ['Autofeather arming','ARM + power levers above ~90 % N1 + both torques above ~400 ft-lb'],['Autofeather: other side disarms at','about 400 ft-lb on the failing engine'],['Autofeather: dump valve opens at','about 200 ft-lb on the failing engine'],['Autoignition active below','about 400 ft-lb torque'],
 ['Starter-generator rating','250 A (300 A optional), 28.25 V'],['Generator load limit, flight up to FL310','100 %'],['Generator load limit above FL310','88 %'],['Generator load limit on the ground','85 %'],['Bus tie current limiters','325 A'],
 ['Battery','24 V, 42 Ah lead-acid','Earlier serials: 34/36 Ah NiCad.'],['Maximum GPU voltage','32 V (later serials)'],['Inverter output limits','105–120 V AC, 380–420 Hz'],
 ['Total usable fuel','544 US gal ≈ 3,645 lb'],['Usable fuel per side: main / auxiliary','193 / 79 US gal'],['Minimum fuel for take-off','265 lb on each MAIN gauge (out of the yellow arc)'],['Maximum fuel imbalance','1,000 lb'],
 ['Operation with FUEL PRESS on','10 h before high-pressure pump overhaul'],['Auxiliary transfer delay after start','30–50 s'],
 ['Maximum cabin differential','6.5 psi'],['Cabin altitude at FL350 (6.5 psi)','about 10,400 ft'],['ALT WARN','cabin 12,500 ft'],['Controller cabin altitude range','−1,000 to 15,000 ft'],['Cabin setting for landing','field elevation + about 500 ft'],
 ['Air conditioning needs at least','about 62 % N1 (right engine)'],['Minimum speed in sustained icing','140 KIAS'],['Windshield heat effective up to','226 KIAS'],['Rudder boost activates at','about 60 psi bleed-pressure difference'],['Regulated pneumatic pressure','about 18 psi']
];
const oral={
 gen:[['Talk me through the annunciator philosophy in this aircraft.',['Red warning panel + MASTER WARNING: immediate attention and action.','Amber caution + MASTER CAUTION: attention, no immediate reaction required.','Green advisory: state information, no master flasher.','Some fuel panel amber lights do not trigger MASTER CAUTION.','Annunciator test before flight because a dead bulb hides a fault.']],['Which systems are split per side, and what links the two sides?',['Fuel: one system per wing, linked by crossfeed.','Electrical: generator buses linked through the centre bus and current limiters; dual-fed buses from both sides.','Bleed air: one supply per engine; one is enough for pressurisation and pneumatics.','Propellers and engines fully independent.']]],
 elec:[['Generator 1 drops off line in cruise. What do you see and what do you do?',['Amber L DC GEN, MASTER CAUTION, gen 1 loadmeter at zero, gen 2 load roughly doubles.','Check gen 2 load is within limits (100 % to FL310, 88 % above).','GEN 1 to RESET for about a second, then ON, once.','If it stays off: switch OFF, reduce load if needed, continue; nothing essential lost.']],['What is on the hot battery bus, and why?',['It is wired directly to the battery, live with the battery switch off.','Fire extinguishers, firewall shutoff valves, entry lights, clock and memory items.','The things you need to secure an engine or a fire must not depend on a switch or a generator.']],['Explain how the generators are protected from each other and from faults.',['Generator control units regulate voltage and trip the generator off line for over/undervoltage and similar faults.','325 A current limiters between each generator bus and the centre bus.','Diodes and limiters on the feeds to the dual-fed buses stop a fault on one side from pulling down the other.']]],
 fuel:[['In what order do the tanks empty, and what do the gauges show?',['Auxiliary first, by jet-pump transfer into the nacelle.','MAIN gauge stays full while auxiliary fuel lasts; AUX gauge falls.','Then the wing tanks gravity-feed the nacelle; MAIN gauge falls.','The nacelle tank level falls last.']],['L FUEL PRESS illuminates in climb. Talk me through it.',['Low pressure ahead of the engine-driven high-pressure pump: boost pump failure or fuel starvation.','Left standby pump ON; the light should go out.','If it does, continue; record the time the HP pump ran without boost (limit typically 10 h).','If it does not: suspect a leak or empty tank; check quantities, consider crossfeed, prepare for an engine failure.']],['What are the jobs of the standby pump?',['Back-up for the engine-driven boost pump.','Supplies motive flow for the auxiliary transfer.','Supplies pressure for crossfeed from its side.','Also required for some fuels and altitudes (avgas).']]],
 power:[['Describe the gas path through a PT6A and what each turbine drives.',['Air in at the rear through the screen, forward through 3 axial + 1 centrifugal compressor stages.','Reverse-flow annular combustor.','Single-stage compressor turbine drives the compressor (N1).','Two-stage power turbine drives the propeller through the reduction gearbox; no mechanical link to N1.','Exhaust at the front.']],['Talk me through a battery start and what can go wrong.',['Check battery voltage, prop lever usually in feather.','Ignition and engine start ON, IGNITION ON light, N1 rising.','At 12 % N1 or more, stable: condition lever LOW IDLE; light-off, ITT peak within limits (1,000 °C, 5 s).','Starter off once the engine accelerates on its own, generator on line.','Hot start (too little air): CUTOFF and motor. Hung start: CUTOFF. No light-off: CUTOFF, motor to clear fuel. Respect the starter cool-down.']]],
 prop:[['Explain how the autofeather works on a take-off engine failure.',['Armed by switch ARM and both power levers above about 90 % N1; two green lights.','Failing engine below about 400 ft-lb: the other engine\'s autofeather disarms (its light goes out).','Below about 200 ft-lb: dump valve on the failing engine opens, oil leaves the hub, counterweights and spring feather the blades.','Only one propeller can autofeather.','Still identify, verify and feather manually per the drill.']],['What protects the engine and propeller against an overspeed?',['Primary governor holds selected rpm (max 2,000).','Overspeed governor at about 106 % (≈ 2,120 rpm) dumps oil to coarsen the blades.','Fuel-topping function on the power turbine reduces fuel if rpm runs away; also limits rpm in reverse.','Both back-ups are tested on the run-up.']]],
 fire:[['Right engine fire light in cruise. Talk me through it.',['Confirm the side: red R ENG FIRE, check ITT, torque, smoke.','Right power lever idle, right prop feather, right condition lever cutoff.','Right firewall shutoff valve closed, extinguisher on the right side if fitted.','Land at the nearest suitable airport; single-engine considerations.','Double-check the side before every irreversible step.']]],
 pneu:[['R BL AIR FAIL illuminates at FL220. What has happened and what do you do?',['A right bleed line has ruptured; the hot air melted the plastic sensing tube.','Right bleed air valve to INSTR & ENVIR OFF.','Left bleed keeps pressurisation and pneumatics.','Rudder boost will not operate with one bleed closed: expect higher forces if an engine fails.','Monitor for heat damage, continue or divert per the QRH.']],['When do the ice vanes go down and how do you know they did?',['In visible moisture at low temperatures (near or below +5 °C), and when in doubt.','Green ENG ANTI-ICE confirms the position; amber ENG ICE FAIL means they did not get there.','Torque drops and ITT rises a little when they extend.','Retract above about +15 °C so the oil cooling is not reduced.']]],
 env:[['The cabin is climbing with the aircraft in the climb. Why?',['The controller is set to a cabin altitude that cannot be held at this aircraft altitude.','Differential has reached the maximum (about 6.5 psi), so the valves limit it and the cabin follows the aircraft.','Reset the controller so the ACFT ALT scale is 500–1,000 ft above the cruise altitude.']],['ALT WARN at FL270. Talk me through it.',['Cabin above 12,500 ft.','Crew oxygen masks on, 100 %, communication.','Check bleed air switches open, CABIN PRESS switch not in DUMP, controller setting.','If the cabin does not recover, emergency descent, passenger oxygen.']]],
 gear:[['You select the gear down and get two green. What now?',['Press to test the unlit light.','Check gear handle lights and warning horn.','Consider recycling if allowed; otherwise manual extension.','Manual: landing gear relay circuit breaker out, handle DOWN, hand pump until three green (or emergency crank).','Prepare for landing with a possibly unlocked leg.']]],
 flt:[['How does the rudder boost know an engine has failed, and how do you test it?',['A differential-pressure switch compares bleed pressure from both engines.','Above about 60 psi difference, a valve sends regulated pneumatic pressure to a servo on the rudder cable.','Needs the boost switch ON and bleed air available from both sides.','Test on the run-up: power up one engine, the rudder pedal should move in the correct direction.']]],
 avio:[['Your airspeed indicator disagrees with the copilot side. What do you check?',['Pitot heat on and working; icing.','Which pitot mast feeds which side (left = pilot, right = copilot).','Compare with the standby instrument.','Alternate static for the pilot side if a static blockage is suspected.','Fly attitude and power meanwhile.']]],
 lim:[['Give me the engine limits for take-off.',['Torque 2,230 ft-lb.','ITT 800 °C.','N1 101.5 %.','Propeller 2,000 rpm.','Oil 100–135 psi, 0–99 °C.']],['Give me the speed limitations.',['VMO 259 KIAS / MMO 0.52.','VA 181, VFE 200 approach / 157 full.','VLO 181 down / 163 up, VLE 181.','VMCA 86, VYSE 121.']]],
 wbp:[['Why is there a maximum zero-fuel weight?',['Fuel in the wings relieves the bending load at the wing root.','Payload in the fuselage does not.','Above the zero-fuel weight, extra weight must be fuel to stay within the wing structure limit.']],['What reduces single-engine climb performance and by how much?',['Altitude and temperature (density altitude) reduce engine power and climb.','Weight increases the power required.','Windmilling propeller, gear and flaps add drag.','Speed away from blue line and poor technique (no bank, ball not centred) cost climb.']]],
 flows:[['Why do you test the autofeather and overspeed governor on the run-up?',['They protect you in situations you cannot test in flight: engine failure and governor failure.','Autofeather test checks torque switches, arming relays, dump valve and lights.','Overspeed governor test resets it below 2,000 rpm to prove it can limit rpm.','A failed test is a go/no-go decision.']],['How do you set the pressurisation controller and why?',['Before take-off: ACFT ALT scale about 500–1,000 ft above cruise altitude, rate as preferred.','During descent: cabin about 500 ft above field elevation.','So the cabin stays inside the differential limit in cruise and arrives unpressurised.']]],
 emer:[['Engine failure just after lift-off, gear still down. Talk me through it.',['Control: rudder, bank toward the live engine, pitch for VYSE (blue line).','Power up on the live engine.','Gear up when the decision to continue is made and climb is positive.','Identify (dead foot dead engine), verify (power lever), feather (autofeather may have done it: confirm).','Clean up, climb at blue line, secure the engine, declare an emergency.']],['Both generators fail in IMC. What is your plan?',['Both DC GEN lights; battery discharging.','Reset each once.','Shed every non-essential load at once.','Land at the nearest suitable airport; endurance depends on the load.','Plan for gear and flap extension needs and reduced avionics.']]]
};
const phases=[
 ['Before start','The aircraft is configured so that the start cannot hurt it and so that every warning system has proven it works.',['Annunciator and fire tests first: a dead bulb or detector hides the very fault you start the engines to find.','Fuel quantity, crossfeed off, firewall valves open: each engine starts on its own tanks.','Electrical loads off before a battery start, to give the starter every amp.','Pressurisation controller set now, while there is time: cruise altitude plus 500–1,000 ft.']],
 ['Engine start','Air before fuel, and a hand on the condition lever until the engine is at idle.',['Prop in feather so the starter only turns the gas generator.','Fuel only at 12 % N1 or more: enough airflow to keep ITT inside the limit.','The ITT peak comes seconds after light-off: watch the trend.','Starter off when the engine accelerates on its own; respect the duty cycle.','Generator on after the start: after a battery start the recharge load is high, so watch ITT and the loadmeter.']],
 ['After start and taxi','Bring the systems on line in an order that protects them, then prove the brakes and steering.',['Avionics on after the starts so they are not exposed to the start transients.','Both generators on line and sharing; check both inverters.','Beta for speed control saves brakes; avoid it on loose surfaces where the propellers pick up debris.','Instruments checked while turning: heading, turn indicator, attitude.']],
 ['Run-up and before take-off','Test the systems you cannot test in flight, then configure for the worst case: an engine failure.',['Autofeather test: torque switches, dump valves and lights.','Overspeed governor test: the back-up can limit rpm.','Rudder boost test: the pedal moves the right way when one engine has more bleed pressure.','Ice protection checked if needed; bleed air, pressurisation set; trims and flaps set; departure briefing including the engine failure.']],
 ['Take-off','Power within limits on both engines, and every protection for an engine failure armed.',['Autofeather ARM, autoignition ARM before the roll.','Set power to the first limit reached: torque, ITT or N1.','Abort before rotation; after lift-off fly the drill: control, power, identify, verify, feather.','Gear up with a positive rate and no usable runway ahead.']],
 ['Climb','Reduce to climb power, then tidy the systems you armed for take-off.',['Climb power within the ITT and torque limits; ITT often becomes the limit as you climb.','Autofeather off when the critical phase is over (as your SOP says).','Yaw damper on (required above 17,000 ft).','Watch the cabin climb against the selected rate; ice vanes up out of moisture.']],
 ['Cruise','Set power from the tables and then monitor the things that change slowly.',['Cruise power set by torque, with ITT as the usual limit at altitude.','Fuel: auxiliary transfer working, MAIN gauges full while auxiliary lasts, imbalance within 1,000 lb.','Generator loads, oil pressure and temperature, cabin differential.','Plan the descent including icing and the minimum speed in icing.']],
 ['Descent','Prepare the systems for the arrival before the workload rises.',['Pressurisation controller to field elevation plus about 500 ft, and a rate that lets the cabin arrive before you do.','Ice protection on before entering icing, not after.','Approach briefing including the missed approach on one engine.']],
 ['Approach and landing','Configure on a schedule so the aircraft is stable; keep the engine failure options open.',['Autofeather armed for the approach (as your SOP says): a go-around on one engine is the worst case.','Gear down before flaps beyond approach: the horn logic is built around it.','Propellers forward for the landing so full power is available for a go-around.','After touchdown: beta, then reverse within its limits; reverse is most effective at high speed.']],
 ['Shutdown','Cool the engine, then stop it in an order that protects the battery and the propellers.',['Let ITT stabilise at idle for the time your AFM gives before cutting fuel.','Avionics and loads off before the generators drop off.','Propellers feathered, condition levers cut-off; watch ITT fall.','Battery off last; control locks in.']]
];
const scen=[
 {t:'FUEL PRESS on the climb-out',set:'Passing 3,000 ft after take-off, the red L FUEL PRESS light comes on with MASTER WARNING. Engine indications are normal.',
  dp:[{q:'What is your first action?',o:[['Feather the left engine immediately.',false,'The engine is running normally. A red light demands attention, but shutting down a running engine on a fuel pressure warning removes half your power for nothing.'],['Left standby pump ON and watch the light.',true,'The light means low pressure before the high-pressure pump: the standby pump is the back-up for the engine-driven boost pump.'],['Open the crossfeed.',false,'Crossfeed is for single-engine operation. Restore pressure on the left side first.']]},
      {q:'The light goes out. Now what?',o:[['Continue the flight with the standby pump on, record the event.',true,'With pressure restored the engine is fine. Time on the high-pressure pump without boost is limited and must be logged.'],['Return immediately, single-engine.',false,'Nothing calls for a shutdown. A return may be wise depending on the flight, but on two engines.'],['Switch the standby pump off again to check.',false,'You would remove the boost pressure in the climb to test something you already know.']]}],
  deb:'A fuel pressure warning is a pressure problem, not an engine failure. Restore the pressure and keep watching the quantity: a leak would show as a quantity drop.'},
 {t:'Generator failure in IMC',set:'Cruising at FL230 in cloud, L DC GEN illuminates. The right loadmeter reads 82 %.',
  dp:[{q:'What do you do first?',o:[['GEN 1 to RESET, then ON, once.',true,'One reset attempt is the standard first step; a trip may clear.'],['Shed all non-essential loads at once.',false,'One generator can carry the load. Load shedding is for when the remaining capacity is not enough.'],['Select the other inverter.',false,'The inverter has not failed; the AC indications are normal.']]},
      {q:'The reset does not work. The right generator is at 82 %, limit 88 % above FL310 and 100 % below. Your plan?',o:[['GEN 1 OFF, continue at FL230, keep the load in check.',true,'Below FL310 the limit is 100 %; 82 % is fine. Turning the failed generator off avoids repeated cycling.'],['Climb to FL330 to get above the weather.',false,'Above FL310 the generator limit falls to 88 %, and you are already at 82 % with nothing in reserve.'],['Declare an emergency and divert at once.',false,'You have one generator within its limits and a battery. Plan sensibly; a precautionary diversion depends on weather and distance, but this is not an emergency.']]}],
  deb:'Single generator failure: reset once, then manage the load against the limit for your altitude. The dual-fed buses mean nothing essential is lost.'},
 {t:'Bleed air failure',set:'At FL220 the red R BL AIR FAIL light comes on.',
  dp:[{q:'What has happened?',o:[['A right engine fire.',false,'That would be R ENG FIRE. BL AIR FAIL is a ruptured bleed line melting the sensing tube.'],['A right bleed line has ruptured and hot air is escaping.',true,'The plastic tube along the bleed line melted, the pressure dropped and the light came on.'],['The right pressurisation controller failed.',false,'There is only one controller; this light is about the bleed line.']]},
      {q:'Your action?',o:[['Right bleed air valve to INSTR & ENVIR OFF.',true,'Isolate the leaking line. The left side keeps pressurisation, heating and pneumatics.'],['Both bleed air valves off and descend.',false,'You would lose all pressurisation for a fault on one side.'],['Dump the cabin.',false,'There is nothing wrong with the cabin.']]}],
  deb:'With one bleed valve closed the rudder boost will not work. Brief that an engine failure would mean higher pedal forces.'},
 {t:'Engine failure at 400 ft',set:'Take-off at maximum weight, autofeather armed. At 400 ft the aircraft yaws sharply to the left; the left torque is falling.',
  dp:[{q:'First?',o:[['Identify the engine with the annunciators.',false,'Control comes first. A sharp yaw at low speed and low height needs rudder and attitude now.'],['Right rudder, bank slightly right, pitch for blue line.',true,'Keep it straight with rudder, about 5° bank toward the live engine, and hold VYSE.'],['Retard both power levers.',false,'You need all the power the right engine has.']]},
      {q:'The green R AUTOFEATHER light went out, then the L light went out and the left propeller is slowing. What does that tell you?',o:[['The autofeather has feathered the right propeller.',false,'The right engine is running. The right light went out because its circuit is armed by the left torque, which fell.'],['The autofeather has done its job on the left engine; verify and confirm feather.',true,'Left torque passed about 400 ft-lb (right side disarmed), then about 200 ft-lb (left dump valve opened). Verify with the left power lever and confirm the left prop lever to feather.'],['The autofeather has failed.',false,'That sequence is exactly how it works.']]}],
  deb:'Autofeather removes the windmilling drag fast, but the drill does not change: control, power, identify, verify, feather, clean up, blue line.'},
 {t:'Hung start on a cold morning',set:'Battery start of the right engine at −10 °C. Light-off at 13 % N1, ITT peaks at 720 °C, but N1 stops at 38 % and ITT is slowly rising through 780 °C.',
  dp:[{q:'Your action?',o:[['Advance the condition lever to HIGH IDLE to help it.',false,'More fuel with too little air raises ITT further. A hung start is not cured with fuel.'],['Condition lever FUEL CUTOFF, keep motoring briefly, then starter off.',true,'Stop the fuel, let the airflow cool the engine, then stop within the starter limits.'],['Wait: it will accelerate when the oil warms.',false,'Waiting with ITT rising is how a hung start becomes a hot start.']]},
      {q:'Next attempt?',o:[['Immediately try again on the battery.',false,'The starter needs its cool-down, and the battery is weaker than before.'],['Wait for the starter cool-down and use ground power, or start the other engine first and cross-start.',true,'More starter speed means more air: GPU or the other generator.'],['Use STARTER ONLY for two minutes to warm the engine.',false,'That breaks the starter duty cycle.']]}],
  deb:'Every abnormal start is too little air or too much fuel. A cold battery gives a slow starter: fix the air.'},
 {t:'ALT WARN in cruise',set:'FL270. The red ALT WARN light comes on; the cabin altimeter reads 12,600 ft and climbing slowly.',
  dp:[{q:'First?',o:[['Check the pressurisation controller.',false,'Masks first. At 12,600 ft cabin and climbing your time to act well is shrinking.'],['Crew oxygen masks on, 100 %, establish communication.',true,'Protect the crew before troubleshooting.'],['Start an emergency descent immediately.',false,'Masks first; the descent may follow within seconds, but not before you have oxygen.']]},
      {q:'Masks on. The CABIN PRESS switch is in DUMP. Your action?',o:[['Switch to PRESS, monitor the cabin, descend if it does not recover.',true,'A switch in DUMP keeps the safety valve open. Correct it and watch the cabin descend; be ready to descend.'],['Leave it; the cabin will recover by itself.',false,'With the safety valve held open, it will not.'],['Close both bleed air valves.',false,'That stops the air supply entirely.']]}],
  deb:'ALT WARN: oxygen first, then find the cause (bleed switches, dump, controller), then descend if the cabin does not come back.'},
 {t:'Two green lights',set:'On a visual approach you select the gear down. After the normal time you have left and nose green; the right light is out and the handle lights are on.',
  dp:[{q:'First check?',o:[['Press the right green light to test the bulb.',true,'A failed bulb is the most likely cause. The handle lights being on suggests a real problem though.'],['Pull the landing gear relay circuit breaker.',false,'That is part of the manual extension, not the first check.'],['Land: two greens are enough.',false,'An unlocked main leg can collapse.']]},
      {q:'The bulb is fine and the handle lights stay on. Plan?',o:[['Go around, climb to a safe altitude, run the manual extension checklist.',true,'Give yourself time and height for the manual extension.'],['Pump the hand pump on short final.',false,'Manual extension at low height and high workload is a bad plan.'],['Retract the gear and land gear-up.',false,'Not before you have tried the manual extension.']]}],
  deb:'Time and height turn a gear problem into a checklist exercise.'},
 {t:'NO TRANSFER with fuel in the auxiliary tank',set:'One hour into the flight the amber L NO TRANSFER light comes on. The left AUX gauge shows 300 lb.',
  dp:[{q:'What does it mean?',o:[['The left auxiliary fuel is not being transferred to the nacelle.',true,'Motive flow has been lost or the valve did not open while there is fuel in the auxiliary tank.'],['The left auxiliary tank is empty.',false,'The float switch closes the transfer when it is empty without a light.'],['The left engine has lost fuel pressure.',false,'That would be L FUEL PRESS (red).']]},
      {q:'Your action?',o:[['Select OVERRIDE for the left transfer and watch the light and the gauges.',true,'Override opens the motive flow valve directly.'],['Open the crossfeed.',false,'Crossfeed does not move auxiliary fuel.'],['Shut down the left engine to save fuel.',false,'There is nothing wrong with the engine.']]}],
  deb:'If override does not work, the 300 lb in the left auxiliary tank is unusable: re-plan the fuel and expect a growing imbalance.'}
];
G.B200C={mods,keynums,oral,phases,scen};
})(window);
