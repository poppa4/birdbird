// Monte-Carlo harness for the auto-fly landing (airproc.js on fdm.js), headless and in sim time with fixed gust seeds.
//   node tests/lib/landmc.mjs [runs per type, default 240] [root dir, default the repo] [types, e.g. B200,C172]
// Each run is the ILS 36 from the page's own start with Auto-fly on and gear / flaps untouched, flown through the same frame
// loop as the pages (20 Hz auto-fly tick, 240 Hz physics with AF.sub, the page's rudder assist). The wind matrix covers calm,
// crosswinds from both sides (10 kt / 30 %, 15 kt / 50 %, 20 kt / 60 % turbulence) and head / tailwind components.
// Used by tests/landmc.test.mjs (regression) and from the command line (the table in the commit message).
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), ROOT=path.join(here,'..','..');
const NM=1852, KT=0.514444;
export const TYPES=['C172','DA42','B200'];
/* [name, crosswind kt (+ from the right), headwind kt (+ on the nose), turbulence 0..1, group] */
export const CASES=[
  ['calm',0,0,0,'calm'],
  ['10 kt R / 30 %',10,0,0.3,'x10'],['10 kt L / 30 %',-10,0,0.3,'x10'],
  ['15 kt R / 50 %',15,0,0.5,'x15'],['15 kt L / 50 %',-15,0,0.5,'x15'],
  ['head 15 / 30 %',0,15,0.3,'hw'],['tail 8 / 30 %',0,-8,0.3,'hw'],
  ['10 R + head 10 / 50 %',10,10,0.5,'hw'],['10 L + tail 5 / 30 %',-10,-5,0.3,'hw'],
  ['20 kt R / 60 %',20,0,0.6,'x20'],['20 kt L / 60 %',-20,0,0.6,'x20']];
export function rng(seed){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }

const SRC={};
function src(root,f){ const k=root+'/'+f; return SRC[k]||(SRC[k]=fs.readFileSync(path.join(root,f),'utf8')); }
function load(type,root){
  const ctx={Math,console}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
  vm.runInContext(src(root,'fdm.js'),ctx); ctx.F=ctx.FDM;
  if(type==='C172') ctx.FDM.useType('C172');
  if(type==='B200'){ const ty=src(root,'b200-app.js').match(/Object\.assign\(F\.AC,\{name:'B200'[\s\S]*?\}\}\);/); if(!ty) throw new Error('B200 type block'); vm.runInContext(ty[0],ctx); }
  vm.runInContext(src(root,'airproc.js'),ctx);
  return ctx; }

/* one approach. o:{type, xw, hw, turb, seed, root, near (NM: start established on a short final instead of the procedure start),
   student:{gear,flap} (what the student sets at 7 NM), trace:fn, key} */
