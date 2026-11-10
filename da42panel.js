/* Birdbird – front-on DA42-style instrument panel drawn in SVG (world units 1600×980).
   Generic training layout drawn by Birdbird; not a manufacturer drawing. Controls report through io.get/io.set. */
(function(G){
'use strict';
const W=1600, H=980, NS='http://www.w3.org/2000/svg';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');

/* ---------- regions for zoom ---------- */
const REG={
  overview:[10,92,1580,888],
  top:[290,92,1020,128],
  pfd:[30,205,800,450],
  mfd:[770,205,800,450],
  audio:[700,210,240,420],
  left:[30,205,330,450],
  right:[1380,205,200,450],
  switches:[230,632,620,140],
  flaps:[820,632,560,140],
  console:[540,735,520,245]
};
const REG_ORDER=['switches','flaps','console','top','audio','left','right','pfd','mfd'];

/* ---------- layout: every control ---------- */
const C=[]; const add=(o)=>{ C.push(o); return o; };
// top strip: lighting, emergency, standby instruments, ELT
add({id:'dimInst',t:'rot',x:338,y:160,l:'INSTRUMENT',r:13});
add({id:'dimFlood',t:'rot',x:392,y:160,l:'FLOOD',r:13});
[['strobe','STROBE'],['nav','POSITION'],['taxi','TAXI'],['land','LANDING']].forEach(([id,l],i)=>add({id,t:'rocker',x:452+i*44,y:160,l}));
add({id:'emer',t:'guard',x:648,y:160,l:'EMERGENCY'});
add({id:'elt',t:'tog3',x:1222,y:168,l:'ELT',vals:['ON','ARM','RESET'],pos:[ -1,0,1 ]});
// left column
add({id:'pumpL',t:'rocker',x:105,y:282,l:'L',big:1}); add({id:'pumpR',t:'rocker',x:170,y:282,l:'R',big:1});
add({id:'voterL',t:'rotsel',x:72,y:470,l:'VOTER L',vals:['ECU A','AUTO','ECU B'],ang:[-50,0,50]});
add({id:'ecuL',t:'push',x:118,y:472,l:'ECU TEST',r:12});
add({id:'ecuR',t:'push',x:162,y:472,l:'ECU TEST',r:12});
add({id:'voterR',t:'rotsel',x:208,y:470,l:'VOTER R',vals:['ECU A','AUTO','ECU B'],ang:[-50,0,50]});
add({id:'altL',t:'tog',x:100,y:585,l:'L'}); add({id:'altR',t:'tog',x:178,y:585,l:'R'});
add({id:'micJack',t:'deco',x:60,y:625});
add({id:'oxy',t:'rot',x:205,y:624,l:'O2 (IF FITTED)',r:8});
add({id:'ventL',t:'vent',x:138,y:370,r:36,l:'VENT'}); add({id:'ventR',t:'vent',x:1480,y:620,r:36,l:'VENT'});
add({id:'iceLight',t:'rocker',x:1535,y:530,l:'ICE LT'});
add({id:'stickL',t:'stick',x:300,y:850,l:'STICK'}); add({id:'stickR',t:'stick',x:1300,y:850,l:'STICK',co:1});
add({id:'apDisc',t:'sbtn',x:300,y:850,l:'AP DISC',dx:-15,dy:-22,col:'#c62a1d'}); add({id:'trimDn',t:'sbtn',x:300,y:850,l:'TRIM NOSE DN',dx:5,dy:-38,col:'#59616b',r:4}); add({id:'trimUp',t:'sbtn',x:300,y:850,l:'TRIM NOSE UP',dx:5,dy:-28,col:'#59616b',r:4});
// bottom switch row (under PFD)
add({id:'altStatic',t:'pull',x:262,y:700,l:'ALT STATIC'});
add({id:'pitot',t:'tog',x:322,y:700,l:'PITOT HEAT'});
add({id:'engL',t:'tog',x:384,y:700,l:'L',guardless:1});
add({id:'start',t:'key',x:440,y:702,l:'START'});
add({id:'engR',t:'tog',x:496,y:700,l:'R'});
add({id:'elec',t:'tog',x:556,y:700,l:'ELECT. MASTER',red:1,s:5.6});
add({id:'avio',t:'tog',x:620,y:700,l:'AVIONIC MASTER',s:5.6});
add({id:'gear',t:'gear',x:690,y:700,l:'GEAR'});
add({id:'fireTest',t:'push',x:792,y:690,l:'FIRE TEST',r:9});
add({id:'hornMute',t:'push',x:792,y:726,l:'GEAR WARN MUTE',r:7});
// under MFD
add({id:'flaps',t:'flap',x:880,y:700,l:'FLAPS'});
// audio panel between displays
const AUD=[['COM1MIC','COM1 MIC'],['COM1','COM1'],['COM2MIC','COM2 MIC'],['COM2','COM2'],['COM3MIC','COM3 MIC'],['COM3','COM3'],['COM12','COM1/2'],['TEL','TEL'],['PA','PA'],['SPKR','SPKR'],['MKR','MKR/MUTE'],['HISENS','HI SENS'],['DME','DME'],['NAV1','NAV1'],['ADF','ADF'],['NAV2','NAV2'],['AUX','AUX'],['MANSQ','MAN SQ'],['PLAY','PLAY'],['PILOT','PILOT'],['COPLT','COPLT']];
AUD.forEach(([k,l],i)=>add({id:'aud'+k,t:'abtn',x:i<20?(i%2?838:802):820,y:i<20?248+Math.floor(i/2)*29:540,l}));
add({id:'audVol',t:'rot',x:820,y:578,l:'VOL',r:13});
add({id:'audBackup',t:'abtn',x:820,y:614,l:'DISPLAY BACKUP',red:1});
// right column: circuit breakers and de-ice
const CBS=['ESS BUS','ENG L','ENG R','ECU L A','ECU L B','ECU R A','ECU R B','START','PFD','MFD','COM1','COM2','NAV1','NAV2','XPDR','AUDIO','AUTOPILOT','FLAPS','LDG GEAR','PITOT','FUEL PUMP L','FUEL PUMP R','LIGHTS','AV BUS'];
CBS.forEach((n,i)=>add({id:'cb'+i,t:'cb',x:1418+(i%4)*40,y:242+Math.floor(i/4)*40,l:n,cb:n}));
add({id:'deice',t:'rotsel',x:1428,y:540,l:'DE-ICE',vals:['OFF','NORM','HIGH','MAX'],ang:[-60,-20,20,60]});
add({id:'wshield',t:'push',x:1462,y:540,l:'W/SHIELD',r:9});
add({id:'deiceTest',t:'tog',x:1500,y:532,l:'ANN TEST',s:6});
// console
add({id:'rudTrim',t:'hwheel',x:800,y:772,l:'RUDDER TRIM'});
add({id:'park',t:'park',x:640,y:812,l:'PARKING BRAKE'});
add({id:'pwr',t:'power',x:760,y:810,l:'POWER'});
add({id:'trim',t:'vwheel',x:942,y:858,l:'ELEVATOR TRIM'});
add({id:'fselL',t:'fsel',x:705,y:938,l:'FUEL L'}); add({id:'fselR',t:'fsel',x:855,y:938,l:'FUEL R'});
add({id:'auxPumpL',t:'tog',x:1000,y:920,l:'AUX L',s:6.5}); add({id:'auxPumpR',t:'tog',x:1040,y:920,l:'AUX R',s:6.5});
add({id:'heat',t:'slide',x:600,y:900,l:'CABIN HEAT'}); add({id:'defrost',t:'slide',x:640,y:900,l:'DEFROST'});
add({id:'altAir',t:'pull',x:1060,y:800,l:'ALTERNATE AIR',lever:1});
add({id:'gearEmer',t:'pull',x:560,y:800,l:'EMERG GEAR',lever:1,red:1});

/* ---------- SVG building ---------- */
function lab(x,y,t,o){ o=o||{}; return `<text x="${x}" y="${y}" class="pl ${o.c||''}" style="font-size:calc(var(--ls,1)*${o.s||7.5}px)" text-anchor="${o.a||'middle'}">${esc(t)}</text>`; }
function plate(x,y,w,h,r,cls){ return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r||6}" class="${cls||'sub'}"/>`; }
function screw(x,y){ return `<g class="screw"><circle cx="${x}" cy="${y}" r="3.2"/><path d="M${x-2} ${y-1}l4 2"/></g>`; }

function ctlSVG(c){
  const {x,y}=c; let s='';
  switch(c.t){
    case 'tog': s=`<circle cx="${x}" cy="${y}" r="9" class="nut"/><circle cx="${x}" cy="${y}" r="5.5" class="nut2"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><rect x="${x-3.6}" y="${y-24}" width="7.2" height="24" rx="3.4" class="${c.red?'batr':'batg'}"/><ellipse cx="${x}" cy="${y-23}" rx="4.6" ry="3" class="${c.red?'batr':'batg'}"/></g>${lab(x,y+33,c.l,{s:c.s||7.5})}${lab(x,y-30,'ON',{s:6,c:'dim'})}`; break;
    case 'tog3': s=`<circle cx="${x}" cy="${y}" r="9" class="nut"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><rect x="${x-3.6}" y="${y-22}" width="7.2" height="22" rx="3.4" class="batg"/><ellipse cx="${x}" cy="${y-21}" rx="4.6" ry="3" class="batg"/></g>${lab(x+14,y-20,'ON',{s:6,a:'start'})}${lab(x+14,y+2,'ARM',{s:6,a:'start'})}${lab(x+14,y+22,'RESET',{s:6,a:'start'})}${lab(x,y-34,c.l)}`; break;
    case 'rocker': { const w=c.big?24:20, h=c.big?40:34; s=`<rect x="${x-w/2-3}" y="${y-h/2-3}" width="${w+6}" height="${h+6}" rx="4" class="bezel1"/><g class="mv rk"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="3" class="rock"/><rect class="rkTop" x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h/2}" rx="3"/><rect class="rkBot" x="${x-w/2}" y="${y}" width="${w}" height="${h/2}" rx="3"/><rect class="rkLed" x="${x-4}" y="${y-h/2+4}" width="8" height="2.5" rx="1"/></g>${lab(x,y+h/2+12,c.l)}`; break; }
    case 'guard': s=`<circle cx="${x}" cy="${y}" r="9" class="nut"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><rect x="${x-3.6}" y="${y-24}" width="7.2" height="24" rx="3.4" class="batg"/><ellipse cx="${x}" cy="${y-23}" rx="4.6" ry="3" class="batg"/></g><g class="gd" style="transform-origin:${x}px ${y+14}px"><path d="M${x-14} ${y+14}V${y-26}q0-6 6-6h16q6 0 6 6V${y+14}z" class="guardc"/><path d="M${x-10} ${y-20}h20" class="guardl"/></g>${lab(x,y+26,c.l)}`; break;
    case 'rot': { const r=c.r||13; s=`<circle cx="${x}" cy="${y}" r="${r+3}" class="ring0"/><g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/><circle cx="${x}" cy="${y}" r="${r-4}" class="knobtop"/><rect x="${x-1.2}" y="${y-r+1}" width="2.4" height="${r*0.6}" class="ptr"/></g>${lab(x,y+r+11,c.l,{s:6.5})}`; break; }
    case 'rotsel': { const r=13; s=`<circle cx="${x}" cy="${y}" r="${r+2}" class="ring0"/>${c.vals.map((v,i)=>{ const a=(c.ang[i]-90)*Math.PI/180; return `<text x="${x+Math.cos(a)*(r+12)}" y="${y+Math.sin(a)*(r+12)+2}" class="pl" font-size="5.6" text-anchor="middle">${v.replace('ECU ','')}</text>`; }).join('')}<g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/><path d="M${x-3} ${y+r-2}L${x} ${y-r+2}L${x+3} ${y+r-2}z" class="ptrbar"/></g>${lab(x,y+r+16,c.l,{s:6.5})}`; break; }
    case 'push': { const r=c.r||10; s=`<circle cx="${x}" cy="${y}" r="${r+3}" class="ring0"/><g class="mv pb"><circle cx="${x}" cy="${y}" r="${r}" class="pbtn"/><circle cx="${x-r*0.3}" cy="${y-r*0.35}" r="${r*0.35}" class="spec"/></g>${lab(x,y+r+10,c.l,{s:6})}`; break; }
    case 'abtn': { const w=c.l.length>9?34:30; s=`<g class="mv pb"><rect x="${x-w/2}" y="${y-9}" width="${w}" height="18" rx="2.5" class="${c.red?'abtnr':'abtn'}"/><rect class="aled" x="${x-5}" y="${y-7}" width="10" height="2" rx="1"/><text x="${x}" y="${y+5}" class="pl" font-size="${c.l.length>8?4.4:5.4}" text-anchor="middle">${esc(c.l)}</text></g>`; break; }
    case 'key': s=`<circle cx="${x}" cy="${y}" r="15" class="ring0"/><circle cx="${x}" cy="${y}" r="12" class="keyb"/><g class="mv rt" style="transform-origin:${x}px ${y}px"><rect x="${x-3}" y="${y-18}" width="6" height="36" rx="2.5" class="keyh"/><circle cx="${x}" cy="${y}" r="3" class="nut2"/></g>${lab(x-22,y-14,'L',{s:7})}${lab(x+22,y-14,'R',{s:7})}${lab(x,y-22,'OFF',{s:5.5,c:'dim'})}${lab(x,y+25,c.l)}`; break;
    case 'gear': s=`<rect x="${x-9}" y="${y-36}" width="18" height="72" rx="8" class="slot"/>${lab(x-18,y-28,'UP',{s:6.5,a:'end'})}${lab(x-18,y+33,'DN',{s:6.5,a:'end'})}<g class="mv gk"><rect x="${x-2.2}" y="${y-30}" width="4.4" height="30" class="rod"/><circle cx="${x}" cy="${y-30}" r="11" class="wheelk"/><circle cx="${x}" cy="${y-30}" r="5" class="wheelh"/></g>
      <g class="glights"><circle class="gl gN" cx="${x+28}" cy="${y-20}" r="4.2"/><circle class="gl gL" cx="${x+22}" cy="${y-9}" r="4.2"/><circle class="gl gR" cx="${x+34}" cy="${y-9}" r="4.2"/><circle class="gl gU" cx="${x+28}" cy="${y+12}" r="4.2"/>${lab(x+28,y+26,'GEAR UNSAFE',{s:4.6})}</g>${lab(x,y+52,c.l)}`; break;
    case 'flap': s=`<rect x="${x-8}" y="${y-36}" width="16" height="72" rx="7" class="slot"/>${['UP','APP','LDG'].map((v,i)=>lab(x-16,y-30+i*30+2,v,{s:6.5,a:'end'})).join('')}<g class="mv fk"><rect x="${x-14}" y="${y-36}" width="28" height="12" rx="3" class="flapk"/><path d="M${x-10} ${y-30}h20" class="flapl"/></g><g>${['UP','APP','LDG'].map((v,i)=>`<circle class="fl f${i}" cx="${x+28}" cy="${y-30+i*30}" r="4.2"/>`).join('')}</g>${lab(x,y+46,c.l)}`; break;
    case 'cb': s=`<circle cx="${x}" cy="${y}" r="8" class="cbcol"/><g class="mv cbk"><circle cx="${x}" cy="${y}" r="6" class="cbh"/></g><text x="${x}" y="${y+16}" class="pl" font-size="4.3" text-anchor="middle">${esc(c.l)}</text>`; break;
    case 'pull': s=c.lever?`<rect x="${x-26}" y="${y-8}" width="52" height="16" rx="6" class="slot"/><g class="mv pk"><rect x="${x-20}" y="${y-6}" width="40" height="12" rx="5" class="${c.red?'batr':'tbar'}"/></g>${lab(x,y+20,c.l,{s:6.5})}`:`<circle cx="${x}" cy="${y}" r="11" class="ring0"/><g class="mv pk" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="8.5" class="knob"/><circle cx="${x}" cy="${y}" r="4" class="knobtop"/></g>${lab(x,y+21,c.l,{s:6.2})}`; break;
    case 'slide': s=`<rect x="${x-5}" y="${y-30}" width="10" height="60" rx="4" class="slot"/><g class="mv sk"><rect x="${x-11}" y="${y-6}" width="22" height="12" rx="3" class="tbar"/></g>${lab(x,y+42,c.l,{s:5.4})}`; break;
    case 'park': s=`<rect x="${x-8}" y="${y-30}" width="16" height="60" rx="6" class="slot"/><g class="mv pkb"><rect x="${x-16}" y="${y-30}" width="32" height="13" rx="4" class="batr"/></g>${lab(x,y+42,c.l,{s:6})}${lab(x+22,y-24,'REL',{s:5.5,a:'start'})}${lab(x+22,y+28,'SET',{s:5.5,a:'start'})}`; break;
    case 'power': { const xs=[x-40,x+30]; s=`<rect x="${x-82}" y="${y-22}" width="164" height="128" rx="10" class="quad"/>${xs.map(xx=>`<rect x="${xx-6}" y="${y-8}" width="12" height="104" rx="5" class="slot"/>`).join('')}
      ${[0,25,50,75,100].map(p=>{ const yy=y+92-p*0.92; return `<path d="M${x-72} ${yy}h10M${x+64} ${yy}h10" class="tick"/>${lab(x-76,yy+2.5,p+'',{s:5.5,a:'end'})}`; }).join('')}
      ${lab(x,y-11,'MAX',{s:7})}${lab(x,y+101,'IDLE',{s:7})}
      ${xs.map((xx,i)=>`<g class="mv lv${i}"><rect x="${xx-2.5}" y="${y}" width="5" height="12" class="rod"/><path d="M${xx-20} ${y-6}q0-8 8-8h24q8 0 8 8v10q0 6-6 6h-28q-6 0-6-6z" class="lever"/><path d="M${xx-14} ${y-5}h28M${xx-14} ${y-1}h28M${xx-14} ${y+3}h28" class="grip"/>${i?'':`<rect x="${xx-21}" y="${y-8}" width="3.5" height="8" rx="1" class="gabtn"/>`}</g>`).join('')}
      <rect class="both" x="${x-22}" y="${y-20}" width="22" height="120" fill="transparent"/>${xs.map((xx,i)=>lab(xx,y+111,i?'R':'L',{s:7})).join('')}${lab(x-62,y-11,c.l,{s:6.5})}`; break; }
    case 'vwheel': s=`<rect x="${x-14}" y="${y-58}" width="28" height="116" rx="8" class="slot"/><svg x="${x-10}" y="${y-54}" width="20" height="108" overflow="hidden"><g class="mv wr">${Array.from({length:36},(_,i)=>`<rect x="0" y="${i*6-54}" width="20" height="3" rx="1" class="ridge"/>`).join('')}</g></svg><path d="M${x+16} ${y}h7" class="tomark"/>${lab(x+26,y+2.5,'T/O',{s:6,a:'start'})}${lab(x,y-64,'NOSE DN',{s:5.6})}${lab(x,y+68,'NOSE UP',{s:5.6})}<path class="mv trind" d="M${x-24} ${y}l6-4v8z"/>${lab(x,y+80,c.l,{s:6})}`; break;
    case 'hwheel': s=`<rect x="${x-50}" y="${y-10}" width="100" height="20" rx="8" class="slot"/><svg x="${x-46}" y="${y-7}" width="92" height="14" overflow="hidden"><g class="mv wr">${Array.from({length:32},(_,i)=>`<rect y="0" x="${i*6-48}" width="3" height="14" rx="1" class="ridge"/>`).join('')}</g></svg><path d="M${x} ${y-12}v-5" class="tomark"/><path class="mv trind" d="M${x} ${y+12}l-4 6h8z"/>${lab(x-56,y+3,'L',{s:7,a:'end'})}${lab(x+56,y+3,'R',{s:7,a:'start'})}${lab(x,y+28,c.l,{s:6})}`; break;
    case 'fsel': s=`<circle cx="${x}" cy="${y}" r="20" class="quad"/>${lab(x-25,y+2,'ON',{s:6,a:'end'})}${lab(x,y-25,'XFEED',{s:5.6})}${lab(x+25,y+2,'OFF',{s:6,a:'start',c:'red'})}<path class="fguard" d="M${x+12} ${y-16}l10 8"/><g class="mv rt" style="transform-origin:${x}px ${y}px"><path d="M${x-5} ${y+12}L${x-3} ${y-18}h6L${x+5} ${y+12}z" class="lever"/><circle cx="${x}" cy="${y}" r="5" class="nut2"/></g>${lab(x,y+29,c.l,{s:6.5})}`; break;
    case 'vent': { const r=c.r; s=`<circle cx="${x}" cy="${y}" r="${r+6}" class="bezel1"/><circle cx="${x}" cy="${y}" r="${r}" class="ventb"/><g class="mv" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r*0.62}" class="ventc"/>${Array.from({length:8},(_,i)=>`<path d="M${x} ${y}l${Math.cos(i*Math.PI/4)*r*0.6} ${Math.sin(i*Math.PI/4)*r*0.6}" class="vfin"/>`).join('')}<circle cx="${x}" cy="${y}" r="${r*0.18}" class="knobtop"/><rect x="${x-2}" y="${y-r*0.6}" width="4" height="${r*0.3}" class="ptr"/></g>${lab(x,y+r+16,c.l,{s:6})}`; break; }
    case 'stick': s=`<ellipse cx="${x}" cy="${H-14}" rx="44" ry="8" class="boot0"/><path d="M${x-38} ${H-8}Q${x-30} ${H-64} ${x-12} ${H-78}H${x+12}Q${x+30} ${H-64} ${x+38} ${H-8}Z" class="boot"/><g class="mv skg"><path class="shaft" d="M${x} ${H-74}L${x} ${y+40}"/><path d="M${x-17} ${y-30}q0-14 17-14q19 0 19 15l-3 66q-1 8-16 8q-14 0-15-9z" class="grip"/><path d="M${x-12} ${y-14}h24M${x-12} ${y-6}h24M${x-12} ${y+2}h24M${x-12} ${y+10}h24" class="gripl"/></g>${c.co?'':''}`; break;
    case 'sbtn': { const r=c.r||5.5; s=`<g class="mv sbm"><circle cx="${x+c.dx}" cy="${y+c.dy}" r="${r}" fill="${c.col}" stroke="#000"/></g>`; break; }
    case 'deco': s=`<circle cx="${x}" cy="${y}" r="7" class="nut"/><circle cx="${x}" cy="${y}" r="2.6" fill="#050607"/>${lab(x,y+15,'MIC',{s:5})}`; break;
  }
  const role=({vent:'switch',stick:'application',sbtn:'button',tog:'switch',rocker:'switch',guard:'switch',push:'button',abtn:'button',cb:'switch',pull:'switch',park:'switch',gear:'switch'})[c.t]||'slider';
  if(c.t==='deco') return `<g>${s}</g>`;
  return `<g class="ctl t-${c.t}" data-id="${c.id}" tabindex="0" role="${role}" aria-label="${esc(c.l)}">${s}</g>`;
}

function standby(){
  // ASI, attitude, altimeter, compass in the top strip
  const asi=(()=>{ const x=760,y=158,r=44; let t=''; for(let v=40;v<=200;v+=10){ const a=asiAng(v)*Math.PI/180; const L=v%20?5:9; t+=`<path d="M${x+Math.sin(a)*r} ${y-Math.cos(a)*r}L${x+Math.sin(a)*(r-L)} ${y-Math.cos(a)*(r-L)}" class="dtick"/>`; if(v%40===0) t+=`<text x="${x+Math.sin(a)*(r-17)}" y="${y-Math.cos(a)*(r-17)+3}" class="dnum" font-size="8.5" text-anchor="middle">${v}</text>`; }
    const arc=(a,b,cl,rr)=>{ const A=asiAng(a)*Math.PI/180, B=asiAng(b)*Math.PI/180; return `<path d="M${x+Math.sin(A)*rr} ${y-Math.cos(A)*rr}A${rr} ${rr} 0 ${asiAng(b)-asiAng(a)>180?1:0} 1 ${x+Math.sin(B)*rr} ${y-Math.cos(B)*rr}" class="${cl}"/>`; };
    return `<circle cx="${x}" cy="${y}" r="${r+6}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${arc(62,113,'awhite',r-2)}${arc(66,151,'agreen',r-4)}${arc(151,188,'ayellow',r-4)}${arc(76,77,'ared',r-2)}${arc(85,86.5,'ablue',r-2)}${t}<text x="${x}" y="${y+16}" class="dnum" font-size="6" text-anchor="middle">KNOTS</text><g class="sbAsi" style="transform-origin:${x}px ${y}px"><path d="M${x-2} ${y+8}L${x} ${y-r+6}L${x+2} ${y+8}z" class="needle"/></g><circle cx="${x}" cy="${y}" r="3.5" class="hub"/>`; })();
  const att=(()=>{ const x=868,y=158,r=44; return `<circle cx="${x}" cy="${y}" r="${r+6}" class="sbz"/><clipPath id="attc"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><g clip-path="url(#attc)"><g class="sbAtt" style="transform-origin:${x}px ${y}px"><rect x="${x-120}" y="${y-160}" width="240" height="160" fill="#2f86d6"/><rect x="${x-120}" y="${y}" width="240" height="160" fill="#7b4a22"/><path d="M${x-120} ${y}h240" stroke="#fff" stroke-width="1.5"/>${[-20,-10,10,20].map(p=>`<path d="M${x-(Math.abs(p)===10?10:16)} ${y-p*1.6}h${Math.abs(p)===10?20:32}" stroke="#fff" stroke-width="1.2"/>`).join('')}</g></g><path d="M${x-26} ${y}h16l4 6 4-6h16" class="acsym"/><circle cx="${x}" cy="${y}" r="2" fill="#ffb000"/><path d="M${x} ${y-r+1}l-4 8h8z" fill="#ffb000"/>`; })();
  const alt=(()=>{ const x=976,y=158,r=44; let t=''; for(let i=0;i<50;i++){ const a=i/50*2*Math.PI; const L=i%5?4:8; t+=`<path d="M${x+Math.sin(a)*r} ${y-Math.cos(a)*r}L${x+Math.sin(a)*(r-L)} ${y-Math.cos(a)*(r-L)}" class="dtick"/>`; if(i%5===0) t+=`<text x="${x+Math.sin(a)*(r-15)}" y="${y-Math.cos(a)*(r-15)+3.2}" class="dnum" font-size="9" text-anchor="middle">${i/5}</text>`; }
    return `<circle cx="${x}" cy="${y}" r="${r+6}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${t}<rect x="${x+8}" y="${y+6}" width="22" height="9" rx="1" fill="#000" stroke="#555" stroke-width=".6"/><text class="sbKol dnum" x="${x+19}" y="${y+13}" font-size="6.5" text-anchor="middle">1013</text><g class="sbAlt1" style="transform-origin:${x}px ${y}px"><path d="M${x-3} ${y+6}L${x} ${y-20}L${x+3} ${y+6}z" class="needle"/></g><g class="sbAlt0" style="transform-origin:${x}px ${y}px"><path d="M${x-1.6} ${y+8}L${x} ${y-r+5}L${x+1.6} ${y+8}z" class="needle"/></g><circle cx="${x}" cy="${y}" r="3.5" class="hub"/>`; })();
  const cmp=(()=>{ const x=1100,y=150; let t=''; for(let d=0;d<720;d+=10){ const lx=d*1.6; const lb={0:'N',90:'E',180:'S',270:'W',360:'N',450:'E',540:'S',630:'W'}[d]; t+=`<path d="M${lx} ${12}v${d%30?4:7}" stroke="#ddd" stroke-width=".8"/>${d%30===0?`<text x="${lx}" y="30" fill="#eee" font-size="${lb?10:7}" text-anchor="middle" font-family="IBM Plex Sans,sans-serif">${lb||((d%360)/10)}</text>`:''}`; }
    return `<rect x="${x-46}" y="${y-30}" width="92" height="64" rx="14" class="sbz"/><svg x="${x-34}" y="${y-18}" width="68" height="40" overflow="hidden"><rect width="68" height="40" fill="#0e1012"/><g class="sbCmp">${t}</g></svg><path d="M${x} ${y-20}v42" stroke="#ff7a00" stroke-width="1.3"/><text x="${x}" y="${y+46}" class="pl" font-size="6.5" text-anchor="middle">STBY COMPASS</text>`; })();
  return asi+att+alt+cmp+lab(760,220,'STBY AIRSPEED',{s:6})+lab(868,220,'STBY ATTITUDE',{s:6})+lab(976,220,'STBY ALTIMETER',{s:6});
}
function asiAng(v){ return v<40?0:20+(Math.min(v,200)-40)/160*310; }

function panelSVG(){
  const vent=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r+6}" class="bezel1"/><circle cx="${x}" cy="${y}" r="${r}" class="ventb"/><circle cx="${x}" cy="${y}" r="${r*0.62}" class="ventc"/>${Array.from({length:8},(_,i)=>`<path d="M${x} ${y}l${Math.cos(i*Math.PI/4)*r*0.6} ${Math.sin(i*Math.PI/4)*r*0.6}" class="vfin"/>`).join('')}<circle cx="${x}" cy="${y}" r="${r*0.18}" class="knobtop"/>`;
  return `<svg class="psvg" viewBox="0 0 ${W} ${H}" xmlns="${NS}" aria-hidden="false">
<defs>
 <linearGradient id="gPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f45"/><stop offset=".55" stop-color="#2c3035"/><stop offset="1" stop-color="#23272b"/></linearGradient>
 <linearGradient id="gSub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#474d54"/><stop offset="1" stop-color="#363b41"/></linearGradient>
 <linearGradient id="gGlare" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16181b"/><stop offset=".8" stop-color="#0d0f11"/><stop offset="1" stop-color="#1d2024"/></linearGradient>
 <linearGradient id="gCons" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2e33"/><stop offset="1" stop-color="#17191c"/></linearGradient>
 <radialGradient id="gKnob" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#5d646d"/><stop offset=".6" stop-color="#25292e"/><stop offset="1" stop-color="#121417"/></radialGradient>
 <radialGradient id="gMetal" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#f2f4f6"/><stop offset=".45" stop-color="#a7adb4"/><stop offset="1" stop-color="#5a6067"/></radialGradient>
 <linearGradient id="gBat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d949b"/><stop offset=".45" stop-color="#f4f6f8"/><stop offset="1" stop-color="#6f767d"/></linearGradient>
 <linearGradient id="gBatR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8f1d14"/><stop offset=".45" stop-color="#ef4a3a"/><stop offset="1" stop-color="#7d160f"/></linearGradient>
 <linearGradient id="gRock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f4f2"/><stop offset="1" stop-color="#c9ccc8"/></linearGradient>
 <linearGradient id="gLever" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5057"/><stop offset="1" stop-color="#16181b"/></linearGradient>
 <filter id="fGlow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation=".7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="fLed" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="fShadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".55"/></filter>
</defs>
<!-- canopy frame -->
<path d="M0 0H${W}V300C1500 120 1250 60 800 56C350 60 100 120 0 300Z" class="frame" opacity=".0"/>
<path d="M-10 420C40 200 120 110 230 70L250 0H-10Z" class="frame"/><path d="M${W+10} 420C${W-40} 200 ${W-120} 110 ${W-230} 70L${W-250} 0H${W+10}Z" class="frame"/>
<!-- glareshield and panel face -->
<path d="M18 770V250Q18 140 130 118Q800 46 1470 118Q1582 140 1582 250V770Z" fill="url(#gGlare)" filter="url(#fShadow)"/>
<path d="M34 765V262Q34 170 136 152Q800 86 1464 152Q1566 170 1566 262V765Z" fill="url(#gPanel)"/>
<path d="M34 765V262Q34 170 136 152Q800 86 1464 152Q1566 170 1566 262V765Z" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="2"/>
<path d="M136 152Q800 86 1464 152" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="2"/>
<!-- top strip -->
${plate(306,104,990,124,12)}${screw(316,114)}${screw(1286,114)}${screw(316,218)}${screw(1286,218)}
${lab(424,128,'LIGHTS',{s:6.5,c:'gp'})}<path d="M326 131h80M442 131h170" class="grpl"/>
${plate(1192,128,70,82,6,'sub2')}
${standby()}
<!-- left column -->
${plate(48,232,182,388,10)}
${lab(138,248,'FUEL PUMPS',{s:6.5,c:'gp'})}

${plate(56,424,166,120,6,'sub2')}${lab(98,436,'L ENGINE',{s:6})}${lab(180,436,'R ENGINE',{s:6})}
${lab(138,560,'ALTERNATOR',{s:6.5,c:'gp'})}
<!-- right column -->
${plate(1400,222,160,262,8)}${lab(1480,230,'CIRCUIT BREAKERS',{s:6,c:'gp'})}
${plate(1400,494,160,70,8,'sub2')}${lab(1480,506,'DE-ICE (IF FITTED)',{s:5.6,c:'gp'})}

<!-- audio panel -->
${plate(784,226,72,400,8,'sub2')}
<!-- switch row -->
${plate(240,650,580,104,8)}${lab(440,664,'ENGINE MASTER',{s:6.5,c:'gp'})}<path d="M372 667h30M478 667h30" class="grpl"/>
${plate(838,650,540,104,8)}
<g class="placard">${plate(950,664,250,74,4,'plc')}${lab(1075,678,'OPERATING LIMITS (KIAS)',{s:6.3})}${lab(960,694,'VMCA 76 · VYSE 85 · VNE 188',{s:6.3,a:'start'})}${lab(960,708,'VFE APP 133 · VFE LDG 113',{s:6.3,a:'start'})}${lab(960,722,'VLO 152 · VLE 188',{s:6.3,a:'start'})}${lab(1290,700,'TRAINING USE ONLY',{s:6.5})}${lab(1290,714,'Follow the AFM and your SOP',{s:5.6})}</g>
<!-- centre console -->
<path d="M590 765H1010L1040 980H560Z" fill="url(#gCons)" stroke="#000" stroke-opacity=".6"/>
<path d="M600 772H1000" stroke="#fff" stroke-opacity=".06"/>
${plate(500,770,90,60,6,'sub2')}${plate(1015,770,92,60,6,'sub2')}
<g class="ctls">${C.map(ctlSVG).join('')}</g>
</svg>`;
}

/* ---------- build ---------- */
function build(stage,io){
  const world=document.createElement('div'); world.className='world'; world.style.width=W+'px'; world.style.height=H+'px';
  world.innerHTML=panelSVG()+
   `<div class="gdu" id="bzP" style="left:242px;top:228px;width:536px;height:400px"></div><div class="gdu" id="bzM" style="left:862px;top:228px;width:536px;height:400px"></div>`;
  /* the panel sits in an unscaled full-stage wrapper; CSS composites it while the outside view is drawn behind the panel, so the
     WebGL canvas below does not split the panel into overlap layers (the panel itself keeps its scale and stays sharp) */
  const wlay=document.createElement('div'); wlay.className='wlay'; wlay.appendChild(world);
  stage.appendChild(wlay);
  const svg=world.querySelector('svg'), byId={}; if(CPT) svg.classList.add('cpt');
  svg.querySelectorAll('g.ctl').forEach(g=>{ const c=C.find(k=>k.id===g.dataset.id); byId[c.id]={c,g}; });
  // highlight rings from bounding boxes
  // highlight rings + non-overlapping hit zones in a layer below every control
  requestAnimationFrame(()=>{ const layer=document.createElementNS(NS,'g'); layer.setAttribute('class','hits'); const host=svg.querySelector('g.ctls'); host.insertBefore(layer,host.firstChild);
    const Z=[]; Object.values(byId).forEach(o=>{ try{ const b=o.g.getBBox(); const r=document.createElementNS(NS,'rect'); r.setAttribute('class','hlr');
      const x0=Math.max(1,b.x-5), y0=Math.max(1,b.y-5), x1=Math.min(W-1,b.x+b.width+5), y1=Math.min(H-1,b.y+b.height+5);
      r.setAttribute('x',x0); r.setAttribute('y',y0); r.setAttribute('width',x1-x0); r.setAttribute('height',y1-y0); r.setAttribute('rx',8); o.g.insertBefore(r,o.g.firstChild);
      if(o.c.t==='sbtn') return; const cx=b.x+b.width/2, cy=b.y+b.height/2, hw=Math.max(b.width+10,34)/2, hh=Math.max(b.height+10,34)/2; Z.push({o,cx,cy,x0:cx-hw,x1:cx+hw,y0:cy-hh,y1:Math.min(H-1,cy+hh)}); }catch(e){} });
    for(let a=0;a<Z.length;a++) for(let k=a+1;k<Z.length;k++){ const A=Z[a], B=Z[k]; if(A.x1<=B.x0||B.x1<=A.x0||A.y1<=B.y0||B.y1<=A.y0) continue;
      const dx=B.cx-A.cx, dy=B.cy-A.cy;
      if(Math.abs(dx)>=Math.abs(dy)){ const m=(A.cx+B.cx)/2; if(dx>=0){ A.x1=Math.min(A.x1,m); B.x0=Math.max(B.x0,m); } else { A.x0=Math.max(A.x0,m); B.x1=Math.min(B.x1,m); } }
      else { const m=(A.cy+B.cy)/2; if(dy>=0){ A.y1=Math.min(A.y1,m); B.y0=Math.max(B.y0,m); } else { A.y0=Math.max(A.y0,m); B.y1=Math.min(B.y1,m); } } }
    Z.forEach(z=>{ if(z.x1<=z.x0||z.y1<=z.y0) return; const h=document.createElementNS(NS,'rect'); const wh=WHT.includes(z.o.c.t); h.setAttribute('class',wh?'hit hitw':'hit'); if(wh) fineWheel(h,onWheel); h.dataset.for=z.o.c.id; h.setAttribute('x',z.x0); h.setAttribute('y',z.y0); h.setAttribute('width',z.x1-z.x0); h.setAttribute('height',z.y1-z.y0); layer.appendChild(h); }); });
  const onWheel=bind(world,byId,io);
  return {world,svg,byId,W,H,REG,REG_ORDER,C,AUD,CBS};
}

/* ---------- interaction ---------- */
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
const WHT=['rot','rotsel','vwheel','hwheel','power','flap','slide','fsel'];
function ctlFromBy(byId,t){ if(!t||!t.closest) return null; const g=t.closest('g.ctl'); if(g) return g; const h=t.closest('.hit'); return h&&byId[h.dataset.for]?byId[h.dataset.for].g:null; }
function bind(world,byId,io){
  const ctlFrom=t=>ctlFromBy(byId,t);
  const svg=world.querySelector('svg'); const pt0=svg.createSVGPoint();
  io.toWorld=e=>{ pt0.x=e.clientX; pt0.y=e.clientY; const p=pt0.matrixTransform(svg.getScreenCTM().inverse()); return {x:p.x,y:p.y}; };
  const step=(o,d)=>{ const c=o.c, v=io.get(c.id);
    switch(c.t){
      case 'tog': case 'rocker': case 'vent': case 'cb': case 'pull': case 'park': case 'abtn': if(c.t==='abtn'&&!c.red&&false) return; io.set(c.id,d>0?1:d<0?0:(v?0:1)); return;
      case 'guard': { if(!io.get('emerG')){ io.set('emerG',1); return; } if(d===0){ if(v) io.set(c.id,0); else io.set(c.id,1); } else io.set(c.id,d>0?1:0); return; }
      case 'tog3': io.set(c.id,Math.max(-1,Math.min(1,(v||0)+(d||1)*-1))); return;
      case 'rotsel': io.set(c.id,Math.max(0,Math.min(c.vals.length-1,v+(d||1)))); return;
      case 'rot': io.set(c.id,Math.max(0,Math.min(1,v+d*0.08))); return;
      case 'slide': io.set(c.id,Math.max(0,Math.min(1,v+d*0.1))); return;
      case 'gear': io.set(c.id,d>0?0:d<0?1:(v?0:1)); return;
      case 'flap': io.set(c.id,Math.max(0,Math.min(2,v-(d||0)))); return;
      case 'fsel': io.set(c.id,Math.max(0,Math.min(2,v+(d||1)))); return;
      case 'vwheel': case 'hwheel': io.set(c.id,Math.max(-1,Math.min(1,v+d*0.04))); return;
      case 'power': io.set('pwr',[Math.max(0,Math.min(1,io.get('pwrL')+d*0.05)),Math.max(0,Math.min(1,io.get('pwrR')+d*0.05))]); return;
    } };
  let wacc=0;
  const onWheel=e=>{ const g=ctlFrom(e.target); if(!g) return; const o=byId[g.dataset.id]; if(!WHT.includes(o.c.t)) return; e.preventDefault(); e.stopPropagation(); if(e.ctrlKey) return; const raw=(Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:-e.deltaX)*(e.deltaMode?40:1); wacc+=raw; if(Math.abs(wacc)<30) return; const d=wacc<0?1:-1; wacc=0;
    if(o.c.t==='power'){ const lv=e.target.closest('.lv0')?0:e.target.closest('.lv1')?1:-1; if(lv>=0){ io.set(lv?'pwrR':'pwrL',Math.max(0,Math.min(1,io.get(lv?'pwrR':'pwrL')+d*0.04))); return; } }
    if(o.c.t==='vwheel') return step(o,-d);
    step(o,d); };
  Object.values(byId).forEach(o=>{ if(WHT.includes(o.c.t)) fineWheel(o.g,onWheel); });
  let drag=null;
  world.addEventListener('pointerdown',e=>{ const g=ctlFrom(e.target); if(!g) return; if(io.intercept&&io.intercept(e,g)) return; const o=byId[g.dataset.id], c=o.c; e.preventDefault(); e.stopPropagation(); g.focus({preventScroll:true});
    const pt=io.toWorld(e);
    if(c.t==='push'||(c.t==='abtn'&&c.momentary)){ io.set(c.id,1); drag={o,mom:1}; g.setPointerCapture(e.pointerId); return; }
    if(c.t==='key'){ const d=pt.x<c.x?-1:1; io.set('start',d); drag={o,mom:1}; g.setPointerCapture(e.pointerId); return; }
    if(c.t==='power'){ let lv=e.target.closest('.lv0')?'pwrL':e.target.closest('.lv1')?'pwrR':(e.target.closest('.both')?'both':null);
      if(!lv){ lv=pt.x<c.x-5?'pwrL':'pwrR'; const v=Math.max(0,Math.min(1,(c.y+92-pt.y)/92)); io.set(lv,v); }
      drag={o,lv,y:pt.y,v:[io.get('pwrL'),io.get('pwrR')]}; g.setPointerCapture(e.pointerId); g.classList.add('drag'); return; }
    if(c.t==='vwheel'||c.t==='hwheel'||c.t==='rot'||c.t==='slide'){ drag={o,x:pt.x,y:pt.y,v:io.get(c.id),moved:0}; g.setPointerCapture(e.pointerId); return; }
    if(c.t==='rotsel'||c.t==='fsel'){ // pick nearest detent by angle
      const a=Math.atan2(pt.x-c.x,-(pt.y-c.y))*180/Math.PI; if(c.t==='fsel'){ const t=a<-25?0:a<25?1:2; if(t===2&&io.get(c.id)!==2&&!io.get(c.id+'G')){ io.set(c.id+'G',1); return; } io.set(c.id,t); return; }
      const v=io.get(c.id); if(Math.hypot(pt.x-c.x,pt.y-c.y)>34){ let best=0; c.ang.forEach((x,i)=>{ if(Math.abs(x-a)<Math.abs(c.ang[best]-a)) best=i; }); io.set(c.id,best); return; } io.set(c.id,Math.max(0,Math.min(c.vals.length-1,v+(pt.x<c.x?-1:1)))); return; }
    if(c.t==='flap'){ const idx=Math.max(0,Math.min(2,Math.round((pt.y-(c.y-30))/30))); io.set(c.id,idx); return; }
    if(c.t==='tog'||c.t==='rocker'||c.t==='vent'){ drag={o,tg:1,y:pt.y,done:0}; g.setPointerCapture(e.pointerId); return; }
    if(c.t==='stick'){ drag={o,stk:1,x:pt.x,y:pt.y}; g.setPointerCapture(e.pointerId); g.classList.add('drag'); io.set('stick',{x:0,y:0}); return; }
    if(c.t==='sbtn'){ io.set(c.id,1); drag={o,mom:1}; g.setPointerCapture(e.pointerId); return; }
    if(c.t==='tog3'){ io.set(c.id,pt.y<c.y-8?-1:pt.y>c.y+8?1:0); return; }
    if(c.t==='guard'){ const onGuard=e.target.closest('.gd'); if(onGuard||!io.get('emerG')){ io.set('emerG',io.get('emerG')?0:1); return; } io.set(c.id,io.get(c.id)?0:1); return; }
    step(o,0);
  });
  world.addEventListener('pointermove',e=>{ if(!drag||drag.mom) return; const c=drag.o.c, pt=io.toWorld(e);
    if(drag.tg){ const dy=pt.y-drag.y; if(!drag.done&&Math.abs(dy)>7&&c.t!=='vent'){ drag.done=1; io.set(c.id,dy<0?1:0); } return; }
    if(drag.stk){ io.set('stick',{x:Math.max(-1,Math.min(1,(pt.x-drag.x)/45)),y:Math.max(-1,Math.min(1,(pt.y-drag.y)/40))}); return; }
    if(c.t==='power'){ const dv=-(pt.y-drag.y)/92; if(drag.lv==='both') io.set('pwr',[Math.max(0,Math.min(1,drag.v[0]+dv)),Math.max(0,Math.min(1,drag.v[1]+dv))]); else io.set(drag.lv,Math.max(0,Math.min(1,drag.v[drag.lv==='pwrL'?0:1]+dv))); return; }
    if(c.t==='vwheel') io.set(c.id,Math.max(-1,Math.min(1,drag.v+(pt.y-drag.y)/110)));
    if(c.t==='hwheel') io.set(c.id,Math.max(-1,Math.min(1,drag.v+(pt.x-drag.x)/90)));
    if(c.t==='rot') io.set(c.id,Math.max(0,Math.min(1,drag.v+(pt.x-drag.x)/60)));
    if(c.t==='slide') io.set(c.id,Math.max(0,Math.min(1,drag.v-(pt.y-drag.y)/50)));
  });
  const end=()=>{ if(!drag) return; if(drag.tg&&!drag.done) io.set(drag.o.c.id,io.get(drag.o.c.id)?0:1); if(drag.stk) io.set('stick',null); if(drag.mom){ const c=drag.o.c; io.set(c.t==='key'?'start':c.id,0); } drag.o.g.classList.remove('drag'); drag=null; };
  world.addEventListener('pointerup',end); world.addEventListener('pointercancel',end);
  // keyboard
  const held=new Set();
  world.addEventListener('keydown',e=>{ const g=e.target.closest&&e.target.closest('g.ctl'); if(!g) return; const o=byId[g.dataset.id], c=o.c; const k=e.key;
    let d=null; if(k==='ArrowUp'||k==='ArrowRight') d=1; else if(k==='ArrowDown'||k==='ArrowLeft') d=-1;
    if(c.t==='push'||c.t==='key'){ if(e.repeat) { e.preventDefault(); return; } if(k===' '||k==='Enter'||(c.t==='key'&&d!=null)){ io.set(c.t==='key'?'start':c.id,c.t==='key'?(k==='ArrowLeft'?-1:1):1); held.add(c.id); e.preventDefault(); e.stopPropagation(); } return; }
    if(c.t==='power'){ if(d!=null){ step(o,d); e.preventDefault(); e.stopPropagation(); } return; }
    if(k===' '||k==='Enter'){ step(o,0); e.preventDefault(); e.stopPropagation(); return; }
    if(d!=null){ if(c.t==='vwheel') d=-d; if(c.t==='flap') d=d; step(o,d); e.preventDefault(); e.stopPropagation(); } });
  world.addEventListener('keyup',e=>{ const g=e.target.closest&&e.target.closest('g.ctl'); if(!g) return; const c=byId[g.dataset.id].c; if(held.has(c.id)){ held.delete(c.id); io.set(c.t==='key'?'start':c.id,0); } });
  return onWheel;
}

/* ---------- render state ---------- */
const cache={};
/* moving parts (.mv/.mvi/.gd/.lv0/.lv1) take their transform as custom properties (--bbx/--bby/--bbr/--bbsx/--bbsy, see the panel CSS)
   when the browser supports @property, so their transitions run on the main thread and do not lift half the panel into compositor layers */
const CPT=typeof CSS!=='undefined'&&!!G.CSSPropertyRule, TPN=['--bbx','--bby','--bbr','--bbsx','--bbsy'], TID=['0px','0px','0deg','1','1'];
function tProps(t){ const v=TID.slice(); if(t==='none'||t==='') return v; let i=0; const re=/(\w+)\(([^)]*)\)\s*/y; let m;
  while(i<t.length&&(m=(re.lastIndex=i,re.exec(t)))){ i=re.lastIndex; const a=m[2].split(',').map(x=>x.trim()), f=m[1];
    if(f==='translateX'&&!v.o) v[0]=a[0]; else if(f==='translateY'&&!v.o) v[1]=a[0]; else if(f==='translate'&&!v.o){ v[0]=a[0]; v[1]=a[1]||'0px'; }
    else if(f==='rotate'&&v.o!==2&&v.o!==3){ v[2]=a[0]; v.o=2; } else if(f==='scale'&&v.o!==3){ v[3]=a[0]; v[4]=a[1]||a[0]; v.o=3; } else if(f==='scaleX'&&v.o!==3){ v[3]=a[0]; v.o=3; } else if(f==='scaleY'&&v.o!==3){ v[4]=a[0]; v.o=3; }
    else return null; }
  return i===t.length?v:null; }
