/* Birdbird – shared debrief and scoring for the cockpit trainers (C172, DA42, King Air B200; 2D and 3D pages).
   Recorder: samples the flight at 5 Hz of simulated time into a fixed ring buffer (no allocation per frame, no DOM work while flying).
   Scoring: pure functions (evaluate) over the recorded columns and the scenario's checklist state: tolerance bands after
   EASA/ICAO-style stabilised-approach criteria, limit exceedances, engine-failure handling and the checklist steps.
   Debrief sheet: drawn once when a scenario ends (or on the Debrief button): result, assessment, timeline, vertical profile,
   plan view and LOC/GS trace; Fly again / Next scenario / Print. Summaries are stored in localStorage ('bb-debrief', synced by
   account.js as progress) and the last full debrief in 'bb-debrief-last' (this browser only).
   Teaching tool: tolerances are typical training values, not an approved skill-test standard. */
(function(G){
'use strict';
const NM=1852, FT=0.3048, D2R=Math.PI/180, R2D=180/Math.PI, GP=3, TCH=50;
const tr=(en,no)=>({en,no});
const nf=(v,d,no)=>{ let s=(+v).toFixed(d||0); if(+s===0) s=(0).toFixed(d||0); return no?s.replace('.',',').replace('-','−'):s.replace('-','−'); };
const w180=a=>{ a=(a+180)%360; if(a<0) a+=360; return a-180; };
const mmss=t=>{ t=Math.max(0,Math.round(t||0)); return Math.floor(t/60)+':'+String(t%60).padStart(2,'0'); };
/* a "why" text with numbers in both languages: W(f) where f(n) builds the text with n(v,d) */
const W=(fe,fn)=>({en:fe((v,d)=>nf(v,d,false)),no:fn((v,d)=>nf(v,d,true))});

/* ---------- recorded fields ---------- */
const FLD=['t','N','E','alt','agl','ias','vs','pitch','roll','hdg','trk','loc','gsd','gear','flap','ap','af','dead','sec','tq','itt','gnd','buf','gs'];
const NF=FLD.length, IX={}; FLD.forEach((k,i)=>IX[k]=i);
const DT=0.2; // 5 Hz of simulated time

function Ring(cap){ this.cap=cap; this.buf=new Float32Array(cap*NF); this.n=0; this.head=0; this.row=new Float64Array(NF); }
Ring.prototype.clear=function(){ this.n=0; this.head=0; };
Ring.prototype.push=function(){ this.buf.set(this.row,this.head*NF); this.head=(this.head+1)%this.cap; if(this.n<this.cap) this.n++; };
/* chronological columns {n, t:[...], N:[...], ...} */
Ring.prototype.cols=function(){ const n=this.n, C={n}; const st=(this.head-n+this.cap)%this.cap;
  FLD.forEach((k,j)=>{ const a=new Float64Array(n); for(let i=0;i<n;i++) a[i]=this.buf[((st+i)%this.cap)*NF+j]; C[k]=a; }); return C; };

/* columns from plain row objects (tests, stored traces) */
function colsFrom(rows){ const n=rows.length, C={n}; FLD.forEach(k=>{ const a=new Float64Array(n); for(let i=0;i<n;i++){ const v=rows[i][k]; a[i]=v==null?(k==='loc'||k==='gsd'||k==='tq'||k==='itt'?NaN:0):+v; } C[k]=a; }); return C; }

/* ---------- geometry used by scoring ---------- */
const dThrNm=(N)=>-N/NM;                       // distance before the runway 36 threshold (N=0), NM
const pathFt=dNm=>TCH+dNm*NM*Math.tan(GP*D2R)/FT;
const PREC={ils:1,star:1,rnp_lpv:1,rnp_lv:1,rnav:1};
const MINS0={ils:210,loc:460,ndb:600,rnp_lpv:250,rnp_lv:300,rnp_ln:470,star:210,rnav:250};
const KIND0={ils:'DA',loc:'MDA',ndb:'MDA',rnp_lpv:'DA',rnp_lv:'DA',rnp_ln:'MDA',star:'DA',rnav:'DA'};

/* ---------- item titles (stable keys; stored summaries keep only the key) ---------- */
const TT={
  crash:tr('Flight ended in a crash','Flygingen endte med havari'),
  limits:tr('Aircraft limits','Flyets begrensninger'),
  vne:tr('Never-exceed speed (VNE/VMO)','Aldri-overskrid-fart (VNE/VMO)'),
  vfe:tr('Flap speed (VFE)','Flapsfart (VFE)'),
  vle:tr('Gear speeds (VLE/VLO)','Understellsfart (VLE/VLO)'),
  bank:tr('Bank angle (45° limit)','Krengning (grense 45°)'),
  stall:tr('Stall warning in flight','Stallvarsel i lufta'),
  tq:tr('Torque limit','Momentgrense'),
  itt:tr('ITT limit','ITT-grense'),
  vmc:tr('Above VMCA with one engine inoperative','Over VMCA med én motor ute'),
  yse:tr('Blue line (VYSE) on one engine','Blå linje (VYSE) på én motor'),
  bankLive:tr('Bank towards the live engine','Krengning mot den levende motoren'),
  secure:tr('Failed engine identified and secured','Motoren som sviktet identifisert og sikret'),
  wrongEng:tr('Correct engine secured','Riktig motor sikret'),
  fap:tr('Final approach','Sluttinnflyging'),
  loc:tr('Localizer / lateral path within ½ dot after the FAP','Localizer / lateral bane innenfor ½ prikk etter FAP'),
  gs:tr('Glide path within ½ dot after the FAP','Glidebane innenfor ½ prikk etter FAP'),
  stable:tr('Stabilised by 1000 ft (500 ft visual)','Stabilisert senest 1000 ft (500 ft visuelt)'),
  speed:tr('Final approach speed −5 / +10 kt','Fart på finalen −5 / +10 kt'),
  sink:tr('Rate of descent on final','Synkehastighet på finalen'),
  mda:tr('Not below MDA before the visual descent point','Ikke under MDA før visuelt nedstigningspunkt'),
  decide:tr('Decision at minimums','Beslutning ved minima'),
  td:tr('Touchdown','Touchdown'),
  holdAlt:tr('Holding altitude ±100 ft','Ventehøyde ±100 ft'),
  holdSpd:tr('Holding speed','Ventefart'),
  sidTrk:tr('Runway track until 1,500 ft','Banekurs til 1500 ft'),
  sidLvl:tr('Level-off at 3,000 ft ±100 ft','Utflating i 3000 ft ±100 ft'),
  order:tr('Actions in sequence','Handlinger i riktig rekkefølge'),
  step:tr('Checklist step','Sjekklistepunkt')
};
const CRASH_NO={'Gear-up landing':'Landing uten understell','Hard landing (more than 700 ft/min)':'Hard landing (mer enn 700 ft/min)','Wingtip strike: bank too steep at touchdown':'Vingespissen traff bakken: for mye krengning ved touchdown','Nose-wheel first: pitch too low at touchdown':'Nesehjulet først: for lav nese ved touchdown','Landed off the runway':'Landet utenfor rullebanen','Ran off the runway':'Kjørte av rullebanen','Controlled flight into terrain':'Fløy inn i terrenget (CFIT)'};
const CAT={crash:'crit',limits:'lim',vne:'lim',vfe:'lim',vle:'lim',bank:'lim',stall:'lim',tq:'lim',itt:'lim',vmc:'oei',yse:'oei',bankLive:'oei',secure:'oei',wrongEng:'oei',
  fap:'path',loc:'path',gs:'path',stable:'path',speed:'path',sink:'path',mda:'path',decide:'path',td:'path',holdAlt:'path',holdSpd:'path',sidTrk:'path',sidLvl:'path',order:'chk',step:'chk'};

/* ---------- scoring (pure) ----------
   C: columns; M: {type,k,V,nEng,retract,ldgFlap,vApp,vHold,mins,minsKind,prec,app,hold,sid,tqMax,ittMax,
                   steps:[{t,st,tm}], bad:[t...], crash, td:{t,N,E,vs}, decision, endWhy}
   returns {items:[{id,cat,res,t,title,why,crit}], result, score, crit:[items], counts} */
function evaluate(C,M){
  M=M||{}; const V=M.V||{}; const n=C.n|0; const items=[];
  const add=(id,res,t,why,o)=>{ const it=Object.assign({id,cat:CAT[id]||'path',res,t:t==null?null:t,title:TT[id]||tr(id,id),why:why||null,crit:false},o||{}); items.push(it); return it; };
  const air=i=>!C.gnd[i];
  /* runs of a condition: total time and first time; samples flown by auto-fly counted apart */
  function runs(cond,a,b){ a=a||0; b=b==null?n:b; let tot=0, first=null, afT=0, maxRun=0, cur=0, worst=null;
    for(let i=a;i<b;i++){ if(cond(i)){ const d=i+1<n?Math.min(1,C.t[i+1]-C.t[i]):DT; tot+=d; cur+=d; if(cur>maxRun) maxRun=cur; if(first==null) first=C.t[i]; if(C.af[i]) afT+=d; if(worst==null) worst=i; } else cur=0; }
    return {tot,first,afT,maxRun,worst}; }
  const afFrac=(a,b)=>{ let k=0, m=0; for(let i=a;i<b;i++){ m++; if(C.af[i]) k++; } return m?k/m:0; };
  const AUTO=tr('Flown by auto-fly — not scored.','Fløyet av autofly — ikke vurdert.');

  /* checklist steps */
  (M.steps||[]).forEach((s,i)=>{ const st=s.st|0;
    const res=st===1?'pass':st===-1?'fail':st===2?'amber':'amber';
    const why=st===1?null:st===2?tr('Skipped.','Hoppet over.'):st===-1?tr('Not met: see the brief.','Ikke oppfylt: se briefen.'):tr('Not completed.','Ikke fullført.');
    add('step',res,s.tm!=null?s.tm:null,why,{title:s.t,step:i+1}); });
  if((M.bad||[]).length) add('order','amber',M.bad[0],W(n=>`${M.bad.length} action${M.bad.length>1?'s':''} out of sequence or on the wrong control.`,n=>`${M.bad.length} handling${M.bad.length>1?'er':''} i feil rekkefølge eller på feil bryter.`));
  else if((M.steps||[]).length) add('order','pass',null,null);

  /* crash */
  if(M.crash) add('crash','fail',M.crashT!=null?M.crashT:(n?C.t[n-1]:0),tr(M.crash,M.crashNo||CRASH_NO[M.crash]||M.crash),{crit:true});

  /* limits */
  const limBad=[];
  if(V.ne){ const r=runs(i=>air(i)&&C.ias[i]>V.ne+1); if(r.tot>0){ let mx=0; for(let i=0;i<n;i++) if(C.ias[i]>mx) mx=C.ias[i];
    limBad.push(add('vne',r.afT>=r.tot?'auto':'fail',r.first,r.afT>=r.tot?AUTO:W(f=>`Exceeded ${V.ne} KIAS (max ${f(mx)}).`,f=>`Over ${V.ne} KIAS (maks ${f(mx)}).`),{crit:r.afT<r.tot})); } }
  if(V.fe1){ const lim=i=>{ const fl=C.flap[i]; if(fl<0.5) return 1e9; if(M.type==='C172') return fl<1.5?V.fe1:V.fe2; return fl<1.5?V.fe1:V.fe2; };
    const r=runs(i=>air(i)&&C.ias[i]>lim(i)+2); if(r.tot>=0.4){ const i=r.worst; limBad.push(add('vfe',r.tot>3?'fail':'amber',r.first,W(f=>`${f(C.ias[i])} KIAS with flaps selected (limit ${lim(i)}) for ${f(r.tot,1)} s.`,f=>`${f(C.ias[i])} KIAS med flaps valgt (grense ${lim(i)}) i ${f(r.tot,1)} s.`))); } }
  if(M.retract&&V.le){ const lo=V.lo||V.le;
    const r=runs(i=>air(i)&&((C.gear[i]>0.98&&C.ias[i]>V.le+2)||(C.gear[i]>0.02&&C.gear[i]<0.98&&C.ias[i]>lo+2))); if(r.tot>=0.4){ const i=r.worst; limBad.push(add('vle','fail',r.first,W(f=>`${f(C.ias[i])} KIAS with the gear ${C.gear[i]>0.98?'down (VLE '+V.le:'moving (VLO '+lo})).`,f=>`${f(C.ias[i])} KIAS med understellet ${C.gear[i]>0.98?'ute (VLE '+V.le:'i bevegelse (VLO '+lo}).`))); } }
  { const steep=M.k==='steep', a1=steep?55:45, a2=steep?65:60; const r=runs(i=>air(i)&&Math.abs(C.roll[i])>a1);
    if(r.maxRun>=2){ let mx=0; for(let i=0;i<n;i++) if(air(i)) mx=Math.max(mx,Math.abs(C.roll[i])); const bad=mx>a2;
      limBad.push(add('bank',r.afT>=r.tot?'auto':bad?'fail':'amber',r.first,r.afT>=r.tot?AUTO:W(f=>`Bank beyond ${a1}° for ${f(r.tot,0)} s (max ${f(mx)}°).`,f=>`Krengning over ${a1}° i ${f(r.tot,0)} s (maks ${f(mx)}°).`))); } }
  if(M.k!=='stall'){ const r=runs(i=>air(i)&&C.agl[i]>30&&C.buf[i]>0.3); if(r.tot>=1) limBad.push(add('stall',r.afT>=r.tot?'auto':'amber',r.first,r.afT>=r.tot?AUTO:W(f=>`Stall warning / buffet for ${f(r.tot,0)} s.`,f=>`Stallvarsel / buffeting i ${f(r.tot,0)} s.`))); }
  if(M.tqMax){ const r=runs(i=>C.tq[i]>M.tqMax+10); if(r.tot>=0.4){ let mx=0; for(let i=0;i<n;i++) if(C.tq[i]>mx) mx=C.tq[i]; limBad.push(add('tq',mx>M.tqMax*1.05||r.tot>5?'fail':'amber',r.first,W(f=>`Max ${f(mx)} ft-lb (limit ${M.tqMax}).`,f=>`Maks ${f(mx)} ft-lb (grense ${M.tqMax}).`))); } }
  if(M.ittMax){ const r=runs(i=>air(i)&&C.itt[i]>M.ittMax+2); if(r.tot>=0.4){ let mx=0; for(let i=0;i<n;i++) if(air(i)&&C.itt[i]>mx) mx=C.itt[i]; limBad.push(add('itt',mx>M.ittMax+50||r.tot>5?'fail':'amber',r.first,W(f=>`Max ${f(mx)} °C in flight (limit ${M.ittMax}).`,f=>`Maks ${f(mx)} °C i lufta (grense ${M.ittMax}).`))); } }
  if(!limBad.length&&n) add('limits','pass',null,tr('No speed, flap, gear or bank exceedance'+(M.tqMax?', torque or ITT':'')+'.','Ingen overskridelse av fart, flaps, understell eller krengning'+(M.tqMax?', moment eller ITT':'')+'.'));

  /* one engine inoperative (twins) */
  if((M.nEng||1)>=2&&n){
    let f=-1; for(let i=0;i<n;i++) if(C.dead[i]>0){ f=i; break; }
    if(f>=0){ const dm=C.dead[f]|0, di=dm&1?0:1, liveSign=di===0?1:-1, tF=C.t[f];
      const oei=i=>air(i)&&C.agl[i]>50&&((C.dead[i]|0)&(1<<di));
      if(V.mc){ const r=runs(i=>oei(i)&&C.ias[i]<V.mc); const it=r.tot>=0.4?add('vmc',r.afT>=r.tot?'auto':'fail',r.first,W(g=>`Below VMCA (${V.mc} KIAS) with one engine inoperative for ${g(r.tot,1)} s.`,g=>`Under VMCA (${V.mc} KIAS) med én motor ute i ${g(r.tot,1)} s.`),{crit:r.afT<r.tot}):add('vmc','pass',null,null); }
      if(V.yse){ const r=runs(i=>oei(i)&&C.agl[i]>200&&C.ias[i]<V.yse-5); add('yse',r.tot>=5?(r.afT>=r.tot?'auto':'amber'):'pass',r.tot>=5?r.first:null,r.tot>=5?W(g=>`More than 5 kt below ${V.yse} KIAS for ${g(r.tot,0)} s.`,g=>`Mer enn 5 kt under ${V.yse} KIAS i ${g(r.tot,0)} s.`):null); }
      { let s=0, m=0, a=0; for(let i=f;i<n&&C.t[i]<=tF+60;i++){ if(C.t[i]<tF+3||!oei(i)||Math.abs(C.roll[i])>15) continue; s+=C.roll[i]*liveSign; m++; if(C.af[i]) a++; }
        if(m>=10){ const mb=s/m; const res=a>m/2?'auto':mb<-2?'fail':mb<1||mb>8?'amber':'pass';
          add('bankLive',res,tF,res==='auto'?AUTO:W(g=>`Average ${g(Math.abs(mb),1)}° towards the ${mb>=0?'live':'dead'} engine (aim 2–5°).`,g=>`Gjennomsnitt ${g(Math.abs(mb),1)}° mot den ${mb>=0?'levende':'døde'} motoren (mål 2–5°).`)); } }
      { let wrong=-1, sec=-1; const other=1<<(1-di);
        for(let i=f;i<n;i++){ const sm=C.sec[i]|0; if(sec<0&&(sm&(1<<di))) sec=i; if(wrong<0&&air(i)&&(sm&other)&&!((C.sec[f]|0)&other)) wrong=i; }
        const side=di===0?tr('left','venstre'):tr('right','høyre');
        if(wrong>=0) add('wrongEng','fail',C.t[wrong],W(()=>`The live (${side.en=== 'left'?'right':'left'}) engine was secured — the ${side.en} engine had failed.`,()=>`Den levende (${side.en==='left'?'høyre':'venstre'}) motoren ble sikret — det var ${side.no} motor som sviktet.`),{crit:true});
        if(sec>=0) add('secure','pass',C.t[sec],W(g=>`${side.en==='left'?'Left':'Right'} engine secured ${g(C.t[sec]-tF,0)} s after the failure.`,g=>`${side.no==='venstre'?'Venstre':'Høyre'} motor sikret ${g(C.t[sec]-tF,0)} s etter svikten.`));
        else if(C.t[n-1]-tF>=60) add('secure','amber',null,W(()=>`The failed ${side.en} engine was not secured (feather / shut down).`,()=>`Den sviktende ${side.no} motoren ble ikke sikret (fløy / stopp).`));
        else add('secure','info',null,tr('The flight ended before the engine was secured.','Flygingen sluttet før motoren ble sikret.')); }
    }
  }

  /* approach */
  if(M.app&&n){
    const mins=M.mins||MINS0[M.k]||210, kind=M.minsKind||KIND0[M.k]||'DA', prec=!!M.prec;
    const onFinal=i=>air(i)&&Math.abs(C.E[i])<1.5*NM&&Math.abs(w180(C.trk[i]-360))<60&&C.N[i]<0;
    let fap=-1; for(let i=0;i<n;i++) if(onFinal(i)&&dThrNm(C.N[i])<=5.05&&C.alt[i]<1900){ fap=i; break; }
    if(fap<0){ add('fap','info',null,tr('The final approach fix (FAPSO, D5) was not reached.','Fastpunktet for sluttinnflyging (FAPSO, D5) ble ikke nådd.')); }
    else {
      let dI=-1; for(let i=fap;i<n;i++){ if(!air(i)) break; if(C.alt[i]<=mins){ dI=i; break; } }
      let end=dI; if(end<0){ end=fap; for(let i=fap;i<n&&air(i);i++) end=i; }
      /* go-around: climbing 300 ft above the lowest point after the FAP */
      let lo=1e9, ga=-1; for(let i=fap;i<n&&air(i);i++){ if(C.alt[i]<lo) lo=C.alt[i]; else if(C.alt[i]>lo+300&&C.vs[i]>300){ ga=i; break; } }
      if(ga>=0&&(dI<0||ga<dI)) end=Math.min(end,ga);
      const win=(a,b)=>afFrac(a,b)>0.5;
      const devItem=(id,col)=>{ const ok=i=>!isNaN(C[col][i]); let m=0, mx=0, beyondH=0, beyond1=0, first=null;
        for(let i=fap;i<=end;i++){ if(!ok(i)) continue; m++; const d=Math.abs(C[col][i]); if(d>mx) mx=d; if(d>0.5){ beyondH+=DT; if(first==null) first=C.t[i]; } if(d>1) beyond1+=DT; }
        if(!m) return;
        if(win(fap,end+1)) return add(id,'auto',C.t[fap],AUTO);
        const res=beyondH<2?'pass':beyond1<3?'amber':'fail';
        add(id,res,res==='pass'?C.t[fap]:first,W(g=>`Max ${g(mx,1)} dot${res==='pass'?'':`; beyond ½ dot for ${g(beyondH,0)} s`}.`,g=>`Maks ${g(mx,1)} prikk${res==='pass'?'':`; utenfor ½ prikk i ${g(beyondH,0)} s`}.`)); };
      devItem('loc','loc'); if(prec) devItem('gs','gsd');
      /* stabilised approach gate */
      const stab=(i,cfgOnly)=>{ const why=[]; const vA=M.vApp||0;
        if(!cfgOnly){
        if(isNaN(C.loc[i])||Math.abs(C.loc[i])>1) why.push(tr('lateral >1 dot','lateralt >1 prikk'));
        if(prec&&(isNaN(C.gsd[i])||Math.abs(C.gsd[i])>1)) why.push(tr('glide path >1 dot','glidebane >1 prikk'));
        if(vA&&(C.ias[i]<vA-5||C.ias[i]>vA+10)) why.push(W(g=>`${g(C.ias[i])} KIAS`,g=>`${g(C.ias[i])} KIAS`));
        if(C.vs[i]<-1000) why.push(W(g=>`${g(-C.vs[i])} ft/min down`,g=>`${g(-C.vs[i])} ft/min ned`));
        }
        if(M.retract&&C.gear[i]<0.98) why.push(tr('gear not down','understell ikke ute'));
        if(C.flap[i]<(M.ldgFlap||1)-0.01) why.push(tr('flaps not set','flaps ikke satt'));
        return why; };
      const at=h=>{ for(let i=fap;i<=end;i++) if(C.alt[i]<=h) return i; return -1; };
      const i1=at(1000), i5=at(500);
      const join=a=>({en:a.map(x=>x.en).join(', '),no:a.map(x=>x.no).join(', ')});
      if(i1>=0){ const w1=stab(i1);
        if(win(i1,end+1)){ /* auto-fly flew path, speed and sink: only the configuration (the student's job) is assessed, never as a fail */
          const wc=stab(i5>=0?i5:i1,true);
          if(!wc.length) add('stable','auto',C.t[i1],AUTO);
          else { const j=join(wc); add('stable','amber',C.t[i5>=0?i5:i1],{en:'Auto-fly flew the path (not scored); configuration is yours: '+j.en+'.',no:'Autofly fløy banen (ikke vurdert); konfigurasjonen er din: '+j.no+'.'}); } }
        else if(!w1.length) add('stable','pass',C.t[i1],tr('On path, on speed, configured and below 1000 ft/min at 1000 ft.','På banen, på fart, konfigurert og under 1000 ft/min ved 1000 ft.'));
        else { const w5=i5>=0?stab(i5):null; const j1=join(w1);
          if(w5&&!w5.length) add('stable','amber',C.t[i1],{en:'Not stable at 1000 ft ('+j1.en+'); stable by 500 ft (visual gate).',no:'Ikke stabil ved 1000 ft ('+j1.no+'); stabil ved 500 ft (visuell grense).'});
          else if(w5){ const j5=join(w5); add('stable','fail',C.t[i5],{en:'Not stable at 500 ft ('+j5.en+') — a go-around was required.',no:'Ikke stabil ved 500 ft ('+j5.no+') — det skulle vært gått rundt.'}); }
          else add('stable','pass',C.t[i1],{en:'Not stable at 1000 ft ('+j1.en+') — went around: correct.',no:'Ikke stabil ved 1000 ft ('+j1.no+') — gikk rundt: riktig.'}); } }
      if(i1>=0&&M.vApp){ const vA=M.vApp; const r=runs(i=>C.ias[i]<vA-5||C.ias[i]>vA+10,i1,end+1), r2=runs(i=>C.ias[i]<vA-10||C.ias[i]>vA+20,i1,end+1);
        let mn=1e9, mx=0; for(let i=i1;i<=end;i++){ mn=Math.min(mn,C.ias[i]); mx=Math.max(mx,C.ias[i]); }
        if(win(i1,end+1)) add('speed','auto',C.t[i1],AUTO);
        else add('speed',r.tot<3?'pass':r2.tot<3?'amber':'fail',r.tot<3?C.t[i1]:r.first,W(g=>`${g(mn)}–${g(mx)} KIAS (target ${vA}, band ${vA-5}–${vA+10}).`,g=>`${g(mn)}–${g(mx)} KIAS (mål ${vA}, bånd ${vA-5}–${vA+10}).`)); }
      if(i1>=0){ const r=runs(i=>C.vs[i]<-1000,i1,end+1), r2=runs(i=>C.vs[i]<-1500,i1,end+1); let mx=0; for(let i=i1;i<=end;i++) mx=Math.max(mx,-C.vs[i]);
        if(win(i1,end+1)) add('sink','auto',C.t[i1],AUTO);
        else add('sink',r.tot<3?'pass':r2.tot<3?'amber':'fail',r.tot<3?C.t[i1]:r.first,W(g=>`Max ${g(mx)} ft/min below 1000 ft.`,g=>`Maks ${g(mx)} ft/min under 1000 ft.`)); }
      if(kind==='MDA'){ const dV=(mins-TCH)*FT/Math.tan(GP*D2R)/NM;
        const r=runs(i=>air(i)&&C.alt[i]<mins-50&&dThrNm(C.N[i])>dV+0.3,fap,n);
        add('mda',r.tot>=0.4?(r.afT>=r.tot?'auto':'fail'):(win(fap,end+1)?'auto':'pass'),r.tot>=0.4?r.first:null,r.tot>=0.4?W(g=>`Below MDA ${mins} ft more than ${g(dV+0.3,1)} NM out (before the VDP / MAPt).`,g=>`Under MDA ${mins} ft mer enn ${g(dV+0.3,1)} NM ute (før VDP / MAPt).`):W(g=>`MDA ${mins} ft held until the visual descent point (${g(dV,1)} NM).`,g=>`MDA ${mins} ft holdt til visuelt nedstigningspunkt (${g(dV,1)} NM).`),{crit:r.tot>=0.4&&r.afT<r.tot}); }
      { const di=dI>=0?dI:(ga>=0?ga:-1);
        if(di>=0){ const d=dThrNm(C.N[di]); const dec=M.decision||(ga>=0&&(dI<0||ga>=dI)?'ga':(M.td?'land':null));
          const decT=dec==='ga'?tr('go-around','gå rundt'):dec==='land'?tr('continued to land','fortsatte til landing'):tr('none recorded','ingen registrert');
          add('decide',C.af[di]?'auto':'info',C.t[di],{en:`At ${kind} ${mins} ft: ${nf(d,1)} NM, LOC ${isNaN(C.loc[di])?'—':nf(C.loc[di],1)} dot${prec&&!isNaN(C.gsd[di])?', GS '+nf(C.gsd[di],1)+' dot':''}, ${nf(C.ias[di])} KIAS. Decision: ${decT.en} (the simulator is always visual).`,
            no:`Ved ${kind} ${mins} ft: ${nf(d,1,1)} NM, LOC ${isNaN(C.loc[di])?'—':nf(C.loc[di],1,1)} prikk${prec&&!isNaN(C.gsd[di])?', GS '+nf(C.gsd[di],1,1)+' prikk':''}, ${nf(C.ias[di])} KIAS. Beslutning: ${decT.no} (simulatoren er alltid visuell).`}); }
      }
    }
  }
  /* touchdown (any scenario that lands) */
  if(M.td&&!M.crash){ const T=M.td, al=T.N, xt=Math.abs(T.E), vs=Math.abs(T.vs||0);
    const zone=al>=60&&al<=600, cl=xt<=6, res=vs>600?'fail':(vs>400||!zone||!cl)?'amber':'pass';
    const afl=M.tdAf; add('td',afl?'auto':res,T.t,afl?AUTO:W(g=>`${g(vs)} ft/min, ${g(al)} m past the threshold${zone?'':' (aim 60–600 m)'}, ${g(xt,0)} m off the centreline.`,g=>`${g(vs)} ft/min, ${g(al)} m forbi terskelen${zone?'':' (mål 60–600 m)'}, ${g(xt,0)} m fra senterlinjen.`)); }

  /* holding */
  if(M.hold&&n){ const R={N:-10*NM,E:0}; let a=-1; for(let i=0;i<n;i++) if(Math.hypot(C.N[i]-R.N,C.E[i]-R.E)<0.6*NM){ a=i; break; }
    if(a<0) add('holdAlt','info',null,tr('RONAX was not reached.','RONAX ble ikke nådd.'));
    else { let mx=0, sp=0; for(let i=a;i<n;i++){ if(!air(i)) continue; mx=Math.max(mx,Math.abs(C.alt[i]-3000)); sp=Math.max(sp,C.ias[i]); }
      const auto=afFrac(a,n)>0.5;
      add('holdAlt',auto?'auto':mx<=100?'pass':mx<=200?'amber':'fail',C.t[a],auto?AUTO:W(g=>`Max ${g(mx)} ft from 3000 ft.`,g=>`Maks ${g(mx)} ft fra 3000 ft.`));
      const vh=(M.vHold||0)+10; if(M.vHold) add('holdSpd',auto?'auto':sp<=vh?'pass':sp<=vh+10?'amber':'fail',C.t[a],auto?AUTO:W(g=>`Max ${g(sp)} KIAS (about ${M.vHold}).`,g=>`Maks ${g(sp)} KIAS (ca. ${M.vHold}).`)); } }

  /* SID */
  if(M.sid&&n){ let mx=0, a=-1, m=0, k=0; for(let i=0;i<n;i++){ if(!air(i)||C.alt[i]>=1400) continue; m++; if(C.af[i]) k++; mx=Math.max(mx,Math.abs(w180(C.trk[i]-360))); }
    if(m) add('sidTrk',k>m/2?'auto':mx<=10?'pass':mx<=20?'amber':'fail',null,k>m/2?AUTO:W(g=>`Max ${g(mx)}° off the runway track below 1,400 ft.`,g=>`Maks ${g(mx)}° fra banekursen under 1400 ft.`));
    for(let i=0;i<n;i++) if(C.alt[i]>=2900){ a=i; break; }
    if(a>=0){ let d=0; for(let i=a;i<n;i++) d=Math.max(d,Math.abs(C.alt[i]-3000)); const auto=afFrac(a,n)>0.5;
      add('sidLvl',auto?'auto':d<=100?'pass':d<=200?'amber':'fail',C.t[a],auto?AUTO:W(g=>`Max ${g(d)} ft from 3000 ft after the level-off.`,g=>`Maks ${g(d)} ft fra 3000 ft etter utflatingen.`)); } }

  /* result */
  const crit=items.filter(x=>x.crit);
  const cnt={pass:0,amber:0,fail:0,auto:0,info:0}; items.forEach(x=>{ cnt[x.res]=(cnt[x.res]||0)+1; });
  const scored=cnt.pass+cnt.amber+cnt.fail;
  const score=scored?Math.round(100*(cnt.pass+0.5*cnt.amber)/scored):null;
  const result=crit.length||cnt.fail?'fail':cnt.amber?'amber':scored?'pass':'none';
  return {items,crit,result,score,counts:cnt};
}

/* ---------- end of scenario (pure, called at 5 Hz by the recorder) ---------- */
function endCheck(st,o){ // st: recorder state, o: {crash,gnd,gs,alt,N,E,stepsDone,stepsN,kind,decisionGa,holdN,sidDone,t}
  if(o.crash) return 'crash';
  if(o.gnd&&st.wasAir&&o.gs<3){ st.stopT=(st.stopT||0)+DT; if(st.stopT>=2) return 'landed'; } else st.stopT=0;
  if(st.gaT!=null&&o.alt>=2500&&o.t-st.gaT>20) return 'missed';
  if(o.kind==='hold'&&(o.holdN>=2||st.ronax>=3)) return 'hold';
  if(o.kind==='sid'&&(o.sidDone||Math.hypot(o.N-18*NM,o.E+14*NM)<1*NM)) return 'sid';
  if(o.stepsN>0&&o.stepsDone>=o.stepsN&&!o.air){ st.doneT=(st.doneT||0)+DT; if(st.doneT>=1.5) return 'complete'; }
  return null;
}

/* ---------- storage ---------- */
const KEY='bb-debrief', KEYL='bb-debrief-last';
function lsGet(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } }
const RES={pass:1,amber:2,fail:3,auto:4,info:5};
function summary(D){ const E=D.ev;
  return {id:D.id,at:D.at,ac:D.type,pg:D.page,k:D.k,n:D.name,res:E.result,sc:E.score,cr:E.crit.length,dur:Math.round(D.dur),af:D.afUsed?1:0,end:D.endWhy||'',
    it:E.items.filter(x=>x.id!=='step').map(x=>[x.id,RES[x.res]||0,x.t==null?-1:Math.round(x.t)]),
    st:[(D.M.steps||[]).length,(D.M.steps||[]).filter(s=>s.st===1).length]}; }
function save(D){
  const s=summary(D); const a=(lsGet(KEY)||[]).filter(x=>x&&x.id!==s.id); a.push(s); lsSet(KEY,a.slice(-30));
  const C=D.C, step=Math.max(1,Math.ceil(C.n/400)), tk=[]; for(let i=0;i<C.n;i+=step) tk.push([Math.round(C.t[i]),Math.round(C.N[i]),Math.round(C.E[i]),Math.round(C.alt[i]),Math.round(C.ias[i]),isNaN(C.loc[i])?null:+C.loc[i].toFixed(2),isNaN(C.gsd[i])?null:+C.gsd[i].toFixed(2),C.af[i]?1:0]);
  lsSet(KEYL,{s,items:D.ev.items.map(x=>({id:x.id,res:x.res,t:x.t,title:x.title,why:x.why,crit:x.crit})),tk});
}
function list(){ return lsGet(KEY)||[]; }

/* ---------- debrief sheet ---------- */
const CSS=`
.sdb{position:fixed;inset:0;z-index:1000;background:rgba(10,14,18,.62);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:28px 16px;font:400 14px/1.5 var(--f-sans,system-ui,-apple-system,Segoe UI,sans-serif);color:#17202a}
.sdb[hidden]{display:none}
.sdb-card{background:#fbfaf7;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.35);width:min(1180px,100%);padding:28px 32px 24px;position:relative}
.sdb-x{position:absolute;right:16px;top:14px;border:0;background:none;font-size:26px;line-height:1;color:#5b6670;cursor:pointer;padding:6px 10px;border-radius:8px}.sdb-x:hover{background:#eceae4}
.sdb-eb{font:600 11px/1.2 var(--f-mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;color:#6b7680}
.sdb-hd{display:flex;align-items:flex-end;gap:28px;flex-wrap:wrap;margin:6px 0 18px;padding-bottom:18px;border-bottom:1px solid #e4e1d8}
.sdb-hd h2{margin:0;font:600 30px/1.15 var(--f-serif,Georgia,serif);letter-spacing:-.01em}
.sdb-res{display:flex;align-items:baseline;gap:12px}.sdb-res b{font:700 15px/1 var(--f-sans,system-ui);padding:7px 12px;border-radius:999px}
.sdb-res .pass{background:#e3f1e8;color:#145c37}.sdb-res .amber{background:#fbf0d9;color:#7a4d06}.sdb-res .fail{background:#fbe4e1;color:#8c1d13}.sdb-res .none{background:#eceae4;color:#4b5560}
.sdb-res .sc{font:600 34px/1 var(--f-serif,Georgia,serif)}.sdb-res .sc small{font-size:14px;color:#6b7680;font-family:var(--f-sans,system-ui)}
.sdb-meta{display:flex;gap:18px;flex-wrap:wrap;color:#56616b;font-size:13px}.sdb-meta span b{color:#17202a;font-weight:600}
.sdb-crit{background:#fff3f1;border:1px solid #f0c2bb;border-left:4px solid #b42318;border-radius:10px;padding:10px 14px;margin:0 0 18px}
.sdb-crit h3{margin:0 0 4px;font:700 12px/1.3 var(--f-sans,system-ui);letter-spacing:.08em;text-transform:uppercase;color:#8c1d13}
.sdb-crit li{margin:2px 0}.sdb-crit .tm{font:500 12px var(--f-mono,monospace);color:#8a949c;margin-left:6px}
.sdb-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:28px}
@media (max-width:900px){.sdb-grid{grid-template-columns:1fr}.sdb-card{padding:22px 16px}}
.sdb h3.s{font:700 11px/1.3 var(--f-sans,system-ui);letter-spacing:.12em;text-transform:uppercase;color:#6b7680;margin:0 0 8px}
.sdb-items{list-style:none;margin:0 0 20px;padding:0}
.sdb-items li{display:grid;grid-template-columns:86px 1fr 46px;gap:10px;padding:8px 0;border-top:1px solid #ece9e1;align-items:start}
.sdb-items li:first-child{border-top:0}
.sdb-items .ti{font-weight:600}.sdb-items .wh{color:#56616b;font-size:13px}.sdb-items .tm{font:500 12px/1.6 var(--f-mono,monospace);color:#6b7680;text-align:right}
.sdb-chip{display:inline-flex;align-items:center;gap:5px;font:700 11px/1 var(--f-sans,system-ui);padding:5px 8px;border-radius:999px;white-space:nowrap}
.sdb-chip.pass{background:#e3f1e8;color:#145c37}.sdb-chip.amber{background:#fbf0d9;color:#7a4d06}.sdb-chip.fail{background:#fbe4e1;color:#8c1d13}.sdb-chip.auto{background:#eceae4;color:#4b5560}.sdb-chip.info{background:#e6eef9;color:#1d4a85}
.sdb-cat{font:700 10.5px/1 var(--f-sans,system-ui);letter-spacing:.1em;text-transform:uppercase;color:#8a949c;margin:14px 0 2px}
.sdb-fig{margin:0 0 18px}.sdb-fig figcaption{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#6b7680;margin-top:2px}
.sdb-fig svg{width:100%;height:auto;display:block;background:#fff;border:1px solid #ece9e1;border-radius:10px;touch-action:none}
.sdb-fig svg text{font:500 10px var(--f-mono,ui-monospace,monospace);fill:#6b7680}
.sdb-fig .lg{display:inline-flex;gap:12px}.sdb-fig .lg i{display:inline-block;width:16px;height:0;border-top:2px solid #1f4e79;vertical-align:middle;margin-right:4px}.sdb-fig .lg i.af{border-top:2px dashed #9aa4ad}.sdb-fig .lg i.ref{border-top:1px dashed #9aa4ad}
.sdb-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sdb-tip{position:fixed;pointer-events:none;background:#17202a;color:#fff;font:500 11.5px/1.35 var(--f-mono,monospace);padding:6px 8px;border-radius:6px;z-index:1001;white-space:nowrap}
.sdb-tip[hidden]{display:none}
.sdb-tl{margin:0 0 20px}
.sdb-acts{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid #e4e1d8;padding-top:16px;margin-top:6px}
.sdb-acts button{font:600 14px/1 var(--f-sans,system-ui);padding:11px 18px;border-radius:10px;border:1px solid #cfcabd;background:#fff;color:#17202a;cursor:pointer}
.sdb-acts button.pri{background:#17202a;color:#fff;border-color:#17202a}.sdb-acts button:hover{filter:brightness(.96)}
.sdb-note{color:#6b7680;font-size:12px;margin:8px 0 0}
@media print{ body>*:not(#sdb){display:none!important} html,body{background:#fff!important}
  .sdb{position:static;background:none;backdrop-filter:none;padding:0;overflow:visible;display:block}
  .sdb-card{box-shadow:none;width:auto;padding:0;background:#fff}.sdb-x,.sdb-acts{display:none!important}
  .sdb-grid{grid-template-columns:1fr 1fr}.sdb-items li,.sdb-fig{break-inside:avoid} @page{margin:14mm} }
`;
const LBL={pass:tr('✓ Pass','✓ Bestått'),amber:tr('! Check','! Merknad'),fail:tr('✕ Fail','✕ Ikke bestått'),auto:tr('○ Auto-fly','○ Autofly'),info:tr('i Note','i Notat')};
const RESULT={pass:tr('Satisfactory','Tilfredsstillende'),amber:tr('Satisfactory with remarks','Tilfredsstillende med merknader'),fail:tr('Not yet satisfactory','Ikke tilfredsstillende ennå'),none:tr('Not scored','Ikke vurdert')};
const CATN={crit:tr('Critical','Kritisk'),path:tr('Flight path','Flybane'),oei:tr('Engine failure','Motorsvikt'),lim:tr('Limits','Begrensninger'),chk:tr('Checklist','Sjekkliste')};
const ENDW={landed:tr('Landed','Landet'),crash:tr('Crashed','Havarert'),missed:tr('Missed approach flown','Avbrutt innflyging fløyet'),hold:tr('Hold complete','Venting fullført'),sid:tr('SID complete','SID fullført'),complete:tr('Checklist complete','Sjekkliste fullført'),manual:tr('In progress','Pågår')};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* SVG helpers: series downsampled to ≤700 points; auto-fly parts dashed (identity not by colour alone) */
const INK='#1f4e79', REF='#9aa4ad', GRID='#eeece6';
function pathOf(C,idx,X,Y,keep){ let d='', pen=false; for(const i of idx){ const ok=keep(i); if(!ok){ pen=false; continue; } const x=X(i), y=Y(i); if(!isFinite(x)||!isFinite(y)){ pen=false; continue; } d+=(pen?'L':'M')+x.toFixed(1)+' '+y.toFixed(1); pen=true; } return d; }
function idxOf(C,a,b){ a=a||0; b=b==null?C.n:b; const st=Math.max(1,Math.ceil((b-a)/700)), o=[]; for(let i=a;i<b;i+=st) o.push(i); if(b>a&&o[o.length-1]!==b-1) o.push(b-1); return o; }
function ticks(lo,hi,n){ const sp=(hi-lo)/n, p=Math.pow(10,Math.floor(Math.log10(sp||1))), m=sp/p, st=(m<1.5?1:m<3.5?2:m<7.5?5:10)*p; const o=[]; for(let v=Math.ceil(lo/st)*st;v<=hi+1e-9;v+=st) o.push(+v.toFixed(6)); return o; }
function seriesPair(C,idx,X,Y,keep){ return `<path d="${pathOf(C,idx,X,Y,i=>keep(i)&&!C.af[i])}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="${pathOf(C,idx,X,Y,i=>keep(i)&&C.af[i])}" fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"/>`; }

function chartProfile(C,M,L){
  const app=M.app; const W0=560, H0=220, l=46, r=12, t=12, b=26; const air=i=>!C.gnd[i]||(i>0&&!C.gnd[i-1]);
  let x0, x1, xv;
  if(app){ x1=0; x0=0; for(let i=0;i<C.n;i++){ const d=dThrNm(C.N[i]); if(d>x0&&d<16) x0=d; } x0=Math.ceil(Math.max(x0,2)); xv=i=>dThrNm(C.N[i]); }
  else { x0=0; x1=C.n?C.t[C.n-1]:1; xv=i=>C.t[i]; }
  let y1=500; for(let i=0;i<C.n;i++) y1=Math.max(y1,C.alt[i]); y1=Math.ceil(y1/500)*500+(y1%500>400?500:0);
  const X=v=>app? l+(x0-v)/(x0-x1||1)*(W0-l-r) : l+(v-x0)/(x1-x0||1)*(W0-l-r), Y=v=>t+(1-v/y1)*(H0-t-b);
  let g=''; ticks(0,y1,4).forEach(v=>{ g+=`<line x1="${l}" x2="${W0-r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${GRID}"/><text x="${l-6}" y="${Y(v)+3}" text-anchor="end">${v}</text>`; });
  (app?ticks(x1,x0,6):ticks(x0,x1,6)).forEach(v=>{ g+=`<text x="${X(v)}" y="${H0-8}" text-anchor="middle">${app?v:mmss(v)}</text>`; });
  if(app){ g+=`<line x1="${X(Math.min(x0,(y1-TCH)*FT/Math.tan(GP*D2R)/NM))}" y1="${Y(Math.min(y1,pathFt(x0)))}" x2="${X(0)}" y2="${Y(TCH)}" stroke="${REF}" stroke-dasharray="4 4"/>`;
    const mins=M.mins||MINS0[M.k]||200; g+=`<line x1="${l}" x2="${W0-r}" y1="${Y(mins)}" y2="${Y(mins)}" stroke="#b7791f" stroke-dasharray="2 3"/><text x="${W0-r-2}" y="${Y(mins)-4}" text-anchor="end" style="fill:#7a4d06">${M.minsKind||KIND0[M.k]||'DA'} ${mins}</text>`;
    if(x0>=5){ g+=`<line x1="${X(5)}" x2="${X(5)}" y1="${t}" y2="${H0-b}" stroke="${GRID}"/><text x="${X(5)+3}" y="${t+9}">FAP</text>`; } }
  const idx=idxOf(C); const keep=app?(i=>air(i)&&dThrNm(C.N[i])<=x0&&dThrNm(C.N[i])>=-1):air;
  return `<svg viewBox="0 0 ${W0} ${H0}" role="img" aria-label="${esc(L(tr('Vertical profile','Vertikalprofil')))}" data-ch="prof" data-x0="${x0}" data-x1="${x1}" data-app="${app?1:0}" data-l="${l}" data-r="${r}" data-w="${W0}">${g}<text x="${l}" y="${t-2}" style="fill:#8a949c">ft</text>${seriesPair(C,idx,i=>X(xv(i)),i=>Y(C.alt[i]),keep)}<line class="hx" x1="0" x2="0" y1="${t}" y2="${H0-b}" stroke="#17202a" stroke-opacity=".35" visibility="hidden"/></svg>`;
}
function chartPlan(C,M,L){
  const W0=560, H0=300, pad=18; let n0=1e9,n1=-1e9,e0=1e9,e1=-1e9;
  for(let i=0;i<C.n;i++){ n0=Math.min(n0,C.N[i]); n1=Math.max(n1,C.N[i]); e0=Math.min(e0,C.E[i]); e1=Math.max(e1,C.E[i]); }
  n0=Math.min(n0,-300); n1=Math.max(n1,1800); e0=Math.min(e0,-800); e1=Math.max(e1,800);
  const sc=Math.min((W0-2*pad)/(e1-e0),(H0-2*pad)/(n1-n0)); const cx=(e0+e1)/2, cy=(n0+n1)/2;
  const X=e=>W0/2+(e-cx)*sc, Y=nn=>H0/2-(nn-cy)*sc;
  let g='';
  const span=Math.max(e1-e0,n1-n0)/NM, st=span>30?10:span>12?5:span>5?2:1; // grid in NM
  for(let v=Math.ceil(e0/NM/st)*st;v*NM<=e1;v+=st) g+=`<line x1="${X(v*NM)}" x2="${X(v*NM)}" y1="0" y2="${H0}" stroke="${GRID}"/>`;
  for(let v=Math.ceil(n0/NM/st)*st;v*NM<=n1;v+=st) g+=`<line y1="${Y(v*NM)}" y2="${Y(v*NM)}" x1="0" x2="${W0}" stroke="${GRID}"/>`;
  if(M.app||M.hold) g+=`<line x1="${X(0)}" x2="${X(0)}" y1="${Y(Math.max(n0,-16*NM))}" y2="${Y(0)}" stroke="${REF}" stroke-dasharray="4 4"/>`;
  g+=`<rect x="${X(0)-Math.max(1.5,15*sc)}" y="${Y(1500)}" width="${Math.max(3,30*sc)}" height="${Math.max(3,1500*sc)}" fill="#3b4650" rx="1"/>`;
  const FX=(G.AIRPROC&&G.AIRPROC.FIX)||{};
  Object.keys(FX).forEach(k=>{ const f=FX[k]; if(k==='RW36'||f.N<n0||f.N>n1||f.E<e0||f.E>e1) return; g+=`<path d="M${X(f.E)} ${Y(f.N)-5}l4.5 8h-9z" fill="none" stroke="#8a949c" stroke-width="1.3"/><text x="${X(f.E)+7}" y="${Y(f.N)+3}">${k}</text>`; });
  const idx=idxOf(C);
  g+=seriesPair(C,idx,i=>X(C.E[i]),i=>Y(C.N[i]),()=>true);
  if(C.n){ g+=`<circle cx="${X(C.E[0])}" cy="${Y(C.N[0])}" r="4.5" fill="#fff" stroke="${INK}" stroke-width="2"><title>${esc(L(tr('Start','Start')))}</title></circle>`; }
  g+=`<text x="${W0-pad}" y="${H0-6}" text-anchor="end">${L(tr('grid','rutenett'))} ${st} NM</text>`;
  return `<svg viewBox="0 0 ${W0} ${H0}" role="img" aria-label="${esc(L(tr('Plan view of the track','Planvisning av sporet')))}">${g}</svg>`;
}
function chartDev(C,M,L,col,name,cap){
  const W0=275, H0=150, l=28, r=8, t=10, b=22; let x0=0; for(let i=0;i<C.n;i++){ const d=dThrNm(C.N[i]); if(!isNaN(C[col][i])&&!C.gnd[i]&&d>x0&&d<12) x0=d; } x0=Math.max(2,Math.ceil(x0));
  const X=v=>l+(x0-v)/x0*(W0-l-r), Y=v=>t+(1-(v+2.5)/5)*(H0-t-b);
  let g=`<rect x="${l}" y="${Y(1)}" width="${W0-l-r}" height="${Y(-1)-Y(1)}" fill="#fbf0d9" fill-opacity=".7"/><rect x="${l}" y="${Y(.5)}" width="${W0-l-r}" height="${Y(-.5)-Y(.5)}" fill="#e3f1e8"/><line x1="${l}" x2="${W0-r}" y1="${Y(0)}" y2="${Y(0)}" stroke="${REF}"/>`;
  [-2,-1,0,1,2].forEach(v=>{ g+=`<text x="${l-5}" y="${Y(v)+3}" text-anchor="end">${v>0?'+'+v:v}</text>`; });
  ticks(0,x0,4).forEach(v=>{ g+=`<text x="${X(v)}" y="${H0-7}" text-anchor="middle">${v}</text>`; });
  if(x0>=5) g+=`<line x1="${X(5)}" x2="${X(5)}" y1="${t}" y2="${H0-b}" stroke="${REF}" stroke-dasharray="2 3"/>`;
  const idx=idxOf(C);
  g+=seriesPair(C,idx,i=>X(dThrNm(C.N[i])),i=>Y(Math.max(-2.5,Math.min(2.5,C[col][i]))),i=>!isNaN(C[col][i])&&!C.gnd[i]&&dThrNm(C.N[i])<=x0&&dThrNm(C.N[i])>=0);
  return `<figure class="sdb-fig"><svg viewBox="0 0 ${W0} ${H0}" role="img" aria-label="${esc(name)}">${g}</svg><figcaption><span>${esc(name)} · ${esc(L(cap))}</span><span>NM</span></figcaption></figure>`;
}
function chartTimeline(C,M,L){
  const W0=1100, H0=46, l=6, r=6, T=Math.max(1,C.n?C.t[C.n-1]:1); const X=v=>l+v/T*(W0-l-r);
  let g=`<line x1="${l}" x2="${W0-r}" y1="24" y2="24" stroke="#d9d5ca" stroke-width="6" stroke-linecap="round"/>`;
  let a=-1; for(let i=0;i<=C.n;i++){ const on=i<C.n&&C.af[i]; if(on&&a<0) a=i; if(!on&&a>=0){ g+=`<line x1="${X(C.t[a])}" x2="${X(C.t[i-1])}" y1="24" y2="24" stroke="#9aa4ad" stroke-width="6" stroke-dasharray="6 3"><title>${esc(L(tr('Auto-fly','Autofly')))} ${mmss(C.t[a])}–${mmss(C.t[i-1])}</title></line>`; a=-1; } }
  (M.steps||[]).forEach((s,i)=>{ if(s.tm==null) return; const c=s.st===1?'#1f7a4d':s.st===-1?'#b42318':'#b7791f'; g+=`<circle cx="${X(s.tm)}" cy="24" r="5" fill="${c}" stroke="#fff" stroke-width="1.5"><title>${i+1}. ${esc(L(s.t))} · ${mmss(s.tm)}</title></circle>`; });
  (M.bad||[]).forEach(tm=>{ g+=`<path d="M${X(tm)} 13l4 -7h-8z" fill="#b7791f"><title>${esc(L(tr('Out of sequence','Feil rekkefølge')))} · ${mmss(tm)}</title></path>`; });
  if(M.td) g+=`<path d="M${X(M.td.t)} 35l4 7h-8z" fill="#17202a"><title>${esc(L(tr('Touchdown','Touchdown')))} · ${mmss(M.td.t)}</title></path>`;
  g+=`<text x="${l}" y="44" style="font:500 10px var(--f-mono,monospace);fill:#8a949c">0:00</text><text x="${W0-r}" y="44" text-anchor="end" style="font:500 10px var(--f-mono,monospace);fill:#8a949c">${mmss(T)}</text>`;
  return `<svg viewBox="0 0 ${W0} ${H0}" width="100%" role="img" aria-label="${esc(L(tr('Timeline','Tidslinje')))}">${g}</svg>`;
}

let SHEET=null, CUR=null;
function ensureSheet(){
  if(SHEET) return SHEET;
  if(!document.getElementById('sdbcss')){ const s=document.createElement('style'); s.id='sdbcss'; s.textContent=CSS; document.head.appendChild(s); }
  SHEET=document.createElement('div'); SHEET.className='sdb'; SHEET.id='sdb'; SHEET.hidden=true; SHEET.setAttribute('role','dialog'); SHEET.setAttribute('aria-modal','true'); SHEET.setAttribute('aria-labelledby','sdbH');
  document.body.appendChild(SHEET);
  const tip=document.createElement('div'); tip.className='sdb-tip'; tip.hidden=true; document.body.appendChild(tip); SHEET._tip=tip;
  SHEET.addEventListener('click',e=>{ if(e.target===SHEET) close(); const b=e.target.closest('[data-act]'); if(!b) return; const a=b.dataset.act;
    if(a==='close') close(); else if(a==='print'){ G.print(); } else if(a==='again'||a==='next'){ const f=CUR&&CUR.ctl&&CUR.ctl[a]; close(); if(f) setTimeout(f,0); } });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&SHEET&&!SHEET.hidden){ close(); e.stopPropagation(); } },true);
  SHEET.addEventListener('pointermove',e=>{ const sv=e.target.closest&&e.target.closest('svg[data-ch="prof"]'); if(!sv||!CUR){ tip.hidden=true; return; } hover(sv,e); });
  SHEET.addEventListener('pointerleave',()=>{ tip.hidden=true; });
  return SHEET;
}
function hover(sv,e){ const C=CUR.C, tip=SHEET._tip, L=CUR.L; const rc=sv.getBoundingClientRect(), W0=+sv.dataset.w, l=+sv.dataset.l, r=+sv.dataset.r;
  const px=(e.clientX-rc.left)/rc.width*W0; const f=(px-l)/(W0-l-r); if(f<0||f>1){ tip.hidden=true; return; }
  const app=sv.dataset.app==='1', x0=+sv.dataset.x0, x1=+sv.dataset.x1; let best=-1, bd=1e9;
  if(app){ const d=x0-f*(x0-x1); for(let i=0;i<C.n;i++){ if(C.gnd[i]) continue; const q=Math.abs(dThrNm(C.N[i])-d); if(q<bd){ bd=q; best=i; } } }
  else { const tt=x0+f*(x1-x0); for(let i=0;i<C.n;i++){ const q=Math.abs(C.t[i]-tt); if(q<bd){ bd=q; best=i; } } }
  if(best<0){ tip.hidden=true; return; } const i=best, no=CUR.no;
  sv.querySelector('.hx').setAttribute('x1',px); sv.querySelector('.hx').setAttribute('x2',px); sv.querySelector('.hx').setAttribute('visibility','visible');
  tip.textContent=`${mmss(C.t[i])} · ${nf(C.alt[i],0,no)} ft · ${nf(C.ias[i],0,no)} KIAS · ${C.vs[i]>0?'+':''}${nf(C.vs[i]/10,0,no)}0 fpm${app?' · '+nf(dThrNm(C.N[i]),1,no)+' NM':''}${C.af[i]?' · '+L(tr('auto-fly','autofly')):''}`;
  tip.hidden=false; tip.style.left=Math.min(innerWidth-tip.offsetWidth-8,e.clientX+12)+'px'; tip.style.top=(e.clientY-34)+'px'; }
