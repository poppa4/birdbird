// Node tests for simdebrief.js scoring (run: node tests/debrief.test.mjs): pure functions over synthetic flights.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; ctx.Math=Math; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','simdebrief.js'),'utf8'),ctx);
const D=ctx.SIMDEBRIEF;
let pass=0, fail=0; const fails=[];
function ok(name,c,info){ if(c) pass++; else { fail++; fails.push(name+(info!==undefined?' → '+JSON.stringify(info):'')); } }
const NM=1852;
const V42={s0:62,s1:66,fe1:133,fe2:113,no:151,ne:188,mc:76,yse:85,le:188,lo:152};
const M42=o=>Object.assign({type:'DA42',k:'ils',V:V42,nEng:2,retract:true,ldgFlap:1,vApp:95,vHold:120,mins:210,minsKind:'DA',prec:true,app:true},o||{});
const base={alt:3000,agl:3000,ias:95,vs:0,pitch:0,roll:0,hdg:360,trk:360,loc:0,gsd:0,gear:1,flap:2,ap:0,af:0,dead:0,sec:0,tq:NaN,itt:NaN,gnd:0,buf:0,gs:95,N:0,E:0};
/* a straight-in final from d0 NM down the 3° path to the threshold; mod(row, i, d) may change a sample */
function finalRows(d0,mod,o){ o=o||{}; const rows=[]; let t=0;
  for(let d=d0; d>0.02; d-=95*0.514444*0.2/NM){ const r=Object.assign({},base,{t,N:-d*NM,E:0,alt:D.pathFt(d),agl:D.pathFt(d),vs:-500}); if(mod) mod(r,rows.length,d); rows.push(r); t+=0.2; }
  if(!o.noLand) for(let k=0;k<20;k++){ rows.push(Object.assign({},base,{t,N:200+k*5,alt:0,agl:0,ias:60-k*3,gs:Math.max(0,60-k*3),vs:0,gnd:1})); t+=0.2; }
  return rows; }
const ev=(rows,M)=>D.evaluate(D.colsFrom(rows),M);
const get=(E,id)=>E.items.find(x=>x.id===id);

/* 1. a clean ILS */
{ const E=ev(finalRows(8),M42({td:{t:100,N:250,E:1,vs:-250}}));
  ok('clean ILS: LOC pass',get(E,'loc').res==='pass',get(E,'loc'));
  ok('clean ILS: GS pass',get(E,'gs').res==='pass');
  ok('clean ILS: stable at 1000 ft',get(E,'stable').res==='pass',get(E,'stable'));
  ok('clean ILS: speed and sink pass',get(E,'speed').res==='pass'&&get(E,'sink').res==='pass');
  ok('clean ILS: decision noted at DA',get(E,'decide').res==='info'&&/DA 210/.test(get(E,'decide').why.en));
  ok('clean ILS: touchdown pass',get(E,'td').res==='pass',get(E,'td'));
  ok('clean ILS: limits pass',get(E,'limits').res==='pass');
  ok('clean ILS: overall pass, 100',E.result==='pass'&&E.score===100,[E.result,E.score]);
  ok('Norwegian text uses decimal comma',/0,0 prikk/.test(get(E,'loc').why.no),get(E,'loc').why.no); }

/* 2. localizer off by 1.5 dots for 6 s after the FAP → fail */
{ const E=ev(finalRows(8,(r,i,d)=>{ if(d<4&&d>3.2) r.loc=1.5; }),M42());
  ok('LOC 1.5 dots: fail',get(E,'loc').res==='fail',get(E,'loc'));
  ok('LOC 1.5 dots: overall fail',E.result==='fail'); }
/* 3. 0.7 dot briefly → amber */
{ const E=ev(finalRows(8,(r,i,d)=>{ if(d<4&&d>3.7) r.gsd=0.7; }),M42());
  ok('GS 0.7 dot for a few seconds: amber',get(E,'gs').res==='amber',get(E,'gs')); }
