/* Birdbird – hazards.js: "Icing and turbulence" (hazards.html).
   One schematic cross-section of the atmosphere with three hazard layers, and a wing-section view of the ice:
   - Icing: temperature falls 2 °C per 1,000 ft from the surface (a warm layer aloft is added for freezing rain).
     Supercooled liquid water exists from 0 to −40 °C; the liquid water that is left falls off below −10 °C (glaciation).
     Ice type from drop size and temperature (how fast the drop freezes), intensity from liquid water content × collection.
     Ice on the wing grows at an illustrative rate per intensity; CLmax, stall angle and drag change with type and thickness.
   - Mountain wave: wind across a 6,000 ft ridge; lee wavelength λ = 2π·U/N (N = Brunt–Väisälä frequency, from the stability),
     amplitude grows with wind and stability; rotor below the first crest when the air is stable and the wind strong.
   - Jet stream: core speed on a Gaussian cross-section (narrower on the polar side); CAT from the vertical wind shear.
   Teaching model, illustrative numbers; not to horizontal scale. */
(function(){
'use strict';
const {L,el,nf}=LAB;
const t2=(en,no)=>({en,no});
const INK={bg:'#10171D',grid:'#1F2B35',rule:'#2A3742',ink:'#D7E1E6',mute:'#8B99A7',dim:'#5E6D7C',cyan:'#7FCBE8',ice:'#9FE3FF',mag:'#E46BAE',amber:'#F0B440',red:'#EC5A47',green:'#71CC93',violet:'#B9A6F0',white:'#EEF3F7',blue:'#5DA9E9'};
const FONT={mono:'"IBM Plex Mono", ui-monospace, monospace',body:'"Public Sans", system-ui, sans-serif'};
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hooks=[]; const on=f=>{ hooks.push(f); return f; };
const ZMAX=44000, RIDGE_U=0.5, RIDGE_H=6000, JET_U=0.80, JET_Z=33000;

/* ---------------- state ---------------- */
const S={tab:'xs',drop:'small',t0:6,tmin:10,wind:35,stab:'stable',jet:140,alt:7000,u:0.2,prot:'off',lay:{ice:true,wave:true,jet:true,w:true,lab:true}};
let R=null;

/* ---------------- model: temperature and icing ---------------- */
function temp(z){ let T=S.t0-2*z/1000; if(S.drop==='sld'){ const W=13-S.t0; T+=Math.max(0,W)*Math.exp(-Math.pow((z-5000)/1800,2)); } return T; }
// isotherm crossings, scanned once per change
function isoAlts(Tc){ const out=[]; let prev=temp(0)-Tc; for(let z=100;z<=ZMAX;z+=100){ const v=temp(z)-Tc; if((prev>0)!==(v>0)) out.push(z-100*v/(v-prev)); prev=v; } return out; }
// cloud geometry by drop size: returns a "cloud fraction" 0..1 (soft edge) at (u,z)
const CLD={small:{u0:0.03,u1:0.41,b:2500,t:11000},large:{u0:0.13,u1:0.33,b:3000,t:20000},sld:{u0:0.03,u1:0.41,b:7500,t:18000}};
function bump(u,k,a){ return a*(Math.sin(u*k)+0.5*Math.sin(u*k*2.3+1.3)); }
function cloudAt(u,z){ const c=CLD[S.drop];
  if(S.drop==='large'){ // a towering cumulus with a smaller one beside it
    const f=clamp((z-c.b)/(c.t-c.b),0,1), hw=0.095-0.03*f+0.012*Math.sin(f*9), main=(z>=c.b&&z<=c.t+bump(u,60,500)&&Math.abs(u-0.23)<hw)?1:0;
    const side=(z>=3200&&z<=8200+bump(u,80,300)&&Math.abs(u-0.37)<0.032)?1:0; return Math.max(main,side); }
  if(u<c.u0||u>c.u1) return 0; return (z>=c.b+bump(u,47,350)&&z<=c.t+bump(u,31,700))?1:0; }
// freezing rain / SLD below the cloud: rain falling through the column under the cloud
function rainAt(u,z){ if(S.drop!=='sld') return 0; const c=CLD.sld; return u>=c.u0+0.02&&u<=c.u1-0.02&&z<c.b?1:0; }
const SIZE={small:{lwc:0.45,E:0.6,k:8,cap:0.30},large:{lwc:0.48,E:0.9,k:18,cap:0.45},sld:{lwc:0.6,E:1.0,k:30,cap:0.50}};
const glac=T=>T>0?0:T>=-10?1:T>=-20?1-0.085*(-T-10):T>=-40?0.15*(40+T)/20:0;
const RATE={trace:0.1,light:0.4,mod:1.0,sev:2.0}; // mm per minute on the leading edge (illustrative)
function icing(u,z){ const T=temp(z), inC=cloudAt(u,z)>0, inR=rainAt(u,z)>0;
  const o={T,inC,inR,type:'none',int:'none',why:'',sl:false};
  if(!inC&&!inR){ o.why='dry'; return o; }
  if(T>0){ o.why=inR?'warmrain':'warm'; return o; }
  if(T<-40){ o.why='crystals'; return o; }
  const sz=inR?SIZE.sld:(S.drop==='sld'?SIZE.small:SIZE[S.drop]); // in the cloud above a freezing-rain layer the drops are cloud-sized
  const eff=(inR?sz.lwc:sz.lwc*glac(T))*sz.E; o.sl=inR;
  o.int=eff<0.05?'trace':eff<0.2?'light':eff<0.45?'mod':'sev'; if(inR) o.int='sev';
  const f=-T/sz.k; o.type=inR?'sld':f<0.45?'clear':f<0.75?'mixed':'rime';
  if(eff<0.01){ o.type='none'; o.int='none'; o.why='crystals'; }
  return o; }
// what the ice does: thickness (mm) after S.tmin minutes, CLmax loss, stall angle, drag, stall speed
function wingIce(ic){ const o={thk:0,type:ic.type,loss:0,as:16,drag:0,vs:0,prot:S.prot==='on'};
  if(ic.type==='none') return o; let thk=RATE[ic.int]*S.tmin; if(o.prot&&ic.type!=='sld') thk=0; else if(o.prot) thk*=0.6; // with protection on, SLD still freezes behind the protected area
  thk=Math.min(thk,60); o.thk=thk; if(thk<=0){ o.type='none'; return o; }
  const cap={rime:0.30,mixed:0.38,clear:0.45,sld:0.50}[ic.type];
  o.loss=cap*(0.3*(1-Math.exp(-thk/0.8))+0.7*(1-Math.exp(-thk/12)));
  o.as=16-8*o.loss/0.45; o.drag=100*({rime:0.5,mixed:0.8,clear:1.2,sld:1.0}[ic.type]*(1-Math.exp(-thk/12))+0.12);
  o.vs=(Math.sqrt(1/(1-o.loss))-1)*100; return o; }

/* ---------------- model: mountain wave ---------------- */
const terr=u=>RIDGE_H*Math.exp(-Math.pow((u-RIDGE_U)/0.055,2))+900*Math.exp(-Math.pow((u-0.43)/0.03,2))+700*Math.exp(-Math.pow((u-0.585)/0.03,2))+220+120*Math.sin(u*41);
const KM_PER_U=100;
function waveP(){ const U=S.wind*0.5144, N=S.stab==='stable'?0.014:S.stab==='neutral'?0.008:0; const lam=N?2*Math.PI*U/N/1000:0; // km
  const st=S.stab==='stable'?1:S.stab==='neutral'?0.35:0; const amp=st*clamp((S.wind-15)/25,0,1.6)*1400; // ft
  return {U,N,lam,lu:lam/KM_PER_U,amp,rotor:S.stab==='stable'&&S.wind>=35,wave:amp>150}; }
let WP=waveP();
function eta(u,z){ // vertical displacement of the streamline that starts at height z (ft)
  const d=u-RIDGE_U; let e=terr(u)*Math.exp(-z/12000);
  if(d>0&&WP.wave){ const ramp=clamp(d/(WP.lu*0.5),0,1), sh=0.35+0.65*Math.exp(-Math.pow((z-9000)/9000,2)), dec=Math.exp(-d/(3.5*WP.lu));
    e+=WP.amp*sh*dec*ramp*Math.sin(2*Math.PI*d/WP.lu-Math.PI/2); }
  return e; }
function wAt(u,z){ const du=0.002, dx=du*KM_PER_U*3280.84; return S.wind*101.27*(eta(u+du,z)-eta(u-du,z))/(2*dx); } // ft/min
function rotorBox(){ if(!WP.rotor) return null; const uc=RIDGE_U+WP.lu*0.5; return {uc,zc:3200,hu:Math.max(0.018,WP.lu*0.3),hz:2600}; }
function inRotor(u,z){ const r=rotorBox(); if(!r) return false; return Math.pow((u-r.uc)/r.hu,2)+Math.pow((z-r.zc)/r.hz,2)<=1; }

/* ---------------- model: jet stream and CAT ---------------- */
function jetV(u,z){ const dx=u-JET_U, dz=z-JET_Z, sx=dx<0?0.10:0.20, sz=dz<0?14000:11000; return 15+25*Math.min(z,JET_Z)/JET_Z+S.jet*Math.exp(-Math.pow(dx/sx,2)-Math.pow(dz/sz,2)); }
function shearAt(u,z){ return Math.abs(jetV(u,z+250)-jetV(u,z-250))*2; } // kt per 1,000 ft
const catCls=s=>s<4?'nil':s<6?'light':s<9?'mod':'sev';
const tropo=u=>{ const a=JET_U-0.02, b=JET_U+0.04; return u<a?30000:u>b?39500:30000+(u-a)/(b-a)*9500; };

/* ---------------- model: turbulence at a point ---------------- */
const RANK={nil:0,light:1,mod:2,sev:3};
function turb(u,z){ const c=[]; const T=temp(z);
  if(S.drop==='large'&&cloudAt(u,z)>0) c.push(['conv',z>14000?'mod':'mod']);
  else if(cloudAt(u,z)>0) c.push(['strat','nil']);
  if(inRotor(u,z)) c.push(['rotor','sev']);
  const d=u-RIDGE_U, top=RIDGE_H+2500;
  if(S.stab==='stable'&&WP.wave&&d>0&&d<WP.lu*0.45&&z<top+1500&&z>terr(u)) c.push(['lee',S.wind>=40?'sev':'mod']);
  if(S.stab!=='stable'&&S.wind>=20&&d>-0.02&&d<0.16&&z<top+1000&&z>terr(u)) c.push(['mech',S.wind>=35?'mod':'light']);
  if(S.stab==='unstable'&&z<9000&&z>terr(u)&&!c.length) c.push(['therm','light']);
  if(S.stab==='stable'&&WP.wave&&d>0&&!c.some(x=>x[0]==='rotor'||x[0]==='lee')&&z<26000) c.push(['wave','light']);
  const sh=z>18000?shearAt(u,z):0; if(z>18000){ const k=catCls(sh); if(k!=='nil') c.push(['cat',k]); }
  let best=['none','nil']; c.forEach(x=>{ if(RANK[x[1]]>RANK[best[1]]||best[0]==='none') best=x; });
  return {cause:best[0],int:best[1],all:c,w:wAt(u,z),sh,V:z>18000?jetV(u,z):null,T}; }

function solve(){ WP=waveP(); const ic=icing(S.u,S.alt), wi=wingIce(ic), tb=turb(S.u,S.alt); R={ic,wi,tb,fz:isoAlts(0),m20:isoAlts(-20),m40:isoAlts(-40)}; }

/* ---------------- strings ---------------- */
const INT={none:t2('none','ingen'),nil:t2('nil','ingen'),trace:t2('trace','spor'),light:t2('light','lett'),mod:t2('moderate','moderat'),sev:t2('severe','kraftig')};
const TYP={none:t2('no ice','ingen is'),rime:t2('rime ice','rimis'),clear:t2('clear ice','klaris'),mixed:t2('mixed ice','blandingsis'),sld:t2('clear ice from freezing rain (SLD)','klaris fra underkjølt regn (SLD)')};
const TYS={none:t2('no ice','ingen is'),rime:t2('rime','rimis'),clear:t2('clear','klaris'),mixed:t2('mixed','blandingsis'),sld:t2('freezing rain','underkjølt regn')};
const WHY={dry:t2('Clear air: no visible moisture, no ice.','Klar luft: ingen synlig fuktighet, ingen is.'),warm:t2('In cloud, but above 0 °C: the drops are ordinary liquid water.','I sky, men over 0 °C: dråpene er vanlig flytende vann.'),warmrain:t2('In the warm layer: the rain is above 0 °C and stays liquid. This is the escape level from freezing rain.','I det varme laget: regnet er over 0 °C og forblir flytende. Dette er nivået som redder deg ut av underkjølt regn.'),crystals:t2('So cold that almost all the water is ice crystals: they bounce off, little or no ice.','Så kaldt at nesten alt vannet er iskrystaller: de spretter av, lite eller ingen is.')};
const CAUSE={none:t2('none','ingen'),conv:t2('convective (in cumulus)','konvektiv (i cumulus)'),strat:t2('layer cloud: smooth','lagsky: rolig'),rotor:t2('rotor under the wave crest','rotor under bølgetoppen'),lee:t2('lee-side downdraft and mechanical','fallvind på lesiden og mekanisk'),mech:t2('mechanical, over and behind the ridge','mekanisk, over og bak ryggen'),therm:t2('thermal (convective)','termisk (konvektiv)'),wave:t2('mountain wave: smooth but strong up- and downdrafts','fjellbølge: rolig, men kraftige opp- og nedvinder'),cat:t2('clear air turbulence (wind shear)','klarluftsturbulens (vindskjær)')};
LAB.add({},{'Icing and Turbulence':'Ising og turbulens','Icing and turbulence':'Ising og turbulens','Birdbird Virtual Labs · Meteorology':'Birdbird Virtual Labs · Meteorologi',
 'Key concepts':'Nøkkelbegreper','Hazards lab':'Farelab','Try it':'Prøv selv','Key points':'Det viktigste','Test yourself':'Test deg selv','1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Test yourself':'3 · Test deg selv',
 'Controls':'Kontroller','Conditions':'Forhold','Show':'Vis','Scenarios':'Scenarier','Advanced':'Avansert','Your aircraft':'Flyet ditt','Cloud and drops':'Sky og dråper','Wind over the ridge':'Vind over fjellryggen','Ice protection':'Isbeskyttelse',
 'Icing at the aircraft':'Ising ved flyet','Turbulence at the aircraft':'Turbulens ved flyet',
 'Altitude (ft)':'Høyde (ft)','Position along the section (%)':'Posisjon langs snittet (%)','Surface temperature (°C)':'Temperatur ved bakken (°C)','Time in this icing (min)':'Tid i denne isingen (min)','Wind at ridge top (kt)':'Vind ved ryggtoppen (kt)','Jet core speed (kt)':'Fart i jetkjernen (kt)'});
LAB.tx({lead:'Ett tverrsnitt av atmosfæren med de to farene du møter på nesten hver flytur. Fly gjennom sky med valgt temperatur og dråpestørrelse, og se isen bygge seg opp på vingen. Møt så fjellbølger, rotorer og klarluftsturbulens nær jetstrømmen.',
 goal:'<span class="k">Læringsmål</span>Forutsi hvor det dannes is og hvilken type, forklare hva den gjør med steilingen, og vite hvor du kan vente turbulens over fjell og nær jetstrømmen, og hvor ille den kan bli.',
 kAll:'Istyper, skalaer og avising i sin helhet'});

/* ---------------- drawing helpers ---------------- */
function txt(g,s,x,y,o){ o=o||{}; g.font=(o.w||(o.mono?400:600))+' '+(o.size||12)+'px '+(o.mono?FONT.mono:FONT.body); g.textAlign=o.al||'left'; g.textBaseline='alphabetic';
  if(o.bg){ const w=g.measureText(s).width, h=(o.size||12)+5, x0=o.al==='center'?x-w/2:o.al==='right'?x-w:x; g.fillStyle=o.bg; g.fillRect(x0-4,y-h+4,w+8,h); }
  g.fillStyle=o.col||INK.ink; g.fillText(s,x,y); }
function dline(g,x0,y0,x1,y1,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke(); g.setLineDash([]); }
function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const BGL='rgba(16,23,29,.78)';
const DASH_FLOW=[3,11], DASH_RAIN=[7,13], DASH_DOT=[0.1,9], NODASH=[];

/* smooth scalar fields: computed on a small grid, drawn scaled with smoothing (no blocky cells) */
const FC=[document.createElement('canvas'),document.createElement('canvas')];
function field(g,k,u0,u1,z0,z1,nx,ny,fn){ const c=FC[k]; if(c.width!==nx||c.height!==ny){ c.width=nx; c.height=ny; } const cx=c.getContext('2d'), im=cx.createImageData(nx,ny), d=im.data, rgba=[0,0,0,0];
  for(let j=0;j<ny;j++){ const y=Y(z1)+(Y(z0)-Y(z1))*(j+0.5)/ny, z=Zof(y); for(let i=0;i<nx;i++){ const u=u0+(u1-u0)*(i+0.5)/nx, o=(j*nx+i)*4; rgba[3]=0; fn(u,z,rgba); d[o]=rgba[0]; d[o+1]=rgba[1]; d[o+2]=rgba[2]; d[o+3]=rgba[3]; } }
  cx.putImageData(im,0,0); g.imageSmoothingEnabled=true; g.drawImage(c,X(u0),Y(z1),X(u1)-X(u0),Y(z0)-Y(z1)); }
/* ---------------- canvas ---------------- */
const cv=el('hzCv'); let st=null;
const bg=document.createElement('canvas'), bgc=bg.getContext('2d'); let dirty=true, bw=0, bh=0;
const FLOW=[], RAIN={liq:null,fz:null,sn:null}; let DROPS=null;
let box={l:46,t:8,w:100,h:100};
const ZP=0.6, X=u=>box.l+u*box.w, Y=z=>box.t+(1-Math.pow(clamp(z,0,ZMAX)/ZMAX,ZP))*box.h;
const Zof=y=>ZMAX*Math.pow(clamp(1-(y-box.t)/box.h,0,1),1/ZP), Uof=x=>clamp((x-box.l)/box.w,0,1);
const narrow=()=>st&&st.w<560;

function buildXS(g,W,H){
  box={l:narrow()?34:48,t:8,w:W-(narrow()?34:48)-8,h:H-12};
  g.fillStyle=INK.bg; g.fillRect(0,0,W,H);
  const sky=g.createLinearGradient(0,box.t,0,box.t+box.h); sky.addColorStop(0,'#0c1219'); sky.addColorStop(0.6,'#141f29'); sky.addColorStop(1,'#1b2834'); g.fillStyle=sky; g.fillRect(box.l,box.t,box.w,box.h);
  const lab=S.lay.lab, sm=narrow()?9.5:11;
  // altitude grid
  [[5000,'5,000'],[10000,'10,000'],[20000,'FL200'],[30000,'FL300'],[40000,'FL400']].forEach(([z,s])=>{ const y=Y(z); dline(g,box.l,y,box.l+box.w,y,'rgba(255,255,255,.05)',1); txt(g,s,box.l-5,y+3.5,{mono:1,size:narrow()?8.5:10,col:INK.dim,al:'right'}); });
  txt(g,'ft',box.l-5,box.t+box.h-2,{mono:1,size:9,col:INK.dim,al:'right'});
  g.save(); g.beginPath(); g.rect(box.l,box.t,box.w,box.h); g.clip();
  // up/down drafts (lee side), light shading
  if(S.lay.wave&&S.lay.w&&(WP.wave||WP.rotor)) field(g,0,RIDGE_U-0.03,1,0,20000,150,60,(u,z,o)=>{ if(z<terr(u)) return; const w=wAt(u,z), a=clamp((Math.abs(w)-200)/1800,0,1)*0.3*clamp((20000-z)/3000,0,1); if(a<=0) return; if(w<0){ o[0]=236; o[1]=90; o[2]=71; } else { o[0]=93; o[1]=169; o[2]=233; } o[3]=Math.round(a*255); });
  // icing band between 0 and −20 °C
  if(S.lay.ice){ const T=temp; for(let y=box.t;y<box.t+box.h;y+=3){ const z=Zof(y+1.5), t=T(z); if(t<=0&&t>=-20){ g.fillStyle='rgba(127,203,232,.06)'; g.fillRect(box.l,y,box.w*0.45,3); } } }
  // jet stream: CAT zones, isotachs, tropopause, core
  if(S.lay.jet){ field(g,1,JET_U-0.4,1,21000,ZMAX,110,70,(u,z,o)=>{ const sh=shearAt(u,z); if(sh<3.5) return; const a=clamp((sh-3.5)/7,0,1); if(sh<9){ o[0]=240; o[1]=180; o[2]=64; } else { o[0]=236; o[1]=110; o[2]=71; } o[3]=Math.round((0.08+0.32*a)*255); });
    // isotachs: contours of the Gaussian core (background speed at the core level)
    const vb=40, cx=X(JET_U), cy=Y(JET_Z); g.lineWidth=1.1;
    [60,80,100,120,140,160,180].forEach(v=>{ const lbl=v===60||v===100||v===140||v===180; if(v>=S.jet+vb-4) return; const r=Math.sqrt(Math.log(S.jet/(v-vb))); if(!(r>0)) return;
      g.strokeStyle='rgba(185,166,240,.55)'; g.setLineDash([]); g.beginPath();
      for(let i=0;i<=72;i++){ const a=i/72*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a), du=(ca<0?0.10:0.20)*r*ca, dz=(sa>0?11000:14000)*r*sa; const px=X(JET_U+du), py=Y(JET_Z+dz); i?g.lineTo(px,py):g.moveTo(px,py); } g.stroke();
      if(lab&&lbl&&!narrow()){ const py=Y(JET_Z-14000*r); txt(g,v+' kt',cx,py-3,{mono:1,size:9,col:'rgba(185,166,240,.85)',al:'center'}); } });
    g.strokeStyle='rgba(238,243,247,.45)'; g.setLineDash([6,4]); g.lineWidth=1.3; g.beginPath(); for(let u=JET_U-0.36;u<=1.0001;u+=0.005){ const px=X(u), py=Y(tropo(u)); u===JET_U-0.36?g.moveTo(px,py):g.lineTo(px,py); } g.stroke(); g.setLineDash([]);
    if(S.jet>=60){ g.fillStyle='rgba(185,166,240,.25)'; g.beginPath(); g.arc(cx,cy,narrow()?7:9,0,Math.PI*2); g.fill(); g.strokeStyle=INK.violet; g.lineWidth=1.6; g.stroke();
      const q=narrow()?4.5:6; g.beginPath(); g.moveTo(cx-q,cy-q); g.lineTo(cx+q,cy+q); g.moveTo(cx+q,cy-q); g.lineTo(cx-q,cy+q); g.stroke(); }
    if(lab){ txt(g,L(t2('Tropopause','Tropopausen')),X(JET_U-0.33),Y(30000)-5,{size:sm,col:'rgba(238,243,247,.7)',w:500});
      if(S.jet>=60) txt(g,L(t2(`Jet core ${S.jet} kt`,`Jetkjerne ${S.jet} kt`)),narrow()?cx-12:cx+12,cy-12,{size:sm,col:INK.violet,al:narrow()?'right':'left',bg:BGL});
      if(!narrow()){ txt(g,L(t2('polar (cold) side','polar (kald) side')),X(JET_U-0.22),Y(23500),{size:10,col:INK.dim,al:'center',w:500}); txt(g,L(t2('tropical (warm) side','tropisk (varm) side')),Math.min(X(0.97),X(JET_U+0.12)),Y(23500),{size:10,col:INK.dim,al:'center',w:500}); }
      const cz=Y(JET_Z-14000*0.95); if(S.jet>=90) txt(g,'CAT',X(JET_U-0.07),cz+4,{size:sm,col:INK.amber,al:'center',bg:BGL}); } }
  // mountain-wave streamlines (built as Path2D for the animated flow)
  FLOW.length=0;
  if(S.lay.wave){ const lv=[1500,3500,6000,8500,11000,13500,16500,19500]; lv.forEach(z0=>{ const p=new Path2D(); let first=true; for(let x=X(0.40);x<=box.l+box.w;x+=3){ const u=Uof(x), z=Math.max(terr(u)+250,z0+eta(u,z0)); const y=Y(z); if(first){ p.moveTo(x,y); first=false; } else p.lineTo(x,y); } FLOW.push(p); });
    g.strokeStyle='rgba(215,225,230,.16)'; g.lineWidth=1; FLOW.forEach(p=>g.stroke(p));
    // lenticulars at the crests (moist layer about 12–15,000 ft)
    if(WP.wave&&S.stab==='stable'){ for(let n=0;n<3;n++){ const d=WP.lu*(0.5+n), u=RIDGE_U+d; if(u>0.97) break; g.globalAlpha=1-n*0.25; const z=13500+eta(u,13500)*0.6, x=X(u), y=Y(z), rw=Math.max(12,WP.lu*box.w*0.36), rh=Math.max(3,rw*0.13);
        const gr=g.createLinearGradient(0,y-rh,0,y+rh); gr.addColorStop(0,'rgba(240,245,250,.85)'); gr.addColorStop(1,'rgba(170,185,200,.55)'); g.fillStyle=gr; g.beginPath(); g.ellipse(x,y,rw,rh,0,0,Math.PI*2); g.fill(); g.beginPath(); g.ellipse(x,y-rh*1.7,rw*0.72,rh*0.8,0,0,Math.PI*2); g.fill(); } g.globalAlpha=1;
      if(lab&&WP.lu*box.w>14) txt(g,L(t2('lenticular','linsesky')),X(RIDGE_U+WP.lu*0.5),Y(13500+eta(RIDGE_U+WP.lu*0.5,13500)*0.6)-10,{size:sm,col:INK.white,al:'center'}); }
    const rb=rotorBox(); if(rb&&S.lay.wave){ const x=X(rb.uc), y=Y(rb.zc), rx=rb.hu*box.w, ry=Math.abs(Y(rb.zc+rb.hz)-Y(rb.zc-rb.hz))/2;
      const r=rng(7); for(let i=0;i<14;i++){ const a=r()*Math.PI*2, k=Math.sqrt(r())*0.7; const px=x+Math.cos(a)*rx*k, py=y-ry*0.35+Math.sin(a)*ry*0.3*k, rr=Math.max(4,rx*0.32*(0.6+r()*0.6));
        const gr=g.createRadialGradient(px,py,0,px,py,rr); gr.addColorStop(0,'rgba(200,210,220,.35)'); gr.addColorStop(1,'rgba(200,210,220,0)'); g.fillStyle=gr; g.beginPath(); g.arc(px,py,rr,0,Math.PI*2); g.fill(); }
      g.strokeStyle='rgba(236,90,71,.9)'; g.lineWidth=1.6; g.beginPath(); g.ellipse(x,y,rx*0.7,ry*0.6,0,Math.PI*0.15,Math.PI*1.75); g.stroke();
      const ax=x+rx*0.7*Math.cos(Math.PI*1.75), ay=y+ry*0.6*Math.sin(Math.PI*1.75); g.fillStyle='rgba(236,90,71,.9)'; g.beginPath(); g.moveTo(ax+5,ay+1); g.lineTo(ax-3,ay-4); g.lineTo(ax-1,ay+5); g.fill();
      if(lab) txt(g,L(t2('rotor','rotor')),x,y+ry*0.6+14,{size:sm,col:INK.red,al:'center',bg:BGL}); }
    if(lab&&WP.wave&&S.stab==='stable') txt(g,L(t2('downdraft','fallvind')),X(RIDGE_U+0.045),Y(RIDGE_H+1800),{size:sm,col:'#ff9a8a',bg:BGL});
    if(lab) txt(g,L(t2(`wind ${S.wind} kt →`,`vind ${S.wind} kt →`)),X(0.41),Y(21500),{size:sm,col:INK.mute}); }
  // clouds (puffs coloured by temperature: cyan tint inside the icing band)
  if(S.lay.ice){ const r=rng(S.drop==='large'?3:S.drop==='sld'?5:11), n=S.drop==='large'?260:220; const c=CLD[S.drop];
    for(let i=0;i<n*5;i++){ const u=c.u0+r()*(S.drop==='large'?0.30:c.u1-c.u0), z=c.b+r()*(c.t-c.b+800); if(!cloudAt(u,z)) continue; const x=X(u), y=Y(z), T=temp(z), rr=(narrow()?5:7)+r()*(narrow()?6:9);
      const col=T>0?'222,228,234':T>=-20?'192,230,247':'206,216,232', sh=0.55+0.45*clamp((z-c.b)/2500,0,1); const gr=g.createRadialGradient(x,y-rr*0.3,0,x,y,rr); gr.addColorStop(0,`rgba(${col},${(0.3*sh).toFixed(3)})`); gr.addColorStop(1,`rgba(${col},0)`); g.fillStyle=gr; g.beginPath(); g.arc(x,y,rr,0,Math.PI*2); g.fill(); }
    if(lab){ const cname=S.drop==='large'?t2('cumulus (heap cloud)','cumulus (haugsky)'):S.drop==='sld'?t2('nimbostratus','nimbostratus'):t2('stratocumulus (layer cloud)','stratocumulus (lagsky)'); let yn=Y(S.drop==='large'?c.t:c.t+600)-8; /* keep clear of the isotherm labels at the left */ for(const z of [...(R.fz||[]),...(R.m20||[])]){ const yi=Y(z)-5; if(Math.abs(yi-yn)<16) yn=yi-18; } txt(g,L(cname),X((c.u0+c.u1)/2),yn,{size:sm,col:INK.white,al:'center'});
    } }
  // isotherms
  if(S.lay.ice){ const iso=(arr,col,label)=>arr.forEach(z=>{ const y=Y(z); dline(g,box.l,y,box.l+box.w,y,col,1.2,[7,5]); if(lab) txt(g,label+' · '+nf(Math.round(z/100)*100,0)+' ft',box.l+6,y-5,{mono:1,size:narrow()?8.5:10,col,bg:BGL}); });
    iso(R.fz,'rgba(127,203,232,.9)','0 °C'); iso(R.m20,'rgba(127,203,232,.5)','−20 °C'); }
  // freezing rain column: snow above the warm layer, rain in it, supercooled rain below
  RAIN.liq=RAIN.fz=RAIN.sn=null;
  if(S.lay.ice&&S.drop==='sld'){ const c=CLD.sld, pl=new Path2D(), pf=new Path2D(), ps=new Path2D(); const r=rng(9);
    for(let i=0;i<48;i++){ const u=c.u0+0.02+r()*(c.u1-c.u0-0.04), x=X(u); let prev=Y(c.b), kind=null;
      for(let z=c.b;z>=terr(u);z-=150){ const t=temp(z), k=t>0?'l':(z>5000?'s':'f'), y=Y(z); if(k!==kind){ kind=k; } const p=k==='l'?pl:k==='s'?ps:pf; p.moveTo(x-0.5,prev); p.lineTo(x-1.5,y); prev=y; } }
    RAIN.liq=pl; RAIN.fz=pf; RAIN.sn=ps;
    g.lineWidth=1; g.strokeStyle='rgba(93,169,233,.18)'; g.stroke(pl); g.strokeStyle='rgba(159,227,255,.22)'; g.stroke(pf);
    if(lab){ const wz=(()=>{ let z0=null; for(let z=0;z<9000;z+=100){ if(temp(z)>0){ z0=z; break; } } return z0; })(); const xx=X(c.u1)+8;
      if(wz!=null){ txt(g,L(t2('warm layer (above 0 °C): rain','varmt lag (over 0 °C): regn')),xx,Y(wz+800),{size:10.5,col:INK.blue,bg:narrow()?BGL:null}); }
      txt(g,L(t2('freezing rain','underkjølt regn')),xx,Y(1500),{size:10.5,col:INK.ice,bg:BGL}); } }
  // terrain
  const tg=g.createLinearGradient(0,Y(RIDGE_H),0,box.t+box.h); tg.addColorStop(0,'#3a4752'); tg.addColorStop(1,'#1d262e'); g.fillStyle=tg; g.beginPath(); g.moveTo(box.l,box.t+box.h);
  for(let x=box.l;x<=box.l+box.w;x+=2) g.lineTo(x,Y(terr(Uof(x)))); g.lineTo(box.l+box.w,box.t+box.h); g.closePath(); g.fill();
  g.save(); g.beginPath(); for(let x=box.l;x<=box.l+box.w;x+=2) x===box.l?g.moveTo(x,Y(terr(Uof(x)))):g.lineTo(x,Y(terr(Uof(x)))); g.lineTo(box.l+box.w,Y(4300)); g.lineTo(box.l,Y(4300)); g.closePath(); g.clip();
  g.fillStyle='rgba(235,242,247,.55)'; g.fillRect(box.l,0,box.w,Y(4300)); g.restore();
  if(lab) txt(g,L(t2('ridge 6,000 ft','fjellrygg 6000 ft')),X(RIDGE_U),Y(RIDGE_H)-8,{size:sm,col:INK.mute,al:'center'});
  g.restore();
  // frame
  g.strokeStyle=INK.rule; g.lineWidth=1; g.strokeRect(box.l+0.5,box.t+0.5,box.w-1,box.h-1);
  if(!narrow()) txt(g,L(t2('schematic, not to horizontal scale','skjematisk, ikke i horisontal skala')),box.l+box.w-6,box.t+box.h-6,{mono:1,size:9.5,col:INK.dim,al:'right'});
}

/* ---------------- the aircraft (side view, small) ---------------- */
const ACP=(()=>{ const p=new Path2D(); p.moveTo(14,0); p.bezierCurveTo(13,-2.2,9,-2.6,6,-2.6); p.lineTo(-9,-2.4); p.lineTo(-13,-8); p.lineTo(-15.5,-8); p.lineTo(-14,-1.5); p.lineTo(-15,1); p.lineTo(-9,2.1); p.lineTo(8,2.4); p.bezierCurveTo(12,2.2,14,1.2,14,0); p.closePath(); return p; })();
const ACW=(()=>{ const p=new Path2D(); p.moveTo(3,0.5); p.lineTo(-4,0.8); p.lineTo(-7,5.5); p.lineTo(-4.5,5.5); p.closePath(); return p; })();
function aircraft(g,x,y,k){ g.save(); g.translate(x,y); g.scale(k,k); g.fillStyle='#EEF3F7'; g.fill(ACP); g.fillStyle='#9AA8B3'; g.fill(ACW); g.strokeStyle='rgba(10,16,22,.8)'; g.lineWidth=0.7/k*1.4; g.stroke(ACP); g.restore(); }

/* ---------------- wing section ---------------- */
const AF=(()=>{ // NACA 2412 coordinates, LE at (0,0), chord 1; upper TE → LE → lower TE
  const n=70, m=0.02, p=0.4, t=0.12, up=[], lo=[];
  for(let i=0;i<=n;i++){ const b=i/n*Math.PI, x=(1-Math.cos(b))/2; const yt=5*t*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x*x*x-0.1036*x*x*x*x);
    const yc=x<p?m/(p*p)*(2*p*x-x*x):m/((1-p)*(1-p))*((1-2*p)+2*p*x-x*x), dy=x<p?2*m/(p*p)*(p-x):2*m/((1-p)*(1-p))*(p-x), th=Math.atan(dy);
    up.push([x-yt*Math.sin(th),yc+yt*Math.cos(th)]); lo.push([x+yt*Math.sin(th),yc-yt*Math.cos(th)]); }
  const pts=up.slice().reverse().concat(lo.slice(1)); const s=[0]; for(let i=1;i<pts.length;i++) s.push(s[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const iLE=n; const sLE=s[iLE]; const nrm=pts.map((q,i)=>{ const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)], dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1; return [dy/l,-dx/l]; });
  return {pts,s:s.map(v=>v-sLE),nrm}; })();
