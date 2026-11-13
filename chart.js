/* Birdbird – oppdiktede kart for opplæring: innflygingskart RWY 36 (ILS/LOC/RNP) og SID OSVIK 1N. Tegnes som SVG.
   Innflygingskartet følger den kjente oppbyggingen til kommersielle innflygingskart (topptekst, briefingstripe, planvisning,
   profil, omregningstabell, minimaboks) slik at man lærer å lese ekte kart. Alt innhold er oppdiktet. Ikke for navigasjon. */
(function(G){
'use strict';
const ink='#13202A', mag='#9A1E68', blu='#1E5E9E', mut='#5E6B74', rule='#9AA6AC', amb='#7A4D00', amw='#FBEFD6', aw='#F3E6EE';
const FF='Archivo,&quot;Arial Narrow&quot;,Arial,sans-serif';
const T=(x,y,s,o)=>{ o=o||{}; return `<text x="${x}" y="${y}" font-size="${o.fs||10}" font-family="${FF}" fill="${o.c||ink}" text-anchor="${o.a||'start'}" font-weight="${o.w||450}"${o.it?' font-style="italic"':''}${o.ls?` letter-spacing="${o.ls}"`:''} style="font-stretch:${o.st||88}%">${s}</text>`; };
const ln=(x1,y1,x2,y2,o)=>{ o=o||{}; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.c||ink}" stroke-width="${o.w||1}"${o.d?` stroke-dasharray="${o.d}"`:''}/>`; };
const box=(x,y,w,h,o)=>{ o=o||{}; return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${o.f||'none'}" stroke="${o.c||'none'}" stroke-width="${o.w||1}"/>`; };
const fix=(x,y,name,alt,o)=>{ o=o||{}; const tri=o.faf? `<path d="M${x-7} ${y}l7-7 7 7-7 7z" fill="${ink}"/>` : `<path d="M${x} ${y-6}l5.5 9.5h-11z" fill="none" stroke="${ink}" stroke-width="1.6"/>`;
  return tri+T(x+(o.dx||9),y+(o.dy||-6),name,{w:700})+(alt?T(x+(o.dx||9),y+(o.dy||-6)+12,alt,{fs:10,c:mut}):''); };
const tri=(x,y,o)=>{ o=o||{}; return o.rnav? `<path d="M${x} ${y-7}L${x+2} ${y-2}L${x+7} ${y}L${x+2} ${y+2}L${x} ${y+7}L${x-2} ${y+2}L${x-7} ${y}L${x-2} ${y-2}z" fill="${o.fill?ink:'#fff'}" stroke="${ink}" stroke-width="1.2"/>`
  : `<path d="M${x} ${y-6}l5.5 9.5h-11z" fill="${o.fill?ink:'#fff'}" stroke="${ink}" stroke-width="1.5"/>`; };
const maltese=(x,y)=>`<path d="M${x} ${y}l-4-7h8zM${x} ${y}l4 7h-8zM${x} ${y}l-7 -4v8zM${x} ${y}l7-4v8z" fill="${ink}"/>`;
const morse={I:'..',A:'.-',S:'...',N:'-.'};
const mc=(id,x,y)=>{ let s='',cx=x; id.split('').forEach(ch=>{ (morse[ch]||'').split('').forEach(k=>{ s+= k==='.'? `<circle cx="${cx+1}" cy="${y}" r="1" fill="${ink}"/>` : `<rect x="${cx}" y="${y-1}" width="5" height="2" fill="${ink}"/>`; cx+= k==='.'?4:7; }); cx+=5; }); return s; };
const rod=gs=>Math.round(gs*101.27*Math.tan(3*Math.PI/180)/5)*5;
const mmss=sec=>Math.floor(sec/60)+':'+String(Math.round(sec%60)).padStart(2,'0');
let uid=0;
const REG=[
  {k:'head',  n:1, x:4,  y:4,   w:592, h:84,  bx:236, by:27},
  {k:'strip', n:2, x:4,  y:88,  w:496, h:38,  bx:489, by:99},
  {k:'msa',   n:3, x:500,y:88,  w:96,  h:64,  bx:586, by:98},
  {k:'missed',n:4, x:4,  y:126, w:496, h:42,  bx:489, by:139},
  {k:'plan',  n:5, x:4,  y:168, w:592, h:352, bx:584, by:181},
  {k:'profile',n:6,x:4,  y:520, w:592, h:160, bx:18,  by:533},
  {k:'rod',   n:7, x:4,  y:680, w:592, h:44,  bx:586, by:691},
  {k:'mins',  n:8, x:4,  y:724, w:592, h:103, bx:586, by:731}
];

/* opt.hot: legg til klikkbare nummererte soner (for gjennomgangen) */
function app(P,opt){
  const O=G.OPS, A=O.APT; P=P||O.ILS36; opt=opt||{};
  const rnp=P.kind==='RNP', loc=P.kind==='LOC', m=P.minima, id='bbc'+(++uid);
  const W=600,H=850;
  const zed=/\bZ\b/.test(P.name);
  const title= rnp? 'RNP RWY 36' : zed? 'ILS Z or LOC Z RWY 36' : 'ILS or LOC RWY 36';
  const idx=(P.chart||'NAER 11-1').split(' ').pop();
  let s=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="${opt.hot?'group':'img'}" aria-label="${title}, fictional training approach chart, not for navigation" class="plate" style="background:#fff;max-width:100%;height:auto;display:block">`;
  s+=`<defs><marker id="${id}a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${ink}"/></marker>
   <clipPath id="${id}c"><rect x="4" y="168" width="592" height="352"/></clipPath>
   <pattern id="${id}h" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="${ink}" stroke-width="1.3"/></pattern></defs>`;
  s+=box(4,4,592,842,{c:ink,w:1.4});

  /* 1 topptekst */
  s+=T(14,28,A.icao,{fs:21,w:800,st:80})+T(14,44,'BIRDBIRD',{fs:10.5,w:600,c:mut,ls:.5});
  s+=T(300,25,idx,{fs:18,w:800,a:'middle'})+T(300,41,'EFF '+P.date,{fs:9.5,a:'middle',c:mut});
  s+=T(586,21,'BIRDBIRD',{fs:9,a:'end',c:mut,ls:.5})+T(586,42,title,{fs:17.5,w:800,a:'end',st:82});
  s+=ln(4,50,596,50);
  s+=box(4,50,592,14,{f:aw})+T(300,60.5,'FICTIONAL TRAINING CHART — NOT FOR NAVIGATION',{fs:9,w:700,c:mag,a:'middle',ls:.8});
  s+=ln(4,64,596,64);
  [['D-ATIS',A.freq.atis],['BIRDBIRD APPROACH (R)',A.freq.app],['BIRDBIRD TOWER',A.freq.twr],['BIRDBIRD GROUND',A.freq.gnd]].forEach((c,i)=>{ const x=4+i*148;
    if(i) s+=ln(x,64,x,88,{c:rule}); s+=T(x+7,74,c[0],{fs:8,c:mut,w:500})+T(x+7,85,c[1],{fs:11.5,w:700}); });
  s+=ln(4,88,596,88);

  /* 2 briefingstripe */
  const cells= rnp? [['SBAS CH','41736','W36A'],['Final Apch Crs','360°'],['GP  FAPSO','1650\'(1640\')'],['LPV  DA(H)',`${m.da}'(${m.dh}')`],['Apt Elev / TDZE','10\' / 10\'']]
    : [['LOC  IASN','110.30'],['Final Apch Crs','360°'],['GS  FAPSO  D5.0','1650\'(1640\')'],['ILS  DA(H)',`${m.da}'(${m.dh}')`],['Apt Elev / TDZE','10\' / 10\'']];
  const cw=[92,84,124,100,96]; let cx=4;
  cells.forEach((c,i)=>{ if(i) s+=ln(cx,88,cx,126,{c:rule}); s+=T(cx+7,100,c[0],{fs:8,c:mut,w:500})+T(cx+7,117,c[1],{fs:13,w:750})+(c[2]?T(cx+7+(rnp?42:0),117,c[2],{fs:8,c:mut}):'');
    if(loc&&i===2) s+=ln(cx+6,113,cx+cw[i]-8,113,{c:amb,w:1.2})+T(cx+cw[i]-8,100,'GS OUT',{fs:7.5,w:700,c:amb,a:'end'}); cx+=cw[i]; });
  s+=ln(4,126,500,126);
  /* 3 MSA */
  s+=ln(500,88,500,152);
  const mx=548,my=116,mr=24;
  s+=`<circle cx="${mx}" cy="${my}" r="${mr}" fill="none" stroke="${ink}" stroke-width="1.2"/>`+ln(mx,my-mr,mx,my+mr)+`<circle cx="${mx}" cy="${my}" r="1.6" fill="${ink}"/>`;
  s+=T(mx-12.5,my+3.5,'3200',{fs:8.5,w:750,a:'middle',st:80})+T(mx+12.5,my+3.5,'2300',{fs:8.5,w:750,a:'middle',st:80});
  s+=T(mx,149.5,'MSA ASN 25 NM',{fs:7,a:'middle',c:mut,w:600});
  /* 4 avbrutt innflyging og høydemåler */
  s+=T(10,137,'<tspan font-weight="800">MISSED APCH:</tspan> Climb STRAIGHT AHEAD on track 360° to 3000\',',{fs:9.5})+T(10,148.5,'then direct HOLAN and hold. Missed approach climb gradient 2.5 %.',{fs:9.5});
  s+=ln(4,152,596,152);
  s+=T(10,163.5,`Alt Set: hPa     Trans level: by ATC     Trans alt: ${A.ta}'     ALS 720 m     PAPI 3.0° (L)     ${rnp?'Baro-VNAV / LPV':'DME IASN reads 0 at THR'}`,{fs:8.5,c:ink});
  s+=ln(4,168,596,168,{w:1.2});

  /* 5 planvisning: 13 px/NM, nord opp */
  const X=340, yT=318, k=13, Y=nm=>yT+nm*k;
  s+=`<g clip-path="url(#${id}c)">`;
  s+=`<path d="M4 172 L215 172 C262 212 300 262 311 318 C319 362 314 398 284 424 C238 458 150 474 4 474 Z" fill="#F2ECDD"/>`;
  s+=`<path d="M58 196 C140 180 212 214 206 266 C201 312 132 334 80 312 C38 296 26 228 58 196 Z" fill="#E7DABF"/>`;
  s+=`<path d="M460 520 C470 486 520 470 596 478 L596 520 Z" fill="#F2ECDD"/>`;
  s+=T(250,190,'1000',{fs:7,c:'#8A7448'})+T(120,205,'2000',{fs:7,c:'#8A7448'})+T(520,500,'1000',{fs:7,c:'#8A7448'});
  s+='</g>';
  const spot=(x,y,v,hi)=>`<circle cx="${x}" cy="${y}" r="${hi?2.2:1.5}" fill="${ink}"/>`+T(x+4,y+3.5,v,{fs:hi?10:8.5,w:hi?800:600});
  s+=spot(120,252,'2350',1)+`<path d="M108 240l12 10" stroke="${ink}" stroke-width="1.4" marker-end="url(#${id}a)"/>`;
  s+=spot(232,232,'1640')+spot(X-39,Y(3),'1100')+spot(176,402,'1380')+spot(490,286,'870')+spot(520,430,'640');
  s+=`<path d="M${X+80} ${Y(4.2)}l-4 8h8z" fill="none" stroke="${ink}" stroke-width="1.2"/><circle cx="${X+80}" cy="${Y(4.2)+5}" r="1" fill="${ink}"/>`+T(X+86,Y(4.2)+8,'560\'',{fs:8.5,w:600});
  // bane, VOR, navaid-bokser
  s+=box(X-3,yT-18,6,18,{f:ink})+ln(X-7,yT+3,X+7,yT+3,{w:1.2});
  s+=`<path d="M${X+17} ${yT-26}l4 0 2 3.5 -2 3.5 -4 0 -2 -3.5z" fill="#fff" stroke="${ink}" stroke-width="1.2"/><circle cx="${X+19}" cy="${yT-22.5}" r="1" fill="${ink}"/>`;
  s+=box(X+28,yT-40,96,28,{f:'#fff',c:ink})+T(X+33,yT-30,'BIRDBIRD',{fs:7.5,c:mut,w:600})+T(X+33,yT-18.5,'113.30 ASN',{fs:9.5,w:750})+mc('ASN',X+72,yT-32);
  if(!rnp) s+=box(X+12,yT+8,104,26,{f:'#fff',c:ink})+T(X+17,yT+18,'ILS DME',{fs:7.5,c:mut,w:600})+T(X+17,yT+29.5,'110.30 IASN',{fs:9.5,w:750})+mc('IASN',X+50,yT+15);
  // sluttkurs med LOC-fjær
  if(!rnp) s+=`<path d="M${X} ${Y(1.2)}L${X-6} ${Y(10.6)}L${X} ${Y(9.6)}z" fill="#fff" stroke="${ink}" stroke-width="1"/><path d="M${X} ${Y(1.2)}L${X+6} ${Y(10.6)}L${X} ${Y(9.6)}z" fill="url(#${id}h)" stroke="${ink}" stroke-width="1"/>`;
  s+=ln(X,yT+3,X,Y(12.8),{w:2});
  s+=box(X-44,Y(7.1)-10,34,14,{f:'#fff',c:ink})+T(X-27,Y(7.1)+1,'360°',{fs:11,w:800,a:'middle'});
  // fixer
  s+=tri(X,Y(5),{fill:1,rnav:rnp})+T(X+11,Y(5)-1,'FAPSO',{fs:9.5,w:750})+T(X+11,Y(5)+9,rnp?'FAP':'D5.0 IASN',{fs:8,c:mut});
  s+=ln(X-4,Y(3),X+4,Y(3),{w:1.3})+T(X+11,Y(3)+3,rnp?'':'D3.0',{fs:8,c:mut});
  const hy=Y(10), hr=11, hL=36;
  s+=`<path d="M${X} ${hy} a${hr} ${hr} 0 0 1 ${2*hr} 0 v${hL} a${hr} ${hr} 0 0 1 ${-2*hr} 0 z" fill="none" stroke="${ink}" stroke-width="1.4"/>`;
  s+=T(X+2*hr+5,hy+30,'360°',{fs:8,w:700})+T(X+2*hr+5,hy+40,'MHA 3000\'',{fs:8,c:mut})+T(X+2*hr+5,hy+50,'1 min',{fs:8,c:mut});
  s+=tri(X,hy,{rnav:rnp})+T(X-8,hy-17,'RONAX',{fs:9.5,w:750,a:'end'})+T(X-8,hy-7.5,rnp?'IF':'IF  D10.0 IASN',{fs:7.5,c:mut,a:'end'});
  const ax=X-65, bx=X+65;
  s+=ln(ax+6,hy,X-7,hy,{w:1.5})+`<path d="M${X-24} ${hy-3}l6 3-6 3" fill="none" stroke="${ink}" stroke-width="1.2"/>`+T((ax+X)/2,hy+12,'090°  5.0',{fs:8,a:'middle',w:600});
  s+=ln(bx-6,hy,X+7,hy,{w:1.5})+`<path d="M${X+40} ${hy-3}l-6 3 6 3" fill="none" stroke="${ink}" stroke-width="1.2"/>`+T((bx+X)/2+8,hy+12,'270°  5.0',{fs:8,a:'middle',w:600});
  s+=tri(ax,hy,{rnav:rnp})+T(ax-9,hy-1,'ALPOR',{fs:9.5,w:750,a:'end'})+T(ax-9,hy+9,'IAF  3000\'',{fs:8,c:mut,a:'end'});
  s+=tri(bx,hy,{rnav:rnp})+T(bx+9,hy-1,'BIKAN',{fs:9.5,w:750})+T(bx+9,hy+9,'IAF  3000\'',{fs:8,c:mut});
  // avbrutt: rett frem til HOLAN, holding (inn 180°, høyre)
  const hoy=yT-78, r2=11, L2=36;
  s+=`<path d="M${X} ${yT-20}V${hoy+8}" stroke="${ink}" stroke-width="1.5" stroke-dasharray="6 4" fill="none" marker-end="url(#${id}a)"/>`;
  s+=`<path d="M${X} ${hoy} a${r2} ${r2} 0 0 1 ${-2*r2} 0 v${-L2} a${r2} ${r2} 0 0 1 ${2*r2} 0 z" fill="none" stroke="${ink}" stroke-width="1.3" stroke-dasharray="5 3"/>`;
  s+=tri(X,hoy,{rnav:rnp})+T(X+9,hoy+4,'HOLAN',{fs:9.5,w:750})+T(X+9,hoy-14,'180°',{fs:8,w:700})+T(X+9,hoy-4.5,'3000\'',{fs:8,c:mut});
  s+=T(X+8,yT-48,'360°',{fs:8,w:700})+T(X+8,yT-38.5,'3000\'',{fs:8,c:mut});
  if(loc) s+=box(396,176,176,30,{f:amw,c:amb})+T(404,189,'ILS GS OUT OF SERVICE',{fs:9.5,w:800,c:amb})+T(404,201,'Fly LOC (CDFA). LOC minima apply.',{fs:8.5,c:amb});
  // målestokk
  s+=ln(14,512,14+5*k,512,{w:1.2})+[0,1,2,3,4,5].map(i=>ln(14+i*k,509,14+i*k,512)).join('')+T(14,506,'0',{fs:7.5})+T(14+5*k,506,'5 NM',{fs:7.5,a:'middle'});
  s+=ln(4,520,596,520,{w:1.2});

  /* 6 profil */
  const gy=652, px=nm=>500-nm*40, py=a=>gy-a*0.031;
  s+=ln(20,gy,590,gy,{w:1.2})+box(px(0),gy-3,px(-1.35)-px(0),3,{f:ink});
  s+=`<path d="M${px(11)} ${py(3000)}H${px(10)}L${px(6)} ${py(1650)}H${px(5)}" fill="none" stroke="${ink}" stroke-width="2"/>`;
  s+=`<path d="M${px(5)} ${py(1650)}L${px(0)} ${py(60)}" fill="none" stroke="${loc?mut:ink}" stroke-width="2"${loc?' stroke-dasharray="6 4"':''}/>`;
  s+=`<path d="M${px(0)} ${py(60)}L${px(-2.1)} ${py(1500)}" stroke="${ink}" stroke-dasharray="6 4" fill="none" stroke-width="1.5" marker-end="url(#${id}a)"/>`;
  s+=T(px(-1.2),py(1500)-6,'360°',{fs:8.5,w:700,a:'middle'})+T(px(-1.2),py(1500)+4,'3000\'',{fs:8,c:mut,a:'middle'});
  s+=tri(px(10),py(3000)-12,{rnav:rnp})+T(px(10),py(3000)-21,'RONAX',{fs:9,w:750,a:'middle'})+T(px(10.5),py(3000)+12,'3000\'',{fs:10,w:800,a:'middle'});
  s+=T(px(5.5),py(1650)-6,'1650\'',{fs:9.5,w:800,a:'middle'});
  s+=maltese(px(5),py(1650)-16)+T(px(5),py(1650)-27,'FAPSO',{fs:9,w:750,a:'middle'});
  s+=T(px(5)-6,py(1650)+14,(rnp?'GP ':'GS ')+'1650\'',{fs:8.5,w:700,a:'end'})+T(px(3.6),py(1180)+18,'3.00°',{fs:10,w:800,a:'middle'});
  s+=T(px(0)-4,py(60)-6,'TCH 50\'',{fs:8,c:mut,a:'end'})+T(px(0)+2,gy+11,'TDZE 10\'',{fs:7.5,c:mut});
  if(!rnp) s+=ln(px(0),gy,px(0),py(600),{d:'2 2',c:mut})+T(px(0)-3,py(600)-2,'LOC MAPt',{fs:7.5,c:mut,w:600,a:'end'});
  [[10,'D10.0'],[5,'D5.0'],[4,'D4.0'],[3,'D3.0'],[2,'D2.0'],[1,'D1.0']].forEach(([n,t])=>{ s+=ln(px(n),gy,px(n),gy+4)+(rnp&&n<5?'':T(px(n),gy+13,rnp?(n===10?'10.0':'5.0'):t,{fs:8,a:'middle',c:mut})); });
  s+=T(20,gy+13,rnp?'NM to RW36':'IASN DME',{fs:7.5,c:mut,w:600});
  [[10,5],[5,0]].forEach(([a,b])=>{ const mid=(px(a)+px(b))/2; s+=ln(px(a)+4,gy+20,mid-10,gy+20,{c:rule})+ln(mid+10,gy+20,px(b)-4,gy+20,{c:rule})+T(mid,gy+23,'5.0',{fs:7.5,a:'middle',c:mut}); });
  if(!rnp) s+=ln(px(3),py(1020),px(3),gy,{d:'2 2',c:mut})+T(px(3)+3,py(1020)-3,'LOC 1020\'',{fs:7.5,c:mut});
  // DME-tabell
  const tx=300, tw=58, tY=528;
  const tb=[['5.0','1650'],['4.0','1330'],['3.0','1020'],['2.0','700'],['1.0','380']];
  s+=box(tx,tY,70+tb.length*tw-80,30,{f:'#fff',c:ink});
  s+=T(tx+5,tY+12,rnp?'NM to RW36':(loc?'LOC  D IASN':'GS/LOC  D IASN'),{fs:7.5,c:mut,w:600})+T(tx+5,tY+25,'ALTITUDE',{fs:7.5,c:mut,w:600});
  tb.forEach((c,i)=>{ const x=tx+70+i*44; s+=ln(x-6,tY,x-6,tY+30,{c:rule})+T(x+16,tY+12,c[0],{fs:9,a:'middle'})+T(x+16,tY+25,c[1]+'\'',{fs:9.5,a:'middle',w:750}); });
  s+=ln(4,680,596,680,{w:1.2});

  /* 7 omregningstabell */
  const gss=[110,120,130,140,150,160], c0=140, cW=76;
  gss.forEach((g,i)=>{ if(g===130||g===140) s+=box(c0+i*cW,680,cW,44,{f:aw}); });
  const rows=[['Gnd speed-Kts',gss.map(String)],[(rnp?'GP':loc?'Descent angle':'GS')+' 3.00°  ft/min',gss.map(g=>String(rod(g)))],[(rnp?'FAP to MAPt':'FAPSO to LOC MAPt')+'  5.0 NM',gss.map(g=>mmss(5/g*3600))]];
  rows.forEach((r,j)=>{ const y=680+j*14.67; if(j) s+=ln(4,y,596,y,{c:rule}); s+=T(10,y+10.5,r[0],{fs:8.5,w:600,c:j?ink:mut}); r[1].forEach((v,i)=>{ s+=T(c0+i*cW+cW/2,y+10.5,v,{fs:9.5,a:'middle',w:j===1?750:500}); }); });
  gss.forEach((g,i)=>{ s+=ln(c0+i*cW,680,c0+i*cW,724,{c:rule}); });
  s+=ln(4,724,596,724,{w:1.4});

  /* 8 minimaboks */
  const cx0=[4,48,133,218,303,388,444,530,596];
  const top=724, sub=737, spl=763, r0=775, rh=13;
  s+=box(4,top,592,13,{f:'#EEF1F1'});
  s+=T(218,top+10,'STRAIGHT-IN LANDING RWY 36',{fs:8.5,w:800,a:'middle',ls:.4})+T(492,top+10,'CIRCLE-TO-LAND',{fs:8.5,w:800,a:'middle',ls:.4});
  s+=ln(4,sub,596,sub,{c:rule})+ln(388,top,388,827);
  const n1= rnp? ['LPV',`DA(H) ${m.da}'(${m.dh}')`] : ['ILS',`DA(H) ${m.da}'(${m.dh}')`];
  const n2= rnp? ['LNAV',`MDA(H) ${m.locMda}'(${m.locMdh}')`] : ['LOC (GS out)',`MDA(H) ${m.locMda}'(${m.locMdh}')`];
  if(loc) s+=box(218,sub,170,38,{f:amw});
  s+=T(133,sub+11,n1[0],{fs:9,w:800,a:'middle'})+T(133,sub+23,n1[1],{fs:10.5,w:800,a:'middle'});
  s+=T(303,sub+11,n2[0],{fs:9,w:800,a:'middle'})+T(303,sub+23,n2[1],{fs:10.5,w:800,a:'middle'});
  s+=T(416,sub+17,'Max Kts',{fs:8,a:'middle',c:mut,w:600})+T(487,sub+17,'MDA(H)',{fs:8,a:'middle',c:mut,w:600})+T(563,sub+17,'VIS',{fs:8,a:'middle',c:mut,w:600});
  s+=ln(48,spl,388,spl,{c:rule});
  ['FULL','ALS out','FULL','ALS out'].forEach((t,i)=>{ s+=T((cx0[i+1]+cx0[i+2])/2,spl+9.5,t,{fs:7.5,a:'middle',c:mut,w:600}); });
  s+=ln(4,r0,596,r0,{c:rule});
  const rv=[`RVR ${m.rvr}m`, `RVR ${rnp?1300:1200}m`, `RVR ${rnp?m.locVis:1200}m`, 'RVR 2000m'];
  const circ={A:['100',"610'(600')",'1500m'],B:['135',"610'(600')",'1600m'],C:['180',"710'(700')",'2400m'],D:['205',"810'(800')",'3600m']};
  ['A','B','C','D'].forEach((c,j)=>{ const y=r0+j*rh, hc=c==='C';
    if(hc) s+=box(4,y,592,rh,{f:aw})+box(4,y,3,rh,{f:mag});
    s+=T(hc?14:26,y+9.8,c,{fs:9.5,w:800,a:hc?'start':'middle',c:hc?mag:ink})+(hc?T(24,y+9.6,'A320',{fs:7,w:700,c:mag}):'');
    rv.forEach((v,i)=>{ s+=T((cx0[i+1]+cx0[i+2])/2,y+9.8,v,{fs:9,a:'middle',w:hc?750:450}); });
    circ[c].forEach((v,i)=>{ s+=T([416,487,563][i],y+9.8,v,{fs:9,a:'middle',w:hc?750:450}); });
    if(j) s+=ln(4,y,596,y,{c:'#E2E7E8'}); });
  [[218,sub],[444,sub],[530,sub],[133,spl],[303,spl]].forEach(([x,y0])=>{ s+=ln(x,y0,x,827,{c:rule}); });
  s+=ln(48,top+13,48,827,{c:rule});
  s+=ln(4,827,596,827,{w:1.2});
  s+=T(10,839.5,'Fictional training chart (Birdbird). Not for navigation. Not a reproduction of any published chart.',{fs:7.5,c:mut});
  s+=T(590,839.5,'Tint: A320 / CAT C',{fs:7.5,c:mag,a:'end',w:700});

  if(opt.hot) REG.forEach(r=>{ s+=`<g class="hs" data-k="${r.k}" tabindex="0" role="button" aria-label="${r.n}"><rect class="hz" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/><circle class="hb" cx="${r.bx}" cy="${r.by}" r="8.5"/><text class="hn" x="${r.bx}" y="${r.by+3.6}" text-anchor="middle" font-size="10.5" font-weight="800" font-family="${FF}">${r.n}</text></g>`; });
  return s+'</svg>';
}

function sid(){
  const W=520,H=420, S=G.OPS.SID, id='bbs'+(++uid);
  let s=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SID OSVIK 1N chart, fictional training chart, not for navigation" style="background:#fff;max-width:100%;height:auto;display:block">`;
  s+=`<defs><marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${ink}"/></marker></defs>`;
  s+=box(6,6,W-12,H-12,{c:ink,w:1.2});
  s+=T(16,27,'NAER',{fs:18,w:800,st:80})+T(16,42,'BIRDBIRD  ·  SID RWY 36',{fs:9.5,c:mut,w:600})+T(W-16,25,'OSVIK 1N',{fs:16,w:800,a:'end'})+T(W-16,41,'10-3   EFF 01 NOV 26',{fs:9.5,c:mut,a:'end'});
  s+=ln(6,50,W-6,50);
  [['TWR',G.OPS.APT.freq.twr],['DEP / APP',G.OPS.APT.freq.app],['TA','7000\''],['INITIAL CLB','3000\'']].forEach((b,i)=>{ const x=6+i*(W-12)/4; if(i) s+=ln(x,50,x,78,{c:rule}); s+=T(x+6,62,b[0],{fs:8,c:mut,w:500})+T(x+6,74,b[1],{fs:11.5,w:700}); });
  s+=ln(6,78,W-6,78);
  const rx=330, ry=330;
  s+=box(rx-3,ry,6,40,{f:ink})+T(rx+10,ry+30,'RWY 36',{fs:10,w:700});
  s+=`<path d="M${rx} ${ry} V 250" stroke="${ink}" stroke-width="2" fill="none"/>`+T(rx+8,282,'360°',{fs:11,w:800});
  s+=T(rx+8,254,'1500\'',{fs:10,w:800})+`<circle cx="${rx}" cy="250" r="3" fill="${ink}"/>`;
  s+=`<path d="M${rx} 250 q 0 -22 -16 -32 L 120 110" stroke="${ink}" stroke-width="2" fill="none"/>`+T(200,168,'322°  22 NM',{fs:11,w:800,a:'middle'});
  s+=tri(120,110)+T(72,98,'OSVIK',{fs:10,w:800})+T(72,124,'3000\'',{fs:9.5,c:mut});
  s+=`<path d="M${rx-30} 240 a 20 20 0 0 0 -8 -18" fill="none" stroke="${ink}" marker-end="url(#${id})"/>`+T(rx-44,230,'LEFT',{fs:9,a:'end',w:700});
  s+=`<circle cx="196" cy="206" r="1.6" fill="${ink}"/>`+T(201,210,'1640',{fs:9.5,w:700});
  s+=`<circle cx="452" cy="140" r="34" fill="none" stroke="${ink}"/>`+ln(452,106,452,174)+T(439,145,'3200',{fs:11,w:800,a:'middle'})+T(465,145,'2300',{fs:11,w:800,a:'middle'})+T(452,186,'MSA ASN 25 NM',{fs:8,a:'middle',c:mut,w:600});
  s+=box(16,H-82,W-32,58,{f:amw});
  s+=T(24,H-64,'Climb on track 360°. At 1500\' turn LEFT direct OSVIK. Climb 3000\' or as cleared.',{fs:10,w:700});
  s+=T(24,H-48,'Minimum climb gradient 4.5 % (275 ft/NM) to 1500\' due to terrain.',{fs:10,c:amb,w:700});
  s+=T(24,H-32,'At 160 kt GS ≈ 730 ft/min. Engine out: check OEI performance; an EOSID may apply.',{fs:10,c:amb});
  s+=T(W/2,H-11,'FICTIONAL TRAINING CHART — NOT FOR NAVIGATION',{fs:9,w:700,a:'middle',c:mag,ls:.6});
  return s+'</svg>';
}
G.CHART={app,sid,REG};
})(window);
