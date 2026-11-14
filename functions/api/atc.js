/* Birdbird – Cloudflare Pages Function: Flight Intelligence (the AI behind ai.js: Ask your documents, fi.html, the radio trainer, …).

   GET  /api/atc   -> 200 { ok:true }                                  the service can be used by this signed-in user
                      200 { ok:false, reason:'not_configured' }        no API key, no database or migration 0002 not applied
                      200 { ok:false, reason:'signed_out' }            (200 on purpose: no red lines in the browser console)
   POST /api/atc   { messages:[{ role:'user'|'assistant', content:'…' }, …], tier?:'quick'|'default'|'high' }
                   -> 200 { ok:true, text, truncated }
                   errors { ok:false, error, message }:
                      400 bad_request · 401 signed_out · 403 bad_origin · 413 too_large | prompt_too_large · 422 refused
                      429 rate_limited (per minute) | daily_limit (this user, today) | service_limit (whole site, today)
                      502 upstream_error · 503 not_configured | busy · 504 timeout

   Two engines; the first one that is set up is used:
   1. Anthropic Messages API (paid) when the secret ANTHROPIC_API_KEY is set – see below.
   2. Cloudflare Workers AI (free) when the Pages project has a Workers AI binding named AI. Free allocation: 10,000 Neurons
      per UTC day for the whole Cloudflare account; WORKERS_LIMITS below keep the site inside it (and if it is used up anyway,
      Cloudflare refuses the call and the user gets "service_limit" – on the Workers Free plan nothing is ever billed).
      Tokens are counted as input + 2 × output, roughly how Neurons are charged for the model.

   The paid answer comes from the Anthropic Messages API (https://api.anthropic.com/v1/messages) with the key in the Cloudflare
   secret ANTHROPIC_API_KEY. The key is only ever put in the x-api-key header of that one request: never logged, never returned.
   Nothing of the question or the answer is stored or logged; D1 keeps counters only (user id, UTC day, requests, tokens).

   Cost protection, all enforced here on the server:
   - signed-in users only, same-origin JSON POST only (the checks in functions/_lib/api.js);
   - a per-minute limit per user (LIMITS.ai there), a daily request cap and a daily token cap per user, and the same for the
     whole site; the request counters are raised before the model is called, so parallel requests cannot slip past them;
   - a body size limit, a prompt size limit and a fixed max_tokens;
   - the model is chosen here from the tier, never by the client; tokens on the stronger model count MODELS[..].weight times
     against the caps (its price relative to the default model), so the worst-case daily cost is the same whatever the tier. */

import { endpoint, json, getSession, requireSession, readJson, limit, fail } from '../_lib/api.js';

/* ---------- limits (each can be overridden with an environment variable of the same name, prefixed ATC_) ---------- */
const DEFAULTS = {
  USER_DAILY_REQUESTS: 50,        // questions per user per UTC day
  USER_DAILY_TOKENS: 200000,      // input + output tokens per user per UTC day (default-model units)
  GLOBAL_DAILY_REQUESTS: 1000,    // questions for the whole site per UTC day
  GLOBAL_DAILY_TOKENS: 4000000,   // tokens for the whole site per UTC day (default-model units)
  MAX_INPUT_CHARS: 60000,         // all message text in one request
  MAX_OUTPUT_TOKENS: 1500,        // max_tokens sent to the model
  TIMEOUT_MS: 45000               // how long we wait for the model
};
/* free engine (Workers AI): smaller caps so the daily 10,000 free Neurons are not exceeded (≈ 300k counted tokens on gpt-oss-120b) */
const WORKERS_LIMITS = {
  USER_DAILY_REQUESTS: 25,
  USER_DAILY_TOKENS: 60000,
  GLOBAL_DAILY_REQUESTS: 300,
  GLOBAL_DAILY_TOKENS: 300000,
  MAX_OUTPUT_TOKENS: 2500         // gpt-oss reasons before it answers; the reasoning counts here too
};
const WORKERS_MODELS = ['@cf/openai/gpt-oss-120b', '@cf/zai-org/glm-4.7-flash']; // second one only if the first errors
const WORKERS_SYSTEM = 'You are Flight Intelligence in Birdbird, a European (EASA) preparation platform for pilots. '
  + 'Follow the instructions in the user message exactly, including language and output format. Use EASA/SERA terms and standards, not FAA. '
  + 'Never invent regulation references, figures or limitations; if something is not in the material given and you are not sure, say so.';
