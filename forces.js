/* Birdbird – forces.js: "Forces in flight" (forces.html).
   General teaching model of a light single-engine aircraft (own design, illustrative numbers), sea level ISA, so IAS = TAS.
   Steady flight with thrust along the flight path:
     along the path:   T − D − W·sin γ = 0      (power mode: γ = asin((T − D)/W);  path mode: T = D + W·sin γ)
     normal to path:   L = n·W·cos γ,  n = 1 / cos φ
     drag polar:       D = q·S·CD0 + k·L² / (q·S),  k = 1 / (π·e·AR)
     propeller:        T = min(Ts, η·P / V) × power setting
     turn:             r = V² / (g·tan φ),  ω = g·tan φ / V,  VS(turn) = VS·√n
     glide:            glide ratio = 1 / tan|γ| = L / D (power off), distance over ground × GS / TAS */
(function(){
'use strict';
const {L,el,nf}=LAB;
const g0=9.80665, R0=1.225, KT=0.514444, FPM=196.8504, NM=1852, FT=0.3048, D2R=Math.PI/180;
const AC={S:16.2,b:11.0,CD0:0.032,e:0.78,CLmax:1.5,CLa:0.09,a0:-1.5,inc:1.5,P:134e3,eta:0.80,Ts:3000};
AC.AR=AC.b*AC.b/AC.S; AC.k=1/(Math.PI*AC.e*AC.AR);
const INK={bg:'#10171D',grid:'#1F2B35',rule:'#2A3742',ink:'#D7E1E6',mute:'#8B99A7',dim:'#5E6D7C',cyan:'#7FCBE8',mag:'#E46BAE',amber:'#F0B440',red:'#EC5A47',green:'#71CC93',violet:'#B9A6F0',white:'#EEF3F7'};
const COL={L:INK.cyan,W:INK.white,T:INK.mag,D:INK.red};
const FONT={mono:'"IBM Plex Mono", ui-monospace, monospace',body:'"Public Sans", system-ui, sans-serif'};
const BG='rgba(16,23,29,.8)';
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hooks=[]; const on=f=>{ hooks.push(f); return f; };

/* ---------------- model ---------------- */
function drag(v,m,lf){ const V=Math.max(1,v*KT), q=0.5*R0*V*V, Lf=lf*m*g0, CL=Lf/(q*AC.S), Dp=q*AC.S*AC.CD0, Di=AC.k*Lf*Lf/(q*AC.S); return {q,CL,Dp,Di,D:Dp+Di}; }
const tav=(v,pw)=>{ const V=v*KT, V0=AC.eta*AC.P/AC.Ts; return pw*AC.eta*AC.P/Math.sqrt(V*V+V0*V0); }; // falls from the static thrust Ts towards η·P/V
const vs1=m=>Math.sqrt(2*m*g0/(R0*AC.S*AC.CLmax))/KT;
const vmd=m=>Math.sqrt(2*m*g0/(R0*AC.S))*Math.pow(AC.k/AC.CD0,0.25)/KT;
const LDmax=1/(2*Math.sqrt(AC.k*AC.CD0));
function argmax(f,a,b){ let bx=a,by=-Infinity; for(let v=a;v<=b;v+=0.25){ const y=f(v); if(y>by){ by=y; bx=v; } } return bx; }
const vx=(m,n)=>argmax(v=>tav(v,1)-drag(v,m,n||1).D,Math.max(40,vs1(m)*Math.sqrt(n||1)),160);
const vy=(m,n)=>argmax(v=>(tav(v,1)-drag(v,m,n||1).D)*v,Math.max(40,vs1(m)*Math.sqrt(n||1)),160);
function solve(F){
  const W=F.m*g0, n=1/Math.cos(F.phi*D2R), V=F.v*KT; let gam, T, pw, D, d, warn=null;
  if(F.mode==='power'){ T=tav(F.v,F.pw); gam=0; for(let i=0;i<6;i++){ d=drag(F.v,F.m,n*Math.cos(gam)); gam=Math.asin(clamp((T-d.D)/W,-1,1)); } D=d.D; pw=F.pw; }
  else { gam=F.gam*D2R; d=drag(F.v,F.m,n*Math.cos(gam)); D=d.D; T=D+W*Math.sin(gam); pw=T/tav(F.v,1);
    if(T<0){ warn={en:'Steeper than the power-off glide: even at idle you would need extra drag (flap, gear, sideslip) to hold this path at this speed.',no:'Brattere enn glidebanen uten motor: selv på tomgang trenger du ekstra motstand (flaps, understell, sideslip) for å holde denne banen i denne farten.'}; }
    else if(pw>1){ warn={en:`Not enough power: this needs ${nf(pw*100,0)} % of the power available. Speed or path must give.`,no:`Ikke nok effekt: dette krever ${nf(pw*100,0)} % av tilgjengelig effekt. Farten eller banen må gi etter.`}; } }
  const Lf=n*W*Math.cos(gam), vs=vs1(F.m), vsT=vs*Math.sqrt(n), stall=F.v<vsT;
  if(stall) warn={en:`Below the stall speed for this load factor (VS ${nf(vsT,0)} kt at n = ${nf(n,2)}). The wing cannot make this much lift.`,no:`Under steilefarten for denne lastfaktoren (VS ${nf(vsT,0)} kt ved n = ${nf(n,2)}). Vingen klarer ikke å lage så mye løft.`};
  const al=clamp(d.CL,0,AC.CLmax)/AC.CLa+AC.a0;
  const roc=V*Math.sin(gam)*FPM, gs=Math.max(1,F.v-F.wind), tg=Math.tan(gam);
  const gradAir=tg*100, gradGnd=V*Math.sin(gam)/(gs*KT)*100;
  const tph=Math.tan(F.phi*D2R), r=F.phi>0.2?V*V/(g0*tph):Infinity, om=F.phi>0.2?g0*tph/V/D2R:0;
  const glideAir=gam<-0.0005?1/Math.tan(-gam):Infinity;
  const dist=gam<-0.0005?F.h*FT/Math.tan(-gam)*(gs/F.v)/NM:Infinity;
  return {W,n,V,gam:gam/D2R,T,D,Dp:d.Dp,Di:d.Di,Lf,LD:Lf/D,pw,vs,vsT,stall,al,th:gam/D2R+al-AC.inc,roc,gs,gradAir,gradGnd,r,om,glideAir,dist,warn,
    vmd:vmd(F.m)*Math.sqrt(n), vx:vx(F.m,n), vy:vy(F.m,n)};
}
const F={mode:'path',v:100,m:1050,pw:0.6,gam:0,phi:0,wind:0,h:3000,mag:true};
let R=null;

/* ---------------- strings ---------------- */
LAB.add({},{'Forces in Flight':'Krefter i flyging','Forces in flight':'Krefter i flyging','Birdbird Virtual Labs · Aerodynamics':'Birdbird Virtual Labs · Aerodynamikk',
 'Lift, weight, thrust and drag, drawn to scale and live. Fly level, climb, glide and turn, and see why lift is less than weight in a climb, why the glide ratio is L/D, and why the stall speed rises in a turn.':'Løft, vekt, skyv og motstand, tegnet i skala og live. Fly rett fram, stig, gli og sving, og se hvorfor løftet er mindre enn vekten i stigning, hvorfor glidetallet er L/D, og hvorfor steilefarten øker i sving.',
 'The four forces':'De fire kreftene','Forces in flight lab':'Kraftlab','Try it':'Prøv selv','Debrief':'Debrief','What to take away':'Det du skal ta med deg','Test yourself':'Test deg selv',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Try':'3 · Prøv','4 · Debrief':'4 · Debrief','5 · Check':'5 · Sjekk','2 · Explore · Try it':'2 · Utforsk · Prøv selv','3 · Key points':'3 · Det viktigste','3 · Test yourself':'3 · Test deg selv','What happened, and why it matters':'Hva skjedde, og hvorfor det betyr noe','Pilot takeaways':'Dette tar piloten med seg','You set':'Du styrer','Forces':'Krefter',
 'Indicated airspeed (kt)':'Indikert fart (kt)','Mass (kg)':'Masse (kg)','Power (%)':'Effekt (%)','Flight path angle (°)':'Banevinkel (°)','Bank angle (°)':'Krengning (°)','Wind (kt, + = headwind)':'Vind (kt, + = motvind)','Height above ground (ft)':'Høyde over bakken (ft)',
 'Power':'Effekt','Path angle':'Banevinkel','Drag':'Motstand','Advanced':'Avansert',
 'Controls':'Kontroller','Conditions':'Forhold','Show':'Vis','Scenarios':'Scenarier','Key numbers':'Nøkkeltall','Drag and power':'Motstand og effekt','Flight path over the ground':'Flybanen over bakken','Thrust and drag are small next to lift and weight, so they are drawn longer.':'Skyv og motstand er små ved siden av løft og vekt, så de tegnes lengre.',
 'In power mode: the result':'I effektmodus: resultatet','In path mode: the power needed':'I banemodus: effekten som trengs','Used for the glide distance and the profile':'Brukes til glidedistansen og profilen'});

/* ---------------- drawing helpers ---------------- */
function txt(g,s,x,y,o){ o=o||{}; g.font=(o.w||(o.mono?400:600))+' '+(o.size||12)+'px '+(o.mono?FONT.mono:FONT.body); g.textAlign=o.al||'left'; g.textBaseline='alphabetic';
  if(o.bg){ const w=g.measureText(s).width, h=(o.size||12)+4, x0=o.al==='center'?x-w/2:o.al==='right'?x-w:x; g.fillStyle=o.bg; g.fillRect(x0-3,y-h+4,w+6,h); }
  g.fillStyle=o.col||INK.ink; g.fillText(s,x,y); }
function arrow(g,x0,y0,x1,y1,col,w,hl){ hl=hl||9; const a=Math.atan2(y1-y0,x1-x0), Ln=Math.hypot(x1-x0,y1-y0); if(Ln<1.5) return; hl=Math.min(hl,Ln*0.6);
  g.strokeStyle=col; g.fillStyle=col; g.lineWidth=w||2.5; g.lineCap='round'; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1-Math.cos(a)*hl*0.7,y1-Math.sin(a)*hl*0.7); g.stroke(); g.lineCap='butt';
  g.beginPath(); g.moveTo(x1,y1); g.lineTo(x1-hl*Math.cos(a-0.42),y1-hl*Math.sin(a-0.42)); g.lineTo(x1-hl*Math.cos(a+0.42),y1-hl*Math.sin(a+0.42)); g.closePath(); g.fill(); }
function dline(g,x0,y0,x1,y1,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke(); g.setLineDash([]); }
function clear(st){ const g=st.ctx; g.setTransform(st.dpr,0,0,st.dpr,0,0); g.fillStyle=INK.bg; g.fillRect(0,0,st.w,st.h); return g; }
function axes(g,box,xr,yr,o){ o=o||{}; const X=v=>box.x+(v-xr[0])/(xr[1]-xr[0])*box.w, Y=v=>box.y+box.h-(v-yr[0])/(yr[1]-yr[0])*box.h;
  g.lineWidth=1; g.strokeStyle=INK.grid;
  (o.xt||[]).forEach(v=>{ g.beginPath(); g.moveTo(X(v),box.y); g.lineTo(X(v),box.y+box.h); g.stroke(); txt(g,o.xf?o.xf(v):String(v),X(v),box.y+box.h+13,{mono:1,col:INK.mute,al:'center',size:10}); });
  (o.yt||[]).forEach(v=>{ g.beginPath(); g.moveTo(box.x,Y(v)); g.lineTo(box.x+box.w,Y(v)); g.stroke(); txt(g,o.yf?o.yf(v):String(v),box.x-5,Y(v)+3.5,{mono:1,col:INK.mute,al:'right',size:10}); });
  g.strokeStyle=INK.rule; g.strokeRect(box.x+0.5,box.y+0.5,box.w,box.h); return {X,Y}; }
function path(g,pts,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||2; g.setLineDash(dash||[]); g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke(); g.setLineDash([]); }
const narrow=st=>st.w<560;
const MAG=n=>n?3:4;

/* side view of the aircraft (own design: low-wing single), metres, x forward, z up, origin at the CG */
const BODY=[[3.55,0.05],[3.3,0.38],[2.6,0.55],[1.9,0.62],[1.35,1.18],[0.2,1.28],[-0.9,1.05],[-3.4,0.62],[-3.95,0.68],[-4.3,1.75],[-4.75,1.78],[-4.85,0.45],[-4.0,0.12],[-2.0,-0.32],[0.9,-0.46],[2.7,-0.38],[3.35,-0.18]];
/* trainer outline, hoisted so nothing is rebuilt per frame */
const SHP=[[['M',-3.55,0.22],['L',-4.75,0.26],['L',-4.95,0.18],['L',-3.7,0.1],['Z']],
 [['M',-3.35,0.5],['C',-3.8,0.75,-4.15,1.35,-4.38,1.95],['L',-4.86,1.98],['L',-4.98,0.3],['Z']],
 [['M',-3.9,0.86],['L',-4.62,1.62],['L',-4.75,1.5],['L',-4.08,0.84],['Z']],
 [['M',-4.6,1.9],['L',-4.66,0.42]],
 [['M',3.15,0.02],['C',1.5,0.1,-1.5,0.12,-4.95,0.28],['L',-4.96,0.2],['C',-1.5,0.02,1.5,-0.02,3.18,-0.06],['Z']],
 [['M',1.5,0.72],['C',1.1,1.08,0.65,1.17,0.05,1.16],['C',-0.45,1.14,-0.8,1.02,-1.15,0.86],['L',-1.0,0.7],['Z']],
 [['M',1.2,0.86],['C',0.9,1.04,0.5,1.1,0.1,1.1]],
 [['M',0.2,0.72],['L',0.12,1.15]],
 [['M',-3.55,0.3],['C',-3.75,0.38,-4.3,0.38,-4.9,0.3],['L',-4.92,0.24],['C',-4.3,0.2,-3.75,0.2,-3.55,0.3],['Z']],
 [['M',1.25,-0.3],['C',1.05,-0.12,0.3,-0.08,-0.55,-0.16],['L',-0.75,-0.26],['C',0.2,-0.42,0.9,-0.44,1.25,-0.3],['Z']],
 [['M',3.28,0.32],['C',3.6,0.26,3.78,0.16,3.82,0.08],['C',3.78,0,3.6,-0.1,3.28,-0.16],['Z']]];
const WHL=[[0.55,-1.02,-0.42],[2.45,-0.98,-0.4]], SPAT=WHL.map(w=>[[['M',w[0]+0.05,w[2]],['L',w[0]-0.04,w[1]+0.12]],
  [['M',w[0]+0.42,w[1]-0.02],['C',w[0]+0.38,w[1]+0.22,w[0]-0.1,w[1]+0.26,w[0]-0.36,w[1]+0.08],['C',w[0]-0.46,w[1]-0.06,w[0]-0.3,w[1]-0.24,w[0]-0.04,w[1]-0.24],['C',w[0]+0.22,w[1]-0.24,w[0]+0.44,w[1]-0.16,w[0]+0.42,w[1]-0.02],['Z']]]);
const GC={cx:NaN,cy:NaN,sc:NaN,th:NaN,list:[],i:0}, GR={cx:NaN,cy:NaN,k:NaN,list:[],i:0};
function plane(g,cx,cy,sc,th,t){ const c=Math.cos(th*D2R), s=Math.sin(th*D2R); const P=(x,z)=>[cx+sc*(x*c-z*s), cy-sc*(x*s+z*c)];
  /* a refined low-wing trainer in the same visual language as the CG lab's jet: white fuselage with soft shading,
     brand cheatline, navy fin; x forward, z up, the CG at (0,0); units ≈ metres */
  const pth=cmds=>{ g.beginPath(); cmds.forEach(k=>{ const op=k[0]; if(op==='M'||op==='L'){ const q=P(k[1],k[2]); g[op==='M'?'moveTo':'lineTo'](q[0],q[1]); }
      else if(op==='Q'){ const a1=P(k[1],k[2]), a2=P(k[3],k[4]); g.quadraticCurveTo(a1[0],a1[1],a2[0],a2[1]); }
      else if(op==='C'){ const a1=P(k[1],k[2]), a2=P(k[3],k[4]), a3=P(k[5],k[6]); g.bezierCurveTo(a1[0],a1[1],a2[0],a2[1],a3[0],a3[1]); }
      else if(op==='Z') g.closePath(); }); };
  const hit=GC.cx===cx&&GC.cy===cy&&GC.sc===sc&&GC.th===th; if(!hit){ GC.cx=cx; GC.cy=cy; GC.sc=sc; GC.th=th; GC.list.length=0; } GC.i=0;
  const grad=(z0,z1,stops)=>{ if(hit&&GC.i<GC.list.length) return GC.list[GC.i++]; const p0=P(0,z0), p1=P(0,z1), gr=g.createLinearGradient(p0[0],p0[1],p1[0],p1[1]); stops.forEach(([o,col])=>gr.addColorStop(o,col)); GC.list[GC.i++]=gr; return gr; };
  const lw=Math.max(0.8,sc*0.035);
  // far-side tailplane and wing (behind the fuselage, darker)
  pth(SHP[0]); g.fillStyle='#5B6B78'; g.fill();
  // fin with rudder and a brand stripe
  pth(SHP[1]);
  g.fillStyle=grad(2,0.3,[[0,'#24456A'],[1,'#1D3A5C']]); g.fill(); g.strokeStyle='rgba(226,232,238,.55)'; g.lineWidth=lw; g.stroke();
  pth(SHP[2]); g.fillStyle='rgba(228,107,174,.85)'; g.fill();
  pth(SHP[3]); g.strokeStyle='rgba(226,232,238,.35)'; g.lineWidth=lw; g.stroke();
  // fuselage
  const body=[['M',3.3,0.1],['C',3.25,0.45,2.9,0.6,2.35,0.66],['L',1.55,0.7],['C',1.1,1.12,0.6,1.24,-0.1,1.22],['C',-0.6,1.2,-1.0,1.05,-1.5,0.86],
    ['C',-2.6,0.66,-3.8,0.5,-4.95,0.36],['L',-4.98,0.12],['C',-3.9,-0.02,-2.4,-0.28,-0.9,-0.46],['C',0.4,-0.6,1.9,-0.52,2.7,-0.36],['C',3.1,-0.26,3.32,-0.1,3.3,0.1],['Z']];
  pth(body); g.fillStyle=grad(1.25,-0.6,[[0,'#F4F7F9'],[0.45,'#E3E9EE'],[0.8,'#B9C4CC'],[1,'#8A98A4']]); g.fill();
  g.strokeStyle='rgba(30,44,56,.55)'; g.lineWidth=lw; g.stroke();
  // cheatline
  pth(SHP[4]); g.fillStyle='#E46BAE'; g.fill();
  // canopy glass with a highlight
  pth(SHP[5]);
  g.fillStyle=grad(1.17,0.7,[[0,'#3E6380'],[1,'#16283A']]); g.fill(); g.strokeStyle='rgba(226,232,238,.6)'; g.lineWidth=lw; g.stroke();
  pth(SHP[6]); g.strokeStyle='rgba(220,240,255,.45)'; g.lineWidth=Math.max(1,sc*0.05); g.stroke();
  pth(SHP[7]); g.strokeStyle='rgba(226,232,238,.6)'; g.lineWidth=lw; g.stroke();
  // near tailplane (edge-on aerofoil)
  pth(SHP[8]); g.fillStyle='#C9D3DA'; g.fill(); g.strokeStyle='rgba(30,44,56,.55)'; g.stroke();
  // near wing: low wing seen from the side, a slim aerofoil at the root
  pth(SHP[9]);
  g.fillStyle=grad(-0.08,-0.44,[[0,'#F0F4F7'],[1,'#98A6B1']]); g.fill(); g.strokeStyle='rgba(30,44,56,.6)'; g.stroke();
  // landing gear with wheel spats
  for(let wi=0;wi<2;wi++){ const w=WHL[wi], sp=SPAT[wi]; pth(sp[0]); g.strokeStyle='#5B6B78'; g.lineWidth=Math.max(1.4,sc*0.08); g.stroke();
    pth(sp[1]);
    g.fillStyle=grad(w[1]+0.26,w[1]-0.24,[[0,'#E9EEF2'],[1,'#8E9CA8']]); g.fill(); g.strokeStyle='rgba(30,44,56,.6)'; g.lineWidth=lw; g.stroke();
    const wb=P(w[0],w[1]-0.12); g.fillStyle='#1B242C'; g.beginPath(); g.arc(wb[0],wb[1],sc*0.13,0,Math.PI); g.fill(); }
  // spinner and propeller disc (edge-on, blades flicker)
  pth(SHP[10]); g.fillStyle=grad(0.32,-0.16,[[0,'#F4F7F9'],[1,'#9AA8B3']]); g.fill(); g.strokeStyle='rgba(30,44,56,.6)'; g.lineWidth=lw; g.stroke();
  const hub=P(3.42,0.08), ph=t*40, bl=0.95*Math.abs(Math.cos(ph)), a=P(3.42,0.08+bl), b=P(3.42,0.08-bl), a2=P(3.42,1.03), b2=P(3.42,-0.87);
  g.strokeStyle='rgba(215,225,230,.14)'; g.lineWidth=Math.max(3,sc*0.14); g.lineCap='round'; g.beginPath(); g.moveTo(a2[0],a2[1]); g.lineTo(b2[0],b2[1]); g.stroke();
  g.strokeStyle='rgba(215,225,230,.75)'; g.lineWidth=Math.max(1.6,sc*0.08); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); g.lineCap='butt';
  // CG symbol
  const cg=P(0,0), r=Math.max(4.5,sc*0.2); g.fillStyle=INK.bg; g.strokeStyle=INK.white; g.lineWidth=1.5; g.beginPath(); g.arc(cg[0],cg[1],r,0,7); g.fill(); g.stroke();
  g.fillStyle=INK.white; g.beginPath(); g.moveTo(cg[0],cg[1]); g.arc(cg[0],cg[1],r,0,Math.PI/2); g.lineTo(cg[0],cg[1]); g.arc(cg[0],cg[1],r,Math.PI,Math.PI*1.5); g.fill();
  return P; }
