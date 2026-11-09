/* Birdbird – navgauges.js: vector round gauges for the radio navigation simulator.
   NAVG.make(canvas, kind) → gauge with .set(values), .tick(dt) (damped needles, returns true while moving), .draw(), .knobs.
   kinds: cdi, hsi, rmi, adf, asi, ai, alt, tc, dg, vsi.
   Static parts (plate, bezel, fixed markings, glass) and rotating cards are cached in offscreen canvases at device
   resolution on resize, so a frame is a few drawImage calls plus the needles: no per-frame allocations in the hot path. */
(function(){
'use strict';
const D2R=Math.PI/180, TAU=Math.PI*2;
const FM='"IBM Plex Mono", ui-monospace, monospace', FD='Archivo, "Public Sans", system-ui, sans-serif';
const C={face:'#090C0F',face2:'#12171C',ink:'#F1F4F6',ink2:'#A7B2BB',ink3:'#66727C',crs:'#F06BB4',crs2:'#B54787',vor:'#63D9A0',adf:'#F5BC4C',bug:'#57C7F5',flag:'#E5483B',orange:'#F39A3D',sky1:'#2B6CB0',sky2:'#5C9BD6',gnd1:'#7A4A22',gnd2:'#4F2F15',green:'#3FB46B',yellow:'#E9C23A',red:'#E5483B',white:'#F1F4F6'};
const norm=a=>{ a%=360; return a<0?a+360:a; };
const diff=(a,b)=>{ let d=norm(a-b); return d>180?d-360:d; };
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
function mk(){ return document.createElement('canvas'); }
function font(g,w,px,fam,cond){ g.font=`${w} ${px}px ${fam}`; if('fontStretch' in g) g.fontStretch=cond?'condensed':'normal'; }

/* critically damped-ish spring; wrap = angle (shortest way round) */
function Spring(w,z,wrap){ this.x=0; this.v=0; this.t=0; this.w=w; this.z=z; this.wrap=wrap; this.ok=false; }
Spring.prototype.to=function(t){ if(!this.ok){ this.x=t; this.v=0; this.ok=true; } this.t=t; };
Spring.prototype.step=function(dt){
  const e=this.wrap?diff(this.t,this.x):this.t-this.x;
  if(Math.abs(e)<1e-3&&Math.abs(this.v)<1e-3){ this.x=this.t; this.v=0; return false; }
  const n=dt>0.02?Math.ceil(dt/0.02):1, h=dt/n;
  for(let i=0;i<n;i++){ const er=this.wrap?diff(this.t,this.x):this.t-this.x; const a=this.w*this.w*er-2*this.z*this.w*this.v; this.v+=a*h; this.x+=this.v*h; if(this.wrap) this.x=norm(this.x); }
  return true; };
Spring.prototype.snap=function(){ this.x=this.t; this.v=0; };

/* ---------- shared drawing ---------- */
function plate(g,s){
  const r=s*0.5;
  /* square instrument plate with rounded corners and four screws */
  const pg=g.createLinearGradient(0,0,0,s); pg.addColorStop(0,'#232a31'); pg.addColorStop(1,'#151a1f');
  g.fillStyle=pg; rr(g,s*0.01,s*0.01,s*0.98,s*0.98,s*0.07); g.fill();
  g.strokeStyle='rgba(255,255,255,.07)'; g.lineWidth=Math.max(1,s*0.004); rr(g,s*0.012,s*0.012,s*0.976,s*0.976,s*0.068); g.stroke();
  for(const [x,y] of [[0.085,0.085],[0.915,0.085],[0.085,0.915],[0.915,0.915]]){ screw(g,x*s,y*s,s*0.026); }
  /* bezel ring */
  const b=g.createRadialGradient(r-s*0.08,r-s*0.1,s*0.3,r,r,s*0.47); b.addColorStop(0,'#59636c'); b.addColorStop(0.6,'#2a3138'); b.addColorStop(1,'#0e1114');
  g.fillStyle=b; g.beginPath(); g.arc(r,r,s*0.465,0,TAU); g.fill();
  const b2=g.createLinearGradient(0,s*0.05,0,s*0.95); b2.addColorStop(0,'#0b0e10'); b2.addColorStop(1,'#3a434b');
  g.fillStyle=b2; g.beginPath(); g.arc(r,r,s*0.44,0,TAU); g.fill();
  /* face */
  const f=g.createRadialGradient(r,r*0.92,s*0.05,r,r,s*0.43); f.addColorStop(0,C.face2); f.addColorStop(1,C.face);
  g.fillStyle=f; g.beginPath(); g.arc(r,r,s*0.43,0,TAU); g.fill();
}
function screw(g,x,y,rad){ const gr=g.createRadialGradient(x-rad*0.3,y-rad*0.3,rad*0.1,x,y,rad); gr.addColorStop(0,'#8d969e'); gr.addColorStop(1,'#2c3238'); g.fillStyle=gr; g.beginPath(); g.arc(x,y,rad,0,TAU); g.fill();
  g.strokeStyle='rgba(0,0,0,.6)'; g.lineWidth=rad*0.28; g.beginPath(); g.moveTo(x-rad*0.62,y+rad*0.25); g.lineTo(x+rad*0.62,y-rad*0.25); g.stroke(); }
function rr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function glass(g,s){ const r=s*0.5; g.save(); g.beginPath(); g.arc(r,r,s*0.43,0,TAU); g.clip();
  const gl=g.createLinearGradient(s*0.2,s*0.08,s*0.55,s*0.55); gl.addColorStop(0,'rgba(255,255,255,.085)'); gl.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gl; g.beginPath(); g.ellipse(r-s*0.06,r-s*0.13,s*0.36,s*0.25,-0.5,0,TAU); g.fill();
  const vg=g.createRadialGradient(r,r,s*0.3,r,r,s*0.43); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.45)'); g.fillStyle=vg; g.fillRect(0,0,s,s);
  g.restore(); }
function knob(g,x,y,rad,label){ /* knurled knob in a corner of the plate */
  g.save(); g.shadowColor='rgba(0,0,0,.6)'; g.shadowBlur=rad*0.5; g.shadowOffsetY=rad*0.15;
  const kg=g.createRadialGradient(x-rad*0.3,y-rad*0.35,rad*0.1,x,y,rad); kg.addColorStop(0,'#4b545c'); kg.addColorStop(1,'#16191c');
  g.fillStyle=kg; g.beginPath(); g.arc(x,y,rad,0,TAU); g.fill(); g.restore();
  g.strokeStyle='rgba(255,255,255,.16)'; g.lineWidth=Math.max(0.6,rad*0.05);
  for(let i=0;i<24;i++){ const a=i*TAU/24; g.beginPath(); g.moveTo(x+Math.cos(a)*rad*0.78,y+Math.sin(a)*rad*0.78); g.lineTo(x+Math.cos(a)*rad*0.96,y+Math.sin(a)*rad*0.96); g.stroke(); }
  g.fillStyle='#1b1f23'; g.beginPath(); g.arc(x,y,rad*0.62,0,TAU); g.fill();
  if(label){ g.fillStyle=C.ink2; font(g,600,Math.max(7,rad*0.52),FD,true); g.textAlign='center'; g.textBaseline='middle'; g.fillText(label,x,y+rad*0.04); }
}
/* compass card into its own square canvas, centred, radius r0..r1 */
function compassCard(g,s,r0,r1,opt){ opt=opt||{}; const c=s/2; g.save(); g.translate(c,c);
  for(let a=0;a<360;a+=5){ const t=a*D2R, big=a%10===0, l=big?(a%30===0?0.12:0.085):0.05; g.strokeStyle=C.tick; g.lineWidth=big?s*0.008:s*0.005;
    g.beginPath(); g.moveTo(Math.sin(t)*r1,-Math.cos(t)*r1); g.lineTo(Math.sin(t)*(r1-s*l),-Math.cos(t)*(r1-s*l)); g.stroke(); }
  font(g,600,s*(opt.fs||0.068),FD,true); g.fillStyle=C.ink; g.textAlign='center'; g.textBaseline='middle';
  for(let a=0;a<360;a+=30){ const t=a*D2R, lab=a===0?'N':a===90?'E':a===180?'S':a===270?'W':String(a/10); g.save(); g.rotate(t); g.fillStyle=(a%90===0)?C.ink:C.ink2; g.fillText(lab,0,-(opt.nr?opt.nr*s:(r1-s*0.175))); g.restore(); }
  g.restore(); }
function needle(g,len,tail,w,col,head){ g.fillStyle=col; g.strokeStyle=col; g.lineWidth=w; g.lineCap='round';
  g.beginPath(); g.moveTo(0,tail); g.lineTo(0,-len+head*1.6); g.stroke();
  g.beginPath(); g.moveTo(0,-len); g.lineTo(-head*0.62,-len+head*1.7); g.lineTo(head*0.62,-len+head*1.7); g.closePath(); g.fill(); }
function stripes(g,x,y,w,h,txt,s){ g.save(); rr(g,x,y,w,h,h*0.15); g.clip(); g.fillStyle=C.flag; g.fillRect(x,y,w,h); g.strokeStyle='rgba(255,255,255,.85)'; g.lineWidth=h*0.22;
  for(let i=-h;i<w+h;i+=h*0.7){ g.beginPath(); g.moveTo(x+i,y+h); g.lineTo(x+i+h,y); g.stroke(); } g.restore();
  if(txt){ g.fillStyle='#fff'; g.strokeStyle=C.flag; g.lineWidth=s*0.012; font(g,800,h*0.62,FD,true); g.textAlign='center'; g.textBaseline='middle'; g.strokeText(txt,x+w/2,y+h/2+0.5); g.fillText(txt,x+w/2,y+h/2+0.5); } }
function caption(g,s,txt){ font(g,600,s*0.042,FM); g.fillStyle=C.ink3; g.textAlign='center'; g.textBaseline='alphabetic'; g.fillText(txt,s/2,s*0.975); }

/* ---------- kinds ---------- */
const K={};
/* CDI: VOR/LOC needle, GS needle, TO/FROM window, OBS card and knob */
K.cdi={ springs:{obs:[10,0.9,1],dev:[7,0.62,0],gs:[7,0.62,0]},
  under(g,s){ plate(g,s); caption(g,s,'NAV 1'); },
  card(g,s){ compassCard(g,s,s*0.32,s*0.425,{fs:0.046,tl:0.32,nr:0.36}); },
  over(g,s){ const c=s/2, r=s*0.43;
    /* inner face and fixed marks */
    g.fillStyle='#0b0f13'; g.beginPath(); g.arc(c,c,r*0.74,0,TAU); g.fill(); g.strokeStyle='rgba(255,255,255,.08)'; g.lineWidth=s*0.004; g.stroke();
    g.fillStyle=C.ink; g.beginPath(); g.moveTo(c,c-r*0.745); g.lineTo(c-s*0.022,c-r*0.745-s*0.035); g.lineTo(c+s*0.022,c-r*0.745-s*0.035); g.closePath(); g.fill();   /* course index */
    g.fillStyle=C.ink2; g.beginPath(); g.moveTo(c,c+r*0.745); g.lineTo(c-s*0.016,c+r*0.745+s*0.026); g.lineTo(c+s*0.016,c+r*0.745+s*0.026); g.closePath(); g.fill(); /* reciprocal */
    const dx=r*0.12; g.strokeStyle=C.ink; g.lineWidth=s*0.006; g.beginPath(); g.arc(c,c,dx*0.55,0,TAU); g.stroke();
    for(let i=1;i<=5;i++){ for(const sg of [-1,1]){ g.fillStyle=C.ink; g.beginPath(); g.arc(c+sg*i*dx,c,s*0.009,0,TAU); g.fill(); g.fillStyle='rgba(241,244,246,.45)'; g.beginPath(); g.arc(c,c+sg*i*dx,s*0.007,0,TAU); g.fill(); } }
    knob(g,s*0.135,s*0.865,s*0.075,'OBS'); glass(g,s); },
  draw(g,s,G){ const c=s/2, r=s*0.43, v=G.v, dx=r*0.12;
    /* the OBS card turns so the selected course sits under the top index */
    G.rot(g,G.cardC,-G.sp.obs.x);
    G.blit(g,G.overC);
    /* GS needle (horizontal), pivoting at the left */
    g.save(); g.beginPath(); g.arc(c,c,r*0.74,0,TAU); g.clip();
    g.strokeStyle=C.white; g.lineWidth=s*0.014; g.lineCap='round'; g.shadowColor='rgba(0,0,0,.7)'; g.shadowBlur=s*0.012;
    if(v.ils&&v.gsValid){ const gy=c-G.sp.gs.x*dx; g.beginPath(); g.moveTo(c-r*0.7,gy); g.lineTo(c+r*0.7,gy); g.stroke(); }
    /* CDI needle (vertical), pivoting at the top */
    const nx=c+G.sp.dev.x*dx;
    g.beginPath(); g.moveTo(nx,c-r*0.7); g.lineTo(nx,c+r*0.7); g.stroke(); g.restore();
    /* TO/FROM window */
    const wx=c+r*0.30, wy=c-r*0.40, ww=s*0.1, wh=s*0.07;
    g.fillStyle='#000'; rr(g,wx,wy,ww,wh,s*0.008); g.fill();
    if(v.flag==='TO'||v.flag==='FROM'){ const up=v.flag==='TO'; g.fillStyle=C.white; g.beginPath(); const tx=wx+ww*0.24, ty=wy+wh/2;
        if(up){ g.moveTo(tx,ty-wh*0.32); g.lineTo(tx-ww*0.16,ty+wh*0.28); g.lineTo(tx+ww*0.16,ty+wh*0.28); } else { g.moveTo(tx,ty+wh*0.32); g.lineTo(tx-ww*0.16,ty-wh*0.28); g.lineTo(tx+ww*0.16,ty-wh*0.28); }
        g.closePath(); g.fill(); font(g,700,wh*0.55,FD,true); g.textAlign='left'; g.textBaseline='middle'; g.fillText(up?'TO':'FR',wx+ww*0.44,ty+0.5); }
    else stripes(g,wx,wy,ww,wh,'NAV',s);
    /* GS flag */
    if(!(v.ils&&v.gsValid)) stripes(g,c-r*0.30-s*0.1,c-r*0.40,s*0.1,s*0.07,'GS',s);
    /* mode text */
    font(g,600,s*0.04,FM); g.fillStyle=v.ils?C.vor:C.ink3; g.textAlign='center'; g.textBaseline='middle'; g.fillText(v.ils?'LOC':'VOR',c+r*0.4,c+r*0.42);
  },
  set(G,v){ G.sp.obs.to(v.obs); G.sp.dev.to(v.dots); G.sp.gs.to(v.gsDots||0); },
  knobs(s){ return [{id:'obs',x:s*0.135,y:s*0.865,r:s*0.11}]; } };

/* HSI */
K.hsi={ springs:{hdg:[6,0.95,1],crs:[10,0.9,1],dev:[7,0.62,0],gs:[7,0.62,0],bug:[12,1,1]},
  under(g,s){ plate(g,s); caption(g,s,'HSI'); },
  card(g,s){ compassCard(g,s,s*0.3,s*0.42,{fs:0.064}); },
  over(g,s){ const c=s/2, r=s*0.43;
    g.strokeStyle=C.ink; g.lineWidth=s*0.007; for(let a=45;a<360;a+=45){ const t=a*D2R; g.beginPath(); g.moveTo(c+Math.sin(t)*r*1.0,c-Math.cos(t)*r*1.0); g.lineTo(c+Math.sin(t)*r*1.06,c-Math.cos(t)*r*1.06); g.stroke(); }
    g.fillStyle=C.orange; g.beginPath(); g.moveTo(c,c-r*0.985); g.lineTo(c-s*0.022,c-r*1.07); g.lineTo(c+s*0.022,c-r*1.07); g.closePath(); g.fill();
    /* GS scale on the right */
    const gx=c+r*0.82; for(let i=-2;i<=2;i++){ if(!i){ g.fillStyle=C.ink; g.fillRect(gx-s*0.016,c-s*0.003,s*0.032,s*0.006); continue; } g.strokeStyle=C.ink2; g.lineWidth=s*0.004; g.beginPath(); g.arc(gx,c+i*r*0.17,s*0.009,0,TAU); g.stroke(); }
    knob(g,s*0.135,s*0.865,s*0.075,'CRS'); knob(g,s*0.865,s*0.865,s*0.075,'HDG'); glass(g,s); },
  draw(g,s,G){ const c=s/2, r=s*0.43, v=G.v, hd=G.sp.hdg.x;
    G.rot(g,G.cardC,-hd);
    /* heading bug */
    g.save(); g.translate(c,c); g.rotate((G.sp.bug.x-hd)*D2R); g.fillStyle=C.bug; g.beginPath(); g.moveTo(-s*0.035,-r*0.985); g.lineTo(-s*0.035,-r*0.93); g.lineTo(-s*0.012,-r*0.93); g.lineTo(0,-r*0.9); g.lineTo(s*0.012,-r*0.93); g.lineTo(s*0.035,-r*0.93); g.lineTo(s*0.035,-r*0.985); g.closePath(); g.fill(); g.restore();
    /* course pointer, dots and deviation bar turn with the course */
    g.save(); g.translate(c,c); g.rotate((G.sp.crs.x-hd)*D2R);
    const dd=r*0.17; g.strokeStyle=C.ink; g.lineWidth=s*0.005; for(const i of [-2,-1,1,2]){ g.beginPath(); g.arc(i*dd,0,s*0.012,0,TAU); g.stroke(); }
    g.fillStyle=C.crs; g.strokeStyle=C.crs; g.lineWidth=s*0.018; g.lineCap='butt';
    g.beginPath(); g.moveTo(0,-r*0.5); g.lineTo(0,-r*0.76); g.stroke();
    g.beginPath(); g.moveTo(0,-r*0.9); g.lineTo(-s*0.03,-r*0.74); g.lineTo(s*0.03,-r*0.74); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(0,r*0.5); g.lineTo(0,r*0.86); g.stroke();
    const bx=G.sp.dev.x*dd; g.shadowColor='rgba(0,0,0,.7)'; g.shadowBlur=s*0.01; g.beginPath(); g.moveTo(bx,-r*0.46); g.lineTo(bx,r*0.46); g.stroke(); g.shadowBlur=0;
    if(v.flag==='TO'||v.flag==='FROM'){ const up=v.flag==='TO', ty=up?-r*0.3:r*0.3; g.fillStyle=C.white; g.beginPath(); g.moveTo(r*0.2,ty+(up?-s*0.03:s*0.03)); g.lineTo(r*0.2-s*0.03,ty+(up?s*0.02:-s*0.02)); g.lineTo(r*0.2+s*0.03,ty+(up?s*0.02:-s*0.02)); g.closePath(); g.fill(); }
    g.restore();
    /* aircraft symbol */
    g.save(); g.translate(c,c); g.strokeStyle=C.orange; g.lineCap='round'; g.lineWidth=s*0.013; g.beginPath(); g.moveTo(0,-r*0.2); g.lineTo(0,r*0.18); g.moveTo(-r*0.2,-r*0.02); g.lineTo(r*0.2,-r*0.02); g.moveTo(-r*0.08,r*0.16); g.lineTo(r*0.08,r*0.16); g.stroke(); g.restore();
    G.blit(g,G.overC);
    /* GS pointer */
    if(v.ils&&v.gsValid){ const gy=c-Math.max(-2.3,Math.min(2.3,G.sp.gs.x))*r*0.17, gx=c+r*0.82; g.fillStyle=C.vor; g.beginPath(); g.moveTo(gx-s*0.022,gy); g.lineTo(gx+s*0.02,gy-s*0.022); g.lineTo(gx+s*0.02,gy+s*0.022); g.closePath(); g.fill(); }
    else if(v.ils) stripes(g,c+r*0.66,c-r*0.06,s*0.075,s*0.05,'GS',s);
    if(v.flag==='OFF') stripes(g,c-r*0.55,c-r*0.38,s*(v.flagTxt?0.12:0.1),s*0.06,v.flagTxt||'NAV',s);
    /* optional source/mode annunciation (GNSS lab: 'GPS', 'TERM', 'LPV' …), drawn only when given */
    if(v.ann){ font(g,600,s*0.044,FM); g.textAlign='center'; g.textBaseline='middle'; const tw=g.measureText(v.ann).width+s*0.03;
      const ax=c-r*0.52, ay=c+r*0.56; g.fillStyle='rgba(0,0,0,.72)'; rr(g,ax-tw/2,ay-s*0.03,tw,s*0.06,s*0.01); g.fill(); g.fillStyle=v.annC||C.vor; g.fillText(v.ann,ax,ay+s*0.002); }
    font(g,500,s*0.042,FM); g.textBaseline='alphabetic'; g.fillStyle=C.crs; g.textAlign='left'; g.fillText('CRS '+d3(v.crs),s*0.05,s*0.065); g.fillStyle=C.bug; g.textAlign='right'; g.fillText('HDG '+d3(v.bug),s*0.95,s*0.065);
  },
  set(G,v){ const lim=2.3; G.sp.hdg.to(v.hdg); G.sp.crs.to(v.crs); G.sp.dev.to(Math.max(-lim,Math.min(lim,v.hsiDots))); G.sp.gs.to(v.gsDots2||0); G.sp.bug.to(v.bug); },
  knobs(s){ return [{id:'crs',x:s*0.135,y:s*0.865,r:s*0.11},{id:'hdg',x:s*0.865,y:s*0.865,r:s*0.11}]; } };

/* RMI: slaved card, VOR needle (single) and ADF needle (double) */
K.rmi={ springs:{hdg:[6,0.95,1],n1:[5,0.55,1],n2:[4,0.42,1]},
  under(g,s){ plate(g,s); caption(g,s,'RMI'); },
  card(g,s){ compassCard(g,s,s*0.3,s*0.42); },
  over(g,s){ const c=s/2, r=s*0.43; g.fillStyle=C.ink; g.beginPath(); g.moveTo(c,c-r*0.985); g.lineTo(c-s*0.022,c-r*1.07); g.lineTo(c+s*0.022,c-r*1.07); g.closePath(); g.fill();
    font(g,600,s*0.036,FD,true); g.textAlign='center'; g.textBaseline='middle'; g.fillStyle=C.vor; g.fillText('━ VOR',s*0.17,s*0.86); g.fillStyle=C.adf; g.fillText('═ ADF',s*0.83,s*0.86); glass(g,s); },
  draw(g,s,G){ const c=s/2, r=s*0.43, v=G.v, hd=G.sp.hdg.x; G.rot(g,G.cardC,-hd);
    g.save(); g.translate(c,c);
    /* ADF double needle */
    if(v.adfOk){ g.save(); g.rotate((G.sp.n2.x-hd)*D2R); g.strokeStyle=C.adf; g.fillStyle=C.adf; g.lineWidth=s*0.009; g.shadowColor='rgba(0,0,0,.7)'; g.shadowBlur=s*0.012;
      g.beginPath(); g.moveTo(-s*0.016,r*0.86); g.lineTo(-s*0.016,-r*0.62); g.moveTo(s*0.016,r*0.86); g.lineTo(s*0.016,-r*0.62); g.stroke();
      g.beginPath(); g.moveTo(0,-r*0.86); g.lineTo(-s*0.04,-r*0.6); g.lineTo(s*0.04,-r*0.6); g.closePath(); g.fill(); g.restore(); }
    if(v.vorOk){ g.save(); g.rotate((G.sp.n1.x-hd)*D2R); g.shadowColor='rgba(0,0,0,.7)'; g.shadowBlur=s*0.012; needle(g,r*0.86,r*0.86,s*0.014,C.vor,s*0.045); g.restore(); }
    g.fillStyle='#2a3036'; g.beginPath(); g.arc(0,0,s*0.035,0,TAU); g.fill(); g.strokeStyle='rgba(255,255,255,.2)'; g.lineWidth=s*0.004; g.stroke();
    g.restore(); G.blit(g,G.overC);
    if(!v.vorOk) stripes(g,c-r*0.62,c+r*0.1,s*0.1,s*0.055,'VOR',s);
    if(!v.adfOk) stripes(g,c+r*0.62-s*0.1,c+r*0.1,s*0.1,s*0.055,'ADF',s); },
  set(G,v){ G.sp.hdg.to(v.hdg); G.sp.n1.to(v.qdmV); G.sp.n2.to(v.qdmA); },
  knobs(){ return []; } };

/* ADF: fixed card (0 at the top) or movable card set with the HDG knob */
K.adf={ springs:{card:[10,0.95,1],rb:[4,0.42,1]},
  under(g,s){ plate(g,s); caption(g,s,'ADF'); },
  card(g,s){ compassCard(g,s,s*0.3,s*0.42); },
  over(g,s){ const c=s/2, r=s*0.43; g.fillStyle=C.orange; g.beginPath(); g.moveTo(c,c-r*0.985); g.lineTo(c-s*0.022,c-r*1.07); g.lineTo(c+s*0.022,c-r*1.07); g.closePath(); g.fill();
    g.save(); g.translate(c,c); g.strokeStyle=C.orange; g.lineCap='round'; g.lineWidth=s*0.012; g.beginPath(); g.moveTo(0,-r*0.14); g.lineTo(0,r*0.13); g.moveTo(-r*0.15,0); g.lineTo(r*0.15,0); g.moveTo(-r*0.06,r*0.12); g.lineTo(r*0.06,r*0.12); g.stroke(); g.restore();
    knob(g,s*0.135,s*0.865,s*0.075,'HDG'); glass(g,s); },
  draw(g,s,G){ const c=s/2, r=s*0.43, v=G.v; G.rot(g,G.cardC,-G.sp.card.x);
    if(v.adfOk){ g.save(); g.translate(c,c); g.rotate(G.sp.rb.x*D2R); g.shadowColor='rgba(0,0,0,.75)'; g.shadowBlur=s*0.014;
      g.fillStyle=C.adf; g.beginPath(); g.moveTo(0,-r*0.88); g.lineTo(-s*0.034,-r*0.62); g.lineTo(-s*0.01,-r*0.62); g.lineTo(-s*0.01,r*0.8); g.lineTo(s*0.01,r*0.8); g.lineTo(s*0.01,-r*0.62); g.lineTo(s*0.034,-r*0.62); g.closePath(); g.fill(); g.restore(); }
    G.blit(g,G.overC);
    font(g,500,s*0.042,FM); g.textBaseline='alphabetic'; g.textAlign='left'; g.fillStyle=C.ink2; g.fillText(v.movable?'MOVABLE':'FIXED',s*0.05,s*0.065);
    if(!v.adfOk) stripes(g,c-s*0.07,c+r*0.35,s*0.14,s*0.06,'ADF',s); },
  set(G,v){ G.sp.card.to(v.movable?v.card:0); G.sp.rb.to(v.rb); },
  knobs(s){ return [{id:'card',x:s*0.135,y:s*0.865,r:s*0.11}]; } };

/* ---------- six-pack ---------- */
function arcBand(g,c,r,w,a0,a1,col){ g.strokeStyle=col; g.lineWidth=w; g.beginPath(); g.arc(c,c,r,(a0-90)*D2R,(a1-90)*D2R); g.stroke(); }
const asiA=v=>-150+ (Math.max(40,Math.min(260,v))-40)/220*300;  /* 40 kt at −150°, 260 kt at +150° */
K.asi={ springs:{ias:[6,0.85,0]},
  under(g,s){ plate(g,s); const c=s/2, r=s*0.43;
    arcBand(g,c,r*0.9,s*0.03,asiA(70),asiA(115),'#E9EEF1'); arcBand(g,c,r*0.95,s*0.026,asiA(85),asiA(190),C.green); arcBand(g,c,r*0.95,s*0.026,asiA(190),asiA(230),C.yellow); arcBand(g,c,r*0.95,s*0.03,asiA(230),asiA(232),C.red);
    for(let k=40;k<=260;k+=10){ const t=asiA(k)*D2R, big=k%20===0; g.strokeStyle=C.tick; g.lineWidth=big?s*0.008:s*0.005; g.beginPath(); g.moveTo(c+Math.sin(t)*r*0.98,c-Math.cos(t)*r*0.98); g.lineTo(c+Math.sin(t)*r*(big?0.84:0.89),c-Math.cos(t)*r*(big?0.84:0.89)); g.stroke();
      if(k%40===0){ font(g,600,s*0.06,FD,true); g.fillStyle=C.ink; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(k),c+Math.sin(t)*r*0.68,c-Math.cos(t)*r*0.68); } }
    font(g,600,s*0.042,FD,true); g.fillStyle=C.ink2; g.fillText('KNOTS',c,c+r*0.38); caption(g,s,'ASI'); },
  over(g,s){ glass(g,s); },
  draw(g,s,G){ const c=s/2, r=s*0.43; g.save(); g.translate(c,c); g.rotate(asiA(G.sp.ias.x)*D2R); g.shadowColor='rgba(0,0,0,.7)'; g.shadowBlur=s*0.012; needle(g,r*0.9,r*0.16,s*0.016,C.white,s*0.04); g.restore();
    g.fillStyle='#2a3036'; g.beginPath(); g.arc(c,c,s*0.03,0,TAU); g.fill();
    font(g,500,s*0.046,FM); g.fillStyle=C.ink2; g.textAlign='center'; g.fillText('TAS '+Math.round(G.v.tas),c,c+r*0.55); G.blit(g,G.overC); },
  set(G,v){ G.sp.ias.to(v.ias); }, knobs(){ return []; } };
