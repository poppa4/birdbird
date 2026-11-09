/* Birdbird – gennav.js: the General navigation lab (gennav.html).
   One dark instrument-style figure with four modes: the wind triangle on a compass rose with the leg strip below it,
   off track (1 in 60), Earth and charts (Deep dive) and PET and PNR (Deep dive). All maths in gennavcore.js (GNAV). */
(function(){
'use strict';
const {L,el,nf}=LAB, G=GNAV, t2=(en,no)=>({en,no});
const D2R=Math.PI/180, R2D=180/Math.PI;
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const MONO='"IBM Plex Mono", ui-monospace, monospace', SANS='"Public Sans", system-ui, sans-serif';
const C={hdg:'#7FCBE8',trk:'#71CC93',wind:'#F0B440',dtk:'#C9D2DA',gc:'#E46BAE',rl:'#7FCBE8',red:'#EC5A47',txt:'#EEF2F5',mut:'#8E99A4',dim:'#5E6D7C',ring:'rgba(214,226,236,.55)',grid:'rgba(200,215,225,.13)'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const f3=a=>{ const v=Math.round(G.norm(a))%360; return String(v===0?360:v).padStart(3,'0'); };
const dg=a=>f3(a)+'°';
const TT=()=>LAB.lang==='no'?'R':'T';
const hm=min=>{ if(!isFinite(min)) return '–'; min=Math.round(min); return Math.floor(min/60)+':'+String(min%60).padStart(2,'0'); };
const sgnLR=(v,d)=>Math.abs(v)<0.05?'0°':nf(Math.abs(v),d??0)+'° '+(v>0?L(t2('R','H')):L(t2('L','V')));
const kg=v=>isFinite(v)?nf(v,v<100?1:0)+' kg':'–';
const depth=()=>document.body.classList.contains('depth-short')?'short':document.body.classList.contains('depth-instructor')?'instructor':'deep';
const deepOn=()=>depth()!=='short';

/* nonlinear slider value lists (fine at small values, coarse at large) */
const rng=(a,b,s)=>{ const o=[]; for(let v=a;v<=b+1e-9;v+=s) o.push(Math.round(v*100)/100); return o; };
const LDIST=[...rng(10,200,1),...rng(205,600,5),...rng(610,2000,10)];
const LFF=[...rng(5,100,1),...rng(105,500,5),...rng(520,3000,20)];
const LFUEL=[...rng(5,200,1),...rng(205,1000,5),...rng(1020,6000,20),...rng(6100,20000,100)];
const idx=(list,v)=>{ let b=0; for(let i=0;i<list.length;i++) if(Math.abs(list[i]-v)<Math.abs(list[b]-v)) b=i; return b; };

/* ---------------- state ---------------- */
const AP={ENGM:[60.19,11.10,t2('Oslo','Oslo')],ENTC:[69.68,18.92,t2('Tromsø','Tromsø')],ENSB:[78.25,15.47,t2('Longyearbyen','Longyearbyen')],KJFK:[40.64,-73.78,t2('New York','New York')],EQA:[0,0,t2('0°, 0°','0°, 0°')],EQB:[0,60,t2('0°, 60° E','0°, 60° Ø')]};
const ROUTES=[['engm-entc','ENGM','ENTC',t2('Oslo–Tromsø','Oslo–Tromsø')],['entc-ensb','ENTC','ENSB',t2('Tromsø–Svalbard','Tromsø–Svalbard')],['engm-kjfk','ENGM','KJFK',t2('Oslo–New York','Oslo–New York')],['eq','EQA','EQB',t2('Along the equator','Langs ekvator')]];
const S={mode:'solve',know:'trk',tas:120,trk:270,hdg:280,wd:330,ws:25,varE:3,dev:0,dist:120,ff:35,flown:40,off:4,route:'engm-kjfk',proj:'globe',ctas:120,cs:'all',fuel:60,fl:370,mach:0.78,isa:0};

function sol(){ return S.know==='trk'? G.headingFor(S.tas,S.trk,S.wd,S.ws) : G.trackFrom(S.tas,S.hdg,S.wd,S.ws); }
function leg(){ const s=sol(), t=G.legTime(S.dist,s.ok?s.gs:0); return {t,fuel:G.legFuel(t,S.ff)}; }
function offCalc(){ const s=sol(), flown=Math.min(S.flown,S.dist-1), togo=S.dist-flown, o=G.offTrack(S.off,flown,togo);
  const newTrk=G.norm(s.trk-o.turn), nh=G.headingFor(S.tas,newTrk,S.wd,S.ws), dToB=Math.hypot(togo,S.off), tB=G.legTime(dToB,nh.ok?nh.gs:0);
  return {...o,flown,togo,newTrk,nh,dToB,tB,fuel:G.legFuel(tB,S.ff),plan:s.trk}; }
function routeCalc(){ const r=ROUTES.find(x=>x[0]===S.route)||ROUTES[0], A=AP[r[1]], B=AP[r[2]];
  return {r,A,B,na:r[1].startsWith('EQ')?'A':r[1],nb:r[2].startsWith('EQ')?'B':r[2],...G.route(A[0],A[1],B[0],B[1])}; }
function petCalc(){ const s=sol(), trk=s.trk;
  const gsN=v=>{ const h=G.headingFor(v,trk,S.wd,S.ws); return h.ok?h.gs:NaN; }, gsH=v=>{ const h=G.headingFor(v,trk+180,S.wd,S.ws); return h.ok?h.gs:NaN; };
  const On=gsN(S.tas), Hn=gsH(S.tas), Of=gsN(S.ctas), Hf=gsH(S.ctas), E=S.fuel/S.ff;
  return {On,Hn,Of,Hf,E,pet:G.pet(S.dist,Of,Hf,On),pnr:G.pnr(E,On,Hn)}; }

/* ---------------- canvas helpers ---------------- */
const cv=el('gnv'); const ST=LAB.fit(cv,()=>draw(),2);
let FS=1, GEO=null;
function txt(g,s,x,y,col,al,sz,wt,font){ g.font=`${wt||500} ${Math.round((sz||12)*FS*10)/10}px ${font||MONO}`; g.fillStyle=col||C.txt; g.textAlign=al||'left'; g.textBaseline='alphabetic'; g.fillText(s,x,y); g.textAlign='left'; }
function line(g,x1,y1,x2,y2,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); g.setLineDash([]); }
function dot(g,x,y,r,fill,stroke,w){ g.beginPath(); g.arc(x,y,r,0,Math.PI*2); if(fill){ g.fillStyle=fill; g.fill(); } if(stroke){ g.strokeStyle=stroke; g.lineWidth=w||1.5; g.stroke(); } }
/* a vector with E6B chevrons: 1 heading/TAS, 2 track/GS, 3 wind */
function vec(g,x1,y1,x2,y2,col,n,w){ g.lineCap='round'; line(g,x1,y1,x2,y2,col,w||2.6); g.lineCap='butt';
  const l=Math.hypot(x2-x1,y2-y1); if(l<26) return; const ux=(x2-x1)/l, uy=(y2-y1)/l, nx=-uy, ny=ux, mx=(x1+x2)/2, my=(y1+y2)/2;
  g.strokeStyle=col; g.lineWidth=2; g.lineJoin='round';
  for(let i=0;i<n;i++){ const o=(i-(n-1)/2)*6.5+3, px=mx+ux*o, py=my+uy*o; g.beginPath(); g.moveTo(px-ux*7+nx*5,py-uy*7+ny*5); g.lineTo(px,py); g.lineTo(px-ux*7-nx*5,py-uy*7-ny*5); g.stroke(); } }
function arrow(g,x1,y1,x2,y2,col,w){ line(g,x1,y1,x2,y2,col,w||2); const a=Math.atan2(y2-y1,x2-x1), h=7; g.fillStyle=col; g.beginPath(); g.moveTo(x2,y2); g.lineTo(x2-h*Math.cos(a-0.42),y2-h*Math.sin(a-0.42)); g.lineTo(x2-h*Math.cos(a+0.42),y2-h*Math.sin(a+0.42)); g.closePath(); g.fill(); }
/* small aircraft seen from above, nose along bearing brg (deg, screen north up) */
const PL=[[0,-1],[.09,-.8],[.1,-.25],[.92,.08],[.92,.2],[.1,.06],[.07,.58],[.36,.76],[.36,.86],[0,.8]];
function plane(g,x,y,brg,s,col){ const a=brg*D2R, c=Math.cos(a), sn=Math.sin(a); g.fillStyle=col||'#EEF3F7'; g.beginPath();
  const pts=PL.concat(PL.slice(1,-1).reverse().map(([px,py])=>[-px,py])); pts.forEach(([px,py],i)=>{ const X=x+(px*c-py*sn)*s, Y=y+(px*sn+py*c)*s; i?g.lineTo(X,Y):g.moveTo(X,Y); }); g.closePath(); g.fill(); }
/* label placer: tries candidate positions, never overlaps a placed label or a blocked box, stays inside the canvas */
function segHit(a,s){ // does segment s=[x1,y1,x2,y2] cross rectangle a=[x0,y0,x1,y1]? (Liang–Barsky)
  let t0=0,t1=1; const dx=s[2]-s[0], dy=s[3]-s[1];
  for(const [p,q] of [[-dx,s[0]-a[0]],[dx,a[2]-s[0]],[-dy,s[1]-a[1]],[dy,a[3]-s[1]]]){ if(p===0){ if(q<0) return false; } else { const r=q/p; if(p<0){ if(r>t1) return false; if(r>t0) t0=r; } else { if(r<t0) return false; if(r<t1) t1=r; } } } return true; }
function Placer(g,W,H){ const B=[], SG=[]; const hit=(a)=>a[0]<2||a[1]<2||a[2]>W-2||a[3]>H-2||B.some(b=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1])||SG.some(sg=>segHit(a,sg));
  return { seg(x1,y1,x2,y2){ SG.push([x1,y1,x2,y2]); }, block(x0,y0,x1,y1){ B.push([Math.min(x0,x1),Math.min(y0,y1),Math.max(x0,x1),Math.max(y0,y1)]); },
    put(s,x,y,col,o){ o=o||{}; const sz=(o.sz||12)*FS; g.font=`${o.wt||600} ${sz}px ${o.font||SANS}`; const tw=g.measureText(s).width, pw=tw+10, ph=sz+7;
      const cs=o.c||[[10,-10],[10,10],[-10,-10],[-10,10],[0,-14],[0,14],[16,0],[-16,0]];
      const box=(dx,dy,clampIt)=>{ let cx=x+dx+(dx>0?pw/2:dx<0?-pw/2:0), cy=y+dy+(dy>0?ph/2:dy<0?-ph/2:0); if(clampIt){ cx=clamp(cx,pw/2+2,W-pw/2-2); cy=clamp(cy,ph/2+2,H-ph/2-2); } return [cx-pw/2,cy-ph/2,cx+pw/2,cy+ph/2]; };
      const cost=a=>(a[0]<2||a[1]<2||a[2]>W-2||a[3]>H-2?100:0)+B.filter(b=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1]).length*10+SG.filter(sg=>segHit(a,sg)).length*3;
      let best=null, bc=1e9; for(const [dx,dy] of cs){ const a=box(dx,dy,false), c=cost(a); if(c===0){ best=a; bc=0; break; } const a2=box(dx,dy,true), c2=cost(a2)+1; if(c2<bc){ bc=c2; best=a2; } }
      if(bc>0&&o.opt) return false;
      if(o.leader){ const nx=clamp(x,best[0],best[2]), ny=clamp(y,best[1],best[3]); if(Math.hypot(nx-x,ny-y)>26){ g.globalAlpha=.55; line(g,x,y,nx,ny,col,1); g.globalAlpha=1; } }
      B.push(best); if(o.bg!==false){ g.fillStyle=o.bgc||'rgba(10,14,18,.78)'; g.beginPath(); g.roundRect?g.roundRect(best[0],best[1],pw,ph,3):g.rect(best[0],best[1],pw,ph); g.fill(); }
      g.fillStyle=col||C.txt; g.textAlign='center'; g.textBaseline='middle'; g.fillText(s,(best[0]+best[2])/2,(best[1]+best[3])/2+0.5); g.textAlign='left'; g.textBaseline='alphabetic'; return true; } }; }
function arc(g,x,y,r,b1,b2,col,w){ // bearings in degrees (screen north up), shortest way
  const d=G.diff(b2,b1), a1=(b1-90)*D2R, a2=(b1+d-90)*D2R; g.strokeStyle=col; g.lineWidth=w||1.5; g.beginPath(); g.arc(x,y,r,Math.min(a1,a2),Math.max(a1,a2)); g.stroke(); }

/* ---------------- the figure ---------------- */
function frame(){ const W=ST.w, H=ST.h, ph=W<560, chip=el('chip'); let left=0;
  if(!ph&&chip&&getComputedStyle(chip).position==='absolute'&&chip.offsetWidth){ left=chip.offsetLeft+chip.offsetWidth+8; }
  const sh=S.mode==='earth'||S.mode==='pet'?(ph?78:70):(ph?84:70);
  return {W,H,ph,left,sh,top:ph?8:12,bot:H-sh}; }
function draw(){ if(!ST.w) return; const g=ST.ctx; g.setTransform(ST.dpr,0,0,ST.dpr,0,0); g.clearRect(0,0,ST.w,ST.h);
  FS=depth()==='instructor'?1.2:ST.w<420?0.92:1; const F=frame(), P=Placer(g,F.W,F.H);
  const chip=el('chip'); if(F.left) P.block(0,0,F.left-6,chip.offsetTop+chip.offsetHeight+4);
  if(S.mode==='solve') drawSolve(g,F,P); else if(S.mode==='off') drawOff(g,F,P); else if(S.mode==='earth') drawEarth(g,F,P); else drawPet(g,F,P);
  drawStrip(g,F); }