function close(){ if(SHEET){ SHEET.hidden=true; SHEET._tip.hidden=true; document.documentElement.style.overflow=''; } if(CUR&&CUR.ctl&&CUR.ctl.onClose) try{ CUR.ctl.onClose(); }catch(e){} }

function render(D,ctl){
  const L=(G.LAB&&G.LAB.L)?G.LAB.L:(x=>(x&&x.en)||x), no=!!(G.LAB&&G.LAB.lang==='no');
  CUR={D,C:D.C,ctl,L,no}; ensureSheet();
  const E=D.ev, M=D.M, C=D.C;
  const it=E.items, crit=E.crit;
  const row=x=>`<li><span><span class="sdb-chip ${x.res}">${esc(L(LBL[x.res]||LBL.info))}</span></span><span><div class="ti">${x.step?x.step+'. ':''}${esc(L(x.title))}</div>${x.why?`<div class="wh">${esc(L(x.why))}</div>`:''}</span><span class="tm">${x.t==null?'':mmss(x.t)}</span></li>`;
  const groups=['path','oei','lim','chk'].map(c=>{ const g=it.filter(x=>x.cat===c||(c==='lim'&&x.cat==='crit')); return g.length?`<div class="sdb-cat">${esc(L(CATN[c]))}</div><ul class="sdb-items">${g.map(row).join('')}</ul>`:''; }).join('');
  const afT=(()=>{ let s=0; for(let i=0;i+1<C.n;i++) if(C.af[i]) s+=C.t[i+1]-C.t[i]; return s; })();
  const res=E.result, sc=E.score;
  const html=`<div class="sdb-card">
   <button class="sdb-x" data-act="close" aria-label="${esc(L(tr('Close','Lukk')))}">×</button>
   <div class="sdb-eb">${esc(L(tr('Debrief','Debrief')))} · ${esc(D.type)}${D.live?' · '+esc(L(ENDW.manual)):''}</div>
   <div class="sdb-hd"><div><h2 id="sdbH">${esc(L(D.name))}</h2>
     <div class="sdb-meta"><span>${esc(L(tr('Duration','Varighet')))} <b>${mmss(D.dur)}</b></span><span>${esc(L(tr('Ended','Slutt')))} <b>${esc(L(ENDW[D.endWhy]||ENDW.manual))}</b></span>${afT>1?`<span>${esc(L(tr('Auto-fly','Autofly')))} <b>${mmss(afT)}</b> · ${esc(L(tr('not scored','ikke vurdert')))}</span>`:''}<span>${new Date(D.at).toLocaleString(no?'nb-NO':'en-GB',{dateStyle:'medium',timeStyle:'short'})}</span></div></div>
     <div class="sdb-res" style="margin-left:auto"><b class="${res}">${esc(L(RESULT[res]))}</b>${sc!=null?`<span class="sc">${sc}<small> / 100</small></span>`:''}</div></div>
   ${crit.length?`<div class="sdb-crit" role="alert"><h3>${esc(L(tr('Critical errors','Kritiske feil')))}</h3><ul>${crit.map(x=>`<li><b>${esc(L(x.title))}</b>${x.why?' — '+esc(L(x.why)):''} <span class="tm">${x.t!=null?mmss(x.t):''}</span></li>`).join('')}</ul></div>`:''}
   <h3 class="s">${esc(L(tr('Timeline','Tidslinje')))}</h3><div class="sdb-tl">${chartTimeline(C,M,L)}</div>
   <div class="sdb-grid"><div><h3 class="s">${esc(L(tr('Assessment','Vurdering')))}</h3>${groups||`<p class="sdb-note">${esc(L(tr('Nothing to score yet.','Ingenting å vurdere ennå.')))}</p>`}</div>
   <div>${C.n>2?`<h3 class="s">${esc(L(tr('Vertical profile','Vertikalprofil')))}</h3><figure class="sdb-fig">${chartProfile(C,M,L)}<figcaption><span class="lg"><span><i></i>${esc(L(tr('you','du')))}</span><span><i class="af"></i>${esc(L(tr('auto-fly','autofly')))}</span>${M.app?`<span><i class="ref"></i>3°</span>`:''}</span><span>${M.app?esc(L(tr('NM to threshold','NM til terskel'))):esc(L(tr('time','tid')))}</span></figcaption></figure>
     <h3 class="s">${esc(L(tr('Plan view','Planvisning')))}</h3><figure class="sdb-fig">${chartPlan(C,M,L)}</figure>
     ${M.app?`<h3 class="s">${esc(L(tr('Deviation after the FAP','Avvik etter FAP')))}</h3><div class="sdb-two">${chartDev(C,M,L,'loc',L(tr('Lateral (LOC)','Lateralt (LOC)')),tr('dots, + = left of course','prikker, + = venstre for kursen'))}${chartDev(C,M,L,'gsd',L(M.prec?tr('Vertical (GS/GP)','Vertikalt (GS/GP)'):tr('Vertical vs 3° path','Vertikalt mot 3°-bane')),tr('dots, + = above the path','prikker, + = over banen'))}</div><p class="sdb-note">${esc(L(tr('Green band ±½ dot, amber ±1 dot. ½ dot is the target after the final approach point.','Grønt bånd ±½ prikk, gult ±1 prikk. ½ prikk er målet etter sluttinnflygingspunktet.')))}</p>`:''}`:`<p class="sdb-note">${esc(L(tr('No flight recorded yet.','Ingen flyging registrert ennå.')))}</p>`}</div></div>
   <p class="sdb-note">${esc(L(tr('Training tolerances after EASA/ICAO stabilised-approach practice; not an approved skill-test assessment.','Treningstoleranser etter EASA/ICAO-praksis for stabilisert innflyging; ikke en godkjent ferdighetsprøve.')))}</p>
   <div class="sdb-acts"><button data-act="print">${esc(L(tr('Print / PDF','Skriv ut / PDF')))}</button>${ctl&&ctl.next?`<button data-act="next">${esc(L(tr('Next scenario','Neste scenario')))} →</button>`:''}${ctl&&ctl.again?`<button class="pri" data-act="again">${esc(L(tr('Fly again','Fly igjen')))}</button>`:''}</div></div>`;
  SHEET.innerHTML=html; SHEET.hidden=false; document.documentElement.style.overflow='hidden';
  const p=SHEET.querySelector('[data-act="again"]')||SHEET.querySelector('.sdb-x'); try{ p.focus({preventScroll:true}); }catch(e){}
}

