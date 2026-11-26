/* Training hub, flow tile (2026-11-26): a still of the flow trainer, drawn the way flows.js draws it (badges, curved arrows).
   node flows-dump.js > a320flows.json
   LS=0.8 UPTO=18 SEL=18 node flowstill.js ovhd 310 362 380 281 2800 still.html   -> screenshot at 2800 px, then hub4-flows-1400/700.webp
   args: flowId, frame x y w h in the 1000-wide deck canvas, output width, output file. LS = badge size (the trainer's setting),
   UPTO = steps drawn (as when the trainer plays a flow), SEL = the step with the trainer's dashed selection ring. */
const fs=require('fs'), path=require('path'); const D=JSON.parse(fs.readFileSync(__dirname+'/a320flows.json'));
const [id,x,y,w,h,outW,out]=process.argv.slice(2); const f=D[id]; const X=+x,Y=+y,Wd=+w,Ht=+h,OW=+outW, OH=Math.round(OW*Ht/Wd);
const COL={PF:'#3CCB7F',PM:'#F2C230'}; const LS=+(process.env.LS||1), R=15*LS, lw=3;
function pathD(a,b){ const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y,L0=Math.hypot(dx,dy)||1,k=Math.min(40,L0*.12);
  const cx=mx-dy/L0*k,cy=my+dx/L0*k,ta=R/L0,tb=1-(R+4)/L0; const q=t=>[(1-t)*(1-t)*a.x+2*(1-t)*t*cx+t*t*b.x,(1-t)*(1-t)*a.y+2*(1-t)*t*cy+t*t*b.y];
  const p0=q(Math.min(.45,ta)),p1=q(Math.max(.55,tb)); return `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`; }
const UPTO=+(process.env.UPTO||999), SEL=+(process.env.SEL||0); const S=f.steps.slice(0,UPTO).filter(s=>s.x!=null); const roles=[...new Set(S.map(s=>s.r))]; const o=[];
o.push('<defs>'+roles.map(r=>`<marker id="ah-${r}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${COL[r]}"/></marker>`).join('')+'</defs>');
roles.forEach(r=>{ const T=S.filter(s=>s.r===r); for(let i=1;i<T.length;i++){ o.push(`<path d="${pathD(T[i-1],T[i])}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="${lw+3}" stroke-linecap="round"/><path d="${pathD(T[i-1],T[i])}" fill="none" stroke="${COL[r]}" stroke-width="${lw}" stroke-linecap="round" marker-end="url(#ah-${r})"/>`); } });
const n={}; S.forEach(s=>{ n[s.r]=(n[s.r]||0)+1; const b=String(roles.length>1?n[s.r]:S.indexOf(s)+1);
  const on=SEL&&f.steps.indexOf(s)===SEL-1; o.push(`<g transform="translate(${s.x} ${s.y})">${on?`<circle r="${R+7}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="4 3"/>`:''}<circle r="${R}" fill="${COL[s.r]}" stroke="#0B0F12" stroke-width="2.5"/><text y="${5.5*LS}" text-anchor="middle" style="font:800 ${(b.length>2?11:15)*LS}px 'Inter','Helvetica Neue',Arial,sans-serif;fill:#0B0F12">${b}</text></g>`); });
const html=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#0E1319}svg{display:block}</style></head><body>
<svg width="${OW}" height="${OH}" viewBox="${X} ${Y} ${Wd} ${Ht}"><image href="file://${path.resolve(__dirname,'../../img/cockpits/a320-deck-3000.webp')}" x="0" y="0" width="1000" height="1678"/>${o.join('')}</svg></body></html>`;
fs.writeFileSync(out,html); console.log(OW,OH);