// ice thickness profile along the surface (s = arc length from the LE in chords, + = upper surface)
function iceH(s,type,T,prot){ const w={rime:0.022,mixed:0.03,clear:0.035,sld:0.05}[type]||0.03; const g=v=>Math.exp(-v*v);
  if(type==='rime') return T*g(s/w);
  if(type==='clear') return T*(0.4*g(s/w)+0.95*g((s-0.65*w)/(0.32*w))+0.8*g((s+0.6*w)/(0.32*w)));
  if(type==='mixed') return T*(0.7*g(s/w)+0.5*g((s-0.55*w)/(0.4*w))+0.35*g((s+0.5*w)/(0.4*w)));
  if(type==='sld') return (prot?0:T*0.55*g(s/w))+T*0.75*g((s-0.085)/0.012)+T*0.4*g((s+0.06)/0.012);
  return 0; }
let WB=null; // cached wing layout + paths
function buildWing(g,W,H){
  g.fillStyle=INK.bg; g.fillRect(0,0,W,H);
  const wide=W>=560, ar={x:wide?16:10,y:14,w:wide?W*0.6-16:W-20,h:wide?H-28:H*0.56-14};
  const ch={x:wide?W*0.62+10:46,y:wide?28:H*0.6+18,w:wide?W*0.38-28:W-60,h:wide?H-74:H*0.4-52};
  const c=ar.w*1.3, ox=ar.x+ar.w*0.16, oy=ar.y+ar.h*0.5, al=4*Math.PI/180; // 4° angle of attack
  const P=(x,y)=>[ox+c*(x*Math.cos(al)+y*Math.sin(al)), oy-c*(-x*Math.sin(al)+y*Math.cos(al))];
  WB={ar,ch,c,P}; g.save(); g.beginPath(); g.rect(ar.x-6,ar.y,ar.w+6,ar.h); g.clip();
  // airflow / drop trajectories (the dashes move: drops)
  const ic=R.ic, sz=ic.type==='sld'?0.06:S.drop==='large'?0.035:0.016, lines=[], hits=[], full=[];
  const yAt=(x,y0)=>y0+Math.sign(y0||1)*0.07*Math.exp(-Math.abs(y0)/0.1)*(x<0.03?Math.exp(-Math.pow((x-0.03)/0.14,2)):Math.exp(-Math.pow((x-0.03)/0.45,2)));
  for(let k=-9;k<=9;k++){ const y0=k*0.016+0.004, hit=Math.abs(y0)<sz, p=new Path2D(), f=new Path2D(); let first=true;
    for(let x=-0.5;x<=1.2;x+=0.008){ if(hit&&x>-0.006+Math.abs(y0)*0.5) break; const y=hit?y0:yAt(x,y0), q=P(x,y);
      if(first){ f.moveTo(q[0],q[1]); if(x<0.02) p.moveTo(q[0],q[1]); first=false; } else { f.lineTo(q[0],q[1]); if(x<0.02) p.lineTo(q[0],q[1]); } }
    (hit?hits:lines).push(p); full.push(f); }
  WB.lines=lines; WB.hits=hits;
  g.lineWidth=1; g.strokeStyle='rgba(215,225,230,.10)'; full.forEach(p=>g.stroke(p));
  // the wing
  const wp=new Path2D(); AF.pts.forEach((q,i)=>{ const r=P(q[0],q[1]); i?wp.lineTo(r[0],r[1]):wp.moveTo(r[0],r[1]); }); wp.closePath();
  const gr=g.createLinearGradient(0,oy-c*0.08,0,oy+c*0.06); gr.addColorStop(0,'#E9EEF2'); gr.addColorStop(1,'#8C9AA6'); g.fillStyle=gr; g.fill(wp); g.strokeStyle='rgba(30,44,56,.8)'; g.lineWidth=1; g.stroke(wp);
  // protected area (boot / heated zone)
  { const pp=new Path2D(); let f=true; AF.pts.forEach((q,i)=>{ if(Math.abs(AF.s[i])>0.07) return; const r=P(q[0],q[1]); f?pp.moveTo(r[0],r[1]):pp.lineTo(r[0],r[1]); f=false; });
    g.strokeStyle=S.prot==='on'?'rgba(113,204,147,.95)':'rgba(139,153,167,.6)'; g.lineWidth=S.prot==='on'?4:3; g.stroke(pp); }
  // ice (thickness drawn ×3)
  const wi=R.wi, T=wi.thk/1000/1.5*3; // chord 1.5 m
  if(wi.thk>0){ const out=[]; AF.pts.forEach((q,i)=>{ const h=iceH(AF.s[i],wi.type,T,wi.prot); if(h<1e-5) return; out.push([q[0]+AF.nrm[i][0]*h,q[1]+AF.nrm[i][1]*h,i]); });
    if(out.length>2){ const ip=new Path2D(); out.forEach((q,k)=>{ const r=P(q[0],q[1]); k?ip.lineTo(r[0],r[1]):ip.moveTo(r[0],r[1]); }); for(let k=out.length-1;k>=0;k--){ const q=AF.pts[out[k][2]], r=P(q[0],q[1]); ip.lineTo(r[0],r[1]); } ip.closePath();
      const clear=wi.type==='clear'||wi.type==='sld'; g.fillStyle=clear?'rgba(170,225,255,.5)':wi.type==='mixed'?'rgba(215,236,248,.72)':'rgba(240,246,250,.92)'; g.fill(ip);
      g.strokeStyle=clear?'rgba(200,240,255,.95)':'rgba(255,255,255,.95)'; g.lineWidth=1; g.stroke(ip);
      if(wi.type==='rime'){ const r=rng(4); g.fillStyle='rgba(150,170,185,.35)'; for(let k=0;k<out.length;k+=2){ const q=out[k], rr=P(q[0],q[1]); g.fillRect(rr[0]-1+r()*2,rr[1]-1+r()*2,1.2,1.2); } } } }
  // labels on the wing view
  const sm=narrow()?10:11.5;
  if(wi.thk>0){ const q=P(-0.02,0.07); txt(g,L(TYP[wi.type]).replace(/^./,c=>c.toUpperCase())+' · '+nf(wi.thk,0)+' mm',q[0],q[1]-6,{size:sm+1,col:wi.type==='rime'?INK.white:INK.ice}); }
  else { const q=P(0.2,0.16); txt(g,L(R.ic.type==='none'?t2('No ice: put the aircraft in cloud below 0 °C','Ingen is: legg flyet i sky under 0 °C'):S.tmin===0?t2('No time in the icing yet','Ingen tid i isingen ennå'):t2('Ice protection keeps the leading edge clean','Isbeskyttelsen holder forkanten ren')),q[0],q[1],{size:sm,col:INK.mute}); }
  { const q=P(0.08,-0.09); txt(g,L(S.prot==='on'?t2('ice protection on','isbeskyttelse på'):t2('ice protection off','isbeskyttelse av')),q[0],q[1]+14,{size:narrow()?9:10,col:S.prot==='on'?INK.green:INK.dim}); }
  { const fx=ar.x+ar.w, fg=g.createLinearGradient(fx-60,0,fx,0); fg.addColorStop(0,'rgba(16,23,29,0)'); fg.addColorStop(1,INK.bg); g.fillStyle=fg; g.fillRect(fx-60,ar.y,62,ar.h); }
  g.restore(); txt(g,L(t2('Leading edge close-up · drops arrive from the left · ice drawn ×3','Forkanten i nærbilde · dråpene kommer fra venstre · isen tegnet ×3')),ar.x,ar.y+ar.h,{mono:1,size:narrow()?8.5:9.5,col:INK.dim});
  // CL–α chart
  const xr=[0,22], yr=[0,1.8]; const cx=v=>ch.x+v/xr[1]*ch.w, cy=v=>ch.y+ch.h-v/yr[1]*ch.h;
  g.strokeStyle=INK.grid; g.lineWidth=1; [0,5,10,15,20].forEach(v=>{ dline(g,cx(v),ch.y,cx(v),ch.y+ch.h,INK.grid,1); txt(g,v+'°',cx(v),ch.y+ch.h+13,{mono:1,size:9.5,col:INK.mute,al:'center'}); });
  [0,0.5,1,1.5].forEach(v=>{ dline(g,ch.x,cy(v),ch.x+ch.w,cy(v),INK.grid,1); txt(g,nf(v,1),ch.x-5,cy(v)+3.5,{mono:1,size:9.5,col:INK.mute,al:'right'}); });
  g.strokeStyle=INK.rule; g.strokeRect(ch.x+0.5,ch.y+0.5,ch.w,ch.h);
  txt(g,L(t2('Lift coefficient CL','Løftekoeffisient CL')),ch.x,ch.y-8,{size:11,col:INK.ink,w:600}); txt(g,L(t2('angle of attack α','angrepsvinkel α')),ch.x+ch.w,ch.y+ch.h+27,{size:10,col:INK.mute,al:'right'});
  const curve=(CLm,as)=>{ const s=(CLm-0.25)/(as-2.5), lin=a=>0.25+s*a, sm2=(a,b)=>(a+b-Math.sqrt((a-b)*(a-b)+0.04))/2, top=sm2(lin(as),CLm); return a=>a<=as?sm2(lin(a),CLm):top-0.03*Math.pow(a-as,1.5); };
  const cc=curve(1.55,16), ci=curve(1.55*(1-wi.loss),wi.as);
  // stall warning (set for the clean wing)
  dline(g,cx(14),ch.y,cx(14),ch.y+ch.h,'rgba(240,180,64,.6)',1,[4,4]); txt(g,L(t2('stall warning','steilevarsel')),cx(14)-3,ch.y+12,{size:9.5,col:INK.amber,al:'right'});
  const plot=(f,col,w,dash)=>{ g.strokeStyle=col; g.lineWidth=w; g.setLineDash(dash||NODASH); g.beginPath(); for(let a=0;a<=22;a+=0.25){ const px=cx(a), py=cy(Math.max(0,f(a))); a?g.lineTo(px,py):g.moveTo(px,py); } g.stroke(); g.setLineDash(NODASH); };
  plot(cc,INK.cyan,2); if(wi.thk>0) plot(ci,INK.red,2.2);
  const dot=(a,v,col)=>{ g.fillStyle=col; g.beginPath(); g.arc(cx(a),cy(v),3.5,0,Math.PI*2); g.fill(); };
  dot(16,cc(16),INK.cyan); txt(g,L(t2('clean','ren')),cx(16)+5,cy(cc(16))-6,{size:10.5,col:INK.cyan});
  if(wi.thk>0){ dot(wi.as,ci(wi.as),INK.red); txt(g,L(t2('iced','iset')),cx(wi.as)+5,cy(ci(wi.as))+14,{size:10.5,col:INK.red});
    if(wi.as<14) txt(g,L(t2('stalls before the warning','steiler før varselet')),cx(wi.as)+4,ch.y+ch.h-8,{size:10,col:INK.red,al:narrow()?'center':'right',bg:BGL}); }
}

