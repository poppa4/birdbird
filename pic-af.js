/* NORDAP – pic-af.js: "Automation and the two safety nets" for autoflight.html (uses corepic.js).
   A generic glass PFD (FMA on top, speed tape, attitude, altitude tape, vertical speed) climbing to a selected level with
   the mode change CLB → ALT* → ALT, then a navigation display with TCAS traffic (other, proximate, TA, RA) and the RA band
   on the vertical speed scale, then a terrain display and a pull-up.
   Generic Airbus-style symbology, illustrative values. TCAS II: TA about 35–48 s, RA about 20–35 s before CPA, by altitude. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT,jet}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const GRN='#3FE08A', CYA='#3FD6F0', MAG='#F25CC8', AMB='#F7B23B', RED='#FF4B3A', WH='#F2F5F7';

const steps=[
 {t:{en:'Read the FMA first',no:'Les FMA først'},
  d:{en:'The flight mode annunciator on top of the PFD says what the automation is <em>doing now</em> (green) and what is <em>armed</em> (blue). Columns: thrust · vertical · lateral. Read it aloud after every change.',
     no:'Flygemodusvisningen øverst på PFD sier hva automatikken <em>gjør nå</em> (grønt) og hva som er <em>armert</em> (blått). Kolonner: skyv · vertikalt · sideveis. Les den høyt etter hver endring.'}},
 {t:{en:'Armed becomes active',no:'Armert blir aktiv'},
  d:{en:'Climbing in CLB towards FL120 with ALT armed. Near the level the vertical mode changes to <em>ALT*</em> (capture), then <em>ALT</em>, and the thrust to SPEED. You did nothing — you only know if you look.',
     no:'Stigning i CLB mot FL120 med ALT armert. Nær nivået bytter vertikalmodus til <em>ALT*</em> (fangst), så <em>ALT</em>, og skyvet til SPEED. Du gjorde ingenting — du vet det bare hvis du ser.'}},
 {t:{en:'TCAS · traffic advisory',no:'TCAS · trafikkråd'},
  d:{en:'TCAS interrogates other transponders and works in <em>seconds to the closest point</em>. About 40 s before: an amber circle and "TRAFFIC, TRAFFIC". Look, but <em>do not manoeuvre</em> on a TA.',
     no:'TCAS spør andre transpondere og regner i <em>sekunder til nærmeste punkt</em>. Omtrent 40 s før: en gul sirkel og «TRAFFIC, TRAFFIC». Se etter, men <em>ikke manøvrer</em> på en TA.'}},
 {t:{en:'TCAS · resolution advisory',no:'TCAS · unnvikelsesråd'},
  d:{en:'About 25 s before: a red square and "CLIMB, CLIMB". Autopilot and flight directors off, fly the pitch into the <em>green band</em> within about 5 s — even against ATC. Then: "TCAS RA".',
     no:'Omtrent 25 s før: en rød firkant og «CLIMB, CLIMB». Autopilot og flight directors av, fly nesen inn i <em>det grønne feltet</em> innen omtrent 5 s — selv mot ATC. Så: «TCAS RA».'}},
 {t:{en:'EGPWS · terrain ahead',no:'EGPWS · terreng foran'},
  d:{en:'EGPWS compares your position with a terrain database and looks ahead. Amber: terrain near your level. Red: above you. "TERRAIN AHEAD, PULL UP": <em>TOGA, pitch up to the limit, wings level</em>, until it stops.',
     no:'EGPWS sammenligner posisjonen med en terrengdatabase og ser fremover. Gult: terreng nær nivået ditt. Rødt: over deg. «TERRAIN AHEAD, PULL UP»: <em>TOGA, nesen opp til grensen, vingene rett</em>, til det stopper.'},
  go:{en:'Open the automation lab',no:'Åpne automatikklabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

/* ---------- PFD ---------- */
function pfd(g,x,y,w,h,s){
  rr(g,x,y,w,h,8); g.fillStyle='#05080b'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
  const fh=h*.15, fy=y+6, cw=(w-12)/3;
  for(let i=0;i<3;i++){ const cx=x+6+cw*i+cw/2; if(i){ g.strokeStyle='rgba(255,255,255,.25)'; g.lineWidth=1; g.beginPath(); g.moveTo(x+6+cw*i,fy+3); g.lineTo(x+6+cw*i,fy+fh-3); g.stroke(); }
    const m=s.fma[i]; if(m&&m[0]){ const fsz=Math.min(15,fh*.36); g.font=`600 ${fsz}px ${FONT.mono}`; const tw=g.measureText(m[0]).width; if(m[2]){ g.strokeStyle=WH; g.lineWidth=1.4; g.strokeRect(cx-tw/2-5,fy+fh*.1,tw+10,fh*.42); }
      txt(g,m[0],cx,fy+fh*.42,{mono:1,size:fsz,col:m[1]||GRN,al:'center'}); }
    const a=s.arm[i]; if(a) txt(g,a,cx,fy+fh*.88,{mono:1,size:Math.min(13,fh*.3),col:CYA,al:'center'}); }
  const ty=fy+fh+6, th=h-fh-18, tw=w*.16, ax=x+tw+12, aw=w-2*tw-36-w*.07, cx=ax+aw/2, cy=ty+th/2;
  g.save(); rr(g,ax,ty,aw,th,6); g.clip(); g.translate(cx,cy); g.rotate(-(s.roll||0)*Math.PI/180); const pp=(s.pitch||0)*th/40;
  g.fillStyle='#2D86D6'; g.fillRect(-aw,-th*1.5+pp,aw*2,th*1.5); g.fillStyle='#7A4E25'; g.fillRect(-aw,pp,aw*2,th*1.5);
  g.strokeStyle=WH; g.lineWidth=1.6; g.beginPath(); g.moveTo(-aw,pp); g.lineTo(aw,pp); g.stroke();
  for(let d=-20;d<=20;d+=5){ if(!d) continue; const yy=pp-d*th/40, l=d%10?aw*.08:aw*.16; g.lineWidth=1.2; g.beginPath(); g.moveTo(-l,yy); g.lineTo(l,yy); g.stroke(); if(!(d%10)) txt(g,String(Math.abs(d)),l+4,yy+4,{mono:1,size:10,col:WH}); }
  g.restore();
  if(s.fd!==false){ g.strokeStyle=GRN; g.lineWidth=2.5; g.beginPath(); g.moveTo(cx-aw*.32,cy); g.lineTo(cx+aw*.32,cy); g.moveTo(cx,cy-th*.28); g.lineTo(cx,cy+th*.28); g.stroke(); }
  g.strokeStyle='#111'; g.fillStyle=AMB; g.lineWidth=1; [-1,1].forEach(d=>{ g.beginPath(); g.rect(d<0?cx-aw*.38:cx+aw*.2,cy-3,aw*.18,6); g.fill(); g.stroke(); }); g.fillRect(cx-3,cy-3,6,6);
  // speed tape
  const sx=x+6, tp=s.spd, pxk=th/80;
  g.save(); rr(g,sx,ty,tw,th,4); g.fillStyle='#29323a'; g.fill(); g.clip();
  for(let v=Math.floor((tp-45)/10)*10;v<=tp+45;v+=10){ const yy=cy-(v-tp)*pxk; g.strokeStyle=WH; g.lineWidth=1; g.beginPath(); g.moveTo(sx+tw-8,yy); g.lineTo(sx+tw,yy); g.stroke(); if(!(v%20)) txt(g,String(v),sx+tw-12,yy+4,{mono:1,size:11,col:WH,al:'right'}); }
  g.restore(); g.fillStyle='#000'; g.strokeStyle=AMB; g.lineWidth=1.5; g.beginPath(); g.rect(sx+2,cy-11,tw-4,22); g.fill(); g.stroke(); txt(g,String(Math.round(tp)),sx+tw/2,cy+5,{mono:1,size:13,col:GRN,al:'center',w:600});
  if(s.tspd){ const yy=clamp(cy-(s.tspd-tp)*pxk,ty+6,ty+th-6); g.fillStyle=MAG; g.beginPath(); g.moveTo(sx+tw,yy); g.lineTo(sx+tw+7,yy-5); g.lineTo(sx+tw+7,yy+5); g.closePath(); g.fill(); }
  // altitude tape
  const lx=ax+aw+10, alt=s.alt, apx=th/1200;
  g.save(); rr(g,lx,ty,tw,th,4); g.fillStyle='#29323a'; g.fill(); g.clip();
  for(let a=Math.floor((alt-700)/100)*100;a<=alt+700;a+=100){ const yy=cy-(a-alt)*apx; g.strokeStyle=WH; g.lineWidth=1; g.beginPath(); g.moveTo(lx,yy); g.lineTo(lx+7,yy); g.stroke(); if(!(a%500)) txt(g,nf(a),lx+10,yy+4,{mono:1,size:10.5,col:WH}); }
  if(s.sel!=null){ const yy=cy-(s.sel-alt)*apx; g.fillStyle=CYA; g.fillRect(lx,yy-1.5,tw,3); }
  g.restore();
  if(s.sel!=null){ const yy=cy-(s.sel-alt)*apx, out=yy<ty+4; txt(g,`FL${nf(s.sel/100)}`,lx+tw/2,out?ty-6:Math.max(ty+14,yy-6),{mono:1,size:11,col:CYA,al:'center',w:600}); }
  g.fillStyle='#000'; g.strokeStyle=AMB; g.lineWidth=1.5; g.beginPath(); g.rect(lx+2,cy-12,tw-4,24); g.fill(); g.stroke(); txt(g,nf(Math.round(alt/10)*10),lx+tw/2,cy+5,{mono:1,size:13,col:GRN,al:'center',w:600});
  // vertical speed scale
  const vx=lx+tw+6, vw=w*.07, V=fpm=>{ const k=clamp(fpm/6000,-1,1); return cy-Math.sign(k)*Math.sqrt(Math.abs(k))*th*.44; };
  g.fillStyle='#29323a'; rr(g,vx,ty+th*.04,vw,th*.92,4); g.fill();
  if(s.raRed){ g.fillStyle='rgba(255,75,58,.85)'; g.fillRect(vx+1,V(s.raRed[1]),vw*.42,V(s.raRed[0])-V(s.raRed[1])); }
  if(s.ra){ g.fillStyle='rgba(63,224,138,.95)'; g.fillRect(vx+1,V(s.ra[1]),vw*.42,V(s.ra[0])-V(s.ra[1])); }
  [-6,-2,-1,0,1,2,6].forEach(k=>{ const yy=V(k*1000); g.strokeStyle=WH; g.lineWidth=1; g.beginPath(); g.moveTo(vx+vw*.5,yy); g.lineTo(vx+vw*.7,yy); g.stroke(); if(Math.abs(k)===2||Math.abs(k)===6) txt(g,String(Math.abs(k)),vx+vw*.74,yy+4,{mono:1,size:9.5,col:WH}); });
  g.strokeStyle=GRN; g.lineWidth=2.6; g.beginPath(); g.moveTo(vx+vw+10,cy); g.lineTo(vx+vw*.42,V(s.vs)); g.stroke(); }

