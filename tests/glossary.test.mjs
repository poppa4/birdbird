// Node tests for glossary.js (the shared glossary data): no duplicate ids or terms, every entry has English and
// Norwegian text, every pattern points at an entry and compiles, lab links point at pages that exist, and the
// lab "Practise it" links in lab.js point at pages and exercises that exist. Run: node --test tests/glossary.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url'; import {createRequire} from 'node:module';
import vm from 'node:vm';
const here=path.dirname(fileURLToPath(import.meta.url)), root=path.join(here,'..');
const require=createRequire(import.meta.url);
const {G,PAT,PAT_LAB}=require(path.join(root,'glossary.js'));
const both=o=>typeof o==='string'?{en:o,no:o}:o;

test('every entry has a term, a short and a long text in English and Norwegian', ()=>{
  for(const [id,g] of Object.entries(G)){
    assert.ok(Array.isArray(g)&&g.length>=3, id+': shape');
    for(const k of [0,1,2]){ const v=both(g[k]); assert.ok(v&&typeof v.en==='string'&&v.en.trim(), `${id}[${k}].en`); assert.ok(typeof v.no==='string'&&v.no.trim(), `${id}[${k}].no`); }
  }
});
test('no duplicate terms', ()=>{
  const seen=new Map();
  for(const [id,g] of Object.entries(G)){ const t=both(g[0]).en.toLowerCase(); assert.ok(!seen.has(t), `duplicate term "${t}": ${seen.get(t)} and ${id}`); seen.set(t,id); }
});
test('no duplicate ids in the source (an object literal would silently keep the last)', ()=>{
  const src=fs.readFileSync(path.join(root,'glossary.js'),'utf8'), body=src.slice(src.indexOf('const G={'),src.indexOf('const PAT='));
  const ids=[...body.matchAll(/^\s*([a-z0-9]+):\[/gm)].map(m=>m[1]); assert.equal(new Set(ids).size,ids.length,'duplicate id');
  assert.equal(ids.length,Object.keys(G).length);
});
test('patterns point at entries, compile, and appear once', ()=>{
  const seen=new Set();
  for(const [re,id] of PAT){ assert.ok(G[id],'pattern for missing id '+id); new RegExp(re); assert.ok(!seen.has(re),'duplicate pattern '+re); seen.add(re); }
  for(const [,id] of PAT_LAB) assert.ok(G[id]);
});
test('the IFR trainer set is still there', ()=>{
  for(const id of ['vor','ndb','adf','dme','cdi','hsi','rmi','rbi','pfd','obs','crs','hdg','qdm','qdr','flag','faf','mda','da','ils','loc','gs','gp','lnav','vnav','lpv','rnp','rnav','sid','star','tas','gsp','vs',
    'abeam','homing','tracking','bracketing','lead','rate1','teardrop','dot','fix','waypoint','flyby','inbound','outbound','missed','intercept','locator','clearance','heading']) assert.ok(G[id],id);
  assert.ok(Object.keys(G).length>=80,'at least 80 terms');
});
test('lab links point at pages that exist', ()=>{
  for(const [id,g] of Object.entries(G)) if(g[3]) assert.ok(fs.existsSync(path.join(root,g[3].split('#')[0])), id+' → '+g[3]);
});
test('lab abbreviation marks never match inside other words', ()=>{
  const re=new RegExp('(^|[^A-Za-z0-9])(?:'+PAT_LAB.map(p=>'('+p[0]+')').join('|')+')(?![A-Za-z0-9])','g');
  const hits=s=>[...s.matchAll(re)].map(m=>m.slice(2).find(x=>x!==undefined));
  assert.deepEqual(hits('Set QNH 1013 and fly the ILS to DA 210 at FL100.'),['QNH','ILS','DA','FL100']);
  assert.deepEqual(hits('VORTAC, DAILY, Information, if, Vref'),[]);
});
test('"Practise it" links in lab.js point at pages and exercises that exist', ()=>{
  const src=fs.readFileSync(path.join(root,'lab.js'),'utf8');
  const links=[...src.matchAll(/P_\('([^']+)','(ifr|da42|c172|b200)'/g)].map(m=>m[1]); assert.ok(links.length>=20,'links found: '+links.length);
  const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
  for(const f of ['navcore.js','holdcore.js','navmap.js','ifrcore.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
  const ap={}; ap.globalThis=ap; ap.window=ap; vm.createContext(ap); vm.runInContext(fs.readFileSync(path.join(root,'airproc.js'),'utf8'),ap);
  const AP=ap.AIRPROC||ap.window.AIRPROC;
  const caps={'cockpit.html':['DA42',{gps:'fms',adf:false}],'c172.html':['C172',{gps:null,adf:true}],'b200.html':['B200',{gps:'nav',adf:true}]};
  for(const u of links){ const [file,q]=u.split('?'), p=new URLSearchParams(q||''); assert.ok(fs.existsSync(path.join(root,file)),u);
    if(file==='ifr.html') assert.ok(ctx.IFRCORE.ITEM[p.get('ex')],'IFR item '+p.get('ex'));
    else if(p.get('s')==='air'){ const [ty,c]=caps[file]; assert.ok(AP.list(ty,c).some(x=>x.k===p.get('p')),u); }
    else { const s=fs.readFileSync(path.join(root,file==='cockpit.html'?'cockpit.html':file.replace('.html','-app.js')),'utf8'), k=p.get('s');
      // DA42 failure scenarios live in da42procs.js; the page maps ?s=efato to s_efato
      const d42=file==='cockpit.html'&&new RegExp(`\\{id:'(s_)?${k}',`).test(fs.readFileSync(path.join(root,'da42procs.js'),'utf8'));
      assert.ok(new RegExp(`\\{k:'${k}',`).test(s)||d42,u); }
  }
});
