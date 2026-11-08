/* Birdbird Route Explorer: the MapLibre chart (rxmap.js)
   Loaded by route.html. Builds a calm aeronautical chart from OpenFreeMap vector tiles,
   relief, contours and 3D from AWS Terrain Tiles, satellite from EOX Sentinel-2 cloudless 2016,
   topo from Kartverket and (with an API key) airspace from openAIP. If anything fails within
   the time limit, create() rejects and route.html keeps its own canvas map. */
(function(){
'use strict';
const STYLE_URL='https://tiles.openfreemap.org/styles/positron';
// AWS Terrain Tiles (terrarium): z/x/y
const DEM_URL='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
// EOX Sentinel-2 cloudless 2016 (WMTS REST: TileMatrix/TileRow/TileCol = z/y/x). Only the 2016 layer is CC BY 4.0.
const SAT_URL='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
// Kartverket topo (WMTS REST: TileMatrix/TileRow/TileCol = z/y/x)
const TOPO_URL='https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png';
/* openAIP airspace (vector tiles). Needs a free API key from openaip.net (My account → API clients).
   The key is sent with every tile request, so it is visible to anyone who opens the page: that is how
   openAIP keys are meant to be used in a browser. Leave it empty to hide the airspace layer.
   localStorage 'bb-openaip-key' overrides it in one browser (for testing); the value 'off' turns it off.
   Data licence: CC BY-NC 4.0 (openaip.net). Schema: openAIP/openaip-map-resources (source-layer "airspaces",
   fields type, icao_class, name, upper_/lower_limit_value, _unit, _reference_datum). */
const OPENAIP_KEY='9f22478d838e75c88512f7131a079bfa';
const OPENAIP_URL='https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.pbf?apiKey=';
const CONTOUR_JS='vendor/maplibre-contour/maplibre-contour.min.js?v=0.1.1';
const A=(h,t)=>`<a href="${h}" target="_blank" rel="noopener">${t}</a>`;
const ATT={
  ofm:A('https://openfreemap.org','OpenFreeMap')+' '+A('https://www.openmaptiles.org/','© OpenMapTiles')+' Data from '+A('https://www.openstreetmap.org/copyright','OpenStreetMap'),
  dem:'Terrain: '+A('https://github.com/tilezen/joerd/blob/master/docs/attribution.md','Mapzen/AWS Terrain Tiles (SRTM, GMTED, EU-DEM © Copernicus, ETOPO1)'),
  sat:'Imagery '+A('https://www.esri.com','© Esri')+', Maxar, Earthstar Geographics, and the GIS User Community',
  topo:A('https://www.kartverket.no/','© Kartverket'),
  nav:'Airports, navaids: '+A('https://ourairports.com/data/','OurAirports'),
  oaip:'Airspace: '+A('https://www.openaip.net','© openAIP')+' ('+A('https://creativecommons.org/licenses/by-nc/4.0/','CC BY-NC 4.0')+')'
};
// chart-room palette (site.css: --paper #EDF1EE, --sheet #FFF, --ink #13202A, --accent #9A1E68, --info #1D4E9E)
const P={land:'#F2EFE4',water:'#D3E2EC',coast:'#A3BACA',waterLine:'#B9CFDD',wood:'#E1E8D3',park:'#E4EAD8',ice:'#F8FAFB',resid:'#EAE5DA',bldg:'#E2DCD0',aero:'#E0DCD3',runway:'#C4BFB4',
  border:'#A4977F',state:'#CEC5B4',road:'#E4D9C8',roadMaj:'#DCCDB5',rail:'#D2CCC2',ink:'#13202A',ink2:'#4C5B66',ink3:'#6E7B84',halo:'rgba(246,244,238,.92)',waterLbl:'#557A93',peak:'#6B4A2B',
  accent:'#9A1E68',info:'#1D4E9E',ap:'#2C5F8D',vor:'#3C7A6B',ndb:'#8A6D3B',aip:'#7D93A3'};
const FONT_R=['Noto Sans Regular'], FONT_B=['Noto Sans Bold'], FONT_I=['Noto Sans Italic'];
// vfr = VFR chart (default): hypsometric tints, multidirectional hillshade, contours
// chart = plain chart, terrain = strong relief, ifr = low-ink chart, sat, topo
const BASEMAPS=['vfr','chart','terrain','ifr','sat','topo'];
const RELIEF_BM=['vfr','chart','terrain','ifr'];

// which basemap groups are visible (groups not listed are visible)
const VIS={
  vfr:    {wood:0,sat:0,topo:0},
  chart:  {sat:0,topo:0},
  terrain:{rail:0,sat:0,topo:0},
  ifr:    {wood:0,rail:0,bldg:0,roadlabel:0,sat:0,topo:0},
  sat:    {wood:0,ice:0,urban:0,aero:0,water:0,coast:0,road:0,rail:0,bldg:0,roadlabel:0,sat:1,topo:0},
  topo:   {road:0,rail:0,bldg:0,label:0,roadlabel:0,waterlabel:0,peak:0,sat:0,topo:1}
};
const URB=['residential','suburb','neighbourhood','commercial','industrial','retail'];
// paint that changes per basemap (only applied to layers whose type the property belongs to)
const BMP={
  vfr:{water:{'fill-color':'#C4DBEA','line-color':'#A2C3D9'},coast:{'line-color':'#7EA2BB'},
    urban:{'fill-color':'#EFD27E','fill-opacity':['match',['get','class'],URB,0.55,0]},ice:{'fill-opacity':0.5}},
  ifr:{bg:{'background-color':'#FAFAF7'},water:{'fill-color':'#E2EAEF','line-color':'#D3DEE5'},coast:{'line-color':'#B6C7D2'},
    urban:{'fill-color':'#ECEBE6','fill-opacity':['match',['get','class'],URB,0.6,0]},road:{'line-color':'#E9E5DE'},ice:{'fill-color':'#FCFCFB'},
    label:{'text-color':'#59656D'},waterlabel:{'text-color':'#7E97A8'},boundary:{'line-color':'#BDB5A6'}},
  sat:{label:{'text-color':'#FFFFFF','text-halo-color':'rgba(16,24,30,.82)','text-halo-width':1.4},
    waterlabel:{'text-color':'#E4EFF6','text-halo-color':'rgba(16,24,30,.8)','text-halo-width':1.2},
    peak:{'text-color':'#FFF4E0','text-halo-color':'rgba(16,24,30,.8)'},
    boundary:{'line-color':'rgba(255,255,255,.78)'}}
};
const lin=(z0,v0,z1,v1)=>['interpolate',['linear'],['zoom'],z0,v0,z1,v1];
const exp=(...s)=>['interpolate',['exponential',1.5],['zoom'],...s];

/* ---------- hypsometric tints (metres), SkyVector / ICAO VFR-chart style ----------
   Low green, pale yellow-green, tan, brown, grey and white on the highest ground.
   Spread over Norway's 0–2,469 m so lowland, valleys, fjells and the big massifs all read differently. */
const TINT_VFR=['interpolate',['linear'],['elevation'],
  -1,'rgba(0,0,0,0)', 0,'rgba(198,221,180,0)', 1,'rgb(198,221,180)',
  100,'rgb(207,226,183)', 250,'rgb(222,232,190)', 450,'rgb(238,236,198)', 650,'rgb(241,228,184)',
  850,'rgb(234,213,166)', 1050,'rgb(224,196,148)', 1300,'rgb(209,177,132)', 1550,'rgb(192,160,122)',
  1800,'rgb(178,155,133)', 2050,'rgb(196,186,176)', 2300,'rgb(226,222,217)', 2700,'rgb(246,245,242)', 5000,'rgb(255,255,255)'];
const TINT_TER=['interpolate',['linear'],['elevation'],
  -1,'rgba(0,0,0,0)',0,'rgba(205,221,190,0)',2,'rgba(205,221,190,1)',120,'rgb(214,226,192)',370,'rgb(228,229,196)',670,'rgb(234,224,188)',1000,'rgb(224,204,164)',1370,'rgb(204,180,146)',1770,'rgb(184,168,150)',2290,'rgb(214,210,204)',3050,'rgb(244,243,240)'];

/* ---------- restyle an OpenMapTiles-schema style (positron, liberty, bright) ---------- */
function restyle(L){
  const sl=L['source-layer']||'', t=L.type, id=L.id||'';
  const keep=(g,paint,layout)=>{ L.metadata=Object.assign({},L.metadata,{'bb:g':g}); if(paint) L.paint=paint; if(layout) L.layout=Object.assign({},L.layout||{},layout); return L; };
  if(t==='background') return keep('bg',{'background-color':P.land});
  if(t==='fill'){
    if(sl==='water') return keep('water',{'fill-color':P.water,'fill-antialias':true});
    if(sl==='landcover'){ const ice=/ice|glacier/.test(id);
      return keep(ice?'ice':'wood',{'fill-color':['match',['get','class'],['ice','glacier'],P.ice,['wood','forest'],P.wood,'wetland','#E2EAE2','sand','#EEEADB',P.park],'fill-opacity':['match',['get','class'],['ice','glacier'],0.9,['wood','forest'],0.6,0.35]}); }
    if(sl==='park') return keep('wood',{'fill-color':P.park,'fill-opacity':0.45});
    if(sl==='landuse') return keep('urban',{'fill-color':P.resid,'fill-opacity':['match',['get','class'],URB,0.55,0]});
    if(sl==='building'){ L.minzoom=Math.max(L.minzoom||0,13); return keep('bldg',{'fill-color':P.bldg,'fill-outline-color':'#D8D1C3'}); }
    if(sl==='aeroway') return keep('aero',{'fill-color':P.aero,'fill-opacity':0.8});
    return null;
  }
  if(t==='line'){
    if(sl==='waterway') return keep('water',{'line-color':P.waterLine,'line-width':exp(8,0.4,14,1.6,18,4)});
    if(sl==='boundary'){ if(/disputed/.test(id)) return null;
      return keep('boundary',{'line-color':['match',['to-number',['get','admin_level']],2,P.border,P.state],'line-width':['interpolate',['linear'],['zoom'],3,['match',['to-number',['get','admin_level']],2,0.7,0.4],10,['match',['to-number',['get','admin_level']],2,1.4,0.9]],'line-dasharray':[4,2],'line-opacity':['case',['==',['coalesce',['get','maritime'],0],1],0,1]}); }
    if(sl==='transportation'){ if(/casing/.test(id)) return null;
      const rail=/rail|transit/.test(id);
      if(rail) return keep('rail',{'line-color':P.rail,'line-width':lin(8,0.4,14,1.2),'line-opacity':/tunnel/.test(id)?0.4:0.8});
      const w=['match',['get','class'],'motorway',1.6,['trunk','primary'],1.25,['secondary','tertiary'],0.9,0.55];
      return keep('road',{'line-color':['match',['get','class'],['motorway','trunk'],P.roadMaj,P.road],'line-width':['interpolate',['exponential',1.5],['zoom'],5,['*',w,0.5],10,['*',w,1],14,['*',w,3.2],18,['*',w,12]],'line-opacity':/tunnel/.test(id)?0.45:['match',['get','class'],['path','track','service'],0.6,0.95]}); }
    if(sl==='aeroway') return keep('aero',{'line-color':P.runway,'line-width':exp(10,['match',['get','class'],'runway',1,0.3],12,['match',['get','class'],'runway',2.6,0.5],14,['match',['get','class'],'runway',6,2],18,['match',['get','class'],'runway',40,14])});
    return null;
  }
  if(t==='symbol'){
    const lab=(g,c,h)=>{ if(L.layout&&L.layout['icon-image']&&g!=='peak'){ L.layout=Object.assign({},L.layout); ['icon-image','icon-size','icon-offset','icon-anchor','icon-optional'].forEach(k=>delete L.layout[k]); if(L.paint) ['icon-color','icon-halo-color','icon-halo-width','icon-opacity'].forEach(k=>delete L.paint[k]); } return keep(g,{'text-color':c,'text-halo-color':h,'text-halo-width':1.4,'text-halo-blur':0.3}); };
    if(sl==='place') return lab('label',['match',['get','class'],['city','capital'],P.ink,'town','#2E3B44','country',P.ink2,'state',P.ink3,'#55626B'],P.halo);
    if(sl==='water_name'||sl==='waterway') return lab('waterlabel',P.waterLbl,'rgba(232,240,245,.9)');
    if(sl==='transportation_name'){ L.minzoom=Math.max(L.minzoom||0,11); return lab('roadlabel','#8B8E8C','rgba(255,255,255,.9)'); }
    if(sl==='mountain_peak'){ L.minzoom=Math.max(L.minzoom||0,10); return lab('peak',P.peak,P.halo); }
    return null; // poi, housenumber, aerodrome labels (we draw our own airports)
  }
  return null; // raster, hillshade, fill-extrusion in the base style
}
// hillshade paint per basemap. vfr: multidirectional (light from NW plus soft fill light from W and N)
function hillPaint(bm){
  if(bm==='vfr') return {'hillshade-method':'multidirectional','hillshade-exaggeration':0.6,
    'hillshade-illumination-direction':[315,270,0],'hillshade-illumination-altitude':[40,50,50],
    'hillshade-shadow-color':['rgba(66,52,36,.55)','rgba(66,56,46,.22)','rgba(66,56,46,.22)'],
    'hillshade-highlight-color':['rgba(255,252,238,.42)','rgba(255,255,255,.1)','rgba(255,255,255,.1)']};
  if(bm==='ifr') return {'hillshade-exaggeration':0.22,'hillshade-shadow-color':'rgba(60,66,70,.28)','hillshade-highlight-color':'rgba(255,255,255,.12)','hillshade-accent-color':'rgba(60,66,70,.08)','hillshade-illumination-direction':315};
  if(bm==='terrain') return {'hillshade-exaggeration':0.6,'hillshade-shadow-color':'rgba(74,58,40,.55)','hillshade-highlight-color':'rgba(255,253,240,.35)','hillshade-accent-color':'rgba(90,72,50,.22)','hillshade-illumination-direction':315};
  return {'hillshade-exaggeration':0.4,'hillshade-shadow-color':'rgba(84,70,50,.42)','hillshade-highlight-color':'rgba(255,253,244,.28)','hillshade-accent-color':'rgba(90,76,56,.14)','hillshade-illumination-direction':315};
}
function buildStyle(base,o){
  const st=JSON.parse(JSON.stringify(base));
  const vid=Object.keys(st.sources||{}).find(k=>st.sources[k].type==='vector');
  if(!vid) throw new Error('style has no vector source');
  st.sources[vid].attribution=ATT.ofm;
  const out=[]; (st.layers||[]).forEach(L=>{ const r=restyle(L); if(r) out.push(r); });
  // relief from AWS Terrain Tiles; separate sources for hillshade and 3D terrain, as MapLibre recommends
  const dem={type:'raster-dem',tiles:[DEM_URL],encoding:'terrarium',tileSize:256,maxzoom:15,attribution:ATT.dem};
  st.sources['bb-dem']=Object.assign({},dem); st.sources['bb-demh']=Object.assign({},dem);
  // 512 px CSS per tile = sharp on retina; on dpr ≥ 1.5 the 256 px satellite tiles are declared smaller so the map fetches the next zoom level
  const dpr=window.devicePixelRatio||1;
  st.sources['bb-sat']={type:'raster',tiles:[SAT_URL],tileSize:256,minzoom:0,maxzoom:19,attribution:ATT.sat};
  st.sources['bb-topo']={type:'raster',tiles:[TOPO_URL],tileSize:256,minzoom:0,maxzoom:18,attribution:ATT.topo,bounds:[-10,53,42,82]};
  const wi=out.findIndex(l=>l.metadata['bb:g']==='water'); const at=wi>=0?wi:1;
    const reliefV={id:'bb-reliefv',type:'color-relief',source:'bb-demh',metadata:{'bb:g':'reliefv'},layout:{visibility:'none'},paint:{'color-relief-opacity':lin(5,0.9,12,0.75),'color-relief-color':TINT_VFR}};
  const relief={id:'bb-relief',type:'color-relief',source:'bb-demh',metadata:{'bb:g':'relief'},layout:{visibility:'none'},paint:{'color-relief-opacity':0.8,'color-relief-color':TINT_TER}};
  const hillM={id:'bb-hillm',type:'hillshade',source:'bb-demh',metadata:{'bb:g':'hillm'},layout:{visibility:'none'},paint:hillPaint('vfr')};
  const hill={id:'bb-hill',type:'hillshade',source:'bb-demh',metadata:{'bb:g':'hill'},layout:{visibility:'none'},paint:hillPaint('chart')};
  out.splice(at,0,reliefV,relief,hillM,hill);
  const sat={id:'bb-sat',type:'raster',source:'bb-sat',metadata:{'bb:g':'sat'},layout:{visibility:'none'},paint:{'raster-fade-duration':150,'raster-resampling':'linear'}};
  out.splice(1,0,sat);
  const si=out.findIndex(l=>l.type==='symbol'); const topo={id:'bb-topo',type:'raster',source:'bb-topo',metadata:{'bb:g':'topo'},layout:{visibility:'none'},paint:{'raster-fade-duration':150}};
  out.splice(si>=0?si:out.length,0,topo);
  // coastline: thin outline of the water polygons, under the labels
  const ci=out.findIndex(l=>l.metadata['bb:g']==='water')+1;
  out.splice(ci>0?ci:out.length,0,{id:'bb-coast',type:'line',source:vid,'source-layer':'water',metadata:{'bb:g':'coast'},paint:{'line-color':P.coast,'line-width':lin(3,0.5,12,1.1)}});
  st.layers=out; st.metadata=Object.assign({},st.metadata,{'bb:vid':vid});
  delete st.terrain; delete st.sky;
  return st;
}

/* ---------- create the map, or reject within the time limit ---------- */
function create(container,o){
  o=o||{}; const deadline=Date.now()+(o.timeout||6000); const lg=o.log||(()=>{});
  return new Promise((ok,ko)=>{
    let map=null, done=false;
    const fail=e=>{ if(done) return; done=true; clearTimeout(tm); try{ if(map) map.remove(); }catch(_){} ko(e instanceof Error?e:new Error(String(e))); };
    const tm=setTimeout(()=>fail(new Error('timeout')),Math.max(500,deadline-Date.now()));
    if(!window.maplibregl) return fail(new Error('maplibre-gl not loaded'));
    if(navigator.onLine===false) return fail(new Error('offline'));
    const ac=window.AbortController?new AbortController():null; setTimeout(()=>ac&&ac.abort(),Math.max(500,deadline-Date.now()));
    lg('fetch style'); fetch(o.styleUrl||STYLE_URL,{signal:ac&&ac.signal,credentials:'omit'}).then(r=>{ lg('style http '+r.status); if(!r.ok) throw new Error('style '+r.status); return r.json(); }).then(base=>{
      if(done) return; const style=buildStyle(base,o); lg('style built, '+style.layers.length+' layers');
      try{ map=new maplibregl.Map({container,style,center:o.center||[10,60],zoom:o.zoom==null?4:o.zoom,minZoom:2,maxZoom:17.5,maxPitch:85,attributionControl:false,dragRotate:false,pitchWithRotate:false,
        touchPitch:false,fadeDuration:200,canvasContextAttributes:{antialias:true},cooperativeGestures:false,refreshExpiredTiles:false}); }
      catch(e){ return fail(e); }
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:ATT.nav}),'bottom-right');
      map.addControl(new maplibregl.ScaleControl({unit:'nautical',maxWidth:110}),'bottom-right');
      // narrow screens: attribution starts folded behind its (i) button; it opens on tap
      if(container.clientWidth<640) setTimeout(()=>{ const a=container.querySelector('.maplibregl-ctrl-attrib'); if(a){ a.classList.remove('maplibregl-compact-show'); a.removeAttribute('open'); } },0);
      map.__bb={bm:'vfr',relief:'on',ly:{},vid:style.metadata['bb:vid'],ex:1.5,t3:false,oaip:'none'};
      let loaded=false, tile=false; const chk=()=>{ if(loaded&&!done){ done=true; clearTimeout(tm); ok(map); } };
      map.on('error',e=>{ lg('map error: '+String((e&&e.error&&e.error.message)||e).slice(0,120)); if(!loaded&&e&&e.error&&/style|WebGL|context|layers\[|expression|sources\./i.test(String(e.error.message||''))) fail(e.error); });
      map.on('load',()=>{ lg('map load'); loaded=true; try{ addImages(map); setBasemap(map,o.bm||'vfr'); setRelief(map,o.relief||'on'); }catch(e){ return fail(e); } chk(); });
      map.on('data',e=>{ if(e.dataType==='source'&&e.tile&&e.sourceId===map.__bb.vid){ tile=true; chk(); } });
    }).catch(fail);
  });
}

