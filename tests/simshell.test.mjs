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
  const menu=['moreMenu','bReset','bAhead','bOtw','bLock','zoomSel','bSound','bTouch','bFull','bDbNow','bDbAuto','bKeys','bPerf'];
  for(const f of PAGES){ const h=src(f); assert.deepEqual(ids(h,'<div class="more"','</div>'),menu,f);
    const tabs=[...h.matchAll(/<button data-t="(\w+)"/g)].map(m=>m[1]); assert.deepEqual(tabs,['ck','em','fl','sp'],f);
    for(const p of ['tabCk','tabEm','tabFl','tabSp','ownck','proc','follow']) assert.ok(h.includes(`id="${p}"`),f+' '+p);
    assert.match(h,/simshell\.css\?v=\d+/,f); assert.match(h,/simshell\.js\?v=\d+/,f); }
});

test('zoom is basic: no double-click toggle and no magnifier glyphs',()=>{
  const pz=src('panelzoom.js'); assert.ok(!/dblclick/.test(pz),'panelzoom dblclick'); assert.ok(!/\.mag\b/.test(pz.replace(/magnifier/g,'')),'panelzoom magnifiers');
  for(const f of ['c172-app.js','b200-app.js','cockpit.html','da42-3d.html']){ const s=src(f);
    assert.ok(!/PST\.addEventListener\('dblclick'/.test(s),f+' panel dblclick'); assert.ok(!/magG/.test(s),f+' magnifiers'); }
  assert.ok(!/class="mag"/.test(src('c172panel.js')),'C172 panel magnifiers');
});

test('C172 and B200 drawer data: speeds, failure buttons and scenarios, EN and NO',()=>{
  const ctx={Math,console}; ctx.window=ctx; vm.createContext(ctx);
  vm.runInContext(src('c172procs.js'),ctx); vm.runInContext(src('b200procs.js'),ctx);
  for(const [k,app,html] of [['C172PROCS','c172-app.js','c172.html'],['B200PROCS','b200-app.js','b200.html']]){ const D=ctx[k], a=src(app), h=src(html);
    assert.ok(D.SPEEDS.length>10,k+' speeds'); for(const r of D.SPEEDS){ assert.ok(txt(r[0]),k+' speed label'); assert.equal(typeof r[1],'string'); }
    assert.ok(txt(D.NOTE)&&txt(D.DISC),k+' notes');
    for(const f of D.FAILS){ assert.ok(txt(f.t),k+' fail label'); assert.ok(h.includes(`id="${f.id}"`),k+' fail button '+f.id+' exists on the page'); }
    for(const s of D.SCENS) assert.ok(new RegExp(`\\{k:'${s}'`).test(a),k+' scenario '+s);
    for(const s in D.START){ assert.ok(new RegExp(`\\{k:'${s}'`).test(a),k+' start '+s); assert.ok(['gnd','ex'].includes(D.START[s])); }
    assert.ok(!D.SCENS.some(s=>s in D.START),k+': a failure scenario is not also a start exercise'); }
});

test('DA42 drawer renderers: generic flows (off by default) and the AFM emergency list',()=>{
  const ctx={Math,console}; ctx.window=ctx; vm.createContext(ctx);
  for(const f of ['fdm.js','da42panel.js','da42procs.js']) vm.runInContext(src(f),ctx);
  const D=ctx.DA42PROCS, L=x=>typeof x==='string'?x:x.en;
  assert.ok(!/data-pk/.test(D.flowsHTML({gen:false},L)),'no flows listed with the generic flows off');
  assert.equal((D.flowsHTML({gen:true},L).match(/data-pk=/g)||[]).length,D.FLOWS.length);
  const em=D.emerListHTML({q:''},L); assert.equal((em.match(/data-pk=/g)||[]).length,D.EMER.length);
  assert.ok((D.emerListHTML({q:'fire'},L).match(/data-pk=/g)||[]).length>0,'search');
});