/* the trainer seen from behind, banked by phi (deg), centred on (cx,cy); span = half span in px */
function rear(g,cx,cy,span,phi){ g.save(); g.translate(cx,cy); g.rotate(phi*D2R); const k=span/5.2;
  const hit=GR.k===k; if(!hit){ GR.k=k; GR.list.length=0; } GR.i=0;
  const lin=(y0,y1,a,b)=>{ if(hit&&GR.i<GR.list.length) return GR.list[GR.i++]; const gr=g.createLinearGradient(0,y0,0,y1); gr.addColorStop(0,a); gr.addColorStop(1,b); GR.list[GR.i++]=gr; return gr; };
  // tailplane and fin behind
  g.fillStyle='#9AA8B3'; g.beginPath(); g.moveTo(-1.7*k,-0.3*k); g.lineTo(1.7*k,-0.3*k); g.lineTo(1.7*k,-0.1*k); g.lineTo(-1.7*k,-0.1*k); g.closePath(); g.fill();
  g.fillStyle=lin(-1.9*k,-0.2*k,'#2B527D','#1D3A5C'); g.beginPath(); g.moveTo(-0.1*k,-0.2*k); g.lineTo(-0.06*k,-1.9*k); g.lineTo(0.06*k,-1.9*k); g.lineTo(0.1*k,-0.2*k); g.closePath(); g.fill(); g.strokeStyle='rgba(226,232,238,.5)'; g.lineWidth=1; g.stroke(); g.strokeStyle='rgba(226,232,238,.5)'; g.lineWidth=1; g.stroke();
  // wing with a little dihedral
  g.fillStyle=lin(0.1*k,0.55*k,'#F0F4F7','#98A6B1'); g.strokeStyle='rgba(30,44,56,.6)'; g.lineWidth=1;
  g.beginPath(); g.moveTo(-5.2*k,0.05*k); g.lineTo(-0.4*k,0.42*k); g.lineTo(0.4*k,0.42*k); g.lineTo(5.2*k,0.05*k); g.lineTo(5.2*k,0.22*k); g.lineTo(0.4*k,0.6*k); g.lineTo(-0.4*k,0.6*k); g.lineTo(-5.2*k,0.22*k); g.closePath(); g.fill(); g.stroke();
  // fuselage cross-section with canopy
  g.fillStyle=lin(-0.75*k,0.65*k,'#F4F7F9','#8A98A4'); g.beginPath(); g.ellipse?g.ellipse(0,0,0.62*k,0.66*k,0,0,7):g.arc(0,0,0.64*k,0,7); g.fill(); g.stroke();
  g.fillStyle=lin(-0.95*k,-0.3*k,'#3E6380','#16283A'); g.beginPath(); g.ellipse?g.ellipse(0,-0.42*k,0.42*k,0.36*k,0,Math.PI,0):g.arc(0,-0.42*k,0.4*k,Math.PI,0); g.closePath(); g.fill();
  g.fillStyle='#E46BAE'; g.fillRect(-0.62*k,0.02*k,1.24*k,0.08*k);
  // gear
  g.strokeStyle='#5B6B78'; g.lineWidth=Math.max(1.2,k*0.1); [-1,1].forEach(sd=>{ g.beginPath(); g.moveTo(sd*0.5*k,0.55*k); g.lineTo(sd*1.0*k,1.25*k); g.stroke(); g.fillStyle='#1B242C'; g.beginPath(); g.ellipse?g.ellipse(sd*1.0*k,1.3*k,0.14*k,0.22*k,0,0,7):g.arc(sd*k,1.3*k,0.18*k,0,7); g.fill(); });
  g.restore(); }