K.ai={ springs:{bank:[5,0.9,0],pitch:[5,0.9,0]},
  under(g,s){ plate(g,s); caption(g,s,'ATTITUDE'); },
  over(g,s){ const c=s/2, r=s*0.43;
    /* bank scale */
    g.save(); g.translate(c,c); g.strokeStyle=C.white; for(const a of [-60,-45,-30,-20,-10,10,20,30,45,60]){ const t=a*D2R, l=Math.abs(a)%30===0?0.1:0.06; g.lineWidth=s*0.008; g.beginPath(); g.moveTo(Math.sin(t)*r*0.97,-Math.cos(t)*r*0.97); g.lineTo(Math.sin(t)*r*(0.97-l),-Math.cos(t)*r*(0.97-l)); g.stroke(); }
    g.fillStyle=C.white; g.beginPath(); g.moveTo(0,-r*0.86); g.lineTo(-s*0.025,-r*0.97); g.lineTo(s*0.025,-r*0.97); g.closePath(); g.fill();
    /* fixed aircraft symbol */
    g.strokeStyle=C.orange; g.lineWidth=s*0.018; g.lineCap='round'; g.beginPath(); g.moveTo(-r*0.55,0); g.lineTo(-r*0.2,0); g.lineTo(-r*0.1,r*0.1); g.moveTo(r*0.55,0); g.lineTo(r*0.2,0); g.lineTo(r*0.1,r*0.1); g.stroke();
    g.fillStyle=C.orange; g.beginPath(); g.arc(0,0,s*0.014,0,TAU); g.fill(); g.restore(); glass(g,s); },
  draw(g,s,G){ const c=s/2, r=s*0.43, b=G.sp.bank.x*D2R, p=G.sp.pitch.x, pp=r*0.045;
    g.save(); g.beginPath(); g.arc(c,c,r,0,TAU); g.clip(); g.translate(c,c); g.rotate(-b);
    const y0=p*pp; g.fillStyle=G.skyG||C.sky1; g.fillRect(-r*1.5,-r*1.5,r*3,r*1.5+y0); g.fillStyle=G.gndG||C.gnd1; g.fillRect(-r*1.5,y0,r*3,r*1.5);
    g.strokeStyle=C.white; g.lineWidth=s*0.008; g.beginPath(); g.moveTo(-r*1.5,y0); g.lineTo(r*1.5,y0); g.stroke();
    g.lineWidth=s*0.005; for(const k of [-20,-10,-5,5,10,20]){ const y=y0-k*pp, w=Math.abs(k)%10===0?r*0.24:r*0.12; g.beginPath(); g.moveTo(-w,y); g.lineTo(w,y); g.stroke(); }
    g.fillStyle=C.white; g.beginPath(); g.moveTo(0,-r*0.84); g.lineTo(-s*0.022,-r*0.75); g.lineTo(s*0.022,-r*0.75); g.closePath(); g.fill();
    g.restore(); G.blit(g,G.overC); },
  set(G,v){ G.sp.bank.to(v.bank); G.sp.pitch.to(v.pitch); }, knobs(){ return []; },
  prep(G,s){ const g=G.ctx, r=s*0.43; const a=g.createLinearGradient(0,-r,0,0); a.addColorStop(0,C.sky1); a.addColorStop(1,C.sky2); const b=g.createLinearGradient(0,0,0,r); b.addColorStop(0,C.gnd1); b.addColorStop(1,C.gnd2); G.skyG=a; G.gndG=b; } };
