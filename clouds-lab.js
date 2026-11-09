/* Birdbird – clouds-lab.js: "Clouds, stability and fog" (clouds.html).
   One viewport, three views on the same sky:
   lift  – a parcel rises, cools at the dry then the saturated rate, makes cloud at its base; the temperature profile overlays on the right
   types – the ten cloud genera at their heights, with a card per type (tap or hover)
   fog   – radiation fog through a night at an aerodrome (scene + time chart), or advection fog over a cold sea (scene + distance chart)
   Static layers are drawn to offscreen canvases when something changes; each frame only draws images and a few moving marks. */
(function(){
'use strict';
const {L,el,nf}=LAB;
const t2=(en,no)=>({en,no});
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const isIns=()=>document.body.classList.contains('depth-instructor');
const C={env:'#F0B440',par:'#E46BAE',dew:'#71CC93',fz:'#7FCBE8',ink:'#E6EBEF',ink2:'#AEB8C1',ink3:'#7D8B95',dark:'#10171D',pill:'rgba(12,16,20,.82)',red:'#EC5A47',amber:'#F0B440',green:'#71CC93'};
const MONO='IBM Plex Mono, monospace', SANS='"Public Sans", sans-serif';

/* =====================================================================
   Strings for rich prose (the page holds the English)
   ===================================================================== */
LAB.add({},{
 'Clouds, Stability and Fog':'Skyer, stabilitet og tåke','Clouds, stability and fog':'Skyer, stabilitet og tåke','Birdbird Virtual Lab · Meteorology':'Birdbird Virtual Lab · Meteorologi',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Key points':'3 · Det viktigste','3 · Test yourself':'3 · Test deg selv',
 'Key concepts':'Nøkkelbegreper','Clouds and stability lab':'Sky- og stabilitetslabben','Try it':'Prøv selv','What happened, and why it matters':'Hva som skjedde, og hvorfor det betyr noe','Pilot takeaways':'Dette tar piloten med seg','Key points':'Det viktigste','Test yourself':'Test deg selv',
 'Controls':'Kontroller','Conditions':'Forhold','Values':'Verdier','Scenarios':'Scenarier','Advanced':'Avansert','What lifts the air':'Hva løfter luften','Type of fog':'Type tåke','The ten cloud types':'De ti skyslagene',
 'Cloud base':'Skybase','Cloud tops':'Skytopper','Freezing level':'Frysenivå','The air is':'Luften er','Cloud':'Sky','Precipitation':'Nedbør','Saturated lapse rate at the base':'Fuktigadiabatisk gradient ved basen','Inversion aloft (a lid)':'Inversjon i høyden (et lokk)',
 'All cloud types, fog types and visibility terms in one table':'Alle skyslag, tåketyper og siktbegreper i én tabell',
 'Surface temperature (°C)':'Temperatur ved bakken (°C)','Dew point (°C)':'Duggpunkt (°C)','Lapse rate of the air around, ELR (°C per 1000 ft)':'Temperaturgradient i luften rundt, ELR (°C per 1000 ft)','Height of the hills (ft)':'Høyde på terrenget (ft)','Inversion height (ft)':'Inversjonshøyde (ft)',
 'Temperature at sunset (°C)':'Temperatur ved solnedgang (°C)','Wind (kt)':'Vind (kt)','Time':'Tid','Air temperature over the sea (°C)':'Lufttemperatur over havet (°C)','Sea temperature (°C)':'Sjøtemperatur (°C)','Sky':'Himmel',
 'Heating':'Oppvarming','Hills':'Terreng','Front':'Front','Convergence':'Konvergens','Radiation':'Stråling','Advection':'Adveksjon','Clear':'Klar','Partly':'Delvis','Overcast':'Overskyet'
});
LAB.tx({
 lead:'Nesten alt vær starter på samme måte: luft kjøles ned til duggpunktet. Løft en luftpakke og se skyen dannes ved basen og vokse til et flatt lag, en godværscumulus eller et tordenvær, med temperaturprofilen som avgjør det ved siden av. Møt de ti skyslagene i sine høyder, og kjøl så ned en klar natt og se tåken dannes og lette.',
 goal:'<span class="k">Læringsmål</span>Bruk temperaturgradientene til å skille stabil fra ustabil luft, anslå skybasen og frysenivået, kjenne igjen skyslagene og hva de betyr for flygingen, og vurdere når tåke dannes og letter.',
 u0:'Stigende luft utvider seg og kjøles. Om den fortsetter å stige, avhenger av hvor fort den kjøles sammenlignet med luften rundt: det er <b>stabilitet</b>. Der den kjøles til <b>duggpunktet</b>, dannes sky; der bakken kjøler luften til duggpunktet, dannes tåke. Hvert kort lenker til stedet i modellen der det vises.',
 u3:'<span class="k">Dypdykk · tallene bak</span><p><b>Hvorfor 400 ft per °C?</b> Stigende umettet luft kjøles med den tørradiabatiske gradienten, rundt 3 °C per 1000 ft, mens duggpunktet bare faller rundt 0,5 °C per 1000 ft. Spredningen lukkes med rundt 2,5 °C per 1000 ft, så hver °C spredning er rundt 400 ft løft (meteorologer bruker rundt 125 m per °C).</p><p><b>Hvorfor den fuktigadiabatiske gradienten varierer.</b> Kondensasjon frigjør latent varme. Varm luft holder mye mer vanndamp, så nær bakken om sommeren er den mettede gradienten rundt 1,2–1,5 °C per 1000 ft; ved 0 °C rundt 1,8; i den kalde øvre troposfæren nærmer den seg den tørre. Eksamensspørsmål bruker ofte rundt 1,8 °C per 1000 ft som et gjennomsnitt.</p><p><b>ISA.</b> Standardatmosfæren bruker 1,98 °C per 1000 ft (6,5 °C per km) opp til tropopausen i 36 090 ft, der det er −56,5 °C. En virkelig dags profil måles med radiosonder og tegnes på et tefigram eller skew-T-diagram.</p>',
 e1:'Én luftsøyle. Velg hva som løfter den, og still temperaturen, duggpunktet og hvor fort luften rundt kjøles med høyden. Luftpakken stiger, kjøles og lager sky ved basen; om den stopper der eller tårner seg opp til et tordenvær, avgjøres av temperaturprofilen til høyre. Skyslag viser alle ti skyslagene i sine høyder, og Tåke kjøler luften nedenfra i stedet.',
 t1:'Fire korte oppgaver. To løser du i modellen, med direkte tilbakemelding; to svarer du på her, og ser dem så i modellen.',
 d1:'<div class="box"><b class="t"><i>1</i>Stabiliteten bestemmer skyen</b><p>En løftet luftpakke fortsetter bare å stige så lenge den er varmere enn luften rundt. Stabil luft gir flate lag (ST, SC, NS), dis og rolig luft; ustabil luft gir haugskyer (CU, TCU, CB), byger og turbulens, og med nok dybde og fuktighet tordenvær.</p></div><div class="box"><b class="t"><i>2</i>Basen kommer fra spredningen</b><p>Stigende luft lukker spredningen mellom temperatur og duggpunkt med rundt 2,5 °C per 1000 ft, så basen til konvektive skyer er rundt 400 ft per °C spredning. Det virker for cumulus, ikke for lagskyer som kommer med en front.</p></div><div class="box"><b class="t"><i>3</i>Tåke krever at spredningen lukkes ved bakken</b><p>Strålingståke: klar himmel, svak vind og fuktig luft om kvelden. Adveksjonståke: fuktig luft over en kaldere overflate, i sterkere vind og når som helst på døgnet. Trenden i spredningen i METAR varsler deg først.</p></div>',
 d2:'<li><b>Les stabiliteten i METAR og TAF.</b> CU, TCU, CB og SH betyr ustabil luft: humpete under basen, god sikt mellom bygene. ST, SC, BR, FG og HZ betyr stabil luft: rolig, men dårlig sikt og lavt skydekke.</li><li><b>Kjenn frysenivået.</b> I sky mellom 0 °C og rundt −20 °C må du regne med ising, verst i toppen av haugskyer med store dråper. På A320: motor-antiis ved isingsforhold, vinge-antiis når det bygger seg is.</li><li><b>CB og TCU unngås, de gjennomflys ikke.</b> Bruk værradaren tidlig og planlegg å holde god avstand (typisk 20 NM fra en CB, mer over frysenivået og nedstrøms for ambolten).</li><li><b>Følg med på spredningen om kvelden.</b> En spredning på 2–3 °C ved skumring med klar himmel og svak vind betyr at tåke før daggry er sannsynlig. Sjekk TAF for destinasjon og alternativ, RVR-trenden og dine minima for dårlig sikt.</li><li><b>Skråsikten kan være mye dårligere enn rapportert sikt.</b> I grunn tåke kan du se banen ovenfra, og så miste den på kort finale når du kommer inn i laget.</li>',
 d3:'<span class="k">Dypdykk · i A320</span><p><b>Tåke og autoland.</b> Det er i tåke autoland på A320 gjør nytte for seg. Med riktig godkjenning, trening og bane går CAT II- og CAT III-innflyginger ned til en beslutningshøyde på 100 ft eller lavere og RVR på noen hundre meter. Sjekk RVR-trenden og startminima før avgang, og planlegg en alternativ flyplass utenfor tåkeområdet.</p><p><b>Konvektive dager.</b> Planlegg stigning og nedstigning rundt CB-ene, vipp radaren for å skanne under frysenivået der cellen reflekterer mest, og regn med turbulens og vindskjær under og nær basen av enhver stor cumulus.</p>',
 foot:'<b>Modell og begrensninger.</b> Opplæringsmodell av én stigende luftpakke. Den tørradiabatiske gradienten er 3 °C per 1000 ft og pakkens duggpunkt faller 0,5 °C per 1000 ft, så skybasen er (T − Td) × 400 ft. Den fuktigadiabatiske gradienten regnes fra temperaturen og ISA-trykket i hver høyde (rundt 1,2–2,8 °C per 1000 ft). Luften rundt har én rett gradient opp til en tropopause i 36 000 ft (med oppvarming er laget under skybasen godt blandet), med en valgfri inversjon. Det er ingen innblanding av luften rundt, ingen isfase og ingen fuktighet i høyden, så virkelige skyer er ofte mindre, og virkelige temperaturprofiler er aldri rette linjer. Høydene for skyslagene er typiske verdier for midlere breddegrader. Tåkemodellen bruker typiske avkjølingsrater og virkninger av vind og skydekke og er bare illustrerende. Bruk TAF, trenden i METAR og prognosekartene til beslutninger.'
});

/* =====================================================================
   Physics: lapse rates and the parcel
   ===================================================================== */
const HTOP=40000, TROP=36000, DZ=50, N=HTOP/DZ+1, DALR=3, DEWL=0.5;
const pAt=h=>1013.25*Math.pow(1-6.8756e-6*Math.min(h,36089),5.2559)*(h>36089?Math.exp(-(h-36089)/20806):1);
/* saturated adiabatic lapse rate, °C per 1000 ft, from the temperature (°C) and the ISA pressure at h (ft) */
function salr(T,h){ const p=pAt(h), es=6.112*Math.exp(17.67*T/(T+243.5)), rs=0.622*es/Math.max(1,p-es), Tk=T+273.15, Lv=2.5e6, Rd=287;
  return 304.8*9.81*(1+Lv*rs/(Rd*Tk))/(1005+Lv*Lv*rs*0.622/(Rd*Tk*Tk)); }
const S={mode:'heat',t:24,td:14,elr:1.6,ridge:6000,inv:false,invH:6000,prof:true,full:false};
const FORCE=()=>({heat:0,hill:S.ridge,front:15000,conv:5000})[S.mode];
const ENV=new Float32Array(N), PAR=new Float32Array(N);
const R={lcl:0,base:null,top:0,cloud:false,free:false,fz:null,type:'none',stab:'stable',salrB:1.5,topT:0,nTop:0};
function envBase(h,lcl){ if(S.mode==='heat'){ if(h<=lcl){ const sl=Math.min(1,h/300); return S.t-sl*0.8-DALR*h/1000; } return S.t-0.8-DALR*lcl/1000-S.elr*(h-lcl)/1000; } return S.t-S.elr*h/1000; }
function compute(){ const lcl=Math.max(0,(S.t-S.td)*400), F=FORCE(); R.lcl=lcl;
  for(let i=0;i<N;i++){ const h=Math.min(i*DZ,TROP); let e=envBase(h,lcl);
    if(S.inv&&i*DZ>S.invH){ const fr=Math.min(1,(i*DZ-S.invH)/500), lr=S.mode==='heat'&&S.invH>lcl?S.elr:S.mode==='heat'?DALR:S.elr; e+=(3+lr*0.5)*fr; }
    ENV[i]=e; }
  let tp=S.t, sat=false, base=null, top=HTOP, nTop=N-1;
  for(let i=0;i<N;i++){ const h=i*DZ; PAR[i]=tp;
    if(!sat&&h>=lcl){ sat=true; base=h; }
    if(i>0&&h>F&&tp<=ENV[i]){ top=h; nTop=i; break; }
    tp-=(sat?salr(tp,h):DALR)*DZ/1000; }
  for(let i=nTop+1;i<N;i++) PAR[i]=NaN;
  R.base=base; R.top=top; R.nTop=nTop; R.cloud=base!=null&&base<top-100; R.free=S.mode==='heat'?true:top>F+300;
  R.fz=null; for(let i=0;i<N;i++){ if(ENV[i]<=0){ R.fz=i*DZ; break; } }
  const ib=base!=null?Math.round(base/DZ):0; R.salrB=salr(R.cloud?PAR[ib]:Math.max(-30,S.t-DALR*lcl/1000),R.cloud?base:lcl);
  R.stab=S.elr>=DALR?'abs':S.elr>R.salrB?'cond':'stable';
  R.topT=ENV[Math.min(N-1,nTop)];
  const depth=R.cloud?top-base:0;
  let ty='none';
  if(!R.cloud) ty=S.mode==='heat'?'blue':'none';
  else if(!R.free){ if(S.mode==='front') ty=base>=6500?'as':depth>=6000?'ns':'st'; else if(S.mode==='hill') ty='cap'; else ty=base<1500?'st':'sc'; }
  else if(S.inv&&top>=S.invH&&top<=S.invH+800&&depth<6000) ty='sc';
  else ty=depth<3000?'cuh':depth<9000?'cu':(depth<16000||R.topT>-20)?'tcu':'cb';
  R.type=ty; }
const TYPE={none:t2('no cloud','ingen sky'),blue:t2('no cloud: dry thermals','ingen sky: tørrtermikk'),cuh:t2('fair-weather cumulus (CU)','godværscumulus (CU)'),cu:t2('cumulus (CU)','cumulus (CU)'),tcu:t2('towering cumulus (TCU)','tårnende cumulus (TCU)'),cb:t2('cumulonimbus (CB)','cumulonimbus (CB)'),
  st:t2('stratus (ST)','stratus (ST)'),sc:t2('stratocumulus (SC)','stratocumulus (SC)'),ns:t2('nimbostratus (NS)','nimbostratus (NS)'),as:t2('altostratus (AS)','altostratus (AS)'),cap:t2('cap cloud on the hills (ST/SC)','hettesky på terrenget (ST/SC)')};
const T2G={cuh:'CU',cu:'CU',tcu:'CU',cb:'CB',st:'ST',sc:'SC',ns:'NS',as:'AS',cap:'ST'};
function precip(){ const ty=R.type, snow=R.fz!=null&&R.fz<1500;
  return ty==='cb'?t2('heavy showers, hail, thunder (+TSRA)','kraftige byger, hagl, torden (+TSRA)'):ty==='tcu'?t2(snow?'snow showers (SHSN)':'showers (SHRA)',snow?'snøbyger (SHSN)':'regnbyger (SHRA)'):ty==='cu'?t2('none, or a light shower','ingen, eller en lett byge')
   :ty==='ns'?t2(snow?'continuous snow (SN)':'continuous rain (RA)',snow?'vedvarende snø (SN)':'vedvarende regn (RA)'):ty==='as'?t2('light rain or snow possible','lett regn eller snø mulig'):ty==='st'?t2('drizzle possible (DZ)','yr mulig (DZ)'):ty==='sc'?t2('none, or light drizzle','ingen, eller lett yr'):ty==='cap'?t2('rain or drizzle on the windward slopes','regn eller yr i lo-liene'):t2('none','ingen'); }

/* =====================================================================
   Drawing primitives: one cloud vocabulary for the lift scene and the cloud types
   ===================================================================== */
let seed=1; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
function puff(g,x,y,r){ g.moveTo(x+r,y); g.arc(x,y,r,0,7); }
/* heaped cloud: rows of puffs from the flat base to the top, shaded darker underneath */
function cumulus(g,cx,yb,yt,w,o){ o=o||{}; seed=o.seed||7; const h=Math.max(8,yb-yt), r0=Math.max(5,Math.min(26,w*0.16));
  const gr=g.createLinearGradient(0,yt,0,yb); gr.addColorStop(0,o.top||'#F4F7F9'); gr.addColorStop(0.65,o.mid||'#DCE3E9'); gr.addColorStop(1,o.bot||'#8D99A5');
  g.save(); g.beginPath(); g.rect(cx-w*2,yt-r0*2.5,w*4,yb-yt+r0*2.5); g.clip(); g.fillStyle=gr; g.beginPath();
  const rows=Math.max(2,Math.round(h/(r0*0.9)));
  for(let i=0;i<=rows;i++){ const f=i/rows, y=yb-h*f, ww=w*(o.taper?1-o.taper*f:1)*(0.85+0.15*Math.sin(f*3+1)), n=Math.max(2,Math.round(ww/(r0*1.1)));
    for(let k=0;k<=n;k++){ const x=cx-ww/2+ww*k/n+(rnd()-0.5)*r0*0.6, r=r0*(0.75+rnd()*0.55)*(f>0.85?0.9:1); puff(g,x,y-r*0.2,r); } }
  g.fill(); g.restore();
  g.fillStyle=gr; g.fillRect(cx-w*0.5,yb-Math.min(h*0.5,r0),w,Math.min(h*0.5,r0)); }
function anvil(g,cx,yt,w,span){ const gr=g.createLinearGradient(0,yt-6,0,yt+26); gr.addColorStop(0,'#EEF2F5'); gr.addColorStop(1,'#A9B4BE');
  g.fillStyle=gr; g.beginPath(); g.moveTo(cx-w*0.35,yt+30); g.quadraticCurveTo(cx-w*0.6,yt+4,cx-span*0.35,yt+2); g.lineTo(cx-span*0.38,yt-6); g.lineTo(cx+span,yt-8); g.quadraticCurveTo(cx+span*1.05,yt+4,cx+span*0.9,yt+10); g.quadraticCurveTo(cx+w*0.6,yt+12,cx+w*0.35,yt+34); g.closePath(); g.fill(); }
/* layer cloud: a sheet with a gently lumpy top and base */
function layer(g,x0,x1,yt,yb,col,o){ o=o||{}; seed=o.seed||3; const n=Math.max(4,Math.round((x1-x0)/14));
  const gr=g.createLinearGradient(0,yt,0,yb); gr.addColorStop(0,o.top||col); gr.addColorStop(1,col); g.fillStyle=gr; g.beginPath(); g.moveTo(x0,yb);
  for(let i=0;i<=n;i++){ const x=x0+(x1-x0)*i/n; g.lineTo(x,yt+(o.lump||2)*(rnd()-0.5)*2); }
  for(let i=n;i>=0;i--){ const x=x0+(x1-x0)*i/n; g.lineTo(x,yb+(o.ragged||1.5)*(rnd()-0.5)*2); } g.closePath(); g.fill(); }
/* stratocumulus and altocumulus: rolls or patches of flattened puffs */
function rolls(g,x0,x1,yt,yb,col,dark,o){ o=o||{}; seed=o.seed||5; const h=yb-yt, step=o.step||Math.max(10,h*1.6);
  for(let x=x0;x<x1;x+=step*(0.9+rnd()*0.3)){ const w=step*(o.gap?0.75:1.35), cy=yt+h*0.55+(rnd()-0.5)*h*0.25; const gr=g.createLinearGradient(0,yt,0,yb); gr.addColorStop(0,col); gr.addColorStop(1,dark);
    g.fillStyle=gr; g.beginPath(); g.ellipse(x+w/2,cy,w/2,h/2,0,0,7); puff(g,x+w*0.35,cy-h*0.25,h*0.38); puff(g,x+w*0.62,cy-h*0.22,h*0.34); g.fill(); } }
function wisps(g,x,y,w,o){ seed=o&&o.seed||9; g.lineCap='round'; for(let i=0;i<5;i++){ const yy=y+(i-2)*5+rnd()*3, xx=x+(rnd()-0.5)*w*0.3; g.strokeStyle=`rgba(236,242,246,${0.35+rnd()*0.4})`; g.lineWidth=1.2+rnd()*1.6; g.beginPath(); g.moveTo(xx,yy+8); g.quadraticCurveTo(xx+w*0.3,yy-2,xx+w*0.9,yy-10-rnd()*8); g.stroke(); } }
function ripples(g,x,y,w,h){ seed=11; g.fillStyle='rgba(236,242,246,.75)'; for(let j=0;j<4;j++) for(let i=0;i<Math.round(w/9);i++){ if(rnd()<0.2) continue; g.beginPath(); g.ellipse(x+i*9+(j%2)*4,y+j*(h/4),3.2,1.8,0,0,7); g.fill(); } }
function bolt(g,x,y,len){ g.strokeStyle='#FFE89A'; g.lineWidth=1.6; g.beginPath(); g.moveTo(x,y); g.lineTo(x-5,y+len*0.35); g.lineTo(x+3,y+len*0.45); g.lineTo(x-4,y+len); g.stroke(); }
function rainShaft(g,x0,x1,yb,yg,col){ const gr=g.createLinearGradient(0,yb,0,yg); gr.addColorStop(0,col); gr.addColorStop(1,'rgba(127,160,190,0)'); g.fillStyle=gr; g.beginPath(); g.moveTo(x0,yb); g.lineTo(x1,yb); g.lineTo(x1-8,yg); g.lineTo(x0-14,yg); g.closePath(); g.fill(); }
function pillTxt(g,x,y,txt,fg,bg,font,al){ g.font=font; const w=g.measureText(txt).width, ph=parseFloat(font.match(/(\d+(?:\.\d+)?)px/)[1]), x0=al==='r'?x-w-10:al==='c'?x-w/2-5:x;
  g.fillStyle=bg; g.beginPath(); g.roundRect?g.roundRect(x0,y-ph/2-4,w+10,ph+8,3):g.rect(x0,y-ph/2-4,w+10,ph+8); g.fill(); g.fillStyle=fg; g.textBaseline='middle'; g.fillText(txt,x0+5,y+0.5); g.textBaseline='alphabetic'; }

/* =====================================================================
   The viewport: views, tabs, chip, legend, "What you're seeing"
   ===================================================================== */
const VIEWS=[['lift',t2('Lift a parcel','Løft en luftpakke')],['types',t2('Cloud types','Skyslag')],['fog',t2('Fog','Tåke')]];
let view='lift';
const chipLast={}; function chip(id,items){ const h=items.map(([k,v,c])=>`<span><i>${L(k)}</i><b${c?` class="${c}"`:''}>${v}</b></span>`).join(''); if(chipLast[id]!==h){ chipLast[id]=h; el(id).innerHTML=h; } }
let seeLast=''; function see(h){ if(h!==seeLast){ seeLast=h; el('cSee').innerHTML=h; } }
function legend(){ const it=view==='lift'?[[C.par,t2('Rising parcel','Stigende luftpakke')],...(S.prof?[[C.env,t2('Air around (ELR)','Luften rundt (ELR)')],[C.dew,t2('Parcel dew point','Pakkens duggpunkt'),'d']]:[]),[C.fz,t2('Freezing level (0 °C)','Frysenivå (0 °C)'),'d'],['#E6EBEF',t2('Cloud base','Skybase'),'d']]
   :view==='types'?[['rgba(214,165,94,.6)',t2('High: above 20 000 ft','Høye: over 20 000 ft'),'sq'],['rgba(127,203,232,.5)',t2('Middle: 6500–20 000 ft','Middels: 6500–20 000 ft'),'sq'],['rgba(113,204,147,.5)',t2('Low: surface–6500 ft','Lave: bakken–6500 ft'),'sq'],[C.par,t2('Your scenario','Ditt scenario'),'dot']]
   :F.type==='rad'?[[C.env,t2('Temperature','Temperatur')],[C.dew,t2('Dew point','Duggpunkt'),'d'],['#DDE5EC',t2('Fog or mist','Tåke eller dis'),'sq']]:[[C.env,t2('Air temperature','Lufttemperatur')],[C.dew,t2('Dew point','Duggpunkt'),'d'],[C.fz,t2('Sea temperature','Sjøtemperatur')],['#DDE5EC',t2('Fog','Tåke'),'sq']];
  el('cLeg').innerHTML=it.map(([c,n,k])=>`<span><i class="${k||''}" style="--c:${c}"></i>${L(n)}</span>`).join(''); }
function drawTabs(){ el('cTabs').innerHTML=VIEWS.map(([k,n])=>`<button type="button" role="tab" data-v="${k}" class="${k===view?'on':''}" aria-selected="${k===view}">${L(n)}</button>`).join('');
  const lt=view==='lift'; el('tProf').hidden=!lt; el('tFull').hidden=!lt||!S.prof; el('tGo').hidden=view==='types'||(view==='fog'&&F.type!=='rad');
  el('tProf').textContent=L(t2('Profile','Profil')); el('tProf').setAttribute('aria-pressed',String(S.prof));
  el('tFull').textContent=L(t2('Show full chart','Vis hele diagrammet')); el('tFull').setAttribute('aria-pressed',String(S.full));
  el('tGo').textContent=view==='fog'?(fPlay?'❚❚ ':'▶ ')+L(t2('Run the night','Kjør natten')):'▶ '+L(t2('Lift','Løft'));
  el('xsv').textContent=L(VIEWS.find(x=>x[0]===view)[1]); }
function setView(v){ if(!VIEWS.some(x=>x[0]===v)) return; view=v; if(v!=='fog') fPlay=false;
  document.querySelectorAll('#cvp .vv, #capp .vp').forEach(e=>{ e.hidden=!e.dataset.v.split(' ').includes(v); });
  el('cvL').classList.toggle('pick',v==='types'); el('chipL').style.display=v==='types'?'none':''; if(v!=='types') el('tcard').hidden=true;
  drawTabs(); legend(); if(v==='fog'){ fUpd(); } else { liftOut(); lBuild(); if(v==='types') tSel(tSelK); kick(); } }
el('cTabs').addEventListener('click',e=>{ const b=e.target.closest('button[data-v]'); if(b) setView(b.dataset.v); });
function fromHash(){ const h=location.hash.slice(1); const v=h==='fog'?'fog':h==='types'?'types':null; if(!v) return; setView(v); requestAnimationFrame(()=>el('lift').scrollIntoView({block:'start'})); }
addEventListener('hashchange',fromHash);

/* =====================================================================
   View 1 · Lift a parcel (scene + profile overlay) and View 2 · Cloud types (same canvas)
   ===================================================================== */
const CL=LAB.fit(el('cvL'),()=>{ lBuild(); kick(); },2);
const fgL=document.createElement('canvas'), bgL=document.createElement('canvas'), clL=document.createElement('canvas'), ovL=document.createElement('canvas');
const PX=new Float32Array(N);       /* parcel path: x (px) at each height step */
let G={W:0,H:0,yg:0,Y:null,ox:0};
function geo(){ const W=CL.w,H=CL.h, gb=Math.max(22,H*0.055), yg=H-gb, tp=view==='types'?22:W<640?30:Math.max(64,H*0.12), ox=W*(W<640?0.5:0.58);
  G={W,H,yg,ox,fs:isIns()?1.2:(W<480?0.88:1),Y:h=>yg-h/HTOP*(yg-tp),cx:W*(W<640?0.27:0.3),hw:W*(W<640?0.22:0.2)}; return G; }
const hill=x=>{ const u=(x-G.cx)/G.hw; return Math.abs(u)>=1?0:S.ridge*Math.pow(Math.cos(u*Math.PI/2),2); };
const frontX=h=>G.W*0.08+(G.ox-G.W*0.06-G.W*0.08)*h/16000;   /* frontal surface: x where it reaches height h */
function mkCanvas(cv){ const d=CL.dpr; cv.width=Math.max(1,Math.round(G.W*d)); cv.height=Math.max(1,Math.round(G.H*d)); const g=cv.getContext('2d'); g.setTransform(d,0,0,d,0,0); g.clearRect(0,0,G.W,G.H); return g; }
function sky(g,W,H,yg){ const gr=g.createLinearGradient(0,0,0,yg); gr.addColorStop(0,'#0E1722'); gr.addColorStop(0.55,'#1F3247'); gr.addColorStop(1,'#46627C'); g.fillStyle=gr; g.fillRect(0,0,W,yg+1); }
function hAxis(g,step){ const {W,Y,fs}=G; g.font=`${Math.round(10*fs)}px ${MONO}`; g.fillStyle='rgba(174,184,193,.7)'; g.strokeStyle='rgba(255,255,255,.05)'; g.lineWidth=1;
  for(let h=step;h<HTOP;h+=step){ const y=Y(h); g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke(); g.fillText(h>=10000?(h/1000)+' 000 ft':h+' ft',6,y-3); } }
/* --- lift: static background (sky, ground, terrain, lines) --- */
function lBuild(){ if(!CL.w) return; geo(); if(view==='types'){ tBuild(); return; }
  const {W,H,yg,Y,fs}=G, g=mkCanvas(bgL); sky(g,W,H,yg);
  if(S.mode==='heat'){ g.fillStyle='rgba(242,193,78,.95)'; g.beginPath(); g.arc(W*0.06+18,Y(HTOP*0.86),12,0,7); g.fill(); }
  hAxis(g,H<420?10000:5000);
  /* ground */
  const gg=g.createLinearGradient(0,yg,0,H); gg.addColorStop(0,'#4A4A3C'); gg.addColorStop(1,'#2E2E25'); g.fillStyle=gg; g.fillRect(0,yg,W,H-yg);
  if(S.mode==='heat'){ g.fillStyle='rgba(240,140,70,.35)'; g.fillRect(G.cx-G.hw*0.45,yg,G.hw*0.9,4); }
  if(S.mode==='hill'){ g.fillStyle='#4A4A3C'; g.beginPath(); g.moveTo(0,yg); for(let x=0;x<=W;x+=4) g.lineTo(x,Y(hill(x))); g.lineTo(W,yg); g.closePath(); g.fill(); }
  if(S.mode==='front'){ g.fillStyle='rgba(127,203,232,.10)'; g.beginPath(); g.moveTo(frontX(0),yg); g.lineTo(frontX(16000),Y(16000)); g.lineTo(W,Y(16000)); g.lineTo(W,yg); g.closePath(); g.fill();
    g.strokeStyle='rgba(127,203,232,.6)'; g.lineWidth=1.5; g.beginPath(); g.moveTo(frontX(0),yg); g.lineTo(frontX(16000),Y(16000)); g.stroke();
    g.font=`600 ${Math.round(11*fs)}px ${SANS}`; g.fillStyle='rgba(127,203,232,.85)'; g.fillText(L(t2('cold air','kald luft')),frontX(2500)+18,Y(1200)); g.fillText(L(t2('warm air','varm luft')),W*0.04,Y(1200)); }
  if(S.mode==='conv'){ g.strokeStyle='rgba(228,107,174,.6)'; g.lineWidth=2; for(const s of [-1,1]){ const x0=G.cx+s*G.hw*1.3, x1=G.cx+s*G.hw*0.35, y=yg-10; g.beginPath(); g.moveTo(x0,y); g.lineTo(x1,y); g.stroke(); g.fillStyle='rgba(228,107,174,.8)'; g.beginPath(); g.moveTo(x1,y); g.lineTo(x1+s*8,y-4); g.lineTo(x1+s*8,y+4); g.closePath(); g.fill(); } }
  /* parcel path */
  for(let i=0;i<N;i++){ const h=i*DZ; let x=G.cx;
    if(S.mode==='hill'){ const xs=G.cx-G.hw*1.2; if(h<=S.ridge){ /* climb the windward slope */ let lo=xs, hi=G.cx; for(let k=0;k<18;k++){ const m=(lo+hi)/2; if(hill(m)<h) lo=m; else hi=m; } x=Math.max(xs,lo); } }
    else if(S.mode==='front'){ x=h<=15000?frontX(h)-6:frontX(15000)-6; }
    else if(S.mode==='heat') x=G.cx+Math.sin(h/2600)*6;
    PX[i]=x; }
  if(S.mode==='hill') PX[0]=G.cx-G.hw*1.3;
  /* cloud */
  const c=mkCanvas(clL); if(R.cloud) drawLiftCloud(c);
  /* lines across the whole view, drawn over the cloud: freezing level, cloud base */
  const f=mkCanvas(fgL), lf=`500 ${Math.round(10.5*fs)}px ${MONO}`, lx=Math.max(10,G.ox-12);
  if(R.cloud){ const y=Y(R.base); f.setLineDash([2,4]); f.strokeStyle='rgba(230,235,239,.7)'; f.lineWidth=1.2; f.beginPath(); f.moveTo(0,y); f.lineTo(W,y); f.stroke(); f.setLineDash([]);
    pillTxt(f,lx,y,L(t2('base ','base '))+fmtH(R.base),C.ink,C.pill,lf,'r'); }
  if(R.fz!=null&&R.fz<HTOP){ const y=Y(R.fz); f.setLineDash([6,5]); f.strokeStyle='rgba(127,203,232,.7)'; f.lineWidth=1.2; f.beginPath(); f.moveTo(0,y); f.lineTo(W,y); f.stroke(); f.setLineDash([]);
    pillTxt(f,lx,R.cloud&&Math.abs(y-Y(R.base))<20?y-20:y,`0 °C · ${R.fz===0?'SFC':fmtH(R.fz)}`,C.fz,C.pill,lf,'r'); }
  /* overlay: the temperature profile */
  ovBuild(); }
function drawLiftCloud(g){ const {W,yg,Y}=G, yb=Y(R.base), yt=Y(R.top), ty=R.type, x=PX[Math.min(N-1,Math.round(R.base/DZ))], xt=PX[Math.min(N-1,R.nTop)];
  if(ty==='cuh'||ty==='cu'||ty==='tcu'||ty==='cb'){ const depth=R.top-R.base, w=Math.min(W*0.34,Math.max(46,30+depth/1000*(ty==='cb'?9:11)));
    const cx=(x+xt)/2; if(ty==='cb'){ rainShaft(g,cx-w*0.35,cx+w*0.25,yb,yg,'rgba(127,160,190,.45)'); cumulus(g,cx,yb,yt+18,w,{seed:21,taper:0.25,bot:'#5E6A76',mid:'#B9C4CD'}); anvil(g,cx,yt,w,Math.min(W*0.42,w*2.2)); bolt(g,cx+w*0.05,yb+6,(yg-yb)*0.7); }
    else { if(ty==='tcu') rainShaft(g,cx-w*0.2,cx+w*0.15,yb,yg,'rgba(127,160,190,.3)'); cumulus(g,cx,yb,yt,w,{seed:13,taper:ty==='tcu'?0.3:0.15}); }
    /* a few smaller neighbours make it read as a sky, not a diagram */
    if(ty!=='cb'){ const k=Math.min(1,(R.top-R.base)/6000); cumulus(g,cx-w*1.15,yb,yb-(yb-yt)*0.35*k-8,w*0.45,{seed:5}); cumulus(g,Math.min(G.ox-30,cx+w*1.1),yb,yb-(yb-yt)*0.25*k-6,w*0.38,{seed:8}); } }
  else if(ty==='st'||ty==='ns'||ty==='as'){ if(S.mode==='front'){ g.save(); g.beginPath(); g.rect(0,yt-4,W,yb-yt+8); g.clip(); const sh=Math.max(W*0.22,(Y(0)-Y(8000))*1.0);
      const col=ty==='ns'?'#6B7682':ty==='as'?'#9FAAB4':'#8C98A3'; const gr=g.createLinearGradient(0,yt,0,yb); gr.addColorStop(0,ty==='ns'?'#97A2AC':'#C3CCD3'); gr.addColorStop(1,col); g.fillStyle=gr; g.beginPath();
      g.moveTo(frontX(R.base),yb); g.lineTo(frontX(R.top),yt); g.lineTo(frontX(R.top)-sh,yt); g.lineTo(frontX(R.base)-sh*0.6,yb); g.closePath(); g.fill(); g.restore();
      if(ty==='ns'){ g.save(); g.globalAlpha=0.9; rainShaft(g,frontX(R.base)-sh*0.6,frontX(R.base)+10,yb,yg,'rgba(127,160,190,.4)'); g.restore(); } }
    else layer(g,W*0.03,G.ox+10,yt-2,yb,ty==='ns'?'#6B7682':'#8C98A3',{top:'#B7C1C9'}); }
  else if(ty==='sc') rolls(g,W*0.02,W*0.98,yt-4,Math.max(yb,yt+12),'#C9D2DA','#7D8995',{seed:4});
  else if(ty==='cap'){ let lo=G.cx-G.hw, hi=G.cx; for(let k=0;k<20;k++){ const m=(lo+hi)/2; if(hill(m)<R.base) lo=m; else hi=m; } const xs=lo, xe=G.cx+G.hw*0.32, top=Math.max(R.top,S.ridge)+900;
    const gr=g.createLinearGradient(0,Y(top),0,yb); gr.addColorStop(0,'#E4EAEF'); gr.addColorStop(1,'#9CA8B3'); g.fillStyle=gr; g.beginPath(); g.moveTo(xs,Y(R.base));
    for(let xx=xs;xx<=xe;xx+=4) g.lineTo(xx,Y(Math.max(R.base,hill(xx)))); g.quadraticCurveTo(G.cx+G.hw*0.12,Y(top),G.cx-G.hw*0.2,Y(top)); g.quadraticCurveTo(xs+(G.cx-xs)*0.3,Y(top-200),xs,Y(R.base)); g.closePath(); g.fill(); } }
/* --- overlay: temperature (x) against height (y, shared with the scene) --- */
const TMIN=-60, TMAX=40;
function ovBuild(){ const {W,H,yg,Y,ox,fs}=G, g=mkCanvas(ovL); if(!S.prof) return;
  const x0=ox, x1=W-8, TX=t=>x0+16+(t-TMIN)/(TMAX-TMIN)*(x1-x0-28);
  g.fillStyle='rgba(9,13,18,.74)'; g.fillRect(x0,0,W-x0,H); g.strokeStyle='rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(x0+0.5,0); g.lineTo(x0+0.5,H); g.stroke();
  g.font=`${Math.round(10*fs)}px ${MONO}`; g.fillStyle='rgba(174,184,193,.75)'; g.textAlign='center';
  for(let t=-60;t<=40;t+=10){ const x=TX(t); g.strokeStyle=t===0?'rgba(127,203,232,.0)':'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(x,Y(HTOP)); g.lineTo(x,yg); g.stroke(); if(t%20===0&&t<40) g.fillText(t+'°',x,yg+14*fs); }
  g.textAlign='start';
  g.setLineDash([5,4]); g.strokeStyle='rgba(127,203,232,.7)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(TX(0),Y(HTOP)); g.lineTo(TX(0),yg); g.stroke(); g.setLineDash([]);
  g.fillStyle='rgba(174,184,193,.8)'; g.textAlign='right'; g.fillText('°C',x1-2,yg+14*fs); g.textAlign='start';
  /* full chart: reference dry and saturated adiabats, and the buoyancy area */
  if(S.full){ g.save(); g.beginPath(); g.rect(x0,Y(HTOP),x1-x0,yg-Y(HTOP)); g.clip(); g.lineWidth=1; g.strokeStyle='rgba(240,180,64,.18)'; for(let t0=-20;t0<=40;t0+=10){ g.beginPath(); g.moveTo(TX(t0),yg); g.lineTo(TX(t0-DALR*30),Y(30000)); g.stroke(); }
    g.strokeStyle='rgba(113,204,147,.22)'; for(let t0=0;t0<=30;t0+=10){ let tp=t0; g.beginPath(); g.moveTo(TX(tp),yg); for(let h=0;h<=34000;h+=500){ tp-=salr(tp,h)*0.5; g.lineTo(TX(tp),Y(h+500)); } g.stroke(); }
    g.restore(); g.font=`${Math.round(10*fs)}px ${MONO}`; g.fillStyle='rgba(240,180,64,.8)'; g.fillText('— '+L(t2('dry adiabats, 3 °C/1000 ft','tørradiabater, 3 °C/1000 ft')),x0+12,yg-44*fs); g.fillStyle='rgba(113,204,147,.85)'; g.fillText('— '+L(t2('saturated adiabats','fuktigadiabater')),x0+12,yg-30*fs); g.fillStyle='rgba(228,107,174,.9)'; g.fillText('■ '+L(t2('parcel warmer: it rises','pakken varmere: den stiger')),x0+12,yg-16*fs);
    for(let i=1;i<=R.nTop;i++){ const p=PAR[i], e=ENV[i]; if(!(p===p)) break; g.fillStyle=p>e?'rgba(228,107,174,.28)':'rgba(127,203,232,.18)'; const ya=Y(i*DZ), yb=Y((i-1)*DZ); g.fillRect(Math.min(TX(p),TX(e)),ya,Math.abs(TX(p)-TX(e)),yb-ya+0.5); } }
  /* environment */
  g.strokeStyle=C.env; g.lineWidth=2.2*fs; g.beginPath(); for(let i=0;i<N;i+=2){ const x=TX(ENV[i]),y=Y(i*DZ); i?g.lineTo(x,y):g.moveTo(x,y); } g.stroke();
  /* parcel dew point (to the base) */
  const lcl=Math.min(R.lcl,R.top); g.setLineDash([5,4]); g.strokeStyle=C.dew; g.lineWidth=1.6*fs; g.beginPath(); g.moveTo(TX(S.td),yg); g.lineTo(TX(S.td-DEWL*lcl/1000),Y(lcl)); g.stroke(); g.setLineDash([]);
  /* parcel */
  g.strokeStyle=C.par; g.lineWidth=2.6*fs; g.beginPath(); for(let i=0;i<=R.nTop;i++){ const p=PAR[i]; if(!(p===p)) break; const x=TX(p),y=Y(i*DZ); i?g.lineTo(x,y):g.moveTo(x,y); } g.stroke();
  /* cloud base marker */
  if(R.cloud){ const y=Y(R.base), x=TX(PAR[Math.round(R.base/DZ)]); g.fillStyle='#fff'; g.beginPath(); g.arc(x,y,4*fs,0,7); g.fill(); }
  /* labels */
  const f=`600 ${Math.round(11*fs)}px ${SANS}`, iE=Math.round(Math.min(R.top+3000,30000)/DZ), iP=Math.max(1,Math.round(Math.min(R.top*0.7,R.top-500)/DZ));
  pillTxt(g,Math.min(x1-4,TX(ENV[iE])+8),Y(iE*DZ),L(t2('air around','luften rundt')),C.dark,C.env,f,TX(ENV[iE])+90>x1?'r':'l');
  if(PAR[iP]===PAR[iP]) pillTxt(g,TX(PAR[iP])-8,Y(iP*DZ),L(t2('parcel','luftpakke')),C.dark,C.par,f,'r');
  if(lcl>1200) pillTxt(g,TX(S.td-DEWL*lcl/2000)-6,Y(lcl/2),L(t2('dew point','duggpunkt')),C.dark,C.dew,f,'r');
  g.font=`600 ${Math.round(11*fs)}px ${SANS}`; g.fillStyle='rgba(230,235,239,.85)'; g.textAlign='right'; g.fillText(L(t2('Temperature profile','Temperaturprofil')),x1-4,18*fs); g.textAlign='start'; }
/* --- the loop: the parcel rises, the cloud grows; afterwards a stream of bubbles --- */
let grow=1, growT0=0, running=false, onScreen=true, lastSee='';
const BUB=4;
function growDur(){ return 1.2+Math.max(R.top,R.base||0)/HTOP*3.2; }
function lift(){ grow=0; growT0=performance.now(); kick(); }
function kick(){ if(!running&&onScreen){ running=true; requestAnimationFrame(tick); } }
function tick(now){ running=false; if(!onScreen||document.hidden) return;
  if(view==='fog'){ if(fPlay){ fStep(now); requestAnimationFrame(tick); running=true; } return; }
  if(view==='types'){ tDraw(); return; }
  if(grow<1) grow=Math.min(1,(now-growT0)/1000/growDur());
  lDraw(now);
  if(!reduced()||grow<1){ running=true; requestAnimationFrame(tick); } }
function hAt(f){ return Math.min(R.top,HTOP)*f; }
function lDraw(now){ const g=CL.ctx, {W,H,yg,Y,fs}=G; if(!W||view!=='lift') return; const d=CL.dpr;
  g.clearRect(0,0,W,H); g.drawImage(bgL,0,0,W,H);
  /* the cloud, revealed below the leading parcel while it grows */
  const e=1-Math.pow(1-grow,2), hl=hAt(e), yl=grow>=1?0:Math.max(0,Y(hl)-4);
  if(R.cloud&&hl>=R.base){ const sy=yl*d; g.drawImage(clL,0,sy,clL.width,clL.height-sy,0,yl,W,H-yl); }
  /* height labels stay readable on top of the cloud and the sun */
  { const step=H<420?10000:5000; g.font=`${Math.round(10*fs)}px ${MONO}`; g.lineWidth=3; g.lineJoin='round'; g.strokeStyle='rgba(14,23,34,.8)'; g.fillStyle='rgba(174,184,193,.85)';
    for(let h=step;h<HTOP;h+=step){ const s=h>=10000?(h/1000)+' 000 ft':h+' ft', y=Y(h)-3; g.strokeText(s,6,y); g.fillText(s,6,y); } }
  /* rain streaks under precipitating cloud */
  const ty=R.type; if(R.cloud&&grow>=1&&(ty==='cb'||ty==='tcu'||ty==='ns')&&!reduced()){ const yb=Y(R.base), x=ty==='ns'&&S.mode==='front'?frontX(R.base)-40:PX[Math.round(R.base/DZ)], w=ty==='cb'?48:ty==='ns'?60:26, t=now/1000;
    g.strokeStyle='rgba(170,200,225,.45)'; g.lineWidth=1; g.beginPath(); for(let k=0;k<22;k++){ const xx=x-w+((k*37)%(w*2)), yy=yb+((t*220+k*53)%Math.max(10,yg-yb)); g.moveTo(xx,yy); g.lineTo(xx-2,yy+7); } g.stroke(); }
  /* parcels */
  const t=now/1000, dur=growDur();
  if(grow<1) bubble(g,hl,1,true);
  else if(!reduced()) for(let k=0;k<BUB;k++){ const f=((t/dur+k/BUB)%1); bubble(g,hAt(f),f>0.85?(1-f)/0.15:1,k===0); }
  else bubble(g,hAt(1),1,true);
  g.drawImage(fgL,0,0,W,H); if(S.prof) g.drawImage(ovL,0,0,W,H);
  /* the leading parcel on the profile */
  if(S.prof){ const f0=grow<1?e:((t/dur)%1), h=reduced()&&grow>=1?R.top:hAt(f0), i=Math.min(R.nTop,Math.round(h/DZ)), p=PAR[i];
    if(p===p){ const x0=G.ox, x1=W-8, x=x0+16+(p-TMIN)/(TMAX-TMIN)*(x1-x0-28), y=Y(i*DZ); g.fillStyle='#fff'; g.strokeStyle=C.par; g.lineWidth=2; g.beginPath(); g.arc(x,y,5*fs,0,7); g.fill(); g.stroke(); } } }
function bubble(g,h,a,lead){ const i=Math.min(N-1,Math.round(h/DZ)), x=PX[i], y=G.Y(h), r=6*G.fs, sat=R.base!=null&&h>=R.base;
  g.globalAlpha=Math.max(0,a); g.fillStyle=sat?'rgba(240,244,247,.95)':'rgba(255,255,255,.18)'; g.strokeStyle=C.par; g.lineWidth=2; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); g.stroke(); g.globalAlpha=1; }
new IntersectionObserver(es=>{ onScreen=es[0].isIntersecting; if(onScreen) kick(); }).observe(el('cvp'));
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) kick(); });

