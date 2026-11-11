// Node tests for airproc.js (run: node tests/airproc.test.mjs): procedure geometry, and the auto-fly controller flying
// the shared flight model (fdm.js) hands-off — ILS to minimums and a landing, a go-around into the HOLAN hold, the RONAX hold.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
let pass=0, fail=0; const fails=[];
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } }
function load(){ const ctx={}; ctx.window=ctx; ctx.globalThis=ctx; ctx.Math=Math; vm.createContext(ctx);
  for(const f of ['fdm.js','airproc.js']) vm.runInContext(fs.readFileSync(path.join(here,'..',f),'utf8'),ctx);
  return ctx; }
const NM=1852;

/* ---------- geometry ---------- */
{ const {AIRPROC:A}=load();
  for(const t of ['C172','DA42','B200']){
    const D=A.def('ils',t,{}); const d=Math.hypot(D.start.N,D.start.E)/NM;
    ok(t+': ILS start 10–12.5 NM out ('+d.toFixed(1)+')',d>=10&&d<=12.5);
    ok(t+': 30° intercept to the 360 localizer',Math.abs(D.start.hdg-30)<1&&D.start.E<0);
    ok(t+': start altitude',D.start.alt===(t==='C172'?2500:3000));
  }
  ok('C172 has no RNP',!A.list('C172',{gps:null,adf:true}).some(x=>/^rnp/.test(x.k)));
  ok('DA42 has LPV, LNAV/VNAV and LNAV',['rnp_lpv','rnp_lv','rnp_ln'].every(k=>A.list('DA42',{gps:'fms'}).some(x=>x.k===k)));
  ok('B200 navigator: LNAV only',A.list('B200',{gps:'nav',adf:true}).filter(x=>/^rnp/.test(x.k)).map(x=>x.k).join()==='rnp_ln');
  ok('every type: SID, STAR, hold and free flight',['C172','DA42','B200'].every(t=>['sid','star','hold','free'].every(k=>A.list(t,{}).some(x=>x.k===k))));
  ok('minimums follow the chart (ILS DA 210, LOC MDA 460, LPV DA 250, LNAV MDA 470)',A.MINS.ils===210&&A.MINS.loc===460&&A.MINS.rnp_lpv===250&&A.MINS.rnp_ln===470);
  ok('3° path: FAPSO (D5) about 1640 ft',Math.abs(A.pathFt(5*NM)-1640)<15);
  ok('LOC procedure flags the glide slope out',A.def('loc','DA42',{}).gsOut===true&&!A.def('ils','DA42',{}).gsOut);
}

/* ---------- every start: autopilot off, hand-flown, trimmed (no input for 10 s stays within ±200 ft and ±10° of bank) ---------- */
{ const {AIRPROC:A}=load();
  for(const t of ['C172','DA42','B200']){ const b=A.brief('ils',t);
    ok(t+': brief is text, not an object ('+String(b.en).slice(0,20)+')',typeof b.en==='string'&&!/object Object/.test(b.en)&&typeof b.no==='string');
    ok(t+': brief says hand-flying, autopilot off (EN/NO)',t==='C172'?/hand-flying/.test(b.en)&&/for hånd/.test(b.no):/Autopilot off/.test(b.en)&&/Autopiloten er av/.test(b.no));
    ok(t+': no brief promises an engaged autopilot',A.list(t,{gps:t==='DA42'?'fms':'nav',adf:true}).every(x=>{ const e=A.brief(x.k,t).en; return !/autopilot (in|GPS) /i.test(e); })); }
  for(const t of ['C172','DA42','B200']) for(const x of A.list(t,{gps:t==='DA42'?'fms':t==='B200'?'nav':null,adf:t!=='DA42'})){
    const ctx=load(), F=ctx.FDM; if(t==='C172') F.useType('C172'); const S=F.create(), D=ctx.AIRPROC.def(x.k,t,{}), st=D.start; F.WORLD.gsOut=!!D.gsOut;
    const to=D.cfg==='to'; F.place(S,{N:st.N,E:st.E,alt:st.alt,ias:st.ias,hdg:st.hdg,gear:to?1:0,flap:D.cfg==='app'&&t!=='C172'?1:to&&t==='B200'?1:0,gam:st.gam||0,thr:to?(t==='C172'?1:t==='B200'?0.85:0.92):undefined});
    const a0=F.readouts(S).alt; let dA=0, bk=0; for(let i=0;i<10*240;i++){ F.step(S,1/240); if(i%24===0){ const o=F.readouts(S); dA=Math.max(dA,Math.abs(o.alt-a0)); bk=Math.max(bk,Math.abs(o.roll)); } }
    ok(`${t} ${x.k}: hands-off 10 s within ±200 ft / ±10° (${dA.toFixed(0)} ft, ${bk.toFixed(1)}°)`,(to||x.k==='sid'?true:dA<200)&&bk<10&&!S.crash);
    if(to||x.k==='sid') ok(`${t} ${x.k}: hands-off after take-off keeps climbing without a stall`,F.readouts(S).alt>a0&&F.readouts(S).ias>40); }
}

