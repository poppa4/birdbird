/* Birdbird – classic Cessna 172 panel drawn in SVG (world units 2000×1320).
   Own drawing of a typical carburetted 172P-style panel: six-pack, left column of engine and electrical gauges,
   NAV indicators and ADF beside the six-pack, centre radio stack (audio, two NAV/COMs, ADF, DME, transponder),
   lower switch and control panel, push-pull engine controls, flaps, trim wheel and fuel selector.
   No images or artwork from any manual, no manufacturer or avionics brand marks; generic labels only.
   Interaction framework shared with b200panel.js / da42panel.js. Controls report through io.get/io.set. */
(function(G){
'use strict';
const W=2000, H=1320, NS='http://www.w3.org/2000/svg';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- geometry ----------
   Laid out to a typical 172N/P panel at ~1.9 world units per mm (panel ~1 m wide = x 40..1960):
   3 1/8" instruments 156 u bezel on a 162 u pitch, gyros over the pilot's control column, engine gauges at the left edge,
   radio stack on the centreline, second radio column and extra instruments on the right, switch and control panel below. */
const SX=[318,480,642], SY=[390,555], IR=66;                 // six-pack centres and dial radius
const LX=135, NX=804, STK={x:894,w:340}, STK2={x:1256,w:340};  // left column, NAV column, centre stack, right radio column
const RU={aud:[302,72],nc1:[382,104],nc2:[494,104],adf:[302,100],dme:[410,64],xp:[482,84]};
const PT=296, PB=905, LB=1080;
const SKY=300, LIP=239;   // windshield headroom above y=0 shown in the 2D overview when the outside view is on; glareshield top at the centre line                                 // glareshield lip, panel / subpanel seam, subpanel bottom
const YK={L:[480,1184],R:[1528,1184]}, COLY=812;                // control wheel hubs, column holes through the panel
const SUBY=962;                                                // switch row on the subpanel

/* ---------- regions for zoom ---------- */
const REG={
  overview:[0,0,W,H],
  six:[214,286,532,368], left:[30,286,250,620], low6:[226,650,520,256], nav:[716,286,180,560],
  audio:[884,286,360,330], radios:[1246,286,360,300], flaps:[1250,596,250,306], right:[1606,286,370,620],
  switches:[30,905,790,215], cbs:[40,1018,760,62], quad:[850,905,420,175], rlower:[1270,905,420,175],
  pedestal:[850,1080,300,240], compass:[880,40,240,230]
};
const REG_ORDER=['compass','cbs','quad','rlower','audio','radios','flaps','pedestal','switches','nav','low6','left','six','right'];

/* ---------- controls ---------- */
const C=[]; const add=o=>{ C.push(o); return o; };
/* instrument knobs */
add({id:'aiK',t:'enc',x:SX[1],y:SY[0]+IR+3,r:7,l:'ATTITUDE INDICATOR – MINIATURE AIRPLANE ADJUST',d:'',deg:20});
add({id:'baroK',t:'enc',x:SX[2]-IR+4,y:SY[0]+IR+2,r:9,l:'ALTIMETER SETTING KNOB',d:''});
add({id:'dgK',t:'enc',x:SX[1]-IR+4,y:SY[1]+IR+2,r:9,l:'HEADING INDICATOR – PUSH TO SET',d:''});
add({id:'obs1',t:'enc',x:NX-IR+4,y:SY[0]+IR+2,r:9,l:'NAV 1 OBS (COURSE SELECT)',d:''});
add({id:'obs2',t:'enc',x:NX-IR+4,y:SY[1]+IR+2,r:9,l:'NAV 2 OBS (COURSE SELECT)',d:''});
add({id:'adfCard',t:'enc',x:NX-IR+4,y:740+IR+2,r:9,l:'ADF CARD – HEADING SET',d:''});
add({id:'egtK',t:'enc',x:1712+38,y:392+38,r:6,l:'EGT REFERENCE POINTER',d:''});
add({id:'covAI',t:'key',x:SX[2]-24,y:716,w:40,h:18,l:'AI COVER',alt:1,led:1,lbl:'INSTRUMENT COVER – ATTITUDE INDICATOR (PARTIAL PANEL PRACTICE)'});
add({id:'covDG',t:'key',x:SX[2]+24,y:716,w:40,h:18,l:'HI COVER',alt:1,led:1,lbl:'INSTRUMENT COVER – HEADING INDICATOR (PARTIAL PANEL PRACTICE)'});
/* audio panel */
{ const x0=STK.x, y0=RU.aud[0];
  add({id:'mkrSw',t:'tog3',x:x0+76,y:y0+42,l:'MARKER BEACON SENSITIVITY (HI / LO / TEST)',d:'',vals:['HI','LO','TEST'],sm3:1,s:4.2,lay:'right'});
  [['auC1','COM 1'],['auC2','COM 2'],['auN1','NAV 1'],['auN2','NAV 2'],['auAdf','ADF'],['auDme','DME'],['auMkr','MKR']].forEach(([id,n],i)=>
    add({id,t:'tog',x:x0+132+i*25,y:y0+44,l:'AUDIO '+n+' (SPEAKER / OFF)',d:'',xs:1,up:n.replace(' ','\n'),s:3.9}));
  add({id:'micSel',t:'rotsel',x:x0+312,y:y0+42,r:11,l:'MICROPHONE SELECTOR (COM 1 / COM 2)',d:'',vals:['COM1','COM2'],ang:[-45,45],s:3.8}); }
/* NAV/COM 1 and 2 */
[['1',RU.nc1[0]],['2',RU.nc2[0]]].forEach(([n,y0])=>{ const x0=STK.x;
  add({id:'pwr'+n,t:'rot',x:x0+24,y:y0+74,r:10,l:'NAV/COM '+n+' POWER / VOLUME',d:'',s:3.6});
  add({id:'comX'+n,t:'key',x:x0+154,y:y0+74,w:22,h:14,l:'⇆',lbl:'COM '+n+' FREQUENCY TRANSFER (ACTIVE ⇆ STANDBY)'});
  add({id:'navX'+n,t:'key',x:x0+196,y:y0+74,w:22,h:14,l:'⇆',lbl:'NAV '+n+' FREQUENCY TRANSFER (ACTIVE ⇆ STANDBY)'});
  add({id:'comK'+n,t:'enc2',x:x0+116,y:y0+74,r:15,l:'COM '+n+' FREQUENCY (OUTER MHz / INNER kHz)',d:''});
  add({id:'navK'+n,t:'enc2',x:x0+308,y:y0+74,r:15,l:'NAV '+n+' FREQUENCY (OUTER MHz / INNER kHz)',d:''});
  add({id:'navId'+n,t:'key',x:x0+262,y:y0+78,w:24,h:14,l:'ID',alt:1,led:1,lbl:'NAV '+n+' IDENT (MORSE ON / OFF)'}); });
/* ADF receiver (right radio column) */
{ const x0=STK2.x, y0=RU.adf[0];
  add({id:'adfPwr',t:'rot',x:x0+24,y:y0+72,r:10,l:'ADF POWER / VOLUME',d:'',s:3.6});
  add({id:'adfMd',t:'key',x:x0+200,y:y0+58,w:24,h:14,l:'ADF',alt:1,led:1,lbl:'ADF MODE (ADF / ANT)'});
  add({id:'adfX',t:'key',x:x0+200,y:y0+82,w:24,h:14,l:'FRQ',lbl:'ADF FREQUENCY TRANSFER (FRQ)'});
  add({id:'adfK',t:'enc2',x:x0+306,y:y0+70,r:15,l:'ADF FREQUENCY (OUTER 100s / INNER 1s)',d:''}); }
/* DME */
{ const x0=STK2.x, y0=RU.dme[0];
  add({id:'dmePwr',t:'tog',x:x0+24,y:y0+38,l:'DME POWER',d:'',xs:1,up:'',dn:'',s:3.4});
  add({id:'dmeMd',t:'rotsel',x:x0+300,y:y0+36,r:10,l:'DME MODE (N1 / HOLD / N2)',d:'',vals:['N1','HLD','N2'],ang:[-60,0,60],s:3.6}); }
/* transponder */
{ const x0=STK2.x, y0=RU.xp[0];
  add({id:'xpMd',t:'rotsel',x:x0+34,y:y0+46,r:12,l:'TRANSPONDER MODE',d:'',vals:['OFF','SBY','ON','ALT','TST'],ang:[-110,-55,0,55,110],s:3.6,lr:14});
  [0,1,2,3].forEach(i=>add({id:'xp'+i,t:'enc',x:x0+180+i*36,y:y0+58,r:9,l:'TRANSPONDER CODE DIGIT '+(i+1),d:'',deg:45}));
  add({id:'xpId',t:'key',x:x0+312,y:y0+22,w:32,h:14,l:'IDENT',lbl:'TRANSPONDER IDENT'}); }
/* flaps (preselect lever with follow-up), right of centre below the stack */
add({id:'flaps',t:'flap',x:1370,y:760,l:'WING FLAP SWITCH',vals:['UP','10°','20°','FULL'],sp:30,d:'FLAP'});
/* switch and control panel (subpanel): left = primer, key, master, avionics, lights, breakers */
add({id:'primer',t:'pull',x:76,y:SUBY,r:12,l:'PRIMER (PULL – PUSH = ONE STROKE; IN AND LOCKED)',d:'PRIMER',s:5});
add({id:'mag',t:'rotsel',x:172,y:SUBY+4,r:22,keyk:1,l:'IGNITION (OFF / R / L / BOTH / START)',d:'',vals:['OFF','R','L','BOTH','START'],ang:[-80,-40,0,40,80],s:5,lr:40,spring:4,springTo:3,loop:0});
add({id:'altSw',t:'tog',rk:1,red:1,x:262,y:SUBY+4,rw:17,rh:32,l:'MASTER – ALT (LEFT HALF)',d:'',top:'',bot:'ALT'});
add({id:'batSw',t:'tog',rk:1,red:1,x:281,y:SUBY+4,rw:17,rh:32,l:'MASTER – BAT (RIGHT HALF)',d:'',top:'',bot:'BAT'});
add({id:'avio',t:'tog',x:352,y:SUBY+6,l:'AVIONICS POWER (SWITCH / BREAKER)',d:'',sm:1,up:'AVIONICS\nPOWER',dn:'OFF',s:4.6});
[['bcn','BEACON','BCN'],['land','LANDING LIGHT','LAND'],['taxi','TAXI LIGHT','TAXI'],['navL','NAVIGATION LIGHTS','NAV'],['strobe','STROBE LIGHTS','STROBE'],['pitot','PITOT HEAT','PITOT\nHEAT']]
  .forEach(([id,l,t],i)=>add({id,t:'tog',rk:1,x:548+i*46,y:SUBY+4,rw:18,rh:30,l,d:'',top:t,bot:'',s:5}));
add({id:'park',t:'pull',x:236,y:1108,r:9,tee:1,l:'PARKING BRAKE (PULL AND TURN)',d:'PARKING BRAKE',s:5});
const CBS=[]; const cbAdd=(k,l,x,y,o)=>{ const i=CBS.length; CBS.push({k,l}); add(Object.assign({id:'cb'+i,t:'cb',x,y,l:l+' CIRCUIT BREAKER',cb:k,ds:''},o||{})); };
{ const L=[['ALT','ALT','ALT','60'],['FLAP','FLAP','FLAP','15'],['INST','INSTRUMENTS (FUEL / OIL TEMP GAUGES)','INST','5'],['TURN','TURN COORDINATOR','TURN\nCOORD','5'],['NAV LT','NAV LIGHTS','NAV\nLT','5'],['STROBE','STROBE','STRB','5'],['BCN','BEACON','BCN','5'],['LAND LT','LANDING LIGHT','LDG\nLT','15'],['TAXI LT','TAXI LIGHT','TAXI\nLT','10'],
    ['PITOT HT','PITOT HEAT','PITOT\nHT','10'],['COM 1','COM 1','COM 1','5'],['NAV 1','NAV 1','NAV 1','2'],['COM 2','COM 2','COM 2','5'],['NAV 2','NAV 2','NAV 2','2'],['ADF','ADF','ADF','2'],['DME','DME','DME','2'],['XPDR','TRANSPONDER','XPDR','2'],['AUDIO','AUDIO PANEL','AUDIO','2']];
  /* one row along the bottom of the switch panel, with a gap where the control column passes */
  L.forEach(([k,l,la,amp],i)=>{ const x=i<10?60+i*37:528+(i-10)*37; cbAdd(k,l,x,1052,{la,amp,fs:3.6}); }); }
/* centre: carb heat, throttle, mixture over the pedestal; light rheostats */
add({id:'carb',t:'pull',x:926,y:SUBY+2,r:15,l:'CARBURETTOR HEAT (PULL ON)',d:'',top:'CARB\nHEAT',s:5});
add({id:'thr',t:'lev',kind:'pp',x:1000,y:SUBY-6,len:46,min:0,max:1,r:16,l:'THROTTLE (PUSH OPEN)',top:'THROTTLE',marks:[[1],[0]]});
add({id:'mix',t:'lev',kind:'pp',red:1,x:1082,y:SUBY-6,len:46,min:0,max:1,r:14,l:'MIXTURE (PUSH RICH, PULL LEAN – IDLE CUT-OFF)',top:'MIXTURE',side:'RICH',marks:[[1],[0]]});
add({id:'dimPanel',t:'rot',x:1170,y:SUBY+6,r:12,l:'PANEL LIGHTS DIMMER',d:'',top:'PANEL LT',s:4.6});
add({id:'dimRadio',t:'rot',x:1234,y:SUBY+6,r:12,l:'RADIO LIGHTS DIMMER',d:'',top:'RADIO LT',s:4.6});
/* right: cabin heat and air (cigar lighter drawn), map compartment */
add({id:'cabHeat',t:'pull',x:1336,y:SUBY+2,r:13,l:'CABIN HEAT (PULL ON)',d:'',top:'CABIN\nHEAT',s:5});
add({id:'cabAir',t:'pull',x:1404,y:SUBY+2,r:13,l:'CABIN AIR (PULL ON)',d:'',top:'CABIN\nAIR',s:5});
add({id:'elt',t:'tog3',x:1872,y:424,l:'ELT REMOTE SWITCH (ON / ARM / TEST-RESET)',d:'',vals:['ON','ARM','TEST/RESET'],s:4.4,lay:'right'});
/* pedestal and floor */
add({id:'trim',t:'vwheel',x:1000,y:1146,nolab:1,l:'ELEVATOR TRIM WHEEL'});
add({id:'fuelSel',t:'rotsel',x:1000,y:1266,r:24,fuelh:1,l:'FUEL SELECTOR VALVE (LEFT / BOTH / RIGHT / OFF)',d:'',vals:['LEFT','BOTH','RIGHT','OFF'],ang:[-90,0,90,180],s:5,lr:29});
/* control wheels (seen from the seat) */
add({id:'yokeL',t:'yoke',ces:1,x:YK.L[0],y:YK.L[1],l:'CONTROL WHEEL (LEFT) – DRAG TO FLY'});
add({id:'yokeR',t:'yoke',ces:1,x:YK.R[0],y:YK.R[1],l:'CONTROL WHEEL (RIGHT) – DRAG TO FLY'});

/* ---------- SVG helpers and controls (shared framework) ---------- */
function lab(x,y,t,o){ o=o||{}; const s=o.s||7; return String(t).split('\n').map((ln,i)=>`<text x="${x}" y="${(y+i*s*1.12).toFixed(1)}" class="pl ${o.c||''}" style="font-size:calc(var(--ls,1)*${s}px)" text-anchor="${o.a||'middle'}">${esc(ln)}</text>`).join(''); }
function labUp(x,y,t,o){ o=o||{}; const s=o.s||7, n=String(t).split('\n').length; return lab(x,y-(n-1)*s*1.12,t,o); }
const D=c=>c.d!==undefined?c.d:c.l;
function plate(x,y,w,h,r,cls){ return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r||6}" class="${cls||'sub'}"/>`; }
/* group outline with a title gap in the top line (placard style) */
function grp(x,y,w,h,t,o){ o=o||{}; const s=o.s||4.6, tw=t?t.length*s*0.62+6:0, m=x+w/2;
  return `<path d="M${m-tw/2} ${y}H${x}V${y+h}H${x+w}V${y}H${m+tw/2}" class="grpl"/>${t?lab(m,y+s*0.36,t,{s}):''}`; }
function brk(x0,x1,y,t,o){ o=o||{}; const s=o.s||4.2, tw=t.length*s*0.62+6, m=(x0+x1)/2; return `<path d="M${x0} ${y-3}V${y}H${m-tw/2}M${m+tw/2} ${y}H${x1}V${y-3}" class="grpl"/>${lab(m,y+s*0.36,t,{s})}`; }
function screw(x,y){ return `<g class="screw"><circle cx="${x}" cy="${y}" r="3.2"/><path d="M${x-2} ${y-1}l4 2"/></g>`; }
const pol=(x,y,r,deg)=>{ const a=deg*Math.PI/180; return [x+Math.sin(a)*r, y-Math.cos(a)*r]; };
const octP=(cx,cy,w,h,c)=>{ const x=cx-w/2, y=cy-h/2; return `M${x+c} ${y}H${x+w-c}L${x+w} ${y+c}V${y+h-c}L${x+w-c} ${y+h}H${x+c}L${x} ${y+h-c}V${y+c}Z`; };
function oct(cx,cy,w,h,c,cls){ return `<path d="${octP(cx,cy,w,h,c)}" class="${cls||'obz'}"/>`; }
/* instrument case: outer octagonal case with a lighter rim and a dark face */
function ocase(cx,cy,w,h,c){ return `${oct(cx,cy,w,h,c,'obz')}${oct(cx,cy,w-6,h-6,c-2,'obz2')}`; }
/* annunciator lamp: dark lens with a coloured legend, lit by ann() */
function lampBox(k,x,y,w,h,lines,col,fs){ const f=fs||Math.min(h/(lines.length+0.6),w/(Math.max(...lines.map(s=>s.length))*0.72)); const y0=y+h/2-(lines.length-1)*f*0.55+f*0.36;
  return `<rect x="${x-2}" y="${y-2}" width="${w+4}" height="${h+4}" rx="3" class="lampb"/><g class="an an-${col}" data-a="${esc(k)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>${lines.map((s,i)=>`<text x="${x+w/2}" y="${(y0+i*f*1.1).toFixed(1)}" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(s)}</text>`).join('')}</g>`; }

function nutSVG(c,x,y,r){ return `${c.ring?`<circle cx="${x}" cy="${y}" r="${r+3.2}" class="ringR"/>`:''}<circle cx="${x}" cy="${y}" r="${r}" class="nut"/><circle cx="${x}" cy="${y}" r="${r*0.6}" class="nut2"/>`; }
function batSVG(c,x,y,L,cls){ const k=c.big?5.6:4.2; return `<rect x="${x-3}" y="${y-L}" width="6" height="${L}" rx="3" class="${cls}"/><ellipse cx="${x}" cy="${y-L+1}" rx="${k}" ry="${k*0.72}" class="${cls}"/>`; }
function softSVG(c,x,y){ const w=c.w||17, h=c.h||11, f=Math.min(h*0.42,w/(c.soft.length*0.74));
  return `<g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="1.6" class="keyw"/>${c.t==='abtn'?`<rect class="aled" x="${x-w*0.3}" y="${y-h/2+1}" width="${w*0.6}" height="1.3" rx=".6"/>`:''}<text x="${x}" y="${(y+f*0.4+(c.t==='abtn'?0.6:0)).toFixed(1)}" class="kt" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(c.soft)}</text></g>`; }
function ctlSVG(c){
  const x=c.ox!==undefined?c.ox:c.x, y=c.oy!==undefined?c.oy:c.y; let s='';
  if(c.soft) s=softSVG(c,x,y); else
  switch(c.t){
    case 'tog': if(c.rk){ const w=c.rw||17, h=c.rh||28, cl=c.red?'rkR':'rkK';
        s=`<rect x="${x-w/2-2.5}" y="${y-h/2-2.5}" width="${w+5}" height="${h+5}" rx="2.5" class="rkF"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="2" class="${cl}"/><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h/2}" rx="2" class="rkHi"/><path d="M${x-w/2+3} ${y-h/2+4}h${w-6}" class="rkRib"/></g>${c.top?labUp(x,y-h/2-6,c.top,{s:c.s||5}):''}${c.bot?lab(x,y+h/2+(c.s||5)+3,c.bot,{s:c.s||5}):''}`; break; }
    case 'tog': { const L=c.xs?12:c.sm?16:20, ls=c.s||4.4, nr=c.xs?5.5:c.sm?7:8.5; const cls=c.red?'batr':c.blk?'batk':'batg';
      s=`${nutSVG(c,x,y,nr)}<g class="mv bat" style="transform-origin:${x}px ${y}px">${batSVG(c,x,y,L,cls)}</g>`;
      if(c.up!==''&&!c.noup) s+=labUp(x,y-L-5,c.up===undefined?'ON':c.up,{s:ls});
      if(c.dn) s+=lab(x,y+L+ls*0.95+1,c.dn,{s:ls});
      if(D(c)) s+=lab(x,y+L+ls+(c.dn?ls*1.2*String(c.dn).split('\n').length:0)+2,D(c),{s:c.s||5}); break; }
    case 'tog3': { const L=c.sm3?13:16, ls=c.s||4.2, nr=c.sm3?5.8:7; const cls=c.red?'batr':'batg';
      const inner=`${nutSVG(c,x,y,nr)}<g class="mv bat" style="transform-origin:${x}px ${y}px">${batSVG(c,x,y,L,cls)}</g>`;
      s=c.horiz?`<g transform="rotate(-90 ${x} ${y})">${inner}</g>`:inner;
      if(c.ball) s=`<circle cx="${x}" cy="${y}" r="11" class="ring0"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y-6}" r="8.5" class="ballk"/></g>`;
      const lay=c.lay||'right';
      if(c.horiz){ s+=(c.nolab?'':lab(x-L-4,y+1.5,c.vals[0],{s:ls,a:'end'})+lab(x+L+4,y+1.5,c.vals[2],{s:ls,a:'start'}))+lab(x,y+nr+ls+1,c.vals[1],{s:ls}); }
      else if(lay==='right'){ s+=lab(x+nr+3,y-L+3,c.vals[0],{s:ls,a:'start'})+(c.vals[1]?lab(x+nr+3,y+1.5,c.vals[1],{s:ls,a:'start'}):'')+lab(x+nr+3,y+L-1,c.vals[2],{s:ls,a:'start'}); }
      else if(lay==='left'){ s+=lab(x-nr-3,y-L+3,c.vals[0],{s:ls,a:'end'})+(c.vals[1]?lab(x-nr-3,y+1.5,c.vals[1],{s:ls,a:'end'}):'')+lab(x-nr-3,y+L-1,c.vals[2],{s:ls,a:'end'}); }
      else if(lay==='inv'){ s+=labUp(x,y-L-4,'INVERTER\n'+c.vals[0],{s:ls})+lab(x+nr+3,y-1,'O\nF\nF',{s:ls*0.9,a:'start'})+lab(x,y+nr+ls+1,c.vals[2],{s:ls}); }
      else if(lay==='vbr'){ s+=labUp(x,y-L-4,c.vals[0],{s:ls})+lab(x+nr+3,y-8,'B\nO\nT\nH',{s:ls*0.85,a:'start'})+lab(x,y+nr+ls+1,c.vals[2],{s:ls}); }
      if(c.dn) s+=lab(x,y+L+ls+1,c.dn,{s:ls});
      if(D(c)) s+=lab(x,y+L+11,D(c),{s:5}); break; }
    case 'guard': s=`${nutSVG(c,x,y,7)}<g class="mv bat" style="transform-origin:${x}px ${y}px">${batSVG(c,x,y,18,'batg')}</g><g class="gd" style="transform-origin:${x}px ${y+12}px"><path d="M${x-11} ${y+12}V${y-21}q0-5 5-5h12q5 0 5 5V${y+12}z" class="guardc"/><path d="M${x-7} ${y-16}h14" class="guardl"/></g>${c.nolab?'':lab(x,y-29,c.up||'ON',{s:4.6})+lab(x,y+21,c.dn||'CLOSED',{s:4.6})}${D(c)?lab(x,y+28,D(c),{s:4.6}):''}`; break;
    case 'rot': { const r=c.r||12; const knob=c.vol?`<circle cx="${x}" cy="${y}" r="${r}" class="knobk"/><path d="M${x} ${y-r*0.15}V${y-r*0.72}M${x-r*0.16} ${y-r*0.5}L${x} ${y-r*0.74}L${x+r*0.16} ${y-r*0.5}" class="volar"/><text x="${x}" y="${y+r*0.42}" class="kt" font-size="${r*0.5}" text-anchor="middle">VOL</text>`
        :c.txt?`<circle cx="${x}" cy="${y}" r="${r}" class="knobk"/><text x="${x}" y="${y+r*0.2}" class="kt" font-size="${r*0.5}" text-anchor="middle" transform="rotate(30 ${x} ${y})">${esc(c.txt)}</text>`
        :`<circle cx="${x}" cy="${y}" r="${r}" class="knob"/><circle cx="${x}" cy="${y}" r="${r-Math.min(4,r*0.3)}" class="knobtop"/><rect x="${x-Math.max(0.8,r*0.1)}" y="${y-r+1}" width="${Math.max(1.6,r*0.2)}" height="${r*0.6}" class="ptr"/>`;
      s=`<circle cx="${x}" cy="${y}" r="${r+2.5}" class="ring0"/><g class="mv rt" style="transform-origin:${x}px ${y}px">${knob}</g>`;
      if(c.top) s+=labUp(x,y-r-4.5,c.top,{s:c.s||4.2});
      if(c.bo) s+=lab(x-r*0.55,y-r-1.2,'BRT',{s:2.3,a:'end'})+lab(x+r*0.55,y-r-1.2,'OFF',{s:2.3,a:'start'});
      if(D(c)) s+=lab(x,y+r+(c.s||4.4)+2.5,D(c),{s:c.s||4.4}); break; }
    case 'enc': { const r=c.r||12; s=`<circle cx="${x}" cy="${y}" r="${r+2.5}" class="ring0"/><g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/>${Array.from({length:12},(_,i)=>{ const [a,b]=pol(x,y,r-0.5,i*30), [e,f]=pol(x,y,r-Math.min(3,r*0.3),i*30); return `<path d="M${a} ${b}L${e} ${f}" class="knurl"/>`; }).join('')}<circle cx="${x}" cy="${y}" r="${r*0.45}" class="knobtop"/><rect x="${x-0.9}" y="${y-r+1}" width="1.8" height="${r*0.45}" class="ptr"/></g>${D(c)?lab(x,y+r+7,D(c),{s:4.6}):''}`; break; }
    case 'enc2': { const r=c.r||14, ri=r*0.56; s=`<circle cx="${x}" cy="${y}" r="${r+2.5}" class="ring0"/><g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/>${Array.from({length:16},(_,i)=>{ const [a,b]=pol(x,y,r-0.5,i*22.5), [e,f]=pol(x,y,r-3,i*22.5); return `<path d="M${a} ${b}L${e} ${f}" class="knurl"/>`; }).join('')}</g><g class="mvi rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${ri}" class="knob2"/><rect x="${x-0.9}" y="${y-ri+1}" width="1.8" height="${ri*0.6}" class="ptr"/></g>`; break; }
    case 'rotsel': { const r=c.r||12; const knob=c.keyk?`<circle cx="${x}" cy="${y}" r="${r}" class="keyface"/><circle cx="${x}" cy="${y}" r="${r*0.62}" class="keycyl"/><path d="M${x-r*0.16} ${y-r*1.15}h${r*0.32}l${r*0.06} ${r*0.95}h-${r*0.44}z" class="keyblade"/><path d="M${x-r*0.42} ${y-r*1.45}q0-${r*0.25} ${r*0.42}-${r*0.25}t${r*0.42} ${r*0.25}v${r*0.27}q0 ${r*0.18}-${r*0.18} ${r*0.18}h-${r*0.48}q-${r*0.18} 0-${r*0.18}-${r*0.18}z" class="keyhead"/>`
        :c.fuelh?`<circle cx="${x}" cy="${y}" r="${r}" class="fsbase"/><path d="M${x-r*0.2} ${y+r*0.55}L${x-r*0.12} ${y-r*0.95}h${r*0.24}L${x+r*0.2} ${y+r*0.55}q0 ${r*0.2}-${r*0.2} ${r*0.2}t-${r*0.2}-${r*0.2}z" class="fshandle"/><path d="M${x} ${y-r*0.9}v${r*0.45}" stroke="#fff" stroke-width="2.2"/>`
        :c.half?`<circle cx="${x}" cy="${y}" r="${r}" class="knobk"/><path d="M${x} ${y-r}A${r} ${r} 0 0 1 ${x} ${y+r}z" class="halfw"/>`
        :c.rad?`<circle cx="${x}" cy="${y}" r="${r}" class="knobw"/><circle cx="${x}" cy="${y}" r="${r*0.68}" class="knobk"/><text x="${x}" y="${y+r*0.28}" class="kt" font-size="${r*0.72}" text-anchor="middle" font-style="italic">V</text><path d="M${x} ${y-r}v${r*0.3}" stroke="#111" stroke-width="1.6"/>`
        :c.big?`<circle cx="${x}" cy="${y}" r="${r}" class="knob"/><path d="M${x-r*0.3} ${y+r*0.9}L${x-r*0.22} ${y-r*0.92}h${r*0.44}L${x+r*0.3} ${y+r*0.9}z" class="selbar"/><path d="M${x} ${y-r*0.9}v${r*0.6}" stroke="#eee" stroke-width="1.4"/>`
        :`<circle cx="${x}" cy="${y}" r="${r}" class="knob"/><path d="M${x-3} ${y+r-2}L${x} ${y-r+2}L${x+3} ${y+r-2}z" class="ptrbar"/>`;
      s=`<circle cx="${x}" cy="${y}" r="${r+2}" class="ring0"/>${c.vals.map((v,i)=>{ const a=c.ang[i]; const ln=Math.max(...v.replace(' & ','\n& ').replace('MAN ','MAN\n').split('\n').map(t=>t.length)); const [px,py]=pol(x,y,(c.lr||r+4)+(c.s||4.4)*(Math.abs(Math.sin(a*Math.PI/180))*ln*0.34+0.8),a); return v?lab(px,py+(c.s||4.4)*0.36,v.replace(' & ','\n& ').replace('MAN ','MAN\n'),{s:c.s||4.4}):''; }).join('')}<g class="mv rt" style="transform-origin:${x}px ${y}px">${knob}</g>${D(c)?lab(x,y+r+(c.dy0||10),D(c),{s:c.ds||5}):''}`; break; }
    case 'push': { const r=c.r||10; s=`<circle cx="${x}" cy="${y}" r="${r+2}" class="ring0"/><g class="mv pb"><circle cx="${x}" cy="${y}" r="${r}" class="${c.red?'pbtnr':c.org?'pbtno':'pbtn'}"/><circle cx="${x-r*0.3}" cy="${y-r*0.35}" r="${r*0.35}" class="spec"/></g>`+(D(c)?(c.side?lab(x+r+3,y+1.4,D(c),{s:c.s||4.6,a:'start'}):lab(x,y+r+(c.s||4.6)+1.5,D(c),{s:c.s||4.6})):''); break; }
    case 'bar': { const w=c.w,h=c.h; s=`<g class="mv pb"><path d="M${x-w/2} ${y-h/2}h${w}l-6 ${h}h-${w-12}z" class="gangb"/><text x="${x}" y="${y+2.8}" class="pl" font-size="8.4" text-anchor="middle">${esc(D(c))}</text></g>`; break; }
    case 'mbtn': { const w=c.w, h=c.h, f=Math.min(h*0.3,w/Math.max(c.l1.length,c.l2.length)/0.62,6.6); s=`<rect x="${x-w/2-3}" y="${y-h/2-3}" width="${w+6}" height="${h+6+(c.sub?7:0)}" rx="2.5" class="bezel1"/><g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="2" class="mb mb-${c.col}"/><text x="${x}" y="${y-h*0.06}" class="mbt" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(c.l1)}</text><text x="${x}" y="${y+h*0.32}" class="mbt" font-size="${(c.sub?f:f*0.78).toFixed(2)}" text-anchor="middle">${esc(c.l2)}</text></g>${c.sub?`<text x="${x}" y="${y+h/2+6}" class="pl" font-size="3.6" text-anchor="middle">${esc(c.sub)}</text>`:''}`; break; }
    case 'abtn': { const w=c.bw||(c.sm?13:c.l.length>4?36:30), h=c.bh||(c.sm?7:18); const ls=String(c.l).split('\n'), fs=c.sm?3.6:Math.min(c.l.length>4&&ls.length<2?5.4:6.4,w/(Math.max(...ls.map(t=>t.length))*0.66)), y0=y+(c.sm?2.6:h*0.3)-(ls.length-1)*fs*0.55;
      s=`<g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="${c.sm?1.5:2.5}" class="abtn"/><rect class="aled" x="${x-w*0.2}" y="${y-h/2+1.2}" width="${w*0.4}" height="${c.sm?1.4:2.2}" rx="0.8"/>${ls.map((t,i)=>`<text x="${x}" y="${(y0+i*fs*1.1).toFixed(1)}" class="pl" font-size="${fs.toFixed(2)}" text-anchor="middle">${esc(t)}</text>`).join('')}</g>`; break; }
    case 'key': { const w=c.w||16, h=c.h||12;
      if(c.lamp){ const ls=[c.l1,c.l2,c.l3].filter(Boolean); const f=Math.min(h/(ls.length+0.5),w/(Math.max(...ls.map(t=>t.length))*0.64)); const y0=y-(ls.length-1)*f*0.55+f*0.36;
        s=`<rect x="${x-w/2-2}" y="${y-h/2-2}" width="${w+4}" height="${h+4}" rx="3" class="lampb"/><g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="2" class="lk lk-${c.lamp}"/>${ls.map((t,i)=>`<text x="${x}" y="${(y0+i*f*1.1).toFixed(1)}" class="lkt lkt-${c.lamp}" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(t)}</text>`).join('')}</g>`; break; }
      if(c.round){ s=`<circle cx="${x}" cy="${y}" r="${w/2+1.5}" class="ring0"/><g class="mv pb"><circle cx="${x}" cy="${y}" r="${w/2}" class="keyr"/></g>`; break; }
      const f=Math.min(h*0.62,w/(Math.max(1,c.l.length)*0.62),6);
      s=`<g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="1.5" class="${c.kw?'keyw':c.kg?'keyg':'keyo'}"/>${c.led?`<rect x="${x-w/2+1.5}" y="${y-h/2+1}" width="${w-3}" height="1.3" rx=".6" class="kled"/>`:''}<text x="${x}" y="${(y+f*0.36+(c.led?0.5:0)).toFixed(1)}" class="kt" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(c.l)}</text></g>`; break; }
    case 'lbtn': { const w=c.w, h=c.h, f=Math.min(h*0.3,w/(c.l1.length*0.6)); s=`<rect x="${x-w/2-2}" y="${y-h/2-2}" width="${w+4}" height="${h+4}" rx="3" class="lampb"/><g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="2" class="lk"/><text x="${x}" y="${y-h*0.1}" class="lkt lkt-w" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(c.l1)}</text><text x="${x-w*0.24}" y="${y+h*0.32}" class="lkt lkt-${c.ca} lba" font-size="${(f*0.95).toFixed(2)}" text-anchor="middle">${esc(c.a)}</text><text x="${x+w*0.24}" y="${y+h*0.32}" class="lkt lkt-${c.cb} lbb" font-size="${(f*0.95).toFixed(2)}" text-anchor="middle">${esc(c.b)}</text></g>`; break; }
    case 'gear': s=`<rect x="${x-11}" y="${y-37}" width="22" height="74" rx="6" class="slot"/><rect x="${x-6}" y="${y-30}" width="12" height="60" rx="2" class="slot2"/>${lab(x+22,y-24,'↑ UP',{s:5})}${lab(x+22,y+13,'↓ DN',{s:5})}<g class="mv gk"><rect x="${x-2.2}" y="${y-30}" width="4.4" height="30" class="rod"/><rect x="${x-10}" y="${y-44}" width="20" height="30" rx="7" class="wheelk"/>${[0,1,2,3,4,5].map(i=>`<path d="M${x-7+i*2.8} ${y-41}v24" class="wheelr"/>`).join('')}<ellipse class="gl gU" cx="${x}" cy="${y-36}" rx="4.5" ry="2.6"/></g>`; break;
    case 'flap': { const n=c.vals.length, sp=c.sp||30, y0=y-(n-1)*sp/2; s=`<rect x="${x-8}" y="${y0-12}" width="16" height="${(n-1)*sp+24}" rx="7" class="slot"/>${c.vals.map((v,i)=>`<path d="M${x+11} ${y0+i*sp}h7" class="tick"/>`+lab(x+21,y0+i*sp+2,v,{s:c.s||5.4,a:'start'})).join('')}<g class="mv fk"><rect x="${x-15}" y="${y0-7}" width="30" height="14" rx="4" class="flapk"/><path d="M${x-11} ${y0}h22" class="flapl"/><rect x="${x-3}" y="${y0-7}" width="6" height="14" class="flapw"/></g>${c.d?lab(x,y0+(n-1)*sp+26,c.d,{s:c.s||5.4}):''}`; break; }
    case 'cb': { const r=c.big?9:6.2, fs=c.fs||3.6; s=`<circle cx="${x}" cy="${y}" r="${r+1.6}" class="cbcol"/><g class="mv cbk"><circle cx="${x}" cy="${y}" r="${r}" class="cbh"/><circle cx="${x}" cy="${y}" r="${r*0.62}" class="cbh2"/>${c.amp?`<text x="${x}" y="${y+fs*0.4}" class="cbt" font-size="${c.big?5:fs*0.95}" text-anchor="middle">${esc(c.amp)}</text>`:''}</g>`;
      if(c.la) s+=labUp(x,y-r-2.6,c.la,{s:fs}); if(c.lb) s+=lab(x,y+r+fs+1.2,c.lb,{s:fs}); break; }
    case 'pull': { const r=c.r||11; s=c.tee?`<rect x="${x-4}" y="${y-8}" width="8" height="8" class="slot"/><g class="mv pk" style="transform-origin:${x}px ${y}px"><rect x="${x-14}" y="${y-2}" width="28" height="9" rx="4" class="tee"/><rect x="${x-2}" y="${y-7}" width="4" height="7" class="rod"/></g>`
        :`<circle cx="${x}" cy="${y}" r="${r+2}" class="ring0"/><circle cx="${x}" cy="${y}" r="${r+0.5}" class="pullring"/><g class="mv pk" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r*0.82}" class="pullk"/><circle cx="${x}" cy="${y}" r="${r*0.32}" class="knobtop"/></g>`;
      if(c.top) s+=labUp(x,y-r-5,c.top,{s:4.4})+`<path d="M${x} ${y-r-4}v2.5" class="grpl"/>`; if(c.dn) s+=`<path d="M${x} ${y+r+1.5}v2.5" class="grpl"/>`+lab(x,y+r+8.5,c.dn,{s:4.4});
      if(D(c)) s+=lab(x,y+r+(c.s||4.6)+3,D(c),{s:c.s||4.6}); break; }
    case 'vwheel': s=`<rect x="${x-14}" y="${y-58}" width="28" height="116" rx="8" class="slot"/><svg x="${x-10}" y="${y-54}" width="20" height="108" overflow="hidden"><g class="mv wr">${Array.from({length:36},(_,i)=>`<rect x="0" y="${i*6-54}" width="20" height="3" rx="1" class="ridge"/>`).join('')}</g></svg><path d="M${x+16} ${y}h7" class="tomark"/>${lab(x+18,y-6,'T/O',{s:4.6,a:'start'})}${c.nolab?'':lab(x,y-62,'DN',{s:4.6})+lab(x,y+66,'UP',{s:4.6})}<path class="mv trind" d="M${x-24} ${y}l6-4v8z"/>`; break;
    case 'hwheel': s=`<rect x="${x-40}" y="${y-8}" width="80" height="16" rx="7" class="slot"/><svg x="${x-36}" y="${y-5}" width="72" height="10" overflow="hidden"><g class="mv wr">${Array.from({length:26},(_,i)=>`<rect y="0" x="${i*6-42}" width="3" height="10" rx="1" class="ridge"/>`).join('')}</g></svg><path d="M${x} ${y-10}v-5" class="tomark"/><path class="mv trind" d="M${x} ${y+10}l-4 6h8z"/>${lab(x-44,y+2,'L',{s:5,a:'end'})}${lab(x+44,y+2,'R',{s:5,a:'start'})}${lab(x,y+24,'RUDDER TRIM',{s:4.4})}`; break;
    case 'lev': if(c.kind==='pp'){ const L=c.len, r=c.r||13, red=c.red;
        const knob=red?`<circle cx="${x}" cy="${y}" r="${r}" class="ppR"/>${Array.from({length:18},(_,i)=>{ const [a,b]=pol(x,y,r-0.4,i*20), [e,f]=pol(x,y,r-2.6,i*20); return `<path d="M${a} ${b}L${e} ${f}" class="ppKnurl"/>`; }).join('')}<circle cx="${x}" cy="${y}" r="${r*0.55}" class="ppRtop"/>`
          :`<circle cx="${x}" cy="${y}" r="${r}" class="ppK"/><circle cx="${x}" cy="${y}" r="${r*0.72}" class="ppKtop"/><circle cx="${x-r*0.3}" cy="${y-r*0.35}" r="${r*0.22}" class="spec"/>`;
        s=`<circle cx="${x}" cy="${y}" r="${r*0.62}" class="ppBush"/><svg x="${x-r-3}" y="${y-r-2}" width="${2*r+6}" height="${L+2*r+6}" overflow="hidden"><g transform="translate(${-(x-r-3)} ${-(y-r-2)})"><g class="mv lv"><rect x="${x-3}" y="${y-L-4}" width="6" height="${L+4}" class="ppShaft"/>${knob}</g></g></svg>${c.top?labUp(x,y-r-6,c.top,{s:c.s||5.4}):''}${c.side?lab(x+r+6,y+3,c.side,{s:c.s2||4.2,a:'start'}):''}`; break; }
    case 'lev': { const L=c.len, ly=v=>y+(c.max-v)/(c.max-c.min)*L; const hw=c.kind==='pwr'?14:11;
      const knob=c.kind==='pwr'?`<path d="M${x-hw} ${y-6}q0-7 7-7h${2*hw-14}q7 0 7 7v6q0 6-6 6h-${2*hw-12}q-6 0-6-6z" class="lever"/><path d="M${x-hw+5} ${y-5}h${2*hw-10}M${x-hw+5} ${y-1}h${2*hw-10}M${x-hw+5} ${y+3}h${2*hw-10}" class="grip"/>`
        :c.kind==='prop'?`<rect x="${x-hw}" y="${y-9}" width="${2*hw}" height="16" rx="3" class="levP"/><path d="M${x-hw+4} ${y-4}h${2*hw-8}M${x-hw+4} ${y}h${2*hw-8}" class="gripP"/>`
        :`<path d="M${x-hw} ${y-6}q0-4 4-4h${2*hw-8}q4 0 4 4v9h-${2*hw}z" class="levC"/><path d="M${x-hw+3} ${y-1}h${2*hw-6}" class="gripP"/>`;
      s=`<rect x="${x-5}" y="${y-10}" width="10" height="${L+20}" rx="4" class="slot"/>${c.mk?c.marks.map(([v,t])=>`<path d="M${x-20} ${ly(v)}h8" class="tick"/>${lab(x-22,ly(v)+1.6,t,{s:4.2,a:'end'})}`).join(''):''}<g class="mv lv"><rect x="${x-2.2}" y="${y}" width="4.4" height="14" class="rod"/>${knob}</g>${lab(x,y+L+18,c.l.slice(-1),{s:5.4})}`; break; }
    case 'yoke': if(c.ces){ const X=x, Y=y;
        /* Cessna ram's-horn control wheel seen from the seat: centre hub with a plate, arms drooping out to upturned horn grips */
        const half=`M0 -24H44C84 -24 112 -18 130 -30L140 -80Q144 -98 160 -98Q178 -98 182 -80L190 6Q192 34 166 38C128 44 88 34 46 28H0Z`;
        const grip=`M138 -72L142 -84Q146 -96 160 -96Q176 -96 180 -82L186 -10Q170 -2 148 -6Z`;
        const ribs=[0,1,2,3,4,5,6].map(i=>`<path d="M${141+i*0.6} ${-66+i*9}h${40-i*0.4}" class="ykRib"/>`).join('');
        const side=k=>`<g transform="scale(${k} 1)"><path d="${half}" class="ykC"/><path d="${grip}" class="ykG"/>${ribs}<path d="M48 -16C86 -16 112 -12 128 -20" class="ykHi"/></g>`;
        s=`<g class="mv skg" style="transform-origin:${X}px ${Y}px"><g transform="translate(${X} ${Y})">${side(1)}${side(-1)}<rect x="-46" y="-32" width="92" height="62" rx="14" class="ykPl"/><rect x="-32" y="-20" width="64" height="30" rx="5" class="ykEm"/><circle cx="0" cy="-5" r="6" class="ykHub"/><rect x="${c.id==='yokeL'?-167:155}" y="-101" width="12" height="7" rx="2.5" class="ykBtn"/></g></g>`; break; }
    case 'yoke': { const X=x, R=56, sh=c.co?-1:1; let bolts=''; for(let k=0;k<8;k++){ const [bx,by]=pol(X,y,R*0.8,k*45+22.5); bolts+=`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="3.4" class="ykb"/>`; }
      s=`<path d="M${X+sh*14} ${y-50}L${X+sh*70} ${y-96}L${X+sh*104} ${y-62}L${X+sh*48} ${y+8}Z" class="ykshaft"/><ellipse cx="${X+sh*87}" cy="${y-79}" rx="24" ry="28" transform="rotate(${sh*-42} ${X+sh*87} ${y-79})" class="ykshaft2"/><g class="mv skg" style="transform-origin:${X}px ${y}px"><circle cx="${X}" cy="${y}" r="${R+4}" class="ykrim"/><circle cx="${X}" cy="${y}" r="${R}" class="ykf"/>${bolts}<path d="M${X-33} ${y-33}L${X+33} ${y+33}M${X+33} ${y-33}L${X-33} ${y+33}" class="ykx"/><rect x="${X-22}" y="${y-22}" width="44" height="44" rx="6" class="ykp"/><circle cx="${X}" cy="${y}" r="14" class="ykh"/><circle cx="${X}" cy="${y}" r="5" class="ykb"/></g>`; break; }
    case 'sbtn': { const r=c.r||5; s=`<g class="mv sbm" style="transform-origin:${x}px ${y}px"><circle cx="${x+c.dx}" cy="${y+c.dy}" r="${r}" fill="${c.col}" stroke="#000"/></g>`; break; }
  }
  const role=({tog:'switch',guard:'switch',push:'button',bar:'button',mbtn:'button',abtn:'button',key:'button',lbtn:'button',cb:'switch',pull:'switch',gear:'switch',sbtn:'button',yoke:'application'})[c.t]||'slider';
  if(c.rot) s=`<g transform="rotate(${c.rot} ${x} ${y})">${s}</g>`;
  if(c.mt) s=`<g transform="${c.mt}">${s}</g>`;
  return `<g class="ctl t-${c.t}${c.dk?' dk':''}${c.soft?' soft':''}" data-id="${c.id}" tabindex="0" role="${role}" aria-label="${esc(c.lbl||c.l)}">${s}</g>`;
}

