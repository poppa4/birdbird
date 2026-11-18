/* NORDAP – pic-hold.js: "The hold and its three entries" for holding.html (uses corepic.js).
   A standard (right-hand) hold drawn on a plan view with the ICAO entry sectors (70° line through the fix), then each entry
   flown by an aircraft, then timing and wind. Geometry follows ICAO Doc 8168: sector 1 parallel, 2 offset (teardrop, 30°),
   3 direct, ±5° flexibility. Not to scale; inbound course 090°. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const COL={dir:C.green,par:C.blue,tear:C.amber};

const steps=[
 {t:{en:'The hold: a racetrack on a fix',no:'Holdingen: en veddeløpsbane på et fiks'},
  d:{en:'Inbound to the fix on the <em>inbound course</em>, turn right (standard), fly the outbound leg for <em>1 minute</em> (1½ above FL 140), turn right again and track back in. Every turn is rate one, bank no more than 25°.',
     no:'Inn mot fikset på <em>innkursen</em>, sving til høyre (standard), fly utleggen i <em>1 minutt</em> (1½ over FL 140), sving til høyre igjen og spor tilbake inn. Hver sving er standardsving, maks 25° krengning.'}},
 {t:{en:'Three sectors, one line',no:'Tre sektorer, én linje'},
  d:{en:'Draw a line through the fix at <em>70° to the inbound course</em>, reaching into the holding side. With the inbound course it splits the area around the fix into three sectors. The sector you arrive from decides the entry (±5° at the edges).',
     no:'Trekk en linje gjennom fikset med <em>70° på innkursen</em>, inn på holdingsiden. Sammen med innkursen deler den området rundt fikset i tre sektorer. Sektoren du kommer fra, bestemmer inngangen (±5° i kantene).'}},
 {t:{en:'Sector 3 · direct',no:'Sektor 3 · direkte'},
  d:{en:'The big sector (180°). Arrive, <em>turn right straight into the hold</em> and fly the pattern. No special manoeuvre.',
     no:'Den store sektoren (180°). Kom inn, <em>sving til høyre rett inn i holdingen</em> og fly mønsteret. Ingen spesiell manøver.'}},
 {t:{en:'Sector 1 · parallel',no:'Sektor 1 · parallell'},
  d:{en:'Over the fix, turn onto the <em>outbound heading on the non-holding side</em> for 1 minute, turn left (back towards the holding side) to intercept the inbound course or return to the fix.',
     no:'Over fikset svinger du til <em>utkursen på ikke-holdingsiden</em> i 1 minutt, svinger til venstre (tilbake mot holdingsiden) for å avskjære innkursen eller returnere til fikset.'}},
 {t:{en:'Sector 2 · offset (teardrop)',no:'Sektor 2 · forskjøvet (dråpe)'},
  d:{en:'Over the fix, fly a heading <em>30° off the outbound course into the holding side</em> for 1 minute, then turn right onto the inbound course.',
     no:'Over fikset flyr du en kurs <em>30° fra utkursen inn på holdingsiden</em> i 1 minutt, og svinger så til høyre inn på innkursen.'}},
 {t:{en:'Wind · correct the outbound leg',no:'Vind · korriger utleggen'},
  d:{en:'Time the outbound leg so the <em>inbound leg takes 1 minute</em>. Use about <em>three times</em> the inbound drift correction on the outbound leg, so the turns still bring you back onto the course.',
     no:'Ta tiden på utleggen slik at <em>innleggen tar 1 minutt</em>. Bruk omtrent <em>tre ganger</em> innleggens avdriftskorreksjon på utleggen, så svingene fortsatt fører deg inn på kursen.'},
  go:{en:'Open the hold and approach lab',no:'Åpne holding- og innflygingslabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

/* geometry in "minutes": inbound course points east (+x), fix at origin, right-hand hold lies to the south (y +, screen down).
   Turn diameter d (rate one), leg length 1. */
