/* Birdbird – gnsscore.js: the pure maths behind the GNSS and RNAV lab (gnss.html).
   No DOM, no state. Loaded in the page as window.GNSSCORE and in Node (tests/gnsscore.test.mjs) through vm.
   Satellites are {az, el} in degrees (azimuth from true north, clockwise; elevation above the horizon).
   Plan geometry uses the same frame as navcore.js: x east, y north, NM, bearings in degrees true.
   Sources: least-squares DOP and slope-based RAIM (Brown; RTCA DO-208 / TSO-C129: 5 satellites to detect, 6 to exclude,
   HAL 2 / 1 / 0.3 NM), SBAS protection levels (ICAO Annex 10 / DO-229: HPL = K_H·d_major, VPL = K_V·d_U),
   fly-by turn anticipation Y = r·tan(ΔA/2) and the fly-over 30° rejoin (PANS-OPS Doc 8168), PBN containment (Doc 9613). */
(function(root){
'use strict';
const D2R=Math.PI/180, R2D=180/Math.PI, NM=1852, G0=9.80665;
const norm=a=>{ a%=360; if(a<0) a+=360; return a===360||Object.is(a,-0)?0:a; };
const diff=(a,b)=>{ let d=norm(a-b); if(d>180) d-=360; return d; };
const bearing=(dx,dy)=>norm(Math.atan2(dx,dy)*R2D);

/* ---------- linear algebra (small dense matrices as arrays of rows) ---------- */
function inv(m){ const n=m.length, a=m.map((r,i)=>r.concat(Array.from({length:n},(_,j)=>i===j?1:0)));
  for(let c=0;c<n;c++){ let p=c; for(let r=c+1;r<n;r++) if(Math.abs(a[r][c])>Math.abs(a[p][c])) p=r;
    if(Math.abs(a[p][c])<1e-10) return null; if(p!==c){ const t=a[c]; a[c]=a[p]; a[p]=t; }
    const d=a[c][c]; for(let k=0;k<2*n;k++) a[c][k]/=d;
    for(let r=0;r<n;r++){ if(r===c) continue; const f=a[r][c]; if(f) for(let k=0;k<2*n;k++) a[r][k]-=f*a[c][k]; } }
  return a.map(r=>r.slice(n)); }
const tr=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const mul=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((t,v,k)=>t+v*B[k][j],0)));

/* ---------- satellite geometry ---------- */
/* unit line of sight from the receiver to a satellite, east/north/up */
function los(s){ const a=s.az*D2R, e=s.el*D2R; return [Math.cos(e)*Math.sin(a),Math.cos(e)*Math.cos(a),Math.sin(e)]; }
/* geometry matrix: one row per satellite, [−e, −n, −u, 1] (position unknowns, then the receiver clock) */
const geom=S=>S.map(s=>{ const u=los(s); return [-u[0],-u[1],-u[2],1]; });
/* visible = at or above the mask angle */
const visible=(S,mask)=>S.filter(s=>s.el>=(mask||0));
/* DOP from (GᵀG)⁻¹. null without a 3D fix (fewer than 4 satellites or a degenerate geometry). */
function dop(S){ if(S.length<4) return null; const G=geom(S), Q=inv(mul(tr(G),G)); if(!Q) return null;
  const e=Q[0][0], n=Q[1][1], u=Q[2][2], t=Q[3][3]; if(e<0||n<0||u<0||t<0) return null;
  /* semi-major axis of the horizontal error ellipse (per unit range error) */
  const a=(e+n)/2, b=Math.sqrt(((e-n)/2)**2+Q[0][1]**2);
  return {n:S.length,g:Math.sqrt(e+n+u+t),p:Math.sqrt(e+n+u),h:Math.sqrt(e+n),v:Math.sqrt(u),t:Math.sqrt(t),major:Math.sqrt(a+b),Q}; }
/* 95 % errors from DOP and a range error σ (m): horizontal 2·HDOP·σ (2 drms), vertical 1.96·VDOP·σ */
const err95=(d,sigma)=>d?{h:2*d.h*sigma,v:1.96*d.v*sigma}:null;

/* ---------- chi-square (for the RAIM thresholds) ---------- */
function lgamma(x){ const c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
  let y=x, t=x+5.5; t-=(x+0.5)*Math.log(t); let s=1.000000000190015; for(let j=0;j<6;j++) s+=c[j]/++y; return -t+Math.log(2.5066282746310005*s/x); }