/* ---------- round gauges ---------- */
const GA={};
function dial(id,x,y,r,o){
  GA[id]={x,y,r,sc:o.sc};
  let t=o.bz==='none'?`<circle cx="${x}" cy="${y}" r="${r}" class="dial"/>`:`${o.ears?[-1,1].map(k=>`<circle cx="${x+k*r*0.92}" cy="${y-r*0.82}" r="${r*0.2}" class="ear"/>`).join(''):''}<circle cx="${x}" cy="${y}" r="${r+6}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r+2.5}" class="sbz2"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>`;
  o.sc.forEach(sc=>{ const A=v=>angOf(sc,v);
    (sc.arcs||[]).forEach(([a,b,cls,rf])=>{ const rr=(rf||1)*r-2.5; const [x0,y0]=pol(x,y,rr,A(a)), [x1,y1]=pol(x,y,rr,A(b)); const big=Math.abs(A(b)-A(a))>180?1:0, sw=A(b)>A(a)?1:0; t+=`<path d="M${x0} ${y0}A${rr} ${rr} 0 ${big} ${sw} ${x1} ${y1}" class="${cls}" style="stroke-width:${Math.max(2.5,r*0.08)}px"/>`; });
    if(sc.mnr) for(let v=sc.min; v<=sc.max+1e-6; v+=sc.mnr){ const a=A(v); const maj=sc.maj&&Math.abs(v/sc.maj-Math.round(v/sc.maj))<1e-6; const L=maj?r*0.16:r*0.08; const [a0,b0]=pol(x,y,r,a), [a1,b1]=pol(x,y,r-L,a); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" class="dtick" style="stroke-width:${maj?1.3:0.8}px"/>`;
      if(maj&&sc.lab&&!sc.nolab){ const s=sc.lab(v); if(s!==null&&s!==undefined){ const [lx,ly]=pol(x,y,r*(sc.lr||0.68),a); t+=`<text x="${lx}" y="${ly+r*0.07}" class="dnum" font-size="${(sc.fs||0.19)*r}" text-anchor="middle">${s}</text>`; } } }
    (sc.red||[]).forEach(v=>{ const [a0,b0]=pol(x,y,r,A(v)), [a1,b1]=pol(x,y,r-r*0.22,A(v)); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" class="redl" style="stroke-width:${Math.max(2,r*0.06)}px"/>`; });
    (sc.dash||[]).forEach(v=>{ const [a0,b0]=pol(x,y,r,A(v)), [a1,b1]=pol(x,y,r-r*0.22,A(v)); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" class="redl" stroke-dasharray="2 1.5" style="stroke-width:${Math.max(2,r*0.06)}px"/>`; });
  });
  if(o.title) t+=lab0(x,y+r*(o.ty||0.42),o.title,r*(o.tfs||0.15),o.tc);
  if(o.unit) t+=lab0(x,y+r*(o.uy||0.6),o.unit,r*(o.ufs||0.12),o.tc);
  if(o.dig) t+=`<rect x="${x-r*0.36}" y="${y-r*0.84}" width="${r*0.72}" height="${r*0.27}" rx="1.5" class="digw"/><text class="dig dg-${id}" x="${x}" y="${y-r*0.63}" font-size="${r*0.21}" text-anchor="middle">0</text>`;
  if(o.extra) t+=o.extra;
  o.sc.forEach(sc=>{ if(sc.nond) return; const L=sc.nl||r-5; t+=`<g class="nd nd-${id}${sc.nd||''}" style="transform-origin:${x}px ${y}px;transform:rotate(${angOf(sc,sc.min)}deg)"><path d="M${x-r*0.035} ${y+r*0.12}L${x-r*0.02} ${y-L+4}L${x} ${y-L}L${x+r*0.02} ${y-L+4}L${x+r*0.035} ${y+r*0.12}z" class="needle ${sc.ncls||''}"/></g>`; });
  t+=`<circle cx="${x}" cy="${y}" r="${o.hub||r*0.07}" class="hub"/>`;
  return `<g class="gauge" data-g="${id}">${t}</g>`;
}
function lab0(x,y,t,fs,cls){ return String(t).split('\n').map((ln,i)=>`<text x="${x}" y="${y+i*fs*1.15}" class="dnum dt ${cls||''}" font-size="${fs}" text-anchor="middle">${esc(ln)}</text>`).join(''); }
function angOf(sc,v){ const f=sc.f?sc.f(v):(clamp(v,sc.min,sc.max)-sc.min)/(sc.max-sc.min); return sc.a0+f*(sc.a1-sc.a0); }

/* ---------- instruments ---------- */
/* 3 1/8" instrument behind a round panel cut-out: black bezel ring and four mounting screws on the panel */
function sqcase(cx,cy,w,h,r){ const R=w/2-8, k=w/2-6; return `<circle cx="${cx}" cy="${cy}" r="${R+2}" class="ihole"/><circle cx="${cx}" cy="${cy}" r="${R}" class="icase"/>${[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b])=>`<circle cx="${(cx+a*k).toFixed(1)}" cy="${(cy+b*k).toFixed(1)}" r="3.2" class="cscr"/><path d="M${(cx+a*k-2).toFixed(1)} ${(cy+b*k-1).toFixed(1)}l4 2" class="cscrs"/>`).join('')}`; }
function rcase(cx,cy,r){ return `<circle cx="${cx}" cy="${cy}" r="${r+9}" class="ihole"/><circle cx="${cx}" cy="${cy}" r="${r+7}" class="icase"/>${[45,135,225,315].map(a=>{ const [x,y]=pol(cx,cy,r+13,a); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" class="cscr"/>`; }).join('')}`; }
const nd=(cls,x,y,path,extra)=>`<g class="ndx ${cls}" style="transform-origin:${x}px ${y}px">${path}</g>${extra||''}`;
function card(x,y,r,cls,o){ o=o||{}; let t=''; for(let d=0;d<360;d+=5){ const L=d%30===0?r*0.16:d%10===0?r*0.11:r*0.06; const [a0,b0]=pol(x,y,r,d),[a1,b1]=pol(x,y,r-L,d); t+=`<path d="M${a0.toFixed(1)} ${b0.toFixed(1)}L${a1.toFixed(1)} ${b1.toFixed(1)}" stroke="${o.col||'#f2f2f2'}" stroke-width="${d%10?0.8:1.3}"/>`; if(d%30===0){ const [lx,ly]=pol(x,y,r*0.7,d); const s={0:'N',90:'E',180:'S',270:'W'}[d]||d/10; t+=`<text x="${lx.toFixed(1)}" y="${(ly+r*0.06).toFixed(1)}" fill="${o.col||'#f2f2f2'}" font-size="${(r*(d%90?0.15:0.19)).toFixed(1)}" font-weight="700" text-anchor="middle" font-family="IBM Plex Sans,system-ui,sans-serif" transform="rotate(${d} ${lx.toFixed(1)} ${ly.toFixed(1)})">${s}</text>`; } } return `<g class="${cls}" style="transform-origin:${x}px ${y}px">${t}</g>`; }
/* airspeed indicator: knots, white / green / yellow arcs and red line */
function asiSVG(x,y,r){ return sqcase(x,y,156,156,10)+dial('asi',x,y,r,{bz:'none',sc:[{min:30,max:170,a0:12,a1:348,maj:20,mnr:5,lab:v=>v>=40&&v<=160?v:null,fs:0.15,lr:0.66,
  arcs:[[33,85,'awhite',0.88],[44,127,'agreen'],[127,158,'ayellow']],red:[158]}],title:'AIRSPEED',ty:-0.14,tfs:0.1,unit:'KNOTS',uy:0.22,ufs:0.11}); }
/* attitude indicator (vacuum): bank scale on the moving sky/ground card, fixed index, adjustable miniature airplane */
function aiSVG(x,y,r){ let lad=''; [[-20,0.44],[-10,0.44],[-5,0.2],[5,0.2],[10,0.44],[20,0.44]].forEach(([p,w])=>{ const yy=y-p*r*0.03; lad+=`<path d="M${x-w*r/2} ${yy}h${w*r}" stroke="#fff" stroke-width="1.5"/>${Math.abs(p)%10?'':`<text x="${x+w*r/2+4}" y="${yy+3}" fill="#fff" font-size="${r*0.12}" font-family="IBM Plex Sans,sans-serif" font-weight="700">${Math.abs(p)}</text>`}`; });
  let ring=''; [-60,-30,-20,-10,10,20,30,60].forEach(b=>{ const [a0,b0]=pol(x,y,r*0.98,b), [a1,b1]=pol(x,y,r*(Math.abs(b)%30?0.88:0.84),b); ring+=`<path d="M${a0.toFixed(1)} ${b0.toFixed(1)}L${a1.toFixed(1)} ${b1.toFixed(1)}" stroke="#fff" stroke-width="${Math.abs(b)%30?1.6:2.6}"/>`; });
  [-45,45].forEach(b=>{ const [a0,b0]=pol(x,y,r*0.97,b); ring+=`<path d="M${a0.toFixed(1)} ${b0.toFixed(1)}l${(-Math.cos(b*Math.PI/180)*4).toFixed(1)} ${(6).toFixed(1)}h${(Math.cos(b*Math.PI/180)*8).toFixed(1)}z" fill="#fff" transform="rotate(${b} ${a0.toFixed(1)} ${b0.toFixed(1)})"/>`; });
  ring+=`<path d="M${x} ${y-r*0.84}l-5 -9h10z" fill="#fff"/>`;
  return sqcase(x,y,156,156,10)+`<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+3}" class="sbz2"/><clipPath id="cAIo"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><clipPath id="cAIi"><circle cx="${x}" cy="${y}" r="${r*0.82}"/></clipPath>
  <g clip-path="url(#cAIo)"><g class="att att-ai" style="transform-origin:${x}px ${y}px"><path d="M${x-r} ${y}A${r} ${r} 0 0 1 ${x+r} ${y}z" fill="#4f86c6"/><path d="M${x-r} ${y}A${r} ${r} 0 0 0 ${x+r} ${y}z" fill="#6b4a2c"/>${ring}
   <g clip-path="url(#cAIi)"><g class="attp attp-ai"><rect x="${x-r*2}" y="${y-r*2.2}" width="${r*4}" height="${r*2.2}" fill="#5b95d6"/><rect x="${x-r*2}" y="${y}" width="${r*4}" height="${r*2.2}" fill="#7a5532"/><path d="M${x-r*2} ${y}h${r*4}" stroke="#fff" stroke-width="2"/>${lad}</g></g></g></g>
  <path d="M${x} ${y-r+1}l-6 11h12z" fill="#ff8a1a" stroke="#000" stroke-width=".6"/>
  <g class="aip" style="transform-origin:${x}px ${y}px"><path d="M${x-r*0.62} ${y}h${r*0.36}l${r*0.12} ${r*0.12}l${r*0.14} -${r*0.12}h${r*0.0}M${x+r*0.62} ${y}h-${r*0.36}l-${r*0.12} ${r*0.12}l-${r*0.14} -${r*0.12}" class="acsym"/><circle cx="${x}" cy="${y}" r="2.6" fill="#ff8a1a"/></g>
  <path d="M${x-r*0.95} ${y+r*0.55}Q${x} ${y+r*1.25} ${x+r*0.95} ${y+r*0.55}L${x+r} ${y+r}H${x-r}z" fill="#1d1b1c" opacity=".0"/>
  <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#000" stroke-width="2"/></g>`; }
/* altimeter: three pointers, Kollsman window (inHg) and millibar window */
function altSVG(x,y,r){ const face=dial('alt',x,y,r,{bz:'none',sc:[{min:0,max:1000,a0:0,a1:360,maj:100,mnr:20,lab:v=>v<1000?v/100:null,fs:0.2,lr:0.7,nond:1}],title:'ALT',ty:-0.42,tfs:0.09,unit:'100 FEET',uy:-0.32,ufs:0.07,hub:1,
   extra:`<rect x="${x+r*0.3}" y="${y-r*0.12}" width="${r*0.46}" height="${r*0.22}" rx="1.5" class="drumw"/><text class="dig2 kol-alt" x="${x+r*0.53}" y="${y+r*0.05}" font-size="${r*0.15}" text-anchor="middle">29.92</text><rect x="${x-r*0.76}" y="${y-r*0.12}" width="${r*0.46}" height="${r*0.22}" rx="1.5" class="drumw"/><text class="dig2 kolmb-alt" x="${x-r*0.53}" y="${y+r*0.05}" font-size="${r*0.15}" text-anchor="middle">1013</text><text x="${x}" y="${y+r*0.42}" class="dnum" font-size="${r*0.08}" text-anchor="middle">CALIBRATED TO</text><text x="${x}" y="${y+r*0.52}" class="dnum" font-size="${r*0.08}" text-anchor="middle">20,000 FEET</text>`});
  const T=nd('nd-altT',x,y,`<path d="M${x-0.9} ${y}V${y-r*0.9}h1.8V${y}z" fill="#f2f2f2"/><path d="M${x} ${y-r*0.98}l-4.5 9h9z" fill="#f2f2f2"/>`);
  const K=nd('nd-altK',x,y,`<path d="M${x-3.4} ${y+r*0.1}L${x-3.8} ${y-r*0.4}L${x} ${y-r*0.52}L${x+3.8} ${y-r*0.4}L${x+3.4} ${y+r*0.1}z" fill="#f2f2f2" stroke="#000" stroke-width=".5"/>`);
  const Hh=nd('nd-altH',x,y,`<path d="M${x-2} ${y+r*0.16}L${x-1.6} ${y-r*0.82}L${x} ${y-r*0.92}L${x+1.6} ${y-r*0.82}L${x+2} ${y+r*0.16}z" fill="#f2f2f2" stroke="#000" stroke-width=".5"/>`);
  return sqcase(x,y,156,156,10)+face.replace(/<\/g>$/,'')+T+K+Hh+`<circle cx="${x}" cy="${y}" r="4" class="hub"/></g>`; }
/* turn coordinator (electric) */
function tcSVG(x,y,r){ const mk=(a)=>{ const [a0,b0]=pol(x,y,r*0.98,a), [a1,b1]=pol(x,y,r*0.8,a); return `<path d="M${a0.toFixed(1)} ${b0.toFixed(1)}L${a1.toFixed(1)} ${b1.toFixed(1)}" stroke="#fff" stroke-width="3"/>`; };
  return sqcase(x,y,156,156,10)+`<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+3}" class="sbz2"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${mk(-90)}${mk(90)}${mk(-105)}${mk(105)}
  <text x="${x-r*0.72}" y="${y+r*0.42}" class="dnum" font-size="${r*0.16}" text-anchor="middle">L</text><text x="${x+r*0.72}" y="${y+r*0.42}" class="dnum" font-size="${r*0.16}" text-anchor="middle">R</text>
  <text x="${x}" y="${y-r*0.52}" class="dnum" font-size="${r*0.11}" text-anchor="middle">TURN COORDINATOR</text><text x="${x}" y="${y+r*0.33}" class="dnum" font-size="${r*0.11}" text-anchor="middle">2 MIN</text>
  <g class="tcp tcp-tc" style="transform-origin:${x}px ${y}px"><rect x="${x-r*0.7}" y="${y-1.8}" width="${r*1.4}" height="3.6" rx="1.2" fill="#f2f2f2"/><circle cx="${x}" cy="${y}" r="${r*0.1}" fill="#f2f2f2"/><rect x="${x-1.6}" y="${y-r*0.24}" width="3.2" height="${r*0.16}" fill="#f2f2f2"/><rect x="${x-r*0.16}" y="${y-r*0.2}" width="${r*0.32}" height="2.4" fill="#f2f2f2"/></g>
  <path d="M${x-r*0.46} ${y+r*0.5}Q${x} ${y+r*0.72} ${x+r*0.46} ${y+r*0.5}" class="balltube" stroke-width="${r*0.16}" fill="none" stroke-linecap="round"/><path d="M${x-r*0.07} ${y+r*0.53}v${r*0.14}M${x+r*0.07} ${y+r*0.53}v${r*0.14}" stroke="#111" stroke-width="1"/>
  <circle class="ball ball-tc" cx="${x}" cy="${y+r*0.6}" r="${r*0.075}" fill="#111" stroke="#444" stroke-width=".6"/>
  <text x="${x}" y="${y+r*0.86}" class="dnum" font-size="${r*0.075}" text-anchor="middle">NO PITCH INFORMATION</text><text x="${x-r*0.5}" y="${y-r*0.28}" class="dnum" font-size="${r*0.08}" text-anchor="middle">D.C.</text><text x="${x-r*0.5}" y="${y-r*0.18}" class="dnum" font-size="${r*0.08}" text-anchor="middle">ELEC.</text>
  <g class="tcflag" style="opacity:0"><rect x="${x+r*0.24}" y="${y-r*0.36}" width="${r*0.42}" height="${r*0.2}" fill="#d0281c" stroke="#000" stroke-width=".6"/><text x="${x+r*0.45}" y="${y-r*0.22}" font-size="${r*0.13}" fill="#fff" font-weight="700" text-anchor="middle" font-family="IBM Plex Sans,sans-serif">OFF</text></g></g>`; }
/* heading indicator (directional gyro): rotating card, fixed airplane */
function dgSVG(x,y,r){ let lub=''; [45,135,225,315].forEach(a=>{ const [a0,b0]=pol(x,y,r+1,a),[a1,b1]=pol(x,y,r-7,a); lub+=`<path d="M${a0.toFixed(1)} ${b0.toFixed(1)}L${a1.toFixed(1)} ${b1.toFixed(1)}" stroke="#ff8a1a" stroke-width="2.4"/>`; });
  return sqcase(x,y,156,156,10)+`<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+3}" class="sbz2"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${card(x,y,r-2,'hcard hcard-dg')}${lub}
  <path d="M${x} ${y-r-1}l-4 8h8z" fill="#ff8a1a"/><path d="M${x} ${y-r*0.42}l3 6v8l${r*0.24} ${r*0.16}v4l-${r*0.24}-${r*0.08}v${r*0.18}l7 5v3l-10-3-10 3v-3l7-5v-${r*0.18}l-${r*0.24} ${r*0.08}v-4l${r*0.24}-${r*0.16}v-8z" fill="#ff8a1a" stroke="#000" stroke-width=".5"/></g>`; }
/* vertical speed indicator */
function vsiSVG(x,y,r){ return sqcase(x,y,156,156,10)+dial('vsi',x,y,r,{bz:'none',sc:[{min:-2000,max:2000,a0:-260,a1:80,maj:500,mnr:100,lab:v=>v===0?'0':Math.abs(v)/100,fs:0.16,lr:0.68}],
  extra:`<text x="${x+r*0.3}" y="${y-r*0.2}" class="dnum" font-size="${r*0.085}" text-anchor="middle">VERTICAL SPEED</text><text x="${x+r*0.3}" y="${y+r*0.27}" class="dnum" font-size="${r*0.07}" text-anchor="middle">100 FEET PER MINUTE</text><text x="${x-r*0.3}" y="${y-r*0.2}" class="dnum" font-size="${r*0.1}" text-anchor="middle">UP</text><text x="${x-r*0.3}" y="${y+r*0.3}" class="dnum" font-size="${r*0.1}" text-anchor="middle">DOWN</text>`}); }
/* engine and electrical gauges */
function tachSVG(x,y,r){ return rcase(x,y,r)+dial('tach',x,y,r,{bz:'none',sc:[{min:0,max:3500,a0:-135,a1:135,maj:500,mnr:100,lab:v=>v/100,fs:0.16,lr:0.68,arcs:[[2100,2700,'agreen']],red:[2700]}],title:'RPM',ty:-0.3,tfs:0.12,unit:'X 100',uy:-0.16,ufs:0.1,
  extra:`<rect x="${x-r*0.36}" y="${y+r*0.3}" width="${r*0.72}" height="${r*0.2}" rx="1.5" class="drumw"/><text class="dig2 hrs-tach" x="${x}" y="${y+r*0.45}" font-size="${r*0.15}" text-anchor="middle">1234.5</text><text x="${x}" y="${y+r*0.62}" class="dnum" font-size="${r*0.08}" text-anchor="middle">HOURS</text>`}); }
function suctionSVG(x,y,r){ return rcase(x,y,r)+dial('suct',x,y,r,{bz:'none',sc:[{min:0,max:10,a0:-125,a1:125,maj:2,mnr:1,lab:v=>v,fs:0.2,lr:0.66,arcs:[[4.5,5.4,'agreen']]}],title:'SUCTION',ty:0.36,tfs:0.13,unit:'IN HG',uy:0.56,ufs:0.12}); }
function ammSVG(x,y,r){ return rcase(x,y,r)+dial('amm',x,y,r,{bz:'none',sc:[{min:-60,max:60,a0:-70,a1:70,maj:30,mnr:10,lab:v=>v===0?'0':Math.abs(v),fs:0.18,lr:0.68}],title:'AMPERES',ty:0.36,tfs:0.12,
  extra:`<text x="${x-r*0.5}" y="${y+r*0.12}" class="dnum" font-size="${r*0.22}" text-anchor="middle">−</text><text x="${x+r*0.5}" y="${y+r*0.12}" class="dnum" font-size="${r*0.22}" text-anchor="middle">+</text>`}); }
function fuelSVG(x,y,r){ const lab=v=>v<0.1?'E':v>21?'F':null;
  return rcase(x,y,r)+dial('fuel',x,y,r,{bz:'none',sc:[{min:0,max:21.5,a0:-140,a1:-40,maj:21.5,mnr:21.5/8,lab,fs:0.2,lr:0.7,arcs:[[0,1.5,'ared']],nd:'L',nl:r-6},{min:0,max:21.5,a0:140,a1:40,maj:21.5,mnr:21.5/8,lab,fs:0.2,lr:0.7,arcs:[[0,1.5,'ared']],nd:'R',nl:r-6}],
   title:'FUEL',ty:-0.32,tfs:0.15,unit:'U.S. GAL',uy:0.5,ufs:0.11,extra:`<text x="${x-r*0.32}" y="${y+r*0.12}" class="dnum" font-size="${r*0.16}" text-anchor="middle">L</text><text x="${x+r*0.32}" y="${y+r*0.12}" class="dnum" font-size="${r*0.16}" text-anchor="middle">R</text>`}); }
function oilSVG(x,y,r){ return rcase(x,y,r)+dial('oil',x,y,r,{bz:'none',sc:[{min:75,max:260,a0:-140,a1:-40,maj:185,mnr:185/6,nolab:1,arcs:[[100,245,'agreen']],red:[245],nd:'T',nl:r-6},{min:0,max:120,a0:140,a1:40,maj:120,mnr:20,nolab:1,arcs:[[60,90,'agreen']],red:[25,115],nd:'P',nl:r-6}],
   title:'OIL',ty:-0.32,tfs:0.15,extra:`<text x="${x-r*0.36}" y="${y+r*0.14}" class="dnum" font-size="${r*0.13}" text-anchor="middle">TEMP</text><text x="${x+r*0.36}" y="${y+r*0.14}" class="dnum" font-size="${r*0.13}" text-anchor="middle">PRESS</text><text x="${x-r*0.36}" y="${y+r*0.5}" class="dnum" font-size="${r*0.12}" text-anchor="middle">°F</text><text x="${x+r*0.36}" y="${y+r*0.5}" class="dnum" font-size="${r*0.12}" text-anchor="middle">PSI</text>`}); }
function egtSVG(x,y,r){ return rcase(x,y,r)+dial('egt',x,y,r,{bz:'none',sc:[{min:1000,max:1600,a0:-120,a1:120,maj:100,mnr:25,nolab:1},{min:1000,max:1600,a0:-120,a1:120,nd:'R',ncls:'amb',nl:r*0.92}],title:'EGT',ty:0.3,tfs:0.17,unit:'25°F PER DIV',uy:0.52,ufs:0.09}); }
/* VOR/LOC indicator with glideslope (NAV 1) or without (NAV 2) */
function cdiSVG(n,x,y,r,gs){ let dots=''; for(let k=-5;k<=5;k++){ if(!k) continue; dots+=`<circle cx="${x+k*r*0.115}" cy="${y+r*0.08}" r="${Math.abs(k)%5?1.5:2.1}" fill="none" stroke="#f2f2f2" stroke-width="1"/>`; if(gs) dots+=`<circle cx="${x+r*0.5}" cy="${y+r*0.08+k*r*0.1}" r="${Math.abs(k)%5?1.3:1.8}" fill="none" stroke="#f2f2f2" stroke-width=".9"/>`; }
  return sqcase(x,y,156,156,10)+`<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+3}" class="sbz2"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${card(x,y,r-1,'ocard ocard-'+n)}
  <path d="M${x} ${y-r+1}l-5 -8h10z" fill="#fff" transform="translate(0 ${r*0.0})"/><path d="M${x} ${y+r-1}l-4 8h8z" fill="#fff"/><circle cx="${x}" cy="${y+r*0.08}" r="${r*0.62}" fill="#1a1819" stroke="#555" stroke-width=".8"/>
  ${dots}<circle cx="${x}" cy="${y+r*0.08}" r="3.4" fill="none" stroke="#f2f2f2" stroke-width="1.1"/>
  <g class="cdin cdin-${n}"><rect x="${x-1.5}" y="${y-r*0.5}" width="3" height="${r*1.12}" fill="#f2f2f2"/></g>
  ${gs?`<g class="gsn gsn-${n}"><rect x="${x-r*0.5}" y="${y+r*0.08-1.5}" width="${r*1.0}" height="3" fill="#f2f2f2"/></g>`:''}
  <rect x="${x+r*0.18}" y="${y-r*0.42}" width="${r*0.34}" height="${r*0.16}" rx="1" fill="#0b0a0a" stroke="#666" stroke-width=".6"/><text class="tf tf-${n}" x="${x+r*0.35}" y="${y-r*0.3}" font-size="${r*0.12}" fill="#f2f2f2" font-weight="700" text-anchor="middle" font-family="IBM Plex Sans,sans-serif"></text>
  <g class="nflag nflag-${n}"><rect x="${x-r*0.52}" y="${y-r*0.42}" width="${r*0.34}" height="${r*0.16}" fill="#d0281c" stroke="#000" stroke-width=".5"/><text x="${x-r*0.35}" y="${y-r*0.3}" font-size="${r*0.12}" fill="#fff" font-weight="700" text-anchor="middle" font-family="IBM Plex Sans,sans-serif">NAV</text></g>
  ${gs?`<g class="gflag gflag-${n}"><rect x="${x+r*0.3}" y="${y+r*0.2}" width="${r*0.26}" height="${r*0.16}" fill="#d0281c" stroke="#000" stroke-width=".5"/><text x="${x+r*0.43}" y="${y+r*0.32}" font-size="${r*0.12}" fill="#fff" font-weight="700" text-anchor="middle" font-family="IBM Plex Sans,sans-serif">GS</text></g>`:''}
  <text x="${x}" y="${y+r*0.5}" class="dnum" font-size="${r*0.075}" text-anchor="middle">${gs?'NAV 1 · VOR LOC GS':'NAV 2 · VOR LOC'}</text></g>`; }
/* ADF relative bearing indicator */
function adfSVG(x,y,r){ return sqcase(x,y,156,156,10)+`<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+3}" class="sbz2"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${card(x,y,r-1,'acard')}
  <path d="M${x} ${y-r+1}l-5 -8h10z" fill="#ff8a1a"/><g class="adfn" style="transform-origin:${x}px ${y}px"><path d="M${x} ${y-r*0.8}l-6 14h4v${r*1.4}h4v-${r*1.4}h4z" fill="#ffcf3a" stroke="#000" stroke-width=".6"/></g>
  <path d="M${x} ${y-r*0.26}v${r*0.5}M${x-r*0.22} ${y-r*0.04}h${r*0.44}M${x-r*0.09} ${y+r*0.2}h${r*0.18}" stroke="#ff8a1a" stroke-width="2.4" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="3" class="hub"/>
  <text x="${x}" y="${y+r*0.52}" class="dnum" font-size="${r*0.13}" text-anchor="middle">ADF</text></g>`; }
/* clock, OAT, magnetic compass, flap position, hour meter */
function clockSVG(x,y,r){ let t=''; for(let i=0;i<60;i++){ const [a,b]=pol(x,y,r,i*6), [c,d]=pol(x,y,r-(i%5?r*0.07:r*0.16),i*6); t+=`<path d="M${a.toFixed(1)} ${b.toFixed(1)}L${c.toFixed(1)} ${d.toFixed(1)}" stroke="#eee" stroke-width="${i%5?0.6:1.4}"/>`; if(i%15===0){ const [lx,ly]=pol(x,y,r*0.66,i*6); t+=`<text x="${lx.toFixed(1)}" y="${(ly+r*0.09).toFixed(1)}" class="dnum" font-size="${r*0.26}" text-anchor="middle">${i/5||12}</text>`; } }
  return rcase(x,y,r)+`<g class="gauge"><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${t}${nd('clkh',x,y,`<path d="M${x-2} ${y+4}L${x} ${y-r*0.5}L${x+2} ${y+4}z" fill="#eee"/>`)}${nd('clkm',x,y,`<path d="M${x-1.6} ${y+5}L${x} ${y-r*0.8}L${x+1.6} ${y+5}z" fill="#eee"/>`)}${nd('clks',x,y,`<path d="M${x} ${y+8}V${y-r*0.86}" stroke="#ff5a1f" stroke-width="1"/>`)}<circle cx="${x}" cy="${y}" r="2.6" class="hub"/></g>`; }
function oatSVG(x,y,r){ return `<path class="oatp" d="M${x} ${y-r-26}v${26}" stroke="#7d8287" stroke-width="5"/>`+dial('oat',x,y,r,{sc:[{min:-40,max:50,a0:-135,a1:135,maj:20,mnr:10,lab:v=>v,fs:0.24,lr:0.64}],title:'°C',ty:0.42,tfs:0.24,extra:`<text x="${x}" y="${y-r*0.28}" class="dnum" font-size="${r*0.18}" text-anchor="middle">OAT</text>`}); }
function compassSVG(x,y){ const w=150,h=56, k=1.9; let s='';
  for(let d=-90;d<=450;d+=5){ const X=x-d*k, L=d%30===0?16:d%10===0?10:6; s+=`<path d="M${X.toFixed(1)} ${y+h*0.5-2}v-${L}" stroke="#111" stroke-width="${d%10?0.9:1.4}"/>`; if(d%30===0){ const v=((d%360)+360)%360; const t={0:'N',90:'E',180:'S',270:'W'}[v]||v/10; s+=`<text x="${X.toFixed(1)}" y="${y-2}" fill="#111" font-size="${v%90?13:16}" font-weight="700" text-anchor="middle" font-family="IBM Plex Sans,sans-serif">${t}</text>`; } }
  return `<path d="M${x-14} 0V${y-h/2-14}h28V0" class="cmpstrip"/><rect x="${x-w/2-14}" y="${y-h/2-12}" width="${w+28}" height="${h+30}" rx="16" class="cmpbody"/><clipPath id="cCmp"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="8"/></clipPath>
  <rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="8" fill="#e9e3cf"/><g clip-path="url(#cCmp)"><g class="cmp" style="transform:translateX(0px)">${s}</g></g><path d="M${x} ${y-h/2}V${y+h/2}" stroke="#d0281c" stroke-width="2.4"/><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="8" fill="url(#gCmpGlass)"/>
  <rect x="${x-46}" y="${y+h/2+4}" width="92" height="12" rx="2" class="cmpcard"/>${lab(x,y+h/2+12.5,'FOR  N 30 60 E 120 150',{s:4.4,c:'dk'})}`; }
function flapIndSVG(x,y){ const sp=30, y0=y-45; let t=`<rect x="${x-14}" y="${y0-16}" width="28" height="${3*sp+32}" rx="4" class="fplate"/><rect x="${x-4}" y="${y0-4}" width="8" height="${3*sp+8}" rx="3" class="slot"/>`;
  ['0°','10°','20°','30°'].forEach((v,i)=>{ t+=`<path d="M${x-12} ${y0+i*sp}h6" stroke="#f2f2f2" stroke-width="1.4"/>`+lab(x-16,y0+i*sp+2.4,v,{s:6.4,a:'end'}); });
  return t+`<g class="flapp" style="transform:translateY(0px)"><path d="M${x+6} ${y0}l-10 -5v10z" fill="#ffcf3a" stroke="#000" stroke-width=".6"/></g>${lab(x-8,y0+3*sp+26,'FLAP POSITION',{s:5})}`; }
/* radio stack units: dark faceplates with mounting screws, recessed windows */
function rUnit(x0,y0,w,h){ return `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="3" class="avu"/><rect x="${x0+3}" y="${y0+3}" width="${w-6}" height="${h-6}" rx="2" class="avu2"/>${[[x0+8,y0+8],[x0+w-8,y0+8],[x0+8,y0+h-8],[x0+w-8,y0+h-8]].map(([a,b])=>`<circle cx="${a}" cy="${b}" r="2.2" class="avscr"/>`).join('')}`; }
function rWin(x,y,w,h,cls,txt,fs){ return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" class="digw"/><text class="dig ${cls}" x="${x+w-5}" y="${y+h*0.74}" font-size="${fs||h*0.68}" text-anchor="end">${txt}</text>`; }
function stackSVG(){ let s='';
  const bay=(x0,w,y0,y1)=>`<rect x="${x0-7}" y="${y0-6}" width="${w+14}" height="${y1-y0+12}" rx="3" class="stackbay"/>`;
  s+=bay(STK.x,STK.w,RU.aud[0],700)+bay(STK2.x,STK2.w,RU.adf[0],640);
  /* blanking plates in the unused radio slots ("additional radio space") */
  const cover=(x0,y0,w,h)=>`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="3" class="avcov"/>${[[x0+8,y0+8],[x0+w-8,y0+8],[x0+8,y0+h-8],[x0+w-8,y0+h-8]].map(([a,b])=>`<circle cx="${a}" cy="${b}" r="2.2" class="avscr"/>`).join('')}`;
  s+=cover(STK.x,606,STK.w,94)+cover(STK2.x,574,STK2.w,66);
  { const x0=STK.x, [y0,h]=RU.aud; s+=rUnit(x0,y0,STK.w,h)+lab(x0+18,y0+16,'AUDIO · MARKER',{s:4.4,a:'start'});
    [['O','b',0],['M','a',1],['A','w',2]].forEach(([t,c,i])=>{ const cx=x0+22+i*15, cy=y0+42; s+=`<g class="an an-${c}" data-a="mk${t}"><circle cx="${cx}" cy="${cy}" r="6.4"/><text x="${cx}" y="${cy+2.6}" font-size="7.4" text-anchor="middle">${t}</text></g>`; });
    s+=lab(x0+37,y0+60,'MARKER',{s:3.8})+lab(x0+212,y0+16,'SPEAKER',{s:3.8})+lab(x0+312,y0+16,'MIC',{s:3.8}); }
  [['1',RU.nc1],['2',RU.nc2]].forEach(([n,[y0,h]])=>{ const x0=STK.x; s+=rUnit(x0,y0,STK.w,h)+lab(x0+16,y0+15,'COMM '+n,{s:4.4,a:'start'})+lab(x0+204,y0+15,'NAV '+n,{s:4.4,a:'start'});
    s+=`<rect x="${x0+32}" y="${y0+20}" width="${142}" height="34" rx="2" class="avslot"/><rect x="${x0+194}" y="${y0+20}" width="${126}" height="34" rx="2" class="avslot"/>`;
    s+=rWin(x0+36,y0+24,68,26,'rc'+n+'a','118.100',15)+rWin(x0+106,y0+24,64,26,'rc'+n+'s','121.500',14)+rWin(x0+198,y0+24,58,26,'rn'+n+'a','110.30',15)+rWin(x0+258,y0+24,58,26,'rn'+n+'s','113.30',14);
    s+=lab(x0+70,y0+62,'USE',{s:3.6})+lab(x0+138,y0+62,'STBY',{s:3.6})+lab(x0+227,y0+62,'USE',{s:3.6})+lab(x0+287,y0+62,'STBY',{s:3.6})+lab(x0+24,y0+96,'PULL IDENT',{s:3})+lab(x0+24,y0+58,'PWR',{s:3.4}); });
  { const x0=STK2.x, [y0,h]=RU.adf; s+=rUnit(x0,y0,STK2.w,h)+lab(x0+16,y0+15,'ADF',{s:4.4,a:'start'})+`<rect x="${x0+40}" y="${y0+20}" width="140" height="36" rx="2" class="avslot"/>`+rWin(x0+44,y0+24,62,28,'radfa','375',16)+rWin(x0+112,y0+24,62,28,'radfs','287',15)+lab(x0+75,y0+66,'USE',{s:3.6})+lab(x0+143,y0+66,'STBY',{s:3.6})+lab(x0+228,y0+60,'ANT / ADF',{s:3.6,a:'start'})+lab(x0+228,y0+84,'FRQ ⇆',{s:3.6,a:'start'})+lab(x0+24,y0+56,'PWR',{s:3.4}); }
  { const x0=STK2.x, [y0,h]=RU.dme; s+=rUnit(x0,y0,STK2.w,h)+lab(x0+16,y0+14,'DME',{s:4.4,a:'start'})+`<rect x="${x0+54}" y="${y0+14}" width="196" height="34" rx="2" class="avslot"/>`+rWin(x0+58,y0+18,66,26,'dmed','---.-',15)+rWin(x0+128,y0+18,56,26,'dmek','---',15)+rWin(x0+188,y0+18,58,26,'dmem','--',15)+lab(x0+91,y0+56,'NM',{s:3.6})+lab(x0+156,y0+56,'KT',{s:3.6})+lab(x0+217,y0+56,'MIN',{s:3.6})+lab(x0+24,y0+20,'PWR',{s:3.4}); }
  { const x0=STK2.x, [y0,h]=RU.xp; s+=rUnit(x0,y0,STK2.w,h)+lab(x0+70,y0+15,'TRANSPONDER',{s:4.4,a:'start'})+`<rect x="${x0+70}" y="${y0+20}" width="${86}" height="32" rx="2" class="avslot"/>`+rWin(x0+74,y0+23,78,26,'rxp','1200',17)+`<text class="dig rxpm" x="${x0+78}" y="${y0+33}" font-size="6.5">ALT</text>`+`<g class="an an-a" data-a="xpR"><circle cx="${x0+166}" cy="${y0+32}" r="4.6"/></g>`+lab(x0+166,y0+45,'R',{s:3.6})+lab(x0+234,y0+38,'CODE',{s:3.8})+lab(x0+110,y0+74,'ALT · PRESSURE ALTITUDE',{s:3.2}); }
  return s; }
const ANN={};

/* ---------- the panel ---------- */
const MAGS={}; Object.keys(REG).forEach(k=>{ if(k==='overview') return; const r=REG[k]; MAGS[k]=[r[0]+r[2]-13,r[1]+13]; });
Object.assign(MAGS,{six:[734,298],left:[268,298],nav:[884,298],audio:[1232,640],radios:[1594,598],flaps:[1488,610],right:[1962,298],low6:[728,662],switches:[812,918],cbs:[440,1030],quad:[1256,918],rlower:[1500,918],pedestal:[1136,1092],compass:[1106,62]});
function panelSVG(){
  /* small engraved placard: black plate, silver rim, tiny white text */
  const plq=(x,y,w,lines,fs,cls)=>{ const h=fs*0.9+lines.length*fs*1.25+fs*0.3; return `<rect x="${x}" y="${y}" width="${w}" height="${h.toFixed(1)}" rx="1.5" class="${cls||'plq'}"/>`+lines.map((t,i)=>`<text x="${x+w/2}" y="${(y+fs*1.35+i*fs*1.25).toFixed(1)}" class="plqt${cls==='plqs'?' dk':''}" font-size="${fs}" text-anchor="middle">${esc(t)}</text>`).join(''); };
  const blank=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r}" class="blankp"/><circle cx="${x}" cy="${y}" r="${r-4}" class="blankp2"/>${[45,135,225,315].map(a=>{ const [px,py]=pol(x,y,r+7,a); return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.6" class="cscr"/>`; }).join('')}`;
  const colHole=(x)=>`<ellipse cx="${x}" cy="${COLY}" rx="34" ry="30" class="colbush"/><ellipse cx="${x}" cy="${COLY}" rx="22" ry="19" class="colhole"/>`;
  const colTube=(x,y)=>`<path d="M${x-15} ${COLY}V${y-20}h30V${COLY}z" class="coltube"/><path d="M${x-6} ${COLY+4}V${y-24}" class="coltubeh"/><rect x="${x-19}" y="${COLY+2}" width="38" height="16" rx="5" class="colcoll"/>`;
  const pedal=(x,y)=>`<path d="M${x-26} ${y-30}h52l6 58h-64z" class="pedal"/>${[0,1,2,3,4].map(i=>`<path d="M${x-22+i*0.6} ${y-22+i*11}h${44-i*1.2+i*2}" class="pedalr"/>`).join('')}<path d="M${x-30} ${y+30}h60" class="pedalb"/>`;
  return `<svg class="psvg" viewBox="0 0 ${W} ${H}" xmlns="${NS}">
<defs>
 <linearGradient id="gPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d3b38"/><stop offset=".55" stop-color="#363431"/><stop offset="1" stop-color="#2e2c2a"/></linearGradient>
 <linearGradient id="gLow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#232221"/><stop offset="1" stop-color="#181716"/></linearGradient>
 <linearGradient id="gGlare" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2827"/><stop offset=".55" stop-color="#1a1918"/><stop offset=".9" stop-color="#0c0b0b"/><stop offset="1" stop-color="#050505"/></linearGradient>
 <linearGradient id="gLip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d2b29"/><stop offset=".5" stop-color="#151414"/><stop offset="1" stop-color="#060606"/></linearGradient>
 <linearGradient id="gHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b7b1a6"/><stop offset="1" stop-color="#8a847a"/></linearGradient>
 <linearGradient id="gPillar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#57534c"/><stop offset="1" stop-color="#2e2b27"/></linearGradient>
 <linearGradient id="gPillarR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#57534c"/><stop offset="1" stop-color="#2e2b27"/></linearGradient>
 <linearGradient id="gFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121111"/><stop offset=".25" stop-color="#1f1d1b"/><stop offset="1" stop-color="#2c2925"/></linearGradient>
 <linearGradient id="gPed" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a1918"/><stop offset=".5" stop-color="#34312e"/><stop offset="1" stop-color="#1a1918"/></linearGradient>
 <linearGradient id="gTube" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4d4f52"/><stop offset=".35" stop-color="#c9ccce"/><stop offset=".6" stop-color="#8d9195"/><stop offset="1" stop-color="#3a3c3e"/></linearGradient>
 <linearGradient id="gCmpGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
 <radialGradient id="gKnob" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#6a6f76"/><stop offset=".6" stop-color="#2a2d31"/><stop offset="1" stop-color="#121417"/></radialGradient>
 <radialGradient id="gKnob2" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#7a828c"/><stop offset=".7" stop-color="#363b42"/><stop offset="1" stop-color="#1a1d21"/></radialGradient>
 <radialGradient id="gMetal" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#f6f7f8"/><stop offset=".45" stop-color="#b1b6bb"/><stop offset="1" stop-color="#5a6067"/></radialGradient>
 <radialGradient id="gChrome" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#9a9fa5"/><stop offset=".8" stop-color="#e2e4e6"/><stop offset="1" stop-color="#6d7277"/></radialGradient>
 <radialGradient id="gRed" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#ff6a5a"/><stop offset=".6" stop-color="#b8231a"/><stop offset="1" stop-color="#5a0c06"/></radialGradient>
 <radialGradient id="gBlackK" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#5a5a5a"/><stop offset=".6" stop-color="#1c1c1c"/><stop offset="1" stop-color="#050505"/></radialGradient>
 <radialGradient id="gBezel" cx=".5" cy=".5" r=".5"><stop offset=".86" stop-color="#050505"/><stop offset=".94" stop-color="#2a2928"/><stop offset="1" stop-color="#121111"/></radialGradient>
 <radialGradient id="gHub" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#4a4744"/><stop offset="1" stop-color="#121110"/></radialGradient>
 <linearGradient id="gBat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d949b"/><stop offset=".45" stop-color="#f4f6f8"/><stop offset="1" stop-color="#6f767d"/></linearGradient>
 <linearGradient id="gBatR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8f1d14"/><stop offset=".45" stop-color="#ef4a3a"/><stop offset="1" stop-color="#7d160f"/></linearGradient>
 <linearGradient id="gYoke" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5752"/><stop offset=".45" stop-color="#34312e"/><stop offset="1" stop-color="#191817"/></linearGradient>
 <linearGradient id="gGrip" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d0d0d"/><stop offset=".45" stop-color="#2c2b2a"/><stop offset="1" stop-color="#0a0a0a"/></linearGradient>
 <linearGradient id="gDoor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c3a37"/><stop offset="1" stop-color="#2c2a28"/></linearGradient>
 <filter id="fLed" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="fShadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity=".6"/></filter>
 <filter id="fSoft" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-opacity=".55"/></filter>
</defs>
<!-- cabin: headliner, door posts, windshield centre strip with the magnetic compass, OAT probe -->
<path d="M0 ${-SKY}H${W}V${26-SKY}Q${W/2} ${46-SKY} 0 ${26-SKY}Z" class="headl"/>
<path d="M0 ${-SKY}H${70+SKY*0.12}L34 ${PT-30}H0Z" class="pillar"/><path d="M${W} ${-SKY}H${W-70-SKY*0.12}L${W-34} ${PT-30}H${W}Z" class="pillarR"/>
<path d="M${W/2-9} ${30-SKY}V210h18V${30-SKY}z" class="cmpstrip"/>
${compassSVG(1000,152)}
${oatSVG(372,190,24)}
<!-- cabin side walls and door frames beyond the panel ends (seen on wide screens) -->
<path d="M-900 ${PT-30}H34L44 ${PT+6}V${H}H-900Z" class="sidew"/><path d="M${W+900} ${PT-30}H${W-34}L${W-44} ${PT+6}V${H}H${W+900}Z" class="sidew"/>
<path d="M-900 ${PT-30}H34" class="sidetrim"/><path d="M${W+900} ${PT-30}H${W-34}" class="sidetrim"/>
<path d="M-900 ${-SKY}H0V${PT-30}H-900Z" class="sidewin" /><path d="M${W+900} ${-SKY}H${W}V${PT-30}H${W+900}Z" class="sidewin"/>
<path d="M-40 ${-SKY}H${70+SKY*0.12}L34 ${PT-30}H-40Z" class="pillar"/><path d="M${W+40} ${-SKY}H${W-70-SKY*0.12}L${W-34} ${PT-30}H${W+40}Z" class="pillarR"/>
<!-- glareshield: padded shroud with a rounded lip over the panel -->
<path d="M${PT-262} ${PT+6}L44 262Q${W/2} 216 ${W-44} 262L${W-PT+262} ${PT+6}Z" class="glare"/>
<path d="M30 ${PT-14}Q${W/2} ${PT-60} ${W-30} ${PT-14}L${W-34} ${PT+6}Q${W/2} ${PT-34} 34 ${PT+6}Z" class="glarelip"/>
<path d="M44 ${PT-10}Q${W/2} ${PT-55} ${W-44} ${PT-10}" class="stitch"/>
<!-- instrument panel and the switch and control panel -->
<path d="M34 ${PT+2}Q${W/2} ${PT-30} ${W-34} ${PT+2}V${PB}H34Z" class="ipanel"/>
<rect x="34" y="${PB}" width="${W-68}" height="${LB-PB}" rx="3" class="lpanel"/>
<path d="M34 ${PB}H${W-34}" class="seam"/><path d="M36 ${PB+3}H${W-36}" class="seamhi"/>
${[[46,PT+14],[W-46,PT+14],[46,PB-12],[W-46,PB-12],[880,PB-12],[1248,PB-12],[1610,PB-12],[44,PB+12],[W-44,PB+12],[44,LB-10],[W-44,LB-10]].map(([x,y])=>screw(x,y)).join('')}
<!-- left edge: clock, fuel quantity, oil temperature / pressure, suction, ammeter, LOW VOLTAGE light -->
${clockSVG(LX,366,38)}${fuelSVG(LX,494,46)}${oilSVG(LX,624,46)}${suctionSVG(LX,748,36)}${ammSVG(LX,848,36)}
${lampBox('lowv',196,870,52,20,['LOW','VOLTAGE'],'r',6.4)}
<!-- six-pack -->
${asiSVG(SX[0],SY[0],IR)}${aiSVG(SX[1],SY[0],IR)}${altSVG(SX[2],SY[0],IR)}
${tcSVG(SX[0],SY[1],IR)}${dgSVG(SX[1],SY[1],IR)}${vsiSVG(SX[2],SY[1],IR)}
<g class="cov cov-ai" style="opacity:0"><circle cx="${SX[1]}" cy="${SY[0]}" r="${IR+6}" class="covr"/><text x="${SX[1]}" y="${SY[0]+5}" class="covt" font-size="13" text-anchor="middle">INOP</text></g>
<g class="cov cov-dg" style="opacity:0"><circle cx="${SX[1]}" cy="${SY[1]}" r="${IR+6}" class="covr"/><text x="${SX[1]}" y="${SY[1]+5}" class="covt" font-size="13" text-anchor="middle">INOP</text></g>
<!-- below the six-pack: tachometer, control column, instrument covers, registration and speed placards -->
${tachSVG(SX[0],744,58)}
${colHole(YK.L[0])}${colHole(YK.R[0])}
${lab(SX[2],696,'INSTRUMENT COVERS',{s:4.2})}
${plq(SX[2]-62,756,124,['MANEUVERING SPEED','99 KIAS AT 2,400 LB'],5.2)}

<!-- NAV indicators and ADF -->
${cdiSVG('1',NX,SY[0],IR-6,true)}${cdiSVG('2',NX,SY[1],IR-6,false)}${adfSVG(NX,740,IR-6)}
<!-- radio stack (centre) and second radio column (right) -->
${stackSVG()}
<!-- below the stack: speed / flap placards, flap position indicator and switch -->
${plq(964,722,210,['AVIONICS POWER OFF FOR','ENGINE START AND SHUTDOWN'],5.4)}
${plq(1258,846,150,['FLAP LIMITS: 10° 110 KIAS','10°–30° 85 KIAS'],4.8)}
<circle cx="1180" cy="858" r="10" class="ring0"/><circle cx="1180" cy="858" r="7.5" class="altst"/>${lab(1180,838,'ALT STATIC AIR',{s:4})}${lab(1180,880,'PULL ON',{s:4})}
${flapIndSVG(1318,760)}
<!-- copilot side: blank instrument holes, column, placards, hour meter, EGT, ELT, map compartment -->
${plq(1652,604,140,['THIS AIRPLANE MUST BE OPERATED IN THE','NORMAL OR UTILITY CATEGORY IN COMPLIANCE','WITH THE OPERATING LIMITATIONS STATED','IN PLACARDS, MARKINGS AND MANUALS'],4)}
${plq(1802,604,124,['FUEL: 40 GAL USABLE · 100LL','BOTH FOR TAKE-OFF','AND LANDING'],4.2)}
${egtSVG(1712,392,42)}
<rect x="1800" y="318" width="112" height="44" rx="3" class="hobbsc"/>${rWin(1810,324,92,24,'hobbs','1234.5',15)}${lab(1856,357,'HOURS',{s:4.4})}
<rect x="1822" y="378" width="104" height="86" rx="4" class="eltp"/>${lab(1874,392,'ELT',{s:6})}
${blank(1712,536,44)}${blank(1868,536,44)}
${plq(1268,650,92,['N 0000'],10,'plqs')}
${plq(1652,646,274,['UTILITY CATEGORY: NO SPINS · NO ACROBATIC MANEUVERS','NORMAL CATEGORY: NO ACROBATIC MANEUVERS INCL. SPINS'],4.2)}
<g filter="url(#fSoft)"><rect x="1610" y="682" width="320" height="196" rx="12" class="glove"/></g>
<rect x="1622" y="694" width="296" height="172" rx="9" class="glove2"/>
<rect x="1742" y="700" width="56" height="16" rx="7" class="latch"/><circle cx="1770" cy="708" r="4" class="latchk"/>
<!-- switch and control panel: labels, breaker strip, cigar lighter -->
${lab(272,SUBY-24,'MASTER',{s:5.4})}<path d="M250 ${SUBY-19}h44" class="grpl"/>
${brk(526,790,SUBY-38,'LIGHTS',{s:4.6})}
${lab(172,SUBY+40,'IGNITION',{s:4.4})}
<rect x="44" y="1020" width="760" height="54" rx="3" class="cbpan"/>${lab(460,1072,'CIRCUIT BREAKERS – PUSH TO RESET',{s:3.6,c:'dim'})}
<path d="M${YK.L[0]-26} ${PB}V${LB}M${YK.L[0]+26} ${PB}V${LB}" class="seam"/>
${lab(1000,SUBY+44,'CLOSED ↓  FRICTION ⟲',{s:4})}${lab(1082,SUBY+44,'LEAN ↓',{s:4})}
<circle cx="1000" cy="${SUBY+54}" r="7" class="fric"/>
<circle cx="1474" cy="${SUBY+2}" r="13" class="ring0"/><circle cx="1474" cy="${SUBY+2}" r="10" class="lighter"/><circle cx="1474" cy="${SUBY+2}" r="4" class="lighter2"/>${labUp(1474,SUBY-17,'LIGHTER',{s:4.6})}
${lab(1544,SUBY-8,'MIC',{s:4})}<circle cx="1544" cy="${SUBY+4}" r="6" class="jack"/>${lab(1580,SUBY-8,'PHONE',{s:4})}<circle cx="1580" cy="${SUBY+4}" r="7" class="jack"/>
<!-- floor, pedestal, rudder pedals, fuel selector -->
<rect x="0" y="${LB}" width="${W}" height="${H-LB}" class="floor"/>
<path d="M0 ${LB}H${W}V${LB+16}H0z" class="knee"/>
<path d="M928 ${LB}h144l28 ${H-LB}h-200z" class="ped"/><path d="M946 ${LB+6}h108l8 ${130}h-124z" class="pedp"/>
${[[400,1262],[560,1262],[1448,1262],[1608,1262]].map(([x,y])=>pedal(x,y)).join('')}
<ellipse cx="1000" cy="1268" rx="66" ry="44" class="fsplate"/>${lab(948,1242,'20 GAL',{s:3.8})}${lab(1052,1242,'20 GAL',{s:3.8})}
${lab(970,1098,'NOSE\nDOWN',{s:4.2,a:'end'})}${lab(970,1192,'NOSE\nUP',{s:4.2,a:'end'})}${lab(966,1150,'TRIM',{s:4.4,a:'end'})}
<path d="M1040 1104h22v10h-22z" class="micbr"/>
${colTube(YK.L[0],YK.L[1])}${colTube(YK.R[0],YK.R[1])}
<g class="ctls">${C.map(ctlSVG).join('')}</g>
<g class="mags"></g>
</svg>`;
}

/* ---------- build ---------- */
function build(stage,io){
  const world=document.createElement('div'); world.className='world'; world.style.width=W+'px'; world.style.height=H+'px';
  /* the panel sits in an unscaled full-stage wrapper; CSS composites it while the outside view is drawn behind the panel, so the
     WebGL canvas below does not split the panel into overlap layers (the panel itself keeps its scale and stays sharp) */
  const wlay=document.createElement('div'); wlay.className='wlay'; wlay.appendChild(world);
  world.innerHTML=panelSVG(); stage.appendChild(wlay);
  const svg=world.querySelector('svg'), byId={}; if(CPT) svg.classList.add('cpt');
  svg.querySelectorAll('g.ctl').forEach(g=>{ const c=C.find(k=>k.id===g.dataset.id); byId[c.id]={c,g}; });
  svg.querySelectorAll('.an[data-a]').forEach(e=>{ (ANN[e.dataset.a]=ANN[e.dataset.a]||[]).push(e); });
  requestAnimationFrame(()=>{ const layer=document.createElementNS(NS,'g'); layer.setAttribute('class','hits'); const host=svg.querySelector('g.ctls'); host.insertBefore(layer,host.firstChild);
    const Z=[]; Object.values(byId).forEach(o=>{ try{ const b=o.g.getBBox(); const r=document.createElementNS(NS,'rect'); r.setAttribute('class','hlr');
      const x0=Math.max(1,b.x-3), y0=Math.max(1,b.y-3), x1=Math.min(W-1,b.x+b.width+3), y1=Math.min(H-1,b.y+b.height+3);
      r.setAttribute('x',x0); r.setAttribute('y',y0); r.setAttribute('width',x1-x0); r.setAttribute('height',y1-y0); r.setAttribute('rx',5); o.g.insertBefore(r,o.g.firstChild);
      if(o.c.t==='sbtn') return; const cx=b.x+b.width/2, cy=b.y+b.height/2, hw=Math.max(b.width+6,26)/2, hh=Math.max(b.height+6,26)/2; Z.push({o,cx,cy,x0:cx-hw,x1:cx+hw,y0:cy-hh,y1:Math.min(H-1,cy+hh)}); }catch(e){} });
    for(let a=0;a<Z.length;a++) for(let k=a+1;k<Z.length;k++){ const A=Z[a], B=Z[k]; if(A.x1<=B.x0||B.x1<=A.x0||A.y1<=B.y0||B.y1<=A.y0) continue;
      const dx=B.cx-A.cx, dy=B.cy-A.cy;
      if(Math.abs(dx)>=Math.abs(dy)){ const m=(A.cx+B.cx)/2; if(dx>=0){ A.x1=Math.min(A.x1,m); B.x0=Math.max(B.x0,m); } else { A.x0=Math.max(A.x0,m); B.x1=Math.min(B.x1,m); } }
      else { const m=(A.cy+B.cy)/2; if(dy>=0){ A.y1=Math.min(A.y1,m); B.y0=Math.max(B.y0,m); } else { A.y0=Math.max(A.y0,m); B.y1=Math.min(B.y1,m); } } }
    Z.forEach(z=>{ if(z.x1<=z.x0||z.y1<=z.y0) return; const h=document.createElementNS(NS,'rect'); const wh=WHT.includes(z.o.c.t); h.setAttribute('class',wh?'hit hitw':'hit'); if(wh) fineWheel(h,onWheel); h.dataset.for=z.o.c.id; h.setAttribute('x',z.x0); h.setAttribute('y',z.y0); h.setAttribute('width',z.x1-z.x0); h.setAttribute('height',z.y1-z.y0); layer.appendChild(h); }); });
  const onWheel=bind(world,byId,io);
  return {world,svg,byId,W,H,REG,REG_ORDER,C,CBS,q:{}};
}

/* ---------- interaction ---------- */
function ctlFromBy(byId,t){ if(!t||!t.closest) return null; const g=t.closest('g.ctl'); if(g) return g; const h=t.closest('.hit'); return h&&byId[h.dataset.for]?byId[h.dataset.for].g:null; }
function levSnap(c,v){ const rng=c.max-c.min; for(const [m] of c.marks||C.find(k=>k.kind===c.kind&&k.marks).marks){ if(Math.abs(v-m)<rng*0.035) return m; } return v; }
/* A blocking (non-passive) wheel listener makes Chrome keep a wheel-event region for every painted part below it and rebuild it on
   every repaint (the main cost of a repaint on a desktop, worst when zoomed in). Wheel events only come from a mouse or touchpad.
   So the knob listener sits on the knobs and their touch zones only (the only targets it ever acted on), attached while the device
   has a fine pointer; the stage-wide Ctrl+wheel guard (no browser zoom over the panel) is attached while the Ctrl key is held. */
const WH=[]; let whMq=null, whOn=null;
function whSync(){ const on=!whMq||whMq.matches; if(on===whOn) return; whOn=on; WH.forEach(([el,fn])=>{ if(on) el.addEventListener('wheel',fn,{passive:false}); else el.removeEventListener('wheel',fn,{passive:false}); }); }
function fineWheel(el,fn){ if(whOn===null){ whMq=G.matchMedia?G.matchMedia('(any-pointer:fine)'):null; if(whMq){ if(whMq.addEventListener) whMq.addEventListener('change',whSync); else if(whMq.addListener) whMq.addListener(whSync); } whSync(); }
  WH.push([el,fn]); if(whOn) el.addEventListener('wheel',fn,{passive:false}); }
function ctrlWheel(el){ const fn=e=>{ if(e.ctrlKey) e.preventDefault(); }; let on=false; const set=v=>{ if(v===on) return; on=v; if(v) el.addEventListener('wheel',fn,{passive:false}); else el.removeEventListener('wheel',fn,{passive:false}); };
  G.addEventListener('keydown',e=>{ if(e.key==='Control'||e.ctrlKey) set(true); },true); G.addEventListener('keyup',e=>{ if(e.key==='Control'||!e.ctrlKey) set(false); },true); G.addEventListener('blur',()=>set(false)); }
const WHT=['rot','enc','enc2','rotsel','vwheel','hwheel','lev','flap'];
const MOM=c=>c.mom||c.t==='push'||c.t==='mbtn'||c.t==='sbtn'||c.t==='bar'||(c.t==='abtn'&&c.momentary)||(c.t==='key'&&!c.alt);
function bind(world,byId,io){
  const ctlFrom=t=>ctlFromBy(byId,t);
  const svg=world.querySelector('svg'); const pt0=svg.createSVGPoint();
  const toW=e=>{ if(io.toWorld) return io.toWorld(e); pt0.x=e.clientX; pt0.y=e.clientY; const p=pt0.matrixTransform(svg.getScreenCTM().inverse()); return {x:p.x,y:p.y}; };
  const inner=(c,pt)=>Math.hypot(pt.x-c.x,pt.y-c.y)<(c.r||14)*0.58*(c.sc||1);
  const step=(o,d,inn)=>{ const c=o.c, v=io.get(c.id);
    switch(c.t){
      case 'tog': case 'cb': case 'pull': case 'abtn': case 'key': case 'lbtn': io.set(c.id,d>0?1:d<0?0:(v?0:1)); return;
      case 'guard': { const gk=c.id+'G'; if(!io.get(gk)){ io.set(gk,1); return; } if(d===0) io.set(c.id,v?0:1); else io.set(c.id,d>0?1:0); return; }
      case 'tog3': io.set(c.id,d? clamp((v||0)-d,-1,1) : (v!==0?0:-1)); return;
      case 'rotsel': io.set(c.id,clamp(v+(d||1),0,c.vals.length-1)); return;
      case 'rot': io.set(c.id,clamp(v+d*0.08,0,1)); return;
      case 'enc': io.set(c.id+':d',d||1); return;
      case 'enc2': io.set(c.id+(inn?':i':':o'),d||1); return;
      case 'gear': io.set(c.id,d>0?0:d<0?1:(v?0:1)); return;
      case 'flap': io.set(c.id,clamp(v-(d||0),0,c.vals.length-1)); return;
      case 'vwheel': case 'hwheel': io.set(c.id,clamp(v+d*0.04,-1,1)); return;
      case 'lev': io.set(c.id,levSnap(c,clamp(v+d*(c.max-c.min)*0.04,c.min,c.max))); return;
    } };
  let wacc=0;
  const onWheel=e=>{ const g=ctlFrom(e.target); if(!g) return; const o=byId[g.dataset.id]; if(!WHT.includes(o.c.t)) return; e.preventDefault(); e.stopPropagation(); if(e.ctrlKey) return; const raw=(Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:-e.deltaX)*(e.deltaMode?40:1); wacc+=raw; if(Math.abs(wacc)<30) return; const d=wacc<0?1:-1; wacc=0;
    if(o.c.t==='vwheel') return step(o,-d); step(o,d,o.c.t==='enc2'&&(e.shiftKey||inner(o.c,toW(e)))); };
  Object.values(byId).forEach(o=>{ if(WHT.includes(o.c.t)) fineWheel(o.g,onWheel); });
  let drag=null;
  world.addEventListener('pointerdown',e=>{ const g=ctlFrom(e.target); if(!g) return; if(io.intercept&&io.intercept(e,g)) return; const o=byId[g.dataset.id], c=o.c; e.preventDefault(); e.stopPropagation(); g.focus({preventScroll:true});
    const pt=toW(e);
    if(MOM(c)){ io.set(c.id,1); drag={o,mom:1}; try{ g.setPointerCapture(e.pointerId); }catch(_){} return; }
    if(c.t==='lev'){ drag={o,lev:1,y:pt.y,v:io.get(c.id),moved:0}; try{ g.setPointerCapture(e.pointerId); }catch(_){} g.classList.add('drag'); return; }
    if(c.t==='vwheel'||c.t==='hwheel'||c.t==='rot'||c.t==='enc'||c.t==='enc2'){ drag={o,x:pt.x,y:pt.y,v:io.get(c.id),acc:0,moved:0,inn:c.t==='enc2'&&inner(c,pt)}; try{ g.setPointerCapture(e.pointerId); }catch(_){} return; }
    if(c.t==='rotsel'){ const a=Math.atan2(pt.x-c.x,-(pt.y-c.y))*180/Math.PI; const v=io.get(c.id); const dA=(p,q)=>Math.abs(((p-q+540)%360)-180); let nv=null;
      if(Math.hypot(pt.x-c.x,pt.y-c.y)>(c.r||12)*(c.sc||1)+3){ let best=0; c.ang.forEach((x,i)=>{ if(dA(x,a)<dA(c.ang[best],a)) best=i; }); if(best!==v) nv=best; }
      if(nv===null){ nv=(v+1)%c.vals.length; if(c.spring!==undefined&&nv===c.spring) nv=c.loop??0; }
      io.set(c.id,nv); if(c.spring!==undefined&&nv===c.spring){ io.set(c.id+':hold',1); drag={o,rspr:1}; try{ g.setPointerCapture(e.pointerId); }catch(_){} } return; }
    if(c.t==='flap'){ const n=c.vals.length, sp=c.sp||30, y0=c.y-(n-1)*sp/2; const idx=clamp(Math.round((pt.y-y0)/sp),0,n-1); const cur=io.get(c.id); io.set(c.id,idx===cur?(cur+1)%n:idx); return; }
    if(c.t==='tog'){ drag={o,tg:1,y:pt.y,done:0}; try{ g.setPointerCapture(e.pointerId); }catch(_){} return; }
    if(c.t==='yoke'){ drag={o,stk:1,x:pt.x,y:pt.y,cx:e.clientX,cy:e.clientY,pt:e.pointerType}; try{ g.setPointerCapture(e.pointerId); }catch(_){} g.classList.add('drag'); io.set('stick',{x:0,y:0}); return; }
    if(c.t==='tog3'){ const v=io.get(c.id); const q=(c.horiz?pt.x-c.x:pt.y-c.y)/(c.sc||1); const t=q<-7?-1:q>7?1:(v!==0?0:-1); io.set(c.id,t===v?0:t); if(c.spring){ drag={o,spr:1}; try{ g.setPointerCapture(e.pointerId); }catch(_){} } return; }
    if(c.t==='guard'){ const onGuard=e.target.closest('.gd'); const gk=c.id+'G'; if(onGuard||!io.get(gk)){ io.set(gk,io.get(gk)?0:1); return; } io.set(c.id,io.get(c.id)?0:1); return; }
    step(o,0);
  });
  world.addEventListener('pointermove',e=>{ if(!drag||drag.mom||drag.spr) return; const c=drag.o.c, pt=toW(e);
    if(drag.tg){ const dy=pt.y-drag.y; if(!drag.done&&Math.abs(dy)>6){ drag.done=1; io.set(c.id,dy<0?1:0); } return; }
    if(drag.stk){ io.set('stick',G.FK?G.FK.shapeDrag(e.clientX-drag.cx,e.clientY-drag.cy,drag.pt):{x:clamp((pt.x-drag.x)/60,-1,1),y:clamp((pt.y-drag.y)/40,-1,1)}); return; } // screen px through the shared mouse/touch curve
    if(drag.lev){ const v=clamp(drag.v-(pt.y-drag.y)/c.len*(c.max-c.min),c.min,c.max); drag.moved=1; io.set(c.id,v); return; }
    if(c.t==='vwheel') io.set(c.id,clamp(drag.v+(pt.y-drag.y)/110,-1,1));
    if(c.t==='hwheel') io.set(c.id,clamp(drag.v+(pt.x-drag.x)/90,-1,1));
    if(c.t==='rot') io.set(c.id,clamp(drag.v+(pt.x-drag.x)/60,0,1));
    if(c.t==='enc'||c.t==='enc2'){ const d=(pt.x-drag.x)-(pt.y-drag.y); const n=Math.trunc(d/6)-drag.acc; if(n){ drag.acc+=n; io.set(c.id+(c.t==='enc'?':d':drag.inn?':i':':o'),n); } }
  });
  const end=()=>{ if(!drag) return; const c=drag.o.c; if(drag.rspr){ io.set(c.id+':hold',0); io.set(c.id,c.springTo); drag.o.g.classList.remove('drag'); drag=null; return; } if(drag.tg&&!drag.done) io.set(c.id,io.get(c.id)?0:1); if(drag.stk) io.set('stick',null); if(drag.mom) io.set(c.id,0); if(drag.spr) io.set(c.id,0);
    if(drag.lev) io.set(c.id,levSnap(c,io.get(c.id)));
    if(c.t==='enc'&&!drag.acc) io.set(c.id+':d',1);
    if(c.t==='enc2'&&!drag.acc) io.set(c.id+(drag.inn?':i':':o'),1);
    drag.o.g.classList.remove('drag'); drag=null; };
  world.addEventListener('pointerup',end); world.addEventListener('pointercancel',end);
  const held=new Set();
  world.addEventListener('keydown',e=>{ const g=e.target.closest&&e.target.closest('g.ctl'); if(!g) return; const o=byId[g.dataset.id], c=o.c; const k=e.key;
    let d=null; if(k==='ArrowUp'||k==='ArrowRight') d=1; else if(k==='ArrowDown'||k==='ArrowLeft') d=-1;
    if(MOM(c)&&c.t!=='sbtn'){ if(e.repeat){ e.preventDefault(); return; } if(k===' '||k==='Enter'){ io.set(c.id,1); held.add(c.id); e.preventDefault(); e.stopPropagation(); } return; }
    if(k===' '||k==='Enter'){ step(o,0); e.preventDefault(); e.stopPropagation(); return; }
    if(c.t==='rotsel'&&c.spring!==undefined&&d!=null){ if(e.repeat){ e.preventDefault(); return; } step(o,d); if(io.get(c.id)===c.spring) io.set(c.id+':hold',1); e.preventDefault(); e.stopPropagation(); return; }
    if(d!=null){ if(c.t==='vwheel') d=-d; step(o,d,e.shiftKey); e.preventDefault(); e.stopPropagation(); } });
  world.addEventListener('keyup',e=>{ const g=e.target.closest&&e.target.closest('g.ctl'); if(!g) return; const c=byId[g.dataset.id].c; if(held.has(c.id)){ held.delete(c.id); io.set(c.id,0); } if(c.t==='rotsel'&&c.spring!==undefined&&io.get(c.id)===c.spring){ io.set(c.id+':hold',0); io.set(c.id,c.springTo); } });
  return onWheel;
}

/* ---------- render state ---------- */
const cache={};
/* moving parts (.mv/.mvi/.gd) take their transform as custom properties (--bbx/--bby/--bbr/--bbsx/--bbsy, see c172.css) when the
   browser supports @property, so their transitions run on the main thread and do not lift half the panel into compositor layers */
const CPT=typeof CSS!=='undefined'&&!!G.CSSPropertyRule, TPN=['--bbx','--bby','--bbr','--bbsx','--bbsy'], TID=['0px','0px','0deg','1','1'];
function tProps(t){ const v=TID.slice(); if(t==='none'||t==='') return v; let i=0; const re=/(\w+)\(([^)]*)\)\s*/y; let m;
  while(i<t.length&&(m=(re.lastIndex=i,re.exec(t)))){ i=re.lastIndex; const a=m[2].split(',').map(x=>x.trim()), f=m[1];
    if(f==='translateX'&&!v.o) v[0]=a[0]; else if(f==='translateY'&&!v.o) v[1]=a[0]; else if(f==='translate'&&!v.o){ v[0]=a[0]; v[1]=a[1]||'0px'; }
    else if(f==='rotate'&&v.o!==2&&v.o!==3){ v[2]=a[0]; v.o=2; } else if(f==='scale'&&v.o!==3){ v[3]=a[0]; v[4]=a[1]||a[0]; v.o=3; } else if(f==='scaleX'&&v.o!==3){ v[3]=a[0]; v.o=3; } else if(f==='scaleY'&&v.o!==3){ v[4]=a[0]; v.o=3; }
    else return null; }
  return i===t.length?v:null; }