/* ---------- basemap, relief, contours, 3D ---------- */
function eachBase(map,f){ (map.getStyle().layers||[]).forEach(L=>{ const g=L.metadata&&L.metadata['bb:g']; if(g) f(L,g); }); }
const fits=(k,t)=>{ const p=k.split('-')[0]; return t==='symbol'? (p==='text'||p==='icon') : t==='fill-extrusion'? k.startsWith('fill-extrusion-') : p===t&&!(t==='fill'&&k.startsWith('fill-extrusion-')); };
const BMPK={}; Object.keys(BMP).forEach(bm=>Object.keys(BMP[bm]).forEach(g=>{ const s=BMPK[g]||(BMPK[g]=new Set()); Object.keys(BMP[bm][g]).forEach(k=>s.add(k)); }));
const SKIP=new Set(['hill','hillm','relief','reliefv','ct']);
function setBasemap(map,bm){ if(!BASEMAPS.includes(bm)) bm='vfr'; map.__bb.bm=bm; const v=VIS[bm];
  eachBase(map,(L,g)=>{ if(SKIP.has(g)) return; const on=g in v?!!v[g]:true; map.setLayoutProperty(L.id,'visibility',on?'visible':'none');
    const ks=BMPK[g]; if(!ks) return; const ch=map.__bb.ch||(map.__bb.ch={}); const o=ch[L.id]||(ch[L.id]={});
    ks.forEach(k=>{ if(!fits(k,L.type)) return; if(!(k in o)) o[k]=map.getPaintProperty(L.id,k); const want=BMP[bm]&&BMP[bm][g]&&k in BMP[bm][g]?BMP[bm][g][k]:o[k]; map.setPaintProperty(L.id,k,want); }); });
  map.setPaintProperty('bb-sat','raster-opacity',1);
  applyRelief(map); }