K.alt={ springs:{alt:[6,0.9,0]},
  under(g,s){ plate(g,s); const c=s/2, r=s*0.43;
    for(let i=0;i<50;i++){ const t=i*TAU/50, big=i%5===0; g.strokeStyle=C.tick; g.lineWidth=big?s*0.008:s*0.005; g.beginPath(); g.moveTo(c+Math.sin(t)*r*0.98,c-Math.cos(t)*r*0.98); g.lineTo(c+Math.sin(t)*r*(big?0.85:0.9),c-Math.cos(t)*r*(big?0.85:0.9)); g.stroke();
      if(big){ font(g,600,s*0.075,FD,true); g.fillStyle=C.ink; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(i/5),c+Math.sin(t)*r*0.7,c-Math.cos(t)*r*0.7); } }
    g.fillStyle='#000'; rr(g,c+r*0.22,c-s*0.035,s*0.16,s*0.07,s*0.01); g.fill(); font(g,500,s*0.048,FM); g.fillStyle=C.ink; g.textAlign='center'; g.fillText('1013',c+r*0.22+s*0.08,c+s*0.002);
    font(g,600,s*0.036,FD,true); g.fillStyle=C.ink2; g.fillText('ALT · FT',c,c+r*0.42); caption(g,s,'ALTIMETER'); },
  over(g,s){ glass(g,s); },
  draw(g,s,G){ const c=s/2, r=s*0.43, a=G.sp.alt.x; g.save(); g.translate(c,c); g.shadowColor='rgba(0,0,0,.7)'; g.shadowBlur=s*0.012;
    g.save(); g.rotate((a/10000)*TAU); g.fillStyle=C.white; g.beginPath(); g.moveTo(0,-r*0.95); g.lineTo(-s*0.012,-r*0.82); g.lineTo(s*0.012,-r*0.82); g.closePath(); g.fill(); g.fillRect(-s*0.003,-r*0.82,s*0.006,r*0.82); g.restore();
    g.save(); g.rotate((a%10000)/10000*TAU); g.fillStyle=C.white; g.beginPath(); g.moveTo(0,-r*0.5); g.lineTo(-s*0.03,-r*0.25); g.lineTo(-s*0.018,r*0.1); g.lineTo(s*0.018,r*0.1); g.lineTo(s*0.03,-r*0.25); g.closePath(); g.fill(); g.restore();
    g.save(); g.rotate((a%1000)/1000*TAU); needle(g,r*0.9,r*0.18,s*0.016,C.white,s*0.04); g.restore();
    g.restore(); g.fillStyle='#2a3036'; g.beginPath(); g.arc(c,c,s*0.03,0,TAU); g.fill(); G.blit(g,G.overC); },
  set(G,v){ G.sp.alt.to(v.alt); }, knobs(){ return []; } };