/* --- the numbers and words for the lift view --- */
const STAB={abs:t2('absolutely unstable','absolutt ustabil'),cond:t2('conditionally unstable','betinget ustabil'),stable:t2('stable','stabil')};
const fmtH=h=>h>=HTOP-50?'> FL400':Math.round(h/100)*100+' ft';
function liftOut(){ const spread=S.t-S.td, ty=R.type, sc=R.stab==='stable'?'g':R.stab==='cond'?'a':'r';
  el('rB').innerHTML=R.cloud?`${fmtH(R.base)}<small>(${spread} °C × 400 ft)</small>`:'—';
  el('rT').textContent=R.cloud?fmtH(R.top):'—';
  el('rZ').textContent=R.fz==null?'—':R.fz===0?L(t2('at the surface','ved bakken')):fmtH(R.fz);
  el('rS').textContent=L(STAB[R.stab]); el('rS').className=R.stab==='stable'?'good':R.stab==='cond'?'warn':'bad';
  el('rC').textContent=L(TYPE[ty]); el('rC').className=ty==='cb'?'bad':ty==='tcu'?'warn':'';
  el('rP').textContent=L(precip()); el('rR').textContent=nf(R.salrB,1)+' °C / 1000 ft';
  const gk=T2G[ty]; el('toTypes').hidden=!gk; if(gk) el('toTypes').textContent=L(t2(`See ${gk} in Cloud types →`,`Se ${gk} i Skyslag →`));
  chip('chipL',[[t2('Cloud base','Skybase'),R.cloud?fmtH(R.base):'—'],[t2('Tops','Topper'),R.cloud?fmtH(R.top):'—'],[t2('Freezing level','Frysenivå'),R.fz==null?'—':R.fz===0?'SFC':fmtH(R.fz)],[t2('Stability','Stabilitet'),L(STAB[R.stab]),sc],[t2('Cloud','Sky'),gk?(ty==='tcu'?'TCU':gk):'—',ty==='cb'?'r':ty==='tcu'?'a':'']]);
  if(view!=='lift') return;
  const why=R.stab==='stable'?t2('The air around cools more slowly than the saturated parcel, so a lifted parcel soon ends up colder than its surroundings and stops.','Luften rundt kjøles saktere enn den mettede pakken, så en løftet pakke blir snart kaldere enn omgivelsene og stopper.')
    :R.stab==='cond'?t2('The air around cools faster than saturated air but slower than dry air: dry air would sink back, but once in cloud the parcel stays warmer and keeps rising.','Luften rundt kjøles raskere enn mettet luft, men saktere enn tørr luft: tørr luft ville sunket tilbake, men i sky holder pakken seg varmere og fortsetter å stige.')
    :t2('The air around cools faster than even dry air: every lifted parcel keeps accelerating upwards.','Luften rundt kjøles raskere enn til og med tørr luft: hver løftet pakke fortsetter å akselerere oppover.');
  const what=!R.cloud?(ty==='blue'?t2('<b>Dry thermals:</b> the parcel stops before it reaches its dew point, so there is no cloud to mark the lift.','<b>Tørrtermikk:</b> pakken stopper før den når duggpunktet, så ingen sky markerer løftet.'):t2('<b>No cloud:</b> the lift ends below the condensation level.','<b>Ingen sky:</b> løftet slutter under kondensasjonsnivået.'))
    :t2(`<b>${L(TYPE[ty]).replace(/^./,c=>c.toUpperCase())}:</b> base ${fmtH(R.base)}, tops ${fmtH(R.top)}.`,`<b>${L(TYPE[ty]).replace(/^./,c=>c.toUpperCase())}:</b> base ${fmtH(R.base)}, topper ${fmtH(R.top)}.`);
  see(`${L(what)} ${L(why)}${S.prof?' '+L(t2('<span class="deep">On the profile the parcel (pink) rises while it is to the right of, warmer than, the air around (amber).</span>','<span class="deep">På profilen stiger pakken (rosa) så lenge den ligger til høyre for, er varmere enn, luften rundt (oransje).</span>')):''}`);
  live(); }
