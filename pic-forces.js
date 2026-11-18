/* NORDAP – pic-forces.js: "Four forces, and what changes in a climb, a glide and a turn" for forces.html (uses corepic.js).
   Side view for straight flight, climb and glide (forces resolved along and across the flight path); rear view for the turn
   (lift tilts; n = 1/cos φ; stall speed × √n). Illustrative values (L/D 17, γ 6° climb). */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,jet,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const COL={L:C.blue,W:'#F4F7F9',T:C.mag,D:C.red,n:C.amber};

const steps=[
 {t:{en:'Four forces in balance',no:'Fire krefter i balanse'},
  d:{en:'In steady, level flight <em>lift = weight</em> and <em>thrust = drag</em>. Balanced forces do not mean no forces: they mean no change. The aircraft keeps its speed and its height.',
     no:'I stabil, horisontal flyging er <em>løft = vekt</em> og <em>skyvekraft = motstand</em>. Balanserte krefter betyr ikke ingen krefter: det betyr ingen endring. Flyet holder farten og høyden.'}},
 {t:{en:'Climb · thrust pays for height',no:'Stigning · skyvekraften betaler for høyde'},
  d:{en:'Tilt the path up by γ and part of the weight now acts <em>backwards along the path</em>: W·sin γ. Thrust must cover drag <em>plus</em> that part. Lift is slightly less than weight in a steady climb.',
     no:'Vipp banen opp med γ, og en del av vekten virker nå <em>bakover langs banen</em>: W·sin γ. Skyvekraften må dekke motstanden <em>pluss</em> den delen. Løftet er litt mindre enn vekten i en stabil stigning.'}},
 {t:{en:'Glide · weight pulls you along',no:'Gli · vekten drar deg fremover'},
  d:{en:'No thrust: now W·sin γ points <em>forwards</em> and balances drag. The glide angle is set by lift/drag alone: at L/D 17 you cover about <em>17 times your height</em>, roughly 28 NM from 10 000 ft, whatever the weight.',
     no:'Ingen skyvekraft: nå peker W·sin γ <em>fremover</em> og balanserer motstanden. Glidevinkelen bestemmes bare av løft/motstand: ved L/D 17 kommer du omtrent <em>17 ganger høyden</em>, rundt 28 NM fra 10 000 ft, uansett vekt.'}},
 {t:{en:'Turn · the lift tilts',no:'Sving · løftet vippes'},
  d:{en:'Bank and the lift tilts with the wings. Its <em>horizontal part</em> pulls you round the turn; only its <em>vertical part</em> holds the weight. To stay level you must pull for more lift.',
     no:'Krenger du, vippes løftet med vingene. Den <em>horisontale delen</em> drar deg rundt i svingen; bare den <em>vertikale delen</em> bærer vekten. For å holde høyden må du trekke for mer løft.'}},
 {t:{en:'Load factor · n = 1 / cos φ',no:'Lastfaktor · n = 1 / cos φ'},
  d:{en:'Level turn at 30°: 1.15 g. At 45°: 1.41 g. At <em>60°: 2 g</em>. You feel heavier by the same factor, and the stall speed rises with √n: <em>+41 % at 60°</em>.',
     no:'Horisontal sving med 30°: 1,15 g. Med 45°: 1,41 g. Med <em>60°: 2 g</em>. Du kjenner deg tyngre med samme faktor, og stallfarten øker med √n: <em>+41 % ved 60°</em>.'},
  go:{en:'Open the forces lab',no:'Åpne kraftlabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

/* rear view of a twin-jet, wings level when bank = 0 */
function jetRear(g,x,y,s,bank){
  g.save(); g.translate(x,y); g.rotate(bank*Math.PI/180);
  const P=v=>v*s;
  g.fillStyle='#C9D1D8'; g.strokeStyle='rgba(10,16,21,.6)'; g.lineWidth=1;
  // wings with slight dihedral
  g.beginPath(); g.moveTo(P(-17),P(-1.0)); g.lineTo(P(-1.6),P(0.35)); g.lineTo(P(1.6),P(0.35)); g.lineTo(P(17),P(-1.0)); g.lineTo(P(17),P(-0.45)); g.lineTo(P(1.6),P(1.15)); g.lineTo(P(-1.6),P(1.15)); g.lineTo(P(-17),P(-0.45)); g.closePath(); g.fill(); g.stroke();
  [-17,17].forEach(t=>{ g.fillStyle='#E46BAE'; g.beginPath(); g.arc(P(t),P(-0.72),P(.32),0,7); g.fill(); }); g.fillStyle='#C9D1D8';
  // tailplane
  g.beginPath(); g.moveTo(P(-6.2),P(-2.6)); g.lineTo(P(6.2),P(-2.6)); g.lineTo(P(6.2),P(-2.25)); g.lineTo(P(-6.2),P(-2.25)); g.closePath(); g.fill();
  // fin
  g.fillStyle='#9A1E68'; g.beginPath(); g.moveTo(P(-0.35),P(-2)); g.lineTo(P(-0.25),P(-8)); g.lineTo(P(0.25),P(-8)); g.lineTo(P(0.35),P(-2)); g.closePath(); g.fill();
  // fuselage
  const gr=g.createRadialGradient(P(-0.6),P(-0.6),P(.3),0,0,P(2)); gr.addColorStop(0,'#F7F9FA'); gr.addColorStop(1,'#9AA6B0'); g.fillStyle=gr; g.beginPath(); g.arc(0,0,P(2),0,7); g.fill(); g.stroke();
  // engines
  [-5.7,5.7].forEach(ex=>{ const e=g.createRadialGradient(P(ex-.3),P(1.5),P(.2),P(ex),P(1.8),P(1.1)); e.addColorStop(0,'#E9EEF1'); e.addColorStop(1,'#7D8994'); g.fillStyle=e; g.beginPath(); g.arc(P(ex),P(1.8),P(1.05),0,7); g.fill(); g.stroke(); g.fillStyle='#1C262F'; g.beginPath(); g.arc(P(ex),P(1.8),P(.55),0,7); g.fill(); });
  g.restore(); }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const rear=at(p,3,.9), side=1-rear;
  const cx=W*(sm?.5:.42), cy=H*.5, F=Math.min(W,H*1.8)*(sm?.2:.17);   // force arrow unit (weight length)
  // background horizon tilt for climb/glide
  const climb=at(p,1,.8)*(1-at(p,2,.8)), glide=at(p,2,.8)*(1-rear);
  const gam=(6*climb-3.4*glide);   // flight path angle, deg
  if(side>0.01){ g.save(); g.globalAlpha=side;
    // horizon
    g.strokeStyle='rgba(255,255,255,.1)'; g.lineWidth=1; g.beginPath(); g.moveTo(0,cy+F*1.35); g.lineTo(W,cy+F*1.35); g.stroke();
    // flight path
    const ga=-gam*Math.PI/180; g.strokeStyle='rgba(127,198,238,.35)'; g.setLineDash([8,6]); g.beginPath(); g.moveTo(cx-W*.6*Math.cos(ga),cy-W*.6*Math.sin(ga)); g.lineTo(cx+W*.6*Math.cos(ga),cy+W*.6*Math.sin(ga)); g.stroke(); g.setLineDash([]);
    txt(g,L({en:'flight path',no:'flygebane'}),cx+W*.32*Math.cos(ga),cy+W*.32*Math.sin(ga)-10,{mono:1,size:10*fs,col:'#9FD4F2'});
    if(Math.abs(gam)>.3){ g.strokeStyle='rgba(255,255,255,.5)'; g.beginPath(); g.arc(cx,cy,F*.95,Math.min(0,ga),Math.max(0,ga)); g.stroke(); txt(g,`γ ${nf(Math.abs(gam),0)}°`,cx+F*1.0,cy+(ga<0?-6:14),{mono:1,size:11*fs,col:'#fff'}); g.strokeStyle='rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+F*1.2,cy); g.stroke(); }
    // aircraft, pitch = path angle + small α
    const s=Math.max(2.6,W/185), pa=(gam+2)*Math.PI/180;
    // the origin of jet() is the main-gear contact; put the centreline (4 m above it) on the CG at (cx,cy)
    jet(g,{x:cx-4*s*Math.sin(pa),y:cy+4*s*Math.cos(pa),s,pitch:gam+2,gear:0,eng:[1-glide,1-glide],tm});
    // forces (in path axes)
    const sg=Math.sin(gam*Math.PI/180), cg=Math.cos(gam*Math.PI/180);
    const EX=6, Wl=F, Ll=F*cg, Dl=F/17*EX, Tl=(Dl+F*sg*EX)*(1-glide);     // drag and thrust drawn ×6 so they can be seen
    const ux=Math.cos(ga), uy=Math.sin(ga), nx=Math.sin(ga), ny=-Math.cos(ga);        // along path, and normal (up)
    const A=(dx,dy,len,col,lab,o,off)=>{ if(len<2) return; const ox=cx+dx*(off||0), oy=cy+dy*(off||0); arrow(g,ox,oy,ox+dx*len,oy+dy*len,col,{lw:3.2,head:11,...(o||{})}); if(lab) pill(g,lab,ox+dx*(len+18),oy+dy*(len+18)+(Math.abs(dy)<.5?-16:0),{size:11*fs,col,al:Math.abs(dx)>.5?(dx>0?'right':'left'):'center',fit:W}); };
    const tail=22*s, nose=17.5*s;
    const grow=k=>ease(clamp(k,0,1));
    const g0=sm?1:grow(p<.05?1:1);
    A(nx,ny,Ll*g0,COL.L,`${L({en:'Lift',no:'Løft'})}${climb>.5?' = W·cos γ':''}`);
    A(0,1,Wl*g0,COL.W,L({en:'Weight',no:'Vekt'}));
    A(-ux,-uy,Dl,COL.D,L({en:'Drag',no:'Motstand'}),{},tail);
    if(Tl>2) A(ux,uy,Tl,COL.T,climb>.5?L({en:'Thrust = D + W·sin γ',no:'Skyvekraft = D + W·sin γ'}):L({en:'Thrust',no:'Skyvekraft'}),{},nose);
    // weight split along the path (climb, glide)
    const split=Math.max(climb,glide);
    if(split>0.02){ g.save(); g.globalAlpha*=split; const wx=0, wy=Wl; const along=(wx*ux+wy*uy), norm=(wx*nx+wy*ny);
      g.setLineDash([5,4]); arrow(g,cx,cy,cx+ux*along*EX,cy+uy*along*EX,C.amber,{lw:2.4,head:9}); arrow(g,cx,cy,cx+nx*norm,cy+ny*norm,'rgba(255,255,255,.6)',{lw:1.6,head:8}); g.setLineDash([]);
      pill(g,glide>.5?L({en:'W·sin γ pulls forward',no:'W·sin γ drar fremover'}):L({en:'W·sin γ pulls back',no:'W·sin γ drar bakover'}),cx+ux*along*EX+(glide>.5?14:-14),cy+uy*along*EX+22,{size:10.5*fs,col:C.amber,al:glide>.5?'left':'right',fit:W}); g.restore(); }
    // glide distance inset
    if(glide>0.05){ g.save(); g.globalAlpha*=glide; const bx=W*(sm?.06:.6), by=H*(sm?.74:.66), bw=W*(sm?.88:.36), bh=H*(sm?.2:.26);
      rr(g,bx,by,bw,bh,8); g.fillStyle='rgba(10,15,20,.85)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
      txt(g,L({en:'GLIDE · L/D 17',no:'GLI · L/D 17'}),bx+10,by+16,{mono:1,size:9.5*fs,col:'#8E99A4'});
      const x0=bx+16, x1=bx+bw-16, y0=by+30, y1=by+bh-18; g.strokeStyle='rgba(120,170,130,.6)'; g.beginPath(); g.moveTo(x0,y1); g.lineTo(x1,y1); g.stroke();
      g.strokeStyle=C.amber; g.lineWidth=2; g.setLineDash([5,4]); g.beginPath(); g.moveTo(x0,y0); g.lineTo(x0+(x1-x0)*ease(glide),y0+(y1-y0)*ease(glide)); g.stroke(); g.setLineDash([]);
      txt(g,'10 000 ft',x0+4,y0-4,{mono:1,size:10*fs,col:'#fff'}); txt(g,`≈ 28 NM`,x1,y1-6,{mono:1,size:11*fs,col:C.amber,al:'right',w:600});
      txt(g,L({en:'(heights ×10)',no:'(høyder ×10)'}),x1,by+16,{mono:1,size:9*fs,col:'#5F6D77',al:'right'}); g.restore(); }
    // balance chips
    if(p<.9){ pill(g,'L = W',W*(sm?.16:.84),H*.2,{mono:1,size:12*fs,col:COL.L,al:'center',a:1-climb}); pill(g,'T = D',W*(sm?.84:.84),H*(sm?.2:.28),{mono:1,size:12*fs,col:COL.T,al:'center',a:1-climb}); }
    g.restore(); }
  if(rear>0.01){ g.save(); g.globalAlpha=rear;
    const nk=at(p,4,.9);
    // bank cycles 30 → 45 → 60 in step 5, 30 in step 4
    const ph=(tm*0.18)%1, banks=[30,45,60], bi=Math.floor(ph*3), bk=nk>0.5?lerp(banks[bi],banks[(bi+1)%3],ease(clamp((ph*3-bi-0.7)/0.3,0,1))):lerp(0,30,ease(rear));
    const n=1/Math.cos(bk*Math.PI/180);
    const s=Math.max(4.2,W/82), x=W*(sm?.5:.36), y=H*.56, Fu=Math.min(W,H*1.8)*(sm?.18:.15);
    // horizon
    g.strokeStyle='rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(0,y+Fu*1.2); g.lineTo(W,y+Fu*1.2); g.stroke();
    jetRear(g,x,y,s,-bk);
    const a=-bk*Math.PI/180, Ll=Fu*n, lx=Math.sin(-a)*Ll, ly=-Math.cos(a)*Ll;
    arrow(g,x,y,x-lx,y+ly,COL.L,{lw:3.4,head:12}); pill(g,`${L({en:'Lift',no:'Løft'})} ${nf(n,2)} W`,x-lx-10,y+ly-14,{size:11*fs,col:COL.L,al:'right',fit:W});
    arrow(g,x,y,x,y+Fu,COL.W,{lw:3.2,head:11}); pill(g,L({en:'Weight',no:'Vekt'}),x,y+Fu+18,{size:11*fs,col:COL.W,al:'center'});
    g.setLineDash([5,4]); arrow(g,x,y,x,y+ly,'rgba(127,198,238,.75)',{lw:2,head:9}); arrow(g,x,y,x-lx,y,C.amber,{lw:2.4,head:9}); g.setLineDash([]);
    pill(g,L({en:'turns you',no:'svinger deg'}),x-lx-8,y+16,{size:10.5*fs,col:C.amber,al:'right',fit:W});
    pill(g,L({en:'holds the weight',no:'bærer vekten'}),x+12,y+ly/2,{size:10.5*fs,col:'#9FD4F2'});
    // bank arc
    g.strokeStyle='rgba(255,255,255,.5)'; g.lineWidth=1; g.beginPath(); g.arc(x,y,Fu*.55,-Math.PI/2,-Math.PI/2+a,true); g.stroke(); txt(g,`φ ${nf(bk)}°`,x-Fu*.2,y-Fu*.6,{mono:1,size:11*fs,col:'#fff',al:'right'});
    // g meter and table
    const tx=W*(sm?.06:.66), ty=H*(sm?.08:.16);
    rr(g,tx,ty,W*(sm?.88:.3),sm?H*.2:H*.42,8); g.fillStyle='rgba(10,15,20,.85)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
    txt(g,L({en:'LEVEL TURN',no:'HORISONTAL SVING'}),tx+12,ty+18,{mono:1,size:9.5*fs,col:'#8E99A4'});
    txt(g,`n = ${nf(n,2)} g`,tx+12,ty+(sm?44:52),{mono:1,size:(sm?20:28)*fs,col:C.amber,w:600});
    txt(g,`${L({en:'stall speed',no:'stallfart'})} × ${nf(Math.sqrt(n),2)}`,tx+12,ty+(sm?64:80),{mono:1,size:12*fs,col:'#fff'});
    if(!sm&&nk>0.05){ g.save(); g.globalAlpha*=nk; [[30,1.15],[45,1.41],[60,2.0]].forEach(([b,nn],i)=>{ const yy=ty+112+i*24, on=Math.abs(bk-b)<4; txt(g,`${b}°`,tx+14,yy,{mono:1,size:12,col:on?'#fff':'#8E99A4'}); txt(g,`${nf(nn,2)} g`,tx+70,yy,{mono:1,size:12,col:on?C.amber:'#8E99A4'}); txt(g,`Vs +${nf((Math.sqrt(nn)-1)*100)} %`,tx+140,yy,{mono:1,size:12,col:on?'#fff':'#8E99A4'}); }); g.restore(); }
    g.restore(); }
  txt(g,L({en:'thrust and drag drawn ×6 · not to scale',no:'skyvekraft og motstand tegnet ×6 · ikke i skala'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.1,dwell:6.5,
    title:{en:'Four forces, and what changes in a climb, a glide and a turn',no:'Fire krefter, og hva som endrer seg i stigning, gli og sving'},
    sub:{en:'The same four arrows explain every phase. Watch which one has to grow, and why.',no:'De samme fire pilene forklarer hver fase. Se hvilken som må vokse, og hvorfor.'},
    label:{en:'Animated force diagram on a jet: level flight, climb, glide, then a rear view of a banked turn with the load factor.',no:'Animert kraftdiagram på et jetfly: horisontal flyging, stigning, gli, deretter et bakfra-bilde av en krengt sving med lastfaktoren.'},
    foot:{en:'Illustrative jet, L/D 17, climb gradient about 6°. Thrust and drag are drawn six times longer than lift and weight so they can be seen.',no:'Illustrerende jetfly, L/D 17, stigegradient omtrent 6°. Skyvekraft og motstand er tegnet seks ganger lengre enn løft og vekt så de synes.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