K.tc={ springs:{rate:[5,0.9,0],ball:[3,0.6,0]},
  under(g,s){ plate(g,s); const c=s/2, r=s*0.43; g.strokeStyle=C.white; g.lineWidth=s*0.01;
    for(const a of [-90,-70,70,90]){ const t=(a)*D2R; g.beginPath(); g.moveTo(c+Math.sin(t)*r*0.95,c-Math.cos(t)*r*0.95+r*0.08); g.lineTo(c+Math.sin(t)*r*0.78,c-Math.cos(t)*r*0.78+r*0.08); g.stroke(); }
    font(g,700,s*0.06,FD,true); g.fillStyle=C.ink; g.textAlign='center'; g.textBaseline='middle'; g.fillText('L',c-r*0.72,c+r*0.42); g.fillText('R',c+r*0.72,c+r*0.42);
    font(g,600,s*0.036,FD,true); g.fillStyle=C.ink2; g.fillText('2 MIN',c,c+r*0.72); g.fillText('TURN COORDINATOR',c,c-r*0.5);
    /* ball tube */
    g.fillStyle='#1b2a1e'; rr(g,c-r*0.42,c+r*0.38,r*0.84,r*0.18,r*0.09); g.fill(); g.strokeStyle='rgba(255,255,255,.25)'; g.lineWidth=s*0.004; g.stroke();
    g.strokeStyle=C.ink; g.beginPath(); g.moveTo(c-r*0.1,c+r*0.38); g.lineTo(c-r*0.1,c+r*0.56); g.moveTo(c+r*0.1,c+r*0.38); g.lineTo(c+r*0.1,c+r*0.56); g.stroke(); caption(g,s,'TURN'); },
  over(g,s){ glass(g,s); },
  draw(g,s,G){ const c=s/2, r=s*0.43, a=Math.max(-28,Math.min(28,G.sp.rate.x/3*20))*D2R;
    g.fillStyle='#e9eef1'; g.beginPath(); g.arc(c+G.sp.ball.x*r*0.3,c+r*0.47,r*0.075,0,TAU); g.fill();
    g.save(); g.translate(c,c+r*0.08); g.rotate(a); g.strokeStyle=C.white; g.fillStyle=C.white; g.lineCap='round'; g.lineWidth=s*0.02;
    g.beginPath(); g.moveTo(-r*0.74,0); g.lineTo(r*0.74,0); g.stroke(); g.beginPath(); g.arc(0,0,r*0.1,0,TAU); g.fill(); g.lineWidth=s*0.014; g.beginPath(); g.moveTo(-r*0.18,-r*0.14); g.lineTo(r*0.18,-r*0.14); g.moveTo(0,-r*0.1); g.lineTo(0,-r*0.24); g.stroke(); g.restore();
    G.blit(g,G.overC); },
  set(G,v){ G.sp.rate.to(v.rate); G.sp.ball.to(0); }, knobs(){ return []; } };