/* ---------- ND (arc mode) ---------- */
function nd(g,x,y,w,h,o){ rr(g,x,y,w,h,8); g.fillStyle='#05080b'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
  const cx=x+w/2, cy=y+h*.9, R=Math.min(h*.8,w*.44);
  g.save(); rr(g,x,y,w,h,8); g.clip();
  if(o.terrain) o.terrain(cx,cy,R);
  g.strokeStyle=WH; g.lineWidth=1.4; g.beginPath(); g.arc(cx,cy,R,Math.PI*1.2,Math.PI*1.8); g.stroke();
  g.setLineDash([3,5]); g.beginPath(); g.arc(cx,cy,R*.5,Math.PI*1.2,Math.PI*1.8); g.stroke(); g.setLineDash([]);
  for(let d=-50;d<=50;d+=10){ const a=(d-90)*Math.PI/180, l=d%30?6:11; g.beginPath(); g.moveTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R); g.lineTo(cx+Math.cos(a)*(R-l),cy+Math.sin(a)*(R-l)); g.stroke(); }
  txt(g,(o.range||10)/2+'',cx-R*.5*Math.cos(Math.PI*.2)-6,cy-R*.5*Math.sin(Math.PI*.2)+4,{mono:1,size:10,col:CYA,al:'right'});
  g.fillStyle=AMB; g.beginPath(); g.moveTo(cx,cy-12); g.lineTo(cx+8,cy+6); g.lineTo(cx,cy+2); g.lineTo(cx-8,cy+6); g.closePath(); g.fill();
  g.restore(); return {cx,cy,R}; }
