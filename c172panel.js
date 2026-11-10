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

/* ---------- geometry ---------- */
const SX=[300,460,620], SY=[380,550], IR=62;                 // six-pack centres and dial radius
const LX=112, NX=780, STK={x:870,w:340};                       // left column, NAV column, radio stack
const RU={aud:[278,56],nc1:[340,78],nc2:[424,78],adf:[508,54],dme:[568,40],xp:[614,54]};
const YK={L:[460,1100],R:[1540,1100]};

/* ---------- regions for zoom ---------- */
const REG={
  overview:[0,0,W,H],
  six:[190,190,530,460], left:[20,282,380,598], low6:[190,640,700,240], nav:[690,290,180,590],
  audio:[864,270,352,240], radios:[864,500,352,172], flaps:[864,668,352,212], right:[1220,282,760,598],
  switches:[20,880,600,200], cbs:[600,880,262,125], quad:[860,880,420,125], rlower:[1280,880,700,125],
  pedestal:[780,1005,440,315], compass:[860,10,280,240]
};
const REG_ORDER=['compass','cbs','quad','audio','radios','flaps','pedestal','rlower','switches','nav','low6','left','six','right'];

/* ---------- controls ---------- */
const C=[]; const add=o=>{ C.push(o); return o; };
/* instrument knobs */
add({id:'aiK',t:'enc',x:SX[1],y:SY[0]+IR+4,r:7,l:'ATTITUDE INDICATOR – MINIATURE AIRPLANE ADJUST',d:'',deg:20});
add({id:'baroK',t:'enc',x:SX[2]-IR+2,y:SY[0]+IR+2,r:8,l:'ALTIMETER SETTING KNOB',d:''});
add({id:'dgK',t:'enc',x:SX[1]-IR+2,y:SY[1]+IR+2,r:8,l:'HEADING INDICATOR – PUSH TO SET',d:''});
add({id:'obs1',t:'enc',x:NX-52,y:SY[0]+52,r:8,l:'NAV 1 OBS (COURSE SELECT)',d:''});
add({id:'obs2',t:'enc',x:NX-52,y:SY[1]+52,r:8,l:'NAV 2 OBS (COURSE SELECT)',d:''});
add({id:'adfCard',t:'enc',x:NX-50,y:722+50,r:8,l:'ADF CARD – HEADING SET',d:''});
add({id:'egtK',t:'enc',x:SX[2]+38,y:722+40,r:6,l:'EGT REFERENCE POINTER',d:''});
add({id:'covAI',t:'key',x:SX[1]-26,y:712,w:44,h:20,l:'AI COVER',alt:1,led:1,lbl:'INSTRUMENT COVER – ATTITUDE INDICATOR (PARTIAL PANEL PRACTICE)'});
add({id:'covDG',t:'key',x:SX[1]+26,y:712,w:44,h:20,l:'HI COVER',alt:1,led:1,lbl:'INSTRUMENT COVER – HEADING INDICATOR (PARTIAL PANEL PRACTICE)'});
/* audio panel */
{ const x0=STK.x, y0=RU.aud[0];
  add({id:'mkrSw',t:'tog3',x:x0+64,y:y0+30,l:'MARKER BEACON SENSITIVITY (HI / LO / TEST)',d:'',vals:['HI','LO','TEST'],sm3:1,s:4,lay:'right'});
  [['auC1','COM 1'],['auC2','COM 2'],['auN1','NAV 1'],['auN2','NAV 2'],['auAdf','ADF'],['auDme','DME'],['auMkr','MKR']].forEach(([id,n],i)=>
    add({id,t:'tog',x:x0+118+i*25,y:y0+30,l:'AUDIO '+n+' (SPEAKER / OFF)',d:'',xs:1,up:n.replace(' ','\n'),s:3.8}));
  add({id:'micSel',t:'rotsel',x:x0+310,y:y0+30,r:10,l:'MICROPHONE SELECTOR (COM 1 / COM 2)',d:'',vals:['COM1','COM2'],ang:[-45,45],s:3.8}); }
/* NAV/COM 1 and 2 */
[['1',RU.nc1[0]],['2',RU.nc2[0]]].forEach(([n,y0])=>{ const x0=STK.x;
  add({id:'pwr'+n,t:'rot',x:x0+20,y:y0+56,r:9,l:'NAV/COM '+n+' POWER / VOLUME',d:'',s:3.6});
  add({id:'comX'+n,t:'key',x:x0+152,y:y0+56,w:20,h:12,l:'⇆',lbl:'COM '+n+' FREQUENCY TRANSFER (ACTIVE ⇆ STANDBY)'});
  add({id:'navX'+n,t:'key',x:x0+188,y:y0+56,w:20,h:12,l:'⇆',lbl:'NAV '+n+' FREQUENCY TRANSFER (ACTIVE ⇆ STANDBY)'});
  add({id:'comK'+n,t:'enc2',x:x0+118,y:y0+56,r:13,l:'COM '+n+' FREQUENCY (OUTER MHz / INNER kHz)',d:''});
  add({id:'navK'+n,t:'enc2',x:x0+310,y:y0+56,r:13,l:'NAV '+n+' FREQUENCY (OUTER MHz / INNER kHz)',d:''});
  add({id:'navId'+n,t:'key',x:x0+268,y:y0+60,w:22,h:12,l:'ID',alt:1,led:1,lbl:'NAV '+n+' IDENT (MORSE ON / OFF)'}); });
/* ADF receiver */
{ const x0=STK.x, y0=RU.adf[0];
  add({id:'adfPwr',t:'rot',x:x0+20,y:y0+30,r:9,l:'ADF POWER / VOLUME',d:'',s:3.6});
  add({id:'adfMd',t:'key',x:x0+196,y:y0+16,w:22,h:12,l:'ADF',alt:1,led:1,lbl:'ADF MODE (ADF / ANT)'});
  add({id:'adfX',t:'key',x:x0+196,y:y0+38,w:22,h:12,l:'FRQ',lbl:'ADF FREQUENCY TRANSFER (FRQ)'});
  add({id:'adfK',t:'enc2',x:x0+310,y:y0+28,r:13,l:'ADF FREQUENCY (OUTER 100s / INNER 1s)',d:''}); }
/* DME */
{ const x0=STK.x, y0=RU.dme[0];
  add({id:'dmePwr',t:'tog',x:x0+22,y:y0+20,l:'DME POWER',d:'',xs:1,up:'',dn:'',s:3.4});
  add({id:'dmeMd',t:'rotsel',x:x0+300,y:y0+20,r:9,l:'DME MODE (N1 / HOLD / N2)',d:'',vals:['N1','HLD','N2'],ang:[-60,0,60],s:3.4}); }
