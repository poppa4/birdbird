/* NORDAP – Cloudflare Pages Function: Flight Intelligence (the AI behind ai.js: Ask your documents, fi.html, the radio trainer, …).

   GET  /api/atc   -> 200 { ok:true }                                  the service can be used by this signed-in user
                      200 { ok:true, anon:true }                       signed out: a few free questions, then sign up
                      200 { ok:false, reason:'not_configured' }        no API key, no database or migration 0002 not applied
                                                                       (200 on purpose: no red lines in the browser console)
   POST /api/atc   { messages:[{ role:'user'|'assistant', content:'…' }, …], tier?:'quick'|'default'|'high' }
                   -> 200 { ok:true, text, truncated }
                   errors { ok:false, error, message }:
                      400 bad_request · 403 bad_origin · 413 too_large | prompt_too_large · 422 refused
                      429 rate_limited (per minute) | daily_limit (this user, today) | service_limit (whole site, today)
                          | signup_required (no account: the free questions without an account are used up)
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
   - same-origin JSON POST only (the checks in functions/_lib/api.js); without an account only ANON_DAILY_REQUESTS a day per
     visitor (an HMAC of the IP address, rotated daily) and ANON_GLOBAL_DAILY_REQUESTS for all of them together;
   - a per-minute limit per user (LIMITS.ai there), a daily request cap and a daily token cap per user, and the same for the
     whole site; the request counters are raised before the model is called, so parallel requests cannot slip past them;
   - a body size limit, a prompt size limit and a fixed max_tokens;
   - the model is chosen here from the tier, never by the client; tokens on the stronger model count MODELS[..].weight times
     against the caps (its price relative to the default model), so the worst-case daily cost is the same whatever the tier. */

import { endpoint, json, getSession, readJson, limit, fail, rateKey, ipOf } from '../_lib/api.js';
import { render as renderCalc, delatex, CALC_RULES, CALC_REMINDER } from '../_lib/calc.js';

/* ---------- limits (each can be overridden with an environment variable of the same name, prefixed ATC_) ---------- */
const DEFAULTS = {
  USER_DAILY_REQUESTS: 50,        // questions per user per UTC day
  USER_DAILY_TOKENS: 200000,      // input + output tokens per user per UTC day (default-model units)
  GLOBAL_DAILY_REQUESTS: 1000,    // questions for the whole site per UTC day
  GLOBAL_DAILY_TOKENS: 4000000,   // tokens for the whole site per UTC day (default-model units)
  MAX_INPUT_CHARS: 60000,         // all message text in one request
  MAX_OUTPUT_TOKENS: 1500,        // max_tokens sent to the model
  TIMEOUT_MS: 45000,              // how long we wait for the model
  /* trying it without an account: counted per visitor under an HMAC of the IP address (never the address itself) */
  ANON_DAILY_REQUESTS: 5,         // questions per visitor without an account per UTC day
  ANON_DAILY_TOKENS: 20000,       // tokens per visitor without an account per UTC day
  ANON_GLOBAL_DAILY_REQUESTS: 200 // all visitors without an account together per UTC day (the rest is kept for account holders)
};
/* free engine (Workers AI): smaller caps so the daily 10,000 free Neurons are not exceeded (≈ 300k counted tokens on gpt-oss-120b) */
const WORKERS_LIMITS = {
  USER_DAILY_REQUESTS: 10,        // few users yet: 10 good answers each beat 25 rushed ones
  USER_DAILY_TOKENS: 80000,       // room for high reasoning effort on all 10
  GLOBAL_DAILY_REQUESTS: 300,
  GLOBAL_DAILY_TOKENS: 300000,
  TIMEOUT_MS: 75000,              // high reasoning takes longer than the paid engine
  MAX_OUTPUT_TOKENS: 6000,        // gpt-oss reasons (effort high) before it answers; the reasoning counts here too
  ANON_GLOBAL_DAILY_REQUESTS: 100 // a third of the free allocation for visitors without an account
};
const WORKERS_MODELS = ['@cf/openai/gpt-oss-120b', '@cf/zai-org/glm-4.7-flash']; // second one only if the first errors
const WORKERS_SYSTEM = 'Reasoning: high\n\n'
  + 'You are Flight Intelligence in NORDAP, a European (EASA) preparation platform for pilots. '
  + 'Before answering, work out what the pilot actually means (pilots use shorthand), which given entries answer it, and whether each entry really applies to their case (aircraft, licence, flight rules, Part-NCO/NCC/CAT, age, day or night). '
  + 'Then check every number and condition in your draft against the entry it came from, word for word; drop or correct anything that does not match. Answer the question that was asked first, in one or two sentences, then the details. '
  + 'Follow the instructions in the user message exactly, including language, citation markers and output format. Use EASA/SERA terms and standards, never FAA ones. '
  + 'Hard rules, in this order: (1) Every regulation statement, regulatory number, limitation, speed, minimum, performance value or procedure step taken from a rule or a manual must come from the EASA entries [E1], [E2]… or the document excerpts [S1], [S2]… given in the message, and carry that marker. '
  + 'Theory entries [T1], [T2]… explain aviation theory; cite them for theory, but they are never a source for a rule, limit, minimum or procedure. '
  + 'Calculating is different and allowed: work with the numbers the pilot gives you or with cited values, as described under CALCULATIONS. '
  + '(2) If a rule or manual value is not in them, say plainly that it is not in the NORDAP rules library or in the pilot\'s documents and where to check it; never fill the gap with a rule value or rule ID from memory, and never invent a rule ID. '
  + '(3) Keep Part-NCO, Part-NCC and Part-CAT apart: a light aircraft flown privately or by a training organisation falls under Part-NCO unless the message says otherwise. '
  + '(4) If the question contains a wrong premise (a wrong number, a rule that does not exist, a wrong rule ID), correct it instead of going along with it. '
  + '(5) The approved flight manual and the official legal text always take precedence; say so when it matters. Be short and concrete.\n\n' + CALC_RULES;
