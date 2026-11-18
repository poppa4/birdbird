/* NORDAP – document files in the cloud (Cloudflare R2) for signed-in users: the PDFs and other files in My workspace,
   so a document is never lost with a browser or a device. Used by functions/api/files/[[path]].js and by account deletion.

   R2 binding FILES (Cloudflare Pages → Settings → Bindings → R2 bucket, variable name FILES). Without it the API answers
   { enabled:false } and My workspace keeps files on the device only, as before.
   Free tier: 10 GB stored, 1 M uploads and 10 M downloads a month; NORDAP limits each user to QUOTA so one account cannot
   use it up. Objects: f/<user_id>/<file id>, private (never public, only served to the signed-in owner), with the file name,
   type and upload time as custom metadata. Deleting the account deletes the user's files.

   GET    /api/files            → { ok, enabled, used, quota, maxFile, files:[{ id, size, name, type, uploaded }] }
   PUT    /api/files/<id>       body = the file; headers content-type, x-file-name (URI-encoded) → { ok, id, size, used }
   GET    /api/files/<id>       → the file (private, no-store)
   DELETE /api/files/<id>       → { ok }
   Errors { ok:false, error, message }: 401 signed_out · 400 bad_id · 404 not_found · 413 too_large · 507 quota · 503 no_files */
export const QUOTA = 500 * 1024 * 1024, MAX_FILE = 60 * 1024 * 1024;
export const okId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{2,64}$/.test(id);
const prefix = uid => 'f/' + uid + '/';
export async function listFiles(bucket, uid) {
  const out = []; let cursor;
  do {
    const r = await bucket.list({ prefix: prefix(uid), cursor, include: ['customMetadata'] });
    for (const o of r.objects) out.push({ id: o.key.slice(prefix(uid).length), size: o.size, name: (o.customMetadata && o.customMetadata.name) || '', type: (o.customMetadata && o.customMetadata.type) || '', uploaded: o.uploaded ? new Date(o.uploaded).getTime() : null });
    cursor = r.truncated ? r.cursor : undefined;
  } while (cursor);
  return out;
}
export async function deleteAllFiles(env, uid) {
  if (!env || !env.FILES || !uid) return 0;
  const all = await listFiles(env.FILES, uid); let n = 0;
  for (let i = 0; i < all.length; i += 1000) { const keys = all.slice(i, i + 1000).map(f => prefix(uid) + f.id); await env.FILES.delete(keys); n += keys.length; }
  return n;
}
export { prefix as filePrefix };
