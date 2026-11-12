/* Birdbird – "Use my own checklist" for the cockpit trainers (C172, DA42, King Air B200; 2D and 3D pages).
   Every flight school has its own checklists and SOPs, so the trainers do not impose one. The student picks a checklist from
   My Workspace (a document in the Checklists or SOP category, or a note) or pastes the text. It is parsed into sections and
   items and shown in the Procedures drawer: tap to tick, the current item highlighted, large text on request. Items whose
   wording names a control the trainer knows (a per-aircraft dictionary of control names and synonyms) tick themselves when the
   trainer sees that control in the stated position; the rest are ticked by hand. Order is never enforced.
   Storage: the choice per aircraft type is an index in localStorage 'bb-ownck' (synced as a setting; names and ids only).
   The checklist text never leaves the device: it is read from the workspace's own IndexedDB stores, or kept in
   'bb-ownck-text' for pasted text (not synced).
   Pure parts (parse, mapItem, matchSection, DICT) run in Node for the tests. Nothing runs per frame: tick() returns at once
   unless 0.25 s has passed, and then checks only the unticked, mapped items of the open section. */
(function(G){
'use strict';
const T=(en,no)=>({en,no:no==null?en:no});
const fold=s=>String(s==null?'':s).toLowerCase().replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').normalize('NFD').replace(/[̀-ͯ]/g,'');
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ---------- parser ---------- */
const RESPW='ON|OFF|SET|IDLE|MAX|MAXIMUM|RICH|LEAN|UP|DOWN|DN|OPEN|CLOSED?|AUTO|ARM|ARMED|CHECK|CHECKED|TESTED|COMPLETED?|FEATHER|FEATHERED|CUT-?OFF|BOTH|STBY|STANDBY|ALT|RELEASED?|NEUTRAL|IN|OUT|COLD|HOT|FULL|REMOVED|SECURED?|STOWED|LOCKED|FREE|SELECTED|FASTENED|ADJUSTED|CLEAR|PULL|PUSH|NORMAL|EXTEND|EXTENDED|RETRACT|RETRACTED|T\\/O|LDG|APP|APPR|PÅ|AV|SATT|INNE|UTE';
const RESP2=RESPW+'|CHKD|CHK|INSTALLED|ON BOARD|POS\\.? ?\\d|AS REQ\\w*|AS REQUIRED|SECURE|VERIFIED|CONFIRMED|DONE|WAIT|RECEIVED|BRIEFED|IDENTIFIED|ADVISE|MONITOR|CHECKED|START|POS\\.?|OR|UPRIGHT|POSITION|TIGHT|ADJ|AS REQ\\.?|[A-Z]{2,}ED|[A-Z]{2,5}D|\\d{1,4} ?(?:%|RPM|KIAS|KT|FT)?';
const RW1=new RegExp('^(?:'+RESP2+'|AS|REQ\\.?|REQD|GREEN|BOARD|RPM|KIAS|KT|FT|%|APPROX\\.?|GIVEN|ACK|IDENT\\.?|X-?CHKD|THE|LINE|TO|AND|THEN|OG|[,/&.])$');
const HEADANY=/\b(parking|flight|start|starting|taxi|take-?off|landing|approach|cruise|climb|descent|shut ?down|checklist|procedures?|failure|fire|emergency|abnormal|before|after|preflight|securing|run-?up|line-?up|version)\b/i;
/* a line that is only a response (table layouts): caps, short, every word response-like or filler, at least one known word */
const RONLY={test(s){ if(s.length>30||s!==s.toUpperCase()||!/[A-ZÆØÅ0-9]/.test(s)) return false; const w=s.replace(/([,/&])/g,' $1 ').trim().split(/\s+/); if(w.length>6) return false; if(HEADANY.test(s)&&!(w.length===1&&/^(START|LANDING)$/.test(w[0]))) return false;
  return w.every(x=>/^[,/&]$/.test(x)||RW1.test(x)); }};
const TRAIL=new RegExp('^(.+?)\\s+((?:(?:CHECK|CHECKED|AS REQ(?:UIRED|D)?)\\s+)?(?:'+RESPW+')(?:\\s*(?:[,/&]|AND|THEN|OG)\\s*(?:'+RESPW+'))*)$');
const BUL=/^(?:[•●▪◦·○□☐❑■▢➢►▶✓✔\-\*–]+|\[\s?[xX✓]?\s?\]|\(?\d{1,3}[.)]|\(?[a-hA-H][.)])\s+/;
const DOTS=/^(.+?)\s*(?:\.{2,}|…+|_{3,}|·{2,}|(?:\.\s){2,}\.?)\s*(\S.*)$/;
const DOTEND=/^(.+?)\s*(?:\.{2,}|…+|_{3,}|·{2,})\s*$/;
const DASH=/^(.+?)\s+(?:—|–|-{1,2})\s+(\S.*)$/;
const EMD=/^(.+?)\s*[—–]\s*(\S.*)$/;
const GAP=/^(.+?)(?:\t+|\s{3,})(\S.*)$/;
const COLON=/^([^:]{2,42}):\s+(\S.{0,44})$/;
const isCaps=s=>{ const L=s.replace(/[^A-Za-zÆØÅæøå]/g,''); if(L.length<3) return false; const U=L.replace(/[^A-ZÆØÅ]/g,'').length; return U/L.length>0.8; };
const JUNK=/^(?:\d{1,4}|page \d+.*|side \d+.*|\d+\s*(?:\/|of|av)\s*\d+|rev(?:ision)?\.?\s*\S{0,12}|(?:date|dato)\b.{0,20}|issue \S+.{0,20})$/i;
const EMER_T=/emergenc|abnormal|malfunction|failure|\bfail|\bfire\b|smoke|fumes|ditching|forced landing|precautionary|engine out|\binop|\bstall|\bspin\b|icing|decompress|emergency descent|unsafe|\bnod|brann|royk|svikt|motorstans|motorstopp|unormal|nodlanding|overheat|low volt|alternator|generator/;
const GRP_E=/^(?:emergency|abnormal|emergency and abnormal|abnormal and emergency|nod|nod og unormal|unormal)(?: (?:procedures?|checklists?|prosedyrer|sjekklister|section))?$/;
const GRP_N=/^(?:normal|normal operations?)(?: (?:procedures?|checklists?|prosedyrer|sjekklister|section))?$/;
const HEADP=/^(before|after|prior to|during|for|line ?-?up|engine start|starting|run ?-?up|taxi|cruise|climb|descent|approach|landing|shut ?-?down|securing|go ?-?around|take ?-?off|preflight|pre-?flight|cockpit|exterior|interior|power ?-?up|normal|emergency|abnormal|engine fail|engine fire|fire)\b/;
const CTLW=/light|master|pump|switch|lever|gear|flaps?|brake|selector|heat|valve|throttle|mixture|magneto|beacon|strobe|avionic|alternator|generator|battery|transponder|trim|door|canopy|harness|belt/;
const clean=s=>String(s).replace(/\s+/g,' ').replace(/^[\s:–—-]+|[\s:–—-]+$/g,'').trim();
/* text -> {sections:[{t, emer, grp, items:[{c, r, mem}]}], n} */
function parse(text,o){
  o=o||{}; const sections=[]; let cur=null, mode='', grp='', pend=null, n=0, bare=null, head=null;
  const sec=t=>{ cur={t:clean(t).slice(0,90)||'Checklist',emer:false,grp,items:[]}; const f=fold(cur.t); cur.emer=mode==='emer'||EMER_T.test(f); sections.push(cur); return cur; };
  const add=(c,r,mem)=>{ if(!cur) sec(o.name||'Checklist'); c=clean(c); r=clean(r||''); if(!c||c.length>140) return null; if(cur.items.length>=200||n>=2000) return null; const it={c,r,mem:!!mem}; cur.items.push(it); n++; return it; };
  const lines=String(text==null?'':text).replace(/\r\n?/g,'\n').replace(/ /g,' ').split('\n');
  for(let raw of lines){
    let l=raw.replace(/\s+$/,''); const t0=l.trim(); if(!t0){ continue; }
    if(t0.length>220||JUNK.test(t0)) { pend=null; continue; }
    if(pend){ if(t0.length<=40&&!DOTEND.test(t0)){ add(pend.c,t0,pend.mem); pend=null; continue; } add(pend.c,'',pend.mem); pend=null; }
    let s=t0, md=false;
    const mh=s.match(/^#{1,6}\s+(.+)$/); if(mh){ s=mh[1]; md=true; }
    const mem=/^\*/.test(s)||/\((?:m|mem)\)|\[(?:m|mem)\]|\bmemory item/i.test(s);
    if(!md) s=s.replace(BUL,'').replace(/^\d{1,3}\s+(?=[A-Za-zÆØÅæøå])/,'');
    s=s.replace(/\((?:m|mem)\)|\[(?:m|mem)\]/ig,'').replace(/\*+$/,'').replace(/^(.*[A-Za-z)]{2,})\s+\d{1,3}$/,'$1').trim(); if(!s) continue;
    /* table layouts (PDF text): the response on its own line after the challenge */
    if(RONLY.test(s)&&s.length<=30){ if(bare){ bare.r=clean(s); bare=null; head=null; continue; }
      if(head){ sections.splice(sections.indexOf(head.s),1); cur=head.prev; const it=add(head.t,s,false); head=null; bare=null; continue; } }
    bare=null; const hd0=head; head=null;
    const f=fold(s).replace(/[:.]+$/,'').trim();
    const sep=DOTS.test(s)||EMD.test(s)||GAP.test(s)||DASH.test(s);
    const tm=s.match(TRAIL), capsHead=isCaps(s)&&s.length<=70&&s.split(/\s+/).length<=9&&(!tm||(HEADP.test(f)&&!CTLW.test(fold(tm[1]))));
    if(md||(!sep&&((/:$/.test(s)&&s.length<=70)||capsHead||(/\b(checklist|procedures?|sjekkliste|prosedyre)\b/i.test(s)&&s.length<=60&&!TRAIL.test(s))))){
      if(GRP_E.test(f)){ mode='emer'; grp=clean(s); cur=null; continue; }
      if(GRP_N.test(f)){ mode=''; grp=clean(s); cur=null; continue; }
      const prev=cur;
      if(cur&&!cur.items.length&&!(hd0&&hd0.s===cur)) sections.pop();
      sec(s.replace(/:$/,'')); if(capsHead&&!/:$/.test(s)) head={s:cur,prev,t:s}; continue; }
    let m;
    if((m=s.match(DOTEND))){ pend={c:m[1],mem}; continue; }
    if((m=s.match(DOTS))||(m=s.match(EMD))||(m=s.match(DASH))||(m=s.match(GAP))||(m=s.match(COLON))||(m=s.match(TRAIL))){ add(m[1],m[2],mem); continue; }
    if(/^\(|^note\b|^merk\b/i.test(s)&&cur&&cur.items.length){ continue; }
    bare=add(s,'',mem);
  }
  if(pend) add(pend.c,'',pend.mem);
  const out=sections.filter(x=>x.items.length);
  return {sections:out,n:out.reduce((a,x)=>a+x.items.length,0)};
}

/* ---------- control dictionary: challenge keywords -> response states -> predicate keys of the page ----------
   key: a string, an array (all must hold), or {B,L,R,A,O} by side (B both/unspecified, A affected engine, O live engine). */
const ON=/\bon\b|\bpa\b|engaged|\bin\b|\bset\b/, OFF=/\boff\b|\bav\b|disengag/;
const DICT={
 DA42:[
  {id:'engm',kw:/engine master|eng\w*\.? mstr|engine switch|motor ?master/,st:[[OFF,{B:'engsOff',A:'engAffOff',L:'engsOff',R:'engsOff'}],[ON,{B:['engLOn','engROn'],L:'engLOn',R:'engROn',A:'engAffOn'}]]},
  {id:'avio',kw:/avionic/,st:[[OFF,'avioOff'],[ON,'avioOn']]},
  {id:'elec',kw:/elect\w*\.? master|battery master|master switch|^master\b|hovedbryter|^bat\w*\b/,st:[[OFF,'elecOff'],[ON,'elecOn']]},
  {id:'emer',kw:/emergency switch|^emer\w*\b(?! gear)/,st:[[ON,'emerOn']]},
  {id:'pump',kw:/fuel pump|boost pump|aux\w* pump|drivstoffpumpe/,st:[[OFF,{B:'pumpsOff',A:'pumpAffOff'}],[ON,{B:'pumpsOn',A:'pumpAffOn',O:'pumpLiveOn'}]]},
  {id:'fsel',kw:/fuel (selector|valve|cock|shut)|drivstoffvelger/,st:[[/cross ?feed|x-?feed/,{B:'fselsX',A:'fselAffX'}],[/\boff\b|clos|\bav\b/,{B:'fselsOff',A:'fselAffOff'}],[/\bon\b|open|\bpa\b|normal/,{B:'fselsOn',A:'fselAffOn',O:'fselLiveOn'}]]},
  {id:'alt',kw:/alternator|generator|^alt\b(?! air)|\balt [lr]\b|altn/,st:[[OFF,{B:'altsOff',A:'altAffOff'}],[ON,{B:'altsOn',A:'altAffOn'}]]},
  {id:'land',kw:/landing light|ldg l|landingslys/,st:[[OFF,'landOff'],[ON,'landOn']]},
  {id:'strobe',kw:/strobe|beacon|anti-?coll|\bacl\b|antikollisjon/,st:[[OFF,'strobeOff'],[ON,'strobeOn']]},
  {id:'nav',kw:/nav\w* light|position light|posisjonslys|^nav\b/,st:[[ON,'navOn']]},
  {id:'pitot',kw:/pitot/,st:[[/then\b.*\boff\b|check\w*.*then/,'pitotCycle'],[OFF,'pitotOff'],[ON,'pitotOn']]},
  {id:'park',kw:/parking brake|park brake|parkeringsbrems/,st:[[/releas|\boff\b|\bav\b|\blos\b/,'parkOff'],[/\bset\b|\bon\b|engag|satt|\bpa\b/,'park']]},
  {id:'gear',kw:/(landing gear|^gear\b|gear (selector|lever|handle)|understell)(?!.*(warn|horn|light|test|indic))/,st:[[/\bdown\b|\bdn\b|3 green|three green|extend|\bned\b|nede/,'gear3'],[/\bup\b|retract|\bopp\b/,'gearUp']]},
  {id:'flaps',kw:/\bflaps?\b/,st:[[/\bup\b|\b0\b|retract|\bopp\b/,'flapsUp'],[/\bapp|t\/o|take-?off/,'flapsApp'],[/\bldg\b|landing|full|down/,'flapsLdg']]},
  {id:'pwr',kw:/power lever|throttle|thrust lever|effekthendel|^power\b/,st:[[/\bidle\b/,{B:'idle',A:'pwrAffIdle'}],[/\bmax|full|take-?off|100 ?%/,{B:'pwrMax',O:'pwrMaxLive'}]]},
  {id:'ecu',kw:/ecu test/,any:{B:['ecuL','ecuR'],L:'ecuL',R:'ecuR'}},
  {id:'voter',kw:/voter/,st:[[/auto/,{B:'votersAuto',A:'voterAffAuto'}]]},
  {id:'rtrim',kw:/rudder trim|directional trim|sideror-?trim/,st:[[/neutral|centre|center|\b0\b/,'rudTrim0']]},
  {id:'trim',kw:/elevator trim|pitch trim|^trim\b|hoyderortrim/,st:[[/t\/o|take-?off|\bset\b/,'trimTO']]},
  {id:'altair',kw:/alternate air|alt\.? air/,st:[[/open/,'altAirOpen'],[/clos/,'altAirClosed']]},
  {id:'heat',kw:/cabin heat|heater|defrost|kabinvarme/,st:[[OFF,'heatOff'],[ON,'heatOn']]},
  {id:'firet',kw:/fire (detect|warn|test)|gear warning.*fire/,any:'fireTest'},
  {id:'cb',kw:/circuit breaker|\bc\/?bs?\b|sikring/,any:'cbsIn'},
  {id:'ap',kw:/autopilot|^a\/?p\b/,st:[[/off|disc|disengag/,'apOff']]},
  {id:'backup',kw:/display backup|reversion/,any:'backup'},
  {id:'glow',kw:/glow/,any:{B:['glowL','glowR'],L:'glowL',R:'glowR'}},
  {id:'start',kw:/start key|starter|^start\b/,any:{B:['runL','runR'],L:'runL',R:'runR'}},
  {id:'elt',kw:/\belt\b/,any:'eltOff'},
  {id:'gemer',kw:/emergency gear|manual (gear )?extension|gear emer/,any:'gearEmer'}
 ],
 C172:[
  {id:'master',kw:/master|^battery|^bat\b|hovedbryter/,st:[[OFF,'masterOff'],[ON,'masterOn']]},
  {id:'alt',kw:/alternator|^alt\b(?! air)/,st:[[OFF,'altOff'],[ON,'altOn']]},
  {id:'avio',kw:/avionic/,st:[[OFF,'avioOff'],[ON,'avioOn']]},
  {id:'fsel',kw:/fuel (selector|valve|shut)|drivstoffvelger/,st:[[/both|begge/,'fuelBoth'],[/\boff\b|clos|\bav\b/,'fuelOff']]},
  {id:'mix',kw:/mixture|blanding/,st:[[/cut ?off|idle cut/,'mixCut'],[/rich|\brik\b/,'mixRich'],[/lean/,'mixLean']]},
  {id:'carb',kw:/carb\w* heat|forgasservarme/,st:[[/cold|\boff\b|kald|\bin\b|\bav\b/,'carbOff'],[/hot|\bon\b|varm|\bpa\b/,'carbOn']]},
  {id:'thr',ord:1,kw:/throttle|^gass\b/,st:[[/1\/4|¼|quarter|1 cm|crack/,'thrCrack'],[/idle|close|tomgang/,'thrIdle'],[/full|max|open/,'thrFull']]},
  {id:'primer',kw:/primer/,st:[[/in|lock|lukk|inne|last/,'primerIn']]},
  {id:'bcn',kw:/beacon|anti-?coll|antikollisjon/,st:[[OFF,'bcnOff'],[ON,'bcnOn']]},
  {id:'strobe',kw:/strobe/,st:[[OFF,'strobeOff'],[ON,'strobeOn']]},
  {id:'land',kw:/landing light|landingslys/,st:[[OFF,'landOff'],[ON,'landOn']]},
  {id:'taxi',kw:/taxi light|takselys/,st:[[OFF,'taxiOff'],[ON,'taxiOn']]},
  {id:'nav',kw:/nav\w* light|position light|posisjonslys/,st:[[OFF,'navOff'],[ON,'navOn']]},
  {id:'pitot',kw:/pitot/,st:[[OFF,'pitotOff'],[ON,'pitotOn']]},
  {id:'flaps',kw:/\bflaps?\b/,st:[[/\bup\b|\b0\b|retract|\bopp\b/,'flap0'],[/\b10\b/,'flap1'],[/\b20\b/,'flap2'],[/full|\b30\b|\b40\b/,'flap3'],[/take-?off|t\/o|\bset\b/,'flapTO']]},
  {id:'park',kw:/parking brake|parkeringsbrems/,st:[[/releas|\boff\b|\blos\b/,'parkOff'],[/\bset\b|\bon\b|satt/,'parkOn']]},
  {id:'mag',kw:/magneto|ignition|^mags?\b|tenning/,st:[[/start/,'magStart'],[/both|begge/,'magBoth'],[/\boff\b|\bav\b/,'magOff']]},
  {id:'xp',kw:/transponder|xpdr/,st:[[/stby|standby/,'xpSby'],[/\balt\b|mode c|\bon\b/,'xpAlt']]},
  {id:'alt2',kw:/altimeter|\bqnh\b|hoydemaler/,st:[[/set|still|\bqnh\b|checked/,'baroSet']],any:'baroSet'},
  {id:'dg',kw:/heading ind|directional gyro|^dg\b|^di\b|kursgyro/,any:'dgSet'},
  {id:'cb',kw:/circuit breaker|sikring/,any:'cbIn'},
  {id:'trim',kw:/trim/,st:[[/take-?off|t\/o|\bset\b/,'trimTO']]}
 ],
 B200:[
  {id:'bat',kw:/battery|^bat\b/,st:[[OFF,'batOff'],[ON,'batOn']]},
  {id:'gen',kw:/generator|^gen\b/,st:[[OFF,{B:'gensOff',A:'genAffOff'}],[/\bon\b|reset/,'gensOn']]},
  {id:'avio',kw:/avionic/,st:[[OFF,'avioOff'],[ON,'avioOn']]},
  {id:'inv',kw:/inverter/,st:[[ON,'invOn']]},
  {id:'bcn',kw:/beacon|anti-?coll/,st:[[OFF,'bcnOff'],[ON,'bcnOn']]},
  {id:'strobe',kw:/strobe/,st:[[OFF,'strobeOff'],[ON,'strobeOn']]},
  {id:'land',kw:/landing light/,st:[[OFF,'landOff'],[ON,'landOn']]},
  {id:'recog',kw:/recog/,st:[[ON,'recogOn']]},
  {id:'pitot',kw:/pitot/,st:[[OFF,'pitotOff'],[ON,'pitotOn']]},
  {id:'af',kw:/auto ?-?feather/,st:[[/test/,'afTest'],[/arm/,'afArm'],[OFF,'afOff']]},
  {id:'aign',kw:/auto ?-?ign/,st:[[/arm|\bon\b/,'aignOn'],[OFF,'aignOff']]},
  {id:'yd',kw:/yaw damp/,st:[[ON,'ydOn'],[OFF,'ydOff']]},
  {id:'cond',kw:/condition/,st:[[/cut ?off/,{B:'condCut',A:'condAffCut'}],[/low idle/,'condLow'],[/high idle/,'condHigh']]},
  {id:'prop',kw:/prop\w*( lever)?s?\b(?! sync)|propellhendel/,st:[[/feather/,{B:'propAffFeather',A:'propAffFeather'}],[/full|forward|high|max|fram|frem/,{B:'propsFull',O:'propLiveFull'}]]},
  {id:'pwr',kw:/power lever|effekthendel/,st:[[/idle/,{B:'pwrIdle',A:'pwrAffIdle'}],[/take-?off|max|full/,'pwrTO']]},
  {id:'fw',kw:/firewall|fuel shut ?off valve|brannskott/,st:[[/clos|\boff\b/,{B:'fwAffClosed',A:'fwAffClosed'}],[/open/,'fwOpen']]},
  {id:'xfeed',kw:/cross ?feed|x-?feed/,st:[[OFF,'xfeedOff']]},
  {id:'park',kw:/parking brake|parkeringsbrems/,st:[[/releas|\boff\b|\blos\b/,'parkOff'],[/\bset\b|\bon\b/,'parkOn']]},
  {id:'flaps',kw:/\bflaps?\b/,st:[[/\bup\b|retract/,'flapsUp'],[/approach|\bapp/,'flapsApp'],[/down|full|ldg|landing/,'flapsDn']]},
  {id:'gear',kw:/(landing gear|^gear\b|understell)(?!.*(warn|horn|light|test))/,st:[[/down|\bdn\b|green|extend/,'gearDown'],[/\bup\b|retract/,'gearUp']]},
  {id:'ext',kw:/extinguish|slukker/,any:'extAff'},
  {id:'bleed',kw:/bleed/,st:[[/open|\bon\b/,'bleedOpen'],[OFF,'bleedOff']]},
  {id:'mask',kw:/mask|oxygen|oksygen/,st:[[ON,'maskOn'],[/100/,'maskOn']]},
  {id:'ap',kw:/autopilot/,st:[[/off|disc|disengag/,'apOff']]},
  {id:'sync',kw:/sync/,st:[[OFF,'syncOff']]}
 ]
};
function sideOf(c){ const f=fold(c), w=f.split(/[^a-z0-9]+/);
  if(/\b(affected|failed|dead|inop\w*|defective|sviktende|feilende)\b|\(fail|\bdod\b/.test(f)) return 'A';
  if(/\b(live|operating|operative|good|working|levende)\b/.test(f)) return 'O';
  if(/\b(both|all|begge|alle)\b/.test(f)) return 'B';
  if(w.includes('l')||w.includes('lh')||w.includes('left')||w.includes('venstre')) return 'L';
  if(w.includes('r')||w.includes('rh')||w.includes('right')||w.includes('hoyre')) return 'R';
  return 'B'; }
const pick=(k,side)=>k&&typeof k==='object'&&!Array.isArray(k)?(k[side]||k.B||null):k;
/* item -> {id, key} | null */
function mapItem(type,it){ const D=DICT[type]; if(!D||!it) return null;
  const fc=fold(it.c).replace(/\s+/g,' ').trim(); let fr=fold(it.r).replace(/\s+/g,' ').trim(); const th=fr.match(/\bthen\b(.+)$/); const side=sideOf(it.c);
  for(const e of D){ if(!e.kw.test(fc)) continue;
    let best=null, bi=1e9;
    if(e.st){ const fr2=th&&!(e.id==='pitot')?th[1]:fr; for(const [re,k] of e.st){ const m=fr2.match(re); if(m&&m.index<bi){ bi=m.index; best=k; if(e.ord) break; } } }
    if(best==null&&e.any) best=e.any;
    const key=pick(best,side); return key?{id:e.id+(side==='L'||side==='R'||side==='A'||side==='O'?side:''),key}:null; }
  return null; }

/* ---------- emergency section for a failure kind ---------- */
const ENGF=/(engine|motor|eng)\w*\s*(fail|failure|out|inop|stans|stopp|svikt|loss|cut)|motorstans|motorsvikt|motorstopp|engine failure/;
const FK={
 efato:[/(engine|motor)\w* ?(fail|failure|out|stans|stopp|svikt)\w*.*(after|during|etter|under).*(take|lift|t\/o|avgang|loft|initial climb)|efato|(after|etter) (take-?off|lift-?off|avgang).*(engine|motor)/,ENGF],
 efrun:[/take-?off run|take-?off roll|ground roll|startrull|abort|reject|before v|stopping/,ENGF],
 efflt:[/(engine|motor).*(fail|out|stans|svikt).*(flight|cruise|lufta|marsj)|in-?flight.*engine/,ENGF],
 eng:[ENGF],
 fire_air:[/fire.*(flight|airborne|lufta)|(flight|lufta).*fire|brann i lufta/,/engine fire|motorbrann/,/\bfire\b|brann/],
 fire_gnd:[/fire.*(ground|start|bakken)|ground.*fire|brann.*bakken/,/engine fire|motorbrann/,/\bfire\b|brann/],
 alt:[/alternator|generator|low volt|altn/,/electric|elektrisk/],
 ecu:[/\becu\b|fadec/],
 gear:[/gear.*(unsafe|fail|not|manual|emergency|extension)|(emergency|manual).*gear|understell.*(svikt|manuell|nod)/,/landing gear|understell/],
 pfd:[/\bpfd\b|display|screen|skjerm/],
 vac:[/vacuum|suction|vakuum/],
 carb:[/carb\w* ic|forgasseris/,/icing|ising/],
 press:[/pressuri|decompress|emergency descent|kabintrykk|trykkfall|nodnedstigning/]
};
function matchSection(sections,kind){ const L=FK[kind]; if(!L||!sections) return -1;
  for(const re of L){ for(const pref of [true,false]){ const i=sections.findIndex(s=>s.emer===pref&&re.test(fold(s.t))); if(i>=0) return i; } }
  return -1; }

/* ---------- storage ---------- */
const KEY='bb-ownck', TKEY='bb-ownck-text', BIG='bb-ownck-big', MAXC=400000;
const lsGet=(k,d)=>{ try{ const v=JSON.parse(localStorage.getItem(k)); return v==null?d:v; }catch(e){ return d; } };
const lsSet=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } };
const idx=()=>lsGet(KEY,{})||{};
function getRec(type){ const r=idx()[type]; return r&&r.src?r:null; }
function setRec(type,rec){ const o=idx(); if(rec) o[type]=rec; else delete o[type]; lsSet(KEY,o); }
function cacheGet(type){ const c=(lsGet(TKEY,{})||{})[type]; return c&&typeof c.text==='string'?c:null; }
function cacheSet(type,v){ const o=lsGet(TKEY,{})||{}; if(v) o[type]=v; else delete o[type]; if(!lsSet(TKEY,o)&&v){ delete o[type]; lsSet(TKEY,o); } }

/* ---------- My Workspace (read only; same IndexedDB stores and schemas as workspace.js) ---------- */
function idb(name,up){ return new Promise(res=>{ try{ const r=indexedDB.open(name,1); r.onupgradeneeded=()=>up(r.result); r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); r.onblocked=()=>res(null); }catch(e){ res(null); } }); }
const rq=r=>new Promise((res,rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
const WSUP=db=>{ db.createObjectStore('items',{keyPath:'id'}); db.createObjectStore('kv'); db.createObjectStore('trashdocs',{keyPath:'id'}); };
const FIUP=db=>{ db.createObjectStore('docs',{keyPath:'id'}); db.createObjectStore('blobs',{keyPath:'id'}); };
let dbW=null, dbF=null;
async function wsItems(){ if(!dbW) dbW=await idb('birdbird-workspace',WSUP); if(dbW){ try{ return await rq(dbW.transaction('items').objectStore('items').getAll()); }catch(e){} }
  const o=lsGet('bb-ws-items',{})||{}; return Object.values(o); }
async function fiDoc(id){ if(!dbF) dbF=await idb('naeroson-fi',FIUP); if(!dbF) return null; try{ return await rq(dbF.transaction('docs').objectStore('docs').get(id)); }catch(e){ return null; } }
async function fiKeys(){ if(!dbF) dbF=await idb('naeroson-fi',FIUP); if(!dbF) return []; try{ return await rq(dbF.transaction('docs').objectStore('docs').getAllKeys()); }catch(e){ return []; } }
const live=it=>!!it&&!it.deletedAt&&!it.gone;
const htmlText=h=>String(h==null?'':h).replace(/<(br|\/p|\/div|\/li|\/h\d|\/blockquote)\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
function pagesText(chunks){ const OV=150; let out='', p=null; (chunks||[]).forEach(c=>{ if(c.p!==p){ out+=(out?'\n\n':'')+c.t; p=c.p; } else out+=String(c.t).slice(OV); }); return out; }
async function wsList(){ const items=await wsItems(), here=new Set(await fiKeys());
  const docs=items.filter(it=>live(it)&&it.kind==='doc'&&(it.cat==='chk'||it.cat==='sop')).map(d=>({src:'doc',id:d.id,name:d.name||'',cat:d.cat,here:here.has(d.id)}));
  const notes=items.filter(it=>live(it)&&it.kind==='note').sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,40).map(n=>({src:'note',id:n.id,name:(n.title||'').trim(),here:true}));
  return docs.sort((a,b)=>(a.cat===b.cat?0:a.cat==='chk'?-1:1)||a.name.localeCompare(b.name)).concat(notes); }
async function wsText(src,id){
  if(src==='doc'){ const d=await fiDoc(id); return d&&d.chunks&&d.chunks.length?pagesText(d.chunks):null; }
  if(src==='note'){ const it=(await wsItems()).find(x=>x.id===id); return it&&live(it)?((it.title?'# '+it.title+'\n':'')+htmlText(it.body)):null; }
  return null; }

/* ---------- drawer panel ---------- */
const TX={
  title:T('My checklist','Min sjekkliste'),use:T('Add checklist','Legg til sjekkliste'),
  useSub:T("Add your school's checklist in My Workspace.",'Legg inn skolens sjekkliste i Mitt arbeidsområde.'),
  fromWs:T('From My Workspace','Fra Mitt arbeidsområde'),paste:T('Paste text','Lim inn tekst'),pasteH:T('Paste the checklist here — one item per line, e.g. “Fuel pump ..... ON”. Headings in capitals start a new section.','Lim inn sjekklisten her — ett punkt per linje, f.eks. «Fuel pump ..... ON». Overskrifter med store bokstaver starter en ny seksjon.'),
  name:T('Name','Navn'),ok:T('Use this checklist','Bruk denne sjekklisten'),cancel:T('Cancel','Avbryt'),change:T('Change','Bytt'),remove:T('Stop using','Slutt å bruke'),
  none:T('No checklists or SOPs in My Workspace yet. Add one there (category Checklists or SOP), or paste the text.','Ingen sjekklister eller SOP-er i Mitt arbeidsområde ennå. Legg til en der (kategori Sjekklister eller SOP), eller lim inn teksten.'),
  notHere:T('not on this device','ikke på denne enheten'),loading:T('Loading…','Laster …'),
  missing:T('The checklist is not on this device. Add the file in My Workspace here, or pick another.','Sjekklisten finnes ikke på denne enheten. Legg til filen i Mitt arbeidsområde her, eller velg en annen.'),
  empty:T('No checklist items were found in this text.','Fant ingen sjekklistepunkter i denne teksten.'),
  normal:T('Normal','Normal'),emer:T('Emergency and abnormal','Nød og unormalt'),
  reset:T('Clear ticks','Fjern kryss'),score:T('Score against my checklist','Vurder etter min sjekkliste'),big:T('Large text','Stor tekst'),
  hint:T('Ticks itself when the trainer sees the control set; tap any item to tick it. Any order.','Krysses av når treneren ser at bryteren er satt; trykk på et punkt for å krysse av. Valgfri rekkefølge.'),
  auto:T('auto','auto'),note:T('note','notat'),doc:T('document','dokument')
};
const CSS=`
.ock{margin:0 0 10px;border:1px solid #2a3139;border-radius:10px;background:#12171c;color:#e6ebef;font:500 12.5px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}
.ock>.hd{display:flex;align-items:center;gap:6px;padding:8px 10px;cursor:pointer;user-select:none}.ock>.hd b{font:700 10.5px system-ui;letter-spacing:.08em;text-transform:uppercase;color:#8e9aa5}
.ock>.hd span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dfe5ea}.ock>.hd i{font-style:normal;color:#7d8a95}
.ock .bd{padding:0 10px 10px}.ock .bd.one{display:flex;gap:8px;align-items:center;padding:8px 10px}.ock .bd.one .sub{flex:1;margin:0;font-size:12px}.ock .sub{color:#9aa7b2;font-size:11.5px;margin:0 0 8px}
.ock button.b{font:600 12px system-ui;padding:6px 10px;border-radius:7px;border:1px solid #333a42;background:#1b2026;color:#dfe5ea;cursor:pointer}.ock button.b:hover{border-color:#7fcbe8}
.ock button.pri{background:#e8edf1;color:#0d1319;border-color:#e8edf1}.ock .row2{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.ock .wl{list-style:none;margin:4px 0 8px;padding:0;max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:3px}
.ock .wl button{width:100%;text-align:left;font:600 12px system-ui;padding:7px 9px;border-radius:7px;border:1px solid #262c33;background:#161b20;color:#e6ebef;cursor:pointer;display:flex;gap:8px}.ock .wl button small{margin-left:auto;color:#7d8a95;font-weight:500}
.ock .wl button[disabled]{opacity:.5;cursor:default}
.ock textarea,.ock input[type=text]{width:100%;box-sizing:border-box;font:500 12.5px ui-monospace,monospace;padding:7px 8px;border-radius:7px;border:1px solid #333a42;background:#0d1115;color:#fff}.ock textarea{min-height:120px;resize:vertical}
.ock select{width:100%;font:600 12.5px system-ui;padding:6px 8px;border-radius:7px;border:1px solid #333a42;background:#0d1115;color:#fff;margin:0 0 6px}
.ock .al{border-left:3px solid #ff5a47;padding:3px 8px;margin:0 0 6px;font:800 12px system-ui;letter-spacing:.03em;color:#ffc9c1}
.ock ul.it{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.ock ul.it li{display:flex;gap:8px;align-items:flex-start;padding:6px 7px;border-radius:7px;border:1px solid transparent;cursor:pointer}
.ock ul.it li>i{flex:0 0 18px;height:18px;border-radius:50%;border:1.5px solid #4a5560;font:700 10px/15px system-ui;text-align:center;font-style:normal;color:#8e9aa5}
.ock ul.it li.ok>i{background:#3cdc6e;border-color:#3cdc6e;color:#0d1319}.ock ul.it li.ok{color:#9aa7b2}
.ock ul.it li.now{border-color:#7fcbe8;background:#162531}.ock ul.it li .r{color:#fff;font-weight:700}.ock ul.it li.ok .r{color:#9aa7b2}
.ock ul.it li .a{font:700 9px system-ui;letter-spacing:.05em;color:#7fcbe8;margin-left:6px;vertical-align:1px;text-transform:uppercase}
.ock ul.it li.mem{border-left:3px solid #ff5a47}
.ock .ft{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:8px;font-size:11.5px;color:#9aa7b2}.ock .ft label{display:flex;gap:5px;align-items:center}
.ock.big{font-size:15px}.ock.big ul.it li{padding:9px 9px;font-size:15px}.ock.big ul.it li>i{flex-basis:22px;height:22px;font-size:12px;line-height:19px}
`;
let cssOn=false; function css(){ if(cssOn||typeof document==='undefined') return; cssOn=true; const s=document.createElement('style'); s.textContent=CSS; document.head.appendChild(s); }

/* o: {type, box, L, pred(key)->bool, ctl(key)->id, hl(id|null), clock()->sim s, onChange()} */
function mount(o){
  css(); const L=o.L, type=o.type, box=o.box;
  const st={rec:getRec(type),P:null,sec:0,open:true,ui:'',ticks:{},acc:0,alert:'',list:null,big:lsGet(BIG,0)===1,lastHl:null,err:''};
  const root=document.createElement('div'); root.className='ock'+(st.big?' big':''); box.appendChild(root);
  const sections=()=>st.P?st.P.sections:[];
  function setText(text,name){ const P=parse(text,{name}); st.P=P; st.err=P.n?'':'empty';
    P.sections.forEach(s=>s.items.forEach(it=>{ it.m=mapItem(type,it); })); if(st.sec>=P.sections.length) st.sec=0; }
  async function load(){ const r=st.rec; st.P=null; st.err=''; if(!r){ render(); return; }
    const c=cacheGet(type); if(c&&c.src===r.src&&c.id===(r.id||'')){ setText(c.text,r.name); render(); if(o.onChange) o.onChange(); return; }
    if(r.src==='paste'){ st.err='missing'; render(); return; }
    st.ui='loading'; render(); let tx=null; try{ tx=await wsText(r.src,r.id); }catch(e){}
    st.ui=''; if(tx==null){ st.err='missing'; render(); return; }
    if(tx.length<=MAXC) cacheSet(type,{src:r.src,id:r.id||'',text:tx}); setText(tx,r.name); render(); if(o.onChange) o.onChange(); }
  function choose(rec,text){ st.rec=rec; setRec(type,rec); st.ticks={}; st.sec=0; st.ui=''; st.open=true;
    if(text!=null){ cacheSet(type,{src:rec.src,id:rec.id||'',text}); setText(text,rec.name); render(); if(o.onChange) o.onChange(); } else { cacheSet(type,null); load(); } }
  const k=(si,ii)=>si+':'+ii;
  const curIdx=()=>{ const s=sections()[st.sec]; if(!s) return -1; return s.items.findIndex((x,i)=>!st.ticks[k(st.sec,i)]); };
  function hl(){ if(!o.hl) return; let id=null; const s=sections()[st.sec], i=curIdx(); if(st.open&&s&&i>=0&&s.items[i].m&&o.ctl){ const kk=s.items[i].m.key; id=o.ctl(Array.isArray(kk)?kk[0]:kk)||null; }
    if(id!==st.lastHl){ st.lastHl=id; o.hl(id); } }
  function itemsHTML(){ const s=sections()[st.sec]; if(!s) return ''; const ci=curIdx();
    return `<ul class="it">${s.items.map((it,i)=>{ const d=st.ticks[k(st.sec,i)]; return `<li data-oi="${i}" class="${d?'ok':''}${i===ci?' now':''}${it.mem?' mem':''}"><i>${d?'✓':i+1}</i><span>${esc(it.c)}${it.r?` — <span class="r">${esc(it.r)}</span>`:''}${it.m?`<span class="a" title="${esc(L(TX.hint))}">${esc(L(TX.auto))}</span>`:''}</span></li>`; }).join('')}</ul>`; }
  function render(){
    const ta=root.querySelector('[data-opaste]'), nm=root.querySelector('[data-oname]'), keep=ta?[ta.value,nm?nm.value:'']:null;
    draw(); if(keep&&st.ui==='pick'){ const t=root.querySelector('[data-opaste]'), n=root.querySelector('[data-oname]'); if(t) t.value=keep[0]; if(n) n.value=keep[1]; } } // text being pasted survives a redraw (list loaded, language)
  function draw(){
    const r=st.rec; let h='';
    const name=r?(r.name||L(TX.title)):'';
    if(!r&&st.ui!=='pick'){ root.innerHTML=`<div class="bd one"><p class="sub">${esc(L(TX.useSub))}</p><button type="button" class="b" data-opick>${esc(L(TX.use))}</button></div>`; root.className='ock'; hl(); return; }
    h+=`<div class="hd" data-ohd><b>${esc(L(TX.title))}</b><span>${esc(name)}</span><i>${st.open?'▾':'▸'}</i></div>`;
    if(!st.open){ root.innerHTML=h; root.className='ock'+(st.big?' big':''); hl(); return; }
    h+='<div class="bd">';
    if(st.ui==='pick'){
      h+=`<p class="sub">${esc(L(TX.fromWs))}</p>`;
      if(st.list==null) h+=`<p class="sub">${esc(L(TX.loading))}</p>`;
      else if(!st.list.length) h+=`<p class="sub">${esc(L(TX.none))}</p>`;
      else h+=`<ul class="wl">${st.list.map((d,i)=>`<li><button type="button" data-ows="${i}"${d.here?'':' disabled'}><span>${esc(d.name||'—')}</span><small>${esc(d.here?L(d.src==='note'?TX.note:TX.doc):L(TX.notHere))}</small></button></li>`).join('')}</ul>`;
      h+=`<p class="sub">${esc(L(TX.paste))}</p><textarea data-opaste placeholder="${esc(L(TX.pasteH))}" aria-label="${esc(L(TX.paste))}"></textarea>
        <div class="row2"><input type="text" data-oname placeholder="${esc(L(TX.name))}" aria-label="${esc(L(TX.name))}" style="flex:1"><button type="button" class="b pri" data-ouse>${esc(L(TX.ok))}</button><button type="button" class="b" data-ocancel>${esc(L(TX.cancel))}</button></div>`;
    } else if(st.ui==='loading'){ h+=`<p class="sub">${esc(L(TX.loading))}</p>`; }
    else if(st.err){ h+=`<p class="sub">${esc(L(st.err==='empty'?TX.empty:TX.missing))}</p><div class="row2"><button type="button" class="b" data-opick>${esc(L(TX.change))}</button><button type="button" class="b" data-ooff>${esc(L(TX.remove))}</button></div>`; }
    else {
      const S=sections(), nrm=S.map((s,i)=>[s,i]).filter(x=>!x[0].emer), em=S.map((s,i)=>[s,i]).filter(x=>x[0].emer);
      const opt=([s,i])=>`<option value="${i}"${i===st.sec?' selected':''}>${esc(s.t)}</option>`;
      h+=`<select data-osec aria-label="${esc(L(TX.title))}">${nrm.length&&em.length?`<optgroup label="${esc(L(TX.normal))}">${nrm.map(opt).join('')}</optgroup><optgroup label="${esc(L(TX.emer))}">${em.map(opt).join('')}</optgroup>`:S.map((s,i)=>opt([s,i])).join('')}</select>`;
      if(st.alert&&S[st.sec]&&S[st.sec].emer) h+=`<div class="al" role="alert">${esc(st.alert)}</div>`;
      h+=`<div data-oitems>${itemsHTML()}</div>`;
      h+=`<div class="ft"><label><input type="checkbox" data-oscore${r.score?' checked':''}> ${esc(L(TX.score))}</label><span class="row2" style="margin:0"><button type="button" class="b" data-obig aria-pressed="${st.big}" title="${esc(L(TX.big))}" aria-label="${esc(L(TX.big))}">Aa</button><button type="button" class="b" data-oreset>${esc(L(TX.reset))}</button><button type="button" class="b" data-opick>${esc(L(TX.change))}</button></span></div>`;
      h+=`<p class="sub" style="margin:6px 0 0">${esc(L(TX.hint))}</p>`;
    }
    h+='</div>'; root.innerHTML=h; root.className='ock'+(st.big?' big':''); hl(); }
  function redrawItems(){ const b=root.querySelector('[data-oitems]'); if(b){ b.innerHTML=itemsHTML(); const n=b.querySelector('li.now'); if(n&&n.scrollIntoView&&root.offsetParent) n.scrollIntoView({block:'nearest'}); } hl(); }
  function tick1(si,ii,v,auto){ const kk=k(si,ii); if(v) st.ticks[kk]={tm:o.clock?o.clock():0,auto:!!auto}; else delete st.ticks[kk]; }
  root.addEventListener('click',async e=>{ const t=e.target;
    if(t.closest('[data-ohd]')){ st.open=!st.open; render(); return; }
    const li=t.closest('li[data-oi]'); if(li){ const i=+li.dataset.oi; tick1(st.sec,i,!st.ticks[k(st.sec,i)],false); redrawItems(); return; }
    const b=t.closest('button'); if(!b) return; const d=b.dataset;
    if('opick' in d){ st.ui='pick'; st.list=null; render(); try{ st.list=await wsList(); }catch(x){ st.list=[]; }
      if(st.ui==='pick') render(); return; }
    if('ocancel' in d){ st.ui=''; render(); return; }
    if('ooff' in d){ st.rec=null; setRec(type,null); cacheSet(type,null); st.P=null; st.err=''; render(); if(o.onChange) o.onChange(); return; }
    if(d.ows!=null){ const w=st.list&&st.list[+d.ows]; if(!w) return; choose({src:w.src,id:w.id,name:w.name||L(TX.title),score:st.rec&&st.rec.score?1:0}); return; }
    if('ouse' in d){ const tx=root.querySelector('[data-opaste]').value; if(!tx.trim()) return; const nm=root.querySelector('[data-oname]').value.trim()||(parse(tx).sections[0]||{}).t||L(TX.title);
      choose({src:'paste',id:'',name:nm.slice(0,80),score:st.rec&&st.rec.score?1:0},tx.slice(0,MAXC)); return; }
    if('oreset' in d){ Object.keys(st.ticks).forEach(x=>{ if(x.split(':')[0]==String(st.sec)) delete st.ticks[x]; }); redrawItems(); return; }
    if('obig' in d){ st.big=!st.big; lsSet(BIG,st.big?1:0); render(); return; } });
  root.addEventListener('change',e=>{ const t=e.target;
    if(t.matches('[data-osec]')){ st.sec=+t.value; st.alert=''; render(); return; }
    if(t.matches('[data-oscore]')&&st.rec){ st.rec.score=t.checked?1:0; setRec(type,st.rec); } });
  const ok=key=>{ try{ return Array.isArray(key)?key.every(x=>!!o.pred(x)):!!o.pred(key); }catch(e){ return false; } };
  const api={
    /* called from the page's step tick; cheap: returns at once except 4 times a second */
    tick(dt){ if(!st.P||!st.open||st.err) return; st.acc+=dt; if(st.acc<0.25) return; st.acc=0;
      const s=st.P.sections[st.sec]; if(!s) return; const seen=new Set(); let ch=false;
      for(let i=0;i<s.items.length;i++){ const it=s.items[i], m=it.m; if(!m) continue; if(seen.has(m.id)) continue; seen.add(m.id);
        if(st.ticks[k(st.sec,i)]) continue; if(ok(m.key)){ tick1(st.sec,i,true,true); ch=true; } }
      if(ch) redrawItems(); },
    /* a failure happened: open the student's matching emergency section if there is one */
    failure(kind,alert){ if(!st.P) return false; let i=-1; for(const kk of [].concat(kind)){ i=matchSection(st.P.sections,kk); if(i>=0) break; } if(i<0) return false;
      st.sec=i; st.open=true; st.ui=''; st.alert=alert||''; Object.keys(st.ticks).forEach(x=>{ if(x.split(':')[0]==String(i)) delete st.ticks[x]; }); render(); return true; },
    open(i){ if(!st.P||!st.P.sections[i]) return; st.sec=i; st.open=true; st.ui=''; st.alert=''; render(); if(root.scrollIntoView) root.scrollIntoView({block:'nearest'}); },
    emer(){ return st.P&&!st.err?st.P.sections.map((s,i)=>({i,t:s.t,e:s.emer})).filter(x=>x.e):[]; },
    has(kind){ if(!st.P) return false; for(const kk of [].concat(kind)) if(matchSection(st.P.sections,kk)>=0) return true; return false; },
    get active(){ return !!(st.P&&!st.err&&st.P.n); },
    reset(){ st.ticks={}; st.alert=''; if(st.P) redrawItems(); },
    render, setText,
    report(){ if(!st.P||!st.rec) return null; const used=new Set(Object.keys(st.ticks).map(x=>+x.split(':')[0])); used.add(st.sec); const items=[];
      [...used].sort((a,b)=>a-b).forEach(si=>{ const s=st.P.sections[si]; if(!s) return; s.items.forEach((it,i)=>{ const d=st.ticks[k(si,i)]; const tt=it.c+(it.r?' — '+it.r:''); items.push({t:{en:tt,no:tt},st:d?1:0,tm:d?d.tm:null}); }); });
      return {name:st.rec.name||'',score:!!st.rec.score,items}; }
  };
  /* after the page's own script has run (the page's helpers may be declared further down) */
  Promise.resolve().then(load);
  return api;
}

const API={parse,mapItem,matchSection,sideOf,fold,DICT,FK,mount,getRec,setRec,css,KEY,TKEY,wsList,wsText};
if(typeof module!=='undefined'&&module.exports) module.exports=API;
G.OWNCK=API;
})(typeof window!=='undefined'?window:globalThis);