function setRelief(map,mode){ map.__bb.relief=mode==='off'?'off':'on'; applyRelief(map); }
const vis=(map,id,on)=>{ if(map.getLayer(id)) map.setLayoutProperty(id,'visibility',on?'visible':'none'); };
function applyRelief(map){ const bm=map.__bb.bm, on=map.__bb.relief!=='off';
  vis(map,'bb-reliefv',on&&bm==='vfr'); vis(map,'bb-relief',on&&bm==='terrain'); vis(map,'bb-hillm',on&&bm==='vfr');
  const std=on&&['chart','terrain','ifr'].includes(bm); vis(map,'bb-hill',std);
  if(std&&map.getLayer('bb-hill')){ const p=hillPaint(bm); Object.keys(p).forEach(k=>map.setPaintProperty('bb-hill',k,p[k])); }
  const ct=!!(map.__bb.ly&&map.__bb.ly.ct)&&RELIEF_BM.includes(bm); vis(map,'bb-ct',ct); vis(map,'bb-ctl',ct);
  if(map.getLayer('bb-ct')){ const c=ctPaint(bm); Object.keys(c.l).forEach(k=>map.setPaintProperty('bb-ct',k,c.l[k])); Object.keys(c.t).forEach(k=>map.setPaintProperty('bb-ctl',k,c.t[k])); } }