/* --- mode 1: wind triangle on a compass rose --- */
function drawSolve(g,F,P){ const s=sol(); GEO=null;
  const availH=F.bot-F.top-14, R=Math.max(60,Math.min(availH/2,(F.W-F.left)/2-16)), cx=F.left+Math.max((F.W-F.left)/2,R+16), cy=F.top+availH/2+7;
  /* rose: a dark compass card */
  const grd=g.createRadialGradient(cx,cy,R*0.15,cx,cy,R); grd.addColorStop(0,'rgba(18,26,33,.15)'); grd.addColorStop(1,'rgba(6,9,12,.6)'); dot(g,cx,cy,R,grd,C.ring,1.2);
  for(let b=0;b<360;b+=5){ const a=(b-90)*D2R, l=b%30===0?12:b%10===0?8:4, c=Math.cos(a), sn=Math.sin(a); line(g,cx+c*R,cy+sn*R,cx+c*(R-l),cy+sn*(R-l),b%30===0?'rgba(230,238,244,.75)':'rgba(214,226,236,.33)',b%30===0?1.4:1); }
  const card={0:'N',90:'E',180:'S',270:'W'}, cardNo={0:'N',90:'Ø',180:'S',270:'V'};
  for(let b=0;b<360;b+=30){ const a=(b-90)*D2R, x=cx+Math.cos(a)*(R-25), y=cy+Math.sin(a)*(R-25), lb=(LAB.lang==='no'?cardNo:card)[b]||String(b/10);
    txt(g,lb,x,y+4,card[b]?'#EEF3F7':'#9AA6B1','center',card[b]?12.5:11,card[b]?700:500); P.block(x-9,y-8,x+9,y+8); }
  /* magnetic north marker */
  { const a=(S.varE-90)*D2R, x=cx+Math.cos(a)*(R+1), y=cy+Math.sin(a)*(R+1); g.fillStyle='#C9B6F2'; g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a+2.7)*9,y+Math.sin(a+2.7)*9); g.lineTo(x+Math.cos(a-2.7)*9,y+Math.sin(a-2.7)*9); g.closePath(); g.fill();
    if(Math.abs(S.varE)>=1) P.put('MN',x,y,'#C9B6F2',{sz:10.5,c:[[0,-12],[S.varE>0?12:-12,-8]],font:MONO,opt:true}); }
  if(!s.ok){ P.put(L(t2('Not possible: the crosswind is stronger than the TAS','Ikke mulig: sidevinden er sterkere enn TAS')),cx,cy,C.red,{c:[[0,0]],sz:12.5}); return; }
  /* the triangle, air vector first: nose (heading, TAS) + wind = track and groundspeed */
  const sc=R*0.7/Math.max(s.gs,S.tas,1), X=(b,v)=>[cx+Math.sin(b*D2R)*v*sc,cy-Math.cos(b*D2R)*v*sc];
  const Hp=X(s.hdg,S.tas), Gp=X(s.trk,s.gs), O=[cx,cy];
  // thin extensions from the tips to the rose, ending in a bug on the card
  const toRing=b=>[cx+Math.sin(b*D2R)*(R-1),cy-Math.cos(b*D2R)*(R-1)];
  const eH=toRing(s.hdg), eT=toRing(s.trk); line(g,Hp[0],Hp[1],eH[0],eH[1],'rgba(127,203,232,.4)',1.1,[2,4]); line(g,Gp[0],Gp[1],eT[0],eT[1],'rgba(113,204,147,.45)',1.1,[2,4]);
  const bug=(b,col)=>{ const a=(b-90)*D2R, x=cx+Math.cos(a)*R, y=cy+Math.sin(a)*R; g.fillStyle=col; g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a+0.42)*11,y+Math.sin(a+0.42)*11); g.lineTo(x+Math.cos(a-0.42)*11,y+Math.sin(a-0.42)*11); g.closePath(); g.fill(); return [x,y]; };
  const bT=bug(s.trk,C.trk), bH=bug(s.hdg,C.hdg);
  // drift arc between heading and track
  const ra=R*0.42; if(Math.abs(s.drift)>=0.5) arc(g,cx,cy,ra,s.hdg,s.trk,'rgba(238,243,247,.75)',1.4);
  vec(g,cx,cy,Hp[0],Hp[1],C.hdg,1,2.8); vec(g,Hp[0],Hp[1],Gp[0],Gp[1],C.wind,3,2.6); vec(g,cx,cy,Gp[0],Gp[1],C.trk,2,3);
  dot(g,cx,cy,4,'#EEF3F7'); dot(g,Gp[0],Gp[1],4.5,'#0c1217',C.trk,2); dot(g,Hp[0],Hp[1],3.5,C.hdg);
  GEO={cx,cy,R,sc};
  for(const [a,b] of [[O,Hp],[Hp,Gp],[O,Gp],[Gp,eT],[Hp,eH]]) P.seg(a[0],a[1],b[0],b[1]);
  /* labels: each on the outer side of its own line */
  const side=Math.sign(G.diff(s.hdg,s.trk))||1;           // +1: heading is clockwise of track
  const out=(b,sg)=>{ const n=[Math.cos(b*D2R)*sg,Math.sin(b*D2R)*sg]; return [[n[0]*12,n[1]*12],[n[0]*26,n[1]*26],[n[0]*44,n[1]*44]]; };
  const at=(b,v)=>X(b,v);
  const io=(b)=>{ const u=[Math.sin(b*D2R),-Math.cos(b*D2R)], t=[-u[1],u[0]]; return [[u[0]*16,u[1]*16],[u[0]*16+t[0]*22,u[1]*16+t[1]*22],[u[0]*16-t[0]*22,u[1]*16-t[1]*22],[u[0]*30,u[1]*30]]; };
  P.put('HDG '+dg(s.hdg)+TT(),bH[0],bH[1],C.hdg,{sz:11.5,font:MONO,c:io(s.hdg)});
  P.put('TRK '+dg(s.trk)+TT(),bT[0],bT[1],C.trk,{sz:11.5,font:MONO,c:io(s.trk)});
  let q=at(s.hdg,S.tas*0.55); P.put(`TAS ${Math.round(S.tas)} kt`,q[0],q[1],C.hdg,{c:out(s.hdg,side),sz:12});
  q=at(s.trk,s.gs*0.55); P.put(`GS ${Math.round(s.gs)} kt`,q[0],q[1],C.trk,{c:out(s.trk,-side),sz:12});
  if(S.ws>0){ const wb=G.norm(S.wd+180), m=[(Hp[0]+Gp[0])/2,(Hp[1]+Gp[1])/2], away=[m[0]-cx,m[1]-cy], l=Math.hypot(...away)||1, u=[away[0]/l,away[1]/l];
    P.put(`W/V ${f3(S.wd)}/${Math.round(S.ws)}`,m[0],m[1],C.wind,{c:[...out(wb,1),...out(wb,-1),[u[0]*16,u[1]*16],[u[0]*34,u[1]*34],[0,-34],[0,34],...[60,80,100].map(k=>[Math.cos(wb*D2R)*k,Math.sin(wb*D2R)*k]),...[60,80,100].map(k=>[-Math.cos(wb*D2R)*k,-Math.sin(wb*D2R)*k]),[0,-56],[0,56],[0,-78],[0,78]],sz:12,leader:true}); }
  if(Math.abs(s.drift)>=0.5){ const bm=s.trk-s.drift/2, q2=[cx+Math.sin(bm*D2R)*ra,cy-Math.cos(bm*D2R)*ra];
    P.put(L(t2('drift ','avdrift '))+sgnLR(s.drift,1),q2[0],q2[1],'#EEF3F7',{sz:11.5,c:[...out(s.trk,-side).map(([a,b])=>[a*1.2,b*1.2]),...out(s.hdg,side)]}); }
}

/* --- mode 2: off track, the 1 in 60 rule (plan view, planned track left to right) --- */
function drawOff(g,F,P){ const o=offCalc(); GEO=null;
  const x0=F.left+(F.ph?26:44), x1=F.W-(F.ph?26:44), yc=F.top+(F.bot-F.top)*(S.off>=0?0.34:0.66), kx=(x1-x0)/S.dist;
  const room=(F.bot-F.top)*0.42, k=Math.max(1,Math.min(10,Math.floor(room/Math.max(Math.abs(S.off),0.5)/kx)));
  const A=[x0,yc], B=[x1,yc], Pp=[x0+o.flown*kx,yc+S.off*kx*k];
  // planned track
  line(g,A[0],A[1],B[0],B[1],'rgba(230,236,241,.85)',1.6);
  // parallel to the plan and the "carry on" extension
  line(g,Pp[0],Pp[1],x1,Pp[1],'rgba(201,210,218,.35)',1.1,[5,5]);
  const ex=[x1,yc+S.off*kx*k*(S.dist/o.flown)]; const exC=[Pp[0]+(ex[0]-Pp[0])*0.6,Pp[1]+(ex[1]-Pp[1])*0.6];
  g.save(); g.beginPath(); g.rect(0,F.top,F.W,F.bot-F.top-4); g.clip(); line(g,Pp[0],Pp[1],exC[0],exC[1],'rgba(113,204,147,.45)',1.4,[3,4]); g.restore();
  // flown track and the new track to B
  vec(g,A[0],A[1],Pp[0],Pp[1],C.trk,2,3); line(g,Pp[0],Pp[1],B[0],B[1],C.gc,2.6,[9,5]); arrow(g,Pp[0]+(B[0]-Pp[0])*0.55,Pp[1]+(B[1]-Pp[1])*0.55,Pp[0]+(B[0]-Pp[0])*0.56,Pp[1]+(B[1]-Pp[1])*0.56,C.gc,2.6);
  // off-track dimension
  line(g,Pp[0],yc,Pp[0],Pp[1],C.wind,1.4); for(const y of [yc,Pp[1]]) line(g,Pp[0]-5,y,Pp[0]+5,y,C.wind,1.4);
  // angle arcs (screen angles; the labels give the true values)
  const ang=(p,q)=>Math.atan2(q[1]-p[1],q[0]-p[0]);
  const sarc=(c,r,a1,a2,col)=>{ g.strokeStyle=col; g.lineWidth=1.6; g.beginPath(); g.arc(c[0],c[1],r,Math.min(a1,a2),Math.max(a1,a2)); g.stroke(); };
  if(Math.abs(S.off)>0.01){ sarc(A,46,0,ang(A,Pp),C.trk); sarc(B,46,Math.PI,ang(B,Pp)>0?ang(B,Pp):ang(B,Pp)+2*Math.PI,C.gc);
    const aE=ang(A,Pp), aN=ang(Pp,B); sarc(Pp,34,aE,aN,'#EEF3F7'); }
  // points and the aircraft
  for(const [p,n] of [[A,'A'],[B,'B']]){ dot(g,p[0],p[1],6,'#0c1217','#EEF3F7',2); }
  dot(g,Pp[0],Pp[1],F.ph?11:13,'rgba(12,18,23,.85)'); plane(g,Pp[0],Pp[1],90+Math.atan2(Pp[1]-A[1],Pp[0]-A[0])*R2D,F.ph?10:12,'#EEF3F7');
  // labels
  const dn=S.off>=0?-1:1; // the side of the plan line away from the aircraft
  P.put('A',A[0],A[1],C.txt,{c:[[0,dn*16],[-14,0]],font:MONO,bg:false}); P.put('B',B[0],B[1],C.txt,{c:[[0,dn*16],[14,0]],font:MONO,bg:false});
  P.put(L(t2('planned track ','planlagt track '))+dg(o.plan)+TT(),(A[0]+B[0])/2+(F.ph?0:40),yc,'rgba(230,236,241,.9)',{c:[[0,dn*16],[0,dn*34]],sz:11.5});
  P.put(nf(Math.abs(S.off),1)+' NM '+(S.off>=0?L(t2('right','høyre')):L(t2('left','venstre'))),Pp[0],(yc+Pp[1])/2,C.wind,{c:[[12,0],[-12,0]],sz:11.5});
  const deep=deepOn();
  P.put(`TE ${nf(Math.abs(o.te60),1)}°`+(deep?` (${nf(Math.abs(o.te),1)}°)`:''),A[0]+54,yc+(Pp[1]-yc)*0.25,C.trk,{c:[[8,S.off>=0?10:-10],[8,S.off>=0?26:-26],[-30,S.off>=0?44:-44],[-30,S.off>=0?64:-64]],sz:11.5,leader:true});
  P.put(`CA ${nf(Math.abs(o.ca60),1)}°`+(deep?` (${nf(Math.abs(o.ca),1)}°)`:''),B[0]-54,yc+(Pp[1]-yc)*0.25,C.gc,{c:[[-8,S.off>=0?10:-10],[-8,S.off>=0?26:-26],[-8,S.off>=0?44:-44],[-30,S.off>=0?64:-64]],sz:11.5,leader:true});
  P.put(L(t2('turn ','sving '))+nf(Math.abs(o.turn60),1)+'° '+(o.turn60>=0?L(t2('left','venstre')):L(t2('right','høyre'))),Pp[0]+30,Pp[1],'#EEF3F7',{c:[[14,dn*-14],[14,dn*-30],[0,-dn*28]],sz:12});
  P.put(L(t2('flown ','fløyet '))+nf(o.flown,0)+' NM',(A[0]+Pp[0])/2,yc,C.mut,{c:[[0,dn*16],[0,dn*34]],sz:11,font:MONO,bg:false,opt:true});
  P.put(L(t2('to go ','igjen '))+nf(o.togo,0)+' NM',(Pp[0]+B[0])/2,yc,C.mut,{c:[[0,dn*16],[0,dn*34]],sz:11,font:MONO,bg:false,opt:true});
  P.put(L(t2('parallel','parallell')),x1-30,Pp[1],C.mut,{c:[[-10,dn*-12],[-10,dn*12]],sz:10.5,font:MONO,bg:false,opt:true});
  if(k>1) txt(g,L(t2(`sideways scale ×${k}`,`sideskala ×${k}`)),F.W-12,F.bot-10,C.dim,'right',10.5);
}

