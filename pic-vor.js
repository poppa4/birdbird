/* NORDAP – pic-vor.js: "VOR: radials, the CDI and TO/FROM" for radionav.html (uses corepic.js).
   Plan view of a VOR with radials, an aircraft on a selected course, the CDI with dots (2° per dot), the TO/FROM flag,
   reverse sensing, then DME slant range and the ADF/RMI bearing for comparison. Illustrative. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const d2r=Math.PI/180, wrap=h=>((h%360)+360)%360;

const steps=[
 {t:{en:'A VOR transmits 360 radials',no:'En VOR sender 360 radialer'},
  d:{en:'Each radial is a <em>magnetic bearing FROM the station</em>. Radial 090 runs out to the east. The receiver works out which radial you are on, whatever your heading.',
     no:'Hver radial er en <em>magnetisk peiling FRA stasjonen</em>. Radial 090 går ut mot øst. Mottakeren finner ut hvilken radial du er på, uansett kurs.'}},
 {t:{en:'Select a course · the CDI',no:'Velg en kurs · CDI'},
  d:{en:'Turn the OBS to a course. The needle shows how far you are from it: <em>full scale ±10°</em>, about <em>2° per dot</em>. Needle left: the course is to your left — fly towards the needle.',
     no:'Drei OBS til en kurs. Nålen viser hvor langt du er fra den: <em>fullt utslag ±10°</em>, omtrent <em>2° per prikk</em>. Nålen til venstre: kursen ligger til venstre — fly mot nålen.'}},
 {t:{en:'TO or FROM',no:'TO eller FROM'},
  d:{en:'The flag tells you whether the selected course takes you <em>to</em> the station or <em>away from</em> it. It flips as you pass abeam the station, at right angles to the course. It does not depend on your heading.',
     no:'Flagget forteller om den valgte kursen fører deg <em>til</em> stasjonen eller <em>bort fra</em> den. Det skifter når du passerer tvers av stasjonen, vinkelrett på kursen. Det avhenger ikke av kursen din.'}},
 {t:{en:'Reverse sensing',no:'Omvendt visning'},
  d:{en:'Fly the opposite way to the selected course and the needle points <em>away</em> from the course. Always set the OBS to the way you are going, so TO/FROM and the needle make sense.',
     no:'Flyr du motsatt vei av valgt kurs, peker nålen <em>bort</em> fra kursen. Still alltid OBS til den veien du skal, så TO/FROM og nålen gir mening.'}},
 {t:{en:'DME · slant range',no:'DME · skrårange'},
  d:{en:'DME measures the straight-line distance to the station, <em>including your height</em>. Overhead at 6 000 ft it still reads about <em>1 NM</em>. The error is small when you are far away.',
     no:'DME måler den rette avstanden til stasjonen, <em>inkludert høyden din</em>. Rett over på 6 000 ft viser den fortsatt omtrent <em>1 NM</em>. Feilen er liten når du er langt unna.'},
  go:{en:'Fly it in the navigation simulator',no:'Fly det i navigasjonssimulatoren',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function cdi(g,cx,cy,r,dev,flag,obs){ // dev in degrees (positive: needle right)
  g.save(); g.fillStyle='#0b1116'; g.strokeStyle='rgba(255,255,255,.25)'; g.lineWidth=1.5; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill(); g.stroke();
  for(let i=-5;i<=5;i++){ if(!i) continue; g.fillStyle='rgba(255,255,255,.7)'; g.beginPath(); g.arc(cx+i*r*.15,cy+r*.12,2.2,0,7); g.fill(); }
  g.strokeStyle='rgba(255,255,255,.5)'; g.lineWidth=1; g.beginPath(); g.arc(cx,cy+r*.12,r*.08,0,7); g.stroke();
  const nx=cx+clamp(dev/10,-1,1)*r*.75; g.strokeStyle='#fff'; g.lineWidth=3; g.beginPath(); g.moveTo(nx,cy-r*.7); g.lineTo(nx,cy+r*.7); g.stroke();
  g.fillStyle='#000'; rr(g,cx+r*.32,cy-r*.52,r*.4,r*.22,3); g.fill(); txt(g,flag,cx+r*.52,cy-r*.36,{mono:1,size:r*.15,col:flag==='OFF'?'#FF8A78':'#fff',al:'center',w:600});
  pill(g,`OBS ${String(obs).padStart(3,'0')}`,cx,cy+r+16,{mono:1,size:11,col:C.amber,al:'center'}); g.restore(); }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const vx=W*(sm?.5:.36), vy=H*(sm?.36:.5), R=Math.min(W*(sm?.42:.28),H*(sm?.32:.44));
  // radials
  const rad=at(p,0,.8);
  for(let d=0;d<360;d+=10){ const a=(d-90)*d2r, maj=d%30===0; g.strokeStyle=`rgba(127,198,238,${maj?.22:.08})`; g.lineWidth=1; g.beginPath(); g.moveTo(vx,vy); g.lineTo(vx+Math.cos(a)*R*(maj?1:.9),vy+Math.sin(a)*R*(maj?1:.9)); g.stroke();
    if(maj) txt(g,String(d).padStart(3,'0'),vx+Math.cos(a)*(R+14),vy+Math.sin(a)*(R+14)+4,{mono:1,size:9.5*fs,col:'#7F8B96',al:'center'}); }
  // pulsing signal ring
  for(let k=0;k<3;k++){ const ph=((tm*.4+k/3)%1); g.strokeStyle=`rgba(127,198,238,${.25*(1-ph)})`; g.beginPath(); g.arc(vx,vy,ph*R,0,7); g.stroke(); }
  // station symbol
  g.strokeStyle='#9FD4F2'; g.lineWidth=2; g.beginPath(); for(let i=0;i<6;i++){ const a=i*Math.PI/3; i?g.lineTo(vx+Math.cos(a)*9,vy+Math.sin(a)*9):g.moveTo(vx+Math.cos(a)*9,vy+Math.sin(a)*9); } g.closePath(); g.stroke(); g.fillStyle='#9FD4F2'; g.beginPath(); g.arc(vx,vy,2.5,0,7); g.fill();
  // highlight radial 090 in step 1
  if(p<1.2){ const a=0; g.strokeStyle=C.blue; g.lineWidth=2.5; g.beginPath(); g.moveTo(vx,vy); g.lineTo(vx+R,vy); g.stroke(); pill(g,L({en:'radial 090: FROM the station',no:'radial 090: FRA stasjonen'}),vx+R*.55,vy-16,{size:10.5*fs,col:'#9FD4F2',al:'center',fit:W}); }
  // aircraft path: selected course 360 (northbound) passing west of... we use OBS 360, aircraft flying north on track ~006 offset
  const obs=p<3?360:360;
  const k=(tm*.06)%1;
  let ax, ay, hdg, dev, flag;
  const offX=-R*.05;                                  // aircraft 0.1R west of the course line (needle right)
  if(p<3.0){ ax=vx+offX; ay=lerp(vy+R*.95,vy-R*.95,k); hdg=0; }
  else { ax=vx+offX; ay=lerp(vy-R*.95,vy+R*.95,k); hdg=180; }
  // radial the aircraft is on (bearing FROM station)
  const brgFrom=wrap(Math.atan2(ax-vx,-(ay-vy))/d2r);
  // CDI: deviation from the selected course line (radial obs or obs+180 depending on TO/FROM)
  const toCourse=wrap(brgFrom+180);
  const diffTo=((obs-toCourse+540)%360)-180, diffFrom=((obs-brgFrom+540)%360)-180;
  const isTo=Math.abs(diffTo)<90; flag=isTo?'TO':'FROM';
  dev=isTo?-diffTo:diffFrom;                           // needle right when the course is to the right (for an aircraft flying the selected course)
  // dashed selected course line
  const cA=at(p,1,.6);
  if(cA>0.01){ g.save(); g.globalAlpha=cA; g.strokeStyle=C.amber; g.lineWidth=2; g.setLineDash([8,6]); g.beginPath(); g.moveTo(vx,vy+R); g.lineTo(vx,vy-R); g.stroke(); g.setLineDash([]); arrow(g,vx,vy-R*.6,vx,vy-R*.8,C.amber,{lw:2,head:9}); txt(g,L({en:'course 360',no:'kurs 360'}),vx+8,vy-R*.82,{mono:1,size:10.5*fs,col:C.amber}); g.restore(); }
  // TO / FROM areas (step 3)
  const tf=at(p,2,.7)*(1-at(p,4,.6));
  if(tf>0.01){ g.save(); g.globalAlpha=tf*.9; g.fillStyle='rgba(113,204,147,.07)'; g.fillRect(vx-R,vy,2*R,R); g.fillStyle='rgba(240,180,64,.07)'; g.fillRect(vx-R,vy-R,2*R,R);
    g.strokeStyle='rgba(255,255,255,.4)'; g.setLineDash([3,4]); g.beginPath(); g.moveTo(vx-R,vy); g.lineTo(vx+R,vy); g.stroke(); g.setLineDash([]);
    pill(g,'TO',vx+R*.75,vy+R*.5,{mono:1,size:12*fs,col:C.green,al:'center'}); pill(g,'FROM',vx+R*.75,vy-R*.5,{mono:1,size:12*fs,col:C.amber,al:'center'}); txt(g,L({en:'abeam: flag flips',no:'tvers: flagget skifter'}),vx-R+4,vy-6,{size:10*fs,col:'#AEB8C1'}); g.restore(); }
  // DME slant (step 5): side view inset
  const dm=at(p,4,.7);
  // aircraft
  g.save(); g.translate(ax,ay); g.rotate(hdg*d2r); g.fillStyle='#fff'; const s=1.2*fs; g.beginPath(); g.moveTo(0,-11*s); g.lineTo(1.8*s,-4*s); g.lineTo(10*s,1*s); g.lineTo(10*s,3*s); g.lineTo(1.8*s,1*s); g.lineTo(1.4*s,7*s); g.lineTo(4*s,9.5*s); g.lineTo(4*s,11*s); g.lineTo(0,10*s); g.lineTo(-4*s,11*s); g.lineTo(-4*s,9.5*s); g.lineTo(-1.4*s,7*s); g.lineTo(-1.8*s,1*s); g.lineTo(-10*s,3*s); g.lineTo(-10*s,1*s); g.lineTo(-1.8*s,-4*s); g.closePath(); g.fill(); g.restore();
  if(p>=.6) pill(g,`R${String(Math.round(brgFrom)).padStart(3,'0')}`,ax-14,ay,{mono:1,size:10*fs,col:'#9FD4F2',al:'right'});
  // instruments panel
  const ix=sm?W*.28:W*.8, iy=sm?H*.82:H*.36, ir=Math.min(sm?W*.13:W*.085,H*(sm?.11:.15));
  if(cA>0.01){ g.save(); g.globalAlpha=cA; cdi(g,ix,iy,ir,dev,flag,obs);
    const rev=at(p,3,.6)*(1-dm);
    txt(g,'CDI',ix,iy-ir-10,{mono:1,size:10*fs,col:'#AEB8C1',al:'center'});
    if(p>=1&&p<3) pill(g,dev>0?L({en:'needle right: course is right',no:'nålen høyre: kursen er til høyre'}):L({en:'needle left: course is left',no:'nålen venstre: kursen er til venstre'}),ix,iy+ir+44,{size:10.5*fs,col:'#fff',al:'center',fit:W});
    if(rev>0.01){ g.globalAlpha=cA*rev; pill(g,L({en:'flying 180 with OBS 360: needle points away',no:'flyr 180 med OBS 360: nålen peker bort'}),ix,iy+ir+44,{size:10.5*fs,col:'#FF8A78',al:'center',fit:W}); }
    g.restore(); }
  if(dm>0.01){ g.save(); g.globalAlpha=dm; const bx=sm?W*.54:W*.66, by=sm?H*.72:H*.62, bw=sm?W*.42:W*.3, bh=sm?H*.24:H*.3;
    rr(g,bx,by,bw,bh,8); g.fillStyle='rgba(10,15,20,.9)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
    txt(g,L({en:'SIDE VIEW · DME',no:'SIDEBILDE · DME'}),bx+10,by+16,{mono:1,size:9.5*fs,col:'#8E99A4'});
    const gx0=bx+16, gx1=bx+bw-16, gyb=by+bh-16, st=[gx0+(gx1-gx0)*.75,gyb], ac=[lerp(gx0+10,st[0],clamp(k*1.3,0,1)),by+bh*.38];
    g.strokeStyle='rgba(120,170,130,.6)'; g.beginPath(); g.moveTo(gx0,gyb); g.lineTo(gx1,gyb); g.stroke(); g.fillStyle='#9FD4F2'; g.fillRect(st[0]-3,gyb-8,6,8);
    g.strokeStyle=C.amber; g.lineWidth=2; g.beginPath(); g.moveTo(ac[0],ac[1]); g.lineTo(st[0],gyb-6); g.stroke(); g.fillStyle='#fff'; g.beginPath(); g.arc(ac[0],ac[1],4,0,7); g.fill();
    const ground=Math.abs(st[0]-ac[0])/((gx1-gx0)*.75)*6, slant=Math.hypot(ground,1);
    txt(g,`DME ${nf(slant,1)} NM`,bx+10,by+bh*.62,{mono:1,size:(sm?10:12)*fs,col:C.amber,w:600}); txt(g,`${L({en:'ground',no:'bakke'})} ${nf(ground,1)} NM · 6 000 ft`,bx+10,by+bh*.62+16*fs,{mono:1,size:(sm?9:10.5)*fs,col:'#AEB8C1'});
    g.restore(); }
  txt(g,L({en:'not to scale',no:'ikke i skala'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.15,dwell:7,
    title:{en:'VOR and DME: radials, the needle and TO/FROM',no:'VOR og DME: radialer, nålen og TO/FROM'},
    sub:{en:'The aircraft flies past the station while the CDI shows what the receiver sees. Watch the flag flip, then fly the wrong way to see reverse sensing.',no:'Flyet flyr forbi stasjonen mens CDI viser hva mottakeren ser. Se flagget skifte, og fly feil vei for å se omvendt visning.'},
    label:{en:'Animated plan view of a VOR with radials, an aircraft passing the station on a selected course, the CDI with TO/FROM flag, reverse sensing and a DME slant-range side view.',no:'Animert planbilde av en VOR med radialer, et fly som passerer stasjonen på valgt kurs, CDI med TO/FROM-flagg, omvendt visning og et sidebilde av DME-skrårange.'},
    foot:{en:'CDI full scale ±10° (about 2° per dot) for a VOR. DME slant range example at 6 000 ft. Schematic.',no:'CDI fullt utslag ±10° (omtrent 2° per prikk) for VOR. DME-eksempel på 6 000 ft. Skjematisk.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
