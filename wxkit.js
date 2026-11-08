/* Birdbird – weather and NOTAM toolkit for the briefing pack (and the METAR page).
   Pure functions, no DOM: parse METAR, TAF and ICAO NOTAMs, resolve report times, work out the TAF
   conditions to plan with for a time window, and runway wind components.
   TAF planning conventions (Birdbird's reading of AMC3 CAT.OP.MPA.182 and AMC1 NCO.OP.160; the official table rules):
   - initial part and FM: apply from the start time;
   - BECMG: a deterioration applies from the start of the change, an improvement only from its end;
   - TEMPO or PROB30/40 alone: a deterioration with persistent conditions (fog, mist, haze, dust, continuous
     precipitation) is applied; with transient or showery conditions (showers, thunderstorms) it may be disregarded;
   - PROB30/40 TEMPO: a deterioration may be disregarded;
   - improvements in TEMPO and PROB groups are always disregarded;
   - mean wind should be within limits; gusts may be disregarded.
   Works in the browser (window.WXK) and in Node (module.exports) for tests. */
(function(G){
'use strict';
const pad=n=>String(n).padStart(2,'0');
const H=3600e3;

/* ---------- time ---------- */
// DD HH MM from a report, resolved to the month nearest the reference time (handles month ends and HH=24)
function resolve(dd,hh,mm,ref){ ref=ref instanceof Date?ref:new Date(ref||Date.now()); if(!(dd>=1&&dd<=31)) return null;
  const y=ref.getUTCFullYear(), m=ref.getUTCMonth(); let best=null;
  for(const k of [-1,0,1]){ const t=Date.UTC(y,m+k,1,0,0); const dim=new Date(Date.UTC(y,m+k+1,0)).getUTCDate(); if(dd>dim) continue;
    const c=Date.UTC(y,m+k,dd,hh||0,mm||0); if(best==null||Math.abs(c-ref)<Math.abs(best-ref)) best=c; }
  return best==null?null:new Date(best); }
const zt=d=>d?pad(d.getUTCDate())+pad(d.getUTCHours())+pad(d.getUTCMinutes())+'Z':'';
const hm=d=>d?pad(d.getUTCHours())+pad(d.getUTCMinutes())+'Z':'';
const hmc=d=>d?pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+'Z':'';

/* ---------- report elements ---------- */
const PH='DZ|RA|SN|SG|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS|IC';
const WXRE=new RegExp('^(\\+|-|VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?((?:'+PH+')*)$');
function isWx(t){ const m=t.match(WXRE); return !!m&&!!(m[2]||m[3]); }
// persistent = fog, mist, haze, smoke, dust, sand, continuous precipitation; transient = showers, thunderstorms, squalls, funnel cloud
function wxClass(list){ let per=false, tr=false; (list||[]).forEach(w=>{ const m=w.match(WXRE)||[]; const d=m[2]||'', p=m[3]||'';
    if(d==='SH'||d==='TS'||/SQ|FC|PO/.test(p)) tr=true; else if(/FG|BR|HZ|FU|DU|SA|SS|DS|VA|DZ|RA|SN|SG|PL|IC|UP/.test(p)) per=true; });
  return per?'persistent':tr?'transient':'none'; }
function smToM(s){ let m=s.match(/^(P|M)?(\d+)?(?:\s?(\d)\/(\d))?SM$/); if(!m) return null; let v=(m[2]?+m[2]:0)+(m[3]?+m[3]/+m[4]:0); if(m[1]==='P') v+=0.01; return Math.round(v*1609); }
// parse a run of weather elements (shared by METAR and every TAF group); returns the element object
function els(toks){
  const E={wind:null,wvar:null,vis:null,cavok:false,rvr:[],wx:[],nsw:false,clouds:[],nsc:false,vv:undefined,temp:null,dew:null,qnh:null,ws:[],re:[],unk:[]};
  for(let i=0;i<toks.length;i++){ const t=toks[i]; let m;
    if((m=t.match(/^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)$/))){ const f=m[4]==='MPS'?1.944:m[4]==='KMH'?0.54:1; E.wind={dir:m[1]==='VRB'?null:+m[1],vrb:m[1]==='VRB',spd:Math.round(+m[2]*f),gust:m[3]?Math.round(+m[3]*f):null,raw:t}; continue; }
    if((m=t.match(/^(\d{3})V(\d{3})$/))){ E.wvar=[+m[1],+m[2]]; continue; }
    if(t==='CAVOK'){ E.cavok=true; E.vis=10000; E.nsc=true; E.nsw=true; continue; }
    if((m=t.match(/^(\d{4})(NDV)?$/))&&E.vis==null){ E.vis=+m[1]===9999?10000:+m[1]; continue; }
    if((m=t.match(/^(\d{4})(N|NE|E|SE|S|SW|W|NW)$/))){ E.minVis=+m[1]; continue; }
    if(/^\d$/.test(t)&&/^\d\/\dSM$/.test(toks[i+1]||'')){ E.vis=smToM(t+' '+toks[i+1]); i++; continue; }
    if(/SM$/.test(t)&&smToM(t)!=null){ E.vis=Math.min(10000,smToM(t)); continue; }
    if((m=t.match(/^R(\d{2}[LCR]?)\/([PM]?)(\d{4})(?:V([PM]?)(\d{4}))?(?:FT)?([UDN])?$/))){ E.rvr.push({rwy:m[1],v:+m[3],pm:m[2]||'',max:m[5]?+m[5]:null,tr:m[6]||''}); continue; }
    if((m=t.match(/^(FEW|SCT|BKN|OVC)(\d{3}|\/\/\/)(CB|TCU|\/\/\/)?$/))){ E.clouds.push({c:m[1],h:m[2]==='///'?null:+m[2]*100,t:m[3]&&m[3]!=='///'?m[3]:''}); continue; }
    if((m=t.match(/^VV(\d{3}|\/\/\/)$/))){ E.vv=m[1]==='///'?null:+m[1]*100; continue; }
    if(/^(NSC|NCD|SKC|CLR)$/.test(t)){ E.nsc=true; continue; }
    if(t==='NSW'){ E.nsw=true; continue; }
    if((m=t.match(/^(M?\d{2})\/(M?\d{2})?$/))){ const f=x=>x==null?null:(x[0]==='M'?-1:1)*+x.replace('M',''); E.temp=f(m[1]); E.dew=m[2]?f(m[2]):null; continue; }
    if((m=t.match(/^Q(\d{4})$/))){ E.qnh=+m[1]; continue; }
    if((m=t.match(/^A(\d{4})$/))){ E.qnh=Math.round(+m[1]/100*33.8639); E.inhg=+m[1]/100; continue; }
    if(t==='WS'){ const nx=(toks[i+1]||''); if(nx==='ALL'){ E.ws.push('ALL'); i+=2; } else { const r=nx.match(/^R(?:WY)?(\d{2}[LCR]?)$/); E.ws.push(r?r[1]:'?'); if(r) i++; } continue; }
    if((m=t.match(/^RE(.+)$/))&&isWx(m[1])){ E.re.push(m[1]); continue; }
    if(/^R\d{2}[LCR]?\/.{6}$/.test(t)||/^R\/SNOCLO$/.test(t)){ E.rwyState=(E.rwyState||[]).concat(t); continue; }
    if(isWx(t)){ E.wx.push(t); continue; }
    if(/^T[XN]M?\d{2}\/\d{4}Z$/.test(t)||t==='AUTO'||t==='COR'||t==='AMD'||t==='NIL'||t==='='){ continue; }
    E.unk.push(t); }
  const layers=E.clouds.filter(c=>(c.c==='BKN'||c.c==='OVC')&&c.h!=null).map(c=>c.h); if(E.vv!=null) layers.push(E.vv);
  E.ceil=layers.length?Math.min(...layers):null; // null: no ceiling reported in this element set
  E.hasCloud=E.clouds.length>0||E.vv!==undefined||E.nsc;
  E.cb=E.clouds.some(c=>c.t==='CB'); E.tcu=E.clouds.some(c=>c.t==='TCU');
  return E; }
const tokens=raw=>String(raw||'').toUpperCase().replace(/=/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);

/* ---------- METAR ---------- */
function parseMetar(raw,ref){ const T=tokens(raw); if(!T.length) return null; let i=0; const M={raw:String(raw).trim(),type:'METAR'};
  if(/^(METAR|SPECI)$/.test(T[i])) M.type=T[i++]; while(/^(COR|AMD)$/.test(T[i]||'')) i++;
  if(/^[A-Z]{4}$/.test(T[i]||'')) M.station=T[i++];
  let m; if((m=(T[i]||'').match(/^(\d{2})(\d{2})(\d{2})Z$/))){ M.time=resolve(+m[1],+m[2],+m[3],ref); i++; }
  if(T[i]==='NIL'){ M.nil=true; return M; } if(T[i]==='AUTO'){ M.auto=true; i++; }
  let j=i; while(j<T.length&&!/^(NOSIG|BECMG|TEMPO|RMK)$/.test(T[j])) j++;
  Object.assign(M,els(T.slice(i,j))); M.trend=T.slice(j).join(' ').replace(/\s*RMK.*$/,''); return M; }

/* ---------- TAF ---------- */
function parseTaf(raw,ref){ const T=tokens(raw); if(!T.length) return null; let i=0; const F={raw:String(raw).trim(),groups:[]};
  if(T[i]==='TAF') i++; while(/^(AMD|COR|CNL)$/.test(T[i]||'')){ if(T[i]==='AMD') F.amd=true; if(T[i]==='CNL') F.cnl=true; i++; }
  if(T[i]==='TAF') i++; if(/^[A-Z]{4}$/.test(T[i]||'')) F.station=T[i++];
  let m; if((m=(T[i]||'').match(/^(\d{2})(\d{2})(\d{2})Z$/))){ F.issue=resolve(+m[1],+m[2],+m[3],ref); i++; }
  const r0=F.issue||ref; const per=(t,base)=>{ const q=t.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/); if(!q) return null; const a=resolve(+q[1],+q[2],0,base||r0), b=resolve(+q[3],+q[4],0,base||r0); if(a&&b&&b<a) b.setUTCMonth(b.getUTCMonth()+1); return [a,b]; };
  if(T[i]&&per(T[i])){ [F.from,F.to]=per(T[i]); i++; }
  if(T[i]==='NIL'){ F.nil=true; return F; }
  // split into groups
  const start=i, cuts=[]; for(let j=i;j<T.length;j++){ const t=T[j]; if(/^FM\d{6}$/.test(t)||t==='BECMG'||(t==='TEMPO'&&!/^PROB\d{2}$/.test(T[j-1]||''))||/^PROB\d{2}$/.test(t)) cuts.push(j); if(t==='RMK') { T.length=j; break; } }
  const segs=[[start,cuts[0]!=null?cuts[0]:T.length]].concat(cuts.map((c,k)=>[c,cuts[k+1]!=null?cuts[k+1]:T.length]));
  segs.forEach(([a,b],k)=>{ let tk=T.slice(a,b); if(!tk.length&&k) return; const g={raw:tk.join(' ')};
    if(k===0){ g.type='BASE'; g.from=F.from; g.to=F.to; }
    else if((m=tk[0].match(/^FM(\d{2})(\d{2})(\d{2})$/))){ g.type='FM'; g.from=resolve(+m[1],+m[2],+m[3],r0); g.to=F.to; tk=tk.slice(1); }
    else { let ty=tk[0]; tk=tk.slice(1); if(/^PROB\d{2}$/.test(ty)){ g.prob=+ty.slice(4); if(tk[0]==='TEMPO'){ ty=ty+' TEMPO'; tk=tk.slice(1); } } g.type=ty;
      if(tk[0]&&per(tk[0])){ [g.from,g.to]=per(tk[0]); tk=tk.slice(1); } }
    g.e=els(tk); F.groups.push(g); });
  // FM groups end where the next FM starts
  const fms=F.groups.filter(g=>g.type==='FM'); fms.forEach((g,k)=>{ if(fms[k+1]) g.to=fms[k+1].from; });
  const base=F.groups[0]; if(base&&fms[0]) base.to=fms[0].from;
  return F; }