/* The free model follows the system prompt loosely (tested on nordap.eu, Nov 2026: it named "Part-NCO guidance" that it was
   never given). The hard rules are therefore repeated right after the pilot's last message, where it does follow them. */
const RULES_REMINDER = '\n\n(NORDAP rules for this answer: cite only the entries given above ([E…] EASA, [T…] theory, [S…] documents). '
  + 'Never name a regulation, rule ID, AMC/GM, document, handbook or website that is not in them, and never invent one. Rules come only from EASA; '
  + 'never use FAA/U.S. rules. If an entry lists several cases or conditions, give every one that fits the question, not only the first. '
  + 'If the pilot\'s question contains a wrong fact, say so and correct it.)';
/* the paid engine gets only the calculator rules as its system prompt: everything else is in the page's own prompt */
const ANTHROPIC_SYSTEM = 'You are Flight Intelligence in NORDAP, a European (EASA) preparation platform for pilots. Follow the instructions in the user message exactly.\n\n' + CALC_RULES;
/* Quality tests (tests/fi-eval: the question set run against the real model): a request carrying the header x-nordap-eval with
   the key whose SHA-256 is below (or in the env ATC_EVAL_SHA256) is counted as the tester 'eval': it skips the per-user and
   no-account caps, never the site-wide ones, so a leaked key can use at most the day's normal allowance. Only the hash is public. */
