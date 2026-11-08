/* Birdbird Route Explorer: the MapLibre chart (rxmap.js)
   Loaded by route.html. Builds a calm aeronautical chart from OpenFreeMap vector tiles,
   relief, contours and 3D from AWS Terrain Tiles, satellite from EOX Sentinel-2 cloudless 2016 (or, with a key,
   Esri World Imagery),
   topo from Kartverket and (with an API key) airspace from openAIP. If anything fails within
   the time limit, create() rejects and route.html keeps its own canvas map. */
(function(){
'use strict';
const STYLE_URL='https://tiles.openfreemap.org/styles/positron';
// AWS Terrain Tiles (terrarium): z/x/y
const DEM_URL='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
// EOX Sentinel-2 cloudless 2016 (WMTS REST: TileMatrix/TileRow/TileCol = z/y/x). Only the 2016 layer is CC BY 4.0.
const SAT_URL='https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'; // layer title: "Sentinel-2 cloudless layer for 2016 by EOX - 3857"
// last resort when the satellite source above fails: NASA GIBS Blue Marble (≈500 m, z0–8, open; GIBS asks for acknowledgement)
const LO_URL='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';
/* High-resolution satellite: Esri World Imagery (about 0.3–1 m in Europe, Norway included), drawn over EOX.
   Needs an API key from a free ArcGIS Location Platform account (location.arcgis.com, not ArcGIS Online):
   Developer credentials → API key, privilege "Location services → Basemaps", referrers limited to the site
   (https://birdbird.eu/*). The monthly free tier is 2,000,000 basemap tiles; Location Platform includes a commercial
   deployment licence for public apps. Esri requires "Powered by Esri" and the data sources in the attribution (ATT.hi).
   Leave it empty to keep EOX Sentinel-2 cloudless 2016 (10 m) only. Like the openAIP key, it is visible in the page.
   localStorage 'bb-imagery-key' overrides it in one browser (for testing); the value 'off' turns it off.
   (Kartverket's Norge i bilder orthophotos are not used: access is reserved for Norge digitalt parties.) */
// owner's key (2026-11): public app, Basemap Styles + Static basemap tiles, referrers birdbird.eu / www / *.birdbird.pages.dev; expires 2027
const IMAGERY_KEY='AAPTaoK3SB8A-KrfERE0AaleapQ..lpVejDkDwt5LDu1rII1GEMUs4BdlVLmuki7dcHCszyIzOiPja54cKtzZ0AZU-Mla-srhHvxHVpESdXQbFVvgO9nkXc_2fYrAT9MtBZDAant9ZrqA_k6XGay6g7j1RMUyCbkT92Hkc7tjRTGPLDzyPkMh7-FD5BZqyJlmPnACo_Qcpz3s5ivTSkngBf0olVepAPCb6nOzV90c7iP6rfijgZjJejfTDdBTgjxnUHTvVutI7jFQ4xrwAT1_BviSZTam';
const HI_URL='https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=';
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
  sat:A('https://s2maps.eu','Sentinel-2 cloudless – https://s2maps.eu')+' by '+A('https://eox.at','EOX IT Services GmbH')+' (Contains modified Copernicus Sentinel data 2016)',
  hi:'Powered by '+A('https://www.esri.com','Esri')+' | Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  lo:'Imagery: '+A('https://www.earthdata.nasa.gov/gibs','NASA GIBS')+' (Blue Marble)',
  topo:A('https://www.kartverket.no/','© Kartverket'),
  nav:'Airports, navaids: '+A('https://ourairports.com/data/','OurAirports'),
  oaip:'Airspace, VFR points, obstacles: '+A('https://www.openaip.net','© openAIP')+' ('+A('https://creativecommons.org/licenses/by-nc/4.0/','CC BY-NC 4.0')+')'
};
// chart-room palette (site.css: --paper #EDF1EE, --sheet #FFF, --ink #13202A, --accent #9A1E68, --info #1D4E9E)
// modern palette (2026-11): cooler neutral land, clear blue water, quiet greys for roads and borders; airports in Birdbird navy-blue
const P={land:'#F1F3F1',water:'#CFE1EC',coast:'#9DB9CC',waterLine:'#B3CDDD',wood:'#DFE8DC',park:'#E3EBE0',ice:'#F9FBFC',resid:'#E6E7E4',bldg:'#DCDDD8',aero:'#DEE1E3',runway:'#B9BEC3',
  border:'#8E97A3',state:'#C5CBD2',road:'#E2E4E6',roadMaj:'#D6DADF',rail:'#CDD1D5',ink:'#0B2545',ink2:'#435466',ink3:'#6B7A88',halo:'rgba(250,251,250,.94)',waterLbl:'#4E7896',peak:'#4A5562',
  accent:'#9A1E68',info:'#1D4E9E',ap:'#1F4E8C',vor:'#24706A',ndb:'#7A6440',aip:'#7D93A3'};
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
  vfr:{water:{'fill-color':'#BCD7E8','line-color':'#9EC1D8'},coast:{'line-color':'#7FA4BE'},
    urban:{'fill-color':'#E6D9B8','fill-opacity':['match',['get','class'],URB,0.6,0]},ice:{'fill-opacity':0.55}},
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
/* modern VFR tints: soft sage lowland, pale green-grey hills, light stone and cool grey on the fjells, white on top.
   Same breakpoints as before, so lowland, valleys, fjells and the big massifs still read differently. */
const TINT_VFR=['interpolate',['linear'],['elevation'],
  -1,'rgba(0,0,0,0)', 0,'rgba(205,224,200,0)', 1,'rgb(205,224,200)',
  100,'rgb(212,228,204)', 250,'rgb(221,232,210)', 450,'rgb(229,234,218)', 650,'rgb(233,233,222)',
  850,'rgb(229,228,219)', 1050,'rgb(222,221,213)', 1300,'rgb(212,212,207)', 1550,'rgb(202,204,203)',
  1800,'rgb(196,200,203)', 2050,'rgb(210,214,218)', 2300,'rgb(230,233,236)', 2700,'rgb(246,247,248)', 5000,'rgb(255,255,255)'];
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
    const lab=(g,c,h)=>{ if(L.layout&&L.layout['icon-image']&&g!=='peak'){ L.layout=Object.assign({},L.layout); ['icon-image','icon-size','icon-offset','icon-anchor','icon-optional'].forEach(k=>delete L.layout[k]); if(L.paint) ['icon-color','icon-halo-color','icon-halo-width','icon-opacity'].forEach(k=>delete L.paint[k]); } return keep(g,{'text-color':c,'text-halo-color':h,'text-halo-width':1.3,'text-halo-blur':0}); };
    if(sl==='place') return lab('label',['match',['get','class'],['city','capital'],P.ink,'town','#22364D','country',P.ink2,'state',P.ink3,'#4E5F70'],P.halo);
    if(sl==='water_name'||sl==='waterway') return lab('waterlabel',P.waterLbl,'rgba(232,240,245,.9)');
    if(sl==='transportation_name'){ L.minzoom=Math.max(L.minzoom||0,11); return lab('roadlabel','#8B8E8C','rgba(255,255,255,.9)'); }
    if(sl==='mountain_peak'){ L.minzoom=Math.max(L.minzoom||0,10); return lab('peak',P.peak,P.halo); }
    return null; // poi, housenumber, aerodrome labels (we draw our own airports)
  }
  return null; // raster, hillshade, fill-extrusion in the base style
}
// hillshade paint per basemap. vfr: multidirectional (light from NW plus soft fill light from W and N)
// lt = direction the main light comes from (° true, 315 = NW, the chart convention); the fill lights turn with it.
// Anchored to the map, so the shading does not swing round when the 3D camera turns.
function hillPaint(bm,lt){ const d=(lt==null?315:lt)-315, r=a=>((a+d)%360+360)%360;
  if(bm==='vfr') return {'hillshade-method':'multidirectional','hillshade-exaggeration':0.6,'hillshade-illumination-anchor':'map',
    'hillshade-illumination-direction':[r(315),r(270),r(0)],'hillshade-illumination-altitude':[40,50,50],
    'hillshade-shadow-color':['rgba(38,52,70,.5)','rgba(40,54,70,.2)','rgba(40,54,70,.2)'],
    'hillshade-highlight-color':['rgba(255,255,255,.45)','rgba(255,255,255,.12)','rgba(255,255,255,.12)']};
  // over satellite: imagery already has its own sun shading, so a low, cool key light and soft fill lights just
  // deepen the shaded slopes and lift the sunny ones enough for ridges, valleys and fjord sides to read in 3D
  if(bm==='sat') return {'hillshade-method':'multidirectional','hillshade-exaggeration':0.5,'hillshade-illumination-anchor':'map',
    'hillshade-illumination-direction':[r(315),r(255),r(15)],'hillshade-illumination-altitude':[32,45,45],
    'hillshade-shadow-color':['rgba(12,22,38,.5)','rgba(16,26,40,.2)','rgba(16,26,40,.2)'],
    'hillshade-highlight-color':['rgba(255,246,226,.16)','rgba(255,255,255,.05)','rgba(255,255,255,.05)']};
  const o={'hillshade-illumination-anchor':'map','hillshade-illumination-direction':r(315)};
  if(bm==='ifr') return Object.assign(o,{'hillshade-exaggeration':0.22,'hillshade-shadow-color':'rgba(60,66,70,.28)','hillshade-highlight-color':'rgba(255,255,255,.12)','hillshade-accent-color':'rgba(60,66,70,.08)'});
  if(bm==='terrain') return Object.assign(o,{'hillshade-exaggeration':0.6,'hillshade-shadow-color':'rgba(74,58,40,.55)','hillshade-highlight-color':'rgba(255,253,240,.35)','hillshade-accent-color':'rgba(90,72,50,.22)'});
  return Object.assign(o,{'hillshade-exaggeration':0.4,'hillshade-shadow-color':'rgba(84,70,50,.42)','hillshade-highlight-color':'rgba(255,253,244,.28)','hillshade-accent-color':'rgba(90,76,56,.14)'});
}
/* atmosphere in 3D: blue-grey aerial haze that thickens toward the horizon, so ridges behind ridges step back.
   fog-ground-blend: where the fog starts on the ground, 0 = map centre … 1 = horizon. */