/* 4. fast and gear up at 1000 ft, stable by 500 → amber; never stable → fail */
{ const E=ev(finalRows(8,(r,i,d)=>{ if(r.alt>700){ r.ias=120; r.gear=0; } }),M42());
  ok('unstable at 1000, stable at 500: amber',get(E,'stable').res==='amber',get(E,'stable'));
  const E2=ev(finalRows(8,(r,i,d)=>{ r.ias=125; }),M42());
  ok('not stable by 500 ft: fail',get(E2,'stable').res==='fail',get(E2,'stable'));
  ok('…and the speed band fails',get(E2,'speed').res==='fail'); }
/* 5. auto-flown final: not scored */
{ const E=ev(finalRows(8,(r,i,d)=>{ r.af=1; r.loc=d<4&&d>3?1.6:0; }),M42({td:{t:100,N:250,E:0,vs:-200},tdAf:true}));
  ok('auto-fly: LOC marked auto',get(E,'loc').res==='auto');
  ok('auto-fly: stable marked auto',get(E,'stable').res==='auto');
  ok('auto-fly: touchdown marked auto',get(E,'td').res==='auto');
  ok('auto-fly: not counted as a fail',E.result!=='fail',E.result); }
/* 6. non-precision: below MDA well before the VDP → critical */
{ const M=M42({k:'loc',mins:460,minsKind:'MDA',prec:false});
  const E=ev(finalRows(8,(r,i,d)=>{ if(d<4&&d>2.5){ r.alt=380; r.agl=380; } }),M);
  ok('below MDA early: fail and critical',get(E,'mda').res==='fail'&&get(E,'mda').crit,get(E,'mda'));
  ok('below MDA early: listed as critical',E.crit.some(x=>x.id==='mda'));
  const E2=ev(finalRows(8),M);
  ok('on the 3° path: MDA respected',get(E2,'mda').res==='pass',get(E2,'mda'));
  ok('non-precision: no GS item',!get(E2,'gs')); }

/* 7. engine failure: below Vmca, banked towards the dead engine, wrong engine secured */
function efRows(o){ const rows=[]; let t=0; for(let k=0;k<400;k++){ const fail=t>=5; const r=Object.assign({},base,{t,N:2000+k*10,alt:800,agl:800,ias:90,dead:fail?1:0,gear:0,flap:0});
    if(fail&&o.vmc&&t>20&&t<23) r.ias=70; if(fail&&t>8) r.roll=o.roll!=null?o.roll:3; if(fail&&o.sec!=null&&t>30) r.sec=o.sec; rows.push(r); t+=0.2; } return rows; }
{ const E=ev(efRows({sec:1}),M42({k:'efato',app:false,prec:false}));
  ok('EF: Vmc pass',get(E,'vmc').res==='pass'); ok('EF: bank towards live engine 3°: pass',get(E,'bankLive').res==='pass',get(E,'bankLive'));
  ok('EF: correct engine secured with time',get(E,'secure').res==='pass'&&Math.abs(get(E,'secure').t-30.2)<0.3,get(E,'secure'));
  ok('EF: no wrong-engine item',!get(E,'wrongEng')); ok('EF: overall pass',E.result==='pass',E.items.filter(x=>x.res!=='pass'));
  const E2=ev(efRows({vmc:true,roll:-4,sec:2}),M42({k:'efato',app:false,prec:false}));
  ok('EF: below Vmca is critical',get(E2,'vmc').res==='fail'&&get(E2,'vmc').crit);
  ok('EF: bank towards the dead engine fails',get(E2,'bankLive').res==='fail',get(E2,'bankLive'));
  ok('EF: wrong engine secured is critical',get(E2,'wrongEng')&&get(E2,'wrongEng').crit&&/right/.test(get(E2,'wrongEng').why.en),get(E2,'wrongEng'));
  ok('EF: failed engine never secured → amber',get(E2,'secure').res==='amber');
  ok('EF: overall fail with 2 critical',E2.result==='fail'&&E2.crit.length===2,E2.crit.map(x=>x.id));
  const E3=ev(efRows({}),M42({k:'efato',app:false,prec:false,nEng:1}));
  ok('single engine: no OEI items',!get(E3,'vmc')&&!get(E3,'secure')); }

