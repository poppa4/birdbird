/* NORDAP – "Interested?" form for flight schools, operators and other organisations.
   Any element with data-schoolform opens it. Sent to /api/request (kind 'school', functions/api/request.js), which stores
   the message and e-mails it on. Same look as the aircraft request form (reqplane.js). */
(function () {
  'use strict';
  const no = () => document.documentElement.lang === 'nb';
  const T = {
    h: ['Interested in NORDAP?', 'Interessert i NORDAP?'],
    p: ['Tell us a little about your school or organisation. We will get back to you by e-mail.', 'Fortell litt om skolen eller organisasjonen din. Vi svarer deg på e-post.'],
    org: ['School or organisation', 'Skole eller organisasjon'], orgPh: ['e.g. Nordic Flight Academy', 'f.eks. Nordic Flight Academy'],
    country: ['Country (optional)', 'Land (valgfritt)'],
    name: ['Your name (optional)', 'Navnet ditt (valgfritt)'], role: ['Your role (optional)', 'Rollen din (valgfritt)'], rolePh: ['e.g. Head of training', 'f.eks. Head of training'],
    reply: ['Your e-mail', 'E-posten din'],
    size: ['Number of students or pilots (optional)', 'Antall elever eller piloter (valgfritt)'], sizePh: ['e.g. about 40', 'f.eks. rundt 40'],
    want: ['What are you interested in? (optional)', 'Hva er dere interessert i? (valgfritt)'], wantPh: ['e.g. the labs in class, the briefing pack, a type-rating setup', 'f.eks. labbene i undervisningen, briefingpakken, et typerating-oppsett'],
    send: ['Send', 'Send'], cancel: ['Cancel', 'Avbryt'], close: ['Close', 'Lukk'], sending: ['Sending…', 'Sender…'],
    done: ['Thank you. We have received your message and will get back to you.', 'Takk. Vi har fått meldingen din og tar kontakt.'],
    eOrg: ['Write the name of your school or organisation.', 'Skriv navnet på skolen eller organisasjonen.'],
    eMail: ['Write an e-mail address so we can answer you.', 'Skriv en e-postadresse, så vi kan svare deg.'],
    eNet: ['The message could not be sent. Check your connection and try again.', 'Meldingen kunne ikke sendes. Sjekk nettforbindelsen og prøv igjen.'],
    eSrv: { bad_request: ['Something in the form is not right. Check the fields and try again.', 'Noe i skjemaet stemmer ikke. Sjekk feltene og prøv igjen.'],
      rate_limited: ['You have sent several messages today. Try again tomorrow.', 'Du har sendt flere meldinger i dag. Prøv igjen i morgen.'],
      no_db: ['Messages cannot be received right now. Try again later.', 'Meldinger kan ikke tas imot akkurat nå. Prøv igjen senere.'] }
  };
  const t = k => T[k][no() ? 1 : 0];
  const css = 'dialog.rq{border:0;border-radius:14px;padding:22px;width:min(540px,94vw);max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);background:#fff;color:#13202A;font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;text-align:left}'
    + 'dialog.rq::backdrop{background:rgba(10,14,18,.55)}dialog.rq h3{margin:0 0 6px;font-size:20px;color:inherit}dialog.rq p{margin:0 0 14px;color:#4A5A66;font-size:14px}'
    + 'dialog.rq label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;margin:0 0 12px;color:inherit}'
    + 'dialog.rq input[type=text],dialog.rq input[type=email],dialog.rq textarea{font:inherit;font-weight:400;padding:10px;border:1px solid #B9C4CC;border-radius:6px;background:#fff;color:inherit;min-height:44px;width:100%;box-sizing:border-box}dialog.rq textarea{min-height:70px;resize:vertical}'
    + 'dialog.rq .rq2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}@media(max-width:520px){dialog.rq .rq2{grid-template-columns:1fr}}'
    + 'dialog.rq .rqh{position:absolute;left:-9999px}dialog.rq .rqm{min-height:20px;margin:0 0 10px;font-size:14px;color:#A32020}dialog.rq .rqm.ok{color:#17603A;font-weight:600}'
    + 'dialog.rq .rqa{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}dialog.rq .rqa button{font:inherit;font-weight:600;min-height:44px;padding:0 18px;border-radius:8px;border:1px solid #13202A;background:#fff;color:#13202A;cursor:pointer}'
    + 'dialog.rq .rqa button.pri{background:#0B5CAD;border-color:#0B5CAD;color:#fff}dialog.rq .rqa button:disabled{opacity:.55;cursor:default}';
  let dlg = null;
  function build() {
    if (!document.getElementById('rqcss')) { const s = document.createElement('style'); s.id = 'rqcss'; s.textContent = css; document.head.appendChild(s); }
    dlg = document.createElement('dialog'); dlg.className = 'rq'; dlg.setAttribute('aria-labelledby', 'sfh');
    dlg.innerHTML = '<form novalidate><h3 id="sfh"></h3><p id="sfp"></p>'
      + '<div class="rq2"><label><span data-k="org"></span><input type="text" name="org" maxlength="120" required autocomplete="organization"></label><label><span data-k="country"></span><input type="text" name="country" maxlength="60" autocomplete="country-name"></label></div>'
      + '<div class="rq2"><label><span data-k="name"></span><input type="text" name="name" maxlength="80" autocomplete="name"></label><label><span data-k="role"></span><input type="text" name="role" maxlength="80" autocomplete="organization-title"></label></div>'
      + '<div class="rq2"><label><span data-k="reply"></span><input type="email" name="reply" maxlength="120" required autocomplete="email"></label><label><span data-k="size"></span><input type="text" name="size" maxlength="40" autocomplete="off"></label></div>'
      + '<label><span data-k="want"></span><textarea name="want" maxlength="2000"></textarea></label>'
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
    dlg.querySelector('#sfh').textContent = t('h'); dlg.querySelector('#sfp').textContent = t('p');
    dlg.querySelectorAll('[data-k]').forEach(s => { s.textContent = t(s.dataset.k); });
    f.org.placeholder = t('orgPh'); f.role.placeholder = t('rolePh'); f.size.placeholder = t('sizePh'); f.want.placeholder = t('wantPh');
    dlg.querySelector('[data-x]').textContent = t(done ? 'close' : 'cancel'); const sb = f.querySelector('[type=submit]'); sb.textContent = t('send'); sb.hidden = !!done; sb.disabled = false;
  }
  const msg = (s, ok) => { const m = dlg.querySelector('.rqm'); m.textContent = s || ''; m.classList.toggle('ok', !!ok); };
  function open() {
    if (!dlg) build(); const f = dlg.querySelector('form'); f.reset(); msg(''); texts(false);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); f.org.focus();
  }
  async function submit(f) {
    const sb = f.querySelector('[type=submit]');
    if (f.org.value.trim().length < 2) { msg(t('eOrg')); f.org.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.reply.value.trim())) { msg(t('eMail')); f.reply.focus(); return; }
    sb.disabled = true; msg(t('sending'), true);
    const body = { kind: 'school', org: f.org.value, country: f.country.value, name: f.name.value, role: f.role.value, reply: f.reply.value.trim(), size: f.size.value, want: f.want.value, website: f.website.value };
    try {
      const r = await fetch('/api/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); let j = null; try { j = await r.json(); } catch (e) {}
      if (r.ok && j && j.ok) { texts(true); msg(t('done'), true); return; }
      const m = j && T.eSrv[j.error]; msg(m ? m[no() ? 1 : 0] : t('eNet'));
    } catch (e) { msg(t('eNet')); }
    sb.disabled = false;
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-schoolform]'); if (!b) return; e.preventDefault(); open(); });
  window.NDSchoolForm = { open };
})();
