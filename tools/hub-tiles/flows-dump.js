/* Dumps NORDAP's standard A320 flows with the panel position of every step (node flows-dump.js > a320flows.json). */
const A = require('../../flowsac.js'), F = require('../../flowscore.js'), out = {};
for (const d of F.STD.a320.flows) { const f = F.stdFlow('bb:a320:' + d[0], A, false); if (!f) continue;
  out[d[0]] = { name: d[2][0], steps: f.steps.map(s => ({ r: s.r, t: s.t || s.txt || s.n, x: s.x, y: s.y, tg: s.tg })) }; }
console.log(JSON.stringify(out));