/* 8. limits */
{ const rows=finalRows(8,(r,i,d)=>{ if(d>6&&d<6.3){ r.ias=125; r.flap=2; } if(d>7.5) { r.roll=50; } },{noLand:true});
  const E=ev(rows,M42());
  ok('VFE exceedance: flagged',get(E,'vfe')&&get(E,'vfe').res!=='pass',get(E,'vfe'));
  ok('bank > 45° for > 2 s: flagged',get(E,'bank')&&get(E,'bank').res==='amber',get(E,'bank'));
  ok('no "limits respected" item when exceeded',!get(E,'limits'));
  const E2=ev(efRows({sec:1}).map(r=>Object.assign(r,{ias:r.t>40&&r.t<42?200:r.ias})),M42({k:'free',app:false}));
  ok('VNE exceedance is critical',get(E2,'vne')&&get(E2,'vne').crit);
  const E3=ev(efRows({sec:1}).map(r=>Object.assign(r,{tq:r.t>40&&r.t<42?2400:1800,itt:700})),M42({k:'free',app:false,tqMax:2230,ittMax:800}));
  ok('overtorque flagged, ITT fine',get(E3,'tq')&&!get(E3,'itt'),[get(E3,'tq'),get(E3,'itt')]);
  const E4=ev(efRows({sec:1}).map(r=>Object.assign(r,{gear:r.t>40&&r.t<42?0.5:0,ias:r.t>40&&r.t<42?170:90})),M42({k:'free',app:false}));
  ok('gear moving above VLO flagged',get(E4,'vle')&&get(E4,'vle').res==='fail'); }

/* 9. holding and SID */
{ const rows=[]; for(let k=0;k<1500;k++) rows.push(Object.assign({},base,{t:k*0.2,N:-10*NM+Math.sin(k/100)*4000,E:Math.cos(k/100)*1500-1500,alt:3000+(k>800&&k<820?150:20),ias:118}));
  const E=ev(rows,M42({k:'hold',app:false,prec:false,hold:true}));
  ok('hold: 150 ft deviation is amber',get(E,'holdAlt').res==='amber',get(E,'holdAlt'));
  ok('hold: speed pass',get(E,'holdSpd').res==='pass'); }
{ const rows=[]; for(let k=0;k<900;k++){ const alt=Math.min(3050,400+k*5); rows.push(Object.assign({},base,{t:k*0.2,N:1700+k*15,alt,agl:alt,trk:alt<1500?360:322,ias:92})); }
  const E=ev(rows,M42({k:'sid',app:false,prec:false,sid:true}));
  ok('SID: runway track until 1500 ft',get(E,'sidTrk').res==='pass',get(E,'sidTrk'));
  ok('SID: level-off within 100 ft',get(E,'sidLvl').res==='pass',get(E,'sidLvl')); }

/* 10. exercise goals are scored; the student's own checklist is information unless chosen (outcome-based scoring) */
{ const E=ev(efRows({sec:1}),M42({k:'efato',app:false,steps:[{t:{en:'A',no:'A'},st:1,tm:3},{t:{en:'B',no:'B'},st:2,tm:5},{t:{en:'C',no:'C'},st:-1,tm:8},{t:{en:'D',no:'D'},st:0,tm:null}]}));
  const S=E.items.filter(x=>x.id==='step');
  ok('goals: done/skipped/bad/not reached',S.map(x=>x.res).join()==='pass,amber,fail,amber',S.map(x=>x.res));
  ok('goals: timing kept',S[0].t===3&&S[0].step===1);
  ok('no order or generic-flow items',!get(E,'order')&&!get(E,'ticked'));
  ok('score counts amber as half',E.score===Math.round(100*(E.counts.pass+0.5*E.counts.amber)/(E.counts.pass+E.counts.amber+E.counts.fail))); }
{   const own={name:'My SOP',items:[{t:{en:'Beacon',no:'Beacon'},st:1},{t:{en:'Pumps',no:'Pumper'},st:0}]};
  ok('own checklist: info by default',get(ev(efRows({sec:1}),M42({k:'efato',app:false,own})),'own').res==='info');
  const Es=ev(efRows({sec:1}),M42({k:'efato',app:false,own:Object.assign({},own,{score:true})}));
  ok('own checklist: scored when chosen (amber, lists the missed item)',get(Es,'own').res==='amber'&&/Pumps/.test(get(Es,'own').why.en));
  ok('react: outcome time, pass within the limit',get(ev(efRows({sec:1}),M42({k:'efato',app:false,failT:10,actT:22,crit:{en:'x',no:'x'}})),'react').res==='pass');
  ok('react: amber when slow',get(ev(efRows({sec:1}),M42({k:'efato',app:false,failT:10,actT:40,crit:{en:'x',no:'x'}})),'react').res==='amber');
  ok('react: no item without an outcome predicate',!get(ev(efRows({sec:1}),M42({k:'efato',app:false,failT:10})),'react')); }