const MAX_BODY_BYTES = 200000;    // the JSON body of one POST
const MAX_MESSAGES = 40;

/* Model allow-list (IDs and prices: https://platform.claude.com/docs/en/models/overview, checked 2026-11-13).
   Thinking is switched off so that max_tokens bounds the whole billed output (thinking tokens are billed as output):
   Haiku 5.5 takes { type:'disabled' }; Sonnet 5.5 rejects that and takes { type:'between_tools' } (no tools here = text only). */
const MODELS = {
  default: { id: 'claude-haiku-5-5', weight: 1, thinking: { type: 'disabled' } },          // $0.10 in / $0.50 out per million tokens
  high: { id: 'claude-sonnet-5-5', weight: 20, thinking: { type: 'between_tools' } }       // $2 in / $10 out per million tokens
};
const TIERS = { quick: 'default', default: 'default', high: 'high' };
const UPSTREAM = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const GLOBAL = '*';

function limitsFor(env, engine) {
  const base = engine === 'workers' ? Object.assign({}, DEFAULTS, WORKERS_LIMITS) : DEFAULTS;
  const L = {};
  for (const k of Object.keys(base)) { const n = Number(env && env['ATC_' + k]); L[k] = Number.isFinite(n) && n > 0 ? Math.floor(n) : base[k]; }
  return L;
}
const hasWorkersAI = env => !!(env && env.AI && typeof env.AI.run === 'function');
const engineOf = env => keyOf(env) ? 'anthropic' : hasWorkersAI(env) ? 'workers' : '';
const keyOf = env => { const k = env && typeof env.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY.trim() : ''; return k && !/\s/.test(k) ? k : ''; };
const dayOf = ms => new Date(ms).toISOString().slice(0, 10);
const notConfigured = () => fail(503, 'not_configured', 'Flight Intelligence is not switched on for this site yet.');

/* ---------- GET: can this visitor use the service? ---------- */
async function atcGet(c) {
  const o = c.request.headers.get('origin');
  if (o && o !== c.url.origin) fail(403, 'bad_origin', 'This request did not come from Birdbird itself.');
  const s = await getSession(c);
  if (!s) return json({ ok: false, reason: 'signed_out' });
  try { await c.db.prepare('SELECT 1 FROM ai_usage LIMIT 1').first(); }
  catch (e) { return json({ ok: false, reason: 'not_configured' }, 200, { 'set-cookie': c.setCookie }); }
  return json({ ok: true }, 200, { 'set-cookie': c.setCookie });
}

/* ---------- POST: one question ---------- */
function readMessages(body, L) {
  const m = body.messages;
  if (!Array.isArray(m) || !m.length || m.length > MAX_MESSAGES) fail(400, 'bad_request', 'Send between 1 and ' + MAX_MESSAGES + ' messages.');
  let chars = 0;
  const out = m.map((x, i) => {
    const role = x && x.role, content = x && x.content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim()) fail(400, 'bad_request', 'Each message needs a role (user or assistant) and text.');
    if (role !== (i % 2 ? 'assistant' : 'user')) fail(400, 'bad_request', 'Messages must alternate, starting with the user.');
    chars += content.length;
    return { role, content };
  });
  if (out[out.length - 1].role !== 'user') fail(400, 'bad_request', 'The last message must be from the user.');
  if (chars > L.MAX_INPUT_CHARS) fail(413, 'prompt_too_large', 'Too much text at once. Pick fewer documents or ask a shorter question.');
  return out;
}