function setT(el,t){ if(!el||el._t===t) return; el._t=t;
  if(el._cp===undefined) el._cp=CPT&&(el.classList.contains('mv')||el.classList.contains('mvi')||el.classList.contains('gd'));
  const v=el._cp?tProps(t):null;
  if(v){ /* driven continuously (control wheel, trim wheel, lever drag): no easing between 30 Hz updates, so the part is not animated
       (and repainted) on every frame in between; a single change still eases as before */
    const now=performance.now(), cont=now-(el._lt||-1e9)<120; el._lt=now; if(cont!==!!el._cn){ el._cn=cont; el.style.transitionDuration=cont?'0s':''; }
    if(el._ti){ el._ti=0; el.style.transform=''; } for(let i=0;i<5;i++){ const k=TPN[i], x=String(v[i]); if((el['_p'+i]||TID[i])!==x){ el['_p'+i]=x; el.style.setProperty(k,x); } } }
  else { el._ti=1; el.style.transform=t; } }
function setTx(el,t){ if(el&&el._x!==t){ el._x=t; el.textContent=t; } }
function sync(P,io){
  for(const id in P.byId){ const {c,g}=P.byId[id]; let v=io.get(id); if(c.t==='guard') v=v+'|'+io.get(id+'G'); if(c.t==='gear') v=v+'|'+io.get('gearLights'); if(c.t==='abtn'||c.t==='mbtn'||c.t==='key'||c.t==='lbtn') v=v+'|'+io.get('led:'+id)+'|'+io.get('txt:'+id); if(c.t==='lev') v=(+v).toFixed(3); if(c.t==='enc2') v=io.get(id+'O')+'|'+io.get(id+'I')+'|'+io.get('txt:'+id); if(c.t==='enc'||c.t==='rot') v=v+'|'+io.get('txt:'+id);
    if(cache[id]===v) continue; cache[id]=v; const m=g.querySelector('.mv'); const val=io.get(id);
    switch(c.t){
      case 'tog': case 'guard': setT(m,val?'scaleY(1)':'scaleY(-1)'); g.classList.toggle('on',!!val); if(c.t==='guard'){ const go=io.get(id+'G'); setT(g.querySelector('.gd'),go?'translateY(-24px) scaleY(.35)':'none'); g.setAttribute('aria-label',c.l+(go?' (guard open)':' (guard closed)')); } g.setAttribute('aria-checked',val?'true':'false'); g.setAttribute('aria-valuetext',val?(String(c.up||'ON').replace(/\n/g,' ')||'ON'):(String(c.dn||(c.t==='guard'?'CLOSED':'OFF')).replace(/\n/g,' ')||'OFF')); break;
      case 'tog3': g.setAttribute('aria-valuetext',c.vals[val+1]||'CENTRE'); setT(m,val<0?'scaleY(1)':val>0?'scaleY(-1)':'scaleY(.2)'); break;
      case 'rot': setT(m,`rotate(${-135+val*270}deg)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||Math.round(val*100)+' %')); break;
      case 'enc': setT(m,`rotate(${(val*(c.deg||7))%360}deg)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||val)); break;
      case 'enc2': setT(m,`rotate(${((io.get(id+'O')||0)*11)%360}deg)`); setT(g.querySelector('.mvi'),`rotate(${((io.get(id+'I')||0)*11)%360}deg)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||'')); break;
      case 'rotsel': setT(m,`rotate(${c.ang[val]}deg)`); g.setAttribute('aria-valuetext',c.vals[val]); break;
      case 'push': case 'bar': case 'sbtn': g.classList.toggle('on',!!val); break;
      case 'mbtn': case 'abtn': case 'key': case 'lbtn': { const L=io.get('led:'+id); g.classList.toggle('on',!!val); g.classList.toggle('led',!!L); if(c.t==='lbtn'){ g.classList.toggle('la',L===1); g.classList.toggle('lb',L===2); }
        const tx=io.get('txt:'+id); if(tx) g.setAttribute('aria-valuetext',String(tx)); else if((c.t==='abtn'&&!c.momentary)||(c.t==='key'&&c.alt)) g.setAttribute('aria-valuetext',val?'ON':'OFF'); break; }
      case 'gear': { setT(m,val?'translateY(56px)':'none'); const L=io.get('gearLights'); g.querySelectorAll('.gl').forEach(x=>x.classList.remove('g','r')); if(L==='transit'||L==='warn'||L==='test') g.querySelector('.gU').classList.add('r'); g.setAttribute('aria-checked',val?'true':'false'); g.setAttribute('aria-valuetext',val?'DOWN':'UP'); break; }
      case 'flap': setT(m,`translateY(${val*(c.sp||30)}px)`); g.setAttribute('aria-valuetext',c.vals[val]); break;
      case 'cb': g.classList.toggle('out',!val); g.setAttribute('aria-valuetext',val?'IN':'PULLED'); g.setAttribute('aria-pressed',val?'false':'true'); break;
      case 'pull': g.setAttribute('aria-valuetext',val?'PULLED':'IN'); g.setAttribute('aria-pressed',val?'true':'false'); setT(m,val?(c.tee?'translateY(5px)':'scale(1.22)'):'none'); g.classList.toggle('on',!!val); break;
      case 'vwheel': setT(m,`translateY(${(val*60)%6}px)`); setT(g.querySelector('.trind'),`translateY(${-val*50}px)`); g.setAttribute('aria-valuetext',Math.round(val*100)+''); break;
      case 'hwheel': setT(m,`translateX(${(val*60)%6}px)`); setT(g.querySelector('.trind'),`translateX(${val*36}px)`); g.setAttribute('aria-valuetext',Math.round(val*100)+''); break;
      case 'lev': { const y=(c.max-val)/(c.max-c.min)*c.len; setT(m,`translateY(${y.toFixed(1)}px)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||val)); break; }
    }
  }
}

