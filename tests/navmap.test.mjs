// Node tests for the pure parts of navmap.js (run: node tests/navmap.test.mjs): views, NM ↔ px transforms, fitting,
// easing, scale bar lengths, label placement and region geometry. Expected values are hand-computed.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','navcore.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','navmap.js'),'utf8'),ctx);
const M=ctx.NAVMAP, N=ctx.NAVCORE;
let pass=0, fail=0; const fails=[];
const near=(a,b,t)=>a===b||Math.abs(a-b)<=(t??1e-9);
function eq(name,got,exp,tol){ const ok= typeof exp==='number'? near(got,exp,tol) : got===exp; if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }

/* north up: x east → right, y north → up */
let v=M.view({cx:200,cy:100,k:10,ox:0,oy:0,rot:0}), p=M.toPx(v,3,2);
eq('north up: x',p.x,230); eq('north up: y (north is up)',p.y,80);
p=M.toPx(v,0,0); eq('origin at the centre x',p.x,200); eq('origin at the centre y',p.y,100);
v=M.view({cx:0,cy:0,k:2,ox:5,oy:-5,rot:0}); p=M.toPx(v,5,-5); eq('view origin → centre x',p.x,0); eq('view origin → centre y',p.y,0);
p=M.toPx(v,6,-5); eq('1 NM east = k px right',p.x,2);

/* heading up: rot = 90 (east up): a point 1 NM east is straight up, 1 NM north is to the left */
v=M.view({cx:100,cy:100,k:10,ox:0,oy:0,rot:90});
p=M.toPx(v,1,0); eq('east up: east → up x',p.x,100); eq('east up: east → up y',p.y,90);
p=M.toPx(v,0,1); eq('east up: north → left x',p.x,90); eq('east up: north → left y',p.y,100);
v=M.view({cx:0,cy:0,k:1,ox:0,oy:0,rot:180}); p=M.toPx(v,0,1); eq('south up: north → down',p.y,1);

/* round trip NM → px → NM at any rotation, zoom and centre */
for(const rot of [0,37,90,181.5,359]) for(const [x,y] of [[0,0],[3.2,-7.1],[-40,12]]){
  v=M.view({cx:217,cy:143,k:7.3,ox:1.5,oy:-2.25,rot}); const q=M.toPx(v,x,y), b=M.toNm(v,q.x,q.y);
  eq(`round trip rot ${rot} (${x},${y}) x`,b.x,x,1e-9); eq(`round trip rot ${rot} (${x},${y}) y`,b.y,y,1e-9); }
/* out parameters are reused, no allocation */
v=M.view({k:1}); const o={x:0,y:0}; eq('toPx writes to out',M.toPx(v,1,1,o),o); eq('toNm writes to out',M.toNm(v,1,1,o),o);
/* setView keeps cos/sin in step */
v=M.view(); M.setView(v,{rot:30}); eq('setView cos',v.c,Math.cos(Math.PI/6)); eq('setView sin',v.s,0.5);

/* screen angle: a true bearing drawn with canvas rotate */
v=M.view({rot:0}); eq('screen angle 090 north up',M.screenAngle(v,90),Math.PI/2);
v=M.view({rot:90}); eq('screen angle 090 heading up 090 = 0',M.screenAngle(v,90),0);

/* the map object's transform agrees with the pure one */
const m=M.create(null,{}); m.set({cx:50,cy:60,k:4,ox:1,oy:2,rot:45}); m.P(3,-1); p=M.toPx(m.v,3,-1);
eq('map.P x = toPx',m.sx,p.x); eq('map.P y = toPx',m.sy,p.y); const b=m.unP(m.sx,m.sy); eq('map.unP x',b.x,3,1e-9); eq('map.unP y',b.y,-1,1e-9);
eq('map.sa',m.sa(135),Math.PI/2);

/* fit: a 10 × 4 NM box in 300 × 200 px with margins 20 px; width decides */
let f=M.fit({x0:0,x1:10,y0:0,y1:4},300,200,{l:20,r:20,t:20,b:20});
eq('fit k (width bound)',f.k,26); eq('fit ox',f.ox,5); eq('fit oy',f.oy,2); eq('fit cx',f.cx,150); eq('fit cy',f.cy,100);
f=M.fit({x0:0,x1:10,y0:0,y1:4},300,200,{l:0,r:0,t:0,b:0},{pad:3}); eq('fit with NM pad: 3 NM each side (width bound)',f.k,300/16);
f=M.fit({x0:0,x1:0.1,y0:0,y1:0.1},300,200,{},{min:1,maxK:140}); eq('fit minimum span 1 NM',f.k,140); eq('fit k capped',M.fit({x0:0,x1:1,y0:0,y1:1},800,800,{},{maxK:140}).k,140);
f=M.fit({x0:-2,x1:2,y0:-1,y1:1},200,200,{t:40}); eq('fit top margin moves centre down',f.cy,120);
/* the fitted box lands inside the margins */
f=M.fit({x0:-3,x1:7,y0:2,y1:5},400,300,{l:60,r:72,t:18,b:28}); v=M.view(f); const c0=M.toPx(v,-3,5), c1=M.toPx(v,7,2);
eq('fitted left edge ≥ margin',c0.x>=60-1e-9,true); eq('fitted right edge ≤ W − margin',c1.x<=400-72+1e-9,true); eq('fitted top ≥ margin',c0.y>=18-1e-9,true); eq('fitted bottom ≤ H − margin',c1.y<=300-28+1e-9,true);