K.dg={ springs:{hdg:[6,0.95,1],bug:[12,1,1]},
  under(g,s){ plate(g,s); caption(g,s,'HEADING'); },
  card(g,s){ compassCard(g,s,s*0.3,s*0.42); },
  over(g,s){ const c=s/2, r=s*0.43; g.fillStyle=C.orange; g.beginPath(); g.moveTo(c,c-r*0.985); g.lineTo(c-s*0.022,c-r*1.07); g.lineTo(c+s*0.022,c-r*1.07); g.closePath(); g.fill();
    g.save(); g.translate(c,c); g.strokeStyle=C.orange; g.lineCap='round'; g.lineWidth=s*0.014; g.beginPath(); g.moveTo(0,-r*0.32); g.lineTo(0,r*0.26); g.moveTo(-r*0.3,-r*0.04); g.lineTo(r*0.3,-r*0.04); g.moveTo(-r*0.12,r*0.22); g.lineTo(r*0.12,r*0.22); g.stroke(); g.restore(); glass(g,s); },
  draw(g,s,G){ const c=s/2, r=s*0.43, hd=G.sp.hdg.x; G.rot(g,G.cardC,-hd);
    g.save(); g.translate(c,c); g.rotate((G.sp.bug.x-hd)*D2R); g.fillStyle=C.bug; g.fillRect(-s*0.03,-r*0.985,s*0.06,s*0.035); g.restore(); G.blit(g,G.overC); },
  set(G,v){ G.sp.hdg.to(v.hdg); G.sp.bug.to(v.bug); }, knobs(){ return []; } };