/* ---------------- frame loop ---------------- */
let raf=0, vis=false, tA=0, last=0;
function rebuild(){ if(!st||!st.w) return; const W=st.w, H=st.h, d=st.dpr; if(bg.width!==Math.round(W*d)||bg.height!==Math.round(H*d)){ bg.width=Math.round(W*d); bg.height=Math.round(H*d); }
  bgc.setTransform(d,0,0,d,0,0); if(S.tab==='xs') buildXS(bgc,W,H); else buildWing(bgc,W,H); bw=W; bh=H; dirty=false; }
function frame(){ if(!st||!st.w) return; if(dirty||bw!==st.w||bh!==st.h) rebuild(); const g=st.ctx; g.setTransform(1,0,0,1,0,0); g.drawImage(bg,0,0); g.setTransform(st.dpr,0,0,st.dpr,0,0);
  const t=tA;
  if(S.tab==='xs'){ g.lineCap='round';
    if(FLOW.length){ g.strokeStyle='rgba(230,238,244,.55)'; g.lineWidth=1.3; g.setLineDash(DASH_FLOW); g.lineDashOffset=-t*(8+S.wind*0.6); for(let i=0;i<FLOW.length;i++) g.stroke(FLOW[i]); }
    if(RAIN.liq){ g.setLineDash(DASH_RAIN); g.lineDashOffset=-t*60; g.lineWidth=1.2; g.strokeStyle='rgba(93,169,233,.75)'; g.stroke(RAIN.liq); g.strokeStyle='rgba(159,227,255,.95)'; g.stroke(RAIN.fz); g.setLineDash(DASH_DOT); g.lineWidth=2.4; g.lineDashOffset=-t*20; g.strokeStyle='rgba(240,246,250,.8)'; g.stroke(RAIN.sn); }
    g.setLineDash(NODASH); g.lineCap='butt';
    // aircraft with a ring coloured by the worst hazard
    const x=X(S.u), y=Y(S.alt), k=narrow()?0.95:1.2, hz=RANK[R.tb.int]>=2||R.ic.int==='sev'?INK.red:R.ic.type!=='none'||R.tb.int==='light'?INK.amber:INK.green;
    g.strokeStyle=hz; g.lineWidth=1.6; g.beginPath(); g.arc(x,y,17*k,0,Math.PI*2); g.stroke();
    const bob=R.tb.int==='sev'?2.2:R.tb.int==='mod'?1.2:R.tb.int==='light'?0.5:0; aircraft(g,x,y+(reduce?0:Math.sin(t*23)*bob+Math.sin(t*37)*bob*0.5),k); }
  else if(WB){ g.lineCap='round'; g.setLineDash(DASH_DOT); g.lineWidth=S.drop==='small'?2:3; g.lineDashOffset=-t*40;
    g.strokeStyle='rgba(159,227,255,.85)'; for(let i=0;i<WB.hits.length;i++) g.stroke(WB.hits[i]); g.strokeStyle='rgba(200,214,226,.35)'; for(let i=0;i<WB.lines.length;i++) g.stroke(WB.lines[i]);
    g.setLineDash(NODASH); g.lineCap='butt'; }
}
function tick(ts){ raf=0; const dt=Math.min(0.05,(ts-(last||ts))/1000); last=ts; tA+=dt; frame(); if(vis&&!reduce) raf=requestAnimationFrame(tick); }
st=LAB.fit(cv,()=>{ dirty=true; frame(); });
LAB.visible(cv,v=>{ vis=v; if(v&&!raf&&!reduce){ last=0; raf=requestAnimationFrame(tick); } });
cv.addEventListener('click',e=>{ if(S.tab!=='xs') return; const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top; const z=Math.round(Zof(y)/100)*100, u=Uof(x);
  S.u=clamp(Math.round(u*200)/200,0,1); S.alt=clamp(Math.max(z,Math.ceil((terr(S.u)+500)/100)*100),0,42000); cur=null; all(); });