/* ---------- TAF: what to plan with in a window ---------- */
const worseV=(a,b)=>a==null?b:b==null?a:Math.min(a,b);
const worseC=(a,b)=>a==null?b:b==null?a:Math.min(a,b); // null ceiling = none reported (unlimited)
function setEls(st,e,src,mode){ // mode: 'replace' | 'worse'
  if(e.vis!=null){ if(mode==='worse'){ if(st.vis==null||e.vis<st.vis){ st.vis=e.vis; st.vsrc=src; } } else { st.vis=e.vis; st.vsrc=src; } }
  if(e.hasCloud||e.cavok){ const c=e.cavok||e.nsc&&!e.clouds.length?null:e.ceil; if(mode==='worse'){ if(c!=null&&(st.ceil==null||c<st.ceil)){ st.ceil=c; st.csrc=src; } } else { st.ceil=c; st.csrc=src; } }
  if(e.wind&&mode!=='worse'){ st.wind=e.wind; st.wsrc=src; }
  if(e.wx.length||e.nsw){ st.wx= mode==='worse'? st.wx.concat(e.wx) : e.nsw?[]:e.wx.slice(); }
}
function prevailing(F,t){ const st={vis:null,ceil:null,wind:null,wx:[],winds:[]}; const g0=F.groups[0]; if(g0) setEls(st,g0.e,g0,'replace');
  F.groups.forEach(g=>{ if(g.type==='FM'&&g.from&&t>=g.from){ const n={vis:null,ceil:null,wind:null,wx:[],winds:[]}; setEls(n,g.e,g,'replace'); if(n.vis==null){ n.vis=st.vis; n.vsrc=st.vsrc; } if(!g.e.hasCloud&&!g.e.cavok){ n.ceil=st.ceil; n.csrc=st.csrc; } if(!n.wind){ n.wind=st.wind; n.wsrc=st.wsrc; } Object.assign(st,n); }
    if(g.type==='BECMG'&&g.from&&g.to){ if(t>=g.to) setEls(st,g.e,g,'replace'); else if(t>=g.from){ setEls(st,g.e,g,'worse'); if(g.e.wind) st.winds.push({w:g.e.wind,src:g}); } } });
  if(st.wind) st.winds.unshift({w:st.wind,src:st.wsrc}); return st; }