/* --- mode 3 (Deep dive): Earth and charts --- */
function drawEarth(g,F,P){ const R=routeCalc(); GEO=null; const A=R.A, B=R.B, lon0=A[1]+G.diff(B[1],A[1])/2;
  const gc=G.gcPoints(A[0],A[1],B[0],B[1],160), rl=G.rhumbPoints(A[0],A[1],B[0],B[1],160);
  const x0=F.left+10, x1=F.W-10, y0=F.top+6, y1=F.bot-10, cw=x1-x0, chh=y1-y0, cxm=(x0+x1)/2, cym=(y0+y1)/2;
  let Pj, X, Y, vis=()=>true;
  if(S.proj==='globe'){ const mid=gc[80]; Pj=G.projection('globe',{lat0:clamp(mid[0],-60,60)+8,lon0:mid[1]}); const base=Math.min(cw,chh)/2-6, pp=gc.concat(rl).map(q=>Pj.f(q[0],q[1])), ext=Math.max(Math.max(...pp.map(q=>q[0]))-Math.min(...pp.map(q=>q[0])),Math.max(...pp.map(q=>q[1]))-Math.min(...pp.map(q=>q[1])),1e-3), Rg=Math.min(base*3.5,Math.max(base,base*1.1/ext));
    const qm=Pj.f(mid[0],mid[1]), zx=Rg>base?qm[0]*Rg:0, zy=Rg>base?qm[1]*Rg:0; X=q=>cxm+q[0]*Rg-zx; Y=q=>cym-q[1]*Rg+zy; vis=q=>q[2];
    const gr=g.createRadialGradient(cxm-zx-Rg*0.35,cym+zy-Rg*0.4,Rg*0.1,cxm-zx,cym+zy,Rg); gr.addColorStop(0,'#2b3a48'); gr.addColorStop(1,'#141d26'); g.save(); g.beginPath(); g.rect(x0-10,y0-6,cw+20,chh+16); g.clip(); dot(g,cxm-zx,cym+zy,Rg,gr,'rgba(214,226,236,.35)',1.2); g.restore(); }
  else { const o={lon0}; if(S.proj==='lcc'){ const [s1,s2]=G.lccParallels(A[0],B[0]); o.s1=s1; o.s2=s2; } Pj=G.projection(S.proj,o);
    const pts=gc.concat(rl).map(([la,lo])=>Pj.f(la,lo)); let ax=Math.min(...pts.map(p=>p[0])), bx=Math.max(...pts.map(p=>p[0])), ay=Math.min(...pts.map(p=>p[1])), by=Math.max(...pts.map(p=>p[1]));
    let sx=bx-ax, sy=by-ay; const mn=Math.max(sx,sy,0.05)*0.5; if(sx<mn){ ax-=(mn-sx)/2; bx+=(mn-sx)/2; } if(sy<mn){ ay-=(mn-sy)/2; by+=(mn-sy)/2; } sx=bx-ax; sy=by-ay;
    const sc=Math.min(cw/(sx*1.36),chh/(sy*1.36)), ox=cxm-(ax+bx)/2*sc, oy=cym+(ay+by)/2*sc; X=q=>ox+q[0]*sc; Y=q=>oy-q[1]*sc; }
  const poly=(arr,col,w,dash)=>{ g.strokeStyle=col; g.lineWidth=w; g.setLineDash(dash||[]); g.beginPath(); let pen=false;
    for(const [la,lo] of arr){ const q=Pj.f(la,lo), x=X(q), y=Y(q); if(!vis(q)||!isFinite(x)||!isFinite(y)||Math.abs(x)>1e5||Math.abs(y)>1e5){ pen=false; continue; } pen?g.lineTo(x,y):g.moveTo(x,y); pen=true; } g.stroke(); g.setLineDash([]); };
  g.save(); g.beginPath(); g.rect(x0-10,y0-6,cw+20,chh+16); g.clip();
  const span=Math.max(Math.abs(A[0]-B[0]),Math.abs(G.diff(B[1],A[1]))), stp=S.proj==='globe'?15:span<25?5:10, gl=[];
  const latMax=S.proj==='merc'?80:89;
  for(let la=-80;la<=80;la+=stp){ const a=[]; for(let d=-180;d<=180;d+=2) a.push([la,lon0+d]); poly(a,la===0?'rgba(200,215,225,.32)':C.grid,la===0?1.3:1); gl.push(['p',la]); }
  for(let m=-180;m<180;m+=stp){ const a=[]; for(let la=-latMax;la<=latMax;la+=1) a.push([la,m]); poly(a,C.grid,1); gl.push(['m',m]); }
  // the meridians through A and B: the angle between them on the chart is the chart convergency
  for(const lo of [A[1],B[1]]){ const a=[]; for(let la=-latMax;la<=latMax;la+=0.5) a.push([la,lo]); poly(a,'rgba(214,226,236,.42)',1.2,[4,4]); }
  if(S.proj==='lcc'){ for(const sp of [Pj.s1,Pj.s2]){ const a=[]; for(let d=-180;d<=180;d+=1) a.push([sp,lon0+d]); poly(a,'rgba(240,180,64,.6)',1.2,[8,5]); } }
  if(S.proj!=='globe'){ const qa=Pj.f(A[0],A[1]), qb=Pj.f(B[0],B[1]); line(g,X(qa),Y(qa),X(qb),Y(qb),'rgba(201,210,218,.5)',1,[2,3]); }
  poly(rl,C.rl,2.4,[8,5]); poly(gc,C.gc,3);
  g.restore();
  const pA=Pj.f(A[0],A[1]), pB=Pj.f(B[0],B[1]), PA=[X(pA),Y(pA)], PB=[X(pB),Y(pB)];
  for(const p of [PA,PB]) dot(g,p[0],p[1],5.5,'#0c1217','#EEF3F7',2);
  // labels: points, then the lines, then the grid
  const away=(p,q)=>{ const dx=p[0]-q[0], dy=p[1]-q[1], l=Math.hypot(dx,dy)||1; return [dx/l,dy/l]; };
  const ua=away(PA,PB), ub=away(PB,PA);
  P.put(R.na,PA[0],PA[1],C.txt,{c:[[ua[0]*16,ua[1]*16],[ua[0]*16,ua[1]*16-14],[0,16],[0,-16]],font:MONO,sz:12});
  P.put(R.nb,PB[0],PB[1],C.txt,{c:[[ub[0]*16,ub[1]*16],[ub[0]*16,ub[1]*16-14],[0,-16],[0,16]],font:MONO,sz:12});
  const gm=Pj.f(...gc[80]), rm=Pj.f(...rl[80]), GM=[X(gm),Y(gm)], RM=[X(rm),Y(rm)], sep=away(GM,RM);
  P.put(L(t2('great circle','storsirkel'))+' '+nf(R.gc,0)+' NM',GM[0],GM[1],C.gc,{c:[[sep[0]*14||0,(sep[1]||-1)*14],[sep[0]*30,(sep[1]||-1)*30],[0,-16],[0,16]],sz:11.5});
  P.put(L(t2('rhumb line','loksodrom'))+' '+nf(R.rl,0)+' NM',RM[0],RM[1],C.rl,{c:[[-sep[0]*14||0,(-sep[1]||1)*14],[-sep[0]*30,(-sep[1]||1)*30],[0,16],[0,-16]],sz:11.5});
  if(Math.abs(R.dlong)>0.5){ P.put('GC '+dg(R.ini),PA[0],PA[1],C.gc,{c:[[-ua[0]*0+ (ua[0]>0?14:-14),22],[(ua[0]>0?14:-14),-22]],sz:10.5,font:MONO,opt:true}); P.put('GC '+dg(R.fin),PB[0],PB[1],C.gc,{c:[[(ub[0]>0?14:-14),22],[(ub[0]>0?14:-14),-22]],sz:10.5,font:MONO,opt:true}); }
  if(S.proj==='lcc'){ const q=Pj.f(Pj.s2,lon0+G.diff(B[1],A[1])*0.9); P.put(L(t2('standard parallels','standardparalleller')),X(q),Y(q),'#F0C470',{sz:10.5,c:[[0,-12],[0,12]],opt:true}); }
  // grid labels: only where they fit
  for(const [k,v] of gl){ let q; if(k==='p'){ if(v<0) continue; q=Pj.f(v,S.proj==='globe'?lon0:(G.diff(B[1],A[1])>0?A[1]:B[1])-stp*0.4); } else q=Pj.f(S.proj==='globe'?0:Math.max(0,Math.min(A[0],B[0])-stp),v);
    if(!vis(q)) continue; const x=X(q), y=Y(q); if(x<x0||x>x1||y<y0||y>y1) continue;
    P.put(k==='p'?v+'°'+(v>0?'N':''):Math.abs(G.diff(v,0))+'°'+(G.diff(v,0)<0?'W':G.diff(v,0)>0?(LAB.lang==='no'?'Ø':'E'):''),x,y,'#6F7E8B',{sz:9.5,font:MONO,c:[[4,-4]],bg:false,opt:true}); }
}

/* --- mode 4 (Deep dive): PET and PNR, a time-distance graph --- */
function drawPet(g,F,P){ const R=petCalc(); GEO=null; const D=S.dist;
  const x0=F.left+(F.ph?44:60), x1=F.W-(F.ph?14:24), y0=F.top+(F.ph?14:20), y1=F.bot-(F.ph?30:34), X=d=>x0+d/D*(x1-x0);
  if(!(R.Of>0&&R.Hf>0&&R.On>0&&R.Hn>0)){ P.put(L(t2('The wind is too strong for this TAS','Vinden er for sterk for denne TAS-en')),(x0+x1)/2,(y0+y1)/2,C.red,{c:[[0,0]]}); return; }
  const tA=D/R.Hf*60, tB=D/R.Of*60, tmax=Math.max(tA,tB)*1.08, Y=t=>y1-t/tmax*(y1-y0);
  line(g,x0,y0,x0,y1,'rgba(214,226,236,.35)',1); line(g,x0,y1,x1,y1,'rgba(214,226,236,.35)',1);
  const st=tmax>300?60:tmax>150?30:tmax>60?15:tmax>30?10:5;
  for(let t=st;t<=tmax;t+=st){ line(g,x0+1,Y(t),x1,Y(t),C.grid,1); txt(g,hm(t),x0-6,Y(t)+4,C.dim,'right',10); }
  const ds=D>800?200:D>300?100:D>120?50:D>50?20:10; for(let d=0;d<=D-ds*0.3||d===0;d+=ds){ line(g,X(d),y1,X(d),y1+4,'rgba(214,226,236,.35)',1); txt(g,String(d),X(d),y1+15,C.dim,'center',10); }
  txt(g,L(t2('distance from A (NM)','distanse fra A (NM)')),(x0+x1)/2,y1+(F.ph?28:30),C.dim,'center',10);
  line(g,X(0),Y(0),X(D),Y(tA),C.rl,2.6); line(g,X(0),Y(tB),X(D),Y(0),C.wind,2.6);
  const xp=X(R.pet.dist), yp=Y(R.pet.tAfter); line(g,xp,yp,xp,y1,'rgba(228,107,174,.7)',1.3,[4,4]); dot(g,xp,yp,5.5,C.gc,'#0c1217',1.5);
  const pnrIn=R.pnr.dist<=D; if(pnrIn){ const xn=X(R.pnr.dist); line(g,xn,y0,xn,y1,'rgba(236,90,71,.75)',1.4,[6,4]); P.put('PNR',xn,y0+6,C.red,{c:[[0,8],[10,8]],sz:11,font:MONO}); }
  P.put(L(t2('time back to A','tid tilbake til A')),X(D*0.86),Y(tA*0.86),C.rl,{c:[[-8,-14],[-8,14],[0,-24]],sz:11.5});
  P.put(L(t2('time on to B','tid videre til B')),X(D*0.12),Y(tB*0.88),C.wind,{c:[[8,-14],[8,14],[0,-24]],sz:11.5});
  P.put(`PET ${nf(R.pet.dist,0)} NM`,xp,yp,C.gc,{c:[[0,-18],[12,-14],[-12,-14],[0,18]],sz:12});
  txt(g,L(t2('time to reach A or B after a failure at this point','tid til A eller B etter en feil på dette punktet')),x0+6,y0+4,C.dim,'left',10);
}

/* --- the leg strip along the bottom of the figure --- */
function drawStrip(g,F){ const y0=F.bot, H=F.H, W=F.W; g.fillStyle='rgba(6,9,12,.55)'; g.fillRect(0,y0,W,H-y0); line(g,0,y0+0.5,W,y0+0.5,'rgba(255,255,255,.07)',1);
  const s=sol(), lx0=F.ph?22:30, lx1=W-(F.ph?22:30), ly=y0+(F.ph?50:42);
  const ends=(a,b)=>{ dot(g,lx0,ly,4.5,'#0c1217','#EEF3F7',1.8); dot(g,lx1,ly,4.5,'#0c1217','#EEF3F7',1.8); txt(g,a,lx0,ly+18,C.mut,'center',10.5); txt(g,b,lx1,ly+18,C.mut,'center',10.5); };
  const head=(l,r)=>{ txt(g,l,lx0-8,y0+18,'#AEB8C1','left',11,600); txt(g,r,lx1+8,F.ph?y0+34:y0+18,C.txt,'right',11.5,500); };
  if(S.mode==='solve'){ const t=G.legTime(S.dist,s.ok?s.gs:0), fu=G.legFuel(t,S.ff);
    head(L(t2('LEG','ETAPPE'))+'  '+nf(S.dist,0)+' NM',`GS ${s.ok?Math.round(s.gs):'–'} kt · ${L(t2('time','tid'))} ${hm(t)} · ${L(t2('fuel','drivstoff'))} ${kg(fu)}`);
    line(g,lx0,ly,lx1,ly,'rgba(113,204,147,.8)',2);
    if(isFinite(t)&&t>0){ const st=t>240?60:t>120?30:t>40?10:t>15?5:1; for(let m=st;m<t-st*0.35;m+=st){ const x=lx0+(lx1-lx0)*m/t; line(g,x,ly-5,x,ly+5,'rgba(214,226,236,.6)',1); if(!F.ph&&(lx1-lx0)*st/t>34) txt(g,m<60?m+'′':hm(m),x,ly-9,C.dim,'center',9.5); } }
    plane(g,lx0+16,ly,90,7,'#EEF3F7'); ends('A','B'); return; }
  if(S.mode==='off'){ const o=offCalc(), f=o.flown/S.dist, xp=lx0+(lx1-lx0)*f;
    head(L(t2('LEG','ETAPPE'))+'  '+nf(S.dist,0)+' NM',`${L(t2('to B','til B'))} ${nf(o.dToB,0)} NM · ${hm(o.tB)} · ${kg(o.fuel)}`);
    line(g,lx0,ly,xp,ly,C.trk,2); line(g,xp,ly,lx1,ly,'rgba(228,107,174,.85)',2,[6,4]); plane(g,xp,ly,90,7,'#EEF3F7'); ends('A','B'); return; }
  if(S.mode==='earth'){ const R=routeCalc(), mx=Math.max(R.gc,R.rl), bw=lx1-lx0, tas=S.tas, dT=(R.rl-R.gc)/tas*60;
    head(L(t2('GREAT CIRCLE vs RHUMB LINE','STORSIRKEL mot LOKSODROM')),`${L(t2('saves','sparer'))} ${nf(R.rl-R.gc,R.rl-R.gc<10?1:0)} NM · ${dT>=60?hm(dT)+' h':nf(dT,1)+' min'} · ${kg(G.legFuel(dT,S.ff))}`);
    const yb=ly-6; g.fillStyle=C.gc; g.fillRect(lx0,yb,bw*R.gc/mx,4); g.fillStyle=C.rl; g.fillRect(lx0,yb+9,bw*R.rl/mx,4);
    txt(g,L(t2('at TAS ','ved TAS '))+tas+' kt',lx1,ly+22,C.dim,'right',10); return; }
  const R=petCalc(), D=S.dist, X=d=>lx0+clamp(d/D,0,1)*(lx1-lx0);
  head(L(t2('SECTOR','ETAPPE'))+'  '+nf(D,0)+' NM',`PET ${isFinite(R.pet.dist)?nf(R.pet.dist,0):'–'} NM · PNR ${isFinite(R.pnr.dist)?(R.pnr.dist>D?'> B':nf(R.pnr.dist,0)+' NM'):'–'}`);
  line(g,lx0,ly,lx1,ly,'rgba(230,236,241,.75)',2); line(g,X(D/2),ly-4,X(D/2),ly+4,C.mut,1);
  if(isFinite(R.pet.dist)){ const x=X(R.pet.dist); g.fillStyle=C.gc; g.beginPath(); g.moveTo(x,ly-3); g.lineTo(x-6,ly-13); g.lineTo(x+6,ly-13); g.closePath(); g.fill(); txt(g,'PET',x+9,ly-5,C.gc,'left',10,600); }
  if(isFinite(R.pnr.dist)){ const x=X(Math.min(R.pnr.dist,D)); g.fillStyle=C.red; g.beginPath(); g.moveTo(x,ly+3); g.lineTo(x-6,ly+13); g.lineTo(x+6,ly+13); g.closePath(); g.fill(); txt(g,R.pnr.dist>D?'PNR →':'PNR',x+(R.pnr.dist>D?-9:9),ly+14,C.red,R.pnr.dist>D?'right':'left',10,600); }
  const wc=G.windComp(sol().trk,S.wd,S.ws).head; if(Math.abs(wc)>=1&&!F.ph){ const xm=(lx0+lx1)/2-120, d=wc>0?-1:1; arrow(g,xm-d*16,y0+14,xm+d*16,y0+14,C.wind,1.8); txt(g,Math.round(Math.abs(wc))+' kt '+(wc>0?L(t2('headwind out','motvind ut')):L(t2('tailwind out','medvind ut'))),xm+24,y0+18,C.wind,'left',10.5); }
  ends('A','B'); }