function skyFor(bm){
  if(bm==='sat') return {'sky-color':'#7FA7CF','horizon-color':'#DCE6EE','fog-color':'#BCCBD8','sky-horizon-blend':0.75,'horizon-fog-blend':0.75,'fog-ground-blend':0.45,'atmosphere-blend':0};
  if(bm==='topo') return {'sky-color':'#A9C6DF','horizon-color':'#E6EDF1','fog-color':'#DDE5EA','sky-horizon-blend':0.7,'horizon-fog-blend':0.65,'fog-ground-blend':0.5,'atmosphere-blend':0};
  return {'sky-color':'#AFCBE2','horizon-color':'#E9EFF1','fog-color':'#E3EAED','sky-horizon-blend':0.7,'horizon-fog-blend':0.6,'fog-ground-blend':0.5,'atmosphere-blend':0};
}
function imgKey(){ let k=IMAGERY_KEY; try{ const s=localStorage.getItem('bb-imagery-key'); if(s) k=s==='off'?'':s; }catch(e){} return String(k||'').trim(); }
/* Pixel ratio: sharp on retina without paying for it in frame rate. Capped at 2, which is already one image pixel per
   device pixel on most laptops and 2.25× fewer pixels to draw than 3 on phones; 3 only on high-end devices
   (≥ 8 GB memory and ≥ 8 cores reported). The canvas may be as large as the GPU allows (MapLibre's default stops at 4096 px). */
let GLMAX=null;
function glMax(){ if(GLMAX) return GLMAX; let m=4096; try{ const c=document.createElement('canvas'), g=c.getContext('webgl2')||c.getContext('webgl');
    if(g){ const v=g.getParameter(g.MAX_VIEWPORT_DIMS)||[4096,4096]; m=Math.min(g.getParameter(g.MAX_RENDERBUFFER_SIZE)||4096,v[0],v[1],g.getParameter(g.MAX_TEXTURE_SIZE)||4096); const x=g.getExtension('WEBGL_lose_context'); if(x) x.loseContext(); } }catch(e){}
  return GLMAX=Math.max(2048,Math.min(8192,m)); }