const vsiA=v=>{ const x=Math.max(-2000,Math.min(2000,v)); return -90+x/2000*170; };
K.vsi={ springs:{vs:[3,0.9,0]},
  under(g,s){ plate(g,s); const c=s/2, r=s*0.43;
    for(let k=-2000;k<=2000;k+=100){ const t=vsiA(k)*D2R, big=k%500===0; g.strokeStyle=C.tick; g.lineWidth=big?s*0.008:s*0.005; g.beginPath(); g.moveTo(c+Math.sin(t)*r*0.98,c-Math.cos(t)*r*0.98); g.lineTo(c+Math.sin(t)*r*(big?0.84:0.9),c-Math.cos(t)*r*(big?0.84:0.9)); g.stroke();
      if(big&&k%1000===0||k===500||k===-500||k===1500||k===-1500){ if(!big) continue; font(g,600,s*0.06,FD,true); g.fillStyle=C.ink; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(Math.abs(k)/100||0),c+Math.sin(t)*r*0.68,c-Math.cos(t)*r*0.68); } }
    font(g,600,s*0.034,FD,true); g.fillStyle=C.ink2; g.fillText('UP',c-r*0.35,c-r*0.32); g.fillText('DN',c-r*0.35,c+r*0.32); g.fillText('×100 FT/MIN',c+r*0.12,c+r*0.44); caption(g,s,'VSI'); },
  over(g,s){ glass(g,s); },
  draw(g,s,G){ const c=s/2, r=s*0.43; g.save(); g.translate(c,c); g.rotate(vsiA(G.sp.vs.x)*D2R); g.shadowColor='rgba(0,0,0,.7)'; g.shadowBlur=s*0.012; needle(g,r*0.9,r*0.16,s*0.016,C.white,s*0.04); g.restore();
    g.fillStyle='#2a3036'; g.beginPath(); g.arc(c,c,s*0.03,0,TAU); g.fill(); G.blit(g,G.overC); },
  set(G,v){ G.sp.vs.to(v.vs); }, knobs(){ return []; } };

