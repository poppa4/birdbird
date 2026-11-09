/* Birdbird – press.js: the Pressurisation and oxygen lab (pressurisation.html).
   One dark figure: a cut-away fuselage (bleed and packs in, outflow valve out, relief valves, cabin controller),
   a live altitude–time chart (aircraft, cabin, ΔP) and a hypoxia panel (time of useful consciousness, stage, oxygen).
   Four modes: normal climb and descent, rapid decompression, slow leak, oxygen. Three generic classes:
   unpressurised piston, pressurised turboprop, jet transport. All maths in presscore.js (PRC). */
(function(){
'use strict';
const {L,el,nf}=LAB, P=PRC, t2=(en,no)=>({en,no});
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const MONO='"IBM Plex Mono", ui-monospace, monospace', SANS='"Public Sans", system-ui, sans-serif';
const C={ac:'#EEF2F5',cab:'#F09AC8',dp:'#7FCBE8',in:'#7FCBE8',bleed:'#F0B440',out:'#F0C470',txt:'#EEF2F5',mut:'#8E99A4',dim:'#5E6D7C',red:'#EC5A47',ok:'#71CC93',amb:'#F0B440',grid:'rgba(200,215,225,.10)',skin:'#C9D2DA'};
const clamp=P.clamp;
const depth=()=>document.body.classList.contains('depth-short')?'short':document.body.classList.contains('depth-instructor')?'instructor':'deep';
const deepOn=()=>depth()!=='short';
const ft=v=>nf(Math.round(v/10)*10,0)+' ft';
const ft100=v=>nf(Math.round(v/100)*100,0)+' ft';
const psi=v=>(v<0?'−':'')+nf(Math.abs(v),Math.abs(v)<10?2:1)+' psi';
const sg=v=>(v>0?'+':v<0?'−':'±')+nf(Math.abs(v),0);
const fmtT=s=>{ if(s==null||!isFinite(s)) return '–'; if(s<1) return nf(s,1)+' s'; const r=Math.round(s); return r<60? r+' s' : r<3600? Math.floor(r/60)+' min'+(r%60?' '+String(r%60).padStart(2,'0')+' s':'') : nf(r/60,0)+' min'; };
const fl=h=>'FL'+String(Math.round(h/100)).padStart(3,'0');

/* ---------------- classes ---------------- */
const CLN={pist:t2('Unpressurised piston','Piston uten trykkabin'),tp:t2('Pressurised turboprop','Turboprop med trykkabin'),jet:t2('Jet transport','Jetfly')};
const CLS_SHORT={pist:t2('Piston','Stempel'),tp:t2('Turboprop','Turboprop'),jet:t2('Jet','Jet')};
const HOLES={window:{A:0.1,t:t2('Window','Vindu')},door:{A:1.5,t:t2('Cargo door','Lastedør')}};

/* ---------------- state ---------------- */
const S={mode:'norm',cls:'jet',H:{pist:9500,tp:25000,jet:37000},dep:0,dest:2000,ldgMode:'auto',ldg:0,
  hole:'window',holeA:null,rH:{tp:25000,jet:37000},react:15,leak:0.006,packs:0.5,lreact:60,mask:'N',gen:15,rule:'cat',msa:10000,u:0,play:false};
const isP=()=>P.CLS[S.cls].press;
let TR=null;   // the current track
function rule(){ return S.rule==='nco'?'nco':isP()?'catp':'catnp'; }
function build(){ const c=P.CLS[S.cls]; let pts=[], sq=false, extra={};
  if(S.mode==='norm'||(S.mode==='oxy'&&!isP())){ const H=S.mode==='oxy'?Math.max(S.H.pist,12500):S.H[S.cls];
    const s=P.schedule({cls:S.cls,H,dep:S.dep,dest:S.mode==='oxy'?0:S.dest,ldg:S.ldgMode==='auto'?(S.mode==='oxy'?0:S.dest):S.ldg,cruiseMin:S.mode==='oxy'?60:isP()?20:30});
    pts=s.pts.map(p=>({t:p.t*60,h:p.h,cab:p.cab,dp:p.dp,vs:p.vs,ph:p.ph,relief:p.relief,T:21})); extra={sched:s}; }
  else { const H=S.mode==='oxy'?S.rH[S.cls]:S.rH[S.cls], A=S.mode==='slow'?S.leak:S.mode==='oxy'?HOLES.window.A:(S.holeA??HOLES[S.hole].A);
    const r=P.decompress({cls:S.cls,H,A,react:S.mode==='slow'?S.lreact:S.react,afterWarn:S.mode==='slow',packs:S.mode==='slow'?S.packs:true,floor:S.mode==='oxy'?S.msa:10000,tmax:S.mode==='slow'?1800:S.mode==='oxy'?1800:900});
    if(S.mode==='oxy'&&r.tEnd!=null){ const last=r.out[r.out.length-1]; for(let t=last.t+30;t<=Math.max(last.t,(r.t14||0)+S.gen*60+240);t+=30) r.out.push({t,h:last.h,cab:last.cab,dp:0,T:21}); }
    pts=r.out.map((p,i,a)=>{ const b=a[Math.min(a.length-1,i+1)], q=a[Math.max(0,i-1)]; return {t:p.t,h:p.h,cab:p.cab,dp:p.dp,T:p.T,vs:(b.cab-q.cab)/Math.max(1e-6,(b.t-q.t)/60)}; });
    sq=S.mode==='rapid'; extra={dec:r,A}; }
  const T=pts[pts.length-1].t;
  TR={pts,T,sq,...extra}; }
const tAt=u=>TR.sq? u*u*TR.T : u*TR.T;
const uAt=t=>TR.sq? Math.sqrt(clamp(t/TR.T,0,1)) : clamp(t/TR.T,0,1);
function cur(){ const t=tAt(S.u), a=TR.pts; let lo=0,hi=a.length-1; while(hi-lo>1){ const m=(lo+hi)>>1; if(a[m].t<=t) lo=m; else hi=m; }
  const p=a[lo], q=a[hi], f=q.t>p.t?clamp((t-p.t)/(q.t-p.t),0,1):0, I=k=>p[k]+(q[k]-p[k])*f;
  return {t,h:I('h'),cab:I('cab'),dp:I('dp'),vs:p.vs,T:I('T'),ph:p.ph,relief:p.relief}; }

/* oxygen state at the playhead */
function oxy(M){ const D=TR.dec; const st={paxOn:false,genLeft:null,crewOn:false};
  if(!isP()){ return st; }
  if(D&&D.t14!=null&&M.t>=D.t14){ st.paxOn=true; st.genLeft=Math.max(0,S.gen*60-(M.t-D.t14)); }
  if(D&&D.t10!=null&&M.t>=D.t10+5) st.crewOn=true;
  return st; }
function crewFio2(h){ return S.mask==='N'?P.diluter(h):1; }
/* above-10 000 ft time on the track until now (min) */
function minsAbove10(t){ let m=0; const a=TR.pts; for(let i=1;i<a.length&&a[i].t<=t;i++) if(a[i].cab>10000) m+=(a[i].t-a[i-1].t)/60; return m; }

/* ---------------- canvas helpers ---------------- */
const cv=el('prv'); const ST=LAB.fit(cv,()=>draw(),2);
let FS=1, PH=0;
function txt(g,s,x,y,col,al,sz,wt,font){ g.font=`${wt||500} ${Math.round((sz||12)*FS*10)/10}px ${font||MONO}`; g.fillStyle=col||C.txt; g.textAlign=al||'left'; g.textBaseline='alphabetic'; g.fillText(s,x,y); g.textAlign='left'; }
function line(g,x1,y1,x2,y2,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); g.setLineDash([]); }
function poly(g,pts,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke(); g.setLineDash([]); }
function dot(g,x,y,r,fill,stroke,w){ g.beginPath(); g.arc(x,y,r,0,Math.PI*2); if(fill){ g.fillStyle=fill; g.fill(); } if(stroke){ g.strokeStyle=stroke; g.lineWidth=w||1.5; g.stroke(); } }
function rr(g,x,y,w,h,r){ g.beginPath(); g.roundRect?g.roundRect(x,y,w,h,r):g.rect(x,y,w,h); }
function arrow(g,x1,y1,x2,y2,col,w){ const a=Math.atan2(y2-y1,x2-x1), hl=Math.max(5,(w||2)*2.6); line(g,x1,y1,x2-Math.cos(a)*hl*0.6,y2-Math.sin(a)*hl*0.6,col,w||2);
  g.fillStyle=col; g.beginPath(); g.moveTo(x2,y2); g.lineTo(x2-hl*Math.cos(a-0.45),y2-hl*Math.sin(a-0.45)); g.lineTo(x2-hl*Math.cos(a+0.45),y2-hl*Math.sin(a+0.45)); g.closePath(); g.fill(); }
const TAGS=[];
function tag(g,s,x,y,col,o){ o=o||{}; const sz=(o.sz||11)*FS; g.font=`${o.wt||600} ${sz}px ${o.font||SANS}`; const w=g.measureText(s).width+10, h=sz+7;
  let bx=o.al==='right'?x-w:o.al==='center'?x-w/2:x; bx=clamp(bx,(o.minX??2),(o.maxX??ST.w)-w-2); let by=y-h/2;
  if(o.avoid!==false) for(let k=0;k<6;k++){ const hit=TAGS.find(r=>bx<r[2]&&bx+w>r[0]&&by<r[3]&&by+h>r[1]); if(!hit) break; by=(o.dir||1)>0?hit[3]+1:hit[1]-h-1; }
  if(o.bg!==false){ g.fillStyle='rgba(10,14,18,.82)'; rr(g,bx,by,w,h,3); g.fill(); }
  g.fillStyle=col||C.txt; g.textBaseline='middle'; g.textAlign='left'; g.fillText(s,bx+5,by+h/2+0.5); g.textBaseline='alphabetic'; const r=[bx,by,bx+w,by+h]; TAGS.push(r); return r; }

/* ---------------- the figure ---------------- */
function draw(){ if(!ST.w||!TR) return; const g=ST.ctx, W=ST.w, H=ST.h; g.setTransform(ST.dpr,0,0,ST.dpr,0,0); g.clearRect(0,0,W,H); TAGS.length=0;
  FS=depth()==='instructor'?1.12:W<420?0.88:1; const ph=W<760, M=cur();
  const want=W<480?'1 / 1.62':W<760?'1 / 1.2':''; if(cv.style.aspectRatio!==want){ cv.style.aspectRatio=want; return; }
  const chip=el('chip'); let ch=0; if(chip&&getComputedStyle(chip).position==='absolute'&&chip.offsetHeight) ch=chip.offsetTop+chip.offsetHeight+6;
  let fu, chart, hy;
  if(ph){ const f0=Math.max(ch,4); fu=[6,f0,W-12,H*0.29-f0]; chart=[6,H*0.29,W-12,H*0.37]; hy=[6,H*0.68,W-12,H*0.32-6]; }
  else { const xs=W*0.47, top=H*0.62; fu=[8,Math.max(ch,10),xs-16,top-Math.max(ch,10)]; chart=[xs+4,10,W-xs-14,top-10]; hy=[8,top+8,W-16,H-top-14]; }
  drawFuselage(g,M,fu); drawChart(g,M,chart); drawHypoxia(g,M,hy); }

/* cut-away fuselage, nose left */
function drawFuselage(g,M,b){ const [bx,by,bw,bh]=b, c=P.CLS[S.cls], press=c.press, short=depth()==='short', ph=ST.w<640;
  const len=bw*(S.cls==='pist'?0.78:S.cls==='tp'?0.88:0.96), fh=Math.min(bh*(ph?0.4:0.36),len*(S.cls==='jet'?0.19:0.22)), x0=bx+(bw-len)/2+(S.cls==='jet'?0:bw*0.02), x1=x0+len, cy=by+bh*0.5, top=cy-fh/2, bot=cy+fh/2;
  const fb=x0+fh*0.75, ab=x1-fh*1.75, floorY=cy+fh*0.2;
  const D=TR.dec, pc=P.pressAt(M.cab), pr=pc/P.P0;
  /* the hull */
  const hull=()=>{ g.beginPath(); g.moveTo(x0+fh*0.9,top); g.lineTo(x1-fh*1.5,top); g.quadraticCurveTo(x1-fh*0.5,top,x1,cy-fh*0.32); g.lineTo(x1,cy-fh*0.14);
    g.quadraticCurveTo(x1-fh*0.9,bot,x1-fh*2.3,bot); g.lineTo(x0+fh,bot); g.bezierCurveTo(x0+fh*0.3,bot,x0,cy+fh*0.22,x0,cy+fh*0.05); g.bezierCurveTo(x0,cy-fh*0.28,x0+fh*0.35,top,x0+fh*0.9,top); g.closePath(); };
  /* fin */
  g.fillStyle='#26313b'; g.beginPath(); g.moveTo(x1-fh*1.8,top); g.lineTo(x1-fh*0.75,top-fh*(S.cls==='jet'?1.0:0.85)); g.lineTo(x1-fh*0.3,top-fh*(S.cls==='jet'?1.0:0.85)); g.lineTo(x1-fh*0.15,cy-fh*0.3); g.closePath(); g.fill();
  g.strokeStyle='rgba(214,226,236,.25)'; g.lineWidth=1; g.stroke();
  /* wing and powerplant */
  const wx=x0+len*(S.cls==='pist'?0.36:0.42);
  if(S.cls==='tp'){ g.fillStyle='#303c47'; rr(g,wx-fh*0.9,top-fh*0.16,fh*2.4,fh*0.18,3); g.fill(); g.fillStyle='#3a4753'; rr(g,wx-fh*0.75,top-fh*0.42,fh*1.5,fh*0.3,fh*0.12); g.fill();
    line(g,wx-fh*0.82,top-fh*0.75,wx-fh*0.82,top-fh*0.0,'rgba(220,230,240,.55)',2); }
  else if(S.cls==='jet'){ g.fillStyle='#303c47'; rr(g,wx-fh*1.1,bot-fh*0.12,fh*2.9,fh*0.2,3); g.fill(); g.fillStyle='#3a4753'; rr(g,wx-fh*0.9,bot+fh*0.12,fh*1.25,fh*0.36,fh*0.17); g.fill();
    g.fillStyle='#1b232b'; g.beginPath(); g.ellipse(wx-fh*0.9,bot+fh*0.3,fh*0.06,fh*0.15,0,0,7); g.fill(); }
  else { g.fillStyle='#303c47'; rr(g,wx-fh*0.7,bot-fh*0.12,fh*2.2,fh*0.16,3); g.fill(); line(g,x0-2,cy-fh*0.6,x0-2,cy+fh*0.6,'rgba(220,230,240,.55)',2); }
  /* hull fill and the pressurised cabin */
  g.fillStyle='#1d262f'; hull(); g.fill();
  g.save(); hull(); g.clip();
  if(press){ g.fillStyle=`rgba(127,203,232,${(0.05+0.3*pr).toFixed(3)})`; g.fillRect(fb,top,ab-fb,fh); }
  else { g.fillStyle=`rgba(127,203,232,${(0.05+0.3*pr).toFixed(3)})`; g.fillRect(x0,top,x1-x0,fh); }
  /* fog: the air cools as it expands; below its dew point the moisture condenses */
  const fog=clamp((-M.T-2)/18,0,1);
  if(fog>0.01){ g.fillStyle=`rgba(235,240,245,${(0.55*fog).toFixed(3)})`; g.fillRect(fb,top,ab-fb,fh);
    for(let i=0;i<40;i++){ const fx=fb+((i*97+PH*30)%(ab-fb)), fy=top+((i*53)%fh); dot(g,fx,fy,1.4+((i*7)%3),`rgba(255,255,255,${(0.4*fog).toFixed(2)})`); } }
  g.restore();
  g.strokeStyle='rgba(214,226,236,.55)'; g.lineWidth=1.4; hull(); g.stroke();
  /* windows, floor, seats */
  const wy=cy-fh*0.12, nw=Math.floor((ab-fb-fh*0.6)/Math.max(10,fh*0.36));
  for(let i=0;i<nw;i++){ const x=fb+fh*0.4+i*(ab-fb-fh*0.6)/Math.max(1,nw-1); g.fillStyle='rgba(160,200,230,.35)'; rr(g,x-fh*0.05,wy-fh*0.08,fh*0.1,fh*0.15,2); g.fill(); }
  g.fillStyle='rgba(127,203,232,.35)'; g.beginPath(); g.moveTo(x0+fh*0.35,cy-fh*0.12); g.lineTo(x0+fh*0.6,top+fh*0.12); g.lineTo(x0+fh*0.95,top+fh*0.12); g.lineTo(x0+fh*0.95,cy-fh*0.12); g.closePath(); g.fill();
  line(g,fb,floorY,ab,floorY,'rgba(214,226,236,.35)',1.2);
  const ns=Math.max(3,Math.floor((ab-fb-fh*0.5)/Math.max(9,fh*0.3))), seats=[];
  for(let i=0;i<ns;i++){ const x=fb+fh*0.45+i*(ab-fb-fh*0.7)/Math.max(1,ns-1); seats.push(x); line(g,x,floorY-1,x+fh*0.05,floorY-fh*0.26,'rgba(200,210,220,.45)',2); line(g,x,floorY-fh*0.08,x-fh*0.12,floorY-fh*0.08,'rgba(200,210,220,.45)',2); }
  if(press){ /* pressure bulkheads */
    g.strokeStyle='rgba(214,226,236,.6)'; g.lineWidth=2; g.beginPath(); g.ellipse(ab,cy,fh*0.18,fh*0.48,0,-Math.PI/2,Math.PI/2); g.stroke();
    line(g,fb,top+2,fb,bot-2,'rgba(214,226,236,.45)',1.6); }
  const lab=(s,x,y,col,o)=>tag(g,s,x,y,col,Object.assign({sz:ph?9.5:10.5,minX:b[0],maxX:b[0]+b[2]},o||{}));
  if(!press){
    /* unpressurised: ram-air vents and the heater, cabin = outside */
    const vx=x0+fh*1.1; for(let i=0;i<2;i++){ const yy=cy-fh*0.05+i*fh*0.14; arrow(g,vx-fh*0.35,yy,vx+fh*0.2,yy,'rgba(127,203,232,.8)',1.6); }
    lab(L(t2('fresh-air vents, heater','friskluft, varme')),vx-fh*0.4,bot+fh*0.55,C.in);
    lab(L(t2('cabin altitude = aircraft altitude','kabinhøyde = flyets høyde')),(x0+x1)/2,top-fh*0.65,C.cab,{al:'center'});
  } else {
    /* bleed → pack → cabin */
    const ex=S.cls==='jet'?wx-fh*0.3:wx-fh*0.1, ey=S.cls==='jet'?bot+fh*0.3:top-fh*0.27, px=wx+fh*0.55, py=bot-fh*0.17;
    const flow=Math.max(0.15,Math.min(1,(TR.dec?TR.dec.inflow:c.pack)/c.pack)), on=!TR.dec||TR.dec.inflow>0;
    if(on){ poly(g,S.cls==='jet'?[[ex,ey],[ex,bot-fh*0.06],[px-fh*0.25,bot-fh*0.06]]:[[ex,ey],[ex,top+fh*0.05],[ex+fh*0.12,top+fh*0.05],[ex+fh*0.12,py],[px-fh*0.25,py]],C.bleed,2.2,[5,3]); }
    g.fillStyle='#34414d'; rr(g,px-fh*0.25,py-fh*0.1,fh*0.5,fh*0.2,2); g.fill(); g.strokeStyle='rgba(240,180,64,.6)'; g.lineWidth=1; g.stroke();
    txt(g,'PACK',px,py+fh*0.045,'#F0C470','center',Math.max(6.5,fh*0.09)/FS,700,SANS);
    if(on){ /* riser to the ceiling and the distribution duct */
      poly(g,[[px+fh*0.25,py],[px+fh*0.4,py],[px+fh*0.4,top+fh*0.1]],C.in,2); line(g,fb+fh*0.3,top+fh*0.1,ab-fh*0.4,top+fh*0.1,'rgba(127,203,232,.7)',2);
      const n=6; for(let i=0;i<n;i++){ const x=fb+fh*0.5+i*(ab-fb-fh*1.1)/(n-1), k=((PH*0.8*flow+i*0.37)%1); dot(g,x,top+fh*(0.16+0.3*k),1.6,`rgba(127,203,232,${(0.9*(1-k)).toFixed(2)})`); } }
    /* outflow valve: aft, low, opening from the mass balance */
    const ox=ab-fh*0.55, oy=bot-fh*0.02; let open=0;
    if(TR.dec){ const D=TR.dec; if(M.cab<=D.cab0+50){ const need=D.inflow-P.orifice(P.pressAt(M.cab)*100,P.pressAt(M.h)*100,TR.A); open=need>0?clamp(P.valveArea(need,P.pressAt(M.cab),P.pressAt(M.h))/(S.cls==='jet'?0.05:0.016),0,1):0; } }
    else { const a=P.valveArea(c.pack,P.pressAt(M.cab),P.pressAt(M.h)); open=clamp(a/(S.cls==='jet'?0.05:0.016),0,1); }
    const ow=fh*0.34; g.fillStyle='#0c1217'; g.fillRect(ox-ow/2,oy-2,ow,4); const ang=open*1.25;
    line(g,ox-ow/2,oy,ox-ow/2+Math.cos(ang)*ow,oy+Math.sin(ang)*ow,'#F0C470',2.6);
    if(open>0.02){ for(let i=0;i<3;i++){ const k=((PH*1.2+i/3)%1); arrow(g,ox+ow*0.1,oy+fh*0.05+k*fh*0.25,ox+ow*0.25+fh*0.5*(0.5+open),oy+fh*0.2+k*fh*0.3,`rgba(240,196,112,${(0.85*(1-k)).toFixed(2)})`,1.6); } }
    lab(L(t2('outflow valve','utløpsventil'))+' '+nf(open*100,0)+' %',ox,bot+fh*0.62,C.out,{al:'center'});
    /* relief valves on the aft bulkhead */
    const sx=ab-fh*0.1, sa=M.relief==='safety'||M.dp>=c.dpSafe-0.02, na=M.relief==='neg'||M.dp<=c.dpNeg+0.02;
    dot(g,sx,top+fh*0.22,fh*0.07,sa?'#EC5A47':'#2b3640','rgba(236,90,71,.8)',1.2); dot(g,sx,top+fh*0.42,fh*0.07,na?'#7FCBE8':'#2b3640','rgba(127,203,232,.8)',1.2);
    if(sa) arrow(g,sx+fh*0.08,top+fh*0.22,sx+fh*0.55,top-fh*0.08,'#EC5A47',1.8);
    if(na) arrow(g,sx+fh*0.55,top+fh*0.75,sx+fh*0.1,top+fh*0.45,'#7FCBE8',1.8);
    lab(short?L(t2('relief valves','avlastningsventiler')):L(t2('safety and negative relief valves','sikkerhets- og undertrykksventiler')),sx+fh*0.2,top-fh*0.62,sa?C.red:na?C.in:C.mut,{al:'center'});
    /* the cabin controller */
    const kx=x0+fh*1.05, ky=floorY+fh*0.16; g.fillStyle='#2b3640'; rr(g,kx-fh*0.22,ky-fh*0.08,fh*0.44,fh*0.16,2); g.fill(); g.strokeStyle='rgba(201,182,242,.7)'; g.lineWidth=1; g.stroke();
    poly(g,[[kx+fh*0.22,ky],[ox,ky],[ox,oy-3]],'rgba(201,182,242,.55)',1.2,[2,3]);
    lab(L(t2('cabin controller','kabintrykkregulator')),kx-fh*0.3,bot+fh*0.62,'#C9B6F2');
    if(!ph) lab(L(t2('bleed air → pack','bleed-luft → pakke')),S.cls==='jet'?ex-fh*0.6:ex-fh*0.4,S.cls==='jet'?bot+fh*1.1:top-fh*0.95,C.bleed,{dir:-1});
    /* the hole */
    if(TR.dec){ const D=TR.dec, hx=fb+(ab-fb)*0.62, big=S.mode==='rapid'&&S.hole==='door'&&S.holeA==null, hy=big?bot-fh*0.25:wy, hs=big?fh*0.38:fh*0.15;
      const leakNow=M.dp>0.05&&(D.kind!=='held'||S.mode==='slow');
      g.fillStyle='#05080b'; if(big) g.fillRect(hx-hs/2,hy-hs/2,hs,hs); else if(S.mode==='slow'){ g.fillRect(hx-fh*0.03,top+fh*0.18,fh*0.06,fh*0.6); } else { rr(g,hx-hs/3,hy-hs/2,hs*0.66,hs,3); g.fill(); }
      if(leakNow){ const k=clamp(M.dp/c.dpMax,0,1); for(let i=0;i<3;i++){ const q=((PH*1.6+i/3)%1); arrow(g,hx,top+fh*0.3,hx+fh*(0.1+0.25*i),top-fh*(0.25+0.6*k*q),`rgba(236,90,71,${(0.4+0.5*k).toFixed(2)})`,1.4+1.4*k); } }
      lab(S.mode==='slow'?L(t2('leaking door seal','lekk dørpakning')):big?L(t2('cargo door open','lastedør åpen')):L(t2('window lost','vindu borte')),hx,top-fh*(S.mode==='slow'?0.5:1.0),C.red,{al:'center',dir:-1}); }
  }
  /* masks */
  const ox2=oxy(M);
  if(press&&TR.dec&&TR.dec.t14!=null&&M.t>=TR.dec.t14){ seats.forEach((x,i)=>{ if(i%2) return; const yy=top+fh*0.32; line(g,x,top+fh*0.1,x,yy,'rgba(240,196,112,.7)',1); dot(g,x,yy+2,fh*0.035,ox2.genLeft>0?'#F0C470':'#5E6D7C'); }); }
  if(press&&ox2.crewOn){ dot(g,x0+fh*0.72,cy-fh*0.05,fh*0.05,'#71CC93'); }
  if(press&&TR.dec&&TR.dec.t14!=null&&M.t>=TR.dec.t14&&S.mode==='oxy'){ const gl=ox2.genLeft;
    lab(gl>0?L(t2('passenger O₂: ','passasjer-O₂: '))+fmtT(gl)+L(t2(' left',' igjen')):L(t2('passenger O₂ used up','passasjer-O₂ brukt opp')),(fb+ab)/2,bot+fh*1.1,gl>0?C.ok:C.red,{al:'center'}); }
}

/* altitude–time chart with the ΔP strip */
function drawChart(g,M,b){ const [bx,by,bw,bh]=b, c=P.CLS[S.cls], ph=ST.w<640, a=TR.pts, sq=TR.sq;
  const pl=ph?38:48, pr=8, top0=by+16, dpH=c.press?bh*0.2:0, axisH=26, altB=by+bh-axisH-dpH-(c.press?10:0);
  const X=t=>bx+pl+uAt(t)*(bw-pl-pr), maxA=Math.max(...a.map(p=>p.h)), topA=Math.max(15000,Math.ceil((maxA+4000)/5000)*5000), Y=h=>altB-h/topA*(altB-top0);
  g.fillStyle='rgba(255,255,255,.025)'; g.fillRect(bx+pl,top0,bw-pl-pr,altB-top0);
  for(let h=0;h<=topA;h+=topA>30000?10000:5000){ line(g,bx+pl,Y(h)+.5,bx+bw-pr,Y(h)+.5,C.grid,1); txt(g,h?nf(h/1000,0)+'k':'0',bx+pl-5,Y(h)+3.5,C.mut,'right',9.5); }
  if(!ph) txt(g,L(t2('altitude (ft)','høyde (ft)')),bx+pl,by+10,C.mut,'left',9.5,600,SANS);
  /* thresholds */
  const thr=[]; if(c.press){ thr.push([10000,C.amb,t2('cabin altitude warning ≈ 10 000','kabinhøydevarsel ≈ 10 000')]); if(S.mode!=='norm') thr.push([14000,C.red,t2('passenger masks ≈ 14 000','passasjermasker ≈ 14 000')]); }
  else { thr.push([10000,C.amb,t2('10 000: crew O₂ after 30 min (NCO)','10 000: O₂ for besetning etter 30 min (NCO)')],[13000,C.red,t2('13 000: everyone on O₂','13 000: alle på O₂')]); if(S.rule!=='nco'&&S.mode==='oxy') thr[0][2]=t2('10 000: crew O₂ (CAT)','10 000: O₂ for besetning (CAT)'); }
  thr.forEach(([h,col,t],i)=>{ if(h>topA) return; line(g,bx+pl,Y(h)+.5,bx+bw-pr,Y(h)+.5,col,1,[4,4]); if(!ph||i===0) tag(g,L(t),bx+pl+(bw-pl-pr)*0.5,Y(h)-(i?9:-9),col,{al:'center',sz:9.5,wt:500,font:MONO,bg:true}); });
  /* reaction band in the rapid modes */
  if(TR.dec&&S.mode!=='slow'){ const x2=X(S.react); g.fillStyle='rgba(240,180,64,.08)'; g.fillRect(bx+pl,top0,x2-bx-pl,altB-top0); if(x2-bx-pl>40&&!ph) txt(g,L(t2('masks on','masker på')),bx+pl+4,top0+12,'#F0C470','left',9.5,600,SANS); }
  /* passenger oxygen bar */
  if(S.mode==='oxy'&&TR.dec&&TR.dec.t14!=null){ const t0=TR.dec.t14, t1=t0+S.gen*60, yb=altB-8; g.fillStyle='rgba(113,204,147,.35)'; g.fillRect(X(t0),yb,Math.max(2,X(Math.min(t1,TR.T))-X(t0)),6);
    const after=a.find(p=>p.t>t1); if(after&&after.cab>13000){ g.fillStyle='rgba(236,90,71,.5)'; g.fillRect(X(t1),yb,X(TR.T)-X(t1),6); }
    txt(g,L(t2('passenger O₂','passasjer-O₂'))+' '+S.gen+' min',X(t0)+3,yb-4,C.ok,'left',9.5,600,SANS); }
  /* aircraft and cabin, with the ΔP gap shaded */
  g.fillStyle='rgba(240,154,200,.08)'; g.beginPath(); a.forEach((p,i)=>i?g.lineTo(X(p.t),Y(p.h)):g.moveTo(X(p.t),Y(p.h))); for(let i=a.length-1;i>=0;i--) g.lineTo(X(a[i].t),Y(a[i].cab)); g.closePath(); g.fill();
  poly(g,a.map(p=>[X(p.t),Y(p.h)]),C.ac,2); if(c.press) poly(g,a.map(p=>[X(p.t),Y(p.cab)]),C.cab,2.4);
  /* labels on the lines */
  const pick=f=>a[Math.round(clamp(f,0,1)*(a.length-1))]; const la=S.mode==='norm'&&TR.sched?a.find(p=>p.t>=TR.sched.tc*60*0.55):pick(0.25);
  tag(g,L(t2('aircraft','fly')),X(la.t)+(S.mode==='norm'?-8:0),Y(la.h)+(S.mode==='norm'?0:-10),C.ac,{al:S.mode==='norm'?'right':'center',sz:10.5,dir:-1,minX:bx+pl});
  if(c.press){ const lc=pick(S.mode==='norm'?0.5:0.72); tag(g,L(t2('cabin','kabin')),X(lc.t),Y(lc.cab)+(lc.h-lc.cab<2500?-12:12),C.cab,{al:'center',sz:10.5,minX:bx+pl}); }
  if(S.mode==='norm'&&TR.sched){ const s=TR.sched, mid=(t0,t1,t)=>{ const x=(X(t0*60)+X(t1*60))/2; if(X(t1*60)-X(t0*60)>50) txt(g,L(t),x,altB-6,C.dim,'center',9.5,600,SANS); };
    mid(0,s.tc,t2('climb','stigning')); mid(s.tc,s.tc+s.tcr,t2('cruise','marsj')); mid(s.tc+s.tcr,s.tc+s.tcr+s.td,t2('descent','nedstigning')); }
  if(TR.dec&&TR.dec.tEnd!=null&&S.mode!=='norm'){ const p=a.find(q=>q.t>(TR.dec.tEnd*0.55)); if(p&&!ph) tag(g,L(t2('emergency descent','nødnedstigning')),X(p.t)+8,Y(p.h)-2,C.mut,{sz:9.5,dir:-1}); }
  /* ΔP strip */
  if(c.press){ const d0=altB+10, d1=d0+dpH, dmin=-1, dmax=c.dpSafe+0.6, DY=v=>d1-(v-dmin)/(dmax-dmin)*(d1-d0);
    g.fillStyle='rgba(255,255,255,.025)'; g.fillRect(bx+pl,d0,bw-pl-pr,d1-d0);
    line(g,bx+pl,DY(0)+.5,bx+bw-pr,DY(0)+.5,'rgba(200,215,225,.25)',1); line(g,bx+pl,DY(c.dpMax)+.5,bx+bw-pr,DY(c.dpMax)+.5,'rgba(240,180,64,.5)',1,[3,3]); line(g,bx+pl,DY(c.dpSafe)+.5,bx+bw-pr,DY(c.dpSafe)+.5,'rgba(236,90,71,.5)',1,[3,3]);
    txt(g,'0',bx+pl-5,DY(0)+3.5,C.mut,'right',9.5); txt(g,nf(c.dpMax,1),bx+pl-5,DY(c.dpMax)+3.5,'#F0C470','right',9.5);
    txt(g,'ΔP',bx+2,(d0+d1)/2+4,C.dp,'left',10,700,SANS);
    poly(g,a.map(p=>[X(p.t),DY(clamp(p.dp,dmin,dmax))]),C.dp,2);
    dot(g,X(M.t),DY(clamp(M.dp,dmin,dmax)),3.5,C.dp); }
  /* time axis */
  const ya=by+bh-axisH+14, Tm=TR.T; let ticks;
  if(sq) ticks=[0,5,15,30,60,120,240,480,900].filter(s=>s<=Tm); else { const st=Tm>5400?1800:Tm>2400?600:Tm>900?300:60; ticks=[]; for(let s=0;s<=Tm;s+=st) ticks.push(s); }
  let lastX=-99; ticks.forEach(s=>{ const x=X(s); if(x-lastX<26) return; lastX=x; line(g,x,altB,x,altB+3,C.mut,1); txt(g,s<60&&s?s+' s':(s/60)+(s?' min':''),x,ya,C.mut,'center',9.5); });
  if(sq&&!ph) txt(g,L(t2('time (stretched: the first seconds are wide)','tid (strukket: de første sekundene er brede)')),bx+bw-pr,by+bh-1,C.dim,'right',9);
  /* playhead */
  const xp=X(M.t); line(g,xp+.5,top0,xp+.5,c.press?altB+10+dpH:altB,'rgba(238,242,245,.45)',1);
  dot(g,xp,Y(M.h),4.5,C.ac); if(c.press) dot(g,xp,Y(M.cab),4.5,C.cab,'#0c1217',1.2);
}

/* hypoxia panel: TUC against altitude, stage bands, the cabin marker, and the oxygen rule */
const STG={ind:[t2('indifferent','indifferent'),'rgba(113,204,147,.10)',t2('Night vision is the first to suffer (from about 5 000 ft at night). Otherwise you feel and perform normally.','Nattsynet svekkes først (fra rundt 5 000 ft om natten). Ellers føler og presterer du normalt.')],
  comp:[t2('compensatory','kompensatorisk'),'rgba(240,180,64,.10)',t2('Breathing and heart rate rise to compensate. Judgement, memory and reaction time already suffer; you may not notice.','Pust og puls øker for å kompensere. Dømmekraft, hukommelse og reaksjonstid er allerede svekket; du merker det kanskje ikke.')],
  dist:[t2('disturbance','forstyrrelse'),'rgba(236,140,71,.12)',t2('Clear symptoms: euphoria or headache, poor judgement, tunnel vision, tingling, cyanosis, poor coordination.','Tydelige symptomer: eufori eller hodepine, dårlig dømmekraft, tunnelsyn, prikking, cyanose, dårlig koordinasjon.')],
  crit:[t2('critical','kritisk'),'rgba(236,90,71,.16)',t2('Rapid loss of the ability to act, then of consciousness. Often no warning feeling at all.','Rask tap av evnen til å handle, så av bevisstheten. Ofte ingen følelse av fare i det hele tatt.')]};
function drawHypoxia(g,M,b){ const [bx,by,bw,bh]=b, ph=ST.w<760, maxH=45000, pl=ph?38:48, pr=ph?8:12;
  const textW=ph?0:Math.min(330,bw*0.34), pw=bw-pl-pr-textW-(ph?0:14), x0=bx+pl, y0=by+18, y1=by+bh-(ph?40:22);
  const X=h=>x0+clamp(h,0,maxH)/maxH*pw, lg=s=>Math.log(s), Y=s=>y1-(lg(clamp(s,8,2400))-lg(8))/(lg(2400)-lg(8))*(y1-y0);
  g.fillStyle='rgba(255,255,255,.03)'; rr(g,bx,by,bw,bh,6); g.fill();
  [[0,10000,'ind'],[10000,15000,'comp'],[15000,20000,'dist'],[20000,maxH,'crit']].forEach(([a,c,k])=>{ g.fillStyle=STG[k][1]; g.fillRect(X(a),y0,X(c)-X(a),y1-y0); const t=L(STG[k][0]); g.font=`600 ${9.5*FS}px ${SANS}`; if(g.measureText(t).width<X(c)-X(a)-6) txt(g,t,(X(a)+X(c))/2,y0+11,C.mut,'center',9.5,600,SANS); });
  for(let h=0;h<=maxH;h+=ph?15000:5000) txt(g,nf(h/1000,0)+'k',X(h),y1+12,C.mut,'center',9);
  txt(g,L(t2('time of useful consciousness vs altitude (at rest, typical)','tid med nyttig bevissthet mot høyde (i ro, typisk)')),bx+pl,by+11,C.mut,'left',9.5,600,SANS);
  (bh<170?[[60,'1 min'],[300,'5 min'],[1800,'30 min']]:[[30,'30 s'],[60,'1 min'],[300,'5 min'],[1800,'30 min']]).forEach(([s,t])=>{ line(g,x0,Y(s)+.5,x0+pw,Y(s)+.5,C.grid,1); txt(g,t,x0-5,Y(s)+3.5,C.mut,'right',9); });
  const curve=[]; for(let h=15000;h<=maxH;h+=250) curve.push([X(h),Y(P.tuc(h))]); poly(g,curve,'#EEF2F5',2);
  const rapid=TR.dec&&(TR.dec.kind==='rapid'||TR.dec.kind==='explosive')&&S.mode!=='slow';
  if(rapid){ const c2=[]; for(let h=15000;h<=maxH;h+=250) c2.push([X(h),Y(P.tuc(h,true))]); poly(g,c2,'rgba(238,242,245,.45)',1.4,[4,3]); if(!ph) txt(g,L(t2('after rapid decompression: about half','etter rask dekompresjon: omtrent halvparten')),X(26000),y0+26,C.mut,'left',9); }
  /* the cabin marker (no oxygen) and, with masks, the crew equivalent */
  const cab=M.cab, xc=X(cab); line(g,xc+.5,y0,xc+.5,y1,'rgba(240,154,200,.75)',1.5);
  const tu=P.tuc(cab,rapid); if(tu!=null) dot(g,xc,Y(tu),5,C.cab,'#0c1217',1.2);
  const st=P.stage(cab);
  const ox=oxy(M); let eqTxt=null;
  if(S.mode==='oxy'&&(ox.crewOn||!isP())&&(isP()||cab>10000)){ const f=crewFio2(cab), eq=P.eqAir(P.pao2(cab,f)), xe=X(Math.max(0,eq)); line(g,xe+.5,y0,xe+.5,y1,'rgba(113,204,147,.8)',1.5,[3,3]); dot(g,xe,y1-6,4,C.ok);
    eqTxt=L(t2(`Crew mask (${S.mask==='N'?'N, diluter: '+nf(f*100,0)+' % O₂':S.mask==='100'?'100 %':'EMERGENCY, 100 % + overpressure'}) ≈ air at ${ft100(Math.max(0,eq))}.`,`Besetningsmaske (${S.mask==='N'?'N, fortynning: '+nf(f*100,0)+' % O₂':S.mask==='100'?'100 %':'NØD, 100 % + overtrykk'}) ≈ luft i ${ft100(Math.max(0,eq))}.`)); }
  tag(g,L(t2('cabin','kabin'))+' '+ft100(cab),xc,y1-10,C.cab,{al:cab>maxH*0.7?'right':'left',sz:9.5,minX:x0,maxX:x0+pw});
  /* the text column (below the plot on phones) */
  const tx0=ph?bx+8:x0+pw+18, tw=ph?bw-16:textW-8; let ty=ph?y1+26:by+16;
  const wrap=(s,col,sz,wt)=>{ s=s.replace(/(\d) (\d{3})/g,'$1\u00a0$2'); g.font=`${wt||500} ${sz*FS}px ${SANS}`; const words=s.split(' '); let l=''; const lh=sz*FS*1.35;
    for(const w of words){ const t=l?l+' '+w:w; if(g.measureText(t).width>tw&&l){ g.fillStyle=col; g.fillText(l,tx0,ty); ty+=lh; l=w; } else l=t; } if(l){ g.fillStyle=col; g.fillText(l,tx0,ty); ty+=lh; } ty+=3; };
  const sat=P.sat(P.pao2(cab));
  if(ph){ wrap(L(STG[st][0]).replace(/^./,m=>m.toUpperCase())+' · '+(tu==null?L(t2('TUC not limiting','TUC ikke begrensende')):'TUC ≈ '+fmtT(tu))+' · SpO₂ ≈ '+nf(sat,0)+' %',st==='ind'?C.ok:st==='comp'?C.amb:C.red,10.5,600); return; }
  wrap(L(STG[st][0]).replace(/^./,m=>m.toUpperCase())+(tu==null?' · '+L(t2('TUC not limiting','TUC ikke begrensende')):' · TUC ≈ '+fmtT(tu)),st==='ind'?C.ok:st==='comp'?C.amb:C.red,12,700);
  wrap(L(t2('Breathing cabin air: blood oxygen about ','Puster kabinluft: oksygenmetning rundt '))+nf(sat,0)+' %.',C.txt,10.5);
  wrap(L(STG[st][2]),C.mut,10.5);
  if(eqTxt) wrap(eqTxt,C.ok,10.5,600);
  if(S.mode==='oxy'){ const r=P.o2Rule(rule(),cab,minsAbove10(M.t)), rn=rule()==='nco'?'NCO':rule()==='catp'?L(t2('CAT, pressurised','CAT, trykkabin')):L(t2('CAT, unpressurised','CAT, uten trykkabin'));
    wrap(`EASA (${rn}): `+L(t2('crew ','besetning '))+(r.crew?L(t2('must use O₂','må bruke O₂')):L(t2('no O₂ needed yet','trenger ikke O₂ ennå')))+' · '+L(t2('passengers ','passasjerer '))+(r.pax?r.pax+' %':L(t2('none','ingen'))),r.crew||r.pax?C.amb:C.mut,10.5,600); }
}

/* ---------------- readout chip, legend, what you're seeing ---------------- */
function readout(){ const M=cur(), c=P.CLS[S.cls], ch=(k,v,cl)=>`<span><i>${k}</i><b class="${cl||''}">${v}</b></span>`;
  let h=ch(L(t2('Aircraft','Fly')),M.h>=10000&&S.mode!=='oxy'?fl(M.h):ft100(M.h))+ch(L(t2('Cabin','Kabin')),ft100(M.cab),M.cab>10000?'r':'m');
  if(c.press) h+=ch('ΔP',psi(M.dp),M.dp>c.dpMax+0.05||M.dp<-0.05?'a':'')+ch(L(t2('Cabin rate','Kabinrate')),sg(Math.round(M.vs/50)*50)+' ft/min',Math.abs(M.vs)>1500?'r':Math.abs(M.vs)>600?'a':'');
  if(TR.dec&&S.mode!=='slow') h+=ch(L(t2('Cabin air','Kabinluft')),nf(M.T,0)+' °C',M.T<-2?'a':'');
  el('chip').innerHTML=h; el('xsv').textContent=L(CLS_SHORT[S.cls])+' · '+L(VIEWS.find(v=>v[0]===S.mode)[1]); }
function legend(){ const lg=(c,t,k)=>`<span><i class="${k||''}" style="--c:${c}"></i>${L(t)}</span>`, p=isP();
  let s=lg(C.ac,t2('aircraft altitude','flyets høyde'))+(p?lg(C.cab,t2('cabin altitude','kabinhøyde'))+lg(C.dp,t2('differential pressure ΔP','differansetrykk ΔP')):'');
  if(p) s+=lg(C.bleed,t2('bleed air','bleed-luft'),'d')+lg(C.in,t2('conditioned air in','kondisjonert luft inn'))+lg(C.out,t2('air out','luft ut'));
  if(S.mode==='oxy') s+=lg(C.ok,t2('on oxygen','på oksygen'));
  el('vleg').innerHTML=s; }
function see(){ const M=cur(), c=P.CLS[S.cls], D=TR.dec; let t;
  if(!isP()&&S.mode!=='oxy') t=t2(`<b>No pressurisation.</b> The cabin is always at the aircraft's altitude, ${ft100(M.h)} now. Above 10 000 ft the blood starts to carry noticeably less oxygen, so oxygen rules start there. Look at the hypoxia panel.`,`<b>Ingen trykkabin.</b> Kabinen er alltid i flyets høyde, nå ${ft100(M.h)}. Over 10 000 ft begynner blodet å bære merkbart mindre oksygen, så oksygenreglene starter der. Se på hypoksipanelet.`);
  else if(S.mode==='norm'){ const ldg=S.ldgMode==='auto'?S.dest:S.ldg, tdp=TR.sched.pts.find(p=>p.ph==='ground').dp;
    if(S.ldgMode==='man'&&ldg<S.dest-500) t=t2(`<b>Landing elevation set too low.</b> The controller brings the cabin down to ${ft(ldg)}, so the aircraft touches down with ${psi(tdp)} still in the cabin and the cabin descends faster than needed. Never open a door against residual pressure.`,`<b>Landingshøyden er satt for lavt.</b> Regulatoren tar kabinen ned til ${ft(ldg)}, så flyet lander med ${psi(tdp)} fortsatt i kabinen, og kabinen synker raskere enn nødvendig. Åpne aldri en dør mot resttrykk.`);
    else if(S.ldgMode==='man'&&ldg>S.dest+500) t=t2('<b>Landing elevation set too high.</b> Late in the descent the aircraft goes below the planned cabin: ΔP turns negative and the negative relief valve opens. Passengers feel a sudden pressure change.','<b>Landingshøyden er satt for høyt.</b> Sent i nedstigningen kommer flyet under den planlagte kabinen: ΔP blir negativ og undertrykksventilen åpner. Passasjerene kjenner en brå trykkendring.');
    else t=t2(`<b>What you're seeing:</b> the packs push in a steady flow; the controller sets the cabin by how far the outflow valve is open. At ${fl(S.H[S.cls])} the outside is ${psi(P.psi(P.pressAt(S.H[S.cls])))}; with up to ${nf(c.dpMax,1)} psi of ΔP the cabin sits at ${ft100(TR.sched.Ccr)}. The cabin climb is spread over the whole climb, so its rate stays at a few hundred ft/min.`,`<b>Det du ser:</b> pakkene gir en jevn luftstrøm; regulatoren bestemmer kabintrykket med hvor mye utløpsventilen er åpen. I ${fl(S.H[S.cls])} er trykket ute ${psi(P.psi(P.pressAt(S.H[S.cls])))}; med opptil ${nf(c.dpMax,1)} psi ΔP ligger kabinen på ${ft100(TR.sched.Ccr)}. Kabinstigningen spres over hele stigningen, så raten holder seg på noen hundre ft/min.`); }
  else if(S.mode==='rapid') t=D.kind==='held'? t2('<b>The packs win:</b> the outflow valve closes a little and the cabin holds.','<b>Pakkene vinner:</b> utløpsventilen lukker litt, og kabinen holdes.')
    : t2(`<b>${D.kind==='explosive'?'Explosive':'Rapid'} decompression:</b> the cabin passes 10 000 ft after ${fmtT(D.t10)} and the passenger masks drop after ${fmtT(D.t14)}, long before anyone can react. The expanding air cools to about ${nf(D.Tmin,0)} °C, so the moisture condenses into fog. Masks on first, then the emergency descent. TUC at the peak cabin altitude, ${ft100(D.peak)}: about ${fmtT(P.tuc(D.peak,true))}.`,`<b>${D.kind==='explosive'?'Eksplosiv':'Rask'} dekompresjon:</b> kabinen passerer 10 000 ft etter ${fmtT(D.t10)}, og passasjermaskene faller etter ${fmtT(D.t14)}, lenge før noen rekker å reagere. Luften som utvider seg, kjøles til rundt ${nf(D.Tmin,0)} °C, så fuktigheten kondenserer til tåke. Masker på først, så nødnedstigningen. TUC ved høyeste kabinhøyde, ${ft100(D.peak)}: rundt ${fmtT(P.tuc(D.peak,true))}.`);
  else if(S.mode==='slow') t=D.kind==='held'? t2('<b>The leak is absorbed:</b> it lets out less than the packs bring in, so the outflow valve just closes further. Lose a pack, or make the leak bigger, and the cabin starts to climb.','<b>Lekkasjen tas opp:</b> den slipper ut mindre enn pakkene tar inn, så utløpsventilen lukker bare mer. Mist en pakke eller gjør lekkasjen større, og kabinen begynner å stige.')
    : t2(`<b>The sneaky one.</b> No bang, no fog: the cabin creeps up and the first sign may be the cabin altitude warning after ${fmtT(D.t10)}, or the hypoxia itself. The cabin peaks at ${ft100(D.peak)}${D.t14!=null?' and the masks drop':''}. Treat a cabin altitude warning as real: masks on, then troubleshoot or descend.`,`<b>Den lumske.</b> Ingen smell, ingen tåke: kabinen kryper oppover, og det første tegnet kan være kabinhøydevarselet etter ${fmtT(D.t10)}, eller selve hypoksien. Kabinen topper på ${ft100(D.peak)}${D.t14!=null?', og maskene faller':''}. Behandle et kabinhøydevarsel som ekte: masker på, så feilsøk eller gå ned.`);
  else if(!isP()) t=t2('<b>Oxygen in an unpressurised aircraft:</b> the cabin is at the aircraft altitude. Under EASA NCO rules, if the pilot cannot judge the effect, the crew must use oxygen after 30 minutes between 10 000 and 13 000 ft, and everyone on board above 13 000 ft. Commercial (CAT) rules are stricter for the crew: oxygen whenever above 10 000 ft.','<b>Oksygen uten trykkabin:</b> kabinen er i flyets høyde. Etter EASA NCO-reglene, hvis fartøysjefen ikke kan vurdere virkningen, må besetningen bruke oksygen etter 30 minutter mellom 10 000 og 13 000 ft, og alle om bord over 13 000 ft. Kommersielle regler (CAT) er strengere for besetningen: oksygen hele tiden over 10 000 ft.');
  else { const t1=D.t14!=null?D.t14+S.gen*60:null, p=t1!=null?TR.pts.find(q=>q.t>=t1):null, ok=!p||p.cab<=13000;
    t=ok? t2(`<b>Oxygen for the descent:</b> the chemical generators give about ${S.gen} minutes once started, and the emergency descent brings the cabin below 13 000 ft well within that. The crew is on its own bottle through quick-donning masks.`,`<b>Oksygen for nedstigningen:</b> de kjemiske generatorene gir rundt ${S.gen} minutter når de er startet, og nødnedstigningen tar kabinen under 13 000 ft godt innenfor det. Besetningen har egen flaske via hurtigmasker.`)
      : t2(`<b>The generators run out at ${ft100(p.cab)} cabin altitude.</b> With high terrain the aircraft cannot descend far enough, and ${S.gen} minutes of chemical oxygen is not enough. Routes like this need escape routes planned in advance, or a gaseous passenger system.`,`<b>Generatorene går tomme i ${ft100(p.cab)} kabinhøyde.</b> Med høyt terreng kan ikke flyet gå langt nok ned, og ${S.gen} minutter kjemisk oksygen er ikke nok. Slike ruter krever planlagte rømningsveier, eller et passasjersystem med gassflasker.`); }
  el('xsee').innerHTML=L(t); }

/* ---------------- tabs and play ---------------- */
const VIEWS=[['norm',t2('Normal climb & descent','Normal stigning og nedstigning')],['rapid',t2('Rapid decompression','Rask dekompresjon')],['slow',t2('Slow leak','Langsom lekkasje')],['oxy',t2('Oxygen','Oksygen')]];
function drawTabs(){ el('vtabs').innerHTML=VIEWS.map(([k,t])=>{ const dis=!isP()&&(k==='rapid'||k==='slow'); return `<button type="button" role="tab" data-v="${k}" class="${k===S.mode?'on':''}" aria-selected="${k===S.mode}"${dis?` aria-disabled="true" title="${L(t2('No pressurisation in this class','Ingen trykkabin i denne klassen'))}"`:''}>${L(t)}</button>`; }).join(''); }
el('vtabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(b.getAttribute('aria-disabled')==='true'){ el('xsee').innerHTML=L(t2('<b>An unpressurised piston has no cabin pressure to lose.</b> Pick the turboprop or the jet to see a decompression.','<b>Et stempelfly uten trykkabin har ikke noe kabintrykk å miste.</b> Velg turbopropen eller jetflyet for å se en dekompresjon.')); return; } setMode(b.dataset.v); });
function drawTools(){ el('vtools').innerHTML=`<button type="button" id="pBtn" aria-pressed="${S.play}" aria-label="${L(S.play?t2('Pause','Pause'):t2('Play','Spill av'))}">${S.play?'❚❚':'▶'}</button><button type="button" id="rBtn" aria-label="${L(t2('Back to the start','Tilbake til start'))}">↺</button>`; }
el('vtools').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(b.id==='pBtn'){ if(S.u>=1) S.u=0; S.play=!S.play; } else { S.u=0; S.play=!reduce; } drawTools(); kick(); upd(); });
function setMode(m,keep){ if(!VIEWS.some(v=>v[0]===m)) m='norm'; if(!isP()&&(m==='rapid'||m==='slow')) S.cls='tp';
  S.mode=m; el('xpanel').querySelectorAll('[data-pv]').forEach(d=>{ d.hidden=!d.dataset.pv.split(' ').includes(m); });
  rebuild(); if(!keep){ S.u=m==='norm'?0.3:0; S.play=!reduce&&m!=='norm'; if(reduce&&m!=='norm') S.u=1; } drawTabs(); drawTools(); drawPre(); syncCtl(); upd(); kick(); }