function dprOf(){ const d=window.devicePixelRatio||1, hi=(navigator.deviceMemory||0)>=8&&(navigator.hardwareConcurrency||0)>=8; return Math.max(1,Math.min(hi?3:2,d)); }
function buildStyle(base,o){
  const st=JSON.parse(JSON.stringify(base));
  const vid=Object.keys(st.sources||{}).find(k=>st.sources[k].type==='vector');
  if(!vid) throw new Error('style has no vector source');
  st.sources[vid].attribution=ATT.ofm;
  const out=[]; (st.layers||[]).forEach(L=>{ const r=restyle(L); if(r) out.push(r); });
  // relief from AWS Terrain Tiles; separate sources for hillshade and 3D terrain, as MapLibre recommends
  const dem={type:'raster-dem',tiles:[DEM_URL],encoding:'terrarium',tileSize:256,maxzoom:15,attribution:ATT.dem};
  st.sources['bb-dem']=Object.assign({},dem); st.sources['bb-demh']=Object.assign({},dem);
  /* Satellite tiles are 256 px. On dpr ≥ 1.5 they are declared 128 so the map asks for the next zoom level: one image
     pixel per device pixel in 2D, and in 3D one per pixel of the 1024 px texture MapLibre drapes over each 512 px
     terrain tile. EOX stops at z13 (its 10 m data); Esri goes to z18 (≈0.3 m/px at 60° N, beyond that it is upscaled). */
  const hd=dprOf()>=1.5, ts=hd?128:256, key=o&&o.imgKey!=null?o.imgKey:imgKey();
  st.sources['bb-sat']={type:'raster',tiles:[SAT_URL],tileSize:ts,minzoom:0,maxzoom:13,attribution:ATT.sat};
  st.sources['bb-satlo']={type:'raster',tiles:[LO_URL],tileSize:256,minzoom:0,maxzoom:8,attribution:ATT.lo};
  if(key) st.sources['bb-sathi']={type:'raster',tiles:[HI_URL+encodeURIComponent(key)],tileSize:ts,minzoom:0,maxzoom:18,attribution:ATT.hi};
  st.sources['bb-topo']={type:'raster',tiles:[TOPO_URL],tileSize:256,minzoom:0,maxzoom:18,attribution:ATT.topo,bounds:[-10,53,42,82]};
  const wi=out.findIndex(l=>l.metadata['bb:g']==='water'); const at=wi>=0?wi:1;
    const reliefV={id:'bb-reliefv',type:'color-relief',source:'bb-demh',metadata:{'bb:g':'reliefv'},layout:{visibility:'none'},paint:{'color-relief-opacity':lin(5,0.9,12,0.75),'color-relief-color':TINT_VFR}};
  const relief={id:'bb-relief',type:'color-relief',source:'bb-demh',metadata:{'bb:g':'relief'},layout:{visibility:'none'},paint:{'color-relief-opacity':0.8,'color-relief-color':TINT_TER}};
  const hillM={id:'bb-hillm',type:'hillshade',source:'bb-demh',metadata:{'bb:g':'hillm'},layout:{visibility:'none'},paint:hillPaint('vfr')};
  const hill={id:'bb-hill',type:'hillshade',source:'bb-demh',metadata:{'bb:g':'hill'},layout:{visibility:'none'},paint:hillPaint('chart')};
  out.splice(at,0,reliefV,relief,hillM,hill);
  // linear resampling: past a source's maxzoom the photo is magnified smoothly (nearest would show square pixels)
  const sat={id:'bb-sat',type:'raster',source:'bb-sat',metadata:{'bb:g':'sat'},layout:{visibility:'none'},paint:{'raster-fade-duration':150,'raster-resampling':'linear'}};
  const sathi=key?[{id:'bb-sathi',type:'raster',source:'bb-sathi',metadata:{'bb:g':'sathi'},layout:{visibility:'none'},paint:{'raster-fade-duration':150,'raster-resampling':'linear'}}]:[];
  const hills={id:'bb-hills',type:'hillshade',source:'bb-demh',metadata:{'bb:g':'hills'},layout:{visibility:'none'},paint:hillPaint('sat')};
  const satlo={id:'bb-satlo',type:'raster',source:'bb-satlo',metadata:{'bb:g':'satlo'},layout:{visibility:'none'},paint:{'raster-fade-duration':150,'raster-resampling':'linear'}};
  out.splice(1,0,satlo,sat,...sathi,hills);
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
      /* sharpness: pixel ratio (dprOf), a canvas up to the GPU limit, antialiasing, anisotropic filtering when pitched.
         speed: no world copies, short label fade, and a tile cache that keeps the tiles just flown past (6 zoom levels of
         screens, at most 400 tiles per source; 5 levels / 160 tiles on phones) without holding hundreds of MB of textures. */
      const small=Math.min(screen.width||9999,screen.height||9999)<700;
      try{ map=new maplibregl.Map({container,style,center:o.center||[10,60],zoom:o.zoom==null?4:o.zoom,minZoom:2,maxZoom:17.5,maxPitch:85,attributionControl:false,dragRotate:false,pitchWithRotate:false,
        touchPitch:false,fadeDuration:150,canvasContextAttributes:{antialias:true},cooperativeGestures:false,refreshExpiredTiles:false,renderWorldCopies:false,
        locale:/^nb|^no/.test(document.documentElement.lang||'')?{'AttributionControl.ToggleAttribution':'Vis eller skjul kildene','AttributionControl.MapFeedback':'Tilbakemelding på kartet','ScaleControl.Meters':'m','ScaleControl.Kilometers':'km'}:undefined,pixelRatio:dprOf(),maxCanvasSize:[glMax(),glMax()],maxTileCacheZoomLevels:small?5:6,maxTileCacheSize:small?160:400,anisotropicFilterPitch:20}); }
      catch(e){ return fail(e); }
      map.touchZoomRotate.disableRotation();
      // gestures: a little more glide after a drag, and wheel zoom that answers each notch promptly
      // (route.html re-enables dragPan after holds; the wrapper keeps these inertia settings)
      try{ const PAN={linearity:0.25,maxSpeed:1600,deceleration:2200}, pe=map.dragPan.enable.bind(map.dragPan); map.dragPan.enable=x=>pe(x||PAN); map.dragPan.enable();
        map.scrollZoom.setWheelZoomRate(1/360); map.scrollZoom.setZoomRate(1/80); }catch(e){}
      map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:ATT.nav}),'bottom-right');
      const sc=new maplibregl.ScaleControl({unit:'nautical',maxWidth:110}); map.addControl(sc,'bottom-right');
      // narrow screens: attribution starts folded behind its (i) button; it opens on tap
      if(container.clientWidth<640) setTimeout(()=>{ const a=container.querySelector('.maplibregl-ctrl-attrib'); if(a){ a.classList.remove('maplibregl-compact-show'); a.removeAttribute('open'); } },0);
      map.__bb={bm:'vfr',relief:'on',ly:{},vid:style.metadata['bb:vid'],ex:1.5,t3:false,oaip:'none',lt:315,sc,satBad:{}};
      satWatch(map,lg);
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
const SKIP=new Set(['hill','hillm','hills','relief','reliefv','ct','sat','sathi','satlo']);
function setBasemap(map,bm){ if(!BASEMAPS.includes(bm)) bm='vfr';
  if(bm==='sat'&&map.__bb.satBad&&!satActive(map)){ bm='vfr'; setTimeout(()=>{ try{ map.getContainer().dispatchEvent(new CustomEvent('bb-satfail')); }catch(_){} },0); }
  map.__bb.bm=bm; const v=VIS[bm];
  eachBase(map,(L,g)=>{ if(SKIP.has(g)) return; const on=g in v?!!v[g]:true; map.setLayoutProperty(L.id,'visibility',on?'visible':'none');
    const ks=BMPK[g]; if(!ks) return; const ch=map.__bb.ch||(map.__bb.ch={}); const o=ch[L.id]||(ch[L.id]={});
    ks.forEach(k=>{ if(!fits(k,L.type)) return; if(!(k in o)) o[k]=map.getPaintProperty(L.id,k); const want=BMP[bm]&&BMP[bm][g]&&k in BMP[bm][g]?BMP[bm][g][k]:o[k]; map.setPaintProperty(L.id,k,want); }); });
  // satellite: Esri World Imagery when the key works, otherwise EOX Sentinel-2 (only one is loaded)
  const act=bm==='sat'?satActive(map):null; SAT_CHAIN.forEach(id=>vis(map,id,id===act));
  map.setPaintProperty('bb-sat','raster-opacity',1);
  applyRelief(map); if(map.__bb.t3) setSky(map); }
function setRelief(map,mode){ map.__bb.relief=mode==='off'?'off':'on'; applyRelief(map); }
/* Satellite: the first source in the chain that works is shown, so the map is never blank. Esri (with a key) → EOX 2016
   → NASA Blue Marble. A source is dropped after a refused key (401/403/498/499) or when its tiles keep failing
   (≥ 6 errors and more errors than 3 × loaded tiles, or 4 errors before any tile loaded: a CORS block, an outage, a rate limit); a short note says so. */
