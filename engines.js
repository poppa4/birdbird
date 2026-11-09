/* Birdbird – engines.js: the Engines lab (engines.html).
   One dark figure with four modes: How it works (a cutaway of the chosen engine with the gas path coloured by temperature,
   turning spools and the right cockpit gauges), Compare (all four engine types at the same height and speed),
   Start the engine (start sequences with hot, hung and wet starts) and, in Deep dive, Ratings and limits (flat rating, FLEX,
   thrust lapse with speed). All physics in enginecore.js (ENGC): scaled representative models of generic engine types. */
(function(){
'use strict';
const {L,el,nf}=LAB, E=ENGC, t2=(en,no)=>({en,no});
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const MONO='"IBM Plex Mono", ui-monospace, monospace', SANS='"Public Sans", system-ui, sans-serif';
const C={txt:'#EEF2F5',mut:'#8E99A4',dim:'#5E6D7C',red:'#EC5A47',ok:'#71CC93',amb:'#F0C470',lp:'#C9B6F2',hp:'#7FCBE8',grid:'rgba(200,215,225,.10)',
  casing:'#27323c',edge:'rgba(214,226,236,.30)',metal:'#9AA6B1'};
const TC={pist:'#8EDDB0',tp:'#7FCBE8',jet:'#F09A3E',fan:'#C9B6F2'};
const TYPES=['pist','tp','jet','fan'];
const TN={pist:t2('Piston','Stempel'),tp:t2('Turboprop','Turboprop'),jet:t2('Turbojet','Turbojet'),fan:t2('Turbofan','Turbofan')};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const depth=()=>document.body.classList.contains('depth-short')?'short':document.body.classList.contains('depth-instructor')?'instructor':'deep';
const deepOn=()=>depth()!=='short';
const sg=v=>(v>0?'+':v<0?'−':'±')+nf(Math.abs(v),0);

/* ---------------- state ---------------- */
const S={mode:'how',type:'tp',thr:0.75,pl:0.7,tl:0.8,rpm:2400,np:1900,mix:1,cond:'lo',alt:0,dT:0,tas:0,turbo:false,heat:false,ice:false,stn:false,lay:'rev',flexT:45,fault:'none',st:null,hist:[]};
function model(type){ type=type||S.type; const c={alt:S.alt,dT:S.dT,tas:S.tas};
  if(type==='pist') return E.piston(Object.assign(c,{thr:S.thr,rpm:S.rpm,mix:S.mix,turbo:S.turbo,heat:S.heat,ice:S.ice}));
  if(type==='tp') return E.tprop(Object.assign(c,{pl:S.pl,np:S.np<1550?0:S.np,cond:S.cond}));
  return E.jet(Object.assign(c,{tl:S.tl}),type); }
const atm=()=>E.isa(S.alt,S.dT);

/* ---------------- canvas helpers ---------------- */
const cv=el('env'); const ST=LAB.fit(cv,()=>draw(),2);
let FS=1;
function txt(g,s,x,y,col,al,sz,wt,font){ g.font=`${wt||500} ${Math.round((sz||12)*FS*10)/10}px ${font||MONO}`; g.fillStyle=col||C.txt; g.textAlign=al||'left'; g.textBaseline='alphabetic'; g.fillText(s,x,y); g.textAlign='left'; }
function line(g,x1,y1,x2,y2,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); g.setLineDash([]); }
function poly(g,pts,col,w,dash){ if(pts.length<2) return; g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke(); g.setLineDash([]); }
function dot(g,x,y,r,fill,stroke,w){ g.beginPath(); g.arc(x,y,r,0,Math.PI*2); if(fill){ g.fillStyle=fill; g.fill(); } if(stroke){ g.strokeStyle=stroke; g.lineWidth=w||1.5; g.stroke(); } }
function rr(g,x,y,w,h,r){ g.beginPath(); g.roundRect?g.roundRect(x,y,w,h,r):g.rect(x,y,w,h); }
function tag(g,s,x,y,col,o){ o=o||{}; const sz=(o.sz||11)*FS; g.font=`${o.wt||600} ${sz}px ${o.font||SANS}`; const w=g.measureText(s).width+10, h=sz+7;
  let bx=o.al==='right'?x-w:o.al==='center'?x-w/2:x; bx=clamp(bx,2,ST.w-w-2); const by=y-h/2;
  if(o.bg!==false){ g.fillStyle='rgba(10,14,18,.78)'; rr(g,bx,by,w,h,3); g.fill(); }
  g.fillStyle=col||C.txt; g.textBaseline='middle'; g.textAlign='left'; g.fillText(s,bx+5,y+0.5); g.textBaseline='alphabetic'; return [bx,by,bx+w,by+h]; }
function panel(g,b){ g.fillStyle='rgba(6,9,12,.35)'; rr(g,b[0],b[1],b[2],b[3],6); g.fill(); }
/* temperature colour: blue (cold) → cyan → yellow → orange → red → white hot */
const TST=[[230,[61,127,208]],[330,[94,192,216]],[560,[232,212,106]],[850,[240,154,62]],[1250,[232,80,58]],[1900,[255,236,214]]];
function tcol(K,a){ let i=0; while(i<TST.length-2&&K>TST[i+1][0]) i++; const [k0,c0]=TST[i],[k1,c1]=TST[i+1], f=clamp((K-k0)/(k1-k0),0,1);
  return `rgba(${c0.map((v,j)=>Math.round(v+(c1[j]-v)*f)).join(',')},${a??1})`; }

/* ---------------- spool phases (animation) ---------------- */
const PH={a:0,b:0,crank:0,flow:0,t:0};

/* ---------------- gas-turbine drawing primitives ---------------- */
/* geometry: u along the engine 0–1, r radius 0–1 of the half height; X(u), Yt(r) top half, Yb(r) bottom half */
function geo(b,flip){ const [x,y,w,h]=b, L0=x+w*0.03, Lw=w*0.94, yc=y+h*0.47, R=Math.min(h*0.43,Lw*0.24);
  return {X:u=>flip?L0+(1-u)*Lw:L0+u*Lw, Yt:r=>yc-r*R, Yb:r=>yc+r*R, yc, R, Lw, L0}; }
/* a gas band: pts [[u,rOut,rIn]…], temperature stops [[u,K]…] → filled top and bottom halves with a gradient along u */
function band(g,G,pts,stops,alpha){ const xs=pts.map(p=>G.X(p[0])), x0=Math.min(...xs), x1=Math.max(...xs); const gr=g.createLinearGradient(x0,0,x1,0);
  stops.forEach(([u,K])=>gr.addColorStop(clamp((G.X(u)-x0)/((x1-x0)||1),0,1),tcol(K,alpha??0.9)));
  for(const half of [G.Yt,G.Yb]){ g.beginPath(); pts.forEach((p,i)=>{ const X=G.X(p[0]), Y=half(p[1]); i?g.lineTo(X,Y):g.moveTo(X,Y); }); for(let i=pts.length-1;i>=0;i--) g.lineTo(G.X(pts[i][0]),half(pts[i][2])); g.closePath(); g.fillStyle=gr; g.fill(); } }
/* solid casing shape between two radius profiles */
function shell(g,G,pts,fill,stroke){ for(const half of [G.Yt,G.Yb]){ g.beginPath(); pts.forEach((p,i)=>{ const X=G.X(p[0]), Y=half(p[1]); i?g.lineTo(X,Y):g.moveTo(X,Y); }); for(let i=pts.length-1;i>=0;i--) g.lineTo(G.X(pts[i][0]),half(pts[i][2])); g.closePath(); g.fillStyle=fill; g.fill(); if(stroke){ g.strokeStyle=stroke; g.lineWidth=1; g.stroke(); } } }
/* a blade row: a dashed line that moves (top half up, bottom half down: the blades turning) */
function row(g,G,u,r0,r1,col,ph,w){ const X=G.X(u); for(const [half,s] of [[G.Yt,1],[G.Yb,-1]]){ line(g,X,half(r0),X,half(r1),'rgba(20,26,32,.55)',(w||2.2)+1.5);
  g.strokeStyle=col; g.lineWidth=w||2.2; g.setLineDash([3,3.2]); g.lineDashOffset=s*ph*22; g.beginPath(); g.moveTo(X,half(r0)); g.lineTo(X,half(r1)); g.stroke(); g.setLineDash([]); g.lineDashOffset=0; } }
const rIn=(pts,u)=>{ for(let i=0;i<pts.length-1;i++){ const a=pts[i],b=pts[i+1]; if(u>=Math.min(a[0],b[0])&&u<=Math.max(a[0],b[0])){ const f=(u-a[0])/((b[0]-a[0])||1); return [a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f]; } } return [pts[0][1],pts[0][2]]; };
function flowDots(g,G,pts,n,spd,col){ if(reduce) return; const u0=pts[0][0], u1=pts[pts.length-1][0];
  for(let k=0;k<n;k++){ const f=((k/n)+PH.flow*spd)%1, u=u0+(u1-u0)*f, [ro,ri]=rIn(pts,u), lane=((k*0.618)%1)*0.6+0.2, r=ri+(ro-ri)*lane;
    dot(g,G.X(u),G.Yt(r),1.3,col||'rgba(255,255,255,.55)'); dot(g,G.X(u),G.Yb(r),1.3,col||'rgba(255,255,255,.55)'); } }
const stT=(M,k)=>{ const s=M.stations.find(x=>x[0]===k); return s?s[1]:288; };
/* "suck · squeeze · bang · blow" band under a gas turbine */
/* the same numbered stages, in the same colours, for every engine: 1 intake, 2 compression, 3 combustion, 4 exhaust (5 = what the turbine drives) */
const SC=['#9fb0bd','#7EC8F2','#6FD3C0','#F5B85C','#F2A08C','#C9B6F2'];
function phases(g,G,list,y){ const ph=ST.w<640; list.forEach(([u0,u1,t,k])=>{ const xa=Math.min(G.X(u0),G.X(u1)), xb=Math.max(G.X(u0),G.X(u1)), c=SC[k||0];
  line(g,xa+2,y,xb-2,y,c,2); line(g,xa+2,y-3,xa+2,y+3,c,1.5); line(g,xb-2,y-3,xb-2,y+3,c,1.5);
  txt(g,L(t),(xa+xb)/2,y+13,c,'center',ph?8.5:10,600,SANS); }); }
function lab(g,x,y,s,col,al){ if(!s) return; tag(g,s,x,y,col||C.txt,{sz:ST.w<640?9:10.5,al:al||'center',bg:true}); }

/* ---------------- the four cutaways ---------------- */
function drawFan(g,b,M,ph){ const G=geo(b), pw=M.frac??0.5, sm=ST.w<640;
  /* nacelle */
  shell(g,G,[[0,0.88,0.82],[0.05,0.97,0.83],[0.16,1.0,0.86],[0.5,0.96,0.84],[0.64,0.88,0.8]],C.casing,C.edge);
  /* bypass stream */
  const byp=[[0.155,0.84,0.47],[0.3,0.84,0.46],[0.5,0.83,0.44],[0.64,0.79,0.42]];
  const Tb=stT(M,'fan'); band(g,G,byp,[[0.155,Tb],[0.64,Tb]],0.55); flowDots(g,G,byp,14,0.9+pw,'rgba(210,235,255,.5)');
  /* core cowl */
  shell(g,G,[[0.15,0.47,0.42],[0.45,0.44,0.33],[0.64,0.42,0.36],[0.8,0.37,0.33],[0.88,0.31,0.28]],C.casing,C.edge);
  /* inlet air in front of the fan */
  band(g,G,[[0,0.82,0.03],[0.1,0.84,0.12],[0.13,0.85,0.2]],[[0,stT(M,'in')],[0.13,stT(M,'in')]],0.35);
  /* core gas path */
  const core=[[0.15,0.42,0.22],[0.24,0.38,0.23],[0.44,0.27,0.2],[0.47,0.33,0.15],[0.55,0.33,0.15],[0.58,0.27,0.2],[0.62,0.28,0.19],[0.74,0.33,0.18],[0.88,0.28,0.1],[0.95,0.22,0.0]];
  band(g,G,core,[[0.15,stT(M,'fan')],[0.44,stT(M,'comp')],[0.49,stT(M,'burn')],[0.55,stT(M,'burn')],[0.585,stT(M,'hpt')],[0.62,stT(M,'egt')],[0.88,stT(M,'exh')]]);
  /* exhaust plume */
  band(g,G,[[0.88,0.28,0],[1,0.3,0]],[[0.88,stT(M,'exh')],[1,stT(M,'exh')-150]],0.25); band(g,G,[[0.64,0.79,0.42],[0.8,0.72,0.37],[1,0.66,0.3]],[[0.64,Tb],[1,Tb]],0.18);
  flowDots(g,G,core,16,0.7+pw);
  /* shafts: LP inside, HP tube */
  shell(g,G,[[0.13,0.04,0],[0.74,0.04,0]],'rgba(201,182,242,.45)'); shell(g,G,[[0.25,0.11,0.07],[0.59,0.11,0.07]],'rgba(127,203,232,.5)');
  /* spinner and fan */
  g.fillStyle='#3a4652'; for(const hf of [G.Yt,G.Yb]){ g.beginPath(); g.moveTo(G.X(0.035),G.yc); g.quadraticCurveTo(G.X(0.06),hf(0.19),G.X(0.14),hf(0.22)); g.lineTo(G.X(0.14),G.yc); g.closePath(); g.fill(); }
  row(g,G,0.125,0.22,0.84,C.lp,ph.a,5); row(g,G,0.14,0.22,0.84,C.lp,ph.a+0.3,3);
  for(const u of [0.18,0.2,0.22]) row(g,G,u,0.23,0.4,C.lp,ph.a,1.8);
  for(let i=0;i<9;i++){ const u=0.26+i*0.02, [ro,ri]=rIn(core,u); row(g,G,u,ri,ro,C.hp,ph.b,1.6); }
  for(const u of [0.565,0.585]) row(g,G,u,0.2,0.28,C.hp,ph.b,2.2);
  for(let i=0;i<5;i++){ const u=0.63+i*0.025, [ro,ri]=rIn(core,u); row(g,G,u,ri,ro,C.lp,ph.a,2); }
  /* combustor glow */
  glow(g,G,0.51,0.24,pw);
  /* labels */
  if(!S.stnTags){ const yl=G.Yt(1.0)-12;
    lab(g,G.X(0.13),yl,L(t2('Fan · N1','Fan · N1')),C.lp); if(!sm){ lab(g,G.X(0.34),G.Yt(0.62),L(t2('bypass air','omløpsluft')),'#BFE3F5'); }
    lab(g,G.X(0.35),G.Yb(0.62),L(t2('Compressor · N2','Kompressor · N2')),C.hp); lab(g,G.X(0.51),G.Yb(0.88)+2,L(t2('Combustor','Brennkammer')),C.amb);
    lab(g,G.X(0.68),G.Yb(0.62),L(t2('Turbines','Turbiner')),'#F2B8A8'); if(!sm) lab(g,G.X(0.9),G.Yt(0.5),L(t2('Nozzle','Dyse')),C.mut); }
  phases(g,G,[[0,0.15,t2('1 Intake · suck','1 Innsug · sug'),1],[0.15,0.46,t2('2 Compression · squeeze','2 Kompresjon · klem'),2],[0.46,0.56,t2('3 Combustion · bang','3 Forbrenning · smell'),3],[0.56,0.95,t2('4 Exhaust · blow (5: turbine drives the fan)','4 Eksos · blås (5: turbinen driver fanen)'),4]],G.Yb(1.0)+12);
  stations(g,G,M,[[0.1,'in'],[0.2,'fan'],[0.44,'comp'],[0.51,'burn'],[0.62,'egt'],[0.86,'exh']]);
  return G; }
function drawJet(g,b,M,ph){ const G=geo(b), pw=M.frac??0.5;
  shell(g,G,[[0.02,0.62,0.55],[0.12,0.62,0.5],[0.42,0.56,0.4],[0.56,0.58,0.43],[0.66,0.56,0.44],[0.92,0.48,0.38]],C.casing,C.edge);
  const core=[[0.02,0.55,0.0],[0.1,0.5,0.16],[0.42,0.38,0.24],[0.45,0.42,0.16],[0.55,0.42,0.16],[0.58,0.38,0.22],[0.66,0.42,0.2],[0.8,0.4,0.1],[0.92,0.38,0.0]];
  band(g,G,core,[[0.06,stT(M,'in')],[0.42,stT(M,'comp')],[0.48,stT(M,'burn')],[0.55,stT(M,'burn')],[0.62,stT(M,'egt')],[0.92,stT(M,'exh')]]);
  band(g,G,[[0.92,0.38,0],[1,0.36,0]],[[0.92,stT(M,'exh')],[1,stT(M,'exh')-120]],0.35);
  flowDots(g,G,core,18,0.8+pw*1.2);
  g.fillStyle='#3a4652'; for(const hf of [G.Yt,G.Yb]){ g.beginPath(); g.moveTo(G.X(0.03),G.yc); g.quadraticCurveTo(G.X(0.06),hf(0.14),G.X(0.1),hf(0.16)); g.lineTo(G.X(0.1),G.yc); g.closePath(); g.fill(); }
  shell(g,G,[[0.1,0.08,0],[0.62,0.08,0]],'rgba(127,203,232,.5)');
  for(let i=0;i<11;i++){ const u=0.11+i*0.029, [ro,ri]=rIn(core,u); row(g,G,u,ri,ro,C.hp,ph.b,1.8); }
  for(const u of [0.595,0.62]){ const [ro,ri]=rIn(core,u); row(g,G,u,ri,ro,C.hp,ph.b,2.4); }
  glow(g,G,0.5,0.3,pw);
  if(!S.stnTags){ lab(g,G.X(0.26),G.Yt(0.72),L(t2('Compressor · N','Kompressor · N')),C.hp); lab(g,G.X(0.5),G.Yt(0.72),L(t2('Combustor','Brennkammer')),C.amb); lab(g,G.X(0.61),G.Yb(0.72),L(t2('Turbine','Turbin')),'#F2B8A8'); lab(g,G.X(0.82),G.Yt(0.62),L(t2('Jet pipe and nozzle','Jetrør og dyse')),C.mut); }
  phases(g,G,[[0,0.1,t2('1 Intake · suck','1 Innsug · sug'),1],[0.1,0.43,t2('2 Compression · squeeze','2 Kompresjon · klem'),2],[0.43,0.56,t2('3 Combustion · bang','3 Forbrenning · smell'),3],[0.56,0.95,t2('4 Exhaust · blow','4 Eksos · blås'),4]],G.Yb(0.72)+14);
  stations(g,G,M,[[0.06,'in'],[0.42,'comp'],[0.5,'burn'],[0.62,'egt'],[0.9,'exh']]);
  return G; }
/* free-turbine turboprop, direct flow (the option): propeller on the left, intake just behind it, air flows straight back to the exhaust at the rear;
   the Np shaft runs forward from the power turbine through the hollow Ng shaft to the gearbox */
function drawTPd(g,b,M,ph){ const [bx,by,bw,bh]=b, G=geo([bx+bw*0.1,by,bw*0.9,bh]), pw=Math.max(0.05,M.shp/850), sm=ST.w<640;
  const X=G.X, Yt=G.Yt, Yb=G.Yb; g.save(); g.globalAlpha=TOUR.on?0.45:1;
  const Tin=stT(M,'in'), T3=stT(M,'comp'), Tb=stT(M,'burn'), Ti=stT(M,'itt'), Te=stT(M,'exh');
  /* casing */
  shell(g,G,[[0.05,0.42,0.0],[0.17,0.42,0.0]],'#2f3a45',C.edge);              // reduction gearbox
  shell(g,G,[[0.19,0.66,0.6],[0.26,0.57,0.52],[0.3,0.52,0.48],[0.42,0.46,0.42],[0.47,0.67,0.63],[0.52,0.67,0.63],[0.66,0.62,0.58],[0.7,0.52,0.48],[0.84,0.54,0.5],[0.96,0.5,0.46]],C.casing,C.edge);
  /* gas path, front to back */
  const path=[[0.19,0.6,0.44],[0.26,0.52,0.3],[0.3,0.48,0.24],[0.42,0.42,0.25],[0.47,0.63,0.5],[0.52,0.63,0.36],[0.66,0.58,0.3],[0.7,0.48,0.22],[0.84,0.5,0.22],[0.96,0.46,0.12]];
  band(g,G,path,[[0.19,Tin],[0.3,Tin+5],[0.42,(Tin+T3)/2],[0.48,T3],[0.53,Tb],[0.64,Tb],[0.71,Ti+60],[0.755,Ti],[0.84,Te],[0.96,Te]]);
  band(g,G,[[0.96,0.44,0],[1.0,0.36,0]],[[0.96,Te],[1.0,Te-200]],0.22);
  flowDots(g,G,path,22,0.7+pw);
  /* shafts: Ng a hollow tube (compressor → its turbine), Np inside it from the power turbine forward to the gearbox */
  shell(g,G,[[0.05,0.05,0],[0.82,0.05,0]],'rgba(201,182,242,.55)'); shell(g,G,[[0.3,0.12,0.07],[0.73,0.12,0.07]],'rgba(127,203,232,.5)');
  for(const hf of [Yt,Yb]) line(g,X(0.755),hf(0.08),X(0.755),hf(0.22),'#0f151b',3);   // the gap: no link between the turbines
  /* axial stages and the impeller (Ng) */
  for(const u of [0.33,0.36,0.39]){ const [ro,ri]=rIn(path,u); row(g,G,u,ri+0.01,ro-0.01,C.hp,ph.b,1.8); }
  for(const hf of [Yt,Yb]){ g.fillStyle='rgba(127,203,232,.22)'; g.beginPath(); g.moveTo(X(0.42),hf(0.25)); g.quadraticCurveTo(X(0.46),hf(0.3),X(0.47),hf(0.5)); g.lineTo(X(0.47),hf(0.12)); g.lineTo(X(0.42),hf(0.12)); g.closePath(); g.fill(); }
  row(g,G,0.445,0.26,0.5,C.hp,ph.b,1.6);
  row(g,G,0.72,0.22,0.48,C.hp,ph.b,2.6);              // compressor turbine
  row(g,G,0.785,0.22,0.49,C.lp,ph.a,2.6); row(g,G,0.81,0.22,0.495,C.lp,ph.a,2.6);   // power turbine
  glow(g,G,0.59,0.45,pw);
  /* propeller */
  const hx=X(0.03), py=G.yc, Rp=Math.min(bh*0.46,G.R*1.6), fe=!M.np;
  g.fillStyle='#3a4652'; g.beginPath(); g.ellipse(hx,py,bw*0.022,G.R*0.3,0,0,Math.PI*2); g.fill();
  const pa=reduce?0.6:ph.a*2.2; for(let k=0;k<4;k++){ const a=pa+k*Math.PI/2, ext=Math.cos(a)*Rp, wdt=fe?1.5:Math.max(1.5,Math.abs(Math.sin(a))*bw*0.012+2);
    g.fillStyle=k%2?'rgba(201,182,242,.75)':'rgba(201,182,242,.55)'; g.beginPath(); g.ellipse(hx-bw*0.004,py-ext/2,wdt,Math.abs(ext)/2,0,0,Math.PI*2); g.fill(); }
  g.restore(); if(TOUR.on){ tourDraw(g,G); return G; }
  if(!S.stnTags){
    lab(g,hx+6,Yt(1.05)-4,L(fe?t2('Propeller · feathered','Propell · fjæret'):t2('Propeller · Np','Propell · Np')),C.lp,'left');
    lab(g,X(0.11),Yb(0.62),L(t2('Gearbox','Girkasse')),C.mut);
    lab(g,X(0.22),Yt(0.8),L(t2('Air in','Luft inn')),'#BFE3F5');
    lab(g,X(0.38),Yb(0.66),L(t2('Compressor · Ng','Kompressor · Ng')),C.hp); lab(g,X(0.59),Yb(0.82),L(t2('Combustor','Brennkammer')),C.amb);
    lab(g,X(0.79),Yt(0.7),L(t2('Power turbine','Kraftturbin')),C.lp); if(!sm) lab(g,X(0.92),Yb(0.62),L(t2('Exhaust','Eksos')),'#F2B8A8'); }
  const PL=[[0.0,0.18,t2('5 Prop','5 Propell'),5],[0.18,0.3,t2('1 Intake','1 Innsug'),1],[0.3,0.48,t2('2 Compression','2 Kompresjon'),2],[0.48,0.68,t2('3 Combustion','3 Forbrenning'),3],[0.68,0.98,t2('4 Turbines · exhaust','4 Turbiner · eksos'),4]], py0=G.Yb(0.98)+12;
  if(sm){ phases(g,G,PL.filter((_,i)=>i%2===0),py0); phases(g,G,PL.filter((_,i)=>i%2===1),py0+22); } else phases(g,G,PL,py0);
  stations(g,G,M,[[0.24,'in'],[0.47,'comp'],[0.59,'burn'],[0.755,'itt'],[0.9,'exh']]);
  return G; }
/* free-turbine turboprop, reverse flow (the default, most common in small turboprops): the propeller on the left, air enters at the back (right) and flows forward */
function drawTP(g,b,M,ph){ const [bx,by,bw,bh]=b, G=geo([bx+bw*0.1,by,bw*0.9,bh]), pw=Math.max(0.05,M.shp/850), sm=ST.w<640;
  const X=G.X, Yt=G.Yt, Yb=G.Yb, TR=TOUR.on?0.45:1;
  const Tin=stT(M,'in'), T3=stT(M,'comp'), Tb=stT(M,'burn'), Ti=stT(M,'itt'), Te=stT(M,'exh');
  g.save(); g.globalAlpha=TR;
  /* casing */
  shell(g,G,[[0.05,0.42,0.0],[0.17,0.42,0.0]],'#2f3a45',C.edge);              // reduction gearbox
  shell(g,G,[[0.19,0.5,0.46],[0.28,0.66,0.62],[0.56,0.68,0.64],[0.6,0.66,0.62],[0.66,0.4,0.36],[0.8,0.4,0.36],[0.82,0.52,0.48],[0.96,0.52,0.48]],C.casing,C.edge);
  /* intake duct (lower half only): scoop just behind the propeller, ducted back under the engine to the plenum at the rear */
  const dO=[[0.28,0.96],[0.34,0.9],[0.9,0.9],[0.95,0.84],[0.95,0.5]], dI=[[0.3,0.78],[0.34,0.76],[0.84,0.76],[0.86,0.7],[0.86,0.5]];
  g.beginPath(); dO.forEach(([u,r],i)=>i?g.lineTo(X(u),Yb(r)):g.moveTo(X(u),Yb(r))); for(let i=dI.length-1;i>=0;i--) g.lineTo(X(dI[i][0]),Yb(dI[i][1])); g.closePath();
  g.fillStyle=tcol(Tin,0.45); g.fill(); g.strokeStyle=C.edge; g.lineWidth=1; g.stroke();
  flowDots(g,{X:G.X,Yt:r=>-999,Yb:G.Yb},[[0.34,0.88,0.78],[0.84,0.88,0.78]],8,0.6+pw);
  /* inlet screen around the plenum */
  for(const hf of [Yt,Yb]) line(g,X(0.84),hf(0.5),X(0.95),hf(0.5),'rgba(214,226,236,.6)',1.2,[2,2]);
  /* plenum, axial stages, impeller */
  const inl=[[0.95,0.48,0.12],[0.84,0.47,0.13],[0.8,0.34,0.15],[0.66,0.3,0.17]];
  band(g,G,inl,[[0.95,Tin],[0.8,Tin+10],[0.66,(Tin+T3)/2]]); flowDots(g,G,[[0.9,0.4,0.2],[0.66,0.28,0.18]],10,0.6+pw);
  band(g,G,[[0.66,0.3,0.17],[0.6,0.6,0.48]],[[0.66,(Tin+T3)/2],[0.6,T3]]);
  /* compressed air flows FORWARD outside the combustion liner */
  band(g,G,[[0.6,0.63,0.48],[0.56,0.63,0.58],[0.3,0.63,0.58]],[[0.6,T3],[0.3,T3]],0.75); flowDots(g,G,[[0.57,0.625,0.585],[0.31,0.625,0.585]],7,0.6+pw);
  /* liner around the turbines: closed (dome) end at the front; the gas burns flowing REARWARD */
  band(g,G,[[0.31,0.55,0.37],[0.52,0.55,0.37]],[[0.31,Tb],[0.52,Ti+150]]); flowDots(g,G,[[0.32,0.53,0.39],[0.52,0.53,0.39]],7,0.7+pw);
  for(const [hf,s] of [[Yt,1],[Yb,-1]]){ g.strokeStyle='rgba(214,226,236,.55)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(X(0.52),hf(0.56)); g.lineTo(X(0.32),hf(0.56)); g.quadraticCurveTo(X(0.29),hf(0.46),X(0.32),hf(0.36)); g.lineTo(X(0.5),hf(0.36)); g.stroke(); void s;
    /* exit duct: turns the gas 180° to flow forward into the turbines */
    g.strokeStyle=tcol(Ti+120,0.9); g.lineWidth=Math.max(3,G.R*0.13); g.beginPath(); g.moveTo(X(0.51),hf(0.46)); g.quadraticCurveTo(X(0.58),hf(0.34),X(0.51),hf(0.22)); g.stroke(); }
  /* turbines (inside the liner ring) and the exhaust */
  band(g,G,[[0.51,0.3,0.13],[0.28,0.32,0.13]],[[0.51,Ti+100],[0.39,Ti],[0.28,Te]]); flowDots(g,G,[[0.5,0.29,0.15],[0.27,0.3,0.15]],8,0.8+pw);
  band(g,G,[[0.28,0.32,0.13],[0.22,0.5,0.2]],[[0.28,Te],[0.22,Te]]);
  for(const hf of [Yt,Yb]){ const gr=g.createLinearGradient(0,hf(0.45),0,hf(0.95)); gr.addColorStop(0,tcol(Te,0.9)); gr.addColorStop(1,tcol(Te-150,0.15));
    g.fillStyle=gr; g.beginPath(); g.moveTo(X(0.27),hf(0.47)); g.lineTo(X(0.27),hf(0.85)); g.lineTo(X(0.19),hf(0.95)); g.lineTo(X(0.21),hf(0.5)); g.closePath(); g.fill(); }
  /* the two shafts: Ng (compressor turbine → compressor, backwards) and Np (power turbine → gearbox, forwards). No mechanical link. */
  shell(g,G,[[0.395,0.08,0],[0.84,0.08,0]],'rgba(127,203,232,.5)'); shell(g,G,[[0.05,0.06,0],[0.355,0.06,0]],'rgba(201,182,242,.5)');
  line(g,X(0.375),Yt(0.13),X(0.375),Yb(0.13),'#0f151b',3);
  for(let i=0;i<3;i++){ const u=0.78-i*0.045, [ro,ri]=rIn(inl,u); row(g,G,u,ri+0.01,ro-0.01,C.hp,ph.b,1.8); }
  for(const hf of [Yt,Yb]){ g.fillStyle='rgba(127,203,232,.22)'; g.beginPath(); g.moveTo(X(0.66),hf(0.17)); g.quadraticCurveTo(X(0.66),hf(0.5),X(0.61),hf(0.58)); g.lineTo(X(0.61),hf(0.12)); g.closePath(); g.fill(); }
  row(g,G,0.635,0.18,0.46,C.hp,ph.b,1.6);
  row(g,G,0.42,0.14,0.3,C.hp,ph.b,2.6);              // compressor turbine
  row(g,G,0.335,0.14,0.31,C.lp,ph.a,2.6); row(g,G,0.31,0.14,0.315,C.lp,ph.a,2.6);   // power turbine
  glow(g,G,0.4,0.46,pw);
  /* propeller (left of the gearbox): two blades drawn foreshortened as they turn; feathered = edge on */
  const hx=X(0.03), py=G.yc, Rp=Math.min(bh*0.46,G.R*1.6), fe=!M.np;
  g.fillStyle='#3a4652'; g.beginPath(); g.ellipse(hx,py,bw*0.022,G.R*0.3,0,0,Math.PI*2); g.fill();
  const pa=reduce?0.6:ph.a*2.2; for(let k=0;k<4;k++){ const a=pa+k*Math.PI/2, ext=Math.cos(a)*Rp, wdt=fe?1.5:Math.max(1.5,Math.abs(Math.sin(a))*bw*0.012+2);
    g.fillStyle=k%2?'rgba(201,182,242,.75)':'rgba(201,182,242,.55)'; g.beginPath(); g.ellipse(hx-bw*0.004,py-ext/2,wdt,Math.abs(ext)/2,0,0,Math.PI*2); g.fill(); }
  g.restore();
  if(TOUR.on) tourDraw(g,G);
  else { if(!S.stnTags){
    lab(g,hx+6,Yt(1.05)-4,L(fe?t2('Propeller · feathered','Propell · fjæret'):t2('Propeller · Np','Propell · Np')),C.lp,'left');
    lab(g,X(0.11),Yb(0.62),L(t2('Gearbox','Girkasse')),C.mut);
    lab(g,X(0.33),Yt(0.8),L(t2('Power turbine','Kraftturbin')),C.lp); if(!sm) lab(g,X(0.23),Yt(1.06),L(t2('Exhaust','Eksos')),'#F2B8A8');
    lab(g,X(0.47),Yt(0.8),L(t2('Combustor','Brennkammer')),C.amb); lab(g,X(0.73),Yt(0.6),L(t2('Compressor · Ng','Kompressor · Ng')),C.hp);
    lab(g,X(0.6),Yb(0.83),L(t2('Air in (duct to the rear)','Luft inn (kanal bakover)')),'#BFE3F5'); }
    const PL=[[0.0,0.18,t2('5 Prop','5 Propell'),5],[0.19,0.29,t2('4 Exhaust','4 Eksos'),4],[0.29,0.57,t2('3 Combustion · 4 turbines','3 Forbrenning · 4 turbiner'),3],[0.57,0.8,t2('2 Compression','2 Kompresjon'),2],[0.8,0.96,t2('1 Intake','1 Innsug'),1]], py0=G.Yb(0.98)+12;
    if(sm){ phases(g,G,PL.filter((_,i)=>i%2===0),py0); phases(g,G,PL.filter((_,i)=>i%2===1),py0+22); } else phases(g,G,PL,py0);
    stations(g,G,M,[[0.9,'in'],[0.6,'comp'],[0.45,'burn'],[0.375,'itt'],[0.24,'exh']]); }
  return G; }
/* ---------------- "Follow the air": a step-through of the turboprop gas path ---------------- */
/* each step: [path [[u,r]…], halves ('b' lower only, 'tb' both), stage colour index, text] */
const TOURS={
 rev:{steps:[
  [[[0.27,0.86],[0.34,0.83],[0.86,0.83],[0.905,0.75],[0.905,0.52]],'b',1,t2('Air enters through the scoop just behind the propeller and is ducted <b>backward</b>, along the bottom of the engine, to the rear.','Luften kommer inn gjennom inntaket like bak propellen og ledes <b>bakover</b> langs undersiden av motoren, helt bak.'),[[0.33,-1.04,t2('Scoop · air in','Inntak · luft inn')],[0.62,-0.83,t2('Inlet duct','Inntakskanal')]]],
  [[[0.905,0.5],[0.9,0.32],[0.8,0.25],[0.66,0.24],[0.63,0.4],[0.605,0.55]],'tb',2,t2('At the back it passes the inlet screen into a plenum and turns 180° to flow <b>forward</b> into the compressor: axial stages, then the centrifugal impeller (stage 1 → 2).','Bak går den gjennom inntaksgitteret inn i et plenum og snur 180° for å strømme <b>forover</b> inn i kompressoren: aksialtrinn, så sentrifugalimpelleren (trinn 1 → 2).'),[[0.89,0.66,t2('Screen + plenum','Gitter + plenum')],[0.7,0.56,t2('Compressor','Kompressor')]]],
  [[[0.6,0.56],[0.57,0.605],[0.33,0.605],[0.31,0.52]],'tb',2,t2('The diffuser turns the compressed air again: it flows <b>forward</b> outside the combustion liner, cooling it, and goes into the liner through rows of holes.','Diffusoren snur den komprimerte luften igjen: den strømmer <b>forover</b> utenfor flammerøret, kjøler det, og går inn i flammerøret gjennom rader med hull.'),[[0.44,0.78,t2('Outside the liner','Utenfor flammerøret')]]],
  [[[0.33,0.46],[0.5,0.46],[0.545,0.36],[0.51,0.24]],'tb',3,t2('Inside the ring-shaped liner the fuel burns while the gas flows <b>rearward</b>; at the back the exit duct turns it 180° to flow <b>forward</b> again (stage 3).','Inne i det ringformede flammerøret brenner drivstoffet mens gassen strømmer <b>bakover</b>; bak snur utløpskanalen den 180° så den strømmer <b>forover</b> igjen (trinn 3).'),[[0.38,0.78,t2('Liner','Flammerør')],[0.6,0.78,t2('Exit duct · 180°','Utløpskanal · 180°')]]],
  [[[0.51,0.22],[0.42,0.22],[0.375,0.22],[0.3,0.22]],'tb',4,t2('The gas drives first the compressor turbine (Ng, it turns the compressor), then the free power turbine (Np), nearest the propeller, which drives the reduction gearbox on a short shaft. No shaft joins the two.','Gassen driver først kompressorturbinen (Ng, den dreier kompressoren), så den frie kraftturbinen (Np) nærmest propellen, som driver reduksjonsgiret på en kort aksel. Ingen aksel kobler de to.'),[[0.47,0.78,t2('Compressor turbine · Ng','Kompressorturbin · Ng')],[0.3,-0.68,t2('Power turbine · Np','Kraftturbin · Np')]]],
  [[[0.29,0.22],[0.25,0.35],[0.235,0.6],[0.21,0.9]],'tb',4,t2('The exhaust turns 90° and leaves through the two exhaust stacks just behind the propeller (stage 4).','Eksosen svinger 90° og går ut gjennom de to eksosrørene like bak propellen (trinn 4).'),[[0.33,1.02,t2('Exhaust stacks','Eksosrør')]]]],
  sum:t2('The engine is mounted “backwards”: cold inlet at the rear, hot section and power turbine at the front, right behind the gearbox. That makes it short, keeps the inlet away from debris, and lets the hot section be removed without disturbing the compressor.','Motoren er montert «baklengs»: kaldt innløp bak, varm del og kraftturbin foran, rett bak giret. Det gjør den kort, holder innløpet unna rusk, og den varme delen kan tas av uten å røre kompressoren.')},
 dir:{steps:[
  [[[0.17,0.56],[0.22,0.5],[0.3,0.36],[0.42,0.34],[0.47,0.56]],'tb',1,t2('Air enters the intake at the front, just behind the propeller, and goes straight into the compressor (stage 1 → 2).','Luften kommer inn i inntaket foran, like bak propellen, og går rett inn i kompressoren (trinn 1 → 2).'),[[0.24,0.8,t2('Intake','Inntak')]]],
  [[[0.47,0.56],[0.53,0.48],[0.66,0.44],[0.7,0.35],[0.83,0.36]],'tb',3,t2('It keeps going the same way: it burns in the combustor, then drives the compressor turbine (Ng) and the power turbine (Np). It never turns back (stage 3).','Den fortsetter samme vei: den brenner i brennkammeret og driver så kompressorturbinen (Ng) og kraftturbinen (Np). Den snur aldri (trinn 3).'),[[0.6,0.82,t2('Combustor','Brennkammer')],[0.79,-0.7,t2('Ng · Np turbines','Ng- og Np-turbin')]]],
  [[[0.83,0.36],[0.96,0.3],[1.0,0.22]],'tb',4,t2('The gas leaves at the back; the Np shaft runs forward through the hollow Ng shaft to the gearbox and the propeller (stage 4).','Gassen går ut bak; Np-akselen går forover gjennom den hule Ng-akselen til giret og propellen (trinn 4).'),[[0.9,0.68,t2('Exhaust','Eksos')],[0.45,-0.22,t2('Np shaft → gearbox','Np-aksel → gir')]]]],
  sum:t2('One pass from front to back: a simple, straight path, but a longer engine, and the power turbine shaft must run forward through the gas generator.','Én tur fra front til bak: en enkel, rett vei, men en lengre motor, og kraftturbinakselen må gå forover gjennom gassgeneratoren.')}
};
const TOUR={on:false,i:0,play:false,t:0,timer:null};
const tourDef=()=>TOURS[S.lay==='dir'?'dir':'rev'];
function tourDraw(g,G){ const D=tourDef(), sm=ST.w<640;
  const pts=(st,hf)=>st[0].map(([u,r])=>[G.X(u),hf(r)]);
  /* earlier steps: faint trail; current: bright with moving particles */
  D.steps.forEach((st,i)=>{ if(i>TOUR.i) return; const c=SC[st[2]], cur=i===TOUR.i;
    for(const hf of st[1]==='b'?[G.Yb]:[G.Yt,G.Yb]){ const P=pts(st,hf);
      g.save(); g.lineCap='round'; g.lineJoin='round';
      if(cur) poly(g,P,'rgba(8,12,16,.7)',7);
      poly(g,P,cur?c:'rgba(214,226,236,.35)',cur?2.4:1.4,cur?null:[3,3]);
      /* arrow at the end */
      const [x1,y1]=P[P.length-1], [x0,y0]=P[P.length-2], an=Math.atan2(y1-y0,x1-x0), a=cur?8:5;
      g.fillStyle=cur?c:'rgba(214,226,236,.35)'; g.beginPath(); g.moveTo(x1,y1); g.lineTo(x1-a*Math.cos(an-0.45),y1-a*Math.sin(an-0.45)); g.lineTo(x1-a*Math.cos(an+0.45),y1-a*Math.sin(an+0.45)); g.closePath(); g.fill();
      if(cur){ const seg=[]; let tot=0; for(let k=1;k<P.length;k++){ const l=Math.hypot(P[k][0]-P[k-1][0],P[k][1]-P[k-1][1]); seg.push(l); tot+=l; }
        const at=d=>{ d=Math.max(0,Math.min(tot,d)); let k=0; while(k<seg.length-1&&d>seg[k]){ d-=seg[k]; k++; } const f=seg[k]?d/seg[k]:0; return [P[k][0]+(P[k+1][0]-P[k][0])*f,P[k][1]+(P[k+1][1]-P[k][1])*f]; };
        const n=4; for(let p=0;p<n;p++){ const head=((reduce?0.5:TOUR.t*0.45)+p/n)%1*tot;
          for(let q=0;q<7;q++){ const [x,y]=at(head-q*5); dot(g,x,y,3.2-q*0.38,q?rgba(c,0.85-q*0.11):'#FFFFFF'); } } }
      g.restore(); } });
  /* extra highlights: the rotors and shafts that matter in this step */
  const cs=D.steps[TOUR.i];
  if(S.lay!=='dir'&&TOUR.i===4){ row(g,G,0.42,0.14,0.3,C.hp,PH.b,2.8); row(g,G,0.335,0.14,0.31,C.lp,PH.a,2.8); row(g,G,0.31,0.14,0.315,C.lp,PH.a,2.8);
    shell(g,G,[[0.395,0.08,0],[0.84,0.08,0]],'rgba(127,203,232,.8)'); shell(g,G,[[0.05,0.06,0],[0.355,0.06,0]],'rgba(201,182,242,.85)'); line(g,G.X(0.375),G.Yt(0.13),G.X(0.375),G.Yb(0.13),'#0f151b',3); }
  if(S.lay==='dir'&&TOUR.i===2){ shell(g,G,[[0.05,0.05,0],[0.82,0.05,0]],'rgba(201,182,242,.9)'); const y=G.yc, x0=G.X(0.8), x1=G.X(0.08); line(g,x0,y,x1+8,y,'#0f151b',2); line(g,x0,y,x1+8,y,'#FFFFFF',1,[5,4]);
    g.fillStyle='#FFFFFF'; g.beginPath(); g.moveTo(x1,y); g.lineTo(x1+8,y-4); g.lineTo(x1+8,y+4); g.closePath(); g.fill(); }
  (cs[4]||[]).forEach(([u,r,t])=>lab(g,G.X(u),r<0?G.Yb(-r):G.Yt(r),L(t),SC[cs[2]]));
  /* numbered badges at the start of each step shown so far */
  D.steps.forEach((st,i)=>{ if(i>TOUR.i) return; const hf=st[1]==='b'?G.Yb:G.Yt, [u,r]=st[0][0], c=SC[st[2]], x=G.X(u), y=hf(r), rr0=sm?7:8.5;
    g.globalAlpha=i===TOUR.i?1:0.6; dot(g,x,y,rr0,i===TOUR.i?c:'#1a222a',c,1.5); txt(g,String(i+1),x,y+(sm?3.2:3.8),i===TOUR.i?'#0f151b':c,'center',sm?9:10.5,700,MONO); g.globalAlpha=1; });
 }
const rgba=(h,a)=>{ const n=parseInt(h.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; };
function tourUI(){ const box=el('tour'); if(!box) return; const show=S.mode==='how'&&S.type==='tp'; box.hidden=!show; if(!show){ if(TOUR.on) tourStop(); return; }
  const D=tourDef(), n=D.steps.length, i=TOUR.i, last=i===n-1;
  if(!TOUR.on){ box.innerHTML=`<button type="button" class="tbtn pri" data-t="go">${L(t2('▶ Follow the air','▶ Følg luften'))}</button><span class="tlead">${L(S.lay==='dir'?t2('Step through the direct-flow path, 3 steps.','Gå gjennom den direkte gassveien, 3 steg.'):t2('Step through the reverse-flow path, 6 steps: where does the air actually go?','Gå gjennom motstrøms-veien, 6 steg: hvor går luften egentlig?'))}</span>`; return; }
  const st=D.steps[i], c=SC[st[2]];
  box.innerHTML=`<div class="trow"><span class="tnum" style="--c:${c}">${i+1}<small>/${n}</small></span><p class="ttxt" aria-live="polite">${L(st[3])}${last?`<span class="tsum">${L(D.sum)}</span>`:''}</p></div>
  <div class="tnav"><button type="button" class="tbtn" data-t="back" ${i?'':'disabled'}>${L(t2('← Back','← Tilbake'))}</button><button type="button" class="tbtn pri" data-t="next">${L(last?t2('Start again','Start på nytt'):t2('Next →','Neste →'))}</button><button type="button" class="tbtn" data-t="play" aria-pressed="${TOUR.play}">${L(TOUR.play?t2('❚❚ Pause','❚❚ Pause'):t2('▶ Auto-play','▶ Spill av'))}</button><span class="tdots">${D.steps.map((s,k)=>`<i class="${k===i?'on':k<i?'done':''}" style="--c:${SC[s[2]]}"></i>`).join('')}</span><button type="button" class="tbtn x" data-t="stop" aria-label="${L(t2('Close','Lukk'))}">×</button></div>`; }
function tourGo(i){ const n=tourDef().steps.length; TOUR.i=(i+n)%n; tourUI(); draw(); }
function tourStop(){ TOUR.on=false; TOUR.play=false; clearInterval(TOUR.timer); TOUR.timer=null; }
function tourPlay(on){ TOUR.play=on; clearInterval(TOUR.timer); TOUR.timer=on?setInterval(()=>{ const n=tourDef().steps.length; if(TOUR.i>=n-1){ tourPlay(false); tourUI(); return; } tourGo(TOUR.i+1); },5500):null; }
el('tour').addEventListener('click',e=>{ const b=e.target.closest('button[data-t]'); if(!b) return; const a=b.dataset.t, n=tourDef().steps.length;
  if(a==='go'){ TOUR.on=true; TOUR.i=0; tourPlay(false); }
  else if(a==='stop'){ tourStop(); }
  else if(a==='back'){ tourPlay(false); TOUR.i=Math.max(0,TOUR.i-1); }
  else if(a==='next'){ tourPlay(false); TOUR.i=TOUR.i>=n-1?0:TOUR.i+1; }
  else if(a==='play'){ if(!TOUR.play&&TOUR.i>=n-1) TOUR.i=0; tourPlay(!TOUR.play); }
  tourUI(); draw(); const f=el('tour').querySelector(`[data-t="${a==='go'?'next':a==='stop'?'go':a}"]`); if(f&&!f.disabled) f.focus(); });
function glow(g,G,u,r,pw){ if(pw<=0) return; const x=G.X(u); for(const y of [G.Yt(r),G.Yb(r)]){ const gr=g.createRadialGradient(x,y,1,x,y,G.R*0.16); gr.addColorStop(0,`rgba(255,240,200,${0.35+0.5*pw})`); gr.addColorStop(1,'rgba(255,160,60,0)'); g.fillStyle=gr; g.beginPath(); g.arc(x,y,G.R*0.16,0,Math.PI*2); g.fill(); } }
function stations(g,G,M,list){ if(!S.stn) return; list.forEach(([u,k])=>{ const K=stT(M,k); tag(g,nf(K-273.15,0)+'°',G.X(u),G.yc,tcol(K),{sz:ST.w<640?8.5:9.5,al:'center'}); }); }

/* piston: one cylinder of the engine, slowed down, with the four strokes */
function drawPiston(g,b,M){ const [bx,by,bw,bh]=b, sm=ST.w<640, cw=Math.min(bw*0.17,bh*0.34), cx=bx+bw*0.5, yT=by+bh*0.1, ch=bh*0.52, cr=ch*0.2, ccy=yT+ch+bh*0.18;
  const a=PH.crank%(4*Math.PI), stroke=Math.floor(a/Math.PI)%4, sf=(a%Math.PI)/Math.PI;
  const head=cw*0.28, py=yT+head+cr*(1-Math.cos(a))+2, pinX=cx+cr*Math.sin(a), pinY=ccy-cr*Math.cos(a);
  const Tin=stT(M,'in'), Tc=stT(M,'comp'), Tb=stT(M,'burn'), Te=stT(M,'exh'), on=M.hp>2;
  const gasK=!on?Tin:stroke===0?Tin:stroke===1?Tin+(Tc-Tin)*sf:stroke===2?Tb+(Te-Tb)*sf:Te;
  /* intake (left) and exhaust (right) pipes */
  const ip=[[bx+bw*0.04,yT+head*0.35],[cx-cw*0.32,yT+head*0.35]], ep=[[cx+cw*0.32,yT+head*0.35],[bx+bw*0.96,yT+head*0.35]], pw=Math.max(7,cw*0.18);
  g.lineCap='butt'; g.strokeStyle=tcol(Tin,0.75); g.lineWidth=pw; g.beginPath(); g.moveTo(...ip[0]); g.lineTo(...ip[1]); g.stroke();
  const eg=g.createLinearGradient(ep[0][0],0,ep[1][0],0); eg.addColorStop(0,tcol(on?Te:Tin,0.9)); eg.addColorStop(1,tcol(on?Te-200:Tin,0.3)); g.strokeStyle=eg; g.beginPath(); g.moveTo(...ep[0]); g.lineTo(...ep[1]); g.stroke();
  /* carburettor: venturi and throttle butterfly */
  const vx=bx+bw*0.16, vy=ip[0][1]; g.fillStyle=C.casing; g.fillRect(vx-cw*0.25,vy-pw*1.5,cw*0.5,pw*0.9); g.fillRect(vx-cw*0.25,vy+pw*0.6,cw*0.5,pw*0.9);
  const ta=(1-S.thr)*1.2+0.15; line(g,vx+cw*0.15-Math.cos(ta)*pw*0.5,vy-Math.sin(ta)*pw*0.5,vx+cw*0.15+Math.cos(ta)*pw*0.5,vy+Math.sin(ta)*pw*0.5,'#DDE4EA',2);
  if(S.ice&&!S.heat){ g.fillStyle='rgba(235,245,255,.9)'; for(let i=0;i<4;i++){ dot(g,vx-cw*0.18+i*cw*0.1,vy-pw*0.55,2.4,'rgba(235,245,255,.9)'); dot(g,vx-cw*0.15+i*cw*0.1,vy+pw*0.55,2.4,'rgba(235,245,255,.9)'); } }
  if(!sm||deepOn()) lab(g,vx,vy-pw*1.5-10,L(S.ice&&!S.heat?t2('carburettor: ice!','forgasser: is!'):t2('carburettor + throttle','forgasser + gass')),S.ice&&!S.heat?'#DDEBFF':C.mut);
  lab(g,bx+bw*0.86,vy-pw-8,'EGT '+nf(M.egt,0)+' °C',tcol(on?Te:Tin));
  /* cylinder with fins */
  g.fillStyle=C.casing; rr(g,cx-cw/2-8,yT-6,cw+16,ch+8,6); g.fill(); g.strokeStyle=C.edge; g.lineWidth=1; g.stroke();
  for(let i=0;i<7;i++){ const y=yT+i*ch/7; line(g,cx-cw/2-16,y,cx-cw/2-8,y,'rgba(214,226,236,.25)',2); line(g,cx+cw/2+8,y,cx+cw/2+16,y,'rgba(214,226,236,.25)',2); }
  g.fillStyle='#0d1318'; g.fillRect(cx-cw/2,yT,cw,ch);
  /* gas in the cylinder */
  g.fillStyle=tcol(gasK,on?0.9:0.5); g.fillRect(cx-cw/2,yT,cw,py-yT);
  if(on&&stroke===2&&sf<0.25&&!reduce){ const gr=g.createRadialGradient(cx,yT+head*0.4,2,cx,yT+head*0.4,cw*0.7); gr.addColorStop(0,'rgba(255,255,240,.95)'); gr.addColorStop(1,'rgba(255,200,120,0)'); g.fillStyle=gr; g.fillRect(cx-cw/2,yT,cw,py-yT); }
  /* valves */
  const vo=(s)=>stroke===s&&on?Math.sin(sf*Math.PI)*head*0.45:0; for(const [x,o] of [[cx-cw*0.28,vo(0)],[cx+cw*0.28,vo(3)]]){ line(g,x,yT-8,x,yT+o+2,'#C9D2DA',2); line(g,x-cw*0.1,yT+o+2,x+cw*0.1,yT+o+2,'#C9D2DA',3); }
  /* two spark plugs and two magnetos */
  const spark=on&&stroke===2&&sf<0.12;
  for(const [x,s] of [[cx-cw*0.07,-1],[cx+cw*0.07,1]]){ line(g,x,yT-14,x,yT+3,'#E6ECF0',2.5); if(spark) dot(g,x,yT+5,3,'#FFFFFF');
    const mx=cx+s*(cw*0.75+30); g.fillStyle='#1f2a33'; rr(g,mx-18,yT-34,36,16,3); g.fill(); g.strokeStyle=C.edge; g.stroke(); txt(g,s<0?'MAG L':'MAG R',mx,yT-22,spark?C.amb:C.mut,'center',8.5,600); line(g,mx,yT-18,x,yT-14,'rgba(240,196,112,.45)',1,[2,2]); }
  /* piston, rod and crank */
  g.fillStyle='#8E9AA5'; g.fillRect(cx-cw/2+1,py,cw-2,cw*0.32); line(g,cx,py+cw*0.18,pinX,pinY,'#B4BEC7',4);
  dot(g,cx,ccy,cr*1.45,'#1c252e',C.edge,1); line(g,cx,ccy,pinX,pinY,C.lp,5); dot(g,pinX,pinY,3.5,'#DDE4EA'); dot(g,cx,ccy,4,C.lp);
  txt(g,L(t2('crankshaft → propeller','veivaksel → propell')),cx+cr*1.6+6,ccy+4,C.lp,'left',sm?8.5:10,600,SANS);
  /* the four strokes */
  const S4=[t2('1 Intake · suck','1 Innsug · sug'),t2('2 Compression · squeeze','2 Kompresjon · klem'),t2('3 Combustion / power · bang','3 Forbrenning / arbeid · smell'),t2('4 Exhaust · blow','4 Eksos · blås')];
  const lx=sm?bx+6:bx+bw*0.72, ly=sm?by+bh*0.72:yT+ch*0.35;
  S4.forEach((s,i)=>{ const y=ly+i*(sm?15:19), act=on&&i===stroke; if(sm){ txt(g,L(s),(i%2?bx+bw*0.52:bx+6),ly+Math.floor(i/2)*15,act?SC[i+1]:C.dim,'left',9,act?700:500,SANS); }
    else { dot(g,lx,y-4,4,act?SC[i+1]:'transparent',SC[i+1],1.4); txt(g,L(s),lx+10,y,act?SC[i+1]:C.mut,'left',11,act?700:500,SANS); } });
  if(!sm) txt(g,L(t2('slowed down about 100 ×','sakket ned rundt 100 ×')),lx,ly+4*19+2,C.dim,'left',9.5);
  if(!on) tag(g,L(t2('not running','går ikke')),cx,yT+ch*0.5,C.amb,{al:'center'});
}

/* ---------------- gauges ---------------- */
function gauge(g,cx,cy,r,o){ const a0=Math.PI*0.75, a1=Math.PI*2.25, A=v=>a0+(a1-a0)*clamp((v-o.min)/(o.max-o.min),0,1);
  g.fillStyle='#0b1015'; g.beginPath(); g.arc(cx,cy,r*1.06,0,Math.PI*2); g.fill(); g.strokeStyle='rgba(255,255,255,.08)'; g.lineWidth=1; g.stroke();
  g.strokeStyle='rgba(214,226,236,.22)'; g.lineWidth=Math.max(2,r*0.07); g.beginPath(); g.arc(cx,cy,r*0.9,a0,a1); g.stroke();
  (o.arcs||[]).forEach(([lo,hi,col])=>{ g.strokeStyle=col; g.beginPath(); g.arc(cx,cy,r*0.9,A(lo),A(hi)); g.stroke(); });
  if(o.red!=null){ const a=A(o.red); line(g,cx+Math.cos(a)*r*0.72,cy+Math.sin(a)*r*0.72,cx+Math.cos(a)*r*1.02,cy+Math.sin(a)*r*1.02,C.red,Math.max(2.5,r*0.07)); }
  if(o.red2!=null){ const a=A(o.red2); line(g,cx+Math.cos(a)*r*0.75,cy+Math.sin(a)*r*0.75,cx+Math.cos(a)*r*1.0,cy+Math.sin(a)*r*1.0,'rgba(236,90,71,.6)',2,[2,2]); }
  const bad=o.red!=null&&o.v>o.red+1e-6, a=A(o.v), col=bad?C.red:o.warn?C.amb:'#F4F7F9';
  line(g,cx-Math.cos(a)*r*0.12,cy-Math.sin(a)*r*0.12,cx+Math.cos(a)*r*0.8,cy+Math.sin(a)*r*0.8,col,Math.max(2,r*0.06)); dot(g,cx,cy,r*0.08,'#2a3036');
  g.font=`600 ${Math.max(9,r*0.27)}px ${MONO}`; g.fillStyle=col; g.textAlign='center'; g.fillText(o.val,cx+r*0.12,cy+r*0.62); g.textAlign='left';
  txt(g,o.lab,cx,cy+r*1.06+13,C.mut,'center',ST.w<640?9:10,600,SANS); if(o.unit) txt(g,o.unit,cx,cy+r*1.06+25,C.dim,'center',8.5); }
const G_ARC={g:'rgba(113,204,147,.85)',a:'rgba(240,196,112,.9)'};
function gaugeSet(M){ const t=M.type, st=S.mode==='start'&&S.st, f0=v=>nf(v,0), f1=v=>nf(v,1);
  if(t==='pist') return [{lab:'RPM',min:0,max:3000,v:M.rpm,val:f0(M.rpm),arcs:[[2100,2700,G_ARC.g]],red:2700},
    {lab:'MAP',unit:'inHg',min:10,max:35,v:M.map,val:f1(M.map),arcs:[[15,29,G_ARC.g]],red:S.turbo?30:null},
    {lab:'EGT',unit:'°C',min:300,max:850,v:M.egt,val:f0(M.egt),warn:M.rough},
    {lab:'CHT',unit:'°C',min:50,max:300,v:M.cht,val:f0(M.cht),arcs:[[90,240,G_ARC.g],[240,260,G_ARC.a]],red:260},
    {lab:L(t2('FUEL FLOW','DRIVSTOFF')),unit:'L/h',min:0,max:70,v:M.ffl,val:f0(M.ffl)}];
  if(t==='tp') return [{lab:L(t2('TORQUE','MOMENT')),unit:'%',min:0,max:120,v:M.tq,val:f0(M.tq),arcs:[[0,100,G_ARC.g]],red:100},
    {lab:'ITT',unit:'°C',min:200,max:1100,v:M.itt,val:f0(M.itt),arcs:[[400,800,G_ARC.g]],red:st?1000:800,red2:st?null:1000},
    {lab:'Ng',unit:'%',min:0,max:110,v:M.ng,val:f1(M.ng),arcs:[[52,101.5,G_ARC.g]],red:101.5},
    {lab:'Np',unit:'rpm',min:0,max:2200,v:M.np,val:f0(M.np),arcs:[[1600,2000,G_ARC.g]],red:2000},
    {lab:L(t2('FUEL FLOW','DRIVSTOFF')),unit:'kg/h',min:0,max:320,v:M.ffkg,val:f0(M.ffkg)}];
  if(t==='jet') return [{lab:'RPM',unit:'%',min:0,max:110,v:M.n1,val:f1(M.n1),arcs:[[45,100,G_ARC.g]],red:103},
    {lab:'EGT',unit:'°C',min:0,max:900,v:M.egt,val:f0(M.egt),arcs:[[300,700,G_ARC.g]],red:st?650:700},
    {lab:'EPR',min:1,max:3,v:M.epr,val:M.epr.toFixed(2)},
    {lab:L(t2('FUEL FLOW','DRIVSTOFF')),unit:'kg/h',min:0,max:1600,v:M.ffkg,val:f0(M.ffkg)}];
  return [{lab:'N1',unit:'%',min:0,max:110,v:M.n1,val:f1(M.n1),arcs:[[20,100,G_ARC.g]],red:104},
    {lab:'EGT',unit:'°C',min:0,max:1100,v:M.egt,val:f0(M.egt),arcs:[[300,950,G_ARC.g]],red:st?725:950},
    {lab:'N2',unit:'%',min:0,max:110,v:M.n2,val:f1(M.n2),arcs:[[58,103,G_ARC.g]],red:105},
    {lab:L(t2('FUEL FLOW','DRIVSTOFF')),unit:'kg/h',min:0,max:5000,v:M.ffkg,val:f0(M.ffkg)}]; }
function drawGauges(g,b,M){ const [x,y,w,h]=b, set=gaugeSet(M), ph=ST.w<640, rows=ph&&set.length>3?2:1, per=Math.ceil(set.length/rows), gw=w/per, rh=h/rows;
  const r=Math.max(20,Math.min(gw*0.36,(rh-34)/2.2)); set.forEach((o,i)=>{ const row=Math.floor(i/per), col=i%per, n=row===rows-1?set.length-per*(rows-1):per, off=(per-n)*gw/2;
    gauge(g,x+off+gw*(col+0.5),y+row*rh+r*1.08+4,r,o); }); }

/* display values while starting: the start model sets speed and temperature, the gauges follow */
function startModel(){ const s=S.st, t=S.type; const base=model(); const at=atm();
  if(t==='pist'){ const rpm=s.ng*27; return Object.assign({},base,{rpm,map:s.lit?Math.min(at.p*0.02953,12+rpm/1000):at.p*0.02953-0.3*(s.starter?1:0),egt:s.temp,cht:at.Tc+(s.lit?(s.t-s.tFuel)*0.6:0),ffl:s.lit?8:0,hp:s.lit?12:0,frac:s.lit?0.07:0}); }
  if(t==='tp') return Object.assign({},base,{ng:s.ng,itt:s.temp,np:s.lit?Math.max(0,(s.ng-20)/32)*1100:0,tq:s.lit?Math.max(0,(s.ng-30)/22)*6:0,ffkg:s.ff*70,shp:s.lit?30:0,stations:base.stations.map(([k,K])=>[k,k==='in'?K:k==='itt'||k==='burn'?s.temp+273.15+(k==='burn'?150:0):k==='exh'?s.temp+273.15-150:at.T+s.ng*2])});
  const n1=t==='fan'?Math.max(0,(s.ng-12)/46)*20:s.ng;
  return Object.assign({},base,{n1,n2:s.ng,egt:s.temp,epr:1+s.ng/400,ffkg:s.ff*(t==='fan'?300:150),frac:s.lit?0.05:0,stations:base.stations.map(([k,K])=>[k,k==='in'||k==='fan'?at.T:k==='comp'?at.T+s.ng*3:k==='burn'?s.temp+273.15+(s.lit?300:0):s.temp+273.15])}); }

/* ---------------- charts ---------------- */
function chart(g,b,o){ const [x0,y0,w,h]=b, ph=ST.w<640; panel(g,b);
  const pl=x0+(ph?36:46), pr=x0+w-12, pt=y0+(ph?34:40), pb=y0+h-(ph?30:34), X=v=>pl+(v-o.x0)/(o.x1-o.x0)*(pr-pl), Y=v=>pb-(v-o.y0)/(o.y1-o.y0)*(pb-pt);
  txt(g,o.title,x0+10,y0+(ph?15:18),'#C9D2DA','left',ph?10:11,700,SANS); if(o.sub) txt(g,o.sub,x0+10,y0+(ph?27:32),C.dim,'left',ph?8.5:9.5,500,SANS);
  o.yt.forEach(v=>{ line(g,pl,Y(v),pr,Y(v),C.grid,1); txt(g,o.yf?o.yf(v):String(v),pl-5,Y(v)+3.5,C.dim,'right',9); });
  o.xt.forEach(v=>{ txt(g,o.xf?o.xf(v):String(v),X(v),pb+12,C.dim,'center',9); }); txt(g,o.xl,pr,pb+(ph?24:26),C.dim,'right',9,500,SANS);
  g.save(); g.beginPath(); g.rect(pl,pt-4,pr-pl,pb-pt+4); g.clip();
  if(o.shade) o.shade(X,Y,pl,pr,pt,pb);
  o.series.forEach(s=>{ poly(g,s.pts.map(([a,v])=>[X(a),Y(v)]),s.col,s.w||2,s.dash); }); g.restore();
  if(o.mark!=null){ line(g,X(o.mark),pt,X(o.mark),pb,'rgba(244,247,249,.45)',1,[3,3]); }
  o.series.forEach(s=>{ if(!s.lab) return; const p=s.pts[s.lab.i??s.pts.length-1]; if(!p) return; tag(g,s.lab.t,X(p[0])+(s.lab.dx||0),Y(p[1])+(s.lab.dy||0),s.col,{sz:ph?9:10,al:s.lab.al||'right'}); });
  (o.dots||[]).forEach(([a,v,col])=>dot(g,X(a),Y(v),4.5,'#0c1217',col,2));
  return {X,Y,pl,pr,pt,pb}; }

function drawCompare(g,W,H,cl){ const ph=W<640, at=atm(), d=deepOn();
  const A=ph?[8,6,W-16,H*0.3]:[cl||10,8,(W-(cl||10))/2-14,H*0.6], B=ph?[8,H*0.315,W-16,H*0.3]:[A[0]+A[2]+10,8,W-A[0]-A[2]-18,H*0.6];
  /* A: power or thrust left at altitude (at this TAS) */
  const alts=[]; for(let h=0;h<=41000;h+=1000) alts.push(h);
  const ser=TYPES.map(t=>({t,col:TC[t],w:t===S.type?3:1.8,pts:alts.map(h=>[h,E.availFrac(t,h,S.dT,S.tas,S.turbo)*100]).filter(p=>p[1]>0.5&&(t!=='pist'||p[0]<=25000))}));
  ser.forEach(s=>{ const p=s.pts, f={pist:0.92,tp:0.42,jet:0.97,fan:0.72}[s.t], li=Math.min(p.length-1,Math.round((p.length-1)*f)); s.lab={t:L(TN[s.t]),i:li,al:s.t==='fan'?'center':'left',dy:{pist:12,tp:-12,jet:-12,fan:14}[s.t],dx:s.t==='tp'?4:s.t==='jet'?-60:4}; });
  chart(g,A,{title:L(t2('Max power or thrust left at altitude','Største effekt eller skyv igjen i høyden')),sub:L(t2(`% of its own sea-level rating · TAS ${S.tas} kt`,`% av egen rating ved havet · TAS ${S.tas} kt`)),
    x0:0,x1:41000,y0:0,y1:110,xt:[0,10000,20000,30000,40000],xf:v=>v?nf(v/1000,0)+'k':'0',xl:L(t2('altitude (ft)','høyde (ft)')),yt:[0,25,50,75,100],series:ser,mark:S.alt,
    dots:TYPES.map(t=>[S.alt,E.availFrac(t,S.alt,S.dT,S.tas,S.turbo)*100,TC[t]]).filter(p=>p[1]>0.5)});
  /* B: propulsive efficiency against TAS at this altitude */
  const vs=[]; for(let v=0;v<=560;v+=8) vs.push(v);
  const etaOf=(t,v)=>{ const M=E.machOf(v,at.T); return t==='pist'?E.propEta(v,M,55):t==='tp'?E.propEta(v,M,75):E.jetEta(v,t); };
  const ser2=TYPES.filter(t=>t!=='pist'||S.alt<=25000).map((t,i)=>({t,col:TC[t],w:t===S.type?3:1.8,pts:vs.map(v=>[v,etaOf(t,v)*100]).filter(p=>t==='pist'?p[0]<=260:true)}));
  /* crossover propeller ↔ fan */
  let cx=null; for(let v=150;v<=560;v+=2){ if(etaOf('fan',v)>etaOf('tp',v)){ cx=v; break; } }
  ser2.forEach(s=>{ const li=s.t==='pist'?s.pts.length-1:s.t==='tp'?Math.round(s.pts.length*0.62):s.pts.length-1; s.lab={t:L(TN[s.t]),i:li,al:s.t==='tp'?'center':s.t==='pist'?'left':'right',dx:s.t==='pist'?4:0,dy:s.t==='tp'?-12:s.t==='jet'?10:s.t==='fan'?-10:14}; });
  chart(g,B,{title:L(t2('Propulsive efficiency against speed','Propulsiv virkningsgrad mot fart')),sub:L(t2(`how much of the engine's work becomes useful push · ${nf(S.alt,0)} ft`,`hvor mye av motorarbeidet som blir nyttig skyv · ${nf(S.alt,0)} ft`)),
    x0:0,x1:560,y0:0,y1:100,xt:[0,100,200,300,400,500],xl:L(t2('true airspeed (kt)','sann fart (kt)')),yt:[0,25,50,75,100],yf:v=>v+'%',series:ser2,mark:S.tas,
    shade:(X,Y,pl,pr,pt,pb)=>{ if(cx==null) return; g.fillStyle='rgba(127,203,232,.06)'; g.fillRect(pl,pt,X(cx)-pl,pb-pt); g.fillStyle='rgba(201,182,242,.07)'; g.fillRect(X(cx),pt,pr-X(cx),pb-pt);
      txt(g,L(t2('propellers win','propeller vinner')),X(cx)-6,pb-8,'#9FD3EA','right',ph?9:10,600,SANS); txt(g,L(t2('fans win','fan vinner')),X(cx)+6,pb-8,'#D9CCF5','left',ph?9:10,600,SANS); line(g,X(cx),pt,X(cx),pb,'rgba(214,226,236,.35)',1); },
    dots:TYPES.filter(t=>t!=='pist'||(S.alt<=25000&&S.tas<=260)).map(t=>[S.tas,etaOf(t,S.tas)*100,TC[t]])});
  /* the four columns */
  const y0=ph?H*0.635:H*0.64, hh=H-y0-8, cols=ph?2:4, rows=ph?2:1, cw=(W-16-(cols-1)*8)/cols, rh=(hh-(rows-1)*8)/rows;
  TYPES.forEach((t,i)=>{ const cx0=8+(i%cols)*(cw+8), cy0=y0+Math.floor(i/cols)*(rh+8), on=t===S.type, M=model(t), mx=modelMax(t);
    g.fillStyle=on?'rgba(30,40,50,.85)':'rgba(6,9,12,.35)'; rr(g,cx0,cy0,cw,rh,6); g.fill(); g.strokeStyle=on?TC[t]:'rgba(255,255,255,.06)'; g.lineWidth=on?1.5:1; g.stroke();
    g.fillStyle=TC[t]; g.fillRect(cx0,cy0+8,3,rh-16); txt(g,L(TN[t]),cx0+12,cy0+(ph?16:20),TC[t],'left',ph?11:13,700,SANS);
    const lines=compareLines(t,mx,M,at); const lh=ph?13:Math.min(17,(rh-34)/lines.length);
    lines.forEach(([k,v,col],j)=>{ const y=cy0+(ph?30:40)+j*lh; if(y>cy0+rh-4) return; txt(g,k,cx0+12,y,C.mut,'left',ph?8.5:10,500,SANS); txt(g,v,cx0+cw-8,y,col||C.txt,'right',ph?9:10.5,600); }); }); }
function modelMax(t){ const c={alt:S.alt,dT:S.dT,tas:S.tas};
  if(t==='pist') return E.piston(Object.assign(c,{thr:1,rpm:2700,mix:E.bestMix(S.alt,S.dT,S.tas,S.turbo),turbo:S.turbo}));
  if(t==='tp'){ // the most the pilot may set: the lower of the torque and the ITT limit
    let lo=0,hi=1; for(let i=0;i<30;i++){ const m=(lo+hi)/2, r=E.tprop(Object.assign({},c,{pl:m,np:2000,cond:'lo'})); if(r.tq>100||r.itt>800) hi=m; else lo=m; } return E.tprop(Object.assign(c,{pl:lo,np:2000,cond:'lo'})); }
  return E.jet(Object.assign(c,{tl:1}),t); }
function compareLines(t,mx,M,at){ const d=deepOn(), pct=v=>nf(v*100,0)+' %';
  const rows=[];
  if(t==='pist'||t==='tp'){ const kw=mx.kW, sl=t==='pist'?180:850; rows.push([L(t2('max power','maks effekt')),nf(kw,0)+' kW'],[L(t2('of sea-level rating','av rating ved havet')),pct((t==='pist'?mx.hp:mx.shp)/sl),(t==='pist'?mx.hp:mx.shp)/sl<0.6?C.amb:null]); }
  else { rows.push([L(t2('max thrust','maks skyv')),nf(mx.thrust/1000,1)+' kN'],[L(t2('of sea-level rating','av rating ved havet')),pct(mx.frac),mx.frac<0.4?C.amb:null]); }
  if(t==='pist'||t==='tp') rows.push([L(t2('thrust at max','skyv ved maks')),nf(mx.thrust/1000,1)+' kN']);
  rows.push([L(t2('fuel at max','drivstoff ved maks')),nf(mx.ffkg,0)+' kg/h']);
  rows.push([L(t2('propulsive eff.','propulsiv virkn.')),S.tas<5?'—':pct(mx.etaP)]);
  if(d) rows.push([L(t2('overall eff. η₀','total virkn. η₀')),S.tas<5?'—':pct(mx.eta0)]);
  if(t==='pist'&&S.alt>(S.turbo?25000:18000)) rows.push([L(t2('too high for it','for høyt for den')),'!',C.red]);
  return rows; }

/* ratings: take-off rating against OAT, thrust against speed */
function drawRatings(g,W,H,cl){ const ph=W<640, elev=S.alt, ti=E.isa(elev,0).Tc, oat=ti+S.dT;
  const A=ph?[8,6,W-16,H*0.48]:[cl||10,8,(W-(cl||10))/2-14,H-16], B=ph?[8,H*0.5+2,W-16,H*0.5-10]:[A[0]+A[2]+10,8,W-A[0]-A[2]-18,H-16];
  const ts=[]; for(let t=-20;t<=55;t+=1) ts.push(t);
  const fx=E.flex(elev,oat,S.flexT);
  const ser=TYPES.map(t=>({t,col:TC[t],w:t===S.type?3:1.8,dash:t==='jet'?[5,4]:null,pts:ts.map(o=>[o,E.toFrac(t,elev,o,S.turbo)*100])}));
  ser.forEach(s=>{ s.lab={t:L(TN[s.t]),al:'right',dy:{pist:10,tp:-10,jet:12,fan:-12}[s.t]}; });
  const c=chart(g,A,{title:L(t2('Take-off power or thrust against temperature','Startkraft eller -skyv mot temperatur')),sub:L(t2(`static, airport at ${nf(elev,0)} ft · % of sea-level ISA rating`,`stillestående, flyplass i ${nf(elev,0)} ft · % av rating ved havet i ISA`)),
    x0:-20,x1:55,y0:40,y1:110,xt:[-20,0,20,40],xf:v=>v+'°',xl:L(t2('outside air temperature (°C)','utetemperatur (°C)')),yt:[50,60,70,80,90,100],series:ser,mark:oat});
  /* corner, FLEX */
  const X=c.X, Y=c.Y; line(g,X(fx.corner),c.pt,X(fx.corner),c.pb,'rgba(201,182,242,.4)',1,[2,3]); txt(g,L(t2('flat-rating corner','flat rating-hjørne'))+' '+nf(fx.corner,0)+'°',X(fx.corner)+4,c.pb-6,C.lp,'left',ph?8.5:9.5,600,SANS);
  if(S.type==='fan'||S.type==='jet'){ const fc=fx.ok?TC.fan:C.red; line(g,X(S.flexT),c.pt,X(S.flexT),c.pb,fc,1.5); tag(g,'FLEX '+S.flexT+'°',X(S.flexT),c.pt+10,fc,{sz:ph?9:10,al:'center'});
    if(fx.ok){ line(g,X(oat),Y(fx.used*100),X(S.flexT),Y(fx.used*100),fc,1.2,[3,3]); dot(g,X(oat),Y(fx.used*100),5,'#0c1217',fc,2); tag(g,L(t2('FLEX thrust','FLEX-skyv'))+' '+nf(fx.used*100,0)+' %',X(oat)-6,Y(fx.used*100)+14,fc,{sz:ph?9:10,al:'right'}); } }
  if(S.type==='tp'){ const capF=E.toFrac('tp',elev,oat)*100; tag(g,capF>=99.5?L(t2('limited by torque (gearbox)','begrenset av moment (girkasse)')):L(t2('limited by ITT (hot section)','begrenset av ITT (varm del)')),X(oat)+6,Y(capF)-12,TC.tp,{sz:ph?9:10,al:oat>30?'right':'left'}); }
  tag(g,'OAT '+nf(oat,0)+'°',X(oat),c.pb-16,'#F4F7F9',{sz:ph?9:10,al:'center'});
  /* B: thrust against speed at take-off */
  const vs=[]; for(let v=0;v<=250;v+=5) vs.push(v);
  const ser2=TYPES.map(t=>({t,col:TC[t],w:t===S.type?3:1.8,dash:t==='jet'?[5,4]:null,pts:vs.map(v=>[v,E.thrustVsSpeed(t,v)*100])}));
  ser2.forEach(s=>{ s.lab={t:L(TN[s.t]),al:'right',dy:{pist:10,tp:-10,jet:-10,fan:10}[s.t]}; });
  chart(g,B,{title:L(t2('Thrust lapse with speed at take-off power','Skyvfall med fart ved startkraft')),sub:L(t2('% of static thrust, sea level','% av statisk skyv, havnivå')),x0:0,x1:250,y0:0,y1:105,xt:[0,50,100,150,200,250],xl:L(t2('true airspeed (kt)','sann fart (kt)')),yt:[0,25,50,75,100],yf:v=>v+'%',series:ser2,mark:Math.min(S.tas,250)}); }

/* start mode: a time history of speed and temperature */
function drawHist(g,b){ const [x0,y0,w,h]=b, ph=ST.w<640, P=E.SP[S.type]; panel(g,b);
  const pl=x0+30, pr=x0+w-34, pt=y0+42, pb=y0+h-20, span=60, tN=S.hist.length?S.hist[S.hist.length-1][0]:0, t0=Math.max(0,tN-span);
  const X=t=>pl+(t-t0)/span*(pr-pl), Yn=v=>pb-v/110*(pb-pt), tmax=S.type==='tp'?1400:S.type==='pist'?900:1100, Yt=v=>pb-v/tmax*(pb-pt);
  const nl=S.type==='fan'?'N2':S.type==='tp'?'Ng':S.type==='jet'?'N':'RPM/27', tl=S.type==='tp'?'ITT':'EGT';
  txt(g,L(t2('START: LAST 60 S','START: SISTE 60 S')),x0+10,y0+16,'#C9D2DA','left',10,700,SANS);
  txt(g,nl+' %',pl,pt-4,C.hp,'left',9.5,600); txt(g,tl+' °C',pr,pt-4,C.amb,'right',9.5,600);
  line(g,pl,Yt(P.lim),pr,Yt(P.lim),'rgba(236,90,71,.6)',1,[4,3]); if(S.type!=='pist') txt(g,L(t2('start limit ','startgrense '))+P.lim+'°',pr-2,Yt(P.lim)-4,C.red,'right',9);
  line(g,pl,Yn(P.idle),pr,Yn(P.idle),'rgba(127,203,232,.35)',1,[2,3]); txt(g,L(t2('idle','tomgang')),pl+3,Yn(P.idle)-4,C.hp,'left',9);
  if(P.fuelAt){ line(g,pl,Yn(P.fuelAt),pr,Yn(P.fuelAt),'rgba(127,203,232,.2)',1,[1,3]); txt(g,L(t2('fuel on','drivstoff på')),pl+3,Yn(P.fuelAt)-3,C.dim,'left',8.5); }
  const H=S.hist.filter(p=>p[0]>=t0); poly(g,H.map(p=>[X(p[0]),Yn(p[1])]),C.hp,2); poly(g,H.map(p=>[X(p[0]),Yt(p[2])]),C.amb,2);
  for(let t=Math.ceil(t0/10)*10;t<=t0+span;t+=10) txt(g,nf(t,0)+' s',X(t),pb+13,C.dim,'center',8.5); void ph; }

/* ---------------- the figure ---------------- */
function draw(){ if(!ST.w) return; const g=ST.ctx, W=ST.w, H=ST.h; g.setTransform(ST.dpr,0,0,ST.dpr,0,0); g.clearRect(0,0,W,H);
  FS=depth()==='instructor'?1.12:W<420?0.9:1; const ph=W<640;
  if(S.mode==='apart') return drawApart(g,W,H);
  const chip=el('chip'); let cl=0; if(!ph&&chip&&getComputedStyle(chip).position==='absolute'&&chip.offsetWidth) cl=chip.offsetLeft+chip.offsetWidth+10;
  if(S.mode==='cmp') return drawCompare(g,W,H,cl);
  if(S.mode==='rat') return drawRatings(g,W,H,cl);
  const M=S.mode==='start'&&S.st?startModel():model();
  let eng,gau,his=null;
  if(S.mode==='start'){ if(ph){ eng=[4,4,W-8,H*0.36]; gau=[4,H*0.38,W-8,H*0.34]; his=[8,H*0.73,W-16,H*0.27-8]; } else { eng=[cl||8,8,W-(cl||8)-8,H*0.56]; gau=[8,H*0.6,W*0.56,H*0.4-8]; his=[W*0.58,H*0.6,W*0.42-10,H*0.4-10]; } }
  else if(ph){ eng=[4,4,W-8,H*0.5]; gau=[4,H*0.52,W-8,H*0.48-6]; } else { eng=[cl||8,8,W-(cl||8)-8,H*0.6]; gau=[8,H*0.64,W-16,H*0.36-8]; }
  const t=S.type; if(t==='pist') drawPiston(g,eng,M); else if(t==='tp') (S.lay==='dir'?drawTPd:drawTP)(g,eng,M,PH); else if(t==='jet') drawJet(g,eng,M,PH); else drawFan(g,eng,M,PH);
  line(g,gau[0]+8,gau[1]-4,gau[0]+gau[2]-8,gau[1]-4,'rgba(255,255,255,.06)',1);
  drawGauges(g,gau,M); if(his) drawHist(g,his);
  if(S.mode==='how'&&(t==='tp'||t==='fan'||t==='jet')&&!ph){ const lim=limitNote(M); if(lim) tag(g,lim[0],W-12,gau[1]+10,lim[1],{al:'right',sz:11}); }
}
function limitNote(M){ if(M.type==='tp'){ if(M.over.tq) return [L(t2('OVER-TORQUE: reduce power','OVERMOMENT: reduser kraften')),C.red]; if(M.over.itt) return [L(t2('ITT OVER LIMIT: reduce power','ITT OVER GRENSEN: reduser kraften')),C.red];
    if(M.tq>97) return [L(t2('at the torque limit','på momentgrensen')),C.amb]; if(M.itt>785) return [L(t2('at the ITT limit','på ITT-grensen')),C.amb]; }
  return null; }

/* ---------------- animation ---------------- */
let last=0, vis=true; LAB.visible(el('enVp'),v=>{ vis=v; });
function spoolRates(){ const M=S.mode==='start'&&S.st?startModel():model();
  if(S.type==='pist') return [M.rpm/2700,M.rpm/2700];
  if(S.type==='tp') return [M.np/2000,M.ng/100]; if(S.type==='jet') return [M.n1/100,M.n1/100]; return [M.n1/100,M.n2/100]; }
function loop(ts){ requestAnimationFrame(loop); const dt=Math.min(0.1,(ts-last)/1000||0); last=ts;
  let need=false;
  if(S.mode==='start'&&S.st&&(S.st.ph!=='off'||S.st.ng>0.2)){ let k=dt; while(k>0){ const h=Math.min(0.02,k); S.st=E.startStep(S.st,h,S.type,S.fault,S.type==='fan'||S.type==='jet'); k-=h; }
    if(!S.hist.length||S.st.t-S.hist[S.hist.length-1][0]>=0.2) S.hist.push([S.st.t,S.st.ng,S.st.temp]); if(S.hist.length>400) S.hist.shift(); need=true; if(Math.floor(S.st.t*4)!==Math.floor((S.st.t-dt)*4)) { readout(); see(); drawStartBtns(); } }
  if(!vis) return;
  if(S.mode==='apart'&&Math.abs(AP.e-AP.tgt)>0.002){ AP.e=reduce?AP.tgt:AP.e+(AP.tgt-AP.e)*Math.min(1,dt*4.5); if(Math.abs(AP.e-AP.tgt)<0.003) AP.e=AP.tgt; apSync(); need=true; }
  if(!reduce&&S.mode!=='cmp'&&S.mode!=='rat'&&S.mode!=='apart'){ const [a,b]=spoolRates(); PH.a+=dt*a*1.6; PH.b+=dt*b*2.4; PH.flow+=dt*0.25; const M=S.type==='pist'?(S.mode==='start'&&S.st?startModel():model()):null; if(M) PH.crank+=dt*(M.rpm/60)*2*Math.PI/100*(M.hp>2||M.rpm>50?1:0); need=true; }
  if(TOUR.on){ TOUR.t+=dt; need=true; }
  if(need) draw(); }
requestAnimationFrame(loop);

/* ---------------- readout chip, legend, "what you're seeing" ---------------- */
const ch=(i,b,cls)=>`<span><i>${i}</i><b${cls?` class="${cls}"`:''}>${b}</b></span>`;
function readout(){ const d=deepOn(); let h='';
  if(S.mode==='apart'){ el('chip').innerHTML=''; const v=VIEWS.find(v=>v[0]===S.mode); el('xsv').textContent=L(v[1])+' · '+L(TN[S.type]); return; }
  if(S.mode==='how'){ const M=model(), at=atm();
    if(M.type==='pist') h=ch(L(t2('Power','Effekt')),nf(M.hp,0)+' hp · '+nf(M.hp/1.8,0)+' %')+ch(L(t2('Fuel flow','Drivstoff')),nf(M.ffl,0)+' L/h')+ch(L(t2('Mixture','Blanding')),M.lam<0.97?L(t2('lean of peak','magert av topp')):M.lam<1.04?L(t2('peak EGT','topp-EGT')):M.lam<1.33?L(t2('rich of peak','rikt av topp')):L(t2('very rich','svært rik')),M.rough?'r':'')+(d?ch('BSFC',nf(M.bsfc,0)+' g/kWh'):'')+ch(L(t2('Thrust','Skyv')),nf(M.thrust/1000,2)+' kN');
    else if(M.type==='tp') h=ch(L(t2('Shaft power','Akselkraft')),nf(M.shp,0)+' shp',M.over.tq?'r':'')+ch(L(t2('Limit here','Grense her')),M.limit==='tq'?L(t2('torque','moment')):'ITT',M.limit==='itt'?'a':'')+ch(L(t2('Fuel flow','Drivstoff')),nf(M.ffkg,0)+' kg/h')+(d?ch('SFC',nf(E.gkWh(M.ffkg,M.kW),0)+' g/kWh'):'')+ch(L(t2('Thrust','Skyv')),nf(M.thrust/1000,1)+' kN',M.thrust<0?'a':'');
    else h=ch(L(t2('Thrust','Skyv')),nf(M.thrust/1000,1)+' kN')+ch(L(t2('Max here','Maks her')),nf(M.tmax/1000,1)+' kN · '+nf(M.tmax/((M.type==='fan'?120:15)*10),0)+' %')+ch(L(t2('Fuel flow','Drivstoff')),nf(M.ffkg,0)+' kg/h')+(d?ch('TSFC',nf(E.mgNs(M.ffkg,M.thrust),1)+' g/kN·s'):'')+ch('Mach',M.M.toFixed(2));
    if(d) h+=ch('OAT',nf(at.Tc,0)+' °C · ISA '+sg(S.dT)); }
  else if(S.mode==='cmp'){ const at=atm(), M=E.machOf(S.tas,at.T); h=ch(L(t2('Altitude','Høyde')),nf(S.alt,0)+' ft')+ch('TAS',S.tas+' kt · M '+M.toFixed(2))+ch(L(t2('Density','Tetthet')),nf(at.sigma*100,0)+' % '+L(t2('of SL','av havet')));
    let best=null,bv=-1; for(const t of ['tp','jet','fan']){ const e=t==='tp'?E.propEta(S.tas,M,75):E.jetEta(S.tas,t); if(e>bv){ bv=e; best=t; } } if(S.tas>20) h+=ch(L(t2('Best push per fuel','Best skyv per drivstoff')),L(TN[best]),'g'); }
  else if(S.mode==='start'){ const s=S.st, P=E.SP[S.type], nm=S.type==='tp'?'ITT':'EGT';
    h=ch(L(t2('Phase','Fase')),phaseName(s),s.ph==='dry'||s.msg?'a':s.ph==='run'?'g':'')+ch(L(t2('Starter · fuel','Starter · drivstoff')),(s.starter?'ON':'off')+' · '+(s.fuel?'ON':'off'))+ch(L(t2('Peak ','Topp '))+nm,nf(s.peak,0)+' °C',s.peak>P.lim?'r':s.peak>P.lim-60?'a':'');
    if(s.over>0) h+=ch(L(t2('Over the limit','Over grensen')),nf(s.over,1)+' s','r'); }
  else { const elev=S.alt, ti=E.isa(elev,0).Tc, oat=ti+S.dT, fx=E.flex(elev,oat,S.flexT);
    h=ch('OAT',nf(oat,0)+' °C')+ch(L(t2('Corner (ISA+15)','Hjørne (ISA+15)')),nf(fx.corner,0)+' °C')+ch('TOGA',nf(fx.toga*100,0)+' %')+ch('FLEX '+S.flexT+'°',fx.ok?nf(fx.used*100,0)+' % · −'+nf(fx.red*100,0)+' %':L(t2('not allowed','ikke tillatt')),fx.ok?'g':'r'); }
  el('chip').innerHTML=h; const v=VIEWS.find(v=>v[0]===S.mode); el('xsv').textContent=(v?L(v[1]):'')+' · '+L(TN[S.type]); }
function phaseName(s){ const m={off:t2('stopped','stoppet'),crank:t2('cranking','motorerer'),lit:t2('lit, accelerating','tent, akselererer'),run:t2('running at idle','går på tomgang'),dry:t2('dry motoring','tørrmotorering'),abort:t2('stopped','stoppet')}; return L(m[s.ph]||m.off); }
function legend(){ const lg=(c,t,k)=>`<span><i class="${k||''}" style="--c:${c}"></i>${L(t)}</span>`; let s='';
  if(S.mode==='apart') s=[1,2,3,4,5].map(i=>lg(ENGP.SC[i],{en:i+' '+ENGP.SN[i].en,no:i+' '+ENGP.SN[i].no},'a')).join('')+lg('rgba(200,215,225,.5)',t2('engine axis','motorakse'),'d');
  else if(S.mode==='cmp'||S.mode==='rat') s=TYPES.map(t=>lg(TC[t],TN[t],t==='jet'&&S.mode==='rat'?'d':'')).join('')+lg('#F4F7F9',S.mode==='rat'?t2('today (OAT, speed)','i dag (OAT, fart)'):t2('you are here','du er her'),'d');
  else { s=`<span><i class="a" style="background:linear-gradient(90deg,${tcol(240)},${tcol(500)},${tcol(900)},${tcol(1300)},${tcol(1800)})"></i>${L(t2('gas temperature: cold → hot','gasstemperatur: kald → varm'))}</span>`;
    if(S.type==='fan') s+=lg(C.lp,t2('LP spool (N1): fan + LP turbine','LP-spole (N1): fan + LP-turbin'))+lg(C.hp,t2('HP spool (N2): compressor + HP turbine','HP-spole (N2): kompressor + HP-turbin'));
    else if(S.type==='tp') s+=lg(C.lp,t2('Np: power turbine + propeller','Np: kraftturbin + propell'))+lg(C.hp,t2('Ng: compressor + its turbine','Ng: kompressor + dens turbin'));
    else if(S.type==='jet') s+=lg(C.hp,t2('one spool: compressor + turbine','én spole: kompressor + turbin'));
    else s+=lg(C.lp,t2('crankshaft','veivaksel')); }
  el('vleg').innerHTML=s; }
function see(){ let t;
  if(S.mode==='how'){ const M=model();
    if(M.type==='pist') t= M.rough? t2('<b>Running rough:</b> the mixture is far too lean or too rich to burn well. Move the mixture back towards peak EGT.','<b>Går ujevnt:</b> blandingen er altfor mager eller rik til å brenne godt. Flytt blandingen tilbake mot topp-EGT.')
      : S.ice&&!S.heat? t2('<b>Carburettor ice:</b> ice in the venturi chokes the air, so MAP (or RPM with a fixed-pitch propeller) falls. Carburettor heat melts it; expect it to get rougher for a moment as the water goes through.','<b>Forgasserising:</b> is i venturien struper luften, så MAP (eller RPM med fast propell) faller. Forgasservarme smelter den; den kan gå ujevnt et øyeblikk når vannet går gjennom.')
      : t2(`<b>What you're seeing:</b> the same cylinder sucks, squeezes, burns and blows in turn, and the crankshaft drives the propeller. Throttle sets MAP, the propeller lever sets RPM. Full throttle gives ${nf(M.mapFull,1)} inHg here: a normally aspirated engine loses power as the air thins.`,`<b>Det du ser:</b> den samme sylinderen suger, klemmer, brenner og blåser etter tur, og veivakselen driver propellen. Gassen setter MAP, propellhendelen setter RPM. Full gass gir ${nf(M.mapFull,1)} inHg her: en motor uten turbo mister effekt når luften blir tynnere.`);
    else if(M.type==='tp') t= M.feather? t2('<b>Feathered:</b> the blades are turned edge-on to the airflow. The propeller stops and gives the least drag: what you want after an engine failure.','<b>Fjæret:</b> bladene er dreid med kanten mot luftstrømmen. Propellen stopper og gir minst motstand: det du vil ha etter motorstans.')
      : M.rev? t2('<b>Reverse:</b> below the flight idle gate the blade angle goes negative (beta range) and the propeller pushes air forward. Only on the ground.','<b>Revers:</b> under flight idle-sperren blir bladvinkelen negativ (beta-området), og propellen skyver luft forover. Bare på bakken.')
      : t2(`<b>What you're seeing:</b> the gas generator (compressor and its turbine, Ng) makes hot gas; a separate <b>free power turbine</b> (Np) takes the work out and drives the propeller through the gearbox. No shaft connects them. You set power by torque and watch ITT: here the ${M.limit==='tq'?'torque (gearbox) limit comes first':'ITT (hot section) limit comes first'}.`,`<b>Det du ser:</b> gassgeneratoren (kompressoren og dens turbin, Ng) lager varm gass; en egen <b>fri kraftturbin</b> (Np) henter ut arbeidet og driver propellen gjennom girkassen. Ingen aksel kobler dem. Du setter kraft etter moment og følger ITT: her kommer ${M.limit==='tq'?'momentgrensen (girkassen) først':'ITT-grensen (den varme delen) først'}.`);
    else if(M.type==='fan') t=t2(`<b>What you're seeing:</b> the fan (N1) pushes most of the air around the core as cold bypass air, and that makes most of the thrust. The core (N2) is a small gas turbine that drives the fan. Thrust here is ${nf(M.thrust/1000,1)} kN of ${nf(M.tmax/1000,1)} kN available: it falls with height and with speed.`,`<b>Det du ser:</b> fanen (N1) skyver det meste av luften rundt kjernen som kald omløpsluft, og den lager det meste av skyvet. Kjernen (N2) er en liten gassturbin som driver fanen. Skyvet her er ${nf(M.thrust/1000,1)} kN av ${nf(M.tmax/1000,1)} kN tilgjengelig: det faller med høyde og med fart.`);
    else t=t2('<b>What you\'re seeing:</b> all the air goes through the core and leaves as one fast, hot jet. Simple and slim, but the fast jet wastes energy at airliner speeds, so it burns much more fuel than a turbofan.','<b>Det du ser:</b> all luften går gjennom kjernen og forlater motoren som én rask, varm stråle. Enkel og slank, men den raske strålen kaster bort energi ved trafikkflyfart, så den bruker mye mer drivstoff enn en turbofan.'); }
  else if(S.mode==='apart') t=deepOn()?t2('<b>Take it apart:</b> slide from assembled to exploded and the engine comes apart along its axis, the way it is built in modules. Every part has the number and colour of its stage, the same as in the other modes. Pick a part to see what it does; the upper half of each module is cut open, the lower half shows the outside.','<b>Ta den fra hverandre:</b> skyv fra sammensatt til sprengskisse, så går motoren fra hverandre langs aksen, slik den er bygd i moduler. Hver del har nummeret og fargen til trinnet sitt, det samme som i de andre modusene. Velg en del for å se hva den gjør; den øvre halvdelen av hver modul er skåret opp, den nedre viser utsiden.'):t2('<b>Take it apart:</b> slide to pull the engine apart. Each part has the number and colour of its stage. Pick a part to see what it does.','<b>Ta den fra hverandre:</b> skyv for å ta motoren fra hverandre. Hver del har nummeret og fargen til trinnet sitt. Velg en del for å se hva den gjør.');
  else if(S.mode==='cmp') t=t2('<b>Read it like this:</b> left, how much each engine has left as you climb (the piston loses it fastest, the flat-rated turboprop and fans hold on longer). Right, how well each turns its work into push at each speed: propellers win low and slow, fans win high and fast.','<b>Les det slik:</b> til venstre, hvor mye hver motor har igjen når du stiger (stempelmotoren mister det fortest, den flat-ratede turbopropen og fanene holder lenger). Til høyre, hvor godt hver gjør arbeidet om til skyv ved hver fart: propeller vinner lavt og sakte, fan vinner høyt og fort.');
  else if(S.mode==='start'){ const s=S.st, P=E.SP[S.type], tp=S.type==='tp';
    t= s.msg==='hot'? t2('<b>Hot start:</b> too much fuel for the air (a weak starter or a tailwind into the exhaust): the temperature raced towards the limit. The FADEC cut the fuel and is blowing cold air through.','<b>Varm start:</b> for mye drivstoff i forhold til luften (svak starter eller medvind inn i eksosen): temperaturen løp mot grensen. FADEC kuttet drivstoffet og blåser kald luft gjennom.')
     : s.msg==='hung'? t2('<b>Hung start:</b> it lit, but the speed stopped short of idle while the temperature crept up. The engine cannot accelerate on its own yet. Start aborted.','<b>Hengende start:</b> den tente, men turtallet stoppet før tomgang mens temperaturen krøp oppover. Motoren klarer ikke å akselerere selv ennå. Starten avbrutt.')
     : s.msg==='wet'? t2('<b>Wet start (no light-off):</b> fuel went in but did not light. Cut the fuel and dry motor to blow the fuel out, or the next light-off can torch.','<b>Våt start (ingen tenning):</b> drivstoff kom inn, men tente ikke. Kutt drivstoffet og tørrmotorer for å blåse det ut, ellers kan neste tenning gi stikkflamme.')
     : tp&&s.lit&&s.temp>900&&s.ph==='lit'? t2('<b>ITT is racing up.</b> Nothing will stop it for you on this engine: condition lever to CUT-OFF now, keep the starter running to cool it.','<b>ITT stiger raskt.</b> Ingenting stopper den for deg på denne motoren: kondisjonshendel til CUT-OFF nå, la starteren gå for å kjøle.')
     : s.over>0&&s.ph!=='lit'? t2(`<b>Limit exceeded:</b> the start temperature was above ${P.lim} °C for ${nf(s.over,1)} s. On a real engine this means a log-book entry and an inspection of the hot section.`,`<b>Grensen overskredet:</b> starttemperaturen var over ${P.lim} °C i ${nf(s.over,1)} s. På en virkelig motor betyr det en innføring i loggboka og inspeksjon av den varme delen.`)
     : s.ph==='run'? t2('<b>Stable at idle.</b> The starter has cut out and the engine runs on its own power.','<b>Stabil på tomgang.</b> Starteren har koblet ut, og motoren går på egen kraft.')
     : S.type==='pist'? t2('<b>Piston start:</b> mixture rich, throttle cracked open, magnetos on, starter. It fires within a few turns. Then check oil pressure within about 30 seconds.','<b>Stempelstart:</b> blanding rik, gassen litt åpen, magneter på, starter. Den tenner etter noen få omdreininger. Sjekk deretter oljetrykket innen rundt 30 sekunder.')
     : tp? t2('<b>Manual start:</b> starter on; at about 13 % Ng move the condition lever to LOW IDLE (fuel). Watch ITT: if it heads for 1000 °C, or Ng stops rising, cut the fuel yourself.','<b>Manuell start:</b> starter på; ved rundt 13 % Ng flytter du kondisjonshendelen til LOW IDLE (drivstoff). Følg ITT: går den mot 1000 °C, eller Ng slutter å stige, kutter du drivstoffet selv.')
     : t2('<b>Automatic start:</b> the starter turns the core; the FADEC adds ignition and fuel at the right speed, watches the light-off and the temperature, and cuts out the starter. It aborts a bad start by itself.','<b>Automatisk start:</b> starteren dreier kjernen; FADEC legger til tenning og drivstoff ved riktig turtall, følger tenningen og temperaturen, og kobler ut starteren. Den avbryter en dårlig start selv.'); }
  else t=t2('<b>Read it like this:</b> below the corner temperature a flat-rated engine gives its full rating (it is limited on purpose, by torque or by thrust). Above it the hot-section temperature limit takes over and the rating falls. FLEX tells a jet to give the thrust it would give on a hotter day: less wear, same safe take-off.','<b>Les det slik:</b> under hjørnetemperaturen gir en flat-rated motor full rating (den er begrenset med vilje, av moment eller skyv). Over den tar temperaturgrensen i den varme delen over, og ratingen faller. FLEX ber en jetmotor gi skyvet den ville gitt på en varmere dag: mindre slitasje, like trygg avgang.');
  el('xsee').innerHTML=L(t); }

/* ---------------- tabs, engine choice ---------------- */
const VIEWS=[['how',t2('How it works','Slik virker den')],['apart',t2('Take it apart','Ta den fra hverandre')],['cmp',t2('Compare the four','Sammenlign de fire')],['start',t2('Start the engine','Start motoren')],['rat',t2('Ratings and limits','Rating og grenser'),1]];
function drawTabs(){ el('vtabs').innerHTML=VIEWS.map(([k,t,dp])=>`<button type="button" role="tab" data-v="${k}" class="${dp?'dp ':''}${k===S.mode?'on':''}" aria-selected="${k===S.mode}">${L(t)}</button>`).join('');
  el('vtools').innerHTML=TYPES.map(t=>`<button type="button" data-t="${t}" class="${t===S.type?'on':''}" aria-pressed="${t===S.type}">${L(TN[t])}</button>`).join(''); }
el('vtabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setMode(b.dataset.v); });
el('vtools').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setType(b.dataset.t); });
function setMode(m){ if(!VIEWS.some(v=>v[0]===m)) m='how'; if(m==='rat'&&!deepOn()) m='how'; const prev=S.mode; S.mode=m;
  el('xpanel').querySelectorAll('[data-pv]').forEach(d=>{ d.hidden=!d.dataset.pv.split(' ').includes(m); });
  const ap=m==='apart'; el('enVp').classList.toggle('apart',ap); document.body.classList.toggle('ap-wide',ap); el('apBar').hidden=!ap; el('apSide').hidden=!ap; cv.tabIndex=ap?0:-1; cv.style.cursor='';
  if(ap&&prev!=='apart'){ AP.e=reduce?1:0; AP.tgt=1; } if(ap) apSide(); apSync();
  if(m==='cmp'&&prev!==m&&S.tas<40){ S.tas=220; if(S.alt<5000) S.alt=10000; sl.alt&&sl.alt.set(S.alt); sl.tas&&sl.tas.set(S.tas); }
  if(m==='start'&&!S.st) resetStart(); el('wxS').textContent=L(m==='rat'?t2('Airport','Flyplass'):t2('Conditions','Forhold')); syncWx(); drawTabs(); upd(); }
function setType(t){ if(!TYPES.includes(t)) return; if(t!==S.type) AP.sel=null; S.type=t; if(S.mode==='apart') setTimeout(apSide); TYPES.forEach(x=>document.body.classList.toggle('et-'+x,x===t)); typeSeg.set(t); buildLevers(); resetStart(); drawFaults(); drawTabs(); upd(); }
const typeSeg=LAB.seg(el('typeSeg'),TYPES.map(t=>[t,TN[t].en]),S.type,v=>setType(v));

/* ---------------- controls ---------------- */
LAB.add({},{'Throttle':'Gass','Propeller lever (RPM)':'Propellhendel (RPM)','Mixture':'Blanding','Power lever':'Krafthendel','Propeller lever (Np)':'Propellhendel (Np)','Thrust lever':'Gasshendel',
  'Altitude':'Høyde','Piston':'Stempel','None':'Ingen','Hot start':'Varm start','Hung start':'Hengende start','Wet start':'Våt start','Airport elevation':'Flyplasshøyde','Temperature vs ISA':'Temperatur mot ISA','True airspeed':'Sann fart','FLEX (assumed) temperature':'FLEX-temperatur (antatt)'});
const sl={};
function buildLevers(){ const b=el('levCtl'); b.innerHTML=''; const t=S.type;
  if(t==='pist'){ sl.thr=LAB.slider(b,{label:'Throttle',min:0,max:1,step:0.01,v:S.thr,f:v=>v<0.02?L(t2('idle','tomgang')):v>0.98?L(t2('full','fullt')):nf(v*100,0)+' %',on:v=>{ S.thr=v; upd(); }});
    sl.rpm=LAB.slider(b,{label:'Propeller lever (RPM)',min:2000,max:2700,step:50,v:S.rpm,f:v=>v+' rpm',on:v=>{ S.rpm=v; upd(); }});
    sl.mix=LAB.slider(b,{label:'Mixture',min:0,max:1,step:0.01,v:S.mix,f:v=>v>0.98?L(t2('full rich','full rik')):v<0.02?L(t2('leanest','magrest')):nf(v*100,0)+' %',on:v=>{ S.mix=v; upd(); }}); }
  else if(t==='tp'){ sl.pl=LAB.slider(b,{label:'Power lever',min:-0.3,max:1,step:0.01,v:S.pl,f:v=>v<-0.01?L(t2('reverse','revers'))+' '+nf(-v/0.3*100,0)+' %':v<0.02?L(t2('idle','tomgang')):nf(v*100,0)+' %',on:v=>{ S.pl=v; upd(); }});
    sl.np=LAB.slider(b,{label:'Propeller lever (Np)',min:1500,max:2000,step:50,v:S.np,f:v=>v<1550?L(t2('FEATHER','FJÆR')):v+' rpm',on:v=>{ S.np=v; upd(); }}); }
  else sl.tl=LAB.slider(b,{label:'Thrust lever',min:0,max:1,step:0.01,v:S.tl,f:v=>v<0.02?'IDLE':v>0.98?(t==='fan'?'TOGA':'MAX'):nf(v*100,0)+' %',on:v=>{ S.tl=v; upd(); }}); }
const condSeg=LAB.seg(el('condSeg'),[['cut','Cut-off'],['lo','Low idle'],['hi','High idle']],S.cond,v=>{ S.cond=v; upd(); });
el('heatChk').addEventListener('change',e=>{ S.heat=e.target.checked; upd(); });
el('turboChk').addEventListener('change',e=>{ S.turbo=e.target.checked; upd(); });
el('iceChk').addEventListener('change',e=>{ S.ice=e.target.checked; upd(); });
el('stnChk').addEventListener('change',e=>{ S.stn=e.target.checked; upd(); });
const laySeg=LAB.seg(el('laySeg'),[['rev','Reverse flow (most common in small turboprops)'],['dir','Direct flow (common on larger regional turboprops)']],S.lay,v=>setLay(v));
function setLay(v){ if(v!==S.lay){ TOUR.i=0; tourPlay(false); } S.lay=v==='dir'?'dir':'rev'; ENGP.layout(S.lay); laySeg.set(S.lay); layHint(); if(AP.sel&&!ENGP.part(S.type,AP.sel)) AP.sel=null; if(S.mode==='apart') apSide(); upd(); }
function layHint(){ el('layH').innerHTML=L(S.lay==='dir'
  ?t2('<b>Direct flow:</b> the air goes straight from the intake at the front to the exhaust at the back, with no turns: a longer engine, but a simple gas path that suits bigger, more powerful turboprops.','<b>Direkte strøm:</b> luften går rett fra inntaket foran til eksosen bak, uten å snu: en lengre motor, men en enkel gassvei som passer større og kraftigere turboproper.')
  :t2('<b>Reverse flow:</b> the air enters at the back and turns forward, so the engine is short, the inlet sits away from stones and debris thrown up near the propeller, and the hot section is easy to reach for inspection.','<b>Motstrøm:</b> luften kommer inn bak og snur forover, så motoren blir kort, innløpet sitter unna stein og rusk som virvles opp ved propellen, og den varme delen er lett å komme til for inspeksjon.')); }
el('leanBtn').addEventListener('click',()=>{ S.mix=E.peakMix({alt:S.alt,dT:S.dT,tas:S.tas,thr:S.thr,rpm:S.rpm,turbo:S.turbo,heat:S.heat,ice:S.ice}); sl.mix&&sl.mix.set(S.mix); upd(); });
sl.alt=LAB.slider(el('wxCtl'),{label:'Altitude',min:0,max:41000,step:500,v:S.alt,f:v=>nf(v,0)+' ft',on:v=>{ S.alt=v; upd(); }});
sl.dT=LAB.slider(el('wxCtl'),{label:'Temperature vs ISA',min:-30,max:40,step:1,v:S.dT,f:v=>'ISA '+sg(v)+' °C · OAT '+nf(E.isa(S.alt,v).Tc,0)+' °C',on:v=>{ S.dT=v; upd(); }});
sl.tas=LAB.slider(el('wxCtl'),{label:'True airspeed',min:0,max:520,step:5,v:S.tas,f:v=>v+' kt',on:v=>{ S.tas=v; upd(); }});
function syncWx(){ const lab=sl.alt.el.querySelector('label span'); if(lab) lab.textContent=L(S.mode==='rat'?t2('Airport elevation','Flyplasshøyde'):t2('Altitude','Høyde')); sl.dT.set(S.dT); }
sl.flex=LAB.slider(el('ratCtl'),{label:'FLEX (assumed) temperature',min:0,max:75,step:1,v:S.flexT,f:v=>v+' °C',on:v=>{ S.flexT=v; upd(); }});
function syncCtl(){ for(const k of ['thr','rpm','mix','pl','np','tl']) if(sl[k]&&document.contains(sl[k].el)) sl[k].set(S[k]); sl.alt.set(S.alt); sl.dT.set(S.dT); sl.tas.set(S.tas); sl.flex.set(S.flexT); condSeg.set(S.cond);
  laySeg.set(S.lay); ENGP.layout(S.lay); layHint(); el('heatChk').checked=S.heat; el('turboChk').checked=S.turbo; el('iceChk').checked=S.ice; el('stnChk').checked=S.stn; }
/* scenarios */
const PRE=[['to',t2('Take-off, sea level','Avgang, havnivå'),{alt:0,dT:0,tas:0,thr:1,mix:1,rpm:2700,pl:0.86,np:2000,tl:1,cond:'lo'}],
  ['hot',t2('Hot and high','Varmt og høyt'),{alt:6000,dT:25,tas:0,thr:1,mix:0.7,rpm:2700,pl:1,np:2000,tl:1,cond:'lo'}],
  ['crp',t2('Piston cruise 8 000 ft','Stempel, marsj 8 000 ft'),{type:'pist',mode:'how',alt:8000,dT:0,tas:115,thr:1,rpm:2400,mix:1}],
  ['crt',t2('Turboprop cruise FL250','Turboprop, marsj FL250'),{type:'tp',mode:'how',alt:25000,dT:0,tas:280,pl:1,np:1700,cond:'lo'}],
  ['crf',t2('Turbofan cruise FL370','Turbofan, marsj FL370'),{type:'fan',mode:'how',alt:37000,dT:0,tas:460,tl:0.9}],
  ['ice',t2('Carburettor ice','Forgasserising'),{type:'pist',mode:'how',alt:3000,dT:-5,tas:100,thr:0.65,rpm:2300,mix:1,ice:true,heat:false}]];
function drawPre(){ el('pre').innerHTML=PRE.map(([k,t])=>`<button type="button" class="btn sm" data-p="${k}">${L(t)}</button>`).join(''); }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const p=PRE.find(x=>x[0]===b.dataset.p); if(p) setS(p[2]); });
function setS(o){ o=Object.assign({},o); const ty=o.type, m=o.mode; delete o.type; delete o.mode; Object.assign(S,o); if(ty&&ty!==S.type) setType(ty); else buildLevers(); if(m) setMode(m); syncCtl(); upd(); }