/* 11. crash is critical; end-of-scenario checks */
{ const E=ev(efRows({sec:1}),M42({k:'free',app:false,crash:'Gear-up landing',crashT:70}));
  ok('crash: critical fail',get(E,'crash').crit&&E.result==='fail'); }
{ const st={wasAir:true}; let w=null; for(let i=0;i<12&&!w;i++) w=D.endCheck(st,{gnd:true,gs:1,alt:0,N:500,E:0,t:i*0.2,stepsN:0,stepsDone:0});
  ok('end: landed and stopped',w==='landed');
  ok('end: crash',D.endCheck({},{crash:true})==='crash');
  const s2={}; let w2=null; for(let i=0;i<10&&!w2;i++) w2=D.endCheck(s2,{gnd:true,gs:0,alt:0,N:0,E:0,t:i*0.2,stepsN:3,stepsDone:3,air:false});
  ok('end: checklist complete (ground flow)',w2==='complete');
  ok('end: approach does not end on its checklist',D.endCheck({},{gnd:false,gs:90,alt:900,N:-3*NM,E:0,t:50,stepsN:3,stepsDone:3,air:true})===null);
  ok('end: SID at OSVIK',D.endCheck({},{gnd:false,gs:90,alt:3000,N:18*NM,E:-14*NM,t:600,kind:'sid'})==='sid');
  ok('end: hold after two circuits',D.endCheck({},{gnd:false,gs:90,alt:3000,N:0,E:0,t:600,kind:'hold',holdN:2})==='hold'); }

/* 12. ring buffer keeps the newest samples in order; summary is compact */
{ const R=new D.Ring(5); for(let i=0;i<8;i++){ R.row[0]=i; R.push(); } const C=R.cols();
  ok('ring: keeps the last 5 in order',C.n===5&&Array.from(C.t).join()==='3,4,5,6,7');
  const E=ev(finalRows(8),M42()); const s=D.summary({id:'x',at:1,type:'DA42',page:'cockpit',k:'ils',name:{en:'ILS 36',no:'ILS 36'},dur:120,afUsed:false,endWhy:'landed',M:M42({steps:[]}),ev:E});
  ok('summary: compact and scored',s.res==='pass'&&s.sc===100&&JSON.stringify(s).length<600,JSON.stringify(s).length); }

/* 13. auto-flown final: path/speed not scored, but an unconfigured aircraft is a remark (never a fail) */
{ const E=ev(finalRows(8,r=>{ r.af=1; r.ias=140; r.gear=0; r.flap=0; },{noLand:true}),M42());
  ok('auto-fly final: stable is amber on configuration only',get(E,'stable').res==='amber'&&/gear not down/.test(get(E,'stable').why.en)&&!/KIAS/.test(get(E,'stable').why.en),get(E,'stable'));
  ok('auto-fly final: speed not scored',get(E,'speed').res==='auto');
  const E2=ev(finalRows(8,r=>{ r.af=1; },{noLand:true}),M42());
  ok('auto-fly final, configured: stable not scored',get(E2,'stable').res==='auto'); }

console.log(`debrief: ${pass} passed, ${fail} failed`); if(fail){ console.log(fails.join('\n')); process.exit(1); }
