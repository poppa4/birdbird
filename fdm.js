/* Birdbird – DA42-lignende flymodell (pedagogisk), navigasjon og autopilot.
   SI-enheter internt. Kroppsakser: x frem, y høyre, z ned. Verden: N, E, h (opp).
   Tallene er tilnærmede og ikke hentet fra en sertifisert modell. */
(function(G){
'use strict';
const D2R=Math.PI/180, R2D=180/Math.PI, KT=0.514444, FT=0.3048, FPM=0.00508, NM=1852, g0=9.80665;
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const wrap180=a=>{ a=(a+180)%360; if(a<0) a+=360; return a-180; };
const wrap360=a=>{ a%=360; return a<0?a+360:a; };
const smooth=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };

/* ---------- fly ---------- */
const AC={
  name:'DA42 NG', m:1700, S:16.29, b:13.42, c:1.27, Ixx:4300, Iyy:3900, Izz:7400,
  CL0:0.30, CLa:5.0, CLmax:1.54,
  flaps:[ {n:'UP', dCL:0, dCLmax:0, dCD:0, dCm:0},
          {n:'APP',dCL:0.20,dCLmax:0.17,dCD:0.012,dCm:-0.025},
          {n:'LDG',dCL:0.42,dCLmax:0.40,dCD:0.042,dCm:-0.05} ],
  CD0:0.026, k:0.038, gearCD:0.016,
  Cm0:0.046, Cma:-1.0, Cmq:-14, CmE:0.36, CmT:0.17,
  Clb:-0.07, Clp:-0.50, Clr:0.10, ClA:0.052, ClR:0.006,
  Cnb:0.075, Cnr:-0.12, Cnp:-0.035, CnA:-0.005, CnR:0.027, CYb:-0.62, CYR:0.075,
  Pmax:125000, Tstatic:2450, Aprop:Math.PI*0.95*0.95, yEng:2.55,
  xMain:0.16, wheelbase:1.9,
  fuelCap:25, // US gal per side (brukbart, omtrent)
  V:{ s0:62, s1:66, fe1:133, fe2:113, no:151, ne:188, mc:76, yse:85, r:80, y:90, le:188, lo:152 } // DA42 NG, KIAS
};

/* ---------- verden ---------- */
const WORLD={
  elev:0,
  rwy:{ id:'36', n0:0, e0:0, hdg:360, len:1500, wid:30, name:'Birdbird Field' },
  vor:{ id:'ASN', name:'Birdbird VOR', freq:'113.30', N:900, E:-2600 },
  loc:{ id:'IASN', freq:'110.30', N:1500+300, E:0, crs:360, fs:2.5 },
  gs:{ N:300, E:110, ang:3.0, fs:0.7 }
};

function isa(h,dev){ const T=288.15-0.0065*h+(dev||0), p=101325*Math.pow(1-0.0065*h/288.15,5.2559); return {T,p,rho:p/(287.05*T),sig:p/(287.05*T)/1.225}; }

function mkEng(){ return {thr:0, load:0, rpm:0, fail:false, feather:false, ff:0, oilT:60, oilP:0, coolT:60, fuel:AC.fuelCap, T:0}; }

function create(){
  return { N:0,E:0,h:0, u:0,v:0,w:0, p:0,q:0,r:0, phi:0,th:0,psi:0,
    ctl:{ail:0,ele:0,rud:0,trim:0,flap:0,gear:1,brake:0,flapPos:0,gearPos:1},
    eng:[mkEng(),mkEng()], ground:true, Vg:0, crash:null, t:0, stall:0, buffet:0, asym:0,
    env:{wdir:0,wspd:0,isa:0,qnh:1013.25,turb:0}, baro:1013.25, autotrim:true,
    trail:[], trailT:0, o:{} };
}

/* plasser flyet: luft eller bakke */
function place(s,o){
  s.N=o.N||0; s.E=o.E||0; s.h=(o.alt||0)*FT; s.psi=(o.hdg||0)*D2R; s.phi=0; s.p=s.q=s.r=0; s.crash=null; s.trail.length=0; s.stall=0;
  s.ctl.flap=s.ctl.flapPos=o.flap||0; s.ctl.gear=s.ctl.gearPos=(o.gear===undefined?1:o.gear); s.ctl.ail=s.ctl.ele=s.ctl.rud=0; s.ctl.brake=0;
  s.eng.forEach((e,i)=>{ e.fail=!!(o.fail&&o.fail[i]); e.feather=false; e.thr=o.thr!==undefined?o.thr:0.6; e.load=e.fail?0:e.thr; e.oilT=85; e.coolT=82; e.fuel=AC.fuelCap*(o.fuel||0.8); });
  if(o.ground){ s.ground=true; s.h=WORLD.elev; s.Vg=(o.ias||0)*KT; s.th=0; s.u=s.Vg; s.v=s.w=0; s.ctl.trim=0.05; return; }
  s.ground=false;
  const at=isa(s.h,s.env.isa), V=(o.ias||120)*KT/Math.sqrt(at.sig);
  // finn trimmet alfa for planflukt
  const fl=AC.flaps[s.ctl.flap], q=0.5*at.rho*V*V, CL=AC.m*g0/(q*AC.S);
  const a=(CL-AC.CL0-fl.dCL)/AC.CLa;
  s.th=a+(o.gam||0)*D2R; s.u=V*Math.cos(a); s.w=V*Math.sin(a); s.v=0;
  // trim slik at Cm=0
  s.ctl.trim=clamp(-(AC.Cm0+AC.Cma*a+fl.dCm)/AC.CmT,-1,1);
  // effekt for planflukt
  const CD=AC.CD0+fl.dCD+(s.ctl.gear?AC.gearCD:0)+AC.k*CL*CL, D=q*AC.S*CD;
  if(o.thr===undefined){ const live=s.eng.filter(e=>!e.fail).length||1; const eta=0.82*(1-Math.exp(-V/18)); const P=D*V/eta/live; s.eng.forEach(e=>{ e.thr=e.fail?e.thr:clamp(P/(AC.Pmax*Math.min(1,at.sig/0.74)),0.05,1); e.load=e.fail?0:e.thr; }); }
}

/* aerodynamiske koeffisienter */
function aero(s,a,b,V,phat,qhat,rhat,hAGL){
  const fl=AC.flaps[0]; const fp=s.ctl.flapPos, i0=Math.floor(fp), i1=Math.min(2,i0+1), t=fp-i0;
  const F=k=>AC.flaps[i0][k]*(1-t)+AC.flaps[i1][k]*t;
  const CL0=AC.CL0+F('dCL'), CLmax=AC.CLmax+F('dCLmax');
  const aS=(CLmax-CL0)/AC.CLa;                    // statisk stallvinkel (lineær)
  const ab=aS-0.04, CLb=CL0+AC.CLa*ab, xp=0.08;    // myk topp
  let CL;
  if(a<=ab) CL=Math.max(CL0+AC.CLa*a,-0.95);
  else if(a<=ab+xp){ const x=a-ab; CL=CLb+AC.CLa*x-AC.CLa/(2*xp)*x*x; }
  else { const x=a-ab-xp; CL=Math.max(CLmax-2.6*x, 0.9*Math.sin(2*a)+0.05); }
  const st=smooth(aS+0.02,aS+0.10,a);            // 0..1 hvor stallet
  let k=AC.k; if(hAGL<AC.b){ const r=16*(hAGL/AC.b)**2; k*=r/(1+r); }
  const CD=AC.CD0+F('dCD')+AC.gearCD*s.ctl.gearPos+k*Math.min(CL,CLmax)**2+1.4*st*Math.sin(a)**2;
  const Cm=AC.Cm0+AC.Cma*a+AC.Cmq*qhat+AC.CmE*s.ctl.ele+AC.CmT*s.ctl.trim+F('dCm')-0.12*st;
  const ClpEff=AC.Clp*(1-0.85*st);
  const Cl=AC.Clb*b+ClpEff*phat+AC.Clr*rhat+AC.ClA*s.ctl.ail*(1-0.4*st)+AC.ClR*s.ctl.rud+st*s.asym;
  const Cn=AC.Cnb*b+AC.Cnr*rhat+AC.Cnp*phat+AC.CnA*s.ctl.ail+AC.CnR*s.ctl.rud;
  const CY=AC.CYb*b+AC.CYR*s.ctl.rud;
  return {CL,CD,Cm,Cl,Cn,CY,st,aS};
}

/* motorer: skyv og verdier */
function engines(s,dt,V,at){
  const q=0.5*at.rho*V*V, pa=Math.min(1,at.sig/0.74);
  let Tl=0,Tr=0;
  s.eng.forEach((e,i)=>{
    const alive=!e.fail && e.fuel>0;
    const tgt=alive? e.thr : 0;
    e.load+=(tgt-e.load)*Math.min(1,dt/1.1);
    let T;
    if(alive){ const P=e.load*AC.Pmax*pa, eta=0.82*(1-Math.exp(-Math.max(V,1)/18)); T=Math.min(AC.Tstatic*Math.max(e.load,0.03), eta*P/Math.max(V,1)); }
    else T= -(e.feather?0.012:0.13)*q*AC.Aprop;
    e.T=T;
    const rpmT= alive ? 900+1400*smooth(0,0.55,e.load) : (e.feather?0:Math.min(1900,V*30));
    e.rpm+=(rpmT-e.rpm)*Math.min(1,dt/(alive?0.8:(e.feather?3:1.5)));
    e.ff= alive? 0.7+9.0*Math.pow(e.load,1.1) : 0;
    e.fuel=Math.max(0,e.fuel-e.ff*dt/3600);
    e.oilT+=((alive?72+28*e.load:Math.max(15,e.oilT-5))-e.oilT)*dt/90;
    e.coolT+=((alive?70+26*e.load:Math.max(15,e.coolT-5))-e.coolT)*dt/70;
    e.gbT=(e.gbT??40)+(((alive?48+32*e.load:Math.max(15,(e.gbT??40)-5)))-(e.gbT??40))*dt/80; e.fuelT=(e.fuelT??18)+((alive?20+6*e.load:15)-(e.fuelT??18))*dt/300;
    e.volts=e.rpm>1100?28.1:24.2; e.amps=e.rpm>1100?8+6*e.load:0;
    e.oilP+=((alive?2.2+2.6*smooth(0,0.6,e.load):(e.rpm>300?0.6:0))-e.oilP)*Math.min(1,dt/0.8);
    if(i===0) Tl=T; else Tr=T;
  });
  return {Tl,Tr};
}

function windNE(s){ const d=s.env.wdir*D2R, w=s.env.wspd*KT; return [-w*Math.cos(d),-w*Math.sin(d)]; }

/* ett integrasjonssteg */
function step(s,dt){
  if(s.crash){ return; }
  s.t+=dt;
  const C=s.ctl;
  C.flapPos+=clamp(C.flap-C.flapPos,-dt/4,dt/4);
  C.gearPos+=clamp(C.gear-C.gearPos,-dt/6,dt/6);
  const at=isa(s.h,s.env.isa), m=AC.m, W=m*g0, hAGL=s.h-WORLD.elev;
  const [wN,wE]=windNE(s);
  if(s.ground) return stepGround(s,dt,at,wN,wE);

  const V=Math.max(1,Math.hypot(s.u,s.v,s.w));
  const a=Math.atan2(s.w,s.u), b=Math.asin(clamp(s.v/V,-1,1));
  const qb=0.5*at.rho*V*V, b2v=AC.b/(2*V), c2v=AC.c/(2*V);
  // turbulens (enkel)
  if(s.env.turb>0){ const k=s.env.turb; s.q+=(Math.random()-0.5)*0.05*k*dt*60*dt; s.p+=(Math.random()-0.5)*0.12*k*dt*60*dt; s.w+=(Math.random()-0.5)*0.6*k*dt*60*dt; }
  const A=aero(s,a,b,V,s.p*b2v,s.q*c2v,s.r*b2v,hAGL);
  if(A.st>0.3 && s.stall<0.3) s.asym=(Math.random()<0.5?-1:1)*(0.006+0.01*Math.random())+0.04*s.v/V;
  s.stall=A.st; s.buffet=smooth(A.aS-0.03,A.aS+0.03,a);
  const {Tl,Tr}=engines(s,dt,V,at);
  const L=qb*AC.S*A.CL, D=qb*AC.S*A.CD, Y=qb*AC.S*A.CY;
  const ca=Math.cos(a), sa=Math.sin(a);
  const Fx=L*sa-D*ca+Tl+Tr, Fz=-L*ca-D*sa, Fy=Y;
  const sp=Math.sin(s.phi), cp=Math.cos(s.phi), st=Math.sin(s.th), ct=Math.cos(s.th), ss=Math.sin(s.psi), cs=Math.cos(s.psi);
  const gx=-g0*st, gy=g0*sp*ct, gz=g0*cp*ct;
  const du=s.r*s.v-s.q*s.w+Fx/m+gx;
  const dv=s.p*s.w-s.r*s.u+Fy/m+gy;
  const dw=s.q*s.u-s.p*s.v+Fz/m+gz;
  const Lm=qb*AC.S*AC.b*A.Cl, Mm=qb*AC.S*AC.c*A.Cm, Nm=qb*AC.S*AC.b*A.Cn+(Tl-Tr)*AC.yEng; // venstre motor mer skyv => nese til høyre
  const dp=(Lm+(AC.Iyy-AC.Izz)*s.q*s.r)/AC.Ixx;
  const dq=(Mm+(AC.Izz-AC.Ixx)*s.p*s.r)/AC.Iyy;
  const dr=(Nm+(AC.Ixx-AC.Iyy)*s.p*s.q)/AC.Izz;
  s.u+=du*dt; s.v+=dv*dt; s.w+=dw*dt; s.p+=dp*dt; s.q+=dq*dt; s.r+=dr*dt;
  const tt=Math.tan(s.th);
  s.phi+=(s.p+(s.q*sp+s.r*cp)*tt)*dt;
  s.th+=(s.q*cp-s.r*sp)*dt;
  s.psi+=((s.q*sp+s.r*cp)/Math.max(0.05,ct))*dt;
  if(s.phi>Math.PI) s.phi-=2*Math.PI; if(s.phi<-Math.PI) s.phi+=2*Math.PI;
  if(s.th>Math.PI/2-0.01){ s.th=Math.PI-s.th; s.phi+= s.phi>0?-Math.PI:Math.PI; s.psi+=Math.PI; }
  if(s.th<-Math.PI/2+0.01){ s.th=-Math.PI-s.th; s.phi+= s.phi>0?-Math.PI:Math.PI; s.psi+=Math.PI; }
  s.psi=((s.psi%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
  // posisjon
  const u=s.u,v=s.v,w=s.w;
  const vN=ct*cs*u+(sp*st*cs-cp*ss)*v+(cp*st*cs+sp*ss)*w+wN;
  const vE=ct*ss*u+(sp*st*ss+cp*cs)*v+(cp*st*ss-sp*cs)*w+wE;
  const vD=-st*u+sp*ct*v+cp*ct*w;
  s.N+=vN*dt; s.E+=vE*dt; s.h-=vD*dt;
  s.vN=vN; s.vE=vE; s.vD=vD; s.nz=-(Fz)/(m*g0); s.ny=Fy/(m*g0); s.alpha=a; s.beta=b; s.aS=A.aS;
  const th=G.TERRAIN?G.TERRAIN.height(s.N,s.E):WORLD.elev; s.terr=th;
  if(s.h<=Math.max(WORLD.elev,th)){ if(th>5) return crash(s,'Controlled flight into terrain'); touchdown(s); }
}

function touchdown(s){
  const vs=-s.vD, phi=Math.abs(s.phi)*R2D, inRwy=onRunway(s);
  s.h=WORLD.elev;
  if(s.ctl.gearPos<0.98) return crash(s,'Gear-up landing');
  if(vs< -3.6) return crash(s,'Hard landing (more than 700 ft/min)');
  if(phi>10) return crash(s,'Wingtip strike: bank too steep at touchdown');
  if(s.th< -3*D2R) return crash(s,'Nose-wheel first: pitch too low at touchdown');
  if(!inRwy) return crash(s,'Landed off the runway');
  s.ground=true; s.landed={vs:vs/FPM, t:s.t}; s.phi=0; s.p=s.r=0; s.th=Math.max(0,s.th);
  s.Vg=s.vN*Math.cos(s.psi)+s.vE*Math.sin(s.psi);
}
function crash(s,msg){ s.crash=msg; s.u=s.v=s.w=s.p=s.q=s.r=0; }
function onRunway(s){ const R=WORLD.rwy, d=R.hdg*D2R; const dn=s.N-R.n0, de=s.E-R.e0; const al=dn*Math.cos(d)+de*Math.sin(d), xt=-dn*Math.sin(d)+de*Math.cos(d); return al>-60 && al<R.len+60 && Math.abs(xt)<R.wid/2+6; }

function stepGround(s,dt,at,wN,wE){
  const C=s.ctl, W=AC.m*g0;
  const hx=Math.cos(s.psi), hy=Math.sin(s.psi);
  const Va=s.Vg-(wN*hx+wE*hy); const V=Math.max(0.5,Math.abs(Va));
  const a=s.th;
  const A=aero(s,a,0,V,0,s.q*AC.c/(2*V),0,0.5);
  const qb=0.5*at.rho*Va*Va;
  const {Tl,Tr}=engines(s,dt,V,at);
  const L=qb*AC.S*A.CL, D=qb*AC.S*A.CD*Math.sign(Va);
  const N=Math.max(0,W-L-(Tl+Tr)*Math.sin(a));
  const mu=0.025+0.45*C.brake;
  let Fx=Tl+Tr-D-mu*N*Math.sign(s.Vg||1);
  if(Math.abs(s.Vg)<0.3 && Math.abs(Tl+Tr-D)<mu*N){ Fx=0; s.Vg=0; }
  s.Vg+=Fx/AC.m*dt;
  if(s.Vg<0 && Tl+Tr>=0) s.Vg=Math.max(s.Vg,0);
  // pitch rundt hovedhjul
  const M=qb*AC.S*AC.c*A.Cm-(N)*AC.xMain;
  s.q+=M/(AC.Iyy+AC.m*AC.xMain*AC.xMain)*dt; s.q*=Math.exp(-3*dt);
  s.th+=s.q*dt;
  if(s.th<=0){ s.th=0; if(s.q<0) s.q=0; }
  if(s.th>13*D2R){ s.th=13*D2R; s.q=Math.min(0,s.q); s.tail=true; }
  // styring
  const yawT=(Tl-Tr)*AC.yEng;
  if(s.th<1*D2R){ const steer=C.rud*14*D2R; const rT=s.Vg*Math.tan(steer)/AC.wheelbase+yawT/(AC.Izz*6); s.r+=(rT-s.r)*Math.min(1,dt*6); }
  else { const Nn=qb*AC.S*AC.b*(AC.CnR*C.rud)+yawT; s.r+=(Nn/AC.Izz-1.5*s.r)*dt; }
  s.psi=((s.psi+s.r*dt)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
  s.p=0; s.phi+=(0-s.phi)*Math.min(1,dt*5);
  s.N+=s.Vg*hx*dt; s.E+=s.Vg*hy*dt; s.h=WORLD.elev;
  s.vN=s.Vg*hx; s.vE=s.Vg*hy; s.vD=0; s.nz=1; s.ny=0; s.alpha=a; s.beta=0; s.aS=A.aS; s.stall=0; s.buffet=0;
  s.u=Va; s.v=0; s.w=0;
  if(Math.abs(s.Vg)>3 && !onRunway(s)) return crash(s,'Ran off the runway');
  // løft av
  if(L+(Tl+Tr)*Math.sin(a)>W*1.01 && Va>25){
    s.ground=false; s.h=WORLD.elev+0.05; s.u=Va*Math.cos(a); s.w=Va*Math.sin(a); s.v=0; s.p=0; s.r=0; s.landed=null;
  }
}

/* ---------- avledede verdier for instrumenter ---------- */
function readouts(s){
  const at=isa(s.h,s.env.isa);
  const Va=Math.hypot(s.u,s.v,s.w);
  const ias=Va*Math.sqrt(at.sig)/KT;
  const o=s.o;
  o.ias=s.ground? Math.max(0,s.u*Math.sqrt(at.sig)/KT) : ias;
  o.tas=Va/KT;
  o.alt=s.h/FT+(s.baro-s.env.qnh)*27.3;   // QNH-feil
  o.altTrue=s.h/FT; o.agl=(s.h-(s.terr||0))/FT; o.terrFt=(s.terr||0)/FT;
  o.vs=-(s.vD||0)/FPM;
  o.hdg=wrap360(s.psi*R2D);
  o.pitch=s.th*R2D; o.roll=s.phi*R2D;
  o.gs=Math.hypot(s.vN||0,s.vE||0)/KT;
  o.trk=o.gs>3? wrap360(Math.atan2(s.vE,s.vN)*R2D) : o.hdg;
  o.oat=at.T-273.15;
  o.slip=clamp((s.ny||0)*6+(s.ground?0:0),-1,1);
  o.aoa=(s.alpha||0)*R2D; o.aoaStall=(s.aS||0.24)*R2D;
  o.nz=s.nz||1;
  return o;
}

/* ---------- navigasjon ---------- */
function navRel(s,stN,stE,crsDeg){
  const c=crsDeg*D2R, rN=s.N-stN, rE=s.E-stE;
  const along=rN*Math.cos(c)+rE*Math.sin(c), xtk=-rN*Math.sin(c)+rE*Math.cos(c);
  return {along,xtk,dist:Math.hypot(rN,rE)};
}
function navFreq(s,freq,crs,list){ const st=(list||[]).find(n=>n.freq===freq); if(!st) return {src:'VOR',crs,valid:false,dev:0,toFrom:null,dist:null,id:'',freq,gs:null,brg:null}; return nav(s,st.type==='LOC'?'LOC':'VOR',crs,st); }
function nav(s,src,crs,st){
  const R={src,crs,valid:false,dev:0,toFrom:null,dist:null,id:'',freq:'',gs:null};
  if(src==='VOR'){
    const v=st||WORLD.vor, r=navRel(s,v.N,v.E,crs);
    R.id=v.id; R.freq=v.freq; R.dist=Math.hypot(r.dist,s.h)/NM;
    if(R.dist<60){ R.valid=true; const ang=Math.atan2(r.xtk,Math.abs(r.along))*R2D; R.dev=clamp(-ang/10,-1.2,1.2); R.toFrom=r.along>0?'FROM':'TO'; R.xtk=r.xtk; }
    R.brg=wrap360(Math.atan2(v.E-s.E,v.N-s.N)*R2D);
  } else {
    const l=st?Object.assign({fs:2.5},WORLD.loc,st):WORLD.loc, r=navRel(s,l.N,l.E,l.crs);
    R.id=l.id; R.freq=l.freq; R.dist=Math.hypot(r.dist,s.h)/NM;
    const ang=Math.atan2(r.xtk,-r.along)*R2D;
    if(R.dist<20 && r.along<0 && Math.abs(ang)<35){ R.valid=true; const crsErr=wrap180(crs-l.crs); const sgn=Math.abs(crsErr)>90?-1:1; R.dev=clamp(-sgn*ang/l.fs,-1.2,1.2); R.toFrom='TO'; R.xtk=r.xtk; R.locAng=ang; }
    const g=WORLD.gs, rg=navRel(s,g.N,g.E,l.crs), d=-rg.along;
    if(R.valid && d>200){ const el=Math.atan2(s.h-WORLD.elev,d)*R2D; R.gs={dev:clamp((el-g.ang)/g.fs,-1.2,1.2), targetH:WORLD.elev+d*Math.tan(g.ang*D2R), d}; }
    R.brg=wrap360(Math.atan2(l.E-s.E,l.N-s.N)*R2D);
  }
  return R;
}

/* ---------- autopilot og flight director ---------- */
function mkAP(){ return {on:false, fd:false, lat:'', latArm:'', vert:'', vertArm:'', hdg:360, alt:3000, vsRef:0, iasRef:110, pitchRef:0, rollRef:0, altHold:0, phiCmd:0, thCmd:0, msg:'', msgT:0, lastIas:null, discT:0}; }

function apSet(ap,s,o,key,navS){
  const anyOn=ap.on||ap.fd;
  const defaults=()=>{ if(!ap.lat){ ap.lat='ROL'; ap.rollRef=Math.abs(o.roll)<6?0:clamp(o.roll,-22,22); } if(!ap.vert){ ap.vert='PIT'; ap.pitchRef=clamp(o.pitch,-10,15); ap.vertArm=ap.alt!==Math.round(o.alt)?'ALTS':''; } };
  switch(key){
    case 'AP': if(ap.on){ ap.on=false; ap.msg='AP OFF'; ap.msgT=3; } else { if(s.ground) return; ap.on=true; ap.fd=true; defaults(); } break;
    case 'FD': if(ap.on) break; ap.fd=!ap.fd; if(ap.fd) defaults(); else { ap.lat=ap.vert=ap.latArm=ap.vertArm=''; } break;
    case 'HDG': if(ap.lat==='HDG'){ ap.lat='ROL'; ap.rollRef=0; } else { ap.fd=true; defaults(); ap.lat='HDG'; ap.latArm=''; } break;
    case 'NAV': case 'APR':
      ap.fd=true; defaults();
      if(ap.lat===key||ap.latArm===key){ ap.lat=ap.lat===key?'ROL':ap.lat; ap.latArm=''; if(key==='APR'){ if(ap.vert==='GS'||ap.vert==='GP'){ap.vert='PIT'; ap.pitchRef=o.pitch;} ap.vertArm=ap.vertArm.replace(/\s*G[SP]/,'').trim(); ap.aprMode=false; } }
      else { ap.latArm=key; ap.aprMode=key==='APR'; if(ap.lat==='ROL'&&Math.abs(ap.rollRef)<1) ap.rollRef=0; if(key==='APR' && navS.src==='LOC') ap.vertArm=(ap.vertArm.replace(/\s*G[SP]/,'')+' GS').trim(); if(key==='APR' && navS.src==='GPS' && navS.lpv) ap.vertArm=(ap.vertArm.replace(/\s*G[SP]/,'')+' GP').trim(); }
      break;
    case 'ALT': ap.fd=true; defaults(); if(ap.vert==='ALT'){ ap.vert='PIT'; ap.pitchRef=o.pitch; } else { ap.vert='ALT'; ap.altHold=Math.round(o.alt/10)*10; ap.vertArm=ap.vertArm.replace('ALTS','').trim(); } break;
    case 'VS': ap.fd=true; defaults(); if(ap.vert==='VS'){ ap.vert='PIT'; ap.pitchRef=o.pitch; } else { ap.vert='VS'; ap.vsRef=Math.round(o.vs/100)*100; armAlts(ap,o); } break;
    case 'FLC': ap.fd=true; defaults(); if(ap.vert==='FLC'){ ap.vert='PIT'; ap.pitchRef=o.pitch; } else { ap.vert='FLC'; ap.iasRef=Math.round(o.ias); armAlts(ap,o); } break;
    case 'UP': case 'DN': { const d=key==='UP'?1:-1;
      if(ap.vert==='VS') ap.vsRef=clamp(ap.vsRef+100*d,-2000,1500);
      else if(ap.vert==='FLC') ap.iasRef=clamp(ap.iasRef-d,70,180);
      else if(ap.vert==='PIT') ap.pitchRef=clamp(ap.pitchRef+0.5*d,-10,15);
      else if(ap.vert==='ALT') ap.altHold+=10*d; } break;
  }
  if(!ap.on&&!ap.fd){ ap.lat=ap.vert=ap.latArm=ap.vertArm=''; }
}
function armAlts(ap,o){ if(Math.abs(ap.alt-o.alt)>60 && !/ALTS/.test(ap.vertArm)) ap.vertArm=(ap.vertArm+' ALTS').trim(); }

function apRun(ap,s,o,navS,dt){
  if(ap.msgT>0) ap.msgT-=dt;
  if(!(ap.on||ap.fd)) return;
  if(s.ground||s.crash){ if(ap.on){ ap.on=false; ap.msg='AP OFF'; ap.msgT=3; } return; }
  // armerte moder
  // CDI byttet kilde (f.eks. automatisk fra GPS til LOC)
  if(ap.lat==='GPS'&&navS.src!=='GPS'){ if(navS.src==='LOC'&&navS.valid&&Math.abs(navS.dev)<1){ ap.lat='LOC'; if(ap.aprMode&&!/GS/.test(ap.vertArm)&&ap.vert!=='GS') ap.vertArm=(ap.vertArm.replace(/\s*GP/,'')+' GS').trim(); } else { ap.lat='ROL'; ap.rollRef=0; ap.latArm=''; } }
  if((ap.lat==='LOC'||ap.lat==='VOR'||ap.lat==='VAPP')&&navS.src==='GPS'){ ap.lat='ROL'; ap.rollRef=0; }
  if(ap.latArm && navS.valid){
    const cap= navS.src==='LOC' ? Math.abs(navS.dev)<0.75 : navS.src==='GPS' ? Math.abs(navS.dev)<1.0 : Math.abs(navS.dev)<0.6;
    const want= ap.latArm==='NAV' || (ap.latArm==='APR');
    if(want && cap){ ap.lat= navS.src==='LOC' ? 'LOC' : navS.src==='GPS' ? 'GPS' : (ap.latArm==='APR'?'VAPP':'VOR'); ap.latArm=''; }
  }
  if(/GS/.test(ap.vertArm) && ap.lat==='LOC' && navS.gs && Math.abs(navS.gs.dev)<0.25){ ap.vert='GS'; ap.vertArm=ap.vertArm.replace(/\s*GS/,'').replace('ALTS','').trim(); }
  if(/GP/.test(ap.vertArm) && ap.lat==='GPS' && navS.gp && Math.abs(navS.gp.dev)<0.25){ ap.vert='GP'; ap.vertArm=ap.vertArm.replace(/\s*GP/,'').replace('ALTS','').trim(); }
  if(/ALTS/.test(ap.vertArm) && (ap.vert==='VS'||ap.vert==='FLC'||ap.vert==='PIT')){
    const lead=Math.max(60,Math.abs(o.vs)*0.18), d=ap.alt-o.alt;
    if(Math.abs(d)<lead){ ap.vert='ALT'; ap.altHold=ap.alt; ap.vertArm=ap.vertArm.replace('ALTS','').trim(); }
  }
  const V=Math.max(20,o.tas*KT);
  // lateral
  let phiC=0;
  const hdgToBank=err=>clamp(err*1.4,-22,22);
  if(ap.lat==='ROL') phiC=ap.rollRef;
  else if(ap.lat==='HDG') phiC=hdgToBank(wrap180(ap.hdg-o.hdg));
  else if(ap.lat==='VOR'||ap.lat==='LOC'||ap.lat==='VAPP'||ap.lat==='GPS'){
    if(!navS.valid){ ap.lat='ROL'; ap.rollRef=0; }
    else { const kx= ap.lat==='LOC' ? 40/500 : ap.lat==='GPS' ? 40/(Math.max(0.3,navS.fs||1)*NM*0.9) : 40/1800; const crs= ap.lat==='LOC'?(navS.locCrs||WORLD.loc.crs):navS.crs;
      const xt=navS.xtk*(navS.toFrom==='TO'&&ap.lat!=='LOC'?1:1);
      const intc=clamp(-xt*kx,-40,40);
      const desTrk=crs+intc, drift=wrap180(o.hdg-o.trk);
      phiC=hdgToBank(wrap180(desTrk+drift-o.hdg)); }
  }
  // vertikal
  const gam=Math.asin(clamp(o.vs*FPM/V,-1,1))*R2D, aEst=o.pitch-gam;
  let thC=o.pitch;
  const vsToPitch=vs=> aEst+Math.asin(clamp(vs*FPM/V,-0.5,0.5))*R2D;
  if(ap.vert==='PIT') thC=ap.pitchRef;
  else if(ap.vert==='VS') thC=vsToPitch(ap.vsRef);
  else if(ap.vert==='ALT') thC=vsToPitch(clamp((ap.altHold-o.alt)*5,-800,800));
  else if(ap.vert==='GS'||ap.vert==='GP'){
    if(!navS.gs){ ap.vert='PIT'; ap.pitchRef=o.pitch; }
    else { const vsNom=-o.gs*KT*Math.tan(3*D2R)/FPM; const err=(navS.gs.targetH-s.h)/FT; thC=vsToPitch(vsNom+clamp(err*6,-500,500)); }
  }
  else if(ap.vert==='FLC'){
    const trend= ap.lastIas===null?0:(o.ias-ap.lastIas)/dt;
    ap.pitchRef=clamp((ap.pitchRef??o.pitch)+(0.10*(o.ias-ap.iasRef)+0.9*trend)*dt*4,-12,16);
    // stig ikke bort fra valgt høyde
    if(ap.alt<o.alt-50) ap.pitchRef=Math.min(ap.pitchRef,aEst+0.5); else if(ap.alt>o.alt+50) ap.pitchRef=Math.max(ap.pitchRef,aEst-0.5);
    thC=ap.pitchRef;
  }
  ap.lastIas=o.ias;
  thC=clamp(thC,-10,15);
  // glatt kommando
  ap.phiCmd+=clamp(phiC-ap.phiCmd,-5*dt,5*dt);
  ap.thCmd+=clamp(thC-ap.thCmd,-3*dt,3*dt);
  if(ap.on){
    const C=s.ctl;
    C.ail=clamp(0.045*(ap.phiCmd-o.roll)-0.9*s.p,-0.6,0.6);
    const e=clamp(0.11*(ap.thCmd-o.pitch)-1.6*s.q,-0.6,0.6);
    C.ele=e;
    C.trim=clamp(C.trim+e*0.9*dt,-1,1);   // autotrim
    if(s.stall>0.4){ ap.on=false; ap.msg='AP OFF'; ap.msgT=3; }
  }
}

G.FDM={navFreq,AC,WORLD,KT,FT,FPM,NM,D2R,R2D,create,place,step,readouts,nav,isa,mkAP,apSet,apRun,wrap180,wrap360,clamp,onRunway};
})(window);