const D=0.62;
function racetrack(n){ // points along the standard pattern starting at the fix, going outbound
  const pts=[], r=D/2;
  for(let i=0;i<=n;i++){ const a=-Math.PI/2+Math.PI*i/n; pts.push([r*Math.cos(a),r+r*Math.sin(a)]); }                 // turn 1 at the fix (to the south)
  for(let i=1;i<=n;i++){ pts.push([-i/n,D]); }                                                                       // outbound leg (west)
  for(let i=1;i<=n;i++){ const a=Math.PI/2+Math.PI*i/n; pts.push([-1+r*Math.cos(a),r+r*Math.sin(a)]); }              // turn 2
  for(let i=1;i<=n;i++){ pts.push([-1+i/n,0]); }                                                                     // inbound leg
  return pts; }
const RT=racetrack(24);
/* entry paths flown by a turtle: position in minutes (x east, y south), heading in degrees */
function fly(x,y,h,segs){ const p=[[x,y]], r=D/2;
  segs.forEach(sg=>{ if(sg.go!=null){ const n=Math.max(2,Math.round(sg.go*16)); for(let i=0;i<n;i++){ x+=Math.sin(h*Math.PI/180)*sg.go/n; y-=Math.cos(h*Math.PI/180)*sg.go/n; p.push([x,y]); } }
    else if(sg.to){ const n=Math.max(2,Math.round(Math.hypot(sg.to[0]-x,sg.to[1]-y)*16)); const x0=x,y0=y; for(let i=1;i<=n;i++){ x=lerp(x0,sg.to[0],i/n); y=lerp(y0,sg.to[1],i/n); p.push([x,y]); } h=Math.atan2(sg.to[0]-x0,-(sg.to[1]-y0))*180/Math.PI; }
    else { const dir=sg.turn>0?1:-1, deg=Math.abs(sg.turn), n=Math.max(4,Math.round(deg/6)); for(let i=0;i<n;i++){ const dh=dir*deg/n, arc=Math.PI*r*deg/n/180; h+=dh/2; x+=Math.sin(h*Math.PI/180)*arc; y-=Math.cos(h*Math.PI/180)*arc; h+=dh/2; p.push([x,y]); } } });
  return p; }