/* raise the request counter first (atomic), then compare with the caps */
async function countRequest(c, who, day) {
  return c.db.prepare(
    `INSERT INTO ai_usage (user_id, day, requests, tokens) VALUES (?1, ?2, 1, 0)
     ON CONFLICT(user_id, day) DO UPDATE SET requests = ai_usage.requests + 1
     RETURNING requests, tokens`).bind(who, day).first();
}
async function reserve(c, userId, day, L) {
  let u, g;
  try {
    u = await countRequest(c, userId, day);
    if (u.requests > L.USER_DAILY_REQUESTS || u.tokens >= L.USER_DAILY_TOKENS) return 'daily_limit';
    g = await countRequest(c, GLOBAL, day);
    if (g.requests > L.GLOBAL_DAILY_REQUESTS || g.tokens >= L.GLOBAL_DAILY_TOKENS) return 'service_limit';
  } catch (e) { notConfigured(); } // migration 0002 not applied
  return null;
}
async function addTokens(c, userId, day, n) {
  if (!(n > 0)) return;
  const st = who => c.db.prepare('UPDATE ai_usage SET tokens = tokens + ?1 WHERE user_id = ?2 AND day = ?3').bind(n, who, day);
  const stmts = [st(userId), st(GLOBAL)];
  await c.db.batch(stmts);
}

