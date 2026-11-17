/* NORDAP – the shared flow library in the flow trainer (flows.html). Server: functions/api/flowlib.js.
   Browse flows other pilots have shared and open a copy; share your own flow (only on a NORDAP cockpit, never your own picture). */
(function () {
  'use strict';
  const F = window.BBFLOW, A = window.BBFLOWAC, L = o => window.LAB.L(o), B = () => window.BBFLOWS;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const phName = id => { const p = F.PHASES.find(x => x[0] === id); return p ? L({ en: p[1], no: p[2] }) : ''; };
  const phOpts = (sel, first) => `<option value="">${esc(first)}</option>` + F.PHASES.map(p => `<option value="${p[0]}"${sel === p[0] ? ' selected' : ''}>${esc(L({ en: p[1], no: p[2] }))}</option>`).join('');
  const MINE = 'bb-flowlib-mine', mine = () => { try { return JSON.parse(localStorage.getItem(MINE) || '{}') || {}; } catch (e) { return {}; } }, setMine = o => { try { localStorage.setItem(MINE, JSON.stringify(o)); } catch (e) {} };
  const api = async (m, q, body) => { try { const r = await fetch('/api/flowlib' + (q || ''), { method: m, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => null); return j || { ok: false }; } catch (e) { return { ok: false }; } };
  const NET = () => L({ en: 'The library could not be reached. Check your connection and try again.', no: 'Fikk ikke kontakt med biblioteket. Sjekk nettforbindelsen og prøv igjen.' });
  let dlg = null;
  function box() { if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'fd fl'; document.body.appendChild(dlg); dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); } return dlg; }
  const errMsg = j => !j || !j.error ? NET() : document.documentElement.lang === 'nb' || !j.message ? L({ en: 'The flow could not be shared. Try again.', no: 'Flowen kunne ikke deles. Prøv igjen.' }) : j.message;

  /* ---------- browse ---------- */
  let flt = { ac: null, phase: '' };
  async function browse() { const d = box(), cur = B().cur; if (flt.ac == null) flt.ac = cur && A.get(cur.ac) ? cur.ac : '';
    d.innerHTML = `<h3>${L({ en: 'Flow library', no: 'Flow-bibliotek' })}</h3>` +
      `<p class="fln">${L({ en: 'Flows marked NORDAP follow the public handbook checklist for the type. The others are made by users and not checked by NORDAP. None of them is an SOP: open a copy, then check and change it against your operator’s documents.', no: 'Flows merket NORDAP følger den åpne håndbok-sjekklisten for typen. De andre er laget av brukere og ikke kontrollert av NORDAP. Ingen av dem er en SOP: åpne en kopi, og sjekk og endre den mot operatørens dokumenter.' })}</p>` +
      `<div class="flf"><label>${L({ en: 'Cockpit', no: 'Cockpit' })}<select id="flac"><option value="">${L({ en: 'All', no: 'Alle' })}</option>${B().acOpts(flt.ac)}</select></label>` +
      `<label>${L({ en: 'Flight phase', no: 'Flyfase' })}<select id="flph">${phOpts(flt.phase, L({ en: 'All', no: 'Alle' }))}</select></label></div>` +
      `<ul id="fll"><li>${L({ en: 'Loading…', no: 'Laster …' })}</li></ul><div class="acts"><button class="btn" data-x>${L({ en: 'Close', no: 'Lukk' })}</button><button class="btn pri" data-pub>${L({ en: 'Share one of mine', no: 'Del en av mine' })}</button></div>`;
    d.querySelector('[data-x]').onclick = () => d.close(); d.querySelector('[data-pub]').onclick = () => publish();
    d.querySelector('#flac').onchange = e => { flt.ac = e.target.value; list(); }; d.querySelector('#flph').onchange = e => { flt.phase = e.target.value; list(); };
    if (!d.open) d.showModal(); list(); }
  async function list() { const ul = dlg.querySelector('#fll'); if (!ul) return; const j = await api('GET', '?ac=' + encodeURIComponent(flt.ac || '') + '&phase=' + encodeURIComponent(flt.phase || '')); if (!dlg.querySelector('#fll')) return;
    const no = document.documentElement.lang === 'nb', std = F.stdList().filter(f => (!flt.ac || f.ac === flt.ac) && (!flt.phase || f.phase === flt.phase));
    const stdH = std.map(f => { const a = A.get(f.ac); return `<li data-id="${esc(f.id)}" class="flbb"><div><b>${esc(f.name[no ? 'no' : 'en'])}</b><small>${esc([a ? a.name : f.ac, phName(f.phase), f.n + ' ' + L({ en: 'steps', no: 'steg' }), 'NORDAP · ' + L({ en: 'from: ', no: 'fra: ' }) + f.src].filter(Boolean).join(' · '))}</small></div><button class="btn sm pri" data-o>${L({ en: 'Open a copy', no: 'Åpne en kopi' })}</button></li>`; }).join('');
    const openStd = async id => { const f = F.stdFlow(id, A, no); if (!f) return; dlg.close(); await B().addFlow(f); B().msg(L({ en: 'A copy is now among your flows. It follows the public handbook checklist for the type, not your operator’s SOP: check it before you train on it.', no: 'En kopi ligger nå blant dine flows. Den følger den åpne håndbok-sjekklisten for typen, ikke operatørens SOP: sjekk den før du trener på den.' }), 'ok'); };
    if (!j.ok) { ul.innerHTML = stdH || `<li>${esc(NET())}</li>`; ul.onclick = e => { const b = e.target.closest('button[data-o]'), li = e.target.closest('li[data-id]'); if (b && li) openStd(li.dataset.id); }; return; }
    const M = mine();
    ul.innerHTML = stdH + (j.flows.length ? j.flows.map(f => { const a = A.get(f.ac); return `<li data-id="${esc(f.id)}"><div><b>${esc(f.name)}</b><small>${esc([a ? a.name : f.ac, phName(f.phase), f.n + ' ' + L({ en: 'steps', no: 'steg' }), f.roles, f.by ? L({ en: 'by ', no: 'av ' }) + f.by : '', f.uses ? L({ en: `opened ${f.uses} times`, no: `åpnet ${f.uses} ganger` }) : ''].filter(Boolean).join(' · '))}</small></div>` +
        `<button class="btn sm pri" data-o${a ? '' : ' disabled'}>${L({ en: 'Open a copy', no: 'Åpne en kopi' })}</button>${M[f.id] ? `<button class="lk" data-d>${L({ en: 'Remove', no: 'Fjern' })}</button>` : `<button class="lk" data-r>${L({ en: 'Report', no: 'Rapporter' })}</button>`}</li>`; }).join('')
      : stdH ? '' : `<li>${L({ en: 'No flows here yet. Be the first to share one.', no: 'Ingen flows her ennå. Bli den første som deler en.' })}</li>`);
    ul.onclick = async e => { const b = e.target.closest('button'), li = e.target.closest('li[data-id]'); if (!b || !li) return; const id = li.dataset.id;
      if (id.startsWith('bb:')) { if (b.hasAttribute('data-o')) openStd(id); return; }
      if (b.hasAttribute('data-o')) { b.disabled = true; const r = await api('GET', '?id=' + encodeURIComponent(id)); if (!r.ok || !r.flow) { b.disabled = false; B().msg(NET(), 'err'); return; }
        const f = F.clean(r.flow); if (!f || !A.get(f.ac)) { b.disabled = false; return; } f.id = F.uid(); dlg.close(); await B().addFlow(f);
        B().msg(L({ en: 'A copy is now among your flows. Check it against your operator’s documents before you train on it.', no: 'En kopi ligger nå blant dine flows. Sjekk den mot operatørens dokumenter før du trener på den.' }), 'ok'); return; }
      if (b.hasAttribute('data-r')) { b.disabled = true; await api('POST', '', { report: id }); b.textContent = L({ en: 'Reported, thank you', no: 'Rapportert, takk' }); return; }
      if (b.hasAttribute('data-d')) { const M2 = mine(); b.disabled = true; const r = await api('DELETE', '?id=' + encodeURIComponent(id) + '&key=' + encodeURIComponent(M2[id])); if (r.ok || r.error === 'not_found') { delete M2[id]; setMine(M2); list(); } else b.disabled = false; } }; }

  /* ---------- share ---------- */
  function publish() { const cur = B().cur, d = box(); const why = !cur || cur.ex ? L({ en: 'Open one of your own flows first. An example cannot be shared.', no: 'Åpne en av dine egne flows først. Et eksempel kan ikke deles.' })
      : !A.get(cur.ac) ? L({ en: 'Only flows on a NORDAP cockpit can be shared. A flow on your own picture stays with you, because pictures are never shared.', no: 'Bare flows på en NORDAP-cockpit kan deles. En flow på ditt eget bilde blir hos deg, fordi bilder aldri deles.' })
      : cur.steps.filter(s => s.k === 'act' && F.placed(s)).length < 3 ? L({ en: 'Place at least three steps on the cockpit before you share the flow.', no: 'Plasser minst tre steg i cockpiten før du deler flowen.' }) : '';
    if (why) { if (d.open) d.close(); B().msg(why, 'err'); return; }
    let by = ''; try { by = localStorage.getItem('bb-flowlib-by') || ''; } catch (e) {}
    d.innerHTML = `<form><h3>${L({ en: 'Share with other pilots', no: 'Del med andre piloter' })}</h3>` +
      `<p class="fln">${L({ en: 'Everyone can see the flow and open a copy. You can remove it again from this device.', no: 'Alle kan se flowen og åpne en kopi. Du kan fjerne den igjen fra denne enheten.' })}</p>` +
      `<label>${L({ en: 'Name', no: 'Navn' })}<input id="fpn" maxlength="80" value="${esc(cur.name)}"></label>` +
      `<div class="flf"><label>${L({ en: 'Flight phase', no: 'Flyfase' })}<select id="fpp">${phOpts(cur.phase || '', L({ en: 'Not set', no: 'Ikke satt' }))}</select></label><label>${L({ en: 'Your name or callsign (optional)', no: 'Navn eller kallesignal (valgfritt)' })}<input id="fpb" maxlength="30" value="${esc(by)}"></label></div>` +
      `<label class="flc"><input type="checkbox" id="fpr"><span>${L({ en: 'I made this flow myself. It has nothing confidential from my operator, and others may use and change it.', no: 'Jeg har laget denne flowen selv. Den har ikke noe konfidensielt fra operatøren min, og andre kan bruke og endre den.' })}</span></label>` +
      `<p class="flm" role="status"></p><div class="acts"><button type="button" class="btn" data-x>${L({ en: 'Cancel', no: 'Avbryt' })}</button><button class="btn pri">${L({ en: 'Share', no: 'Del' })}</button></div></form>`;
    const m = t => { d.querySelector('.flm').textContent = t || ''; }; d.querySelector('[data-x]').onclick = () => d.close(); d.querySelector('#fpr').onchange = () => m('');
    d.querySelector('form').onsubmit = async e => { e.preventDefault(); const sb = d.querySelector('button.pri');
      if (!d.querySelector('#fpr').checked) { m(L({ en: 'Tick the box first.', no: 'Kryss av i boksen først.' })); return; }
      const name = d.querySelector('#fpn').value.trim(); if (name.length < 3) { m(L({ en: 'Give the flow a name.', no: 'Gi flowen et navn.' })); return; }
      const flow = JSON.parse(JSON.stringify(cur)); flow.name = name; flow.phase = d.querySelector('#fpp').value || undefined; const who = d.querySelector('#fpb').value.trim(); try { localStorage.setItem('bb-flowlib-by', who); } catch (x) {}
      sb.disabled = true; const r = await api('POST', '', { flow, by: who, rights: true });
      if (!r.ok) { sb.disabled = false; m(r.error === 'rate_limited' ? L({ en: 'You have shared several flows today. Try again tomorrow.', no: 'Du har delt flere flows i dag. Prøv igjen i morgen.' }) : r.error === 'bad_request' && /Links/.test(r.message || '') ? L({ en: 'Links are not allowed in a shared flow. Remove them and try again.', no: 'Lenker er ikke tillatt i en delt flow. Fjern dem og prøv igjen.' }) : errMsg(r)); return; }
      const M = mine(); M[r.id] = r.key; setMine(M); d.close(); B().msg(L({ en: 'Shared. Other pilots can now find it under Flows from other pilots.', no: 'Delt. Andre piloter finner den nå under Flows fra andre piloter.' }), 'ok'); };
    if (!d.open) d.showModal(); }
  window.BBFLOWLIB = { browse, publish };
})();