function set3D(map,on,ex){ map.__bb.t3=!!on; if(ex) map.__bb.ex=ex;
  if(on){ map.setTerrain({source:'bb-dem',exaggeration:map.__bb.ex});
    try{ map.setSky({'sky-color':'#BFD5E4','horizon-color':'#E9EFF1','fog-color':'#E6ECEE','sky-horizon-blend':0.6,'horizon-fog-blend':0.55,'fog-ground-blend':0.35,'atmosphere-blend':0}); }catch(e){}
    map.dragRotate.enable(); map.touchZoomRotate.enableRotation(); map.touchPitch.enable(); }
  else { map.setTerrain(null); map.dragRotate.disable(); map.touchZoomRotate.disableRotation(); map.touchPitch.disable(); }
  map.triggerRepaint(); }
function exag(map){ const t=map.getTerrain&&map.getTerrain(); return t?(t.exaggeration||1):0; }

/* contour lines in feet, computed in the browser from the same AWS DEM tiles (maplibre-contour, BSD-3) */
function ctPaint(bm){ const c=bm==='ifr'?'rgba(110,118,124,':'rgba(128,92,52,';
  return {l:{'line-color':['match',['get','level'],1,c+(bm==='ifr'?'.32)':'.42)'),c+(bm==='ifr'?'.18)':'.24)')]},t:{'text-color':bm==='ifr'?'#7A848A':'#7A5A34'}}; }
function ctLayers(src,bm){ const c=ctPaint(bm);
  return [{id:'bb-ct',type:'line',source:src,'source-layer':'contours',minzoom:8.5,metadata:{'bb:g':'ct'},layout:{visibility:'none','line-join':'round'},paint:Object.assign({'line-width':['interpolate',['linear'],['zoom'],9,['match',['get','level'],1,0.7,0.35],14,['match',['get','level'],1,1.2,0.7]]},c.l)},
    {id:'bb-ctl',type:'symbol',source:src,'source-layer':'contours',minzoom:10,metadata:{'bb:g':'ct'},filter:['>',['get','level'],0],layout:{visibility:'none','symbol-placement':'line','symbol-spacing':360,'text-size':10,'text-font':FONT_R,'text-field':['number-format',['get','ele'],{}],'text-padding':4,'text-max-angle':30},
      paint:Object.assign({'text-halo-color':'rgba(250,248,240,.85)','text-halo-width':1.2},c.t)}]; }
const CT_TH={8:[1000,5000],9:[500,2500],10:[500,1000],11:[250,1000],12:[200,1000],13:[100,500]};
let CTL=null;
function loadScript(src){ return new Promise((ok,ko)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=()=>ko(new Error(src)); document.head.appendChild(s); }); }
function addContours(map){ if(map.getSource('bb-ct')) return Promise.resolve(true);
  CTL=CTL||(window.mlcontour?Promise.resolve():loadScript(CONTOUR_JS));
  return CTL.then(()=>{ if(map.getSource('bb-ct')) return true; if(!window.mlcontour) throw new Error('maplibre-contour');
    if(!addContours.src){ addContours.src=new mlcontour.DemSource({url:DEM_URL,encoding:'terrarium',maxzoom:12,worker:true,cacheSize:100,timeoutMs:10000}); addContours.src.setupMaplibre(maplibregl); }
    map.addSource('bb-ct',{type:'vector',tiles:[addContours.src.contourProtocolUrl({multiplier:3.28084,thresholds:CT_TH,contourLayer:'contours',elevationKey:'ele',levelKey:'level',extent:4096,buffer:1})],minzoom:8,maxzoom:13});
    const L=map.getStyle().layers, b=L.find(l=>{ const g=l.metadata&&l.metadata['bb:g']; return g==='bldg'||g==='road'||g==='rail'||g==='aero'&&l.type==='line'; })||L.find(l=>l.id==='bb-topo');
    ctLayers('bb-ct',map.__bb.bm).forEach(x=>map.addLayer(x,b?b.id:undefined)); applyRelief(map); return true; }).catch(()=>false); }