const EVAL_KEY_SHA256 = '48e39ebbf700bab0a9a3626aaa03087938f9c7121f4013a69accdc8da922653c';
async function isEval(c) {
  const k = c.request.headers.get('x-nordap-eval');
  if (!k || k.length < 20 || k.length > 200) return false;
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k));
  const h = [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  return h === EVAL_KEY_SHA256 || (!!c.env.ATC_EVAL_SHA256 && h === String(c.env.ATC_EVAL_SHA256).trim().toLowerCase());
}
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
const ANON_GLOBAL = 'anon*';

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
  if (o && o !== c.url.origin) fail(403, 'bad_origin', 'This request did not come from NORDAP itself.');
  const s = await getSession(c);
  try { await c.db.prepare('SELECT 1 FROM ai_usage LIMIT 1').first(); }
  catch (e) { return json({ ok: false, reason: 'not_configured' }, 200, { 'set-cookie': c.setCookie }); }
  if (!s) return json({ ok: true, anon: true }); // a few free questions without an account, then sign up
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
async function reserve(c, userId, day, L, anon, owner) {
  let u, g;
  try {
    u = await countRequest(c, userId, day);
    if (anon) {
      if (u.requests > L.ANON_DAILY_REQUESTS || u.tokens >= L.ANON_DAILY_TOKENS) return 'signup_required';
      const a = await countRequest(c, ANON_GLOBAL, day);
      if (a.requests > L.ANON_GLOBAL_DAILY_REQUESTS) return 'signup_required';
    } else if (!owner && (u.requests > L.USER_DAILY_REQUESTS || u.tokens >= L.USER_DAILY_TOKENS)) return 'daily_limit'; // owners skip both per-user caps
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
    const payload = { model: model.id, max_tokens: L.MAX_OUTPUT_TOKENS, system: ANTHROPIC_SYSTEM, messages };
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
    console.error('nordap atc: upstream unreachable'); // no error text: nothing from the request may reach the log
    fail(502, 'upstream_error', 'The AI service could not be reached. Try again in a minute.');
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    const type = data && data.error && typeof data.error.type === 'string' ? data.error.type.slice(0, 40) : '';
    console.error('nordap atc: upstream status ' + res.status + (type ? ' ' + type : ''));
    if (res.status === 429 || res.status === 529 || res.status === 503) fail(503, 'busy', 'The AI service is busy right now. Wait a moment and try again.', { retryAfter: 20 });
    if (res.status === 413) fail(413, 'prompt_too_large', 'Too much text at once. Pick fewer documents or ask a shorter question.');
    if (res.status === 504) fail(504, 'timeout', 'The answer took too long. Try again, or ask a shorter question.');
    fail(502, 'upstream_error', 'The AI service could not answer. Try again in a minute.');
  }
  return data || {};
}

/* ---------- reference check on every answer ----------
   A rule ID (CAT.OP.MPA.182, SERA.5015, FCL.740 …), "Part-XXX guidance/AMC/GM" or a U.S. regulation in the answer that was
   not in what the model was given is marked as unverified, so a made-up reference is never shown as fact. */
const REF_RE = /\b(?:(?:AMC|GM)\d*\s+)?(?:CAT|NCO|NCC|SPO|SPA|ORO|ORA|ARO|ARA|MED)\.[A-Z]{2,4}(?:\.[A-Z]{1,4})?\.\d{3}(?:\.[A-Za-z0-9]+)*|\bSERA\.\d{4,5}|\bFCL\.\d{3}(?:\.[A-Z])?|\bPart-(?:NCO|NCC|CAT|SPO|ORO|FCL|MED|ORA)\s+(?:guidance|material|AMC|GM|guidelines?)\b/g;
const US_RE = /\b(?:14\s*CFR(?:\s*(?:Part\s*)?\d+(?:\.\d+)*)?|FAR\s*(?:Part\s*)?\d+(?:\.\d+)*|AIM\s+\d-\d-\d+)/g;
const normRef = x => String(x).toUpperCase().replace(/\s+/g, ' ').replace(/^(AMC|GM)\d*\s+/, '');
export function checkRefs(text, given) {
  if (typeof text !== 'string' || !text) return { text, flagged: 0 };
  const G = String(given || '').toUpperCase();
  const no = /Write in Norwegian/i.test(given || '');
  const tagUnv = no ? ' (ikke bekreftet – sjekk den offisielle EASA-teksten)' : ' (unverified – check the official EASA text)';
  const tagUs = no ? ' (amerikansk regel – gjelder ikke under EASA)' : ' (U.S. rule – not valid under EASA)';
  const seen = new Set(); let flagged = 0;
  let out = text.replace(REF_RE, m => { const k = normRef(m).replace(/\s+(GUIDANCE|MATERIAL|AMC|GM|GUIDELINES?)$/, '');
    if (G.includes(k) && !/\s(guidance|material|guidelines?)$/i.test(m)) return m;
    if (/\s(guidance|material|guidelines?)$/i.test(m) && G.includes(normRef(m))) return m;
    if (seen.has(k)) return m; seen.add(k); flagged++; return m + tagUnv; });
  out = out.replace(US_RE, m => { if (seen.has(m)) return m; seen.add(m); flagged++; return m + tagUs; });
  return { text: out, flagged };
}
const finish = (text, messages, base) => base ? renderCalc(text).text : checkRefs(delatex(renderCalc(text).text), messages.map(m => m.content).join('\n')).text;

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
async function callWorkers(c, messages, L, base) {
  const last = messages.length - 1;
  const msgs = [{ role: 'system', content: WORKERS_SYSTEM }, ...messages.map((m, i) => i === last ? { role: m.role, content: m.content + (base ? '' : RULES_REMINDER) + CALC_REMINDER } : m)];
  const inChars = msgs.reduce((a, m) => a + m.content.length, 0);
  let lastStatus = 'error';
  for (const model of WORKERS_MODELS) {
    let timer;
    try {
      const run = c.env.AI.run(model, { messages: msgs, max_tokens: L.MAX_OUTPUT_TOKENS, temperature: 0.1 });
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
      console.error('nordap atc: workers ai error on ' + model); // no error text: it may contain parts of the request
    } finally { clearTimeout(timer); }
  }
  if (lastStatus === 'busy') fail(503, 'busy', 'The AI service is busy right now. Wait a moment and try again.', { retryAfter: 20 });
  fail(502, 'upstream_error', 'The AI service gave no answer. Try again.');
}

