/* NORDAP – Cloudflare Pages Function: /api/files and /api/files/<id> – document files in the cloud (R2) for the signed-in
   user. What, where and the limits: functions/_lib/files.js. */
import { endpoint, json, requireSession, limit, fail } from '../../_lib/api.js';
import { QUOTA, MAX_FILE, okId, listFiles, filePrefix } from '../../_lib/files.js';

const idOf = c => { const p = c.url.pathname.replace(/^\/api\/files\/?/, ''); if (!p) return null; const id = decodeURIComponent(p); if (!okId(id)) fail(400, 'bad_id', 'That is not a valid file id.'); return id; };
const bucket = c => { if (!c.env.FILES) fail(503, 'no_files', 'Cloud storage for documents is not switched on for this site yet. Your files stay on this device.'); return c.env.FILES; };

async function get(c) {
  const s = await requireSession(c); const id = idOf(c);
  if (!id) {
    if (!c.env.FILES) return json({ ok: true, enabled: false });
    await limit(c, 'sync', s.user_id);
    const files = await listFiles(c.env.FILES, s.user_id);
    return json({ ok: true, enabled: true, used: files.reduce((a, f) => a + f.size, 0), quota: QUOTA, maxFile: MAX_FILE, files });
  }
  await limit(c, 'sync', s.user_id);
  const o = await bucket(c).get(filePrefix(s.user_id) + id);
  if (!o) fail(404, 'not_found', 'This file is not in your cloud storage.');
  const m = o.customMetadata || {};
  return new Response(o.body, { headers: { 'content-type': m.type || 'application/octet-stream', 'content-length': String(o.size), 'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff', 'content-disposition': 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(m.name || id), 'x-file-name': encodeURIComponent(m.name || '') } });
}
async function put(c) {
  const s = await requireSession(c); const id = idOf(c); if (!id) fail(400, 'bad_id', 'Say which file.');
  const b = bucket(c); await limit(c, 'write', s.user_id);
  const len = +(c.request.headers.get('content-length') || 0);
  if (len > MAX_FILE) fail(413, 'too_large', 'This file is larger than ' + Math.round(MAX_FILE / 1048576) + ' MB and stays on this device only.');
  const body = await c.request.arrayBuffer();
  if (!body.byteLength) fail(400, 'bad_request', 'The file was empty.');
  if (body.byteLength > MAX_FILE) fail(413, 'too_large', 'This file is larger than ' + Math.round(MAX_FILE / 1048576) + ' MB and stays on this device only.');
  const files = await listFiles(b, s.user_id), old = files.find(f => f.id === id);
  const used = files.reduce((a, f) => a + f.size, 0) - (old ? old.size : 0);
  if (used + body.byteLength > QUOTA) fail(507, 'quota', 'Your cloud storage for documents is full (' + Math.round(QUOTA / 1048576) + ' MB). The file stays on this device.', { used, quota: QUOTA });
  let name = ''; try { name = decodeURIComponent(c.request.headers.get('x-file-name') || '').slice(0, 200); } catch (e) {}
  const type = String(c.request.headers.get('content-type') || 'application/octet-stream').slice(0, 100);
  await b.put(filePrefix(s.user_id) + id, body, { customMetadata: { name, type }, httpMetadata: { contentType: type } });
  return json({ ok: true, id, size: body.byteLength, used: used + body.byteLength, quota: QUOTA });
}
async function del(c) {
  const s = await requireSession(c); const id = idOf(c); if (!id) fail(400, 'bad_id', 'Say which file.');
  const b = bucket(c); await limit(c, 'write', s.user_id);
  await b.delete(filePrefix(s.user_id) + id);
  return json({ ok: true });
}
export const onRequest = endpoint({ GET: get, PUT: put, DELETE: del });
