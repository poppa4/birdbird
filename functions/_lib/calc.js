/* NORDAP – calculator for Flight Intelligence (functions/api/atc.js).
   Language models are unreliable at arithmetic, so the model does not write computed numbers itself: it writes the calculation
   as a marker and the server works it out exactly before the answer is sent to the browser.

     {{calc: (35000 - 3000) / 1000 * 3}}             -> 96
     {{calc: tod = (35000 - 3000) / 1000 * 3}} NM … {{calc: tod / 2}}   a name keeps the value for later markers in the answer
     {{calc: 1013.25 - 27 * 1; 1}}                    "; n" after the expression sets the number of decimals (0–6)

   Allowed: numbers (1.5, 1e3), + - * / ^ (power) %, parentheses, variables made earlier in the same answer, the constants
   pi and e, and these functions (angles in DEGREES, as pilots use them):
     sin cos tan asin acos atan atan2(y,x) sqrt abs round(x[,n]) floor ceil min max ln log10 exp
   Nothing else is evaluated: no JavaScript, no property access, no strings. A marker that cannot be worked out is replaced
   by its own expression with "= ?" so the reader sees it was not calculated, never a made-up number. */

const FN = {
  sin: [1, x => Math.sin(x * Math.PI / 180)], cos: [1, x => Math.cos(x * Math.PI / 180)], tan: [1, x => Math.tan(x * Math.PI / 180)],
  asin: [1, x => Math.asin(x) * 180 / Math.PI], acos: [1, x => Math.acos(x) * 180 / Math.PI], atan: [1, x => Math.atan(x) * 180 / Math.PI],
  atan2: [2, (y, x) => Math.atan2(y, x) * 180 / Math.PI],
  sqrt: [1, Math.sqrt], abs: [1, Math.abs], floor: [1, Math.floor], ceil: [1, Math.ceil],
  round: [[1, 2], (x, n) => { const k = Math.pow(10, n === undefined ? 0 : Math.max(0, Math.min(6, Math.round(n)))); return Math.round(x * k) / k; }],
  min: [[1, 20], Math.min], max: [[1, 20], Math.max],
  ln: [1, Math.log], log10: [1, Math.log10], exp: [1, Math.exp]
};
const CONST = { pi: Math.PI, e: Math.E };
const MAX_EXPR = 300, MAX_MARKERS = 40, MAX_VARS = 40;

function tokenize(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    const num = /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
    if (num) { out.push({ t: 'n', v: parseFloat(num[0]) }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
    if ('+-*/^%(),'.includes(ch)) { out.push({ t: ch }); i++; continue; }
    if (ch === '×') { out.push({ t: '*' }); i++; continue; }
    if (ch === '÷') { out.push({ t: '/' }); i++; continue; }
    if (ch === '−') { out.push({ t: '-' }); i++; continue; }
    throw new Error('bad character');
  }
  return out;
}

/* recursive descent: expr = term (('+'|'-') term)* ; term = unary (('*'|'/'|'%') unary)* ; unary = '-' unary | power ;
   power = atom ('^' unary)? ; atom = number | name | name '(' args ')' | '(' expr ')' */
export function evaluate(src, vars) {
  vars = vars || {};
  if (typeof src !== 'string' || src.length > MAX_EXPR) throw new Error('too long');
  const tk = tokenize(src); let p = 0;
  const peek = () => tk[p] && tk[p].t, eat = t => { if (peek() !== t) throw new Error('expected ' + t); return tk[p++]; };
  function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = tk[p++].t; const r = term(); v = o === '+' ? v + r : v - r; } return v; }
  function term() { let v = unary(); while (peek() === '*' || peek() === '/' || peek() === '%') { const o = tk[p++].t; const r = unary(); v = o === '*' ? v * r : o === '/' ? v / r : v % r; } return v; }
  function unary() { if (peek() === '-') { p++; return -unary(); } if (peek() === '+') { p++; return unary(); } return power(); }
  function power() { const b = atom(); if (peek() === '^') { p++; return Math.pow(b, unary()); } return b; }
  function atom() {
    const k = tk[p];
    if (!k) throw new Error('unexpected end');
    if (k.t === 'n') { p++; return k.v; }
    if (k.t === '(') { p++; const v = expr(); eat(')'); return v; }
    if (k.t === 'id') {
      p++; const name = k.v.toLowerCase();
      if (peek() === '(') {
        const f = FN[name]; if (!f) throw new Error('unknown function');
        p++; const args = [];
        if (peek() !== ')') { args.push(expr()); while (peek() === ',') { p++; args.push(expr()); } }
        eat(')');
        const [lo, hi] = Array.isArray(f[0]) ? f[0] : [f[0], f[0]];
        if (args.length < lo || args.length > hi) throw new Error('wrong number of arguments');
        return f[1](...args);
      }
      if (Object.prototype.hasOwnProperty.call(vars, k.v)) return vars[k.v];
      if (Object.prototype.hasOwnProperty.call(CONST, name)) return CONST[name];
      throw new Error('unknown name');
    }
    throw new Error('unexpected token');
  }
  const v = expr();
  if (p !== tk.length) throw new Error('trailing input');
  if (!Number.isFinite(v)) throw new Error('not a finite number');
  return v;
}

export function format(v, dec) {
  if (dec !== undefined) return v.toFixed(dec).replace(/^-(0\.?0*)$/, '$1');
  const a = Math.abs(v);
  const d = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : 4; // sensible default; the model can ask for more with "; n"
  let s = v.toFixed(d);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

/* one marker body: "expr", "name = expr", optionally followed by "; decimals" */
function runOne(body, vars) {
  let src = body.trim(), dec;
  const m = /;\s*(\d)\s*$/.exec(src);
  if (m) { dec = Math.min(6, +m[1]); src = src.slice(0, m.index).trim(); }
  let name = null;
  const a = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)\s*([\s\S]+)$/.exec(src);
  if (a) { name = a[1]; src = a[2]; if (FN[name.toLowerCase()] || CONST[name.toLowerCase()]) throw new Error('reserved name'); }
  const v = evaluate(src, vars);
  if (name) { if (!(name in vars) && Object.keys(vars).length >= MAX_VARS) throw new Error('too many names'); vars[name] = v; }
  return format(v, dec);
}