function liftUpd(){ compute(); liftOut(); lBuild(); if(view==='lift') lift(); else kick(); }

/* --- controls --- */
const MODES=[['heat','Heating'],['hill','Hills'],['front','Front'],['conv','Convergence']];
const segM=LAB.seg(el('mode'),MODES,S.mode,v=>{ S.mode=v; syncL(); liftUpd(); }); el('mode').classList.add('four');
const sT=LAB.slider(el('ctlL'),{label:'Surface temperature (°C)',min:-10,max:35,step:1,v:S.t,f:v=>v+' °C',on:v=>{ S.t=v; if(S.td>v){ S.td=v; sTd.set(v); } liftUpd(); }});
const sTd=LAB.slider(el('ctlL'),{label:'Dew point (°C)',min:-20,max:30,step:1,v:S.td,f:v=>v+' °C',on:v=>{ if(v>S.t){ v=S.t; sTd.set(v); } S.td=v; liftUpd(); }});
const sE=LAB.slider(el('ctlL'),{label:'Lapse rate of the air around, ELR (°C per 1000 ft)',min:0,max:3.6,step:0.1,v:S.elr,f:v=>nf(v,1)+' °C',on:v=>{ S.elr=v; liftUpd(); }});
const hillBox=document.createElement('div'); el('ctlL').appendChild(hillBox);
const sR=LAB.slider(hillBox,{label:'Height of the hills (ft)',min:1000,max:12000,step:500,v:S.ridge,f:v=>v+' ft',on:v=>{ S.ridge=v; liftUpd(); }});
const sI=LAB.slider(el('ctlInv'),{label:'Inversion height (ft)',min:1000,max:20000,step:500,v:S.invH,f:v=>v+' ft',on:v=>{ S.invH=v; liftUpd(); }});
el('inv').addEventListener('change',e=>{ S.inv=e.target.checked; syncL(); liftUpd(); });
function syncL(){ hillBox.hidden=S.mode!=='hill'; sI.el.hidden=!S.inv; el('inv').checked=S.inv; segM.set(S.mode); sT.set(S.t); sTd.set(S.td); sE.set(S.elr); sR.set(S.ridge); sI.set(S.invH); if(S.inv) el('ctlInv').closest('details').open=true; }
el('tProf').addEventListener('click',()=>{ S.prof=!S.prof; drawTabs(); legend(); lBuild(); liftOut(); kick(); });
el('tFull').addEventListener('click',()=>{ S.full=!S.full; drawTabs(); ovBuild(); kick(); });
el('tGo').addEventListener('click',()=>{ if(view==='fog'){ fToggle(); return; } lift(); });
el('toTypes').addEventListener('click',()=>{ setView('types'); tSel(T2G[R.type]); });
const PREL=[
 ['fair',t2('Fair-weather cumulus','Godværscumulus'),{mode:'heat',t:22,td:10,elr:1.4,inv:false}],
 ['storm',t2('Afternoon thunderstorm','Ettermiddagstordenvær'),{mode:'heat',t:28,td:19,elr:2.5,inv:false}],
 ['lid',t2('Inversion lid','Inversjonslokk'),{mode:'heat',t:24,td:13,elr:2.2,inv:true,invH:6000}],
 ['strat',t2('Warm front: layer cloud','Varmfront: lagskyer'),{mode:'front',t:10,td:8,elr:1.0,inv:false}],
 ['cap',t2('Cap cloud on the hills','Hettesky på terrenget'),{mode:'hill',t:12,td:9,elr:1.2,ridge:5000,inv:false}],
 ['oro',t2('Hills trigger showers','Terreng utløser byger'),{mode:'hill',t:18,td:13,elr:2.4,ridge:6000,inv:false}]];