/* start controls */
const FAULTS=[['none','None'],['hot','Hot start'],['hung','Hung start'],['wet','Wet start']];
let faultSeg=null; function drawFaults(){ el('faultSeg').innerHTML=''; el('faultSeg').classList.remove('seg'); faultSeg=LAB.seg(el('faultSeg'),FAULTS,S.fault,v=>{ S.fault=v; resetStart(); upd(); }); }
function resetStart(){ S.st=E.startInit(E.isa(S.alt,S.dT).Tc); S.hist=[]; drawStartBtns(); }
function drawStartBtns(){ const s=S.st||E.startInit(15), t=S.type, B=(k,lab,pri,dis)=>`<button type="button" class="btn sm${pri?' pri':''}" data-a="${k}" ${dis?'disabled':''}>${L(lab)}</button>`; let h='';
  const idle=s.ph==='off'||s.ph==='abort';
  if(t==='tp') h=B('start',t2('Starter ON','Starter PÅ'),idle,!idle)+B('fuel',t2('Condition lever: LOW IDLE','Kondisjonshendel: LOW IDLE'),s.ph==='crank'&&!s.fuel,!(s.ph==='crank'&&!s.fuel))+B('cut',t2('CUT-OFF','CUT-OFF'),s.fuel&&s.lit&&s.temp>900,!s.fuel)+B('reset',t2('Reset','Nullstill'));
  else if(t==='pist') h=B('start',t2('Start (mags on)','Start (magneter på)'),idle,!idle)+B('reset',t2('Reset','Nullstill'));
  else h=B('start',t2('Auto start','Autostart'),idle,!idle)+B('cut',t2('Master OFF','Master AV'),false,!s.fuel&&!s.starter)+B('reset',t2('Reset','Nullstill'));
  const box=el('stBtns'); if(box.dataset.h!==h){ box.innerHTML=h; box.dataset.h=h; }
  el('stH').textContent=L(t==='tp'?t2('Manual start: you watch ITT and Ng, and you cut the fuel.','Manuell start: du følger ITT og Ng, og du kutter drivstoffet.'):t==='pist'?t2('Mixture rich, throttle cracked, then start.','Blanding rik, gassen litt åpen, så start.'):t2('Automatic (FADEC) start: it protects the engine for you.','Automatisk (FADEC) start: den beskytter motoren for deg.')); }
