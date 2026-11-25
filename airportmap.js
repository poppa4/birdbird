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
const COL={grass:'#17221c',grass2:'#1a271f',apron:'#262d35',twy:'#2c333b',rwy:'#343a42',edge:'#5a6470',mark:'#e8edf2',yel:'#e2bd45',
  term:'#1d2733',termEdge:'#3b4a5a',lbl:'#a9b6c3',own:'#5aa9ff',ownEdge:'#cfe6ff',ai:'#c8d1da',aiEdge:'#8996a3',shadow:'rgba(0,0,0,.35)'};

let cv=null, ctx=null, raf=0, last=0, W=0, H=0, dpr=1, running=false;
let own=null, ai=[], cam={x:-190,y:300,s:1}, camT={x:-190,y:300,s:1}, phase='stand', waiters=[];

/* ---------- aircraft ---------- */
function plane(o){ return Object.assign({x:0,y:0,a:0,alt:0,path:null,pi:0,v:0,vmax:SPEED.taxi,back:false,label:'',own:false,done:true,onDone:null},o); }
function follow(p,pts,o){ o=o||{}; p.path=pts; p.pi=0; p.done=false; p.back=!!o.back; p.vmax=o.v||SPEED.taxi; p.onDone=o.onDone||null; p.endA=o.endA; }
function step(p,dt){
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
function reset(){
  waiters.forEach(w=>w.res()); waiters=[];
  own=plane({x:standX(4),y:STAND_Y,a:Math.PI/2,label:'FJORDAIR 412',own:true});
  ai=[plane({x:standX(2),y:STAND_Y,a:Math.PI/2,label:''}),plane({x:standX(6),y:STAND_Y,a:Math.PI/2,label:''}),plane({x:standX(8),y:STAND_Y,a:Math.PI/2,label:''})];
  phase='stand'; camT={x:standX(4)+40,y:280,s:fit(700)}; cam=Object.assign({},camT);
  if(!running) loop(); draw();
}
function fit(m){ return Math.max(0.12,Math.min(W/m,H/(m*0.42))); }
const sx=standX(4);
const ACTS={
  push(){ phase='push';
    follow(own,[{x:sx,y:STAND_Y-40},{x:sx+10,y:LANE+12},{x:sx+40,y:LANE}],{back:true,v:SPEED.push,endA:Math.PI});
    return wait(()=>own.done); },
  taxi(){ phase='taxi';
    follow(own,[{x:sx-60,y:LANE},{x:-520,y:LANE},{x:-560,y:LANE-35},{x:-590,y:TWY_A},{x:-1120,y:TWY_A},{x:-1180,y:TWY_A-25},{x:HOLD_A1.x,y:HOLD_A1.y+20},{x:HOLD_A1.x,y:HOLD_A1.y}],{v:SPEED.taxi});
    return Promise.resolve(); },
  hold(){ return wait(()=>own.done&&phase==='taxi'); },
  traffic(){ // an A320 on final lands on 36, vacates via Bravo and taxis to stand 7
    const t=plane({x:-5200,y:0,a:0,alt:1,label:'NORVIK 27'}); t.acc=14; ai.push(t);
    follow(t,[{x:-1000,y:0,v:68,alt:0},{x:-200,y:0,v:40},{x:240,y:0,v:12},{x:290,y:25},{x:300,y:90},{x:260,y:TWY_A},{x:120,y:TWY_A},{x:standX(7)+60,y:LANE},{x:standX(7)+10,y:LANE+20},{x:standX(7),y:STAND_Y}],{v:68});
    t.v=68; t.onDone=null; ACTS._t=t; return Promise.resolve(); },
  clear(){ const t=ACTS._t; return t? wait(()=>t.pi>=6||t.done) : Promise.resolve(); },
  lineup(){ phase='lineup';
    follow(own,[{x:HOLD_A1.x,y:30},{x:HOLD_A1.x+20,y:4},{x:HOLD_A1.x+50,y:0}],{v:7,endA:0});
    return wait(()=>own.done); },
  takeoff(){ phase='takeoff'; own.acc=3.2;
    follow(own,[{x:250,y:0,v:78},{x:1250,y:0,v:82,alt:0.5},{x:4200,y:0,v:90,alt:1}],{v:78});
    return wait(()=>own.x>1600); }
};
function wait(cond){ return new Promise(res=>{ if(cond()) return res(); waiters.push({cond,res}); }); }
function act(name){ const f=ACTS[name]; return f? f() : Promise.resolve(); }

/* ---------- camera ---------- */
function camera(dt){
  if(phase==='stand') camT={x:sx+40,y:290,s:fit(620)};
  else if(phase==='push') camT={x:own.x+30,y:300,s:fit(560)};
  else if(phase==='taxi') camT={x:own.x-120,y:Math.min(260,own.y+40),s:fit(1150)};
  else camT={x:Math.min(own.x+350,600),y:120,s:fit(2000)};
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
  path([[RWY.x0+50,TWY_A],[620,TWY_A]]); path([[-1200,TWY_A],[-1200,0]]); path([[300,0],[300,90],[260,TWY_A]]); path([[-590,TWY_A],[-560,LANE-35],[-520,LANE]]);
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
  path([[RWY.x0+50,TWY_A],[620,TWY_A]]); path([[-1200,TWY_A],[-1200,HOLD_A1.y-6]]); path([[300,0],[300,90],[260,TWY_A]]); path([[-590,TWY_A],[-560,LANE-35],[-520,LANE],[260,LANE]]);
  for(let k=1;k<=8;k++) path([[standX(k),LANE],[standX(k),STAND_Y+30]]);
  // A1 holding point: two solid and two dashed yellow lines across the taxiway
  ctx.fillStyle=COL.yel; for(let i=0;i<2;i++) ctx.fillRect(-1212,HOLD_A1.y-4+i*1.6,24,0.7);
  for(let i=0;i<2;i++) for(let xx=-1212;xx<-1188;xx+=4) ctx.fillRect(xx,HOLD_A1.y-0.6+i*1.6,2.4,0.7);
  // labels (screen-size text)
  lbl('A',-900,TWY_A-16); lbl('A',350,TWY_A-16); lbl('A1',-1228,HOLD_A1.y+6,'end'); lbl('B',318,70,'start');
  for(let k=1;k<=8;k++) lbl(String(k),standX(k),STAND_Y+48);
  lbl('Terminal',-170,STAND_Y+102,'center',COL.lbl,13);
  // aircraft: ground first, then airborne on top
  ai.concat([own]).filter(Boolean).sort((p,q)=>p.alt-q.alt).forEach(drawPlane);
  // north arrow and scale
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.fillStyle=COL.lbl; ctx.font='600 11px system-ui,sans-serif'; ctx.textAlign='right'; ctx.fillText('N →',W-12,18);
  ctx.textAlign='left'; ctx.fillText('NORDAP · training layout',12,H-10);
}
function path(pts){ ctx.beginPath(); pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.stroke(); }
function num(t,x,y,rot){ ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.fillStyle=COL.mark; ctx.font='700 18px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(t,0,0); ctx.restore(); }
function lbl(t,x,y,al,col,fs){ ctx.save(); ctx.translate(x,y); ctx.scale(1/cam.s,1/cam.s); ctx.fillStyle=col||COL.lbl; ctx.font=`600 ${fs||12}px system-ui,sans-serif`; ctx.textAlign=al||'center'; ctx.textBaseline='middle'; ctx.fillText(t,0,0); ctx.restore(); }
/* A320 seen from above, nose along +x, 37.6 m long, 35.8 m span */
const SHAPE=[[18.8,0],[17.6,1.5],[15,2],[3.5,2],[-4.5,17.9],[-7.5,17.9],[-5,2],[-13.5,2],[-17,6.3],[-18.6,6.3],[-17.2,1.2],[-18.8,0.4],[-18.8,-0.4],[-17.2,-1.2],[-18.6,-6.3],[-17,-6.3],[-13.5,-2],[-5,-2],[-7.5,-17.9],[-4.5,-17.9],[3.5,-2],[15,-2],[17.6,-1.5]];
function drawPlane(p){
  const sc=1+p.alt*1.4, minPx=p.own?22:16, k=Math.max(sc,minPx/(37.6*cam.s));
  if(p.alt>0){ ctx.save(); ctx.translate(p.x+p.alt*40,p.y+p.alt*40); ctx.rotate(p.a); ctx.scale(k,k); poly(SHAPE); ctx.fillStyle=COL.shadow; ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a); ctx.scale(k,k);
  poly(SHAPE); ctx.fillStyle=p.own?COL.own:COL.ai; ctx.fill(); ctx.lineWidth=0.6; ctx.strokeStyle=p.own?COL.ownEdge:COL.aiEdge; ctx.stroke();
  ctx.fillStyle=p.own?'#2f6fb8':'#7d8996'; [[1,5.7],[1,-5.7]].forEach(([x,y])=>{ ctx.fillRect(x-1.5,y-0.9,4.2,1.8); });
  ctx.restore();
  if(p.label&&p.alt<0.95){ ctx.save(); ctx.translate(p.x,p.y); ctx.scale(1/cam.s,1/cam.s); const t=p.label; ctx.font=`700 ${p.own?12:11}px system-ui,sans-serif`;
    const w=ctx.measureText(t).width+10; ctx.fillStyle='rgba(10,16,23,.82)'; ctx.fillRect(14,-26,w,17); ctx.fillStyle=p.own?COL.ownEdge:COL.lbl; ctx.textBaseline='middle'; ctx.fillText(t,19,-17.5); ctx.restore(); }
}
function poly(pts){ ctx.beginPath(); pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath(); }

/* ---------- loop ---------- */
function loop(){ running=true; last=performance.now();
  const f=t=>{ if(!running) return; const dt=Math.min(0.05,(t-last)/1000)*TIME; last=t;
    if(own) step(own,dt); ai.forEach(p=>step(p,dt)); if(own) camera(dt/TIME);
    waiters=waiters.filter(w=>{ if(w.cond()){ w.res(); return false; } return true; });
    draw(); raf=requestAnimationFrame(f); };
  raf=requestAnimationFrame(f); }
let TIME=3;   // taxiing at real speed takes minutes; the map runs three times faster
function stop(){ running=false; cancelAnimationFrame(raf); waiters.forEach(w=>w.res()); waiters=[]; }
function init(c){ cv=c; ctx=c.getContext('2d'); size(); if(G.ResizeObserver) new ResizeObserver(()=>{ if(!running) draw(); }).observe(c); }

G.NMAP={init,reset,act,stop,get own(){ return own; },get phase(){ return phase; },set speed(v){ TIME=v; }};
})(typeof window!=='undefined'?window:globalThis);