function drawPreL(){ el('preL').innerHTML=PREL.map(([k,n])=>`<button type="button" class="btn sm" data-p="${k}">${L(n)}</button>`).join(''); }
function preset(k){ const p=PREL.find(x=>x[0]===k); if(!p) return; Object.assign(S,p[2]); syncL(); setView('lift'); liftUpd(); }
el('preL').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) preset(b.dataset.p); });

/* --- View 2 · Cloud types: the ten genera at their typical heights --- */
const GEN=[
 {k:'CI',band:'high',n:t2('Cirrus','Cirrus'),h:t2('High · 20 000–40 000 ft','Høy · 20 000–40 000 ft'),s:t2('Fine white fibres of ice crystals.','Fine, hvite fibre av iskrystaller.'),p:t2('No icing or precipitation to speak of. Thickening cirrus can be the first sign of a warm front; near jet streams expect clear-air turbulence.','Ingen ising eller nedbør av betydning. Cirrus som tykner, kan være første tegn på en varmfront; nær jetstrømmer kan det være klarværsturbulens.')},
 {k:'CC',band:'high',n:t2('Cirrocumulus','Cirrocumulus'),h:t2('High · 20 000–40 000 ft','Høy · 20 000–40 000 ft'),s:t2('Small white ripples or grains, no shading.','Små hvite krusninger eller korn, uten skygge.'),p:t2('Shows instability at high level; light turbulence possible. No icing of note.','Viser ustabilitet høyt oppe; lett turbulens mulig. Ingen ising av betydning.')},
 {k:'CS',band:'high',n:t2('Cirrostratus','Cirrostratus'),h:t2('High · 20 000–40 000 ft','Høy · 20 000–40 000 ft'),s:t2('A thin, milky veil; a halo round the sun or moon.','Et tynt, melkeaktig slør; en halo rundt sol eller måne.'),p:t2('Smooth air and no icing, but a classic sign of an approaching warm front: lower cloud and rain may follow within 12–24 hours.','Rolig luft og ingen ising, men et klassisk tegn på en varmfront som nærmer seg: lavere skyer og regn kan følge innen 12–24 timer.')},
 {k:'AC',band:'mid',n:t2('Altocumulus','Altocumulus'),h:t2('Middle · 6500–20 000 ft','Middels · 6500–20 000 ft'),s:t2('Rolls or patches with shaded undersides.','Ruller eller flak med skyggede undersider.'),p:t2('Light turbulence and light to moderate icing in supercooled droplets. Towers (AC castellanus) on a summer morning warn of thunderstorms later.','Lett turbulens og lett til moderat ising i underkjølte dråper. Tårn (AC castellanus) en sommermorgen varsler tordenvær senere.')},
 {k:'AS',band:'mid',n:t2('Altostratus','Altostratus'),h:t2('Middle · 6500–20 000 ft','Middels · 6500–20 000 ft'),s:t2('A grey sheet; the sun as through ground glass.','Et grått lag; solen som gjennom matt glass.'),p:t2('Little turbulence, but moderate icing possible and light continuous rain or snow. Usually ahead of a warm front, lowering into NS.','Lite turbulens, men moderat ising mulig og lett vedvarende regn eller snø. Vanligvis foran en varmfront, og senker seg til NS.')},
 {k:'NS',band:'low',n:t2('Nimbostratus','Nimbostratus'),h:t2('Low base (often below 3000 ft), tops to 15 000 ft and more','Lav base (ofte under 3000 ft), topper til 15 000 ft og mer'),s:t2('A thick, dark grey layer with continuous rain or snow.','Et tykt, mørkegrått lag med vedvarende regn eller snø.'),p:t2('Low ceilings and poor visibility for hours, moderate to severe icing above the freezing level. Smooth air unless CBs are embedded.','Lavt skydekke og dårlig sikt i timevis, moderat til kraftig ising over frysenivået. Rolig luft om ikke CB-er er innleiret.')},
 {k:'SC',band:'low',n:t2('Stratocumulus','Stratocumulus'),h:t2('Low · base 1500–6500 ft','Lav · base 1500–6500 ft'),s:t2('Grey rolls or patches, often in a layer under an inversion.','Grå ruller eller flak, ofte i et lag under en inversjon.'),p:t2('Light turbulence below and in the cloud, light icing in winter, sometimes drizzle. Usually smooth on top.','Lett turbulens under og i skyen, lett ising om vinteren, noen ganger yr. Vanligvis rolig på toppen.')},
 {k:'ST',band:'low',n:t2('Stratus','Stratus'),h:t2('Low · surface–1500 ft','Lav · bakken–1500 ft'),s:t2('A uniform grey layer, often lifted fog; hides hill tops.','Et jevnt grått lag, ofte løftet tåke; skjuler fjelltopper.'),p:t2('Very low ceilings, drizzle and poor visibility; hill fog where it meets high ground. Light icing below 0 °C.','Svært lavt skydekke, yr og dårlig sikt; fjelltåke der det treffer høyt terreng. Lett ising under 0 °C.')},
 {k:'CU',band:'low',n:t2('Cumulus (and TCU)','Cumulus (og TCU)'),h:t2('Low base · 1500–6500 ft, about (T − Td) × 400 ft','Lav base · 1500–6500 ft, rundt (T − Td) × 400 ft'),s:t2('Heaped cloud with a flat base and cauliflower tops.','Haugsky med flat base og blomkålformede topper.'),p:t2('Bumpy below and in the cloud, icing in the tops. When it grows tall it is reported as TCU: showers, moderate to severe turbulence and icing.','Humpete under og i skyen, ising i toppene. Når den vokser høy, rapporteres den som TCU: byger, moderat til kraftig turbulens og ising.')},
 {k:'CB',band:'low',n:t2('Cumulonimbus','Cumulonimbus'),h:t2('Low base · 1000–5000 ft, tops 30 000–45 000 ft','Lav base · 1000–5000 ft, topper 30 000–45 000 ft'),s:t2('A towering thundercloud with an anvil at the top.','En tårnende tordensky med en ambolt på toppen.'),p:t2('Severe turbulence and icing, hail, lightning, heavy showers, wind shear and microbursts. Never penetrate: avoid by about 20 NM.','Kraftig turbulens og ising, hagl, lyn, kraftige byger, vindskjær og mikroburst. Fly aldri gjennom: hold rundt 20 NM avstand.')}];
let tSelK=null, tHover=null; const TB={};          /* hit boxes, px */
const bgT=document.createElement('canvas');
function tBuild(){ const {W,H,yg,Y,fs}=geo(), g=mkCanvas(bgT); sky(g,W,H,yg);
  /* the three height bands */
  const band=(h0,h1,col,txt)=>{ g.fillStyle=col; g.fillRect(0,Y(h1),4,Y(h0)-Y(h1)); if(W<640) return; g.font=`500 ${Math.round(10*fs)}px ${MONO}`; g.fillStyle='rgba(206,214,221,.7)'; g.textAlign='right'; g.fillText(txt,W-10,Y(h1)+14*fs); g.textAlign='start'; };
  g.strokeStyle='rgba(255,255,255,.12)'; g.setLineDash([4,6]); g.lineWidth=1; for(const h of [6500,20000]){ g.beginPath(); g.moveTo(0,Y(h)); g.lineTo(W,Y(h)); g.stroke(); } g.setLineDash([]);
  band(20000,HTOP,'rgba(214,165,94,.6)',L(t2('HIGH · above 20 000 ft','HØYE · over 20 000 ft'))); band(6500,20000,'rgba(127,203,232,.5)',L(t2('MIDDLE · 6500–20 000 ft','MIDDELS · 6500–20 000 ft'))); band(0,6500,'rgba(113,204,147,.5)',L(t2('LOW · surface–6500 ft','LAVE · bakken–6500 ft')));
  const gg=g.createLinearGradient(0,yg,0,H); gg.addColorStop(0,'#4A4A3C'); gg.addColorStop(1,'#2E2E25'); g.fillStyle=gg; g.fillRect(0,yg,W,H-yg);
  g.fillStyle='#4A4A3C'; g.beginPath(); g.moveTo(W*0.6,yg); g.quadraticCurveTo(W*0.69,Y(1900),W*0.78,yg); g.closePath(); g.fill();
  const box=(k,x0,y0,x1,y1)=>{ TB[k]=[x0,y0,x1,y1]; };
  const nar=W<640, X=f=>W*f;
  const veil=(x0,x1,yc,hh,a)=>{ for(let i=0;i<6;i++){ g.fillStyle=`rgba(225,233,240,${a})`; g.beginPath(); g.ellipse((x0+x1)/2,yc,(x1-x0)/2*(1-i*0.12),hh*(1-i*0.12),0,0,7); g.fill(); } };
  /* CB */
  { const cx=X(nar?0.14:0.13), w=X(nar?0.15:0.15), yb=Y(3000), yt=Y(37000); rainShaft(g,cx-w*0.35,cx+w*0.25,yb,yg,'rgba(127,160,190,.45)'); cumulus(g,cx,yb,yt+16,w,{seed:21,taper:0.3,bot:'#5E6A76',mid:'#B9C4CD'}); anvil(g,cx,yt,w,X(nar?0.2:0.17)); bolt(g,cx,yb+5,(yg-yb)*0.7); box('CB',cx-w*0.62,yt-8,cx+X(nar?0.2:0.17),yg); }
  /* NS: a thick dark layer, ragged base, rain */
  { const x0=X(nar?0.34:0.29), x1=X(nar?0.5:0.42), yb=Y(1800), yt=Y(14000); rainShaft(g,x0+8,x1-6,yb,yg,'rgba(127,160,190,.38)'); layer(g,x0,x1,yt+8,yb,'#5F6A75',{top:'#97A2AC',lump:3,ragged:4,seed:2}); rolls(g,x0,x1-10,yt-6,yt+14,'#A9B4BE','#7D8995',{seed:3,step:14}); box('NS',x0,yt-8,x1,yg); }
  /* CU */
  { const cx=X(nar?0.6:0.5), w=X(nar?0.14:0.085); cumulus(g,cx,Y(3500),Y(9500),w,{seed:13,taper:0.18}); cumulus(g,cx+w*1.05,Y(3500),Y(5600),w*0.45,{seed:5}); box('CU',cx-w*0.7,Y(9500)-14,cx+w*1.3,Y(3500)+4); }
  /* SC */
  { const x0=X(nar?0.78:0.8), x1=X(0.98); rolls(g,x0,x1,Y(3900),Y(2500),'#C9D2DA','#7D8995',{seed:4,step:nar?14:20}); box('SC',x0,Y(4100)-6,x1,Y(2500)+4); }
  /* ST, hiding the hill top */
  { const x0=X(0.58), x1=X(0.8); layer(g,x0,x1,Y(1500),Y(500),'rgba(150,162,173,.92)',{top:'rgba(188,198,206,.92)',seed:6,ragged:3}); box('ST',x0,Y(1500)-6,x1,Y(0)); }
  /* AC: patches with shaded undersides */
  { const x0=X(nar?0.5:0.6), x1=X(nar?0.74:0.77), ya=nar?16000:13800, yb2=nar?14500:12200; rolls(g,x0,x1,Y(ya),Y(yb2),'#DCE3E9','#8E9BA7',{seed:12,gap:true,step:nar?11:15}); box('AC',x0,Y(ya+300),x1,Y(yb2-200)); }
  /* AS: a grey sheet, the sun as through ground glass */
  { const x0=X(nar?0.8:0.8), x1=X(0.985), yb=Y(10500), yt=Y(16500); g.fillStyle='rgba(242,232,190,.45)'; g.beginPath(); g.arc((x0+x1)/2,(yb+yt)/2,8,0,7); g.fill(); veil(x0,x1,(yb+yt)/2,(yb-yt)/2,0.2); box('AS',x0,yt-4,x1,yb+4); }
  /* CI wisps, CC ripples, CS veil with a halo */
  { const x=X(nar?0.36:0.4), y=Y(31000); wisps(g,x,y,X(nar?0.14:0.11),{seed:9}); wisps(g,x+X(0.06),y+18,X(0.07),{seed:15}); box('CI',x-6,y-30,x+X(nar?0.16:0.18),y+30); }
  { const x=X(nar?0.6:0.62), y=Y(26500); ripples(g,x,y,X(nar?0.14:0.1),22); box('CC',x-4,y-6,x+X(nar?0.14:0.1)+8,y+22); }
  { const x0=X(nar?0.78:0.8), x1=X(0.985), y=Y(31500), cx=(x0+x1)/2; veil(x0,x1,y,16,0.07); g.strokeStyle='rgba(242,232,190,.55)'; g.lineWidth=1.2; g.beginPath(); g.arc(cx,y,17,0,7); g.stroke(); g.fillStyle='rgba(242,232,190,.9)'; g.beginPath(); g.arc(cx,y,4,0,7); g.fill(); box('CS',x0,y-22,x1,y+22); }
  /* abbreviation tags */
  for(const ge of GEN){ const b=TB[ge.k]; const x=(b[0]+b[2])/2, y=Math.max(14,b[1]-8); pillTxt(g,x,y,ge.k,'#10171D','rgba(230,235,239,.92)',`600 ${Math.round(10.5*fs)}px ${MONO}`,'c'); }
  tDraw(); }
