import { nomadsUrl } from './functions/api/clouds.js';
import { readGrib2 } from './functions/_lib/grib2.js';
const keep=setInterval(()=>{},1000);
const run=new Date('2026-11-16T06:00:00Z'); const r=await fetch(nomadsUrl(run,5,{la:55,lo:5})); const b=new Uint8Array(await r.arrayBuffer());
const ms=readGrib2(b); console.log('CL decoded', ms.map(m=>m.cat+'/'+m.num+'@'+m.level.type).join(' '));
// raw scan of all messages: section4 template, cat/num/level, section5 template, bitmap
let o=0; const u32=(o)=>((b[o]<<24)>>>0)+(b[o+1]<<16)+(b[o+2]<<8)+b[o+3], u16=o=>(b[o]<<8)|b[o+1];
while(o<b.length-16){ if(!(b[o]===0x47&&b[o+1]===0x52&&b[o+2]===0x49&&b[o+3]===0x42)){o++;continue;} const tot=u32(o+12), end=o+tot; let p=o+16, info=[];
  while(p<end-4){ const len=u32(p), sec=b[p+4]; if(sec===4) info.push('t4='+u16(p+7)+' '+b[p+9]+'/'+b[p+10]+'@'+b[p+22]); if(sec===5) info.push('t5='+u16(p+9)); if(sec===6) info.push('bm='+b[p+5]); if(b[p]===0x37&&b[p+1]===0x37) break; p+=len; }
  console.log('CL raw', info.join(' ')); o=end; }
clearInterval(keep);
