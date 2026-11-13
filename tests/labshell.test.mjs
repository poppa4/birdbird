// Node tests for the lab template (lab.js shell): every lab has a learning goal, its sections are registered and exist,
// every section step is one the step bar knows, and every lab with a viewport bar registers the shared Reset.
// Static checks on the sources (no browser). Run: node --test tests/labshell.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
const lab=rd('lab.js');
const TOP=JSON.parse(lab.match(/\/\*TOPICS\*\/(\{[\s\S]*?\})\/\*END\*\//)[1]);
/* [file, key] of every lab in PATH plus the unlisted one */
const LABS=[...lab.matchAll(/\['([a-z0-9-]+\.html)','([a-z0-9]+)','[^']+','[^']+','[a-z]*'\]/g)].map(m=>[m[1],m[2]]);
const goalSrc=lab.slice(lab.indexOf('const GOAL={')), goalKeys=new Set([...goalSrc.slice(0,goalSrc.indexOf('};')).matchAll(/^\s{3}([a-z]+):t2\(/gm)].map(m=>m[1]));
const scriptsOf=html=>[...html.matchAll(/<script src="([A-Za-z0-9.-]+\.js)(?:\?v=\d+)?"/g)].map(m=>m[1]);

test('the lab list is complete (25 listed labs and the unlisted mass and balance lab)', ()=>{
  assert.equal(new Set(LABS.map(l=>l[0])).size,26);
  for(const [f] of LABS) assert.ok(fs.existsSync(path.join(root,f)), f+' exists');
});
test('every lab has a learning goal in English and Norwegian: its own p.goal or an entry in GOAL', ()=>{
  for(const [f,k] of LABS){ const own=/class="goal"/.test(rd(f)); assert.ok(own||goalKeys.has(k), `${f}: no learning goal`); }
  for(const m of lab.matchAll(/^\s{3}[a-z]+:t2\('([^']+)','([^']+)'\),?\}?;?$/gm)){ assert.ok(m[1].length>40&&m[2].length>40,'goal text in both languages'); }
});
test('every registered section exists in its page, and every step section is registered', ()=>{
  for(const [f] of LABS){ const html=rd(f), secs=TOP[f]; assert.ok(secs&&secs.length, f+': no sections in TOP');
    for(const [id,en,no,ty] of secs){ assert.ok(new RegExp(`id="${id}"`).test(html), `${f}: #${id} is in TOP but not in the page`);
      assert.ok(en&&no, `${f}#${id}: name in both languages`); assert.ok(['sim','drill','read','quiz'].includes(ty), `${f}#${id}: type`); }
    assert.equal(secs[secs.length-1][0],'quiz', f+': the quiz is the last section');
  }
});
test('section steps are the ones the step bar knows', ()=>{
  for(const [f] of LABS){ for(const m of rd(f).matchAll(/data-step="([a-z]+)"/g)) assert.ok(['understand','explore','try','debrief','check'].includes(m[1]), `${f}: data-step="${m[1]}"`); }
});
test('every lab with a viewport bar registers the shared Reset (LAB.reset), once per model', ()=>{
  for(const [f] of LABS){ const html=rd(f); const bars=(html.match(/class="(?:vbar|ov ov-tr)"/g)||[]).length; if(!bars) continue;
    const src=html+scriptsOf(html).filter(s=>fs.existsSync(path.join(root,s))&&!/^(site|lab|three\.min|concepts|chartnote|glossary)\.js$/.test(s)).map(rd).join('\n');
    const n=(src.match(/LAB\.reset\(/g)||[]).length; assert.ok(n>=1, `${f}: no LAB.reset`);
    assert.ok(n>=(html.match(/class="vbar"/g)||[]).length||f==='tunnel.html', `${f}: ${n} Reset for ${bars} viewport bars`);
  }
});
test('every lab page loads the shell', ()=>{
  for(const [f] of LABS){ const html=rd(f); assert.ok(/<script src="lab\.js\?v=\d+"/.test(html), f+': lab.js'); }
});
