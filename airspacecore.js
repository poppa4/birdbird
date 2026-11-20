/* NORDAP – airspacecore.js: the model behind the airspace lab (airspace.html), no drawing.
   One fictional airspace around one aerodrome (not a real AIP), flat terrain at sea level:
     CTR   class D  SFC–2500 ft          within 8 NM
     TMA   class C  2500 ft–FL195 within 8 NM, 3500 ft–FL195 8–15 NM, 4500 ft–FL195 15–25 NM (stepped, "upside-down wedding cake")
     CTA   class E  FL95–FL195           beyond 25 NM
     Upper class C  FL195–FL660          everywhere
     G     class G  everything else, from the surface
     RMZ   class G + RMZ, SFC–2000 ft, 4 NM around a small airfield (33 NM east)
     R-101 restricted area, SFC–6500 ft, 28–34 NM west, 5 NM either side of the route
   Rules: EASA only. SERA (Implementing Regulation (EU) No 923/2012): Appendix 4 (classes), SERA.5001 (VMC minima, Table S5-1),
   SERA.5005 (VFR, incl. CTR 1500 ft / 5 km, night, FL195), SERA.5010 (special VFR), SERA.6001, SERA.6005 (RMZ/TMZ), SERA.3145 (P/R areas).
   x, y in NM from the aerodrome (x east), alt in ft AMSL (= above ground here). */
