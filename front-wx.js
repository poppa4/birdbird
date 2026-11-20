/* NORDAP – front page: the weather forecast at an aerodrome, in a few seconds (outlook.js, sun.js, /api/outlook).
   An ICAO code, a day and an hour give the estimated status, cloud base, ceiling, visibility and wind; the full analysis
   is one tap away on outlook.html. The scripts and the aerodrome list load when the section comes into view. */
(function () {
'use strict';
const box = document.getElementById('fwx'); if (!box) return;
const L = o => (window.LAB && LAB.L ? LAB.L(o) : (document.documentElement.lang === 'no' ? o.no : o.en));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = `.fwx{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:40px;align-items:center}
.fwx h2{font-family:var(--f-display);font-stretch:88%;font-weight:700;font-size:clamp(28px,2.6vw,38px);margin:0 0 12px;line-height:1.1}
.fwx-t p{color:var(--ink-2);font-size:17px;line-height:1.55;margin:0 0 20px;max-width:46ch}
.fwx-f{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.fwx-f input,.fwx-f select{font-family:var(--f-mono);font-size:16px;padding:9px 11px;border:1px solid var(--rule);border-radius:4px;background:#fff;color:var(--ink)}
.fwx-f input{width:96px;text-transform:uppercase}
.fwx-go{display:inline-block;margin-top:16px;font-weight:600;color:var(--accent);text-decoration:underline;text-underline-offset:4px}
.fwx-c{border-radius:12px;padding:20px 22px;color:#fff;background:linear-gradient(135deg,#132230 0%,#1d3446 60%,#24435a 100%);box-shadow:0 18px 40px -24px rgba(10,25,40,.7);min-height:208px;text-decoration:none;display:block}
.fwx-c.ifr{background:linear-gradient(135deg,#1c1f2b 0%,#2b2b3d 55%,#3b2c3c 100%)}
.fwx-c .hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13.5px;color:rgba(255,255,255,.75)}
.fwx-c .pl{display:inline-flex;align-items:center;gap:7px;padding:4px 11px;border-radius:3px;font:600 13.5px/1.3 var(--f-mono);color:#fff}
.fwx-c .pl.vfr{background:#1e8e3e}.fwx-c .pl.near{background:#b77800}.fwx-c .pl.svfr{background:#c2410c}.fwx-c .pl.ifr{background:#d93025}
.fwx-c .g{display:grid;grid-template-columns:1fr 1fr 1fr 1.25fr;gap:10px;margin-top:16px}
.fwx-c .g div{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:9px 11px;min-width:0}
.fwx-c .g div:first-child{background:rgba(255,92,154,.16);border-color:rgba(255,92,154,.45)}
.fwx-c .g span{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.65)}
.fwx-c .g b{display:block;color:#fff;font-family:var(--f-display);font-stretch:88%;font-size:clamp(17px,1.6vw,22px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fwx-c .ln{margin:14px 0 0;font-size:14px;line-height:1.5;color:rgba(255,255,255,.85)}
.fwx-c .nt{margin-top:10px;font:11.5px/1.4 var(--f-mono);color:rgba(255,255,255,.55)}
.fwx-c .w{color:rgba(255,255,255,.7);font-size:15px;padding-top:60px;text-align:center}
@media (max-width:860px){.fwx{grid-template-columns:1fr;gap:22px}.fwx-c .g{grid-template-columns:1fr 1fr}}`;
const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
const pad = n => String(n).padStart(2, '0');
let icao = 'ENTO'; try { icao = localStorage.getItem('bb-ol-icao') || localStorage.getItem('bb-sun-icao') || 'ENTO'; } catch (e) {}
let dayOff = 0, hour = null, AP = null, seq = 0;
function shell() {
  const loc = document.documentElement.lang === 'no' ? 'nb-NO' : 'en-GB';
  const days = []; for (let i = 0; i < 14; i++) { const d = new Date(Date.now() + i * 864e5); days.push(i === 0 ? L({ en: 'Today', no: 'I dag' }) : i === 1 ? L({ en: 'Tomorrow', no: 'I morgen' }) : new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric', month: 'short' }).format(d)); }
  if (hour == null) hour = Math.min(23, new Date().getHours() + 1);
  box.innerHTML = `<div class="fwx-t"><h2 id="h-wx">${L({ en: 'Weather forecast', no: 'Værvarsel' })}</h2>
    <p>${L({ en: 'Cloud base, ceiling, visibility and wind at any aerodrome, hour by hour up to 14 days ahead, from six weather models side by side. A model estimate for planning, not an official forecast.', no: 'Skybase, ceiling, sikt og vind på enhver flyplass, time for time opptil 14 dager fram, fra seks værmodeller side om side. Et modellestimat for planlegging, ikke en offisiell prognose.' })}</p>
    <div class="fwx-f"><input id="fwxI" maxlength="4" value="${esc(icao)}" aria-label="ICAO" autocapitalize="characters" autocomplete="off" spellcheck="false">
      <select id="fwxD" aria-label="${L({ en: 'Day', no: 'Dag' })}">${days.map((d, i) => `<option value="${i}"${i === dayOff ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select>
      <select id="fwxH" aria-label="${L({ en: 'Local time', no: 'Lokal tid' })}">${Array.from({ length: 24 }, (_, i) => `<option value="${i}"${i === hour ? ' selected' : ''}>${pad(i)}:00</option>`).join('')}</select></div>
    <a class="fwx-go" id="fwxGo" href="outlook.html">${L({ en: 'Open the full forecast', no: 'Åpne hele værvarselet' })} →</a></div>
    <a class="fwx-c" id="fwxC" href="outlook.html"><div class="w">${L({ en: 'Reading the weather models…', no: 'Leser værmodellene …' })}</div></a>`;
  const ch = () => { const v = document.getElementById('fwxI').value.trim().toUpperCase(); if (/^[A-Z0-9]{4}$/.test(v)) icao = v; dayOff = +document.getElementById('fwxD').value; hour = +document.getElementById('fwxH').value; run(); };
  document.getElementById('fwxI').addEventListener('input', e => { if (e.target.value.trim().length === 4) ch(); });
  document.getElementById('fwxD').addEventListener('change', ch); document.getElementById('fwxH').addEventListener('change', ch);
}
function run() {
  const card = document.getElementById('fwxC'), go = document.getElementById('fwxGo'); if (!card || !window.OUT || !window.SUN || !AP) return;
  const ap = AP[icao]; if (!ap) { card.innerHTML = `<div class="w">${L({ en: 'Unknown ICAO code: ', no: 'Ukjent ICAO-kode: ' })}${esc(icao)}</div>`; return; }
  const tz = SUN.tzOf(icao), p = OUT.localParts(Date.now() + dayOff * 864e5, tz), ms = OUT.zoned(p.y, p.mo, p.d, hour, 0, tz);
  const href = `outlook.html?icao=${icao}&t=${new Date(ms).toISOString().slice(0, 13)}:00Z`; card.href = href; go.href = href;
  if (ms < Date.now() - 2 * 36e5) { card.innerHTML = `<div class="w">${L({ en: 'That hour has passed: pick a later one.', no: 'Den timen er passert: velg en senere.' })}</div>`; return; }
  const my = ++seq; card.className = 'fwx-c'; card.innerHTML = `<div class="w">${L({ en: 'Reading the weather models…', no: 'Leser værmodellene …' })}</div>`;
  OUT.get(ap, icao, ms).then(j => { if (my !== seq) return;
    if (!j || !j.ok) { card.innerHTML = `<div class="w">${esc((j && j.message) || L({ en: 'The weather models could not be read right now.', no: 'Værmodellene kunne ikke leses akkurat nå.' }))}</div>`; return; }
    const c = j.hours[j.tIdx].cons, w = OUT.words(c, L, { elevFt: ap.el }), cls = c.sera === 'vfr' && c.near ? 'near' : c.sera;
    const loc = document.documentElement.lang === 'no' ? 'nb-NO' : 'en-GB';
    const when = new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'short', timeZone: tz || 'UTC' }).format(new Date(ms)) + ' ' + SUN.hm(new Date(ms), tz);
    const wd = c.wind && c.wind.kt != null ? (c.wind.dir != null ? String(c.wind.dir).padStart(3, '0') + '°/' : '') + c.wind.kt + (c.wind.gust ? 'G' + c.wind.gust : '') + ' kt' : '—';
    card.className = 'fwx-c ' + (c.sera === 'ifr' ? 'ifr' : '');
    card.innerHTML = `<div class="hd"><span class="pl ${cls}">${esc(w.status)}</span><b style="color:#fff">${esc(icao)}</b> ${esc(when)}</div>
      <div class="g"><div><span>${L({ en: 'Cloud base', no: 'Skybase' })}</span><b>${c.lowest == null ? L({ en: 'None', no: 'Ingen' }) : OUT.sp(c.lowest) + ' ft'}</b></div>
      <div><span>Ceiling</span><b>${c.ceil == null ? L({ en: 'None', no: 'Ingen' }) : OUT.sp(c.ceil) + ' ft'}</b></div>
      <div><span>${L({ en: 'Visibility', no: 'Sikt' })}</span><b>${OUT.visTxt(c.vis)}</b></div><div><span>${L({ en: 'Wind', no: 'Vind' })}</span><b>${esc(wd)}</b></div></div>
      <p class="ln">${esc(w.lines.slice(1, 2).concat(w.lines.slice(3, 4)).join(' '))}</p>
      <div class="nt">${L({ en: 'Model estimate · confidence ', no: 'Modellestimat · sikkerhet ' })}${esc(w.conf)} · ${L({ en: 'not an official forecast', no: 'ikke en offisiell prognose' })}</div>`; });
}
const load = src => new Promise(ok => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ok; document.head.appendChild(s); });
let started = false;
function start() { if (started) return; started = true; shell();
  Promise.all([window.OUT ? 0 : load('outlook.js?v=2'), window.SUN ? 0 : load('sun.js?v=1'), fetch('data/nav-eu.json').then(r => r.json()).then(d => { AP = {}; (d.ap || []).forEach(a => { AP[a[0]] = { n: a[1], lat: a[2], lon: a[3], el: a[4] }; }); }).catch(() => { AP = {}; })]).then(run); }
if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '400px' }); io.observe(box); } else start();
if (window.LAB && LAB.onLang) LAB.onLang(() => { if (started) { shell(); run(); } });
})();
