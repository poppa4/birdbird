// Node tests for jetsyscore.js (run: node tests/jetsys.test.mjs): the system networks, the fuel feed and the control laws.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','jetsyscore.js'),'utf8'),ctx); const S=ctx.SYC;
let pass=0, fail=0; const fails=[];
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } }
const st=(cls,F,A)=>{ const d=S.defaults(cls); Object.assign(d.F,F||{}); Object.assign(d.A,A||{}); return d; };
const R=(cls,F,A)=>S.solve(cls,st(cls,F,A));

/* the solver itself */
{ const n=[{id:'a',src:true},{id:'b'},{id:'c',fail:true},{id:'d'}], e=[{a:'a',b:'b'},{a:'b',b:'c'},{a:'c',b:'d'}]; const lv=S.net(n,e);
  ok('net: reaches b',lv.b); ok('net: failed node blocks',!lv.c&&!lv.d); ok('net: edge marked',e[0].on&&!e[1].on); }
{ const n=[{id:'g',src:true},{id:'x'},{id:'bat',src:true}], e=[{a:'g',b:'x'},{a:'bat',b:'x',bi:true}]; S.net(n,e,['g','bat']);
  ok('net: battery charged from the bus (reverse flow)',e[1].on&&e[1].rev); }

/* electrics */
{ const r=R('jet'); ok('jet normal: both AC buses live',r.elec.lv.ac1&&r.elec.lv.ac2); ok('jet normal: RAT stowed',!r.elec.info.ratOut); ok('jet normal: bus tie open',!r.elec.edges.find(e=>e.tie&&e.a==='ac1').on); }
{ const r=R('jet',{g1:true}); ok('jet gen 1 fail: AC 1 through the bus tie',r.elec.lv.ac1&&r.elec.edges.find(e=>e.a==='ac1'&&e.b==='ac2').on); }
{ const r=R('jet',{g1:true},{apu:true}); ok('jet gen 1 fail + APU: APU feeds AC 1, tie open',r.elec.lv.ac1&&r.elec.edges.find(e=>e.a==='apu'&&e.b==='ac1').on&&!r.elec.edges.find(e=>e.a==='ac1'&&e.b==='ac2').on); }
{ const r=R('jet',{dual:true}); ok('jet dual: RAT out, AC ESS live, AC 1/2 dead',r.elec.info.ratOut&&r.elec.lv.acess&&!r.elec.lv.ac1&&!r.elec.lv.ac2); ok('jet dual: DC ESS via ESS TR',r.elec.lv.dcess&&r.elec.lv.esstr);
  ok('jet dual: RAT drives hyd system 3',r.hyd.info.sys[3]&&!r.hyd.info.sys[1]&&!r.hyd.info.sys[2]); ok('jet dual: flight controls on system 3 only, alternate law',r.fc.info.law==='alt'); }
{ const r=R('jet',{dual:true,emer:true}); ok('jet batteries only: static inverter feeds AC ESS',r.elec.info.battOnly&&r.elec.lv.inv&&r.elec.lv.acess); }
{ const r=R('jet',{tr:true}); ok('jet TR 1 fail: DC 1 through DC tie, ESS TR on',r.elec.lv.dc1&&r.elec.lv.esstr&&r.elec.lv.dcess); }
{ const r=R('tp',{g1:true}); ok('tp gen 1 fail: L bus via ties',r.elec.lv.lbus&&r.elec.info.nGen===1); }
{ const r=R('tp',{g1:true,g2:true}); ok('tp both gens: battery only, ESS live',r.elec.info.battOnly&&r.elec.lv.ess); }
{ const r=R('tp',{inv:true}); ok('tp inverter 1 fail: AC lost',!r.elec.lv.ac); const r2=R('tp',{inv:true},{inv:2}); ok('tp inverter 2 selected: AC back',r2.elec.lv.ac); }
{ const r=R('tp',{bus:true}); ok('tp L bus fault: gear pump lost, ESS kept',!r.elec.lv.gear&&r.elec.lv.ess); }
{ const r=R('pist',{g1:true,g2:true}); ok('piston both alternators: battery only',r.elec.info.battOnly&&r.elec.lv.bus); ok('piston: engines need no electrics (fuel still feeds)',r.fuel.info.fm.e1.run&&r.fuel.info.fm.e2.run); }

