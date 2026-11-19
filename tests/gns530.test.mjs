// Node tests for the GNS 530 trainer (run: node tests/gns530.test.mjs): every task can be done with the keys its steps name,
// the radios, the cursor and the entries behave as on the unit, and the flight model sequences, suspends and switches CDI scale.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={console}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','gns530.js'),'utf8'),ctx);
const G=ctx.GNS;
let pass=0, fail=0; const fails=[];
function ok(name,c,info){ if(c) pass++; else { fail++; fails.push(name+(info!==undefined?'  ['+info+']':'')); } }
const S=()=>G.state();
const k=(...ks)=>ks.forEach(x=>G.press(x));
const type=s=>s.split('').forEach(c=>G.press(c));
const ids=()=>S().fpl.wps.map(w=>w.id).join(' ');
const done=id=>{ const sc=G.scn.find(s=>s.id===id); return sc.steps.map(s=>s.ok()); };
const all=id=>done(id).every(Boolean);
const fly=(sec,f)=>{ for(let i=0;i<sec;i++){ G.tick(1,3); if(f&&f()) return true; } return false; };

/* ---------- radios ---------- */
ok('COM: small knob walks the 8.33 channel names',G.comStep('118.000',false,1)==='118.005'&&G.comStep('118.015',false,1)==='118.025'&&G.comStep('118.090',false,1)==='118.100');
ok('COM: small knob down from x00 to the previous block',G.comStep('118.100',false,-1)==='118.090');
ok('COM: rolls over within the MHz',G.comStep('118.990',false,1)==='118.000');
ok('COM: large knob 136 → 118',G.comStep('136.025',true,1)==='118.025');
ok('NAV: 50 kHz steps',G.navStep('108.00',false,1)==='108.05'&&G.navStep('108.95',false,1)==='108.00'&&G.navStep('117.30',true,1)==='108.30');
G.load('radio'); { let n=0; while(S().com.stby!=='127.425'&&n<40){ G.press(S().com.stby.split('.')[0]<'127'?'LL+':'LL-'); n++; if(S().com.stby.startsWith('127.')) break; }
  n=0; while(S().com.stby!=='127.425'&&n<200){ G.press('LS+'); n++; } }
ok('radio: 127.425 reachable with the knobs',S().com.stby==='127.425');
k('CFF'); ok('radio: C flips',S().com.act==='127.425');
k('RS+','RS+','RPUSH'); { let n=0; while(n<10){ const it=G.items()[S().crsr.i]; if(it&&it.f&&it.f.n==='TOWER') break; G.press('RL+'); n++; } } k('ENT');
ok('radio: tower from NAVCOM to COM standby',S().com.stby==='118.305');
k('LPUSH'); ok('radio: push small left knob moves the box to NAV',S().tune==='NAV');
{ let n=0; while(!S().nav.stby.startsWith('114.')&&n<12){ G.press('LL+'); n++; } n=0; while(S().nav.stby!=='114.30'&&n<30){ G.press('LS+'); n++; } }
k('VFF','ID'); ok('radio: task complete',all('radio'),done('radio'));
G.load('radio'); G.press('CFFL'); ok('hold C: 121.500 active',S().com.act==='121.500');

/* ---------- pages and cursor ---------- */
G.load('tour'); k('RS+'); ok('small knob: NAV page 2 is the map',S().pg.NAV===1); k('RNGD');
k('RL+'); ok('large knob: WPT group',S().group==='WPT'); k('RS+'); k('RPUSH'); ok('CRSR on the ident',S().crsr.on&&S().crsr.i===0);
type('XFJ'); ok('entry completes from the database',G.screen().includes('FJELLBY')); k('ENT'); ok('WPT ident changed',S().wptId==='XFJB');
k('RPUSH','RL+'); ok('NRST group',S().group==='NRST'); k('CLRL'); ok('tour: task complete',all('tour'),done('tour'));
/* spelling with the knobs only */
G.load('tour'); k('RL+','RPUSH','RS-'); ok('knob entry starts at the first letter',S().ed&&S().ed.c[0]==='W'||S().ed.c[0]==='X',S().ed&&S().ed.c.join(''));
G.load('tour'); k('RL+','RPUSH'); G.press('RS+'); G.press('RS-'); k('RL+'); for(let i=0;i<4;i++) G.press('RS+'); k('ENT'); ok('knob entry: X, large knob, B→F, ENT = XFJB',S().wptId==='XFJB',S().wptId);

