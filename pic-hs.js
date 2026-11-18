/* NORDAP – pic-hs.js: "Mach, the shock and the coffin corner" for highspeed.html (uses corepic.js).
   Left: an aerofoil section with the local Mach number over it (blue subsonic → white → amber/red supersonic), the shock and
   the separation behind it. Right: the flight envelope (pressure altitude against Mach) with a constant-IAS climb, Mcrit, MMO
   and the low- and high-speed buffet boundaries meeting in the coffin corner.
   ISA, compressible CAS ↔ Mach. Illustrative A320-size teaching values (Mcrit ≈ 0.72, MMO 0.82), not AFM data. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
/* ISA */
const isa=h=>{ const T=h<36089?288.15-0.0019812*h:216.65, p=h<36089?101325*Math.pow(T/288.15,5.25588):22632*Math.exp(-(h-36089)/20806); return {T,p,a:661.47*Math.sqrt(T/288.15)}; };
const c2m=(cas,h)=>{ const qc=101325*(Math.pow(1+0.2*Math.pow(cas/661.47,2),3.5)-1), p=isa(h).p; return Math.sqrt(5*(Math.pow(qc/p+1,2/7)-1)); };
const MCRIT=0.72, MMO=0.82;
const lsb=h=>0.70*Math.sqrt(isa(41000).p/isa(h).p);           // low-speed (stall) buffet Mach at 1 g, illustrative
const hsb=h=>0.875-0.085*Math.pow(h/45000,3);                  // high-speed buffet Mach at 1 g, illustrative
/* the aircraft's state for each step: altitude ft, Mach */
const hAt=m=>{ let lo=5000,hi=40000; for(let k=0;k<40;k++){ const mid=(lo+hi)/2; if(c2m(300,mid)<m) lo=mid; else hi=mid; } return lo; };
const HC=hAt(MCRIT+0.005), HS=hAt(0.81);
const K=[{h:10000,m:c2m(300,10000)},{h:HC-3500,m:c2m(300,HC-3500)},{h:HC,m:MCRIT+0.005},{h:HS,m:0.81},{h:HS,m:0.81},{h:41000,m:0.78},{h:37000,m:0.78}];
function state(p){ const i=clamp(Math.floor(p),0,K.length-2), k=ease(clamp(p-i,0,1)); return {h:lerp(K[i].h,K[i+1].h,k),m:lerp(K[i].m,K[i+1].m,k)}; }