/* ---------- the instruments each frame ---------- */
function syncYokes(P,x,y){ const t=`translateY(${(y*16).toFixed(1)}px) rotate(${(x*34).toFixed(1)}deg)`; ['yokeL','yokeR'].forEach(id=>{ const o=P.byId[id]; if(!o) return; setT(o.g.querySelector('.skg'),t); }); }
const q=(P,cls)=>{ const e=P.q[cls]; if(e!==undefined) return e; return (P.q[cls]=P.svg.querySelector('.'+cls)); };
function needle(P,id,v,k){ const g=GA[id]; if(!g) return; const sc=g.sc.find(s=>(s.nd||'')===(k||''))||g.sc[0]; const a=angOf(sc,v); const el=q(P,'nd-'+id+(k||'')); if(el) setT(el,`rotate(${a.toFixed(1)}deg)`); }
function text(P,cls,t){ setTx(q(P,cls),t); }
function rot(P,cls,deg){ setT(q(P,cls),`rotate(${(+deg).toFixed(1)}deg)`); }
function tr(P,cls,t){ setT(q(P,cls),t); }
function vis(P,cls,on){ const el=q(P,cls); if(el&&el._v!==on){ el._v=on;
  if(CPT&&el.classList.contains('cov')){ el.style.opacity=''; el.style.setProperty('--bbo',on?1:0); } else el.style.opacity=on?1:0; } }
