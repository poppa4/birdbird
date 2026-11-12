// Node tests for the shared cockpit-trainer shell (run: node --test tests/simshell.test.mjs): the six sim pages carry the same
// toolbar, … menu and Procedures drawer markup in the same order, the per-aircraft drawer data are complete in EN and NO, and the
// removed controls (area button row, exercise selector, magnifier glyphs, double-click toggle) stay gone.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), src=f=>fs.readFileSync(path.join(here,'..',f),'utf8');
const PAGES=['c172.html','c172-3d.html','cockpit.html','da42-3d.html','b200.html','b200-3d.html'];
const ids=(html,from,to)=>{ const a=html.indexOf(from), b=html.indexOf(to,a); return [...html.slice(a,b).matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]); };
const txt=t=>typeof t==='string'||(t&&typeof t.en==='string'&&t.en.length>0&&typeof t.no==='string'&&t.no.length>0);

test('one toolbar: same controls in the same order on all six pages',()=>{
  const want=['acSel','apSel','bAuto','bDrawer','bPause','bDebrief','bMore'];
  for(const f of PAGES){ const h=src(f); assert.deepEqual(ids(h,'<div class="ctop"','<div class="cbody">'),want,f);
    assert.match(h,/id="bDebrief" type="button" hidden/,f+': Debrief only after a flight');
    for(const gone of ['id="scenSel"','id="zoomBar"','id="procSel"','id="stat2"','id="tabLim"','id="tabMis"','id="touch"','id="tStk"']) assert.ok(!h.includes(gone),f+' still has '+gone);
    assert.equal(/3D<small>beta<\/small>/.test(h),f.includes('3d'),f+': the Beta badge only on the 3D pages'); }
});

test('the … menu and the drawer tabs are identical on all six pages',()=>{
  const menu=['moreMenu','bReset','bAhead','bOtw','zoomSel','bSound','bTouch','bFull','bDbNow','bDbAuto','bKeys','bPerf'];
  for(const f of PAGES){ const h=src(f); assert.deepEqual(ids(h,'<div class="more"','</div>'),menu,f);
    const tabs=[...h.matchAll(/<button data-t="(\w+)"/g)].map(m=>m[1]); assert.deepEqual(tabs,['ck','fl','sp'],f);
    for(const p of ['tabCk','tabFl','tabSp','ownck']) assert.ok(h.includes(`id="${p}"`),f+' '+p);
    assert.match(h,/<div id="tabCk"><div id="ownck"><\/div><\/div>/,f+': the Checklist tab is only the student\'s own checklist');
    for(const gone of ['tabEm','"proc"','"follow"','"genT"','"engRead"','"mission"']) assert.ok(!h.includes(gone.startsWith('"')?'id='+gone:`id="${gone}"`),f+' still has '+gone);
    assert.match(h,/simshell\.css\?v=\d+/,f); assert.match(h,/simshell\.js\?v=\d+/,f); }
});

test('one zoom model on 2D: 3–6 large areas to tap, ← Back, no lock, no fit that crops the panel',()=>{
  for(const f of ['c172-app.js','b200-app.js','cockpit.html']){ const s=src(f), m=s.match(/const AREA=\{([^}]*)\}/); assert.ok(m,f+' AREA');
    const n=(m[1].match(/\w+:\[/g)||[]).length; assert.ok(n>=3&&n<=6,f+' areas '+n); assert.ok(!/PANELZOOM\.fit|el\('bLock'\)/.test(s),f); }
  for(const f of PAGES){ const h=src(f); assert.match(h,/id="zBack">← Back</,f); assert.ok(!h.includes('id="bLock"'),f); }
  const pz=src('panelzoom.js'); assert.ok(/api\.tap=/.test(pz)&&/function dim\(/.test(pz)&&!/function fit\(/.test(pz),'panelzoom');
});

test('zoom is basic: no double-click toggle and no magnifier glyphs',()=>{
  const pz=src('panelzoom.js'); assert.ok(!/dblclick/.test(pz),'panelzoom dblclick'); assert.ok(!/\.mag\b/.test(pz.replace(/magnifier/g,'')),'panelzoom magnifiers');
  for(const f of ['c172-app.js','b200-app.js','cockpit.html','da42-3d.html']){ const s=src(f);
    assert.ok(!/PST\.addEventListener\('dblclick'/.test(s),f+' panel dblclick'); assert.ok(!/magG/.test(s),f+' magnifiers'); }
  assert.ok(!/class="mag"/.test(src('c172panel.js')),'C172 panel magnifiers');
});

test('C172 and B200 drawer data: speeds, failure buttons and scenarios, EN and NO; no procedure step lists',()=>{
  const ctx={Math,console}; ctx.window=ctx; vm.createContext(ctx);
  vm.runInContext(src('c172procs.js'),ctx); vm.runInContext(src('b200procs.js'),ctx);
  for(const [k,app,html] of [['C172PROCS','c172-app.js','c172.html'],['B200PROCS','b200-app.js','b200.html']]){ const D=ctx[k], a=src(app), h=src(html);
    assert.ok(D.SPEEDS.length>=5&&D.SPEEDS.length<=12,k+' compact speeds'); for(const r of D.SPEEDS){ assert.ok(txt(r[0]),k+' speed label'); assert.equal(typeof r[1],'string'); }
    assert.ok(txt(D.NOTE),k+' note'); assert.equal(D.DISC,undefined,k+' no AFM disclaimer: there is no AFM text');
    for(const f of D.FAILS){ assert.ok(txt(f.t),k+' fail label'); assert.ok(h.includes(`id="${f.id}"`),k+' fail button '+f.id+' exists on the page'); }
    for(const s of D.SCENS) assert.ok(new RegExp(`\\{k:'${s}'[^\\n]*,d:tr2\\('[^']{8,80}','[^']{8,80}'\\)`).test(a),k+' scenario '+s+' with a one-line description');
    for(const s in D.START){ assert.ok(new RegExp(`\\{k:'${s}'`).test(a),k+' start '+s); assert.ok(['gnd','ex'].includes(D.START[s])); }
    assert.ok(!D.SCENS.some(s=>s in D.START),k+': a failure scenario is not also a start exercise');
    for(const bad of [/steps:\[/,/\bsop:1\b/,/\bemer:1\b/,/airSteps/,/OWNCK\.gen/,/procTouch/,/'Next step'/]) assert.ok(!bad.test(a),k+' '+bad); }
});

test('DA42: no AFM library or generic flows; the drawer shows failures, speeds and the own checklist',()=>{
  const ctx={Math,console}; ctx.window=ctx; vm.createContext(ctx);
  for(const f of ['fdm.js','da42panel.js','da42procs.js']) vm.runInContext(src(f),ctx);
  assert.deepEqual(Object.keys(ctx.DA42PROCS).sort(),['CK','FAILS','SCENS','SPEEDS']);
  for(const f of ['cockpit.html','da42-3d.html']){ const h=src(f);
    for(const bad of ['flowsHTML','emerListHTML','data-pk','data-pafm','bb-da42-big','DA42PROCS.build','airChecks','procTouch','renderMission']) assert.ok(!h.includes(bad),f+' '+bad); }
  const sh=src('simshell.js'); assert.ok(!/emerHTML|tabEm/.test(sh),'simshell: no Emergency tab');
});
