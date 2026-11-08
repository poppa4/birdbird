/* Birdbird – storms.js: "Thunderstorms and wind shear" (storms.html). One storm, three views on one canvas.
   Life of a CB: a single cell (or a multicell cluster, a squall line, an embedded CB) in cross-section, 0–60 min.
     A CB needs moisture, instability and lift; take one away and it does not form. Cloud base = (T − Td) × 400 ft,
     tops and updrafts grow with instability and moisture; cumulus 0–15 min, mature 15–36, dissipating 36–60.
     Air motion is drawn by particles in a simple updraft/downdraft/outflow field.
   Microburst on final: point-mass approach at constant pitch attitude and thrust (or a recovery), through an outflow
     with a headwind → downdraft → tailwind: dV/dt = g·((T − D)/W − sin γa) + dHW/dt, dh/dt = V·sin γa + w.
     Lift = weight, so α rises as V falls (α = α0·(V0/V)²) and the path drops (γa = θ − α).
   Weather radar: 3.5° pencil beam from the aircraft (height = alt + r·tan(tilt) + 0.66·r² ft for the earth's curvature),
     reflectivity strong for liquid water below the freezing level, weak for ice above it; strong echoes attenuate the
     beam (two-way), so cells behind show weaker or not at all. Gain shifts all echoes by ±8 dB. */
