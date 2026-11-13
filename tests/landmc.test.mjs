// Auto-fly lands (run: node --test tests/landmc.test.mjs). Headless and in sim time, through tests/lib/landmc.mjs: fdm.js and
// airproc.js flown in the pages' own frame loop, fixed gust seeds.
//  - gear and flaps untouched: auto-fly sets them itself 6.5 NM out on all three types, says so, and lands; what the student set stays
//  - the landing in wind and turbulence: a small Monte-Carlo here; LANDMC_RUNS=240 node --test tests/landmc.test.mjs flies that many
//    per type from the procedure start (several minutes); node tests/lib/landmc.mjs prints the whole table
//  - above a type's demonstrated crosswind auto-fly says so and goes around
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {fly,batch,row,CASES,TYPES} from './lib/landmc.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)), src=f=>fs.readFileSync(path.join(here,'..',f),'utf8');
const RUNS=+process.env.LANDMC_RUNS||0;

function landed(r,name,lim){
  assert.equal(r.crash,null,name+': no crash');
  assert.equal(r.dec,'land',name+': lands at minimums, no go-around ('+r.said.slice(-2).join(' | ')+')');
  assert.ok(r.td,name+': touchdown');
  assert.ok(r.td.N>150&&r.td.N<900,`${name}: touchdown in the touchdown zone (${r.td.N.toFixed(0)} m past the threshold)`);
  assert.ok(Math.abs(r.td.E)<lim.E,`${name}: touchdown within ${lim.E} m of the centreline (${r.td.E.toFixed(1)} m)`);
  assert.ok(r.td.vs>-lim.vs,`${name}: sink rate at touchdown under ${lim.vs} ft/min (${r.td.vs.toFixed(0)})`);
  assert.ok(Math.abs(r.td.roll)<8,`${name}: bank at touchdown (${r.td.roll.toFixed(1)}°)`);
  assert.ok(r.td.pitch>0,`${name}: main wheels first (pitch ${r.td.pitch.toFixed(1)}°)`);
  assert.ok(r.maxE<lim.roll,`${name}: roll-out within ${lim.roll} m of the centreline (${r.maxE.toFixed(1)} m)`);
  assert.ok(r.stopN<1500&&r.stopped,`${name}: stops on the runway (${r.stopN.toFixed(0)} m)`);
  assert.equal(r.AF.on,false,name+': auto-fly hands back after the roll-out');
  assert.ok(r.said.some(m=>/^Landed/.test(m)),name+': says it has landed');
}