function rebuild(){ build(); }

/* ---------------- controls ---------------- */
LAB.add({},{'Cruise level':'Marsjhøyde','Departure elevation':'Avgangsflyplassens høyde','Destination elevation':'Destinasjonens høyde','Selected landing elevation':'Valgt landingshøyde','Altitude at the decompression':'Høyde ved dekompresjonen',
 'Crew reaction time':'Besetningens reaksjonstid','Leak size':'Lekkasjestørrelse','Crew reaction after the warning':'Besetningens reaksjon etter varselet','Level-off altitude (terrain)':'Utflatingshøyde (terreng)','Point in time':'Tidspunkt','Hole size (equivalent area)':'Hullstørrelse (ekvivalent areal)',
 'Auto (FMS)':'Auto (FMS)','Manual':'Manuell','Both':'Begge','One':'Én','N (diluter)':'N (fortynning)','100 %':'100 %','EMERG':'NØD','12 min':'12 min','15 min':'15 min','22 min':'22 min','Commercial (CAT)':'Kommersiell (CAT)','Non-commercial (NCO)':'Ikke-kommersiell (NCO)',
 'Piston':'Stempel','Turboprop':'Turboprop','Jet':'Jet','Window':'Vindu','Cargo door':'Lastedør'});
const sl={};
const fmtA=a=>a<0.1? nf(a*1e4,0)+' cm²' : nf(a,2)+' m²';
sl.H=LAB.slider(el('flCtl'),{label:'Cruise level',min:3000,max:41000,step:500,v:S.H[S.cls],f:v=>v>=10000?fl(v):ft(v),on:v=>{ S.H[S.cls]=v; rebuild(); upd(); }});
sl.dest=LAB.slider(el('flCtl'),{label:'Destination elevation',min:0,max:8000,step:100,v:S.dest,f:v=>ft(v),on:v=>{ S.dest=v; rebuild(); upd(); }});
const ldgSeg=LAB.seg(el('ldgSeg'),[['auto','Auto (FMS)'],['man','Manual']],S.ldgMode,v=>{ S.ldgMode=v; if(v==='man') S.ldg=S.dest; syncCtl(); rebuild(); upd(); });
sl.ldg=LAB.slider(el('ldgCtl'),{label:'Selected landing elevation',min:-1000,max:8000,step:100,v:S.ldg,f:v=>ft(v),on:v=>{ S.ldg=v; rebuild(); upd(); }});
const holeSeg=LAB.seg(el('holeSeg'),[['window','Window'],['door','Cargo door']],S.hole,v=>{ S.hole=v; S.holeA=null; restart(); });
sl.rH=LAB.slider(el('rpCtl'),{label:'Altitude at the decompression',min:15000,max:41000,step:1000,v:S.rH[S.cls],f:v=>fl(v),on:v=>{ S.rH[S.cls]=v; restart(); }});
sl.react=LAB.slider(el('rpCtl'),{label:'Crew reaction time',min:5,max:60,step:1,v:S.react,f:v=>v+' s',on:v=>{ S.react=v; restart(); }});
sl.leak=LAB.slider(el('lkCtl'),{label:'Leak size',min:Math.log10(0.001),max:Math.log10(0.05),step:0.02,v:Math.log10(S.leak),f:v=>fmtA(Math.pow(10,v)),on:v=>{ S.leak=Math.pow(10,v); restart(); }});
sl.lreact=LAB.slider(el('lkCtl'),{label:'Crew reaction after the warning',min:10,max:300,step:10,v:S.lreact,f:v=>fmtT(v),on:v=>{ S.lreact=v; restart(); }});
const pkSeg=LAB.seg(el('pkSeg'),[['1','Both'],['0.5','One']],String(S.packs),v=>{ S.packs=+v; restart(); });
const mkSeg=LAB.seg(el('mkSeg'),[['N','N (diluter)'],['100','100 %'],['E','EMERG']],S.mask,v=>{ S.mask=v; upd(); });
const gnSeg=LAB.seg(el('gnSeg'),[['12','12 min'],['15','15 min'],['22','22 min']],String(S.gen),v=>{ S.gen=+v; rebuild(); upd(); });
const ruSeg=LAB.seg(el('ruSeg'),[['cat','Commercial (CAT)'],['nco','Non-commercial (NCO)']],S.rule,v=>{ S.rule=v; upd(); });
sl.msa=LAB.slider(el('oxCtl'),{label:'Level-off altitude (terrain)',min:10000,max:16000,step:500,v:S.msa,f:v=>ft(v),on:v=>{ S.msa=v; restart(); }});
sl.u=LAB.slider(el('tCtl'),{label:'Point in time',min:0,max:1000,step:1,v:0,f:v=>TR?fmtT(tAt(v/1000)):'',on:v=>{ S.u=v/1000; S.play=false; drawTools(); upd(); }});
sl.hA=LAB.slider(el('adv2'),{label:'Hole size (equivalent area)',min:-3,max:Math.log10(2),step:0.02,v:Math.log10(0.1),f:v=>fmtA(Math.pow(10,v)),on:v=>{ S.holeA=Math.pow(10,v); if(S.mode!=='rapid') setMode('rapid',true); restart(); }});
const clsSeg=LAB.seg(el('clsSeg'),[['pist','Piston'],['tp','Turboprop'],['jet','Jet']],S.cls,v=>setCls(v));
function setCls(v){ S.cls=v; if(!isP()&&(S.mode==='rapid'||S.mode==='slow')) S.mode='norm'; setMode(S.mode); }
function restart(){ rebuild(); S.u=0; S.play=!reduce; if(reduce) S.u=1; drawTools(); upd(); kick(); }
function syncCtl(){ const c=P.CLS[S.cls]; clsSeg.set(S.cls);
  sl.H.inp.max=c.ceil; sl.H.inp.min=S.cls==='pist'?3000:10000; sl.H.set(S.H[S.cls]); sl.dest.set(S.dest); ldgSeg.set(S.ldgMode); sl.ldg.el.hidden=S.ldgMode!=='man'||!isP(); el('ldgSeg').hidden=!isP(); el('ldgL').hidden=!isP(); sl.ldg.set(S.ldg);
  sl.rH.inp.max=c.ceil||41000; sl.rH.set(S.rH[S.cls]||25000); sl.react.set(S.react); holeSeg.set(S.holeA==null?S.hole:''); sl.leak.set(Math.log10(S.leak)); sl.lreact.set(S.lreact); pkSeg.set(String(S.packs));
  mkSeg.set(S.mask); gnSeg.set(String(S.gen)); ruSeg.set(S.rule); sl.msa.set(S.msa); sl.msa.el.hidden=!isP();
  ['mkL','gnL'].forEach(k=>el(k).hidden=!isP()); el('mkSeg').hidden=!isP(); el('gnSeg').hidden=!isP();
  el('clsH').textContent=L(S.cls==='pist'?t2('Typical: no pressurisation, ceiling about 18 000 ft (turbocharged).','Typisk: ingen trykkabin, tak rundt 18 000 ft (turbo).'):S.cls==='tp'?t2(`Typical: max ΔP ${nf(c.dpMax,1)} psi, ceiling about FL300, small cabin.`,`Typisk: maks ΔP ${nf(c.dpMax,1)} psi, tak rundt FL300, liten kabin.`):t2(`Typical: max ΔP ${nf(c.dpMax,1)} psi, ceiling about FL410, large cabin.`,`Typisk: maks ΔP ${nf(c.dpMax,1)} psi, tak rundt FL410, stor kabin.`)); }