el('stBtns').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const a=b.dataset.a;
  if(a==='reset'){ resetStart(); upd(); return; } if(a==='start'&&(S.st.ph==='abort'||S.st.ph==='off')) { S.st.t=S.st.t||0; }
  S.st=E.startAct(S.st,a==='cut'&&S.type!=='tp'?'stop':a,S.type); drawStartBtns(); upd(); });

function upd(){ readout(); legend(); see(); drawStartBtns(); tourUI(); draw(); }

/* ---------------- Take it apart: exploded view (drawing in engparts.js) ---------------- */
const AP={e:0,tgt:1,sel:null,hov:null};
function drawApart(g,W,H){ ENGP.draw(g,W,H,{type:S.type,e:AP.e,sel:AP.sel,hov:AP.hov,L,FS});
  if(W>=640){ const sd=el('apSide'); if(sd) sd.style.maxHeight=cv.clientHeight+'px'; } }
function apSync(){ const r=el('apEx'); if(r&&document.activeElement!==r) r.value=Math.round(AP.e*100); const b=el('apBtn'); if(b) b.textContent=L(AP.tgt>0.5?t2('Assemble','Sett sammen'):t2('Explode','Ta fra hverandre')); }
function apSel(id,focus){ AP.sel=id||null; apSide(); draw(); if(focus&&id){ const b=el('apList').querySelector(`[data-p="${id}"]`); if(b) b.focus(); } }
function apSide(){ const list=ENGP.parts(S.type), p=AP.sel&&ENGP.part(S.type,AP.sel), d=deepOn();
  layHint(); el('apLay').innerHTML=S.type!=='tp'?'':`<h5>${L(t2('Layout','Oppbygning'))}</h5><div class="b">${[['rev',t2('Reverse flow (most common in small turboprops)','Motstrøm (vanligst i små turboproper)')],['dir',t2('Direct flow (common on larger regional turboprops)','Direkte strøm (vanlig på større regionale turboproper)')]].map(([k,t])=>`<button type="button" data-lay="${k}" aria-pressed="${S.lay===k}" class="${S.lay===k?'on':''}">${L(t)}</button>`).join('')}</div><p>${el('layH').innerHTML}</p>`;
  const stg=st=>`<span class="apst" style="--c:${ENGP.SC[st]}"><b>${st}</b>${L(ENGP.SN[st])}</span>`;
  el('apCard').innerHTML=p?`<div class="aph"><h4>${L(p.n)}</h4><button type="button" class="apx" data-x="1" aria-label="${L(t2('Clear selection','Fjern valget'))}">×</button></div>${stg(p.st)}<p>${L(p.d)}</p><p class="apf"><i>${L(t2('Key fact','Nøkkelfakta'))}</i>${L(p.f)}</p>${d?`<p class="apf dp"><i>${L(t2('Deep dive','Dypdykk'))}</i>${L(p.x)}</p>`:''}`
    :`<h4>${L(t2('Pick a part','Velg en del'))}</h4><p>${L(t2('Tap a part in the drawing or in the list (Tab, then the arrow keys, work too). Each part has the number and colour of its stage:','Trykk på en del i tegningen eller i lista (Tab og så piltastene virker også). Hver del har nummeret og fargen til trinnet sitt:'))}</p><div class="apsts">${[1,2,3,4,5].map(stg).join('')}</div>`;
  el('apLH').textContent=L(t2('Parts','Deler'))+' · '+list.length;
  el('apList').innerHTML=list.map((q,i)=>`<li><button type="button" data-p="${q.id}" aria-pressed="${q.id===AP.sel}" class="${q.id===AP.sel?'on':''}" style="--c:${ENGP.SC[q.st]}" tabindex="${(AP.sel?q.id===AP.sel:i===0)?0:-1}"><span class="k">${q.letter}</span><span class="nm">${L(q.n)}</span><span class="sn" aria-label="${L(t2('stage','trinn'))} ${q.st}">${q.st}</span></button></li>`).join(''); }