/* ---------------- readout chip, legend, "what you're seeing" ---------------- */
const ch=(i,b,cls)=>`<span><i>${i}</i><b${cls?` class="${cls}"`:''}>${b}</b></span>`;
function readout(){ const s=sol(), d=deepOn(); let h='';
  if(S.mode==='solve'){ if(!s.ok){ h=ch(L(t2('Wind triangle','Vindtrekant')),L(t2('not possible','ikke mulig')),'r'); }
    else { const hm_=G.toMag(s.hdg,S.varE), lg=leg();
      h=ch(L(t2('Heading (T)','Heading (R)')),dg(s.hdg))+ch(L(t2('Heading (M)','Heading (M)')),dg(hm_),'a')+(d&&S.dev?ch(L(t2('Heading (C)','Heading (K)')),dg(G.toCompass(hm_,S.dev))):'')
       +ch(L(t2('Track (T)','Track (R)')),dg(s.trk))+ch(L(t2('Groundspeed','Groundspeed')),Math.round(s.gs)+' kt')+ch(L(t2('Drift','Avdrift')),sgnLR(s.drift,1))
       +ch(L(t2('Leg time','Etappetid')),hm(lg.t))+ch(L(t2('Fuel','Drivstoff')),kg(lg.fuel)); } }
  else if(S.mode==='off'){ const o=offCalc();
    h=ch(L(t2('Track error','Trackfeil')),nf(Math.abs(o.te60),1)+'°'+(d?` <small>(${nf(Math.abs(o.te),1)}°)</small>`:''))+ch(L(t2('Closing angle','Lukkevinkel')),nf(Math.abs(o.ca60),1)+'°'+(d?` <small>(${nf(Math.abs(o.ca),1)}°)</small>`:''))
     +ch(L(t2('Turn to B','Sving mot B')),nf(Math.abs(o.turn60),1)+'° '+(o.turn60>=0?L(t2('left','venstre')):L(t2('right','høyre'))))
     +ch(L(t2('New track (T)','Ny track (R)')),dg(o.newTrk))+ch(L(t2('New heading (M)','Ny heading (M)')),o.nh.ok?dg(G.toMag(o.nh.hdg,S.varE)):'–','a')+ch(L(t2('Time to B','Tid til B')),hm(o.tB)); }
  else if(S.mode==='earth'){ const R=routeCalc();
    h=ch(L(t2('Great circle','Storsirkel')),nf(R.gc,0)+' NM')+ch(L(t2('Rhumb line','Loksodrom')),nf(R.rl,0)+' NM')+ch(L(t2('GC track','Storsirkeltrack')),dg(R.ini)+' → '+dg(R.fin))
     +ch(L(t2('Rhumb-line track','Loksodromtrack')),dg(R.rlTrk))+ch(L(t2('Convergency','Konvergens')),nf(Math.abs(R.conv),1)+'°')+ch(L(t2('Conversion angle','Konverteringsvinkel')),nf(Math.abs(R.conversion),1)+'°'); }
  else { const R=petCalc();
    h=ch(L(t2('GS on / back','GS videre / tilbake')),`${Math.round(R.Of)} / ${Math.round(R.Hf)} kt`)+ch('PET',isFinite(R.pet.dist)?nf(R.pet.dist,0)+' NM':'–','a')+ch(L(t2('Time to PET','Tid til PET')),hm(R.pet.tTo))
     +ch(L(t2('Safe endurance','Sikker utholdenhet')),hm(R.E*60))+ch('PNR',isFinite(R.pnr.dist)?(R.pnr.dist>S.dist?L(t2('beyond B','forbi B')):nf(R.pnr.dist,0)+' NM'):'–','r')+ch(L(t2('Time to PNR','Tid til PNR')),hm(R.pnr.t)); }
  el('chip').innerHTML=h;
  el('xsv').textContent=`${S.tas} kt · ${S.know==='trk'?'TRK':'HDG'} ${f3(S.know==='trk'?S.trk:S.hdg)} · W/V ${f3(S.wd)}/${S.ws}`;
  earthRo(); }
function earthRo(){ const b=el('routeH'); if(!b||S.mode!=='earth') return; const R=routeCalc(), Pj=projOf(R), d=deepOn();
  const kA=Pj.k?Pj.k(R.A[0]):1, kB=Pj.k?Pj.k(R.B[0]):1;
  b.innerHTML=`<div class="ro2">`+[[t2('Departure (mean lat)','Departure (middelbredde)'),nf(G.departure(R.dlong,R.mlat),0)+' NM'],[t2('Convergency, dlong × sin(mean lat)','Konvergens, dlong × sin(middelbredde)'),nf(Math.abs(R.convApprox),2)+'°'],[t2('Convergency, exact','Konvergens, eksakt'),nf(Math.abs(R.conv),2)+'°'],
    ...(S.proj==='globe'?[]:[[t2('Chart convergency','Kartkonvergens'),nf(Math.abs(Pj.chartConv(R.dlong)),1)+'°'],[t2('Scale at A / B','Målestokk ved A / B'),nf(kA,3)+' / '+nf(kB,3)]])].map(([k,v])=>`<div class="rrow"><span>${L(k)}</span><b>${v}</b></div>`).join('')+`</div>`; }
function projOf(R){ const lon0=R.A[1]+G.diff(R.B[1],R.A[1])/2; if(S.proj==='lcc'){ const [s1,s2]=G.lccParallels(R.A[0],R.B[0]); return G.projection('lcc',{lon0,s1,s2}); } return G.projection(S.proj,{lon0}); }
function legend(){ const lg=(c,t,k)=>`<span><i class="${k||''}" style="--c:${c}">${k==='chev'?'›'.repeat(t[1]):''}</i>${L(k==='chev'?t[0]:t)}</span>`; let s='';
  if(S.mode==='solve') s=lg(C.hdg,[t2('heading and TAS','heading og TAS'),1],'chev')+lg(C.trk,[t2('track and groundspeed','track og groundspeed'),2],'chev')+lg(C.wind,[t2('wind','vind'),3],'chev')+lg('#C9B6F2',t2('MN: magnetic north','MN: magnetisk nord'),'dot');
  else if(S.mode==='off') s=lg('#E6ECF1',t2('planned track','planlagt track'))+lg(C.trk,t2('track flown','fløyet track'))+lg(C.gc,t2('new track to B','ny track til B'),'d')+lg(C.wind,t2('distance off track','avstand ut av track'));
  else if(S.mode==='earth') s=lg(C.gc,t2('great circle','storsirkel'))+lg(C.rl,t2('rhumb line','loksodrom'),'d')+(S.proj!=='globe'?lg('#C9D2DA',t2('straight ruler line','rett linjal-linje'),'d'):'')+lg('#D6E2EC',t2('meridians of A and B','meridianene til A og B'),'d')+(S.proj==='lcc'?lg(C.wind,t2('standard parallels','standardparalleller'),'d'):'');
  else s=lg(C.rl,t2('time back to A','tid tilbake til A'))+lg(C.wind,t2('time on to B','tid videre til B'))+lg(C.gc,t2('PET','PET'),'dot')+lg(C.red,t2('PNR','PNR'),'d');
  el('vleg').innerHTML=s; }
function see(){ const s=sol(); let t;
  if(S.mode==='solve') t= !s.ok? t2('<b>No solution:</b> the crosswind is at least as strong as the TAS, so no heading can hold this track.','<b>Ingen løsning:</b> sidevinden er minst like sterk som TAS, så ingen heading kan holde denne tracken.')
    : S.know==='trk'? t2(`<b>What you're seeing:</b> the wind (amber) blows you off the line, so the nose (blue) points ${nf(Math.abs(s.wca),1)}° into wind to make good the track (green). Green = blue + amber.`,`<b>Det du ser:</b> vinden (oransje) blåser deg av linjen, så nesen (blå) peker ${nf(Math.abs(s.wca),1)}° opp i vinden for å holde tracken (grønn). Grønn = blå + oransje.`)
    : t2(`<b>What you're seeing:</b> you hold heading ${dg(s.hdg)}; the wind carries you ${nf(Math.abs(s.drift),1)}° ${s.drift>=0?'right':'left'}, so the track over the ground is ${dg(s.trk)}.`,`<b>Det du ser:</b> du holder heading ${dg(s.hdg)}; vinden fører deg ${nf(Math.abs(s.drift),1)}° til ${s.drift>=0?'høyre':'venstre'}, så tracken over bakken er ${dg(s.trk)}.`);
  else if(S.mode==='off'){ const o=offCalc(); t=t2(`<b>What you're seeing:</b> ${nf(Math.abs(S.off),1)} NM off after ${nf(o.flown,0)} NM is a ${nf(Math.abs(o.te60),1)}° track error. Turn by track error + closing angle (${nf(Math.abs(o.turn60),1)}°) to reach B, or by the track error alone to fly parallel.`,`<b>Det du ser:</b> ${nf(Math.abs(S.off),1)} NM ut etter ${nf(o.flown,0)} NM er ${nf(Math.abs(o.te60),1)}° trackfeil. Sving trackfeil + lukkevinkel (${nf(Math.abs(o.turn60),1)}°) for å nå B, eller bare trackfeilen for å fly parallelt.`); }
  else if(S.mode==='earth'){ const R=routeCalc(); t= S.proj==='merc'? t2('<b>Mercator:</b> the meridians are parallel, so the rhumb line is straight and the great circle bows towards the pole.','<b>Mercator:</b> meridianene er parallelle, så loksodromen er rett og storsirkelen buer mot polen.')
    : S.proj==='lcc'? t2('<b>Lambert conformal:</b> a straight line is very nearly a great circle, and the meridians converge almost as on the Earth.','<b>Lambert konform:</b> en rett linje er nesten en storsirkel, og meridianene konvergerer nesten som på jorden.')
    : S.proj==='polar'? t2('<b>Polar stereographic:</b> meridians are straight lines from the pole; near the pole a great circle is almost straight.','<b>Polar stereografisk:</b> meridianene er rette linjer fra polen; nær polen er en storsirkel nesten rett.')
    : t2(`<b>On the globe:</b> the great circle starts at ${dg(R.ini)} and ends at ${dg(R.fin)}; the rhumb line holds ${dg(R.rlTrk)} all the way and lies on the equator side.`,`<b>På globusen:</b> storsirkelen starter på ${dg(R.ini)} og slutter på ${dg(R.fin)}; loksodromen holder ${dg(R.rlTrk)} hele veien og ligger på ekvatorsiden.`); }
  else t=t2('<b>What you\'re seeing:</b> after a failure at any point, the blue line is the time back to A and the amber line the time on to B. Where they cross is the PET; past the PNR you can no longer return to A with the reserves.','<b>Det du ser:</b> etter en feil på et hvilket som helst punkt er den blå linjen tiden tilbake til A og den oransje tiden videre til B. Der de krysser, er PET; etter PNR kan du ikke lenger snu tilbake til A med reservene.');
  el('xsee').innerHTML=L(t); }

/* ---------------- tabs and tools ---------------- */
const VIEWS=[['solve',t2('Find heading and GS','Finn heading og GS')],['off',t2('Off track (1 in 60)','Ut av track (1 av 60)')],['earth',t2('Earth and charts','Jorden og kart'),1],['pet',t2('PET and PNR','PET og PNR'),1]];
const PROJ=[['globe',t2('Globe','Globus')],['merc',t2('Mercator','Mercator')],['lcc',t2('Lambert','Lambert')],['polar',t2('Polar','Polar')]];
function drawTabs(){ el('vtabs').innerHTML=VIEWS.map(([k,t,dp])=>`<button type="button" role="tab" data-v="${k}" class="${dp?'dp ':''}${k===S.mode?'on':''}" aria-selected="${k===S.mode}">${L(t)}</button>`).join('');
  el('vtools').innerHTML=S.mode==='earth'?PROJ.map(([k,t])=>`<button type="button" data-p="${k}" class="${S.proj===k?'on':''}" aria-pressed="${S.proj===k}">${L(t)}</button>`).join(''):''; }
el('vtabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setMode(b.dataset.v); });
el('vtools').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b&&b.dataset.p){ S.proj=b.dataset.p; drawTabs(); upd(); } });
function setMode(m){ if(!VIEWS.some(v=>v[0]===m)) m='solve'; S.mode=m; el('xpanel').querySelectorAll('[data-pv]').forEach(d=>{ d.hidden=d.dataset.pv!==m; }); drawTabs(); upd(); }

/* ---------------- controls ---------------- */
LAB.add({},{'True airspeed (TAS)':'Sann flyfart (TAS)','Desired track (true)':'Ønsket track (rettvisende)','Heading (true)':'Heading (rettvisende)','Wind from (true)':'Vind fra (rettvisende)','Wind speed':'Vindstyrke','Variation':'Misvisning','Distance':'Distanse','Fuel flow':'Drivstofforbruk','Distance flown':'Distanse fløyet','Off track':'Ut av track','TAS after the failure':'TAS etter feilen','Fuel above reserves':'Drivstoff over reservene','Compass deviation (this heading)':'Deviasjon (denne headingen)','Flight level':'Flygenivå','Mach number':'Machtall','Temperature vs ISA':'Temperatur mot ISA'});
LAB.add({},{'You know the…':'Du kjenner …','Desired track':'Ønsket track','Heading':'Heading'});
const knowSeg=(()=>{ const box=el('knowSeg'); const lab=document.createElement('div'); lab.className='grp'; box.before(lab); const d=()=>{ lab.textContent=L(t2('You know the…','Du kjenner …')); }; d(); LAB.onLang(d);
  return LAB.seg(box,[['trk','Desired track'],['hdg','Heading']],S.know,v=>{ const s=sol(); if(v==='hdg'){ S.hdg=Math.round(s.hdg); sl.hdg.set(S.hdg); } else { S.trk=Math.round(s.trk); sl.trk.set(S.trk); } S.know=v; showKnow(); upd(); }); })();
