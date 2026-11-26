/* NORDAP radio trainer – the situation picture: where you are, how high, which flight, and a map that follows you.
   Every call in every lesson gets a position (a named place on the aerodrome, or a point in the area), an altitude
   and the flight it belongs to. The map has two views: the aerodrome (taxiways, holding points, runways 36/18 and
   07/25) on the ground and on short final, and the area (CTR, TMA, reporting points, Skarvik, Tjernmo, the IFR fixes)
   in the air. TRAINING DATA: the aerodromes, airspace and procedures are fictional and not for navigation.
   Coordinates: nautical miles, NORDAP reference point at 0,0, x east, y north.
   API: RSIT.at(step,V) -> {pos,alt,flight,ground} · RSIT.draw(canvas,state) · RSIT.where(pos,lang) */
(function(G){
'use strict';
const tr=(en,no)=>({en,no:no||en});

/* ---------------- places ---------------- */
const AD={ /* the aerodrome, in NM from the reference point */
  apron:{x:.40,y:-.02,l:tr('Main apron','Hovedapron')},
  aprN:{x:.55,y:1.02,l:tr('North apron','Nordre apron')},
  A1:{x:.13,y:-.92,l:tr('Holding point A1, runway 36','Holdepunkt A1, bane 36')},
  lineup:{x:0,y:-.86,l:tr('Lined up, runway 36','Oppstilt, bane 36')},
  B07:{x:.55,y:.83,l:tr('Holding short of runway 07 at Bravo','Venter før bane 07 ved Bravo')},
  crossed:{x:.45,y:.6,l:tr('Bravo, runway 07 crossed','Bravo, bane 07 krysset')},
  A3:{x:.13,y:.92,l:tr('Taxiway A3, runway vacated','Taksebane A3, banen forlatt')},
  rollout:{x:0,y:.45,l:tr('Runway 36, rolling out','Bane 36, ruller ut')},
  alpha:{x:.2,y:.15,l:tr('Taxiway Alpha','Taksebane Alpha')}
};
const PL={ /* named points in the area */
  NORDAP:{x:0,y:0,k:'ad',l:'NORDAP'},
  November:{x:0,y:8.5,k:'vrp',l:'November'},
  Sierra:{x:0,y:-8.5,k:'vrp',l:'Sierra'},
  Skarvik:{x:-12,y:-10,k:'ad2',l:'Skarvik',rwy:18},
  Tjernmo:{x:4,y:16.5,k:'ad2',l:'Tjernmo',rwy:27},
  OSVIK:{x:12,y:11,k:'fix',l:'OSVIK'},
  TUSKA:{x:16,y:-28,k:'fix',l:'TUSKA'},
  RONAX:{x:0,y:-14,k:'fix',l:'RONAX'},
  FAPSO:{x:0,y:-5,k:'fix',l:'FAPSO'}
};
const CTR=7.5, TMA=15;
const TRAIN={x0:-5,x1:9,y0:-24,y1:-13};

/* ---------------- flights ---------------- */
const FL={
  vloc:tr('VFR · NORDAP local, training area via Sierra','VFR · NORDAP lokalt, øvingsområdet via Sierra'),
  vxc:tr('VFR · Skarvik to Tjernmo','VFR · Skarvik til Tjernmo'),
  vsk:tr('VFR · landing at Skarvik (AFIS)','VFR · landing på Skarvik (AFIS)'),
  vtj:tr('VFR · landing at Tjernmo (no ATS)','VFR · landing på Tjernmo (uten ATS)'),
  vcirc:tr('VFR · circuits at NORDAP','VFR · landingsrunder på NORDAP'),
  ifr:tr('IFR · NORDAP to NORDAP via OSVIK and TUSKA','IFR · NORDAP til NORDAP via OSVIK og TUSKA'),
  emer:tr('DA42 · emergency','DA42 · nødsituasjon')
};
const GND=0;
const LBL={
  dw36:tr('Left downwind, runway 36 at NORDAP','Venstre medvind, bane 36 på NORDAP'),
  fin36:tr('Final, runway 36 at NORDAP','Finale, bane 36 på NORDAP'),
  sfin36:tr('Short final, runway 36 at NORDAP','Kort finale, bane 36 på NORDAP'),
  climb36:tr('Climbing out from runway 36','Stiger ut fra bane 36'),
  dw18:tr('Right downwind, runway 18 at Skarvik','Høyre medvind, bane 18 på Skarvik'),
  fin18:tr('Final, runway 18 at Skarvik','Finale, bane 18 på Skarvik'),
  dw27:tr('Downwind, runway 27 at Tjernmo','Medvind, bane 27 på Tjernmo'),
  fin27:tr('Final, runway 27 at Tjernmo','Finale, bane 27 på Tjernmo'),
  vac27:tr('Tjernmo, runway 27 vacated','Tjernmo, bane 27 forlatt'),
  hold:tr('In the hold at RONAX','I ventemønsteret ved RONAX'),
  ils:tr('Established on the final approach, runway 36','Etablert på finalen, bane 36')
};
/* per call: [place or [x,y], altitude (ft, 0 = on the ground, or a function of the session values), flight, heading] */
const fl=V=>`FL${V.fl}`;
const AT={
  'atis:0':['apron',GND,'vloc'],
  'vtaxi:0':['apron',GND,'vloc'],'vtaxi:1':['apron',GND,'vloc'],'vtaxi:2':['A1',GND,'vloc'],
  'vline:0':['A1',GND,'vloc'],'vline:1':['A1',GND,'vloc'],'vline:2':['lineup',GND,'vloc'],
  'vdep:0':[[0,-5.5],1500,'vloc',180],'vdep:1':[[0,-8.5],1500,'vloc',180],
  'vfis:0':[[0,-13],2500,'vloc',180],'vfis:1':[[.5,-14.5],2500,'vloc',180],'vfis:2':[[1,-16],2500,'vloc',180],'vfis:3':['Skarvik',2500,'vloc',35],
  'vtma:0':[[-12,-15],2500,'vxc',20],'vtma:1':[[-12,-15],2500,'vxc',20],'vtma:2':[[-11,-13],3500,'vxc',20],'vtma:3':[[2,14],4500,'vxc',20],'vtma:4':[[2.5,15],4500,'vxc',20],
  'vafis:0':[[-12,0],2000,'vsk',180],'vafis:1':[[-12,-4],2000,'vsk',180],'vafis:2':[[-12.9,-10],1000,'vsk',360,'dw18'],'vafis:3':[[-12.9,-10.4],1000,'vsk',360,'dw18'],'vafis:4':[[-12,-8.6],500,'vsk',180,'fin18'],'vafis:5':[[-12,-8.8],400,'vsk',180,'fin18'],
  'vblind:0':[[4,11.5],2000,'vtj',0],'vblind:1':[[4.2,15.4],1000,'vtj',90,'dw27'],'vblind:2':[[5.6,16.5],500,'vtj',270,'fin27'],'vblind:3':['Tjernmo',GND,'vtj',270,'vac27'],
  'varr:0':[[0,10],2000,'vloc',180],'varr:1':[[0,9.6],2000,'vloc',180],'varr:2':['November',1500,'vloc',180],'varr:3':[[-1,.6],1000,'vloc',180,'dw36'],'varr:4':[[0,-1.6],500,'vloc',0,'fin36'],'varr:5':[[0,-1.3],400,'vloc',0,'fin36'],'varr:6':['rollout',GND,'vloc',0],
  'taxiin:0':['A3',GND,'vloc'],'taxiin:1':['A3',GND,'vloc'],
  'vcirc:0':[[-1,.3],1000,'vcirc',180,'dw36'],'vcirc:1':[[-1,-.2],1000,'vcirc',180,'dw36'],'vcirc:2':[[0,-1.6],500,'vcirc',0,'fin36'],'vcirc:3':[[0,-1.4],400,'vcirc',0,'fin36'],'vcirc:4':[[0,-1.1],300,'vcirc',0,'sfin36'],'vcirc:5':[[-1,.3],1000,'vcirc',180,'dw36'],'vcirc:6':[[-1,-.4],1000,'vcirc',180,'dw36'],
  'vcheck:0':['apron',GND,'vloc'],'vcheck:1':['apron',GND,'vloc'],
  'iclr:0':['aprN',GND,'ifr'],'iclr:1':['aprN',GND,'ifr'],'iclr:2':['aprN',GND,'ifr'],
  'istart:0':['aprN',GND,'ifr'],'istart:1':['aprN',GND,'ifr'],
  'itaxi:0':['aprN',GND,'ifr'],'itaxi:1':['aprN',GND,'ifr'],'itaxi:2':['B07',GND,'ifr'],'itaxi:3':['crossed',GND,'ifr'],'itaxi:4':['crossed',GND,'ifr'],
  'ito:0':['A1',GND,'ifr'],'ito:1':['lineup',GND,'ifr'],'ito:2':[[.1,1.6],800,'ifr',0,'climb36'],
  'iclimb:0':[[.6,3.2],1500,'ifr',20,'climb36'],'iclimb:1':[[2.5,5.5],3000,'ifr',40],'iclimb:2':[[5,7.5],V=>`${fl(V)}`,'ifr',40],'iclimb:3':[[7.5,9],V=>`${fl(V)}`,'ifr',60],'iclimb:4':[[10,10],V=>`${fl(V)}`,'ifr',130],
  'ienr:0':[[12,2],V=>fl(V),'ifr',170],'ienr:1':[[13,-6],V=>fl(V),'ifr',170],'ienr:2':[[14,-13],V=>fl(V),'ifr',170],'ienr:3':[[15,-20],7000,'ifr',190],
  'ihold:0':[[12,-24],6000,'ifr',300],'ihold:1':[[7,-20],5000,'ifr',300],
  'ivec:0':['RONAX',3000,'ifr',0,'hold'],'ivec:1':[[-3,-11.5],2500,'ifr',320],'ivec:2':[[-2.2,-8.6],2500,'ifr',30],'ivec:3':[[0,-7],2200,'ifr',0,'ils'],'ivec:4':[[0,-6.5],2000,'ifr',0,'ils'],
  'iland:0':[[0,-6],1900,'ifr',0,'fin36'],'iland:1':[[0,-3],1000,'ifr',0,'fin36'],'iland:2':['rollout',GND,'ifr',0],
  'iga:0':[[0,-2],650,'ifr',0,'fin36'],'iga:1':[[0,1.5],1500,'ifr',0,'climb36'],'iga:2':[[0,-.8],250,'ifr',0,'sfin36'],'iga:3':[[0,.8],1000,'ifr',0,'climb36'],
  'emay:0':[[0,-15],3000,'emer',0],'emay:1':[[0,-12],3000,'emer',0],'emay:2':[[0,-5],1700,'emer',0],'emay:3':[[0,-3],1000,'emer',0,'fin36'],
  'epan:0':[[-12,0],4000,'emer',90],'epan:1':[[-9,0],4000,'emer',90],
  'emed:0':[[-12,-18],3500,'emer',0],'emed:1':[[-12,-16],3500,'emer',0],
  'efuel:0':['RONAX',3000,'emer',0,'hold'],'efuel:1':['RONAX',3000,'emer',180,'hold'],'efuel:2':[[-2,-11],3000,'emer',330],
  'ercf:0':[[0,-10],2000,'emer',0],'ercf:1':[[0,-5],1500,'emer',0],'ercf:2':[[0,-3],1000,'emer',0],'ercf:3':[[0,-1.6],600,'emer',0,'fin36'],
  'elost:0':[[-21,-10],3000,'emer',270,'lost'],'elost:1':[[-21,-10],3000,'emer',270],'elost:2':[[-18.5,-10],3000,'emer',90],
  'ediv:0':[[-6,16],2500,'emer',270],'ediv:1':[[-7,12],2500,'emer',200]
};

/* which place a position is given from, as in the situation text */
const REF={vafis:'Skarvik',emed:'Skarvik',elost:'Skarvik',vtma:'Skarvik',vblind:'Tjernmo',ediv:'Tjernmo'};
function pos(k){ if(Array.isArray(k)) return {x:k[0],y:k[1]}; return AD[k]? {x:AD[k].x,y:AD[k].y,ad:k} : PL[k]? {x:PL[k].x,y:PL[k].y,pl:k} : null; }
function at(step,V){
  if(!step||!step.id) return null; const a=AT[step.id]; if(!a) return null;
  const p=pos(a[0]); if(!p) return null;
  const alt=typeof a[1]==='function'? a[1](V) : a[1];
  if(a[4]&&LBL[a[4]]) p.lbl=LBL[a[4]]; const rf=REF[step.id.split(':')[0]]; if(rf) p.ref=rf;
  return {pos:p,alt,ground:alt===GND,flight:FL[a[2]]||null,hdg:a[3],lost:a[4]==='lost'};
}

/* ---------------- words ---------------- */
const DIRS={en:['north','north-east','east','south-east','south','south-west','west','north-west'],no:['nord','nordøst','øst','sørøst','sør','sørvest','vest','nordvest']};
function where(p,lang,ifr){ const L=o=>o[lang]||o.en;
  if(!p) return ''; if(p.lbl) return L(p.lbl); if(p.ad) return L(AD[p.ad].l); if(p.pl&&PL[p.pl].k!=='ad') return 'Over '+PL[p.pl].l;
  const dN=Math.hypot(p.x,p.y); if(dN<2.5) return lang==='no'?'Ved NORDAP':'At NORDAP';
  let best=null,bd=1e9; for(const k in PL){ const q=PL[k]; if(q.k==='fix'&&!ifr) continue; if(q.k==='ad') continue; const d=Math.hypot(p.x-q.x,p.y-q.y); if(d<bd){ bd=d; best=q; } }
  if(bd<1) return 'Over '+best.l;
  const ref= bd<=3.5||dN>22 ? best : p.ref? PL[p.ref] : PL.NORDAP, d=Math.hypot(p.x-ref.x,p.y-ref.y);
  const brg=(Math.atan2(p.x-ref.x,p.y-ref.y)*180/Math.PI+360)%360; const dir=DIRS[lang==='no'?'no':'en'][Math.round(brg/45)%8];
  const n=Math.round(d);
  return lang==='no'? `${n} NM ${dir} for ${ref.l}` : `${n} NM ${dir} of ${ref.l}`; }
function altText(a,lang){ if(a===GND) return lang==='no'?'På bakken':'On the ground'; if(typeof a==='string') return a; return a+' ft'; }

/* ---------------- drawing ---------------- */
function css(n,f){ const v=getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v||f; }
function draw(cv,st){
  if(!cv||!st) return; const dpr=Math.min(2,G.devicePixelRatio||1); const W=cv.clientWidth, H=cv.clientHeight; if(!W||!H) return;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
  const C={bg:'#F4F6F3',land:'#EEF1EC',ink:css('--ink','#13202A'),ink2:'#5C6B76',ink3:'#8A97A0',acc:css('--accent','#1F5F99'),ctr:'#B0306A',tma:'#6C7FA0',twy:'#C9CFC8',rwy:'#4A535C',apron:'#DCE0DA',own:'#E0402A',trk:'rgba(224,64,42,.45)',ifr:'#1F5F99'};
  g.fillStyle=C.bg; g.fillRect(0,0,W,H);
  const p=st.pos, groundView=st.ground||(p&&Math.hypot(p.x,p.y)<1.4);
  /* view: the aerodrome, or the area fitted around NORDAP and the aircraft */
  let cx,cy,s;
  if(groundView){ cx=.2; cy=0; s=Math.min(W,H)/2.7; }
  else { const pts=[{x:0,y:0},p].concat(st.focus||[]); let x0=Math.min(...pts.map(q=>q.x))-6, x1=Math.max(...pts.map(q=>q.x))+6, y0=Math.min(...pts.map(q=>q.y))-6, y1=Math.max(...pts.map(q=>q.y))+6;
    const span=Math.max(x1-x0,(y1-y0)*W/H,18); cx=(x0+x1)/2; cy=(y0+y1)/2; s=W/span; }
  const X=x=>W/2+(x-cx)*s, Y=y=>H/2-(y-cy)*s;
  g.lineCap='round'; g.lineJoin='round';
  const label=(t,x,y,o)=>{ o=o||{}; g.font=`${o.w||500} ${o.size||11}px "IBM Plex Sans",system-ui,sans-serif`; g.textAlign=o.al||'left'; g.textBaseline='middle';
    g.lineWidth=3; g.strokeStyle='rgba(244,246,243,.92)'; g.strokeText(t,x,y); g.fillStyle=o.c||C.ink2; g.fillText(t,x,y); };
  if(groundView){
    /* aerodrome: runways, taxiways, aprons, holding points */
    const seg=(a,b,w,c)=>{ g.strokeStyle=c; g.lineWidth=w; g.beginPath(); g.moveTo(X(a[0]),Y(a[1])); g.lineTo(X(b[0]),Y(b[1])); g.stroke(); };
    g.fillStyle=C.apron; g.fillRect(X(.3),Y(.2),(.28)*s,(.4)*s); g.fillRect(X(.38),Y(1.12),(.36)*s,(.2)*s);
    seg([.2,-.92],[.2,.92],.045*s,C.twy); seg([.2,-.92],[0,-.92],.04*s,C.twy); seg([.2,.92],[0,.92],.04*s,C.twy); seg([.2,0],[.32,0],.04*s,C.twy);
    seg([.55,1.0],[.55,.55],.04*s,C.twy); seg([.55,.55],[.2,.45],.04*s,C.twy);
    seg([-.75,.46],[.95,.83],.05*s,'#6A727A'); seg([0,-1],[0,1],.06*s,C.rwy);
    g.setLineDash([.05*s,.05*s]); seg([0,-.95],[0,.95],Math.max(1,.006*s),'#fff'); g.setLineDash([]);
    label('36',X(0),Y(-1.06),{al:'center',w:600,c:C.ink}); label('18',X(0),Y(1.06),{al:'center',w:600,c:C.ink});
    label('07',X(-.82),Y(.42),{al:'center',w:600,c:C.ink}); label('25',X(1.02),Y(.86),{al:'center',w:600,c:C.ink});
    const hold=(x,y,t,al)=>{ g.strokeStyle='#D9A520'; g.lineWidth=2.5; g.beginPath(); g.moveTo(X(x)-6,Y(y)); g.lineTo(X(x)+6,Y(y)); g.stroke(); label(t,X(x)+(al==='right'?-9:9),Y(y),{al:al||'left',c:'#8A6A10',w:600,size:10}); };
    hold(.1,-.92,'A1'); hold(.1,.92,'A3'); hold(.55,.8,'B','left');
    label('A',X(.25),Y(-.4),{size:10,c:C.ink3}); label(st.lang==='no'?'APRON':'APRON',X(.44),Y(.0),{al:'center',size:9,c:C.ink3,w:600}); label(st.lang==='no'?'NORDRE APRON':'NORTH APRON',X(.56),Y(1.18),{al:'center',size:9,c:C.ink3,w:600});
  } else {
    /* area: TMA, CTR, training area, reporting points, other aerodromes, IFR fixes and routes */
    g.strokeStyle=C.tma; g.lineWidth=1.2; g.setLineDash([6,4]); g.beginPath(); g.arc(X(0),Y(0),TMA*s,0,Math.PI*2); g.stroke(); g.setLineDash([]);
    label('NORDAP TMA',X(0)+TMA*s*.62,Y(0)-TMA*s*.8,{size:10,c:C.tma,w:600});
    g.fillStyle='rgba(176,48,106,.06)'; g.strokeStyle=C.ctr; g.lineWidth=1.6; g.beginPath(); g.arc(X(0),Y(0),CTR*s,0,Math.PI*2); g.fill(); g.stroke();
    label('CTR',X(CTR*.72),Y(-CTR*.72),{size:10,c:C.ctr,w:600});
    g.strokeStyle='rgba(31,95,153,.5)'; g.lineWidth=1; g.setLineDash([3,3]); g.strokeRect(X(TRAIN.x0),Y(TRAIN.y1),(TRAIN.x1-TRAIN.x0)*s,(TRAIN.y1-TRAIN.y0)*s); g.setLineDash([]);
    label(st.lang==='no'?'Øvingsområde':'Training area',X(TRAIN.x0)+4,Y(TRAIN.y1)+9,{size:10,c:C.acc});
    if(st.ifr){ g.strokeStyle='rgba(31,95,153,.55)'; g.lineWidth=1.4; g.beginPath(); g.moveTo(X(0),Y(1)); g.lineTo(X(PL.OSVIK.x),Y(PL.OSVIK.y)); g.moveTo(X(PL.TUSKA.x),Y(PL.TUSKA.y)); g.lineTo(X(PL.RONAX.x),Y(PL.RONAX.y)); g.stroke();
      g.setLineDash([2,4]); g.beginPath(); g.moveTo(X(0),Y(-16)); g.lineTo(X(0),Y(-1)); g.stroke(); g.setLineDash([]);
      /* RONAX hold: inbound 360, right turns */
      const hx=PL.RONAX.x, hy=PL.RONAX.y, r=.9; g.beginPath(); g.moveTo(X(hx),Y(hy)); g.lineTo(X(hx),Y(hy-3)); g.arc(X(hx+r),Y(hy-3),r*s,Math.PI,0,true); g.lineTo(X(hx+2*r),Y(hy)); g.arc(X(hx+r),Y(hy),r*s,0,Math.PI,true); g.stroke(); }
    const rw=(q,brg)=>{ const a=brg*Math.PI/180, d=.6; g.strokeStyle=C.rwy; g.lineWidth=3.5; g.beginPath(); g.moveTo(X(q.x-Math.sin(a)*d),Y(q.y-Math.cos(a)*d)); g.lineTo(X(q.x+Math.sin(a)*d),Y(q.y+Math.cos(a)*d)); g.stroke(); };
    for(const k in PL){ const q=PL[k];
      if(q.k==='ad'){ rw(q,0); label('NORDAP',X(q.x)+10,Y(q.y)+12,{w:700,c:C.ink,size:12}); }
      else if(q.k==='ad2'){ g.strokeStyle=C.ink2; g.lineWidth=1.3; g.beginPath(); g.arc(X(q.x),Y(q.y),7,0,Math.PI*2); g.stroke(); rw(q,q.rwy===27?90:0); label(q.l,X(q.x)+11,Y(q.y),{w:600,c:C.ink}); }
      else if(q.k==='vrp'){ g.fillStyle=C.ctr; g.beginPath(); g.moveTo(X(q.x),Y(q.y)-6); g.lineTo(X(q.x)+5,Y(q.y)+4); g.lineTo(X(q.x)-5,Y(q.y)+4); g.closePath(); g.fill(); label(q.l,X(q.x)+8,Y(q.y),{c:C.ctr,w:600,size:10.5}); }
      else if(q.k==='fix'&&st.ifr){ g.strokeStyle=C.ifr; g.lineWidth=1.4; g.beginPath(); g.moveTo(X(q.x),Y(q.y)-5); g.lineTo(X(q.x)+5,Y(q.y)+4); g.lineTo(X(q.x)-5,Y(q.y)+4); g.closePath(); g.stroke(); label(q.l,X(q.x)+8,Y(q.y),{c:C.ifr,w:600,size:10}); } }
    /* scale bar */
    const nm=s*5; g.strokeStyle=C.ink3; g.lineWidth=1; g.beginPath(); g.moveTo(10,H-12); g.lineTo(10+nm,H-12); g.moveTo(10,H-15); g.lineTo(10,H-9); g.moveTo(10+nm,H-15); g.lineTo(10+nm,H-9); g.stroke(); label('5 NM',14+nm,H-12,{size:10,c:C.ink3});
  }
  /* north arrow */
  g.fillStyle=C.ink3; g.beginPath(); g.moveTo(W-16,10); g.lineTo(W-11,22); g.lineTo(W-16,19); g.lineTo(W-21,22); g.closePath(); g.fill(); label('N',W-16,30,{al:'center',size:10,c:C.ink3,w:600});
  /* your track so far (same view only), then the aircraft */
  const tk=(st.track||[]).filter(q=>!!q.ground===!!groundView||!groundView);
  if(tk.length>1){ g.strokeStyle=C.trk; g.lineWidth=2; g.setLineDash([4,4]); g.beginPath(); tk.forEach((q,i)=>{ i?g.lineTo(X(q.x),Y(q.y)):g.moveTo(X(q.x),Y(q.y)); }); g.stroke(); g.setLineDash([]); }
  if(p){ const x=X(p.x), y=Y(p.y);
    if(st.lost){ g.strokeStyle=C.own; g.lineWidth=1.5; g.setLineDash([4,3]); g.beginPath(); g.arc(x,y,26,0,Math.PI*2); g.stroke(); g.setLineDash([]); label('?',x,y-34,{al:'center',w:700,size:14,c:C.own}); }
    else { const a=((st.hdg==null?0:st.hdg))*Math.PI/180; g.save(); g.translate(x,y); g.rotate(a); g.fillStyle=C.own; g.strokeStyle='#fff'; g.lineWidth=1.5;
      g.beginPath(); g.moveTo(0,-11); g.lineTo(2,-4); g.lineTo(10,1); g.lineTo(10,3.5); g.lineTo(2,1.5); g.lineTo(1.6,7); g.lineTo(4.5,9.5); g.lineTo(4.5,11); g.lineTo(0,10); g.lineTo(-4.5,11); g.lineTo(-4.5,9.5); g.lineTo(-1.6,7); g.lineTo(-2,1.5); g.lineTo(-10,3.5); g.lineTo(-10,1); g.lineTo(-2,-4); g.closePath(); g.stroke(); g.fill(); g.restore(); } }
}
G.RSIT={at,where,altText,draw,AT,PL,AD,FL};
})(typeof window!=='undefined'?window:globalThis);