/* transponder */
{ const x0=STK.x, y0=RU.xp[0];
  add({id:'xpMd',t:'rotsel',x:x0+30,y:y0+28,r:11,l:'TRANSPONDER MODE',d:'',vals:['OFF','SBY','ON','ALT','TST'],ang:[-110,-55,0,55,110],s:3.6,lr:13});
  [0,1,2,3].forEach(i=>add({id:'xp'+i,t:'enc',x:x0+176+i*34,y:y0+38,r:8,l:'TRANSPONDER CODE DIGIT '+(i+1),d:'',deg:45}));
  add({id:'xpId',t:'key',x:x0+316,y:y0+16,w:30,h:13,l:'IDENT',lbl:'TRANSPONDER IDENT'}); }
/* flaps (preselect lever with follow-up) */
add({id:'flaps',t:'flap',x:1190,y:772,l:'WING FLAP SWITCH',vals:['UP','10°','20°','FULL'],sp:30,d:'FLAP'});
/* lower switch and control panel */
add({id:'primer',t:'pull',x:72,y:930,r:13,l:'PRIMER (PULL – PUSH = ONE STROKE; IN AND LOCKED)',d:'PRIMER',s:5});
add({id:'mag',t:'rotsel',x:158,y:948,r:22,keyk:1,l:'IGNITION (OFF / R / L / BOTH / START)',d:'',vals:['OFF','R','L','BOTH','START'],ang:[-80,-40,0,40,80],s:5,lr:40,spring:4,springTo:3,loop:0});
add({id:'altSw',t:'tog',rk:1,red:1,x:229,y:950,rw:16,rh:30,l:'MASTER – ALT (LEFT HALF)',d:'',top:'',bot:'ALT'});
add({id:'batSw',t:'tog',rk:1,red:1,x:247,y:950,rw:16,rh:30,l:'MASTER – BAT (RIGHT HALF)',d:'',top:'',bot:'BAT'});
add({id:'avio',t:'tog',x:304,y:952,l:'AVIONICS POWER (SWITCH / BREAKER)',d:'',sm:1,up:'AVIONICS\nPOWER',dn:'OFF',s:4.6});
[['bcn','BEACON','BCN'],['land','LANDING LIGHT','LAND'],['taxi','TAXI LIGHT','TAXI'],['navL','NAVIGATION LIGHTS','NAV'],['strobe','STROBE LIGHTS','STROBE'],['pitot','PITOT HEAT','PITOT\nHEAT']]
  .forEach(([id,l,t],i)=>add({id,t:'tog',rk:1,x:366+i*44,y:950,rw:17,rh:28,l,d:'',top:t,bot:'',s:5}));
add({id:'park',t:'pull',x:228,y:1052,r:9,tee:1,l:'PARKING BRAKE (PULL AND TURN)',d:'PARKING BRAKE',s:5});
const CBS=[]; const cbAdd=(k,l,x,y,o)=>{ const i=CBS.length; CBS.push({k,l}); add(Object.assign({id:'cb'+i,t:'cb',x,y,l:l+' CIRCUIT BREAKER',cb:k,ds:''},o||{})); };
[['ALT','ALT','ALT','60'],['FLAP','FLAP','FLAP','15'],['INST','INSTRUMENTS (FUEL / OIL TEMP GAUGES)','INST','5'],['TURN','TURN COORDINATOR','TURN\nCOORD','5'],['NAV LT','NAV LIGHTS','NAV\nLT','5'],['STROBE','STROBE','STRB','5'],['BCN','BEACON','BCN','5'],['LAND LT','LANDING LIGHT','LDG\nLT','15'],['TAXI LT','TAXI LIGHT','TAXI\nLT','10']]
  .forEach(([k,l,la,amp],i)=>cbAdd(k,l,634+i*25,914,{la,amp,fs:3.5}));
[['PITOT HT','PITOT HEAT','PITOT\nHT','10'],['COM 1','COM 1','COM 1','5'],['NAV 1','NAV 1','NAV 1','2'],['COM 2','COM 2','COM 2','5'],['NAV 2','NAV 2','NAV 2','2'],['ADF','ADF','ADF','2'],['DME','DME','DME','2'],['XPDR','TRANSPONDER','XPDR','2'],['AUDIO','AUDIO PANEL','AUDIO','2']]
  .forEach(([k,l,lb,amp],i)=>cbAdd(k,l,634+i*25,972,{lb,amp,fs:3.5}));
