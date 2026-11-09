/* Birdbird – classic analog King Air B200-style panel drawn in SVG (world units 1600×1000).
   Generic training layout drawn by Birdbird from general type knowledge; not a manufacturer drawing.
   Interaction framework shared with da42panel.js. Controls report through io.get/io.set. */
(function(G){
'use strict';
const W=1600, H=1000, NS='http://www.w3.org/2000/svg';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- regions for zoom ---------- */
const REG={
  overview:[0,52,1600,948],
  glare:[180,55,1240,105],
  flight:[30,155,600,435],
  engines:[625,155,290,435],
  radio:[895,155,275,435],
  copilot:[1165,155,425,435],
  lower:[30,585,560,215],
  center:[585,585,380,215],
  right:[960,585,630,215],
  pedestal:[550,795,575,205],
  fuel:[10,800,240,200]
};
const REG_ORDER=['fuel','pedestal','lower','center','right','glare','engines','radio','flight','copilot'];

/* ---------- layout: every control ---------- */
const C=[]; const add=o=>{ C.push(o); return o; };
// glareshield
add({id:'mwL',t:'mbtn',x:240,y:104,w:58,h:34,l1:'MASTER',l2:'WARNING',col:'r',l:'MASTER WARNING (L)'});
add({id:'mcL',t:'mbtn',x:306,y:104,w:58,h:34,l1:'MASTER',l2:'CAUTION',col:'a',l:'MASTER CAUTION (L)'});
add({id:'fireL',t:'mbtn',x:560,y:94,w:74,h:26,l1:'L ENG FIRE',l2:'PUSH TO EXT',col:'r',l:'L ENGINE FIRE – PUSH TO EXTINGUISH'});
add({id:'fireR',t:'mbtn',x:1040,y:94,w:74,h:26,l1:'R ENG FIRE',l2:'PUSH TO EXT',col:'r',l:'R ENGINE FIRE – PUSH TO EXTINGUISH'});
add({id:'annTest',t:'push',x:1112,y:104,r:9,l:'ANN TEST'});
add({id:'mcR',t:'mbtn',x:1294,y:104,w:58,h:34,l1:'MASTER',l2:'CAUTION',col:'a',l:'MASTER CAUTION (R)'});
add({id:'mwR',t:'mbtn',x:1360,y:104,w:58,h:34,l1:'MASTER',l2:'WARNING',col:'r',l:'MASTER WARNING (R)'});
// flight-instrument knobs
add({id:'hdgK',t:'enc',x:205,y:542,r:11,l:'HDG'});
add({id:'crsK',t:'enc',x:320,y:542,r:11,l:'CRS'});
add({id:'baroK',t:'enc',x:480,y:304,r:9,l:'BARO'});
// radios and autopilot / flight director controller
add({id:'comSw',t:'abtn',x:1080,y:238,l:'⇄',momentary:1}); add({id:'comK',t:'enc',x:1138,y:238,r:11,l:'COM'});
add({id:'navSw',t:'abtn',x:1080,y:318,l:'⇄',momentary:1}); add({id:'navK',t:'enc',x:1138,y:318,r:11,l:'NAV'});
add({id:'xpdrMode',t:'rotsel',x:1040,y:398,l:'XPDR',vals:['OFF','SBY','ON','ALT'],ang:[-60,-20,20,60]});
add({id:'xpdrId',t:'abtn',x:1110,y:398,l:'IDENT',momentary:1});
[['AP','AP'],['YD','YD'],['FD','FD'],['HDG','HDG'],['NAV','NAV'],['APR','APR'],['ALT','ALT'],['VS','VS'],['UP','UP'],['DN','DN']].forEach(([k,l],i)=>add({id:'ap'+k,t:'abtn',x:934+(i%5)*48,y:i<5?462:496,l,momentary:1}));
add({id:'altSel',t:'enc',x:948,y:540,r:11,l:'ALT SEL'});
// left subpanel – row 1: electrical and engine
add({id:'bat',t:'tog',x:70,y:628,l:'BATTERY',sm:1});
add({id:'genL',t:'tog3',x:112,y:628,l:'GEN L',vals:['RESET','ON','OFF']});
add({id:'genR',t:'tog3',x:160,y:628,l:'GEN R',vals:['RESET','ON','OFF']});
add({id:'avio',t:'tog',x:214,y:628,l:'AVIONICS',sm:1});
add({id:'ignL',t:'tog3',x:262,y:628,l:'IGN & START L',vals:['ON','OFF','STARTER ONLY']});
add({id:'ignR',t:'tog3',x:318,y:628,l:'IGN & START R',vals:['ON','OFF','STARTER ONLY']});
add({id:'aignL',t:'tog',x:376,y:628,l:'AUTO IGN L',sm:1,up:'ARM'});
add({id:'aignR',t:'tog',x:418,y:628,l:'AUTO IGN R',sm:1,up:'ARM'});
add({id:'afSw',t:'tog3',x:468,y:628,l:'AUTOFEATHER',vals:['ARM','OFF','TEST']});
add({id:'sync',t:'tog',x:532,y:628,l:'PROP SYNC',sm:1});
// row 2: lights
[['beacon','BEACON'],['strobe','STROBE'],['navLt','NAV'],['recog','RECOG'],['taxi','TAXI'],['ldg','LANDING']].forEach(([id,l],i)=>add({id,t:'tog',x:70+i*44,y:698,l,sm:1}));
add({id:'dimPanel',t:'rot',x:348,y:696,r:10,l:'PANEL LT'});
add({id:'dimInst',t:'rot',x:398,y:696,r:10,l:'INSTR LT'});
add({id:'signs',t:'tog',x:448,y:698,l:'NO SMK/FSB',sm:1});
add({id:'park',t:'pull',x:528,y:696,l:'PARKING BRAKE'});
// row 3: ice and rain protection
add({id:'vaneL',t:'tog',x:70,y:767,l:'ICE VANE L',sm:1,up:'EXT'});
add({id:'vaneR',t:'tog',x:114,y:767,l:'ICE VANE R',sm:1,up:'EXT'});
add({id:'surf',t:'tog3',x:156,y:767,l:'SURF DEICE',vals:['SINGLE','OFF','MANUAL']});
add({id:'propDe',t:'tog3',x:212,y:767,l:'PROP DEICE',vals:['AUTO','OFF','MANUAL']});
add({id:'wsL',t:'tog3',x:268,y:767,l:'WSHLD L',vals:['NORMAL','OFF','HIGH']});
add({id:'wsR',t:'tog3',x:324,y:767,l:'WSHLD R',vals:['NORMAL','OFF','HIGH']});
add({id:'pitL',t:'tog',x:382,y:767,l:'PITOT L',sm:1});
add({id:'pitR',t:'tog',x:422,y:767,l:'PITOT R',sm:1});
add({id:'fvL',t:'tog',x:462,y:767,l:'FUEL VENT L',sm:1});
add({id:'fvR',t:'tog',x:502,y:767,l:'FUEL VENT R',sm:1});
add({id:'stallHt',t:'tog',x:546,y:767,l:'STALL WARN',sm:1});
add({id:'gear',t:'gear',x:612,y:696,l:'LANDING GEAR'});
// centre lower: pressurisation controller and tests
add({id:'cabAlt',t:'enc',x:690,y:738,r:13,l:'CABIN ALT'});
add({id:'cabRate',t:'rot',x:828,y:738,r:11,l:'RATE'});
add({id:'pressSw',t:'tog3',x:872,y:738,l:'CABIN PRESS',vals:['DUMP','PRESS','TEST']});
add({id:'fireTest',t:'push',x:935,y:732,r:9,l:'FIRE DET TEST'});
// right subpanel
add({id:'bleedL',t:'tog3',x:996,y:628,l:'BLEED AIR L',vals:['OPEN','ENVIR OFF','INSTR OFF']});
add({id:'bleedR',t:'tog3',x:1060,y:628,l:'BLEED AIR R',vals:['OPEN','ENVIR OFF','INSTR OFF']});
add({id:'cabMode',t:'rotsel',x:1140,y:632,l:'CABIN TEMP MODE',vals:['OFF','AUTO','COOL','HEAT'],ang:[-60,-20,20,60]});
add({id:'cabTemp',t:'rot',x:1208,y:630,r:11,l:'CABIN TEMP'});
add({id:'blower',t:'tog3',x:1254,y:628,l:'VENT BLOWER',vals:['HIGH','LOW','AUTO']});
add({id:'rudBoost',t:'tog',x:1320,y:628,l:'RUDDER BOOST',sm:1});
add({id:'elTrim',t:'tog',x:1372,y:628,l:'ELEC TRIM',sm:1});
add({id:'mask',t:'tog',x:1430,y:628,l:'CREW O2 MASK',sm:1,up:'ON'});
add({id:'paxO2',t:'tog',x:1490,y:628,l:'PAX O2 DEPLOY',sm:1,up:'MAN'});
add({id:'inv',t:'tog3',x:1000,y:698,l:'INVERTER',vals:['NO 1','OFF','NO 2']});
add({id:'brakeDe',t:'tog',x:1062,y:698,l:'BRAKE DEICE',sm:1});
add({id:'cabLt',t:'tog',x:1108,y:698,l:'CABIN LT',sm:1});
add({id:'micSel',t:'tog',x:1154,y:698,l:'MIC MASK',sm:1,up:'MASK'});
const CBS=['START L','START R','IGN L','IGN R','AUTOFEATHER','GEAR','FLAP','AUTOPILOT','STBY PUMP L','STBY PUMP R'];
CBS.forEach((n,i)=>add({id:'cb'+i,t:'cb',x:1214+(i%5)*40,y:i<5?684:722,l:n}));
// fuel side console
add({id:'stbyL',t:'tog',x:52,y:848,l:'STBY PUMP L',sm:1});
add({id:'stbyR',t:'tog',x:100,y:848,l:'STBY PUMP R',sm:1});
add({id:'xfeed',t:'tog3',x:150,y:848,l:'CROSSFEED',vals:['LEFT','OFF','RIGHT']});
add({id:'fwL',t:'guard',x:62,y:945,l:'FIREWALL L',up:'OPEN'});
add({id:'fwR',t:'guard',x:128,y:945,l:'FIREWALL R',up:'OPEN'});
// pedestal
add({id:'trim',t:'vwheel',x:592,y:895,l:'ELEVATOR TRIM'});
add({id:'pwrL',t:'lev',x:642,y:822,len:126,min:-0.4,max:1,kind:'pwr',l:'POWER L',mk:1,marks:[[1,'MAX'],[0,'IDLE'],[-0.12,'BETA'],[-0.4,'REV']]});
add({id:'pwrR',t:'lev',x:690,y:822,len:126,min:-0.4,max:1,kind:'pwr',l:'POWER R'});
add({id:'propL',t:'lev',x:766,y:822,len:126,min:0,max:1,kind:'prop',l:'PROP L',mk:1,marks:[[1,'2000'],[0.12,'1600'],[0,'FTHR']]});
add({id:'propR',t:'lev',x:810,y:822,len:126,min:0,max:1,kind:'prop',l:'PROP R'});
add({id:'condL',t:'lev',x:884,y:822,len:126,min:0,max:1,kind:'cond',l:'CONDITION L',mk:1,marks:[[1,'HI IDLE'],[0.5,'LO IDLE'],[0,'CUTOFF']]});
add({id:'condR',t:'lev',x:926,y:822,len:126,min:0,max:1,kind:'cond',l:'CONDITION R'});
add({id:'flaps',t:'flap',x:1010,y:852,l:'FLAPS',vals:['UP','APPR','DOWN']});
add({id:'rudTrim',t:'hwheel',x:1006,y:936,l:'RUDDER TRIM'});
add({id:'ailTrim',t:'rot',x:1088,y:952,r:10,l:'AIL TRIM'});
// control wheels
add({id:'yokeL',t:'yoke',x:360,y:905,l:'CONTROL WHEEL'}); add({id:'yokeR',t:'yoke',x:1290,y:905,l:'CONTROL WHEEL',co:1});
add({id:'apDisc',t:'sbtn',x:360,y:905,l:'AP DISC',dx:-84,dy:-30,col:'#c62a1d'});
add({id:'trimDn',t:'sbtn',x:360,y:905,l:'TRIM NOSE DN',dx:-70,dy:-42,col:'#59616b',r:4}); add({id:'trimUp',t:'sbtn',x:360,y:905,l:'TRIM NOSE UP',dx:-70,dy:-32,col:'#59616b',r:4});

/* ---------- SVG helpers ---------- */
function lab(x,y,t,o){ o=o||{}; return `<text x="${x}" y="${y}" class="pl ${o.c||''}" style="font-size:calc(var(--ls,1)*${o.s||7}px)" text-anchor="${o.a||'middle'}">${esc(t)}</text>`; }
function plate(x,y,w,h,r,cls){ return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r||6}" class="${cls||'sub'}"/>`; }
function screw(x,y){ return `<g class="screw"><circle cx="${x}" cy="${y}" r="3"/><path d="M${x-2} ${y-1}l4 2"/></g>`; }
const pol=(x,y,r,deg)=>{ const a=deg*Math.PI/180; return [x+Math.sin(a)*r, y-Math.cos(a)*r]; };

function ctlSVG(c){
  const {x,y}=c; let s='';
  switch(c.t){
    case 'tog': { const L=c.sm?18:24; s=`<circle cx="${x}" cy="${y}" r="${c.sm?7.5:9}" class="nut"/><circle cx="${x}" cy="${y}" r="${c.sm?4.5:5.5}" class="nut2"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><rect x="${x-3.2}" y="${y-L}" width="6.4" height="${L}" rx="3" class="${c.red?'batr':'batg'}"/><ellipse cx="${x}" cy="${y-L+1}" rx="4.2" ry="2.8" class="${c.red?'batr':'batg'}"/></g>${lab(x,y+L+6,c.l,{s:c.s||5.4})}${lab(x,y-L-5,c.up||'ON',{s:5,c:'dim'})}`; break; }
    case 'tog3': { const L=17; s=`<circle cx="${x}" cy="${y}" r="7.5" class="nut"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><rect x="${x-3.2}" y="${y-L}" width="6.4" height="${L}" rx="3" class="batg"/><ellipse cx="${x}" cy="${y-L+1}" rx="4.2" ry="2.8" class="batg"/></g>${lab(x+10,y-13,c.vals[0],{s:4.4,a:'start'})}${lab(x+10,y+2,c.vals[1],{s:4.4,a:'start'})}${lab(x+10,y+17,c.vals[2],{s:4.4,a:'start'})}${lab(x,y+L+11,c.l,{s:5.2})}`; break; }
    case 'guard': s=`<circle cx="${x}" cy="${y}" r="8" class="nut"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><rect x="${x-3.4}" y="${y-20}" width="6.8" height="20" rx="3.2" class="batg"/><ellipse cx="${x}" cy="${y-19}" rx="4.4" ry="2.9" class="batg"/></g><g class="gd" style="transform-origin:${x}px ${y+12}px"><path d="M${x-12} ${y+12}V${y-22}q0-5 5-5h14q5 0 5 5V${y+12}z" class="guardc"/><path d="M${x-8} ${y-17}h16" class="guardl"/></g>${lab(x,y+24,c.l,{s:5.6})}${lab(x,y-32,c.up||'ON',{s:5,c:'dim'})}${lab(x,y+33,'CLOSED ↓',{s:4.4,c:'dim'})}`; break;
    case 'rot': { const r=c.r||12; s=`<circle cx="${x}" cy="${y}" r="${r+3}" class="ring0"/><g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/><circle cx="${x}" cy="${y}" r="${r-4}" class="knobtop"/><rect x="${x-1.2}" y="${y-r+1}" width="2.4" height="${r*0.6}" class="ptr"/></g>${lab(x,y+r+10,c.l,{s:5.4})}`; break; }
    case 'enc': { const r=c.r||12; s=`<circle cx="${x}" cy="${y}" r="${r+3}" class="ring0"/><g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/>${Array.from({length:12},(_,i)=>{ const [a,b]=pol(x,y,r-0.5,i*30), [e,f]=pol(x,y,r-3,i*30); return `<path d="M${a} ${b}L${e} ${f}" class="knurl"/>`; }).join('')}<circle cx="${x}" cy="${y}" r="${r*0.45}" class="knobtop"/><rect x="${x-1}" y="${y-r+1}" width="2" height="${r*0.45}" class="ptr"/></g>${lab(x,y+r+10,c.l,{s:5.4})}`; break; }
    case 'rotsel': { const r=12; s=`<circle cx="${x}" cy="${y}" r="${r+2}" class="ring0"/>${c.vals.map((v,i)=>{ const [a,b]=pol(x,y,r+11,c.ang[i]); return `<text x="${a}" y="${b+2}" class="pl" font-size="4.6" text-anchor="middle">${esc(v)}</text>`; }).join('')}<g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/><path d="M${x-3} ${y+r-2}L${x} ${y-r+2}L${x+3} ${y+r-2}z" class="ptrbar"/></g>${lab(x,y+r+13,c.l,{s:5.2})}`; break; }
    case 'push': { const r=c.r||10; s=`<circle cx="${x}" cy="${y}" r="${r+3}" class="ring0"/><g class="mv pb"><circle cx="${x}" cy="${y}" r="${r}" class="pbtn"/><circle cx="${x-r*0.3}" cy="${y-r*0.35}" r="${r*0.35}" class="spec"/></g>${lab(x,y+r+10,c.l,{s:5.2})}`; break; }
    case 'mbtn': { const w=c.w, h=c.h; s=`<rect x="${x-w/2-3}" y="${y-h/2-3}" width="${w+6}" height="${h+6}" rx="3" class="bezel1"/><g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="2" class="mb mb-${c.col}"/><text x="${x}" y="${y-(h>30?2:1)}" class="mbt" font-size="${h>30?7:6.4}" text-anchor="middle">${esc(c.l1)}</text><text x="${x}" y="${y+(h>30?9:8)}" class="mbt" font-size="${h>30?7:5}" text-anchor="middle">${esc(c.l2)}</text></g>`; break; }
    case 'abtn': { const w=c.l.length>4?38:32; s=`<g class="mv pb"><rect x="${x-w/2}" y="${y-11}" width="${w}" height="22" rx="2.5" class="abtn"/><rect class="aled" x="${x-6}" y="${y-8.5}" width="12" height="2.2" rx="1"/><text x="${x}" y="${y+6}" class="pl" font-size="${c.l.length>4?5.6:7}" text-anchor="middle">${esc(c.l)}</text></g>`; break; }
    case 'gear': s=`<rect x="${x-9}" y="${y-36}" width="18" height="72" rx="8" class="slot"/>${lab(x-14,y-28,'UP',{s:6,a:'end'})}${lab(x-14,y+33,'DN',{s:6,a:'end'})}<g class="mv gk"><rect x="${x-2.2}" y="${y-30}" width="4.4" height="30" class="rod"/><circle cx="${x}" cy="${y-30}" r="10" class="wheelk"/><circle cx="${x}" cy="${y-30}" r="4.5" class="wheelh"/><circle class="gl gU" cx="${x}" cy="${y-30}" r="3.4"/></g>
      <g class="glights"><circle class="gl gN" cx="${x+26}" cy="${y-18}" r="4.2"/><circle class="gl gL" cx="${x+20}" cy="${y-7}" r="4.2"/><circle class="gl gR" cx="${x+32}" cy="${y-7}" r="4.2"/>${lab(x+26,y+6,'NOSE L R',{s:4})}</g>${lab(x,y+50,c.l,{s:5.6})}`; break;
    case 'flap': s=`<rect x="${x-8}" y="${y-36}" width="16" height="72" rx="7" class="slot"/>${c.vals.map((v,i)=>lab(x-15,y-30+i*30+2,v,{s:5.6,a:'end'})).join('')}<g class="mv fk"><rect x="${x-14}" y="${y-36}" width="28" height="12" rx="3" class="flapk"/><path d="M${x-10} ${y-30}h20" class="flapl"/></g>${lab(x,y+48,c.l,{s:6})}`; break;
    case 'cb': s=`<circle cx="${x}" cy="${y}" r="7" class="cbcol"/><g class="mv cbk"><circle cx="${x}" cy="${y}" r="5.2" class="cbh"/></g><text x="${x}" y="${y+14}" class="pl" font-size="3.9" text-anchor="middle">${esc(c.l)}</text>`; break;
    case 'pull': s=`<circle cx="${x}" cy="${y}" r="11" class="ring0"/><g class="mv pk" style="transform-origin:${x}px ${y}px"><rect x="${x-10}" y="${y-5}" width="20" height="10" rx="4" class="tbar"/><circle cx="${x}" cy="${y}" r="3" class="knobtop"/></g>${lab(x,y+21,c.l,{s:5.2})}`; break;
    case 'vwheel': s=`<rect x="${x-14}" y="${y-58}" width="28" height="116" rx="8" class="slot"/><svg x="${x-10}" y="${y-54}" width="20" height="108" overflow="hidden"><g class="mv wr">${Array.from({length:36},(_,i)=>`<rect x="0" y="${i*6-54}" width="20" height="3" rx="1" class="ridge"/>`).join('')}</g></svg><path d="M${x+16} ${y}h7" class="tomark"/>${lab(x+18,y-6,'T/O',{s:5,a:'start'})}${lab(x,y-63,'NOSE DN',{s:5})}${lab(x,y+67,'NOSE UP',{s:5})}<path class="mv trind" d="M${x-24} ${y}l6-4v8z"/>${lab(x,y+78,c.l,{s:5.2})}`; break;
    case 'hwheel': s=`<rect x="${x-46}" y="${y-9}" width="92" height="18" rx="8" class="slot"/><svg x="${x-42}" y="${y-6}" width="84" height="12" overflow="hidden"><g class="mv wr">${Array.from({length:30},(_,i)=>`<rect y="0" x="${i*6-48}" width="3" height="12" rx="1" class="ridge"/>`).join('')}</g></svg><path d="M${x} ${y-11}v-5" class="tomark"/><path class="mv trind" d="M${x} ${y+11}l-4 6h8z"/>${lab(x-50,y+3,'L',{s:6,a:'end'})}${lab(x+50,y+3,'R',{s:6,a:'start'})}${lab(x,y+27,c.l,{s:5.2})}`; break;
    case 'lev': { const L=c.len, ly=v=>y+(c.max-v)/(c.max-c.min)*L; const hw=c.kind==='pwr'?15:c.kind==='prop'?12:12;
      const knob=c.kind==='pwr'?`<path d="M${x-hw} ${y-6}q0-7 7-7h${2*hw-14}q7 0 7 7v6q0 6-6 6h-${2*hw-12}q-6 0-6-6z" class="lever"/><path d="M${x-hw+5} ${y-5}h${2*hw-10}M${x-hw+5} ${y-1}h${2*hw-10}M${x-hw+5} ${y+3}h${2*hw-10}" class="grip"/>`
        :c.kind==='prop'?`<rect x="${x-hw}" y="${y-9}" width="${2*hw}" height="16" rx="7" class="levP"/><path d="M${x-hw+4} ${y-4}h${2*hw-8}M${x-hw+4} ${y}h${2*hw-8}" class="gripP"/>`
        :`<rect x="${x-hw}" y="${y-9}" width="${2*hw}" height="16" rx="3" class="levC"/><path d="M${x-hw+3} ${y-1}h${2*hw-6}" class="gripP"/>`;
      s=`<rect x="${x-5}" y="${y-10}" width="10" height="${L+20}" rx="4" class="slot"/>${c.mk?c.marks.map(([v,t])=>`<path d="M${x-20} ${ly(v)}h8" class="tick"/>${lab(x-22,ly(v)+2,t,{s:4.6,a:'end'})}`).join(''):''}<g class="mv lv"><rect x="${x-2.2}" y="${y}" width="4.4" height="14" class="rod"/>${knob}</g>${lab(x,y+L+22,c.l.slice(-1),{s:6})}`; break; }
    case 'yoke': { const X=x; s=`<path d="M${X-10} ${H}V${y+18}h20V${H}z" class="col"/><g class="mv skg" style="transform-origin:${X}px ${y}px"><path d="M${X-80} ${y-34}q-12 0-12 12v26q0 10 12 10h160q12 0 12-10v-26q0-12-12-12q-8 0-8 10v16h-144v-16q0-10-8-10z" class="yk"/><circle cx="${X}" cy="${y}" r="16" class="ykh"/><rect x="${X-14}" y="${y-5}" width="28" height="10" rx="2" class="ykp"/><text x="${X}" y="${y+2.5}" class="pl" font-size="4.6" text-anchor="middle">${c.co?'':'B200'}</text></g>`; break; }
    case 'sbtn': { const r=c.r||5; s=`<g class="mv sbm" style="transform-origin:${x}px ${y}px"><circle cx="${x+c.dx}" cy="${y+c.dy}" r="${r}" fill="${c.col}" stroke="#000"/></g>`; break; }
  }
  const role=({tog:'switch',guard:'switch',push:'button',mbtn:'button',abtn:'button',cb:'switch',pull:'switch',gear:'switch',sbtn:'button',yoke:'application'})[c.t]||'slider';
  return `<g class="ctl t-${c.t}" data-id="${c.id}" tabindex="0" role="${role}" aria-label="${esc(c.l)}">${s}</g>`;
}

/* ---------- round gauges ---------- */
const GA={};
// scale: {min,max,a0,a1,maj,mnr,lab(v),arcs:[[from,to,cls]],red:[v],nd:key,f(v)->0..1}
function dial(id,x,y,r,o){
  GA[id]={x,y,r,sc:o.sc};
  let t=`<circle cx="${x}" cy="${y}" r="${r+5}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>`;
  o.sc.forEach(sc=>{ const A=v=>angOf(sc,v);
    (sc.arcs||[]).forEach(([a,b,cls])=>{ const rr=r-2.5; const [x0,y0]=pol(x,y,rr,A(a)), [x1,y1]=pol(x,y,rr,A(b)); const big=Math.abs(A(b)-A(a))>180?1:0, sw=A(b)>A(a)?1:0; t+=`<path d="M${x0} ${y0}A${rr} ${rr} 0 ${big} ${sw} ${x1} ${y1}" class="${cls}" style="stroke-width:${Math.max(2.5,r*0.07)}px"/>`; });
    if(sc.mnr) for(let v=sc.min; v<=sc.max+1e-6; v+=sc.mnr){ const a=A(v); const maj=sc.maj&&Math.abs(v/sc.maj-Math.round(v/sc.maj))<1e-6; const L=maj?r*0.16:r*0.08; const [a0,b0]=pol(x,y,r,a), [a1,b1]=pol(x,y,r-L,a); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" class="dtick" style="stroke-width:${maj?1.3:0.8}px"/>`;
      if(maj&&sc.lab){ const s=sc.lab(v); if(s!==null&&s!==undefined){ const [lx,ly]=pol(x,y,r*(sc.lr||0.68),a); t+=`<text x="${lx}" y="${ly+r*0.07}" class="dnum" font-size="${(sc.fs||0.19)*r}" text-anchor="middle">${s}</text>`; } } }
    (sc.red||[]).forEach(v=>{ const [a0,b0]=pol(x,y,r,A(v)), [a1,b1]=pol(x,y,r-r*0.22,A(v)); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" class="redl" style="stroke-width:${Math.max(2,r*0.06)}px"/>`; });
    (sc.dash||[]).forEach(v=>{ const [a0,b0]=pol(x,y,r,A(v)), [a1,b1]=pol(x,y,r-r*0.22,A(v)); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" class="redl" stroke-dasharray="2 1.5" style="stroke-width:${Math.max(2,r*0.06)}px"/>`; });
  });
  if(o.title) t+=`<text x="${x}" y="${y+r*(o.ty||0.42)}" class="dnum dt" font-size="${r*(o.tfs||0.15)}" text-anchor="middle">${esc(o.title)}</text>`;
  if(o.unit) t+=`<text x="${x}" y="${y+r*(o.uy||0.6)}" class="dnum dt" font-size="${r*0.12}" text-anchor="middle">${esc(o.unit)}</text>`;
  if(o.dig) t+=`<rect x="${x-r*0.36}" y="${y+r*0.12}" width="${r*0.72}" height="${r*0.24}" rx="1.5" class="digw"/><text class="dig dg-${id}" x="${x}" y="${y+r*0.3}" font-size="${r*0.19}" text-anchor="middle">0</text>`;
  if(o.extra) t+=o.extra;
  o.sc.forEach(sc=>{ const L=sc.nl||r-5; t+=`<g class="nd nd-${id}${sc.nd||''}" style="transform-origin:${x}px ${y}px;transform:rotate(${angOf(sc,sc.min)}deg)"><path d="M${x-r*0.035} ${y+r*0.12}L${x-r*0.02} ${y-L+4}L${x} ${y-L}L${x+r*0.02} ${y-L+4}L${x+r*0.035} ${y+r*0.12}z" class="needle ${sc.ncls||''}"/></g>`; });
  t+=`<circle cx="${x}" cy="${y}" r="${r*0.07}" class="hub"/>`;
  return `<g class="gauge" data-g="${id}">${t}</g>`;
}
function angOf(sc,v){ const f=sc.f?sc.f(v):(clamp(v,sc.min,sc.max)-sc.min)/(sc.max-sc.min); return sc.a0+f*(sc.a1-sc.a0); }

/* ASI: non-linear, 40 → 300 kt */
const asiF=v=>{ v=clamp(v,40,300); return v<=160?(v-40)/120*0.55:0.55+(v-160)/140*0.45; };
function asi(id,x,y,r){ return dial(id,x,y,r,{sc:[{min:40,max:300,a0:10,a1:345,f:asiF,maj:20,mnr:10,lab:v=>v%40===0&&v>=80?v:null,fs:0.15,lr:0.66,
  arcs:[[75,157,'awhite'],[99,259,'agreen']],red:[86,259]}],title:'AIRSPEED',unit:'KNOTS',ty:-0.3,uy:-0.17,
  extra:(()=>{ const sc={min:40,max:300,a0:10,a1:345,f:asiF}; const b=angOf(sc,121); const [a0,b0]=pol(x,y,r,b),[a1,b1]=pol(x,y,r-r*0.22,b); const tr=angOf(sc,200); const [t0,t1]=pol(x,y,r-3,tr); return `<path d="M${a0} ${b0}L${a1} ${b1}" class="bluel" style="stroke-width:${r*0.06}px"/><path d="M${t0} ${t1}l-3 -5h6z" fill="#fff" transform="rotate(${tr} ${t0} ${t1})"/>`; })()}); }
function alt(id,x,y,r){ const sc={min:0,max:1000,a0:0,a1:360,maj:100,mnr:20,lab:v=>v<1000?v/100:null,fs:0.24,lr:0.66,nd:'0',nl:r-6};
  const s1={min:0,max:10000,a0:0,a1:360,nd:'1',nl:r*0.5,ncls:'wide'}; const s2={min:0,max:100000,a0:0,a1:360,nd:'2',nl:r-2,ncls:'thin'};
  return dial(id,x,y,r,{sc:[sc,s1,s2],title:'ALT',ty:-0.3,tfs:0.12,extra:`<rect x="${x+r*0.12}" y="${y+r*0.15}" width="${r*0.56}" height="${r*0.22}" rx="1" class="digw"/><text class="dig kol-${id}" x="${x+r*0.4}" y="${y+r*0.32}" font-size="${r*0.17}" text-anchor="middle">1013</text><text x="${x-r*0.38}" y="${y+r*0.32}" class="dnum" font-size="${r*0.1}" text-anchor="middle">100 FT</text>`}); }
const vsiF=v=>{ const a=Math.min(1,Math.pow(Math.abs(v)/6000,0.62)); return 0.5+Math.sign(v)*a*0.5; };
function vsi(id,x,y,r){ return dial(id,x,y,r,{sc:[{min:-6000,max:6000,a0:-90-165,a1:-90+165,f:vsiF,maj:1000,mnr:500,lab:v=>[0,1000,2000,4000,-1000,-2000,-4000].includes(v)?Math.abs(v)/1000:null,fs:0.22}],title:'VERTICAL SPEED',unit:'×1000 FT/MIN',ty:-0.28,uy:0.34,tfs:0.1,extra:`<text x="${x-r*0.4}" y="${y-r*0.08}" class="dnum" font-size="${r*0.11}">UP</text><text x="${x-r*0.4}" y="${y+r*0.17}" class="dnum" font-size="${r*0.11}">DN</text>`}); }
function adi(id,x,y,r,fd){
  const clip='ac-'+id; let lad=''; for(let p=-30;p<=30;p+=5){ if(!p) continue; const w=p%10?r*0.16:r*0.32; lad+=`<path d="M${x-w/2} ${y-p*r*0.04}h${w}" stroke="#fff" stroke-width="1.1"/>${p%10?'':`<text x="${x+w/2+3}" y="${y-p*r*0.04+3}" fill="#fff" font-size="${r*0.1}">${Math.abs(p)}</text>`}`; }
  let bank=''; [-60,-45,-30,-20,-10,10,20,30,45,60].forEach(b=>{ const [a0,b0]=pol(x,y,r,b), [a1,b1]=pol(x,y,r-(Math.abs(b)%30===0?r*0.14:r*0.08),b); bank+=`<path d="M${a0} ${b0}L${a1} ${b1}" stroke="#fff" stroke-width="1.4"/>`; });
  return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+5}" class="sbz"/><clipPath id="${clip}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><g clip-path="url(#${clip})"><g class="att att-${id}" style="transform-origin:${x}px ${y}px"><g class="attp attp-${id}"><rect x="${x-r*3}" y="${y-r*3}" width="${r*6}" height="${r*3}" fill="#2f86d6"/><rect x="${x-r*3}" y="${y}" width="${r*6}" height="${r*3}" fill="#7b4a22"/><path d="M${x-r*3} ${y}h${r*6}" stroke="#fff" stroke-width="1.5"/>${lad}</g><path d="M${x} ${y-r+2}l-4 7h8z" fill="#fff"/></g></g>${bank}<path d="M${x} ${y-r+1}l-5 -0.5 5 9 5 -9z" fill="#ffb000"/>
   ${fd?`<g class="fdb fdb-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x-r*0.62} ${y+r*0.2}L${x} ${y}L${x+r*0.62} ${y+r*0.2}" class="fdv"/></g>`:''}
   <path d="M${x-r*0.55} ${y+r*0.2}L${x} ${y+2}L${x+r*0.55} ${y+r*0.2}" class="acv"/><circle cx="${x}" cy="${y+1}" r="2" fill="#ffb000"/>
   <rect x="${x-r*0.32}" y="${y+r*0.68}" width="${r*0.64}" height="${r*0.15}" rx="${r*0.07}" class="balltube"/><path d="M${x-r*0.07} ${y+r*0.68}v${r*0.15}M${x+r*0.07} ${y+r*0.68}v${r*0.15}" stroke="#000" stroke-width="1"/><circle class="ball ball-${id}" cx="${x}" cy="${y+r*0.755}" r="${r*0.06}" fill="#111" style="transform-origin:${x}px ${y}px"/>
   ${fd?`<text x="${x-r*0.85}" y="${y+r*0.95}" class="dnum" font-size="${r*0.11}">ATTITUDE</text>`:''}</g>`;
}
function card(x,y,r,cls){ let t=''; for(let d=0;d<360;d+=5){ const L=d%30===0?r*0.14:d%10===0?r*0.09:r*0.05; const [a0,b0]=pol(x,y,r,d),[a1,b1]=pol(x,y,r-L,d); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" stroke="#eee" stroke-width="${d%10?0.7:1.1}"/>`; if(d%30===0){ const [lx,ly]=pol(x,y,r*0.72,d); const s={0:'N',90:'E',180:'S',270:'W'}[d]||d/10; t+=`<text x="${lx}" y="${ly+r*0.06}" fill="#eee" font-size="${r*(d%90?0.13:0.17)}" font-weight="700" text-anchor="middle" transform="rotate(${d} ${lx} ${ly})">${s}</text>`; } } return `<g class="${cls}" style="transform-origin:${x}px ${y}px">${t}</g>`; }
function hsi(id,x,y,r){ return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+5}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${card(x,y,r-2,'hcard hcard-'+id)}
  <g class="hbug hbug-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x-6} ${y-r+1}h12v6l-3 0-3 4-3-4-3 0z" fill="#ff8a00"/></g>
  <g class="hcrs hcrs-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x} ${y-r*0.82}l-5 9h3.4v${r*0.3}h3.2v-${r*0.3}h3.4z M${x-1.6} ${y+r*0.4}h3.2v${r*0.4}h-3.2z" fill="#ffd400"/>${[-2,-1,1,2].map(k=>`<circle cx="${x+k*r*0.17}" cy="${y}" r="2.2" fill="none" stroke="#fff" stroke-width="1"/>`).join('')}<g class="hdev hdev-${id}"><rect x="${x-1.6}" y="${y-r*0.36}" width="3.2" height="${r*0.72}" fill="#ffd400"/></g><path class="htf htf-${id}" d="M${x+r*0.3} ${y-r*0.2}l-5 7h10z" fill="#fff"/></g>
  <path d="M${x-r*0.28} ${y+2}h${r*0.56}M${x} ${y-r*0.18}v${r*0.4}M${x-r*0.12} ${y+r*0.2}h${r*0.24}" stroke="#ffb000" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M${x} ${y-r-4}l-4 -5h8z" fill="#fff"/>${[45,90,135,225,270,315].map(d=>{ const [a,b]=pol(x,y,r+3,d); const [e,f]=pol(x,y,r+8,d); return `<path d="M${a} ${b}L${e} ${f}" stroke="#fff" stroke-width="1.6"/>`; }).join('')}
  <g class="hgs hgs-${id}"><path d="M${x+r+1} ${y}l-6 -4v8z" fill="#2ce36a"/></g><text class="hflag hflag-${id}" x="${x-r*0.5}" y="${y-r*0.35}" fill="#ff3b2b" font-size="${r*0.12}" font-weight="700">NAV</text>
  <text x="${x}" y="${y+r+16}" class="dnum" font-size="8" text-anchor="middle">HSI</text></g>`; }
function rmi(id,x,y,r){ return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+5}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${card(x,y,r-2,'rcard rcard-'+id)}
  <g class="rn1 rn1-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x} ${y-r*0.8}l-4 8h8z M${x-1.3} ${y-r*0.66}h2.6v${r*1.4}h-2.6z" fill="#2ce36a"/></g>
  <g class="rn2 rn2-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x-3.5} ${y+r*0.72}v-${r*1.4}l3.5-6 3.5 6v${r*1.4}" fill="none" stroke="#ffd400" stroke-width="1.8"/></g>
  <path d="M${x} ${y-r-4}l-4 -5h8z" fill="#fff"/><circle cx="${x}" cy="${y}" r="3" class="hub"/><text x="${x}" y="${y+r+14}" class="dnum" font-size="7.5" text-anchor="middle">RMI · ● VOR 1 · ‖ ADF</text></g>`; }
function tc(id,x,y,r){ return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+5}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${[-20,20].map(d=>{ const [a,b]=pol(x,y,r,-90+d), [e,f]=pol(x,y,r-r*0.15,-90+d); const [g,h]=pol(x,y,r,90-d),[i,j]=pol(x,y,r-r*0.15,90-d); return `<path d="M${a} ${b}L${e} ${f}M${g} ${h}L${i} ${j}" stroke="#fff" stroke-width="2.4"/>`; }).join('')}
  <path d="M${x-r} ${y}h${r*0.15}M${x+r} ${y}h-${r*0.15}" stroke="#fff" stroke-width="2.4"/>
  <g class="tcp tcp-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x-r*0.75} ${y}h${r*1.5}M${x} ${y-r*0.18}v${r*0.18}M${x-r*0.2} ${y-r*0.1}" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="${r*0.11}" fill="#fff"/></g>
  <rect x="${x-r*0.45}" y="${y+r*0.42}" width="${r*0.9}" height="${r*0.2}" rx="${r*0.1}" class="balltube"/><circle class="ball ball-${id}" cx="${x}" cy="${y+r*0.52}" r="${r*0.085}" fill="#111"/>
  <text x="${x}" y="${y-r*0.42}" class="dnum" font-size="${r*0.14}" text-anchor="middle">TURN COORDINATOR</text><text x="${x-r*0.62}" y="${y+r*0.32}" class="dnum" font-size="${r*0.15}">L</text><text x="${x+r*0.52}" y="${y+r*0.32}" class="dnum" font-size="${r*0.15}">R</text><text x="${x}" y="${y+r*0.86}" class="dnum" font-size="${r*0.1}" text-anchor="middle">2 MIN</text></g>`; }

/* ---------- annunciator panels ---------- */
const ANN={};
function annGrid(x0,y0,cols,cw,ch,gap,rows,cls){ let t=`<rect x="${x0-4}" y="${y0-4}" width="${cols*(cw+gap)-gap+8}" height="${rows.length*(ch+gap)-gap+8}" rx="3" class="annbox"/>`;
  rows.forEach((row,j)=>row.forEach((it,i)=>{ const x=x0+i*(cw+gap), y=y0+j*(ch+gap); if(!it){ t+=`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="1.5" class="an blank"/>`; return; }
    const [k,txt,col]=Array.isArray(it)?it:[it,it,cls]; t+=`<g class="an an-${col}" data-a="${esc(k)}"><rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="1.5"/><text x="${x+cw/2}" y="${y+ch/2+(ch>14?2.3:1.8)}" font-size="${txt.length>12?Math.min(5.2,ch*0.32):Math.min(6,ch*0.36)}" text-anchor="middle">${esc(txt)}</text></g>`; }));
  return t; }
const WARN=[['L ENG FIRE','INVERTER','DOOR UNLOCKED','ALT WARN','R ENG FIRE'],['L FUEL PRESS',null,'CABIN DIFF HI',null,'R FUEL PRESS'],['L OIL PRESS','L GEN OVHT','A/P TRIM FAIL','R GEN OVHT','R OIL PRESS'],[null,'L BL AIR FAIL','A/P FAIL','R BL AIR FAIL',null]];
const CAUT=[['L DC GEN','HYD FLUID LOW','RVS NOT READY','DUCT OVERTEMP','BATTERY CHARGE','R DC GEN'],['L CHIP DETECT','L ENG ICE FAIL','EXT PWR','ELEC TRIM OFF','R ENG ICE FAIL','R CHIP DETECT'],
  [['L IGNITION ON','L IGNITION ON','g'],['L BL AIR OFF','L BL AIR OFF','g'],['FUEL CROSSFEED','FUEL CROSSFEED','g'],['PROP SYNC ON','PROP SYNC ON','g'],['R BL AIR OFF','R BL AIR OFF','g'],['R IGNITION ON','R IGNITION ON','g']],
  [['L AUTOFEATHER','L AUTOFEATHER','g'],['L ICE VANE EXT','L ICE VANE EXT','g'],['L STBY PUMP','L STBY PUMP','g'],['R STBY PUMP','R STBY PUMP','g'],['R ICE VANE EXT','R ICE VANE EXT','g'],['R AUTOFEATHER','R AUTOFEATHER','g']],
  [['L NO FUEL XFR','L NO FUEL XFR','a'],['PASS OXYGEN ON','PASS OXYGEN ON','g'],['BRAKE DEICE ON','BRAKE DEICE ON','g'],['CABIN ALT 10K','CABIN ALT 10K','a'],['AP TRIM','A/P TRIM ON','g'],['R NO FUEL XFR','R NO FUEL XFR','a']]];
const APANN=['AP','YD','FD','HDG','NAV','APR','ALT','VS','GS','ARM'];

/* ---------- the panel ---------- */
function panelSVG(){
  const eng=(id,x,y,r,o)=>dial(id,x,y,r,o);
  const rows=[192,258,324,390,456,522], cx=[705,830], er=30;
  const ENG=[
    ['TQ','TORQUE',{sc:[{min:0,max:3000,a0:-135,a1:135,maj:500,mnr:100,lab:v=>v/100,fs:0.24,arcs:[[400,2230,'agreen']],red:[2230]}],unit:'FT-LB ×100',uy:0.62,dig:1}],
    ['ITT','ITT',{sc:[{min:0,max:1200,a0:-135,a1:135,maj:200,mnr:50,lab:v=>v/100,fs:0.24,arcs:[[400,800,'agreen']],red:[800],dash:[1000]}],unit:'°C ×100',uy:0.62,dig:1}],
    ['NP','PROP RPM',{sc:[{min:0,max:2400,a0:-135,a1:135,maj:400,mnr:100,lab:v=>v/100,fs:0.24,arcs:[[1600,2000,'agreen']],red:[2000]}],unit:'RPM ×100',uy:0.62,dig:1}],
    ['NG','TURBINE %',{sc:[{min:0,max:110,a0:-135,a1:135,maj:10,mnr:5,lab:v=>v%20===0?v:null,fs:0.22,arcs:[[61,101.5,'agreen']],red:[101.5]}],unit:'N1 %',uy:0.62,dig:1}],
    ['FF','FUEL FLOW',{sc:[{min:0,max:800,a0:-135,a1:135,maj:100,mnr:50,lab:v=>v%200===0?v/100:null,fs:0.24}],unit:'PPH ×100',uy:0.62}],
    ['OIL','OIL',{sc:[{min:0,max:200,a0:-150,a1:-30,maj:50,mnr:25,lab:v=>v%100===0?v:null,fs:0.18,lr:0.62,arcs:[[100,135,'agreen'],[60,100,'ayellow']],red:[60,135],nd:'P'},{min:0,max:140,a0:150,a1:30,maj:20,mnr:20,lab:v=>v%40===0?v:null,fs:0.18,lr:0.62,arcs:[[10,99,'agreen']],red:[99],nd:'T',ncls:'amb'}],unit:'PSI  ·  °C',uy:0.5}]];
  let engs=''; ENG.forEach(([k,t,o],j)=>{ cx.forEach((x,i)=>{ engs+=eng(k+(i?'R':'L'),x,rows[j],er,o); }); engs+=lab(767,rows[j]-2,t,{s:5.6,c:'gp'})+lab(767,rows[j]+8,'L   ·   R',{s:4.6,c:'dim'}); });
  const radio=(y,name,k)=>`${plate(908,y-34,255,58,4,'rbox')}<text x="918" y="${y-22}" class="pl" font-size="6">${name}</text><rect x="918" y="${y-18}" width="66" height="20" rx="2" class="digw"/><rect x="990" y="${y-18}" width="66" height="20" rx="2" class="digw"/><text class="dig rd-${k}A" x="951" y="${y-3}" font-size="12" text-anchor="middle">---</text><text class="dig dim rd-${k}S" x="1023" y="${y-3}" font-size="12" text-anchor="middle">---</text><text x="951" y="${y+12}" class="pl dim" font-size="4.6" text-anchor="middle">ACTIVE</text><text x="1023" y="${y+12}" class="pl dim" font-size="4.6" text-anchor="middle">STANDBY</text>`;
  return `<svg class="psvg" viewBox="0 0 ${W} ${H}" xmlns="${NS}">
<defs>
 <linearGradient id="gPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b5056"/><stop offset=".6" stop-color="#3d4247"/><stop offset="1" stop-color="#33373c"/></linearGradient>
 <linearGradient id="gSub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f45"/><stop offset="1" stop-color="#2c3035"/></linearGradient>
 <linearGradient id="gGlare" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1d20"/><stop offset=".85" stop-color="#0d0f11"/><stop offset="1" stop-color="#202327"/></linearGradient>
 <linearGradient id="gCons" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2e33"/><stop offset="1" stop-color="#17191c"/></linearGradient>
 <radialGradient id="gKnob" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#5d646d"/><stop offset=".6" stop-color="#25292e"/><stop offset="1" stop-color="#121417"/></radialGradient>
 <radialGradient id="gMetal" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#f2f4f6"/><stop offset=".45" stop-color="#a7adb4"/><stop offset="1" stop-color="#5a6067"/></radialGradient>
 <linearGradient id="gBat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d949b"/><stop offset=".45" stop-color="#f4f6f8"/><stop offset="1" stop-color="#6f767d"/></linearGradient>
 <linearGradient id="gBatR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8f1d14"/><stop offset=".45" stop-color="#ef4a3a"/><stop offset="1" stop-color="#7d160f"/></linearGradient>
 <linearGradient id="gLever" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5057"/><stop offset="1" stop-color="#16181b"/></linearGradient>
 <linearGradient id="gYoke" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4046"/><stop offset="1" stop-color="#121416"/></linearGradient>
 <filter id="fGlow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation=".6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="fLed" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="fShadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".55"/></filter>
</defs>
<!-- glareshield and panel face -->
<path d="M10 800V200Q10 120 120 100Q800 40 1480 100Q1590 120 1590 200V800Z" fill="url(#gGlare)" filter="url(#fShadow)"/>
<path d="M24 795V214Q24 160 110 152Q800 140 1490 152Q1576 160 1576 214V795Z" fill="url(#gPanel)" stroke="#000" stroke-opacity=".5" stroke-width="2"/>
${plate(30,586,552,208,8)}${plate(586,586,372,208,8)}${plate(962,586,610,208,8)}
${plate(628,160,268,418,6,'sub2')}${plate(900,160,268,418,6,'sub2')}
<!-- glareshield items -->
${annGrid(642,70,5,58,16.5,2.5,WARN,'r')}
<rect x="523" y="111" width="74" height="12" rx="1" class="annbox"/><rect x="1003" y="111" width="74" height="12" rx="1" class="annbox"/>
${annGrid(527,113,2,32,8,2,[[['L EXT D','D','a'],['L EXT OK','OK','g']]])}${annGrid(1007,113,2,32,8,2,[[['R EXT D','D','a'],['R EXT OK','OK','g']]])}
${lab(800,154,'WARNING ANNUNCIATORS',{s:5,c:'dim'})}
<!-- pilot flight instruments -->
${asi('asi',100,250,58)}${adi('adi',262,250,72,1)}${alt('alt',424,250,58)}
${tc('tc',100,435,50)}${hsi('hsi',262,435,72)}${vsi('vsi',424,435,58)}${rmi('rmi',560,435,50)}
${plate(516,196,90,108,4,'rbox')}${lab(561,208,'AUTOPILOT',{s:5.4,c:'gp'})}${annGrid(522,214,2,38,13,3,[['AP','YD'],['FD','HDG'],['NAV','APR'],['ALT','VS'],['GS','ARM']].map(r=>r.map(k=>['ap:'+k,k==='ARM'?'TRIM':k,k==='AP'||k==='YD'?'g':'w'])))}
<!-- engine instruments -->
${engs}
<!-- radios -->
${radio(205,'COM 1','com')}${radio(285,'NAV 1','nav')}
${plate(908,363,255,58,4,'rbox')}<text x="918" y="375" class="pl" font-size="6">TRANSPONDER</text><rect x="918" y="380" width="66" height="20" rx="2" class="digw"/><text class="dig rd-xpdr" x="951" y="395" font-size="12" text-anchor="middle">7000</text>
${plate(908,430,255,136,4,'rbox')}${lab(1035,442,'AUTOPILOT / FLIGHT DIRECTOR',{s:5.4,c:'gp'})}<rect x="968" y="528" width="120" height="22" rx="2" class="digw"/><text class="dig rd-alt" x="1028" y="544" font-size="11" text-anchor="middle">ALT 3000</text>
<!-- copilot -->
${asi('asi2',1235,245,52)}${adi('adi2',1375,245,62,0)}${alt('alt2',1515,245,52)}
${dial('fq',1235,420,52,{sc:[{min:0,max:2000,a0:-135,a1:-20,maj:500,mnr:250,lab:v=>v%1000===0?v/100:null,fs:0.16,lr:0.62,nd:'L',arcs:[[0,250,'ayellow']]},{min:0,max:2000,a0:135,a1:20,maj:500,mnr:250,lab:v=>v%1000===0?v/100:null,fs:0.16,lr:0.62,nd:'R',ncls:'amb',arcs:[[0,250,'ayellow']]}],title:'FUEL QTY',unit:'L · LBS ×100 · R',ty:0.42,uy:0.6})}
${dial('cab',1375,420,52,{sc:[{min:0,max:30000,a0:-135,a1:135,maj:5000,mnr:1000,lab:v=>v/1000,fs:0.17,arcs:[[12500,30000,'ayellow']],nd:'A'},{min:0,max:7,a0:-60,a1:60,maj:1,mnr:1,nd:'D',nl:30,ncls:'amb',red:[6.6],lab:null}],title:'CABIN ALT ×1000',unit:'DIFF PSI',ty:0.35,uy:0.62,tfs:0.11})}
${dial('cvs',1515,420,52,{sc:[{min:-4000,max:4000,a0:-90-150,a1:-90+150,maj:1000,mnr:500,lab:v=>v%1000===0&&Math.abs(v)<4000?Math.abs(v)/1000:null,fs:0.19}],title:'CABIN CLIMB',unit:'×1000 FT/MIN',ty:0.38,uy:0.56,tfs:0.12})}
${dial('flp',1235,538,32,{sc:[{min:0,max:100,a0:-120,a1:60,maj:20,mnr:20,lab:v=>v===0?'UP':v===40?'40':v===100?'DN':null,fs:0.2,lr:0.6,arcs:[[0,40,'agreen']]}],title:'FLAPS %',ty:0.48,tfs:0.17})}
${dial('volt',1375,538,32,{sc:[{min:0,max:30,a0:-120,a1:120,maj:10,mnr:5,lab:v=>v,fs:0.22,arcs:[[27,29,'agreen']]}],title:'DC VOLTS',ty:0.5,tfs:0.17})}
${dial('oat',1515,538,32,{sc:[{min:-60,max:50,a0:-135,a1:135,maj:20,mnr:10,lab:v=>v%40===0?v:null,fs:0.2}],title:'OAT °C',ty:0.5,tfs:0.17})}
<!-- lower panel group labels -->
${lab(40,594,'ELECTRICAL · ENGINE START',{s:4.8,c:'gp',a:'start'})}${lab(40,667,'LIGHTS',{s:4.8,c:'gp',a:'start'})}${lab(40,736,'ICE AND RAIN PROTECTION',{s:4.8,c:'gp',a:'start'})}
${annGrid(655,594,6,46,14.5,3,CAUT,'a')}
${plate(708,724,102,28,3,'digw')}<text class="dig rd-cab1" x="759" y="736" font-size="8.5" text-anchor="middle">CAB 3500</text><text class="dig dim rd-cab2" x="759" y="747" font-size="7" text-anchor="middle">ACFT 13000</text>${lab(759,718,'PRESSURISATION CONTROLLER',{s:4.8,c:'gp'})}
${lab(972,594,'ENVIRONMENTAL',{s:4.8,c:'gp',a:'start'})}${lab(1300,594,'CONTROLS · OXYGEN',{s:4.8,c:'gp',a:'start'})}${lab(1214,668,'CIRCUIT BREAKERS',{s:5.2,c:'gp',a:'start'})}
<g class="placard">${plate(970,736,234,52,4,'plc')}${lab(1087,748,'AIRSPEEDS (KIAS) — TRAINING',{s:5.6})}${lab(978,760,'VMCA 86 · VYSE 121 · VMO 259',{s:5.4,a:'start'})}${lab(978,771,'VFE APPR 200 · VFE DN 157 · VLE/VLO DN 181',{s:5.4,a:'start'})}${lab(978,782,'VLO UP 163 · Follow the AFM/POH and your SOP',{s:5.2,a:'start'})}</g>
<!-- pedestal and side console -->
<path d="M560 795H1112L1124 1000H548Z" fill="url(#gCons)" stroke="#000" stroke-opacity=".6"/>
<path d="M12 805H236V1000H12Z" fill="url(#gCons)" stroke="#000" stroke-opacity=".6"/>${lab(124,820,'FUEL CONTROL (SIDE PANEL)',{s:5,c:'gp'})}
${lab(666,988,'POWER',{s:5.4,c:'gp'})}${lab(788,988,'PROPELLER',{s:5.4,c:'gp'})}${lab(905,988,'CONDITION',{s:5.4,c:'gp'})}
<g class="ctls">${C.map(ctlSVG).join('')}</g>
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
      const x0=Math.max(1,b.x-4), y0=Math.max(1,b.y-4), x1=Math.min(W-1,b.x+b.width+4), y1=Math.min(H-1,b.y+b.height+4);
      r.setAttribute('x',x0); r.setAttribute('y',y0); r.setAttribute('width',x1-x0); r.setAttribute('height',y1-y0); r.setAttribute('rx',6); o.g.insertBefore(r,o.g.firstChild);
      if(o.c.t==='sbtn') return; const cx=b.x+b.width/2, cy=b.y+b.height/2, hw=Math.max(b.width+8,30)/2, hh=Math.max(b.height+8,30)/2; Z.push({o,cx,cy,x0:cx-hw,x1:cx+hw,y0:cy-hh,y1:Math.min(H-1,cy+hh)}); }catch(e){} });
    for(let a=0;a<Z.length;a++) for(let k=a+1;k<Z.length;k++){ const A=Z[a], B=Z[k]; if(A.x1<=B.x0||B.x1<=A.x0||A.y1<=B.y0||B.y1<=A.y0) continue;
      const dx=B.cx-A.cx, dy=B.cy-A.cy;
      if(Math.abs(dx)>=Math.abs(dy)){ const m=(A.cx+B.cx)/2; if(dx>=0){ A.x1=Math.min(A.x1,m); B.x0=Math.max(B.x0,m); } else { A.x0=Math.max(A.x0,m); B.x1=Math.min(B.x1,m); } }
      else { const m=(A.cy+B.cy)/2; if(dy>=0){ A.y1=Math.min(A.y1,m); B.y0=Math.max(B.y0,m); } else { A.y0=Math.max(A.y0,m); B.y1=Math.min(B.y1,m); } } }
    Z.forEach(z=>{ if(z.x1<=z.x0||z.y1<=z.y0) return; const h=document.createElementNS(NS,'rect'); h.setAttribute('class','hit'); h.dataset.for=z.o.c.id; h.setAttribute('x',z.x0); h.setAttribute('y',z.y0); h.setAttribute('width',z.x1-z.x0); h.setAttribute('height',z.y1-z.y0); layer.appendChild(h); }); });
  bind(world,byId,io);
  return {world,svg,byId,W,H,REG,REG_ORDER,C,CBS};
}