const SAT_CHAIN=['bb-sathi','bb-sat','bb-satlo'];
const SAT_NAME={'bb-sathi':'Esri World Imagery','bb-sat':'EOX Sentinel-2','bb-satlo':'NASA Blue Marble'};
function satActive(map){ const b=map.__bb.satBad||(map.__bb.satBad={}); return SAT_CHAIN.find(id=>map.getLayer(id)&&!b[id])||null; }
function satWatch(map,lg){ const n={};
  map.on('data',e=>{ if(e.dataType==='source'&&e.tile&&SAT_CHAIN.includes(e.sourceId)) (n[e.sourceId]||(n[e.sourceId]={ok:0,err:0})).ok++; });
  map.on('error',e=>{ const id=e&&e.sourceId; if(!SAT_CHAIN.includes(id)||map.__bb.satBad[id]) return; const c=n[id]||(n[id]={ok:0,err:0}), st=e.error&&e.error.status; c.err++;
    if(!([401,403,498,499].includes(st)||(c.err>=6&&c.err>3*c.ok)||(c.err>=4&&!c.ok))) return;
    const was=satActive(map); map.__bb.satBad[id]=st||'errors'; const now=satActive(map);
    const why=st||String(e.error&&e.error.message||'errors').slice(0,80), to=now?SAT_NAME[now]:'the chart';
    lg('satellite '+SAT_NAME[id]+' failed ('+why+'): using '+to); try{ console.warn('Route Explorer: '+SAT_NAME[id]+' tiles failed ('+why+'), using '+to); }catch(_){}
    if(was!==id) return; const onSat=map.__bb.bm==='sat';
    if(now){ setBasemap(map,map.__bb.bm); if(onSat) satNote(map,id,now); }
    // nothing left: the page switches to the VFR chart (route.html listens), so the map is never blank
    else { if(onSat) satNote(map,id,null); try{ map.getContainer().dispatchEvent(new CustomEvent('bb-satfail')); }catch(_){} if(map.__bb.bm==='sat') setBasemap(map,'vfr'); } }); }
function satNote(map,bad,now){ const c=map.getContainer(); let d=c.querySelector('.bb-satnote'); if(!d){ d=document.createElement('div'); d.className='bb-satnote'; d.setAttribute('role','status'); c.appendChild(d); }
  const no=/^nb|^no/.test(document.documentElement.lang||'');
  const lo=now==='bb-satlo'?(no?' (lav oppløsning)':' (low resolution)'):'', to=now?SAT_NAME[now]+lo:(no?'VFR-kartet':'the VFR chart');
  d.innerHTML=(no?'Satellittbilder fra '+SAT_NAME[bad]+' lastes ikke. Viser '+to+'.':'Satellite imagery from '+SAT_NAME[bad]+' is not loading. Showing '+to+' instead.')+' <button type="button" aria-label="Close">×</button>';
  d.querySelector('button').onclick=()=>d.remove(); clearTimeout(d._t); d._t=setTimeout(()=>d.remove(),12000); }
// direction the light comes from, ° true (315 = NW)
function setLight(map,deg){ map.__bb.lt=((+deg||0)%360+360)%360; applyRelief(map); }
const vis=(map,id,on)=>{ if(map.getLayer(id)) map.setLayoutProperty(id,'visibility',on?'visible':'none'); };
const paint=(map,id,p)=>{ if(map.getLayer(id)) Object.keys(p).forEach(k=>map.setPaintProperty(id,k,p[k])); };
function applyRelief(map){ const bm=map.__bb.bm, on=map.__bb.relief!=='off', lt=map.__bb.lt;
  vis(map,'bb-reliefv',on&&bm==='vfr'); vis(map,'bb-relief',on&&bm==='terrain'); vis(map,'bb-hillm',on&&bm==='vfr'); const hs=on&&bm==='sat'&&map.__bb.t3; vis(map,'bb-hills',hs); // over satellite only in 3D: in 2D the photo shows the relief, and no DEM is fetched
  if(on&&bm==='vfr') paint(map,'bb-hillm',hillPaint('vfr',lt)); if(hs) paint(map,'bb-hills',hillPaint('sat',lt));
  const std=on&&['chart','terrain','ifr'].includes(bm); vis(map,'bb-hill',std);
  if(std) paint(map,'bb-hill',hillPaint(bm,lt));
  const ct=!!(map.__bb.ly&&map.__bb.ly.ct)&&RELIEF_BM.includes(bm); vis(map,'bb-ct',ct); vis(map,'bb-ctl',ct);
  if(map.getLayer('bb-ct')){ const c=ctPaint(bm); Object.keys(c.l).forEach(k=>map.setPaintProperty('bb-ct',k,c.l[k])); Object.keys(c.t).forEach(k=>map.setPaintProperty('bb-ctl',k,c.t[k])); } }
function set3D(map,on,ex){ map.__bb.t3=!!on; if(ex) map.__bb.ex=ex; applyRelief(map);
  /* the scale bar unprojects screen points on every camera move; with terrain that is a synchronous GPU read-back
     (readPixels) that stalls each frame, and a scale means little in a perspective view: 2D only */
  const sc=map.__bb.sc; try{ if(on&&sc&&map.hasControl(sc)) map.removeControl(sc); else if(!on&&sc&&!map.hasControl(sc)) map.addControl(sc,'bottom-right'); }catch(e){}
  if(on){ map.setTerrain({source:'bb-dem',exaggeration:map.__bb.ex}); setSky(map);
    map.dragRotate.enable(); map.touchZoomRotate.enableRotation(); map.touchPitch.enable(); }
  else { map.setTerrain(null); map.dragRotate.disable(); map.touchZoomRotate.disableRotation(); map.touchPitch.disable(); }
  map.triggerRepaint(); }
function setSky(map){ try{ map.setSky(skyFor(map.__bb.bm)); }catch(e){} }
function exag(map){ const t=map.getTerrain&&map.getTerrain(); return t?(t.exaggeration||1):0; }

/* contour lines in feet, computed in the browser from the same AWS DEM tiles (maplibre-contour, BSD-3) */
function ctPaint(bm){ const c=bm==='ifr'?'rgba(110,118,124,':'rgba(92,104,116,';
  return {l:{'line-color':['match',['get','level'],1,c+(bm==='ifr'?'.32)':'.42)'),c+(bm==='ifr'?'.18)':'.24)')]},t:{'text-color':bm==='ifr'?'#7A848A':'#56636F'}}; }
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
/* openAIP point layers from the same vector tiles. Field names as in openAIP's own style (openaip-map-resources,
   resources/layers/layers.js): every layer has 'type'; reporting_points 'name' (type compulsory | request);
   obstacles name_label / name_label_full (the label carries the height); airports icao_code, name_label,
   name_label_full (types as in its sprites: af_civil, heli_civil, gliding, af_water, ad_mil, ad_closed …);
   navaids identifier, name_label_full (ident and frequency). openAIP airports with an ICAO code are left to OurAirports. */