function setT(el,t){ if(!el||el._t===t) return; el._t=t;
  if(el._cp===undefined) el._cp=CPT&&(el.classList.contains('mv')||el.classList.contains('mvi')||el.classList.contains('gd')||el.classList.contains('lv0')||el.classList.contains('lv1'));
  const v=el._cp?tProps(t):null;
  if(v){ /* driven continuously (stick or yoke, trim wheel, lever drag): no easing between 30 Hz updates, so the part is not animated (and
       repainted) on every frame in between; a single change still eases as before */
    const now=performance.now(), cont=now-(el._lt||-1e9)<120; el._lt=now; if(cont!==!!el._cn){ el._cn=cont; el.style.transitionDuration=cont?'0s':''; }
    if(el._ti){ el._ti=0; el.style.transform=''; } for(let i=0;i<5;i++){ const k=TPN[i], x=String(v[i]); if((el['_p'+i]||TID[i])!==x){ el['_p'+i]=x; el.style.setProperty(k,x); } } }
  else { el._ti=1; el.style.transform=t; } }
function sync(P,io){
  for(const id in P.byId){ const {c,g}=P.byId[id]; let v=io.get(id); if(c.t==='guard') v=v+'|'+io.get('emerG'); if(c.t==='fsel') v=v+'|'+io.get(id+'G'); if(c.t==='power') v=io.get('pwrL').toFixed(3)+'|'+io.get('pwrR').toFixed(3); if(c.t==='gear') v=v+'|'+io.get('gearLights');  if(c.t==='flap') v=v+'|'+io.get('flapLights'); if(c.t==='abtn') v=v+'|'+io.get('audLed:'+id);
    if(cache[id]===v) continue; cache[id]=v; const m=g.querySelector('.mv'); const val=io.get(id);
    switch(c.t){
      case 'tog': case 'guard': setT(m,val?'scaleY(1)':'scaleY(-1)'); g.classList.toggle('on',!!val); if(c.t==='guard'){ setT(g.querySelector('.gd'),io.get('emerG')?'translateY(-28px) scaleY(.35)':'none'); g.setAttribute('aria-label',c.l+(io.get('emerG')?' (guard open)':' (guard closed)')); } g.setAttribute('aria-checked',val?'true':'false'); break;
      case 'tog3': g.setAttribute('aria-valuetext',val<0?'ON':val>0?'RESET':'ARM'); setT(m,val<0?'scaleY(1)':val>0?'scaleY(-1)':'scaleY(.25)'); break;
      case 'vent': setT(m,val?'rotate(35deg)':'none'); g.classList.toggle('on',!!val); g.setAttribute('aria-checked',val?'true':'false'); break;
      case 'stick': break;
      case 'sbtn': g.classList.toggle('on',!!val); break;
      case 'rocker': g.classList.toggle('on',!!val); g.setAttribute('aria-checked',val?'true':'false'); break;
      case 'rot': setT(m,`rotate(${-135+val*270}deg)`); g.setAttribute('aria-valuetext',Math.round(val*100)+' %'); break;
      case 'rotsel': setT(m,`rotate(${c.ang[val]}deg)`); g.setAttribute('aria-valuetext',c.vals[val]); break;
      case 'push': case 'abtn': g.classList.toggle('on',!!val); if(c.t==='abtn') g.classList.toggle('led',!!io.get('audLed:'+id)); break;
      case 'key': setT(m,`rotate(${val*40}deg)`); break;
      case 'gear': { setT(m,val?'translateY(60px)':'none'); const L=io.get('gearLights'); g.querySelectorAll('.gl').forEach(x=>x.classList.remove('g','r')); if(L==='down') ['gN','gL','gR'].forEach(k=>g.querySelector('.'+k).classList.add('g')); else if(L==='transit') g.querySelector('.gU').classList.add('r'); g.setAttribute('aria-checked',val?'true':'false'); g.setAttribute('aria-valuetext',val?'DOWN':'UP'); break; }
      case 'flap': { setT(m,`translateY(${val*30}px)`); const fl=io.get('flapLights'); g.querySelectorAll('.fl').forEach((x,i)=>x.classList.toggle(i?'a':'g',fl===i)); g.querySelectorAll('.fl').forEach((x,i)=>{ if(fl!==i) x.classList.remove('a','g'); }); g.setAttribute('aria-valuetext',['UP','APP','LDG'][val]); break; }
      case 'cb': g.classList.toggle('out',!val); g.setAttribute('aria-valuetext',val?'IN':'PULLED'); g.setAttribute('aria-pressed',val?'false':'true'); break;
      case 'pull': g.setAttribute('aria-valuetext',val?'OPEN':'CLOSED'); setT(m,c.lever?(val?'translateY(10px)':'none'):(val?'scale(1.18)':'none')); g.classList.toggle('on',!!val); break;
      case 'slide': setT(m,`translateY(${-(val-0.5)*44}px)`); break;
      case 'park': setT(m,val?'translateY(47px)':'none'); g.setAttribute('aria-valuetext',val?'SET':'RELEASED'); g.setAttribute('aria-pressed',val?'true':'false'); break;
      case 'power': { const a=io.get('pwrL'), b=io.get('pwrR'); setT(g.querySelector('.lv0'),`translateY(${(1-a)*92}px)`); setT(g.querySelector('.lv1'),`translateY(${(1-b)*92}px)`); g.setAttribute('aria-valuetext',`L ${Math.round(a*100)} %, R ${Math.round(b*100)} %`); break; }
      case 'vwheel': setT(m,`translateY(${(val*60)%6}px)`); setT(g.querySelector('.trind'),`translateY(${-val*50}px)`); g.setAttribute('aria-valuetext',Math.round(val*100)+''); break;
      case 'hwheel': setT(m,`translateX(${(val*60)%6}px)`); setT(g.querySelector('.trind'),`translateX(${val*44}px)`); break;
      case 'fsel': setT(m,`rotate(${[-80,0,80][val]}deg)`); g.querySelector('.fguard').classList.toggle('open',!!io.get(id+'G')||val===2); g.setAttribute('aria-valuetext',['ON','CROSSFEED','OFF'][val]); break;
    }
  }
}
function syncSticks(P,x,y){ ['stickL','stickR','apDisc','trimUp','trimDn'].forEach(id=>{ const o=P.byId[id]; if(!o) return; const m=o.g.querySelector('.skg')||o.g.querySelector('.sbm'); setT(m,`translate(${(x*22).toFixed(1)}px,${(y*16).toFixed(1)}px)`); }); }
/* standby instrument needles */
function syncStby(P,o,baro){
  const s=P.svg, c=P._sbq||(P._sbq={}); const q=k=>c[k]!==undefined?c[k]:(c[k]=s.querySelector(k));
  setT(q('.sbAsi'),`rotate(${asiAng(o.ias)}deg)`);
  setT(q('.sbAtt'),`rotate(${-o.roll}deg) translateY(${Math.max(-40,Math.min(40,o.pitch*1.6))}px)`);
  setT(q('.sbAlt0'),`rotate(${(o.alt%1000)/1000*360}deg)`); setT(q('.sbAlt1'),`rotate(${(o.alt%10000)/10000*360}deg)`);
  const t=q('.sbKol'); const b=String(Math.round(baro)); if(t.textContent!==b) t.textContent=b;
  const h=((o.hdg%360)+360)%360; setT(q('.sbCmp'),`translateX(${34-(h<180?h+360:h)*1.6+ (h<180?0:0)}px)`);
}
G.DA42P={fineWheel,ctrlWheel,ctlFrom:(P,t)=>ctlFromBy(P.byId,t),build,sync,syncStby,syncSticks,REG,REG_ORDER,W,H};
})(window);