/* ---------------- master view ---------------- */
const AN={t:0,gx:0,turn:0,last:0};
const fm=LAB.fit(el('fmCv'),()=>drawM(),2);
function drawM(){ const st=fm; if(!st.w||!R) return; const g=clear(st), n=narrow(st); if(F.phi>0.5) turnView(st,g,n); else sideView(st,g,n); }
function sideView(st,g,n){ const W=st.w, H=st.h, fs=n?10:11.5;
  // sky and ground (ground slides past at ground speed)
  const sky=g.createLinearGradient(0,0,0,H); sky.addColorStop(0,'#0E161C'); sky.addColorStop(1,'#16222B'); g.fillStyle=sky; g.fillRect(0,0,W,H);
  const gy=H*0.9; g.fillStyle='#131C22'; g.fillRect(0,gy,W,H-gy); dline(g,0,gy,W,gy,'#2A3742',1);
  const sp=46; g.strokeStyle='#22313C'; g.lineWidth=1; for(let x=-((AN.gx%sp)+sp)%sp;x<W;x+=sp){ g.beginPath(); g.moveTo(x,gy+3); g.lineTo(x-12,H); g.stroke(); }
  const cx=W*(n?0.5:0.42), cy=H*(n?0.5:0.47), ga=R.gam*D2R;
  // horizon reference and flight path through the CG
  dline(g,cx-W*0.4,cy,cx+W*0.5,cy,'rgba(139,153,167,.22)',1,[2,5]);
  const pl=W*0.6; dline(g,cx-Math.cos(ga)*pl,cy+Math.sin(ga)*pl,cx+Math.cos(ga)*pl,cy-Math.sin(ga)*pl,'rgba(127,203,232,.4)',1.2,[7,6]);
  if(!n) txt(g,L({en:'flight path',no:'flybane'}),cx+Math.cos(ga)*(n?W*0.36:W*0.44),cy-Math.sin(ga)*(n?W*0.36:W*0.44)-8,{col:'rgba(127,203,232,.7)',al:'center',size:fs-1,mono:1});
  if(Math.abs(R.gam)>0.4){ const rr=n?54:74; g.strokeStyle=INK.amber; g.lineWidth=1.5; g.beginPath(); g.arc(cx,cy,rr,Math.min(0,-ga),Math.max(0,-ga)); g.stroke(); txt(g,'γ '+nf(R.gam,1)+'°',cx+rr+8,cy-Math.sin(ga/2)*rr+4,{col:INK.amber,size:fs,mono:1,bg:BG}); }
  const sc=Math.min(W*(n?0.04:0.034),H*0.058);
  plane(g,cx,cy,sc,R.th,AN.t);
  // forces to scale (W = fixed length); T and D optionally ×4
  const f=H*(n?0.26:0.30)/R.W, m=F.mag?MAG(n):1, u=[Math.cos(ga),-Math.sin(ga)], nrm=[-Math.sin(ga),-Math.cos(ga)];
  const Lp=R.Lf*f, Wp=R.W*f, Tp=Math.max(0,R.T)*f*m, Dp=R.D*f*m;
  if(Math.abs(R.gam)>0.4){ // weight components
    const wa=R.W*Math.sin(ga)*f, wn=R.W*Math.cos(ga)*f;
    dline(g,cx,cy,cx-u[0]*wa,cy-u[1]*wa,'rgba(238,243,247,.55)',1.4,[4,3]); dline(g,cx-u[0]*wa,cy-u[1]*wa,cx,cy+Wp,'rgba(238,243,247,.3)',1,[2,3]);
    txt(g,'W·sin γ',cx-u[0]*wa+(R.gam>0?-8:8),cy-u[1]*wa+(R.gam>0?14:-6),{col:INK.mute,al:R.gam>0?'right':'left',size:fs-1,mono:1}); }
  arrow(g,cx,cy,cx,cy+Wp,COL.W,3,10); txt(g,'W '+nf(R.W/1000,2)+' kN',cx+8,cy+Wp-2,{col:COL.W,size:fs,bg:BG});
  const lx=cx+nrm[0]*Lp, ly=cy+nrm[1]*Lp; arrow(g,cx,cy,lx,ly,COL.L,3,10); txt(g,'L '+nf(R.Lf/1000,2)+' kN',lx+8,ly+12,{col:COL.L,size:fs,bg:BG});
  const nose=[cx+u[0]*sc*3.9,cy+u[1]*sc*3.9], tail=[cx-u[0]*sc*4.9,cy-u[1]*sc*4.9];
  if(Tp>1){ arrow(g,nose[0],nose[1],nose[0]+u[0]*Tp,nose[1]+u[1]*Tp,COL.T,3,10); txt(g,'T '+nf(R.T/1000,2)+' kN',clamp(nose[0]+u[0]*Tp,44,W-44),nose[1]+u[1]*Tp-10,{col:COL.T,al:'center',size:fs,bg:BG}); }
  arrow(g,tail[0],tail[1],tail[0]-u[0]*Dp,tail[1]-u[1]*Dp,COL.D,3,10); txt(g,'D '+nf(R.D/1000,2)+' kN',clamp(tail[0]-u[0]*Dp,44,W-44),tail[1]-u[1]*Dp-10,{col:COL.D,al:'center',size:fs,bg:BG});
  el('mag').textContent=L({en:'Thrust and drag ×',no:'Skyv og motstand ×'})+MAG(n); if(F.mag) txt(g,L({en:'T and D drawn ×',no:'T og D tegnet ×'})+MAG(n),W-10,H-10,{col:INK.mute,al:'right',size:10,mono:1});
  // force polygon: true scale, closed when steady
  polygon(g,n?{x:62,y:H*0.06,s:H*0.15}:{x:W-118,y:H*0.13,s:H*0.2},fs);
  if(R.stall) txt(g,L({en:'STALL',no:'STEILING'}),cx,H*0.12,{col:INK.red,al:'center',size:n?14:18,w:700,bg:BG});
}
function polygon(g,b,fs){ const f=b.s/R.W, ga=R.gam*D2R, u=[Math.cos(ga),-Math.sin(ga)], nrm=[-Math.sin(ga),-Math.cos(ga)];
  let p=[b.x,b.y]; const seq=[['W',[0,R.W*f],COL.W],['L',[nrm[0]*R.Lf*f,nrm[1]*R.Lf*f],COL.L],['T',[u[0]*Math.max(0,R.T)*f,u[1]*Math.max(0,R.T)*f],COL.T],['D',[-u[0]*R.D*f,-u[1]*R.D*f],COL.D]];
  g.fillStyle='rgba(24,35,44,.7)'; g.fillRect(b.x-50,b.y-14,108,b.s+30);
  txt(g,L({en:'force polygon',no:'kraftpolygon'}),b.x+4,b.y-2,{col:INK.mute,al:'center',size:9.5,mono:1});
  p=[b.x+20,b.y+6]; const p0=p.slice();
  for(const [k,d,c] of seq){ const q=[p[0]+d[0],p[1]+d[1]]; arrow(g,p[0],p[1],q[0],q[1],c,1.8,6); p=q; }
  const gap=Math.hypot(p[0]-p0[0],p[1]-p0[1]); txt(g,gap<2.5?L({en:'closed: steady',no:'lukket: stabil'}):L({en:'open: accelerating',no:'åpen: akselererer'}),b.x+4,b.y+b.s+12,{col:gap<2.5?INK.green:INK.amber,al:'center',size:9.5,mono:1}); }
function turnView(st,g,n){ const W=st.w, H=st.h, fs=n?10:11.5;
  let a,b; if(n){ a={x:0,y:0,w:W,h:H*0.55}; b={x:0,y:H*0.55,w:W,h:H*0.45}; } else { a={x:0,y:0,w:W*0.5,h:H}; b={x:W*0.5,y:0,w:W*0.5,h:H}; }
  dline(g,n?10:b.x,n?b.y:12,n?W-10:b.x,n?b.y:H-12,'#1F2B35',1);
  // from behind: bank, lift and its components
  const cx=a.x+a.w/2, cy=a.y+a.h*(n?0.58:0.6), ph=F.phi*D2R, f=Math.min(a.h*0.3/R.W,a.h*0.46/(R.Lf));
  txt(g,L({en:'From behind',no:'Bakfra'}),a.x+10,a.y+(n?18:44),{col:INK.mute,size:fs,mono:1});
  dline(g,a.x+10,cy,a.x+a.w-10,cy,'rgba(139,153,167,.22)',1,[2,5]);
  const span=Math.min(a.w*(n?0.34:0.3),a.h*0.36), c=Math.cos(ph), s=Math.sin(ph);
  rear(g,cx,cy,span,F.phi);
  const Lp=R.Lf*f, lx=cx+s*Lp, ly=cy-c*Lp; // bank to the right: lift tilts right
  dline(g,cx,cy,cx,cy-c*Lp,'rgba(127,203,232,.6)',1.4,[4,3]); dline(g,cx,cy-c*Lp,lx,ly,'rgba(127,203,232,.35)',1,[2,3]);
  arrow(g,cx,cy-c*Lp,lx,ly,INK.green,2.6,9); arrow(g,cx,cy,lx,ly,COL.L,3.2,11);
  txt(g,'L = n·W',lx+8,ly+4,{col:COL.L,size:fs,bg:BG}); txt(g,'L·sin φ',(cx+lx)/2,ly-8,{col:INK.green,al:'center',size:fs-1,bg:BG}); txt(g,'L·cos φ = W',cx-8,cy-c*Lp*0.55,{col:'rgba(127,203,232,.9)',al:'right',size:fs-1,bg:BG});
  const Wp=R.W*f; arrow(g,cx,cy,cx,cy+Wp,COL.W,3,10); txt(g,'W',cx+8,cy+Wp-2,{col:COL.W,size:fs,bg:BG});
  const rr=span*0.62; g.strokeStyle=INK.amber; g.lineWidth=1.4; g.beginPath(); g.arc(cx,cy,rr,-Math.PI/2,-Math.PI/2+ph); g.stroke(); txt(g,'φ '+nf(F.phi,0)+'°',cx+rr*0.62*Math.sin(ph/2),cy-rr*0.62*Math.cos(ph/2)+4,{col:INK.amber,size:fs,mono:1});
  txt(g,'n = '+nf(R.n,2)+' g',a.x+10,a.y+a.h-12,{col:INK.ink,size:n?13:15,mono:1,w:500});
  if(R.stall) txt(g,L({en:'STALL',no:'STEILING'}),cx,a.y+(n?34:44),{col:INK.red,al:'center',size:n?14:18,w:700,bg:BG});
  // from above: the circle
  txt(g,L({en:'From above',no:'Ovenfra'}),b.x+10,b.y+(n?18:44),{col:INK.mute,size:fs,mono:1});
  const sc=Math.min(b.w,b.h)*0.36/Math.max(R.r,200), rp=R.r*sc, ox=b.x+b.w/2-Math.min(rp,b.w*0.6)*0, oy=b.y+b.h/2;
  const ccx=ox-rp*0+0, ccy=oy; // centre of the turn
  g.save(); g.beginPath(); g.rect(b.x+2,b.y+2,b.w-4,b.h-4); g.clip();
  g.strokeStyle='rgba(127,203,232,.5)'; g.lineWidth=1.6; g.setLineDash([6,5]); g.beginPath(); g.arc(ccx,ccy,rp,0,7); g.stroke(); g.setLineDash([]);
  const ang=AN.turn; const px=ccx+rp*Math.cos(ang), py=ccy+rp*Math.sin(ang);
  dline(g,ccx,ccy,px,py,INK.amber,1.4,[3,3]); g.fillStyle=INK.amber; g.beginPath(); g.arc(ccx,ccy,3,0,7); g.fill();
  txt(g,'r '+fmtR(R.r),ccx,ccy-10,{al:'center',col:INK.amber,size:fs,mono:1,bg:BG});
  // aircraft icon tangent to the circle (clockwise = right turn)
  g.save(); g.translate(px,py); g.rotate(ang+Math.PI); const k=n?1:1.25; g.fillStyle=INK.white;
  g.beginPath(); g.moveTo(0,-11*k); g.lineTo(2*k,-4*k); g.lineTo(12*k,-1*k); g.lineTo(12*k,2*k); g.lineTo(2*k,2*k); g.lineTo(1.5*k,8*k); g.lineTo(5*k,10*k); g.lineTo(-5*k,10*k); g.lineTo(-1.5*k,8*k); g.lineTo(-2*k,2*k); g.lineTo(-12*k,2*k); g.lineTo(-12*k,-1*k); g.lineTo(-2*k,-4*k); g.closePath(); g.fill();
  arrow(g,0,0,-sc*0+18*0,0,INK.green,1,1); g.restore();
  // centripetal force arrow (L·sin φ) toward the centre
  const cxv=ccx-px, cyv=ccy-py, cl=Math.hypot(cxv,cyv)||1; arrow(g,px,py,px+cxv/cl*Math.min(46,cl*0.6),py+cyv/cl*Math.min(46,cl*0.6),INK.green,2.2,8);
  g.restore();
  { const opts=[100,200,500,1000,2000,5000,10000], px=ft=>ft*FT*sc; let bar=opts[0]; for(const o of opts) if(px(o)<=b.w*0.32) bar=o; const x0=b.x+12, y0=b.y+b.h-(n?34:40); dline(g,x0,y0,x0+px(bar),y0,INK.mute,1.5); dline(g,x0,y0-4,x0,y0+4,INK.mute,1.5); dline(g,x0+px(bar),y0-4,x0+px(bar),y0+4,INK.mute,1.5); txt(g,nf(bar,0)+' ft',x0,y0-8,{col:INK.mute,size:10,mono:1}); }
  txt(g,nf(R.om,1)+' °/s · 360° '+L({en:'in',no:'på'})+' '+mmss(360/Math.max(0.01,R.om)),b.x+b.w-10,b.y+b.h-12,{col:INK.ink,al:'right',size:n?11:12.5,mono:1,bg:BG});
}
const fmtR=r=>!isFinite(r)?'∞':r*3.28084<10000?nf(r*3.28084,0)+' ft ('+nf(r/NM,2)+' NM)':nf(r/NM,1)+' NM';
const mmss=s=>{ if(!isFinite(s)||s>5999) return '–'; const m=Math.floor(s/60), x=Math.round(s%60); return m+':'+String(x).padStart(2,'0'); };