const sl={};
const fV=v=>(v>0?'+':'')+v;
sl.tas=LAB.slider(el('cCtl'),{label:'True airspeed (TAS)',min:60,max:520,step:5,v:S.tas,f:v=>v+' kt',on:v=>{ S.tas=v; capCtas(); upd(); }});
sl.trk=LAB.slider(el('cCtl'),{label:'Desired track (true)',min:1,max:360,step:1,v:S.trk,f:v=>dg(v),on:v=>{ S.trk=v; upd(); }});
sl.hdg=LAB.slider(el('cCtl'),{label:'Heading (true)',min:1,max:360,step:1,v:S.hdg,f:v=>dg(v),on:v=>{ S.hdg=v; upd(); }});
sl.wd=LAB.slider(el('cCtl'),{label:'Wind from (true)',min:5,max:360,step:5,v:S.wd,f:v=>dg(v),on:v=>{ S.wd=v; upd(); }});
sl.ws=LAB.slider(el('cCtl'),{label:'Wind speed',min:0,max:150,step:1,v:S.ws,f:v=>v+' kt',on:v=>{ S.ws=v; upd(); }});
sl.var=LAB.slider(el('cCtl'),{label:'Variation',min:-20,max:20,step:1,v:S.varE,f:v=>v===0?'0°':Math.abs(v)+'° '+(v>0?L(t2('E','Ø')):L(t2('W','V'))),on:v=>{ S.varE=v; upd(); }});
sl.dist=LAB.slider(el('legCtl'),{label:'Distance',min:0,max:LDIST.length-1,step:1,v:idx(LDIST,S.dist),f:i=>LDIST[i]+' NM',on:i=>{ S.dist=LDIST[i]; capFlown(); upd(); }});
sl.ff=LAB.slider(el('legCtl'),{label:'Fuel flow',min:0,max:LFF.length-1,step:1,v:idx(LFF,S.ff),f:i=>LFF[i]+(LAB.lang==='no'?' kg/t':' kg/h'),on:i=>{ S.ff=LFF[i]; upd(); }});
sl.flown=LAB.slider(el('offCtl'),{label:'Distance flown',min:2,max:S.dist-2,step:1,v:S.flown,f:v=>v+' NM',on:v=>{ S.flown=v; upd(); }});
sl.off=LAB.slider(el('offCtl'),{label:'Off track',min:-20,max:20,step:0.5,v:S.off,f:v=>v===0?'0 NM':nf(Math.abs(v),1)+' NM '+(v>0?L(t2('right','høyre')):L(t2('left','venstre'))),on:v=>{ S.off=v; upd(); }});
const CASES=[['all',t2('All engines','Alle motorer'),1],['oei',t2('One engine out','Én motor ute'),0.8],['dep',t2('Depressurised','Trykkløs'),0.7]];
function drawCases(){ el('casePre').innerHTML=CASES.map(([k,t])=>`<button type="button" class="btn${S.cs===k?' pri':''}" data-c="${k}">${L(t)}</button>`).join(''); }
el('casePre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const c=CASES.find(x=>x[0]===b.dataset.c); S.cs=c[0]; S.ctas=Math.round(S.tas*c[2]/5)*5; capCtas(); drawCases(); upd(); });
sl.ctas=LAB.slider(el('petCtl'),{label:'TAS after the failure',min:40,max:520,step:5,v:S.ctas,f:v=>v+' kt',on:v=>{ S.ctas=Math.min(v,S.tas); if(v>S.tas) sl.ctas.set(S.tas); S.cs=''; drawCases(); upd(); }});
sl.fuel=LAB.slider(el('petCtl'),{label:'Fuel above reserves',min:0,max:LFUEL.length-1,step:1,v:idx(LFUEL,S.fuel),f:i=>LFUEL[i]+' kg',on:i=>{ S.fuel=LFUEL[i]; upd(); }});
sl.dev=LAB.slider(el('adv'),{label:'Compass deviation (this heading)',min:-10,max:10,step:1,v:S.dev,f:v=>v===0?'0°':Math.abs(v)+'° '+(v>0?L(t2('E','Ø')):L(t2('W','V'))),on:v=>{ S.dev=v; upd(); }});
LAB.slider(el('machCtl'),{label:'Flight level',min:100,max:410,step:10,v:S.fl,f:v=>'FL'+v,on:v=>{ S.fl=v; machRo(); }});
LAB.slider(el('machCtl'),{label:'Mach number',min:0.4,max:0.86,step:0.01,v:S.mach,f:v=>'M '+v.toFixed(2),on:v=>{ S.mach=v; machRo(); }});
LAB.slider(el('machCtl'),{label:'Temperature vs ISA',min:-30,max:30,step:1,v:S.isa,f:v=>fV(v)+' °C',on:v=>{ S.isa=v; machRo(); }});
function mach(){ const isa=G.isaTemp(S.fl*100), sat=isa+S.isa, a=G.speedOfSound(sat); return {isa,sat,a,tas:S.mach*a}; }
function machRo(){ const m=mach(); el('machRo').innerHTML=[[t2('Outside air temperature','Utetemperatur'),nf(m.sat,1)+' °C'],[t2('Speed of sound','Lydhastighet'),Math.round(m.a)+' kt'],[t2('TAS','TAS'),Math.round(m.tas)+' kt']].map(([k,v])=>`<div class="rrow"><span>${L(k)}</span><b>${v}</b></div>`).join(''); }
el('machUse').onclick=()=>{ S.tas=clamp(Math.round(mach().tas/5)*5,60,520); sl.tas.set(S.tas); capCtas(); upd(); };
LAB.add({},{'Use this TAS':'Bruk denne TAS-en'});
function showKnow(){ sl.trk.el.hidden=S.know!=='trk'; sl.hdg.el.hidden=S.know!=='hdg'; }
function capFlown(){ sl.flown.inp.max=Math.max(3,S.dist-2); if(S.flown>S.dist-2){ S.flown=Math.max(2,Math.round((S.dist-2)/3)); } sl.flown.set(S.flown); }
function capCtas(){ sl.ctas.inp.max=S.tas; if(S.ctas>S.tas||S.cs==='all') S.ctas=S.cs==='all'?S.tas:Math.min(S.ctas,S.tas); sl.ctas.set(S.ctas); }
function drawRoutes(){ el('routePre').innerHTML=ROUTES.map(r=>`<button type="button" class="btn${S.route===r[0]?' pri':''}" data-r="${r[0]}">${L(r[3])}</button>`).join(''); }
el('routePre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; S.route=b.dataset.r; drawRoutes(); upd(); });

/* scenarios */
const SCN=[
 [t2('Light aircraft','Småfly'),{tas:120,know:'trk',trk:270,wd:330,ws:25,varE:3,dist:120,ff:35,dev:0}],
 [t2('Strong crosswind','Sterk sidevind'),{tas:100,know:'trk',trk:360,wd:270,ws:40,varE:3,dist:80,ff:30}],
 [t2('Headwind','Motvind'),{tas:120,know:'trk',trk:270,wd:270,ws:35,varE:3,dist:120,ff:35}],
 [t2('A320, Oslo to Tromsø','A320, Oslo til Tromsø'),{tas:450,know:'trk',trk:16,wd:290,ws:90,varE:8,dist:600,ff:2400,ctas:360,cs:'oei',fuel:5000,route:'engm-entc'}],
 [t2('A320, Tromsø to Svalbard','A320, Tromsø til Svalbard'),{tas:450,know:'trk',trk:355,wd:340,ws:80,varE:12,dist:515,ff:2400,ctas:360,cs:'oei',fuel:4000,route:'entc-ensb',dp:1}]];
function drawPre(){ el('pre').innerHTML=SCN.map(([t,o],i)=>o.dp&&!deepOn()?'':`<button type="button" class="btn" data-s="${i}">${L(t)}</button>`).join(''); }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setS(SCN[+b.dataset.s][1]); });
function setS(o){ if(!o) return; const {mode,proj,...r}=o; Object.assign(S,r); delete S.dp;
  sl.tas.set(S.tas); sl.trk.set(S.trk); sl.hdg.set(S.hdg); sl.wd.set(S.wd); sl.ws.set(S.ws); sl.var.set(S.varE); sl.dist.set(idx(LDIST,S.dist)); sl.ff.set(idx(LFF,S.ff));
  sl.off.set(S.off); sl.fuel.set(idx(LFUEL,S.fuel)); sl.dev.set(S.dev); knowSeg.set(S.know); showKnow(); capFlown(); capCtas(); drawCases(); drawRoutes();
  if(proj) S.proj=proj; setMode(mode||S.mode); }

/* drag on the figure: around the rose sets the desired track (or the heading) */
{ let mode=null; const pos=e=>{ const r=cv.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; };
  cv.addEventListener('pointerdown',e=>{ if(S.mode!=='solve'||!GEO) return; const [x,y]=pos(e), d=Math.hypot(x-GEO.cx,y-GEO.cy);
    mode=d<=GEO.R+26&&d>14?'dir':null;
    if(mode){ cv.setPointerCapture(e.pointerId); mv(e); e.preventDefault(); } });
  const mv=e=>{ if(!mode||!GEO) return; const [x,y]=pos(e), dx=x-GEO.cx, dy=y-GEO.cy, b=Math.round(G.norm(Math.atan2(dx,-dy)*R2D))||360;
    if(S.know==='trk'){ S.trk=b; sl.trk.set(b); } else { S.hdg=b; sl.hdg.set(b); }
    upd(); };
  cv.addEventListener('pointermove',e=>{ if(mode) mv(e); else if(S.mode==='solve'&&GEO){ const [x,y]=pos(e); cv.style.cursor=Math.hypot(x-GEO.cx,y-GEO.cy)<=GEO.R+26?'crosshair':'default'; } else cv.style.cursor='default'; });
  const up=()=>{ mode=null; }; cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up); }

function upd(){ readout(); legend(); see(); draw(); }

/* ---------------- Try it: one task at a time ---------------- */
let ti=0; const ansv={}, done={};
const goModel=()=>{ const t=el('gnVp'); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'}); };
const NUM=(lab,v,tol,unit)=>({lab,v,tol,unit});
const TASKS=[
 {k:'hdg',q:t2('TAS 120 kt, desired track 270° (true), wind 330/25. What true heading do you fly?','TAS 120 kt, ønsket track 270° (rettvisende), vind 330/25. Hvilken rettvisende heading flyr du?'),
  ins:[NUM(t2('Heading (T)','Heading (R)'),280.4,1.6,'°')],pre:{mode:'solve',tas:120,know:'trk',trk:270,wd:330,ws:25,varE:3,dist:120,ff:35,dev:0},
  e:t2('The wind is from 60° right of the nose, so the crosswind is 25 × sin 60° ≈ 22 kt. WCA ≈ 22 / 120 × 60 ≈ 11° (exactly 10.4°): turn the nose right, into wind. Heading ≈ 280°.','Vinden kommer 60° fra høyre for nesen, så sidevinden er 25 × sin 60° ≈ 22 kt. WCA ≈ 22 / 120 × 60 ≈ 11° (eksakt 10,4°): drei nesen til høyre, opp i vinden. Heading ≈ 280°.')},
 {k:'gs',q:t2('Same leg. What is the groundspeed?','Samme etappe. Hva er groundspeed?'),ins:[NUM(t2('GS','GS'),105.5,3,'kt')],pre:{mode:'solve',tas:120,know:'trk',trk:270,wd:330,ws:25,varE:3,dist:120,ff:35},
  e:t2('Headwind component 25 × cos 60° = 12.5 kt. GS = TAS × cos WCA − headwind = 120 × cos 10.4° − 12.5 ≈ 105.5 kt. Crabbing costs about 2 kt on top of the headwind.','Motvindskomponent 25 × cos 60° = 12,5 kt. GS = TAS × cos WCA − motvind = 120 × cos 10,4° − 12,5 ≈ 105,5 kt. Krabbingen koster rundt 2 kt i tillegg til motvinden.')},
 {k:'mag',q:t2('Variation is 3° E. Which magnetic heading do you set for that true heading of 280°?','Misvisningen er 3° Ø. Hvilken magnetisk heading setter du for den rettvisende headingen 280°?'),ins:[NUM(t2('Heading (M)','Heading (M)'),277,0.6,'°')],pre:{mode:'solve',tas:120,know:'trk',trk:270,wd:330,ws:25,varE:3},
  e:t2('Variation east, magnetic least: 280 − 3 = 277° M.','Østlig misvisning, magnetisk minst: 280 − 3 = 277° M.')},
 {k:'leg',q:t2('The leg is 120 NM at a groundspeed of 105 kt, and you burn 35 kg/h. How long does it take, and how much fuel?','Etappen er 120 NM med groundspeed 105 kt, og du bruker 35 kg/t. Hvor lang tid tar den, og hvor mye drivstoff?'),
  ins:[NUM(t2('Time (min)','Tid (min)'),68.6,2,'min'),NUM(t2('Fuel (kg)','Drivstoff (kg)'),40,2,'kg')],pre:{mode:'solve',tas:120,know:'trk',trk:270,wd:330,ws:25,dist:120,ff:35},
  e:t2('Time = 120 / 105 × 60 ≈ 69 min (1:09). Fuel = 69 / 60 × 35 ≈ 40 kg.','Tid = 120 / 105 × 60 ≈ 69 min (1:09). Drivstoff = 69 / 60 × 35 ≈ 40 kg.')},
 {k:'drift',q:t2('Set the wind so that there is no drift at all on track 270°, with at least 20 kt of wind. Then press Check.','Sett vinden slik at det ikke er noen avdrift på track 270°, med minst 20 kt vind. Trykk så Sjekk.'),
  live:()=>{ const s=sol(); if(S.mode!=='solve') return [0,t2('Open "Find heading and GS".','Åpne «Finn heading og GS».')]; if(S.ws<20) return [0,t2('Use at least 20 kt of wind.','Bruk minst 20 kt vind.')];
    if(Math.abs(s.drift)>0.5) return [0,t2(`Still ${nf(Math.abs(s.drift),1)}° of drift. Which wind directions give no crosswind on 270°?`,`Fortsatt ${nf(Math.abs(s.drift),1)}° avdrift. Hvilke vindretninger gir ingen sidevind på 270°?`)];
    return [1,S.wd===270?t2('Yes: a pure headwind (270). No drift, but the GS drops by the full wind speed.','Ja: ren motvind (270). Ingen avdrift, men GS faller med hele vindstyrken.'):t2('Yes: a pure tailwind (090). No drift, and the GS gains the full wind speed.','Ja: ren medvind (090). Ingen avdrift, og GS øker med hele vindstyrken.')]; },
  pre:{mode:'solve',tas:120,know:'trk',trk:270,wd:330,ws:25}},
 {k:'sixty',q:t2('After 30 NM you are 3 NM left of track, with 60 NM to go. How do you turn to fly direct to B?','Etter 30 NM er du 3 NM til venstre for track, med 60 NM igjen. Hvordan svinger du for å fly direkte til B?'),
  opts:[t2('9° right','9° til høyre'),t2('9° left','9° til venstre'),t2('6° right','6° til høyre'),t2('3° right','3° til høyre')],c:0,pre:{mode:'off',dist:90,flown:30,off:-3,tas:120,know:'trk',trk:270,wd:330,ws:25},
  e:t2('Track error 3 / 30 × 60 = 6°, closing angle 3 / 60 × 60 = 3°. You are left, so turn right by 6 + 3 = 9°. Turning 6° only would fly parallel to the planned track.','Trackfeil 3 / 30 × 60 = 6°, lukkevinkel 3 / 60 × 60 = 3°. Du er til venstre, så sving til høyre 6 + 3 = 9°. Svinger du bare 6°, flyr du parallelt med planlagt track.')},
 {k:'conv',dp:1,q:t2('Oslo (60.2° N, 11.1° E) to Tromsø (69.7° N, 18.9° E). Estimate the convergency with dlong × sin(mean latitude).','Oslo (60,2° N, 11,1° Ø) til Tromsø (69,7° N, 18,9° Ø). Anslå konvergensen med dlong × sin(middelbredde).'),
  ins:[NUM(t2('Convergency (°)','Konvergens (°)'),7.08,0.3,'°')],pre:{mode:'earth',route:'engm-entc',proj:'globe'},
  e:t2('dlong 7.8°, mean latitude 64.9°: 7.8 × sin 64.9° ≈ 7.1°. The great-circle track grows from about 016° to 023°; the conversion angle is half, about 3.5°.','dlong 7,8°, middelbredde 64,9°: 7,8 × sin 64,9° ≈ 7,1°. Storsirkeltracken øker fra rundt 016° til 023°; konverteringsvinkelen er halvparten, rundt 3,5°.')},
 {k:'pet',dp:1,q:t2('A 400 NM sector. After a failure the groundspeed on is 180 kt and back is 220 kt. How far from A is the PET?','En etappe på 400 NM. Etter en feil er groundspeed videre 180 kt og tilbake 220 kt. Hvor langt fra A ligger PET?'),
  ins:[NUM(t2('PET (NM from A)','PET (NM fra A)'),220,3,'NM')],pre:{mode:'pet',tas:200,ctas:200,cs:'all',know:'trk',trk:90,wd:90,ws:20,dist:400,ff:40,fuel:120},
  e:t2('PET = D × H / (O + H) = 400 × 220 / 400 = 220 NM: past the midpoint, because the headwind outbound makes the way on slower. The PET moves into wind.','PET = D × H / (O + H) = 400 × 220 / 400 = 220 NM: forbi midtpunktet, fordi motvinden utover gjør veien videre langsommere. PET flytter seg mot vinden.')},
 {k:'pnr',dp:1,q:t2('Safe endurance 4 h, groundspeed out 400 kt and home 500 kt. How far out is the PNR?','Sikker utholdenhet 4 t, groundspeed ut 400 kt og hjem 500 kt. Hvor langt ute er PNR?'),
  ins:[NUM(t2('PNR (NM)','PNR (NM)'),888.9,6,'NM')],pre:{mode:'pet',tas:450,ctas:450,cs:'all',know:'trk',trk:90,wd:270,ws:50,dist:1200,ff:2000,fuel:8000},
  e:t2('T = E × H / (O + H) = 4 × 500 / 900 = 2.22 h; PNR = 2.22 × 400 ≈ 889 NM. In still air it would be 900 NM: any wind brings it closer.','T = E × H / (O + H) = 4 × 500 / 900 = 2,22 t; PNR = 2,22 × 400 ≈ 889 NM. I stille luft ville den vært 900 NM: all vind flytter den nærmere.')}];
const tasks=()=>TASKS.filter(t=>!t.dp||deepOn());
function drawTask(){ const TS=tasks(); ti=clamp(ti,0,TS.length-1); const t=TS[ti], n=TS.length, a=ansv[t.k];
  let h=`<div class="th"><span class="n">${L(t2('Task','Oppgave'))} ${ti+1} ${L(t2('of','av'))} ${n}</span><span class="dots">${TS.map((x,i)=>`<button type="button" data-i="${i}" class="${i===ti?'on':''}" aria-label="${L(t2('Task','Oppgave'))} ${i+1}"></button>`).join('')}</span></div><p class="q">${L(t.q)}</p>`;
  if(t.ins){ h+=`<div class="ins">${t.ins.map((x,j)=>{ const v=a&&a[j]; const ok=v!=null&&v!==''&&Math.abs(parseFloat(String(v).replace(',','.'))-x.v)<=x.tol; return `<label>${L(x.lab)}<input type="text" inputmode="decimal" data-j="${j}" value="${v??''}" class="${done[t.k]?(ok?'right':'wrong'):''}" autocomplete="off"></label>`; }).join('')}<button type="button" class="btn pri sm" data-chk="1">${L(t2('Check','Sjekk'))}</button></div>`;
    h+=`<span class="fb${done[t.k]===1?' ok':''}">${done[t.k]?'<b>'+L(done[t.k]===1?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(t.e):''}</span>`; }
  else if(t.opts){ h+=`<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${a!=null?'<b>'+L(a===t.c?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(t.e):''}</span>`; }
  else { h+=`<div class="ins"><button type="button" class="btn pri sm" data-chk="1">${L(t2('Check','Sjekk'))}</button></div><span class="fb${done[t.k]&&done[t.k][0]?' ok':''}">${done[t.k]?(done[t.k][0]?'<b>✓</b> ':'')+L(done[t.k][1]):''}</span>`; }
  h+=`<div class="nav"><button type="button" class="btn sm" data-go="1">${L(t.live?t2('Set it up in the model','Sett det opp i modellen'):t2('Check it in the model','Sjekk i modellen'))} ↑</button><span class="sp"></span><button type="button" class="btn sm" data-p="1" ${ti===0?'disabled':''}>← ${L(t2('Previous','Forrige'))}</button><button type="button" class="btn sm" data-n="1" ${ti===n-1?'disabled':''}>${L(t2('Next','Neste'))} →</button></div>`;
  el('tstep').innerHTML=h; }
el('tstep').addEventListener('input',e=>{ const i=e.target.closest('input'); if(!i) return; const t=tasks()[ti]; (ansv[t.k]=ansv[t.k]||[])[+i.dataset.j]=i.value; });
el('tstep').addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.closest('input')){ const b=el('tstep').querySelector('[data-chk]'); if(b) b.click(); } });
el('tstep').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const TS=tasks(), t=TS[ti];
  if(b.dataset.i!=null){ ti=+b.dataset.i; drawTask(); return; } if(b.dataset.p){ ti--; drawTask(); return; } if(b.dataset.n){ ti++; drawTask(); return; }
  if(b.dataset.go){ setS(t.pre); goModel(); return; }
  if(b.dataset.o!=null){ ansv[t.k]=+b.dataset.o; drawTask(); return; }
  if(b.dataset.chk){ if(t.live){ done[t.k]=t.live(); drawTask(); return; }
    const a=ansv[t.k]||[]; done[t.k]=t.ins.every((x,j)=>a[j]!=null&&a[j]!==''&&Math.abs(parseFloat(String(a[j]).replace(',','.'))-x.v)<=x.tol)?1:2; drawTask(); } });

