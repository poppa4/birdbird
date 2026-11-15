/* Birdbird – forecast winds aloft in the browser (window.BBWIND). Loads 5° tiles from /api/winds (NOAA GFS 0.25°,
   12 pressure levels) and interpolates: bilinear between grid points, linear in height between levels.
   Heights are the model's geopotential heights (≈ altitude AMSL). Planning practice only: check the official forecast. */
(function(){
  'use strict';
  const TILE=5, H=3600e3;
  const T={}; // key 'la,lo|time' → {d:tile}|{err}|{p:Promise}
  const tileOf=(la,lo)=>[Math.floor(la/TILE)*TILE,Math.floor(lo/TILE)*TILE];
  const hourIso=t=>new Date(Math.round(new Date(t).getTime()/H)*H).toISOString();
  /* 5° tiles touched by a set of points (and the segments between them, sampled every ~0.2°) */
  function tilesFor(pts){ const S=new Set(); const add=(la,lo)=>{ if(la<-90||la>=85) return; let [a,b]=tileOf(la,((lo+180)%360+360)%360-180); S.add(a+','+b); };
    for(let i=0;i<pts.length;i++){ const p=pts[i]; add(p.la,p.lo); const q=pts[i+1]; if(!q) continue; const n=Math.ceil(Math.max(Math.abs(q.la-p.la),Math.abs(q.lo-p.lo))/0.2);
      for(let k=1;k<n;k++) add(p.la+(q.la-p.la)*k/n,p.lo+(q.lo-p.lo)*k/n); }
    return [...S]; }
  async function get(tile,time){ const k=tile+'|'+time; const c=T[k]; if(c&&(c.d||c.p)) return c.p||c;
    const p=(async()=>{ try{ const r=await fetch('/api/winds?tile='+tile+'&t='+encodeURIComponent(time),{headers:{accept:'application/json'}}); const j=await r.json(); if(!j||!j.ok) throw new Error((j&&j.message)||'winds'); T[k]={d:j}; return T[k]; }
      catch(e){ T[k]={err:String(e.message||e)}; return T[k]; } })();
    T[k]={p}; return p; }
  /* load tiles (4 at a time); resolves to {ok, fail, run, valid} */
  async function load(tiles,time){ time=hourIso(time); const q=tiles.slice(); let ok=0, fail=0, meta=null, msg='';
    async function worker(){ while(q.length){ const t=q.shift(); const r=await get(t,time); if(r.d){ ok++; meta=meta||r.d; } else { fail++; msg=r.err||msg; } } }
    await Promise.all([worker(),worker(),worker(),worker()]); return {ok,fail,msg,time,run:meta&&meta.run,valid:meta&&meta.valid,model:meta&&meta.model}; }
  function tileAt(la,lo,time){ const [a,b]=tileOf(la,lo); const c=T[a+','+b+'|'+hourIso(time)]; return c&&c.d; }
  /* all levels at a point: [{hpa,u,v,t,z}] (null where missing) */
  function column(la,lo,time){ const d=tileAt(la,lo,time); if(!d) return null;
    const fx=(lo-d.lo0)/d.d, fy=(d.la0-la)/d.d; const i0=Math.max(0,Math.min(d.nx-2,Math.floor(fx))), j0=Math.max(0,Math.min(d.ny-2,Math.floor(fy))); const ax=Math.min(1,Math.max(0,fx-i0)), ay=Math.min(1,Math.max(0,fy-j0));
    const bi=a=>{ if(!a) return null; const g=(i,j)=>a[j*d.nx+i]; return (g(i0,j0)*(1-ax)+g(i0+1,j0)*ax)*(1-ay)+(g(i0,j0+1)*(1-ax)+g(i0+1,j0+1)*ax)*ay; };
    return d.lev.map((h,k)=>({hpa:h,u:bi(d.u[k]),v:bi(d.v[k]),t:bi(d.t[k]),z:bi(d.z[k]),r:d.r&&d.r[k]?bi(d.r[k]):null})).filter(x=>x.u!=null&&x.v!=null&&x.t!=null&&x.z!=null).sort((a,b)=>a.z-b.z); }
  /* model cloud and icing indication for one level: cloud 2 = likely (RH ≥ 95 %), 1 = possible (85–95 %);
     ice 2 = likely cloud between −2 and −12 °C, 1 = cloud between 0 and −20 °C. A crude guide from GFS humidity, not a forecast product. */
  function wxOf(x){ if(!x||x.r==null) return {cloud:0,ice:0}; const cloud=x.r>=95?2:x.r>=85?1:0; let ice=0;
    if(cloud&&x.t<=0&&x.t>=-20) ice=(cloud===2&&x.t<=-2&&x.t>=-12)?2:1; return {cloud,ice}; }
  /* Clear-air turbulence guide: Ellrod TI1 = vertical wind shear × horizontal deformation (×10⁻⁷ s⁻²), per layer between
     two model levels, at the nearest grid point (centred differences). TI1 ≥ 4 light–moderate, ≥ 8 moderate, ≥ 12 severe.
     Ellrod & Knapp (1992). A model index, not a turbulence forecast. → [{zlo,zhi,ti,cat}] sorted by height */
  function turb(la,lo,time){ const d=tileAt(la,lo,time); if(!d||!d.u||!d.z) return null;
    const i=Math.max(1,Math.min(d.nx-2,Math.round((lo-d.lo0)/d.d))), j=Math.max(1,Math.min(d.ny-2,Math.round((d.la0-la)/d.d)));
    const latp=d.la0-j*d.d, dx=d.d*111320*Math.cos(latp*Math.PI/180), dy=d.d*110540, K=1/1.9438445, n=k=>j*d.nx+i;
    const at=(a,ii,jj)=>a[jj*d.nx+ii]*K;
    const L=d.lev.map((h,k)=>{ const U=d.u[k], V=d.v[k], Z=d.z[k]; if(!U||!V||!Z) return null;
      const dudx=(at(U,i+1,j)-at(U,i-1,j))/(2*dx), dvdx=(at(V,i+1,j)-at(V,i-1,j))/(2*dx), dudy=(at(U,i,j-1)-at(U,i,j+1))/(2*dy), dvdy=(at(V,i,j-1)-at(V,i,j+1))/(2*dy); // j−1 is north
      return {z:Z[n()],u:U[n()]*K,v:V[n()]*K,def:Math.hypot(dudx-dvdy,dvdx+dudy)}; }).filter(Boolean).sort((a,b)=>a.z-b.z);
    const out=[]; for(let k=0;k<L.length-1;k++){ const a=L[k], b=L[k+1], dz=(b.z-a.z)*0.3048; if(dz<=0) continue;
      const vws=Math.hypot(b.u-a.u,b.v-a.v)/dz, ti=vws*(a.def+b.def)/2*1e7; out.push({zlo:a.z,zhi:b.z,ti:Math.round(ti*10)/10,cat:ti>=12?3:ti>=8?2:ti>=4?1:0}); }
    return out; }
  const dirOf=(u,v)=>{ const d=(Math.atan2(-u,-v)*180/Math.PI+360)%360; return Math.round(d)||360; };
  const isaT=ft=>15-1.98*ft/1000;
  /* wind/temperature at altitude (ft AMSL) */
  function at(la,lo,ft,time){ const c=column(la,lo,time); if(!c||!c.length) return null; let a=c[0], b=c[c.length-1];
    if(ft<=a.z) b=a; else if(ft>=b.z) a=b; else for(let k=0;k<c.length-1;k++) if(c[k].z<=ft&&c[k+1].z>=ft){ a=c[k]; b=c[k+1]; break; }
    const w=b.z===a.z?0:(ft-a.z)/(b.z-a.z), L=(x,y)=>x+(y-x)*w; const u=L(a.u,b.u), v=L(a.v,b.v), t=L(a.t,b.t);
    const r=a.r!=null&&b.r!=null?L(a.r,b.r):null, wx=wxOf({r,t});
    return {dir:dirOf(u,v),spd:Math.round(Math.hypot(u,v)),u,v,t:Math.round(t),isa:Math.round(t-isaT(ft)),r:r==null?null:Math.round(r),cloud:wx.cloud,ice:wx.ice,clamped:ft<c[0].z||ft>c[c.length-1].z}; }
  /* lowest 0 °C level (ft AMSL) above the ground (gnd ft): {ft} or {below:true} when it is freezing at the ground level */
  function freezing(la,lo,time,gnd){ const c=column(la,lo,time); if(!c) return null; const L=c.filter(x=>x.z>=(gnd||0)-500); if(!L.length) return null;
    if(L[0].t<=0) return {ft:Math.max(0,gnd||0),below:true};
    for(let k=0;k<L.length-1;k++) if(L[k].t>0&&L[k+1].t<=0){ const w=L[k].t/(L[k].t-L[k+1].t); return {ft:Math.round((L[k].z+(L[k+1].z-L[k].z)*w)/100)*100}; }
    return null; }
  /* standard pressure-level labels: ISA pressure altitude, rounded to the nearest flight level */
  const FL={1000:'FL001',925:'FL025',850:'FL050',800:'FL065',700:'FL100',600:'FL140',500:'FL180',400:'FL240',300:'FL300',250:'FL340',200:'FL390',150:'FL450'};
  const w3=(d,s)=>String(d).padStart(3,'0')+'/'+String(s).padStart(2,'0');
  window.BBWIND={tilesFor,load,column,at,freezing,wxOf,turb,FL,w3,dirOf,hourIso,tileAt};
})();
