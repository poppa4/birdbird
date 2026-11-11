/* Birdbird – airborne starts, procedure picker and auto-fly for the cockpit trainers (C172, DA42, King Air B200).
   Shared practice area: runway 36 threshold at N=0, E=0 (metres). Procedure data follow the training chart and ops.js:
   ILS 36 IASN 110.30 crs 360, IAF ALPOR/BIKAN 3000, IF RONAX D10 3000, FAP FAPSO D5 1650, DA 210 / LOC MDA 460,
   RNP 36 LPV DA 250 / LNAV MDA 470, missed: straight ahead 360 to 3000, direct HOLAN and hold,
   holds RONAX (inbound 360, right, 1 min, 3000) and HOLAN (inbound 180, right), SID OSVIK 1N.
   Fictional data for training only. */
(function(G){
'use strict';
const NM=1852, FT=0.3048, D2R=Math.PI/180, R2D=180/Math.PI, KT=0.514444, FPM=0.00508;
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const w360=a=>{ a%=360; return a<0?a+360:a; }, w180=a=>{ a=(a+180)%360; if(a<0) a+=360; return a-180; };
const tr=(en,no)=>({en,no});

/* ---------- fixes (same as fms.js) ---------- */
const FIX={RW36:{N:0,E:0},FAPSO:{N:-5*NM,E:0},RONAX:{N:-10*NM,E:0},ALPOR:{N:-10*NM,E:-5*NM},BIKAN:{N:-10*NM,E:5*NM},HOLAN:{N:9*NM,E:0},
  TUSKA:{N:-22*NM,E:-8*NM},OSVIK:{N:18*NM,E:-14*NM},ASN:{N:900,E:-2600},AN:{N:-7600,E:0}};
Object.keys(FIX).forEach(k=>FIX[k].id=k);
const GP=3.0, TCH=50, THR=FIX.RW36;

/* ---------- aircraft numbers used by auto-fly ---------- */
const TY={
  C172:{alt0:2500,vInit:90,vApp:80,vFinal:70,vClimb:75,vCruise:100,vHold:90,vsClimb:600,vsDesc:600,vsMax:900,flare:22,retract:false,ldgFlap:1,
        climbThr:1,idle:0,max:1,kp:0.004,kd:0.02,cruiseAlt:3000,sidAlt:400,starAlt:4000},
  DA42:{alt0:3000,vInit:120,vApp:110,vFinal:95,vClimb:92,vCruise:135,vHold:120,vsClimb:800,vsDesc:800,vsMax:1200,flare:24,retract:true,ldgFlap:1,
        climbThr:0.92,idle:0,max:1,kp:0.004,kd:0.02,cruiseAlt:3000,sidAlt:450,starAlt:5000},
  B200:{alt0:3000,vInit:160,vApp:140,vFinal:108,vClimb:150,vCruise:180,vHold:160,vsClimb:1500,vsDesc:1000,vsMax:1800,flare:28,retract:true,ldgFlap:1,
        climbThr:0.85,idle:0,max:1,kp:0.003,kd:0.015,cruiseAlt:5000,sidAlt:500,starAlt:5000}
};

/* ---------- procedures ---------- */
const NAMES={
  ils:tr('ILS 36','ILS 36'), loc:tr('LOC 36 (glide slope out)','LOC 36 (glidebane ute)'), ndb:tr('NDB 36 (AN)','NDB 36 (AN)'),
  rnp_lpv:tr('RNP 36 · LPV','RNP 36 · LPV'), rnp_lv:tr('RNP 36 · LNAV/VNAV','RNP 36 · LNAV/VNAV'), rnp_ln:tr('RNP 36 · LNAV','RNP 36 · LNAV'),
  sid:tr('SID OSVIK 1N (after take-off)','SID OSVIK 1N (etter avgang)'), star:tr('STAR TUSKA 1A → ILS 36','STAR TUSKA 1A → ILS 36'),
  hold:tr('Holding at RONAX','Venteområde RONAX'), free:tr('Free flight','Fri flyging')
};
/* caps: {gps:'fms'|'nav'|null, adf:bool} */
function list(type,caps){ caps=caps||{};
  const k=['ils','loc']; if(caps.adf) k.push('ndb');
  if(caps.gps==='fms') k.push('rnp_lpv','rnp_lv','rnp_ln'); else if(caps.gps==='nav') k.push('rnp_ln');
  k.push('sid','star','hold','free'); return k.map(x=>({k:x,t:NAMES[x]})); }
const MINS={ils:210,loc:460,ndb:600,rnp_lpv:250,rnp_lv:300,rnp_ln:470};
const KIND={ils:'DA',loc:'MDA',ndb:'MDA',rnp_lpv:'DA',rnp_lv:'DA',rnp_ln:'MDA'};
const isApp=k=>k in MINS;
function onLine(fix,crsDeg,distNm,side){ const c=crsDeg*D2R; return {N:fix.N-Math.cos(c)*distNm*NM-(side||0)*Math.sin(c)*NM, E:fix.E-Math.sin(c)*distNm*NM+(side||0)*Math.cos(c)*NM}; }
/* placement and set-up of one procedure */
function def(k,type,caps){
  const T=TY[type]||TY.DA42, A0=T.alt0; caps=caps||{};
  const vecStart=type==='C172'?{N:-10.5*NM,E:-1.1*NM}:{N:-12*NM,E:-1.3*NM};
  const D={k,type,name:NAMES[k],mins:MINS[k]||null,minsKind:KIND[k]||'',gsOut:k==='loc',nav1:'110.30',crs:360,adf:k==='ndb',mode:'app',cfg:'app'};
  if(k==='ils'||k==='loc'||k==='ndb'){
    Object.assign(D,{start:Object.assign({alt:A0,hdg:30,ias:T.vInit},vecStart),
      segs:[{t:'final',lat:k==='ndb'?'trk':'loc',arm:k==='ils'?'APR':'NAV',vert:k==='ils'?'gs':'path',alt:A0}]});
  } else if(/^rnp/.test(k)){
    const p=onLine(FIX.ALPOR,14,4); const vm=k==='rnp_lpv'?'LPV':k==='rnp_lv'?'L/VNAV':'LNAV';
    const gps=caps.gps==='fms';
    Object.assign(D,{vmode:vm,start:{N:p.N,E:p.E,alt:3000,hdg:14,ias:T.vInit},fpl:['ALPOR','RONAX','FAPSO','RW36'],
      segs: gps? [{t:'final',lat:'gps',vert:vm==='LNAV'?'path':'gp',alt:3000}]
               : [{t:'legs',legs:[{fix:'ALPOR',alt:3000},{fix:'RONAX',alt:3000}]},{t:'final',lat:'trk',vert:'path',alt:3000}]});
  } else if(k==='sid'){
    Object.assign(D,{mode:'dep',cfg:'to',start:{N:1700,E:0,alt:T.sidAlt,hdg:360,ias:T.vClimb,gam:5},fpl:['OSVIK'],
      segs:[{t:'legs',legs:[{ca:360,until:1500,alt:3000},{fix:'OSVIK',alt:3000,end:true}],climb:true},{t:'cruise',alt:3000}]});
  } else if(k==='star'){
    const p=onLine(FIX.TUSKA,14,4);
    Object.assign(D,{mode:'arr',cfg:'clean',start:{N:p.N,E:p.E,alt:T.starAlt,hdg:14,ias:T.vInit},fpl:['TUSKA','ALPOR','RONAX'],
      segs:[{t:'legs',legs:[{fix:'TUSKA',alt:T.starAlt},{fix:'ALPOR',alt:3000},{fix:'RONAX',alt:3000,armLoc:true}],star:true},{t:'final',lat:'loc',arm:'APR',vert:'gs',alt:3000}],mins:MINS.ils,minsKind:'DA'});
  } else if(k==='hold'){
    Object.assign(D,{mode:'hold',cfg:'clean',start:{N:FIX.RONAX.N-5*NM,E:0,alt:3000,hdg:360,ias:T.vHold},fpl:['RONAX'],
      segs:[{t:'hold',fix:'RONAX',inb:360,dir:1,alt:3000,legT:60}]});
  } else { // free
    Object.assign(D,{mode:'free',cfg:'clean',start:{N:-30000,E:2000,alt:T.cruiseAlt,hdg:360,ias:T.vCruise},segs:[{t:'cruise',alt:T.cruiseAlt,hdg:360}]});
  }
  return D;
}
function missedSegs(){ return [{t:'legs',legs:[{ca:360,until:2700,alt:3000},{fix:'HOLAN',alt:3000}],climb:true,missed:true},{t:'hold',fix:'HOLAN',inb:180,dir:1,alt:3000,legT:60}]; }

/* ---------- briefings ---------- */
/* every start: autopilot off, the pilot hand-flies an aeroplane trimmed for the start speed; auto-fly only on request */
function handNote(type){ return type==='C172'?tr('You are hand-flying, trimmed for this speed (the C172 has no autopilot). Auto-fly lets the instructor fly it while you watch.','Du flyr for hånd, trimmet for denne farten (C172 har ingen autopilot). Autofly lar instruktøren fly mens du ser på.')
  :tr('Autopilot off — you are hand-flying, trimmed for this speed; engage it if you want (heading and altitude are preset). Auto-fly flies the whole procedure for you.','Autopiloten er av — du flyr for hånd, trimmet for denne farten; koble den inn om du vil (kurs og høyde er forhåndsvalgt). Autofly flyr hele prosedyren for deg.'); }
function brief(k,type){ const b0=brief0(k,type); if(!b0) return b0; const h=handNote(type);
  return tr(b0.en+' '+h.en+' Training data: procedures and minima are simplified for practice and are not for navigation.',b0.no+' '+h.no+' Øvingsdata: prosedyrer og minima er forenklet for trening og er ikke for navigasjon.'); }
function brief0(k,type){
  const c172=type==='C172', b=type==='B200', T=TY[type]||TY.DA42;
  const sp=v=>v+' KIAS';
  switch(k){
    case 'ils': return tr(`On vectors at ${T.alt0} ft, heading 030 to intercept the runway 36 localizer about ${c172?10:12} NM out, ${sp(T.vInit)}. NAV 1 is on IASN 110.30 with course 360. Glide slope from about 9 NM, DA 210 ft (DH 200). Missed approach: straight ahead 360 to 3000 ft, direct HOLAN and hold.`,
      `Vektorert i ${T.alt0} ft, kurs 030 for å avskjære localizeren til bane 36 ca. ${c172?10:12} NM ute, ${sp(T.vInit)}. NAV 1 står på IASN 110.30 med kurs 360. Glidebane fra ca. 9 NM, DA 210 ft (DH 200). Avbrutt innflyging: rett frem 360 til 3000 ft, direkte HOLAN og vent.`);
    case 'loc': return tr(`Same vectors as the ILS, but the glide slope is out of service: fly the localizer and a continuous 3° descent from FAPSO (D5.0, 1,650 ft), using the DME/altitude checks (D4 1,330 · D3 1,020 · D2 700). MDA 460 ft. Decide at MDA: land or go around.`,
      `Samme vektorer som ILS, men glidebanen er ute av drift: fly localizeren og en jevn 3°-nedstigning fra FAPSO (D5,0, 1650 ft) med DME/høyde-kontrollene (D4 1330 · D3 1020 · D2 700). MDA 460 ft. Bestem ved MDA: land eller gå rundt.`);
    case 'ndb': return tr(`Non-precision approach on the AN NDB (375 kHz, on the centreline 4.1 NM from the threshold): track 360° inbound to AN and 360° outbound to the runway on the ADF, 3° continuous descent, MDA 600 ft. The localizer is tuned on NAV 1 as a cross-check.`,
      `Ikke-presisjonsinnflyging på AN NDB (375 kHz, på senterlinjen 4,1 NM fra terskelen): følg 360° inn til AN og 360° ut mot banen på ADF-en, jevn 3°-nedstigning, MDA 600 ft. Localizeren er stilt inn på NAV 1 som krysskontroll.`);
    case 'rnp_lpv': case 'rnp_lv': case 'rnp_ln': { const m=k==='rnp_lpv'?'LPV DA 250 ft':k==='rnp_lv'?'LNAV/VNAV DA 300 ft':'LNAV MDA 470 ft';
      return tr(`3000 ft, 4 NM before the IAF ALPOR. RNP 36 via ALPOR is loaded and active${type==='DA42'?' (CDI on GPS)':' in the GPS navigator'}: ALPOR – RONAX (IF, 3000 ft) – FAPSO (FAF, 1650 ft) – RW36. Minimums: ${m}.${k==='rnp_ln'?' No vertical guidance: continuous 3° descent from FAPSO with the distance checks.':''}`,
        `3000 ft, 4 NM før IAF ALPOR. RNP 36 via ALPOR er lastet og aktiv${type==='DA42'?' (CDI på GPS)':' i GPS-navigatoren'}: ALPOR – RONAX (IF, 3000 ft) – FAPSO (FAF, 1650 ft) – RW36. Minima: ${m}.${k==='rnp_ln'?' Ingen vertikal ledning: jevn 3°-nedstigning fra FAPSO med avstandskontrollene.':''}`); }
    case 'sid': return tr(`Just airborne from runway 36 at about ${T.sidAlt} ft, ${sp(T.vClimb)}${T.retract?', gear still down':''}. OSVIK 1N: track 360°, at 1,500 ft turn LEFT direct OSVIK (322°, 22 NM${c172?'; ASN R-324 D21.6':''}), climb 3,000 ft. Minimum gradient 4.5 % to 1,500 ft. Run the after-take-off checklist.`,
      `Akkurat lettet fra bane 36 i ca. ${T.sidAlt} ft, ${sp(T.vClimb)}${T.retract?', understellet fortsatt ute':''}. OSVIK 1N: følg 360°, ved 1500 ft sving VENSTRE direkte OSVIK (322°, 22 NM${c172?'; ASN R-324 D21,6':''}), stig til 3000 ft. Minste stigegradient 4,5 % til 1500 ft. Ta sjekklisten etter avgang.`);
    case 'star': return tr(`${T.starAlt} ft, 4 NM before TUSKA. TUSKA 1A arrival: TUSKA – ALPOR (cross at 3000 ft) – RONAX (3000 ft), then the ILS 36${c172?' (monitor on ASN VOR/DME: TUSKA R-196 D23, ALPOR R-199 D11)':''}. Run the descent and approach checklists on the way.`,
      `${T.starAlt} ft, 4 NM før TUSKA. TUSKA 1A-ankomst: TUSKA – ALPOR (kryss i 3000 ft) – RONAX (3000 ft), så ILS 36${c172?' (følg med på ASN VOR/DME: TUSKA R-196 D23, ALPOR R-199 D11)':''}. Ta nedstignings- og innflygingssjekklistene underveis.`);
    case 'hold': return tr(`3000 ft, 5 NM south of RONAX on the localizer, inbound. Hold at RONAX (D10.0 IASN): inbound 360°, right-hand turns, 1-minute legs, 3000 ft (direct entry). Holding speed about ${sp(T.vHold)}.`,
      `3000 ft, 5 NM sør for RONAX på localizeren, inngående. Vent ved RONAX (D10,0 IASN): inngående 360°, høyresvinger, 1 minutts legger, 3000 ft (direkte innflyging). Ventefart ca. ${sp(T.vHold)}.`);
    default: return tr(`Cruise at ${T.cruiseAlt} ft, heading 360 south of the field. Explore the panel, or pick a procedure.`,`Marsj i ${T.cruiseAlt} ft, kurs 360 sør for flyplassen. Utforsk panelet, eller velg en prosedyre.`);
  }
}

/* ---------- "what to do now": three short steps for the card shown when a procedure starts ---------- */
function todo(k,type){
  const T=TY[type]||TY.DA42, ret=T.retract, c172=type==='C172';
  const cfg=ret?tr('gear down and landing flaps','understell ned og landingsflaps'):tr('landing flaps','landingsflaps');
  const fin=m=>tr(`By FAPSO (D5): ${cfg.en}. At ${m}: runway in sight → land, otherwise go around.`,`Senest ved FAPSO (D5): ${cfg.no}. Ved ${m}: banen i sikte → land, ellers gå rundt.`);
  switch(k){
    case 'ils': return [tr(`Hold heading 030 and ${T.alt0} ft — the localizer needle (NAV 1) will start to move.`,`Hold kurs 030 og ${T.alt0} ft — localizernålen (NAV 1) begynner å bevege seg.`),
      tr('As it centres, turn onto 360 and keep it centred.','Når den sentrerer, sving inn på 360 og hold den i midten.'),
      tr('Glide slope centred (about 9 NM): start down and keep it centred (about 5 × ground speed in ft/min).','Glidebanen i midten (ca. 9 NM): start nedstigningen og hold den i midten (ca. 5 × fart over bakken i ft/min).'),fin('DA 210 ft')];
    case 'loc': return [tr(`Hold heading 030 and ${T.alt0} ft until the localizer needle moves, then turn onto 360.`,`Hold kurs 030 og ${T.alt0} ft til localizernålen beveger seg, sving så inn på 360.`),
      tr('No glide slope: at FAPSO (D5.0, 1,650 ft) start a 3° descent and check D4 1,330 · D3 1,020 · D2 700.','Ingen glidebane: ved FAPSO (D5,0, 1650 ft) start 3° nedstigning og sjekk D4 1330 · D3 1020 · D2 700.'),fin('MDA 460 ft')];
    case 'ndb': return [tr(`Hold ${T.alt0} ft and turn to put the ADF needle on the nose: track 360° to AN.`,`Hold ${T.alt0} ft og sving så ADF-nålen står rett frem: følg 360° til AN.`),
      tr('After AN the needle points behind you: keep tracking 360°, 3° descent.','Etter AN peker nålen bakover: fortsett å følge 360°, 3° nedstigning.'),fin('MDA 600 ft')];
    case 'rnp_lpv': case 'rnp_lv': case 'rnp_ln': { const m=k==='rnp_lpv'?'DA 250 ft':k==='rnp_lv'?'DA 300 ft':'MDA 470 ft';
      return [tr('Follow the GPS course: ALPOR, then turn onto 360 to RONAX, at 3000 ft.','Følg GPS-kursen: ALPOR, så sving inn på 360 mot RONAX, i 3000 ft.'),
        k==='rnp_ln'?tr('At FAPSO (D5) start a 3° descent with the distance checks.','Ved FAPSO (D5) start 3° nedstigning med avstandskontrollene.'):tr('At FAPSO the glide path centres: follow it down.','Ved FAPSO sentrerer glidebanen: følg den ned.'),fin(m)]; }
    case 'sid': return [tr(`Climb straight ahead on 360 at about ${T.vClimb} KIAS${ret?'; gear up with a positive rate':''}.`,`Stig rett frem på 360 i ca. ${T.vClimb} KIAS${ret?'; understell opp med positiv stigning':''}.`),
      tr('At 1,500 ft turn LEFT direct OSVIK (about 320°).','Ved 1500 ft sving VENSTRE direkte OSVIK (ca. 320°).'),tr('Level off at 3,000 ft; after-take-off checklist.','Flat ut i 3000 ft; sjekkliste etter avgang.')];
    case 'star': return [tr(`Fly to TUSKA at ${T.starAlt} ft, then on to ALPOR — descend to cross it at 3,000 ft.`,`Fly til TUSKA i ${T.starAlt} ft, så videre til ALPOR — synk så du krysser den i 3000 ft.`),
      tr(c172?'Use the ASN VOR/DME to check your position (TUSKA R-196 D23, ALPOR R-199 D11).':'ALPOR to RONAX, then intercept the ILS 36 localizer.',c172?'Bruk ASN VOR/DME for å sjekke posisjonen (TUSKA R-196 D23, ALPOR R-199 D11).':'ALPOR til RONAX, så avskjær localizeren til ILS 36.'),
      tr('Then fly the ILS 36 to land.','Fly så ILS 36 til landing.')];
    case 'hold': return [tr('Keep flying 360 inbound on the localizer to RONAX (D10.0 IASN), 3000 ft.','Fortsett 360 inn på localizeren til RONAX (D10,0 IASN), 3000 ft.'),
      tr('Over RONAX turn RIGHT to 180 and fly 1 minute outbound.','Over RONAX sving til HØYRE til 180 og fly 1 minutt ut.'),tr('Turn RIGHT back to 360 inbound to RONAX — that is one circuit.','Sving til HØYRE tilbake til 360 inn mot RONAX — det er én runde.')];
    default: return [tr('Fly anywhere: try turns, climbs and descents, and trim off the control pressure.','Fly hvor du vil: prøv svinger, stigning og nedstigning, og trim bort rorkreftene.'),
      tr('Pick a procedure in the ✈ menu to practise an approach, a hold or a departure.','Velg en prosedyre i ✈-menyen for å øve på en innflyging, en venting eller en avgang.')];
  }
}

/* ---------- geometry ---------- */
function legGeo(A,B,s){ const dN=B.N-A.N, dE=B.E-A.E, L=Math.max(1,Math.hypot(dN,dE)), ux=dN/L, uy=dE/L; const rN=s.N-A.N, rE=s.E-A.E;
  return {L,ux,uy,dtk:w360(Math.atan2(dE,dN)*R2D),along:rN*ux+rE*uy,xtk:-rN*uy+rE*ux,dis:Math.hypot(B.N-s.N,B.E-s.E)}; }
/* distance from the threshold along the final (m, positive before the threshold) */
const dThr=s=>-(s.N-THR.N);
const pathFt=d=>TCH+d*Math.tan(GP*D2R)/FT;

/* ---------- auto-fly controller ----------
   env: {type, S, F, AP (real autopilot or null), nav:()=>page nav source for the real AP, power:{get,set}, say:(msg,cls)=>void,
         gps:()=>DA42 GPS nav or null, useLoc:()=>void (CDI to the localizer), cfg:()=>({gear,flap}), onOff:()=>void } */
function autofly(env){
  const F=env.F, S=env.S, T=TY[env.type]||TY.DA42, real=!!env.AP;
  const iap=F.mkAP();
  const AF={on:false,hand:false,key:null,D:null,segs:[],si:0,li:0,legA:null,ph:'',hs:null,rec:{},msgT:0,u:0,acc:0,lastIas:null,pathOn:false,said:{},status:'',fix:null,mode:''};
  const L=x=>(G.LAB&&LAB.L)?LAB.L(x):(x&&x.en)||x;
  const say=(m,c)=>{ try{ env.say&&env.say(L(m),c); }catch(e){} };
  const drv=()=>AF.hand||!real?iap:env.AP;
  const geoNav=()=>F.nav(S,'LOC',360);
  AF.setProc=function(k,caps){ AF.key=k; AF.D=def(k,env.type,caps); AF.reset(); };
  AF.reset=function(){ AF.segs=AF.D?AF.D.segs.slice():[]; AF.si=0; AF.li=0; AF.legA=null; AF.ph=''; AF.hs=null; AF.rec={}; AF.pathOn=false; AF.said={}; AF.fix=null; AF.hand=false; AF.landT=0; AF.gsOutWarned=0; };
  AF.hands=()=>AF.on&&(AF.hand||!real);
  AF.engage=function(){
    if(!AF.D){ return false; }
    if(S.ground||S.crash){ say(tr('Auto-fly works in the air: pick a procedure to start airborne.','Autofly virker i lufta: velg en prosedyre for å starte i lufta.'),'bad'); return false; }
    AF.on=true; AF.hand=false; AF.u=clamp(env.power.get(),0,1); AF.lastIas=null; AF.acc=0;
    const o=F.readouts(S);
    Object.assign(iap,F.mkAP()); iap.on=!real; iap.fd=true; iap.phiCmd=o.roll; iap.thCmd=o.pitch; iap.hdg=Math.round(o.hdg); iap.alt=Math.round(o.alt); iap.lat='HDG'; iap.vert='ALT'; iap.altHold=Math.round(o.alt);
    if(real){ const A=env.AP; if(!A.on){ A.on=true; A.fd=true; A.phiCmd=o.roll; A.thCmd=o.pitch; if(!A.lat){ A.lat='HDG'; A.hdg=Math.round(o.hdg); } if(!A.vert){ A.vert='ALT'; A.altHold=Math.round(o.alt); } env.apOn&&env.apOn(); } }
    AF.si=Math.min(AF.si,AF.segs.length-1); AF.legA=null;
    say(env.type==='C172'?tr('Instructor has control — you run the checklists. Move the controls to take over.','Instruktøren har kontrollene — du tar sjekklistene. Beveg rattet for å ta over.')
      :tr('Auto-fly on: the autopilot flies the procedure and the speed — you run the checklists, gear and flaps.','Autofly på: autopiloten flyr prosedyren og farten — du tar sjekklister, understell og flaps.'),'ok');
    return true; };
  AF.off=function(why,quiet){
    if(!AF.on) return; const wasHand=AF.hand||!real; AF.on=false; AF.hand=false; iap.on=false;
    if(S.ctl){ if(wasHand&&S.ground){ S.ctl.ail=0; S.ctl.ele=0; } }
    env.onOff&&env.onOff(why);
    if(quiet) return;
    if(why==='stick') say(env.type==='C172'?tr('You have control — instructor hands off.','Du har kontrollene — instruktøren slipper.'):tr('Auto-fly off: you moved the controls — you have control.','Autofly av: du beveget rattet — du har kontrollene.'),'bad');
    else if(why==='ap') say(tr('Autopilot disconnected — auto-fly off, you have control.','Autopiloten er koblet ut — autofly av, du har kontrollene.'),'bad');
    else if(why==='landed') say(tr('Landed — auto-fly off. Brakes, after-landing checklist.','Landet — autofly av. Bremser, sjekkliste etter landing.'),'ok');
    else if(why==='ground') say(tr('On the ground — auto-fly off.','På bakken — autofly av.'),'bad');
    else say(real&&!wasHand?tr('Auto-fly off — the autopilot stays in its current modes.','Autofly av — autopiloten blir i modusene den har.'):tr('Auto-fly off — you have control.','Autofly av — du har kontrollene.'),'ok');
  };
  /* ---- mode helpers on the driven autopilot ---- */
  function hdg(h){ const A=drv(); if(A.lat!=='HDG') A.lat='HDG'; A.hdg=Math.round(w360(h))||360; }
  function vAlt(a){ const A=drv(); A.alt=Math.round(a); if(A.vert!=='ALT'||Math.abs(A.altHold-a)>15){ A.vert='ALT'; A.altHold=Math.round(a); } A.vertArm=(A.vertArm||'').replace('ALTS','').trim(); }
  function vVS(vs,sel){ const A=drv(); A.vert='VS'; A.vsRef=Math.round(vs/50)*50; if(sel!=null){ A.alt=Math.round(sel); if(!/ALTS/.test(A.vertArm)) A.vertArm=((A.vertArm||'')+' ALTS').trim(); } else A.vertArm=(A.vertArm||'').replace('ALTS','').trim(); }
  function toAlt(o,ta,rate){ const A=drv(); const d=ta-o.alt;
    if(A.vert==='ALT'&&Math.abs(A.altHold-ta)<20) return;
    if(Math.abs(d)<70){ vAlt(ta); return; }
    if(A.vert==='GS'||A.vert==='GP') return;
    const r=rate!=null?rate:(d>0?T.vsClimb:-T.vsDesc); vVS(d>0?Math.abs(r):-Math.abs(r),ta); }
  function steer(o,A,B,maxI){ const g=legGeo(A,B,S); const V=Math.max(25,o.gs*KT); const k=30/(V*22);
    const icpt=clamp(-g.xtk*k,-(maxI||45),(maxI||45)); const drift=w180(o.hdg-o.trk); hdg(g.dtk+icpt+(o.gs>20?drift:0)); return g; }
  function antic(o,d1,d2){ const V=Math.max(30,o.gs)*KT, r=V*V/(9.81*Math.tan(22*D2R)), dl=Math.abs(w180(d2-d1)); return Math.min(2.5*NM,r*Math.tan(Math.min(150,dl)/2*D2R)); }
  function arm(key,navS){ const A=drv(); if(A.lat==='LOC'||A.lat==='GPS'||A.latArm===key) return; const o=F.readouts(S); F.apSet(A,S,o,key,navS); }
  /* ---- speed: power for the target speed ---- */
  function speedTarget(o,seg){ const c=env.cfg(); const ldg=(!T.retract||c.gear>=1)&&c.flap>=T.ldgFlap;
    if(AF.ph==='ga'||(seg&&seg.climb)) return T.vClimb;
    if(seg&&seg.t==='final'){ const d=dThr(S)/NM; if(d<6.5&&ldg) return T.vFinal; if(d<9) return T.vApp; return T.vInit; }
    if(seg&&seg.t==='hold') return T.vHold; if(seg&&seg.t==='cruise') return AF.key==='free'?T.vCruise:T.vInit; return T.vInit; }
  function power(o,dt,vt,climb){
    if(AF.lastIas!=null&&dt>0) AF.acc+=(((o.ias-AF.lastIas)/dt)-AF.acc)*Math.min(1,dt*2); AF.lastIas=o.ias;
    if(climb){ AF.u+=(T.climbThr-AF.u)*Math.min(1,dt*1.5); }
    else { AF.u=clamp(AF.u+(T.kp*(vt-o.ias)-T.kd*AF.acc)*dt,T.idle,T.max); }
    env.power.set(AF.u); }
  /* ---- one frame ---- */
  AF.tick=function(dt){
    if(!AF.on||dt<=0) return;
    const o=F.readouts(S);
    if(S.crash){ AF.off('ground',true); return; }
    if(S.ground&&AF.ph!=='land'){ AF.off('ground'); return; }
    if(real&&!AF.hand&&!env.AP.on){ AF.off('ap'); return; }
    if(AF.ph==='land'){ landTick(o,dt); return; }
    const seg=AF.segs[AF.si]; if(!seg){ AF.off('done'); return; }
    let climb=false;
    if(seg.t==='legs') climb=legsTick(o,dt,seg);
    else if(seg.t==='final') finalTick(o,dt,seg);
    else if(seg.t==='hold') holdTick(o,dt,seg);
    else if(seg.t==='cruise'){ if(AF.cruiseHdg==null) AF.cruiseHdg=seg.hdg!=null&&AF.key==='free'?seg.hdg:Math.round(o.hdg); hdg(AF.cruiseHdg); toAlt(o,seg.alt); AF.mode='HDG · ALT'; }
    const vt=speedTarget(o,seg); AF.vt=vt;
    // climbs: fixed climb power, vertical speed trades with airspeed
    const A=drv(); if(climb&&A.vert==='VS'&&A.vsRef>0){ A.vsRef=Math.round(clamp(T.vsClimb+(o.ias-vt)*40,100,T.vsClimb+300)/50)*50; }
    power(o,dt,vt,climb&&A.vert==='VS');
    AF.status=statusText(o);
  };
  AF.sub=function(o,h){ // per physics substep, only while auto-fly flies by hand (C172, or landing)
    if(!AF.hands()) return;
    if(S.ground){ const C=S.ctl; const n=geoNav(); const xt=(S.E-THR.E); C.ail=0; C.ele=-0.25; C.rud=clamp(-0.006*xt-0.06*w180(o.hdg-360),-0.6,0.6); if(AF.landT>0.6) C.brake=1; return; }
    if(!iap.on){ iap.on=true; iap.phiCmd=o.roll; iap.thCmd=o.pitch; }
    F.apRun(iap,S,o,AF.navS||geoNav(),h);
  };
  function legPoint(lg){ return lg.fix?FIX[lg.fix]:null; }
  function legsTick(o,dt,seg){
    const lg=seg.legs[AF.li]; if(!lg){ nextSeg(); return false; }
    let climb=!!seg.climb&&o.alt<lg.alt-150;
    if(lg.ca!=null){ // course to altitude along the runway line
      const A={N:-2*NM,E:0}, B={N:30*NM,E:0}; steer(o,A,B,30); AF.fix=null; AF.mode=L(tr('TRK','TRK'))+' 360';
      toAlt(o,lg.alt,T.vsClimb);
      if(o.alt>=lg.until){ AF.li++; AF.legA={N:S.N,E:S.E}; if(seg.legs[AF.li]&&seg.legs[AF.li].fix==='OSVIK') say(tr('1500 ft — left turn direct OSVIK.','1500 ft — venstresving direkte OSVIK.')); if(seg.legs[AF.li]&&seg.legs[AF.li].fix==='HOLAN') say(tr('Direct HOLAN, hold.','Direkte HOLAN, vent.')); }
      if(AF.key==='sid'&&T.retract&&!AF.said.gear&&o.vs>200&&o.agl>250&&env.cfg().gear>=1){ AF.said.gear=1; say(tr('Positive rate — gear up, after take-off checklist.','Positiv stigning — understell opp, sjekkliste etter avgang.')); }
      if(seg.missed&&!AF.said.ga2&&o.vs>200&&o.agl>200){ AF.said.ga2=1; if(T.retract&&env.cfg().gear>=1) say(tr('Positive rate — gear up, flaps up, missed approach 3000 ft.','Positiv stigning — understell opp, flaps opp, avbrutt innflyging 3000 ft.')); }
      return climb;
    }
    const B=legPoint(lg); if(!AF.legA) AF.legA={N:S.N,E:S.E};
    const g=steer(o,AF.legA,B,45); AF.fix=lg.fix; AF.mode=(lg.fix||'')+' · '+String(Math.round(g.dtk)).padStart(3,'0')+'°';
    // vertical: cross the fix at its altitude (descend early, never below)
    const d=lg.alt-o.alt; if(Math.abs(d)<70) vAlt(lg.alt);
    else if(d>0) toAlt(o,lg.alt,T.vsClimb);
    else { const t=g.dis/Math.max(20,o.gs*KT); const need=d/(t/60); vVS(-clamp(Math.max(T.vsDesc,-need*1.15),300,T.vsMax),lg.alt); }
    if(lg.armLoc&&!AF.said.arm){ AF.said.arm=1; env.useLoc&&env.useLoc(); arm('APR',AF.hand||!real?geoNav():env.nav()); }
    if(lg.armLoc){ const A=drv(); if(A.lat==='LOC'){ AF.li=seg.legs.length; } }
    // sequence
    const nx=seg.legs[AF.li+1]; let an=0;
    if(nx&&nx.fix){ an=antic(o,g.dtk,legGeo(B,FIX[nx.fix],B).dtk); } else if(lg.armLoc) an=antic(o,g.dtk,360);
    if(g.along>=g.L-Math.max(150,an)){ if(lg.end){ AF.rec.sidDone=true; say(tr('OSVIK — SID complete. Auto-fly holds heading and 3000 ft.','OSVIK — SID fullført. Autofly holder kurs og 3000 ft.'),'ok'); }
      if(seg.star&&lg.fix==='RONAX'){ AF.rec.starDone=true; AF.rec.starAlt=o.alt; }
      AF.li++; AF.legA={N:B.N,E:B.E}; }
    if(seg.star&&AF.li>=seg.legs.length){ if(!AF.rec.starDone){ AF.rec.starDone=true; AF.rec.starAlt=o.alt; } say(tr('Arrival complete — continuing the ILS 36.','Ankomsten er fullført — fortsetter ILS 36.'),'ok'); }
    if(AF.li>=seg.legs.length) nextSeg();
    return climb;
  }
  function nextSeg(){ AF.si++; AF.li=0; AF.legA=null; AF.hs=null; AF.pathOn=false; AF.cruiseHdg=null; }
  function finalTick(o,dt,seg){
    const real0=real&&!AF.hand;
    const nv=real0?env.nav():geoNav(); const A=drv(); const d=dThr(S);
    // lateral
    if(seg.lat==='loc'){
      if(!AF.said.arm){ AF.said.arm=1; env.useLoc&&env.useLoc(); }
      if(A.lat!=='LOC'){ arm(seg.arm||'APR',nv); steer(o,{N:-25*NM,E:0},THR,30); }
      AF.mode=A.lat==='LOC'?'LOC':'HDG · '+(A.latArm||'');
      if(A.lat==='LOC'&&!AF.said.loc){ AF.said.loc=1; say(tr('Localizer captured.','Localizer fanget.')); }
    } else if(seg.lat==='gps'){
      const gp=env.gps&&env.gps(); if(A.lat!=='GPS'&&A.latArm!=='APR') arm('APR',gp||nv); AF.mode=A.lat==='GPS'?'GPS':'GPS arm';
      if(A.lat!=='GPS'&&A.lat!=='HDG'){ A.lat='HDG'; A.hdg=Math.round(o.hdg); }
      AF.fix=gp&&gp.to;
    } else { steer(o,{N:-25*NM,E:0},THR,30); AF.mode=L(tr('TRK','TRK'))+' 360'; AF.fix=d>FIX.FAPSO.N*-1-200?'FAPSO':'RW36'; }
    // vertical
    const hT=pathFt(d);
    if(seg.vert==='gs'||seg.vert==='gp'){
      if(A.vert!=='GS'&&A.vert!=='GP'){ toAlt(o,seg.alt); if(seg.vert==='gp'&&A.lat==='GPS'&&!/GP/.test(A.vertArm)){ const gp=env.gps&&env.gps(); if(gp&&gp.lpv) A.vertArm=((A.vertArm||'')+' GP').trim(); }
        // glide slope never captured (from above, or not available): fly the 3° path
        if(d<8.6*NM&&o.alt>hT+150){ AF.pathOn=true; } if(AF.pathOn) pathVS(o,hT); }
      else if(!AF.said.gs){ AF.said.gs=1; const c=env.cfg(); say((T.retract&&c.gear<1)?tr('Glide path captured — gear down, landing checklist.','Glidebane fanget — understell ned, sjekkliste for landing.'):tr('Glide path captured — landing checklist.','Glidebane fanget — sjekkliste for landing.')); }
    } else {
      if(!AF.pathOn&&o.alt>=hT-40&&d<12*NM) AF.pathOn=true;
      if(AF.pathOn) pathVS(o,hT); else toAlt(o,seg.alt);
      if(AF.pathOn&&!AF.said.path){ AF.said.path=1; const c=env.cfg(); say((T.retract&&c.gear<1)?tr('Final descent point — gear down, landing checklist.','Nedstigningspunkt — understell ned, sjekkliste for landing.'):tr('Final descent point — 3° descent, landing checklist.','Nedstigningspunkt — 3° nedstigning, sjekkliste for landing.')); }
    }
    if(d<6*NM&&d>5*NM&&!AF.said.faf){ AF.said.faf=1; const c=env.cfg(); if((T.retract&&c.gear<1)||c.flap<T.ldgFlap) say(tr('Approaching FAPSO — configure for landing.','Nærmer seg FAPSO — konfigurer for landing.')); }
    // minimums
    const mins=AF.D.mins||200;
    if(!AF.said.m500&&o.alt<mins+500&&d<6*NM){ AF.said.m500=1; say(tr('500 above minimums.','500 over minima.')); }
    if(o.alt<=mins&&d<7*NM){ decide(o); }
  }
  function pathVS(o,hT){ const vsNom=-o.gs*KT*Math.tan(GP*D2R)/FPM; vVS(clamp(vsNom+clamp((hT-o.alt)*3,-400,400),-T.vsMax,200),null); }
  function decide(o){
    const g=geoNav(); const d=dThr(S);
    AF.rec.mins={alt:o.alt,locDots:g.valid?g.dev:null,gsDots:g.gs?g.gs.dev:null,xtk:S.E-THR.E,vdev:o.alt-pathFt(d),ias:o.ias,d:d/NM};
    const c=env.cfg(); const cfgOk=(!T.retract||c.gear>=1)&&c.flap>=T.ldgFlap; const lined=Math.abs(S.E)<150&&Math.abs(w180(o.trk-360))<12;
    if(AF.wantLand!==false&&cfgOk&&lined){ startLand(o); }
    else { startGA(o,!cfgOk); }
  }
  function startLand(o){
    AF.rec.decision='land'; AF.ph='land'; AF.landT=0;
    if(real&&env.AP.on){ env.AP.on=false; env.AP.msg=''; env.apOff&&env.apOff(); }
    AF.hand=true; Object.assign(iap,F.mkAP()); iap.on=true; iap.fd=true; iap.phiCmd=o.roll; iap.thCmd=o.pitch; iap.lat='LOC'; iap.vert='VS'; iap.vsRef=Math.round(o.vs); iap.alt=0; AF.navS=null;
    say(real?tr('Minimums — landing. Autopilot off: auto-fly flies the landing.','Minima — landing. Autopilot av: autofly lander.'):tr('Minimums — landing.','Minima — landing.'),'ok');
  }
  function startGA(o,cfg){
    AF.rec.decision='ga'; AF.ph='ga'; AF.u=1; env.power.set(1);
    say(cfg?tr('Minimums — not in landing configuration: GO AROUND. Power, flaps, positive rate, gear up.','Minima — ikke i landingskonfigurasjon: GÅ RUNDT. Effekt, flaps, positiv stigning, understell opp.')
       :tr('Minimums — GO AROUND. Power, flaps, positive rate, gear up.','Minima — GÅ RUNDT. Effekt, flaps, positiv stigning, understell opp.'),'bad');
    const A=drv(); A.vertArm=''; A.latArm=''; if(A.lat!=='HDG'){ A.lat='HDG'; A.hdg=360; } vVS(T.vsClimb,3000);
    AF.segs=AF.segs.slice(0,AF.si).concat(missedSegs()); AF.si=AF.segs.length-2; AF.li=0; AF.legA=null; AF.ph='';
  }
  function landTick(o,dt){
    const A=iap; const d=dThr(S);
    if(S.ground){ AF.landT+=dt; env.power.set(T.idle); if(!AF.rec.landed){ AF.rec.landed={vs:S.landed?S.landed.vs:null,d:S.N}; } if(Math.abs(S.Vg)<2.5&&AF.landT>2){ AF.off('landed'); } AF.status=statusText(o); return; }
    A.lat='LOC'; const agl=o.agl;
    if(agl>T.flare){ const hT=pathFt(Math.max(0,d)); const vsNom=-o.gs*KT*Math.tan(GP*D2R)/FPM; A.vert='VS'; A.vsRef=clamp(vsNom+clamp((hT-o.alt)*2,-300,300),-900,0);
      power(o,dt,T.vFinal,false); }
    else { A.vert='VS'; A.vsRef=-clamp(120+agl*6,120,400); AF.u=Math.max(T.idle,AF.u-dt*0.8); env.power.set(AF.u); }
    AF.mode=L(tr('LAND','LAND')); AF.status=statusText(o);
  }
  function holdTick(o,dt,seg){
    const F0=FIX[seg.fix], inb=seg.inb, out=w360(inb+180), dir=seg.dir||1;
    const H=AF.hs||(AF.hs={ph:'to',t:0,n:0,A:{N:S.N,E:S.E},maxDev:0});
    toAlt(o,seg.alt); AF.fix=seg.fix; if(H.n>0||H.ph!=='to') H.maxDev=Math.max(H.maxDev,Math.abs(o.alt-seg.alt));
    const inA={N:F0.N-Math.cos(inb*D2R)*10*NM,E:F0.E-Math.sin(inb*D2R)*10*NM};
    if(H.ph==='to'||H.ph==='in'){ const g=steer(o,H.ph==='to'?H.A:inA,F0,45); if(g.along>=g.L-60){ if(H.ph==='in'){ H.n++; AF.rec.hold={n:H.n,maxDev:H.maxDev,trkErr:Math.abs(w180(o.trk-inb))}; if(H.n===1) say(tr('One holding circuit complete — continuing to hold.','Én runde i ventemønsteret fullført — fortsetter å vente.'),'ok'); } H.ph='turnOut'; } }
    else if(H.ph==='turnOut'){ const e=w180(out-o.hdg); if(Math.abs(e)<30&&e*dir<=20) { hdg(out); if(Math.abs(e)<5){ H.ph='out'; H.t=0; } } else hdg(o.hdg+dir*40); }
    else if(H.ph==='out'){ hdg(out); H.t+=dt; if(H.t>=(seg.legT||60)) H.ph='turnIn'; }
    else if(H.ph==='turnIn'){ const e=w180(inb-o.hdg); if(Math.abs(e)<50&&e*dir<=45){ H.ph='in'; } else hdg(o.hdg+dir*40); }
    AF.mode=L(tr('HOLD','VENT'))+' '+seg.fix+' · '+({to:'→',in:'IN',turnOut:'⟳',out:'OUT',turnIn:'⟳'}[H.ph]||'');
  }
  function statusText(o){
    const nm=AF.D?L(AF.D.name):''; const A=drv();
    const v=A.vert==='VS'?'VS '+(A.vsRef>0?'+':'')+Math.round(A.vsRef/10)*10:A.vert==='ALT'?'ALT '+A.altHold:A.vert||'';
    return nm+' · '+(AF.mode||A.lat||'')+' · '+v+' · '+Math.round(AF.vt||0)+' KIAS';
  }
  return AF;
}

/* ---------- shared toolbar UI: the ✈ Start picker (airborne procedures and the page's own exercises in one list), the auto-fly
   toggle, the auto-fly status line and the small "what to do now" card (shown once per start in the shell's notification area) ---------- */
const CSS=`.afban{position:absolute;left:8px;top:8px;z-index:6;max-width:min(560px,70%);background:rgba(8,12,16,.86);border:1px solid #2fd17b;color:#d9fbe8;border-radius:8px;padding:5px 9px;font:600 12px/1.35 var(--f-sans,system-ui);pointer-events:none}
.afban b{color:#2fd17b;margin-right:6px}.afban small{display:block;color:#9fb0bd;font:500 11px/1.3 var(--f-mono,monospace)}
.afban[hidden]{display:none}
@media (max-width:932px),(max-height:520px){.afban{font-size:11px;padding:3px 7px;max-width:62%}}`;
const GROUPS=[[tr('Approaches','Innflyginger'),k=>isApp(k)],[tr('Departure and arrival','Avgang og ankomst'),k=>k==='sid'||k==='star'],[tr('Holding','Venting'),k=>k==='hold']];
const XG={gnd:tr('On the ground','På bakken'),ex:tr('Exercises','Øvelser')};
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
/* o:{stage, list:[{k,t}], L, type, onPick:k=>{}, onAuto:()=>{}, ex:()=>[{k,t,g:'gnd'|'ex'}], onEx:k=>{}, onFailures:()=>{}} */
function ui(o){
  if(!document.getElementById('afcss')){ const s=document.createElement('style'); s.id='afcss'; s.textContent=CSS; document.head.appendChild(s); }
  let sel=document.getElementById('apSel'), btn=document.getElementById('bAuto');
  if(!sel){ sel=document.createElement('select'); sel.className='cb afsel'; sel.id='apSel'; if(o.after) o.after.insertAdjacentElement('beforebegin',sel); }
  if(!btn){ btn=document.createElement('button'); btn.className='cb afb'; btn.id='bAuto'; btn.type='button'; btn.setAttribute('aria-pressed','false'); sel.insertAdjacentElement('afterend',btn); }
  sel.setAttribute('aria-label','Start');
  const ban=document.createElement('div'); ban.className='afban'; ban.id='afBan'; ban.hidden=true; ban.setAttribute('aria-live','polite'); o.stage.appendChild(ban);
  const SH=()=>G.SIMSHELL;
  let nowK=null;
  const api={sel,btn,ban,cur:null,ex:null,
    /* cur: airborne procedure key ('' = none), on: auto-fly on, ex: the page's current exercise key (null = none) */
    draw(cur,on,ex){ api.cur=cur; api.ex=ex==null?null:ex; const L=o.L, X=o.ex?o.ex():[];
      const opt=(v,t,on)=>`<option value="${esc(v)}"${on?' selected':''}>${esc(t)}</option>`;
      const none=!cur&&api.ex==null;
      let h=`<option value=""${none?' selected':''} disabled>${esc(L(tr('✈ Start…','✈ Start…')))}</option>`;
      h+=GROUPS.map(([g,f])=>{ const xs=o.list.filter(x=>f(x.k)); return xs.length?`<optgroup label="${esc(L(g))}">${xs.map(x=>opt(x.k,'✈ '+L(x.t),x.k===cur)).join('')}</optgroup>`:''; }).join('');
      ['gnd','ex'].forEach(g=>{ const xs=X.filter(x=>x.g===g); if(xs.length) h+=`<optgroup label="${esc(L(XG[g]))}">${xs.map(x=>opt('x:'+x.k,L(x.t),api.ex===x.k&&!cur)).join('')}</optgroup>`; });
      const other=[]; if(o.list.some(x=>x.k==='free')) other.push(opt('free',L(NAMES.free),cur==='free'));
      if(o.onFailures) other.push(opt('fail:',L(tr('Failure scenarios… (Procedures → Failures)','Feilscenarier… (Prosedyrer → Feil)')),false));
      if(other.length) h+=`<optgroup label="${esc(L(tr('Other','Annet')))}">${other.join('')}</optgroup>`;
      if(sel._h!==h){ sel._h=h; sel.innerHTML=h; }
      sel.title=L(tr('Start: an approach, a hold, a departure or an arrival in the air, or an exercise','Start: en innflyging, en venting, en avgang eller en ankomst i lufta, eller en øvelse')); api.set(on);
      if(on&&SH()&&SH().cardOn()) SH().hideCard(); },
    set(on){ btn.setAttribute('aria-pressed',on?'true':'false'); btn.textContent=o.L(tr('Auto-fly','Autofly')); btn.title=o.L(tr('Let the autopilot (C172: the instructor) fly the whole procedure while you run the checklists','La autopiloten (C172: instruktøren) fly hele prosedyren mens du tar sjekklistene')); },
    banner(on,head,txt){ if(!on){ if(!ban.hidden) ban.hidden=true; return; } const h=`<b>${head}</b>${txt?`<small>${txt}</small>`:''}`; if(ban._h!==h){ ban._h=h; ban.innerHTML=h; } if(ban.hidden) ban.hidden=false; },
    /* "what to do now": the start state and the steps, small, once per start; Fly it closes, Auto-fly hands over */
    showNow(k){ const L=o.L, D=def(k,o.type), st=D.start; nowK=k; const sh=SH(); if(!sh) return;
      const ap=o.type==='C172'?tr('hand-flying, trimmed','du flyr for hånd, trimmet'):tr('autopilot off, trimmed','autopilot av, trimmet');
      const where=tr(`${st.alt} ft · hdg ${String(Math.round(st.hdg)).padStart(3,'0')} · ${Math.round(st.ias)} KIAS · ${ap.en}`,`${st.alt} ft · kurs ${String(Math.round(st.hdg)).padStart(3,'0')} · ${Math.round(st.ias)} KIAS · ${ap.no}`);
      sh.card(`<h4><i>✈</i>${esc(L(NAMES[k]))} — ${esc(L(tr('you have control','du har kontrollene')))}</h4><p class="st">${esc(L(where))}</p><ol>${todo(k,o.type).map(x=>`<li>${esc(L(x))}</li>`).join('')}</ol>
        <div class="row"><button type="button" class="go" data-a="fly">${esc(L(tr('Fly it','Fly')))}</button><button type="button" data-a="auto">${esc(L(tr('Auto-fly it','Autofly')))}</button></div>`,a=>{ if(a==='auto') o.onAuto(); }); },
    hideNow(){ const sh=SH(); if(sh) sh.hideCard(); }};
  sel.onchange=()=>{ const v=sel.value; if(!v) return; sel.blur();
    if(v==='fail:'){ api.draw(api.cur,btn.getAttribute('aria-pressed')==='true',api.ex); if(o.onFailures) o.onFailures(); return; }
    if(v.startsWith('x:')){ if(o.onEx) o.onEx(v.slice(2)); return; }
    o.onPick(v); if(v!=='free') api.showNow(v); };
  btn.onclick=()=>o.onAuto();
  return api;
}

G.AIRPROC={FIX,TY,NAMES,MINS,list,def,brief,todo,autofly,ui,isApp,dThr,pathFt,legGeo,NM,FT};
})(window);