/* ---------------- controls ---------------- */
const fmtT=v=>(v>0?'+':v<0?'−':'')+nf(Math.abs(v),0)+' °C';
const SL={
  alt:LAB.slider(el('ctlA'),{id:'sAlt',label:'Altitude (ft)',min:0,max:42000,step:500,v:S.alt,f:v=>v>=18000?'FL'+String(Math.round(v/100)).padStart(3,'0'):nf(v,0)+' ft',on:v=>{ S.alt=Math.max(v,Math.ceil((terr(S.u)+500)/100)*100); cur=null; all(); }}),
  u:LAB.slider(el('ctlA'),{id:'sU',label:'Position along the section (%)',min:0,max:100,step:1,v:S.u*100,f:v=>nf(v,0)+' %',on:v=>{ S.u=v/100; if(S.alt<terr(S.u)+500) S.alt=Math.ceil((terr(S.u)+500)/100)*100; cur=null; all(); }}),
  t0:LAB.slider(el('ctlI'),{id:'sT0',label:'Surface temperature (°C)',min:-10,max:20,step:1,v:S.t0,f:fmtT,on:v=>{ S.t0=v; cur=null; all(); }}),
  tm:LAB.slider(el('ctlI'),{id:'sTm',label:'Time in this icing (min)',min:0,max:30,step:1,v:S.tmin,f:v=>nf(v,0)+' min',on:v=>{ S.tmin=v; cur=null; all(); }}),
  wind:LAB.slider(el('ctlW'),{id:'sWind',label:'Wind at ridge top (kt)',min:0,max:70,step:1,v:S.wind,f:v=>nf(v,0)+' kt',on:v=>{ S.wind=v; cur=null; all(); }}),
  jet:LAB.slider(el('ctlX'),{id:'sJet',label:'Jet core speed (kt)',min:40,max:200,step:5,v:S.jet,f:v=>nf(v,0)+' kt',on:v=>{ S.jet=v; cur=null; all(); }})};
const DROPS_SEG=[['small',t2('Small drops','Små dråper')],['large',t2('Large drops','Store dråper')],['sld',t2('Freezing rain','Underkjølt regn')]];
const STAB=[['stable',t2('Stable','Stabil')],['neutral',t2('Neutral','Nøytral')],['unstable',t2('Unstable','Ustabil')]];
const PROT=[['off',t2('Off','Av')],['on',t2('On','På')]];
function segL(box,items,get,set){ box.classList.add('seg'); const draw=()=>{ box.innerHTML=items.map(([k,t])=>`<button type="button" data-v="${k}" class="${get()===k?'on':''}" aria-pressed="${get()===k}">${L(t)}</button>`).join(''); };
  box.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; set(b.dataset.v); cur=null; all(); }); on(draw); return draw; }
const segs=[segL(el('sDrop'),DROPS_SEG,()=>S.drop,v=>{ S.drop=v; }),segL(el('sStab'),STAB,()=>S.stab,v=>{ S.stab=v; }),segL(el('sProt'),PROT,()=>S.prot,v=>{ S.prot=v; })];
const LAY=[['ice',t2('Cloud and icing','Sky og ising')],['wave',t2('Mountain wave','Fjellbølge')],['w',t2('Up- and downdrafts','Opp- og nedvinder')],['jet',t2('Jet stream and CAT','Jetstrøm og CAT')],['lab',t2('Labels','Etiketter')]];
function drawLay(){ el('lay').innerHTML=LAY.map(([k,t])=>`<button type="button" class="xtog${S.lay[k]?' on':''}" aria-pressed="${S.lay[k]}" data-k="${k}">${L(t)}</button>`).join(''); }
el('lay').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; S.lay[b.dataset.k]=!S.lay[b.dataset.k]; drawLay(); dirty=true; frame(); legend(); });
on(drawLay);
const TABS=[['xs',t2('Cross-section','Tverrsnitt')],['wing',t2('Ice on the wing','Is på vingen')]];
function drawTabs(){ el('vTabs').innerHTML=TABS.map(([k,t])=>`<button type="button" role="tab" aria-selected="${S.tab===k}" class="${S.tab===k?'on':''}" data-t="${k}">${L(t)}</button>`).join(''); }
el('vTabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; setTab(b.dataset.t); });
function setTab(k){ S.tab=k; drawTabs(); dirty=true; frame(); read(); legend(); }
on(drawTabs);

/* scenarios */
const firstCrest=()=>{ const w=waveP(); return clamp(RIDGE_U+w.lu*0.5,0.52,0.9); };
const PRE=[
 ['rime',t2('Rime: layer cloud, −14 °C','Rimis: lagsky, −14 °C'),()=>({drop:'small',t0:4,alt:9000,u:0.22,tmin:15,prot:'off'})],
 ['clear',t2('Clear: cumulus, −6 °C','Klaris: cumulus, −6 °C'),()=>({drop:'large',t0:8,alt:7000,u:0.23,tmin:10,prot:'off'})],
 ['fzra',t2('Freezing rain under a warm front','Underkjølt regn under en varmfront'),()=>({drop:'sld',t0:-4,alt:2000,u:0.22,tmin:5,prot:'off'})],
 ['wave',t2('Strong wave and rotor','Kraftig bølge og rotor'),()=>{ const o={stab:'stable',wind:50}; Object.assign(S,o); return Object.assign(o,{alt:3500,u:firstCrest()}); }],
 ['cat',t2('CAT below the jet core','CAT under jetkjernen'),()=>({jet:170,alt:26000,u:0.76})]];
let cur=null;
function drawPre(){ el('pre').innerHTML=PRE.map(([k,t])=>`<button class="btn sm${k===cur?' on':''}" type="button" data-k="${k}">${L(t)}</button>`).join(''); }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; preset(b.dataset.k); });
function preset(k,tab){ const p=PRE.find(x=>x[0]===k); if(!p) return; Object.assign(S,p[2]()); cur=k; if(tab) setTab(tab); all(); }

