/* Paths that live in the repository but must not be served by Cloudflare Pages (setup notes, SQL, tests).
   Pages cannot answer 404 from _redirects (only 200/301/302/303/307/308), so these tiny Functions do it. */
export function onRequest() {
  return new Response('Not found\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
