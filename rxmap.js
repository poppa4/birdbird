/* Birdbird Route Explorer: the MapLibre chart (rxmap.js)
   Loaded by route.html. Builds a calm aeronautical chart from OpenFreeMap vector tiles,
   relief and 3D from AWS Terrain Tiles, satellite from EOX Sentinel-2 cloudless 2016 and
   topo from Kartverket. If anything fails within the time limit, create() rejects and
   route.html keeps its own canvas map. */
(function(){
'use strict';
const STYLE_URL='https://tiles.openfreemap.org/styles/positron';
// AWS Terrain Tiles (terrarium): z/x/y
const DEM_URL='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
// EOX Sentinel-2 cloudless 2016 (WMTS REST: TileMatrix/TileRow/TileCol = z/y/x). Only the 2016 layer is CC BY 4.0.
const SAT_URL='https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg';
// Kartverket topo (WMTS REST: TileMatrix/TileRow/TileCol = z/y/x)
const TOPO_URL='https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png';
const A=(h,t)=>`<a href="${h}" target="_blank" rel="noopener">${t}</a>`;
const ATT={
  ofm:A('https://openfreemap.org','OpenFreeMap')+' '+A('https://www.openmaptiles.org/','© OpenMapTiles')+' Data from '+A('https://www.openstreetmap.org/copyright','OpenStreetMap'),
  dem:'Terrain: '+A('https://github.com/tilezen/joerd/blob/master/docs/attribution.md','Mapzen/AWS Terrain Tiles (SRTM, GMTED, EU-DEM © Copernicus, ETOPO1)'),
  sat:A('https://s2maps.eu','Sentinel-2 cloudless – https://s2maps.eu')+' by '+A('https://eox.at','EOX IT Services GmbH')+' (Contains modified Copernicus Sentinel data 2016)',
  topo:A('https://www.kartverket.no/','© Kartverket'),
  nav:'Airports, navaids: '+A('https://ourairports.com/data/','OurAirports')
};
// chart-room palette (site.css: --paper #EDF1EE, --sheet #FFF, --ink #13202A, --accent #9A1E68, --info #1D4E9E)
const P={land:'#F2EFE4',water:'#D3E2EC',coast:'#A3BACA',waterLine:'#B9CFDD',wood:'#E1E8D3',park:'#E4EAD8',ice:'#F8FAFB',resid:'#EAE5DA',bldg:'#E2DCD0',aero:'#E0DCD3',runway:'#C4BFB4',
  border:'#A4977F',state:'#CEC5B4',road:'#E4D9C8',roadMaj:'#DCCDB5',rail:'#D2CCC2',ink:'#13202A',ink2:'#4C5B66',ink3:'#6E7B84',halo:'rgba(246,244,238,.92)',waterLbl:'#557A93',peak:'#6B4A2B',
  accent:'#9A1E68',info:'#1D4E9E',ap:'#2C5F8D',vor:'#3C7A6B',ndb:'#8A6D3B',aip:'#7D93A3'};
const FONT_R=['Noto Sans Regular'], FONT_B=['Noto Sans Bold'], FONT_I=['Noto Sans Italic'];
const BASEMAPS=['chart','terrain','sat','topo'];

// which basemap groups are visible
const VIS={
  chart:  {bg:1,fill:1,water:1,coast:1,road:1,rail:1,bldg:1,boundary:1,label:1,roadlabel:1,waterlabel:1,peak:1,sat:0,topo:0,relief:0},
  terrain:{bg:1,fill:1,water:1,coast:1,road:1,rail:0,bldg:1,boundary:1,label:1,roadlabel:1,waterlabel:1,peak:1,sat:0,topo:0,relief:1},
  sat:    {bg:1,fill:0,water:0,coast:0,road:0,rail:0,bldg:0,boundary:1,label:1,roadlabel:0,waterlabel:1,peak:1,sat:1,topo:0,relief:0},
  topo:   {bg:1,fill:1,water:1,coast:1,road:0,rail:0,bldg:0,boundary:1,label:0,roadlabel:0,waterlabel:0,peak:0,sat:0,topo:1,relief:0}
};
// paint that changes over satellite imagery
const SATP={
  label:{'text-color':'#FFFFFF','text-halo-color':'rgba(16,24,30,.82)','text-halo-width':1.4},
  waterlabel:{'text-color':'#E4EFF6','text-halo-color':'rgba(16,24,30,.8)','text-halo-width':1.2},
  peak:{'text-color':'#FFF4E0','text-halo-color':'rgba(16,24,30,.8)'},
  boundary:{'line-color':'rgba(255,255,255,.78)'}
};
const lin=(z0,v0,z1,v1)=>['interpolate',['linear'],['zoom'],z0,v0,z1,v1];
const exp=(...s)=>['interpolate',['exponential',1.5],['zoom'],...s];

/* ---------- restyle an OpenMapTiles-schema style (positron, liberty, bright) ---------- */
function restyle(L){
  const sl=L['source-layer']||'', t=L.type, id=L.id||'';
  const keep=(g,paint,layout)=>{ L.metadata=Object.assign({},L.metadata,{'bb:g':g}); if(paint) L.paint=paint; if(layout) L.layout=Object.assign({},L.layout||{},layout); return L; };
  if(t==='background') return keep('bg',{'background-color':P.land});
  if(t==='fill'){
    if(sl==='water') return keep('water',{'fill-color':P.water,'fill-antialias':true});
    if(sl==='landcover') return keep('fill',{'fill-color':['match',['get','class'],['ice','glacier'],P.ice,['wood','forest'],P.wood,'wetland','#E2EAE2','sand','#EEEADB',P.park],'fill-opacity':['match',['get','class'],['ice','glacier'],0.9,['wood','forest'],0.6,0.35]});
    if(sl==='park') return keep('fill',{'fill-color':P.park,'fill-opacity':0.45});
    if(sl==='landuse') return keep('fill',{'fill-color':P.resid,'fill-opacity':['match',['get','class'],['residential','suburb','neighbourhood','commercial','industrial','retail'],0.55,0]});
    if(sl==='building'){ L.minzoom=Math.max(L.minzoom||0,13); return keep('bldg',{'fill-color':P.bldg,'fill-outline-color':'#D8D1C3'}); }
    if(sl==='aeroway') return keep('fill',{'fill-color':P.aero,'fill-opacity':0.8});
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
    if(sl==='aeroway') return keep('fill',{'line-color':P.runway,'line-width':['match',['get','class'],'runway',exp(10,1,14,6,18,40),exp(12,0.5,14,2,18,14)]});
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
  st.sources['bb-sat']={type:'raster',tiles:[SAT_URL],tileSize:dpr>=1.5?128:256,minzoom:0,maxzoom:13,attribution:ATT.sat};
  st.sources['bb-topo']={type:'raster',tiles:[TOPO_URL],tileSize:256,minzoom:0,maxzoom:18,attribution:ATT.topo,bounds:[-10,53,42,82]};
  const wi=out.findIndex(l=>l.metadata['bb:g']==='water'); const at=wi>=0?wi:1;
  const relief={id:'bb-relief',type:'color-relief',source:'bb-demh',metadata:{'bb:g':'relief'},layout:{visibility:'none'},paint:{'color-relief-opacity':0.8,'color-relief-color':['interpolate',['linear'],['elevation'],
    -1,'rgba(0,0,0,0)',0,'rgba(205,221,190,0)',2,'rgba(205,221,190,1)',120,'rgb(214,226,192)',370,'rgb(228,229,196)',670,'rgb(234,224,188)',1000,'rgb(224,204,164)',1370,'rgb(204,180,146)',1770,'rgb(184,168,150)',2290,'rgb(214,210,204)',3050,'rgb(244,243,240)']}};
  const hill={id:'bb-hill',type:'hillshade',source:'bb-demh',metadata:{'bb:g':'hill'},layout:{visibility:'visible'},paint:hillPaint('chart','vfr')};
  out.splice(at,0,relief,hill);
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
function hillPaint(bm,mode){
  if(mode==='ifr') return {'hillshade-exaggeration':0.22,'hillshade-shadow-color':'rgba(60,66,70,.28)','hillshade-highlight-color':'rgba(255,255,255,.12)','hillshade-accent-color':'rgba(60,66,70,.08)','hillshade-illumination-direction':315};
  if(bm==='terrain') return {'hillshade-exaggeration':0.6,'hillshade-shadow-color':'rgba(74,58,40,.55)','hillshade-highlight-color':'rgba(255,253,240,.35)','hillshade-accent-color':'rgba(90,72,50,.22)','hillshade-illumination-direction':315};
  return {'hillshade-exaggeration':0.4,'hillshade-shadow-color':'rgba(84,70,50,.42)','hillshade-highlight-color':'rgba(255,253,244,.28)','hillshade-accent-color':'rgba(90,76,56,.14)','hillshade-illumination-direction':315};
}

/* ---------- create the map, or reject within the time limit ---------- */
function create(container,o){
  o=o||{}; const deadline=Date.now()+(o.timeout||6000);
  return new Promise((ok,ko)=>{
    let map=null, done=false;
    const fail=e=>{ if(done) return; done=true; clearTimeout(tm); try{ if(map) map.remove(); }catch(_){} ko(e instanceof Error?e:new Error(String(e))); };
    const tm=setTimeout(()=>fail(new Error('timeout')),Math.max(500,deadline-Date.now()));
    if(!window.maplibregl) return fail(new Error('maplibre-gl not loaded'));
    if(navigator.onLine===false) return fail(new Error('offline'));
    const ac=window.AbortController?new AbortController():null; setTimeout(()=>ac&&ac.abort(),Math.max(500,deadline-Date.now()));
    fetch(o.styleUrl||STYLE_URL,{signal:ac&&ac.signal,credentials:'omit'}).then(r=>{ if(!r.ok) throw new Error('style '+r.status); return r.json(); }).then(base=>{
      if(done) return; const style=buildStyle(base,o);
      try{ map=new maplibregl.Map({container,style,center:o.center||[10,60],zoom:o.zoom==null?4:o.zoom,minZoom:2,maxZoom:17.5,maxPitch:80,attributionControl:false,dragRotate:false,pitchWithRotate:false,
        touchPitch:false,fadeDuration:200,canvasContextAttributes:{antialias:true},cooperativeGestures:false,refreshExpiredTiles:false}); }
      catch(e){ return fail(e); }
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:ATT.nav}),'bottom-right');
      map.addControl(new maplibregl.ScaleControl({unit:'nautical',maxWidth:110}),'bottom-right');
      // narrow screens: attribution starts folded behind its (i) button; it opens on tap
      if(container.clientWidth<640) setTimeout(()=>{ const a=container.querySelector('.maplibregl-ctrl-attrib'); if(a){ a.classList.remove('maplibregl-compact-show'); a.removeAttribute('open'); } },0);
      map.__bb={bm:'chart',relief:'vfr',vid:style.metadata['bb:vid'],ex:1.5,t3:false};
      let loaded=false, tile=false; const chk=()=>{ if(loaded&&!done){ done=true; clearTimeout(tm); ok(map); } };
      map.on('error',e=>{ if(!loaded&&e&&e.error&&/style|WebGL|context|layers\[|expression|sources\./i.test(String(e.error.message||''))) fail(e.error); });
      map.on('load',()=>{ loaded=true; try{ addImages(map); setBasemap(map,o.bm||'chart'); setRelief(map,o.relief||'vfr'); }catch(e){ return fail(e); } chk(); });
      map.on('data',e=>{ if(e.dataType==='source'&&e.tile&&e.sourceId===map.__bb.vid){ tile=true; chk(); } });
    }).catch(fail);
  });
}

/* ---------- basemap, relief, 3D ---------- */
function eachBase(map,f){ (map.getStyle().layers||[]).forEach(L=>{ const g=L.metadata&&L.metadata['bb:g']; if(g) f(L,g); }); }
function setBasemap(map,bm){ if(!BASEMAPS.includes(bm)) bm='chart'; map.__bb.bm=bm; const v=VIS[bm];
  eachBase(map,(L,g)=>{ if(g==='hill') return; const on=g in v?!!v[g]:true; map.setLayoutProperty(L.id,'visibility',on?'visible':'none');
    const sp=SATP[g]; if(sp){ const ch=map.__bb.ch||(map.__bb.ch={}); if(!ch[L.id]){ ch[L.id]={}; Object.keys(sp).forEach(k=>ch[L.id][k]=map.getPaintProperty(L.id,k)); }
      Object.keys(sp).forEach(k=>map.setPaintProperty(L.id,k,bm==='sat'?sp[k]:ch[L.id][k])); } });
  map.setPaintProperty('bb-sat','raster-opacity',1);
  setRelief(map,map.__bb.relief); }
function setRelief(map,mode){ map.__bb.relief=mode; const bm=map.__bb.bm; const on=mode!=='off'&&(bm==='chart'||bm==='terrain');
  if(!map.getLayer('bb-hill')) return; map.setLayoutProperty('bb-hill','visibility',on?'visible':'none'); const p=hillPaint(bm,mode); Object.keys(p).forEach(k=>map.setPaintProperty('bb-hill',k,p[k]));
  if(map.getLayer('bb-relief')) map.setLayoutProperty('bb-relief','visibility',bm==='terrain'&&mode!=='ifr'?'visible':'none'); }
function set3D(map,on,ex){ map.__bb.t3=!!on; if(ex) map.__bb.ex=ex;
  if(on){ map.setTerrain({source:'bb-dem',exaggeration:map.__bb.ex});
    try{ map.setSky({'sky-color':'#BFD5E4','horizon-color':'#E9EFF1','fog-color':'#E6ECEE','sky-horizon-blend':0.6,'horizon-fog-blend':0.55,'fog-ground-blend':0.35,'atmosphere-blend':0}); }catch(e){}
    map.dragRotate.enable(); map.touchZoomRotate.enableRotation(); map.touchPitch.enable(); }
  else { map.setTerrain(null); map.dragRotate.disable(); map.touchZoomRotate.disableRotation(); map.touchPitch.disable(); }
  map.triggerRepaint(); }
function exag(map){ const t=map.getTerrain&&map.getTerrain(); return t?(t.exaggeration||1):0; }

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
const LYG={ap:['bb-ap0','bb-ap1','bb-ap2','bb-ap2r','bb-apl0','bb-apl1','bb-apl2'],nv:['bb-nv'],fx:['bb-fx','bb-my'],nt:['bb-note'],mef:['bb-mef','bb-mefg'],awy:['bb-awy']};
function setGroups(map,LY){ Object.keys(LYG).forEach(k=>{ const on=k==='awy'?true:!!LY[k]; LYG[k].forEach(id=>{ if(map.getLayer(id)) map.setLayoutProperty(id,'visibility',on?'visible':'none'); }); }); }
function setData(map,id,fc){ const s=map.getSource(id); if(s) s.setData(fc||FC); }
const HITL=['bb-ap0','bb-ap1','bb-ap2','bb-nv','bb-fx','bb-my','bb-note'];
// the nearest clickable aviation feature within r CSS px
function hit(map,x,y,r){ const L=HITL.filter(id=>map.getLayer(id)&&map.getLayoutProperty(id,'visibility')!=='none');
  const fs=map.queryRenderedFeatures([[x-r,y-r],[x+r,y+r]],{layers:L}); let best=null, bd=r;
  fs.forEach(f=>{ const c=f.geometry&&f.geometry.coordinates; if(!c) return; const p=map.project(c); const dy=f.layer.id==='bb-note'?14:0; const d=Math.hypot(p.x-x,p.y-dy-y); if(d<bd){ bd=d; best={x:p.x,y:p.y-dy,k:f.properties.k,i:f.properties.i}; } }); return best; }

/* ---------- 3D: the planned path at altitude (curtain to the ground + ribbon at the level) ---------- */
function pathLayer(){
  const VS='attribute vec3 a_p; attribute float a_k; attribute vec3 a_c; uniform mat4 u_m; uniform float u_ex; uniform float u_band; uniform float u_a; varying vec4 v_c;\n'+
    'void main(){ float z = a_k<0.5 ? a_p.z*u_ex : (a_k<1.5 ? a_p.z*u_ex-u_band : -200.0); gl_Position=u_m*vec4(a_p.xy,z,1.0); float al = a_k>1.5 ? u_a*0.25 : u_a; v_c=vec4(a_c*al,al); }';
  const FS='precision mediump float; varying vec4 v_c; void main(){ gl_FragColor=v_c; }';
  const L={id:'bb-path3d',type:'custom',renderingMode:'3d',n:0,pts:null,hov:null,
    onAdd(map,gl){ this.map=map; const sh=(t,s)=>{ const o=gl.createShader(t); gl.shaderSource(o,s); gl.compileShader(o); return o; };
      const p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,VS)); gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FS)); gl.linkProgram(p); this.pg=p;
      this.loc={p:gl.getAttribLocation(p,'a_p'),k:gl.getAttribLocation(p,'a_k'),c:gl.getAttribLocation(p,'a_c'),m:gl.getUniformLocation(p,'u_m'),ex:gl.getUniformLocation(p,'u_ex'),band:gl.getUniformLocation(p,'u_band'),a:gl.getUniformLocation(p,'u_a')};
      this.vb=gl.createBuffer(); this.ib1=gl.createBuffer(); this.ib2=gl.createBuffer(); this.dirty=true;
      const d=document.createElement('div'); d.className='bb-ac'; d.hidden=true; map.getContainer().appendChild(d); this.ac=d; },
    onRemove(){ if(this.ac) this.ac.remove(); },
    set(pts,hov){ this.pts=pts&&pts.length>1?pts:null; this.hov=hov||null; this.dirty=true; if(this.map) this.map.triggerRepaint(); },
    upload(gl){ const P=this.pts; this.dirty=false; if(!P){ this.n=0; return; }
      const MC=maplibregl.MercatorCoordinate; const o=MC.fromLngLat([P[0].lo,P[0].la]); this.ox=o.x; this.oy=o.y;
      const v=new Float32Array(P.length*3*7); P.forEach((q,i)=>{ const m=MC.fromLngLat([q.lo,q.la]); const x=m.x-o.x, y=m.y-o.y, z=q.alt*0.3048, c=q.col; for(let k=0;k<3;k++) v.set([x,y,z,k,c[0],c[1],c[2]],(i*3+k)*7); });
      const cur=[], rib=[]; for(let i=0;i<P.length-1;i++){ const a=i*3, b=a+3; cur.push(a,a+2,b,b,a+2,b+2); rib.push(a,a+1,b,b,a+1,b+1); }
      gl.bindBuffer(gl.ARRAY_BUFFER,this.vb); gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib1); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(cur),gl.STATIC_DRAW); this.n1=cur.length;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib2); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(rib),gl.STATIC_DRAW); this.n2=rib.length; this.n=P.length; },
    render(gl,args){ const map=this.map, ex=exag(map); if(this.dirty) this.upload(gl);
      if(!this.n||!ex){ if(this.ac) this.ac.hidden=true; return; }
      const ws=map.transform.worldSize, M0=args.modelViewProjectionMatrix; // world: x,y in pixels at this zoom, z in metres
      // M = M0 · translate(ox·ws, oy·ws, 0) · scale(ws, ws, 1), done in double precision here
      const M=new Float64Array(16); for(let i=0;i<16;i++) M[i]=M0[i]; const tx=this.ox*ws, ty=this.oy*ws;
      for(let r=0;r<4;r++){ M[12+r]=M0[r]*tx+M0[4+r]*ty+M0[12+r]; M[r]=M0[r]*ws; M[4+r]=M0[4+r]*ws; }
      const lat=map.getCenter().lat, mpp=40075016.686*Math.cos(lat*Math.PI/180)/ws;
      gl.useProgram(this.pg); gl.uniformMatrix4fv(this.loc.m,false,new Float32Array(M)); gl.uniform1f(this.loc.ex,ex); gl.uniform1f(this.loc.band,mpp*3.2);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.vb); const st=28; gl.enableVertexAttribArray(this.loc.p); gl.vertexAttribPointer(this.loc.p,3,gl.FLOAT,false,st,0); gl.enableVertexAttribArray(this.loc.k); gl.vertexAttribPointer(this.loc.k,1,gl.FLOAT,false,st,12); gl.enableVertexAttribArray(this.loc.c); gl.vertexAttribPointer(this.loc.c,3,gl.FLOAT,false,st,16);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
      gl.depthMask(false); gl.uniform1f(this.loc.a,0.32); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib1); gl.drawElements(gl.TRIANGLES,this.n1,gl.UNSIGNED_SHORT,0);
      gl.depthMask(true); gl.uniform1f(this.loc.a,1); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib2); gl.drawElements(gl.TRIANGLES,this.n2,gl.UNSIGNED_SHORT,0);
      gl.disableVertexAttribArray(this.loc.k); gl.disableVertexAttribArray(this.loc.c);
      // the aircraft at the hover/fly position, as a DOM dot
      const h=this.hov, ac=this.ac; if(h&&ac){ const m=maplibregl.MercatorCoordinate.fromLngLat([h.lo,h.la]); const x=(m.x-this.ox), y=(m.y-this.oy), z=h.alt*0.3048*ex;
        const c=[0,1,2,3].map(r=>M[r]*x+M[4+r]*y+M[8+r]*z+M[12+r]); if(c[3]>0){ const cv=map.getCanvas(); const W=cv.clientWidth, H=cv.clientHeight; ac.style.left=((c[0]/c[3]+1)/2*W)+'px'; ac.style.top=((1-c[1]/c[3])/2*H)+'px'; ac.hidden=false; } else ac.hidden=true; }
      else if(ac) ac.hidden=true; }
  };
  return L;
}
function setPath3D(map,pts,hov){ const L=map.getLayer('bb-path3d'); const impl=L&&(L.implementation||L); if(impl&&impl.set) impl.set(pts,hov); }

window.RXMAP={create,setBasemap,setRelief,set3D,addOverlays,setGroups,setData,hit,setPath3D,exag,BASEMAPS,ATT,P,urls:{style:STYLE_URL,dem:DEM_URL,sat:SAT_URL,topo:TOPO_URL}};
})();