add({id:'carb',t:'pull',x:902,y:936,r:14,l:'CARBURETTOR HEAT (PULL ON)',d:'',top:'CARB\nHEAT',s:5});
add({id:'thr',t:'lev',kind:'pp',x:982,y:930,len:46,min:0,max:1,r:14,l:'THROTTLE (PUSH OPEN)',top:'THROTTLE',marks:[[1],[0]]});
add({id:'mix',t:'lev',kind:'pp',red:1,x:1062,y:930,len:46,min:0,max:1,r:13,l:'MIXTURE (PUSH RICH, PULL LEAN – IDLE CUT-OFF)',top:'MIXTURE',side:'RICH',marks:[[1],[0]]});
add({id:'cabHeat',t:'pull',x:1332,y:936,r:13,l:'CABIN HEAT (PULL ON)',d:'',top:'CABIN\nHEAT',s:5});
add({id:'cabAir',t:'pull',x:1404,y:936,r:13,l:'CABIN AIR (PULL ON)',d:'',top:'CABIN\nAIR',s:5});
add({id:'dimPanel',t:'rot',x:1490,y:942,r:12,l:'PANEL LIGHTS DIMMER',d:'',top:'PANEL LT',s:4.6});
add({id:'dimRadio',t:'rot',x:1556,y:942,r:12,l:'RADIO LIGHTS DIMMER',d:'',top:'RADIO LT',s:4.6});
add({id:'elt',t:'tog3',x:1300,y:446,l:'ELT REMOTE SWITCH (ON / ARM / TEST-RESET)',d:'',vals:['ON','ARM','TEST/RESET'],s:4.4,lay:'right'});
/* pedestal and floor */
add({id:'trim',t:'vwheel',x:1000,y:1092,nolab:1,l:'ELEVATOR TRIM WHEEL'});
add({id:'fuelSel',t:'rotsel',x:1000,y:1240,r:30,fuelh:1,l:'FUEL SELECTOR VALVE (LEFT / BOTH / RIGHT / OFF)',d:'',vals:['LEFT','BOTH','RIGHT','OFF'],ang:[-90,0,90,180],s:6,lr:38});
/* control wheels (seen end-on) */
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
    case 'yoke': if(c.ces){ const X=x;
        s=`<g class="mv skg" style="transform-origin:${X}px ${y}px"><path d="M${X-118} ${y-46}q-6 0-6 8v58q0 12 12 14l40 4q22 2 34-12l16-18q8-8 26-8h-0q18 0 26 8l16 18q12 14 34 12l40-4q12-2 12-14v-58q0-8-6-8h-14q-6 0-6 8v34q0 10-10 11l-26 3q-16 2-24-8l-14-16q-14-14-48-14q-34 0-48 14l-14 16q-8 10-24 8l-26-3q-10-1-10-11v-34q0-8-6-8z" class="ykC"/><rect x="${X-124}" y="${y-48}" width="26" height="52" rx="10" class="ykG"/><rect x="${X+98}" y="${y-48}" width="26" height="52" rx="10" class="ykG"/><rect x="${X-30}" y="${y-8}" width="60" height="30" rx="6" class="ykPl"/><circle cx="${X}" cy="${y+7}" r="8" class="ykHub"/><circle cx="${X-112}" cy="${y-36}" r="4" class="ykBtn"/></g>`; break; }
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
function sqcase(cx,cy,w,h,r){ return `<rect x="${cx-w/2}" y="${cy-h/2}" width="${w}" height="${h}" rx="${r}" class="icase"/>${[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b])=>`<circle cx="${(cx+a*(w/2-7)).toFixed(1)}" cy="${(cy+b*(h/2-7)).toFixed(1)}" r="2.8" class="cscr"/>`).join('')}`; }
function rcase(cx,cy,r){ return `<circle cx="${cx}" cy="${cy}" r="${r+9}" class="icase"/>${[45,135,225,315].map(a=>{ const [x,y]=pol(cx,cy,r+5,a); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" class="cscr"/>`; }).join('')}`; }
const nd=(cls,x,y,path,extra)=>`<g class="ndx ${cls}" style="transform-origin:${x}px ${y}px">${path}</g>${extra||''}`;
function card(x,y,r,cls,o){ o=o||{}; let t=''; for(let d=0;d<360;d+=5){ const L=d%30===0?r*0.16:d%10===0?r*0.11:r*0.06; const [a0,b0]=pol(x,y,r,d),[a1,b1]=pol(x,y,r-L,d); t+=`<path d="M${a0.toFixed(1)} ${b0.toFixed(1)}L${a1.toFixed(1)} ${b1.toFixed(1)}" stroke="${o.col||'#f2f2f2'}" stroke-width="${d%10?0.8:1.3}"/>`; if(d%30===0){ const [lx,ly]=pol(x,y,r*0.7,d); const s={0:'N',90:'E',180:'S',270:'W'}[d]||d/10; t+=`<text x="${lx.toFixed(1)}" y="${(ly+r*0.06).toFixed(1)}" fill="${o.col||'#f2f2f2'}" font-size="${(r*(d%90?0.15:0.19)).toFixed(1)}" font-weight="700" text-anchor="middle" font-family="IBM Plex Sans,system-ui,sans-serif" transform="rotate(${d} ${lx.toFixed(1)} ${ly.toFixed(1)})">${s}</text>`; } } return `<g class="${cls}" style="transform-origin:${x}px ${y}px">${t}</g>`; }
/* airspeed indicator: knots, white / green / yellow arcs and red line */
function asiSVG(x,y,r){ return sqcase(x,y,150,150,10)+dial('asi',x,y,r,{bz:'none',sc:[{min:30,max:170,a0:12,a1:348,maj:20,mnr:5,lab:v=>v>=40&&v<=160?v:null,fs:0.15,lr:0.66,
  arcs:[[33,85,'awhite',0.88],[44,127,'agreen'],[127,158,'ayellow']],red:[158]}],title:'AIRSPEED',ty:-0.14,tfs:0.1,unit:'KNOTS',uy:0.22,ufs:0.11}); }
/* attitude indicator (vacuum): bank scale on the moving sky/ground card, fixed index, adjustable miniature airplane */
function aiSVG(x,y,r){ let lad=''; [[-20,0.44],[-10,0.44],[-5,0.2],[5,0.2],[10,0.44],[20,0.44]].forEach(([p,w])=>{ const yy=y-p*r*0.03; lad+=`<path d="M${x-w*r/2} ${yy}h${w*r}" stroke="#fff" stroke-width="1.5"/>${Math.abs(p)%10?'':`<text x="${x+w*r/2+4}" y="${yy+3}" fill="#fff" font-size="${r*0.12}" font-family="IBM Plex Sans,sans-serif" font-weight="700">${Math.abs(p)}</text>`}`; });
  let ring=''; [-60,-30,-20,-10,10,20,30,60].forEach(b=>{ const [a0,b0]=pol(x,y,r*0.98,b), [a1,b1]=pol(x,y,r*(Math.abs(b)%30?0.88:0.84),b); ring+=`<path d="M${a0.toFixed(1)} ${b0.toFixed(1)}L${a1.toFixed(1)} ${b1.toFixed(1)}" stroke="#fff" stroke-width="${Math.abs(b)%30?1.6:2.6}"/>`; });
  [-45,45].forEach(b=>{ const [a0,b0]=pol(x,y,r*0.97,b); ring+=`<path d="M${a0.toFixed(1)} ${b0.toFixed(1)}l${(-Math.cos(b*Math.PI/180)*4).toFixed(1)} ${(6).toFixed(1)}h${(Math.cos(b*Math.PI/180)*8).toFixed(1)}z" fill="#fff" transform="rotate(${b} ${a0.toFixed(1)} ${b0.toFixed(1)})"/>`; });
  ring+=`<path d="M${x} ${y-r*0.84}l-5 -9h10z" fill="#fff"/>`;
  return sqcase(x,y,150,150,10)+`<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+3}" class="sbz2"/><clipPath id="cAIo"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><clipPath id="cAIi"><circle cx="${x}" cy="${y}" r="${r*0.82}"/></clipPath>
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
  return sqcase(x,y,150,150,10)+face.replace(/<\/g>$/,'')+T+K+Hh+`<circle cx="${x}" cy="${y}" r="4" class="hub"/></g>`; }
