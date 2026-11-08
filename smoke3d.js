/* Virtual Lab – røyktunnel med partikler (three.js r128)
   Kontinuerlig røyk fra dysene i en røykrake. Hver partikkel føres med lokal hastighet fra det forhåndsberegnede
   3D-rutenettet (trilineært, blandet for gjeldende α – ingen virvelgitterberegning per partikkel), tippvirvelens
   Lamb–Oseen-kjerne og nærfeltet ved vingen (samme funksjoner som strømlinjene i flow3d.js). Midtpunktmetoden
   (RK2) med delsteg der farten endrer seg raskt (virvelkjernen, nesen). Bak separasjonslinjen (stallmarginen per
   stripe i physics.js → sepFrac) blir røyken turbulent: tilfeldig gange og koherente virvler som vokser,
   hastighetsunderskudd i kjølvannet og resirkulasjon i den døde sonen over vingen.
   Tegning: hver dyse eier en ring av partikler; nabopartikler fra samme dyse bindes sammen til myke,
   kamerarettede bånd (sammenhengende filamenter), og turbulente partikler tegnes i tillegg som myke skyer.
   Bredden vokser og tettheten avtar nedstrøms, båndene skyggelegges som rør av nøkkellyset, og et valgfritt
   laserark lar bare røyken inne i arket lyse. Posisjonene ligger i typede tabeller (vingeramme) og skrives til
   GPU-bufferne hvert bilde (simulering og opplasting adskilt). */