function ann(P,lit){ for(const k in ANN){ const on=!!lit[k]; ANN[k].forEach(e=>{ if(e._s!==on){ e._s=on; e.classList.toggle('on',on); } }); } }
const IRr=IR;
function gauges(P,d){
  needle(P,'asi',d.ias);
  /* attitude */
  rot(P,'att-ai',-d.ai.roll); tr(P,'attp-ai',`translateY(${(clamp(d.ai.pitch,-25,25)*IRr*0.03).toFixed(1)}px)`); tr(P,'aip',`translateY(${(d.ai.adj*IRr*0.03).toFixed(1)}px)`);
  /* altimeter */
  const a=Math.max(-1000,d.alt); rot(P,'nd-altH',((a%1000)+1000)%1000*0.36); rot(P,'nd-altK',(a/1000)*36); rot(P,'nd-altT',(a/10000)*36);
  text(P,'kol-alt',(d.baro/33.8639).toFixed(2)); text(P,'kolmb-alt',String(Math.round(d.baro)));
  /* turn coordinator */
  rot(P,'tcp-tc',clamp(d.tc.rate/3*15,-35,35)); tr(P,'ball-tc',`translate(${(clamp(d.tc.slip,-1,1)*IRr*0.36).toFixed(1)}px,${(-Math.abs(clamp(d.tc.slip,-1,1))*IRr*0.08).toFixed(1)}px)`); vis(P,'tcflag',!d.tc.on);
  /* heading indicator, VSI */
  rot(P,'hcard-dg',-d.dg); needle(P,'vsi',clamp(d.vs,-2000,2000));
  /* engine and electrical */
  needle(P,'tach',d.rpm); text(P,'hrs-tach',d.tachHrs.toFixed(1)); needle(P,'suct',d.suction); needle(P,'amm',clamp(d.amps,-60,60));
  needle(P,'fuel',d.fuelL,'L'); needle(P,'fuel',d.fuelR,'R'); needle(P,'oil',d.oilT,'T'); needle(P,'oil',d.oilP,'P');
  needle(P,'egt',d.egt); needle(P,'egt',d.egtRef,'R');
  /* nav */
  ['1','2'].forEach(n=>{ const c=d['cdi'+n]; rot(P,'ocard-'+n,-c.obs); tr(P,'cdin-'+n,`translateX(${(clamp(c.dev,-1.1,1.1)*IRr*0.58).toFixed(1)}px)`); text(P,'tf-'+n,c.tf==='TO'?'TO':c.tf==='FROM'?'FR':''); vis(P,'nflag-'+n,!!c.flag);
    if(n==='1'){ tr(P,'gsn-1',`translateY(${(clamp(c.gs==null?0:c.gs,-1.1,1.1)*IRr*0.5).toFixed(1)}px)`); vis(P,'gsn-1',c.gs!=null||c.flag); vis(P,'gflag-1',c.gs==null); } });
  rot(P,'acard',-d.adf.card); rot(P,'adfn',d.adf.rb==null?90:d.adf.rb);
  /* clock, OAT, compass, flaps */
  rot(P,'clkh',d.clock.h*30+d.clock.m*0.5); rot(P,'clkm',d.clock.m*6+d.clock.s*0.1); rot(P,'clks',d.clock.s*6);
  needle(P,'oat',d.oat); tr(P,'cmp',`translateX(${(d.compass*1.9).toFixed(1)}px)`); tr(P,'flapp',`translateY(${(d.flapPos*30).toFixed(1)}px)`);
  /* radios */
  const R=d.rad; ['c1a','c1s','n1a','n1s','c2a','c2s','n2a','n2s'].forEach(k=>text(P,'r'+k,R[k]||'')); text(P,'radfa',R.adfa||''); text(P,'radfs',R.adfs||'');
  text(P,'dmed',R.dmed||''); text(P,'dmek',R.dmek||''); text(P,'dmem',R.dmem||''); text(P,'rxp',R.xp||''); text(P,'rxpm',R.xpm||''); text(P,'hobbs',d.hobbs.toFixed(1));
  vis(P,'cov-ai',!!d.covAI); vis(P,'cov-dg',!!d.covDG);
  ann(P,d.lamps);
}
/* paint layers (panellayers.js): every unit that moves gets its own small SVG, the static artwork is painted once */
const LAYERS={dyn:'g.gauge,.an,.cmp,.dig,.hobbs,.flapp,[class*="cov-"]',hot:c=>c.t==='lev'||c.t==='vwheel'||c.t==='hwheel'||c.t==='yoke'};
G.C172P={SKY,LIP,fineWheel,ctrlWheel,ctlFrom:(P,t)=>ctlFromBy(P.byId,t),build:(s,io)=>{ const P=build(s,io); if(G.PANEL_LAYERS) G.PANEL_LAYERS.lift(P,LAYERS); return P; },sync,syncYokes,gauges,needle,text,rot,tr,vis,ann,REG,REG_ORDER,W,H,CBS,MAGS};
})(window);