function tDraw(){ const g=CL.ctx, {W,H,fs}=G; if(!W||view!=='types') return; g.clearRect(0,0,W,H); g.drawImage(bgT,0,0,W,H);
  const mine=T2G[R.type];
  const ring=(k,col,lw,dash)=>{ const b=TB[k]; if(!b) return; g.strokeStyle=col; g.lineWidth=lw; g.setLineDash(dash); g.beginPath(); g.roundRect?g.roundRect(b[0]-4,b[1]-4,b[2]-b[0]+8,b[3]-b[1]+8,6):g.rect(b[0]-4,b[1]-4,b[2]-b[0]+8,b[3]-b[1]+8); g.stroke(); g.setLineDash([]); };
  if(mine){ ring(mine,'rgba(228,107,174,.9)',1.6,[5,4]); const b=TB[mine]; pillTxt(g,b[0]-2,b[3]+14>H-6?b[1]-24:b[3]+14,L(t2('your scenario','ditt scenario')),'#10171D',C.par,`600 ${Math.round(10*fs)}px ${SANS}`); }
  if(tHover&&tHover!==tSelK) ring(tHover,'rgba(230,235,239,.45)',1.2,[]);
  if(tSelK) ring(tSelK,'rgba(255,255,255,.95)',2,[]); }
function tCard(k){ const c=el('tcard'); const ge=GEN.find(x=>x.k===k); if(!ge){ c.hidden=true; return; }
  c.hidden=false; c.innerHTML=`<button type="button" class="tx" aria-label="${L(t2('Close','Lukk'))}">×</button><div class="th"><b>${ge.k}</b><span>${L(ge.n)}</span></div><div class="tb">${L(ge.h)}</div><dl><dt>${L(t2('Looks like','Ser ut som'))}</dt><dd>${L(ge.s)}</dd><dt>${L(t2('For the pilot','For piloten'))}</dt><dd>${L(ge.p)}</dd></dl>`; }
function tSel(k){ tSelK=k||null; tCard(tSelK); drawGlist(); tDraw();
  if(view==='types') see(tSelK?`<b>${tSelK}, ${L(GEN.find(x=>x.k===tSelK).n)}.</b> ${L(GEN.find(x=>x.k===tSelK).s)}`:L(t2('<b>The ten cloud types</b> at their typical heights: low, middle and high. Tap a cloud (or pick it in the panel) for what it means for the flight. The ringed one is what your parcel scenario makes.','<b>De ti skyslagene</b> i sine typiske høyder: lave, middels og høye. Trykk på en sky (eller velg den i panelet) for hva den betyr for flygingen. Den med ring er den ditt luftpakkescenario lager.'))); }
el('tcard').addEventListener('click',e=>{ if(e.target.closest('.tx')) tSel(null); });
function hitT(e){ const r=el('cvL').getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top; let best=null, ba=1e9;
  for(const k in TB){ const b=TB[k]; if(x>=b[0]-4&&x<=b[2]+4&&y>=b[1]-4&&y<=b[3]+4){ const a=(b[2]-b[0])*(b[3]-b[1]); if(a<ba){ ba=a; best=k; } } } return best; }
el('cvL').addEventListener('click',e=>{ if(view!=='types') return; const k=hitT(e); tSel(k===tSelK?null:k); });
el('cvL').addEventListener('pointermove',e=>{ if(view!=='types'||e.pointerType!=='mouse') return; const k=hitT(e); if(k!==tHover){ tHover=k; tDraw(); } });
el('cvL').addEventListener('pointerleave',()=>{ if(tHover){ tHover=null; tDraw(); } });
function drawGlist(){ const mine=T2G[R.type], grp=[['high',t2('High','Høye')],['mid',t2('Middle','Middels')],['low',t2('Low (and through the layers)','Lave (og gjennom lagene)')]];
  el('glist').innerHTML=grp.map(([b,n])=>`<div class="gh">${L(n)}</div><div class="gb">${GEN.filter(x=>x.band===b).map(x=>`<button type="button" data-k="${x.k}" class="${x.k===tSelK?'on':''}${x.k===mine?' me':''}" title="${L(x.n)}"><b>${x.k}</b>${L(x.n).replace(/ \(.*\)$/,'')}</button>`).join('')}</div>`).join('');
  el('gNote').innerHTML=mine?L(t2(`Your parcel scenario makes <b>${mine}</b> (underlined). Change it under Lift a parcel and come back.`,`Luftpakkescenariet ditt lager <b>${mine}</b> (understreket). Endre det under Løft en luftpakke og kom tilbake.`)):L(t2('Your parcel scenario makes no cloud right now.','Luftpakkescenariet ditt lager ingen sky nå.')); }
el('glist').addEventListener('click',e=>{ const b=e.target.closest('button[data-k]'); if(b) tSel(b.dataset.k===tSelK?null:b.dataset.k); });

/* =====================================================================
   View 3 · Fog: radiation (a night at an aerodrome) or advection (moist air over a cold sea)
   ===================================================================== */
const F={type:'rad',t:12,td:8,wind:4,sky:'clear',time:24,at:14,atd:11,sst:8,aw:10};
let fPlay=false, fLast=0;
const CF=LAB.fit(el('cvF'),()=>{ fBuild(); fDraw(); },2);
const NT=109; const FT=new Float32Array(NT), FTD=new Float32Array(NT), FDEP=new Float32Array(NT), FVIS=new Float32Array(NT), FWX=new Uint8Array(NT);   /* 18:00 → 12:00 in 10-minute steps */
const WXC=['','BR','MIFG','FG','BKN ST'];
const FR={on:-1,off:-1,minS:99};
function night(){ const cf={clear:1,part:0.55,ovc:0.18}[F.sky], w=F.wind, wf=w<=1?1:w<=7?0.85:w<=10?0.65:0.5;
  let t=F.t, td=F.td, dep=0, age=0, wx=0; FR.on=-1; FR.off=-1; FR.minS=99;
  for(let i=0;i<NT;i++){ const hr=18+i/6;
    if(i>0){ if(hr<=31){ const rate=1.6*cf*wf*Math.exp(-(hr-18)/7); t-=rate/6*(t-td<=0.05?0.45:1); }
      else { const sun={clear:1.5,part:1.0,ovc:0.35}[F.sky]*Math.min(1,(hr-31)/1.5); t+=sun/6*(dep>0?Math.max(0.3,1-dep/900):1); td+=0.05/6; } }
    if(td>t) td=t; const sp=t-td; if(sp<FR.minS) FR.minS=sp;
    if(sp<=0.05){ if(w>8){ wx=4; dep=0; } else if(w<=1){ wx=2; dep=Math.min(60,dep+4); } else { wx=3; dep=Math.min(300+(w-2)*60,dep+25); } age+=1/6; if(FR.on<0) FR.on=i; }
    else if(wx>=2&&sp<1.2){ wx=dep>150?4:1; dep=Math.max(0,dep-30); }
    else { if(FR.on>=0&&FR.off<0&&wx!==0&&sp>=1.2) FR.off=i; wx=sp<=1?1:0; dep=Math.max(0,dep-40); age=0; }
    FT[i]=t; FTD[i]=td; FDEP[i]=wx===3||wx===2?dep:0; FWX[i]=wx;
    FVIS[i]=wx===3?Math.max(150,900*Math.exp(-age/1.1)):wx===2?2000:wx===4?(w>8?5000:3000):sp<=1?3500:sp<=2.5?7000:10000; } }
const ADV={xf:-1,coast:0,wx:0,vis:10000,lam:1};
const NA=101, AT=new Float32Array(NA), ATD=new Float32Array(NA);  /* 0–400 km of sea */
function advect(){ const lam=Math.max(15,F.aw*1.852*5); ADV.lam=lam; ADV.xf=-1;
  for(let i=0;i<NA;i++){ const x=i*4, t=F.sst+(F.at-F.sst)*Math.exp(-x/lam); AT[i]=t; ATD[i]=Math.min(F.atd,t); if(ADV.xf<0&&t<=F.atd+0.01) ADV.xf=x; }
  ADV.wx=ADV.xf<0?(AT[NA-1]-F.atd<=1?1:0):F.aw>18?4:3; ADV.vis=ADV.wx===3?200:ADV.wx===4?3000:ADV.wx===1?4000:10000; }
