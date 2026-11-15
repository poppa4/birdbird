/* Birdbird – official AIP for an aerodrome, by ICAO prefix (window.BBAIP.of('ENGM') → {name,url,ead}).
   National eAIP sites where the state publishes one openly; every other European state through EUROCONTROL EAD Basic,
   the free (registration) library of all ECAC AIPs. We link only: the AIP itself is never copied into Birdbird.
   Deep links to AD 2 are not used: the national URLs carry the AIRAC date and break every 28 days. */
(function(){
  'use strict';
  const EAD={name:'EUROCONTROL EAD Basic',url:'https://www.ead.eurocontrol.int/cms-eadbasic/opencms/en/login/ead-basic',ead:true};
  const N=(name,url)=>({name,url,ead:false});
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
    LG:N('HASP AIP Greece','https://aisgr.hasp.gov.gr'),
    LI:N('ENAV AIP Italy','https://onlineservices.enav.it/enavWebPortalStatic/AIP/AIP/default.html'),
    LP:N('NAV Portugal AIP','https://ais.nav.pt/online-eaip-en/'),
    LE:N('ENAIRE AIP Spain','https://aip.enaire.es/AIP/AIP-en.html'),
    GC:N('ENAIRE AIP Spain','https://aip.enaire.es/AIP/AIP-en.html')
  };
  /* ICAO prefixes of the other European (ECAC) states: their AIPs are in EAD Basic */
  const EUR=/^(E[EIVY]|L[ABCDHJKMNQRSTUWXYZ]|UK|UD|UB|UG)/;
  function of(icao){ const id=String(icao||'').toUpperCase(); if(!/^[A-Z]{4}$/.test(id)) return null; const p=id.slice(0,2);
    return A[p]||(EUR.test(id)?EAD:null); }
  window.BBAIP={of,EAD};
})();
