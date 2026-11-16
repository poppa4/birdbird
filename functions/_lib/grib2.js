/* Birdbird – minimal GRIB2 reader for model fields on a regular lat/lon grid (NOAA GFS through NOMADS grib filter).
   Supports: grid template 3.0 (regular lat/lon), product templates 4.0 and 4.8 (time averages), data templates 5.0 (simple
   packing), 5.2 (complex packing) and 5.3 (complex packing with spatial differencing, order 1 or 2), and a bitmap in
   section 6 (points the bitmap leaves out are NaN, e.g. cloud base where there is no cloud).
   That is what GFS pgrb2 uses for wind, temperature and height. Anything else is skipped, not guessed.
   readGrib2(bytes) → [{ disc, cat, num, level:{type,value}, ref:Date, fhr, ni, nj, la1, lo1, la2, lo2, di, dj, scan, values:Float64Array }] */

const u8 = (b, o) => b[o];
const u16 = (b, o) => (b[o] << 8) | b[o + 1];
const u32 = (b, o) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
// GRIB2 signed integers are sign-magnitude: the top bit is the sign
const s16 = (b, o) => { const v = u16(b, o); return v & 0x8000 ? -(v & 0x7fff) : v; };
const s32 = (b, o) => { const v = u32(b, o); return v & 0x80000000 ? -(v & 0x7fffffff) : v; };
const sN = (b, o, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[o + i]; const top = Math.pow(2, 8 * n - 1); return v >= top ? -(v - top) : v; };
const f32 = (b, o) => new DataView(b.buffer, b.byteOffset + o, 4).getFloat32(0, false);

/* big-endian bit reader */
function Bits(b, off) { this.b = b; this.p = off * 8; }
Bits.prototype.read = function (n) { // whole byte chunks, not bit by bit: this is the hot loop
  let v = 0;
  while (n > 0) {
    const avail = 8 - (this.p & 7), take = avail < n ? avail : n;
    v = v * (1 << take) + ((this.b[this.p >> 3] >> (avail - take)) & ((1 << take) - 1));
    this.p += take; n -= take;
  }
  return v;
};
Bits.prototype.align = function () { this.p = (this.p + 7) & ~7; };

function unpackSimple(d, s5, n) {
  const R = f32(s5, 11), E = s16(s5, 15), D = s16(s5, 17), nb = u8(s5, 19);
  const out = new Float64Array(n), e2 = Math.pow(2, E), d10 = Math.pow(10, -D);
  if (nb === 0) { out.fill(R * d10); return out; }
  const r = new Bits(d, 0);
  for (let i = 0; i < n; i++) out[i] = (R + r.read(nb) * e2) * d10;
  return out;
}

function unpackComplex(d, s5, n, tpl) {
  const R = f32(s5, 11), E = s16(s5, 15), D = s16(s5, 17), nb = u8(s5, 19);
  const miss = u8(s5, 22), NG = u32(s5, 31), refW = u8(s5, 35), nbW = u8(s5, 36), refL = u32(s5, 37), incL = u8(s5, 41), lastL = u32(s5, 42), nbL = u8(s5, 46);
  if (miss !== 0) throw new Error('grib2: missing-value management not supported');
  let order = 0, nbytes = 0, ival1 = 0, ival2 = 0, minsd = 0, pos = 0;
  if (tpl === 3) {
    order = u8(s5, 47); nbytes = u8(s5, 48);
    ival1 = sN(d, pos, nbytes); pos += nbytes;
    if (order === 2) { ival2 = sN(d, pos, nbytes); pos += nbytes; }
    minsd = sN(d, pos, nbytes); pos += nbytes;
  }
  const r = new Bits(d, pos);
  const gref = new Array(NG), gw = new Array(NG), gl = new Array(NG);
  for (let g = 0; g < NG; g++) gref[g] = r.read(nb);
  r.align();
  for (let g = 0; g < NG; g++) gw[g] = r.read(nbW) + refW;
  r.align();
  for (let g = 0; g < NG; g++) gl[g] = refL + r.read(nbL) * incL;
  gl[NG - 1] = lastL;
  r.align();
  const f = new Float64Array(n); let k = 0;
  for (let g = 0; g < NG; g++) {
    const w = gw[g], L = gl[g], ref = gref[g];
    if (w === 0) { for (let j = 0; j < L && k < n; j++) f[k++] = ref; }
    else { for (let j = 0; j < L && k < n; j++) f[k++] = ref + r.read(w); }
  }
  if (tpl === 3) {
    if (order === 1) { f[0] = ival1; for (let i = 1; i < n; i++) f[i] = f[i] + minsd + f[i - 1]; }
    else if (order === 2) { f[0] = ival1; if (n > 1) f[1] = ival2; for (let i = 2; i < n; i++) f[i] = f[i] + minsd + 2 * f[i - 1] - f[i - 2]; }
  }
  const e2 = Math.pow(2, E), d10 = Math.pow(10, -D);
  for (let i = 0; i < n; i++) f[i] = (R + f[i] * e2) * d10;
  return f;
}