function advRo(){ const M=cur(), c=P.CLS[S.cls]; const rows=[[t2('Outside pressure','Trykk ute'),nf(P.pressAt(M.h),0)+' hPa · '+psi(P.psi(P.pressAt(M.h)))],[t2('Cabin pressure','Kabintrykk'),nf(P.pressAt(M.cab),0)+' hPa · '+psi(P.psi(P.pressAt(M.cab)))],[t2('Outside air (ISA)','Luft ute (ISA)'),nf(P.isaTemp(M.h),0)+' °C']];
  if(c.press) rows.push([t2('Largest leak the packs hold here','Største lekkasje pakkene klarer her'),fmtA(P.holdArea(S.cls,S.mode==='norm'?S.H[S.cls]:S.rH[S.cls]))]);
  el('advRo').innerHTML=rows.map(([k,v])=>`<div class="rrow"><span>${L(k)}</span><b>${v}</b></div>`).join(''); }

/* scenarios per mode */
const SCN={
 norm:[[t2('Jet, FL370','Jet, FL370'),{cls:'jet',H:37000,dest:2000,ldgMode:'auto',u:0.45}],[t2('Turboprop, FL250','Turboprop, FL250'),{cls:'tp',H:25000,dest:500,ldgMode:'auto',u:0.45}],[t2('Piston, 9 500 ft','Stempel, 9 500 ft'),{cls:'pist',H:9500,dest:0,u:0.45}],[t2('LDG ELEV set 4 000 ft too low','LDG ELEV satt 4 000 ft for lavt'),{cls:'jet',H:37000,dest:5000,ldgMode:'man',ldg:1000,u:0.985}]],
 rapid:[[t2('Jet: window at FL370','Jet: vindu i FL370'),{cls:'jet',rH:37000,hole:'window'}],[t2('Jet: cargo door','Jet: lastedør'),{cls:'jet',rH:37000,hole:'door'}],[t2('Turboprop: door at FL250','Turboprop: dør i FL250'),{cls:'tp',rH:25000,hole:'door'}]],
 slow:[[t2('Small leak, both packs','Liten lekkasje, begge pakker'),{cls:'jet',leak:0.006,packs:1}],[t2('Same leak, one pack','Samme lekkasje, én pakke'),{cls:'jet',leak:0.006,packs:0.5}],[t2('Late reaction (4 min)','Sen reaksjon (4 min)'),{cls:'jet',leak:0.01,packs:0.5,lreact:240}]],
 oxy:[[t2('Jet: decompression, normal terrain','Jet: dekompresjon, normalt terreng'),{cls:'jet',msa:10000,gen:15}],[t2('Jet: high terrain (MSA 14 000 ft)','Jet: høyt terreng (MSA 14 000 ft)'),{cls:'jet',msa:14000,gen:15}],[t2('Piston at 12 500 ft for an hour','Stempel i 12 500 ft i en time'),{cls:'pist',rule:'nco'}]]};