/* regularised lower incomplete gamma P(a, x) */
function gammaP(a,x){ if(x<=0) return 0; const gl=lgamma(a);
  if(x<a+1){ let ap=a, s=1/a, d=s; for(let n=0;n<500;n++){ ap++; d*=x/ap; s+=d; if(Math.abs(d)<Math.abs(s)*1e-15) break; } return s*Math.exp(-x+a*Math.log(x)-gl); }
  let b=x+1-a, c=1/1e-300, d=1/b, h=d; for(let i=1;i<500;i++){ const an=-i*(i-a); b+=2; d=an*d+b; if(Math.abs(d)<1e-300) d=1e-300; c=b+an/c; if(Math.abs(c)<1e-300) c=1e-300; d=1/d; const del=d*c; h*=del; if(Math.abs(del-1)<1e-15) break; }
  return 1-Math.exp(-x+a*Math.log(x)-gl)*h; }
const chi2cdf=(x,k)=>gammaP(k/2,x/2);
/* non-central chi-square CDF, Poisson mixture of central ones */
function ncx2cdf(x,k,lam){ if(lam<=0) return chi2cdf(x,k); const m=lam/2; let s=0;
  const j0=Math.floor(m), lp0=-m+j0*Math.log(m)-lgamma(j0+1);
  for(let j=j0, lp=lp0;j<j0+2000;j++){ const t=Math.exp(lp)*chi2cdf(x,k+2*j); s+=t; if(j>j0+10&&t<1e-17) break; lp+=Math.log(m)-Math.log(j+1); }
  for(let j=j0-1, lp=lp0-Math.log(m)+Math.log(j0);j>=0;j--){ const t=Math.exp(lp)*chi2cdf(x,k+2*j); s+=t; if(t<1e-17&&j<j0-10) break; lp+=Math.log(j)-Math.log(m); }
  return Math.min(1,s); }
function bisect(f,lo,hi,it){ for(let i=0;i<(it||200);i++){ const m=(lo+hi)/2; if(f(m)) hi=m; else lo=m; } return (lo+hi)/2; }
const chi2inv=(p,k)=>bisect(x=>chi2cdf(x,k)>=p,0,500);
/* pbias: the normalised bias that a fault must have to be missed with probability pmd at a false-alarm rate pfa */
const PB={};
function pbias(dof,pfa,pmd){ const key=dof+'|'+pfa+'|'+pmd; if(PB[key]) return PB[key];
  const T=chi2inv(1-pfa,dof), lam=bisect(l=>ncx2cdf(T,dof,l)<=pmd,0,1000); return PB[key]=Math.sqrt(lam); }

/* ---------- RAIM (snapshot, least squares, equal weights) ---------- */
const RAIM={sigma:33.3,pfa:1/15000,pmd:0.001};         /* DO-208 era values: conservative, as in the original availability standard */
const HAL={enroute:2*NM,terminal:1*NM,approach:0.3*NM};  /* horizontal alert limits, m */
/* horizontal and vertical slopes: how much position error a bias on satellite i causes per unit of test statistic */
function slopes(S){ const G=geom(S), Q=inv(mul(tr(G),G)); if(!Q) return null; const Sm=mul(Q,tr(G)), n=S.length;
  const H=[], V=[]; for(let i=0;i<n;i++){ let p=1; for(let k=0;k<4;k++) p-=G[i][k]*Sm[k][i];
    const sp=p>1e-9?Math.sqrt(p):0; H.push(sp?Math.hypot(Sm[0][i],Sm[1][i])/sp:Infinity); V.push(sp?Math.abs(Sm[2][i])/sp:Infinity); }
  return {H,V}; }
/* protection level for detection: max slope · σ · pbias */
function hpl(S,o){ o=Object.assign({},RAIM,o); if(S.length<5) return Infinity; const s=slopes(S); if(!s) return Infinity;
  return Math.max(...s.H)*o.sigma*pbias(S.length-4,o.pfa,o.pmd); }
/* RAIM state for an alert limit (m): 'nofix' (<4), 'none' (4, no check), 'unavail' (HPL > HAL), 'detect', 'fde' (every subset of n−1 can still detect) */
function raim(S,hal,o){ const n=S.length, D=dop(S);
  if(!D) return {state:'nofix',n,hpl:Infinity,hal}; if(n<5) return {state:'none',n,hpl:Infinity,hal};
  const h=hpl(S,o); if(!(h<=hal)) return {state:'unavail',n,hpl:h,hal};
  let fde=n>=6; if(fde) for(let i=0;i<n&&fde;i++){ const sub=S.filter((_,j)=>j!==i); if(!(hpl(sub,o)<=hal)) fde=false; }
  return {state:fde?'fde':'detect',n,hpl:h,hal}; }

/* ---------- SBAS protection levels (equal σ per satellite) ---------- */
const SBAS={sigma:2.5,kh:6.0,kv:5.33,hal:40,val:50};   /* σ is a typical model value; LPV: HAL 40 m, VAL 50 m (LPV-200: 35 m) */
function sbas(S,o){ o=Object.assign({},SBAS,o); const D=dop(S); if(!D) return {ok:false,hpl:Infinity,vpl:Infinity};
  const hp=o.kh*o.sigma*D.major, vp=o.kv*o.sigma*D.v; return {ok:hp<=o.hal&&vp<=o.val,hpl:hp,vpl:vp}; }