/* ---------------- profile over the ground ---------------- */
const fp=LAB.fit(el('fpCv'),()=>drawP(),2);
function drawP(){ const st=fp; if(!st.w||!R) return; const g=clear(st), W=st.w, H=st.h, n=narrow(st);
  const box={x:n?44:56,y:22,w:W-(n?56:76),h:H-(n?46:48)};
  const gG=R.gam*D2R, tanG=Math.tan(gG), gsr=R.gs/F.v; // height change per unit ground distance
  let xmax=5, h0=F.h, ymax, ymin=0;
  if(R.gam<-0.05){ xmax=Math.min(40,Math.max(2,Math.ceil(Math.max(R.dist,F.h*FT*R.glideAir/NM)*1.1))); ymax=Math.max(1000,Math.ceil(h0*1.1/1000)*1000); }
  else if(R.gam>0.05){ xmax=5; ymax=Math.ceil((h0+tanG/gsr*xmax*NM/FT)*1.1/1000)*1000; ymin=Math.floor(h0*0.9/1000)*1000; }
  else { ymax=Math.ceil((h0+1000)/1000)*1000; }
  ymax=Math.max(ymax,ymin+1000);
  const st2=xmax>20?5:xmax>8?2:1, xt=[]; for(let x=0;x<=xmax;x+=st2) xt.push(x);
  const ys=(ymax-ymin)>6000?2000:1000, yt=[]; for(let y=ymin;y<=ymax;y+=ys) yt.push(y);
  const ax=axes(g,box,[0,xmax],[ymin,ymax],{xt,yt,yf:v=>nf(v/1000,0)+'k'});
  txt(g,L({en:'Height (ft) against distance over the ground (NM)',no:'Høyde (ft) mot distanse over bakken (NM)'}),box.x,14,{col:INK.mute,size:10.5,mono:1});
  const hAt=(x,wind)=>h0+tanG*(wind?1/gsr:1)*x*NM/FT;
  g.save(); g.beginPath(); g.rect(box.x,box.y,box.w,box.h); g.clip();
  const pts=k=>{ const a=[]; for(let i=0;i<=60;i++){ const x=xmax*i/60, h=hAt(x,k); a.push([ax.X(x),ax.Y(Math.max(ymin,h))]); if(h<=0) break; } return a; };
  if(Math.abs(F.wind)>0.5) path(g,pts(false),'rgba(139,153,167,.8)',1.5,[5,4]);
  path(g,pts(true),R.gam<-0.05?INK.amber:R.gam>0.05?INK.green:INK.cyan,2.6);
  g.restore();
  if(R.gam<-0.05&&isFinite(R.dist)){ const xd=ax.X(Math.min(R.dist,xmax)); g.fillStyle=INK.amber; g.beginPath(); g.arc(xd,ax.Y(0),4.5,0,7); g.fill(); txt(g,nf(R.dist,1)+' NM',xd,ax.Y(0)-8,{col:INK.amber,al:'center',size:11,mono:1,bg:BG});
    if(Math.abs(F.wind)>0.5){ const d0=F.h*FT*R.glideAir/NM; if(d0<=xmax) txt(g,L({en:'still air ',no:'stille luft '})+nf(d0,1),ax.X(d0),ax.Y(0)-22,{col:INK.mute,al:'center',size:10,mono:1,bg:BG}); } }
  if(R.gam>0.05){ const h1=hAt(1,true)-h0; txt(g,'+'+nf(h1,0)+' ft / NM',ax.X(1)+6,ax.Y(hAt(1,true))-8,{col:INK.green,size:11,mono:1,bg:BG}); }
}

/* ---------------- drag / power curves ---------------- */
let dMode='d';
const fd=LAB.fit(el('fdCv'),()=>drawD(),2);
const cnFd=window.CN?CN.add(el('fdCv'),{read:()=>dMode==='p'?L({en:'Across: airspeed. Up: power. Red is the power the aircraft needs to fly level; pink is what the engine can give. The white dot is you.',no:'Bortover: fart. Oppover: effekt. Rød er effekten flyet trenger for å holde høyden; rosa er det motoren kan gi. Den hvite prikken er deg.'})
    :L({en:'Across: airspeed. Up: force. Red is the drag you must overcome to fly level; pink is the thrust available. The white dot is you.',no:'Bortover: fart. Oppover: kraft. Rød er motstanden du må overvinne for å holde høyden; rosa er skyvet som er tilgjengelig. Den hvite prikken er deg.'}),
  take:()=>dMode==='p'?L({en:'The widest gap between power available and power needed gives the best rate of climb (Vy); the tangent from zero touches the curve at best L/D.',no:'Det største gapet mellom tilgjengelig og nødvendig effekt gir beste stigehastighet (Vy); tangenten fra null treffer kurven ved beste L/D.'})
    :L({en:'Drag is U-shaped: least at VMD. Slower than VMD needs more thrust, not less (the back of the drag curve). The widest gap between thrust and drag gives the steepest climb (Vx).',no:'Motstanden er U-formet: minst ved VMD. Saktere enn VMD krever mer skyv, ikke mindre (baksiden av motstandskurven). Det største gapet mellom skyv og motstand gir den bratteste stigningen (Vx).'}),
  full:()=>drawD()}):null;
function drawD(){ const st=fd; if(!st.w||!R) return; const g=clear(st), W=st.w, H=st.h, n=narrow(st);
  const box={x:n?42:56,y:26,w:W-(n?54:76),h:H-(n?50:52)}, v0=40, v1=160, nn=R.n;
  const rows=[]; for(let v=v0;v<=v1;v+=1){ const d=drag(v,F.m,nn); rows.push({v,Dp:d.Dp,Di:d.Di,D:d.D,T1:tav(v,1),T:tav(v,F.mode==='power'?F.pw:Math.min(1,Math.max(0,R.pw)))}); }
  const pwr=dMode==='p', fy=r=>pwr?r*0+1:1;
  const val=(r,k)=>pwr?r[k]*r.v*KT/1000:r[k]/1000; // kW or kN
  let ymax=0; rows.forEach(r=>{ ymax=Math.max(ymax,Math.min(val(r,'D'),pwr?220:6),val(r,'T1')); }); ymax=pwr?Math.ceil(ymax*1.08/20)*20:Math.ceil(ymax*1.1*2)/2;
  const yt=[]; const ys=pwr?(ymax>120?40:20):(ymax>4?1:0.5); for(let y=0;y<=ymax+1e-9;y+=ys) yt.push(+y.toFixed(2));
  const ax=axes(g,box,[v0,v1],[0,ymax],{xt:[40,60,80,100,120,140,160],yt,yf:v=>nf(v,pwr?0:1)});
  txt(g,pwr?L({en:'Power, kW',no:'Effekt, kW'}):L({en:'Force, kN',no:'Kraft, kN'}),box.x,15,{col:INK.mute,size:10.5,mono:1}); txt(g,'KIAS',box.x+box.w,box.y+box.h+26,{col:INK.mute,al:'right',size:10,mono:1});
  const xs=ax.X(clamp(R.vsT,v0,v1)); g.fillStyle='rgba(236,90,71,.08)'; g.fillRect(box.x,box.y,xs-box.x,box.h); txt(g,'VS',xs-4,box.y+box.h-6,{col:INK.red,al:'right',size:10,mono:1});
  g.save(); g.beginPath(); g.rect(box.x,box.y,box.w,box.h); g.clip();
  const P=k=>rows.map(r=>[ax.X(r.v),ax.Y(val(r,k))]);
  const det=window.CN&&CN.full('fdCv');
  if(!pwr&&det){ path(g,P('Dp'),'rgba(127,203,232,.8)',1.4,[4,3]); path(g,P('Di'),'rgba(185,166,240,.9)',1.4,[4,3]); }
  path(g,P('T1'),'rgba(228,107,174,.55)',1.4,[6,4]); path(g,P('D'),INK.red,2.6); if(F.mode==='power'&&F.pw<0.99&&F.pw>0.01) path(g,P('T'),INK.mag,2);
  g.restore();
  const lab=(k,t,col,frac,dy)=>{ const r=rows[Math.floor(rows.length*frac)]; txt(g,t,ax.X(r.v),ax.Y(val(r,k))+(dy||-7),{col,al:'center',size:10.5,bg:BG}); };
  if(!pwr&&det){ lab('Dp',L({en:'parasite ∝ V²',no:'parasitt ∝ V²'}),INK.cyan,0.84,14); lab('Di',L({en:'induced ∝ 1/V²',no:'indusert ∝ 1/V²'}),INK.violet,0.12,-8); }
  // plain words: the two sides of the U, and (power) the bottom of the curve
  if(!det){ const fz=n?9.5:10.5, xv=ax.X(clamp(R.vmd,v0,v1)), xs2=ax.X(clamp(R.vsT,v0,v1)), ymid=box.y+box.h*0.5;
    if(!pwr){ if(xv-xs2>(n?60:84)) [L({en:'slower:',no:'saktere:'}),L({en:'more drag',no:'mer motstand'})].forEach((t,i)=>txt(g,t,(xs2+xv)/2,ax.Y(val(rows[Math.round(((R.vsT+R.vmd)/2)-v0)]||rows[0],'D'))-30+i*(fz+3),{col:'#F2A091',al:'center',size:fz,w:500,bg:BG}));
      txt(g,n?L({en:'faster: more drag',no:'fortere: mer motstand'}):L({en:'faster: more drag again',no:'fortere: mer motstand igjen'}),box.x+box.w-6,Math.min(box.y+box.h-30,ax.Y(val(rows[rows.length-8],'D'))+22),{col:'#F2A091',al:'right',size:fz,w:500,bg:BG}); }
    else { let rm=rows[0]; rows.forEach(r=>{ if(r.v>=R.vsT&&val(r,'D')<val(rm,'D')) rm=r; }); if(rm.v<R.vsT) rm=rows.find(r=>r.v>=R.vsT)||rm;
      const x=ax.X(rm.v), y=ax.Y(val(rm,'D')); g.fillStyle=INK.amber; g.beginPath(); g.arc(x,y,3.5,0,7); g.fill();
      txt(g,n?L({en:'least power',no:'minst effekt'}):L({en:'least power: longest endurance',no:'minst effekt: lengst utholdenhet'}),x,y-12,{col:INK.amber,al:'center',size:fz,w:500,bg:BG}); } }
  lab('D',pwr?L({en:'power required',no:'effekt som trengs'}):L({en:'total drag',no:'total motstand'}),INK.red,pwr?0.9:0.62,-9);
  lab('T1',pwr?L({en:'power available (100 %)',no:'tilgjengelig effekt (100 %)'}):L({en:'thrust available (100 %)',no:'tilgjengelig skyv (100 %)'}),INK.mag,0.2,-8);
  const mk=(v,t,col,row)=>{ if(v<v0||v>v1) return; const x=ax.X(v); dline(g,x,box.y,x,box.y+box.h,col,1.1,[3,3]); txt(g,t,x+4,box.y+box.h-24-row*15,{col,size:10.5,mono:1,bg:BG}); };
  if(pwr){ // tangent from the origin touches the power-required curve at VMD (best L/D)
    const r=rows.find(x=>Math.abs(x.v-R.vmd)<0.6)||rows[0]; const x1=ax.X(r.v), y1=ax.Y(val(r,'D')); const kx=(x1-ax.X(0))/(ax.Y(0)-y1);
    g.save(); g.beginPath(); g.rect(box.x,box.y,box.w,box.h); g.clip(); dline(g,ax.X(v0),ax.Y(val(r,'D')*v0/r.v),ax.X(v1),ax.Y(val(r,'D')*v1/r.v),'rgba(240,180,64,.6)',1,[2,3]); g.restore();
    mk(R.vy,'Vy '+nf(R.vy,0)+(n?'':' · '+L({en:'best rate of climb',no:'beste stigehastighet'})),INK.green,0); mk(R.vmd,'VMD '+nf(R.vmd,0)+' · '+L({en:'best L/D',no:'beste L/D'}),INK.amber,1); }
  else { mk(R.vx,'Vx '+nf(R.vx,0)+(n?'':' · '+L({en:'best angle of climb',no:'beste stigevinkel'})),INK.green,0); mk(R.vmd,'VMD '+nf(R.vmd,0)+' · '+L({en:'min drag, best glide',no:'min motstand, beste glid'}),INK.amber,1); }
  const xc=ax.X(clamp(F.v,v0,v1)); dline(g,xc,box.y,xc,box.y+box.h,'rgba(238,243,247,.5)',1,[2,3]);
  const d=drag(F.v,F.m,nn), yv=pwr?d.D*F.v*KT/1000:d.D/1000; g.fillStyle=R.stall?INK.red:INK.white; g.beginPath(); g.arc(xc,ax.Y(Math.min(yv,ymax)),5,0,7); g.fill(); g.strokeStyle=INK.bg; g.lineWidth=1.5; g.stroke();
}
el('dcMode').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; dMode=b.dataset.m; el('dcMode').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); drawD(); if(cnFd) cnFd.refresh(); });