/* lerpView: zoom in log space, rotation the short way round */
const A=M.view({k:1,rot:350,ox:0,oy:0,cx:0,cy:0}), B=M.view({k:4,rot:10,ox:10,oy:-10,cx:100,cy:50});
let e=M.lerpView(A,B,0.5); eq('lerp k geometric mean',e.k,2); eq('lerp rot short way (350 → 10 via 0)',e.rot,0); eq('lerp ox',e.ox,5); eq('lerp cy',e.cy,25);
e=M.lerpView(A,B,0); eq('lerp at 0 = from',e.k,1); e=M.lerpView(A,B,1); eq('lerp at 1 = to k',e.k,4,1e-12); eq('lerp at 1 = to rot',e.rot,10,1e-9);

/* scale bar */
eq('nice scale k 13.8 → 5 NM',M.niceScale(13.8),5); eq('nice scale k 27.6 → 2 NM',M.niceScale(27.6),2); eq('nice scale k 120 → 0.5 NM',M.niceScale(120),0.5);
eq('nice scale k 1 → longest',M.niceScale(1),50); eq('nice scale min px 60',M.niceScale(25,60),5);

/* label placement: first offset (right and up) when free; next offset when blocked; none off the canvas */
const boxes=new Float32Array(40), out={x:0,y:0};
eq('label: free → placed',M.placeLabel(100,100,40,17,400,300,boxes,0,out),true); eq('label: right of the anchor',out.x,109); eq('label: above the anchor',out.y,100-9-8.5);
boxes.set([109,82.5,40,17]); eq('label: blocked → placed elsewhere',M.placeLabel(100,100,40,17,400,300,boxes,1,out),true); eq('label: second offset (right, below)',out.x,109); eq('label: second offset y',out.y,100+13-8.5);
eq('label: no room inside a tiny canvas',M.placeLabel(5,5,40,17,30,20,boxes,0,out),false);
eq('label: centred when asked',M.placeLabel(100,100,40,17,400,300,boxes,0,out,[[0,0]]),true); eq('label: centred x',out.x,80); eq('label: centred y',out.y,91.5);
boxes.set([0,0,400,300]); eq('label: everything reserved → skipped',M.placeLabel(100,100,40,17,400,300,boxes,1,out),false);

/* region geometry: same projection as NAVCORE, FLS at the origin, ILS 17 geometry */
const G=M.build('bergen',2.8), fls=G.ST.FLS;
eq('FLS at the origin x',fls.x,0); eq('FLS at the origin y',fls.y,0); eq('variation on stations',fls.var,2.8);
const voo=N.proj(60.5489,5.1288,60.3113,5.2122); eq('VOO projected x',G.ST.VOO.x,voo.x); eq('VOO projected y',G.ST.VOO.y,voo.y);
const I=G.ILS[0]; eq('ILS course',I.crs,174); eq('runway length thr → end',Math.hypot(I.end.x-I.thr.x,I.end.y-I.thr.y),1.614,1e-9);
eq('runway direction',N.bearing(I.end.x-I.thr.x,I.end.y-I.thr.y),174,1e-9); eq('LOC antenna 0.16 NM beyond the end',Math.hypot(I.x-I.end.x,I.y-I.end.y),0.16,1e-9);
eq('GP 0.16 NM in from the threshold',Math.hypot(I.gp.x-I.thr.x,I.gp.y-I.thr.y),0.16,1e-9);
eq('Bergen: 3 VOR, 2 NDB, 1 ILS',G.NAV.filter(n=>n.type==='VOR').length*100+G.NAV.filter(n=>n.type==='NDB').length*10+G.ILS.length,321);
const O=M.build('oslo'); eq('Oslo: GRM at the origin',Math.hypot(O.ST.GRM.x,O.ST.GRM.y),0); eq('Oslo: no ILS',O.ILS.length,0); eq('Oslo: variation default 0',O.ST.GRM.var,0);
eq('build gives fresh objects',M.build('bergen').ST.FLS!==M.build('bergen').ST.FLS,true);

console.log(`${pass} passed, ${fail} failed (${pass+fail} checks)`); if(fail){ console.log(fails.join('\n')); process.exit(1); }