function drawPre(){ el('pre').innerHTML=(SCN[S.mode]||[]).map(([t],i)=>`<button type="button" class="btn" data-s="${i}">${L(t)}</button>`).join(''); }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setS(SCN[S.mode][+b.dataset.s][1]); });
function setS(o){ if(!o) return; const {mode,cls,H,rH,u,...r}=o; if(cls) S.cls=cls; if(H!=null) S.H[S.cls]=H; if(rH!=null) S.rH[S.cls]=rH; if(r.hole) S.holeA=null;
  if(mode==null){ S.ldgMode='auto'; } Object.assign(S,r); setMode(mode||S.mode); if(u!=null){ S.u=u; S.play=false; drawTools(); upd(); } }

/* ---------------- time ---------------- */
let raf=0, last=0, slT=0, vis=true, frm=0;
const DUR={norm:22,rapid:20,slow:22,oxy:22};
function kick(){ if(!raf&&vis){ last=performance.now(); raf=requestAnimationFrame(tick); } }
function tick(now){ raf=0; const dt=Math.min(0.1,(now-last)/1000); last=now; PH+=dt;
  if(S.play){ S.u=Math.min(1,S.u+dt/DUR[S.mode]); if(S.u>=1){ S.play=false; drawTools(); } }
  if(now-slT>120||!S.play){ slT=now; sl.u.set(Math.round(S.u*1000)); readout(); if(S.mode!=='norm'||!S.play) see(); if(el('advRo').offsetParent) advRo(); }
  if(S.play||!(frm++%2)) draw(); if(!reduce||S.play) raf=requestAnimationFrame(tick); }
