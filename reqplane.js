/* NORDAP – "Request your aircraft". Any element with data-reqplane="sim" or "flows" opens the form.
   Pictures are shrunk in the browser to small JPEGs before they are sent to /api/request (functions/api/request.js). */
(function () {
  'use strict';
  const no = () => document.documentElement.lang === 'nb';
  const T = {
    btn: ['Request your aircraft', 'Ønsk deg et fly'],
    h: ['Request your aircraft', 'Ønsk deg et fly'],
    pSim: ['Tell us which aircraft you want as a simulator. We read every request, but cannot promise to build them all.', 'Fortell hvilket fly du ønsker som simulator. Vi leser alle ønsker, men kan ikke love å bygge alle.'],
    pFlows: ['Tell us which cockpit you want in the flow trainer. We read every request, but cannot promise to build them all.', 'Fortell hvilken cockpit du ønsker i flow-treneren. Vi leser alle ønsker, men kan ikke love å bygge alle.'],
    ac: ['Aircraft', 'Fly'], acPh: ['e.g. Embraer E190', 'f.eks. Embraer E190'],
    vr: ['Variant (optional)', 'Variant (valgfritt)'], vrPh: ['e.g. E190-E2, G1000, -600', 'f.eks. E190-E2, G1000, -600'],
    want: ['What do you want to train? (optional)', 'Hva vil du trene på? (valgfritt)'],
    links: ['Links to a 3D model, pictures or manuals (optional)', 'Lenker til 3D-modell, bilder eller manualer (valgfritt)'], linksPh: ['One link per line. Say which licence the model has if you know.', 'Én lenke per linje. Skriv gjerne hvilken lisens modellen har.'],
    pics: ['Pictures of the cockpit (optional, up to 3)', 'Bilder av cockpiten (valgfritt, inntil 3)'],
    rights: ['I took these pictures myself, or I have permission to share them.', 'Jeg har tatt bildene selv, eller har lov til å dele dem.'],
    name: ['Your name (optional)', 'Navnet ditt (valgfritt)'], reply: ['Your e-mail, if you want an answer (optional)', 'E-posten din, om du vil ha svar (valgfritt)'],
    priv: ['Stored only to handle your request: pictures are removed when it has reached NORDAP, the rest 90 days later. ', 'Lagres bare for å behandle ønsket ditt: bildene fjernes når det har kommet fram til NORDAP, resten 90 dager senere. '], privL: ['Privacy', 'Personvern'],
    send: ['Send request', 'Send ønsket'], cancel: ['Cancel', 'Avbryt'], close: ['Close', 'Lukk'], sending: ['Sending…', 'Sender…'],
    done: ['Thank you. Your request has been received.', 'Takk. Ønsket ditt er mottatt.'],
    eAc: ['Write which aircraft you want.', 'Skriv hvilket fly du ønsker.'], eRights: ['Tick the box about the pictures first.', 'Kryss av i boksen om bildene først.'],
    ePic: ['One of the pictures could not be read. Remove it and try again.', 'Et av bildene kunne ikke leses. Fjern det og prøv igjen.'], eMany: ['Choose at most three pictures.', 'Velg høyst tre bilder.'],
    eNet: ['The request could not be sent. Check your connection and try again.', 'Ønsket kunne ikke sendes. Sjekk nettforbindelsen og prøv igjen.'],
    eSrv: { bad_request: ['Something in the form is not right. Check the fields and try again.', 'Noe i skjemaet stemmer ikke. Sjekk feltene og prøv igjen.'], too_large: ['The pictures are too large. Use fewer or smaller pictures.', 'Bildene er for store. Bruk færre eller mindre bilder.'],
      rate_limited: ['You have sent several requests today. Try again tomorrow.', 'Du har sendt flere ønsker i dag. Prøv igjen i morgen.'], no_db: ['Requests cannot be received right now. Try again later.', 'Ønsker kan ikke tas imot akkurat nå. Prøv igjen senere.'] }
  };
  const t = k => T[k][no() ? 1 : 0];
  const label = () => document.querySelectorAll('[data-reqplane]').forEach(b => { if (!b.hasAttribute('data-reqplane-keep')) b.textContent = t('btn'); });
  new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', label); else label();

  const css = 'dialog.rq{border:0;border-radius:14px;padding:22px;width:min(540px,94vw);max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);background:#fff;color:#13202A;font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;text-align:left}'
    + 'dialog.rq::backdrop{background:rgba(10,14,18,.55)}dialog.rq h3{margin:0 0 6px;font-size:20px;color:inherit}dialog.rq p{margin:0 0 14px;color:#4A5A66;font-size:14px}'
    + 'dialog.rq label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;margin:0 0 12px;color:inherit}'
    + 'dialog.rq input[type=text],dialog.rq input[type=email],dialog.rq textarea{font:inherit;font-weight:400;padding:10px;border:1px solid #B9C4CC;border-radius:6px;background:#fff;color:inherit;min-height:44px;width:100%;box-sizing:border-box}dialog.rq textarea{min-height:70px;resize:vertical}'
    + 'dialog.rq .rq2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}@media(max-width:520px){dialog.rq .rq2{grid-template-columns:1fr}}'
    + 'dialog.rq .rqc{flex-direction:row;align-items:flex-start;gap:10px;font-weight:400;font-size:14px}dialog.rq .rqc input{width:22px;height:22px;flex:none;margin:0}'
    + 'dialog.rq .rqh{position:absolute;left:-9999px}dialog.rq .rqm{min-height:20px;margin:0 0 10px;font-size:14px;color:#A32020}dialog.rq .rqm.ok{color:#17603A;font-weight:600}'
    + 'dialog.rq .rqa{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}dialog.rq .rqa button{font:inherit;font-weight:600;min-height:44px;padding:0 18px;border-radius:8px;border:1px solid #13202A;background:#fff;color:#13202A;cursor:pointer}'
    + 'dialog.rq .rqa button.pri{background:#0B5CAD;border-color:#0B5CAD;color:#fff}dialog.rq .rqa button:disabled{opacity:.55;cursor:default}';
  let dlg = null, kind = 'sim';
  function build() {
    if (!document.getElementById('rqcss')) { const s = document.createElement('style'); s.id = 'rqcss'; s.textContent = css; document.head.appendChild(s); }
    dlg = document.createElement('dialog'); dlg.className = 'rq'; dlg.setAttribute('aria-labelledby', 'rqh');
    dlg.innerHTML = '<form novalidate><h3 id="rqh"></h3><p id="rqp"></p>'
      + '<div class="rq2"><label><span data-k="ac"></span><input type="text" name="aircraft" maxlength="80" required autocomplete="off"></label><label><span data-k="vr"></span><input type="text" name="variant" maxlength="80" autocomplete="off"></label></div>'
      + '<label><span data-k="want"></span><textarea name="want" maxlength="1500"></textarea></label>'
      + '<label><span data-k="links"></span><textarea name="links" maxlength="1000"></textarea></label>'
      + '<label><span data-k="pics"></span><input type="file" name="pics" accept="image/*" multiple></label>'
      + '<label class="rqc" hidden><input type="checkbox" name="rights"><span data-k="rights"></span></label>'
      + '<div class="rq2"><label><span data-k="name"></span><input type="text" name="name" maxlength="80" autocomplete="name"></label><label><span data-k="reply"></span><input type="email" name="reply" maxlength="120" autocomplete="email"></label></div>'
      + '<p class="rqpv" style="font-size:12.5px;margin:0 0 12px"><span></span><a href="privacy.html#forms"></a></p>'
      + '<label class="rqh" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>'
      + '<div class="rqm" role="status" aria-live="polite"></div><div class="rqa"><button type="button" data-x></button><button type="submit" class="pri"></button></div></form>';
    document.body.appendChild(dlg);
    const f = dlg.querySelector('form');
    f.pics.addEventListener('change', () => { f.rights.closest('label').hidden = !f.pics.files.length; });
    dlg.querySelector('[data-x]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    f.addEventListener('submit', e => { e.preventDefault(); submit(f); });
  }
  function texts(done) {
    const f = dlg.querySelector('form');
    dlg.querySelector('.rqpv span').textContent = t('priv'); dlg.querySelector('.rqpv a').textContent = t('privL');
    dlg.querySelector('#rqh').textContent = t('h'); dlg.querySelector('#rqp').textContent = t(kind === 'sim' ? 'pSim' : 'pFlows');
    dlg.querySelectorAll('[data-k]').forEach(s => { s.textContent = t(s.dataset.k); });
    f.aircraft.placeholder = t('acPh'); f.variant.placeholder = t('vrPh'); f.links.placeholder = t('linksPh');
    dlg.querySelector('[data-x]').textContent = t(done ? 'close' : 'cancel'); const sb = f.querySelector('[type=submit]'); sb.textContent = t('send'); sb.hidden = !!done; sb.disabled = false;
  }
  const msg = (s, ok) => { const m = dlg.querySelector('.rqm'); m.textContent = s || ''; m.classList.toggle('ok', !!ok); };
  function open(k, preset) {
    if (!dlg) build(); kind = k === 'flows' ? 'flows' : 'sim'; const f = dlg.querySelector('form'); f.reset(); f.rights.closest('label').hidden = true; msg(''); texts(false);
    if (preset) f.aircraft.value = preset;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); f.aircraft.focus();
  }
  /* a picture file -> base64 JPEG of at most about 380 kB */
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      let side = 1400, q = 0.8, out = '';
      for (let n = 0; n < 7; n++) {
        const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q).split(',')[1] || '';
        if (out && out.length * 3 / 4 <= 380000) return out;
        if (q > 0.6) q -= 0.1; else side = Math.round(side * 0.8);
      }
      throw new Error('too large');
    } finally { URL.revokeObjectURL(url); }
  }
  async function submit(f) {
    const sb = f.querySelector('[type=submit]'), files = [...f.pics.files];
    if (f.aircraft.value.trim().length < 2) { msg(t('eAc')); f.aircraft.focus(); return; }
    if (files.length > 3) { msg(t('eMany')); return; }
    if (files.length && !f.rights.checked) { msg(t('eRights')); f.rights.focus(); return; }
    sb.disabled = true; msg(t('sending'), true);
    let images = [];
    try { for (const fl of files) images.push({ name: fl.name, data: await shrink(fl) }); } catch (e) { msg(t('ePic')); sb.disabled = false; return; }
    const body = { kind, aircraft: f.aircraft.value, variant: f.variant.value, want: f.want.value, links: f.links.value, name: f.name.value, reply: f.reply.value, rights: f.rights.checked, images, website: f.website.value };
    try {
      const r = await fetch('/api/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); let j = null; try { j = await r.json(); } catch (e) {}
      if (r.ok && j && j.ok) { texts(true); msg(t('done'), true); return; }
      const m = j && T.eSrv[j.error]; msg(m ? m[no() ? 1 : 0] : t('eNet'));
    } catch (e) { msg(t('eNet')); }
    sb.disabled = false;
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-reqplane]'); if (!b) return; e.preventDefault(); const d = b.closest('details'); if (d) d.open = false; open(b.dataset.reqplane, b.dataset.reqplaneAc); });
  window.BBRequestPlane = { open };
})();
