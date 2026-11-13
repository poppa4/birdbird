/* Birdbird – perf.js: the Take-off and landing performance lab (performance.html).
   One dark figure with three modes: Take-off (the runway from above with TORA/TODA/ASDA, the all-engines, go and stop
   distances and the V1 window), Climb-out (the take-off flight path from the side, gross and net, with an obstacle)
   and Landing (the approach and landing run against the LDA, with the dispatch factors).
   Three generic aircraft: light single (Class B), turboprop and jet (Class A). All maths in perfcore.js (PFC). */
(function(){
'use strict';
const {L,el,nf}=LAB, P=PFC, t2=(en,no)=>({en,no});
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const MONO='"IBM Plex Mono", ui-monospace, monospace', SANS='"Public Sans", system-ui, sans-serif';
const C={aeo:'#7FCBE8',go:'#F0B440',stop:'#EC5A47',ok:'#71CC93',txt:'#EEF2F5',mut:'#8E99A4',dim:'#5E6D7C',rwy:'#3A444E',sw:'#6B5B3A',grid:'rgba(200,215,225,.10)',net:'#C9B6F2'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const depth=()=>document.body.classList.contains('depth-short')?'short':document.body.classList.contains('depth-instructor')?'instructor':'deep';
const deepOn=()=>depth()!=='short';
const m0=v=>nf(Math.round(v/10)*10,0)+' m';
const pc=v=>nf(v*100,1)+' %';
const sg=v=>(v>0?'+':v<0?'−':'')+nf(Math.abs(v),0);

/* ---------------- the aircraft and state ---------------- */
const TN={sep:t2('Light single · piston · Class B','Lett enmotors · stempel · klasse B'),tp:t2('Turboprop twin · Class A','Turboprop tomotors · klasse A'),jet:t2('Jet twin · Class A','Jet tomotors · klasse A')};
const DEF={jet:{m:70000,mR:[50000,80000,500],lm:62000,lmR:[45000,68000,500],tora:2500,tR:[1200,4000,50],lda:2200,lR:[1000,3500,50],obs:{h:150,d:3000},dMax:3500},
 tp:{m:21000,mR:[14000,23500,250],lm:20000,lmR:[14000,22500,250],tora:1400,tR:[700,2500,25],lda:1300,lR:[600,2200,25],obs:{h:120,d:2000},dMax:2500},
 sep:{m:1050,mR:[750,1150,10],lm:1000,lmR:[700,1110,10],tora:600,tR:[250,1200,10],lda:500,lR:[200,1000,10],obs:{h:60,d:600},dMax:1200}};
const S={mode:'to',type:'jet',m:70000,lm:62000,flap:1,pa:0,oat:15,wind:0,slope:0,surf:'dry',tora:2500,cwy:0,swy:0,v1:null,obsH:150,obsD:3000,lda:2200,lred:false,rev:true,tAss:null};
const isA=()=>P.TYPES[S.type].cls==='A';
const massF=v=>S.type==='sep'?nf(v,0)+' kg':nf(v/1000,1)+' t';
const tp=()=>({type:S.type,m:S.m,flap:S.flap,pa:S.pa,oat:S.oat,wind:S.wind,slope:S.slope,surf:S.surf,tAss:S.tAss});
const lp=()=>({type:S.type,m:S.lm,pa:S.pa,oat:S.oat,wind:S.wind,slope:S.slope,surf:S.surf,red:S.lred,rev:S.rev});
const rw=()=>({tora:S.tora,cwy:isA()?S.cwy:0,swy:isA()?S.swy:0});

let TO=null, LIM=null, limT=0;
function model(){ TO=P.takeoff(tp(),rw()); if(TO.cls==='A'){ if(S.v1==null||!TO.arr.length) S.v1=TO.bal.v1; S.v1=clamp(S.v1,TO.arr[0].v1,TO.arr[TO.arr.length-1].v1); } return TO; }
const curV=()=>TO.cls==='A'?P.atV1(TO,S.v1):null;
function schedLim(){ clearTimeout(limT); LIM=null; if(!deepOn()||S.mode==='land') return; limT=setTimeout(()=>{ LIM=P.limits(tp(),rw(),isA()?{h:S.obsH,d:S.obsD}:null); LIM.flex=S.type==='sep'?null:P.assumed(tp(),rw(),{h:S.obsH,d:S.obsD}); advRo(); },180); }

/* ---------------- canvas helpers ---------------- */
const cv=el('pfv'); const ST=LAB.fit(cv,()=>draw(),2);
let FS=1;
function font(sz,wt,f){ return `${wt||500} ${Math.round(sz*FS*10)/10}px ${f||MONO}`; }
function txt(g,s,x,y,col,al,sz,wt,f){ g.font=font(sz||11,wt,f); g.fillStyle=col||C.txt; g.textAlign=al||'left'; g.textBaseline='alphabetic'; g.fillText(s,x,y); g.textAlign='left'; }
function line(g,x1,y1,x2,y2,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); g.setLineDash([]); }
function poly(g,pts,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke(); g.setLineDash([]); }
function rr(g,x,y,w,h,r){ g.beginPath(); g.roundRect?g.roundRect(x,y,w,h,r):g.rect(x,y,w,h); }
function tw(g,s,sz,wt,f){ g.font=font(sz,wt,f); return g.measureText(s).width; }
function wrapTxt(g,t,x,y,maxW,sz,col){ let cur=''; const lh=sz*FS*1.5; for(const w of t.split(' ')){ const n=cur?cur+' '+w:w; if(tw(g,n,sz,500,SANS)>maxW&&cur){ txt(g,cur,x,y,col,'left',sz,500,SANS); y+=lh; cur=w; } else cur=n; } if(cur){ txt(g,cur,x,y,col,'left',sz,500,SANS); y+=lh; } return y; }
function hatch(g,x,y,w,h,col){ g.save(); g.beginPath(); g.rect(x,y,w,h); g.clip(); g.strokeStyle=col; g.lineWidth=1; for(let k=-h;k<w+h;k+=6){ g.beginPath(); g.moveTo(x+k,y+h); g.lineTo(x+k+h,y); g.stroke(); } g.restore(); }
function mark(g,x,y,okk){ g.strokeStyle=okk?C.ok:C.stop; g.lineWidth=2.2; g.beginPath(); if(okk){ g.moveTo(x-4,y); g.lineTo(x-1,y+3); g.lineTo(x+5,y-4); } else { g.moveTo(x-4,y-4); g.lineTo(x+4,y+4); g.moveTo(x+4,y-4); g.lineTo(x-4,y+4); } g.stroke(); }
/* a side-view aircraft, nose right, size s px; jet or prop */
function plane(g,x,y,s,col,ang){ g.save(); g.translate(x,y); g.rotate(-(ang||0)); g.scale(s/20,s/20); g.fillStyle=col; g.beginPath();
  g.moveTo(-20,-1); g.lineTo(-17,-7); g.lineTo(-14,-7); g.lineTo(-11,-2); g.lineTo(12,-2.5); g.quadraticCurveTo(19,-2,20,0.5); g.quadraticCurveTo(18,2.5,12,2.5); g.lineTo(-18,2); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-2,0.5); g.lineTo(5,0.5); g.lineTo(-1,5.5); g.lineTo(-4,5.5); g.closePath(); g.fill(); g.restore(); }
/* a labelled bar: from x0 to x1 at y, with segments [[d0,d1,col,dash]] in metres */
function bar(g,X,y,h,segs){ for(const [a,b,col,dash] of segs){ if(!(b>a)) continue; const x0=X(a), x1=X(b);
  if(dash){ g.fillStyle=col+'33'; g.fillRect(x0,y,x1-x0,h); g.strokeStyle=col; g.lineWidth=1.4; g.setLineDash([4,3]); g.strokeRect(x0+0.5,y+0.5,x1-x0-1,h-1); g.setLineDash([]); }
  else { g.fillStyle=col; g.fillRect(x0,y,x1-x0,h); } } }

/* ---------------- the figure ---------------- */
function draw(){ if(!ST.w||!TO) return; const g=ST.ctx, W=ST.w, H=ST.h; g.setTransform(ST.dpr,0,0,ST.dpr,0,0); g.clearRect(0,0,W,H);
  FS=depth()==='instructor'?1.12:W<520?0.88:1;
  const chip=el('chip'); let top=12; if(chip&&getComputedStyle(chip).position==='absolute'&&chip.offsetHeight) top=chip.offsetTop+chip.offsetHeight+14;
  const end=S.mode==='to'?(TO.cls==='A'?drawTOA:drawTOB)(g,W,H,top):S.mode==='climb'?drawClimb(g,W,H,top):drawLand(g,W,H,top);
  /* the canvas takes the height its content needs (width-driven, so it settles in one step) */
  const want=Math.round(S.mode==='climb'?clamp(W*0.52,360,560)+(top>20?top-12:0):end+14);
  if(Math.abs(want-H)>3){ cv.style.height=want+'px'; } }

/* the declared distances above the runway and the runway itself */
function runway(g,X,y,rh,tora,cwy,swy,lab){ const ph=ST.w<640;
  /* clearway: the area beyond the end, over ground or water, that the aircraft may fly over (no load-bearing needed) */
  if(cwy>0){ g.strokeStyle='rgba(127,203,232,.65)'; g.lineWidth=1.2; g.setLineDash([4,3]); g.strokeRect(X(tora),y-rh*0.45,X(tora+cwy)-X(tora),rh*1.9); g.setLineDash([]);
    txt(g,L(t2('clearway','klarflate')),X(tora+cwy)-4,y-rh*0.45-4,C.aeo,'right',9.5); }
  g.fillStyle=C.rwy; g.fillRect(X(0),y,X(tora)-X(0),rh);
  if(swy>0){ g.fillStyle='#2b2f33'; g.fillRect(X(tora),y,X(tora+swy)-X(tora),rh); hatch(g,X(tora),y,X(tora+swy)-X(tora),rh,'rgba(240,180,64,.6)');
    txt(g,L(t2('stopway','stoppflate')),X(tora+swy)+4,y+rh+12,C.go,'right',9.5); }
  for(let i=0;i<4;i++) g.fillRect(0,0,0,0);
  g.fillStyle='rgba(238,242,245,.85)'; for(let k=0;k<5;k++) g.fillRect(X(0)+3,y+3+k*(rh-6)/5,8,(rh-6)/5*0.6);
  for(let d=tora*0.06;d<tora*0.94;d+=tora/22) g.fillRect(X(d),y+rh/2-0.8,Math.max(3,(X(tora)-X(0))/60),1.6);
  if(lab) txt(g,lab,X(0)+16,y+rh/2+4,'rgba(238,242,245,.6)','left',ph?9:10); }
function bracket(g,X,y,len,name,col){ line(g,X(0),y,X(len),y,col,1.4); line(g,X(0),y-4,X(0),y+4,col,1.4); line(g,X(len),y-4,X(len),y+4,col,1.4);
  const s=name+' '+m0(len); txt(g,s,X(len)-4,y-5,col,'right',10,600); }

function drawTOA(g,W,H,top){ const ph=W<640, T=TO, x=curV(), sp=T.sp, toda=T.toda, asda=T.asda;
  const Dmax=Math.max(toda,asda,x.go,x.stop,T.aeoReq)*1.04, L0=14, R0=14, X=d=>L0+d/Dmax*(W-L0-R0);
  let y=top+12;
  const bl=[['TORA',S.tora,'#AEB8C1'],['ASDA',asda,C.stop],['TODA',toda,C.aeo]], grp=[];
  bl.forEach(b=>{ const gq=grp.find(x=>Math.abs(x[1]-b[1])<0.5); if(gq){ gq[0]+=' = '+b[0]; } else grp.push(b.slice()); });
  grp.forEach(([n,len,c])=>{ bracket(g,X,y,len,n,grp.length===1?'#C9D2DA':c); y+=19; }); y-=3;
  const rh=ph?18:24; runway(g,X,y,rh,S.tora,toda-S.tora,asda-S.tora);
  /* where V1 and VR come on the all-engines run */
  const o=P.setup(tp()); const dV1=P.accel(o,0,S.v1,o.ty.n).s, dVR=P.accel(o,0,sp.vr,o.ty.n).s;
  const close=Math.abs(X(dVR)-X(dV1))<26;
  [[dV1,'V1',C.go,close?'right':'center'],[dVR,'VR','#EEF2F5',close?'left':'center']].forEach(([d,n,c,al])=>{ if(!isFinite(d)) return; line(g,X(d),y-2,X(d),y+rh+2,c,2); txt(g,n,X(d)+(al==='right'?-3:al==='left'?3:0),y+rh+12,c,al,10,700); });
  y+=rh+(ph?26:30);
  /* the three distances */
  const bh=ph?9:11, gap=ph?30:34, rows=[
   {lab:t2('All engines × 1.15, to 35 ft','Alle motorer × 1,15, til 35 ft'),end:T.aeoReq,lim:toda,segs:[[0,T.aeo.ground*1.15,C.aeo],[T.aeo.ground*1.15,T.aeoReq,C.aeo,1]]},
   {lab:t2(`Engine fails at V1 ${Math.round(S.v1)} kt → GO, to ${S.surf==='dry'?35:15} ft`,`Motorstans ved V1 ${Math.round(S.v1)} kt → FORTSETT, til ${S.surf==='dry'?35:15} ft`),end:x.go,lim:toda,segs:[[0,x.dv1,'#C9D2DA'],[x.dv1,x.go-x.air,C.go],[x.go-x.air,x.go,C.go,1]]},
   {lab:t2(`Engine fails at V1 → STOP`,`Motorstans ved V1 → STOPP`),end:x.stop,lim:asda,segs:[[0,x.dv1,'#C9D2DA'],[x.dv1,x.dv1+2*x.gsV1*P.KT,'#8E99A4'],[x.dv1+2*x.gsV1*P.KT,x.stop,C.stop]]}];
  line(g,X(toda),y-14,X(toda),y+gap*2+bh+4,'rgba(127,203,232,.5)',1,[3,3]); line(g,X(asda),y-14,X(asda),y+gap*2+bh+4,'rgba(236,90,71,.5)',1,[3,3]);
  rows.forEach((r,i)=>{ const yy=y+i*gap; txt(g,L(r.lab),X(0),yy-4,C.mut,'left',ph?9.5:10.5,500,SANS); bar(g,X,yy,bh,r.segs);
    const okk=isFinite(r.end)&&r.end<=r.lim+0.5, xe=Math.min(X(isFinite(r.end)?r.end:Dmax),W-60); mark(g,xe+9,yy+bh/2,okk); txt(g,isFinite(r.end)?m0(r.end):'—',xe+18,yy+bh-1,okk?C.ok:C.stop,'left',10.5,600); });
  y+=gap*2+bh+(ph?30:36);
  /* the V1 window */
  return drawWindow(g,T,y,y+(ph?96:104),W); }

/* V1 along a speed scale: which V1 lets you both stop and go */
function drawWindow(g,T,y0,y1,W){ const ph=W<640, sp=T.sp, vb=T.vmbe, arr=T.arr;
  const s0=Math.floor((Math.min(sp.vmcg,arr[0].v1)-8)/10)*10, s1=Math.ceil((sp.vr+12)/10)*10, L0=ph?14:24, R0=ph?14:24, X=v=>L0+(v-s0)/(s1-s0)*(W-L0-R0);
  txt(g,L(t2('WHERE CAN V1 BE? (kt)','HVOR KAN V1 LIGGE? (kt)')),L0,y0+2,'#AEB8C1','left',10.5,600);
  const by=y0+(ph?24:28), bh=ph?14:16;
  g.fillStyle='rgba(255,255,255,.05)'; g.fillRect(X(s0),by,X(s1)-X(s0),bh);
  /* below VMCG */ hatch(g,X(s0),by,X(sp.vmcg)-X(s0),bh,'rgba(236,90,71,.55)');
  /* above VR */ g.fillStyle='rgba(120,130,140,.35)'; g.fillRect(X(sp.vr),by,X(s1)-X(sp.vr),bh);
  for(const p of arr){ if(p.v1<sp.vmcg-0.5) continue; const goOK=p.go<=T.toda&&p.run<=T.tora, stOK=p.stop<=T.asda&&p.v1<=vb;
    g.fillStyle=goOK&&stOK?'rgba(113,204,147,.85)':!goOK&&!stOK?'rgba(236,90,71,.5)':!goOK?'rgba(240,180,64,.55)':'rgba(236,90,71,.55)'; g.fillRect(X(p.v1-0.5),by,Math.max(1,X(p.v1+0.5)-X(p.v1-0.5)),bh); }
  /* scale */
  for(let v=s0;v<s1;v+=10){ line(g,X(v),by+bh,X(v),by+bh+4,'#6F7E8B',1); txt(g,String(v),X(v),by+bh+15,C.dim,'center',9.5); }
  /* limits */
  const lim=[[sp.vmcg,'VMCG',C.stop],[sp.vr,'VR','#EEF2F5']]; if(isFinite(vb)&&vb<s1) lim.push([vb,'VMBE',C.stop]);
  lim.forEach(([v,n,c])=>{ line(g,X(v),by-4,X(v),by+bh+4,c,1.5); txt(g,n,X(v),by-7,c,'center',9.5,700); });
  /* chosen V1 and the balanced V1 */
  const xv=X(S.v1); g.fillStyle='#F4F7F9'; g.beginPath(); g.moveTo(xv,by+bh+2); g.lineTo(xv-6,by+bh+11); g.lineTo(xv+6,by+bh+11); g.closePath(); g.fill();
  line(g,xv,by-2,xv,by+bh+2,'#F4F7F9',2.4);
  const yl=by+bh+(ph?30:32);
  const win=T.win; let msg;
  if(win) msg=L(t2(`Green: any V1 from ${Math.round(win[0])} to ${Math.round(win[1])} kt works. Balanced V1 ≈ ${Math.round(T.bal.v1)} kt (go = stop).`,`Grønt: enhver V1 fra ${Math.round(win[0])} til ${Math.round(win[1])} kt virker. Balansert V1 ≈ ${Math.round(T.bal.v1)} kt (fortsett = stopp).`));
  else msg=L(t2('No green: no V1 lets you both stop and go on this runway. Reduce the mass or change the conditions.','Ikke noe grønt: ingen V1 lar deg både stoppe og fortsette på denne banen. Reduser massen eller endre forholdene.'));
  txt(g,msg,L0,yl,win?C.ok:C.stop,'left',ph?9.5:10.5,600,SANS);
  if(isFinite(T.bal.v1)){ const xb=X(T.bal.v1); line(g,xb,by+bh,xb,by+bh+6,C.go,2); }
  const ky=by-(ph?18:20); if(!ph){ let kx=X(s1); [[t2('can’t stop','kan ikke stoppe'),'rgba(236,90,71,.8)'],[t2('can’t go','kan ikke fortsette'),'rgba(240,180,64,.9)'],[t2('both fit','begge passer'),'rgba(113,204,147,.95)']].forEach(([t,c])=>{ const s=L(t), w=tw(g,s,9.5,500,SANS); kx-=w+22; g.fillStyle=c; g.fillRect(kx,ky-8,10,9); txt(g,s,kx+14,ky,C.mut,'left',9.5,500,SANS); }); }
  return yl+6; }

/* Class B: one factored distance, no V1 */
function drawTOB(g,W,H,top){ const ph=W<640, T=TO, f=T.f, base=T.aeo.dist, req=T.req;
  const Dmax=Math.max(S.tora,req)*1.06, L0=14, R0=14, X=d=>L0+d/Dmax*(W-L0-R0); let y=top+14;
  bracket(g,X,y,S.tora,'TORA','#AEB8C1'); y+=16; const rh=ph?18:24; runway(g,X,y,rh,S.tora,0,0);
  const o=P.setup(tp()), dR=P.accel(o,0,T.sp.vr,1).s; line(g,X(dR),y-2,X(dR),y+rh+2,'#EEF2F5',2); txt(g,'VR',X(dR),y+rh+12,'#EEF2F5','center',10,700);
  y+=rh+(ph?28:34);
  const bh=ph?10:12, gap=ph?34:40;
  txt(g,L(t2('Flight manual distance to 50 ft (paved, dry)','Distanse til 50 ft fra flyhåndboken (fast dekke, tørr)')),X(0),y-5,C.mut,'left',ph?9.5:10.5,500,SANS);
  bar(g,X,y,bh,[[0,T.aeo.ground,C.aeo],[T.aeo.ground,base,C.aeo,1]]); txt(g,m0(base),X(base)+8,y+bh-1,C.txt,'left',10.5,600);
  y+=gap; const a1=base*1.25, a2=a1*f.surf, a3=a2*f.sl;
  txt(g,L(t2('Required: × 1.25','Påkrevd: × 1,25'))+(f.surf>1?L(t2(` × ${nf(f.surf,1)} grass`,` × ${nf(f.surf,1)} gress`)):'')+(f.sl>1?L(t2(` × ${nf(f.sl,2)} upslope`,` × ${nf(f.sl,2)} oppoverbakke`)):''),X(0),y-5,C.mut,'left',ph?9.5:10.5,500,SANS);
  bar(g,X,y,bh,[[0,base,C.aeo],[base,a1,C.go],[a1,a2,'#B98A5A'],[a2,a3,C.net]]);
  const okk=req<=S.tora; mark(g,Math.min(X(req),W-60)+9,y+bh/2,okk); txt(g,m0(req),Math.min(X(req),W-60)+18,y+bh-1,okk?C.ok:C.stop,'left',10.5,600);
  line(g,X(S.tora),y-gap-12,X(S.tora),y+bh+6,'rgba(174,184,193,.6)',1,[3,3]);
  y+=gap+6;
  const lines=[t2('No V1 here. A light single cannot continue after an engine failure, so the rules ask only for the all-engines distance, with margins.','Ingen V1 her. Et lett enmotors fly kan ikke fortsette etter motorstans, så reglene krever bare distansen med alle motorer, med margin.'),
    t2('Engine failure on the runway: close the throttle and stop. After lift-off: land ahead, turning only a little.','Motorstans på banen: trekk av og stopp. Etter avløft: land rett fram, sving bare litt.')];
  lines.forEach((t,i)=>{ y=wrapTxt(g,L(t),X(0),y,W-28,ph?9.5:11,i?C.mut:'#C9D2DA')+4; });
  return y; }

/* the climb after take-off, from the side */
function climbPath(gr,net){ /* returns points [x m, h ft] from the end of the take-off distance */
  const ty=P.TYPES[S.type], o=P.setup(tp()), sp=o.sp, d=net?0.008:0, h0=S.surf==='dry'?35:15, pts=[[0,h0]];
  const V2=sp.v2*P.KT/Math.sqrt(o.a.sig), L1=V2*6, g1=gr.s1-d, g2=gr.s2-d, g4=gr.s4-d; let x=L1, h=h0+Math.max(0,g1)*L1/P.FT; pts.push([x,h]);
  const acc=ty.k==='jet'?1000:800; if(g2>0){ const dx=(acc-h)*P.FT/g2; x+=Math.max(0,dx); h=Math.max(h,acc); } else { x+=8000; } pts.push([x,h]);
  const Vf=1.25*P.vs(ty,S.m,ty.flaps[0].cl)*1.18*P.KT/Math.sqrt(o.a.sig), L3=Math.max(0,(Vf*Vf-V2*V2)/(2*9.81*Math.max(0.004,g4)));
  x+=L3; pts.push([x,h]); if(g4>0){ x+=(1500-h)*P.FT/g4; h=1500; } else x+=8000; pts.push([x,h]); return pts; }
function hAt(pts,d){ for(let i=1;i<pts.length;i++) if(d<=pts[i][0]){ const [a,ha]=pts[i-1],[b,hb]=pts[i]; return ha+(hb-ha)*(d-a)/Math.max(1e-9,b-a); } return pts[pts.length-1][1]; }
function drawClimb(g,W,H,top){ const ph=W<640, ty=P.TYPES[S.type], gr=P.grads(tp()), A=ty.cls==='A';
  const gp0=A?climbPath(gr,false):null, pEnd=A?Math.min(gp0[gp0.length-1][0],40000):0;
  const L0=ph?40:52, R0=14, B0=ph?28:34, T0=top+(ph?44:48), xMax=A?Math.max(S.obsD*1.4,pEnd*1.03):Math.max(S.obsD*1.6,2500), yMax=A?1600:1100;
  const X=d=>L0+d/xMax*(W-L0-R0), Y=f=>H-B0-f/yMax*(H-B0-T0);
  for(let f=0;f<=yMax;f+=A?500:250){ line(g,L0,Y(f),W-R0,Y(f),C.grid,1); txt(g,nf(f,0),L0-6,Y(f)+4,C.dim,'right',9.5); }
  txt(g,'ft',L0-6,T0-6,C.dim,'right',9.5);
  const step=xMax>16000?5000:xMax>8000?2000:xMax>3000?1000:500; for(let d=0;d<=xMax;d+=step) txt(g,d?nf(d/1000,d%1000?1:0)+' km':'0',X(d),H-B0+15,C.dim,'center',9.5);
  txt(g,L(t2('from the end of the take-off distance','fra slutten av startdistansen')),W-R0,H-B0+(ph?26:28),C.dim,'right',9.5,500,SANS);
  /* ground */ g.fillStyle='#24302a'; g.fillRect(L0,Y(0),W-R0-L0,H-B0-Y(0)+2); line(g,L0,Y(0),W-R0,Y(0),'#5F8A69',1.2);
  /* obstacle */
  const oh=S.obsH, od=S.obsD; if(oh>0){ const ox=X(od); g.fillStyle='#5b6670'; g.beginPath(); g.moveTo(ox-9,Y(0)); g.lineTo(ox,Y(oh)); g.lineTo(ox+9,Y(0)); g.closePath(); g.fill(); line(g,ox,Y(oh),ox,Y(oh)-6,C.stop,2); }
  let clr=null;
  if(A){ const gp=climbPath(gr,false), np=climbPath(gr,true);
    poly(g,gp.map(([d,h])=>[X(d),Y(h)]),C.aeo,2.6); poly(g,np.map(([d,h])=>[X(d),Y(h)]),C.net,2,[6,4]);
    /* segment labels on the gross path */
    const labs=[t2('1','1'),t2('2nd segment','2. segment'),t2('3 · accelerate, flaps up','3 · akselerer, klaff inn'),t2('final','siste')];
    for(let i=1;i<gp.length;i++){ const [a,ha]=gp[i-1],[b,hb]=gp[i]; if(X(b)-X(a)<(i===1?10:60)||X(a)>W-R0-30) continue; const xm=(X(a)+Math.min(X(b),W-R0))/2, ym=Y((ha+hb)/2), lvl=Math.abs(hb-ha)<1; txt(g,L(labs[i-1]),lvl?xm:xm-10,lvl?ym-8:ym-8,'#AEB8C1',lvl?'center':'right',ph?9:10,600,SANS); }
    for(let i=1;i<gp.length-1;i++) line(g,X(gp[i][0]),Y(gp[i][1])-5,X(gp[i][0]),Y(gp[i][1])+5,'#AEB8C1',1);
    if(oh>0){ const hn=hAt(np,od); clr=hn-oh; const col=clr>=35?C.ok:C.stop; line(g,X(od)+12,Y(oh),X(od)+12,Y(hn),col,1.6); txt(g,(clr>=0?'+':'−')+nf(Math.abs(Math.round(clr)),0)+' ft',X(od)+16,(Y(oh)+Y(hn))/2+4,col,'left',10.5,700); }
    const pd=gp[1][0]+(gp[2][0]-gp[1][0])*0.55, pa=Math.atan2(Y(hAt(gp,pd-100))-Y(hAt(gp,pd+100)),X(pd+100)-X(pd-100)); plane(g,X(pd),Y(hAt(gp,pd))-4,ph?16:20,'#F4F7F9',pa);
    const yy=top+12; txt(g,L(t2('gross path: what an average aircraft flies with one engine out','bruttobane: det et gjennomsnittsfly flyr med én motor ute')),L0+8,yy,C.aeo,'left',ph?9.5:10.5,600,SANS);
    txt(g,L(t2('net path: gross − 0.8 %, must clear obstacles by 35 ft','nettobane: brutto − 0,8 %, må klare hindre med 35 ft')),L0+8,yy+(ph?14:16),C.net,'left',ph?9.5:10.5,600,SANS); }
  else { const c=FPCx(); const mk=(gg,col,lab,dash)=>{ const pts=[[0,50],[(1000-50)*P.FT/Math.max(0.005,gg),1000]]; poly(g,pts.map(([d,h])=>[X(Math.min(d,xMax)),Y(d>xMax?50+gg*xMax/P.FT:h)]),col,2.4,dash); return pts; };
    const gx=c.gx, gy=c.gy, px=mk(gx,C.aeo,'Vx'), py=mk(gy,C.go,'Vy',[6,4]);
    if(oh>0){ const hn=50+gx*od/P.FT; clr=hn-oh; const col=clr>=0?C.ok:C.stop; line(g,X(od)+12,Y(oh),X(od)+12,Y(Math.min(hn,yMax)),col,1.6); txt(g,(clr>=0?'+':'−')+nf(Math.abs(Math.round(clr)),0)+' ft',X(od)+16,(Y(oh)+Y(Math.min(hn,yMax)))/2+4,col,'left',10.5,700); }
    void px; void py; const yy=top+12; txt(g,L(t2(`at Vx ${Math.round(c.vx)} kt: steepest, ${pc(gx)}`,`ved Vx ${Math.round(c.vx)} kt: brattest, ${pc(gx)}`)),L0+8,yy,C.aeo,'left',ph?9.5:10.5,600,SANS);
    txt(g,L(t2(`at Vy ${Math.round(c.vy)} kt: fastest climb, ${pc(gy)}`,`ved Vy ${Math.round(c.vy)} kt: raskest stigning, ${pc(gy)}`)),L0+8,yy+(ph?14:16),C.go,'left',ph?9.5:10.5,600,SANS); }
  climbClr=clr; }
let climbClr=null;
/* Class B single: gradients at Vx and Vy (all engines) from the take-off model */
function FPCx(){ const ty=P.TYPES.sep, a=P.atm(S.pa,S.oat), W=S.m*9.80665; let bx=null, by=null;
  for(let v=45;v<=100;v+=0.5){ const V=v*P.KT/Math.sqrt(a.sig), q=0.5*a.rho*V*V, cl=W/(q*ty.S), D=q*ty.S*(0.032+0.058*cl*cl), T=P.thrust(ty,a,V,1), gg=(T-D)/W, roc=gg*V;
    if(cl>1.35) continue; if(!bx||gg>bx.g) bx={v,g:gg}; if(!by||roc>by.r) by={v,g:gg,r:roc}; }
  return {vx:bx.v,gx:bx.g,vy:by.v,gy:by.g,roc:by.r/P.FT*60}; }

/* landing: the approach from the side and the distances against the LDA */
function drawLand(g,W,H,top){ const ph=W<640, Lr=P.landReq(lp()), c=Lr.cert, ta=P.landTA(lp()), ty=P.TYPES[S.type];
  const Dmax=Math.max(S.lda,Lr.req,deepOn()?ta.req:0)*1.05, L0=ph?40:70, R0=14, X=d=>L0+d/Dmax*(W-L0-R0);
  let y=top+10;
  /* side view: 50 ft over the threshold, down to touchdown, then the roll */
  const sc=ph?1:1.15, hs=Math.round((ph?40:56)*sc), gy=y+hs+18, Yh=h=>gy-h/50*hs;
  line(g,X(-Dmax*0.06)-30,gy,W-R0,gy,'#5F8A69',1.2);
  const xt=X(c.air); poly(g,[[X(0)-(ph?26:56),Yh(50+ (ph?26:56)/(X(c.air)-X(0))*50)],[X(0),Yh(50)],[xt,gy]],C.aeo,2.2); poly(g,[[xt,gy],[X(c.ld),gy]],C.go,3);
  line(g,X(0),gy,X(0),Yh(50),'rgba(238,242,245,.5)',1,[2,3]); txt(g,'50 ft',X(0)+5,(gy+Yh(50))/2+8,C.mut,'left',9.5);
  plane(g,X(0),Yh(50)-3,ph?15:19,'#F4F7F9',-0.05);
  txt(g,L(t2('VREF ','VREF '))+Math.round(c.vref)+' kt',X(0)+6,Yh(50)-8,C.txt,'left',10,600);
  txt(g,L(t2('air','luft')),(X(0)+xt)/2,gy+13,C.aeo,'center',9.5); txt(g,L(t2('braking','bremsing')),(xt+X(c.ld))/2,gy+13,C.go,'center',9.5);
  y=gy+Math.round((ph?26:34)*sc); bracket(g,X,y,S.lda,'LDA','#AEB8C1'); y+=10; const rh=ph?16:22; runway(g,X,y,rh,S.lda,0,0); y+=rh+Math.round((ph?26:32)*sc);
  const bh=ph?9:11, gap=Math.round((ph?32:42)*sc);
  const fac=Lr.f.map(([k,v])=>k==='reg'?(ty.k==='jet'?L(t2('÷ 0.6','÷ 0,6')):L(t2('÷ 0.7','÷ 0,7'))):k==='cont'?L(t2('1.15 × contaminated','1,15 × kontaminert')):k==='wet'?L(t2('× 1.15 wet','× 1,15 våt')):k==='grass'?L(t2('× 1.15 grass','× 1,15 gress')):L(t2(`× ${nf(v,2)} downslope`,`× ${nf(v,2)} nedoverbakke`))).join(' ');
  const rows=[{lab:t2('Certified: dry, 50 ft to a stop, no reverse','Sertifisert: tørr, 50 ft til stopp, uten reversering'),end:c.ld,lim:Infinity,segs:[[0,c.air,C.aeo,1],[c.air,c.ld,C.go]]},
    {lab:t2('Required at dispatch: ','Påkrevd ved planlegging: '),suf:fac,end:Lr.req,lim:S.lda,segs:[[0,c.ld,'#C9D2DA'],[c.ld,Lr.req,'#C9B6F2',1]]}];
  if(deepOn()) rows.push({lab:t2('Before landing, actual conditions + 15 %','Før landing, faktiske forhold + 15 %'),end:ta.req,lim:S.lda,segs:[[0,ta.ld,'#9FB0BE'],[ta.ld,ta.req,'#9FB0BE',1]]});
  line(g,X(S.lda),y-14,X(S.lda),y+gap*(rows.length-1)+bh+4,'rgba(174,184,193,.6)',1,[3,3]);
  rows.forEach((r,i)=>{ const yy=y+i*gap; txt(g,L(r.lab)+(r.suf||''),X(0),yy-4,C.mut,'left',ph?9.5:10.5,500,SANS); bar(g,X,yy,bh,r.segs);
    const okk=r.end<=r.lim, xe=Math.min(X(r.end),W-60); if(isFinite(r.lim)) mark(g,xe+9,yy+bh/2,okk); txt(g,m0(r.end),xe+18,yy+bh-1,isFinite(r.lim)?(okk?C.ok:C.stop):C.txt,'left',10.5,600); });
  y+=gap*(rows.length-1)+bh+(ph?28:34);
  if(ty.cls==='A'){ const cl=P.landClimb(lp()); const s=L(t2(`Go-around: approach climb (one engine out) ${pc(cl.approach)}, need 2.1 % · landing climb (all engines) ${pc(cl.landing)}, need 3.2 %`,`Avbrutt landing: innflygingsstigning (én motor) ${pc(cl.approach)}, krav 2,1 % · landingsstigning (alle motorer) ${pc(cl.landing)}, krav 3,2 %`));
    y=wrapTxt(g,s,X(0),y,W-X(0)-12,ph?9:10,cl.approach>=0.021&&cl.landing>=0.032?C.mut:C.stop); }
  return y; }

/* ---------------- readout chip, legend, "what you're seeing" ---------------- */
const ch=(i,b,cls)=>`<span><i>${i}</i><b${cls?` class="${cls}"`:''}>${b}</b></span>`;
function readout(){ let h=''; const T=TO;
  if(S.mode==='to'){ if(T.cls==='A'){ const x=curV(), sp=T.sp; const req=Math.max(x.go,T.aeoReq);
      h=ch('V1 · VR · V2',`${Math.round(S.v1)} · ${Math.round(sp.vr)} · ${Math.round(sp.v2)} kt`)+ch(L(t2('Take-off distance / TODA','Startdistanse / TODA')),m0(req)+' / '+m0(T.toda),req<=T.toda&&x.run<=T.tora?'g':'r')
       +ch(L(t2('Accelerate-stop / ASDA','Akselerer-stopp / ASDA')),m0(x.stop)+' / '+m0(T.asda),x.stop<=T.asda?'g':'r')+ch(L(t2('Wind used','Vind brukt')),sg(P.windF(S.wind))+' kt'); }
    else h=ch('VR · V50',`${Math.round(T.sp.vr)} · ${Math.round(T.sp.v2)} kt`)+ch(L(t2('Distance to 50 ft','Distanse til 50 ft')),m0(T.aeo.dist))+ch(L(t2('Required / TORA','Påkrevd / TORA')),m0(T.req)+' / '+m0(S.tora),T.ok?'g':'r')+ch(L(t2('Wind used','Vind brukt')),sg(P.windF(S.wind))+' kt'); }
  else if(S.mode==='climb'){ const gr=P.grads(tp()); if(isA()){ const need=P.obsNeed(S.obsH,S.obsD);
      h=ch(L(t2('2nd segment, gross','2. segment, brutto')),pc(gr.s2),gr.s2>=0.024?'g':'r')+ch(L(t2('Net (− 0.8 %)','Netto (− 0,8 %)')),pc(gr.s2-0.008))+ch(L(t2('Minimum, twin','Minimum, tomotors')),'2.4 %')+(S.obsH>0?ch(L(t2('Net needed for the obstacle','Netto nødvendig for hinderet')),pc(need),gr.s2-0.008>=need?'g':'r'):''); }
    else { const c=FPCx(); h=ch('Vx',Math.round(c.vx)+' kt · '+pc(c.gx))+ch('Vy',Math.round(c.vy)+' kt · '+nf(Math.round(c.roc/10)*10,0)+' ft/min')+(S.obsH>0?ch(L(t2('Over the obstacle','Over hinderet')),climbClr==null?'—':sg(Math.round(climbClr))+' ft',climbClr>=0?'g':'r'):''); } }
  else { const Lr=P.landReq(lp()); h=ch('VREF',Math.round(Lr.cert.vref)+' kt')+ch(L(t2('Certified distance','Sertifisert distanse')),m0(Lr.cert.ld))+ch(L(t2('Required / LDA','Påkrevd / LDA')),m0(Lr.req)+' / '+m0(S.lda),Lr.req<=S.lda?'g':'r')+ch(L(t2('Wind used','Vind brukt')),sg(P.windF(S.wind))+' kt'); }
  el('chip').innerHTML=h; const v=VIEWS.find(v=>v[0]===S.mode); el('xsv').textContent=v?L(v[1]):''; }
function legend(){ const lg=(c,t,k)=>`<span><i class="${k||''}" style="--c:${c}"></i>${L(t)}</span>`; let s='';
  if(S.mode==='to'){ s=lg(C.aeo,t2('all engines','alle motorer'))+(isA()?lg(C.go,t2('engine out: go','motorstans: fortsett'))+lg(C.stop,t2('engine out: stop','motorstans: stopp')):lg(C.go,t2('regulatory margin','lovpålagt margin')))+lg('#AEB8C1',t2('dashed: in the air','stiplet: i luften')); }
  else if(S.mode==='climb') s=isA()?lg(C.aeo,t2('gross path','bruttobane'),'ln')+lg(C.net,t2('net path','nettobane'),'ln'):lg(C.aeo,t2('climb at Vx','stigning ved Vx'),'ln')+lg(C.go,t2('climb at Vy','stigning ved Vy'),'ln');
  else s=lg(C.aeo,t2('air distance','luftdistanse'))+lg(C.go,t2('braking','bremsing'))+lg('#C9B6F2',t2('required margin','påkrevd margin'));
  el('vleg').innerHTML=s; }
function see(){ let t; const T=TO;
  if(S.mode==='to'){ if(T.cls==='A'){ const x=curV(); const go=Math.max(x.go,T.aeoReq)<=T.toda&&x.run<=T.tora, st=x.stop<=T.asda;
      t= go&&st? t2(`<b>Legal take-off.</b> If the engine fails before V1 you stop on the runway (and stopway); at or after V1 you continue and reach ${S.surf==='dry'?35:15} ft within the TODA.`,`<b>Lovlig start.</b> Stanser motoren før V1, stopper du på banen (og stoppflaten); ved eller etter V1 fortsetter du og når ${S.surf==='dry'?35:15} ft innenfor TODA.`)
       : !st&&go? t2('<b>Too far to stop.</b> At this V1 the accelerate-stop distance does not fit the ASDA. Lower V1, or add a stopway.','<b>For langt å stoppe.</b> Med denne V1 får ikke akselerer-stopp-distansen plass i ASDA. Senk V1 eller legg til stoppflate.')
       : go&&!st? '' : st? t2('<b>Too far to go.</b> At this V1 the engine-out take-off does not reach the screen height within the TODA. Raise V1, or a clearway helps.','<b>For langt å fortsette.</b> Med denne V1 når ikke starten med én motor skjermhøyden innenfor TODA. Øk V1, eller en klarflate hjelper.')
       : t2('<b>Neither fits.</b> No V1 works: the aircraft is too heavy for this runway today. Reduce the mass, use more flap, or wait for cooler air or a headwind.','<b>Ingen av dem passer.</b> Ingen V1 virker: flyet er for tungt for denne banen i dag. Reduser massen, bruk mer klaff, eller vent på kaldere luft eller motvind.'); }
    else t=T.ok?t2('<b>Class B:</b> the flight manual distance to 50 ft, times 1.25 and the surface and slope factors, fits the runway.','<b>Klasse B:</b> distansen til 50 ft fra flyhåndboken, ganget med 1,25 og faktorer for dekke og helning, får plass på banen.')
      :t2('<b>Too long:</b> with the margins the take-off does not fit. Reduce the mass, or wait for cooler air or a headwind.','<b>For lang:</b> med marginene får ikke starten plass. Reduser massen, eller vent på kaldere luft eller motvind.'); }
  else if(S.mode==='climb') t=isA()?(climbClr==null||climbClr>=35?t2('<b>Climb-out:</b> after lift-off on one engine, the net path (gross − 0.8 %) must clear every obstacle by 35 ft. It is the gradient, not the rate, that counts.','<b>Utflyging:</b> etter avløft på én motor må nettobanen (brutto − 0,8 %) klare alle hindre med 35 ft. Det er gradienten, ikke stigehastigheten, som teller.')
      :t2('<b>Obstacle not cleared by 35 ft.</b> Reduce the mass, use less flap (a better gradient), or plan a turn away from the obstacle.','<b>Hinderet klareres ikke med 35 ft.</b> Reduser massen, bruk mindre klaff (bedre gradient), eller planlegg en sving bort fra hinderet.'))
    :t2('<b>Light single:</b> Vx gives the steepest climb (most height per distance), Vy the fastest (most height per minute). Over an obstacle, fly Vx.','<b>Lett enmotors:</b> Vx gir brattest stigning (mest høyde per distanse), Vy raskest (mest høyde per minutt). Over et hinder flyr du Vx.');
  else { const Lr=P.landReq(lp()); t=Lr.req<=S.lda?t2(`<b>Fits.</b> The certified distance is measured by test pilots on a dry runway. Planning adds a big margin (${P.TYPES[S.type].k==='jet'?'÷ 0.6, that is × 1.67':'÷ 0.7, that is × 1.43'}) for real pilots, real runways and real weather.`,`<b>Får plass.</b> Den sertifiserte distansen er målt av testpiloter på tørr bane. Planleggingen legger på en stor margin (${P.TYPES[S.type].k==='jet'?'÷ 0,6, altså × 1,67':'÷ 0,7, altså × 1,43'}) for vanlige piloter, baner og vær.`)
      :t2('<b>Does not fit.</b> Reduce the landing mass, use full flap, or plan another runway or aerodrome.','<b>Får ikke plass.</b> Reduser landingsmassen, bruk full klaff, eller planlegg en annen bane eller flyplass.'); }
  el('xsee').innerHTML=L(t); }

/* Advanced: max mass today and the assumed temperature */
function advRo(){ const r=[]; const ro=(k,v,c)=>`<div class="rrow"><span>${L(k)}</span><b${c?` style="color:${c}"`:''}>${v}</b></div>`;
  if(LIM){ const N={struct:t2('structural','strukturell'),field:t2('field length','banelengde'),climb:t2('climb (2.4 %)','stigning (2,4 %)'),obst:t2('obstacle','hinder'),tyre:t2('tyre speed','dekkfart'),brake:t2('brake energy','bremseenergi')};
    r.push(ro(t2('Max take-off mass today','Maks startmasse i dag'),massF(Math.floor(LIM.max/100)*100),LIM.max>=S.m?'#2C7A4B':'#B3261E'));
    r.push(ro(t2('Limited by','Begrenset av'),L(N[LIM.gov])));
    Object.entries(LIM.L).forEach(([k,v])=>{ if(k!==LIM.gov) r.push(ro(N[k],massF(Math.floor(v/100)*100))); });
    if(S.type!=='sep') r.push(ro(t2('Highest assumed temperature','Høyeste antatte temperatur'),LIM.flex?LIM.flex.t+' °C (−'+Math.round(LIM.flex.red*100)+' %)':(S.surf==='cont'?L(t2('not on contaminated','ikke på kontaminert')):L(t2('none: use full thrust','ingen: bruk full skyvekraft'))))); }
  else r.push(`<div class="rrow"><span>…</span></div>`);
  el('advRo').innerHTML=r.join('');
  const Lr=P.landReq(lp()), ta=P.landTA(lp());
  el('advRoL').innerHTML=ro(t2('Certified (dry)','Sertifisert (tørr)'),m0(Lr.cert.ld))+ro(t2('Actual conditions','Faktiske forhold'),m0(ta.ld))+ro(t2('× 1.15 before landing','× 1,15 før landing'),m0(ta.req),ta.req<=S.lda?'#2C7A4B':'#B3261E'); }

/* ---------------- modes and controls ---------------- */
const VIEWS=[['to',t2('Take-off','Start')],['climb',t2('Climb-out','Utflyging')],['land',t2('Landing','Landing')]];
function drawTabs(){ el('vtabs').innerHTML=VIEWS.map(([k,t])=>`<button type="button" role="tab" data-v="${k}" class="${k===S.mode?'on':''}" aria-selected="${k===S.mode}">${L(t)}</button>`).join(''); }
el('vtabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setMode(b.dataset.v); });
function setMode(m){ if(!VIEWS.some(v=>v[0]===m)) m='to'; S.mode=m; if(m==='to'&&S.type==='sep'&&S.surf==='wet') S.surf='dry';
  el('xpanel').querySelectorAll('[data-pv]').forEach(d=>{ d.hidden=!d.dataset.pv.split(' ').includes(m); }); buildSurf(); drawTabs(); drawPre(); upd(); }

LAB.add({},{'Take-off mass':'Startmasse','Landing mass':'Landingsmasse','V1':'V1','Aerodrome pressure altitude':'Flyplassens trykkhøyde','Outside air temperature':'Utetemperatur','Reported wind (+ head, − tail)':'Rapportert vind (+ mot, − med)','Runway slope (+ uphill)':'Banehelning (+ oppover)',
 'TORA (runway length)':'TORA (banelengde)','Clearway':'Klarflate','Stopway':'Stoppflate','LDA':'LDA','Obstacle height':'Hinderhøyde','Obstacle distance (from end of TOD)':'Hinderavstand (fra slutten av TOD)','Assumed temperature (reduced thrust)':'Antatt temperatur (redusert skyvekraft)',
 'Dry':'Tørr','Wet':'Våt','Contaminated':'Kontaminert','Paved':'Fast dekke','Paved wet':'Fast dekke, våt','Grass':'Gress','Wet grass':'Vått gress','Full flap':'Full klaff','Reduced flap':'Redusert klaff'});
const sl={}; let typeSeg=null, flapSeg=null, surfSeg=null, lflapSeg=null;
function buildCtl(){ const D=DEF[S.type], ty=P.TYPES[S.type];
  ['v1Ctl','obsCtl','ldaCtl','wxCtl','rwyCtl','advCtl'].forEach(i=>el(i).innerHTML='');
  const add=(box,k,o)=>{ sl[k]=LAB.slider(el(box),o); };
  add('v1Ctl','m',{label:'Take-off mass',min:D.mR[0],max:D.mR[1],step:D.mR[2],v:S.m,f:massF,on:v=>{ S.m=v; S.v1=null; upd(); }});
  add('v1Ctl','v1',{label:'V1',min:80,max:170,step:1,v:S.v1||120,f:v=>Math.round(v)+' kt',on:v=>{ S.v1=v; upd(true); }});
  add('obsCtl','oh',{label:'Obstacle height',min:0,max:S.type==='sep'?300:600,step:10,v:S.obsH,f:v=>v+' ft',on:v=>{ S.obsH=v; upd(); }});
  add('obsCtl','od',{label:'Obstacle distance (from end of TOD)',min:S.type==='sep'?100:500,max:D.dMax*2,step:S.type==='sep'?50:100,v:S.obsD,f:m0,on:v=>{ S.obsD=v; upd(); }});
  add('ldaCtl','lm',{label:'Landing mass',min:D.lmR[0],max:D.lmR[1],step:D.lmR[2],v:S.lm,f:massF,on:v=>{ S.lm=v; upd(); }});
  add('ldaCtl','lda',{label:'LDA',min:D.lR[0],max:D.lR[1],step:D.lR[2],v:S.lda,f:m0,on:v=>{ S.lda=v; upd(); }});
  add('wxCtl','pa',{label:'Aerodrome pressure altitude',min:0,max:8000,step:250,v:S.pa,f:v=>nf(v,0)+' ft',on:v=>{ S.pa=v; S.v1=null; upd(); }});
  add('wxCtl','oat',{label:'Outside air temperature',min:-20,max:45,step:1,v:S.oat,f:v=>v+' °C',on:v=>{ S.oat=v; S.v1=null; upd(); }});
  add('wxCtl','wind',{label:'Reported wind (+ head, − tail)',min:-15,max:30,step:1,v:S.wind,f:v=>sg(v)+' kt',on:v=>{ S.wind=v; S.v1=null; upd(); }});
  add('wxCtl','slope',{label:'Runway slope (+ uphill)',min:-2,max:2,step:0.5,v:S.slope,f:v=>(v>0?'+':v<0?'−':'')+nf(Math.abs(v),1)+' %',on:v=>{ S.slope=v; S.v1=null; upd(); }});
  add('rwyCtl','tora',{label:'TORA (runway length)',min:D.tR[0],max:D.tR[1],step:D.tR[2],v:S.tora,f:m0,on:v=>{ S.tora=v; upd(); }});
  if(ty.cls==='A'){ add('rwyCtl','cwy',{label:'Clearway',min:0,max:600,step:25,v:S.cwy,f:m0,on:v=>{ S.cwy=v; upd(); }});
    add('rwyCtl','swy',{label:'Stopway',min:0,max:400,step:25,v:S.swy,f:m0,on:v=>{ S.swy=v; upd(); }});
    add('advCtl','tass',{label:'Assumed temperature (reduced thrust)',min:Math.round(S.oat),max:70,step:1,v:S.tAss??Math.round(S.oat),f:v=>v<=S.oat?L(t2('off (full thrust)','av (full skyvekraft)')):v+' °C',on:v=>{ S.tAss=v<=S.oat?null:v; S.v1=null; upd(); }}); }
  flapSeg=LAB.seg(el('flapSeg'),ty.flaps.map((f,i)=>[i,f.n]),S.flap,v=>{ S.flap=+v; S.v1=null; upd(); });
  lflapSeg=LAB.seg(el('lflapSeg'),[['full','Full flap'],['red','Reduced flap']],S.lred?'red':'full',v=>{ S.lred=v==='red'; upd(); });
  buildSurf(); }
function buildSurf(){ const A=isA(); const items=A?[['dry','Dry'],['wet','Wet'],['cont','Contaminated']]:S.mode==='land'?[['dry','Paved'],['wet','Paved wet'],['grass','Grass'],['wetgrass','Wet grass']]:[['dry','Paved'],['grass','Grass'],['wetgrass','Wet grass']];
  if(!items.some(i=>i[0]===S.surf)) S.surf='dry'; surfSeg=LAB.seg(el('surfSeg'),items,S.surf,v=>{ S.surf=v; S.v1=null; if(v==='cont') S.tAss=null; upd(); }); }
function setType(t){ if(!P.TYPES[t]) return; const D=DEF[t]; S.type=t; Object.assign(S,{m:D.m,lm:D.lm,tora:D.tora,lda:D.lda,cwy:0,swy:0,obsH:D.obs.h,obsD:D.obs.d,flap:1,v1:null,tAss:null});
  document.body.classList.toggle('cls-A',P.TYPES[t].cls==='A'); document.body.classList.toggle('cls-B',P.TYPES[t].cls==='B');
  typeSeg.set(t); buildCtl(); drawPre(); upd(); }
typeSeg=LAB.seg(el('typeSeg'),Object.keys(TN).map(k=>[k,TN[k].en]),S.type,v=>setType(v));
LAB.add({},{[TN.sep.en]:TN.sep.no,[TN.tp.en]:TN.tp.no,[TN.jet.en]:TN.jet.no});
el('balBtn').addEventListener('click',()=>{ S.v1=TO.bal.v1; upd(); });
el('revChk').addEventListener('change',e=>{ S.rev=e.target.checked; upd(); });

/* scenarios: conditions only (the aircraft stays) */
const SCN={to:[[t2('Standard day','Standarddag'),{pa:0,oat:15,wind:0,slope:0,surf:'dry'}],[t2('Hot and high','Varmt og høyt'),{pa:5000,oat:35,wind:0,slope:0,surf:'dry'}],[t2('Wet runway','Våt bane'),{surf:'wet',pa:0,oat:10,wind:0}],[t2('Tailwind 10 kt','Medvind 10 kt'),{wind:-10,pa:0,oat:15}],[t2('Short runway + stopway + clearway','Kort bane + stoppflate + klarflate'),{short:1}]],
 climb:[[t2('Obstacle close in','Hinder tett på'),{obsH:'hi',obsD:'near'}],[t2('Hot day','Varm dag'),{oat:38,pa:2000}],[t2('No obstacle','Uten hinder'),{obsH:0}]],
 land:[[t2('Dry','Tørr'),{surf:'dry',wind:0,slope:0}],[t2('Wet','Våt'),{surf:'wet'}],[t2('Contaminated (compacted snow)','Kontaminert (pakket snø)'),{surf:'cont',oat:-5,dp:1}],[t2('Tailwind 10 kt','Medvind 10 kt'),{wind:-10}],[t2('Heavy','Tung'),{heavy:1}]]};
function drawPre(){ el('pre').innerHTML=(SCN[S.mode]||[]).map(([t,o],i)=>(o.dp&&!deepOn())||(o.short&&!isA())||(o.surf==='cont'&&!isA())?'':`<button type="button" class="btn" data-s="${i}">${L(t)}</button>`).join(''); }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setS(SCN[S.mode][+b.dataset.s][1]); });
function setS(o){ if(!o) return; o=Object.assign({},o); const D=DEF[S.type];
  if(o.type&&o.type!==S.type){ setType(o.type); } delete o.type;
  if(o.mode&&o.mode!==S.mode) setMode(o.mode); delete o.mode;
  if(o.short){ Object.assign(S,{tora:Math.round(D.tora*0.8/50)*50,swy:Math.round(D.tora*0.08/25)*25,cwy:Math.round(D.tora*0.16/25)*25}); delete o.short; }
  if(o.obsH==='hi'){ o.obsH=D.obs.h*2; } if(o.obsD==='near'){ o.obsD=Math.round(D.obs.d*0.6/100)*100; }
  if(o.heavy){ S.lm=D.lmR[1]; delete o.heavy; } delete o.dp;
  if(o.surf==='cont') S.tAss=null; Object.assign(S,o); S.v1=o.v1??null; buildCtl(); upd(); }