/* ---------------- Understand: key concept cards ---------------- */
const {sv,tx,ar}=KCS;
const go=(o)=>({click:()=>setS(o),to:'#gnVp'});
const nArrow=(x,c,lab,rot)=>`<g transform="rotate(${rot||0} ${x} 52)">${ar(x,52,x,12,c,1.8)}</g>${tx(x,62,lab,c,'middle',8)}`;
const KC=[
 Object.assign({k:'tmc',t:t2('True, magnetic, compass','Rettvisende, magnetisk, kompass'),d:t2('<b>True</b> north is the geographic pole, <b>magnetic</b> north is where a compass needle points, and the <b>compass</b> reading also includes the aircraft’s own magnetism.','<b>Rettvisende</b> nord er den geografiske polen, <b>magnetisk</b> nord er dit en kompassnål peker, og <b>kompass</b>avlesningen tar også med flyets egen magnetisme.'),dd:t2('Charts, great-circle tracks and the wind triangle use true. The compass, runway numbers and ATC headings use magnetic.','Kart, storsirkeltracker og vindtrekanten bruker rettvisende. Kompasset, rullebanenumrene og ATC-headinger bruker magnetisk.'),
  ill:()=>sv(`${nArrow(60,'#eef3f7','T')}${nArrow(100,'#c9b6f2','M',12)}${nArrow(140,'#f0b440','C',20)}`)},go({mode:'solve',varE:12})),
 Object.assign({k:'var',t:t2('Variation and deviation','Misvisning og deviasjon'),d:t2('<b>Variation</b> (true to magnetic) depends on where you are; <b>deviation</b> (magnetic to compass) depends on the aircraft and its heading.','<b>Misvisning</b> (rettvisende til magnetisk) avhenger av hvor du er; <b>deviasjon</b> (magnetisk til kompass) avhenger av flyet og headingen.'),dd:t2('Variation is printed on the chart as isogonals and changes slowly over the years; deviation is read from the deviation card in the cockpit. In Norway the variation is east today: about 3° at Bergen, 5° at Oslo, 11° at Tromsø and 13° on Svalbard (WMM 2025).','Misvisningen er trykt på kartet som isogoner og endrer seg langsomt over årene; deviasjonen leses av deviasjonskortet i cockpit. I Norge er misvisningen østlig i dag: rundt 3° i Bergen, 5° i Oslo, 11° i Tromsø og 13° på Svalbard (WMM 2025).'),
  ill:()=>sv(`${tx(18,36,'T','#eef3f7','middle',12)}${ar(30,32,70,32,'#c9b6f2')}${tx(50,24,'± var','#c9b6f2','middle',8)}${tx(84,36,'M','#c9b6f2','middle',12)}${ar(96,32,136,32,'#f0b440')}${tx(116,24,'± dev','#f0b440','middle',8)}${tx(150,36,'C','#f0b440','middle',12)}${tx(100,56,L(t2('E: subtract · W: add','Ø: trekk fra · V: legg til')),'#8b99a7','middle',8)}`)},go({mode:'solve',varE:8})),
 Object.assign({k:'ht',t:t2('Heading vs track','Heading og track'),d:t2('<b>Heading</b> is where the nose points and <b>track</b> is the path over the ground; in wind they differ, in still air they are the same.','<b>Heading</b> er dit nesen peker og <b>track</b> er banen over bakken; i vind er de forskjellige, i stille luft like.'),
  ill:()=>sv(`<line x1="100" y1="60" x2="100" y2="6" stroke="#c9d2da" stroke-dasharray="3 3"/>${ar(100,58,118,8,'#7fcbe8')}${ar(100,58,100,8,'#71cc93')}${tx(124,16,'HDG','#7fcbe8','start',8)}${tx(94,16,'TRK','#71cc93','end',8)}`)},go({mode:'solve',know:'trk',trk:360,wd:270,ws:30,tas:120})),
 Object.assign({k:'dr',t:t2('Drift and wind correction angle','Avdrift og vindkorreksjonsvinkel'),d:t2('<b>Drift</b> is the angle from heading to track; the <b>wind correction angle</b> turns the nose into wind to cancel it, about crosswind ÷ TAS × 60.','<b>Avdrift</b> er vinkelen fra heading til track; <b>vindkorreksjonsvinkelen</b> dreier nesen opp i vinden for å oppheve den, omtrent sidevind ÷ TAS × 60.'),
  ill:()=>sv(`${ar(60,58,60,8,'#7fcbe8')}${ar(60,58,84,10,'#71cc93')}${ar(170,24,124,24,'#f0b440')}${tx(78,40,L(t2('drift','avdrift')),'#eef3f7','start',8)}${tx(146,16,L(t2('wind','vind')),'#f0b440','middle',8)}`)},go({mode:'solve',know:'hdg',hdg:360,wd:270,ws:30,tas:120})),
 Object.assign({k:'gs',t:t2('TAS vs groundspeed','TAS og groundspeed'),d:t2('<b>TAS</b> is your speed through the air and <b>groundspeed</b> your speed over the ground: time = distance ÷ GS, fuel = time × fuel flow.','<b>TAS</b> er farten gjennom luften og <b>groundspeed</b> farten over bakken: tid = distanse ÷ GS, drivstoff = tid × forbruk.'),
  ill:()=>sv(`<rect x="20" y="16" width="140" height="8" rx="2" fill="#7fcbe8"/>${tx(166,24,'TAS','#7fcbe8','start',8)}<rect x="20" y="36" width="104" height="8" rx="2" fill="#71cc93"/>${ar(160,40,128,40,'#f0b440')}${tx(166,44,'GS','#71cc93','start',8)}`)},go({mode:'solve',know:'trk',trk:270,wd:270,ws:35,tas:120})),
 Object.assign({k:'sixty',t:t2('The 1 in 60 rule','1 av 60-regelen'),d:t2('1° of track error puts you about 1 NM off track for every 60 NM flown, so angle ≈ off-track ÷ distance × 60.','1° trackfeil gir omtrent 1 NM ut av track for hver 60 NM fløyet, så vinkel ≈ ut av track ÷ distanse × 60.'),dd:t2('Good enough up to about 20°, which covers every correction you make in flight.','Godt nok opp til rundt 20°, som dekker alle korreksjoner du gjør i lufta.'),
  ill:()=>sv(`<line x1="16" y1="46" x2="184" y2="46" stroke="#c9d2da"/>${ar(16,46,184,22,'#71cc93')}<line x1="184" y1="46" x2="184" y2="22" stroke="#f0b440" stroke-width="1.6"/>${tx(100,58,'60 NM','#8b99a7','middle',8)}${tx(178,36,'1 NM','#f0b440','end',8)}${tx(48,40,'1°','#71cc93','start',8)}`)},go({mode:'off',dist:120,flown:60,off:3})),
 Object.assign({k:'gc',t:t2('Great circle vs rhumb line','Storsirkel og loksodrom'),d:t2('A <b>great circle</b> is the shortest route but its true track keeps changing; a <b>rhumb line</b> holds one constant track but is longer.','En <b>storsirkel</b> er den korteste ruten, men den rettvisende tracken endrer seg hele tiden; en <b>loksodrom</b> holder én fast track, men er lengre.'),
  ill:()=>sv(`<path d="M20,52 Q100,2 180,52" stroke="#e46bae" stroke-width="2" fill="none"/><line x1="20" y1="52" x2="180" y2="52" stroke="#7fcbe8" stroke-width="2" stroke-dasharray="5 4"/>${tx(100,22,'GC','#e46bae','middle',8)}${tx(100,62,'RL','#7fcbe8','middle',8)}`)},go({mode:'earth',route:'engm-kjfk',proj:'merc'})),
 Object.assign({k:'conv',t:t2('Convergency','Konvergens'),d:t2('<b>Convergency</b>, the angle between two meridians, is about dlong × sin(mean latitude), and the great-circle track changes by exactly that.','<b>Konvergens</b>, vinkelen mellom to meridianer, er omtrent dlong × sin(middelbredde), og storsirkeltracken endrer seg med nettopp så mye.'),
  ill:()=>sv(`<line x1="40" y1="60" x2="96" y2="4" stroke="#c9d2da"/><line x1="160" y1="60" x2="104" y2="4" stroke="#c9d2da"/><circle cx="100" cy="2" r="2" fill="#eef3f7"/>${tx(100,40,'γ','#f0b440','middle',12)}`)},go({mode:'earth',route:'engm-entc',proj:'lcc'})),
 Object.assign({k:'time',t:t2('Time and UTC','Tid og UTC'),d:t2('Aviation runs on <b>UTC</b>, and 15° of longitude is one hour of local time (1° = 4 minutes).','Luftfarten bruker <b>UTC</b>, og 15° lengde er én time lokal tid (1° = 4 minutter).'),dd:t2('Norway uses UTC+1 in winter and UTC+2 in summer. Night (EASA): from the end of evening civil twilight to the beginning of morning civil twilight, when the centre of the sun is 6° below the horizon.','Norge bruker UTC+1 om vinteren og UTC+2 om sommeren. Natt (EASA): fra slutten av borgerlig tussmørke om kvelden til begynnelsen av borgerlig tussmørke om morgenen, når solens sentrum er 6° under horisonten.'),
  ill:()=>sv(`<circle cx="60" cy="32" r="22" fill="none" stroke="#c9d2da" stroke-width="1.6"/><line x1="60" y1="32" x2="60" y2="16" stroke="#eef3f7" stroke-width="1.6"/><line x1="60" y1="32" x2="72" y2="38" stroke="#eef3f7" stroke-width="1.6"/>${tx(100,28,'15° = 1 h','#f0b440','start',9)}${tx(100,44,'1° = 4 min','#8b99a7','start',9)}`)}),
 Object.assign({k:'pet',t:t2('PET and PNR','PET og PNR'),d:t2('The <b>PET</b> is where going on takes as long as turning back; the <b>PNR</b> is the furthest you can go and still return with the reserves.','<b>PET</b> er der det tar like lang tid å fortsette som å snu; <b>PNR</b> er det lengste du kan fly og fortsatt komme tilbake med reservene.'),
  ill:()=>sv(`<line x1="16" y1="34" x2="184" y2="34" stroke="#c9d2da" stroke-width="2"/><circle cx="16" cy="34" r="4" fill="#eef3f7"/><circle cx="184" cy="34" r="4" fill="#eef3f7"/><path d="M108,30 L102,18 L114,18 Z" fill="#e46bae"/><path d="M140,38 L134,50 L146,50 Z" fill="#ec5a47"/>${tx(108,14,'PET','#e46bae','middle',8)}${tx(140,60,'PNR','#ec5a47','middle',8)}${tx(16,52,'A','#8b99a7','middle',8)}${tx(184,52,'B','#8b99a7','middle',8)}`)},go({mode:'pet',tas:450,know:'trk',trk:355,wd:340,ws:80,varE:12,dist:515,ff:2400,ctas:360,cs:'oei',fuel:4000}))];