const fmtT=hr=>{ const h=((Math.floor(hr)%24)+24)%24, m=Math.round((hr%1)*60); return String(h).padStart(2,'0')+':'+String(m===60?59:m).padStart(2,'0'); };
const fmtV=v=>v>=10000?'10 km+':v>=5000?Math.round(v/1000)+' km':Math.round(v/50)*50+' m';
const bgF=document.createElement('canvas'), stF=document.createElement('canvas');
let FG={};
let skyN=null, skyD=null, fogGr=null;
function fGeo(){ const W=CF.w,H=CF.h, sh=Math.round(H*0.6), gy=sh-Math.max(18,H*0.05); FG={W,H,sh,gy,fs:isIns()?1.2:(W<480?0.88:1),cy0:sh+20,cy1:H-24,cx0:44,cx1:W-14}; return FG; }
function fCanvas(cv){ const d=CF.dpr; cv.width=Math.max(1,Math.round(FG.W*d)); cv.height=Math.max(1,Math.round(FG.H*d)); const g=cv.getContext('2d'); g.setTransform(d,0,0,d,0,0); g.clearRect(0,0,FG.W,FG.H); return g; }
function fBuild(){ if(!CF.w) return; fGeo(); const {W,H,sh,gy,fs}=FG, g=fCanvas(bgF), c=CF.ctx;
  skyN=c.createLinearGradient(0,0,0,gy); skyN.addColorStop(0,'#070C14'); skyN.addColorStop(1,'#1A2638');
  skyD=c.createLinearGradient(0,0,0,gy); skyD.addColorStop(0,'#2C4864'); skyD.addColorStop(0.75,'#7E8FA0'); skyD.addColorStop(1,'#D8A878');
  fogGr=c.createLinearGradient(0,0,0,1); fogGr.addColorStop(0,'rgba(221,229,236,0)'); fogGr.addColorStop(0.35,'rgba(221,229,236,.7)'); fogGr.addColorStop(1,'rgba(221,229,236,.92)');
  if(F.type==='rad'){ /* ground, runway, tower, trees: the foreground over which the fog lies */
    g.fillStyle='#2E3328'; g.fillRect(0,gy,W,sh-gy); g.fillStyle='#3A3F35'; g.fillRect(0,gy,W,3);
    g.fillStyle='#55595A'; g.fillRect(W*0.06,gy+5,W*0.88,4);
    g.fillStyle='#3B4148'; g.fillRect(W*0.78,gy-46*fs,10*fs,46*fs); g.fillRect(W*0.78-5*fs,gy-56*fs,20*fs,11*fs);
    for(let i=0;i<9;i++){ const x=W*(0.02+i*0.025), r=(7+((i*7)%5))*fs; g.fillStyle='#1E2A22'; g.beginPath(); g.ellipse(x,gy-r,r*0.7,r,0,0,7); g.fill(); }
    g.font=`${Math.round(10*fs)}px ${MONO}`; g.fillStyle='rgba(174,184,193,.7)'; for(const h of [200,500,1000]){ const y=gy-h/1100*(gy-24); g.fillText(h+' ft',W-48,y-2); g.strokeStyle='rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke(); } }
  else { /* sea, coast and the aerodrome */
    const cxp=W*0.8; const sg=g.createLinearGradient(0,0,cxp,0); sg.addColorStop(0,'#24557C'); sg.addColorStop(1,F.sst<8?'#2A5E78':'#1F4E6E'); g.fillStyle=sg; g.fillRect(0,gy,cxp,sh-gy);
    g.fillStyle='#3E4036'; g.fillRect(cxp,gy-4,W-cxp,sh-gy+4); g.fillStyle='#55595A'; g.fillRect(cxp+10,gy-2,W-cxp-20,3);
    g.fillStyle='#3B4148'; g.fillRect(W*0.9,gy-34*fs,8*fs,30*fs); }
  fStrip(); }
function fStrip(){ const {W,H,cy0,cy1,cx0,cx1,fs}=FG, g=fCanvas(stF);
  g.fillStyle='rgba(9,13,18,.55)'; g.fillRect(0,FG.sh,W,H-FG.sh); g.strokeStyle='rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(0,FG.sh+0.5); g.lineTo(W,FG.sh+0.5); g.stroke();
  const rad=F.type==='rad', n=rad?NT:NA, A=rad?FT:AT, B=rad?FTD:ATD;
  let lo=1e9, hi=-1e9; for(let i=0;i<n;i++){ lo=Math.min(lo,A[i],B[i]); hi=Math.max(hi,A[i],B[i]); } if(!rad){ lo=Math.min(lo,F.sst); hi=Math.max(hi,F.sst); } lo=Math.floor(lo-1); hi=Math.ceil(hi+1);
  const X=i=>cx0+(cx1-cx0)*i/(n-1), Yt=t=>cy1-(t-lo)/(hi-lo)*(cy1-cy0); FG.X=X; FG.Yt=Yt; FG.n=n;
  g.font=`${Math.round(10*fs)}px ${MONO}`; g.fillStyle='rgba(174,184,193,.75)';
  const stp=Math.max(1,Math.round((hi-lo)/4)); for(let t=lo;t<=hi;t+=stp){ const y=Yt(t); g.strokeStyle='rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(cx0,y); g.lineTo(cx1,y); g.stroke(); g.fillText(t+'°',6,y+3); }
  if(rad){ for(let hr=18;hr<=36;hr+=3){ const x=X((hr-18)*6); g.fillText(fmtT(hr),x-15,H-8); }
    g.fillStyle='rgba(255,255,255,.04)'; g.fillRect(X(0),cy0,X(13*6)-X(0),cy1-cy0); g.fillStyle='rgba(242,193,78,.8)'; g.fillText(L(t2('sunrise','soloppgang')),X(13*6)+4,cy0+10);
    for(let i=0;i<n;){ const w=FWX[i]; if(w<2){ i++; continue; } let j=i; while(j<n&&FWX[j]===w) j++; g.fillStyle=w===4?'rgba(160,172,184,.22)':'rgba(221,229,236,.22)'; g.fillRect(X(i),cy0,X(j-1)-X(i),cy1-cy0); i=j; } }
  else { for(let km=0;km<=400;km+=100){ const x=X(km/4); g.fillText(km?(400-km)+' km':L(t2('400 km offshore','400 km ute')),km?x-20:x,H-8); } g.fillText(L(t2('coast','kyst')),X(NA-1)-30,H-8);
    if(ADV.xf>=0){ g.fillStyle='rgba(221,229,236,.2)'; g.fillRect(X(ADV.xf/4),cy0,X(NA-1)-X(ADV.xf/4),cy1-cy0); }
    g.strokeStyle=C.fz; g.lineWidth=1.6; g.beginPath(); g.moveTo(cx0,Yt(F.sst)); g.lineTo(cx1,Yt(F.sst)); g.stroke(); }
  g.strokeStyle=C.env; g.lineWidth=2.2*fs; g.beginPath(); for(let i=0;i<n;i++){ i?g.lineTo(X(i),Yt(A[i])):g.moveTo(X(i),Yt(A[i])); } g.stroke();
  g.setLineDash([5,4]); g.strokeStyle=C.dew; g.lineWidth=1.8*fs; g.beginPath(); for(let i=0;i<n;i++){ i?g.lineTo(X(i),Yt(B[i])):g.moveTo(X(i),Yt(B[i])); } g.stroke(); g.setLineDash([]); }
function fDraw(){ const g=CF.ctx, {W,H,sh,gy,fs}=FG; if(!W||view!=='fog') return; g.clearRect(0,0,W,H);
  if(F.type==='rad'){ const i=Math.max(0,Math.min(NT-1,Math.round((F.time-18)*6))), hr=F.time, dawn=hr<30?0:hr>32?1:(hr-30)/2, dusk=hr<19?1-(hr-18):0, day=Math.max(dawn,dusk);
    g.fillStyle=skyN; g.fillRect(0,0,W,gy); if(day>0){ g.globalAlpha=day; g.fillStyle=skyD; g.fillRect(0,0,W,gy); g.globalAlpha=1; }
    if(F.sky==='clear'&&day<0.8){ g.fillStyle=`rgba(230,235,239,${0.7*(1-day)})`; for(let k=0;k<40;k++){ const x=(k*97.3)%W, y=(k*53.7)%(gy*0.7); g.fillRect(x,y,1.4,1.4); } }
    if(F.sky!=='clear'){ g.fillStyle=F.sky==='ovc'?'rgba(120,132,144,.9)':'rgba(140,152,164,.7)'; if(F.sky==='ovc') g.fillRect(0,0,W,gy*0.22); else for(let k=0;k<5;k++){ g.beginPath(); g.ellipse(W*(0.1+k*0.2),gy*0.12+(k%2)*10,W*0.07,9,0,0,7); g.fill(); } }
    g.drawImage(bgF,0,0,W,H);
    /* runway and approach lights fade with the visibility */
    const vis=FVIS[i]; for(let k=0;k<12;k++){ const x=W*0.08+k*W*0.072, dist=Math.abs(x-W*0.5)/W*3000+150, a=Math.max(0.08,Math.min(1,vis/dist-0.15)); g.fillStyle=`rgba(255,226,150,${a})`; g.beginPath(); g.arc(x,gy+7,2.2*fs,0,7); g.fill(); }
    /* windsock */
    const wa=Math.min(1,F.wind/15); g.strokeStyle='#C9D3DB'; g.lineWidth=1.5; g.beginPath(); g.moveTo(W*0.7,gy); g.lineTo(W*0.7,gy-28*fs); g.stroke(); g.fillStyle='#E07A3C'; g.beginPath(); g.moveTo(W*0.7,gy-28*fs); g.lineTo(W*0.7+18*fs*(0.3+0.7*wa),gy-28*fs+12*fs*(1-wa)); g.lineTo(W*0.7+16*fs*(0.3+0.7*wa),gy-28*fs+14*fs*(1-wa)+4); g.lineTo(W*0.7,gy-21*fs); g.closePath(); g.fill();
    /* the fog layer or stratus */
    const wx=FWX[i], dep=FDEP[i]; const y1=ft=>gy-ft/1100*(gy-24);
    if(wx===3||wx===2){ const top=y1(Math.max(20,dep)); g.save(); g.translate(0,top-12); g.scale(1,gy+8-top+12); g.fillStyle=fogGr; g.fillRect(0,0,W,1); g.restore(); }
    else if(wx===1){ g.fillStyle='rgba(221,229,236,.18)'; g.fillRect(0,y1(400),W,gy-y1(400)); }
    else if(wx===4){ const yb=y1(F.wind>8?500:250), yt=y1(F.wind>8?1000:600); g.fillStyle='rgba(160,172,184,.85)'; g.fillRect(0,yt,W,yb-yt); }
    g.drawImage(stF,0,0,W,H);
    const x=FG.X(i); g.strokeStyle='rgba(255,255,255,.75)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(x,FG.cy0); g.lineTo(x,FG.cy1); g.stroke(); g.fillStyle=C.env; g.beginPath(); g.arc(x,FG.Yt(FT[i]),4,0,7); g.fill(); g.fillStyle=C.dew; g.beginPath(); g.arc(x,FG.Yt(FTD[i]),3.5,0,7); g.fill(); }
  else { g.fillStyle=skyD; g.fillRect(0,0,W,gy); g.drawImage(bgF,0,0,W,H);
    const cxp=W*0.8, sx=W*0.0;
    /* air arriving from the left, cooling over the sea */
    g.strokeStyle='rgba(228,107,174,.7)'; g.lineWidth=2; g.beginPath(); g.moveTo(W*0.03,gy-60); g.lineTo(W*0.2,gy-60); g.stroke(); g.fillStyle='rgba(228,107,174,.85)'; g.beginPath(); g.moveTo(W*0.2+8,gy-60); g.lineTo(W*0.2,gy-64); g.lineTo(W*0.2,gy-56); g.closePath(); g.fill();
    g.font=`600 ${Math.round(11*fs)}px ${SANS}`; g.fillStyle='#E6EBEF'; g.fillText(L(t2('warm, moist air','varm, fuktig luft'))+' '+F.at+'/'+F.atd+' °C',W*0.03,gy-70);
    g.fillStyle='#BFD7EA'; g.fillText(L(t2('sea ','sjø '))+F.sst+' °C',W*0.03,gy+16);
    if(ADV.wx===3||ADV.wx===4){ const x0=sx+(cxp-sx)*ADV.xf/400, y1=ft=>gy-ft/1600*(gy-24);
      if(ADV.wx===3){ g.fillStyle='rgba(221,229,236,.85)'; g.beginPath(); g.moveTo(x0,gy); for(let x=x0;x<=Math.min(W,cxp+W*0.06);x+=8){ const d=Math.min(1200,150+(x-x0)/(cxp-sx)*400*3); g.lineTo(x,y1(d)+Math.sin(x*0.05)*3); } g.lineTo(Math.min(W,cxp+W*0.06),gy); g.closePath(); g.fill(); }
      else { g.fillStyle='rgba(160,172,184,.85)'; g.fillRect(x0,y1(900),W-x0,y1(350)-y1(900)); } }
    g.drawImage(stF,0,0,W,H); } }
function fOut(){ if(F.type==='rad'){ const i=Math.max(0,Math.min(NT-1,Math.round((F.time-18)*6))), wx=FWX[i], sp=Math.max(0,FT[i]-FTD[i]);
    chip('chipF',[[t2('Time','Tid'),fmtT(F.time)],['T / Td',nf(FT[i],1)+' / '+nf(FTD[i],1)+' °C'],[t2('Spread','Spredning'),nf(sp,1)+' °C',sp<=1?'a':''],[t2('Visibility','Sikt'),fmtV(FVIS[i]),FVIS[i]<1000?'r':FVIS[i]<5000?'a':''],[t2('Weather','Vær'),WXC[wx]||'—',wx===3?'r':wx?'a':'']]);
    const on=FR.on>=0?fmtT(18+FR.on/6):null, off=FR.off>=0?fmtT(18+FR.off/6):null, kind=FR.on>=0?FWX[FR.on]:0;
    el('roF').innerHTML=[[t2('Fog or low cloud forms','Tåke eller lave skyer dannes'),on||L(t2('no','nei'))],[t2('Type','Type'),kind===3?L(t2('radiation fog (FG)','strålingståke (FG)')):kind===2?L(t2('shallow fog (MIFG)','grunn tåke (MIFG)')):kind===4?L(t2('low stratus (wind too strong for fog)','lav stratus (for mye vind for tåke)')):'—'],[t2('Lifts or clears','Letter eller forsvinner'),FR.on<0?'—':off||L(t2('not before noon','ikke før middag'))],[t2('Smallest spread overnight','Minste spredning i natt'),nf(Math.max(0,FR.minS),1)+' °C']].map(([k,v])=>`<div class="rrow"><span>${L(k)}</span><b>${v}</b></div>`).join('');
    if(view==='fog') see(FR.on<0?L(t2('<b>No fog tonight:</b> the temperature never reaches the dew point. Fog needs a small spread at dusk, a clear sky so the ground can lose heat, and light wind.','<b>Ingen tåke i natt:</b> temperaturen når aldri duggpunktet. Tåke krever liten spredning ved skumring, klar himmel så bakken kan miste varme, og svak vind.'))
      :kind===4?L(t2('<b>Too much wind for fog:</b> the wind mixes the cooling through a deeper layer, so the cloud forms higher up as low stratus. The ceiling can still be below your minima.','<b>For mye vind for tåke:</b> vinden blander avkjølingen gjennom et dypere lag, så skyen dannes høyere opp som lav stratus. Skydekket kan likevel være under minima.'))
      :kind===2?L(t2('<b>Calm: only a thin layer cools.</b> Shallow ground fog: you may see the runway from above, then lose it on short final.','<b>Vindstille: bare et tynt lag kjøles.</b> Grunn bakketåke: du kan se banen ovenfra, og miste den på kort finale.'))
      :L(t2('<b>Radiation fog:</b> the clear sky lets the ground lose heat, the air next to it cools to its dew point, and a light wind (2–7 kt) mixes it a few hundred feet deep. It is often thickest just after sunrise and clears as the sun warms the ground.','<b>Strålingståke:</b> den klare himmelen lar bakken miste varme, luften nærmest kjøles til duggpunktet, og svak vind (2–7 kt) blander den noen hundre fot opp. Den er ofte tykkest like etter soloppgang og letter når solen varmer bakken.'))); }
  else { chip('chipF',[[t2('Fog starts','Tåken starter'),ADV.xf<0?'—':Math.round(400-ADV.xf)+' km '+L(t2('offshore','ute'))],[t2('At the coast','Ved kysten'),fmtV(ADV.vis),ADV.vis<1000?'r':ADV.vis<5000?'a':''],[t2('Weather','Vær'),WXC[ADV.wx]||'—',ADV.wx===3?'r':ADV.wx?'a':'']]);
    el('roF').innerHTML=[[t2('Air cools to the dew point','Luften kjøles til duggpunktet'),ADV.xf<0?L(t2('never','aldri')):Math.round(400-ADV.xf)+' km '+L(t2('offshore','ute'))],[t2('At the coast','Ved kysten'),ADV.wx===3?L(t2('advection fog (FG)','adveksjonståke (FG)')):ADV.wx===4?L(t2('low stratus','lav stratus')):ADV.wx===1?'BR':L(t2('clear','klart'))],[t2('Visibility at the coast','Sikt ved kysten'),fmtV(ADV.vis)]].map(([k,v])=>`<div class="rrow"><span>${L(k)}</span><b>${v}</b></div>`).join('');
    if(view==='fog') see(F.sst>=F.atd?L(t2('<b>No advection fog:</b> the sea is warmer than the dew point, so the air can never cool to saturation over it.','<b>Ingen adveksjonståke:</b> sjøen er varmere enn duggpunktet, så luften kan aldri kjøles til metning over den.'))
      :ADV.wx===4?L(t2('<b>Too windy for fog at the surface:</b> above about 15–20 kt the mixing lifts it into low stratus.','<b>For mye vind for tåke ved overflaten:</b> over rundt 15–20 kt løfter blandingen den til lav stratus.'))
      :L(t2('<b>Advection fog:</b> warm, moist air moving over a sea colder than its dew point cools from below. It can form by day or night, cover large areas and persist in winds up to about 15 kt: typical along coasts in spring and early summer.','<b>Adveksjonståke:</b> varm, fuktig luft som beveger seg over et hav kaldere enn duggpunktet, kjøles nedenfra. Den kan dannes dag og natt, dekke store områder og holde seg i vind opp til rundt 15 kt: typisk langs kysten om våren og forsommeren.'))); }
  live(); }
function fUpd(){ if(F.type==='rad') night(); else advect(); fOut(); fBuild(); fDraw(); }
let fLastI=-1;
function fStep(now){ const dt=Math.min(0.1,(now-fLast)/1000); fLast=now; F.time+=dt*1.5; if(F.time>=36){ F.time=36; fPlay=false; drawTabs(); }
  const i=Math.round((F.time-18)*6); if(i!==fLastI){ fLastI=i; sHr.set(F.time); fOut(); } fDraw(); }
function fToggle(){ if(F.type!=='rad') return; fPlay=!fPlay; if(fPlay){ if(F.time>=35.9) F.time=18; fLast=performance.now(); } drawTabs(); kick(); }
/* controls */
const segF=LAB.seg(el('ftype'),[['rad','Radiation'],['adv','Advection']],F.type,v=>{ F.type=v; fPlay=false; syncF(); legend(); drawTabs(); fUpd(); });
const radBox=document.createElement('div'), advBox=document.createElement('div'); el('ctlF').append(radBox,advBox);
const fT=LAB.slider(radBox,{label:'Temperature at sunset (°C)',min:-5,max:25,step:1,v:F.t,f:v=>v+' °C',on:v=>{ F.t=v; if(F.td>v){ F.td=v; fTd.set(v); } fUpd(); }});
const fTd=LAB.slider(radBox,{label:'Dew point (°C)',min:-10,max:25,step:1,v:F.td,f:v=>v+' °C',on:v=>{ if(v>F.t){ v=F.t; fTd.set(v); } F.td=v; fUpd(); }});
const fW=LAB.slider(radBox,{label:'Wind (kt)',min:0,max:15,step:1,v:F.wind,f:v=>v+' kt',on:v=>{ F.wind=v; fUpd(); }});
const skyG=document.createElement('div'); skyG.innerHTML='<div class="grp" id="gSky">Sky</div><div id="fsky"></div>'; radBox.appendChild(skyG);
const segSky=LAB.seg(skyG.querySelector('#fsky'),[['clear','Clear'],['part','Partly'],['ovc','Overcast']],F.sky,v=>{ F.sky=v; fUpd(); });
const hrBox=document.createElement('div'); hrBox.style.marginTop='8px'; radBox.appendChild(hrBox);
const sHr=LAB.slider(hrBox,{label:'Time',min:18,max:36,step:1/6,v:F.time,f:v=>fmtT(v),on:v=>{ F.time=v; fPlay=false; drawTabs(); fOut(); fDraw(); }});
const aT=LAB.slider(advBox,{label:'Air temperature over the sea (°C)',min:0,max:25,step:1,v:F.at,f:v=>v+' °C',on:v=>{ F.at=v; if(F.atd>v){ F.atd=v; aTd.set(v); } fUpd(); }});
const aTd=LAB.slider(advBox,{label:'Dew point (°C)',min:-5,max:25,step:1,v:F.atd,f:v=>v+' °C',on:v=>{ if(v>F.at){ v=F.at; aTd.set(v); } F.atd=v; fUpd(); }});
const aS=LAB.slider(advBox,{label:'Sea temperature (°C)',min:0,max:25,step:1,v:F.sst,f:v=>v+' °C',on:v=>{ F.sst=v; fUpd(); }});
const aW=LAB.slider(advBox,{label:'Wind (kt)',min:2,max:30,step:1,v:F.aw,f:v=>v+' kt',on:v=>{ F.aw=v; fUpd(); }});
function syncF(){ radBox.hidden=F.type!=='rad'; advBox.hidden=F.type!=='adv'; segF.set(F.type); fT.set(F.t); fTd.set(F.td); fW.set(F.wind); segSky.set(F.sky); sHr.set(F.time); aT.set(F.at); aTd.set(F.atd); aS.set(F.sst); aW.set(F.aw); }
const PREF=[
 ['classic',t2('Classic radiation fog','Klassisk strålingståke'),{type:'rad',t:10,td:7,wind:3,sky:'clear',time:31}],
 ['windy',t2('Too windy: low stratus','For mye vind: lav stratus'),{type:'rad',t:10,td:7,wind:12,sky:'clear',time:31}],
 ['ovc',t2('Overcast: no fog','Overskyet: ingen tåke'),{type:'rad',t:10,td:7,wind:3,sky:'ovc',time:31}],
 ['sea',t2('Spring sea fog','Havtåke om våren'),{type:'adv',at:14,atd:11,sst:8,aw:10}]];
function drawPreF(){ el('preF').innerHTML=PREF.map(([k,n])=>`<button type="button" class="btn sm" data-p="${k}">${L(n)}</button>`).join(''); }
function presetF(k){ const p=PREF.find(x=>x[0]===k); if(!p) return; Object.assign(F,p[2]); fPlay=false; syncF(); setView('fog'); legend(); drawTabs(); fUpd(); }
el('preF').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) presetF(b.dataset.p); });

/* =====================================================================
   Try it
   ===================================================================== */
let active=null; const ans={}, touched={}, fbLast={};
const TASKS=[
 {k:'cb',v:'lift',start:()=>preset('fair'),q:t2('Make the afternoon cumulus grow into a CB (keep Heating as the lift).','Få ettermiddagens cumulus til å vokse til en CB (behold Oppvarming som løft).'),
  check:()=>{ if(S.mode!=='heat') return {ok:0,m:t2('Choose Heating as what lifts the air.','Velg Oppvarming som det som løfter luften.')};
    if(R.type==='cb') return {ok:1,m:t2(`Yes: tops at ${fmtH(R.top)}, base ${fmtH(R.base)}. A steep lapse rate (${nf(S.elr,1)} °C/1000 ft, more than the saturated ${nf(R.salrB,1)}) and moist air (spread ${S.t-S.td} °C) give a deep, conditionally unstable layer: the parcel stays warmer than the air around all the way to the tropopause.`,`Ja: topper i ${fmtH(R.top)}, base ${fmtH(R.base)}. En bratt gradient (${nf(S.elr,1)} °C/1000 ft, mer enn den mettede ${nf(R.salrB,1)}) og fuktig luft (spredning ${S.t-S.td} °C) gir et dypt, betinget ustabilt lag: pakken holder seg varmere enn luften rundt helt opp til tropopausen.`)};
    return {ok:0,m:t2(`Now ${L(TYPE[R.type])}${R.cloud?', tops '+fmtH(R.top):''}. Make the air around cool faster with height (ELR above about 2.2 °C/1000 ft), and add moisture: a higher dew point.`,`Nå ${L(TYPE[R.type])}${R.cloud?', topper '+fmtH(R.top):''}. Få luften rundt til å kjøles raskere med høyden (ELR over rundt 2,2 °C/1000 ft), og tilfør fuktighet: høyere duggpunkt.`)}; }},
 {k:'base',q:t2('METAR: temperature 20 °C, dew point 12 °C. Where is the base of the cumulus?','METAR: temperatur 20 °C, duggpunkt 12 °C. Hvor er basen til cumulusskyene?'),
  opts:[t2('About 3200 ft','Rundt 3200 ft'),t2('About 800 ft','Rundt 800 ft'),t2('About 4800 ft','Rundt 4800 ft'),t2('About 8000 ft','Rundt 8000 ft')],c:0,
  e:[t2('Yes. Spread 8 °C × 400 ft = 3200 ft above the aerodrome.','Ja. Spredning 8 °C × 400 ft = 3200 ft over flyplassen.'),t2('Not quite. Spread × 400 ft: (20 − 12) × 400 = 3200 ft. Show it in the model.','Ikke helt. Spredning × 400 ft: (20 − 12) × 400 = 3200 ft. Se det i modellen.')],
  show:()=>{ Object.assign(S,{mode:'heat',t:20,td:12,elr:1.6,inv:false}); syncL(); setView('lift'); liftUpd(); }},
 {k:'fog',v:'fog',start:()=>presetF('classic'),q:t2('Clear sky, light wind: set the dew point so that fog forms just before dawn, between 03:00 and 07:00.','Klar himmel, svak vind: still duggpunktet slik at tåken dannes like før daggry, mellom 03:00 og 07:00.'),
  check:()=>{ if(F.type!=='rad') return {ok:0,m:t2('Choose Radiation fog.','Velg Strålingståke.')}; if(F.sky!=='clear'||F.wind<2||F.wind>7) return {ok:0,m:t2('Keep a clear sky and a wind of 2–7 kt.','Behold klar himmel og vind på 2–7 kt.')};
    const on=FR.on>=0?18+FR.on/6:null;
    if(on!=null&&on>=27&&on<=31) return {ok:1,m:t2(`Yes: fog at ${fmtT(on)} with a spread of ${F.t-F.td} °C at sunset. Clear and light wind, the night cools the air about ${F.t-F.td} °C by then. Watch this spread in the evening METARs.`,`Ja: tåke kl. ${fmtT(on)} med en spredning på ${F.t-F.td} °C ved solnedgang. Klart og svak vind: natten kjøler luften rundt ${F.t-F.td} °C innen da. Følg med på denne spredningen i kveldens METAR.`)};
    return {ok:0,m:on==null?t2(`No fog now (smallest spread ${nf(Math.max(0,FR.minS),1)} °C). Raise the dew point to close the spread.`,`Ingen tåke nå (minste spredning ${nf(Math.max(0,FR.minS),1)} °C). Øk duggpunktet for å lukke spredningen.`):t2(`Fog forms at ${fmtT(on)}: ${on<27?'too early, lower the dew point a little':'too late'}.`,`Tåken dannes kl. ${fmtT(on)}: ${on<27?'for tidlig, senk duggpunktet litt':'for sent'}.`)}; }},
 {k:'wind',q:t2('A clear night with a small spread, but the wind picks up to 12 kt. What happens to the fog risk?','En klar natt med liten spredning, men vinden øker til 12 kt. Hva skjer med tåkefaren?'),
  opts:[t2('Fog at the surface becomes unlikely; low stratus may form instead','Tåke ved bakken blir lite sannsynlig; lav stratus kan dannes i stedet'),t2('Thicker fog, because the wind brings more moisture','Tykkere tåke, fordi vinden bringer mer fuktighet'),t2('No change: wind does not matter for radiation fog','Ingen endring: vind betyr ikke noe for strålingståke'),t2('Fog forms earlier in the evening','Tåken dannes tidligere på kvelden')],c:0,
  e:[t2('Yes. Stronger wind mixes the cooled air through a deeper layer and slows the cooling at the surface: any condensation happens higher up as low stratus.','Ja. Sterkere vind blander den avkjølte luften gjennom et dypere lag og bremser avkjølingen ved bakken: kondensasjonen skjer høyere opp som lav stratus.'),t2('Not quite. Radiation fog needs light wind (about 2–7 kt); stronger wind mixes the cooling upwards. Show it in the model.','Ikke helt. Strålingståke trenger svak vind (rundt 2–7 kt); sterkere vind blander avkjølingen oppover. Se det i modellen.')],
  show:()=>presetF('windy')}];
function drawTasks(){ el('tasks').innerHTML=TASKS.map((t,i)=>{ let h=`<li class="task" id="task-${t.k}"><span class="n">${L(t2('Task','Oppgave'))} ${i+1}</span><p class="q">${L(t.q)}</p>`;
  if(t.check) h+=`<div class="btns"><button type="button" class="btn pri sm" data-go="${t.k}">${L(t2('Do it in the model','Gjør det i modellen'))} ↑</button></div><span class="fb" id="fb-${t.k}"></span>`;
  else { const a=ans[t.k]; h+=`<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${a!=null?L(t.e[a===t.c?0:1]):''}</span><div class="btns"><button type="button" class="btn sm" data-show="${t.k}">${L(t2('Show it in the model','Vis det i modellen'))} ↑</button></div>`; }
  return h+'</li>'; }).join(''); for(const k in fbLast) delete fbLast[k]; live(); }
function drawTbox(){ const b=el('tbox'); if(!active){ b.hidden=true; return; } const i=TASKS.findIndex(t=>t.k===active);
  b.hidden=false; b.innerHTML=`<span class="k">${L(t2('Task','Oppgave'))} ${i+1}<button type="button" id="tclose" aria-label="${L(t2('Close the task','Lukk oppgaven'))}">×</button></span>${L(TASKS[i].q)}<span class="fb" id="tfb"></span>`;
  el('tclose').onclick=()=>{ active=null; drawTbox(); }; delete fbLast['_tb']; live(); }
function live(){ TASKS.filter(t=>t.check&&touched[t.k]).forEach(t=>{ const r=t.check(), h=L(r.m);
  if(fbLast[t.k]!==h){ fbLast[t.k]=h; const f=el('fb-'+t.k); if(f){ f.innerHTML=h; f.classList.toggle('ok',!!r.ok); } }
  if(active===t.k&&fbLast._tb!==h){ fbLast._tb=h; const f=el('tfb'); if(f){ f.innerHTML=h; f.classList.toggle('ok',!!r.ok); } } }); }
const toModel=()=>el('lift').scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});
el('tasks').addEventListener('click',e=>{ const go=e.target.closest('[data-go]'), o=e.target.closest('[data-o]'), sh=e.target.closest('[data-show]');
  if(go){ const t=TASKS.find(x=>x.k===go.dataset.go); active=t.k; touched[t.k]=1; t.start(); setView(t.v); drawTbox(); toModel(); return; }
  if(o){ const k=o.closest('.task').id.slice(5); ans[k]=+o.dataset.o; drawTasks(); return; }
  if(sh){ const t=TASKS.find(x=>x.k===sh.dataset.show); active=null; drawTbox(); t.show(); toModel(); } });