(function (root) {
  'use strict';
  const DEG = Math.PI / 180;

  function make(THREE, FL, o) {
    o = o || {};
    const MAX = o.max || 12000;
    let cap = Math.min(MAX, o.cap || 8000);
    const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
    const age = new Float32Array(MAX), tb = new Float32Array(MAX), sd = new Float32Array(MAX), alive = new Uint8Array(MAX);
    const vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);

    /* ---- felles uniformer ---- */
    const U = {
      size0: { value: 0.035 }, grow: { value: 2.2 }, pxScale: { value: 1000 }, maxPx: { value: 110 }, opac: { value: 0.62 },
      tint: { value: new THREE.Color(0.93, 0.95, 0.98) }, Lw: { value: new THREE.Vector3(-0.3, 0.9, 0.3).normalize() },
      laserOn: { value: 0 }, laserN: { value: new THREE.Vector3(1, 0, 0) }, laserD: { value: 0 }, laserTh: { value: 0.07 }, laserCol: { value: new THREE.Color(0.45, 1.0, 0.55) }, laserDim: { value: 0.05 },
      bright: { value: 1 }, minPx: { value: 1.6 }, sheetPuff: { value: 0 }
    };
    const blend = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };
    const COMMON = `
      uniform float size0; uniform float grow; uniform float pxScale; uniform float opac;
      uniform float laserOn; uniform vec3 laserN; uniform float laserD; uniform float laserTh; uniform float laserDim; uniform vec3 Lw;
      float widthOf(float ag, float t){ return size0*(1.0+grow*ag)*(1.0+3.0*t); }
      float laserIn(vec3 wp){ float dd=dot(laserN,wp)-laserD; return laserOn>0.5? exp(-dd*dd/(laserTh*laserTh)) : 0.0; }
      float fades(float ag){ return smoothstep(0.0,0.02,ag)*(1.0-smoothstep(0.72,1.0,ag)); }`;
    const FRAG_COL = `
      uniform vec3 tint; uniform vec3 laserCol; uniform float laserOn; uniform float bright;
      vec3 smokeCol(float sh, float vIn){ vec3 c=tint*sh*bright; return laserOn>0.5? mix(c*0.55,laserCol*1.25,vIn) : c; }`;

    /* ---- bånd: fire hjørner per lenke (partikkel → eldre nabo i samme dyse) ---- */
    const rPos = new Float32Array(MAX * 4 * 3), rOth = new Float32Array(MAX * 4 * 3), rAge = new Float32Array(MAX * 4), rTb = new Float32Array(MAX * 4), rA = new Float32Array(MAX * 4), rSide = new Float32Array(MAX * 4);
    const rIdx = new Uint32Array(MAX * 6);
    for (let i = 0; i < MAX; i++) {
      for (let c = 0; c < 4; c++) rSide[4 * i + c] = (c & 1) ? 1 : -1;
      const b = 4 * i; rIdx.set([b, b + 2, b + 1, b + 1, b + 2, b + 3], 6 * i);
    }
    const rGeo = new THREE.BufferGeometry();
    const ra = { pos: new THREE.BufferAttribute(rPos, 3), oth: new THREE.BufferAttribute(rOth, 3), age: new THREE.BufferAttribute(rAge, 1), tb: new THREE.BufferAttribute(rTb, 1), a: new THREE.BufferAttribute(rA, 1) };
    for (const k in ra) ra[k].setUsage(THREE.DynamicDrawUsage);
    rGeo.setAttribute('position', ra.pos); rGeo.setAttribute('aOther', ra.oth); rGeo.setAttribute('aAge', ra.age); rGeo.setAttribute('aTb', ra.tb); rGeo.setAttribute('aA', ra.a);
    rGeo.setAttribute('aSide', new THREE.BufferAttribute(rSide, 1)); rGeo.setIndex(new THREE.BufferAttribute(rIdx, 1)); rGeo.setDrawRange(0, 0);
    const rMat = new THREE.ShaderMaterial(Object.assign({
      uniforms: U,
      vertexShader: COMMON + `
        attribute vec3 aOther; attribute float aSide; attribute float aAge; attribute float aTb; attribute float aA; uniform float minPx;
        varying float vS; varying float vA; varying float vIn; varying vec3 vSd; varying vec3 vN;
        void main(){
          vec4 wp=modelMatrix*vec4(position,1.0), wo=modelMatrix*vec4(aOther,1.0);
          vec4 mv=viewMatrix*wp, mo=viewMatrix*wo;
          vec3 t=mo.xyz-mv.xyz; vec3 s=cross(t,mv.xyz); float L=length(s);
          float sn=L/max(1e-9,length(t)*length(mv.xyz));            // sin(vinkel mellom tangent og synslinje)
          s= L>1e-9? s/L : vec3(0.0,1.0,0.0);
          float tbv=clamp(aTb,0.0,1.0), w=widthOf(aAge,tbv);
          float wpx=w*pxScale/max(0.2,-mv.z), k=max(1.0,minPx/max(wpx,1e-4));   // minst ~1,6 px bred, tynnere → svakere
          mv.xyz+=s*aSide*w*k;
          vIn=laserIn(wp.xyz); vS=aSide;
          float a=opac*aA*fades(aAge)*pow(size0/w,0.85)/k*(1.0-smoothstep(0.15,0.55,tbv))*smoothstep(0.04,0.22,sn);   // sett på langs: tones ut (ingen pigger)
          vA= laserOn>0.5? a*mix(laserDim,1.15,vIn) : a;
          vSd=s; vN=normalize(-mv.xyz);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: FRAG_COL + `
        varying float vS; varying float vA; varying float vIn; varying vec3 vSd; varying vec3 vN; uniform vec3 Lw;
        void main(){
          float s=vS, prof=exp(-2.6*s*s)*(1.0-smoothstep(0.8,1.0,abs(s)));
          vec3 n=normalize(vSd*s+vN*sqrt(max(0.0,1.0-s*s)));
          vec3 L=normalize((viewMatrix*vec4(Lw,0.0)).xyz);
          float sh=0.6+0.34*max(dot(n,L),0.0)+0.16*pow(max(0.0,-L.z),3.0);
          float a=clamp(vA*prof,0.0,1.0);
          gl_FragColor=vec4(smokeCol(sh,vIn)*a,a);
        }`,
      side: THREE.DoubleSide
    }, blend));
    const ribbons = new THREE.Mesh(rGeo, rMat); ribbons.frustumCulled = false; ribbons.renderOrder = 6;

    /* ---- skyer: én myk sprite per partikkel, synlig der røyken er turbulent (pluss en svak glorie rundt filamentene) ---- */
    const gPos = new Float32Array(MAX * 3), gAge = new Float32Array(MAX), gTb = new Float32Array(MAX), gSd = new Float32Array(MAX);
    const pGeo = new THREE.BufferGeometry();
    const pa = { pos: new THREE.BufferAttribute(gPos, 3), age: new THREE.BufferAttribute(gAge, 1), tb: new THREE.BufferAttribute(gTb, 1), sd: new THREE.BufferAttribute(gSd, 1) };
    for (const k in pa) pa[k].setUsage(THREE.DynamicDrawUsage);
    pGeo.setAttribute('position', pa.pos); pGeo.setAttribute('aAge', pa.age); pGeo.setAttribute('aTb', pa.tb); pGeo.setAttribute('aSeed', pa.sd); pGeo.setDrawRange(0, 0);
    gAge.fill(2);
    const pMat = new THREE.ShaderMaterial(Object.assign({
      uniforms: U,
      vertexShader: COMMON + `
        attribute float aAge; attribute float aTb; attribute float aSeed; uniform float maxPx; uniform float sheetPuff;
        varying float vA; varying float vIn; varying float vSeed;
        void main(){
          float tbv=clamp(aTb,0.0,1.0);
          vec4 wp=modelMatrix*vec4(position,1.0);
          vIn=laserIn(wp.xyz)*sheetPuff;
          // bare turbulent røyk – og i laserarket all røyk (lyset sprer seg i røykskyen rundt filamentet)
          if(aAge>1.5||(tbv<0.04&&vIn<0.05)){ gl_Position=vec4(2.0,2.0,2.0,1.0); gl_PointSize=0.0; vA=0.0; return; }
          vec4 mv=viewMatrix*wp;
          float w=widthOf(aAge,tbv)*(1.6+1.2*tbv);
          float ps=w*pxScale/max(0.2,-mv.z), k=min(1.0,maxPx/max(ps,1e-3));
          gl_PointSize=min(ps,maxPx);
          float turb=max(smoothstep(0.08,0.4,tbv), 0.45*vIn);
          float a=opac*fades(aAge)*0.55*turb*pow(size0/w,0.8)*k*k*(0.7+0.6*fract(aSeed*7.31));
          float li=laserIn(wp.xyz); vA= laserOn>0.5? a*mix(laserDim,1.5,li) : a; vIn=li; vSeed=aSeed;
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: FRAG_COL + `
        varying float vA; varying float vIn; varying float vSeed; uniform vec3 Lw;
        void main(){
          vec2 c=gl_PointCoord*2.0-1.0; c.y=-c.y; float r2=dot(c,c); if(r2>1.0) discard;
          // ujevn sky: litt vinkelavhengig tetthet så skyene ikke ser ut som perfekte kuler
          float ang=atan(c.y,c.x), lump=1.0+0.22*sin(ang*3.0+vSeed*40.0)+0.12*sin(ang*5.0-vSeed*17.0);
          float prof=exp(-2.4*r2*lump)*(1.0-smoothstep(0.75,1.0,r2));
          vec3 n=vec3(c,sqrt(1.0-r2)); vec3 L=normalize((viewMatrix*vec4(Lw,0.0)).xyz);
          float sh=0.55+0.4*max(dot(n,L),0.0);
          float a=clamp(vA*prof,0.0,1.0);
          gl_FragColor=vec4(smokeCol(sh,vIn)*a,a);
        }`
    }, blend));
    const puffs = new THREE.Points(pGeo, pMat); puffs.frustumCulled = false; puffs.renderOrder = 7;
    const group = new THREE.Group(); group.add(ribbons); group.add(puffs);

    /* ---- dyser: hver dyse eier en ring av «per» plasser ---- */
    let E = null, nE = 0, acc = null, rn = null, per = 1, ds = 0.1, life = 6, ready = false, Tsim = 0;
    const S = { U: o.speed || 5.5, ex: 1, jitter: 0.012, travel: 27, planar: null };
    /* keep: samme rake (bare α er endret) – behold partiklene og flytt bare dysene */
    function setEmitters(seeds, opt, keep) {
      opt = opt || {};
      const n = seeds.length / 3; keep = keep && n === nE;
      E = Float32Array.from(seeds); S.ex = opt.ex || 1; S.jitter = opt.jitter || 0.012; S.planar = opt.planar == null ? null : opt.planar;
      if (keep) return;
      nE = n; acc = new Float32Array(nE); rn = new Uint32Array(nE);
      for (let i = 0; i < nE; i++) acc[i] = Math.random();
      layout(opt.travel || 30);
      clear(); ready = nE > 0;
    }
    /* avstand mellom partikler langs et filament ut fra budsjettet (cap fordelt på dysene over strekningen) */
    function layout(travel) {
      S.travel = travel;
      per = Math.max(8, Math.floor(cap / Math.max(1, nE)));
      ds = Math.max(0.03, travel / per);
      life = per * ds;
      U.size0.value = Math.max(0.036, Math.min(0.055, 0.3 * ds));
      if (rn) for (let e = 0; e < nE; e++) rn[e] %= per;
    }
    function used() { return Math.min(MAX, per * nE); }
    function clear() { alive.fill(0); gAge.fill(2); rA.fill(0); pa.age.needsUpdate = true; ra.a.needsUpdate = true; if (rn) rn.fill(0); Tsim = 0; draw(); }
    function draw() { const n = nE ? used() : 0; pGeo.setDrawRange(0, n); rGeo.setDrawRange(0, n * 6); }
    function setCap(n) { n = Math.max(1000, Math.min(MAX, n | 0)); if (n === cap) return; cap = n; if (nE) { layout(S.travel); clear(); } }
    /* modellen er dreid fra a0 til a1 (rad) om P0: behold partiklenes posisjon i vindrammen */
    function rebase(a0, a1, P0x, P0y) {
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1), n = used();
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const dx = px[i] - P0x, dz = pz[i] - P0y, X = dx * c0 + dz * s0, Y = -dx * s0 + dz * c0;
        px[i] = P0x + X * c1 - Y * s1; pz[i] = P0y + X * s1 + Y * c1;
      }
    }

    /* ---- hastighet: fri strøm + forstyrrelse (blandet rutenett) + virvelkjerne + nærfelt ved vingen ---- */
    const f = [0, 0, 0], k1 = [0, 0, 0], k2 = [0, 0, 0];
    let ca = 1, sa = 0, ex = 1, s = 5, bx0 = -10, bx1 = 10, bz0 = -1, bz1 = 1;
    /* Luften nær virvelkjernen følger kjernen. Kjernebanen (Betz-oppvikling, samme som i flow3d.js) går innover og
       nedover raskere enn det utglattede rutenettet fører luften rundt den, så uten dette blir røyken liggende utenfor
       kjernen. Korreksjonen = kjernebanens retning × fart minus feltets fart i kjernesenteret, vektet mot kjernen. */
    const fc = [0, 0, 0];
    function coreFollow(x, y, z, v) {
      const C = FL.core; if (!C || x < C.x0 || x > C.x1) return;
      const t = (x - C.x0) / (C.x1 - C.x0) * (C.n - 1), i = Math.min(C.n - 2, t | 0), u = t - i;
      const yc = C.Yc[i] + (C.Yc[i + 1] - C.Yc[i]) * u, zc = C.Zc[i] + (C.Zc[i + 1] - C.Zc[i]) * u, sg = y < 0 ? -1 : 1;
      const dy = y - sg * yc, dz = z - zc, r2 = dy * dy + dz * dz, R2 = 4 * C.rg2; if (r2 > 4 * R2) return;
      const hx = (C.x1 - C.x0) / (C.n - 1), sy = sg * (C.Yc[i + 1] - C.Yc[i]) / hx, sz = (C.Zc[i + 1] - C.Zc[i]) / hx;
      FL.fieldFast(x, sg * yc, zc, fc);
      const ux = ca + fc[0] * ex, wgt = Math.exp(-r2 / R2);
      v[1] += wgt * (sy * ux - fc[1] * ex); v[2] += wgt * (sz * ux - (sa + fc[2] * ex));
    }
    function vel(x, y, z, v) {
      FL.fieldFast(x, y, z, f);
      v[0] = ca + f[0] * ex; v[1] = f[1] * ex; v[2] = sa + f[2] * ex;
      FL.coreSwirl(x, y, z, v, ex); coreFollow(x, y, z, v);
      if (x > bx0 && x < bx1 && y < s && y > -s) FL.nearWall(x, y, z, v, ex);
    }
    const rnd = () => Math.random() + Math.random() - 1;   // trekantfordelt (−1, 1)

    /* ett steg på dt sekunder (vegg-tid). Flytiden går S.U ganger raskere. */
    function step(dt, noUpload) {
      const res = FL.res, wing = FL.wing; if (!ready || !res || !wing || !FL.F.data) return 0;
      const t0 = performance.now();
      const A = res.alpha * DEG; ca = Math.cos(A); sa = Math.sin(A); ex = S.ex;
      if (!FL.ensureBlend(A, res.scale)) return 0; FL.ensureCore();
      s = wing.s; bx0 = Math.min(wing.xle(0), wing.xle(s)) - 0.3; bx1 = wing.xle(s) + wing.ct + 0.3; bz0 = Math.min(wing.zw(0), wing.zw(s)) - 0.5; bz1 = Math.max(wing.zw(0), wing.zw(s)) + 0.5;
      const B = FL.B, h0 = Math.min(0.06, dt) * S.U; Tsim += h0;
      // utslipp: ds mellom partiklene langs filamentet, forskjøvet innen steget så det ikke blir bånd
      for (let e = 0; e < nE; e++) {
        acc[e] += h0 / ds;
        while (acc[e] >= 1) {
          acc[e] -= 1; const i = e * per + rn[e]; rn[e] = (rn[e] + 1) % per;
          const back = acc[e] * ds, j = S.jitter, ph = Math.random() * 6.283, rr = j * Math.sqrt(Math.random());
          px[i] = E[3 * e] + back * ca; py[i] = E[3 * e + 1] + rr * Math.cos(ph); pz[i] = E[3 * e + 2] + back * sa + rr * Math.sin(ph);
          age[i] = back; tb[i] = 0; sd[i] = Math.random(); alive[i] = 1; vx[i] = ca; vy[i] = 0; vz[i] = sa;
        }
      }
      const decay = Math.exp(-h0 * 0.1), T = Tsim, n = used();
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        let x = px[i], y = py[i], z = pz[i];
        vel(x, y, z, k1);
        const dv = Math.abs(k1[0] - ca) + Math.abs(k1[1]) + Math.abs(k1[2] - sa);
        // delsteg der farten endrer seg raskt, og alltid tett ved vingen (flaten følges, stagnasjonen deles riktig)
        const nearW = x > bx0 && x < bx1 && y < s && y > -s && z > bz0 && z < bz1;
        const ns = dv > 1.2 ? 4 : (dv > 0.5 || nearW) ? (h0 > 0.12 ? 4 : 2) : (h0 > 0.12 ? 2 : 1), h = h0 / ns;
        for (let q = 0; q < ns; q++) {
          if (q) vel(x, y, z, k1);
          vel(x + k1[0] * h * 0.5, y + k1[1] * h * 0.5, z + k1[2] * h * 0.5, k2);
          let ux = k2[0], uy = k2[1], uz = k2[2];
          const t = tb[i];
          if (t > 0.01) {
            // turbulent kjølvann: hastighetsunderskudd og koherente virvler (skala ~0,3) som driver med strømmen
            ux *= 1 - 0.38 * t;
            const ph = sd[i] * 6.283, Av = 0.5 * t;
            ux += Av * 0.6 * Math.sin(3.1 * x - 4.6 * T + ph);
            uy += Av * Math.sin(2.3 * x + 4.1 * z - 5.7 * T + 2 * ph);
            uz += Av * Math.cos(2.7 * x + 3.3 * y - 5.1 * T + 3 * ph);
          }
          if (S.planar !== null) uy = 0;   // laserark langs korden: røyken holdes i arket (bevegelsen i planet)
          x += ux * h; y += uy * h; z += uz * h;
          // diffusjon: laminær røyk sprer seg i bredden (tegnes bredere), turbulent røyk vandrer tilfeldig
          if (t > 0.02) { const sg = Math.sqrt(h) * 0.07 * t; x += sg * rnd(); y += sg * rnd(); z += sg * rnd(); }
          const c = FL.collide(x, y, z, true); x = c[0]; y = c[1]; z = c[2];
          // separert sone: resirkulasjon (luften over vingen går sakte bakover og løftes mot skjærlaget)
          if (c[3] & 4) { x -= 0.3 * h + 0.03 * Math.sqrt(h) * rnd(); z += 0.12 * h * Math.sin(T * 3 + sd[i] * 20); tb[i] = 1; }
          tb[i] = Math.max(Math.min(1, c[4] / 0.09), tb[i] * decay);
          vx[i] = ux; vy[i] = uy; vz[i] = uz;
        }
        age[i] += h0;
        const X = (x - B.px) * ca + (z - B.py) * sa, Yw = -(x - B.px) * sa + (z - B.py) * ca;
        if (age[i] > life || X > B.x1 || Yw < B.y0 + 0.05 || Yw > B.y1 - 0.05 || Math.abs(y) > B.z - 0.05 || !(x === x)) { alive[i] = 0; continue; }
        px[i] = x; py[i] = y; pz[i] = z;
      }
      if (!noUpload) upload();
      return performance.now() - t0;
    }
    const tx = new Float32Array(MAX), ty = new Float32Array(MAX), tz = new Float32Array(MAX), lk = new Uint8Array(MAX);
    function upload() {
      const n = used(), lmax = 5 * ds, lmax2 = lmax * lmax;
      // 1) lenker til eldre nabo i samme dyse (forrige plass i ringen)
      for (let i = 0; i < n; i++) {
        const e = (i / per) | 0, k = i - e * per, j = e * per + (k ? k - 1 : per - 1);
        let ok = alive[i] && alive[j] && age[j] > age[i];
        if (ok) {
          const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i], d2 = dx * dx + dy * dy + dz * dz;
          ok = d2 < lmax2 && age[j] - age[i] < 2.5 * ds;
          // lenken må gå omtrent langs farten; ellers har filamentet delt seg (stagnasjon, over/under vingen)
          if (ok && tb[i] < 0.3) { const v2 = vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i], dt_ = dx * vx[i] + dy * vy[i] + dz * vz[i]; ok = dt_ > 0.72 * Math.sqrt(d2 * v2); }
        }
        lk[i] = ok ? 1 : 0;
      }
      // 2) tangent per partikkel fra begge naboene (felles retning i skjøtene, så båndet ikke får hakk)
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const e = (i / per) | 0, k = i - e * per, j = e * per + (k ? k - 1 : per - 1), m = e * per + (k === per - 1 ? 0 : k + 1);
        const a = lk[i] ? j : i, b = lk[m] ? m : i;
        tx[i] = px[a] - px[b]; ty[i] = py[a] - py[b]; tz[i] = pz[a] - pz[b];
      }
      for (let i = 0; i < n; i++) {
        const o3 = 3 * i;
        if (!alive[i]) { gAge[i] = 2; } else {
          gPos[o3] = px[i]; gPos[o3 + 1] = pz[i]; gPos[o3 + 2] = py[i]; gAge[i] = age[i] / life; gTb[i] = tb[i]; gSd[i] = sd[i];
        }
        const b = 4 * i;
        if (!lk[i]) { rA[b] = rA[b + 1] = rA[b + 2] = rA[b + 3] = 0; continue; }
        const e = (i / per) | 0, k = i - e * per, j = e * per + (k ? k - 1 : per - 1), ai = age[i] / life, aj = age[j] / life;
        for (let c = 0; c < 4; c++) {
          const me = c < 2 ? i : j, q = 3 * (b + c);
          rPos[q] = px[me]; rPos[q + 1] = pz[me]; rPos[q + 2] = py[me];
          rOth[q] = px[me] + tx[me]; rOth[q + 1] = pz[me] + tz[me]; rOth[q + 2] = py[me] + ty[me];
          rAge[b + c] = c < 2 ? ai : aj; rTb[b + c] = tb[me]; rA[b + c] = 1;
        }
      }
      for (const k in pa) pa[k].needsUpdate = true;
      for (const k in ra) ra[k].needsUpdate = true;
    }
    /* fyll kanalen raskt (uten tegning), innenfor et tidsbudsjett i ms */
    function prewarm(sec, budget) {
      const t0 = performance.now(); let tt = 0;
      while (tt < sec && performance.now() - t0 < (budget || 1e9)) { step(1 / 40, true); tt += 1 / 40; }
      upload(); return tt;
    }
    function count() { let c = 0; const n = used(); for (let i = 0; i < n; i++) c += alive[i]; return c; }
    return {
      group, ribbons, puffs, U, S, setEmitters, rebase, step, prewarm, clear, setCap, count,
      get cap() { return cap; }, get ready() { return ready; }, get nE() { return nE; }, get ds() { return ds; }, get life() { return life; }
    };
  }

  root.SMOKE3D = { make };
})(window);
