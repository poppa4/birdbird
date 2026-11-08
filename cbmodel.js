/* Birdbird – cbmodel.js: the thunderstorm teaching model behind storms.html (no drawing here).
   Conditions → environment → cells → fields. Everything is schematic textbook physics, not a forecast model.
   - Cloud base from the dew-point spread: (T − Td) × 400 ft, surface T fixed at 25 °C.
   - Instability (CAPE-like low/moderate/high, reduced in dry air by entrainment) → updraft from parcel theory,
     w ≈ ½·√(2·CAPE) (the ½ stands for water loading and mixing), overshoot above the tropopause and hail size from w.
   - Downdraft and gust front from the updraft and from evaporative cooling (drier low levels → stronger outflow).
   - Wind shear with height tilts the updraft, carries the anvil downwind, and keeps the updraft and the downdraft apart:
     low → single cell, moderate → multicell, high → long-lived supercell-like storm.
   - Life cycle: cumulus 0–15 min, mature 15–35 min (to 50 with strong shear), dissipating after.
   - Fields: vel() (m/s) for the air-motion particles; dbz() (radar reflectivity) for the radar and its beam.
   - Microburst on final: point-mass approach at constant pitch attitude and thrust, or a recovery:
     dV/dt = g·((T − D)/W − sin γa) + dHW/dt,  dh/dt = V·sin γa + w,  α = α0·(V0/V)², γa = θ − α.
   - Radar: 3.5° pencil beam, height = alt + r·tan(tilt) + 0.66·r² ft (earth curvature, r in NM), two-way attenuation. */