export function readGrib2(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const out = [];
  let o = 0;
  while (o + 16 <= b.length) {
    if (!(b[o] === 0x47 && b[o + 1] === 0x52 && b[o + 2] === 0x49 && b[o + 3] === 0x42)) { o++; continue; } // 'GRIB'
    if (b[o + 7] !== 2) throw new Error('grib2: not edition 2');
    const disc = b[o + 6], total = u32(b, o + 12); // octets 9-16 (upper 32 bits are 0 for our sizes)
    const end = o + 16 + (total - 16);
    let p = o + 16, ref = null, grid = null, prod = null, s5 = null, n = 0, bitmap = 255, bmp = null;
    while (p < end - 4) {
      if (b[p] === 0x37 && b[p + 1] === 0x37 && b[p + 2] === 0x37 && b[p + 3] === 0x37) break; // '7777'
      const len = u32(b, p), sec = b[p + 4], S = b.subarray(p, p + len);
      if (sec === 1) ref = new Date(Date.UTC(u16(S, 12), S[14] - 1, S[15], S[16], S[17], S[18]));
      else if (sec === 3) {
        if (u16(S, 12) !== 0) grid = null;
        else grid = { ni: u32(S, 30), nj: u32(S, 34), la1: s32(S, 46) / 1e6, lo1: s32(S, 50) / 1e6, la2: s32(S, 55) / 1e6, lo2: s32(S, 59) / 1e6, di: u32(S, 63) / 1e6, dj: u32(S, 67) / 1e6, scan: S[71] };
      } else if (sec === 4) {
        const t = u16(S, 7);
        prod = t === 0 || t === 8 ? { cat: S[9], num: S[10], unit: S[17], fhr: s32(S, 18), level: { type: S[22], value: s32(S, 24) / Math.pow(10, sN(S, 23, 1)) } } : null;
      } else if (sec === 5) { s5 = S; n = u32(S, 5); }
      else if (sec === 6) { bitmap = S[5]; if (bitmap === 0) bmp = S.subarray(6); }
      else if (sec === 7) {
        if (grid && prod && s5 && (bitmap === 255 || (bitmap === 0 && bmp))) {
          const tpl = u16(s5, 9), d = S.subarray(5);
          let values = null;
          if (tpl === 0) values = unpackSimple(d, s5, n);
          else if (tpl === 2 || tpl === 3) values = unpackComplex(d, s5, n, tpl);
          if (values && bitmap === 0) { // spread the packed values over the grid; missing points are NaN
            const N = grid.ni * grid.nj, full = new Float64Array(N); let k = 0;
            for (let i = 0; i < N; i++) full[i] = (bmp[i >> 3] >> (7 - (i & 7))) & 1 ? (k < values.length ? values[k++] : NaN) : NaN;
            values = full;
          }
          if (values) out.push(Object.assign({ disc, cat: prod.cat, num: prod.num, level: prod.level, ref, fhr: prod.unit === 1 ? prod.fhr : prod.unit === 0 ? prod.fhr / 60 : prod.fhr, values }, grid));
        }
      }
      p += len;
    }
    o = end;
  }
  return out;
}

/* value at grid index (i east, j along the scan) → lat/lon of a point for a 3.0 grid */
export function gridLatLon(m, i, j) {
  const south = (m.scan & 0x40) !== 0; // j scans positively (south → north)
  const la = m.la1 + (south ? 1 : -1) * j * m.dj, lo = m.lo1 + i * m.di;
  return [la, lo > 180 ? lo - 360 : lo];
}