/* ---------------- readouts ---------------- */
const fpm=v=>(v>=0?'↑ ':'↓ ')+nf(Math.round(Math.abs(v)/50)*50,0)+' ft/min';
const altS=z=>z>=18000?'FL'+String(Math.round(z/100)).padStart(3,'0'):nf(z,0)+' ft';
const intCls=k=>k==='sev'?'bad':k==='mod'?'warn':'';
function read(){ const r=R, ic=r.ic, wi=r.wi, tb=r.tb;
  const H=(k,v,c)=>`<span><i>${k}</i><b${c?` class="${c}"`:''}>${v}</b></span>`;
  const icS=ic.type==='none'?L(t2('none','ingen')):L(INT[ic.int])+' '+L(TYS[ic.type]);
  if(S.tab==='xs') el('hzChip').innerHTML=H(L(t2('Altitude','Høyde')),altS(S.alt))+H('OAT',fmtT(ic.T))+H(L(t2('Icing','Ising')),icS,ic.int==='sev'?'r':ic.type!=='none'?'a':'')+H(L(t2('Turbulence','Turbulens')),L(INT[tb.int]),tb.int==='sev'?'r':tb.int==='mod'?'a':'')+(Math.abs(tb.w)>=200?H(L(t2('Vertical air','Vertikal luft')),fpm(tb.w),tb.w<-800?'r':''):'');
  else el('hzChip').innerHTML=H(L(t2('Ice','Is')),wi.thk>0?L(TYS[wi.type])+' '+nf(wi.thk,0)+' mm':L(t2('none','ingen')))+H('CL max',wi.thk>0?'−'+nf(wi.loss*100,0)+' %':'–',wi.loss>0.25?'r':wi.loss>0?'a':'')+H(L(t2('Stall α','Steile-α')),nf(wi.as,1)+'°',wi.as<14?'r':'')+H('VS',wi.thk>0?'+'+nf(wi.vs,0)+' %':'–',wi.vs>10?'r':'')+H(L(t2('Drag','Motstand')),wi.thk>0?'+'+nf(wi.drag,0)+' %':'–');
  const rr=(k,v,c)=>`<div class="rrow"><span>${L(k)}</span><b class="${c||''}">${v}</b></div>`;
  const where=ic.inR?t2('in freezing rain below the cloud','i underkjølt regn under skyen'):ic.inC?t2('in cloud','i sky'):t2('in clear air','i klar luft');
  el('rIce').innerHTML=rr(t2('Where','Hvor'),L(where))+rr(t2('Air temperature','Lufttemperatur'),fmtT(ic.T))+rr(t2('Ice type','Istype'),L(TYP[ic.type]),ic.type==='sld'?'bad':'')+rr(t2('Intensity','Intensitet'),L(INT[ic.int]),intCls(ic.int))+
    (wi.thk>0?rr(t2(`After ${S.tmin} min`,`Etter ${S.tmin} min`),nf(wi.thk,0)+' mm · CL max −'+nf(wi.loss*100,0)+' %',wi.loss>0.25?'bad':'warn')+rr(t2('Stall speed','Steilefart'),'+'+nf(wi.vs,0)+' %',wi.vs>10?'bad':'warn'):'')+
    (ic.why&&WHY[ic.why]?`<p class="hint" style="margin:6px 0 0">${L(WHY[ic.why])}</p>`:'');
  el('rTurb').innerHTML=rr(t2('Cause','Årsak'),L(CAUSE[tb.cause]))+rr(t2('Intensity','Intensitet'),L(INT[tb.int]),intCls(tb.int))+rr(t2('Vertical air motion','Vertikal luftbevegelse'),Math.abs(tb.w)<200?L(t2('small','liten')):fpm(tb.w),tb.w<-1000?'bad':'')+
    (tb.V!=null?rr(t2('Wind / vertical shear','Vind / vertikalt vindskjær'),nf(tb.V,0)+' kt · '+nf(tb.sh,1)+' kt/1000 ft',tb.sh>=6?'warn':''):'')+
    (WP.wave?rr(t2('Lee wavelength','Bølgelengde på lesiden'),nf(WP.lam,0)+' km'):'');
  el('dropHint').textContent=L(S.drop==='small'?t2('Layer cloud (stratocumulus): small drops, little liquid water.','Lagsky (stratocumulus): små dråper, lite flytende vann.'):S.drop==='large'?t2('Heap cloud (cumulus): large drops, much liquid water.','Haugsky (cumulus): store dråper, mye flytende vann.'):t2('Rain from a warm layer aloft falls into sub-zero air.','Regn fra et varmt lag oppe faller ned i minusgrader.'));
  // warnings
  let w=''; if(S.drop==='sld'&&S.t0>=0) w=L(t2('Freezing rain needs sub-zero air under the warm layer: set the surface temperature below 0 °C.','Underkjølt regn krever minusgrader under det varme laget: sett bakketemperaturen under 0 °C.'));
  else if(ic.type==='sld') w=L(t2('Severe icing (SLD): the drops freeze behind the protected area. Leave the area now: climb into the warm layer or turn back.','Kraftig ising (SLD): dråpene fryser bak det beskyttede området. Forlat området nå: stig opp i det varme laget eller snu.'));
  else if(S.stab!=='stable'&&S.wind>=20) w=L(t2('No stable layer: no smooth waves, but mechanical turbulence over and behind the ridge.','Ikke noe stabilt lag: ingen jevne bølger, men mekanisk turbulens over og bak ryggen.'));
  el('warn').textContent=w;
  el('xsv').textContent=altS(S.alt)+' · '+fmtT(ic.T);
  see(); }
function see(){ el('hzSee').innerHTML='<b>'+L(t2('What you are seeing:','Dette ser du:'))+'</b> '+(S.tab==='xs'?
  L(t2('one section through the atmosphere. Left: cloud, tinted cyan where its drops are supercooled (0 to −20 °C). Middle: wind over a ridge makes waves; red shading is sinking air. Top right: the jet core (flow into the page) with lines of equal wind speed; amber is clear air turbulence. Tap anywhere to move the aircraft.','ett snitt gjennom atmosfæren. Til venstre: sky, farget blå der dråpene er underkjølte (0 til −20 °C). I midten: vind over en fjellrygg lager bølger; rød skygge er synkende luft. Øverst til høyre: jetkjernen (strømmer inn i bildet) med linjer for lik vindfart; gult er klarluftsturbulens. Trykk hvor som helst for å flytte flyet.')):
  L(t2('the wing section at your aircraft with the ice it has collected in the time you set. Small drops hit only the very front (narrow, white rime); large and freezing-rain drops reach further back and freeze slowly into horns or a ridge. The chart shows the lift curve, clean and iced. Compare with leading-edge contamination in the <a href="tunnel.html#profil">wind tunnel</a>.','vingeprofilet ved flyet med isen det har samlet i tiden du har valgt. Små dråper treffer bare helt foran (smal, hvit rimis); store dråper og underkjølt regn når lenger bak og fryser sakte til horn eller en rygg. Diagrammet viser løftekurven, ren og iset. Sammenlign med forurenset forkant i <a href="tunnel.html#profil">vindtunnelen</a>.'))); }
function legend(){ const lg=(c,t,cl)=>`<span><i class="${cl||''}" style="--c:${c}"></i>${L(t)}</span>`;
  el('hzLeg').innerHTML=S.tab==='xs'?
    lg('#9FE3FF',t2('supercooled cloud','underkjølt sky'),'a')+lg('#7FCBE8',t2('0 °C and −20 °C','0 °C og −20 °C'),'d')+lg('#D7E1E6',t2('airflow','luftstrøm'))+lg('#EC5A47',t2('sinking air','synkende luft'),'a')+lg('#5DA9E9',t2('rising air','stigende luft'),'a')+lg('#B9A6F0',t2('isotachs (kt)','isotaker (kt)'))+lg('#F0B440',t2('CAT: light → severe','CAT: lett → kraftig'),'a')
    :lg('#9FE3FF',t2('drops that hit the wing','dråper som treffer vingen'),'dot')+lg('#71CC93',t2('protected area','beskyttet område'))+lg('#7FCBE8',t2('clean lift curve','løftekurve ren'))+lg('#EC5A47',t2('iced lift curve','løftekurve iset'))+lg('#F0B440',t2('stall warning (set for a clean wing)','steilevarsel (satt for ren vinge)'),'d'); }
function syncCtl(){ SL.alt.set(S.alt); SL.u.set(Math.round(S.u*100)); SL.t0.set(S.t0); SL.tm.set(S.tmin); SL.wind.set(S.wind); SL.jet.set(S.jet); segs.forEach(f=>f()); }
function all(){ solve(); dirty=true; syncCtl(); drawPre(); read(); frame(); live(); }