const lbl=g=>g.type==='BASE'?'TAF':g.type==='FM'?g.raw.split(' ')[0]:g.type+(g.from?' '+pad(g.from.getUTCDate())+pad(g.from.getUTCHours())+'/'+pad(g.to.getUTCDate())+pad(g.to.getUTCHours()):'');
/* t0,t1: Date. Returns {vis,ceil,vsrc,csrc,winds,notes[],covered} — notes explain each TEMPO/PROB/BECMG in the window */
function tafWindow(F,t0,t1){ if(!F||!F.groups.length||!t0||!t1) return null;
  const out={t0,t1,vis:null,ceil:null,vsrc:null,csrc:null,winds:[],notes:[],covered:!!(F.from&&F.to&&t0>=F.from&&t1<=F.to),partial:!!(F.from&&F.to&&t1>F.from&&t0<F.to)};
  const a=new Date(Math.max(t0,F.from||t0)), b=new Date(Math.min(t1,F.to||t1)); if(b<a) return out;
  const samples=[]; for(let t=+a;t<=+b;t+=10*60e3) samples.push(new Date(t)); samples.push(b);
  F.groups.forEach(g=>{ [g.from,g.to].forEach(x=>{ if(x&&x>=a&&x<=b) samples.push(new Date(+x-1),x); }); });
  const seen=new Set();
  samples.forEach(t=>{ const st=prevailing(F,t); if(st.vis!=null&&(out.vis==null||st.vis<out.vis)){ out.vis=st.vis; out.vsrc=st.vsrc; }
    if(st.ceil!=null&&(out.ceil==null||st.ceil<out.ceil)){ out.ceil=st.ceil; out.csrc=st.csrc; }
    st.winds.forEach(x=>{ const k=x.w.raw+lbl(x.src); if(!seen.has(k)){ seen.add(k); out.winds.push({w:x.w,src:x.src,kind:x.src.type}); } }); });
  // BECMG notes
  F.groups.filter(g=>g.type==='BECMG'&&g.from&&g.to&&g.from<=b&&g.to>=a).forEach(g=>{ out.notes.push({g,label:lbl(g),act:'becmg'}); });
  // TEMPO / PROB groups overlapping the window
  F.groups.filter(g=>/^(TEMPO|PROB)/.test(g.type)&&g.from&&g.to&&g.from<b&&g.to>a).forEach(g=>{ const mid=new Date(Math.max(+a,+g.from)), st=prevailing(F,mid);
    const dv=g.e.vis!=null&&(st.vis==null||g.e.vis<st.vis), gc=g.e.cavok?null:g.e.ceil, dc=gc!=null&&(st.ceil==null||gc<st.ceil);
    const better=(g.e.vis!=null&&st.vis!=null&&g.e.vis>st.vis)||(g.e.hasCloud&&!dc&&st.ceil!=null&&(gc==null||gc>st.ceil));
    const cls=wxClass(g.e.wx), pt=/TEMPO/.test(g.type)&&g.prob?'probtempo':g.prob?'prob':'tempo'; let act;
    if(!dv&&!dc) act= better?'improve':'nochange';
    else if(pt==='probtempo') act='ignore-probtempo';
    else if(cls==='transient') act='ignore-transient';
    else { act= cls==='none'?'apply-nowx':'apply'; if(dv&&(out.vis==null||g.e.vis<out.vis)){ out.vis=g.e.vis; out.vsrc=g; } if(dc&&(out.ceil==null||gc<out.ceil)){ out.ceil=gc; out.csrc=g; } }
    if(g.e.wind){ out.winds.push({w:g.e.wind,src:g,kind:g.type}); }
    out.notes.push({g,label:lbl(g),act,cls,dv,dc,vis:g.e.vis,ceil:gc,wx:g.e.wx,cb:g.e.cb}); });
  out.sig=F.groups.filter(g=>g.from&&g.to&&g.from<b&&g.to>a).some(g=>g.e.cb||g.e.wx.some(w=>/TS|FZ|\+|GR|SQ|FC/.test(w)));
  return out; }