(function(){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const MS2FPM=196.85, FT2KM=0.0003048, TROPO=38000;
const CAPEJ={low:700,mod:1600,high:3200};
const TILT={low:0.06,mod:0.32,high:0.55};
const M={MS2FPM,FT2KM,TROPO,clamp};

/* ---------- environment from the conditions ---------- */
M.env=function(c,E){
  const mf=clamp((c.td-8)/14,0,1);
  E.mf=mf; E.td=c.td; E.base=Math.round((25-c.td)*400/100)*100;
  E.cape=Math.round(CAPEJ[c.cape]*(0.6+0.4*mf)/50)*50;
  E.wms=0.5*Math.sqrt(2*E.cape); E.wup=Math.round(E.wms*MS2FPM/100)*100;
  E.topEq=c.cape==='low'?27000+4000*mf:TROPO;
  E.over=c.cape==='low'?0:Math.round(Math.max(0,E.wms-16)*230/100)*100;
  E.fzl=c.fzl; E.m20=c.fzl+10000; E.m40=Math.min(TROPO-1500,c.fzl+19000);
  E.hail=Math.round(clamp((E.wms-13)/6.5,0,6)*(c.fzl>11500?0.7:1)*2)/2;
  E.dd=Math.round((0.33*E.wms+9*(1-mf))*MS2FPM/100)*100;
  E.gustW=Math.round(15+0.6*E.wms+18*(1-mf)); E.gustV=Math.round(E.gustW*0.55);
  E.mbLikely=(c.cape!=='low'&&mf<0.6)||(c.cape==='high'&&mf<0.8);
  E.uw=c.uw||50; E.tilt=TILT[c.shear]; E.anvL=(8+0.6*E.uw)*({low:0.85,mod:1,high:1.12})[c.shear]*(c.cape==='low'?0.6:1); E.shear=c.shear;
  E.matEnd=c.shear==='high'&&c.type==='single'?50:35;
  E.rot=c.shear==='high'&&c.type!=='squall';
  E.type=c.type;
  return E; };

/* ---------- one cell at age a (min) ---------- */
function blank(c){ c.dev='none'; c.glac=0; c.st='none'; c.g=0; c.top=0; c.R=0; c.al=0; c.up=0; c.dd=0; c.rain=0; c.anv=0; c.gust=0; c.mb=0; c.ltg=0; c.hail=0; c.over=0; return c; }
M.cell=function(E,a,x,z,c){
  blank(c); c.x=x; c.z=z; c.age=a; c.dev='none'; if(a<0||a>E.matEnd+27) return c;
  const base=E.base, R0=3.6+1.4*clamp((E.wms-15)/25,0,1), sp=E.gustV*0.0309;
  if(a<6){ const g=a/6; c.st='cu'; c.dev='hum'; c.g=0.35*g; c.top=base+2500+3500*g; c.R=1.1+0.8*g; c.al=clamp(a/1.2,0,1); c.up=E.wup*(0.12+0.13*g); return c; }
  if(a<14){ const g=(a-6)/8; c.st='cu'; c.dev='tcu'; c.g=0.35+0.65*g; c.top=base+6000+(0.68*E.topEq-base-6000)*Math.pow(g,0.9); c.R=1.4+(R0*0.55-1.4)*Math.pow(g,0.7); c.al=1; c.up=E.wup*(0.4+0.45*g); c.ltg=0; return c; }
  if(a<20){ const g=(a-14)/6; c.st='mat'; c.dev='calvus'; c.g=1; c.top=0.68*E.topEq+0.32*E.topEq*Math.pow(g,0.7); c.over=E.over*0.35*g; c.R=R0*(0.55+0.45*g); c.al=1; c.up=E.wup*(0.85+0.15*g);
    c.anv=0.16*g; c.dd=E.dd*0.3*clamp((a-17)/3,0,1); c.rain=0; c.ltg=clamp((a-16)/2,0,1); c.hail=Math.round(E.hail*0.6*2)/2; c.glac=g; return c; }
  if(a<E.matEnd){ const m=(a-20)/(E.matEnd-20); c.st='mat'; c.dev='incus'; c.g=1; c.top=E.topEq; c.over=E.over*Math.sin(Math.PI*clamp(m*1.5+0.3,0,1)); c.R=R0; c.al=1; c.glac=1;
    c.up=E.wup*(1-0.25*clamp((m-0.7)/0.3,0,1)); c.dd=E.dd*clamp((a-19)/4,0,1); c.rain=clamp((a-19.5)/2.5,0,1); c.anv=clamp(0.16+(a-20)/12,0,1);
    c.gust=Math.max(0,(a-20.5)*sp)+R0*0.5; c.ltg=1; c.hail=E.hail; c.mb=E.mbLikely?Math.max(0,1-Math.abs(a-26)/7):0; return c; }
  const d=clamp((a-E.matEnd)/25,0,1); c.st='dis'; c.dev='dis'; c.g=1; c.glac=1; c.top=E.topEq*(1-0.3*d); c.R=R0*(1+0.15*d); c.al=1-0.75*d; c.up=0;
  c.dd=E.dd*0.45*(1-d); c.rain=0.6*(1-d); c.anv=1; c.gust=Math.max(0,(a-20.5)*sp*(1-0.3*d))+R0*0.5; c.ltg=0.4*(1-d); c.hail=0;
  c.mb=E.mbLikely&&a<E.matEnd+5?0.5*(1-(a-E.matEnd)/5):0; return c; };
/* ---------- the storm: cells for the storm type at time t ---------- */
const POOL=[]; for(let i=0;i<8;i++) POOL.push(blank({id:i,x:0,z:0,age:0}));
M.storm=function(cond,E,out){
  M.env(cond,E); const t=cond.t; out.length=0;
  if(cond.type==='multi'){ for(let k=0;k<4;k++){ const a=((t+54-18*k)%72+72)%72; const c=POOL[k]; M.cell(E,a,14-a*0.6,12-a*0.42,c); c.seed=k; if(c.st!=='none'&&c.st==='mat') c.anv=Math.min(c.anv,0.7); out.push(c); } }
  else if(cond.type==='squall'){ for(let k=0;k<7;k++){ const c=POOL[k]; const a=20+((t*0.5+k*4.3)%12); M.cell(E,a,1.5*Math.sin(k*1.7),-27+9*k,c); c.seed=k; out.push(c); } }
  else { const c=POOL[0]; M.cell(E,t,0,0,c); c.seed=0; out.push(c); }
  return out; };
/* the cell that sets the readout: the mature one, else the biggest */
M.main=function(cells){ let b=null; for(const c of cells){ if(c.st==='none') continue; if(!b||(c.st==='mat'&&b.st!=='mat')||(c.st===b.st&&c.top>b.top)) b=c; } return b; };

/* ---------- air motion (m/s): u along x, v along z, w up; x,z km, h km ---------- */
const VO={u:0,v:0,w:0};
M.vel=function(E,cells,x,h,z){
  let u=E.tilt*9*Math.min(h,12)/12, v=0, w=0; const hb=E.base*FT2KM;
  for(let i=0;i<cells.length;i++){ const c=cells[i]; if(c.st==='none'||c.al<0.05) continue;
    const ht=Math.min(c.top,TROPO)*FT2KM, R=c.R;
    if(c.up>0&&h<ht+c.over*FT2KM){ const cx=c.x+E.tilt*Math.max(0,h-hb*0.5), dx=x-cx, dz=z-c.z, ru=R*0.5, d2=(dx*dx+dz*dz)/(ru*ru);
      if(d2<7){ const f=clamp((h+0.4)/(ht+0.4),0,1), prof=Math.pow(Math.sin(Math.PI*Math.min(1,f*0.92+0.04)),0.6), e=Math.exp(-d2);
        let wu=c.up/MS2FPM*e*prof; if(h>ht-1.5){ const k=clamp((h-ht+1.5)/1.5,0,1); wu*=1-0.85*k; u+=k*14*e; }
        w+=wu; if(E.rot&&c.st==='mat'){ const s=5*e; u+=-dz/ru*s; v+=dx/ru*s; } } }
    if(c.up>0&&h<hb){ const dx=x-c.x, dz=z-c.z, r=Math.sqrt(dx*dx+dz*dz)+0.4; if(r<R*3.5){ const s=c.up/MS2FPM*0.22*Math.exp(-r/(R*1.5))*(1-h/hb); u-=dx/r*s; v-=dz/r*s; } }
    if(c.anv>0&&h>ht-2.6&&h<ht+0.6){ const dz=z-c.z, k=Math.exp(-dz*dz/(R*R*9)); if(x>c.x-R) u+=E.uw*0.22*c.anv*k; }
    if(c.dd>0){ const off=c.st==='dis'?0:R*0.62+E.tilt*2.2, cx=c.x+off, dx=x-cx, dz=z-c.z, rd=R*(c.st==='dis'?0.8:0.55), d2=(dx*dx+dz*dz)/(rd*rd), htop=Math.min(ht*0.72,8.5);
      const ddm=c.dd/MS2FPM*(1+0.5*c.mb);
      if(h<htop&&d2<6) w-=ddm*Math.exp(-d2)*(h<0.9?h/0.9:1)*Math.min(1,(htop-h)/1.5);
      if(h<1.4){ const r=Math.sqrt(dx*dx+dz*dz)+0.05; if(r<c.gust+3){ const ur=ddm*1.15*clamp(r/rd,0,1.2)*Math.exp(-h/0.55)*(r<c.gust?1:Math.exp(-(r-c.gust)*1.6)); u+=dx/r*ur; v+=dz/r*ur; } } } }
  VO.u=u; VO.v=v; VO.w=w; return VO; };
M.downCentre=function(E,c,o){ const off=c.st==='dis'?0:c.R*0.62+E.tilt*2.2; o.x=c.x+off; o.z=c.z; return o; };

/* ---------- what an aircraft meets at x,z km, h ft (the Fly group) ---------- */
const LV=['none','light','moderate','severe'];
M.LV=LV;
M.probe=function(E,cells,x,h,z,o){ o.cloud=false; o.turb=0; o.ice=0; o.hail=0; o.ltg=0; o.ws=0; o.dCore=1e9; o.dAnv=1e9; o.under=false; o.above=false; o.inside=false;
  const hk=h*FT2KM, hb=E.base*FT2KM, tk=TROPO*FT2KM;
  for(const c of cells){ if(c.st==='none'||c.al<0.15) continue; const ht=Math.min(c.top,TROPO)*FT2KM, cx=c.x+E.tilt*Math.max(0,Math.min(hk,ht)-hb), dx=x-cx, dz=z-c.z, d=Math.sqrt(dx*dx+dz*dz);
    const dCore=Math.max(0,d-c.R)/1.852; if(c.st!=='cu'||c.dev==='tcu') o.dCore=Math.min(o.dCore,dCore);
    const inTower=hk>=hb&&hk<=ht+c.over*FT2KM&&d<=c.R*1.05, mat=c.st==='mat';
    if(inTower){ o.cloud=true; o.inside=true; o.turb=Math.max(o.turb,c.dev==='hum'?1:c.dev==='tcu'?3:mat?3:2);
      if(h>E.fzl&&h<=E.m20) o.ice=Math.max(o.ice,c.dev==='hum'?1:3); else if(h>E.m20&&h<=E.m40) o.ice=Math.max(o.ice,c.dev==='tcu'||c.dev==='calvus'?2:1);
      if(c.hail>0&&h>E.fzl-3000) o.hail=Math.max(o.hail,c.hail>=2?3:2); if(c.ltg>0.3) o.ltg=Math.max(o.ltg,3); }
    else if(mat||c.st==='dis'){ const near=dCore; o.turb=Math.max(o.turb,near<10?(mat?3:2):near<20?2:near<30?1:0); if(near<10&&c.ltg>0.3) o.ltg=Math.max(o.ltg,2); else if(near<20&&c.ltg>0.3) o.ltg=Math.max(o.ltg,1);
      if(hk>ht&&d<c.R*2) { o.above=true; o.turb=Math.max(o.turb,hk-ht-c.over*FT2KM<1.5?3:2); } }
    else if(c.dev==='tcu'&&d<c.R*2.5) o.turb=Math.max(o.turb,1);
    /* anvil */
    if(c.anv>0.1&&c.st!=='cu'){ const L=E.anvL*c.anv, cxT=c.x+E.tilt*(tk-hb), a=(x-cxT+c.R*0.9)/(L+c.R*0.9);
      if(a>=0&&a<=1){ const W=c.R*1.05+a*L*0.42, thick=(2.6-1.5*a)*(0.5+0.5*c.anv), bot=tk-thick; const dzA=Math.abs(z-c.z)-W;
        o.dAnv=Math.min(o.dAnv,Math.max(0,dzA)/1.852);
        if(dzA<=0){ if(hk>=bot&&hk<=tk+0.4){ o.cloud=true; o.turb=Math.max(o.turb,a<0.4?2:1); o.ltg=Math.max(o.ltg,a<0.4?2:1); }
          else if(hk<bot){ o.under=true; if(c.hail>0&&a>0.08&&a<0.7) o.hail=Math.max(o.hail,2); o.turb=Math.max(o.turb,a<0.5?2:1); o.ltg=Math.max(o.ltg,2); } } }
      else { const da=(a<0?-(x-cxT+c.R*0.9):(x-cxT-L))/1.852; o.dAnv=Math.min(o.dAnv,Math.max(Math.abs(da),Math.max(0,Math.abs(z-c.z)-c.R)/1.852)); } }
    /* low level: gust front and microburst */
    if(h<4000&&c.gust>0){ const off=c.st==='dis'?0:c.R*0.62+E.tilt*2.2, gx=x-c.x-off, r=Math.sqrt(gx*gx+dz*dz); if(r<c.gust+3) o.ws=Math.max(o.ws,r<c.R*0.9&&c.mb>0.2?3:r<c.gust+1?2:1); } }
  if(E.type==='emb'&&h>3500&&h<22000) o.cloud=true;
  o.guide=o.dCore>=20?2:o.dCore>=10?1:0; return o; };

/* ---------- radar reflectivity (dBZ) at x,z km, h ft ---------- */
M.dbz=function(E,cells,x,h,z){ let best=-99;
  for(let i=0;i<cells.length;i++){ const c=cells[i]; if(c.st==='none') continue; const top=Math.min(c.top,TROPO)+c.over; if(h>top) continue;
    const pk=c.pk||(40+8*clamp((E.wms-15)/25,0,1)+(c.hail>=2?6:0)); const fz=c.fzl||E.fzl;
    if(c.st==='cu'){ if(c.g<0.6) continue; const dx=x-c.x, dz=z-c.z, d2=(dx*dx+dz*dz)/(c.R*c.R*0.4); const z0=26*(c.g-0.6)/0.4-14*d2-Math.abs(h-fz-6000)/2500; if(z0>best) best=z0; continue; }
    const off=c.st==='dis'?0:c.R*0.45, dx=x-c.x-off, dz=z-c.z, rr=c.R*(c.st==='dis'?1:0.85), d2=(dx*dx+dz*dz)/(rr*rr); if(d2>4) continue;
    let zz=pk*Math.pow(Math.max(c.rain,0.05),0.25)-13*d2; if(h>fz) zz-=24*(h-fz)/Math.max(4000,top-fz)+3; if(h>top-3000) zz-=8;
    if(zz>best) best=zz; }
  return best; };

/* ---------- radar scenario: three cells ahead of the aircraft (bearing °, range NM) ---------- */
M.RC=[{id:'A',b:-6,r:38,pk:56,rc:5,top:43000},{id:'B',b:-2,r:68,pk:52,rc:6,top:40000},{id:'C',b:30,r:52,pk:46,rc:4,top:22000}];
M.RFZL=14000;
M.radarCells=function(){ return M.RC.map((q,i)=>{ const c=blank({id:10+i}); c.st='mat'; c.g=1; c.al=1; c.age=25; c.top=q.top; c.R=q.rc*1.852; c.rain=1; c.pk=q.pk; c.fzl=M.RFZL; c.anv=q.top>30000?0.8:0; c.hail=q.pk>50?3:0; c.ltg=q.top>30000?1:0;
  c.x=q.r*1.852*Math.cos(q.b*Math.PI/180); c.z=q.r*1.852*Math.sin(q.b*Math.PI/180); c.seed=i+3; c.q=q; return c; }); };

/* ---------- microburst on final ---------- */
const D0=6, HT=2600, MAXN=2400, DT=0.1;
const MB={D0,HT,MAXN,dv:50,xc:2.6,R:0.8,vapp:140,pil:'none',
  sD:new Float32Array(MAXN),sH:new Float32Array(MAXN),sV:new Float32Array(MAXN),sHW:new Float32Array(MAXN),sW:new Float32Array(MAXN),sF:new Uint8Array(MAXN),sTh:new Float32Array(MAXN),
  n:0,trig:-1,gnd:-1,shaker:-1,minV:0,maxV:0,minDev:0};
/* outflow along the approach (kt, + = headwind) and vertical wind (ft/min) at distance d NM from the threshold, height h ft */
MB.ur=(r,h)=>{ const q=r/MB.R, f=q*Math.exp(0.5*(1-q*q)), hf=clamp(h/150,0.5,1)*Math.exp(-Math.max(0,h-300)/1300); return MB.dv/2*f*hf; };
MB.hw=(d,h)=>MB.ur(d-MB.xc,h);
MB.wv=(r,h)=>{ const q=r/MB.R; return -40*MB.dv*Math.exp(-q*q/0.64)*clamp(h/500,0.12,1); };
MB.gs=d=>d*6076*Math.tan(3*Math.PI/180)+50;
MB.simulate=function(){ const V0=MB.vapp, a0=5, th0=-3+a0, TW0=0.12-Math.sin(3*Math.PI/180); let d=5.4, h=MB.gs(5.4), V=V0, th=th0, TW=TW0, mode=0, prevHW=MB.hw(d,h);
  MB.trig=-1; MB.gnd=-1; MB.shaker=-1; MB.minV=V0; MB.maxV=V0; MB.minDev=0; let i=0; const hw0=MB.hw(5.4,MB.gs(5.4));
  for(;i<MAXN-2;i++){ const W_=MB.hw(d,h), w=MB.wv(d-MB.xc,h), a=a0*(V0/V)*(V0/V), ga=(th-a)*Math.PI/180;
    MB.sD[i]=d; MB.sH[i]=h; MB.sV[i]=V; MB.sHW[i]=W_; MB.sW[i]=w; MB.sF[i]=mode; MB.sTh[i]=th; MB.minV=Math.min(MB.minV,V); MB.maxV=Math.max(MB.maxV,V); MB.minDev=Math.min(MB.minDev,h-MB.gs(Math.max(0,d)));
    if(a>12&&MB.shaker<0) MB.shaker=i;
    if(mode===0&&((MB.pil==='rec'&&(V<V0-15||h<MB.gs(d)-150))||(MB.pil==='early'&&(V>V0+10||W_-hw0>12)))){ mode=1; MB.trig=i; }
    if(mode===1){ TW=Math.min(0.30,TW+0.08*DT); th=Math.min(15,th+3*DT); if(a>12) th-=4*DT; }
    const D_=0.03*(V/V0)*(V/V0)+0.09*(V0/V)*(V0/V), dHW=(W_-prevHW)/DT; prevHW=W_;
    V+=(19.06*(TW-D_-Math.sin(ga))+dHW)*DT; V=Math.max(60,V);
    h+=(V*1.6878*Math.sin(ga)+w/60)*DT; d-=(V*Math.cos(ga)-W_)/3600*DT;
    if(h<=0&&d>0.05){ MB.gnd=i+1; i++; MB.sD[i]=d; MB.sH[i]=0; MB.sV[i]=V; MB.sHW[i]=W_; MB.sW[i]=w; MB.sF[i]=mode; MB.sTh[i]=th; i++; break; }
    if(d<=0||(mode===1&&h>HT-150)){ i++; break; } }
  MB.n=Math.min(i,MAXN); };
M.MB=MB;

/* ---------- weather radar scan (ND picture) ---------- */
const NB=121, NR=150;
const RD={fl:33000,tilt:0,gain:'cal',rng:80,BW:3.5,NB,NR,PPI:new Float32Array(NB*NR),ATT:new Float32Array(NB*NR),GND:new Uint8Array(NB*NR),cells:null,E:{fzl:14000,wms:30}};
RD.beamC=r=>RD.fl+r*6076*Math.tan(RD.tilt*Math.PI/180)+0.664*r*r;
RD.beamHW=r=>r*6076*Math.tan(RD.BW/2*Math.PI/180);
const GAIN={min:-8,cal:0,max:8};
RD.scan=function(){ if(!RD.cells) RD.cells=M.radarCells(); const R=RD.rng, dr=R/NR, gdb=GAIN[RD.gain], cs=RD.cells, E=RD.E;
  for(let b=0;b<NB;b++){ const br=(-60+b)*Math.PI/180, sb=Math.sin(br), cb=Math.cos(br); let att=0;
    for(let k=0;k<NR;k++){ const r=(k+0.5)*dr, x=r*cb*1.852, z=r*sb*1.852, hc=RD.beamC(r), hw=RD.beamHW(r); let cnt=0, sum=0;
      if(hc-hw<50000) for(let j=-3;j<=3;j++){ const h=hc+hw*j/3; if(h<0) continue; const zz=M.dbz(E,cs,x,h,z); const wt=1-Math.abs(j)/4; if(zz>-50) sum+=Math.pow(10,zz/10)*wt; cnt+=wt; }
      const zs=sum>0?10*Math.log10(sum/Math.max(cnt,1e-6)):-99, lo=hc-hw; RD.GND[b*NR+k]=lo<0?(lo<-hw*0.6?2:1):0;
      RD.PPI[b*NR+k]=zs>-50?zs-att+gdb:-99; RD.ATT[b*NR+k]=att;
      if(zs>30) att+=(zs-30)*0.11*dr*2; } } };
/* strongest painted echo on the display for a cell */
RD.cellOnDisplay=function(q){ const R=RD.rng; if(q.r>R) return -100; let best=-99; for(let b=0;b<NB;b++){ const bd=-60+b; if(Math.abs(bd-q.b)>Math.max(4,q.rc/q.r*57)) continue; for(let k=0;k<NR;k++){ const r=(k+0.5)*R/NR; if(Math.abs(r-q.r)>q.rc*1.2) continue; best=Math.max(best,RD.PPI[b*NR+k]); } } return best; };
/* attenuation along the track (bearing b°) at range r NM, as the beam sees it: the dB lost before reaching r */
RD.attAt=function(b,r){ const R=RD.rng, bi=clamp(Math.round(b+60),0,NB-1), k=clamp(Math.floor(r/R*NR),0,NR-1); let att=0; const dr=R/NR;
  for(let j=0;j<k;j++){ const v=RD.PPI[bi*NR+j]-GAIN[RD.gain]; if(v>30) att+=(v-30)*0.11*dr*2; } return att; };
RD.GAIN=GAIN;
M.RD=RD;
M.zcol=(z,a)=>z>=50?`rgba(214,40,190,${a})`:z>=40?`rgba(226,58,46,${a})`:z>=30?`rgba(232,200,60,${a})`:z>=20?`rgba(46,160,90,${a})`:null;
window.CBM=M;
})();