(function(){
'use strict';
const {L,el,nf}=LAB;
const t2=(en,no)=>({en,no});
const INK={ink:'#D7E1E6',mute:'#8B99A7',dim:'#5E6D7C',cyan:'#7FCBE8',mag:'#E46BAE',amber:'#F0B440',red:'#EC5A47',green:'#71CC93',white:'#EEF3F7',blue:'#5AA9E6'};
const MONO='"IBM Plex Mono", ui-monospace, monospace', BODY='"Public Sans", system-ui, sans-serif';
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hooks=[]; const on=f=>{ hooks.push(f); return f; };
const hash=(n,s)=>{ const v=Math.sin(n*127.1+s*311.7)*43758.5453; return v-Math.floor(v); };

const S={view:'life',type:'single',t:24,m:0.75,i:0.75,l:0.7,play:false,
  dv:50,pil:'none',xc:2.6,R:0.8,vapp:140,fly:false,k:0,
  fl:33000,tilt:0,gain:'cal',rng:80,
  show:{air:true,haz:true,iso:true,avoid:false,truth:false,beam:true}};
const cv=el('stCv'); const C=LAB.fit(cv,()=>{ rebuild(); },2);
const stat=document.createElement('canvas'), sg=stat.getContext('2d');
/* label in a small dark box with a coloured edge (the wind tunnel's callout tags) */
function tag(g,s,x,y,col,al,sz){ const n=C.w<560; sz=sz||(n?10.5:12); g.font=`500 ${sz}px ${BODY}`; const w=g.measureText(s).width+12, h=sz+8; let x0=al==='center'?x-w/2:al==='right'?x-w:x; x0=Math.max(4,Math.min(C.w-w-4,x0)); const y0=y-h+4;
  g.fillStyle='rgba(14,18,22,.86)'; g.fillRect(x0,y0,w,h); g.strokeStyle='rgba(255,255,255,.14)'; g.lineWidth=1; g.strokeRect(x0+0.5,y0+0.5,w-1,h-1); g.fillStyle=col||INK.amber; g.fillRect(x0,y0,2,h); g.fillStyle='#EEF3F7'; g.textAlign='left'; g.fillText(s,x0+7,y0+h-5.5); }
function txt(g,s,x,y,col,al,sz,wt){ g.font=`${wt||500} ${sz||11}px ${MONO}`; g.textAlign=al||'left'; g.lineWidth=3; g.strokeStyle='rgba(12,17,22,.8)'; g.strokeText(s,x,y); g.fillStyle=col||INK.ink; g.fillText(s,x,y); g.textAlign='left'; }
function hatch(col,gap,dir){ const c=document.createElement('canvas'); c.width=c.height=gap; const x=c.getContext('2d'); x.strokeStyle=col; x.lineWidth=1; x.beginPath();
  if(dir>0){ x.moveTo(0,gap); x.lineTo(gap,0); x.moveTo(-1,1); x.lineTo(1,-1); x.moveTo(gap-1,gap+1); x.lineTo(gap+1,gap-1); } else { x.moveTo(0,0); x.lineTo(gap,gap); x.moveTo(gap-1,-1); x.lineTo(gap+1,1); x.moveTo(-1,gap-1); x.lineTo(1,gap+1); } x.stroke(); return x.createPattern(c,'repeat'); }
const PAT={ice:hatch('rgba(127,203,232,.6)',6,1),tu:hatch('rgba(240,180,64,.55)',8,-1)};
function arrow(g,x0,y0,x1,y1,col,w,h){ g.strokeStyle=col; g.fillStyle=col; g.lineWidth=w||1.6; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke(); const a=Math.atan2(y1-y0,x1-x0), k=h||6;
  g.beginPath(); g.moveTo(x1,y1); g.lineTo(x1-k*Math.cos(a-0.45),y1-k*Math.sin(a-0.45)); g.lineTo(x1-k*Math.cos(a+0.45),y1-k*Math.sin(a+0.45)); g.closePath(); g.fill(); }
function bg(g,W,H){ const b=g.createLinearGradient(0,0,0,H); b.addColorStop(0,'#141d26'); b.addColorStop(1,'#1d2833'); g.fillStyle=b; g.fillRect(0,0,W,H); }

/* =============== 1. LIFE OF A CB =============== */
const KX0=-45, KX1=75; let ZT=56000; const TP=39000, FZL=11000, M20=21000, M40=30500;
const LY={L0:44,R0:10,T0:8,yG:0,W:0,H:0};
const X=km=>LY.L0+(km-KX0)/(KX1-KX0)*(LY.W-LY.L0-LY.R0), Y=ft=>LY.yG-ft/ZT*(LY.yG-LY.T0);
const ENV={base:0,tmax:0,up:0,cb:false,why:null,td:0};
function env(){ const td=4+16*S.m, base=Math.round((25-td)*400/100)*100; ENV.td=td; ENV.base=base; ENV.why=null;
  if(S.l<0.2){ ENV.cb=false; ENV.why='lift'; ENV.tmax=0; ENV.up=0; return; }
  if(S.m<0.3){ ENV.cb=false; ENV.why='moist'; ENV.tmax=base+3000; ENV.up=400; return; }
  if(S.i<0.35){ ENV.cb=false; ENV.why='stab'; ENV.tmax=base+4000+9000*S.i/0.35; ENV.up=300+1500*S.i; return; }
  ENV.cb=true; ENV.tmax=Math.min(TP+4500,20000+30000*S.i*(0.6+0.4*S.m)); ENV.up=Math.round((800+5200*S.i*S.m)/100)*100; }
/* a cell at age a (min): stage, top, width, anvil, alpha */
function cell(a,xc){ const c={xc,a,st:'none',top:0,w:0,anv:0,al:1,up:0,dn:0,rain:0,hail:false,ltg:false,mb:false,gust:0};
  if(a<0||a>62) return c; const b=ENV.base;
  if(!ENV.cb){ const g=clamp(a/15,0,1); c.st='cu'; c.top=b+(ENV.tmax-b)*Math.pow(g,0.7); c.w=3+4*g; c.up=ENV.up*g; return c; }
  if(a<15){ const g=a/15; c.st='cu'; c.top=b+(0.72*ENV.tmax-b)*Math.pow(g,0.8); c.w=3+5*g; c.up=ENV.up*(0.4+0.4*g); return c; }
  if(a<36){ c.st='mat'; c.top=ENV.tmax; c.w=8+4*S.i; c.anv=Math.min(48,10+(a-15)*1.7); c.up=ENV.up; c.dn=ENV.up*0.6*Math.min(1,(a-15)/6); c.rain=1; c.hail=S.i>0.45; c.ltg=true; c.gust=Math.min(25,(a-15)*1.3); c.mb=a>=26&&S.i*S.m>0.35; return c; }
  const d=(a-36)/26; c.st='dis'; c.top=ENV.tmax*(0.92-0.35*d); c.w=(8+4*S.i)*(1-0.35*d); c.anv=48+d*8; c.al=1-0.6*d; c.up=0; c.dn=ENV.up*0.35*(1-d); c.rain=0.45*(1-d); c.gust=25*(1-d); c.mb=a<40&&S.i*S.m>0.35; return c; }
let CELLS=[], HC=null, LC=null;
function cells(){ env(); const t=S.t; CELLS.length=0;
  if(S.type==='multi'){ CELLS.push(cell(t+18,-16),cell(t+2,0),cell(t-14,15)); for(const c of CELLS) c.anv=Math.min(c.anv,22); let best=null; for(const c of CELLS) if(c.gust&&(!best||c.gust>best.gust)) best=c; for(const c of CELLS) if(c!==best){ c.gust=0; c.mb=false; } }
  else if(S.type==='squall'){ CELLS.push(cell(26,6)); }
  else CELLS.push(cell(t,0));
  HC=null; LC=null; for(let k=0;k<CELLS.length;k++){ const c=CELLS[k]; if(!HC&&c.hail&&c.st==='mat') HC=c; if(!LC&&c.ltg&&c.al>0.5&&S.type!=='emb') LC=c; } }
const STAGE={none:t2('no cloud','ingen sky'),cu:t2('cumulus (growing)','cumulus (voksende)'),mat:t2('mature','moden'),dis:t2('dissipating','oppløsning')};
function layoutLife(){ const W=C.w,H=C.h; LY.W=W; LY.H=H; const n=W<560; ZT=W<=640?47000:56000; LY.L0=n?34:44; LY.R0=n?6:10; LY.T0=6; LY.yG=H-(n?20:24); }
/* lumpy tower outline: left edge up, (anvil), right edge down */
function towerPath(g,c,yb){ const half=c.w/2, xa=X(c.xc-half), xb=X(c.xc+half), yt=Y(c.top), n=7, wpx=xb-xa;
  g.moveTo(xa,yb);
  if(c.st==='cu'){ for(let k=1;k<=n;k++){ const y=yb-(yb-yt)*k/n, bump=wpx*(0.06+0.08*hash(k,c.xc)); g.quadraticCurveTo(xa-bump,y+(yb-yt)/(2*n),xa+wpx*0.08*k/n,y); }
    g.quadraticCurveTo(xa+wpx*0.2,yt-wpx*0.25,X(c.xc),yt-4); g.quadraticCurveTo(xb-wpx*0.15,yt-wpx*0.2,xb-wpx*0.08,yt+(yb-yt)/n*0.6);
    for(let k=n-1;k>=0;k--){ const y=yb-(yb-yt)*k/n, bump=wpx*(0.06+0.08*hash(k+11,c.xc)); g.quadraticCurveTo(xb+bump,y-(yb-yt)/(2*n),xb-wpx*0.08*k/n,y); } g.closePath(); return; }
  const top=Math.min(c.top,TP), yab=Y(top-6500), ya=Y(top), aL=X(c.xc-half-4), aR=X(Math.min(KX1+5,c.xc+half+c.anv));
  for(let k=1;k<=n;k++){ const y=yb-(yb-yab)*k/n, bump=wpx*(0.05+0.07*hash(k,c.xc)); g.quadraticCurveTo(xa-bump,y+(yb-yab)/(2*n),xa+wpx*0.05*Math.sin(k),y); }
  g.lineTo(aL,yab+2); g.quadraticCurveTo(aL-8,ya+4,aL+6,ya); 
  if(c.top>TP+500&&c.st==='mat'){ const yo=Y(c.top); g.lineTo(X(c.xc-half*0.5),ya); g.quadraticCurveTo(X(c.xc),yo-6,X(c.xc+half*0.5),ya); }
  g.lineTo(aR,ya+1); g.quadraticCurveTo(aR+10,ya+5,aR,ya+10); g.quadraticCurveTo((xb+aR)/2,yab+2,xb+wpx*0.1,yab+5);
  for(let k=n-1;k>=0;k--){ const y=yb-(yb-yab)*k/n, bump=wpx*(0.05+0.07*hash(k+11,c.xc)); g.quadraticCurveTo(xb+bump,y-(yb-yab)/(2*n),xb-wpx*0.05*Math.sin(k),y); } g.closePath(); }
function drawLife(g){ const W=C.w,H=C.h, n=W<560; layoutLife(); bg(g,W,H); cells();
  /* isotherms and tropopause */
  if(S.show.iso){ g.setLineDash([5,4]); g.lineWidth=1.2;
    for(const [z,lab,col] of [[FZL,'0 °C','#CFEFFF'],[M20,'−20 °C','#9FD8F0'],[M40,'−40 °C','#7FA9C0']]){ g.strokeStyle=col; g.globalAlpha=0.6; g.beginPath(); g.moveTo(LY.L0,Y(z)); g.lineTo(W-LY.R0,Y(z)); g.stroke(); g.globalAlpha=1; txt(g,lab,W-LY.R0-4,Y(z)-4,col,'right',10); }
    g.strokeStyle='rgba(200,210,220,.35)'; g.beginPath(); g.moveTo(LY.L0,Y(TP)); g.lineTo(W-LY.R0,Y(TP)); g.stroke(); g.setLineDash([]); txt(g,L(t2('tropopause','tropopause')),W-LY.R0-4,Y(TP)-4,INK.mute,'right',10); }
  const yb=Y(ENV.base);
  /* squall line: trailing stratiform region */
  if(S.type==='squall'){ const gr=g.createLinearGradient(0,Y(27000),0,Y(9000)); gr.addColorStop(0,'rgba(200,210,220,.55)'); gr.addColorStop(1,'rgba(130,145,158,.6)'); g.fillStyle=gr;
    g.beginPath(); g.moveTo(X(KX0),Y(9000)); for(let x=KX0;x<=2;x+=1.5) g.lineTo(X(x),Y(27000+Math.sin(x/2.3)*500+(x>-6?(x+6)*700:0))); g.lineTo(X(2),Y(8000)); g.closePath(); g.fill();
    g.fillStyle='rgba(120,160,200,.12)'; g.fillRect(X(KX0),Y(9000),X(0)-X(KX0),LY.yG-Y(9000)); }
  /* rain shafts (static haze) */
  for(const c of CELLS){ if(!c.rain) continue; const half=c.w/2, x0=X(c.xc-half), x1=X(c.xc+(c.st==='mat'?0.15:1)*half); const gr=g.createLinearGradient(0,yb,0,LY.yG); gr.addColorStop(0,`rgba(120,165,210,${0.28*c.rain})`); gr.addColorStop(1,`rgba(120,165,210,${0.12*c.rain})`); g.fillStyle=gr; g.fillRect(x0,yb,x1-x0,LY.yG-yb); }
  /* cells */
  for(const c of CELLS){ if(c.st==='none') continue; g.save(); g.globalAlpha=c.al; const gr=g.createLinearGradient(0,Y(c.top),0,yb); gr.addColorStop(0,'rgba(240,244,247,.97)'); gr.addColorStop(0.55,'rgba(198,208,217,.96)'); gr.addColorStop(1,'rgba(98,112,126,.97)'); g.fillStyle=gr;
    g.beginPath(); towerPath(g,c,yb); g.fill();
    if(S.show.haz&&ENV.cb&&c.st!=='cu'){ g.save(); g.clip(); g.fillStyle=PAT.ice; g.fillRect(0,Y(Math.min(c.top,M20)),W,Y(FZL)-Y(Math.min(c.top,M20))); g.restore(); }
    g.restore(); }
  /* embedded: the layer cloud hides it */
  if(S.type==='emb'){ const gr=g.createLinearGradient(0,Y(23000),0,Y(3000)); gr.addColorStop(0,'rgba(178,190,201,.93)'); gr.addColorStop(1,'rgba(110,124,138,.95)'); g.fillStyle=gr; g.beginPath(); g.moveTo(X(KX0),Y(3000));
    for(let x=KX0;x<=KX1;x+=1.2) g.lineTo(X(x),Y(22000+Math.sin(x/3.1)*600+Math.sin(x/1.3)*250)); g.lineTo(X(KX1),Y(3000)); g.closePath(); g.fill();
    const c=CELLS[0]; if(c.st!=='none'){ g.setLineDash([4,4]); g.strokeStyle='rgba(255,215,160,.8)'; g.lineWidth=1.2; g.beginPath(); towerPath(g,c,Y(3000)); g.stroke(); g.setLineDash([]); tag(g,L(t2('CB hidden in layer cloud','CB skjult i lagskyer')),X(c.xc),Y(12000),'#FFD7A0','center'); } }
  /* turbulence zone around mature cells */
  if(S.show.haz&&ENV.cb){ for(const c of CELLS){ if(c.st!=='mat'&&!(c.st==='dis'&&S.type!=='multi')) continue; const half=c.w/2, xa=X(c.xc-half-14), xb=X(c.xc+half+14+c.anv*0.4), yt=Y(Math.min(ZT,c.top+3000));
    g.save(); g.globalAlpha=c.al; g.beginPath(); g.roundRect?g.roundRect(xa,yt,xb-xa,LY.yG-yt,18):g.rect(xa,yt,xb-xa,LY.yG-yt); g.setLineDash([6,4]); g.strokeStyle='rgba(240,180,64,.75)'; g.lineWidth=1.2; g.stroke(); g.setLineDash([]); g.restore();
    tag(g,L(t2('severe turbulence','kraftig turbulens')),xa+6,yt+20,INK.amber,'left'); } }
  /* gust front and microburst */
  for(const c of CELLS){ if(!c.gust||c.al<0.4) continue; const xd=c.xc-c.w*0.25, xg=c.xc+c.w/2+c.gust; const y=LY.yG-6;
    arrow(g,X(xd),y,X(xg),y,'rgba(238,243,247,.85)',2,7); arrow(g,X(xd),y,X(xd-6-c.gust*0.3),y,'rgba(238,243,247,.6)',1.6,6);
    tag(g,L(t2('gust front','vindkastfront')),X(xg),y-10,INK.white,'right');
    if(S.type==='squall'){ g.fillStyle='rgba(150,165,178,.9)'; g.beginPath(); g.moveTo(X(c.xc+c.w/2),Y(ENV.base)); g.quadraticCurveTo(X(xg-4),Y(ENV.base*0.5),X(xg-1),Y(900)); g.lineTo(X(c.xc+c.w/2-1),Y(900)); g.closePath(); g.fill(); tag(g,L(t2('shelf cloud','hyllesky')),X(c.xc+c.w/2+2),Y(ENV.base+1400),'#C9D2DA','left'); }
    if(c.mb&&S.type!=='squall'){ tag(g,L(t2('microburst','mikroburst')),X(xd),Y(ENV.base*0.6),INK.red,'right'); } }
  /* avoidance */
  const mc=CELLS.find(c=>c.st==='mat')||CELLS.find(c=>c.st==='dis');
  if(S.show.avoid&&mc&&ENV.cb){ g.setLineDash([3,4]); g.lineWidth=1.2;
    for(const [km,lab] of [[18.5,'10 NM'],[37,'20 NM']]){ for(const sgn of [-1,1]){ const x=X(mc.xc+sgn*(mc.w/2+km)); if(x<LY.L0||x>W-LY.R0) continue; g.strokeStyle='rgba(228,107,174,.7)'; g.beginPath(); g.moveTo(x,Y(ZT-4000)); g.lineTo(x,LY.yG); g.stroke(); txt(g,lab,x,Y(ZT-4000)-4,INK.mag,'center',10); } }
    g.setLineDash([]); if(mc.anv>8) tag(g,L(t2('hail can fall from the anvil','hagl kan falle fra ambolten')),X(mc.xc+mc.w/2+4),Y(Math.min(mc.top,TP)-12000),INK.mag,'left'); }
  /* labels */
  for(const c of CELLS){ if(c.st==='none') continue; if(S.type==='multi') txt(g,L(STAGE[c.st]),X(c.xc),Y(Math.min(ZT-1500,c.top+1800)),c.st==='mat'?'#FFD7A0':INK.ink,'center',n?10:11,600);
    if(c.st==='mat'&&c.anv>14&&!n&&S.type!=='multi') tag(g,L(t2('anvil','ambolt')),X(c.xc+c.w/2+c.anv*0.6),Y(Math.min(c.top,TP)-7500),'#C9D2DA','left');
    if(c.st==='mat'&&c.top>TP+500&&!n) tag(g,L(t2('overshooting top','overskytende topp')),X(c.xc)+30,Y(c.top)-2,'#C9D2DA','left'); }
  if(!ENV.cb){ const msg=ENV.why==='lift'?t2('No lift: moist, unstable air, but nothing starts it rising. Clear sky.','Ingen løft: fuktig, ustabil luft, men ingenting får den til å stige. Klar himmel.'):ENV.why==='moist'?t2('Too dry: the cloud base is high and only small cumulus form.','For tørt: skybasen er høy, og bare små cumulus dannes.'):t2('Too stable: the cumulus stops growing. No CB.','For stabilt: cumulusen slutter å vokse. Ingen CB.');
    txt(g,L(msg),W/2,Y(32000),INK.amber,'center',n?10:12,600); }
  /* cloud base, ground, axes */
  if(CELLS.some(c=>c.st!=='none')){ txt(g,L(t2('base','base'))+' '+nf(ENV.base,0)+' ft',X(CELLS[0].xc-CELLS[0].w/2)-6,yb+4,INK.mute,'right',10); }
  g.fillStyle='#2a2f2a'; g.fillRect(LY.L0,LY.yG,W-LY.L0-LY.R0,4); g.strokeStyle='#55626e'; g.lineWidth=1; g.beginPath(); g.moveTo(LY.L0,LY.yG+0.5); g.lineTo(W-LY.R0,LY.yG+0.5); g.stroke();
  axesFt(g,[10000,20000,30000,40000],Y,W);
  const sx=X(KX1-5), s10=X(KX1-5)-X(KX1-5-18.52); g.strokeStyle=INK.mute; g.lineWidth=1.2; g.beginPath(); g.moveTo(sx-s10,LY.yG+12); g.lineTo(sx,LY.yG+12); g.moveTo(sx-s10,LY.yG+8); g.lineTo(sx-s10,LY.yG+16); g.moveTo(sx,LY.yG+8); g.lineTo(sx,LY.yG+16); g.stroke(); txt(g,'10 NM',sx-s10/2,LY.yG+(n?20:22),INK.mute,'center',9.5);
  }
function axesFt(g,ticks,Yf,W){ g.font=`10px ${MONO}`; g.textAlign='right'; for(const a of ticks){ const y=Yf(a); g.fillStyle=INK.dim; g.fillText(a>=10000?'FL'+a/100:nf(a,0),LY.L0-4,y+3); g.strokeStyle='rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(LY.L0,y); g.lineTo(W-LY.R0,y); g.stroke(); } g.textAlign='left'; }
/* particles, rain, hail, lightning (life view) */
const NPt=260, pX=new Float32Array(NPt), pZ=new Float32Array(NPt), pU=new Float32Array(NPt), pW=new Float32Array(NPt);
const NR=150, rX=new Float32Array(NR), rP=new Float32Array(NR), rC=new Int8Array(NR);
const LTG=new Float32Array(32); let ltgN=0, ltgT=0, ltgNext=1.2;
const VEL={u:0,w:0};
function vel(x,z){ let u=0,w=0; for(let i=0;i<CELLS.length;i++){ const c=CELLS[i]; if(c.st==='none') continue; const half=c.w/2, dx=x-c.xc, sh=Math.cos(Math.PI/2*clamp(dx/half,-1,1));
    if(c.st==='cu'){ if(Math.abs(dx)<half&&z>ENV.base*0.3&&z<c.top) w+=c.up*sh*(0.3+0.7*Math.sin(Math.PI*clamp(z/c.top,0,1))); continue; }
    if(c.st==='mat'&&dx>-0.15*half&&dx<half&&z>ENV.base*0.3&&z<c.top){ const s2=Math.cos(Math.PI/2*clamp((dx-0.42*half)/(0.58*half),-1,1)); w+=c.up*s2*(0.35+0.65*Math.sin(Math.PI*clamp(z/c.top,0,1))); if(z>Math.min(c.top,TP)-5500){ u+=1.6; w*=0.25; } }
    const dlo=c.st==='mat'?-half:-half, dhi=c.st==='mat'?-0.15*half:half; if(c.dn&&dx>dlo&&dx<dhi&&z<Math.min(c.top*0.75,26000)){ const s3=Math.cos(Math.PI/2*clamp((dx-(dlo+dhi)/2)/((dhi-dlo)/2),-1,1)); w-=c.dn*s3*(z<2500?z/2500:1)*(c.mb?1.5:1); }
    if(c.dn&&z<3000){ const xd=c.xc+(c.st==='mat'?-0.55*half:0), r=x-xd; if(Math.abs(r)<c.gust+half+4) u+=Math.sign(r)*c.dn*0.0011*(r>0?1.2:0.7)*Math.exp(-z/1500)*clamp(Math.abs(r)/2,0,1); } }
  VEL.u=u; VEL.w=w; return VEL; }
function respawn(i){ let nl=0; for(let k=0;k<CELLS.length;k++) if(CELLS[k].st!=='none') nl++; if(!nl){ pZ[i]=-1; return; } let pick=Math.floor(Math.random()*nl), c=null; for(let k=0;k<CELLS.length;k++){ if(CELLS[k].st==='none') continue; if(pick--===0){ c=CELLS[k]; break; } } const half=c.w/2;
  if(c.st==='mat'&&Math.random()<0.35){ pX[i]=c.xc-half*(0.2+0.75*Math.random()); pZ[i]=6000+Math.random()*Math.min(18000,c.top*0.6); }
  else if(c.st==='dis'){ pX[i]=c.xc+(Math.random()-0.5)*c.w; pZ[i]=4000+Math.random()*c.top*0.6; }
  else { pX[i]=c.xc+(c.st==='mat'?(Math.random()*0.85)*half:(Math.random()-0.5)*c.w*0.8); pZ[i]=ENV.base*0.5+Math.random()*(c.top*0.85-ENV.base*0.5); } }
function seedLife(){ for(let i=0;i<NPt;i++) respawn(i); for(let i=0;i<NR;i++){ rP[i]=Math.random(); rC[i]=-1; } }
function stepLife(dt,t){ for(let i=0;i<NPt;i++){ if(pZ[i]<0){ respawn(i); continue; } const v=vel(pX[i],pZ[i]); pU[i]=v.u; pW[i]=v.w; pX[i]+=v.u*dt; pZ[i]+=v.w*0.35*dt;
    if(pZ[i]<=200||pZ[i]>ZT||pX[i]<KX0||pX[i]>KX1||(Math.abs(v.w)<60&&Math.abs(v.u)<0.1)||Math.random()<dt*0.12) respawn(i); }
  ltgT-=dt; if(ltgT<=0&&ltgN) ltgN=0; ltgNext-=dt; if(ltgNext<=0&&!reduce){ ltgNext=0.8+Math.random()*2.2; const c=LC; if(c){ const cg=Math.random()<0.45; let x=c.xc+(Math.random()-0.5)*c.w*0.6, z=cg?FZL+2000+Math.random()*6000:16000+Math.random()*10000; ltgN=0;
      for(let k=0;k<16;k++){ LTG[2*k]=x; LTG[2*k+1]=z; ltgN++; if(cg){ z-=(z/ (16-k)); x+=(Math.random()-0.5)*1.6; if(z<=0){ LTG[2*k+1]=0; break; } } else { x+=(Math.random()-0.3)*2.2; z+=(Math.random()-0.5)*1800; } } ltgT=0.14; } } }
function frameLife(g,t){ const W=C.w;
  /* rain */
  const yb=Y(ENV.base); g.strokeStyle='rgba(140,190,235,.7)'; g.lineWidth=1; g.beginPath();
  for(let i=0;i<NR;i++){ const c=CELLS[i%CELLS.length]; if(!c||!c.rain||c.st==='none') continue; if(i/NR>c.rain*(S.type==='emb'?1:1)) continue; const half=c.w/2, x0=c.xc-half, x1=c.xc+(c.st==='mat'?0.15:1)*half, x=X(x0+(x1-x0)*hash(i,7)); const f=(rP[i]+t*0.9)%1, y=yb+(LY.yG-yb)*f; g.moveTo(x,y); g.lineTo(x-1,y+6); } g.stroke();
  /* hail */
  const hc=HC; if(hc&&S.type!=='emb'){ g.fillStyle='rgba(240,248,255,.95)'; g.beginPath(); const half=hc.w/2;
    for(let k=0;k<16;k++){ const x=hc.xc+half*(0.05+0.8*hash(k,3)), z=FZL+2000+(Math.min(hc.top,TP)*0.62-FZL)*hash(k,5)+2200*Math.sin(t*1.1+k*1.7); g.moveTo(X(x)+2,Y(z)); g.arc(X(x),Y(z),2,0,Math.PI*2); }
    for(let k=0;k<6;k++){ const x=hc.xc+half+2+Math.min(14,hc.anv*0.5)*hash(k,9), f=(hash(k,2)+t*0.35)%1, z=(Math.min(hc.top,TP)-6500)*(1-f); g.moveTo(X(x)+2,Y(z)); g.arc(X(x),Y(z),1.8,0,Math.PI*2); }
    g.fill(); }
  /* air motion */
  if(S.show.air){ for(let pass=0;pass<2;pass++){ g.beginPath(); for(let i=0;i<NPt;i++){ if(pZ[i]<0) continue; const up=pW[i]>=0; if((pass===0)!==up) continue; const x=X(pX[i]), y=Y(pZ[i]), dx=pU[i]*0.9, dz=pW[i]*0.35*0.55; g.moveTo(x,y); g.lineTo(X(pX[i]-dx),Y(pZ[i]-dz)); }
      g.strokeStyle=pass===0?'rgba(240,160,80,.95)':'rgba(110,180,240,.95)'; g.lineWidth=1.6; g.stroke(); } }
  /* lightning */
  if(ltgN>1){ g.save(); g.strokeStyle='rgba(255,250,210,.95)'; g.shadowColor='rgba(255,250,200,.9)'; g.shadowBlur=10; g.lineWidth=1.6; g.beginPath(); g.moveTo(X(LTG[0]),Y(LTG[1])); for(let k=1;k<ltgN;k++) g.lineTo(X(LTG[2*k]),Y(LTG[2*k+1])); g.stroke(); g.restore(); }
}

/* =============== 2. MICROBURST ON FINAL =============== */
const D0=6, HT=2600, MAXN=2400, DT=0.1;
const sD=new Float32Array(MAXN), sH=new Float32Array(MAXN), sV=new Float32Array(MAXN), sHW=new Float32Array(MAXN), sW=new Float32Array(MAXN), sF=new Uint8Array(MAXN);
const SIM={n:0,trig:-1,gnd:-1,shaker:-1,minV:0,maxV:0,minDev:0,ga:false};
const MB={L0:40,R0:10,T0:8,yG:0,yS0:0,yS1:0};
const MX=d=>MB.L0+(D0-d)/D0*(C.w-MB.L0-MB.R0), MY=h=>MB.yG-h/HT*(MB.yG-MB.T0);
function hw(d,h){ const dx=(d-S.xc)/S.R, f=dx*Math.exp(0.5*(1-dx*dx)), hf=clamp(h/150,0.5,1)*Math.exp(-Math.max(0,h-300)/1300); return S.dv/2*f*hf; }
function wv(d,h){ const dx=(d-S.xc)/S.R; return -40*S.dv*Math.exp(-dx*dx/0.64)*clamp(h/500,0.12,1); }
const gsH=d=>d*6076*Math.tan(3*Math.PI/180)+50;
function simulate(){ const V0=S.vapp, a0=5, th0=-3+a0, TW0=0.12-Math.sin(3*Math.PI/180); let d=5.4, h=gsH(5.4), V=V0, th=th0, TW=TW0, mode=0, prevHW=hw(d,h); // mode 0 approach, 1 recovery
  SIM.trig=-1; SIM.gnd=-1; SIM.shaker=-1; SIM.minV=V0; SIM.maxV=V0; SIM.minDev=0; SIM.ga=false; let i=0;
  for(;i<MAXN;i++){ const W_=hw(d,h), w=wv(d,h), a=a0*(V0/V)*(V0/V), ga=(th-a)*Math.PI/180;
    sD[i]=d; sH[i]=h; sV[i]=V; sHW[i]=W_; sW[i]=w; sF[i]=mode; SIM.minV=Math.min(SIM.minV,V); SIM.maxV=Math.max(SIM.maxV,V); SIM.minDev=Math.min(SIM.minDev,h-gsH(Math.max(0,d)));
    if(a>12&&SIM.shaker<0) SIM.shaker=i;
    if(mode===0&&((S.pil==='rec'&&(V<V0-15||h<gsH(d)-150))||(S.pil==='early'&&(V>V0+10||W_-hw(5.4,gsH(5.4))>12)))){ mode=1; SIM.trig=i; }
    if(mode===1){ TW=Math.min(0.30,TW+0.08*DT); th=Math.min(15,th+3*DT); if(a>12) th-=4*DT; }
    const D_=0.03*(V/V0)*(V/V0)+0.09*(V0/V)*(V0/V);
    const dHW=(W_-prevHW)/DT; prevHW=W_;
    V+=(19.06*(TW-D_-Math.sin(ga))+dHW)*DT; V=Math.max(60,V);
    h+=(V*1.6878*Math.sin(ga)+w/60)*DT; d-=(V*Math.cos(ga)-W_)/3600*DT;
    if(h<=0&&d>0.05){ SIM.gnd=i; sD[i+1]=d; sH[i+1]=0; sV[i+1]=V; sHW[i+1]=W_; sW[i+1]=w; sF[i+1]=mode; i+=2; break; }
    if(d<=0||(mode===1&&h>HT-150)){ i++; break; } }
  SIM.n=Math.min(i,MAXN); SIM.ga=SIM.trig>=0; }
function drawMB(g){ const W=C.w,H=C.h,n=W<560; MB.L0=n?36:44; MB.R0=n?6:10; MB.T0=8; const sh=Math.max(70,Math.round(H*0.24)); MB.yS1=H-6; MB.yS0=H-sh; MB.yG=MB.yS0-(n?20:24);
  bg(g,W,H); simulate();
  /* cloud base and rain shaft over the microburst */
  const xc=MX(S.xc), rw=MX(S.xc-S.R*1.1)-MX(S.xc+S.R*1.1), cb=MY(HT-120);
  const gr=g.createLinearGradient(0,MB.T0,0,cb+16); gr.addColorStop(0,'rgba(90,103,116,.98)'); gr.addColorStop(1,'rgba(70,82,94,.98)'); g.fillStyle=gr; g.beginPath(); g.moveTo(MB.L0,MB.T0);
  for(let x=MB.L0;x<=W-MB.R0;x+=6){ const near=Math.exp(-Math.pow((x-xc)/(rw*1.6),2)); g.lineTo(x,cb-6+near*14+Math.sin(x/9)*3); } g.lineTo(W-MB.R0,MB.T0); g.closePath(); g.fill();
  const rs=g.createLinearGradient(0,cb,0,MB.yG); rs.addColorStop(0,'rgba(120,165,210,.35)'); rs.addColorStop(1,'rgba(120,165,210,.15)'); g.fillStyle=rs; g.beginPath(); g.moveTo(xc-rw*0.45,cb); g.lineTo(xc+rw*0.45,cb); g.lineTo(xc+rw*0.75,MB.yG); g.lineTo(xc-rw*0.75,MB.yG); g.closePath(); g.fill();
  /* wind field */
  if(S.show.air){ g.lineWidth=1.2; for(let h=150;h<HT-250;h+=330) for(let d=0.15;d<D0;d+=D0/(n?11:20)){ const u=-hw(d,h), w=wv(d,h); const sx=u, sy=w/60*0.6; const m=Math.hypot(sx,sy); if(m<2) continue; const k=Math.min(18,4+m*0.45)/m, x=MX(d), y=MY(h);
      arrow(g,x-sx*k/2,y+sy*k/2,x+sx*k/2,y-sy*k/2,w<-600?'rgba(110,180,240,.75)':'rgba(238,243,247,.45)',1.1,4); } }
  /* runway, glide path */
  g.fillStyle='#2a2f2a'; g.fillRect(MB.L0,MB.yG,W-MB.L0-MB.R0,4); g.fillStyle='#55626e'; g.fillRect(MX(0),MB.yG-1,MX(-0.4)-MX(0)+6,5); txt(g,L(t2('runway','rullebane')),MX(0)-4,MB.yG-6,INK.mute,'right',10);
  g.setLineDash([5,5]); g.strokeStyle='rgba(113,204,147,.75)'; g.lineWidth=1.3; g.beginPath(); g.moveTo(MX(D0),MY(gsH(D0))); g.lineTo(MX(0),MY(50)); g.stroke(); g.setLineDash([]); txt(g,L(t2('3° glide path','3° glidebane')),MX(5.6),MY(gsH(5.6))-8,INK.green,'left',10);
  /* labels in the field */
  tag(g,L(t2('headwind','motvind')),MX(S.xc+S.R*1.3),MY(300),INK.white,'center'); tag(g,L(t2('downdraft','nedvind')),xc,MY(HT*0.55),'#6EB4F0','center'); tag(g,L(t2('tailwind','medvind')),MX(S.xc-S.R*1.3),MY(300),INK.white,'center');
  /* flown path */
  g.strokeStyle='rgba(238,243,247,.9)'; g.lineWidth=1.8; g.beginPath(); for(let i=0;i<SIM.n;i+=2){ const x=MX(sD[i]), y=MY(sH[i]); if(i) g.lineTo(x,y); else g.moveTo(x,y); } g.stroke();
  if(SIM.trig>=0){ const x=MX(sD[SIM.trig]), y=MY(sH[SIM.trig]); g.fillStyle=INK.amber; g.beginPath(); g.arc(x,y,4,0,Math.PI*2); g.fill(); txt(g,S.pil==='early'?L(t2('go-around','go-around')):L(t2('recovery','gjenoppretting')),x,y-9,INK.amber,'center',10); }
  if(SIM.gnd>=0){ const x=clamp(MX(sD[SIM.gnd]),MB.L0+(n?60:130),W-MB.R0-(n?60:130)); txt(g,'✕ '+L(n?t2('ground contact','bakkekontakt'):t2('ground contact short of the runway','bakkekontakt før rullebanen')),x,MB.yG-10,INK.red,'center',n?10:11,600); }
  /* axes */
  axesMB(g,W,n);
  /* strip: IAS change and headwind */
  const y0=MB.yS0,y1=MB.yS1, xa=MX(D0), xb=MX(0); g.fillStyle='rgba(8,12,16,.45)'; g.fillRect(xa,y0,xb-xa,y1-y0); g.strokeStyle='rgba(255,255,255,.07)'; g.strokeRect(xa+0.5,y0+0.5,xb-xa-1,y1-y0-1);
  const sc=Math.max(30,Math.ceil(Math.max(SIM.maxV-S.vapp,S.vapp-SIM.minV,S.dv/2)/10)*10), yk=v=>(y0+y1)/2-v/sc*((y1-y0)/2-8);
  g.strokeStyle='rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(xa,yk(0)); g.lineTo(xb,yk(0)); g.stroke();
  g.setLineDash([4,3]); g.strokeStyle='rgba(238,243,247,.6)'; g.lineWidth=1.4; g.beginPath(); for(let i=0;i<SIM.n;i+=2){ const x=MX(sD[i]), y=yk(sHW[i]); if(i) g.lineTo(x,y); else g.moveTo(x,y); } g.stroke(); g.setLineDash([]);
  g.strokeStyle=INK.amber; g.lineWidth=1.8; g.beginPath(); for(let i=0;i<SIM.n;i+=2){ const x=MX(sD[i]), y=yk(sV[i]-S.vapp); if(i) g.lineTo(x,y); else g.moveTo(x,y); } g.stroke();
  txt(g,'IAS − Vapp',xa+4,y0+12,INK.amber,'left',10,600); txt(g,L(t2('headwind','motvind')),xa+4,y0+25,'#C9D2DA','left',10); txt(g,'+'+sc+' kt',xb-4,y0+12,INK.dim,'right',9.5); txt(g,'−'+sc+' kt',xb-4,y1-4,INK.dim,'right',9.5);
  MB.yk=yk; }
function axesMB(g,W,n){ g.font=`10px ${MONO}`; g.textAlign='right'; for(const a of [500,1000,1500,2000]){ const y=MY(a); g.fillStyle=INK.dim; g.fillText(nf(a,0),MB.L0-4,y+3); g.strokeStyle='rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(MB.L0,y); g.lineTo(W-MB.R0,y); g.stroke(); }
  g.textAlign='center'; for(let d=1;d<=5;d++) g.fillText(d+(d===5?' NM':''),MX(d),MB.yG+15); g.textAlign='left'; }
function frameMB(g){ const i=Math.min(SIM.n-1,Math.floor(S.k)); if(i<0) return; const x=MX(sD[i]), y=MY(sH[i]);
  g.strokeStyle=INK.mag; g.lineWidth=1.2; g.beginPath(); g.moveTo(x,MB.yS0); g.lineTo(x,MB.yS1); g.stroke(); if(MB.yk){ g.fillStyle=INK.amber; g.beginPath(); g.arc(x,MB.yk(sV[i]-S.vapp),3,0,Math.PI*2); g.fill(); }
  const a=i>0?Math.atan2(-(sH[i]-sH[i-1])*(MB.yG-MB.T0)/HT,(sD[i-1]-sD[i])/D0*(C.w-MB.L0-MB.R0)||1):0;
  g.save(); g.translate(x,y); g.rotate(a); drawJetSide(g,C.w<560?1.05:1.3); g.restore(); }
function drawJetSide(g,s){ g.save(); g.scale(s,s); g.fillStyle='#E8EEF2'; g.strokeStyle='rgba(10,14,18,.9)'; g.lineWidth=0.8/s;
  g.beginPath(); g.moveTo(-17,-1.2); g.bezierCurveTo(-14,-3.4,-6,-3.6,8,-3.4); g.bezierCurveTo(13,-3.3,16.5,-2,18,0); g.bezierCurveTo(16.5,1.8,13,2.6,8,2.7); g.lineTo(-12,2.6); g.bezierCurveTo(-15,2.4,-17,1.4,-17,-1.2); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-11,-3.2); g.lineTo(-16.5,-10.5); g.lineTo(-13.6,-10.5); g.lineTo(-6.5,-3.4); g.closePath(); g.fill(); g.stroke();
  g.fillStyle='#B7C3CC'; g.beginPath(); g.moveTo(-2,0.6); g.lineTo(5,0.6); g.lineTo(-4,4.6); g.lineTo(-7,4.6); g.closePath(); g.fill();
  g.fillStyle='#9AA8B3'; g.beginPath(); g.ellipse(1,3.6,3.6,1.3,0,0,Math.PI*2); g.fill(); g.fillStyle='#2B4A63'; g.beginPath(); g.moveTo(13.2,-2.4); g.lineTo(15.4,-1.4); g.lineTo(13.2,-1.2); g.closePath(); g.fill(); g.restore(); }

/* =============== 3. WEATHER RADAR =============== */
const RFZL=14000, BW=3.5;
const RC=[{id:'A',b:-6,r:38,pk:56,rc:5,top:43000},{id:'B',b:-2,r:68,pk:52,rc:6,top:40000},{id:'C',b:30,r:52,pk:46,rc:4,top:22000}];
for(const c of RC){ c.x=c.r*Math.sin(c.b*Math.PI/180); c.y=c.r*Math.cos(c.b*Math.PI/180); }
/* true reflectivity (dBZ) at a point (x,y NM, h ft) */
function zTrue(x,y,h){ let best=-99; for(let i=0;i<RC.length;i++){ const c=RC[i]; if(h>c.top) continue; const d2=((x-c.x)*(x-c.x)+(y-c.y)*(y-c.y))/(c.rc*c.rc); if(d2>4) continue;
    let z=c.pk-14*d2; if(h>RFZL) z-=22*(h-RFZL)/(c.top-RFZL)+4; if(h>c.top-3000) z-=8; if(z>best) best=z; } return best; }
const beamC=r=>S.fl+r*6076*Math.tan(S.tilt*Math.PI/180)+0.664*r*r, beamHW=r=>r*6076*Math.tan(BW/2*Math.PI/180);
const GAIN={min:-8,cal:0,max:8};
const NB=121, NRr=150; const PPI=new Float32Array(NB*NRr), GND=new Uint8Array(NB*NRr), TRU=new Float32Array(NB*NRr);
const RO2={};
function scan(){ const R=S.rng, dr=R/NRr, gdb=GAIN[S.gain];
  for(let b=0;b<NB;b++){ const br=(-60+b)*Math.PI/180, sb=Math.sin(br), cb=Math.cos(br); let att=0;
    for(let k=0;k<NRr;k++){ const r=(k+0.5)*dr, x=r*sb, y=r*cb, hc=beamC(r), hw=beamHW(r); let zs=-99, zt=-99, cnt=0, sum=0;
      for(let j=-3;j<=3;j++){ const h=hc+hw*j/3; if(h<0) continue; const z=zTrue(x,y,h); if(z>zt) zt=z; const lin=z>-50?Math.pow(10,z/10):0; sum+=lin*(1-Math.abs(j)/4); cnt+=(1-Math.abs(j)/4); }
      zs=sum>0?10*Math.log10(sum/cnt):-99; const lo=hc-hw; GND[b*NRr+k]=lo<0?(lo<-hw*0.6?2:1):0;
      PPI[b*NRr+k]=zs>-50?zs-att+gdb:-99; TRU[b*NRr+k]=Math.max(-99,zTrue(x,y,Math.min(RFZL-2000,Math.max(500,hc))));
      if(zs>30) att+=(zs-30)*0.11*dr*2; } } }
const zcol=(z,a)=>z>=50?`rgba(214,40,190,${a})`:z>=40?`rgba(226,58,46,${a})`:z>=30?`rgba(232,200,60,${a})`:z>=20?`rgba(46,160,90,${a})`:null;
const ZN=z=>z>=50?t2('magenta','magenta'):z>=40?t2('red','rød'):z>=30?t2('yellow','gul'):z>=20?t2('green','grønn'):t2('nothing','ingenting');
function cellOnDisplay(c){ const R=S.rng; if(c.r>R) return -100; let best=-99; for(let b=0;b<NB;b++){ const bd=-60+b; if(Math.abs(bd-c.b)>Math.max(4,c.rc/c.r*57)) continue; for(let k=0;k<NRr;k++){ const r=(k+0.5)*R/NRr; if(Math.abs(r-c.r)>c.rc*1.2) continue; best=Math.max(best,PPI[b*NRr+k]); } } return best; }
function drawWX(g){ const W=C.w,H=C.h,n=W<560; bg(g,W,H); scan();
  /* side view (top 36 %) */
  const L0=n?34:44, R0=n?6:10, T0=W<=640?8:58, sh=Math.round(H*(n?0.34:0.30)), yG=T0+sh, R=S.rng; const SX=r=>L0+r/R*(W-L0-R0), SY=h=>yG-h/50000*(sh-6);
  g.fillStyle='rgba(8,12,16,.35)'; g.fillRect(L0,T0,W-L0-R0,sh);
  for(const c of RC){ if(Math.abs(c.b)>12||c.r>R) continue; const xm=SX(c.r), hw=Math.max(5,(SX(c.rc*1.5)-SX(0))), yt=SY(c.top), ab=SY(c.top-5000);
    g.fillStyle='rgba(205,214,222,.30)'; g.beginPath(); g.moveTo(xm-hw,yG); g.quadraticCurveTo(xm-hw*1.15,(yG+ab)/2,xm-hw*0.8,ab); g.lineTo(xm-hw*1.4,ab); g.quadraticCurveTo(xm-hw*1.5,yt,xm-hw*1.2,yt); g.lineTo(xm+hw*2.4,yt); g.quadraticCurveTo(xm+hw*2.6,yt+4,xm+hw*2.2,ab); g.lineTo(xm+hw*0.8,ab); g.quadraticCurveTo(xm+hw*1.15,(yG+ab)/2,xm+hw,yG); g.closePath(); g.fill();
    for(let h=0;h<c.top;h+=500){ const z=zTrue(c.x,c.y,h); if(z<20) continue; const f=Math.sqrt(clamp((z-12)/(c.pk-12),0,1)); g.fillStyle=zcol(z,0.85); g.fillRect(xm-hw*0.75*f,SY(h+500),hw*1.5*f,SY(h)-SY(h+500)+0.6); }
    txt(g,c.id,xm,yt-4,INK.ink,'center',10,600); }
  g.setLineDash([4,4]); g.strokeStyle='rgba(207,239,255,.55)'; g.lineWidth=1; g.beginPath(); g.moveTo(L0,SY(RFZL)); g.lineTo(W-R0,SY(RFZL)); g.stroke(); g.setLineDash([]); txt(g,'0 °C',W-R0-4,SY(RFZL)-4,'#CFEFFF','right',9.5);
  if(S.show.beam){ g.fillStyle='rgba(228,107,174,.13)'; g.strokeStyle='rgba(228,107,174,.8)'; g.lineWidth=1; g.beginPath(); g.moveTo(SX(0),SY(S.fl)); for(let r=0;r<=R;r+=R/40) g.lineTo(SX(r),SY(clamp(beamC(r)+beamHW(r),0,50000))); for(let r=R;r>=0;r-=R/40) g.lineTo(SX(r),SY(clamp(beamC(r)-beamHW(r),0,50000))); g.closePath(); g.fill();
    g.beginPath(); for(let r=0;r<=R;r+=R/40){ const y=SY(clamp(beamC(r),0,50000)); if(r) g.lineTo(SX(r),y); else g.moveTo(SX(r),y); } g.stroke(); }
  g.fillStyle='#2a2f2a'; g.fillRect(L0,yG,W-L0-R0,3); g.save(); g.translate(SX(0)+8,SY(S.fl)); drawJetSide(g,0.8); g.restore();
  g.font=`10px ${MONO}`; g.fillStyle=INK.dim; g.textAlign='right'; for(const a of [10000,30000,50000]) g.fillText('FL'+a/100,L0-4,SY(a)+3); g.textAlign='left';
  txt(g,L(t2('side view along the track','sett fra siden langs kursen')),L0+4,T0+12,INK.mute,'left',9.5);
  /* navigation display (rest) */
  const top=yG+(n?24:28), ox=W/2, oy=H-14, rad=Math.min(oy-top,(W/2-14)/Math.sin(60*Math.PI/180)); const P=(bd,r)=>[ox+r/R*rad*Math.sin(bd*Math.PI/180),oy-r/R*rad*Math.cos(bd*Math.PI/180)];
  g.fillStyle='#05090C'; g.beginPath(); g.moveTo(ox,oy); g.arc(ox,oy,rad,-Math.PI/2-Math.PI/3,-Math.PI/2+Math.PI/3); g.closePath(); g.fill();
  const dr=R/NRr;
  for(let b=0;b<NB;b++){ const a0=(-60+b-0.5-90)*Math.PI/180, a1=(-60+b+0.5-90)*Math.PI/180;
    for(let k=0;k<NRr;k++){ const o=b*NRr+k; let col=zcol(PPI[o],0.92); if(!col&&GND[o]===2) col='rgba(190,150,70,.55)'; if(!col) continue;
      const r0=k*dr/R*rad, r1=(k+1)*dr/R*rad; g.fillStyle=col; g.beginPath(); g.arc(ox,oy,r1,a0,a1); g.arc(ox,oy,r0,a1,a0,true); g.closePath(); g.fill(); } }
  if(S.show.truth){ g.setLineDash([3,3]); g.strokeStyle='rgba(238,243,247,.7)'; g.lineWidth=1.1; for(const c of RC){ if(c.r>R) continue; const [x,y]=P(c.b,c.r); g.beginPath(); g.arc(x,y,c.rc*1.4/R*rad,0,Math.PI*2); g.stroke(); txt(g,c.id+' · '+c.pk+' dBZ · '+L(t2('top','topp'))+' FL'+c.top/100,x+c.rc*1.4/R*rad+4,y+4,INK.white,'left',9.5); } g.setLineDash([]); }
  else for(const c of RC){ if(c.r>R) continue; const [x,y]=P(c.b,c.r); txt(g,c.id,x+c.rc*1.3/R*rad+4,y-4,INK.mute,'left',10,600); }
  g.strokeStyle='rgba(200,215,225,.35)'; g.lineWidth=1; for(let q=1;q<=4;q++){ g.beginPath(); g.arc(ox,oy,rad*q/4,-Math.PI/2-Math.PI/3,-Math.PI/2+Math.PI/3); g.stroke(); const [x,y]=P(-58,R*q/4); txt(g,String(R*q/4),x-4,y,INK.mute,'right',9.5); }
  g.fillStyle=INK.white; g.beginPath(); g.moveTo(ox,oy-8); g.lineTo(ox-6,oy+4); g.lineTo(ox+6,oy+4); g.closePath(); g.fill();
  txt(g,(S.tilt>0?'+':S.tilt<0?'−':'')+nf(Math.abs(S.tilt),2)+'° · '+L({min:t2('gain MIN','gain MIN'),cal:t2('gain CAL','gain CAL'),max:t2('gain MAX','gain MAX')}[S.gain]),W-R0-4,oy,INK.cyan,'right',10);
  /* readouts */
  const A=RC[0], B=RC[1], Cc=RC[2]; RO2.hA=beamC(A.r); RO2.wA=2*beamHW(A.r); RO2.a=cellOnDisplay(A); RO2.b=cellOnDisplay(B); RO2.c=cellOnDisplay(Cc); RO2.gnd=false; for(let k=0;k<NRr;k++) if(GND[60*NRr+k]===2){ RO2.gnd=true; RO2.gr=(k+0.5)*dr; break; } }

/* =============== the shared viewport: views, controls, loop =============== */
let lastSeed='';
function rebuild(){ if(!C.w) return; const W=C.w,H=C.h,dpr=C.dpr; stat.width=Math.round(W*dpr); stat.height=Math.round(H*dpr); sg.setTransform(dpr,0,0,dpr,0,0);
  if(S.view==='life') drawLife(sg); else if(S.view==='mb') drawMB(sg); else drawWX(sg);
  readout(); dirty=true; }
let tNow=0, dirty=true;
function frame(){ if(!C.w) return; const g=C.ctx; g.setTransform(1,0,0,1,0,0); g.drawImage(stat,0,0); g.setTransform(C.dpr,0,0,C.dpr,0,0);
  if(S.view==='life') frameLife(g,tNow); else if(S.view==='mb') frameMB(g); }
const VIEWS=[['life',t2('Life of a CB','Livet til en CB')],['mb',t2('Microburst on final','Mikroburst på finalen')],['wx',t2('Weather radar','Værradar')]];
function drawTabs(){ el('vtabs').innerHTML=VIEWS.map(([k,t])=>`<button type="button" role="tab" data-v="${k}" class="${k===S.view?'on':''}" aria-selected="${k===S.view}">${L(t)}</button>`).join('');
  const lab=S.view==='life'?(S.play?'■ '+L(t2('Stop','Stopp')):'▶ '+L(t2('Play 60 min','Spill av 60 min'))):S.view==='mb'?(S.fly?'■ '+L(t2('Stop','Stopp')):'▶ '+L(t2('Fly the approach','Fly innflygingen'))):'';
  el('vtools').innerHTML=lab?`<button type="button" id="goB" class="${S.play||S.fly?'on':'go'}" aria-pressed="${S.play||S.fly}">${lab}</button>`:''; }
function setView(v){ S.view=v; S.play=false; S.fly=false; el('xpanel').querySelectorAll('[data-pv]').forEach(d=>{ d.hidden=d.dataset.pv!==v; }); drawTabs(); drawTogs(); legend(); rebuild(); see(); }
el('vtabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setView(b.dataset.v); });
el('vtools').addEventListener('click',e=>{ if(!e.target.closest('#goB')) return; if(S.view==='life'){ S.play=!S.play; if(S.play&&S.t>=60){ S.t=0; slT.set(0); rebuild(); } } else if(S.view==='mb'){ S.fly=!S.fly; if(S.fly&&S.k>=SIM.n-1) S.k=0; } drawTabs(); });
LAB.add({},{'Single cell':'Enkeltcelle','Multicell':'Multicelle','Squall line':'Bygelinje','Embedded':'Innleiret','No reaction':'Ingen reaksjon','Recovery at warning':'Gjenoppretting ved varsel','Go-around at first sign':'Go-around ved første tegn',
 'Time (min)':'Tid (min)','Moisture: dew point':'Fuktighet: duggpunkt','Instability: lapse rate':'Ustabilitet: temperaturfall','Lift (trigger)':'Løft (utløser)','Outflow: headwind to tailwind change':'Utstrømming: endring fra motvind til medvind',
 'Flight level':'Flygenivå','Antenna tilt':'Antennetilt','Microburst position (NM to threshold)':'Mikroburstens posisjon (NM til terskel)','Downdraft core radius (NM)':'Radius på nedvindskjernen (NM)','Approach speed Vapp (kt)':'Innflygingsfart Vapp (kt)','MIN':'MIN','CAL':'CAL','MAX':'MAX'});
const segT=LAB.seg(el('sType'),[['single','Single cell'],['multi','Multicell'],['squall','Squall line'],['emb','Embedded']],S.type,v=>{ S.type=v; changed(); });
const slT=LAB.slider(el('lifeCtl'),{label:'Time (min)',min:0,max:60,step:1,v:S.t,f:v=>v+' min',on:v=>{ S.t=v; S.play=false; drawTabs(); changed(true); }});
const slM=LAB.slider(el('lifeCtl'),{label:'Moisture: dew point',min:0,max:1,step:0.05,v:S.m,f:v=>nf(4+16*v,0)+' °C (T 25 °C)',on:v=>{ S.m=v; changed(); }});
const slI=LAB.slider(el('lifeCtl'),{label:'Instability: lapse rate',min:0,max:1,step:0.05,v:S.i,f:v=>nf(1.2+1.8*v,1)+' °C/1000 ft',on:v=>{ S.i=v; changed(); }});
const slL=LAB.slider(el('lifeCtl'),{label:'Lift (trigger)',min:0,max:1,step:0.05,v:S.l,f:v=>v<0.2?L(t2('none','ingen')):v<0.5?L(t2('weak','svakt')):L(t2('strong','sterkt')),on:v=>{ S.l=v; changed(); }});
const segP=LAB.seg(el('sPil'),[['none','No reaction'],['rec','Recovery at warning'],['early','Go-around at first sign']],S.pil,v=>{ S.pil=v; S.k=0; changed(); });
const slDV=LAB.slider(el('mbCtl'),{label:'Outflow: headwind to tailwind change',min:20,max:80,step:5,v:S.dv,f:v=>v+' kt',on:v=>{ S.dv=v; S.k=0; changed(); }});
const segR=LAB.seg(el('sRng'),[['40','40 NM'],['80','80 NM'],['160','160 NM']],String(S.rng),v=>{ S.rng=+v; changed(); });
const segG=LAB.seg(el('sGain'),[['min','MIN'],['cal','CAL'],['max','MAX']],S.gain,v=>{ S.gain=v; changed(); });
const slFL=LAB.slider(el('wxCtl'),{label:'Flight level',min:10000,max:39000,step:1000,v:S.fl,f:v=>'FL'+v/100,on:v=>{ S.fl=v; changed(); }});
const slTi=LAB.slider(el('wxCtl'),{label:'Antenna tilt',min:-6,max:6,step:0.25,v:S.tilt,f:v=>(v>0?'+':v<0?'−':'')+nf(Math.abs(v),2)+'°',on:v=>{ S.tilt=v; changed(); }});
const slXC=LAB.slider(el('adv'),{label:'Microburst position (NM to threshold)',min:1.5,max:4.5,step:0.1,v:S.xc,f:v=>nf(v,1)+' NM',on:v=>{ S.xc=v; S.k=0; changed(); }});
const slR=LAB.slider(el('adv'),{label:'Downdraft core radius (NM)',min:0.5,max:1.2,step:0.05,v:S.R,f:v=>nf(v,2)+' NM',on:v=>{ S.R=v; S.k=0; changed(); }});
const slVa=LAB.slider(el('adv'),{label:'Approach speed Vapp (kt)',min:110,max:160,step:5,v:S.vapp,f:v=>v+' kt',on:v=>{ S.vapp=v; S.k=0; changed(); }});
const TOGS=[['air',t2('Air motion','Luftbevegelse'),'life'],['haz',t2('Hazard zones','Faresoner'),'life'],['iso',t2('Isotherms','Isotermer'),'life'],['avoid',t2('Avoidance distances','Avstand å holde'),'life'],['air',t2('Wind arrows','Vindpiler'),'mb'],['beam',t2('Radar beam','Radarstrålen'),'wx'],['truth',t2('What is really there','Hva som faktisk er der'),'wx']];
function drawTogs(){ el('togs').innerHTML=TOGS.filter(t=>t[2]===S.view).map(([k,t])=>`<button type="button" class="xtog${S.show[k]?' on':''}" data-k="${k}" aria-pressed="${!!S.show[k]}">${L(t)}</button>`).join(''); }
el('togs').addEventListener('click',e=>{ const b=e.target.closest('[data-k]'); if(!b) return; S.show[b.dataset.k]=!S.show[b.dataset.k]; drawTogs(); legend(); rebuild(); });
const PRE=[['mat',t2('Mature single cell','Moden enkeltcelle'),{view:'life',type:'single',t:25,m:0.8,i:0.8,l:0.7}],
 ['nolift',t2('Moist and unstable, no lift','Fuktig og ustabil, uten løft'),{view:'life',type:'single',t:25,m:0.8,i:0.8,l:0.1}],
 ['squall',t2('Squall line','Bygelinje'),{view:'life',type:'squall',m:0.85,i:0.85,l:0.8}],
 ['emb',t2('Embedded CB','Innleiret CB'),{view:'life',type:'emb',t:25,m:0.8,i:0.7,l:0.7}],
 ['mbn',t2('Microburst: no reaction','Mikroburst: ingen reaksjon'),{view:'mb',pil:'none',dv:50,fly:true}],
 ['mbe',t2('Microburst: go around early','Mikroburst: tidlig go-around'),{view:'mb',pil:'early',dv:50,fly:true}],
 ['over',t2('Radar: beam over the core','Radar: strålen over kjernen'),{view:'wx',fl:37000,tilt:1.5,gain:'cal',rng:80}],
 ['shadow',t2('Radar: attenuation shadow','Radar: dempingsskygge'),{view:'wx',fl:15000,tilt:-1,gain:'cal',rng:80}]];
let cur=null;
function drawPre(){ el('pre').innerHTML=PRE.map(([k,t])=>`<button class="btn sm${k===cur?' on':''}" type="button" data-k="${k}">${L(t)}</button>`).join(''); }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const p=PRE.find(x=>x[0]===b.dataset.k); if(p) setS(p[2],p[0]); });
function setS(o,k){ const fly=o.fly; Object.assign(S,o); S.fly=false; S.play=false; S.k=0; cur=k||null;
  segT.set(S.type); slT.set(S.t); slM.set(S.m); slI.set(S.i); slL.set(S.l); segP.set(S.pil); slDV.set(S.dv); segR.set(String(S.rng)); segG.set(S.gain); slFL.set(S.fl); slTi.set(S.tilt);
  drawPre(); setView(S.view); if(fly){ S.fly=true; drawTabs(); } }
function changed(keep){ if(!keep){ cur=null; drawPre(); } el('lifeCtl').querySelector('.ctl').hidden=S.type==='squall'; rebuild(); if(S.view==='life'&&!keep) seedLife(); live(); }
/* readouts */
const fl=v=>v>=10000?'FL'+Math.round(v/100):nf(v,0)+' ft';
function readout(){ let h='';
  if(S.view==='life'){ const c=CELLS.find(c=>c.st==='mat')||CELLS.find(c=>c.st!=='none')||CELLS[0]; const hz=[];
    if(ENV.cb&&c&&c.st!=='cu'&&c.st!=='none'){ hz.push(L(t2('turbulence','turbulens')),L(t2('icing','ising'))); if(c.hail) hz.push(L(t2('hail','hagl'))); if(c.ltg) hz.push(L(t2('lightning','lyn'))); if(c.mb) hz.push(L(t2('microburst','mikroburst'))); }
    const miss=ENV.why==='lift'?t2('no lift','ikke løft'):ENV.why==='moist'?t2('too dry','for tørt'):ENV.why==='stab'?t2('too stable','for stabilt'):null;
    h=`<span><i>${L(t2('STAGE','STADIUM'))}</i><b class="${c&&c.st==='mat'?'r':''}">${S.type==='squall'?L(t2('mature line','moden linje')):L(STAGE[c?c.st:'none'])}</b></span><span><i>${L(t2('TOPS','TOPPER'))}</i><b>${c&&c.st!=='none'?fl(c.top):'–'}</b></span><span class="hx"><i>${L(t2('BASE','BASE'))}</i><b>${nf(ENV.base,0)} ft</b></span><span><i>${L(t2('UPDRAFT','OPPVIND'))}</i><b>${c&&c.up?'≈'+nf(c.up,0)+' ft/min':'–'}</b></span><span><i>CB?</i><b class="${ENV.cb?'r':'g'}">${ENV.cb?L(t2('yes','ja')):L(t2('no','nei'))+' · '+L(miss)}</b></span>${hz.length?`<span><i>${L(t2('HAZARDS','FARER'))}</i><b class="a">${hz.join(' · ')}</b></span>`:''}`;
    el('xsv').textContent=L(STAGE[c?c.st:'none'])+' · '+S.t+' min'; }
  else if(S.view==='mb'){ const i=clamp(Math.floor(S.k),0,Math.max(0,SIM.n-1)); const dV=sV[i]-S.vapp, dev=sH[i]-gsH(Math.max(0,sD[i])); const st=SIM.gnd>=0&&i>=SIM.gnd-1?t2('ground contact','bakkekontakt'):sF[i]?t2('recovery: max thrust, pitch up','gjenoppretting: maks skyv, nesen opp'):SIM.shaker>=0&&i>=SIM.shaker&&sV[i]<S.vapp-20?t2('stick shaker','stikkerister'):t2('on approach','på innflyging');
    h=`<span><i>IAS</i><b class="${dV<-10?'r':dV>10?'a':''}">${nf(sV[i],0)} kt (${dV>=0?'+':'−'}${nf(Math.abs(dV),0)})</b></span><span><i>${L(t2('HEADWIND','MOTVIND'))}</i><b>${sHW[i]>=0?'+':'−'}${nf(Math.abs(sHW[i]),0)} kt</b></span><span><i>${L(t2('VERTICAL WIND','VERTIKALVIND'))}</i><b class="${sW[i]<-1000?'r':''}">${nf(sW[i],0)} ft/min</b></span><span><i>${L(t2('VS GLIDE PATH','MOT GLIDEBANEN'))}</i><b class="${dev<-150?'r':''}">${dev>=0?'+':'−'}${nf(Math.abs(dev),0)} ft</b></span><span><i>${L(t2('STATUS','STATUS'))}</i><b class="${SIM.gnd>=0&&i>=SIM.gnd-1?'r':sF[i]?'a':''}">${L(st)}</b></span>`;
    el('xsv').textContent=L(t2('Microburst','Mikroburst'))+' · '+S.dv+' kt'; }
  else { const cn=z=>z<20?L(t2('not shown','vises ikke')):L(ZN(z));
    h=`<span><i>${L(t2('BEAM CENTRE AT A','STRÅLESENTER VED A'))}</i><b>${fl(Math.max(0,RO2.hA))}</b></span><span class="hx"><i>${L(t2('BEAM COVERS AT A','STRÅLEN DEKKER VED A'))}</i><b>${nf(RO2.wA,0)} ft</b></span><span><i>A</i><b>${cn(RO2.a)}</b></span><span><i>B (${L(t2('behind A','bak A'))})</i><b class="${RO2.b<20?'a':''}">${cn(RO2.b)}</b></span><span><i>C</i><b>${cn(RO2.c)}</b></span><span class="hx"><i>${L(t2('GROUND','BAKKE'))}</i><b>${RO2.gnd?L(t2('from','fra'))+' '+nf(RO2.gr,0)+' NM':L(t2('none','ingen'))}</b></span>`;
    el('xsv').textContent='FL'+S.fl/100+' · '+L(t2('tilt','tilt'))+' '+nf(S.tilt,2)+'°'; }
  el('chip').innerHTML=h; see(); live(); }
function legend(){ const lg=(c,t,cls)=>`<span><i class="${cls||''}" style="--c:${c}"></i>${L(t)}</span>`;
  el('vleg').innerHTML=S.view==='life'?lg('#F0A050',t2('updraft','oppvind'))+lg('#6EB4F0',t2('downdraft','nedvind'))+lg('#8CBEEB',t2('rain','regn'))+lg('#F0F8FF',t2('hail','hagl'),'dot')+(S.show.haz?lg('#7FCBE8',t2('icing (0 to −20 °C)','ising (0 til −20 °C)'),'a')+lg('#F0B440',t2('severe turbulence','kraftig turbulens'),'d'):'')+(S.show.iso?lg('#CFEFFF',t2('isotherms','isotermer'),'d'):'')
   :S.view==='mb'?lg('#71CC93',t2('3° glide path','3° glidebane'),'d')+lg('#EEF3F7',t2('flown path','flydd bane'))+lg('#6EB4F0',t2('downdraft','nedvind'))+lg(INK.amber,t2('IAS − Vapp','IAS − Vapp'))+lg('#C9D2DA',t2('headwind component','motvindskomponent'),'d')
   :lg('rgb(46,160,90)',t2('green: light','grønn: lett'),'sq')+lg('rgb(232,200,60)',t2('yellow: moderate','gul: moderat'),'sq')+lg('rgb(226,58,46)',t2('red: heavy','rød: kraftig'),'sq')+lg('rgb(214,40,190)',t2('magenta: extreme','magenta: ekstrem'),'sq')+lg('rgb(190,150,70)',t2('ground returns','bakkeekko'),'sq')+(S.show.beam?lg(INK.mag,t2('beam','stråle'),'a'):''); }
function see(){ const s=S.view==='life'?t2('one storm in cross-section, about 120 km wide. Press Play to watch it grow, mature and die in an hour. Amber streaks rise, blue streaks sink; the hatched area inside the cloud is where supercooled water gives severe icing.','én storm i snitt, rundt 120 km bred. Trykk Spill av for å se den vokse, modnes og dø i løpet av en time. Oransje streker stiger, blå synker; det skraverte området i skyen er der underkjølt vann gir kraftig ising.')
   :S.view==='mb'?t2('the same storm’s downdraft hitting the ground on your final approach. The strip below shows your airspeed change (amber) against the headwind (dashed): first a gain, then a larger loss.','nedvinden fra den samme stormen treffer bakken på finalen din. Stripen under viser fartsendringen (oransje) mot motvinden (stiplet): først en økning, så et større tap.')
   :t2('the beam from your radar in a side view (top) and the picture on the navigation display (bottom). Change the tilt and see which part of each cell the beam actually hits.','strålen fra radaren sett fra siden (øverst) og bildet på navigasjonsskjermen (nederst). Endre tilten og se hvilken del av hver celle strålen faktisk treffer.');
  el('xsee').innerHTML='<b>'+L(t2('What you are seeing:','Dette ser du:'))+'</b> '+L(s); }
/* loop */
let vis=true, last=0, acc=0;
LAB.visible(el('stVp'),v=>{ vis=v; });
function loop(ts){ requestAnimationFrame(loop); const dt=Math.min(0.05,((ts||0)-last)/1000); last=ts||0; if(!vis||document.hidden) return;
  if(S.view==='life'){ if(S.play){ S.t=Math.min(60,S.t+dt*2.5); acc+=dt; if(acc>0.1){ acc=0; slT.set(Math.round(S.t)); drawLife(sg); readout(); } if(S.t>=60){ S.play=false; drawTabs(); } }
    if(!reduce||S.play){ tNow+=dt; stepLife(dt,tNow); dirty=true; } }
  else if(S.view==='mb'&&S.fly){ S.k+=dt*SIM.n/14; if(S.k>=SIM.n-1){ S.k=SIM.n-1; S.fly=false; drawTabs(); } acc+=dt; if(acc>0.08||!S.fly){ acc=0; readout(); } dirty=true; }
  if(dirty){ frame(); dirty=false; } }
requestAnimationFrame(loop);

/* =============== Try it =============== */
let active=null; const ans={}, touched={};
const go=()=>{ const t=el('stVp'); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'}); };
const TASKS=[
 {k:'lift',model:1,q:t2('Keep the air moist and unstable, but make sure no CB can form.','Hold luften fuktig og ustabil, men sørg for at ingen CB kan dannes.'),pre:{view:'life',type:'single',t:25,m:0.8,i:0.8,l:0.7},
  check:()=>{ if(S.view!=='life') return {ok:0,m:t2('Open the Life of a CB tab.','Åpne fanen Livet til en CB.')}; if(ENV.cb) return {ok:0,m:t2('The CB still forms. Which of the three ingredients is left to take away?','CB-en dannes fortsatt. Hvilken av de tre ingrediensene gjenstår å ta bort?')};
    if(ENV.why==='lift'&&S.m>=0.5&&S.i>=0.5) return {ok:1,m:t2('Yes: without lift (no heating, front, hills or convergence) moist, unstable air just sits there. All three are needed: moisture, instability and lift.','Ja: uten løft (ingen oppvarming, front, fjell eller konvergens) blir fuktig, ustabil luft bare liggende. Alle tre trengs: fuktighet, ustabilitet og løft.')};
    return {ok:0,m:t2('That stops it, but you changed the moisture or the instability. Keep both high and take away the third ingredient.','Det stopper den, men du endret fuktigheten eller ustabiliteten. Hold begge høye og ta bort den tredje ingrediensen.')}; }},
 {k:'stage',q:t2('Which stage has updrafts and downdrafts side by side, the first rain at the ground, hail and lightning?','Hvilket stadium har oppvind og nedvind side om side, det første regnet ved bakken, hagl og lyn?'),
  opts:[t2('Cumulus','Cumulus'),t2('Mature','Moden'),t2('Dissipating','Oppløsning'),t2('All three equally','Alle tre like mye')],c:1,
  e:t2('The mature stage starts when precipitation drags air down. Cumulus has updrafts only; in the dissipating stage downdrafts take over and the storm rains itself out.','Det modne stadiet starter når nedbøren drar luft ned. Cumulus har bare oppvind; i oppløsningsstadiet tar nedvinden over, og stormen regner seg ut.'),
  show:{view:'life',type:'single',t:25,m:0.8,i:0.8,l:0.7}},
 {k:'mb',q:t2('Short final near showers: IAS suddenly rises 15 kt and you float above the glide path. Best reaction?','Kort finale nær byger: IAS stiger plutselig 15 kt, og du flyter over glidebanen. Beste reaksjon?'),
  opts:[t2('Reduce thrust to get back to Vapp','Reduser skyvet for å komme tilbake til Vapp'),t2('Treat it as the first sign of a microburst and go around now','Behandle det som første tegn på en mikroburst og gå rundt nå'),t2('Continue: the extra headwind makes the landing easier','Fortsett: den ekstra motvinden gjør landingen lettere'),t2('Select more flap','Velg mer flaps')],c:1,
  e:t2('The headwind is the leading edge of the outflow. Next come the downdraft and the tailwind, and the loss is bigger than the gain. Reducing thrust now leaves you with even less energy. Follow your aircraft’s wind shear procedure.','Motvinden er forkanten av utstrømmingen. Så kommer nedvinden og medvinden, og tapet er større enn gevinsten. Reduserer du skyvet nå, har du enda mindre energi. Følg flyets prosedyre for vindskjær.'),
  show:{view:'mb',pil:'early',dv:50,fly:true}},
 {k:'tilt',model:1,q:t2('Radar at FL330: cell C, to the right, does not show. Find a tilt that paints it.','Radar i FL330: celle C, til høyre, vises ikke. Finn en tilt som får den fram.'),pre:{view:'wx',fl:33000,tilt:1,gain:'cal',rng:80},
  check:()=>{ if(S.view!=='wx') return {ok:0,m:t2('Open the Weather radar tab.','Åpne fanen Værradar.')}; if(RO2.c>=20) return {ok:1,m:t2(`Yes, at ${nf(S.tilt,2)}°: C is low-topped (FL220), so the beam passed over it. Tilt down until the lower edge of the beam reaches the wet part of the cell, and watch for ground returns.`,`Ja, ved ${nf(S.tilt,2)}°: C har lave topper (FL220), så strålen gikk over den. Tilt ned til strålens nedre kant når den våte delen av cellen, og se opp for bakkeekko.`)};
    return {ok:0,m:S.tilt>-0.5?t2('The beam is still above the top of C: tilt down.','Strålen er fortsatt over toppen av C: tilt ned.'):t2('Keep going: the beam must reach below FL200 at about 50 NM.','Fortsett: strålen må ned under FL200 rundt 50 NM.')}; }},
 {k:'shadow',q:t2('Behind a strong red cell the display is black. Most likely?','Bak en kraftig rød celle er skjermen svart. Mest sannsynlig?'),
  opts:[t2('Clear air: a good way through','Klar luft: en god vei gjennom'),t2('Attenuation: the beam cannot see behind the cell, and it may hide another one','Demping: strålen ser ikke bak cellen, og den kan skjule en annen'),t2('Ground returns','Bakkeekko'),t2('The gain is too high','Gain er for høy')],c:1,
  e:t2('Heavy rain absorbs the beam. Treat a black area right behind a strong cell as unknown, not as clear; turn on “What is really there” to see cell B.','Kraftig regn demper strålen. Behandle et svart område rett bak en kraftig celle som ukjent, ikke som klart; slå på «Hva som faktisk er der» for å se celle B.'),
  show:{view:'wx',fl:15000,tilt:-1,gain:'cal',rng:80}}];
function drawTasks(){ el('tasks').innerHTML=TASKS.map((t,i)=>`<li class="task" id="task-${t.k}"><span class="n">${L(t2('Task','Oppgave'))} ${i+1}</span><p class="q">${L(t.q)}</p>`+
   (t.model?`<div class="btns"><button type="button" class="btn pri sm" data-go="${t.k}">${L(t2('Do it in the model','Gjør det i modellen'))} ↑</button></div><span class="fb" id="fb-${t.k}"></span>`:'')+
   (t.opts?(()=>{ const a=ans[t.k]; return `<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-t="${t.k}" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${a!=null?'<b>'+L(a===t.c?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(t.e):''}</span><div class="btns"><button type="button" class="btn sm" data-show="${t.k}">${L(t2('Show it in the model','Vis i modellen'))} ↑</button></div>`; })():'')+`</li>`).join('');
  live(); drawTbox(); }
function drawTbox(){ const b=el('tbox'); if(!active){ b.hidden=true; return; } const i=TASKS.findIndex(t=>t.k===active);
  b.hidden=false; b.innerHTML=`<span class="k">${L(t2('Task','Oppgave'))} ${i+1}<button type="button" aria-label="${L(t2('Close the task','Lukk oppgaven'))}" id="tclose">×</button></span>${L(TASKS[i].q)}<span class="fb" id="tfb"></span>`;
  el('tclose').onclick=()=>{ active=null; drawTbox(); }; live(); }
function live(){ if(typeof TASKS==='undefined') return; TASKS.filter(t=>t.model&&touched[t.k]).forEach(t=>{ const r=t.check(), html=L(r.m); const f=el('fb-'+t.k); if(f&&f.innerHTML!==html){ f.innerHTML=html; f.classList.toggle('ok',!!r.ok); } if(active===t.k){ const g=el('tfb'); if(g&&g.innerHTML!==html){ g.innerHTML=html; g.classList.toggle('ok',!!r.ok); } } }); }
el('tasks').addEventListener('click',e=>{ const gb=e.target.closest('[data-go]'), o=e.target.closest('[data-o]'), sh=e.target.closest('[data-show]');
  if(gb){ const t=TASKS.find(x=>x.k===gb.dataset.go); active=t.k; touched[active]=1; if(t.pre) setS(t.pre); drawTbox(); go(); return; }
  if(o){ ans[o.dataset.t]=+o.dataset.o; drawTasks(); return; }
  if(sh){ const t=TASKS.find(x=>x.k===sh.dataset.show); active=null; drawTbox(); setS(t.show); go(); } });

/* =============== Understand: key concept cards =============== */
if(window.KCS){ const {sv,tx,ar}=KCS;
  const gnd='<line x1="6" y1="58" x2="194" y2="58" stroke="#55626e"/>';
  const cb=(x,s)=>`<path d="M${x-10*s},58 C${x-14*s},40 ${x-8*s},26 ${x-4*s},18 L${x-22*s},14 L${x+30*s},12 L${x+10*s},18 C${x+12*s},30 ${x+12*s},44 ${x+10*s},58 Z" fill="#cfd8df"/>`;
  const life=o=>({click:()=>setS(Object.assign({view:'life',type:'single',m:0.8,i:0.8,l:0.7},o)),to:'#stVp'});
  const KC=[
   Object.assign({k:'ing',t:t2('Conditions for a CB','Vilkår for en CB'),d:t2('Three ingredients: <b>moisture</b>, <b>instability</b> (a steep lapse rate through a deep layer) and <b>lift</b> to start it: heating, a front, hills or converging air. Take one away and no CB forms.','Tre ingredienser: <b>fuktighet</b>, <b>ustabilitet</b> (stort temperaturfall gjennom et tykt lag) og <b>løft</b> som setter det i gang: oppvarming, en front, fjell eller luft som strømmer sammen. Ta bort én, og ingen CB dannes.'),
    ill:()=>sv(`${gnd}${tx(40,22,L(t2('moisture','fukt')),'#7fcbe8','middle',9)}${tx(100,22,L(t2('instability','ustabil')),'#f0b440','middle',9)}${tx(160,22,L(t2('lift','løft')),'#71cc93','middle',9)}${ar(160,52,160,30,'#71cc93')}${tx(70,46,'+','#c9d2da','middle',12)}${tx(130,46,'+','#c9d2da','middle',12)}`)},life({t:25,l:0.1})),
   Object.assign({k:'lc',t:t2('Life cycle','Livssyklus'),d:t2('<b>Cumulus</b> (updrafts only), <b>mature</b> (updrafts and downdrafts, rain at the ground, hail, lightning) and <b>dissipating</b> (downdrafts only). Each stage lasts roughly 15–20 minutes.','<b>Cumulus</b> (bare oppvind), <b>moden</b> (oppvind og nedvind, regn ved bakken, hagl, lyn) og <b>oppløsning</b> (bare nedvind). Hvert stadium varer omtrent 15–20 minutter.'),
    ill:()=>sv(`${gnd}<path d="M24,58 C20,44 28,36 36,34 C44,36 50,44 46,58 Z" fill="#dfe6ec"/>${cb(100,1)}<path d="M156,58 C152,46 158,40 164,38 L150,20 L196,20 L172,38 C178,44 178,52 176,58 Z" fill="rgba(207,216,223,.5)"/>${tx(36,64,'Cu','#8b99a7','middle',8)}${tx(100,64,L(t2('mature','moden')),'#8b99a7','middle',8)}${tx(166,64,L(t2('dissipating','oppløsning')),'#8b99a7','middle',8)}`)},{click:()=>{ setS({view:'life',type:'single',t:0,m:0.8,i:0.8,l:0.7}); S.play=true; drawTabs(); },to:'#stVp'}),
   Object.assign({k:'ud',t:t2('Updraft and downdraft','Oppvind og nedvind'),d:t2('Updrafts can reach several thousand ft/min and carry you up whatever you do with the controls. Rain and evaporative cooling drive the downdraft, which hits the ground and spreads out.','Oppvind kan nå flere tusen ft/min og løfte deg uansett hva du gjør med rorene. Regn og fordampingskjøling driver nedvinden, som treffer bakken og sprer seg utover.'),
    ill:()=>sv(`${gnd}${cb(100,1.3)}${ar(112,54,112,20,'#F0A050')}${ar(88,22,88,54,'#6EB4F0')}${tx(124,40,'↑','#F0A050','start',9)}`)},life({t:25})),
   Object.assign({k:'hail',t:t2('Hail','Hagl'),d:t2('Ice grows while strong updrafts keep it aloft above the freezing level. It falls in and near the core, but can also be thrown out under the anvil, in clear air miles from the cell.','Is vokser mens sterk oppvind holder den oppe over frysenivået. Den faller i og nær kjernen, men kan også kastes ut under ambolten, i klar luft flere mil fra cellen.'),
    ill:()=>sv(`${gnd}${cb(80,1.3)}<circle cx="130" cy="30" r="2.5" fill="#f0f8ff"/><circle cx="140" cy="40" r="2.5" fill="#f0f8ff"/><circle cx="150" cy="50" r="2.5" fill="#f0f8ff"/>${tx(160,30,L(t2('under anvil','under ambolt')),'#e46bae','start',8)}`)},{click:()=>{ setS({view:'life',type:'single',t:28,m:0.8,i:0.85,l:0.7}); S.show.avoid=true; drawTogs(); rebuild(); },to:'#stVp'}),
   Object.assign({k:'ltg',t:t2('Lightning','Lyn'),d:t2('Most strikes on aircraft happen within about 5000 ft of the freezing level, in or near the cloud, often in precipitation. Usually little damage, but it can affect avionics and dazzle the crew.','De fleste lynnedslag i fly skjer innenfor rundt 5000 ft fra frysenivået, i eller nær skyen, ofte i nedbør. Som regel lite skade, men det kan påvirke avionikk og blende besetningen.'),
    ill:()=>sv(`${gnd}${cb(90,1.3)}<path d="M96,30 L88,42 L96,42 L86,58" stroke="#fffad2" stroke-width="1.8" fill="none"/>`)},life({t:24})),
   Object.assign({k:'gf',t:t2('Gust front','Vindkastfront'),d:t2('The outflow from the downdraft runs ahead of the storm as a gust front: sudden wind shift, strong gusts and turbulence, sometimes 15–20 NM ahead of the rain.','Utstrømmingen fra nedvinden løper foran stormen som en vindkastfront: brå vinddreining, sterke kast og turbulens, noen ganger 15–20 NM foran regnet.'),
    ill:()=>sv(`${gnd}${cb(60,1.3)}${ar(70,54,180,54,'#eef3f7',2)}${tx(176,46,L(t2('gust front','vindkastfront')),'#eef3f7','end',9)}`)},life({t:30})),
   Object.assign({k:'mb',t:t2('Microburst','Mikroburst'),d:t2('A small, intense downdraft, less than about 4 km (2 NM) across, lasting 5–15 minutes, with outflow winds that can change by 50 kt or more across the approach path.','En liten, kraftig nedvind, mindre enn rundt 4 km (2 NM) på tvers, som varer 5–15 minutter, med utstrømmingsvind som kan endre seg med 50 kt eller mer langs innflygingen.'),
    ill:()=>sv(`${gnd}<rect x="70" y="4" width="60" height="10" rx="4" fill="#5a6774"/>${ar(100,16,100,48,'#6EB4F0',2.2)}${ar(100,54,60,54,'#eef3f7')}${ar(100,54,140,54,'#eef3f7')}`)},{click:()=>setS({view:'mb',pil:'none',dv:50,fly:true}),to:'#stVp'}),
   Object.assign({k:'ws',t:t2('Wind shear on final','Vindskjær på finalen'),d:t2('A sudden headwind raises the IAS and lifts you above the path; a tailwind or downdraft does the opposite. In a microburst the gain comes first and the bigger loss follows.','En plutselig motvind øker IAS og løfter deg over banen; medvind eller nedvind gjør det motsatte. I en mikroburst kommer gevinsten først, og det større tapet etter.'),
    ill:()=>sv(`<line x1="10" y1="32" x2="190" y2="32" stroke="#55626e" stroke-dasharray="3 3"/><path d="M10,32 C50,32 60,14 80,14 C100,14 110,58 140,58 C160,58 170,40 190,40" stroke="#F0B440" stroke-width="2" fill="none"/>${tx(80,10,'+IAS','#F0B440','middle',9)}${tx(140,52,'−IAS','#EC5A47','middle',9)}`)},{click:()=>setS({view:'mb',pil:'none',dv:60,fly:true}),to:'#stVp'}),
   Object.assign({k:'ty',t:t2('Single cell to squall line','Enkeltcelle til bygelinje'),d:t2('A <b>single cell</b> lives about an hour. <b>Multicells</b> keep forming new cells on the gust front. A <b>squall line</b> is a long line of cells, often ahead of a cold front. An <b>embedded CB</b> is hidden in layer cloud.','En <b>enkeltcelle</b> lever omtrent en time. <b>Multiceller</b> danner stadig nye celler på vindkastfronten. En <b>bygelinje</b> er en lang rekke celler, ofte foran en kaldfront. En <b>innleiret CB</b> er skjult i lagskyer.'),
    ill:()=>sv(`${gnd}${cb(40,0.8)}${cb(70,1)}${cb(104,0.7)}<rect x="130" y="26" width="64" height="26" fill="#9fadb9"/><path d="M162,52 L162,18" stroke="#ffd7a0" stroke-dasharray="2 2"/>${tx(162,16,'EMBD','#ffd7a0','middle',8)}`)},{click:()=>setS({view:'life',type:'multi',t:10,m:0.8,i:0.8,l:0.7}),to:'#stVp'}),
   Object.assign({k:'wx',t:t2('Weather radar','Værradar'),d:t2('The radar sees precipitation, not turbulence. Wet cores below the freezing level reflect most, so <b>tilt</b> down to scan them; use <b>gain</b> CAL to judge intensity; strong rain <b>attenuates</b> the beam and hides what is behind.','Radaren ser nedbør, ikke turbulens. Våte kjerner under frysenivået reflekterer mest, så <b>tilt</b> ned for å treffe dem; bruk <b>gain</b> CAL for å vurdere styrken; kraftig regn <b>demper</b> strålen og skjuler det som er bak.'),
    ill:()=>sv(`<path d="M100,60 L40,6 A80,80 0 0 1 160,6 Z" fill="#05090c" stroke="#33414d"/><circle cx="92" cy="30" r="7" fill="#e23a2e"/><circle cx="92" cy="30" r="3" fill="#d628be"/><circle cx="118" cy="40" r="5" fill="#e8c83c"/><circle cx="118" cy="40" r="2" fill="#e23a2e"/><path d="M92,22 L86,6 L98,6 Z" fill="rgba(0,0,0,.6)"/>`)},{click:()=>setS({view:'wx',fl:15000,tilt:-1,gain:'cal',rng:80}),to:'#stVp'}),
   Object.assign({k:'av',t:t2('Avoidance distances','Avstand å holde'),d:t2('Common guidance: at least 10 NM from any thunderstorm and 20 NM from severe or large cells, more on the downwind (anvil) side. Do not fly under the anvil. Your operator’s procedures decide.','Vanlig veiledning: minst 10 NM fra ethvert tordenvær og 20 NM fra kraftige eller store celler, mer på le-siden (amboltsiden). Ikke fly under ambolten. Operatørens prosedyrer gjelder.'),
    ill:()=>sv(`${gnd}${cb(100,1.2)}<path d="M64,6 L64,58 M136,6 L136,58" stroke="#e46bae" stroke-dasharray="3 3"/><path d="M40,6 L40,58 M160,6 L160,58" stroke="#e46bae" stroke-dasharray="1 3"/>${tx(64,64,'10','#e46bae','middle',8)}${tx(40,64,'20 NM','#e46bae','middle',8)}`)},{click:()=>{ setS({view:'life',type:'single',t:25,m:0.8,i:0.8,l:0.7}); S.show.avoid=true; drawTogs(); rebuild(); },to:'#stVp'})];
  KCS.render(el('kcGrid'),KC);
}

/* =============== text =============== */
on(()=>{
  el('xLead').innerHTML=L(t2('One storm, three views. <b>Life of a CB</b>: grow it, watch the air move and see where the hazards are. <b>Microburst on final</b>: fly an approach through its downdraft. <b>Weather radar</b>: find it with the beam, and see what the picture leaves out.','Én storm, tre visninger. <b>Livet til en CB</b>: la den vokse, se luften bevege seg og hvor farene er. <b>Mikroburst på finalen</b>: fly en innflyging gjennom nedvinden. <b>Værradar</b>: finn den med strålen, og se hva bildet utelater.'));
  el('tryLead').innerHTML=L(t2('Five short tasks. Two you do in the model, with live feedback; three you answer here and then see in the model.','Fem korte oppgaver. To gjør du i modellen, med fortløpende tilbakemelding; tre svarer du på her og ser så i modellen.'));
  el('tyH').textContent=L(t2('Storm types','Stormtyper'));
  const TY=[[t2('Single cell (air mass)','Enkeltcelle (luftmasse)'),t2('One cell from local heating, often on summer afternoons','Én celle fra lokal oppvarming, ofte sommerettermiddager'),t2('About 1 hour','Omtrent 1 time'),t2('Visible, isolated, easy to go round in VMC','Synlig, isolert, lett å gå rundt i VMC')],
    [t2('Multicell','Multicelle'),t2('A cluster: new cells keep forming on the gust front of the old ones','En klynge: nye celler dannes stadig på vindkastfronten til de gamle'),t2('Several hours','Flere timer'),t2('Cells at all stages side by side; the cluster drifts and regenerates','Celler i alle stadier side om side; klyngen driver og fornyer seg')],
    [t2('Squall line','Bygelinje'),t2('A line of cells, often 50–100 NM ahead of or along a cold front','En linje av celler, ofte 50–100 NM foran eller langs en kaldfront'),t2('Several hours','Flere timer'),t2('Hard to go round; strong gust front and shelf cloud; look for a real gap on the radar','Vanskelig å gå rundt; kraftig vindkastfront og hyllesky; se etter en reell åpning på radaren')],
    [t2('Supercell','Superscelle'),t2('One large rotating cell with a very strong, long-lived updraft','Én stor roterende celle med svært sterk og langvarig oppvind'),t2('Hours','Timer'),t2('Large hail, tornadoes, extreme turbulence: stay well clear','Store hagl, tornadoer, ekstrem turbulens: hold god avstand')],
    [t2('Embedded CB','Innleiret CB'),t2('A CB hidden in layer cloud, typical in occlusions and warm fronts','En CB skjult i lagskyer, typisk i okklusjoner og varmfronter'),t2('Varies','Varierer'),t2('You cannot see it: use the radar, SIGMET (EMBD TS) and lightning data','Du ser den ikke: bruk radar, SIGMET (EMBD TS) og lyndata')]];
  el('tyTab').innerHTML=`<tr><th>${L(t2('Type','Type'))}</th><th>${L(t2('What it is','Hva det er'))}</th><th>${L(t2('Lives','Lever'))}</th><th>${L(t2('For the pilot','For piloten'))}</th></tr>`+TY.map(r=>`<tr><td><b>${L(r[0])}</b></td>${r.slice(1).map(c=>`<td>${L(c)}</td>`).join('')}</tr>`).join('');
  const BG=[t2('<b>Warnings.</b> METAR and TAF: TS, +TSRA, TSGR (hail), CB and TCU in the cloud group. SIGMET: OBSC TS (obscured by haze or cloud), EMBD TS (embedded in layer cloud), FRQ TS (frequent, little or no gap), SQL TS (squall line), with GR for hail. Lightning detection data show active cells even where radar cover is poor.','<b>Varsler.</b> METAR og TAF: TS, +TSRA, TSGR (hagl), CB og TCU i skygruppen. SIGMET: OBSC TS (skjult av dis eller skyer), EMBD TS (innleiret i lagskyer), FRQ TS (hyppige, liten eller ingen åpning), SQL TS (bygelinje), med GR for hagl. Lyndata viser aktive celler også der radardekningen er dårlig.'),
    t2('<b>If you are caught in one.</b> As a general principle: fly the aircraft’s turbulence speed, hold the attitude and wings level, accept altitude and airspeed excursions rather than chase them, do not turn back in a steep turn, and use the procedures in your aircraft’s manual (ignition, anti-ice, cockpit lights full bright against lightning).','<b>Hvis du blir fanget i ett.</b> Som et generelt prinsipp: fly flyets turbulensfart, hold attituden og vingene vannrett, godta avvik i høyde og fart heller enn å jage dem, ikke snu i en bratt sving, og bruk prosedyrene i flyets håndbok (tenning, avising, full cockpitbelysning mot lyn).'),
    t2('<b>Wind shear recovery.</b> The exact actions come from your aircraft’s procedure. The common principle: maximum thrust, pitch towards the guidance or just short of the stick shaker, keep the configuration until clear, and do not try to regain the lost speed by pitching down near the ground.','<b>Gjenoppretting etter vindskjær.</b> De eksakte handlingene kommer fra flyets prosedyre. Det felles prinsippet: maks skyv, nesen opp mot guidance eller like under stikkeristeren, behold konfigurasjonen til du er ute, og ikke prøv å hente igjen tapt fart ved å senke nesen nær bakken.'),
    t2('<b>Icing in a CB.</b> Strong updrafts carry large supercooled drops high: severe icing is possible from 0 °C up to −20 °C and supercooled water exists down to about −40 °C.','<b>Ising i en CB.</b> Sterk oppvind bærer store underkjølte dråper høyt: kraftig ising er mulig fra 0 °C opp til −20 °C, og underkjølt vann finnes ned til rundt −40 °C.')];
  el('bgBox').innerHTML=`<span class="k">${L(t2('Deep dive · warnings and procedures','Dypdykk · varsler og prosedyrer'))}</span>`+BG.map(p=>`<p>${L(p)}</p>`).join('');
  const TK=[t2('<b>Moisture, instability and lift.</b> A CB needs all three; the lift can be heating, a front, hills or converging air.','<b>Fuktighet, ustabilitet og løft.</b> En CB trenger alle tre; løftet kan være oppvarming, en front, fjell eller luft som strømmer sammen.'),
    t2('<b>Cumulus, mature, dissipating.</b> Updrafts only, then updrafts and downdrafts with rain at the ground, hail and lightning, then downdrafts only. A single cell lives about an hour; multicells and squall lines for hours.','<b>Cumulus, moden, oppløsning.</b> Bare oppvind, så oppvind og nedvind med regn ved bakken, hagl og lyn, så bare nedvind. En enkeltcelle lever omtrent en time; multiceller og bygelinjer i timevis.'),
    t2('<b>Everything at once.</b> Severe turbulence and icing, hail (also under the anvil), lightning, and a gust front that can reach 15–20 NM ahead of the rain.','<b>Alt på en gang.</b> Kraftig turbulens og ising, hagl (også under ambolten), lyn, og en vindkastfront som kan nå 15–20 NM foran regnet.'),
    t2('<b>Microburst: gain first, then the bigger loss.</b> Headwind (IAS up, above the path), then downdraft, then tailwind (IAS down, sinking). Go around early; if caught, fly your aircraft’s wind shear recovery.','<b>Mikroburst: gevinst først, så det større tapet.</b> Motvind (IAS opp, over banen), så nedvind, så medvind (IAS ned, synker). Gå rundt tidlig; blir du fanget, fly flyets prosedyre for vindskjær.'),
    t2('<b>Radar sees rain, not turbulence.</b> Tilt down to scan the wet core below the freezing level, judge intensity with gain CAL, and treat a black area behind a strong cell as unknown.','<b>Radaren ser regn, ikke turbulens.</b> Tilt ned for å treffe den våte kjernen under frysenivået, vurder styrken med gain CAL, og behandle et svart område bak en kraftig celle som ukjent.'),
    t2('<b>Keep your distance.</b> Common guidance is 10 NM, and 20 NM from severe cells, more on the anvil side; deviate upwind, never under the anvil. Your operator’s procedures decide.','<b>Hold avstand.</b> Vanlig veiledning er 10 NM, og 20 NM fra kraftige celler, mer på amboltsiden; avvik på lo-siden, aldri under ambolten. Operatørens prosedyrer gjelder.')];
  el('take').innerHTML=TK.map(x=>`<li>${L(x)}</li>`).join('');
  const m=el('maid'); m.querySelector('.eyebrow').textContent=L(t2('Memory aid','Huskeregel')); m.querySelector('h3').textContent=L(t2('A gain on final near a storm is a warning, not a gift','En fartsøkning på finalen nær en storm er en advarsel, ikke en gave'));
  m.querySelector('p').innerHTML=L(t2('The first sign of a microburst is a headwind: the IAS rises and the aircraft floats above the path. Seconds later the downdraft and the tailwind take it all back, and more. Go around while you still have the energy.','Første tegn på en mikroburst er motvind: IAS stiger, og flyet flyter over banen. Sekunder senere tar nedvinden og medvinden alt tilbake, og mer til. Gå rundt mens du fortsatt har energien.'));
  const EX=[t2('<b>Numbers.</b> Updrafts in a mature CB often 2000–6000 ft/min, more in severe storms; downdrafts and microbursts up to about 6000 ft/min. A microburst is under 4 km across and lasts 5–15 minutes.','<b>Tall.</b> Oppvind i en moden CB ofte 2000–6000 ft/min, mer i kraftige stormer; nedvind og mikroburster opptil rundt 6000 ft/min. En mikroburst er under 4 km på tvers og varer 5–15 minutter.'),
    t2('<b>Radar beam.</b> A 3.5° beam is about 1 NM tall at 15 NM and more than 3 NM tall at 50 NM, so a distant small cell fills only part of it and looks weaker. Ice reflects far less than water: the frozen upper part of a CB can look harmless.','<b>Radarstrålen.</b> En stråle på 3,5° er rundt 1 NM høy på 15 NM og over 3 NM høy på 50 NM, så en liten celle langt unna fyller bare en del av den og ser svakere ut. Is reflekterer mye mindre enn vann: den frosne øvre delen av en CB kan se ufarlig ut.'),
    t2('<b>Overflying.</b> Tops can grow thousands of feet per minute; climbing over a building cell often fails, and severe turbulence and hail extend above and around the visible top.','<b>Å fly over.</b> Topper kan vokse tusenvis av fot i minuttet; å stige over en voksende celle mislykkes ofte, og kraftig turbulens og hagl finnes over og rundt den synlige toppen.')];
  el('dbE').innerHTML=`<span class="k">${L(t2('Deep dive · what the examiner asks','Dypdykk · dette spør sensor om'))}</span>`+EX.map(p=>`<p>${L(p)}</p>`).join('');
  el('foot').innerHTML='<b>'+L(t2('Model and limitations.','Modell og begrensninger.'))+'</b> '+L(t2('Teaching models with simplified physics and typical textbook values. The storm is idealised (cloud base from the dew point spread, tops and updrafts from the instability, a fixed summer temperature profile); the air motion is a sketch of the circulation, not a simulation. The approach is a point-mass model of a generic jet at constant pitch attitude and thrust, or a generic recovery: it is not any aircraft’s procedure or performance. The radar is a simple beam model with typical colours. Real storms vary enormously: use the METAR, TAF, SIGMET and the radar together, keep the distances in your operator’s procedures, and follow your aircraft’s wind shear and turbulence procedures.','Opplæringsmodeller med forenklet fysikk og typiske lærebokverdier. Stormen er idealisert (skybase fra duggpunktsdifferansen, topper og oppvind fra ustabiliteten, en fast sommertemperaturprofil); luftbevegelsen er en skisse av sirkulasjonen, ikke en simulering. Innflygingen er en punktmassemodell av et generisk jetfly med konstant attitude og skyv, eller en generisk gjenoppretting: det er ikke prosedyren eller ytelsen til noe bestemt fly. Radaren er en enkel strålemodell med typiske farger. Virkelige stormer varierer enormt: bruk METAR, TAF, SIGMET og radaren sammen, hold avstandene i operatørens prosedyrer, og følg flyets prosedyrer for vindskjær og turbulens.'));
  drawTasks(); drawPre(); drawTabs(); drawTogs(); legend(); see();
});

/* =============== quiz =============== */
LAB.quiz(el('qbox'),'storms',()=>LAB.shuffle([
 {q:{en:'Which stage of a thunderstorm has both strong updrafts and downdrafts?',no:'Hvilket stadium av et tordenvær har både sterk oppvind og nedvind?'},a:[{en:'Mature',no:'Modent'},{en:'Cumulus',no:'Cumulus'},{en:'Dissipating',no:'Oppløsning'}],c:0,e:{en:'The mature stage starts when precipitation drags air down; it is also when the first rain reaches the ground.',no:'Det modne stadiet starter når nedbøren drar luft med seg ned; det er også da det første regnet når bakken.'}},
 {q:{en:'Why is flying under the anvil dangerous?',no:'Hvorfor er det farlig å fly under ambolten?'},a:[{en:'Hail can fall from it, far from the core',no:'Hagl kan falle fra den, langt fra kjernen'},{en:'It always contains a microburst',no:'Den inneholder alltid en mikroburst'},{en:'Radar shows it as red',no:'Radaren viser den som rød'}],c:0,e:{en:'Hail can be thrown out of the top of the cell and fall from the anvil in clear air; radar does not show the anvil well.',no:'Hagl kan kastes ut av toppen av cellen og falle fra ambolten i klar luft; radaren viser ikke ambolten godt.'}},
 {q:{en:'A common minimum distance from a severe thunderstorm echo is…',no:'En vanlig minsteavstand fra et kraftig tordenekko er …'},a:[{en:'20 NM',no:'20 NM'},{en:'2 NM',no:'2 NM'},{en:'5 NM',no:'5 NM'}],c:0,e:{en:'At least 10 NM from any thunderstorm, 20 NM from severe or fast-growing cells.',no:'Minst 10 NM fra ethvert tordenvær, 20 NM fra kraftige eller raskt voksende celler.'}},
 {q:{en:'What does EMBD TS in a SIGMET mean?',no:'Hva betyr EMBD TS i en SIGMET?'},a:[{en:'Thunderstorms hidden inside layer cloud',no:'Tordenvær skjult inne i lagskyer'},{en:'Thunderstorms ending soon',no:'Tordenvær som snart tar slutt'},{en:'Thunderstorms over the sea',no:'Tordenvær over havet'}],c:0,e:{en:'Embedded: you cannot see them, so without radar you cannot avoid them visually.',no:'Innebygd: du ser dem ikke, så uten radar kan du ikke unngå dem visuelt.'}},
 {q:{en:'You are caught in a thunderstorm in IMC. You should…',no:'Du blir fanget i et tordenvær i IMC. Du bør …'},a:[{en:'hold attitude and wings level, accept altitude changes',no:'holde attitude og vingene vannrett, godta høydeendringer'},{en:'hold altitude exactly with large pitch inputs',no:'holde høyden nøyaktig med store pitchendringer'},{en:'turn back immediately in a steep turn',no:'snu straks i en bratt sving'}],c:0,e:{en:'Chasing altitude in strong up- and downdrafts overstresses the aircraft and risks a stall.',no:'Å jage høyden i kraftig opp- og nedvind overbelaster flyet og kan gi stall.'}},
 {q:{en:'Which three ingredients does a thunderstorm need?',no:'Hvilke tre ingredienser trenger et tordenvær?'},a:[{en:'Instability, moisture and a lifting trigger',no:'Ustabilitet, fuktighet og noe som løfter'},{en:'High pressure, dry air and calm wind',no:'Høytrykk, tørr luft og vindstille'},{en:'An inversion, fog and drizzle',no:'En inversjon, tåke og yr'}],c:0,e:{en:'Deep unstable air, low-level moisture and a trigger such as heating, a front or hills.',no:'Dyp ustabil luft, fuktighet i lave lag og en utløser som oppvarming, en front eller åser.'}},
 {q:{en:'In the cruise at FL350 a cell 40 NM ahead shows only green. Why might it still be a strong storm?',no:'I cruise i FL350 viser en celle 40 NM foran bare grønt. Hvorfor kan det likevel være en kraftig storm?'},a:[{en:'The beam may be passing through the frozen upper part, which reflects weakly: tilt down',no:'Strålen kan gå gjennom den frosne øvre delen, som reflekterer svakt: tilt ned'},{en:'Green always means light rain at all levels',no:'Grønt betyr alltid lett regn i alle høyder'},{en:'The radar is only calibrated below FL250',no:'Radaren er bare kalibrert under FL250'}],c:0,e:{en:'Ice and dry hail reflect far less than liquid water. Scan the part of the cell below the freezing level before judging it.',no:'Is og tørt hagl reflekterer langt mindre enn flytende vann. Avsøk delen av cellen under frysenivået før du vurderer den.'}},
 {q:{en:'Behind a magenta core the display is black. The best interpretation is…',no:'Bak en magenta kjerne er skjermen svart. Den beste tolkningen er …'},a:[{en:'possibly a radar shadow: the area is unknown and may hide more cells',no:'mulig radarskygge: området er ukjent og kan skjule flere celler'},{en:'clear air: a good escape route',no:'klar luft: en god fluktvei'},{en:'ground returns',no:'bakkeekko'}],c:0,e:{en:'Heavy precipitation absorbs the radar energy (attenuation). Nothing comes back from behind it, whatever is there.',no:'Kraftig nedbør tar opp radarenergien (demping). Ingenting kommer tilbake bakfra, uansett hva som er der.'}},
 {q:{en:'Which gives the strongest radar echo?',no:'Hva gir det sterkeste radarekkoet?'},a:[{en:'Wet hail and heavy rain',no:'Vått hagl og kraftig regn'},{en:'Dry snow',no:'Tørr snø'},{en:'Ice crystals in an anvil',no:'Iskrystaller i en ambolt'}],c:0,e:{en:'Reflectivity grows with drop size and is much higher for liquid water than for ice.',no:'Reflektiviteten øker med dråpestørrelsen og er mye høyere for flytende vann enn for is.'}},
 {q:{en:'A radar beam about 3.5° wide is roughly how tall at 100 NM?',no:'En radarstråle rundt 3,5° bred er omtrent hvor høy på 100 NM?'},a:[{en:'About 18,000 ft',no:'Rundt 18 000 ft'},{en:'About 2,000 ft',no:'Rundt 2000 ft'},{en:'About 60,000 ft',no:'Rundt 60 000 ft'}],c:0,e:{en:'About 6,076 ft per NM × 100 × tan 3.5°. A small cell then fills only part of the beam and looks weaker than it is.',no:'Rundt 6076 ft per NM × 100 × tan 3,5°. En liten celle fyller da bare en del av strålen og ser svakere ut enn den er.'}},
 {q:{en:'You must deviate around a cell; the wind at your level is from the west. Which side do you prefer?',no:'Du må avvike rundt en celle; vinden i din høyde er fra vest. Hvilken side foretrekker du?'},a:[{en:'The west (upwind) side',no:'Vestsiden (lo-siden)'},{en:'The east (downwind) side',no:'Østsiden (le-siden)'},{en:'Either, the hazard is symmetrical',no:'Hvilken som helst, faren er symmetrisk'}],c:0,e:{en:'The anvil, hail and turbulence are carried downwind, so the upwind side is cleaner. Keep about 20 NM from strong echoes at cruise levels.',no:'Ambolten, hagl og turbulens føres med vinden, så lo-siden er renere. Hold rundt 20 NM fra kraftige ekko i marsjhøyde.'}},
 {q:{en:'Which of these does the weather radar not show?',no:'Hva av dette viser ikke værradaren?'},a:[{en:'Clear air turbulence',no:'Klarluftsturbulens'},{en:'Heavy rain',no:'Kraftig regn'},{en:'A wet hail core',no:'En kjerne av vått hagl'}],c:0,e:{en:'Radar needs precipitation to reflect from. CAT, the anvil and volcanic ash give little or no echo.',no:'Radaren trenger nedbør å reflektere fra. CAT, ambolten og vulkansk aske gir lite eller ingen ekko.'}},
 {q:t2('On approach you fly into the leading edge of a microburst. What do you first notice?','På innflyging flyr du inn i forkanten av en mikroburst. Hva merker du først?'),a:[t2('IAS increases and the aircraft goes above the glide path','IAS øker, og flyet går over glidebanen'),t2('IAS decreases and the aircraft sinks below the glide path','IAS minker, og flyet synker under glidebanen'),t2('No change until the downdraft','Ingen endring før nedvinden')],c:0,e:t2('The outflow first gives a headwind. The downdraft and the tailwind follow, and the loss is bigger than the gain.','Utstrømmingen gir først motvind. Nedvinden og medvinden følger, og tapet er større enn gevinsten.')},
 {q:t2('A typical microburst is…','En typisk mikroburst er …'),a:[t2('less than about 4 km across and lasts 5–15 minutes','mindre enn rundt 4 km på tvers og varer 5–15 minutter'),t2('about 40 km across and lasts several hours','rundt 40 km på tvers og varer flere timer'),t2('always visible as heavy rain','alltid synlig som kraftig regn')],c:0,e:t2('Small and short-lived, which is why it is hard to forecast. A dry microburst can come from virga with little rain at the ground.','Liten og kortvarig, og derfor vanskelig å varsle. En tørr mikroburst kan komme fra virga med lite regn ved bakken.')},
 {q:t2('Which stage of a thunderstorm has downdrafts only?','Hvilket stadium av et tordenvær har bare nedvind?'),a:[t2('Dissipating','Oppløsning'),t2('Mature','Moden'),t2('Cumulus','Cumulus')],c:0,e:t2('The downdraft spreads through the whole cell, cuts off the updraft and the storm rains itself out; the anvil often remains.','Nedvinden sprer seg gjennom hele cellen, kutter oppvinden, og stormen regner seg ut; ambolten blir ofte igjen.')}
]),8);

/* =============== static strings, start =============== */
LAB.add({},{'Thunderstorms and Wind Shear':'Tordenvær og vindskjær','Thunderstorms and wind shear':'Tordenvær og vindskjær','Birdbird Virtual Lab · Meteorology':'Birdbird Virtual Lab · Meteorologi',
 'Key concepts':'Nøkkelbegreper','The storm lab':'Stormlabben','Try it':'Prøv selv','Key points':'Det viktigste','Test yourself':'Test deg selv',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Test yourself':'3 · Test deg selv','Controls':'Kontroller','Conditions':'Forhold','Storm type':'Stormtype','Pilot':'Pilot','Range':'Rekkevidde','Gain':'Gain','Show':'Vis','Scenarios':'Scenarioer','Advanced':'Avansert',
 'Virtual Lab':'Virtual Lab','Sections':'Seksjoner','View':'Visning',
 'Thunderstorm model: the life of a cumulonimbus, an approach through a microburst, or the weather radar':'Tordenværmodell: livet til en cumulonimbus, en innflyging gjennom en mikroburst, eller værradaren'});
LAB.tx({lead:'En cumulonimbus rommer nesten alle farer i luftfarten på en gang: kraftig turbulens, ising, hagl, lyn, vindkastfronter og mikroburster. La en storm vokse fra en cumulus til en moden celle og se den dø, fly en innflyging gjennom mikrobursten, og finn den på værradaren, også det radaren ikke viser deg.',
 kin:'Ordene som brukes i modellen under. Hvert kort lenker til stedet i modellen der det vises.',kfs:'Stormtyper, varsler og avstand i sin helhet'});
function runHooks(){ hooks.forEach(f=>f()); }
runHooks(); LAB.onLang(()=>{ runHooks(); rebuild(); });
/* old anchors: #life, #shear, #wxr, #radar open the right view; #types opens the full reference */
const HV={'#life':'life','#shear':'mb','#wxr':'wx','#radar':'wx'}; if(HV[location.hash]) setView(HV[location.hash]); else setView('life'); if(location.hash==='#types') el('full').open=true;
seedLife();
LAB.start('storms');
})();