el('apLay').addEventListener('click',e=>{ const b=e.target.closest('button[data-lay]'); if(b){ setLay(b.dataset.lay); const n=el('apLay').querySelector(`[data-lay="${b.dataset.lay}"]`); if(n) n.focus(); } });
el('apList').addEventListener('click',e=>{ const b=e.target.closest('button[data-p]'); if(b) apSel(AP.sel===b.dataset.p?null:b.dataset.p,true); });
el('apCard').addEventListener('click',e=>{ if(e.target.closest('[data-x]')){ const id=AP.sel; apSel(null); const b=el('apList').querySelector(`[data-p="${id}"]`); if(b) b.focus(); } });
function apStep(dir,focus){ const list=ENGP.parts(S.type), i=list.findIndex(q=>q.id===AP.sel); const n=i<0?(dir>0?0:list.length-1):(i+dir+list.length)%list.length; apSel(list[n].id,focus); }
el('apList').addEventListener('keydown',e=>{ const k=e.key; if(k==='ArrowDown'||k==='ArrowRight'){ e.preventDefault(); apStep(1,true); } else if(k==='ArrowUp'||k==='ArrowLeft'){ e.preventDefault(); apStep(-1,true); }
  else if(k==='Home'||k==='End'){ e.preventDefault(); const l=ENGP.parts(S.type); apSel(l[k==='Home'?0:l.length-1].id,true); } else if(k==='Escape'){ apSel(null); } });