LAB.visible(el('prVp'),v=>{ vis=v; if(v) kick(); });
function upd(){ readout(); legend(); see(); advRo(); sl.u.set(Math.round(S.u*1000)); draw(); }

/* ---------------- Try it: one task at a time ---------------- */
let ti=0; const ansv={}, done={};
const goModel=()=>{ const t=el('prVp'); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'}); };
const NUM=(lab,v,tol)=>({lab,v,tol});
const TASKS=[
 {k:'dp',q:t2('A jet cruises at FL390, where the outside pressure is 2.9 psi. Its maximum differential pressure is 8.4 psi. What is the cabin pressure?','Et jetfly er i marsj i FL390, der trykket ute er 2,9 psi. Maksimalt differansetrykk er 8,4 psi. Hva er kabintrykket?'),
  ins:[NUM(t2('Cabin pressure (psi)','Kabintrykk (psi)'),11.3,0.15)],pre:{mode:'norm',cls:'jet',H:39000,dest:2000,u:0.45},
  e:()=>t2(`2.9 + 8.4 ≈ 11.3 psi. In the ISA that is a cabin altitude of about ${ft100(P.cabinFor(39000,8.4))}. The stronger the fuselage (more ΔP), the lower the cabin.`,`2,9 + 8,4 ≈ 11,3 psi. I ISA er det en kabinhøyde på rundt ${ft100(P.cabinFor(39000,8.4))}. Jo sterkere flykropp (mer ΔP), desto lavere kabin.`)},
 {k:'ovf',q:t2('In normal flight, what sets the cabin pressure?','Hva bestemmer kabintrykket ved normal flyging?'),
  opts:[t2('The outflow valve, opened and closed by the cabin controller','Utløpsventilen, åpnet og lukket av kabintrykkregulatoren'),t2('The pack flow, varied by the engines','Luftstrømmen fra pakkene, variert av motorene'),t2('The safety valve','Sikkerhetsventilen'),t2('The negative relief valve','Undertrykksventilen')],c:0,pre:{mode:'norm',cls:'jet',H:37000,dest:2000,u:0.2},
  e:t2('The packs give a roughly constant inflow. The controller holds the air in by closing the outflow valve; watch its opening fall as the aircraft climbs. The relief valves are only backstops.','Pakkene gir en omtrent jevn innstrømning. Regulatoren holder luften inne ved å lukke utløpsventilen; se åpningen minke når flyet stiger. Avlastningsventilene er bare sikringer.')},
 {k:'ldg',q:t2('The destination is at 5 000 ft, but the landing elevation in the controller is set manually to 1 000 ft. Set it up and play to touchdown. Then press Check.','Destinasjonen ligger på 5 000 ft, men landingshøyden i regulatoren er satt manuelt til 1 000 ft. Sett det opp og spill av til landing. Trykk så Sjekk.'),
  live:()=>{ if(S.mode!=='norm'||!isP()) return [0,t2('Use "Normal climb & descent" with the turboprop or the jet.','Bruk «Normal stigning og nedstigning» med turbopropen eller jetflyet.')]; if(S.ldgMode!=='man'||S.ldg>S.dest-2000) return [0,t2('Set the landing elevation to Manual, well below the destination elevation.','Sett landingshøyden til Manuell, godt under destinasjonens høyde.')];
    const M=cur(); if(M.ph!=='ground') return [0,t2('Play on (or drag the time) until the aircraft has landed.','Spill av videre (eller dra tiden) til flyet har landet.')];
    const tdp=TR.sched.pts.find(p=>p.ph==='ground').dp; return [1,t2(`Right: the aircraft lands with ${psi(tdp)} still in the cabin. The outflow valve dumps it on the ground, but a door must never be opened against residual pressure.`,`Riktig: flyet lander med ${psi(tdp)} fortsatt i kabinen. Utløpsventilen slipper det ut på bakken, men en dør må aldri åpnes mot resttrykk.`)]; },
  pre:{mode:'norm',cls:'jet',H:37000,dest:5000,ldgMode:'man',ldg:1000,u:0.7}},
 {k:'hold',q:t2('Slow leak, jet, both packs running: find roughly the largest leak the packs can still hold. Then press Check.','Langsom lekkasje, jet, begge pakker går: finn omtrent den største lekkasjen pakkene fortsatt klarer. Trykk så Sjekk.'),
  live:()=>{ if(S.mode!=='slow'||S.cls!=='jet'||S.packs!==1) return [0,t2('Open "Slow leak" with the jet and both packs.','Åpne «Langsom lekkasje» med jetflyet og begge pakker.')]; const ha=P.holdArea('jet',S.rH.jet);
    if(TR.dec.kind!=='held') return [0,t2('The cabin climbs: that leak is too big. Make it smaller.','Kabinen stiger: lekkasjen er for stor. Gjør den mindre.')]; if(S.leak<0.7*ha) return [0,t2('The cabin holds, but there is room for more. Make the leak bigger.','Kabinen holdes, men det er rom for mer. Gjør lekkasjen større.')];
    return [1,t2(`Yes: about ${fmtA(ha)}. Above that the leak lets out more than the packs bring in, and the cabin starts to climb. With one pack the limit halves.`,`Ja: rundt ${fmtA(ha)}. Over det slipper lekkasjen ut mer enn pakkene tar inn, og kabinen begynner å stige. Med én pakke halveres grensen.`)]; },
  pre:{mode:'slow',cls:'jet',leak:0.003,packs:1}},
 {k:'first',q:t2('Bang, fog, the cabin altitude warning at FL370. What comes first?','Smell, tåke, kabinhøydevarsel i FL370. Hva kommer først?'),
  opts:[t2('Crew oxygen masks on and communication established','Besetningens oksygenmasker på og kommunikasjon etablert'),t2('Start the emergency descent','Start nødnedstigningen'),t2('Check the outflow valve','Sjekk utløpsventilen'),t2('Help the passengers with their masks','Hjelp passasjerene med maskene')],c:0,pre:{mode:'rapid',cls:'jet',rH:37000,hole:'window'},
  e:t2('After a rapid decompression at FL370 the time of useful consciousness is only about 15–20 s. Your own mask first, then the descent, then everything else.','Etter en rask dekompresjon i FL370 er tiden med nyttig bevissthet bare rundt 15–20 s. Din egen maske først, så nedstigningen, så alt annet.')},
 {k:'tuc',q:t2('About how long is the time of useful consciousness at FL350, after a rapid decompression?','Omtrent hvor lang er tiden med nyttig bevissthet i FL350 etter en rask dekompresjon?'),
  opts:[t2('15–30 seconds','15–30 sekunder'),t2('3–5 minutes','3–5 minutter'),t2('About 10 minutes','Rundt 10 minutter'),t2('As long as you stay calm','Så lenge du holder deg rolig')],c:0,pre:{mode:'rapid',cls:'jet',rH:35000,hole:'door'},
  e:t2('Typically 30–60 s at FL350 at rest, and roughly half that after a rapid decompression, because the lungs lose their oxygen at once.','Typisk 30–60 s i FL350 i ro, og omtrent halvparten etter en rask dekompresjon, fordi lungene mister oksygenet med en gang.')},
 {k:'nco',q:t2('A private flight (NCO) in an unpressurised piston cruises at 12 000 ft for 45 minutes. The pilot cannot judge the effect of the altitude. Who must use oxygen?','En privatflyging (NCO) i et stempelfly uten trykkabin er i marsj i 12 000 ft i 45 minutter. Fartøysjefen kan ikke vurdere virkningen av høyden. Hvem må bruke oksygen?'),
  opts:[t2('The flight crew, for the time beyond the first 30 minutes','Flygebesetningen, for tiden etter de første 30 minuttene'),t2('Everyone on board, the whole time','Alle om bord, hele tiden'),t2('Nobody below 13 000 ft','Ingen under 13 000 ft'),t2('Only the passengers','Bare passasjerene')],c:0,pre:{mode:'oxy',cls:'pist',rule:'nco'},
  e:t2('NCO.OP.190: between 10 000 and 13 000 ft the crew uses oxygen for any period beyond 30 minutes; above 13 000 ft everyone on board. In commercial (CAT) operation the flight crew needs oxygen the whole time above 10 000 ft.','NCO.OP.190: mellom 10 000 og 13 000 ft bruker besetningen oksygen for tiden utover 30 minutter; over 13 000 ft alle om bord. I kommersiell drift (CAT) trenger flygebesetningen oksygen hele tiden over 10 000 ft.')},
 {k:'gen',q:t2('The passenger masks run on chemical generators of 15 minutes. After a decompression over high terrain you can only descend to 14 000 ft. Is that enough?','Passasjermaskene går på kjemiske generatorer på 15 minutter. Etter en dekompresjon over høyt terreng kan du bare gå ned til 14 000 ft. Er det nok?'),
  opts:[t2('No: the oxygen runs out while the cabin is still above 13 000 ft','Nei: oksygenet tar slutt mens kabinen fortsatt er over 13 000 ft'),t2('Yes: the generators restart when needed','Ja: generatorene starter på nytt ved behov'),t2('Yes: passengers need no oxygen at 14 000 ft','Ja: passasjerer trenger ikke oksygen i 14 000 ft'),t2('It does not matter: the crew bottle feeds the cabin','Det spiller ingen rolle: besetningsflasken forsyner kabinen')],c:0,pre:{mode:'oxy',cls:'jet',msa:14000,gen:15},
  e:t2('A chemical generator cannot be stopped or refilled once it starts. Over high terrain the route needs a planned escape, or a gaseous system with more oxygen.','En kjemisk generator kan ikke stoppes eller fylles på når den har startet. Over høyt terreng trenger ruten en planlagt rømningsvei, eller et system med gassflasker og mer oksygen.')},
 {k:'o2',dp:1,q:t2('Breathing 100 % oxygen at 40 000 ft is roughly like breathing air at…','Å puste 100 % oksygen i 40 000 ft er omtrent som å puste luft i …'),
  opts:[t2('about 10 000 ft','rundt 10 000 ft'),t2('sea level','havnivå'),t2('25 000 ft','25 000 ft'),t2('40 000 ft: oxygen makes no difference','40 000 ft: oksygen gjør ingen forskjell')],c:0,pre:{mode:'oxy',cls:'jet',msa:10000,gen:15,mask:'100'},
  e:t2('The total pressure is so low that even pure oxygen gives the alveoli only about what air gives at 10 000 ft. At about 34 000 ft, 100 % oxygen is equal to air at sea level; that is why the diluter mask goes to 100 % up there.','Totaltrykket er så lavt at selv rent oksygen gir alveolene bare omtrent det luft gir i 10 000 ft. I rundt 34 000 ft tilsvarer 100 % oksygen luft ved havet; derfor går fortynningsmasken til 100 % der oppe.')}];
const tasks=()=>TASKS.filter(t=>!t.dp||deepOn());
const ex=t=>typeof t.e==='function'?t.e():t.e;
function drawTask(){ const TS=tasks(); ti=clamp(ti,0,TS.length-1); const t=TS[ti], n=TS.length, a=ansv[t.k];
  let h=`<div class="th"><span class="n">${L(t2('Task','Oppgave'))} ${ti+1} ${L(t2('of','av'))} ${n}</span><span class="dots">${TS.map((x,i)=>`<button type="button" data-i="${i}" class="${i===ti?'on':''}" aria-label="${L(t2('Task','Oppgave'))} ${i+1}"></button>`).join('')}</span></div><p class="q">${L(t.q)}</p>`;
  if(t.ins){ h+=`<div class="ins">${t.ins.map((x,j)=>{ const v=a&&a[j]; const ok=v!=null&&v!==''&&Math.abs(parseFloat(String(v).replace(',','.').replace(/\s/g,''))-x.v)<=x.tol; return `<label>${L(x.lab)}<input type="text" inputmode="decimal" data-j="${j}" value="${v??''}" class="${done[t.k]?(ok?'right':'wrong'):''}" autocomplete="off"></label>`; }).join('')}<button type="button" class="btn pri sm" data-chk="1">${L(t2('Check','Sjekk'))}</button></div>`;
    h+=`<span class="fb${done[t.k]===1?' ok':''}">${done[t.k]?'<b>'+L(done[t.k]===1?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(ex(t)):''}</span>`; }
  else if(t.opts){ h+=`<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${a!=null?'<b>'+L(a===t.c?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(ex(t)):''}</span>`; }
  else { h+=`<div class="ins"><button type="button" class="btn pri sm" data-chk="1">${L(t2('Check','Sjekk'))}</button></div><span class="fb${done[t.k]&&done[t.k][0]?' ok':''}">${done[t.k]?(done[t.k][0]?'<b>✓</b> ':'')+L(done[t.k][1]):''}</span>`; }
  h+=`<div class="nav"><button type="button" class="btn sm" data-go="1">${L(t.live?t2('Set it up in the model','Sett det opp i modellen'):t2('Check it in the model','Sjekk i modellen'))} ↑</button><span class="sp"></span><button type="button" class="btn sm" data-p="1" ${ti===0?'disabled':''}>← ${L(t2('Previous','Forrige'))}</button><button type="button" class="btn sm" data-n="1" ${ti===n-1?'disabled':''}>${L(t2('Next','Neste'))} →</button></div>`;
  el('tstep').innerHTML=h; }
el('tstep').addEventListener('input',e=>{ const i=e.target.closest('input'); if(!i) return; const t=tasks()[ti]; (ansv[t.k]=ansv[t.k]||[])[+i.dataset.j]=i.value; });
el('tstep').addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.closest('input')){ const b=el('tstep').querySelector('[data-chk]'); if(b) b.click(); } });
el('tstep').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const TS=tasks(), t=TS[ti];
  if(b.dataset.i!=null){ ti=+b.dataset.i; drawTask(); return; } if(b.dataset.p){ ti--; drawTask(); return; } if(b.dataset.n){ ti++; drawTask(); return; }
  if(b.dataset.go){ setS(t.pre); goModel(); return; }
  if(b.dataset.o!=null){ ansv[t.k]=+b.dataset.o; drawTask(); return; }
  if(b.dataset.chk){ if(t.live){ done[t.k]=t.live(); drawTask(); return; }
    const a=ansv[t.k]||[]; done[t.k]=t.ins.every((x,j)=>a[j]!=null&&a[j]!==''&&Math.abs(parseFloat(String(a[j]).replace(',','.').replace(/\s/g,''))-x.v)<=x.tol)?1:2; drawTask(); } });