const OAG={rp:['bb-oa-rp'],ob:['bb-oa-ob'],oa:['bb-oa-ap'],on:['bb-oa-nv'],hs:['bb-oa-hs'],hg:['bb-oa-hg'],rc:['bb-oa-rc']};
function oaLayers(src){ const s=n=>({source:src,'source-layer':n}), g=k=>['coalesce',['get',k],''], tx=(c)=>({'text-color':c,'text-halo-color':'rgba(255,255,255,.94)','text-halo-width':1.5});
  const sym=(id,n,mz,layout,paint,filter)=>Object.assign({id,type:'symbol',minzoom:mz,layout:Object.assign({visibility:'none','text-font':FONT_R,'text-size':10.5,'text-optional':true,'icon-allow-overlap':true},layout),paint},filter?{filter}:{},s(n));
  // zoom thresholds and label steps as in openAIP's layers.js
  const dot=(id,n,c,mz)=>sym(id,n,mz,{'icon-image':'bb-oa-f','icon-size':0.8,'text-field':['step',['zoom'],g('name_label'),13,['coalesce',['get','name_label_full'],['get','name_label'],'']],'text-offset':[0.8,0],'text-anchor':'left'},tx(c));
  return [
    sym('bb-oa-ob','obstacles',11,{'icon-image':['match',['get','type'],'wind_turbine','bb-ob-wt','bb-ob'],'icon-anchor':'bottom','text-field':['step',['zoom'],g('name_label'),13,['coalesce',['get','name_label_full'],['get','name_label'],'']],'text-size':9.5,'text-anchor':'top','text-offset':[0,0.2]},tx('#2B3440')),
    sym('bb-oa-ap','airports',8,{'icon-image':['match',['get','type'],['heli_civil','heli_mil'],'bb-oa-h','gliding','bb-oa-g','af_water','bb-oa-w','ad_mil','bb-oa-m','ad_closed','bb-oa-x','bb-oa-f'],
      'text-field':['step',['zoom'],g('name_label'),10,['coalesce',['get','name_label_full'],['get','name_label'],'']],'text-offset':[0.9,0],'text-anchor':'left'},tx('#1F4E8C'),['!',['has','icao_code']]),
    sym('bb-oa-nv','navaids',6,{'icon-image':['match',['get','type'],'ndb','bb-ndb','bb-vor'],'text-field':['step',['zoom'],g('identifier'),9,['coalesce',['get','name_label_full'],['get','identifier'],'']],'text-offset':[0.9,0.6],'text-anchor':'top-left'},tx('#24706A')),
    dot('bb-oa-hs','hotspots','#A0620A',8), dot('bb-oa-hg','hang_glidings','#3F6E3A',8), dot('bb-oa-rc','rc_airfields','#5B6C7C',10),
    sym('bb-oa-rp','reporting_points',8,{'icon-image':['match',['get','type'],'compulsory','bb-rp-c','bb-rp-r'],'icon-size':['interpolate',['linear'],['zoom'],8,0.8,10,1,13,1.25],'symbol-sort-key':0,'text-field':['step',['zoom'],'',9,g('name')],'text-font':FONT_B,'text-size':['interpolate',['linear'],['zoom'],9,11,13,13.5],'text-offset':[0.95,-0.05],'text-anchor':'left','text-optional':false,'text-allow-overlap':false},{'text-color':'#123E86','text-halo-color':'#fff','text-halo-width':2.2})
  ]; }