cv.addEventListener('keydown',e=>{ if(S.mode!=='apart') return; const k=e.key; if(k==='ArrowRight'||k==='ArrowDown'){ e.preventDefault(); apStep(1); } else if(k==='ArrowLeft'||k==='ArrowUp'){ e.preventDefault(); apStep(-1); } else if(k==='Escape') apSel(null); });
const cvXY=e=>{ const r=cv.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; };
cv.addEventListener('click',e=>{ if(S.mode!=='apart') return; const id=ENGP.hit(...cvXY(e)); apSel(id&&id!==AP.sel?id:null); });
cv.addEventListener('pointermove',e=>{ if(S.mode!=='apart'||e.pointerType==='touch') return; const id=ENGP.hit(...cvXY(e)); cv.style.cursor=id?'pointer':''; if(id!==AP.hov){ AP.hov=id; draw(); } });
cv.addEventListener('pointerleave',()=>{ if(AP.hov){ AP.hov=null; draw(); } });
el('apEx').addEventListener('input',e=>{ AP.tgt=AP.e=(+e.target.value)/100; apSync(); draw(); });
el('apBtn').addEventListener('click',()=>{ AP.tgt=AP.tgt>0.5?0:1; apSync(); });

/* ---------------- Try it: one task at a time ---------------- */
let ti=0; const ansv={}, done={};
const goModel=()=>{ const t=el('enVp'); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); };
const TASKS=[
 {k:'apart',q:t2('Take the turboprop apart and find the part that drives the propeller. Select it, then press Check.','Ta turbopropen fra hverandre og finn delen som driver propellen. Velg den, og trykk Sjekk.'),
  pre:{type:'tp',mode:'apart'},
  live:()=>{ if(S.type!=='tp'||S.mode!=='apart') return [0,t2('Choose Turboprop and Take it apart.','Velg Turboprop og Ta den fra hverandre.')]; const s=AP.sel;
    if(!s) return [0,t2('Select a part first: in the drawing or in the list.','Velg en del først: i tegningen eller i lista.')];
    if(s==='pt') return [1,t2('Right: the power turbine (stage 4) takes the energy out of the gas and turns the propeller through its own Np shaft and the reduction gearbox. Nothing connects it to the compressor: only the gas.','Riktig: kraftturbinen (trinn 4) henter energien ut av gassen og dreier propellen gjennom sin egen Np-aksel og reduksjonsgiret. Ingenting kobler den til kompressoren: bare gassen.')];
    if(s==='rgb'||s==='tsh') return [0,t2('Close: that part passes the drive on. Which part makes the turning force in the first place?','Nærme: den delen fører drivkraften videre. Hvilken del lager dreiekraften i utgangspunktet?')];
    if(s==='ct') return [0,t2('That turbine drives the compressor (Ng). Look one turbine further forward.','Den turbinen driver kompressoren (Ng). Se én turbin lenger fram.')];
    return [0,t2('Not that one. Follow the gas: after it has been burnt, which part takes its energy and sends it forward to the propeller?','Ikke den. Følg gassen: etter at den er brent, hvilken del tar energien og sender den fram til propellen?')]; }},
 {k:'apart2',q:t2('Take the piston engine apart. Which part makes the high voltage for the spark, even with the master switch off? Select it, then press Check.','Ta stempelmotoren fra hverandre. Hvilken del lager høyspenningen til gnisten, selv med hovedbryteren av? Velg den, og trykk Sjekk.'),
  pre:{type:'pist',mode:'apart'},
  live:()=>{ if(S.type!=='pist'||S.mode!=='apart') return [0,t2('Choose Piston and Take it apart.','Velg Stempel og Ta den fra hverandre.')]; const s=AP.sel;
    if(!s) return [0,t2('Select a part first: in the drawing or in the list.','Velg en del først: i tegningen eller i lista.')];
    if(s==='mag') return [1,t2('Right: the two magnetos (stage 3) are engine-driven generators. Each feeds one of the two plugs in every cylinder, so the ignition needs no battery and has a backup.','Riktig: de to magnetene (trinn 3) er motordrevne generatorer. Hver forsyner én av de to pluggene i hver sylinder, så tenningen trenger ikke batteri og har en reserve.')];
    if(s==='plug') return [0,t2('The plugs only deliver the spark into the cylinder. Where does the high voltage come from? Follow the thin leads.','Pluggene leverer bare gnisten inn i sylinderen. Hvor kommer høyspenningen fra? Følg de tynne ledningene.')];
    return [0,t2('Not that one. Look for the stage 3 parts (combustion), and follow the thin ignition leads.','Ikke den. Se etter delene i trinn 3 (forbrenning), og følg de tynne tenningsledningene.')]; }},
 {k:'four',q:t2('In which stroke of a four-stroke engine does the spark fire, just before top dead centre?','I hvilket takt i en firetaktsmotor tenner gnisten, rett før øvre dødpunkt?'),
  opts:[t2('At the end of compression','På slutten av kompresjonen'),t2('At the start of intake','I starten av innsuget'),t2('In the middle of exhaust','Midt i eksostaktet'),t2('At the end of the power stroke','På slutten av arbeidstaktet')],c:0,pre:{type:'pist',mode:'how',alt:0,dT:0,tas:0,thr:0.7,rpm:2400,mix:1},
  e:t2('The charge is squeezed, the plugs fire just before the piston reaches the top, and the burning gas pushes it down in the power stroke. Two plugs, fed by two independent magnetos, burn it faster and keep it running if one fails.','Ladningen klemmes, pluggene tenner rett før stempelet når toppen, og den brennende gassen presser det ned i arbeidstaktet. To plugger, med hver sin uavhengige magnet, brenner den raskere og holder motoren i gang hvis én svikter.')},
 {k:'lean',q:t2('Piston at 8 000 ft, full throttle, 2 400 rpm. Lean the mixture to peak EGT, then press Check.','Stempelmotor i 8 000 ft, full gass, 2 400 rpm. Len blandingen til topp-EGT, og trykk Sjekk.'),
  pre:{type:'pist',mode:'how',alt:8000,dT:0,tas:115,thr:1,rpm:2400,mix:1,ice:false,heat:false},
  live:()=>{ if(S.type!=='pist'||S.mode!=='how') return [0,t2('Choose Piston and How it works.','Velg Stempel og Slik virker den.')]; if(S.alt<6000) return [0,t2('Climb to about 8 000 ft first.','Stig til rundt 8 000 ft først.')]; const M=model();
    if(M.lam>1.04) return [0,t2(`Still rich of peak (EGT ${nf(M.egt,0)} °C). Pull the mixture back slowly and watch the EGT rise.`,`Fortsatt rikt av topp (EGT ${nf(M.egt,0)} °C). Trekk blandingen sakte tilbake og se EGT stige.`)];
    if(M.lam<0.96) return [0,t2('Past the peak: the EGT is falling again on the lean side. Enrich a little.','Forbi toppen: EGT faller igjen på den magre siden. Gjør den litt rikere.')];
    return [1,t2(`Peak EGT, about ${nf(M.egt,0)} °C. Fuel flow fell from full rich, and the power hardly changed. Most engines are then run about 50 °C rich of peak (or a little lean of it, if approved).`,`Topp-EGT, rundt ${nf(M.egt,0)} °C. Drivstoffstrømmen falt fra full rik, og effekten endret seg nesten ikke. De fleste motorer kjøres så rundt 50 °C rikt av topp (eller litt magert av, hvis godkjent).`)]; }},
 {k:'carb',q:t2('Cruising at 3 000 ft in moist air at +5 °C, the MAP slowly falls. You pull carburettor heat. What do you expect first?','I marsj i 3 000 ft i fuktig luft ved +5 °C faller MAP sakte. Du trekker forgasservarme. Hva venter du deg først?'),
  opts:[t2('A further drop and some roughness, then a rise as the ice melts','Et ytterligere fall og litt ujevn gange, så en økning når isen smelter'),t2('An immediate rise to the old MAP','En umiddelbar økning til gammel MAP'),t2('No change: carb heat only works on the ground','Ingen endring: forgasservarme virker bare på bakken'),t2('The engine stops','Motoren stopper')],c:0,pre:{type:'pist',mode:'how',alt:3000,dT:-5,tas:100,thr:0.65,rpm:2300,mix:1,ice:true,heat:false},
  e:t2('Hot air is less dense (a small power loss) and the melting ice goes through the engine as water. Carburettor icing is most likely between about −10 and +30 °C in humid air, worst at low power.','Varm luft er tynnere (et lite effekttap), og isen som smelter går gjennom motoren som vann. Forgasserising er mest sannsynlig mellom rundt −10 og +30 °C i fuktig luft, verst ved lav effekt.')},
 {k:'tq',q:t2('Turboprop, sea level, ISA, standing still. Set the most power you may use, then press Check.','Turboprop, havnivå, ISA, stillestående. Sett den største kraften du får bruke, og trykk Sjekk.'),
  pre:{type:'tp',mode:'how',alt:0,dT:0,tas:0,pl:0.5,np:2000,cond:'lo'},
  live:()=>{ if(S.type!=='tp'||S.mode!=='how') return [0,t2('Choose Turboprop and How it works.','Velg Turboprop og Slik virker den.')]; if(S.alt>1000||Math.abs(S.dT)>5) return [0,t2('Use sea level and ISA (the first scenario).','Bruk havnivå og ISA (første scenario).')]; const M=model();
    if(M.over.tq||M.over.itt) return [0,t2('Over a limit: on this engine nothing stops you. Bring it back.','Over en grense: på denne motoren stopper ingenting deg. Trekk den tilbake.')];
    if(M.tq<96&&M.itt<785) return [0,t2('More is available. Push the power lever up and watch the torque and ITT.','Mer er tilgjengelig. Skyv krafthendelen fram og følg moment og ITT.')];
    return [1,t2(`Right: torque ${nf(M.tq,0)} % stops you, with ITT ${nf(M.itt,0)} °C still under 800 °C. Low and cool, the turboprop is torque-limited (the gearbox); the gas generator could give more. That is flat rating.`,`Riktig: momentet ${nf(M.tq,0)} % stopper deg, med ITT ${nf(M.itt,0)} °C fortsatt under 800 °C. Lavt og kaldt er turbopropen momentbegrenset (girkassen); gassgeneratoren kunne gitt mer. Det er flat rating.`)]; }},
 {k:'itt',q:t2('Same turboprop at a 6 000 ft airport on an ISA +25 day. Which limit will you meet first as you add power?','Samme turboprop på en flyplass i 6 000 ft en dag med ISA +25. Hvilken grense møter du først når du gir kraft?'),
  opts:[t2('ITT','ITT'),t2('Torque','Moment'),t2('Ng','Ng'),t2('Np','Np')],c:0,pre:{type:'tp',mode:'how',alt:6000,dT:25,tas:0,pl:0.6,np:2000,cond:'lo'},
  e:t2('Hot and high air is thin, so the gas generator must run hotter for the same power. The ITT limit arrives before the torque limit, and the power you get is less than the rating.','Varm og høy luft er tynn, så gassgeneratoren må gå varmere for samme kraft. ITT-grensen kommer før momentgrensen, og kraften du får er lavere enn ratingen.')},
 {k:'lapse',q:t2('A turbofan at FL370 and Mach 0.8 has roughly what share of its sea-level take-off thrust available?','Hvor stor del av startskyvet ved havnivå har en turbofan omtrent tilgjengelig i FL370 og Mach 0,8?'),
  opts:[t2('About a quarter','Rundt en firedel'),t2('About half','Rundt halvparten'),t2('About three quarters','Rundt tre firedeler'),t2('All of it: it is flat rated','Alt: den er flat rated')],c:0,pre:{type:'fan',mode:'how',alt:37000,dT:0,tas:460,tl:1},
  e:t2('The air is about a third as dense, and speed costs a fan thrust as well. That is enough because cruise needs only about a quarter of take-off thrust; drag is low there.','Luften er rundt en tredel så tett, og fart koster også en fan skyv. Det holder, fordi marsj bare trenger rundt en firedel av startskyvet; motstanden er lav der.')},
 {k:'cmp',q:t2('Compare the four: at FL200, which engine type turns its work into push best at 250 kt, and which at 480 kt?','Sammenlign de fire: i FL200, hvilken motortype gjør arbeidet om til skyv best ved 250 kt, og hvilken ved 480 kt?'),
  opts:[t2('Turboprop at 250 kt, turbofan at 480 kt','Turboprop ved 250 kt, turbofan ved 480 kt'),t2('Turbofan at both','Turbofan ved begge'),t2('Turbojet at 480 kt','Turbojet ved 480 kt'),t2('Turboprop at both','Turboprop ved begge')],c:0,pre:{mode:'cmp',alt:20000,dT:0,tas:250},
  e:t2('A propeller accelerates a lot of air a little: very efficient until the blade tips approach the speed of sound. A fan does the same in a duct and keeps working at Mach 0.8. A turbojet only wins well above that.','En propell akselererer mye luft litt: svært effektivt til bladtuppene nærmer seg lydhastigheten. En fan gjør det samme i en kanal og fungerer fortsatt ved Mach 0,8. En turbojet vinner bare godt over det.')},
 {k:'hot',q:t2('Turboprop start with "Hot start" chosen: give it fuel at 13 % Ng, and cut it before ITT passes 1000 °C. Then press Check.','Turbopropstart med «Varm start» valgt: gi drivstoff ved 13 % Ng, og kutt før ITT passerer 1000 °C. Trykk så Sjekk.'),
  pre:{type:'tp',mode:'start',fault:'hot'},
  live:()=>{ const s=S.st; if(S.type!=='tp'||S.mode!=='start') return [0,t2('Choose Turboprop and Start the engine.','Velg Turboprop og Start motoren.')]; if(!s||s.peak<500) return [0,t2('Run the start first: Starter ON, then LOW IDLE at 13 % Ng.','Kjør starten først: Starter PÅ, så LOW IDLE ved 13 % Ng.')];
    if(s.over>0) return [0,t2(`ITT was over 1000 °C for ${nf(s.over,1)} s: too late. Reset and cut earlier, when it is clearly racing up.`,`ITT var over 1000 °C i ${nf(s.over,1)} s: for sent. Nullstill og kutt tidligere, når den tydelig løper oppover.`)];
    if(s.fuel) return [0,t2('Cut the fuel (CUT-OFF) while ITT is still below 1000 °C.','Kutt drivstoffet (CUT-OFF) mens ITT fortsatt er under 1000 °C.')];
    return [1,t2(`Well caught: peak ITT ${nf(s.peak,0)} °C. Keep the starter running to blow cool air through (dry motoring), then find the cause before trying again.`,`Godt tatt: topp-ITT ${nf(s.peak,0)} °C. La starteren gå for å blåse kald luft gjennom (tørrmotorering), og finn årsaken før du prøver igjen.`)]; }},
 {k:'flex',dp:1,q:t2('Turbofan, sea-level airport, OAT 20 °C, corner ISA+15 (30 °C). Which FLEX temperature is allowed?','Turbofan, flyplass ved havet, OAT 20 °C, hjørne ISA+15 (30 °C). Hvilken FLEX-temperatur er tillatt?'),
  opts:[t2('45 °C','45 °C'),t2('25 °C','25 °C'),t2('15 °C','15 °C'),t2('Any, as long as the runway is long','Hvilken som helst, så lenge banen er lang')],c:0,pre:{type:'fan',mode:'rat',alt:0,dT:5,tas:0,flexT:45},
  e:t2('FLEX must be above both the real OAT and the flat-rating corner (and below a maximum, with at most about 25 % less thrust than TOGA). The real air is colder than assumed, which adds margin.','FLEX må være over både faktisk OAT og hjørnetemperaturen (og under et maksimum, med høyst rundt 25 % mindre skyv enn TOGA). Den virkelige luften er kaldere enn antatt, og det gir ekstra margin.')}];