/* ---------------- controls ---------------- */
const modeSeg=LAB.seg(el('mode'),[['power','Power'],['path','Path angle']],F.mode,v=>{ if(v==='path'&&R){ F.gam=Math.round(clamp(R.gam,-8,10)*2)/2; } else if(R){ F.pw=clamp(Math.round(R.pw*20)/20,0,1); } F.mode=v; cur=null; all(); });
const sl=o=>LAB.slider(el('ctl'),o), sl2=o=>LAB.slider(el('ctl2'),o);
const S={};
S.v=sl({label:'Indicated airspeed (kt)',min:45,max:150,step:1,v:F.v,f:v=>v+' kt',on:v=>{ F.v=v; cur=null; all(); }});
S.m=sl2({label:'Mass (kg)',min:750,max:1150,step:10,v:F.m,f:v=>nf(v,0)+' kg',on:v=>{ F.m=v; cur=null; all(); }});
S.pw=sl({label:'Power (%)',min:0,max:100,step:1,v:F.pw*100,f:v=>F.mode==='power'?v+' %':(R?nf(R.pw*100,0)+' % '+L({en:'needed',no:'trengs'}):''),on:v=>{ F.pw=v/100; cur=null; all(); },hint:'In path mode: the power needed'});
S.gam=sl({label:'Flight path angle (°)',min:-10,max:10,step:0.5,v:F.gam,f:v=>F.mode==='path'?nf(v,1)+'°':(R?nf(R.gam,1)+'° '+L({en:'result',no:'resultat'}):''),on:v=>{ F.gam=v; cur=null; all(); },hint:'In power mode: the result'});
S.phi=sl({label:'Bank angle (°)',min:0,max:70,step:1,v:F.phi,f:v=>v+'°',on:v=>{ F.phi=v; cur=null; all(); }});
S.wind=sl({label:'Wind (kt, + = headwind)',min:-30,max:40,step:1,v:F.wind,f:v=>v===0?L({en:'calm',no:'stille'}):(v>0?v+' kt '+L({en:'head',no:'mot'}):-v+' kt '+L({en:'tail',no:'med'})),on:v=>{ F.wind=v; cur=null; all(); }});
S.h=sl2({label:'Height above ground (ft)',min:500,max:10000,step:100,v:F.h,f:v=>nf(v,0)+' ft',on:v=>{ F.h=v; cur=null; all(); },hint:'Used for the glide distance and the profile'});
function syncCtl(){ S.pw.inp.disabled=F.mode!=='power'; S.gam.inp.disabled=F.mode!=='path';
  if(F.mode==='path'){ S.pw.inp.value=clamp(R.pw*100,0,100); } else { S.gam.inp.value=clamp(R.gam,-10,10); }
  // refresh outputs
  S.v.set(F.v); S.m.set(F.m); S.phi.set(F.phi); S.wind.set(F.wind); S.h.set(F.h);
  if(F.mode==='power'){ S.pw.set(F.pw*100); S.gam.set(clamp(R.gam,-10,10)); } else { S.gam.set(F.gam); S.pw.set(clamp(R.pw*100,0,100)); } }
el('mag').onclick=()=>{ F.mag=!F.mag; el('mag').classList.toggle('on',F.mag); el('mag').setAttribute('aria-pressed',String(F.mag)); drawM(); };

/* presets (instructor) and phases */
const rate1=v=>Math.round(Math.atan(v*KT*3*D2R/g0)/D2R);
const PRE=[
 ['level','level',{en:'Level 100 kt',no:'Rett fram 100 kt'},()=>({mode:'path',gam:0,phi:0,v:100,wind:0})],
 ['slow','level',{en:'Level 65 kt',no:'Rett fram 65 kt'},()=>({mode:'path',gam:0,phi:0,v:65,wind:0})],
 ['vx','climb',{en:'Climb at Vx',no:'Stig på Vx'},()=>({mode:'power',pw:1,phi:0,v:Math.round(vx(F.m,1)),wind:0})],
 ['vy','climb',{en:'Climb at Vy',no:'Stig på Vy'},()=>({mode:'power',pw:1,phi:0,v:Math.round(vy(F.m,1)),wind:0})],
 ['glide','glide',{en:'Best glide',no:'Beste glid'},()=>({mode:'power',pw:0,phi:0,v:Math.round(vmd(F.m)),wind:0,h:5000})],
 ['ghw','glide',{en:'Glide, 20 kt headwind',no:'Glid, 20 kt motvind'},()=>({mode:'power',pw:0,phi:0,v:Math.round(vmd(F.m)),wind:20,h:5000})],
 ['app','glide',{en:'3° approach',no:'3° innflyging'},()=>({mode:'path',gam:-3,phi:0,v:70,wind:0,h:1000})],
 ['r1','turn',{en:'Rate-one turn 100 kt',no:'Rate one-sving 100 kt'},()=>({mode:'path',gam:0,phi:rate1(100),v:100,wind:0})],
 ['t60','turn',{en:'60° bank, 2 g',no:'60° krengning, 2 g'},()=>({mode:'path',gam:0,phi:60,v:110,wind:0})],
 ['tst','turn',{en:'60° bank, too slow',no:'60° krengning, for sakte'},()=>({mode:'path',gam:0,phi:60,v:68,wind:0})]];
const PH=[['level',{en:'Straight and level',no:'Rett fram'}],['climb',{en:'Climb',no:'Stigning'}],['glide',{en:'Descent and glide',no:'Nedstigning og glid'}],['turn',{en:'Turn',no:'Sving'}]];
let cur='level';
const phase=()=>F.phi>0.5?'turn':R.gam>0.3?'climb':R.gam<-0.3?'glide':'level';
function setF(o,k){ Object.assign(F,o); cur=k||null; modeSeg.set(F.mode); all(); }
function drawPre(){ el('pre').innerHTML=`<span class="k">${L({en:'Presets',no:'Forhåndsvalg'})}</span>`+PRE.map(([k,,t])=>`<button class="btn sm${k===cur?' on':''}" type="button" data-k="${k}">${L(t)}</button>`).join('');
  const p=phase(); el('ph').innerHTML=PH.map(([k,t])=>`<button type="button" role="tab" aria-selected="${k===p}" data-p="${k}" class="${k===p?'on':''}">${L(t)}</button>`).join(''); }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const p=PRE.find(x=>x[0]===b.dataset.k); if(p) setF(p[3](),p[0]); });
el('ph').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const p=PRE.find(x=>x[1]===b.dataset.p&&x[0]!=='slow'); const q=b.dataset.p==='climb'?PRE.find(x=>x[0]==='vy'):p; if(q) setF(q[3](),q[0]); });

/* ---------------- readouts ---------------- */
const kN=v=>nf(v/1000,2)+' kN', fpm=v=>(v>0.5?'+':v<-0.5?'−':'')+nf(Math.abs(v),0)+' ft/min';
function read(){ const r=R, p=phase();
  const K={level:[[{en:'Lift / drag',no:'Løft / motstand'},nf(r.LD,1),'hl',{en:`max ${nf(LDmax,1)} at ${nf(r.vmd,0)} kt`,no:`maks ${nf(LDmax,1)} ved ${nf(r.vmd,0)} kt`}],[{en:'Power needed',no:'Effekt som trengs'},nf(r.pw*100,0)+' %',r.pw>1?'bad':'',{en:'of 180 hp available',no:'av 180 hk tilgjengelig'}],[{en:'Drag = thrust',no:'Motstand = skyv'},kN(r.D),'',{en:`parasite ${nf(r.Dp/r.D*100,0)} % · induced ${nf(r.Di/r.D*100,0)} %`,no:`parasitt ${nf(r.Dp/r.D*100,0)} % · indusert ${nf(r.Di/r.D*100,0)} %`}],[{en:'Stall speed',no:'Steilefart'},nf(r.vsT,0)+' kt',r.stall?'bad':'',{en:'1 g, clean',no:'1 g, rent'}]],
    climb:[[{en:'Rate of climb',no:'Stigehastighet'},fpm(r.roc),'hl',{en:'V · sin γ',no:'V · sin γ'}],[{en:'Climb gradient',no:'Stigegradient'},nf(r.gradGnd,1)+' %','',{en:`over the ground · ${nf(r.gradAir,1)} % in the air`,no:`over bakken · ${nf(r.gradAir,1)} % i lufta`}],[{en:'Vx · best angle',no:'Vx · beste vinkel'},nf(r.vx,0)+' kt','',{en:'most excess thrust',no:'mest overskuddsskyv'}],[{en:'Vy · best rate',no:'Vy · beste stigehastighet'},nf(r.vy,0)+' kt','',{en:'most excess power',no:'mest overskuddseffekt'}]],
    glide:[[{en:'Glide ratio (air)',no:'Glidetall (luft)'},isFinite(r.glideAir)?nf(r.glideAir,1)+' : 1':'–','hl',{en:`= L/D ${nf(r.LD,1)} power off`,no:`= L/D ${nf(r.LD,1)} uten motor`}],[{en:`Distance from ${nf(F.h,0)} ft`,no:`Distanse fra ${nf(F.h,0)} ft`},isFinite(r.dist)?nf(r.dist,1)+' NM':'–','',{en:F.wind?`with ${Math.abs(F.wind)} kt ${F.wind>0?'headwind':'tailwind'}`:'still air',no:F.wind?`med ${Math.abs(F.wind)} kt ${F.wind>0?'motvind':'medvind'}`:'stille luft'}],[{en:'Rate of descent',no:'Synkehastighet'},fpm(r.roc),'',{en:`GS ${nf(r.gs,0)} kt`,no:`GS ${nf(r.gs,0)} kt`}],[{en:'Best glide speed',no:'Beste glidefart'},nf(r.vmd,0)+' kt','',{en:'VMD: maximum L/D, still air',no:'VMD: maks L/D, stille luft'}]],
    turn:[[{en:'Load factor',no:'Lastfaktor'},nf(r.n,2)+' g','hl',{en:'n = 1 / cos φ',no:'n = 1 / cos φ'}],[{en:'Turn radius',no:'Svingradius'},fmtR(r.r),'',{en:'r = V² / (g·tan φ)',no:'r = V² / (g·tan φ)'}],[{en:'Rate of turn',no:'Svinghastighet'},nf(r.om,1)+' °/s','',{en:`rate one at ${rate1(F.v)}° (≈ ${Math.round(F.v/10+7)}°)`,no:`rate one ved ${rate1(F.v)}° (≈ ${Math.round(F.v/10+7)}°)`}],[{en:'Stall speed in the turn',no:'Steilefart i svingen'},nf(r.vsT,0)+' kt',r.stall?'bad':'',{en:`VS ${nf(r.vs,0)} × √n = ×${nf(Math.sqrt(r.n),2)}`,no:`VS ${nf(r.vs,0)} × √n = ×${nf(Math.sqrt(r.n),2)}`}]]}[p];
  el('fK').innerHTML=K.map(a=>`<div class="kpi"><span>${L(a[0])}</span><b class="${a[2]||''}">${String(a[1]).replace(/^(\S+) (.+)$/,'$1<small> $2</small>')}</b>${a[3]?`<small>${L(a[3])}</small>`:''}</div>`).join('');
  const rows=[[{en:'Lift L',no:'Løft L'},kN(r.Lf)+(Math.abs(r.Lf-r.W)>5?` (${nf(r.Lf/r.W*100,0)} % ${L({en:'of W',no:'av W'})})`:'')],[{en:'Weight W',no:'Vekt W'},kN(r.W)],[{en:'Thrust T',no:'Skyv T'},kN(Math.max(0,r.T))],[{en:'Drag D',no:'Motstand D'},kN(r.D)],
    [{en:'Lift / drag',no:'Løft / motstand'},nf(r.LD,1)],[{en:'Flight path angle γ',no:'Banevinkel γ'},nf(r.gam,1)+'°'],[{en:'Angle of attack (wing)',no:'Angrepsvinkel (vinge)'},nf(r.al,1)+'°',r.stall?'bad':''],[{en:'Vertical speed',no:'Vertikalfart'},fpm(r.roc)],[{en:'Ground speed',no:'Fart over bakken'},nf(r.gs,0)+' kt'],
    [{en:'Load factor n',no:'Lastfaktor n'},nf(r.n,2)+' g'],[{en:'Power',no:'Effekt'},nf(Math.max(0,r.pw)*100,0)+' %'+(F.mode==='path'?' '+L({en:'needed',no:'trengs'}):''),r.pw>1?'bad':'']];
  const rr=x=>`<div class="rrow"><span>${L(x[0])}</span><b class="${x[2]||''}">${x[1]}</b></div>`;
  el('fR').innerHTML=rows.slice(0,5).map(rr).join('')+`<div class="deep">${rows.slice(5).map(rr).join('')}</div>`;
  el('warn').textContent=r.warn?L(r.warn):'';
  { const H2=(k,v,c)=>`<span><i>${k}</i><b${c?` class="${c}"`:''}>${v}</b></span>`;
    el('fmOv').innerHTML=`<span class="ph"><i>${L({en:'Phase',no:'Fase'})}</i><b>${L(PH.find(x=>x[0]===p)[1])}</b></span>`+H2('IAS',nf(F.v,0)+' kt')+H2('γ',nf(r.gam,1)+'°')+H2('n',nf(r.n,2)+' g')+H2('L/D',nf(r.LD,1))+H2(L({en:'Power',no:'Effekt'}),nf(Math.max(0,r.pw)*100,0)+' %',r.pw>1?'r':'')+(r.stall?H2('',L({en:'STALL',no:'STEILING'}),'r'):''); }
}
function all(){ R=solve(F); read(); syncCtl(); drawPre(); drawM(); drawP(); drawD(); if(typeof live==='function') live(); }

/* animation: ground slides by at ground speed, the turn goes round at the real rate */
let raf=0, vis=false;
function tick(t){ raf=0; const dt=Math.min(0.05,(t-(AN.last||t))/1000); AN.last=t; if(!reduce){ AN.t+=dt; AN.gx+=dt*R.gs*0.9*Math.cos(R.gam*D2R); AN.turn+=dt*R.om*D2R; } drawM(); if(vis&&!reduce) raf=requestAnimationFrame(tick); }
LAB.visible(el('fmCv'),v=>{ vis=v; if(v&&!raf){ AN.last=0; raf=requestAnimationFrame(tick); } });