export function fly(o){
  const type=o.type, root=o.root||ROOT, ctx=load(type,root), F=ctx.FDM, A=ctx.AIRPROC, S=F.create(), D=A.def(o.key||'ils',type,{}), st=D.start;
  F.WORLD.gsOut=!!D.gsOut;
  if(o.near){ const T=A.TY[type]; F.place(S,{N:-o.near*NM,E:0,alt:A.pathFt(o.near*NM),ias:o.near>6.5?T.vApp:T.vFinal+5,hdg:360,gear:o.near>6.5?0:1,flap:o.near>6.5?0:1,gam:-3}); } // established on final: configured when inside 6.5 NM, clean outside
  else F.place(S,{N:st.N,E:st.E,alt:st.alt,ias:st.ias,hdg:st.hdg,gear:0,flap:0});
  const xw=o.xw||0, hw=o.hw||0; S.env.wspd=Math.hypot(xw,hw); S.env.wdir=((Math.atan2(xw,hw)*180/Math.PI)+360)%360; S.env.turb=o.turb||0; S.rng=rng(o.seed||1);
  const said=[], real=type!=='C172', AP=real?F.mkAP():null;
  const env={type,S,F,AP,nav:()=>F.nav(S,'LOC',360),power:{get:()=>S.eng[0].thr,set:v=>S.eng.forEach(e=>e.thr=v)},say:(m,c)=>said.push(m),
    cfg:()=>({gear:type==='C172'?1:S.ctl.gear,flap:S.ctl.flap}),
    config:{gear:type==='C172'?null:()=>{ S.ctl.gear=1; },flap:n=>{ S.ctl.flap=n; }}};
  const AF=A.autofly(env); AF.setProc(o.key||'ils',{}); if(!AF.engage()) throw new Error('auto-fly did not engage');
  const shared=typeof AF.config==='function'||!!(A.TY[type]&&A.TY[type].cfgFlap!=null); // older airproc.js: the page (B200) or the student configures
  const dt=0.05, N=12, h=dt/N, R={type,seed:o.seed,said,AF,S};
  let t=0, rudI=0, td=null, maxE=0, minAglAfterGA=null, gaAgl=null, cfgAt=null, at1000=null;
  while(t<1500&&AF.on&&!S.crash){
    // the page's pilotInput(): rudder assist (C172, B200) before auto-fly's own controls; DA42 leaves the rudder alone
    if(type!=='DA42'){ let rudA=0; if(!S.ground){ const b=S.beta||0; rudI=F.clamp(rudI+b*dt*3,-0.9,0.9); rudA=F.clamp(3*b+rudI-0.5*S.r,-1,1); } else rudI=0;
      if(type==='B200'&&!S.ground) rudA+=F.clamp(-0.6*S.r,-0.2,0.2); S.ctl.rud=F.clamp(rudA,-1,1); }
    S.ctl.brake=0;
    AF.tick(dt);
    if(o.student){ if(-S.N<7*NM&&!AF.ph){ if(o.student.gear!=null) S.ctl.gear=o.student.gear; if(o.student.flap!=null) S.ctl.flap=o.student.flap; } }
    else if(!shared&&-S.N<6.5*NM&&AF.segs[AF.si]&&AF.segs[AF.si].t==='final'){ S.ctl.gear=1; if(S.ctl.flap<1) S.ctl.flap=1; }
    if(AF.rec.decision==='ga'&&gaAgl==null){ gaAgl=F.readouts(S).agl; minAglAfterGA=gaAgl; }
    for(let i=0;i<N;i++){ const r=F.readouts(S); if(AP) F.apRun(AP,S,r,env.nav(),h); AF.sub(r,h); const g0=S.ground, pre=g0?null:{vs:r.vs,roll:r.roll,pitch:r.pitch,ias:r.ias,hdg:r.hdg}; F.step(S,h);
      if(!g0&&S.ground&&!td) td=Object.assign(pre,{E:S.E,N:S.N,t});
      if(!g0&&S.crash) R.crashAt=Object.assign(pre,{E:S.E,N:S.N}); }
    t+=dt; const r=F.readouts(S);
    if(S.ground) maxE=Math.max(maxE,Math.abs(S.E));
    if(gaAgl!=null) minAglAfterGA=Math.min(minAglAfterGA,r.agl);
    if(cfgAt==null&&S.ctl.flap>=1&&S.ctl.gear>=1) cfgAt=-S.N/NM;
    if(!at1000&&AF.segs[AF.si]&&AF.segs[AF.si].t==='final'&&r.agl<1000){ const n=F.nav(S,'LOC',360); at1000={ias:r.ias,vs:r.vs,gear:S.ctl.gearPos,flap:S.ctl.flapPos,loc:n.dev,gs:n.gs?n.gs.dev:null}; }
    if(o.trace) o.trace(t,S,r,AF);
    if(gaAgl!=null&&r.agl>gaAgl+400&&r.vs>0) break; // a go-around is judged on its first 400 ft
  }
  const dec=AF.rec.decision||null, c=S.crash||null;
  Object.assign(R,{t,td,maxE,dec,crash:c,cfgAt,at1000,T:A.TY[type],stopN:S.N,stopped:S.ground&&Math.abs(S.Vg)<3,gaAgl,minAglAfterGA,mins:AF.rec.mins||null});
  R.strike=!!c&&/Wingtip|Nose-wheel|Gear-up/.test(c);
  R.off=(!!c&&/off the runway/.test(c))||(!!td&&(Math.abs(td.E)>15||td.N<0||td.N>1500))||maxE>15||(dec==='land'&&!c&&S.N>1500);
  R.crashOther=!!c&&!R.strike&&!/off the runway/.test(c);
  R.landed=dec==='land'&&!c&&!!td&&R.stopped&&!AF.on;
  R.ga=dec==='ga'&&!c&&!S.ground;                       // a clean go-around: climbing away, never touched
  R.gaSaid=dec==='ga'&&said.some(m=>/GO AROUND/.test(m));
  R.hard=!!td&&td.vs<-480; R.long=!!td&&td.N>900;
  R.bad=!!c||R.off||(!R.landed&&!R.ga)||(dec==='ga'&&!R.gaSaid);
  return R; }