/* =====================================================================
   Understand: key concept cards and the full table
   ===================================================================== */
(function(){ if(!window.KCS) return; const {sv,tx,ar}=KCS;
  const ax=`<line x1="20" y1="58" x2="20" y2="6" stroke="#5B6B78"/><line x1="20" y1="58" x2="190" y2="58" stroke="#5B6B78"/>`;
  const vw=(v,fn)=>()=>{ if(fn) fn(); setView(v); };
  const full=()=>{ S.prof=true; S.full=true; drawTabs(); lBuild(); kick(); };
  const K=[
   {k:'elr',t:t2('Environmental lapse rate (ELR)','Temperaturgradient i omgivelsene (ELR)'),d:t2('How fast the <b>air around</b> cools with height on the day. ISA: about 2 °C per 1000 ft; a real day varies a lot.','Hvor fort <b>luften rundt</b> kjøles med høyden den dagen. ISA: rundt 2 °C per 1000 ft; en virkelig dag varierer mye.'),
    ill:()=>sv(`${ax}<line x1="150" y1="56" x2="70" y2="10" stroke="#F0B440" stroke-width="1.8"/>${tx(152,30,'ELR','#F0B440')}`),click:()=>{ S.prof=true; setView('lift'); liftUpd(); },to:'#cvp'},
   {k:'dalr',t:t2('Dry adiabatic lapse rate (DALR)','Tørradiabatisk gradient (DALR)'),d:t2('Rising air that is not saturated cools at about <b>3 °C per 1000 ft</b>, always.','Stigende luft som ikke er mettet, kjøles med rundt <b>3 °C per 1000 ft</b>, alltid.'),
    ill:()=>sv(`${ax}<line x1="160" y1="56" x2="40" y2="10" stroke="#E46BAE" stroke-width="1.8"/>${tx(110,20,'3 °C / 1000 ft','#E46BAE')}`),click:vw('lift',full),to:'#cvp'},
   {k:'salr',t:t2('Saturated adiabatic lapse rate (SALR)','Fuktigadiabatisk gradient (SALR)'),d:t2('In cloud, condensation releases heat, so saturated air cools more slowly: about <b>1.5–2 °C per 1000 ft</b> low down, more in cold air.','I sky frigjør kondensasjon varme, så mettet luft kjøles saktere: rundt <b>1,5–2 °C per 1000 ft</b> lavt nede, mer i kald luft.'),
    ill:()=>sv(`${ax}<path d="M160,56 Q120,30 90,8" fill="none" stroke="#71CC93" stroke-width="1.8"/>${tx(128,22,'≈ 1.8','#71CC93')}`),click:vw('lift',full),to:'#cvp'},
   {k:'stab',t:t2('Stable and unstable air','Stabil og ustabil luft'),d:t2('A lifted parcel colder than the air around sinks back: <b>stable</b>. Warmer, it keeps rising: <b>unstable</b>.','En løftet pakke som er kaldere enn luften rundt, synker tilbake: <b>stabil</b>. Er den varmere, fortsetter den å stige: <b>ustabil</b>.'),
    ill:()=>sv(`<circle cx="60" cy="30" r="8" fill="none" stroke="#E46BAE" stroke-width="1.6"/>${ar(60,40,60,56,'#7FCBE8')}<circle cx="140" cy="30" r="8" fill="none" stroke="#E46BAE" stroke-width="1.6"/>${ar(140,20,140,4,'#EC5A47')}${tx(60,62,L(t2('stable','stabil')),'#7FCBE8','middle')}${tx(162,40,L(t2('unstable','ustabil')),'#EC5A47','middle')}`),click:()=>preset('strat'),to:'#cvp'},
   {k:'cond',t:t2('Conditionally unstable','Betinget ustabil'),d:t2('ELR between the saturated and the dry rate: <b>stable for dry air, unstable once saturated</b>. The usual case for showers and thunderstorms.','ELR mellom den mettede og den tørre gradienten: <b>stabil for tørr luft, ustabil når den er mettet</b>. Det vanlige tilfellet for byger og tordenvær.'),
    ill:()=>sv(`${ax}<line x1="170" y1="56" x2="50" y2="8" stroke="#E46BAE" stroke-width="1.2" stroke-dasharray="3 2"/><path d="M170,56 Q130,30 110,8" fill="none" stroke="#71CC93" stroke-width="1.2" stroke-dasharray="3 2"/><line x1="170" y1="56" x2="80" y2="8" stroke="#F0B440" stroke-width="2"/>${tx(30,14,'SALR < ELR < DALR','#c9d2da')}`),click:()=>preset('storm'),to:'#cvp'},
   {k:'dew',t:t2('Dew point and condensation','Duggpunkt og kondensasjon'),d:t2('The <b>dew point</b> is the temperature at which the air would be saturated. Cool air to it and the vapour condenses: cloud, fog or dew.','<b>Duggpunktet</b> er temperaturen der luften ville vært mettet. Kjøl luften dit, og vanndampen kondenserer: sky, tåke eller dugg.'),
    ill:()=>sv(`${ax}<line x1="170" y1="56" x2="110" y2="26" stroke="#E46BAE" stroke-width="1.8"/><line x1="122" y1="56" x2="110" y2="26" stroke="#71CC93" stroke-width="1.6" stroke-dasharray="3 2"/><circle cx="110" cy="26" r="3.5" fill="#fff"/>${tx(116,22,L(t2('cloud base','skybase')),'#c9d2da')}`),click:()=>{ S.prof=true; preset('fair'); },to:'#cvp'},
   {k:'base',t:t2('Cloud base: (T − Td) × 400 ft','Skybase: (T − Td) × 400 ft'),d:t2('The spread closes about 2.5 °C per 1000 ft as air rises, so the <b>base is about 400 ft per °C</b> of spread. For convective cloud.','Spredningen lukkes med rundt 2,5 °C per 1000 ft når luften stiger, så <b>basen er rundt 400 ft per °C</b> spredning. For konvektive skyer.'),
    ill:()=>sv(`<line x1="10" y1="56" x2="190" y2="56" stroke="#5B6B78"/><path d="M80,30 a10,10 0 0 1 18,-8 a12,12 0 0 1 22,2 a9,9 0 0 1 6,12 Z" fill="#E9EEF2"/><line x1="30" y1="36" x2="170" y2="36" stroke="#fff" stroke-dasharray="2 3"/>${tx(100,50,'20/12 → 3200 ft','#c9d2da','middle')}`),click:()=>TASKS[1].show(),to:'#cvp'},
   {k:'lifts',t:t2('What lifts the air','Hva løfter luften'),d:t2('<b>Convection</b> (heating from below), <b>orographic</b> (hills), <b>frontal</b> (warm air over cold) and <b>convergence</b> (air flowing together into a low).','<b>Konveksjon</b> (oppvarming nedenfra), <b>orografisk</b> (terreng), <b>frontal</b> (varm luft over kald) og <b>konvergens</b> (luft som strømmer sammen i et lavtrykk).'),
    ill:()=>sv(`<path d="M10,58 Q60,10 110,58 Z" fill="#4A4A3C"/>${ar(30,54,58,24,'#E46BAE')}<line x1="120" y1="58" x2="190" y2="20" stroke="#7FCBE8"/>${ar(140,52,170,36,'#E46BAE')}`),click:()=>preset('cap'),to:'#cvp'},
   {k:'forms',t:t2('Heaped or layered','Haug eller lag'),d:t2('<b>Cumuliform</b> cloud (CU, TCU, CB) grows in unstable air; <b>stratiform</b> cloud (ST, SC, NS, AS) spreads in stable air.','<b>Cumuliforme</b> skyer (CU, TCU, CB) vokser i ustabil luft; <b>stratiforme</b> skyer (ST, SC, NS, AS) brer seg ut i stabil luft.'),
    ill:()=>sv(`<path d="M30,50 a12,12 0 0 1 14,-14 a14,14 0 0 1 24,-6 a12,12 0 0 1 12,20 Z" fill="#E9EEF2"/><rect x="110" y="34" width="80" height="12" rx="3" fill="#9AA5AF"/>${tx(55,62,L(t2('unstable','ustabil')),'#c9d2da','middle')}${tx(150,62,L(t2('stable','stabil')),'#c9d2da','middle')}`),click:vw('types',()=>tSel(null)),to:'#cvp'},
   {k:'cb',t:t2('CU, TCU and CB','CU, TCU og CB'),d:t2('One family: a cumulus grows into a towering cumulus and, deep and moist enough, a <b>cumulonimbus</b> with an anvil at the tropopause.','Én familie: en cumulus vokser til en tårnende cumulus og, dyp og fuktig nok, en <b>cumulonimbus</b> med ambolt ved tropopausen.'),
    ill:()=>sv(`<path d="M20,56 a8,8 0 0 1 12,-10 a8,8 0 0 1 12,10 Z" fill="#E9EEF2"/><path d="M70,56 a10,10 0 0 1 4,-24 a10,10 0 0 1 18,0 a10,10 0 0 1 4,24 Z" fill="#E9EEF2"/><path d="M130,56 L134,20 L120,12 L196,10 L170,20 L162,56 Z" fill="#C9D2DA"/>${tx(32,62,'CU','#c9d2da','middle')}${tx(84,62,'TCU','#c9d2da','middle')}${tx(146,62,'CB','#EC5A47','middle')}`),click:vw('types',()=>tSel('CB')),to:'#cvp'},
   {k:'prec',t:t2('Precipitation','Nedbør'),d:t2('Showers (SH) fall from heaped cloud, in bursts; <b>continuous</b> rain or snow falls from layer cloud (NS, AS); drizzle (DZ) from stratus.','Byger (SH) faller fra haugskyer, i støt; <b>vedvarende</b> regn eller snø faller fra lagskyer (NS, AS); yr (DZ) fra stratus.'),
    ill:()=>sv(`<rect x="20" y="10" width="160" height="16" rx="3" fill="#6B7682"/>${[...Array(14)].map((_,i)=>`<line x1="${28+i*11}" y1="32" x2="${25+i*11}" y2="${42+(i%3)*5}" stroke="#7FA6C8"/>`).join('')}`),click:vw('types',()=>tSel('NS')),to:'#cvp'},
   {k:'radfog',t:t2('Radiation fog','Strålingståke'),d:t2('A clear night, light wind (2–7 kt) and moist air: the ground cools the air to its dew point. Thickest around sunrise, clears as the sun warms the ground.','En klar natt, svak vind (2–7 kt) og fuktig luft: bakken kjøler luften til duggpunktet. Tykkest rundt soloppgang, letter når solen varmer bakken.'),
    ill:()=>sv(`<rect x="0" y="48" width="200" height="16" fill="#2E3328"/><rect x="0" y="32" width="200" height="16" fill="rgba(221,229,236,.7)"/>${[20,60,110,150,180].map(x=>`<circle cx="${x}" cy="${8+(x%3)*4}" r="1" fill="#fff"/>`).join('')}`),click:()=>presetF('classic'),to:'#cvp'},
   {k:'advfog',t:t2('Advection fog','Adveksjonståke'),d:t2('Warm, moist air moving over a colder surface: sea fog in spring, or mild air over snow. Any time of day, in winds up to about 15 kt.','Varm, fuktig luft som beveger seg over en kaldere overflate: havtåke om våren, eller mild luft over snø. Når som helst på døgnet, i vind opp til rundt 15 kt.'),
    ill:()=>sv(`<rect x="0" y="48" width="150" height="16" fill="#24557C"/><rect x="150" y="46" width="50" height="18" fill="#3E4036"/><path d="M60,48 Q100,26 170,30 L170,48 Z" fill="rgba(221,229,236,.8)"/>${ar(10,30,50,30,'#E46BAE')}`),click:()=>presetF('sea'),to:'#cvp'},
   {k:'ofog',dp:true,t:t2('Other fog','Annen tåke'),d:t2('<b>Hill (upslope) fog</b>: moist air forced up a slope; <b>frontal fog</b>: rain saturating the cold air under a warm front; <b>steam fog</b>: very cold air over much warmer water.','<b>Fjelltåke (oppslope)</b>: fuktig luft tvunget opp en li; <b>fronttåke</b>: regn som metter den kalde luften under en varmfront; <b>frostrøyk</b>: svært kald luft over mye varmere vann.'),
    ill:()=>sv(`<path d="M10,58 L120,14 L190,58 Z" fill="#4A4A3C"/><path d="M40,46 L100,22 L130,26 L60,50 Z" fill="rgba(221,229,236,.75)"/>`),click:()=>preset('cap'),to:'#cvp'},
   {k:'vis',t:t2('Visibility: BR, FG, HZ','Sikt: BR, FG, HZ'),d:t2('<b>Fog (FG)</b>: visibility below 1000 m. <b>Mist (BR)</b>: 1000–5000 m in moist air. <b>Haze (HZ)</b>: dry particles. RVR is measured along the runway.','<b>Tåke (FG)</b>: sikt under 1000 m. <b>Tåkedis (BR)</b>: 1000–5000 m i fuktig luft. <b>Dis (HZ)</b>: tørre partikler. RVR måles langs rullebanen.'),
    ill:()=>sv(`${[0,1,2,3,4,5].map(i=>`<circle cx="${20+i*32}" cy="40" r="3" fill="rgba(255,226,150,${1-i*0.17})"/>`).join('')}${tx(20,20,'FG < 1000 m','#c9d2da')}${tx(120,20,'BR 1–5 km','#c9d2da')}`),click:()=>presetF('classic'),to:'#cvp'}];
  KCS.render(el('kcGrid'),K); })();