(function(root){
'use strict';
const t2=(en,no)=>({en,no});
const TA=5000, FL100=10000, FL195=19500, FL285=28500, TOP=66000;
const STEPS=[[8,2500],[15,3500],[25,4500]];               /* TMA: outer radius, lower limit */
const RMZ={x:33,y:0,r:4,hi:2000}, RA={x0:-34,x1:-28,y:5,hi:6500};
const lim=a=>a<=0?'SFC':a>=TA&&a!==TA?'FL'+Math.round(a/100):Math.round(a)+' ft';   /* above the transition altitude levels are flight levels */
const NAMES={
  ctr:t2('Control zone (CTR)','Kontrollsone (CTR)'),
  tma:t2('Terminal control area (TMA)','Terminalområde (TMA)'),
  cta:t2('Control area (CTA)','Kontrollområde (CTA)'),
  up:t2('Upper control area','Øvre kontrollområde'),
  g:t2('Uncontrolled airspace','Ukontrollert luftrom'),
  rmz:t2('Radio mandatory zone (RMZ)','Radiopliktig sone (RMZ)')};

/* where am I: the volume, its class and its limits */
function at(x,y,alt){ y=y||0; const r=Math.hypot(x,y);
  const inR=x>=RA.x0&&x<=RA.x1&&Math.abs(y)<=RA.y&&alt<RA.hi;
  let v;
  if(alt>=FL195) v={k:'up',c:'C',lo:FL195,hi:TOP};
  else if(r<=8&&alt<2500) v={k:'ctr',c:'D',lo:0,hi:2500};
  else { const s=STEPS.find(s=>r<=s[0]);
    if(s&&alt>=s[1]) v={k:'tma',c:'C',lo:s[1],hi:FL195};
    else if(!s&&alt>=9500) v={k:'cta',c:'E',lo:9500,hi:FL195};
    else { const hi=s?s[1]:9500; const rmz=Math.hypot(x-RMZ.x,y-RMZ.y)<=RMZ.r&&alt<RMZ.hi;
      v=rmz?{k:'rmz',c:'G',lo:0,hi:RMZ.hi,rmz:true}:{k:'g',c:'G',lo:0,hi}; } }
  v.r=inR; v.name=NAMES[v.k]; v.lims=lim(v.lo)+' – '+(v.hi>=TOP?'FL660':lim(v.hi)); return v; }

/* SERA Appendix 4: what each class gives and asks, by flight rules */
const YES=t2('Yes','Ja'), NO=t2('No','Nei');
const SEP={all:t2('From all other flights','Fra alle andre flyginger'),ifrAll:t2('From IFR and VFR','Fra IFR og VFR'),fromIfr:t2('From IFR flights','Fra IFR-flyginger'),ifr:t2('From other IFR flights','Fra andre IFR-flyginger'),
  ifrPr:t2('From other IFR, as far as practical','Fra andre IFR, så langt det er praktisk mulig'),nil:t2('None: you see and avoid','Ingen: du ser og unngår')};
const SVC={atc:t2('Air traffic control','Flygekontrolltjeneste'),
  cV:t2('ATC; separation from IFR, traffic information on other VFR','ATC; separasjon fra IFR, trafikkinformasjon om andre VFR'),
  dI:t2('ATC; traffic information on VFR flights','ATC; trafikkinformasjon om VFR-flyginger'),
  dV:t2('ATC; traffic information on IFR and other VFR','ATC; trafikkinformasjon om IFR og andre VFR'),
  eI:t2('ATC; traffic information on VFR as far as practical','ATC; trafikkinformasjon om VFR så langt det er praktisk mulig'),
  eV:t2('Traffic information as far as practical','Trafikkinformasjon så langt det er praktisk mulig'),
  fI:t2('Air traffic advisory service; flight information if requested','Rådgivningstjeneste; flygeinformasjon på forespørsel'),
  fis:t2('Flight information service if requested','Flygeinformasjonstjeneste på forespørsel')};
const KT=t2('250 kt IAS below FL100','250 kt IAS under FL100'), NA=t2('None in the class','Ingen i klassen');
const TAB={
  A:{IFR:{sep:SEP.all,svc:SVC.atc,spd:NA,radio:YES,clr:YES},VFR:null},
  B:{IFR:{sep:SEP.all,svc:SVC.atc,spd:NA,radio:YES,clr:YES},VFR:{sep:SEP.all,svc:SVC.atc,spd:NA,radio:YES,clr:YES}},
  C:{IFR:{sep:SEP.ifrAll,svc:SVC.atc,spd:NA,radio:YES,clr:YES},VFR:{sep:SEP.fromIfr,svc:SVC.cV,spd:KT,radio:YES,clr:YES}},
  D:{IFR:{sep:SEP.ifr,svc:SVC.dI,spd:KT,radio:YES,clr:YES},VFR:{sep:SEP.nil,svc:SVC.dV,spd:KT,radio:YES,clr:YES}},
  E:{IFR:{sep:SEP.ifr,svc:SVC.eI,spd:KT,radio:YES,clr:YES},VFR:{sep:SEP.nil,svc:SVC.eV,spd:KT,radio:NO,clr:NO}},
  F:{IFR:{sep:SEP.ifrPr,svc:SVC.fI,spd:KT,radio:t2('Yes (advisory service)','Ja (rådgivningstjeneste)'),clr:NO},VFR:{sep:SEP.nil,svc:SVC.fis,spd:KT,radio:NO,clr:NO}},
  G:{IFR:{sep:SEP.nil,svc:SVC.fis,spd:KT,radio:t2('Must be able to talk to ATS','Må kunne snakke med ATS'),clr:NO},VFR:{sep:SEP.nil,svc:SVC.fis,spd:KT,radio:NO,clr:NO}}};
const CONTROLLED=c=>'ABCDE'.includes(c);

/* SERA.5001 Table S5-1: the VMC band at this altitude (flat terrain at sea level, so 3000 ft AMSL is the higher of the two) */
function band(alt,c){
  if(alt>=FL100) return {k:'hi',vis:8,h:1500,v:1000,clear:false};
  if(alt>3000) return {k:'mid',vis:5,h:1500,v:1000,clear:false};
  if(c==='F'||c==='G') return {k:'low',vis:5,h:0,v:0,clear:true};
  return {k:'low',vis:5,h:1500,v:1000,clear:false}; }

/* the whole picture for one flight: wx = {vis (km), base (ft) or null, thick (ft)}; night true/false; rActive true/false */
function judge(S){
  const v=at(S.x,S.y||0,S.alt), fr=S.fr, row=TAB[v.c][fr], wx=S.wx, out={v,row,issues:[],notes:[]};
  const base=wx.base, top=base==null?null:base+wx.thick;
  out.inCloud=base!=null&&S.alt>=base&&S.alt<=top;
  out.vDist=base==null?Infinity:S.alt<base?base-S.alt:S.alt>top?S.alt-top:0;
  out.below=base==null||S.alt<base;
  if(v.r&&S.rActive) out.issues.push({k:'r',m:t2('Restricted area R-101 is active: do not enter unless you meet its conditions or have permission (SERA.3145).','Restriksjonsområdet R-101 er aktivt: ikke fly inn med mindre du oppfyller vilkårene eller har tillatelse (SERA.3145).')});
  if(v.rmz) out.notes.push({k:'rmz',m:t2('RMZ: keep a continuous listening watch and call before you enter (SERA.6005).','RMZ: hold kontinuerlig lyttevakt og meld deg før du flyr inn (SERA.6005).')});
  if(fr==='IFR'){
    out.clr=CONTROLLED(v.c)?'yes':'no';
    if(out.inCloud) out.notes.push({k:'imc',m:t2('In cloud: fine for IFR.','I sky: greit for IFR.')});
    out.ok=!out.issues.length; return out; }
  /* VFR */
  if(S.alt>=FL195){ out.issues.push({k:'fl195',m:t2('No VFR above FL195 unless the authority allows it (SERA.5005).','Ingen VFR over FL195 uten at myndigheten tillater det (SERA.5005).')}); out.ok=false; out.clr='no-vfr'; return out; }
  const b=band(S.alt,v.c); out.band=b;
  const minVis=b.vis;
  if(out.inCloud) out.issues.push({k:'cloud',m:t2('You are in cloud: not VMC.','Du er i sky: ikke VMC.')});
  else if(!b.clear&&out.vDist<b.v) out.issues.push({k:'vdist',m:t2(`Only ${Math.round(out.vDist)} ft from cloud: VMC needs ${b.v} ft vertically here.`,`Bare ${Math.round(out.vDist)} ft fra skyen: VMC krever ${b.v} ft vertikalt her.`)});
  if(wx.vis<minVis) out.issues.push({k:'vis',m:t2(`Visibility ${fmtKm(wx.vis)}: VMC needs ${minVis} km here.`,`Sikt ${fmtKm(wx.vis,'no')}: VMC krever ${minVis} km her.`)});
  if(b.clear&&!out.below&&!out.inCloud) out.issues.push({k:'surf',m:t2('Above the cloud: low in class G you must keep the surface in sight.','Over skyen: lavt i klasse G må du ha bakken i sikte.')});
  if(S.night){
    if(base!=null&&base<1500) out.issues.push({k:'nceil',m:t2('Night VFR needs a ceiling of at least 1500 ft (SERA.5005).','VFR om natten krever skyhøyde minst 1500 ft (SERA.5005).')});
    if(S.alt<=3000&&!out.below&&!out.inCloud&&!b.clear) out.issues.push({k:'nsurf',m:t2('Night VFR at or below 3000 ft: keep continuous sight of the surface.','VFR om natten på eller under 3000 ft: ha kontinuerlig bakkesikt.')}); }
  /* the CTR: VFR to or from the aerodrome needs ceiling 1500 ft and ground visibility 5 km, else special VFR (SERA.5005(b), SERA.5010) */
  out.svfr=null;
  if(v.k==='ctr'){ const ceil=base==null?Infinity:base;
    if(ceil<1500||wx.vis<5){
      const can=!S.night&&ceil>=600&&wx.vis>=1.5&&out.below;
      out.svfr=can?'possible':'no';
      /* special VFR replaces the normal VMC minima: clear of cloud, surface in sight, flight visibility 1500 m, 140 kt */
      out.issues=out.issues.filter(i=>!['vis','vdist'].includes(i.k));
      if(can) out.notes.push({k:'svfr',m:t2('Below the CTR minima for VFR (ceiling 1500 ft, visibility 5 km): you need a special VFR clearance. Clear of cloud, surface in sight, at least 1500 m visibility, 140 kt or less.','Under CTR-minima for VFR (skyhøyde 1500 ft, sikt 5 km): du trenger spesiell VFR-klarering. Fri av skyer, bakken i sikte, minst 1500 m sikt, maks 140 kt.')});
      else out.issues.push({k:'nosvfr',m:S.night?t2('Below the CTR minima, and special VFR is by day only unless the authority allows it.','Under CTR-minima, og spesiell VFR er bare om dagen med mindre myndigheten tillater det.')
        :t2('Below even the special VFR limits (ceiling 600 ft, ground visibility 1500 m): ATC will not clear you to take off, land or enter.','Under selv grensene for spesiell VFR (skyhøyde 600 ft, bakkesikt 1500 m): ATC klarerer deg ikke for avgang, landing eller innflyging.')}); } }
  out.clr=out.svfr==='possible'?'svfr':row.clr===YES?'yes':'no';
  out.ok=!out.issues.length; return out; }
function fmtKm(k,l){ const s=k>=10?'10 km or more':k<1?Math.round(k*1000)+' m':(Math.round(k*10)/10)+' km'; return l==='no'?s.replace('or more','eller mer').replace('.',','):s; }

const API={t2,TA,FL100,FL195,FL285,TOP,STEPS,RMZ,RA,NAMES,TAB,at,band,judge,lim,CONTROLLED,fmtKm};
if(typeof module==='object'&&module.exports) module.exports=API; else root.ASPC=API;
})(typeof window!=='undefined'?window:this);