const steps=[
 {t:{en:'Mach number · speed against sound',no:'Machtall · fart mot lyd'},
  d:{en:'Mach = TAS ÷ the local speed of sound. Sound is slower in cold air (661 kt at 15 °C, 573 kt at −56.5 °C). The wing sends pressure waves ahead: below M 1 they warn the air in front that the wing is coming.',
     no:'Mach = TAS ÷ den lokale lydhastigheten. Lyden går saktere i kald luft (661 kt ved 15 °C, 573 kt ved −56,5 °C). Vingen sender trykkbølger foran seg: under M 1 varsler de luften foran om at vingen kommer.'}},
 {t:{en:'Climb at constant IAS · Mach rises',no:'Stig med konstant IAS · Mach øker'},
  d:{en:'Holding 300 kt IAS, the TAS grows as the air thins and the speed of sound falls as it cools. So the <em>Mach number climbs with you</em>. Airliners climb on IAS and change to Mach near FL 300.',
     no:'Holder du 300 kt IAS, øker TAS når luften tynnes ut, og lydhastigheten synker når den blir kaldere. Derfor <em>stiger Machtallet med deg</em>. Trafikkfly stiger på IAS og bytter til Mach rundt FL 300.'}},
 {t:{en:'Mcrit · the first local Mach 1',no:'Mcrit · første lokale Mach 1'},
  d:{en:'Air speeds up over the curved upper surface. At the <em>critical Mach number</em> (here about M 0.72) it reaches Mach 1 somewhere on the wing, even though the aircraft is still well below.',
     no:'Luften øker farten over den krumme oversiden. Ved <em>kritisk Machtall</em> (her omtrent M 0,72) når den Mach 1 et sted på vingen, selv om flyet fortsatt er godt under.'}},
 {t:{en:'Shock wave · drag rise and buffet',no:'Sjokkbølge · motstandsøkning og buffet'},
  d:{en:'Above Mcrit a supersonic pocket grows and ends in a <em>shock wave</em>. Behind the shock the boundary layer can separate: wave drag rises steeply (drag divergence) and the wing <em>buffets</em>. MMO keeps you clear of it.',
     no:'Over Mcrit vokser en overlydslomme som ender i en <em>sjokkbølge</em>. Bak sjokket kan grensesjiktet løsne: bølgemotstanden øker bratt (motstandsdivergens), og vingen <em>buffeter</em>. MMO holder deg unna.'}},
 {t:{en:'Sweep buys Mach',no:'Pilform kjøper Mach'},
  d:{en:'A swept wing only feels the part of the airflow at right angles to its leading edge: <em>V × cos Λ</em>. With 25° of sweep that is 0.91 V, so Mcrit rises and the shock comes later.',
     no:'En pilformet vinge merker bare den delen av luftstrømmen som står vinkelrett på forkanten: <em>V × cos Λ</em>. Med 25° pilform er det 0,91 V, så Mcrit øker og sjokket kommer senere.'}},
 {t:{en:'Coffin corner · the window closes',no:'Coffin corner · vinduet lukker seg'},
  d:{en:'Higher up, the <em>low-speed buffet</em> (stall) Mach rises while the <em>high-speed buffet</em> Mach stays put. Near the ceiling they meet. A turn or turbulence (more g) narrows the window further.',
     no:'Høyere oppe øker Machtallet for <em>lavfartsbuffet</em> (stall), mens <em>høyfartsbuffet</em> ligger fast. Nær taket møtes de. En sving eller turbulens (flere g) gjør vinduet enda smalere.'}},
 {t:{en:'In the aircraft',no:'I flyet'},
  d:{en:'Climb on IAS, cruise on Mach. <em>Mcrit &lt; drag divergence &lt; MMO</em> in the design. Pick a cruise level with a buffet margin of at least 1.3 g (about 40° of bank). Then try it in the flight envelope lab.',
     no:'Stig på IAS, cruise på Mach. <em>Mcrit &lt; motstandsdivergens &lt; MMO</em> i konstruksjonen. Velg en marsjhøyde med buffetmargin på minst 1,3 g (omtrent 40° krengning). Prøv det så i flykonvoluttlabben.'},
  go:{en:'Open the flight envelope lab',no:'Åpne flykonvoluttlabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

/* aerofoil (thin supercritical-style section), chord 0..1 */
const yU=x=>0.13*Math.sqrt(Math.max(0,x))*(1-x)*(1+0.45*x)-0.006*x, yLo=x=>-0.072*Math.sqrt(Math.max(0,x))*(1-x)*(1-0.9*x)*(1-x*0.2)+0.012*x*x*(1-x)*4;
function mcol(m){ // local Mach → colour
  const st=[[0.45,[46,92,170]],[0.75,[86,160,220]],[0.92,[220,232,240]],[1.0,[248,236,200]],[1.12,[240,180,64]],[1.3,[236,90,71]]];
  if(m<=st[0][0]) return st[0][1]; for(let i=1;i<st.length;i++){ if(m<=st[i][0]){ const k=(m-st[i-1][0])/(st[i][0]-st[i-1][0]); return st[i-1][1].map((c,j)=>c+(st[i][1][j]-c)*k); } } return st[st.length-1][1]; }

const FC={};
function drawFoil(g,x0,y0,w,h,M,sweep,tm,wav){
  const ch=w*0.78, ax=x0+w*0.1, ay=y0+h*0.56, PX=x=>ax+x*ch, PY=y=>ay-y*ch;
  const eff=M*(1-0.09*sweep);                               // sweep: the section sees V·cos Λ
  const local=(x,dy)=>{ // local Mach above (dy>0) or below the section at chord x
    const s=Math.exp(-Math.pow((x-0.36)/0.27,2))*(x<0?Math.exp(x*6):1), fall=Math.exp(-Math.max(0,dy)/0.22);
    const base=eff*(1+0.39*s*fall);
    let m=base*(eff>MCRIT?1+(eff-MCRIT)*1.6*s*fall:1);
    // shock: behind xs the flow drops back below 1
    const xs=0.42+Math.min(0.24,(eff-MCRIT)*2.4);
    if(eff>MCRIT&&x>xs) m=Math.min(m,0.88+0.05*Math.exp(-(x-xs)*8));
    return dy<0?eff*(1+0.12*s*Math.exp(dy/0.15)):m; };
  // field: computed on a small offscreen grid and scaled up smoothly (recomputed only when the Mach or the size changes)
  const cs=Math.max(3,Math.round(w/140)), gw=Math.ceil(w/cs), gh=Math.ceil(h/cs), key=[gw,gh,Math.round(eff*800)].join('|');
  if(FC.key!==key){ FC.key=key; if(!FC.cv){ FC.cv=document.createElement('canvas'); } FC.cv.width=gw; FC.cv.height=gh; const cx=FC.cv.getContext('2d'), im=cx.createImageData(gw,gh), d=im.data;
    for(let j=0;j<gh;j++){ for(let i=0;i<gw;i++){ const px=x0+(i+.5)*cs, py=y0+(j+.5)*cs, x=(px-ax)/ch, y=(ay-py)/ch, xc=clamp(x,0,1), yu=yU(xc), yl=yLo(xc);
        let m; if(y>=yu) m=local(x,y-yu); else if(y<=yl) m=local(x,y-yl); else m=eff;
        const c=mcol(m), a=clamp(0.10+Math.abs(m-eff)*4.2+(m>=1?0.35:0),0,0.95), o=(j*gw+i)*4;
        d[o]=c[0]*a+15*(1-a); d[o+1]=c[1]*a+22*(1-a); d[o+2]=c[2]*a+29*(1-a); d[o+3]=255; } }
    cx.putImageData(im,0,0); }
  g.save(); g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high'; g.drawImage(FC.cv,x0,y0,gw*cs,gh*cs); g.restore();
  // sonic line (local M = 1)
  if(eff>MCRIT-0.002){ g.strokeStyle='rgba(255,255,255,.85)'; g.setLineDash([3,3]); g.lineWidth=1.2; g.beginPath(); let st=0;
    for(let x=0.05;x<=0.95;x+=0.01){ // find height where local drops to 1
      const yu=yU(x); let lo=0,hi=0.6; if(local(x,0)<1){ st=0; continue; } for(let k=0;k<18;k++){ const mid=(lo+hi)/2; if(local(x,mid)>1) lo=mid; else hi=mid; }
      const X=PX(x), Y=PY(yu+lo); st?g.lineTo(X,Y):g.moveTo(X,Y); st=1; }
    g.stroke(); g.setLineDash([]); }
  // shock and separation
  const xs=0.42+Math.min(0.24,(eff-MCRIT)*2.4), sh=clamp((eff-MCRIT)/0.06,0,1);
  if(sh>0.02){ const yu=yU(xs), top=Math.min(0.5,0.06+(eff-MCRIT)*2.2); g.strokeStyle=`rgba(255,255,255,${0.5+0.5*sh})`; g.lineWidth=2.5; g.beginPath(); g.moveTo(PX(xs),PY(yu)); g.lineTo(PX(xs+0.015),PY(yu+top)); g.stroke();
    if(eff>MCRIT+0.07){ const sep=clamp((eff-MCRIT-0.07)/0.05,0,1); g.save(); g.globalAlpha=sep; g.strokeStyle='rgba(236,90,71,.85)'; g.lineWidth=1.3;
      for(let k=0;k<7;k++){ const x=xs+0.03+k*0.07; if(x>1) break; const y=yU(Math.min(1,x)); const wob=Math.sin(tm*9+k*1.7)*4; g.beginPath(); g.moveTo(PX(x),PY(y)); g.quadraticCurveTo(PX(x)+8,PY(y)-8+wob,PX(x)+2,PY(y)-16-wob); g.stroke(); } g.restore(); } }
  // section
  g.fillStyle='#0f161d'; g.strokeStyle='rgba(255,255,255,.75)'; g.lineWidth=1.4; g.beginPath();
  for(let x=0;x<=1.0001;x+=0.01) { const X=PX(x), Y=PY(yU(x)); x?g.lineTo(X,Y):g.moveTo(X,Y); }
  for(let x=1;x>=0;x-=0.01) g.lineTo(PX(x),PY(yLo(x))); g.closePath(); g.fill(); g.stroke();
  // pressure waves from the nose (step 0)
  if(wav>0.01){ g.save(); g.globalAlpha=wav; g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=1.1;
    const nx=PX(0), ny=PY(0), period=0.55, sp=ch*0.32; // wave speed (sound) in px/s; aircraft speed = M·sp (air moves left past the fixed wing)
    for(let k=0;k<7;k++){ const age=((tm/period)%1+k)*period; const r=age*sp, cx=nx+M*sp*age; if(cx+r<x0||r>w) continue; g.beginPath(); g.arc(cx,ny,r,0,7); g.globalAlpha=wav*Math.max(0,1-age/(7*period)); g.stroke(); }
    g.restore(); }
  return {PX,PY,eff,xs,sh};
}

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1, S=state(p);
  const gap=14, lw=sm?W:W*0.56, rx=sm?0:lw+gap, rw=sm?W:W-lw-gap-12;
  const fy0=sm?8:14, fh=sm?H*0.47:H-28, ey0=sm?H*0.52:18, eh=sm?H*0.44:H-40;
  // ---- left: the aerofoil ----
  const sweep=at(p,4,.8)*(1-at(p,5,.6));
  const wav=1-at(p,1,.6);
  g.save(); rr(g,8,fy0,lw-16,fh,8); g.clip();
  const F=drawFoil(g,8,fy0,lw-16,fh,S.m,sweep,tm,wav);
  g.restore();
  rr(g,8,fy0,lw-16,fh,8); g.strokeStyle='rgba(255,255,255,.1)'; g.lineWidth=1; g.stroke();
  txt(g,L({en:'WING SECTION · local Mach',no:'VINGEPROFIL · lokal Mach'}),20,fy0+18*fs,{mono:1,size:9.5*fs,col:'#AEB8C1'});
  pill(g,`M ${nf(S.m,2)}${sweep>.1?` · ${L({en:'felt',no:'merket'})} ${nf(F.eff,2)}`:''}`,lw-20,fy0+16*fs,{mono:1,size:11*fs,col:'#fff',al:'right'});
  // colour key
  { const kx=20, ky=fy0+fh-18, kw=Math.min(180,(lw-40)*.5); const gr=g.createLinearGradient(kx,0,kx+kw,0); [0.45,0.75,0.92,1.0,1.12,1.3].forEach(m=>{ const c=mcol(m); gr.addColorStop(clamp((m-0.45)/0.85,0,1),`rgb(${c.join(',')})`); });
    g.fillStyle=gr; g.fillRect(kx,ky,kw,6); txt(g,'0.5',kx,ky-4,{mono:1,size:9*fs,col:'#8E99A4'}); txt(g,'1.0',kx+kw*(0.55/0.85),ky-4,{mono:1,size:9*fs,col:'#fff',al:'center'}); txt(g,'1.3',kx+kw,ky-4,{mono:1,size:9*fs,col:'#8E99A4',al:'right'}); }
  // annotations on the foil
  const a2=at(p,2,.6)*(1-at(p,3.6,.6));
  if(a2>0&&F.eff>MCRIT-0.01){ g.save(); g.globalAlpha=a2; pill(g,L({en:'local Mach 1 here',no:'lokal Mach 1 her'}),F.PX(0.36),F.PY(0.2),{size:11*fs,col:'#F8ECC8',al:'center'}); g.restore(); }
  const a3=at(p,3,.6)*(1-at(p,4,.6)*.6);
  if(a3>0&&F.sh>0.1){ g.save(); g.globalAlpha=a3; const x=F.PX(F.xs+0.02), y=F.PY(yU(F.xs)+0.17);
    pill(g,L({en:'shock wave',no:'sjokkbølge'}),x+10,y-16,{size:11*fs,col:'#fff'}); pill(g,L({en:'separation → buffet',no:'separasjon → buffet'}),F.PX(0.82),F.PY(0.15),{size:10.5*fs,col:'#FF8A78',al:'center',fit:lw}); g.restore(); }
  // sweep inset: top view
  if(sweep>0.01){ g.save(); g.globalAlpha=sweep; const bw=Math.min(210,lw*.42), bh=bw*0.62, bx=lw-bw-18, by=fy0+fh-bh-14;
    rr(g,bx,by,bw,bh,8); g.fillStyle='rgba(10,15,20,.88)'; g.fill(); g.strokeStyle='rgba(255,255,255,.14)'; g.stroke();
    txt(g,L({en:'SEEN FROM ABOVE',no:'SETT OVENFRA'}),bx+10,by+16,{mono:1,size:9*fs,col:'#8E99A4'});
    const cx=bx+bw*0.3, cy=by+bh*0.3, Lw=bw*0.62, A=25*Math.PI/180;
    // swept wing (left half seen from above, flight to the left... nose up the page)
    g.fillStyle='#C9D1D8'; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Lw*Math.cos(A),cy+Lw*Math.sin(A)); g.lineTo(cx+Lw*Math.cos(A)-4,cy+Lw*Math.sin(A)+12); g.lineTo(cx,cy+24); g.closePath(); g.fill();
    // airflow V (towards the wing, from the top), its normal and spanwise parts
    const ox=cx+Lw*0.45*Math.cos(A), oy=cy+Lw*0.45*Math.sin(A), V=bh*0.42;
    arrow(g,ox,oy-V,ox,oy,'#fff',{lw:2,head:7});
    const nx=-Math.sin(A), ny=Math.cos(A), comp=V*Math.cos(A);
    arrow(g,ox-nx*comp,oy-ny*comp,ox,oy,C.amber,{lw:2.4,head:7});
    txt(g,'V',ox+5,oy-V+10,{mono:1,size:10*fs,col:'#fff'}); txt(g,'V·cos 25°',ox-nx*comp-6,oy-ny*comp+14,{mono:1,size:10*fs,col:C.amber,al:'right'});
    g.restore(); }

  // ---- right: the envelope ----
  const ex0=rx+(sm?44:52), ex1=rx+rw-10, ey1=ey0+eh-26, eyT=ey0+20;
  const mLo=0.35, mHi=0.92, hLo=5000, hHi=47000, X=m=>ex0+(ex1-ex0)*(m-mLo)/(mHi-mLo), Y=h=>ey1-(ey1-eyT)*(h-hLo)/(hHi-hLo);
  rr(g,rx,ey0,rw,eh,8); g.fillStyle='rgba(10,15,20,.4)'; g.fill(); g.strokeStyle='rgba(255,255,255,.08)'; g.stroke();
  txt(g,L({en:'FLIGHT ENVELOPE · altitude against Mach',no:'FLYKONVOLUTT · høyde mot Mach'}),rx+12,ey0+15*fs,{mono:1,size:9.5*fs,col:'#AEB8C1'});
  g.strokeStyle='rgba(255,255,255,.07)'; g.lineWidth=1;
  for(let h=10000;h<=45000;h+=5000){ const y=Y(h); g.beginPath(); g.moveTo(ex0,y); g.lineTo(ex1,y); g.stroke(); txt(g,'FL'+h/100,ex0-6,y+3,{mono:1,size:9*fs,col:'#7F8B96',al:'right'}); }
  for(let m=0.4;m<=0.9001;m+=0.1){ const x=X(m); g.beginPath(); g.moveTo(x,eyT); g.lineTo(x,ey1); g.stroke(); txt(g,nf(m,1),x,ey1+13,{mono:1,size:9*fs,col:'#7F8B96',al:'center'}); }
  txt(g,'Mach',ex1,ey1+24,{mono:1,size:9*fs,col:'#8E99A4',al:'right'});
  // constant 300 kt IAS line
  const a1=Math.max(at(p,1,.7),0);
  if(a1>0){ g.save(); g.globalAlpha=a1*(1-at(p,5,.6)*.6); g.strokeStyle=C.blue; g.lineWidth=1.6; g.setLineDash([5,4]); g.beginPath(); let st=0;
    for(let h=hLo;h<=hHi;h+=500){ const m=c2m(300,h); if(m>mHi) break; const x=X(m), y=Y(h); st?g.lineTo(x,y):g.moveTo(x,y); st=1; } g.stroke(); g.setLineDash([]);
    pill(g,'300 kt IAS',X(c2m(300,15000))+6,Y(15000),{mono:1,size:10*fs,col:C.blue}); g.restore(); }
  // tropopause
  g.strokeStyle='rgba(185,163,242,.35)'; g.setLineDash([2,4]); g.beginPath(); g.moveTo(ex0,Y(36089)); g.lineTo(ex1,Y(36089)); g.stroke(); g.setLineDash([]);
  txt(g,L({en:'tropopause',no:'tropopausen'}),ex0+4,Y(36089)-4,{mono:1,size:9*fs,col:'rgba(185,163,242,.8)'});
  // Mcrit and MMO
  const a2b=at(p,2,.7); if(a2b>0){ g.save(); g.globalAlpha=a2b; g.strokeStyle='rgba(248,236,200,.7)'; g.setLineDash([3,4]); g.beginPath(); g.moveTo(X(MCRIT),eyT); g.lineTo(X(MCRIT),ey1); g.stroke(); g.setLineDash([]);
    txt(g,'Mcrit',X(MCRIT)-4,eyT+10,{mono:1,size:10*fs,col:'#F8ECC8',al:'right'}); g.restore(); }
  const a3b=at(p,3,.7); if(a3b>0){ g.save(); g.globalAlpha=a3b; g.strokeStyle=C.red; g.lineWidth=2; g.beginPath(); g.moveTo(X(MMO),Y(25000)); g.lineTo(X(MMO),eyT); g.stroke(); txt(g,'MMO',X(MMO)+4,eyT+10,{mono:1,size:10*fs,col:'#FF8A78'}); g.restore(); }
  // buffet boundaries and the coffin corner
  const a5=Math.max(at(p,3,.7)*.35,at(p,5,.8));
  if(a5>0){ g.save(); g.globalAlpha=a5;
    const hs=[]; for(let h=hLo;h<=hHi;h+=250){ if(lsb(h)<mLo) continue; const a=lsb(h), b=hsb(h); if(a>=b) break; hs.push([h,a,b]); }
    g.fillStyle='rgba(113,204,147,.09)'; g.beginPath(); hs.forEach(([h,a],i)=>{ i?g.lineTo(X(a),Y(h)):g.moveTo(X(a),Y(h)); }); for(let i=hs.length-1;i>=0;i--) g.lineTo(X(hs[i][2]),Y(hs[i][0])); g.closePath(); g.fill();
    g.lineWidth=2; g.strokeStyle=C.amber; g.beginPath(); hs.forEach(([h,a],i)=>{ i?g.lineTo(X(a),Y(h)):g.moveTo(X(a),Y(h)); }); g.stroke();
    g.strokeStyle='#FF8A78'; g.beginPath(); hs.forEach(([h,a,b],i)=>{ i?g.lineTo(X(b),Y(h)):g.moveTo(X(b),Y(h)); }); g.stroke();
    const top=hs[hs.length-1]; if(at(p,5,.8)>.3){ pill(g,L({en:'coffin corner',no:'coffin corner'}),X((top[1]+top[2])/2)+14,Y(top[0])+2,{size:10.5*fs,col:'#fff',fit:rx+rw}); }
    txt(g,L({en:'low-speed buffet',no:'lavfartsbuffet'}),X(lsb(30000))-6,Y(30000),{size:10.5*fs,col:C.amber,al:'right',w:600});
    txt(g,L({en:'high-speed buffet',no:'høyfartsbuffet'}),X(hsb(30000))+4,Y(30000)+16,{size:10.5*fs,col:'#FF8A78',al:'right',w:600});
    g.restore(); }
  // the aircraft
  const ax=X(S.m), ay=Y(S.h); g.fillStyle='#fff'; g.beginPath(); g.arc(ax,ay,5.5,0,7); g.fill(); g.strokeStyle=C.mag; g.lineWidth=2; g.beginPath(); g.arc(ax,ay,9+2*Math.sin(tm*3),0,7); g.stroke();
  const tas=S.m*isa(S.h).a;
  pill(g,`FL${nf(S.h/100)} · M ${nf(S.m,2)} · TAS ${nf(tas)} kt`,ax+(ax>(ex0+ex1)/2?-16:16),ay+(ay>ey1-30?-20:0),{mono:1,size:10*fs,col:'#fff',al:ax>(ex0+ex1)/2?'right':'left',fit:rx+rw});
  if(a1<.2&&p<.6) pill(g,`a = ${nf(isa(S.h).a)} kt`,ax,ay-22,{mono:1,size:10*fs,col:'#AEB8C1',al:'center',fit:rx+rw});
  // margin at the cruise level (step 5+)
  const a6=at(p,5,.8); if(a6>.4){ const lo=lsb(S.h), hi=hsb(S.h); g.save(); g.globalAlpha=a6; g.strokeStyle='#fff'; g.lineWidth=1; g.beginPath(); g.moveTo(X(lo),ay); g.lineTo(X(hi),ay); g.stroke();
    [lo,hi].forEach(m=>{ g.beginPath(); g.moveTo(X(m),ay-5); g.lineTo(X(m),ay+5); g.stroke(); }); g.restore(); }
  txt(g,L({en:'illustrative · 1 g · not AFM data',no:'illustrerende · 1 g · ikke AFM-data'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8,aspectSm:1/1.45,dwell:6.5,
    title:{en:'Mach, the shock wave and the coffin corner',no:'Mach, sjokkbølgen og coffin corner'},
    sub:{en:'The air over the wing, coloured by its own Mach number, and where the aircraft is in the flight envelope. Both change together.',no:'Luften over vingen, farget etter sitt eget Machtall, og hvor flyet er i flykonvolutten. Begge endrer seg sammen.'},
    label:{en:'Animated wing section with local Mach colours and a shock wave, beside an altitude–Mach chart with a constant-IAS climb, Mcrit, MMO and the buffet boundaries.',no:'Animert vingeprofil med farger for lokal Mach og en sjokkbølge, ved siden av et diagram over høyde og Mach med stigning på konstant IAS, Mcrit, MMO og buffetgrensene.'},
    foot:{en:'ISA, compressible IAS–Mach conversion. Illustrative A320-size wing (Mcrit ≈ 0.72, MMO 0.82, buffet at 1 g). Not AFM data.',no:'ISA, kompressibel omregning mellom IAS og Mach. Illustrerende vinge i A320-størrelse (Mcrit ≈ 0,72, MMO 0,82, buffet ved 1 g). Ikke AFM-data.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
