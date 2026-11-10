/* Birdbird – FMS: navigasjonsdatabase, flyplan, prosedyrer, direkte-til og GPS-navigasjon.
   Fiktiv region rundt Birdbird. Lokale koordinater i meter (N, E) med terskel RWY 36 i origo. */
(function(G){
'use strict';
const NM=1852, D2R=Math.PI/180, R2D=180/Math.PI, FT=0.3048;
const w360=a=>{ a%=360; return a<0?a+360:a; }, w180=a=>{ a=(a+180)%360; if(a<0) a+=360; return a-180; };

/* ---------- database ---------- */
const DB={};
function add(id,type,N,E,name,extra){ DB[id]=Object.assign({id,type,N,E,name},extra||{}); }
add('NAER','APT',750,0,'BIRDBIRD FIELD',{elev:0,rwy:'18/36',city:'BIRDBIRD'});
add('VSTB','APT',40*NM,6*NM,'VESTBY',{elev:300,rwy:'04/22',city:'VESTBY'});
add('FJVK','APT',12*NM,-11*NM,'FJORDVIK',{elev:60,rwy:'11/29',city:'FJORDVIK'});
add('HOLM','APT',-28*NM,20*NM,'HOLMEN',{elev:120,rwy:'16/34',city:'HOLMEN'});
add('SKRV','APT',-35*NM,-12*NM,'SKARVIK',{elev:40,rwy:'09/27',city:'SKARVIK'});
add('ASN','VOR',900,-2600,'BIRDBIRD',{freq:'113.30'});
add('VSB','VOR',40.5*NM,8*NM,'VESTBY',{freq:'116.50'});
add('ALPOR','INT',-10*NM,-5*NM,'ALPOR'); add('BIKAN','INT',-10*NM,5*NM,'BIKAN'); add('RONAX','INT',-10*NM,0,'RONAX');
add('FAPSO','INT',-5*NM,0,'FAPSO'); add('RW36','RWY',0,0,'RUNWAY 36'); add('HOLAN','INT',9*NM,0,'HOLAN');
add('TUSKA','INT',-22*NM,-8*NM,'TUSKA'); add('OSVIK','INT',18*NM,-14*NM,'OSVIK'); add('KORPA','INT',28*NM,3*NM,'KORPA'); add('DRAGE','INT',-16*NM,14*NM,'DRAGE');
const NAVAIDS=[{id:'ASN',type:'VOR',freq:'113.30',N:900,E:-2600},{id:'VSB',type:'VOR',freq:'116.50',N:40.5*NM,E:8*NM},{id:'IASN',type:'LOC',freq:'110.30',N:1800,E:0,crs:360}];

/* prosedyrer (NAER) */
const FIX=(id,alt)=>({id,alt});
const APPR={
  NAER:[
    {name:'ILS 36', kind:'ILS', loc:'110.30', crs:360, trans:{
      'VECTORS':[FIX('FAPSO',1700),FIX('RW36',50)],
      'ALPOR':[FIX('ALPOR',3000),FIX('RONAX',3000),FIX('FAPSO',1700),FIX('RW36',50)],
      'BIKAN':[FIX('BIKAN',3000),FIX('RONAX',3000),FIX('FAPSO',1700),FIX('RW36',50)],
      'RONAX':[FIX('RONAX',3000),FIX('FAPSO',1700),FIX('RW36',50)]}, missed:[FIX('HOLAN',3000)]},
    {name:'RNAV 36', kind:'RNAV', lpv:true, crs:360, trans:{
      'VECTORS':[FIX('FAPSO',1700),FIX('RW36',50)],
      'ALPOR':[FIX('ALPOR',3000),FIX('RONAX',3000),FIX('FAPSO',1700),FIX('RW36',50)],
      'BIKAN':[FIX('BIKAN',3000),FIX('RONAX',3000),FIX('FAPSO',1700),FIX('RW36',50)],
      'RONAX':[FIX('RONAX',3000),FIX('FAPSO',1700),FIX('RW36',50)]}, missed:[FIX('HOLAN',3000)]}
  ]
};

const geo=(A,B)=>{ const dN=B.N-A.N, dE=B.E-A.E; return {dist:Math.hypot(dN,dE), brg:w360(Math.atan2(dE,dN)*R2D)}; };

/* ---------- flyplan ---------- */
function mkFP(){ return {wps:[], act:-1, dto:null, appr:null, apprActive:false, susp:false, msg:null}; }
function wp(id,extra){ const d=DB[id]; if(!d) return null; return Object.assign({id:d.id,type:d.type,N:d.N,E:d.E,name:d.name},extra||{}); }
function setRoute(fp,ids,pos){ fp.wps=ids.map(i=>wp(i)).filter(Boolean); fp.appr=null; fp.apprActive=false; fp.dto=null; fp.susp=false; fp.act=fp.wps.length>1?1:(fp.wps.length?0:-1); if(fp.act===0&&pos) fp.dto={N:pos.N,E:pos.E}; }
function enrouteCount(fp){ return fp.wps.filter(w=>!w.appr).length; }
function insert(fp,idx,id){ const w=wp(id); if(!w) return false;
  const nEn=enrouteCount(fp); if(idx>nEn) idx=nEn; fp.wps.splice(idx,0,w);
  if(fp.act>=idx) fp.act++; if(fp.act<0) fp.act=fp.wps.length>1?1:0; return true; }
function remove(fp,idx){ if(idx<0||idx>=fp.wps.length) return; const w=fp.wps[idx]; if(w.appr){ removeAppr(fp); return; }
  fp.wps.splice(idx,1); if(fp.act>idx) fp.act--; else if(fp.act===idx){ fp.dto=null; } if(fp.act>=fp.wps.length) fp.act=fp.wps.length-1; if(!fp.wps.length) fp.act=-1; }
function removeAppr(fp){ fp.wps=fp.wps.filter(w=>!w.appr); fp.appr=null; fp.apprActive=false; if(fp.act>=fp.wps.length) fp.act=fp.wps.length-1; }
function loadAppr(fp,apt,ap,trans,activate,pos){
  removeAppr(fp);
  // flyplassen er destinasjon: legg den til hvis den mangler
  if(!fp.wps.length||fp.wps[fp.wps.length-1].id!==apt) fp.wps.push(wp(apt));
  const legs=ap.trans[trans].concat(ap.missed.map(m=>Object.assign({},m,{missed:true})));
  legs.forEach((f,i)=>{ const w=wp(f.id,{appr:true,alt:f.alt,missed:!!f.missed}); if(f.id==='FAPSO') w.faf=true; if(f.id==='RW36') w.mapt=true; fp.wps.push(w); });
  fp.appr={apt,name:ap.name,kind:ap.kind,lpv:!!ap.lpv,trans,loc:ap.loc,crs:ap.crs};
  if(trans==='VECTORS'){ const i=fp.wps.findIndex(w=>w.appr&&w.faf); fp.vtf=true; if(activate) activateLegTo(fp,i,pos,true); }
  else { fp.vtf=false; if(activate){ const i=fp.wps.findIndex(w=>w.appr); activateLegTo(fp,i,pos,false); if(pos) fp.dto={N:pos.N,E:pos.E}; } }
  if(activate) fp.apprActive=true;
}
function activateLegTo(fp,idx,pos,vtf){ fp.act=idx; fp.susp=false; fp.dto=null; fp.vtfLeg=!!vtf; if(idx===0||vtf) fp.dto=null; if(idx===0&&pos) fp.dto={N:pos.N,E:pos.E}; }
function activateAppr(fp,pos,vtf){ if(!fp.appr) return false; if(vtf){ const i=fp.wps.findIndex(w=>w.appr&&w.faf); activateLegTo(fp,i,pos,true); } else { const i=fp.wps.findIndex(w=>w.appr); activateLegTo(fp,i,pos,false); fp.dto={N:pos.N,E:pos.E}; } fp.apprActive=true; return true; }
function directTo(fp,id,pos){ let idx=fp.wps.findIndex(w=>w.id===id);
  if(idx<0){ const w=wp(id); if(!w) return false; fp.wps=[w]; fp.appr=null; fp.apprActive=false; idx=0; }
  fp.act=idx; fp.dto={N:pos.N,E:pos.E}; fp.susp=false; fp.vtfLeg=false; return true; }

/* ---------- GPS-navigasjon ---------- */
function legOf(fp){
  if(fp.act<0||!fp.wps[fp.act]) return null;
  const B=fp.wps[fp.act];
  let A=fp.dto;
  if(fp.obs!=null){ const c=fp.obs*D2R; A={N:B.N-Math.cos(c)*20*NM,E:B.E-Math.sin(c)*20*NM}; return {A,B,obs:true}; }
  if(!A){ if(fp.vtfLeg){ const c=(fp.appr?fp.appr.crs:360)*D2R; A={N:B.N-Math.cos(c)*20*NM,E:B.E-Math.sin(c)*20*NM}; } else A=fp.wps[fp.act-1]||null; }
  return A?{A,B}:null;
}
function gps(fp,s,gsKt){
  const R={valid:false,src:'GPS',label:'GPS',mode:'ENR',fs:2};
  const lg=legOf(fp); if(!lg) return R;
  const {A,B}=lg, dN=B.N-A.N, dE=B.E-A.E, L=Math.max(1,Math.hypot(dN,dE)), ux=dN/L, uy=dE/L;
  const rN=s.N-A.N, rE=s.E-A.E, along=rN*ux+rE*uy, xtk=-rN*uy+rE*ux;
  const dis=Math.hypot(B.N-s.N,B.E-s.E);
  R.obs=fp.obs!=null; R.valid=true; R.to=B.id; R.from=fp.dto?(fp.vtfLeg?'':'D→'):(fp.wps[fp.act-1]?fp.wps[fp.act-1].id:''); R.dtk=w360(Math.atan2(dE,dN)*R2D); R.crs=R.dtk;
  R.xtk=xtk; R.dis=dis/NM; R.brg=w360(Math.atan2(B.E-s.E,B.N-s.N)*R2D); R.along=along; R.L=L; R.toFrom=along<=L?'TO':'FROM';
  R.ete=gsKt>20? R.dis/gsKt*3600 : null; R.dist=R.dis; R.id=B.id; R.freq='';
  // CDI-skala
  const dest=fp.wps.filter(w=>!w.appr).slice(-1)[0];
  const dDest=dest? Math.hypot(dest.N-s.N,dest.E-s.E)/NM : 99;
  let mode='ENR', fs=2;
  if(dDest<31){ mode='TERM'; fs=1; }
  const fafI=fp.wps.findIndex(w=>w.appr&&w.faf), mapI=fp.wps.findIndex(w=>w.appr&&w.mapt);
  if(fp.apprActive&&fp.appr&&fafI>=0){
    const faf=fp.wps[fafI], dFaf=Math.hypot(faf.N-s.N,faf.E-s.E)/NM;
    const onFinal = fp.act===mapI || (fp.act===fafI && dFaf<2.2);
    if(onFinal){ mode= fp.appr.kind==='RNAV' ? (fp.appr.vmode||(fp.appr.lpv?'LPV':'LNAV')) : 'LNAV'; fs=0.3; if(fp.act===fafI) fs=0.3+ (Math.max(0,dFaf)/2)*0.7; }
    // glidebane (LPV)
    if(fp.appr.kind==='RNAV'&&fp.appr.lpv&&(fp.act===mapI||fp.act===fafI)){
      const thr=fp.wps[mapI], d=Math.max(0,(s.N-thr.N)*-1); // langs finalen (RWY 36 => sør for terskelen)
      const tgtFt=50+d*Math.tan(3*D2R)/FT, altFt=s.h/FT;
      const span=Math.max(75, d*Math.tan(0.7*D2R)/FT);
      if(d>200 && d<12*NM) R.gp={dev:Math.max(-1.2,Math.min(1.2,(altFt-tgtFt)/span)), targetH:(tgtFt)*FT, d};
    }
  }
  if(fp.susp) mode=mode;
  R.mode=mode; R.fs=fs; R.dev=Math.max(-1.2,Math.min(1.2,-(xtk/NM)/fs));
  R.lpv=!!(fp.appr&&fp.appr.lpv&&fp.apprActive); R.gs=R.gp||null;
  R.lbl=fp.appr&&fp.apprActive? fp.appr.name : '';
  return R;
}
/* sekvensering */
function sequence(fp,s,gsKt,trkDeg){
  const lg=legOf(fp); if(!lg||fp.susp||fp.obs!=null) return null;
  const {A,B}=lg, L=Math.max(1,Math.hypot(B.N-A.N,B.E-A.E));
  const along=(s.N-A.N)*(B.N-A.N)/L+(s.E-A.E)*(B.E-A.E)/L;
  const next=fp.wps[fp.act+1];
  const cur=fp.wps[fp.act];
  if(cur.mapt){ if(along>=L){ fp.susp=true; return 'SUSP'; } return null; }
  let antic=0;
  if(next){ const d1=geo(A,B).brg, d2=geo(B,next).brg, dlt=Math.abs(w180(d2-d1)); const V=Math.max(30,gsKt)*0.514444; const r=V*V/(9.81*Math.tan(25*D2R)); antic=Math.min(2*NM, r*Math.tan(Math.min(150,dlt)/2*D2R)); }
  if(next && along>=L-antic){ fp.act++; fp.dto=null; fp.vtfLeg=false; return 'SEQ'; }
  return null;
}
function unsuspend(fp){ if(fp.susp){ fp.susp=false; const i=fp.act+1; if(fp.wps[i]){ fp.act=i; fp.dto=null; } } }
function nearest(s,type){ return Object.values(DB).filter(d=>!type||d.type===type).map(d=>({d,dist:Math.hypot(d.N-s.N,d.E-s.E)/NM,brg:w360(Math.atan2(d.E-s.E,d.N-s.N)*R2D)})).sort((a,b)=>a.dist-b.dist); }
function match(prefix){ prefix=(prefix||'').toUpperCase(); if(!prefix) return null; const ks=Object.keys(DB).sort(); return ks.find(k=>k.startsWith(prefix))||null; }
function navaid(freq){ return NAVAIDS.find(n=>n.freq===freq)||null; }
function legRows(fp){ // tabell for FPL-siden
  return fp.wps.map((w,i)=>{ const p=i>0?fp.wps[i-1]:null; const g=p?geo(p,w):null; return {w,i,dtk:g?g.brg:null,dis:g?g.dist/NM:null}; });
}

G.FMS={activateAppr,DB,NAVAIDS,APPR,NM,mkFP,setRoute,insert,remove,removeAppr,loadAppr,directTo,activateLegTo,gps,sequence,unsuspend,nearest,match,navaid,legRows,geo,w360,w180};
})(window);
