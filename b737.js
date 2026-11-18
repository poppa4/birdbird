/* NORDAP – Boeing 737-800 cockpit procedure trainer: the aircraft configuration (b737.html). It runs on the same engine as
   the A320 trainer (a320-app.js: panel, zoom, overlay, outside view, frame governor; a320sys.js: the system logic; a320fm.js:
   the point-mass flight model and the autopilot) and gives it the 737: the photoreal flight deck (FlightGear 737-800YV,
   GPL-2.0), its switches and lights, conventional flight controls with a trimmable stabilizer, the MCP with Boeing modes and
   the FMA, an autothrottle that moves the thrust levers, the six-pack and master caution, the Boeing displays (b737disp.js)
   and the CDU (b737cdu.js).
   What maps to what: the 737 systems are drawn and switched as on the 737 and run on the shared logic where the two
   aircraft work alike (electrics: transfer buses ↔ AC 1 / AC 2; hydraulics A / B ↔ green / yellow; fuel tanks 1, centre, 2;
   bleeds, packs and the isolation valve; APU; engine start with the start switch and the start lever). */
(function(){
'use strict';
const LT={"AFTCARGO":[587.7,255.0,16.7,8.5],"AFTENTRY":[552.5,264.1,16.7,8.5],"AFTSERVICE":[570.2,264.1,16.7,8.5],"ALTNpack":[668.1,278.5,16.7,8.5],"APUbus":[422.9,325.8,16.7,8.5],"AUTOFAIL":[632.9,278.5,16.7,8.5],"AUTOSLATFAIL":[349.4,145.7,16.7,8.5],"BATDISCHARGE":[397.3,123.3,16.7,8.5],"BLEEDTRIPL":[639.7,246.2,16.7,8.5],"BLEEDTRIPR":[679.5,246.2,16.7,8.5],"CAPTPITOT":[534.2,92.1,16.7,8.5],"COWLICEL":[573.7,142.9,16.7,8.5],"COWLICER":[590.8,142.9,16.7,8.5],"DIFFPRESS":[349.4,119.2,16.7,8.5],"DRIVEL":[394.3,214.7,16.7,8.5],"DRIVER":[451.9,214.7,16.7,8.5],"DUALBLEED":[633.3,155.3,16.7,8.5],"ELEC":[432.9,123.3,16.7,8.5],"ENGLcowl":[573.7,152.0,16.7,8.5],"engL":[296.4,271.3,16.7,8.5],"engR":[355.7,271.3,16.7,8.5],"ENGRcowl":[590.7,152.0,16.7,8.5],"EQIPCOOLL":[484.2,225.7,16.7,8.5],"EQIPCOOLR":[501.6,225.7,16.7,8.5],"EQUIP":[535.0,255.0,16.7,8.5],"fault":[427.4,366.6,16.7,8.5],"filterbypassL":[296.5,310.7,16.7,8.5],"filterbypassR":[355.1,310.7,16.7,8.5],"FOPITOT":[590.6,92.1,16.7,8.5],"FWDCARGO":[587.7,245.6,16.7,8.5],"FWDENTRY":[552.5,236.7,16.7,8.5],"FWDSERVICE":[570.2,236.7,16.7,8.5],"GENOFFL":[390.9,327.4,16.7,8.5],"GENOFFR":[455.3,327.4,16.7,8.5],"GRDpw":[422.9,270.1,16.7,8.5],"HYDAelec2lopress":[552.5,200.8,16.7,8.5],"HYDAeng1lopress":[534.9,200.8,16.7,8.5],"HYDBelec1lopress":[592.2,200.8,16.7,8.5],"HYDBeng2lopress":[574.6,200.8,16.7,8.5],"L1overwing":[552.5,245.6,16.7,8.5],"L2overwing":[552.5,255.0,16.7,8.5],"LALPHA":[534.2,110.6,16.7,8.5],"LAVSMOKE":[492.8,184.3,16.7,8.5],"LELEVPITOT":[534.2,101.2,16.7,8.5],"LOPRESSC1":[316.2,344.8,16.7,8.5],"LOPRESSC2":[335.7,344.8,16.7,8.5],"LOPRESSL1":[292.9,380.4,16.7,8.5],"LOPRESSL2":[312.4,380.4,16.7,8.5],"LOPRESSR1":[339.8,380.4,16.7,8.5],"LOPRESSR2":[359.2,380.4,16.7,8.5],"lowoilpressapu":[410.1,366.6,16.7,8.5],"LTEMP":[534.2,119.9,16.7,8.5],"MACHTRIM":[349.4,136.7,16.7,8.5],"MAINT":[484.4,342.7,16.7,8.5],"MAINTapu":[393.0,366.6,16.7,8.5],"MANUALpack":[685.4,278.5,16.7,8.5],"NOTARMED":[484.5,258.3,8.5,16.7],"OFFSCHEDDESC":[650.2,278.5,16.7,8.5],"overheatHYDL":[552.5,191.7,16.7,8.5],"overheatHYDR":[574.6,191.7,16.7,8.5],"overspeed":[444.8,366.6,16.7,8.5],"PACKL":[639.7,227.9,16.7,8.5],"PACKR":[679.5,227.9,16.7,8.5],"R1overwing":[570.2,245.6,16.7,8.5],"R2overwing":[570.2,255.0,16.7,8.5],"RALPHA":[590.6,110.6,16.7,8.5],"RAMDOOROPENL":[650.5,155.3,16.7,8.5],"RAMDOOROPENR":[686.7,155.3,16.7,8.5],"RELEVPITOT":[590.6,101.2,16.7,8.5],"RTEMP":[590.6,119.9,16.7,8.5],"SOURCEL":[390.9,317.9,16.7,8.5],"SOURCER":[455.3,317.9,16.7,8.5],"sparL":[296.4,280.4,16.7,8.5],"sparR":[355.8,280.4,16.7,8.5],"SPDTRIM":[349.4,128.2,16.7,8.5],"STBYHYDPRESS":[353.0,73.4,16.7,8.5],"STBYHYDQTY":[353.0,64.1,16.7,8.5],"STBYpwr":[422.9,206.4,16.7,8.5],"STBYRUDL":[298.7,93.5,16.7,8.5],"STBYRUDON":[353.0,54.6,16.7,8.5],"STBYRUDR":[316.2,93.5,16.7,8.5],"TR":[415.1,123.3,16.7,8.5],"TRANSL":[390.9,308.8,16.7,8.5],"TRANSR":[455.3,308.8,16.7,8.5],"valveopen":[325.2,310.7,16.7,8.5],"WBOVHTL":[639.7,237.1,16.7,8.5],"WBOVHTR":[679.5,237.1,16.7,8.5],"WINGLvalve":[532.8,152.0,16.7,8.5],"WINGRvalve":[550.0,152.0,16.7,8.5],"WINHEATLF":[551.3,60.9,16.7,8.5],"WINHEATLS":[534.2,60.9,16.7,8.5],"WINHEATRF":[573.6,60.9,16.7,8.5],"WINHEATRS":[590.7,60.9,16.7,8.5],"WINOVHTLF":[551.3,51.8,16.7,8.5],"WINOVHTLS":[534.2,51.8,16.7,8.5],"WINOVHTRF":[573.6,51.8,16.7,8.5],"WINOVHTRS":[590.7,51.8,16.7,8.5],"YAWDAMP":[307.4,146.7,16.7,8.5],"ZONETEMPC":[659.4,114.6,16.7,8.5],"ZONETEMPL":[633.0,114.6,16.7,8.5],"ZONETEMPR":[685.7,114.6,16.7,8.5]};
const clamp=(x,a,b)=>x<a?a:x>b?b:x, w360=a=>{ a%=360; return a<0?a+360:a; };
const KT=0.514444, FT=0.3048, FPM=0.00508, NM=1852, D2R=Math.PI/180;
const DSP7=window.B737DISP, CDU=window.B737CDU;
/* 737 flap detents and how they map on the shared aerodynamics (slat/flap configurations of the model) */
const FLAPS=[0,1,2,5,10,15,25,30,40], FLAPCONF=[0,1,1,1,2,2,3,4,4], FLAPLIM=[null,250,250,250,210,200,190,175,162];
const B={}; // 737-only switch positions
function bReset(cold){ Object.assign(B,{flap:0,startSw:[1,1],lever:[cold?0:1,cold?0:1],apu:0,probe:[cold?0:1,cold?0:1],wh:cold?[0,0,0,0]:[1,1,1,1],yaw:cold?0:1,stby:2,landF:[0,0],landR:[0,0],logo:0,pos:cold?1:2,belts:cold?0:2,smk:cold?0:2,
  ab:1,mins:200,minsRA:false,ign:1,recirc:[1,1],fltA:2,fltB:2,spA:1,spB:1,crs:[360,360],toga:false,ovr:0,tlaAT:null,trimT:0,recallT:0,fltAlt:10000,landAlt:0,apuT:0,xpdr:2,wiper:[0,0],cabAlt:0});
  UIb(); }
let X=null, UI=null;
function UIb(){ if(!UI) return; UI.efis={mode:2,range:2,qnh:1013,std:false,adf1:1,adf2:1,filt:{wpt:false,sta:false,arpt:false,data:false,pos:false},ctr:false}; UI.efis2=Object.assign({},UI.efis,{filt:Object.assign({},UI.efis.filt)}); }
const RANGES=[5,10,20,40,80,160,320,640], NDM=['APP','VOR','MAP','PLN'];
/* ---------------- thrust: the autothrottle moves the levers (as the 737's A/T servos do) ---------------- */
function n1ToLever(M,n1){ let lo=0, hi=45; for(let k=0;k<18;k++){ const m=(lo+hi)/2; if(X.F.leverN1(M,m)<n1) lo=m; else hi=m; } return (lo+hi)/2; }
function tla(){ const M=X.M, ap=M.ap, U=UI;
  if(U.tla[0]<0||U.tla[1]<0){ if(ap.athr){ ap.athr=false; ap.athrArm=false; } B.toga=false; return [U.tla[0],U.tla[1]]; } // reverse thrust: the pilot
  const pilot=B.tlaAT!=null&&(Math.abs(U.tla[0]-B.tlaAT[0])>0.4||Math.abs(U.tla[1]-B.tlaAT[1])>0.4);
  if(pilot) B.ovr=1.5; // the pilot moved the levers: manual override while held, the A/T takes them back after
  if(B.toga&&M.gnd&&(ap.athrArm||ap.athr)){ B.tlaAT=null; return [45,45]; }
  if(B.toga&&!M.gnd){ if(ap.lvrClb||M.ra/FT>(ap.thrRed||1500)){ B.toga=false; } else { B.tlaAT=null; return [45,45]; } }
  if((ap.athr||ap.athrArm&&!M.gnd)&&B.ovr<=0){ return [25,25]; }
  B.tlaAT=null; return [U.tla[0],U.tla[1]]; }
function leverFollow(dt){ const M=X.M, ap=M.ap, U=UI; if(B.ovr>0){ B.ovr-=dt; B.tlaAT=null; return; }
  if(((ap.athr||ap.athrArm)&&!(U.tla[0]<0))||B.toga){ const e=X.A.eng; const t=[0,1].map(i=>{ const n=e[i].run?Math.max(e[i].n1,M.n1Cmd[i]*0.15+e[i].n1*0.85):0; return clamp(n1ToLever(M,n),0,45); });
    U.tla=[U.tla[0]+(t[0]-U.tla[0])*Math.min(1,dt*3),U.tla[1]+(t[1]-U.tla[1])*Math.min(1,dt*3)]; B.tlaAT=[U.tla[0],U.tla[1]]; } }
/* ---------------- Boeing FMA from the shared autopilot state ---------------- */
const FMA_T={}, FMA_P={};
function fmaOf(){ const M=X.M, a=M.ap, K=X.K, ra=M.ra/FT, onG=M.gnd, F_={};
  // autothrottle
  let at='';
  if(a.athr||a.athrArm||B.toga){ const t=a.thr;
    if(onG&&(B.toga||a.toga)) at=M.ias>84&&a.vert==='SRS'?'THR HLD':'N1';
    else if(t==='THR CLB'||B.toga||t==='MAN TOGA'||t==='MAN FLX'||t==='MAN MCT') at=a.vert==='SRS'&&!onG?'N1':'N1';
    else if(t==='THR IDLE') at=a.retard?'RETARD':(M.n1Act>X.A.eng[0].n1*0+24?'RETARD':'ARM');
    else if(t==='SPEED'||t==='MACH') at=(a.vert==='CLB'||a.vert==='DES'||a.vert.startsWith('ALT CST'))&&!a.spd.man?'FMC SPD':'MCP SPD';
    else if(t==='THR LVR') at='ARM';
    else if(a.athrArm) at='ARM';
    if(!a.athr&&!B.toga&&!(onG&&a.toga)) at='ARM'; }
  if(B.ovr>0&&a.athr) at='ARM';
  // roll
  let roll='', rollA='';
  switch(a.lat){ case 'HDG': case 'TRK': roll='HDG SEL'; break; case 'NAV': roll='LNAV'; break; case 'LOC*': case 'LOC': case 'LAND': case 'FLARE': roll='VOR/LOC'; break;
    case 'RWY': case 'RWY TRK': roll=onG?'':'TO/GA'; break; case 'GA TRK': roll='TO/GA'; break; case 'ROLL OUT': roll='ROLLOUT'; break; }
  if(a.lat==='HDG'&&a.hdgHold) roll='HDG HOLD';
  if(onG&&a.vert==='SRS') roll='TO/GA';
  if(a.latArm==='NAV') rollA='LNAV'; if(a.latArm==='LOC') rollA='VOR/LOC';
  if(a.lat==='LAND'&&ra<1500&&(a.ap1&&a.ap2)) rollA='ROLLOUT';
  // pitch
  let pitch='', pitchA='';
  switch(a.vert){ case 'SRS': pitch='TO/GA'; break; case 'OP CLB': case 'OP DES': case 'EXPED CLB': case 'EXPED DES': pitch='MCP SPD'; break;
    case 'CLB': pitch='VNAV SPD'; break; case 'DES': pitch=a.desSpd?'VNAV PTH':'VNAV SPD'; break; case 'ALT CST*': case 'ALT CST': pitch='VNAV PTH'; break;
    case 'ALT*': pitch=a.vnavHold?'VNAV PTH':'ALT ACQ'; break; case 'ALT': pitch=a.vnavHold?'VNAV PTH':'ALT HOLD'; break; case 'V/S': case 'FPA': pitch='V/S'; break;
    case 'G/S*': case 'G/S': case 'LAND': pitch='G/S'; break; case 'FLARE': pitch='FLARE'; break; case 'ROLL OUT': pitch=''; break; }
  if(a.vert==='V/S'&&a.vs.dash) pitch='';
  if(a.vertArm.includes('G/S')) pitchA='G/S'; else if(a.vnavArm) pitchA='VNAV';
  if((a.vert==='G/S'||a.vert==='LAND')&&ra<1500&&(a.ap1&&a.ap2)) pitchA='FLARE';
  if(onG&&!a.vert&&(a.fd1||a.fd2)){ pitch=''; roll=''; }
  F_.at=at; F_.roll=roll; F_.rollArm=rollA; F_.pitch=pitch; F_.pitchArm=pitchA;
  const t=X.UI.t; const chg=(k,v)=>{ if(FMA_P[k]!==v){ FMA_P[k]=v; FMA_T[k]=t; } return v&&t-FMA_T[k]<10; };
  F_.atBox=chg('at',at); F_.rollBox=chg('roll',roll); F_.pitchBox=chg('pitch',pitch);
  if(B.ovr>0) F_.atC='#ffb21a';
  return F_; }
function afds(){ const a=X.M.ap; const ra=X.M.ra/FT;
  if(a.ap1&&a.ap2&&a.appr) return ra<1500&&(a.vert==='G/S'||a.vert==='LAND'||a.vert==='FLARE')?'LAND 3':'CMD';
  if(a.ap1||a.ap2) return a.appr&&ra<1500&&(a.vert==='G/S'||a.vert==='LAND')?'SINGLE CH':'CMD';
  if(a.fd1||a.fd2) return 'FD'; return ''; }
/* ---------------- controls ---------------- */
function defs(x){
  const S_=k=>X.A.sw[k], A=()=>X.A, M=()=>X.M, ap=()=>X.M.ap, F=X.F, CT=X.CT;
  const sw=(id,get,set,vals,lab,o)=>X.tog(id,null,vals||[1,0],Object.assign({get,set,lab:lab||['ON','OFF']},o||{}));
  const swk=(id,k,lab,o)=>sw(id,()=>S_(k)?1:0,v=>{ X.A.sw[k]=v; },[1,0],lab,o);
  const light=(name,txt,col,fn,o)=>{ const r=LT[name]; if(!r) return; X.ann('LT|'+name,null,[txt,col,fn],Object.assign({cls:'big bl',rect:r},o||{})); };
  const pw=()=>X.A.dc;
  // ---- ELEC ----
  sw('ELEC|BAT',()=>S_('bat1')?1:0,v=>{ X.A.sw.bat1=X.A.sw.bat2=v; },[1,0],['ON','OFF'],{guard:true});
  sw('ELEC|STANDBY POWER',()=>B.stby,v=>{ B.stby=v; },[0,1,2],['BAT','OFF','AUTO'],{horiz:true,guard:true});
  sw('ELEC|GRD PWR',()=>S_('ext')?1:0,v=>{ X.A.sw.ext=v&&X.A.gpu?1:0; if(v&&!X.A.gpu) X.say('No ground power'); },[1,0],['ON','OFF']);
  swk('ELEC|GEN 1','gen1'); swk('ELEC|GEN 2','gen2');
  sw('ELEC|APU GEN L',()=>S_('apuGen')?1:0,v=>{ X.A.sw.apuGen=v; }); sw('ELEC|APU GEN R',()=>S_('apuGen')?1:0,v=>{ X.A.sw.apuGen=v; });
  sw('ELEC|BUS TRANSFER',()=>S_('busTie')?1:0,v=>{ X.A.sw.busTie=v; },[0,1],['OFF','AUTO'],{horiz:true,guard:true});
  sw('ELEC|DRIVE DISCONNECT 1',()=>S_('idg1')?1:0,v=>{ X.A.sw.idg1=v; },[1,0],['DISCONNECT','NORMAL'],{guard:true});
  sw('ELEC|DRIVE DISCONNECT 2',()=>S_('idg2')?1:0,v=>{ X.A.sw.idg2=v; },[1,0],['DISCONNECT','NORMAL'],{guard:true});
  swk('ELEC|CAB/UTIL','galy');
  light('BATDISCHARGE','BAT\nDISCHARGE','a',()=>X.A.dc&&!X.A.ac&&X.A.sw.bat1); light('TR','TR UNIT','a',()=>false); light('ELEC','ELEC','a',()=>false);
  light('DRIVEL','DRIVE','a',()=>pw()&&!X.A.eng[0].run); light('DRIVER','DRIVE','a',()=>pw()&&!X.A.eng[1].run);
  light('STBYpwr','STANDBY\nPWR OFF','a',()=>B.stby===1&&pw());
  light('GRDpw','GRD POWER\nAVAILABLE','b',()=>X.A.gpu&&pw());
  light('TRANSL','TRANSFER\nBUS OFF','a',()=>pw()&&!X.A.bus.ac1); light('TRANSR','TRANSFER\nBUS OFF','a',()=>pw()&&!X.A.bus.ac2);
  light('SOURCEL','SOURCE\nOFF','a',()=>pw()&&!X.A.bus.ac1); light('SOURCER','SOURCE\nOFF','a',()=>pw()&&!X.A.bus.ac2);
  light('GENOFFL','GEN OFF\nBUS','b',()=>pw()&&X.A.src.ac1!=='GEN 1'); light('GENOFFR','GEN OFF\nBUS','b',()=>pw()&&X.A.src.ac2!=='GEN 2');
  light('APUbus','APU GEN\nOFF BUS','b',()=>pw()&&X.A.apu.avail&&X.A.src.ac1!=='APU GEN'&&X.A.src.ac2!=='APU GEN');
  // ---- HYDRAULICS (A ↔ green, B ↔ yellow) ----
  swk('HYDRAULICS|ENG 1 HYD','hyE1'); swk('HYDRAULICS|ENG 2 HYD','hyE2'); swk('HYDRAULICS|ELEC 1 HYD','hyY'); swk('HYDRAULICS|ELEC 2 HYD','ptu');
  light('HYDAeng1lopress','LOW\nPRESSURE','a',()=>pw()&&!(S_('hyE1')&&X.A.eng[0].run)); light('HYDAelec2lopress','LOW\nPRESSURE','a',()=>pw()&&!(S_('ptu')&&X.A.ac));
  light('HYDBeng2lopress','LOW\nPRESSURE','a',()=>pw()&&!(S_('hyE2')&&X.A.eng[1].run)); light('HYDBelec1lopress','LOW\nPRESSURE','a',()=>pw()&&!(S_('hyY')&&X.A.ac));
  // ---- FUEL ----
  swk('FUEL|AFT PUMP 1','fL1'); swk('FUEL|FWD PUMP 1','fL2'); swk('FUEL|FWD PUMP 2','fR1'); swk('FUEL|AFT PUMP 2','fR2'); swk('FUEL|CTR PUMP L','fC1'); swk('FUEL|CTR PUMP R','fC2');
  X.sel('FUEL|CROSSFEED','fX',['CLOSED','OPEN'],[-45,45]);
  const lp=(k,bus)=>()=>pw()&&!(S_(k)&&X.A.bus[bus]);
  light('LOPRESSL1','LOW\nPRESSURE','a',lp('fL1','ac1')); light('LOPRESSL2','LOW\nPRESSURE','a',lp('fL2','ac1')); light('LOPRESSR1','LOW\nPRESSURE','a',lp('fR1','ac2')); light('LOPRESSR2','LOW\nPRESSURE','a',lp('fR2','ac2'));
  light('LOPRESSC1','LOW\nPRESSURE','a',()=>pw()&&S_('fC1')&&(!X.A.bus.ac1||X.A.fuel.c<50)); light('LOPRESSC2','LOW\nPRESSURE','a',()=>pw()&&S_('fC2')&&(!X.A.bus.ac2||X.A.fuel.c<50));
  light('valveopen','VALVE\nOPEN','b',()=>pw()&&S_('fX')); light('filterbypassL','FILTER\nBYPASS','a',()=>false); light('filterbypassR','FILTER\nBYPASS','a',()=>false);
  light('engL','ENG VALVE\nCLOSED','b',()=>pw()&&!B.lever[0]); light('engR','ENG VALVE\nCLOSED','b',()=>pw()&&!B.lever[1]);
  light('sparL','SPAR VALVE\nCLOSED','b',()=>pw()&&!B.lever[0]); light('sparR','SPAR VALVE\nCLOSED','b',()=>pw()&&!B.lever[1]);
  // ---- BLEED / AIR CONDITIONING ----
  swk('BLEED|ENG 1 BLEED','eb1'); swk('BLEED|ENG 2 BLEED','eb2'); swk('BLEED|APU BLEED','apuBl');
  sw('BLEED|L PACK',()=>S_('pk1')?(S_('pkFlow')===2?2:1):0,v=>{ X.A.sw.pk1=v?1:0; if(v===2) X.A.sw.pkFlow=2; else if(X.A.sw.pkFlow===2&&!(X.A.sw.pk2&&B.pkHigh2)) X.A.sw.pkFlow=1; B.pkHigh1=v===2; },[2,1,0],['HIGH','AUTO','OFF']);
  sw('BLEED|R PACK',()=>S_('pk2')?(B.pkHigh2?2:1):0,v=>{ X.A.sw.pk2=v?1:0; B.pkHigh2=v===2; if(v===2) X.A.sw.pkFlow=2; },[2,1,0],['HIGH','AUTO','OFF']);
  sw('BLEED|ISOLATION VALVE',()=>S_('xb'),v=>{ X.A.sw.xb=v; },[0,1,2],['CLOSE','AUTO','OPEN'],{horiz:true});
  sw('BLEED|L RECIRC FAN',()=>B.recirc[0],v=>{ B.recirc[0]=v; },[1,0],['AUTO','OFF']); sw('BLEED|R RECIRC FAN',()=>B.recirc[1],v=>{ B.recirc[1]=v; },[1,0],['AUTO','OFF']);
  X.act('BLEED|TRIP RESET',()=>{ X.A.fail.bleed1=X.A.fail.bleed2=false; X.A.fail.pack1=X.A.fail.pack2=false; X.say('Trip reset'); });
  light('PACKL','PACK','a',()=>pw()&&S_('pk1')&&X.A.fail.pack1); light('PACKR','PACK','a',()=>pw()&&S_('pk2')&&X.A.fail.pack2);
  light('BLEEDTRIPL','BLEED\nTRIP OFF','a',()=>pw()&&X.A.fail.bleed1&&X.A.eng[0].run); light('BLEEDTRIPR','BLEED\nTRIP OFF','a',()=>pw()&&X.A.fail.bleed2&&X.A.eng[1].run);
  light('WBOVHTL','WING-BODY\nOVERHEAT','a',()=>false); light('WBOVHTR','WING-BODY\nOVERHEAT','a',()=>false);
  light('DUALBLEED','DUAL\nBLEED','a',()=>pw()&&S_('apuBl')&&X.A.apu.n>90&&((S_('eb1')&&X.A.eng[0].run)||(S_('eb2')&&X.A.eng[1].run&&S_('xb')===2)));
  light('RAMDOOROPENL','RAM DOOR\nFULL OPEN','b',()=>pw()&&S_('pk1')&&(X.M.gnd||X.M.flap>0.5)); light('RAMDOOROPENR','RAM DOOR\nFULL OPEN','b',()=>pw()&&S_('pk2')&&(X.M.gnd||X.M.flap>0.5));
  // ---- APU ----
  CT.push({id:'APU|APU SWITCH',t:'selF',get:()=>B.apu,set:v=>{ B.apu=v; X.A.sw.apuM=v>0?1:0; if(v===2){ X.A.sw.apuS=1; B.apuT=1.2; } },pos:['OFF','ON','START'],ang:[-45,0,45]});
  light('lowoilpressapu','LOW OIL\nPRESSURE','a',()=>pw()&&X.A.sw.apuM&&X.A.apu.n<95); light('fault','FAULT','a',()=>pw()&&X.A.apu.fault); light('overspeed','OVER\nSPEED','a',()=>false); light('MAINTapu','MAINT','b',()=>false);
  // ---- ENGINE START ----
  for(const [i,s] of [[0,'L'],[1,'R']]) CT.push({id:'ENGINE START|ENG START '+s,t:'selF',get:()=>B.startSw[i],set:v=>{ B.startSw[i]=v; },pos:['GRD','OFF','CONT','FLT'],ang:[-70,-20,25,70]});
  sw('ENGINE START|IGNITION SELECT',()=>B.ign,v=>{ B.ign=v; },[0,1,2],['IGN L','BOTH','IGN R'],{horiz:true});
  // ---- ANTI ICE, WINDOW / PROBE HEAT ----
  swk('ANTI ICE|WING ANTI ICE','wai'); swk('ANTI ICE|ENG ANTI ICE 1','eai1'); swk('ANTI ICE|ENG ANTI ICE 2','eai2');
  light('WINGLvalve','L VALVE\nOPEN','b',()=>pw()&&S_('wai')); light('WINGRvalve','R VALVE\nOPEN','b',()=>pw()&&S_('wai'));
  light('ENGLcowl','COWL VALVE\nOPEN','b',()=>pw()&&S_('eai1')); light('ENGRcowl','COWL VALVE\nOPEN','b',()=>pw()&&S_('eai2'));
  light('COWLICEL','COWL\nANTI-ICE','a',()=>false); light('COWLICER','COWL\nANTI-ICE','a',()=>false);
  [['WINDOW HEAT L SIDE','WINHEATLS'],['WINDOW HEAT L FWD','WINHEATLF'],['WINDOW HEAT R FWD','WINHEATRF'],['WINDOW HEAT R SIDE','WINHEATRS']].forEach(([id,lt],i)=>{ sw('WINDOW / PROBE HEAT|'+id,()=>B.wh[i],v=>{ B.wh[i]=v; }); light(lt,'ON','g',()=>B.wh[i]&&X.A.ac); });
  sw('WINDOW / PROBE HEAT|PROBE HEAT A',()=>B.probe[0],v=>{ B.probe[0]=v; X.A.sw.probe=B.probe[0]&&B.probe[1]?1:0; }); sw('WINDOW / PROBE HEAT|PROBE HEAT B',()=>B.probe[1],v=>{ B.probe[1]=v; X.A.sw.probe=B.probe[0]&&B.probe[1]?1:0; });
  for(const [n,t] of [['CAPTPITOT','CAPT\nPITOT'],['LELEVPITOT','L ELEV\nPITOT'],['LALPHA','L ALPHA\nVANE'],['LTEMP','TEMP\nPROBE']]) light(n,t,'a',()=>pw()&&!(B.probe[0]&&X.A.ac));
  for(const [n,t] of [['FOPITOT','F/O\nPITOT'],['RELEVPITOT','R ELEV\nPITOT'],['RALPHA','R ALPHA\nVANE'],['RTEMP','AUX\nPITOT']]) light(n,t,'a',()=>pw()&&!(B.probe[1]&&X.A.ac));
  // ---- FLIGHT CONTROLS ----
  sw('FLT CONTROL|FLT CONTROL A',()=>B.fltA,v=>{ B.fltA=v; },[0,1,2],['STBY RUD','OFF','ON'],{guard:true}); sw('FLT CONTROL|FLT CONTROL B',()=>B.fltB,v=>{ B.fltB=v; },[0,1,2],['STBY RUD','OFF','ON'],{guard:true});
  sw('FLT CONTROL|SPOILER A',()=>B.spA,v=>{ B.spA=v; },[1,0],['ON','OFF'],{guard:true}); sw('FLT CONTROL|SPOILER B',()=>B.spB,v=>{ B.spB=v; },[1,0],['ON','OFF'],{guard:true});
  sw('FLT CONTROL|YAW DAMPER',()=>B.yaw,v=>{ B.yaw=v; }); light('YAWDAMP','YAW\nDAMPER','a',()=>pw()&&!(B.yaw&&X.A.bus.ac1));
  for(const n of ['STBYRUDON','STBYHYDQTY','STBYHYDPRESS','STBYRUDL','STBYRUDR','SPDTRIM','MACHTRIM','AUTOSLATFAIL','DIFFPRESS']) light(n,'','a',()=>false);
  light('LOWQTY','','a',()=>false);
  // ---- EXT / CABIN LIGHTS, SIGNS ----
  sw('EXT LIGHTS|LANDING RETRACT L',()=>S_('landL'),v=>{ X.A.sw.landL=v; },[2,1,0],['ON','EXT','RETRACT']); sw('EXT LIGHTS|LANDING RETRACT R',()=>S_('landR'),v=>{ X.A.sw.landR=v; },[2,1,0],['ON','EXT','RETRACT']);
  sw('EXT LIGHTS|LANDING FIXED L',()=>B.landF[0],v=>{ B.landF[0]=v; }); sw('EXT LIGHTS|LANDING FIXED R',()=>B.landF[1],v=>{ B.landF[1]=v; });
  sw('EXT LIGHTS|RUNWAY TURNOFF L',()=>S_('rto'),v=>{ X.A.sw.rto=v; }); sw('EXT LIGHTS|RUNWAY TURNOFF R',()=>S_('rto'),v=>{ X.A.sw.rto=v; });
  sw('EXT LIGHTS|TAXI',()=>S_('nose')?1:0,v=>{ X.A.sw.nose=v?1:0; });
  sw('EXT LIGHTS|LOGO',()=>B.logo,v=>{ B.logo=v; }); sw('EXT LIGHTS|POSITION',()=>B.pos,v=>{ B.pos=v; X.A.sw.strobe=v===2?2:0; X.A.sw.navLogo=v?1:0; },[2,1,0],['STROBE & STEADY','OFF','STEADY']);
  sw('EXT LIGHTS|ANTI COLLISION',()=>S_('beacon'),v=>{ X.A.sw.beacon=v; }); sw('EXT LIGHTS|WING',()=>S_('wing')?1:0,v=>{ X.A.sw.wing=v; }); sw('EXT LIGHTS|WHEEL WELL',()=>B.ww||0,v=>{ B.ww=v; });
  sw('CABIN|NO SMOKING',()=>B.smk,v=>{ B.smk=v; X.A.sw.noSmk=v; },[2,1,0],['ON','AUTO','OFF']); sw('CABIN|FASTEN BELTS',()=>B.belts,v=>{ B.belts=v; X.A.sw.seatB=v?2:0; },[2,1,0],['ON','AUTO','OFF']);
  sw('CABIN|EMER EXIT LIGHTS',()=>S_('emerExit'),v=>{ X.A.sw.emerExit=v; },[2,1,0],['ON','ARMED','OFF'],{guard:true}); light('NOTARMED','NOT\nARMED','a',()=>pw()&&S_('emerExit')!==1);
  // ---- PRESSURIZATION ----
  CT.push({id:'PRESSURIZATION|FLT ALT',t:'knob',turn:d=>{ B.fltAlt=clamp(B.fltAlt+d*500,0,42000); },push:()=>{},pull:()=>{},tip:()=>'FLT ALT '+B.fltAlt});
  CT.push({id:'PRESSURIZATION|LAND ALT',t:'knob',turn:d=>{ B.landAlt=clamp(B.landAlt+d*50,-1000,14000); },push:()=>{},pull:()=>{},tip:()=>'LAND ALT '+B.landAlt});
  CT.push({id:'PRESSURIZATION|FLT ALT DISPLAY',t:'seg',txt:()=>X.A.ac?String(B.fltAlt).padStart(5,' '):''}); CT.push({id:'PRESSURIZATION|LAND ALT DISPLAY',t:'seg',txt:()=>X.A.ac?String(B.landAlt).padStart(5,' '):''});
  CT.push({id:'PRESSURIZATION|PRESS MODE SEL',t:'selF',get:()=>B.pmode||0,set:v=>{ B.pmode=v; X.A.sw.pressMode=v===0?1:0; },pos:['AUTO','ALTN','MAN'],ang:[-40,0,40]});
  light('AUTOFAIL','AUTO\nFAIL','a',()=>false); light('OFFSCHEDDESC','OFF SCHED\nDESCENT','a',()=>false); light('ALTNpack','ALTN','g',()=>pw()&&B.pmode===1); light('MANUALpack','MANUAL','g',()=>pw()&&B.pmode===2);
  // ---- AIR TEMP, WIPERS ----
  for(const [id,k] of [['AIR TEMP|CONT CAB TEMP','tCk'],['AIR TEMP|FWD CAB TEMP','tFwd'],['AIR TEMP|AFT CAB TEMP','tAft']]) CT.push({id,t:'cont',k,lo:0,hi:1,step:0.1,ang:v=>-135+v*270});
  for(const [i,s] of [[0,'L'],[1,'R']]) CT.push({id:'WIPERS|WIPER '+s,t:'selF',get:()=>B.wiper[i],set:v=>{ B.wiper[i]=v; },pos:['PARK','INT','LOW','HIGH'],ang:[-60,-20,20,60]});
  // ---- glareshield: fire warning, master caution, six-pack, autoflight disconnect lights ----
  for(const s of ['CPT','F/O']){
    X.ann('GLARESHIELD '+s+'|FIRE WARN '+s,null,['FIRE\nWARN','r',()=>X.A.ecam.mw&&anyFire()],{cls:'big bl bx',click:()=>{ X.Y.master(X.A,3); }});
    X.ann('GLARESHIELD '+s+'|MASTER CAUTION '+s,null,['MASTER\nCAUTION','a',()=>X.A.ecam.mc],{cls:'big bl bx',click:()=>{ X.Y.master(X.A,2); UI.athrOffT=0; }});
    const r=X.RECT['GLARESHIELD '+s+'|SYSTEM ANNUNCIATOR '+s]; if(r){ const [,x,y,w,h]=r, cw=w/2, rh=h/3;
      const L6=s==='CPT'?[['FLT CONT','IRS'],['FUEL','ELEC'],['APU','OVHT/DET']]:[['ANTI-ICE','HYD'],['DOORS','ENG'],['OVERHEAD','AIR COND']];
      L6.forEach((row,ri)=>row.forEach((t,ci)=>X.ann('GLARESHIELD '+s+'|'+t,null,[t,'a',()=>sixLit(t)],{cls:'big bl six',rect:[x+ci*cw,y+ri*rh,cw,rh],click:()=>{ B.recallT=3; X.say('Recall'); }}))); } }
  { const r=X.RECT['CPT PANEL|AFDS RESET CPT']; if(r){ const x=r[1]+1, y=r[2]+4, w=12.2, h=12.4; [['A/P',()=>UI.apOffT>0&&UI.t%0.6<0.4,'r'],['A/T',()=>UI.athrOffT>0&&UI.t%0.6<0.4,'r'],['FMC',()=>!!X.K.msg,'a']].forEach(([t,f,c],i)=>X.ann('AFDS|'+t+' P/RST CPT',null,[t+'\nP/RST',c,f],{cls:'big bl',rect:[x+i*(w+1.2),y,w,h],click:()=>{ if(i===0) UI.apOffT=0; if(i===1) UI.athrOffT=0; if(i===2) X.K.msg=''; }})); } }
  { const r=X.RECT['F/O PANEL|AFDS RESET F/O']; if(r){ const x=r[1]+r[3]-38.5, y=r[2]+4, w=12.2, h=12.4; [['A/P',()=>UI.apOffT>0&&UI.t%0.6<0.4,'r'],['A/T',()=>UI.athrOffT>0&&UI.t%0.6<0.4,'r'],['FMC',()=>!!X.K.msg,'a']].forEach(([t,f,c],i)=>X.ann('AFDS|'+t+' P/RST F/O',null,[t+'\nP/RST',c,f],{cls:'big bl',rect:[x+i*(w+1.2),y,w,h],click:()=>{ if(i===0) UI.apOffT=0; if(i===1) UI.athrOffT=0; if(i===2) X.K.msg=''; }})); } }
  // ---- MCP ----
  const mcpBtn=(id,lit,on)=>X.bar('MCP|'+id,lit,()=>{ on(); X.dirty.all=true; });
  sw('MCP|A/T ARM',()=>ap().athr||ap().athrArm?1:0,v=>{ const a=ap(); if(v){ a.athrArm=true; } else { if(a.athr||a.athrArm){ a.athr=false; a.athrArm=false; X.M.events.push('athrdisc'); } B.toga=false; } },[1,0],['ARM','OFF']);
  sw('MCP|F/D CPT',()=>ap().fd1?1:0,()=>{ F.fcu(X.M,'fd1'); },[1,0],['ON','OFF']); sw('MCP|F/D F/O',()=>ap().fd2?1:0,()=>{ F.fcu(X.M,'fd2'); },[1,0],['ON','OFF']);
  mcpBtn('N1',()=>ap().athr&&(ap().thr==='THR CLB'),()=>{ const a=ap(); if(!a.athrArm&&!a.athr){ X.say('A/T not armed'); return; } a.athr=true; a.athrArm=false; if(!['OP CLB','CLB','SRS'].includes(a.vert)) X.say('N1: thrust to the climb limit'); });
  mcpBtn('SPEED',()=>ap().athr&&(ap().thr==='SPEED'||ap().thr==='MACH')&&ap().spd.man,()=>{ const a=ap(); if(!a.athrArm&&!a.athr){ X.say('A/T not armed'); return; } a.athr=true; a.athrArm=false; if(!a.spd.man){ a.spd.man=true; a.spd.v=Math.round(a.tgtSpd||X.M.ias); } if(['OP CLB','OP DES','CLB','DES','SRS'].includes(a.vert)){ a.vert='V/S'; a.vs.v=Math.round(X.M.vs/FPM/100)*100; } });
  mcpBtn('LVL CHG',()=>ap().vert==='OP CLB'||ap().vert==='OP DES',()=>{ const a=ap(); if(X.M.gnd) return; a.spd.man=true; if(!a.spd.v||a.spd.v<100) a.spd.v=Math.round(X.M.ias); if(Math.abs(a.alt.v-X.M.h/FT)>250){ F.fcu(X.M,'altPull'); if(a.athrArm) { a.athr=true; a.athrArm=false; } } else X.say('LVL CHG: set a new MCP altitude first'); });
  mcpBtn('VNAV',()=>['CLB','DES','ALT CST*','ALT CST'].includes(ap().vert)||ap().vnavArm,()=>{ const a=ap(); if(X.M.gnd){ a.vnavArm=!a.vnavArm; return; } if(!X.K.active){ X.say('VNAV: no active route'); return; } if(a.lat!=='NAV'){ X.say('VNAV needs LNAV here'); } a.spd.man=false; if(Math.abs(a.alt.v-X.M.h/FT)>250||a.vert==='ALT CST'){ const v=X.M.ap.lat==='NAV'; a.vert=a.alt.v>X.M.h/FT?(v?'CLB':'OP CLB'):(v?'DES':'OP DES'); a.cstClimb=a.alt.v>X.M.h/FT; } a.vnavHold=Math.abs(a.alt.v-X.M.h/FT)<=250; if(a.vnavHold){ a.vert='ALT'; a.altHold=Math.round(X.M.h/FT); } if(a.athrArm){ a.athr=true; a.athrArm=false; } });
  mcpBtn('HDG SEL',()=>ap().lat==='HDG'||ap().lat==='TRK',()=>{ F.fcu(X.M,'hdgPull'); ap().hdgHold=false; if(!ap().vert&&!X.M.gnd){ ap().vert='V/S'; } });
  mcpBtn('LNAV',()=>ap().lat==='NAV'||ap().latArm==='NAV',()=>{ if(!X.K.active){ X.say('LNAV: no active route'); return; } if(ap().lat==='NAV'){ return; } F.fcu(X.M,'hdgPush'); });
  mcpBtn('VOR LOC',()=>ap().loc,()=>F.fcu(X.M,'loc'));
  mcpBtn('APP',()=>ap().appr,()=>F.fcu(X.M,'appr'));
  mcpBtn('ALT HLD',()=>ap().vert==='ALT'&&!ap().vnavHold,()=>{ const a=ap(); if(X.M.gnd) return; a.vert='ALT'; a.altHold=Math.round(X.M.h/FT/10)*10; a.vnavHold=false; a.vertArm=a.vertArm.replace('G/S','').trim(); a.appr=false; });
  mcpBtn('V/S',()=>ap().vert==='V/S',()=>{ const a=ap(); if(X.M.gnd) return; a.vert='V/S'; a.vs.dash=false; a.vs.v=Math.round(X.M.vs/FPM/100)*100; if(a.athr&&a.spd.man===false){ a.spd.man=true; a.spd.v=Math.round(X.M.ias); } });
  const cmd=k=>()=>{ const a=ap(); if(a[k]){ F.fcu(X.M,'instDisc'); return; } if(X.M.gnd){ X.say('A/P: not on the ground'); return; } const r=F.fcu(X.M,k); if(r) X.say(r); if(!a.lat){ a.lat='HDG'; a.hdg.v=Math.round(w360(X.M.psi/D2R)); a.hdgHold=true; } };
  mcpBtn('CMD A',()=>ap().ap1,cmd('ap1')); mcpBtn('CMD B',()=>ap().ap2,cmd('ap2'));
  mcpBtn('CWS A',()=>false,()=>X.say('CWS is not modelled: use CMD or fly by hand')); mcpBtn('CWS B',()=>false,()=>X.say('CWS is not modelled: use CMD or fly by hand'));
  X.act('MCP|A/P DISENGAGE',()=>{ F.fcu(X.M,'instDisc'); });
  X.act('MCP|C/O',()=>F.fcu(X.M,'spdMach'));
  CT.push({id:'MCP|IAS/MACH',t:'knob',turn:d=>{ const a=ap(); if(!a.spd.man){ X.say('Speed: FMC (VNAV). Push the knob for speed intervention'); return; } F.fcu(X.M,'spdTurn',d); },pull:()=>{},push:()=>{ const a=ap(); if(['CLB','DES','ALT CST','ALT CST*'].includes(a.vert)){ a.spd.man=!a.spd.man; if(a.spd.man) a.spd.v=Math.round(a.tgtSpd||X.M.ias); } },tip:()=>'IAS/MACH: turn to set, push for speed intervention in VNAV'});
  CT.push({id:'MCP|HEADING',t:'knob',turn:d=>F.fcu(X.M,'hdgTurn',d),pull:()=>{},push:()=>{},tip:()=>'Heading: turn to set the bug (HDG SEL flies it)'});
  CT.push({id:'MCP|ALTITUDE',t:'knob',turn:d=>F.fcu(X.M,'altTurn',d),pull:()=>{},push:()=>{ const a=ap(); if(a.vert==='ALT CST') F.fcu(X.M,'altPush'); },tip:()=>'Altitude: turn to set (100 ft steps)'});
  CT.push({id:'MCP|VERT SPEED',t:'knob',turn:d=>{ if(ap().vert==='V/S') F.fcu(X.M,'vsTurn',-d); },pull:()=>{ if(ap().vert==='V/S') F.fcu(X.M,'vsTurn',1); },push:()=>{ if(ap().vert==='V/S') F.fcu(X.M,'vsTurn',-1); },tip:()=>'Vertical speed wheel (in V/S mode): top = up, bottom = down'});
  CT.push({id:'MCP|COURSE CPT',t:'knob',turn:d=>{ B.crs[0]=w360(B.crs[0]+d)||360; },pull:()=>{},push:()=>{},tip:()=>'Course '+String(B.crs[0]).padStart(3,'0')});
  CT.push({id:'MCP|COURSE F/O',t:'knob',turn:d=>{ B.crs[1]=w360(B.crs[1]+d)||360; },pull:()=>{},push:()=>{},tip:()=>'Course '+String(B.crs[1]).padStart(3,'0')});
  const mcpOn=()=>X.A.bus.dcEss||X.A.ac;
  CT.push({id:'MCP|COURSE CPT DISPLAY',t:'seg',txt:()=>mcpOn()?String(B.crs[0]).padStart(3,'0'):''}); CT.push({id:'MCP|COURSE F/O DISPLAY',t:'seg',txt:()=>mcpOn()?String(B.crs[1]).padStart(3,'0'):''});
  CT.push({id:'MCP|IAS/MACH DISPLAY',t:'seg',txt:()=>{ if(!mcpOn()) return ''; const a=ap(); if(!a.spd.man) return ''; return a.spd.mach?'.'+String(Math.round(a.spd.v*100)).padStart(2,'0'):String(Math.round(a.spd.v)); }});
  CT.push({id:'MCP|HEADING DISPLAY',t:'seg',txt:()=>mcpOn()?String(Math.round(ap().hdg.v)).padStart(3,'0'):''});
  CT.push({id:'MCP|ALTITUDE DISPLAY',t:'seg',txt:()=>mcpOn()?String(ap().alt.v).padStart(5,' '):''});
  CT.push({id:'MCP|VERT SPEED DISPLAY',t:'seg',txt:()=>{ if(!mcpOn()) return ''; const a=ap(); if(a.vert!=='V/S') return ''; return (a.vs.v>0?'+':a.vs.v<0?'-':' ')+String(Math.abs(a.vs.v)).padStart(4,' '); }});
  // ---- EFIS control panels ----
  for(const side of [0,1]){ const s=side?'F/O':'CPT', P='EFIS '+s+'|', E=()=>side?UI.efis2:UI.efis;
    CT.push({id:P+'ND MODE '+s,t:'selF',get:()=>E().mode,set:v=>{ E().mode=v; },pos:NDM,ang:[-45,-15,15,45]});
    CT.push({id:P+'ND RANGE '+s,t:'selF',get:()=>E().range,set:v=>{ E().range=v; },pos:RANGES.map(String),ang:[-70,-50,-30,-10,10,30,50,70]});
    CT.push({id:P+'BARO '+s,t:'knob',turn:d=>{ const e=E(); if(!e.std) e.qnh=clamp(e.qnh+d,940,1060); },pull:()=>{ E().std=!E().std; },push:()=>{ E().std=!E().std; },tip:()=>E().std?'STD (push for QNH)':'BARO '+E().qnh+' hPa (push for STD)'});
    CT.push({id:P+'MINS '+s,t:'knob',turn:d=>{ B.mins=clamp(B.mins+d*10,0,9990); },pull:()=>{ B.minsRA=!B.minsRA; },push:()=>{ B.minsRA=!B.minsRA; },tip:()=>(B.minsRA?'RADIO ':'BARO ')+'minimums '+B.mins+' (push: RADIO / BARO)'});
    X.tog(P+'VOR/ADF 1 '+s,null,[2,1,0],{get:()=>E().adf1,set:v=>{ E().adf1=v; },lab:['VOR','OFF','ADF']}); X.tog(P+'VOR/ADF 2 '+s,null,[2,1,0],{get:()=>E().adf2,set:v=>{ E().adf2=v; },lab:['VOR','OFF','ADF']});
    for(const f of ['STA','WPT','ARPT','DATA','POS','TERR','WXR','FPV','MTRS']) X.act(P+f+' '+s,()=>{ const e=E(); const k=f.toLowerCase(); e.filt[k]=!e.filt[k]; X.say(f+' '+(e.filt[k]?'on':'off')); });
  }
  // ---- centre panel ----
  CT.push({id:'GEAR / AUTOBRAKE|AUTOBRAKE',t:'selF',get:()=>B.ab,set:v=>{ B.ab=v; X.A.sw.abrk=[3,0,1,2,2,3][v]; },pos:['RTO','OFF','1','2','3','MAX'],ang:[-70,-40,-10,20,45,70]});
  CT.push({id:'GEAR / AUTOBRAKE|GEAR LEVER',t:'lever',kind:'gear'});
  // ---- control stand ----
  CT.push({id:'THRUST LEVERS|THR LEVER 1',t:'thr',i:0}); CT.push({id:'THRUST LEVERS|THR LEVER 2',t:'thr',i:1});
  X.act('THRUST LEVERS|TOGA L',()=>toga()); X.act('THRUST LEVERS|TOGA R',()=>toga());
  X.act('THRUST LEVERS|A/T DISENGAGE L',()=>atDisc()); X.act('THRUST LEVERS|A/T DISENGAGE R',()=>atDisc());
  CT.push({id:'CONTROL STAND|SPEED BRAKE',t:'lever',kind:'spd'});
  CT.push({id:'CONTROL STAND|FLAP LEVER',t:'lever',kind:'flaps'});
  CT.push({id:'CONTROL STAND|PARKING BRAKE',t:'lever',kind:'park'});
  for(const i of [0,1]) sw('CONTROL STAND|ENG START LEVER '+(i+1),()=>B.lever[i],v=>{ B.lever[i]=v; X.say('Start lever '+(i+1)+' '+(v?'IDLE':'CUTOFF')); },[1,0],['IDLE','CUTOFF']);
  for(const s of ['L','R']) CT.push({id:'CONTROL STAND|STAB TRIM WHEEL '+s,t:'knob',turn:d=>trim(-d),pull:()=>trim(1),push:()=>trim(-1),tip:()=>'Stabilizer trim '+trimUnits().toFixed(2)+' units (top: nose down, bottom: nose up)'});
  CT.push({id:'TRIM|RUDDER TRIM',t:'knob',turn:d=>{ X.A.sw.rudTrim=clamp(+(X.A.sw.rudTrim+d*0.5).toFixed(1),-16,16); },push:()=>{},pull:()=>{},tip:()=>'Rudder trim '+X.A.sw.rudTrim});
  // ---- fire protection ----
  X.pb('FIRE PROTECTION|ENG 1 FIRE','fireP1',null,['1','r',()=>X.A.fire.e[0]||firetest()],{cls:'fire big'});
  X.pb('FIRE PROTECTION|APU FIRE','fireA',null,['APU','r',()=>X.A.fire.a||firetest()],{cls:'fire big'});
  X.pb('FIRE PROTECTION|ENG 2 FIRE','fireP2',null,['2','r',()=>X.A.fire.e[1]||firetest()],{cls:'fire big'});
  X.mom('FIRE PROTECTION|OVHT/FIRE TEST','fireT1',null,null);
  // ---- pedestal: transponder ----
  CT.push({id:'TRANSPONDER|XPDR MODE',t:'selF',get:()=>B.xpdr,set:v=>{ B.xpdr=v; X.A.sw.xpdrMd=v===0?0:1; X.A.sw.tcas=v>=4?2:v===3?1:0; },pos:['STBY','ALT RPTG OFF','XPNDR','TA ONLY','TA/RA'],ang:[-60,-30,0,30,60]});
  CT.push({id:'TRANSPONDER|XPDR DISPLAY',t:'seg',txt:()=>X.A.dc?String(X.A.sw.xpdr||'2000'):''});
}
function firetest(){ return !!X.A.sw.fireT1; }
function anyFire(){ return X.A.fire.e[0]||X.A.fire.e[1]||X.A.fire.a||firetest(); }
const SIX={'FLT CONT':['F/CTL'],'IRS':['NAV','ADR','IR'],'FUEL':['FUEL'],'ELEC':['ELEC'],'APU':['APU'],'OVHT/DET':['FIRE','SMOKE','CARGO'],'ANTI-ICE':['ANTI ICE'],'HYD':['HYD'],'DOORS':['DOOR'],'ENG':['ENG'],'OVERHEAD':['OXY','CAB PR'],'AIR COND':['AIR','COND','BLEED','PACK']};
function sixLit(t){ const E=X.A.ecam; if(!X.A.dc) return false; if(X.A.sw.annLt===2) return true; const recall=B.recallT>0;
  return E.list.some(a=>a.lvl>=2&&(recall||!E.mcAck[a.id]&&!E.mwAck[a.id])&&SIX[t].some(p=>a.title.startsWith(p))); }
function toga(){ const M=X.M, a=M.ap; if(M.gnd){ if(!a.athrArm&&!a.athr){ X.say('TO/GA: A/T not armed: set the thrust by hand'); a.toga=true; return; } B.toga=true; X.say('TO/GA: takeoff thrust'); }
  else { if(M.conf>0||a.appr||a.vert.startsWith('G/S')){ B.toga=true; X.say('Go-around'); } } }
function atDisc(){ const a=X.M.ap; if(a.athr||a.athrArm){ a.athr=false; a.athrArm=false; B.toga=false; X.M.events.push('athrinst'); } }
/* stabilizer trim: the shared model trims a speed; the units shown are what that speed needs */
function trimUnits(){ const M=X.M; const v=M.trimSpd||(M.ias>60?M.ias:150); return clamp(4.2+(250-v)*0.024+(M.conf>0?0.6:0),0,17); }
function trim(d){ const M=X.M; if(M.ap.ap1||M.ap.ap2) { X.say('Autopilot trim: disconnect the autopilot to trim by hand'); return; } const v=M.trimSpd||M.ias; M.trimSpd=clamp(v+d*2.5*(v/200),100,360); B.trimT=0.6; }
/* ---------------- displays ---------------- */
const DISP=[{id:'PFD CPT',k:'pfd',side:0,hz:30},{id:'ND CPT',k:'nd',side:0,hz:30},{id:'UPPER DU',k:'eng',hz:12},{id:'LOWER DU',k:'eng2',hz:5},{id:'ND F/O',k:'nd',side:1,hz:15},{id:'PFD F/O',k:'pfd',side:1,hz:15},
  {id:'STANDBY',k:'isis',hz:15,rect:[381.3,681.3,39.5,39.5]},{id:'CDU L',k:'mcdu',side:0,hz:0,rect:[346.3,826.3,71,63.7],asp:63.7/71},{id:'CDU R',k:'mcdu',side:1,hz:0,rect:[580.3,826.3,71,63.7],asp:63.7/71},
  {id:'FLAP IND',k:'flapind',hz:8,rect:[537.5,618,29,29]},{id:'GEAR LTS',k:'gearl',hz:4,rect:[574,617,31,30]}];
function vsp(M){ const s=M.spds||{}; return s; }
function dispData(d){
  const M=X.M, A=X.A, K=X.K, ap=M.ap, side=d.side||0, E=side?UI.efis2:UI.efis, R2D=180/Math.PI;
  const ir=A.irs[side?1:0], irOK=ir.st===2, attOK=ir.st===2||ir.st===3, adrOK=!!(A.bus.acEss||A.bus.ac1||A.bus.ac2||A.bus.dcBat);
  const pwr=side?(A.bus.ac2||A.bus.acEss):(A.bus.acEss||A.bus.ac1);
  const hdg=w360(M.psi*R2D), trk=w360((M.gnd?M.psi:M.trk||M.chi)*R2D);
  if(d.k==='pfd'){
    const qnhAdj=E.std?0:(E.qnh-1013.25)*27.3, alt=M.h/FT+qnhAdj, sp=vsp(M), fdOn=side?ap.fd2:ap.fd1;
    const fdP=ap.gamC!=null?clamp((ap.gamC-M.gam)*R2D*2.2,-10,10):0, fdR=ap.phiC!=null?clamp((ap.phiC-M.phi)*R2D,-25,25):0;
    const bugs=[]; const k=K.d;
    if(M.gnd){ if(k.v1) bugs.push({v:k.v1,t:'V1'}); if(k.vr) bugs.push({v:k.vr,t:'VR'}); if(k.v2) bugs.push({v:k.v2+15,t:''}); }
    else { const ref=k.vref; if(ref&&(M.conf>0||ap.appr)) bugs.push({v:ref,t:'REF'}),bugs.push({v:ref+15,t:''});
      const base=ref||(sp.vls?sp.vls*1.0:140); if(M.conf>0||!ref){ const vr40=CDU.vrefs(A)[2][1]; [['UP',vr40+70],['1',vr40+50],['5',vr40+30],['15',vr40+20]].forEach(([t,v])=>{ if(Math.abs(v-M.ias)<60) bugs.push({v,t}); }); } }
    const mins=B.mins, ls=E.mode===0||ap.appr||ap.loc;
    const spdSel=ap.spd.man?(ap.spd.mach?'.'+String(Math.round(ap.spd.v*1000)).padStart(3,'0'):String(Math.round(ap.spd.v))):(ap.athr||ap.fd1||ap.fd2?String(Math.round(ap.tgtSpd||0)):null);
    const msg=M.stall&&!M.gnd?'STALL':(B.trimT>0&&!(ap.ap1||ap.ap2)?'':'');
    return {pwr,attOK,adrOK,irOK,phi:M.phi*R2D,th:M.th*R2D,beta:(M.beta||0)*R2D,ias:M.ias,alt,vs:M.vs/FPM,hdg,trk,hdgOK:irOK||attOK,ra:M.ra/FT,gnd:M.gnd,
      vmax:sp.vmax,vmin:M.gnd?null:(sp.vls?sp.vls*0.97:null),shaker:M.gnd?null:(sp.vaprot?sp.vaprot*0.92:null),bugs,spdTgt:M.gnd&&!ap.vert?(K.d.v2||null):ap.tgtSpd,spdSel,trend:(M.accel||0)*10,mach:M.mach,
      selAlt:ap.alt.v,std:E.std,qnh:E.qnh,selHdg:ap.hdg.v,fd:fdOn&&!!(ap.lat||ap.vert)&&!(M.gnd&&!ap.vert),fdPitch:fdP,fdRoll:fdR,
      ls,loc:M.nav.loc,gs:M.nav.gs,dme:M.nav.dme,lsId:K.d.ilsId,lsFreq:K.d.ilsFreq,mins,minsRA:B.minsRA,fma:fmaOf(),afds:afds(),vsSel:ap.vert==='V/S'?ap.vs.v:null,
      pli:!M.gnd&&(M.conf>0||(sp.vls&&M.ias<sp.vls+15))?M.th*R2D+(13-M.alpha*R2D):null,msg};
  }
  if(d.k==='nd'){
    const fx=[]; for(const id in X.FIX){ if(id==='RW36') continue; const f=X.FIX[id]; fx.push({id,N:f.N,E:f.E,vor:id==='ASN'}); }
    const fp=K.active&&K.fpln.length?K.fpln.map(p=>({id:p.rwy?'RW36':p.id,N:p.N,E:p.E,rwy:p.rwy,cst:p.cst,cstTxt:p.cst?CDU.cstTxt(p.cst):''})):null;
    if(fp) fp.forEach(p=>{ const f=fx.find(x=>x.id===p.id); if(f) f.fp=true; });
    const nav=M.nav&&M.nav.fp; const W=M.wind||{dir:0,spd:0}; const now=new Date();
    let eta=''; if(nav&&nav.toDist!=null){ const t=new Date(now.getTime()+nav.toDist/Math.max(100,M.gs/KT)*3600e3); eta=String(t.getUTCHours()).padStart(2,'0')+String(t.getUTCMinutes()).padStart(2,'0')+'.'+Math.floor(t.getUTCSeconds()/6); }
    const vo=(v,n)=>v===2?{k:'VOR '+n,id:'ASN'}:v===0?{k:'ADF '+n,id:'AN'}:null;
    return {pwr,irOK,mode:NDM[E.mode],ctr:E.ctr,range:RANGES[E.range],N:M.N,E:M.E,hdg,trk,selHdg:ap.hdg.v,hdgSel:ap.lat==='HDG'||ap.lat==='TRK',gs:M.gs/KT,tas:M.tas/KT,windDir:W.dir,windSpd:W.spd,
      fixes:fx,fpln:fp,actIdx:K.act,toWpt:nav?nav.toWpt:null,toDist:nav?nav.toDist:null,eta,ls:ap.appr||ap.loc,loc:M.nav.loc,gs_:M.nav.gs,lsCrs:K.d.ilsCrs,lsId:K.d.ilsId,dme:M.nav.dme,
      filt:E.filt,rwyLen:X.F.RWY.len,vor1:vo(E.adf1,1),vor2:vo(E.adf2,2)};
  }
  if(d.k==='eng'){ const at=X.F.isa(M.h,M.oatDev), sat=at.T-273.15, tat=sat+(M.tas*M.tas)/(2*1005);
    const lim=M.gnd||ap.vert==='SRS'||B.toga?'toga':'clb', ref=X.F.n1Rating(M,lim)*(K.d.n1sel==='TO-1'&&lim==='toga'?0.966:K.d.n1sel==='TO-2'&&lim==='toga'?0.932:1);
    const mode=M.gnd?(K.d.n1sel&&K.d.n1sel!=='TO'?K.d.n1sel:'TO'):ap.gaMode?'G/A':(ap.clbPh||ap.vert==='SRS')?'CLB':'CRZ';
    const msgs=[]; if(A.sw.park&&M.gnd&&false) msgs.push({t:'PARKING BRAKE',c:'#fff'});
    if(A.fuel.lo+A.fuel.li<453||A.fuel.ri+A.fuel.ro<453) msgs.push({t:'LOW FUEL'});
    const ff=e=>e.ff/1000;
    return {pwr:A.bus.acEss||A.bus.ac1||A.bus.ac2,tat,mode,refN1:ref,cmd:ap.athr?M.n1Cmd:null,sel:'',fuel:[A.fuel.lo+A.fuel.li,A.fuel.c,A.fuel.ri+A.fuel.ro],msgs,
      eng:A.eng.map((e,i)=>({n1:e.n1,egt:e.egt,ff:ff(e),startV:e.startV,oilLo:e.oilP<13&&(e.run||e.n2>20),rev:M.tla&&M.tla[i]<0?(M.rev&&M.rev[i]>0.9?2:1):0}))};
  }
  if(d.k==='eng2') return {pwr:A.bus.ac2||A.bus.acEss||A.bus.ac1,eng:A.eng.map(e=>({n2:e.n2,ff:e.ff/1000,oilP:e.oilP,oilT:e.oilT,oilQ:e.oilQ/17.5*85,vib:e.run?0.4+e.n1/100*0.6:0})),anyRun:A.eng.some(e=>e.run),
    hydA:A.hyd.g,hydB:A.hyd.y,apuEgt:A.apu.egt};
  if(d.k==='isis') return {pwrIsis:A.bus.dcEss||A.bus.hot1||A.dc,phi:M.phi*R2D,th:M.th*R2D,ias:M.ias,alt:M.h/FT+(UI.efis.std?0:(UI.efis.qnh-1013.25)*27.3),qnh:UI.efis.qnh,mach:M.mach};
  if(d.k==='mcdu') return {pwr:side?A.bus.ac2:(A.bus.acEss||A.bus.ac1),mcdu:CDU.render(K,M,A)};
  if(d.k==='flapind') return {l:B.fpos||0,r:B.fpos||0};
  if(d.k==='gearl'){ const g=M.gear; return {pwr:A.dc,green:g>0.99,red:(g>0.01&&g<0.99)||(X.A.sw.gearLv===0&&g>0.01)}; }
  return null;
}
/* ---------------- start positions, per-tick system mapping ---------------- */
function reset(kind){
  const A=X.A, M=X.M, K=X.K, ap=M.ap, cold=kind==='cold';
  M.conv=true; bReset(cold);
  K.page=cold?'ident':(kind==='ready'?'to':'legs'); K.sp=''; K.msg=''; K.exec=null; K.mod=null; K.sub=0; K.active=!cold; K.irsSet=!cold;
  if(!cold){ Object.assign(K.d,{rwy:'RW36',fltNbr:'NRD737',toFlaps:5,cg:22,res:2.5,crzFl:100,n1sel:'TO',refApt:'ENRD'}); K.d.zfw=A.zfw; const s=CDU.vspeeds(K,A); Object.assign(K.d,s); ap.v1=s.v1; ap.vr=s.vr; ap.v2=s.v2; }
  const vr=CDU.vrefs(A); K.d.vrefF=30; K.d.vref=vr[1][1]; ap.vapp=K.d.vref+5;
  if(kind==='ready'){ B.flap=3; A.sw.flapLv=1; M.onePlusF=true; B.fpos=5; B.ab=0; A.sw.abrk=3; UI.tla=[0,0]; ap.athrArm=true; M.trimSpd=(K.d.v2||150)+20; ap.spd.man=true; ap.spd.v=K.d.v2; ap.alt.v=5000; ap.hdg.v=360; A.sw.spArm=1; }
  if(kind==='air'){ B.flap=0; ap.spd.man=true; ap.spd.v=250; M.trimSpd=250; ap.hdgHold=false; }
  if(kind==='appr'){ B.flap=4; A.sw.flapLv=2; B.fpos=10; ap.spd.man=true; ap.spd.v=180; M.trimSpd=180; UI.efis.mode=0; UI.efis.range=1; UI.efis2.mode=0; UI.efis2.range=1; B.minsRA=false; B.mins=200; }
  if(kind==='cold'){ A.sw.flapLv=0; ap.fd1=ap.fd2=false; Object.assign(A.sw,{pk1:1,pk2:1,eb1:1,eb2:1,apuBl:0,ext:0,gen1:0,gen2:0,apuGen:0}); }
  if(kind!=='cold'){ A.sw.probe=1; A.sw.xb=1; B.apu=0; A.sw.apuM=0; A.sw.hyY=1; A.sw.ptu=1; }
  if(kind==='air'||kind==='appr'){ A.sw.gearLv=0; A.sw.spArm=0; B.ab=1; A.sw.abrk=0; }
  if(kind==='appr'){ A.sw.gearLv=1; M.gear=1; M.gearDown=true; }
  B.fpos=FLAPS[B.flap]; UI.ls=[false,false];
  X.say(kind==='cold'?'Cold and dark on the stand. Ground power is connected: GRD PWR ON, then the APU.':kind==='ready'?'Lined up on runway 36, flaps 5, A/T armed. Press TO/GA (or T) and release the brakes.':kind==='air'?'5,000 ft, 250 kt, CMD A, heading 360. LNAV and VNAV are ready on the CDU route.':'12 NM from runway 36 at 3,000 ft, flaps 10, gear down. Arm APP on the MCP.',null,5000);
}
let apuT=0;
function postSys(dt){
  const A=X.A, M=X.M, S=A.sw, ap=M.ap;
  // APU switch: START springs back to ON
  if(B.apuT>0){ B.apuT-=dt; if(B.apuT<=0){ S.apuS=0; if(B.apu===2) B.apu=1; } }
  // engine start: start switch GRD (starter) + start lever IDLE (fuel and ignition); the starter cuts out at 56 % N2
  let mode=1, crank=false; S.manSt1=S.manSt2=0;
  for(const i of [0,1]){ const e=A.eng[i], sw_=B.startSw[i], lv=B.lever[i]; S['mst'+(i+1)]=lv;
    if(sw_===0){ if(!e.run&&lv) mode=2; else if(!e.run){ crank=true; S['manSt'+(i+1)]=1; }
      if(e.run||e.n2>=56){ B.startSw[i]=1; X.say('Starter cut-out, engine '+(i+1)+': start switch to OFF'); } }
    if((sw_===2||sw_===3)&&lv) mode=2; }
  S.engMode=mode===2?2:crank?0:1;
  // flap lever → shared configurations; flap indicator follows the surfaces
  const ci=FLAPCONF[B.flap]; if(S.flapLv!==ci){ S.flapLv=ci; }
  if(ci===1) M.onePlusF=B.flap>=5;
  const tgt=FLAPS[B.flap], hydOK=A.hyd.g>1500||A.hyd.y>1500; if(hydOK){ const r=tgt>(B.fpos||0)?1.3:1.8; B.fpos=(B.fpos||0)+clamp(tgt-(B.fpos||0),-r*dt*3,r*dt*3); }
  // overhead fire test, recall timer, trim message
  S.fireT2=S.fireTA=S.fireT1; if(B.recallT>0) B.recallT-=dt; if(B.trimT>0) B.trimT-=dt;
  // flap / gear limit callouts: the overspeed clacker comes from the shared VMO / VFE logic
  // the autothrottle drives the thrust levers; with the A/T off the levers stay where they are
  leverFollow(dt);
  if(ap.athr&&ap.thr==='THR IDLE'&&ap.retard&&M.gnd&&M.gs/KT<60){ ap.athr=false; }
  // A/P disconnect on the ground after landing (the 737 A/P cannot stay engaged on the rollout below 60 kt in single channel)
  if(!M.gnd) B.air=true;
}
/* thrust lever, flap and speed brake handling */
const D3=document.body.hasAttribute('data-d3'); // 3D: the panel textures repaint when a label changes, so no running N1 numbers on the levers
function thrTxt(i){ const v=UI.tla[i]; if(v<0) return 'REV'; if(D3) return v>40?'TO':v<1?'IDLE':''; const e=X.A.eng[i]; return e.run?e.n1.toFixed(1):'--'; }
function levTxt(k){ const S=X.A.sw; if(k==='flaps') return String(FLAPS[B.flap]); if(k==='gear') return S.gearLv?'DN':'UP'; if(k==='spd') return S.spArm?'ARMED':S.spdBrk>0?(S.spdBrk>=0.99?'UP':'FLT '+Math.round(S.spdBrk*100)+'%'):'DOWN'; return null; }
function flapSay(){ X.say('Flaps '+FLAPS[B.flap]+(FLAPLIM[B.flap]?' (limit '+FLAPLIM[B.flap]+' kt)':'')); }
function lever(c,fy){ if(c.kind==='flaps'){ B.flap=clamp(B.flap+(fy<0.5?-1:1),0,8); flapSay(); return true; } return false; }
function keydown(c,e){
  const S=X.A.sw;
  switch(c){
    case 'KeyF': B.flap=Math.min(8,B.flap+1); flapSay(); return true;
    case 'KeyV': B.flap=Math.max(0,B.flap-1); flapSay(); return true;
    case 'KeyT': e.preventDefault(); toga(); return true;
    case 'KeyY': case 'KeyU': return true;
    case 'KeyI': UI.tla=[0,0]; B.ovr=2; return true;
    case 'KeyZ': atDisc(); return true;
    case 'Home': case 'Numpad7': case 'BracketLeft': e.preventDefault(); trim(1); return true;
    case 'End': case 'Numpad1': case 'BracketRight': e.preventDefault(); trim(-1); return true;
    case 'Digit1': X.view('ovhd'); return true; case 'Digit2': X.view('main'); return true; case 'Digit3': X.view('ped'); return true; case 'Digit4': X.view('mcp'); return true; case 'Digit5': X.view('eng'); return true; case 'Digit6': X.view('cdu'); return true;
  }
  return false; }
function cduHTML(){
  const L6=n=>Array.from({length:6},(_,i)=>`<button type="button" data-k="${n}${i+1}" class="lsk" aria-label="${n==='L'?'Left':'Right'} line key ${i+1}"></button>`).join('');
  const fk=['INIT REF','RTE','CLB','CRZ','DES','MENU','LEGS','DEP ARR','HOLD','PROG','EXEC','N1 LIMIT','FIX','PREV PAGE','NEXT PAGE'];
  return `<div class="mtop"><div class="mtabs" role="tablist"><button type="button" class="on" data-t="live" role="tab">CDU · this flight</button><button type="button" data-t="tr" role="tab">FMC trainer (guided tasks)</button></div><button type="button" class="mx" aria-label="Close">×</button></div>
  <div class="mpane" data-p="live"><div class="mu bcdu"><div class="mscr"><div class="lcol">${L6('L')}</div><canvas width="710" height="637"></canvas><div class="lcol">${L6('R')}</div></div>
  <div class="mfk bfk">${fk.map(k=>`<button type="button" data-k="${k}"${k==='EXEC'?' class="exec"':''}>${k.replace(' ','<br>')}</button>`).join('')}</div>
  <div class="mkb"><div class="mnav">${['1','2','3','4','5','6','7','8','9','.','0','+/-'].map(k=>`<button type="button" class="num" data-k="${k}">${k}</button>`).join('')}</div>
  <div class="mabc">${'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('').map(k=>`<button type="button" data-k="${k}">${k}</button>`).join('')}${['Z','SP','DEL','/','CLR'].map(k=>`<button type="button" data-k="${k}">${k}</button>`).join('')}</div></div>
  <p class="mhint">Type with the keys (or your keyboard), then press a line key beside the field. A change to the active route lights EXEC: press it to make it active. CLR deletes a character, DEL then a line key deletes a waypoint or a constraint.</p></div></div><div class="mpane" data-p="tr" hidden><iframe title="FMC trainer" loading="lazy"></iframe></div>`; }
window.SIMAC={T:window.B737T,H:1520,key:'bb-b737-start',img:['img/cockpits/b738-deck-1500.webp','img/cockpits/b738-deck-3000.webp'],cduIds:['CDU L','CDU R'],gshade:null,
  REG:{ovhd:[282,38,436,428],main:[70,536,860,258],mcp:[250,540,500,56],eng:[425,664,152,290],cdu:[330,815,345,175],ped:[332,992,336,528],side:[0,1300,1000,120]},
  REGN:{ovhd:'Overhead',main:'Panel',mcp:'MCP and EFIS',eng:'Engine displays',cdu:'CDU',ped:'Pedestal'},
  DISP,draw:{pfd:DSP7.pfd,nd:DSP7.nd,eng:DSP7.eng,eng2:DSP7.eng2,mcdu:DSP7.mcdu,flapind:DSP7.flapind,gearl:DSP7.gearl},cdu:CDU,cduCls:'b737cdu',trainer:'fmc.html',cduHTML,detents:[0,45],
  d3:{VIEWS:{ovh:{c:[0.895,1.53,0.025],n:[-0.396,0.918,0],up:[0.918,0.396,0],W:0.74,H:0.76,r:[262.8,0,474.3,487.2]},
      front:{c:[0.434,0.9608,0],n:[-0.96,-0.278,0],up:[0,1,0],W:1.56,H:0.4767,r:[0,495.6,1000,305.7]},
      cdu:{c:[0.5705,0.6582,0.02],n:[-0.49,-0.872,0],up:[-0.872,0.49,0],W:0.58,H:0.2667,r:[314.2,809.9,371.7,170.9]},
      ped:{c:[1.0958,0.6,0.02],n:[0,-1,0],up:[-1,0,0],W:0.5,H:0.8283,r:[339.8,989.4,320.5,530.9]}},
    eye:[1.34,1.28,0.51],pitch:-15,yaw:-0.16,shell:'models/b737-shell.bin',shellTex:'models/b737-shell-',
    look:{main:1,ovhd:[500,240,64,-0.02],ped:[500,1180,58,-0.2],mcp:[500,568,28],eng:[500,760,36,-0.25],cdu:[500,880,36,-0.2]}},
  speedsPane(el){ const K=X.K, A=X.A, r=(t,v)=>`<div class="row"><span>${t}</span><b>${v==null?'—':Math.round(v)+' kt'}</b></div>`, vr=CDU.vrefs(A);
    el.innerHTML='<div class="sgrp">Speeds at '+(A.gw/1000).toFixed(1)+' t</div>'+r('V1',K.d.v1)+r('VR',K.d.vr)+r('V2',K.d.v2)+vr.map(([f,v])=>r('VREF '+f,v)).join('')+r('VMO','340')+'<p class="pdisc">MMO 0.82. Flap placards: 1, 2, 5 250 kt · 10 210 · 15 200 · 25 190 · 30 175 · 40 162. Gear: extend 270 kt / .82, retract 235 kt.</p>'; },
  init(x){ X=x; UI=x.UI; bReset(false); Object.assign(x.F.AC,{S:124.6,T0:117000,wheelbase:15.6}); /* 737-800 wing area, CFM56-7B26 thrust, wheelbase */ },defs,dispData,reset,postSys,tla,thrTxt,levTxt,lever,keydown};
})();