/* ---------- flight plan ---------- */
G.load('fpl'); k('FPL','RPUSH'); ok('FPL with cursor on the empty line',S().ovl==='fpl'&&S().crsr.on);
for(const w of ['XNDV','ROKUS','HVL','ODRUP','XSKH']){ G.press('RS+'); G.press('CLR'); type(w); k('ENT'); }
ok('fpl: route entered in order',ids()==='XNDV ROKUS HVL ODRUP XSKH',ids());
k('RPUSH'); ok('fpl: task complete',all('fpl'),done('fpl'));
G.load('xchk'); k('FPL','RPUSH'); while(G.items()[S().crsr.i].id!=='KAVLO') G.press('RL+'); k('CLR'); ok('CLR on a waypoint asks',S().popup&&/Remove KAVLO/.test(S().popup.q)); k('ENT');
ok('KAVLO removed',!ids().includes('KAVLO'),ids()); ok('cursor now on XSKH',G.items()[S().crsr.i].id==='XSKH',G.items()[S().crsr.i].id);
type('HVL'); k('ENT'); type('ODRUP'); k('ENT'); ok('xchk: task complete',all('xchk'),ids());
G.load('dep'); k('PROC','RL+','RL+','ENT','ENT','ENT','ENT'); ok('SID ROKUS1A loaded',S().fpl.dep&&S().fpl.dep.name==='ROKUS1A'&&ids().startsWith('XNDV NV190 TOSOK ROKUS HVL'),ids()); ok('dep: task complete',all('dep'));
ok('dep: active leg is the first SID leg on the ground',S().fpl.wps[S().fpl.act].id==='NV190');
/* menu: activate leg */
G.load('free'); k('FPL','RPUSH'); while(G.items()[S().crsr.i].id!=='ODRUP') G.press('RL+'); k('MENU'); ok('FPL menu',S().popup&&S().popup.menu); k('ENT'); ok('Activate Leg: ODRUP active, leg from HVL',G.nav().id==='ODRUP'&&G.nav().A.id==='HVL');

/* ---------- direct to ---------- */
G.load('dto'); k('FPL','RPUSH','RL+'); k('DTO'); ok('D→ prefilled from the cursor',S().dtoPg.id==='ODRUP'); k('ENT','ENT');
ok('direct ODRUP from present position, plan kept',G.nav().id==='ODRUP'&&!S().dto&&ids().includes('XSKH')&&Math.abs(G.nav().xtk)<0.01);
ok('MSG: set course to the new DTK',S().msgNew&&S().msgs.some(m=>/^Set course to/.test(m.t)));
G.setCrs(G.nav().dtk); ok('dto: task complete',all('dto'),done('dto')); ok('course message gone when set',!S().msgs.some(m=>/^Set course/.test(m.t)));
G.load('obs'); k('DTO'); type('SKH'); k('ENT'); ok('D→ ENT moves to Activate?',S().dtoPg.sel==='act'); k('ENT'); ok('direct SKH off the plan',S().dto&&S().dto.id==='SKH');
k('OBS'); G.setCrs(250); ok('obs: task complete',all('obs'),done('obs'));
fly(200); ok('OBS: no sequencing, still to SKH',G.nav().id==='SKH'&&S().obs);
k('DTO','MENU','ENT'); ok('Cancel Direct-To: back to the plan',!S().dto);

/* ---------- procedures ---------- */
G.load('arr'); k('PROC','RL+','ENT','ENT','ENT'); ok('ODRUP2W loaded',S().fpl.arr&&S().fpl.arr.name==='ODRUP2W'&&ids().includes('ODRUP TOLKA SK260 XSKH'),ids());
k('PROC','ENT','ENT','RS+','ENT'); ok('psel ILS 25 via SK260',S().psel&&S().psel.name==='ILS 25'&&S().psel.trans==='SK260');
ok('NOT APPROVED FOR GPS shown',G.screen().includes('NOT APPROVED FOR GPS'));
k('ENT'); ok('ILS 25 loaded, not active',S().fpl.app&&!S().fpl.app.active); ok('localizer frequency in NAV standby',S().nav.stby==='110.30');
ok('plan: arrival joins the approach at SK260, no duplicates',ids().endsWith('ODRUP TOLKA SK260 SK255 FI25 RW25 SKH'),ids());
k('FPL'); ok('arr: task complete',all('arr'),done('arr'));
ok('en route still to ODRUP',G.nav().id==='ODRUP');

G.load('ils'); k('PROC'); ok('VTF first in PROC',G.screen().includes('Vector-To-Final')); k('ENT');
ok('VTF: active leg is the final course to FI25',G.nav().id==='FI25'&&Math.round(G.nav().dtk)===250,G.nav().dtk);
k('VFF','ID','CDI'); G.setCrs(250); G.ap('HDG',220);
const cap=fly(400,()=>{ const v=G.vloc(); if(v&&v.valid&&Math.abs(v.dev)<2.4) G.ap('NAV'); return G.scn.find(s=>s.id==='ils').steps[3].ok(); });
ok('ILS: localizer captured on VLOC',cap); ok('ils: task complete',all('ils'),done('ils'));
fly(200,()=>Math.abs(G.vloc().dev)<0.2); ok('ILS: tracking the localizer',Math.abs(G.vloc().dev)<0.5,G.vloc().dev);