function addAirspace(map,cb){ const key=oaipKey(); cb=cb||(()=>{}); if(!key){ map.__bb.oaip='none'; cb('none'); return false; }
  if(map.getSource('bb-oaip')) return true;
  map.addSource('bb-oaip',{type:'vector',tiles:[OPENAIP_URL+encodeURIComponent(key)],minzoom:5,maxzoom:14,attribution:ATT.oaip});
  const before=map.getLayer('bb-mefg')?'bb-mefg':undefined; const Ls=asLayers('bb-oaip'); Ls.forEach(L=>map.addLayer(L,before)); map.__bb.asIds=Ls.map(L=>L.id); map.__bb.asF={}; Ls.forEach(L=>map.__bb.asF[L.id]=L.filter||null); map.__bb.oaip='ok';
  // openAIP points above the airspace, under the route
  const b2=map.getLayer('bb-leg-case')?'bb-leg-case':undefined; oaLayers('bb-oaip').forEach(L=>map.addLayer(L,b2));
  let errs=0; map.on('error',e=>{ if(map.__bb.oaip!=='ok') return; const er=e&&e.error, u=String((er&&er.url)||''), st=er&&er.status;
    if(e.sourceId!=='bb-oaip'&&!/openaip/.test(u)) return;
    if(st===401||st===403||++errs>12){ map.__bb.oaip='denied'; (map.__bb.asIds||[]).concat(...Object.values(OAG)).forEach(id=>vis(map,id,false)); cb('denied'); } });
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
  // openAIP points: VFR reporting points (filled triangle = compulsory, open = on request), obstacles, small airfields
  const RP='#123E86', OB='#2B3440', OA='#1F4E8C';
  icon(map,'bb-rp-c',20,19,g=>{ g.lineJoin='round'; g.beginPath(); g.moveTo(10,1.5); g.lineTo(18.5,17); g.lineTo(1.5,17); g.closePath(); g.strokeStyle='#fff'; g.lineWidth=3.2; g.stroke(); g.fillStyle=RP; g.fill(); });
  icon(map,'bb-rp-r',20,19,g=>{ g.lineJoin='round'; const t=()=>{ g.beginPath(); g.moveTo(10,2.2); g.lineTo(17.8,16.4); g.lineTo(2.2,16.4); g.closePath(); }; t(); g.strokeStyle='#fff'; g.lineWidth=5; g.stroke(); g.fillStyle='rgba(255,255,255,.95)'; g.fill(); t(); g.strokeStyle=RP; g.lineWidth=2.4; g.stroke(); g.beginPath(); g.arc(10,11.6,1.6,0,7); g.fillStyle=RP; g.fill(); });
  icon(map,'bb-ob',12,14,g=>{ g.beginPath(); g.moveTo(1.5,13); g.lineTo(6,1.5); g.lineTo(10.5,13); g.strokeStyle='#fff'; g.lineWidth=3; g.stroke(); g.strokeStyle=OB; g.lineWidth=1.4; g.stroke(); g.beginPath(); g.arc(6,10.6,1.3,0,7); g.fillStyle=OB; g.fill(); });
  icon(map,'bb-ob-wt',14,16,g=>{ g.lineCap='round'; const bl=()=>{ g.beginPath(); g.moveTo(7,15); g.lineTo(7,6); for(let a=0;a<3;a++){ const t=-Math.PI/2+a*2*Math.PI/3; g.moveTo(7,6); g.lineTo(7+5*Math.cos(t),6+5*Math.sin(t)); } }; bl(); g.strokeStyle='#fff'; g.lineWidth=3; g.stroke(); bl(); g.strokeStyle=OB; g.lineWidth=1.3; g.stroke(); });
  const ad=(name,mark)=>icon(map,name,14,14,g=>{ g.beginPath(); g.arc(7,7,5.4,0,7); g.fillStyle='#fff'; g.fill(); g.strokeStyle=OA; g.lineWidth=1.4; g.stroke(); g.strokeStyle=OA; g.fillStyle=OA; g.lineWidth=1.3; mark(g); });
  ad('bb-oa-f',g=>{ g.beginPath(); g.arc(7,7,1.6,0,7); g.fill(); });
  ad('bb-oa-h',g=>{ g.font='bold 7.5px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('H',7,7.4); });
  ad('bb-oa-g',g=>{ g.beginPath(); g.moveTo(2.6,6.2); g.quadraticCurveTo(7,8.6,11.4,6.2); g.stroke(); });
  ad('bb-oa-w',g=>{ g.beginPath(); g.moveTo(3,7.5); g.quadraticCurveTo(5,5.5,7,7.5); g.quadraticCurveTo(9,9.5,11,7.5); g.stroke(); });
  ad('bb-oa-m',g=>{ g.beginPath(); g.arc(7,7,3,0,7); g.stroke(); });
  ad('bb-oa-x',g=>{ g.beginPath(); g.moveTo(4.2,4.2); g.lineTo(9.8,9.8); g.moveTo(9.8,4.2); g.lineTo(4.2,9.8); g.stroke(); });
  [['n','#13202A'],['a','#B86E00'],['r','#B3261E']].forEach(([k,c])=>icon(map,'bb-crit-'+k,18,16,g=>{ g.beginPath(); g.moveTo(9,1.5); g.lineTo(16.5,14.5); g.lineTo(1.5,14.5); g.closePath(); g.fillStyle='#fff'; g.fill(); g.strokeStyle=c; g.lineWidth=2; g.lineJoin='round'; g.stroke(); }));
}
const FC={type:'FeatureCollection',features:[]};
const WXC={VFR:'#2E7D32',MVFR:'#1D4E9E',IFR:'#C62828',LIFR:'#C2189B'};
const SRC=['bb-mef','bb-mefg','bb-awy','bb-ap','bb-wx','bb-nv','bb-fx','bb-my','bb-note','bb-leg','bb-rpt','bb-crit','bb-hov','bb-snap'];
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
  // METAR flight category: a coloured ring around the airport (VFR green, MVFR blue, IFR red, LIFR magenta), under the airport and route symbols
  add({id:'bb-wx',type:'circle',source:'bb-wx',layout:{visibility:'none'},paint:{'circle-radius':lin(4,5.5,10,10),'circle-color':['match',['get','fc'],'VFR',WXC.VFR,'MVFR',WXC.MVFR,'IFR',WXC.IFR,'LIFR',WXC.LIFR,'#8A97A2'],'circle-opacity':0.2,'circle-stroke-color':['match',['get','fc'],'VFR',WXC.VFR,'MVFR',WXC.MVFR,'IFR',WXC.IFR,'LIFR',WXC.LIFR,'#8A97A2'],'circle-stroke-width':lin(4,2,10,2.8),'circle-pitch-alignment':'map'}});
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
const LYG={wx:['bb-wx'],ap:['bb-ap0','bb-ap1','bb-ap2','bb-ap2r','bb-apl0','bb-apl1','bb-apl2'],nv:['bb-nv'],fx:['bb-fx'],my:['bb-my'],nt:['bb-note'],mef:['bb-mef','bb-mefg'],awy:['bb-awy']};
/* airspace sub-groups the user can switch off one by one (default on); 'other' with an ICAO class rides with TMA/CTA */
const ASG={asCtr:['ctr'],asTma:['tma','cta','other'],asRes:['restricted','danger','prohibited'],asTiz:['tiz','tia','rmz','tmz'],asAtz:['atz','matz','htz'],asTra:['tra','tsa','tfa','tfr','alert','warning','protected']};
function asTypes(map,LY){ const on=[]; Object.keys(ASG).forEach(k=>{ if(LY[k]!==0) on.push(...ASG[k]); }); const key=on.join(','); if(map.__bb.asK===key) return; map.__bb.asK=key;
  const tf=on.length?['match',['get','type'],on,true,false]:['==',1,0];
  (map.__bb.asIds||[]).forEach(id=>{ if(!map.getLayer(id)) return; const b=(map.__bb.asF||{})[id]; map.setFilter(id,b?['all',b,tf]:tf); }); }
function setGroups(map,LY){ map.__bb.ly=Object.assign({},LY);
  const oaNav=!!LY.on&&map.__bb.oaip==='ok';
  Object.keys(LYG).forEach(k=>{ const on=k==='awy'?true:k==='nv'?!!LY.nv&&!oaNav:!!LY[k]; LYG[k].forEach(id=>vis(map,id,on)); });
  const as=!!LY.as&&map.__bb.oaip==='ok'; (map.__bb.asIds||[]).forEach(id=>vis(map,id,as));
  if(as) asTypes(map,LY);
  Object.keys(OAG).forEach(k=>OAG[k].forEach(id=>vis(map,id,!!LY[k]&&map.__bb.oaip==='ok')));
  applyRelief(map); }
function setData(map,id,fc){ const s=map.getSource(id); if(s) s.setData(fc||FC); }
const HITL=['bb-wx','bb-ap0','bb-ap1','bb-ap2','bb-nv','bb-fx','bb-my','bb-note','bb-oa-rp','bb-oa-ap','bb-oa-nv','bb-oa-ob'];
// the nearest clickable aviation feature within r CSS px
function hit(map,x,y,r){ const L=HITL.filter(id=>map.getLayer(id)&&map.getLayoutProperty(id,'visibility')!=='none');
  const fs=map.queryRenderedFeatures([[x-r,y-r],[x+r,y+r]],{layers:L}); let best=null, bd=r;
  fs.forEach(f=>{ const c=f.geometry&&f.geometry.coordinates; if(!c) return; const p=map.project(c); const dy=f.layer.id==='bb-note'?14:0; const d=Math.hypot(p.x-x,p.y-dy-y); if(d<bd){ bd=d;
    const oa=/^bb-oa-/.test(f.layer.id), q=f.properties; best=oa?{x:p.x,y:p.y,k:'oa',o:{kind:f.layer.id.slice(6),type:q.type||'',n:q.name||q.identifier||q.icao_code||q.name_label||'',full:q.name_label_full||q.name||'',la:c[1],lo:c[0]}}:{x:p.x,y:p.y-dy,k:q.k,i:q.i}; } }); return best; }
// airspace under a screen point (for the info panel)
function airspaceAt(map,x,y){ if(map.__bb.oaip!=='ok'||!map.getLayer('bb-as-tma')) return []; const ids=(map.__bb.asIds||[]).filter(id=>map.getLayer(id)&&map.getLayoutProperty(id,'visibility')!=='none'&&/-(ctrf|pf)$/.test(id)===false);
  let fs=[]; try{ fs=map.queryRenderedFeatures([[x-3,y-3],[x+3,y+3]],{layers:ids}); }catch(e){} const seen={}; return fs.map(f=>f.properties).filter(p=>{ const k=(p.name||'')+p.type; if(seen[k]) return false; seen[k]=1; return true; }); }

/* ---------- airspace along the route (for the vertical profile) ----------
   Reads the openAIP 'airspaces' features from the tiles MapLibre has loaded (querySourceFeatures: only loaded tiles,
   so the caller says when part of the route is outside the view). A polygon that crosses tiles comes back as one clipped
   piece per tile: pieces are grouped by name + type + limits and the route is tested against their union, so the
   entry and exit distances are those of the whole airspace. posAt(x) gives {la,lo} at x NM along the route.
   Limits: value/unit/reference datum as strings (ft | m | FL; GND | MSL | STD) or openAIP's numeric codes
   (unit 0 m, 1 ft, 6 FL; datum 0 GND, 1 MSL, 2 STD). FL is converted at 1013 hPa (FL95 = 9,500 ft). */
const UNIT={0:'M',1:'FT',6:'FL'}, DATUM={0:'GND',1:'MSL',2:'STD'};
function limOf(q,pre){ let v=q[pre+'_value']; if(v==null||v==='') return null; v=+v; if(!Number.isFinite(v)) return null;
  let u=q[pre+'_unit'], d=q[pre+'_reference_datum']; u=typeof u==='number'?UNIT[u]:String(u||'FT').toUpperCase(); d=typeof d==='number'?DATUM[d]:String(d||'MSL').toUpperCase(); if(d==='SFC') d='GND';
  const ft=u==='FL'?v*100:u==='M'?v*3.28084:v;
  if(u==='FL'||d==='STD'){ const fl=Math.round(u==='FL'?v:v/100); return {ft:fl*100,agl:false,txt:'FL'+String(fl).padStart(fl<100?2:3,'0')}; }
  if(d==='GND') return ft<1?{ft:0,agl:true,gnd:true,txt:'GND'}:{ft:Math.round(ft),agl:true,txt:Math.round(ft)+' ft AGL'};
  if(ft>=60000) return {ft:Math.round(ft),agl:false,txt:'UNL'};
  return {ft:Math.round(ft),agl:false,txt:Math.round(ft)+' ft'}; }
const AS_TYPE={}; Object.keys(ASG).forEach(k=>ASG[k].forEach(t=>AS_TYPE[t]=k));
const AS_CLS=['A','B','C','D','E','F','G'];
function asCat(t,c){ return ['restricted','danger','prohibited'].includes(t)?'r':['tiz','tia','rmz','tmz','atz','matz','htz'].includes(t)?'m':ASG.asTra.includes(t)?'a':'b'; }
function ringsIn(rings,lo,la){ let ins=false; for(const r of rings){ for(let i=0,j=r.length-1;i<r.length;j=i++){ const xi=r[i][0], yi=r[i][1], xj=r[j][0], yj=r[j][1]; if(((yi>la)!==(yj>la))&&(lo<(xj-xi)*(la-yi)/(yj-yi)+xi)) ins=!ins; } } return ins; }
function asRoute(map,o){ const out={list:[],ok:false}; if(!map||map.__bb.oaip!=='ok'||!map.getSource('bb-oaip')) return out;
  const LY=map.__bb.ly||{}; if(!LY.as) { out.ok=true; return out; }
  let fs=[]; try{ fs=map.querySourceFeatures('bb-oaip',{sourceLayer:'airspaces'}); }catch(e){ return out; }
  const tot=o.total, step=Math.max(0.05,tot/1500), n=Math.ceil(tot/step); const P=new Float64Array((n+1)*2); let a0=90,a1=-90,b0=180,b1=-180;
  for(let i=0;i<=n;i++){ const q=o.posAt(Math.min(tot,i*step)); P[i*2]=q.lo; P[i*2+1]=q.la; a0=Math.min(a0,q.la); a1=Math.max(a1,q.la); b0=Math.min(b0,q.lo); b1=Math.max(b1,q.lo); }
  const G=new Map();
  fs.forEach(f=>{ const q=f.properties||{}, t=String(q.type||'').toLowerCase(), k=AS_TYPE[t]; if(!k||LY[k]===0) return;
    if(t==='other'&&!/^[abcd]$/i.test(String(q.icao_class||''))&&!(q.icao_class>=0&&q.icao_class<=3)) return;
    const g=f.geometry; if(!g) return; const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]; if(!polys.length) return;
    const lo=limOf(q,'lower_limit'), up=limOf(q,'upper_limit'); const key=[q.name||'',t,lo&&lo.txt,up&&up.txt].join('|');
    let e=G.get(key); if(!e){ const c=q.icao_class; e={key,name:String(q.name||t.toUpperCase()),type:t,k,cat:asCat(t),cls:typeof c==='number'?(AS_CLS[c]||''):(/^[a-g]$/i.test(String(c||''))?String(c).toUpperCase():''),lo,up,polys:[]}; G.set(key,e); }
    polys.forEach(pl=>{ let x0=180,x1=-180,y0=90,y1=-90; pl[0].forEach(c=>{ if(c[0]<x0) x0=c[0]; if(c[0]>x1) x1=c[0]; if(c[1]<y0) y0=c[1]; if(c[1]>y1) y1=c[1]; }); if(x1<b0||x0>b1||y1<a0||y0>a1) return; e.polys.push({r:pl,x0,x1,y0,y1}); }); });
  G.forEach(e=>{ if(!e.polys.length) return; const inside=(lo,la)=>e.polys.some(p=>lo>=p.x0&&lo<=p.x1&&la>=p.y0&&la<=p.y1&&ringsIn(p.r,lo,la));
    const edge=(xa,xb,wasIn)=>{ for(let k=0;k<7;k++){ const xm=(xa+xb)/2, q=o.posAt(xm); if(inside(q.lo,q.la)===wasIn) xa=xm; else xb=xm; } return (xa+xb)/2; };
    const iv=[]; let st=null, prev=false;
    for(let i=0;i<=n;i++){ const x=Math.min(tot,i*step), v=inside(P[i*2],P[i*2+1]);
      if(v&&!prev) st=i?edge((i-1)*step,x,false):0; if(!v&&prev) iv.push([st,edge((i-1)*step,x,true)]); prev=v; }
    if(prev) iv.push([st,tot]);
    if(iv.length) out.list.push({key:e.key,name:e.name,type:e.type,k:e.k,cat:e.cat,cls:e.cls,lo:e.lo,up:e.up,iv}); });
  out.list.sort((a,b)=>a.iv[0][0]-b.iv[0][0]); out.ok=true; return out; }
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
    // per frame: no allocations (matrices, projection scratch and DOM strings are reused); buffers re-upload only when the path changes
    M:new Float64Array(16), M32:new Float32Array(16), q:new Float64Array(2), q2:new Float64Array(2), g2:new Float64Array(2),
    hideAc(){ if(this.ac&&!this.ac.hidden) this.ac.hidden=true; if(this.dl&&!this.dl.hidden) this.dl.hidden=true; },
    // screen position (CSS px) of lat/lon/feet into out; false if behind the camera
    scr(la,lo,ft,ex,W,H,out){ const M=this.M; const x=(180+lo)/360-this.ox, y=(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+la*Math.PI/360)))/360-this.oy, z=ft*0.3048*ex; // Web Mercator 0…1
      const w=M[3]*x+M[7]*y+M[11]*z+M[15]; if(!(w>0)) return false;
      out[0]=((M[0]*x+M[4]*y+M[8]*z+M[12])/w+1)/2*W; out[1]=(1-(M[1]*x+M[5]*y+M[9]*z+M[13])/w)/2*H; return true; },
    css(e,k,v){ if(e._bb!==v){ e._bb=v; e.style[k]=v; } },
    render(gl,args){ const map=this.map, ex=exag(map); if(this.dirty) this.upload(gl);
      if(!this.n||!ex){ this.hideAc(); return; }
      const ws=map.transform.worldSize, M0=args.modelViewProjectionMatrix, M=this.M; // world: x,y in pixels at this zoom, z in metres
      // M = M0 · translate(ox·ws, oy·ws, 0) · scale(ws, ws, 1), done in double precision here
      const tx=this.ox*ws, ty=this.oy*ws;
      for(let r=0;r<4;r++){ M[r]=M0[r]*ws; M[4+r]=M0[4+r]*ws; M[8+r]=M0[8+r]; M[12+r]=M0[r]*tx+M0[4+r]*ty+M0[12+r]; }
      for(let i=0;i<16;i++) this.M32[i]=M[i];
      const lat=map.getCenter().lat, mpp=40075016.686*Math.cos(lat*Math.PI/180)/ws;
      gl.useProgram(this.pg); gl.uniformMatrix4fv(this.loc.m,false,this.M32); gl.uniform1f(this.loc.ex,ex); gl.uniform1f(this.loc.band,mpp*3.2);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.vb); const st=28; gl.enableVertexAttribArray(this.loc.p); gl.vertexAttribPointer(this.loc.p,3,gl.FLOAT,false,st,0); gl.enableVertexAttribArray(this.loc.k); gl.vertexAttribPointer(this.loc.k,1,gl.FLOAT,false,st,12); gl.enableVertexAttribArray(this.loc.c); gl.vertexAttribPointer(this.loc.c,3,gl.FLOAT,false,st,16);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
      gl.depthMask(false); gl.uniform1f(this.loc.a,0.32); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib1); gl.drawElements(gl.TRIANGLES,this.n1,gl.UNSIGNED_SHORT,0);
      // in the cockpit view the ribbon would sit right under the camera: the curtain, seen edge-on, shows the path ahead
      if(!(this.hov&&this.hov.hide)){ gl.depthMask(true); gl.uniform1f(this.loc.a,1); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib2); gl.drawElements(gl.TRIANGLES,this.n2,gl.UNSIGNED_SHORT,0); }
      gl.depthMask(true);
      gl.disableVertexAttribArray(this.loc.k); gl.disableVertexAttribArray(this.loc.c);
      // the aircraft at the hover/fly position: a DOM symbol turned to the track on screen, with a line down to the ground
      const h=this.hov, ac=this.ac; if(!h||!ac||h.hide){ this.hideAc(); return; }
      const W=map.transform.width, H=map.transform.height, p=this.q; // CSS px, without a DOM read (no forced layout per frame)
      if(!this.scr(h.la,h.lo,h.alt,ex,W,H,p)){ this.hideAc(); return; }
      let rot=0; if(h.tr!=null){ const t=h.tr*Math.PI/180, d=0.25/60, q=this.q2; if(this.scr(h.la+d*Math.cos(t),h.lo+d*Math.sin(t)/Math.cos(h.la*Math.PI/180),h.alt,ex,W,H,q)) rot=Math.atan2(q[0]-p[0],-(q[1]-p[1]))*180/Math.PI; }
      this.css(ac,'transform',`translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`); if(ac.hidden) ac.hidden=false;
      const dl=this.dl, g=this.g2;
      if(dl&&h.gnd!=null&&this.scr(h.la,h.lo,h.gnd,ex,W,H,g)){ const dx=g[0]-p[0], dy=g[1]-p[1], len=Math.hypot(dx,dy); this.css(dl,'height',len.toFixed(1)+'px'); this.css(dl,'transform',`translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px) rotate(${(Math.atan2(-dx,dy)*180/Math.PI).toFixed(1)}deg)`); const hd=len<3; if(dl.hidden!==hd) dl.hidden=hd; } else if(dl&&!dl.hidden) dl.hidden=true; }
  };
  return L;
}
/* ---------- prefetch tiles along the route (simulation buffering) ----------
   Fetches the tiles the flight cameras will ask for into the browser's HTTP cache, so MapLibre finds them there.
   pts: [{la,lo,x}] along the route (x = NM from the start). zc: the map zoom the camera uses near the aircraft.
   Imagery (active satellite source) and the hillshade DEM in a narrow corridor at the near-field zoom, a wider one two
   levels lower; terrain DEM and vector chart tiles at their own zooms. Ordered by distance along the route, so
   "ready to x NM" grows from the start. max caps the tile count per call (Esri bills per tile). */