/* ---------- wind ---------- */
function comps(w,hdg){ if(!w||w.dir==null||hdg==null) return null; const a=(w.dir-hdg)*Math.PI/180; const r=v=>Math.round(v);
  return {head:r(w.spd*Math.cos(a)),cross:r(w.spd*Math.sin(a)),gcross:w.gust?r(Math.abs(w.gust*Math.sin(a))):null,ghead:w.gust?r(w.gust*Math.cos(a)):null}; }
// runway ends from OurAirports pairs [[le,he,len],…]; heading = designator × 10 (magnetic, ±5°)
function rwyEnds(rws){ const o=[]; (rws||[]).forEach(r=>{ [r[0],r[1]].forEach(id=>{ const m=String(id||'').match(/^(\d{2})([LCR]?)$/); if(m) o.push({id,hdg:(+m[1]||36)*10,len:r[2]||null}); }); }); return o; }
function bestRwy(ends,w){ if(!ends.length) return null; if(!w||w.dir==null) return ends[0]; let b=null,bh=-1e9; ends.forEach(e=>{ const c=comps(w,e.hdg); if(c.head>bh){ bh=c.head; b=e; } }); return b; }

/* ---------- NOTAM (ICAO format) ---------- */
const QS={ // subject: 2nd+3rd letters of the Q-code
  FA:['aerodrome','flyplass'],MR:['runway','rullebane'],MX:['taxiway','taksebane'],MA:['movement area','manøvreringsområde'],MN:['apron','oppstillingsplattform'],MS:['stopway','stoppbane'],MT:['threshold','terskel'],MD:['declared distances','deklarerte distanser'],
  IC:['ILS','ILS'],ID:['ILS DME','ILS-DME'],IG:['ILS glide path','ILS-glidebane'],IL:['ILS localizer','ILS-localizer'],IN:['localizer (no ILS)','localizer (ikke ILS)'],IS:['ILS Cat I','ILS kat. I'],IT:['ILS Cat II','ILS kat. II'],IU:['ILS Cat III','ILS kat. III'],IO:['ILS outer marker','ILS ytre markør'],IM:['ILS middle marker','ILS midtre markør'],
  NA:['all radio navigation aids','alle radionavigasjonshjelpemidler'],NB:['NDB','NDB'],ND:['DME','DME'],NV:['VOR','VOR'],NM:['VOR/DME','VOR/DME'],NT:['VORTAC','VORTAC'],NN:['TACAN','TACAN'],NL:['locator','lokator'],
  GA:['GNSS for this aerodrome','GNSS for denne flyplassen'],GW:['GNSS area-wide','GNSS i området'],
  LA:['approach lights','innflygingslys'],LC:['runway centre line lights','senterlinjelys'],LE:['runway edge lights','kantlys'],LH:['high intensity runway lights','høyintensitets banelys'],LI:['runway end identifier lights','baneendelys (REIL)'],LP:['PAPI','PAPI'],LR:['all landing area lights','alle banelys'],LT:['threshold lights','terskellys'],LZ:['touchdown zone lights','touchdown-sonelys'],LB:['aerodrome beacon','flyplassfyr'],
  OB:['obstacle','hinder'],OL:['obstacle lights','hinderlys'],
  PI:['instrument approach procedure','instrumentinnflygingsprosedyre'],PA:['STAR','STAR'],PD:['SID','SID'],PU:['missed approach procedure','prosedyre for avbrutt innflyging'],PH:['holding procedure','ventemønster'],PK:['VFR approach procedure','VFR-innflygingsprosedyre'],PF:['flow control procedure','flytkontrollprosedyre'],PM:['aerodrome operating minima','flyplassminima'],
  RA:['airspace reservation','luftromsreservasjon'],RD:['danger area','fareområde'],RR:['restricted area','restriksjonsområde'],RP:['prohibited area','forbudt område'],RT:['temporary restricted area','midlertidig restriksjonsområde'],RO:['overflying','overflyging'],
  WA:['air display','flyoppvisning'],WM:['missile, gun or rocket firing','skyting'],WP:['parachute jumping','fallskjermhopping'],WU:['unmanned aircraft','ubemannede luftfartøy'],WE:['exercises','øvelser'],WL:['ascent of free balloon','ballongoppstigning'],WZ:['model flying','modellflyging'],
  CA:['air/ground facility','luft/bakke-tjeneste'],SA:['ATIS','ATIS'],ST:['tower','tårn'],SP:['approach control','innflygingskontroll'],AC:['control zone (CTR)','kontrollsone (CTR)'],AT:['TMA','TMA'],AF:['FIR','FIR']};