const pct=(a,p)=>{ if(!a.length) return NaN; const s=a.slice().sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.floor(p*s.length))]; };
/* n seeded runs of one case; returns the counts and the touchdown statistics */
export function batch(type,cs,n,root,seed0,extra){
  const [name,xw,hw,turb,group]=cs; const out={type,name,group,n,land:0,ga:0,crash:0,strike:0,off:0,hard:0,long:0,bad:0,other:0,badSeeds:[],sink:[],tdN:[],tdE:[],maxE:[],bank:[]};
  for(let i=0;i<n;i++){ const seed=(seed0||1000)+i*7919; const r=fly(Object.assign({type,xw,hw,turb,seed,root},extra||{}));
    if(r.landed) out.land++; if(r.ga) out.ga++; if(r.crash) out.crash++; if(r.strike) out.strike++; if(r.off) out.off++; if(r.hard) out.hard++; if(r.long) out.long++;
    if(r.bad){ out.bad++; out.badSeeds.push(seed+':'+(r.crash||(r.off?'off':r.dec||'?'))); } if(!r.landed&&!r.ga&&!r.crash&&!r.off) out.other++;
    if(r.td){ out.sink.push(-r.td.vs); out.tdN.push(r.td.N); out.tdE.push(Math.abs(r.td.E)); out.bank.push(Math.abs(r.td.roll)); if(r.landed) out.maxE.push(r.maxE); } }
  out.sink50=pct(out.sink,0.5); out.sink95=pct(out.sink,0.95); out.tdN50=pct(out.tdN,0.5); out.tdN95=pct(out.tdN,0.95); out.tdE50=pct(out.tdE,0.5); out.tdE95=pct(out.tdE,0.95);
  out.maxE95=pct(out.maxE,0.95); out.maxEmax=out.maxE.length?Math.max(...out.maxE):NaN; out.bank95=pct(out.bank,0.95); out.bankMax=out.bank.length?Math.max(...out.bank):NaN; out.sinkMax=out.sink.length?Math.max(...out.sink):NaN;
  return out; }
export function row(b){ const f=(x,d)=>Number.isFinite(x)?x.toFixed(d||0):'–';
  return `${b.type.padEnd(5)} ${b.name.padEnd(22)} n=${String(b.n).padStart(3)}  land ${String(b.land).padStart(3)}  GA ${String(b.ga).padStart(3)}  crash ${String(b.crash).padStart(2)} (strike ${b.strike})  off-rwy ${String(b.off).padStart(2)}  hard ${String(b.hard).padStart(2)}  long ${String(b.long).padStart(2)}`+
    `  sink ${f(b.sink50)}/${f(b.sink95)} fpm  td ${f(b.tdN50)}/${f(b.tdN95)} m  |cl| ${f(b.tdE50,1)}/${f(b.tdE95,1)} m  roll-out max ${f(b.maxEmax,1)} m  bank ${f(b.bank95,1)}/${f(b.bankMax,1)}°  sink max ${f(b.sinkMax)}`; }

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const total=+process.argv[2]||240, root=process.argv[3]?path.resolve(process.argv[3]):ROOT, types=process.argv[4]?process.argv[4].split(','):TYPES;
  const only=process.argv[5]||null, extra=process.env.NEAR?{near:+process.env.NEAR}:null;
  /* runs per type: the cases up to 15 kt / 50 % share `total`; the 20 kt / 60 % cases get a quarter of that on top */
  const core=CASES.filter(c=>c[4]!=='x20'), n=Math.ceil(total/core.length), t0=Date.now();
  console.log(`auto-fly landing Monte-Carlo: ${root}  (${n} runs per case)`);
  for(const type of types){ const sum={n:0,land:0,ga:0,crash:0,strike:0,off:0,hard:0,long:0};
    for(const cs of CASES){ if(only&&cs[4]!==only) continue; const b=batch(type,cs,cs[4]==='x20'?Math.ceil(n/2):n,root,1000,extra); console.log(row(b)); if(b.badSeeds.length) console.log('      bad: '+b.badSeeds.slice(0,8).join('  '));
      if(cs[4]!=='x20') for(const k in sum) sum[k]+=b[k]; }
    console.log(`${type} up to 15 kt / 50 %: ${sum.n} runs, ${sum.land} landed, ${sum.ga} go-arounds, ${sum.crash} crashes (${sum.strike} strikes), ${sum.off} off the runway, ${sum.hard} hard, ${sum.long} long\n`); }
  console.log(`${((Date.now()-t0)/1000).toFixed(0)} s`);
}