function tileXY(la,lo,z){ const n=2**z, x=Math.floor((lo+180)/360*n), s=Math.sin(la*Math.PI/180), y=Math.floor((0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n); return [Math.max(0,Math.min(n-1,x)),Math.max(0,Math.min(n-1,y))]; }
function tileJobs(map,pts,zc){ const jobs=[], seen=new Set(), src=id=>map.getSource(id), url=(t,z,x,y)=>t.replace('{z}',z).replace('{x}',x).replace('{y}',y);
  const add=(id,dz,km,ts0)=>{ const S=src(id); if(!S||!S.tiles||!S.tiles[0]) return; const ts=ts0||S.tileSize||512, z=Math.max(0,Math.min(S.maxzoom==null?22:S.maxzoom,Math.floor(zc+Math.log2(512/ts))+dz));
    const r=km/111.32; pts.forEach(p=>{ const k=Math.cos(p.la*Math.PI/180)||1; const [x0,y1]=tileXY(p.la-r,p.lo-r/k,z), [x1,y0]=tileXY(p.la+r,p.lo+r/k,z);
      for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++){ const u=url(S.tiles[0],z,x,y); if(!seen.has(u)){ seen.add(u); jobs.push({u,x:p.x}); } } }); };
  const b=map.__bb; if(b.bm==='sat'){ const a=satActive(map); if(a){ add(a,0,2.5); add(a,-2,10); } }
  if(b.bm==='topo') add('bb-topo',0,2.5);
  add('bb-dem',-1,8,256); add('bb-demh',0,2.5); add(b.vid,0,6);
  jobs.sort((p,q)=>p.x-q.x); return jobs; }