const tasks=()=>TASKS.filter(t=>!t.dp||deepOn());
function drawTask(){ const TS=tasks(); ti=clamp(ti,0,TS.length-1); const t=TS[ti], n=TS.length, a=ansv[t.k];
  let h=`<div class="th"><span class="n">${L(t2('Task','Oppgave'))} ${ti+1} ${L(t2('of','av'))} ${n}</span><span class="dots">${TS.map((x,i)=>`<button type="button" data-i="${i}" class="${i===ti?'on':''}" aria-label="${L(t2('Task','Oppgave'))} ${i+1}"></button>`).join('')}</span></div><p class="q">${L(t.q)}</p>`;
  if(t.opts){ h+=`<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${a!=null?'<b>'+L(a===t.c?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(t.e):''}</span>`; }
  else { h+=`<div class="ins"><button type="button" class="btn pri sm" data-chk="1">${L(t2('Check','Sjekk'))}</button></div><span class="fb${done[t.k]&&done[t.k][0]?' ok':''}">${done[t.k]?(done[t.k][0]?'<b>✓</b> ':'')+L(done[t.k][1]):''}</span>`; }
  h+=`<div class="nav"><button type="button" class="btn sm" data-go="1">${L(t.live?t2('Set it up in the model','Sett det opp i modellen'):t2('See it in the model','Se det i modellen'))} ↑</button><span class="sp"></span><button type="button" class="btn sm" data-p="1" ${ti===0?'disabled':''}>← ${L(t2('Previous','Forrige'))}</button><button type="button" class="btn sm" data-n="1" ${ti===n-1?'disabled':''}>${L(t2('Next','Neste'))} →</button></div>`;
  el('tstep').innerHTML=h; }
el('tstep').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const TS=tasks(), t=TS[ti];
  if(b.dataset.i!=null){ ti=+b.dataset.i; drawTask(); return; } if(b.dataset.p){ ti--; drawTask(); return; } if(b.dataset.n){ ti++; drawTask(); return; }
  if(b.dataset.go){ const p=Object.assign({},t.pre); if(p.fault){ S.fault=p.fault; delete p.fault; if(faultSeg) faultSeg.set(S.fault); } setS(p); if(S.mode==='start') resetStart(); upd(); goModel(); return; }
  if(b.dataset.o!=null){ ansv[t.k]=+b.dataset.o; drawTask(); return; }
  if(b.dataset.chk){ done[t.k]=t.live(); drawTask(); } });

