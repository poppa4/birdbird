/* NORDAP live airport – a top-down map of the fictional NORDAP aerodrome for the radio trainer.
   Your aircraft moves when the radio calls say it can: pushback, taxi via Alpha to A1, line-up, take-off.
   Other traffic lands and taxis in on its own. TRAINING DATA: the layout is fictional and not for navigation.
   World frame in metres, drawn with north to the right: runway 36 points along +x.
   API: NMAP.init(canvas) · .reset() · .act(name) -> Promise (resolves when that movement is done) · .stop() */
(function(G){
'use strict';
const RWY={x0:-1250,x1:1250,w:45}, TWY_A=180, LANE=275, HOLD_A1={x:-1200,y:78};
const STAND_Y=372, standX=k=>-460+90*(k-1);
const SPEED={push:6,taxi:16,taxiTurn:9};
/* from taxiway Alpha through the apron connector to stand k, nose in */
const IN=k=>[{x:200,y:TWY_A+25},{x:200,y:LANE-25},{x:175,y:LANE},{x:standX(k)+35,y:LANE},{x:standX(k)+4,y:LANE+28},{x:standX(k),y:STAND_Y}];
const COL={grass:'#17221c',grass2:'#1a271f',apron:'#262d35',twy:'#2c333b',rwy:'#343a42',edge:'#5a6470',mark:'#e8edf2',yel:'#e2bd45',
  term:'#1d2733',termEdge:'#3b4a5a',lbl:'#a9b6c3',own:'#5aa9ff',ownEdge:'#cfe6ff',ai:'#c8d1da',aiEdge:'#8996a3',shadow:'rgba(0,0,0,.35)'};

let cv=null, ctx=null, raf=0, last=0, W=0, H=0, dpr=1, running=false;
let CLK=0, own=null, ai=[], cam={x:-190,y:300,s:1}, camT={x:-190,y:300,s:1}, phase='stand', waiters=[];

/* ---------- aircraft ---------- */
function plane(o){ return Object.assign({x:0,y:0,a:0,alt:0,path:null,pi:0,v:0,vmax:SPEED.taxi,back:false,label:'',own:false,done:true,onDone:null},o); }
function follow(p,pts,o){ o=o||{}; p.path=pts; p.pi=0; p.done=false; p.back=!!o.back; p.vmax=o.v||SPEED.taxi; p.onDone=o.onDone||null; p.endA=o.endA; }
function step(p,dt){
  if(p.delay>0){ p.delay-=dt; return; }
  if(p.done||!p.path) return;
  const tgt=p.path[p.pi]; const dx=tgt.x-p.x, dy=tgt.y-p.y, d=Math.hypot(dx,dy);
  // slow down for turns and for the end of the path
  const next=p.path[p.pi+1]; let vt=p.vmax;
  if(!next&&d<60) vt=Math.max(1.5,p.vmax*d/60);
  else if(next){ const t1=Math.atan2(dy,dx), t2=Math.atan2(next.y-tgt.y,next.x-tgt.x); const turn=Math.abs(norm(t2-t1)); if(turn>0.5&&d<50) vt=Math.min(vt,SPEED.taxiTurn); }
  if(tgt.v!==undefined) vt=tgt.v;
  p.v+= Math.sign(vt-p.v)*Math.min(Math.abs(vt-p.v),(p.acc||4)*dt);
  const mv=p.v*dt;
  if(d<=mv||d<0.3){ p.x=tgt.x; p.y=tgt.y; if(tgt.alt!==undefined) p.alt=tgt.alt; p.pi++;
    if(p.pi>=p.path.length){ p.done=true; p.v=0; if(p.endA!==undefined) p.a=p.endA; const f=p.onDone; p.onDone=null; if(f) f(); } return; }
  p.x+=dx/d*mv; p.y+=dy/d*mv;
  if(tgt.alt!==undefined){ const a0=p.alt; p.alt=a0+(tgt.alt-a0)*Math.min(1,mv/d); }
  const want=Math.atan2(dy,dx)+(p.back?Math.PI:0);
  p.a+=norm(want-p.a)*Math.min(1,dt*(p.back?1.6:3.2));
}
const norm=a=>{ while(a>Math.PI) a-=2*Math.PI; while(a<-Math.PI) a+=2*Math.PI; return a; };

/* ---------- scenario ---------- */
let MODE='dep', DEP={rwy:'36',stand:4,luv:'cond',tcs:'NORVIK 27'}, ARR={stand:6,tcs:'KYSTFLY 303'}, sx=standX(4), N18=false;
const HOLD_D1={x:1200,y:78};
function reset(mode,dep,arr){
  waiters.forEach(w=>w.res()); waiters=[]; MODE=mode==='arr'?'arr':'dep'; ACTS._t=null; ACTS._d=null;
  DEP=Object.assign({rwy:'36',stand:4,luv:'cond',tcs:'NORVIK 27'},dep||{}); ARR=Object.assign({stand:6,tcs:'KYSTFLY 303'},arr||{});
  const parked=k=>plane({x:standX(k),y:STAND_Y,a:Math.PI/2,label:''});
  if(MODE==='dep'){ N18=DEP.rwy==='18'; sx=standX(DEP.stand);
    own=plane({x:sx,y:STAND_Y,a:Math.PI/2,label:'FJORDAIR 412',own:true});
    ai=[2,6,8,[3,4,5].find(k=>k!==DEP.stand&&k!==(DEP.stand===4?3:4))].map(parked); phase='stand'; }
  else { N18=false; own=plane({x:-9000,y:0,a:0,alt:1,label:'FJORDAIR 412',own:true,hidden:true});
    ai=[2,4,8].filter(k=>k!==ARR.stand).map(parked);
    // a departure lined up on 36: it goes when you are on final, so the runway is free for you
    const d=plane({x:-1150,y:0,a:0,label:ARR.tcs}); ai.push(d); ACTS._d=d; phase='inbound'; }
  camera(10); cam=Object.assign({},camT);
  if(!running) loop(); draw();
}
function fit(m){ return Math.max(0.12,Math.min(W/m,H/(m*0.42))); }
/* from the west end of the apron lane to stand k, nose in */
const IN_W=k=>[{x:-590,y:TWY_A},{x:-560,y:LANE-35},{x:-520,y:LANE},{x:standX(k)-35,y:LANE},{x:standX(k)-4,y:LANE+28},{x:standX(k),y:STAND_Y}];
const ACTS={
  push(){ phase='push'; const d=N18?-1:1;   // facing south (36) or north (18): the tail goes the other way
    follow(own,[{x:sx,y:STAND_Y-40},{x:sx+10*d,y:LANE+12},{x:sx+40*d,y:LANE}],{back:true,v:SPEED.push,endA:N18?0:Math.PI});
    return wait(()=>own.done); },
  taxi(){ phase='taxi';
    if(!N18) follow(own,[{x:sx-60,y:LANE},{x:-520,y:LANE},{x:-560,y:LANE-35},{x:-590,y:TWY_A},{x:-1120,y:TWY_A},{x:-1180,y:TWY_A-25},{x:HOLD_A1.x,y:HOLD_A1.y+20},{x:HOLD_A1.x,y:HOLD_A1.y}],{v:SPEED.taxi});
    else follow(own,[{x:sx+60,y:LANE},{x:175,y:LANE},{x:200,y:LANE-25},{x:200,y:TWY_A+25},{x:225,y:TWY_A},{x:1120,y:TWY_A},{x:1180,y:TWY_A-25},{x:HOLD_D1.x,y:HOLD_D1.y+20},{x:HOLD_D1.x,y:HOLD_D1.y}],{v:SPEED.taxi});
    return Promise.resolve(); },
  hold(){ return wait(()=>own.done&&phase==='taxi'); },
  traffic(){ // landing traffic about 2 NM out when you reach the holding point; it vacates and taxis to a stand
    let t;
    if(!N18){ t=plane({x:-4600,y:0,a:0,alt:0.55,label:DEP.tcs});
      follow(t,[{x:-1000,y:0,v:55,alt:0},{x:-200,y:0,v:38},{x:240,y:0,v:12},{x:290,y:25},{x:300,y:90},{x:250,y:TWY_A},{x:215,y:TWY_A+8}].concat(IN(7)),{v:55}); }
    else { t=plane({x:4600,y:0,a:Math.PI,alt:0.55,label:DEP.tcs});
      follow(t,[{x:1000,y:0,v:55,alt:0},{x:200,y:0,v:38},{x:-240,y:0,v:12},{x:-290,y:25},{x:-300,y:90},{x:-340,y:TWY_A},{x:-560,y:TWY_A}].concat(IN_W(1)),{v:55}); }
    t.acc=12; t.v=55; ai.push(t); ACTS._t=t; return Promise.resolve(); },
  clear(){ const t=ACTS._t; return t? wait(()=>t.y>40||t.done) : Promise.resolve(); },
  /* arrival */
  final(){ phase='final'; own.hidden=false; Object.assign(own,{x:-6200,y:0,a:0,alt:0.75}); own.acc=6;
    follow(own,[{x:-1080,y:0,v:70,alt:0},{x:-1000,y:0,v:68,alt:0}],{v:70}); own.v=70;
    const d=ACTS._d; if(d){ d.acc=3.2; follow(d,[{x:-200,y:0,v:75},{x:900,y:0,v:82,alt:0.5},{x:4200,y:0,v:90,alt:1}],{v:75}); d.delay=1.5; }
    return Promise.resolve(); },
  land(){ return wait(()=>own.done).then(()=>{ phase='landing'; own.acc=5; follow(own,[{x:-200,y:0,v:38},{x:230,y:0,v:11}],{v:62}); return wait(()=>own.done); }); },
  vacate(){ phase='taxiin'; follow(own,[{x:290,y:25},{x:300,y:90},{x:255,y:TWY_A},{x:225,y:TWY_A}],{v:SPEED.taxiTurn}); return wait(()=>own.done); },
  taxiin(){ follow(own,[{x:210,y:TWY_A+10}].concat(IN(ARR.stand)),{v:SPEED.taxi}); return wait(()=>own.done).then(()=>{ phase='parked'; }); },
  lineup(){ phase='lineup';
    if(!N18) follow(own,[{x:HOLD_A1.x,y:30},{x:HOLD_A1.x+20,y:4},{x:HOLD_A1.x+50,y:0}],{v:7,endA:0});
    else follow(own,[{x:HOLD_D1.x,y:30},{x:HOLD_D1.x-20,y:4},{x:HOLD_D1.x-50,y:0}],{v:7,endA:Math.PI});
    return wait(()=>own.done); },
  takeoff(){ phase='takeoff'; own.acc=3.2; const d=N18?-1:1;
    follow(own,[{x:250*d,y:0,v:78},{x:1250*d,y:0,v:82,alt:0.5},{x:4200*d,y:0,v:90,alt:1}],{v:78});
    return wait(()=>own.x*d>1600); }
};
function wait(cond){ return new Promise(res=>{ if(cond()) return res(); waiters.push({cond,res}); }); }
function act(name){ const f=ACTS[name]; return f? f() : Promise.resolve(); }

/* ---------- camera ---------- */
function camera(dt){
  if(phase==='inbound') camT={x:0,y:170,s:fit(2700)};
  else if(phase==='final'){ const span=Math.max(1900,(-700-own.x)*1.3); camT={x:(own.x-700)/2,y:90,s:fit(span)}; }
  else if(phase==='landing') camT={x:own.x+150,y:70,s:fit(1500)};
  else if(phase==='taxiin') camT={x:own.x-60,y:own.y+70,s:fit(950)};
  else if(phase==='parked') camT={x:standX(ARR.stand),y:300,s:fit(620)};
  else if(phase==='stand') camT={x:sx+40,y:290,s:fit(620)};
  else if(phase==='push') camT={x:own.x+(N18?-30:30),y:300,s:fit(560)};
  else if(phase==='taxi') camT={x:own.x+(N18?120:-120),y:Math.min(260,own.y+40),s:fit(1150)};
  else camT={x:N18?Math.max(own.x-350,-600):Math.min(own.x+350,600),y:120,s:fit(2000)};
  const k=Math.min(1,dt*1.6); cam.x+=(camT.x-cam.x)*k; cam.y+=(camT.y-cam.y)*k; cam.s+=(camT.s-cam.s)*k;
}

/* ---------- drawing ---------- */
function size(){ const r=cv.getBoundingClientRect(); dpr=Math.min(2,G.devicePixelRatio||1); W=Math.max(1,r.width); H=Math.max(1,r.height);
  const pw=Math.round(W*dpr), ph=Math.round(H*dpr); if(cv.width!==pw||cv.height!==ph){ cv.width=pw; cv.height=ph; } }
function tf(){ ctx.setTransform(dpr*cam.s,0,0,dpr*cam.s,dpr*(W/2-cam.x*cam.s),dpr*(H/2-cam.y*cam.s)); }
function draw(){
  if(!ctx) return; size();
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.fillStyle=COL.grass; ctx.fillRect(0,0,W,H);
  tf(); const s=cam.s, px=1/s;
  // apron, terminal
  ctx.fillStyle=COL.apron; ctx.fillRect(-640,TWY_A+30,940,STAND_Y+60-(TWY_A+30));
  ctx.fillStyle=COL.term; ctx.strokeStyle=COL.termEdge; ctx.lineWidth=1.5*px; ctx.fillRect(-560,STAND_Y+60,780,70); ctx.strokeRect(-560,STAND_Y+60,780,70);
  // taxiways
  ctx.strokeStyle=COL.twy; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=23;
  path([[RWY.x0+50,TWY_A],[1200,TWY_A]]); path([[-1200,TWY_A],[-1200,0]]); path([[1200,TWY_A],[1200,0]]); path([[-240,0],[-290,25],[-300,90],[-340,TWY_A]]); path([[300,0],[300,90],[260,TWY_A]]); path([[-590,TWY_A],[-560,LANE-35],[-520,LANE]]); path([[200,TWY_A],[200,LANE]]);
  // runway
  ctx.fillStyle=COL.rwy; ctx.fillRect(RWY.x0,-RWY.w/2,RWY.x1-RWY.x0,RWY.w);
  ctx.strokeStyle=COL.edge; ctx.lineWidth=1.2*px; ctx.strokeRect(RWY.x0,-RWY.w/2,RWY.x1-RWY.x0,RWY.w);
  ctx.fillStyle=COL.mark;
  for(let x=RWY.x0+120;x<RWY.x1-120;x+=50) ctx.fillRect(x,-0.45,30,0.9);                   // centre line
  for(const [x0,dir] of [[RWY.x0+6,1],[RWY.x1-6,-1]]) for(let k=0;k<8;k++){ const yy=-RWY.w/2+3+k*5.3+(k>3?3:0); ctx.fillRect(dir>0?x0:x0-30,yy,30,1.8); } // threshold
  for(const [x,dir] of [[RWY.x0+300,1],[RWY.x1-300,-1]]){ ctx.fillRect(dir>0?x:x-45,-RWY.w/2+6,45,4); ctx.fillRect(dir>0?x:x-45,RWY.w/2-10,45,4); } // aiming points
  num('36',RWY.x0+58,0,-Math.PI/2); num('18',RWY.x1-58,0,Math.PI/2);
  // taxiway centre lines
  ctx.strokeStyle=COL.yel; ctx.lineWidth=Math.max(0.8,1.2*px);
  path([[RWY.x0+50,TWY_A],[1200,TWY_A]]); path([[-1200,TWY_A],[-1200,HOLD_A1.y-6]]); path([[1200,TWY_A],[1200,HOLD_D1.y-6]]); path([[-240,0],[-290,25],[-300,90],[-340,TWY_A]]); path([[300,0],[300,90],[260,TWY_A]]); path([[-590,TWY_A],[-560,LANE-35],[-520,LANE],[260,LANE]]); path([[200,TWY_A],[200,LANE]]);
  for(let k=1;k<=8;k++) path([[standX(k),LANE],[standX(k),STAND_Y+30]]);
  // A1 holding point: two solid and two dashed yellow lines across the taxiway
  ctx.fillStyle=COL.yel; for(let i=0;i<2;i++) ctx.fillRect(-1212,HOLD_A1.y-4+i*1.6,24,0.7);
  for(let i=0;i<2;i++) for(let xx=-1212;xx<-1188;xx+=4) ctx.fillRect(xx,HOLD_A1.y-0.6+i*1.6,2.4,0.7);
  for(let i=0;i<2;i++) ctx.fillRect(1188,HOLD_D1.y-4+i*1.6,24,0.7);
  for(let i=0;i<2;i++) for(let xx=1188;xx<1212;xx+=4) ctx.fillRect(xx,HOLD_D1.y-0.6+i*1.6,2.4,0.7);
  // labels (screen-size text)
  lbl('A',-900,TWY_A-16); lbl('A',350,TWY_A-16); lbl('A1',-1228,HOLD_A1.y+6,'end'); lbl('B',318,70,'start'); lbl('D1',1228,HOLD_D1.y+6,'start'); lbl('C',-318,70,'end');
  for(let k=1;k<=8;k++) lbl(String(k),standX(k),STAND_Y+48);
  lbl('Terminal',-170,STAND_Y+102,'center',COL.lbl,13);
  // runway edge lights (white), threshold (green) and runway end (red); blue taxiway edge lights along Alpha
  const dot=(x,y,c,r)=>{ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,r*px,0,7); ctx.fill(); };
  if(cam.s>0.18){ for(let x=RWY.x0;x<=RWY.x1;x+=60){ dot(x,-RWY.w/2-1,'rgba(255,244,214,.85)',1.3); dot(x,RWY.w/2+1,'rgba(255,244,214,.85)',1.3); }
    for(let y=-RWY.w/2;y<=RWY.w/2;y+=7){ dot(RWY.x0-2,y,'#3ddc84',1.5); dot(RWY.x1+2,y,'#3ddc84',1.5); }
    for(let x=RWY.x0+60;x<1200;x+=60){ dot(x,TWY_A-13,'rgba(90,150,255,.8)',1.1); dot(x,TWY_A+13,'rgba(90,150,255,.8)',1.1); } }
  // the cleared taxi route ahead of you
  if(own&&own.path&&!own.done&&/^(taxi|taxiin|push)$/.test(phase)){ ctx.save(); ctx.strokeStyle='rgba(120,200,255,.9)'; ctx.lineWidth=2.2*px; ctx.setLineDash([8*px,6*px]); ctx.lineDashOffset=-CLK*30*px;
    ctx.beginPath(); ctx.moveTo(own.x,own.y); for(let i=own.pi;i<own.path.length;i++) ctx.lineTo(own.path[i].x,own.path[i].y); ctx.stroke();
    const e=own.path[own.path.length-1]; ctx.setLineDash([]); ctx.fillStyle='rgba(120,200,255,.95)'; ctx.beginPath(); ctx.arc(e.x,e.y,4*px,0,7); ctx.fill(); ctx.restore(); }
  // aircraft: ground first, then airborne on top
  ai.concat([own]).filter(p=>p&&!p.hidden).sort((p,q)=>p.alt-q.alt).forEach(drawPlane);
  // north arrow and scale
  ctx.setTransform(dpr,0,0,dpr,0,0);
  // compass: north points right on this map (runway 36 runs left to right)
  ctx.fillStyle='rgba(10,16,23,.72)'; ctx.fillRect(W-118,8,110,24); ctx.fillStyle=COL.mark; ctx.font='700 12px system-ui,sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText('N',W-110,20); ctx.strokeStyle=COL.mark; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(W-96,20); ctx.lineTo(W-66,20); ctx.lineTo(W-72,15); ctx.moveTo(W-66,20); ctx.lineTo(W-72,25); ctx.stroke();
  ctx.font='600 11px system-ui,sans-serif'; ctx.fillStyle=COL.lbl; ctx.fillText('north',W-58,20);
  ctx.textBaseline='alphabetic'; ctx.textAlign='left'; ctx.fillStyle='rgba(169,182,195,.75)'; ctx.font='600 10.5px system-ui,sans-serif'; ctx.fillText('NORDAP · training layout',10,18);
  if(own&&own.hidden){ ctx.textAlign='right'; ctx.fillStyle=COL.ownEdge; ctx.font='600 11px system-ui,sans-serif'; ctx.fillText('FJORDAIR 412 inbound from the south',W-12,H-12); }
}
function path(pts){ ctx.beginPath(); pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.stroke(); }
function num(t,x,y,rot){ ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.fillStyle=COL.mark; ctx.font='700 18px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(t,0,0); ctx.restore(); }
function lbl(t,x,y,al,col,fs){ ctx.save(); ctx.translate(x,y); ctx.scale(1/cam.s,1/cam.s); ctx.fillStyle=col||COL.lbl; ctx.font=`600 ${fs||12}px system-ui,sans-serif`; ctx.textAlign=al||'center'; ctx.textBaseline='middle'; ctx.fillText(t,0,0); ctx.restore(); }
/* A320 seen from above, nose along +x, 37.6 m long, 35.8 m span */
const SHAPE=[[18.8,0],[17.6,1.5],[15,2],[3.5,2],[-4.5,17.9],[-7.5,17.9],[-5,2],[-13.5,2],[-17,6.3],[-18.6,6.3],[-17.2,1.2],[-18.8,0.4],[-18.8,-0.4],[-17.2,-1.2],[-18.6,-6.3],[-17,-6.3],[-13.5,-2],[-5,-2],[-7.5,-17.9],[-4.5,-17.9],[3.5,-2],[15,-2],[17.6,-1.5]];
function drawPlane(p){
  const sc=1+p.alt*1.4, minPx=p.own?34:24, k=Math.max(sc,minPx/(37.6*cam.s));
  if(p.own&&p.alt<0.9){ const pr=(CLK*0.8)%1; ctx.save(); ctx.translate(p.x,p.y); ctx.strokeStyle=`rgba(90,169,255,${0.55*(1-pr)})`; ctx.lineWidth=2/cam.s; ctx.beginPath(); ctx.arc(0,0,(22+pr*18)*k,0,7); ctx.stroke(); ctx.restore(); }
  if(p.alt>0){ ctx.save(); ctx.translate(p.x+p.alt*40,p.y+p.alt*40); ctx.rotate(p.a); ctx.scale(k,k); poly(SHAPE); ctx.fillStyle=COL.shadow; ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a); ctx.scale(k,k);
  poly(SHAPE); ctx.fillStyle=p.own?COL.own:COL.ai; ctx.fill(); ctx.lineWidth=0.6; ctx.strokeStyle=p.own?COL.ownEdge:COL.aiEdge; ctx.stroke();
  ctx.fillStyle=p.own?'#2f6fb8':'#7d8996'; [[1,5.7],[1,-5.7]].forEach(([x,y])=>{ ctx.fillRect(x-1.5,y-0.9,4.2,1.8); });
  // navigation lights: red left wing, green right wing, white tail; red beacon when engines run; white strobes on the runway
  const L1=r=>r/k/cam.s, glow=(x,y,c,r)=>{ ctx.fillStyle=c; ctx.globalAlpha=0.28; ctx.beginPath(); ctx.arc(x,y,L1(r*2.6),0,7); ctx.fill(); ctx.globalAlpha=1; ctx.beginPath(); ctx.arc(x,y,L1(r),0,7); ctx.fill(); };
  glow(-6.5,-17.6,'#ff4a4a',1.6); glow(-6.5,17.6,'#3dff8a',1.6); glow(-18.6,0,'#ffffff',1.2);
  const moving=p.v>0.5||(p.own&&phase!=='stand'&&phase!=='parked'); if(moving&&(CLK*1.1)%1<0.18) glow(0,0,'#ff3030',2.2);
  if(Math.abs(p.y)<30&&(p.v>3||p.alt>0)&&(CLK*1.4)%1<0.08){ glow(-6.5,-17.6,'#ffffff',2.6); glow(-6.5,17.6,'#ffffff',2.6); }
  ctx.restore();
  if(p.label&&p.alt<0.95){ ctx.save(); ctx.translate(p.x,p.y); ctx.scale(1/cam.s,1/cam.s); const t=p.label; ctx.font=`700 ${p.own?12:11}px system-ui,sans-serif`;
    const w=ctx.measureText(t).width+10; ctx.fillStyle='rgba(10,16,23,.82)'; ctx.fillRect(14,-26,w,17); ctx.fillStyle=p.own?COL.ownEdge:COL.lbl; ctx.textBaseline='middle'; ctx.fillText(t,19,-17.5); ctx.restore(); }
}
function poly(pts){ ctx.beginPath(); pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath(); }

/* ---------- loop ---------- */
function loop(){ running=true; last=performance.now();
  const f=t=>{ if(!running) return; const dt=Math.min(0.05,(t-last)/1000)*TIME; last=t;
    CLK+=dt/TIME; if(own) step(own,dt); ai.forEach(p=>step(p,dt)); if(own) camera(dt/TIME);
    waiters=waiters.filter(w=>{ if(w.cond()){ w.res(); return false; } return true; });
    draw(); raf=requestAnimationFrame(f); };
  raf=requestAnimationFrame(f); }
let TIME=3;   // taxiing at real speed takes minutes; the map runs three times faster
function stop(){ running=false; cancelAnimationFrame(raf); waiters.forEach(w=>w.res()); waiters=[]; }
function init(c){ cv=c; ctx=c.getContext('2d'); size(); if(G.ResizeObserver) new ResizeObserver(()=>{ if(!running) draw(); }).observe(c); }

G.NMAP={init,reset,act,stop,get own(){ return own; },get phase(){ return phase; },set speed(v){ TIME=v; }};
})(typeof window!=='undefined'?window:globalThis);