KCS.render(el('kcGrid'),KC);

/* ---------------- deep-dive folds ---------------- */
const P=s=>`<p>${s}</p>`, FX=s=>`<div class="fx">${s}</div>`;
const DD=[
 ['wt',t2('The wind triangle in numbers','Vindtrekanten i tall'),t2('what the CRP-5 does','det CRP-5 gjør'),[
  t2(P('Split the wind into a <b>crosswind</b> and a <b>headwind</b> component on the track. The crosswind sets the angle, the headwind the speed:')+FX('XW = W × sin(wind − track) · HW = W × cos(wind − track)')+FX('WCA = asin(XW / TAS) ≈ XW / TAS × 60 · GS = TAS × cos WCA − HW')+P('Maximum drift, with the wind at 90°, is about W / TAS × 60 degrees. On the CRP-5 you mark the wind, set the TAS under the index and read drift and GS from the grid: the same triangle.'),
     P('Del vinden i en <b>sidevinds</b>- og en <b>motvinds</b>komponent på tracken. Sidevinden bestemmer vinkelen, motvinden farten:')+FX('XW = W × sin(vind − track) · HW = W × cos(vind − track)')+FX('WCA = asin(XW / TAS) ≈ XW / TAS × 60 · GS = TAS × cos WCA − HW')+P('Største avdrift, med vinden på 90°, er omtrent W / TAS × 60 grader. På CRP-5 merker du vinden, setter TAS under indeksen og leser avdrift og GS fra rutenettet: samme trekant.'))]],
 ['tvmdc',t2('From true to compass','Fra rettvisende til kompass'),t2('the full chain','hele kjeden'),[
  t2(P('True → magnetic → compass. Going this way, subtract easterly and add westerly variation, then the same for deviation.')+FX('M = T − var(E) · C = M − dev(E)')+P('Example: true heading 280°, variation 5° E, deviation 2° W → magnetic 275°, compass 277°. Charts and great-circle tracks are true; the compass, runways and ATC headings are magnetic. Variation is printed as isogonals on the chart and changes slowly over the years.'),
     P('Rettvisende → magnetisk → kompass. Denne veien trekker du fra østlig og legger til vestlig misvisning, og det samme for deviasjon.')+FX('M = R − mv(Ø) · K = M − dev(Ø)')+P('Eksempel: rettvisende heading 280°, misvisning 5° Ø, deviasjon 2° V → magnetisk 275°, kompass 277°. Kart og storsirkeltracker er rettvisende; kompasset, rullebaner og ATC-headinger er magnetiske. Misvisningen er trykt som isogoner på kartet og endrer seg langsomt over årene.'))]],
 ['sixty',t2('Where the 1 in 60 rule comes from','Hvor 1 av 60-regelen kommer fra'),t2('and other uses','og andre bruksområder'),[
  t2(P('One radian is 57.3°, close to 60, and for small angles sin, tan and the angle in radians are almost equal. So off-track ÷ distance ≈ angle ÷ 60. Using 60 instead of 57.3 makes it about 5 % out for small angles, growing slowly to about 10 % at 20°: good enough for corrections in flight.')+P('The same rule gives the <b>wind correction</b> (crosswind ÷ TAS × 60) and <b>descent planning</b>: 1° of path is about 100 ft per NM, so a 3° path is about 300 ft per NM.'),
     P('Én radian er 57,3°, nær 60, og for små vinkler er sin, tan og vinkelen i radianer nesten like. Så ut av track ÷ distanse ≈ vinkel ÷ 60. Ved 10° bommer regelen med rundt 4 %, ved 20° rundt 7 %.')+P('Samme regel gir <b>vindkorreksjonen</b> (sidevind ÷ TAS × 60) og <b>nedstigningsplanlegging</b>: 1° bane er omtrent 100 ft per NM, så en 3°-bane er rundt 300 ft per NM.'))]],
 ['earth',t2('Great circles, rhumb lines and convergency','Storsirkler, loksodromer og konvergens'),t2('the formulas','formlene'),[
  t2(P('A great circle lies on a plane through the Earth’s centre; the equator and all meridians are great circles. In the northern hemisphere it lies on the pole side of the rhumb line. One minute of latitude is 1 NM.')+FX('departure (NM) = dlong (′) × cos lat')+FX('convergency ≈ dlong × sin(mean lat) · conversion angle = ½ convergency')+P('The exact spherical value is tan(γ/2) = sin(mean lat) × tan(dlong/2) / cos(dlat/2); the lab shows both. Flying a great circle east in the northern hemisphere, the true track increases; flying west it decreases.'),
     P('En storsirkel ligger i et plan gjennom jordens sentrum; ekvator og alle meridianer er storsirkler. På den nordlige halvkule ligger den på polsiden av loksodromen. Ett bueminutt bredde er 1 NM.')+FX('departure (NM) = dlong (′) × cos bredde')+FX('konvergens ≈ dlong × sin(middelbredde) · konverteringsvinkel = ½ konvergens')+P('Den eksakte sfæriske verdien er tan(γ/2) = sin(middelbredde) × tan(dlong/2) / cos(dlat/2); labben viser begge. Flyr du en storsirkel østover på den nordlige halvkule, øker den rettvisende tracken; vestover minker den.'))]],
 ['proj',t2('Chart projections','Kartprojeksjoner'),t2('Mercator, Lambert and polar stereographic','Mercator, Lambert og polar stereografisk'),['TABLE',
  t2(P('All three are <b>conformal</b>: angles and small shapes are right. On a Lambert chart the chart convergency is n × dlong, where n ≈ sin(parallel of origin), so between the standard parallels it is close to the Earth’s, and a ruler line is almost a great circle.'),P('Alle tre er <b>konforme</b>: vinkler og små former er riktige. På et Lambert-kart er kartkonvergensen n × dlong, der n ≈ sin(origoparallellen), så mellom standardparallellene ligger den nær jordens, og en linjal-linje er nesten en storsirkel.'))]],
 ['time',t2('Time, longitude and daylight','Tid, lengdegrad og dagslys'),t2('UTC, LMT and civil twilight','UTC, LMT og borgerlig tussmørke'),[
  t2(P('The Earth turns 360° in 24 hours: 15° of longitude is 1 hour, 1° is 4 minutes. Local mean time follows the mean sun over your own meridian; UTC is the local mean time at Greenwich. Going east, local time is later: LMT = UTC + east longitude in time.')+FX('1200 UTC at 10° E → 1200 + 40 min = 1240 LMT')+P('Flight plans, NOTAMs, METARs and the logbook use UTC. Under EASA (SERA) rules <b>night</b> is the time between the end of evening civil twilight and the beginning of morning civil twilight, when the centre of the sun is 6° below the horizon. In northern Norway that means midnight sun with no night in summer, and polar night in winter, when the sun stays below the horizon but civil twilight still gives some light around noon.'),
     P('Jorden dreier 360° på 24 timer: 15° lengde er 1 time, 1° er 4 minutter. Lokal middeltid følger middelsolen over din egen meridian; UTC er lokal middeltid i Greenwich. Østover er lokal tid senere: LMT = UTC + østlig lengde i tid.')+FX('1200 UTC på 10° Ø → 1200 + 40 min = 1240 LMT')+P('Færdplaner, NOTAM, METAR og loggboken bruker UTC. Etter EASA-reglene (SERA) er <b>natt</b> tiden mellom slutten av borgerlig tussmørke om kvelden og begynnelsen av borgerlig tussmørke om morgenen, når solens sentrum er 6° under horisonten. I Nord-Norge betyr det midnattssol uten natt om sommeren, og mørketid om vinteren, når solen holder seg under horisonten, men borgerlig tussmørke likevel gir litt lys midt på dagen.'))]],
 ['pnr',t2('PET and PNR formulas','PET- og PNR-formler'),t2('and what the wind does','og hva vinden gjør'),[
  t2(P('D is the sector distance, O the groundspeed going on and H the groundspeed returning home. For the PET use the speeds for the failure case (all engines, one engine out, depressurised); the time to reach it is flown at the normal speed.')+FX('PET = D × H / (O + H)')+P('E is the safe endurance: fuel above the reserves ÷ fuel flow, with the normal speeds.')+FX('T(PNR) = E × H / (O + H) · PNR = T × O')+P('The PET moves <b>into wind</b>. Any wind, head or tail, brings the PNR <b>closer</b> to A, because you lose more time on the slow leg than you gain on the fast one.'),
     P('D er etappedistansen, O groundspeed videre og H groundspeed tilbake (hjem). For PET bruker du fartene for feiltilfellet (alle motorer, én motor ute, trykkløs); tiden dit flys med normal fart.')+FX('PET = D × H / (O + H)')+P('E er sikker utholdenhet: drivstoff over reservene ÷ forbruk, med normale farter.')+FX('T(PNR) = E × H / (O + H) · PNR = T × O')+P('PET flytter seg <b>mot vinden</b>. All vind, mot eller med, flytter PNR <b>nærmere</b> A, fordi du taper mer tid på den langsomme etappen enn du vinner på den raske.'))]],
 ['mach',t2('Mach, TAS and groundspeed at altitude','Mach, TAS og groundspeed i høyden'),t2('why cold air means a lower TAS','hvorfor kald luft gir lavere TAS'),[
  t2(P('At cruise a jet flies a Mach number. TAS is Mach × the local speed of sound, and the speed of sound depends only on temperature: about 661 kt at +15 °C and 573 kt at −56.5 °C. At the same Mach, colder air gives a lower TAS. Try it under Advanced.')+FX('TAS = M × a · a ≈ 38.97 × √T(K) kt'),
     P('I marsj flyr et jetfly et machtall. TAS er mach × lokal lydhastighet, og lydhastigheten avhenger bare av temperaturen: rundt 661 kt ved +15 °C og 573 kt ved −56,5 °C. Med samme mach gir kaldere luft lavere TAS. Prøv det under Avansert.')+FX('TAS = M × a · a ≈ 38,97 × √T(K) kt'))]],
 ['ops',t2('In the aircraft','I flyet'),t2('where you meet all this','der du møter alt dette'),[
  t2(P('<b>Wind on the ND.</b> A modern navigation display shows GS, TAS and the current wind, and a track symbol beside the heading: the gap between them is the drift you calculate here.')+P('<b>Great circles in the FMS.</b> The FMS flies great-circle legs between waypoints. On a long leg the track creeps round even in a steady wind: that is convergency, not drift.')+P('<b>True and magnetic.</b> The inertial system computes true heading and converts it with a stored variation table. Near the poles that table does not apply, so headings and tracks are flown in true there; the limits are in the aircraft manuals.')+P('<b>PET on the flight plan.</b> For sectors over water or remote areas the flight plan lists equal-time points between en-route alternates, often for engine failure and depressurisation.'),
     P('<b>Vind på ND.</b> En moderne navigasjonsskjerm viser GS, TAS og aktuell vind, og et track-symbol ved siden av headingen: avstanden mellom dem er avdriften du regner ut her.')+P('<b>Storsirkler i FMS.</b> FMS flyr storsirkeletapper mellom veipunktene. På en lang etappe kryper tracken rundt selv i jevn vind: det er konvergens, ikke avdrift.')+P('<b>Rettvisende og magnetisk.</b> Treghetssystemet regner ut rettvisende heading og gjør den om med en lagret misvisningstabell. Nær polene gjelder ikke tabellen, så der flys heading og track rettvisende; grensene står i flyets håndbøker.')+P('<b>PET i færdplanen.</b> For etapper over vann eller øde områder viser færdplanen likt-tid-punkter mellom underveisalternativer, ofte for motorbortfall og trykktap.'))]]];
const DDTAB=[[t2('Projection','Projeksjon'),t2('Rhumb line','Loksodrom'),t2('Great circle','Storsirkel'),t2('Scale correct','Riktig målestokk'),t2('Chart convergency','Kartkonvergens'),t2('Typical use','Typisk bruk')],
 [t2('Mercator','Mercator'),t2('straight','rett'),t2('curved towards the pole','krum mot polen'),t2('at the equator (× 1/cos lat)','ved ekvator (× 1/cos bredde)'),t2('zero','null'),t2('low latitudes, plotting','lave bredder, plotting')],
 [t2('Lambert conformal','Lambert konform'),t2('curved, concave to the pole','krum, konkav mot polen'),t2('nearly straight','nesten rett'),t2('on the two standard parallels','på de to standardparallellene'),t2('n × dlong','n × dlong'),t2('most en-route charts in mid latitudes','de fleste underveiskart på midlere bredder')],
 [t2('Polar stereographic','Polar stereografisk'),t2('spirals towards the pole','spiraler mot polen'),t2('nearly straight near the pole','nesten rett nær polen'),t2('at the pole','ved polen'),t2('dlong','dlong'),t2('polar charts','polarkart')]];
function drawDD(){ const open=[...document.querySelectorAll('#ddList details[open]')].map(d=>d.id);
  el('ddList').innerHTML=DD.map(([id,t,s,ps])=>`<details class="dfold" id="dd-${id}"><summary>${L(t)} <small>${L(s)}</small></summary><div>${ps.map(p=>p==='TABLE'?`<div class="wrapx"><table class="ftab">${DDTAB.map((r,j)=>`<tr>${r.map(c=>j?`<td>${L(c)}</td>`:`<th>${L(c)}</th>`).join('')}</tr>`).join('')}</table></div>`:L(p)).join('')}</div></details>`).join('');
  open.forEach(i=>{ const d=el(i); if(d) d.open=true; }); }