/* ---------- interaction ---------- */
function ctlFromBy(byId,t){ if(!t||!t.closest) return null; const g=t.closest('g.ctl'); if(g) return g; const h=t.closest('.hit'); return h&&byId[h.dataset.for]?byId[h.dataset.for].g:null; }
function levSnap(c,v){ const rng=c.max-c.min; for(const [m] of c.marks||C.find(k=>k.kind===c.kind&&k.marks).marks){ if(Math.abs(v-m)<rng*0.035) return m; } return v; }
function bind(world,byId,io){
  const ctlFrom=t=>ctlFromBy(byId,t);
  const svg=world.querySelector('svg'); const pt0=svg.createSVGPoint();
  const toW=e=>{ pt0.x=e.clientX; pt0.y=e.clientY; const p=pt0.matrixTransform(svg.getScreenCTM().inverse()); return {x:p.x,y:p.y}; };
  const step=(o,d)=>{ const c=o.c, v=io.get(c.id);
    switch(c.t){
      case 'tog': case 'cb': case 'pull': case 'abtn': io.set(c.id,d>0?1:d<0?0:(v?0:1)); return;
      case 'guard': { const gk=c.id+'G'; if(!io.get(gk)){ io.set(gk,1); return; } if(d===0) io.set(c.id,v?0:1); else io.set(c.id,d>0?1:0); return; }
      case 'tog3': io.set(c.id,d? clamp((v||0)-d,-1,1) : (v!==0?0:-1)); return;
      case 'rotsel': io.set(c.id,clamp(v+(d||1),0,c.vals.length-1)); return;
      case 'rot': io.set(c.id,clamp(v+d*0.08,0,1)); return;
      case 'enc': io.set(c.id+':d',d||1); return;
      case 'gear': io.set(c.id,d>0?0:d<0?1:(v?0:1)); return;
      case 'flap': io.set(c.id,clamp(v-(d||0),0,2)); return;
      case 'vwheel': case 'hwheel': io.set(c.id,clamp(v+d*0.04,-1,1)); return;
      case 'lev': io.set(c.id,levSnap(c,clamp(v+d*(c.max-c.min)*0.04,c.min,c.max))); return;
    } };
  let wacc=0;
  world.addEventListener('wheel',e=>{ const g=ctlFrom(e.target); if(!g) return; const o=byId[g.dataset.id]; if(!['rot','enc','rotsel','vwheel','hwheel','lev','flap'].includes(o.c.t)) return; e.preventDefault(); e.stopPropagation(); if(e.ctrlKey) return; const raw=(Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:-e.deltaX)*(e.deltaMode?40:1); wacc+=raw; if(Math.abs(wacc)<30) return; const d=wacc<0?1:-1; wacc=0;
    if(o.c.t==='vwheel') return step(o,-d); step(o,d); },{passive:false});
  let drag=null;
  world.addEventListener('pointerdown',e=>{ const g=ctlFrom(e.target); if(!g) return; if(io.intercept&&io.intercept(e,g)) return; const o=byId[g.dataset.id], c=o.c; e.preventDefault(); e.stopPropagation(); g.focus({preventScroll:true});
    const pt=toW(e);
    if(c.t==='push'||c.t==='mbtn'||c.t==='sbtn'||(c.t==='abtn'&&c.momentary)){ io.set(c.id,1); drag={o,mom:1}; try{ g.setPointerCapture(e.pointerId); }catch(_){} return; }
    if(c.t==='lev'){ drag={o,lev:1,y:pt.y,v:io.get(c.id),moved:0}; try{ g.setPointerCapture(e.pointerId); }catch(_){} g.classList.add('drag'); return; }
    if(c.t==='vwheel'||c.t==='hwheel'||c.t==='rot'||c.t==='enc'){ drag={o,x:pt.x,y:pt.y,v:io.get(c.id),acc:0,moved:0}; try{ g.setPointerCapture(e.pointerId); }catch(_){} return; }
    if(c.t==='rotsel'){ const a=Math.atan2(pt.x-c.x,-(pt.y-c.y))*180/Math.PI; const v=io.get(c.id); if(Math.hypot(pt.x-c.x,pt.y-c.y)>15){ let best=0; c.ang.forEach((x,i)=>{ if(Math.abs(x-a)<Math.abs(c.ang[best]-a)) best=i; }); if(best!==v){ io.set(c.id,best); return; } } io.set(c.id,(v+1)%c.vals.length); return; }
    if(c.t==='flap'){ const idx=clamp(Math.round((pt.y-(c.y-30))/30),0,2); io.set(c.id,idx===io.get(c.id)?(idx+1)%3:idx); return; }
    if(c.t==='tog'){ drag={o,tg:1,y:pt.y,done:0}; try{ g.setPointerCapture(e.pointerId); }catch(_){} return; }
    if(c.t==='yoke'){ drag={o,stk:1,x:pt.x,y:pt.y}; try{ g.setPointerCapture(e.pointerId); }catch(_){} g.classList.add('drag'); io.set('stick',{x:0,y:0}); return; }
    if(c.t==='tog3'){ const v=io.get(c.id); const t=pt.y<c.y-9?-1:pt.y>c.y+9?1:(v!==0?0:-1); io.set(c.id,t===v?0:t); return; }
    if(c.t==='guard'){ const onGuard=e.target.closest('.gd'); const gk=c.id+'G'; if(onGuard||!io.get(gk)){ io.set(gk,io.get(gk)?0:1); return; } io.set(c.id,io.get(c.id)?0:1); return; }
    step(o,0);
  });
  world.addEventListener('pointermove',e=>{ if(!drag||drag.mom) return; const c=drag.o.c, pt=toW(e);
    if(drag.tg){ const dy=pt.y-drag.y; if(!drag.done&&Math.abs(dy)>6){ drag.done=1; io.set(c.id,dy<0?1:0); } return; }
    if(drag.stk){ io.set('stick',{x:clamp((pt.x-drag.x)/60,-1,1),y:clamp((pt.y-drag.y)/40,-1,1)}); return; }
    if(drag.lev){ const v=clamp(drag.v-(pt.y-drag.y)/c.len*(c.max-c.min),c.min,c.max); drag.moved=1; io.set(c.id,v); return; }
    if(c.t==='vwheel') io.set(c.id,clamp(drag.v+(pt.y-drag.y)/110,-1,1));
    if(c.t==='hwheel') io.set(c.id,clamp(drag.v+(pt.x-drag.x)/90,-1,1));
    if(c.t==='rot') io.set(c.id,clamp(drag.v+(pt.x-drag.x)/60,0,1));
    if(c.t==='enc'){ const d=(pt.x-drag.x)-(pt.y-drag.y); const n=Math.trunc(d/6)-drag.acc; if(n){ drag.acc+=n; io.set(c.id+':d',n); } }
  });
  const end=()=>{ if(!drag) return; const c=drag.o.c; if(drag.tg&&!drag.done) io.set(c.id,io.get(c.id)?0:1); if(drag.stk) io.set('stick',null); if(drag.mom) io.set(c.id,0);
    if(drag.lev) io.set(c.id,levSnap(c,io.get(c.id)));
    if(c.t==='enc'&&!drag.acc) io.set(c.id+':d',1);
    drag.o.g.classList.remove('drag'); drag=null; };
  world.addEventListener('pointerup',end); world.addEventListener('pointercancel',end);
  const held=new Set();
  world.addEventListener('keydown',e=>{ const g=e.target.closest&&e.target.closest('g.ctl'); if(!g) return; const o=byId[g.dataset.id], c=o.c; const k=e.key;
    let d=null; if(k==='ArrowUp'||k==='ArrowRight') d=1; else if(k==='ArrowDown'||k==='ArrowLeft') d=-1;
    if(c.t==='push'||c.t==='mbtn'||(c.t==='abtn'&&c.momentary)){ if(e.repeat){ e.preventDefault(); return; } if(k===' '||k==='Enter'){ io.set(c.id,1); held.add(c.id); e.preventDefault(); e.stopPropagation(); } return; }
    if(k===' '||k==='Enter'){ step(o,0); e.preventDefault(); e.stopPropagation(); return; }
    if(d!=null){ if(c.t==='vwheel') d=-d; step(o,d); e.preventDefault(); e.stopPropagation(); } });
  world.addEventListener('keyup',e=>{ const g=e.target.closest&&e.target.closest('g.ctl'); if(!g) return; const c=byId[g.dataset.id].c; if(held.has(c.id)){ held.delete(c.id); io.set(c.id,0); } });
}

