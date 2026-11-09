// Node tests for the wind-tunnel aerodynamics core (physics.js, section.js). Run: node tests/aero.test.mjs
// Expected values are closed forms, published data, or the A320 regression values recorded before the B200/DA42 work.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
for(const f of ['physics.js','section.js']) vm.runInContext(fs.readFileSync(path.join(here,'..',f),'utf8'),ctx);
const P=ctx.VLab, V=ctx.VSection, DEG=Math.PI/180, KT=0.514444, G0=9.80665;
let pass=0, fail=0; const fails=[];
const near=(a,b,t)=>a===b||Math.abs(a-b)<=(t??1e-6);
function eq(name,got,exp,tol){ const ok= typeof exp==='number'? near(got,exp,tol) : got===exp; if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
const rel=(name,got,exp,r)=>eq(name,got,exp,Math.abs(exp)*r);

/* 1. NACA 230 mean line (five-digit): max camber 1.84 % at x = 0.15 (Abbott & von Doenhoff), slope continuous at r = 0.2025 */
for(const k of ['n23012','n23018']){ const c=P.camberMax(P.AIRFOILS[k]); eq(k+' max camber',c.m,0.0184,0.0003); eq(k+' max camber x',c.p,0.15,0.003); }
{ const af=P.AIRFOILS.n23012, r=0.2025, a=P.camber(af,r-1e-7), b=P.camber(af,r+1e-7); eq('230 mean line continuous',a[0],b[0],1e-6); eq('230 slope continuous',a[1],b[1],1e-4); eq('230 TE',P.camber(af,1)[0],0,1e-12); }
/* section.js uses the same mean line */
{ const q=V.naca(P.AIRFOILS.n23012,0.15); eq('section.js 230 camber',q.yc,P.camber(P.AIRFOILS.n23012,0.15)[0],1e-12); }
/* thin-aerofoil theory: 230 mean line has design cl ≈ 0.3 at its ideal α; panel method with 23012 gives cl(α=0) ≈ 0.1–0.15 */
{ const g=V.build(P.AIRFOILS.n23012,0), c0=V.inviscid(g,0).CL; eq('23012 cl at α=0 (panel)',c0>0.08&&c0<0.2,true); }

/* 2. Planforms vs published areas: B200 28.2 m² (flugzeuginfo), DA42 16.29 m² (EASA TCDS A.005), A320 unchanged */
const area={a320:122.59352,b200:28.2,da42:16.29};
for(const ac of ['a320','b200','da42']){ const w=P.buildWing(P.wingParamsFor(ac,0)); rel(ac+' wing area',w.Sreal,area[ac],ac==='a320'?1e-6:0.02);
  rel(ac+' aspect ratio b²/S',w.AR,P.AIRCRAFT[ac].b**2/w.Sreal,1e-9);
  // 3D lift-curve slope vs Helmholtz/DATCOM: a = 2πA/(2+√(4+A²(1+tan²Λ½)))
  const A=w.AR, Lh=Math.atan(Math.tan(P.AIRCRAFT[ac].sweep*DEG)-(1-P.AIRCRAFT[ac].ct/P.AIRCRAFT[ac].cr)/A*2*0.5), a=2*Math.PI*A/(2+Math.sqrt(4+A*A*(1+Math.tan(Lh)**2)));
  rel(ac+' CLα vs DATCOM',w.CLa,a,0.12);
  // span efficiency from the Trefftz plane at moderate CL: 0.75 < e < 1.03
  const r=P.evaluate(w,6,0), e=r.CL*r.CL/(Math.PI*A*r.CDi); eq(ac+' Oswald e plausible',e>0.75&&e<1.03,true); }

/* 3. A320 regression: raw wing geometry per CONF (CONF FULL = slats 27°, flaps 40°); the calibrated VS1g is checked below */
const A320REF=[[15.68524464930516,1.412766822352397],[20.515582133598837,1.8165830669233518],[19.002332727300324,1.9658740345549268],[19.150672914672846,2.1279056651159007],[18.125519002852368,2.2014550144345915],[17.752464865501548,2.444062481863802]];
P.CONFS.forEach((c,i)=>{ const A=P.AIRCRAFT.a320, w=P.buildWing({b:A.b,cr:A.cr,ck:A.ck,yk:A.yk,ct:A.ct,sweep:A.sweep,dih:A.dih,twist:A.twist,af:A.af,flapDeg:c.f,slatDeg:c.s,flapSpan:A.flapSpan,fowler:A.fowler});
  eq('A320 CONF '+c.id+' α stall',w.alphaStall/DEG,A320REF[i][0],1e-9); eq('A320 CONF '+c.id+' CL max',w.CLmax,A320REF[i][1],1e-9); });
{ const A=P.AIRCRAFT.a320, w=P.buildWing(P.wingParamsFor('a320',5)); eq('A320 CONF FULL VS1g @64 t ≈ 109 kt (typical)',Math.sqrt(2*64000*G0/(1.225*w.Sreal*w.CLmax))/KT,109,0.3);
  const w3=P.buildWing(P.wingParamsFor('a320',4)); eq('A320 CONF 3 VS1g @64 t ≈ 115 kt (typical)',Math.sqrt(2*64000*G0/(1.225*w3.Sreal*w3.CLmax))/KT,115,0.3); void A; }

/* 4. Twins: stall speeds within 6 % of book values (B200: green arc 99 KIAS, white arc 75 KIAS at 12 500 lb); root stalls first, flaps up */
{ const vs=(ac,i,m)=>{ const w=P.buildWing(P.wingParamsFor(ac,i)); return Math.sqrt(2*m*G0/(1.225*w.Sreal*w.CLmax))/KT; };
  rel('B200 VS1 vs POH 99 kt',vs('b200',0,5670),99,0.06); rel('B200 VS0 vs POH 75 kt',vs('b200',2,5670),75,0.06);
  for(const ac of ['b200','da42']){ const w=P.buildWing(P.wingParamsFor(ac,0)); eq(ac+' stall starts inboard (flaps up)',Math.abs(w.stallStation)<0.35,true);
    const c=P.confsFor(ac); eq(ac+' CL max rises with flap',P.buildWing(P.wingParamsFor(ac,c.length-1)).CLmax>w.CLmax,true);
    // flap lowers the critical α (B200: the stall strips already lower the clean value, so it may only stay level)
    eq(ac+' critical α does not rise with flap',P.buildWing(P.wingParamsFor(ac,c.length-1)).alphaStall<w.alphaStall+0.5*DEG,true); }
  eq('DA42 flaps per TCDS',P.confsFor('da42').map(c=>c.f).join('/'),'0/20/42'); }
/* B200 thickness blends 18 % → 12 % root to tip */
{ const w=P.buildWing(P.wingParamsFor('b200',0)); eq('B200 t/c root',w.tAt(0),0.18,1e-12); eq('B200 t/c tip',w.tAt(w.s),0.12,1e-12); eq('B200 t/c mid',w.tAt(w.s/2),0.15,1e-12); }

/* 5. Actuator disc (Rankine–Froude): momentum, far wake 2vi, continuity, ideal power */
{ const T=4000, rho=1.0, Vv=70, R=1.2, d=P.actuatorDisc(T,rho,Vv,R);
  rel('disc: T = 2ρA vi (V+vi)',2*rho*d.A*d.vi*(Vv+d.vi),T,1e-12); eq('disc: far wake = V + 2vi',d.farWake,Vv+2*d.vi,1e-12);
  rel('disc: continuity A(V+vi) = Aw(V+2vi)',d.A*(Vv+d.vi),Math.PI*d.Rw*d.Rw*(Vv+2*d.vi),1e-12);
  eq('axial: vi at the disc',P.slipAxial(0,R,d.a),d.a,1e-12); eq('axial: 2vi far behind',P.slipAxial(1e6,R,d.a),2*d.a,1e-6); eq('axial: 0 far ahead',P.slipAxial(-1e6,R,d.a),0,1e-6);
  rel('radius far behind = Rw',P.slipRadius(1e6,R,d.a),d.Rw*R/R,1e-5);
  eq('zero thrust → no slipstream',P.actuatorDisc(0,1,50,1).vi,0,1e-12);
  // static thrust limit: T0 = (FM·P)^(2/3)·(2ρA)^(1/3) at V → 0, η·P/V at speed
  const Pw=634e3, A=Math.PI*1.195**2; rel('static thrust',P.propThrust(Pw,0.5,1.225,1.195,0.8,0.7),Math.pow(0.7*Pw,2/3)*Math.pow(2*1.225*A,1/3),1e-9);
  rel('thrust at speed',P.propThrust(Pw,100,1.225,1.195,0.8,0.7),0.8*Pw/100,1e-12); }

/* 6. Lamb–Oseen iso-surface: ω(r_iso) = ω_iso; none above the peak; Q-criterion boundary 1.1209·rc */
{ const G=2, rc=0.1, w0=G/(Math.PI*rc*rc), wi=0.2*w0, r=P.lambOseenIso(G,rc,wi); eq('iso radius',w0*Math.exp(-r*r/(rc*rc)),wi,1e-9*w0); eq('iso above peak',P.lambOseenIso(G,rc,2*w0),0);
  // Q = ½(Ω² − S²) for v_θ = Γ/(2πr)(1 − e^{−η}), η = r²/rc²: Q ∝ (ω/2)² − (r d(vθ/r)/dr /2)²·... zero crossing at η ≈ 1.2564
  // ω = (1/r)d(r·vθ)/dr = 2e^{−η}, strain s = r·d(vθ/r)/dr = 2e^{−η} − 2(1 − e^{−η})/η (units Γ/(πrc²)); Q > 0 where |ω| > |s|
  const Q=x=>{ const e=Math.exp(-x*x), om=2*e, s=2*e-2*(1-e)/(x*x); return om*om-s*s; };
  let lo=0.5, hi=2; for(let i=0;i<60;i++){ const m=(lo+hi)/2; if(Q(m)>0) lo=m; else hi=m; } eq('Q = 0 at r ≈ 1.1209 rc',lo,P.LAMB_Q0,2e-3); }

/* 7. ISA: sea level and the tropopause (unchanged) */
{ const a=P.atmosphere(0,0); eq('ISA ρ0',a.rho,1.225,1e-3); eq('ISA a0',a.a,340.29,0.05); }

console.log(`${pass} passed, ${fail} failed`); if(fail){ console.log(fails.join('\n')); process.exit(1); }
