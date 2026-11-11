/* Birdbird – radio trainer engine (no DOM, no AI).
   1. norm(): typed or spoken radio calls -> canonical tokens ("one two one decimal seven" -> 121.7, "flight level eight zero",
      "niner", "tree", "fife", phonetic letters -> letters, "three thousand five hundred" -> 3500).
   2. grade(): element-by-element check of a call or readback (callsign, runway, altitude/level with the right reference,
      heading and turn, squawk, frequency, QNH, holding point, hold short, fixes, conditional clearances, phrases).
      Order of the elements is free. Phraseology flags (repeat, yes, affirmative, ready for take-off, roger as readback …).
   3. Session: a deterministic state machine that runs a scenario (controller transmissions from templates, readback
      correction "negative, I say again …", say again / standby handling, retries, scoring, per-element statistics).
   4. spoken(): controller text -> ICAO pronunciation for speech synthesis.
   5. SRS: small Leitner boxes for "practise these again".
   Scenarios live in radioscen.js (training data, fictional aerodromes). Shared by radio-drills.html and the tests. */
(function(G){
'use strict';

/* ---------------- small helpers ---------------- */
const PH={alfa:'a',alpha:'a',bravo:'b',charlie:'c',charly:'c',delta:'d',echo:'e',foxtrot:'f',golf:'g',hotel:'h',india:'i',juliett:'j',juliet:'j',kilo:'k',lima:'l',mike:'m',november:'n',oscar:'o',papa:'p',quebec:'q',romeo:'r',sierra:'s',tango:'t',uniform:'u',victor:'v',whiskey:'w',whisky:'w',xray:'x',yankee:'y',zulu:'z'};
const PHW={a:'Alfa',b:'Bravo',c:'Charlie',d:'Delta',e:'Echo',f:'Foxtrot',g:'Golf',h:'Hotel',i:'India',j:'Juliett',k:'Kilo',l:'Lima',m:'Mike',n:'November',o:'Oscar',p:'Papa',q:'Quebec',r:'Romeo',s:'Sierra',t:'Tango',u:'Uniform',v:'Victor',w:'Whiskey',x:'X-ray',y:'Yankee',z:'Zulu'};
const DW={zero:'0',one:'1',wun:'1',two:'2',three:'3',tree:'3',four:'4',fower:'4',five:'5',fife:'5',six:'6',seven:'7',eight:'8',ait:'8',nine:'9',niner:'9'};
const TEEN={ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
const TENS={twenty:20,thirty:30,forty:40,fourty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
const DEC={decimal:1,point:1,dayseemal:1,decimals:1};
const isNum=t=>/^\d+(\.\d+)?$/.test(t);
const isDig=t=>/^\d$/.test(t);
const tr=(en,no)=>({en,no:no||en});

function rng(seed){ let a=(seed>>>0)||1; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function lev(a,b){ if(a===b) return 0; const m=a.length,n=b.length; if(!m) return n; if(!n) return m; let p=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){ const c=[i]; for(let j=1;j<=n;j++) c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); p=c; } return p[n]; }
function eqNum(a,b){ a=String(a); b=String(b); if(!isNum(a)||!isNum(b)) return false; return Math.abs(parseFloat(a)-parseFloat(b))<1e-6; }
function freqKey(f){ f=String(f); const [i,d='']=f.split('.'); return i+d.replace(/0+$/,''); }
function eqFreq(tok,v){ if(!isNum(tok)) return false; if(tok.includes('.')) return eqNum(tok,v); return tok.length>=4&&tok===freqKey(v); }

/* ---------------- normalisation ---------------- */
function pre(raw){
  let s=' '+String(raw||'').toLowerCase()+' ';
  s=s.replace(/[’'`]/g,'').replace(/°/g,' degrees ').replace(/x-ray/g,'xray').replace(/\bstand[\s-]by\b/g,'standby')
     .replace(/\btake[\s-]?off\b/g,'takeoff').replace(/\bline[\s-]?up\b/g,'lineup').replace(/\bpan[\s-]?pan\b/g,'pan pan').replace(/\bmay[\s-]?day\b/g,'mayday')
     .replace(/\b(1[1-3]\d),(\d{1,3})\b/g,'$1.$2')            // 121,7 (Norwegian decimal comma) -> 121.7
     .replace(/\b(\d{1,2}),(\d{3})\b/g,'$1$2')                // 3,000 -> 3000
     .replace(/\bfl\s?(\d)/g,'flight level $1').replace(/\bfl\b/g,'flight level')
     .replace(/(\d)(hpa|ft|kts?|nm|mb|kt)\b/g,'$1 $2')
     .replace(/\bq\.?\s?n\.?\s?h\b/g,'qnh')
     .replace(/\b([a-z]{1,2})-([a-z]{2,4})\b/g,'$1$2')       // LN-NAE -> lnnae, L-AE -> lae
     .replace(/\b([a-z])-(\d)/g,'$1$2')                         // A-1 -> a1
     .replace(/\bft\b/g,'feet').replace(/\bfoot\b/g,'feet').replace(/\bkts?\b/g,'knots').replace(/\bknot\b/g,'knots').replace(/\bnm\b/g,'miles').replace(/\bmile\b/g,'miles')
     .replace(/\b(hectopascals?|millibars?|mb)\b/g,'hpa').replace(/\bdeg\b/g,'degrees').replace(/\bdegree\b/g,'degrees')
     .replace(/\bthousand\b|\btousand\b/g,'thousand').replace(/\bhundred\b|\bhun dred\b/g,'hundred')
     .replace(/\bok\b|\bokay\b/g,'okay');
  return s;
}
function rawWords(raw,keepComma){ return pre(raw).replace(/[,;:!?]/g,' , ').split(/[^a-z0-9.,]+/).map(w=>w.replace(/^\.+|\.+$/g,'')).filter(w=>w&&(keepComma||w!==',')); }
function norm(raw){
  const w0=rawWords(raw,true);
  // words -> digits, decimal marker, letters
  const t=[], ph=[]; const numW=x=>x!==undefined&&(DW[x]!==undefined||/^\d+$/.test(x));
  for(const w of w0){
    if(DW[w]!==undefined){ t.push(DW[w]); ph.push(0); continue; }
    if(DEC[w]&&(w!=='point'||(numW(w0[t.length-1])&&numW(w0[t.length+1])))){ t.push('.'); ph.push(0); continue; }
    if(PH[w]){ t.push(PH[w]); ph.push(1); continue; }
    if(TEEN[w]!==undefined){ t.push('#'+TEEN[w]); ph.push(0); continue; }
    if(TENS[w]!==undefined){ t.push('~'+TENS[w]); ph.push(0); continue; }
    t.push(w); ph.push(0);
  }
  // assemble numbers
  const o=[]; let i=0;
  const numish=x=>x!==undefined&&(isNum(x)||x[0]==='#'||x[0]==='~');
  while(i<t.length){
    const x=t[i];
    if(!numish(x) && !(x==='.'&&numish(t[i+1])&&o.length&&isNum(o[o.length-1]))){ o.push(x); i++; continue; }
    if(x==='.'){ // "121 decimal 7" where 121 was already pushed
      const prev=o.pop(); let cur=prev+'.'; i++; if(/^\d+$/.test(t[i]||'')){ cur+=t[i]; i++; } while(i<t.length&&isDig(t[i])){ cur+=t[i]; i++; } o.push(cur); continue; }
    let total=0, cur='', last=null;
    while(i<t.length){
      const y=t[i];
      if(isNum(y)){
        if(last==='big'){ if(t[i+1]==='hundred'){ cur=y; i++; last='d'; continue; } break; }   // "three thousand | five hundred"
        if(cur===''){ cur=y; i++; last='d'; continue; }
        if(y.length===1){ cur+=y; i++; last='d'; continue; }                                  // digit by digit
        break;
      }
      if(y==='.'&&cur!==''&&!cur.includes('.')&&/^\d+$/.test(t[i+1]||'')){ cur+='.'+t[i+1]; i+=2; continue; }
      if(y[0]==='~'||y[0]==='#'){ if(cur!=='') break; let v=+y.slice(1); if(y[0]==='~'&&isDig(t[i+1]||'')&&t[i+1]!=='0'){ v+=+t[i+1]; i++; } cur=String(v); i++; last='d'; continue; }
      if((y==='thousand'||y==='hundred')&&cur!==''&&!cur.includes('.')){ total+=(+cur)*(y==='thousand'?1000:100); cur=''; i++; last='big';
        if(y==='hundred') break; continue; }
      break;
    }
    if(total) o.push(String(total+(cur!==''?+cur:0))); else if(cur!=='') o.push(cur);
    else { o.push(t[i]); i++; }
  }
  // q n h -> qnh ; strip trailing zeros of decimals (121.700 -> 121.7)
  const r=[];
  for(let k=0;k<o.length;k++){
    if(o[k]==='q'&&o[k+1]==='n'&&o[k+2]==='h'){ r.push('qnh'); k+=2; continue; }
    r.push(o[k]);
  }
  const toks=r.filter(x=>x!==',').map(x=>/^\d+\.\d*$/.test(x)? (x.replace(/0+$/,'').replace(/\.$/,'')||'0') : x);
  return {raw:String(raw||''), words:w0.filter(w=>w!==','), toks, text:' '+toks.join(' ')+' '};
}
const key=s=>norm(s).toks.join('');

/* find a token sequence whose concatenation equals target (callsigns, fixes, holding points) */
function seqFind(N,target,used,fz){
  const T=N.toks; used=used||new Set();
  for(let i=0;i<T.length;i++){ if(used.has(i)) continue; let s='';
    for(let j=i;j<Math.min(T.length,i+10);j++){ if(used.has(j)) break; s+=T[j];
      if(s===target) return [i,j];
      if(fz&&/^[a-z]+$/.test(target)&&target.length>=5&&s.length>=target.length-1&&s.length<=target.length+1&&lev(s,target)<=fz) return [i,j];
      if(!target.startsWith(s)&&!(fz&&s.length<target.length+2)) break; } }
  return null;
}
const mark=(used,r)=>{ if(r) for(let k=r[0];k<=r[1];k++) used.add(k); };
/* numbers after (or before) keywords */
function numsNear(N,kws,used,span,before){
  const T=N.toks, out=[];
  T.forEach((w,i)=>{ if(!kws.includes(w)) return;
    for(let j=i+1;j<=Math.min(T.length-1,i+(span||3));j++){ if(isNum(T[j])&&!used.has(j)){ out.push(j); break; } }
    if(before) for(let j=i-1;j>=Math.max(0,i-2);j--){ if(isNum(T[j])&&!used.has(j)){ out.push(j); break; } } });
  return out;
}
const numIdx=(N,used,pred)=>N.toks.map((w,i)=>i).filter(i=>isNum(N.toks[i])&&!used.has(i)&&pred(N.toks[i],i));

/* ---------------- callsigns ---------------- */
function parseCallsign(s){
  s=String(s||'LN-NAE').trim().toUpperCase().replace(/\s+/g,' ');
  const reg=s.match(/^([A-Z0-9]{1,2})-?([A-Z0-9]{3,4})$/);
  if(reg&&/-/.test(s)){ const all=reg[1]+reg[2]; const abbr=all[0]+'-'+all.slice(-2);
    // SERA.14050(b)(1): the first character of the registration and AT LEAST the last two (LN-NAE: L-AE or L-NAE)
    const akeys=[]; for(let k=2;k<=all.length-2;k++) akeys.push((all[0]+all.slice(-k)).toLowerCase());
    return {full:reg[1]+'-'+reg[2],abbr,key:all.toLowerCase(),akey:abbr.replace('-','').toLowerCase(),akeys,type:'reg'}; }
  return {full:s,abbr:null,key:key(s),akey:null,akeys:[],type:'flt'};
}
/* is t (letters/digits only) a valid abbreviation of the registration `full`? (SERA.14050(b)(1)) */
function isAbbr(full,t){ const all=String(full).toUpperCase().replace(/[^A-Z0-9]/g,''); t=String(t).toUpperCase().replace(/[^A-Z0-9]/g,'');
  return all.length>=4&&t.length>=3&&t.length<=all.length-1&&t[0]===all[0]&&all.endsWith(t.slice(1)); }
const spellWords=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'').split('').map(c=>PHW[c]||NUMW[c]||c).join(' ');

/* ---------------- spoken form for speech synthesis ---------------- */
const NUMW={'0':'zero','1':'one','2':'two','3':'tree','4':'four','5':'fife','6':'six','7':'seven','8':'eight','9':'niner'};
const dig=s=>String(s).split('').map(d=>NUMW[d]||d).join(' ');
function altWords(v){ v=+v; if(v<1000) return v%100===0? NUMW[String(v/100)]+' hundred' : dig(v);
  const th=Math.floor(v/1000), h=Math.floor(v%1000/100), rest=v%100; if(rest) return dig(v);
  return (th>=10? dig(th) : NUMW[String(th)])+' thousand'+(h?' '+NUMW[String(h)]+' hundred':''); }
function freqWords(f){ let [i,d='']=String(f).split('.'); if(d.length===3&&d.endsWith('00')) d=d[0]; return dig(i)+' decimal '+dig(d||'0'); }
function spoken(text){
  let s=String(text);
  s=s.replace(/\b([A-Z]{1,2})-([A-Z]{2,4})\b/g,(m,a,b)=>spellWords(a+b));
  // SERA.14035(a)(1)(i): flight levels digit by digit, except whole hundreds ("flight level one hundred")
  s=s.replace(/\b(?:FL\s?|flight level )(\d{2,3})\b/gi,(m,n)=>'flight level '+(+n>=100&&+n%100===0? NUMW[String(+n/100)]+' hundred' : dig(n)));
  // SERA.14035(a)(1)(ii): QNH digit by digit, except 1000 hPa = "one thousand"
  s=s.replace(/\bQNH (\d{3,4})\b/g,(m,q)=>'QNH '+(q==='1000'?'one thousand':dig(q)));
  // SERA.14035(a)(1)(iii): squawk codes digit by digit, except whole thousands ("squawk seven thousand")
  s=s.replace(/\b(squawk|code) ([0-7]{4})\b/gi,(m,w,c)=>w+' '+(/^[1-7]000$/.test(c)? NUMW[c[0]]+' thousand' : dig(c)));
  // SERA.14035(a)(4): clock bearings with the digits together ("ten o'clock")
  s=s.replace(/\b(1[0-2]|[1-9]) o['’]clock\b/gi,(m,h)=>({'10':'ten','11':'eleven','12':'twelve'}[h]||NUMW[h])+" o'clock");
  s=s.replace(/\b(\d{3})\.(\d{1,3})\b/g,(m,a,b)=>freqWords(a+'.'+b));
  s=s.replace(/\b(\d{3,5}) (feet|ft)\b/g,(m,a)=>altWords(a)+' feet');
  s=s.replace(/\b(altitude|not above|not below) (\d{3,5})\b/gi,(m,w,a)=>w+' '+altWords(a));
  s=s.replace(/\b([A-Z])(\d{1,2})\b/g,(m,a,d)=>PHW[a.toLowerCase()]+' '+dig(d));
  s=s.replace(/\b([A-Z]{4,6}) (\d)([A-Z])\b/g,(m,w,d,l)=>w[0]+w.slice(1).toLowerCase()+' '+dig(d)+' '+PHW[l.toLowerCase()]);
  s=s.replace(/\b([A-Z]{5,6})\b/g,m=>/^(MAYDAY|ROGER|WILCO|AFFIRM|NEGATIVE)$/.test(m)?m.toLowerCase():m[0]+m.slice(1).toLowerCase());
  s=s.replace(/\bQNH\b/g,'Q N H').replace(/\b(\d+)\b/g,m=>dig(m));
  return s.replace(/\s+/g,' ').trim();
}

/* ---------------- element labels and rules (EN/NO) ---------------- */
const RULE={
  cs:tr('Always include your callsign in a readback; it normally goes at the end (SERA.14055(c)(2)). A first call starts with the station you call, then your full callsign (SERA.14055(b)(1)).','Ta alltid med kallesignalet i en tilbakelesing; det står normalt sist (SERA.14055(c)(2)). Et første oppkall starter med stasjonen du kaller, så fullt kallesignal (SERA.14055(b)(1)).'),
  csabbr:tr('Use the abbreviated callsign only after the station has addressed you that way, and never when you establish contact with a new unit (SERA.14055(b)(1) and (c)(1)).','Bruk forkortet kallesignal først etter at stasjonen har kalt deg opp slik, og aldri når du etablerer kontakt med en ny enhet (SERA.14055(b)(1) og (c)(1)).'),
  stn:tr('A first call starts with the station you are calling (SERA.14055(b)(1)).','Et første oppkall starter med stasjonen du kaller (SERA.14055(b)(1)).'),
  rwy:tr('Runway designators are always read back: clearances to enter, land on, take off from, hold short of, cross or backtrack a runway, and the runway in use (SERA.8015(e)(1)).','Rullebanenummer leses alltid tilbake: klareringer for å kjøre inn på, lande på, ta av fra, holde kort av, krysse eller backtracke en bane, og bane i bruk (SERA.8015(e)(1)).'),
  qnh:tr('Altimeter settings are always read back (SERA.8015(e)(1)(iii)). A wrong QNH puts you at the wrong altitude.','Høydemålerinnstilling leses alltid tilbake (SERA.8015(e)(1)(iii)). Feil QNH gir feil høyde.'),
  alt:tr('Below the transition altitude a level is an altitude on QNH: “3000 feet” or, where it helps, “altitude 3000 feet”, never “flight level” (AMC1 SERA.14001, 1.1.1).','Under overgangshøyden er et nivå en høyde på QNH: «3000 feet» eller, der det hjelper, «altitude 3000 feet», aldri «flight level» (AMC1 SERA.14001, 1.1.1).'),
  fl:tr('At and above the transition level, levels are flight levels on 1013 hPa: “flight level” and the digits; whole hundreds as “flight level one hundred” (SERA.14035(a)(1)(i)).','Ved og over overgangsnivået er nivåer flygenivåer på 1013 hPa: «flight level» og sifrene; hele hundrer som «flight level one hundred» (SERA.14035(a)(1)(i)).'),
  hdg:tr('Headings are read back as three digits (SERA.8015(e)(1)(iii), SERA.14035(a)(1)). A wrong heading can put you into terrain or traffic.','Kurser leses tilbake med tre sifre (SERA.8015(e)(1)(iii), SERA.14035(a)(1)). Feil kurs kan sette deg i terreng eller trafikk.'),
  turn:tr('The direction of turn is part of the heading instruction. Read it back.','Svingretningen er en del av kursinstruksen. Les den tilbake.'),
  sq:tr('SSR codes (squawks) are always read back (SERA.8015(e)(1)(iii)).','SSR-koder (squawk) leses alltid tilbake (SERA.8015(e)(1)(iii)).'),
  freq:tr('A newly assigned frequency is always read back: the frequency, then your callsign (SERA.8015(e)(1)(iii)).','En ny tildelt frekvens leses alltid tilbake: frekvensen, så kallesignalet (SERA.8015(e)(1)(iii)).'),
  info:tr('Say the ATIS letter on first contact, so the controller knows you have the current information.','Si ATIS-bokstaven ved første kontakt, så flygelederen vet at du har gjeldende informasjon.'),
  hp:tr('The holding point is the limit of your taxi clearance. Taxi instructions are read back or acknowledged so it is clear you understood them (SERA.8015(e)(2)); the holding point shows that.','Holdepunktet er grensen for taksiklareringen. Taksiinstrukser leses tilbake eller bekreftes slik at det er klart at du har forstått dem (SERA.8015(e)(2)); holdepunktet viser det.'),
  hs:tr('Hold short is always read back with the runway (SERA.8015(e)(1)(ii)) and acknowledged with “holding short”; “roger” or “wilco” is not enough (AMC1 SERA.14001, 1.4.8).','Hold short leses alltid tilbake med banenummeret (SERA.8015(e)(1)(ii)) og bekreftes med «holding short»; «roger» eller «wilco» er ikke nok (AMC1 SERA.14001, 1.4.8).'),
  fix:tr('Route clearances are read back: clearance limit, route, procedures and fixes (SERA.8015(e)(1)(i)).','Ruteklareringer leses tilbake: klareringsgrense, rute, prosedyrer og punkter (SERA.8015(e)(1)(i)).'),
  spd:tr('Speed instructions are always read back (SERA.8015(e)(1)(iii)).','Fartsinstrukser leses alltid tilbake (SERA.8015(e)(1)(iii)).'),
  num:tr('This number is part of the message. Get it right.','Dette tallet er en del av meldingen. Få det riktig.'),
  phr:tr('This is part of the clearance or the call.','Dette er en del av klareringen eller oppkallet.'),
  spell:tr('Use the ICAO phonetic alphabet: one word per letter (SERA.14020).','Bruk det fonetiske alfabetet (ICAO): ett ord per bokstav (SERA.14020).'),
  say:tr('Each digit separately and “decimal” for the point. Exceptions (SERA.14035): whole hundreds and thousands of altitudes (“two thousand five hundred”), flight levels in whole hundreds (“flight level one hundred”), QNH 1000 (“one thousand”), squawks of whole thousands (“seven thousand”). A frequency whose last two digits are zeros is said with four digits only (“one one eight decimal three”).','Hvert siffer for seg og «decimal» for komma. Unntak (SERA.14035): hele hundrer og tusener i høyder («two thousand five hundred»), flygenivåer i hele hundrer («flight level one hundred»), QNH 1000 («one thousand»), squawk med hele tusener («seven thousand»). En frekvens der de to siste sifrene er null, sies med bare fire sifre («one one eight decimal three»).'),
  cond:tr('A conditional clearance is acknowledged with the condition, the clearance and the condition again: “Behind the landing DA40, lining up runway 36, behind” (SERA.8015(ec), AMC1 SERA.14001 1.4.10). Identify the traffic before you move.','En betinget klarering bekreftes med betingelsen, klareringen og betingelsen igjen: «Behind the landing DA40, lining up runway 36, behind» (SERA.8015(ec), AMC1 SERA.14001 1.4.10). Identifiser trafikken før du ruller.'),
  abbr:tr('Abbreviated form of a registration: the first character and at least the last two (LN-NAE: L-AE or L-NAE). Callsigns with a flight number are never abbreviated (SERA.14050(b)).','Forkortet form av en registrering: første tegn og minst de to siste (LN-NAE: L-AE eller L-NAE). Kallesignaler med flightnummer forkortes aldri (SERA.14050(b)).')
};
function label(e,V){
  const v=e.v;
  switch(e.k){
    case 'cs': return tr('Callsign '+(V&&V.cs?V.cs.full:''),'Kallesignal '+(V&&V.cs?V.cs.full:''));
    case 'stn': return tr('Station: '+v,'Stasjon: '+v);
    case 'rwy': return tr('Runway '+v,'Rullebane '+v);
    case 'qnh': return tr('QNH '+v);
    case 'alt': return tr(v+' feet (altitude, QNH)',v+' fot (høyde, QNH)');
    case 'fl': return tr('Flight level '+String(v).padStart(2,'0'),'Flygenivå '+v);
    case 'hdg': return tr('Heading '+v,'Kurs '+v);
    case 'turn': return tr('Turn '+v,'Sving '+(v==='left'?'venstre (left)':'høyre (right)'));
    case 'sq': return tr('Squawk '+v);
    case 'freq': return tr('Frequency '+v,'Frekvens '+v);
    case 'info': return tr('Information '+PHW[String(v).toLowerCase()],'Information '+PHW[String(v).toLowerCase()]);
    case 'letter': return tr('ATIS letter '+PHW[String(v).toLowerCase()],'ATIS-bokstav '+PHW[String(v).toLowerCase()]);
    case 'hp': return tr('Holding point '+v,'Holdepunkt '+v);
    case 'hs': return tr('Hold short of runway '+v,'Hold short runway '+v);
    case 'fix': return tr(v);
    case 'spd': return tr('Speed '+v+' knots','Fart '+v+' knop');
    case 'trk': return tr('Inbound track '+v,'Innkommende kurs '+v);
    case 'wind': return tr('Wind '+v[0]+'/'+v[1],'Vind '+v[0]+'/'+v[1]);
    case 'spell': return tr('Spelled: '+spellWords(v),'Stavet: '+spellWords(v));
    case 'say': return tr('Spoken: '+e.w,'Uttalt: '+e.w);
    case 'abbr': return tr(v?'Abbreviated: '+v:'Not abbreviated','Forkortet: '+(v||'ikke forkortet'));
    default: return e.l||tr(String(v||''));
  }
}

/* ---------------- one element ---------------- */
const KW={rwy:['runway','runways'],qnh:['qnh','hpa','altimeter'],alt:['altitude','climb','climbing','descend','descending','maintain','above','below','to','passing','at','leaving','feet'],
  hdg:['heading','hdg'],sq:['squawk','squawking','code','transponder'],freq:['contact','frequency','monitor','on','decimal','information','tower','ground','approach','control','delivery'],
  spd:['speed','knots','reduce','increase'],trk:['inbound','track','course'],time:['at','time','expect','approach','estimate','estimating','minutes','endurance']};
function check(e,N,ctx){
  const U=ctx.used, T=N.toks;
  const found=r=>{ mark(U,r); return {st:'ok'}; };
  switch(e.k){
    case 'cs':{ const cs=ctx.V.cs; let r=seqFind(N,cs.key,U);
      if(r){ mark(U,r); ctx.csAt=r; return {st:'ok'}; }
      if(cs.akey){ for(const k of (cs.akeys&&cs.akeys.length?cs.akeys.slice().reverse():[cs.akey])){ r=seqFind(N,k,U); if(r) break; } if(r){ mark(U,r); ctx.csAt=r; return e.full? {st:'wrong',why:RULE.csabbr,got:cs.abbr} : ctx.abbrOK? {st:'ok'} : {st:'warn',why:RULE.csabbr,got:cs.abbr}; } }
      return {st:'miss'}; }
    case 'stn':{ const ws=key(e.v).length? norm(e.v).toks:[]; const name=ws[0], unit=ws.slice(1).join('');
      const rn=seqFind(N,name,U,2); const UNITS=['tower','ground','delivery','approach','radar','control','information','traffic','director','apron','radio','centre','center'];
      const ru=unit? seqFind(N,unit,U) : [0,0];
      if(rn&&ru){ mark(U,rn); if(unit) mark(U,ru); return {st:'ok'}; }
      const other=T.find((w,i)=>UNITS.includes(w)&&w!==unit&&!U.has(i)&&i<4);
      if(other&&unit) return {st:'wrong',got:other};
      if(ru&&unit&&!rn) return {st:e.strictName?'miss':'ok'};
      return {st:'miss'}; }
    case 'rwy':{ const near=numsNear(N,KW.rwy,U,2);
      const hit=near.find(j=>T[j]===String(e.v)||(T[j].length===1&&('0'+T[j])===String(e.v)));
      if(hit!==undefined) return found([hit,hit]);
      const any=numIdx(N,U,w=>w===String(e.v)); if(any.length) return found([any[0],any[0]]);
      if(near.length&&!(e.soft)) return {st:'wrong',got:'runway '+T[near[0]]};
      return {st:'miss'}; }
    case 'hp':{ const r=seqFind(N,key(e.v),U); if(r) return found(r);
      const p=T.indexOf('point'); if(p>=0&&T[p+1]&&/^[a-z]\d?$/.test(T[p+1])) return {st:'wrong',got:(T[p+1]+(isNum(T[p+2]||'')?T[p+2]:'')).toUpperCase()};
      return {st:'miss'}; }
    case 'hs':{ const i=T.findIndex((w,j)=>w==='short'&&/^hold/.test(T[j-1]||''));
      if(i<0) return {st:'miss'};
      const nx=T.slice(i+1,i+5).find(isNum); if(nx===undefined||eqNum(nx,e.v)||nx===String(e.v)){ const j=T.slice(i+1,i+5).indexOf(nx); if(j>=0) U.add(i+1+j); return {st:'ok'}; }
      return {st:'wrong',got:'hold short '+nx}; }
    case 'qnh':{ const near=numsNear(N,KW.qnh,U,3,true).filter(j=>T[j].length>=3);
      if(near.some(j=>eqNum(T[j],e.v))){ const j=near.find(j=>eqNum(T[j],e.v)); return found([j,j]); }
      const any=numIdx(N,U,w=>eqNum(w,e.v)); if(any.length) return found([any[0],any[0]]);
      const pair=T.findIndex((w,i)=>isDig(w)||(/^\d\d$/.test(w)&&/^\d\d$/.test(T[i+1]||'')&&w+T[i+1]===String(e.v))); if(pair>=0&&T[pair]+(T[pair+1]||'')===String(e.v)) return found([pair,pair+1]);
      if(near.length) return {st:'wrong',got:'QNH '+T[near[0]]};
      return {st:'miss'}; }
    case 'alt':{ const v=+e.v;
      const lvl=T.findIndex((w,i)=>w==='level'&&isNum(T[i+1]||'')&&(+T[i+1]===v/100));
      if(lvl>=0) return {st:'wrong',got:'flight level '+T[lvl+1],why:RULE.alt};
      const any=numIdx(N,U,(w,i)=>+w===v&&T[i-1]!=='level'); if(any.length) return found([any[0],any[0]]);
      const near=numsNear(N,KW.alt,U,2,false).filter(j=>+T[j]>=300&&+T[j]%100===0&&T[j-1]!=='level'&&T[j-1]!=='runway'&&T[j-1]!=='squawk'&&T[j-1]!=='heading');
      const fb=numIdx(N,U,(w,i)=>T[i+1]==='feet'&&+w!==v);
      const cand=near.concat(fb); if(cand.length) return {st:'wrong',got:T[cand[0]]+' feet'};
      return {st:'miss'}; }
    case 'fl':{ const v=+e.v;
      const L=T.map((w,i)=>i).filter(i=>T[i]==='level'&&isNum(T[i+1]||'')&&!U.has(i+1));
      const hit=L.find(i=>+T[i+1]===v); if(hit!==undefined) return found([hit+1,hit+1]);
      const asAlt=numIdx(N,U,w=>+w===v*100); if(asAlt.length) return {st:'wrong',got:T[asAlt[0]]+' feet',why:RULE.fl};
      if(L.length) return {st:'wrong',got:'flight level '+T[L[0]+1]};
      const bare=numIdx(N,U,(w,i)=>+w===v&&w.length>=2&&T[i-1]!=='runway'); if(bare.length){ mark(U,[bare[0],bare[0]]); return {st:'warn',got:T[bare[0]],why:RULE.fl}; }
      return {st:'miss'}; }
    case 'hdg':{ const near=numsNear(N,KW.hdg,U,2);
      const hit=near.find(j=>eqNum(T[j],e.v)); if(hit!==undefined) return found([hit,hit]);
      if(near.length) return {st:'wrong',got:'heading '+T[near[0]]};
      const any=numIdx(N,U,w=>w.length===3&&eqNum(w,e.v)); if(any.length) return found([any[0],any[0]]);
      return {st:'miss'}; }
    case 'turn':{ const other=e.v==='left'?'right':'left';
      const i=T.findIndex((w,j)=>w===e.v&&!U.has(j)); if(i>=0){ U.add(i); return {st:'ok'}; }
      if(T.includes(other)) return {st:'wrong',got:other}; return {st:'miss'}; }
    case 'sq':{ const near=numsNear(N,KW.sq,U,2);
      const hit=near.find(j=>T[j]===String(e.v)); if(hit!==undefined) return found([hit,hit]);
      const any=numIdx(N,U,w=>w===String(e.v)); if(any.length) return found([any[0],any[0]]);
      if(near.length) return {st:'wrong',got:'squawk '+T[near[0]]};
      return {st:'miss'}; }
    case 'freq':{ const any=numIdx(N,U,w=>eqFreq(w,e.v)); if(any.length) return found([any[0],any[0]]);
      // "121 7" spoken without "decimal"
      for(let i=0;i<T.length-1;i++){ if(isNum(T[i])&&isNum(T[i+1])&&!U.has(i)&&eqFreq(T[i]+T[i+1],e.v)) return found([i,i+1]); }
      const wrong=numIdx(N,U,w=>/^1[1-3]\d\.\d+$/.test(w)||/^1[1-3]\d\d{1,3}$/.test(w)); if(wrong.length) return {st:'wrong',got:T[wrong[0]]};
      return {st:'miss'}; }
    case 'info':{ const i=T.findIndex((w,j)=>(w==='information'||w==='info')&&/^[a-z]$/.test(T[j+1]||'')&&!U.has(j+1));
      if(i>=0){ U.add(i+1); return T[i+1]===String(e.v).toLowerCase()? {st:'ok'} : {st:'wrong',got:'information '+PHW[T[i+1]]}; }
      const h=T.findIndex((w,j)=>(w==='have'||w==='with'||w==='received')&&T[j+1]===String(e.v).toLowerCase()); if(h>=0){ U.add(h+1); return {st:'ok'}; }
      return {st:'miss'}; }
    case 'letter':{ const i=T.findIndex((w,j)=>w===String(e.v).toLowerCase()&&!U.has(j)); if(i>=0){ U.add(i); return {st:'ok'}; }
      const j=T.findIndex((w,k)=>(w==='information'||w==='info'||w==='letter')&&/^[a-z]$/.test(T[k+1]||'')); if(j>=0) return {st:'wrong',got:PHW[T[j+1]]};
      return {st:'miss'}; }
    case 'fix':{ const r=seqFind(N,key(e.v),U,e.fz===0?0:1); if(r) return found(r);
      if(e.alt){ for(const a of e.alt){ const r2=seqFind(N,key(a),U,1); if(r2) return found(r2); } }
      return {st:'miss'}; }
    case 'spd':{ const near=numsNear(N,KW.spd,U,3,true); const hit=near.find(j=>+T[j]===+e.v); if(hit!==undefined) return found([hit,hit]);
      const any=numIdx(N,U,w=>+w===+e.v); if(any.length) return found([any[0],any[0]]);
      if(near.length) return {st:'wrong',got:T[near[0]]+' knots'}; return {st:'miss'}; }
    case 'trk':{ const near=numsNear(N,KW.trk,U,2); const hit=near.find(j=>eqNum(T[j],e.v)); if(hit!==undefined) return found([hit,hit]);
      const any=numIdx(N,U,w=>w.length===3&&eqNum(w,e.v)); if(any.length) return found([any[0],any[0]]);
      if(near.length) return {st:'wrong',got:T[near[0]]}; return {st:'miss'}; }
    case 'num':{ const kws=e.kw||[]; const near=kws.length? numsNear(N,kws,U,e.span||3,true) : [];
      const hit=near.find(j=>eqNum(T[j],e.v)); if(hit!==undefined) return found([hit,hit]);
      const any=numIdx(N,U,w=>eqNum(w,e.v)); if(any.length) return found([any[0],any[0]]);
      if(near.length&&e.wrong!==false) return {st:'wrong',got:T[near[0]]}; return {st:'miss'}; }
    case 'wind':{ const d=numIdx(N,U,w=>eqNum(w,e.v[0])); const s=numIdx(N,U,(w,i)=>eqNum(w,e.v[1])&&!d.includes(i));
      if(d.length&&s.length){ mark(U,[d[0],d[0]]); mark(U,[s[0],s[0]]); return {st:'ok'}; }
      // "340/8" typed as 3408 or "34008"
      if(numIdx(N,U,w=>w===String(e.v[0])+String(e.v[1])||w===String(e.v[0])+String(e.v[1]).padStart(2,'0')).length) return {st:'ok'};
      return {st:d.length||s.length?'wrong':'miss',got:d.length?'…/?':''}; }
    case 'phr':{ const ok=e.re.test(N.text); if(ok) return {st:'ok'}; if(e.wr&&e.wr.test(N.text)) return {st:'wrong',got:(N.text.match(e.wr)||[''])[0].trim()}; return {st:'miss'}; }
    case 'count':{ const n=(N.text.match(e.re)||[]).length; if(n>=e.n) return {st:'ok'};
      // "preferably spoken three times" (SERA.14095(b)(1), (c)(1)): fewer is allowed, so only a note
      if(e.min&&n>=e.min) return {st:'warn',got:n+'×',why:e.whyMin};
      return n? {st:'wrong',got:n+'×'} : {st:'miss'}; }
    case 'last':{ // call must end with this word (blind calls end with the place name)
      const t=T.filter(w=>w!=='over'); return seqFind({toks:t.slice(-3)},key(e.v),new Set(),1)? {st:'ok'} : {st:'miss'}; }
    case 'spell':{ const want=String(e.v).toLowerCase().replace(/[^a-z0-9]/g,'').split('');
      const ws=N.words.map(w=>PH[w]||(DW[w]!==undefined?DW[w]:null)).filter(x=>x!==null);
      if(ws.join('')===want.join('')) return {st:'ok'};
      if(N.words.join('')===want.join('')||N.words.every(w=>w.length<=2)) return {st:'wrong',got:N.raw,why:RULE.spell};
      return {st:ws.length?'wrong':'miss',got:ws.map(c=>PHW[c]||c).join(' ')}; }
    case 'say':{ const SYN={niner:'nine',nine:'nine',tree:'three',three:'three',fife:'five',five:'five',fower:'four',four:'four',tousand:'thousand',thousand:'thousand',zero:'zero',one:'one',wun:'one',two:'two',six:'six',seven:'seven',eight:'eight',ait:'eight',decimal:'decimal',hundred:'hundred',dayseemal:'decimal',flight:'flight',level:'level'};
      const got=N.words.map(w=>SYN[w]||w).filter(w=>!['feet','squawk','heading','qnh','hpa','and'].includes(w));
      const want=e.w.split(' ').map(w=>SYN[w]||w).filter(w=>!['feet','squawk','heading','qnh','hpa','and'].includes(w));
      const tz=a=>{ const k=a.indexOf('decimal'); if(k<0) return a.join(' '); const b=a.slice(); while(b.length>k+2&&b[b.length-1]==='zero') b.pop(); return b.join(' '); };
      if(got.join(' ')===want.join(' ')) return {st:'ok'};
      // SERA.14035(a)(6): all six digits, except when the fifth and sixth are both zero (then four digits only)
      if(tz(got)===tz(want)) return {st:'wrong',got:N.raw,why:tr('Frequencies: all six digits, except when the last two are zeros; then only the first four (SERA.14035(a)(6)). Say: '+e.w,'Frekvenser: alle seks sifrene, unntatt når de to siste er null; da bare de fire første (SERA.14035(a)(6)). Si: '+e.w)};
      const HT=a=>/\b(hundred|thousand)\b/.test(a.join(' '));
      if(HT(want)!==HT(got)&&!N.words.some(w=>/\d/.test(w))) return {st:'wrong',got:N.raw,why:tr(RULE.say.en+' Say: '+e.w,RULE.say.no+' Si: '+e.w)};
      if(N.words.some(w=>/\d/.test(w))) return {st:'wrong',got:N.raw,why:tr('Write it the way you say it, in words: '+e.w,'Skriv det slik du sier det, med ord: '+e.w)};
      if(N.words.includes('point')) return {st:'wrong',got:N.raw,why:tr('Say “decimal”, not “point”.','Si «decimal», ikke «point».')};
      return {st:'wrong',got:N.raw}; }
    case 'abbr':{ const t=N.toks.join('');
      if(!e.v) return /\b(no|none|not|cannot|negative|nil)\b/.test(N.text)||t===key(e.full)? {st:'ok'} : {st:'wrong',got:N.raw};
      return t===key(e.v)||(e.reg&&isAbbr(e.reg,t))? {st:'ok'} : {st:'wrong',got:N.raw}; }
  }
  return {st:'miss'};
}
const ORDER=['cs','abbr','spell','say','stn','info','letter','hp','hs','fix','sq','freq','qnh','fl','alt','trk','hdg','rwy','spd','wind','num','turn','phr','count','last'];

/* ---------------- phraseology flags ---------------- */
function flags(N,step){
  const s=N.text, F=[];
  const add=(en,no,k)=>F.push({k,en,no});
  if(/\brepeat\b/.test(s)) add('Say “say again”, not “repeat”.','Si «say again», ikke «repeat».','repeat');
  if(/\b(yes|yeah|yep|okay)\b/.test(s)) add('Use “affirm”, “wilco” or a readback, not “yes” or “OK” (SERA.14045(b)).','Bruk «affirm», «wilco» eller en tilbakelesing, ikke «yes» eller «OK» (SERA.14045(b)).','yes');
  if(/\baffirmative\b/.test(s)) add('The standard word is “affirm”, not “affirmative” (SERA.14045(b)).','Standardordet er «affirm», ikke «affirmative» (SERA.14045(b)).','affirmative');
  if(/over and out/.test(s)) add('There is no “over and out”: “over” expects a reply, “out” ends the exchange, and neither is normally used on VHF (GM4/GM5 SERA.14045).','Det finnes ingen «over and out»: «over» venter svar, «out» avslutter, og ingen av dem brukes normalt på VHF (GM4/GM5 SERA.14045).','overout');
  if(/\b(ready (for )?takeoff|request takeoff)\b/.test(s)) add('Say “ready for departure”. “Take-off” is used only in the take-off clearance or when cancelling it (SERA.14045(c)).','Si «ready for departure». «Take-off» brukes bare i avgangsklareringen eller når den kanselleres (SERA.14045(c)).','takeoff');
  if(/\bcop(y|ied)\b/.test(s)) add('“Copy” is not standard. Read back, or say “roger” when no readback is needed.','«Copy» er ikke standard. Les tilbake, eller si «roger» når det ikke kreves tilbakelesing.','copy');
  if(step&&step.rb&&/\broger\b/.test(s)&&N.toks.length<=4&&!(step.els||[]).some(e=>/roger/.test(String(e.re||'')))) add('“Roger” is never a readback or an answer to a question (GM6 SERA.14045). Read back the items of the clearance.','«Roger» er aldri en tilbakelesing eller et svar på et spørsmål (GM6 SERA.14045). Les tilbake elementene i klareringen.','roger');
  if(/\b(point)\b/.test(N.words.join(' '))&&/\b(1[1-3]\d)\b/.test(N.words.join(' '))) add('Frequencies use “decimal”, not “point” (SERA.14035(a)(5)).','Frekvenser bruker «decimal», ikke «point» (SERA.14035(a)(5)).','point');
  if(/\baltimeter\b/.test(s)&&/\b\d{3,4}\b/.test(s)) add('Say “QNH” and the value (AMC1 SERA.14001, 1.1.8). “Altimeter” is US phraseology.','Si «QNH» og verdien (AMC1 SERA.14001, 1.1.8). «Altimeter» er amerikansk fraseologi.','altimeter');
  if(step&&(step.els||[]).some(e=>e.k==='hs')&&/\bhold short\b/.test(s)&&!/\bholding short\b/.test(s)) add('Acknowledge a hold short with “holding short” (AMC1 SERA.14001, 1.4.8).','Bekreft hold short med «holding short» (AMC1 SERA.14001, 1.4.8).','holdshort');
  if(step&&step.bad) step.bad.forEach(b=>{ if(b.re.test(s)) add(b.en,b.no,'bad'); });
  return F;
}

/* ---------------- grading ---------------- */
function grade(step,text,o){
  o=o||{}; const N=norm(text), V=o.V||{cs:parseCallsign('LN-NAE')};
  const ctx={used:new Set(),V,abbrOK:!!o.abbrOK,csAt:null};
  const els=step.els||[]; const idx=els.map((e,i)=>i).sort((a,b)=>ORDER.indexOf(els[a].k)-ORDER.indexOf(els[b].k));
  const res=new Array(els.length);
  for(const i of idx){ const e=els[i]; const r=check(e,N,ctx); res[i]=Object.assign({k:e.k,opt:!!e.opt,soft:!!e.min,label:e.l||label(e,V),why:r.why||e.why||RULE[e.k]||RULE.phr},r); }
  // carry: items correct in an earlier attempt of the same step stay correct (the pilot only repeats the corrected part)
  if(o.carry) res.forEach((r,i)=>{ if(o.carry[i]==='ok'&&r.st==='miss') r.st='ok'; });
  const fl=flags(N,step);
  // callsign position: last in a readback, after the station in a first call (advice, check-ready only)
  if(o.level==='check'&&ctx.csAt&&step.rb){ const after=N.toks.slice(ctx.csAt[1]+1).filter(w=>!['over','wilco','roger'].includes(w)); if(after.length>2) fl.push({k:'cspos',en:'Put your callsign at the end of the readback.',no:'Sett kallesignalet sist i tilbakelesingen.'}); }
  const req=res.filter(r=>!r.opt), strict=o.level==='check';
  const good=r=>r.st==='ok'||(r.st==='warn'&&(!strict||r.soft));
  const pass=req.every(good);
  const short=N.toks.length<=6;
  const sayAgain=/\bsay again\b/.test(N.text)&&short&&!els.some(e=>e.k==='phr'&&/say/.test(String(e.re)));
  const standby=/^\s*(standby|wait)\b/.test(N.text)&&N.toks.length<=4&&!els.some(e=>e.k==='phr'&&/standby/.test(String(e.re)));
  const nOk=req.filter(good).length;
  return {N,res,flags:fl,pass,frac:req.length?nOk/req.length:1,sayAgain,standby,empty:!N.toks.length};
}

/* controller's correction of a wrong or incomplete readback / call */
function corrPhrase(e,V){
  switch(e.k){
    case 'rwy': return 'runway '+e.v; case 'qnh': return 'QNH '+e.v; case 'alt': return 'altitude '+e.v+' feet'; case 'fl': return 'flight level '+e.v;
    case 'hdg': return 'heading '+e.v; case 'turn': return 'turn '+e.v; case 'sq': return 'squawk '+e.v; case 'freq': return (e.unit?e.unit+' ':'')+e.v;
    case 'hp': return 'holding point '+e.v; case 'hs': return 'hold short of runway '+e.v; case 'fix': return e.v; case 'spd': return 'speed '+e.v+' knots';
    case 'trk': return 'inbound track '+e.v; case 'info': return 'information '+PHW[String(e.v).toLowerCase()];
    default: return e.say||null;
  }
}
function correction(step,g,S){
  const V=S.V, cs=S.abbrOK&&V.cs.abbr? V.cs.abbr : V.cs.full, unit=(step.unit&&step.unit.n)||'';
  const bad=step.els.map((e,i)=>({e,r:g.res[i]})).filter(x=>!x.r.opt&&!(x.r.st==='ok'||(x.r.st==='warn'&&(S.level!=='check'||x.r.soft))));
  const csBad=bad.find(x=>x.e.k==='cs'); const rest=bad.filter(x=>x.e.k!=='cs');
  if(step.rb){
    if(!rest.length) return csBad&&csBad.r.st==='miss'? `Station reading back, say again your callsign.` : `${cs}, say again.`;
    const wrong=rest.filter(x=>x.r.st==='wrong'), ph=rest.map(x=>corrPhrase(x.e,V)).filter(Boolean);
    if(!ph.length) return `${cs}, negative, I say again, ${String(step.atc||S.lastAtc||'').replace(/^[^,]+,\s*/,'')}`;
    return wrong.length? `${cs}, negative, I say again, ${ph.join(', ')}.` : `${cs}, read back ${ph.join(', ')}.`;
  }
  if(csBad&&csBad.r.st==='miss') return `Station calling ${unit||'this frequency'}, say again your callsign.`;
  const asks=rest.map(x=>x.e.ask).filter(Boolean);
  if(asks.length) return `${cs}, ${asks.slice(0,2).join(', ')}.`;
  return `${cs}, say again.`;
}

/* ---------------- session (scenario state machine) ---------------- */
const LEVELS={beginner:{tries:3,rate:0.88,hints:true,hideAtc:false,pen:0},intermediate:{tries:2,rate:1.0,hints:false,hideAtc:false,pen:0.05},check:{tries:2,rate:1.12,hints:false,hideAtc:true,pen:0.1}};
function prep(steps,V){ // fill units forward and mark where the controller has abbreviated the callsign
  let unit=null, abbr=false;
  steps.forEach((s,i)=>{ if(s.unit) unit=s.unit; else s.unit=unit; if(s.abbr) abbr=true; s.abbrOK=!!s.abbrOK||abbr; if(s.atc&&V.cs.abbr&&s.atc.includes(V.cs.abbr)) abbr=true; s.abbrAfter=abbr; if(s.reply&&V.cs.abbr&&s.reply.includes(V.cs.abbr)) abbr=true; s.n=i; });
  return steps;
}
class Session{
  constructor(sc,o){
    o=o||{}; this.sc=sc; this.level=o.level||'intermediate'; this.L=LEVELS[this.level]||LEVELS.intermediate;
    this.seed=o.seed||((Date.now()^Math.floor(Math.random()*1e9))>>>0);
    this.V=o.V||(G.RADIOSCEN? G.RADIOSCEN.vars(this.seed,{callsign:o.callsign}) : {cs:parseCallsign(o.callsign)});
    this.steps=prep(o.steps||sc.build(this.V,{level:this.level}),this.V);
    this.i=-1; this.tries=0; this.carry=null; this.peek=false; this.results=[]; this.abbrOK=false; this.lastAtc=''; this.done=false; this.unit=null; this._undo=null;
  }
  get step(){ return this.steps[this.i]||null; }
  /* events: {t:'tune',unit} {t:'sit',text} {t:'atc',text,unit,atis} {t:'prompt',text} {t:'model',text} {t:'note',text} {t:'end'} */
  start(){ return this._enter(0); }
  _atc(text,ev,o){ if(!text) return; const st=this.step; this.lastAtc=text; ev.push(Object.assign({t:'atc',text,unit:(st&&st.unit)||this.unit},o||{}));
    if(this.V.cs.abbr&&text.includes(this.V.cs.abbr)) this.abbrOK=true; }
  _enter(i){
    const ev=[]; this.i=i; this.tries=0; this.carry=null; this.peek=false;
    if(i>=this.steps.length){ this.done=true; ev.push({t:'end'}); return ev; }
    const s=this.steps[i];
    if(s.unit&&(!this.unit||this.unit.f!==s.unit.f||this.unit.n!==s.unit.n)){ this.unit=s.unit; ev.push({t:'tune',unit:s.unit}); }
    if(s.abbrOK) this.abbrOK=true;
    if(s.sit) ev.push({t:'sit',text:s.sit});
    if(s.prompt) ev.push({t:'prompt',text:s.prompt});
    if(s.atc) this._atc(s.atc,ev,{atis:!!s.atis,listen:!!s.listen});
    return ev;
  }
  showModel(){ const s=this.step; if(!s) return []; this.peek=true; return [{t:'model',text:s.model}]; }
  sayAgain(){ return this.lastAtc? [{t:'atc',text:this.lastAtc,unit:this.unit,again:true}] : []; }
  submit(text){
    const s=this.step; if(!s||this.done) return {ev:[]};
    const g=grade(s,text,{V:this.V,abbrOK:this.abbrOK||s.abbrOK,carry:this.carry,level:this.level});
    if(g.empty) return {g,ev:[]};
    if(g.sayAgain&&this.lastAtc) return {g,kind:'sayagain',ev:this.sayAgain()};
    if(g.standby) return {g,kind:'standby',ev:[{t:'note',text:tr('Standby is fine when you need a moment. Make the call when you are ready.','Standby er greit når du trenger et øyeblikk. Gjør oppkallet når du er klar.')}]};
    this._undo={i:this.i,tries:this.tries,carry:this.carry,abbrOK:this.abbrOK,lastAtc:this.lastAtc,unit:this.unit,nres:this.results.length,done:this.done};
    this.tries++;
    const ev=[];
    const mergedCarry=g.res.map((r,k)=>(r.st==='ok'||(this.carry&&this.carry[k]==='ok'))?'ok':r.st);
    if(g.pass||this.tries>=this.L.tries){
      const sc=this._score(g); this.results.push({n:this.i,id:s.id,cat:s.cat||'rb',ph:s.ph,score:sc,first:this.tries===1&&g.pass,pass:g.pass,res:g.res.map(r=>({k:r.k,st:r.st,opt:r.opt,label:r.label})),flags:g.flags.map(f=>f.k),task:s.task,model:s.model});
      if(!g.pass) ev.push({t:'model',text:s.model,fail:true});
      if(s.reply) this._atc(s.reply,ev);
      return {g,kind:g.pass?'pass':'fail',ev:ev.concat(this._enter(this.i+1))};
    }
    this.carry=mergedCarry;
    if(!s.noAtc) this._atc(correction(s,g,this),ev,{corr:true});
    else ev.push({t:'note',text:tr('Not quite. Try again.','Ikke helt. Prøv igjen.')});
    return {g,kind:'retry',ev};
  }
  undo(){ const u=this._undo; if(!u) return false; Object.assign(this,{i:u.i,tries:u.tries,carry:u.carry,abbrOK:u.abbrOK,lastAtc:u.lastAtc,unit:u.unit,done:u.done}); this.results.length=u.nres; this._undo=null; return true; }
  skip(){ const s=this.step; if(!s) return []; this.results.push({n:this.i,id:s.id,cat:s.cat||'rb',ph:s.ph,score:0,first:false,pass:false,skipped:true,res:(s.els||[]).map(e=>({k:e.k,st:'miss',opt:!!e.opt,label:e.l||label(e,this.V)})),flags:[],task:s.task,model:s.model});
    const ev=[{t:'model',text:s.model,fail:true}]; if(s.reply) this._atc(s.reply,ev); return ev.concat(this._enter(this.i+1)); }
  _score(g){
    let sc= g.pass? [1,0.7,0.5,0.4][this.tries-1]||0.4 : 0.4*g.frac;
    if(this.peek) sc=Math.min(sc,0.5);
    sc-=this.L.pen*g.flags.length; return Math.max(0,Math.min(1,sc));
  }
  summary(){ return summarize(this.results,this.steps.length); }
}
function summarize(results,total){
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const cats={}, kinds={};
  results.forEach(r=>{ (cats[r.cat]=cats[r.cat]||[]).push(r.score);
    if(!r.skipped) r.res.forEach(e=>{ if(e.opt) return; const k=e.k==='phr'||e.k==='count'?'phr':e.k; const o=kinds[k]=kinds[k]||{n:0,ok:0}; o.n++; if(e.st==='ok'||e.st==='warn') o.ok++; }); });
  const flagsN={}; results.forEach(r=>r.flags.forEach(f=>flagsN[f]=(flagsN[f]||0)+1));
  return {score:Math.round((avg(results.map(r=>r.score))||0)*100), n:results.length, total,
    cats:Object.fromEntries(Object.entries(cats).map(([k,v])=>[k,Math.round(avg(v)*100)])),
    kinds, flags:flagsN, weak:results.filter(r=>r.score<0.8).sort((a,b)=>a.score-b.score)};
}

/* ---------------- spaced repetition (Leitner) ---------------- */
const DAY=864e5, BOX=[0.01,1,3,7,21,60];
const SRS={
  update(db,results,now){ db=db||{}; now=now||Date.now();
    results.forEach(r=>{ if(!r.id) return; const o=db[r.id]||{b:0,n:0}; o.n++; o.last=Math.round(r.score*100);
      o.b= r.score>=0.9? Math.min(5,o.b+1) : r.score>=0.6? o.b : 0; o.due=now+BOX[o.b]*DAY; db[r.id]=o; });
    return db; },
  due(db,now,max){ now=now||Date.now(); return Object.entries(db||{}).filter(([k,o])=>o.due<=now&&o.b<5).sort((a,b)=>a[1].b-b[1].b||a[1].last-b[1].last).slice(0,max||99).map(([k])=>k); },
  weak(db,max){ return Object.entries(db||{}).filter(([k,o])=>o.last<80).sort((a,b)=>a[1].last-b[1].last).slice(0,max||99).map(([k])=>k); }
};

G.RADIOCORE={norm,key,grade,check,flags,label,RULE,spoken,altWords,freqWords,spellWords,parseCallsign,Session,summarize,SRS,LEVELS,prep,correction,rng,lev,PHW,NUMW,tr,eqFreq};
})(typeof window!=='undefined'?window:globalThis);