/* ---------- openAIP airspace ---------- */
function oaipKey(){ let k=OPENAIP_KEY; try{ const s=localStorage.getItem('bb-openaip-key'); if(s) k=s==='off'?'':s; }catch(e){} return String(k||'').trim(); }
// "FL95", "1500 ft MSL", "GND" from the openAIP limit fields
function lim(p){ const v=['get',p+'_value'], d=['coalesce',['get',p+'_reference_datum'],''];
  return ['case',['!',['has',p+'_value']],'',
    ['all',['==',d,'GND'],['==',['to-number',v,-1],0]],'GND',
    ['==',d,'STD'],['concat','FL',['to-string',v]],
    ['concat',['to-string',v],' ',['downcase',['to-string',['coalesce',['get',p+'_unit'],'']]],' ',['to-string',d]]]; }
const AS_LBL=['concat',['coalesce',['get','name'],''],['case',['has','upper_limit_value'],['concat','\n',lim('upper_limit'),' / ',lim('lower_limit')],'']];
const T=(...a)=>['match',['get','type'],a,true,false];
const AS_BLUE='#1D4E9E', AS_RED='#B3261E', AS_MAG='#9A1E68', AS_AMB='#A0620A';
function asLayers(src){ const s={source:src,'source-layer':'airspaces'}, so={source:src,'source-layer':'airspaces_border_offset'};
  const ln=(id,f,c,w,d,mz)=>Object.assign({id,type:'line',filter:f,minzoom:mz||5,layout:{visibility:'none','line-join':'round'},paint:Object.assign({'line-color':c,'line-width':w,'line-opacity':lin(5,0.55,8,1)},d?{'line-dasharray':d}:{})},s);
  const fl=(id,f,c,o,src2)=>Object.assign({id,type:'fill',filter:f,minzoom:5,layout:{visibility:'none'},paint:{'fill-color':c,'fill-opacity':o}},src2||s);
  return [
    fl('bb-as-pf',T('prohibited'),AS_RED,lin(5,0.05,10,0.1)),
    fl('bb-as-rdb',T('restricted','danger','prohibited'),AS_RED,lin(5,0.12,10,0.22),so),
    fl('bb-as-tmab',T('tma','cta'),AS_BLUE,lin(5,0.08,10,0.14),so),
    fl('bb-as-ctrf',T('ctr'),AS_BLUE,lin(5,0.04,10,0.07)),
    ln('bb-as-tma',['any',T('tma','cta'),['all',T('other'),['match',['get','icao_class'],['a','b','c','d'],true,false]]],AS_BLUE,lin(5,0.7,11,1.5)),
    ln('bb-as-ctr',T('ctr'),AS_BLUE,lin(5,1,11,2.2),[4,2]),
    ln('bb-as-rd',T('restricted','danger','prohibited'),AS_RED,lin(5,0.8,11,1.6)),
    ln('bb-as-tiz',T('tiz','tia','rmz','tmz'),AS_MAG,lin(5,0.8,11,1.6),[2,1.5]),
    ln('bb-as-atz',T('atz','matz','htz'),AS_MAG,lin(5,0.6,11,1.3),[4,2]),
    ln('bb-as-tra',T('tra','tsa','tfa','tfr','alert','warning','protected'),AS_AMB,lin(5,0.7,11,1.4),[3,2]),
    Object.assign({id:'bb-as-l',type:'symbol',minzoom:7.5,filter:['any',T('ctr','tma','cta','restricted','danger','prohibited','tiz','tia','rmz','tmz','atz','matz','htz','tra','tsa'),['all',T('other'),['match',['get','icao_class'],['a','b','c','d'],true,false]]],
      layout:{visibility:'none','symbol-placement':'line','symbol-spacing':520,'text-field':AS_LBL,'text-font':FONT_B,'text-size':lin(8,9.5,12,11.5),'text-max-angle':25,'text-offset':[0,0.9],'text-padding':6,'text-optional':true,'symbol-sort-key':['match',['get','type'],['prohibited','restricted','danger'],0,'ctr',1,2]},
      paint:{'text-color':['match',['get','type'],['restricted','danger','prohibited'],AS_RED,['tiz','tia','rmz','tmz','atz','matz','htz'],AS_MAG,['tra','tsa'],AS_AMB,AS_BLUE],'text-halo-color':'rgba(255,255,255,.92)','text-halo-width':1.6}},s)
  ]; }
function addAirspace(map,cb){ const key=oaipKey(); cb=cb||(()=>{}); if(!key){ map.__bb.oaip='none'; cb('none'); return false; }
  if(map.getSource('bb-oaip')) return true;
  map.addSource('bb-oaip',{type:'vector',tiles:[OPENAIP_URL+encodeURIComponent(key)],minzoom:5,maxzoom:14,attribution:ATT.oaip});
  const before=map.getLayer('bb-mefg')?'bb-mefg':undefined; const Ls=asLayers('bb-oaip'); Ls.forEach(L=>map.addLayer(L,before)); map.__bb.asIds=Ls.map(L=>L.id); map.__bb.oaip='ok';
  let errs=0; map.on('error',e=>{ if(map.__bb.oaip!=='ok') return; const er=e&&e.error, u=String((er&&er.url)||''), st=er&&er.status;
    if(e.sourceId!=='bb-oaip'&&!/openaip/.test(u)) return;
    if(st===401||st===403||++errs>12){ map.__bb.oaip='denied'; (map.__bb.asIds||[]).forEach(id=>vis(map,id,false)); cb('denied'); } });
  setGroups(map,map.__bb.ly||{}); cb('ok'); return true; }

/* ---------- aviation overlay: sources, symbols, layers ---------- */
function icon(map,name,w,h,draw){ const s=Math.max(2,Math.ceil(window.devicePixelRatio||1)); const c=document.createElement('canvas'); c.width=w*s; c.height=h*s; const g=c.getContext('2d'); g.scale(s,s); draw(g,w,h);
  const d=g.getImageData(0,0,c.width,c.height); if(map.hasImage(name)) map.removeImage(name); map.addImage(name,{width:c.width,height:c.height,data:new Uint8Array(d.data.buffer)},{pixelRatio:s}); }
