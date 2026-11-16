/* Birdbird – official AIP for an aerodrome, by ICAO prefix (window.BBAIP.of('ENGM') → {name,url,kind,ead,note}).
   1. National eAIP site where the state publishes one openly (kind 'national').
   2. Other European (ECAC) states: EUROCONTROL EAD Basic, the free (registration) library of all their AIPs (kind 'ead').
   3. Anywhere else in the world: EUROCONTROL @IS Online, the maintained directory of every state's AIS website (kind 'dir').
   We link only: the AIP itself is never copied into Birdbird.
   Aerodrome page: BBAIP.ad('ENTO') → '/api/aip?icao=ENTO&go=1'. The server finds the AD 2 page (with the charts) in the
   edition in force today, every time (functions/_lib/aipres.js), so the link follows each new AIRAC by itself. Where a
   state has no open eAIP, or the aerodrome is not in it, the same link opens the state's AIP portal instead.
   tests/aip-links.mjs checks the portals and one aerodrome per state weekly (.github/workflows). */
(function(){
  'use strict';
  const EAD={name:'EUROCONTROL EAD Basic',url:'https://www.ead.eurocontrol.int/cms-eadbasic/opencms/en/login/ead-basic',kind:'ead',ead:true,note:{en:'free registration; the national AIP is in its AIP Library',no:'gratis registrering; nasjonal AIP ligger i AIP Library'}};
  const DIR={name:'EUROCONTROL @IS Online',url:'https://www.eurocontrol.int/articles/ais-online',kind:'dir',ead:false,note:{en:'directory of every country\'s AIS: pick the country',no:'katalog over alle lands AIS: velg landet'}};
  const N=(name,url)=>({name,url,kind:'national',ead:false,note:null});
  const A={
    EN:N('Avinor AIP Norway','https://ais.avinor.no/'),
    ES:N('LFV AIP Sweden','https://aro.lfv.se/'),
    EK:N('Naviair AIP Denmark','https://aim.naviair.dk/'),
    BG:N('Naviair AIP Greenland','https://aim.naviair.dk/'),
    EF:N('Fintraffic AIP Finland','https://www.ais.fi/'),
    BI:N('Isavia AIP Iceland','https://eaip.isavia.is/'),
    ED:N('DFS AIP Germany','https://aip.dfs.de/basicAIP/'),
    ET:N('DFS AIP Germany','https://aip.dfs.de/basicAIP/'),
    EG:N('NATS AIP United Kingdom','https://nats-uk.ead-it.com/cms-nats/opencms/en/Publications/AIP/'),
    EH:N('LVNL AIP Netherlands','https://www.lvnl.nl/diensten/aip'),
    EB:N('skeyes AIP Belgium and Luxembourg','https://ops.skeyes.be/'),
    EL:N('skeyes AIP Belgium and Luxembourg','https://ops.skeyes.be/'),
    EP:N('PANSA AIP Poland','https://www.ais.pansa.pl/en/publications/aip-ifr/'),
    LO:N('Austro Control AIP Austria','https://eaip.austrocontrol.at/'),
    LF:N('SIA AIP France','https://www.sia.aviation-civile.gouv.fr/'),
    LH:N('HungaroControl AIP Hungary','https://ais-en.hungarocontrol.hu/aip/'),
    LK:N('ANS CR AIP Czech Republic','https://aim.rlp.cz/eaip/html/index-en-GB.html'),
    LZ:N('LPS AIP Slovak Republic','https://aim.lps.sk/web/index.php?fn=200&lng=en'),
    EE:N('EANS AIP Estonia','https://eaip.eans.ee/'),
    EV:N('LGS AIP Latvia','https://ais.lgs.lv/aiseaip'),
    LG:N('HASP AIP Greece','https://aisgr.hasp.gov.gr'),
    LI:N('ENAV AIP Italy','https://onlineservices.enav.it/enavWebPortalStatic/AIP/AIP/default.html'),
    LP:N('NAV Portugal AIP','https://ais.nav.pt/online-eaip-en/'),
    LE:N('ENAIRE AIP Spain','https://aip.enaire.es/AIP/AIP-en.html'),
    GC:N('ENAIRE AIP Spain','https://aip.enaire.es/AIP/AIP-en.html')
  };
  /* ICAO prefixes of the other European (ECAC) states: their AIPs are in EAD Basic */
  const EUR=/^(E[EIVY]|L[ABCDHJKMNQRSTUWXYZ]|UK|UD|UB|UG)/;
  function of(icao){ const id=String(icao||'').toUpperCase(); if(!/^[A-Z][A-Z0-9]{3}$/.test(id)) return null; const p=id.slice(0,2);
    return A[p]||(EUR.test(id)?EAD:DIR); }
  /* states where the AD 2 page itself is found (the rest open the portal) */
  const DEEP=/^(EN|ES|EF|BI|EG|EB|EL|EP|EE|EV|LH|LP|LZ|LK|LE|GC|LF|ED|ET|EK|BG|LO|LJ|LY|LA|LQ)/;
  const ad=icao=>{ const id=String(icao||'').toUpperCase(); return /^[A-Z]{2}[A-Z0-9]{2}$/.test(id)?'/api/aip?icao='+id+'&go=1':null; };
  const deep=icao=>DEEP.test(String(icao||'').toUpperCase());
  window.BBAIP={of,ad,deep,EAD,DIR,ALL:A};
})();