const d3=a=>{ const v=Math.round(norm(a))%360; return String(v===0?360:v).padStart(3,'0'); };

/* ---------- gauge object ---------- */
function make(cv,kind){
  const k=K[kind], G={cv,kind,ctx:cv.getContext('2d'),s:0,dpr:1,v:{},sp:{},underC:mk(),cardC:k.card?mk():null,overC:mk(),dirty:true,knobs:[]};
  for(const n in k.springs){ const a=k.springs[n]; G.sp[n]=new Spring(a[0],a[1],!!a[2]); }
  /* draw a cached layer in css px, and a rotated card around the centre */
  G.blit=(g,src)=>{ g.drawImage(src,0,0,G.s,G.s); };
  G.rot=(g,src,deg)=>{ const c=G.s/2; g.save(); g.translate(c,c); g.rotate(deg*D2R); g.drawImage(src,-c,-c,G.s,G.s); g.restore(); };
  function layer(cn,fn){ cn.width=Math.round(G.s*G.dpr); cn.height=cn.width; const g=cn.getContext('2d'); g.setTransform(G.dpr,0,0,G.dpr,0,0); g.clearRect(0,0,G.s,G.s); fn(g,G.s); }
  function resize(){ const s=cv.clientWidth; if(!s) return; G.s=s; G.dpr=Math.min(window.devicePixelRatio||1,2.5);
    cv.width=Math.round(s*G.dpr); cv.height=Math.round(s*G.dpr); G.ctx.setTransform(G.dpr,0,0,G.dpr,0,0);
    layer(G.underC,k.under); if(G.cardC) layer(G.cardC,k.card); layer(G.overC,k.over); if(k.prep) k.prep(G,s); G.knobs=k.knobs(s); G.dirty=true; G.draw(); }
  G.draw=()=>{ if(!G.s) return; const g=G.ctx; g.clearRect(0,0,G.s,G.s); G.blit(g,G.underC); k.draw(g,G.s,G); G.dirty=false; };
  G.set=v=>{ G.v=v; k.set(G,v); G.dirty=true; };
  G.tick=dt=>{ let m=false; const rm=reduced(); for(const n in G.sp){ if(rm) G.sp[n].snap(); else if(G.sp[n].step(dt)) m=true; } return m; };
  G.snap=()=>{ for(const n in G.sp) G.sp[n].snap(); };
  G.relayout=()=>{ G.s=0; resize(); };
  new ResizeObserver(resize).observe(cv);
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ G.s=0; resize(); });
  return G;
}
window.NAVG={make,C};
})();