for(const type of TYPES){
  const msg=type==='C172'?'Auto-fly: flaps approach.':'Auto-fly: gear down, flaps approach.';
  test(`${type} auto-fly ILS, calm, gear and flaps untouched: auto-fly configures, is stabilised at 1000 ft, lands and stops`,()=>{
    const r=fly({type}), T=r.T;
    assert.ok(r.cfgAt>5&&r.cfgAt<=6.6,`set by auto-fly before the final approach fix (${r.cfgAt&&r.cfgAt.toFixed(1)} NM)`);
    assert.equal(r.said.filter(m=>/^Auto-fly: /.test(m)).join(),msg,'says what it did, once, in the same words on every type');
    const s=r.at1000; assert.ok(s,'passes 1000 ft on final');
    assert.ok(s.gear>0.99&&s.flap>=0.99,'1000 ft: configured');
    assert.ok(Math.abs(s.ias-T.vFinal)<=10,`1000 ft: on speed (${s.ias.toFixed(0)} KIAS, target ${T.vFinal})`);
    assert.ok(s.vs<-250&&s.vs>-1000,`1000 ft: sink rate ${s.vs.toFixed(0)} ft/min`);
    assert.ok(Math.abs(s.loc)<0.25&&s.gs!=null&&Math.abs(s.gs)<0.5,'1000 ft: on the localizer and the glide slope');
    const m=r.mins; assert.ok(Math.abs(m.locDots)<0.3&&Math.abs(m.gsDots)<0.5&&Math.abs(m.ias-T.vFinal)<8,'on the ILS and on speed at DA');
    landed(r,'calm',{E:2,vs:250,roll:3});
  });
  test(`${type} auto-fly ILS: gear and flaps the student already set are left alone (no message); a missing one is set`,()=>{
    const r=fly({type,student:{gear:1,flap:2}});
    assert.equal(r.said.filter(m=>/^Auto-fly: /.test(m)).length,0,'nothing to say');
    assert.equal(r.S.ctl.flap,2,'the student\'s flap setting stays');
    landed(r,'student-configured',{E:2,vs:300,roll:3});
    if(type!=='C172'){ const g=fly({type,student:{gear:1},near:6.9}); assert.equal(g.said.filter(m=>/^Auto-fly: /.test(m)).join(),'Auto-fly: flaps approach.'); assert.equal(g.S.ctl.flap,1); }
  });
  test(`${type} auto-fly ILS from the procedure start, 15 kt crosswind and 50 % turbulence: lands on the runway`,()=>{
    landed(fly({type,xw:15,turb:0.5,seed:7}),'15 kt from the right',{E:8,vs:550,roll:10});
  });
  test(`${type} auto-fly landing Monte-Carlo up to 15 kt / 50 % (${RUNS?RUNS+' runs from the procedure start':'short final, fixed seeds'}): no crash, strike or runway excursion`,()=>{
    const cs=CASES.filter(c=>c[4]!=='x20'&&(RUNS||c[4]!=='calm')), n=RUNS?Math.ceil(RUNS/cs.length):1, extra=RUNS?null:{near:3};
    const sum={n:0,land:0,ga:0,crash:0,strike:0,off:0,bad:0,hard:0}, sink=[], cl=[], out=[];
    for(const c of cs){ const b=batch(type,c,RUNS?n:(c[4]==='x15'?2:1),undefined,1000,extra); out.push(row(b)+(b.badSeeds.length?'  bad: '+b.badSeeds.join(' '):''));
      for(const k in sum) sum[k]+=b[k]; sink.push(...b.sink); cl.push(...b.tdE);
      assert.ok(!(b.tdN95>1000),`${c[0]}: touchdown in the first 1000 m (95 %: ${b.tdN95})`); }
    const info='\n'+out.join('\n');
    assert.equal(sum.crash,0,'crashes'+info); assert.equal(sum.strike,0,'wingtip, propeller or nose-wheel strikes'+info); assert.equal(sum.off,0,'off the runway'+info);
    assert.equal(sum.bad,0,'every run ends in a landing or a clean, announced go-around'+info);
    assert.ok(sum.land>=0.9*sum.n,`at least 9 in 10 land (${sum.land} of ${sum.n})`+info);
    const med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1];
    assert.ok(med(sink)<360,`typical sink rate at touchdown under 360 ft/min (${med(sink).toFixed(0)})`); assert.ok(med(cl)<5,`typically within 5 m of the centreline (${med(cl).toFixed(1)} m)`);
    if(RUNS) console.log(info);
  });
  test(`${type} auto-fly at 20 kt crosswind / 60 % turbulence: lands on the runway or goes around cleanly and says so`,()=>{
    for(const c of CASES.filter(c=>c[4]==='x20')){ const n=RUNS?Math.ceil(RUNS/16):1;
      for(let i=0;i<n;i++){ const r=fly({type,xw:c[1],hw:c[2],turb:c[3],seed:500+i*977,near:RUNS?0:3}), name=`${c[0]} seed ${r.seed}`;
        assert.equal(r.crash,null,name+': no crash'); assert.ok(!r.off,name+': stays on the runway'); assert.ok(r.landed||(r.ga&&r.gaSaid),name+': a landing or a clean, announced go-around');
        if(type==='C172'){ assert.ok(r.ga,name+': above the demonstrated crosswind, so a go-around');
          assert.ok(r.said.some(m=>/crosswind 20 kt is above the demonstrated 15 kt: GO AROUND/.test(m)),name+': says why'); } } }
  });
}

test('every sim page gives auto-fly its gear and flap controls, and pages that share a file load the same version',()=>{
  const pages={'c172.html':'c172-app.js','c172-3d.html':'c172-app.js','cockpit.html':'cockpit.html','da42-3d.html':'da42-3d.html','b200.html':'b200-app.js','b200-3d.html':'b200-app.js'};
  for(const [pg,app] of Object.entries(pages)){ const t=src(app), i=t.indexOf('AIRPROC.autofly({'), m=[i<0?'':t.slice(i,t.indexOf('function airUI',i))]; assert.ok(/config:\{/.test(m[0]),pg+': config passed to AIRPROC.autofly'); assert.ok(/flap:n=>setFlap\(n\)/.test(m[0]),pg+': the page\'s own flap control'); }
  assert.ok(!/afConfig/.test(src('b200-app.js')),'the B200 uses the shared logic');
  for(const f of ['airproc.js','fdm.js','b200-app.js','c172-app.js','b200panel.js']){
    const vs=Object.keys(pages).map(pg=>(src(pg).match(new RegExp(f.replace('.','\\.')+'\\?v=(\\d+)'))||[])[1]).filter(Boolean);
    assert.ok(vs.length>0&&vs.every(v=>v===vs[0]),f+' versions: '+vs.join(',')); }
});