async function callModel(c, key, model, messages, L) {
  const fetchFn = c.deps.fetch || fetch;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), L.TIMEOUT_MS);
  let res, data = null;
  const send = async thinking => {
    const payload = { model: model.id, max_tokens: L.MAX_OUTPUT_TOKENS, messages };
    if (thinking) payload.thinking = thinking;
    res = await fetchFn(UPSTREAM, {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': key, 'anthropic-version': API_VERSION, 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    try { data = await res.json(); } catch (e) { data = null; }
  };
  try {
    await send(model.thinking);
    // if the API ever stops accepting the thinking setting, ask once more with its default (max_tokens still bounds the cost)
    if (res.status === 400 && data && data.error && data.error.type === 'invalid_request_error') await send(null);
    if (ctl.signal.aborted) throw new Error('aborted');
  } catch (e) {
    if (ctl.signal.aborted) fail(504, 'timeout', 'The answer took too long. Try again, or ask a shorter question.');
    console.error('birdbird atc: upstream unreachable'); // no error text: nothing from the request may reach the log
    fail(502, 'upstream_error', 'The AI service could not be reached. Try again in a minute.');
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    const type = data && data.error && typeof data.error.type === 'string' ? data.error.type.slice(0, 40) : '';
    console.error('birdbird atc: upstream status ' + res.status + (type ? ' ' + type : ''));
    if (res.status === 429 || res.status === 529 || res.status === 503) fail(503, 'busy', 'The AI service is busy right now. Wait a moment and try again.', { retryAfter: 20 });
    if (res.status === 413) fail(413, 'prompt_too_large', 'Too much text at once. Pick fewer documents or ask a shorter question.');
    if (res.status === 504) fail(504, 'timeout', 'The answer took too long. Try again, or ask a shorter question.');
    fail(502, 'upstream_error', 'The AI service could not answer. Try again in a minute.');
  }
  return data || {};
}

/* Workers AI: same messages, our own system prompt; returns { text, used, truncated } */
function workersText(r) {
  if (!r) return '';
  if (typeof r === 'string') return r;
  if (typeof r.response === 'string') return r.response;
  if (r.choices && r.choices[0] && r.choices[0].message) return String(r.choices[0].message.content || '');
  if (typeof r.output_text === 'string') return r.output_text;
  if (Array.isArray(r.output)) return r.output.filter(o => o && o.type === 'message').flatMap(o => o.content || []).filter(x => x && typeof x.text === 'string').map(x => x.text).join('');
  return '';
}
async function callWorkers(c, messages, L) {
  const msgs = [{ role: 'system', content: WORKERS_SYSTEM }, ...messages];
  const inChars = msgs.reduce((a, m) => a + m.content.length, 0);
  let lastStatus = 'error';
  for (const model of WORKERS_MODELS) {
    let timer;
    try {
      const run = c.env.AI.run(model, { messages: msgs, max_tokens: L.MAX_OUTPUT_TOKENS, temperature: 0.3 });
      const r = await Promise.race([run, new Promise((_, no) => { timer = setTimeout(() => no(new Error('timeout')), L.TIMEOUT_MS); })]);
      const text = workersText(r).trim();
      const u = (r && r.usage) || {};
      const inT = Number(u.prompt_tokens || u.input_tokens) || Math.ceil(inChars / 4);
      const outT = Number(u.completion_tokens || u.output_tokens) || Math.ceil(text.length / 4);
      const fin = r && r.choices && r.choices[0] && r.choices[0].finish_reason;
      if (text) return { text, used: inT + 2 * outT, truncated: fin === 'length' };
      lastStatus = 'empty';
    } catch (e) {
      const m = String(e && e.message || '');
      if (m === 'timeout') fail(504, 'timeout', 'The answer took too long. Try again, or ask a shorter question.');
      // the account's free Neurons for today are used up: no point trying the next model
      if (/4006|daily free allocation|neurons/i.test(m)) fail(429, 'service_limit', 'Flight Intelligence has reached its limit for today. It is back tomorrow (00:00 UTC).');
      if (/3040|capacity|429/i.test(m)) lastStatus = 'busy';
      console.error('birdbird atc: workers ai error on ' + model); // no error text: it may contain parts of the request
    } finally { clearTimeout(timer); }
  }
  if (lastStatus === 'busy') fail(503, 'busy', 'The AI service is busy right now. Wait a moment and try again.', { retryAfter: 20 });
  fail(502, 'upstream_error', 'The AI service gave no answer. Try again.');
}

async function atcPost(c) {
  const engine = engineOf(c.env);
  if (!engine) notConfigured();
  const key = keyOf(c.env);
  const s = await requireSession(c);
  await limit(c, 'ai', s.user_id);
  const len = Number(c.request.headers.get('content-length'));
  if (len > MAX_BODY_BYTES) fail(413, 'too_large', 'That is too much text in one go. Send less and try again.');
  const body = await readJson(c.request, true, MAX_BODY_BYTES);
  const L = limitsFor(c.env, engine);
  const messages = readMessages(body, L);
  const model = MODELS[TIERS[body.tier] || 'default'];
  const day = dayOf(c.now);
  const over = await reserve(c, s.user_id, day, L);
  if (over === 'daily_limit') fail(429, 'daily_limit', 'You have used today’s Flight Intelligence questions. They are back tomorrow (00:00 UTC).');
  if (over === 'service_limit') fail(429, 'service_limit', 'Flight Intelligence has reached its limit for today. It is back tomorrow (00:00 UTC).');

  if (engine === 'workers') {
    const w = await callWorkers(c, messages, L);
    try { await addTokens(c, s.user_id, day, w.used); } catch (e) { console.error('birdbird atc: could not record usage'); }
    return json({ ok: true, text: w.text, truncated: w.truncated }, 200, { 'set-cookie': c.setCookie });
  }
  const data = await callModel(c, key, model, messages, L);
  const u = data.usage || {};
  const used = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'].reduce((a, k) => a + (Number(u[k]) > 0 ? Number(u[k]) : 0), 0);
  try { await addTokens(c, s.user_id, day, Math.ceil(used * model.weight)); }
  catch (e) { console.error('birdbird atc: could not record usage'); }
  const text = (Array.isArray(data.content) ? data.content : []).filter(b => b && b.type === 'text' && typeof b.text === 'string').map(b => b.text).join('');
  if (!text) {
    if (data.stop_reason === 'refusal') fail(422, 'refused', 'The AI declined that request. Rephrase it.');
    fail(502, 'upstream_error', 'The AI service gave no answer. Try again.');
  }
  return json({ ok: true, text, truncated: data.stop_reason === 'max_tokens' }, 200, { 'set-cookie': c.setCookie });
}

/* deps (tests): { now, random, fetch } */
export function makeOnRequest(deps) {
  const inner = endpoint({ GET: atcGet, POST: atcPost }, deps);
  return function onRequest(ctx) {
    const env = ctx.env || {};
    // the availability check never fails loudly: without a key or a database the service is simply "not configured"
    if (ctx.request.method === 'GET' && (!engineOf(env) || !env.DB)) return json({ ok: false, reason: 'not_configured' });
    return inner(ctx);
  };
}
export const onRequest = makeOnRequest();
export const _test = { DEFAULTS, WORKERS_LIMITS, WORKERS_MODELS, engineOf, MODELS, TIERS, MAX_BODY_BYTES, MAX_MESSAGES, UPSTREAM, API_VERSION, limitsFor };
