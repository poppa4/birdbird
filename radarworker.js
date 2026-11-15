/* Birdbird – OPERA radar composite → map image, in a Web Worker so the page never waits.
   In: { buf: ArrayBuffer (ODIM HDF5 from /api/radar), w, h, b:[west,south,east,north] }
   Out: { ok, w, h, rgba: ArrayBuffer, max, t } or { ok:false, err }
   The OPERA grid is Lambert Azimuthal Equal Area (lat0 55, lon0 10, x0 1 950 000, y0 −2 100 000, WGS84), 3 800 × 4 400 km,
   row 0 north. The output is drawn pixel by pixel in Web Mercator for the bounds b, so MapLibre can lay it on the map. */
importScripts('vendor/jsfive/hdf5.js?v=1');
const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), e = Math.sqrt(e2), D = Math.PI / 180;
const qf = s => (1 - e2) * (s / (1 - e2 * s * s) - (1 / (2 * e)) * Math.log((1 - e * s) / (1 + e * s)));
function laea(lat0, lon0, x0, y0) { // ellipsoidal, oblique (Snyder 1987); checked against PROJ to the millimetre
  const qp = qf(1), Rq = a * Math.sqrt(qp / 2), s0 = Math.sin(lat0 * D), b1 = Math.asin(qf(s0) / qp);
  const m1 = Math.cos(lat0 * D) / Math.sqrt(1 - e2 * s0 * s0), Dd = a * m1 / (Rq * Math.cos(b1)), sb1 = Math.sin(b1), cb1 = Math.cos(b1);
  return (lat, lon) => { const s = Math.sin(lat * D), b = Math.asin(qf(s) / qp), sb = Math.sin(b), cb = Math.cos(b), dl = (lon - lon0) * D;
    const B = Rq * Math.sqrt(2 / (1 + sb1 * sb + cb1 * cb * Math.cos(dl))); return [x0 + B * Dd * cb * Math.sin(dl), y0 + (B / Dd) * (cb1 * sb - sb1 * cb * Math.cos(dl))]; };
}
function projOf(def) { const g = k => { const m = String(def || '').match(new RegExp('\\+' + k + '=(-?[\\d.]+)')); return m ? +m[1] : null; };
  return { lat0: g('lat_0') ?? 55, lon0: g('lon_0') ?? 10, x0: g('x_0') ?? 1950000, y0: g('y_0') ?? -2100000 }; }
const str = v => (v && v.buffer ? new TextDecoder().decode(v) : String(v == null ? '' : v)).replace(/\0+$/, '');
// the rain-rate (mm/h) array, ODIM 2.4 layout first (datasetN / dataN / what.quantity), then the older one
function find(file, want) {
  const kids = g => { try { return g.keys.filter(k => /^(dataset|data)\d+$/.test(k)).sort((x, y) => parseInt(x.replace(/\D/g, '')) - parseInt(y.replace(/\D/g, ''))); } catch (e) { return []; } };
  for (const dn of kids(file)) { const ds = file.get(dn);
    for (const an of kids(ds)) { if (!/^data\d+$/.test(an)) continue; const da = ds.get(an); let w; try { w = da.get('what').attrs; } catch (e) { continue; }
      if (want.includes(str(w.quantity).toUpperCase())) return { d: da.get('data'), w, q: str(w.quantity).toUpperCase() }; }
    try { const w = ds.get('what').attrs; if (want.includes(str(w.quantity).toUpperCase())) { const an = kids(ds).find(k => /^data\d+$/.test(k)); if (an) return { d: ds.get(an).get('data'), w, q: str(w.quantity).toUpperCase() }; } } catch (e) {}
  }
  return null;
}
// rain rate colours (mm/h): light blue → blue → green → yellow → orange → red → magenta
const STOPS = [[0.1, [150, 200, 255, 110]], [0.5, [80, 150, 255, 150]], [1, [30, 100, 240, 175]], [2, [20, 170, 60, 190]], [5, [240, 210, 0, 205]], [10, [255, 140, 0, 215]], [20, [230, 30, 30, 225]], [50, [200, 0, 200, 235]]];
function colour(r) { if (!(r >= STOPS[0][0])) return null; let c = STOPS[0][1]; for (const [v, cc] of STOPS) if (r >= v) c = cc; return c; }
self.onmessage = ev => {
  const { buf, w, h, b } = ev.data;
  try {
    const file = new hdf5.File(buf, 'radar.h5');
    let projdef = ''; try { projdef = str(file.get('where').attrs.projdef); } catch (e) {}
    const hit = find(file, ['RATE', 'ACRR', 'DBZH']); if (!hit) throw new Error('no RATE/DBZH in the file');
    const [ny, nx] = hit.d.shape, v = hit.d.value, W = hit.w;
    const gain = +W.gain || 1, off = +W.offset || 0, nod = W.nodata != null ? +W.nodata : null, und = W.undetect != null ? +W.undetect : null;
    const P = projOf(projdef), fwd = laea(P.lat0, P.lon0, P.x0, P.y0), xs = 3800000 / nx, ys = 4400000 / ny;
    const isDbz = hit.q === 'DBZH';
    const out = new Uint8ClampedArray(w * h * 4); let max = 0;
    const my = la => Math.log(Math.tan(Math.PI / 4 + la * D / 2)), y0 = my(b[3]), y1 = my(b[1]);
    for (let j = 0; j < h; j++) {
      const la = (2 * Math.atan(Math.exp(y0 + (y1 - y0) * (j + 0.5) / h)) - Math.PI / 2) / D;
      for (let i = 0; i < w; i++) {
        const lo = b[0] + (b[2] - b[0]) * (i + 0.5) / w; const [x, y] = fwd(la, lo);
        const col = Math.floor(x / xs), row = ny - 1 - Math.floor((y + 4400000) / ys); if (col < 0 || col >= nx || row < 0 || row >= ny) continue;
        const raw = v[row * nx + col]; if (raw === nod || raw === und) continue;
        let r = raw * gain + off; if (isDbz) r = r < 5 ? 0 : Math.pow(Math.pow(10, r / 10) / 200, 1 / 1.6); // Marshall–Palmer, dBZ → mm/h
        const c = colour(r); if (!c) continue; if (r > max) max = r;
        const k = (j * w + i) * 4; out[k] = c[0]; out[k + 1] = c[1]; out[k + 2] = c[2]; out[k + 3] = c[3];
      }
    }
    let t = null; try { const wh = file.get('what').attrs; t = str(wh.date) + 'T' + str(wh.time); } catch (e) {}
    self.postMessage({ ok: true, w, h, rgba: out.buffer, max: Math.round(max * 10) / 10, q: hit.q, t }, [out.buffer]);
  } catch (err) { self.postMessage({ ok: false, err: String(err && err.message || err) }); }
};