/* ---------------- Understand: key concept cards ---------------- */
const {sv,tx,ar}=KCS;
const go=o=>({click:()=>setS(o),to:'#prVp'});
const fus=(x,w,fill)=>`<rect x="${x}" y="20" width="${w}" height="24" rx="12" fill="#26313b" stroke="#6f7e8b"/>${fill?`<rect x="${x+8}" y="23" width="${w-16}" height="18" rx="6" fill="${fill}"/>`:''}`;
const KC=[
 Object.assign({k:'cls',t:t2('Three classes','Tre klasser'),d:t2('An <b>unpressurised piston</b> has its cabin at the aircraft altitude. A <b>pressurised turboprop</b> (about 6 psi) and a <b>jet transport</b> (about 8–9 psi) hold the cabin far below it.','Et <b>stempelfly uten trykkabin</b> har kabinen i flyets høyde. En <b>turboprop med trykkabin</b> (rundt 6 psi) og et <b>jetfly</b> (rundt 8–9 psi) holder kabinen langt under.'),
  ill:()=>sv(`${fus(6,50,'rgba(127,203,232,.12)')}${fus(72,56,'rgba(127,203,232,.3)')}${fus(144,52,'rgba(127,203,232,.38)')}${tx(31,58,L(t2('piston','stempel')),'#8b99a7','middle',7.5)}${tx(100,58,'turboprop','#8b99a7','middle',7.5)}${tx(170,58,'jet','#8b99a7','middle',7.5)}`)},go({mode:'norm',cls:'tp',H:25000,dest:500,u:0.45})),
 Object.assign({k:'cab',t:t2('Cabin altitude','Kabinhøyde'),d:t2('The <b>cabin altitude</b> is the pressure altitude inside the cabin. Certification limits it to <b>8 000 ft</b> at the maximum operating altitude in normal operation.','<b>Kabinhøyden</b> er trykkhøyden inne i kabinen. Sertifiseringen begrenser den til <b>8 000 ft</b> i høyeste operative høyde ved normal drift.'),
  dd:t2('Above about 10 000 ft the blood carries noticeably less oxygen, which is why the warning and the oxygen rules start around there.','Over rundt 10 000 ft bærer blodet merkbart mindre oksygen, og derfor starter varselet og oksygenreglene rundt der.'),
  ill:()=>sv(`<path d="M10,56 L60,12 L140,12 L190,56" stroke="#eef3f7" fill="none" stroke-width="1.6"/><path d="M10,56 L60,44 L140,44 L190,56" stroke="#f09ac8" fill="none" stroke-width="2"/>${tx(100,9,L(t2('aircraft FL370','fly FL370')),'#eef3f7','middle',7.5)}${tx(100,40,L(t2('cabin ~7 000 ft','kabin ~7 000 ft')),'#f09ac8','middle',7.5)}`)},go({mode:'norm',cls:'jet',H:37000,dest:2000,u:0.45})),
 Object.assign({k:'dp',t:t2('Differential pressure','Differansetrykk'),d:t2('<b>ΔP</b> is cabin pressure minus outside pressure. The fuselage is built for a maximum, so the higher you fly, the higher the cabin must go.','<b>ΔP</b> er kabintrykket minus trykket ute. Flykroppen er bygget for et maksimum, så jo høyere du flyr, desto høyere må kabinen gå.'),
  dd:t2('At FL390 the outside is under 3 psi; 8 psi more gives about 11 psi, a cabin near 8 000 ft. A stronger, heavier fuselage could keep it lower.','I FL390 er trykket ute under 3 psi; 8 psi mer gir rundt 11 psi, en kabin nær 8 000 ft. En sterkere og tyngre flykropp kunne holdt den lavere.'),
  ill:()=>sv(`${fus(20,110,'rgba(127,203,232,.4)')}${tx(75,36,'11 psi','#eef3f7','middle',9)}${tx(165,30,'3 psi','#7fcbe8','middle',9)}${ar(132,32,150,32,'#f0b440')}${tx(165,46,'ΔP ≈ 8','#f0b440','middle',8)}`)},go({mode:'norm',cls:'jet',H:39000,dest:2000,u:0.45})),
 Object.assign({k:'ovf',t:t2('Packs in, outflow valve out','Pakker inn, utløpsventil ut'),d:t2('Bleed air is cooled in the <b>packs</b> and flows in steadily. The <b>cabin controller</b> sets the cabin pressure by how far it opens the <b>outflow valve</b>.','Bleed-luft kjøles i <b>pakkene</b> og strømmer jevnt inn. <b>Kabintrykkregulatoren</b> bestemmer kabintrykket med hvor mye den åpner <b>utløpsventilen</b>.'),
  dd:t2('The controller uses the selected landing elevation (from the FMS or set by hand) to plan the cabin descent so that it arrives at the right pressure.','Regulatoren bruker valgt landingshøyde (fra FMS eller satt manuelt) til å planlegge kabinens nedstigning så den kommer fram med riktig trykk.'),
  ill:()=>sv(`${fus(30,140,'rgba(127,203,232,.25)')}${ar(50,58,70,40,'#7fcbe8')}${ar(150,44,170,60,'#f0c470')}${tx(40,62,L(t2('pack','pakke')),'#7fcbe8','middle',7.5)}${tx(176,62,L(t2('outflow','utløp')),'#f0c470','end',7.5)}`)},go({mode:'norm',cls:'jet',H:37000,dest:2000,u:0.2})),
 Object.assign({k:'rel',dp:1,t:t2('Safety and negative relief','Sikkerhets- og undertrykksventiler'),d:t2('If ΔP goes above the maximum the <b>safety valve</b> opens. The fuselage cannot take more pressure outside than inside, so a <b>negative relief valve</b> lets air in.','Går ΔP over maksimum, åpner <b>sikkerhetsventilen</b>. Flykroppen tåler ikke høyere trykk ute enn inne, så en <b>undertrykksventil</b> slipper luft inn.'),
  ill:()=>sv(`${fus(20,120,'rgba(127,203,232,.25)')}<circle cx="128" cy="27" r="4" fill="#ec5a47"/><circle cx="128" cy="37" r="4" fill="#7fcbe8"/>${ar(134,27,165,14,'#ec5a47')}${ar(170,52,136,40,'#7fcbe8')}`)},go({mode:'norm',cls:'jet',H:37000,dest:0,ldgMode:'man',ldg:6000,u:0.93})),
 Object.assign({k:'rate',dp:1,t:t2('Cabin rate','Kabinrate'),d:t2('Ears feel the <b>rate</b> of change, not the altitude. The controller spreads the cabin climb over the whole climb: typically about 500 ft/min up and 300 ft/min down.','Ørene kjenner <b>endringshastigheten</b>, ikke høyden. Regulatoren sprer kabinstigningen over hele stigningen: typisk rundt 500 ft/min opp og 300 ft/min ned.'),
  ill:()=>sv(`<path d="M10,56 L80,10" stroke="#eef3f7" fill="none" stroke-width="1.6"/><path d="M10,56 L80,44" stroke="#f09ac8" fill="none" stroke-width="2"/>${tx(100,20,L(t2('aircraft 2 500 ft/min','fly 2 500 ft/min')),'#eef3f7','start',7.5)}${tx(100,46,L(t2('cabin ~400 ft/min','kabin ~400 ft/min')),'#f09ac8','start',7.5)}`)},go({mode:'norm',cls:'jet',H:37000,dest:2000,u:0.12})),
 Object.assign({k:'dec',t:t2('Rapid or slow decompression','Rask eller langsom dekompresjon'),d:t2('<b>Rapid</b>: a bang, fog and a cabin at the outside altitude within seconds. <b>Slow</b>: no signs, the cabin creeps up, and the first clue may be the warning or the hypoxia.','<b>Rask</b>: smell, tåke og en kabin i høyden ute på sekunder. <b>Langsom</b>: ingen tegn, kabinen kryper oppover, og det første tegnet kan være varselet eller hypoksien.'),
  dd:t2('The size of the hole compared with the cabin volume sets the speed: a door in a small cabin is explosive (under half a second), a window in a large one takes tens of seconds.','Størrelsen på hullet sammenlignet med kabinvolumet bestemmer farten: en dør i en liten kabin er eksplosiv (under et halvt sekund), et vindu i en stor tar titalls sekunder.'),
  ill:()=>sv(`<path d="M10,56 L60,50 L190,50" stroke="#f09ac8" fill="none" stroke-width="1"/><path d="M10,52 L14,12 L190,12" stroke="#ec5a47" fill="none" stroke-width="2"/><path d="M10,52 C80,50 120,30 190,22" stroke="#f0b440" fill="none" stroke-width="2" stroke-dasharray="4 3"/>${tx(40,24,L(t2('rapid','rask')),'#ec5a47','start',8)}${tx(150,36,L(t2('slow','langsom')),'#f0b440','middle',8)}`)},go({mode:'rapid',cls:'jet',rH:37000,hole:'window'})),
 Object.assign({k:'tuc',t:t2('Hypoxia and TUC','Hypoksi og TUC'),d:t2('The air is 21 % oxygen at every height; what falls is the pressure. The <b>time of useful consciousness</b> shrinks from minutes at FL250 to seconds above FL350.','Luften er 21 % oksygen i alle høyder; det som faller, er trykket. <b>Tiden med nyttig bevissthet</b> krymper fra minutter i FL250 til sekunder over FL350.'),
  dd:t2('TUC ends when you can no longer act effectively, not when you pass out. After a rapid decompression it is roughly halved.','TUC slutter når du ikke lenger kan handle effektivt, ikke når du besvimer. Etter en rask dekompresjon er den omtrent halvert.'),
  ill:()=>sv(`<path d="M30,10 C60,40 100,52 190,56" stroke="#eef3f7" fill="none" stroke-width="2"/>${tx(36,24,'3–5 min FL250','#c9d2da','start',7.5)}${tx(120,46,'15–20 s FL400','#ec5a47','start',7.5)}`)},go({mode:'rapid',cls:'jet',rH:37000,hole:'door'})),
 Object.assign({k:'oxy',t:t2('Crew and passenger oxygen','Oksygen for besetning og passasjerer'),d:t2('The crew has <b>quick-donning masks</b> on a bottle (N, 100 % or EMERGENCY). Passenger masks drop at about 14 000 ft cabin and usually run on <b>chemical generators</b> of about 12–22 minutes.','Besetningen har <b>hurtigmasker</b> på en flaske (N, 100 % eller NØD). Passasjermaskene faller ved rundt 14 000 ft kabinhøyde og går som regel på <b>kjemiske generatorer</b> på rundt 12–22 minutter.'),
  dd:t2('A chemical generator cannot be stopped once it starts. That limits how long you may stay high, for example over high terrain.','En kjemisk generator kan ikke stoppes når den har startet. Det begrenser hvor lenge du kan bli høyt oppe, for eksempel over høyt terreng.'),
  ill:()=>sv(`<rect x="20" y="10" width="160" height="6" fill="#26313b"/>${[40,80,120,160].map(x=>`<line x1="${x}" y1="16" x2="${x}" y2="40" stroke="#f0c470"/><circle cx="${x}" cy="44" r="5" fill="#f0c470"/>`).join('')}${tx(100,62,'≈ 12–22 min','#71cc93','middle',8)}`)},go({mode:'oxy',cls:'jet',msa:10000,gen:15})),
 Object.assign({k:'rule',t:t2('EASA oxygen thresholds','EASAs oksygengrenser'),d:t2('The numbers to know are <b>10 000 ft</b> (crew oxygen; after 30 minutes in private flying) and <b>13 000 ft</b> (everyone on board). Pressurised CAT aircraft add 14 000 and 15 000 ft for passengers.','Tallene du må kunne er <b>10 000 ft</b> (oksygen for besetningen; etter 30 minutter i privatflyging) og <b>13 000 ft</b> (alle om bord). Kommersielle fly med trykkabin legger til 14 000 og 15 000 ft for passasjerene.'),
  ill:()=>sv(`<line x1="10" y1="40" x2="190" y2="40" stroke="#f0b440" stroke-dasharray="4 3"/><line x1="10" y1="20" x2="190" y2="20" stroke="#ec5a47" stroke-dasharray="4 3"/>${tx(14,36,L(t2('10 000: crew','10 000: besetning')),'#f0b440','start',8)}${tx(14,16,L(t2('13 000: everyone','13 000: alle')),'#ec5a47','start',8)}`)},go({mode:'oxy',cls:'pist',rule:'nco'}))];
KCS.render(el('kcGrid'),KC);

/* ---------------- deep-dive folds ---------------- */
const Pp=s=>`<p>${s}</p>`, FX=s=>`<div class="fx">${s}</div>`, TB=(rows)=>`<div class="wrapx"><table class="ftab">${rows.map((r,j)=>`<tr>${r.map(c=>j?`<td>${c}</td>`:`<th>${c}</th>`).join('')}</tr>`).join('')}</table></div>`;
function clsTable(){ const n=L(t2('Class','Klasse')), r=[[n,L(t2('Max ΔP','Maks ΔP')),L(t2('Ceiling','Tak')),L(t2('Cabin at the ceiling','Kabin i taket'))]];
  ['tp','jet'].forEach(k=>{ const c=P.CLS[k]; r.push([L(CLN[k]),nf(c.dpMax,1)+' psi',fl(c.ceil),ft100(P.cabinFor(c.ceil,c.dpMax))]); }); r.push([L(CLN.pist),'0','≈ 18 000 ft',L(t2('= aircraft','= flyet'))]); return TB(r); }