/* ---------------- Understand: key concept cards ---------------- */
const {sv,tx,ar}=KCS;
const go=o=>({click:()=>setS(o),to:'#enVp'});
const hot='#F09A3E', cold='#7FCBE8';
const KC=[
 Object.assign({k:'four',t:t2('Four-stroke piston','Firetakts stempelmotor'),d:t2('Each cylinder does <b>intake, compression, power and exhaust</b> in two turns of the crankshaft (the Otto cycle).','Hver sylinder gjør <b>innsug, kompresjon, arbeid og eksos</b> på to omdreininger av veivakselen (Otto-syklusen).'),dd:t2('Only one stroke in four makes work, so aircraft engines have four to six cylinders firing in turn. Power ≈ MAP × RPM: manifold pressure says how much air each stroke gets, RPM how many strokes per minute.','Bare ett takt av fire gjør arbeid, så flymotorer har fire til seks sylindre som tenner etter tur. Effekt ≈ MAP × RPM: innsugstrykket sier hvor mye luft hvert takt får, RPM hvor mange takt per minutt.'),
  ill:()=>sv(`<rect x="80" y="8" width="40" height="44" rx="3" fill="none" stroke="#c9d2da"/><rect x="82" y="30" width="36" height="10" fill="#8e9aa5"/><rect x="82" y="10" width="36" height="20" fill="${hot}" opacity=".7"/>${tx(20,24,'suck','#7fcbe8')}${tx(20,40,'squeeze','#e8d46a')}${tx(140,24,'bang',hot)}${tx(140,40,'blow','#c9d2da')}`)},go({type:'pist',mode:'how',alt:0,dT:0,tas:0,thr:0.7,rpm:2400,mix:1,ice:false})),
 Object.assign({k:'gt',t:t2('The gas turbine (Brayton cycle)','Gassturbinen (Brayton-syklusen)'),d:t2('Air flows straight through: the <b>compressor</b> squeezes it, the <b>combustor</b> heats it at constant pressure, the <b>turbine</b> takes out enough work to drive the compressor, and what is left is useful.','Luften strømmer rett gjennom: <b>kompressoren</b> klemmer den, <b>brennkammeret</b> varmer den ved konstant trykk, <b>turbinen</b> henter ut nok arbeid til å drive kompressoren, og resten er nyttig.'),dd:t2('All four strokes happen at once, continuously, each in its own place. A higher pressure ratio and a hotter turbine inlet give a better efficiency, so the limit you watch is the hot-section temperature (EGT or ITT).','Alle fire taktene skjer samtidig og hele tiden, hver på sitt sted. Høyere trykkforhold og varmere turbininnløp gir bedre virkningsgrad, så grensen du følger er temperaturen i den varme delen (EGT eller ITT).'),
  ill:()=>sv(`<rect x="12" y="22" width="176" height="20" rx="3" fill="url(#gtg)"/><defs><linearGradient id="gtg"><stop offset="0" stop-color="${cold}"/><stop offset=".45" stop-color="#e8d46a"/><stop offset=".6" stop-color="#e8503a"/><stop offset="1" stop-color="${hot}"/></linearGradient></defs>${tx(30,16,'C','#c9d2da','middle')}${tx(100,16,'burn','#c9d2da','middle')}${tx(150,16,'T','#c9d2da','middle')}${tx(100,58,'suck · squeeze · bang · blow','#8b99a7','middle')}`)},go({type:'jet',mode:'how',alt:0,dT:0,tas:0,tl:0.8})),
 Object.assign({k:'fan',t:t2('Turbojet vs turbofan','Turbojet og turbofan'),d:t2('A turbojet sends all its air through the core as one fast jet; a <b>turbofan</b> uses a big fan to push most of the air around the core (the <b>bypass ratio</b>), slower but much more of it.','En turbojet sender all luften gjennom kjernen som én rask stråle; en <b>turbofan</b> bruker en stor fan til å skyve det meste av luften rundt kjernen (<b>omløpsforholdet</b>), saktere, men mye mer av den.'),dd:t2('High-bypass fans have bypass ratios of about 5 to 12; the fan makes most of the thrust. Two spools: N1 (fan + LP turbine) and N2 (core). Gauges: N1 (thrust), EGT, N2, fuel flow; some engines use EPR for thrust.','Fan med høyt omløpsforhold har omløpsforhold på rundt 5 til 12; fanen lager det meste av skyvet. To spoler: N1 (fan + LP-turbin) og N2 (kjerne). Instrumenter: N1 (skyv), EGT, N2, drivstoffstrøm; noen motorer bruker EPR for skyv.'),
  ill:()=>sv(`<rect x="60" y="24" width="90" height="16" fill="${hot}" opacity=".8"/><rect x="40" y="8" width="110" height="12" fill="${cold}" opacity=".5"/><rect x="40" y="44" width="110" height="12" fill="${cold}" opacity=".5"/><line x1="44" y1="6" x2="44" y2="58" stroke="#c9b6f2" stroke-width="3"/>${tx(160,18,'bypass',cold)}${tx(160,36,'core',hot)}`)},go({type:'fan',mode:'how',alt:0,dT:0,tas:0,tl:0.8})),
 Object.assign({k:'tp',t:t2('Turboprop: the free power turbine','Turboprop: den frie kraftturbinen'),d:t2('A gas generator (compressor + its turbine, <b>Ng</b>) makes hot gas; a separate <b>power turbine</b> (<b>Np</b>) drives the propeller through a reduction gearbox, with no shaft between them.','En gassgenerator (kompressor + dens turbin, <b>Ng</b>) lager varm gass; en egen <b>kraftturbin</b> (<b>Np</b>) driver propellen gjennom en reduksjonsgirkasse, uten aksel mellom dem.'),dd:t2('Nearly all the energy goes to the shaft; the exhaust gives only a little thrust. The power lever sets Ng (gas power), the propeller lever sets Np through a governor, the condition lever is fuel cut-off and idle. Gauges: torque, ITT, Ng, Np, fuel flow. Most small turboprops use <b>reverse flow</b> (air in at the back, flowing forward to exhaust stacks behind the propeller); many larger ones use <b>direct flow</b> (intake at the front, exhaust at the back).','Nesten all energi går til akselen; eksosen gir bare litt skyv. Krafthendelen setter Ng (gasskraft), propellhendelen setter Np gjennom en governor, kondisjonshendelen er drivstoffkutt og tomgang. Instrumenter: moment, ITT, Ng, Np, drivstoffstrøm. De fleste små turboproper har <b>motstrøm</b> (luft inn bak, som strømmer forover til eksosrør bak propellen); mange større har <b>direkte strøm</b> (inntak foran, eksos bak).'),
  ill:()=>sv(`<rect x="40" y="22" width="64" height="20" fill="#7fcbe8" opacity=".5"/><rect x="112" y="22" width="16" height="20" fill="#c9b6f2" opacity=".8"/><line x1="108" y1="16" x2="108" y2="48" stroke="#ec5a47" stroke-dasharray="2 2"/><line x1="16" y1="10" x2="16" y2="54" stroke="#c9b6f2" stroke-width="3"/>${tx(72,58,'Ng','#7fcbe8','middle')}${tx(120,58,'Np','#c9b6f2','middle')}${tx(150,36,'no shaft','#ec5a47')}`)},go({type:'tp',mode:'how',alt:0,dT:0,tas:0,pl:0.6,np:1900,cond:'lo'})),
 Object.assign({k:'mix',t:t2('Mixture and EGT','Blanding og EGT'),d:t2('The air thins as you climb but a carburettor keeps feeding nearly the same fuel, so you <b>lean</b> the mixture; the EGT peaks at the chemically perfect mixture.','Luften blir tynnere når du stiger, men forgasseren gir nesten like mye drivstoff, så du <b>lener</b> blandingen; EGT topper ved den kjemisk perfekte blandingen.'),dd:t2('Full rich at take-off cools the cylinders with extra fuel. Best power is about 50–100 °C rich of peak EGT; best economy at or a little lean of peak. Too lean: rough running, high cylinder temperatures and detonation.','Full rik ved avgang kjøler sylindrene med ekstra drivstoff. Best effekt er rundt 50–100 °C rikt av topp-EGT; best økonomi ved eller litt magert av topp. For magert: ujevn gange, høy sylindertemperatur og detonasjon.'),
  ill:()=>sv(`<path d="M20,52 Q100,4 180,40" stroke="${hot}" stroke-width="2" fill="none"/><line x1="96" y1="8" x2="96" y2="56" stroke="#c9d2da" stroke-dasharray="3 3"/>${tx(100,16,'peak EGT','#c9d2da')}${tx(20,62,'lean','#8b99a7')}${tx(150,62,'rich','#8b99a7')}`)},go({type:'pist',mode:'how',alt:8000,dT:0,tas:115,thr:1,rpm:2400,mix:1,ice:false})),
 Object.assign({k:'carb',t:t2('Carburettor icing','Forgasserising'),d:t2('Fuel evaporating and the pressure drop in the venturi cool the air by up to about 30 °C, so ice can form even on a warm, humid day; <b>carb heat</b> melts it.','Drivstoff som fordamper og trykkfallet i venturien kjøler luften med opptil rundt 30 °C, så is kan dannes selv på en varm, fuktig dag; <b>forgasservarme</b> smelter den.'),dd:t2('Likely from about −10 to +30 °C in humid air, worst at low power (the throttle plate nearly closed). Signs: MAP (constant-speed propeller) or RPM (fixed pitch) slowly falls, then rough running. Fuel-injected engines do not get carburettor ice.','Sannsynlig fra rundt −10 til +30 °C i fuktig luft, verst ved lav effekt (gasspjeldet nesten lukket). Tegn: MAP (konstantturtallspropell) eller RPM (fast propell) faller sakte, deretter ujevn gange. Motorer med innsprøytning får ikke forgasserising.'),
  ill:()=>sv(`<path d="M20,20 L80,20 Q100,30 120,20 L180,20 M20,44 L80,44 Q100,34 120,44 L180,44" stroke="#c9d2da" fill="none"/><circle cx="96" cy="28" r="3" fill="#eaf4ff"/><circle cx="104" cy="36" r="3" fill="#eaf4ff"/>${ar(28,32,70,32,'#7fcbe8')}${tx(130,60,'−30 °C','#7fcbe8')}`)},go({type:'pist',mode:'how',alt:3000,dT:-5,tas:100,thr:0.65,rpm:2300,mix:1,ice:true,heat:false})),
 Object.assign({k:'cs',t:t2('MAP, RPM and the constant-speed propeller','MAP, RPM og konstantturtallspropellen'),d:t2('The <b>throttle sets MAP</b> and the <b>propeller lever sets RPM</b>; a governor changes the blade angle to hold that RPM.','<b>Gassen setter MAP</b> og <b>propellhendelen setter RPM</b>; en governor endrer bladvinkelen for å holde det turtallet.'),dd:t2('To increase power: mixture, then propeller, then throttle. To reduce: throttle, then propeller, then mixture. That keeps MAP from getting high at low RPM (a heavy load on the engine). Magnetos: two independent ones, each firing one of two plugs in every cylinder; the run-up checks each alone.','For å øke effekten: blanding, så propell, så gass. For å redusere: gass, så propell, så blanding. Da blir ikke MAP høy ved lavt turtall (hard belastning på motoren). Magneter: to uavhengige, hver tenner én av to plugger i hver sylinder; run-up sjekker hver for seg.'),
  ill:()=>sv(`<circle cx="60" cy="32" r="22" fill="none" stroke="#c9d2da"/><line x1="60" y1="32" x2="74" y2="18" stroke="#eef3f7" stroke-width="2"/>${tx(60,62,'MAP','#8b99a7','middle')}<circle cx="140" cy="32" r="22" fill="none" stroke="#c9d2da"/><line x1="140" y1="32" x2="156" y2="26" stroke="#eef3f7" stroke-width="2"/>${tx(140,62,'RPM','#8b99a7','middle')}`)},go({type:'pist',mode:'how',alt:4000,dT:0,tas:110,thr:0.8,rpm:2400,mix:1,ice:false})),
 Object.assign({k:'beta',t:t2('Beta, reverse and feathering','Beta, revers og fjæring'),d:t2('Below flight idle the pilot controls the blade angle directly (<b>beta</b>), down to negative angles for <b>reverse</b>; <b>feathering</b> turns the blades edge-on to stop a dead engine’s propeller.','Under flight idle styrer piloten bladvinkelen direkte (<b>beta</b>), helt ned til negative vinkler for <b>revers</b>; <b>fjæring</b> dreier bladene med kanten mot vinden for å stoppe propellen på en død motor.'),dd:t2('A windmilling propeller on a failed engine makes a lot of drag and yaw; feathered, it makes the least. Many turboprops autofeather after an engine failure on take-off. Beta and reverse are for the ground only.','En vindmøllende propell på en død motor gir mye motstand og gir; fjæret gir den minst. Mange turboproper fjærer automatisk ved motorstans i avgang. Beta og revers er bare for bakken.'),
  ill:()=>sv(`<line x1="40" y1="10" x2="60" y2="54" stroke="#c9b6f2" stroke-width="5"/><line x1="100" y1="12" x2="100" y2="52" stroke="#c9b6f2" stroke-width="2"/><line x1="160" y1="10" x2="140" y2="54" stroke="#c9b6f2" stroke-width="5"/>${tx(50,62,'fine','#8b99a7','middle')}${tx(100,62,'feather','#8b99a7','middle')}${tx(150,62,'reverse','#8b99a7','middle')}`)},go({type:'tp',mode:'how',alt:5000,dT:0,tas:140,pl:0.3,np:1500,cond:'lo'})),
 Object.assign({k:'gauges',t:t2('Gauges and limits per type','Instrumenter og grenser per type'),d:t2('Piston: <b>MAP, RPM, EGT, CHT</b>, fuel flow. Turboprop: <b>torque, ITT, Ng, Np</b>, fuel flow. Turbojet: <b>RPM, EGT</b> (EPR). Turbofan: <b>N1, EGT, N2</b>, fuel flow.','Stempel: <b>MAP, RPM, EGT, CHT</b>, drivstoffstrøm. Turboprop: <b>moment, ITT, Ng, Np</b>, drivstoffstrøm. Turbojet: <b>RPM, EGT</b> (EPR). Turbofan: <b>N1, EGT, N2</b>, drivstoffstrøm.'),dd:t2('Green arc = normal, amber = caution or time-limited, red line = never exceed. The power-setting gauge is MAP (piston), torque (turboprop) and N1 or EPR (jets); the temperature limit is CHT, ITT or EGT. Oil pressure and temperature on all of them.','Grønn bue = normalt, gul = forsiktighet eller tidsbegrenset, rød strek = aldri over. Instrumentet du setter kraft etter er MAP (stempel), moment (turboprop) og N1 eller EPR (jet); temperaturgrensen er CHT, ITT eller EGT. Oljetrykk og -temperatur på alle.'),
  ill:()=>sv(`<path d="M30,48 A26,26 0 1,1 82,48" stroke="#71cc93" stroke-width="4" fill="none"/><line x1="80" y1="40" x2="88" y2="48" stroke="#ec5a47" stroke-width="3"/><line x1="56" y1="44" x2="70" y2="24" stroke="#eef3f7" stroke-width="2"/>${tx(110,24,'green: normal','#71cc93')}${tx(110,40,'red: limit','#ec5a47')}`)},go({type:'fan',mode:'how',alt:0,dT:0,tas:0,tl:1}))];
 Object.assign({k:'lapse',t:t2('Thrust vs power, and lapse','Skyv og effekt, og fall'),d:t2('Propeller engines are rated in <b>power</b>, jets in <b>thrust</b>; power = thrust × speed. Thin air cuts both, and a propeller’s thrust falls fast with speed while a jet’s holds up better.','Propellmotorer rates i <b>effekt</b>, jetmotorer i <b>skyv</b>; effekt = skyv × fart. Tynn luft reduserer begge, og propellens skyv faller fort med farten mens jetens holder seg bedre.'),dd:t2('A normally aspirated piston loses power roughly with density, about 3 % per 1 000 ft; a turbocharger can hold sea-level MAP up to its critical altitude. Propellers are most efficient low and slow, fans high and fast.','En stempelmotor uten turbo mister effekt omtrent med tettheten, rundt 3 % per 1 000 ft; en turbolader kan holde MAP fra havnivå opp til kritisk høyde. Propeller er mest effektive lavt og sakte, fan høyt og fort.'),
  ill:()=>sv(`<path d="M16,10 Q90,30 184,56" stroke="#8eddb0" stroke-width="2" fill="none"/><path d="M16,10 L90,10 Q140,20 184,40" stroke="#7fcbe8" stroke-width="2" fill="none"/>${tx(184,52,'piston','#8eddb0','end')}${tx(184,32,'turboprop','#7fcbe8','end')}${tx(16,62,'altitude →','#8b99a7')}`)},go({mode:'cmp',alt:15000,dT:0,tas:200})),
 Object.assign({k:'flat',t:t2('Flat rating and FLEX','Flat rating og FLEX'),d:t2('A <b>flat-rated</b> engine gives its full rating up to a corner temperature, held back by torque or thrust; above it the temperature limit takes over. <b>FLEX</b> (assumed temperature) uses less thrust when the runway allows.','En <b>flat-rated</b> motor gir full rating opp til en hjørnetemperatur, holdt tilbake av moment eller skyv; over den tar temperaturgrensen over. <b>FLEX</b> (antatt temperatur) bruker mindre skyv når banen tillater det.'),dd:t2('FLEX must be above the real OAT and above the corner, and gives at most about 25 % less thrust than full. Not on contaminated runways, and full thrust is always available by pushing the levers to TOGA.','FLEX må være over faktisk OAT og over hjørnet, og gir høyst rundt 25 % mindre skyv enn fullt. Ikke på kontaminerte baner, og fullt skyv er alltid tilgjengelig ved å skyve hendlene til TOGA.'),dp:1,
  ill:()=>sv(`<polyline points="16,16 110,16 184,52" stroke="#c9b6f2" stroke-width="2" fill="none"/><line x1="110" y1="8" x2="110" y2="58" stroke="#c9d2da" stroke-dasharray="3 3"/>${tx(114,12,'corner','#c9d2da')}${tx(16,62,'OAT →','#8b99a7')}`)},go({type:'fan',mode:'rat',alt:0,dT:5,flexT:45})),
 Object.assign({k:'start',t:t2('Starting: hot, hung and wet','Start: varm, hengende og våt'),d:t2('A <b>hot start</b> overheats (too much fuel for the air), a <b>hung start</b> lights but will not reach idle, a <b>wet start</b> gets fuel but no light-off.','En <b>varm start</b> overopphetes (for mye drivstoff for luften), en <b>hengende start</b> tenner men når ikke tomgang, en <b>våt start</b> får drivstoff, men tenner ikke.'),dd:t2('In every case: cut the fuel and keep the starter turning (dry motoring) to cool and purge the engine. A FADEC does this by itself on an automatic start; on a manual start the pilot must. Starter limits (duty cycles) still apply.','I alle tilfeller: kutt drivstoffet og la starteren dreie (tørrmotorering) for å kjøle og tømme motoren. En FADEC gjør dette selv ved automatisk start; ved manuell start må piloten. Startergrenser (driftssykluser) gjelder fortsatt.'),
  ill:()=>sv(`<polyline points="16,56 50,52 70,20 100,8" stroke="#ec5a47" stroke-width="2" fill="none"/><polyline points="16,56 60,40 184,38" stroke="#f0b440" stroke-width="2" fill="none"/><line x1="16" y1="14" x2="184" y2="14" stroke="#ec5a47" stroke-dasharray="4 3"/>${tx(104,12,'hot','#ec5a47')}${tx(150,34,'hung','#f0b440')}`)},go({type:'tp',mode:'start'})),
KCS.render(el('kcGrid'),KC);

/* ---------------- deep-dive folds ---------------- */
const P=s=>`<p>${s}</p>`, FX=s=>`<div class="fx">${s}</div>`;
const DD=[
 ['pist',t2('The piston engine in detail','Stempelmotoren i detalj'),t2('cycle, mixture, ignition, detonation','syklus, blanding, tenning, detonasjon'),t2(
  P('<b>Otto cycle:</b> compression (about 7–9 : 1 in aero engines), heat added almost at constant volume, expansion, exhaust. Ignition is timed about 20–25° before top dead centre so the pressure peaks just after it. Two magnetos make their own spark from the engine’s rotation, independent of the aircraft’s electrics; switching one off on the run-up gives a small RPM drop (no drop: suspect a magneto not grounding, a hazard on the ground).')+P('<b>Detonation</b> is the unburnt charge exploding instead of burning smoothly: high CHT, lean mixture, high MAP at low RPM or the wrong (lower octane) fuel. <b>Pre-ignition</b> is the charge lighting before the spark from a hot spot. Both can destroy an engine in minutes: enrich, reduce power, increase cooling.')+P('<b>Turbocharging</b> uses exhaust energy to drive a compressor in the intake, keeping sea-level MAP (turbo-normalised) up to a critical altitude, typically 15 000–20 000 ft. Above that power falls like a normally aspirated engine.'),
  P('<b>Otto-syklus:</b> kompresjon (rundt 7–9 : 1 i flymotorer), varme tilført nesten ved konstant volum, ekspansjon, eksos. Tenningen skjer rundt 20–25° før øvre dødpunkt, så trykket topper rett etter. To magneter lager sin egen gnist fra motorens rotasjon, uavhengig av flyets elektriske system; slår du av én på run-up gir det et lite RPM-fall (ingen endring: mistenk en magnet som ikke jordes, en fare på bakken).')+P('<b>Detonasjon</b> er at den uforbrente ladningen eksploderer i stedet for å brenne jevnt: høy CHT, mager blanding, høy MAP ved lavt turtall eller feil (lavere oktan) drivstoff. <b>Selvtenning</b> er at ladningen tenner før gnisten fra et varmt punkt. Begge kan ødelegge en motor på minutter: gjør blandingen rikere, reduser kraften, øk kjølingen.')+P('<b>Turbolading</b> bruker eksosenergi til å drive en kompressor i innsuget og holder MAP fra havnivå (turbo-normalisert) opp til en kritisk høyde, typisk 15 000–20 000 ft. Over den faller effekten som på en motor uten turbo.'))],
 ['gt',t2('The gas turbine and its stations','Gassturbinen og stasjonene'),t2('Brayton cycle, numbers along the engine','Brayton-syklus, tall langs motoren'),t2(
  P('Stations are numbered along the gas path: 0 free air, 2 compressor face, 3 compressor exit, 4 turbine inlet, 5 turbine exit, 9 nozzle exit. Typical values at take-off for a large modern core: pressure ratio 30–50, compressor exit 550–650 °C, turbine inlet 1 400–1 600 °C, hotter than the blade metal can stand without cooling.')+FX('thermal efficiency ↑ with pressure ratio and turbine inlet temperature')+P('<b>Compressor stall and surge:</b> each blade row is a wing; at the wrong angle of attack (fast throttle movement, distorted inflow, ice, damage) it stalls. A surge is the whole compressor breaking down: bangs, flames, EGT rising and the spool slowing. Bleed valves and variable stators keep the stages matched at low RPM.')+P('<b>Why EGT or ITT, not the turbine inlet:</b> the inlet is too hot to measure reliably, so the temperature is measured a little further back and the limit is set there.'),
  P('Stasjonene nummereres langs gasstrømmen: 0 fri luft, 2 kompressorinnløp, 3 kompressorutløp, 4 turbininnløp, 5 turbinutløp, 9 dyseutløp. Typiske verdier ved avgang for en stor moderne kjerne: trykkforhold 30–50, kompressorutløp 550–650 °C, turbininnløp 1 400–1 600 °C, varmere enn bladmetallet tåler uten kjøling.')+FX('termisk virkningsgrad ↑ med trykkforhold og turbininnløpstemperatur')+P('<b>Kompressorstall og surge:</b> hver bladrad er en vinge; ved feil angrepsvinkel (rask gassbevegelse, forstyrret innstrømning, is, skade) staller den. Surge er at hele kompressoren bryter sammen: smell, flammer, EGT som stiger og spolen som bremser. Bleed-ventiler og variable statorer holder trinnene tilpasset ved lavt turtall.')+P('<b>Hvorfor EGT eller ITT, ikke turbininnløpet:</b> innløpet er for varmt å måle pålitelig, så temperaturen måles litt lenger bak, og grensen settes der.'))],
 ['tp',t2('The turboprop in the cockpit','Turbopropen i cockpit'),t2('levers, gauges and limits','hendler, instrumenter og grenser'),['TPTAB',t2(
  P('Typical free-turbine turboprop in the 600–1 000 shp class: torque limit (gearbox) 100 %, ITT limit about 800 °C in flight and about 1 000 °C for a few seconds during the start, Ng max about 101–102 %, propeller 1 600–2 000 rpm, low idle about 52 % Ng. The lab uses these.')+P('Without a FADEC, <b>the pilot</b> sets power and must keep inside both limits: on a cold day at sea level the torque line comes first (full power lever would over-torque), hot or high the ITT line comes first. Turboprops with full-authority control (and turbofans) do this for you.'),
  P('Typisk turboprop med fri turbin i klassen 600–1 000 shp: momentgrense (girkasse) 100 %, ITT-grense rundt 800 °C i flyging og rundt 1 000 °C i noen sekunder under start, Ng maks rundt 101–102 %, propell 1 600–2 000 rpm, low idle rundt 52 % Ng. Labben bruker disse.')+P('Uten FADEC setter <b>piloten</b> kraften og må holde seg innenfor begge grensene: en kald dag ved havet kommer momentgrensen først (full krafthendel ville gitt overmoment), varmt eller høyt kommer ITT-grensen først. Turboproper med full autoritetsstyring (og turbofaner) gjør dette for deg.'))]],
 ['fan',t2('Turbojet and turbofan','Turbojet og turbofan'),t2('bypass, spools, thrust parameters','omløp, spoler, skyvparametere'),t2(
  P('Thrust = mass flow × (jet speed − flight speed). The wasted energy is in the jet you leave behind, so <b>propulsive efficiency</b> η = 2 / (1 + V<sub>jet</sub>/V). A turbojet has a fast jet: good only at high speed. A high-bypass fan moves a lot of air only a little faster: good at Mach 0.7–0.85. A propeller moves even more air even more gently: best of all, until its tips go supersonic.')+FX('η_prop ≈ 2 / (1 + V_jet / V)')+P('<b>Two spools:</b> N1 (fan + LP turbine) and N2 (compressor + HP turbine) are joined only by the gas. The starter turns N2; N1 follows. Most turbofans set thrust by N1, some by EPR (exhaust pressure / inlet pressure). <b>Spool-up</b> from idle takes several seconds, which is why a go-around starts with the thrust levers and why a higher approach idle is used.')+P('<b>Reverse thrust</b> on a fan turns the cold bypass air forward through cascades; reduce to idle reverse at low speed to avoid ingesting exhaust and debris.'),
  P('Skyv = massestrøm × (strålefart − flyfart). Energien som kastes bort ligger i strålen du etterlater, så <b>propulsiv virkningsgrad</b> η = 2 / (1 + V<sub>stråle</sub>/V). En turbojet har en rask stråle: god bare ved høy fart. En fan med høyt omløpsforhold flytter mye luft bare litt raskere: god ved Mach 0,7–0,85. En propell flytter enda mer luft enda mykere: best av alle, til tuppene blir overlyd.')+FX('η_prop ≈ 2 / (1 + V_stråle / V)')+P('<b>To spoler:</b> N1 (fan + LP-turbin) og N2 (kompressor + HP-turbin) er bare koblet av gassen. Starteren dreier N2; N1 følger. De fleste turbofaner setter skyv etter N1, noen etter EPR (eksostrykk / innløpstrykk). <b>Spoling</b> fra tomgang tar flere sekunder, og derfor starter en gjennomstart med gasshendlene og en høyere approach idle brukes.')+P('<b>Revers</b> på en fan vender den kalde omløpsluften forover gjennom skovlgitre; reduser til idle reverse ved lav fart for å unngå å suge inn eksos og rusk.'))],
 ['rat',t2('Ratings, FLEX and bleed','Rating, FLEX og bleed'),t2('why engines are held back','hvorfor motorer holdes tilbake'),t2(
  P('Engine life is set by temperature in the hot section. A flat-rated engine is limited (by torque on a turboprop, by thrust on a jet) up to a corner temperature, often ISA + 15 for jets, so it delivers the same take-off performance on cool and warm days with temperature to spare. Above the corner the hot-section limit sets the rating.')+P('<b>FLEX / assumed temperature:</b> enter a temperature hotter than today; the engine gives the thrust it would give then. Rules: FLEX above the real OAT and above the corner, at most about 25 % below full thrust, not on contaminated runways or with some failures; TOGA is always available.')+P('<b>Bleed air and anti-ice</b> take air from the compressor: for the same thrust the EGT rises, or for the same EGT the thrust falls. Take-off performance includes these penalties.'),
  P('Motorlevetiden styres av temperaturen i den varme delen. En flat-rated motor begrenses (av moment på en turboprop, av skyv på en jet) opp til en hjørnetemperatur, ofte ISA + 15 for jet, så den gir samme startytelse på kalde og varme dager med temperatur til overs. Over hjørnet bestemmer temperaturgrensen ratingen.')+P('<b>FLEX / antatt temperatur:</b> legg inn en temperatur varmere enn i dag; motoren gir skyvet den ville gitt da. Regler: FLEX over faktisk OAT og over hjørnet, høyst rundt 25 % under fullt skyv, ikke på kontaminert bane eller ved enkelte feil; TOGA er alltid tilgjengelig.')+P('<b>Bleed-luft og anti-ice</b> tar luft fra kompressoren: for samme skyv stiger EGT, eller for samme EGT faller skyvet. Startytelsen tar med disse tapene.'))],
 ['start',t2('Starting each type','Start av hver type'),t2('sequences and faults','sekvenser og feil'),t2(
  P('<b>Piston:</b> fuel on, mixture rich, prime if cold, throttle cracked, master and magnetos on, starter. Oil pressure within about 30 s (60 s in the cold), or shut down. An engine fire during start: keep cranking to suck the flames in.')+P('<b>Turboprop (manual):</b> starter on; at about 12–13 % Ng condition lever to low idle; light-off within about 10 s; watch ITT (start limit about 1 000 °C for a few seconds) and Ng; starter off at about 50 % Ng.')+P('<b>Turbofan (automatic):</b> start valve opens, the air starter turns N2; ignition and fuel at about 16–25 % N2; light-off seen as EGT rising; N1 must show rotation; starter cut-out about 50 % N2; idle about 58–60 % N2. The FADEC aborts hot, hung and wet starts, cuts the fuel and dry-cranks.')+P('<b>Faults:</b> hot start (too much fuel or too little air: weak battery, tailwind, early fuel), hung start (too little energy to accelerate), wet start (no ignition): always cut the fuel, then dry motor.'),
  P('<b>Stempel:</b> drivstoff på, blanding rik, prim hvis kald, gassen litt åpen, master og magneter på, starter. Oljetrykk innen rundt 30 s (60 s i kulde), ellers stopp. Brann under start: fortsett å motorere for å suge flammene inn.')+P('<b>Turboprop (manuell):</b> starter på; ved rundt 12–13 % Ng kondisjonshendel til low idle; tenning innen rundt 10 s; følg ITT (startgrense rundt 1 000 °C i noen sekunder) og Ng; starter av ved rundt 50 % Ng.')+P('<b>Turbofan (automatisk):</b> startventilen åpner, luftstarteren dreier N2; tenning og drivstoff ved rundt 16–25 % N2; tenning ses som stigende EGT; N1 må vise rotasjon; starteren kobles ut rundt 50 % N2; tomgang rundt 58–60 % N2. FADEC avbryter varm, hengende og våt start, kutter drivstoffet og motorerer tørt.')+P('<b>Feil:</b> varm start (for mye drivstoff eller for lite luft: svakt batteri, medvind, for tidlig drivstoff), hengende start (for lite energi til å akselerere), våt start (ingen tenning): kutt alltid drivstoffet, motorer så tørt.'))],
 ['model',t2('Model and data','Modell og data'),t2('what the lab assumes','hva labben antar'),t2(
  P('Scaled, representative models of generic engine types, not data for any real engine. ICAO standard atmosphere. <b>Piston:</b> 180 hp class at 2 700 rpm, power ∝ air mass per minute × a mixture factor (best power about 15 % rich of stoichiometric), carburettor fuel ∝ √density, so it richens with altitude. <b>Turboprop:</b> 850 shp torque rating; the ITT limit follows a corrected-power law and gives about 1.15 × the rating at sea level ISA, so it is torque-limited low and cool and ITT-limited hot or high. <b>Turbojet:</b> 15 kN class. <b>Turbofan:</b> 120 kN class, flat rated to ISA + 15, thrust ≈ σ<sup>0.85</sup> × (1 − 0.9M + 0.55M²).')+P('Propulsive efficiency: propeller up to 0.85, falling at low speed and when the tips get near Mach 1; jets 2 / (1 + V<sub>jet</sub>/V) with a typical jet speed. Fuel figures are typical (piston BSFC about 250–300 g/kWh, turboprop SFC about 350–380 g/kWh, turbofan TSFC about 10 g/kN·s at take-off and 16–17 in cruise). Start sequences are simplified time models.'),
  P('Skalerte, representative modeller av generiske motortyper, ikke data for noen virkelig motor. ICAOs standardatmosfære. <b>Stempel:</b> 180 hk-klassen ved 2 700 rpm, effekt ∝ luftmasse per minutt × en blandingsfaktor (best effekt rundt 15 % rikere enn støkiometrisk), forgasserdrivstoff ∝ √tetthet, så den blir rikere med høyden. <b>Turboprop:</b> 850 shp momentrating; ITT-grensen følger en korrigert effektlov og gir rundt 1,15 × ratingen ved havet i ISA, så den er momentbegrenset lavt og kaldt og ITT-begrenset varmt eller høyt. <b>Turbojet:</b> 15 kN-klassen. <b>Turbofan:</b> 120 kN-klassen, flat rated til ISA + 15, skyv ≈ σ<sup>0,85</sup> × (1 − 0,9M + 0,55M²).')+P('Propulsiv virkningsgrad: propell opptil 0,85, fallende ved lav fart og når tuppene nærmer seg Mach 1; jet 2 / (1 + V<sub>stråle</sub>/V) med en typisk strålefart. Drivstofftall er typiske (stempel BSFC rundt 250–300 g/kWh, turboprop SFC rundt 350–380 g/kWh, turbofan TSFC rundt 10 g/kN·s ved avgang og 16–17 i marsj). Startsekvensene er forenklede tidsmodeller.'))]];