/* ---------------- text ---------------- */
on(()=>{
  el('fLead').innerHTML=L({en:'Four forces act on an aircraft in flight. When they balance, the aircraft flies at constant speed in a straight line: <b>steady flight</b>, which can be level, climbing or descending. When they do not, it accelerates or changes direction.',no:'Fire krefter virker på et fly i luften. Når de er i balanse, flyr flyet med konstant fart i rett linje: <b>stasjonær flyging</b>, som kan være rett fram, stigning eller nedstigning. Når de ikke er det, akselererer flyet eller endrer retning.'});
  const C=[[COL.L,{en:'Lift',no:'Løft'},{en:'The aerodynamic force at right angles to the relative airflow (the flight path), not "upwards". L = ½ρV²·S·CL.',no:'Den aerodynamiske kraften vinkelrett på den relative luftstrømmen (flybanen), ikke «oppover». L = ½ρV²·S·CL.'},'L ⟂ path'],
    ['#C9D3DA',{en:'Weight',no:'Vekt'},{en:'Mass times gravity, always straight down towards the centre of the earth, acting through the centre of gravity. W = m·g.',no:'Masse ganger tyngdeakselerasjon, alltid rett ned mot jordens sentrum, gjennom tyngdepunktet. W = m·g.'},'W ↓'],
    [COL.T,{en:'Thrust',no:'Skyv'},{en:'From the propeller or engine, along the thrust line. In this model it acts along the flight path. A propeller’s thrust falls as speed rises: T ≈ η·P / V.',no:'Fra propellen eller motoren, langs skyvlinjen. I denne modellen virker den langs flybanen. Skyvet fra en propell faller når farten øker: T ≈ η·P / V.'},'T → path'],
    [COL.D,{en:'Drag',no:'Motstand'},{en:'The aerodynamic force along the relative airflow, opposing motion. Parasite drag grows with V²; induced drag, the price of making lift, falls with 1/V².',no:'Den aerodynamiske kraften langs den relative luftstrømmen, mot bevegelsen. Parasittmotstand vokser med V²; indusert motstand, prisen for å lage løft, faller med 1/V².'},'D ← path']];
  el('fourC').innerHTML=C.map(([c,t,d,sym])=>`<div class="box" style="--c:${c}"><b class="t">${L(t)}</b><span class="sym">${sym}</span><p>${L(d)}</p></div>`).join('');
  const D=[[{en:'Flight path angle γ',no:'Banevinkel γ'},{en:'Angle between the flight path and the horizon. Steady: <code>sin γ = (T − D) / W</code>.',no:'Vinkelen mellom flybanen og horisonten. Stasjonært: <code>sin γ = (T − D) / W</code>.'}],
    [{en:'Climb gradient vs rate of climb',no:'Stigegradient mot stigehastighet'},{en:'Gradient is height per distance (<code>tan γ</code>, in %): obstacles. Rate is height per time (<code>V·sin γ</code>, ft/min): time to altitude.',no:'Gradient er høyde per distanse (<code>tan γ</code>, i %): hindringer. Stigehastighet er høyde per tid (<code>V·sin γ</code>, ft/min): tid til høyden.'}],
    [{en:'Glide ratio',no:'Glidetall'},{en:'Power off, <code>tan γ = D / L</code>, so the glide ratio equals L/D. Best at VMD, the minimum-drag speed.',no:'Uten motor er <code>tan γ = D / L</code>, så glidetallet er lik L/D. Best ved VMD, farten med minst motstand.'}],
    [{en:'Load factor n',no:'Lastfaktor n'},{en:'<code>n = L / W</code>. In a level turn <code>n = 1 / cos φ</code>: 60° of bank needs 2 g, and the stall speed rises by <code>√n</code>.',no:'<code>n = L / W</code>. I en vannrett sving er <code>n = 1 / cos φ</code>: 60° krengning krever 2 g, og steilefarten øker med <code>√n</code>.'}]];
  el('defs').innerHTML=D.map(([t,d])=>`<div><b>${L(t)}</b>${L(d)}</div>`).join('');
  el('mLead').innerHTML=L({en:'One aircraft, four phases. Choose what you set: <b>Power</b> (the path angle follows) or <b>Path angle</b> (the power needed follows). Lift, weight, thrust and drag are drawn to the same scale; when the force polygon closes, the flight is steady. Bank the aircraft and the view changes to the turn.',no:'Ett fly, fire faser. Velg hva du styrer: <b>Effekt</b> (banevinkelen følger) eller <b>Banevinkel</b> (effekten som trengs følger). Løft, vekt, skyv og motstand er tegnet i samme skala; når kraftpolygonet lukker seg, er flygingen stasjonær. Krengt flyet, og visningen bytter til svingen.'});
  el('tryLead').innerHTML=L({en:'Five short tasks. The first two you do in the model above, with live feedback; the last three you answer here, then see them in the model.',no:'Fem korte oppgaver. De to første gjør du i modellen over, med fortløpende tilbakemelding; de tre siste svarer du på her, og ser dem så i modellen.'});
  const TK=[{en:'<b>Best glide first.</b> Engine failure: pitch for best glide (about VMD), then pick a field within reach. Into wind, add a few knots; never stretch a glide by slowing down.',no:'<b>Beste glid først.</b> Motorstans: still nesen for beste glid (omtrent VMD), og velg et jorde innen rekkevidde. I motvind legger du til noen knop; strekk aldri et glid ved å fly saktere.'},
    {en:'<b>Vx over obstacles, Vy to altitude.</b> Both are in the POH; both rise with mass and fall towards each other with altitude.',no:'<b>Vx over hindringer, Vy til høyden.</b> Begge står i POH; begge øker med massen og nærmer seg hverandre med høyden.'},
    {en:'<b>Bank costs margin.</b> 30° adds 7 % to the stall speed, 45° 19 %, 60° 41 %. A steep turn at low speed near the ground is where stalls happen.',no:'<b>Krengning koster margin.</b> 30° øker steilefarten med 7 %, 45° med 19 %, 60° med 41 %. En bratt sving i lav fart nær bakken er der steilinger skjer.'},
    {en:'<b>Rate one ≈ TAS/10 + 7.</b> 360° takes 2 minutes; radius grows with V², so the same bank at a higher speed needs much more room.',no:'<b>Rate one ≈ TAS/10 + 7.</b> 360° tar 2 minutter; radius øker med V², så samme krengning i høyere fart krever mye mer plass.'}];
  const DB=[[{en:'Lift is not always equal to weight',no:'Løft er ikke alltid lik vekt'},{en:'In a steady climb or descent L = W·cos γ, slightly less than W; the rest of the weight is carried by thrust (climb) or is what pulls you along the path (glide). In a level turn L = n·W, more than W.',no:'I stasjonær stigning eller nedstigning er L = W·cos γ, litt mindre enn W; resten av vekten bæres av skyvet (stigning) eller er det som drar deg langs banen (glid). I en vannrett sving er L = n·W, mer enn W.'}],
    [{en:'Vx and Vy',no:'Vx og Vy'},{en:'Vx gives the most excess thrust: the steepest climb, for obstacles. Vy gives the most excess power: the most height per minute. Vx is the slower of the two; they meet at the absolute ceiling.',no:'Vx gir mest overskuddsskyv: brattest stigning, for hindringer. Vy gir mest overskuddseffekt: mest høyde per minutt. Vx er den laveste av de to; de møtes ved absolutt topphøyde.'}],
    [{en:'Best glide and the wind',no:'Beste glid og vinden'},{en:'The glide ratio through the air is L/D, best at VMD and independent of mass (heavier just glides faster). Over the ground a headwind shortens the glide; fly a little faster into wind, a little slower downwind.',no:'Glidetallet gjennom lufta er L/D, best ved VMD og uavhengig av masse (tyngre glir bare fortere). Over bakken gjør motvind glidet kortere; fly litt fortere i motvind og litt saktere i medvind.'}],
    [{en:'Turning costs lift',no:'Sving koster løft'},{en:'Only L·cos φ holds the aircraft up, so lift must rise to n·W. That needs more angle of attack, gives more induced drag and raises the stall speed by √n: 41 % at 60°.',no:'Bare L·cos φ holder flyet oppe, så løftet må øke til n·W. Det krever mer angrepsvinkel, gir mer indusert motstand og øker steilefarten med √n: 41 % ved 60°.'}]];
  el('dbC').innerHTML=DB.map(([t,d],i)=>`<div class="box"><b class="t"><i>${i+1}</i>${L(t)}</b><p>${L(d)}</p></div>`).join('');
  el('takeH').textContent=L(t2('Pilot takeaways','Dette tar piloten med seg'));
  el('take').innerHTML=TK.map(x=>`<li>${L(x)}</li>`).join('');
  const EX=[{en:'<b>Steady flight means no acceleration</b>, not "lift = weight". Climbing at constant speed, thrust exceeds drag by W·sin γ.',no:'<b>Stasjonær flyging betyr ingen akselerasjon</b>, ikke «løft = vekt». I stigning med konstant fart er skyvet større enn motstanden med W·sin γ.'},
    {en:'<b>Rate-one turn</b> (3°/s, 360° in 2 min): bank ≈ TAS/10 + 7. Radius grows with V², rate falls with V.',no:'<b>Rate one-sving</b> (3°/s, 360° på 2 min): krengning ≈ TAS/10 + 7. Radius øker med V², svinghastigheten faller med V.'},
    {en:'<b>Mass</b>: heavier means higher VMD, Vx, Vy and stall speed, a lower rate of climb, but the same best glide ratio.',no:'<b>Masse</b>: tyngre gir høyere VMD, Vx, Vy og steilefart, lavere stigehastighet, men samme beste glidetall.'},
    {en:'<b>On the back of the drag curve</b> (below VMD), slower means more drag: the speed is unstable and you need more power to fly slower.',no:'<b>På baksiden av motstandskurven</b> (under VMD) betyr saktere mer motstand: farten er ustabil, og du trenger mer effekt for å fly saktere.'}];
  el('dbE').innerHTML=`<span class="k">${L({en:'Deep dive · what the examiner wants you to know',no:'Dypdykk · dette vil sensor at du skal kunne'})}</span>${EX.map(x=>`<p>${L(x)}</p>`).join('')}`;
  el('foot').innerHTML='<b>'+L({en:'Model and limitations.',no:'Modell og begrensninger.'})+'</b> '+L({en:`Teaching model of a light single-engine aircraft of our own design, illustrative only: wing area 16.2 m², span 11 m, CD0 0.032, Oswald factor 0.78 (k = ${nf(AC.k,4)}), CLmax 1.5 clean, 180 hp with a propeller efficiency of 0.8 and 3 kN static thrust. Sea level ISA, so IAS = TAS; thrust along the flight path; steady flight only (no accelerations, no flaps, no ground effect). Not flight manual data: use your aircraft’s POH/AFM.`,no:`Opplæringsmodell av et lett enmotors fly av eget design, bare illustrativ: vingeareal 16,2 m², spennvidde 11 m, CD0 0,032, Oswald-faktor 0,78 (k = ${nf(AC.k,4)}), CLmax 1,5 rent, 180 hk med propellvirkningsgrad 0,8 og 3 kN statisk skyv. Havnivå ISA, så IAS = TAS; skyv langs flybanen; bare stasjonær flyging (ingen akselerasjon, ingen flaps, ingen bakkeeffekt). Ikke flyhåndbokdata: bruk POH/AFM for ditt fly.`});
  drawTasks();
});


/* memory aid cards */
function maid(id,h,p){ const c=el(id); if(!c) return; c.querySelector('.eyebrow').textContent=L({en:'Memory aid',no:'Huskeregel'}); c.querySelector('h3').innerHTML=L(h); c.querySelector('p').innerHTML=L(p); }
on(()=>{ maid('maV',{en:'Vx = best angle, Vy = best rate',no:'Vx = beste vinkel, Vy = beste stigehastighet'},{en:'The <b>x</b> has the angles. Vx clears the obstacle (most height per mile); Vy reaches altitude soonest (most height per minute). Vx is always the slower of the two.',no:'<b>x</b> har vinklene. Vx klarer hindringen (mest høyde per distanse); Vy når høyden raskest (mest høyde per minutt). Vx er alltid den laveste av de to.'});
  maid('maR',{en:'Rate-one turn: bank ≈ TAS/10 + 7',no:'Rate one-sving: krengning ≈ TAS/10 + 7'},{en:'3° per second, 360° in 2 minutes. At 100 kt that is about 17°; at 120 kt about 19°.',no:'3° per sekund, 360° på 2 minutter. Ved 100 kt er det omtrent 17°; ved 120 kt omtrent 19°.'}); });
on(()=>{ const sw=c=>`<i style="background:${c}"></i>`;
  const lg=(c,t)=>`<span><i style="--c:${c}"></i>${L(t)}</span>`;
  el('cM').innerHTML=lg(COL.L,{en:'lift',no:'løft'})+lg(COL.W,{en:'weight',no:'vekt'})+lg(COL.T,{en:'thrust',no:'skyv'})+lg(COL.D,{en:'drag',no:'motstand'});
  el('mSee').innerHTML='<b>'+L({en:'What you are seeing:',no:'Dette ser du:'})+'</b> '+L({en:'the four forces drawn to scale. The small force polygon closes when the flight is steady. Bank the aircraft to see the turn from behind and from above.',no:'de fire kreftene tegnet i skala. Det lille kraftpolygonet lukker seg når flygingen er stasjonær. Krengt flyet for å se svingen bakfra og ovenfra.'});
  el('cP').innerHTML=L({en:'Your path over the ground from the set height (Advanced).',no:'Banen din over bakken fra valgt høyde (Avansert).'})+sw('#8B99A7')+L({en:'dashed: still air',no:'stiplet: stille luft'});
  el('cD').innerHTML=sw(INK.red)+L({en:'total drag',no:'total motstand'})+' = '+sw(INK.cyan)+L({en:'parasite',no:'parasitt'})+' + '+sw(INK.violet)+L({en:'induced',no:'indusert'})+sw(INK.mag)+L({en:'thrust available',no:'tilgjengelig skyv'})+'. '+L({en:'The dot is you. Switch to Power to find Vy.',no:'Prikken er deg. Bytt til Effekt for å finne Vy.'}); });
