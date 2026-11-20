/* NORDAP – contact form, on every page: the "Contact" and "Report an error" links in the footer and any element with
   data-contactform (optional data-topic="general|content|technical|privacy"). Loaded by site.js on the first click.
   Sent to /api/request (kind 'contact', functions/api/request.js), which stores the message and e-mails it on.
   Same look as the school form (schoolform.js) and the aircraft request form (reqplane.js). */
(function () {
  'use strict';
  if (window.NDContactForm) return;
  const no = () => document.documentElement.lang === 'nb';
  const T = {
    h: ['Contact NORDAP', 'Kontakt NORDAP'],
    p: ['Questions, an error in the content, a technical problem or a privacy request. We answer by e-mail.', 'Spørsmål, en faglig feil, et teknisk problem eller en personvernforespørsel. Vi svarer på e-post.'],
    topic: ['What is it about?', 'Hva gjelder det?'],
    general: ['A question or a comment', 'Et spørsmål eller en kommentar'], content: ['An error in the content', 'En faglig feil'],
    technical: ['A technical problem', 'Et teknisk problem'], privacy: ['Privacy: see, correct or delete my data', 'Personvern: se, rette eller slette dataene mine'],
    name: ['Your name (optional)', 'Navnet ditt (valgfritt)'], reply: ['Your e-mail', 'E-posten din'],
    want: ['Message', 'Melding'], wantPh: ['For an error: what is wrong, and what should it say?', 'For en feil: hva er feil, og hva burde stå?'],
    page: ['Page: ', 'Side: '],
    priv: ['Your message and e-mail address are used only to answer you, and are deleted 90 days after they reach NORDAP. ', 'Meldingen og e-postadressen brukes bare til å svare deg, og slettes 90 dager etter at de har kommet fram til NORDAP. '],
    privL: ['Privacy', 'Personvern'],
    send: ['Send', 'Send'], cancel: ['Cancel', 'Avbryt'], close: ['Close', 'Lukk'], sending: ['Sending…', 'Sender…'],
    done: ['Thank you. We have received your message and will answer by e-mail.', 'Takk. Vi har fått meldingen din og svarer på e-post.'],
    eMail: ['Write an e-mail address so we can answer you.', 'Skriv en e-postadresse, så vi kan svare deg.'],
    eWant: ['Write your message.', 'Skriv meldingen din.'],
    eNet: ['The message could not be sent. Check your connection and try again.', 'Meldingen kunne ikke sendes. Sjekk nettforbindelsen og prøv igjen.'],
    eSrv: { bad_request: ['Something in the form is not right. Check the fields and try again.', 'Noe i skjemaet stemmer ikke. Sjekk feltene og prøv igjen.'],
      rate_limited: ['You have sent several messages today. Try again tomorrow.', 'Du har sendt flere meldinger i dag. Prøv igjen i morgen.'],
      no_db: ['Messages cannot be received right now. Try again later.', 'Meldinger kan ikke tas imot akkurat nå. Prøv igjen senere.'] }
  };
  const t = k => T[k][no() ? 1 : 0];
  const TOPICS = ['general', 'content', 'technical', 'privacy'];
  const css = 'dialog.rq{border:0;border-radius:14px;padding:22px;width:min(540px,94vw);max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);background:#fff;color:#13202A;font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;text-align:left}'
    + 'dialog.rq::backdrop{background:rgba(10,14,18,.55)}dialog.rq h3{margin:0 0 6px;font-size:20px;color:inherit}dialog.rq p{margin:0 0 14px;color:#4A5A66;font-size:14px}'
    + 'dialog.rq label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;margin:0 0 12px;color:inherit}'
    + 'dialog.rq input[type=text],dialog.rq input[type=email],dialog.rq textarea{font:inherit;font-weight:400;padding:10px;border:1px solid #B9C4CC;border-radius:6px;background:#fff;color:inherit;min-height:44px;width:100%;box-sizing:border-box}dialog.rq textarea{min-height:70px;resize:vertical}'
    + 'dialog.rq .rq2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}@media(max-width:520px){dialog.rq .rq2{grid-template-columns:1fr}}'
    + 'dialog.rq .rqh{position:absolute;left:-9999px}dialog.rq .rqm{min-height:20px;margin:0 0 10px;font-size:14px;color:#A32020}dialog.rq .rqm.ok{color:#17603A;font-weight:600}'
    + 'dialog.rq .rqa{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}dialog.rq .rqa button{font:inherit;font-weight:600;min-height:44px;padding:0 18px;border-radius:8px;border:1px solid #13202A;background:#fff;color:#13202A;cursor:pointer}'
    + 'dialog.rq .rqa button.pri{background:#0B5CAD;border-color:#0B5CAD;color:#fff}dialog.rq .rqa button:disabled{opacity:.55;cursor:default}';
  
  let dlg = null, page = '';
  function build() {
    if (!document.getElementById('rqcss')) { const s = document.createElement('style'); s.id = 'rqcss'; s.textContent = css; document.head.appendChild(s); }
    dlg = document.createElement('dialog'); dlg.className = 'rq'; dlg.setAttribute('aria-labelledby', 'cfh');
    dlg.innerHTML = '<form novalidate><h3 id="cfh"></h3><p id="cfp"></p>'
      + '<label><span data-k="topic"></span><select name="topic" style="font:inherit;font-weight:400;padding:10px;border:1px solid #B9C4CC;border-radius:6px;background:#fff;color:inherit;min-height:44px">' + TOPICS.map(k => '<option value="' + k + '" data-k="' + k + '"></option>').join('') + '</select></label>'
      + '<div class="rq2"><label><span data-k="name"></span><input type="text" name="name" maxlength="80" autocomplete="name"></label><label><span data-k="reply"></span><input type="email" name="reply" maxlength="120" required autocomplete="email"></label></div>'
      + '<label><span data-k="want"></span><textarea name="want" maxlength="3000" required></textarea></label>'
      + '<p class="cfpg" style="font-size:12.5px;margin:-4px 0 10px"></p>'
      + '<p class="cfpv" style="font-size:12.5px;margin:0 0 12px"><span></span><a href="privacy.html#forms"></a></p>'
      + '<label class="rqh" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>'
      + '<div class="rqm" role="status" aria-live="polite"></div><div class="rqa"><button type="button" data-x></button><button type="submit" class="pri"></button></div></form>';
    document.body.appendChild(dlg);
    const f = dlg.querySelector('form');
    dlg.querySelector('[data-x]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    f.addEventListener('submit', e => { e.preventDefault(); submit(f); });
  }
  function texts(done) {
    const f = dlg.querySelector('form');
    dlg.querySelector('#cfh').textContent = t('h'); dlg.querySelector('#cfp').textContent = t('p');
    dlg.querySelectorAll('[data-k]').forEach(s => { s.textContent = t(s.dataset.k); });
    f.want.placeholder = t('wantPh');
    dlg.querySelector('.cfpg').textContent = page ? t('page') + page : '';
    dlg.querySelector('.cfpv span').textContent = t('priv'); dlg.querySelector('.cfpv a').textContent = t('privL');
    dlg.querySelector('[data-x]').textContent = t(done ? 'close' : 'cancel'); const sb = f.querySelector('[type=submit]'); sb.textContent = t('send'); sb.hidden = !!done; sb.disabled = false;
  }
  const msg = (s, ok) => { const m = dlg.querySelector('.rqm'); m.textContent = s || ''; m.classList.toggle('ok', !!ok); };
  function open(topic) {
    if (!dlg) build(); const f = dlg.querySelector('form'); f.reset(); msg('');
    page = (location.pathname.replace(/^\//, '') || 'index.html') + location.hash;
    f.topic.value = TOPICS.includes(topic) ? topic : 'general'; texts(false);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); (f.topic.value === 'general' ? f.topic : f.want).focus();
  }
  async function submit(f) {
    const sb = f.querySelector('[type=submit]');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.reply.value.trim())) { msg(t('eMail')); f.reply.focus(); return; }
    if (f.want.value.trim().length < 5) { msg(t('eWant')); f.want.focus(); return; }
    sb.disabled = true; msg(t('sending'), true);
    const body = { kind: 'contact', topic: f.topic.value, name: f.name.value, reply: f.reply.value.trim(), want: f.want.value, page, website: f.website.value };
    try {
      const r = await fetch('/api/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); let j = null; try { j = await r.json(); } catch (e) {}
      if (r.ok && j && j.ok) { texts(true); msg(t('done'), true); return; }
      const m = j && T.eSrv[j.error]; msg(m ? m[no() ? 1 : 0] : t('eNet'));
    } catch (e) { msg(t('eNet')); }
    sb.disabled = false;
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-contactform]'); if (!b) return; e.preventDefault(); open(b.dataset.topic); });
  window.NDContactForm = { open };
})();