/* ---------- closed loop: the instructor (hidden autopilot) flies the shared model ---------- */
function run(type,key,opt){ opt=opt||{};
  const ctx=load(), F=ctx.FDM, A=ctx.AIRPROC; if(type==='C172') F.useType('C172');
  const S=F.create(), D=A.def(key,type,{}); const st=D.start; F.WORLD.gsOut=!!D.gsOut;
  F.place(S,{N:st.N,E:st.E,alt:st.alt,ias:st.ias,hdg:st.hdg,gear:D.cfg==='to'?1:0,flap:0,gam:st.gam||0,thr:D.cfg==='to'?0.9:undefined});
  const AF=A.autofly({type,S,F,AP:null,power:{get:()=>S.eng[0].thr,set:v=>S.eng.forEach(e=>e.thr=v)},say:()=>{},cfg:()=>({gear:S.ctl.gear,flap:S.ctl.flap})});
  AF.setProc(key,{}); if(opt.ga) AF.wantLand=false; ok(type+' '+key+': engages in the air',AF.engage());
  const dt=0.05, N=12, h=dt/N; let t=0, maxXt=0;
  while(t<(opt.T||1500)&&AF.on&&!S.crash){
    if(!opt.noCfg){ if(S.N>-7*NM&&S.N<0&&D.mins){ S.ctl.gear=1; S.ctl.flap=1; } }
    AF.tick(dt); for(let i=0;i<N;i++){ const o=F.readouts(S); AF.sub(o,h); F.step(S,h); } t+=dt;
    if(opt.stop&&opt.stop(AF,S)) break;
  }
  return {AF,S,F,t}; }
{ const r=run('C172','ils'); const m=r.AF.rec.mins;
  ok('C172 ILS: reaches DA',!!m); ok('C172 ILS: on the localizer at DA (<0.3 dot)',m&&Math.abs(m.locDots)<0.3); ok('C172 ILS: on the glide slope at DA (<0.5 dot)',m&&Math.abs(m.gsDots)<0.5);
  ok('C172 ILS: lands without a crash ('+r.S.crash+')',!r.S.crash&&!!r.AF.rec.landed); }
{ const r=run('DA42','loc'); const m=r.AF.rec.mins;
  ok('DA42 LOC: reaches MDA on the 3° path (±80 ft)',m&&Math.abs(m.vdev)<80&&Math.abs(m.locDots)<0.3); }
{ const r=run('B200','ils',{noCfg:true,stop:(AF)=>AF.rec.hold&&AF.rec.hold.n>=1,T:2500});
  ok('B200 ILS without landing configuration: goes around',r.AF.rec.decision==='ga');
  ok('B200 missed approach: one circuit of the HOLAN hold at 3000 ft (±200)',r.AF.rec.hold&&r.AF.rec.hold.maxDev<200); }
{ const r=run('C172','hold',{stop:(AF)=>AF.rec.hold&&AF.rec.hold.n>=1});
  ok('C172 RONAX hold: one circuit within 200 ft',r.AF.rec.hold&&r.AF.rec.hold.n>=1&&r.AF.rec.hold.maxDev<200); }
{ const r=run('DA42','sid',{stop:(AF)=>AF.rec.sidDone,T:2500});
  ok('DA42 SID: reaches OSVIK at 3000 ft (±150)',r.AF.rec.sidDone&&Math.abs(r.S.h/0.3048-3000)<150); }

console.log(`airproc: ${pass} passed, ${fail} failed`); if(fail){ console.log(fails.join('\n')); process.exit(1); }