/* ---------------- Try tasks ---------------- */
const go=id=>{ const t=el(id); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); };
function bestGlideWind(m,h,w){ let best={v:0,d:0}; for(let v=60;v<=110;v+=0.5){ const r=solve({mode:'power',pw:0,phi:0,v,m,wind:w,h,gam:0}); if(r.dist>best.d) best={v,d:r.dist}; } return best; }
const t2=(en,no)=>({en,no});
let active=null; const ans={}, touched={};
const TASKS=[
 {k:'r1',model:1,q:t2('Set up a rate-one turn at 120 kt: level flight, 3°/s.','Sett opp en rate one-sving i 120 kt: vannrett, 3°/s.'),
  check:()=>{ const b=Math.atan(120*KT*3*D2R/g0)/D2R; if(Math.abs(F.v-120)>2) return {ok:0,m:t2(`Speed now ${nf(F.v,0)} kt: set 120 kt.`,`Farten er nå ${nf(F.v,0)} kt: sett 120 kt.`)};
    if(F.mode!=='path'||Math.abs(F.gam)>0.3) return {ok:0,m:t2('Hold level flight: Path angle mode, 0°.','Hold vannrett flyging: Banevinkel-modus, 0°.')};
    if(Math.abs(R.om-3)<=0.15) return {ok:1,m:t2(`Yes: ${nf(F.phi,0)}° gives ${nf(R.om,2)}°/s. Rule of thumb TAS/10 + 7 = 19°; exact ${nf(b,1)}°. Radius ${fmtR(R.r)}, n = ${nf(R.n,2)}.`,`Ja: ${nf(F.phi,0)}° gir ${nf(R.om,2)}°/s. Tommelfingerregel TAS/10 + 7 = 19°; nøyaktig ${nf(b,1)}°. Radius ${fmtR(R.r)}, n = ${nf(R.n,2)}.`)};
    return {ok:0,m:t2(`Now ${nf(R.om,2)}°/s at ${nf(F.phi,0)}°: ${R.om<3?'more':'less'} bank.`,`Nå ${nf(R.om,2)}°/s ved ${nf(F.phi,0)}°: ${R.om<3?'mer':'mindre'} krengning.`)}; }},
 {k:'vx',model:1,q:t2('Full power. Find the speed that gives the steepest climb over the ground: Vx.','Full effekt. Finn farten som gir brattest stigning over bakken: Vx.'),
  check:()=>{ if(F.mode!=='power'||F.pw<0.99) return {ok:0,m:t2('Choose Power mode and set 100 %.','Velg Effekt-modus og sett 100 %.')}; if(F.phi>0.5) return {ok:0,m:t2('Wings level: bank 0°.','Vingene vannrett: krengning 0°.')};
    const v=vx(F.m,1), Y=solve(Object.assign({},F,{v:vy(F.m,1)}));
    if(Math.abs(F.v-v)<=2) return {ok:1,m:t2(`Yes: about ${nf(v,0)} kt, ${nf(R.gradAir,1)} % (${nf(R.gradAir/100*6076,0)} ft per NM). At Vy (${nf(vy(F.m,1),0)} kt) you climb faster, ${nf(Y.roc,0)} against ${nf(R.roc,0)} ft/min, but less steeply: ${nf(Y.gradAir,1)} %.`,`Ja: omtrent ${nf(v,0)} kt, ${nf(R.gradAir,1)} % (${nf(R.gradAir/100*6076,0)} ft per NM). På Vy (${nf(vy(F.m,1),0)} kt) stiger du fortere, ${nf(Y.roc,0)} mot ${nf(R.roc,0)} ft/min, men slakere: ${nf(Y.gradAir,1)} %.`)};
    return {ok:0,m:t2(`Gradient now ${nf(R.gradAir,1)} % at ${nf(F.v,0)} kt. Watch the gradient readout and the drag chart: Vx is where thrust exceeds drag the most.`,`Gradient nå ${nf(R.gradAir,1)} % ved ${nf(F.v,0)} kt. Følg gradienten og motstandskurven: Vx er der skyvet overstiger motstanden mest.`)}; }},
 {k:'glide',q:t2('Engine failure at 5,000 ft above the ground. The field is 10 NM away, into a 20 kt headwind. Can you glide there?','Motorstans i 5 000 ft over bakken. Flyplassen er 10 NM unna, mot 20 kt motvind. Rekker du det i glidefly?'),
  opts:[t2('Yes, at best glide speed','Ja, på beste glidefart'),t2('Yes, if I fly slower to stay up longer','Ja, hvis jeg flyr saktere for å holde meg lenger oppe'),t2('No, not even with the best speed into wind','Nei, ikke engang med beste fart mot vinden'),t2('Only with a lighter aircraft','Bare med et lettere fly')],c:2,
  e:()=>{ const r0=solve({mode:'power',pw:0,phi:0,v:vmd(F.m),m:F.m,wind:0,h:5000}), r1=solve({mode:'power',pw:0,phi:0,v:vmd(F.m),m:F.m,wind:20,h:5000}), b=bestGlideWind(F.m,5000,20);
    return [t2(`Right. Glide ratio about ${nf(r0.glideAir,1)} : 1: ${nf(r0.dist,1)} NM in still air, only ${nf(r1.dist,1)} NM into 20 kt at ${nf(vmd(F.m),0)} kt. Flying faster, about ${nf(b.v,0)} kt, stretches it to ${nf(b.d,1)} NM: still short.`,`Riktig. Glidetall omtrent ${nf(r0.glideAir,1)} : 1: ${nf(r0.dist,1)} NM i stille luft, bare ${nf(r1.dist,1)} NM mot 20 kt ved ${nf(vmd(F.m),0)} kt. Fortere, omtrent ${nf(b.v,0)} kt, strekker det til ${nf(b.d,1)} NM: fortsatt for kort.`),
      t2(`Not quite. Into 20 kt you reach about ${nf(r1.dist,1)} NM at best-glide speed; the best you can do (about ${nf(b.v,0)} kt) is ${nf(b.d,1)} NM. Flying slower gives the headwind more time; mass does not change the glide ratio.`,`Ikke helt. Mot 20 kt når du omtrent ${nf(r1.dist,1)} NM på beste glidefart; det beste du får til (omtrent ${nf(b.v,0)} kt) er ${nf(b.d,1)} NM. Saktere gir motvinden mer tid; massen endrer ikke glidetallet.`)]; },
  show:()=>setF({mode:'power',pw:0,phi:0,v:Math.round(vmd(F.m)),wind:20,h:5000},'ghw')},
 {k:'stall',q:t2('Level turn at 60° of bank. The stall speed is now about…','Vannrett sving med 60° krengning. Steilefarten er nå omtrent …'),
  opts:[t2('the same as wings level','den samme som med vingene vannrett'),t2('1.4 times the 1 g stall speed','1,4 ganger steilefarten ved 1 g'),t2('2 times the 1 g stall speed','2 ganger steilefarten ved 1 g'),t2('1.2 times','1,2 ganger')],c:1,
  e:()=>{ const r=solve({mode:'path',gam:0,phi:60,v:110,m:F.m,wind:0,h:F.h,pw:0}); return [t2(`Right. n = 1/cos 60° = 2 g and VS rises by √2: from ${nf(r.vs,0)} to ${nf(r.vsT,0)} kt.`,`Riktig. n = 1/cos 60° = 2 g, og VS øker med √2: fra ${nf(r.vs,0)} til ${nf(r.vsT,0)} kt.`),t2(`Not quite. The load factor doubles (n = 2), but the stall speed goes with √n: ×1.41, ${nf(r.vs,0)} → ${nf(r.vsT,0)} kt.`,`Ikke helt. Lastfaktoren dobles (n = 2), men steilefarten følger √n: ×1,41, ${nf(r.vs,0)} → ${nf(r.vsT,0)} kt.`)]; },
  show:()=>setF({mode:'path',gam:0,phi:60,v:68,wind:0},'tst')},
 {k:'lift',q:t2('In a steady climb at Vy, lift is…','I en stasjonær stigning på Vy er løftet …'),
  opts:[t2('greater than weight','større enn vekten'),t2('equal to weight','lik vekten'),t2('slightly less than weight','litt mindre enn vekten'),t2('zero','null')],c:2,
  e:()=>{ const r=solve(Object.assign({},F,PRE.find(x=>x[0]==='vy')[3]())); return [t2(`Right: L = W·cos γ = ${nf(r.Lf/1000,2)} kN against W = ${nf(r.W/1000,2)} kN. Thrust carries W·sin γ along the path: T − D = ${nf((r.T-r.D)/1000,2)} kN.`,`Riktig: L = W·cos γ = ${nf(r.Lf/1000,2)} kN mot W = ${nf(r.W/1000,2)} kN. Skyvet bærer W·sin γ langs banen: T − D = ${nf((r.T-r.D)/1000,2)} kN.`),t2(`Not quite. Lift acts at right angles to the path. In a climb it balances only W·cos γ: ${nf(r.Lf/1000,2)} kN against W ${nf(r.W/1000,2)} kN. Look at the force polygon.`,`Ikke helt. Løftet virker vinkelrett på banen. I stigning balanserer det bare W·cos γ: ${nf(r.Lf/1000,2)} kN mot W ${nf(r.W/1000,2)} kN. Se på kraftpolygonet.`)]; },
  show:()=>setF(PRE.find(x=>x[0]==='vy')[3](),'vy')}];
function drawTasks(){ el('tasks').innerHTML=TASKS.map((t,i)=>`<li class="task" id="task-${t.k}"><span class="n">${L(t2('Task','Oppgave'))} ${i+1}</span><p class="q">${L(t.q)}</p>`+
   (t.model?`<div class="btns"><button type="button" class="btn pri sm" data-go="${t.k}">${L(t2('Do it in the model','Gjør det i modellen'))} ↑</button></div><span class="fb" id="fb-${t.k}"></span>`:'')+
   (t.opts?(()=>{ const a=ans[t.k], e=a!=null?t.e():null; return `<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-t="${t.k}" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${e?L(e[a===t.c?0:1]):''}</span><div class="btns"><button type="button" class="btn sm" data-show="${t.k}">${L(t2('Show it in the model','Vis i modellen'))} ↑</button></div>`; })():'')+`</li>`).join('');
  live(); drawTbox(); }
function drawTbox(){ const b=el('tbox'); if(!active){ b.hidden=true; return; } const i=TASKS.findIndex(t=>t.k===active);
  b.hidden=false; b.innerHTML=`<span class="k">${L(t2('Task','Oppgave'))} ${i+1}<button type="button" aria-label="${L(t2('Close the task','Lukk oppgaven'))}" id="tclose">×</button></span>${L(TASKS[i].q)}<span class="fb" id="tfb"></span>`;
  el('tclose').onclick=()=>{ active=null; drawTbox(); }; live(); }
function live(){ if(!R) return; TASKS.filter(t=>t.model&&touched[t.k]).forEach(t=>{ const r=t.check(), html=L(r.m); const f=el('fb-'+t.k); if(f){ f.innerHTML=html; f.classList.toggle('ok',!!r.ok); } if(active===t.k){ const g=el('tfb'); if(g){ g.innerHTML=html; g.classList.toggle('ok',!!r.ok); } } }); }
el('tasks').addEventListener('click',e=>{ const gb=e.target.closest('[data-go]'), o=e.target.closest('[data-o]'), sh=e.target.closest('[data-show]');
  if(gb){ active=gb.dataset.go; touched[active]=1; drawTbox(); go('model'); return; }
  if(o){ ans[o.dataset.t]=+o.dataset.o; drawTasks(); return; }
  if(sh){ const t=TASKS.find(x=>x.k===sh.dataset.show); active=null; drawTbox(); t.show(); go('model'); } });