const QC={AS:['unserviceable','ute av drift'],AU:['not available','ikke tilgjengelig'],LC:['closed','stengt'],CT:['on test, do not use','under testing, ikke bruk'],AW:['withdrawn','trukket tilbake'],AH:['hours of service changed','endret åpningstid'],CH:['changed','endret'],CS:['installed','installert'],CA:['activated','aktivert'],CN:['cancelled','kansellert'],LT:['limited','begrenset'],LP:['prohibited','forbudt'],HW:['work in progress','arbeid pågår'],AP:['prior permission required','krever forhåndstillatelse (PPR)'],LL:['usable for length of / width of','brukbar lengde/bredde'],XX:['see text','se teksten'],TT:['trigger NOTAM','trigger-NOTAM'],AK:['resumed normal operation','normal drift igjen'],AO:['operational','i drift'],CC:['completed','fullført'],LH:['unserviceable for heavy aircraft','ute av drift for tunge fly'],LV:['closed to VFR','stengt for VFR'],LW:['will take place','finner sted'],CE:['erected','reist'],CR:['temporarily replaced by','midlertidig erstattet av']};
const AB={RWY:['runway','rullebane'],RWYS:['runways','rullebaner'],TWY:['taxiway','taksebane'],TWYS:['taxiways','taksebaner'],CLSD:['closed','stengt'],'U/S':['unserviceable','ute av drift'],AVBL:['available','tilgjengelig'],UNAVBL:['unavailable','utilgjengelig'],LOC:['localizer','localizer'],GP:['glide path','glidebane'],OBST:['obstacle','hinder'],LGT:['lights','lys'],LGTD:['lighted','opplyst'],ACFT:['aircraft','luftfartøy'],WIP:['work in progress','arbeid pågår'],AD:['aerodrome','flyplass'],APCH:['approach','innflyging'],PROC:['procedure','prosedyre'],DEP:['departure','avgang'],ARR:['arrival','ankomst'],FLT:['flight','flyging'],FLTS:['flights','flyginger'],HGT:['height','høyde'],ELEV:['elevation','høyde over havet'],BTN:['between','mellom'],MAINT:['maintenance','vedlikehold'],EXC:['except','unntatt'],PERM:['permanent','permanent'],EST:['estimated','estimert'],REF:['reference','referanse'],ACT:['active','aktiv'],TFC:['traffic','trafikk'],OPR:['operating','i drift'],OPS:['operations','operasjoner'],HR:['hours','timer'],HRS:['hours','timer'],DLY:['daily','daglig'],SR:['sunrise','soloppgang'],SS:['sunset','solnedgang'],FREQ:['frequency','frekvens'],CTN:['caution','forsiktig'],PSN:['position','posisjon'],THR:['threshold','terskel'],DTHR:['displaced threshold','forskjøvet terskel'],RTE:['route','rute'],SER:['service','tjeneste'],SVC:['service','tjeneste'],INSTL:['installed','installert'],WEF:['with effect from','gjelder fra'],TIL:['until','til'],REQ:['required','påkrevd'],PPR:['prior permission required','forhåndstillatelse kreves'],NML:['normal','normal'],MIL:['military','militær'],ATC:['ATC','ATC'],AGL:['above ground','over bakken'],AMSL:['above mean sea level','over havet'],FT:['ft','ft'],M:['m','m'],NM:['NM','NM'],DUE:['due to','på grunn av'],TEMPO:['temporarily','midlertidig'],TEMPORARILY:['temporarily','midlertidig'],AREA:['area','område'],CRANE:['crane','kran'],MAST:['mast','mast'],WINDTURBINE:['wind turbine','vindturbin'],ERECTED:['erected','satt opp'],RMK:['remark','merknad'],AUTH:['authorised','godkjent'],INFO:['information','informasjon'],BLDG:['building','bygning'],RAD:['radius','radius'],ALT:['altitude','høyde'],SFC:['surface','bakken'],UNL:['unlimited','ubegrenset'],GND:['ground','bakken'],INTERFERENCE:['interference','forstyrrelser'],UNRELIABLE:['unreliable','upålitelig'],JAMMING:['jamming','jamming'],SIGNAL:['signal','signal'],ALS:['approach lighting system','innflygingslys'],CL:['centre line','senterlinje'],EDGE:['edge','kant'],LIGHTS:['lights','lys'],NOT:['not','ikke'],OUT:['out','ute'],OF:['of','av'],SERVICE:['service','drift'],AND:['and','og'],OR:['or','eller'],WITH:['with','med'],FOR:['for','for'],TO:['to','til'],FM:['from','fra'],ON:['on','på'],AT:['at','ved'],IN:['in','i'],BY:['by','av'],ALL:['all','alle'],ONLY:['only','bare'],USE:['use','bruk'],MON:['Monday','mandag'],TUE:['Tuesday','tirsdag'],WED:['Wednesday','onsdag'],THU:['Thursday','torsdag'],FRI:['Friday','fredag'],SAT:['Saturday','lørdag'],SUN:['Sunday','søndag']};
function nTime(s){ const m=String(s||'').match(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/); if(!m) return null; return new Date(Date.UTC(2000+ +m[1],+m[2]-1,+m[3],+m[4],+m[5])); }
function splitNotams(text){ const t=String(text||'').replace(/\r/g,''); if(!t.trim()) return [];
  const re=/(?:^|\n|\s)(?=\(?[A-Z]\d{4}\/\d{2}\s+NOTAM[NRC]\b)/g; let parts=t.split(re).filter(s=>s.trim());
  if(parts.length<=1){ const q=t.split(/(?=(?:^|\n)\s*Q\)\s)/).filter(s=>/Q\)|E\)/.test(s)); if(q.length>1) parts=q; }
  if(parts.length<=1&&!/\b[QAE]\)/.test(t)) parts=t.split(/\n\s*\n/).filter(s=>s.trim());
  return parts.map(s=>s.trim()); }