/* ---------------- text ---------------- */
const KS=KCS.sv, KT=KCS.tx, KA=KCS.ar;
const goX=sel=>()=>{ const t=document.querySelector(sel); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); };
const KCI=[
 {k:'scw',t:t2('Supercooled water','Underkjølt vann'),d:t2('Cloud drops stay liquid well below 0 °C. They freeze the moment they hit the aircraft: that is airframe icing. No visible moisture, no ice.','Skydråper forblir flytende godt under 0 °C. De fryser i det de treffer flyet: det er ising. Ingen synlig fuktighet, ingen is.'),
  ill:()=>KS(`<circle cx="40" cy="30" r="5" fill="#9FE3FF"/><circle cx="62" cy="22" r="4" fill="#9FE3FF"/><circle cx="58" cy="42" r="6" fill="#9FE3FF"/>${KA(80,32,128,32,'#8B99A7')}<path d="M136,48 Q150,14 176,30 L190,34 L176,40 Q152,52 136,48Z" fill="#c9d2da"/><path d="M134,46 Q140,26 152,20" stroke="#EEF3F7" stroke-width="3" fill="none"/>${KT(40,58,'−8 °C','#9FE3FF')}`),click:()=>preset('rime','xs'),to:'#hzCv'},
 {k:'band',t:t2('The icing band','Isingsbåndet'),d:t2('Most icing is between 0 and −20 °C, the worst from 0 to −10 °C. Colder, the cloud is mostly ice crystals; below −40 °C there is no liquid water at all.','Mest ising skjer mellom 0 og −20 °C, verst fra 0 til −10 °C. Kaldere er skyen for det meste iskrystaller; under −40 °C finnes ikke flytende vann.'),
  dd:t2('Exception: in strong updrafts (CB) supercooled water is carried far above the −20 °C level.','Unntak: i kraftige oppvinder (CB) føres underkjølt vann langt over −20 °C-nivået.'),
  ill:()=>KS(`<rect x="10" y="20" width="180" height="22" fill="rgba(127,203,232,.22)"/><line x1="10" y1="42" x2="190" y2="42" stroke="#7FCBE8" stroke-dasharray="5 3"/><line x1="10" y1="20" x2="190" y2="20" stroke="#7FCBE8" stroke-dasharray="5 3" opacity=".5"/>${KT(14,54,'0 °C','#7FCBE8')}${KT(14,16,'−20 °C','#7FCBE8')}${KT(120,34,'icing','#9FE3FF')}`),click:()=>preset('rime','xs'),to:'#hzCv'},
 {k:'rime',t:t2('Rime ice','Rimis'),d:t2('Small drops at low temperatures freeze instantly and trap air: white, rough and brittle, built forward on the leading edge. Typical of layer cloud.','Små dråper ved lave temperaturer fryser momentant og fanger luft: hvit, ru og sprø is, bygd fremover på forkanten. Typisk for lagskyer.'),
  ill:()=>KS(`<path d="M60,40 Q70,22 100,22 L190,30 L100,44 Q70,50 60,40Z" fill="#8C9AA6"/><path d="M60,40 Q54,36 46,37 Q54,30 62,30 Q60,34 60,40Z" fill="#F0F6FA"/>${KT(20,20,'rime','#EEF3F7')}`),click:()=>preset('rime','wing'),to:'#hzCv'},
 {k:'clear',t:t2('Clear and mixed ice','Klaris og blandingsis'),d:t2('Large drops near 0 °C freeze slowly and flow back before they freeze: glassy, heavy and hard to see, often with horns. Mixed ice is in between.','Store dråper nær 0 °C fryser sakte og renner bakover før de fryser: glassklar, tung og vanskelig å se, ofte med horn. Blandingsis er midt imellom.'),
  ill:()=>KS(`<path d="M60,40 Q70,22 100,22 L190,30 L100,44 Q70,50 60,40Z" fill="#8C9AA6"/><path d="M62,30 L46,20 L52,30 Q50,38 52,44 L44,52 L62,46" fill="rgba(170,225,255,.55)" stroke="#C8F0FF"/>${KT(14,18,'horns','#9FE3FF')}`),click:()=>preset('clear','wing'),to:'#hzCv'},
 {k:'sld',t:t2('Freezing rain and SLD','Underkjølt regn og SLD'),d:t2('Rain from a warm layer aloft falls into sub-zero air and freezes on contact, behind the protected area. Leave it at once: often by climbing into the warm layer.','Regn fra et varmt lag oppe faller ned i minusgrader og fryser ved kontakt, bak det beskyttede området. Forlat det straks: ofte ved å stige opp i det varme laget.'),
  dd:t2('SLD = supercooled large drops (freezing drizzle and freezing rain), larger than the certification envelope for most aircraft (CS-25 Appendix C). Typical ahead of a warm front.','SLD = underkjølte store dråper (underkjølt yr og regn), større enn sertifiseringsgrunnlaget for de fleste fly (CS-25 vedlegg C). Typisk foran en varmfront.'),
  ill:()=>KS(`<rect x="0" y="0" width="200" height="22" fill="rgba(93,169,233,.15)"/>${[20,50,80,110,140,170].map(x=>`<line x1="${x}" y1="6" x2="${x-3}" y2="18" stroke="#5DA9E9" stroke-width="1.5"/><line x1="${x-4}" y1="30" x2="${x-7}" y2="44" stroke="#9FE3FF" stroke-width="1.5"/>`).join('')}${KT(120,16,'+2 °C','#5DA9E9')}${KT(120,58,'−5 °C: FZRA','#9FE3FF')}`),click:()=>preset('fzra','xs'),to:'#hzCv'},
 {k:'where',t:t2('Where ice forms','Hvor isen dannes'),d:t2('First on thin, forward-facing parts: tailplane, wing leading edges, propeller, antennas, pitot probe, windscreen and engine intakes. The tail often ices before the wing.','Først på tynne deler som vender fremover: haleflate, vingeforkant, propell, antenner, pitotrør, frontrute og motorinntak. Halen iser ofte før vingen.'),
  ill:()=>KS(`<path d="M30,34 L160,32 Q176,32 182,36 Q176,40 160,40 L40,40 L22,22 L32,22 Z" fill="#c9d2da"/><circle cx="182" cy="36" r="3" fill="#9FE3FF"/><circle cx="26" cy="22" r="3" fill="#9FE3FF"/><circle cx="110" cy="36" r="3" fill="#9FE3FF"/><line x1="160" y1="32" x2="172" y2="26" stroke="#9FE3FF" stroke-width="2"/>`),click:()=>preset('clear','wing'),to:'#hzCv'},
 {k:'carb',dp:true,t:t2('Carburettor icing','Forgasserising'),d:t2('Fuel evaporation and the venturi cool the air in a carburettor by up to about 30 °C, so ice can form at OAT well above 0 °C in humid air, most of all at low power. Use carb heat.','Fordamping av drivstoff og venturien kjøler lufta i forgasseren med opptil omkring 30 °C, så det kan dannes is ved OAT godt over 0 °C i fuktig luft, mest på lav effekt. Bruk forgasservarme.'),
  dd:t2('Signs: falling RPM (fixed pitch) or manifold pressure (variable pitch), rough running. Carb heat first makes it a little worse (melted ice through the engine) before it improves.','Tegn: fallende turtall (fast propell) eller ladetrykk (vridbar propell), ujevn gange. Forgasservarme gjør det først litt verre (smeltet is gjennom motoren) før det blir bedre.'),
  ill:()=>KS(`<path d="M40,10 L80,26 L80,38 L40,54 Z M160,10 L120,26 L120,38 L160,54 Z" fill="#5E6D7C"/><rect x="80" y="26" width="40" height="12" fill="#18232c"/><circle cx="96" cy="30" r="2" fill="#9FE3FF"/><circle cx="104" cy="35" r="2" fill="#9FE3FF"/>${KT(100,60,'+15 °C, humid','#F0B440','middle')}`)},
 {k:'aero',t:t2('What ice does to the wing','Hva isen gjør med vingen'),d:t2('Even thin ice or frost lowers CL max and the stall angle, raises the stall speed and the drag. The wing can stall before the stall warning sounds.','Selv tynn is eller rim senker CL max og steilevinkelen, og øker steilefarten og motstanden. Vingen kan steile før steilevarselet kommer.'),
  dd:t2('In the wind tunnel lab you can see what leading-edge contamination does to the flow.','I vindtunnel-labben ser du hva forurensning på forkanten gjør med strømningen.'),
  ill:()=>KS(`<line x1="16" y1="58" x2="190" y2="58" stroke="#55626e"/><path d="M20,56 L120,12 Q130,10 138,20" fill="none" stroke="#7FCBE8" stroke-width="2"/><path d="M20,56 L94,26 Q102,24 108,32" fill="none" stroke="#EC5A47" stroke-width="2"/>${KT(140,14,'clean','#7FCBE8')}${KT(112,40,'iced','#EC5A47')}`),click:()=>preset('clear','wing'),to:'#hzCv'},
 {k:'deice',t:t2('De-icing, anti-icing, holdover','Avising, anti-ising, holdover'),d:t2('De-icing removes ice; anti-icing stops new ice for a limited time. On the ground the holdover time (HOT) starts at the beginning of the final fluid application.','Avising fjerner is; anti-ising hindrer ny is en begrenset tid. På bakken starter holdover-tiden (HOT) ved begynnelsen av siste væskepåføring.'),
  dd:t2('In flight: de-icing systems (boots, cycled) let some ice build and then shed it; anti-icing systems (heated leading edges, engine anti-ice) are switched on before entering icing.','I lufta: avisingssystemer (boots, sykliske) lar noe is bygge seg opp og kaster den av; anti-isingssystemer (oppvarmet forkant, motor-anti-ice) slås på før du går inn i ising.'),
  ill:()=>KS(`<rect x="16" y="26" width="168" height="12" rx="2" fill="#18232c"/><rect x="16" y="26" width="110" height="12" fill="rgba(113,204,147,.55)"/>${KT(16,20,'HOT starts','#71CC93')}${KT(130,52,'expired: de-ice again','#EC5A47')}`),click:()=>{ const d=document.querySelector('.kfull'); if(d) d.open=true; },to:'#refT'},
 {k:'ttypes',t:t2('Types of turbulence','Typer turbulens'),d:t2('Convective (thermals, cumulus), mechanical (wind over obstacles and terrain), frontal, mountain waves, clear air turbulence near the jet stream, and wake turbulence.','Konvektiv (termikk, cumulus), mekanisk (vind over hindringer og terreng), frontal, fjellbølger, klarluftsturbulens nær jetstrømmen, og vaketurbulens.'),
  ill:()=>KS(`<path d="M10,40 q10,-12 20,0 t20,0 t20,0 t20,0" fill="none" stroke="#8B99A7" stroke-width="1.6"/><path d="M110,30 q8,-16 16,0 t16,0 t16,0 t16,0" fill="none" stroke="#F0B440" stroke-width="1.6"/>${KT(14,56,'mechanical','#8B99A7')}${KT(112,56,'CAT','#F0B440')}`),click:()=>preset('wave','xs'),to:'#hzCv'},
 {k:'wave',t:t2('Mountain waves and rotors','Fjellbølger og rotorer'),d:t2('Stable air and a strong wind across a ridge (about 20 kt or more, increasing with height) make lee waves. Lenticulars mark the crests; the worst turbulence is in the rotor beneath them and in the lee-side downdraft.','Stabil luft og sterk vind på tvers av en fjellrygg (omkring 20 kt eller mer, økende med høyden) gir lebølger. Linseskyer markerer toppene; den verste turbulensen er i rotoren under dem og i fallvinden på lesiden.'),
  ill:()=>KS(`<path d="M0,60 L60,60 L80,30 L100,60 L200,60 Z" fill="#3a4752"/><path d="M0,20 Q60,20 80,14 Q100,10 110,30 Q125,46 140,24 Q155,6 170,24 Q185,40 200,26" fill="none" stroke="#D7E1E6" stroke-width="1.4"/><ellipse cx="140" cy="16" rx="16" ry="3" fill="#EEF3F7"/><circle cx="140" cy="48" r="6" fill="none" stroke="#EC5A47" stroke-width="1.5"/>${KT(152,50,'rotor','#EC5A47')}`),click:()=>preset('wave','xs'),to:'#hzCv'},
 {k:'cat',t:t2('CAT near the jet stream','CAT nær jetstrømmen'),d:t2('Clear air turbulence comes from strong wind shear, mostly on the polar (cold) side of the jet core, just below it and near the tropopause break. No cloud warns you.','Klarluftsturbulens kommer av sterkt vindskjær, mest på polarsiden (den kalde) av jetkjernen, like under den og nær bruddet i tropopausen. Ingen sky varsler deg.'),
  dd:t2('Rule of thumb: CAT becomes likely when the vertical wind shear exceeds about 5–6 kt per 1,000 ft. Change level or route away from the core.','Tommelfingerregel: CAT blir sannsynlig når det vertikale vindskjæret er over omkring 5–6 kt per 1000 ft. Bytt høyde eller rute bort fra kjernen.'),
  ill:()=>KS(`<ellipse cx="120" cy="24" rx="60" ry="16" fill="none" stroke="#B9A6F0"/><ellipse cx="120" cy="24" rx="32" ry="8" fill="none" stroke="#B9A6F0"/><circle cx="120" cy="24" r="4" fill="#B9A6F0"/><rect x="62" y="38" width="44" height="10" fill="rgba(240,180,64,.45)"/>${KT(66,60,'CAT','#F0B440')}${KT(14,20,'cold','#7FCBE8')}`),click:()=>preset('cat','xs'),to:'#hzCv'},
 {k:'scale',t:t2('Turbulence intensity','Turbulensintensitet'),d:t2('Light: slight changes, you can walk. Moderate: definite strain against the belts, still in positive control. Severe: large abrupt changes, momentarily out of control. Extreme: structural damage possible.','Lett: små endringer, du kan gå. Moderat: tydelig trykk mot beltene, fortsatt full kontroll. Kraftig: store brå endringer, kortvarig ute av kontroll. Ekstrem: strukturskade mulig.'),
  ill:()=>KS(`${['L','M','S','X'].map((s,i)=>`<rect x="${16+i*44}" y="${40-i*8}" width="36" height="${12+i*8}" fill="${['#71CC93','#F0B440','#EC5A47','#9A1E68'][i]}" opacity=".75"/>${KT(34+i*44,60,s,'#c9d2da','middle')}`).join('')}`),click:()=>{ const d=document.querySelector('.kfull'); if(d) d.open=true; },to:'#refT'},
 {k:'wake',dp:true,t:t2('Wake turbulence','Vaketurbulens'),d:t2('Every wing sheds two wingtip vortices that sink and drift with the wind. They are strongest behind a heavy, clean, slow aircraft. Keep the separation and stay above the leader’s path.','Hver vinge kaster av seg to vingetippvirvler som synker og driver med vinden. De er sterkest bak et tungt fly som flyr sakte i ren konfigurasjon. Hold separasjonen og bli over banen til flyet foran.'),
  ill:()=>KS(`<circle cx="70" cy="30" r="12" fill="none" stroke="#7FCBE8" stroke-width="1.5"/><circle cx="130" cy="30" r="12" fill="none" stroke="#7FCBE8" stroke-width="1.5"/>${KA(70,18,62,22,'#7FCBE8')}${KA(130,18,138,22,'#7FCBE8')}${KA(100,30,100,54,'#8B99A7')}${KT(108,52,'sinks','#8B99A7')}`),click:()=>{ location.href='tunnel.html#wake'; }}];

