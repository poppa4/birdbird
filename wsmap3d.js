/* NORDAP – My Workspace map in 3D (the full Map page only; the mini maps stay 2D in wsmap.js).
   A brain drawn by three.js: one smooth, lit mesh with real folds (wsgraph3d.brainMesh) over a radar scope, each section
   (an aircraft, a group of your own, then 'Unsorted') a tinted region of the cerebrum with its items on it. The side
   facing you is bright with a brighter rim, the far side faint; seen from above, the cerebellum hides under the cerebrum.
   Earlier this was a calm cloud drawn by three.js (r128, lazy-loaded with this file): each group (an aircraft, then 'Unsorted') a soft
   ball of glowing points inside a few large puffs of light (one draw call for all puffs, one for all points), the groups
   side by side at slightly different depths so the cloud has parallax when it turns. Links are faint hairlines inside a
   group; a point's links light up when you point at it. Every group has a clear name and count ('DA42 · 6') as an
   HTML button above it, placed where it collides with no other name and stays on the plate; click it to fly to the
   group and list its items in the card; click outside to come back.
   WSMAP3D.mount(host, { graph, t, sample, onOpen(node, beside), padBottom, view, onWeak(why), probe, rotateSecs })
     -> { setGraph(g), fit(), focus(i), flyToCluster(k), destroy(), debug, graph, camera, layout, screenOf(i), is3d }
   Frames only while something moves: the intro, a turn with its inertia, a fly-to, a slow sway (about 20 s after
   opening and after you stop interacting, then it stops), a pulse. Idle, no frame is requested at all.
   Reduced motion: no intro, no sway, no pulses, camera moves are instant.
   probe: the first frames are timed; a device that cannot keep up calls onWeak and the page shows the 2D map. */