function parseNotam(s){ const N={raw:s};
  let m=s.match(/\b([A-Z]\d{4}\/\d{2})\s*(NOTAM[NRC])?(?:\s+([A-Z]\d{4}\/\d{2}))?/); if(m){ N.id=m[1]; N.kind=m[2]||''; if(m[3]) N.repl=m[3]; }
  const pos=[]; const fr=/(?:^|[\s(])([QABCDEFG])\)\s?/g; let x; while((x=fr.exec(s))) pos.push({k:x[1],i:x.index+x[0].length,s:x.index});
  const f={}; pos.forEach((p,k)=>{ if(f[p.k]!=null) return; const end=pos.slice(k+1).find(q=>'QABCDEFG'.indexOf(q.k)>'QABCDEFG'.indexOf(p.k)); f[p.k]=s.slice(p.i,end?end.s:s.length).trim(); });
  N.f=f; if(f.E) N.E=f.E.replace(/\)\s*$/,'').replace(/\s*(CREATED|SOURCE):.*$/s,'').trim();
  if(f.Q){ const q=f.Q.split('/').map(z=>z.trim()); N.fir=q[0]; const qc=(q[1]||'').replace(/^Q/,''); if(qc.length>=4){ N.subj=qc.slice(0,2); N.cond=qc.slice(2,4); } N.lower=q[5]; N.upper=q[6]; }
  if(f.A) N.loc=f.A.split(/\s+/).filter(z=>/^[A-Z]{4}$/.test(z));
  if(f.B) N.from=nTime(f.B); if(f.C){ N.perm=/PERM/.test(f.C); N.est=/EST/.test(f.C); N.to=N.perm?null:nTime(f.C); } if(f.D) N.sched=f.D;
  if(!N.E&&!f.Q){ N.E=s.replace(/^\(?[A-Z]\d{4}\/\d{2}\s*NOTAM[NRC]?\s*/,'').trim(); const a=s.match(/\b(E[A-Z]{3}|[A-Z]{4})\b/); if(a&&!N.loc) N.loc=[a[1]]; }
  N.impacts=impacts(N); return N; }
