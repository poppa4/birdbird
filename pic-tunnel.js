/* NORDAP – pic-tunnel.js: "From angle of attack to the stall" for tunnel.html (uses corepic.js).
   One aerofoil in the airflow, side view, flow from the left. The angle of attack grows step by step: pressure and lift,
   more angle more lift, the boundary layer separating from the trailing edge, the stall at the critical angle, and what
   flaps and slats change. A small CL-against-α curve follows along. Own design; illustrative values (critical α 15°). */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);

const steps=[
 {t:{en:'Angle of attack',no:'Anstigningsvinkel'},
  d:{en:'The air meets the wing from ahead: the <em>relative wind</em>. The <em>angle of attack α</em> is the angle between it and the chord line. It is not the pitch attitude: the wing only knows α.',
     no:'Luften møter vingen forfra: den <em>relative vinden</em>. <em>Anstigningsvinkelen α</em> er vinkelen mellom den og kordelinjen. Den er ikke pitch: vingen kjenner bare α.'}},
 {t:{en:'Lift comes from pressure',no:'Løft kommer fra trykk'},
  d:{en:'The air speeds up over the top and the pressure there falls: <em>suction on top</em>, a little extra pressure underneath. Most of the lift is the top surface being pulled up.',
     no:'Luften akselererer over oversiden, og trykket der faller: <em>sug på oversiden</em>, litt ekstra trykk under. Det meste av løftet er at oversiden suges opp.'}},
 {t:{en:'More angle, more lift',no:'Mer vinkel, mer løft'},
  d:{en:'Raise α and the suction grows: the lift coefficient <em>CL rises in a straight line</em>, about 0.1 per degree. Flying slower, you need more α to hold the same lift.',
     no:'Øk α, og suget vokser: løftkoeffisienten <em>CL øker i en rett linje</em>, omtrent 0,1 per grad. Flyr du saktere, trenger du mer α for å holde samme løft.'}},
 {t:{en:'The flow starts to let go',no:'Strømmen begynner å slippe'},
  d:{en:'Close to the skin the air is slowed by friction: the <em>boundary layer</em>. At high α it can no longer follow the top surface to the end, and <em>separates at the trailing edge</em> first.',
     no:'Tett ved overflaten bremses luften av friksjon: <em>grensesjiktet</em>. Ved høy α klarer det ikke lenger å følge oversiden helt bak, og <em>separerer ved bakkanten</em> først.'}},
 {t:{en:'Critical angle: the stall',no:'Kritisk vinkel: stall'},
  d:{en:'At the <em>critical angle of attack</em> the separation runs far forward: lift falls and drag jumps. It happens at the same α at any speed, any weight and any attitude. Recover by <em>reducing α</em>.',
     no:'Ved <em>kritisk anstigningsvinkel</em> går separasjonen langt fram: løftet faller og motstanden hopper. Det skjer ved samme α uansett fart, vekt og stilling. Gjenvinn ved å <em>redusere α</em>.'}},
 {t:{en:'Flaps and slats',no:'Klaff og slats'},
  d:{en:'<em>Flaps</em> add camber: more lift at the same α, so you can fly slower. <em>Slats</em> feed fast air over the nose and delay the separation: a <em>higher critical α</em>.',
     no:'<em>Klaff</em> gir mer krumning: mer løft ved samme α, så du kan fly saktere. <em>Slats</em> sender rask luft over nesen og utsetter separasjonen: <em>høyere kritisk α</em>.'},
  go:{en:'Open the aerofoil model',no:'Åpne profilmodellen',fn:()=>{ const v=document.getElementById('profil'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

/* key frames per step: α (deg), separation (0 attached … 1 fully separated), high-lift devices 0..1 */
const KA=[5,5,11,14.5,18,15], KS=[0,0,0,.28,.86,0], KH=[0,0,0,0,0,1];
const kf=(a,p)=>{ const i=clamp(Math.floor(p),0,a.length-1), j=Math.min(a.length-1,i+1); return lerp(a[i],a[j],ease(p-i)); };
/* lift curve: clean, and with flaps and slats */
const clClean=a=>a<=15?0.11*(a+2):Math.max(0.75,1.87-0.11*(a-15)*1.6);
const clHigh=a=>a<=21?0.11*(a+2)+0.75:Math.max(1.6,3.28-0.18*(a-21));

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const al=kf(KA,p), sep=kf(KS,p), hl=kf(KH,p), ar=al*Math.PI/180;
  const c=W*(sm?.5:.42), xq=W*(sm?.42:.37), cy=H*(sm?.4:.56), xle=xq-c*.25, xte=xle+c;
  const CL=lerp(clClean(al),clHigh(al),hl);
  /* aerofoil in world space (thickness and camber on a tilted chord line) */
  const yt=s=>5*0.13*c*(0.2969*Math.sqrt(s)-0.126*s-0.3516*s*s+0.2843*s*s*s-0.1036*s*s*s*s);
  const cam=s=>0.035*c*4*s*(1-s);
  const yc=x=>cy+(x-xq)*Math.tan(ar);                         // chord line: leading edge up
  const up=x=>{ const s=clamp((x-xle)/c,0,1); return yc(x)-cam(s)-yt(s); };
  const lo=x=>{ const s=clamp((x-xle)/c,0,1); return yc(x)-cam(s)+yt(s); };
  const yle=yc(xle), yte=yc(xte), xs=xte-sep*c*.82;           // separation point on the top surface
  const eps=Math.tan(ar*.42*(1-sep*.7));                      // downwash behind the wing
  /* the dividing contours the streamlines bend around */
  const N=120, x0=-10, x1=W+10, dx=(x1-x0)/N, UB=[], LB=[];
  for(let i=0;i<=N;i++){ const x=x0+i*dx; let u,l;
    if(x<xle){ const k=Math.exp(-(xle-x)/(c*.42)); u=l=cy+ (yle+c*.02-cy)*k+ (1-k)*c*.05*Math.sin(ar)*2; }
    else if(x>xte){ u=l=yte+(x-xte)*eps; }
    else { u=up(x); l=lo(x); }
    if(sep>0.01&&x>xs){ const us=up(xs)+(x-xs)*Math.tan(ar*.12); u=Math.min(u,lerp(u,us,Math.min(1,sep*3))); }
    UB.push(u); LB.push(l); }
  const blur=a=>{ const o=[]; const r=5; for(let i=0;i<a.length;i++){ let s=0,n=0; for(let k=-r;k<=r;k++){ const j=clamp(i+k,0,a.length-1); s+=a[j]; n++; } o.push(s/n); } return o; };
  const US=blur(UB), LS=blur(LB);
  /* streamlines */
  const D=c*.34, hs=sm?[-.62,-.44,-.3,-.18,-.09,-.03,.03,.1,.2,.33,.5]:[-.74,-.56,-.42,-.3,-.2,-.12,-.06,-.02,.02,.07,.14,.24,.37,.54];
  g.lineWidth=1.3; g.lineCap='round';
  hs.forEach((hh,k)=>{ const h=hh*c, above=h<0, S=above?US:LS, w=Math.exp(-Math.abs(h)/D);
    const fast=above?clamp(CL*.5*w*(1-sep*.6),0,1):0;
    g.strokeStyle=above?`rgba(${Math.round(127+90*fast)},${Math.round(198+30*fast)},238,${.42+.4*fast})`:'rgba(160,178,192,.42)';
    g.beginPath(); for(let i=0;i<=N;i++){ const x=x0+i*dx, y=cy+h+(S[i]-cy)*w; i?g.lineTo(x,y):g.moveTo(x,y); } g.stroke();
    /* moving dashes show the speed: faster over the top */
    const sp=(above?1+fast*1.1:1-(.18*w))*60, ph=(tm*sp+k*37)%90; g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=1.6;
    for(let xx=-90+ph;xx<W;xx+=90){ const i=clamp(Math.round((xx-x0)/dx),0,N-2); const y=cy+h+(S[i]-cy)*w, y2=cy+h+(S[i+2]-cy)*w; if(xx>xle-6&&xx<xte&&Math.abs(y-(above?up(xx):lo(xx)))<3) continue; g.beginPath(); g.moveTo(xx,y); g.lineTo(xx+dx*2,y2); g.stroke(); }
    g.lineWidth=1.3; });
  /* separated region: slow, churning air over the back of the wing */
  if(sep>0.03){ g.save(); g.globalAlpha=Math.min(1,sep*2.2);
    g.fillStyle='rgba(236,90,71,.16)'; g.beginPath(); g.moveTo(xs,up(xs)); for(let x=xs;x<=xte+c*.55;x+=6){ g.lineTo(x,up(xs)+(x-xs)*Math.tan(ar*.12)-2); } for(let x=xte+c*.55;x>=xs;x-=6){ g.lineTo(x,x>xte?yte+(x-xte)*eps*.4+6:up(x)); } g.closePath(); g.fill();
    g.strokeStyle='rgba(255,170,150,.75)'; g.lineWidth=1.2;
    for(let i=0;i<Math.round(4+sep*9);i++){ const fx=xs+((i*.37+tm*.05)%1)*(xte+c*.4-xs), top=up(xs)+(fx-xs)*Math.tan(ar*.12), bot=fx>xte?yte+(fx-xte)*eps*.4+6:up(fx); if(bot-top<10) continue; const fy=lerp(top,bot,.25+.5*((i*.61)%1)), r=Math.min(9,(bot-top)*.22), a0=tm*(1.6+i%3)+i; g.beginPath(); g.arc(fx,fy,r,a0,a0+4.6); g.stroke(); }
    g.restore(); }
  /* the aerofoil */
  const body=()=>{ g.beginPath(); for(let i=0;i<=40;i++){ const s=i/40, x=xle+s*c; i?g.lineTo(x,up(x)):g.moveTo(x,up(x)); } for(let i=40;i>=0;i--){ const s=i/40, x=xle+s*c; g.lineTo(x,lo(x)); } g.closePath(); };
  const gr=g.createLinearGradient(0,cy-c*.12,0,cy+c*.1); gr.addColorStop(0,'#F4F7F9'); gr.addColorStop(1,'#93A0AB'); g.fillStyle=gr; g.strokeStyle='rgba(10,16,21,.7)'; g.lineWidth=1.2; body(); g.fill(); g.stroke();
  /* flap and slat */
  if(hl>0.02){ g.save(); g.globalAlpha=hl;
    const fx=xle+c*.78, fy=(up(fx)+lo(fx))/2; g.translate(fx,fy); g.rotate(ar+hl*.42); g.fillStyle='#C9D1D8'; g.strokeStyle='rgba(10,16,21,.7)';
    g.beginPath(); g.moveTo(0,-c*.03); g.quadraticCurveTo(c*.12,-c*.045,c*.24,0); g.quadraticCurveTo(c*.1,c*.03,0,c*.03); g.quadraticCurveTo(-c*.02,0,0,-c*.03); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.save(); g.globalAlpha=hl; g.translate(xle-c*.035*hl,yle+c*.02*hl); g.rotate(ar-.25*hl); g.fillStyle='#C9D1D8'; g.strokeStyle='rgba(10,16,21,.7)';
    g.beginPath(); g.moveTo(-c*.01,0); g.quadraticCurveTo(c*.02,-c*.07,c*.1,-c*.06); g.quadraticCurveTo(c*.04,-c*.035,c*.03,c*.01); g.closePath(); g.fill(); g.stroke(); g.restore();
    pill(g,L({en:'slat',no:'slat'}),xle-c*.02,yle-c*.16,{size:10.5*fs,col:C.amber,al:'center',a:hl,fit:W}); pill(g,L({en:'flap',no:'klaff'}),xte+c*.06,yte+c*.16,{size:10.5*fs,col:C.amber,al:'center',a:hl,fit:W}); }
  /* pressure arrows: suction on top, a little pressure below */
  const pk=at(p,1,.7); if(pk>0.02){ g.save(); g.globalAlpha=pk;
    for(let i=1;i<=9;i++){ const s=i/10, x=xle+s*c; if(sep>0.05&&x>xs) continue; const cp=CL*(0.16+1.25*Math.exp(-Math.pow((s-.16)/.2,2)))*(1-sep*.35), len=cp*c*.085; arrow(g,x,up(x)-3,x-Math.sin(ar)*len*.3,up(x)-3-len,C.blue,{lw:1.8,head:6}); }
    for(let i=2;i<=8;i+=2){ const s=i/10, x=xle+s*c, len=CL*c*.022; arrow(g,x,lo(x)+len+8,x,lo(x)+4,C.red,{lw:1.6,head:5}); }
    { const a1=1-at(p,2,.5); if(a1>0.02) pill(g,L({en:'low pressure: suction',no:'lavt trykk: sug'}),xle+c*.8,up(xle+c*.6)-c*.2,{size:10.5*fs,col:C.blue,al:'center',fit:W,a:a1}); }
    g.restore(); }
  /* chord line, relative wind and α */
  const k0=1-at(p,2,.8)*.55; g.save(); g.globalAlpha=k0;
  g.strokeStyle='rgba(255,255,255,.75)'; g.setLineDash([6,5]); g.lineWidth=1.2; const ex=xle-c*.42; g.beginPath(); g.moveTo(xte,yte); g.lineTo(ex,yc(ex)); g.stroke(); g.setLineDash([]);
  const vy=yc(ex)+(xle-ex)*0+0; const wy=yle+ (c*.0); arrow(g,ex-c*.02,yle,xle-c*.06,yle,C.amber,{lw:2.4,head:9});
  g.strokeStyle=C.amber; g.lineWidth=1.4; const R=c*.3; g.beginPath(); g.arc(xle,yle,R,Math.PI,Math.PI+ar,false); g.stroke();
  txt(g,`α ${nf(al,0)}°`,xle-R-10,yle-Math.tan(ar/2)*R-6,{mono:1,size:13*fs,col:C.amber,al:'right',w:600});
  if(p<1.5){ txt(g,L({en:'relative wind',no:'relativ vind'}),ex-c*.02,yle+16,{size:11*fs,col:C.amber}); txt(g,L({en:'chord line',no:'kordelinje'}),ex+c*.1,yc(ex+c*.1)-8,{size:11*fs,col:'#E2E8EE'}); }
  g.restore();
  /* lift and drag */
  const fk=at(p,1,.8); if(fk>0.02){ const lx=xle+c*.3, ly=up(lx)-2, LL=CL*c*.2, DD=(0.02+sep*.42+hl*.06)*c*1.1;
    arrow(g,lx,ly,lx,ly-LL,C.green,{lw:3.2,head:11,a:fk}); pill(g,L({en:'Lift',no:'Løft'}),lx+12,ly-LL-4,{size:11*fs,col:C.green,a:fk,fit:W});
    arrow(g,xte+4,yte,xte+4+DD,yte,C.red,{lw:3,head:10,a:fk}); if(DD>26) pill(g,L({en:'Drag',no:'Motstand'}),xte+10+DD,yte-16,{size:11*fs,col:C.red,a:fk,fit:W}); }
  if(sep>0.05){ pill(g,L({en:'separation point',no:'separasjonspunkt'}),xs,up(xs)-18,{size:10.5*fs,col:C.red,al:'center',a:Math.min(1,sep*3),fit:W}); g.fillStyle=C.red; g.beginPath(); g.arc(xs,up(xs),3.5,0,7); g.fill(); }
  if(sep>0.6) pill(g,L({en:'STALL',no:'STALL'}),xle+c*.5,cy-c*.48,{size:14*fs,col:'#fff',bg:'rgba(236,90,71,.92)',bd:'rgba(236,90,71,1)',al:'center',a:clamp((sep-.6)*4,0,1),fit:W});
  /* the lift curve */
  const bw=sm?W*.9:W*.27, bh=sm?H*.3:H*.42, bx=sm?W*.05:W*.71, by=sm?H*.66:H*.06;
  rr(g,bx,by,bw,bh,8); g.fillStyle='rgba(10,15,20,.86)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.lineWidth=1; g.stroke();
  const ax0=bx+34, ay0=by+bh-26, aw=bw-48, ah=bh-52, X=a=>ax0+(a+2)/27*aw, Y=v=>ay0-v/3.4*ah;
  txt(g,L({en:'LIFT CURVE',no:'LØFTKURVE'}),bx+12,by+17,{mono:1,size:9.5*fs,col:'#8E99A4'});
  g.strokeStyle='rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(ax0,by+26); g.lineTo(ax0,ay0); g.lineTo(ax0+aw,ay0); g.stroke();
  [0,10,20].forEach(a=>txt(g,a+'°',X(a),ay0+14,{mono:1,size:9.5*fs,col:'#8E99A4',al:'center'})); txt(g,'α',ax0+aw,ay0+14,{mono:1,size:10*fs,col:'#C9D2DA',al:'right'});
  const curve=(f,a1,col,lw,alp)=>{ g.save(); g.globalAlpha=alp; g.strokeStyle=col; g.lineWidth=lw; g.beginPath(); for(let a=-2;a<=a1;a+=.5){ a===-2?g.moveTo(X(a),Y(f(a))):g.lineTo(X(a),Y(f(a))); } g.stroke(); g.restore(); };
  curve(clClean,22,C.blue,2,1); if(hl>0.02){ curve(clHigh,25,C.amber,2,hl); txt(g,L({en:'flaps + slats',no:'klaff + slats'}),X(9),Y(clHigh(9))-8,{size:10*fs,col:C.amber,a:hl,al:'right'}); }
  g.setLineDash([3,3]); g.strokeStyle='rgba(236,90,71,.7)'; g.beginPath(); g.moveTo(X(15),Y(clClean(15))); g.lineTo(X(15),ay0); g.stroke(); g.setLineDash([]);
  txt(g,L({en:'critical α',no:'kritisk α'}),X(15)+4,ay0-5,{size:9.5*fs,col:C.red});
  g.fillStyle='#fff'; g.beginPath(); g.arc(X(al),Y(CL),4.5,0,7); g.fill(); g.strokeStyle=C.mag; g.lineWidth=2; g.stroke();
  txt(g,`CL ${nf(CL,2)}`,bx+bw-12,by+17,{mono:1,size:11*fs,col:'#fff',al:'right',w:600});
  txt(g,L({en:'illustrative · not to scale',no:'illustrativt · ikke i skala'}),sm?W-10:W*.69,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.6,aspectSm:1/1.12,dwell:6.5,narrow:true,
    title:{en:'From angle of attack to the stall',no:'Fra anstigningsvinkel til stall'},
    sub:{en:'One wing in the airflow. Watch what the angle of attack does to the pressure, the lift and the flow over the top.',no:'Én vinge i luftstrømmen. Se hva anstigningsvinkelen gjør med trykket, løftet og strømmen over oversiden.'},
    label:{en:'Animated aerofoil in an airflow: the angle of attack grows, lift rises, the flow separates from the trailing edge and the wing stalls; then flaps and slats.',no:'Animert vingeprofil i en luftstrøm: anstigningsvinkelen øker, løftet stiger, strømmen separerer fra bakkanten og vingen staller; så klaff og slats.'},
    foot:{en:'Illustrative aerofoil: critical angle 15° clean, about 21° with slats. Real values depend on the wing and the configuration.',no:'Illustrativ profil: kritisk vinkel 15° ren, rundt 21° med slats. Virkelige verdier avhenger av vingen og konfigurasjonen.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