function tcasSym(g,x,y,kind,rel,up){ const s=8;
  if(kind==='other'){ g.strokeStyle=CYA; g.lineWidth=1.6; g.beginPath(); g.moveTo(x,y-s); g.lineTo(x+s,y); g.lineTo(x,y+s); g.lineTo(x-s,y); g.closePath(); g.stroke(); }
  else if(kind==='prox'){ g.fillStyle=CYA; g.beginPath(); g.moveTo(x,y-s); g.lineTo(x+s,y); g.lineTo(x,y+s); g.lineTo(x-s,y); g.closePath(); g.fill(); }
  else if(kind==='ta'){ g.fillStyle=AMB; g.beginPath(); g.arc(x,y,s,0,7); g.fill(); }
  else { g.fillStyle=RED; g.fillRect(x-s,y-s,2*s,2*s); }
  if(rel==null) return;
  const col=kind==='ra'?RED:kind==='ta'?AMB:CYA; txt(g,(rel>=0?'+':'−')+String(Math.abs(rel)).padStart(2,'0'),x,y+(rel>=0?-s-5:s+14),{mono:1,size:11,col,al:'center',w:600});
  if(up) txt(g,up>0?'↑':'↓',x+s+4,y+5,{mono:1,size:13,col,w:700}); }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const sA=1-at(p,2,.7), tA=at(p,2,.7)*(1-at(p,4,.7)), eA=at(p,4,.7);
  if(sA>0.01){ g.save(); g.globalAlpha=sA;
    const cyc=p<.6?0:clamp(((tm*.09)%1.4)/1.15,0,1), alt=p<.6?9400:lerp(8600,12000,1-Math.pow(1-cyc,2.2)), sel=12000;
    const vs=p<.6?1800:lerp(2200,0,clamp((alt-10800)/1200,0,1)), mode=alt<11000?0:alt<11950?1:2;
    const fma=mode===0?[['THR CLB',GRN],['CLB',GRN],['NAV',GRN]]:mode===1?[['THR CLB',GRN],['ALT*',GRN,true],['NAV',GRN]]:[['SPEED',GRN,true],['ALT',GRN,true],['NAV',GRN]];
    const arm=mode===0?['','ALT','']:['','',''];
    const pw=sm?W*.94:W*.52, px=sm?W*.03:W*.04, ph=sm?H*.6:H*.84, py=sm?H*.03:H*.1;
    pfd(g,px,py,pw,ph,{spd:p<.6?280:lerp(290,250,clamp((alt-11500)/500,0,1)),tspd:250,alt,sel,vs,pitch:lerp(7,2.5,mode/2),fma,arm});
    if(!sm){ const cw=(pw-12)/3; ['THRUST','VERTICAL','LATERAL'].forEach((t,i)=>txt(g,L({en:t,no:['SKYV','VERTIKALT','SIDEVEIS'][i]}),px+6+cw*i+cw/2,py-8,{mono:1,size:10,col:'#8E99A4',al:'center'}));
      const nx=W*.6, ly=H*.12; pill(g,L({en:'green: active now',no:'grønt: aktiv nå'}),nx,ly,{size:11.5,col:GRN}); pill(g,L({en:'blue: armed, next',no:'blått: armert, neste'}),nx,ly+30,{size:11.5,col:CYA}); pill(g,L({en:'box: just changed (10 s)',no:'ramme: nettopp endret (10 s)'}),nx,ly+60,{size:11.5,col:WH}); }
    const sx0=sm?W*.08:W*.62, sx1=sm?W*.94:W*.96, sy0=sm?H*.72:H*.5, sy1=sm?H*.94:H*.88, Y=a=>sy1-(sy1-sy0)*(a-8000)/4800;
    rr(g,sx0-8,sy0-24,sx1-sx0+16,sy1-sy0+42,8); g.fillStyle='rgba(10,15,20,.75)'; g.fill(); g.strokeStyle='rgba(255,255,255,.1)'; g.stroke();
    txt(g,L({en:'SIDE VIEW',no:'SIDEBILDE'}),sx0,sy0-8,{mono:1,size:10*fs,col:'#8E99A4'});
    g.strokeStyle=CYA; g.lineWidth=1.4; g.setLineDash([5,4]); g.beginPath(); g.moveTo(sx0,Y(sel)); g.lineTo(sx1,Y(sel)); g.stroke(); g.setLineDash([]); txt(g,'FL120',sx1,Y(sel)-6,{mono:1,size:10.5*fs,col:CYA,al:'right'});
    const path=u=>{ const a=lerp(8600,12000,1-Math.pow(1-u,2.2)); return [lerp(sx0,sx1-20,u),Y(a)]; };
    const cu=p<.6?.3:cyc; g.strokeStyle=WH; g.lineWidth=2; g.beginPath(); for(let u=0;u<=cu;u+=.01){ const q=path(u); u?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]); } g.stroke();
    const q=path(cu); g.fillStyle=WH; g.beginPath(); g.arc(q[0],q[1],4,0,7); g.fill();
    const xu=a=>{ for(let u=0;u<=1;u+=.005){ if(lerp(8600,12000,1-Math.pow(1-u,2.2))>=a) return path(u)[0]; } return sx1; };
    const b1=xu(11000), b2=xu(11950); [[sx0,b1,'CLB',GRN],[b1,b2,'ALT*',AMB],[b2,sx1,'ALT',CYA]].forEach(([a,b,t,c])=>{ g.fillStyle=c+'40'; g.fillRect(a,sy1+6,b-a,7); txt(g,t,(a+b)/2,sy1+28,{mono:1,size:10.5*fs,col:c,al:'center'}); });
    g.restore(); }
  if(tA>0.01){ g.save(); g.globalAlpha=tA;
    const ra=at(p,3,.6), k=clamp(((tm*.08)%1.3)/1.1,0,1);
    const nw=sm?W*.94:W*.44, nh=sm?H*.44:H*.66, nx0=sm?W*.03:W*.04, ny0=sm?H*.03:H*.06;
    const N=nd(g,nx0,ny0,nw,nh,{range:10});
    tcasSym(g,N.cx-N.R*.55,N.cy-N.R*.62,'other',+25); tcasSym(g,N.cx+N.R*.62,N.cy-N.R*.25,'prox',-15);
    const d=lerp(.85,.3,ra>.5?clamp(k*1.2+.4,0,1):k), ix=N.cx+N.R*d*.5, iy=N.cy-N.R*d*.95;
    tcasSym(g,ix,iy,ra>.5?'ra':'ta',ra>.5?-2:-4,1);
    pill(g,ra>.5?'"CLIMB, CLIMB"':'"TRAFFIC, TRAFFIC"',N.cx,ny0+nh+22,{mono:1,size:13*fs,col:ra>.5?RED:AMB,al:'center'});
    const pw=sm?W*.94:W*.46, ph=sm?H*.42:H*.66, px=sm?W*.03:W*.51, py=sm?H*.55:H*.06;
    const ph2=((tm*.25)%2), vs=ra>.5?lerp(0,1800,clamp(ph2,0,1)):0;
    pfd(g,px,py,pw,ph,{spd:250,alt:12000+vs*.05,sel:12000,vs,pitch:ra>.5?lerp(2,8,clamp(ph2,0,1)):2,fma:[['SPEED',GRN],['ALT',GRN],['NAV',GRN]],arm:['','',''],fd:ra<.5,ra:ra>.5?[1500,2000]:null,raRed:ra>.5?[-6000,1500]:null});
    if(!sm) pill(g,ra>.5?L({en:'AP off · fly into the green',no:'AP av · fly inn i det grønne'}):L({en:'TA: look, do not manoeuvre',no:'TA: se, ikke manøvrer'}),px+pw/2,py+ph+22,{size:12,col:ra>.5?GRN:AMB,al:'center'});
    if(!sm){ const lx=nx0+14, ly=ny0+nh+58; [['other',L({en:'other',no:'annen'})],['prox',L({en:'proximate',no:'nær'})],['ta','TA'],['ra','RA']].forEach(([kk,t],i)=>{ const x=lx+[0,.24,.56,.74][i]*nw; tcasSym(g,x+8,ly,kk,null); txt(g,t,x+22,ly+4,{size:11,col:'#C9D2DA'}); }); }
    g.restore(); }
  if(eA>0.01){ g.save(); g.globalAlpha=eA;
    const nw=sm?W*.94:W*.42, nh=sm?H*.44:H*.66, nx0=sm?W*.03:W*.04, ny0=sm?H*.03:H*.06;
    const pull=((tm*.12)%1)>.45;
    nd(g,nx0,ny0,nw,nh,{range:10,terrain:(cx,cy,R)=>{ const blobs=[[-.38,-.5,.28,'rgba(30,140,60,.6)'],[.4,-.42,.26,'rgba(30,140,60,.55)'],[.02,-.6,.24,'rgba(247,178,59,.7)'],[.1,-.76,.18,'rgba(255,75,58,.85)'],[-.22,-.82,.16,'rgba(247,178,59,.6)']];
      blobs.forEach(([bx,by,br,c])=>{ for(let i=0;i<90;i++){ const a=i*2.4, r=Math.sqrt(i/90)*br*R; g.fillStyle=c; g.fillRect(cx+bx*R+Math.cos(a)*r,cy+by*R+Math.sin(a)*r,3.2,3.2); } }); }});
    pill(g,pull?'"PULL UP"':'"TERRAIN AHEAD"',nx0+nw/2,ny0+nh+22,{mono:1,size:13*fs,col:pull?RED:AMB,al:'center'});
    const sx0=sm?W*.06:W*.5, sx1=sm?W*.96:W*.96, sy0=sm?H*.56:H*.06, sy1=sm?H*.96:H*.9;
    rr(g,sx0-8,sy0,sx1-sx0+16,sy1-sy0,8); g.fillStyle='rgba(10,15,20,.6)'; g.fill(); g.strokeStyle='rgba(255,255,255,.1)'; g.stroke();
    const terr=x=>sy1-(sy1-sy0)*(.1+.62*Math.exp(-Math.pow((x-sx0)/(sx1-sx0)-.72,2)/.012)+.12*Math.exp(-Math.pow((x-sx0)/(sx1-sx0)-.45,2)/.02));
    const lvl=sy0+(sy1-sy0)*.46;
    g.save(); g.beginPath(); g.moveTo(sx0,sy1); for(let x=sx0;x<=sx1;x+=3) g.lineTo(x,terr(x)); g.lineTo(sx1,sy1); g.closePath(); g.clip();
    g.fillStyle='#27402c'; g.fillRect(sx0,sy0,sx1-sx0,sy1-sy0); g.fillStyle='rgba(255,75,58,.65)'; g.fillRect(sx0,sy0,sx1-sx0,lvl-sy0); g.fillStyle='rgba(247,178,59,.55)'; g.fillRect(sx0,lvl,sx1-sx0,(sy1-sy0)*.12); g.restore();
    const kk=(tm*.12)%1, ax=lerp(sx0+20,sx0+(sx1-sx0)*.58,kk), up=kk>.45, ay=up?lvl-Math.pow((kk-.45)/.55,1.5)*(sy1-sy0)*.42:lvl;
    g.strokeStyle='rgba(247,178,59,.7)'; g.setLineDash([4,4]); g.beginPath(); g.moveTo(ax,ay); g.lineTo(ax+(sx1-sx0)*.3,ay+(sy1-sy0)*.05); g.stroke(); g.setLineDash([]);
    jet(g,{x:ax,y:ay+2.4*Math.max(1.2,W/520),s:Math.max(1.2,W/520),pitch:up?14:0,gear:0,tm});
    txt(g,L({en:'red: terrain above you · amber: near your level',no:'rødt: terreng over deg · gult: nær nivået ditt'}),sx0+8,sy0+18,{size:10.5*fs,col:'#fff'});
    if(up) pill(g,L({en:'TOGA · pitch up · wings level',no:'TOGA · nesen opp · vingene rett'}),(sx0+sx1)/2,sy0+44,{size:11.5*fs,col:'#fff',al:'center',fit:W});
    g.restore(); }
  txt(g,L({en:'generic symbology · illustrative',no:'generisk symbologi · illustrerende'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.6,aspectSm:1/1.3,dwell:7,
    title:{en:'Automation and the two safety nets',no:'Automatikk og de to sikkerhetsnettene'},
    sub:{en:'Know what the autopilot is doing by reading the FMA, then the two warnings that tell you to take over: TCAS and EGPWS.',no:'Vit hva autopiloten gjør ved å lese FMA, og så de to varslene som sier at du skal ta over: TCAS og EGPWS.'},
    label:{en:'Animated glass PFD with the FMA through a climb and level capture, a navigation display with TCAS traffic and the resolution advisory band, then a terrain display and a pull-up.',no:'Animert glass-PFD med FMA gjennom en stigning og nivåfangst, en navigasjonsvisning med TCAS-trafikk og RA-feltet, deretter en terrengvisning og en pull-up.'},
    foot:{en:'Generic Airbus-style symbology; TCAS II times vary with altitude. Follow your operator\'s procedures.',no:'Generisk symbologi i Airbus-stil; TCAS II-tidene varierer med høyden. Følg operatørens prosedyrer.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