/* turn coordinator (electric) */
function tcSVG(x,y,r){ const mk=(a)=>{ const [a0,b0]=pol(x,y,r*0.98,a), [a1,b1]=pol(x,y,r*0.8,a); return `<path d="M${a0.toFixed(1)} ${b0.toFixed(1)}L${a1.toFixed(1)} ${b1.toFixed(1)}" stroke="#fff" stroke-width="3"/>`; };
  return sqcase(x,y,150,150,10)+`<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+3}" class="sbz2"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${mk(-90)}${mk(90)}${mk(-105)}${mk(105)}
  <text x="${x-r*0.72}" y="${y+r*0.42}" class="dnum" font-size="${r*0.16}" text-anchor="middle">L</text><text x="${x+r*0.72}" y="${y+r*0.42}" class="dnum" font-size="${r*0.16}" text-anchor="middle">R</text>
  <text x="${x}" y="${y-r*0.52}" class="dnum" font-size="${r*0.11}" text-anchor="middle">TURN COORDINATOR</text><text x="${x}" y="${y+r*0.33}" class="dnum" font-size="${r*0.11}" text-anchor="middle">2 MIN</text>
  <g class="tcp tcp-tc" style="transform-origin:${x}px ${y}px"><rect x="${x-r*0.7}" y="${y-1.8}" width="${r*1.4}" height="3.6" rx="1.2" fill="#f2f2f2"/><circle cx="${x}" cy="${y}" r="${r*0.1}" fill="#f2f2f2"/><rect x="${x-1.6}" y="${y-r*0.24}" width="3.2" height="${r*0.16}" fill="#f2f2f2"/><rect x="${x-r*0.16}" y="${y-r*0.2}" width="${r*0.32}" height="2.4" fill="#f2f2f2"/></g>
  <path d="M${x-r*0.46} ${y+r*0.5}Q${x} ${y+r*0.72} ${x+r*0.46} ${y+r*0.5}" class="balltube" stroke-width="${r*0.16}" fill="none" stroke-linecap="round"/><path d="M${x-r*0.07} ${y+r*0.53}v${r*0.14}M${x+r*0.07} ${y+r*0.53}v${r*0.14}" stroke="#111" stroke-width="1"/>
  <circle class="ball ball-tc" cx="${x}" cy="${y+r*0.6}" r="${r*0.075}" fill="#111" stroke="#444" stroke-width=".6"/>
  <text x="${x}" y="${y+r*0.86}" class="dnum" font-size="${r*0.075}" text-anchor="middle">NO PITCH INFORMATION</text><text x="${x-r*0.5}" y="${y-r*0.28}" class="dnum" font-size="${r*0.08}" text-anchor="middle">D.C.</text><text x="${x-r*0.5}" y="${y-r*0.18}" class="dnum" font-size="${r*0.08}" text-anchor="middle">ELEC.</text>
  <g class="tcflag" style="opacity:0"><rect x="${x+r*0.24}" y="${y-r*0.36}" width="${r*0.42}" height="${r*0.2}" fill="#d0281c" stroke="#000" stroke-width=".6"/><text x="${x+r*0.45}" y="${y-r*0.22}" font-size="${r*0.13}" fill="#fff" font-weight="700" text-anchor="middle" font-family="IBM Plex Sans,sans-serif">OFF</text></g></g>`; }
/* heading indicator (directional gyro): rotating card, fixed airplane */
function dgSVG(x,y,r){ let lub=''; [45,135,225,315].forEach(a=>{ const [a0,b0]=pol(x,y,r+1,a),[a1,b1]=pol(x,y,r-7,a); lub+=`<path d="M${a0.toFixed(1)} ${b0.toFixed(1)}L${a1.toFixed(1)} ${b1.toFixed(1)}" stroke="#ff8a1a" stroke-width="2.4"/>`; });
  return sqcase(x,y,150,150,10)+`<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+3}" class="sbz2"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${card(x,y,r-2,'hcard hcard-dg')}${lub}
  <path d="M${x} ${y-r-1}l-4 8h8z" fill="#ff8a1a"/><path d="M${x} ${y-r*0.42}l3 6v8l${r*0.24} ${r*0.16}v4l-${r*0.24}-${r*0.08}v${r*0.18}l7 5v3l-10-3-10 3v-3l7-5v-${r*0.18}l-${r*0.24} ${r*0.08}v-4l${r*0.24}-${r*0.16}v-8z" fill="#ff8a1a" stroke="#000" stroke-width=".5"/></g>`; }