const PHR=[[/\bDUE TO\b/g,['due to','på grunn av']],[/\bNOT AVBL\b/g,['not available','ikke tilgjengelig']],[/\bOUT OF SERVICE\b/g,['out of service','ute av drift']],[/\bU\/S\b/g,['unserviceable','ute av drift']],[/\bH24\b/g,['24 hours','hele døgnet']],[/\b(\d+)FT\b/g,['$1 ft','$1 ft']],[/\b(\d+)M\b/g,['$1 m','$1 m']]];
function plain(E,l){ const L=l==='no'?1:0; let t=String(E||'').toUpperCase(); const keep=[]; PHR.forEach(([re,v])=>{ t=t.replace(re,(...a)=>{ keep.push(v[L].replace(/\$1/,a[1])); return ' \u0001'+(keep.length-1)+'\u0001 '; }); });
  return t.replace(/\s+/g,' ').trim().split(' ').map(w=>{ const p=w.match(/^([^A-Z0-9/]*)([A-Z0-9/]+?)([.,;:)]*)$/); if(!p) return w; const k=p[2]; const v=AB[k]; return v? p[1]+v[L]+p[3] : w; }).join(' ').replace(/\u0001(\d+)\u0001/g,(m,i)=>keep[+i]).replace(/\s+([.,;:])/g,'$1').replace(/^./,c=>c.toUpperCase()); }