const TPROWS=[[t2('','') ,t2('Piston','Stempel'),t2('Turboprop','Turboprop'),t2('Turbojet','Turbojet'),t2('Turbofan','Turbofan')],
 [t2('Set power by','Sett kraft etter'),t2('MAP + RPM','MAP + RPM'),t2('torque','moment'),t2('RPM or EPR','RPM eller EPR'),t2('N1 or EPR','N1 eller EPR')],
 [t2('Temperature limit','Temperaturgrense'),t2('CHT (EGT for leaning)','CHT (EGT for lening)'),t2('ITT','ITT'),t2('EGT','EGT'),t2('EGT','EGT')],
 [t2('Speeds shown','Turtall vist'),t2('RPM','RPM'),t2('Ng and Np','Ng og Np'),t2('RPM (N)','RPM (N)'),t2('N1 and N2','N1 og N2')],
 [t2('Levers','Hendler'),t2('throttle, propeller, mixture','gass, propell, blanding'),t2('power, propeller, condition','kraft, propell, kondisjon'),t2('thrust','skyv'),t2('thrust','skyv')],
 [t2('Best at','Best ved'),t2('low, slow, small','lavt, sakte, lite'),t2('up to about 300 kt, FL250','opp til rundt 300 kt, FL250'),t2('very high speed','svært høy fart'),t2('Mach 0.7–0.85, high','Mach 0,7–0,85, høyt')]];
function drawDD(){ const open=[...document.querySelectorAll('#ddList details[open]')].map(d=>d.id);
  el('ddList').innerHTML=DD.map(([id,t,s,c])=>{ let body; if(Array.isArray(c)&&c[0]==='TPTAB') body=L(c[1])+`<div class="wrapx"><table class="ftab">${TPROWS.map((r,j)=>`<tr>${r.map(x=>j?`<td>${L(x)}</td>`:`<th>${L(x)}</th>`).join('')}</tr>`).join('')}</table></div>`; else body=L(c);
    return `<details class="dfold" id="dd-${id}"><summary>${L(t)} <small>${L(s)}</small></summary><div>${body}</div></details>`; }).join('');
  open.forEach(i=>{ const d=el(i); if(d) d.open=true; }); }

/* ---------------- Test yourself ---------------- */
function drawTake(){ const TK=[
  t2('<b>Suck, squeeze, bang, blow</b> in every engine. A piston does the four in turn in one cylinder; a gas turbine does them at once, each in its own part.','<b>Sug, klem, smell, blås</b> i alle motorer. En stempelmotor gjør de fire etter tur i én sylinder; en gassturbin gjør dem samtidig, hver i sin del.'),
  t2('<b>Piston:</b> throttle sets MAP, propeller lever sets RPM, power ≈ MAP × RPM. Lean as you climb; peak EGT is the chemically correct mixture.','<b>Stempel:</b> gassen setter MAP, propellhendelen setter RPM, effekt ≈ MAP × RPM. Len når du stiger; topp-EGT er den kjemisk riktige blandingen.'),
  t2('<b>Carburettor ice</b> can form from about −10 to +30 °C in humid air, worst at low power: MAP or RPM falls. Carb heat melts it.','<b>Forgasserising</b> kan dannes fra rundt −10 til +30 °C i fuktig luft, verst ved lav effekt: MAP eller RPM faller. Forgasservarme smelter den.'),
  t2('<b>Turboprop:</b> a gas generator (Ng) and a free power turbine (Np) on separate shafts. Set power by torque; the limit is torque low and cool, ITT hot or high.','<b>Turboprop:</b> en gassgenerator (Ng) og en fri kraftturbin (Np) på hver sin aksel. Sett kraft etter moment; grensen er moment lavt og kaldt, ITT varmt eller høyt.'),
  t2('<b>Turbojet vs turbofan:</b> a fan moves much more air much slower around the core. Same thrust, less fuel, less noise. N1 = fan, N2 = core.','<b>Turbojet og turbofan:</b> en fan flytter mye mer luft mye saktere rundt kjernen. Samme skyv, mindre drivstoff, mindre støy. N1 = fan, N2 = kjerne.'),
  t2('<b>Propellers win low and slow, fans high and fast.</b> Power and thrust fall with density; a propeller’s thrust also falls fast with speed.','<b>Propeller vinner lavt og sakte, fan høyt og fort.</b> Effekt og skyv faller med tettheten; propellens skyv faller også fort med farten.'),
  {dp:1,...t2('<b>Flat rating:</b> full rating up to a corner temperature, then the hot-section limit. <b>FLEX</b> takes off with less thrust when the runway allows, to save engine life.','<b>Flat rating:</b> full rating opp til en hjørnetemperatur, så grensen i den varme delen. <b>FLEX</b> tar av med mindre skyv når banen tillater det, for å spare motoren.')},
  t2('<b>Hot, hung or wet start:</b> cut the fuel, keep the starter turning. A FADEC does it on an automatic start; on a manual start you must.','<b>Varm, hengende eller våt start:</b> kutt drivstoffet, la starteren dreie. En FADEC gjør det ved automatisk start; ved manuell start må du.')];
  el('take').innerHTML=TK.filter(x=>!x.dp||deepOn()).map(x=>`<li>${L(x)}</li>`).join('');
  const m=el('maid'); m.querySelector('.k').textContent=L(t2('Memory aid','Huskeregel'));
  m.querySelector('b').textContent=L(t2('Suck, squeeze, bang, blow','Sug, klem, smell, blås'));
  m.querySelector('p').textContent=L(t2('Intake, compression, combustion, exhaust. In a piston engine they follow each other in the same cylinder; in a gas turbine they run side by side, all the time: intake, compressor, combustor, turbine and nozzle.','Innsug, kompresjon, forbrenning, eksos. I en stempelmotor følger de etter hverandre i samme sylinder; i en gassturbin går de side om side, hele tiden: innløp, kompressor, brennkammer, turbin og dyse.')); }

LAB.quiz(el('qbox'),'engines',()=>LAB.shuffle([
 {q:t2('In a free-turbine turboprop, what drives the propeller?','Hva driver propellen på en turboprop med fri turbin?'),a:[t2('The power turbine, through its own shaft and the reduction gearbox','Kraftturbinen, gjennom sin egen aksel og reduksjonsgiret'),t2('The compressor turbine, on the same shaft as the compressor','Kompressorturbinen, på samme aksel som kompressoren'),t2('The exhaust jet, pushing on the blades','Eksosstrålen, som skyver på bladene')],c:0,e:t2('The gas generator (compressor, combustor, compressor turbine) only makes hot gas. A separate power turbine takes the energy and drives the propeller; only the gas links the two shafts (Ng and Np).','Gassgeneratoren (kompressor, brennkammer, kompressorturbin) lager bare varm gass. En egen kraftturbin tar energien og driver propellen; bare gassen kobler de to akslene (Ng og Np).')},
 {q:t2('What do the nozzle guide vanes (NGV) just in front of a turbine rotor do?','Hva gjør ledeskovlene (NGV) like foran en turbinrotor?'),a:[t2('Speed up the hot gas and aim it at the rotor blades','Øker farten på den varme gassen og retter den mot rotorbladene'),t2('Slow the air down so its pressure rises','Bremser luften så trykket stiger'),t2('Spray the fuel into the gas','Sprøyter drivstoffet inn i gassen')],c:0,e:t2('They are fixed vanes shaped as nozzles: the gas leaves them fast and at the right angle, so the rotor can take out its energy. Slowing the air to raise pressure is the diffuser\'s job.','De er faste skovler formet som dyser: gassen forlater dem raskt og med riktig vinkel, så rotoren kan hente ut energien. Å bremse luften for å øke trykket er diffusorens jobb.')},
 {q:t2('In a four-stroke engine, how many turns of the crankshaft does one full cycle take?','Hvor mange omdreininger av veivakselen tar én hel syklus i en firetaktsmotor?'),a:[t2('Two','To'),t2('One','Én'),t2('Four','Fire')],c:0,e:t2('Four strokes of the piston, two up and two down per turn: two turns. Only the power stroke makes work.','Fire takt med stempelet, to opp og to ned per omdreining: to omdreininger. Bare arbeidstaktet gjør arbeid.')},
 {q:t2('You climb from 2 000 to 9 000 ft without touching the mixture. The mixture becomes…','Du stiger fra 2 000 til 9 000 ft uten å røre blandingen. Blandingen blir …'),a:[t2('too rich','for rik'),t2('too lean','for mager'),t2('unchanged','uendret')],c:0,e:t2('The air thins but the carburettor meters nearly the same fuel. Lean to get the power back and save fuel.','Luften blir tynnere, men forgasseren gir nesten like mye drivstoff. Len for å få effekten tilbake og spare drivstoff.')},
 {q:t2('With a constant-speed propeller, carburettor ice shows first as…','Med konstantturtallspropell viser forgasserising seg først som …'),a:[t2('a slow fall in manifold pressure','et sakte fall i innsugstrykket'),t2('a fall in RPM','et fall i RPM'),t2('a rise in oil temperature','en økning i oljetemperaturen')],c:0,e:t2('The governor holds RPM by flattening the blades, so the loss shows on the MAP gauge. With a fixed-pitch propeller RPM falls.','Governoren holder RPM ved å gjøre bladene flatere, så tapet vises på MAP-måleren. Med fast propell faller RPM.')},
 {q:t2('What is special about a free-turbine turboprop?','Hva er spesielt med en turboprop med fri turbin?'),a:[t2('The power turbine driving the propeller is not mechanically linked to the compressor','Kraftturbinen som driver propellen er ikke mekanisk koblet til kompressoren'),t2('It has no gearbox','Den har ingen girkasse'),t2('The propeller drives the compressor','Propellen driver kompressoren')],c:0,e:t2('Ng (gas generator) and Np (power turbine and propeller) run on separate shafts, joined only by the gas.','Ng (gassgenerator) og Np (kraftturbin og propell) går på hver sin aksel, bare koblet av gassen.')},
 {q:t2('Taking off from a cold, sea-level airport in a turboprop without automatic power control, what usually limits the power you may set?','Hva begrenser vanligvis kraften du får sette ved avgang fra en kald flyplass ved havet i en turboprop uten automatisk kraftstyring?'),a:[t2('Torque','Moment'),t2('ITT','ITT'),t2('Np','Np')],c:0,e:t2('The engine is flat rated: the gas generator could give more, but the gearbox torque limit comes first. Hot or high, ITT comes first.','Motoren er flat rated: gassgeneratoren kunne gitt mer, men girkassens momentgrense kommer først. Varmt eller høyt kommer ITT først.')},
 {q:t2('Which gauge do you set take-off thrust by on most turbofans?','Hvilket instrument setter du startskyv etter på de fleste turbofaner?'),a:[t2('N1 (or EPR)','N1 (eller EPR)'),t2('N2','N2'),t2('EGT','EGT')],c:0,e:t2('N1 is the fan speed, and the fan makes most of the thrust. EGT is the limit you watch.','N1 er fanturtallet, og fanen lager det meste av skyvet. EGT er grensen du følger.')},
 {q:t2('Why is a high-bypass turbofan more fuel-efficient than a turbojet at airliner speeds?','Hvorfor er en turbofan med høyt omløpsforhold mer drivstoffeffektiv enn en turbojet ved trafikkflyfart?'),a:[t2('It accelerates more air by less, so less energy is left in the jet','Den akselererer mer luft mindre, så mindre energi blir igjen i strålen'),t2('It burns its fuel at a lower temperature','Den brenner drivstoffet ved lavere temperatur'),t2('The bypass air is heated','Omløpsluften varmes opp')],c:0,e:t2('Propulsive efficiency is 2 / (1 + Vjet/V): the closer the jet speed is to the flight speed, the less is wasted.','Propulsiv virkningsgrad er 2 / (1 + Vstråle/V): jo nærmere strålefarten er flyfarten, jo mindre kastes bort.')},
 {q:t2('Why do airliners cruising at Mach 0.8 use turbofans rather than propellers?','Hvorfor bruker trafikkfly i marsj på Mach 0,8 turbofan og ikke propell?'),a:[t2('Propeller efficiency falls sharply as the blade tips approach the speed of sound','Propellens virkningsgrad faller kraftig når bladtuppene nærmer seg lydhastigheten'),t2('Propellers cannot work in thin air','Propeller virker ikke i tynn luft'),t2('Turboprops cannot climb above FL100','Turboproper kan ikke stige over FL100')],c:0,e:t2('Below about 300–350 kt the propeller wins; above it the ducted fan does.','Under rundt 300–350 kt vinner propellen; over det vinner fanen i kanalen.')},
 {q:t2('A normally aspirated piston engine at full throttle climbs from sea level to 10 000 ft. Its power is roughly…','En stempelmotor uten turbo på full gass stiger fra havnivå til 10 000 ft. Effekten er omtrent …'),a:[t2('70 % of sea-level power','70 % av effekten ved havet'),t2('the same','den samme'),t2('30 % of sea-level power','30 % av effekten ved havet')],c:0,e:t2('The air is about 74 % as dense, and power falls a little faster than density (friction stays).','Luften er rundt 74 % så tett, og effekten faller litt raskere enn tettheten (friksjonen blir igjen).')},
 {q:t2('During a manual turboprop start, ITT rises fast towards the start limit. You…','Under en manuell turbopropstart stiger ITT raskt mot startgrensen. Du …'),a:[t2('move the condition lever to cut-off and keep the starter running','flytter kondisjonshendelen til cut-off og lar starteren gå'),t2('add more fuel to accelerate through','gir mer drivstoff for å akselerere gjennom'),t2('switch off the starter at once','slår av starteren med en gang')],c:0,e:t2('A hot start: cut the fuel, and let the starter blow cool air through the engine.','En varm start: kutt drivstoffet, og la starteren blåse kald luft gjennom motoren.')},
 {q:t2('A hung start is…','En hengende start er …'),a:[t2('light-off, but the engine stops accelerating below idle','tenning, men motoren slutter å akselerere under tomgang'),t2('no light-off after fuel is on','ingen tenning etter at drivstoffet er på'),t2('a temperature above the start limit','en temperatur over startgrensen')],c:0,e:t2('The engine cannot yet run on its own; temperature creeps up. No light-off is a wet start; over-temperature a hot start.','Motoren klarer ikke å gå selv ennå; temperaturen kryper oppover. Ingen tenning er en våt start; overtemperatur en varm start.')},
 {q:t2('What does flat rating mean?','Hva betyr flat rating?'),a:[t2('Full rated power or thrust is available up to a corner temperature; above it the temperature limit makes it fall','Full effekt eller skyv er tilgjengelig opp til en hjørnetemperatur; over den gjør temperaturgrensen at den faller'),t2('Thrust is the same at every altitude','Skyvet er det samme i alle høyder'),t2('The engine gives constant EGT at all temperatures','Motoren gir konstant EGT ved alle temperaturer')],c:0,e:t2('Below the corner the engine could give more but is held to the rating; the temperature rises as the day warms.','Under hjørnet kunne motoren gitt mer, men holdes til ratingen; temperaturen stiger når dagen blir varmere.')},
 {q:t2('With a FLEX (assumed temperature) take-off, the assumed temperature is…','Ved FLEX-avgang (antatt temperatur) er den antatte temperaturen …'),a:[t2('higher than the real OAT and the flat-rating corner','høyere enn faktisk OAT og hjørnetemperaturen'),t2('lower than the real OAT','lavere enn faktisk OAT'),t2('always ISA','alltid ISA')],c:0,e:t2('The engine gives the thrust for that hotter day; the real, cooler air adds margin and saves engine life.','Motoren gir skyvet for den varmere dagen; den virkelige, kaldere luften gir margin og sparer motoren.')},
 {q:t2('Feathering the propeller of a failed engine…','Å fjære propellen på en motor som har stoppet …'),a:[t2('turns the blades edge-on, stopping it and giving the least drag','dreier bladene med kanten mot vinden, stopper den og gir minst motstand'),t2('gives reverse thrust','gir revers'),t2('keeps it windmilling for a restart','holder den vindmøllende for omstart')],c:0,e:t2('A windmilling propeller makes large drag and yaw. Feathered, it stops.','En vindmøllende propell gir stor motstand og gir. Fjæret stopper den.')}]),10);

/* ---------------- static strings, text, start ---------------- */
LAB.add({},{'Aircraft Engines':'Flymotorer','Powerplant: piston, turboprop and jet':'Motorer: stempel, turboprop og jet','Birdbird Virtual Lab · Aircraft and engine systems':'Birdbird Virtual Lab · Fly- og motorsystemer',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Test yourself':'3 · Test deg selv','Key concepts':'Nøkkelbegreper','Deep dive':'Dypdykk','The engine lab':'Motorlabben','Try it':'Prøv selv','Key points':'Det viktigste','Test yourself':'Test deg selv',
 'Controls':'Kontroller','Engine':'Motor','Levers':'Hendler','Start':'Start','Conditions':'Forhold','Reduced take-off thrust':'Redusert startskyv','Scenarios':'Scenarier','Advanced':'Avansert','Mode':'Modus','Sections':'Seksjoner',
 'Assembled':'Sammensatt','Exploded':'Sprengskisse','Assembled to exploded':'Sammensatt til sprengskisse','Parts':'Deler','Lean to peak EGT':'Len til topp-EGT','Carburettor heat':'Forgasservarme','Condition lever':'Kondisjonshendel','Start fault':'Startfeil','Piston: turbo-normalised':'Stempel: turbo-normalisert','Piston: carburettor ice forming':'Stempel: forgasseris dannes','Show temperatures along the gas path':'Vis temperaturer langs gasstrømmen','Layout':'Oppbygning','Reverse flow (most common in small turboprops)':'Motstrøm (vanligst i små turboproper)','Direct flow (common on larger regional turboprops)':'Direkte strøm (vanlig på større regionale turboproper)',
 'Cutaway of the selected engine with the gas path coloured by temperature, its cockpit gauges, and in the other modes comparison and rating charts.':'Snitt av valgt motor med gasstrømmen farget etter temperatur, motorinstrumentene, og i de andre modusene sammenlignings- og ratingdiagrammer.'});
LAB.tx({lead:'Alle flymotorer gjør de samme fire tingene med luft: suger den inn, klemmer den, brenner drivstoff i den og blåser den ut. En stempelmotor gjør dem etter hverandre i samme sylinder; en gassturbin gjør alle samtidig, hver i sin del av motoren. Det den varme gassen så driver, gjør forskjellen: en propell gjennom en aksel (stempel og turboprop) eller en luftstråle rett ut bak (turbojet og turbofan). Se hver av dem virke, les instrumentene, sammenlign dem i samme høyde og fart, og start dem.'});
function texts(){
  el('kin').textContent=L(t2('Twelve ideas that carry the engines. “Show in the model” sets the lab up so you can see it.','Tolv ideer som bærer motorene. «Vis i modellen» setter opp labben så du kan se det.'));
  el('xLead').textContent=L(deepOn()?t2('Pick an engine (top right) and a mode. How it works shows a cutaway with the gas coloured by temperature, the spools turning and the gauges a pilot reads. Compare puts all four at the same height and speed. Start runs a start, with faults. Ratings and limits shows flat rating, FLEX and thrust lapse.','Velg motor (øverst til høyre) og modus. Slik virker den viser et snitt med gassen farget etter temperatur, spolene som går rundt og instrumentene piloten leser. Sammenlign setter alle fire i samme høyde og fart. Start kjører en start, med feil. Rating og grenser viser flat rating, FLEX og skyvfall.')
    :t2('Pick an engine (top right) and a mode, then move the levers. Colours show the gas temperature; the gauges are the ones a pilot reads for that engine.','Velg motor (øverst til høyre) og modus, og flytt hendlene. Fargene viser gasstemperaturen; instrumentene er de piloten leser for den motoren.'));
  el('tryLead').textContent=L(t2('Work it out first, then check. "Set it up in the model" shows you why.','Tenk det ut først, og sjekk. «Sett det opp i modellen» viser deg hvorfor.'));
  el('ratH').textContent=L(t2('For the jets. Must be above the OAT and the corner (ISA + 15).','For jetmotorene. Må være over OAT og hjørnet (ISA + 15).'));
  el('foot').innerHTML=L(t2('<b>Model and limitations.</b> Teaching model, not for flight. Scaled, representative models of generic engine types (piston about 180 hp, free-turbine turboprop about 850 shp, turbojet about 15 kN, high-bypass turbofan about 120 kN), not data for any real engine; numbers are typical. ICAO standard atmosphere; propulsive efficiency and thrust lapse from simple textbook relations; start sequences are simplified time models. The aircraft flight manual and the engine manufacturer’s data decide. More in Deep dive → Model and data.','<b>Modell og begrensninger.</b> Opplæringsmodell, ikke for flyging. Skalerte, representative modeller av generiske motortyper (stempel rundt 180 hk, turboprop med fri turbin rundt 850 shp, turbojet rundt 15 kN, turbofan med høyt omløpsforhold rundt 120 kN), ikke data for noen virkelig motor; tallene er typiske. ICAOs standardatmosfære; propulsiv virkningsgrad og skyvfall fra enkle lærebokrelasjoner; startsekvensene er forenklede tidsmodeller. Flyhåndboken og motorprodusentens data avgjør. Mer i Dypdykk → Modell og data.'));
  el('ddH').textContent=L(t2('Deep dive','Dypdykk')); }
function all(){ if(S.mode==='rat'&&!deepOn()) S.mode='how'; texts(); setMode(S.mode); drawPre(); drawTask(); drawDD(); drawTake(); syncCtl(); upd(); }
LAB.onLang(all);
document.addEventListener('labdepth',all);
LAB.start('engines');
buildLevers(); drawFaults(); resetStart(); setType(S.type); all();
/* old anchors */
const HM={'#eng':['how','fan'],'#start':['start','fan'],'#rating':['rat','fan']}, HD={'#cmp':'dd-fan','#ops':'dd-fan'};
if(HM[location.hash]){ const [m,t]=HM[location.hash]; if(m==='rat'&&depth()==='short') LAB.setDepth('deep'); setType(t); setMode(m); requestAnimationFrame(()=>el('enVp').scrollIntoView({block:'start'})); }
if(HD[location.hash]){ if(depth()==='short') LAB.setDepth('deep'); requestAnimationFrame(()=>{ const d=el(HD[location.hash]); if(d){ d.open=true; d.scrollIntoView({block:'center'}); } }); }
})();