const REF=()=>{ const tr=(rows,h)=>`<table class="ftab"><thead><tr>${h.map(x=>`<th>${L(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${L(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return `<div><h3>${L(t2('Ice types','Istyper'))}</h3>${tr([
    [t2('Rime','Rimis'),t2('Small drops, about −10 to −20 °C (layer cloud)','Små dråper, omkring −10 til −20 °C (lagsky)'),t2('White, opaque, rough, brittle. Builds forward from the leading edge; easier to remove.','Hvit, ugjennomsiktig, ru, sprø. Bygger fremover fra forkanten; lettere å fjerne.')],
    [t2('Clear (glaze)','Klaris'),t2('Large drops, 0 to about −10 °C (cumulus, freezing rain)','Store dråper, 0 til omkring −10 °C (cumulus, underkjølt regn)'),t2('Glassy, dense, heavy, hard to see. Runs back before it freezes; horns. The most dangerous.','Glassklar, tett, tung, vanskelig å se. Renner bakover før den fryser; horn. Den farligste.')],
    [t2('Mixed','Blandingsis'),t2('A mix of drop sizes, about −10 to −15 °C','Blandede dråpestørrelser, omkring −10 til −15 °C'),t2('Both: rough and partly clear.','Begge deler: ru og delvis klar.')],
    [t2('Hoar frost','Rimfrost'),t2('Water vapour turns straight to ice on a surface below 0 °C (clear air, cold-soaked aircraft)','Vanndamp går rett over til is på en flate under 0 °C (klar luft, gjennomkaldt fly)'),t2('Thin and crystalline, but enough to spoil the lift: remove before take-off.','Tynn og krystallinsk, men nok til å ødelegge løftet: fjern før avgang.')]],
    [t2('Type','Type'),t2('Forms from','Dannes av'),t2('Look and hazard','Utseende og fare')])}</div>`+
  `<div><h3>${L(t2('Icing intensity (pilot reports)','Isingsintensitet (pilotrapporter)'))}</h3>${tr([
    [t2('Trace','Spor'),t2('Just perceptible. Not a hazard unless it lasts more than about an hour.','Akkurat merkbar. Ikke farlig med mindre den varer mer enn omkring en time.')],
    [t2('Light','Lett'),t2('Can be a problem over a long time; use ice protection now and then.','Kan bli et problem over lang tid; bruk isbeskyttelse innimellom.')],
    [t2('Moderate','Moderat'),t2('Even short encounters can be hazardous: ice protection on, or divert.','Selv korte møter kan være farlige: isbeskyttelse på, eller endre rute.')],
    [t2('Severe','Kraftig'),t2('Ice protection cannot control it: leave at once. Severe icing (SEV ICE, also FZRA) is a SIGMET phenomenon.','Isbeskyttelsen klarer det ikke: forlat området straks. Kraftig ising (SEV ICE, også FZRA) er et SIGMET-fenomen.')]],
    [t2('Intensity','Intensitet'),t2('Meaning','Betydning')])}</div>`+
  `<div><h3>${L(t2('Turbulence intensity','Turbulensintensitet'))}</h3>${tr([
    [t2('Light','Lett'),t2('Slight, erratic changes in altitude or attitude. You can walk in the cabin.','Små, uregelmessige endringer i høyde eller holdning. Du kan gå i kabinen.')],
    [t2('Moderate','Moderat'),t2('Changes in altitude, attitude and IAS, but the aircraft stays in positive control. Occupants feel strain against the belts; walking is difficult.','Endringer i høyde, holdning og fart, men flyet er hele tiden under kontroll. Man kjenner beltene; vanskelig å gå.')],
    [t2('Severe','Kraftig'),t2('Large, abrupt changes; the aircraft may be momentarily out of control. Occupants are forced violently against the belts.','Store, brå endringer; flyet kan kortvarig være ute av kontroll. Man kastes mot beltene.')],
    [t2('Extreme','Ekstrem'),t2('Practically impossible to control; structural damage possible.','Nesten umulig å kontrollere; strukturskade mulig.')]],
    [t2('Intensity','Intensitet'),t2('In the aircraft','I flyet')])}<p class="note deep">${L(t2('Annex 3 also measures turbulence objectively as the eddy dissipation rate (EDR): moderate 0.20–0.45, severe above 0.45 (m<sup>2/3</sup> s<sup>−1</sup>).','Annex 3 måler også turbulens objektivt som eddy dissipation rate (EDR): moderat 0,20–0,45, kraftig over 0,45 (m<sup>2/3</sup> s<sup>−1</sup>).'))}</p></div>`+
  `<div><h3>${L(t2('Ground de-icing and anti-icing','Avising og anti-ising på bakken'))}</h3>${tr([
    [t2('Type I','Type I'),t2('Thin, heated fluid. Removes ice (de-icing); short holdover time.','Tynn, oppvarmet væske. Fjerner is (avising); kort holdover-tid.')],
    [t2('Type II / IV','Type II / IV'),t2('Thickened fluid that stays on the wing and absorbs precipitation (anti-icing); longer holdover time. Shears off during the take-off run.','Fortykket væske som blir liggende og tar opp nedbør (anti-ising); lengre holdover-tid. Blåses av under startrullet.')],
    [t2('One-step / two-step','Ett trinn / to trinn'),t2('One step: de-ice and anti-ice with the same fluid. Two steps: de-ice first, then anti-ice. HOT starts at the beginning of the final step.','Ett trinn: avising og anti-ising med samme væske. To trinn: avis først, så anti-is. HOT starter ved begynnelsen av siste trinn.')],
    [t2('HOT exceeded','HOT overskredet'),t2('De-ice again, or do the pre-take-off contamination check your operator prescribes. Take off only with a clean aircraft.','Avis på nytt, eller gjør kontrollen før avgang som operatøren krever. Start bare med et rent fly.')]],
    [t2('Fluid / term','Væske / begrep'),t2('What it does','Hva den gjør')])}<p class="note">${L(t2('Holdover times are guidance values from the annual tables for the fluid, temperature and precipitation. They are not shown here.','Holdover-tider er veiledende verdier fra de årlige tabellene for væske, temperatur og nedbør. De vises ikke her.'))}</p></div>`; };

const KEYS=[t2('<b>Ice needs visible moisture and supercooled water.</b> Most icing is from 0 to −20 °C, the worst from 0 to −10 °C. Below −40 °C the cloud is all ice crystals.','<b>Is krever synlig fuktighet og underkjølt vann.</b> Mest ising skjer fra 0 til −20 °C, verst fra 0 til −10 °C. Under −40 °C er skyen bare iskrystaller.'),
 t2('<b>Drop size and temperature decide the type.</b> Large drops near 0 °C give clear ice with horns; small drops colder give rime. Freezing rain freezes behind the protected area: leave it at once.','<b>Dråpestørrelse og temperatur avgjør typen.</b> Store dråper nær 0 °C gir klaris med horn; små dråper i kaldere luft gir rimis. Underkjølt regn fryser bak det beskyttede området: forlat det straks.'),
 t2('<b>Ice spoils the wing.</b> Less CL max, a lower stall angle, a higher stall speed and more drag, even from frost. The stall can come before the stall warning. Take off only with a clean aircraft; holdover time starts at the beginning of the final fluid step.','<b>Is ødelegger vingen.</b> Lavere CL max, lavere steilevinkel, høyere steilefart og mer motstand, selv av rim. Steilingen kan komme før steilevarselet. Start bare med et rent fly; holdover-tiden starter ved begynnelsen av siste væsketrinn.'),
 t2('<b>Mountain waves need stable air and a strong wind across the ridge.</b> The waves are smooth but can sink you faster than you can climb; the rotor under the crests and the lee-side downdraft are the most turbulent places.','<b>Fjellbølger krever stabil luft og sterk vind på tvers av ryggen.</b> Bølgene er rolige, men kan presse deg ned fortere enn du kan stige; rotoren under toppene og fallvinden på lesiden er de mest turbulente stedene.'),
 t2('<b>CAT follows the wind shear.</b> Expect it on the polar (cold) side of the jet core, below it and near the tropopause break. Change level or route away from the core.','<b>CAT følger vindskjæret.</b> Vent det på polarsiden (den kalde) av jetkjernen, under den og nær bruddet i tropopausen. Bytt høyde eller rute bort fra kjernen.'),
 t2('<b>Report what you meet</b>: light, moderate or severe icing and turbulence. Severe icing and severe turbulence are SIGMET phenomena.','<b>Rapporter det du møter</b>: lett, moderat eller kraftig ising og turbulens. Kraftig ising og kraftig turbulens er SIGMET-fenomener.')];

on(()=>{
  el('kIntro').textContent=L(t2('The words used in the model below. Each card links to the place in the model where it is shown.','Ordene som brukes i modellen under. Hvert kort lenker til stedet i modellen der det vises.'));
  el('refT').innerHTML=REF();
  el('mLead').innerHTML=L(t2('One section through the atmosphere with three hazards side by side: <b>cloud and icing</b> on the left, <b>wind over a ridge</b> in the middle, the <b>jet stream</b> at the top. Move your aircraft (tap the view) and read the icing and turbulence where you are. Switch to <b>Ice on the wing</b> to see the ice it collects and what it does to the stall.','Ett snitt gjennom atmosfæren med tre farer side om side: <b>sky og ising</b> til venstre, <b>vind over en fjellrygg</b> i midten og <b>jetstrømmen</b> øverst. Flytt flyet (trykk i bildet) og les isingen og turbulensen der du er. Bytt til <b>Is på vingen</b> for å se isen det samler og hva den gjør med steilingen.'));
  el('tryLead').innerHTML=L(t2('Six short tasks. The first four you do in the model above, with live feedback; the last two you answer here, then see them in the model.','Seks korte oppgaver. De fire første gjør du i modellen over, med fortløpende tilbakemelding; de to siste svarer du på her, og ser dem så i modellen.'));
  el('take').innerHTML=KEYS.map(x=>`<li>${L(x)}</li>`).join('');
  const m=el('maid'); m.querySelector('.eyebrow').textContent=L(t2('Memory aid','Huskeregel'));
  m.querySelector('h3').innerHTML=L(t2('The three Cs of clear ice','Tre K-er for klaris'));
  m.querySelector('p').innerHTML=L(t2('<b>C</b>umulus, <b>C</b>lose to 0 °C, <b>C</b>hunky (large) drops: clear ice, the heavy and dangerous kind. Turn each one around (layer cloud, colder, small drops) and you get rime.','<b>K</b>umulus, <b>K</b>loss på 0 °C, <b>K</b>raftige (store) dråper: klaris, den tunge og farlige typen. Snu hver av dem (lagsky, kaldere, små dråper), og du får rimis.'));
  el('dbE').innerHTML=`<span class="k">${L(t2('Deep dive · what the examiner wants you to know','Dypdykk · dette vil sensor at du skal kunne'))}</span>`+[
    t2('<b>Tailplane icing.</b> The thin tailplane collects ice first. A tailplane stall usually comes when flaps are extended: the nose pitches down. The recovery is the opposite of a wing stall: retract the flaps to the previous setting and pull.','<b>Ising på haleflaten.</b> Den tynne haleflaten samler is først. En halesteiling kommer gjerne når flapsene settes ut: nesen faller. Gjenopprettingen er motsatt av en vingesteiling: sett flapsene tilbake til forrige trinn og trekk.'),
    t2('<b>Certification.</b> Large aircraft are certified for the cloud icing in CS-25 Appendix C; freezing drizzle and freezing rain (Appendix O) are covered only where the aircraft is certified for them. Most light aircraft are not approved for flight into known icing at all.','<b>Sertifisering.</b> Store fly er sertifisert for skyisingen i CS-25 vedlegg C; underkjølt yr og regn (vedlegg O) dekkes bare der flyet er sertifisert for det. De fleste småfly er ikke godkjent for flyging i kjent ising i det hele tatt.'),
    t2('<b>Mountain wave in practice.</b> Expect them when the wind is 20 kt or more within 30° of perpendicular to the ridge, with a stable layer near the ridge top. Cross ridges at an angle so you can turn away, with a good height margin; in the downdraft fly the speed for turbulence, not the altitude.','<b>Fjellbølger i praksis.</b> Vent dem når vinden er 20 kt eller mer innenfor 30° av vinkelrett på ryggen, med et stabilt lag nær ryggtoppen. Kryss rygger på skrå så du kan snu, med god høydemargin; i fallvinden flyr du farten for turbulens, ikke høyden.'),
    t2('<b>CAT and the jet.</b> A jet stream has a core of at least 60 kt. The strongest shear is on the polar side and above and below the core; where the jet curves sharply around a trough, CAT is more likely.','<b>CAT og jetstrømmen.</b> En jetstrøm har en kjerne på minst 60 kt. Det sterkeste vindskjæret er på polarsiden og over og under kjernen; der jetstrømmen svinger skarpt rundt et tråg, er CAT mer sannsynlig.')].map(x=>`<p>${L(x)}</p>`).join('');
  el('foot').innerHTML='<b>'+L(t2('Model and limitations.','Modell og begrensninger.'))+'</b> '+L(t2('Schematic teaching model; the three hazards are placed in one section and are not to horizontal scale. Temperature falls 2 °C per 1,000 ft (a warm layer aloft is added for freezing rain). Ice type and intensity come from drop size, temperature and an illustrative liquid water content; the accretion rate, ice shapes (drawn ×3) and the changes in CL max, stall angle and drag are illustrative, not data for any aircraft. Lee waves: λ = 2π·U/N; the rotor and CAT thresholds (vertical shear 4 / 6 / 9 kt per 1,000 ft for light / moderate / severe) are rules of thumb. Use forecasts, SIGMETs, pilot reports and your AFM.','Skjematisk opplæringsmodell; de tre farene er lagt i ett snitt og er ikke i horisontal skala. Temperaturen faller 2 °C per 1000 ft (et varmt lag oppe legges til for underkjølt regn). Istype og intensitet kommer fra dråpestørrelse, temperatur og et illustrativt innhold av flytende vann; isvekst, isformer (tegnet ×3) og endringene i CL max, steilevinkel og motstand er illustrative, ikke data for noe fly. Lebølger: λ = 2π·U/N; tersklene for rotor og CAT (vertikalt vindskjær 4 / 6 / 9 kt per 1000 ft for lett / moderat / kraftig) er tommelfingerregler. Bruk prognoser, SIGMET, pilotrapporter og flygehåndboka.'));
  el('protHint').textContent=L(t2('Anti-icing on the leading edge keeps the protected area clean. Freezing rain still freezes behind it.','Anti-ising på forkanten holder det beskyttede området rent. Underkjølt regn fryser likevel bak det.'));
  legend(); drawTasks();
});

/* ---------------- Try tasks ---------------- */
const go=id=>{ const t=el(id); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); };
let active=null; const ans={}, touched={};
const TASKS=[
 {k:'clear',model:1,q:t2('Make clear ice: choose large drops and put the aircraft where the ice type reads “clear”.','Lag klaris: velg store dråper og legg flyet der istypen er «klaris».'),
  check:()=>{ if(S.drop!=='large') return {ok:0,m:t2('Choose “Large drops” under Cloud and drops.','Velg «Store dråper» under Sky og dråper.')};
    const ic=R.ic; if(!ic.inC) return {ok:0,m:t2('You are outside the cloud. Tap inside the cumulus.','Du er utenfor skyen. Trykk inne i cumulusen.')};
    if(ic.type==='clear') return {ok:1,m:t2(`Yes: ${fmtT(ic.T)} with large drops. They freeze slowly and run back: clear ice, ${L(INT[ic.int])}. Open “Ice on the wing” to see the horns.`,`Ja: ${fmtT(ic.T)} med store dråper. De fryser sakte og renner bakover: klaris, ${L(INT[ic.int])}. Åpne «Is på vingen» for å se hornene.`)};
    return {ok:0,m:ic.T>0?t2(`${fmtT(ic.T)}: still above freezing. Climb.`,`${fmtT(ic.T)}: fortsatt over null. Stig.`):t2(`${fmtT(ic.T)} gives ${L(TYP[ic.type])}. Go lower, closer to 0 °C.`,`${fmtT(ic.T)} gir ${L(TYP[ic.type])}. Gå lavere, nærmere 0 °C.`)}; }},
 {k:'fzra',model:1,q:t2('Freezing rain at 2,000 ft. Find the nearest level above you where the icing stops.','Underkjølt regn i 2000 ft. Finn det nærmeste nivået over deg der isingen stopper.'),
  check:()=>{ if(S.drop!=='sld') return {ok:0,m:t2('Start with the scenario “Freezing rain under a warm front”.','Start med scenariet «Underkjølt regn under en varmfront».')};
    const ic=R.ic; if(!ic.inR&&!ic.inC) return {ok:0,m:t2('Stay under the cloud, in the rain: move the position back over the cloud.','Bli under skyen, i regnet: flytt posisjonen tilbake under skyen.')};
    if(ic.why==='warmrain') return {ok:1,m:t2(`Yes: at ${altS(S.alt)} the air is ${fmtT(ic.T)}, the rain is liquid and nothing freezes. The warm layer is the way out, but you must climb through the freezing rain to get there: decide early.`,`Ja: i ${altS(S.alt)} er lufta ${fmtT(ic.T)}, regnet er flytende og ingenting fryser. Det varme laget er veien ut, men du må stige gjennom det underkjølte regnet for å nå det: bestem deg tidlig.`)};
    return {ok:0,m:t2(`${altS(S.alt)}: ${fmtT(ic.T)}, ${L(TYP[ic.type])}. Climb slowly and watch the temperature.`,`${altS(S.alt)}: ${fmtT(ic.T)}, ${L(TYP[ic.type])}. Stig sakte og følg temperaturen.`)}; }},
 {k:'rotor',model:1,q:t2('Make a strong mountain wave and fly into the rotor.','Lag en kraftig fjellbølge og fly inn i rotoren.'),
  check:()=>{ if(S.stab!=='stable') return {ok:0,m:t2('Waves need stable air: choose Stable.','Bølger krever stabil luft: velg Stabil.')}; if(S.wind<35) return {ok:0,m:t2(`${S.wind} kt is not enough for a rotor here: try 40 kt or more.`,`${S.wind} kt er ikke nok til rotor her: prøv 40 kt eller mer.`)};
    if(R.tb.cause==='rotor') return {ok:1,m:t2(`Yes: severe turbulence below the first wave crest, about ${nf(WP.lam/2,0)} km behind the ridge, at about ridge height. The lenticular above looks calm.`,`Ja: kraftig turbulens under den første bølgetoppen, omtrent ${nf(WP.lam/2,0)} km bak ryggen, i omtrent ryggens høyde. Linseskyen over ser rolig ut.`)};
    return {ok:0,m:t2('Look for the red circle below the first lenticular, downwind of the ridge, low down.','Se etter den røde sirkelen under den første linseskyen, på lesiden av ryggen, lavt.')}; }},
 {k:'cat',model:1,q:t2('Find a spot with at least moderate clear air turbulence. Which side of the jet core is it on?','Finn et sted med minst moderat klarluftsturbulens. Hvilken side av jetkjernen er det på?'),
  check:()=>{ const tb=R.tb; if(tb.cause!=='cat'||RANK[tb.int]<2) return {ok:0,m:t2(S.jet<120?'Try a stronger jet: 150 kt or more.':'Look in the amber zones near the core, especially below it on the cold (left) side.',S.jet<120?'Prøv en sterkere jetstrøm: 150 kt eller mer.':'Se i de gule sonene nær kjernen, særlig under den på den kalde (venstre) siden.')};
    const side=S.u<JET_U?t2('the polar (cold) side','polarsiden (den kalde)'):t2('the tropical (warm) side','den tropiske (varme) siden'), lvl=S.alt<JET_Z?t2('below','under'):t2('above','over');
    return {ok:1,m:t2(`Yes: ${L(INT[tb.int])} CAT, shear ${nf(tb.sh,1)} kt per 1,000 ft, ${L(lvl)} the core on ${L(side)}. A level change of a few thousand feet often gets you out.`,`Ja: ${L(INT[tb.int])} CAT, vindskjær ${nf(tb.sh,1)} kt per 1000 ft, ${L(lvl)} kjernen på ${L(side)}. Et høydebytte på noen tusen fot får deg ofte ut.`)}; }},
 {k:'stall',q:t2('Ten minutes in moderate clear ice. The stall warning is set for a clean wing. What is the risk?','Ti minutter i moderat klaris. Steilevarselet er satt for en ren vinge. Hva er risikoen?'),
  opts:[t2('None: the warning still comes first','Ingen: varselet kommer fortsatt først'),t2('The wing can stall at a lower angle and a higher speed, before the warning','Vingen kan steile ved lavere vinkel og høyere fart, før varselet'),t2('The stall speed falls because the ice adds camber','Steilefarten synker fordi isen gir mer krumning'),t2('Only the drag increases','Bare motstanden øker')],c:1,
  e:()=>{ const s=Object.assign({},S); Object.assign(S,PRE.find(x=>x[0]==='clear')[2](),{tmin:10}); solve(); const w=R.wi; Object.assign(S,s); solve(); return [t2(`Right. In the model: CL max −${nf(w.loss*100,0)} %, stall at ${nf(w.as,1)}° instead of 16°, stall speed +${nf(w.vs,0)} %. The warning at about 14° may never come.`,`Riktig. I modellen: CL max −${nf(w.loss*100,0)} %, steiling ved ${nf(w.as,1)}° i stedet for 16°, steilefart +${nf(w.vs,0)} %. Varselet ved omtrent 14° kommer kanskje aldri.`),t2(`Not quite. Ice lowers CL max and the stall angle: here −${nf(w.loss*100,0)} % and ${nf(w.as,1)}°. The wing stalls earlier and faster, possibly before the warning. Fly faster, avoid large flap changes, and leave the icing.`,`Ikke helt. Is senker CL max og steilevinkelen: her −${nf(w.loss*100,0)} % og ${nf(w.as,1)}°. Vingen steiler tidligere og ved høyere fart, kanskje før varselet. Fly fortere, unngå store flapsendringer, og kom deg ut av isingen.`)]; },
  show:()=>{ preset('clear','wing'); S.tmin=10; all(); }},
 {k:'wave',q:t2('Lenticular clouds over the mountains on a windy, stable day. Where is the turbulence usually worst?','Linseskyer over fjellet en dag med sterk vind og stabil luft. Hvor er turbulensen vanligvis verst?'),
  opts:[t2('Inside the lenticular clouds','Inne i linseskyene'),t2('In the rotor under the wave crests, at about ridge height and below','I rotoren under bølgetoppene, omtrent i ryggens høyde og lavere'),t2('Upwind of the ridge','På lo side av ryggen'),t2('High above the waves, near the tropopause','Høyt over bølgene, nær tropopausen')],c:1,
  e:()=>[t2('Right. The waves themselves are mostly smooth (the lenticulars look polished); the rotor below the crests and the lee-side downdraft are where it is severe.','Riktig. Selve bølgene er stort sett rolige (linseskyene ser glatte ut); rotoren under toppene og fallvinden på lesiden er der det er kraftig.'),t2('Not quite. The lenticulars mark smooth wave crests. The severe turbulence is lower down, in the rotor under the crests and in the downdraft on the lee slope.','Ikke helt. Linseskyene markerer rolige bølgetopper. Den kraftige turbulensen er lenger ned, i rotoren under toppene og i fallvinden på lesiden.')],
  show:()=>preset('wave','xs')}];
function drawTasks(){ el('tasks').innerHTML=TASKS.map((t,i)=>`<li class="task" id="task-${t.k}"><span class="n">${L(t2('Task','Oppgave'))} ${i+1}</span><p class="q">${L(t.q)}</p>`+
   (t.model?`<div class="btns"><button type="button" class="btn pri sm" data-go="${t.k}">${L(t2('Do it in the model','Gjør det i modellen'))} ↑</button></div><span class="fb" id="fb-${t.k}"></span>`:'')+
   (t.opts?(()=>{ const a=ans[t.k], e=a!=null?t.e():null; return `<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-t="${t.k}" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${e?L(e[a===t.c?0:1]):''}</span><div class="btns"><button type="button" class="btn sm" data-show="${t.k}">${L(t2('Show it in the model','Vis i modellen'))} ↑</button></div>`; })():'')+`</li>`).join('');
  live(); drawTbox(); }
function drawTbox(){ const b=el('tbox'); if(!active){ b.hidden=true; return; } const i=TASKS.findIndex(t=>t.k===active);
  b.hidden=false; b.innerHTML=`<span class="k">${L(t2('Task','Oppgave'))} ${i+1}<button type="button" aria-label="${L(t2('Close the task','Lukk oppgaven'))}" id="tclose">×</button></span>${L(TASKS[i].q)}<span class="fb" id="tfb"></span>`;
  el('tclose').onclick=()=>{ active=null; drawTbox(); }; live(); }
function live(){ if(!R) return; TASKS.filter(t=>t.model&&touched[t.k]).forEach(t=>{ const r=t.check(), html=L(r.m); const f=el('fb-'+t.k); if(f){ f.innerHTML=html; f.classList.toggle('ok',!!r.ok); } if(active===t.k){ const g=el('tfb'); if(g){ g.innerHTML=html; g.classList.toggle('ok',!!r.ok); } } }); }
el('tasks').addEventListener('click',e=>{ const gb=e.target.closest('[data-go]'), o=e.target.closest('[data-o]'), sh=e.target.closest('[data-show]');
  if(gb){ active=gb.dataset.go; touched[active]=1; if(active==='fzra'&&S.drop!=='sld') preset('fzra'); if(S.tab!=='xs') setTab('xs'); drawTbox(); go('explore'); return; }
  if(o){ ans[o.dataset.t]=+o.dataset.o; drawTasks(); return; }
  if(sh){ const t=TASKS.find(x=>x.k===sh.dataset.show); active=null; drawTbox(); t.show(); go('explore'); } });

/* ---------------- quiz (ATPL 050) ---------------- */
LAB.quiz(el('qbox'),'hazards',()=>LAB.shuffle([
 {q:t2('The greatest risk of clear ice is in…','Størst risiko for klaris er i …'),a:[t2('cumuliform cloud with large supercooled drops, between 0 and about −10 °C','cumulusskyer med store underkjølte dråper, mellom 0 og omkring −10 °C'),t2('stratiform cloud with small drops at −25 °C','lagskyer med små dråper ved −25 °C'),t2('cirrus cloud at −45 °C','cirrus ved −45 °C'),t2('fog at +3 °C','tåke ved +3 °C')],c:0,e:t2('Large drops close to 0 °C freeze slowly, spread back and form dense, clear ice.','Store dråper nær 0 °C fryser sakte, sprer seg bakover og danner tett, klar is.')},
 {q:t2('Rime ice forms when…','Rimis dannes når …'),a:[t2('small supercooled drops freeze instantly on impact and trap air','små underkjølte dråper fryser momentant ved treff og fanger luft'),t2('large drops flow back before freezing','store dråper renner bakover før de fryser'),t2('water vapour sublimates on a cold-soaked wing in clear air','vanndamp sublimerer på en gjennomkald vinge i klar luft'),t2('rain falls on a wing above 0 °C','regn faller på en vinge over 0 °C')],c:0,e:t2('Instant freezing traps air: white, opaque, brittle ice. Vapour turning straight to ice is hoar frost.','Momentan frysing fanger luft: hvit, ugjennomsiktig, sprø is. Vanndamp som går rett til is er rimfrost.')},
 {q:t2('Freezing rain is most likely…','Underkjølt regn er mest sannsynlig …'),a:[t2('ahead of a warm front, where rain from a warm layer aloft falls into air below 0 °C','foran en varmfront, der regn fra et varmt lag oppe faller ned i luft under 0 °C'),t2('behind a cold front in showers','bak en kaldfront i byger'),t2('in the centre of a high','midt i et høytrykk'),t2('only above the tropopause','bare over tropopausen')],c:0,e:t2('The warm air rides up over the cold air ahead of a warm front: rain from above falls into the cold wedge and becomes supercooled.','Den varme lufta glir opp over den kalde foran en varmfront: regn ovenfra faller ned i den kalde kilen og blir underkjølt.')},
 {q:t2('With two-step de-icing and anti-icing, the holdover time starts…','Ved avising og anti-ising i to trinn starter holdover-tiden …'),a:[t2('at the beginning of the second (anti-icing) step','ved begynnelsen av det andre trinnet (anti-ising)'),t2('at the end of the first step','ved slutten av første trinn'),t2('at the beginning of the first step','ved begynnelsen av første trinn'),t2('when the aircraft starts the take-off run','når flyet starter startrullet')],c:0,e:t2('HOT always starts at the beginning of the final fluid application.','HOT starter alltid ved begynnelsen av siste væskepåføring.')},
 {q:t2('Which conditions favour mountain waves?','Hvilke forhold gir fjellbølger?'),a:[t2('A strong wind roughly perpendicular to the ridge, increasing with height, and a stable layer near the ridge top','Sterk vind omtrent vinkelrett på ryggen, økende med høyden, og et stabilt lag nær ryggtoppen'),t2('Calm wind and an unstable air mass','Stille vind og en ustabil luftmasse'),t2('A wind parallel to the ridge','Vind parallelt med ryggen'),t2('Strong surface heating with cumulus','Sterk oppvarming ved bakken med cumulus')],c:0,e:t2('Stable air pushed over a ridge oscillates downstream; strong cross-ridge wind sets the wavelength and amplitude.','Stabil luft som presses over en rygg svinger nedstrøms; sterk vind på tvers av ryggen gir bølgelengden og amplituden.')},
 {q:t2('In a mountain wave system, the most severe turbulence is normally found…','I et fjellbølgesystem er den kraftigste turbulensen vanligvis …'),a:[t2('in the rotor zone beneath the wave crests, downwind of the ridge','i rotorsonen under bølgetoppene, på lesiden av ryggen'),t2('inside the lenticular clouds','inne i linseskyene'),t2('on the windward side of the ridge','på lo side av ryggen'),t2('in the stratosphere','i stratosfæren')],c:0,e:t2('Lenticulars mark smooth crests; the rotor below them is violently turbulent.','Linseskyene markerer rolige topper; rotoren under dem er voldsomt turbulent.')},
 {q:t2('Clear air turbulence associated with a jet stream is most likely…','Klarluftsturbulens knyttet til en jetstrøm er mest sannsynlig …'),a:[t2('on the polar (cold) side of the core, where the wind shear is strongest','på polarsiden (den kalde) av kjernen, der vindskjæret er sterkest'),t2('exactly in the core, where the wind is strongest','akkurat i kjernen, der vinden er sterkest'),t2('far out on the tropical side','langt ute på den tropiske siden'),t2('only inside cirrus cloud','bare inne i cirrus')],c:0,e:t2('CAT follows the shear, not the speed: strongest on the cold side, below the core and near the tropopause break.','CAT følger vindskjæret, ikke farten: sterkest på den kalde siden, under kjernen og nær bruddet i tropopausen.')},
 {q:t2('Moderate turbulence is defined by…','Moderat turbulens kjennetegnes av …'),a:[t2('changes in altitude and attitude, but the aircraft remains in positive control at all times','endringer i høyde og holdning, men flyet er hele tiden under kontroll'),t2('the aircraft momentarily out of control','at flyet kortvarig er ute av kontroll'),t2('structural damage','strukturskade'),t2('no noticeable change','ingen merkbar endring')],c:0,e:t2('Moderate: positive control, strain against belts. Severe: momentarily out of control.','Moderat: full kontroll, trykk mot beltene. Kraftig: kortvarig ute av kontroll.')},
 {q:t2('Carburettor icing can occur…','Forgasserising kan oppstå …'),a:[t2('at outside air temperatures well above 0 °C in humid air, especially at low power','ved utetemperaturer godt over 0 °C i fuktig luft, særlig på lav effekt'),t2('only below 0 °C','bare under 0 °C'),t2('only at full power','bare på full effekt'),t2('only in visible cloud','bare i synlig sky')],c:0,e:t2('Fuel evaporation and venturi cooling can drop the air temperature by up to about 30 °C.','Fordamping og venturiavkjøling kan senke lufttemperaturen med opptil omkring 30 °C.')},
 {q:t2('A thin layer of frost on the upper wing surface before take-off will…','Et tynt lag rim på vingens overside før avgang vil …'),a:[t2('reduce CL max and raise the stall speed; it must be removed','redusere CL max og øke steilefarten; det må fjernes'),t2('have no effect because it is so thin','ikke ha noen virkning fordi det er så tynt'),t2('reduce drag','redusere motstanden'),t2('lower the stall speed','senke steilefarten')],c:0,e:t2('Roughness at the front of the wing trips the boundary layer: an early stall at a higher speed. Clean aircraft concept.','Ruhet foran på vingen forstyrrer grensesjiktet: tidlig steiling ved høyere fart. Rent fly-prinsippet.')}
]),8);

/* ---------------- concepts and start ---------------- */
function concepts(){ KCS.render(el('hKc'),KCI); }
LAB.start('hazards');
concepts(); solve(); hooks.forEach(f=>f()); all();
LAB.onLang(()=>{ hooks.forEach(f=>f()); all(); });
})();