function addImages(map){
  icon(map,'bb-vor',14,14,g=>{ g.beginPath(); for(let a=0;a<6;a++){ const t=a*Math.PI/3; g[a?'lineTo':'moveTo'](7+5.2*Math.cos(t),7+5.2*Math.sin(t)); } g.closePath(); g.fillStyle='#fff'; g.fill(); g.strokeStyle=P.vor; g.lineWidth=1.4; g.stroke(); g.beginPath(); g.arc(7,7,1.2,0,7); g.fillStyle=P.vor; g.fill(); });
  icon(map,'bb-ndb',12,12,g=>{ g.beginPath(); g.setLineDash([1.6,1.4]); g.arc(6,6,4.2,0,7); g.strokeStyle=P.ndb; g.lineWidth=1.3; g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(6,6,1.1,0,7); g.fillStyle=P.ndb; g.fill(); });
  icon(map,'bb-aip',10,10,g=>{ g.beginPath(); g.moveTo(5,1.2); g.lineTo(9,8.6); g.lineTo(1,8.6); g.closePath(); g.fillStyle='rgba(255,255,255,.85)'; g.fill(); g.strokeStyle=P.aip; g.lineWidth=1.2; g.stroke(); });
  icon(map,'bb-my',12,12,g=>{ g.beginPath(); g.moveTo(6,1); g.lineTo(11,10.4); g.lineTo(1,10.4); g.closePath(); g.fillStyle='#fff'; g.fill(); g.strokeStyle=P.accent; g.lineWidth=1.5; g.stroke(); });
  icon(map,'bb-note',16,24,g=>{ g.beginPath(); g.moveTo(8,23); g.lineTo(2,13); g.lineTo(2,1.5); g.lineTo(14,1.5); g.lineTo(14,13); g.closePath(); g.fillStyle='#F2C230'; g.fill(); g.strokeStyle='#8A6D00'; g.lineWidth=1; g.stroke(); });
  [['n','#13202A'],['a','#B86E00'],['r','#B3261E']].forEach(([k,c])=>icon(map,'bb-crit-'+k,18,16,g=>{ g.beginPath(); g.moveTo(9,1.5); g.lineTo(16.5,14.5); g.lineTo(1.5,14.5); g.closePath(); g.fillStyle='#fff'; g.fill(); g.strokeStyle=c; g.lineWidth=2; g.lineJoin='round'; g.stroke(); }));
}
const FC={type:'FeatureCollection',features:[]};
const SRC=['bb-mef','bb-mefg','bb-awy','bb-ap','bb-nv','bb-fx','bb-my','bb-note','bb-leg','bb-rpt','bb-crit','bb-hov','bb-snap'];
function addOverlays(map){
  SRC.forEach(id=>{ if(!map.getSource(id)) map.addSource(id,{type:'geojson',data:FC,buffer:64,tolerance:0.2}); });
  const halo={'text-halo-color':'rgba(255,255,255,.92)','text-halo-width':1.6,'text-halo-blur':0.2};
  const add=L=>{ if(!map.getLayer(L.id)) map.addLayer(L); };
  // highest terrain per square
  add({id:'bb-mefg',type:'line',source:'bb-mefg',paint:{'line-color':'rgba(46,91,154,.18)','line-width':0.8}});
  add({id:'bb-mef',type:'symbol',source:'bb-mef',layout:{'text-field':['format',['get','th'],{'font-scale':1},['get','hu'],{'font-scale':0.62}],'text-font':FONT_B,'text-size':lin(4,15,9,24),'text-allow-overlap':true,'text-ignore-placement':true},paint:Object.assign({'text-color':'rgba(46,91,154,.8)'},halo,{'text-halo-color':'rgba(255,255,255,.75)'})});
  add({id:'bb-awy',type:'line',source:'bb-awy',minzoom:5,paint:{'line-color':'rgba(29,78,158,.45)','line-width':lin(5,0.6,10,1.3)}});
  // the route, under the aviation symbols (dashed for missed approach / alternate legs)
  add({id:'bb-leg-case',type:'line',source:'bb-leg',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'rgba(255,255,255,.9)','line-width':lin(3,6,12,9)}});
  add({id:'bb-leg',type:'line',source:'bb-leg',filter:['!=',['get','d'],1],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':P.accent,'line-width':lin(3,3.2,12,4.6)}});
  add({id:'bb-leg-d',type:'line',source:'bb-leg',filter:['==',['get','d'],1],layout:{'line-join':'round'},paint:{'line-color':P.accent,'line-width':lin(3,2.4,12,3.4),'line-dasharray':[2,1.5]}});
  // airports: large from the start, medium and small as you zoom in
  [[2,2.5,4.2],[1,5,3.2],[0,7.5,2.4]].forEach(([c,mz,r])=>{
    if(c===2) add({id:'bb-ap2r',type:'circle',source:'bb-ap',minzoom:mz,filter:['==',['get','c'],2],paint:{'circle-radius':lin(3,r+2.2,10,r+4.5),'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'rgba(44,95,141,.5)','circle-stroke-width':1}});
    add({id:'bb-ap'+c,type:'circle',source:'bb-ap',minzoom:mz,filter:['==',['get','c'],c],paint:{'circle-radius':lin(3,r,10,r+1.6),'circle-color':c?P.ap:'#fff','circle-stroke-color':P.ap,'circle-stroke-width':1.3}}); });
  add({id:'bb-nv',type:'symbol',source:'bb-nv',minzoom:4.8,filter:['any',['!=',['get','ndb'],1],['>=',['zoom'],7]],layout:{'icon-image':['case',['==',['get','ndb'],1],'bb-ndb','bb-vor'],'icon-allow-overlap':true,'icon-ignore-placement':true,
    'text-field':['step',['zoom'],'',6.5,['get','n']],'text-font':FONT_R,'text-size':10.5,'text-offset':[0.9,0.7],'text-anchor':'top-left','text-optional':true,'symbol-sort-key':['case',['==',['get','ndb'],1],3,1]},paint:Object.assign({'text-color':['case',['==',['get','ndb'],1],P.ndb,P.vor]},halo)});
  add({id:'bb-fx',type:'symbol',source:'bb-fx',minzoom:6.2,layout:{'icon-image':'bb-aip','icon-allow-overlap':true,'icon-ignore-placement':true,'text-field':['step',['zoom'],'',7.6,['get','n']],'text-font':FONT_R,'text-size':9.5,'text-offset':[0.7,0.1],'text-anchor':'left','text-optional':true},paint:Object.assign({'text-color':P.aip},halo)});
  add({id:'bb-my',type:'symbol',source:'bb-my',layout:{'icon-image':'bb-my','icon-allow-overlap':true,'icon-ignore-placement':true,'text-field':['step',['zoom'],'',4.5,['get','n']],'text-font':FONT_R,'text-size':10.5,'text-offset':[0.8,0.1],'text-anchor':'left','text-optional':true},paint:Object.assign({'text-color':P.accent},halo)});
  [[2,4.2],[1,6.4],[0,8.6]].forEach(([c,mz])=>add({id:'bb-apl'+c,type:'symbol',source:'bb-ap',minzoom:mz,filter:['==',['get','c'],c],layout:{'text-field':['get','n'],'text-font':c===2?FONT_B:FONT_R,'text-size':c===2?11.5:10.5,'text-offset':[0.7,-0.55],'text-anchor':'bottom-left','text-optional':true,'symbol-sort-key':-c},paint:Object.assign({'text-color':P.ap},halo)}));
  add({id:'bb-note',type:'symbol',source:'bb-note',layout:{'icon-image':'bb-note','icon-anchor':'bottom','icon-allow-overlap':true,'icon-ignore-placement':true,'text-field':['step',['zoom'],'',4.3,['get','t']],'text-font':FONT_B,'text-size':11,'text-offset':[0.9,-1.1],'text-anchor':'left','text-optional':true},paint:Object.assign({'text-color':'#5C4A00'},halo)});
  // route points and names on top
  add({id:'bb-rpt',type:'circle',source:'bb-rpt',paint:{'circle-radius':['case',['==',['get','s'],1],6,4.6],'circle-color':['case',['==',['get','s'],1],P.accent,'#fff'],'circle-stroke-color':P.accent,'circle-stroke-width':2.2,'circle-pitch-alignment':'map'}});
  add({id:'bb-rptl',type:'symbol',source:'bb-rpt',layout:{'text-field':['get','n'],'text-font':FONT_B,'text-size':12.5,'text-offset':[0.75,-0.65],'text-anchor':'bottom-left','text-allow-overlap':true,'text-ignore-placement':false,'text-padding':1},paint:{'text-color':'#7A1652','text-halo-color':'#fff','text-halo-width':2,'text-halo-blur':0.1}});
  add({id:'bb-crit',type:'symbol',source:'bb-crit',layout:{'icon-image':['concat','bb-crit-',['get','c']],'icon-anchor':'bottom','icon-allow-overlap':true,'text-field':['get','t'],'text-font':FONT_B,'text-size':11.5,'text-anchor':'left','text-offset':[0.9,-0.7],'text-allow-overlap':true},paint:{'text-color':['match',['get','c'],'r','#B3261E','a','#B86E00','#13202A'],'text-halo-color':'#fff','text-halo-width':2}});
  add({id:'bb-snap',type:'circle',source:'bb-snap',paint:{'circle-radius':11,'circle-color':'rgba(29,78,158,.08)','circle-stroke-color':P.info,'circle-stroke-width':2}});
  add({id:'bb-snapl',type:'symbol',source:'bb-snap',layout:{'text-field':['get','n'],'text-font':FONT_B,'text-size':12,'text-anchor':'top-left','text-offset':[1,0.8],'text-allow-overlap':true},paint:{'text-color':P.info,'text-halo-color':'#fff','text-halo-width':2}});
  add({id:'bb-hov',type:'circle',source:'bb-hov',paint:{'circle-radius':7,'circle-color':'rgba(29,78,158,.18)','circle-stroke-color':P.info,'circle-stroke-width':2,'circle-pitch-alignment':'map'}});
  add({id:'bb-hovl',type:'symbol',source:'bb-hov',layout:{'text-field':['get','t'],'text-font':FONT_B,'text-size':11.5,'text-anchor':'top-left','text-offset':[0.9,0.7],'text-allow-overlap':true},paint:{'text-color':P.info,'text-halo-color':'#fff','text-halo-width':2}});
  if(!map.getLayer('bb-path3d')) map.addLayer(pathLayer());
}
const LYG={ap:['bb-ap0','bb-ap1','bb-ap2','bb-ap2r','bb-apl0','bb-apl1','bb-apl2'],nv:['bb-nv'],fx:['bb-fx'],my:['bb-my'],nt:['bb-note'],mef:['bb-mef','bb-mefg'],awy:['bb-awy']};
function setGroups(map,LY){ map.__bb.ly=Object.assign({},LY);
  Object.keys(LYG).forEach(k=>{ const on=k==='awy'?true:!!LY[k]; LYG[k].forEach(id=>vis(map,id,on)); });
  const as=!!LY.as&&map.__bb.oaip==='ok'; (map.__bb.asIds||[]).forEach(id=>vis(map,id,as));
  applyRelief(map); }
function setData(map,id,fc){ const s=map.getSource(id); if(s) s.setData(fc||FC); }
const HITL=['bb-ap0','bb-ap1','bb-ap2','bb-nv','bb-fx','bb-my','bb-note'];
// the nearest clickable aviation feature within r CSS px
function hit(map,x,y,r){ const L=HITL.filter(id=>map.getLayer(id)&&map.getLayoutProperty(id,'visibility')!=='none');
  const fs=map.queryRenderedFeatures([[x-r,y-r],[x+r,y+r]],{layers:L}); let best=null, bd=r;
  fs.forEach(f=>{ const c=f.geometry&&f.geometry.coordinates; if(!c) return; const p=map.project(c); const dy=f.layer.id==='bb-note'?14:0; const d=Math.hypot(p.x-x,p.y-dy-y); if(d<bd){ bd=d; best={x:p.x,y:p.y-dy,k:f.properties.k,i:f.properties.i}; } }); return best; }
// airspace under a screen point (for the info panel)
function airspaceAt(map,x,y){ if(map.__bb.oaip!=='ok'||!map.getLayer('bb-as-tma')) return []; const ids=(map.__bb.asIds||[]).filter(id=>map.getLayer(id)&&map.getLayoutProperty(id,'visibility')!=='none'&&/-(ctrf|pf)$/.test(id)===false);
  let fs=[]; try{ fs=map.queryRenderedFeatures([[x-3,y-3],[x+3,y+3]],{layers:ids}); }catch(e){} const seen={}; return fs.map(f=>f.properties).filter(p=>{ const k=(p.name||'')+p.type; if(seen[k]) return false; seen[k]=1; return true; }); }

/* ---------- 3D: the planned path at altitude (curtain to the ground + ribbon at the level) and the aircraft ---------- */
const AC_SVG='<svg viewBox="-16 -16 32 32" width="34" height="34" aria-hidden="true"><path d="M0-14c1.3 0 2 1.4 2 3.2V-4l11 6.2v2.6L2 1.6V8.4l3.6 2.8v2.2L0 12l-5.6 1.4v-2.2L-2 8.4V1.6l-11 3.2V2.2L-2-4v-6.8C-2-12.6-1.3-14 0-14z" fill="#9A1E68" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
function pathLayer(){
  const VS='attribute vec3 a_p; attribute float a_k; attribute vec3 a_c; uniform mat4 u_m; uniform float u_ex; uniform float u_band; uniform float u_a; varying vec4 v_c;\n'+
    'void main(){ float z = a_k<0.5 ? a_p.z*u_ex : (a_k<1.5 ? a_p.z*u_ex-u_band : -200.0); gl_Position=u_m*vec4(a_p.xy,z,1.0); float al = a_k>1.5 ? u_a*0.25 : u_a; v_c=vec4(a_c*al,al); }';
  const FS='precision mediump float; varying vec4 v_c; void main(){ gl_FragColor=v_c; }';
  const L={id:'bb-path3d',type:'custom',renderingMode:'3d',n:0,pts:null,hov:null,
    onAdd(map,gl){ this.map=map; const sh=(t,s)=>{ const o=gl.createShader(t); gl.shaderSource(o,s); gl.compileShader(o); return o; };
      const p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,VS)); gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FS)); gl.linkProgram(p); this.pg=p;
      this.loc={p:gl.getAttribLocation(p,'a_p'),k:gl.getAttribLocation(p,'a_k'),c:gl.getAttribLocation(p,'a_c'),m:gl.getUniformLocation(p,'u_m'),ex:gl.getUniformLocation(p,'u_ex'),band:gl.getUniformLocation(p,'u_band'),a:gl.getUniformLocation(p,'u_a')};
      this.vb=gl.createBuffer(); this.ib1=gl.createBuffer(); this.ib2=gl.createBuffer(); this.dirty=true;
      const dl=document.createElement('div'); dl.className='bb-acd'; dl.hidden=true; map.getContainer().appendChild(dl); this.dl=dl;
      const d=document.createElement('div'); d.className='bb-ac'; d.hidden=true; d.innerHTML=AC_SVG; map.getContainer().appendChild(d); this.ac=d; },
    onRemove(){ if(this.ac) this.ac.remove(); if(this.dl) this.dl.remove(); },
    set(pts,hov){ if(pts!==undefined&&pts!==this.src){ this.src=pts; this.pts=pts&&pts.length>1?pts:null; this.dirty=true; } this.hov=hov||null; if(this.map) this.map.triggerRepaint(); },
    upload(gl){ const P=this.pts; this.dirty=false; if(!P){ this.n=0; return; }
      const MC=maplibregl.MercatorCoordinate; const o=MC.fromLngLat([P[0].lo,P[0].la]); this.ox=o.x; this.oy=o.y;
      const v=new Float32Array(P.length*3*7); P.forEach((q,i)=>{ const m=MC.fromLngLat([q.lo,q.la]); const x=m.x-o.x, y=m.y-o.y, z=q.alt*0.3048, c=q.col; for(let k=0;k<3;k++) v.set([x,y,z,k,c[0],c[1],c[2]],(i*3+k)*7); });
      const cur=[], rib=[]; for(let i=0;i<P.length-1;i++){ const a=i*3, b=a+3; cur.push(a,a+2,b,b,a+2,b+2); rib.push(a,a+1,b,b,a+1,b+1); }
      gl.bindBuffer(gl.ARRAY_BUFFER,this.vb); gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib1); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(cur),gl.STATIC_DRAW); this.n1=cur.length;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib2); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(rib),gl.STATIC_DRAW); this.n2=rib.length; this.n=P.length; },
    render(gl,args){ const map=this.map, ex=exag(map); if(this.dirty) this.upload(gl);
      const hideAc=()=>{ if(this.ac) this.ac.hidden=true; if(this.dl) this.dl.hidden=true; };
      if(!this.n||!ex){ hideAc(); return; }
      const ws=map.transform.worldSize, M0=args.modelViewProjectionMatrix; // world: x,y in pixels at this zoom, z in metres
      // M = M0 · translate(ox·ws, oy·ws, 0) · scale(ws, ws, 1), done in double precision here
      const M=new Float64Array(16); for(let i=0;i<16;i++) M[i]=M0[i]; const tx=this.ox*ws, ty=this.oy*ws;
      for(let r=0;r<4;r++){ M[12+r]=M0[r]*tx+M0[4+r]*ty+M0[12+r]; M[r]=M0[r]*ws; M[4+r]=M0[4+r]*ws; }
      const lat=map.getCenter().lat, mpp=40075016.686*Math.cos(lat*Math.PI/180)/ws;
      gl.useProgram(this.pg); gl.uniformMatrix4fv(this.loc.m,false,new Float32Array(M)); gl.uniform1f(this.loc.ex,ex); gl.uniform1f(this.loc.band,mpp*3.2);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.vb); const st=28; gl.enableVertexAttribArray(this.loc.p); gl.vertexAttribPointer(this.loc.p,3,gl.FLOAT,false,st,0); gl.enableVertexAttribArray(this.loc.k); gl.vertexAttribPointer(this.loc.k,1,gl.FLOAT,false,st,12); gl.enableVertexAttribArray(this.loc.c); gl.vertexAttribPointer(this.loc.c,3,gl.FLOAT,false,st,16);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
      gl.depthMask(false); gl.uniform1f(this.loc.a,0.32); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib1); gl.drawElements(gl.TRIANGLES,this.n1,gl.UNSIGNED_SHORT,0);
      // in the cockpit view the ribbon would sit right under the camera: the curtain, seen edge-on, shows the path ahead
      if(!(this.hov&&this.hov.hide)){ gl.depthMask(true); gl.uniform1f(this.loc.a,1); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib2); gl.drawElements(gl.TRIANGLES,this.n2,gl.UNSIGNED_SHORT,0); }
      gl.depthMask(true);
      gl.disableVertexAttribArray(this.loc.k); gl.disableVertexAttribArray(this.loc.c);
      // the aircraft at the hover/fly position: a DOM symbol turned to the track on screen, with a line down to the ground
      const h=this.hov, ac=this.ac; if(!h||!ac||h.hide){ hideAc(); return; }
      const cv=map.getCanvas(), W=cv.clientWidth, H=cv.clientHeight;
      const scr=(la,lo,ft)=>{ const m=maplibregl.MercatorCoordinate.fromLngLat([lo,la]); const x=m.x-this.ox, y=m.y-this.oy, z=ft*0.3048*ex; const c=[0,1,2,3].map(r=>M[r]*x+M[4+r]*y+M[8+r]*z+M[12+r]); return c[3]>0?[(c[0]/c[3]+1)/2*W,(1-c[1]/c[3])/2*H]:null; };
      const p=scr(h.la,h.lo,h.alt); if(!p){ hideAc(); return; }
      let rot=0; if(h.tr!=null){ const t=h.tr*Math.PI/180, d=0.25/60; const q=scr(h.la+d*Math.cos(t),h.lo+d*Math.sin(t)/Math.cos(h.la*Math.PI/180),h.alt); if(q) rot=Math.atan2(q[0]-p[0],-(q[1]-p[1]))*180/Math.PI; }
      ac.style.transform=`translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`; ac.hidden=false;
      const g=h.gnd!=null?scr(h.la,h.lo,h.gnd):null, dl=this.dl;
      if(g&&dl){ const dx=g[0]-p[0], dy=g[1]-p[1], len=Math.hypot(dx,dy); dl.style.height=len.toFixed(1)+'px'; dl.style.transform=`translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px) rotate(${(Math.atan2(-dx,dy)*180/Math.PI).toFixed(1)}deg)`; dl.hidden=len<3; } else if(dl) dl.hidden=true; }
  };
  return L;
}
// pts: the path (undefined = keep), hov: aircraft {la,lo,alt,tr,gnd,hide}
function setPath3D(map,pts,hov){ const L=map.getLayer('bb-path3d'); const impl=L&&(L.implementation||L); if(impl&&impl.set) impl.set(pts,hov); }

window.RXMAP={create,setBasemap,setRelief,set3D,addOverlays,addAirspace,addContours,airspaceAt,oaipKey,setGroups,setData,hit,setPath3D,exag,BASEMAPS,ATT,P,
  urls:{style:STYLE_URL,dem:DEM_URL,sat:SAT_URL,topo:TOPO_URL,oaip:OPENAIP_URL}};
})();