/* ---------------- quiz ---------------- */
LAB.quiz(el('qbox'),'forces',()=>LAB.shuffle([
 {q:{en:'In a steady, straight climb at constant speed, lift is…',no:'I en stasjonær, rett stigning med konstant fart er løftet …'},a:[{en:'slightly less than weight: L = W·cos γ',no:'litt mindre enn vekten: L = W·cos γ'},{en:'greater than weight, otherwise the aircraft could not climb',no:'større enn vekten, ellers kunne ikke flyet stige'},{en:'exactly equal to weight',no:'nøyaktig lik vekten'}],c:0,e:{en:'Thrust minus drag carries W·sin γ along the path. Lift only balances the part of weight normal to the path.',no:'Skyv minus motstand bærer W·sin γ langs banen. Løftet balanserer bare den delen av vekten som står vinkelrett på banen.'}},
 {q:{en:'Power off, the best glide ratio is reached at…',no:'Uten motor oppnås beste glidetall ved …'},a:[{en:'the minimum-drag speed VMD, where L/D is greatest',no:'farten med minst motstand, VMD, der L/D er størst'},{en:'the stall speed',no:'steilefarten'},{en:'Vy',no:'Vy'}],c:0,e:{en:'tan γ = D/L, so the flattest glide is at maximum L/D.',no:'tan γ = D/L, så den flateste glidebanen er ved maks L/D.'}},
 {q:{en:'A heavier aircraft glides power off at its own best-glide speed. Compared with a lighter one, its glide distance in still air is…',no:'Et tyngre fly glir uten motor på sin egen beste glidefart. Sammenlignet med et lettere er glidedistansen i stille luft …'},a:[{en:'the same, but it flies faster and comes down sooner',no:'den samme, men det flyr fortere og kommer ned tidligere'},{en:'longer',no:'lengre'},{en:'shorter',no:'kortere'}],c:0,e:{en:'Max L/D does not depend on mass; VMD rises with √m.',no:'Maks L/D avhenger ikke av massen; VMD øker med √m.'}},
 {q:{en:'Which speed gives the greatest height gain over a given distance?',no:'Hvilken fart gir mest høyde over en gitt distanse?'},a:[{en:'Vx, best angle: the most excess thrust',no:'Vx, beste vinkel: mest overskuddsskyv'},{en:'Vy, best rate: the most excess power',no:'Vy, beste stigehastighet: mest overskuddseffekt'},{en:'VMD',no:'VMD'}],c:0,e:{en:'Gradient follows (T − D)/W. Vy gives most height per minute instead.',no:'Gradienten følger (T − D)/W. Vy gir i stedet mest høyde per minutt.'}},
 {q:{en:'Level turn at 60° of bank. Load factor and stall speed?',no:'Vannrett sving med 60° krengning. Lastfaktor og steilefart?'},a:[{en:'2 g; the stall speed rises by about 41 %',no:'2 g; steilefarten øker med omtrent 41 %'},{en:'2 g; the stall speed doubles',no:'2 g; steilefarten dobles'},{en:'1.5 g; the stall speed rises by 22 %',no:'1,5 g; steilefarten øker med 22 %'}],c:0,e:{en:'n = 1/cos 60° = 2, VS rises by √2 ≈ 1.41.',no:'n = 1/cos 60° = 2, VS øker med √2 ≈ 1,41.'}},
 {q:{en:'Approximate bank angle for a rate-one turn at 140 kt TAS?',no:'Omtrentlig krengning for en rate one-sving i 140 kt TAS?'},a:[{en:'21°',no:'21°'},{en:'14°',no:'14°'},{en:'30°',no:'30°'}],c:0,e:{en:'TAS/10 + 7 = 14 + 7 = 21°. The exact value is about 20°.',no:'TAS/10 + 7 = 14 + 7 = 21°. Nøyaktig verdi er omtrent 20°.'}},
 {q:{en:'Gliding into a strong headwind, you should fly…',no:'Når du glir mot sterk motvind, bør du fly …'},a:[{en:'a little faster than the still-air best-glide speed',no:'litt fortere enn beste glidefart i stille luft'},{en:'slower, to stay airborne longer',no:'saktere, for å holde deg lenger i lufta'},{en:'at exactly the same speed',no:'på nøyaktig samme fart'}],c:0,e:{en:'Less time in the headwind costs a little L/D but gains more ground.',no:'Kortere tid i motvinden koster litt L/D, men gir mer distanse over bakken.'}},
 {q:{en:'Below VMD, slowing down in level flight needs…',no:'Under VMD krever det å senke farten i vannrett flyging …'},a:[{en:'more power, because induced drag rises faster than parasite drag falls',no:'mer effekt, fordi indusert motstand øker raskere enn parasittmotstanden faller'},{en:'less power',no:'mindre effekt'},{en:'no change in power',no:'ingen endring i effekt'}],c:0,e:{en:'That is the back of the drag curve: speed is unstable there.',no:'Det er baksiden av motstandskurven: farten er ustabil der.'}}
]),6);

LAB.tx({fAll:'De fire kreftene og nøkkelbegrepene i sin helhet',lead:'Løft, vekt, skyv og motstand, tegnet i skala og live. Fly rett fram, stig, gli og sving, og se hvorfor løftet er mindre enn vekten i stigning, hvorfor glidetallet er L/D, og hvorfor steilefarten øker i sving.',goal:'<span class="k">Læringsmål</span>Forklar hvordan de fire kreftene balanserer i rett fram, stigning, glid og sving, og bruk L/D, Vx, Vy, lastfaktor og svinghastighet i cockpit.'});

/* ---------------- Understand: key concept cards (same pattern as the wind tunnel) ---------------- */
if(window.KCS){ const {sv,tx,ar}=KCS;
  const pl=(x,y,k,r)=>`<g transform="translate(${x} ${y}) rotate(${r||0}) scale(${k||1})"><path d="M-22,1 C-20,-3 -8,-4 6,-4 L16,-3 C20,-2 22,0 22,1 C20,3 10,4 0,4 L-16,3 Z" fill="#8e99a4" stroke="#e2e8ee" stroke-width=".6"/><path d="M-20,1 L-24,-8 L-20,-8 L-14,0 Z" fill="#8e99a4" stroke="#e2e8ee" stroke-width=".6"/><path d="M-4,-4 L10,-4 L8,-6.5 L-2,-6.5 Z" fill="#7fcbe8" opacity=".55"/><path d="M-6,-4.2 L12,-4.2" stroke="#c9d2da" stroke-width="1.6"/></g>`;
  const KCF=[
   {k:'lift',t:{en:'Lift',no:'Løft'},d:{en:'<b>Lift</b> acts at right angles to the flight path, not straight up. It comes from the wing and grows with speed² and angle of attack: L = ½ρV²·S·CL.',no:'<b>Løft</b> virker vinkelrett på flybanen, ikke rett opp. Det kommer fra vingen og vokser med fart² og anstigningsvinkel: L = ½ρV²·S·CL.'},
    ill:()=>sv(`<line x1="10" y1="40" x2="190" y2="26" stroke="#55626e" stroke-dasharray="3 3"/>${pl(100,33,1.3,-4.4)}${ar(100,33,97.8,5,'#7fcbe8')}${tx(104,10,'L ⊥ '+L({en:'path',no:'bane'}),'#7fcbe8')}${tx(186,40,L({en:'flight path',no:'flybane'}),'#8b99a7','end')}`),click:'#pre button[data-k="level"]',to:'#fmCv'},
   {k:'weight',t:{en:'Weight',no:'Vekt'},d:{en:'<b>Weight</b> is mass × gravity and always points straight down, towards the centre of the earth, whatever the attitude.',no:'<b>Vekt</b> er masse × tyngdeakselerasjon og peker alltid rett ned, mot jordas sentrum, uansett attitude.'},
    ill:()=>sv(`${pl(100,22,1.3,-8)}${ar(100,22,100,58,'#eef3f7')}${tx(106,54,'W = m·g','#eef3f7')}`),click:'#pre button[data-k="level"]',to:'#fmCv'},
   {k:'td',t:{en:'Thrust and drag',no:'Skyv og motstand'},d:{en:'<b>Thrust</b> pulls along the flight path; <b>drag</b> resists the motion. When they are equal the speed stays constant. A propeller’s thrust falls as speed rises.',no:'<b>Skyv</b> drar langs flybanen; <b>motstand</b> bremser bevegelsen. Når de er like, holdes farten konstant. Propellskyvet faller når farten øker.'},
    ill:()=>sv(`${pl(100,32,1.3)}${ar(130,32,172,32,'#E46BAE')}${ar(70,32,28,32,'#EC5A47')}${tx(170,24,'T','#E46BAE','end')}${tx(30,24,'D','#EC5A47')}`),click:'#pre button[data-k="level"]',to:'#fmCv'},
   {k:'steady',t:{en:'Steady flight',no:'Jevn flyging'},d:{en:'When the four forces balance, the aircraft keeps a constant speed in a straight line: level, climbing or descending. The small force polygon in the model then closes.',no:'Når de fire kreftene er i balanse, holder flyet konstant fart i en rett linje: plant, i stigning eller i nedstigning. Den lille kraftpolygonen i modellen lukker seg da.'},
    ill:()=>sv(`${ar(90,52,90,12,'#7fcbe8')}${ar(90,12,118,12,'#E46BAE')}${ar(118,12,118,52,'#eef3f7')}${ar(118,52,90,52,'#EC5A47')}${tx(124,36,L({en:'closed = steady',no:'lukket = jevn'}),'#71cc93')}`),click:'#pre button[data-k="level"]',to:'#fmCv'},
   {k:'climb',t:{en:'In a climb, lift < weight',no:'I stigning er løft < vekt'},d:{en:'In a steady climb part of the weight acts backwards along the path, so thrust must cover drag plus W·sin γ, and lift is slightly less than weight.',no:'I en jevn stigning virker en del av vekten bakover langs banen, så skyvet må dekke motstand pluss W·sin γ, og løftet er litt mindre enn vekten.'},
    ill:()=>sv(`<line x1="20" y1="58" x2="180" y2="10" stroke="#55626e" stroke-dasharray="3 3"/>${pl(100,34,1.25,-16.7)}${ar(100,34,92,6,'#7fcbe8')}${ar(100,34,100,62,'#eef3f7')}${tx(196,56,'T = D + W·sin γ','#E46BAE','end')}`),click:'#pre button[data-k="vy"]',to:'#fmCv'},
   {k:'glide',t:{en:'Glide ratio = L/D',no:'Glidetall = L/D'},d:{en:'With the engine idle the aircraft trades height for distance. The glide ratio equals the lift-to-drag ratio, best at the minimum-drag speed VMD.',no:'Med motoren på tomgang bytter flyet høyde mot distanse. Glidetallet er lik løft/motstand, best ved minste motstandsfart VMD.'},
    ill:()=>sv(`<line x1="20" y1="12" x2="186" y2="56" stroke="#7fcbe8" stroke-dasharray="4 3"/>${pl(52,20,1.1,15)}<line x1="20" y1="58" x2="190" y2="58" stroke="#55626e"/>${tx(110,28,'L/D ≈ 10 : 1','#f0b440')}`),click:'#pre button[data-k="glide"]',to:'#fmCv'},
   {k:'dcurve',t:{en:'The drag curve',no:'Motstandskurven'},d:{en:'Total drag is U-shaped against speed: induced drag falls with speed, parasite drag rises. The bottom is VMD. Slower than VMD needs more thrust, not less.',no:'Total motstand er U-formet mot fart: indusert motstand faller med farten, parasittmotstand øker. Bunnen er VMD. Saktere enn VMD krever mer skyv, ikke mindre.'},
    ill:()=>sv(`<line x1="16" y1="58" x2="190" y2="58" stroke="#55626e"/><path d="M22,10 C50,52 90,54 120,46 S170,20 186,8" fill="none" stroke="#EC5A47" stroke-width="2"/><line x1="92" y1="10" x2="92" y2="58" stroke="#f0b440" stroke-dasharray="3 3"/>${tx(96,18,'VMD','#f0b440')}`),to:'#fdCv'},
   {k:'vxvy',t:{en:'Vx and Vy',no:'Vx og Vy'},d:{en:'<b>Vx</b> gives the steepest climb (most height per distance, for obstacles). <b>Vy</b> gives the fastest climb (most height per minute). Vx is the slower of the two.',no:'<b>Vx</b> gir brattest stigning (mest høyde per distanse, for hindringer). <b>Vy</b> gir raskest stigning (mest høyde per minutt). Vx er den laveste av de to.'},
    ill:()=>sv(`<line x1="16" y1="58" x2="190" y2="58" stroke="#55626e"/><path d="M20,58 L92,12" stroke="#71cc93" stroke-width="1.8"/><path d="M20,58 L186,22" stroke="#7fcbe8" stroke-width="1.8"/>${tx(70,22,'Vx','#71cc93')}${tx(150,24,'Vy','#7fcbe8')}<rect x="104" y="44" width="6" height="14" fill="#8b99a7"/>`),click:'#pre button[data-k="vx"]',to:'#fdCv'},
   {k:'turn',t:{en:'Load factor in a turn',no:'Lastfaktor i sving'},d:{en:'In a level turn the lift is tilted, so it must grow to keep holding the weight: n = L/W = 1/cos φ. At 60° of bank you pull 2 g.',no:'I en plan sving er løftet vippet, så det må øke for fortsatt å bære vekten: n = L/W = 1/cos φ. Ved 60° krengning trekker du 2 g.'},
    ill:()=>sv(`<g transform="translate(100 40) rotate(30)"><rect x="-40" y="-2" width="80" height="4" rx="2" fill="#8e99a4"/><circle r="6" fill="#4c5d6a" stroke="#c9d2da" stroke-width=".8"/></g>${ar(100,40,116,8,'#7fcbe8')}${ar(100,40,100,62,'#eef3f7')}${tx(122,14,'L = n·W','#7fcbe8')}${tx(140,48,'60° → 2 g','#f0b440')}`),click:'#pre button[data-k="t60"]',to:'#fmCv'},
   {k:'vsturn',t:{en:'Stall speed rises in a turn',no:'Stallfarten øker i sving'},d:{en:'The wing must make n times more lift at the same critical angle, so the stall speed rises with √n: at 60° of bank by about 41 %.',no:'Vingen må lage n ganger mer løft ved samme kritiske vinkel, så stallfarten øker med √n: ved 60° krengning med omtrent 41 %.'},
    ill:()=>sv(`<rect x="16" y="26" width="168" height="12" rx="2" fill="#18232c"/><rect x="16" y="26" width="58" height="12" fill="rgba(236,90,71,.6)"/><rect x="74" y="26" width="24" height="12" fill="rgba(236,90,71,.35)"/>${tx(74,22,'VS1g','#c9d2da','middle')}${tx(98,52,'VS·√n','#ff8b7a','middle')}`),click:'#pre button[data-k="tst"]',to:'#fmCv'}];
  KCS.render(el('fKc'),KCF); }
/* start */
LAB.start('forces');
all(); hooks.forEach(f=>f());
/* Reset (the shell's button in the viewport bar): starting values, level flight */
{ const keepF=LAB.keep(F); LAB.reset(()=>{ keepF(); el('mag').classList.toggle('on',F.mag); el('mag').setAttribute('aria-pressed',String(F.mag)); setF({},'level'); }); }
LAB.onLang(()=>{ hooks.forEach(f=>f()); all(); });
})();