function drawTable(){ const H=[t2('Term','Begrep'),t2('Where and when','Hvor og når'),t2('What it means for the pilot','Hva det betyr for piloten')];
  const rows=[[t2('Cloud types','Skyslag')],...GEN.map(g=>[g.k+' · '+L(g.n),L(g.h),L(g.p)]),[t2('Fog','Tåke')],
   [t2('Radiation fog','Strålingståke'),t2('Clear, calm nights over land, autumn and winter','Klare, stille netter over land, høst og vinter'),t2('Thickest around sunrise; usually clears by late morning, may last all day in winter','Tykkest rundt soloppgang; letter vanligvis utpå formiddagen, kan vare hele dagen om vinteren')],
   [t2('Advection fog','Adveksjonståke'),t2('Moist air over a cold sea or snow; coasts in spring and early summer','Fuktig luft over kaldt hav eller snø; kysten om våren og forsommeren'),t2('Any time of day, large areas, persists in wind up to about 15 kt','Når som helst på døgnet, store områder, holder seg i vind opp til rundt 15 kt')],
   [t2('Hill (upslope) fog','Fjelltåke (oppslope)'),t2('Moist air forced up rising ground','Fuktig luft tvunget opp stigende terreng'),t2('Hides high ground; often with stratus at the coast','Skjuler høyt terreng; ofte med stratus ved kysten')],
   [t2('Frontal fog','Fronttåke'),t2('Rain from a warm front falling into cold air','Regn fra en varmfront som faller i kald luft'),t2('Widespread, with low cloud and rain','Utbredt, med lave skyer og regn')],
   [t2('Steam fog (sea smoke)','Frostrøyk'),t2('Very cold air over much warmer water','Svært kald luft over mye varmere vann'),t2('Shallow; with showery cumulus downwind','Grunn; med bygeskyer nedstrøms')],
   [t2('Visibility','Sikt')],
   ['FG',t2('Fog: visibility below 1000 m','Tåke: sikt under 1000 m'),t2('Low-visibility procedures, RVR and CAT II/III minima','Prosedyrer for dårlig sikt, RVR og CAT II/III-minima')],
   ['BR',t2('Mist: 1000–5000 m, moist air','Tåkedis: 1000–5000 m, fuktig luft'),t2('Often thickens into fog overnight','Tykner ofte til tåke i løpet av natten')],
   ['HZ',t2('Haze: dry particles, often under an inversion','Dis: tørre partikler, ofte under en inversjon'),t2('Poor slant visibility into the sun','Dårlig skråsikt mot solen')],
   ['MIFG / BCFG',t2('Shallow fog / fog patches','Grunn tåke / tåkeflak'),t2('Runway may be visible from above but lost on short final','Banen kan synes ovenfra, men forsvinne på kort finale')]];
  el('cTab').innerHTML=`<thead><tr>${H.map(h=>`<th>${L(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>r.length===1?`<tr class="sub"><td colspan="3">${L(r[0])}</td></tr>`:`<tr>${r.map(c=>`<td>${typeof c==='string'?c:L(c)}</td>`).join('')}</tr>`).join('')}</tbody>`; }
function drawMaid(){ el('maid').innerHTML=`<span class="k">${L(t2('Memory aid','Huskeregel'))}</span><b>${L(t2('Cloud base ≈ (T − Td) × 400 ft','Skybase ≈ (T − Td) × 400 ft'))}</b><p>${L(t2('Rising air closes the spread by about 2.5 °C per 1000 ft. METAR 25/13: 12 × 400 ≈ 4800 ft above the aerodrome. It works for cumulus, not for frontal layer cloud.','Stigende luft lukker spredningen med rundt 2,5 °C per 1000 ft. METAR 25/13: 12 × 400 ≈ 4800 ft over flyplassen. Det virker for cumulus, ikke for lagskyer ved fronter.'))}</p>`; }

/* =====================================================================
   Test yourself
   ===================================================================== */
LAB.quiz(el('qbox'),'clouds',()=>LAB.shuffle([
 {q:t2('Unsaturated air is lifted. It cools at about…','Umettet luft løftes. Den kjøles med rundt …'),a:[t2('3 °C per 1000 ft','3 °C per 1000 ft'),t2('1.5 °C per 1000 ft','1,5 °C per 1000 ft'),t2('2 °C per 1000 ft','2 °C per 1000 ft'),t2('0.5 °C per 1000 ft','0,5 °C per 1000 ft')],c:0,e:t2('The dry adiabatic lapse rate. Saturated air cools more slowly because condensation releases heat; 2 °C per 1000 ft is the ISA, not an adiabatic rate.','Den tørradiabatiske gradienten. Mettet luft kjøles saktere fordi kondensasjon frigjør varme; 2 °C per 1000 ft er ISA, ikke en adiabatisk gradient.')},
 {q:t2('The air around cools 2.5 °C per 1000 ft. The air is…','Luften rundt kjøles 2,5 °C per 1000 ft. Luften er …'),a:[t2('conditionally unstable','betinget ustabil'),t2('absolutely stable','absolutt stabil'),t2('absolutely unstable','absolutt ustabil'),t2('neutral','nøytral')],c:0,e:t2('Between a typical saturated rate (about 1.5–1.8) and the dry rate (3): stable for dry air, unstable once saturated.','Mellom en typisk fuktigadiabatisk gradient (rundt 1,5–1,8) og den tørradiabatiske (3): stabil for tørr luft, ustabil når den er mettet.')},
 {q:t2('METAR 24/14. Rough cumulus base?','METAR 24/14. Omtrentlig cumulusbase?'),a:[t2('4000 ft','4000 ft'),t2('1000 ft','1000 ft'),t2('10 000 ft','10 000 ft'),t2('2400 ft','2400 ft')],c:0,e:t2('Spread 10 °C × 400 ft = 4000 ft above the aerodrome.','Spredning 10 °C × 400 ft = 4000 ft over flyplassen.')},
 {q:t2('What does an inversion do to the weather below it?','Hva gjør en inversjon med været under den?'),a:[t2('Traps haze, smoke and fog and caps cloud growth','Fanger dis, røyk og tåke og stopper skyveksten'),t2('Causes thunderstorms','Gir tordenvær'),t2('Improves visibility','Gir bedre sikt'),t2('Makes the air below absolutely unstable','Gjør luften under absolutt ustabil')],c:0,e:t2('Temperature rising with height is very stable: a lid. Cumulus spread out under it as stratocumulus.','Temperatur som stiger med høyden er svært stabilt: et lokk. Cumulus brer seg ut under det som stratocumulus.')},
 {q:t2('Ideal conditions for radiation fog?','Ideelle forhold for strålingståke?'),a:[t2('Clear night, light wind, moist air','Klar natt, svak vind, fuktig luft'),t2('Overcast night, strong wind','Overskyet natt, sterk vind'),t2('Hot afternoon, dry air','Varm ettermiddag, tørr luft'),t2('Clear night, calm, very dry air','Klar natt, vindstille, svært tørr luft')],c:0,e:t2('The ground must cool by radiation, the spread must be small, and a little wind spreads the cooling upwards.','Bakken må kjøles ved utstråling, spredningen må være liten, og litt vind sprer avkjølingen oppover.')},
 {q:t2('Sea fog drifts in with a 15 kt onshore wind. What kind of fog is it?','Havtåke driver inn med 15 kt pålandsvind. Hva slags tåke er det?'),a:[t2('Advection fog','Adveksjonståke'),t2('Radiation fog','Strålingståke'),t2('Steam fog','Frostrøyk'),t2('Frontal fog','Fronttåke')],c:0,e:t2('Moist air moving over a cold surface; it can persist in quite strong wind.','Fuktig luft som beveger seg over en kald overflate; den kan holde seg i ganske sterk vind.')},
 {q:t2('Which METAR cues suggest stable air?','Hvilke tegn i METAR tyder på stabil luft?'),a:[t2('BR, FG, ST, haze','BR, FG, ST, dis'),t2('SHRA, CB, TCU','SHRA, CB, TCU'),t2('Gusts and good visibility','Vindkast og god sikt'),t2('Hail and thunder','Hagl og torden')],c:0,e:t2('Stable air holds moisture and particles near the ground and makes layer cloud.','Stabil luft holder fuktighet og partikler nær bakken og gir lagskyer.')},
 {q:t2('Why does a cumulus keep growing once its base has formed, even though the air below the base was only just unstable?','Hvorfor fortsetter en cumulus å vokse når basen først er dannet, selv om luften under basen bare så vidt var ustabil?'),a:[t2('Condensation releases latent heat, so the saturated parcel cools more slowly and stays warmer than the air around','Kondensasjon frigjør latent varme, så den mettede pakken kjøles saktere og holder seg varmere enn luften rundt'),t2('The cloud absorbs sunlight and heats up','Skyen absorberer sollys og varmes opp'),t2('The air around warms up when cloud forms','Luften rundt varmes opp når skyen dannes'),t2('Pressure rises inside the cloud','Trykket stiger inne i skyen')],c:0,e:t2('That is conditional instability: stable for dry air, unstable once saturated.','Det er betinget instabilitet: stabil for tørr luft, ustabil når den er mettet.')},
 {q:t2('Radiation fog has formed overnight. What normally clears it in the morning?','Strålingståke har dannet seg i løpet av natten. Hva fjerner den vanligvis om morgenen?'),a:[t2('Sun warming the ground and the wind picking up, mixing drier air down','Solen som varmer bakken og vind som tar seg opp og blander ned tørrere luft'),t2('A drop in the QNH','Et fall i QNH'),t2('Further cooling of the ground','Ytterligere avkjøling av bakken'),t2('Drizzle washing it out','Yr som vasker den ut')],c:0,e:t2('It lifts first into low stratus and then breaks up. Under a thick fog layer or in winter with a weak sun it can last all day.','Den letter først til lav stratus og brytes så opp. Under et tykt tåkelag eller om vinteren med svak sol kan den vare hele dagen.')},
 {q:t2('The temperature–dew point spread at the aerodrome is falling by about 1 °C per hour in the evening, with a clear sky and light wind. What should you expect?','Spredningen mellom temperatur og duggpunkt på flyplassen faller med rundt 1 °C i timen om kvelden, med klar himmel og svak vind. Hva bør du vente?'),a:[t2('Mist or fog when the spread closes, possibly before your arrival','Tåkedis eller tåke når spredningen lukkes, kanskje før du kommer fram'),t2('Better visibility as the night goes on','Bedre sikt utover natten'),t2('Thunderstorms around midnight','Tordenvær rundt midnatt'),t2('A rise in cloud base','At skybasen hever seg')],c:0,e:t2('Check the TAF and plan for an alternate with better conditions.','Sjekk TAF og planlegg en alternativ flyplass med bedre forhold.')},
 {q:t2('Moist air is forced up the windward side of a mountain range and comes down on the lee side. Compared with the windward foot, the air at the lee foot is…','Fuktig luft tvinges opp på lo side av en fjellkjede og kommer ned på le side. Sammenlignet med foten på lo side er luften ved foten på le side …'),a:[t2('warmer and drier (föhn)','varmere og tørrere (føhn)'),t2('colder and moister','kaldere og fuktigere'),t2('the same, because the process is adiabatic','den samme, fordi prosessen er adiabatisk'),t2('colder but drier','kaldere, men tørrere')],c:0,e:t2('It cooled at the slower saturated rate in cloud on the way up and lost moisture as rain, then warms at the dry rate all the way down.','Den ble kjølt med den langsommere mettede gradienten i skyen på vei opp og mistet fuktighet som regn, og varmes så med den tørre gradienten hele veien ned.')},
 {q:t2('Cold air flows over a much warmer sea or lake. Which cloud and visibility picture is typical?','Kald luft strømmer ut over et mye varmere hav eller innsjø. Hvilket bilde av skyer og sikt er typisk?'),a:[t2('Steam fog near the surface and showery cumulus downwind','Frostrøyk nær overflaten og bygeskyer nedstrøms'),t2('A clear sky with excellent visibility','Klar himmel med utmerket sikt'),t2('Thick advection fog that lasts for days','Tykk adveksjonståke som varer i flere dager'),t2('Cirrostratus with a halo','Cirrostratus med halo')],c:0,e:t2('Heating from below makes the air unstable: steam fog over the water, and showers in cumulus further downwind.','Oppvarming nedenfra gjør luften ustabil: frostrøyk over vannet, og byger i cumulus lenger nedstrøms.')},
 {q:t2('Which two cloud types are middle-level clouds?','Hvilke to skyslag er middels høye skyer?'),a:[t2('Altocumulus and altostratus','Altocumulus og altostratus'),t2('Stratocumulus and stratus','Stratocumulus og stratus'),t2('Cirrocumulus and cirrostratus','Cirrocumulus og cirrostratus'),t2('Cumulus and cumulonimbus','Cumulus og cumulonimbus')],c:0,e:t2('The prefix alto- marks the middle level (about 6500–20 000 ft in mid-latitudes); cirro- marks the high level.','Forstavelsen alto- markerer middels nivå (rundt 6500–20 000 ft på midlere breddegrader); cirro- markerer høyt nivå.')},
 {q:t2('You see a halo round the sun through a thin, milky veil of cloud. What is it, and what may follow?','Du ser en halo rundt solen gjennom et tynt, melkeaktig skyslør. Hva er det, og hva kan følge?'),a:[t2('Cirrostratus; lowering cloud and rain from an approaching warm front','Cirrostratus; senkende skyer og regn fra en varmfront som nærmer seg'),t2('Altocumulus; thunderstorms within the hour','Altocumulus; tordenvær innen en time'),t2('Stratus; fog by evening','Stratus; tåke til kvelden'),t2('Cumulus; a fine afternoon','Cumulus; en fin ettermiddag')],c:0,e:t2('A halo forms in the ice crystals of cirrostratus, often the first sign of a warm front.','En halo dannes i iskrystallene i cirrostratus, ofte det første tegnet på en varmfront.')}
]),12);

/* =====================================================================
   Start
   ===================================================================== */
LAB.start('clouds');
compute(); syncL(); syncF(); night(); drawPreL(); drawPreF(); drawTabs(); legend(); drawTasks(); drawTable(); drawMaid(); drawGlist(); liftOut(); fOut(); fromHash();
document.addEventListener('labdepth',()=>{ lBuild(); fBuild(); fDraw(); kick(); });
LAB.onLang(()=>{ drawPreL(); drawPreF(); drawTabs(); legend(); drawTasks(); drawTable(); drawMaid(); drawGlist(); seeLast=''; liftOut(); fOut(); if(view==='types') tSel(tSelK); lBuild(); fBuild(); fDraw(); kick(); });
})();