(function () {
  'use strict';
  const GW = window.WSGRAPH, G3 = window.WSGRAPH3D, UI = window.WSMAP.ui, COL = window.WSMAP.COL;
  /* node size (world units, glow included) and brightness by type */
  const SZ = { aircraft: 4.4, doc: 2.5, page: 1.4, note: 1.9, notebook: 2, pack: 2.2, route: 2.1, desk: 2.1 };
  /* the brain's regions: one calm tint per section (aircraft or group), in the order they are laid out */
  const REG = ['#5AA9FF', '#B48CFF', '#3FD0C9', '#FF8FB8', '#F2C46B', '#7FD67A', '#8EA2FF', '#FF9F6B', '#62D2F0', '#E58CF0'];
  const regCol = k => k < 0 ? null : hex(REG[k % REG.length]);
  const BR = { aircraft: 1.1, doc: 0.88, page: 0.6, note: 0.76, notebook: 0.78, pack: 0.84, route: 0.82, desk: 0.66 };
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const stats = { pulseFrames: 0 };
  const hex = c => { const v = parseInt(c.slice(1), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };
  function supported() {
    try { const c = document.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl'); if (!gl) return false; const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); return true; } catch (e) { return false; }
  }
  const NODE_VS = `
    attribute vec3 color; attribute float size; attribute float alpha; attribute float grow;
    uniform float uScale, uGrow, uNear, uFar, uSweep, uSweepOn; varying vec3 vC; varying float vA;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      float k = smoothstep(grow * 0.86, grow * 0.86 + 0.14, uGrow), d = max(0.1, -mv.z);
      float sw = uSweepOn * exp(-mod(uSweep - atan(position.x, position.z), 6.28318) * 2.6); /* the radar sweep has just passed: a short flash */
      gl_PointSize = clamp(size * (0.3 + 0.7 * k) * (1.0 + 0.45 * sw) * uScale / d, 1.6, 110.0);
      vC = color * (1.0 + 0.9 * sw); vA = alpha * k * (1.0 - 0.72 * smoothstep(uNear, uFar, d));
    }`;
  const NODE_FS = `
    precision mediump float; varying vec3 vC; varying float vA;
    void main() {
      float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0 || vA < 0.004) discard;
      float core = smoothstep(0.34, 0.2, r), halo = exp(-r * r * 6.0) * 0.42 + exp(-r * r * 22.0) * 0.35;
      vec3 c = vC * (core * 0.95 + halo) * vA; gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
    }`;
  const LINE_VS = `
    attribute float alpha; attribute float grow; uniform float uGrow, uNear, uFar; varying float vA;
    void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      vA = alpha * smoothstep(grow * 0.86 + 0.04, grow * 0.86 + 0.16, uGrow) * (1.0 - 0.75 * smoothstep(uNear, uFar, -mv.z)); }`;
  const LINE_FS = `precision mediump float; uniform vec3 uColor; varying float vA; void main() { if (vA < 0.003) discard; vec3 c = uColor * vA; gl_FragColor = vec4(c, max(c.r, max(c.g, c.b))); }`;
  /* the puffs: camera-facing quads with a soft gaussian falloff (volumetric-looking light, no edge) */
  const PUFF_VS = `
    attribute vec2 corner; attribute float rad; attribute float alpha; attribute float grow;
    uniform float uGrow, uNear, uFar; varying vec2 vC; varying float vA;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0); float k = smoothstep(grow * 0.8, grow * 0.8 + 0.35, uGrow);
      mv.xy += corner * rad * (0.55 + 0.45 * k); gl_Position = projectionMatrix * mv;
      vC = corner; vA = alpha * k * (1.0 - 0.45 * smoothstep(uNear, uFar, -mv.z));
    }`;
  const PUFF_FS = `
    precision mediump float; uniform vec3 uColor; varying vec2 vC; varying float vA;
    void main() { float r2 = dot(vC, vC); if (r2 > 1.0 || vA < 0.002) discard; float f = max(0.0, exp(-r2 * 3.0) - 0.05);
      vec3 c = uColor * f * vA; gl_FragColor = vec4(c, max(c.r, max(c.g, c.b))); }`;
  /* the brain: one smooth mesh, lit like a model on a dark plate. Gyri catch the light, sulci fall dark, the outline
     glows (fresnel), each section's region carries its tint, the picked one brighter; the radar sweep passes over it as a band of light */
  const BRAIN_VS = `
    attribute float fold; attribute float reg; attribute vec3 rcol;
    varying vec3 vN, vW, vC; varying float vF, vR;
    void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vF = fold; vR = reg; vC = rcol; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const BRAIN_FS = `
    precision highp float;
    uniform vec3 uCam, uRim, uBase; uniform float uSweep, uSweepOn, uSel, uDim, uGrow;
    varying vec3 vN, vW, vC; varying float vF, vR;
    void main() {
      vec3 N = normalize(vN), V = normalize(uCam - vW); if (dot(N, V) < 0.0) N = -N;
      float ndv = clamp(dot(N, V), 0.0, 1.0), fr = pow(1.0 - ndv, 2.4);
      vec3 L1 = normalize(vec3(-0.4, 0.85, 0.35)), L2 = normalize(vec3(0.7, 0.1, -0.6));
      float lam = max(dot(N, L1), 0.0), back = max(dot(N, L2), 0.0), hl = 0.28 + 0.72 * lam;
      float spec = pow(max(dot(reflect(-L1, N), V), 0.0), 36.0);
      float gy = smoothstep(0.25, 0.95, vF), sel = uSel >= 0.0 && abs(vR - uSel) < 0.5 ? 1.0 : 0.0;
      vec3 col = uBase * hl * mix(0.35, 1.0, gy) + vC * (0.18 + 0.34 * gy) * hl * (1.0 + 1.4 * sel) + uRim * back * 0.12;
      col += vec3(0.75, 0.88, 1.0) * spec * 0.32 * gy + uRim * fr * (0.85 + 0.5 * sel);
      float a = atan(vW.x, vW.z), tr = mod(uSweep - a, 6.28318);
      col += uRim * uSweepOn * (exp(-tr * 5.0) * 0.45 + (1.0 - smoothstep(0.0, 0.02, tr)) * 0.7) * (0.35 + 0.65 * gy);
      col *= (uSel >= 0.0 && sel < 0.5 ? 0.55 : uDim) * smoothstep(0.0, 0.8, uGrow);
      gl_FragColor = vec4(col, 1.0);
    }`;
  /* your items as traffic symbols (TCAS style): aircraft a chevron, documents a filled diamond, notes an open diamond,
     packs a circle, routes a square; crisp at any size, with a soft glow */
  const SYM_VS = `
    attribute vec3 color; attribute float size; attribute float alpha; attribute float grow; attribute float shape;
    uniform float uScale, uGrow, uNear, uFar, uSweep, uSweepOn; varying vec3 vC; varying float vA, vS, vPx;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      float k = smoothstep(grow * 0.86, grow * 0.86 + 0.14, uGrow), d = max(0.1, -mv.z);
      float sw = uSweepOn * exp(-mod(uSweep - atan(position.x, position.z), 6.28318) * 2.6);
      vPx = clamp(size * (0.3 + 0.7 * k) * (1.0 + 0.35 * sw) * uScale / d, 3.0, 90.0); gl_PointSize = vPx;
      vC = color * (1.0 + 0.8 * sw); vA = alpha * k * (1.0 - 0.6 * smoothstep(uNear, uFar, d)); vS = shape;
    }`;
  const SYM_FS = `
    precision highp float; varying vec3 vC; varying float vA, vS, vPx;
    void main() {
      vec2 p = (gl_PointCoord - 0.5) * 2.0; p.y = -p.y; float aa = 2.4 / vPx, s = 0.42, d;
      if (vS < 0.5) { vec2 q = vec2(abs(p.x), p.y), n = vec2(0.906, 0.423); float t1 = max(dot(vec2(q.x, q.y - 0.55), n), -0.45 - q.y), t2 = max(dot(vec2(q.x, q.y + 0.08), n), -0.45 - q.y); d = max(t1, -t2); }   /* chevron */
      else if (vS < 1.5) d = abs(p.x) + abs(p.y) - s * 1.15;                                         /* filled diamond */
      else if (vS < 2.5) d = abs(abs(p.x) + abs(p.y) - s) - 0.09;                                    /* open diamond */
      else if (vS < 3.5) d = length(p) - s * 0.85;                                                   /* circle */
      else if (vS < 4.5) d = length(p) - s * 0.5;                                                    /* small dot */
      else d = max(abs(p.x), abs(p.y)) - s * 0.78;                                                   /* square */
      float core = 1.0 - smoothstep(-aa, aa, d), halo = exp(-max(d, 0.0) * 9.0) * 0.35;
      float a = (core + halo * (1.0 - core)) * vA; if (a < 0.004) discard;
      vec3 c = vC * (core * 1.05 + halo * 0.8); gl_FragColor = vec4(c * vA, a);
    }`;
  /* the radar scope: a drawn compass rose (range rings, 5° ticks, bearings every 30°, N) on a flat disc under the brain,
     with the sweep and its fading trail */
  const SCOPE_VS = `varying vec2 vU; void main() { vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const SCOPE_FS = `
    precision highp float; uniform sampler2D uTex; uniform vec3 uColor; uniform float uSweep, uSweepOn, uA; varying vec2 vU;
    void main() {
      vec2 p = vU * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
      float t = texture2D(uTex, vU).a, a = atan(p.x, p.y), tr = mod(uSweep - a, 6.28318);
      float sw = uSweepOn * (exp(-tr * 2.4) * 0.32 + (1.0 - smoothstep(0.0, 0.01, tr)) * 0.85) * (1.0 - smoothstep(0.9, 0.98, r)) * smoothstep(0.02, 0.1, r);
      float f = t * 0.85 * (1.0 + 1.5 * exp(-tr * 3.0) * uSweepOn) + sw;
      vec3 c = uColor * f * uA; gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
    }`;
  function scopeTexture(THREE) {
    const N = 2048, cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d'), c = N / 2, R = N / 2 - 8;
    x.strokeStyle = '#fff'; x.fillStyle = '#fff';
    [0.25, 0.5, 0.75].forEach(f => { x.globalAlpha = 0.55; x.lineWidth = 3; x.beginPath(); x.arc(c, c, R * f, 0, Math.PI * 2); x.stroke(); });
    x.globalAlpha = 0.9; x.lineWidth = 5; x.beginPath(); x.arc(c, c, R * 0.86, 0, Math.PI * 2); x.stroke();
    for (let d = 0; d < 360; d += 5) { const a = d * Math.PI / 180, l = d % 30 === 0 ? 46 : d % 10 === 0 ? 30 : 16, r0 = R * 0.86; x.globalAlpha = d % 10 === 0 ? 0.9 : 0.55; x.lineWidth = d % 30 === 0 ? 5 : 3;
      x.beginPath(); x.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0); x.lineTo(c + Math.sin(a) * (r0 + l), c - Math.cos(a) * (r0 + l)); x.stroke(); }
    x.globalAlpha = 0.2; x.lineWidth = 2; for (let d = 0; d < 360; d += 30) { const a = d * Math.PI / 180; x.beginPath(); x.moveTo(c + Math.sin(a) * R * 0.12, c - Math.cos(a) * R * 0.12); x.lineTo(c + Math.sin(a) * R * 0.86, c - Math.cos(a) * R * 0.86); x.stroke(); }
    x.globalAlpha = 0.95; x.font = '600 52px "JetBrains Mono", "SFMono-Regular", Menlo, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let d = 0; d < 360; d += 30) { const a = d * Math.PI / 180, r = R * 0.95; x.save(); x.translate(c + Math.sin(a) * r, c - Math.cos(a) * r); x.rotate(a); x.fillText(d === 0 ? 'N' : String(d / 10).padStart(2, '0'), 0, 0); x.restore(); }
    const tx = new THREE.CanvasTexture(cv); tx.anisotropy = 8; tx.generateMipmaps = true; tx.minFilter = THREE.LinearMipmapLinearFilter; return tx;
  }
  /* ---------- the hub airport at night ----------
     buildings: dark roofs with the section's colour along the edge, lit windows along the walls (warm, with mullions),
     the tower cab as lit glass; the picked pier brighter, the rest dimmer */
  const BLD_VS = `
    attribute vec3 tint; attribute float reg; attribute float kind;
    varying vec3 vN, vW, vT; varying float vR, vK;
    void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vT = tint; vR = reg; vK = kind; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const BLD_FS = `
    precision highp float; uniform vec3 uCam, uRim; uniform float uSel, uDim, uGrow, uSweep, uSweepOn;
    varying vec3 vN, vW, vT; varying float vR, vK;
    void main() {
      vec3 N = normalize(vN), V = normalize(uCam - vW); float fr = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.0);
      float sel = uSel >= 0.0 && abs(vR - uSel) < 0.5 ? 1.0 : 0.0, dim = uSel >= 0.0 && vR >= 0.0 && sel < 0.5 ? 0.42 : uDim;
      vec3 col;
      if (vK > 2.5) { col = (vec3(0.07, 0.09, 0.125) + vT * 0.14) * (0.55 + 0.45 * max(N.y, 0.0)) + vT * fr * 0.2; }                     /* jet bridge */
      else if (vK > 1.5) { col = vec3(0.35, 0.85, 1.0) * (0.55 + 0.45 * fr) + vec3(0.1, 0.25, 0.3); }                         /* tower cab glass */
      else if (N.y > 0.5) {                                                                                                  /* roof */
        col = vec3(0.05, 0.075, 0.115) + vT * 0.07 + vec3(0.03, 0.05, 0.08) * fr;
      } else {                                                                                                               /* walls */
        float h = vW.y, band = smoothstep(1.1, 1.35, h) * (1.0 - smoothstep(3.6, 3.85, h));
        float along = vW.x * N.z - vW.z * N.x, mull = smoothstep(0.08, 0.16, abs(fract(along * 0.42) - 0.5));
        vec3 glass = mix(vec3(1.0, 0.84, 0.6), vec3(0.75, 0.88, 1.0), 0.35) * (0.62 + 0.25 * sel);
        col = vec3(0.03, 0.045, 0.07) + band * mull * glass * (vK > 0.5 ? 0.75 : 1.0) + vT * (1.0 - band) * 0.22;
      }
      col += uRim * fr * 0.12 + vT * sel * 0.12;
      float a = atan(vW.x, vW.z), tr = mod(uSweep - a, 6.28318); col += uRim * uSweepOn * exp(-tr * 6.0) * 0.18;
      gl_FragColor = vec4(col * dim * smoothstep(0.0, 0.6, uGrow), 1.0);
    }`;
  /* the ground: dark tarmac, a lighter apron round the terminal, faint grid, fading into the plate */
  const GRD_VS = `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const GRD_FS = `
    precision highp float; uniform float uApron, uFar, uGrow; uniform vec3 uTint; uniform vec4 uRw0, uRw1; varying vec3 vW;
    float rwy(vec4 R, vec2 p) { vec2 q = vec2(p.x, p.y - R.x); if (abs(q.y) > R.z * 0.5 || abs(q.x) > R.y * 0.5) return 0.0;
      float cl = (1.0 - smoothstep(0.25, 0.45, abs(q.y))) * step(0.45, fract(q.x / 14.0)) * step(abs(q.x), R.y * 0.5 - 16.0);
      float keys = step(R.y * 0.5 - 10.0, abs(q.x)) * step(abs(q.x), R.y * 0.5 - 2.0) * step(0.5, fract(q.y * 0.55 + 0.25)) * step(abs(q.y), R.z * 0.5 - 1.2);
      float edge = 1.0 - smoothstep(0.2, 0.4, R.z * 0.5 - abs(q.y));
      return 1.0 + 2.0 * max(cl, max(keys, edge * 0.6)); }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      float r = length(vW.xz), apron = 1.0 - smoothstep(uApron - 6.0, uApron + 6.0, r);
      vec2 gp = abs(fract(vW.xz / 24.0) - 0.5); float grid = (1.0 - smoothstep(0.0, 0.02, min(gp.x, gp.y))) * 0.5;
      vec3 c = mix(vec3(0.018, 0.03, 0.05), vec3(0.045, 0.062, 0.088), apron) + uTint * 0.015 * grid + vec3(0.006) * hash(floor(vW.xz * 0.7));
      float rw = max(rwy(uRw0, vW.xz), rwy(uRw1, vW.xz)); if (rw > 0.0) c = vec3(0.035, 0.045, 0.06) + vec3(0.11, 0.12, 0.13) * (rw - 1.0) * 0.5;
      float a = max(apron * 0.92, 0.16 + 0.1 * grid) * (1.0 - smoothstep(uFar * 0.55, uFar, r)); if (rw > 0.0) a = 0.95 * (1.0 - smoothstep(uFar * 0.75, uFar, r));
      gl_FragColor = vec4(c * smoothstep(0.0, 0.5, uGrow) * a, a);
    }`;
  /* ground lights: small round glows (taxiway green, edge blue, runway white, threshold green, ends red, stand yellow) */
  const LGT_VS = `
    attribute vec3 color; attribute float size; attribute float alpha;
    uniform float uScale, uGrow; varying vec3 vC; varying float vA;
    void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float d = max(0.1, -mv.z);
      gl_PointSize = clamp(size * uScale / d, 1.5, 28.0); vC = color; vA = alpha * smoothstep(0.2, 0.9, uGrow); }`;
  const LGT_FS = `
    precision mediump float; varying vec3 vC; varying float vA;
    void main() { float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0 || vA < 0.004) discard; float f = exp(-r * r * 5.0) + (1.0 - smoothstep(0.18, 0.3, r)) * 0.8;
      vec3 c = vC * f * vA; gl_FragColor = vec4(c, max(c.r, max(c.g, c.b))); }`;
  const SEG = 10; /* segments per link arc */
  /* palettes: Ice (calm ice-blue and white, the default), Ember (warm), Mono (greys); subtle tints per type */
  const PAL = {
    ice: { name: ['Ice', 'Is'], col: COL, line: [0.62, 0.76, 0.93], cloud: [0.36, 0.56, 0.88], pulse: [0.86, 0.93, 1] },
    ember: { name: ['Ember', 'Glød'], col: { aircraft: '#FFF6EA', doc: '#F0BE8A', page: '#B98A63', note: '#F6DDC0', notebook: '#EACBA8', pack: '#E8A98E', route: '#D9C48C', desk: '#9C8672' }, line: [0.93, 0.68, 0.46], cloud: [0.86, 0.48, 0.3], pulse: [1, 0.88, 0.72] },
    mono: { name: ['Mono', 'Mono'], col: { aircraft: '#FFFFFF', doc: '#CFD5DC', page: '#8C949D', note: '#B4BBC4', notebook: '#A9B0B8', pack: '#E3E3E3', route: '#9EA6AF', desk: '#7D848C' }, line: [0.7, 0.72, 0.75], cloud: [0.5, 0.53, 0.58], pulse: [1, 1, 1] }
  };
  const palPref = () => { try { const v = localStorage.getItem('bb-map-palette'); return PAL[v] ? v : 'ice'; } catch (e) { return 'ice'; } };

  function mount(host, o) {
    const THREE = window.THREE, t = o.t || (en => en), esc = UI.esc, sample = !!o.sample;
    const { KN, GN } = UI.names(t);
    let pal = palPref(), growMs = 2600;
    const pcol = () => (PAL[pal] || PAL.ice).col;
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const phone = coarse && Math.min(screen.width, screen.height) < 820;
    host.classList.add('wsm', 'wsm3', 'brainmap');
    host.innerHTML = `<canvas class="wsm-c" tabindex="0" role="img" aria-roledescription="${esc(t('3D map', '3D-kart'))}"></canvas>
      <div class="wsm3-lbl"></div>
      <div class="wsm-top">
        <div class="wsm-q"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.2"/><path d="M12.6 12.6 17 17"/></svg><input type="search" class="wsm-qi" placeholder="${esc(t('Find on the map', 'Finn på kartet'))}" aria-label="${esc(t('Find on the map', 'Finn på kartet'))}" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-autocomplete="list"><ul class="wsm-sug" role="listbox" hidden></ul></div>
        <span class="sp"></span>${o.onEdit && !sample ? `<button type="button" class="wsm-ng" data-ng>${esc(t('+ New group', '+ Ny gruppe'))}</button>` : ''}
        <div class="wsm-zm"><button type="button" data-z="in" aria-label="${esc(t('Zoom in', 'Zoom inn'))}">+</button><button type="button" data-z="out" aria-label="${esc(t('Zoom out', 'Zoom ut'))}">−</button><button type="button" data-z="fit">${esc(t('Reset view', 'Tilbakestill'))}</button></div><div class="wsm-zm wsm-pal" role="group" aria-label="${esc(t('Colours', 'Farger'))}">${Object.keys(PAL).map(k => `<button type="button" data-pal="${k}" aria-pressed="false" title="${esc(t(PAL[k].name[0], PAL[k].name[1]))}" aria-label="${esc(t('Colours: ', 'Farger: ') + t(PAL[k].name[0], PAL[k].name[1]))}"><i class="sw sw-${k}"></i></button>`).join('')}</div>${UI.viewSwitch(o.view, t)}
      </div>
      <div class="wsm-card" hidden></div>
      <div class="wsm-leg" role="group" aria-label="${esc(t('Show on the map', 'Vis på kartet'))}"></div>`;
    const cv = host.querySelector('canvas'), card = host.querySelector('.wsm-card'), legEl = host.querySelector('.wsm-leg'), qi = host.querySelector('.wsm-qi'), sug = host.querySelector('.wsm-sug');
    const lblEl = host.querySelector('.wsm3-lbl');
    { const ng = host.querySelector('[data-ng]'); if (ng) ng.addEventListener('click', () => o.onEdit('newgroup', null, ng)); }
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    const dprCap = phone ? 2 : 2;
    let dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, 0.5, 4000);
    const U = { uScale: { value: 1 }, uGrow: { value: reduced() ? 2 : 0 }, uNear: { value: 10 }, uFar: { value: 100 }, uSweep: { value: 0 }, uSweepOn: { value: 0 } };
    /* additive light on a transparent canvas: colour and alpha both add (premultiplied), so the CSS background shows through */
    const blend = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
    const nodeMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: NODE_VS, fragmentShader: NODE_FS, transparent: true, depthTest: false, depthWrite: false, ...blend });
    const lineU = Object.assign({ uColor: { value: new THREE.Color(0.66, 0.79, 0.94) } }, U);
    const lineMat = new THREE.ShaderMaterial({ uniforms: lineU, vertexShader: LINE_VS, fragmentShader: LINE_FS, transparent: true, depthTest: false, depthWrite: false, ...blend });
    const puffU = Object.assign({ uColor: { value: new THREE.Color(0.36, 0.56, 0.88) } }, U);
    const puffMat = new THREE.ShaderMaterial({ uniforms: puffU, vertexShader: PUFF_VS, fragmentShader: PUFF_FS, transparent: true, depthTest: false, depthWrite: false, ...blend });
    const brainU = { uCam: { value: new THREE.Vector3() }, uRim: { value: new THREE.Color(0.45, 0.72, 1) }, uBase: { value: new THREE.Color(0.1, 0.16, 0.27) }, uSweep: U.uSweep, uSweepOn: U.uSweepOn, uSel: { value: -1 }, uDim: { value: 1 }, uGrow: U.uGrow };
    const scopeTx = scopeTexture(THREE), scopeU = { uTex: { value: scopeTx }, uColor: { value: new THREE.Color(0.36, 0.56, 0.88) }, uSweep: U.uSweep, uSweepOn: U.uSweepOn, uA: { value: 0.4 } };
    const scopeMat = new THREE.ShaderMaterial({ uniforms: scopeU, vertexShader: SCOPE_VS, fragmentShader: SCOPE_FS, transparent: true, depthTest: true, depthWrite: false, ...blend });
    const bldU = { uCam: brainU.uCam, uRim: brainU.uRim, uSel: brainU.uSel, uDim: brainU.uDim, uGrow: U.uGrow, uSweep: U.uSweep, uSweepOn: U.uSweepOn };
    const bldMat = new THREE.ShaderMaterial({ uniforms: bldU, vertexShader: BLD_VS, fragmentShader: BLD_FS });
    const grdU = { uApron: { value: 60 }, uFar: { value: 300 }, uGrow: U.uGrow, uTint: brainU.uRim, uRw0: { value: new THREE.Vector4() }, uRw1: { value: new THREE.Vector4() } };
    const grdMat = new THREE.ShaderMaterial({ uniforms: grdU, vertexShader: GRD_VS, fragmentShader: GRD_FS, transparent: true, depthWrite: false });
    const lgtMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: LGT_VS, fragmentShader: LGT_FS, transparent: true, depthTest: true, depthWrite: false, ...blend });
    const outlineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const standMat = new THREE.LineBasicMaterial({ color: 0xE8B43C, transparent: true, opacity: 0.35, depthWrite: false });
    const brainMat = new THREE.ShaderMaterial({ uniforms: brainU, vertexShader: BRAIN_VS, fragmentShader: BRAIN_FS, side: THREE.DoubleSide });
    const symMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: SYM_VS, fragmentShader: SYM_FS, transparent: true, depthTest: true, depthWrite: false, blending: THREE.NormalBlending, premultipliedAlpha: true });
    const pulseMat = new THREE.ShaderMaterial({ uniforms: Object.assign({}, U, { uGrow: { value: 2 } }), vertexShader: NODE_VS, fragmentShader: NODE_FS, transparent: true, depthTest: false, depthWrite: false, ...blend });

    let g = null, L = null, N = 0, alive = true, raf = 0, W = 0, H = 0;
    let nodes = null, links = null, cloud = null, pulsePts = null, curves = null, puffOf = null, brain = null, SH = null, scope = null, AP = null;
    let hover = -1, sel = -1, gsel = -1, hidden = new Set(), near = null, names2 = [];
    const scr = { x: new Float32Array(0), y: new Float32Array(0), d: new Float32Array(0), ok: false };
    /* camera: orbit round a target */
    const cam = { tx: 0, ty: 0, tz: 0, th: 0.55, ph: 1.2, d: 100, dT: 100 }, home = { tx: 0, ty: 0, tz: 0, th: 0.55, ph: 1.2, d: 100 };
    let vth = 0, vph = 0, tween = null, introP = reduced() ? 1 : 0, lastTs = 0;
    const rot = { on: false, t: 0, secs: o.rotateSecs || 20, timer: 0 };
    let pulses = [], ambT = 0, onScreen = true, interacting = false;
    const cpu = []; let probeD = [], probing = !!o.probe && !reduced();
    const dbg = { frames: 0, renders: 0, is3d: true, regions: [], labels: [], groupLabels: [], get gsel() { return gsel; },
      get running() { return !!raf; }, get settled() { return introP >= 1; }, get rotating() { return rot.on || !!rot.timer; }, get pulses() { return pulses.length; },
      get hover() { return hover; }, get sel() { return sel; }, get dpr() { return dpr; },
      get cpu() { const a = cpu.slice().sort((x, y) => x - y); return { n: a.length, avg: a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, p95: a.length ? a[Math.floor((a.length - 1) * 0.95)] : 0, max: a.length ? a[a.length - 1] : 0 }; } };
    const isEx = i => i >= 0 && sample;
    const visible = i => !hidden.has(g.nodes[i].g);

    /* ---------- data -> buffers ---------- */
    function disposeObjs() { [nodes, links, cloud, pulsePts, brain, scope].concat(AP ? AP.objs : []).forEach(m => { if (m) { scene.remove(m); m.geometry.dispose(); } }); nodes = links = cloud = pulsePts = brain = scope = AP = null; }
    const aspect = () => { const r = host.getBoundingClientRect(); return r.width && r.height ? Math.max(0.45, Math.min(3, (r.width - 32) / Math.max(120, r.height - padT() - padB()))) : 1.7; };
    function setGraph(ng, keep) {
      const before = g && keep ? new Set(g.nodes.map(n => n.id)) : null;
      g = ng; N = g.nodes.length; L = G3.layout3d(g, { aspect: aspect() }); hover = -1; sel = -1; gsel = -1; near = null; pulses = []; if (card) card.hidden = true;
      names2 = L.clusters.map(c => GW.groupName(g, L.clusters, c, t));
      disposeObjs();
      /* grow-in: everything on open; only the new points when items are added */
      const fresh = before ? g.nodes.map(n => !before.has(n.id)) : null, regrow = !reduced() && (!before || fresh.some(Boolean));
      const P = L.P, size = new Float32Array(N), al = new Float32Array(N), gr = new Float32Array(N);
      g.nodes.forEach((n, i) => { size[i] = (SZ[n.k] || 1.8) * (n.k === 'doc' ? 1 + Math.min(0.3, n.deg * 0.035) : 1); al[i] = 1; gr[i] = fresh && !fresh[i] ? 0 : L.grow[i]; });
      let geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1)); geo.setAttribute('alpha', new THREE.BufferAttribute(al, 1)); geo.setAttribute('grow', new THREE.BufferAttribute(gr, 1));
      if (L.brain || L.hub) { for (let i = 0; i < N; i++) size[i] *= L.hub ? 2.2 : 1.7; const SHP = { aircraft: 0, doc: 1, page: 4, note: 2, notebook: 2, pack: 3, route: 5, desk: 4 }; geo.setAttribute('shape', new THREE.BufferAttribute(Float32Array.from(g.nodes, n => SHP[n.k] != null ? SHP[n.k] : 4), 1)); }
      nodes = new THREE.Points(geo, L.brain || L.hub ? symMat : nodeMat); nodes.frustumCulled = false; nodes.renderOrder = 3; nodes.userData.size = size.slice();
      /* links: gentle arcs bowed away from the middle of the cloud; they grow from one end to the other */
      const nl = g.links.length, lp = new Float32Array(nl * SEG * 6), la = new Float32Array(nl * SEG * 2), lg = new Float32Array(nl * SEG * 2), C = L.center; curves = new Float32Array(nl * (SEG + 1) * 3);
      g.links.forEach((l, k) => {
        const a = [P[l.s * 3], P[l.s * 3 + 1], P[l.s * 3 + 2]], b = [P[l.t * 3], P[l.t * 3 + 1], P[l.t * 3 + 2]], m = [(a[0] + b[0]) / 2 - C[0], (a[1] + b[1]) / 2 - C[1], (a[2] + b[2]) / 2 - C[2]];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), ml = Math.hypot(m[0], m[1], m[2]), u = ml > 0.5 ? [m[0] / ml, m[1] / ml, m[2] / ml] : [0, 1, 0];
        const bow = len * 0.08, c = [m[0] + C[0] + u[0] * bow, m[1] + C[1] + u[1] * bow, m[2] + C[2] + u[2] * bow];
        for (let s2 = 0; s2 <= SEG; s2++) { const q = s2 / SEG, w0 = (1 - q) * (1 - q), w1 = 2 * q * (1 - q), w2 = q * q; curves.set([a[0] * w0 + c[0] * w1 + b[0] * w2, a[1] * w0 + c[1] * w1 + b[1] * w2, a[2] * w0 + c[2] * w1 + b[2] * w2], (k * (SEG + 1) + s2) * 3); }
        const ga = gr[l.s], gb = gr[l.t], g0 = Math.min(ga, gb), g1 = Math.max(ga, gb), from = ga <= gb;
        for (let s2 = 0; s2 < SEG; s2++) { const o0 = (k * (SEG + 1) + s2) * 3; lp.set(curves.subarray(o0, o0 + 6), (k * SEG + s2) * 6);
          const q0 = from ? s2 / SEG : 1 - s2 / SEG, q1 = from ? (s2 + 1) / SEG : 1 - (s2 + 1) / SEG; lg[(k * SEG + s2) * 2] = g0 + (g1 - g0) * q0 * 0.9 + 0.02; lg[(k * SEG + s2) * 2 + 1] = g0 + (g1 - g0) * q1 * 0.9 + 0.02; }
      });
      geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(lp, 3)); geo.setAttribute('alpha', new THREE.BufferAttribute(la, 1)); geo.setAttribute('grow', new THREE.BufferAttribute(lg, 1));
      links = new THREE.LineSegments(geo, lineMat); links.frustumCulled = false; links.renderOrder = 2;
      scene.add(links); scene.add(nodes);
      /* the soft light: a few big puffs per group, behind everything */
      const PF = G3.puffs(L.clusters), np = PF.length / 5, pp = new Float32Array(np * 18), pc = new Float32Array(np * 12), pr2 = new Float32Array(np * 6), pa = new Float32Array(np * 6), pg = new Float32Array(np * 6);
      const CO = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]; puffOf = new Int32Array(np);
      for (let k = 0; k < np; k++) {
        const ck = PF[k * 5 + 4], core = !k || PF[k * 5 - 1] !== ck, gk = Math.min(1, Math.hypot(PF[k * 5], PF[k * 5 + 1], PF[k * 5 + 2]) / L.R) * 0.7; puffOf[k] = ck;
        for (let v = 0; v < 6; v++) { pp.set([PF[k * 5], PF[k * 5 + 1], PF[k * 5 + 2]], (k * 6 + v) * 3); pc.set(CO[v], (k * 6 + v) * 2); pr2[k * 6 + v] = PF[k * 5 + 3]; pa[k * 6 + v] = L.brain ? (core ? 0.09 : 0.05) : core ? 0.2 : 0.13; pg[k * 6 + v] = before ? 0 : gk; }
      }
      geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pp, 3)); geo.setAttribute('corner', new THREE.BufferAttribute(pc, 2)); geo.setAttribute('rad', new THREE.BufferAttribute(pr2, 1)); geo.setAttribute('alpha', new THREE.BufferAttribute(pa, 1)); geo.setAttribute('grow', new THREE.BufferAttribute(pg, 1));
      cloud = new THREE.Mesh(geo, puffMat); cloud.frustumCulled = false; cloud.renderOrder = 0; cloud.userData.base = pa.slice(); scene.add(cloud);
      /* the brain itself: one smooth mesh, each section's region in its own tint; the radar scope under it */
      cloud.visible = !L.brain && !L.hub;
      if (L.brain && G3.shell) {
        SH = G3.shell(L, phone ? 5 : 6); const M = SH.n;
        geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(SH.P, 3)); geo.setIndex(new THREE.BufferAttribute(SH.I, 1));
        geo.setAttribute('fold', new THREE.BufferAttribute(SH.F, 1)); geo.setAttribute('reg', new THREE.BufferAttribute(Float32Array.from(SH.reg), 1)); geo.setAttribute('rcol', new THREE.BufferAttribute(new Float32Array(M * 3), 3));
        geo.computeVertexNormals();
        brain = new THREE.Mesh(geo, brainMat); brain.frustumCulled = false; brain.renderOrder = 0; scene.add(brain);
        const R2 = L.S * 1.08; scope = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), scopeMat); scope.scale.set(R2, R2, 1); scope.rotation.x = -Math.PI / 2; scope.position.set(0, -0.8 * L.S, -0.05 * L.S); scope.frustumCulled = false; scope.renderOrder = 1; scene.add(scope);
        links.material.depthTest = true;
      } else if (L.hub) { SH = null; links.material.depthTest = true; AP = buildAirport();
        const R2 = L.airport.reach + 26; scope = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), scopeMat); scope.scale.set(R2, R2, 1); scope.rotation.x = -Math.PI / 2; scope.position.set(0, 0.08, 0); scope.frustumCulled = false; scope.renderOrder = 1; scene.add(scope);
      } else { SH = null; links.material.depthTest = false; }
      /* pulses: up to 6 at once, a head and a short trail each */
      geo = new THREE.BufferGeometry(); const PM = 36;
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PM * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(PM * 3).fill(0.9), 3));
      geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(PM), 1)); geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(PM), 1)); geo.setAttribute('grow', new THREE.BufferAttribute(new Float32Array(PM), 1));
      pulsePts = new THREE.Points(geo, pulseMat); pulsePts.frustumCulled = false; pulsePts.renderOrder = 4; pulsePts.visible = false; scene.add(pulsePts);
      scr.x = new Float32Array(N); scr.y = new Float32Array(N); scr.d = new Float32Array(N); scr.ok = false;
      paint(); buildLabels(); states(); drawLegend();
      host.setAttribute('data-nodes', N);
      cv.setAttribute('aria-label', t('3D map of your workspace: ', '3D-kart over arbeidsområdet ditt: ') + legendText());
      if (!keep || W) { homeView(); if (!keep) { Object.assign(cam, home); cam.dT = cam.d; } }
      if (regrow) { introP = 0; U.uGrow.value = 0; growMs = before ? 1500 : 2600; stopRot(); } else { introP = 1; U.uGrow.value = 2; }
      request();
    }
    /* ---------- the hub airport: terminal and tower, piers, jet bridges, ground, lights, landing traffic ---------- */
    function buildAirport() {
      const A = L.airport, objs = [], pos = [], nor = [], tin = [], rg = [], kd = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      const put = (geo, x, y, z, ry, tint, reg, kind) => { const gg = geo.index ? geo.toNonIndexed() : geo; e.set(0, ry || 0, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); gg.applyMatrix4(m4);
        const P = gg.attributes.position.array, Nn = gg.attributes.normal.array; for (let i = 0; i < P.length; i += 3) { pos.push(P[i], P[i + 1], P[i + 2]); nor.push(Nn[i], Nn[i + 1], Nn[i + 2]); tin.push(tint[0], tint[1], tint[2]); rg.push(reg); kd.push(kind); } gg.dispose(); if (gg !== geo) geo.dispose(); };
      const T0 = [0.45, 0.72, 1];
      put(new THREE.CylinderGeometry(A.RT, A.RT, 6, 72), 0, 3, 0, 0, T0, -1, 0);                 /* terminal */
      put(new THREE.CylinderGeometry(A.RT * 0.55, A.RT * 0.55, 2.4, 48), 0, 7.2, 0, 0, T0, -1, 1); /* upper level */
      put(new THREE.CylinderGeometry(2.2, 3.4, 30, 24), 0, 15, 0, 0, T0, -1, 1);                   /* tower shaft */
      put(new THREE.CylinderGeometry(5.8, 4.2, 4.6, 24), 0, 32.3, 0, 0, T0, -1, 2);                /* tower cab */
      put(new THREE.CylinderGeometry(6.4, 6.4, 0.7, 24), 0, 34.9, 0, 0, T0, -1, 0);
      const lp = [], lc = [], ls = [], la = [], stand = [];
      const light = (x, z, c, sz, a, y) => { lp.push(x, y == null ? 0.35 : y, z); lc.push(c[0], c[1], c[2]); ls.push(sz); la.push(a == null ? 1 : a); return ls.length - 1; };
      const GRN = [0.25, 1, 0.5], BLU = [0.3, 0.55, 1], WHT = [1, 0.95, 0.86], RED = [1, 0.22, 0.16], YEL = [1, 0.78, 0.25];
      L.clusters.forEach((c, k) => {
        const p = A.piers[k], tint = regCol(k) || T0, mid = (p.r0 + p.r1) / 2, ry = -p.ang;
        put(new THREE.BoxGeometry(p.r1 - p.r0, A.PH, A.PW), p.dir[0] * mid, A.PH / 2, p.dir[2] * mid, ry, tint, k, 0);
        put(new THREE.CylinderGeometry(A.PW * 0.8, A.PW * 0.8, A.PH + 0.8, 32), p.dir[0] * p.r1, (A.PH + 0.8) / 2, p.dir[2] * p.r1, 0, tint, k, 0);
        light(p.dir[0] * p.r1, p.dir[2] * p.r1, RED, 2.2, 0.9, A.PH + 1.2);
        c.m.forEach(i => { if (g.nodes[i].k === 'aircraft') return; const x = L.P[i * 3], z = L.P[i * 3 + 2], sd = x * p.side[0] + z * p.side[2];
          const along = x * p.dir[0] + z * p.dir[2], s0 = Math.sign(sd) || 1, wall = A.PW / 2, near = Math.abs(sd) < wall + 12;
          if (near) { const bx = p.dir[0] * along + p.side[0] * s0 * (wall + 3), bz = p.dir[2] * along + p.side[2] * s0 * (wall + 3); put(new THREE.BoxGeometry(1.4, 1.2, 6), bx, 2.6, bz, ry, tint, k, 3); }   /* jet bridge */
          const w0 = [p.dir[0] * along + p.side[0] * s0 * wall, p.dir[2] * along + p.side[2] * s0 * wall]; stand.push(w0[0], 0.12, w0[1], x, 0.12, z);   /* lead-in line */
          light(x + p.side[0] * s0 * 3.5, z + p.side[2] * s0 * 3.5, YEL, 1.1, 0.55); });
      });
      /* neon roof outlines in each section's colour, and round the terminal */
      const ol = [], oc = [], seg = (a, b, c) => { ol.push(...a, ...b); oc.push(...c, ...c); };
      L.clusters.forEach((c, k) => { const p = A.piers[k], col = regCol(k) || T0, y = A.PH + 0.05, w = A.PW / 2, P0 = (r, s2) => [p.dir[0] * r + p.side[0] * s2, y, p.dir[2] * r + p.side[2] * s2];
        seg(P0(A.RT, -w), P0(p.r1, -w), col); seg(P0(A.RT, w), P0(p.r1, w), col);
        for (let j = 0; j < 40; j++) { const a1 = j / 40 * Math.PI * 2, a2 = (j + 1) / 40 * Math.PI * 2, R1 = A.PW * 0.8; seg([p.dir[0] * p.r1 + Math.cos(a1) * R1, A.PH + 0.85, p.dir[2] * p.r1 + Math.sin(a1) * R1], [p.dir[0] * p.r1 + Math.cos(a2) * R1, A.PH + 0.85, p.dir[2] * p.r1 + Math.sin(a2) * R1], col); } });
      for (let j = 0; j < 96; j++) { const a1 = j / 96 * Math.PI * 2, a2 = (j + 1) / 96 * Math.PI * 2; seg([Math.cos(a1) * A.RT, 6.05, Math.sin(a1) * A.RT], [Math.cos(a2) * A.RT, 6.05, Math.sin(a2) * A.RT], T0); }
      let geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(ol, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(oc, 3));
      const outl = new THREE.LineSegments(geo, outlineMat); outl.frustumCulled = false; outl.renderOrder = 2; scene.add(outl); objs.push(outl);
      geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('tint', new THREE.Float32BufferAttribute(tin, 3)); geo.setAttribute('reg', new THREE.Float32BufferAttribute(rg, 1)); geo.setAttribute('kind', new THREE.Float32BufferAttribute(kd, 1));
      const bld = new THREE.Mesh(geo, bldMat); bld.frustumCulled = false; scene.add(bld); objs.push(bld);
      /* ground */
      const far = L.R * 1.45, gr = new THREE.Mesh(new THREE.PlaneGeometry(far * 2, far * 2), grdMat); gr.rotation.x = -Math.PI / 2; gr.frustumCulled = false; gr.renderOrder = -1; scene.add(gr); objs.push(gr);
      grdU.uApron.value = A.reach + 8; grdU.uFar.value = far; grdU.uRw0.value.set(A.runways[0].z, A.runways[0].len, A.runways[0].w, 0); grdU.uRw1.value.set(A.runways[1].z, A.runways[1].len, A.runways[1].w, 0);
      /* taxiways: a ring round the field, lanes between the piers, links to both runways */
      const Rr = A.reach + 12;
      for (let a = 0; a < Math.PI * 2; a += 5 / Rr) light(Math.cos(a) * Rr, Math.sin(a) * Rr, GRN, 1.1, 0.8);
      for (let a = 0; a < Math.PI * 2; a += 10 / Rr) { light(Math.cos(a) * (Rr - 6), Math.sin(a) * (Rr - 6), BLU, 1.2, 0.7); light(Math.cos(a) * (Rr + 6), Math.sin(a) * (Rr + 6), BLU, 1.2, 0.7); }
      const n = A.piers.length; if (n > 1) A.piers.forEach((p, k) => { const b = p.ang + Math.PI / n; for (let r = A.RT + 8; r < Rr - 4; r += 5) light(Math.cos(b) * r, Math.sin(b) * r, GRN, 1, 0.7); });
      A.runways.forEach(w => { const sg = Math.sign(w.z), z0 = sg * Rr, z1 = w.z - sg * (w.w / 2 + 2); [-0.3, 0, 0.3].forEach(f => { const x = f * w.len; if (Math.abs(x) > w.len / 2 - 20) return; for (let z = z0; sg > 0 ? z < z1 : z > z1; z += sg * 5) light(x, z, GRN, 1, 0.75); }); });
      /* runways: edges, centreline, thresholds, ends, approach lights (the rabbit runs on runway 1) */
      const rabbit = [];
      A.runways.forEach((w, ri) => { const h = w.len / 2;
        for (let x = -h; x <= h; x += 12) { light(x, w.z - w.w / 2, WHT, 1.4, 0.85); light(x, w.z + w.w / 2, WHT, 1.4, 0.85); }
        for (let x = -h + 16; x <= h - 16; x += 8) light(x, w.z, WHT, 0.8, 0.45);
        for (let k = -4; k <= 4; k++) { light(-h, w.z + k * w.w / 9, GRN, 1.6, 1); light(h, w.z + k * w.w / 9, RED, 1.6, 0.9); }
        for (let b = 1; b <= 14; b++) { const x = -h - b * 9; for (let k = -2; k <= 2; k++) light(x, w.z + k * 2.2, WHT, 1.3, 0.75); if (ri === 0) rabbit.push(light(x, w.z, WHT, 3.2, 0)); }
      });
      const beacon = light(0, 0, RED, 3, 1, 36);
      geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3)); geo.setAttribute('size', new THREE.Float32BufferAttribute(ls, 1)); geo.setAttribute('alpha', new THREE.Float32BufferAttribute(la, 1));
      const lights = new THREE.Points(geo, lgtMat); lights.frustumCulled = false; lights.renderOrder = 2; scene.add(lights); objs.push(lights);
      geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(stand, 3)); const st = new THREE.LineSegments(geo, standMat); st.frustumCulled = false; scene.add(st); objs.push(st);
      /* landing traffic: landing lights and navigation lights, on runway 1 now and then */
      geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 0.95, 1, 0.2, 0.15, 0.25, 1, 0.45, 1, 1, 1], 3)); geo.setAttribute('size', new THREE.Float32BufferAttribute([5, 2, 2, 3], 1)); geo.setAttribute('alpha', new THREE.Float32BufferAttribute(new Float32Array(4), 1));
      const traffic = new THREE.Points(geo, lgtMat); traffic.frustumCulled = false; traffic.renderOrder = 3; scene.add(traffic); objs.push(traffic);
      return { objs, bld, lights, traffic, rabbit, beacon };
    }
    function animAirport(ts) {
      if (!AP) return; const A = L.airport, la = AP.lights.geometry.attributes.alpha;
      AP.rabbit.forEach((ix, k) => { const ph = ((ts / 500) % 1) * AP.rabbit.length; la.array[ix] = Math.abs(ph - (AP.rabbit.length - 1 - k)) < 0.6 ? 1 : 0; });
      la.array[AP.beacon] = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(ts / 420), 6); la.needsUpdate = true;
      const w = A.runways[0], h = w.len / 2, t = (ts % 52000) / 52000, tp = AP.traffic.geometry.attributes.position, ta = AP.traffic.geometry.attributes.alpha;
      let x, y, a; if (t < 0.6) { const u = t / 0.6; x = -h - 300 + u * 320; y = Math.max(0.8, 42 * (1 - u) * (1 - u * 0.15)); a = Math.min(1, u * 4); } else if (t < 0.82) { const u = (t - 0.6) / 0.22; x = -h + 20 + (1 - (1 - u) * (1 - u)) * 170; y = 0.8; a = 1; } else { x = -h + 190; y = 0.8; a = Math.max(0, 1 - (t - 0.82) / 0.06); }
      tp.array.set([x, y, w.z, x - 1, y, w.z - 3.4, x - 1, y, w.z + 3.4, x - 3, y + 0.8, w.z], 0); tp.needsUpdate = true;
      const strobe = (ts % 1100) < 70 ? 1 : 0; ta.array.set([a, a * 0.9, a * 0.9, a * strobe], 0); ta.needsUpdate = true;
    }

    /* the palette: node colours by type, link and background-neuron colours, the plate's background */
    function paint() {
      const p = PAL[pal] || PAL.ice, c = nodes.geometry.attributes.color;
      g.nodes.forEach((n, i) => { const h = hex(p.col[n.k] || p.col.note), b = BR[n.k] || 0.8; c.array.set([h[0] * b, h[1] * b, h[2] * b], i * 3); }); c.needsUpdate = true;
      lineU.uColor.value.setRGB(...p.line); puffU.uColor.value.setRGB(...p.cloud); scopeU.uColor.value.setRGB(...p.line);
      if (brain && SH) { const bc = brain.geometry.attributes.rcol, base = p.cloud;
        for (let j = 0; j < SH.n; j++) { const r = regCol(SH.reg[j]), r2 = regCol(SH.reg2[j]) || r, m = SH.mix[j], k = 0.62; if (r && pal !== 'mono') bc.array.set([0, 1, 2].map(a => (r[a] * m + r2[a] * (1 - m)) * k), j * 3); else bc.array.set([base[0] * 0.5, base[1] * 0.5, base[2] * 0.5], j * 3); }
        bc.needsUpdate = true; brainU.uRim.value.setRGB(...p.line); brainU.uBase.value.setRGB(p.cloud[0] * 0.3, p.cloud[1] * 0.3, p.cloud[2] * 0.33); }
      const pc = pulsePts && pulsePts.geometry.attributes.color; if (pc) { for (let i = 0; i < pc.count; i++) pc.array.set(p.pulse, i * 3); pc.needsUpdate = true; }
      host.dataset.pal = pal;
      const pb = host.querySelector('.wsm-pal'); if (pb) pb.querySelectorAll('[data-pal]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pal === pal)));
    }
    function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t2 = Math.imul(a ^ a >>> 15, 1 | a); t2 = t2 + Math.imul(t2 ^ t2 >>> 7, 61 | t2) ^ t2; return ((t2 ^ t2 >>> 14) >>> 0) / 4294967296; }; }

    /* highlight: the focused node with its neighbours and links bright, or the points the search matches, or the focused
       group; the rest dim. Types switched off in the colour key stay as faint points you cannot pick. */
    let lit = null, ksel = null;   /* ksel: a type picked in the sidebar (doc, note …): its items light up and are listed */
    const inner = l => L.gi[l.s] === L.gi[l.t];
    function states() {
      if (!nodes) return;
      const focus = hover >= 0 ? hover : sel; near = focus >= 0 ? UI.neighOf(g, focus) : null;
      const on = near || lit, al = nodes.geometry.attributes.alpha;
      for (let i = 0; i < N; i++) al.array[i] = !visible(i) ? 0.07 : on ? (on.has(i) ? 1 : 0.13) : gsel >= 0 && L.gi[i] !== gsel ? 0.2 : 1;
      al.needsUpdate = true;
      { const sz = nodes.geometry.attributes.size, b0 = nodes.userData.size; for (let i = 0; i < N; i++) sz.array[i] = ksel && lit && lit.has(i) ? b0[i] * 1.8 : b0[i]; sz.needsUpdate = true; }   /* a picked type stands out */
      const la = links.geometry.attributes.alpha;
      g.links.forEach((l, k) => {
        const v = visible(l.s) && visible(l.t), hl = near ? (l.s === focus || l.t === focus) : lit ? (lit.has(l.s) && lit.has(l.t)) : false;
        const a = !v ? 0 : hl ? 0.85 : !inner(l) ? 0 : on ? 0.03 : gsel >= 0 && L.gi[l.s] !== gsel ? 0.03 : 0.13;
        for (let s2 = 0; s2 < SEG; s2++) { const mid = x => a * (0.75 + 0.25 * Math.sin(Math.PI * x)); la.array[(k * SEG + s2) * 2] = mid(s2 / SEG); la.array[(k * SEG + s2) * 2 + 1] = mid((s2 + 1) / SEG); }
      });
      la.needsUpdate = true;
      /* the puffs: the focused group's light up, the others fade back */
      const pa = cloud.geometry.attributes.alpha, base = cloud.userData.base;
      for (let k = 0; k < puffOf.length; k++) { const f = gsel < 0 ? 1 : puffOf[k] === gsel ? 1.25 : 0.4; for (let v = 0; v < 6; v++) pa.array[k * 6 + v] = base[k * 6 + v] * f; }
      pa.needsUpdate = true;
      if (brain || AP) { brainU.uSel.value = gsel; brainU.uDim.value = ksel ? 0.55 : 1; }
      regEls.forEach((el, k) => { el.classList.toggle('on', k === gsel); el.classList.toggle('dim', gsel >= 0 && k !== gsel); });
      dbg.lit = lit ? lit.size : 0;
      labelSet(); request();
    }
    const legendText = () => GW.GROUPS.filter(k => g.counts[k] || hidden.has(k)).map(k => GN[k] + ' ' + g.counts[k]).join(' · ');
    function drawLegend() {
      legEl.innerHTML = GW.GROUPS.filter(k => g.counts[k] || hidden.has(k)).map((k, i) => `${i ? '<span class="dot" aria-hidden="true">·</span>' : ''}<button type="button" data-g="${k}" aria-pressed="${!hidden.has(k)}"><i style="background:${pcol()[k]}"></i>${esc(GN[k])} <b>${g.counts[k]}</b></button>`).join('');
    }

    /* ---------- labels (HTML, crisp): group names with counts (buttons), the focused node and its neighbours ---------- */
    let regEls = [], nodeEls = [], shownLbl = [];
    function buildLabels() {
      lblEl.innerHTML = '';
      regEls = L.clusters.map((c, k) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'wsm3-reg' + (c.ac < 0 ? ' uns' : '');
        if (L.brain) b.style.setProperty('--rc', REG[k % REG.length]); b.innerHTML = `${L.brain ? `<i class="rg" aria-hidden="true"></i>` : ''}<b>${esc(names2[k].toUpperCase())}</b><span>&nbsp;·&nbsp;${c.n}</span>`;
        b.setAttribute('aria-label', t('Show the group ', 'Vis gruppen ') + names2[k] + ', ' + c.n);
        b.addEventListener('click', () => { if (gsel === k && sel < 0) back(); else flyToCluster(k); }); lblEl.appendChild(b); return b;
      });
      dbg.regions = names2.slice();
      nodeEls = [];
    }
    function labelSet() {
      const focus = hover >= 0 ? hover : sel, want = [];
      if (focus >= 0) { want.push(focus); if (near) [...near].filter(j => j !== focus && visible(j) && g.nodes[j].k !== 'aircraft').sort((a, b) => g.nodes[b].deg - g.nodes[a].deg).slice(0, 10).forEach(j => want.push(j)); }
      if (gsel >= 0 && introP >= 1) L.clusters[gsel].m.forEach(j => { if (visible(j) && !want.includes(j) && want.length < 40) want.push(j); });
      if (ksel && lit && introP >= 1) [...lit].forEach(j => { if (!want.includes(j) && want.length < 40) want.push(j); });
      shownLbl = want;
      while (nodeEls.length < want.length) { const s = document.createElement('span'); s.className = 'wsm3-nl'; lblEl.appendChild(s); nodeEls.push(s); }
      nodeEls.forEach((s, k) => { const i = want[k]; if (i == null) { s.hidden = true; return; } s.hidden = false; s.classList.toggle('on', i === focus); const lb = g.nodes[i].label, tx = lb.length > 44 ? lb.slice(0, 43) + '…' : lb; if (s.textContent !== tx) { s.textContent = tx; s._w = 0; } });
      dbg.labels = want.map(i => g.nodes[i].id);
    }

    /* ---------- camera ---------- */
    const v3 = new THREE.Vector3();
    function padT() { return W < 600 ? 96 : 60; }
    function padB() { return o.padBottom || 64; }
    /* the distance at which a box of half-width hw and half-height hh (world units, round the target) fills the free
       part of the plate (between the toolbar and the colour key); depth adds a little for the near side */
    function fitDist(hw, hh, depth, avail) {
      const vf = THREE.MathUtils.degToRad(camera.fov), hAvail = Math.max(120, avail || H - padT() - padB() - 16), tv = Math.tan(vf / 2) * hAvail / H, th = Math.tan(vf / 2) * (W - 32) / H;
      return Math.max(hh / tv, hw / th) + (depth == null ? hw * 0.3 : depth);
    }
    /* home: the whole cloud, seen almost from the front and a little from above, names included */
    function homeView() {
      const th = L.hub ? 0.62 : L.brain ? -0.9 : 0.16, ph = L.hub ? 0.92 : L.brain ? 1.22 : 1.4;
      const dir = [Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th)];
      const rt = [dir[2], 0, -dir[0]], rl = Math.hypot(rt[0], rt[2]); rt[0] /= rl; rt[2] /= rl;
      const up = [dir[1] * rt[2] - dir[2] * rt[1], dir[2] * rt[0] - dir[0] * rt[2], dir[0] * rt[1] - dir[1] * rt[0]];
      const dot = (a, p) => a[0] * p[0] + a[1] * p[1] + a[2] * p[2];
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z1 = 0;
      L.clusters.forEach(c => { const x = dot(rt, c.c), y = dot(up, c.c), z = dot(dir, c.c), r = c.r + L.D * 0.8; x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r + L.D * 2.2); z1 = Math.max(z1, z + c.r); });
      if (L.brain && SH) for (let j = 0; j < SH.n; j += 97) { const q = [SH.P[j * 3], SH.P[j * 3 + 1], SH.P[j * 3 + 2]], x = dot(rt, q), y = dot(up, q); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (L.brain && scope) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, q = [Math.sin(a) * L.S * 1.0, -0.8 * L.S, Math.cos(a) * L.S * 1.0 - 0.05 * L.S], x = dot(rt, q), y = dot(up, q); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (L.hub) { const A = L.airport, pts = [[0, 36, 0]]; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; pts.push([Math.cos(a) * (A.reach + 14), 0, Math.sin(a) * (A.reach + 14)]); } pts.forEach(q => { const x = dot(rt, q), y = dot(up, q); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }); }
      if (!L.clusters.length && !(L.brain && SH) && !L.hub) { x0 = y0 = -10; x1 = y1 = 10; }
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, c = [0, 1, 2].map(a => rt[a] * mx + up[a] * my);
      Object.assign(home, { tx: c[0], ty: c[1], tz: c[2], th, ph, d: fitDist((x1 - x0) / 2, (y1 - y0) / 2, z1 * 0.6) });
    }
    function place() {
      const sp = Math.sin(cam.ph);
      camera.position.set(cam.tx + cam.d * sp * Math.sin(cam.th), cam.ty + cam.d * Math.cos(cam.ph), cam.tz + cam.d * sp * Math.cos(cam.th));
      camera.lookAt(cam.tx, cam.ty, cam.tz); camera.updateMatrixWorld(); brainU.uCam.value.copy(camera.position);
      const c0 = L.center, dc = Math.hypot(camera.position.x - c0[0], camera.position.y - c0[1], camera.position.z - c0[2]);
      U.uNear.value = Math.max(1, dc - L.R * 0.6); U.uFar.value = dc + L.R * 1.25;
      U.uScale.value = H * dpr / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    }
    const lim = () => ({ min: Math.max(6, L.D * 3), max: home.d * 2.6 });
    function flyTo(tg, ms) {
      stopRot();
      if (reduced() || !ms) { tween = null; Object.assign(cam, tg); cam.dT = cam.d; vth = vph = 0; request(); return; }
      let dth = tg.th - cam.th; while (dth > Math.PI) dth -= Math.PI * 2; while (dth < -Math.PI) dth += Math.PI * 2;
      tween = { a: Object.assign({}, cam), b: Object.assign({}, tg, { th: cam.th + dth }), t0: performance.now(), ms }; vth = vph = 0; request();
    }
    const nodePos = i => [L.P[i * 3], L.P[i * 3 + 1], L.P[i * 3 + 2]];
    function focusNode(i) { const p = nodePos(i), d = Math.max(lim().min * 1.6, Math.min(cam.d, home.d * 0.42)); flyTo({ tx: p[0], ty: p[1], tz: p[2], th: cam.th, ph: cam.ph, d }, 900); afterInteract(); }
    /* a group: the camera moves to it (from the home angle), its card lists every item; beside the card on a wide plate,
       under it on a narrow one */
    function flyToCluster(k) {
      const c = L.clusters[k]; if (!c) return;
      gsel = k; sel = -1; hover = -1; showCard(-1); states();
      /* the card on a phone sits at the foot of the plate: the group goes in the room above it */
      const low = !card.hidden && W < 600 && card.offsetTop + card.offsetHeight > H * 0.75, avail = low ? card.offsetTop - padT() - 16 : 0;
      let th = home.th, ph = home.ph;
      if (L.hub && c.dir) { th = Math.atan2(-c.dir[0], -c.dir[2]); ph = 0.62; }   /* from behind the terminal, looking out along the pier */
      if (L.brain && c.nrm) { let dth = Math.atan2(c.nrm[0], c.nrm[2]) - home.th; while (dth > Math.PI) dth -= Math.PI * 2; while (dth < -Math.PI) dth += Math.PI * 2; th = home.th + dth; ph = Math.max(0.55, Math.min(1.05, Math.acos(Math.max(-1, Math.min(1, c.nrm[1] * 0.7 + 0.35))))); }   /* turn the brain towards the region, a little from above */
      const d = L.hub ? Math.max(L.D * 22, c.len * 2.1 + 60) : L.brain ? home.d * 0.68 : Math.max(lim().min * 1.4, fitDist(c.r + L.D * 1.2, c.r + L.D * 1.3, c.r * 0.5, avail));
      const dir = [Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th)], rt = [dir[2], 0, -dir[0]], rl = Math.hypot(rt[0], rt[2]); rt[0] /= rl; rt[2] /= rl;
      const wpp = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / H; let dx = 0, dy = L.D * 0.8 / wpp; /* where the group should appear (px from the middle of the free part); a little low leaves room for its name */
      if (!card.hidden && W >= 600) dx = (card.offsetLeft + card.offsetWidth) / 2;
      if (low) dy += (card.offsetTop - (H - padB())) / 2;
      const up = [dir[1] * rt[2] - dir[2] * rt[1], dir[2] * rt[0] - dir[0] * rt[2], dir[0] * rt[1] - dir[1] * rt[0]];
      const base = L.hub && c.dir ? c.c.map((v, a) => v + c.dir[a] * c.len * 0.2) : c.c;
      const tgt = [0, 1, 2].map(a => base[a] - rt[a] * dx * wpp + up[a] * dy * wpp);
      flyTo({ tx: tgt[0], ty: tgt[1], tz: tgt[2], th, ph, d }, 900);
      afterInteract();
    }
    /* back to the whole cloud */
    function back() { if (ksel) { ksel = null; lit = null; if (o.onKind) o.onKind(null); } gsel = -1; sel = -1; hover = -1; showCard(-1); states(); flyTo(Object.assign({}, home), 800); afterInteract(); }

    /* a type from the sidebar (Documents, Notes …): every item of it lights up, the camera turns to where most of them are,
       and the card lists them, with the way on to that page */
    const KPAGE = { aircraft: '#/aircraft', doc: '#/documents', note: '#/notes', pack: '#/packs', route: '#/routes' };
    function showKind(k) {
      if (!g) return;
      if (!k) { back(); return; }
      const items = []; g.nodes.forEach((n, i) => { if (n.g === k && visible(i) && n.k !== 'page') items.push(i); });
      ksel = k; gsel = -1; sel = -1; hover = -1; lit = new Set(items); showCard(-1); states(); stopRot();
      if (!items.length) { flyTo(Object.assign({}, home), 700); return; }
      let cx = 0, cy = 0, cz = 0; items.forEach(i => { cx += L.P[i * 3]; cy += L.P[i * 3 + 1]; cz += L.P[i * 3 + 2]; }); cx /= items.length; cy /= items.length; cz /= items.length;
      let r = L.D * 2; items.forEach(i => { r = Math.max(r, Math.hypot(L.P[i * 3] - cx, L.P[i * 3 + 1] - cy, L.P[i * 3 + 2] - cz)); });
      /* seen from the home angle, so the brain stays upright and familiar; only the distance and the centre change */
      const th = home.th, ph = home.ph, wide = !card.hidden && W >= 600, d = Math.max(lim().min * 1.4, Math.min(home.d, fitDist(r + L.D * 2, r + L.D * 2, r * 0.5) * (wide ? 1.2 : 1)));
      flyTo({ tx: cx, ty: cy, tz: cz, th, ph, d }, 900); afterInteract();
    }

    /* ---------- frames: only while something moves ---------- */
    function request() { if (!raf && alive) raf = requestAnimationFrame(frame); }
    function frame(ts) {
      raf = 0; if (!alive || !W) return; const c0 = performance.now(); dbg.frames++;
      const raw = lastTs ? ts - lastTs : 16, dt = Math.min(64, raw); lastTs = ts; let more = false, only = true;
      if (introP < 1) { introP = Math.min(1, introP + dt / growMs); const e = introP < 0.5 ? 2 * introP * introP : 1 - Math.pow(-2 * introP + 2, 2) / 2; U.uGrow.value = introP >= 1 ? 2 : e * 1.12; more = true; only = false; if (introP >= 1) { labelSet(); startRot(1200); } }
      if (tween) { only = false; const p = Math.min(1, (ts - tween.t0) / tween.ms), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, a = tween.a, b = tween.b;
        ['tx', 'ty', 'tz', 'th', 'ph'].forEach(k => { cam[k] = a[k] + (b[k] - a[k]) * e; }); cam.d = a.d * Math.pow(b.d / a.d, e); cam.dT = cam.d; if (p >= 1) tween = null; else more = true; }
      if (!interacting && (Math.abs(vth) > 2e-5 || Math.abs(vph) > 2e-5)) { only = false; cam.th += vth; cam.ph = clampPh(cam.ph + vph); vth *= 0.92; vph *= 0.92; more = true; } else if (!interacting) { vth = vph = 0; }
      if (Math.abs(cam.dT - cam.d) > cam.d * 0.001) { only = false; cam.d += (cam.dT - cam.d) * 0.22; more = true; } else cam.d = cam.dT;
      if (rot.on) {
        if (hover >= 0 || sel >= 0 || interacting) { /* paused while you look at something */ }
        else { only = false; rot.t += dt / 1000; const s = rot.secs; cam.th = rot.th0 + 0.2 * Math.sin(Math.PI * 2 * Math.min(1, rot.t / s)); if (rot.t >= s) { cam.th = rot.th0; stopRot(); } else more = true; }
      }
      if (pulses.length) { if (only) { stats.pulseFrames++; } more = stepPulses(ts) || more; }
      if (sweeping() && AP) animAirport(ts);
      if (sweeping()) { U.uSweepOn.value = Math.min(1, U.uSweepOn.value + dt / 800); U.uSweep.value = (U.uSweep.value + dt * Math.PI * 2 / 7000) % (Math.PI * 2); more = true; } else U.uSweepOn.value = 0;
      render();
      const c1 = performance.now(); cpu.push(c1 - c0); if (cpu.length > 400) cpu.shift();
      /* the probe counts only frames drawn back to back while the page is in view (a hidden tab or a pause is not slowness) */
      if (probing && (raw > 400 || document.visibilityState !== 'visible')) { probeD = []; }
      else if (probing) { probeD.push(raw); if (probeD.length >= 24) { probing = false; const a = probeD.slice(4).sort((x, y) => x - y), med = a[a.length >> 1], lim2 = window.__wsm3dProbeMs || 55; const cm = cpu.slice(-20).sort((x, y) => x - y)[10]; if ((med > lim2 || cm > 24) && o.onWeak) { setTimeout(() => o.onWeak('slow'), 0); } } }
      if (more) request(); else lastTs = 0;
    }
    const clampPh = p => L && L.hub ? Math.max(0.15, Math.min(1.3, p)) : L && L.brain ? Math.max(0.18, Math.min(1.72, p)) : Math.max(0.12, Math.min(Math.PI - 0.12, p));   /* the brain: never seen from below the scope */
    /* the radar sweep: one turn every 7 s while the map is on screen and the page is in view; never with reduced motion */
    const sweeping = () => !!(L && (L.brain || L.hub) && alive && onScreen && document.visibilityState === 'visible' && !reduced() && introP >= 1);
    function render() {
      place(); renderer.render(scene, camera); dbg.renders++;
      /* project the nodes once per frame: labels and hit tests use it */
      const hw = W / 2, hh = H / 2, iu = 1;
      for (let i = 0; i < N; i++) { v3.set(L.P[i * 3] * iu, L.P[i * 3 + 1] * iu, L.P[i * 3 + 2] * iu).applyMatrix4(camera.matrixWorldInverse); scr.d[i] = -v3.z; v3.applyMatrix4(camera.projectionMatrix); scr.x[i] = (v3.x + 1) * hw; scr.y[i] = (1 - v3.y) * hh; }
      scr.ok = true;
      const pr = (p, o2) => { v3.set(p[0] * iu, p[1] * iu, p[2] * iu).project(camera); return v3.z < 1 ? [(v3.x + 1) * hw + (o2 || 0), (1 - v3.y) * hh] : null; };
      const op = introP >= 1 ? 1 : Math.max(0, Math.min(1, (introP - 0.55) / 0.45));
      const boxes = [], hits = (x, y, w, h) => boxes.some(b => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y);
      /* group names: above the group, else below, else nudged sideways; never over a point or another name, never off
         the plate (hidden until there is room, as when the cloud is turned edge-on) */
      const dots = []; for (let i = 0; i < N; i++) if (visible(i) && scr.d[i] > 0) { const r = pxSize(i) * 0.22 + 2; dots.push(scr.x[i] - r, scr.y[i] - r, scr.x[i] + r, scr.y[i] + r); }
      const onDot = (x0, y0, x1, y1) => { for (let k = 0; k < dots.length; k += 4) if (x0 < dots[k + 2] && x1 > dots[k] && y0 < dots[k + 3] && y1 > dots[k + 1]) return true; return false; };
      const yTop = W < 600 ? 92 : 54, yBot = H - padB() + 6;
      { const pl = host.closest('.wsm-plate') || host, cr = cv.getBoundingClientRect(); pl.querySelectorAll('.wsm-tag, .wsm-cta, .wsm-card').forEach(e => { if (e.hidden) return; const r = e.getBoundingClientRect(); if (r.width) boxes.push({ x: r.left - cr.left - 4, y: r.top - cr.top - 4, w: r.width + 8, h: r.height + 8 }); }); }
      dbg.groupLabels = [];
      L.clusters.map((c, k) => k).sort((a, b) => (a === gsel ? -1 : b === gsel ? 1 : 0) || L.clusters[b].m.length - L.clusters[a].m.length).forEach(k => {
        const c = L.clusters[k], el = regEls[k]; if (!el) return;
        if (c.m.length && !c.m.some(i => visible(i))) { el.hidden = true; return; }
        el.hidden = false; const w = el._w || (el._w = el.offsetWidth), h = el._h || (el._h = el.offsetHeight);
        const an = c.tip || c.c, rr = c.tip ? L.D * 1.6 : c.r, pa = pr([an[0], an[1] + rr + L.D * 0.4, an[2]]), pb = pr([an[0], an[1] - (c.tip ? 0 : rr) - L.D * 0.4, an[2]]), cand = [];
        for (const [p, above] of [[pa, true], [pb, false]]) if (p) for (const dx of [0, -0.6, 0.6, -1.1, 1.1]) cand.push([p[0] + dx * w, above ? p[1] - 4 - h : p[1] + 4]);
        let at = null;
        for (const [x, y] of cand) { const x0 = Math.max(6, Math.min(W - 6 - w, x - w / 2)); if (y < yTop || y + h > yBot || hits(x0 - 3, y - 3, w + 6, h + 6) || onDot(x0, y, x0 + w, y + h)) continue; at = [x0, y]; break; }
        if (!at) { el.hidden = true; return; }
        boxes.push({ x: at[0], y: at[1], w, h });
        el.style.transform = `translate(${at[0].toFixed(1)}px,${at[1].toFixed(1)}px)`;
        let face = 1; if (L.brain && c.nrm) { const cp = camera.position, vx = cp.x - c.c[0], vy = cp.y - c.c[1], vz = cp.z - c.c[2], vl = Math.hypot(vx, vy, vz) || 1; const dd = (c.nrm[0] * vx + c.nrm[1] * vy + c.nrm[2] * vz) / vl; face = dd < -0.15 ? 0.38 : 1; el.classList.toggle('back', face < 1); }
        el.style.opacity = (op * face).toFixed(2);
        dbg.groupLabels.push({ name: names2[k], text: el.textContent.replace(/ /g, ' '), x0: at[0], y0: at[1], x1: at[0] + w, y1: at[1] + h });
      });
      const focus = hover >= 0 ? hover : sel;
      /* the focused node's label always shows; a neighbour's goes right of its dot, else left, else waits (no overlaps) */
      shownLbl.forEach((i, k) => {
        const s = nodeEls[k]; if (!s || scr.d[i] <= 0) { if (s) s.hidden = true; return; }
        s.hidden = false; const w = s._w || (s._w = s.offsetWidth), r = pxSize(i) * 0.22 + 5, y = scr.y[i] - 9;
        /* right of the point, else left, else above or below it */
        let x = scr.x[i] + r, yy = y;
        const busy = (cx, cy) => hits(cx, cy, w, 18) || onDot(cx, cy + 2, cx + w, cy + 16);
        if (i !== focus && busy(x, y)) {
          const c = [[scr.x[i] - r - w, y], [scr.x[i] - w / 2, y - r - 12], [scr.x[i] - w / 2, y + r + 12]].find(([cx, cy]) => !busy(cx, cy));
          if (!c) { s.hidden = true; return; } x = c[0]; yy = c[1];
        }
        boxes.push({ x: x - 2, y: yy - 1, w: w + 4, h: 20 });
        s.style.transform = `translate(${x.toFixed(1)}px,${yy.toFixed(1)}px)`; s.style.opacity = i === focus || (gsel >= 0 && L.gi[i] === gsel) ? '1' : (0.85 * (1 - 0.5 * smooth(U.uNear.value, U.uFar.value, scr.d[i]))).toFixed(2);
      });
    }
    const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
    const pxSize = i => Math.min(110, Math.max(2, (nodes.geometry.attributes.size.array[i] * U.uScale.value / Math.max(0.1, scr.d[i])) / dpr));

    /* ---------- a slow sway (a little to one side, then the other, back where it began): about 20 s after opening and after you stop, then still ---------- */
    function startRot(delay) {
      if (reduced() || !alive) return; clearTimeout(rot.timer);
      rot.timer = setTimeout(() => { rot.timer = 0; if (!alive || interacting || tween) return; rot.on = true; rot.t = 0; rot.th0 = cam.th; request(); }, delay || 0);
    }
    function stopRot() { clearTimeout(rot.timer); rot.timer = 0; rot.on = false; }
    function afterInteract() { if (introP >= 1) startRot(5000); }

    /* ---------- pulses: a faint light travels along a real link ---------- */
    function stepPulses(now) {
      now = performance.now(); pulses = pulses.filter(p => now < p.t0 + p.dur);
      const geo = pulsePts.geometry, pa = geo.attributes.position.array, sa = geo.attributes.size.array, aa = geo.attributes.alpha.array; aa.fill(0);
      let k = 0;
      for (const p of pulses) {
        if (k > 30) break; const e = (now - p.t0) / p.dur; if (e < 0) { k += 6; continue; }
        const l = g.links[p.l]; if (!visible(l.s) || !visible(l.t)) { k += 6; continue; }
        const u = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2, A = Math.sin(Math.PI * Math.min(1, e)) * p.s;
        for (let j = 0; j < 6; j++) { const q = Math.max(0, u - j * 0.045), qq = p.rev ? 1 - q : q, f = qq * SEG, s0 = Math.min(SEG - 1, Math.floor(f)), r = f - s0, b = (p.l * (SEG + 1) + s0) * 3;
          for (let c = 0; c < 3; c++) pa[k * 3 + c] = curves[b + c] + (curves[b + 3 + c] - curves[b + c]) * r;
          sa[k] = (j ? 1.6 - j * 0.18 : 2.4); aa[k] = A * (j ? 0.5 * (1 - j / 6) : 1); k++; }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.size.needsUpdate = true; geo.attributes.alpha.needsUpdate = true;
      pulsePts.visible = pulses.length > 0; dbg.pulseCount = pulses.length;
      return pulses.length > 0;
    }
    const canPulse = () => alive && onScreen && introP >= 1 && !reduced() && g.links.length && document.visibilityState === 'visible';
    function burst(i) {
      if (reduced() || i < 0) return; const now = performance.now(); let n = 0;
      g.links.forEach((l, k) => { if (n >= 6 || (l.s !== i && l.t !== i) || !visible(l.s) || !visible(l.t)) return; pulses.push({ l: k, rev: l.t === i, t0: now + n * 90, dur: 620, s: 0.9 }); n++; });
      request();
    }
    function ambient() {
      ambT = 0; if (!canPulse()) return;
      const ls = g.links.map((l, k) => k).filter(k => visible(g.links[k].s) && visible(g.links[k].t)); if (!ls.length) return;
      const k = ls[Math.floor(Math.random() * ls.length)]; pulses.push({ l: k, rev: Math.random() < 0.5, t0: performance.now(), dur: 1300 + Math.random() * 300, s: 0.6 });
      request(); schedule();
    }
    function schedule() { if (ambT || !canPulse()) return; ambT = setTimeout(ambient, 14000 + Math.random() * 12000); }
    function unschedule() { if (ambT) clearTimeout(ambT); ambT = 0; }
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) { schedule(); request(); } else unschedule(); }) : null;
    if (io) io.observe(host);
    const onVis = () => { if (document.visibilityState === 'visible') { schedule(); request(); } else unschedule(); };
    document.addEventListener('visibilitychange', onVis);

    function resize() {
      const r = cv.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height); if (!w || !h) return;
      host.classList.toggle('narrow', w < 880);   /* a narrow plate leaves the colour choice out of the toolbar, so the rest fits on one row */
      dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      if (w === W && h === H && renderer.getPixelRatio() === dpr) return;
      const first = !W, wasHome = !first && Math.abs(cam.d - home.d) / home.d < 0.01;
      W = w; H = h; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
      camera.aspect = w / h; const off = (padB() - padT()) / 2; camera.setViewOffset(w, h, 0, off, w, h); camera.updateProjectionMatrix();
      homeView(); if (first || wasHome) { Object.assign(cam, home); cam.dT = cam.d; }
      request();
    }

    /* ---------- pointer: turn, pinch, wheel, hover, click, double-click ---------- */
    function hit(x, y) {
      if (!scr.ok) return -1; let best = -1, bs = Infinity;
      for (let i = 0; i < N; i++) { if (!visible(i) || scr.d[i] <= 0) continue; const dx = scr.x[i] - x, dy = scr.y[i] - y, d = dx * dx + dy * dy, r = Math.max(coarse ? 16 : 10, pxSize(i) * 0.3); if (d < r * r) { const s = d + scr.d[i] * 0.02; if (s < bs) { bs = s; best = i; } } }
      return best;
    }
    const pts = new Map(); let pinch = null, moved = 0, downAt = null, lastTap = { i: -2, t: 0 };
    const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function down(e) {
      cv.setPointerCapture(e.pointerId); const p = local(e); pts.set(e.pointerId, p); moved = 0; tween = null; stopRot(); vth = vph = 0; interacting = true;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; downAt = null; return; }
      downAt = { x: p[0], y: p[1], lx: p[0], ly: p[1], t: performance.now() };
    }
    function move(e) {
      const p = local(e);
      if (pts.has(e.pointerId)) pts.set(e.pointerId, p);
      if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomBy((pinch.d || d) / d); pinch.d = d; moved = 99; return; }
      if (downAt) {
        moved = Math.max(moved, Math.hypot(p[0] - downAt.x, p[1] - downAt.y)); if (moved < 4) return;
        const dx = p[0] - downAt.lx, dy = p[1] - downAt.ly; downAt.lx = p[0]; downAt.ly = p[1];
        const k = 2.6 / Math.max(300, Math.min(W, H)); vth = -dx * k; vph = -dy * k; cam.th += vth; cam.ph = clampPh(cam.ph + vph);
        cv.style.cursor = 'grabbing'; if (hover >= 0) { const was = hover; hover = -1; if (isEx(was)) showCard(sel); states(); } request(); return;
      }
      if (e.pointerType === 'touch') return;
      const i = hit(p[0], p[1]); if (i !== hover) { const was = hover; hover = i; cv.style.cursor = i >= 0 ? 'pointer' : ''; if (i >= 0 && (isEx(i) || sel < 0)) { showCard(i); if (isEx(i)) burst(i); } else if (i < 0 && was >= 0) showCard(sel); states(); if (i < 0 && rot.on) request(); }
    }
    function up(e) {
      pts.delete(e.pointerId); if (pinch) { if (pts.size < 2) pinch = null; if (!pts.size) { interacting = false; afterInteract(); } downAt = null; return; }
      const d = downAt; downAt = null; interacting = pts.size > 0; cv.style.cursor = hover >= 0 ? 'pointer' : '';
      if (!d) return;
      if (moved >= 4) { request(); afterInteract(); return; }
      vth = vph = 0;
      const [x, y] = local(e), i = hit(x, y), now = performance.now();
      if (i >= 0 && lastTap.i === i && now - lastTap.t < 380) { lastTap = { i: -2, t: 0 }; focusNode(i); return; }
      if (i < 0 && lastTap.i === -1 && now - lastTap.t < 380) { lastTap = { i: -2, t: 0 }; zoomBy(0.6); return; }
      lastTap = { i, t: now };
      if (i >= 0 && !isEx(i) && (e.shiftKey || e.altKey)) { open(i, true); return; }
      if (i >= 0) select(i); else if (gsel >= 0) { back(); return; } else if (sel >= 0) select(-1);
      afterInteract();
    }
    function zoomBy(f) { const l = lim(); cam.dT = Math.max(l.min, Math.min(l.max, (cam.dT || cam.d) * f)); stopRot(); request(); }
    let wheelT = 0;
    function wheel(e) { e.preventDefault(); const k = e.deltaMode === 1 ? 30 : 1; zoomBy(Math.exp(e.deltaY * k * (e.ctrlKey ? 0.01 : 0.0012))); clearTimeout(wheelT); wheelT = setTimeout(afterInteract, 200); }
    function leave() { if (hover >= 0 && !downAt) { const was = hover; hover = -1; if (was >= 0) showCard(sel); states(); } }
    function open(i, beside) { const n = g.nodes[i]; if (!n) return; if (isEx(i)) { select(i); return; } if (o.onOpen) o.onOpen(n, !!beside); }
    /* the card: a point (shared with the 2D map), or the focused group's list */
    /* the card moves to the right side when it would cover the dot it describes (so the pointer never lands on the card) */
    function aside(i) { if (host.clientWidth < 700) return; const [px, py] = [scr.ok ? scr.x[i] : -1, scr.ok ? scr.y[i] : -1]; if (px < 0) return; const m = 16; if (px < card.offsetLeft + card.offsetWidth + m && py < card.offsetTop + card.offsetHeight + m && px > card.offsetLeft - m && py > card.offsetTop - m) card.classList.add('r'); }
    function showCard(i) {
      if (i >= 0) { card.classList.remove('r', 'grp'); card.hidden = false; card.innerHTML = UI.cardHTML(g, i, { t, sample: isEx(i), pinned: i === sel, coarse, col: pcol(), edit: !sample && !!o.onEdit }) + (gsel >= 0 || ksel ? `<span class="bk"><button type="button" class="lnk" data-gl>${esc('← ' + (ksel ? GN[ksel] : names2[gsel]))}</button></span>` : ''); aside(i); return; }
      card.classList.remove('r');
      if (ksel) { const items = lit ? [...lit] : [], pg = KPAGE[ksel];
        card.hidden = false; card.classList.add('grp'); card.innerHTML = UI.groupCardHTML(g, items, { t, sample, edit: false, col: pcol(), name: GN[ksel], sub: items.length ? t('Lit up on the map. Pick one to open it.', 'Lyser på kartet. Velg én for å åpne den.') : t('None yet.', 'Ingen ennå.') }) +
          (pg && !sample ? `<span class="b"><a class="btn sm" href="${pg}">${esc(t('All ', 'Alle ') + GN[ksel].toLowerCase() + ' →')}</a></span>` : ''); return; }
      if (gsel >= 0) { const c = L.clusters[gsel], a = c.ac >= 0 ? g.nodes[c.ac] : null; card.hidden = false; card.classList.add('grp'); card.innerHTML = UI.groupCardHTML(g, c.m.filter(visible), { t, sample, edit: !sample && !!o.onEdit, topic: c.topic, col: pcol(), name: names2[gsel], sub: a && names2[gsel].indexOf(a.label) < 0 ? a.label + (a.type ? ' · ' + a.type : '') : '' }); return; }
      card.hidden = true;
    }
    function select(i, fly) {
      const was = sel; sel = i; showCard(i >= 0 ? i : hover);
      if (isEx(i) && i !== was && i !== hover) burst(i);
      if (i >= 0) stopRot();
      states(); if (i >= 0 && fly) focusNode(i);
    }
    card.addEventListener('click', e => {
      if (UI.cardAct(e, o, sel >= 0 ? g.nodes[sel] : null, gsel >= 0 ? L.clusters[gsel] : null, g)) return;
      const b = e.target.closest('[data-o]'); if (b && sel >= 0) { open(sel, b.dataset.o === 'beside'); return; }
      const li = e.target.closest('[data-i]'); if (li) { hover = -1; select(+li.dataset.i); return; }
      if (e.target.closest('[data-back]')) { back(); return; }
      if (e.target.closest('[data-gl]')) { sel = -1; showCard(-1); states(); }
    });
    card.addEventListener('mouseover', e => { if (gsel < 0 && !ksel) return; const li = e.target.closest('[data-i]'), i = li ? +li.dataset.i : -1; if (i !== hover) { hover = i; states(); } });
    card.addEventListener('mouseleave', () => { if ((gsel >= 0 || ksel) && hover >= 0) { hover = -1; states(); } });
    function key(e) {
      if (e.target !== cv) return; const a = 0.14;
      if (e.key === '+' || e.key === '=') zoomBy(0.8); else if (e.key === '-' || e.key === '_') zoomBy(1.25);
      else if (e.key === '0' || e.key === 'Home') flyTo(Object.assign({}, home), 700);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { stopRot(); cam.th += e.key === 'ArrowLeft' ? -a : a; request(); afterInteract(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { stopRot(); cam.ph = clampPh(cam.ph + (e.key === 'ArrowUp' ? -a : a)); request(); afterInteract(); }
      else if (e.key === 'Enter' && sel >= 0) open(sel, e.shiftKey || e.altKey);
      else if (e.key === 'Escape' && (sel >= 0 || gsel >= 0)) { if (sel >= 0) select(-1); else back(); }
      else return;
      e.preventDefault();
    }
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', leave);
    cv.addEventListener('wheel', wheel, { passive: false }); cv.addEventListener('keydown', key);
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); if (alive && o.onWeak) o.onWeak('lost'); });

    /* ---------- toolbar, legend, search ---------- */
    host.querySelector('.wsm-zm').addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (!b) return; if (b.dataset.z === 'fit') back(); else { zoomBy(b.dataset.z === 'in' ? 0.72 : 1.39); afterInteract(); } });
    const vw = host.querySelector('.wsm-vw'); if (vw) vw.addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b && b.dataset.view !== o.view.cur) o.view.onSwitch(b.dataset.view); });
    const pb = host.querySelector('.wsm-pal'); pb.addEventListener('click', e => { const b = e.target.closest('[data-pal]'); if (!b) return; pal = b.dataset.pal; try { localStorage.setItem('bb-map-palette', pal); } catch (er) {} paint(); drawLegend(); if (!card.hidden) showCard(sel >= 0 ? sel : hover); request(); });
    legEl.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; const k = b.dataset.g; if (hidden.has(k)) hidden.delete(k); else hidden.add(k); if (sel >= 0 && !visible(sel)) select(-1); hover = -1; drawLegend(); const nb2 = legEl.querySelector(`[data-g="${k}"]`); if (nb2) nb2.focus(); states(); });
    let rows = [], cur = 0;
    /* every point whose name matches lights up (the list shows the best few) */
    const allMatches = q => { const f = UI.fold(q), tk = f.split(/\s+/).filter(Boolean), m = new Set(); g.nodes.forEach((n, i) => { if (visible(i) && tk.every(x => UI.fold(n.label + (n.type ? ' ' + n.type : '')).includes(x))) m.add(i); }); return m; };
    const drawSug = () => {
      const q = qi.value.trim(); rows = UI.searchRows(g, q, visible); cur = 0;
      lit = q ? allMatches(q) : null; states();
      sug.hidden = !rows.length && !q; qi.setAttribute('aria-expanded', String(!sug.hidden));
      sug.innerHTML = rows.length ? rows.map((i, k) => `<li role="option" id="wsm3o${k}" data-i="${i}" aria-selected="${k === cur}"><i style="background:${pcol()[g.nodes[i].k]}"></i><span>${esc(g.nodes[i].label)}</span><small>${esc(KN[g.nodes[i].k])}</small></li>`).join('') : `<li class="none">${esc(t('Nothing on the map matches.', 'Ingenting på kartet passer.'))}</li>`;
      if (rows.length) qi.setAttribute('aria-activedescendant', 'wsm3o0'); else qi.removeAttribute('aria-activedescendant');
    };
    const mark = () => sug.querySelectorAll('[role="option"]').forEach((li, k) => { li.setAttribute('aria-selected', String(k === cur)); if (k === cur) qi.setAttribute('aria-activedescendant', li.id); });
    const pickRow = k => { const i = rows[k]; if (i == null) return; sug.hidden = true; qi.setAttribute('aria-expanded', 'false'); hover = -1; gsel = -1; select(i, true); };
    qi.addEventListener('input', drawSug);
    qi.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!rows.length) return; e.preventDefault(); cur = (cur + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length; mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (!sug.hidden && rows.length) pickRow(cur); else if (sel >= 0) open(sel, e.shiftKey || e.altKey); }
      else if (e.key === 'Escape') { if (!sug.hidden) { sug.hidden = true; qi.setAttribute('aria-expanded', 'false'); } else { qi.value = ''; lit = null; select(-1); } e.preventDefault(); e.stopPropagation(); }
    });
    qi.addEventListener('blur', () => setTimeout(() => { if (alive) { sug.hidden = true; qi.setAttribute('aria-expanded', 'false'); } }, 150));
    sug.addEventListener('mousedown', e => e.preventDefault());
    sug.addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) pickRow(rows.indexOf(+li.dataset.i)); });

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (alive) resize(); }) : null;
    if (ro) ro.observe(cv); else window.addEventListener('resize', resize);
    setGraph(o.graph); resize();
    if (introP >= 1) { render(); }
    return (host.wsmap = {
      is3d: true, setGraph: ng => setGraph(ng, true), fit: () => flyTo(Object.assign({}, home), 700), focus: i => select(i, true), flyToCluster, showKind, get kind() { return ksel; }, focusKey: key => { const k = L.clusters.findIndex(c => c.key === key); if (k >= 0) flyToCluster(k); }, debug: dbg,
      pulseNow: () => { unschedule(); ambient(); }, stopAutoRotate: () => { stopRot(); },
      get graph() { return g; }, get camera() { return Object.assign({}, cam); }, get home() { return Object.assign({}, home); }, get layout() { return L; },
      screenOf: i => { if (!scr.ok) render(); return [scr.x[i], scr.y[i]]; },
      destroy() {
        alive = false; if (raf) cancelAnimationFrame(raf); raf = 0; stopRot(); unschedule(); clearTimeout(wheelT); if (io) io.disconnect(); document.removeEventListener('visibilitychange', onVis);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        disposeObjs(); [nodeMat, puffMat, lineMat, pulseMat, brainMat, symMat, scopeMat, bldMat, grdMat, lgtMat, standMat, outlineMat].forEach(m => m.dispose()); scopeTx.dispose(); renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
        host.innerHTML = ''; host.classList.remove('wsm3'); host.wsmap = null;
      }
    });
  }
  window.WSMAP3D = { mount, supported, stats };
})();