/* hydraulics */
{ const r=R('jet',{p1:true}); ok('jet EDP 1 fail: PTU powers system 1',r.hyd.info.sys[1]&&r.hyd.info.ptuRun); }
{ const r=R('jet',{p1:true},{ptu:false}); ok('jet EDP 1 fail, PTU off: system 1 lost',!r.hyd.info.sys[1]); }
{ const r=R('jet',{leak:true}); ok('jet system 1 leak: PTU cannot help',!r.hyd.info.sys[1]&&!r.hyd.info.ptuRun); ok('jet system 1 leak: gear normal extension lost',!r.gear.info.normal); ok('jet sys 1 leak: brakes still (alternate)',r.gear.lv.brk); }
{ const r=R('tp',{p1:true}); ok('tp pump 1 fail: system still live',r.hyd.info.sys); const r2=R('tp',{leak:true}); ok('tp leak: system lost, brakes on accumulator',!r2.hyd.info.sys&&r2.hyd.lv.brk&&r2.hyd.lv.acc); ok('tp leak: roll spoilers lost',!r2.fc.lv.spl); }
{ const r=R('pist',{pp:true}); ok('piston power pack fail: gear actuators dead',!r.hyd.lv.gear); const r2=R('pist',{pp:true},{hand:true}); ok('piston hand pump moves the gear',r2.hyd.lv.gear); }

/* fuel */
{ const s=st('jet'); const f=S.feed('jet',s.F,s.A,s.Q,S.elec('jet',s.F,s.A)); ok('jet: centre tank first',f.e1.from.C===1&&f.e2.from.C===1); }
{ const s=st('jet',{cp:true}); const f=S.feed('jet',s.F,s.A,s.Q,S.elec('jet',s.F,s.A)); ok('jet centre pumps fail: wings feed, centre unusable',f.e1.from.L===1&&f.e2.from.R===1); }
{ const s=st('jet',{e1:true},{ctr:false}); s.Q.C=0; const el=S.elec('jet',s.F,s.A); for(let i=0;i<60;i++) S.fuelStep('jet',s.F,s.A,s.Q,el,1/60);
  ok('jet engine 1 out: left wing stays heavy',s.Q.L-s.Q.R>1000);
  s.A.xf=true; s.A.pR=false; const q0=s.Q.L; S.fuelStep('jet',s.F,s.A,s.Q,el,0.5); ok('jet crossfeed + right pumps off: engine 2 burns the left wing',s.Q.L<q0&&S.feed('jet',s.F,s.A,s.Q,el).e2.from.L===1); }
{ const s=st('jet',{lp:true},{ctr:false}); const f=S.feed('jet',s.F,s.A,s.Q,S.elec('jet',s.F,s.A)); ok('jet L pumps fail: suction feed',f.e1.run&&f.e1.suction); }
{ const s=st('pist',{edp1:true}); const el=S.elec('pist',s.F,s.A); ok('piston engine pump fail: engine stops without aux pump',!S.feed('pist',s.F,s.A,s.Q,el).e1.run); s.A.aux1=true; ok('piston: aux pump keeps it running',S.feed('pist',s.F,s.A,s.Q,el).e1.run); }
{ const s=st('pist',{},{selR:'x'}); const f=S.feed('pist',s.F,s.A,s.Q,S.elec('pist',s.F,s.A)); ok('piston crossfeed: engine 2 from the left tank',f.e2.from.L===1); }
{ const s=st('tp',{},{xf:true,bR:false}); const f=S.feed('tp',s.F,s.A,s.Q,S.elec('tp',s.F,s.A)); ok('tp crossfeed, R boost off: both engines from the left',f.e1.from.L===1&&f.e2.from.L===1); }
{ const s=st('tp',{},{fwL:false}); const f=S.feed('tp',s.F,s.A,s.Q,S.elec('tp',s.F,s.A)); ok('tp firewall valve closed: engine 1 starves',!f.e1.run); }

/* flight controls */
ok('law normal',R('jet').fc.info.law==='normal'); ok('law alt with air data fault',R('jet',{adr:true}).fc.info.law==='alt');
ok('law direct',R('jet',{comp:true}).fc.info.law==='direct'); { const r=R('jet',{allc:true}); ok('mechanical backup: stab trim and rudder only',r.fc.info.law==='mech'&&r.fc.lv.ths&&r.fc.lv.rud&&!r.fc.lv.elev&&!r.fc.lv.ail); }
{ const r=R('pist',{g1:true,g2:true,bat:true}); ok('piston flight controls are mechanical',r.fc.lv.elev&&r.fc.lv.ail&&r.fc.lv.rud); }

/* gear */
{ const r=R('jet',{gf:true}); ok('gear fault: normal lost',!r.gear.info.normal); const r2=R('jet',{gf:true},{emer:true}); ok('emergency extension reaches the legs',r2.gear.lv.legs); }
{ const r=R('jet',{bn:true}); ok('jet normal brakes lost: alternate on 2, no autobrake',r.gear.lv.brk&&r.gear.lv.h2&&!r.gear.lv.ab); }

console.log(`${pass} passed, ${fail} failed`); if(fail){ console.log(fails.join('\n')); process.exit(1); }