/* ---------- 2D position from ranges (DME/DME reversion) ---------- */
/* stations {x,y}, aircraft {x,y}; returns HDOP of the range fix and the 95 % error for σ (NM) */
function dmedme(st,ac,sigma){ if(st.length<2) return null; const G=st.map(s=>{ const dx=ac.x-s.x, dy=ac.y-s.y, d=Math.hypot(dx,dy)||1e-9; return [dx/d,dy/d]; });
  const Q=inv(mul(tr(G),G)); if(!Q) return null; const h=Math.sqrt(Math.max(0,Q[0][0]+Q[1][1])); return {h,e95:2*h*(sigma||0.1)}; }

/* ---------- turns ---------- */
/* turn radius (NM) from ground speed (kt) and bank (deg): r = V² / (g·tan φ) */
const turnRadius=(gs,bank)=>{ const v=gs*NM/3600; return v*v/(G0*Math.tan(bank*D2R))/NM; };
/* fly-by: the turn starts r·tan(ΔA/2) before the waypoint; the arc passes r·(1/cos(ΔA/2) − 1) inside it */
const flyByLead=(r,dA)=>r*Math.tan(Math.abs(dA)*D2R/2);
const flyByCut=(r,dA)=>r*(1/Math.cos(Math.abs(dA)*D2R/2)-1);
/* fly-over: overhead, turn past the new track, then rejoin it with an intercept of up to 30° (PANS-OPS). Angles in degrees.
   Returns the intercept angle used, the first turn, the straight part and the greatest distance beyond the new leg (NM). */
function flyOver(r,dA,ic){ const A=Math.abs(dA)*D2R; ic=(ic||30)*D2R;
  let th=ic; if(Math.cos(ic)-Math.cos(A)<1-Math.cos(ic)) th=Math.acos((1+Math.cos(A))/2);   /* small turns: an S-turn with a shallower intercept */
  const yq=r*(Math.cos(th)-Math.cos(A)), straight=Math.max(0,(yq-r*(1-Math.cos(th)))/Math.sin(th||1e-9));
  /* the furthest point beyond the new leg is where the heading is parallel to it (after turning ΔA): r·(1 − cos ΔA) */
  return {ic:th*R2D,turn1:(A+th)*R2D,straight,over:r*(1-Math.cos(A))}; }

/* ---------- the flown path ---------- */
/* wps: [{x,y,t:'by'|'over'}] (first and last t ignored). Returns {pts:[{x,y,s,leg}], len, turns:[...]}.
   Every turn uses the same radius r. Legs are TF legs (track between fixes). */
function path(wps,r,step){ step=step||2; const pts=[], turns=[]; let s=0;
  const push=(x,y,leg)=>{ const p=pts[pts.length-1]; if(p) s+=Math.hypot(x-p.x,y-p.y); pts.push({x,y,s,leg}); };
  const trk=i=>bearing(wps[i+1].x-wps[i].x,wps[i+1].y-wps[i].y);
  const U=a=>[Math.sin(a*D2R),Math.cos(a*D2R)];
  push(wps[0].x,wps[0].y,0);
  let rej=null;   /* a fly-over rejoin point on the current leg */
  for(let i=1;i<wps.length-1;i++){ const a1=trk(i-1), a2=trk(i), dA=diff(a2,a1), W=wps[i], dir=dA>=0?1:-1;
    if(Math.abs(dA)<0.5){ push(W.x,W.y,i-1); turns.push({i,dA,lead:0,cut:0,over:0}); continue; }
    if(W.t==='over'){ const f=flyOver(r,dA); push(W.x,W.y,i-1);
      /* arc 1: from heading a1, turn dir by turn1 */
      let h=a1, x=W.x, y=W.y; const n1=Math.max(4,Math.ceil(f.turn1/step));
      const cx=x+U(a1+dir*90)[0]*r, cy=y+U(a1+dir*90)[1]*r;
      for(let k=1;k<=n1;k++){ h=a1+dir*f.turn1*k/n1; const q=U(h-dir*90); push(cx+q[0]*r,cy+q[1]*r,i); }
      x=pts[pts.length-1].x; y=pts[pts.length-1].y;
      if(f.straight>1e-6){ const u=U(h); x+=u[0]*f.straight; y+=u[1]*f.straight; push(x,y,i); }
      /* arc 2: turn back by the intercept angle onto the new leg */
      const c2x=x+U(h-dir*90)[0]*r, c2y=y+U(h-dir*90)[1]*r, n2=Math.max(3,Math.ceil(f.ic/step));
      for(let k=1;k<=n2;k++){ const hh=h-dir*f.ic*k/n2, q=U(hh+dir*90); push(c2x+q[0]*r,c2y+q[1]*r,i); }
      rej=pts[pts.length-1]; turns.push({i,dA,lead:0,cut:0,over:f.over,ic:f.ic}); continue; }
    /* fly-by */
    const L=flyByLead(r,dA), u1=U(a1), u2=U(a2), px=W.x-u1[0]*L, py=W.y-u1[1]*L;
    push(px,py,i-1); const cx=px+U(a1+dir*90)[0]*r, cy=py+U(a1+dir*90)[1]*r, n=Math.max(4,Math.ceil(Math.abs(dA)/step));
    for(let k=1;k<=n;k++){ const h=a1+dA*k/n, q=U(h-dir*90); push(cx+q[0]*r,cy+q[1]*r,i); }
    turns.push({i,dA,lead:L,cut:flyByCut(r,dA),over:0,end:{x:W.x+u2[0]*L,y:W.y+u2[1]*L}}); }
  const E=wps[wps.length-1]; push(E.x,E.y,wps.length-2);
  return {pts,len:s,turns}; }
