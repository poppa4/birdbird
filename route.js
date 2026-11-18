/* NORDAP – Route Explorer (route.html). Moved out of the page so the browser keeps it (cached by ?v=, see _headers). */
(function(){
'use strict';
const {L,el}=LAB, esc=NAI.esc;
/* icons (class ic, lab.css) */
const SET_IC='<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/></svg>', EDIT_IC='<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4.2L16.3 4.5a2.2 2.2 0 013.2 3.2L8.2 19z"/><path d="M14.3 6.5l3.2 3.2"/></svg>';
const NSV='http://www.w3.org/2000/svg';
const XT=[['rwy','Runway / aerodrome'],['sid','SID / exit fix'],['wpt','Waypoint'],['iaf','IAF'],['if','IF'],['hold','Hold'],['faf','FAF / FAP'],['da','DA / MDA'],['missed','Missed approach'],['alt','Alternate']];
const APPT=['if','faf','da','missed'];
const pnum=v=>{ if(v==null) return null; const t=String(v).trim().toUpperCase(); if(!t) return null; const fl=t.match(/^FL\s*(\d{2,3})$/); if(fl) return +fl[1]*100; const n=parseFloat(t.replace(',','.').replace(/[^0-9.\-]/g,'')); return Number.isFinite(n)?n:null; };
// number formatting: one cached Intl.NumberFormat per language and decimals (toLocaleString builds a new one on every call)
const FXC={}; const fx=(v,d)=>{ if(v==null||!Number.isFinite(v)) return ''; d=d||0; const k=LAB.lang+d; const f=FXC[k]||(FXC[k]=new Intl.NumberFormat(LAB.lang==='no'?'nb-NO':'en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})); return f.format(Math.round(v*10**d)/10**d); };
const taOf=()=>{ const v=R&&R.s&&pnum(R.s.ta); return v||7000; };
const altTxt=a=>a==null?'':a>taOf()?'FL'+String(Math.round(a/100)).padStart(3,'0'):fx(a);
function niceTop(t){ const v=t<10000? t*1.2+300 : t*1.15; const st=v<=5000?500:v<=12500?1000:2500; return Math.ceil(v/st)*st; }
function axStep(m){ const raw=m/7; for(const s of [250,500,1000,2000,2500,5000,10000]) if(s>=raw) return s; return 10000; }
const R2D=180/Math.PI, D2R=Math.PI/180;
function gc(a,b){ const p1=a.la*D2R,p2=b.la*D2R,dl=(b.lo-a.lo)*D2R; const d=2*Math.asin(Math.sqrt(Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2)); return d*R2D*60; }
function brg(a,b){ const p1=a.la*D2R,p2=b.la*D2R,dl=(b.lo-a.lo)*D2R; const y=Math.sin(dl)*Math.cos(p2), x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl); return (Math.atan2(y,x)*R2D+360)%360; }
function magVar(a,b){ if(!window.WMM||a.la==null||b.la==null) return null; const la=(a.la+b.la)/2, lo=a.lo+(((b.lo-a.lo+540)%360)-180)/2; try{ return WMM.declination(la,lo,0); }catch(e){ return null; } }
const mcOf=(tt,v)=>String(Math.round(((tt-v)%360+360)%360)||360).padStart(3,'0');

/* ---------- koordinater ---------- */
function dms(deg,min,sec,h){ let v=(+deg)+(+min||0)/60+(+sec||0)/3600; if(/[SW]/i.test(h)) v=-v; return v; }
function parseLL(s){ const t=String(s||'').toUpperCase().replace(/[°º'’"″,]/g,' ').replace(/\s+/g,' ').trim(); let m;
  if((m=t.match(/^([NS])?\s?(\d{2})(\d{2})(\d{2}(?:\.\d+)?)?\s?([NS])?\s?([EW])?\s?(\d{3})(\d{2})(\d{2}(?:\.\d+)?)?\s?([EW])?$/))&&(m[1]||m[5])&&(m[6]||m[10])) return [dms(m[2],m[3],m[4],m[1]||m[5]),dms(m[7],m[8],m[9],m[6]||m[10])];
  if((m=t.match(/^([NS])?\s?(\d{1,2}) (\d{1,2}) (\d{1,2}(?:\.\d+)?)\s?([NS])?\s([EW])?\s?(\d{1,3}) (\d{1,2}) (\d{1,2}(?:\.\d+)?)\s?([EW])?$/))&&(m[1]||m[5])&&(m[6]||m[10])) return [dms(m[2],m[3],m[4],m[1]||m[5]),dms(m[7],m[8],m[9],m[6]||m[10])];
  if((m=t.match(/^([NS])?\s?(\d{1,2}) (\d{1,2}(?:\.\d+)?)\s?([NS])?\s([EW])?\s?(\d{1,3}) (\d{1,2}(?:\.\d+)?)\s?([EW])?$/))&&(m[1]||m[4])&&(m[5]||m[8])) return [dms(m[2],m[3],0,m[1]||m[4]),dms(m[6],m[7],0,m[5]||m[8])];
  if((m=t.match(/^([NS])?\s?(-?\d{1,2}\.\d+)\s?([NS])?\s([EW])?\s?(-?\d{1,3}\.\d+)\s?([EW])?$/))){ let a=+m[2], b=+m[5]; if(/S/.test(m[1]||m[3]||'')) a=-Math.abs(a); if(/W/.test(m[4]||m[6]||'')) b=-Math.abs(b); return [a,b]; }
  return null; }
const llOk=ll=>ll&&Math.abs(ll[0])<=90&&Math.abs(ll[1])<=180;
const llTxt=(la,lo)=>{ const f=(v,w,h)=>{ const a=Math.abs(v), d=Math.floor(a), mm=(a-d)*60, m=Math.floor(mm), s=Math.round((mm-m)*60); const [D,M,S]= s===60? [d,m+1,0] : [d,m,s]; return String(D).padStart(w,'0')+String(M===60?0:M).padStart(2,'0')+String(S).padStart(2,'0')+(v<0?h[1]:h[0]); }; return f(la,2,'NS')+' '+f(lo,3,'EW'); };
function parseList(text){ const out=[]; String(text||'').split(/\n|;/).forEach(line=>{ const t=line.trim(); if(!t) return; const m=t.match(/^([A-Z][A-Z0-9]{1,6})\b[\s:,\-–]+(.+)$/i); if(!m) return; const rest=m[2]; const toks=rest.split(/\s+/); for(let n=toks.length;n>=2;n--){ for(let i=0;i+n<=toks.length;i++){ const ll=parseLL(toks.slice(i,i+n).join(' ')); if(llOk(ll)){ out.push({n:m[1].toUpperCase(),la:ll[0],lo:ll[1]}); return; } } } }); return out; }

/* ---------- data ---------- */
let NAV=null, MAP=null, FIX=[];
let AWY={}; fetch('data/airways-nordic.json').then(r=>r.ok?r.json():{}).then(j=>{ AWY=j||{}; }).catch(()=>{});
new MutationObserver(()=>srcDates()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
function srcDates(){ const d=el('srcdates'); if(!d||!NAV) return; const m=/(\d{4}-\d{2}-\d{2})/.exec(NAV.src||''), f=NAV.fxSrc||{}, dt=x=>{ const k=/(\d{1,2} [A-Z]{3} \d{4})\)?$/.exec(x||''); return k?k[1]:''; };
  d.textContent=L({en:'Data dates. ',no:'Datadatoer. '})+[m?L({en:'Airports and navaids: OurAirports, downloaded '+m[1]+'.',no:'Flyplasser og radiofyr: OurAirports, lastet ned '+m[1]+'.'}):'', dt(f.FI)?L({en:'IFR points Finland: eAIP of '+dt(f.FI)+'.',no:'IFR-punkter Finland: eAIP fra '+dt(f.FI)+'.'}):'', dt(f.IS)?L({en:'IFR points Iceland: eAIP of '+dt(f.IS)+'.',no:'IFR-punkter Island: eAIP fra '+dt(f.IS)+'.'}):'',
   L({en:'Airspace, reporting points and obstacles: fetched from openAIP when you open the layer; openAIP gives no date for each item.',no:'Luftrom, meldepunkter og hindre: hentes fra openAIP når du åpner laget; openAIP oppgir ingen dato for hvert element.'}), L({en:'Weather: the time is shown with each report.',no:'Vær: tidspunktet vises med hver melding.'})].filter(Boolean).join(' '); }
const navReady=Promise.all([fetch('data/nav-eu.json').then(r=>r.json()),fetch('data/fixes-nordic.json').then(r=>r.ok?r.json():{pts:[],src:{}}).catch(()=>({pts:[],src:{}}))]).then(([j,fx])=>{ NAV=j; NAV.apI={}; j.ap.forEach(a=>NAV.apI[a[0]]=a); NAV.nvI={}; j.nv.forEach(n=>{ (NAV.nvI[n[0]]=NAV.nvI[n[0]]||[]).push(n); }); NAV.fx=fx.pts; NAV.fxSrc=fx.src; srcDates(); NAV.fxI={}; fx.pts.forEach(p=>{ (NAV.fxI[p[0]]=NAV.fxI[p[0]]||[]).push(p); }); }).catch(()=>{ NAV={ap:[],nv:[],apI:{},nvI:{},fx:[],fxI:{}}; });
const mapReady=fetch('data/map-eu.json').then(r=>r.json()).then(j=>{ const dec=a=>{ const pts=[]; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(let i=0;i<a.length;i+=2){ const lo=a[i]/100, la=a[i+1]/100; pts.push(lo,la); if(lo<x0)x0=lo; if(lo>x1)x1=lo; if(la<y0)y0=la; if(la>y1)y1=la; } return {p:pts,b:[x0,y0,x1,y1]}; }; MAP={coast:j.coast.map(dec),border:j.border.map(dec),land:(j.land||[]).map(dec)}; }).catch(()=>{ MAP={coast:[],border:[],land:[]}; });

function resolve(tok,prev){ // én rutetekst-bit -> punkt
  let [name,alt]=tok.split('/'); name=name.toUpperCase(); const a=alt!=null?pnum(alt):null;
  const ll=parseLL(name.replace(/([NS])(\d)/,'$1 $2'))||parseLL(name);
  if(llOk(ll)){ const dm=(v,w,h)=>{ const a=Math.abs(v), d=Math.floor(a), m=Math.round((a-d)*60); return String(m===60?d+1:d).padStart(w,'0')+String(m===60?0:m).padStart(2,'0')+(v<0?h[1]:h[0]); }; return {n:dm(ll[0],2,'NS')+dm(ll[1],3,'EW'),t:'wpt',la:ll[0],lo:ll[1],a}; }
  const f=FIX.find(x=>x.n===name); if(f) return {n:f.n,t:'wpt',la:f.la,lo:f.lo,a,src:'fix'};
  if(AWYPT[name]) return {n:name,t:'wpt',la:AWYPT[name][0],lo:AWYPT[name][1],a,note:AWYPT[name][2],src:'aip'};
  const ap=NAV.apI[name]; if(ap) return {n:name,t:'rwy',la:ap[2],lo:ap[3],a,elev:ap[4],src:'ap'};
  const nv=NAV.nvI[name]; if(nv&&nv.length){ let best=nv[0]; if(prev&&prev.la!=null) best=nv.slice().sort((x,y)=>gc(prev,{la:x[4],lo:x[5]})-gc(prev,{la:y[4],lo:y[5]}))[0]; return {n:name,t:'wpt',la:best[4],lo:best[5],a,note:best[2]+(best[3]?' '+best[3]:''),src:'nv'}; }
  const af=NAV.fxI&&NAV.fxI[name]; if(af&&af.length){ let best=af[0]; if(prev&&prev.la!=null) best=af.slice().sort((x,y)=>gc(prev,{la:x[1],lo:x[2]})-gc(prev,{la:y[1],lo:y[2]}))[0]; return {n:name,t:'wpt',la:best[1],lo:best[2],a,note:'AIP '+best[3],src:'aip'}; }
  return {n:name,t:'wpt',a,miss:1};
}

/* ---------- tilstand ---------- */
let R=null, ALL=[], dirty=null, selI=-1;
const blank=()=>({mk:[],wx:'',id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),title:'',pts:[],s:{cr:'',cl:'',ds:'',msa:'',frz:'',cb:'',ct:'',cw:'',mg:'1000'},app:{}});
function title(){ const p=R.pts.filter(x=>x.t==='rwy'); return p.length? p.map(x=>x.n).filter((v,i,a)=>i===0||i===a.length-1).join(' – ') : L({en:'New route',no:'Ny rute'}); }
function queueSave(){ hPush(); el('saved').textContent=L({en:'Saving…',no:'Lagrer…'}); clearTimeout(dirty); dirty=setTimeout(async()=>{ R.title=title(); const m=await NSTORE.put('route',R); el('saved').textContent= m==='account'?L({en:'Saved to your profile',no:'Lagret på profilen din'}):L({en:'Saved in this browser',no:'Lagret i denne nettleseren'}); drawSel(); linkSync(); },600); }
function drawSel(){ el('sel').innerHTML=ALL.map(r=>`<option value="${r.id}" ${r===R?'selected':''}>${esc(r.title||L({en:'New route',no:'Ny rute'}))}</option>`).join(''); }
const S=k=>R.s[k];
const sNum=(k,d)=>{ const v=pnum(S(k)); return v==null?d:v; };

/* ---------- beregning ---------- */
function compute(pmo){
  const pts=R.pts, cr=sNum('cr',null), cl=sNum('cl',400), ds=sNum('ds',318);
  // avstander
  let cum=0; const C=pts.map((p,i)=>{ let d=0; if(i){ const q=pts[i-1]; const man=pnum(p.d); if(man!=null) d=man; else if(p.la!=null&&q.la!=null) d=gc(q,p); else { let j=i-1; while(j>=0&&pts[j].la==null) j--; d=(j>=0&&p.la!=null)? gc(pts[j],p) : 0; } } cum+=d; return {p,i,d,x:cum}; });
  const total=cum;
  // ønsket høyde per punkt
  const lastRwy=(()=>{ for(let i=pts.length-1;i>=0;i--) if(pts[i].t==='rwy'&&i>0) return i; return -1; })();
  C.forEach((c,i)=>{ const p=c.p; let a=pnum(p.a);
    if(a==null){ if(p.t==='rwy') a=pnum(p.elev)??0; else if(p.t==='hold'&&i) a=C[i-1].tgt; else a=cr??(i&&C[i-1].p.t!=='rwy'?C[i-1].tgt:3000); }
    c.tgt=a; c.auto=pnum(p.a)==null&&!['rwy','hold'].includes(p.t); c.app=APPT.includes(p.t)||(p.t==='rwy'&&i===lastRwy&&i>0&&C.slice(0,i).some(q=>['faf','da'].includes(q.p.t))); });
  // punkter uten egen høyde: ikke høyere enn det du rekker å stige til, eller må ned fra, ved gradientene dine
  C.forEach((c,i)=>{ if(!c.auto||c.p.t==='missed'||c.p.t==='alt') return; let cap=Infinity;
    for(let j=i+1;j<C.length;j++){ const q=C[j]; if(q.p.t==='missed'||q.p.t==='alt') break; if(!q.auto&&q.p.t!=='hold'){ cap=Math.min(cap,q.tgt+(q.x-c.x)*ds); break; } }
    for(let k=i-1;k>=0;k--){ const q=C[k]; if(!q.auto&&q.p.t!=='hold'){ cap=Math.min(cap,q.tgt+(c.x-q.x)*cl); break; } }
    if(cap<c.tgt) c.tgt=Math.max(0,Math.floor(cap/100)*100); });
  // profil: stig tidlig, sink sent
  const path=[]; const ev=[]; let toc=null, tod=null;
  C.forEach((c,i)=>{ if(!i){ path.push([c.x,c.tgt]); return; } const pv=C[i-1], a0=pv.tgt, a1=c.tgt, dx=c.x-pv.x;
    if(c.p.t==='missed'||c.p.t==='alt'){ return; }
    if(c.app||pv.p.t==='da'||c.p.t==='hold'||dx<=0){ if(dx>0&&a1<a0){ const g=(a0-a1)/dx; if(g>ds*1.6&&!c.app) c.steep=Math.round(g); } path.push([c.x,a1]); return; }
    const pinned=pnum(c.p.a)!=null||c.p.t==='rwy'||c.p.t==='iaf';
    let mid=Math.max(a0, pinned? a1 : a0, (cr!=null&&!(pnum(c.p.a)!=null&&pnum(c.p.a)<cr&&c.p.t!=='iaf'&&c.p.t!=='rwy'))? cr : -1);
    if(!pinned) mid=Math.max(mid,a1);
    let up=(mid-a0)/cl, dn=(mid-a1)/ds;
    if(up+dn>dx){ // når ikke midthøyden: møtes underveis
      const pk=(a0/cl+a1/ds+dx)/(1/cl+1/ds); if(pk>=Math.max(a0,a1)){ mid=pk; up=(mid-a0)/cl; dn=(mid-a1)/ds; } else if(a1>a0){ c.short=Math.round((a1-a0)/dx); mid=a1; up=dx; dn=0; } else { c.steep=Math.round((a0-a1)/dx); mid=a0; up=0; dn=dx; } }
    if(up>0) path.push([pv.x+up,mid]); if(cr!=null&&Math.abs(mid-cr)<1&&up>0&&!toc) toc={x:pv.x+up,a:mid};
    if(dn>0){ path.push([c.x-dn,mid]); if(cr!=null&&Math.abs(mid-cr)<1) tod={x:c.x-dn,a:mid}; }
    path.push([c.x,a1]); c.tgt=a1; });
  const altAt=x=>{ for(let k=1;k<path.length;k++){ const [x0,y0]=path[k-1],[x1,y1]=path[k]; if(x<=x1+1e-9){ return x1===x0? y1 : y0+(y1-y0)*(x-x0)/(x1-x0); } } return path.length?path[path.length-1][1]:0; };
  // ankere for posisjon langs ruten
  const anc=C.filter(c=>c.p.la!=null).map(c=>({x:c.x,la:c.p.la,lo:c.p.lo}));
  const posAt=x=>{ if(!anc.length) return null; if(x<=anc[0].x) return anc[0]; for(let k=1;k<anc.length;k++){ if(x<=anc[k].x){ const a=anc[k-1],b=anc[k], f=(x-a.x)/Math.max(1e-6,b.x-a.x); return {la:a.la+(b.la-a.la)*f,lo:a.lo+(b.lo-a.lo)*f,tr:brg(a,b)}; } } return anc[anc.length-1]; };
  const PM=pmo||pmode(); if(PM!=='adv'){ toc=tod=null; if(cr!=null){ path.length=0; path.push([0,cr],[total,cr]); C.forEach(c=>{ if(c.p.t!=='rwy') c.tgt=cr; c.steep=c.short=0; }); } }
  return {C,total,path,toc,tod,altAt,posAt,cr,cl,ds,PM};
}

/* ---------- terreng ---------- */
let TP=null, terKey='';
async function terrainProfile(M){
  if(!window.TERRAIN||!M.total) return null;
  const ok=await TERRAIN.ready; if(!ok) return null;
  const cw=sNum('cw',4.3), step=Math.max(0.25,M.total/400);
  const key=JSON.stringify([R.pts.map(p=>[p.la,p.lo,p.d]),cw]); if(key===terKey) return TP; terKey=key;
  const lastA=Math.max(0,...M.C.filter(c=>c.p.la!=null).map(c=>c.x)); const S0=[]; for(let x=0;x<=lastA+1e-6;x+=step){ const p=M.posAt(x); if(p) S0.push({x,p}); }
  const tiles=new Set(); S0.forEach(s=>{ for(const dla of [-0.1,0,0.1]) for(const dlo of [-0.2,0,0.2]) tiles.add(TERRAIN.tileOf(s.p.la+dla,s.p.lo+dlo)); });
  await TERRAIN.load([...tiles]);
  const out=S0.map(s=>{ const tr=(s.p.tr==null?0:s.p.tr)*D2R; let mx=null, c0=null; const nOff=Math.max(1,Math.ceil(cw)); for(let k=-nOff;k<=nOff;k++){ const o=k*cw/nOff; const la=s.p.la+o*Math.cos(tr+Math.PI/2)/60, lo=s.p.lo+o*Math.sin(tr+Math.PI/2)/60/Math.cos(s.p.la*D2R); const e=TERRAIN.get(la,lo); if(e!=null&&(mx==null||e>mx)) mx=e; if(k===0) c0=e; } return {x:s.x,e:mx,c:c0}; });
  let hr=false; try{ await HR.ready; const I=HR.idx; if(I){ const ks=new Set(); let inside=true; S0.forEach(q=>{ const a=Math.floor(q.p.la/I.deg)*I.deg, o=Math.floor(q.p.lo/I.deg)*I.deg; if(a<54||a>=72||o<4||o>=32) inside=false; else if(I.tiles.includes(a+'_'+o)) ks.add(a+'_'+o); });
    if(inside){ await Promise.all([...ks].map(hrTile)); out.forEach((o,i)=>{ const q=S0[i].p; const v=hrGet(q.la,q.lo); o.c=v; if(o.e!=null&&v>o.e) o.e=v; }); hr=true; } } }catch(e){}
  TP={pts:out,hr,cov:out.filter(o=>o.e!=null).length/Math.max(1,out.length)}; return TP;
}

/* ---------- METAR on the map (/api/wx: MET Norway for EN**, aviationweather.gov for the rest) ----------
   Airports on the route, medium and large airports within 20 NM of it, and in view when zoomed in. At most 8 ids per
   request (the function's limit), 3 requests per update and 6 per minute; each answer (also "no METAR") is kept 5 min. */
const WXS={c:{},t:0,hist:[],busy:false,lib:null,idx:null};
const WX_TTL=5*60e3;
function wxLib(){ if(window.WXK) return Promise.resolve(); return WXS.lib||(WXS.lib=new Promise((ok,ko)=>{ const sc=document.createElement('script'); sc.src='wxkit.js?v=3'; sc.onload=ok; sc.onerror=()=>{ WXS.lib=null; ko(new Error('wxkit')); }; document.head.appendChild(sc); })); }
function wxCat(m){ if(!m||m.nil) return null; const vis=m.vis==null?null:m.vis/1609.34, cig=m.cavok?null:m.ceil; if(vis==null&&cig==null&&!m.cavok&&!m.hasCloud) return null;
  /* European categories from SERA (EU 923/2012): VFR in a control zone needs ground visibility ≥ 5 km and ceiling ≥ 1500 ft (SERA.5005(b)); special VFR needs ≥ 1500 m and ceiling ≥ 600 ft (SERA.5010); below that only IFR */
  const c=v=>v!=null, vm=m.vis==null?null:m.vis; if(m.cavok) return 'VFR'; if((c(cig)&&cig<600)||(c(vm)&&vm<1500)) return 'IFR'; if((c(cig)&&cig<1500)||(c(vm)&&vm<5000)) return 'SVFR'; return 'VFR'; }
function wxWanted(){ if(!NAV||!ML) return []; const out=[], add=id=>{ if(/^[A-Z]{4}$/.test(id)&&!out.includes(id)) out.push(id); };
  (R&&R.pts||[]).forEach(p=>{ if(p.t==='rwy'&&p.la!=null) add(String(p.n||'').toUpperCase()); });
  const P=(R&&R.pts||[]).filter(p=>p.la!=null&&!['missed'].includes(p.t)); if(P.length>=2){ const sm=[]; for(let i=1;i<P.length;i++){ const a=P[i-1], b=P[i], n=Math.max(1,Math.ceil(gc(a,b)/6)); for(let k=0;k<=n;k++) sm.push({la:a.la+(b.la-a.la)*k/n,lo:a.lo+(b.lo-a.lo)*k/n}); }
    let a0=90,a1=-90,o0=180,o1=-180; sm.forEach(q=>{ a0=Math.min(a0,q.la); a1=Math.max(a1,q.la); o0=Math.min(o0,q.lo); o1=Math.max(o1,q.lo); });
    NAV.ap.filter(a=>(a[5]||0)>=1&&a[2]>a0-0.4&&a[2]<a1+0.4&&a[3]>o0-0.9&&a[3]<o1+0.9).map(a=>({a,d:Math.min(...sm.map(q=>gc(q,{la:a[2],lo:a[3]})))})).filter(x=>x.d<20).sort((x,y)=>x.d-y.d).slice(0,12).forEach(x=>add(x.a[0])); }
  if(ML.getZoom()>=6.5){ const b=ML.getBounds(), c=ML.getCenter(); NAV.ap.filter(a=>(a[5]||0)>=1&&b.contains([a[3],a[2]])).sort((x,y)=>(y[5]-x[5])||(gc({la:x[2],lo:x[3]},{la:c.lat,lo:c.lng})-gc({la:y[2],lo:y[3]},{la:c.lat,lo:c.lng}))).slice(0,16).forEach(a=>add(a[0])); }
  return out.slice(0,24); }
function wxSoon(){ clearTimeout(WXS.t); WXS.t=setTimeout(()=>wxSync(),700); }
async function wxFetch(ids){ const now=Date.now(); WXS.hist=WXS.hist.filter(t=>now-t<60e3); if(WXS.hist.length>=6) return false; WXS.hist.push(now);
  ids.forEach(id=>{ WXS.c[id]=Object.assign(WXS.c[id]||{},{busy:1}); });
  try{ const r=await fetch('/api/wx?ids='+ids.join(','),{headers:{accept:'application/json'}}); const j=await r.json(); if(!j||!j.ok) throw new Error((j&&j.error)||'wx');
    ids.forEach(id=>{ const st=j.stations&&j.stations[id], mt=st&&st.metar; let m=null; try{ m=mt&&mt.raw?WXK.parseMetar(mt.raw,new Date()):null; }catch(e){}
      WXS.c[id]={t:Date.now(),raw:mt?mt.raw:'',obs:mt?mt.obsTime:null,m,fc:wxCat(m),name:st&&st.name,src:st&&st.source,taf:st&&st.taf&&st.taf.raw||''}; }); return true; }
  catch(e){ ids.forEach(id=>{ WXS.c[id]={t:Date.now(),err:1}; }); return false; } }
async function wxSync(only){ if(!ML) return; if(!LY.wx){ mlPut('bb-wx',mlC([])); return; } if(WXS.busy){ if(only) WXS.pend=(WXS.pend||[]).concat(only); return; } if(T3.play) return;
  try{ await wxLib(); }catch(e){ return; }
  const now=Date.now(), want=only||wxWanted(), need=want.filter(id=>{ const c=WXS.c[id]; return !c||(!c.busy&&now-c.t>WX_TTL); });
  WXS.busy=true; try{ for(let i=0;i<need.length&&i<24;i+=8){ if(i) await new Promise(r=>setTimeout(r,1200)); const ok=await wxFetch(need.slice(i,i+8)); wxDraw(); if(!ok) break; } } finally{ WXS.busy=false; } wxDraw(); if(WXS.pend){ const q=WXS.pend; WXS.pend=null; wxSync(q); } }
/* chart-style METAR label: lowest cloud (ceiling first), CB/TCU, visibility, wind. "BKN012 CB · 8 km · 240/12G22" */
function wxLab(m){ if(!m) return ''; const p=[]; const h3=h=>String(Math.round(h/100)).padStart(3,'0');
  if(m.cavok) p.push('CAVOK'); else { const cl=(m.clouds||[]).filter(c=>c.h!=null); const ce=cl.find(c=>c.c==='BKN'||c.c==='OVC'), lo=ce||cl[0];
    if(m.vv!=null) p.push('VV'+h3(m.vv)); else if(lo) p.push(lo.c+h3(lo.h)+(m.cb?' CB':m.tcu?' TCU':'')); else if(m.nsc) p.push('NSC');
    if(m.vis!=null) p.push(m.vis>=10000?'10 km+':m.vis>=5000?Math.round(m.vis/1000)+' km':m.vis+' m'); }
  const line1=p.join(' · '); let w='';
  if(m.wind){ w=m.wind.spd===0?'calm':(m.wind.vrb?'VRB':String(m.wind.dir).padStart(3,'0'))+'/'+m.wind.spd+(m.wind.gust?'G'+m.wind.gust:''); }
  return w?line1+'\n'+w:line1; }
function wxDraw(){ if(!ML||!NAV) return; if(!WXS.idx){ WXS.idx={}; NAV.ap.forEach((a,i)=>WXS.idx[a[0]]=i); }
  const f=LY.wx?Object.keys(WXS.c).filter(id=>WXS.c[id].fc&&WXS.idx[id]!=null).map(id=>{ const a=NAV.ap[WXS.idx[id]]; return mlF(mlP(a[2],a[3]),{k:'ap',i:WXS.idx[id],fc:WXS.c[id].fc,id,lab:wxLab(WXS.c[id].m)}); }):[];
  mlPut('bb-wx',mlC(f)); const sd=el('side'), b=sd&&!sd.hidden&&sd.querySelector('.mwx[data-id]'); if(b) b.outerHTML=wxHtml(b.dataset.id); }
function wxHtml(id){ const c=WXS.c[id]; const box=x=>`<div class="mwx" data-id="${esc(id)}">${x}${c&&!c.busy&&(c.raw||c.taf)?`<details class="mwxraw"${c.raw?'':' open'}><summary>${L({en:'METAR and TAF as written',no:'METAR og TAF slik de er skrevet'})}</summary>${c.raw?`<code>${esc(c.raw)}</code>`:''}${c.taf?`<code>${esc(c.taf)}</code>`:`<p class="src">${L({en:'No TAF from this airport.',no:'Ingen TAF fra denne flyplassen.'})}</p>`}<a class="src" href="weather.html?ids=${esc(id)}" target="_blank" rel="noopener">${L({en:'Decode on the Weather page',no:'Dekod på vær-siden'})} ↗</a></details>`:''}</div>`;
  if(!c||c.busy) return box(`<p class="src">${L({en:'Loading the METAR…',no:'Henter METAR…'})}</p>`);
  if(c.err) return box(`<p class="src">${L({en:'The weather service did not answer. Try again in a minute.',no:'Værtjenesten svarte ikke. Prøv igjen om et minutt.'})}</p>`);
  if(!c.raw) return box(`<p class="src">${L({en:'No METAR from this airport.',no:'Ingen METAR fra denne flyplassen.'})}</p>`);
  const m=c.m||{}, no=LAB.lang==='no', col=c.fc?RXMAP.WXC[c.fc]:'#8A97A2', rows=[];
  const age=c.obs?Math.round((Date.now()-new Date(c.obs))/60000):null;
  if(m.wind) rows.push([L({en:'Wind',no:'Vind'}),m.wind.spd===0?L({en:'calm',no:'stille'}):(m.wind.vrb?L({en:'variable',no:'variabel'}):String(m.wind.dir).padStart(3,'0')+'°')+(m.wind.spd?' '+m.wind.spd+' kt':'')+(m.wind.gust?', '+L({en:'gusts',no:'kast'})+' '+m.wind.gust+' kt':'')+(m.wvar?' ('+m.wvar[0]+'°–'+m.wvar[1]+'°)':'')]);
  if(m.vis!=null) rows.push([L({en:'Visibility',no:'Sikt'}),m.vis>=10000?L({en:'10 km or more',no:'10 km eller mer'}):m.vis>=5000?fx(m.vis/1000)+' km':fx(m.vis)+' m']);
  if(m.wx&&m.wx.length) rows.push([L({en:'Weather',no:'Vær'}),m.wx.map(w=>WXK.wxText(w,no?'no':'en')).join(', ')]);
  rows.push([L({en:'Cloud',no:'Skyer'}),m.cavok?'CAVOK':m.clouds&&m.clouds.length?m.clouds.map(q=>q.c+' '+(q.h!=null?fx(q.h)+' ft':'?')+(q.t?' '+q.t:'')).join(', ')+(m.vv!=null&&m.vv!==undefined?', VV '+fx(m.vv)+' ft':''):m.vv!=null?'VV '+fx(m.vv)+' ft':L({en:'no significant cloud',no:'ingen signifikante skyer'})]);
  if(m.ceil!=null&&!m.cavok) rows.push([L({en:'Ceiling',no:'Skydekke'}),fx(m.ceil)+' ft']);
  if(m.temp!=null) rows.push([L({en:'Temp / dew point',no:'Temp / duggpunkt'}),m.temp+' / '+(m.dew!=null?m.dew:'–')+' °C']);
  if(m.qnh!=null) rows.push(['QNH',m.qnh+' hPa']);
  return box(`<b style="font-size:13px;display:block;margin-top:10px">METAR${c.obs?' '+new Date(c.obs).toISOString().slice(11,16)+'Z':''}${age!=null&&age>=0?` <span style="font-weight:400;color:var(--ink-2)">(${age<120?age+' min':Math.round(age/60)+' h'} ${L({en:'ago',no:'siden'})})</span>`:''}${c.fc?`<span class="fc" style="background:${col}">${c.fc}</span>`:''}</b><dl>${rows.map(r=>`<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl><pre>${esc(c.raw)}</pre><p class="src">${L({en:'Source: '+(c.src==='MET Norway'?'MET Norway':'aviationweather.gov (NOAA)')+'. Can be late or incomplete: check the official briefing before flight. Category (SERA, EASA): VFR = visibility ≥ 5 km and ceiling ≥ 1500 ft; SVFR = special VFR only (≥ 1500 m, ceiling ≥ 600 ft, in a control zone with ATC clearance); IFR = below that. Ceiling = lowest BKN or OVC layer.',no:'Kilde: '+(c.src==='MET Norway'?'MET Norway':'aviationweather.gov (NOAA)')+'. Kan være forsinket eller ufullstendig: sjekk den offisielle briefingen før flyging. Kategori (SERA, EASA): VFR = sikt ≥ 5 km og skydekke ≥ 1500 ft; SVFR = bare spesiell VFR (≥ 1500 m, skydekke ≥ 600 ft, i kontrollsone med klarering fra ATC); IFR = under det. Skydekke = laveste BKN- eller OVC-lag.'})}</p>`); }
/* ---------- SIGMET and AIRMET on the map (/api/sigmet: MET Norway for Norway incl. AIRMETs, aviationweather.gov for the world) ----------
   One request for the whole world, kept 5 min; drawn as areas by hazard. Click an area for the text. */
const SIG={items:[],t:0,busy:false,err:false};
const SIG_TTL=5*60e3;
async function sigSync(){ if(!ML) return; if(!LY.sig){ mlPut('bb-sig',mlC([])); return; } if(SIG.busy) return;
  if(Date.now()-SIG.t<SIG_TTL){ sigDraw(); return; }
  SIG.busy=true; try{ const r=await fetch('/api/sigmet',{headers:{accept:'application/json'}}); const j=await r.json(); if(!j||!j.ok) throw new Error('sig'); SIG.items=j.items||[]; SIG.err=false; }
  catch(e){ SIG.err=true; } finally{ SIG.t=Date.now(); SIG.busy=false; } sigDraw(); try{ if(R) drawProfile(compute(),TP); }catch(e){} }
function sigLevels(s){ const f=v=>v==null?null:v<=0?'SFC':v>=10000?'FL'+String(Math.round(v/100)).padStart(3,'0'):fx(v)+' ft'; const b=f(s.base), t=f(s.top); return b&&t?b+'–'+t:t?L({en:'up to ',no:'opp til '})+t:b?L({en:'above ',no:'over '})+b:''; }
const SIGNO={'Moderate icing':'Moderat ising','Moderate turbulence':'Moderat turbulens','Moderate mountain wave':'Moderate fjellbølger','Isolated thunderstorms':'Isolert tordenvær','Occasional thunderstorms':'Spredt tordenvær','Cumulonimbus':'Cumulonimbus','Mountains obscured':'Fjell skjult','Low cloud':'Lavt skydekke','Reduced surface visibility':'Nedsatt sikt ved bakken','Strong surface wind':'Sterk vind ved bakken','Convective SIGMET (thunderstorms)':'Konvektiv SIGMET (tordenvær)','Severe turbulence':'Kraftig turbulens','Severe icing':'Kraftig ising','Severe icing (freezing rain)':'Kraftig ising (underkjølt regn)','Severe mountain wave':'Kraftige fjellbølger','Volcanic ash':'Vulkansk aske','Tropical cyclone':'Tropisk syklon','Radioactive cloud':'Radioaktiv sky','Heavy duststorm':'Kraftig støvstorm','Heavy sandstorm':'Kraftig sandstorm','Thunderstorms':'Tordenvær','Embedded thunderstorms':'Innleiret tordenvær','Obscured thunderstorms':'Skjult tordenvær','Frequent thunderstorms':'Hyppig tordenvær','Squall line thunderstorms':'Bygelinje med tordenvær'};
function sigLabel(s){ if(LAB.lang!=='no') return s.label; const base=s.label.replace(/ with hail$/,''); return (SIGNO[base]||s.label)+(/ with hail$/.test(s.label)?' med hagl':''); }
function sigDraw(){ if(!ML) return; const now=Date.now();
  const f=LY.sig?SIG.items.filter(s=>s.poly&&(!s.to||new Date(s.to)>now)).map(s=>mlF({type:'Polygon',coordinates:[s.poly]},{id:s.id,cat:s.cat,a:s.type==='AIRMET'?1:0,t:(s.type==='AIRMET'?'AIRMET ':'')+s.fir+' '+(s.series||'')})):[];
  mlPut('bb-sig',mlC(f)); try{ swList(compute()); goRoute(compute()); }catch(e){} }
function sigInfo(ids,mx,my,pos){ const sd=el('side'); const list=SIG.items.filter(s=>ids.includes(s.id)); const z=d=>d?new Date(d).toISOString().slice(8,10)+' '+new Date(d).toISOString().slice(11,16)+'Z':'?';
  const html=list.map(s=>`<div class="mwx"><b style="font-size:13px;display:block;margin-top:10px;color:${RXMAP.SIGC[s.cat]||RXMAP.SIGC.other}">${esc(s.type||'SIGMET')} ${esc(s.series||'')}${list.length>1?' · '+esc(sigLabel(s)):''}</b><dl><dt>FIR</dt><dd>${esc(s.fir)}${s.firName?' '+esc(s.firName):''}</dd><dt>${L({en:'Source',no:'Kilde'})}</dt><dd>${esc(s.source||'aviationweather.gov')}</dd><dt>${L({en:'Valid',no:'Gyldig'})}</dt><dd>${z(s.from)} – ${z(s.to)}</dd>${sigLevels(s)?`<dt>${L({en:'Levels',no:'Nivåer'})}</dt><dd>${sigLevels(s)}</dd>`:''}${s.dir||s.spd?`<dt>${L({en:'Movement',no:'Bevegelse'})}</dt><dd>${esc(s.dir||'')}${s.spd?' '+s.spd+' kt':''}</dd>`:''}</dl><pre>${esc(s.raw)}</pre></div>`).join('');
  sd.innerHTML=`<button class="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button><span class="id">${list.length>1?'SIGMET / AIRMET':esc(list[0]?list[0].type||'SIGMET':'SIGMET')}</span><h3>${list.length>1?list.length+' '+L({en:'warnings here',no:'varsler her'}):esc(list[0]?sigLabel(list[0]):'SIGMET')}</h3>`+html+
    `<div class="acts"><button class="btn" data-a="pt">${L({en:'New fix here',no:'Ny fix her'})}</button></div><p class="src">${L({en:'Norway: MET Norway, which issues them (SIGMET and AIRMET). Elsewhere: aviationweather.gov (NOAA), relaying the SIGMETs of each country\'s meteorological watch office; AIRMETs outside Norway are not openly published. Can be late or incomplete: check the official briefing before flight.',no:'Norge: MET Norway, som utsteder dem (SIGMET og AIRMET). Ellers: aviationweather.gov (NOAA), som videreformidler SIGMET-ene fra hvert lands meteorologiske varslingskontor; AIRMET utenfor Norge publiseres ikke åpent. Kan være forsinket eller ufullstendig: sjekk den offisielle briefingen før flyging.'})}</p>`;
  sd.hidden=false; sd.onclick=e=>{ const b=e.target.closest('button'); if(!b) return; if(b.classList.contains('x')){ sd.hidden=true; return; } if(b.dataset.a==='pt'){ sd.hidden=true; newPointBox(mapEl,mx,my,pos,null); } }; }
/* ---------- flown track (GPX) for the debrief: on the map and against the planned profile; kept in this browser tab only ---------- */
let TRK=null;
function trkParse(txt){ const doc=new DOMParser().parseFromString(txt,'application/xml'); if(doc.querySelector('parsererror')) throw new Error('not a GPX file');
  let pts=[...doc.getElementsByTagName('trkpt')]; if(!pts.length) pts=[...doc.getElementsByTagName('rtept')];
  const out=pts.map(n=>{ const la=+n.getAttribute('lat'), lo=+n.getAttribute('lon'); const e=n.getElementsByTagName('ele')[0], t=n.getElementsByTagName('time')[0];
    return {la,lo,ft:e?+e.textContent*3.28084:null,t:t?Date.parse(t.textContent):null}; }).filter(p=>Number.isFinite(p.la)&&Number.isFinite(p.lo)&&Math.abs(p.la)<=90&&Math.abs(p.lo)<=180);
  if(out.length<2) throw new Error('no track points'); const nm=doc.getElementsByTagName('name')[0]; return {pts:out,name:nm?nm.textContent.trim():''}; }
function trkStats(){ const P=TRK.pts; let d=0, mx=-1e9; for(let i=1;i<P.length;i++) d+=gc(P[i-1],P[i]); P.forEach(p=>{ if(p.ft!=null) mx=Math.max(mx,p.ft); });
  const t0=P.find(p=>p.t)&&P.find(p=>p.t).t, t1=[...P].reverse().find(p=>p.t); const dur=t0&&t1?Math.round((t1.t-t0)/60e3):null; return {d,mx:mx>-1e9?mx:null,dur}; }
// along-route position of each track point (nearest point on the planned route, sampled every ~0.5 NM) and its distance off route
function trkAlong(M){ const tot=M.total; if(!TRK||!(tot>0.2)) return null; const n=Math.max(50,Math.min(1500,Math.ceil(tot/0.5))), S=[]; for(let i=0;i<=n;i++){ const x=tot*i/n, q=M.posAt(x); if(q&&q.la!=null) S.push({x,la:q.la,lo:q.lo}); }
  const stride=Math.max(1,Math.floor(TRK.pts.length/2000)); const out=[]; let off=0;
  for(let k=0;k<TRK.pts.length;k+=stride){ const p=TRK.pts[k]; let b=1e9, bx=0; for(const s of S){ const dla=s.la-p.la; if(Math.abs(dla)*60>b) continue; const d=gc(s,p); if(d<b){ b=d; bx=s.x; } } out.push({x:bx,ft:p.ft,off:b}); off=Math.max(off,b); }
  return {pts:out,off}; }
function trkDraw(){ if(ML) mlPut('bb-trk',mlC(TRK?[mlF({type:'LineString',coordinates:TRK.pts.map(p=>[p.lo,p.la])},{})]:[])); const m=el('trkmsg'), x=el('trkx'); if(x) x.hidden=!TRK;
  if(!m) return; if(!TRK){ m.textContent=''; return; } const st=trkStats(), A=trkAlong(compute());
  m.innerHTML=(ML?`<button type="button" class="btn sm pri" id="trkrep">▶ ${L({en:'Replay in 3D',no:'Spill av i 3D'})}</button> `:'')+`<b>${esc(TRK.name||L({en:'Track',no:'Spor'}))}</b>: ${fx(TRK.pts.length)} ${L({en:'points',no:'punkter'})} · ${fx(st.d,1)} NM`+(st.dur!=null?` · ${Math.floor(st.dur/60)}:${String(Math.round(st.dur%60)).padStart(2,'0')}`:'')+(st.mx!=null?` · ${L({en:'highest',no:'høyest'})} ${fx(Math.round(st.mx/10)*10)} ft`:'')+(A?` · ${L({en:'furthest from the planned route',no:'lengst fra planlagt rute'})} ${fx(A.off,1)} NM`:'')+`. ${L({en:'Orange on the map; on the profile against your plan (GPS altitude). Not saved: it stays in this tab.',no:'Oransje på kartet; i profilen mot planen din (GPS-høyde). Ikke lagret: det blir i denne fanen.'})}`; }
el('trkf').addEventListener('change',async e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const m=el('trkmsg');
  try{ if(f.size>30e6) throw new Error(L({en:'the file is larger than 30 MB',no:'filen er større enn 30 MB'})); TRK=trkParse(await f.text()); if(ML){ const b=TRK.pts.reduce((a,p)=>[Math.min(a[0],p.lo),Math.min(a[1],p.la),Math.max(a[2],p.lo),Math.max(a[3],p.la)],[180,90,-180,-90]); ML.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:60,duration:600}); } render(); }
  catch(err){ TRK=null; if(m) m.textContent=L({en:'Could not read the file: ',no:'Kunne ikke lese filen: '})+(err.message||err); trkDraw(); } e.target.value=''; });
el('trkx').onclick=()=>{ repEnd(); TRK=null; render(); };
el('trkmsg').addEventListener('click',e=>{ if(e.target.closest('#trkrep')) repStart(); });
/* ---------- weather radar (EUMETNET OPERA, all of Europe) and satellite clouds (EUMETSAT Meteosat IR) ----------
   Radar: newest 15-min rain-rate composite from /api/radar (ODIM HDF5), drawn in a Web Worker (radarworker.js) to a Web Mercator
   image over the OPERA domain; refreshed every 10 min while shown. Satellite: hourly IR tiles through /api/sat. Both off by default. */
const RAD={on:false,t:'',busy:false,at:0,img:null,w:null}, SAT={on:false,t:''};
const RADB=[-40,31,58,74];
function ovBefore(){ return ML&&ML.getLayer('bb-mefg')?'bb-mefg':undefined; }
async function radSync(){ if(!ML) return; const want=!!LY.rad, nt=el('radnote'); if(el('radhelp')) el('radhelp').hidden=!want;
  if(!want){ if(ML.getLayer('bb-rad')) ML.setLayoutProperty('bb-rad','visibility','none'); RAD.on=false; if(nt) nt.textContent=''; return; }
  RAD.on=true; if(ML.getLayer('bb-rad')) ML.setLayoutProperty('bb-rad','visibility','visible');
  if(RAD.busy||(Date.now()-RAD.at<10*60e3&&ML.getSource('bb-rad'))) return; RAD.busy=true; if(nt) nt.textContent=L({en:'loading…',no:'laster …'});
  try{ const j=await (await fetch('/api/radar',{headers:{accept:'application/json'}})).json(); if(!j||!j.ok) throw new Error((j&&j.message)||'radar');
    if(j.t!==RAD.t||!ML.getSource('bb-rad')){ const buf=await (await fetch(j.url)).arrayBuffer();
      if(!RAD.w) RAD.w=new Worker('radarworker.js?v=2'); const D=Math.PI/180, my=la=>Math.log(Math.tan(Math.PI/4+la*D/2)); const w=1100, h=Math.round(w*(my(RADB[3])-my(RADB[1]))/((RADB[2]-RADB[0])*D));
      const out=await new Promise((ok,ko)=>{ RAD.w.onmessage=e=>e.data.ok?ok(e.data):ko(new Error(e.data.err)); RAD.w.onerror=e=>ko(new Error(e.message||'worker')); RAD.w.postMessage({buf,w,h,b:RADB},[buf]); });
      const cv=document.createElement('canvas'); cv.width=out.w; cv.height=out.h; cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(out.rgba),out.w,out.h),0,0);
      const url=cv.toDataURL('image/png'), coords=[[RADB[0],RADB[3]],[RADB[2],RADB[3]],[RADB[2],RADB[1]],[RADB[0],RADB[1]]];
      if(ML.getSource('bb-rad')) ML.getSource('bb-rad').updateImage({url,coordinates:coords});
      else { ML.addSource('bb-rad',{type:'image',url,coordinates:coords}); ML.addLayer({id:'bb-rad',type:'raster',source:'bb-rad',paint:{'raster-opacity':0.85,'raster-fade-duration':0}},ovBefore()); }
      RAD.t=j.t; }
    RAD.at=Date.now(); const tt=RAD.t; if(nt) nt.textContent=tt.slice(9,11)+':'+tt.slice(11,13)+'Z · © EUMETNET OPERA'; }
  catch(e){ if(nt) nt.textContent=L({en:'not available right now',no:'ikke tilgjengelig nå'}); RAD.at=Date.now()-8*60e3; }
  finally{ RAD.busy=false; } }
function satHour(){ const t=new Date(Math.floor((Date.now()-25*60e3)/3600e3)*3600e3); return t.toISOString().replace('.000Z','Z'); } // hourly image: free of licensing
function satSync(){ if(!ML) return; const nt=el('satnote'); if(el('sathelp')) el('sathelp').hidden=!LY.sat;
  if(!LY.sat){ if(ML.getLayer('bb-wsat')) ML.setLayoutProperty('bb-wsat','visibility','none'); SAT.on=false; if(nt) nt.textContent=''; return; }
  SAT.on=true; const t=satHour();
  if(t!==SAT.t||!ML.getSource('bb-wsat')){ if(ML.getLayer('bb-wsat')) ML.removeLayer('bb-wsat'); if(ML.getSource('bb-wsat')) ML.removeSource('bb-wsat');
    ML.addSource('bb-wsat',{type:'raster',tiles:['/api/sat?bbox={bbox-epsg-3857}&t='+encodeURIComponent(t)],tileSize:256,maxzoom:7,attribution:'© EUMETSAT '+t.slice(0,4)});
    ML.addLayer({id:'bb-wsat',type:'raster',source:'bb-wsat',paint:{'raster-opacity':0.55,'raster-fade-duration':0}},ML.getLayer('bb-rad')?'bb-rad':ovBefore()); SAT.t=t; }
  else ML.setLayoutProperty('bb-wsat','visibility','visible');
  if(nt) nt.textContent=t.slice(11,13)+':00Z · © EUMETSAT'; }
/* ---------- aerodromes along the route: planning list for alternates and diversions (NAV = OurAirports) ---------- */
let NRS={d:25,m:''}; try{ const j=JSON.parse(localStorage.getItem('bb-rx-nr')||'null'); if(j) NRS=Object.assign(NRS,j); }catch(e){}
function nrDraw(M){ const tb=el('nrt'), nt=el('nrnote'); if(!tb||!NAV) return; const P=waPts(M); el('nr_d').value=String(NRS.d); if(document.activeElement!==el('nr_m')) el('nr_m').value=NRS.m;
  if(P.length<2){ tb.innerHTML=''; nt.textContent=''; return; }
  const S=[]; let acc=0; for(let i=1;i<P.length;i++){ const a=P[i-1].p, b=P[i].p, dd=gc(a,b), n=Math.max(1,Math.ceil(dd/3)); for(let k=0;k<=n;k++) S.push({la:a.la+(b.la-a.la)*k/n,lo:a.lo+(b.lo-a.lo)*k/n,x:acc+dd*k/n}); acc+=dd; }
  let a0=90,a1=-90,o0=180,o1=-180; S.forEach(q=>{ a0=Math.min(a0,q.la); a1=Math.max(a1,q.la); o0=Math.min(o0,q.lo); o1=Math.max(o1,q.lo); }); const dl=NRS.d/60, dlo=dl/Math.max(0.2,Math.cos(((a0+a1)/2)*Math.PI/180));
  const minM=+NRS.m||0, ends=new Set([P[0].p.n,P[P.length-1].p.n]);
  const rows=NAV.ap.filter(a=>a[2]>a0-dl&&a[2]<a1+dl&&a[3]>o0-dlo&&a[3]<o1+dlo&&!ends.has(a[0])).map(a=>{ let best=1e9, x=0; S.forEach(q=>{ const d=gc(q,{la:a[2],lo:a[3]}); if(d<best){ best=d; x=q.x; } }); const rl=Math.max(0,...(a[6]||[]).map(r=>r[2]||0)); return {a,d:best,x,rl}; })
    .filter(r=>r.d<=NRS.d).sort((p,q)=>p.x-q.x);
  const shown=rows.filter(r=>!minM||r.rl*0.3048>=minM);
  tb.innerHTML=shown.length?`<thead><tr><th>ICAO</th><th>${L({en:'Name',no:'Navn'})}</th><th>${L({en:'Along',no:'Langs'})}</th><th>${L({en:'Off route',no:'Fra ruten'})}</th><th>${L({en:'Longest runway',no:'Lengste bane'})}</th><th>${L({en:'Elevation',no:'Høyde'})}</th><th></th></tr></thead><tbody>`+shown.slice(0,60).map(r=>`<tr><td class="n"><b>${esc(r.a[0])}</b></td><td>${esc(r.a[1])}</td><td class="n">${fx(r.x)} NM</td><td class="n">${fx(r.d,1)} NM</td><td class="n">${r.rl?fx(Math.round(r.rl*0.3048/10)*10)+' m':'–'}</td><td class="n">${fx(r.a[4])} ft</td><td><button type="button" class="btn sm noprint" data-nrgo="${esc(r.a[0])}">${L({en:'Show',no:'Vis'})}</button></td></tr>`).join('')+'</tbody>':'';
  nt.innerHTML=L({en:`${shown.length} aerodrome${shown.length===1?'':'s'} within ${NRS.d} NM of the route${minM?' with a runway of at least '+fx(minM)+' m':''}${rows.length>shown.length?' ('+(rows.length-shown.length)+' with shorter runways left out)':''}. Along = distance from the departure. A planning list for alternates and diversions: check opening hours, fuel, PPR and the runway surface in the AIP. Source: OurAirports (public domain).`,no:`${shown.length} flyplass${shown.length===1?'':'er'} innen ${NRS.d} NM fra ruten${minM?' med bane på minst '+fx(minM)+' m':''}${rows.length>shown.length?' ('+(rows.length-shown.length)+' med kortere bane utelatt)':''}. Langs = avstand fra avgang. En planleggingsliste for alternativer og avbrudd: sjekk åpningstid, drivstoff, PPR og baneflate i AIP. Kilde: OurAirports (allmenn eiendom).`}); }
el('nlp').addEventListener('change',e=>{ if(e.target.id==='nr_d'){ NRS.d=+e.target.value; try{ localStorage.setItem('bb-rx-nr',JSON.stringify(NRS)); }catch(x){} nrDraw(compute()); } });
el('nlp').addEventListener('input',e=>{ if(e.target.id==='nr_m'){ NRS.m=e.target.value.replace(/[^0-9]/g,''); try{ localStorage.setItem('bb-rx-nr',JSON.stringify(NRS)); }catch(x){} nrDraw(compute()); } });
el('nlp').addEventListener('click',e=>{ const b=e.target.closest('[data-nrgo]'); if(!b) return; const i=NAV.ap.findIndex(a=>a[0]===b.dataset.nrgo); if(i<0) return; const a=NAV.ap[i];
  if(ML) ML.flyTo({center:[a[3],a[2]],zoom:Math.max(ML.getZoom(),9)}); showInfo({k:'ap',i,o:a,x:0,y:0}); window.scrollTo({top:0,behavior:'smooth'}); });
/* ---------- aerodrome frequencies (data/freq/<prefix>.json from OurAirports, public domain; loaded on first click per prefix) ---------- */
const FQ={};
const FQN={TWR:'Tower',APP:'Approach',GND:'Ground',ATIS:'ATIS',AFIS:'AFIS',CTAF:'CTAF',UNIC:'UNICOM',CLD:'Clearance',DEP:'Departure',ARR:'Arrival',INFO:'Information',RDO:'Radio',FIS:'FIS',DIR:'Director',RMP:'Apron',APRON:'Apron',PMSV:'PMSV',MISC:'Other',A_G:'Air/ground'};
/* "Now at the aerodrome": the same row as the search bar (icaobrief.js): SIGMETs over the aerodrome, the forecast freezing level
   and a radar picture, plus a link to the official NOTAM source (paste the NOTAMs in the NOTAM box to see them on the map) */
let icbP=null; const icbLoad=()=>icbP||(icbP=new Promise(ok=>{ if(window.ICB) return ok(); const sc=document.createElement('script'); sc.src='icaobrief.js?v=7'; sc.onload=ok; sc.onerror=()=>{ icbP=null; ok(); }; document.head.appendChild(sc); }));
function icbFill(id,ap){ const box=()=>{ const b=document.querySelector('#side .micb'); return b&&b.dataset.id===id?b:null; };
  const draw=()=>{ const b=box(); if(!b||!window.ICB) return; const ns=ICB.notam(id);
    b.innerHTML=ICB.html(id,undefined,L,ap)+`<p class="src micb-n"><a href="${esc(ns.url)}" target="_blank" rel="noopener">NOTAM · ${esc(ns.name)} ↗</a>${ns.direct?'':' '+L({en:'(type '+id+')',no:'(skriv '+id+')'})}<br>${L({en:'Paste them in the NOTAM box (terrain profile → Advanced) to see them on the map.',no:'Lim dem inn i NOTAM-feltet (terrengprofil → Avansert) for å se dem på kartet.'})}</p>`; };
  icbLoad().then(()=>{ if(!window.ICB) return; draw(); ICB.ensure(id,ap,draw); }); }
function freqFill(id){ const p=String(id||'').slice(0,2); if(!/^[A-Z]{2}$/.test(p)) return; const go=d=>{ const box=document.querySelector(`#side .mfq[data-id="${id}"]`); if(!box) return; const L0=d&&d[id];
    box.innerHTML=L0&&L0.length?`<b style="font-size:13px;display:block;margin-top:8px">${L({en:'Frequencies',no:'Frekvenser'})}</b>`+L0.map(f=>`<div class="rw"><b>${esc(f[2])}</b><span>${esc(FQN[f[0]]||f[0])}${f[1]&&f[1].toUpperCase()!==f[0]?' · '+esc(f[1]):''}</span></div>`).join('')+`<p class="src">${L({en:'Frequencies: OurAirports (public domain), community data. Check the AIP.',no:'Frekvenser: OurAirports (allmenn eiendom), dugnadsdata. Sjekk AIP.'})}</p>`:''; };
  if(FQ[p]&&FQ[p].d) return go(FQ[p].d); if(!FQ[p]) FQ[p]={p:fetch('data/freq/'+p+'.json').then(r=>r.ok?r.json():{}).catch(()=>({}))}; FQ[p].p.then(d=>{ FQ[p].d=d; go(d); }); }
/* ---------- NOTAMs on the map: pasted text (ICAO format), centre and radius from the Q) line ----------
   Active in the flight window (ETD → ETD + flight time, ±1 h) = strong; outside it = faint. Radius 999 NM (whole FIR) is listed, not drawn. */
const NTM={list:[],t:0};
const NTL={ils:['ILS/LOC out','ILS/LOC ute'],adclsd:['aerodrome closed','flyplass stengt'],rwyclsd:['runway closed','bane stengt'],rwylim:['runway limited','bane begrenset'],decl:['declared distances','deklarerte distanser'],navaid:['navaid out','radiofyr ute'],gnss:['GNSS','GNSS'],proc:['procedure','prosedyre'],lights:['lights','lys'],obst:['obstacle','hinder'],airspace:['airspace','luftrom'],hours:['hours','åpningstid']};
function ntmWin(){ const M=compute(), N=nlRows(M), t0=waEtd(), t1=new Date(+t0+((N.cum||60)*60e3)); return [new Date(+t0-3600e3),new Date(+t1+3600e3)]; }
function ntmLvl(n){ const L=(n.impacts||[]).map(x=>x.lvl); return L.includes('hi')?'hi':L.includes('md')?'md':L.includes('lo')?'lo':''; }
async function ntmSync(){ const txt=String((R&&R.ntm)||'').trim(), msg=el('ntmmsg'); if(!txt){ NTM.list=[]; if(ML) mlPut('bb-ntm',mlC([])); if(msg) msg.innerHTML=''; return; }
  try{ await wxLib(); }catch(e){ return; }
  const all=WXK.parseNotams(txt), [w0,w1]=ntmWin(), M=compute(), P=waPts(M);
  const dRoute=(p)=>{ if(P.length<2) return null; let d=1e9; for(let i=1;i<P.length;i++){ const a=P[i-1].p, b=P[i].p, n=Math.max(1,Math.ceil(gc(a,b)/5)); for(let k=0;k<=n;k++) d=Math.min(d,gc({la:a.la+(b.la-a.la)*k/n,lo:a.lo+(b.lo-a.lo)*k/n},p)); } return d; };
  NTM.list=all.map((n,i)=>{ const o=Object.assign({},n,{i,lvl:ntmLvl(n),ov:WXK.overlap(n,w0,w1)}); o.act=o.ov==='active'||o.ov==='sched'||o.ov==null; if(n.pos){ const d=dRoute(n.pos); o.near=d==null?null:Math.max(0,d-n.pos.r); } return o; });
  if(ML){ const f=LY.ntm?NTM.list.filter(n=>n.pos&&n.pos.r>0&&n.pos.r<999).map(n=>{ const c=[], R0=n.pos.r/60; for(let k=0;k<=48;k++){ const a=k/48*2*Math.PI; c.push([n.pos.lo+R0*Math.sin(a)/Math.cos(n.pos.la*Math.PI/180),n.pos.la+R0*Math.cos(a)]); }
      return mlF({type:'Polygon',coordinates:[c]},{i:n.i,id:n.id||'NOTAM',lvl:n.lvl,act:n.act?1:0}); }):[]; mlPut('bb-ntm',mlC(f)); }
  if(!msg) return; const nr=NTM.list.filter(n=>n.near!=null&&n.near<=5), nopos=NTM.list.filter(n=>!n.pos).length, big=NTM.list.filter(n=>n.pos&&n.pos.r>=999).length;
  const it=n=>`<li class="${n.lvl}"><b>${esc(n.id||'NOTAM')}</b> ${esc((n.loc||[]).join(' '))} · ${(n.impacts||[]).map(x=>esc(L({en:(NTL[x.k]||[x.k])[0],no:(NTL[x.k]||[x.k,x.k])[1]})+(x.h?' '+x.h:''))).join(', ')||esc(String(n.E||'').slice(0,60))}${n.act?'':' · '+L({en:'not in your flight window',no:'ikke i flytidsvinduet ditt'})}</li>`;
  msg.innerHTML=L({en:`${all.length} NOTAM read; ${nr.length} within 5 NM of the route.`,no:`${all.length} NOTAM lest; ${nr.length} innen 5 NM fra ruten.`})+(nopos?' '+L({en:`${nopos} without a position (no Q) line) are not drawn.`,no:`${nopos} uten posisjon (ingen Q)-linje) tegnes ikke.`}):'')+(big?' '+L({en:`${big} cover the whole FIR and are not drawn.`,no:`${big} gjelder hele FIR-en og tegnes ikke.`}):'')
    +(nr.length?`<ul>${nr.sort((a,b)=>(b.act-a.act)||(a.near-b.near)).map(it).join('')}</ul>`:'')+`<span>${L({en:'Flight window from the ETD in the navlog (empty = now) and the flight time, ±1 h. Click a circle on the map for the text.',no:'Flytidsvindu fra ETD i navloggen (tom = nå) og flytiden, ±1 t. Klikk en sirkel på kartet for teksten.'})}</span>`; }
function ntmInfo(ix,mx,my,pos){ const sd=el('side'); const list=NTM.list.filter(n=>ix.includes(n.i)); const z=d=>d?new Date(d).toISOString().slice(0,16).replace('T',' ')+'Z':'–';
  const html=list.map(n=>`<div class="mwx"><b style="font-size:13px;display:block;margin-top:10px;color:${n.lvl==='hi'?'#B3261E':n.lvl==='md'?'#B86E00':n.lvl==='lo'?'#7B3FA0':'#4C5B66'}">${esc(n.id||'NOTAM')} ${esc((n.loc||[]).join(' '))}</b><dl><dt>${L({en:'Valid',no:'Gyldig'})}</dt><dd>${z(n.from)} – ${n.perm?'PERM':z(n.to)}${n.est?' EST':''}</dd>${n.sched?`<dt>${L({en:'Schedule',no:'Tidsplan'})}</dt><dd>${esc(n.sched)}</dd>`:''}${n.lower||n.upper?`<dt>${L({en:'Levels',no:'Nivåer'})}</dt><dd>FL${esc(n.lower||'000')} – FL${esc(n.upper||'999')}</dd>`:''}<dt>${L({en:'Flight window',no:'Flytidsvindu'})}</dt><dd>${n.act?L({en:'affects it',no:'berører det'}):L({en:'outside it',no:'utenfor'})}</dd></dl><p style="margin:6px 0">${esc(WXK.plain(n.E||'',LAB.lang))}</p><pre>${esc(n.raw)}</pre></div>`).join('');
  sd.innerHTML=`<button class="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button><span class="id">NOTAM</span><h3>${list.length>1?list.length+' NOTAM':esc(list[0]?(list[0].id||'NOTAM'):'NOTAM')}</h3>`+html+`<div class="acts"><button class="btn" data-a="pt">${L({en:'New fix here',no:'Ny fix her'})}</button></div><p class="src">${L({en:'From the NOTAMs you pasted. The circle is the Q) line’s centre and radius; the text decides. Check the official briefing.',no:'Fra NOTAM-ene du limte inn. Sirkelen er senter og radius fra Q)-linjen; teksten gjelder. Sjekk den offisielle briefingen.'})}</p>`;
  sd.hidden=false; sd.onclick=e=>{ const b=e.target.closest('button'); if(!b) return; if(b.classList.contains('x')){ sd.hidden=true; return; } if(b.dataset.a==='pt'){ sd.hidden=true; newPointBox(mapEl,mx,my,pos,null); } }; }
/* ---------- forecast winds aloft (/api/winds: NOAA GFS 0.25°, worldwide; windsaloft.js interpolates) ----------
   "Fill winds from the forecast": wind at the cruise altitude in the middle of each leg, at the time the aircraft is there
   (ETD + navlog times; without a TAS, the ETD), written into the navlog's per-leg wind (marked as forecast, your own
   winds are kept). The table shows every level along the route, the freezing level and the cruise row. */
const WA={busy:false,res:null,lev:'850',mt:0,mkey:''};
try{ const l=localStorage.getItem('bb-rx-walev'); if(l) WA.lev=l; }catch(e){}
function waEtd(){ const v=String((R.nl&&R.nl.etd)||'').replace(/[^0-9]/g,''); const now=new Date(); if(v.length<3) return now;
  const hh=+v.slice(0,v.length-2), mm=+v.slice(-2); if(hh>23||mm>59) return now; let t=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),hh,mm); if(t<+now-3*3600e3) t+=864e5; return new Date(t); }
function waPts(M){ return M.C.filter(c=>c.p.la!=null&&!['missed'].includes(c.p.t)); }
async function waGo(){ if(WA.busy||!R) return; const M=compute(), N=nlRows(M), P=waPts(M), st=el('wa_st'); const say=(t,e)=>{ st.textContent=t; st.classList.toggle('err',!!e); };
  if(P.length<2){ say(L({en:'Build a route on the map first.',no:'Bygg en rute på kartet først.'}),1); return; }
  const cr=pnum(R.s&&R.s.cr); if(!cr){ say(L({en:'Set the cruise altitude first (Cruise in the route bar).',no:'Sett marsjhøyden først (Cruise i rutefeltet).'}),1); return; }
  const etd=waEtd(), half=N.cum?N.cum/2:0, t=new Date(+etd+half*60e3);
  if(t-Date.now()>5*864e5){ say(L({en:'The forecast goes 5 days ahead.',no:'Prognosen går 5 døgn fram.'}),1); return; }
  const tiles=BBWIND.tilesFor(P.map(c=>({la:c.p.la,lo:c.p.lo}))); if(tiles.length>20){ say(L({en:'The route is too long for one forecast request (max about 1,500 NM).',no:'Ruten er for lang for én prognoseforespørsel (maks ca. 1 500 NM).'}),1); return; }
  WA.busy=true; el('wa_go').disabled=true; say(L({en:'Fetching the forecast…',no:'Henter prognosen …'}));
  try{ const r=await BBWIND.load(tiles,t); if(!r.ok){ say((r.msg||L({en:'The forecast could not be fetched.',no:'Prognosen kunne ikke hentes.'}))+' '+L({en:'Enter the winds by hand meanwhile.',no:'Skriv inn vinden for hånd i mellomtiden.'}),1); return; }
    WA.res={time:r.time,run:r.run,valid:r.valid,cr,fail:r.fail};
    let n=0, kept=0; M.C.forEach((c,i)=>{ if(!i||['missed','alt'].includes(c.p.t)) return; const q=M.C[i-1].p, p=c.p; if(p.la==null||q.la==null) return;
      if(p.nw&&!p.nwf){ kept++; return; } const w=BBWIND.at((q.la+p.la)/2,(q.lo+p.lo)/2,cr,r.time); if(!w) return; p.nw=BBWIND.w3(w.dir,w.spd); p.nwf=r.run||1; n++; });
    const z=d=>d?new Date(d).toISOString().slice(8,10)+' '+new Date(d).toISOString().slice(11,16)+'Z':'?';
    say(L({en:`${n} leg${n===1?'':'s'} filled with the wind at ${fx(cr)} ft, valid ${z(r.valid)} (GFS run ${z(r.run)}).`,no:`${n} etappe${n===1?'':'r'} fylt inn med vinden i ${fx(cr)} ft, gyldig ${z(r.valid)} (GFS-kjøring ${z(r.run)}).`})+(kept?' '+L({en:`${kept} with your own wind kept.`,no:`${kept} med din egen vind beholdt.`}):'')+(r.fail?' '+L({en:'Part of the route had no forecast.',no:'Deler av ruten fikk ingen prognose.'}):''));
    nlLabel(); render(); queueSave(); if(ML&&LY.wa) waMapSync(); }
  finally{ WA.busy=false; el('wa_go').disabled=false; } }
function waDraw(M){ const tb=el('wat'), nt=el('wanote'); if(!tb) return; const R0=WA.res; if(!R0){ tb.innerHTML=''; nt.innerHTML=L({en:'Forecast winds and temperatures along your route from NOAA’s GFS model (worldwide, hourly). Set ETD and the cruise altitude, then fill.',no:'Prognose for vind og temperatur langs ruten fra NOAAs GFS-modell (hele verden, hver time). Sett ETD og marsjhøyde, og fyll inn.'}); return; }
  const P=waPts(M).filter((c,i,a)=>i===0||c.p.la!==a[i-1].p.la||c.p.lo!==a[i-1].p.lo).slice(0,14); const time=R0.time, cr=R0.cr;
  const cols=P.map(c=>({n:c.p.n||'',la:c.p.la,lo:c.p.lo,g:c.p.elev!=null?+c.p.elev:0,col:BBWIND.column(c.p.la,c.p.lo,time),tb:BBWIND.turb(c.p.la,c.p.lo,time)||[]}));
  const tbAt=(c,z)=>Math.max(0,...c.tb.filter(l=>z>=l.zlo-1&&z<=l.zhi+1).map(l=>l.cat)); const TBN=[ '', L({en:'light–moderate turbulence',no:'lett–moderat turbulens'}), L({en:'moderate turbulence',no:'moderat turbulens'}), L({en:'severe turbulence possible',no:'mulig kraftig turbulens'}) ];
  const levs=[925,850,800,700,600,500,400,300,250,200];
  const cell=(c,h)=>{ if(!c.col) return '<td>–</td>'; const x=c.col.find(y=>y.hpa===h); if(!x) return '<td>–</td>'; const ug=x.z<c.g; const w=BBWIND.w3(BBWIND.dirOf(x.u,x.v),Math.round(Math.hypot(x.u,x.v)));
    const q=BBWIND.wxOf(x), tb=ug?0:tbAt(c,x.z), cls=[ug?'ugnd':'',!ug&&q.cloud?'cl'+q.cloud:'',!ug&&q.ice?'ice':'',tb>=2?'turb':''].filter(Boolean).join(' ');
    const tip=ug?L({en:'Below the ground here',no:'Under bakken her'}):[q.cloud?(q.cloud===2?L({en:'Cloud likely',no:'Skyer sannsynlig'}):L({en:'Cloud possible',no:'Skyer mulig'}))+' (RH '+Math.round(x.r)+' %)':'',q.ice?(q.ice===2?L({en:'Icing risk: high',no:'Isingsfare: høy'}):L({en:'Icing risk',no:'Isingsfare'})):'',tb?TBN[tb]:''].filter(Boolean).join(' · ');
    return `<td${cls?' class="'+cls+'"':''}${tip?' title="'+tip+'"':''}>${w}<br><small>${Math.round(x.t)}°${!ug&&q.ice?' <b class="icem">ICE</b>':''}${tb>=2?' <b class="tbm">TURB</b>':''}</small></td>`; };
  const rows=levs.slice().reverse().map(h=>`<tr><th>${BBWIND.FL[h]} <small>${h} hPa</small></th>${cols.map(c=>cell(c,h)).join('')}</tr>`);
  const crRow=`<tr class="cr"><th>${fx(cr)} ft <small>${L({en:'cruise',no:'marsj'})}</small></th>${cols.map(c=>{ const w=BBWIND.at(c.la,c.lo,cr,time); const tb=tbAt(c,cr); return w?`<td${w.cloud?' class="cl'+w.cloud+(w.ice?' ice':'')+'"':''}>${BBWIND.w3(w.dir,w.spd)}<br><small>${w.t}° · ISA ${w.isa>=0?'+':''}${w.isa}${w.ice?' · <b class="icem">'+L({en:'icing risk',no:'isingsfare'})+'</b>':w.cloud===2?' · '+L({en:'in cloud',no:'i sky'}):''}${tb?' · <b class="tbm">'+TBN[tb]+'</b>':''}</small></td>`:'<td>–</td>'; }).join('')}</tr>`;
  const frz=`<tr class="frz"><th>0 °C <small>${L({en:'freezing level',no:'frysenivå'})}</small></th>${cols.map(c=>{ const f=BBWIND.freezing(c.la,c.lo,time,c.g); return `<td>${!f?'–':f.below?L({en:'at ground',no:'ved bakken'}):fx(f.ft)+' ft'}</td>`; }).join('')}</tr>`;
  tb.innerHTML=`<thead><tr><th>${L({en:'Level',no:'Nivå'})}</th>${cols.map(c=>`<th>${esc(c.n)}</th>`).join('')}</tr></thead><tbody>${crRow}${frz}${rows.join('')}</tbody>`;
  const z=d=>d?new Date(d).toISOString().slice(8,10)+' '+new Date(d).toISOString().slice(11,16)+'Z':'?';
  nt.innerHTML=L({en:`Valid ${z(R0.valid)}, GFS run ${z(R0.run)} (NOAA, 0.25°). Wind: direction it blows from (° true) / kt; temperature °C. Levels are named by their standard flight level; heights are the model’s, so the real level varies with the pressure. Grey text: below the ground. Shaded: cloud likely (dark, RH ≥ 95 %) or possible (light, 85–95 %); ICE: cloud between 0 and −20 °C. TURB: Ellrod turbulence index moderate or more (vertical wind shear × deformation, mainly clear-air turbulence near jet streams). Cloud, icing and turbulence are rough guides from the model, not forecasts. Planning practice: check the official winds and temperatures forecast before flight.`,no:`Gyldig ${z(R0.valid)}, GFS-kjøring ${z(R0.run)} (NOAA, 0,25°). Vind: retningen den blåser fra (° rettvisende) / kt; temperatur °C. Nivåene har navn etter standard flygenivå; høydene er modellens, så det virkelige nivået varierer med trykket. Grå tekst: under bakken. Skravert: skyer sannsynlig (mørk, RF ≥ 95 %) eller mulig (lys, 85–95 %); ICE: skyer mellom 0 og −20 °C. TURB: Ellrod-turbulensindeks moderat eller mer (vertikalt vindskjær × deformasjon, mest klarluftsturbulens nær jetstrømmer). Skyer, ising og turbulens er grove pekepinner fra modellen, ikke prognoser. Planleggingsøving: sjekk den offisielle prognosen for vind og temperatur før flyging.`}); }
/* map barbs at the chosen level for the tiles in view (zoom ≥ 4, at most 9 tiles), at the ETD hour */
function waMapSoon(){ clearTimeout(WA.mt); WA.mt=setTimeout(waMapSync,600); }
async function waMapSync(){ if(!ML) return; if(!LY.wa){ mlPut('bb-wa',mlC([])); mlPut('bb-frz',mlC([])); return; } const z=ML.getZoom(); if(z<4){ mlPut('bb-wa',mlC([])); mlPut('bb-frz',mlC([])); return; }
  const b=ML.getBounds(), time=(WA.res&&WA.res.time)||BBWIND.hourIso(waEtd()); const tiles=[];
  for(let la=Math.floor(b.getSouth()/5)*5;la<b.getNorth()&&la<85;la+=5) for(let lo=Math.floor(b.getWest()/5)*5;lo<b.getEast();lo+=5) tiles.push(Math.max(-90,la)+','+(((lo+180)%360+360)%360-180));
  const T=tiles.slice(0,9); const key=T.join(';')+'|'+time+'|'+WA.lev+'|'+(z>=6?1:0); if(key===WA.mkey) return;
  await BBWIND.load(T,time); WA.mkey=key; const h=+WA.lev, stride=z>=7?1:z>=5.5?2:4, f=[];
  if(WA.lev==='frz'){ const g=[], st2=z>=7?2:z>=5.5?4:8; mlPut('bb-wa',mlC([]));
    T.forEach(t=>{ const [la0,lo0]=t.split(',').map(Number); const d=BBWIND.tileAt(la0+2.5,lo0+2.5,time); if(!d) return;
      for(let j=0;j<d.ny-1;j+=st2) for(let i=0;i<d.nx-1;i+=st2){ const la=d.la0-j*d.d, lo=d.lo0+i*d.d; const fz=BBWIND.freezing(la,lo,time,0); if(!fz) continue; const v=Math.round(fz.ft/100);
        g.push(mlF(mlP(la,lo),{f:fz.below?'0':String(v),v})); } });
    mlPut('bb-frz',mlC(g)); return; }
  mlPut('bb-frz',mlC([])); RXMAP.addBarbs(ML);
  T.forEach(t=>{ const [la0,lo0]=t.split(',').map(Number); const d=BBWIND.tileAt(la0+2.5,lo0+2.5,time); if(!d) return; const k=d.lev.indexOf(h); if(k<0||!d.u[k]) return;
    for(let j=0;j<d.ny-1;j+=stride) for(let i=0;i<d.nx-1;i+=stride){ const n=j*d.nx+i, u=d.u[k][n], v=d.v[k][n]; const sp=Math.hypot(u,v);
      f.push(mlF(mlP(d.la0-j*d.d,d.lo0+i*d.d),{s:Math.min(150,Math.round(sp/5)*5),d:BBWIND.dirOf(u,v),t:Math.round(d.t[k][n])})); } });
  mlPut('bb-wa',mlC(f)); }
el('wa_go').onclick=waGo;
el('waLev').value=WA.lev; el('waLev').addEventListener('change',e=>{ WA.lev=e.target.value; try{ localStorage.setItem('bb-rx-walev',WA.lev); }catch(x){} WA.mkey=''; if(!LY.wa){ LY.wa=1; saveLY(); lyUI(); drawMap(); } waMapSync(); });
/* ---------- navigasjonslogg: vindtrekant per etappe ----------
   TC = great-circle initial course of the leg, VAR from wmm.js (World Magnetic Model) at the leg's mid-point,
   wind for the route (R.nl.w) or per leg (p.nw on the leg's end point), TAS = the speed field in the profile bar. */
const nlWind=v=>{ const t=String(v||'').toUpperCase().replace(/\s/g,'').replace(/KTS?$/,''); const m=t.match(/^(\d{3})(\d{2,3})(?:G\d{2,3})?$/)||t.match(/^(\d{1,3})[\/@](\d{1,3})(?:G\d{1,3})?$/); if(!m) return null; const d=+m[1], sp=+m[2]; return d<=360?{d:d%360,s:sp}:null; };
const nlW3=w=>w?String(w.d||360).padStart(3,'0')+'/'+w.s:'';
function nlRows(M){ const NLs=R.nl||{}, tas=pnum(R.gs), rw=nlWind(NLs.w), ff=pnum(NLs.ff); let cum=0, cf=0; const rows=[];
  M.C.forEach((c,i)=>{ if(!i||['missed','alt'].includes(c.p.t)||c.d<0.05) return; const q=M.C[i-1].p, p=c.p; const ok=p.la!=null&&q.la!=null;
    const tc=ok?brg(q,p):null, va=ok?magVar(q,p):null, lw=nlWind(p.nw), w=lw||rw||{d:0,s:0}; const r={i,from:q.n||'',to:p.n||'',d:c.d,tc,va,w:lw||rw,lw:p.nw||'',fc:!!p.nwf&&!!lw};
    if(tc!=null&&tas>0){ const a=(w.d-tc)*D2R, sx=w.s*Math.sin(a)/tas; if(Math.abs(sx)<=1){ const wca=Math.asin(sx)*R2D; r.wca=wca; r.gs=tas*Math.cos(wca*D2R)-w.s*Math.cos(a); r.th=((tc+wca)%360+360)%360; if(va!=null) r.mh=((r.th-va)%360+360)%360; }
      if(r.gs>0){ r.t=c.d/r.gs*60; cum+=r.t; r.cum=cum; if(ff){ r.fu=r.t/60*ff; cf+=r.fu; } } }
    rows.push(r); });
  return {rows,tas,ff,cum,cf,dist:rows.reduce((a,r)=>a+r.d,0),fu:NLs.fu||'L'}; }
const d3=v=>v==null?'–':String(Math.round(v)%360||360).padStart(3,'0');
const mmss=m=>m==null?'–':Math.floor(Math.round(m)/60)+':'+String(Math.round(m)%60).padStart(2,'0');
function nlTable(N,print){ const H=[L({en:'Leg',no:'Etappe'}),'TC','NM','VAR',L({en:'Wind',no:'Vind'}),'WCA','TH','MH','GS',L({en:'Time',no:'Tid'}),L({en:'Total',no:'Totalt'}),L({en:'Fuel',no:'Drivstoff'})];
  const rw=nlW3(nlWind((R.nl||{}).w));
  const body=N.rows.map(r=>`<tr><td>${esc(r.from)} → ${esc(r.to)}</td><td class="nx">${d3(r.tc)}°</td><td>${fx(r.d,1)}</td><td class="nx">${r.va!=null?WMM.fmt(r.va,LAB.lang==='no'):'–'}</td><td>${print?esc(nlW3(r.w)||'–'):`<input data-nw="${r.i}"${r.fc?' class="fc" title="'+L({en:'From the forecast (GFS)',no:'Fra prognosen (GFS)'})+'"':''} value="${esc(r.lw)}" placeholder="${esc(rw||'000/0')}" aria-label="${L({en:'Wind for this leg',no:'Vind for etappen'})}" autocomplete="off" spellcheck="false">`}</td><td class="nx">${r.wca!=null?(r.wca>=0?'+':'−')+Math.abs(Math.round(r.wca))+'°':'–'}</td><td class="nx">${d3(r.th)}°</td><td class="hd">${d3(r.mh)}°</td><td>${r.gs!=null?fx(r.gs):'–'}</td><td>${r.t!=null?Math.round(r.t):'–'}</td><td>${mmss(r.cum)}</td><td>${r.fu!=null?fx(r.fu,1):'–'}</td></tr>`).join('');
  const NX=[1,3,5,6], cx=k=>NX.includes(k)?' class="nx"':'';
  return `<thead><tr>${H.map((h,k)=>`<th${cx(k)}>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody><tfoot><tr><td>${L({en:'Total',no:'Totalt'})}</td><td class="nx"></td><td>${fx(N.dist,1)}</td><td class="nx"></td><td></td><td class="nx"></td><td class="nx"></td><td></td><td></td><td></td><td>${mmss(N.cum||null)}</td><td>${N.cf?fx(N.cf,1)+' '+esc(N.fu):'–'}</td></tr></tfoot>`; }
function drawNavlog(M){ const p=el('nlp'); if(!p||p.hidden||!R) return; M=M||compute(); const N=nlRows(M), NLs=R.nl||{}; try{ waDraw(M,N); }catch(e){} try{ nrDraw(M); }catch(e){}
  const ae=document.activeElement; if(ae!==el('nl_tas')) el('nl_tas').value=R.gs||''; if(ae!==el('nl_w')) el('nl_w').value=NLs.w||''; if(ae!==el('nl_ff')) el('nl_ff').value=NLs.ff||''; if(ae!==el('wa_etd')) el('wa_etd').value=NLs.etd||''; el('nl_fu').value=NLs.fu||'L';
  const keep=ae&&ae.dataset&&ae.dataset.nw, pos=keep&&ae.selectionStart; el('nlt').innerHTML=N.rows.length?nlTable(N):'';
  if(keep){ const i=el('nlt').querySelector(`[data-nw="${keep}"]`); if(i){ i.focus(); try{ i.setSelectionRange(pos,pos); }catch(e){} } }
  const bad=N.tas&&N.rows.some(r=>r.tc!=null&&r.gs==null);
  el('nlnote').innerHTML=[!N.rows.length?L({en:'Build a route first.',no:'Bygg en rute først.'}):'', N.rows.length&&!N.tas?`<b>${L({en:'Enter the TAS to get headings, times and fuel.',no:'Skriv inn TAS for å få kurser, tider og drivstoff.'})}</b>`:'', bad?`<span class="ko">${L({en:'The wind is stronger than the TAS on some legs.',no:'Vinden er sterkere enn TAS på noen etapper.'})}</span>`:'',
    `<span class="nxn">${L({en:'On a phone TC, VAR, WCA and TH are hidden: turn the phone or print the navlog for every column.',no:'På telefon er TC, VAR, WCA og TH skjult: snu telefonen eller skriv ut navloggen for alle kolonnene.'})}</span>`,
    L({en:'TC: true course of each leg (great circle, at the start of the leg). VAR: World Magnetic Model at the middle of the leg (+E). Wind: direction it blows from (° true) / kt; a leg without its own wind uses the route wind. MH = TH − VAR. Times in minutes. For planning practice: check against your charts and the forecast winds aloft.',no:'TC: rettvisende kurs for etappen (storsirkel, ved starten). VAR: World Magnetic Model midt på etappen (+Ø). Vind: retningen den blåser fra (° rettvisende) / kt; en etappe uten egen vind bruker vinden for ruten. MH = TH − VAR. Tider i minutter. Til planleggingsøvelse: sjekk mot kartene og prognosen for vind i høyden.'})].filter(Boolean).join(' '); }
function nlLabel(){ const w=R&&((R.nl&&nlWind(R.nl.w))||(R.pts||[]).some(p=>nlWind(p.nw))); const g=document.querySelector('.shcr .gsl'); if(g) g.textContent=w?'TAS':'GS'; }
function nlOpen(on){ const p=el('nlp'); if(on&&!el('advp').hidden) el('shAdv').click(); p.hidden=!on; el('xsMode').hidden=on||!el('advp').hidden; el('shNl').setAttribute('aria-pressed',String(on));
  if(on){ if(el('sheet').dataset.s==='min'||el('sheet').dataset.s==='off') setSheet('mid'); drawNavlog(); } else drawProfile(compute(),TP); }
el('shNl').onclick=()=>nlOpen(el('nlp').hidden);
el('nlp').addEventListener('input',e=>{ const t=e.target; if(!R) return; R.nl=R.nl||{};
  if(t.id==='nl_tas'){ const sg=el('s_gs'); sg.value=t.value; sg.dispatchEvent(new Event('input')); }
  else if(t.id==='nl_w') R.nl.w=t.value.trim(); else if(t.id==='nl_ff') R.nl.ff=t.value.trim(); else if(t.id==='nl_fu') R.nl.fu=t.value;
  else if(t.dataset.nw!=null){ const c=compute().C[+t.dataset.nw]; if(c){ c.p.nw=t.value.trim(); delete c.p.nwf; } }
  else if(t.id==='wa_etd'){ R.nl.etd=t.value.trim(); return queueSave(); }
  nlLabel(); drawNavlog(); queueSave(); });
el('nl_fu').addEventListener('change',e=>{ R.nl=R.nl||{}; R.nl.fu=e.target.value; drawNavlog(); queueSave(); });
el('nlprint').onclick=()=>{ const M=compute(), N=nlRows(M); let o=el('nlprint-out'); if(!o){ o=document.createElement('div'); o.id='nlprint-out'; document.body.appendChild(o); }
  const dep=M.C[0]&&M.C[0].p.n, dst=M.C.length?M.C[M.C.length-1].p.n:''; const NLs=R.nl||{};
  o.innerHTML=`<h2>${L({en:'Navigation log',no:'Navigasjonslogg'})} · ${esc(dep||'')} → ${esc(dst||'')}</h2><p>TAS ${esc(String(R.gs||'–'))} kt · ${L({en:'wind',no:'vind'})} ${esc(nlW3(nlWind(NLs.w))||'–')} · ${L({en:'cruise',no:'marsj'})} ${M.cr!=null?altTxt(M.cr):'–'} · ${L({en:'fuel flow',no:'forbruk'})} ${esc(NLs.ff||'–')} ${esc(NLs.fu||'L')}/h · ${new Date().toISOString().slice(0,10)}</p><table>${nlTable(N,true)}</table><p style="font-size:10px">${L({en:'NORDAP Route Explorer, for planning practice. Not an official flight plan.',no:'NORDAP Route Explorer, til planleggingsøvelse. Ikke en offisiell reiseplan.'})}</p>`;
  document.body.classList.add('printnl'); const done=()=>{ document.body.classList.remove('printnl'); window.removeEventListener('afterprint',done); }; window.addEventListener('afterprint',done); window.print(); setTimeout(done,1500); };

/* ---------- eksport: GPX, Garmin .fpl og rutetekst (ForeFlight leser GPX og FPL) ---------- */
function xq(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
function exPts(){ return (R.pts||[]).filter(p=>p.la!=null&&p.lo!=null&&!['missed','alt'].includes(p.t)); }
const llIcao=(la,lo)=>{ const f=(v,w,h)=>{ const a=Math.abs(v), d=Math.floor(a), m=Math.round((a-d)*60); const [D,M_]=m===60?[d+1,0]:[d,m]; return String(D).padStart(w,'0')+String(M_).padStart(2,'0')+(v<0?h[1]:h[0]); }; return f(la,2,'NS')+f(lo,3,'EW'); };
const asc=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/Ø/g,'O').replace(/ø/g,'o').replace(/Æ/g,'AE').replace(/æ/g,'ae').replace(/Å/g,'A').replace(/å/g,'a');
const isAp=p=>p.t==='rwy'&&/^[A-Z]{4}$/.test(p.n||'')&&NAV&&NAV.apI&&NAV.apI[p.n];
function exName(){ const P=exPts(); return P.length?asc((P[0].n||'')+'-'+(P[P.length-1].n||'')).replace(/[^A-Za-z0-9-]/g,'')||'route':'route'; }
function toGpx(){ const P=exPts(), nm=exName();
  const pt=p=>`    <rtept lat="${p.la.toFixed(6)}" lon="${p.lo.toFixed(6)}">${isAp(p)&&NAV.apI[p.n][4]!=null?`<ele>${(NAV.apI[p.n][4]*0.3048).toFixed(1)}</ele>`:''}<name>${xq(p.n||llIcao(p.la,p.lo))}</name>${p.note?`<desc>${xq(p.note)}</desc>`:''}<sym>${isAp(p)?'Airport':'Waypoint'}</sym></rtept>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="NORDAP Route Explorer (nordap.eu)" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n  <metadata><name>${xq(nm)}</name><time>${new Date().toISOString().replace(/\.\d+Z$/,'Z')}</time></metadata>\n  <rte>\n    <name>${xq(nm)}</name>\n${P.map(pt).join('\n')}\n  </rte>\n</gpx>\n`; }
function toFpl(){ const P=exPts(), used={}, tbl=[], seq=[];
  P.forEach((p,i)=>{ let id, ty, cc='';
    if(isAp(p)){ id=p.n; ty='AIRPORT'; cc=p.n.slice(0,2); }
    else { ty='USER WAYPOINT'; let b=/^\d{2,4}[NS]\d{3,5}[EW]$/i.test(String(p.n||'').replace(/[\s\/]/g,''))?'':asc(p.n||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); if(!b) b='WP'+String(i+1).padStart(2,'0'); id=b; let k=2; while(used[id+'|'+ty]&&(used[id+'|'+ty].la!==p.la||used[id+'|'+ty].lo!==p.lo)) id=b.slice(0,6-String(k).length)+(k++); }
    const key=id+'|'+ty; if(!used[key]){ used[key]={la:p.la,lo:p.lo}; tbl.push(`    <waypoint>\n      <identifier>${xq(id)}</identifier>\n      <type>${ty}</type>\n      <country-code>${xq(cc)}</country-code>\n      <lat>${p.la.toFixed(6)}</lat>\n      <lon>${p.lo.toFixed(6)}</lon>${(()=>{ const cm=asc(p.n&&p.n!==id?p.n:'').toUpperCase().replace(/[^A-Z0-9 ]/g,'').slice(0,25).trim(); return cm?`\n      <comment>${xq(cm)}</comment>`:''; })()}\n    </waypoint>`); }
    seq.push(`    <route-point>\n      <waypoint-identifier>${xq(id)}</waypoint-identifier>\n      <waypoint-type>${ty}</waypoint-type>\n      <waypoint-country-code>${xq(cc)}</waypoint-country-code>\n    </route-point>`); });
  const rn=asc(P.length?(P[0].n||'')+' TO '+(P[P.length-1].n||''):'ROUTE').toUpperCase().replace(/[^A-Z0-9 ]/g,'').slice(0,25).trim()||'ROUTE';
  return `<?xml version="1.0" encoding="utf-8"?>\n<flight-plan xmlns="http://www8.garmin.com/xmlschemas/FlightPlan/v1">\n  <created>${new Date().toISOString().replace(/\.\d+Z$/,'Z')}</created>\n  <waypoint-table>\n${tbl.join('\n')}\n  </waypoint-table>\n  <route>\n    <route-name>${xq(rn)}</route-name>\n    <flight-plan-index>1</flight-plan-index>\n${seq.join('\n')}\n  </route>\n</flight-plan>\n`; }
function toTxt(){ const P=exPts(); return P.map(p=>{ const n=String(p.n||'').toUpperCase(); return n&&/^[A-Z0-9]{2,5}$/.test(n)&&NAV&&resolvable(n)?n:llIcao(p.la,p.lo); }).join(' DCT '); }
function exSave(name,type,text){ const b=new Blob([text],{type}), u=URL.createObjectURL(b), a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000); }
function exToast(btn,t){ const o=btn.textContent; btn.textContent=t; btn.disabled=true; setTimeout(()=>{ btn.textContent=o; btn.disabled=false; },1600); }
async function exDo(k,btn){ if(exPts().length<2){ exToast(btn,L({en:'Build a route first',no:'Bygg en rute først'})); return; }
  if(k==='gpx') exSave(exName()+'.gpx','application/gpx+xml',toGpx());
  else if(k==='fpl') exSave(exName()+'.fpl','application/xml',toFpl());
  else { const t=toTxt(); let ok=false; try{ await navigator.clipboard.writeText(t); ok=true; }catch(e){ const ta=document.createElement('textarea'); ta.value=t; ta.style.cssText='position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); try{ ok=document.execCommand('copy'); }catch(_){} ta.remove(); }
    exToast(btn,ok?L({en:'Copied',no:'Kopiert'})+' ✓':t); } }
document.addEventListener('click',e=>{ const b=e.target.closest('[data-ex]'); if(b) exDo(b.dataset.ex,b); });
/* ---------- luftrom langs ruten i profilen (openAIP-fliser som er lastet i kartet) ---------- */
let ASR=null; const ASX={t:0,key:'',dirty:false};
const AS_COL={b:'#1D4E9E',r:'#B3261E',m:'#9A1E68',a:'#A0620A'};
function asSoon(ms){ clearTimeout(ASX.t); ASX.t=setTimeout(asCalc,ms==null?250:ms); }
function asEnd(M){ let x=0; M.C.forEach(c=>{ if(c.p.la!=null&&!['missed','alt'].includes(c.p.t)) x=Math.max(x,c.x); }); return x; }
/* Only tiles in view are loaded, so what was found earlier is kept: for the parts of the route in view now the fresh
   result is used, for the parts out of view the remembered one. The list says so while part of the route has never been
   in view (or only zoomed out past the tiles). The memory is cleared when the route or the airspace switches change. */
function ivClip(iv,runs){ const o=[]; iv.forEach(([a,b])=>runs.forEach(([c,d])=>{ const x=Math.max(a,c), y=Math.min(b,d); if(y-x>1e-6) o.push([x,y]); })); return o; }
function ivUnion(iv){ const s=iv.slice().sort((p,q)=>p[0]-q[0]), o=[]; s.forEach(v=>{ const l=o[o.length-1]; if(l&&v[0]<=l[1]+0.02) l[1]=Math.max(l[1],v[1]); else o.push(v.slice()); }); return o; }
function ivNot(runs,t){ const o=[]; let x=0; ivUnion(runs).forEach(([a,b])=>{ if(a>x) o.push([x,a]); x=Math.max(x,b); }); if(x<t) o.push([x,t]); return o; }
function asCalc(){ ASX.dirty=false; if(!ML||!R||T3.play) return; const M=compute(), tA=asEnd(M); let res=null;
  if(M.C.length>=2&&tA>0.2&&ML.__bb.oaip==='ok'&&LY.as){ const cur=RXMAP.asRoute(ML,{total:tA,posAt:M.posAt});
    const mk=JSON.stringify([R.pts.map(p=>[p.la,p.lo,p.t]),['asCtr','asTma','asRes','asTiz','asAtz','asTra'].map(k=>LY[k])]);
    if(!ASX.mem||ASX.mem.k!==mk) ASX.mem={k:mk,seen:[],list:new Map()};
    // parts of the route in view now (tiles exist from zoom 5)
    const runs=[]; if(ML.getZoom()>=5){ const b=ML.getBounds(), n=Math.max(40,Math.min(400,Math.ceil(tA/0.5))); let st=null;
      for(let i=0;i<=n;i++){ const x=tA*i/n, q=M.posAt(x), v=!!q&&b.contains([q.lo,q.la]); if(v&&st==null) st=x; if((!v||i===n)&&st!=null){ runs.push([st,v?x:Math.max(st,x-tA/n)]); st=null; } } }
    const mem=ASX.mem, out=ivNot(runs,tA), keys=new Set([...mem.list.keys(),...cur.list.map(a=>a.key)]), list=[];
    keys.forEach(k=>{ const c=cur.list.find(a=>a.key===k), m=mem.list.get(k), base=c||m;
      const iv=ivUnion(ivClip(c?c.iv:[],runs).concat(ivClip(m?m.iv:[],out))).filter(v=>v[1]-v[0]>0.02);
      if(iv.length){ const e=Object.assign({},base,{iv}); list.push(e); mem.list.set(k,e); } else mem.list.delete(k); });
    mem.seen=ivUnion(mem.seen.concat(runs)); list.sort((p,q)=>p.iv[0][0]-q.iv[0][0]);
    res={list,ok:true,tA,partial:ivNot(mem.seen,tA).some(([a,b])=>b-a>0.3)}; }
  const key=res?JSON.stringify([res.partial,res.list.map(a=>[a.key,a.iv.map(v=>v.map(x=>+x.toFixed(2)))])]):'';
  ASR=res; if(key!==ASX.key){ ASX.key=key; drawProfile(compute(),TP); } }
function asGnd(tp,x){ if(!tp||!tp.pts||!tp.pts.length) return 0; const P=tp.pts, st=P.length>1?(P[1].x-P[0].x):1; const q=P[Math.max(0,Math.min(P.length-1,Math.round((x-P[0].x)/Math.max(1e-6,st))))]; return (q.c!=null?q.c:q.e)||0; }
const asLo=(a,g)=>!a.lo?g:a.lo.agl?g+a.lo.ft:a.lo.ft, asUp=(a,g)=>!a.up?1e6:a.up.agl?g+a.up.ft:a.up.ft;
// where the planned altitude is inside each airspace (Altitude line / Climb and descent)
function asIn(M,tp,a){ if(M.PM==='ter') return []; const out=[]; a.iv.forEach(([x0,x1])=>{ const n=Math.max(4,Math.ceil((x1-x0)/0.1)); let st=null;
  for(let i=0;i<=n;i++){ const x=x0+(x1-x0)*i/n, g=asGnd(tp,x), al=M.altAt(x), v=al>=asLo(a,g)&&al<asUp(a,g); if(v&&st==null) st=x; if((!v||i===n)&&st!=null){ if(x-st>0.05) out.push([st,x]); st=null; } } }); return out; }
function asDraw(M,tp,o){ const {add,XS,YS,T0,H,W0,L0,R0,ymax}=o; const A=ASR&&ASR.list||[]; if(!A.length||!ML){ asList(M,tp); return null; }
  const tot=Math.max(1,M.total), Yc=a=>Math.max(T0,Math.min(T0+H,YS(Math.min(a,ymax*1.2)))), g=add('g',{class:'asg','pointer-events':'none'}), bands=[], labs=[];
  const big=A.slice().sort((p,q)=>(asUp(q,0)-asLo(q,0))-(asUp(p,0)-asLo(p,0)));
  big.forEach(a=>{ const col=AS_COL[a.cat]||AS_COL.b;
    a.iv.forEach(([x0,x1])=>{ x0=Math.max(0,x0); x1=Math.min(tot,x1); if(x1-x0<0.02) return; const n=(a.lo&&a.lo.agl||a.up&&a.up.agl||!a.lo)?Math.max(2,Math.ceil((x1-x0)/0.25)):1, xs=[]; for(let i=0;i<=n;i++) xs.push(x0+(x1-x0)*i/n);
      const top=xs.map(x=>[XS(x),Yc(asUp(a,asGnd(tp,x)))]), bot=xs.map(x=>[XS(x),Yc(asLo(a,asGnd(tp,x)))]).reverse();
      const pth=pp=>pp.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' ');
      add('path',{d:pth(top.concat(bot))+' Z',fill:col,'fill-opacity':a.cat==='b'&&a.type!=='ctr'?0.07:0.11,stroke:'none'},g);
      const up=asUp(a,0), clip=up>ymax*1.2&&!(a.up&&a.up.agl);
      add('path',{d:pth(top),fill:'none',stroke:col,'stroke-width':1.3,'stroke-opacity':clip?0.25:0.75,'stroke-dasharray':clip?'2 4':''},g);
      if(!(a.lo&&a.lo.gnd)&&a.lo) add('path',{d:pth(bot),fill:'none',stroke:col,'stroke-width':1.1,'stroke-opacity':0.6},g);
      [[top[0],bot[bot.length-1]],[top[top.length-1],bot[0]]].forEach(([p,q])=>add('line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1],stroke:col,'stroke-width':1,'stroke-opacity':0.55,'stroke-dasharray':'4 3'},g));
      labs.push({a,col,xa:XS(x0),xb:XS(x1),yt:Math.min(...top.map(q=>q[1])),yb:Math.max(...bot.map(q=>q[1]))}); }); });
  const IN=A.map(a=>({a,inn:asIn(M,tp,a)}));
  return {after(){ // over the terrain: highlight where your altitude is inside, then the labels
    IN.forEach(({a,inn})=>inn.forEach(([x0,x1])=>{ const n=Math.max(2,Math.ceil((x1-x0)/0.2)); let d=''; for(let i=0;i<=n;i++){ const x=x0+(x1-x0)*i/n; d+=(i?' L':'M')+XS(x).toFixed(1)+' '+YS(M.altAt(x)).toFixed(1); }
      add('path',{d,fill:'none',stroke:AS_COL[a.cat]||AS_COL.b,'stroke-width':10,'stroke-opacity':0.28,'stroke-linecap':'round',class:'asin','pointer-events':'none'}); }));
    asList(M,tp,IN); },
  labels(){ // last, over the path: name, class and limits inside each box, away from the profile buttons
    const placed=[]; try{ const pz=el('pzoom'), sv=el('psv'); if(pz&&sv&&!PACKDIM){ const a=pz.getBoundingClientRect(), b=sv.getBoundingClientRect(), k=W0/Math.max(1,b.width); if(a.width) placed.push([(a.left-b.left)*k-4,(a.top-b.top)*k-2,a.width*k+8,a.height*k+4]); } }catch(e){} labs.sort((p,q)=>(p.xb-p.xa)-(q.xb-q.xa)).forEach(l=>{ const w=l.xb-l.xa; if(w<64) return; const t1=l.a.name+(l.a.cls?' ('+l.a.cls+')':''), t2=(l.a.lo?l.a.lo.txt:'GND')+'–'+(l.a.up?l.a.up.txt:'?');
      const tw=Math.min(w-8,Math.max(t1.length,t2.length)*5.9+6); let x=Math.max(l.xa,L0)+5, y=Math.max(l.yt,T0)+13;
      for(let k=0;k<8;k++){ const hitR=placed.some(r=>x<r[0]+r[2]&&x+tw>r[0]&&y-11<r[1]+r[3]&&y+15>r[1]); if(!hitR) break; y+=26; }
      if(y+14>Math.min(l.yb,T0+H)-2||y+14>T0+H) return; placed.push([x,y-11,tw,26]);
      const T=(t,yy,b)=>{ const e=add('text',{x,y:yy,'font-family':'Archivo, Arial Narrow, sans-serif','font-size':b?10.5:10,'font-weight':b?700:400,fill:l.col,'paint-order':'stroke',stroke:'rgba(251,251,248,.9)','stroke-width':3,'pointer-events':'none'}); e.textContent=t.length>Math.floor(w/5.6)?t.slice(0,Math.max(4,Math.floor(w/5.6)-1))+'…':t; };
      T(t1,y,1); T(t2,y+12,0); }); } }; }
function asList(M,tp,IN){ try{ swList(M); }catch(e){} const box=el('asl'); if(!box||PACKDIM) return; const A=ASR&&ASR.list;
  if(!ML||!ASR||!LY.as||ML.__bb.oaip!=='ok'||M.C.length<2){ box.hidden=true; box.innerHTML=''; return; }
  IN=IN||A.map(a=>({a,inn:asIn(M,tp,a)})); const big=ASR.tA>30, nm=v=>big?fx(Math.round(v)):fx(v,1);
  const ctl=c=>c==='r'?L({en:'inside: needs permission',no:'inne: krever tillatelse'}):c==='a'?L({en:'inside: check if active',no:'inne: sjekk om aktivt'}):c==='m'?L({en:'inside: radio / transponder',no:'inne: radio / transponder'}):L({en:'inside: needs clearance',no:'inne: krever klarering'});
  const li=IN.map(({a,inn})=>{ const col=AS_COL[a.cat]||AS_COL.b; return `<li class="${inn.length?'in':''}" style="${inn.length?'color:'+col:''}"><i style="background:${col}"></i><span style="color:var(--ink)"><b>${esc(a.name)}</b>${a.cls?' ('+a.cls+')':''}${asFq(a)?' <b class="mono">'+asFq(a)+'</b>':''} <small>${esc((a.lo?a.lo.txt:'GND')+'–'+(a.up?a.up.txt:'?'))} · ${a.iv.map(v=>nm(v[0])+'–'+nm(v[1])).join(', ')} NM</small></span>${inn.length?`<em style="background:${col}">${ctl(a.cat)}</em>`:''}</li>`; }).join('');
  box.hidden=false; box.innerHTML=`<div class="ash"><b>${L({en:'Route crosses',no:'Ruten krysser'})}</b>${A.length?'':`<span>${L({en:'no openAIP airspace of the types switched on in Layers.',no:'ikke noe openAIP-luftrom av typene som er slått på under Kartlag.'})}</span>`}</div>${A.length?`<ul>${li}</ul>`:''}`+
    (ASR.partial?`<span class="asn asw">${L({en:'Part of the route is outside the map view, so airspace there is not loaded and not listed.',no:'En del av ruten er utenfor kartutsnittet, så luftrommet der er ikke lastet og ikke med.'})} <button type="button" data-asfit="1">${L({en:'Show the whole route',no:'Vis hele ruten'})}</button></span>`:'')+
    `<span class="asn">${L({en:'Airspace from openAIP, a community database: not an official source. Check the AIP and NOTAM.',no:'Luftrom fra openAIP, en dugnadsdatabase: ikke en offisiell kilde. Sjekk AIP og NOTAM.'})}</span>`; }
el('asl').addEventListener('click',e=>{ if(e.target.closest('[data-asfit]')){ fit(); setTimeout(()=>asSoon(0),900); } });
/* ---------- go / no-go while planning: what Route Explorer knows, each point with its reason and a button to what is missing ----------
   The same idea as the briefing pack's summary (fuel, mass and balance and runway lengths stay there). The pilot decides. */
function sunsetAt(d,la,lo){ const D=Math.PI/180, J=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),12)/864e5+2440587.5, n=Math.round(J-2451545-0.0009+lo/360);
  const Js=2451545.0009-lo/360+n, M0=(357.5291+0.98560028*(Js-2451545))%360, C=1.9148*Math.sin(M0*D)+0.02*Math.sin(2*M0*D)+0.0003*Math.sin(3*M0*D), lam=(M0+C+180+102.9372)%360;
  const Jt=Js+0.0053*Math.sin(M0*D)-0.0069*Math.sin(2*lam*D), dec=Math.asin(Math.sin(lam*D)*Math.sin(23.4397*D)), cw=(Math.sin(-0.833*D)-Math.sin(la*D)*Math.sin(dec))/(Math.cos(la*D)*Math.cos(dec));
  if(cw<-1||cw>1) return null; const w=Math.acos(cw)/D/360; return { rise:new Date((Jt-w-2440587.5)*864e5), set:new Date((Jt+w-2440587.5)*864e5) }; }
let GOWX=0;
function goRoute(M){ const box=el('rgo'); if(!box) return; if(PACKDIM||M.C.length<2||!(M.total>0.2)){ box.hidden=true; return; }
  const G=[], add=(lv,t,why,act)=>G.push({lv,t,why,act}), btn=(go,txt)=>`<button type="button" class="btn sm" data-go="${go}">${txt}</button>`;
  const dep=M.C[0].p, dstC=[...M.C].reverse().find(c=>c.p.t==='rwy'&&c.i>0), dst=dstC?dstC.p:M.C[M.C.length-1].p, hmz=d=>String(d.getUTCHours()).padStart(2,'0')+String(d.getUTCMinutes()).padStart(2,'0')+'Z';
  // weather at departure and destination (fetched for the panel even with the weather layer off)
  const ids=[dep,dst].map(p=>p&&p.n).filter(id=>/^[A-Z]{4}$/.test(id||''));
  const need=ids.filter(id=>!WXS.c[id]||(!WXS.c[id].busy&&Date.now()-WXS.c[id].t>WX_TTL)); if(need.length&&Date.now()-GOWX>20e3){ GOWX=Date.now(); wxLib().catch(()=>{}).then(()=>wxFetch(need)).then(()=>goRoute(compute())).catch(()=>{}); }
  ids.forEach((id,i)=>{ const c=WXS.c[id], role=i===0&&ids.length>1?L({en:'Departure',no:'Avgang'}):L({en:'Destination',no:'Destinasjon'});
    if(!c||c.busy) { add('unk',`${role} ${id}`,L({en:'fetching METAR and TAF…',no:'henter METAR og TAF …'})); return; }
    if(!c.raw){ add('unk',`${role} ${id}`,L({en:'no METAR from this aerodrome',no:'ingen METAR fra denne flyplassen'})+(c.taf?'':' · '+L({en:'no TAF',no:'ingen TAF'})),btn('wx:'+id,L({en:'Weather page',no:'Vær-siden'}))); return; }
    const m=c.m||{}, age=c.obs?(Date.now()-new Date(c.obs))/36e5:0, cat=c.fc, gust=(m.wind&&m.wind.gust)||0, wnd=(m.wind&&m.wind.spd)||0, why=[];
    if(cat) why.push(cat==='VFR'?L({en:'VFR conditions',no:'VFR-forhold'}):cat==='SVFR'?L({en:'special VFR conditions (ceiling or visibility below VFR in a control zone)',no:'spesial-VFR-forhold (skydekke eller sikt under VFR i kontrollsone)'}):L({en:'IFR conditions',no:'IFR-forhold'}));
    if(gust||wnd>=20) why.push(L({en:`wind ${wnd} kt`,no:`vind ${wnd} kt`})+(gust?L({en:` gusting ${gust}`,no:` med kast ${gust}`}):''));
    if(age>3) why.push(L({en:`METAR ${Math.round(age)} h old`,no:`METAR ${Math.round(age)} t gammel`}));
    if(!c.taf) why.push(L({en:'no TAF',no:'ingen TAF'}));
    add(cat==='IFR'?'bad':(cat==='SVFR'||gust>=25||wnd>=25||age>3)?'warn':'ok',`${role} ${id}`,why.join(' · ')||L({en:'METAR read',no:'METAR lest'})); });
  // terrain clearance at cruise
  const ter=TP&&TP.pts.some(p=>p.e!=null)?Math.max(...TP.pts.map(p=>p.e||0)):null, mg=sNum('mg',1000);
  if(ter!=null&&M.cr==null) add('unk',L({en:'Terrain clearance',no:'Terrengklaring'}),L({en:`set a cruise altitude: highest terrain ±${fx(sNum('cw',4.3),1)} NM is ${fx(ter)} ft`,no:`sett marsjhøyde: høyeste terreng ±${fx(sNum('cw',4.3),1)} NM er ${fx(ter)} ft`}),btn('cr:'+Math.ceil((ter+mg)/500)*500,L({en:`Set ${fx(Math.ceil((ter+mg)/500)*500)} ft`,no:`Sett ${fx(Math.ceil((ter+mg)/500)*500)} ft`})));
  if(ter!=null&&M.cr!=null){ const d=M.cr-ter, need2=Math.ceil((ter+mg)/500)*500;
    add(d<0?'bad':d<mg?'warn':'ok',L({en:'Terrain clearance',no:'Terrengklaring'}),L({en:`cruise ${altTxt(M.cr)}, highest terrain ±${fx(sNum('cw',4.3),1)} NM ${fx(ter)} ft: ${d>=0?fx(d)+' ft above':fx(-d)+' ft below'}`,no:`marsj ${altTxt(M.cr)}, høyeste terreng ±${fx(sNum('cw',4.3),1)} NM ${fx(ter)} ft: ${d>=0?fx(d)+' ft over':fx(-d)+' ft under'}`})+(d<mg?' · '+L({en:`at least ${fx(need2)} ft with your ${fx(mg)} ft margin (plus obstacles)`,no:`minst ${fx(need2)} ft med marginen din på ${fx(mg)} ft (pluss hindringer)`}):''),d<mg?btn('cr:'+need2,L({en:`Set ${fx(need2)} ft`,no:`Sett ${fx(need2)} ft`})):''); }
  // SIGMET / AIRMET
  if(!LY.sig) add('unk','SIGMET / AIRMET',L({en:'not checked',no:'ikke sjekket'}),btn('sig',L({en:'Check the route',no:'Sjekk ruten'})));
  else if(SWH==null) add('unk','SIGMET / AIRMET',L({en:'loading…',no:'laster …'}));
  else { const inn=SWH.filter(h=>h.inAlt); add(inn.length?'bad':SWH.length?'warn':'ok','SIGMET / AIRMET',inn.length?inn.map(h=>`${h.s.type||'SIGMET'} ${sigLabel(h.s)}`).join('; ')+' · '+L({en:'at your altitude',no:'i høyden din'}):SWH.length?SWH.map(h=>`${h.s.type||'SIGMET'} ${sigLabel(h.s)}`).join('; ')+' · '+L({en:'not at your altitude',no:'ikke i høyden din'}):L({en:'none of the valid ones cross the route',no:'ingen av de gyldige krysser ruten'})); }
  // icing and turbulence from the model
  let A=null; try{ A=goData(M).aloft; }catch(e){}
  if(!A) add('unk',L({en:'Icing and turbulence (model)',no:'Ising og turbulens (modell)'}),L({en:'not checked',no:'ikke sjekket'}),btn('wa',L({en:'Get the forecast',no:'Hent prognosen'})));
  else { const fl=a=>a>=10000?'FL'+Math.round(a/100):fx(a)+' ft', alts=A.free.filter(a=>a!==A.cr), sug=alts.length?L({en:'Clear levels: ',no:'Frie høyder: '})+alts.slice(0,6).map(fl).join(', '):'';
    const parts=[]; if(A.ice) parts.push(L({en:`icing ${A.ice.x0}–${A.ice.x1} NM`,no:`ising ${A.ice.x0}–${A.ice.x1} NM`})+(A.ice.max>=2?L({en:' (high)',no:' (høy)'}):'')); if(A.turb) parts.push(L({en:`${A.turb.cat>=3?'severe':'moderate'} turbulence ${A.turb.x0}–${A.turb.x1} NM`,no:`${A.turb.cat>=3?'kraftig':'moderat'} turbulens ${A.turb.x0}–${A.turb.x1} NM`}));
    add(A.ice&&A.ice.max>=2||A.turb&&A.turb.cat>=3?'bad':parts.length?'warn':'ok',L({en:'Icing and turbulence (model)',no:'Ising og turbulens (modell)'}),(parts.join(' · ')||L({en:'none on your profile',no:'ingen på profilen din'}))+(parts.length&&sug?' · '+sug:'')); }
  // NOTAM
  if(!(R.ntm||'').trim()) add('unk','NOTAM',L({en:'not read',no:'ikke lest'}),btn('ntm',L({en:'Paste NOTAM',no:'Lim inn NOTAM'})));
  else { let n=0; try{ n=WXK.parseNotams(R.ntm).length; }catch(e){} add('ok','NOTAM',L({en:`${n} pasted, shown on the map`,no:`${n} limt inn, vist på kartet`})); }
  // daylight at the destination
  { const gs=+R.gs||0; if(!gs) add('unk',L({en:'Daylight',no:'Dagslys'}),L({en:'set ground speed to get an arrival time',no:'sett fart over bakken for å få ankomsttid'}),btn('gs','GS'));
    else { const etd=waEtd(), eta=new Date(+etd+M.total/gs*36e5), sd=dep&&dep.la!=null?sunsetAt(etd,dep.la,dep.lo):null, sa=dst&&dst.la!=null?sunsetAt(eta,dst.la,dst.lo):null;
      // sunrise and sunset on the day of departure (at departure) and of arrival (at the destination); polar day or night: no times
      if(sd&&sa){ const head=L({en:`ETD ${hmz(etd)}${R.nl&&R.nl.etd?'':' (now)'}, ETA ${hmz(eta)} · `,no:`ETD ${hmz(etd)}${R.nl&&R.nl.etd?'':' (nå)'}, ETA ${hmz(eta)} · `});
        if(etd<sd.rise) add('bad',L({en:'Daylight',no:'Dagslys'}),head+L({en:`departure before sunrise (${hmz(sd.rise)})`,no:`avgang før soloppgang (${hmz(sd.rise)})`}),btn('etd','ETD'));
        else if(eta>sa.set) add('bad',L({en:'Daylight',no:'Dagslys'}),head+L({en:`arrival ${Math.round((eta-sa.set)/60e3)} min after sunset (${hmz(sa.set)})`,no:`ankomst ${Math.round((eta-sa.set)/60e3)} min etter solnedgang (${hmz(sa.set)})`}),btn('etd','ETD'));
        else { const mg2=Math.round((sa.set-eta)/60e3); add(mg2<30?'warn':'ok',L({en:'Daylight',no:'Dagslys'}),head+L({en:`sunset ${hmz(sa.set)}: ${mg2} min margin`,no:`solnedgang ${hmz(sa.set)}: ${mg2} min margin`}),btn('etd','ETD')); } }
      else add('unk',L({en:'Daylight',no:'Dagslys'}),L({en:'polar day or night at these places: check the times yourself',no:'midnattssol eller mørketid her: sjekk tidene selv'})); } }
  // controlled airspace on the way
  if(ASR&&ASR.ok&&ASR.list){ const ctl=ASR.list.filter(a=>/^[A-D]$/.test(a.cls||'')||/^(ctr|tma|cta)$/.test(a.type)); if(ctl.length) add('warn',L({en:'Clearance',no:'Klarering'}),L({en:'controlled airspace on the route: ',no:'kontrollert luftrom på ruten: '})+ctl.slice(0,5).map(a=>a.name+(a.cls?' ('+a.cls+')':'')+(asFq(a)?' '+asFq(a):'')).join(', ')); }
  // the rest lives in the briefing pack
  add('pack',L({en:'Fuel, mass and balance, runway length',no:'Drivstoff, masse og balanse, banelengde'}),L({en:'in the briefing pack, with the full go / no-go',no:'i briefing-pakken, med full go / no-go'}),btn('pack',L({en:'Briefing pack',no:'Briefing-pakken'})));
  const nb=G.filter(g=>g.lv==='bad').length, nw=G.filter(g=>g.lv==='warn').length, nu=G.filter(g=>g.lv==='unk').length;
  const v=nb?['bad',L({en:'No-go as planned',no:'No-go slik det er planlagt'})]:nw?['warn',L({en:'Go only if you can manage the yellow points',no:'Go bare hvis du kan håndtere de gule punktene'})]:nu?['unk',L({en:`${nu} point${nu>1?'s':''} to check`,no:`${nu} punkt${nu>1?'er':''} å sjekke`})]:['ok',L({en:'Nothing found against it in this data. NOTAM, fuel, mass and performance are not checked here',no:'Ingenting funnet imot i disse dataene. NOTAM, drivstoff, masse og ytelse sjekkes ikke her'})];
  const ic={bad:'✗',warn:'!',ok:'✓',unk:'?',pack:'→'}, ord={bad:0,warn:1,unk:2,ok:3,pack:4}, open=box.querySelector('details')?box.querySelector('details').open:true;
  { const rb=el('rcgo'); if(rb){ rb.hidden=false; rb.className='rc-go gv-'+v[0]; rb.innerHTML=`<b>Go / no-go</b> ${esc(v[1])}${nu&&v[0]!=='unk'?` · ${nu} ${L({en:'to check',no:'å sjekke'})}`:''} <span aria-hidden="true">→</span>`; } }
  box.hidden=false; box.innerHTML=`<details${open?' open':''}><summary><b>Go / no-go</b><span class="gv gv-${v[0]}">${v[1]}</span></summary><ul>${G.slice().sort((a,b)=>ord[a.lv]-ord[b.lv]).map(g=>`<li class="g-${g.lv}"><i>${ic[g.lv]}</i><span><b>${esc(g.t)}</b> ${esc(g.why)}</span>${g.act||''}</li>`).join('')}</ul><p class="note">${L({en:'A summary of what Route Explorer knows. Model icing and turbulence are rough guides. You make the decision.',no:'Et sammendrag av det Route Explorer vet. Modell-ising og -turbulens er grove pekepinner. Du tar avgjørelsen.'})}</p></details>`; }
el('rcgo').addEventListener('click',()=>{ const o=el('shOpen'); if(o&&!o.hidden) o.click(); if(!el('nlp').hidden) nlOpen(false); if(!el('advp').hidden) el('shAdv').click(); setTimeout(()=>{ const d=el('rgo').querySelector('details'); if(d) d.open=true; el('rgo').scrollIntoView({block:'start',behavior:'smooth'}); },120); });
el('rgo').addEventListener('click',e=>{ const b=e.target.closest('button[data-go]'); if(!b) return; const g=b.dataset.go;
  if(g==='sig'){ LY.sig=1; const c=document.querySelector('input[data-ly="sig"]'); if(c) c.checked=true; try{ saveLY(); }catch(x){} sigSync(); setTimeout(()=>goRoute(compute()),1800); return; }
  if(g==='ntm'){ if(el('advp').hidden) el('shAdv').click(); setTimeout(()=>{ el('ntmin').scrollIntoView({block:'center'}); el('ntmin').focus(); },60); return; }
  if(g==='wa'&&!pnum(R.s&&R.s.cr)){ if(el('rcTog').getAttribute('aria-expanded')==='false') el('rcTog').click(); setTimeout(()=>{ const i=el('s_cr'); i.scrollIntoView({block:'center'}); i.focus(); },60); return; }
  if(g==='wa'){ nlOpen(true); setTimeout(()=>{ document.querySelector('.wabox').scrollIntoView({block:'start'}); const t=el('nl_tas'); if(!t.value) t.focus(); else el('wa_go').click(); },60); return; }
  if(g==='etd'){ nlOpen(true); setTimeout(()=>{ el('wa_etd').scrollIntoView({block:'center'}); el('wa_etd').focus(); },60); return; }
  if(g==='gs'){ const i=el('s_gs'); if(el('rcbody').hidden||el('rcTog').getAttribute('aria-expanded')==='false') el('rcTog').click(); setTimeout(()=>{ i.scrollIntoView({block:'center'}); i.focus(); },60); return; }
  if(g==='pack'){ el('packbtn').click(); return; }
  if(g.startsWith('cr:')){ const v=g.slice(3), i=el('s_cr'); i.value=v; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true})); return; }
  if(g.startsWith('wx:')){ window.open('weather.html?ids='+g.slice(3),'_blank','noopener'); } });
/* frequency for an airspace: openAIP's own if the tiles carry one, else the aerodrome's (TWR/AFIS/INFO) for a CTR, TIZ, ATZ or TIA
   named after an aerodrome (data/freq, OurAirports) */
function asFq(a){ if(a.freq) return a.freq; if(!/^(ctr|tiz|tia|atz|matz|htz|rmz|tmz)$/.test(a.type)||!NAV) return null;
  const w=String(a.name||'').toUpperCase().replace(/\b(CTR|TIZ|TIA|ATZ|MATZ|HTZ|RMZ|TMZ|CONTROL|ZONE|TRAFFIC|INFORMATION|AREA|SECTOR|\d+)\b/g,' ').trim().split(/\s+/)[0]; if(!w||w.length<3) return null;
  const ap=NAV.ap.find(x=>x[5]>=0&&String(x[1]).toUpperCase().split(/[\s,-]+/).includes(w)); if(!ap) return null; const p=ap[0].slice(0,2);
  if(!FQ[p]){ FQ[p]={p:fetch('data/freq/'+p+'.json').then(r=>r.ok?r.json():{}).catch(()=>({}))}; FQ[p].p.then(d=>{ FQ[p].d=d; try{ asList(compute(),TP); }catch(e){} }); return null; }
  const L0=FQ[p].d&&FQ[p].d[ap[0]]; if(!L0) return null; const f=['TWR','AFIS','INFO','A/G','RDO','CTAF','APP'].map(t=>L0.find(x=>x[0]===t)).find(Boolean); return f?f[2]:null; }
/* SIGMET/AIRMET that the route crosses (the map's SIGMET list), with the part of the route and whether your planned altitude is in it */
let SWH=null; // SIGMET/AIRMET hits on the route (null: not checked)
/* SIGMET/AIRMET areas the route passes through: [{s, iv:[[x0,x1] NM along the route], inAlt}] (null: layer off or nothing to check) */
function sigHits(M){ const items=(SIG.items||[]).filter(x=>x.poly&&(!x.to||new Date(x.to)>Date.now()));
  if(!LY.sig||!items.length||M.C.length<2||!(M.total>0.2)) return null;
  const tot=M.total, n=Math.max(40,Math.min(600,Math.ceil(tot/2))), S=[]; for(let i=0;i<=n;i++){ const x=tot*i/n, q=M.posAt(x); if(q&&q.la!=null) S.push({x,q}); }
  const hits=[]; items.forEach(s=>{ let x0=180,x1=-180,y0=90,y1=-90; s.poly.forEach(c=>{ x0=Math.min(x0,c[0]); x1=Math.max(x1,c[0]); y0=Math.min(y0,c[1]); y1=Math.max(y1,c[1]); });
    const iv=[]; let st=null, inAlt=false; S.forEach((p,k)=>{ const v=p.q.lo>=x0&&p.q.lo<=x1&&p.q.la>=y0&&p.q.la<=y1&&RXMAP.ringsIn([s.poly],p.q.lo,p.q.la);
      if(v){ if(st==null) st=p.x; if(M.PM!=='ter'){ const al=M.altAt(p.x); if(al>=(s.base||0)-1&&al<=(s.top==null?1e6:s.top)+1) inAlt=true; } }
      if((!v||k===S.length-1)&&st!=null){ iv.push([st,p.x]); st=null; } });
    if(iv.length) hits.push({s,iv,inAlt}); });
  return hits; }
function swList(M){ const box=el('swl'); if(!box) return; SWH=null; const hits=sigHits(M), tot=M.total;
  if(!hits){ box.hidden=true; box.innerHTML=''; return; }
  SWH=hits;
  if(!hits.length){ box.hidden=false; box.innerHTML=`<div class="ash"><b>${L({en:'SIGMET / AIRMET on the route',no:'SIGMET / AIRMET på ruten'})}</b><span>${L({en:'none of the valid ones cross the route.',no:'ingen av de gyldige krysser ruten.'})}</span></div>`; return; }
  const col=s=>RXMAP.SIGC[s.cat]||RXMAP.SIGC.other, nm=v=>tot>30?fx(Math.round(v)):fx(v,1);
  box.hidden=false; box.innerHTML=`<div class="ash"><b>${L({en:'SIGMET / AIRMET on the route',no:'SIGMET / AIRMET på ruten'})}</b></div><ul>`+hits.map(h=>`<li class="${h.inAlt?'in':''}" style="color:${col(h.s)}"><i style="background:${col(h.s)}"></i><span style="color:var(--ink)"><b>${esc(h.s.type||'SIGMET')} ${esc(h.s.series||'')}</b> ${esc(sigLabel(h.s))} <small>${esc(h.s.fir)} · ${sigLevels(h.s)||'?'} · ${h.iv.map(v=>nm(v[0])+'–'+nm(v[1])).join(', ')} NM</small></span>${h.inAlt?`<em style="background:${col(h.s)}">${L({en:'your altitude is in it',no:'høyden din er i den'})}</em>`:''}</li>`).join('')+'</ul>'; }
/* structured route data for the briefing pack's go/no-go: SIGMET/AIRMET hits and model icing/turbulence along the planned profile */
function goData(M){ const d={sigOn:!!LY.sig&&!!(SIG.items||[]).length,sw:null,aloft:null};
  if(SWH) d.sw=SWH.map(h=>({t:h.s.type||'SIGMET',l:sigLabel(h.s),cat:h.s.cat,fir:h.s.fir,lv:sigLevels(h.s)||'',in:!!h.inAlt,to:h.s.to||null,iv:h.iv.map(v=>[Math.round(v[0]),Math.round(v[1])])}));
  const R0=WA.res; if(!R0||!(M.total>0.2)||M.PM==='ter') return d;
  const n=Math.max(20,Math.min(160,Math.ceil(M.total/3))), xs=[]; for(let i=0;i<=n;i++){ const x=M.total*i/n, q=M.posAt(x); if(q&&q.la!=null) xs.push({x,q,a:M.altAt(x)}); }
  const tbAt=(q,a)=>{ const t=BBWIND.turb(q.la,q.lo,R0.time); return t?Math.max(0,...t.filter(l=>a>=l.zlo-1&&a<=l.zhi+1).map(l=>l.cat)):0; };
  let ice=null, tb=null, any=0; xs.forEach(p=>{ if(p.a<300) return; const w=BBWIND.at(p.q.la,p.q.lo,p.a,R0.time); if(!w) return; any=1;
    if(w.ice){ if(!ice) ice={x0:p.x,x1:p.x,max:0,a0:p.a,a1:p.a}; ice.x1=p.x; ice.max=Math.max(ice.max,w.ice); ice.a0=Math.min(ice.a0,p.a); ice.a1=Math.max(ice.a1,p.a); }
    const c=tbAt(p.q,p.a); if(c>=2){ if(!tb) tb={x0:p.x,x1:p.x,cat:0}; tb.x1=p.x; tb.cat=Math.max(tb.cat,c); } });
  if(!any) return d;
  // other cruise levels: which are free of model icing and moderate turbulence over the cruise part of the route
  const cr=M.cr!=null?M.cr:null, mid=xs.filter(p=>(!M.toc||p.x>=M.toc.x)&&(!M.tod||p.x<=M.tod.x)), free=[];
  // lowest level allowed: the highest terrain under the cruise legs plus your margin, or your MSA if higher; no terrain data → no suggestions
  const mg=+S('mg')||1000; let ter=null; for(let i=1;i<M.C.length;i++){ const x0=M.C[i-1].x, x1=M.C[i].x; if(!mid.some(p=>p.x>=x0&&p.x<=x1)) continue; const t=legTer(M,i)??pnum(M.C[i].p.ter); if(t!=null) ter=Math.max(ter==null?-1e9:ter,t); }
  const msa=Math.max(pnum(S('msa'))??-1e9, ter!=null?ter+mg:-1e9), floor=msa>-1e8?msa:null;
  if(cr!=null&&mid.length&&floor!=null){ for(let a=Math.max(1500,Math.ceil((cr-5000)/500)*500);a<=cr+5000;a+=500){ if(a<floor) continue;
    if(mid.every(p=>{ const w=BBWIND.at(p.q.la,p.q.lo,a,R0.time); return w&&!w.ice&&tbAt(p.q,a)<2; })) free.push(a); } }
  d.aloft={time:R0.time,cr,msa:floor,ice:ice&&{x0:Math.round(ice.x0),x1:Math.round(ice.x1),max:ice.max,a0:Math.round(ice.a0/100)*100,a1:Math.round(ice.a1/100)*100},turb:tb&&{x0:Math.round(tb.x0),x1:Math.round(tb.x1),cat:tb.cat},free};
  return d; }
/* ---------- profil-tegning ---------- */
const psv=el('psv');
function render(){
  SIMC.k=null; const M=compute(); drawTable(M); drawMap(M); simUI(M); drawProfile(M,TP); drawSum(M); drawMkList(M); drawSelbar(); wxMsg(M);
  if(T3.on&&!ML){ clearTimeout(T3.rb); T3.rb=setTimeout(()=>{ if(T3.on&&window.THREE) build3(); },350); }
  asSoon(); if(ML&&LY.wx) wxSoon(); if(ML&&LY.sig) sigSync(); if(ML&&LY.wa) waMapSoon(); if(R&&R.ntm) ntmSync(); if(ML&&(LY.rad||RAD.on)) radSync(); if(ML&&(LY.sat||SAT.on)) satSync(); try{ trkDraw(); }catch(e){} try{ swList(compute()); }catch(e){} try{ goRoute(M); }catch(e){} nlLabel(); drawNavlog(M); pmUI(); try{ daUI(); }catch(e){} if(HOV==null) rdo(null); sheetAuto(); { const e=R.pts.filter(p=>p.la!=null).length<2; el('sheet').classList.toggle('empty',e); const had=el('rx').classList.contains('has'); el('rx').classList.toggle('has',!e); if(had===e) setTimeout(()=>{ rxTop(); drawMap(); },0); }
  terrainProfile(M).then(tp=>{ if(tp!==TP||tp){ TP=tp; drawProfile(M,TP); drawTable(M); drawSum(M); try{ goRoute(M); }catch(e){} if(MODE==='draw') drawSheet(); } el('terstat').textContent= !window.TERRAIN? '' : TERRAIN.status(); drawSrc(); });
}
function hm(h){ if(!Number.isFinite(h)) return ''; const m=Math.round(h*60); return Math.floor(m/60)+':'+String(m%60).padStart(2,'0'); }
function rcSum(M,dep,dst,ter,gs){ // route card: one-line summary, from/to with names, distance / time / highest terrain
  const ft=el('rcft'), su=el('rcsum'), ln=el('rcline'); if(!ft) return;
  if(!M||M.C.length<2){ ft.hidden=su.hidden=true; ln.textContent=L({en:'No route yet',no:'Ingen rute ennå'}); return; }
  const to=dst?dst.p:M.C[M.C.length-1].p, nm=p=>{ const a=p&&NAV&&NAV.apI&&NAV.apI[p.n]; return a?a[1]:(p&&p.t==='rwy'?'':L({en:'Point',no:'Punkt'})); };
  const row=(l,p)=>`<span class="l">${l}</span><b>${esc(p.n||'–')}</b><span class="n" title="${esc(nm(p))}">${esc(nm(p))}</span>`;
  ft.innerHTML=row(L({en:'From',no:'Fra'}),dep)+row(L({en:'To',no:'Til'}),to); ft.hidden=false;
  const t=gs?hm(M.total/gs):'–';
  su.innerHTML=`<div><small>${L({en:'Distance',no:'Distanse'})}</small><b>${fx(M.total,1)} NM</b></div><div><small>${L({en:'Time',no:'Tid'})}${gs?'':' ('+L({en:'set GS',no:'sett GS'})+')'}</small><b id="rcte">${t}</b></div><div title="${L({en:'Highest terrain within',no:'Høyeste terreng innen'})} ±${fx(sNum('cw',4.3),1)} NM"><small>${L({en:'Highest terrain',no:'Høyeste terreng'})}</small><b>${ter!=null?fx(ter)+' ft':'…'}</b></div>`; su.hidden=false;
  ln.textContent=`${dep.n||''} → ${to.n||''} · ${fx(M.total,1)} NM`+(gs?` · ${t}`:''); }
function drawSum(M){ const sm=el('sum'); if(!M) M=compute(); if(M.C.length<2){ rcSum(M); sm.innerHTML=`<span>${L({en:'No route yet. Paste a route string or click on the map.',no:'Ingen rute ennå. Lim inn en rutestreng eller klikk på kartet.'})}</span>`; return; }
  const gs=+R.gs||0, dep=M.C[0].p, dst=[...M.C].reverse().find(c=>c.p.t==='rwy'&&c.i>0);
  const ter=TP&&TP.pts.some(p=>p.e!=null)? Math.max(...TP.pts.map(p=>p.e||0)) : null;
  const el_=p=>p&&p.t==='rwy'? (pnum(p.elev)!=null? fx(pnum(p.elev))+' ft' : '') : '';
  sm.innerHTML=[`<span><b>${esc(dep.n||'')}</b> → <b>${esc(dst?dst.p.n:(M.C[M.C.length-1].p.n||''))}</b></span>`,
    `<span>${L({en:'Distance',no:'Distanse'})} <b>${fx(M.total,1)} NM</b></span>`,
    `<span>${L({en:'Time',no:'Tid'})} <b id="sumt">${gs?hm(M.total/gs):'–'}</b> ${L({en:'at',no:'ved'})} <input id="gs" inputmode="decimal" value="${gs||''}" placeholder="kt" aria-label="${L({en:'Ground speed',no:'Fart over bakken'})}"> kt</span>`,
    M.cr!=null?`<span>${L({en:'Cruise',no:'Marsj'})} <b>${altTxt(M.cr)}</b></span>`:'',
    el_(dep)?`<span>${esc(dep.n)} <b>${el_(dep)}</b></span>`:'', dst&&el_(dst.p)?`<span>${esc(dst.p.n)} <b>${el_(dst.p)}</b></span>`:'',
    ter!=null?`<span>${L({en:'Highest terrain within',no:'Høyeste terreng innen'})} ±${fx(sNum('cw',4.3),1)} NM <b>${fx(ter)} ft</b></span>`:''].filter(Boolean).join('');
  rcSum(M,dep,dst,ter,gs);
  { const ss=el('shsum'); if(ss) ss.textContent=`${dep.n||''} → ${dst?dst.p.n:(M.C[M.C.length-1].p.n||'')} · ${fx(M.total,1)} NM`+(ter!=null?` · ${L({en:'highest terrain',no:'høyeste terreng'})} ±${fx(sNum('cw',4.3),1)} NM: ${fx(ter)} ft`:''); }
  const g=el('gs'); g.addEventListener('input',()=>{ R.gs=pnum(g.value)||''; el('sumt').textContent=R.gs?hm(M.total/R.gs):'–'; { const rt=el('rcte'); if(rt) rt.textContent=el('sumt').textContent; } const sg=el('s_gs'); if(sg) sg.value=g.value; simUI(); queueSave(); }); }
function drawSrc(){ const PMs=pmode(); const t=window.TERRAIN&&TERRAIN.status? TERRAIN.status() : '';
  el('srcl').innerHTML=[R&&R.noTer&&PMs!=='ter'?`<span>${L({en:'Terrain hidden',no:'Terreng skjult'})}</span>`:`<span><i style="background:#E2D8C3;border:1px solid #9C7646"></i>${L({en:'Terrain under the route',no:'Terreng under ruten'})}</span>`,
   PMs==='adv'?`<span><i style="background:repeating-linear-gradient(45deg,#D5DCE0 0 3px,#EEF1F3 3px 6px)"></i>${L({en:'Departure / approach: not checked',no:'Avgang / innflyging: ikke sjekket'})}</span>`:'',
   PMs==='ter'?'':`<span><i style="background:#B3261E;border-radius:50%;width:8px"></i>${L({en:'Below terrain',no:'Under terrenget'})} <i style="background:#C77700;border-radius:50%;width:8px;margin-left:8px"></i>${L({en:'Inside the clearance',no:'Innenfor klaringen'})}</span>`,
   PMs==='adv'?`<span><i style="background:#9A1E68"></i>${L({en:'Your path (illustrative)',no:'Din bane (illustrativ)'})}</span>`:PMs==='alt'?`<span><i style="background:#9A1E68"></i>${L({en:'Your altitude',no:'Din høyde'})}</span>`:'',
   PMs==='adv'?`<span><i style="background:#1D4E9E"></i>${L({en:'Your markers',no:'Dine markører'})}</span>`:'',
   PMs==='adv'?`<span><i style="background:#C6D0D3"></i>${L({en:'Cloud from METAR/TAF',no:'Skyer fra METAR/TAF'})}</span>`:'',
   `<span><b>${L({en:'Not an approved flight profile.',no:'Ikke en godkjent flygeprofil.'})}</b></span>`].filter(Boolean).join('');
  { const d=el('srcdata'); if(d) d.innerHTML=[`${TP&&TP.hr?L({en:'Data: under the route ≈ 450 m cells (mean height, Nordic data); corridor = highest point in ≈ 1.8 km cells. Sampled every 0.25 NM, so the line can look more detailed than the data is. No obstacles.',no:'Data: under ruten celler på ≈ 450 m (gjennomsnittshøyde, nordiske data); korridor = høyeste punkt i celler på ≈ 1,8 km. Målt hver 0,25 NM, så linjen kan se mer detaljert ut enn dataene er. Uten hindre.'}):L({en:'Data: terrain in ≈ 1.8 km cells, highest point per cell, for both lines. Sampled every 0.25 NM, so the line can look more detailed than the data is. No obstacles.',no:'Data: terreng i celler på ≈ 1,8 km, høyeste punkt per celle, for begge linjene. Målt hver 0,25 NM, så linjen kan se mer detaljert ut enn dataene er. Uten hindre.'})}`,L({en:'Published altitudes always come from the AIP and the charts.',no:'Publiserte høyder kommer alltid fra AIP og kartene.'})].join(' '); } }
let PACKDIM=false;
function pDim(){ if(PACKDIM) return [1000,420]; const pw=el('profw'), sh=el('sheet'); const cw=pw?pw.clientWidth:0; if(!cw) return [1000,420]; if(window.innerWidth<=900){ const W=Math.max(cw,430); return [Math.round(W),Math.round(W*0.7)]; } let ah=cw*0.42;
  if(sh&&sh.dataset.s!=='off'){ const bar=sh.querySelector('.sh-bar'); ah=sh.clientHeight-(bar?bar.offsetHeight:46)-(window.innerWidth<=900?70:100); if(sh.dataset.s==='full') ah=Math.min(ah,cw*0.5); }
  const W=Math.max(cw,600), sc=W/cw; return [Math.round(W),Math.round(Math.max(200,Math.min(560,ah))*sc)]; }
function drawProfile(M,tp,target){
  if(!target) setTimeout(()=>drawMini(M,tp),0);
  const sv=target||psv; sv.innerHTML=''; let [W0,H0]=target?[1000,420]:pDim(); if(!target){ sv.setAttribute('viewBox',`0 0 ${W0} ${H0}`); sv._W0=W0; sv._H0=H0; }
  const add=(tag,a,par)=>{ const e=document.createElementNS(NSV,tag); for(const k in a) e.setAttribute(k,a[k]); (par||sv).appendChild(e); return e; };
  const tx=(t,x,y,o)=>{ const e=add('text',Object.assign({x,y,'font-family':'Archivo, Arial Narrow, sans-serif','font-size':12,fill:'#13202A'},o||{})); e.textContent=t; return e; };
  const hand=(t,x,y,o)=>tx(t,x,y,Object.assign({'font-family':'Caveat, cursive','font-size':18,'font-weight':600,fill:'#1D4E9E'},o||{}));
  add('rect',{x:0,y:0,width:W0,height:H0,fill:'#FBFBF8'});
  for(let x=40;x<W0;x+=40) add('line',{x1:x,y1:0,x2:x,y2:H0,stroke:'#EEF1EF'}); for(let y=40;y<H0;y+=40) add('line',{x1:0,y1:y,x2:W0,y2:y,stroke:'#EEF1EF'});
  const pts=M.C; if(pts.length<2){ const nar=W0<900; hand(L({en:'The terrain profile appears here',no:'Terrengprofilen kommer her'}),W0/2,H0*0.38,{'text-anchor':'middle','font-size':nar?30:24,fill:'#7D8B95'}); tx(L({en:'Search an airport and press From here,',no:'Søk opp en flyplass og trykk Herfra,'}),W0/2,H0*0.38+(nar?40:30),{'text-anchor':'middle','font-size':nar?19:13.5,fill:'#4C5B66'}); tx(L({en:'then another and press To here.',no:'så en til og trykk Hit.'}),W0/2,H0*0.38+(nar?66:48),{'text-anchor':'middle','font-size':nar?19:13.5,fill:'#4C5B66'}); return; }
  const XD=!target&&R.da&&R.da.xd?String(R.da.xd).trim():'', XA=!target&&R.da&&R.da.xa?String(R.da.xa).trim():'';
  const NW=W0-58-28, NBOTH=!!(XD&&XA), NCW=NBOTH? NW/2-12 : Math.min(NW*0.6,520);
  const NWIDE=W0>=900; const nWrap=t=>{ const cpl=Math.max(14,Math.floor((NCW-18)/6.9)); const PRE=NWIDE?'\u0001'.repeat(22):''; const words=(PRE+' '+t).trim().replace(/\s+/g,' ').split(' '); const lines=[]; let cur=''; words.forEach(wd=>{ if((cur+' '+wd).trim().length>cpl){ if(cur) lines.push(cur); cur=wd; } else cur=(cur+' '+wd).trim(); }); if(cur) lines.push(cur); if(PRE&&lines.length) lines[0]=lines[0].replace(/\u0001+ ?/,''); if(PRE&&lines[0]==='') lines.shift(); const ls=lines.slice(0,3); if(lines.length>3) ls[2]=ls[2].slice(0,cpl-1)+'…'; return ls; };
  const NL={d:XD?nWrap(XD):[],a:XA?nWrap(XA):[]}, NMX=Math.max(NL.d.length,NL.a.length), NB=NMX? (NWIDE? 26+NMX*16 : 30+NMX*16) : 0;
  if(!target&&NB){ const h0=H0; H0+=NB; sv.setAttribute('viewBox',`0 0 ${W0} ${H0}`); sv._H0=H0; const bg=sv.querySelector('rect'); if(bg) bg.setAttribute('height',H0); sv.querySelectorAll('line').forEach(l=>{ if(+l.getAttribute('y2')===h0) l.setAttribute('y2',H0); }); for(let y=Math.ceil(h0/40)*40;y<H0;y+=40) add('line',{x1:0,y1:y,x2:W0,y2:y,stroke:'#EEF1EF'}); }
  const L0=58,R0=28,T0=34+NB,B0=54, W=W0-L0-R0, H=H0-T0-B0, total=Math.max(1,M.total);
  const msa=pnum(S('msa')), frz=pnum(S('frz')), cb=pnum(S('cb')), ct=pnum(S('ct'));
  const terMax=tp?Math.max(0,...tp.pts.map(p=>p.e||0)):0;
  const PM=target?'adv':M.PM; const MK=(!target&&PM==='adv'&&R.mk)||[], WX=!target&&PM==='adv'?wxLayers(M):[];
  const VS=(!target&&R.vs)||{}; const ex=!target&&VS.ex>1?VS.ex:1;
  const top=PM==='ter'? Math.max(terMax*ex*1.12+300,800,msa||0) : Math.max(...pts.map(c=>c.tgt||0),...pts.map(c=>pnum(c.p.a)||0),msa||0,ct||0,cb||0,terMax*ex+1000,1000,...MK.map(m=>Math.max(m.a||0,m.a2||0)),...WX.map(w=>w.cb?w.base+2000:w.top));
  const flyTop=Math.max(...pts.map(c=>c.tgt||0),1000); const frzShow=frz!=null&&frz<=Math.max(top,flyTop)*1.3;
  let ymax=niceTop(Math.max(top,frzShow?frz:0));
  if(!target&&VS.mode==='man'&&pnum(VS.max)) ymax=Math.max(500,pnum(VS.max));
  if(!target&&VS.z) ymax=Math.max(500,ymax/Math.pow(1.3,VS.z));
  if(!target&&typeof pDrag!=='undefined'&&pDrag&&pDrag.ymax) ymax=pDrag.ymax;
  sv._ymax=ymax;
  const iafC=pts.find(c=>c.p.t==='iaf')||pts.find(c=>c.p.t==='faf'); const xi=iafC?iafC.x:null; const zoom=PM==='adv'&&R.zoom!==false&&xi&&(total-xi)/total<0.3&&xi>0;
  const XS=v=> zoom? (v<=xi? L0+v/xi*W*0.62 : L0+W*0.62+(v-xi)/(total-xi)*W*0.38) : L0+v/total*W, YS=a=>T0+H-(Math.min(Math.max(0,a),ymax*1.06)/ymax)*H, YT=e=>YS((e||0)*ex);
  const XI=px=>{ if(zoom){ const k=(px-L0)/W; return k<=0.62? k/0.62*xi : xi+(k-0.62)/0.38*(total-xi); } return (px-L0)/W*total; };
  if(!target){ const pz=el('pzoom'); if(pz) pz.style.top=NB? `calc(${(T0/H0*100).toFixed(2)}% + 2px)` : ''; }
  sv._XI=XI; sv._XS=XS; sv._YS=YS; sv._YI=py=>(T0+H-py)/H*ymax; sv._box=[L0,T0,W,H];
  // akser (diskret)
  const step=axStep(ymax), TA=taOf(); for(let a=step;a<=ymax+1;a+=step){ const fl=a>TA; tx(fl?'FL'+String(Math.round(a/100)).padStart(3,'0'):fx(a),L0-8,YS(a)+4,{'text-anchor':'end','font-size':10,fill:fl?'#7A1652':'#9AA6AC','font-family':'IBM Plex Mono, monospace'}); add('line',{x1:L0,y1:YS(a),x2:W0-R0,y2:YS(a),stroke:'#E3E8EA','stroke-dasharray':'2 6'}); }
  tx(L({en:'ft AMSL',no:'ft AMSL'}),4,T0-14,{'font-size':9.5,fill:'#9AA6AC','font-family':'IBM Plex Mono, monospace'});
  if(ymax>TA){ add('line',{x1:L0,y1:YS(TA),x2:W0-R0,y2:YS(TA),stroke:'#7A1652','stroke-dasharray':'1 4',opacity:.6}); tx('TA '+fx(TA)+' · '+L({en:'above: flight levels (1013 hPa)',no:'over: flygenivå (1013 hPa)'}),W0-R0-4,YS(TA)-4,{'text-anchor':'end','font-size':9.5,fill:'#7A1652','font-family':'IBM Plex Mono, monospace'}); }
  if(ex>1) tx(L({en:'terrain ×',no:'terreng ×'})+ex+' '+L({en:'(exaggerated, not to scale with the path)',no:'(overdrevet, ikke i skala med banen)'}),L0+6,T0+H-6,{'font-size':10,fill:'#8A6D3B','font-family':'IBM Plex Mono, monospace'});
  const tick=(d,lab)=>tx(lab,XS(d),T0+H+16,{'text-anchor':'middle','font-size':10,fill:'#9AA6AC','font-family':'IBM Plex Mono, monospace'});
  if(zoom){ const s1=xi>150?50:xi>60?20:xi>25?10:5; for(let d=0;d<=xi-s1*0.4;d+=s1) tick(d,d+' NM'); const r=total-xi, s2=r>12?5:2; for(let d=s2;d<=r+0.01;d+=s2) tick(xi+d,'+'+d); hand(L({en:'approach, enlarged',no:'innflyging, forstørret'}),XS(xi)+8,T0+H+40,{'font-size':16,fill:'#9A1E68'}); add('line',{x1:XS(xi),y1:T0,x2:XS(xi),y2:T0+H,stroke:'#9A1E68','stroke-dasharray':'2 5',opacity:.35}); }
  else { const s=total>300?100:total>150?50:total>60?20:total>25?10:5; for(let d=0;d<=total+0.01;d+=s) tick(d,d+' NM'); }
  // skyer: bølgete topp
  if(cb!=null&&ct!=null&&ct>cb){ const y0=YS(cb), y1=YS(ct); let d=`M${L0} ${y0} L${L0} ${y1+6}`; const n=Math.max(6,Math.round(W/70)), w=W/n; for(let i=0;i<n;i++){ const x=L0+i*w; d+=` q${w*0.25} ${-14-(i%3)*4} ${w*0.5} ${-2} q${w*0.25} ${-10-(i%2)*5} ${w*0.5} ${2}`; } d+=` L${L0+W} ${y0} Z`; add('path',{d,fill:'#E3EAEE',stroke:'#C6D0D3',opacity:.9}); hand(L({en:'cloud',no:'skyer'})+` ${cb}–${ct}`,L0+W-6,y0-6,{'text-anchor':'end','font-size':16,fill:'#4C5B66'}); }
  // frysenivå
  if(PM==='adv'&&frz!=null&&frz<ymax&&frzShow){ add('line',{x1:0,y1:YS(frz),x2:W0,y2:YS(frz),stroke:'#1E5E9E','stroke-dasharray':'3 5'}); tx('0 °C',L0+130,YS(frz)-6,{'font-size':10.5,fill:'#1E5E9E'}); }
  // modellskyer og isingsfare (GFS) langs ruten, når prognosen er hentet
  if(PM!=='ter'&&WA.res&&!target){ const t=WA.res.time, tot=total; const n=Math.max(8,Math.min(60,Math.round(W/22))), dx=tot/n; let any=0, anyI=0;
    for(let i=0;i<n;i++){ const x=(i+0.5)*dx, q=M.posAt(x); if(!q||q.la==null) continue; const col=BBWIND.column(q.la,q.lo,t); if(!col) continue;
      for(let k=0;k<col.length;k++){ const c=col[k], wx=BBWIND.wxOf(c); if(!wx.cloud) continue; const lo=k?(col[k-1].z+c.z)/2:c.z-1500, hi=k<col.length-1?(c.z+col[k+1].z)/2:c.z+1500; if(lo>ymax) continue;
        const xa=XS(i*dx), xb=XS((i+1)*dx), ya=YS(Math.min(hi,ymax*1.06)), yb=YS(Math.max(0,lo)); any=1;
        add('rect',{x:xa,y:ya,width:Math.max(1,xb-xa),height:Math.max(1,yb-ya),fill:wx.cloud===2?'rgba(110,125,138,.30)':'rgba(110,125,138,.14)'});
        if(wx.ice){ anyI=1; add('rect',{x:xa,y:ya,width:Math.max(1,xb-xa),height:Math.max(1,yb-ya),fill:wx.ice===2?'rgba(29,99,184,.30)':'rgba(29,99,184,.14)'}); } } }
    let anyT=0; for(let i=0;i<n;i++){ const x=(i+0.5)*dx, q=M.posAt(x); if(!q||q.la==null) continue; const tb=BBWIND.turb(q.la,q.lo,t); if(!tb) continue;
      tb.forEach(l=>{ if(l.cat<1||l.zlo>ymax) return; anyT=1; const xa=XS(i*dx), xb=XS((i+1)*dx), ya=YS(Math.min(l.zhi,ymax*1.06)), yb=YS(Math.max(0,l.zlo));
        add('rect',{x:xa,y:ya,width:Math.max(1,xb-xa),height:Math.max(1,yb-ya),fill:'none',stroke:l.cat>=2?'rgba(199,119,0,.75)':'rgba(199,119,0,.35)','stroke-width':l.cat>=3?2.4:1.2,'stroke-dasharray':'2 3'}); }); }
    { const fp=[]; for(let i=0;i<=n;i++){ const x=i*dx, q=M.posAt(Math.min(tot,x)); if(!q||q.la==null) continue; const f=BBWIND.freezing(q.la,q.lo,t,0); if(f&&f.ft<ymax*1.06) fp.push([XS(Math.min(tot,x)),YS(f.ft)]); else if(fp.length&&fp[fp.length-1]) fp.push(null); }
      const segs=[]; let cur=[]; fp.forEach(p=>{ if(!p){ if(cur.length>1) segs.push(cur); cur=[]; return; } cur.push(p[0].toFixed(1)+' '+p[1].toFixed(1)); }); if(cur.length>1) segs.push(cur);
      if(segs.length){ add('path',{d:segs.map(g=>'M'+g.join(' L')).join(' '),fill:'none',stroke:'#1D63B8','stroke-width':1.8,'stroke-dasharray':'6 4','stroke-linejoin':'round'});
        const g0=segs[0][0].split(' '); tx('0 °C '+L({en:'forecast',no:'prognose'}),+g0[0]+6,+g0[1]-6,{'font-size':10.5,fill:'#1D63B8',stroke:'#FBFBF8','stroke-width':3,'paint-order':'stroke','font-family':'IBM Plex Mono, monospace'}); } }
    if(any||anyT) tx([any?L({en:'grey: model cloud',no:'grått: modellskyer'}):'',anyI?L({en:'blue: icing risk',no:'blått: isingsfare'}):'',anyT?L({en:'orange dashes: turbulence index',no:'oransje striper: turbulensindeks'}):''].filter(Boolean).join(' · ')+' (GFS)',L0+6,T0+H-6,{'text-anchor':'start','font-size':10.5,fill:'#4C5B66',stroke:'#fff','stroke-width':3,'paint-order':'stroke'}); }
  // fløyet spor (GPX) mot planen: punkter mer enn 5 NM fra ruten bryter linjen
  if(TRK&&!target&&PM!=='ter'){ const A=trkAlong(M); if(A){ const segs=[]; let cur=[]; A.pts.forEach(p=>{ if(p.ft==null||p.off>5){ if(cur.length>1) segs.push(cur); cur=[]; return; } cur.push(XS(Math.min(total,p.x)).toFixed(1)+' '+YS(p.ft).toFixed(1)); }); if(cur.length>1) segs.push(cur);
    if(segs.length){ add('path',{d:segs.map(g=>'M'+g.join(' L')).join(' '),fill:'none',stroke:'#D35400','stroke-width':2,'stroke-linejoin':'round',opacity:.9}); tx(L({en:'flown (GPS)',no:'fløyet (GPS)'}),L0+W-6,T0+H-6,{'text-anchor':'end','font-size':10.5,fill:'#D35400',stroke:'#fff','stroke-width':3,'paint-order':'stroke'}); } } }
  // vær fra METAR/TAF
  WX.forEach(w=>{ const xa=XS(Math.max(0,w.x-w.r)), xb=XS(Math.min(total,w.x+w.r)); if(xb-xa<8) return; const y0=YS(w.base), y1=YS(w.top);
    if(w.cb){ const cx=(xa+xb)/2, yt=YS(Math.min(w.top,ymax*0.97)); if(w.top>ymax) tx('▲ '+L({en:'tops above',no:'topper over'})+' '+altTxt(w.top),cx,T0+12,{'text-anchor':'middle','font-size':10,fill:'#B3261E','font-family':'IBM Plex Mono, monospace'}); add('path',{d:`M${xa} ${y0} Q${xa} ${yt+40} ${cx-30} ${yt+18} Q${cx-60} ${yt} ${cx} ${yt} Q${cx+60} ${yt} ${cx+30} ${yt+18} Q${xb} ${yt+40} ${xb} ${y0} Z`,fill:'#D5DDE3',stroke:'#7D8E99',opacity:.95}); hand(w.ty,cx,yt+34,{'text-anchor':'middle','font-size':16,fill:'#B3261E'}); }
    else { const n=Math.max(2,Math.round((xb-xa)/38)), wd=(xb-xa)/n, cov=w.cov; let d=''; for(let i=0;i<n;i++){ if(cov<=2&&i%2) continue; if(cov===1&&i%4) continue; const a=xa+i*wd, b=a+wd; d+=`M${a} ${y0} L${a} ${y1+5} q${wd*0.25} -10 ${wd*0.5} -1 q${wd*0.25} -8 ${wd*0.5} 1 L${b} ${y0} Z `; }
      if(d) add('path',{d,fill:'#E3EAEE',stroke:'#C6D0D3',opacity:.92}); }
    hand(`${w.st} ${w.txt}`,(xa+xb)/2,y0+16,{'text-anchor':'middle','font-size':15,fill:'#4C5B66'}); });
  // SIGMET/AIRMET langs ruten: utstrekning langs ruten × nivåene i meldingen
  if(!target&&ML&&LY.sig){ let SH=null; try{ SH=sigHits(M); }catch(e){} (SH||[]).forEach((h,k)=>{ const sg=h.s, col=(RXMAP.SIGC&&RXMAP.SIGC[sg.cat])||'#3A4650', lo=Math.max(0,sg.base||0), hi=sg.top==null?ymax*1.06:Math.min(sg.top,ymax*1.06); if(lo>=ymax) return;
    h.iv.forEach(v=>{ const xa=XS(v[0]), xb=XS(v[1]); if(xb-xa<2) return; const ya=YS(hi), yb=YS(lo);
      add('rect',{x:xa,y:ya,width:xb-xa,height:Math.max(1,yb-ya),fill:col,'fill-opacity':sg.type==='AIRMET'?.06:.10,stroke:col,'stroke-opacity':.7,'stroke-width':1.2,'stroke-dasharray':sg.type==='AIRMET'?'2 3':'6 3'});
      if(xb-xa>60) tx(`${sg.type||'SIGMET'} · ${sigLabel(sg)}${sigLevels(sg)?' · '+sigLevels(sg):''}`,xa+5,Math.max(T0+11,ya+12)+(k%3)*12,{'font-size':10,fill:col,stroke:'#FBFBF8','stroke-width':3,'paint-order':'stroke','font-family':'IBM Plex Mono, monospace'}); }); }); }
  // luftrom (openAIP) bak terrenget
  const ASD=!target?asDraw(M,tp,{add,XS,YS,T0,H,W0,L0,R0,ymax,PM}):null;
  // terreng
  const ZN=zones(M);
  const NOTER=!!(R&&R.noTer)&&PM!=='ter';
  if(NOTER){}
  else if(tp&&tp.pts.some(p=>p.e!=null)){ const area=k=>{ let d='M'+XS(0)+' '+(T0+H); tp.pts.forEach(p=>{ d+=' L'+XS(p.x).toFixed(1)+' '+YT(p[k]!=null?p[k]:p.e).toFixed(1); }); return d+' L'+XS(tp.pts[tp.pts.length-1].x)+' '+(T0+H)+' Z'; };
    add('path',{d:area('c'),fill:'#E2D8C3',stroke:'#9C7646','stroke-width':1,'stroke-linejoin':'round'}); }
  else { const ter=pts.filter(c=>pnum(c.p.ter)!=null); ter.forEach(c=>{ const x0=c.i?XS(pts[c.i-1].x):XS(0); add('rect',{x:x0,y:YS(pnum(c.p.ter)),width:Math.max(1,XS(c.x)-x0),height:YS(0)-YS(pnum(c.p.ter)),fill:'#E9E4D8',stroke:'#B08A5A'}); }); }
  add('line',{x1:0,y1:T0+H,x2:W0,y2:T0+H,stroke:'#13202A','stroke-width':1});
  if(ASD) ASD.after();
  if(!target&&(PM==='adv'||XD||XA)){ if(!sv.querySelector('#zpat')){ const dfs=add('defs',{}); const pt=add('pattern',{id:'zpat',width:8,height:8,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'},dfs); add('rect',{width:8,height:8,fill:'#EEF1F3'},pt); add('line',{x1:0,y1:0,x2:0,y2:8,stroke:'#D5DCE0','stroke-width':3},pt); }
    const zr=(x0,x1,t1,t2,anchor)=>{ if(x1-x0<0.05) return; const a=XS(x0), b=XS(x1); add('rect',{x:a,y:T0,width:b-a,height:H,fill:'url(#zpat)',opacity:.55}); add('line',{x1:anchor==='start'?b:a,y1:T0,x2:anchor==='start'?b:a,y2:T0+H,stroke:'#7D8B95','stroke-dasharray':'4 4'}); const tx0=anchor==='start'?a+6:b-6; const dy=(!target&&anchor==='end')?30:0;
      tx(t1,tx0,T0+14+dy,{'text-anchor':anchor,'font-size':11,'font-weight':700,fill:'#4C5B66'}); if(t2) tx(t2,tx0,T0+28+dy,{'text-anchor':anchor,'font-size':10,fill:'#4C5B66'}); };
    if(PM==='adv'||XD) zr(0,ZN.d,L({en:'Departure area',no:'Avgangsområde'}),XD?'':L({en:'fly the SID or a visual departure',no:'fly SID eller visuell avgang'}),'start');
    if(PM==='adv'||XA) zr(ZN.a,ZN.arrEnd,L({en:'Approach area',no:'Innflygingsområde'}),XA?'':ZN.ia?L({en:'your approach from the IAF',no:'din innflyging fra IAF'}):L({en:'fly the published or a visual approach',no:'fly publisert eller visuell innflyging'}),'end'); }
  if(msa!=null){ add('line',{x1:L0,y1:YS(msa),x2:W0-R0,y2:YS(msa),stroke:'#9A1E68','stroke-dasharray':'8 4',opacity:.7}); tx('MSA '+msa,L0+8,YS(msa)-6,{'font-size':10.5,fill:'#9A1E68','font-weight':600}); }
  // bane med runde hjørner
  const sp=M.path.map(p=>[XS(p[0]),YS(p[1])]).filter((p,i,a)=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>0.5);
  let d='M'+sp[0][0]+' '+sp[0][1]; for(let i=1;i<sp.length;i++){ const p=sp[i]; if(i<sp.length-1){ const q=sp[i-1], n=sp[i+1]; const l1=Math.hypot(p[0]-q[0],p[1]-q[1]), l2=Math.hypot(n[0]-p[0],n[1]-p[1]); const r=Math.min(18,l1/2,l2/2); const a=[p[0]-(p[0]-q[0])/l1*r,p[1]-(p[1]-q[1])/l1*r], b=[p[0]+(n[0]-p[0])/l2*r,p[1]+(n[1]-p[1])/l2*r]; d+=` L${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`; } else d+=` L${p[0]} ${p[1]}`; }
  const ghost=!target&&R.ghost===false&&PM==='adv'; const noPath=PM==='ter';
  if(noPath){}
  else if(!target&&!ghost&&PM==='adv'&&(ZN.d>0||ZN.a<total)){ const dfs=add('defs',{}); const cE=add('clipPath',{id:'cpE'},dfs), cZ=add('clipPath',{id:'cpZ'},dfs); add('rect',{x:XS(ZN.d),y:0,width:Math.max(0,XS(ZN.a)-XS(ZN.d)),height:H0},cE); add('rect',{x:0,y:0,width:XS(ZN.d),height:H0},cZ); add('rect',{x:XS(ZN.a),y:0,width:W0-XS(ZN.a),height:H0},cZ);
    add('path',{d,fill:'none',stroke:'#9A1E68','stroke-width':3.2,'stroke-linecap':'round','stroke-linejoin':'round',class:'fpath','clip-path':'url(#cpE)'});
    add('path',{d,fill:'none',stroke:'#9A1E68','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':'6 5',opacity:.75,'clip-path':'url(#cpZ)'}); }
  else add('path',{d,fill:'none',stroke:'#9A1E68','stroke-width':ghost?1.4:3.2,'stroke-linecap':'round','stroke-linejoin':'round',class:'fpath',opacity:ghost?.3:1,'stroke-dasharray':ghost?'4 5':''});
  const hitD=d;
  let dM=''; let lastDA=null; pts.forEach((c,i)=>{ if(c.p.t==='da') lastDA=c; if((c.p.t==='missed'||c.p.t==='alt')&&i){ const s0=c.p.t==='missed'&&lastDA?lastDA:pts[i-1]; const x0=XS(s0.x), y0=YS(s0.tgt), x1=XS(c.x), y1=YS(c.tgt); dM+=`M${x0} ${y0} Q${(x0+x1)/2} ${y0-(y0-y1)*0.9} ${x1} ${y1} `; } });
  if(dM&&!noPath){ add('path',{d:dM,fill:'none',stroke:'#9A1E68','stroke-width':2.2,'stroke-dasharray':'7 5','stroke-linecap':'round'}); }
  // terrengkonflikt
  if(tp&&!noPath) tp.pts.forEach(q=>{ if(isHit(M,q)) add('circle',{cx:XS(q.x),cy:YS(M.altAt(q.x)),r:2.6,fill:'#B3261E'}); else if(isLow(M,q)) add('circle',{cx:XS(q.x),cy:YS(M.altAt(q.x)),r:2,fill:'#C77700'}); });
  // fly i marsj
  let planeXY=null;
  const lv=[]; for(let i=1;i<M.path.length;i++){ const [x0,a0]=M.path[i-1],[x1,a1]=M.path[i]; if(Math.abs(a1-a0)<1&&x1-x0>0) lv.push([x0,x1,a0]); }
  const best=lv.sort((a,b)=>(XS(b[1])-XS(b[0]))-(XS(a[1])-XS(a[0])))[0];
  if(!noPath&&best&&XS(best[1])-XS(best[0])>110){ const ob=pts.map(c=>XS(c.x)); if(!target){ const cr0=crit(M); if(cr0) ob.push(XS(cr0.x)); } const a0=XS(best[0])+48, a1=XS(best[1])-48, mid=(a0+a1)/2; let gx=mid, sc=-1e9; for(let x=a0;x<=a1;x+=6){ const d=Math.min(...ob.map(o=>Math.abs(o-x)),999); const v=Math.min(d,90)-Math.abs(x-mid)*0.05; if(v>sc){ sc=v; gx=x; } } const gy=YS(best[2]); if(sc>=58){ const g=add('g',{transform:`translate(${gx} ${gy-1}) scale(0.85)`}); planeXY=[gx,gy];
    add('path',{d:'M-34 0 C-30 -6 -10 -8 8 -6 L26 -4 C30 -3 33 -1 34 0 C33 2 28 3 22 3 L-20 3 C-28 3 -33 2 -34 0Z',fill:'#13202A'},g); add('path',{d:'M-30 -1 L-36 -16 L-30 -16 L-24 -3Z',fill:'#13202A'},g); add('path',{d:'M-42 -16 L-24 -16',stroke:'#13202A','stroke-width':2.4},g);
    add('path',{d:'M-6 1 L18 1',stroke:'#4C5B66','stroke-width':3},g); add('rect',{x:6,y:-1,width:14,height:6,rx:3,fill:'#13202A'},g); add('line',{x1:21,y1:-6,x2:21,y2:10,stroke:'#4C5B66','stroke-width':1.2},g);
    hand(altTxt(best[2]),gx,gy-16,{'text-anchor':'middle','font-size':19}); } }
  const hasMk=t=>MK.some(m=>m.t===t);
  if(M.toc&&!hasMk('toc')&&!ghost){ add('circle',{cx:XS(M.toc.x),cy:YS(M.toc.a),r:3.5,fill:'#FBFBF8',stroke:'#9A1E68','stroke-width':1.6}); hand('TOC',XS(M.toc.x)-4,YS(M.toc.a)-10,{'text-anchor':'end','font-size':16,fill:'#9A1E68'}); }
  if(M.tod&&!hasMk('tod')&&!ghost){ add('circle',{cx:XS(M.tod.x),cy:YS(M.tod.a),r:3.5,fill:'#FBFBF8',stroke:'#9A1E68','stroke-width':1.6}); hand('TOD',XS(M.tod.x)+6,YS(M.tod.a)-10,{'font-size':16,fill:'#9A1E68'}); }
  // punkter
  let lastLx=-99, lvl=0;
  pts.forEach((c,i)=>{ const p=c.p, x=XS(c.x), y=YS(c.tgt);
    if(noPath&&p.t!=='rwy'){ if(p.t==='missed'||p.t==='alt') return; add('line',{x1:x,y1:T0+18,x2:x,y2:T0+H,stroke:'#13202A','stroke-dasharray':'2 4',opacity:.35}); lvl=(x-lastLx<60)?(lvl+1)%2:0; lastLx=x; tx(p.n||'',x,T0+12+lvl*12,{'text-anchor':'middle','font-weight':700,'font-size':11.5}); if(!target&&i===selI) add('circle',{cx:x,cy:T0+H,r:8,fill:'none',stroke:'#9A1E68','stroke-width':2}); return; }
    if(p.t==='rwy'){ add('rect',{x:x-26,y:T0+H-2,width:52,height:4,fill:'#13202A'}); if(i===0){ add('rect',{x:x-40,y:T0+H-26,width:7,height:24,fill:'#13202A'}); add('rect',{x:x-43,y:T0+H-32,width:13,height:7,fill:'#4C5B66'}); } }
    else if(p.t==='faf') add('path',{d:`M${x} ${y-7} L${x+7} ${y} L${x} ${y+7} L${x-7} ${y} Z`,fill:'#13202A'});
    else if(p.t==='hold') add('ellipse',{cx:x,cy:y-16,rx:22,ry:8,fill:'none',stroke:'#13202A','stroke-width':1.5});
    else if(p.t==='da') add('line',{x1:x-12,y1:y,x2:x+12,y2:y,stroke:'#B3261E','stroke-width':2.4});
    else if(p.t!=='missed'&&p.t!=='alt') add('path',{d:`M${x} ${y-6.5} L${x+6} ${y+4} L${x-6} ${y+4} Z`,fill:i===selI?'#F3D9E7':'#FBFBF8',stroke:'#13202A','stroke-width':1.6});
    else add('circle',{cx:x,cy:y,r:4,fill:'#FBFBF8',stroke:'#9A1E68','stroke-width':1.6});
    if(!target&&i===selI) add('circle',{cx:x,cy:p.t==='rwy'?T0+H:y,r:11,fill:'none',stroke:'#9A1E68','stroke-width':2,opacity:.8});
    lvl=(x-lastLx<70)?(lvl+1)%3:0; lastLx=x;
    if(p.t==='rwy'){ tx(p.n||'',x,T0+H+32,{'text-anchor':'middle','font-weight':700,'font-size':12.5}); hand(Math.round(c.tgt)+' ft',i===0?x+30:x,T0+H-10,{'text-anchor':i===0?'start':'middle','font-size':15,fill:'#4C5B66'}); return; }
    if(p.t==='da'){ tx(p.n||'',x-16,y+4,{'text-anchor':'end','font-weight':700,'font-size':11.5,fill:'#B3261E'}); return; }
    const ny=y-14-lvl*14-(p.t==='hold'?24:0);
    tx(p.n||'',x,ny,{'text-anchor':'middle','font-weight':700,'font-size':12});
    if(p.t!=='hold'&&!(planeXY&&best&&Math.abs(c.tgt-best[2])<1)) hand(altTxt(c.tgt),x,y+21+lvl*13,{'text-anchor':'middle','font-size':16});
    if(p.note&&!/^(VOR|NDB|DME|TACAN|VORTAC)/.test(p.note)) hand(p.note,x,y+37+lvl*13,{'text-anchor':'middle','font-size':15,fill:'#4C5B66'});
    if(c.steep) hand('steep! '+c.steep+' ft/NM',x,y+52+lvl*13,{'text-anchor':'middle','font-size':15,fill:'#B3261E'});
    if(c.short) hand('can’t make it: '+c.short+' ft/NM',x,y+52+lvl*13,{'text-anchor':'middle','font-size':15,fill:'#B3261E'}); });
  if(!target) add('rect',{x:L0,y:T0,width:W,height:H,fill:'transparent',class:'fhit phit',style:'cursor:copy'});
  if(!noPath) add('path',{d:hitD,fill:'none',stroke:'transparent','stroke-width':18,class:'fhit',style:'cursor:copy','pointer-events':'stroke'});
  // dine notater for forventet avgang og ankomst, inne i områdene
  if(NB){ const box=(ls,head,anchor,xid,zx)=>{ const w2=NCW, x0=anchor==='start'?L0:W0-R0-w2, y0=6, h=NB-12;
      if(zx!=null){ const lx=Math.min(Math.max(zx,x0+14),x0+w2-14); add('line',{x1:lx,y1:y0+h,x2:lx,y2:T0,stroke:'#9A1E68','stroke-dasharray':'2 3',opacity:.6}); }
      const gb=add('g',{class:'xnbox','data-x':xid}); add('rect',{x:x0,y:y0,width:w2,height:h,rx:5,fill:'#fff',stroke:'#9A1E68','stroke-width':1.1},gb); add('rect',{x:x0,y:y0,width:4,height:h,rx:2,fill:'#9A1E68'},gb);
      const t1=tx(head,x0+12,y0+(NWIDE?17:15),{'font-size':10,'font-weight':700,fill:'#9A1E68','letter-spacing':'.06em'}); const hw=NWIDE?head.length*7.2+22:0; const tl=ls.map((l,k)=>tx(l,x0+12+(k===0?hw:0),y0+(NWIDE?17:31)+k*16,{'font-size':12.5,fill:'#13202A'})); [t1,...tl].forEach(n=>n&&gb.appendChild(n)); };
    if(XD) box(NL.d,L({en:'EXPECTED DEPARTURE',no:'FORVENTET AVGANG'}),'start','xdep',ZN.d>0.05?XS(ZN.d/2):XS(0)+14);
    if(XA) box(NL.a,L({en:'EXPECTED ARRIVAL',no:'FORVENTET ANKOMST'}),'end','xarr',XS((ZN.a+ZN.arrEnd)/2)); }
  if(ASD) ASD.labels();
  if(!target&&PM==='adv') drawMarkers(M,MK,{add,tx,hand,XS,YS,T0,H});
  if(!target&&planeXY) add('rect',{x:planeXY[0]-40,y:planeXY[1]-24,width:80,height:32,fill:'transparent',class:'crdrag'});
  if(!target){ const cr=crit(M); if(cr){ const x=XS(cr.x); if(cr.m==null){ const y=YT(cr.t); add('path',{d:`M${x} ${y-4} l-6 -10 h12 z`,fill:'#13202A','pointer-events':'none'}); tx(fx(Math.round(cr.t))+' ft',x,y-18,{'text-anchor':'middle','font-size':11,'font-weight':700,fill:'#13202A','font-family':'IBM Plex Mono, monospace','pointer-events':'none'}); }
      else { const ya=YS(M.altAt(cr.x)), yt=YT(cr.t), col=cr.m<0?'#B3261E':cr.m<(+S('mg')||1000)?'#B86E00':'#13202A'; add('line',{x1:x,y1:ya,x2:x,y2:yt,stroke:col,'stroke-width':1.4,'pointer-events':'none'}); [ya,yt].forEach(y=>add('line',{x1:x-5,y1:y,x2:x+5,y2:y,stroke:col,'stroke-width':1.4,'pointer-events':'none'})); const lx=x+(x>W0-R0-120?-8:8); tx((cr.m<0?'−':'')+fx(Math.abs(Math.round(cr.m/10)*10))+' ft',lx,(ya+yt)/2+4,{'text-anchor':x>W0-R0-120?'end':'start','font-size':11,'font-weight':700,fill:col,'font-family':'IBM Plex Mono, monospace','paint-order':'stroke',stroke:'#FBFBF8','stroke-width':3,'pointer-events':'none'}); } } }
  if(!target){ if(PM==='adv') pts.forEach((c,i)=>{ if(['rwy','missed','alt'].includes(c.p.t)) return; add('circle',{cx:XS(c.x),cy:YS(c.tgt),r:12,fill:'transparent',class:'pdrag','data-pi':i}); });
    const hc=add('line',{x1:0,y1:T0,x2:0,y2:T0+H,stroke:'#1D4E9E','stroke-width':1.2,'stroke-dasharray':'3 3',id:'hcur',visibility:'hidden','pointer-events':'none'}); const ht=add('text',{x:0,y:T0-4,'font-family':'IBM Plex Mono, monospace','font-size':10.5,fill:'#1D4E9E','text-anchor':'middle',id:'hcurt',visibility:'hidden','pointer-events':'none'}); if(HOV!=null) setHov(HOV,true); }
  if(!target&&PM==='adv'&&!NB&&window.innerWidth>900) hand(L({en:'pick a marker above, then click the profile',no:'velg en markør over, og klikk på profilen'}),W0-R0-150,22,{'text-anchor':'end','font-size':15,fill:'#9AA6AC',class:'noprint'});
  else if(target) hand(L({en:'click the line to add a fix',no:'klikk på linjen for å legge til en fix'}),W0-R0,22,{'text-anchor':'end','font-size':15,fill:'#9AA6AC',class:'noprint'});
  if(!target){ try{ if(HOV==null) rdo(null); const c=crit(M), key=c?[c.x,Math.round(c.t),c.m!=null?Math.round(c.m):''].join('|'):''; if(key!==drawProfile._ck){ drawProfile._ck=key; if(typeof drawMap==='function') requestAnimationFrame(()=>drawMap()); } }catch(e){} }
}
function zones(M){ const T=M.total||0, dz=Math.min(+S('tz')||10,T*0.35); const dep=M.C.length&&M.C[0].p.t==='rwy'?dz:0; const last=[...M.C].reverse().find(c=>c.p.t==='rwy'&&c.i>0); const ia=M.C.find(c=>c.p.t==='iaf'||c.app);
  const arr= ia? Math.max(dep,ia.x) : last? Math.max(dep,last.x-dz) : T; return {d:dep,a:arr,ia:!!ia,arrEnd:last?last.x:T,dn:M.C[0]&&M.C[0].p.n||'',an:last?last.p.n||'':''}; }
function enr(M,x){ if(M.PM!=='adv') return x>1.5&&x<M.total-1.5; const z=zones(M); return x>z.d+1e-6&&x<z.a-1e-6; }
function isHit(M,q){ return q.e!=null&&enr(M,q.x)&&M.altAt(q.x)<q.e; }
function isLow(M,q){ const mg=+S('mg')||1000; return q.e!=null&&enr(M,q.x)&&!isHit(M,q)&&M.altAt(q.x)<q.e+mg; }
function zoneTer(M){ const z=zones(M); const r={d:false,a:false}; if(!TP||M.PM!=='adv') return r; TP.pts.forEach(q=>{ const t=q.c!=null?q.c:q.e; if(t==null) return; if(M.altAt(q.x)<t-50){ if(q.x<=z.d&&q.x>1.5) r.d=true; else if(q.x>=z.a&&q.x<z.arrEnd-1.5) r.a=true; } }); return r; }


/* ---------- kart og profil sammen ---------- */
let HOV=null, pDrag=null;
// the readout under the profile follows the pointer at most every 80 ms (the last position always lands)
let rdoT=0, rdoQ=0; function rdoSoon(x){ const now=performance.now(); clearTimeout(rdoQ); if(now-rdoT>80){ rdoT=now; rdo(x); } else rdoQ=setTimeout(()=>{ rdoT=performance.now(); rdo(HOV); },80-(now-rdoT)); }
function setHov(x,fromMap){ HOV=x; rdoSoon(x); try{ if(T3.on) kick3(); }catch(e){} const l=el('hcur'), t=el('hcurt'); if(!l) return; if(x==null||!psv._XS){ l.setAttribute('visibility','hidden'); t.setAttribute('visibility','hidden'); if(!fromMap) hovDraw(); return; }
  const px=psv._XS(x); l.setAttribute('x1',px); l.setAttribute('x2',px); l.setAttribute('visibility','visible'); t.setAttribute('x',Math.max(40,Math.min(960,px))); t.textContent=''; t.setAttribute('visibility','hidden'); if(!fromMap) hovDraw(); }
function hovInfo(x){ const M=compute(); if(x==null||M.C.length<2) return ''; let pi=0; M.C.forEach((c,i)=>{ if(c.x<=x+1e-6&&!['missed','alt'].includes(c.p.t)) pi=i; }); const pc=M.C[pi], nc=M.C.find(c=>c.x>x+1e-6&&!['missed','alt'].includes(c.p.t));
  const near=[pc,nc].filter(Boolean).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0]; const at= Math.abs(near.x-x)<0.6? `${L({en:'at',no:'ved'})} <b>${esc(near.p.n||'')}</b>` : `<b>${fx(x-pc.x,1)} NM</b> ${L({en:'after',no:'etter'})} <b>${esc(pc.p.n||'')}</b>`;
  let q=null,bd=1e9; if(TP) TP.pts.forEach(p=>{ const d=Math.abs(p.x-x); if(d<bd){ bd=d; q=p; } }); const tc=q&&(q.c!=null?q.c:q.e), te=q&&q.e; const alt=M.PM==='ter'?null:M.altAt(x);
  let crs=''; if(nc&&pc.p.la!=null&&nc.p.la!=null){ const t=brg(pc.p,nc.p), v=magVar(pc.p,nc.p); crs=`<span>TT <b>${String(Math.round(t)).padStart(3,'0')}°</b>${v!=null?` · MC <b>${mcOf(t,v)}°</b> <small>(VAR ${WMM.fmt(v,LAB.lang==='no')})</small>`:''}</span>`; }
  return `<span>${fx(x,1)} / ${fx(M.total,1)} NM · ${at}</span>`+crs+(tc!=null?`<span><i class="sw sw-c"></i>${L({en:'under the route',no:'under ruten'})} <b>${fx(Math.round(tc))} ft</b></span>`:'')+(te!=null?`<span>${L({en:'highest within',no:'høyeste innen'})} ±${fx(sNum('cw',4.3),1)} NM <b>${fx(Math.round(te))} ft</b></span>`:'')+(alt!=null?`<span><i class="sw sw-a"></i>${M.PM==='alt'?L({en:'your altitude',no:'din høyde'}):L({en:'path',no:'banen'})} <b>${altTxt(Math.round(alt/10)*10)}</b>${te!=null?` (${alt-te>=0?'+':''}${fx(Math.round((alt-te)/10)*10)} ft)`:''}</span>`:''); }
function crit(M){ if(!TP||!TP.pts||!M||M.C.length<2) return null; const ter=M.PM==='ter'; let b=null;
  TP.pts.forEach(q=>{ if(ter){ const t=q.c!=null?q.c:q.e; if(t==null) return; if(!b||t>b.t) b={x:q.x,t}; return; }
    const t=q.e!=null?q.e:q.c; if(t==null||!enr(M,q.x)) return; const m=M.altAt(q.x)-t; if(!b||m<b.m) b={x:q.x,t,m}; }); return b; }
function critTxt(M){ const c=crit(M); if(!c) return ''; const at=`${L({en:'at',no:'ved'})} ${fx(c.x,1)} NM`;
  if(c.m==null) return `<span class="crit">▲ ${L({en:'Highest terrain directly under the route',no:'Høyeste terreng rett under ruten'})} <b>${fx(Math.round(c.t))} ft</b> ${at}</span>`;
  const mg=+S('mg')||1000, cls=c.m<0?'bad':c.m<mg?'warn':'';
  const head=c.m<0? L({en:'Below the terrain by',no:'Under terrenget med'}) : L({en:'Smallest margin',no:'Minste margin'});
  return `<span class="crit ${cls}">↕ ${head} <b>${fx(Math.abs(Math.round(c.m/10)*10))} ft</b> ${at}</span><span>${L({en:'highest terrain within',no:'høyeste terreng innen'})} ±${fx(sNum('cw',4.3),1)} NM ${L({en:'there',no:'der'})}: <b>${fx(Math.round(c.t))} ft</b></span>`; }
function rdo(x){ const r=el('rdo'); if(!r) return; if(x==null){ const ct=critTxt(compute()); r.innerHTML= ct? ct+`<span class="hint">${L({en:'point at the profile for other places',no:'pek i profilen for andre steder'})}</span>` : `<span class="hint">${L({en:'Point at the profile or the route to read off a place.',no:'Pek i profilen eller på ruten for å lese av et sted.'})}</span>`; } else r.innerHTML=hovInfo(x); }
function terAt(x){ if(!TP) return null; let b=null,bd=1e9; TP.pts.forEach(p=>{ const d=Math.abs(p.x-x); if(d<bd){ bd=d; b=p; } }); return b&&b.e; }
function distOnRoute(mx,my){ const M=compute(); let best=null, bd=12; for(let i=1;i<M.C.length;i++){ const a=M.C[i-1], b=M.C[i]; if(a.p.la==null||b.p.la==null||['missed','alt'].includes(b.p.t)) continue; const [ax,ay]=prj(a.p.la,a.p.lo), [bx,by]=prj(b.p.la,b.p.lo); const vx=bx-ax, vy=by-ay, t=Math.max(0,Math.min(1,((mx-ax)*vx+(my-ay)*vy)/Math.max(1e-6,vx*vx+vy*vy))); const d=Math.hypot(ax+vx*t-mx,ay+vy*t-my); if(d<bd){ bd=d; best=a.x+t*(b.x-a.x); } } return best; }
psv.addEventListener('pointermove',rafT(e=>{ if(mkDrag||pDrag) return; const r=psv.getBoundingClientRect(); const vx=(e.clientX-r.left)/r.width*(psv._W0||1000); const bx=psv._box; if(!bx||vx<bx[0]||vx>bx[0]+bx[2]){ if(HOV!=null) setHov(null); return; } const M=MLK.M||compute(); if(M.C.length<2) return; setHov(Math.max(0,Math.min(M.total,psv._XI(vx)))); }),{passive:true});
psv.addEventListener('pointerleave',e=>{ if(!pDrag&&e.pointerType!=='touch') setHov(null); });
psv.addEventListener('pointerdown',e=>{ if(e.pointerType!=='touch'||e.target.closest('.pdrag,.crdrag,.mk,.xnbox')) return; const r=psv.getBoundingClientRect(); const vx=(e.clientX-r.left)/r.width*(psv._W0||1000); const M=compute(); if(M.C.length<2||!psv._XI) return; setHov(Math.max(0,Math.min(M.total,psv._XI(vx)))); });
// pointer handlers do their work at most once per frame (the latest event wins), and never while the map is moving
function rafT(f){ let ev=null, q=0; return e=>{ ev=e; if(!q) q=requestAnimationFrame(()=>{ q=0; f(ev); }); }; }
function hovDraw(){ if(ML) mlHov(); else drawMap(); }
queueMicrotask(()=>{ mapEl.addEventListener('pointermove',rafT(e=>{ if(drag||ptDrag||T3.dvOn||(ML&&(e.buttons||ML.isMoving()))) return; /* flying: the pointer is for looking around */ const r=mapEl.getBoundingClientRect(); const d=distOnRoute(e.clientX-r.left,e.clientY-r.top); if(d==null){ if(HOV!=null){ HOV=null; setHov(null,true); hovDraw(); } return; } if(d===HOV) return; setHov(d,true); hovDraw(); }),{passive:true});
mapEl.addEventListener('pointerleave',()=>{ if(HOV!=null&&!T3.dvOn){ setHov(null,true); hovDraw(); } }); });
// dra punkt eller fly vertikalt i profilen
psv.addEventListener('pointerdown',e=>{ const h=e.target.closest&&(e.target.closest('.pdrag')||e.target.closest('.crdrag')); if(!h) return; e.preventDefault(); e.stopPropagation(); psv.setPointerCapture(e.pointerId);
  pDrag={i:h.classList.contains('pdrag')?+h.dataset.pi:-1,y0:e.clientY,moved:false,ymax:psv._ymax}; },true);
psv.addEventListener('pointermove',e=>{ if(!pDrag) return; if(Math.abs(e.clientY-pDrag.y0)>3) pDrag.moved=true; if(!pDrag.moved) return; const r=psv.getBoundingClientRect(); const vy=(e.clientY-r.top)/r.height*(psv._H0||420); const a=Math.max(0,r100(psv._YI(vy)));
  if(pDrag.i>=0){ const q=R.pts[pDrag.i]; if(!('ua0' in q)) q.ua0=q.a==null?'':String(q.a); q.a=String(a); } else { if(!('crU0' in R)) R.crU0=R.s.cr||''; R.s.cr=a>taOf()?'FL'+String(Math.round(a/100)).padStart(3,'0'):String(a); el('s_cr').value=R.s.cr; }
  const M=compute(); drawProfile(M,TP); const t=el('hcurt'); if(t){ t.textContent=(pDrag.i>=0?(R.pts[pDrag.i].n||'')+' ':L({en:'cruise ',no:'marsj '}))+altTxt(a); t.setAttribute('x',e.clientX>0?Math.max(60,Math.min((psv._W0||1000)-60,(e.clientX-r.left)/r.width*(psv._W0||1000))):500); t.setAttribute('visibility','visible'); } });
psv.addEventListener('pointerup',e=>{ if(!pDrag) return; const d=pDrag; pDrag=null; justDragged=true; setTimeout(()=>justDragged=false,0); if(d.moved){ render(); queueSave(); return; } if(d.i>=0){ selI=d.i; render(); } });
// valgt punkt: redigeringslinje
function drawSelbar(){ const b=el('selbar'); if(selI<0||selI>=R.pts.length){ b.hidden=true; return; } const p=R.pts[selI], M=compute(), c=M.C[selI]; b.hidden=false;
  b.innerHTML=`<b>${L({en:'Point',no:'Punkt'})} ${selI+1}</b><input class="n" data-s="n" value="${esc(p.n||'')}" aria-label="Name"><select data-s="t">${XT.map(([k,l])=>`<option value="${k}" ${p.t===k?'selected':''}>${L({en:l,no:TNO[l]||l})}</option>`).join('')}</select>
   <label>${L({en:'Altitude',no:'Høyde'})} <input class="a" data-s="a" value="${esc(p.a||'')}" placeholder="${c?altTxt(Math.round(c.tgt)):''}"></label>
   <span class="note">${c?fx(c.x,1)+' NM':''}${p.la!=null?' · '+llTxt(p.la,p.lo):''}</span>
   <span><button data-sb="-1" aria-label="${L({en:'Earlier',no:'Tidligere'})}">←</button> <button data-sb="1" aria-label="${L({en:'Later',no:'Senere'})}">→</button> <button data-sb="map">${L({en:'Show on map',no:'Vis på kartet'})}</button> <button data-sb="del">${L({en:'Delete',no:'Slett'})}</button> <button data-sb="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button></span>
   <span class="note">${L({en:'Tip: drag the point up or down in the profile, or drag it on the map to another fix.',no:'Tips: dra punktet opp eller ned i profilen, eller dra det til en annen fix på kartet.'})}</span>`; }
el('selbar').addEventListener('input',e=>{ const k=e.target.dataset.s; if(!k||selI<0) return; R.pts[selI][k]=e.target.value; drawProfile(compute(),TP); drawMap(); drawTable(compute()); queueSave(); });
el('selbar').addEventListener('change',e=>{ const k=e.target.dataset.s; if(!k||selI<0) return; if(k==='n'){ const v=e.target.value.trim().toUpperCase(); const r=resolve(v,R.pts[selI-1]); const p=R.pts[selI]; p.n=v; if(!r.miss&&r.la!=null&&window.confirm(L({en:`Move the point to ${v}'s position?`,no:`Flytte punktet til posisjonen til ${v}?`}))){ p.la=r.la; p.lo=r.lo; if(r.note) p.note=r.note; if(r.elev!=null) p.elev=r.elev; } } render(); queueSave(); });
el('selbar').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b||selI<0) return; const v=b.dataset.sb, A=R.pts;
  if(v==='x'){ selI=-1; render(); return; } if(v==='del'){ A.splice(selI,1); selI=Math.min(selI,A.length-1); if(A===R.pts){ R.rt=''; el('rtxt').value=routeStr(); } render(); queueSave(); return; }
  if(v==='map'){ const p=A[selI]; if(p.la!=null){ V.la=p.la; V.lo=p.lo; V.z=Math.max(V.z,90); drawMap(); mapEl.scrollIntoView({behavior:'smooth',block:'nearest'}); } return; }
  const j=selI+(+v); if(j<0||j>=A.length) return; [A[selI],A[j]]=[A[j],A[selI]]; selI=j; render(); queueSave(); });
/* ---------- markører (brukerens egne, blått blekk) ---------- */
const MKN={fix:'Fix',toc:'TOC',tod:'TOD',alt:'Altitude',cr:'Restriction',lvl:'Level-off',hold:'Hold',faf:'FAF / FAP',da:'DA / MDA',note:'Note'};
const MKNO={Altitude:'Høyde',Restriction:'Restriksjon','Level-off':'Level-off',Hold:'Holding',Note:'Notat'};
const CRK={at:['At','Ved'],above:['At or above','Ved eller over'],below:['At or below','Ved eller under'],between:['Between','Mellom']};
const mkName=m=>m.s||(m.t==='da'?'DA '+(m.a!=null?Math.round(m.a):''):L({en:MKN[m.t],no:MKNO[MKN[m.t]]||MKN[m.t]}));
const r100=v=>Math.round(v/100)*100;
function mkCheck(M,m){ if(m.t!=='cr'||m.a==null) return null; const p=M.altAt(m.x); const a=m.a, b=m.a2!=null?m.a2:m.a, lo=Math.min(a,b), hi=Math.max(a,b);
  const bad= m.k==='at'? Math.abs(p-a)>100 : m.k==='above'? p<a-50 : m.k==='below'? p>a+50 : (p<lo-50||p>hi+50); return bad? Math.round(p) : null; }
function mkText(m){ if(m.t==='cr'){ const k=CRK[m.k||'above']; return L({en:k[0],no:k[1]})+' '+(m.k==='between'&&m.a2!=null? fx(Math.max(m.a,m.a2))+' / '+fx(Math.min(m.a,m.a2)) : fx(m.a)); } return m.a!=null&&m.t!=='note'? altTxt(m.a) : ''; }
function drawMarkers(M,MK,o){ const {add,tx,hand,XS,YS,T0,H}=o; const INK='#1D4E9E';
  MK.forEach((m,i)=>{ if(m.x==null) return; const x=XS(Math.max(0,Math.min(M.total,m.x))), y=YS(m.a!=null?m.a:M.altAt(m.x)); const g=add('g',{class:'mk','data-mi':i});
    add('line',{x1:x,y1:T0+H,x2:x,y2:y,stroke:INK,'stroke-dasharray':'2 4',opacity:.45},g);
    const bad=mkCheck(M,m); const col=bad!=null?'#B3261E':INK;
    if(m.t==='toc'||m.t==='tod'||m.t==='lvl'){ add('circle',{cx:x,cy:y,r:5,fill:'#FBFBF8',stroke:INK,'stroke-width':2},g); }
    else if(m.t==='alt'){ add('line',{x1:x-10,y1:y,x2:x+10,y2:y,stroke:INK,'stroke-width':2.4},g); }
    else if(m.t==='cr'){ const w=34; if(m.k!=='above') add('line',{x1:x-w/2,y1:y-12,x2:x+w/2,y2:y-12,stroke:col,'stroke-width':2},g); if(m.k!=='below') add('line',{x1:x-w/2,y1:y+(m.k==='between'?18:6),x2:x+w/2,y2:y+(m.k==='between'?18:6),stroke:col,'stroke-width':2},g); add('circle',{cx:x,cy:y,r:3,fill:col},g); }
    else if(m.t==='hold'){ add('ellipse',{cx:x,cy:y-14,rx:22,ry:8,fill:'none',stroke:INK,'stroke-width':1.8},g); }
    else if(m.t==='faf'){ add('path',{d:`M${x} ${y-8} L${x+8} ${y} L${x} ${y+8} L${x-8} ${y} Z`,fill:INK},g); }
    else if(m.t==='da'){ add('line',{x1:x-14,y1:y,x2:x+14,y2:y,stroke:'#B3261E','stroke-width':2.6},g); }
    else if(m.t==='note'){ add('circle',{cx:x,cy:y,r:3.5,fill:INK},g); }
    const lab=m.t==='cr'? (m.k==='between'&&m.a2!=null? fx(Math.max(m.a,m.a2))+'/'+fx(Math.min(m.a,m.a2)) : fx(m.a)) : m.t==='note'? (m.s||'') : (mkName(m)+(m.a!=null&&m.t!=='da'?' '+altTxt(m.a):''));
    const ly=m.t==='hold'?y-28:m.t==='cr'?y-18:y-12;
    const e=hand(lab,x+(m.t==='cr'?0:8),ly,{'font-size':17,fill:col,'text-anchor':m.t==='cr'?'middle':'start'}); g.appendChild(e);
    if(m.t==='cr'&&m.s){ const e2=hand(m.s,x,ly-16,{'font-size':15,fill:col,'text-anchor':'middle'}); g.appendChild(e2); }
    if(bad!=null){ const e3=hand(L({en:'path ',no:'banen '})+fx(bad),x,y+(m.k==='between'?36:24),{'font-size':15,fill:'#B3261E','text-anchor':'middle'}); g.appendChild(e3); }
    add('circle',{cx:x,cy:y,r:14,fill:'transparent'},g); }); }
function drawMkList(M){ const box=el('mklist'); if(!box) return; const A=(R.mk||[]).map((m,i)=>[m,i]).sort((a,b)=>a[0].x-b[0].x);
  box.innerHTML= A.length? A.map(([m,i])=>{ const bad=mkCheck(M,m); return `<div class="mkrow"><span><b>${esc(mkName(m))}</b> · ${fx(m.x,1)} NM${mkText(m)?' · '+esc(mkText(m)):''}${bad!=null?` <span class="ko">${L({en:'path is',no:'banen er'})} ${fx(bad)}</span>`:''}</span><span><button data-ed="${i}" aria-label="Edit">${EDIT_IC}</button><button data-rm="${i}" aria-label="Delete">✕</button></span></div>`; }).join('')
   : `<p class="note" style="margin:0">${L({en:'None yet. Drag a marker to move it.',no:'Ingen ennå. Dra en markør for å flytte den.'})}</p>`; }
el('mklist').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(b.dataset.rm!=null){ R.mk.splice(+b.dataset.rm,1); render(); queueSave(); } else { const m=R.mk[+b.dataset.ed]; const r=psv.getBoundingClientRect(), h=el('profw').getBoundingClientRect(); mkEdit(m, psv._XS(m.x)/1000*r.width+r.left-h.left, 40); } });
let MKT='fix';
el('mktools').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b&&b.id==='mkmore'){ const x=el('mkx'); x.hidden=!x.hidden; b.setAttribute('aria-expanded',String(!x.hidden)); b.textContent=x.hidden?L({en:'More ▾',no:'Flere ▾'}):L({en:'Fewer ▴',no:'Færre ▴'}); return; } if(!b||!b.dataset.k) return; MKT=b.dataset.k; el('mktools').querySelectorAll('[data-k]').forEach(x=>x.classList.toggle('on',x===b)); });
el('vstools').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; R.vs=R.vs||{};
  if(b.dataset.v){ R.vs.mode=b.dataset.v; R.vs.z=0; if(b.dataset.v==='man'&&!R.vs.max){ R.vs.max=String(Math.round(psv._ymax||8000)); } }
  if(b.dataset.z!=null){ if(b.dataset.z==='0'){ R.vs={}; el('vsex').value='1'; } else R.vs.z=(R.vs.z||0)+(+b.dataset.z); }
  vsUI(); drawProfile(compute(),TP); queueSave(); });
el('vsmax').addEventListener('input',()=>{ R.vs=R.vs||{}; R.vs.max=el('vsmax').value; drawProfile(compute(),TP); queueSave(); });
el('vsex').addEventListener('change',()=>{ R.vs=R.vs||{}; R.vs.ex=+el('vsex').value; drawProfile(compute(),TP); queueSave(); });
el('pzoom').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(b.dataset.pt){ R.noTer=!R.noTer; ptUI(); drawProfile(compute(),TP); drawSrc(); queueSave(); return; } R.vs=R.vs||{}; const z=+b.dataset.pz; if(!z){ const ex=R.vs.ex; R.vs={}; if(ex) R.vs.ex=ex; } else { R.vs.mode='auto'; R.vs.z=(R.vs.z||0)+z; } vsUI(); drawProfile(compute(),TP); queueSave(); });
function ptUI(){ const b=el('ptter'); if(!b) return; const off=!!(R&&R.noTer); b.classList.toggle('on',!off); b.setAttribute('aria-pressed',String(!off)); b.hidden=pmode()==='ter'; }
function vsUI(){ ptUI(); const V=R.vs||{}; el('vstools').querySelectorAll('[data-v]').forEach(x=>x.classList.toggle('on',x.dataset.v===(V.mode||'auto'))); el('vsmaxw').hidden=V.mode!=='man'; if(document.activeElement!==el('vsmax')) el('vsmax').value=V.max||''; el('vsex').value=String(V.ex||1); }
el('ghost').addEventListener('change',e=>{ R.ghost=e.target.checked; drawProfile(compute(),TP); queueSave(); });
function mkEdit(m,x,y){ if(npBox) npBox.remove(); const host=el('profw'); const b=document.createElement('div'); b.className='newpt'; b.style.left=Math.max(4,Math.min(x+8,host.clientWidth-240))+'px'; b.style.top=Math.max(4,Math.min(y,host.clientHeight-260))+'px';
  const isCr=m.t==='cr';
  b.innerHTML=`<b>${esc(L({en:MKN[m.t],no:MKNO[MKN[m.t]]||MKN[m.t]}))}</b>
   ${isCr?`<select data-f="k">${Object.keys(CRK).map(k=>`<option value="${k}" ${(m.k||'above')===k?'selected':''}>${L({en:CRK[k][0],no:CRK[k][1]})}</option>`).join('')}</select>`:''}
   ${m.t!=='note'?`<label class="f">${L({en:'Altitude (ft or FL)',no:'Høyde (ft eller FL)'})}<input type="text" data-f="a" value="${m.a!=null?Math.round(m.a):''}"></label>`:''}
   ${isCr?`<label class="f" data-w="a2" ${m.k==='between'?'':'hidden'}>${L({en:'Second altitude',no:'Andre høyde'})}<input type="text" data-f="a2" value="${m.a2!=null?Math.round(m.a2):''}"></label>`:''}
   <label class="f">${m.t==='note'?L({en:'Text',no:'Tekst'}):L({en:'Label (optional)',no:'Navn (valgfritt)'})}<input type="text" data-f="s" value="${esc(m.s||'')}" style="text-transform:none"></label>
   <label class="f">${L({en:'Distance from start (NM)',no:'Distanse fra start (NM)'})}<input type="text" data-f="x" value="${fx(m.x,1)}"></label>
   <div class="row"><button class="btn pri" data-a="ok">OK</button><button class="btn" data-a="rm">${L({en:'Delete',no:'Slett'})}</button><button class="btn" data-a="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button></div>`;
  b.addEventListener('pointerdown',e=>e.stopPropagation()); b.addEventListener('click',e=>e.stopPropagation());
  const q=k=>b.querySelector(`[data-f="${k}"]`); if(q('k')) q('k').onchange=()=>{ b.querySelector('[data-w=a2]').hidden=q('k').value!=='between'; };
  const close=()=>{ b.remove(); npBox=null; };
  const ok=()=>{ if(q('a')){ const v=pnum(q('a').value); m.a=v; } if(q('a2')) m.a2=pnum(q('a2').value); if(q('k')) m.k=q('k').value; m.s=q('s').value.trim(); const xv=pnum(q('x').value); if(xv!=null) m.x=Math.max(0,Math.min(compute().total,xv)); close(); render(); queueSave(); };
  b.querySelector('[data-a=ok]').onclick=ok; b.querySelectorAll('input').forEach(i=>i.addEventListener('keydown',e=>{ if(e.key==='Enter') ok(); if(e.key==='Escape') close(); }));
  b.querySelector('[data-a=rm]').onclick=()=>{ const i=R.mk.indexOf(m); if(i>=0) R.mk.splice(i,1); close(); render(); queueSave(); };
  b.querySelector('[data-a=x]').onclick=close; host.appendChild(b); npBox=b; setTimeout(()=>{ const f=q('a')||q('s'); f.focus(); f.select(); },0); }
/* dra markører */
let mkDrag=null, justDragged=false;
const svgPt=e=>{ const r=psv.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*(psv._W0||1000),(e.clientY-r.top)/r.height*(psv._H0||420)]; };
psv.addEventListener('pointerdown',e=>{ const g=e.target.closest&&e.target.closest('.mk'); if(!g) return; e.preventDefault(); const m=R.mk[+g.dataset.mi]; if(!m) return; psv.setPointerCapture(e.pointerId); mkDrag={m,x0:e.clientX,y0:e.clientY,moved:false}; });
psv.addEventListener('pointermove',e=>{ if(!mkDrag) return; if(Math.abs(e.clientX-mkDrag.x0)+Math.abs(e.clientY-mkDrag.y0)>3) mkDrag.moved=true; if(!mkDrag.moved) return; const [vx,vy]=svgPt(e); const M=compute(); const m=mkDrag.m; m.x=Math.max(0,Math.min(M.total,psv._XI(vx))); if(m.t!=='note'&&m.t!=='fix'){ m.a=Math.max(0,r100(psv._YI(vy))); if(m.a2!=null&&m.k==='between'){} } drawProfile(M,TP); });
psv.addEventListener('pointerup',e=>{ if(!mkDrag) return; const d=mkDrag; mkDrag=null; justDragged=true; setTimeout(()=>justDragged=false,0);
  if(d.moved){ render(); queueSave(); } else { const h=el('profw').getBoundingClientRect(); mkEdit(d.m,e.clientX-h.left,e.clientY-h.top); } });
/* værlag fra METAR/TAF */
function wxLayers(M){ const txt=String(R.wx||'').toUpperCase(); if(!txt.trim()||M.C.length<2) return [];
  const reps=txt.replace(/\r/g,'').split(/\n+|(?=\b(?:METAR|SPECI|TAF)\b)/).map(t=>t.trim()).filter(Boolean); const out=[]; const r=Math.max(4,Math.min(25,M.total*0.1));
  reps.forEach(t=>{ let w=t.replace(/=+$/,'').split(/\s+/); while(w.length&&/^(METAR|SPECI|TAF|AMD|COR|AUTO)$/.test(w[0])) w.shift(); const st=w[0]; if(!/^[A-Z]{4}$/.test(st||'')) return;
    const c=M.C.find(c=>c.p.n===st); if(!c) return;
    const cut=w.findIndex((x,k)=>k>1&&/^(BECMG|TEMPO|FM\d{6}|PROB\d{2}|RMK|NOSIG|TREND)$/.test(x)); const main=cut>0?w.slice(0,cut):w;
    const elev=pnum(c.p.elev)??(c.p.t==='rwy'?c.tgt:0)??0;
    const L_=[]; main.forEach(x=>{ const m=x.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?$/); if(m) L_.push({cov:{FEW:1,SCT:2,BKN:3,OVC:4,VV:4}[m[1]],base:+m[2]*100+elev,ty:m[3]||'',txt:x}); });
    L_.sort((a,b)=>a.base-b.base).forEach((l,k)=>{ const nx=L_[k+1]; const top= l.ty==='CB'? 30000 : l.ty==='TCU'? l.base+6000 : Math.min(nx?nx.base:1e9, l.base+(l.cov>=3?2000:1000)); out.push({st,x:c.x,r,base:l.base,top:Math.max(top,l.base+400),cov:l.cov,cb:!!l.ty,ty:l.ty,txt:l.txt}); }); });
  return out; }
el('ntmin').addEventListener('input',()=>{ R.ntm=el('ntmin').value; ntmSync(); queueSave(); });
el('wxin').addEventListener('input',()=>{ R.wx=el('wxin').value; const M=compute(); drawProfile(M,TP); wxMsg(M); queueSave(); });
function wxMsg(M){ const txt=String(R.wx||'').toUpperCase(); if(!txt.trim()){ el('wxmsg').textContent=''; return; } const names=new Set(M.C.map(c=>c.p.n)); const st=[...new Set((txt.match(/\b(?:METAR|SPECI|TAF)(?:\s+(?:AMD|COR|AUTO))*\s+([A-Z]{4})\b/g)||[]).map(x=>x.split(/\s+/).pop()))]; const L_=wxLayers(M);
  const off=st.filter(x=>!names.has(x)); el('wxmsg').innerHTML=[L_.length?`${L({en:'Drawn:',no:'Tegnet:'})} ${esc([...new Set(L_.map(l=>l.st+' '+l.txt))].join(', '))}. ${L({en:'Heights in the report are above the aerodrome, so its elevation is added.',no:'Høydene i rapporten er over flyplassen, så flyplasshøyden er lagt til.'})}`:'', off.length?`<span class="ko">${L({en:'Not on the route:',no:'Ikke på ruten:'})} ${esc(off.join(', '))}</span>`:'', /TAF/.test(txt)?L({en:'For TAF only the main forecast is drawn, not BECMG, TEMPO or PROB.',no:'For TAF tegnes bare hovedprognosen, ikke BECMG, TEMPO eller PROB.'}):''].filter(Boolean).join(' '); }
/* ---------- tabell ---------- */
function legTer(M,i){ if(!TP||!i) return null; const x0=M.C[i-1].x, x1=M.C[i].x; let m=null; TP.pts.forEach(p=>{ if(p.x>=x0-1e-6&&p.x<=x1+1e-6&&p.e!=null&&(m==null||p.e>m)) m=p.e; }); return m; }
function drawTable(M){
  const mg=+S('mg')||1000;
  el('ptb').innerHTML=`<tr><th>#</th><th>${L({en:'Name',no:'Navn'})}</th><th>Type</th><th>${L({en:'Position',no:'Posisjon'})}</th><th>${L({en:'NM from previous',no:'NM fra forrige'})}</th><th>TT°</th><th title="Magnetic variation, World Magnetic Model">VAR</th><th>MC°</th><th>${L({en:'Altitude (ft)',no:'Høyde (ft)'})}</th><th>${L({en:'Planned',no:'Planlagt'})}</th><th>${L({en:'Terrain max (ft)',no:'Terreng maks (ft)'})}</th><th>${L({en:'+ margin',no:'+ margin'})}</th><th>${L({en:'Note',no:'Notat'})}</th><th></th></tr>`+
   M.C.map((c,i)=>{ const p=c.p, q=i?M.C[i-1].p:null; const tt=i&&p.la!=null&&q.la!=null? String(Math.round(brg(q,p))).padStart(3,'0') : ''; const vv=tt?magVar(q,p):null, vtx=vv!=null&&window.WMM?WMM.fmt(vv,LAB.lang==='no'):'', mct=vv!=null?mcOf(brg(q,p),vv):''; const auto=i&&pnum(p.d)==null;
     const te=legTer(M,i), terV= te!=null? Math.round(te) : pnum(p.ter); const guide= terV!=null&&i&&!c.app&&p.t!=='missed'? Math.ceil((terV+mg)/100)*100 : null; const lowest=i?Math.min(M.C[i-1].tgt,c.tgt):null; const nearAd=p.t==='rwy'||(q&&q.t==='rwy'); const low= guide!=null&&lowest!=null&&lowest<guide&&!nearAd;
     return `<tr data-i="${i}" class="${i===selI?'sel':''}"><td>${i+1}</td><td><input data-x="n" value="${esc(p.n||'')}"></td><td><select data-x="t">${XT.map(([k,l])=>`<option value="${k}" ${p.t===k?'selected':''}>${L({en:l,no:TNO[l]||l})}</option>`).join('')}</select></td>
     <td class="c">${p.la!=null?llTxt(p.la,p.lo):(p.miss?`<span class="ko">${L({en:'not found',no:'ikke funnet'})}</span>`:'—')}</td>
     <td>${i?`<input data-x="d" inputmode="decimal" value="${pnum(p.d)!=null?p.d:''}" placeholder="${auto?fx(c.d,1):''}">`:''}</td><td class="c">${tt}</td><td class="c">${vtx}</td><td class="c">${mct}</td>
     <td><input data-x="a" value="${esc(p.a||'')}" placeholder="${p.t==='rwy'?fx(pnum(p.elev)??0):(APPT.includes(p.t)?'':'cruise')}"></td><td class="c">${altTxt(c.tgt)}${c.short?` <span class="ko" title="climb">↗${c.short}</span>`:''}</td>
     <td>${te!=null?`<span class="c">${fx(te)}</span>`:(i?`<input data-x="ter" inputmode="decimal" value="${esc(p.ter||'')}">`:'')}</td><td class="c">${guide!=null?`<span class="${low?'ko':''}">${fx(guide)}${low?' ⚠︎':''}</span>`:''}</td>
     <td><input data-x="note" value="${esc(p.note||'')}"></td><td class="act"><button data-m="-1" aria-label="Up">↑</button><button data-m="1" aria-label="Down">↓</button><button data-del="1" aria-label="Delete">✕</button></td></tr>`; }).join('');
  const lows=M.C.filter((c,i)=>{ if(!i||c.app||c.p.t==='rwy'||M.C[i-1].p.t==='rwy') return false; const te=legTer(M,i)??pnum(c.p.ter); if(te==null) return false; return Math.min(M.C[i-1].tgt,c.tgt)<Math.ceil((te+mg)/100)*100; }).length;
  const steep=M.C.filter(c=>c.steep).length;
  const zt=zoneTer(M), zz=zones(M);
  const hitTxt=M.PM==='ter'?'':M.PM==='alt'?[TP&&TP.pts.some(q=>isHit(M,q))?`<span class="ko">${L({en:'The terrain rises above your altitude line (red dots).',no:'Terrenget stiger over høydelinjen din (røde prikker).'})}</span>`:'', TP&&TP.pts.some(q=>isLow(M,q))?`<span class="ko">${L({en:'Less than',no:'Mindre enn'})} ${fx(mg)} ft ${L({en:'between the line and the terrain (orange dots).',no:'mellom linjen og terrenget (oransje prikker).'})}</span>`:''].filter(Boolean).join('<br>'):[TP&&TP.pts.some(q=>isHit(M,q))?`<span class="ko">${L({en:'En route the path goes into the terrain (red dots). Fly higher, climb earlier or route around it.',no:'På strekningen går banen inn i terrenget (røde prikker). Fly høyere, stig tidligere eller legg ruten rundt.'})}</span>`:'',
    TP&&TP.pts.some(q=>isLow(M,q))?`<span class="ko">${L({en:'En route the path is less than',no:'På strekningen er banen mindre enn'})} ${fx(mg)} ft ${L({en:'above the terrain (orange dots).',no:'over terrenget (oransje prikker).'})}</span>`:'',
    zt.d?`${L({en:'Terrain rises above a straight climb out of',no:'Terrenget stiger over en rett stigning ut fra'})} ${esc(zz.dn)}: ${L({en:'use the SID, the published climb gradient or a visual departure.',no:'bruk SID, publisert stigegradient eller visuell avgang.'})}`:'',
    zt.a&&R.da&&R.da.arr?`${L({en:'The terrain under the illustrative final to',no:'Terrenget under den illustrative finalen til'})} ${esc(zz.an)} ${L({en:'is higher than a straight 3° path: the published approach is built differently here. Check the plate.',no:'er høyere enn en rett 3°-bane: den publiserte innflygingen er lagt annerledes her. Sjekk platen.'})}`:zt.a?`${L({en:'Terrain rises above a straight descent into',no:'Terrenget stiger over en rett sink inn til'})} ${esc(zz.an)}: ${L({en:'the real path is the published approach or a visual approach. Check it on the chart.',no:'den virkelige banen er den publiserte eller en visuell innflyging. Sjekk den på kartet.'})}`:''].filter(Boolean).join('<br>');
  const pm=el('pmsg'); if(pm) pm.innerHTML=hitTxt;
  el('pnote').innerHTML=[hitTxt,M.total?`${L({en:'Total',no:'Totalt'})} ${fx(M.total,1)} NM`:'', lows?`<span class="ko">${lows} ${L({en:'leg(s) below terrain + margin (climb and descent included)',no:'etappe(r) under terreng + margin (stigning og sink medregnet)'})}</span>`:'', steep?`<span class="ko">${steep} ${L({en:'descent(s) steeper than your gradient',no:'sink brattere enn gradienten din'})}</span>`:''].filter(Boolean).join(' · ');
}
const TNO={'Runway / aerodrome':'Bane / flyplass','SID / exit fix':'SID / utgangspunkt','Waypoint':'Veipunkt','Hold':'Holding','Missed approach':'Missed approach','Alternate':'Alternativ'};
const ptb=el('ptb');
const pEdit=e=>{ const r=e.target.closest('tr'); if(!r||!e.target.dataset.x) return; const p=R.pts[+r.dataset.i]; p[e.target.dataset.x]=e.target.value; if(e.type==='change'||e.target.tagName==='SELECT'){ render(); } else { drawProfile(compute(),TP); drawMap(); } queueSave(); };
ptb.addEventListener('input',pEdit); ptb.addEventListener('change',pEdit);
ptb.addEventListener('click',e=>{ const b=e.target.closest('button'); const tr=e.target.closest('tr[data-i]'); if(!tr) return; const i=+tr.dataset.i;
  if(!b){ selI=i; drawMap(); drawProfile(compute(),TP); drawSelbar(); ptb.querySelectorAll('tr').forEach(r=>r.classList.toggle('sel',+r.dataset.i===i)); return; }
  const A=R.pts; if(b.dataset.del) A.splice(i,1); else { const j=i+(+b.dataset.m); if(j<0||j>=A.length) return; [A[i],A[j]]=[A[j],A[i]]; } render(); queueSave(); });
el('padd').onclick=()=>{ R.pts.push({n:'',t:'wpt'}); render(); queueSave(); };
el('pclr').onclick=()=>{ if(!confirmClear()) return; R.pts=[]; el('rtxt').value=''; render(); queueSave(); };
function confirmClear(){ return R.pts.length<3||window.confirm(L({en:'Clear all points in this route?',no:'Fjerne alle punktene i ruten?'})); }

/* ---------- rute fra tekst ---------- */
/* ForeFlight / Garmin / ICAO felt 15 -> våre tokens. Returnerer {toks, info} */
function expandAwy(des,a,b){ const keys=Object.keys(AWY).filter(k=>k===des||k.startsWith(des+'@')); for(const k of keys){ const seq=AWY[k].map(p=>p[0]); const i=seq.indexOf(a), j=seq.indexOf(b); if(i<0||j<0||i===j) continue;
    const mid=i<j? AWY[k].slice(i+1,j) : AWY[k].slice(j+1,i).reverse(); mid.forEach(p=>{ AWYPT[p[0]]=[p[1],p[2],des]; }); return mid.map(p=>p[0]); } return null; }
const AWYPT={};
function normRoute(txt){ const info={drop:[],aw:[],awok:[],proc:[],spd:null,lvl:null};
  let raw=String(txt||'').toUpperCase().replace(/[\r\n,]+/g,' ').replace(/-/g,' ').trim().split(/\s+/).filter(Boolean);
  const out=[];
  raw.forEach((t,i)=>{
    const base=t.split('/')[0];
    // fart/nivå: N0140F070, K0250A050, M078F350
    let m=t.match(/^([NKM])(\d{3,4})([FASM])(\d{3,4})$/); if(m){ const sp=m[1]==='N'?+m[2]:m[1]==='K'?Math.round(+m[2]/1.852):null; if(sp&&info.spd==null) info.spd=sp; const lv=m[3]==='F'?'FL'+m[4]:m[3]==='A'?String(+m[4]*100):null; if(lv&&info.lvl==null) info.lvl=lv; return; }
    if(/^(DCT|IFR|VFR|OAT|GAT|SID|STAR|DIRECT|TO|VIA)$/.test(t)) return;
    // ICAO-flyplass med bane: ENGM/01L -> ENGM
    if(/^[A-Z]{4}\/(\d{2}[LRC]?|RW\d{2}[LRC]?)$/.test(t)){ out.push(t.split('/')[0]); return; }
    // punkt med fart/nivå: GMN/N0140F070
    const sl=t.match(/^([A-Z0-9]+)\/([NKM]\d{3,4})([FA])(\d{3,4})$/); if(sl){ out.push(sl[1]+'/'+(sl[3]==='F'?'FL'+sl[4]:String(+sl[4]*100))); return; }
    if(NAV&&resolvable(base)) { out.push(t); return; }
    if(/^\d{2,7}(\.\d+)?[NS]\d{3,8}(\.\d+)?[EW]/.test(base)){ out.push(t); return; }
    if(/^[A-Z]{2,5}\d[A-Z]$/.test(base)||/^[A-Z]{3,5}\d{1,2}[A-Z]?$/.test(base)&&base.length>=5){ info.proc.push(base); return; }
    if(/^U?[A-Z]{1,2}\d{1,4}[A-Z]?$/.test(base)){ const prev=out[out.length-1], next=raw[i+1]; const pa=prev&&prev.split('/')[0], nb=next&&next.split('/')[0];
      const ex=expandAwy(base,pa,nb); if(ex){ ex.forEach(n=>out.push(n)); info.awok.push(base); return; }
      info.aw.push(base+(prev&&next?` (${pa}–${nb})`:'')); return; }
    out.push(t); });
  return {toks:out,info}; }
function resolvable(n){ return !!(FIX.find(x=>x.n===n)||NAV.apI[n]||(NAV.nvI[n]&&NAV.nvI[n].length)||(NAV.fxI&&NAV.fxI[n]&&NAV.fxI[n].length)); }
function build(){ const NR=normRoute(el('rtxt').value); const toks=NR.toks; if(!toks.length) return;
  if(NR.info.lvl&&!R.s.cr){ R.s.cr=NR.info.lvl; el('s_cr').value=NR.info.lvl; } if(NR.info.spd&&!R.gs){ R.gs=NR.info.spd; }
  // koordinater med mellomrom: slå sammen "5930N 01045E"
  const T=[]; for(let i=0;i<toks.length;i++){ const a=toks[i], b=toks[i+1]; if(b&&/^\d{4,7}(\.\d+)?[NS]$/i.test(a)&&/^\d{5,8}(\.\d+)?[EW](\/.*)?$/i.test(b)){ T.push(a+b); i++; } else T.push(a); }
  const out=[]; T.forEach((t,i)=>{ const p=resolve(t,out[out.length-1]); if(p.t==='rwy'&&i!==0&&i!==T.length-1) p.t='wpt'; out.push(p); });
  const app=R.pts.filter(p=>p.app); // behold innflyging
  R.pts=out; if(app.length) insertApp(app);
  const miss=out.filter(p=>p.miss).map(p=>p.n); const msg=[];
  const far=[]; out.forEach((p,i)=>{ if(!i||p.la==null) return; let j=i-1; while(j>=0&&out[j].la==null) j--; if(j<0) return; const d=gc(out[j],p); if(d>300) far.push(`${p.n} (${Math.round(d)} NM ${L({en:'from',no:'fra'})} ${out[j].n})`); });
  if(far.length) msg.push(`<span class="ko">${L({en:'Check these, they are far from the previous point and may be a different place with the same name:',no:'Sjekk disse, de ligger langt fra forrige punkt og kan være et annet sted med samme navn:'})} ${esc(far.join(', '))}</span>`);
  if(miss.length) msg.push(`<span class="ko">${L({en:'Not found:',no:'Ikke funnet:'})} ${esc(miss.join(', '))}</span> · ${L({en:'Save them under My fixes, or enter coordinates.',no:'Lagre dem under Mine fixes, eller skriv koordinater.'})}`);
  if(NR.info.awok.length) msg.push(`<span class="note">${L({en:'Airways followed from the AIP (ENR 3):',no:'Luftveier fulgt fra AIP (ENR 3):'})} ${esc(NR.info.awok.join(', '))}</span>`);
  if(NR.info.aw.length) msg.push(`<span class="warn">${L({en:'Airways are drawn as direct lines between the points on each side (no airway data yet):',no:'Luftveier tegnes som rette linjer mellom punktene på hver side (ingen luftveidata ennå):'})} ${esc(NR.info.aw.join(', '))}</span>`);
  if(NR.info.proc.length) msg.push(`<span class="warn">${L({en:'SID/STAR not drawn (use the chart):',no:'SID/STAR er ikke tegnet (bruk kartet):'})} ${esc(NR.info.proc.join(', '))}</span>`);
  if(NR.info.spd||NR.info.lvl) msg.push(`<span class="note">${L({en:'Read from the string:',no:'Lest fra strengen:'})} ${[NR.info.spd?NR.info.spd+' kt':'',NR.info.lvl||''].filter(Boolean).join(', ')}</span>`);
  el('sugg').innerHTML=msg.join('<br>');
  R.rt=el('rtxt').value; delete el('shOpen').dataset.user; applyDA(); render(); fit(); queueSave(); }
/* ---------- angre og nullstill ---------- */
let HI=[], hT=0, hLoading=false;
let HRD=[];
function hPush(){ if(hLoading) return; const j=JSON.stringify(R); if(HI[HI.length-1]===j) return; HRD=[]; const now=Date.now(); if(HI.length>1&&now-hT<800) HI[HI.length-1]=j; else HI.push(j); hT=now; if(HI.length>60) HI.shift(); hBtns(); }
function hBtns(){ const b=el('undo'); if(b) b.disabled=HI.length<2; const r=el('redo'); if(r) r.disabled=!HRD.length; const e=el('edbar'); if(e&&R) e.hidden=!(R.pts&&R.pts.length)&&HI.length<2&&!HRD.length; const c=el('clr'); if(c&&R) c.disabled=!(R.pts&&R.pts.length); }
function hRestore(j){ const o=JSON.parse(j); Object.keys(R).forEach(k=>delete R[k]); Object.assign(R,o); hLoading=true; try{ load(R); } finally{ hLoading=false; } hBtns(); clearTimeout(dirty); dirty=setTimeout(async()=>{ R.title=title(); await NSTORE.put('route',R); drawSel(); linkSync(); },600); }
function undo(){ if(HI.length<2) return; HRD.push(HI.pop()); hT=0; selI=-1; hRestore(HI[HI.length-1]); }
function redo(){ if(!HRD.length) return; const j=HRD.pop(); HI.push(j); hT=0; selI=-1; hRestore(j); }
el('redo').onclick=redo;
el('clr').onclick=()=>{ if(!R.pts.length) return; R.pts=[]; R.mk=[]; R.rt=''; el('rtxt').value=''; selI=-1; render(); queueSave(); };
function ptPop(){ const pp=el('ptpop'); if(!pp) return; const p=selI>=0&&R&&R.pts[selI]; if(!p||p.la==null||MODE==='draw'){ pp.hidden=true; return; } const [x,y]=prj(p.la,p.lo); const w=mapEl.clientWidth, h=mapEl.clientHeight; if(x<0||y<0||x>w||y>h){ pp.hidden=true; return; } el('ptpopn').textContent=p.n||L({en:'Point',no:'Punkt'})+' '+(selI+1); pp.style.left=Math.min(Math.max(x,90),w-90)+'px'; pp.style.top=y+'px'; pp.hidden=false; }
el('ptdel').onclick=()=>{ if(selI<0) return; R.pts.splice(selI,1); selI=-1; R.rt=''; el('rtxt').value=routeStr(); render(); queueSave(); };
el('ptx').onclick=()=>{ selI=-1; render(); };
el('undo').onclick=undo;
document.addEventListener('keydown',e=>{ if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){ const t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)) return; e.preventDefault(); undo(); } if((e.ctrlKey||e.metaKey)&&((e.shiftKey&&e.key.toLowerCase()==='z')||e.key.toLowerCase()==='y')){ const t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)) return; e.preventDefault(); redo(); } });
el('preset').onclick=()=>{ (R.pts||[]).forEach(p=>{ if('ua0' in p){ if(p.ua0==='') delete p.a; else p.a=p.ua0; delete p.ua0; } }); if('crU0' in R){ R.s.cr=R.crU0; el('s_cr').value=R.s.cr; delete R.crU0; } R.mk=[]; selI=-1; render(); queueSave(); };
el('build').onclick=()=>{ el('qres').hidden=true; build(); };
['cr','cl','ds','msa','frz','cb','ct','cw','mg','ta','tz'].forEach(k=>{ const i=el('s_'+k); i.addEventListener('input',()=>{ R.s[k]=i.value; if(k==='cw') terKey=''; render(); queueSave(); }); });

/* ---------- innflyging ---------- */
function appPts(a){ const n=pnum, out=[]; const thr=n(a.thr), fafa=n(a.fafa)??((thr??0)+1500), da=n(a.da)??((thr??0)+200);
  if(a.iaf||n(a.iafa)!=null) out.push({n:(a.iaf||'IAF').toUpperCase(),t:'iaf',a:a.iafa||'',app:1});
  if(a.hold) out.push({n:'HOLD',t:'hold',d:'0',app:1});
  out.push({n:(a.faf||'FAF').toUpperCase(),t:'faf',d:a.fafd||'5',a:String(fafa),note:a.app||'',app:1});
  const dDA=(fafa-da)/318, dThr=(fafa-(thr??0)-50)/318;
  out.push({n:(/ils|lpv|gls|lnav\/vnav/i.test(a.app||'ILS')?'DA ':'MDA ')+da,t:'da',d:String(Math.round(Math.max(0.1,dDA)*10)/10),a:String(da),app:1});
  out.push({rwyThr:1,d:String(Math.round(Math.max(0.1,dThr-dDA)*10)/10),a:thr!=null?String(thr):''});
  if(a.ma||n(a.maa)!=null) out.push({n:(a.ma||'MAP').toUpperCase(),t:'missed',d:a.mad||'6',a:a.maa||'3000',app:1});
  return out; }
function insertApp(list){ // list: approach points; threshold marker merges into destination runway
  R.pts=R.pts.filter(p=>!p.app); let di=-1; for(let i=R.pts.length-1;i>0;i--) if(R.pts[i].t==='rwy'){ di=i; break; }
  const before=[], after=[]; let thr=null; list.forEach(p=>{ if(p.rwyThr) thr=p; else if(p.t==='missed') after.push(p); else before.push(p); });
  // IAF som allerede finnes i ruten: merk den i stedet for å legge til
  const iaf=before.find(p=>p.t==='iaf'); if(iaf){ const ex=R.pts.find(p=>p.n===iaf.n&&!p.app); if(ex){ ex.t='iaf'; if(iaf.a) ex.a=iaf.a; before.splice(before.indexOf(iaf),1); } else { const r=resolve(iaf.n,R.pts[Math.max(0,di-1)]); if(!r.miss){ iaf.la=r.la; iaf.lo=r.lo; } else iaf.miss=1; } }
  if(di<0){ R.pts.push(...before); if(thr) R.pts.push({n:'THR',t:'rwy',d:thr.d,a:thr.a}); R.pts.push(...after); return; }
  const dest=R.pts[di]; if(thr){ dest.d=thr.d; if(thr.a) dest.a=thr.a; }
  R.pts.splice(di,0,...before); R.pts.splice(R.pts.indexOf(dest)+1,0,...after); }
const AK=['app','iaf','iafa','hold','faf','fafd','fafa','da','thr','ma','mad','maa'];
el('appGo').onclick=()=>{ const a={}; AK.forEach(k=>a[k]=el('a_'+k).value.trim()); R.app=a; insertApp(appPts(a)); render(); queueSave(); el('pnote').textContent=L({en:'Approach added. Check the distances against the plate.',no:'Innflyging lagt til. Sjekk avstandene mot platen.'}); };
el('appClr').onclick=()=>{ R.pts=R.pts.filter(p=>!p.app); R.pts.forEach(p=>{ if(p.t==='iaf') p.t='wpt'; }); const d=R.pts[R.pts.length-1]; if(d&&d.t==='rwy'){ delete d.d; } render(); queueSave(); };
document.querySelector('#tabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b)); document.querySelectorAll('[data-p]').forEach(p=>p.hidden=p.dataset.p!==b.dataset.t); });

/* ---------- kart ---------- */
const mapEl=el('map'); try{ if(mlWanted()){ mapEl.dataset.map='loading'; const lt=document.getElementById('mlloadT'); if(lt&&/^nb|^no/.test(document.documentElement.lang)) lt.textContent='Laster VFR-kart …'; } }catch(e){} let V={lo:10,la:60,z:22}; // z = px per breddegrad
const BND={la0:25,la1:72,lo0:-32,lo1:45};
function minZ(){ const w=mapEl.clientWidth||600, h=mapEl.clientHeight||400, k=Math.cos(V.la*D2R); return Math.max(h/(BND.la1-BND.la0), w/((BND.lo1-BND.lo0)*k)); }
function clampV(){ V.z=Math.max(minZ(),Math.min(600,V.z)); const w=mapEl.clientWidth, h=mapEl.clientHeight, k=Math.cos(V.la*D2R); const hl=h/2/V.z, hw=w/2/(V.z*k);
  V.la=Math.max(BND.la0+hl,Math.min(BND.la1-hl,V.la)); if(BND.la1-BND.la0<2*hl) V.la=(BND.la0+BND.la1)/2; V.lo=Math.max(BND.lo0+hw,Math.min(BND.lo1-hw,V.lo)); if(BND.lo1-BND.lo0<2*hw) V.lo=(BND.lo0+BND.lo1)/2; }
const prj=(la,lo)=>{ if(ML){ const p=ML.project([lo,la]); return [p.x,p.y]; } const w=mapEl.clientWidth, h=mapEl.clientHeight, k=Math.cos(V.la*D2R); return [w/2+(lo-V.lo)*k*V.z, h/2-(la-V.la)*V.z]; };
const inv=(x,y)=>{ if(ML){ const l=ML.unproject([x,y]); return [l.lat,l.lng]; } const w=mapEl.clientWidth, h=mapEl.clientHeight, k=Math.cos(V.la*D2R); return [V.la-(y-h/2)/V.z, V.lo+(x-w/2)/(k*V.z)]; };
let pickMode=false, hits=[];
let ML=null; // MapLibre-kartet når det er i bruk (rxmap.js); ellers tegnes det gamle lerretskartet
let mapQ=0; function drawMap(){ if(mapQ) return; mapQ=requestAnimationFrame(()=>{ mapQ=0; drawMapNow(); }); }
const mcv=el('mcv'), mx_=mcv.getContext('2d');
const MEFC={}, MEFP={};
function mefOf(q,la,lo){ const key=q+'_'+la.toFixed(2)+'_'+lo.toFixed(2); if(key in MEFC) return MEFC[key];
  const tk=TERRAIN.tileOf(la+q/2,lo+q/2); if(!TERRAIN.has(tk)) return MEFC[key]=null; const a=TERRAIN.raw(tk);
  if(!a){ if(!MEFP[tk]){ MEFP[tk]=1; TERRAIN.load([tk]).then(()=>drawMap()); } return undefined; }
  const n=TERRAIN.n(), [a0,o0]=tk.split('_').map(Number); const r0=Math.max(0,Math.floor((a0+5-(la+q))/5*n)), r1=Math.min(n,Math.ceil((a0+5-la)/5*n)), c0=Math.max(0,Math.floor((lo-o0)/5*n)), c1=Math.min(n,Math.ceil((lo+q-o0)/5*n));
  let m=0; for(let r=r0;r<r1;r++){ const b=r*n; for(let c=c0;c<c1;c++){ const v=a[b+c]; if(v>m) m=v; } }
  return MEFC[key]= m>0? Math.ceil((m+300)/100)*100 : null; }
function drawMEF(g,lo0,lo1,la0,la1,cx,cy,zx,zy){ const q=V.z>=150?0.5:V.z>=70?1:0; if(!q) return; const qa0=Math.floor(la0/q)*q, qo0=Math.floor(lo0/q)*q;
  if(q===0.5){ g.beginPath(); for(let lo=qo0;lo<=lo1;lo+=q){ const x=cx+(lo-V.lo)*zx; g.moveTo(x,0); g.lineTo(x,mapEl.clientHeight); } for(let la=qa0;la<=la1;la+=q){ const y=cy-(la-V.la)*zy; g.moveTo(0,y); g.lineTo(mapEl.clientWidth,y); } g.strokeStyle='rgba(46,91,154,.16)'; g.lineWidth=0.8; g.stroke(); }
  const big=Math.max(18,Math.min(30,q*zy*0.28)), sm=Math.round(big*0.62);
  for(let la=qa0;la<la1;la+=q) for(let lo=qo0;lo<lo1;lo+=q){ const v=mefOf(q,la,lo); if(!v) continue; const x=cx+(lo+q/2-V.lo)*zx, y=cy-(la+q/2-V.la)*zy;
    const th=Math.floor(v/1000), hu=Math.round((v%1000)/100); g.textBaseline='alphabetic'; g.lineJoin='round';
    const fb=`700 ${big}px Archivo, Arial Narrow, sans-serif`, fs=`700 ${sm}px Archivo, Arial Narrow, sans-serif`; g.font=fb; const wb=th?g.measureText(String(th)).width:0; g.font=fs; const ws=g.measureText(String(hu)).width; const x0=x-(wb+ws+1)/2;
    g.fillStyle='rgba(46,91,154,.78)'; g.strokeStyle='rgba(255,255,255,.85)'; g.lineWidth=3;
    if(th){ g.font=fb; g.strokeText(String(th),x0,y+big*0.35); g.fillText(String(th),x0,y+big*0.35); }
    g.font=fs; g.strokeText(String(hu),x0+wb+1,y+big*0.35-big*0.38); g.fillText(String(hu),x0+wb+1,y+big*0.35-big*0.38); } }
function drawMapNow(){ if(!R) return; if(ML){ windyHref(); try{ ptPop(); hBtns(); }catch(e){} mlSync(); return; } clampV(); windyHref(); try{ ptPop(); hBtns(); }catch(e){}
  const w=mapEl.clientWidth, h=mapEl.clientHeight, dpr=Math.min(2,window.devicePixelRatio||1);
  if(mcv.width!==Math.round(w*dpr)||mcv.height!==Math.round(h*dpr)){ mcv.width=Math.round(w*dpr); mcv.height=Math.round(h*dpr); }
  const g=mx_; g.setTransform(dpr,0,0,dpr,0,0); hits=[];
  g.fillStyle='#D9E6EE'; g.fillRect(0,0,w,h);
  const [la1,lo0]=inv(0,0), [la0,lo1]=inv(w,h);
  const k=Math.cos(V.la*D2R), cx=w/2, cy=h/2, zx=k*V.z, zy=V.z;
  const inB=b=>!(b[2]<lo0||b[0]>lo1||b[3]<la0||b[1]>la1);
  const trace=o=>{ const p=o.p; const st=V.z<15?6:V.z<40?2:1; g.moveTo(cx+(p[0]-V.lo)*zx, cy-(p[1]-V.la)*zy); for(let i=2*st;i<p.length;i+=2*st) g.lineTo(cx+(p[i]-V.lo)*zx, cy-(p[i+1]-V.la)*zy); };
  if(MAP){
    g.beginPath(); MAP.land.forEach(o=>{ if(inB(o.b)){ trace(o); g.closePath(); } }); g.fillStyle=MM==='ifr'?'#F5F5F2':'#F2EFE4'; g.fill();
    if(LY.ter) shadeDraw(g,lo0,lo1,la0,la1,cx,cy,zx,zy,()=>{ g.beginPath(); MAP.land.forEach(o=>{ if(inB(o.b)){ trace(o); g.closePath(); } }); });
    g.beginPath(); MAP.coast.forEach(o=>{ if(inB(o.b)) trace(o); }); g.strokeStyle='#9DB1BD'; g.lineWidth=0.9; g.stroke();
    g.beginPath(); MAP.border.forEach(o=>{ if(inB(o.b)) trace(o); }); g.setLineDash([5,3]); g.strokeStyle='#C9C0AE'; g.lineWidth=0.8; g.stroke(); g.setLineDash([]); }
  // gradnett
  const gs=V.z>120?1:V.z>40?2:5; g.beginPath(); for(let lo=Math.ceil(lo0/gs)*gs;lo<=lo1;lo+=gs){ const x=cx+(lo-V.lo)*zx; g.moveTo(x,0); g.lineTo(x,h); } for(let la=Math.ceil(la0/gs)*gs;la<=la1;la+=gs){ const y=cy-(la-V.la)*zy; g.moveTo(0,y); g.lineTo(w,y); } g.strokeStyle='rgba(60,90,110,.10)'; g.lineWidth=1; g.stroke();
  if(LY.mef&&window.TERRAIN) drawMEF(g,lo0,lo1,la0,la1,cx,cy,zx,zy);
  const vis=(la,lo)=>la>=la0-0.3&&la<=la1+0.3&&lo>=lo0-0.3&&lo<=lo1+0.3;
  const labels=[]; const lab=(t,x,y,c,f,pr)=>labels.push([t,x,y,c,f,pr||0]);
  if(NAV){
    if(LY.nv&&V.z>=30){ NAV.nv.forEach(n=>{ if(!vis(n[4],n[5])) return; const ndb=/NDB/.test(n[2]); if(ndb&&V.z<90) return; const x=cx+(n[5]-V.lo)*zx, y=cy-(n[4]-V.la)*zy;
      if(ndb){ g.beginPath(); g.setLineDash([1.5,1.5]); g.arc(x,y,3.4,0,7); g.strokeStyle='#8A6D3B'; g.lineWidth=1.1; g.stroke(); g.setLineDash([]); }
      else { g.beginPath(); for(let a=0;a<6;a++){ const t=a*Math.PI/3; g[a?'lineTo':'moveTo'](x+4.2*Math.cos(t),y+4.2*Math.sin(t)); } g.closePath(); g.fillStyle='#fff'; g.fill(); g.strokeStyle='#3C7A6B'; g.lineWidth=1.1; g.stroke(); g.beginPath(); g.arc(x,y,1,0,7); g.fillStyle='#3C7A6B'; g.fill(); }
      hits.push({x,y,k:'nv',o:n}); if(V.z>=70) lab(n[0],x+6,y+10,ndb?'#8A6D3B':'#3C7A6B','500 9px IBM Plex Mono, monospace',ndb?1:3); }); }
    if(LY.ap) NAV.ap.forEach(a=>{ if(!vis(a[2],a[3])) return; if(a[5]===0&&V.z<110) return; if(a[5]===1&&V.z<(w<600?45:22)) return; const x=cx+(a[3]-V.lo)*zx, y=cy-(a[2]-V.la)*zy; const r=a[5]===2?4.2:a[5]?3.2:2.4;
      g.beginPath(); g.arc(x,y,r,0,7); g.fillStyle=a[5]?'#2C5F8D':'#fff'; g.fill(); g.strokeStyle='#2C5F8D'; g.lineWidth=1.2; g.stroke();
      if(a[5]===2){ g.beginPath(); g.arc(x,y,r+2.6,0,7); g.strokeStyle='rgba(44,95,141,.5)'; g.lineWidth=1; g.stroke(); }
      hits.push({x,y,k:'ap',o:a}); if(V.z>=(a[5]===2?26:a[5]?55:130)) lab(a[0],x+6,y-5,'#2C5F8D','600 9.5px IBM Plex Mono, monospace',[2,4,5][a[5]]); }); }
  if(LY.fx&&NAV&&NAV.fx&&V.z>=45) NAV.fx.forEach(p=>{ if(!vis(p[1],p[2])) return; const x=cx+(p[2]-V.lo)*zx, y=cy-(p[1]-V.la)*zy; g.beginPath(); g.moveTo(x,y-3.6); g.lineTo(x+3.2,y+2.4); g.lineTo(x-3.2,y+2.4); g.closePath(); g.strokeStyle='#7D93A3'; g.lineWidth=1; g.stroke(); hits.push({x,y,k:'aip',o:p}); if(V.z>=90) lab(p[0],x+5,y+3,'#7D93A3','500 8.5px IBM Plex Mono, monospace',1); });
  if(LY.my) FIX.forEach(f=>{ if(!vis(f.la,f.lo)) return; const x=cx+(f.lo-V.lo)*zx, y=cy-(f.la-V.la)*zy; g.beginPath(); g.moveTo(x,y-4.5); g.lineTo(x+4,y+3); g.lineTo(x-4,y+3); g.closePath(); g.fillStyle='#fff'; g.fill(); g.strokeStyle='#9A1E68'; g.lineWidth=1.2; g.stroke(); hits.push({x,y,k:'fix',o:f}); if(V.z>=45) lab(f.n,x+6,y+3,'#9A1E68','500 9px IBM Plex Mono, monospace',4); });
  drawNotes(g,cx,cy,zx,zy,vis);
  // etiketter med halo
  g.textBaseline='alphabetic'; const taken=[]; R.pts.forEach(p=>{ if(p.la!=null){ const x=cx+(p.lo-V.lo)*zx, y=cy-(p.la-V.la)*zy; taken.push([x+6,y-20,x+70,y-4]); } }); labels.sort((a,b)=>b[5]-a[5]).forEach(([t,x,y,c,f])=>{ g.font=f; const wd=g.measureText(t).width; const bx=[x-1,y-9,x+wd+1,y+2]; if(taken.some(q=>!(bx[2]<q[0]||bx[0]>q[2]||bx[3]<q[1]||bx[1]>q[3]))) return; taken.push(bx); g.lineWidth=3; g.strokeStyle='rgba(246,244,238,.9)'; g.strokeText(t,x,y); g.fillStyle=c; g.fillText(t,x,y); });
  // ruten
  const P=R.pts.filter(p=>p.la!=null); if(P.length){ g.beginPath(); P.forEach((p,i)=>{ const x=cx+(p.lo-V.lo)*zx, y=cy-(p.la-V.la)*zy; i?g.lineTo(x,y):g.moveTo(x,y); }); g.strokeStyle='rgba(255,255,255,.85)'; g.lineWidth=6; g.lineJoin='round'; g.stroke(); g.strokeStyle='#9A1E68'; g.lineWidth=2.6; g.stroke();
    R.pts.forEach((p,i)=>{ if(p.la==null) return; const x=cx+(p.lo-V.lo)*zx, y=cy-(p.la-V.la)*zy; g.beginPath(); g.arc(x,y,i===selI?6:4.5,0,7); g.fillStyle=i===selI?'#9A1E68':'#fff'; g.fill(); g.strokeStyle='#9A1E68'; g.lineWidth=2; g.stroke();
      g.font='700 12px Public Sans, sans-serif'; g.lineWidth=3.5; g.strokeStyle='#fff'; g.strokeText(p.n||'',x+8,y-8); g.fillStyle='#7A1652'; g.fillText(p.n||'',x+8,y-8); }); }
  { const M0=compute(), cr=crit(M0), q=cr&&M0.posAt(cr.x); if(q&&q.la!=null){ const x=cx+(q.lo-V.lo)*zx, y=cy-(q.la-V.la)*zy, col=cr.m!=null&&cr.m<0?'#B3261E':cr.m!=null&&cr.m<(+S('mg')||1000)?'#B86E00':'#13202A'; g.beginPath(); g.moveTo(x,y-9); g.lineTo(x+7,y+3); g.lineTo(x-7,y+3); g.closePath(); g.fillStyle='#fff'; g.fill(); g.strokeStyle=col; g.lineWidth=2; g.stroke(); g.font='700 11px IBM Plex Mono, monospace'; const t=cr.m==null? fx(Math.round(cr.t))+' ft' : (cr.m<0?'−':'')+fx(Math.abs(Math.round(cr.m/10)*10))+' ft'; g.lineWidth=3; g.strokeStyle='#fff'; g.strokeText(t,x+10,y-6); g.fillStyle=col; g.fillText(t,x+10,y-6); } }
  if(HOV!=null){ const M=compute(), q=M.posAt(HOV); if(q&&q.la!=null){ const x=cx+(q.lo-V.lo)*zx, y=cy-(q.la-V.la)*zy; g.beginPath(); g.arc(x,y,7,0,7); g.fillStyle='rgba(29,78,158,.18)'; g.fill(); g.strokeStyle='#1D4E9E'; g.lineWidth=2; g.stroke(); g.font='600 11px IBM Plex Mono, monospace'; g.lineWidth=3; g.strokeStyle='#fff'; const t=fx(HOV,1)+' NM'+(M.PM==='ter'?'':' · '+altTxt(Math.round(M.altAt(HOV)/10)*10)); g.strokeText(t,x+10,y+16); g.fillStyle='#1D4E9E'; g.fillText(t,x+10,y+16); } }
}
function fit(){ const P=R.pts.filter(p=>p.la!=null); if(!P.length) return; let a0=90,a1=-90,o0=180,o1=-180; P.forEach(p=>{ a0=Math.min(a0,p.la); a1=Math.max(a1,p.la); o0=Math.min(o0,p.lo); o1=Math.max(o1,p.lo); });
  if(ML){ mlFit(a0,a1,o0,o1); return; }
  V.la=(a0+a1)/2; V.lo=(o0+o1)/2; const k=Math.cos(V.la*D2R); const w=mapEl.clientWidth, h=mapEl.clientHeight; const top=w<900?120:70, bot=shTarget(h), vh=Math.max(120,h-top-bot), lp=rcPad();
  V.z=Math.max(4,Math.min(400,Math.min((vh-70)/Math.max(0.05,a1-a0),(w-90-lp)/Math.max(0.05,(o1-o0)*k)))); const ty=top+vh/2; V.la=(a0+a1)/2+(ty-h/2)/V.z; V.lo=(o0+o1)/2-(lp/2)/(k*V.z); drawMap(); }
function rcPad(){ const c=el('rcard'); if(!c||window.innerWidth<=900||!c.offsetWidth) return 0; return c.offsetLeft+c.offsetWidth+12; } // map space the route card covers on the left
function shTarget(h){ const sh=el('sheet'); if(!sh) return 0; const s=sh.dataset.s; if(window.innerWidth<=900){ const c=el('rcard'); return c?Math.min(h*0.4,c.offsetHeight):0; } return s==='off'?0:s==='min'?(sh.offsetHeight||112):s==='full'?0:h*(window.innerHeight<=820?0.38:0.44); }
let drag=null, moved=false; const ptrs=new Map();
let ptDrag=null;
function routePtAt(mx,my){ let bi=-1, bd=10; R.pts.forEach((p,i)=>{ if(p.la==null) return; const [x,y]=prj(p.la,p.lo); const d=Math.hypot(x-mx,y-my); if(d<bd){ bd=d; bi=i; } }); return bi; }
function snapAt(mx,my){ if(ML){ const h=mlHit(mx,my,14); return h&&h.k==='oa'&&(h.o.kind==='ob'||h.o.kind==='hs')?null:h; } let best=null, bd=14; hits.forEach(h=>{ const d=Math.hypot(h.x-mx,h.y-my); if(d<bd){ bd=d; best=h; } }); return best; }
function snapPt(h){ const o=h.o; if(h.k==='ap') return {n:o[0],t:'rwy',la:o[2],lo:o[3],elev:o[4]}; if(h.k==='nv') return {n:o[0],t:'wpt',la:o[4],lo:o[5],note:o[2]+(o[3]?' '+o[3]:'')}; if(h.k==='aip') return {n:o[0],t:'wpt',la:o[1],lo:o[2],note:'AIP '+o[3]}; return {n:o.n,t:'wpt',la:o.la,lo:o.lo}; }
mapEl.addEventListener('pointerdown',e=>{ if(e.target.closest('.mapctl,.mappop,.newpt,.edbar,.ptpop,.maplibregl-ctrl')) return; if(ML&&(e.button>0||T3.dvOn)) return; if(!pickMode&&ptrs.size===0){ const r=mapEl.getBoundingClientRect(); const i=routePtAt(e.clientX-r.left,e.clientY-r.top); if(i>=0){ mapEl.setPointerCapture(e.pointerId); ptDrag={i,x:e.clientX,y:e.clientY,moved:false,snap:null,orig:Object.assign({},R.pts[i])}; mlHold(true); closePop(); return; }
    const lg=legAt(e.clientX-r.left,e.clientY-r.top,e.pointerType==='touch'?14:8); if(lg>0){ const [la,lo]=inv(e.clientX-r.left,e.clientY-r.top); const np={n:'',t:'wpt',la,lo,src:1}; R.pts.splice(lg,0,np); mapEl.setPointerCapture(e.pointerId); ptDrag={i:lg,x:e.clientX,y:e.clientY,moved:false,snap:null,ins:true,orig:Object.assign({},np)}; mlHold(true); closePop(); return; } }
  if(ML) return;
  mapEl.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,[e.clientX,e.clientY]); drag={x:e.clientX,y:e.clientY,la:V.la,lo:V.lo,z:V.z,d:ptrs.size===2?dist2():null}; moved=false; mapEl.style.cursor='grabbing'; });
function dist2(){ const [a,b]=[...ptrs.values()]; return Math.hypot(a[0]-b[0],a[1]-b[1]); }
mapEl.addEventListener('pointermove',e=>{ if(ptDrag){ if(Math.abs(e.clientX-ptDrag.x)+Math.abs(e.clientY-ptDrag.y)>3) ptDrag.moved=true; if(!ptDrag.moved) return; const r=mapEl.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top; const p=R.pts[ptDrag.i]; const sn=snapAt(mx,my); ptDrag.snap=sn; const [la,lo]=sn?[sn.k==='ap'?sn.o[2]:sn.k==='nv'?sn.o[4]:sn.k==='aip'?sn.o[1]:sn.o.la, sn.k==='ap'?sn.o[3]:sn.k==='nv'?sn.o[5]:sn.k==='aip'?sn.o[2]:sn.o.lo]:inv(mx,my); p.la=la; p.lo=lo; drawMapNow(); if(sn&&!ML){ const [x,y]=prj(la,lo); const g=mx_; g.beginPath(); g.arc(x,y,10,0,7); g.strokeStyle='#1D4E9E'; g.lineWidth=2; g.stroke(); g.font='600 12px Public Sans, sans-serif'; g.fillStyle='#1D4E9E'; g.fillText(snapPt(sn).n,x+12,y+16); } return; }
  if(!drag||!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptrs.size===2){ if(!drag.d){ drag.d=dist2(); drag.z=V.z; } V.z=Math.max(3,Math.min(600,drag.z*dist2()/drag.d)); moved=true; drawMap(); return; }
  const dx=e.clientX-drag.x, dy=e.clientY-drag.y; if(Math.abs(dx)+Math.abs(dy)>3) moved=true; V.la=drag.la+dy/V.z; V.lo=drag.lo-dx/(V.z*Math.cos(V.la*D2R)); drawMap(); });
const up=e=>{ if(ptDrag){ const d=ptDrag; ptDrag=null; mlHold(false); mlClickT=Date.now(); if(!d.moved){ if(d.ins){ R.pts.splice(d.i,1); drawMap(); mapClick(e); return; } selI=d.i; render(); return; } const p=R.pts[d.i];
    if(d.snap){ const q=snapPt(d.snap); const keepT=['iaf','if','hold','faf','sid'].includes(d.orig.t)?d.orig.t:null; Object.keys(p).forEach(k=>{ if(!['a','d','ter','app'].includes(k)) delete p[k]; }); Object.assign(p,q); if(keepT) p.t=keepT; if(p.t==='rwy'&&d.i!==0&&d.i!==R.pts.length-1) p.t='wpt'; }
    else { p.la=+p.la.toFixed(5); p.lo=+p.lo.toFixed(5); if(d.orig.src||!/^WPT\d+$/.test(p.n||'')){ const n=R.pts.filter(x=>/^WPT\d+$/.test(x.n||'')).length+1; p.n='WPT'+n; } delete p.src; delete p.miss; if(p.t==='rwy') p.t='wpt'; p.note=''; }
    R.rt=''; selI=d.i; render(); queueSave(); return; }
  ptrs.delete(e.pointerId); if(!ptrs.size){ mapEl.style.cursor=''; if(drag&&!moved) mapClick(e); drag=null; } else if(drag){ drag.d=null; } };
mapEl.addEventListener('pointerup',up); mapEl.addEventListener('pointercancel',e=>{ ptrs.delete(e.pointerId); drag=null; if(ptDrag){ mlHold(false); if(ptDrag.ins) R.pts.splice(ptDrag.i,1); else Object.assign(R.pts[ptDrag.i],ptDrag.orig); ptDrag=null; drawMap(); } });
mapEl.addEventListener('wheel',e=>{ if(ML) return; e.preventDefault(); const r=mapEl.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top; const [la,lo]=inv(mx,my); V.z=Math.max(3,Math.min(600,V.z*(e.deltaY<0?1.2:1/1.2))); const [la2,lo2]=inv(mx,my); V.la+=la-la2; V.lo+=lo-lo2; drawMap(); },{passive:false});
/* Reset map: base map, relief, layers, 2D, camera, 3D settings, profile mode and the view back to their defaults.
   The route, fixes and notes are kept; clearing the route is a separate, confirmed action offered in the note. */
async function resetMap(){ if(T3.on){ T3.play=false; await set3(false); }
  MM='vfr'; BM='vfr'; LY=Object.assign({},LYD.vfr); saveLY();
  T3.ex=1.2; el('x3exs').value='1.2'; el('x3lt').value='315'; T3.cm='ov'; camUI(); lookHome(); HOV=null;
  if(ML){ RXMAP.setBasemap(ML,'vfr'); RXMAP.setLight(ML,315); MLK.ly=''; if(LY.ct) RXMAP.addContours(ML).then(()=>{ MLK.ly=''; drawMap(); }); }
  bmUI(); lyUI(); if(R){ delete R.pm; pmUI(); render(); queueSave(); }
  if(R&&R.pts.filter(p=>p.la!=null).length) fit();
  else if(ML){ MLV={la:60,lo:10,z:22}; V={la:60,lo:10,z:22}; ML.easeTo({center:[10,60],zoom:mlZ(22,60),pitch:0,bearing:0,duration:600}); }
  else { V={lo:10,la:60,z:22}; drawMap(); }
  let n=mapEl.querySelector('.rxnote'); if(n) n.remove(); n=document.createElement('div'); n.className='bb-satnote rxnote'; n.setAttribute('role','status');
  n.innerHTML=L({en:'Map reset. Your route and fixes are kept.',no:'Kartet er tilbakestilt. Ruten og fixene dine er beholdt.'})+(R&&R.pts.length?` <button type="button" class="rxclr">${L({en:'Clear route…',no:'Tøm ruten …'})}</button>`:'')+' <button type="button" class="x" aria-label="'+L({en:'Close',no:'Lukk'})+'">×</button>';
  mapEl.appendChild(n); const t=setTimeout(()=>n.remove(),9000); n.querySelector('.x').onclick=()=>{ clearTimeout(t); n.remove(); };
  const c=n.querySelector('.rxclr'); if(c) c.onclick=()=>{ if(!window.confirm(L({en:'Clear all points in this route? This cannot be undone here.',no:'Fjerne alle punktene i ruten? Dette kan ikke angres her.'}))) return; R.pts=[]; el('rtxt').value=''; render(); queueSave(); clearTimeout(t); n.remove(); }; }
el('zreset').onclick=()=>{ resetMap(); };
el('zin').onclick=()=>{ if(ML) return ML.zoomIn(); V.z=Math.min(600,V.z*1.4); drawMap(); }; el('zout').onclick=()=>{ if(ML) return ML.zoomOut(); V.z=Math.max(3,V.z/1.4); drawMap(); }; el('zfit').onclick=fit;
let pop=null; function closePop(){ if(pop){ pop.remove(); pop=null; } }
function mapClick(e){ closePop(); const r=mapEl.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top;
  if(pickMode){ const [la,lo]=inv(mx,my); el('f_c').value=llTxt(la,lo); pickMode=false; mapEl.classList.remove('pick'); el('f_msg').textContent=L({en:'Position picked. Add a name and save.',no:'Posisjon valgt. Gi den et navn og lagre.'}); return; }
  let best=null, bd=12; if(ML) best=mlHit(mx,my,12); else hits.forEach(h=>{ const d=Math.hypot(h.x-mx,h.y-my); if(d<bd){ bd=d; best=h; } }); if(!best){ const [la,lo]=inv(mx,my); if(ML&&LY.ntm){ const nt=RXMAP.notamAt(ML,mx,my); if(nt.length){ ntmInfo(nt,mx,my,{la,lo}); return; } } if(ML&&LY.sig){ const sg=RXMAP.sigmetAt(ML,mx,my); if(sg.length){ sigInfo(sg,mx,my,{la,lo}); return; } } newPointBox(mapEl,mx,my,{la,lo},null); return; }
  if(best.k==='note'){ noteInfo(best.o); return; }
  showInfo(best); return;
  const o=best.o; let n,t,info,pt;
  if(best.k==='ap'){ n=o[0]; info=`${esc(o[1])}<br>${fx(o[4])} ft${o[6]&&o[6].length?' · RWY '+o[6].map(r=>r[0]+'/'+r[1]).join(', '):''}`; pt={n,t:'rwy',la:o[2],lo:o[3],elev:o[4]}; }
  else if(best.k==='nv'){ n=o[0]; info=`${esc(o[1])} ${o[2]} ${o[3]||''}`; pt={n,t:'wpt',la:o[4],lo:o[5],note:o[2]+(o[3]?' '+o[3]:'')}; }
  else if(best.k==='aip'){ n=o[0]; info=`${L({en:'IFR point',no:'IFR-punkt'})} · AIP ${o[3]}`; pt={n,t:'wpt',la:o[1],lo:o[2],note:'AIP '+o[3]}; }
  else { n=o.n; info=esc(o.note||L({en:'My fix',no:'Min fix'})); pt={n,t:'wpt',la:o.la,lo:o.lo}; }
  pop=document.createElement('div'); pop.className='mappop'; pop.style.left=Math.min(mx+10,mapEl.clientWidth-250)+'px'; pop.style.top=Math.min(my+10,mapEl.clientHeight-120)+'px';
  pop.innerHTML=`<b>${esc(n)}</b><span>${info}</span><br><span class="note">${llTxt(pt.la,pt.lo)}</span><div><button class="btn pri" data-a="add">${L({en:'Add to route',no:'Legg til i ruten'})}</button> <button class="btn" data-a="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button></div>`;
  pop.addEventListener('pointerdown',ev=>ev.stopPropagation());
  pop.onclick=ev=>{ const a=ev.target.dataset.a; if(a==='add'){ addPoint(pt); } closePop(); }; mapEl.appendChild(pop); }
function addPoint(pt){ // før siste innflygingspunkt / destinasjon
  const A=R.pts; let at=A.length; const firstApp=A.findIndex(p=>p.app||p.t==='iaf'); const lastR=(()=>{ for(let i=A.length-1;i>0;i--) if(A[i].t==='rwy') return i; return -1; })();
  if(selI>=0&&selI<A.length) at=selI+1; else if(firstApp>0) at=firstApp; else if(lastR>0) at=lastR;
  if(!A.length) pt.t=pt.t==='rwy'?'rwy':'wpt'; else if(pt.t==='rwy'&&at<A.length) pt.t='wpt';
  A.splice(at,0,pt); selI=at; render(); queueSave(); }
window.addEventListener('resize',()=>drawMap());

/* ---------- nytt punkt: kart eller profil ---------- */
function legAt(mx,my,tol){ const A=R.pts; let bi=-1, bd=tol; for(let i=1;i<A.length;i++){ const a=A[i-1], b=A[i]; if(a.la==null||b.la==null||['missed','alt'].includes(b.t)) continue; const [ax,ay]=prj(a.la,a.lo), [bx,by]=prj(b.la,b.lo); const vx=bx-ax, vy=by-ay, L2=vx*vx+vy*vy; if(L2<400) continue; const t=((mx-ax)*vx+(my-ay)*vy)/L2; if(t<0.08||t>0.92) continue; const d=Math.hypot(ax+vx*t-mx,ay+vy*t-my); if(d<bd){ bd=d; bi=i; } } return bi; }
mapEl.addEventListener('pointermove',rafT(e=>{ if(ptDrag||drag||e.pointerType==='touch') return; if(ML&&(e.buttons||ML.isMoving())) return; const r=mapEl.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top; const c= routePtAt(mx,my)>=0? 'move' : legAt(mx,my,8)>0? 'copy' : ML&&mlHit(mx,my,10)? 'pointer' : ''; const t=ML?ML.getCanvasContainer():mapEl; if(t.style.cursor!==c) t.style.cursor=c; }),{passive:true});
function nearestLeg(la,lo){ const A=R.pts; let bi=-1, bd=1e9; for(let i=1;i<A.length;i++){ const a=A[i-1], b=A[i]; if(a.la==null||b.la==null) continue; const [ax,ay]=prj(a.la,a.lo), [bx,by]=prj(b.la,b.lo), [px,py]=prj(la,lo); const vx=bx-ax, vy=by-ay, t=Math.max(0,Math.min(1,((px-ax)*vx+(py-ay)*vy)/Math.max(1e-6,vx*vx+vy*vy))); const d=Math.hypot(ax+vx*t-px,ay+vy*t-py); if(d<bd){ bd=d; bi=i; } } return bi; }
let npBox=null;
/* forecast cloud layers at a point (cloudcol.js): in the airport panel on request, and from "Clouds here" on the map */
function cloudTime(){ return (WA.res&&WA.res.time)||BBWIND.hourIso(waEtd()); }
async function cloudFill(box,la,lo,elev){ if(!box||box.dataset.done) return; box.dataset.done='1'; box.innerHTML=`<p class="src">${L({en:'Fetching the forecast…',no:'Henter prognosen …'})}</p>`;
  try{ const d=await BBCLOUD.at(la,lo,cloudTime()); box.innerHTML=BBCLOUD.html(d,LAB.lang==='no',elev); }
  catch(e){ delete box.dataset.done; box.innerHTML=`<p class="src">${L({en:'The forecast model could not be fetched right now. Try again in a few minutes.',no:'Prognosemodellen kunne ikke hentes nå. Prøv igjen om noen minutter.'})}</p>`; } }
function cloudWire(sd){ const d=sd.querySelector('details.mclw'); if(!d) return; d.addEventListener('toggle',()=>{ if(d.open) cloudFill(d.querySelector('.mcl'),+d.dataset.la,+d.dataset.lo,d.dataset.el!==''?+d.dataset.el:null); }); }
function cloudPanel(la,lo){ const sd=el('side'); sd.innerHTML=`<button class="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button><span class="id">${L({en:'FORECAST',no:'PROGNOSE'})}</span><h3>${L({en:'Clouds here',no:'Skyer her'})}</h3><p class="src" style="margin-top:4px">${llTxt(la,lo)}</p><div class="mcl"></div>`;
  sd.hidden=false; sd.onclick=e=>{ if(e.target.closest('button.x')) sd.hidden=true; }; cloudFill(sd.querySelector('.mcl'),la,lo,null); }
function newPointBox(host,x,y,pos,dist){ if(npBox) npBox.remove(); closePop();
  const n=R.pts.filter(p=>/^WPT\d+$/.test(p.n||'')).length+1;
  const b=document.createElement('div'); b.className='newpt'; b.style.left=Math.max(4,Math.min(x+8,host.clientWidth-240))+'px'; b.style.top=Math.max(4,Math.min(y+8,host.clientHeight-170))+'px';
  b.innerHTML=`<b>${L({en:'New fix here',no:'Ny fix her'})}</b>${pos&&pos.la!=null?`<span class="note">${llTxt(pos.la,pos.lo)}</span>`:''}<input type="text" value="WPT${n}" aria-label="Name"><label class="chk"><input type="checkbox" checked> ${L({en:'Also save to my fixes',no:'Lagre også under mine fixes'})}</label><div class="row"><button class="btn pri" data-a="ok">${L({en:'Add to route',no:'Legg til i ruten'})}</button>${pos&&pos.la!=null&&dist==null?`<button class="btn" data-a="note">${L({en:'Note',no:'Notat'})}</button>`:''}${pos&&pos.la!=null&&dist==null?`<button class="btn" data-a="cl">${L({en:'Clouds here',no:'Skyer her'})}</button>`:''}<button class="btn" data-a="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button></div>`;
  b.addEventListener('pointerdown',e=>e.stopPropagation()); b.addEventListener('pointerup',e=>e.stopPropagation());
  const inp=b.querySelector('input[type=text]'); const go=async()=>{ const name=inp.value.trim().toUpperCase()||('WPT'+n); const save=b.querySelector('input[type=checkbox]').checked;
    const pt={n:name,t:'wpt'}; if(pos&&pos.la!=null){ pt.la=+pos.la.toFixed(5); pt.lo=+pos.lo.toFixed(5); }
    if(dist!=null) insertAtDist(pt,dist); else { const i=nearestLeg(pt.la,pt.lo); if(i>0){ R.pts.splice(i,0,pt); selI=i; } else addPoint(pt); }
    if(save&&pt.la!=null){ upsertFix(name,pt.la,pt.lo,''); await saveFix(); }
    b.remove(); npBox=null; render(); queueSave(); };
  b.querySelector('[data-a=ok]').onclick=go; inp.addEventListener('keydown',e=>{ if(e.key==='Enter') go(); if(e.key==='Escape'){ b.remove(); npBox=null; } });
  b.querySelector('[data-a=x]').onclick=()=>{ b.remove(); npBox=null; };
  { const nb=b.querySelector('[data-a=note]'); if(nb) nb.onclick=()=>{ b.remove(); npBox=null; newNote(pos.la,pos.lo); }; }
  { const cb=b.querySelector('[data-a=cl]'); if(cb) cb.onclick=()=>{ b.remove(); npBox=null; cloudPanel(pos.la,pos.lo); }; }
  host.appendChild(b); npBox=b; setTimeout(()=>{ inp.focus(); inp.select(); },0); }
function insertAtDist(pt,dist){ const M=compute(); let i=M.C.findIndex(c=>c.x>=dist); if(i<=0) i=M.C.length-1; const prev=M.C[i-1], next=M.C[i];
  const inApp=next.app||prev.p.t==='da'||next.p.t==='iaf'&&false; const both=pt.la!=null&&prev.p.la!=null&&next.p.la!=null;
  if(!both||pnum(next.p.d)!=null){ pt.d=String(Math.round((dist-prev.x)*10)/10); if(pnum(next.p.d)!=null) next.p.d=String(Math.max(0,Math.round((pnum(next.p.d)-(dist-prev.x))*10)/10)); }
  if(next.app){ pt.a=String(Math.round(M.altAt(dist)/100)*100); pt.app=1; }
  R.pts.splice(i,0,pt); selI=i; }
el('profw').addEventListener('click',e=>{ if(justDragged||T3.on) return; if(compute().PM!=='adv') return; // in 3D a click on the profile moves the aircraft instead if(!psv.contains(e.target)||e.target.closest('.mk')) return; const r=psv.getBoundingClientRect(); const vx=(e.clientX-r.left)/r.width*(psv._W0||1000), vy=(e.clientY-r.top)/r.height*(psv._H0||420); const bx=psv._box; if(!bx||vx<bx[0]-6||vx>bx[0]+bx[2]+6||vy<bx[1]-10||vy>bx[1]+bx[3]+4) return; const M=compute(); if(M.C.length<2) return; const dist=Math.max(0,Math.min(M.total,psv._XI(vx))); const pos=M.posAt(dist);
  const hx=e.clientX-el('profw').getBoundingClientRect().left, hy=e.clientY-el('profw').getBoundingClientRect().top;
  if(MKT==='fix'){ newPointBox(el('profw'),hx,hy,pos,Math.max(0.1,Math.min(M.total-0.1,dist))); return; }
  const onLine=e.target.classList.contains('fpath')||(e.target.classList.contains('fhit')&&!e.target.classList.contains('phit'))? r100(M.altAt(dist)) : r100(psv._YI(vy));
  const m={t:MKT,x:Math.round(dist*10)/10,a:['toc','tod','lvl'].includes(MKT)?r100(M.altAt(dist)):onLine}; if(MKT==='cr') m.k='above'; if(MKT==='note'){ m.a=onLine; }
  R.mk=R.mk||[]; R.mk.push(m); render(); queueSave(); mkEdit(m,hx,hy); });

/* ---------- mine fixes ---------- */
async function loadFix(){ const l=await NSTORE.list('fixes'); FIX=(l[0]&&l[0].list)||[]; drawFix(); }
async function saveFix(){ await NSTORE.put('fixes',{id:'mine',list:FIX}); drawFix(); drawMap(); }
function drawFix(){ el('f_list').innerHTML= FIX.length? FIX.slice().sort((a,b)=>a.n.localeCompare(b.n)).map(f=>`<div><span><b>${esc(f.n)}</b> <span class="note">${llTxt(f.la,f.lo)}${f.note?' · '+esc(f.note):''}</span></span><span><button data-go="${esc(f.n)}" title="Show">◎</button><button data-rm="${esc(f.n)}" aria-label="Delete">✕</button></span></div>`).join('') : `<p class="note">${L({en:'No fixes saved yet.',no:'Ingen fixes lagret ennå.'})}</p>`; }
el('f_list').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(b.dataset.rm){ FIX=FIX.filter(f=>f.n!==b.dataset.rm); saveFix(); } else { const f=FIX.find(x=>x.n===b.dataset.go); if(f){ V.la=f.la; V.lo=f.lo; V.z=Math.max(V.z,90); drawMap(); } } });
function upsertFix(n,la,lo,note){ n=n.toUpperCase().trim(); const i=FIX.findIndex(f=>f.n===n); const f={n,la:+la.toFixed(6),lo:+lo.toFixed(6),note:note||''}; if(i>=0) FIX[i]=f; else FIX.push(f); }
el('f_add').onclick=async()=>{ const n=el('f_n').value.trim(), ll=parseLL(el('f_c').value); if(!n){ el('f_msg').textContent=L({en:'Give the fix a name.',no:'Gi fixen et navn.'}); return; } if(!llOk(ll)){ el('f_msg').textContent=L({en:'Could not read the coordinates. Try 593412N 0104523E or 59.57, 10.76.',no:'Fikk ikke lest koordinatene. Prøv 593412N 0104523E eller 59.57, 10.76.'}); return; }
  upsertFix(n,ll[0],ll[1],el('f_note').value.trim()); await saveFix(); el('f_msg').textContent=L({en:'Saved ',no:'Lagret '})+n.toUpperCase(); el('f_n').value=el('f_c').value=el('f_note').value=''; };
el('f_pick').onclick=()=>{ pickMode=true; mapEl.classList.add('pick'); el('f_msg').textContent=L({en:'Click the position on the map.',no:'Klikk posisjonen på kartet.'}); };
el('f_parse').onclick=async()=>{ const list=parseList(el('f_paste').value); if(!list.length){ el('f_found').innerHTML=`<span class="note">${L({en:'No name + coordinate pairs found. One fix per line: NAME 593412N 0104523E',no:'Fant ingen navn + koordinat. Én fix per linje: NAVN 593412N 0104523E'})}</span>`; return; } showFound(list,L({en:'Read from your list',no:'Lest fra listen din'})); };
NAI.onMode(m=>document.body.classList.toggle('ai-on',!!m));
el('f_ai').onclick=async()=>{ const fs=[...el('f_img').files]; if(!fs.length){ el('f_found').innerHTML=`<span class="note">${L({en:'Choose a photo or screenshot of the chart first.',no:'Velg et bilde eller skjermbilde av kartet først.'})}</span>`; return; }
  await NAI.probe(); if(!NAI.mode){ el('f_found').innerHTML=`<span class="note">${L({en:'Flight Intelligence is not switched on here.',no:'Flight Intelligence er ikke slått på her.'})}</span>`; return; }
  el('f_ai').disabled=true; el('f_found').innerHTML=`<span class="note">${L({en:'Reading the chart…',no:'Leser kartet…'})}</span>`;
  try{ const imgs=[]; for(const f of fs.slice(0,3)) imgs.push(await shrink(f));
    const r=await NAI.json(`List every named fix, waypoint, navaid or reporting point on this aeronautical chart that has its coordinates printed. Copy the coordinates exactly as printed and convert them to decimal degrees (WGS84, south and west negative). Do not guess coordinates that are not printed. Reply with only JSON: {"fixes":[{"n":"NAME","lat":number,"lon":number,"printed":"coordinates as printed"}]}`,{tier:'default',images:imgs});
    const list=(r&&r.fixes||[]).filter(f=>f&&f.n&&Number.isFinite(+f.lat)&&Number.isFinite(+f.lon)).map(f=>({n:String(f.n).toUpperCase(),la:+f.lat,lo:+f.lon,pr:f.printed||''}));
    if(!list.length) el('f_found').innerHTML=`<span class="note">${L({en:'No coordinates found on the chart.',no:'Fant ingen koordinater på kartet.'})}</span>`; else showFound(list,L({en:'Found on the chart. Check each one against the chart before you save it.',no:'Funnet på kartet. Sjekk hver enkelt mot kartet før du lagrer.'}));
  }catch(e){ el('f_found').innerHTML=`<span class="note">${esc(NAI.errText(e))}</span>`; NAI.fatal(e); } finally{ el('f_ai').disabled=false; } };
async function shrink(file){ const u=URL.createObjectURL(file); const img=new Image(); await new Promise(r=>{ img.onload=r; img.onerror=r; img.src=u; }); const s=Math.min(1,1800/Math.max(img.naturalWidth||1,img.naturalHeight||1)); const c=document.createElement('canvas'); c.width=Math.round((img.naturalWidth||1)*s); c.height=Math.round((img.naturalHeight||1)*s); const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(u); return await new Promise(r=>c.toBlob(r,'image/jpeg',0.85)); }
let FOUND=[];
function showFound(list,head){ FOUND=list; el('f_found').innerHTML=`<span class="note">${esc(head)}</span>`+list.map((f,i)=>`<label class="chk"><input type="checkbox" data-fi="${i}" checked> <b>${esc(f.n)}</b> ${llTxt(f.la,f.lo)}${f.pr?' <span class="note">('+esc(f.pr)+')</span>':''}</label>`).join('')+`<div><button class="btn pri" id="f_save">${L({en:'Save the checked fixes',no:'Lagre de avkryssede'})}</button></div>`;
  el('f_save').onclick=async()=>{ let n=0; el('f_found').querySelectorAll('[data-fi]').forEach(c=>{ if(c.checked){ const f=FOUND[+c.dataset.fi]; upsertFix(f.n,f.la,f.lo,f.pr?'chart':'' ); n++; } }); await saveFix(); el('f_found').innerHTML=`<span class="note">${L({en:'Saved',no:'Lagret'})} ${n}.</span>`; }; }

/* ---------- send til briefingpakken ---------- */
let PACKS=[];
async function loadPacks(){ PACKS=await NSTORE.list('prep'); setTimeout(flowDraw,0); el('packs').innerHTML=`<option value="">${L({en:'New briefing pack',no:'Ny briefingpakke'})}</option>`+PACKS.map(p=>`<option value="${p.id}">${esc(p.title||[p.f&&p.f.depapt,p.f&&p.f.destapt].filter(Boolean).join(' – ')||L({en:'Briefing pack',no:'Briefingpakke'}))}</option>`).join(''); if(PACKS[0]) el('packs').value=PACKS[0].id; }
async function sendRoute(silent){ if(MODE==='draw') return silent?null:sendDraw(); const M=compute(); if(M.C.length<2){ if(!silent) el('sendnote').textContent=L({en:'Build a route first.',no:'Bygg en rute først.'}); return; }
  let P=PACKS.find(p=>p.id===el('packs').value);
  if(!P){ P={hide:['check'],id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),title:'',created:Date.now(),f:{'rf.to':'1.25','rf.ld':'1.43','fu.unit':'US gal','mb.dens':'3.03','rules':'IFR','purpose':'Training flight'},sk:[]}; }
  // profilpunkter med TOC/TOD
  const evs=M.C.map(c=>({x:c.x,n:c.p.n,t:c.p.t,a:c.tgt,note:c.p.note||'',i:c.i})); const MKs=R.mk||[]; if(M.toc&&!MKs.some(m=>m.t==='toc')) evs.push({x:M.toc.x,n:'TOC',t:'toc',a:M.toc.a,note:L({en:'calculated',no:'beregnet'})}); if(M.tod&&!MKs.some(m=>m.t==='tod')) evs.push({x:M.tod.x,n:'TOD',t:'tod',a:M.tod.a,note:L({en:'calculated',no:'beregnet'})});
  MKs.forEach(m=>{ if(m.x==null) return; const t=['toc','tod','hold','faf','da'].includes(m.t)?m.t:'wpt'; evs.push({x:m.x,n:m.t==='note'?(m.s||L({en:'Note',no:'Notat'})):mkName(m),t,a:m.a!=null?m.a:M.altAt(m.x),note:[m.t==='cr'?mkText(m):'',m.t==='note'?'':(m.s&&m.t==='cr'?m.s:''),L({en:'your marker',no:'din markør'})].filter(Boolean).join(' · ')}); });
  const main=evs.filter(e=>e.t!=='missed'&&e.t!=='alt').sort((a,b)=>a.x-b.x), side=evs.filter(e=>e.t==='missed'||e.t==='alt');
  const ordered=[]; let px=0; main.forEach(e=>{ ordered.push(e); }); side.forEach(e=>ordered.push(e));
  const mg=+S('mg')||1000;
  const pts=[]; let prevX=0, lastMainX=0; ordered.forEach((e,k)=>{ let d; if(e.t==='missed'||e.t==='alt'){ const c=M.C[e.i]; d=c.d; } else { d=k?e.x-prevX:0; prevX=e.x; }
    let ter=''; if(e.i!=null&&e.i>0){ const te=legTer(M,e.i)??pnum(M.C[e.i].p.ter); if(te!=null) ter=String(Math.round(te)); }
    pts.push({n:e.n||'',t:e.t,d:Math.round(d*10)/10,a:Math.round(e.a),note:e.note,ter}); });
  PACKDIM=true; drawProfile(M,TP); PACKDIM=false; const snap=psv.cloneNode(true); setTimeout(()=>drawProfile(compute(),TP),0); snap.querySelectorAll('.fhit,.noprint').forEach(e=>e.remove());
  // route briefing that goes with the profile: SIGMET/AIRMET on the route, airspace crossed, winds/cloud/icing/turbulence, NOTAM, aerodromes along the route
  const bh=(id,n)=>{ const b=el(id); if(!b||b.hidden||!b.innerHTML.trim()) return ''; const c=b.cloneNode(true); c.querySelectorAll('button,input,select,script,.noprint').forEach(e=>e.remove()); return c.innerHTML; };
  const brief={sw:bh('swl'),as:bh('asl'),wa:bh('wat')?'<table class="tb wat">'+bh('wat')+'</table>'+(el('wanote')&&el('wanote').textContent?'<p class="note">'+esc(el('wanote').textContent)+'</p>':''):'',ntm:bh('ntmmsg'),nr:bh('nrt')?'<table class="tb nrt">'+bh('nrt')+'</table>':''};
  try{ brief.d=goData(M); }catch(e){}
  P.xs={pts,zoom:R.zoom!==false,svg:snap.innerHTML,route:R.id,wx:R.wx||'',gs:R.gs||'',at:Date.now(),brief};
  const f=P.f; const firstR=M.C[0].p, lastR=[...M.C].reverse().find(c=>c.p.t==='rwy'&&c.i>0);
  if(firstR.t==='rwy'&&!f.depapt) f.depapt=firstR.n; if(lastR&&!f.destapt) f.destapt=lastR.p.n;
  [['x.msa','msa'],['x.frz','frz'],['x.cb','cb'],['x.ct','ct']].forEach(([a,b])=>{ if(S(b)) f[a]=S(b); }); if(S('cr')) f['x.alt']=S('cr');
  if(el('sendnl').checked){ for(let i=0;i<10;i++) ['f','t','msa','alt','tt','d','var','tas','w'].forEach(k=>delete f['nl.'+i+'.'+k]); const tasN=pnum(R.gs), NLs=R.nl||{};
    let r=0; M.C.forEach((c,i)=>{ if(!i||r>=10||c.app||['missed','alt','hold'].includes(c.p.t)||c.d<0.05) return; const q=M.C[i-1].p, p=c.p; f['nl.'+r+'.f']=q.n||''; f['nl.'+r+'.t']=p.n||''; if(p.la!=null&&q.la!=null){ f['nl.'+r+'.tt']=String(Math.round(brg(q,p))); const vv=magVar(q,p); if(vv!=null){ f['nl.'+r+'.var']=String(Math.round(vv*10)/10); if(r===0) f['nl.var']=String(Math.round(vv*10)/10); } } f['nl.'+r+'.d']=String(Math.round(c.d*10)/10); { const A_=Math.round(Math.max(M.C[i-1].tgt,c.tgt)); f['nl.'+r+'.alt']= A_>=10000? 'FL'+String(Math.round(A_/100)).padStart(3,'0') : String(A_); }
      const te=legTer(M,i)??pnum(p.ter); if(te!=null) f['nl.'+r+'.msa']=String(Math.ceil((te+mg)/100)*100);
      if(tasN) f['nl.'+r+'.tas']=String(tasN); { const w=nlWind(p.nw)||nlWind(NLs.w); if(w) f['nl.'+r+'.w']=nlW3(w); } r++; });
    if(tasN) f['nl.tas']=String(tasN); if(pnum(NLs.ff)){ f['fu.ff']=String(pnum(NLs.ff)); f['fu.unit']=NLs.fu||'L'; } if(Array.isArray(P.hide)) P.hide=P.hide.filter(h=>h!=='nav'); }
  P.xs.f={}; ['x.alt','x.msa','x.frz','x.cb','x.ct'].forEach(k=>P.xs.f[k]=f[k]||'');
  P.title=[f.depapt,f.destapt].filter(Boolean).join(' – ')||P.title; if(window.FLIGHT&&FLIGHT.link(P,R)){ R.title=title(); await NSTORE.put('route',R); } await NSTORE.put('prep',P); await loadPacks(); el('packs').value=P.id;
  el('sendnote').innerHTML=`${silent?L({en:'Linked to',no:'Koblet til'}):L({en:'Sent to',no:'Sendt til'})} <b>${esc(P.title||'')}</b>.${silent?' '+L({en:'Changes here go to the pack automatically.',no:'Endringer her går automatisk til pakken.'}):''} <a href="prep.html?id=${encodeURIComponent(P.id)}#s-xsec">${L({en:'Open the briefing pack',no:'Åpne briefingpakken'})} →</a>`; flowDraw(); return P; }
el('send').onclick=()=>sendRoute(false);
/* ---------- én flytur: rute → briefingpakke → arbeidsflaten ---------- */
function flowDraw(){ const box=el('flowbox'); if(!box||!R||!window.FLIGHT) return; const P=FLIGHT.packForRoute(PACKS,R), ok=MODE==='draw'||(R.pts||[]).filter(p=>p.la!=null).length>=2;
  const desk=FLIGHT.deskHref(P?[['pack',P.id],['route',R.id]]:[['route',R.id]]);
  box.innerHTML=`<p class="fl-k">${L({en:'This flight',no:'Denne flyturen'})}</p>`+(P
    ? `<p class="fl-t">${L({en:'Briefing pack',no:'Briefingpakke'})}: <b>${esc(P.title||[P.f&&P.f.depapt,P.f&&P.f.destapt].filter(Boolean).join(' – ')||'')}</b></p><div class="fl-b"><a class="btn pri" id="flowOpen" href="prep.html?id=${encodeURIComponent(P.id)}">${L({en:'Open briefing pack',no:'Åpne briefingpakken'})}</a><a class="btn" id="flowDesk" href="${desk}">${L({en:'Open on my desk',no:'Åpne på arbeidsflaten'})}</a></div>`
    : `<div class="fl-b"><button class="btn pri" id="flowNew" type="button" ${ok?'':'disabled'}>${L({en:'Create briefing pack',no:'Lag briefingpakke'})}</button>${ok?`<a class="btn" id="flowDesk" href="${desk}">${L({en:'Open on my desk',no:'Åpne på arbeidsflaten'})}</a>`:''}</div><p class="pinch">${ok?L({en:'Departure, destination, alternate, the route and today’s date are filled in, and the pack stays linked to this route.',no:'Avgang, destinasjon, alternativ, ruten og dagens dato fylles inn, og pakken holdes koblet til denne ruten.'}):L({en:'Build a route first.',no:'Bygg en rute først.'})}</p>`);
  const nb=el('flowNew'); if(nb) nb.onclick=flowCreate; }
async function flowCreate(){ const b=el('flowNew'); if(b){ b.disabled=true; b.textContent=L({en:'Creating…',no:'Lager …'}); }
  try{ clearTimeout(dirty); R.title=title(); await NSTORE.put('route',R); el('packs').value='';
    const P=MODE==='draw'?await sendDraw():await sendRoute(true); if(!P){ flowDraw(); return; }
    FLIGHT.prefill(P,R); await NSTORE.put('prep',P); await NSTORE.put('route',R);
    location.href='prep.html?id='+encodeURIComponent(P.id); }
  catch(e){ flowDraw(); } }
/* ---------- egen profil/rute fra ForeFlight o.l. inn i briefingpakken ---------- */
const UP={blob:null,w:0,h:0,url:null};
const upIn=document.createElement('input'); upIn.type='file'; upIn.accept='image/*,.pdf,application/pdf'; upIn.hidden=true; document.body.appendChild(upIn);
function upDb(){ return new Promise(res=>{ try{ const r=indexedDB.open('naeroson-att',1); r.onupgradeneeded=()=>r.result.createObjectStore('img'); r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); }catch(e){ res(null); } }); }
async function upPut(k,b){ const db=await upDb(); if(!db) return false; return new Promise(res=>{ try{ const t=db.transaction('img','readwrite'); t.objectStore('img').put(b,k); t.oncomplete=()=>res(true); t.onerror=()=>res(false); }catch(e){ res(false); } }); }
async function upJpeg(src,w,h){ const k=Math.min(1,1800/Math.max(w,h)); const c=document.createElement('canvas'); c.width=Math.round(w*k); c.height=Math.round(h*k); const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(src,0,0,c.width,c.height); const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.85)); return {b,w:c.width,h:c.height}; }
function upScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('load')); document.head.appendChild(s); }); }
async function upPdf(f){ const base='vendor/'; if(!window.pdfjsLib){ await upScript(base+'pdf.min.js?v=1'); window.pdfjsLib.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.js?v=1'; } const doc=await window.pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise; const pg=await doc.getPage(1); const v0=pg.getViewport({scale:1}); const vp=pg.getViewport({scale:Math.min(3,1800/Math.max(v0.width,v0.height))}); const c=document.createElement('canvas'); c.width=Math.round(vp.width); c.height=Math.round(vp.height); const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); await pg.render({canvasContext:g,viewport:vp}).promise; const j=await upJpeg(c,c.width,c.height); j.pages=doc.numPages; return j; }
// upload buttons: the library menu and the compact line under the profile (class upgo)
let UPB=null; document.addEventListener('click',e=>{ const b=e.target.closest('.upgo'); if(!b||b.disabled) return; UPB=b; upIn.click(); });
upIn.onchange=async()=>{ const f=upIn.files[0]; upIn.value=''; if(!f) return; const btn=UPB&&document.body.contains(UPB)?UPB:document.createElement('button'), t0=btn.innerHTML; btn.disabled=true; btn.textContent=L({en:'Reading…',no:'Leser…'});
  try{ let j; if(/\.pdf$/i.test(f.name)||f.type==='application/pdf') j=await upPdf(f); else { const u=URL.createObjectURL(f); const img=new Image(); const ok=await new Promise(r=>{ img.onload=()=>r(true); img.onerror=()=>r(false); img.src=u; }); if(!ok) throw new Error('img'); j=await upJpeg(img,img.naturalWidth,img.naturalHeight); URL.revokeObjectURL(u); }
    Object.assign(UP,{blob:j.b,w:j.w,h:j.h}); if(UP.url) URL.revokeObjectURL(UP.url); UP.url=URL.createObjectURL(j.b); el('upimg').src=UP.url;
    el('upname').value=f.name.replace(/\.[a-z0-9]+$/i,'').replace(/^IMG[_-]?\d+$/i,'')||L({en:'My route and profile',no:'Min rute og profil'}); if(/^(screenshot|skjermbilde)/i.test(el('upname').value)) el('upname').value=L({en:'My route and profile',no:'Min rute og profil'});
    await loadPacks(); el('uppack').innerHTML=el('packs').innerHTML; el('uppack').value=el('packs').value;
    el('upnote').textContent=j.pages>1? L({en:`The PDF has ${j.pages} pages. The first page is added. You can add more pages in the briefing pack.`,no:`PDF-en har ${j.pages} sider. Den første siden legges til. Flere sider kan du legge til i briefingpakken.`}) : '';
    el('upok').disabled=false; el('upok').hidden=false; el('upcancel').textContent=L({en:'Cancel',no:'Avbryt'}); el('updlg').showModal(); }
  catch(e){ btn.disabled=false; btn.textContent=L({en:'Could not read that file. Use PNG, JPG or PDF.',no:'Klarte ikke å lese filen. Bruk PNG, JPG eller PDF.'}); setTimeout(()=>{ btn.innerHTML=t0; },3500); return; }
  btn.disabled=false; btn.innerHTML=t0; };
el('upok').onclick=async e=>{ e.preventDefault(); if(!UP.blob) return; const b=el('upok'); b.disabled=true;
  try{ let P=PACKS.find(p=>p.id===el('uppack').value);
    if(!P){ P={hide:['check'],id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),title:'',created:Date.now(),f:{'rf.to':'1.25','rf.ld':'1.43','fu.unit':'US gal','mb.dens':'3.03','rules':'IFR','purpose':'Training flight'},sk:[]}; }
    const id='a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5); await upPut(id,UP.blob);
    const a={id,sec:'xsec',name:el('upname').value.trim()||L({en:'My route and profile',no:'Min rute og profil'}),w:UP.w,h:UP.h,marks:[],note:''};
    P.att=P.att||[]; P.att.push(a); if(!P.title) P.title=L({en:'Briefing pack',no:'Briefingpakke'})+' '+new Date().toLocaleDateString(); await NSTORE.put('prep',P); await loadPacks(); el('packs').value=P.id;
    el('upnote').innerHTML=`${L({en:'Added to',no:'Lagt til i'})} <b>${esc(P.title||'')}</b>. <a href="prep.html?id=${encodeURIComponent(P.id)}#s-xsec">${L({en:'Open the briefing pack',no:'Åpne briefingpakken'})} →</a>`;
    b.hidden=true; el('upcancel').textContent=L({en:'Close',no:'Lukk'}); }
  catch(err){ el('upnote').textContent=L({en:'Could not save it. Try again.',no:'Klarte ikke å lagre. Prøv igjen.'}); b.disabled=false; } };
function linkedPack(){ const P=PACKS.find(p=>p.id===el('packs').value); return P&&P.xs&&P.xs.route===R.id&&MODE!=='draw'?P:null; }
let linkT=null; function linkSync(){ if(!linkedPack()) return; clearTimeout(linkT); linkT=setTimeout(()=>sendRoute(true).catch(()=>{}),900); }
/* åpnet fra en briefingpakke: hent ruten og pakkens verdier */
async function fromPack(id){ const P=PACKS.find(p=>p.id===id); if(!P) return; el('packs').value=P.id; const X=P.xs||{}, f=P.f||{};
  let r=X.route&&ALL.find(x=>x.id===X.route);
  if(!r){ r=blank(); const names=(X.pts||[]).filter(p=>!['toc','tod','missed','alt'].includes(p.t)&&p.n&&!/^(TOC|TOD)$/i.test(p.n)).map(p=>p.n.split(/\s/)[0]);
    const seq=[f.depapt,...names,f.destapt].filter(Boolean).filter((n,i,a)=>n!==a[i-1]); r.rt=seq.join(' DCT '); r.wx=X.wx||''; r.gs=X.gs||''; ALL.unshift(r); }
  load(r); if(!R.pts||!R.pts.length){ if(R.rt) build(); }
  const map={'x.alt':'cr','x.msa':'msa','x.frz':'frz','x.cb':'cb','x.ct':'ct'}; let ch=false;
  for(const k in map){ const v=f[k]; if(v&&v!==R.s[map[k]]){ R.s[map[k]]=v; el('s_'+map[k]).value=v; ch=true; } }
  if(!X.svg&&X.pts&&R.pts){ X.pts.forEach(p=>{ if(p.n&&p.a!=null){ const q=R.pts.find(q=>q.n===p.n&&!['rwy'].includes(q.t)); if(q&&String(q.a||'')!==String(p.a)){ q.a=String(p.a); ch=true; } } }); }
  if(!X.route){ P.xs=Object.assign(P.xs||{},{route:R.id}); }
  render(); wxMsg(compute()); queueSave(); if(ch||!X.route) await sendRoute(true);
  el('sendnote').innerHTML=`${L({en:'Linked to',no:'Koblet til'})} <b>${esc(P.title||'')}</b>. ${L({en:'Changes here go to the pack automatically.',no:'Endringer her går automatisk til pakken.'})} <a href="prep.html?id=${encodeURIComponent(P.id)}#s-xsec">${L({en:'Back to the pack',no:'Tilbake til pakken'})} →</a>`; }
el('print').onclick=()=>window.print();

/* ---------- tegn selv ---------- */
let MODE='full'; try{ MODE=localStorage.getItem('naeroson-route-mode')||'full'; }catch(e){}
const dsv=el('dsv'), exsv=el('exsv');
const DC=['#9A1E68','#13202A','#1D4E9E','#B3261E','#A9875A'];
const DT={t:'line',c:DC[0]}; let dcur=null;
function dd(){ R.draw=R.draw||{sc:{},items:[]}; return R.draw; }
function setMode(m){ if(m==='xs') m='full'; if(!['full','draw'].includes(m)) m='full'; MODE=m; try{ localStorage.setItem('naeroson-route-mode',m); }catch(e){} document.querySelectorAll('#modes button').forEach(b=>b.classList.toggle('on',b.dataset.m===m)); el('fullMode').hidden=m!=='full'; el('rx').hidden=m!=='full'; el('drawMode').hidden=m!=='draw'; el('sendnl').closest('label').hidden=m==='draw'; if(npBox){ npBox.remove(); npBox=null; } closePop();
  if(m==='draw'){ const D=dd(); if(D.rt==null) D.rt=R.pts.length>=2&&!D.items.length; el('d_rt').checked=!!D.rt; drawSheet(); drawExample(); render(); } else { render(); if(m==='full') setTimeout(()=>drawMap(),0); } }
/* tverrsnittet øverst, kartet rett under, vær og markører nederst; rutefeltet først */
el('modes').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setMode(b.dataset.m); });
el('dcols').innerHTML=DC.map((c,i)=>`<button class="dot ${i?'':'on'}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
el('dtools').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.t){ DT.t=b.dataset.t; el('dtools').querySelectorAll('[data-t]').forEach(x=>x.classList.toggle('on',x===b)); }
  if(b.dataset.c){ DT.c=b.dataset.c; el('dcols').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); } });
el('dundo').onclick=()=>{ dd().items.pop(); drawSheet(); queueSave(); };
el('dclr').onclick=()=>{ if(dd().items.length>4&&!window.confirm(L({en:'Clear the whole drawing?',no:'Tømme hele tegningen?'}))) return; dd().items=[]; drawSheet(); queueSave(); };
['alt','dist','from','to'].forEach(k=>el('d_'+k).addEventListener('input',e=>{ dd().sc[k]=e.target.value; drawSheet(); queueSave(); }));
const DL0=58,DR0=28,DT0=34,DB0=54;
function sheetBase(sv,sc){ const W0=1000,H0=420, W=W0-DL0-DR0, H=H0-DT0-DB0; const add=(tag,a)=>{ const e=document.createElementNS(NSV,tag); for(const k in a) e.setAttribute(k,a[k]); sv.appendChild(e); return e; };
  const tx=(t,x,y,o)=>{ const e=add('text',Object.assign({x,y,'font-family':'IBM Plex Mono, monospace','font-size':10,fill:'#9AA6AC'},o||{})); e.textContent=t; return e; };
  add('rect',{x:0,y:0,width:W0,height:H0,fill:'#FBFBF8'}); for(let x=40;x<W0;x+=40) add('line',{x1:x,y1:0,x2:x,y2:H0,stroke:'#EEF1EF'}); for(let y=40;y<H0;y+=40) add('line',{x1:0,y1:y,x2:W0,y2:y,stroke:'#EEF1EF'});
  const amax=pnum(sc.alt)||8000, dist=pnum(sc.dist)||60; const st=amax>12000?2000:1000; for(let a=st;a<=amax;a+=st){ const y=DT0+H-a/amax*H; add('line',{x1:DL0,y1:y,x2:W0-DR0,y2:y,stroke:'#E3E8EA','stroke-dasharray':'2 4'}); tx(a>=10000&&st===2000?'FL'+a/100:String(a),DL0-8,y+4,{'text-anchor':'end'}); }
  const ds=dist>150?50:dist>60?20:dist>25?10:5; for(let d=0;d<=dist+0.01;d+=ds) tx(d+' NM',DL0+d/dist*W,DT0+H+16,{'text-anchor':'middle'});
  add('line',{x1:0,y1:DT0+H,x2:W0,y2:DT0+H,stroke:'#13202A'});
  if(sc.from){ add('rect',{x:DL0-26,y:DT0+H-2,width:52,height:4,fill:'#13202A'}); tx(sc.from.toUpperCase(),DL0,DT0+H+32,{'text-anchor':'middle','font-family':'Archivo, sans-serif','font-size':12.5,'font-weight':700,fill:'#13202A'}); }
  if(sc.to){ add('rect',{x:W0-DR0-26,y:DT0+H-2,width:52,height:4,fill:'#13202A'}); tx(sc.to.toUpperCase(),W0-DR0,DT0+H+32,{'text-anchor':'end','font-family':'Archivo, sans-serif','font-size':12.5,'font-weight':700,fill:'#13202A'}); }
  return {add}; }
function cloudPath(x1,y1,x2,y2){ const a=Math.min(x1,x2), b=Math.max(x1,x2), t=Math.min(y1,y2), bt=Math.max(y1,y2); const n=Math.max(2,Math.round((b-a)/50)), w=(b-a)/n; let d=`M${a} ${bt} L${a} ${t+8}`; for(let i=0;i<n;i++) d+=` q${w*0.25} ${-14-(i%3)*4} ${w*0.5} -2 q${w*0.25} ${-10-(i%2)*5} ${w*0.5} 2`; return d+` L${b} ${bt} Z`; }
function drawItems(sv,items){ const add=(tag,a)=>{ const e=document.createElementNS(NSV,tag); for(const k in a) e.setAttribute(k,a[k]); sv.appendChild(e); return e; }; const gy=420-DB0;
  items.filter(i=>i.t==='ter').forEach(i=>{ const p=i.p; if(p.length<4) return; let d=`M${p[0]} ${gy} L${p[0]} ${p[1]}`; for(let k=2;k<p.length;k+=2) d+=` L${p[k]} ${p[k+1]}`; d+=` L${p[p.length-2]} ${gy} Z`; add('path',{d,fill:'#E9E4D8',stroke:'#A9875A','stroke-width':1.2,'stroke-linejoin':'round'}); });
  items.filter(i=>i.t==='cloud').forEach(i=>add('path',{d:cloudPath(i.p[0],i.p[1],i.p[2],i.p[3]),fill:'#E3EAEE',stroke:'#C6D0D3',opacity:.92}));
  items.forEach(i=>{ if(i.t==='line') add('line',{x1:i.p[0],y1:i.p[1],x2:i.p[2],y2:i.p[3],stroke:i.c,'stroke-width':i.c===DC[0]?3.2:2,'stroke-linecap':'round','stroke-dasharray':i.dash?'7 5':''});
    else if(i.t==='pen'){ add('path',{d:'M'+i.p.reduce((a,v,k)=>a+(k&&!(k%2)?' L':k?' ':'')+v,''),fill:'none',stroke:i.c,'stroke-width':i.c===DC[0]?3:2,'stroke-linecap':'round','stroke-linejoin':'round'}); }
    else if(i.t==='text'){ const e=add('text',{x:i.x,y:i.y,'font-family':'Caveat, cursive','font-size':20,'font-weight':600,fill:i.c}); e.textContent=i.s; }
    else if(i.t==='fix'){ add('path',{d:`M${i.x} ${i.y-7} L${i.x+6.5} ${i.y+4} L${i.x-6.5} ${i.y+4} Z`,fill:'#FBFBF8',stroke:'#13202A','stroke-width':1.6}); const e=add('text',{x:i.x,y:i.y-13,'text-anchor':'middle','font-family':'Archivo, sans-serif','font-size':12,'font-weight':700,fill:'#13202A'}); e.textContent=i.s; } }); }
function routeSc(){ const M=compute(); if(M.C.length<2) return null; const dep=M.C[0].p, dst=[...M.C].reverse().find(c=>c.p.t==='rwy'&&c.i>0);
  const terMax=TP?Math.max(0,...TP.pts.map(p=>p.e||0)):0; const top=Math.max(...M.C.map(c=>c.tgt||0),terMax+1000,1000);
  return {M,sc:{alt:String(pnum(dd().sc.alt)||Math.ceil(top*1.22/1000)*1000),dist:String(Math.round(M.total*10)/10),from:dep.n||'',to:dst?dst.p.n:''}}; }
function drawSheet(){ const D=dd(); const RS=D.rt?routeSc():null; const sc=RS?RS.sc:D.sc;
  ['alt','dist','from','to'].forEach(k=>{ const i=el('d_'+k); i.disabled=!!RS&&k!=='alt'; if(document.activeElement!==i) i.value= RS? (k==='alt'? (D.sc.alt||'') : sc[k]) : (D.sc[k]||''); i.placeholder= RS&&k==='alt'? sc.alt : ({alt:'8000',dist:'60',from:'ENTO',to:'ENGM'})[k]; });
  dsv.innerHTML=''; sheetBase(dsv,sc); if(RS) routeUnder(dsv,RS.M,sc); drawItems(dsv,D.items); if(dcur) drawItems(dsv,[dcur]); }
function routeUnder(sv,M,sc){ const add=(tag,a)=>{ const e=document.createElementNS(NSV,tag); for(const k in a) e.setAttribute(k,a[k]); sv.appendChild(e); return e; };
  const W=1000-DL0-DR0, H=420-DT0-DB0, amax=pnum(sc.alt)||8000, dist=Math.max(0.1,pnum(sc.dist)||M.total), XS=v=>DL0+v/dist*W, YS=a=>DT0+H-Math.max(0,Math.min(a,amax))/amax*H;
  if(TP&&TP.pts.some(p=>p.e!=null)){ let d='M'+XS(0)+' '+(DT0+H); TP.pts.forEach(p=>{ d+=' L'+XS(p.x).toFixed(1)+' '+YS(p.e||0).toFixed(1); }); d+=' L'+XS(TP.pts[TP.pts.length-1].x)+' '+(DT0+H)+' Z'; add('path',{d,fill:'#E9E4D8',stroke:'#B08A5A','stroke-width':1,'stroke-linejoin':'round'}); }
  const msa=pnum(S('msa')); if(msa!=null) add('line',{x1:DL0,y1:YS(msa),x2:1000-DR0,y2:YS(msa),stroke:'#9A1E68','stroke-dasharray':'8 4',opacity:.5});
  M.C.forEach((c,i)=>{ const x=XS(c.x); if(c.p.t==='missed'||c.p.t==='alt') return; add('line',{x1:x,y1:DT0,x2:x,y2:DT0+H,stroke:'#9AA6AC','stroke-dasharray':'1 5'});
    if(c.p.t==='rwy'){ add('rect',{x:x-20,y:DT0+H-2,width:40,height:4,fill:'#13202A'}); if(pnum(c.p.elev)!=null){ const e=add('text',{x,y:DT0+H-8,'text-anchor':'middle','font-family':'Caveat, cursive','font-size':15,fill:'#4C5B66'}); e.textContent=fx(pnum(c.p.elev))+' ft'; } return; }
    const e=add('text',{x,y:DT0+12,'text-anchor':'middle','font-family':'Archivo, sans-serif','font-size':11,'font-weight':700,fill:'#4C5B66'}); e.textContent=c.p.n||''; }); }
el('d_rt').addEventListener('change',e=>{ const D=dd(); if(D.items.length>2&&!window.confirm(L({en:'The scale changes, so your drawing may no longer line up. Continue?',no:'Skalaen endres, så tegningen kan bli forskjøvet. Fortsette?'}))){ e.target.checked=!e.target.checked; return; } D.rt=e.target.checked; drawSheet(); queueSave(); });
const dpt=e=>{ const r=dsv.getBoundingClientRect(); return [Math.round((e.clientX-r.left)/r.width*1000),Math.round((e.clientY-r.top)/r.height*420)]; };
dsv.addEventListener('pointerdown',e=>{ const [x,y]=dpt(e);
  if(DT.t==='text'||DT.t==='fix'){ e.preventDefault(); textBox(e,x,y); return; }
  dsv.setPointerCapture(e.pointerId);
  if(DT.t==='line') dcur={t:'line',c:DT.c,p:[x,y,x,y],dash:e.shiftKey||el('ddash').checked};
  else if(DT.t==='cloud') dcur={t:'cloud',p:[x,y,x,y]};
  else dcur={t:DT.t==='ter'?'ter':'pen',c:DT.c,p:[x,y]}; drawSheet(); });
dsv.addEventListener('pointermove',e=>{ if(!dcur) return; let [x,y]=dpt(e);
  if(dcur.t==='line'){ if(el('dsnap').checked){ const dx=x-dcur.p[0], dy=y-dcur.p[1]; if(Math.abs(dy)<Math.abs(dx)*0.12) y=dcur.p[1]; else if(Math.abs(dx)<Math.abs(dy)*0.12) x=dcur.p[0]; } dcur.p[2]=x; dcur.p[3]=y; }
  else if(dcur.t==='cloud'){ dcur.p[2]=x; dcur.p[3]=y; }
  else { const n=dcur.p.length; if(Math.hypot(x-dcur.p[n-2],y-dcur.p[n-1])>3) dcur.p.push(x,y); } drawSheet(); });
const dup=()=>{ if(!dcur) return; const ok= dcur.t==='line'? Math.hypot(dcur.p[2]-dcur.p[0],dcur.p[3]-dcur.p[1])>4 : dcur.t==='cloud'? Math.abs(dcur.p[2]-dcur.p[0])>20 : dcur.p.length>4; if(ok) dd().items.push(dcur); dcur=null; drawSheet(); queueSave(); };
dsv.addEventListener('pointerup',dup); dsv.addEventListener('pointercancel',()=>{ dcur=null; drawSheet(); });
function textBox(e,x,y){ const host=dsv.parentElement; host.style.position='relative'; const r=dsv.getBoundingClientRect(), hr=host.getBoundingClientRect(); const inp=document.createElement('input'); inp.className='dtxt'; inp.placeholder=DT.t==='fix'?L({en:'Fix name',no:'Navn på fix'}):L({en:'Write…',no:'Skriv…'}); inp.style.left=(e.clientX-hr.left)+'px'; inp.style.top=(e.clientY-hr.top-18)+'px'; host.appendChild(inp); inp.focus(); setTimeout(()=>inp.focus(),0); let fin=false;
  const done=ok=>{ if(fin) return; fin=true; const v=inp.value.trim(); inp.remove(); if(ok&&v){ dd().items.push(DT.t==='fix'?{t:'fix',x,y,s:v.toUpperCase()}:{t:'text',c:DT.c,x,y,s:v}); drawSheet(); queueSave(); } };
  inp.addEventListener('keydown',ev=>{ if(ev.key==='Enter') done(true); if(ev.key==='Escape') done(false); }); inp.addEventListener('blur',()=>done(true)); }
el('dprint').onclick=()=>{ const keep=dd().items; dd().items=[]; drawSheet(); document.body.classList.add('printdraw'); setTimeout(()=>{ window.print(); document.body.classList.remove('printdraw'); dd().items=keep; drawSheet(); },50); };
const EX={pts:[{n:'ENTO',t:'rwy',elev:286},{n:'EXIT',t:'sid',d:'10',a:'4000'},{n:'WPT',t:'wpt',d:'22'},{n:'IAF',t:'iaf',d:'18',a:'4000'},{n:'HOLD',t:'hold',d:'0'},{n:'FAF',t:'faf',d:'8',a:'2500',note:'ILS 01L',app:1},{n:'DA 880',t:'da',d:'5.1',a:'880',app:1},{n:'ENGM',t:'rwy',d:'0.5',a:'681',elev:681},{n:'MAP',t:'missed',d:'7',a:'4000',app:1}],s:{cr:'6000',cl:'400',ds:'300',msa:'3200',frz:'4500',cb:'2500',ct:'5000',cw:'',mg:'1000'},zoom:true};
function drawExample(){ const keep=R, ks=selI; R=EX; selI=-1; try{ const M=compute(); drawProfile(M,null,exsv); exsv.querySelectorAll('.fhit').forEach(e=>e.remove()); [...exsv.querySelectorAll('text')].forEach(t=>{ if(/click the line|klikk på linjen/.test(t.textContent)) t.remove(); }); } finally { R=keep; selI=ks; } }
async function sendDraw(){ let P=PACKS.find(p=>p.id===el('packs').value);
  if(!P){ P={hide:['check'],id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),title:'',created:Date.now(),f:{'rf.to':'1.25','rf.ld':'1.43','fu.unit':'US gal','mb.dens':'3.03','rules':'IFR','purpose':'Training flight'},sk:[]}; }
  const snap=dsv.cloneNode(true); P.xs={pts:[],svg:snap.innerHTML,route:R.id,drawn:1}; const sc=dd().sc; if(sc.from&&!P.f.depapt) P.f.depapt=sc.from.toUpperCase(); if(sc.to&&!P.f.destapt) P.f.destapt=sc.to.toUpperCase();
  P.title=[P.f.depapt,P.f.destapt].filter(Boolean).join(' – ')||P.title; if(window.FLIGHT&&FLIGHT.link(P,R)){ R.title=title(); await NSTORE.put('route',R); } await NSTORE.put('prep',P); await loadPacks(); el('packs').value=P.id;
  el('sendnote').innerHTML=`${L({en:'Drawing sent to',no:'Tegningen er sendt til'})} <b>${esc(P.title||'')}</b>. <a href="prep.html?id=${encodeURIComponent(P.id)}#s-xsec">${L({en:'Open the briefing pack',no:'Åpne briefingpakken'})} →</a>`; flowDraw(); return P; }

/* ---------- lagrede ruter ---------- */
function load(r){ R=r; if(R.da||(R.pts||[]).some(p=>p.auto)){ R.da={xd:(R.da&&R.da.xd)||'',xa:(R.da&&R.da.xa)||''}; R.pts=(R.pts||[]).filter(p=>!p.auto); } if(!hLoading){ HI=[]; hT=0; } R.s=Object.assign({cr:'',cl:'',ds:'',msa:'',frz:'',cb:'',ct:'',cw:'',mg:'1000',ta:'',tz:'10'},R.s||{}); vsUI(); R.app=R.app||{}; R.mk=R.mk||[]; R.wx=R.wx||''; R.ntm=R.ntm||''; selI=-1; terKey=''; TP=null; el('ntmin').value=R.ntm||''; el('wxin').value=R.wx; el('ghost').checked=R.ghost!==false;
  ['cr','cl','ds','msa','frz','cb','ct','cw','mg','ta','tz'].forEach(k=>el('s_'+k).value=R.s[k]||(k==='mg'?'1000':k==='tz'?'10':'')); AK.forEach(k=>el('a_'+k).value=R.app[k]||''); el('rtxt').value=R.rt||''; render(); wxMsg(compute()); if(!hLoading) HI=[JSON.stringify(R)]; hBtns(); setTimeout(fit,0); drawSel(); if(MODE==='draw'){ el('d_rt').checked=!!dd().rt; drawSheet(); } }
el('sel').onchange=()=>{ const r=ALL.find(x=>x.id===el('sel').value); if(r) load(r); };
el('new').onclick=()=>{ const r=blank(); ALL.unshift(r); load(r); queueSave(); };
el('dup').onclick=()=>{ const r=JSON.parse(JSON.stringify(R)); r.id=blank().id; r.title=(R.title||'')+' (2)'; ALL.unshift(r); load(r); queueSave(); };
el('del').onclick=async()=>{ if(!window.confirm(L({en:'Delete this route?',no:'Slette denne ruten?'}))) return; await NSTORE.del('route',R.id); ALL=ALL.filter(x=>x!==R); if(!ALL.length) ALL=[blank()]; load(ALL[0]); };

/* ---------- språk ---------- */
LAB.add({},{
 'VFR':'VFR','IFR':'IFR','VFR chart: terrain colours, relief and contours':'VFR-kart: terrengfarger, relieff og koter','IFR chart: low ink, faint relief':'IFR-kart: lite blekk, svakt relieff','Chart style':'Kartstil',
 'VFR chart':'VFR-kart','IFR (low ink)':'IFR (lite blekk)','Relief':'Relieff','Aviation':'Luftfart','Terrain numbers':'Terrengtall','Mine':'Mine','Terrain colours and shading':'Terrengfarger og skygge','Contour lines (ft)':'Koter (fot)','Airspace (openAIP)':'Luftrom (openAIP)','IFR points (Finland, Iceland)':'IFR-punkter (Finland, Island)','My fixes':'Mine fixes',
 'Highest terrain per square: our own figure from the terrain data, highest point + 300 ft for unknown obstacles, rounded up to 100 ft. Not an official MEF. Airspace comes from openAIP, a community database: it can be incomplete or out of date, so check the AIP and NOTAM. Not shown: airways, obstacles and IFR points for Norway, Sweden and Denmark. Not an official VFR or IFR chart.':'Høyeste terreng per rute: vårt eget tall fra terrengdataene, høyeste punkt + 300 ft for ukjente hindre, rundet opp til nærmeste 100 ft. Ikke en offisiell MEF. Luftrommet kommer fra openAIP, en dugnadsdatabase: det kan være ufullstendig eller utdatert, så sjekk AIP og NOTAM. Vises ikke: luftveier, hindre og IFR-punkter for Norge, Sverige og Danmark. Ikke et offisielt VFR- eller IFR-kart.',
 'Cruise':'Marsj','Aircraft':'Fly','Aircraft model':'Flymodell','Auto':'Auto','Symbol':'Symbol','3D: auto':'3D: auto','Show map help':'Vis karthjelp','GS':'GS','kt':'kt','500 ft lower':'500 ft lavere','500 ft higher':'500 ft høyere','Cruise altitude, feet or FL':'Marsjhøyde, fot eller FL','Cruise altitude: feet (6500) or flight level (FL75)':'Marsjhøyde: fot (6500) eller flygenivå (FL75)','Ground speed, knots':'Fart over bakken, knop','Ground speed (kt)':'Fart over bakken (kt)',
 '▶ Simulate flight':'▶ Simuler flygingen','Fly the route in 3D at your planned altitude':'Fly ruten i 3D i den planlagte høyden','Simulate the flight':'Simuler flygingen','Camera':'Kamera','Chase':'Bak flyet','Cockpit':'Cockpit','Overview':'Oversikt','Speed':'Fart','Simulation speed':'Simuleringsfart',
 'Behind and above the aircraft':'Bak og over flyet','From the aircraft, looking ahead along the track':'Fra flyet, fremover langs kursen','The whole route':'Hele ruten',
 'Base map':'Bakgrunnskart','Chart':'Kart','Satellite':'Satellitt','Norway topo':'Norge topo','Drag to move · right-drag or two fingers to turn and tilt · scroll or pinch to zoom':'Dra for å flytte · høyreklikk-dra eller to fingre for å snu og tilte · scroll eller knip for å zoome',
 'Already planned in ForeFlight or Garmin Pilot?':'Allerede planlagt i ForeFlight eller Garmin Pilot?','Upload a screenshot or PDF of your route or profile. It goes straight into your briefing pack.':'Last opp et skjermbilde eller en PDF av ruten eller profilen. Det går rett inn i briefingpakken din.','⇪ Upload screenshot or PDF':'⇪ Last opp skjermbilde eller PDF','Add to the briefing pack':'Legg til i briefingpakken','Name':'Navn','Add to briefing pack':'Legg til i briefingpakken','Cancel':'Avbryt',
 'Send to the briefing pack':'Send til briefingpakken','Goes with it:':'Følger med:','Route, markers and notes are saved together as one route.':'Rute, markører og notater lagres samlet som én rute.',
 'Relief':'Relieff','Plain':'Lys','Layers':'Kartlag','What the map shows':'Hva kartet viser','Terrain (relief)':'Terreng (relieff)','Briefing pack':'Briefingpakke','Search an airport or fix, or paste a route':'Søk flyplass eller fix, eller lim inn en rute','Airport, fix or route':'Flyplass, fix eller rute',
 'Highest terrain per square: our own figure from the terrain data, highest point + 300 ft for unknown obstacles, rounded up to 100 ft. Not an official MEF. Not shown: airspace, airways, obstacles and IFR points for Norway, Sweden and Denmark (no licensed data yet). Not an official VFR or IFR chart.':'Høyeste terreng per rute: vårt eget tall fra terrengdataene, høyeste punkt + 300 ft for ukjente hindre, rundet opp til nærmeste 100 ft. Ikke en offisiell MEF. Vises ikke: luftrom, luftveier, hindre og IFR-punkter for Norge, Sverige og Danmark (ingen lisensierte data ennå). Ikke et offisielt VFR- eller IFR-kart.','Highest terrain per square (e.g.':'Høyeste terreng per rute (f.eks.','= 4,500 ft)':'= 4 500 ft)',
 'Auto':'Auto',
 'Expected departure (your note)':'Forventet avgang (ditt notat)','Notes for departure and arrival':'Notater for avgang og ankomst','Expected arrival (your note)':'Forventet ankomst (ditt notat)',
 'Expected departure':'Forventet avgang','Expected arrival':'Forventet ankomst',
 'Apply':'Bruk','Write it like a clearance, or choose below.':'Skriv det som en klarering, eller velg under.',
 'Expected departure and arrival':'Forventet avgang og ankomst','Departure runway':'Avgangsbane','Arrival runway':'Landingsbane','Arrival':'Ankomst','Instrument, straight-in (3°)':'Instrument, rett inn (3°)','Visual, 3 NM final':'Visuell, 3 NM final',
 'Built from the runway numbers: a straight climb-out and a straight-in final on the extended centreline. Not the published SID or approach.':'Laget fra banenumrene: rett stigning ut og rett inn på forlenget senterlinje. Ikke publisert SID eller innflyging.',
 'My notes':'Mine notater',
 'Explore the route':'Utforsk ruten','Move the slider to fly along the route.':'Flytt glidebryteren for å fly langs ruten.','Camera follows':'Kameraet følger','Reset view':'Tilbakestill visning','Drag to rotate · right-drag, Shift-drag or two fingers to move · scroll or pinch to zoom':'Dra for å rotere · høyreklikk-dra, Shift-dra eller to fingre for å flytte · scroll eller knip for å zoome','▶ Fly the route':'▶ Fly ruten','Fly the route':'Fly ruten','Contours':'Koter','Light':'Lys','VFR reporting points':'VFR-meldepunkter','Control zones (CTR)':'Kontrollsoner (CTR)','TMA / CTA':'TMA / CTA','Restricted, danger, prohibited':'Restriksjons-, fare- og forbudsområder','TIZ / TIA / RMZ / TMZ':'TIZ / TIA / RMZ / TMZ','ATZ / MATZ / HTZ':'ATZ / MATZ / HTZ','TRA / TSA and temporary areas':'TRA / TSA og midlertidige områder','Obstacles':'Hindre','Small airfields, heliports, glider sites':'Små flyplasser, helikopterplasser, seilflyplasser','openAIP navaids':'Radiofyr fra openAIP','Thermal hotspots':'Termikk-hotspots','Hang gliding sites':'Hanggliderplasser','RC model airfields':'Modellflyplasser','Reset map':'Tilbakestill kartet','Look':'Se','Centre':'Midtstill','Look around':'Se deg rundt','Look left':'Se til venstre','Look right':'Se til høyre','Look up':'Se opp','Look down':'Se ned','Loading terrain and imagery along the route…':'Laster terreng og bilder langs ruten …','Skip':'Hopp over','from NW':'fra NV','from SW':'fra SV','from SE':'fra SØ','from NE':'fra NØ','Direction of the relief shading light':'Retningen lyset i relieffskyggen kommer fra','Off':'Av','Margin OK':'Margin OK','Inside the clearance':'Innenfor klaringen','Below terrain':'Under terrenget','Not checked':'Ikke sjekket','Choose Altitude line or Climb and descent in the profile to colour the route by terrain margin.':'Velg Høydelinje eller Stigning og sink i profilen for å fargelegge ruten etter terrengmargin.','Contour lines':'Koter','3D settings':'3D-innstillinger','Terrain exaggeration':'Overdrivelse av terrenget','Position along the route':'Posisjon langs ruten','3D terrain view':'3D-terrengvisning',
 ' Advanced':' Avansert','Optional settings. They change the profile when it shows Climb and descent, and some of them (MSA, corridor, clearance) in every view.':'Valgfrie innstillinger. De endrer profilen når den viser Stigning og sink, og noen av dem (MSA, korridor, klaring) i alle visninger.',
 'Terrain profile':'Terrengprofil','Altitude line':'Høydelinje','Climb and descent':'Stigning og sink','Show':'Vis','Search airport, navaid or fix':'Søk flyplass, radiofyr eller fix','Layers':'Kartlag','Airports':'Flyplasser','VOR, DME and NDB':'VOR, DME og NDB','IFR points (Finland, Iceland and yours)':'IFR-punkter (Finland, Island og dine egne)','Terrain shading':'Terrengskygge',
 'Airspace and airways are not shown: we do not have licensed data for them yet. Not an official chart.':'Luftrom og luftveier vises ikke: vi har ikke lisensierte data for dem ennå. Ikke et offisielt kart.',
 'Map and profile':'Kart og profil','Draw by hand':'Tegn for hånd','Advanced':'Avansert','weather on the profile, approach, levels, terrain settings and your own fixes':'vær på profilen, innflyging, høyder, terrenginnstillinger og egne fikspunkter',
 'Weather is drawn when the profile shows Climb and descent. For forecasts, use the Windy button on the map.':'Været tegnes når profilen viser Stigning og sink. For prognoser, bruk Windy-knappen på kartet.',
 'Send to the briefing pack ↓':'Send til briefingpakken ↓','Choose the pack and send. The profile, the weather and the navigation log go with it.':'Velg pakken og send. Profilen, været og navigasjonsloggen følger med.','Climb and descent ':'Stigning og sink ',
 'How to read the profile':'Slik leser du profilen','Departure and approach area':'Avgangs- og innflygingsområde',
 'Terrain shows only the ground under the route. Altitude line adds one level you choose. Climb and descent adds an illustrative path from your climb and descent gradients. None of them is a procedure.':'Terreng viser bare bakken under ruten. Høydelinje legger til én høyde du velger. Stigning og sink legger til en illustrativ bane fra stige- og sinkgradientene dine. Ingen av dem er en prosedyre.',
 'With Climb and descent, the first and last part of the flight (shaded) is flown on a SID, an approach or visually. The tool does not have those procedures, so it does not check terrain there, and the line is dashed. Use the chart. The areas are 10 NM by default (change it under Advanced); if you add an approach, the approach area starts at the IAF.':'Med Stigning og sink flys den første og siste delen av flygingen (skravert) på en SID, en innflyging eller visuelt. Verktøyet har ikke de prosedyrene, så det sjekker ikke terrenget der, og linjen er stiplet. Bruk kartet. Områdene er 10 NM som standard (endre det under Avansert); legger du inn en innflyging, starter innflygingsområdet ved IAF.',
 'Between them, en route, the line is checked against the terrain: red dots mean below the highest terrain in the corridor, orange dots mean less than your clearance (1000 or 2000 ft, set under Advanced).':'Mellom dem, på strekningen, sjekkes linjen mot terrenget: røde prikker betyr under det høyeste terrenget i korridoren, oransje prikker betyr mindre enn klaringen din (1000 eller 2000 ft, satt under Avansert).',
 'The brown area is the terrain directly under the route. The red and orange dots also look at the highest terrain within the corridor on each side, which is what the IFR minimum level is based on.':'Det brune feltet er terrenget rett under ruten. De røde og oransje prikkene ser også på det høyeste terrenget i korridoren på hver side, som er det IFR-minimumshøyden bygger på.',
 'The elevation model is coarse and has no obstacles such as masts or buildings. Published altitudes always come from the AIP and the charts.':'Høydemodellen er grov og har ingen hindre som master eller bygninger. Publiserte høyder kommer alltid fra AIP og kartene.',
 '↶ Undo':'↶ Angre','Reset profile':'Nullstill profilen',
 'Plan':'Planlegg','Fill in the route and your levels, paste the weather if you have it, and press Build route. The map and the profile below draw themselves.':'Fyll inn ruten og høydene, lim inn været hvis du har det, og trykk «Bygg ruten». Kartet og profilen under tegner seg selv.',
 'METAR / TAF ':'METAR / TAF ','(optional, drawn on the profile)':'(valgfritt, tegnes på profilen)','Route format and typical gradients':'Ruteformat og typiske gradienter','Levels and terrain':'Høyder og terreng',
 'Approach, levels and your fixes':'Innflyging, høyder og dine fikspunkter','Add the approach at the end of the route, the MSA, freezing level and cloud, and any fixes the map does not have.':'Legg til innflygingen på slutten av ruten, MSA, frysepunkt og skyer, og fikspunkter kartet ikke har.',
 'Map':'Kart','Profile':'Profil','Send to the briefing pack':'Send til briefingpakken','Markers':'Markører','Points table':'Punkttabell','Data sources and limits':'Datakilder og begrensninger','Type or paste the route, add the cruise level and your climb and descent. The map and the profile are drawn straight away.':'Skriv eller lim inn ruten, legg inn marsjhøyden og stigning og sink. Kartet og profilen tegnes med en gang.','Route, or a route string from ForeFlight, Garmin or the flight plan':'Rute, eller en rutestreng fra ForeFlight, Garmin eller flyplanen','Climb (ft/NM)':'Stigning (ft/NM)','Descent (ft/NM)':'Sink (ft/NM)','For example':'For eksempel','. A 3° descent is about 318 ft/NM; departures are designed for at least 200 ft/NM (3.3 %). Your aircraft’s real climb comes from the AFM.':'. En 3° nedstigning er rundt 318 ft/NM; avganger er laget for minst 200 ft/NM (3,3 %). Flyets virkelige stigning finner du i AFM.','Drag a route point onto a fix, or click a fix to add it. The approach, the weather and your own fixes are in the tabs.':'Dra et rutepunkt til en fix, eller klikk på en fix for å legge den til. Innflyging, vær og dine egne fixer ligger i fanene.','Paste METAR or TAF for aerodromes on the route; the cloud layers are drawn over that aerodrome.':'Lim inn METAR eller TAF for flyplasser på ruten; skylagene tegnes over den flyplassen.','Drag the aircraft to change the cruise level, drag a point to change its altitude, and add your own markers.':'Dra flyet for å endre marsjhøyden, dra et punkt for å endre høyden, og legg til dine egne markører.','Pick one, then click on the profile:':'Velg én, og klikk så på profilen:','Choose the pack and send. The profile, your markers, the weather and the navigation log go with it. The points table shows every point with its distance, track and altitude.':'Velg pakken og send. Profilen, markørene, været og navigasjonsloggen følger med. Punkttabellen viser hvert punkt med distanse, kurs og høyde.',
 "Full planner":"Full planlegger","Draw it yourself":"Tegn selv","A blank profile sheet, like a page in GoodNotes. Set the scale, then draw the route yourself: climb, cruise, descent, hold, approach and missed approach, terrain and cloud. The example below shows what a finished one can look like.":"Et tomt profilark, som en side i GoodNotes. Sett skalaen, og tegn ruten selv: stigning, marsj, sink, holding, innflyging og missed approach, terreng og skyer. Eksempelet viser hvordan en ferdig profil kan se ut.","Line":"Linje","Pen":"Penn","Text":"Tekst","Fix":"Fix","Terrain":"Terreng","Cloud":"Sky","Straight":"Rett","Dashed":"Stiplet","Undo":"Angre","Clear":"Tøm","Highest altitude on the sheet (ft)":"Høyeste høyde på arket (ft)","Total distance (NM)":"Total distanse (NM)","From":"Fra","To":"Til","Print blank sheet":"Skriv ut tomt ark","Use “Send to briefing pack” at the top to put your drawing in the pack.":"Bruk «Send til briefingpakken» øverst for å legge tegningen i pakken.","Example: a finished profile":"Eksempel: en ferdig profil","Set the highest altitude and the distance, so the grid has the right scale.":"Sett høyeste høyde og distansen, så rutenettet får riktig skala.","Draw the departure: runway, climb to the first fix or the SID altitude.":"Tegn avgangen: banen, stigning til første fix eller SID-høyden.","Cruise level, then top of descent. A 3° descent is about 300 ft per NM.":"Marsjhøyde, så toppen av nedstigningen. En 3°-nedstigning er rundt 300 ft per NM.","Hold, approach and the minimum. Mark the FAF and the DA or MDA.":"Holding, innflyging og minimum. Merk FAF og DA eller MDA.","Missed approach as a dashed line, with the altitude.":"Missed approach som stiplet linje, med høyden.","Terrain, MSA, cloud base and tops, and the freezing level.":"Terreng, MSA, skybase og -topper, og frysenivået.",
 'NORDAP · Route profile':'NORDAP · Ruteprofil','Route profile':'Ruteprofil',
 'Build the route on the map and see it from the side: climb, cruise, descent, hold, approach and missed approach, with the terrain under it. Send the finished profile to your briefing pack.':'Bygg ruten på kartet og se den fra siden: stigning, marsj, sink, holding, innflyging og missed approach, med terrenget under. Send den ferdige profilen til briefingpakken.',
 'New':'Ny','Duplicate':'Dupliser','Delete':'Slett','Also fill the navigation log':'Fyll også navigasjonsloggen','Send to briefing pack':'Send til briefingpakken','Print':'Skriv ut',
 'Drag to move · scroll or pinch to zoom · click anything to add it · drag a route point, or drag the line to add a point · click a point to remove it':'Dra for å flytte · scroll eller knip for å zoome · klikk på noe for å legge det til · dra et rutepunkt, eller dra linjen for å legge til et punkt · klikk på et punkt for å fjerne det',
 'Airports and navaids: OurAirports. IFR points for Finland (Fintraffic eAIP ENR 4.4, free reuse) and Iceland (Isavia eAIP ENR 4.4, non-commercial use). Norway, Sweden and Denmark are left out until the AIP publishers give permission: add the points you need under My fixes. Map: OpenFreeMap © OpenMapTiles, data from OpenStreetMap (ODbL). Satellite: Esri World Imagery through ArcGIS Location Platform (Powered by Esri; sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community); without it, Sentinel-2 cloudless 2016 by EOX IT Services GmbH, contains modified Copernicus Sentinel data 2016 (CC BY 4.0); if neither loads, NASA GIBS Blue Marble at low resolution. The relief shading over the satellite map in 3D is computed from the terrain tiles. Norway topo: © Kartverket (CC BY 4.0). Map library: MapLibre GL JS (BSD-3). Contour lines: computed in your browser from the terrain tiles with maplibre-contour (BSD-3). Airspace, VFR reporting points, obstacles and small airfields: © openAIP contributors (CC BY-NC 4.0), a community database that is not official and can be incomplete or out of date. Coastline when the map works offline: Natural Earth. Terrain, relief and 3D: Mapzen/AWS Terrain Tiles; Europe terrain data produced using Copernicus data and information funded by the European Union – EU-DEM layers; Norway terrain data © Kartverket; SRTM and GMTED2010 (USGS); ETOPO1 (NOAA). For planning only. Always check positions against the AIP and current charts.':'Flyplasser og navigasjonshjelpemidler: OurAirports. IFR-punkter for Finland (Fintraffic eAIP ENR 4.4, fri gjenbruk) og Island (Isavia eAIP ENR 4.4, ikke-kommersiell bruk). Norge, Sverige og Danmark er tatt ut til AIP-utgiverne gir tillatelse: legg inn punktene du trenger under Mine fixes. Kart: OpenFreeMap © OpenMapTiles, data fra OpenStreetMap (ODbL). Satellitt: Esri World Imagery via ArcGIS Location Platform (Powered by Esri; kilder: Esri, Maxar, Earthstar Geographics og GIS User Community); uten den, Sentinel-2 cloudless 2016 fra EOX IT Services GmbH, inneholder modifiserte Copernicus Sentinel-data 2016 (CC BY 4.0); hvis ingen av dem lastes, NASA GIBS Blue Marble i lav oppløsning. Relieffskyggen over satellittkartet i 3D er beregnet fra terrengflisene. Norge topo: © Kartverket (CC BY 4.0). Kartbibliotek: MapLibre GL JS (BSD-3). Koter: beregnet i nettleseren din fra terrengflisene med maplibre-contour (BSD-3). Luftrom, VFR-meldepunkter, hindre og små flyplasser: © openAIP-bidragsytere (CC BY-NC 4.0), en dugnadsdatabase som ikke er offisiell og kan være ufullstendig eller utdatert. Kystlinje når kartet virker uten nett: Natural Earth. Terreng, relieff og 3D: Mapzen/AWS Terrain Tiles; Europe terrain data produced using Copernicus data and information funded by the European Union – EU-DEM layers; Norway terrain data © Kartverket; SRTM og GMTED2010 (USGS); ETOPO1 (NOAA). Kun til planlegging. Sjekk alltid posisjoner mot AIP og gjeldende kart.',
 'Route':'Rute','Approach':'Innflyging','Levels and weather':'Høyder og vær','My fixes':'Mine fixes',
 'Route (aerodromes, navaids, your fixes or coordinates; add /altitude to a point)':'Rute (flyplasser, navigasjonshjelpemidler, dine fixes eller koordinater; legg til /høyde på et punkt)',
 'Build route':'Bygg ruten','E.g.':'F.eks.','Cruise altitude / level':'Marsjhøyde / flygenivå','Climb gradient (ft/NM)':'Stigegradient (ft/NM)','Descent gradient (ft/NM)':'Sinkgradient (ft/NM)',
 'Adds the approach after the last en-route point. Distances in NM, altitudes in feet. Leave out what you don’t use.':'Legger innflygingen etter siste punkt underveis. Avstander i NM, høyder i fot. Hopp over det du ikke bruker.',
 'IAF altitude':'IAF-høyde','Hold at the IAF':'Holding ved IAF','No':'Nei','Yes':'Ja','IF / FAF / FAP':'IF / FAF / FAP','IAF to FAF (NM)':'IAF til FAF (NM)','FAF altitude':'FAF-høyde','Threshold elevation (ft)':'Tersklens høyde (ft)','Missed approach fix':'Missed approach-fix','Missed: NM from DA point':'Missed: NM fra DA-punktet','Missed altitude':'Missed-høyde','Add approach':'Legg til innflyging','Remove approach':'Fjern innflyging',
 'MSA / MEA line (ft)':'MSA / MEA-linje (ft)','Freezing level (ft or FL)':'Frysenivå (ft eller FL)','Cloud base (ft)':'Skybase (ft)','Cloud tops (ft)':'Skytopper (ft)','Terrain corridor each side (NM)':'Terrengkorridor på hver side (NM)','Clearance above terrain':'Klaring over terreng','2000 ft (mountainous)':'2000 ft (fjellterreng)',
 'IFR minimum level (SERA.5015): at least 1000 ft above the highest obstacle within 8 km (4.3 NM) of the estimated position, or 2000 ft over high terrain or mountainous areas where the authority says so. The terrain here is a coarse elevation model without obstacles, so use it to see the shape of the route, not to set your minimum altitude. Your charts and the AIP decide.':'Laveste IFR-høyde (SERA.5015): minst 1000 ft over høyeste hinder innen 8 km (4,3 NM) fra beregnet posisjon, eller 2000 ft over høyt terreng eller fjellområder der myndigheten bestemmer det. Terrenget her er en grov høydemodell uten hindre, så bruk den til å se formen på ruten, ikke til å sette laveste høyde. Kartene og AIP avgjør.',
 'Save the fixes you need (IFR waypoints, VRPs, your own points). They are stored on your profile and can be used in the route by name.':'Lagre fixene du trenger (IFR-veipunkter, VRP-er, egne punkter). De lagres på profilen din og kan brukes i ruten med navn.',
 'Name':'Navn','Coordinates':'Koordinater','Note':'Notat','Save fix':'Lagre fix','Pick on the map':'Velg på kartet','Paste from the AIP or a list':'Lim inn fra AIP eller en liste','Read the list':'Les listen','Read fixes from a chart':'Les fixes fra et kart','Read the chart':'Les kartet','Your fixes':'Dine fixes',
 'Points':'Punkter','Add point':'Legg til punkt','Clear route':'Tøm ruten',
 'Map':'Kart','Cross-section':'Tverrsnitt','Cross-section and map':'Tverrsnitt og kart','Vertical scale:':'Vertikal skala:','Manual':'Manuell','Reset':'Tilbakestill','Terrain':'Terreng','Max':'Maks','Transition altitude (ft)':'Overgangshøyde (ft)','Draw':'Tegn','NORDAP · Route Explorer':'NORDAP · Route Explorer',
 'See the route before you fly it. Paste the route from ForeFlight or build it on the map, then look at it from the side with the terrain under it, mark your own altitudes, and send it to the briefing pack. A visual preparation tool, not a flight planner.':'Se ruten før du flyr den. Lim inn ruten fra ForeFlight eller bygg den på kartet, se den fra siden med terrenget under, merk dine egne høyder og send den til briefingpakken. Et visuelt forberedelsesverktøy, ikke en flyplanlegger.',
 'Route, or paste a route string from ForeFlight, Garmin or the flight plan':'Rute, eller lim inn en rutestreng fra ForeFlight, Garmin eller flyplanen',
 'Reference: 3° descent ≈ 318 ft/NM (5.2 %). Departure procedures are designed for at least 3.3 % ≈ 200 ft/NM. Your aircraft’s real climb depends on the AFM, mass, weather and configuration.':'Referanse: 3° nedstigning ≈ 318 ft/NM (5,2 %). Avgangsprosedyrer er konstruert for minst 3,3 % ≈ 200 ft/NM. Flyets faktiske stigning avhenger av AFM, masse, vær og konfigurasjon.',
 'Click a marker, then click on the profile:':'Velg en markør, og klikk på profilen:','Altitude':'Høyde','Restriction':'Restriksjon','Hold':'Holding','Calculated path':'Beregnet bane',
 'Weather on the profile':'Vær på profilen','Paste METAR or TAF for aerodromes on the route. The cloud layers are drawn over that aerodrome. Bases come from the report, the thickness is illustrative.':'Lim inn METAR eller TAF for flyplasser på ruten. Skylagene tegnes over den flyplassen. Basene kommer fra rapporten, tykkelsen er illustrativ.',
 'Your markers':'Dine markører','↶ Undo':'↶ Angre','↷ Redo':'↷ Gjør om','✕ Clear route':'✕ Tøm ruten','✕ Remove point':'✕ Fjern punkt','More ▾':'Flere ▾','Show or hide the terrain':'Vis eller skjul terrenget','＋ Departure note':'＋ Avgangsnotat','＋ Arrival note':'＋ Ankomstnotat','Profile scale':'Skala i profilen',
 'Draw the profile yourself, like a page in GoodNotes: climb, cruise, descent, hold, approach and missed approach, terrain and cloud. Tick “Draw on my route” to get the real terrain and the route points under your pencil, or use a blank sheet with your own scale.':'Tegn profilen selv, som en side i GoodNotes: stigning, marsj, sink, holding, innflyging og missed approach, terreng og skyer. Kryss av for «Tegn på ruten min» for å få det ekte terrenget og rutepunktene under blyanten, eller bruk et tomt ark med egen skala.',
 'Draw on my route: real terrain and the route points, scale set automatically':'Tegn på ruten min: ekte terreng og rutepunktene, skalaen settes automatisk',
 'Radar shows rain and snow, not cloud,':'Radaren viser regn og snø, ikke skyer,','so it has no heights. Rain rate:':'så den har ingen høyder. Nedbørsintensitet:',
 'light, under 1 mm/h':'svak, under 1 mm/t','moderate, 2–5':'moderat, 2–5','heavy, 5–10':'kraftig, 5–10','very heavy, 10–20: showers, often CB':'svært kraftig, 10–20: byger, ofte CB',
 '20–50: thunderstorm likely':'20–50: tordenvær sannsynlig','over 50: hail possible':'over 50: hagl mulig',
 'For the cloud layers and their heights, tap the map and choose':'For skylagene og høydene deres, trykk på kartet og velg','Clouds here':'Skyer her',', or open an airport.':', eller åpne en flyplass.',
 'Infrared shows how cold the cloud tops are:':'Infrarødt viser hvor kalde skytoppene er:','bright white = cold, high tops':'klart hvitt = kalde, høye topper',
 '(CB, frontal cloud),':'(CB, frontskyer),','grey = low cloud or fog':'grått = lave skyer eller tåke',', which can look like the ground. For heights, tap the map and choose':', som kan ligne bakken. For høyder, trykk på kartet og velg'
});
LAB.add({},{
 'Clean VFR':'Ren VFR','Everything':'Alt på','Layer presets':'Forhåndsvalg for kartlag','Airspace':'Luftrom','Points and weather':'Punkter og vær','My stuff':'Mitt','SIGMET and AIRMET':'SIGMET og AIRMET','Flown track':'Fløyet spor','(GPX from your phone or GPS, for the debrief)':'(GPX fra telefon eller GPS, til debriefen)','Open GPX file…':'Åpne GPX-fil …','Remove track':'Fjern sporet','Weather radar (Europe)':'Værradar (Europa)','Satellite clouds (Meteosat infrared)':'Satellittskyer (Meteosat infrarødt)','NOTAM (pasted in the route)':'NOTAM (limt inn i ruten)','Paste NOTAMs in ICAO format, with the Q) line, from the official briefing':'Lim inn NOTAM i ICAO-format, med Q)-linjen, fra den offisielle briefingen','Winds aloft (forecast)':'Vind i høyden (prognose)','Freezing level (0 °C, 100 ft)':'Frysenivå (0 °C, 100 ft)','Aerodromes along the route':'Flyplasser langs ruten','Within':'Innen','Runway at least':'Bane minst','Forecast winds aloft':'Prognose for vind i høyden','ETD (UTC)':'ETD (UTC)','Fill winds from the forecast':'Fyll inn vind fra prognosen','Weather (METAR)':'Vær (METAR)',
 'Highest terrain per square: our own figure from the terrain data, highest point + 300 ft for unknown obstacles, rounded up to 100 ft. Not an official MEF. Airspace comes from openAIP, a community database: it can be incomplete or out of date, so check the AIP and NOTAM. METAR from MET Norway (Norwegian aerodromes) and aviationweather.gov, for training: check the official briefing. Not shown: airways, obstacles and IFR points for Norway, Sweden and Denmark. Not an official VFR or IFR chart.':'Høyeste terreng per rute: vårt eget tall fra terrengdataene, høyeste punkt + 300 ft for ukjente hindre, rundet opp til 100 ft. Ikke en offisiell MEF. Luftrommet kommer fra openAIP, en dugnadsdatabase: det kan være ufullstendig eller utdatert, så sjekk AIP og NOTAM. METAR fra MET Norway (norske flyplasser) og aviationweather.gov, til trening: sjekk den offisielle briefingen. Vises ikke: luftveier, hindre og IFR-punkter for Norge, Sverige og Danmark. Ikke et offisielt VFR- eller IFR-kart.',
 'Navlog':'Navlogg','TAS':'TAS','Wind':'Vind','° / kt':'° / kt','Fuel flow':'Forbruk','per hour':'per time','Unit':'Enhet','Print navlog':'Skriv ut navloggen','True airspeed, knots':'Sann flyfart, knop','Wind for the whole route, direction and speed':'Vind for hele ruten, retning og styrke','Fuel flow per hour':'Forbruk per time','Fuel unit':'Drivstoffenhet',
 '⇪ ForeFlight or Garmin Pilot screenshot / PDF':'⇪ Skjermbilde / PDF fra ForeFlight eller Garmin Pilot','Export':'Eksporter','GPX':'GPX','Garmin FPL':'Garmin FPL','Copy route':'Kopier ruten'});
LAB.add({},{
 'Add a screenshot or PDF of your ForeFlight or Garmin Pilot route or profile to the briefing pack':'Legg et skjermbilde eller en PDF av ruten eller profilen fra ForeFlight eller Garmin Pilot i briefingpakken',
 'Close':'Lukk','Copy the route as text, e.g. ENTO DCT SKI DCT ENGM':'Kopier ruten som tekst, f.eks. ENTO DCT SKI DCT ENGM','Every layer on':'Alle kartlag på','Fit route':'Tilpass til ruten','Fit the route':'Vis hele ruten',
 'Fit the height scale to the terrain and your altitude':'Tilpass høydeskalaen til terrenget og høyden din','Full screen':'Fullskjerm','GPX route for ForeFlight, Garmin Pilot, SkyDemon and others':'GPX-rute for ForeFlight, Garmin Pilot, SkyDemon og andre',
 'Garmin flight plan (.fpl), also opens in ForeFlight':'Garmin-reiseplan (.fpl), åpnes også i ForeFlight','Hide':'Skjul','Larger':'Større','Smaller':'Mindre',
 'Look ahead again (C, or double-click the map)':'Se fremover igjen (C, eller dobbeltklikk på kartet)','Look down (↓)':'Se ned (↓)','Look left (←)':'Se til venstre (←)','Look right (→)':'Se til høyre (→)','Look up (↑)':'Se opp (↑)',
 'My library':'Mitt bibliotek','My routes, saved views and notes':'Mine ruter, lagrede visninger og notater','Navigation log: headings, times and fuel with your wind':'Navigasjonslogg: kurser, tider og drivstoff med vinden din',
 'Redo (Ctrl+Shift+Z)':'Gjør om (Ctrl+Shift+Z)','Undo (Ctrl+Z)':'Angre (Ctrl+Z)','Remove all points from the route':'Fjern alle punktene fra ruten','Reset map: VFR chart, default layers, 2D, whole route. Your route is kept.':'Tilbakestill kartet: VFR-kart, standard kartlag, 2D, hele ruten. Ruten din beholdes.',
 'Route options':'Rutevalg','Margin OK':'Margin OK','VFR chart with CTR, TMA and R/D/P airspace, airports and reporting points. Obstacles, navaids and contours off.':'VFR-kart med CTR-, TMA- og R/D/P-luftrom, flyplasser og meldepunkter. Hindre, radiofyr og koter av.',
 'Weather in Windy':'Vær i Windy','Wx – Weather in Windy':'Wx – Vær i Windy','Weather in Windy (opens a new tab)':'Vær i Windy (åpnes i ny fane)','What the profile shows':'Hva profilen viser','Your routes':'Rutene dine','Zoom in':'Zoom inn','Zoom out':'Zoom ut',
 'Zoom in on the height scale':'Zoom inn på høydeskalaen','Zoom out on the height scale':'Zoom ut på høydeskalaen','name':'navn','Route Explorer':'Route Explorer',
 'e.g. ILS 30 via HE. Hold at HE if busy. Watch the hills north of the field.':'f.eks. ILS 30 via HE. Holding ved HE hvis travelt. Se opp for åsene nord for plassen.',
 'e.g. OBOLA 2A, RWY 17. Climb straight ahead to 1500, then right turn.':'f.eks. OBOLA 2A, RWY 17. Stig rett frem til 1500, så høyresving.',
 'Show or hide the route card':'Vis eller skjul rutekortet','Drag to resize the profile, or click to open or close it':'Dra for å endre størrelsen på profilen, eller klikk for å åpne eller lukke den','Terrain under the route':'Terrenget under ruten'});
/* title, placeholder and aria-label in the page: lab.js only swaps text (and aria-labels it has an English entry for), so the
   English originals are kept here and looked up in the Norwegian dictionary on every language change */
const TRA=['title','placeholder','aria-label'];
function trAttr(root){ (root||document).querySelectorAll('#rx [title],#rx [placeholder],#rx [aria-label],.page [title],.page [placeholder],.page [aria-label],dialog [title],dialog [placeholder],dialog [aria-label]').forEach(e=>{ TRA.forEach(a=>{ if(!e.hasAttribute(a)) return; const k='en'+a.replace(/-./g,x=>x[1].toUpperCase()).replace(/^./,x=>x.toUpperCase()); if(e.dataset[k]==null) e.dataset[k]=e.getAttribute(a); const o=e.dataset[k]; const v=LAB.lang==='no'?LAB.T(o):o; if(e.getAttribute(a)!==v) e.setAttribute(a,v); }); }); }
trAttr(); LAB.onLang(()=>trAttr());
LAB.start('route');
/* ================= Route Explorer 2.0 ================= */
// kartstil og lag
// layer defaults. VFR: everything aviation on, as on openaip.net (airspace, reporting points, airfields, navaids, obstacles);
// IFR: low ink (airspace, navaids, IFR points; VFR-only openAIP items off). rp…rc are openAIP points; hs/hg/rc are optional, off.
const LY0={ap:1,nv:1,fx:1,my:1,ter:1,nt:1,mef:1,ct:1,as:1,asCtr:1,asTma:1,asRes:1,asTiz:1,asAtz:1,asTra:1,rp:1,ob:1,oa:1,on:1,hs:0,hg:0,rc:0,wx:1,sig:1,wa:0,ntm:1,rad:0,sat:0};
const LYD={vfr:LY0,ifr:Object.assign({},LY0,{rp:0,ob:0,oa:0,on:0,hs:0,hg:0,rc:0,wx:0})};
// switching VFR/IFR applies that chart's aviation defaults; personal layers (my fixes, notes, relief, contours, terrain numbers) stay as chosen
const AVK=['ap','nv','fx','as','asCtr','asTma','asRes','asTiz','asAtz','asTra','rp','ob','oa','on','hs','hg','rc','wx','sig'];
function avDefaults(m){ const d=LYD[m]||LY0; AVK.forEach(k=>LY[k]=d[k]); }
const BMS=['vfr','ifr','chart','terrain','sat','topo'];
// v3: the VFR chart is the default base map (v2 saved 'chart' as its default, so only the layer choices carry over)
let MM='vfr', LY=Object.assign({},LYD.vfr), BM='vfr';
try{ const j3=JSON.parse(localStorage.getItem('bb-rx-v3')||'null'), j=j3||JSON.parse(localStorage.getItem('bb-rx-v2')||'null'); if(j){ MM=j.m==='ifr'?'ifr':'vfr'; LY=Object.assign({},LYD[MM],j.ly||{}); if(j3&&BMS.includes(j3.bm)) BM=j3.bm; } }catch(e){}
function saveLY(){ try{ localStorage.setItem('bb-rx-v3',JSON.stringify({m:MM,ly:LY,bm:BM})); }catch(e){} }
function asSub(){ const m=el('lyas'), on=!!LY.as&&m&&!m.hidden&&!m.classList.contains('off'); document.querySelectorAll('.asub').forEach(l=>{ l.hidden=!m||m.hidden; l.classList.toggle('dis',!on); l.querySelector('input').disabled=!on; }); }
function lyUI(){ asSub(); lyMeta(); el('mmode').querySelectorAll('button').forEach(b=>b.classList.toggle('on',ML?b.dataset.m===BM:b.dataset.m===MM)); el('layers').querySelectorAll('[data-ly]').forEach(i=>i.checked=!!LY[i.dataset.ly]); }
el('mmode').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(b.dataset.m!==MM) avDefaults(b.dataset.m); MM=b.dataset.m; if(ML) setBM(MM); saveLY(); lyUI(); drawMap(); });
el('layers').addEventListener('change',e=>{ const i=e.target.closest('[data-ly]'); if(!i) return; LY[i.dataset.ly]=i.checked?1:0; saveLY(); asSub(); lyMeta(); if(i.dataset.ly==='wx') wxSync(); if(i.dataset.ly==='sig'){ sigSync(); try{ if(R) drawProfile(compute(),TP); }catch(e){} } if(i.dataset.ly==='wa') waMapSync(); if(i.dataset.ly==='ntm') ntmSync(); if(i.dataset.ly==='rad') radSync(); if(i.dataset.ly==='sat') satSync(); if(/^as/.test(i.dataset.ly)) asSoon(0); if(ML&&i.dataset.ly==='ct'&&LY.ct) RXMAP.addContours(ML).then(()=>{ MLK.ly=''; drawMap(); }); drawMap(); });

/* presets and collapsible groups (open/closed remembered in bb-rx-lyg; layer choices stay in bb-rx-v3) */
const PRE={clean:{ter:1,ct:0,mef:0,as:1,asCtr:1,asTma:1,asRes:1,asTiz:0,asAtz:0,asTra:0,ap:1,wx:1,sig:1,nv:0,fx:0,rp:1,ob:0,oa:1,on:0,hs:0,hg:0,rc:0},
  all:{ter:1,ct:1,mef:1,as:1,asCtr:1,asTma:1,asRes:1,asTiz:1,asAtz:1,asTra:1,ap:1,wx:1,sig:1,nv:1,fx:1,rp:1,ob:1,oa:1,on:1,hs:1,hg:1,rc:1}};
function preOn(k){ const P_=PRE[k]; return Object.keys(P_).every(x=>!!LY[x]===!!P_[x])&&(k!=='clean'||!ML||BM==='vfr'); }
function lyMeta(){ const box=el('layers'); if(!box) return; box.querySelectorAll('.lypre [data-pre]').forEach(b=>{ const on=preOn(b.dataset.pre); b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); });
  box.querySelectorAll('details.lyg').forEach(d=>{ const c=d.querySelector('.lyc'); if(!c) return; const ins=[...d.querySelectorAll('input[data-ly]')].filter(i=>!i.closest('[hidden]')&&!i.disabled); c.textContent=ins.length?ins.filter(i=>LY[i.dataset.ly]).length+'/'+ins.length:''; }); }
el('layers').addEventListener('click',e=>{ const b=e.target.closest('[data-pre]'); if(!b) return; const k=b.dataset.pre; if(k==='clean'&&BM!=='vfr') setBM('vfr'); Object.assign(LY,PRE[k]); if(k==='clean'&&!ML) MM='vfr'; saveLY(); lyUI(); MLK.ly='';
  if(ML&&LY.ct) RXMAP.addContours(ML).then(()=>{ MLK.ly=''; drawMap(); }); drawMap(); wxSync(); asSoon(0); });
{ let G={}; try{ G=JSON.parse(localStorage.getItem('bb-rx-lyg')||'null')||{base:1,as:1,pts:1}; }catch(e){ G={base:1,as:1,pts:1}; }
  document.querySelectorAll('#layers details.lyg').forEach(d=>{ d.open=!!G[d.dataset.g]; d.addEventListener('toggle',()=>{ G[d.dataset.g]=d.open?1:0; try{ localStorage.setItem('bb-rx-lyg',JSON.stringify(G)); }catch(e){} }); }); }
el('lybtn').onclick=()=>{ const ly=el('layers'); ly.hidden=!ly.hidden; el('lybtn').setAttribute('aria-expanded',String(!ly.hidden)); };
// terrengskygge fra den lokale høydemodellen (1′-celler, fot)
const SHC={}, SHP={};
const TINT=[[0,[233,239,217]],[800,[238,236,212]],[2000,[231,222,192]],[3500,[218,201,166]],[5000,[202,184,156]],[7000,[214,206,194]],[9500,[240,238,234]],[14000,[255,255,255]]];
function tint(e){ for(let i=1;i<TINT.length;i++){ if(e<=TINT[i][0]){ const [e0,c0]=TINT[i-1],[e1,c1]=TINT[i], f=(e-e0)/(e1-e0); return [0,1,2].map(j=>c0[j]+(c1[j]-c0[j])*f); } } return TINT[TINT.length-1][1]; }
const HR={T:{},L:{},idx:null,ready:fetch('terrain/hr/index.json').then(r=>r.ok?r.json():null).then(j=>{ HR.idx=j; return !!j; }).catch(()=>false)};
HR.ready.then(()=>drawMap());
function smooth(a,n){ const o=new Float32Array(n*n); for(let r=0;r<n;r++) for(let q=0;q<n;q++){ let s=0,w=0; for(let dr=-1;dr<=1;dr++){ const rr=r+dr; if(rr<0||rr>=n) continue; for(let dq=-1;dq<=1;dq++){ const qq=q+dq; if(qq<0||qq>=n) continue; const ww=(dr||dq)?((dr&&dq)?1:2):4; s+=a[rr*n+qq]*ww; w+=ww; } } o[r*n+q]=s/w; } return o; }
function shadeArr(a0raw,n,top,deg,st,passes){ let a=a0raw; for(let p=0;p<passes;p++) a=smooth(a,n);
  const c=document.createElement('canvas'); c.width=n; c.height=n; const g=c.getContext('2d'); const im=g.createImageData(n,n), d=im.data;
  const cellNm=deg/n*60, dy=6076*cellNm, zf=st==='ter'?3.2:2, Lx=-0.5, Ly=0.5, Lz=0.7071;
  for(let r=0;r<n;r++){ const la=top-(r+0.5)*deg/n, dx=dy*Math.cos(la*D2R); for(let q=0;q<n;q++){ const i=r*n+q, e=a[i], raw=a0raw[i];
    const eW=a[r*n+Math.max(0,q-1)], eE=a[r*n+Math.min(n-1,q+1)], eN=a[Math.max(0,r-1)*n+q], eS=a[Math.min(n-1,r+1)*n+q];
    const gx=(eE-eW)/(2*dx)*zf, gy=(eN-eS)/(2*dy)*zf; const nl=Math.hypot(gx,gy,1); const sh=Math.max(0,(-gx*Lx-gy*Ly+Lz)/nl); const li=sh/Lz;
    let col; if(st==='ifr'){ const v=245*(0.9+0.1*Math.min(1.25,li)); col=[v,v,v-2]; } else { const t=tint(e), m=st==='ter'?0.6+0.4*Math.min(1.3,li):0.72+0.28*Math.min(1.25,li); col=t.map(x=>x*m); }
    d[i*4]=col[0]; d[i*4+1]=col[1]; d[i*4+2]=col[2]; d[i*4+3]=st==='ifr'?(raw>30?255:0):255; } }
  g.putImageData(im,0,0); return c; }
function shadeTile(k,st){ const key=st+k; if(key in SHC) return SHC[key]; const a=TERRAIN.raw(k); if(!a) return null; const [a0]=k.split('_').map(Number); return SHC[key]=shadeArr(a,TERRAIN.n(),a0+5,5,st,2); }
const SHH={}, SHHP={};
function shadeHR(k,st){ const key='h'+st+k; if(key in SHH) return SHH[key]; const a=HR.T[k]; if(!a) return null; const [a0]=k.split('_').map(Number); return SHH[key]=shadeArr(a,HR.idx.n,a0+HR.idx.deg,HR.idx.deg,st,1); }
function hrTile(k){ if(k in HR.T) return Promise.resolve(); return HR.L[k]||(HR.L[k]=fetch('terrain/hr/h_'+k+'.png').then(r=>r.blob()).then(b=>createImageBitmap(b,{colorSpaceConversion:'none',premultiplyAlpha:'none'})).then(bm=>{ const c=document.createElement('canvas'); c.width=bm.width; c.height=bm.height; const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(bm,0,0); const dd=g.getImageData(0,0,c.width,c.height).data; const o=new Uint16Array(c.width*c.height); for(let i=0;i<o.length;i++) o[i]=(dd[i*4]<<8)|dd[i*4+1]; HR.T[k]=o; }).catch(()=>{ HR.T[k]=null; })); }
function shadeDraw(g,lo0,lo1,la0,la1,cx,cy,zx,zy,landPath){ if(!window.TERRAIN||!TERRAIN.n) return; const st=MM, need=[];
  const A0=Math.floor(la0/5)*5, A1=Math.floor(la1/5)*5, O0=Math.floor(lo0/5)*5, O1=Math.floor(lo1/5)*5; if((A1-A0+5)*(O1-O0+5)/25>70) return;
  g.save(); landPath(); g.clip(); g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high'; if(st==='ifr') g.globalAlpha=0.9;
  for(let a=A0;a<=A1;a+=5) for(let o=O0;o<=O1;o+=5){ const k=a+'_'+o; if(!TERRAIN.has(k)) continue; const cv=shadeTile(k,st); if(!cv){ need.push(k); continue; }
    const x0=cx+(o-V.lo)*zx, y0=cy-(a+5-V.la)*zy; g.drawImage(cv,x0,y0,5*zx+0.5,5*zy+0.5); }
  // detaljert terreng (Norden) når du har zoomet inn
  const I=HR.idx; if(I&&V.z>=28){ const d=I.deg; const B0=Math.floor(la0/d)*d, B1=Math.floor(la1/d)*d, P0=Math.floor(lo0/d)*d, P1=Math.floor(lo1/d)*d; const hn=[];
    if((B1-B0+d)*(P1-P0+d)/(d*d)<=40) for(let a=B0;a<=B1;a+=d) for(let o=P0;o<=P1;o+=d){ const k=a+'_'+o; if(!I.tiles.includes(k)) continue; if(!(k in HR.T)){ hn.push(k); continue; } const cv=shadeHR(k,st); if(!cv) continue;
      const x0=cx+(o-V.lo)*zx, y0=cy-(a+d-V.la)*zy; g.drawImage(cv,x0,y0,d*zx+0.5,d*zy+0.5); }
    const nh=hn.filter(k=>!SHHP[k]); if(nh.length){ nh.forEach(k=>SHHP[k]=1); Promise.all(nh.map(hrTile)).then(()=>drawMap()); } }
  g.restore(); const nk=need.filter(k=>!SHP[k]); if(nk.length){ nk.forEach(k=>SHP[k]=1); TERRAIN.load(nk).then(()=>drawMap()); } }
TERRAIN.ready&&TERRAIN.ready.then(()=>drawMap());
// Windy
function windyHref(){ const a=el('windy'); if(!a) return; const z=Math.max(3,Math.min(11,Math.round(Math.log2(V.z*360/256)))); a.href=`https://www.windy.com/?${V.la.toFixed(3)},${V.lo.toFixed(3)},${z}`; }
// søk
function searchNav(q){ q=q.trim().toUpperCase(); if(q.length<2||!NAV) return []; const out=[]; const nm=s=>String(s||'').toUpperCase();
  const ws=t=>q.length>=3&&new RegExp('(^|[\\s\\-/(])'+q.replace(/[^A-Z0-9ÆØÅ]/g,'')).test(nm(t)); NAV.ap.forEach(a=>{ const s=a[0]===q?0:a[0].startsWith(q)?1:ws(a[1])?3:-1; if(s>=0) out.push({s:s-(a[5]||0)*0.2,k:'ap',o:a,id:a[0],t:a[1],ty:L({en:'Airport',no:'Flyplass'}),la:a[2],lo:a[3]}); });
  NAV.nv.forEach(n=>{ const s=n[0]===q?0.5:nm(n[1]).startsWith(q)?2:-1; if(s>=0) out.push({s,k:'nv',o:n,id:n[0],t:n[1]+' '+(n[3]||''),ty:n[2],la:n[4],lo:n[5]}); });
  (NAV.fx||[]).forEach(p=>{ if(p[0]===q||(q.length>=3&&p[0].startsWith(q))) out.push({s:p[0]===q?0.6:2.5,k:'aip',o:p,id:p[0],t:'AIP '+p[3],ty:L({en:'IFR point',no:'IFR-punkt'}),la:p[1],lo:p[2]}); });
  FIX.forEach(f=>{ if(nm(f.n).startsWith(q)) out.push({s:0.7,k:'fix',o:f,id:f.n,t:f.note||'',ty:L({en:'My fix',no:'Min fix'}),la:f.la,lo:f.lo}); });
  return out.sort((a,b)=>a.s-b.s).slice(0,9); }
let QR=[], QI=0, QT='';
function qTok(){ const v=el('rtxt').value, c=el('rtxt').selectionStart??v.length; const before=v.slice(0,c); const m=before.match(/(\S+)$/); return {tok:m?m[1].toUpperCase().split('/')[0]:'',start:m?c-m[1].length:c,end:c,all:v.trim().toUpperCase().split(/\s+/).filter(Boolean)}; }
function qUpdate(){ const t=qTok(); QT=t.tok; const rows=[]; const routeLike=t.all.filter(x=>x!=='DCT').length>=2;
  if(routeLike) rows.push({k:'route',id:L({en:'Show route',no:'Vis ruten'}),t:t.all.join(' '),ty:L({en:'Route',no:'Rute'})});
  if(t.tok&&t.tok!=='DCT'&&t.tok.length>=2) searchNav(t.tok).forEach(r=>rows.push(r));
  QR=rows.slice(0,9); QI=0; qDraw(); }
function qDraw(){ const box=el('qres'); if(!QR.length){ box.hidden=true; box.innerHTML=''; return; } box.hidden=false; const has=R.pts.filter(p=>p.la!=null).length;
  box.innerHTML=QR.map((r,i)=>{ if(r.k==='route') return `<div class="qrow ${i===QI?'on':''}" data-i="${i}"><b>↵</b><span>${esc(r.id)}: ${esc(r.t)}</span><i class="qty qty-r">${esc(r.ty)}</i></div>`;
    const acts=r.k==='ap'?`<button data-a="dep">${L({en:'From',no:'Fra'})}</button><button data-a="dst">${L({en:'To',no:'Til'})}</button>${has>=2?`<button data-a="via">Via</button>`:''}`:`<button data-a="via">${has>=2?L({en:'Add to route',no:'Legg til i ruten'}):'Via'}</button>`;
    return `<div class="qrow ${i===QI?'on':''}" data-i="${i}"><b>${esc(r.id)}</b><span>${esc(r.t)}</span><i class="qty qty-${r.k}">${esc(r.ty)}</i><span class="qa">${acts}</span></div>`; }).join('')+`<p class="qhelp">${L({en:'Pick From and To, or paste a whole route. You can add points afterwards.',no:'Velg Fra og Til, eller lim inn hele ruten. Du kan legge til punkter etterpå.'})}</p>`; }
function qAct(r,a){ el('qres').hidden=true; if(r.k==='route'){ build(); return; } const pt=ptFrom({k:r.k,o:r.o});
  if(a==='dep'||a==='dst') setEnd(pt,a);
  else if(a==='via'){ if(R.pts.filter(p=>p.la!=null).length<2){ setEnd(pt,R.pts.length?'dst':'dep'); } else { addPoint(Object.assign({},pt,pt.t==='rwy'?{t:'wpt'}:{})); el('rtxt').value=routeStr(); render(); queueSave(); } }
  else { V.la=r.la; V.lo=r.lo; V.z=Math.max(V.z,r.k==='ap'?140:110); drawMap(); showInfo({k:r.k,o:r.o}); } }
el('rtxt').addEventListener('input',qUpdate); el('rtxt').addEventListener('focus',()=>{ if(el('rtxt').value.trim()) qUpdate(); });
el('rtxt').addEventListener('keydown',e=>{ if(e.key==='ArrowDown'&&QR.length){ QI=Math.min(QR.length-1,QI+1); qDraw(); e.preventDefault(); } else if(e.key==='ArrowUp'&&QR.length){ QI=Math.max(0,QI-1); qDraw(); e.preventDefault(); }
  else if(e.key==='Enter'){ e.preventDefault(); const r=QR[QI]; if(!r||el('qres').hidden){ build(); el('qres').hidden=true; return; } if(r.k==='route'){ qAct(r); return; } const n=R.pts.filter(p=>p.la!=null).length; qAct(r, r.k!=='ap'?'via': n===0?'dep': n===1?'dst':'via'); }
  else if(e.key==='Escape'){ el('qres').hidden=true; } });
el('qres').addEventListener('pointerdown',e=>e.preventDefault());
el('qres').addEventListener('click',e=>{ const row=e.target.closest('.qrow'); if(!row) return; const r=QR[+row.dataset.i]; const b=e.target.closest('button[data-a]'); qAct(r,b?b.dataset.a:(r.k==='route'?null:'info')); });
document.addEventListener('pointerdown',e=>{ if(!e.target.closest('.rx-r')) el('qres').hidden=true; });
function qGo(r){ qAct(r,'info'); }
// informasjonspanel

function ptFrom(h){ const o=h.o; if(h.k==='oa') return {n:o.n||'',t:o.kind==='ap'?'rwy':'wpt',la:o.la,lo:o.lo,note:'openAIP '+oaKind(o)}; if(h.k==='ap') return {n:o[0],t:'rwy',la:o[2],lo:o[3],elev:o[4]}; if(h.k==='nv') return {n:o[0],t:'wpt',la:o[4],lo:o[5],note:o[2]+(o[3]?' '+o[3]:'')}; if(h.k==='aip') return {n:o[0],t:'wpt',la:o[1],lo:o[2],note:'AIP '+o[3]}; return {n:o.n,t:'wpt',la:o.la,lo:o.lo}; }
function setEnd(pt,end){ const A=R.pts; const q=Object.assign({},pt,{t:'rwy'});
  q.role=end; if(A.length===1){ if(A[0].role===end) A[0]=q; else if(end==='dep') A.unshift(q); else A.push(q); } else if(end==='dep'){ if(A.length&&A[0].t==='rwy') A[0]=q; else A.unshift(q); } else { const li=A.length-1; if(A.length>1&&A[li].t==='rwy') A[li]=q; else A.push(q); }
  R.rt=''; applyDA(); el('rtxt').value=routeStr(); render(); queueSave(); if(R.pts.length>=2){ sheetAuto(); fit(); } }
function routeStr(){ return R.pts.filter(p=>!p.auto&&!p.app&&!['missed','alt'].includes(p.t)).map(p=>p.n||'').filter(Boolean).join(' DCT '); }
// what an openAIP point is, in words
function oaKind(o){ const T={rp:o.type==='compulsory'?L({en:'VFR reporting point, compulsory',no:'VFR-meldepunkt, obligatorisk'}):L({en:'VFR reporting point, on request',no:'VFR-meldepunkt, på anmodning'}),
    ob:L({en:'Obstacle',no:'Hinder'})+(o.type?' ('+o.type.replace(/_/g,' ')+')':''), nv:'Navaid '+(o.type||'').replace(/_/g,'/').toUpperCase(),
    ap:({heli_civil:L({en:'Heliport',no:'Helikopterplass'}),heli_mil:L({en:'Military heliport',no:'Militær helikopterplass'}),gliding:L({en:'Glider site',no:'Seilflyplass'}),af_water:L({en:'Water aerodrome',no:'Sjøflyplass'}),ad_mil:L({en:'Military aerodrome',no:'Militær flyplass'}),ad_closed:L({en:'Closed aerodrome',no:'Nedlagt flyplass'})})[o.type]||L({en:'Airfield',no:'Flyplass'}),
    hs:L({en:'Thermal hotspot',no:'Termikk-hotspot'}),hg:L({en:'Hang gliding site',no:'Hanggliderplass'}),rc:L({en:'RC model airfield',no:'Modellflyplass'})}; return T[o.kind]||'openAIP'; }
function showInfo(h){ const sd=el('side'); const o=h.o, pt=ptFrom(h); let html='';
  if(h.k==='oa'){ const add=o.kind!=='ob'&&o.kind!=='hs';
    html=`<span class="id">${esc(o.n||'')}</span><h3>${esc(o.full||o.n||oaKind(o))}</h3><dl><dt>${L({en:'Type',no:'Type'})}</dt><dd>${esc(oaKind(o))}</dd><dt>${L({en:'Position',no:'Posisjon'})}</dt><dd>${llTxt(o.la,o.lo)}</dd></dl>`+
      (add?`<div class="acts"><button class="btn pri" data-a="dep">${L({en:'From here',no:'Herfra'})}</button><button class="btn pri" data-a="dst">${L({en:'To here',no:'Hit'})}</button><button class="btn" data-a="add">${L({en:'Add to route',no:'Legg til i ruten'})}</button></div>`:'')+
      `<p class="src">${L({en:'Source: openAIP (CC BY-NC 4.0), community data that can be incomplete or out of date. Check against the AIP and the VFR chart.',no:'Kilde: openAIP (CC BY-NC 4.0), dugnadsdata som kan være ufullstendige eller utdaterte. Sjekk mot AIP og VFR-kartet.'})}</p>`;
    sd.innerHTML=`<button class="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button>`+html; sd.hidden=false;
    sd.onclick=e=>{ const b=e.target.closest('button'); if(!b) return; if(b.classList.contains('x')){ sd.hidden=true; return; } const a=b.dataset.a; if(a==='adg'&&ML){ ML.flyTo({center:[pt.lo,pt.la],zoom:14.6,duration:900}); return; } if(a==='dep'||a==='dst') setEnd(pt,a==='dep'?'dep':'dst'); else if(a==='add'){ addPoint(Object.assign({},pt,pt.t==='rwy'&&R.pts.length?{t:'wpt'}:{})); el('rtxt').value=routeStr(); if(R.pts.length>=2) sheetAuto(); } sd.hidden=true; }; return; }
  const nm=(a,b)=>gc({la:a.la,lo:a.lo},{la:b.la,lo:b.lo});
  if(h.k==='ap'){ const rw=(o[6]||[]).map(r=>{ const h1=/^\d+/.test(r[0])?String(parseInt(r[0],10)*10).padStart(3,'0'):''; const h2=/^\d+/.test(r[1])?String(parseInt(r[1],10)*10).padStart(3,'0'):''; return `<div class="rw"><b>${esc(r[0])}/${esc(r[1])}</b><span>${r[2]?fx(r[2]*0.3048)+' m · '+fx(r[2])+' ft':''}${h1?' · ≈'+h1+'°/'+h2+'°':''}</span></div>`; }).join('');
    const near=NAV.nv.map(n=>({n,d:nm(pt,{la:n[4],lo:n[5]})})).filter(x=>x.d<25).sort((a,b)=>a.d-b.d).slice(0,5);
    const aip=window.BBAIP?BBAIP.of(o[0]):null;
    // METAR and TAF in the panel always, whether the weather layer is on or not
    if(/^[A-Z]{4}$/.test(o[0])){ const id=o[0], c=WXS.c[id]; if(!c||(!c.busy&&(c.err||Date.now()-c.t>WX_TTL))) setTimeout(()=>wxLib().catch(()=>{}).then(()=>wxFetch([id])).then(ok=>{ if(!ok&&(!WXS.c[id]||WXS.c[id].busy)) WXS.c[id]={t:Date.now(),err:1}; const b=el('side').querySelector('.mwx[data-id]'); if(b&&b.dataset.id===id) b.outerHTML=wxHtml(id); if(LY.wx) wxDraw(); }),0); }
    html=`<span class="id">${esc(o[0])}</span><h3>${esc(o[1])}</h3><dl><dt>${L({en:'Position',no:'Posisjon'})}</dt><dd>${llTxt(o[2],o[3])}</dd><dt>${L({en:'Elevation',no:'Høyde'})}</dt><dd>${fx(o[4])} ft · ${fx(o[4]*0.3048)} m</dd></dl>`+
     (/^[A-Z]{4}$/.test(o[0])?wxHtml(o[0]):'')+
     (/^[A-Z]{4}$/.test(o[0])?`<div class="micb" data-id="${esc(o[0])}"></div>`:'')+
     `<details class="mclw" data-la="${o[2]}" data-lo="${o[3]}" data-el="${o[4]!=null?o[4]:''}"><summary>${L({en:'Cloud layers above (forecast)',no:'Skylag over flyplassen (prognose)'})}</summary><div class="mcl"></div></details>`+
     `<div class="mfq" data-id="${esc(o[0])}"></div>`+
     (rw?`<b style="font-size:13px">${L({en:'Runways',no:'Rullebaner'})}</b>${rw}<p class="src">${L({en:'Headings are from the runway numbers (magnetic, rounded).',no:'Kursene er fra banenumrene (magnetisk, avrundet).'})}</p>`:'')+
     (near.length?`<b style="font-size:13px;display:block;margin-top:8px">${L({en:'Navaids within 25 NM',no:'Radiofyr innen 25 NM'})}</b>`+near.map(x=>`<div class="rw"><b>${esc(x.n[0])}</b><span>${esc(x.n[2])} ${esc(x.n[3]||'')} · ${fx(x.d,0)} NM</span></div>`).join(''):'')+
     `<div class="acts"><button class="btn pri" data-a="dep">${L({en:'From here',no:'Herfra'})}</button><button class="btn pri" data-a="dst">${L({en:'To here',no:'Hit'})}</button><button class="btn" data-a="add">${L({en:'Via',no:'Via'})}</button>${ML?`<button class="btn" data-a="adg" title="${L({en:'Zoom in to the taxiways, aprons and their names (OpenStreetMap)',no:'Zoom inn på taksebaner, oppstillingsplasser og navnene (OpenStreetMap)'})}">${L({en:'Airport diagram',no:'Flyplasskart'})}</button>`:''}</div>`+
     (aip&&BBAIP.deep(o[0])?`<p class="src aipl"><a class="btn" href="${BBAIP.ad(o[0])}" target="_blank" rel="noopener">${L({en:'AIP and charts',no:'AIP og kart'})} · ${esc(o[0])} ↗</a><br>${L({en:'The aerodrome in the edition in force today; if it is not in the AIP, the AIP itself',no:'Flyplassen i utgaven som gjelder i dag; står den ikke i AIP-en, selve AIP-en'})} (${esc(aip.name)}).</p>`:
      aip?`<p class="src">${L({en:'Official data, approach and aerodrome charts:',no:'Offisielle data, innflygings- og flyplasskart:'})} <a href="${esc(aip.url)}" target="_blank" rel="noopener">${esc(aip.name)} ↗</a>${aip.note?' ('+esc(L(aip.note))+')':''}, AD 2 ${esc(o[0])}.</p>`:`<p class="src">${L({en:'Official data: the national AIP of this country.',no:'Offisielle data: landets nasjonale AIP.'})}</p>`)+
     `<p class="src">${L({en:'Source: OurAirports (public domain). Check against the AIP.',no:'Kilde: OurAirports (allmenn eiendom). Sjekk mot AIP.'})}</p>`; }
  else { const ty=h.k==='nv'?`${esc(o[2])} ${esc(o[3]||'')}`:h.k==='aip'?`${L({en:'IFR point',no:'IFR-punkt'})} · AIP ${esc(o[3])}`:L({en:'My fix',no:'Min fix'});
    html=`<span class="id">${esc(pt.n)}</span><h3>${h.k==='nv'?esc(o[1]):esc(pt.n)}</h3><dl><dt>${L({en:'Type',no:'Type'})}</dt><dd>${ty}</dd><dt>${L({en:'Position',no:'Posisjon'})}</dt><dd>${llTxt(pt.la,pt.lo)}</dd>${h.k==='nv'&&o[6]!=null?`<dt>${L({en:'Elevation',no:'Høyde'})}</dt><dd>${fx(o[6])} ft</dd>`:''}</dl>`+
     `<div class="acts"><button class="btn pri" data-a="add">${L({en:'Add to route',no:'Legg til i ruten'})}</button></div><p class="src">${h.k==='nv'?L({en:'Source: OurAirports (public domain).',no:'Kilde: OurAirports (allmenn eiendom).'}):h.k==='aip'?L({en:'Source: the national eAIP, ENR 4.4.',no:'Kilde: nasjonal eAIP, ENR 4.4.'}):''}</p>`; }
  sd.innerHTML=`<button class="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button>`+html; sd.hidden=false;
  if(h.k==='ap'){ freqFill(o[0]); cloudWire(sd); if(/^[A-Z]{4}$/.test(o[0])) icbFill(o[0],{n:o[1],lat:o[2],lon:o[3],el:o[4]}); }
  if(h.k==='ap'&&ML&&LY.wx&&/^[A-Z]{4}$/.test(o[0])){ const c=WXS.c[o[0]]; if(!c||(!c.busy&&Date.now()-c.t>WX_TTL)) wxSync([o[0]]); }
  sd.onclick=e=>{ const b=e.target.closest('button'); if(!b) return; if(b.classList.contains('x')){ sd.hidden=true; return; } const a=b.dataset.a; if(a==='adg'&&ML){ ML.flyTo({center:[pt.lo,pt.la],zoom:14.6,duration:900}); return; } if(a==='dep'||a==='dst') setEnd(pt,a==='dep'?'dep':'dst'); else if(a==='add'){ addPoint(Object.assign({},pt,pt.t==='rwy'&&R.pts.length?{t:'wpt'}:{})); el('rtxt').value=routeStr(); if(R.pts.length>=2) sheetAuto(); } sd.hidden=true; }; }
// profilmodus
function advUsed(){ return !!((R.da&&(R.da.dep||R.da.arr))||(R.mk&&R.mk.length)||R.s.cl||R.s.ds||(R.app&&Object.values(R.app).some(Boolean))||R.wx); }
function pmode(){ if(!R) return 'ter'; const m=R.pm||(R.s.cr?(advUsed()?'adv':'alt'):'ter'); return m; }
function pmUI(){ const m=pmode(); ptUI(); el('pmode').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.p===m));  const t=document.querySelector('.rx-sheet .ptools'); if(t) t.hidden=m!=='adv'; const pg=document.querySelector('.rx-sheet .pgrid'); if(pg) pg.classList.toggle('np',m!=='adv'); }
el('pmode').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; R.pm=b.dataset.p; if(R.pm!=='ter'&&!R.s.cr){ R.s.cr=String(Math.max(3000,Math.ceil(((TP&&Math.max(0,...TP.pts.map(q=>q.e||0)))||0)/500)*500+1000)); el('s_cr').value=R.s.cr; } pmUI(); render(); queueSave(); });
// profil-skuff
const MOB=()=>window.innerWidth<=900;
let SHS='min'; try{ const v=localStorage.getItem('bb-rx-sheet'); if(['min','mid','full'].includes(v)) SHS=v; }catch(e){}
if(!MOB()) el('sheet').dataset.s=SHS;
try{ new ResizeObserver(()=>{ const sh=el('sheet'); el('rx').style.setProperty('--shh',(sh.dataset.s==='off'||window.innerWidth<=900?0:sh.offsetHeight)+'px'); }).observe(el('sheet')); }catch(e){}
function setSheet(st){ const sh=el('sheet'); sh.dataset.s=st; el('shOpen').hidden=!(st==='off'||(st==='min'&&MOB())); if(st!=='off'){ SHS=st; if(!MOB()) try{ localStorage.setItem('bb-rx-sheet',st); }catch(e){} } if(st==='min') setTimeout(()=>drawMini(),0);
  el('shTog').setAttribute('aria-expanded',String(sh.dataset.s!=='min')); setTimeout(shH,220); shH(); }
function shH(){ if(!R) return; const sh=el('sheet'); el('rx').style.setProperty('--shh',(sh.dataset.s==='off'||window.innerWidth<=900?0:sh.offsetHeight)+'px'); if(sh.dataset.s!=='min'&&sh.dataset.s!=='off') drawProfile(compute(),TP); else if(sh.dataset.s==='min') drawMini(); }
function sheetAuto(){ const sh=el('sheet'); if(MOB()&&sh.dataset.s==='min') el('shOpen').hidden=false; if(sh.dataset.s==='off'&&!el('shOpen').dataset.user) setSheet(MOB()?'min':SHS==='off'?'mid':SHS); else if(sh.dataset.s==='off') el('shOpen').hidden=false; else shH(); }
/* ---------- profile strip (collapsed profile): terrain, route line, highest point ---------- */
function drawMini(M,tp){ const sv=el('pmini'); if(!sv||el('sheet').dataset.s!=='min'||!R) return; M=M||compute(); tp=tp===undefined?TP:tp;
  const W=Math.round(sv.clientWidth), H=Math.round(sv.clientHeight); sv.innerHTML=''; if(W<50||H<20||!M.total||M.C.length<2) return; sv.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const add=(t,a)=>{ const e=document.createElementNS(NSV,t); for(const k in a) e.setAttribute(k,a[k]); sv.appendChild(e); return e; };
  const P=tp&&tp.pts?tp.pts.filter(p=>p.e!=null||p.c!=null):[]; const mx=P.length?Math.max(...P.map(p=>p.e||0)):0;
  const alt=M.PM!=='ter'&&M.altAt; const cr=M.cr||0; const top=niceTop(Math.max(mx,cr,1000)); const L0=10, R0=W-10, T0=14, B0=H-14;
  const X=x=>L0+(R0-L0)*x/M.total, Y=a=>B0-(B0-T0)*Math.max(0,a)/top;
  for(let a=0;a<=top;a+=axStep(top)*2) add('line',{x1:L0,x2:R0,y1:Y(a),y2:Y(a),stroke:'rgba(11,37,69,.07)'});
  if(P.length){ const d=P.map((p,i)=>(i?'L':'M')+X(p.x).toFixed(1)+' '+Y(p.c!=null?p.c:p.e).toFixed(1)).join(''); add('path',{d:d+`L${X(P[P.length-1].x).toFixed(1)} ${B0}L${X(P[0].x).toFixed(1)} ${B0}Z`,fill:'#C9B79A',stroke:'#8A6F4A','stroke-width':1});
    add('path',{d:P.map((p,i)=>(i?'L':'M')+X(p.x).toFixed(1)+' '+Y(p.e||0).toFixed(1)).join(''),fill:'none',stroke:'#8A6F4A','stroke-width':.8,'stroke-dasharray':'2 2',opacity:.7}); }
  add('line',{x1:L0,x2:R0,y1:B0,y2:B0,stroke:'rgba(11,37,69,.35)'});
  if(alt){ const n=120, pts=[]; for(let i=0;i<=n;i++){ const x=M.total*i/n; const a=M.altAt(x); if(a!=null&&Number.isFinite(a)) pts.push(X(x).toFixed(1)+' '+Y(a).toFixed(1)); } if(pts.length>1) add('path',{d:'M'+pts.join('L'),fill:'none',stroke:'#9A1E68','stroke-width':2}); }
  else if(cr) add('line',{x1:L0,x2:R0,y1:Y(cr),y2:Y(cr),stroke:'#9A1E68','stroke-width':1.5,'stroke-dasharray':'6 4'});
  const tx=(t,x,y,o)=>{ const e=add('text',Object.assign({x,y,'font-family':'IBM Plex Mono, monospace','font-size':10.5,fill:'#0B2545'},o||{})); e.textContent=t; return e; };
  const C=M.C.filter(c=>c.p.la!=null), few=C.length<=10;
  C.forEach((c,i)=>{ const x=X(c.x); add('line',{x1:x,x2:x,y1:T0-2,y2:B0,stroke:'rgba(11,37,69,.18)'}); if(few||i===0||i===C.length-1) tx(c.p.n||'',Math.min(R0,Math.max(L0,x)),H-3,{'text-anchor':i===0?'start':i===C.length-1?'end':'middle','font-size':10,fill:'#3A4D60'}); });
  if(P.length&&mx>0){ const hp=P.reduce((a,b)=>(b.e||0)>(a.e||0)?b:a); const x=X(hp.x), y=Y(hp.e); add('path',{d:`M${x-5} ${y-1}L${x+5} ${y-1}L${x} ${y+6}Z`,fill:'#B3261E'});
    tx(`${L({en:'Highest',no:'Høyeste'})} ${fx(mx)} ft`,Math.min(R0-4,Math.max(L0+4,x)),Math.max(11,y-4),{'text-anchor':x>W*0.8?'end':x<W*0.2?'start':'middle','font-weight':600,fill:'#B3261E',stroke:'#fff','stroke-width':3,'paint-order':'stroke'}); }
  if(cr&&!alt) tx(altTxt(cr),R0,Math.max(11,Y(cr)-3),{'text-anchor':'end',fill:'#9A1E68','font-weight':600,stroke:'#fff','stroke-width':3,'paint-order':'stroke'});
}
el('pmini').addEventListener('click',()=>setSheet('mid'));
/* drag the top edge of the profile to resize it; it snaps to strip, half or full */
{ const g=el('shGrip'), sh=el('sheet'); let y0=null, h0=0, moved=false;
  g.addEventListener('pointerdown',e=>{ if(MOB()) return; y0=e.clientY; h0=sh.offsetHeight; moved=false; sh.classList.add('drag'); g.setPointerCapture(e.pointerId); e.preventDefault(); });
  g.addEventListener('pointermove',e=>{ if(y0==null) return; const dy=y0-e.clientY; if(Math.abs(dy)>3) moved=true; if(!moved) return; const H=el('rx').clientHeight; sh.style.height=Math.max(44,Math.min(H,h0+dy))+'px'; });
  const end=()=>{ if(y0==null) return; y0=null; sh.classList.remove('drag'); const H=el('rx').clientHeight, h=sh.offsetHeight; sh.style.height='';
    if(!moved){ setSheet(sh.dataset.s==='min'?'mid':'min'); return; } setSheet(h<H*0.25?'min':h<H*0.72?'mid':'full'); };
  g.addEventListener('pointerup',end); g.addEventListener('pointercancel',end); }
/* route card: collapse to one line, remembered; in 3D it folds away so the flight panel has room */
{ const c=el('rcard'), b=el('rcTog'); let col=null; try{ col=localStorage.getItem('bb-rx-card'); }catch(e){} c.classList.toggle('col',col==null?MOB():col==='1');
  const aria=()=>b.setAttribute('aria-expanded',String(el('rx').classList.contains('d3')?c.classList.contains('x3o'):!c.classList.contains('col')));
  b.onclick=()=>{ if(el('rx').classList.contains('d3')) c.classList.toggle('x3o'); else { c.classList.toggle('col'); try{ localStorage.setItem('bb-rx-card',c.classList.contains('col')?'1':'0'); }catch(e){} } aria(); };
  aria(); try{ new ResizeObserver(()=>el('rx').style.setProperty('--rch',c.offsetHeight+'px')).observe(c); }catch(e){} }
el('shUp').onclick=()=>{ const s=el('sheet').dataset.s; setSheet(s==='min'?'mid':'full'); };
el('shDn').onclick=()=>{ const s=el('sheet').dataset.s; setSheet(s==='full'?'mid':'min'); };
el('shFull').onclick=()=>{ setSheet(el('sheet').dataset.s==='full'?'mid':'full'); };
el('shX').onclick=()=>{ el('shOpen').dataset.user='1'; setSheet('off'); };
el('shOpen').onclick=()=>{ delete el('shOpen').dataset.user; setSheet(SHS==='off'||SHS==='min'?'mid':SHS); };
el('shTog').onclick=()=>{ setSheet(el('sheet').dataset.s==='min'?'mid':'min'); };
el('shAdv').onclick=()=>{ const on=el('advp').hidden; if(on&&!el('nlp').hidden){ el('nlp').hidden=true; el('shNl').setAttribute('aria-pressed','false'); } el('advp').hidden=!on; el('xsMode').hidden=on; el('shAdv').setAttribute('aria-pressed',String(on)); el('shAdv').innerHTML=on?'←<span> '+L({en:'Profile',no:'Profil'})+'</span>':SET_IC+'<span> '+L({en:'Advanced',no:'Avansert'})+'</span>'; if(on){ el('shAdv').dataset.prev=el('sheet').dataset.s; if(el('sheet').dataset.s!=='full') setSheet('full'); } else { const pv=el('shAdv').dataset.prev; if(pv&&pv!=='full') setSheet(pv); drawProfile(compute(),TP); } };
/* ================= 3D-terreng og «Utforsk ruten» =================
   Alt lokalt: three.min.js fra nettstedet, terreng fra terrain/ (grovt) og terrain/hr/ (Norden, detaljert).
   Farger: hypsometrisk tint + relieffskygge (sol fra NV) + sjø i blått, valgfrie koter. Ingen satellittbilder. */
const T3={on:false,ready:null,ex:1.2,act:'off',ct:0,follow:true,cm:'ov',spd:5,drive:false,play:false,x:0,tok:0,G:null,S:null,raf:0,cam:null,newArea:true};
const FT3=0.0003048; // fot → km
const PHONE3=()=>window.innerWidth<=900||(window.matchMedia&&matchMedia('(pointer:coarse)').matches);
function load3(){ if(window.THREE) return Promise.resolve(); if(T3.ready) return T3.ready; T3.ready=new Promise((ok,ko)=>{ const sc=document.createElement('script'); sc.src='three.min.js?v=128'; sc.onload=ok; sc.onerror=()=>{ T3.ready=null; ko(new Error('three.min.js')); }; document.head.appendChild(sc); }); return T3.ready; }
function area3(){ const P=R.pts.filter(p=>p.la!=null); let a0,a1,o0,o1;
  if(P.length>=2){ a0=Math.min(...P.map(p=>p.la)); a1=Math.max(...P.map(p=>p.la)); o0=Math.min(...P.map(p=>p.lo)); o1=Math.max(...P.map(p=>p.lo)); const m=Math.max(0.35,(a1-a0)*0.35), mo=Math.max(0.7,(o1-o0)*0.35); a0-=m; a1+=m; o0-=mo; o1+=mo; }
  else { const w=mapEl.clientWidth, h=mapEl.clientHeight; [a1,o0]=inv(0,0); [a0,o1]=inv(w,h); }
  // høyst ca. 6°×12°
  const ca=(a0+a1)/2, co=(o0+o1)/2, ha=Math.min(3,(a1-a0)/2), ho=Math.min(6,(o1-o0)/2); return {a0:ca-ha,a1:ca+ha,o0:co-ho,o1:co+ho}; }
// detaljert terreng: brukes også av terrengprofilen
function hrGet(la,lo){ const I=HR.idx, d=I.deg, n=I.n; const a=Math.floor(la/d)*d, o=Math.floor(lo/d)*d; const t=HR.T[a+'_'+o]; if(!t) return 0; const r=Math.min(n-1,Math.max(0,Math.floor((a+d-la)/d*n))), c=Math.min(n-1,Math.max(0,Math.floor((lo-o)/d*n))); return t[r*n+c]; }
async function hr3(A,max){ await HR.ready; const I=HR.idx; if(!I) return false; const d=I.deg, ks=[]; for(let a=Math.floor(A.a0/d)*d;a<A.a1;a+=d) for(let o=Math.floor(A.o0/d)*d;o<A.o1;o+=d){ const k=a+'_'+o; if(I.tiles.includes(k)) ks.push(k); }
  if(!ks.length||ks.length>max) return false; await Promise.all(ks.map(hrTile)); return ks.some(k=>HR.T[k]); }
// bilineær høyde (fot) i en flis
function bil3(t,n,top,left,deg,la,lo){ const fr=Math.max(0,Math.min(n-1,(top-la)/deg*n-0.5)), fc=Math.max(0,Math.min(n-1,(lo-left)/deg*n-0.5)); const r=Math.floor(fr), c=Math.floor(fc), r1=Math.min(n-1,r+1), c1=Math.min(n-1,c+1), u=fr-r, v=fc-c;
  return (t[r*n+c]*(1-v)+t[r*n+c1]*v)*(1-u)+(t[r1*n+c]*(1-v)+t[r1*n+c1]*v)*u; }
/* bikubisk høyde (Catmull-Rom, 4×4 celler): myke skråninger og avrundede rygger mellom cellene, i stedet for
   knekk ved hver celle (bilineært) som gir et kantete «klosslandskap» når rutenettet er finere enn dataene */
function cub3(t,n,top,left,deg,la,lo){ const fr=Math.max(0,Math.min(n-1,(top-la)/deg*n-0.5)), fc=Math.max(0,Math.min(n-1,(lo-left)/deg*n-0.5)), r=Math.floor(fr), c=Math.floor(fc), u=fr-r, v=fc-c;
  const w=x=>{ const x2=x*x, x3=x2*x; return [(-x3+2*x2-x)/2,(3*x3-5*x2+2)/2,(-3*x3+4*x2+x)/2,(x3-x2)/2]; }, wu=w(u), wv=w(v); let s=0;
  for(let i=0;i<4;i++){ const rr=Math.max(0,Math.min(n-1,r-1+i))*n; let row=0; for(let j=0;j<4;j++) row+=t[rr+Math.max(0,Math.min(n-1,c-1+j))]*wv[j]; s+=row*wu[i]; }
  return Math.max(0,s); }
// detaljerte nordiske data der de finnes, ellers det grove rutenettet
function e3(la,lo,hr){ const I=HR.idx; if(hr&&I){ const d=I.deg, a=Math.floor(la/d)*d, o=Math.floor(lo/d)*d, t=HR.T[a+'_'+o]; if(t) return {e:cub3(t,I.n,a+d,o,d,la,lo),h:1}; }
  const n=TERRAIN.n(); if(!n) return {e:0,h:0}; const a=Math.floor(la/5)*5, o=Math.floor(lo/5)*5, t=TERRAIN.raw(a+'_'+o); return {e:t?bil3(t,n,a+5,o,5,la,lo):0,h:0}; }
// høydegitter for området (gjenbrukes når bare overdrivelse, koter eller ruten endres)
async function grid3(A,tok){ const ph=PHONE3(), NV=ph?110000:380000; const la0=(A.a0+A.a1)/2, lo0=(A.o0+A.o1)/2, kx=111.32*Math.cos(la0*D2R), kz=111.32;
  const key=[A.a0,A.a1,A.o0,A.o1].map(v=>v.toFixed(3)).join(',')+'|'+NV; if(T3.G&&T3.G.key===key) return T3.G;
  const keys=new Set(); for(let a=Math.floor(A.a0/5)*5;a<=A.a1;a+=5) for(let o=Math.floor(A.o0/5)*5;o<=A.o1;o+=5) keys.add(a+'_'+o);
  await TERRAIN.ready; await TERRAIN.load([...keys]); const hr=await hr3(A,ph?12:24); if(tok!==T3.tok) return null;
  // rutenett innenfor et fast antall hjørner (mobil: 110 000); dataene interpoleres bikubisk ned til ≈ 0,22 km (detaljert) / 0,6 km (grovt)
  const W=(A.o1-A.o0)*kx, H=(A.a1-A.a0)*kz, stp=Math.max(Math.sqrt(W*H/NV),hr?0.22:0.6,Math.max(W,H)/2400), ro=Math.max(2,Math.round(W/stp)+1), ra=Math.max(2,Math.round(H/stp)+1);
  const raw=new Float32Array(ra*ro); let nh=0; for(let i=0;i<ra;i++){ const la=A.a1-i*(A.a1-A.a0)/(ra-1); for(let j=0;j<ro;j++){ const s=e3(la,A.o0+j*(A.o1-A.o0)/(ro-1),hr); raw[i*ro+j]=Math.max(0,s.e); nh+=s.h; } }
  // utjevning: grove celler er «høyeste punkt», som gir kantete topper; sjø (0) beholdes
  let h=raw; for(let p=0;p<(hr?1:2);p++){ const o=new Float32Array(ra*ro); for(let i=0;i<ra;i++) for(let j=0;j<ro;j++){ const k=i*ro+j; if(raw[k]<1){ o[k]=0; continue; } let s=0,w=0; for(let di=-1;di<=1;di++) for(let dj=-1;dj<=1;dj++){ const ii=i+di, jj=j+dj; if(ii<0||jj<0||ii>=ra||jj>=ro) continue; const ww=(di||dj)?((di&&dj)?1:2):4; s+=h[ii*ro+jj]*ww; w+=ww; } o[k]=s/w; } h=o; }
  return T3.G={key,A,ra,ro,raw,h,hr:nh>ra*ro*0.25,hrPart:nh>0&&nh<ra*ro*0.98,la0,lo0,kx,kz,W,H}; }
// rolig kartpalett (papir/blekk): lavland salvie → lys oker → brun → grått → hvitt
const HYP3=[[0,[205,221,190]],[400,[214,226,192]],[1200,[228,229,196]],[2200,[234,224,188]],[3300,[224,204,164]],[4500,[204,180,146]],[5800,[184,168,150]],[7500,[214,210,204]],[10000,[244,243,240]]];
function hyp3(e){ for(let i=1;i<HYP3.length;i++){ if(e<=HYP3[i][0]){ const [e0,c0]=HYP3[i-1],[e1,c1]=HYP3[i], f=(e-e0)/(e1-e0); return [c0[0]+(c1[0]-c0[0])*f,c0[1]+(c1[1]-c0[1])*f,c0[2]+(c1[2]-c0[2])*f]; } } return HYP3[HYP3.length-1][1]; }
const SEA3=[188,211,226], SKY3=0xE9EEF0, CLS3={g:0x2E7D4F,a:0xC77700,r:0xB3261E,n:0x9A1E68};
const VS3='attribute vec3 tcol; attribute float elev; varying vec3 vC; varying float vE; varying float vD; void main(){ vC=tcol; vE=elev; vec4 mv=modelViewMatrix*vec4(position,1.0); vD=-mv.z; gl_Position=projectionMatrix*mv; }';
const FS3='uniform float uI; uniform vec3 uFog; uniform float uN; uniform float uF; varying vec3 vC; varying float vE; varying float vD;\n'+
 'void main(){ vec3 c=vC; if(uI>0.0&&vE>1.0){ float f=vE/uI; float w=fwidth(f); float d=abs(fract(f+0.5)-0.5)/max(w,1e-4); float l=(1.0-clamp(d-0.3,0.0,1.0))*(1.0-smoothstep(0.18,0.45,w)); c=mix(c,vec3(0.44,0.35,0.24),l*0.4); }\n'+
 ' c=mix(c,uFog,smoothstep(uN,uF,vD)); gl_FragColor=vec4(c,1.0); }';
function terr3(G){ const THR=THREE, {ra,ro,h,raw,W,H}=G, n=ra*ro, ex=T3.ex, dx=W/(ro-1), dz=H/(ra-1);
  const pos=new Float32Array(n*3), col=new Float32Array(n*3), elv=new Float32Array(n), Lx=-0.5, Ly=0.7071, Lz=-0.5;
  for(let i=0;i<ra;i++) for(let j=0;j<ro;j++){ const k=i*ro+j, e=h[k]; pos[k*3]=-W/2+j*dx; pos[k*3+1]=e*FT3*ex; pos[k*3+2]=-H/2+i*dz; elv[k]=e;
    let c; if(raw[k]<1) c=SEA3; else { const jw=Math.max(0,j-1), je=Math.min(ro-1,j+1), iN=Math.max(0,i-1), iS=Math.min(ra-1,i+1);
      const gx=(h[i*ro+je]-h[i*ro+jw])*FT3*ex/((je-jw)*dx), gz=(h[iS*ro+j]-h[iN*ro+j])*FT3*ex/((iS-iN)*dz); const nl=Math.hypot(gx,1,gz);
      const sh=(-gx*Lx+Ly-gz*Lz)/nl/Ly; const m=Math.max(0.5,Math.min(1.13,0.7+0.3*sh)); const t=hyp3(e); c=[t[0]*m,t[1]*m,t[2]*m]; }
    col[k*3]=Math.min(255,c[0])/255; col[k*3+1]=Math.min(255,c[1])/255; col[k*3+2]=Math.min(255,c[2])/255; }
  const idx=new (n>65535?Uint32Array:Uint16Array)((ra-1)*(ro-1)*6); let q=0; for(let i=0;i<ra-1;i++) for(let j=0;j<ro-1;j++){ const a=i*ro+j, b=a+1, c=a+ro, d=c+1; idx[q++]=a; idx[q++]=c; idx[q++]=b; idx[q++]=b; idx[q++]=c; idx[q++]=d; }
  const geo=new THR.BufferGeometry(); geo.setAttribute('position',new THR.BufferAttribute(pos,3)); geo.setAttribute('tcol',new THR.BufferAttribute(col,3)); geo.setAttribute('elev',new THR.BufferAttribute(elv,1)); geo.setIndex(new THR.BufferAttribute(idx,1));
  const span=Math.max(W,H), mat=new THR.ShaderMaterial({vertexShader:VS3,fragmentShader:FS3,extensions:{derivatives:true},uniforms:{uI:{value:T3.ct},uFog:{value:new THR.Color(SKY3)},uN:{value:span*1.2},uF:{value:span*3.4}}});
  const mesh=new THR.Mesh(geo,mat);
  // kantvegg ned til en sokkel, så modellen ser ut som en blokk på papiret
  const base=-Math.max(0.6,span*0.012), ring=[]; for(let j=0;j<ro;j++) ring.push(j); for(let i=1;i<ra;i++) ring.push(i*ro+ro-1); for(let j=ro-2;j>=0;j--) ring.push((ra-1)*ro+j); for(let i=ra-2;i>0;i--) ring.push(i*ro); ring.push(0);
  const sp=new Float32Array(ring.length*6); ring.forEach((k,m)=>{ sp.set([pos[k*3],pos[k*3+1],pos[k*3+2],pos[k*3],base,pos[k*3+2]],m*6); }); const si=[]; for(let m=0;m<ring.length-1;m++){ const a=m*2; si.push(a,a+1,a+2,a+1,a+3,a+2); }
  const sg=new THR.BufferGeometry(); sg.setAttribute('position',new THR.BufferAttribute(sp,3)); sg.setIndex(si); const skirt=new THR.Mesh(sg,new THR.MeshBasicMaterial({color:0xC9C2B4,side:THR.DoubleSide}));
  return {mesh,skirt,mat}; }
// TP-punktet nærmest en avstand langs ruten
function tpq(x){ if(!TP||!TP.pts||!TP.pts.length) return null; const P=TP.pts, st=P.length>1?(P[1].x-P[0].x):1; return P[Math.max(0,Math.min(P.length-1,Math.round((x-P[0].x)/Math.max(1e-6,st))))]; }
// samme logikk som røde og oransje prikker i profilen
function cls3(M,x){ if(M.PM==='ter') return 'n'; const q=tpq(x); if(!q||q.e==null||!enr(M,q.x)) return 'n'; return isHit(M,q)?'r':isLow(M,q)?'a':'g'; }
function tube3(pts,cols,r){ const THR=THREE, seg=6, n=pts.length, pos=new Float32Array(n*(seg+1)*3), col=new Float32Array(n*(seg+1)*3), up=new THR.Vector3(0,1,0), t=new THR.Vector3(), nn=new THR.Vector3(), b=new THR.Vector3(), cc=new THR.Color();
  for(let i=0;i<n;i++){ t.subVectors(pts[Math.min(n-1,i+1)],pts[Math.max(0,i-1)]).normalize(); nn.crossVectors(t,up); if(nn.lengthSq()<1e-8) nn.set(1,0,0); nn.normalize(); b.crossVectors(nn,t).normalize(); cc.setHex(cols[i]);
    for(let s=0;s<=seg;s++){ const a=s/seg*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a), k=(i*(seg+1)+s)*3, m=0.78+0.22*sa; pos[k]=pts[i].x+r*(ca*nn.x+sa*b.x); pos[k+1]=pts[i].y+r*(ca*nn.y+sa*b.y); pos[k+2]=pts[i].z+r*(ca*nn.z+sa*b.z); col[k]=cc.r*m; col[k+1]=cc.g*m; col[k+2]=cc.b*m; } }
  const idx=[]; for(let i=0;i<n-1;i++) for(let s=0;s<seg;s++){ const a=i*(seg+1)+s, c=a+seg+1; idx.push(a,c,a+1,a+1,c,c+1); }
  const g=new THR.BufferGeometry(); g.setAttribute('position',new THR.BufferAttribute(pos,3)); g.setAttribute('color',new THR.BufferAttribute(col,3)); g.setIndex(idx); return new THR.Mesh(g,new THR.MeshBasicMaterial({vertexColors:true})); }
function label3(t,v,c,small){ const cv=document.createElement('canvas'); const g=cv.getContext('2d'); const f='700 28px "Public Sans", Arial, sans-serif'; g.font=f; const w=Math.ceil(g.measureText(t).width)+20; cv.width=w; cv.height=44; g.font=f; g.fillStyle='rgba(255,255,255,.92)'; g.fillRect(0,0,w,44); g.fillStyle=c; g.fillRect(0,40,w,4); g.fillText(t,10,31);
  const tex=new THREE.CanvasTexture(cv); tex.minFilter=THREE.LinearFilter; tex.generateMipmaps=false; const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true})); sp.position.copy(v); sp.center.set(0.5,-0.35); sp.userData.k=w/44; sp.userData.small=!!small; sp.renderOrder=5; return sp; }
function disp3(o){ if(!o) return; o.traverse(x=>{ if(x.geometry) x.geometry.dispose(); const m=x.material; if(m){ (Array.isArray(m)?m:[m]).forEach(mm=>{ if(mm.map) mm.map.dispose(); mm.dispose(); }); } }); }
async function build3(){ const tok=++T3.tok; const A=area3(); const msg=el('m3msg');
  const G=await grid3(A,tok); if(!G||tok!==T3.tok||!T3.on) return;
  let M=compute(); if(M.total&&M.C.length>=2){ const tp=await terrainProfile(M); if(tok!==T3.tok||!T3.on) return; if(tp) TP=tp; M=compute(); }
  const THR=THREE, ex=T3.ex, E=ft=>(ft||0)*FT3*ex, X=lo=>(lo-G.lo0)*G.kx, Z=la=>-(la-G.la0)*G.kz, span=Math.max(G.W,G.H);
  const hAt=(la,lo)=>{ const fi=Math.max(0,Math.min(G.ra-1.001,(G.A.a1-la)/(G.A.a1-G.A.a0)*(G.ra-1))), fj=Math.max(0,Math.min(G.ro-1.001,(lo-G.A.o0)/(G.A.o1-G.A.o0)*(G.ro-1))), i=Math.floor(fi), j=Math.floor(fj), u=fi-i, v=fj-j, h=G.h, ro=G.ro; return (h[i*ro+j]*(1-v)+h[i*ro+j+1]*v)*(1-u)+(h[(i+1)*ro+j]*(1-v)+h[(i+1)*ro+j+1]*v)*u; };
  const gAt=(la,lo)=>E(hAt(la,lo));
  if(T3.S) disp3(T3.S.scene); T3.S=null;
  const scene=new THR.Scene(); scene.background=new THR.Color(SKY3); const T=terr3(G); scene.add(T.mesh); scene.add(T.skirt);
  const lift=Math.max(0.03,span/1500), rr=Math.max(0.04,Math.min(0.35,span/1800));
  const ptAt=x=>{ const q=M.posAt(x); if(!q||q.la==null) return null; const g=gAt(q.la,q.lo); return new THR.Vector3(X(q.lo), M.PM==='ter'? g+lift*2 : E(M.altAt(x)), Z(q.la)); };
  const route=new THR.Group(); scene.add(route); let hi=null;
  if(M.C.length>=2&&M.total>0){ const n=Math.max(80,Math.min(PHONE3()?400:700,Math.round(M.total*3))); const xs=new Set(); for(let i=0;i<=n;i++) xs.add(+(M.total*i/n).toFixed(4)); M.C.forEach(c=>{ if(c.x>=0&&c.x<=M.total) xs.add(+c.x.toFixed(4)); });
    const XS=[...xs].sort((a,b)=>a-b), pts=[], gp=[], cs=[]; XS.forEach(x=>{ const p=ptAt(x), q=M.posAt(x); if(!p||!q) return; pts.push(p); gp.push(gAt(q.la,q.lo)); cs.push(CLS3[cls3(M,x)]); });
    if(pts.length>1){ route.add(tube3(pts,cs,rr));
      if(M.PM!=='ter'){ // gardin ned til terrenget, farget etter margin
        const cp=new Float32Array(pts.length*6), cc=new Float32Array(pts.length*6), C3=new THR.Color(); pts.forEach((p,i)=>{ cp.set([p.x,p.y,p.z,p.x,Math.min(p.y,gp[i]),p.z],i*6); C3.setHex(cs[Math.min(cs.length-1,i)]); cc.set([C3.r,C3.g,C3.b,C3.r,C3.g,C3.b],i*6); });
        const ci=[]; for(let i=0;i<pts.length-1;i++){ const a=i*2; ci.push(a,a+1,a+2,a+1,a+3,a+2); } const cg=new THR.BufferGeometry(); cg.setAttribute('position',new THR.BufferAttribute(cp,3)); cg.setAttribute('color',new THR.BufferAttribute(cc,3)); cg.setIndex(ci);
        route.add(new THR.Mesh(cg,new THR.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.2,side:THR.DoubleSide,depthWrite:false})));
        const sp=pts.map((p,i)=>new THR.Vector3(p.x,gp[i]+lift,p.z)); route.add(new THR.Line(new THR.BufferGeometry().setFromPoints(sp),new THR.LineBasicMaterial({color:0x13202A,transparent:true,opacity:.45}))); } }
    // punkter med navn
    const dot=new THR.SphereGeometry(rr*1.9,10,8), dm=new THR.MeshBasicMaterial({color:0x13202A});
    M.C.forEach(c=>{ const p=c.p; if(p.la==null||['missed','alt'].includes(p.t)) return; const v=ptAt(c.x)||new THR.Vector3(X(p.lo),gAt(p.la,p.lo),Z(p.la)); const d=new THR.Mesh(dot,dm); d.position.copy(v); route.add(d); route.add(label3(p.n||'',v,p.t==='rwy'?'#7A1652':'#13202A')); });
    // høyeste terreng i korridoren (samme tall som profilen)
    if(TP&&TP.pts){ const ter=M.PM==='ter', vOf=q=>ter?(q.c!=null?q.c:q.e):q.e; let b=null; TP.pts.forEach(q=>{ const v=vOf(q); if(v!=null&&(!b||v>b.v)) b={x:q.x,v,c:q.c,e:q.e}; }); if(b) b.e=b.v;
      if(b&&b.e>0){ const s=M.posAt(b.x); if(s&&s.la!=null){ const cw=sNum('cw',4.3), tr=(s.tr==null?0:s.tr)*D2R, nOff=Math.max(1,Math.ceil(cw)); let bl={la:s.la,lo:s.lo,e:-1};
          if(!ter) for(let k=-nOff;k<=nOff;k++){ const o=k*cw/nOff, la=s.la+o*Math.cos(tr+Math.PI/2)/60, lo=s.lo+o*Math.sin(tr+Math.PI/2)/60/Math.cos(s.la*D2R); const e=TERRAIN.get(la,lo); if(e!=null&&e>bl.e) bl={la,lo,e}; }
          if(ter||(b.c!=null&&b.c>=bl.e)) bl={la:s.la,lo:s.lo,e:b.e};
          const gv=new THR.Vector3(X(bl.lo),gAt(bl.la,bl.lo),Z(bl.la)), ph=Math.max(1.2,span/70), pin=new THR.Mesh(new THR.ConeGeometry(ph*0.22,ph*0.6,4),new THR.MeshBasicMaterial({color:0x6B4A2B}));
          pin.rotation.x=Math.PI; pin.position.set(gv.x,gv.y+ph*0.3,gv.z); scene.add(pin); const top=gv.clone(); top.y+=ph*0.6; const lb=label3('▲ '+fx(Math.round(b.e))+' ft',top,'#6B4A2B'); scene.add(lb); hi={x:b.x,e:b.e}; } } } }
  // andre flyplasser i området (de største først)
  if(NAV){ const ap=NAV.ap.filter(a=>a[5]>=1&&a[2]>=G.A.a0&&a[2]<=G.A.a1&&a[3]>=G.A.o0&&a[3]<=G.A.o1&&!M.C.some(c=>c.p.n===a[0])).sort((a,b)=>(b[5]||0)-(a[5]||0)).slice(0,PHONE3()?12:30);
    ap.forEach(a=>scene.add(label3(a[0],new THR.Vector3(X(a[3]),gAt(a[2],a[3]),Z(a[2])),'#2C5F8D',true))); }
  // flyet og skyggen
  const ms=Math.max(0.3,Math.min(1.6,span/350)), mk=new THR.Group(), tri=new THR.Mesh(new THR.ConeGeometry(ms*0.45,ms*1.4,12),new THR.MeshBasicMaterial({color:0x1D4E9E})); tri.rotation.x=Math.PI/2; mk.add(tri); mk.visible=false; scene.add(mk);
  const shd=new THR.Mesh(new THR.CircleGeometry(ms*0.5,20),new THR.MeshBasicMaterial({color:0x13202A,transparent:true,opacity:.3,depthWrite:false})); shd.rotation.x=-Math.PI/2; shd.visible=false; scene.add(shd);
  T3.S={scene,mat:T.mat,mk,shd,X,Z,E,gAt,ptAt,M,G,span,hi};
  if(CAM){ CAM.near=Math.max(0.02,span/4000); CAM.far=span*8; CAM.updateProjectionMatrix(); }
  if(!T3.cam||T3.newArea){ cam3(); T3.newArea=false; }
  if(T3.x>M.total) T3.x=0; ui3(); if(msg) msg.hidden=true; kick3(); }
// utgangsvisning: på skrå fra siden av ruten, hele ruten i bildet
function cam3(){ const Q=T3.S; if(!Q) return; const M=Q.M, P=M.C.filter(c=>c.p.la!=null&&!['missed','alt'].includes(c.p.t)); let tx=0,ty=0,tz=0,th=0.35,half=Q.span*0.45;
  if(P.length>=2){ const xs=P.map(c=>Q.X(c.p.lo)), zs=P.map(c=>Q.Z(c.p.la)); const x0=Math.min(...xs), x1=Math.max(...xs), z0=Math.min(...zs), z1=Math.max(...zs); tx=(x0+x1)/2; tz=(z0+z1)/2; half=Math.max(8,Math.hypot(x1-x0,z1-z0)/2*1.08);
    let dx=xs[xs.length-1]-xs[0], dz=zs[zs.length-1]-zs[0]; if(Math.hypot(dx,dz)<1e-3){ dx=1; dz=0; } let px=-dz, pz=dx; if(pz<0){ px=-px; pz=-pz; } th=Math.atan2(px,pz)+0.3; ty=M.PM==='ter'?0:Q.E(M.altAt(M.total/2))*0.5; }
  const cv=el('m3d'), asp=Math.max(0.45,((cv.clientWidth||1)-pw3())/(cv.clientHeight||1)), hf=Math.atan(Math.tan(22.5*D2R)*asp);
  T3.cam={tx,ty,tz,r:Math.min(Q.span*2.6,half/Math.tan(hf)*1.05+half*0.25),th,ph:0.95}; T3.drive=false; T3.snap=true; }
let RND=null, CAM=null;
function rnd3(){ if(RND) return; const cv=el('m3d'); RND=new THREE.WebGLRenderer({canvas:cv,antialias:!PHONE3()||(window.devicePixelRatio||1)<2,powerPreference:'default'}); RND.setPixelRatio(Math.min(PHONE3()?1.5:2,window.devicePixelRatio||1)); CAM=new THREE.PerspectiveCamera(45,1,0.05,8000); T3.w=T3.h=0;
  cv.addEventListener('webglcontextlost',e=>{ e.preventDefault(); T3.lost=true; }); cv.addEventListener('webglcontextrestored',()=>{ T3.lost=false; if(T3.on) build3(); });
  if(window.ResizeObserver) new ResizeObserver(()=>kick3()).observe(cv); }
function pw3(){ const p=el('x3w'); if(window.innerWidth<=900||!p||p.hidden) return 0; return Math.round(p.offsetWidth+p.offsetLeft); }
function kick3(){ if(ML) return mlKick3(); if(!T3.on||T3.raf||document.hidden||!T3.S) return; T3.raf=requestAnimationFrame(frame3); }
function frame3(now){ T3.raf=0; if(!T3.on||!T3.S||document.hidden||T3.lost) return; const cv=el('m3d'), w=cv.clientWidth, h=cv.clientHeight; if(!w||!h) return;
  const pw=pw3(); if(w!==T3.w||h!==T3.h||pw!==T3.pw){ RND.setSize(w,h,false); CAM.aspect=(w+pw)/h; if(pw) CAM.setViewOffset(w+pw,h,0,0,w,h); else CAM.clearViewOffset(); CAM.updateProjectionMatrix(); T3.w=w; T3.h=h; T3.pw=pw; }
  const dt=T3.t?Math.min(0.1,(now-T3.t)/1000):0; T3.t=now; const Q=T3.S, M=Q.M, tot=M.total||0;
  if(T3.play&&tot>0){ T3.x=Math.min(tot,T3.x+dt*simAdv()); el('x3r').value=T3.x; simHov(T3.x,now); if(T3.x>=tot){ T3.play=false; ui3p(); } }
  else if(HOV!=null&&Math.abs(HOV-T3.x)>1e-6){ T3.x=HOV; el('x3r').value=HOV; x3ro(HOV); }
  const c=T3.cam; let want=null, look=null; const at=T3.play||HOV!=null? (T3.play?T3.x:HOV) : null;
  if(at!=null&&tot>0){ const p=Q.ptAt(at); if(p){ const dd=Math.max(0.3,tot*0.01), p2=Q.ptAt(Math.min(tot,at+dd))||p, p0=Q.ptAt(Math.max(0,at-dd))||p; const dir=new THREE.Vector3().subVectors(p2,p0); dir.y=0; if(dir.lengthSq()<1e-8) dir.set(0,0,-1); dir.normalize();
      Q.mk.position.copy(p); Q.mk.lookAt(p.x+dir.x,p.y,p.z+dir.z); Q.mk.visible=true; const q=M.posAt(at); if(q){ Q.shd.position.set(p.x,Q.gAt(q.la,q.lo)+0.05,p.z); Q.shd.visible=M.PM!=='ter'; }
      Q.mk.visible=!(T3.cm==='cockpit'&&T3.drive);
      if(T3.cm==='cockpit'&&T3.drive){ const f=Math.max(4,Math.min(20,Q.span*0.06)); want=new THREE.Vector3(p.x,p.y+0.03,p.z); look=new THREE.Vector3(p.x+dir.x*f,p.y-f*0.12,p.z+dir.z*f); }
      else if(T3.cm!=='ov'&&T3.drive){ const back=Math.max(3,Math.min(14,Q.span*0.05)); want=new THREE.Vector3(p.x-dir.x*back,p.y+back*0.55,p.z-dir.z*back); look=new THREE.Vector3(p.x+dir.x*back*1.2,p.y-back*0.2,p.z+dir.z*back*1.2); } } }
  else { Q.mk.visible=false; Q.shd.visible=false; }
  if(!want){ want=new THREE.Vector3(c.tx+c.r*Math.sin(c.ph)*Math.sin(c.th), c.ty+c.r*Math.cos(c.ph), c.tz+c.r*Math.sin(c.ph)*Math.cos(c.th)); look=new THREE.Vector3(c.tx,c.ty,c.tz); }
  if(!T3.cp||T3.snap){ T3.cp=want.clone(); T3.cl=look.clone(); T3.snap=false; }
  const k=dt>0?1-Math.exp(-dt*(T3.drive?5:16)):0.35; T3.cp.lerp(want,k); T3.cl.lerp(look,k); const mv=T3.cp.distanceTo(want)>Q.span*1e-5||T3.cl.distanceTo(look)>Q.span*1e-5;
  CAM.position.copy(T3.cp); CAM.lookAt(T3.cl); scaleLabels(); RND.render(Q.scene,CAM); simHud(at!=null?at:T3.x);
  if(T3.play||mv) kick3(); else T3.t=0; }
function scaleLabels(){ const ph=PHONE3()?1.25:1; T3.S.scene.traverse(o=>{ if(o.isSprite){ const d=CAM.position.distanceTo(o.position); const s=d*(o.userData.small?0.02:0.03)*ph; o.scale.set(s*o.userData.k,s,1); } }); }
function ui3p(){ el('x3play').textContent=T3.play?'❚❚ '+L({en:'Pause',no:'Pause'}):'▶ '+L({en:'Fly the route',no:'Fly ruten'}); simBtnUI(); el('x3play').setAttribute('aria-label',T3.play?L({en:'Pause',no:'Pause'}):L({en:'Fly the route',no:'Fly ruten'})); }
function ui3(){ const Q=T3.S, G=Q&&Q.G, M=Q&&Q.M;
  el('x3d').textContent=!G?'':G.hr?(G.hrPart?L({en:'Detailed terrain (≈ 450 m) in the Nordics, coarse (≈ 1.8 km) elsewhere',no:'Detaljert terreng (≈ 450 m) i Norden, grovt (≈ 1,8 km) ellers'}):L({en:'Detailed terrain (≈ 450 m)',no:'Detaljert terreng (≈ 450 m)'})):L({en:'Coarse terrain (≈ 1.8 km): detailed data covers the Nordics',no:'Grovt terreng (≈ 1,8 km): detaljerte data dekker Norden'});
  const has=!!(M&&M.C.length>=2&&M.total>0); el('x3').hidden=!has; if(has) el('x3r').max=String(Math.round(M.total*10)/10);
  el('x3leg').hidden=!has||M.PM==='ter'; el('x3pm').hidden=!has||M.PM!=='ter';
  el('x3ex').textContent=L({en:'Terrain ×',no:'Terreng ×'})+T3.ex+(T3.ex>1&&!PHONE3()?' '+L({en:'(exaggerated)',no:'(overdrevet)'}):''); ui3p(); if(has) x3ro(T3.x); }
async function set3(on){ if(ML) return ml3(on); T3.on=on; el('rx').classList.toggle('d3',on); el('m3d').hidden=!on; el('map').classList.toggle('dim3',on); el('v23').querySelectorAll('button').forEach(b=>b.classList.toggle('on',(b.dataset.v==='3')===on)); el('x3w').hidden=!on;
  if(!on){ T3.play=false; T3.tok++; el('simhud').hidden=true; simBtnUI(); if(T3.raf){ cancelAnimationFrame(T3.raf); T3.raf=0; } if(T3.S){ const c=T3.cam, Q=T3.S; if(c){ V.lo=Q.G.lo0+c.tx/Q.G.kx; V.la=Q.G.la0-c.tz/Q.G.kz; } disp3(Q.scene); T3.S=null; } el('m3msg').hidden=true; drawMap(); return; }
  if(window.innerWidth<=900&&el('sheet').dataset.s==='mid') setSheet('min');
  el('m3msg').hidden=false; el('m3msg').textContent=L({en:'Loading the terrain…',no:'Laster terrenget …'});
  try{ await load3(); rnd3(); T3.newArea=true; await build3(); }
  catch(e){ el('m3msg').hidden=false; el('m3msg').textContent=L({en:'3D could not start here (WebGL or the 3D library is unavailable). The 2D map still works.',no:'3D kunne ikke starte her (WebGL eller 3D-biblioteket er ikke tilgjengelig). 2D-kartet virker fortsatt.'}); } }
el('v23').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b&&(b.dataset.v==='3')!==T3.on) set3(b.dataset.v==='3'); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden){ T3.t=0; } else kick3(); });
// kamerastyring: dra = roter, høyre-/Shift-dra eller to fingre = flytt, hjul eller knip = zoom
{ const cv=el('m3d'); const P=new Map(); let pin=null;
  const fromChase=()=>{ if(!T3.drive||!T3.cp||!T3.cam) return; const c=T3.cam, off=T3.cp.clone().sub(T3.cl); c.tx=T3.cl.x; c.ty=T3.cl.y; c.tz=T3.cl.z; c.r=off.length(); c.ph=Math.max(0.12,Math.min(1.45,Math.acos(Math.max(-1,Math.min(1,off.y/c.r))))); c.th=Math.atan2(off.x,off.z); T3.drive=false; };
  const pan=(dx,dy)=>{ const c=T3.cam, k=c.r/Math.max(300,cv.clientHeight)*1.1; c.tx-=(dx*Math.cos(c.th)+dy*Math.sin(c.th))*k; c.tz-=(-dx*Math.sin(c.th)+dy*Math.cos(c.th))*k; const G=T3.S&&T3.S.G; if(G){ c.tx=Math.max(-G.W/2,Math.min(G.W/2,c.tx)); c.tz=Math.max(-G.H/2,Math.min(G.H/2,c.tz)); } };
  const zoom=f=>{ const c=T3.cam; c.r=Math.max(1,Math.min(T3.S.span*3,c.r*f)); };
  cv.addEventListener('pointerdown',e=>{ if(!T3.cam) return; cv.setPointerCapture(e.pointerId); P.set(e.pointerId,{x:e.clientX,y:e.clientY,pan:e.button===2||e.shiftKey||e.ctrlKey}); fromChase(); pin=null; cv.style.cursor='grabbing'; });
  cv.addEventListener('pointermove',e=>{ const p=P.get(e.pointerId); if(!p||!T3.cam||!T3.S) return; const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY; const c=T3.cam;
    if(P.size>=2){ const [a,b]=[...P.values()]; const d=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)), mx=(a.x+b.x)/2, my=(a.y+b.y)/2; if(pin){ zoom(pin.d/d); pan(mx-pin.mx,my-pin.my); } pin={d,mx,my}; }
    else if(p.pan) pan(dx,dy); else { c.th-=dx*0.006; c.ph=Math.max(0.12,Math.min(1.45,c.ph-dy*0.005)); } kick3(); });
  const up=e=>{ P.delete(e.pointerId); pin=null; if(!P.size) cv.style.cursor=''; }; cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up); cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('wheel',e=>{ e.preventDefault(); if(!T3.cam||!T3.S) return; fromChase(); zoom(e.deltaY<0?0.88:1.14); kick3(); },{passive:false}); }
// utforsk ruten: fly, pause og spol (synket med profilen og avlesningen)
function x3ro(x){ simHud(x); const M=ML?compute():(T3.S&&T3.S.M); if(!M) return; const q=tpq(x), t=q&&q.e, a=M.PM==='ter'?null:M.altAt(x);
  el('x3o').textContent=`${fx(x,1)} / ${fx(M.total,1)} NM`+(t!=null?` · ${L({en:'terrain',no:'terreng'})} ${fx(Math.round(t))} ft`:'')+(a!=null?` · ${L({en:'line',no:'linje'})} ${altTxt(Math.round(a/10)*10)}`:'')+(a!=null&&t!=null?` (${a-t>=0?'+':'−'}${fx(Math.abs(Math.round((a-t)/10)*10))} ft)`:''); }
el('x3r').addEventListener('input',()=>{ const x=+el('x3r').value; T3.x=x; T3.drive=T3.cm!=='ov'; setHov(x,true); x3ro(x); kick3(); });
el('x3play').onclick=()=>{ const tot=ML?simM().total:(T3.S&&T3.S.M.total); if(!tot) return; if(T3.loading){ el('simskip').click(); return; } /* during buffering, Fly (or Space) skips it */ T3.play=!T3.play; if(T3.play){ if(T3.x>=tot-1e-6) T3.x=0; T3.drive=T3.cm!=='ov'; T3.t=0; if(ML&&!T3.pf) T3.pf={zc:Math.max(8,Math.min(15,ML.getZoom())),toX:T3.x,readyX:T3.x+0.5,busy:false}; } ui3p(); kick3(); };
el('x3ac').addEventListener('change',()=>{ T3.act=el('x3ac').value; if(ML){ if(T3.on&&T3.cm==='chase') ac3Load(); mlKick3(); } });
el('x3cam').addEventListener('click',e=>{ const b=e.target.closest('[data-c]'); if(b) setCam(b.dataset.c); });
el('x3spd').addEventListener('change',()=>{ T3.spd=+el('x3spd').value||5; try{ localStorage.setItem('bb-rx-simspd3',String(T3.spd)); }catch(e){} });
try{ const v=+localStorage.getItem('bb-rx-simspd3'); if([1,5,10,20,30,60].includes(v)){ T3.spd=v; el('x3spd').value=String(v); } }catch(e){}
el('x3exs').addEventListener('change',()=>{ T3.ex=+el('x3exs').value; if(ML){ if(T3.on){ RXMAP.set3D(ML,true,T3.ex); mlUi3(); drawMap(); } return; } if(T3.on&&T3.S){ const old=T3.S.E(1000)||1, c=T3.cam; build3().then(()=>{ if(c&&T3.S) c.ty*=T3.S.E(1000)/old; T3.snap=true; kick3(); }); } });
{ let t=0; const go=d=>{ const k=2.2; if(d==='l') lookBy(-k,0); else if(d==='r') lookBy(k,0); else if(d==='u') lookBy(0,k*0.8); else if(d==='d') lookBy(0,-k*0.8); };
  const stop=()=>{ clearInterval(t); t=0; }; const pad=el('x3look');
  pad.addEventListener('pointerdown',e=>{ const b=e.target.closest('[data-l]'); if(!b) return; e.preventDefault(); if(!T3.drive||T3.cm==='ov') setCam(T3.cm==='ov'?'chase':T3.cm);
    if(b.dataset.l==='0'){ lookHome(); return; } go(b.dataset.l); stop(); t=setInterval(()=>go(b.dataset.l),30); });
  ['pointerup','pointerleave','pointercancel'].forEach(k=>pad.addEventListener(k,stop)); }
el('x3lt').addEventListener('change',()=>{ if(ML) RXMAP.setLight(ML,+el('x3lt').value); });
el('x3ct').addEventListener('change',()=>{ T3.ct=+el('x3ct').value; if(T3.S){ T3.S.mat.uniforms.uI.value=T3.ct; kick3(); } });
el('x3more').onclick=()=>{ const w=el('x3w'), o=!w.classList.contains('open'); w.classList.toggle('open',o); el('x3more').setAttribute('aria-expanded',String(o)); };
el('x3reset').onclick=()=>{ T3.play=false; ui3p(); if(ML){ ml3Fit(); return; } cam3(); kick3(); };
/* ================= Mitt bibliotek: ruter, lagrede visninger og notater ================= */
let VIEWS=[], NOTES=[];
async function libLoad(){ try{ VIEWS=await NSTORE.list('mapview'); NOTES=await NSTORE.list('mapnote'); }catch(e){} drawMap(); if(!el('lib').hidden) libDraw(); }
const dfmt=t=>{ try{ return new Date(t).toLocaleDateString(LAB.lang==='no'?'nb-NO':'en-GB',{day:'numeric',month:'short'}); }catch(e){ return ''; } };
function libDraw(){ const b=el('lib');
  const rs=ALL.map(r=>`<button class="li ${r===R?'on':''}" data-r="${esc(r.id)}"><b>${esc(r.title||L({en:'Untitled route',no:'Rute uten navn'}))}</b><i>${dfmt(r.updated)}</i></button>`).join('');
  const vs=VIEWS.map(v=>`<div class="lirow"><button class="li" data-v="${esc(v.id)}"><b>${esc(v.name)}</b><i>${v.d3?'3D · ':''}${esc((v.mm||'vfr').toUpperCase())}</i></button><button class="lx" data-dv="${esc(v.id)}" aria-label="Delete">×</button></div>`).join('')||`<p class="note">${L({en:'None yet. Save the current map view, 2D or 3D, to come back to it.',no:'Ingen ennå. Lagre kartvisningen du ser på, 2D eller 3D, for å komme tilbake til den.'})}</p>`;
  const ns=NOTES.map(n=>`<button class="li" data-n="${esc(n.id)}"><b>${esc((n.t||'').slice(0,40)||'…')}</b><i>${dfmt(n.updated)}</i></button>`).join('')||`<p class="note">${L({en:'Click an empty spot on the map and choose Note to pin a note there.',no:'Klikk på et tomt sted på kartet og velg Notat for å feste et notat der.'})}</p>`;
  b.innerHTML=`<button class="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button><h3>${L({en:'My library',no:'Mitt bibliotek'})}</h3>
   <h4>${L({en:'Routes',no:'Ruter'})} <button class="btn sm" data-a="new">+ ${L({en:'New',no:'Ny'})}</button></h4><div class="lil">${rs}</div>
   <h4>${L({en:'Saved views',no:'Lagrede visninger'})}</h4><div class="lisave"><input id="vname" placeholder="${L({en:'Name this view',no:'Gi visningen et navn'})}" maxlength="60"><button class="btn pri sm" data-a="save">${L({en:'Save',no:'Lagre'})}</button></div><div class="lil">${vs}</div>
   <h4>${L({en:'My notes',no:'Mine notater'})}</h4><div class="lil">${ns}</div>
   <h4>${L({en:'Import and export',no:'Importer og eksporter'})}</h4><div class="liio"><button type="button" class="btn sm upgo">⇪ ${L({en:'Add a ForeFlight or Garmin Pilot screenshot or PDF to the briefing pack',no:'Legg et skjermbilde eller en PDF fra ForeFlight eller Garmin Pilot i briefingpakken'})}</button><div class="xexp"><span>${L({en:'This route:',no:'Denne ruten:'})}</span><button type="button" data-ex="gpx">GPX</button><button type="button" data-ex="fpl">Garmin FPL</button><button type="button" data-ex="txt">${L({en:'Copy route',no:'Kopier ruten'})}</button></div><p class="note" style="margin:4px 0 0;font-size:12px">${L({en:'ForeFlight, Garmin Pilot and SkyDemon import GPX; ForeFlight and Garmin units also read .fpl.',no:'ForeFlight, Garmin Pilot og SkyDemon importerer GPX; ForeFlight og Garmin-enheter leser også .fpl.'})}</p></div>
   <p class="src">${NSTORE.mode==='account'?L({en:'Saved to your profile.',no:'Lagret på profilen din.'}):L({en:'Saved in this browser.',no:'Lagret i denne nettleseren.'})}</p>`; }
function libOpen(on){ const b=el('lib'); b.hidden=!on; el('libbtn').setAttribute('aria-expanded',String(on)); if(on){ el('side').hidden=true; libDraw(); } }
el('libbtn').onclick=()=>libOpen(el('lib').hidden);
el('lib').addEventListener('click',async e=>{ const t=e.target.closest('button'); if(!t) return;
  if(t.classList.contains('x')) return libOpen(false);
  if(t.dataset.a==='new'){ el('new').click(); libOpen(false); return; }
  if(t.dataset.r){ const r=ALL.find(x=>x.id===t.dataset.r); if(r){ load(r); setTimeout(fit,50); } libOpen(false); return; }
  if(t.dataset.a==='save'){ const nm=(el('vname').value||'').trim()||(R.title||L({en:'My view',no:'Min visning'})); const v={id:'v'+Date.now().toString(36),name:nm,la:V.la,lo:V.lo,z:V.z,mm:MM,ly:Object.assign({},LY),rid:R.pts.length>=2?R.id:null};
    if(T3.on&&T3.cam) v.d3={cam:Object.assign({},T3.cam),ex:T3.ex,x:+el('x3r').value||0};
    if(ML){ v.ml={p:+ML.getPitch().toFixed(1),b:+ML.getBearing().toFixed(1),bm:BM}; if(T3.on) v.d3={ex:T3.ex,x:+el('x3r').value||0}; }
    await NSTORE.put('mapview',v); VIEWS.unshift(v); libDraw(); return; }
  if(t.dataset.dv){ await NSTORE.del('mapview',t.dataset.dv); VIEWS=VIEWS.filter(v=>v.id!==t.dataset.dv); libDraw(); return; }
  if(t.dataset.v){ const v=VIEWS.find(x=>x.id===t.dataset.v); if(v) openView(v); libOpen(false); return; }
  if(t.dataset.n){ const n=NOTES.find(x=>x.id===t.dataset.n); if(n){ V.la=n.la; V.lo=n.lo; V.z=Math.max(V.z,120); if(T3.on) await set3(false); drawMap(); noteInfo(n); } libOpen(false); return; } });
async function openView(v){ if(v.rid){ const r=ALL.find(x=>x.id===v.rid); if(r&&r!==R) load(r); }
  MM=v.mm==='ifr'?'ifr':'vfr'; LY=Object.assign({},LY0,v.ly||{}); saveLY(); lyUI(); V.la=v.la; V.lo=v.lo; V.z=v.z;
  if(ML){ if(v.ml&&v.ml.bm) setBM(v.ml.bm); if(v.d3){ T3.ex=v.d3.ex||1.2; el('x3exs').value=String(T3.ex); if(!T3.on) await set3(true); else RXMAP.set3D(ML,true,T3.ex); } else if(T3.on) await set3(false);
    MLV={la:v.la,lo:v.lo,z:v.z}; ML.jumpTo({center:[v.lo,v.la],zoom:mlZ(v.z,v.la),pitch:v.ml?v.ml.p:(v.d3?60:0),bearing:v.ml?v.ml.b:0}); if(v.d3&&v.d3.x){ el('x3r').value=v.d3.x; T3.x=v.d3.x; setHov(v.d3.x,true); x3ro(v.d3.x); } drawMap(); return; }
  if(v.d3&&v.d3.cam){ T3.ex=v.d3.ex||1.2; el('x3exs').value=String(T3.ex); await set3(true); T3.cam=Object.assign({},v.d3.cam); if(v.d3.x&&T3.S){ el('x3r').value=v.d3.x; x3ro(v.d3.x); setHov(v.d3.x); } T3.dirty=true; }
  else { if(T3.on) await set3(false); V.la=v.la; V.lo=v.lo; V.z=v.z; drawMap(); } }
// notater på kartet
function noteInfo(n){ const sd=el('side'); sd.innerHTML=`<button class="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button><span class="id">${L({en:'Note',no:'Notat'})}</span><textarea class="nt" rows="5" maxlength="2000">${esc(n.t||'')}</textarea><p class="src">${llTxt(n.la,n.lo)}</p><div class="acts"><button class="btn pri" data-a="ns">${L({en:'Save',no:'Lagre'})}</button><button class="btn" data-a="nd">${L({en:'Delete',no:'Slett'})}</button></div>`; sd.hidden=false; el('lib').hidden=true;
  sd.onclick=async e=>{ const b=e.target.closest('button'); if(!b) return; if(b.classList.contains('x')){ sd.hidden=true; return; }
    if(b.dataset.a==='ns'){ n.t=sd.querySelector('.nt').value; await NSTORE.put('mapnote',n); if(!NOTES.includes(n)) NOTES.unshift(n); sd.hidden=true; drawMap(); }
    if(b.dataset.a==='nd'){ await NSTORE.del('mapnote',n.id); NOTES=NOTES.filter(x=>x!==n); sd.hidden=true; drawMap(); } };
  setTimeout(()=>{ const ta=sd.querySelector('.nt'); if(ta&&!n.t) ta.focus(); },30); }
function newNote(la,lo){ const n={id:'n'+Date.now().toString(36),la:+la.toFixed(5),lo:+lo.toFixed(5),t:''}; noteInfo(n); }
function drawNotes(g,cx,cy,zx,zy,vis){ if(!LY.nt) return; NOTES.forEach(n=>{ if(!vis(n.la,n.lo)) return; const x=cx+(n.lo-V.lo)*zx, y=cy-(n.la-V.la)*zy;
  g.beginPath(); g.moveTo(x,y); g.lineTo(x-6,y-10); g.lineTo(x-6,y-22); g.lineTo(x+6,y-22); g.lineTo(x+6,y-10); g.closePath(); g.fillStyle='#F2C230'; g.fill(); g.strokeStyle='#8A6D00'; g.lineWidth=1; g.stroke();
  hits.push({x,y:y-14,k:'note',o:n}); if(V.z>=60&&n.t){ const t=n.t.split('\n')[0].slice(0,28); g.font='600 11px Public Sans, sans-serif'; g.lineWidth=3; g.strokeStyle='rgba(255,255,255,.92)'; g.strokeText(t,x+9,y-12); g.fillStyle='#5C4A00'; g.fillText(t,x+9,y-12); } }); }
/* fritekst: «DEP 17 · ILS 30 via HE, hold» */
function findFix(id,near){ id=id.toUpperCase(); const c=[]; (NAV.nvI[id]||[]).forEach(n=>c.push({n:id,la:n[4],lo:n[5],k:n[2]})); (NAV.fxI&&NAV.fxI[id]||[]).forEach(p=>c.push({n:id,la:p[1],lo:p[2],k:'AIP'})); FIX.filter(f=>(f.n||'').toUpperCase()===id).forEach(f=>c.push({n:id,la:f.la,lo:f.lo,k:'fix'})); if(NAV.apI[id]) c.push({n:id,la:NAV.apI[id][2],lo:NAV.apI[id][3],k:'AD'});
  if(!c.length) return null; if(near&&near.la!=null) c.sort((a,b)=>gc(a,near)-gc(b,near)); return c[0]; }
function parseExp(t){ const T=' '+String(t||'').toUpperCase().replace(/[,;·]/g,' ')+' '; const out={}; const {d,a}=ends(); const msg=[];
  const dm=T.match(/\b(?:DEP(?:ARTURE)?|T\/?O|TAKE-?OFF)\s*(?:RWY|RW)?\s*(\d{1,2}[LRC]?)\b/)||T.match(/\b(?:RWY|RW)\s*(\d{1,2}[LRC]?)\s+(?:DEP(?:ARTURE)?|FOR\s+DEP)/);
  if(dm){ if(d&&rwyList(d.n).includes(dm[1])) out.dep=dm[1]; else msg.push(L({en:'no runway',no:'ingen bane'})+' '+dm[1]+' '+L({en:'at',no:'på'})+' '+(d?d.n:'?')); }
  const am=T.match(/\b(ILS|LOC|LLZ|LOCALI[SZ]ER|RNP|RNAV|LPV|GNSS|VOR|NDB|VIS(?:UAL)?)\s*(?:Z|Y|X)?\s*(?:APPROACH|APP)?\s*(?:RWY|RW)?\s*(\d{1,2}[LRC]?)\b/)||T.match(/\b(?:LAND(?:ING)?|ARR(?:IVAL)?|APP(?:ROACH)?)\s*(?:RWY|RW)?\s*(\d{1,2}[LRC]?)\b/);
  if(am){ const rw=am.length>2?am[2]:am[1], ty=am.length>2?am[1]:'ILS'; if(a&&rwyList(a.n).includes(rw)){ out.arr=rw; out.arrt=/^VIS/.test(ty)?'vis':'ifr'; out.ty=/^VIS/.test(ty)?'VISUAL':ty.replace('LOCALISER','LOC').replace('LOCALIZER','LOC').replace('LLZ','LOC'); } else msg.push(L({en:'no runway',no:'ingen bane'})+' '+rw+' '+L({en:'at',no:'på'})+' '+(a?a.n:'?')); }
  const vm=T.match(/\bVIA\s+([A-Z0-9]{2,5})\b/); if(vm){ const f=findFix(vm[1],a); if(f) out.via=f; else msg.push(vm[1]+' '+L({en:'not found',no:'ikke funnet'})); }
  if(/\bHOLD(?:ING)?\b/.test(T)) out.hold=1;
  return {out,msg}; }
function depParse(t){ const T=' '+String(t||'').toUpperCase().replace(/[,;·]/g,' ')+' '; const {d}=ends(); const out={}, msg=[];
  const m=T.match(/\b(?:RWY|RW|DEP(?:ARTURE)?|T\/?O)\s*(\d{1,2}[LRC]?)\b/)||T.match(/\s(\d{1,2}[LRC]?)\s/);
  if(m){ if(d&&rwyList(d.n).includes(m[1])) out.dep=m[1]; else msg.push(L({en:'no runway',no:'ingen bane'})+' '+m[1]+' '+L({en:'at',no:'på'})+' '+(d?d.n:'?')); }
  return {out,msg}; }
function xpc(){ [['xdep',{en:'Departure note',no:'Avgangsnotat'}],['xarr',{en:'Arrival note',no:'Ankomstnotat'}]].forEach(([id,lab])=>{ const t=el(id), b=document.querySelector(`.xnb[data-x="${id}"]`); if(!b) return; const has=!!t.value.trim(); b.classList.toggle('has',has); b.innerHTML=t.hidden? (has?EDIT_IC+' ':'＋ ')+esc(L(lab)) : '✓ '+esc(L({en:'Done',no:'Ferdig'})); }); }
function xOpen(id,on){ const t=el(id); t.hidden=on===undefined?!t.hidden:!on; xpc(); if(!t.hidden){ t.focus(); t.setSelectionRange(t.value.length,t.value.length); } }
el('xnrow').addEventListener('click',e=>{ const b=e.target.closest('.xnb'); if(b) xOpen(b.dataset.x); });
['xdep','xarr'].forEach(id=>el(id).addEventListener('keydown',e=>{ if(e.key==='Escape'){ xOpen(id,false); } }));
let xnT=0; const xnHit=e=>{ const g=e.target.closest&&e.target.closest('.xnbox'); if(!g) return; e.stopPropagation(); if(Date.now()-xnT<400) return; xnT=Date.now(); xOpen(g.dataset.x,true); };
psv.addEventListener('click',xnHit,true); psv.addEventListener('pointerup',xnHit,true);
function xApply(){ R.da=Object.assign({},R.da||{},{xd:el('xdep').value,xa:el('xarr').value}); xpc(); drawProfile(compute(),TP); queueSave(); }
let xT=null; ['xdep','xarr'].forEach(id=>{ el(id).addEventListener('input',()=>{ clearTimeout(xT); xT=setTimeout(xApply,250); }); });
/* ---------- forventet avgang og ankomst (fra banenumrene) ---------- */
function offs(la,lo,brgDeg,nm){ const b=brgDeg*D2R; return [la+nm/60*Math.cos(b), lo+nm/60*Math.sin(b)/Math.cos(la*D2R)]; }
function rwyList(n){ const a=NAV&&NAV.apI&&NAV.apI[n]; if(!a||!a[6]) return []; const out=[]; a[6].forEach(r=>{ [r[0],r[1]].forEach(e=>{ if(/^\d{1,2}[LRC]?$/.test(e||'')) out.push(e); }); }); return out; }
const rwyHdg=e=>parseInt(e,10)*10;
function ends(){ const P=R.pts; const d=P.length&&P[0].t==='rwy'?P[0]:null; let a=null; for(let i=P.length-1;i>0;i--) if(P[i].t==='rwy'){ a=P[i]; break; } return {d,a}; }
function applyDA(){ R.pts=R.pts.filter(p=>!p.auto); const {d,a}=ends(); const DA=R.da||{};
  if(d&&DA.dep&&rwyList(d.n).includes(DA.dep)&&d.la!=null){ const h=rwyHdg(DA.dep); const [la,lo]=offs(d.la,d.lo,h,3); R.pts.splice(1,0,{n:'DEP '+DA.dep,t:'wpt',la:+la.toFixed(5),lo:+lo.toFixed(5),auto:'dep',note:''}); }
  const e=ends().a; if(e&&DA.arr&&rwyList(e.n).includes(DA.arr)&&e.la!=null){ const h=rwyHdg(DA.arr), el0=pnum(e.elev)||0, di=R.pts.indexOf(e); const fr=(h+180)%360;
    const mk=(nm,alt,t,nm2)=>{ const [la,lo]=offs(e.la,e.lo,fr,nm); return {n:nm2,t,la:+la.toFixed(5),lo:+lo.toFixed(5),a:String(Math.round((el0+alt)/100)*100),auto:'arr',app:1,note:''}; };
    const ins= (DA.arrt||'ifr')==='vis'? [mk(3,1000,'faf','FINAL '+DA.arr)] : [mk(10,3000,'iaf','IF '+DA.arr),mk(5,1600,'faf',(DA.ty&&DA.ty!=='ILS'?'FAF ':'FAF ')+DA.arr)];
    if(DA.ty&&DA.arrt!=='vis') ins[ins.length-1].note=DA.ty+' '+DA.arr;
    if(DA.via&&DA.via.la!=null){ const v={n:DA.via.n,t:'iaf',la:DA.via.la,lo:DA.via.lo,a:String(Math.round((el0+3000)/100)*100),auto:'arr',note:DA.hold?L({en:'hold',no:'holding'}):''}; if(ins[0].t==='iaf') ins[0].t='wpt'; const pre=[v]; if(DA.hold) pre.push({n:'HOLD',t:'hold',d:'0',auto:'arr',app:1}); ins.unshift(...pre); }
    R.pts.splice(di,0,...ins); }
  else if(e&&DA.via&&DA.via.la!=null){ const di=R.pts.indexOf(e); const pre=[{n:DA.via.n,t:'iaf',la:DA.via.la,lo:DA.via.lo,auto:'arr'}]; if(DA.hold) pre.push({n:'HOLD',t:'hold',d:'0',auto:'arr',app:1}); R.pts.splice(di,0,...pre); } }
function daUI(){ const {d,a}=ends(); const DA=R.da||{}; const opt=(n,v)=>`<option value="">${L({en:'— none',no:'— ingen'})}</option>`+rwyList(n).map(e=>`<option value="${e}" ${e===v?'selected':''}>RWY ${e} (${String(rwyHdg(e)).padStart(3,'0')}°)</option>`).join('');
  el('depr').innerHTML=d?opt(d.n,DA.dep):`<option value="">—</option>`; el('arrr').innerHTML=a?opt(a.n,DA.arr):`<option value="">—</option>`; el('arrt').value=DA.arrt||'ifr'; el('arrtw').hidden=!DA.arr; if(document.activeElement!==el('xdep')) el('xdep').value=DA.xd||''; if(document.activeElement!==el('xarr')) el('xarr').value=DA.xa||''; xpc(); }
['depr','arrr','arrt'].forEach(id=>el(id).addEventListener('change',()=>{ R.da=Object.assign({},R.da||{},{dep:el('depr').value,arr:el('arrr').value,arrt:el('arrt').value}); applyDA(); render(); queueSave(); }));
/* briefing pack som naturlig avslutning */
function packInc(){ const M=compute(), DA=R.da||{}; const it=[L({en:'Terrain profile, as shown',no:'Terrengprofilen, slik den vises'})]; if(DA.xd||DA.xa) it.push(L({en:'Your notes for departure and arrival',no:'Notatene dine for avgang og ankomst'})); if((R.mk||[]).length) it.push(L({en:'Your markers',no:'Markørene dine'})+' ('+R.mk.length+')'); if(R.wx&&M.PM==='adv') it.push(L({en:'Weather on the profile',no:'Vær på profilen'})); if(el('sendnl').checked){ const NLs=R.nl||{}, ex=[pnum(R.gs)?'TAS':'',nlWind(NLs.w)||(R.pts||[]).some(p=>nlWind(p.nw))?L({en:'wind',no:'vind'}):'',pnum(NLs.ff)?L({en:'fuel flow',no:'forbruk'}):''].filter(Boolean); it.push(L({en:'Navigation log',no:'Navigasjonslogg'})+' ('+M.C.length+' '+L({en:'points',no:'punkter'})+(ex.length?', '+ex.join(', '):'')+')'); }
  el('pinc').innerHTML=it.map(t=>`<li>${esc(t)}</li>`).join(''); }
function packOpen(on){ const pp=el('packpop'); pp.hidden=!on; el('packbtn').setAttribute('aria-expanded',String(on)); if(on){ packInc(); flowDraw(); } }
{ const slot=el('packslot'), slot2=el('packslot2'); const sb=document.querySelector('.sendbox'); if(sb&&slot) slot.appendChild(sb); const sn=el('sendnote'); if(sn&&slot2) slot2.appendChild(sn); const sec=el('sendsec'); if(sec) sec.hidden=true; }
el('packbtn').onclick=()=>packOpen(el('packpop').hidden); el('sendnl').addEventListener('change',packInc);
document.addEventListener('pointerdown',e=>{ if(!e.target.closest('#packpop,#packbtn')&&!el('packpop').hidden) packOpen(false); });
// rute-linjen
el('rmore').onclick=()=>{ const x=el('routex'); x.hidden=!x.hidden; el('rmore').setAttribute('aria-expanded',String(!x.hidden)); el('rmore').textContent=x.hidden?'▾':'▴'; };

/* ================= MapLibre-kartet (rxmap.js), med lerretskartet som reserve =================
   Lerretskartet tegnes først. MapLibre lastes i bakgrunnen; er stil og første kartflis på plass
   innen ca. 6 s, byttes kartet. Ellers (artefakt uten nett, ingen WebGL, frakoblet) blir lerretskartet. */
let mlClickT=0, MLV=null; const MLK={};
const mlZ=(z,la)=>Math.log2(Math.max(1e-6,z*360*Math.cos(la*D2R)/512)); // px per breddegrad -> MapLibre-zoom
const mlVz=(Z,la)=>512*2**Z/(360*Math.cos(la*D2R));
if(/[?&]debug\b/.test(location.search)) window.__rx={toGpx,toFpl,toTxt,nlRows,asCalc,asReset(){ ASX.mem=null; },wxCat,get ASR(){ return ASR; },get WXS(){ return WXS; },get ML(){ return ML; },get R(){ return R; },get T3(){ return T3; },compute,prj,simM,simHud,acHov,trkAt};
function mlWanted(){ const q=new URLSearchParams(location.search).get('map'); if(q==='canvas') return false; if(q==='ml') return !!window.RXMAP;
  try{ if(localStorage.getItem('bb-rx-map')==='canvas') return false; }catch(e){} return !!window.RXMAP&&navigator.onLine!==false; }
function mlLib(){ return new Promise((ok,ko)=>{ if(window.maplibregl) return ok(); const l=document.createElement('link'); l.rel='stylesheet'; l.href='vendor/maplibre/maplibre-gl.css?v=5.24.0'; document.head.appendChild(l);
  const s=document.createElement('script'); s.src='vendor/maplibre/maplibre-gl.js?v=5.24.0'; s.onload=()=>window.maplibregl?ok():ko(new Error('maplibre')); s.onerror=()=>ko(new Error('maplibre-gl.js')); document.head.appendChild(s); }); }
const mlRelief=()=>LY.ter?'on':'off';
const MDBG=/[?&]mapdebug\b/.test(location.search); let mdBox=null;
function mlog(t){ if(!MDBG) return; if(!mdBox){ mdBox=document.createElement('pre'); mdBox.style.cssText='position:fixed;left:6px;bottom:6px;z-index:99999;max-width:94vw;max-height:45vh;overflow:auto;background:#10171D;color:#D7E1E6;font:11px/1.4 monospace;padding:8px;border-radius:4px;white-space:pre-wrap;margin:0'; document.body.appendChild(mdBox); } mdBox.textContent+=((performance.now()/1000).toFixed(1))+'s '+t+'\n'; }
async function mlStart(){ mlog('RXMAP '+(!!window.RXMAP)+' · online '+navigator.onLine+' · webgl '+(()=>{ try{ return !!document.createElement('canvas').getContext('webgl2')||!!document.createElement('canvas').getContext('webgl'); }catch(e){ return false; } })()+' · '+navigator.userAgent.slice(0,80)); if(!mlWanted()){ mlog('not wanted -> canvas'); mapEl.dataset.map='canvas'; return; } const t0=Date.now(); mapEl.dataset.map='loading';
  const div=document.createElement('div'); div.className='mlmap wait'; div.id='mlmap'; mapEl.insertBefore(div,mapEl.firstChild);
  try{ await mlLib(); mlog('maplibre-gl loaded '+(window.maplibregl&&maplibregl.getVersion?maplibregl.getVersion():'')); const m=await RXMAP.create(div,{log:mlog,center:[V.lo,V.la],zoom:mlZ(V.z,V.la),bm:BM,relief:mlRelief(),timeout:Math.max(12000,25000-(Date.now()-t0))});
    if(T3.on) await set3(false); ML=m; mlInit(); mlog('MapLibre active'); }
  catch(e){ div.remove(); ML=null; mapEl.dataset.map='canvas'; const why=(e&&e.message)||String(e); mlog('FALLBACK: '+why); try{ console.info('Route Explorer: using the built-in canvas map ('+why+')'); }catch(_){} drawMap();
    if(navigator.onLine!==false&&location.protocol.startsWith('http')){ const gl=/webgl|context|gpu/i.test(why); const n=document.createElement('div'); n.className='mlwarn'; n.setAttribute('role','status');
      n.innerHTML=`<span>${gl?L({en:'The detailed map isn’t available in this browser, so the simple map is shown instead.',no:'Det detaljerte kartet er ikke tilgjengelig i denne nettleseren, så det enkle kartet vises i stedet.'}):L({en:'The detailed map could not load, so the simple map is shown instead.',no:'Det detaljerte kartet kunne ikke lastes, så det enkle kartet vises i stedet.'})}</span> <button type="button" class="mwr">${L({en:'Try again',no:'Prøv igjen'})}</button> <button type="button" class="mwd" aria-expanded="false">${L({en:'Details',no:'Detaljer'})}</button> <button type="button" class="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button><code hidden></code>`;
      n.querySelector('code').textContent=why; n.querySelector('.mwr').onclick=()=>location.reload(); n.querySelector('.x').onclick=()=>n.remove();
      n.querySelector('.mwd').onclick=e=>{ const c=n.querySelector('code'); c.hidden=!c.hidden; e.currentTarget.setAttribute('aria-expanded',String(!c.hidden)); };
      ['pointerdown','pointerup','mousedown','click','touchstart','dblclick','wheel'].forEach(t=>n.addEventListener(t,e=>e.stopPropagation(),{passive:true})); mapEl.appendChild(n); } } }
function asUI(st){ const lab=el('lyas'); if(!lab) return; const ok=st==='ok', i=lab.querySelector('input'); i.disabled=!ok; lab.classList.toggle('off',!ok);
  el('lyoa').querySelectorAll('label.chk').forEach(l=>{ l.classList.toggle('off',!ok); l.querySelector('input').disabled=!ok; }); el('oanote').textContent=ok?'':(st==='denied'?L({en:'(not available)',no:'(ikke tilgjengelig)'}):L({en:'(needs an openAIP key)',no:'(trenger en openAIP-nøkkel)'}));
  el('asnote').textContent= ok? '' : st==='denied'? L({en:'(not available: the openAIP key was refused or the service is down)',no:'(ikke tilgjengelig: openAIP-nøkkelen ble avvist eller tjenesten er nede)'}) : L({en:'(needs an openAIP key)',no:'(trenger en openAIP-nøkkel)'}); asSub(); }
function mlInit(){ const m=ML; RXMAP.addOverlays(m); mapEl.classList.add('ml'); mapEl.dataset.map='maplibre'; el('mlmap').classList.remove('wait'); el('bmsel').hidden=false; bmUI();
  document.querySelectorAll('#layers .mlonly').forEach(x=>x.hidden=false); asSub();
  try{ RXMAP.addAirspace(m,st=>{ asUI(st); MLK.ly=''; drawMap(); }); }catch(e){ asUI('denied'); }
  if(LY.ct) RXMAP.addContours(m).then(()=>{ MLK.ly=''; drawMap(); });
  m.on('move',()=>{ const c=m.getCenter(); V.la=c.lat; V.lo=c.lng; V.z=mlVz(m.getZoom(),c.lat); MLV={la:V.la,lo:V.lo,z:V.z}; try{ ptPop(); }catch(e){} });
  m.on('moveend',()=>{ windyHref(); mlMef(); if(!T3.play){ ASX.dirty=true; wxSoon(); if(LY.wa) waMapSoon(); } }); if(LY.sig) setTimeout(sigSync,1500); lookInit();
  m.on('sourcedata',e=>{ if(e.sourceId==='bb-oaip'&&e.tile) ASX.dirty=true; }); m.on('idle',()=>{ if(ASX.dirty) asSoon(150); });
  m.getContainer().addEventListener('bb-satfail',()=>{ if(BM==='sat') setBM('vfr'); }); // no satellite source loads: back to the VFR chart
  m.on('dragstart',()=>{ if(T3.drive){ mlNoPad(); mlFov(); T3.drive=false; T3.mb=null; try{ m.setCenterClampedToGround(true); }catch(e){} } });
  m.on('click',e=>{ if(T3.dvOn||Date.now()-mlClickT<350) return; mapClick(e.originalEvent); }); // flying: clicks and drags are for looking around
  MLV={la:V.la,lo:V.lo,z:V.z}; m.jumpTo({center:[V.lo,V.la],zoom:mlZ(V.z,V.la)});
  mlStatic(); drawMap(); wxSoon(); }
function mlHold(on){ if(!ML) return; if(on){ ML.dragPan.disable(); ML.touchZoomRotate.disable(); } else { ML.dragPan.enable(); ML.touchZoomRotate.enable(); if(!T3.on) ML.touchZoomRotate.disableRotation(); } }
function mlHit(mx,my,r){ const h=ML&&RXMAP.hit(ML,mx,my,r); if(!h) return null; if(h.k==='oa') return h.o?{x:h.x,y:h.y,k:'oa',o:h.o}:null; const o= h.k==='ap'?NAV.ap[h.i] : h.k==='nv'?NAV.nv[h.i] : h.k==='aip'?NAV.fx[h.i] : h.k==='fix'?FIX[h.i] : h.k==='note'?NOTES[h.i] : null; return o?{x:h.x,y:h.y,k:h.k,o}:null; }
const mlF=(g,p)=>({type:'Feature',geometry:g,properties:p||{}}), mlP=(la,lo)=>({type:'Point',coordinates:[lo,la]}), mlC=a=>({type:'FeatureCollection',features:a});
function mlPut(id,fc){ const k=JSON.stringify(fc); if(MLK[id]===k) return; const first=MLK[id]===undefined; MLK[id]=k; if(first&&!fc.features.length) return; /* a source starts empty: no repaint for nothing */ RXMAP.setData(ML,id,fc); }
function mlStatic(){ if(!NAV) return;
  RXMAP.setData(ML,'bb-ap',mlC(NAV.ap.map((a,i)=>mlF(mlP(a[2],a[3]),{k:'ap',i,c:a[5]||0,n:a[0]}))));
  RXMAP.setData(ML,'bb-nv',mlC(NAV.nv.map((n,i)=>mlF(mlP(n[4],n[5]),{k:'nv',i,n:n[0],ndb:/NDB/.test(n[2])?1:0}))));
  RXMAP.setData(ML,'bb-fx',mlC((NAV.fx||[]).map((p,i)=>mlF(mlP(p[1],p[2]),{k:'aip',i,n:p[0]}))));
  RXMAP.setData(ML,'bb-awy',mlC(Object.keys(AWY||{}).map(k=>{ const c=(AWY[k]||[]).filter(p=>p[1]!=null).map(p=>[p[2],p[1]]); return c.length>1?mlF({type:'LineString',coordinates:c},{n:k.split('@')[0]}):null; }).filter(Boolean))); }
function mlSync(){ const m=ML; if(!m||!R) return;
  if(MLV&&(Math.abs(V.la-MLV.la)>1e-7||Math.abs(V.lo-MLV.lo)>1e-7||Math.abs(V.z-MLV.z)>MLV.z*1e-4)){ MLV={la:V.la,lo:V.lo,z:V.z}; m.easeTo({center:[V.lo,V.la],zoom:mlZ(V.z,V.la),duration:450}); }
  const lk=JSON.stringify([LY,MM]); if(MLK.ly!==lk){ MLK.ly=lk; RXMAP.setGroups(m,LY); RXMAP.setRelief(m,mlRelief()); lyUI(); }
  const M=compute(), legs=[]; let prev=null; R.pts.forEach(p=>{ if(p.la==null) return; if(prev){ const n=Math.max(1,Math.min(64,Math.ceil(gc(prev,p)/4))), c=[]; for(let i=0;i<=n;i++) c.push([prev.lo+(p.lo-prev.lo)*i/n,prev.la+(p.la-prev.la)*i/n]); legs.push(mlF({type:'LineString',coordinates:c},{d:['missed','alt'].includes(p.t)?1:0})); } prev=p; }); // samme linje som profilen (lineært i bredde/lengde)
  mlPut('bb-leg',mlC(legs)); mlPut('bb-rpt',mlC(R.pts.map((p,i)=>p.la==null?null:mlF(mlP(p.la,p.lo),{n:p.n||'',s:i===selI?1:0})).filter(Boolean)));
  { const cr=crit(M), q=cr&&M.posAt(cr.x); let f=[]; if(q&&q.la!=null){ const c=cr.m!=null&&cr.m<0?'r':cr.m!=null&&cr.m<(+S('mg')||1000)?'a':'n'; const t=cr.m==null? fx(Math.round(cr.t))+' ft' : (cr.m<0?'−':'')+fx(Math.abs(Math.round(cr.m/10)*10))+' ft'; f=[mlF(mlP(q.la,q.lo),{c,t})]; } mlPut('bb-crit',mlC(f)); }
  MLK.M=M; mlPut('bb-hov',mlHovFC(M));
  { let f=[]; const sn=ptDrag&&ptDrag.snap; if(sn){ const q=snapPt(sn); f=[mlF(mlP(q.la,q.lo),{n:q.n})]; } mlPut('bb-snap',mlC(f)); }
  mlPut('bb-my',mlC(FIX.map((f,i)=>f.la==null?null:mlF(mlP(f.la,f.lo),{k:'fix',i,n:f.n})).filter(Boolean)));
  mlPut('bb-note',mlC(NOTES.map((n,i)=>mlF(mlP(n.la,n.lo),{k:'note',i,t:(n.t||'').split('\n')[0].slice(0,28)}))));
  mlMef(); if(T3.on){ ml3Path(M); mlUi3(M); } }
function mlHovFC(M){ let f=[]; if(HOV!=null&&!(T3.on&&T3.play)){ const q=M.posAt(HOV); if(q&&q.la!=null) f=[mlF(mlP(q.la,q.lo),{t:fx(HOV,1)+' NM'+(M.PM==='ter'?'':' · '+altTxt(Math.round(M.altAt(HOV)/10)*10))})]; } return mlC(f); }
// pointer hover over the route: only the hover marker changes, so skip the full sync (profile model reused from the last sync)
function mlHov(){ if(!ML||!MLK.M){ drawMap(); return; } mlPut('bb-hov',mlHovFC(MLK.M)); }
function mlMef(){ if(!ML) return; const q=LY.mef&&window.TERRAIN&&!T3.on? (V.z>=150?0.5:V.z>=70?1:0) : 0; const pts=[], gl=[];
  if(q){ const b=ML.getBounds(), la0=b.getSouth(), la1=b.getNorth(), lo0=b.getWest(), lo1=b.getEast(); const qa0=Math.floor(la0/q)*q, qo0=Math.floor(lo0/q)*q;
    if((la1-qa0)/q*(lo1-qo0)/q<900){ for(let la=qa0;la<la1;la+=q) for(let lo=qo0;lo<lo1;lo+=q){ const v=mefOf(q,la,lo); if(!v) continue; const th=Math.floor(v/1000), hu=Math.round((v%1000)/100); pts.push(mlF(mlP(la+q/2,lo+q/2),{th:th?String(th):'',hu:String(hu)})); }
      if(q===0.5){ for(let lo=qo0;lo<=lo1;lo+=q) gl.push(mlF({type:'LineString',coordinates:[[lo,la0],[lo,la1]]})); for(let la=qa0;la<=la1;la+=q) gl.push(mlF({type:'LineString',coordinates:[[lo0,la],[lo1,la]]})); } } }
  mlPut('bb-mef',mlC(pts)); mlPut('bb-mefg',mlC(gl)); }
function mlFit(a0,a1,o0,o1){ const m=ML, w=mapEl.clientWidth, h=mapEl.clientHeight; const pad={top:(w<900?120:70)+30,bottom:shTarget(h)+35,left:45+rcPad(),right:60};
  if(pad.top+pad.bottom>h-80){ const k=(h-80)/(pad.top+pad.bottom); pad.top*=k; pad.bottom*=k; }
  const bearing=T3.on?m.getBearing():0; let cam=null; try{ cam=m.cameraForBounds([[o0,a0],[o1,a1]],{padding:pad,maxZoom:11.5,bearing}); }catch(e){}
  if(!cam){ m.easeTo({center:[(o0+o1)/2,(a0+a1)/2],duration:500}); return; }
  m.easeTo(Object.assign({},cam,{bearing,pitch:T3.on?62:0,zoom:cam.zoom-(T3.on?0.35:0),duration:600})); }
// grunnkart
function bmUI(){ el('bmsel').querySelectorAll('[data-b]').forEach(b=>{ const on=b.dataset.b===BM; b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); }); lyUI(); }
function setBM(b){ if(!BMS.includes(b)) b='vfr'; BM=b; if((b==='vfr'||b==='ifr')&&b!==MM) avDefaults(b); if(b==='vfr'||b==='ifr') MM=b; saveLY(); bmUI(); if(ML) RXMAP.setBasemap(ML,BM); }
el('bmsel').addEventListener('click',e=>{ const b=e.target.closest('[data-b]'); if(b) setBM(b.dataset.b); });
// 3D i MapLibre: terreng fra AWS, ruten draperes, planlagt bane som gardin i høyden
function ml3(on){ T3.on=on; el('rx').classList.toggle('d3',on); setTimeout(()=>{ rxTop(); try{ ML.resize(); }catch(e){} },30); el('v23').querySelectorAll('button').forEach(b=>b.classList.toggle('on',(b.dataset.v==='3')===on)); el('x3w').hidden=!on; el('m3msg').hidden=true;
  { const ct=el('x3ct').closest('label'); if(ct) ct.hidden=true; } el('x3ltl').hidden=false; el('x3acl').hidden=false; el('x3hint').hidden=true; el('x3hml').hidden=false;
  if(!on){ REP.on=false; REP.M=null; SIMC.k=null; if(AC3.L) AC3.L.set({on:false}); mlNoPad(); mlFov(); simStop(); mlDrive(false); T3.play=false; T3.drive=false; T3.mb=null; el('simhud').hidden=true; simBtnUI(); try{ ML.setCenterClampedToGround(true); }catch(e){} if(T3.raf){ cancelAnimationFrame(T3.raf); T3.raf=0; } RXMAP.setPath3D(ML,null,null); RXMAP.set3D(ML,false); ML.easeTo({pitch:0,bearing:0,duration:700}); drawMap(); return Promise.resolve(); }
  T3.sun=sun3(); if(RXMAP.setSun) RXMAP.setSun(ML,T3.sun); RXMAP.set3D(ML,true,T3.ex); ml3Fit(); MLK.p3=''; drawMap(); return Promise.resolve(); }
/* the 3D aircraft (simac3d.js + three.js, as a MapLibre custom layer): loaded the first time the simulation starts */
const AC3={st:null,L:null,bank:0,pitch:0};
const RM3=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
function acType(){ if(T3.act&&T3.act!=='auto') return T3.act; const g=gsOf(); return g>=200?'a320':g>=150?'b200':'da42'; }
const acLen=()=>({da42:8.6,b200:13.3,a320:37.6})[acType()]||9;
function ac3Load(){ if(T3.act==='off') return null; if(AC3.st||!ML) return AC3.st; AC3.st=load3().then(()=>window.SIMAC?0:new Promise((ok,ko)=>{ const sc=document.createElement('script'); sc.src='simac3d.js?v=2'; sc.onload=ok; sc.onerror=()=>ko(new Error('simac3d.js')); document.head.appendChild(sc); }))
  .then(()=>{ if(!ML||!window.SIMAC) return; if(!ML.getLayer('bb-ac3d')){ const L=SIMAC.layer(); ML.addLayer(L); AC3.L=L; } mlKick3(); })
  .catch(e=>{ AC3.st=null; try{ console.info('Route Explorer: no 3D aircraft ('+((e&&e.message)||e)+')'); }catch(_){} }); return AC3.st; }
/* sun for the sky: local solar noon today at the middle of the route (no departure time is stored); in the Nordic
   winter that is a low, warm sun, in summer a high one */
function sun3(){ const P=R.pts.filter(p=>p.la!=null), la=P.length?P.reduce((s,p)=>s+p.la,0)/P.length:60, d=new Date(), doy=Math.floor((d-new Date(d.getFullYear(),0,0))/864e5);
  const dec=-23.44*Math.cos(2*Math.PI/365*(doy+10)); return {az:la>=dec?180:0,el:Math.max(2,90-Math.abs(la-dec))}; }
function ml3Fit(){ mlNoPad(); mlFov(); if(T3.dvOn) mlDrive(false); T3.drive=false; T3.mb=null; try{ ML.setCenterClampedToGround(true); }catch(e){} const m=ML, P=R.pts.filter(p=>p.la!=null&&!['missed','alt'].includes(p.t)); let b=m.getBearing();
  if(P.length>=2){ b=((brg(P[0],P[P.length-1])-70)%360+540)%360-180; let a0=90,a1=-90,o0=180,o1=-180; P.forEach(p=>{ a0=Math.min(a0,p.la); a1=Math.max(a1,p.la); o0=Math.min(o0,p.lo); o1=Math.max(o1,p.lo); });
    let cam=null; try{ cam=m.cameraForBounds([[o0,a0],[o1,a1]],{padding:{top:60,bottom:Math.min(shTarget(mapEl.clientHeight)+40,mapEl.clientHeight/2),left:pw3()+40,right:60},bearing:b,maxZoom:11}); }catch(e){}
    if(cam){ m.easeTo(Object.assign({},cam,{bearing:b,pitch:62,zoom:cam.zoom+0.2,duration:1100})); return; } }
  m.easeTo({pitch:62,bearing:b,duration:900}); }
function ml3Path(M){ const tot=M.total||0; const key=JSON.stringify([R.pts,R.s,R.mk,M.PM,TP&&TP.pts&&TP.pts.length,T3.ex]);
  if(M.PM==='ter'||M.C.length<2||!tot){ RXMAP.setPath3D(ML,null,null); MLK.p3=''; return; }
  if(MLK.p3!==key){ MLK.p3=key; const n=Math.max(80,Math.min(600,Math.round(tot*3))), xs=new Set(); for(let i=0;i<=n;i++) xs.add(+(tot*i/n).toFixed(4)); M.C.forEach(c=>{ if(c.x>=0&&c.x<=tot) xs.add(+c.x.toFixed(4)); });
    const hx=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255]; MLK.pts=[...xs].sort((a,b)=>a-b).map(x=>{ const q=M.posAt(x); return q&&q.la!=null?{la:q.la,lo:q.lo,alt:M.altAt(x),col:hx(CLS3[cls3(M,x)])}:null; }).filter(Boolean); }
  RXMAP.setPath3D(ML,MLK.pts,acHov(M,T3.play?T3.x:HOV)); }
function mlUi3(M){ M=M||compute(); const has=M.C.length>=2&&M.total>0; el('x3').hidden=!has; if(has) el('x3r').max=String(Math.round(M.total*100)/100);
  el('x3leg').hidden=!has||M.PM==='ter'; el('x3pm').hidden=!has||M.PM!=='ter';
  el('x3d').textContent=L({en:'Terrain: AWS Terrain Tiles (about 30 m in Europe). The line in the air is your planned altitude.',no:'Terreng: AWS Terrain Tiles (omtrent 30 m i Europa). Linjen i lufta er den planlagte høyden din.'});
  el('x3ex').textContent=L({en:'Terrain ×',no:'Terreng ×'})+T3.ex+(T3.ex>1&&!PHONE3()?' '+L({en:'(exaggerated)',no:'(overdrevet)'}):''); ui3p(); if(has) x3ro(T3.x); }
function ml3Alt(M,x){ if(M.PM!=='ter') return M.altAt(x); const q=tpq(x); return ((q&&(q.c!=null?q.c:q.e))||0)+2000; }
function mlKick3(){ if(!T3.on||T3.raf||document.hidden) return; T3.raf=requestAnimationFrame(mlFrame3); }
// the track at x, smoothed over ±d NM so the aircraft and the camera turn through a waypoint instead of snapping
function trkAt(M,x){ const tot=M.total||0, d=Math.max(0.4,Math.min(1.5,tot*0.01)), q0=M.posAt(Math.max(0,x-d)), q2=M.posAt(Math.min(tot,x+d)); return q0&&q2&&q0.la!=null&&q2.la!=null&&(q0.la!==q2.la||q0.lo!==q2.lo)? brg(q0,q2) : null; }
function acHov(M,at){ if(at==null||!M.total) return null; const q=M.posAt(at); if(!q||q.la==null) return null; const tq=tpq(at);
  return {la:q.la,lo:q.lo,alt:ml3Alt(M,at),tr:T3.mb!=null&&(T3.play||T3.drive)?T3.mb:trkAt(M,at),gnd:tq?(tq.c!=null?tq.c:tq.e):null,hide:T3.cm==='cockpit'&&T3.drive}; }
function simPad(now){ if(T3.padT&&now-T3.padT<500&&T3.pad) return T3.pad; T3.padT=now; const mr=mapEl.getBoundingClientRect(), H=mr.height, h=el('simhud');
  let top=0, hudB=0; if(h&&!h.hidden){ const r=h.getBoundingClientRect(); if(r.top>mr.top+H/2) hudB=Math.max(0,mr.bottom-r.top); else top=Math.max(0,r.bottom-mr.top); }
  const xw=el('x3w'), xr=xw&&!xw.hidden?xw.getBoundingClientRect():null;
  const bottom=window.innerWidth<=900? (xr?Math.max(0,Math.min(H*0.45,mr.bottom-xr.top)):0) : Math.min(H*0.5,parseFloat(getComputedStyle(el('rx')).getPropertyValue('--shh'))||0), left=Math.min(mr.width*0.4,pw3());
  top=Math.min(top,Math.max(0,H-bottom-140)); return T3.pad={top:Math.round(top*(window.innerWidth<=900?0.9:0.6)),bottom:Math.round(Math.max(bottom,hudB*0.6)),left:Math.round(left),right:0}; }
// camera field of view: cockpit ≈ 80° across the screen (a pilot's view), chase ≈ 64°, otherwise MapLibre's 36.87°.
// Kept within 36.87–70° vertical so portrait phones do not get a fish-eye view.
const FOV0=36.87;
function mlFov(cm,add){ if(!ML||!ML.setVerticalFieldOfView) return; const tr=ML.transform||{}, W=tr.width||1, H=tr.height||1; // map size without a DOM read (no forced layout per frame)
  const v=h=>2*Math.atan(Math.tan(h/2*D2R)*H/W)/D2R, want=cm==='cockpit'?Math.max(45,Math.min(70,v(80))):cm==='chase'?Math.max(FOV0,Math.min(60,v(64)+(add||0))):FOV0;
  if(Math.abs(ML.getVerticalFieldOfView()-want)>0.2) try{ ML.setVerticalFieldOfView(want); }catch(e){} }
function mlNoPad(){ if(ML&&T3.padded){ T3.padded=false; try{ ML.setPadding({top:0,bottom:0,left:0,right:0}); }catch(e){} } }
// free look while flying: T3.lkT is the target (from drag, keys, look pad), T3.lk follows it with easing
T3.lk={y:0,p:0}; T3.lkT={y:0,p:0}; T3.zk=1; T3.k=1;
function lookBy(dy,dp){ T3.lkT.y=((T3.lkT.y+dy+540)%360)-180; T3.lkT.p=Math.max(-45,Math.min(T3.cm==='cockpit'?22:50,T3.lkT.p+dp)); mlKick3(); }
function lookHome(){ T3.lkT.y=0; T3.lkT.p=0; T3.zk=1; mlKick3(); }
function mlFrame3(now){ T3.raf=0; if(!T3.on||!ML) return; const t0=performance.now(); const dt=T3.t?Math.min(0.1,(now-T3.t)/1000):0; T3.t=now; const M=simM(), tot=M.total||0; let more=false;
  const dv=!!(T3.drive&&T3.cm!=='ov'); if(dv!==!!T3.dvOn) mlDrive(dv);
  if(T3.play&&tot>0){ simSpeed(dt); T3.x=Math.min(tot,T3.x+dt*simAdv()); el('x3r').value=T3.x; simHov(T3.x,now); simAhead(); if(T3.x>=tot){ T3.play=false; ui3p(); } }
  // ease the look offsets toward the target (about 0.15 s), wrapping yaw the short way round
  { const e=dt>0?1-Math.exp(-dt*7):1, dy=((T3.lkT.y-T3.lk.y+540)%360)-180, dp=T3.lkT.p-T3.lk.p; T3.lk.y+=dy*e; T3.lk.p+=dp*e; if(Math.abs(dy)>0.05||Math.abs(dp)>0.05) more=true; }
  const at=T3.play?T3.x:(HOV!=null?HOV:(T3.dvOn?T3.x:null));
  let showM=false;
  if(at!=null&&tot>0){ const tb=trkAt(M,at); if(tb!=null){ if(T3.mb==null){ T3.mb=tb; T3.ch=tb; } const db=((tb-T3.mb)%360+540)%360-180; T3.mb=(T3.mb+db*(dt>0?1-Math.exp(-dt*(T3.cm==='cockpit'?1.6:2.5)):1)+360)%360; if(Math.abs(db)>0.3) more=true;
      // the chase camera swings round after the aircraft in a turn (lag), so the turn and the bank are seen from outside
      if(T3.ch==null) T3.ch=T3.mb; const dc=((T3.mb-T3.ch)%360+540)%360-180; T3.ch=(T3.ch+dc*(dt>0?1-Math.exp(-dt*(RM3()?8:1.25)):1)+360)%360; if(Math.abs(dc)>0.2) more=true; }
    const q=M.posAt(at);
    // attitude: bank from the turn rate along the (smoothed) track, pitch from the flight-path angle plus a little angle of attack
    { let bank=0, pit=0; const d=0.3, ta=trkAt(M,Math.max(0,at-d)), tc=trkAt(M,Math.min(tot,at+d)), gs=gsOf();
      if(ta!=null&&tc!=null){ const w=(((tc-ta)%360+540)%360-180)/(2*d)*D2R*gs/3600*2.5; bank=Math.max(-25,Math.min(25,Math.atan(gs*0.5144*w/9.81)/D2R)); }
      pit=Math.atan((ml3Alt(M,Math.min(tot,at+0.1))-ml3Alt(M,Math.max(0,at-0.1)))/0.2/6076)/D2R+(acType()==='a320'?2.5:2);
      const ke=dt>0?1-Math.exp(-dt*1.8):1; AC3.bank+=(bank-AC3.bank)*ke; AC3.pitch+=(pit-AC3.pitch)*ke; if(Math.abs(bank-AC3.bank)>0.1||Math.abs(pit-AC3.pitch)>0.1) more=true; }
    showM=!!(T3.act!=='off'&&AC3.L&&q&&q.la!=null&&dv&&T3.cm==='chase'&&T3.mb!=null); if(!showM&&AC3.L&&T3.act==='off') AC3.L.set({on:false});
    if(showM) AC3.L.set({on:true,la:q.la,lo:q.lo,ft:ml3Alt(M,at),hd:T3.mb,bank:AC3.bank,pitch:AC3.pitch,type:acType(),sun:T3.sun,spin:T3.play&&!RM3()});
    if(q&&q.la!=null&&dv&&T3.mb!=null){ const ex=RXMAP.exag(ML)||1, a=ml3Alt(M,at)*0.3048*ex, ly=T3.lk.y, lp=T3.lk.p;
      const tq=tpq(at), gnd=tq?(tq.c!=null?tq.c:tq.e):0, agl=ml3Alt(M,at)-(gnd||0);
      try{ ML.setCenterClampedToGround(false); mlFov(T3.cm,showM?7*Math.max(0,Math.min(1,1-agl/3000)):0);
        if(T3.cm==='cockpit'){ // at the aircraft, looking along the track (plus free look), about 7° below the horizon by default
          const f=Math.max(3,Math.min(8,tot*0.05)), [tla,tlo]=offs(q.la,q.lo,T3.mb+ly,f);
          ML.jumpTo(Object.assign(ML.calculateCameraOptionsFromTo([q.lo,q.la],a+25,[tlo,tla],a+25-f*1852*Math.tan((7-lp)*D2R)),{padding:{top:0,bottom:0,left:0,right:0}})); T3.padded=false; }
        else { // chase: behind and above; free look orbits the camera round the aircraft
          // with the 3D aircraft: a close, low chase (about 5½ lengths back, 9° above), the wheel pulls back to the route view
          const back=showM? acLen()*5.5*T3.zk/1852 : Math.max(1.6,Math.min(5,tot*0.035))*T3.zk, el0=showM?9:Math.atan(0.42)/D2R, elv=Math.max(showM?2:4,Math.min(80,el0+lp)), cb=(showM?T3.ch:T3.mb)+180+ly;
          const [cla,clo]=offs(q.la,q.lo,cb,back*Math.cos(elv*D2R)/Math.cos(el0*D2R)), ah=back*(showM?0.6:0.3)*Math.max(0,Math.cos(ly*D2R)), [tla,tlo]=offs(q.la,q.lo,T3.mb,ah);
          ML.jumpTo(Object.assign(ML.calculateCameraOptionsFromTo([clo,cla],a+back*1852*Math.sin(elv*D2R)/Math.cos(el0*D2R),[tlo,tla],a-back*1852*(showM?0:0.05)),{padding:simPad(now)})); T3.padded=true; } }catch(e){} } }
  if(!showM&&AC3.L) AC3.L.set({on:false});
  { const h=acHov(M,at); if(h&&showM) h.model=true; RXMAP.setPath3D(ML,undefined,h); } if(!T3.play||!T3.hudT||now-T3.hudT>100){ T3.hudT=now; simHud(at!=null?at:T3.x); }
  T3.ft=performance.now()-t0; if(T3.play||more) mlKick3(); else T3.t=0; }
/* flying camera: drag looks around (chase: orbits), wheel moves the chase camera in and out, double-click recentres.
   MapLibre's own pan/zoom/rotate are off meanwhile, and the pitch limit opens to 105° so you can look above the horizon. */
function mlDrive(on){ T3.dvOn=on; const m=ML; if(!m) return; const c=m.getCanvasContainer();
  try{ if(on){ m.dragPan.disable(); m.dragRotate.disable(); m.scrollZoom.disable(); m.doubleClickZoom.disable(); m.touchZoomRotate.disable(); m.touchPitch.disable(); m.keyboard.disable(); m.setMaxPitch(105); m.setMaxZoom(20); c.classList.add('bb-look'); }
    else { m.setMaxPitch(85); m.setMaxZoom(17.5); if(m.getPitch()>85) m.jumpTo({pitch:85}); m.dragPan.enable(); m.scrollZoom.enable(); m.doubleClickZoom.enable(); m.touchZoomRotate.enable(); m.keyboard.enable(); if(T3.on){ m.dragRotate.enable(); m.touchPitch.enable(); } else m.touchZoomRotate.disableRotation(); c.classList.remove('bb-look'); } }catch(e){} }
let lkP=null;
function lookInit(){ const c=ML.getCanvasContainer();
  c.addEventListener('pointerdown',e=>{ if(!T3.dvOn||(e.pointerType==='mouse'&&e.button!==0)) return; lkP={id:e.pointerId,x:e.clientX,y:e.clientY}; try{ c.setPointerCapture(e.pointerId); }catch(_){} });
  c.addEventListener('pointermove',e=>{ if(!lkP||e.pointerId!==lkP.id) return; const dx=e.clientX-lkP.x, dy=e.clientY-lkP.y; lkP.x=e.clientX; lkP.y=e.clientY; lookBy(-dx*0.3,dy*0.25); },{passive:true});
  const up=e=>{ if(lkP&&e.pointerId===lkP.id) lkP=null; }; c.addEventListener('pointerup',up); c.addEventListener('pointercancel',up);
  c.addEventListener('dblclick',e=>{ if(T3.dvOn){ e.preventDefault(); lookHome(); } });
  c.addEventListener('wheel',e=>{ if(!T3.dvOn) return; e.preventDefault(); if(T3.cm==='chase'){ T3.zk=Math.max(0.35,Math.min(AC3.L?60:4,T3.zk*(e.deltaY>0?1.15:1/1.15))); mlKick3(); } },{passive:false}); }
// arrow keys look around while flying (Shift = faster), C or 0 recentres
document.addEventListener('keydown',e=>{ if(!T3.on||!T3.dvOn||e.target.closest('input,textarea,select,[contenteditable]')) return; const k=e.shiftKey?12:4;
  const m={ArrowLeft:[-k,0],ArrowRight:[k,0],ArrowUp:[0,k*0.8],ArrowDown:[0,-k*0.8]}[e.key]; if(m){ e.preventDefault(); lookBy(m[0],m[1]); return; }
  if(e.key==='c'||e.key==='C'||e.key==='0'){ e.preventDefault(); lookHome(); } });
/* ================= Simulate the flight ================= */
const SIMC={k:null,M:null};
// the profile the simulation flies (cached per frame; render() clears it)
/* replay of a flown track (GPX) in the 3D view: the simulation's profile object is swapped for one built from the track,
   with GPS altitude and the ground speed from the track's own times; the planned route stays on the map */
const REP={on:false,M:null};
function trkM(){ const P=TRK.pts.filter((p,i,a)=>i===0||p.la!==a[i-1].la||p.lo!==a[i-1].lo); const cum=[0]; for(let i=1;i<P.length;i++) cum.push(cum[i-1]+gc(P[i-1],P[i]));
  const hasE=P.some(p=>p.ft!=null), tot=cum[cum.length-1], idx=x=>{ let lo=0, hi=cum.length-1; while(hi-lo>1){ const m=(lo+hi)>>1; if(cum[m]<=x) lo=m; else hi=m; } return lo; };
  const at=x=>{ x=Math.max(0,Math.min(tot,x)); const i=idx(x), j=Math.min(P.length-1,i+1), f=cum[j]>cum[i]?(x-cum[i])/(cum[j]-cum[i]):0; return {i,j,f}; };
  const M={trk:true,total:tot,PM:'adv',cr:null,C:[{p:{la:P[0].la,lo:P[0].lo,n:'',t:'wpt'},x:0,i:0},{p:{la:P[P.length-1].la,lo:P[P.length-1].lo,n:'',t:'wpt'},x:tot,i:1}],
    posAt(x){ const a=at(x); return {la:P[a.i].la+(P[a.j].la-P[a.i].la)*a.f, lo:P[a.i].lo+(P[a.j].lo-P[a.i].lo)*a.f}; },
    altAt(x){ if(!hasE) return 3000; const a=at(x), e0=P[a.i].ft, e1=P[a.j].ft; return e0==null?(e1||0):e1==null?e0:e0+(e1-e0)*a.f; },
    gsAt(x){ const a=at(x), i0=Math.max(0,a.i-3), i1=Math.min(P.length-1,a.i+4); if(P[i0].t==null||P[i1].t==null||P[i1].t<=P[i0].t) return null; return (cum[i1]-cum[i0])/((P[i1].t-P[i0].t)/36e5); },
    timeAt(x){ const a=at(x); if(P[a.i].t==null) return null; return P[a.i].t+((P[a.j].t||P[a.i].t)-P[a.i].t)*a.f; } };
  const R0=compute(); let A=null; try{ A=trkAlong(R0); }catch(e){} M.rx=x=>{ if(!A||!A.pts.length) return null; const k=Math.round(x/tot*(A.pts.length-1)); return A.pts[Math.max(0,Math.min(A.pts.length-1,k))].x; };
  return M; }
async function repStart(){ if(!TRK||!ML) return; REP.M=trkM(); if(!(REP.M.total>0.2)) return; REP.on=true; SIMC.k=null;
  if(!T3.on) await set3(true); if(T3.spd<30){ T3.spd=30; el('x3spd').value='30'; } T3.x=0; T3.mb=null; T3.k=1; lookHome(); el('x3r').max=String(Math.round(REP.M.total*10)/10); el('x3r').value=0; setCam('chase');
  ac3Load(); T3.ch=null; T3.play=false; HOV=0; T3.drive=true; kick3(); await new Promise(r=>setTimeout(r,400)); if(!T3.on||!REP.on) return;
  T3.loading=true; ui3p(); await simPreload(); T3.loading=false; if(!T3.on||!REP.on) return; T3.play=true; T3.t=0; ui3p(); kick3(); trkDraw(); }
function repEnd(){ if(!REP.on) return; REP.on=false; REP.M=null; SIMC.k=null; T3.play=false; T3.x=0; ui3p(); const M=compute(); if(M.total) el('x3r').max=String(Math.round(M.total*10)/10); el('simhud').hidden=true; trkDraw(); }
function simM(){ if(REP.on&&REP.M) return REP.M; const k=(R.pm||'')+'|'+JSON.stringify(R.s)+'|'+R.pts.length+'|'+(TP?TP.pts.length:0); if(SIMC.k!==k||!SIMC.M){ SIMC.k=k; SIMC.M=compute(); } return SIMC.M; }
const gsOf=()=>{ if(REP.on&&REP.M){ const g=REP.M.gsAt(T3.x||0); return g&&g>20&&g<600?g:(pnum(R&&R.gs)||100); } return pnum(R&&R.gs)||100; };
/* buffering: the tiles along the route are fetched before the flight starts (with progress, skippable) and then
   ahead of the aircraft in 12 NM chunks. If the aircraft gets within ~8 s of flight of the unfetched part, or the
   view is still loading, the speed eases down (to 15 % at most) and recovers once the tiles are in. */
function simPts(M,x0,x1){ const out=[], st=0.5; for(let x=Math.max(0,x0);x<=Math.min(M.total,x1)+1e-9;x+=st){ const q=M.posAt(x); if(q&&q.la!=null) out.push({la:q.la,lo:q.lo,x}); } return out; }
function simSpeed(dt){ const base=gsOf()/3600*T3.spd, look=Math.max(0.5,base*14), ready=T3.pf?T3.pf.readyX:Infinity;
  let k=Math.max(0.15,Math.min(1,(ready-T3.x)/look)); if(ML&&!ML.areTilesLoaded()) k=Math.min(k,0.4);
  T3.k+=(k-T3.k)*(dt>0?1-Math.exp(-dt*(k<T3.k?3:0.8)):1); }
function simAhead(){ const pf=T3.pf; if(!pf||!ML||pf.busy) return; if(T3.x>pf.toX){ pf.toX=T3.x; pf.readyX=Math.max(pf.readyX,T3.x); } if(pf.toX>=simM().total) return; if(T3.x+Math.max(6,gsOf()/3600*T3.spd*40)<pf.toX) return;
  const M=simM(), from=pf.toX, to=Math.min(M.total,from+12); pf.busy=true;
  const c=RXMAP.prefetch(ML,simPts(M,from,to),T3.cm==='ov'?pf.zc:14.5,{max:700,onProgress:k=>{ pf.readyX=Math.max(pf.readyX,k.readyX); }}); pf.ctl=c;
  c.promise.then(()=>{ pf.busy=false; pf.toX=to; pf.readyX=Math.max(pf.readyX,to); }); }
function simStop(){ if(T3.pf&&T3.pf.ctl) T3.pf.ctl.stop(); T3.pf=null; const o=el('simload'); if(o) o.hidden=true; }
// before take-off: fetch tiles for the first part of the route (all of it on short routes), showing progress
function simPreload(){ return new Promise(res=>{ if(!ML){ res(); return; } const M=simM(); simStop();
  const zc=T3.cm==='ov'?Math.max(8,Math.min(15,ML.getZoom())):14.5, first=Math.min(M.total,Math.max(25,gsOf()/3600*T3.spd*90));
  const pf=T3.pf={zc,toX:first,readyX:0,busy:true}; const o=el('simload'), bar=el('simloadb'), pct=el('simloadp'); o.hidden=false; let fin=false;
  const end=()=>{ if(fin) return; fin=true; o.hidden=true; pf.busy=false; res(); };
  el('simskip').onclick=()=>{ pf.readyX=Infinity; end(); };
  const c=RXMAP.prefetch(ML,simPts(M,0,first),zc,{max:1000,onProgress:k=>{ const f=k.n?k.done/k.n:1; bar.style.width=(f*100).toFixed(0)+'%'; pct.textContent=Math.round(f*100)+' %'; pf.readyX=k.readyX; }}); pf.ctl=c;
  if(!c.n){ pf.readyX=first; end(); return; }
  c.promise.then(()=>{ pf.readyX=Math.max(pf.readyX,first); setTimeout(end,150); }); }); }
const simAdv=()=>gsOf()/3600*T3.spd*(T3.k||1); // NM per second of screen time (T3.k < 1 while tiles ahead are still loading)
// move the profile cursor every frame, the readout a few times a second
function simHov(x,now){ if(REP.on&&REP.M){ const rx=REP.M.rx(x); if(rx!=null){ const l=el('hcur'); if(l&&psv._XS){ const px=psv._XS(rx); l.setAttribute('x1',px); l.setAttribute('x2',px); l.setAttribute('visibility','visible'); } } HOV=x; if(!T3.rdoT||now-T3.rdoT>200){ T3.rdoT=now; simHud(x); } return; } HOV=x; const l=el('hcur'); if(l&&psv._XS){ const px=psv._XS(x); l.setAttribute('x1',px); l.setAttribute('x2',px); l.setAttribute('visibility','visible'); } if(!T3.rdoT||now-T3.rdoT>200){ T3.rdoT=now; rdo(x); } }
function hmsOf(h){ if(!Number.isFinite(h)) return '–'; const s=Math.round(h*3600), hh=Math.floor(s/3600), mm=Math.floor(s%3600/60), ss=s%60; return hh? hh+':'+String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0') : mm+':'+String(ss).padStart(2,'0'); }
function simHud(x){ const h=el('simhud'); if(!h) return;
  if(REP.on&&REP.M){ const M=REP.M, c=(k,v,u)=>`<div><i>${k}</i><b>${v}${u?`<small>${u}</small>`:''}</b></div>`, tm=M.timeAt(x), g=M.gsAt(x), A=trkAlong(compute()), k2=A&&A.pts.length?A.pts[Math.max(0,Math.min(A.pts.length-1,Math.round(x/M.total*(A.pts.length-1))))]:null;
    h.hidden=!T3.on; h.innerHTML=c(L({en:'Replay',no:'Avspilling'}),esc(TRK.name||'GPX'),'')+c(L({en:'Time',no:'Tid'}),tm?new Date(tm).toISOString().slice(11,19):'–','UTC')+c('GS',g?fx(Math.round(g)):'–','kt')+c(L({en:'GPS alt',no:'GPS-høyde'}),fx(Math.round(M.altAt(x)/10)*10),'ft')+c(L({en:'Flown',no:'Fløyet'}),fx(x,1)+' / '+fx(M.total,1),'NM')+(k2?c(L({en:'Off route',no:'Fra ruten'}),fx(k2.off,1),'NM'):'')+`<div class="hw nt"><button type="button" class="btn sm" id="repx">${L({en:'End replay',no:'Avslutt avspillingen'})}</button></div>`;
    const b=el('repx'); if(b) b.onclick=repEnd; return; } const M=ML?simM():(T3.S&&T3.S.M); const show=!!(T3.on&&M&&M.C.length>=2&&M.total>0&&M.PM!=='ter');
  if(!show){ h.hidden=true; return; } h.hidden=false; x=Math.max(0,Math.min(M.total,x||0));
  const gs=gsOf(), q=tpq(x), ter=q?(q.c!=null?q.c:q.e):null, hi=q?q.e:null, alt=M.altAt(x), mg=+S('mg')||1000;
  const d=0.05, slope=(M.altAt(Math.min(M.total,x+d))-M.altAt(Math.max(0,x-d)))/(Math.min(M.total,x+d)-Math.max(0,x-d)||1), vs=Math.round(slope*gs/60/50)*50;
  const z=zones(M), end=Math.max(x,z.arrEnd||M.total), dtg=end-x, tr=trkAt(M,x);
  const nx=M.C.find(c=>c.x>x+0.05&&c.p.la!=null&&!['missed','alt'].includes(c.p.t));
  const clr=ter!=null?alt-ter:null, inE=enr(M,x);
  const cls=hi!=null&&inE? (alt<hi?'rd':alt<hi+mg?'am':'ok') : (clr!=null&&clr<0&&x>1&&x<M.total-1?'rd':'');
  const c=(k,v,u,cl)=>`<div class="${cl||''}"><i>${k}</i><b>${v}${u?`<small>${u}</small>`:''}</b></div>`;
  let warn='';
  if(hi!=null&&inE&&alt<hi) warn=`<div class="hw rd">⚠︎ ${L({en:'Below the highest terrain within',no:'Under høyeste terreng innen'})} ±${fx(sNum('cw',4.3),1)} NM (${fx(Math.round(hi))} ft)</div>`;
  else if(hi!=null&&inE&&alt<hi+mg) warn=`<div class="hw am">⚠︎ ${L({en:'Terrain clearance',no:'Terrengklaring'})} ${fx(Math.round((alt-hi)/10)*10)} ft ${L({en:'is less than your',no:'er mindre enn'})} ${fx(mg)} ft ${L({en:'margin',no:'marginen din'})}</div>`;
  else if(clr!=null&&clr<0&&x>1&&x<M.total-1) warn=`<div class="hw rd">⚠︎ ${L({en:'Below the terrain',no:'Under terrenget'})}</div>`;
  else if(!inE) warn=`<div class="hw nt">${x<=z.d? L({en:'Departure area: terrain not checked, fly the SID or visual departure',no:'Avgangsområde: terrenget sjekkes ikke, fly SID eller visuell avgang'}) : L({en:'Approach area: terrain not checked, fly the approach chart',no:'Innflygingsområde: terrenget sjekkes ikke, fly etter innflygingskartet'})}</div>`;
  h.innerHTML=c('GS',fx(gs),'kt'+(R.gs?'':' ?'))+c(L({en:'Alt',no:'Høyde'}),altTxt(Math.round(alt/10)*10),alt>taOf()?'':'ft')+c('VS',(vs>0?'+':vs<0?'−':'')+fx(Math.abs(vs)),'fpm')+c(L({en:'Track',no:'Kurs'}),tr!=null?String(Math.round(tr)%360||360).padStart(3,'0')+'°':'–','T')
    +c(L({en:'Terrain',no:'Terreng'}),ter!=null?fx(Math.round(ter/10)*10):'–','ft')+c(L({en:'Clearance',no:'Klaring'}),clr!=null?(clr<0?'−':'')+fx(Math.abs(Math.round(clr/10)*10)):'–','ft',cls)
    +c(L({en:'To go',no:'Igjen'}),fx(dtg,1),'NM'+(nx?'<span class="nx"> · '+esc(nx.p.n||'')+'</span>':''))+c('ETE',hmsOf(dtg/gs),'')+warn+(T3.play&&T3.k<0.85?`<div class="hw nt">${L({en:'Loading ahead: speed',no:'Laster inn foran: fart'})} ×${fx(T3.spd*T3.k,T3.spd*T3.k<10?1:0)}</div>`:''); }
function simBtnUI(){ const b=el('simbtn'); if(!b) return; const on=T3.on&&T3.play; b.textContent=on?'❚❚ '+L({en:'Pause',no:'Pause'}):'▶ '+L({en:'Simulate flight',no:'Simuler flygingen'}); b.setAttribute('aria-pressed',String(on)); }
function camUI(){ el('x3cam').querySelectorAll('[data-c]').forEach(b=>{ const on=b.dataset.c===T3.cm; b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); }); }
function setCam(c){ T3.cm=c; camUI(); T3.mb=null; if(ML&&T3.on&&c==='chase') ac3Load();
  if(c==='ov'){ T3.drive=false; if(ML) ml3Fit(); else { cam3(); } }
  else { T3.drive=true; if(!T3.play&&HOV==null){ HOV=T3.x; } if(!ML) T3.snap=false; }
  kick3(); }
function autoCruise(){ const top=(TP&&Math.max(0,...TP.pts.map(q=>q.e||0)))||0; return Math.max(3000,Math.ceil(top/500)*500+1000); }
async function simStart(){ if(REP.on&&!(T3.on&&T3.play)) repEnd(); if(T3.loading){ el('simskip').click(); return; } if(T3.on&&T3.play){ T3.play=false; ui3p(); return; }
  const M0=compute(); if(M0.C.filter(c=>c.p.la!=null).length<2||!M0.total) return;
  let ch=false; if(pnum(R.s.cr)==null){ const a=autoCruise(); R.s.cr=a>taOf()?'FL'+String(Math.round(a/100)).padStart(3,'0'):String(a); el('s_cr').value=R.s.cr; ch=true; }
  if(pmode()!=='adv'){ R.pm='adv'; ch=true; } if(ch){ pmUI(); render(); queueSave(); }
  if(!T3.on){ await set3(true); }
  T3.x=0; T3.mb=null; T3.k=1; lookHome(); el('x3r').value=0; camUI();
  if(ML){ ac3Load(); T3.ch=null; // put the camera at the start, let it settle, then buffer the tiles along the route at the zoom it uses
    T3.play=false; HOV=0; T3.drive=T3.cm!=='ov'; kick3(); await new Promise(r=>setTimeout(r,400)); if(!T3.on) return;
    T3.loading=true; ui3p(); await simPreload(); T3.loading=false; if(!T3.on) return; }
  T3.play=true; T3.drive=T3.cm!=='ov'; T3.t=0; ui3p(); kick3(); }
el('simbtn').onclick=()=>{ simStart(); };
// cruise control: type 6500 or FL75, or step 500 ft; GS for the timing and the simulation
function crStep(d){ const a0=pnum(R.s.cr); const a=Math.max(500,(a0==null?autoCruise():Math.round(a0/500)*500+d)); const v=a>taOf()?'FL'+String(Math.round(a/100)).padStart(3,'0'):String(a); const i=el('s_cr'); i.value=v; i.dispatchEvent(new Event('input')); }
el('crup').onclick=()=>crStep(500); el('crdn').onclick=()=>crStep(-500);
el('s_cr').addEventListener('input',()=>{ if(pnum(el('s_cr').value)!=null&&(!R.pm||R.pm==='ter')){ R.pm='adv'; pmUI(); render(); } }); // a cruise level shows the climb, cruise and descent
el('s_cr').addEventListener('keydown',e=>{ if(e.key==='ArrowUp'||e.key==='ArrowDown'){ e.preventDefault(); crStep(e.key==='ArrowUp'?500:-500); } });
el('s_gs').addEventListener('input',()=>{ R.gs=pnum(el('s_gs').value)||''; const g=el('gs'); if(g){ g.value=R.gs; const M=compute(); const t=el('sumt'); if(t) t.textContent=R.gs?hm(M.total/R.gs):'–'; } drawSum(); simUI(); simHud(T3.play?T3.x:(HOV??T3.x)); queueSave(); });
function simUI(M){ if(!R) return; const g=el('s_gs'); if(g&&document.activeElement!==g) g.value=R.gs||''; const gs=gsOf();
  const f=(id,k,d)=>{ const e=el(id); if(!e) return; const v=sNum(k,d); e.textContent=`≈ ${fx(Math.round(v*gs/60/10)*10)} fpm ${L({en:'at',no:'ved'})} ${fx(gs)} kt`; };
  f('clfpm','cl',400); f('dsfpm','ds',318); }
// Space plays and pauses in 3D; a click on the profile moves the aircraft there
document.addEventListener('keydown',e=>{ if(e.code!=='Space'||!T3.on||e.target.closest('input,textarea,select,button,[contenteditable]')) return; e.preventDefault(); el('x3play').click(); });
psv.addEventListener('click',e=>{ if(!T3.on||justDragged||!psv._XI||!psv._box) return; const r=psv.getBoundingClientRect(); const vx=(e.clientX-r.left)/r.width*(psv._W0||1000); const bx=psv._box; if(vx<bx[0]||vx>bx[0]+bx[2]) return; const M=compute(); if(M.C.length<2) return;
  const x=Math.max(0,Math.min(M.total,psv._XI(vx))); T3.x=x; el('x3r').value=x; if(!T3.play) setHov(x,true); else simHov(x,performance.now()); x3ro(x); T3.drive=T3.cm!=='ov'; kick3(); });

// høyde på kartet
function rxTop(){ const r=el('rx'); const tp=document.querySelector('.rx-top'); if(tp) r.style.setProperty('--tch',(tp.offsetTop+tp.offsetHeight+8)+'px'); const t=r.getBoundingClientRect().top+window.scrollY; r.style.setProperty('--rxtop',Math.max(0,Math.min(200,t))+'px'); }
window.addEventListener('resize',()=>{ rxTop(); shH(); drawMap(); }); setTimeout(rxTop,0); setTimeout(rxTop,600);
lyUI();
{ const lg=el('maplg'), hb=el('lghelp'); let n=0; try{ n=+localStorage.getItem('bb-rx-hint')||0; localStorage.setItem('bb-rx-hint',String(n+1)); }catch(e){}
  const set=on=>{ lg.classList.toggle('lgoff',!on); hb.setAttribute('aria-pressed',String(on)); };
  if(n>=2) set(false); else { set(true); const off=()=>{ set(false); ['pointerdown','wheel','keydown'].forEach(t=>mapEl.removeEventListener(t,off)); clearTimeout(tm); };
    const tm=setTimeout(off,6000); ['pointerdown','wheel','keydown'].forEach(t=>mapEl.addEventListener(t,off,{passive:true})); }
  hb.addEventListener('pointerdown',e=>e.stopPropagation()); hb.addEventListener('click',e=>{ e.stopPropagation(); set(lg.classList.contains('lgoff')); }); }
LAB.onLang(()=>{ { const sv=el('saved'); if(sv&&sv.textContent) sv.textContent=NSTORE.mode==='account'?L({en:'Saved to your profile',no:'Lagret på profilen din'}):L({en:'Saved in this browser',no:'Lagret i denne nettleseren'}); } { const on=!el('advp').hidden; el('shAdv').innerHTML=on?'←<span> '+L({en:'Profile',no:'Profil'})+'</span>':SET_IC+'<span> '+L({en:'Advanced',no:'Avansert'})+'</span>'; } render(); drawFix(); lyUI(); if(!el('lib').hidden) libDraw(); pmUI(); ui3p(); asUI(ML&&ML.__bb?ML.__bb.oaip:'none'); loadPacks(); if(MODE==='draw'){ drawSheet(); drawExample(); } });
Promise.all([navReady,mapReady,NSTORE.ready]).then(async()=>{ await loadFix(); libLoad(); ALL=await NSTORE.list('route'); if(!ALL.length) ALL=[blank()]; { const rid=new URLSearchParams(location.search).get('id'); load((rid&&ALL.find(x=>x.id===rid))||ALL[0]); } mlStart(); await loadPacks(); setMode(MODE); const pk=new URLSearchParams(location.search).get('pack'); if(pk) fromPack(pk); });
})();