const DD=[
 ['dp',t2('Pressure, ΔP and cabin altitude in numbers','Trykk, ΔP og kabinhøyde i tall'),t2('the ISA and the design trade','ISA og konstruksjonsvalget'),()=>L(t2(
  Pp('The cabin altitude is the ISA pressure altitude of the cabin pressure. With ΔP the fuselage carries a load on every square inch of skin, so the maximum ΔP is a structural limit, and the cabin altitude at the ceiling follows from it:')+FX('p_cabin = p_outside(FL) + ΔP_max → cabin altitude = ISA altitude of p_cabin')+clsTable()+Pp('Typical values for generic classes. Certification (CS 25.841) requires a cabin altitude of no more than 8 000 ft at the maximum operating altitude in normal operation. Newer composite jets run more ΔP for a lower cabin.'),
  Pp('Kabinhøyden er ISA-trykkhøyden til kabintrykket. Med ΔP bærer flykroppen en last på hver kvadrattomme av huden, så maks ΔP er en strukturgrense, og kabinhøyden i taket følger av den:')+FX('p_kabin = p_ute(FL) + ΔP_maks → kabinhøyde = ISA-høyden til p_kabin')+clsTable()+Pp('Typiske verdier for generiske klasser. Sertifiseringen (CS 25.841) krever kabinhøyde på høyst 8 000 ft i høyeste operative høyde ved normal drift. Nyere komposittfly har mer ΔP og lavere kabin.')))],
 ['ctl',t2('The controller, landing elevation and residual pressure','Regulatoren, landingshøyden og resttrykk'),t2('auto, manual, ditching','auto, manuell, nødlanding på vann'),()=>L(t2(
  Pp('In automatic mode the controller takes the landing elevation from the FMS and schedules the cabin: up slowly during the climb, held in cruise, and down during the descent so it reaches the field (often a little below it, slightly pressurised) at touchdown. On the ground the outflow valve opens fully.')+Pp('<b>Landing elevation set too low:</b> the aircraft lands with the cabin still pressurised. A door must never be opened against residual pressure: it can blow open and throw the person opening it out. <b>Set too high:</b> late in the descent the aircraft goes below the cabin, ΔP turns negative and the negative relief valve opens.')+Pp('<b>Manual mode</b> lets the crew drive the outflow valve directly with a cabin rate knob or an open/close switch. <b>Ditching:</b> a ditching switch closes the outflow valve and the openings below the floor so the fuselage floats longer.'),
  Pp('I automatisk modus tar regulatoren landingshøyden fra FMS og planlegger kabinen: sakte opp i stigningen, holdt i marsj, og ned i nedstigningen så den når flyplassen (ofte litt under, med litt trykk) ved landing. På bakken åpner utløpsventilen helt.')+Pp('<b>Landingshøyden satt for lavt:</b> flyet lander med kabinen fortsatt under trykk. En dør må aldri åpnes mot resttrykk: den kan blåse opp og kaste ut den som åpner. <b>Satt for høyt:</b> sent i nedstigningen kommer flyet under kabinen, ΔP blir negativ og undertrykksventilen åpner.')+Pp('<b>Manuell modus</b> lar besetningen styre utløpsventilen direkte med en ratebryter eller en åpne/lukke-bryter. <b>Nødlanding på vann:</b> en ditching-bryter lukker utløpsventilen og åpningene under gulvet så flykroppen flyter lenger.')))],
 ['dec',t2('Decompression physics and the emergency descent','Dekompresjonsfysikk og nødnedstigning'),t2('choked flow, V/A, fog','strupet strømning, V/A, tåke'),()=>L(t2(
  Pp('With more than about twice the pressure inside, the flow through a hole is <b>choked</b>: it leaves at the speed of sound, and the mass flow depends only on the area and the cabin pressure. The time to empty scales with <b>cabin volume ÷ hole area</b>: a door in a small cabin is explosive (well under a second), a window in a large cabin takes tens of seconds.')+Pp('<b>Explosive</b> (under about 0.5 s, faster than the lungs can empty), <b>rapid</b> (seconds to tens of seconds; in this lab up to about a minute) and <b>slow</b> (long enough to go unnoticed). The air expands almost adiabatically and cools sharply; when it falls below its dew point the moisture condenses into <b>fog</b>. Loose objects fly towards the hole.')+Pp('<b>Emergency descent:</b> masks on and communication first; then thrust idle, speedbrakes, fly at MMO/VMO (less if structural damage is suspected) towards 10 000 ft or the minimum safe altitude if higher. Most of the height goes in the first few minutes.'),
  Pp('Med mer enn rundt dobbelt så høyt trykk inne er strømningen gjennom et hull <b>strupet</b>: den går ut med lydens hastighet, og massestrømmen avhenger bare av arealet og kabintrykket. Tiden det tar å tømme kabinen går som <b>kabinvolum ÷ hullareal</b>: en dør i en liten kabin er eksplosiv (godt under et sekund), et vindu i en stor kabin tar titalls sekunder.')+Pp('<b>Eksplosiv</b> (under rundt 0,5 s, raskere enn lungene kan tømmes), <b>rask</b> (sekunder til titalls sekunder; i denne labben opp til rundt ett minutt) og <b>langsom</b> (lang nok til å gå ubemerket). Luften utvider seg nesten adiabatisk og kjøles kraftig; når den kommer under duggpunktet, kondenserer fuktigheten til <b>tåke</b>. Løse gjenstander flyr mot hullet.')+Pp('<b>Nødnedstigning:</b> masker på og kommunikasjon først; så tomgang, luftbremser, fly på MMO/VMO (lavere ved mistanke om strukturskade) mot 10 000 ft eller minste sikre høyde hvis den er høyere. Mesteparten av høyden tapes de første minuttene.')))],
 ['hyp',t2('Hypoxia, TUC and the other effects of low pressure','Hypoksi, TUC og andre virkninger av lavt trykk'),t2('types, symptoms, trapped gas, DCS','typer, symptomer, innestengt gass, trykkfallssyke'),()=>L(t2(
  Pp('<b>Four kinds of hypoxia.</b> Hypoxic: too little oxygen reaches the blood (altitude). Anaemic: the blood cannot carry it (carbon monoxide, blood loss). Stagnant: poor circulation (high g, cold). Histotoxic: the cells cannot use it (alcohol, some poisons).')+Pp('<b>Symptoms</b> are often pleasant at first: euphoria and overconfidence, then impaired judgement and memory, tunnel and poor night vision, tingling, cyanosis and finally unconsciousness. Each person has a personal pattern, which altitude-chamber training reveals.')+TB([[L(t2('Altitude','Høyde')),'TUC',L(t2('After rapid decompression','Etter rask dekompresjon'))],['FL180','20–30 min','10–15 min'],['FL250','3–5 min','1.5–2.5 min'],['FL300','1–2 min','30–60 s'],['FL350','30–60 s','15–30 s'],['FL400','15–20 s','8–10 s']])+Pp('<b>Trapped gas</b> expands as the pressure falls (doubled at about 18 000 ft): ears and sinuses hurt on the way <b>down</b> if blocked, so do not fly with a cold. <b>Decompression sickness:</b> nitrogen comes out of solution; rare below about 18 000 ft cabin unless you have been diving. Common guidance: no flying for 12 h after diving, 24 h after dives that needed decompression stops.'),
  Pp('<b>Fire typer hypoksi.</b> Hypoksisk: for lite oksygen kommer over i blodet (høyde). Anemisk: blodet kan ikke bære det (karbonmonoksid, blodtap). Stagnant: dårlig sirkulasjon (høy g, kulde). Histotoksisk: cellene kan ikke bruke det (alkohol, noen giftstoffer).')+Pp('<b>Symptomene</b> er ofte behagelige først: eufori og overmot, så svekket dømmekraft og hukommelse, tunnelsyn og dårlig nattsyn, prikking, cyanose og til slutt bevisstløshet. Hver person har sitt eget mønster, som trening i trykkammer avslører.')+TB([[L(t2('Altitude','Høyde')),'TUC',L(t2('After rapid decompression','Etter rask dekompresjon'))],['FL180','20–30 min','10–15 min'],['FL250','3–5 min','1,5–2,5 min'],['FL300','1–2 min','30–60 s'],['FL350','30–60 s','15–30 s'],['FL400','15–20 s','8–10 s']])+Pp('<b>Innestengt gass</b> utvider seg når trykket faller (doblet ved rundt 18 000 ft): ører og bihuler gjør vondt på vei <b>ned</b> hvis de er tette, så ikke fly forkjølet. <b>Trykkfallssyke:</b> nitrogen frigjøres fra blodet; sjelden under rundt 18 000 ft kabinhøyde med mindre du har dykket. Vanlig veiledning: ikke fly de første 12 timene etter dykking, 24 timer etter dykk med dekompresjonsstopp.')))],
 ['oxy',t2('Oxygen systems','Oksygensystemer'),t2('diluter demand, generators, PBE','fortynning, generatorer, PBE'),()=>L(t2(
  Pp('<b>Crew:</b> a gaseous bottle feeds quick-donning masks (required above 25 000 ft in CAT). On <b>N</b> (normal, diluter demand) the regulator mixes cabin air with oxygen, more as the cabin climbs, reaching 100 % around 34 000 ft. <b>100 %</b> gives pure oxygen (smoke and fumes). <b>EMERGENCY</b> adds overpressure so smoke cannot leak in around the seal; it uses the bottle fastest.')+Pp('<b>Passengers:</b> masks drop automatically before the cabin passes 15 000 ft (typically set at about 14 000 ft) and can be released manually. Most use <b>chemical generators</b> (sodium chlorate) that run for a fixed time once a mask is pulled, typically 12, 15 or 22 minutes; they get hot and cannot be stopped. Some aircraft use gaseous systems for longer duration over high terrain. Portable bottles and <b>PBE</b> (smoke hoods, at least 15 minutes) serve the cabin crew and firefighting.')+Pp('Breathing 100 % oxygen at about 34 000 ft gives the alveoli what air gives at sea level; at 40 000 ft only what air gives at about 10 000 ft. Above that, even pure oxygen needs pressure breathing.'),
  Pp('<b>Besetning:</b> en gassflaske forsyner hurtigmasker (påkrevd over 25 000 ft i CAT). På <b>N</b> (normal, fortynning) blander regulatoren kabinluft med oksygen, mer jo høyere kabinen går, til 100 % ved rundt 34 000 ft. <b>100 %</b> gir rent oksygen (røyk og gass). <b>NØD</b> gir overtrykk så røyk ikke lekker inn rundt tetningen; det tømmer flasken raskest.')+Pp('<b>Passasjerer:</b> maskene faller automatisk før kabinen passerer 15 000 ft (typisk satt til rundt 14 000 ft) og kan utløses manuelt. De fleste bruker <b>kjemiske generatorer</b> (natriumklorat) som går en fast tid når en maske er trukket, typisk 12, 15 eller 22 minutter; de blir varme og kan ikke stoppes. Noen fly har gassystemer for lengre tid over høyt terreng. Bærbare flasker og <b>PBE</b> (røykhetter, minst 15 minutter) er for kabinbesetningen og brannslukking.')+Pp('Å puste 100 % oksygen i rundt 34 000 ft gir alveolene det luft gir ved havet; i 40 000 ft bare det luft gir i rundt 10 000 ft. Over det trengs overtrykksånding selv med rent oksygen.')))],
 ['easa',t2('EASA oxygen requirements','EASAs oksygenkrav'),t2('CAT.IDE.A.235/240, NCO.OP.190','CAT.IDE.A.235/240, NCO.OP.190'),()=>{ const H=[L(t2('Who','Hvem')),L(t2('CAT, unpressurised (CAT.IDE.A.240)','CAT, uten trykkabin (CAT.IDE.A.240)')),L(t2('CAT, pressurised (CAT.IDE.A.235)','CAT, trykkabin (CAT.IDE.A.235)')),L(t2('NCO (NCO.OP.190, PIC cannot judge)','NCO (NCO.OP.190, fartøysjef kan ikke vurdere)'))];
   const R=[[L(t2('Flight crew','Flygebesetning')),L(t2('whole time above 10 000 ft','hele tiden over 10 000 ft')),L(t2('above 13 000 ft; 10–13 000 ft after the first 30 min','over 13 000 ft; 10–13 000 ft etter de første 30 min')),L(t2('10–13 000 ft beyond 30 min; above 13 000 ft','10–13 000 ft utover 30 min; over 13 000 ft'))],
    [L(t2('All passengers','Alle passasjerer')),L(t2('above 13 000 ft','over 13 000 ft')),L(t2('above 15 000 ft (at least 10 min supply)','over 15 000 ft (minst 10 min forsyning)')),L(t2('above 13 000 ft','over 13 000 ft'))],
    [L(t2('Some passengers','Noen passasjerer')),L(t2('10 %: 10–13 000 ft after 30 min','10 %: 10–13 000 ft etter 30 min')),L(t2('30 %: 14–15 000 ft · 10 %: 10–14 000 ft after 30 min','30 %: 14–15 000 ft · 10 %: 10–14 000 ft etter 30 min')),'–']];
   return Pp(L(t2('Altitudes are cabin pressure altitudes. Simplified from EASA Air OPS (Regulation (EU) 965/2012); cabin crew, supply quantities and the details are in the rules themselves. Under NCO the pilot-in-command may instead decide based on the effect of the altitude on the occupants.','Høydene er kabinens trykkhøyde. Forenklet fra EASA Air OPS (forordning (EU) 965/2012); kabinbesetning, mengder og detaljene står i selve reglene. Under NCO kan fartøysjefen i stedet avgjøre ut fra hvordan høyden virker på de om bord.')))+TB([H,...R])+Pp(L(t2('Pressurised CAT aeroplanes flying above 25 000 ft also need quick-donning crew masks, a dispensing unit for every occupant (at least 10 % extra), and a warning of loss of pressurisation.','Kommersielle fly med trykkabin over 25 000 ft trenger i tillegg hurtigmasker for besetningen, en maske for alle om bord (minst 10 % ekstra) og varsel om tap av kabintrykk.'))); }]];
function drawDD(){ const open=[...document.querySelectorAll('#ddList details[open]')].map(d=>d.id);
  el('ddList').innerHTML=DD.map(([id,t,s,f])=>`<details class="dfold" id="dd-${id}"><summary>${L(t)} <small>${L(s)}</small></summary><div>${f()}</div></details>`).join('');
  open.forEach(i=>{ const d=el(i); if(d) d.open=true; }); }

/* ---------------- Test yourself ---------------- */
function drawTake(){ const TK=[
  t2('<b>Cabin altitude</b> is the pressure altitude inside. Unpressurised: the same as the aircraft. Pressurised: limited to 8 000 ft at the maximum operating altitude.','<b>Kabinhøyde</b> er trykkhøyden inne. Uten trykkabin: den samme som flyets. Med trykkabin: høyst 8 000 ft i høyeste operative høyde.'),
  t2('<b>ΔP = cabin − outside.</b> The maximum is structural (typically about 6 psi turboprop, 8–9 psi jet), so a higher cruise means a higher cabin.','<b>ΔP = kabin − ute.</b> Maksimum er en strukturgrense (typisk rundt 6 psi turboprop, 8–9 psi jet), så høyere marsj gir høyere kabin.'),
  t2('<b>Packs in, outflow valve out:</b> the controller sets the cabin by the outflow valve. Safety and negative relief valves are the backstops.','<b>Pakker inn, utløpsventil ut:</b> regulatoren bestemmer kabinen med utløpsventilen. Sikkerhets- og undertrykksventilene er sikringene.'),
  t2('<b>A wrong landing elevation</b> lands you pressurised (too low) or gives negative ΔP late in the descent (too high). Never open a door against residual pressure.','<b>Feil landingshøyde</b> gir landing med trykk (for lav) eller negativ ΔP sent i nedstigningen (for høy). Åpne aldri en dør mot resttrykk.'),
  t2('<b>Rapid decompression:</b> bang, fog, cold, cabin warning (about 10 000 ft) and masks (about 14 000 ft) within seconds. <b>Slow:</b> no signs; the warning or hypoxia may be the first clue.','<b>Rask dekompresjon:</b> smell, tåke, kulde, kabinvarsel (rundt 10 000 ft) og masker (rundt 14 000 ft) på sekunder. <b>Langsom:</b> ingen tegn; varselet eller hypoksien kan være første tegn.'),
  t2('<b>Masks on first</b>, communication, then the emergency descent to 10 000 ft or the minimum safe altitude.','<b>Masker på først</b>, kommunikasjon, så nødnedstigning til 10 000 ft eller minste sikre høyde.'),
  t2('<b>TUC</b>: 3–5 min at FL250, 30–60 s at FL350, 15–20 s at FL400, and roughly half after a rapid decompression.','<b>TUC</b>: 3–5 min i FL250, 30–60 s i FL350, 15–20 s i FL400, og omtrent halvparten etter en rask dekompresjon.'),
  t2('<b>Oxygen thresholds</b> (EASA): 10 000 ft for the crew (after 30 min under NCO and for pressurised CAT up to 13 000 ft), 13 000 ft for everyone (15 000 ft for all passengers in pressurised CAT). Chemical passenger oxygen lasts about 12–22 min.','<b>Oksygengrenser</b> (EASA): 10 000 ft for besetningen (etter 30 min under NCO og for kommersielle fly med trykkabin opp til 13 000 ft), 13 000 ft for alle (15 000 ft for alle passasjerer i kommersielle fly med trykkabin). Kjemisk passasjeroksygen varer rundt 12–22 min.')];
  el('take').innerHTML=TK.map(x=>`<li>${L(x)}</li>`).join(''); }