/* vertical speed indicator */
function vsiSVG(x,y,r){ return sqcase(x,y,150,150,10)+dial('vsi',x,y,r,{bz:'none',sc:[{min:-2000,max:2000,a0:-260,a1:80,maj:500,mnr:100,lab:v=>v===0?'0':Math.abs(v)/100,fs:0.16,lr:0.68}],
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
  return sqcase(x,y,150,150,10)+`<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+3}" class="sbz2"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${card(x,y,r-1,'ocard ocard-'+n)}
  <path d="M${x} ${y-r+1}l-5 -8h10z" fill="#fff" transform="translate(0 ${r*0.0})"/><path d="M${x} ${y+r-1}l-4 8h8z" fill="#fff"/><circle cx="${x}" cy="${y+r*0.08}" r="${r*0.62}" fill="#1a1819" stroke="#555" stroke-width=".8"/>
  ${dots}<circle cx="${x}" cy="${y+r*0.08}" r="3.4" fill="none" stroke="#f2f2f2" stroke-width="1.1"/>
  <g class="cdin cdin-${n}"><rect x="${x-1.5}" y="${y-r*0.5}" width="3" height="${r*1.12}" fill="#f2f2f2"/></g>
  ${gs?`<g class="gsn gsn-${n}"><rect x="${x-r*0.5}" y="${y+r*0.08-1.5}" width="${r*1.0}" height="3" fill="#f2f2f2"/></g>`:''}
  <rect x="${x+r*0.18}" y="${y-r*0.42}" width="${r*0.34}" height="${r*0.16}" rx="1" fill="#0b0a0a" stroke="#666" stroke-width=".6"/><text class="tf tf-${n}" x="${x+r*0.35}" y="${y-r*0.3}" font-size="${r*0.12}" fill="#f2f2f2" font-weight="700" text-anchor="middle" font-family="IBM Plex Sans,sans-serif"></text>
  <g class="nflag nflag-${n}"><rect x="${x-r*0.52}" y="${y-r*0.42}" width="${r*0.34}" height="${r*0.16}" fill="#d0281c" stroke="#000" stroke-width=".5"/><text x="${x-r*0.35}" y="${y-r*0.3}" font-size="${r*0.12}" fill="#fff" font-weight="700" text-anchor="middle" font-family="IBM Plex Sans,sans-serif">NAV</text></g>
  ${gs?`<g class="gflag gflag-${n}"><rect x="${x+r*0.3}" y="${y+r*0.2}" width="${r*0.26}" height="${r*0.16}" fill="#d0281c" stroke="#000" stroke-width=".5"/><text x="${x+r*0.43}" y="${y+r*0.32}" font-size="${r*0.12}" fill="#fff" font-weight="700" text-anchor="middle" font-family="IBM Plex Sans,sans-serif">GS</text></g>`:''}
  <text x="${x}" y="${y+r*0.5}" class="dnum" font-size="${r*0.075}" text-anchor="middle">${gs?'NAV 1 · VOR LOC GS':'NAV 2 · VOR LOC'}</text></g>`; }
/* ADF relative bearing indicator */
function adfSVG(x,y,r){ return sqcase(x,y,150,150,10)+`<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+3}" class="sbz2"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${card(x,y,r-1,'acard')}
  <path d="M${x} ${y-r+1}l-5 -8h10z" fill="#ff8a1a"/><g class="adfn" style="transform-origin:${x}px ${y}px"><path d="M${x} ${y-r*0.8}l-6 14h4v${r*1.4}h4v-${r*1.4}h4z" fill="#ffcf3a" stroke="#000" stroke-width=".6"/></g>
  <path d="M${x} ${y-r*0.26}v${r*0.5}M${x-r*0.22} ${y-r*0.04}h${r*0.44}M${x-r*0.09} ${y+r*0.2}h${r*0.18}" stroke="#ff8a1a" stroke-width="2.4" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="3" class="hub"/>
  <text x="${x}" y="${y+r*0.52}" class="dnum" font-size="${r*0.13}" text-anchor="middle">ADF</text></g>`; }
/* clock, OAT, magnetic compass, flap position, hour meter */
function clockSVG(x,y,r){ let t=''; for(let i=0;i<60;i++){ const [a,b]=pol(x,y,r,i*6), [c,d]=pol(x,y,r-(i%5?r*0.07:r*0.16),i*6); t+=`<path d="M${a.toFixed(1)} ${b.toFixed(1)}L${c.toFixed(1)} ${d.toFixed(1)}" stroke="#eee" stroke-width="${i%5?0.6:1.4}"/>`; if(i%15===0){ const [lx,ly]=pol(x,y,r*0.66,i*6); t+=`<text x="${lx.toFixed(1)}" y="${(ly+r*0.09).toFixed(1)}" class="dnum" font-size="${r*0.26}" text-anchor="middle">${i/5||12}</text>`; } }
  return rcase(x,y,r)+`<g class="gauge"><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${t}${nd('clkh',x,y,`<path d="M${x-2} ${y+4}L${x} ${y-r*0.5}L${x+2} ${y+4}z" fill="#eee"/>`)}${nd('clkm',x,y,`<path d="M${x-1.6} ${y+5}L${x} ${y-r*0.8}L${x+1.6} ${y+5}z" fill="#eee"/>`)}${nd('clks',x,y,`<path d="M${x} ${y+8}V${y-r*0.86}" stroke="#ff5a1f" stroke-width="1"/>`)}<circle cx="${x}" cy="${y}" r="2.6" class="hub"/></g>`; }
function oatSVG(x,y,r){ return `<path d="M${x} ${y-r-26}v${26}" stroke="#7d8287" stroke-width="5"/>`+dial('oat',x,y,r,{sc:[{min:-40,max:50,a0:-135,a1:135,maj:20,mnr:10,lab:v=>v,fs:0.24,lr:0.64}],title:'°C',ty:0.42,tfs:0.24,extra:`<text x="${x}" y="${y-r*0.28}" class="dnum" font-size="${r*0.18}" text-anchor="middle">OAT</text>`}); }
function compassSVG(x,y){ const w=150,h=56, k=1.9; let s='';
  for(let d=-90;d<=450;d+=5){ const X=x-d*k, L=d%30===0?16:d%10===0?10:6; s+=`<path d="M${X.toFixed(1)} ${y+h*0.5-2}v-${L}" stroke="#111" stroke-width="${d%10?0.9:1.4}"/>`; if(d%30===0){ const v=((d%360)+360)%360; const t={0:'N',90:'E',180:'S',270:'W'}[v]||v/10; s+=`<text x="${X.toFixed(1)}" y="${y-2}" fill="#111" font-size="${v%90?13:16}" font-weight="700" text-anchor="middle" font-family="IBM Plex Sans,sans-serif">${t}</text>`; } }
  return `<path d="M${x-14} 0V${y-h/2-14}h28V0" class="cmpstrip"/><rect x="${x-w/2-14}" y="${y-h/2-12}" width="${w+28}" height="${h+30}" rx="16" class="cmpbody"/><clipPath id="cCmp"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="8"/></clipPath>
  <rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="8" fill="#e9e3cf"/><g clip-path="url(#cCmp)"><g class="cmp" style="transform:translateX(0px)">${s}</g></g><path d="M${x} ${y-h/2}V${y+h/2}" stroke="#d0281c" stroke-width="2.4"/><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="8" fill="url(#gCmpGlass)"/>
  <rect x="${x-46}" y="${y+h/2+4}" width="92" height="12" rx="2" class="cmpcard"/>${lab(x,y+h/2+12.5,'FOR  N 30 60 E 120 150',{s:4.4,c:'dk'})}`; }
function flapIndSVG(x,y){ const sp=30, y0=y-45; let t=`<rect x="${x-14}" y="${y0-16}" width="28" height="${3*sp+32}" rx="4" class="fplate"/><rect x="${x-4}" y="${y0-4}" width="8" height="${3*sp+8}" rx="3" class="slot"/>`;
  ['0°','10°','20°','30°'].forEach((v,i)=>{ t+=`<path d="M${x-12} ${y0+i*sp}h6" stroke="#f2f2f2" stroke-width="1.4"/>`+lab(x-16,y0+i*sp+2.4,v,{s:6.4,a:'end'}); });
  return t+`<g class="flapp" style="transform:translateY(0px)"><path d="M${x+6} ${y0}l-10 -5v10z" fill="#ffcf3a" stroke="#000" stroke-width=".6"/></g>${lab(x-8,y0+3*sp+26,'FLAP POSITION',{s:5})}`; }
/* radio stack units */
function rUnit(x0,y0,w,h){ return `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="3" class="avu"/>`; }
function rWin(x,y,w,h,cls,txt,fs){ return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" class="digw"/><text class="dig ${cls}" x="${x+w-5}" y="${y+h*0.74}" font-size="${fs||h*0.68}" text-anchor="end">${txt}</text>`; }
function stackSVG(){ const x0=STK.x, w=STK.w; let s=`<rect x="${x0-6}" y="${RU.aud[0]-6}" width="${w+12}" height="${RU.xp[0]+RU.xp[1]-RU.aud[0]+12}" rx="4" class="stackbay"/>`;
  { const [y0,h]=RU.aud; s+=rUnit(x0,y0,w,h)+lab(x0+12,y0+12,'AUDIO',{s:4.6,a:'start'});
    [['O','b',0],['M','a',1],['A','w',2]].forEach(([t,c,i])=>{ const cx=x0+20+i*14, cy=y0+32; s+=`<g class="an an-${c}" data-a="mk${t}"><circle cx="${cx}" cy="${cy}" r="6"/><text x="${cx}" y="${cy+2.6}" font-size="7.4" text-anchor="middle">${t}</text></g>`; });
    s+=lab(x0+40,y0+50,'MARKER',{s:3.8}); }
  [['1',RU.nc1],['2',RU.nc2]].forEach(([n,[y0,h]])=>{ s+=rUnit(x0,y0,w,h)+lab(x0+12,y0+10,'COMM '+n,{s:4.2,a:'start'})+lab(x0+200,y0+10,'NAV '+n,{s:4.2,a:'start'});
    s+=rWin(x0+34,y0+15,68,22,'rc'+n+'a','118.100',13.5)+rWin(x0+106,y0+15,64,22,'rc'+n+'s','121.500',12.5)+rWin(x0+196,y0+15,56,22,'rn'+n+'a','110.30',13.5)+rWin(x0+256,y0+15,54,22,'rn'+n+'s','113.30',12.5);
    s+=lab(x0+68,y0+45,'USE',{s:3.6})+lab(x0+138,y0+45,'STBY',{s:3.6})+lab(x0+224,y0+45,'USE',{s:3.6})+lab(x0+283,y0+45,'STBY',{s:3.6})+lab(x0+20,y0+74,'PWR · VOL',{s:3.4}); });
  { const [y0,h]=RU.adf; s+=rUnit(x0,y0,w,h)+lab(x0+12,y0+10,'ADF',{s:4.2,a:'start'})+rWin(x0+40,y0+14,56,24,'radfa','375')+rWin(x0+104,y0+14,56,24,'radfs','287',14)+lab(x0+68,y0+47,'USE',{s:3.6})+lab(x0+132,y0+47,'STBY',{s:3.6})+lab(x0+236,y0+30,'ANT / ADF\nFRQ ⇆',{s:3.6,a:'start'}); }
  { const [y0,h]=RU.dme; s+=rUnit(x0,y0,w,h)+lab(x0+12,y0+9,'DME',{s:4.2,a:'start'})+rWin(x0+50,y0+8,62,24,'dmed','---.-')+rWin(x0+124,y0+8,48,24,'dmek','---')+rWin(x0+184,y0+8,48,24,'dmem','--')+lab(x0+81,y0+38,'NM',{s:3.6})+lab(x0+148,y0+38,'KT',{s:3.6})+lab(x0+208,y0+38,'MIN',{s:3.6})+lab(x0+22,y0+38,'PWR',{s:3.4}); }
  { const [y0,h]=RU.xp; s+=rUnit(x0,y0,w,h)+lab(x0+60,y0+10,'TRANSPONDER',{s:4.2,a:'start'})+rWin(x0+66,y0+16,74,26,'rxp','1200',16)+`<text class="dig rxpm" x="${x0+70}" y="${y0+26}" font-size="6.5">ALT</text>`+`<g class="an an-a" data-a="xpR"><circle cx="${x0+150}" cy="${y0+22}" r="4.2"/></g>`+lab(x0+150,y0+34,'R',{s:3.6})+lab(x0+228,y0+12,'CODE',{s:3.8})+lab(x0+100,y0+50,'ALT · PRESSURE ALTITUDE',{s:3.2}); }
  return s; }
const ANN={};

/* ---------- the panel ---------- */
const MAGS={compass:[1112,24],cbs:[846,892],quad:[1266,892],audio:[1206,282],radios:[1206,512],flaps:[1206,680],pedestal:[1206,1018],rlower:[1966,892],switches:[600,892],nav:[856,300],low6:[700,652],left:[200,292],six:[700,292],right:[1966,292]};
function panelSVG(){
  const PT=280, PB=880, LB=1005;
  const placard=(x,y,w,h,lines,fs)=>{ const hh=Math.min(h,fs*0.9+lines.length*fs*1.32+fs*0.6); return `<rect x="${x}" y="${y}" width="${w}" height="${hh.toFixed(1)}" rx="3" class="plq"/>`+lines.map((t,i)=>lab(x+w/2,y+fs*1.5+i*fs*1.32,t,{s:fs})).join(''); };
  return `<svg class="psvg" viewBox="0 0 ${W} ${H}" xmlns="${NS}">
<defs>
 <linearGradient id="gPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34302d"/><stop offset="1" stop-color="#2a2725"/></linearGradient>
 <linearGradient id="gLow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22201f"/><stop offset="1" stop-color="#181716"/></linearGradient>
 <linearGradient id="gGlare" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2826"/><stop offset=".7" stop-color="#1b1918"/><stop offset="1" stop-color="#0f0e0d"/></linearGradient>
 <linearGradient id="gHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c968c"/><stop offset="1" stop-color="#6e6961"/></linearGradient>
 <linearGradient id="gPillar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a4640"/><stop offset="1" stop-color="#2a2724"/></linearGradient>
 <linearGradient id="gFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1b1a"/><stop offset="1" stop-color="#2a2622"/></linearGradient>
 <linearGradient id="gPed" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f1d1c"/><stop offset=".5" stop-color="#34302d"/><stop offset="1" stop-color="#1f1d1c"/></linearGradient>
 <linearGradient id="gCmpGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
 <radialGradient id="gKnob" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#6a6f76"/><stop offset=".6" stop-color="#2a2d31"/><stop offset="1" stop-color="#121417"/></radialGradient>
 <radialGradient id="gKnob2" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#7a828c"/><stop offset=".7" stop-color="#363b42"/><stop offset="1" stop-color="#1a1d21"/></radialGradient>
 <radialGradient id="gMetal" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#f6f7f8"/><stop offset=".45" stop-color="#b1b6bb"/><stop offset="1" stop-color="#5a6067"/></radialGradient>
 <radialGradient id="gChrome" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#9a9fa5"/><stop offset=".8" stop-color="#e2e4e6"/><stop offset="1" stop-color="#6d7277"/></radialGradient>
 <radialGradient id="gRed" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#ff6a5a"/><stop offset=".6" stop-color="#b8231a"/><stop offset="1" stop-color="#5a0c06"/></radialGradient>
 <radialGradient id="gBlackK" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#5a5a5a"/><stop offset=".6" stop-color="#1c1c1c"/><stop offset="1" stop-color="#050505"/></radialGradient>
 <linearGradient id="gBat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d949b"/><stop offset=".45" stop-color="#f4f6f8"/><stop offset="1" stop-color="#6f767d"/></linearGradient>
 <linearGradient id="gBatR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8f1d14"/><stop offset=".45" stop-color="#ef4a3a"/><stop offset="1" stop-color="#7d160f"/></linearGradient>
 <linearGradient id="gYoke" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#55504a"/><stop offset="1" stop-color="#1e1c1a"/></linearGradient>
 <filter id="fLed" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="fShadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity=".6"/></filter>
</defs>
<!-- cabin: headliner, windshield posts, centre strip with the magnetic compass, OAT probe -->
<path d="M0 0H${W}V30Q${W/2} 52 0 30Z" class="headl"/>
<path d="M0 0H64L30 ${PT}H0Z" class="pillar"/><path d="M${W} 0H${W-64}L${W-30} ${PT}H${W}Z" class="pillar"/>
<path d="M0 30Q240 58 520 60" class="wshl"/><path d="M${W} 30Q${W-240} 58 ${W-520} 60" class="wshl"/>
${compassSVG(1000,120)}
${oatSVG(300,206,24)}
<!-- glareshield and instrument panel -->
<path d="M14 ${PT}V262Q${W/2} 196 ${W-14} 262V${PT}Z" class="glare"/>
<path d="M14 ${PT}H${W-14}" stroke="#000" stroke-width="2"/>
<rect x="14" y="${PT}" width="${W-28}" height="${PB-PT}" rx="6" class="ipanel"/>
<rect x="14" y="${PB}" width="${W-28}" height="${LB-PB}" rx="4" class="lpanel"/>
<path d="M14 ${PB}H${W-14}" class="seam"/>
${[[30,296],[W-30,296],[30,PB-14],[W-30,PB-14],[850,296],[1230,296],[850,PB-14],[1230,PB-14]].map(([x,y])=>screw(x,y)).join('')}
<!-- left column: clock, suction, ammeter, LOW VOLTAGE light, fuel quantity, oil -->
${clockSVG(LX,345,38)}${suctionSVG(LX,445,34)}${ammSVG(LX,545,34)}
${lampBox('lowv',LX-30,594,60,18,['LOW','VOLTAGE'],'r',6.4)}
${fuelSVG(LX,690,40)}${oilSVG(LX,808,40)}
<!-- six-pack -->
${asiSVG(SX[0],SY[0],IR)}${aiSVG(SX[1],SY[0],IR)}${altSVG(SX[2],SY[0],IR)}
${tcSVG(SX[0],SY[1],IR)}${dgSVG(SX[1],SY[1],IR)}${vsiSVG(SX[2],SY[1],IR)}
<g class="cov cov-ai" style="opacity:0"><circle cx="${SX[1]}" cy="${SY[0]}" r="${IR+6}" class="covr"/><text x="${SX[1]}" y="${SY[0]+5}" class="covt" font-size="13" text-anchor="middle">INOP</text></g>
<g class="cov cov-dg" style="opacity:0"><circle cx="${SX[1]}" cy="${SY[1]}" r="${IR+6}" class="covr"/><text x="${SX[1]}" y="${SY[1]+5}" class="covt" font-size="13" text-anchor="middle">INOP</text></g>
<!-- below the six-pack: tachometer, EGT, covers, control column -->
${tachSVG(SX[0],722,56)}${egtSVG(SX[2],722,40)}
${lab(SX[1],694,'INSTRUMENT COVERS',{s:4.4})}
<circle cx="${YK.L[0]}" cy="838" r="26" class="colbush"/><circle cx="${YK.L[0]}" cy="838" r="16" class="colhole"/>
<!-- NAV indicators and ADF -->
${cdiSVG('1',NX,SY[0],58,true)}${cdiSVG('2',NX,SY[1],58,false)}${adfSVG(NX,722,54)}
<!-- radio stack -->
${stackSVG()}
<!-- below the stack: flap position, placards -->
${flapIndSVG(1132,772)}
${placard(880,700,200,52,['MANEUVERING SPEED 99 KIAS','(AT 2,400 LB)'],6)}
${placard(880,740,200,58,['FLAP LIMITS','10° — 110 KIAS','10°–30° — 85 KIAS'],6)}
${placard(880,790,200,52,['NO INTENTIONAL SPINS','WITH FLAPS EXTENDED'],6)}
<!-- right panel: hour meter, ELT, limitations placard, vent, glove box -->
<rect x="1252" y="318" width="96" height="40" rx="3" class="plq"/>${rWin(1262,326,76,20,'hobbs','1234.5',13)}${lab(1300,370,'FLIGHT HOURS',{s:4.6})}
<rect x="1262" y="404" width="86" height="88" rx="4" class="plq"/>${lab(1305,416,'ELT',{s:6})}
${placard(1380,318,500,126,['THIS AIRPLANE MUST BE OPERATED AS A NORMAL OR UTILITY CATEGORY','AIRPLANE IN COMPLIANCE WITH THE OPERATING LIMITATIONS STATED IN','THE FORM OF PLACARDS, MARKINGS AND MANUALS.','—  TYPICAL TRAINING PLACARD (GENERIC WORDING)  —','DAY · NIGHT · VFR · IFR — NO FLIGHT INTO KNOWN ICING'],7)}
${placard(1380,392,500,84,['FUEL: 40 U.S. GAL USABLE (20 PER TANK) — 100LL','TAKE-OFF AND LANDING ON "BOTH"','CARBURETTOR HEAT: FULL HOT OR FULL COLD'],7)}
${placard(1380,446,240,76,['UTILITY CATEGORY','NO SPINS ABOVE 2,100 LB','NO ACROBATIC MANEUVERS'],6)}
<circle cx="1930" cy="330" r="24" class="vent"/><circle cx="1930" cy="330" r="13" class="vent2"/>
<rect x="1560" y="680" width="380" height="182" rx="10" class="glove"/><rect x="1715" y="694" width="70" height="12" rx="5" class="latch"/>${lab(1750,790,'MAP COMPARTMENT',{s:7,c:'dim'})}
<circle cx="${YK.R[0]}" cy="838" r="26" class="colbush"/><circle cx="${YK.R[0]}" cy="838" r="16" class="colhole"/>
<!-- lower switch and control panel labels -->
${lab(238,920,'MASTER',{s:5.4})}<path d="M218 925h40" class="grpl"/>
${brk(342,598,906,'LIGHTS',{s:4.6})}
${lab(158,992,'IGNITION',{s:4.4})}
<rect x="616" y="890" width="236" height="104" rx="4" class="cbpan"/>${lab(734,902+44,'CIRCUIT BREAKERS',{s:4.2,c:'dim'})}
<path d="M940 ${PB+4}V${LB-4}M1104 ${PB+4}V${LB-4}" class="seam"/>
${lab(1062,996,'LEAN ↓',{s:4.2})}${lab(982,996,'CLOSED ↓',{s:4.2})}
<!-- floor, pedestal, rudder pedals, fuel selector plate -->
<rect x="0" y="${LB}" width="${W}" height="${H-LB}" class="floor"/>
<path d="M930 ${LB}h140l18 ${H-LB}h-176z" class="ped"/>
${[[300,1250],[380,1250],[1620,1250],[1700,1250]].map(([x,y])=>`<rect x="${x-24}" y="${y-30}" width="48" height="60" rx="8" class="pedal"/><path d="M${x-16} ${y-20}h32M${x-16} ${y-8}h32M${x-16} ${y+4}h32M${x-16} ${y+16}h32" class="pedalr"/>`).join('')}
<circle cx="1000" cy="1240" r="58" class="fsplate"/>${lab(1000,1312,'FUEL SELECTOR — 40 GAL USABLE',{s:5})}${lab(930,1206,'20 GAL',{s:4.2})}${lab(1070,1206,'20 GAL',{s:4.2})}
${lab(1000,1028,'NOSE DOWN',{s:4.6})}${lab(1000,1162,'NOSE UP',{s:4.6})}${lab(958,1096,'ELEVATOR\nTRIM',{s:4.4,a:'end'})}
<g class="ctls">${C.map(ctlSVG).join('')}</g>
<g class="mags">${Object.keys(MAGS).map(k=>{ const [x,y]=MAGS[k]; return `<g class="mag" data-z="${k}" tabindex="0" role="button" aria-label="Zoom ${k}"><circle cx="${x}" cy="${y}" r="11"/><circle cx="${x-2}" cy="${y-2}" r="4.5" class="mgl"/><path d="M${x+2} ${y+2}l4.5 4.5" class="mgl"/></g>`; }).join('')}</g>
</svg>`;
}

/* ---------- build ---------- */
function build(stage,io){
  const world=document.createElement('div'); world.className='world'; world.style.width=W+'px'; world.style.height=H+'px';
  world.innerHTML=panelSVG(); stage.appendChild(world);
  const svg=world.querySelector('svg'), byId={};
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
    Z.forEach(z=>{ if(z.x1<=z.x0||z.y1<=z.y0) return; const h=document.createElementNS(NS,'rect'); h.setAttribute('class','hit'); h.dataset.for=z.o.c.id; h.setAttribute('x',z.x0); h.setAttribute('y',z.y0); h.setAttribute('width',z.x1-z.x0); h.setAttribute('height',z.y1-z.y0); layer.appendChild(h); }); });
  bind(world,byId,io);
  return {world,svg,byId,W,H,REG,REG_ORDER,C,CBS,q:{}};
}

/* ---------- interaction ---------- */
function ctlFromBy(byId,t){ if(!t||!t.closest) return null; const g=t.closest('g.ctl'); if(g) return g; const h=t.closest('.hit'); return h&&byId[h.dataset.for]?byId[h.dataset.for].g:null; }
function levSnap(c,v){ const rng=c.max-c.min; for(const [m] of c.marks||C.find(k=>k.kind===c.kind&&k.marks).marks){ if(Math.abs(v-m)<rng*0.035) return m; } return v; }
const MOM=c=>c.mom||c.t==='push'||c.t==='mbtn'||c.t==='sbtn'||c.t==='bar'||(c.t==='abtn'&&c.momentary)||(c.t==='key'&&!c.alt);
function bind(world,byId,io){
  const ctlFrom=t=>ctlFromBy(byId,t);
  const svg=world.querySelector('svg'); const pt0=svg.createSVGPoint();
  const toW=e=>{ pt0.x=e.clientX; pt0.y=e.clientY; const p=pt0.matrixTransform(svg.getScreenCTM().inverse()); return {x:p.x,y:p.y}; };
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
  world.addEventListener('wheel',e=>{ const g=ctlFrom(e.target); if(!g) return; const o=byId[g.dataset.id]; if(!['rot','enc','enc2','rotsel','vwheel','hwheel','lev','flap'].includes(o.c.t)) return; e.preventDefault(); e.stopPropagation(); if(e.ctrlKey) return; const raw=(Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:-e.deltaX)*(e.deltaMode?40:1); wacc+=raw; if(Math.abs(wacc)<30) return; const d=wacc<0?1:-1; wacc=0;
    if(o.c.t==='vwheel') return step(o,-d); step(o,d,o.c.t==='enc2'&&(e.shiftKey||inner(o.c,toW(e)))); },{passive:false});
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
    if(c.t==='yoke'){ drag={o,stk:1,x:pt.x,y:pt.y}; try{ g.setPointerCapture(e.pointerId); }catch(_){} g.classList.add('drag'); io.set('stick',{x:0,y:0}); return; }
    if(c.t==='tog3'){ const v=io.get(c.id); const q=(c.horiz?pt.x-c.x:pt.y-c.y)/(c.sc||1); const t=q<-7?-1:q>7?1:(v!==0?0:-1); io.set(c.id,t===v?0:t); if(c.spring){ drag={o,spr:1}; try{ g.setPointerCapture(e.pointerId); }catch(_){} } return; }
    if(c.t==='guard'){ const onGuard=e.target.closest('.gd'); const gk=c.id+'G'; if(onGuard||!io.get(gk)){ io.set(gk,io.get(gk)?0:1); return; } io.set(c.id,io.get(c.id)?0:1); return; }
    step(o,0);
  });
  world.addEventListener('pointermove',e=>{ if(!drag||drag.mom||drag.spr) return; const c=drag.o.c, pt=toW(e);
    if(drag.tg){ const dy=pt.y-drag.y; if(!drag.done&&Math.abs(dy)>6){ drag.done=1; io.set(c.id,dy<0?1:0); } return; }
    if(drag.stk){ io.set('stick',{x:clamp((pt.x-drag.x)/60,-1,1),y:clamp((pt.y-drag.y)/40,-1,1)}); return; }
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
}

/* ---------- render state ---------- */
const cache={};
function setT(el,t){ if(el&&el._t!==t){ el._t=t; el.style.transform=t; } }
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
const q=(P,cls)=>P.q[cls]||(P.q[cls]=P.svg.querySelector('.'+cls));
function needle(P,id,v,k){ const g=GA[id]; if(!g) return; const sc=g.sc.find(s=>(s.nd||'')===(k||''))||g.sc[0]; const a=angOf(sc,v); const el=q(P,'nd-'+id+(k||'')); if(el) setT(el,`rotate(${a.toFixed(1)}deg)`); }
function text(P,cls,t){ setTx(q(P,cls),t); }
function rot(P,cls,deg){ setT(q(P,cls),`rotate(${(+deg).toFixed(1)}deg)`); }
function tr(P,cls,t){ setT(q(P,cls),t); }
function vis(P,cls,on){ const el=q(P,cls); if(el&&el._v!==on){ el._v=on; el.style.opacity=on?1:0; } }
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
G.C172P={ctlFrom:(P,t)=>ctlFromBy(P.byId,t),build,sync,syncYokes,gauges,needle,text,rot,tr,vis,ann,REG,REG_ORDER,W,H,CBS,MAGS};
})(window);