function impacts(N){ const s=N.subj||'', c=N.cond||'', E=' '+String(N.E||'').toUpperCase().replace(/\s+/g,' ')+' '; const out=[];
  const us=/\b(U\/S|UNSERVICEABLE|NOT AVBL|UNAVBL|OUT OF SERVICE|NOT AVAILABLE|WITHDRAWN)\b/.test(E)||['AS','AU','CT','AW'].includes(c);
  if((/^I[CDGLSTU]$/.test(s)&&['AS','AU','CT','AW','LT'].includes(c))||(/\b(ILS|LOC|GP|GLIDE ?PATH|LLZ)\b/.test(E)&&us&&!/^[NLPO]/.test(s))) out.push({k:'ils',lvl:'hi'});
  if((s==='FA'&&c==='LC')||/\bAD CLSD\b|\bAERODROME CLOSED\b/.test(E)) out.push({k:'adclsd',lvl:'hi'});
  else if((s==='MR'&&['LC','LT','LL','HW'].includes(c))||/\bRWY\s*\d{2}[LCR]?(\/\d{2}[LCR]?)?\s+(IS\s+)?CLSD\b/.test(E)) { const r=E.match(/RWY\s*(\d{2}[LCR]?)(?:\/(\d{2}[LCR]?))?/); out.push({k:c==='LC'||/CLSD/.test(E)?'rwyclsd':'rwylim',lvl:'hi',rwy:r?[r[1],r[2]].filter(Boolean):[]}); }
  if(s==='MD'||/\b(TORA|TODA|ASDA|LDA)\b/.test(E)) out.push({k:'decl',lvl:'md'});
  if(/^N[ABDVMTNL]$/.test(s)&&us||(/\b(VOR|NDB|DME|TACAN|VORTAC)\b/.test(E)&&us&&!/^I/.test(s))) out.push({k:'navaid',lvl:'md'});
  if(/^G[AW]$/.test(s)||/\b(GNSS|GPS)\b.*\b(INTERFERENCE|JAMMING|UNRELIABLE|U\/S|NOT AVBL|OUTAGE|SPOOFING)\b/.test(E)) out.push({k:'gnss',lvl:'md'});
  if(/^P[IUDAH]$/.test(s)||/\b(APCH|IAP|SID|STAR)\b.*\b(NOT AVBL|SUSPENDED|U\/S|WITHDRAWN|CHANGED)\b/.test(E)) out.push({k:'proc',lvl:'md'});
  if(/^L[ACEHIPRTZ]$/.test(s)&&us||/\b(ALS|PAPI|APCH LGT|RWY LGT|EDGE LGT|CL LGT|LIGHTS?)\b.*\bU\/S\b/.test(E)) out.push({k:'lights',lvl:'md'});
  if(/^O[BL]$/.test(s)||/\b(OBST|CRANE|MAST|WIND ?TURBINE)\b/.test(E)){ const h=E.match(/(\d{2,5})\s?FT\s?(AMSL|AGL)/); out.push({k:'obst',lvl:'md',h:h?h[1]+' ft '+h[2]:''}); }
  if(/^R[ADRPT]$/.test(s)||/^W/.test(s)) out.push({k:'airspace',lvl:'lo'});
  if(s==='FA'&&c==='AH'||/\bAD HR\b|\bOPR HR\b|\bHOURS? OF (OPS|SERVICE)\b/.test(E)) out.push({k:'hours',lvl:'md'});
  return out; }
function parseNotams(text){ return splitNotams(text).map(parseNotam).filter(n=>n.E||n.f.Q); }
function overlap(N,t0,t1){ if(!t0||!t1) return null; const a=N.from||null, b=N.to||null; if(a&&a>t1) return 'later'; if(b&&b<t0) return 'ended'; if(!a&&!b) return null; return N.sched?'sched':'active'; }

const PHN={DZ:['drizzle','yr'],RA:['rain','regn'],SN:['snow','snø'],SG:['snow grains','kornsnø'],PL:['ice pellets','iskorn'],GR:['hail','hagl'],GS:['small hail','sprøhagl'],UP:['unknown precipitation','ukjent nedbør'],BR:['mist','tåkedis'],FG:['fog','tåke'],FU:['smoke','røyk'],VA:['volcanic ash','vulkansk aske'],DU:['dust','støv'],SA:['sand','sand'],HZ:['haze','dis'],PO:['dust whirls','støvvirvler'],SQ:['squalls','kastevind'],FC:['funnel cloud','traktsky'],SS:['sandstorm','sandstorm'],DS:['duststorm','støvstorm'],IC:['ice crystals','iskrystaller']};
const DSC={MI:['shallow','grunn'],BC:['patches of','flak av'],PR:['partial','delvis'],DR:['low drifting','lavt drivende'],BL:['blowing','føyke av'],SH:['showers of','byger av'],TS:['thunderstorm','tordenvær'],FZ:['freezing','underkjølt']};
function wxText(t,l){ const L=l==='no'?1:0; const m=String(t).match(WXRE); if(!m) return t; const p=(m[3].match(/../g)||[]).map(c=>PHN[c]?PHN[c][L]:c).join(L?' og ':' and '); let s;
  if(m[2]==='TS') s=DSC.TS[L]+(p?(L?' med ':' with ')+p:''); else s=(m[2]?DSC[m[2]][L]+' ':'')+(p||(m[2]==='SH'?(L?'nedbør':'precipitation'):''));
  if(m[1]==='-') s=(L?'svak ':'light ')+s; else if(m[1]==='+') s=(L?'kraftig ':'heavy ')+s; else if(m[1]==='VC') s+=(L?' i nærheten':' in the vicinity'); return s.trim(); }

const API={wxText,pad,resolve,zt,hm,hmc,tokens,els,isWx,wxClass,parseMetar,parseTaf,prevailing,tafWindow,lbl,comps,rwyEnds,bestRwy,parseNotams,parseNotam,splitNotams,impacts,plain,overlap,QS,QC};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else G.WXK=API;
})(typeof window!=='undefined'?window:globalThis);
