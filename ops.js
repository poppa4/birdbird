/* Birdbird – felles operative data: DA42-VI fartskort og begrensninger, flyplassen Birdbird (oppdiktet) med frekvenser,
   avgangs- og innflygingsprosedyrer, og et værgenerator. Brukes av flytreneren, briefingtreneren og checkride-treneren.
   Fartene følger Diamond DA42 NG/VI AFM. Skolens eget fartskort gjelder alltid foran disse. */
(function(G){
'use strict';
const pick=a=>a[Math.floor(Math.random()*a.length)];
const rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pad=(n,l)=>String(n).padStart(l,'0');

/* ---------- DA42-VI ---------- */
const AC={
  type:'DA42-VI', reg:'LN-NAE', engines:'2 × Austro AE300, 168 hp, FADEC, Jet A-1',
  mtom:1999, mlm:1999,
  // fart i KIAS. [≤1900 kg, >1900 kg] der den varierer
  vr:{up:76, app:[71,74]}, v50:83, vy:[90,92], vyApp:85, vyse:85, vmca:{up:71, app:68}, vx:72,
  vref:{up:[86,92], app:[84,88], ldg:[84,86]}, vga:90, vo:{'≤1700':112,'1700–1800':119,'>1800':122},
  vfe:{app:133, ldg:113}, vlo:{ext:188, ret:152}, vle:188, vno:151, vne:188,
  xwind:25, starter:'max 10 s, then 20 s cool-down', fuel:'25 US gal usable per tank (basic, 50 US gal total)',
  oei:'Fly – identify – verify – secure. Target 90–92 KIAS, never below Vyse 85 KIAS. Check OEI climb performance (AFM section 5) against the SID or obstacle gradient before departure, and brief the alternative if it cannot be met.',
  power:[['Take-off','100 %','76 KIAS rotate, ≈+5°'],['Climb','92 %','90–100 KIAS'],['Cruise','65 %','≈135 KIAS, 11 GPH total'],['Holding','45 %','120 KIAS'],['Descent','30 %','140 KIAS'],['Approach 3°, gear down, flaps APP','35 %','100 KIAS, ≈ −5° pitch'],['OEI climb','100 %','85 KIAS']],
  stable:'By 1000 ft AAL (500 ft AAL in VMC): within half scale on CDI and GS/GP, vertical speed not more than 1000 ft/min, speed within ±10 kt of target, landing configuration. Otherwise: “Unstable, going around”.'
};
const sp=(v,m)=>Array.isArray(v)?(m>1900?v[1]:v[0]):v;
function speeds(mass){ return {vr:AC.vr.up, v50:AC.v50, vy:sp(AC.vy,mass), vyse:AC.vyse, vmca:AC.vmca.up, vref:sp(AC.vref.ldg,mass), vrefApp:sp(AC.vref.app,mass), vga:AC.vga, vfeApp:AC.vfe.app, vfeLdg:AC.vfe.ldg}; }

/* ---------- Birdbird (oppdiktet) ---------- */
const APT={
  icao:'NAER', name:'Birdbird', elev:10, rwy:{'36':{qfu:360,tora:2500,lda:2500}, '18':{qfu:180,tora:2500,lda:2500}}, width:45,
  freq:{atis:'127.180', del:'121.875', gnd:'121.700', twr:'118.300', app:'119.250', fis:'125.350'},
  navaids:{loc:{id:'IASN',freq:'110.30',crs:360}, vor:{id:'ASN',freq:'113.30'}},
  ta:7000, msa:3200, msaRef:'ASN 25 NM',
  stands:['2','3','4','5','7'], hp36:'A1', hp18:'A3',
  vrp:{N:'NOVEMBER (Osvik bridge, 8 NM north)', S:'SIERRA (Holmen lake, 8 NM south)'}
};
/* avgang RWY 36 */
const SID={
  name:'OSVIK 1N', rwy:'36',
  text:'Climb on track 360°. At 1500 ft turn LEFT direct OSVIK. Initial climb 3000 ft or as cleared.',
  steps:[['Track 360° after take-off',''],['At 1500 ft: turn left','direct OSVIK (322°, 22 NM)'],['Initial climb','3000 ft']],
  grad:'4.5 % to 1500 ft (terrain north-west)', gradNote:'4.5 % at 90 kt groundspeed ≈ 410 ft/min. One-engine-inoperative climb in a heavy DA42 on a warm day may not achieve this.',
  msa:3200, transAlt:7000
};
/* ILS 36 */
const ILS36={
  name:'ILS RWY 36', id:'ils36', kind:'ILS', chart:'NAER 11-1', date:'01 NOV 26',
  loc:'IASN 110.30', crs:360, gp:3.0, tch:50, thrElev:10,
  iaf:[['ALPOR','3000 ft'],['BIKAN','3000 ft']], if_:['RONAX','D10.0 IASN','3000 ft'], faf:['FAPSO','D5.0 IASN','1650 ft'],
  checks:[['D4.0','1330'],['D3.0','1020'],['D2.0','700'],['D1.0','380']],
  minima:{da:210, dh:200, rvr:550, locMda:460, locMdh:450, locVis:1200, circ:'MDA 610 ft, VIS 1500 m'},
  missed:'Climb straight ahead on track 360° to 3000 ft, then direct HOLAN and hold. Missed approach climb gradient 2.5 %.',
  hold:'RONAX: inbound 360°, right-hand turns, 1 min, 3000 ft (MHA). HOLAN: inbound 180°, right-hand turns, 3000 ft.',
  msa:3200, ta:7000, notes:'Terrain 1100 ft 3 NM west of final. Approach lights 720 m. PAPI 3.0° left.',
  rod:{70:370,80:425,90:480,100:530,110:580,120:640}
};
const LOC36=Object.assign({},ILS36,{name:'LOC RWY 36 (glidepath out)', id:'loc36', kind:'LOC', minima:Object.assign({},ILS36.minima)});
const RNAV36=Object.assign({},ILS36,{name:'RNP RWY 36', id:'rnp36', kind:'RNP', chart:'NAER 12-1', loc:'Channel 41736 (SBAS)', minima:{da:250,dh:240,rvr:750,locMda:470,locMdh:460,locVis:1300,circ:ILS36.minima.circ,lpv:true}});
const APPS={ils36:ILS36,loc36:LOC36,rnp36:RNAV36};

/* ---------- vær og verdier for én flytur ---------- */
const LET='ALFA BRAVO CHARLIE DELTA ECHO FOXTROT GOLF HOTEL INDIA JULIETT KILO LIMA MIKE NOVEMBER OSCAR PAPA QUEBEC ROMEO SIERRA TANGO UNIFORM VICTOR WHISKEY XRAY YANKEE ZULU'.split(' ');
function flight(o){ o=o||{}; const ifr=o.rules!=='vfr';
  const wd=pick([330,340,350,360,10,20]), ws=rint(4,14), gust=ws>11?ws+rint(8,10):0;
  const qnh=rint(996,1027), t=rint(-2,14), dp=t-rint(1,4);
  const cld=ifr? pick([['BKN',600],['BKN',800],['OVC',900],['BKN',1200]]) : pick([['FEW',3500],['SCT',4000],['FEW',2800]]);
  const vis=ifr? pick([4000,6000,8000,9999]) : 9999;
  const li=rint(0,20), info=LET[li];
  const sq=ifr? '4'+pad(rint(100,777),3).replace(/[89]/g,'0') : '7000';
  const mass=pick([1780,1850,1920,1999]);
  const stand=pick(APT.stands);
  const app=o.app||pick(['ils36','ils36','rnp36','loc36']);
  const V={ifr, wd, ws, gust, qnh, t, dp, cld, vis, info, infoNext:LET[(li+1)%26], sq, mass, stand, app, rwy:'36', hp:APT.hp36,
    wind:pad(wd,3)+'° '+ws+(gust?'G'+gust:'')+' kt', tl:qnh<995?'FL 95':qnh<1013?'FL 90':'FL 80', clrAlt:ifr?'3000 ft':'1500 ft', vrp:ifr?null:pick(['N','S'])};
  V.metar=`${APT.icao} ${pad(rint(1,28),2)}${pad(rint(6,16),2)}20Z ${pad(wd,3)}${pad(ws,2)}${gust?'G'+gust:''}KT ${vis===9999?'9999':pad(vis,4)} ${cld[0]}${pad(cld[1]/100,3)} ${t<0?'M'+pad(-t,2):pad(t,2)}/${dp<0?'M'+pad(-dp,2):pad(dp,2)} Q${qnh}`;
  V.atis=`THIS IS BIRDBIRD INFORMATION ${info}. RUNWAY 36 IN USE${ifr?', EXPECT '+(APPS[app].kind==='RNP'?'RNP':APPS[app].kind==='LOC'?'LOCALIZER':'ILS')+' APPROACH':''}. TRANSITION LEVEL ${V.tl.replace('FL ','FLIGHT LEVEL ')}. WIND ${pad(wd,3)} DEGREES ${ws} KNOTS${gust?' MAXIMUM '+gust:''}. VISIBILITY ${vis===9999?'10 KILOMETRES OR MORE':vis+' METRES'}. ${cld[0]==='BKN'?'BROKEN':cld[0]==='OVC'?'OVERCAST':cld[0]==='SCT'?'SCATTERED':'FEW'} ${cld[1]} FEET. TEMPERATURE ${t}, DEW POINT ${dp}. QNH ${qnh}.${ifr&&app==='loc36'?' ILS GLIDEPATH RUNWAY 36 OUT OF SERVICE.':''} ACKNOWLEDGE INFORMATION ${info} ON FIRST CONTACT.`;
  V.qnh2=qnh+(Math.random()<0.5?-1:1);
  V.atis2=V.atis.split('INFORMATION '+info).join('INFORMATION '+V.infoNext).replace('QNH '+qnh,'QNH '+V.qnh2);
  // sidevind
  const rel=(wd-360)*Math.PI/180; V.xw=Math.round(Math.abs(Math.sin(rel))*ws); V.hw=Math.round(Math.cos(rel)*ws);
  return V;
}

G.OPS={AC,APT,SID,APPS,ILS36,LOC36,RNAV36,speeds,flight,pick,rint,pad,LET};
})(window);