const PATHS={
  dir:fly(-0.55,-1.45,160,[{to:[0,0]},{turn:110},{go:1},{turn:180},{go:1}]),                                  // sector 3: from the north-west, heading about 160°
  par:fly(1.0,0.95,315,[{to:[0,0]},{turn:-45},{go:1},{turn:-200},{to:[-0.25,0]},{to:[0,0]},{turn:180},{go:1},{turn:180},{go:1}]),   // sector 1: from the south-east, heading 315°
  tear:fly(1.05,-1.05,225,[{to:[0,0]},{turn:15},{go:1},{turn:210},{to:[0,0]},{turn:180},{go:1},{turn:180},{go:1}])};             // sector 2: from the north-east, heading 225°

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const U=Math.min(W*(sm?.42:.3),H*.5), ox=W*(sm?.58:.5), oy=H*(sm?.36:.36);
  const X=x=>ox+x*U, Y=y=>oy+y*U;
  // compass rose
  g.strokeStyle='rgba(255,255,255,.06)'; g.lineWidth=1; g.beginPath(); g.arc(ox,oy,U*1.15,0,7); g.stroke();
  for(let d=0;d<360;d+=30){ const a=(d-90)*Math.PI/180; txt(g,String(d).padStart(3,'0'),ox+Math.cos(a)*U*1.24,oy+Math.sin(a)*U*1.24+4,{mono:1,size:9*fs,col:'#5F6D77',al:'center'}); }
  // sectors (step 2+)
  const a1=at(p,1,.8);
  if(a1>0.01){ g.save(); g.globalAlpha=a1; const R=U*1.12;
    // inbound course 090 → the 70° line on the holding side (south): through the fix at 070°/250° measured from the inbound course
    // sector boundaries in screen angles: course direction east = 0 rad. Line at 70° clockwise from the outbound direction... use ICAO picture:
    const ang=d=>(d-90)*Math.PI/180;  // compass → canvas
    // headings at which the aircraft ARRIVES; we shade by the direction FROM which it comes: sector 3 = arrivals from the holding side... draw standard figure around the fix
    const wedge=(d0,d1,col)=>{ g.fillStyle=col; g.beginPath(); g.moveTo(ox,oy); g.arc(ox,oy,R,ang(d0),ang(d1)); g.closePath(); g.fill(); };
    // boundaries for inbound 090, right-hand: the 70° line runs 020°–200°; the outbound course line is 270° (to the west) … sectors as seen around the fix
    wedge(200,20+360,'rgba(113,204,147,.10)');   // sector 3 (direct): the side you arrive from that is "behind" the hold, 180°
    wedge(90,200,'rgba(127,198,238,.13)');        // sector 1 (parallel): arriving from 090°–200°, 110°
    wedge(20,90,'rgba(240,180,64,.12)');          // sector 2 (offset): arriving from 020°–090°, 70°
    g.strokeStyle='rgba(255,255,255,.55)'; g.setLineDash([6,5]); g.beginPath(); g.moveTo(ox+Math.cos(ang(20))*R,oy+Math.sin(ang(20))*R); g.lineTo(ox+Math.cos(ang(200))*R,oy+Math.sin(ang(200))*R); g.stroke(); g.setLineDash([]);
    pill(g,L({en:'70° line',no:'70°-linjen'}),ox+Math.cos(ang(20))*R,oy+Math.sin(ang(20))*R-12,{size:10.5*fs,col:'#fff',al:'center',fit:W});
    const lab=(d,t,col)=>pill(g,t,ox+Math.cos(ang(d))*R*.78,oy+Math.sin(ang(d))*R*.78,{size:11*fs,col,al:'center',fit:W});
    lab(300,L({en:'3 · direct',no:'3 · direkte'}),C.green); lab(145,L({en:'1 · parallel',no:'1 · parallell'}),C.blue); lab(55,L({en:'2 · offset',no:'2 · forskjøvet'}),C.amber);
    g.restore(); }
  // the hold itself
  g.strokeStyle='rgba(255,255,255,.8)'; g.lineWidth=2.2; g.beginPath(); RT.forEach((q,i)=>{ i?g.lineTo(X(q[0]),Y(q[1])):g.moveTo(X(q[0]),Y(q[1])); }); g.stroke();
  // inbound course line extended
  g.strokeStyle='rgba(127,198,238,.35)'; g.setLineDash([3,5]); g.beginPath(); g.moveTo(X(-1.6),Y(0)); g.lineTo(X(.3),Y(0)); g.stroke(); g.setLineDash([]);
  arrow(g,X(-.55),Y(0),X(-.35),Y(0),'#fff',{lw:2,head:8}); arrow(g,X(-.35),Y(D),X(-.55),Y(D),'#fff',{lw:2,head:8});
  // fix
  g.fillStyle='#fff'; g.beginPath(); g.moveTo(X(0),Y(0)-8); g.lineTo(X(0)+7,Y(0)+5); g.lineTo(X(0)-7,Y(0)+5); g.closePath(); g.fill();
  txt(g,L({en:'FIX',no:'FIKS'}),X(0)+10,Y(0)-8,{mono:1,size:10*fs,col:'#fff'});
  // labels on the pattern (step 1)
  const a0=1-at(p,1.5,.6);
  if(a0>0.01){ g.save(); g.globalAlpha=a0;
    pill(g,L({en:'inbound 090° · 1 min',no:'inn 090° · 1 min'}),X(-.5),Y(0)-16,{size:10.5*fs,col:'#fff',al:'center'});
    pill(g,L({en:'outbound · 1 min',no:'ut · 1 min'}),X(-.5),Y(D)+18,{size:10.5*fs,col:'#fff',al:'center'});
    pill(g,L({en:'rate-one turn',no:'standardsving'}),X(D/2)+12,Y(D/2),{size:10.5*fs,col:'#AEB8C1'});
    pill(g,L({en:'holding side',no:'holdingside'}),X(-.5),Y(D/2),{size:10*fs,col:'#8E99A4',al:'center'});
    g.restore(); }
  // entries
  const flyE=(k,step,col)=>{ const a=at(p,step,.4)*(1-at(p,step+1,.4)); if(a<=0.01) return; const P=PATHS[k];
    const prog=clamp((p-step+0.6)/1.0,0,1), loop=(tm*0.09)%1, n=P.length, upto=Math.max(2,Math.floor(n*Math.min(1,0.15+loop*1.05)));
    g.save(); g.globalAlpha=a; g.strokeStyle=col; g.lineWidth=3; g.lineJoin='round'; g.beginPath(); for(let i=0;i<upto;i++){ const q=P[i]; i?g.lineTo(X(q[0]),Y(q[1])):g.moveTo(X(q[0]),Y(q[1])); } g.stroke();
    const q=P[upto-1], q0=P[Math.max(0,upto-3)], hd=Math.atan2(Y(q[1])-Y(q0[1]),X(q[0])-X(q0[0]));
    g.translate(X(q[0]),Y(q[1])); g.rotate(hd); g.fillStyle='#fff'; g.beginPath(); g.moveTo(10,0); g.lineTo(-7,-6); g.lineTo(-4,0); g.lineTo(-7,6); g.closePath(); g.fill(); g.restore(); };
  flyE('dir',2,COL.dir); flyE('par',3,COL.par); flyE('tear',4,COL.tear);
  // wind (step 6)
  const a5=at(p,5,.8);
  if(a5>0.01){ g.save(); g.globalAlpha=a5; const wx=W*(sm?.14:.14), wy=H*.18;
    arrow(g,wx,wy-40,wx,wy+20,C.blue,{lw:3,head:10}); txt(g,L({en:'wind from the north',no:'vind fra nord'}),wx,wy+38,{size:11*fs,col:C.blue,al:'center',w:600});
    // corrected outbound leg (crab north into wind: 3 × drift)
    // aircraft symbols crabbed into the wind: 15° on the outbound leg, 5° inbound
    const crab=(x,y,hdg,col)=>{ g.save(); g.translate(X(x),Y(y)); g.rotate((hdg-90)*Math.PI/180); g.fillStyle=col; g.beginPath(); g.moveTo(11,0); g.lineTo(-7,-6); g.lineTo(-4,0); g.lineTo(-7,6); g.closePath(); g.fill(); g.restore(); };
    [-.25,-.5,-.75].forEach(x=>{ crab(x,D,270+15,C.mag); crab(x,0,90-5,'#fff'); });
    pill(g,L({en:'inbound: 5° into wind → outbound: 15°',no:'inn: 5° mot vinden → ut: 15°'}),X(-.5),Y(D)+44,{size:10.5*fs,col:C.mag,al:'center',fit:W});
    pill(g,L({en:'adjust the outbound time so inbound = 1 min',no:'juster uttiden så inn = 1 min'}),X(-.5),Y(D)+70,{size:10.5*fs,col:'#fff',al:'center',fit:W});
    g.restore(); }
  txt(g,L({en:'right-hand hold · inbound 090° · not to scale',no:'høyrehåndsholding · inn 090° · ikke i skala'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.6,aspectSm:1/1.1,dwell:7,
    title:{en:'The hold and its three entries',no:'Holdingen og de tre inngangene'},
    sub:{en:'One racetrack, one 70° line, three sectors. Watch each entry flown, then the wind correction.',no:'Én veddeløpsbane, én 70°-linje, tre sektorer. Se hver inngang flydd, og så vindkorreksjonen.'},
    label:{en:'Animated plan view of a right-hand hold with the 70° line and the three entry sectors, each entry flown in turn.',no:'Animert planbilde av en høyrehåndsholding med 70°-linjen og de tre inngangssektorene, hver inngang flydd etter tur.'},
    foot:{en:'ICAO Doc 8168 (PANS-OPS) entry sectors with ±5° flexibility; 1 min legs up to FL 140, 1½ min above. Schematic, not to scale.',no:'ICAO Doc 8168 (PANS-OPS) inngangssektorer med ±5° fleksibilitet; 1 min legger opp til FL 140, 1½ min over. Skjematisk, ikke i skala.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