async function atcPost(c) {
  const engine = engineOf(c.env);
  if (!engine) notConfigured();
  const key = keyOf(c.env);
  const s = await getSession(c);
  const ev = await isEval(c);
  // eval only: x-nordap-eval-variant: baseline answers without the hard-rules reminder and the reference check, to measure them
  const base = ev && c.request.headers.get('x-nordap-eval-variant') === 'baseline';
  const anon = !s && !ev;
  // without an account: counted under an HMAC of the IP address for today (rateKey), never the address itself
  const who = ev ? 'eval' : s ? s.user_id : await rateKey(c, 'anon', ipOf(c.request));
  await limit(c, 'ai', ev ? 'eval' : s ? s.user_id : 'ip|' + ipOf(c.request));
  const len = Number(c.request.headers.get('content-length'));
  if (len > MAX_BODY_BYTES) fail(413, 'too_large', 'That is too much text in one go. Send less and try again.');
  const body = await readJson(c.request, true, MAX_BODY_BYTES);
  const L = limitsFor(c.env, engine);
  const messages = readMessages(body, L);
  const model = MODELS[TIERS[body.tier] || 'default'];
  const day = dayOf(c.now);
  // owners/testers (env ATC_OWNER_IDS: comma-separated user ids) skip the per-user daily caps; the site-wide caps still apply
  const owner = ev || !!s && String(c.env.ATC_OWNER_IDS || '').split(',').map(x => x.trim()).filter(Boolean).includes(s.user_id);
  const over = await reserve(c, who, day, L, anon, owner);
  if (over === 'signup_required') fail(429, 'signup_required', 'You have used the free questions without an account. Create a free account under Profile to keep going.');
  if (over === 'daily_limit') fail(429, 'daily_limit', 'You have used today’s Flight Intelligence questions. They are back tomorrow (00:00 UTC).');
  if (over === 'service_limit') fail(429, 'service_limit', 'Flight Intelligence has reached its limit for today. It is back tomorrow (00:00 UTC).');

  if (engine === 'workers') {
    const w = await callWorkers(c, messages, L, base);
    try { await addTokens(c, who, day, w.used); } catch (e) { console.error('nordap atc: could not record usage'); }
    return json({ ok: true, text: finish(w.text, messages, base), truncated: w.truncated }, 200, { 'set-cookie': c.setCookie });
  }
  const data = await callModel(c, key, model, messages, L);
  const u = data.usage || {};
  const used = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'].reduce((a, k) => a + (Number(u[k]) > 0 ? Number(u[k]) : 0), 0);
  try { await addTokens(c, who, day, Math.ceil(used * model.weight)); }
  catch (e) { console.error('nordap atc: could not record usage'); }
  const text = (Array.isArray(data.content) ? data.content : []).filter(b => b && b.type === 'text' && typeof b.text === 'string').map(b => b.text).join('');
  if (!text) {
    if (data.stop_reason === 'refusal') fail(422, 'refused', 'The AI declined that request. Rephrase it.');
    fail(502, 'upstream_error', 'The AI service gave no answer. Try again.');
  }
  return json({ ok: true, text: finish(text, messages, base), truncated: data.stop_reason === 'max_tokens' }, 200, { 'set-cookie': c.setCookie });
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
export const _test = { ANTHROPIC_SYSTEM, WORKERS_SYSTEM, DEFAULTS, WORKERS_LIMITS, WORKERS_MODELS, engineOf, MODELS, TIERS, MAX_BODY_BYTES, MAX_MESSAGES, UPSTREAM, API_VERSION, limitsFor };