/* ---------------- Test yourself ---------------- */
function drawTake(){ const TK=[
  t2('<b>Heading is where the nose points, track is where you go.</b> Drift is the angle between them; to hold a track, turn the nose into wind by the WCA ≈ crosswind ÷ TAS × 60.','<b>Heading er dit nesen peker, track er dit du går.</b> Avdrift er vinkelen mellom dem; for å holde en track dreier du nesen opp i vinden med WCA ≈ sidevind ÷ TAS × 60.'),
  t2('<b>Groundspeed sets the time.</b> Headwind takes from the TAS, tailwind adds. Time = distance ÷ GS, fuel = time × fuel flow.','<b>Groundspeed bestemmer tiden.</b> Motvind trekker fra TAS, medvind legger til. Tid = distanse ÷ GS, drivstoff = tid × forbruk.'),
  t2('<b>True to magnetic:</b> subtract easterly variation, add westerly. Magnetic to compass: the same with deviation.','<b>Rettvisende til magnetisk:</b> trekk fra østlig misvisning, legg til vestlig. Magnetisk til kompass: det samme med deviasjon.'),
  t2('<b>1 in 60:</b> track error = off-track ÷ distance flown × 60. Turn track error + closing angle to reach the destination, the track error alone to fly parallel.','<b>1 av 60:</b> trackfeil = ut av track ÷ distanse fløyet × 60. Sving trackfeil + lukkevinkel for å nå målet, bare trackfeilen for å fly parallelt.'),
  t2('<b>Great circle: shortest, changing track.</b> Rhumb line: constant track, longer, on the equator side. The GC track changes by the convergency ≈ dlong × sin(mean lat).','<b>Storsirkel: kortest, track som endrer seg.</b> Loksodrom: fast track, lengre, på ekvatorsiden. Storsirkeltracken endrer seg med konvergensen ≈ dlong × sin(middelbredde).'),
  {dp:1,...t2('<b>Lambert: straight line ≈ great circle. Mercator: straight line = rhumb line.</b> Polar stereographic: chart convergency = dlong.','<b>Lambert: rett linje ≈ storsirkel. Mercator: rett linje = loksodrom.</b> Polar stereografisk: kartkonvergens = dlong.')},
  t2('<b>PET = D × H ÷ (O + H)</b> and moves into wind. <b>PNR</b> depends on fuel; any wind brings it closer to the departure.','<b>PET = D × H ÷ (O + H)</b> og flytter seg mot vinden. <b>PNR</b> avhenger av drivstoff; all vind flytter den nærmere avgangsplassen.'),
  t2('<b>Aviation runs on UTC.</b> 15° of longitude is one hour, 1° is four minutes.','<b>Luftfarten bruker UTC.</b> 15° lengde er én time, 1° er fire minutter.')];
  el('take').innerHTML=TK.filter(x=>!x.dp||deepOn()).map(x=>`<li>${L(x)}</li>`).join('');
  const m=el('maid'); m.querySelector('.k').textContent=L(t2('Memory aid','Huskeregel'));
  m.querySelector('b').textContent=L(t2('Variation east, magnetic least; variation west, magnetic best','Variation east, magnetic least; variation west, magnetic best'));
  m.querySelector('p').textContent=L(t2('From true to magnetic: with easterly variation the magnetic figure is smaller (subtract), with westerly it is bigger (add). The same rhyme takes you on from magnetic to compass with deviation. Going the other way, from compass or magnetic back to true, reverse it.','Fra rettvisende til magnetisk: med østlig misvisning blir det magnetiske tallet mindre (trekk fra), med vestlig blir det større (legg til). Det samme rimet tar deg videre fra magnetisk til kompass med deviasjon. Går du andre veien, fra kompass eller magnetisk tilbake til rettvisende, snur du det.')); }

LAB.quiz(el('qbox'),'gennav',()=>LAB.shuffle([
 {q:t2('TAS 300 kt, desired track 090°, wind 360/30. Which heading holds the track?','TAS 300 kt, ønsket track 090°, vind 360/30. Hvilken heading holder tracken?'),a:[t2('About 084°','Rundt 084°'),t2('About 096°','Rundt 096°'),t2('090°: the wind is across, not along','090°: vinden er på tvers, ikke langs')],c:0,e:t2('Wind from the left: point the nose left, into wind. WCA ≈ 30 / 300 × 60 = 6°, so about 084°.','Vind fra venstre: pek nesen til venstre, opp i vinden. WCA ≈ 30 / 300 × 60 = 6°, altså rundt 084°.')},
 {q:t2('What is drift?','Hva er avdrift?'),a:[t2('The angle between heading and track','Vinkelen mellom heading og track'),t2('The angle between true and magnetic north','Vinkelen mellom rettvisende og magnetisk nord'),t2('The difference between TAS and GS','Forskjellen mellom TAS og GS')],c:0,e:t2('Drift is measured from heading to track; the angle between true and magnetic north is variation.','Avdrift måles fra heading til track; vinkelen mellom rettvisende og magnetisk nord er misvisning.')},
 {q:t2('True track 030°, variation 6° E. Magnetic track?','Rettvisende track 030°, misvisning 6° Ø. Magnetisk track?'),a:[t2('024°','024°'),t2('036°','036°'),t2('030°','030°')],c:0,e:t2('Variation east, magnetic least: 030 − 6 = 024°.','Østlig misvisning, magnetisk minst: 030 − 6 = 024°.')},
 {q:t2('Magnetic heading 250°, deviation 3° W. Compass heading?','Magnetisk heading 250°, deviasjon 3° V. Kompassheading?'),a:[t2('253°','253°'),t2('247°','247°'),t2('250°: deviation only applies on the ground','250°: deviasjon gjelder bare på bakken')],c:0,e:t2('Deviation west, compass best: 250 + 3 = 253°.','Vestlig deviasjon, kompass størst: 250 + 3 = 253°.')},
 {q:t2('You are 5 NM right of track after 50 NM, with 100 NM to go. How much do you turn left to fly direct to the destination?','Du er 5 NM til høyre for track etter 50 NM, med 100 NM igjen. Hvor mye svinger du til venstre for å fly direkte til målet?'),a:[t2('9°','9°'),t2('6°','6°'),t2('3°','3°')],c:0,e:t2('Track error 5 / 50 × 60 = 6°, closing angle 5 / 100 × 60 = 3°: turn 9° left.','Trackfeil 5 / 50 × 60 = 6°, lukkevinkel 5 / 100 × 60 = 3°: sving 9° til venstre.')},
 {q:t2('A headwind of 20 kt on a 120 NM leg at TAS 100 kt. Time?','20 kt motvind på en etappe på 120 NM med TAS 100 kt. Tid?'),a:[t2('1 h 30 min','1 t 30 min'),t2('1 h 12 min','1 t 12 min'),t2('1 h','1 t')],c:0,e:t2('GS = 100 − 20 = 80 kt; 120 / 80 = 1.5 h.','GS = 100 − 20 = 80 kt; 120 / 80 = 1,5 t.')},
 {q:t2('Flying a great circle westbound in the northern hemisphere, the true track…','Når du flyr en storsirkel vestover på den nordlige halvkule, vil den rettvisende tracken …'),a:[t2('decreases along the route','minke langs ruten'),t2('increases along the route','øke langs ruten'),t2('stays constant','holde seg konstant')],c:0,e:t2('The great circle lies on the pole side: westbound its track starts more northerly than the rhumb-line track and ends more southerly, so the track decreases.','Storsirkelen ligger på polsiden: vestover starter tracken mer nordlig enn loksodromtracken og slutter mer sørlig, så tracken minker.')},
 {q:t2('Two places at 60° N are 10° of longitude apart. How far apart are they along the parallel?','To steder på 60° N ligger 10 lengdegrader fra hverandre. Hvor langt er det langs breddesirkelen?'),a:[t2('300 NM','300 NM'),t2('600 NM','600 NM'),t2('520 NM','520 NM')],c:0,e:t2('Departure = 600′ × cos 60° = 300 NM.','Departure = 600′ × cos 60° = 300 NM.')},
 {q:t2('dlong 20°, mean latitude 30° N. What is the conversion angle?','dlong 20°, middelbredde 30° N. Hva er konverteringsvinkelen?'),a:[t2('5°','5°'),t2('10°','10°'),t2('17°','17°')],c:0,e:t2('Convergency = 20 × sin 30° = 10°; the conversion angle is half: 5°.','Konvergens = 20 × sin 30° = 10°; konverteringsvinkelen er halvparten: 5°.')},
 {q:t2('On a Lambert conformal chart, a straight line drawn with a ruler is…','På et Lambert konformt kart er en rett linje trukket med linjal …'),a:[t2('very nearly a great circle','nesten en storsirkel'),t2('a rhumb line','en loksodrom'),t2('neither','ingen av delene')],c:0,e:t2('Chart convergency n × dlong is close to the Earth’s between the standard parallels.','Kartkonvergensen n × dlong ligger nær jordens mellom standardparallellene.')},
 {q:t2('On a Mercator chart a straight line is…','På et Mercatorkart er en rett linje …'),a:[t2('a rhumb line','en loksodrom'),t2('a great circle','en storsirkel'),t2('a great circle only near the pole','en storsirkel bare nær polen')],c:0,e:t2('The meridians are parallel, so a line crossing them all at the same angle is straight.','Meridianene er parallelle, så en linje som krysser alle i samme vinkel, blir rett.')},
 {q:t2('It is 1200 UTC. What is the local mean time at 10° E?','Klokken er 1200 UTC. Hva er lokal middeltid på 10° Ø?'),a:[t2('1240','1240'),t2('1120','1120'),t2('1300','1300')],c:0,e:t2('10° × 4 min = 40 min, and east is later: 1240.','10° × 4 min = 40 min, og øst er senere: 1240.')},
 {q:t2('600 NM sector. After an engine failure the groundspeed on is 400 kt and back is 500 kt. Where is the PET?','Etappe på 600 NM. Etter motorbortfall er groundspeed videre 400 kt og tilbake 500 kt. Hvor er PET?'),a:[t2('333 NM from A','333 NM fra A'),t2('267 NM from A','267 NM fra A'),t2('300 NM from A','300 NM fra A')],c:0,e:t2('PET = 600 × 500 / 900 = 333 NM: past the midpoint, into the headwind.','PET = 600 × 500 / 900 = 333 NM: forbi midtpunktet, mot motvinden.')},
 {q:t2('Any wind, head or tail, makes the PNR…','All vind, mot eller med, gjør at PNR …'),a:[t2('move closer to the departure','flytter seg nærmere avgangsplassen'),t2('move further from the departure','flytter seg lenger fra avgangsplassen'),t2('stay where it is','blir der den er')],c:0,e:t2('You lose more time on the slow leg than you gain on the fast one.','Du taper mer tid på den langsomme etappen enn du vinner på den raske.')},
 {q:t2('Same Mach number, but the air at cruise level is 20 °C colder. The TAS is…','Samme machtall, men luften i marsjhøyden er 20 °C kaldere. TAS-en blir …'),a:[t2('lower','lavere'),t2('higher','høyere'),t2('unchanged','uendret')],c:0,e:t2('The speed of sound falls with temperature, and TAS = M × a.','Lydhastigheten synker med temperaturen, og TAS = M × a.')}]).map(q=>{ const o=LAB.shuffle(q.a.map((_,i)=>i)); return {...q,a:o.map(i=>q.a[i]),c:o.indexOf(q.c)}; }),10);

/* ---------------- static strings, text, start ---------------- */
LAB.add({},{'General Navigation':'Generell navigasjon','General navigation':'Generell navigasjon','Birdbird Virtual Lab · Navigation and instrument procedures':'Birdbird Virtual Lab · Navigasjon og instrumentprosedyrer',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Test yourself':'3 · Test deg selv','Key concepts':'Nøkkelbegreper','Deep dive':'Dypdykk','The navigation lab':'Navigasjonslabben','Try it':'Prøv selv','Key points':'Det viktigste','Test yourself':'Test deg selv',
 'Controls':'Kontroller','Conditions':'Forhold','The leg':'Etappen','Off track':'Ut av track','Route':'Rute','After a failure':'Etter en feil','Scenarios':'Scenarier','Advanced':'Avansert','TAS from Mach':'TAS fra mach','Mode':'Modus','Sections':'Seksjoner',
 'Navigation figure. Drag around the compass rose to set the track.':'Navigasjonsfigur. Dra rundt kompassrosen for å sette tracken.'});
LAB.tx({lead:'Heading er dit nesen peker, track er dit du faktisk går, og vinden er forskjellen. Løs vindtrekanten slik en CRP-5 gjør, gjør den om til magnetisk heading, tid og drivstoff for etappen, og kom tilbake på track med 1 av 60-regelen. I Dypdykk følger du storsirkler over globusen og inn på kart, og finner PET og PNR.'});
function texts(){
  el('kin').textContent=L(t2('Ten ideas that carry most of general navigation. “Show in the model” sets the lab up so you can see it.','Ti ideer som bærer mesteparten av generell navigasjon. «Vis i modellen» setter opp labben så du kan se det.'));
  el('xLead').textContent=L(deepOn()?t2('Set the conditions on the left, or drag on the rose: the figure solves the wind triangle exactly and gives the heading, groundspeed, time and fuel. The mode buttons switch to off track, Earth and charts, and PET and PNR.','Sett forholdene til venstre, eller dra på rosen: figuren løser vindtrekanten eksakt og gir heading, groundspeed, tid og drivstoff. Modusknappene bytter til ut av track, jorden og kart, og PET og PNR.')
    :t2('Set the TAS, the track you want and the wind, or drag on the rose. The figure finds the heading and groundspeed, and the strip below gives the time and fuel for the leg.','Sett TAS, tracken du vil ha og vinden, eller dra på rosen. Figuren finner heading og groundspeed, og stripen under gir tid og drivstoff for etappen.'));
  el('tryLead').textContent=L(t2('Work it out first, type your answer and check it. Then set it up in the model to see why.','Regn det ut først, skriv svaret og sjekk det. Sett det så opp i modellen for å se hvorfor.'));
  el('foot').innerHTML=L(t2('<b>Model and limitations.</b> Teaching model, not for navigation. The wind triangle is exact for a constant wind (flat geometry, the same as a CRP-5). The Earth is a sphere of radius 10 800/π ≈ 3438 NM, so one minute of great-circle arc is exactly 1 NM; no ellipsoid. Convergency is shown both as the exam formula dlong × sin(mean latitude) and as the exact spherical value. Lambert standard parallels are placed one sixth in from each end of the route. The PET and PNR use one wind for the whole sector, the same fuel flow out and back, and illustrative failure-case speeds (80 % and 70 % of TAS); real values come from the aircraft manuals and the operational flight plan. Variation figures for Norway are from the World Magnetic Model 2025.','<b>Modell og begrensninger.</b> Opplæringsmodell, ikke for navigasjon. Vindtrekanten er eksakt for konstant vind (flat geometri, som på en CRP-5). Jorden er en kule med radius 10 800/π ≈ 3438 NM, så ett bueminutt på en storsirkel er nøyaktig 1 NM; ingen ellipsoide. Konvergens vises både med eksamensformelen dlong × sin(middelbredde) og som eksakt sfærisk verdi. Lambert-standardparallellene ligger en sjettedel inn fra hver ende av ruten. PET og PNR bruker én vind for hele etappen, samme forbruk ut og hjem, og illustrerende farter i feiltilfellene (80 % og 70 % av TAS); reelle verdier kommer fra flyets håndbøker og den operative færdplanen. Misvisningstallene for Norge er fra World Magnetic Model 2025.'));
  el('ddH').textContent=L(t2('Deep dive','Dypdykk')); }
function all(){ texts(); drawTabs(); drawCases(); drawRoutes(); drawPre(); drawTask(); drawDD(); drawTake(); machRo(); upd(); }
LAB.onLang(all);
document.addEventListener('labdepth',all);
LAB.start('gnav');
showKnow(); all();
/* old anchors keep working: #triangle, #sixty, #earth, #charts, #pet, #time */
const HM={'#triangle':'solve','#sixty':'off','#earth':'earth','#charts':'earth','#pet':'pet'};
if(HM[location.hash]){ if(location.hash==='#charts') S.proj='lcc'; setMode(HM[location.hash]); }
if(location.hash==='#time'){ const d=el('dd-time'); if(d){ d.open=true; requestAnimationFrame(()=>d.scrollIntoView({block:'center'})); } }
})();
