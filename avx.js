/* Birdbird – avionikk-logikk for glass cockpit-treneren: radioer, CDI, FMS-vinduer, softkeys og bezel-kontroller.
   Funksjonene følger vanlig glass-cockpit-arbeidsflyt (NAV/COM, CRS/BARO, FMS, D→, FPL, PROC, MENU, CLR, ENT). Grafikken er vår egen. */
(function(G){
'use strict';
const F=G.FDM, M=G.FMS;
const w360=M.w360, clamp=F.clamp;

/* ---------- tilstand ---------- */
const A={
  radio:{nav:[{act:'113.30',stby:'110.30'},{act:'116.50',stby:'108.00'}],com:[{act:'118.300',stby:'121.500'},{act:'124.350',stby:'136.975'}],navSel:0,comSel:0},
  cdi:'GPS', crs:[360,360], baro:1013, baroStd:false, fp:M.mkFP(),
  win:{P:null,M:null}, mfdPage:'MAP', soft:{P:'top',M:'top'}, inset:false, dme:false, wind:true, xpdr:{code:'7000',mode:'ALT',entry:null}, ident:0,
  timer:{run:false,t:0}, mins:{on:true,ft:200}, brg:[0,0], mapRange:10, mapMode:'N', dcltr:false, msgs:[], lastSeq:null
};
const CH=' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/* ---------- radio ---------- */
function stepFreq(f,dMHz,dk,isCom){
  let [mhz,khz]=f.split('.').map(Number); khz=khz*(isCom?1:10); // NAV: 2 desimaler, COM: 3
  if(dMHz){ const lo=isCom?118:108, hi=isCom?136:117; mhz=lo+((mhz-lo+dMHz)%(hi-lo+1)+(hi-lo+1))%(hi-lo+1); }
  if(dk){ const st=isCom?25:50, n=1000/st; khz=(((Math.round(khz/st)+dk)%n+n)%n)*st; }
  return isCom? mhz+'.'+String(khz).padStart(3,'0') : mhz+'.'+String(khz/10).padStart(2,'0');
}
function navAct(i){ return A.radio.nav[i].act; }
function navStation(i){ return M.navaid(navAct(i)); }

/* ---------- CDI-kilde ---------- */
function cdiLabel(){ if(A.cdi==='GPS') return 'GPS'; const i=A.cdi==='NAV1'?0:1; const st=navStation(i); return (st&&st.type==='LOC'?'LOC':'VOR')+(i+1); }
function cycleCdi(){ A.cdi= A.cdi==='GPS'?'NAV1':A.cdi==='NAV1'?'NAV2':'GPS'; const i=A.cdi==='NAV2'?1:0; const st=navStation(i); if(A.cdi!=='GPS'&&st&&st.type==='LOC') A.crs[i]=st.crs; }
function navNow(s,gsKt){
  const g=M.gps(A.fp,s,gsKt);
  if(A.cdi==='GPS'){ g.label='GPS'; g.color='mag'; return {cdi:g,gps:g}; }
  const i=A.cdi==='NAV1'?0:1; const n=F.navFreq(s,navAct(i),A.crs[i],M.NAVAIDS);
  n.label=cdiLabel(); n.color='grn'; n.crs=A.crs[i]; if(n.src==='LOC') n.locCrs=(navStation(i)||{}).crs;
  return {cdi:n,gps:g};
}
/* automatisk bytte fra GPS til LOC på ILS (når LOC er innstilt) */
function autoSlew(s,cdi){
  const fp=A.fp; if(A.cdi!=='GPS'||!fp.appr||fp.appr.kind!=='ILS'||!fp.apprActive) return false;
  if(navAct(0)!==fp.appr.loc) return false;
  const faf=fp.wps.find(w=>w.appr&&w.faf); if(!faf) return false;
  const n=F.navFreq(s,navAct(0),fp.appr.crs,M.NAVAIDS);
  const nearFinal=fp.wps[fp.act]&&(fp.wps[fp.act].faf||fp.wps[fp.act].mapt||(fp.wps[fp.act].id==='RONAX'));
  if(n.valid&&Math.abs(n.dev)<1.0&&nearFinal){ A.cdi='NAV1'; A.crs[0]=fp.appr.crs; msg('CDI → LOC1'); return true; }
  return false;
}
function msg(t){ A.msgs.unshift({t,time:Date.now()}); if(A.msgs.length>8) A.msgs.pop(); }

/* ---------- FMS-vinduer ---------- */
function curDisp(d){ return d==='P'?'P':'M'; }
function openWin(d,w){ A.win[d]=w; }
function closeWin(d){ A.win[d]=null; }
function entry(init,onEnt){ const t=(init||'').toUpperCase().padEnd(5,' ').slice(0,6).split(''); return {kind:'entry',chars:t,cur:0,onEnt}; }
function entryText(e){ return e.chars.join('').trim(); }

function key(d,k,ctx){
  const S=ctx.s, W=A.win[d];
  const pos={N:S.N,E:S.E};
  switch(k){
    case 'FPL': if(W&&W.type==='FPL') closeWin(d); else openWin(d,{type:'FPL',cursor:false,idx:Math.max(0,A.fp.act)}); return;
    case 'DTO': { let pre=''; if(W&&W.type==='FPL'&&W.cursor&&A.fp.wps[W.idx]) pre=A.fp.wps[W.idx].id; else if(W&&W.type==='NRST'&&W.list[W.idx]) pre=W.list[W.idx].d.id; else if(A.fp.wps[A.fp.act]) pre=A.fp.wps[A.fp.act].id;
      openWin(d,{type:'DTO',e:entry(pre),stage:0,back:null}); return; }
    case 'PROC': if(W&&W.type==='PROC') closeWin(d); else openWin(d,{type:'PROC',stage:'menu',idx:2}); return;
    case 'MENU': openWin(d,{type:'MENU',under:W,idx:0,items:menuItems(W)}); return;
    case 'CLR':
      if(!W) return;
      if(W.type==='FPL'&&W.cursor){ const w=A.fp.wps[W.idx]; if(w) openWin(d,{type:'CONF',text:w.appr?`Remove ${A.fp.appr.name}?`:`Remove ${w.id}?`,ok:()=>{ M.remove(A.fp,W.idx); W.idx=Math.min(W.idx,Math.max(0,A.fp.wps.length-1)); openWin(d,W); },cancel:()=>openWin(d,W)}); return; }
      if(W.type==='WPT'||W.type==='DTO'){ const e=W.type==='WPT'?W.e:W.e; if(entryText(e)) { e.chars=e.chars.map(()=>' '); e.cur=0; return; } }
      if(W.type==='CONF'&&W.cancel){ W.cancel(); return; }
      if(W.type==='WPT'&&W.back){ openWin(d,W.back); return; }
      if(W.type==='MENU'&&W.under){ openWin(d,W.under); return; }
      if(W.type==='PROC'&&W.stage!=='menu'){ W.stage=W.stage==='load'?'trans':W.stage==='trans'?'appr':'menu'; W.idx=0; return; }
      closeWin(d); return;
    case 'ENT':
      if(!W) return;
      if(W.type==='DTO'){ if(W.stage===0){ const id=M.match(entryText(W.e)); if(id){ W.e=entry(id); W.stage=1; } return; } const id=entryText(W.e); if(M.directTo(A.fp,id,pos)){ msg('D→ '+id); ctx.onDirect&&ctx.onDirect(); } closeWin(d); return; }
      if(W.type==='WPT'){ const id=M.match(entryText(W.e)); if(id){ W.onDone(id); } return; }
      if(W.type==='CONF'){ W.ok(); return; }
      if(W.type==='MENU'){ const it=W.items[W.idx]; if(it&&it.fn){ it.fn(); } if(A.win[d]===W) openWin(d,W.under&&W.under.type?W.under:null); return; }
      if(W.type==='NRST'){ const it=W.list[W.idx]; if(it) openWin(d,{type:'DTO',e:entry(it.d.id),stage:1}); return; }
      if(W.type==='TMR'){ if((W.idx||0)===0) A.timer.run=!A.timer.run; else if(W.idx===1) A.mins.on=!A.mins.on; else if(W.idx===2) A.timer.t=0; return; }
      if(W.type==='FPL'){ if(W.cursor){ /* ENT på et punkt: ingen handling */ } return; }
      if(W.type==='PROC') return procEnt(d,W,ctx);
      return;
    case 'PUSH': // FMS-knott trykk
      if(W&&W.type==='FPL'){ W.cursor=!W.cursor; return; }
      if(W&&(W.type==='DTO'||W.type==='WPT')) return;
      if(W) return;
      if(d==='M'&&A.mfdPage==='NRST'){ openWin(d,nrstWin(S)); } return;
  }
}
function menuItems(W){
  const fp=A.fp, it=[];
  if(W&&W.type==='FPL'&&W.cursor&&fp.wps[W.idx]) it.push({t:'Activate Leg?',fn:()=>{ M.activateLegTo(fp,W.idx,null,false); if(W.idx===0) fp.dto=null; fp.susp=false; msg('Leg activated'); }});
  it.push({t:'Delete Flight Plan?',fn:()=>{ A.fp=M.mkFP(); }});
  if(fp.appr) it.push({t:'Remove Approach?',fn:()=>M.removeAppr(fp)});
  if(fp.susp) it.push({t:'Resume sequencing (SUSP)?',fn:()=>M.unsuspend(fp)});
  return it;
}
function nrstWin(S){ return {type:'NRST',list:M.nearest(S,'APT').slice(0,8),idx:0}; }

/* PROC-flyt */
function procEnt(d,W,ctx){
  const S=ctx.s, pos={N:S.N,E:S.E}, fp=A.fp;
  if(W.stage==='menu'){
    const items=procMenu(); const it=items[W.idx]; if(!it||it.dis) return;
    if(it.k==='VTF'){ if(M.activateAppr(fp,pos,true)){ msg('Vectors to final'); } closeWin(d); return; }
    if(it.k==='ACT'){ if(M.activateAppr(fp,pos,false)){ msg('Approach activated'); } closeWin(d); return; }
    if(it.k==='SEL'){ W.stage='appr'; W.apt=destApt(); W.idx=0; return; }
    return;
  }
  if(W.stage==='appr'){ const list=M.APPR[W.apt]||[]; W.appr=list[W.idx]; if(!W.appr) return; W.stage='trans'; W.idx=0; return; }
  if(W.stage==='trans'){ const tr=Object.keys(W.appr.trans); W.trans=tr[W.idx]; W.stage='load'; W.idx=1; return; }
  if(W.stage==='load'){
    const act=W.idx===1;
    M.loadAppr(fp,W.apt,W.appr,W.trans,act,pos);
    if(W.appr.kind==='ILS'){ const n=A.radio.nav[0]; if(n.act!==W.appr.loc){ if(A.cdi==='GPS'){ n.stby=n.act; n.act=W.appr.loc; } else n.stby=W.appr.loc; } A.crs[0]=W.appr.crs; }
    msg((act?'Activated ':'Loaded ')+W.appr.name+' '+W.trans);
    ctx.onLoad&&ctx.onLoad(act); closeWin(d); return;
  }
}
function destApt(){ const en=A.fp.wps.filter(w=>!w.appr&&w.type==='APT'); return en.length? en[en.length-1].id : 'NAER'; }
function procMenu(){ const fp=A.fp; return [
  {k:'VTF',t:'ACTIVATE VECTOR-TO-FINAL',dis:!fp.appr},
  {k:'ACT',t:'ACTIVATE APPROACH',dis:!fp.appr},
  {k:'SEL',t:'SELECT APPROACH'},
  {k:'ARR',t:'SELECT ARRIVAL',dis:true},
  {k:'DEP',t:'SELECT DEPARTURE',dis:true} ]; }

/* FMS-knott */
function fms(d,which,step,ctx){
  const W=A.win[d];
  if(!W){ if(d==='M'&&which==='outer'){ A.mfdPage=A.mfdPage==='MAP'?'NRST':'MAP'; if(A.mfdPage==='NRST') openWin('M',nrstWin(ctx.s)); } return; }
  if(W.type==='DTO'||W.type==='WPT'){
    const e=W.e; if(W.type==='DTO') W.stage=0;
    if(which==='inner'){ const c=e.chars[e.cur]||' '; let i=CH.indexOf(c); i=((i+step)%CH.length+CH.length)%CH.length; e.chars[e.cur]=CH[i];
      // fyll ut automatisk som i en typisk glass cockpit
      const pre=e.chars.slice(0,e.cur+1).join('').trim(); const m=M.match(pre); if(m){ for(let k=e.cur+1;k<e.chars.length;k++) e.chars[k]=m[k]||' '; } }
    else e.cur=clamp(e.cur+step,0,e.chars.length-1);
    return; }
  if(W.type==='FPL'){
    if(!W.cursor){ if(which==='inner') return; W.cursor=true; return; }
    if(which==='outer'){ W.idx=clamp(W.idx+step,0,A.fp.wps.length); return; }
    // inner: legg inn punkt foran markøren
    const back=W; const e=entry('');
    const ch=CH.indexOf('A'); e.chars[0]=CH[((ch+step-1)%CH.length+CH.length)%CH.length];
    openWin(d,{type:'WPT',e,back,onDone:id=>{ M.insert(A.fp,W.idx,id); openWin(d,back); }});
    return; }
  if(W.type==='PROC'){ const n=W.stage==='menu'?procMenu().length:W.stage==='appr'?(M.APPR[W.apt]||[]).length:W.stage==='trans'?Object.keys(W.appr.trans).length:2; W.idx=clamp(W.idx+step,0,n-1); return; }
  if(W.type==='MENU'){ W.idx=clamp(W.idx+step,0,W.items.length-1); return; }
  if(W.type==='NRST'){ W.idx=clamp(W.idx+step,0,W.list.length-1); return; }
  if(W.type==='TMR'){ if(which==='outer') W.idx=clamp((W.idx||0)+step,0,2); else if((W.idx||0)===1){ A.mins.ft=clamp(A.mins.ft+step*10,0,16000); A.mins.on=true; } return; }
}
/* tastatur som snarvei for tegninntasting */
function typeChar(d,ch){ const W=A.win[d]; if(!W||!(W.type==='DTO'||W.type==='WPT')) return false; const e=W.e; if(W.type==='DTO') W.stage=0;
  if(ch==='BS'){ e.chars[Math.max(0,e.cur-(e.chars[e.cur]===' '?1:0))]=' '; e.cur=Math.max(0,e.cur-1); return true; }
  e.chars[e.cur]=ch; const pre=e.chars.slice(0,e.cur+1).join('').trim(), m=M.match(pre); for(let k=e.cur+1;k<e.chars.length;k++) e.chars[k]=m?(m[k]||' '):' '; e.cur=Math.min(e.chars.length-1,e.cur+1); return true; }

/* ---------- visning av vinduer (modell til tegning) ---------- */
function view(d,S){
  const W=A.win[d]; if(!W) return null; const fp=A.fp;
  if(W.type==='FPL'){
    const rows=M.legRows(fp); const out=[]; let apHdr=false;
    rows.forEach(r=>{ if(r.w.appr&&!apHdr){ apHdr=true; out.push({hdr:`Approach – ${fp.appr.apt}-${fp.appr.name} ${fp.appr.trans}`}); }
      if(r.w.missed&&!out.some(x=>x.mhdr)) out.push({hdr:'Missed Approach',mhdr:true});
      out.push({id:r.w.id,dtk:r.dtk,dis:r.dis,alt:r.w.alt,act:r.i===fp.act,from:r.i===fp.act-1&&!fp.dto,sel:W.cursor&&r.i===W.idx,i:r.i}); });
    if(W.cursor&&W.idx>=fp.wps.length) out.push({id:'_____',sel:true,blank:true});
    else out.push({id:'',blank:true,sel:false});
    const orig=fp.wps[0]?fp.wps[0].id:'____', dest=destApt();
    return {type:'FPL',title:'ACTIVE FLIGHT PLAN',sub:`${orig} / ${dest}`,rows:out,susp:fp.susp};
  }
  if(W.type==='DTO'||W.type==='WPT'){
    const id=M.match(entryText(W.e)); const db=id?M.DB[id]:null;
    let brg=null,dis=null; if(db){ const g=M.geo(S,db); brg=g.brg; dis=g.dist/M.NM; }
    return {type:W.type,title:W.type==='DTO'?'DIRECT TO':'INSERT WAYPOINT',chars:W.e.chars,cur:W.e.cur,name:db?db.name:'',kind:db?db.type:'',brg,dis,activate:W.type==='DTO'&&W.stage===1};
  }
  if(W.type==='PROC'){
    if(W.stage==='menu') return {type:'LIST',title:'PROCEDURES',items:procMenu().map(x=>({t:x.t,dis:x.dis})),idx:W.idx,foot:'Turn FMS to select · ENT'};
    if(W.stage==='appr') return {type:'LIST',title:`SELECT APPROACH · ${W.apt}`,items:(M.APPR[W.apt]||[]).map(a=>({t:`${a.name}${a.lpv?'  LPV':''}`})),idx:W.idx,foot:'ENT to select'};
    if(W.stage==='trans') return {type:'LIST',title:`${W.apt} ${W.appr.name} · TRANSITION`,items:Object.keys(W.appr.trans).map(t=>({t:t==='VECTORS'?'VECTORS':t+'  (IAF)'})),idx:W.idx,foot:'ENT to select'};
    if(W.stage==='load') return {type:'LIST',title:`${W.apt} ${W.appr.name} ${W.trans}`,items:[{t:'LOAD?'},{t:'ACTIVATE?'}],idx:W.idx,foot:W.appr.kind==='ILS'?`LOC ${W.appr.loc} will be tuned`:'GPS approach with LPV'};
  }
  if(W.type==='MENU') return {type:'LIST',title:'PAGE MENU',items:W.items.length?W.items.map(x=>({t:x.t})):[{t:'No options',dis:true}],idx:W.idx,foot:'ENT to accept · CLR to close'};
  if(W.type==='CONF') return {type:'LIST',title:'CONFIRM',items:[{t:W.text},{t:'ENT = YES   CLR = NO',dis:true}],idx:0};
  if(W.type==='NRST'){ const L=W.list.map(x=>({t:`${x.d.id.padEnd(6)} ${String(Math.round(x.brg)).padStart(3,'0')}°  ${x.dist.toFixed(1)}NM  ${x.d.rwy||''}`})); return {type:'LIST',title:'NEAREST AIRPORTS',items:L,idx:W.idx,foot:'ENT = direct to'}; }
  if(W.type==='TMR'){ const t=A.timer.t; return {type:'LIST',title:'TIMER / REFERENCES',items:[{t:`TIMER  ${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${String(Math.floor(t)%60).padStart(2,'0')}   ${A.timer.run?'STOP?':'START?'}`},{t:`MINIMUMS  BARO  ${A.mins.ft}FT   ${A.mins.on?'ON':'OFF'}`},{t:'RESET TIMER?'},{t:'Vr 80  Vy 90  Vyse 85  Vmca 76  Vref 84',dis:true}],idx:W.idx||0,foot:'Outer: row · inner: set MINS · ENT: toggle'}; }
  if(W.type==='ALERTS') return {type:'LIST',title:'ALERTS',items:(A.msgs.length?A.msgs:[{t:'No messages'}]).map(m=>({t:m.t})),idx:-1};
  return null;
}

/* ---------- softkeys ---------- */
function softPFD(){
  const a=Array(12).fill(''), m=A.soft.P;
  if(m==='top'){ a[1]={t:'INSET',on:A.inset}; a[3]={t:'PFD'}; a[4]={t:'OBS',on:A.fp.obs!=null,dim:A.cdi!=='GPS'}; a[5]={t:'CDI'}; a[6]={t:'DME',on:A.dme}; a[7]={t:'XPDR'}; a[8]={t:'IDENT',on:A.ident>0}; a[9]={t:'TMR/REF'}; a[10]={t:'NRST'}; a[11]={t:'ALERTS'}; }
  if(m==='PFD'){ a[1]={t:'WIND',on:A.wind}; a[2]={t:'DME',on:A.dme}; a[3]={t:'BRG1',on:A.brg[0]>0}; a[5]={t:'BRG2',on:A.brg[1]>0}; a[9]={t:'STD BARO',on:A.baroStd}; a[10]={t:'BACK'}; a[11]={t:'ALERTS'}; }
  if(m==='XPDR'){ a[2]={t:'STBY',on:A.xpdr.mode==='STBY'}; a[3]={t:'ON',on:A.xpdr.mode==='ON'}; a[4]={t:'ALT',on:A.xpdr.mode==='ALT'}; a[6]={t:'VFR'}; a[7]={t:'CODE'}; a[8]={t:'IDENT',on:A.ident>0}; a[10]={t:'BACK'}; a[11]={t:'ALERTS'}; }
  if(m==='CODE'){ for(let i=0;i<8;i++) a[i+1]={t:String(i)}; a[9]={t:'IDENT'}; a[10]={t:'BKSP'}; a[11]={t:'BACK'}; }
  return a;
}
function softMFD(){
  const a=Array(12).fill(''), m=A.soft.M;
  if(m==='top'){ a[0]={t:'ENGINE',dim:true}; a[2]={t:'MAP'}; a[8]={t:'DCLTR',on:A.dcltr}; a[10]={t:'RNG −'}; a[11]={t:'RNG +'}; }
  if(m==='MAP'){ a[0]={t:A.mapMode==='N'?'NORTH UP':'TRK UP',on:true}; a[2]={t:'CLR TRAIL'}; a[10]={t:'BACK'}; }
  return a;
}
function soft(d,i,ctx){
  const lab=(d==='P'?softPFD():softMFD())[i]; if(!lab||lab.dim){ if(lab&&lab.dim) msg(lab.t+' is not simulated'); return; } const t=lab.t;
  if(d==='P'){
    const m=A.soft.P;
    if(m==='CODE'){ if(/^\d$/.test(t)){ const e=A.xpdr.entry=(A.xpdr.entry||'')+t; if(e.length===4){ A.xpdr.code=e; A.xpdr.entry=null; A.soft.P='XPDR'; } return; } if(t==='BKSP'){ A.xpdr.entry=(A.xpdr.entry||'').slice(0,-1); return; } if(t==='BACK'){ A.xpdr.entry=null; A.soft.P='XPDR'; return; } }
    switch(t){
      case 'INSET': A.inset=!A.inset; return;
      case 'OBS': { const fp=A.fp; if(fp.obs!=null){ fp.obs=null; fp.dto=null; const w=fp.wps[fp.act]; if(w) fp.dto={N:ctx.s.N,E:ctx.s.E}; } else if(fp.wps[fp.act]){ const g=M.gps(fp,ctx.s,0); fp.obs=Math.round(g.valid?g.dtk:0); } return; }
      case 'BRG1': A.brg[0]=(A.brg[0]+1)%3; return; case 'BRG2': A.brg[1]=(A.brg[1]+1)%3; return;
      case 'PFD': A.soft.P='PFD'; return;
      case 'BACK': A.soft.P='top'; return;
      case 'CDI': cycleCdi(); ctx.onCdi&&ctx.onCdi(); return;
      case 'DME': A.dme=!A.dme; return;
      case 'WIND': A.wind=!A.wind; return;
      case 'STD BARO': A.baroStd=!A.baroStd; return;
      case 'XPDR': A.soft.P='XPDR'; return;
      case 'STBY': case 'ON': case 'ALT': A.xpdr.mode=t; return;
      case 'VFR': A.xpdr.code='7000'; return;
      case 'CODE': A.soft.P='CODE'; A.xpdr.entry=''; return;
      case 'IDENT': A.ident=18; return;
      case 'TMR/REF': A.win.P&&A.win.P.type==='TMR'?closeWin('P'):openWin('P',{type:'TMR'}); return;
      case 'NRST': A.win.P&&A.win.P.type==='NRST'?closeWin('P'):openWin('P',nrstWin(ctx.s)); return;
      case 'ALERTS': A.win.P&&A.win.P.type==='ALERTS'?closeWin('P'):openWin('P',{type:'ALERTS'}); return;
    }
  } else {
    switch(t){
      case 'MAP': A.soft.M='MAP'; return;
      case 'BACK': A.soft.M='top'; return;
      case 'NORTH UP': case 'TRK UP': A.mapMode=A.mapMode==='N'?'TRK':'N'; return;
      case 'CLR TRAIL': ctx.s.trail.length=0; return;
      case 'DCLTR': A.dcltr=!A.dcltr; return;
      case 'RNG −': range(-1); return; case 'RNG +': range(1); return;
    }
  }
}
const RNG=[1,2,5,10,15,20,40,60];
function range(st){ const i=RNG.indexOf(A.mapRange); A.mapRange=RNG[clamp((i<0?3:i)+st,0,RNG.length-1)]; }

/* ---------- bezel-bygging ---------- */
function knobEl(id,label,dual){
  return `<div class="kn ${dual?'dual':''}" data-kn="${id}" tabindex="0" role="group" aria-label="${label} knob"><div class="ko"><i></i></div>${dual?'<div class="ki"><i></i></div>':''}<span class="kl">${label}</span></div>`;
}
function btn(k,label,cls){ return `<button class="bz ${cls||''}" data-bk="${k}">${label}</button>`; }
function bezelHTML(d){
  const left=`<div class="bcol">${btn('NAVFF','⇄','ff')}${knobEl('NAV','NAV',true)}${knobEl('HDG','HDG',false)}
    ${d==='M'?`<div class="apk">${['AP','FD','HDG','ALT','NAV','VNV','APR','BC','VS','FLC','UP','DN'].map(k=>`<button class="bz ap" data-ap="${k}">${k==='UP'?'NOSE UP':k==='DN'?'NOSE DN':k}</button>`).join('')}</div>`:''}
    ${knobEl('ALT','ALT',true)}</div>`;
  const right=`<div class="bcol">${btn('COMFF','⇄','ff')}${knobEl('COM','COM',true)}${knobEl('CRS','CRS / BARO',true)}${knobEl('RNG','RANGE',false)}
    <div class="fk">${btn('DTO','D→')}${btn('MENU','MENU')}${btn('FPL','FPL')}${btn('PROC','PROC')}${btn('CLR','CLR')}${btn('ENT','ENT')}</div>${knobEl('FMS','FMS',true)}</div>`;
  return {left,right,soft:`<div class="skrow">${Array.from({length:12},(_,i)=>`<button class="sk" data-sk="${i}" aria-label="Softkey ${i+1}"></button>`).join('')}</div>`};
}
function bindKnob(el,on){
  const ko=el.querySelector('.ko'), ki=el.querySelector('.ki'); let rot={outer:0,inner:0};
  const spin=(which,st)=>{ rot[which]+=st*15; const t=which==='inner'?ki:ko; if(t) t.querySelector('i').style.transform=`rotate(${rot[which]}deg)`; on(which,st); };
  const whichOf=t=> ki&&t.closest('.ki')?'inner':(ki?'outer':'inner');
  let wacc=0;
  el.addEventListener('wheel',e=>{ e.preventDefault(); if(e.ctrlKey) return; wacc+=e.deltaY*(e.deltaMode?40:1); if(Math.abs(wacc)<30) return; spin(whichOf(e.target),wacc<0?1:-1); wacc=0; },{passive:false});
  let drag=null;
  el.addEventListener('pointerdown',e=>{ e.preventDefault(); el.focus({preventScroll:true}); drag={w:whichOf(e.target),y:e.clientY,x:e.clientX,moved:false}; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove',e=>{ if(!drag) return; const dy=(drag.y-e.clientY)+(e.clientX-drag.x); if(Math.abs(dy)>=12){ const st=Math.trunc(dy/12); spin(drag.w,st); drag.y=e.clientY; drag.x=e.clientX; drag.moved=true; } });
  el.addEventListener('pointerup',e=>{ if(drag&&!drag.moved&&(drag.w==='inner'||!ki)) on('push',0); drag=null; });
  el.addEventListener('pointercancel',()=>drag=null);
  el.addEventListener('keydown',e=>{ const sh=e.shiftKey;
    if(e.key==='ArrowUp'||e.key==='ArrowRight'){ spin(sh&&ki?'outer':'inner',1); e.preventDefault(); e.stopPropagation(); }
    else if(e.key==='ArrowDown'||e.key==='ArrowLeft'){ spin(sh&&ki?'outer':'inner',-1); e.preventDefault(); e.stopPropagation(); }
    else if(e.key==='Enter'||e.key===' '){ on('push',0); e.preventDefault(); e.stopPropagation(); } });
}
function knobAct(d,id,which,st,ctx){
  const R=A.radio, AP=ctx.ap;
  switch(id){
    case 'NAV': { const n=R.nav[R.navSel]; if(which==='push'){ R.navSel=1-R.navSel; return; } n.stby=stepFreq(n.stby,which==='outer'?st:0,which==='inner'?st:0,false); return; }
    case 'COM': { const c=R.com[R.comSel]; if(which==='push'){ R.comSel=1-R.comSel; return; } c.stby=stepFreq(c.stby,which==='outer'?st:0,which==='inner'?st:0,true); return; }
    case 'HDG': if(which==='push') AP.hdg=Math.round(ctx.o.hdg); else AP.hdg=w360(AP.hdg+st); return;
    case 'ALT': if(which==='push') return; AP.alt=clamp(AP.alt+(which==='outer'?1000:100)*st,0,20000); return;
    case 'CRS': if(which==='outer'){ A.baroStd=false; A.baro=clamp(A.baro+st,940,1060); return; }
      if(A.cdi==='GPS'){ if(A.fp.obs!=null&&which==='inner') A.fp.obs=w360(A.fp.obs+st); return; } { const i=A.cdi==='NAV1'?0:1; if(which==='push'){ const n=F.navFreq(ctx.s,navAct(i),A.crs[i],M.NAVAIDS); if(n.brg!=null) A.crs[i]=Math.round(n.brg); return; } A.crs[i]=w360(A.crs[i]+st); } return;
    case 'RNG': if(which!=='push') range(-st); return;
    case 'FMS': if(which==='push') key(d,'PUSH',ctx); else fms(d,which,st,ctx); return;
  }
}

G.AVX={A,navNow,autoSlew,key,fms,soft,softPFD,softMFD,view,bezelHTML,bindKnob,knobAct,typeChar,cdiLabel,cycleCdi,navAct,navStation,msg,range,stepFreq};
})(window);