/* ---------------- update ---------------- */
let raf=0;
function upd(fast){ model(); if(sl.v1&&TO.cls==='A'){ sl.v1.inp.min=TO.arr[0].v1; sl.v1.inp.max=TO.arr[TO.arr.length-1].v1; sl.v1.set(Math.round(S.v1)); }
  readout(); legend(); if(!fast) schedLim(); if(!raf) raf=requestAnimationFrame(()=>{ raf=0; draw(); see(); readout(); }); advRo(); }

/* ---------------- Try it ---------------- */
let ti=0; const ansv={}, done={};
const goModel=()=>{ const t=el('pfVp'); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'}); };
const NUM=(lab,v,tol)=>({lab,v,tol});
const TASKS=[
 {k:'v1',q:t2('Jet, 70 t, 2 300 m dry runway. Set a V1 that lets you both stop and go, then press Check.','Jet, 70 t, 2 300 m tørr bane. Sett en V1 som lar deg både stoppe og fortsette, og trykk Sjekk.'),
  pre:{type:'jet',mode:'to',m:70000,tora:2300,pa:0,oat:15,wind:0,slope:0,surf:'dry',v1:105},
  live:()=>{ if(S.mode!=='to'||S.type!=='jet') return [0,t2('Open Take-off with the jet ("Set it up in the model").','Åpne Start med jetflyet («Sett det opp i modellen»).')]; const x=curV(); const go=Math.max(x.go,TO.aeoReq)<=TO.toda&&x.run<=TO.tora, st=x.stop<=TO.asda;
    if(go&&st) return [1,t2(`Yes: V1 ${Math.round(S.v1)} kt is inside the green window. Below it you could not continue within the TODA; above it you could not stop within the ASDA.`,`Ja: V1 ${Math.round(S.v1)} kt ligger i det grønne vinduet. Under det kunne du ikke fortsatt innenfor TODA; over det kunne du ikke stoppet innenfor ASDA.`)];
    return [0,!go?t2('Too slow: after an engine failure at this V1 you would not reach 35 ft in time. Raise V1.','For lav: etter motorstans ved denne V1 når du ikke 35 ft i tide. Øk V1.'):t2('Too fast: you could not stop in time. Lower V1.','For høy: du rekker ikke å stoppe. Senk V1.')]; }},
 {k:'wind',q:t2('The tower reports a 10 kt tailwind. What wind must the take-off calculation use?','Tårnet rapporterer 10 kt medvind. Hvilken vind må startberegningen bruke?'),ins:[NUM(t2('Tailwind (kt)','Medvind (kt)'),15,0.5)],pre:{mode:'to',wind:-10},
  e:t2('At least 150 % of a reported tailwind: 15 kt. A headwind counts only 50 %. The rules are pessimistic both ways, because the wind can change.','Minst 150 % av rapportert medvind: 15 kt. Motvind teller bare 50 %. Reglene er pessimistiske begge veier, fordi vinden kan endre seg.')},
 {k:'hot',q:t2('Same jet and runway, but 35 °C at a 5 000 ft aerodrome. What happens to the take-off distance?','Samme jet og bane, men 35 °C på en flyplass i 5 000 ft. Hva skjer med startdistansen?'),pre:{mode:'to',pa:5000,oat:35,wind:0,surf:'dry'},
  opts:[t2('Much longer: less thrust and a higher true airspeed','Mye lengre: mindre skyvekraft og høyere sann fart'),t2('Unchanged: V1, VR and V2 are the same IAS','Uendret: V1, VR og V2 er samme IAS'),t2('Shorter: warm air helps the engines','Kortere: varm luft hjelper motorene'),t2('Only the landing changes','Bare landingen endres')],c:0,
  e:t2('Thin air hurts twice: the engines give less thrust, and the same indicated speeds mean a higher true (and ground) speed, which takes longer to reach and to stop from.','Tynn luft skader to ganger: motorene gir mindre skyvekraft, og de samme indikerte fartene betyr høyere sann fart (og groundspeed), som tar lengre tid å nå og å stoppe fra.')},
 {k:'ld',q:t2('A jet\'s certified landing distance on a dry runway is 1 100 m. What landing distance must be available at dispatch, dry?','Den sertifiserte landingsdistansen for et jetfly på tørr bane er 1 100 m. Hvilken landingsdistanse må være tilgjengelig ved planlegging, tørr bane?'),ins:[NUM(t2('LDA needed (m)','LDA nødvendig (m)'),1833,15)],pre:{mode:'land',surf:'dry'},
  e:t2('The certified distance must fit within 60 % of the LDA: 1 100 ÷ 0.6 ≈ 1 833 m. Wet: another 15 %, about 2 108 m. A turboprop uses 70 % (÷ 0.7).','Den sertifiserte distansen må få plass innenfor 60 % av LDA: 1 100 ÷ 0,6 ≈ 1 833 m. Våt: 15 % til, rundt 2 108 m. Et turbopropfly bruker 70 % (÷ 0,7).')},
 {k:'clb',q:t2('An obstacle 150 ft high stands 3 000 m beyond the end of the take-off distance. What gross gradient does a twin need, at least?','Et hinder 150 ft høyt står 3 000 m etter slutten av startdistansen. Hvilken bruttogradient trenger et tomotors fly minst?'),ins:[NUM(t2('Gross gradient (%)','Bruttogradient (%)'),2.32,0.06)],pre:{mode:'climb',obsH:150,obsD:3000},
  e:t2('The net path starts at 35 ft and must pass 35 ft above the top: it must climb 150 ft in 3 000 m, 45.7 m ÷ 3 000 m ≈ 1.52 % net. Add the 0.8 % margin for a twin: 2.32 % gross. The 2.4 % second-segment minimum is then the stricter rule.','Nettobanen starter i 35 ft og må passere 35 ft over toppen: den må stige 150 ft på 3 000 m, 45,7 m ÷ 3 000 m ≈ 1,52 % netto. Legg til 0,8 % margin for tomotors: 2,32 % brutto. Minimumskravet på 2,4 % i andre segment er da strengest.')},
 {k:'grass',q:t2('Light single: the flight manual gives 450 m to 50 ft. The strip is dry grass with a 1 % upslope. How much runway (TORA) do you need?','Lett enmotors: flyhåndboken gir 450 m til 50 ft. Banen er tørt gress med 1 % oppoverbakke. Hvor mye bane (TORA) trenger du?'),ins:[NUM(t2('TORA needed (m)','TORA nødvendig (m)'),709,8)],pre:{type:'sep',mode:'to',surf:'grass',slope:1},
  e:t2('450 × 1.2 (dry grass) × 1.05 (1 % up) × 1.25 (Class B margin) ≈ 709 m.','450 × 1,2 (tørt gress) × 1,05 (1 % opp) × 1,25 (klasse B-margin) ≈ 709 m.')},
 {k:'flap',q:t2('Turboprop, 1 300 m wet runway, full mass. Make the take-off legal without touching the mass, then press Check.','Turboprop, 1 300 m våt bane, full masse. Gjør starten lovlig uten å røre massen, og trykk Sjekk.'),
  pre:{type:'tp',mode:'to',m:23000,tora:1300,surf:'wet',flap:0,pa:0,oat:15,wind:0,slope:0},
  live:()=>{ if(S.type!=='tp'||S.mode!=='to') return [0,t2('Press "Set it up in the model" first.','Trykk «Sett det opp i modellen» først.')]; if(S.m<23000) return [0,t2('Keep the mass at 23 t.','Hold massen på 23 t.')]; if(!TO.ok||!TO.win) return [0,t2('Not yet. What gives a lower lift-off speed? (A clearway or stopway helps too.)','Ikke ennå. Hva gir lavere avløftsfart? (Klarflate eller stoppflate hjelper også.)')];
    return [1,t2(`Legal. ${S.flap>0?'More flap lowers VR and V2, so the run is shorter, at the price of a poorer climb gradient.':'Clearway and stopway add distance to go and to stop.'}`,`Lovlig. ${S.flap>0?'Mer klaff gir lavere VR og V2, så løpet blir kortere, på bekostning av dårligere stigegradient.':'Klarflate og stoppflate gir mer distanse til å fortsette og stoppe.'}`)]; }},
 {k:'vx',q:t2('In a light single you must clear trees just beyond the end of a short strip. Which speed?','I et lett enmotors fly må du klare trær like etter enden av en kort stripe. Hvilken fart?'),pre:{type:'sep',mode:'climb'},
  opts:[t2('Vx: best angle','Vx: beste vinkel'),t2('Vy: best rate','Vy: beste stigehastighet'),t2('VNE','VNE'),t2('Best glide','Beste glidefart')],c:0,
  e:t2('Vx gives the most height per distance; Vy the most height per minute. Obstacles are about distance.','Vx gir mest høyde per distanse; Vy mest høyde per minutt. Hindre handler om distanse.')},
 {k:'flex',dp:1,q:t2('Jet, light, long dry runway. You enter an assumed temperature of 50 °C. What is true?','Jet, lett, lang tørr bane. Du legger inn antatt temperatur 50 °C. Hva er riktig?'),pre:{type:'jet',mode:'to',m:62000,tora:3200,surf:'dry',tAss:50},
  opts:[t2('The engines give the thrust they would at 50 °C; full thrust is still there if needed','Motorene gir skyvekraften de ville gitt ved 50 °C; full skyvekraft finnes fortsatt om nødvendig'),t2('The speeds are calculated for a 50 °C runway, so they are too low','Fartene er beregnet for 50 °C, så de er for lave'),t2('It is allowed on contaminated runways','Det er tillatt på kontaminerte baner'),t2('It cuts thrust by any amount','Det kutter skyvekraften med vilkårlig mye')],c:0,
  e:t2('The real air is colder and denser than assumed, so the real true airspeeds are lower and the real margins larger. TOGA is always available. The reduction is limited to 25 %, and it is not used on contaminated runways.','Den virkelige luften er kaldere og tettere enn antatt, så de virkelige sanne fartene er lavere og marginene større. TOGA er alltid tilgjengelig. Reduksjonen er begrenset til 25 %, og den brukes ikke på kontaminerte baner.')}];
const tasks=()=>TASKS.filter(t=>!t.dp||deepOn());
function drawTask(){ const TS=tasks(); ti=clamp(ti,0,TS.length-1); const t=TS[ti], n=TS.length, a=ansv[t.k];
  let h=`<div class="th"><span class="n">${L(t2('Task','Oppgave'))} ${ti+1} ${L(t2('of','av'))} ${n}</span><span class="dots">${TS.map((x,i)=>`<button type="button" data-i="${i}" class="${i===ti?'on':''}" aria-label="${L(t2('Task','Oppgave'))} ${i+1}"></button>`).join('')}</span></div><p class="q">${L(t.q)}</p>`;
  if(t.ins){ h+=`<div class="ins">${t.ins.map((x,j)=>{ const v=a&&a[j]; const okk=v!=null&&v!==''&&Math.abs(parseFloat(String(v).replace(',','.').replace(/\s/g,''))-x.v)<=x.tol; return `<label>${L(x.lab)}<input type="text" inputmode="decimal" data-j="${j}" value="${v??''}" class="${done[t.k]?(okk?'right':'wrong'):''}" autocomplete="off"></label>`; }).join('')}<button type="button" class="btn pri sm" data-chk="1">${L(t2('Check','Sjekk'))}</button></div>`;
    h+=`<span class="fb${done[t.k]===1?' ok':''}">${done[t.k]?'<b>'+L(done[t.k]===1?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(t.e):''}</span>`; }
  else if(t.opts){ h+=`<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${a!=null?'<b>'+L(a===t.c?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(t.e):''}</span>`; }
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

/* ---------------- Understand: key concepts ---------------- */
const {sv,tx,ar}=KCS;
const go=o=>({click:()=>setS(o),to:'#pfVp'});
const rwyIll=(extra)=>`<rect x="10" y="26" width="120" height="12" fill="#3a444e"/>${extra||''}`;
const KC=[
 Object.assign({k:'dist',t:t2('The runway as the rules see it','Banen slik reglene ser den'),d:t2('<b>TORA</b> is the runway you can roll on, <b>ASDA</b> adds a stopway you can brake on, <b>TODA</b> adds a clearway you may fly over to 35 ft.','<b>TORA</b> er banen du kan rulle på, <b>ASDA</b> legger til en stoppflate du kan bremse på, <b>TODA</b> legger til en klarflate du kan fly over til 35 ft.'),
  dd:t2('Only half of the TORA can be added as clearway. The landing uses its own distance, the LDA.','Bare halve TORA kan legges til som klarflate. Landingen bruker sin egen distanse, LDA.'),
  ill:()=>sv(rwyIll(`<rect x="130" y="26" width="22" height="12" fill="#6b5b3a"/><rect x="130" y="18" width="56" height="28" fill="none" stroke="#7fcbe8" stroke-dasharray="3 2"/><line x1="10" y1="10" x2="130" y2="10" stroke="#aeb8c1"/><line x1="10" y1="54" x2="152" y2="54" stroke="#ec5a47"/><line x1="10" y1="60" x2="186" y2="60" stroke="#7fcbe8"/>${tx(70,8,'TORA','#aeb8c1','middle',7)}${tx(80,52,'ASDA','#ec5a47','middle',7)}`))},go({mode:'to',short:1})),
 Object.assign({k:'v1',t:t2('V1: stop or go','V1: stopp eller fortsett'),d:t2('Engine fails <b>below V1</b>: stop; at or <b>above V1</b>: go; V1 is set so that both end safely on your runway. A higher V1 means a longer stop but a shorter go.','Motoren stanser <b>under V1</b>: stopp; ved eller <b>over V1</b>: fortsett; V1 settes slik at begge ender trygt på banen din. Høyere V1 gir lengre stopp, men kortere fortsettelse.'),
  dd:t2('Where the two are equal is the balanced V1.','Der de to er like, er balansert V1.'),
  ill:()=>sv(`<line x1="10" y1="40" x2="190" y2="40" stroke="#5e6d7c"/><rect x="60" y="34" width="70" height="12" fill="#71cc93" opacity=".8"/><line x1="96" y1="26" x2="96" y2="50" stroke="#fff" stroke-width="2"/>${tx(96,22,'V1','#fff','middle',8)}${tx(30,58,'stop','#ec5a47','middle',7.5)}${tx(165,58,'go','#f0b440','middle',7.5)}`)},go({mode:'to'})),
 Object.assign({k:'longer',t:t2('What makes it longer','Hva som gjør den lengre'),d:t2('<b>Heavy, hot, high, tailwind, uphill, wet</b>: each one adds runway. Mass counts roughly squared.','<b>Tung, varmt, høyt, medvind, oppoverbakke, vått</b>: hver av dem krever mer bane. Massen teller omtrent i annen.'),
  dd:t2('The calculation uses only half of a reported headwind and one and a half times a reported tailwind.','Beregningen bruker bare halvparten av rapportert motvind og halvannen gang rapportert medvind.'),
  ill:()=>sv(`<rect x="10" y="20" width="70" height="10" fill="#7fcbe8"/><rect x="10" y="38" width="130" height="10" fill="#ec5a47" opacity=".85"/>${tx(84,29,'ISA','#7fcbe8','start',8)}${tx(144,47,'35 °C','#ec5a47','start',8)}`)},go({mode:'to',pa:5000,oat:35})),
 Object.assign({k:'climb',t:t2('Climb after take-off','Stigning etter avløft'),d:t2('With an engine out the <b>net</b> path, a pessimistic copy of the real one, must clear obstacles by <b>35 ft</b>.','Med én motor ute må <b>nettobanen</b>, en pessimistisk kopi av den virkelige, klare hindre med <b>35 ft</b>.'),
  dd:t2('For a twin the net path is the gross gradient minus 0.8 %. The second segment must give at least 2.4 % gross.','For tomotors er nettobanen bruttogradienten minus 0,8 %. Andre segment må gi minst 2,4 % brutto.'),
  ill:()=>sv(`<line x1="8" y1="56" x2="192" y2="56" stroke="#5f8a69"/><path d="M10,54 L190,14" stroke="#7fcbe8" stroke-width="2" fill="none"/><path d="M10,54 L190,26" stroke="#c9b6f2" stroke-width="1.6" stroke-dasharray="4 3" fill="none"/><path d="M120,56 L128,40 L136,56Z" fill="#5b6670"/>`)},go({mode:'climb'})),
 Object.assign({k:'land',t:t2('Landing margins','Landingsmarginer'),d:t2('The test-pilot (<b>certified</b>) distance must fit in <b>60 %</b> of the runway for a jet, 70 % for props, plus 15 % if wet.','Testpilotdistansen (<b>sertifisert</b>) må få plass på <b>60 %</b> av banen for jet, 70 % for propellfly, pluss 15 % hvis våt.'),
  dd:t2('VREF, the speed over the threshold, is at least 1.23 × the stall speed in landing configuration (1.3 for light aircraft).','VREF, farten over terskelen, er minst 1,23 × stallfarten i landingskonfigurasjon (1,3 for småfly).'),
  ill:()=>sv(`<path d="M10,14 L60,40" stroke="#7fcbe8" stroke-width="2"/><rect x="60" y="38" width="130" height="10" fill="#3a444e"/><rect x="60" y="52" width="60" height="6" fill="#f0b440"/><rect x="60" y="52" width="100" height="6" fill="none" stroke="#c9b6f2" stroke-dasharray="3 2"/>${tx(64,34,'50 ft','#8b99a7','start',7.5)}`)},go({mode:'land'})),
 Object.assign({k:'cls',t:t2('Light single vs airliner','Småfly mot trafikkfly'),d:t2('Turboprops and jets (<b>Class A</b>) must survive an engine failure at the worst moment. A light single (<b>Class B</b>) cannot, so it gets a simple margin instead: × 1.25 on the take-off.','Turbopropfly og jetfly (<b>klasse A</b>) må tåle motorstans i verste øyeblikk. Et lett enmotors fly (<b>klasse B</b>) kan ikke det, så det får en enkel margin i stedet: × 1,25 på starten.'),
  ill:()=>sv(`<rect x="10" y="20" width="80" height="12" fill="#3a444e"/><rect x="10" y="38" width="64" height="7" fill="#7fcbe8"/><rect x="74" y="38" width="16" height="7" fill="#f0b440"/>${tx(100,44,'× 1.25','#f0b440','start',9)}${tx(150,30,'A / B','#c9d2da','middle',11)}`)},go({type:'sep',mode:'to'})),
 Object.assign({k:'flex',dp:1,t:t2('Reduced thrust','Redusert skyvekraft'),d:t2('When the aircraft is lighter than the limit, a jet takes off with less thrust: the computer pretends it is hotter (<b>assumed temperature</b>). It saves engine wear; full thrust stays available.','Når flyet er lettere enn grensen, starter et jetfly med mindre skyvekraft: datamaskinen later som det er varmere (<b>antatt temperatur</b>). Det sparer motorslitasje; full skyvekraft er fortsatt tilgjengelig.'),
  ill:()=>sv(`<path d="M14,18 L110,18 L186,52" stroke="#f0b440" stroke-width="2" fill="none"/><line x1="110" y1="10" x2="110" y2="58" stroke="#5e6d7c" stroke-dasharray="2 3"/>${tx(60,32,'flat rated','#8b99a7','middle',7.5)}${tx(160,26,'flex','#7fcbe8','middle',8)}`)},go({type:'jet',mode:'to',m:62000,tora:3200,tAss:45})),
 Object.assign({k:'cont',dp:1,t:t2('Wet and contaminated','Våt og kontaminert'),d:t2('On a wet runway the brakes stop you more slowly, so V1 comes down. On a contaminated runway (snow, slush, ice) the aircraft also needs its own data, and no reduced thrust.','På våt bane stopper bremsene deg saktere, så V1 går ned. På kontaminert bane (snø, sludd, is) trenger flyet egne data, og ingen redusert skyvekraft.'),
  ill:()=>sv(`<rect x="10" y="26" width="180" height="14" fill="#3a444e"/>${[0,1,2,3,4,5,6,7].map(i=>`<circle cx="${20+i*22}" cy="33" r="3" fill="#e6f0ff" opacity=".7"/>`).join('')}`)},go({mode:'to',surf:'cont',oat:-5}))];
KCS.render(el('kcGrid'),KC);

/* ---------------- Deep dive ---------------- */
const Pp=s=>`<p>${s}</p>`, FX=s=>`<div class="fx">${s}</div>`, TB=(h,rows)=>`<div class="wrapx"><table class="ftab"><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
const DD=()=>[
 ['speeds',t2('The take-off speeds','Startfartene'),t2('VEF, V1, VMCG, VR, VLOF, V2','VEF, V1, VMCG, VR, VLOF, V2'),t2(
   TB(['','Definition (CS-25)'],[['VMCG','Lowest speed at which, after a sudden failure of the critical engine, the aircraft can be kept within 30 ft of the centreline with rudder only (no nosewheel steering).'],['VEF','The speed at which the critical engine is assumed to fail. Not less than VMCG.'],['V1','The speed by which the first action to stop must be taken. At least VEF plus the speed gained while the pilot recognises the failure; not more than VR, and not more than VMBE.'],['VR','Rotation speed. At least V1 and 1.05 VMCA; chosen so that V2 is reached by 35 ft with one engine out.'],['VLOF','Lift-off speed. At least 1.10 VMU with all engines (1.05 with one engine out); VMU is the slowest speed at which the aircraft can safely lift off.'],['V2','Take-off safety speed, reached by 35 ft with one engine out. At least 1.13 VSR (twins and three-engine jets) and 1.10 VMCA. Flown in the second segment.'],['VREF','Landing reference speed at 50 ft: at least 1.23 VSR0 (and VMCL). Class B light aircraft: 1.3 VS0.']])+Pp('So: <b>VMCG ≤ VEF < V1 ≤ VR</b>, and <b>V1 ≤ VMBE</b>. In the lab the dark grey area below VMCG and above VR is never a valid V1.'),
   TB(['','Definisjon (CS-25)'],[['VMCG','Laveste fart der flyet, etter plutselig stans i kritisk motor, kan holdes innenfor 30 ft fra senterlinjen med bare sideror (uten nesehjulsstyring).'],['VEF','Farten der kritisk motor antas å stanse. Ikke lavere enn VMCG.'],['V1','Farten der første handling for å stoppe må være gjort. Minst VEF pluss farten flyet får mens piloten oppdager stansen; ikke over VR, og ikke over VMBE.'],['VR','Rotasjonsfart. Minst V1 og 1,05 VMCA; valgt slik at V2 nås innen 35 ft med én motor ute.'],['VLOF','Avløftsfart. Minst 1,10 VMU med alle motorer (1,05 med én motor ute); VMU er laveste fart flyet trygt kan løfte av ved.'],['V2','Sikker startfart, nådd innen 35 ft med én motor ute. Minst 1,13 VSR (tomotors og tremotors jet) og 1,10 VMCA. Flys i andre segment.'],['VREF','Referansefart for landing ved 50 ft: minst 1,23 VSR0 (og VMCL). Lette klasse B-fly: 1,3 VS0.']])+Pp('Altså: <b>VMCG ≤ VEF < V1 ≤ VR</b>, og <b>V1 ≤ VMBE</b>. I labben er det mørkegrå området under VMCG og over VR aldri en gyldig V1.'))],
 ['v1',t2('Go, stop and the balanced field','Fortsett, stopp og balansert bane'),t2('How the distances are defined','Hvordan distansene er definert'),t2(
   Pp('<b>Take-off distance</b> (dry): the longer of the one-engine-out distance from brake release to 35 ft, and 115 % of the all-engines distance to 35 ft. It must fit in the TODA. <b>Take-off run</b>: to half-way between lift-off and 35 ft (×1.15 for all engines); it must fit in the TORA.')+Pp('<b>Accelerate-stop distance</b>: accelerate with all engines to VEF, with one engine out to V1, plus a distance equal to <b>2 seconds at V1</b>, then stop with the brakes. On a dry runway no reverse thrust is credited. It must fit in the ASDA.')+Pp('A higher V1 lengthens the stop and shortens the go. If they are equal the runway is <b>balanced</b> (balanced V1, balanced field length). A stopway lets V1 go up; a clearway lets it come down. Any V1 in the green window is legal; airlines often take one near the balanced point or a fixed ratio V1/VR.')+Pp('<b>Wet runway</b>: the go may end at 15 ft instead of 35 ft, and reverse thrust may be counted for the stop; V1 usually comes down. <b>VMBE</b>: above it the brakes cannot absorb the energy of a stop; it bites when heavy, hot, high or with a tailwind.'),
   Pp('<b>Startdistanse</b> (tørr): den lengste av distansen med én motor ute fra bremseslipp til 35 ft, og 115 % av distansen med alle motorer til 35 ft. Den må få plass i TODA. <b>Startløp</b>: til halvveis mellom avløft og 35 ft (×1,15 med alle motorer); det må få plass i TORA.')+Pp('<b>Akselerer-stopp-distanse</b>: akselerer med alle motorer til VEF, med én motor ute til V1, pluss en distanse lik <b>2 sekunder ved V1</b>, og stopp så med bremsene. På tørr bane godskrives ikke reversering. Den må få plass i ASDA.')+Pp('Høyere V1 forlenger stoppet og forkorter fortsettelsen. Er de like, er banen <b>balansert</b> (balansert V1, balansert banelengde). En stoppflate lar V1 gå opp; en klarflate lar den gå ned. Enhver V1 i det grønne vinduet er lovlig; flyselskaper velger ofte en nær balansepunktet eller et fast forhold V1/VR.')+Pp('<b>Våt bane</b>: fortsettelsen kan ende i 15 ft i stedet for 35 ft, og reversering kan regnes med i stoppet; V1 går vanligvis ned. <b>VMBE</b>: over den klarer ikke bremsene å ta opp energien i et stopp; den biter når flyet er tungt, det er varmt, høyt eller medvind.'))],
 ['factors',t2('What changes the distances','Hva som endrer distansene'),t2('Mass, altitude, temperature, wind, slope, surface, flap','Masse, høyde, temperatur, vind, helning, dekke, klaff'),t2(
   TB(['Factor','Effect','Why'],[['Mass ↑','longer, roughly ∝ mass²','higher speeds (∝ √m) and less acceleration'],['Pressure altitude ↑, temperature ↑','longer','less thrust or power; the same IAS is a higher TAS and groundspeed'],['Headwind','shorter; only 50 % may be counted','lower groundspeed at the same airspeed'],['Tailwind','much longer; 150 % must be counted','higher groundspeed'],['Uphill slope','longer take-off, shorter stop','gravity works against you, then for you'],['Wet, contaminated','longer stop (lower V1); contaminant drag on the take-off run','less friction'],['More flap','shorter field, poorer climb','lower speeds, more drag']])+Pp('Hot and high together, the <b>WAT</b> effect (weight, altitude, temperature), lowers every limit at once.'),
   TB(['Faktor','Virkning','Hvorfor'],[['Masse ↑','lengre, omtrent ∝ masse²','høyere farter (∝ √m) og mindre akselerasjon'],['Trykkhøyde ↑, temperatur ↑','lengre','mindre skyvekraft eller effekt; samme IAS er høyere TAS og groundspeed'],['Motvind','kortere; bare 50 % kan regnes med','lavere groundspeed ved samme fart gjennom luften'],['Medvind','mye lengre; 150 % må regnes med','høyere groundspeed'],['Oppoverbakke','lengre start, kortere stopp','tyngdekraften virker mot deg, så for deg'],['Våt, kontaminert','lengre stopp (lavere V1); motstand fra belegget under startløpet','mindre friksjon'],['Mer klaff','kortere bane, dårligere stigning','lavere farter, mer motstand']])+Pp('Varmt og høyt sammen, <b>WAT</b>-effekten (weight, altitude, temperature), senker alle grensene samtidig.'))],
 ['segments',t2('The take-off flight path','Startbanen i luften'),t2('Segments, gross and net, obstacles','Segmenter, brutto og netto, hindre'),t2(
   TB(['Segment (one engine out)','Configuration','Min. gross gradient 2 / 3 / 4 engines'],[['1st','gear down, take-off flap, VLOF → V2','> 0 % / 0.3 % / 0.5 %'],['2nd','gear up, take-off flap, V2, take-off thrust','2.4 % / 2.7 % / 3.0 %'],['3rd','level acceleration, flaps up','(acceleration height at least 400 ft)'],['Final','clean, max continuous thrust','1.2 % / 1.5 % / 1.7 %']])+Pp('The take-off path ends at 1 500 ft above the runway (or when the aircraft is clean, whichever is higher). The <b>net</b> path is the gross path reduced by <b>0.8 / 0.9 / 1.0 %</b> for 2 / 3 / 4 engines; it must clear obstacles by <b>35 ft</b> vertically (50 ft when banked more than 15°). Laterally, the obstacles that count lie within 90 m + 0.125 D of the track (½ wingspan + 60 m + 0.125 D below 60 m span), up to a maximum width set by the navigation accuracy. The segment-2 limit is the <b>climb limit</b>; it does not depend on the runway at all.')+Pp('<b>Class B</b> aeroplanes have no engine-out segments of this kind. For a light single the AFM climb at Vx and Vy and the obstacle picture are what you have.'),
   TB(['Segment (én motor ute)','Konfigurasjon','Min. bruttogradient 2 / 3 / 4 motorer'],[['1.','understell ute, startklaff, VLOF → V2','> 0 % / 0,3 % / 0,5 %'],['2.','understell inne, startklaff, V2, startskyvekraft','2,4 % / 2,7 % / 3,0 %'],['3.','akselerasjon i nivå, klaff inn','(akselerasjonshøyde minst 400 ft)'],['Siste','rent fly, maks kontinuerlig skyvekraft','1,2 % / 1,5 % / 1,7 %']])+Pp('Startbanen slutter 1 500 ft over banen (eller når flyet er rent, det som er høyest). <b>Nettobanen</b> er bruttobanen redusert med <b>0,8 / 0,9 / 1,0 %</b> for 2 / 3 / 4 motorer; den må klare hindre med <b>35 ft</b> vertikalt (50 ft ved mer enn 15° krengning). Sideveis teller hindre innenfor 90 m + 0,125 D fra kursen (½ vingespenn + 60 m + 0,125 D under 60 m spenn), opp til en største bredde satt av navigasjonsnøyaktigheten. Grensen i segment 2 er <b>stigegrensen</b>; den avhenger ikke av banen i det hele tatt.')+Pp('<b>Klasse B</b>-fly har ingen slike segmenter med én motor ute. For et lett enmotors fly er stigningen ved Vx og Vy fra flyhåndboken og hinderbildet det du har.'))],
 ['limits',t2('What limits the take-off mass','Hva som begrenser startmassen'),t2('The lowest of several limits','Den laveste av flere grenser'),t2(
   Pp('The maximum take-off mass today is the <b>lowest</b> of: <b>field length</b> (a V1 must exist that makes go and stop fit, and 115 % of the all-engines distance must fit), <b>climb</b> (2nd segment 2.4 % for a twin), <b>obstacle</b> (net path + 35 ft), <b>tyre speed</b> (groundspeed at lift-off, typically 195–225 mph rated tyres on jets), <b>brake energy</b> (VMBE), and the <b>structural</b> maximum. The landing mass at the destination (structural or performance) can limit it too. Deep dive shows the limits for today under Advanced.'),
   Pp('Største startmasse i dag er den <b>laveste</b> av: <b>banelengde</b> (det må finnes en V1 som får fortsett og stopp til å passe, og 115 % av distansen med alle motorer må passe), <b>stigning</b> (2. segment 2,4 % for tomotors), <b>hinder</b> (nettobane + 35 ft), <b>dekkfart</b> (groundspeed ved avløft, typisk dekk for 195–225 mph på jetfly), <b>bremseenergi</b> (VMBE) og den <b>strukturelle</b> maksimummassen. Landingsmassen på destinasjonen (strukturell eller ytelse) kan også begrense. Dypdykk viser dagens grenser under Avansert.'))],
 ['flex',t2('Flat rating and reduced thrust','Flat rating og redusert skyvekraft'),t2('Assumed temperature, derate','Antatt temperatur, derate'),t2(
   Pp('Turbine engines are <b>flat rated</b>: they give the same take-off thrust up to a corner temperature (about ISA + 15 °C here); above it thrust falls because the turbine gets too hot.')+Pp('<b>Assumed temperature</b> (flex): when the actual mass is below the limit, the crew enters a higher temperature and the engines give the thrust for that temperature. The speeds come from that hotter day, but the real air is colder and denser, so the real margins are larger. The reduction is at most <b>25 %</b> of full thrust; it is not allowed on contaminated runways; full thrust (TOGA) can always be selected. <b>Derate</b> is a certified lower rating with its own data and its own (lower) VMC; there you may not simply push to full thrust at low speed.'),
   Pp('Turbinmotorer er <b>flat rated</b>: de gir samme startskyvekraft opp til en knekktemperatur (rundt ISA + 15 °C her); over den faller skyvekraften fordi turbinen blir for varm.')+Pp('<b>Antatt temperatur</b> (flex): når den faktiske massen er under grensen, legger besetningen inn en høyere temperatur, og motorene gir skyvekraften for den temperaturen. Fartene kommer fra den varmere dagen, men den virkelige luften er kaldere og tettere, så de virkelige marginene er større. Reduksjonen er høyst <b>25 %</b> av full skyvekraft; den er ikke tillatt på kontaminert bane; full skyvekraft (TOGA) kan alltid velges. <b>Derate</b> er en sertifisert lavere rating med egne data og egen (lavere) VMC; der kan du ikke bare skyve til full skyvekraft i lav fart.'))],
 ['classes',t2('Performance classes A, B and C','Ytelsesklasse A, B og C'),t2('Who gets which rules','Hvem som får hvilke regler'),t2(
   TB(['Class','Aeroplanes','Take-off','Landing (dry)'],[['A','multi-engine turboprops with more than 9 seats or above 5 700 kg, and all multi-engine jets','V1, go and stop, net flight path','÷ 0.6 jet, ÷ 0.7 turboprop'],['B','propeller aeroplanes with at most 9 seats and 5 700 kg','TOD × 1.25 ≤ TORA (with stopway/clearway: × 1.15 ≤ TODA, × 1.3 ≤ ASDA); dry grass × 1.2, wet grass × 1.3; + 5 % per 1 % upslope','÷ 0.7 (× 1.43); wet × 1.15, grass × 1.15, + 5 % per 1 % downslope'],['C','piston aeroplanes with more than 9 seats or above 5 700 kg','own rules, between A and B','÷ 0.7']])+Pp('These are the Part-CAT rules for commercial flights. A private flight in a light aircraft (Part-NCO) has no fixed factors, but the same margins are good airmanship.'),
   TB(['Klasse','Fly','Start','Landing (tørr)'],[['A','flermotors turbopropfly med mer enn 9 seter eller over 5 700 kg, og alle flermotors jetfly','V1, fortsett og stopp, nettobane','÷ 0,6 jet, ÷ 0,7 turboprop'],['B','propellfly med høyst 9 seter og 5 700 kg','TOD × 1,25 ≤ TORA (med stoppflate/klarflate: × 1,15 ≤ TODA, × 1,3 ≤ ASDA); tørt gress × 1,2, vått gress × 1,3; + 5 % per 1 % oppoverbakke','÷ 0,7 (× 1,43); våt × 1,15, gress × 1,15, + 5 % per 1 % nedoverbakke'],['C','stempelfly med mer enn 9 seter eller over 5 700 kg','egne regler, mellom A og B','÷ 0,7']])+Pp('Dette er Part-CAT-reglene for kommersielle flyginger. En privat flyging med småfly (Part-NCO) har ingen faste faktorer, men de samme marginene er godt flygeskikk.'))],
 ['landing',t2('Landing rules','Landingsregler'),t2('Dispatch, before landing, go-around','Planlegging, før landing, avbrutt landing'),t2(
   Pp('<b>At dispatch</b> (Class A): the certified distance from 50 ft to a stop (dry, max manual braking, no reverse) must fit within <b>60 %</b> of the LDA for a jet and <b>70 %</b> for a turboprop. <b>Wet</b>: 115 % of that. <b>Contaminated</b>: the wet figure or 115 % of the distance with the contaminant data, whichever is greater.')+Pp('<b>Before landing</b>: the crew checks the distance for the conditions at the time of arrival (runway condition code, wind, braking, reverse) with a margin of usually <b>15 %</b>.')+Pp('<b>Go-around</b> (CS-25): approach climb with one engine out, approach flap, at least <b>2.1 %</b> (twin); landing climb with all engines, landing flap and gear down, at least <b>3.2 %</b>. On a hot, high day these can limit the landing mass.')+TB(['RWYCC','Typical surface','Braking'],[['6','dry','—'],['5','wet (up to 3 mm water), frost','good'],['4','compacted snow at −15 °C or colder','good to medium'],['3','wet ("slippery wet"), compacted snow above −15 °C, dry or wet snow over compacted snow','medium'],['2','standing water or slush more than 3 mm','medium to poor'],['1','ice','poor'],['0','wet ice, water on compacted snow','less than poor (no operation)']]),
   Pp('<b>Ved planlegging</b> (klasse A): den sertifiserte distansen fra 50 ft til stopp (tørr, maks manuell bremsing, uten reversering) må få plass innenfor <b>60 %</b> av LDA for jet og <b>70 %</b> for turboprop. <b>Våt</b>: 115 % av det. <b>Kontaminert</b>: våttallet eller 115 % av distansen med data for belegget, det som er størst.')+Pp('<b>Før landing</b>: besetningen sjekker distansen for forholdene ved ankomst (runway condition code, vind, bremsing, reversering) med en margin på vanligvis <b>15 %</b>.')+Pp('<b>Avbrutt landing</b> (CS-25): innflygingsstigning med én motor ute og innflygingsklaff minst <b>2,1 %</b> (tomotors); landingsstigning med alle motorer, landingsklaff og understell ute minst <b>3,2 %</b>. En varm dag høyt oppe kan disse begrense landingsmassen.')+TB(['RWYCC','Typisk overflate','Bremsing'],[['6','tørr','—'],['5','våt (opptil 3 mm vann), rim','god'],['4','pakket snø ved −15 °C eller kaldere','god til middels'],['3','våt («slippery wet»), pakket snø over −15 °C, tørr eller våt snø over pakket snø','middels'],['2','stående vann eller sludd over 3 mm','middels til dårlig'],['1','is','dårlig'],['0','våt is, vann på pakket snø','under dårlig (ingen operasjon)']]))],
 ['ops',t2('In the aircraft','I flyet'),t2('How the numbers reach the cockpit','Hvordan tallene kommer til cockpit'),t2(
   Pp('<b>Take-off data</b> come from the performance application (usually on the EFB) for the runway or intersection, wind, temperature, QNH, runway condition and configuration. Both pilots compute or cross-check independently and do a gross error check before entering V1, VR, V2 and the assumed temperature in the FMS.')+Pp('<b>The V1 call</b>: at low speed the take-off is rejected for any significant failure; at high speed only for major ones (engine failure, fire, the aircraft unsafe to fly). At V1 the hand comes off the thrust levers: the decision is go. Most high-speed reject accidents started above V1.')+Pp('<b>Noise abatement</b>: NADP 1 keeps take-off flap and climbs steeply to 3 000 ft (quieter close in); NADP 2 accelerates and retracts flap from 800 ft (quieter further out, saves fuel). Neither overrides the obstacle and engine-failure requirements.'),
   Pp('<b>Startdata</b> kommer fra ytelsesprogrammet (vanligvis på EFB) for banen eller avkjøringen, vind, temperatur, QNH, baneforhold og konfigurasjon. Begge piloter beregner eller kryssjekker uavhengig og gjør en grov feilsjekk før V1, VR, V2 og antatt temperatur legges inn i FMS.')+Pp('<b>V1-utropet</b>: i lav fart avbrytes starten for enhver vesentlig feil; i høy fart bare for alvorlige (motorstans, brann, flyet uflygbart). Ved V1 tas hånden av gasshendlene: beslutningen er fortsett. De fleste ulykker med avbrudd i høy fart startet over V1.')+Pp('<b>Støydemping</b>: NADP 1 beholder startklaff og stiger bratt til 3 000 ft (stillere nær flyplassen); NADP 2 akselererer og tar inn klaff fra 800 ft (stillere lenger ute, sparer drivstoff). Ingen av dem overstyrer kravene til hinderklaring og motorstans.'))]];
function drawDD(){ const open=[...document.querySelectorAll('#ddList details[open]')].map(d=>d.id);
  el('ddList').innerHTML=DD().map(([id,t,s,b])=>`<details class="dfold" id="dd-${id}"><summary>${L(t)} <small>${L(s)}</small></summary><div>${L(b)}</div></details>`).join('');
  open.forEach(i=>{ const d=el(i); if(d) d.open=true; }); }

/* ---------------- Test yourself ---------------- */
function drawTake(){ const TK=[
  t2('<b>TORA</b> to roll, <b>ASDA</b> = TORA + stopway to stop, <b>TODA</b> = TORA + clearway to reach 35 ft.','<b>TORA</b> for å rulle, <b>ASDA</b> = TORA + stoppflate for å stoppe, <b>TODA</b> = TORA + klarflate for å nå 35 ft.'),
  t2('<b>Below V1, stop; at or above V1, go.</b> A higher V1 needs more runway to stop and less to go.','<b>Under V1, stopp; ved eller over V1, fortsett.</b> Høyere V1 krever mer bane for å stoppe og mindre for å fortsette.'),
  t2('<b>VMCG ≤ V1 ≤ VR</b>, and V1 ≤ VMBE.','<b>VMCG ≤ V1 ≤ VR</b>, og V1 ≤ VMBE.'),
  t2('<b>Heavy, hot, high, tailwind, uphill and wet</b> all make the take-off longer.','<b>Tung, varmt, høyt, medvind, oppoverbakke og vått</b> gjør alle starten lengre.'),
  t2('<b>Wind:</b> count 50 % of a headwind and 150 % of a tailwind.','<b>Vind:</b> regn med 50 % av motvind og 150 % av medvind.'),
  t2('<b>Climb-out:</b> the net path (gross − 0.8 % for a twin) clears obstacles by 35 ft; 2nd segment at least 2.4 %.','<b>Utflyging:</b> nettobanen (brutto − 0,8 % for tomotors) klarer hindre med 35 ft; 2. segment minst 2,4 %.'),
  t2('<b>Landing at dispatch:</b> certified distance ÷ 0.6 (jet) or ÷ 0.7 (props); wet + 15 %. VREF ≥ 1.23 VSR0.','<b>Landing ved planlegging:</b> sertifisert distanse ÷ 0,6 (jet) eller ÷ 0,7 (propell); våt + 15 %. VREF ≥ 1,23 VSR0.'),
  t2('<b>Class B</b> (light singles and twins): no V1; the take-off distance × 1.25 must fit the TORA.','<b>Klasse B</b> (lette en- og tomotors): ingen V1; startdistansen × 1,25 må få plass på TORA.')];
  el('take').innerHTML=TK.map(x=>`<li>${L(x)}</li>`).join('');
  const m=el('maid'); m.querySelector('.k').textContent=L(t2('Memory aid','Huskeregel'));
  m.querySelector('b').textContent=L(t2('Half the headwind, one and a half the tailwind','Halve motvinden, halvannen medvind'));
  m.querySelector('p').textContent=L(t2('Performance is planned pessimistically: you may count only half of a reported headwind, and you must count one and a half times a reported tailwind. Wind changes; the margin covers it.','Ytelse planlegges pessimistisk: du kan bare regne med halve rapporterte motvind, og du må regne med halvannen gang rapportert medvind. Vinden endrer seg; marginen dekker det.')); }

LAB.quiz(el('qbox'),'perf',()=>LAB.shuffle([
 {q:t2('What is the ASDA?','Hva er ASDA?'),a:[t2('TORA plus stopway','TORA pluss stoppflate'),t2('TORA plus clearway','TORA pluss klarflate'),t2('The landing distance available','Tilgjengelig landingsdistanse'),t2('The runway minus the threshold','Banen minus terskelen')],c:0,e:t2('Accelerate-stop distance available: the runway plus any stopway, a surface able to carry the aircraft while it brakes.','Tilgjengelig akselerer-stopp-distanse: banen pluss eventuell stoppflate, en flate som kan bære flyet mens det bremser.')},
 {q:t2('An engine fails 5 kt below V1. What do you do?','En motor stanser 5 kt under V1. Hva gjør du?'),a:[t2('Reject the take-off','Avbryt starten'),t2('Continue','Fortsett'),t2('Continue if the runway is long','Fortsett hvis banen er lang'),t2('Wait until VR, then decide','Vent til VR, og bestem deg da')],c:0,e:t2('Below V1 the stop is guaranteed to fit in the ASDA; the go is not.','Under V1 er stoppet garantert å få plass i ASDA; fortsettelsen er ikke det.')},
 {q:t2('Which is correct for V1?','Hva er riktig for V1?'),a:[t2('VMCG ≤ V1 ≤ VR','VMCG ≤ V1 ≤ VR'),t2('V1 ≥ V2','V1 ≥ V2'),t2('V1 ≤ VMCG','V1 ≤ VMCG'),t2('V1 = 1.13 VSR','V1 = 1,13 VSR')],c:0,e:t2('Below VMCG you could not keep the aircraft on the runway after a failure; V1 cannot exceed VR. It must also not exceed VMBE.','Under VMCG kunne du ikke holdt flyet på banen etter en stans; V1 kan ikke være over VR. Den kan heller ikke være over VMBE.')},
 {q:t2('A 20 kt headwind is reported. What may the take-off calculation use?','Det rapporteres 20 kt motvind. Hva kan startberegningen bruke?'),a:[t2('10 kt','10 kt'),t2('20 kt','20 kt'),t2('30 kt','30 kt'),t2('0 kt','0 kt')],c:0,e:t2('Not more than 50 % of a headwind (and not less than 150 % of a tailwind).','Ikke mer enn 50 % av motvind (og ikke mindre enn 150 % av medvind).')},
 {q:t2('A higher V1 (same mass and runway) gives…','Høyere V1 (samme masse og bane) gir…'),a:[t2('a longer accelerate-stop and a shorter accelerate-go distance','lengre akselerer-stopp og kortere akselerer-fortsett-distanse'),t2('both shorter','begge kortere'),t2('both longer','begge lengre'),t2('a shorter stop and a longer go','kortere stopp og lengre fortsettelse')],c:0,e:t2('You accelerate further before stopping, and you have more speed when continuing on one engine.','Du akselererer lenger før du stopper, og har mer fart når du fortsetter på én motor.')},
 {q:t2('The net take-off flight path of a twin is the gross path…','Nettobanen etter avgang for et tomotors fly er bruttobanen…'),a:[t2('minus 0.8 % gradient','minus 0,8 % gradient'),t2('plus 0.8 %','pluss 0,8 %'),t2('minus 35 ft','minus 35 ft'),t2('times 1.15','ganger 1,15')],c:0,e:t2('0.8 % for two engines (0.9 and 1.0 % for three and four). The net path must clear obstacles by 35 ft.','0,8 % for to motorer (0,9 og 1,0 % for tre og fire). Nettobanen må klare hindre med 35 ft.')},
 {q:t2('Minimum gross gradient in the second segment for a twin, one engine out?','Minste bruttogradient i andre segment for tomotors, én motor ute?'),a:[t2('2.4 %','2,4 %'),t2('1.2 %','1,2 %'),t2('3.2 %','3,2 %'),t2('0 %','0 %')],c:0,e:t2('2.4 % (2.7 % three engines, 3.0 % four). 1.2 % is the final segment; 3.2 % is the all-engines landing climb.','2,4 % (2,7 % tre motorer, 3,0 % fire). 1,2 % er siste segment; 3,2 % er landingsstigning med alle motorer.')},
 {q:t2('Jet, dry runway: the certified landing distance must fit within what part of the LDA?','Jet, tørr bane: den sertifiserte landingsdistansen må få plass innenfor hvilken del av LDA?'),a:[t2('60 %','60 %'),t2('70 %','70 %'),t2('85 %','85 %'),t2('100 %','100 %')],c:0,e:t2('60 % for jets (a factor of 1.67), 70 % for turboprops and Class B (1.43). Wet: a further 15 %.','60 % for jet (faktor 1,67), 70 % for turboprop og klasse B (1,43). Våt: 15 % til.')},
 {q:t2('VREF for a Class A aeroplane is at least…','VREF for et klasse A-fly er minst…'),a:[t2('1.23 VSR0','1,23 VSR0'),t2('1.13 VSR','1,13 VSR'),t2('1.3 VMCA','1,3 VMCA'),t2('V2 + 10 kt','V2 + 10 kt')],c:0,e:t2('1.23 × the reference stall speed in landing configuration (and not below VMCL). Light Class B aeroplanes traditionally use 1.3 VS0.','1,23 × referansestallfarten i landingskonfigurasjon (og ikke under VMCL). Lette klasse B-fly bruker tradisjonelt 1,3 VS0.')},
 {q:t2('Class B take-off on a dry grass strip, no stopway or clearway. The flight manual distance is multiplied by…','Klasse B-start fra tørr gressbane, uten stoppflate eller klarflate. Distansen fra flyhåndboken ganges med…'),a:[t2('1.25 × 1.2 = 1.5','1,25 × 1,2 = 1,5'),t2('1.2 only','bare 1,2'),t2('1.15','1,15'),t2('1.67','1,67')],c:0,e:t2('The Class B margin of 1.25 against the TORA, times 1.2 for dry grass (1.3 wet grass), and + 5 % per 1 % upslope.','Klasse B-marginen på 1,25 mot TORA, ganger 1,2 for tørt gress (1,3 vått gress), og + 5 % per 1 % oppoverbakke.')},
 {q:t2('Why is reduced thrust (assumed temperature) conservative?','Hvorfor er redusert skyvekraft (antatt temperatur) konservativt?'),a:[t2('The real air is colder and denser than assumed, so real speeds are lower and margins larger','Den virkelige luften er kaldere og tettere enn antatt, så virkelige farter er lavere og marginene større'),t2('Because V1 is raised','Fordi V1 heves'),t2('Because the runway is longer','Fordi banen er lengre'),t2('It is not; it removes margins','Det er det ikke; det fjerner marginer')],c:0,e:t2('The calculation assumes a hotter day than the real one. And full thrust is always available.','Beregningen antar en varmere dag enn den virkelige. Og full skyvekraft er alltid tilgjengelig.')}
]),10);

/* ---------------- static strings, text, start ---------------- */
LAB.add({},{'Take-off and landing performance':'Start- og landingsytelse','Birdbird Virtual Labs · Performance':'Birdbird Virtual Labs · Ytelse',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Test yourself':'3 · Test deg selv','Key concepts':'Nøkkelbegreper','Deep dive':'Dypdykk','The runway lab':'Rullebanelabben','Try it':'Prøv selv','Key points':'Det viktigste','Test yourself':'Test deg selv',
 'Controls':'Kontroller','Aircraft':'Fly','Take-off':'Start','Obstacle':'Hinder','Landing':'Landing','Conditions':'Forhold','Runway':'Rullebane','Scenarios':'Scenarier','Advanced':'Avansert','Use the balanced V1':'Bruk balansert V1','Flaps':'Klaff','Runway surface':'Banedekke','Mode':'Modus','Sections':'Seksjoner',
 'The runway seen from above with the declared distances, the take-off and stopping distances and the V1 window; in the other modes the climb after take-off from the side and the landing distance.':'Rullebanen sett ovenfra med de oppgitte distansene, start- og stoppdistansene og V1-vinduet; i de andre modusene stigningen etter avløft fra siden og landingsdistansen.'});
LAB.tx({lead:'Hvor mye bane trenger dagens start, og hva skjer hvis en motor stanser halvveis? Se banen slik reglene ser den, finn V1 som lar deg enten stoppe eller fortsette, klar hindrene etter avløft, og land med marginene loven krever. For et lett enmotors fly, et turbopropfly og et jetfly.'});
function texts(){
  el('kin').textContent=L(t2('Six ideas carry take-off and landing performance. “Show in the model” sets the lab up so you can see it.','Seks ideer bærer start- og landingsytelse. «Vis i modellen» setter opp labben så du kan se det.'));
  el('xLead').textContent=L(t2('Pick the aircraft on the left and a mode above the picture. Change the mass, the weather and the runway, and watch whether the take-off and the landing still fit.','Velg fly til venstre og modus over bildet. Endre massen, været og banen, og se om starten og landingen fortsatt får plass.'));
  el('tryLead').textContent=L(t2('Work it out first, then check. "Set it up in the model" shows you why.','Regn det ut først, og sjekk. «Sett det opp i modellen» viser deg hvorfor.'));
  el('revL').textContent=L(t2('Reverse thrust (in-flight check)','Reversering (sjekk i luften)'));
  el('foot').innerHTML=L(t2('<b>Model and limitations.</b> Teaching model, not for flight. Three generic aircraft with typical, rounded values (light single ≈ 1 100 kg, turboprop twin ≈ 23 t, jet twin ≈ 78 t); none of the numbers are AFM or FCOM data. The ground run is integrated in time with simplified thrust (flat rated turbines, piston power with density), drag, rolling and braking friction, slope and factored wind; rotation is not modelled separately; the airborne part uses an energy method. Wet and contaminated runways are modelled only through braking friction and reverse credit (no contaminant drag). The climb-out uses a fixed 1 000 ft (jet) or 800 ft acceleration height. Regulatory factors follow CS-25 and EASA Part-CAT (CAT.POL.A) in simplified form. Always use the AFM, the operator’s performance data and your instructor.','<b>Modell og begrensninger.</b> Undervisningsmodell, ikke for flyging. Tre generiske fly med typiske, avrundede verdier (lett enmotors ≈ 1 100 kg, turboprop tomotors ≈ 23 t, jet tomotors ≈ 78 t); ingen av tallene er AFM- eller FCOM-data. Startløpet integreres i tid med forenklet skyvekraft (flat rated turbiner, stempeleffekt med tetthet), motstand, rulle- og bremsefriksjon, helning og faktorisert vind; rotasjonen er ikke modellert for seg; luftdelen bruker en energimetode. Våt og kontaminert bane er bare modellert gjennom bremsefriksjon og kreditt for reversering (ingen motstand fra belegget). Utflygingen bruker fast akselerasjonshøyde 1 000 ft (jet) eller 800 ft. Regelverksfaktorene følger CS-25 og EASA Part-CAT (CAT.POL.A) i forenklet form. Bruk alltid AFM, operatørens ytelsesdata og instruktøren din.'));
  el('ddH').textContent=L(t2('Deep dive','Dypdykk')); }
function all(){ texts(); drawTabs(); drawPre(); drawTask(); drawDD(); drawTake(); upd(); }
LAB.onLang(all);
document.addEventListener('labdepth',all);
LAB.start('perf');
buildCtl(); setMode('to'); all();
/* Reset (the shell's button in the viewport bar): starting values, same mode */
const keepS=LAB.keep(S);
LAB.reset(()=>{ const m=S.mode; keepS(); el('revChk').checked=S.rev; setType(S.type); setMode(m); all(); });
/* old anchors */
const HM={'#takeoff':'to','#landing':'land','#climbout':'climb'}, HD={'#limits':'dd-limits','#ops':'dd-ops','#dd-speeds':'dd-speeds','#dd-segments':'dd-segments','#dd-flex':'dd-flex','#dd-classes':'dd-classes','#dd-landing':'dd-landing','#dd-v1':'dd-v1','#dd-factors':'dd-factors','#dd-limits':'dd-limits','#dd-ops':'dd-ops'};
if(HM[location.hash]){ setMode(HM[location.hash]); requestAnimationFrame(()=>el('pfVp').scrollIntoView({block:'start'})); }
if(HD[location.hash]){ if(depth()==='short') LAB.setDepth('deep'); requestAnimationFrame(()=>{ const d=el(HD[location.hash]); if(d){ d.open=true; d.scrollIntoView({block:'center'}); } }); }
})();