/* ---------- recorder bound to one page ----------
   o: {type, page, S, F, AF, cap,
       eng:()=>[deadMask, secMask, torqueMax|NaN, ittMax|NaN], ap:()=>bool, flap:()=>selected flap index,
       scen:()=>({k, name:{en,no}, air:bool, steps:[{t}], done:[0|1|2|-1], bad:number}),
       again:()=>void, next:()=>void, after:Element (toolbar node to put the Debrief button after), tqMax, ittMax} */
function attach(o){
  const S=o.S, F=o.F, A=G.AIRPROC, ring=new Ring(o.cap||12000), row=ring.row;
  const st={on:false,t:0,acc:0,wasAir:false,stopT:0,doneT:0,gaT:null,lo:1e9,ronax:0,ronT:-1e9,inR:false};
  let M=null, stepT=[], lastDone=[], badN=0, badT=[], last=null, endWhy=null, crashT=null, td=null, tdAf=false, afUsed=false;
  function meta(){ const sc=o.scen()||{}; const k=sc.k||''; const ty=(A&&A.TY&&A.TY[o.type])||{};
    const kk=k==='rnav'?'rnp_lpv':k==='seapp'?'ils':k; const app=!!(A&&(A.isApp(kk)||kk==='star'))||kk in MINS0;
    const V=Object.assign({},F.AC.V||{});
    return {type:o.type,k,name:sc.name||tr(k,k),air:!!sc.air,V,nEng:F.AC.nEng||(o.type==='C172'?1:2),retract:o.type!=='C172',ldgFlap:ty.ldgFlap||1,vApp:ty.vFinal||0,vHold:ty.vHold||0,
      mins:(A&&A.MINS&&A.MINS[kk])||MINS0[kk]||null,minsKind:KIND0[kk]||'',prec:!!PREC[kk],app,hold:k==='hold',sid:k==='sid',tqMax:o.tqMax||0,ittMax:o.ittMax||0}; }
  function start(){ ring.clear(); Object.assign(st,{on:true,t:0,acc:DT,wasAir:false,stopT:0,doneT:0,gaT:null,lo:1e9,ronax:0,ronT:-1e9,inR:false});
    M=meta(); stepT=[]; lastDone=[]; badN=0; badT=[]; endWhy=null; crashT=null; td=null; tdAf=false; afUsed=false; last=null;
    const sc=o.scen(); if(sc){ lastDone=(sc.done||[]).slice(); badN=sc.bad||0; } }
  function sample(){
    const s=S, R=F.readouts(s), AF=o.AF;
    row[0]=st.t; row[1]=s.N; row[2]=s.E; row[3]=R.alt; row[4]=R.agl; row[5]=R.ias; row[6]=R.vs; row[7]=R.pitch; row[8]=R.roll; row[9]=R.hdg; row[10]=R.trk;
    const nv=F.nav(s,'LOC',360); row[11]=nv.valid?nv.dev*2:NaN;
    const g=F.WORLD.gs, d=g.N-s.N; row[12]=nv.valid&&d>200?Math.max(-2.5,Math.min(2.5,(Math.atan2(s.h-F.WORLD.elev,d)*R2D-g.ang)/g.fs*2)):NaN;
    row[13]=s.ctl.gearPos; row[14]=o.flap?o.flap():s.ctl.flap; row[15]=o.ap&&o.ap()?1:0; const af=AF&&AF.on?1:0; row[16]=af; if(af) afUsed=true;
    const e=o.eng?o.eng():null; row[17]=e?e[0]:0; row[18]=e?e[1]:0; row[19]=e?e[2]:NaN; row[20]=e?e[3]:NaN;
    row[21]=s.ground?1:0; row[22]=s.buffet||0; row[23]=R.gs;
    ring.push();
    if(!s.ground){ st.wasAir=true; if(R.alt<st.lo) st.lo=R.alt; }
    if(s.ground&&st.wasAir&&!td&&s.landed){ td={t:st.t,N:s.N,E:s.E,vs:s.landed.vs}; tdAf=!!af; }
    /* go-around after descending to near minimums on an approach */
    if(M.app&&st.gaT==null&&!s.ground&&st.lo<(M.mins||300)+250&&R.alt>st.lo+300&&R.vs>300) st.gaT=st.t;
    if(M.hold){ const inR=Math.hypot(s.N+10*NM,s.E)<0.7*NM; if(inR&&!st.inR&&st.t-st.ronT>90){ st.ronax++; st.ronT=st.t; } st.inR=inR; }
    const sc=o.scen(); let done=0, nS=0;
    if(sc){ const dn=sc.done||[]; nS=dn.length; if(lastDone.length!==nS) lastDone.length=nS; for(let i=0;i<nS;i++){ if(dn[i]!==lastDone[i]){ stepT[i]=dn[i]?st.t:null; lastDone[i]=dn[i]; } if(dn[i]) done++; }
      const b=sc.bad||0; if(b>badN){ for(let j=badN;j<b;j++) badT.push(st.t); } badN=b; }
    if(s.crash&&crashT==null) crashT=st.t;
    const why=endCheck(st,{crash:!!s.crash,gnd:s.ground,gs:R.gs,alt:R.alt,N:s.N,E:s.E,t:st.t,stepsDone:done,stepsN:nS,air:!!(M.app||M.hold||M.sid||M.k==='free'),
      kind:M.hold?'hold':M.sid?'sid':'',holdN:AF&&AF.rec&&AF.rec.hold?AF.rec.hold.n:0,sidDone:!!(AF&&AF.rec&&AF.rec.sidDone)});
    if(why&&M.k!=='free') finish(why);
  }
  function build(live){
    const sc=o.scen()||{}; const steps=(sc.steps||[]).map((x,i)=>({t:x.t,st:(sc.done||[])[i]|0,tm:stepT[i]!=null?stepT[i]:null}));
    const AF=o.AF; const C=ring.cols();
    const M2=Object.assign({},M,{steps,bad:badT.slice(),crash:S.crash||null,crashT,td,tdAf,decision:AF&&AF.rec&&AF.rec.decision||null});
    const ev=evaluate(C,M2);
    return {id:o.type+'-'+Date.now().toString(36),at:Date.now(),type:o.type,page:o.page||'',k:M.k,name:M.name,dur:C.n?C.t[C.n-1]:0,afUsed,endWhy:live?'manual':endWhy,live,C,M:M2,ev}; }
  function finish(why){ if(!st.on) return; st.on=false; endWhy=why; const D=build(false); last=D; try{ save(D); }catch(e){}
    if(o.onEnd) try{ o.onEnd(D); }catch(e){}
    if(!o.noAuto) setTimeout(()=>render(D,ctl),0); }
  const ctl={
    start, finish,
    tick(dt){ if(!st.on||!(dt>0)) return; st.t+=dt; st.acc+=dt; if(st.acc<DT&&!S.crash) return; st.acc-=DT; if(st.acc>DT) st.acc=0; sample(); },
    open(){ const D=st.on&&ring.n>2?build(true):(last||build(true)); render(D,ctl); return D; },
    get last(){ return last; }, get recording(){ return st.on; }, get n(){ return ring.n; },
    again:o.again, next:o.next, onClose:o.onClose
  };
  /* Debrief button in the toolbar */
  if(typeof document!=='undefined'&&o.after){ const b=document.createElement('button'); b.className='cb'; b.id='bDebrief'; b.type='button';
    const lab=()=>{ const L=(G.LAB&&G.LAB.L)?G.LAB.L:(x=>x.en); b.textContent=L(tr('Debrief','Debrief')); b.title=L(tr('Debrief: score and replay of this flight','Debrief: vurdering og gjennomgang av denne flygingen')); };
    lab(); if(G.LAB&&G.LAB.onLang) G.LAB.onLang(()=>{ lab(); if(SHEET&&!SHEET.hidden&&CUR&&CUR.ctl===ctl) render(CUR.D,ctl); });
    b.onclick=()=>ctl.open(); o.after.insertAdjacentElement('afterend',b); ctl.btn=b; }
  return ctl;
}

G.SIMDEBRIEF={FLD,IX,Ring,colsFrom,evaluate,endCheck,summary,save,list,attach,render,close,TT,KEY,KEYL,pathFt,dThrNm};
})(typeof window!=='undefined'?window:globalThis);