/* point on the path at distance s: position, track (deg) and the leg index */
function at(P,s){ const p=P.pts; if(s<=0){ const t=bearing(p[1].x-p[0].x,p[1].y-p[0].y); return {x:p[0].x,y:p[0].y,trk:t,leg:p[1].leg}; }
  let lo=0, hi=p.length-1; while(hi-lo>1){ const m=(lo+hi)>>1; if(p[m].s<s) lo=m; else hi=m; }
  const a=p[lo], b=p[hi], f=b.s>a.s?Math.min(1,(s-a.s)/(b.s-a.s)):0; return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,trk:bearing(b.x-a.x,b.y-a.y),leg:b.leg}; }
/* signed cross-track distance from the leg A→B (NM, + = right of track) and the along-track distance from A */
function xtk(A,B,p){ const dx=B.x-A.x, dy=B.y-A.y, L=Math.hypot(dx,dy)||1e-9, ux=dx/L, uy=dy/L, qx=p.x-A.x, qy=p.y-A.y;
  return {xt:qx*uy-qy*ux,at:qx*ux+qy*uy}; }

/* ---------- CDI scaling (full-scale deflection, NM) ---------- */
/* phase 'enroute' 2 NM, 'terminal' 1 NM, 'approach': 1 NM ramping to 0.3 NM over the 2 NM before the FAF, then 0.3 NM linear,
   or angular (LPV, like a localiser: width cw at the threshold, from the GARP behind the far end, at most 0.3 NM);
   'missed' 0.3 NM. dFaf = along-track distance to the FAF (+ before it), dThr = distance to the threshold, rwy = runway length. */
const CW=105/NM;    /* 105 m (350 ft) full scale at the threshold: the usual FAS course width */
function fsd(phase,o){ o=o||{};
  if(phase==='enroute') return 2; if(phase==='terminal') return 1; if(phase==='missed') return 0.3;
  const dF=o.dFaf??0; let lin= dF>2? 1 : dF>0? 0.3+0.7*dF/2 : 0.3;
  if(o.angular){ const gd=(o.rwy||1.6)+305/NM, ang=(Math.max(0,o.dThr??0)+gd)*CW/gd; return Math.min(lin,ang); }
  return lin; }
/* the phase from the distance to the destination (30 NM terminal area), the distance to the FAF and whether the MAPt is passed */
function phase(dDest,dFaf,pastMapt){ if(pastMapt) return 'missed'; if(dFaf!=null&&dFaf<=2) return 'approach'; return dDest>30?'enroute':'terminal'; }
/* HSI dots (2 dots = full scale) from the cross-track error: + = needle right (course to the right, aircraft left of it) */
const dots=(xt,fs,max)=>Math.max(-(max||2.5),Math.min(max||2.5,-xt/fs*2));

/* ---------- vertical path ---------- */
const FT=6076.12;
/* height of a glide path above the threshold at dThr NM: TCH + tan(gpa)·d */
const pathHt=(dThr,gpa,tch)=>(tch??50)+Math.tan((gpa||3)*D2R)*dThr*FT;

root.GNSSCORE={norm,diff,bearing,inv,los,geom,visible,dop,err95,lgamma,gammaP,chi2cdf,ncx2cdf,chi2inv,pbias,RAIM,HAL,slopes,hpl,raim,SBAS,sbas,dmedme,
  turnRadius,flyByLead,flyByCut,flyOver,path,at,xtk,CW,fsd,phase,dots,pathHt,K:{NM,G0,FT}};
})(typeof window!=='undefined'?window:globalThis);
