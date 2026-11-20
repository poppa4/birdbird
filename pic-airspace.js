/* NORDAP – pic-airspace.js: "Build the airspace around an aerodrome" for airspace.html (uses corepic.js).
   A side view that is built up in six steps: class G everywhere, a CTR from the surface, the stepped TMA on top,
   a class E control area and the upper airspace, then the special zones, and finally an IFR and a VFR flight through it.
   The same fictional airspace as the lab model (airspacecore.js). Rules from EASA SERA. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,at,txt,pill,arrow}=CORE.U;
const L=o=>LAB.L(o);
const CC={C:'#5E9BD6',D:'#3FB6A8',E:'#B48AD8',G:'#7D8B95',R:'#EC5A47',RMZ:'#F0B440'};
const hex=(c,a)=>{ const n=parseInt(c.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; };
const KN=[[0,0],[3000,.3],[5000,.45],[10000,.62],[20000,.86],[26000,1]];
const fOf=a=>{ for(let i=1;i<KN.length;i++){ if(a<=KN[i][0]){ const [a0,f0]=KN[i-1],[a1,f1]=KN[i]; return f0+(f1-f0)*(a-a0)/(a1-a0); } } return 1; };

const steps=[
 {t:{en:'Class G everywhere',no:'Klasse G overalt'},
  d:{en:'Start with empty sky: <em>uncontrolled, class G</em>. Anyone may fly here without a clearance; nobody separates anyone. Flight information if you ask.',
     no:'Start med tom himmel: <em>ukontrollert, klasse G</em>. Alle kan fly her uten klarering; ingen separerer noen. Flygeinformasjon hvis du spør.'}},
 {t:{en:'A control zone from the surface',no:'En kontrollsone fra bakken'},
  d:{en:'Around the aerodrome, a <em>CTR</em> from the surface to 2500 ft, here <em>class D</em>. Everyone needs a clearance and the radio to enter; ATC separates IFR from IFR.',
     no:'Rundt flyplassen en <em>CTR</em> fra bakken til 2500 ft, her <em>klasse D</em>. Alle trenger klarering og radio for å fly inn; ATC separerer IFR fra IFR.'}},
 {t:{en:'The TMA on top, in steps',no:'TMA-et oppå, i trinn'},
  d:{en:'Above it a <em>TMA</em>, here <em>class C</em>, for arrivals and departures. Its <em>lower limit steps up</em> away from the aerodrome: 2500, 3500, 4500 ft. Under each step is still class G.',
     no:'Over den et <em>TMA</em>, her <em>klasse C</em>, for ankomster og avganger. Den <em>nedre grensen trappes opp</em> bort fra flyplassen: 2500, 3500, 4500 ft. Under hvert trinn er det fortsatt klasse G.'}},
 {t:{en:'Control area and upper airspace',no:'Kontrollområde og øvre luftrom'},
  d:{en:'Further out a <em>control area in class E</em> from FL95: controlled for IFR, open to VFR without a clearance. Above <em>FL195</em> the upper airspace, class C; no VFR there.',
     no:'Lenger ute et <em>kontrollområde i klasse E</em> fra FL95: kontrollert for IFR, åpent for VFR uten klarering. Over <em>FL195</em> øvre luftrom, klasse C; ingen VFR der.'}},
 {t:{en:'Special zones on top of the class',no:'Spesielle soner oppå klassen'},
  d:{en:'A <em>restricted area</em> you may not enter while it is active, and an <em>RMZ</em> around a small airfield: still class G, but you must listen out and call before entering.',
     no:'Et <em>restriksjonsområde</em> du ikke kan fly inn i mens det er aktivt, og en <em>RMZ</em> rundt en liten flyplass: fortsatt klasse G, men du må lytte og melde deg før du flyr inn.'}},
 {t:{en:'Two flights through it',no:'To flyginger gjennom det'},
  d:{en:'The <em>IFR</em> departure climbs inside controlled airspace all the way, with a clearance. The <em>VFR</em> flight stays under the TMA steps in class G and needs nobody, as long as the weather meets the VMC minima.',
     no:'<em>IFR</em>-avgangen stiger inne i kontrollert luftrom hele veien, med klarering. <em>VFR</em>-flygingen holder seg under TMA-trinnene i klasse G og trenger ingen, så lenge været oppfyller VMC-minima.'},
  go:{en:'Fly it yourself in the lab',no:'Fly selv i labben',fn:()=>{ const v=document.querySelector('[data-lab-model]'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.85:1, pl=sm?8:12, pr=sm?8:12, top=H*.08, yg=H*(sm?.88:.86);
  const X=nm=>pl+(nm+40)/80*(W-pl-pr), Y=a=>yg-fOf(a)*(yg-top);
  const a=[0,1,2,3,4,5].map(i=>at(p,i,.8));
  /* sky and ground */
  const sk=g.createLinearGradient(0,top,0,yg); sk.addColorStop(0,'#0E1722'); sk.addColorStop(1,'#203245'); g.fillStyle=sk; g.fillRect(0,0,W,yg);
  g.fillStyle='#2d3628'; g.fillRect(0,yg,W,H-yg);
  g.fillStyle='#E6EBEF'; g.fillRect(X(0)-9,yg-2,18,3); txt(g,'Nordvik',X(0),yg+15*fs,{al:'center',size:10.5*fs,col:'#DDE4EA'});
  const box=(x0,x1,a0,a1,c,al,o)=>{ g.save(); g.globalAlpha*=o; g.fillStyle=hex(c,al); g.fillRect(X(x0),Y(a1),X(x1)-X(x0),Y(a0)-Y(a1)); g.strokeStyle=hex(c,.95); g.lineWidth=1.5; g.strokeRect(X(x0),Y(a1),X(x1)-X(x0),Y(a0)-Y(a1)); g.restore(); };
  const big=(s,x,alt,c,o,sub)=>{ g.save(); g.globalAlpha*=o; txt(g,s,X(x),Y(alt),{al:'center',size:(sm?16:22)*fs,w:700,col:c}); if(sub) txt(g,sub,X(x),Y(alt)+14*fs,{al:'center',size:10*fs,col:'#C9D2DA'}); g.restore(); };
  /* 1 · G */
  big('G',-30,2500,hex(CC.G,1),1-a[4]*.3,L({en:'uncontrolled',no:'ukontrollert'}));
  if(a[2]>0) big('G',-12,1300,hex(CC.G,1),a[2]); if(a[2]>0) big('G',12,1300,hex(CC.G,1),a[2]);
  /* 4 · E and upper */
  if(a[3]>0){ box(-40,-25,9500,19500,CC.E,.22,a[3]); box(25,40,9500,19500,CC.E,.22,a[3]); box(-40,40,19500,26000,CC.C,.18,a[3]);
    big('E',-33,14000,hex(CC.E,1),a[3],'FL95–FL195'); big('E',33,14000,hex(CC.E,1),a[3],'FL95–FL195'); big('C',-14,23000,hex(CC.C,1),a[3],L({en:'above FL195',no:'over FL195'}));
    g.save(); g.globalAlpha*=a[3]; g.strokeStyle='rgba(236,90,71,.7)'; g.setLineDash([4,4]); g.beginPath(); g.moveTo(pl,Y(19500)); g.lineTo(W-pr,Y(19500)); g.stroke(); g.setLineDash([]); txt(g,L({en:'FL195 · no VFR above',no:'FL195 · ingen VFR over'}),W-pr-4,Y(19500)-4,{al:'right',size:10*fs,col:'#EC8A7C',mono:1,w:500}); g.restore(); }
  /* 3 · TMA */
  if(a[2]>0){ g.save(); g.globalAlpha*=a[2]; const tp=[[-25,4500],[-15,4500],[-15,3500],[-8,3500],[-8,2500],[8,2500],[8,3500],[15,3500],[15,4500],[25,4500],[25,19500],[-25,19500]];
    g.beginPath(); tp.forEach(([x,al],i)=>i?g.lineTo(X(x),Y(al)):g.moveTo(X(x),Y(al))); g.closePath(); g.fillStyle=hex(CC.C,.26); g.fill(); g.strokeStyle=hex(CC.C,.95); g.lineWidth=1.6; g.stroke();
    txt(g,'C',X(0),Y(11000),{al:'center',size:(sm?16:22)*fs,w:700,col:hex(CC.C,1)}); txt(g,'TMA',X(0),Y(11000)+14*fs,{al:'center',size:10*fs,col:'#C9D2DA'});
    if(!sm) [[11.5,3500],[20,4500],[-11.5,3500],[-20,4500]].forEach(([x,al])=>txt(g,al+' ft',X(x),Y(al)-4,{al:'center',size:9.5,col:hex(CC.C,1),mono:1,w:600})); g.restore(); }
  /* 2 · CTR */
  if(a[1]>0){ box(-8,8,0,2500,CC.D,.34,a[1]); big('D',0,1250,'#fff',a[1],'CTR'); }
  /* 5 · special zones */
  if(a[4]>0){ g.save(); g.globalAlpha*=a[4]; const x0=X(-34),x1=X(-28),y0=Y(6500); g.fillStyle=hex(CC.R,.16); g.fillRect(x0,y0,x1-x0,yg-y0); g.strokeStyle=CC.R; g.lineWidth=1.5; g.strokeRect(x0,y0,x1-x0,yg-y0); txt(g,'R',(x0+x1)/2,Y(3000),{al:'center',size:(sm?14:18)*fs,w:700,col:CC.R});
    const m0=X(29),m1=X(37),my=Y(2000); g.setLineDash([5,4]); g.strokeStyle=CC.RMZ; g.strokeRect(m0,my,m1-m0,yg-my); g.setLineDash([]); g.fillStyle=hex(CC.RMZ,.1); g.fillRect(m0,my,m1-m0,yg-my); txt(g,'RMZ',(m0+m1)/2,my-5,{al:'center',size:10.5*fs,col:CC.RMZ,w:700}); g.restore(); }
  /* 6 · two flights */
  if(a[5]>0){ const k=clamp((tm%8)/8,0,1)*a[5];
    /* IFR: from the runway eastward, climbing inside the CTR, TMA and upper airspace */
    const ifr=[[0,0],[6,2000],[14,9000],[24,18000],[36,24000]];
    const vfr=[[-10,1500],[-14,3000],[-24,3000],[-27,2500]];   /* west of the CTR, under the steps, short of the R area */
    const path=(pts,col,dash)=>{ g.save(); g.globalAlpha*=a[5]; g.strokeStyle=col; g.lineWidth=2.2; g.setLineDash(dash||[]); g.beginPath(); pts.forEach(([x,al],i)=>i?g.lineTo(X(x),Y(al)):g.moveTo(X(x),Y(al))); g.stroke(); g.setLineDash([]); g.restore(); };
    path(ifr,'#fff'); path(vfr,C.mag,[6,4]);
    const lerpP=(pts,f)=>{ const n=pts.length-1, i=Math.min(n-1,Math.floor(f*n)), u=f*n-i; return [pts[i][0]+(pts[i+1][0]-pts[i][0])*u,pts[i][1]+(pts[i+1][1]-pts[i][1])*u]; };
    const [ix,ia]=lerpP(ifr,k), [vx,va]=lerpP(vfr,k);
    g.save(); g.globalAlpha*=a[5]; g.fillStyle='#fff'; g.beginPath(); g.arc(X(ix),Y(ia),4,0,7); g.fill(); g.fillStyle=C.mag; g.beginPath(); g.arc(X(vx),Y(va),4,0,7); g.fill(); g.restore();
    pill(g,'IFR · '+L({en:'cleared',no:'klarert'}),X(20),Y(15500),{size:10.5*fs,col:'#fff',a:a[5],al:'center'});
    pill(g,'VFR · '+L({en:'class G, no clearance',no:'klasse G, ingen klarering'}),X(-19),Y(3000)+16*fs,{size:10.5*fs,col:C.mag,a:a[5],al:'center'}); }
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.15,dwell:6,
    title:{en:'Build the airspace around an aerodrome',no:'Bygg luftrommet rundt en flyplass'},
    sub:{en:'Six layers, one at a time. Each one changes what a pilot needs before flying into it.',no:'Seks lag, ett om gangen. Hvert av dem endrer hva en pilot trenger før han flyr inn.'},
    label:{en:'Animated side view of the airspace around an aerodrome: class G, a class D control zone, a stepped class C TMA, a class E control area, upper airspace above FL195, a restricted area and an RMZ, with an IFR and a VFR flight.',no:'Animert sidebilde av luftrommet rundt en flyplass: klasse G, en kontrollsone i klasse D, et TMA i klasse C i trinn, et kontrollområde i klasse E, øvre luftrom over FL195, et restriksjonsområde og en RMZ, med en IFR- og en VFR-flyging.'},
    foot:{en:'Fictional airspace, the same as in the lab below. Heights stretched low down so the CTR and the steps can be read. Rules: EASA SERA.',no:'Fiktivt luftrom, det samme som i labben under. Høydene er strukket lavt nede så CTR og trinnene kan leses. Regler: EASA SERA.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
