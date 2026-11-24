/* NORDAP – forecast cloud layers at a point (window.BBCLOUD), for Route Explorer.
   Loads 5° tiles from /api/clouds (NOAA GFS 0.25°: low, middle and high cloud with base, top and cover, the ceiling, the
   freezing level and CAPE) and draws them as one column, ground to FL400, so "where are the layers?" has an answer between
   the airports. A forecast from a global model, not an observation: the panel says so and points to the METAR and TAF. */
(function(){
  'use strict';
  const TILE=5, H=3600e3, T={};
  const hourIso=t=>new Date(Math.round(new Date(t).getTime()/H)*H).toISOString();
  async function tile(la,lo,time){ const a=Math.floor(la/TILE)*TILE, b=Math.floor((((lo+180)%360+360)%360-180)/TILE)*TILE, k=a+','+b+'|'+time;
    if(!T[k]) T[k]=fetch('/api/clouds?tile='+a+','+b+'&t='+encodeURIComponent(time),{headers:{accept:'application/json'}}).then(r=>r.json()).then(j=>{ if(!j||!j.ok) throw new Error((j&&j.message)||'clouds'); return j; }).catch(e=>{ delete T[k]; throw e; });
    return T[k]; }
  /* the nearest grid point (0.25°, about 25 km): the model has no finer detail to offer */
  async function at(la,lo,time){ time=hourIso(time||Date.now()); const j=await tile(la,lo,time);
    let L=lo; if(L<j.lo0) L+=360; const i=Math.max(0,Math.min(j.nx-1,Math.round((L-j.lo0)/j.d))), r=Math.max(0,Math.min(j.ny-1,Math.round((j.la0-la)/j.d))), n=r*j.nx+i;
    const v=k=>j[k]?j[k][n]:null;
    const lay=(c,b,t,name)=>({name,c:v(c),b:v(b),t:v(t)});
    const low=lay('lc','lb','lt','low'), ceil=v('ceil');
    // the ceiling is the lowest BKN/OVC base right now; the layer base is an average: when the low layer is BKN/OVC, start it at the ceiling
    if(low.c!=null&&low.c>50&&ceil!=null&&low.b!=null&&ceil<low.b&&(low.t==null||ceil<low.t)) low.b=ceil;
    return { la:j.la0-r*j.d, lo:j.lo0+i*j.d, valid:j.valid, run:j.run, model:j.model,
      layers:[low,lay('mc','mb','mt','mid'),lay('hc','hb','ht','high')], tc:v('tc'), ceil, frz:v('frz'), sfc:v('sfc'), cape:v('cape') }; }

  const okta=c=>c==null||c<12?null:c<=25?['FEW','few','få']:c<=50?['SCT','scattered','spredt']:c<=87?['BKN','broken','brutt']:['OVC','overcast','overskyet'];
  const fmt=n=>n==null?'–':Math.round(n).toLocaleString('en-GB');
  const alt=n=>n==null?'–':n>=18000?'FL'+String(Math.round(n/1000)*10).padStart(3,'0'):fmt(Math.round(n/100)*100)+' ft';
  const TOP=40000, PAD=8, y=(h,H0)=>PAD+(H0-PAD)*(1-Math.sqrt(Math.max(0,Math.min(TOP,h))/TOP)); // square-root scale: room for the low cloud that matters most

  /* the column as SVG, and the words beside it. no: Norwegian? elev: aerodrome elevation (ft) when known */
  function html(d,no,elev){ const W=300, H0=230, X0=42, CW=92; const L=o=>no?o.no:o.en;
    const g=[], lab=[]; const sfc=elev!=null?elev:(d.sfc||0);
    // grid
    [1000,3000,5000,10000,20000,30000,40000].forEach(h=>{ const yy=y(h,H0); g.push(`<line x1="${X0}" x2="${X0+CW}" y1="${yy}" y2="${yy}" stroke="#E3E7EA" stroke-width="1"/><text x="${X0-4}" y="${yy+3.5}" text-anchor="end" font-size="9.5" fill="#6B7A86">${h>=20000?'FL'+h/100:fmt(h)}</text>`); });
    // layers
    const col={low:'#8A97A2',mid:'#A9B6C2',high:'#C9D4DE'};
    d.layers.forEach(l=>{ if(!okta(l.c)||l.b==null||l.t==null) return; const y1=y(l.t,H0), y2=y(Math.max(l.b,sfc),H0); const op=(0.25+0.65*Math.min(1,l.c/100)).toFixed(2);
      g.push(`<rect x="${X0+2}" y="${y1}" width="${CW-4}" height="${Math.max(2,y2-y1)}" rx="5" fill="${col[l.name]}" fill-opacity="${op}"/>`); });
    // freezing level, ceiling
    if(d.frz!=null){ const yy=y(d.frz,H0); g.push(`<line x1="${X0}" x2="${X0+CW}" y1="${yy}" y2="${yy}" stroke="#1D63B8" stroke-width="1.6" stroke-dasharray="5 3"/>`); lab.push([yy,'#1D63B8','0 °C '+alt(d.frz)]); }
    if(d.ceil!=null){ const yy=y(d.ceil,H0); g.push(`<line x1="${X0}" x2="${X0+CW}" y1="${yy}" y2="${yy}" stroke="#1F5A8F" stroke-width="1.8"/>`); lab.push([yy,'#1F5A8F',L({en:'Ceiling',no:'Skytak'})+' '+alt(d.ceil)]); }
    // ground
    const yg=y(sfc,H0); g.push(`<rect x="${X0}" y="${yg}" width="${CW}" height="${Math.max(3,H0-yg)}" fill="#B9A27A"/>`); lab.push([Math.min(H0-4,yg),'#7A6640',L({en:'Ground',no:'Bakken'})+' '+fmt(sfc)+' ft']);
    // labels on the right, pushed apart so they never overlap (bottom up)
    lab.sort((a,b)=>b[0]-a[0]); let last=1e9; lab.forEach(l=>{ const yy=Math.min(l[0],last-12); last=yy; g.push(`<text x="${X0+CW+6}" y="${yy+3.5}" font-size="10" fill="${l[1]}">${l[2]}</text>`); });
    const svg=`<svg viewBox="0 0 ${W} ${H0+4}" width="100%" role="img" aria-label="${L({en:'Forecast cloud layers from the ground to FL400',no:'Varslede skylag fra bakken til FL400'})}">${g.join('')}</svg>`;
    // words
    const rows=d.layers.map(l=>{ const o=okta(l.c); const nm=L({low:{en:'Low',no:'Lave'},mid:{en:'Middle',no:'Middels'},high:{en:'High',no:'Høye'}}[l.name]);
      if(!o) return `<div class="rw"><b>${nm}</b><span>${L({en:'none or little',no:'ingen eller lite'})}</span></div>`;
      return `<div class="rw"><b>${nm}</b><span>${o[0]} (${no?o[2]:o[1]}, ${l.c} %) · ${l.b!=null?alt(Math.max(l.b,sfc))+' – '+alt(l.t):''}</span></div>`; }).join('');
    const cape=d.cape||0, conv=cape>=1000?L({en:`Strong convection possible (CAPE ${fmt(cape)} J/kg): CB and TCU can build to high levels, with icing, turbulence and hail.`,no:`Kraftig konveksjon mulig (CAPE ${fmt(cape)} J/kg): CB og TCU kan bygge seg høyt, med ising, turbulens og hagl.`})
      :cape>=300?L({en:`Some convection possible (CAPE ${fmt(cape)} J/kg): showers and towering cumulus.`,no:`Noe konveksjon mulig (CAPE ${fmt(cape)} J/kg): byger og tårnende cumulus.`}):'';
    const icing=d.frz!=null&&d.layers.some(l=>okta(l.c)&&l.t!=null&&l.t>d.frz)?L({en:'Cloud above the freezing level: icing is likely in it.',no:'Skyer over frysenivået: ising er sannsynlig i dem.'}):'';
    const v=d.valid?new Date(d.valid):null, vt=v?String(v.getUTCHours()).padStart(2,'0')+'Z '+v.getUTCDate()+'.'+(v.getUTCMonth()+1)+'.':'';
    return `<div class="ccol">${svg}${rows}${d.ceil!=null?`<div class="rw"><b>${L({en:'Ceiling',no:'Skytak'})}</b><span>${alt(d.ceil)} ${L({en:'(lowest BKN/OVC base)',no:'(laveste BKN/OVC-base)'})}</span></div>`:''}${d.frz!=null?`<div class="rw"><b>${L({en:'Freezing level',no:'Frysenivå'})}</b><span>${alt(d.frz)}</span></div>`:''}
      ${conv?`<p class="cwarn">${conv}</p>`:''}${icing?`<p class="cwarn">${icing}</p>`:''}
      <p class="src">${L({en:`Forecast for ${vt} from NOAA's GFS model (about 25 km grid; heights rounded, middle and high layers as pressure altitude). It is not an observation: at an airport the METAR and TAF are the reference, and the official forecast (GAMET, significant weather chart) is what you plan with.`,no:`Prognose for ${vt} fra NOAAs GFS-modell (omtrent 25 km rutenett; høyder avrundet, middels og høye lag som trykkhøyde). Dette er ikke en observasjon: på en flyplass er METAR og TAF fasit, og den offisielle prognosen (GAMET, significant weather-kart) er det du planlegger etter.`})}</p></div>`; }

  window.BBCLOUD={at,html,hourIso};
})();