LAB.quiz(el('qbox'),'pressurisation',()=>LAB.shuffle([
 {q:t2('Why does a jet cabin sit at about 7 000–8 000 ft at the highest flight levels rather than at sea level?','Hvorfor ligger kabinen i et jetfly på rundt 7 000–8 000 ft i de høyeste flygenivåene i stedet for ved havnivå?'),a:[t2('The fuselage is built for a maximum differential pressure','Flykroppen er bygget for et maksimalt differansetrykk'),t2('The packs cannot deliver more air up there','Pakkene kan ikke levere mer luft der oppe'),t2('A higher cabin saves oxygen','En høyere kabin sparer oksygen'),t2('The rules require a cabin at 8 000 ft','Reglene krever en kabin på 8 000 ft')],c:0,e:t2('Outside pressure at FL390 is under 3 psi; with about 8 psi of ΔP the cabin is about 11 psi, roughly 8 000 ft.','Trykket ute i FL390 er under 3 psi; med rundt 8 psi ΔP blir kabinen rundt 11 psi, omtrent 8 000 ft.')},
 {q:t2('What controls the cabin pressure in normal operation?','Hva styrer kabintrykket ved normal drift?'),a:[t2('The outflow valve, against a steady inflow from the packs','Utløpsventilen, mot en jevn innstrømning fra pakkene'),t2('The pack flow, varied by the engines','Luftstrømmen fra pakkene, variert av motorene'),t2('The safety valves','Sikkerhetsventilene'),t2('The negative relief valves','Undertrykksventilene')],c:0,e:t2('The controller sets the cabin pressure by how far the outflow valve is open; the safety valve is only a backstop.','Regulatoren bestemmer kabintrykket med hvor mye utløpsventilen er åpen; sikkerhetsventilen er bare en sikring.')},
 {q:t2('The landing elevation is set to 0 ft for an aerodrome at 5 000 ft. The result?','Landingshøyden er satt til 0 ft for en flyplass på 5 000 ft. Resultatet?'),a:[t2('The aircraft lands with the cabin still pressurised','Flyet lander med kabinen fortsatt under trykk'),t2('The cabin is higher than the aerodrome at touchdown','Kabinen er høyere enn flyplassen ved landing'),t2('Nothing: the controller ignores it below 10 000 ft','Ingenting: regulatoren ser bort fra det under 10 000 ft'),t2('The passenger masks drop','Passasjermaskene faller ned')],c:0,e:t2('The controller brings the cabin to 0 ft, a higher pressure than the aerodrome. The residual pressure must be gone before any door is opened.','Regulatoren tar kabinen til 0 ft, høyere trykk enn flyplassen. Resttrykket må være borte før noen dør åpnes.')},
 {q:t2('What does the negative relief valve protect against?','Hva beskytter undertrykksventilen mot?'),a:[t2('Outside pressure higher than cabin pressure','Høyere trykk ute enn i kabinen'),t2('Too much ΔP in cruise','For mye ΔP i marsj'),t2('Too high a cabin rate','For høy kabinrate'),t2('Smoke in the cabin','Røyk i kabinen')],c:0,e:t2('The fuselage is built for pressure from inside, not outside. If the aircraft gets below the cabin, the valve lets air in.','Flykroppen er bygget for trykk innenfra, ikke utenfra. Kommer flyet under kabinen, slipper ventilen luft inn.')},
 {q:t2('A small leak develops in cruise and the cabin altitude does not change. Why?','En liten lekkasje oppstår i marsj, og kabinhøyden endres ikke. Hvorfor?'),a:[t2('The outflow valve closes further; the packs make up for it','Utløpsventilen lukker mer; pakkene tar det igjen'),t2('Air cannot flow out of small holes at altitude','Luft kan ikke strømme ut av små hull i høyden'),t2('The safety valve seals the leak','Sikkerhetsventilen tetter lekkasjen'),t2('The indication is wrong','Visningen er feil')],c:0,e:t2('As long as the leak is smaller than the pack inflow, the controller just lets less air out through the valve.','Så lenge lekkasjen er mindre enn innstrømningen fra pakkene, slipper regulatoren bare ut mindre luft gjennom ventilen.')},
 {q:t2('What mostly decides how fast a cabin depressurises?','Hva avgjør i hovedsak hvor raskt en kabin mister trykket?'),a:[t2('The hole size compared with the cabin volume','Hullstørrelsen sammenlignet med kabinvolumet'),t2('The outside air temperature','Temperaturen ute'),t2('The airspeed','Farten'),t2('The number of passengers','Antall passasjerer')],c:0,e:t2('A large hole in a small volume empties fastest: a door in a small turboprop is far more violent than a window in a large jet.','Et stort hull i et lite volum tømmes raskest: en dør i en liten turboprop er mye voldsommere enn et vindu i et stort jetfly.')},
 {q:t2('Why does fog form in the cabin during a rapid decompression?','Hvorfor dannes det tåke i kabinen ved en rask dekompresjon?'),a:[t2('The expanding air cools below its dew point','Luften som utvider seg, kjøles under duggpunktet'),t2('Smoke from the packs','Røyk fra pakkene'),t2('Oxygen from the masks','Oksygen fra maskene'),t2('Outside cloud is sucked in','Skyer utenfra suges inn')],c:0,e:t2('Fast expansion is nearly adiabatic; the temperature drops sharply and the water vapour condenses.','Rask utvidelse er nesten adiabatisk; temperaturen faller kraftig, og vanndampen kondenserer.')},
 {q:t2('After a rapid decompression at FL350, the time of useful consciousness is about…','Etter en rask dekompresjon i FL350 er tiden med nyttig bevissthet rundt …'),a:[t2('15–30 seconds','15–30 sekunder'),t2('3–5 minutes','3–5 minutter'),t2('10 minutes','10 minutter'),t2('unlimited if you stay calm','ubegrenset om du holder deg rolig')],c:0,e:t2('30–60 s at rest, roughly halved after a rapid decompression.','30–60 s i ro, omtrent halvert etter en rask dekompresjon.')},
 {q:t2('The proportion of oxygen in the air at FL300 is…','Andelen oksygen i luften i FL300 er …'),a:[t2('about 21 %, as at sea level','rundt 21 %, som ved havet'),t2('about 7 %','rundt 7 %'),t2('about 10 %','rundt 10 %'),t2('zero','null')],c:0,e:t2('The percentage is the same; the partial pressure falls with the total pressure, and that is what drives oxygen into the blood.','Prosenten er den samme; partialtrykket faller med totaltrykket, og det er det som driver oksygenet inn i blodet.')},
 {q:t2('Which type of hypoxia does carbon monoxide cause?','Hvilken type hypoksi gir karbonmonoksid?'),a:[t2('Anaemic (hypaemic)','Anemisk (hypemisk)'),t2('Hypoxic','Hypoksisk'),t2('Stagnant','Stagnant'),t2('Histotoxic','Histotoksisk')],c:0,e:t2('CO binds to haemoglobin far more strongly than oxygen, so the blood cannot carry enough.','CO binder seg mye sterkere til hemoglobinet enn oksygen, så blodet kan ikke bære nok.')},
 {q:t2('The cabin altitude warning sounds in cruise. What comes first?','Kabinhøydevarselet går i marsj. Hva kommer først?'),a:[t2('Crew oxygen masks on and communication established','Besetningens oksygenmasker på og kommunikasjon etablert'),t2('Check the outflow valve','Sjekk utløpsventilen'),t2('Call the cabin crew','Ring kabinbesetningen'),t2('Descend before putting on the masks','Gå ned før maskene settes på')],c:0,e:t2('Hypoxia removes your ability to do anything else. Masks first, then the descent, then the troubleshooting.','Hypoksi tar fra deg evnen til alt annet. Masker først, så nedstigningen, så feilsøkingen.')},
 {q:t2('Passenger oxygen from chemical generators typically lasts…','Passasjeroksygen fra kjemiske generatorer varer typisk …'),a:[t2('about 12–22 minutes, and cannot be stopped once started','rundt 12–22 minutter, og kan ikke stoppes når den har startet'),t2('about 2 hours','rundt 2 timer'),t2('until the masks are stowed again','til maskene legges tilbake'),t2('about 2 minutes','rundt 2 minutter')],c:0,e:t2('The fixed duration is one reason the descent starts at once, and why high-terrain routes need escape planning.','Den faste varigheten er én grunn til at nedstigningen starter straks, og hvorfor ruter over høyt terreng trenger planlagte rømningsveier.')},
 {q:t2('Under EASA CAT rules, an unpressurised aeroplane must carry oxygen for 100 % of passengers…','Etter EASAs CAT-regler må et fly uten trykkabin ha oksygen til 100 % av passasjerene …'),a:[t2('the whole time above 13 000 ft','hele tiden over 13 000 ft'),t2('the whole time above 10 000 ft','hele tiden over 10 000 ft'),t2('above 15 000 ft only','bare over 15 000 ft'),t2('never: only the crew needs oxygen','aldri: bare besetningen trenger oksygen')],c:0,e:t2('CAT.IDE.A.240: all passengers above 13 000 ft, 10 % after 30 minutes between 10 000 and 13 000 ft; the flight crew whole time above 10 000 ft.','CAT.IDE.A.240: alle passasjerer over 13 000 ft, 10 % etter 30 minutter mellom 10 000 og 13 000 ft; flygebesetningen hele tiden over 10 000 ft.')},
 {q:t2('With the crew mask on N (diluter demand), what happens as the cabin climbs?','Med besetningsmasken på N (fortynning), hva skjer når kabinen stiger?'),a:[t2('More oxygen is mixed in, up to 100 % around 34 000 ft','Mer oksygen blandes inn, opp til 100 % ved rundt 34 000 ft'),t2('It always gives 100 %','Den gir alltid 100 %'),t2('It always gives 21 %','Den gir alltid 21 %'),t2('It switches off above 25 000 ft','Den slår seg av over 25 000 ft')],c:0,e:t2('The regulator keeps the inspired oxygen roughly at the sea-level value; above about 34 000 ft even 100 % only just does that.','Regulatoren holder det innåndede oksygenet omtrent på havnivåverdien; over rundt 34 000 ft klarer selv 100 % så vidt det.')},
 {q:t2('Why should you not fly with a cold?','Hvorfor bør du ikke fly forkjølet?'),a:[t2('Blocked ears and sinuses cannot equalise, especially descending','Tette ører og bihuler klarer ikke å utligne, særlig i nedstigning'),t2('The virus spreads faster at altitude','Viruset sprer seg raskere i høyden'),t2('It causes decompression sickness','Det gir trykkfallssyke'),t2('It lowers the cabin altitude','Det senker kabinhøyden')],c:0,e:t2('On the way down the pressure rises, and air must get into the middle ear and sinuses.','På vei ned øker trykket, og luft må inn i mellomøret og bihulene.')}]),10);

/* ---------------- static strings, text, start ---------------- */
LAB.add({},{'Pressurisation and Oxygen':'Trykkabin og oksygen','Pressurisation and oxygen':'Trykkabin og oksygen','Birdbird Virtual Lab · Aircraft and engine systems':'Birdbird Virtual Lab · Fly- og motorsystemer',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Test yourself':'3 · Test deg selv','Key concepts':'Nøkkelbegreper','Deep dive':'Dypdykk','The pressurisation lab':'Trykkabinlabben','Try it':'Prøv selv','Key points':'Det viktigste','Test yourself':'Test deg selv',
 'Controls':'Kontroller','Aircraft':'Flytype','The flight':'Flygingen','Decompression':'Dekompresjon','Leak':'Lekkasje','Oxygen':'Oksygen','Time':'Tid','Scenarios':'Scenarier','Advanced':'Avansert','Mode':'Modus','Sections':'Seksjoner',
 'Landing elevation in the controller':'Landingshøyde i regulatoren','Opening':'Åpning','Packs running':'Pakker i drift','Crew mask regulator':'Regulator på besetningsmasken','Passenger oxygen (chemical generators)':'Passasjeroksygen (kjemiske generatorer)','Rules':'Regler',
 'Cut-away fuselage with the air flowing in through the packs and out through the outflow valve, an altitude–time chart of the aircraft and the cabin, and a hypoxia panel with the time of useful consciousness.':'Gjennomskåret flykropp med luften som strømmer inn gjennom pakkene og ut gjennom utløpsventilen, et høyde–tid-diagram for flyet og kabinen, og et hypoksipanel med tid med nyttig bevissthet.'});
LAB.tx({lead:'Hvorfor et jetfly i FL370 har en kabin på rundt 7000 ft, hva utløpsventilen og kabintrykkregulatoren gjør, hva som skjer når et vindu eller en dørpakning slipper, hvor raskt mangel på oksygen tar fra deg evnen til å handle, og hvem som må ha oksygen når. Sammenlignet mellom et stempelfly uten trykkabin, en turboprop med trykkabin og et jetfly.'});
function texts(){
  el('kin').textContent=L(t2('The ideas that carry pressurisation and oxygen. “Show in the model” sets the lab up so you can see it.','Ideene som bærer trykkabin og oksygen. «Vis i modellen» setter opp labben så du kan se det.'));
  el('xLead').textContent=L(deepOn()?t2('Pick a mode above the figure and an aircraft in the controls, then play. On the left the air flows through the fuselage; on the right the chart draws the aircraft, the cabin and ΔP against time; below, the hypoxia panel shows what the cabin altitude does to you. Drag the time to stop anywhere. Advanced lets you choose any hole size.','Velg modus over figuren og flytype i kontrollene, og spill av. Til venstre strømmer luften gjennom flykroppen; til høyre tegner diagrammet flyet, kabinen og ΔP mot tid; under viser hypoksipanelet hva kabinhøyden gjør med deg. Dra i tiden for å stoppe hvor som helst. Under Avansert kan du velge hvilken som helst hullstørrelse.')
    :t2('Pick a mode above the figure and an aircraft in the controls, then play. The fuselage, the altitude chart and the hypoxia panel move together.','Velg modus over figuren og flytype i kontrollene, og spill av. Flykroppen, høydediagrammet og hypoksipanelet beveger seg sammen.'));
  el('tryLead').textContent=L(t2('Work it out first, then check. "Set it up in the model" shows you why.','Regn det ut først, og sjekk. «Sett det opp i modellen» viser deg hvorfor.'));
  el('foot').innerHTML=L(t2('<b>Model and limitations.</b> Teaching model, not for flight. ICAO standard atmosphere; generic aircraft classes with typical values (maximum ΔP, ceiling, cabin volume, pack flow, climb, descent and emergency descent rates), not any one type. The controller schedule is proportional to the aircraft altitude with the cabin landing 150 ft below the selected elevation. Decompression: an isothermal mass balance with compressible (choked) orifice flow and constant pack inflow; the air temperature follows the expansion and recovers with a 25 s time constant. Hypoxia: alveolar gas equation with typical acute values, Severinghaus saturation curve and typical time of useful consciousness at rest; individual tolerance varies widely. Oxygen rules simplified from EASA Air OPS (CAT.IDE.A.235/240, NCO.OP.190). Follow the AFM, FCOM, QRH and your operator’s procedures.','<b>Modell og begrensninger.</b> Opplæringsmodell, ikke for flyging. ICAOs standardatmosfære; generiske flyklasser med typiske verdier (maks ΔP, tak, kabinvolum, luftstrøm fra pakkene, stige-, synke- og nødnedstigningsrater), ikke én bestemt type. Regulatorens plan er proporsjonal med flyets høyde, og kabinen lander 150 ft under valgt høyde. Dekompresjon: isoterm massebalanse med kompressibel (strupet) strømning gjennom hullet og jevn innstrømning fra pakkene; lufttemperaturen følger utvidelsen og hentes inn igjen med en tidskonstant på 25 s. Hypoksi: den alveolære gassligningen med typiske akutte verdier, Severinghaus’ metningskurve og typisk tid med nyttig bevissthet i ro; den individuelle toleransen varierer mye. Oksygenreglene er forenklet fra EASA Air OPS (CAT.IDE.A.235/240, NCO.OP.190). Følg AFM, FCOM, QRH og operatørens prosedyrer.'));
  el('ddH').textContent=L(t2('Deep dive','Dypdykk')); }
function all(){ texts(); drawTabs(); drawTools(); drawPre(); drawTask(); drawDD(); drawTake(); syncCtl(); upd(); }
LAB.onLang(all);
document.addEventListener('labdepth',all);
LAB.start('press');
setMode('norm'); all(); kick();
/* old anchors */
const HM={'#cabin':'norm','#decomp':'rapid'}, HD={'#hypoxia':'dd-hyp','#ops':'dd-oxy'};
if(HM[location.hash]){ setMode(HM[location.hash]); requestAnimationFrame(()=>el('prVp').scrollIntoView({block:'start'})); }
if(HD[location.hash]){ if(depth()==='short') LAB.setDepth('deep'); requestAnimationFrame(()=>{ const d=el(HD[location.hash]); if(d){ d.open=true; d.scrollIntoView({block:'center'}); } }); }
})();