/* ---------- render state ---------- */
const cache={};
function setT(el,t){ if(el&&el._t!==t){ el._t=t; el.style.transform=t; } }
function setTx(el,t){ if(el&&el._x!==t){ el._x=t; el.textContent=t; } }
function sync(P,io){
  for(const id in P.byId){ const {c,g}=P.byId[id]; let v=io.get(id); if(c.t==='guard') v=v+'|'+io.get(id+'G'); if(c.t==='gear') v=v+'|'+io.get('gearLights'); if(c.t==='abtn'||c.t==='mbtn') v=v+'|'+io.get('led:'+id); if(c.t==='lev') v=(+v).toFixed(3);
    if(cache[id]===v) continue; cache[id]=v; const m=g.querySelector('.mv'); const val=io.get(id);
    switch(c.t){
      case 'tog': case 'guard': setT(m,val?'scaleY(1)':'scaleY(-1)'); g.classList.toggle('on',!!val); if(c.t==='guard'){ const go=io.get(id+'G'); setT(g.querySelector('.gd'),go?'translateY(-24px) scaleY(.35)':'none'); g.setAttribute('aria-label',c.l+(go?' (guard open)':' (guard closed)')); } g.setAttribute('aria-checked',val?'true':'false'); g.setAttribute('aria-valuetext',val?(c.up||'ON'):(c.t==='guard'?'CLOSED':'OFF')); break;
      case 'tog3': g.setAttribute('aria-valuetext',c.vals[val+1]); setT(m,val<0?'scaleY(1)':val>0?'scaleY(-1)':'scaleY(.2)'); break;
      case 'rot': setT(m,`rotate(${-135+val*270}deg)`); g.setAttribute('aria-valuetext',Math.round(val*100)+' %'); break;
      case 'enc': setT(m,`rotate(${(val*(c.deg||7))%360}deg)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||val)); break;
      case 'rotsel': setT(m,`rotate(${c.ang[val]}deg)`); g.setAttribute('aria-valuetext',c.vals[val]); break;
      case 'push': g.classList.toggle('on',!!val); break;
      case 'mbtn': case 'abtn': g.classList.toggle('on',!!val); g.classList.toggle('led',!!io.get('led:'+id)); break;
      case 'gear': { setT(m,val?'translateY(56px)':'none'); const L=io.get('gearLights'); g.querySelectorAll('.gl').forEach(x=>x.classList.remove('g','r')); if(L==='down') ['gN','gL','gR'].forEach(k=>g.querySelector('.'+k).classList.add('g')); else if(L==='transit'||L==='warn') g.querySelector('.gU').classList.add('r'); g.setAttribute('aria-checked',val?'true':'false'); g.setAttribute('aria-valuetext',val?'DOWN':'UP'); break; }
      case 'flap': setT(m,`translateY(${val*30}px)`); g.setAttribute('aria-valuetext',c.vals[val]); break;
      case 'cb': g.classList.toggle('out',!val); g.setAttribute('aria-valuetext',val?'IN':'PULLED'); g.setAttribute('aria-pressed',val?'false':'true'); break;
      case 'pull': g.setAttribute('aria-valuetext',val?'SET':'RELEASED'); g.setAttribute('aria-pressed',val?'true':'false'); setT(m,val?'scale(1.25)':'none'); g.classList.toggle('on',!!val); break;
      case 'vwheel': setT(m,`translateY(${(val*60)%6}px)`); setT(g.querySelector('.trind'),`translateY(${-val*50}px)`); g.setAttribute('aria-valuetext',Math.round(val*100)+''); break;
      case 'hwheel': setT(m,`translateX(${(val*60)%6}px)`); setT(g.querySelector('.trind'),`translateX(${val*40}px)`); g.setAttribute('aria-valuetext',Math.round(val*100)+''); break;
      case 'lev': { const y=(c.max-val)/(c.max-c.min)*c.len; setT(m,`translateY(${y.toFixed(1)}px)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||val)); break; }
    }
  }
}
function syncYokes(P,x,y){ const t=`translateY(${(y*14).toFixed(1)}px) rotate(${(x*38).toFixed(1)}deg)`; ['yokeL','yokeR','apDisc','trimUp','trimDn'].forEach(id=>{ const o=P.byId[id]; if(!o) return; setT(o.g.querySelector('.skg')||o.g.querySelector('.sbm'),t); }); }
/* gauges */
function needle(P,id,v,k){ const g=GA[id]; if(!g) return; const sc=g.sc.find(s=>(s.nd||'')===(k||''))||g.sc[0]; const a=angOf(sc,v); const el=P.svg.querySelector('.nd-'+id+(k||'')); if(el){ const t=`rotate(${a.toFixed(1)}deg)`; setT(el,t); } }
function text(P,cls,t){ const el=P.q[cls]||(P.q[cls]=P.svg.querySelector('.'+cls)); setTx(el,t); }
function rot(P,cls,deg,extra){ const el=P.q[cls]||(P.q[cls]=P.svg.querySelector('.'+cls)); setT(el,`rotate(${deg.toFixed(1)}deg)${extra||''}`); }
function tr(P,cls,t){ const el=P.q[cls]||(P.q[cls]=P.svg.querySelector('.'+cls)); setT(el,t); }
function vis(P,cls,on){ const el=P.q[cls]||(P.q[cls]=P.svg.querySelector('.'+cls)); if(el&&el._v!==on){ el._v=on; el.style.opacity=on?1:0; } }
function ann(P,lit,test,blink){ for(const k in ANN){ const on=test||!!lit[k]; const fl=!test&&lit[k]==='blink'; ANN[k].forEach(e=>{ const s=on?(fl?(blink?'on':'off'):'on'):'off'; if(e._s!==s){ e._s=s; e.classList.toggle('on',s==='on'); } }); } }
function flight(P,o,sfx){ sfx=sfx||''; const r=P.q; P.q=r;
  needle(P,'asi'+sfx,o.ias); needle(P,'alt'+sfx,((o.alt%1000)+1000)%1000,'0'); needle(P,'alt'+sfx,((o.alt%10000)+10000)%10000,'1'); needle(P,'alt'+sfx,Math.max(0,o.alt),'2');
  text(P,'kol-alt'+sfx,String(Math.round(o.baro)));
  const id='adi'+sfx, rr=sfx?62:72; rot(P,'att-'+id,-o.roll); tr(P,'attp-'+id,`translateY(${clamp(o.pitch,-30,30)*rr*0.04}px)`);
  tr(P,'ball-'+id,`translateX(${(clamp(o.slip,-1,1)*rr*0.22).toFixed(1)}px)`);
}
G.B200P={ctlFrom:(P,t)=>ctlFromBy(P.byId,t),build:(s,io)=>{ const P=build(s,io); P.q={}; return P; },sync,syncYokes,needle,text,rot,tr,vis,ann,flight,REG,REG_ORDER,W,H,WARN,CAUT};
})(window);
