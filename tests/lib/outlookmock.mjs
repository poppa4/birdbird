import { LEVELS, VAR_TIERS } from '../../functions/_lib/outlook.js';
// synthetic atmosphere: elev 286 ft, T2 4C Td 3C, moist layer 900-850, dry 800, moist 700-600
export function omJson(model, start, n, opts={}){
  const time=[]; for(let i=0;i<n;i++) time.push(new Date(Date.parse(start)+i*36e5).toISOString().slice(0,16));
  const h={time}; const set=(k,f)=>h[k]=time.map((_,i)=>f(i));
  const zs={1000:110,975:320,950:540,925:770,900:1000,850:1460,800:1950,700:3000,600:4200,500:5550,400:7150,300:9100};
  const ts={1000:4,975:3,950:2,925:1,900:0,850:-2,800:-4,700:-9,600:-16,500:-25,400:-37,300:-50};
  const rh={1000:90,975:94,950:97,925:98,900:96,850:80,800:60,700:95,600:93,500:60,400:40,300:30};
  const sh=opts.shift||0;
  set('temperature_2m',()=>4+sh); set('dew_point_2m',()=>3); set('relative_humidity_2m',()=>93); set('cloud_cover',()=>100); set('cloud_cover_low',()=>85); set('cloud_cover_mid',()=>70); set('cloud_cover_high',()=>10);
  set('visibility',()=>opts.vis??12000); set('precipitation',()=>0.4); set('snowfall',()=>0); set('showers',()=>0); set('weather_code',()=>61);
  set('wind_speed_10m',()=>12); set('wind_direction_10m',()=>220); set('wind_gusts_10m',()=>24); set('freezing_level_height',()=>1000); set('cape',()=>20); set('pressure_msl',()=>1005);
  for(const p of LEVELS){ set(`temperature_${p}hPa`,()=>ts[p]); set(`relative_humidity_${p}hPa`,()=>rh[p]+(opts.drier?-8:0)); set(`geopotential_height_${p}hPa`,()=>zs[p]); if(!opts.nocc) set(`cloud_cover_${p}hPa`,()=>rh[p]>=93?(rh[p]>=96?90:60):5); }
  for(const p of LEVELS){ set(`wind_speed_${p}hPa`,()=>Math.round(10+ (1000-p)*0.12)); set(`wind_direction_${p}hPa`,()=>220+Math.round((1000-p)/20)); }
  return {latitude:59.2,longitude:10.25,elevation:87,hourly:h};
}
export function metJson(start){ const ts=[]; for(let i=-6;i<12;i++){ ts.push({time:new Date(Date.parse(start)+i*36e5).toISOString().replace('.000',''),data:{instant:{details:{air_temperature:4.2,dew_point_temperature:3.1,relative_humidity:93,cloud_area_fraction:100,cloud_area_fraction_low:90,cloud_area_fraction_medium:60,cloud_area_fraction_high:5,fog_area_fraction:0,wind_speed:6.5,wind_speed_of_gust:12,wind_from_direction:215}},next_1_hours:{summary:{symbol_code:'lightrain'},details:{precipitation_amount:0.5,probability_of_thunder:0}}}}); } return {properties:{timeseries:ts}}; }
export function mockFetch(T){ return async (url)=>{ const u=new URL(url);
  if(u.hostname==='api.open-meteo.com'){ const m=u.searchParams.get('models'); if(m==='ecmwf_ifs025') return new Response(JSON.stringify({error:true,reason:'Invalid model'}),{status:400});
    if(m==='dmi_seamless') return new Response(JSON.stringify(omJson(m,u.searchParams.get('start_hour')+'Z',13,{nocc:true})),{status:200});
    return new Response(JSON.stringify(omJson(m,u.searchParams.get('start_hour')+'Z',13,{drier:m==='gfs_seamless'})),{status:200}); }
  if(u.hostname==='api.met.no') return new Response(JSON.stringify(metJson(T)),{status:200});
  if(u.pathname==='/api/wx') return new Response(JSON.stringify({ok:true,stations:{ENTO:{metar:{raw:'ENTO 201250Z 22010KT 9999 BKN012 04/03 Q1005',obsTime:'2026-11-20T12:50:00Z'},taf:{raw:'TAF ENTO 201100Z 2012/2112 22010KT 9999 BKN012',validFrom:'2026-11-20T12:00:00Z',validTo:'2026-11-21T12:00:00Z'}}}}),{status:200});
  if(u.pathname==='/api/clouds') return new Response(JSON.stringify({ok:true,la0:60,lo0:10,d:0.25,nx:21,ny:21,valid:T,run:'2026112012',lc:Array(21).fill(Array(21).fill(80)),lb:Array(21).fill(Array(21).fill(1400)),lt:Array(21).fill(Array(21).fill(4200)),mc:Array(21).fill(Array(21).fill(60)),mb:Array(21).fill(Array(21).fill(9500)),mt:Array(21).fill(Array(21).fill(16000)),hc:Array(21).fill(Array(21).fill(0)),hb:Array(21).fill(Array(21).fill(null)),ht:Array(21).fill(Array(21).fill(null)),ceil:Array(21).fill(Array(21).fill(1400))}),{status:200});
  return new Response('nf',{status:404}); }; }