const MARK = /\{\{\s*calc\s*:([^{}]*)\}\}/gi;

/* replace every {{calc: …}} in an answer; returns { text, count, errors } */
export function render(text) {
  if (typeof text !== 'string' || !/\{\{\s*calc/i.test(text)) return { text, count: 0, errors: 0 };
  const vars = Object.create(null); let count = 0, errors = 0;
  const out = text.replace(MARK, (all, body) => {
    if (count >= MAX_MARKERS) return all;
    count++;
    try { return runOne(body, vars); }
    catch (e) { errors++; return '(' + body.trim().replace(/;\s*\d\s*$/, '').trim() + ' = ?)'; }
  });
  return { text: out, count, errors };
}

/* what every Flight Intelligence model is told about numbers and the calculator (atc.js puts it in the system prompt) */
export const CALC_RULES = 'CALCULATIONS: You may and should calculate when the pilot asks for it (descent planning, wind correction, '
  + 'crosswind/headwind components, fuel, time and distance, pressure and density altitude, unit conversions, mass and balance, '
  + 'rates of descent and the like), from the numbers the pilot gives or from cited values. A calculated result is not general '
  + 'knowledge and needs no [GK] mark. Never work out a number in your head: write every calculation as a marker {{calc: expression}} '
  + 'and NORDAP replaces it with the exact result before the pilot sees it, e.g. "Top of descent: {{calc: (35000 - 3000) / 1000 * 3}} NM". '
  + 'Syntax: numbers, + - * / ^ ( ), functions sin cos tan asin acos atan atan2(y,x) (degrees), sqrt abs round(x,n) min max ln log10 exp, '
  + 'and the constant pi. Store a result for later with a name: {{calc: tod = (35000 - 3000) / 1000 * 3}} and later {{calc: tod / 2}}. '
  + 'Add "; n" to set n decimals: {{calc: 1013.25 - 27 * 0.5; 1}}. Write each value without units inside the marker and put the unit '
  + 'after it. Show the steps briefly (formula, then the numbers put in, then the marker with the result) so the pilot can check them. '
  + 'State any rule of thumb you use (e.g. 3 NM per 1000 ft, 1 hPa ≈ 27 ft) as an approximation. Do not use markers inside JSON keys. '
  + 'Write plain text: never LaTeX (no \\[ \\], no \\frac, no \\text), the page cannot show it.';

/* a short reminder put after the pilot's last message for the free engine: gpt-oss follows the system prompt loosely and
   otherwise does the arithmetic in its head (tested on nordap.eu, Nov 2026) */
export const CALC_REMINDER = '\n\n(NORDAP: if your answer contains any calculated number, write each one as {{calc: expression}}, e.g. {{calc: (35000 - 3000) / 1000 * 3}} NM or {{calc: 25 * sin(40); 0}} kt - never work it out yourself, the marker is replaced with the exact result. Trig functions take degrees. No LaTeX.)';

/* The free model writes LaTeX even when told not to (tested on nordap.eu: 4 of 30 answers). The pages show plain text, so
   common LaTeX is turned into readable plain text: \frac{a}{b} → (a)/(b), \sqrt{x} → √(x), \times → ×, \text{kt} → kt, and
   the \( \) \[ \] $$ delimiters are removed. Text without a backslash command is returned unchanged. */
export function delatex(t) {
  if (typeof t !== 'string' || !/\\[a-zA-Z(\[)\]]|\$\$/.test(t)) return t;
  let s = t, prev;
  const SYM = { times: '×', cdot: '·', div: '÷', approx: '≈', pm: '±', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', to: '→', rightarrow: '→', Rightarrow: '⇒',
    degree: '°', circ: '°', rho: 'ρ', alpha: 'α', beta: 'β', theta: 'θ', Delta: 'Δ', delta: 'δ', pi: 'π', mu: 'μ', sigma: 'σ', gamma: 'γ', phi: 'φ', infty: '∞', quad: ' ', qquad: ' ', percent: '%' };
  do { prev = s;
    s = s.replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, b) => (/^[\w.,° ]+$/.test(a.trim()) ? a.trim() : '(' + a.trim() + ')') + '/' + (/^[\w.,°]+$/.test(b.trim()) ? b.trim() : '(' + b.trim() + ')'));
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
    s = s.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|textbf|boldsymbol)\s*\{([^{}]*)\}/g, '$1');
    s = s.replace(/\\left|\\right/g, '');
  } while (s !== prev);
  s = s.replace(/\\(sin|cos|tan|arcsin|arccos|arctan|log|ln|exp)\b/g, '$1');
  s = s.replace(/\\([A-Za-z]+)/g, (m, w) => SYM[w] !== undefined ? SYM[w] : m);
  s = s.replace(/\\[,;:! ]/g, ' ').replace(/\\%/g, '%');
  s = s.replace(/\$\$|\\\[|\\\]|\\\(|\\\)/g, '');
  s = s.replace(/\^\{?\\?circ\}?|\^\{\s*°\s*\}/g, '°').replace(/_\{([^{}]*)\}/g, '$1').replace(/\^\{([^{}]*)\}/g, '^$1');
  s = s.replace(/\{([^{}]*)\}/g, '$1').replace(/[ \t]{2,}/g, ' ');
  return s;
}