G.load('rnp'); k('PROC','ENT','RS+','ENT','RS+','ENT'); ok('RNAV 25 via SK260 selected',S().psel&&S().psel.name==='RNAV 25'&&S().psel.trans==='SK260');
ok('LPV shown on the selection',G.screen().includes('LPV')); k('RL+','ENT'); ok('RNAV 25 active, direct SK260',S().fpl.app.active&&G.nav().id==='SK260'&&!S().fpl.app.vtf);
ok('TERM before the approach',G.cdiMode()==='TERM');
let seen={}; fly(600,()=>{ seen[G.cdiMode()]=1; return G.cdiMode()==='LPV'; });
ok('LPV within 2 NM of FF25',G.cdiMode()==='LPV'&&G.nav().id==='FF25'&&G.nav().dis<=2.1,G.cdiMode()+' '+G.nav().id+' '+G.nav().dis);
ok('rnp: task complete',all('rnp'),done('rnp'));
fly(300,()=>S().susp); ok('SUSP at the MAP',S().susp&&G.nav().id==='RW25');
const bt=G.nav().dtk; fly(20); ok('SUSP: keeps the final course',Math.abs(((S().trk-bt+540)%360)-180)<5,S().trk);

G.load('miss'); fly(60,()=>S().susp); ok('miss: SUSP',S().susp); k('OBS'); ok('OBS releases SUSP to SKH',!S().susp&&G.nav().id==='SKH'); k('CLRL'); ok('miss: task complete',all('miss'),done('miss')); ok('missed approach: TERM',G.cdiMode()==='TERM');
fly(400,()=>S().susp); ok('at the holding point: SUSP again',S().susp&&G.nav().id==='SKH');

G.load('nrst'); k('RL-'); ok('NRST from NAV with the large knob back',S().group==='NRST'); ok('nearest is XBRK',G.items()[0].id==='XBRK');
k('RPUSH','DTO','ENT','ENT'); ok('direct XBRK',S().dto&&S().dto.id==='XBRK'); k('RL+','RS-','RPUSH','RL+','ENT','CFF'); ok('nrst: task complete',all('nrst'),done('nrst')+' '+S().com.act);

G.load('div'); k('DTO'); type('XFJB'); k('ENT','ENT'); ok('direct XFJB',S().dto&&S().dto.id==='XFJB');
k('PROC','ENT'); ok('approaches for XFJB',S().psel&&S().psel.apt==='XFJB'); k('ENT','ENT','RL+','ENT');
ok('ILS 34 active with VTF, dest XFJB',S().fpl.app&&S().fpl.app.apt==='XFJB'&&S().fpl.app.vtf&&G.nav().id==='FI34'&&Math.round(G.nav().dtk)===340,ids());
ok('old arrival gone',!S().fpl.arr&&!ids().includes('XSKH'),ids()); k('VFF','ID'); ok('div: task complete',all('div'),done('div'));

/* ---------- every task: the steps' keys exist on the unit, and every scenario draws ---------- */
const KEYS=new Set(['RS+','RS-','RL+','RL-','RPUSH','LS+','LS-','LL+','LL-','LPUSH','CFF','VFF','ID','CDI','OBS','MSG','FPL','VNAV','PROC','RNGU','RNGD','DTO','MENU','CLR','ENT','CLRL','CFFL']);
for(const sc of G.scn){ G.load(sc.id); let svg=''; try{ svg=G.screen(); }catch(e){ svg='ERR '+e.message; } ok('draws: '+sc.id,svg.startsWith('<svg')&&!svg.includes('NaN')&&!svg.includes('undefined'),svg.slice(0,80));
  for(const st of sc.steps) for(const kk of st.keys) ok('key exists: '+sc.id+' '+kk,KEYS.has(kk)); }
/* every page draws in flight and on the ground */
for(const id of ['free','fpl']){ G.load(id); for(let g=0;g<3;g++){ for(let p=0;p<4;p++){ const s=G.screen(); ok('page draws '+id+' '+S().group+S().pg[S().group],!s.includes('NaN')&&!s.includes('undefined')); G.press('RS+'); } G.press('RL+'); }
  for(const kk of ['FPL','PROC','DTO','MSG','VNAV']){ G.press(kk); const s=G.screen(); ok('overlay draws '+id+' '+kk,!s.includes('NaN')&&!s.includes('undefined')); G.press('CLRL'); } }
/* drill pages are reachable */
for(const t of G.drillT) ok('drill has a way: '+t.id,!!t.a&&!!t.k);
ok('course: every task exists',G.course.every(m=>m.tasks.every(t=>G.scn.some(s=>s.id===t))));
ok('course: every drill exists',G.course.every(m=>m.drill.every(t=>G.drillT.some(s=>s.id===t))));
ok('course: quiz answers in range',G.course.every(m=>m.quiz.every(q=>q.c>=0&&q.c<q.a.length)));

console.log(`${pass} passed, ${fail} failed`); if(fail){ console.log(fails.join('\n')); process.exit(1); }