function prefetch(map,pts,zc,o){ o=o||{}; const jobs=tileJobs(map,pts,zc).slice(0,o.max||900), n=jobs.length, ctl={n,done:0,readyX:0,abort:false}; let i=0, act=0;
  const ac=window.AbortController?new AbortController():null; ctl.stop=()=>{ ctl.abort=true; if(ac) ac.abort(); };
  const lowX=()=>{ ctl.readyX=i<n?((jobs[Math.max(0,i-act-1)]||{}).x||0):(pts.length?pts[pts.length-1].x:0); };
  ctl.promise=new Promise(res=>{ const next=()=>{ if(ctl.abort) return res(ctl); if(i>=n&&!act){ lowX(); return res(ctl); }
      while(act<(o.conc||6)&&i<n){ const j=jobs[i++]; act++; fetch(j.u,{mode:'cors',credentials:'same-origin',signal:ac&&ac.signal}).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null).then(()=>{ act--; ctl.done++; lowX(); if(o.onProgress) o.onProgress(ctl); next(); }); } };
    if(!n) return res(ctl); next(); });
  return ctl; }
// pts: the path (undefined = keep), hov: aircraft {la,lo,alt,tr,gnd,hide}
function setPath3D(map,pts,hov){ const L=map.getLayer('bb-path3d'); const impl=L&&(L.implementation||L); if(impl&&impl.set) impl.set(pts,hov); }

window.RXMAP={create,asRoute,limOf,WXC,satActive,OAG,prefetch,tileJobs,setBasemap,setRelief,setLight,set3D,addOverlays,addAirspace,addContours,airspaceAt,oaipKey,setGroups,setData,hit,setPath3D,exag,imgKey,BASEMAPS,ATT,P,
  urls:{style:STYLE_URL,dem:DEM_URL,sat:SAT_URL,hi:HI_URL,lo:LO_URL,topo:TOPO_URL,oaip:OPENAIP_URL}};
})();
