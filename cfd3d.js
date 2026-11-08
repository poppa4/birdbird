/* Virtual Lab – CFD-etterbehandling i three.js (r128)
   Vitenskapelige fargekart (kjølig–varm, turbo), strømlinjer som skjermrettede rør med lys, glød og
   pulser som går med lokal fart, rutenettgulv, nøytralt studiomiljø, aksekors og krysstrømsplan. */
(function (root) {
  'use strict';
  const CFD = {};

  /* ---------- fargekart ---------- */
  // Moreland «smooth cool–warm» (sRGB) og Google Turbo (polynom)
  const CW = [[59, 76, 192], [98, 130, 234], [141, 176, 254], [184, 208, 249], [221, 221, 221], [245, 196, 173], [244, 154, 123], [222, 96, 77], [180, 4, 38]].map(c => c.map(v => v / 255));
  function coolwarm(t) { t = Math.max(0, Math.min(1, t)) * 8; const i = Math.min(7, Math.floor(t)), u = t - i, a = CW[i], b = CW[i + 1]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
  // Turbo uten den nesten svarte enden (starter i dyp blå), så langsom strøm leses som blå også på lys bakgrunn
  function turbo(x) {
    x = 0.07 + 0.9 * Math.max(0, Math.min(1, x)); const x2 = x * x, x3 = x2 * x, x4 = x2 * x2, x5 = x4 * x;
    return [0.13572138 + 4.61539260 * x - 42.66032258 * x2 + 132.13108234 * x3 - 152.94239396 * x4 + 59.28637943 * x5,
            0.09140261 + 2.19418839 * x + 4.84296658 * x2 - 14.18503333 * x3 + 4.27729857 * x4 + 2.82956604 * x5,
            0.10667330 + 12.64194608 * x - 60.58204836 * x2 + 110.36276771 * x3 - 89.90310912 * x4 + 27.34824973 * x5].map(v => Math.max(0, Math.min(1, v)));
  }
  CFD.coolwarm = coolwarm; CFD.turbo = turbo;
  CFD.cmap = (id, t) => id === 1 ? turbo(t) : coolwarm(t);
  CFD.GLSL_CMAP = `
uniform float cmin; uniform float cmax; uniform float cmapId;
vec3 coolwarm(float t){ t=clamp(t,0.0,1.0)*8.0;
  vec3 c0=vec3(0.231,0.298,0.753), c1=vec3(0.384,0.510,0.918), c2=vec3(0.553,0.690,0.996), c3=vec3(0.722,0.816,0.976), c4=vec3(0.867,0.867,0.867),
       c5=vec3(0.961,0.769,0.678), c6=vec3(0.957,0.604,0.482), c7=vec3(0.871,0.376,0.302), c8=vec3(0.706,0.016,0.149);
  if(t<1.0) return mix(c0,c1,t); if(t<2.0) return mix(c1,c2,t-1.0); if(t<3.0) return mix(c2,c3,t-2.0); if(t<4.0) return mix(c3,c4,t-3.0);
  if(t<5.0) return mix(c4,c5,t-4.0); if(t<6.0) return mix(c5,c6,t-5.0); if(t<7.0) return mix(c6,c7,t-6.0); return mix(c7,c8,t-7.0); }
vec3 turbo(float x){ x=0.07+0.9*clamp(x,0.0,1.0);
  const vec4 kR=vec4(0.13572138,4.61539260,-42.66032258,132.13108234); const vec4 kG=vec4(0.09140261,2.19418839,4.84296658,-14.18503333);
  const vec4 kB=vec4(0.10667330,12.64194608,-60.58204836,110.36276771); const vec2 kR2=vec2(-152.94239396,59.28637943);
  const vec2 kG2=vec2(4.27729857,2.82956604); const vec2 kB2=vec2(-89.90310912,27.34824973);
  vec4 v4=vec4(1.0,x,x*x,x*x*x); vec2 v2=v4.zw*v4.z;
  return clamp(vec3(dot(v4,kR)+dot(v2,kR2),dot(v4,kG)+dot(v2,kG2),dot(v4,kB)+dot(v2,kB2)),0.0,1.0); }
vec3 cmap(float t){ return cmapId>0.5 ? turbo(t) : coolwarm(t); }
float cpT(float cp){ return cp<0.0 ? 0.5-0.5*cp/cmin : 0.5+0.5*cp/cmax; }`;

  /* ---------- strømlinjer: skjermrettede bånd skyggelagt som rør ----------
     Per punkt to hjørner (side ±1). Attributter: prv/nxt (naboer), cpv (Cp), tv (flytid), fd (inn/ut-fading), sd (frø). */
  CFD.lineMaterial = function (THREE, glow) {
    return new THREE.ShaderMaterial({
      uniforms: { cmin: { value: -1.5 }, cmax: { value: 1 }, vmin: { value: 0.7 }, vmax: { value: 1.3 }, cmapId: { value: 0 }, time: { value: 0 }, width: { value: 2 }, res: { value: new THREE.Vector2(1000, 600) },
        bright: { value: 1 }, pulse: { value: 1 }, pulseRate: { value: 1 }, opac: { value: 1 }, white: { value: 0 } },
      vertexShader: `attribute vec3 prv; attribute vec3 nxt; attribute float side; attribute float cpv; attribute float tv; attribute float fd; attribute float sd;
        uniform float width; uniform vec2 res; varying float vCp; varying float vT; varying float vS; varying float vF; varying float vSd; varying float vW;
        void main(){ vCp=cpv; vT=tv; vS=side; vF=fd; vSd=sd;
          mat4 M=projectionMatrix*modelViewMatrix;
          vec4 c=M*vec4(position,1.0), a=M*vec4(prv,1.0), b=M*vec4(nxt,1.0);
          vec2 d=(b.xy/b.w-a.xy/a.w)*res; float L=length(d); d= L>1e-6? d/L : vec2(1.0,0.0);
          vec2 n=vec2(-d.y,d.x);
          float w=width*(${glow ? '1.0' : '0.8+0.4*clamp(abs(cpv-1.0)*4.0,0.0,1.0)'}); vW=w;
          c.xy+=n*side*w/res*c.w; gl_Position=c; }`,
      fragmentShader: CFD.GLSL_CMAP + `
        uniform float time; uniform float bright; uniform float pulse; uniform float pulseRate; uniform float opac; uniform float white; uniform float vmin; uniform float vmax;
        varying float vCp; varying float vT; varying float vS; varying float vF; varying float vSd; varying float vW;
        void main(){
          vec3 base= white>0.5 ? vec3(0.9,0.93,0.96) : cmap(clamp((vCp-vmin)/(vmax-vmin),0.0,1.0));
          float ph=fract(vT*0.22-time*pulseRate*0.22+vSd);
          float head=exp(-(1.0-ph)*26.0)*smoothstep(1.0,0.992,ph);
          float pul=pulse*head;
          float s=abs(vS);
          ${glow ? `
          float dev=clamp(abs(vCp-1.0)*5.0,0.0,1.0);
          float a=exp(-4.5*s*s)*(0.035+0.07*dev+0.18*pul)*vF*bright*opac;
          gl_FragColor=vec4(mix(base,vec3(1.0),0.35*pul)*a, 1.0);` : `
          float nrm=sqrt(max(0.0,1.0-s*s));
          float spec=pow(max(0.0,1.0-abs(vS+0.35)*2.2),6.0);
          vec3 col=base*(0.52+0.55*nrm)+0.22*spec*vec3(1.0);
          col*=1.0-0.4*smoothstep(0.6,1.0,s);   // mørk kant: linjen skiller seg fra flaten bak
          col=mix(col,vec3(1.0),0.32*pul);
          float aa=clamp((1.0-s)*vW*0.5,0.0,1.0);
          float emph=0.42+0.58*clamp(abs(vCp-1.0)*14.0,0.0,1.0);   // fri strøm dempes, forstyrret strøm fremheves
          gl_FragColor=vec4(col*bright,aa*vF*opac*emph);`}
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      // glød: legg til lys uten å gjøre lerretet ugjennomsiktig (alfa urørt), så CSS-bakgrunnen synes gjennom
      blending: glow ? THREE.CustomBlending : THREE.NormalBlending,
      blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor
    });
  };
  /* ---------- tette strømlinjer: skjermrettede bånd skyggelagt som belyste rør ----------
     Samme geometri som lineMaterial. Bredden følger dybden (nære linjer er tykkere), endene smalner av, og hvert
     fragment får en rørnormal (på tvers av båndet) med diffus- og glanslys fra et fast studiolys. Fargen er lokal fart
     |V|/V∞ (cpv) gjennom fargekartet. Én tegnekall for alle linjene; linjer nær fri strøm tones ned. */
  CFD.tubeMaterial = function (THREE) {
    return new THREE.ShaderMaterial({
      uniforms: { cmin: { value: -1.5 }, cmax: { value: 1 }, vmin: { value: 0.7 }, vmax: { value: 1.3 }, cmapId: { value: 1 }, time: { value: 0 }, width: { value: 1.6 },
        res: { value: new THREE.Vector2(1000, 600) }, bright: { value: 1 }, pulse: { value: 1 }, pulseRate: { value: 1 }, opac: { value: 1 }, studio: { value: 1 }, dref: { value: 16 } },
      vertexShader: `attribute vec3 prv; attribute vec3 nxt; attribute float side; attribute float cpv; attribute float tv; attribute float fd; attribute float sd;
        uniform float width; uniform vec2 res; uniform float dref; varying float vV; varying float vT; varying float vS; varying float vF; varying float vSd; varying float vW; varying vec2 vN;
        void main(){ vV=cpv; vT=tv; vS=side; vF=fd; vSd=sd;
          mat4 M=projectionMatrix*modelViewMatrix;
          vec4 c=M*vec4(position,1.0), a=M*vec4(prv,1.0), b=M*vec4(nxt,1.0);
          vec2 d=(b.xy/b.w-a.xy/a.w)*res; float L=length(d); d= L>1e-6? d/L : vec2(1.0,0.0);
          vec2 n=vec2(-d.y,d.x); vN=n;
          float w=width*clamp(dref/max(c.w,0.1),0.55,1.8)*mix(0.3,1.0,fd); vW=w;
          c.xy+=n*side*(w+1.0)/res*c.w; gl_Position=c; }`,
      fragmentShader: CFD.GLSL_CMAP + `
        uniform float time; uniform float bright; uniform float pulse; uniform float pulseRate; uniform float opac; uniform float vmin; uniform float vmax; uniform float studio;
        varying float vV; varying float vT; varying float vS; varying float vF; varying float vSd; varying float vW; varying vec2 vN;
        void main(){
          float s=abs(vS)*(vW+1.0)/vW;                 // 0 i midten, 1 ved rørkanten (+1 px for kantutjevning)
          float cov=clamp((1.0-s)*vW*0.5+0.5,0.0,1.0);
          float a=cov*vF*opac; if(a<0.02) discard;
          float sc=clamp(vS*(vW+1.0)/vW,-1.0,1.0);
          vec3 N=normalize(vec3(vN*sc, sqrt(max(0.0,1.0-sc*sc))));
          vec3 Ld=normalize(vec3(-0.42,0.62,0.66)), H=normalize(Ld+vec3(0.0,0.0,1.0));
          float dif=max(dot(N,Ld),0.0), sp=pow(max(dot(N,H),0.0),36.0);
          vec3 base=cmap(clamp((vV-vmin)/(vmax-vmin),0.0,1.0));
          vec3 col=base*(0.42+0.7*dif)+sp*(0.25+0.2*studio);
          col*=1.0-(0.28+0.12*studio)*smoothstep(0.5,1.0,s);    // mørk rørkant skiller linjen fra flaten og nabolinjene bak
          float dev=clamp(abs(vV-1.0)/max(0.02,0.35*(vmax-vmin)),0.0,1.0);
          a*=mix(0.38+0.2*(1.0-studio),1.0,dev);                  // nesten fri strøm tones ned, forstyrret strøm fremheves
          float ph=fract(vT*0.22-time*pulseRate*0.22+vSd);
          float head=exp(-(1.0-ph)*26.0)*smoothstep(1.0,0.992,ph);
          col=mix(col,vec3(1.0),0.45*pulse*head);
          gl_FragColor=vec4(col*bright,a);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
  };

  /* ---------- fartssnitt: |V|/V∞ som jevnt fargefelt med isolinjer (tegnes i skyggeleggeren) ----------
     map: R/B = fart i 16 bit (smin..smax), G = fast flate. Isolinjer hver 0,05 V/V∞ (tydeligere hver 0,25). */
  CFD.speedSliceMaterial = function (THREE) {
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, smin: { value: 0 }, smax: { value: 2 }, vmin: { value: 0.7 }, vmax: { value: 1.3 }, cmapId: { value: 1 }, cmin: { value: -1 }, cmax: { value: 1 },
        op: { value: 0.97 }, iso: { value: 1 }, studio: { value: 1 }, texel: { value: new THREE.Vector2(1 / 256, 1 / 128) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: CFD.GLSL_CMAP + `
        uniform sampler2D map; uniform float smin; uniform float smax; uniform float vmin; uniform float vmax; uniform float op; uniform float iso; uniform float studio; uniform vec2 texel;
        varying vec2 vUv;
        void main(){
          vec4 t=texture2D(map,vUv);
          float sol=t.g; if(sol>0.5) discard;   // modellen selv vises der flaten skjærer planet
          float v=smin+(smax-smin)*(t.r*65280.0+t.b*255.0)/65535.0;   // 16 bit: høy byte i R, lav i B (bilineær filtrering er lineær, så det går)
          vec3 c=cmap(clamp((v-vmin)/(vmax-vmin),0.0,1.0));
          float f1=v*20.0, w1=fwidth(f1), d1=abs(fract(f1-0.5)-0.5), l1=1.0-smoothstep(0.0,w1*1.2,d1);
          float f2=v*4.0, w2=fwidth(f2), d2=abs(fract(f2-0.5)-0.5), l2=1.0-smoothstep(0.0,w2*1.5,d2);
          // isolinjer bare der feltet faktisk varierer (ellers gir støy rundt et nivå prikker i flate områder)
          float g1=smoothstep(0.004,0.02,w1), g2=smoothstep(0.001,0.005,w2);
          c*=1.0-iso*(0.12*l1*step(w1,0.5)*g1+0.26*l2*step(w2,0.5)*g2);
          float e=smoothstep(0.0,0.012,vUv.x)*smoothstep(1.0,0.988,vUv.x)*smoothstep(0.0,0.02,vUv.y)*smoothstep(1.0,0.98,vUv.y);
          float nearSolid=smoothstep(0.5,0.0,sol)*1.0;
          gl_FragColor=vec4(c,op*e*nearSolid);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: { derivatives: true }
    });
  };

  /* L: [{p:Float32Array (tre-koordinater), cp:Float32Array, t:Float32Array, sd}] */
  CFD.lineGeometry = function (THREE, L, o) {
    const fin = (o && o.fadeIn) || 0.9, fout = (o && o.fadeOut) || 2.2;
    let nv = 0, ni = 0;
    for (const l of L) { const n = l.cp.length; if (n < 2) continue; nv += 2 * n; ni += 6 * (n - 1); }
    const pos = new Float32Array(nv * 3), prv = new Float32Array(nv * 3), nxt = new Float32Array(nv * 3), side = new Float32Array(nv), cpv = new Float32Array(nv), tv = new Float32Array(nv), fd = new Float32Array(nv), sd = new Float32Array(nv);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v = 0, q = 0;
    for (const l of L) {
      const n = l.cp.length; if (n < 2) continue; const P3 = l.p, base = v, T = l.t[n - 1] || 1;
      for (let i = 0; i < n; i++) {
        const ia = Math.max(0, i - 1), ib = Math.min(n - 1, i + 1);
        const u = Math.max(0, Math.min(1, (l.t[i] - (l.t[0] || 0)) / fin)), f = Math.min(u * u * (3 - 2 * u), Math.max(0, Math.min(1, (T - l.t[i]) / fout)));
        for (let s = -1; s <= 1; s += 2) {
          pos[v * 3] = P3[i * 3]; pos[v * 3 + 1] = P3[i * 3 + 1]; pos[v * 3 + 2] = P3[i * 3 + 2];
          prv[v * 3] = P3[ia * 3]; prv[v * 3 + 1] = P3[ia * 3 + 1]; prv[v * 3 + 2] = P3[ia * 3 + 2];
          nxt[v * 3] = P3[ib * 3]; nxt[v * 3 + 1] = P3[ib * 3 + 1]; nxt[v * 3 + 2] = P3[ib * 3 + 2];
          side[v] = s; cpv[v] = l.cp[i]; tv[v] = l.t[i]; fd[v] = f * (l.fade == null ? 1 : l.fade); sd[v] = l.sd; v++;
        }
        if (i > 0) { const a = base + (i - 1) * 2; idx[q++] = a; idx[q++] = a + 2; idx[q++] = a + 1; idx[q++] = a + 1; idx[q++] = a + 2; idx[q++] = a + 3; }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('prv', new THREE.BufferAttribute(prv, 3)); g.setAttribute('nxt', new THREE.BufferAttribute(nxt, 3));
    g.setAttribute('side', new THREE.BufferAttribute(side, 1)); g.setAttribute('cpv', new THREE.BufferAttribute(cpv, 1)); g.setAttribute('tv', new THREE.BufferAttribute(tv, 1));
    g.setAttribute('fd', new THREE.BufferAttribute(fd, 1)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  };

  /* ---------- rutenettgulv som tones ut med avstanden ---------- */
  CFD.gridFloor = function (THREE, size) {
    const m = new THREE.ShaderMaterial({
      uniforms: { col: { value: new THREE.Color(0.75, 0.8, 0.86) }, op: { value: 1 }, fadeR: { value: size * 0.42 } },
      vertexShader: `varying vec2 vP; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vP=w.xz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 col; uniform float op; uniform float fadeR; varying vec2 vP;
        float grid(vec2 p, float s){ vec2 g=abs(fract(p/s-0.5)-0.5)/fwidth(p/s); return 1.0-min(min(g.x,g.y),1.0); }
        void main(){ float minor=grid(vP,1.0), major=grid(vP,5.0);
          float r=length(vP-vec2(1.5,0.0)); float fade=1.0-smoothstep(fadeR*0.35,fadeR,r);
          float a=(0.028*minor+0.07*major)*fade*op;
          gl_FragColor=vec4(col,a); }`,
      transparent: true, depthWrite: false, extensions: { derivatives: true }
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m); mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = -1;
    return mesh;
  };

  /* ---------- nøytralt studiomiljø (myke softbokser) for refleksjoner i CFD-modus ---------- */
  CFD.studioEnv = function (THREE, renderer, light) {
    const es = new THREE.Scene();
    const sg = new THREE.SphereGeometry(30, 32, 16), pa = sg.attributes.position, col = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) {
      const h = pa.getY(i) / 30, up = Math.pow(Math.max(h, 0), 0.7), dn = Math.pow(Math.max(-h, 0), 0.5);
      const mid = light ? [0.62, 0.64, 0.66] : [0.2, 0.22, 0.25], top = light ? [0.95, 0.96, 0.97] : [0.42, 0.45, 0.5], bot = light ? [0.36, 0.37, 0.39] : [0.06, 0.065, 0.075];
      for (let c = 0; c < 3; c++) { const m = mid[c] + (top[c] - mid[c]) * up; col[i * 3 + c] = m + (bot[c] - m) * dn; }
    }
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    es.add(sky);
    const box = (w, h, x, y, z, I) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(I, I, I * 1.02), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
    const kb = light ? 1.5 : 1;
    box(16, 6, -6, 18, 6, 3.2 * kb); box(10, 10, 14, 6, -10, 1.6 * kb); box(20, 2, 0, 4, -22, 1.1 * kb); box(8, 8, -18, 2, -6, 0.9 * kb);
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(es, 0.03).texture; pm.dispose();
    es.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return t;
  };

  /* ---------- aksekors (egen liten scene, tegnes i hjørnet) ---------- */
  CFD.triad = function (THREE) {
    const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10); cam.position.set(0, 0, 4);
    sc.add(new THREE.AmbientLight(0xffffff, 0.75)); const dl = new THREE.DirectionalLight(0xffffff, 0.6); dl.position.set(2, 3, 4); sc.add(dl);
    const grp = new THREE.Group(); sc.add(grp);
    const mk = (dir, col, lab) => {
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.1 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 12), m); shaft.position.y = 0.4;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 16), m); head.position.y = 0.92;
      const g = new THREE.Group(); g.add(shaft); g.add(head); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); grp.add(g);
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      x.font = '600 40px "IBM Plex Mono", ui-monospace, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#' + new THREE.Color(col).getHexString(); x.fillText(lab, 32, 34);
      const t = new THREE.CanvasTexture(c); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
      sp.scale.set(0.42, 0.42, 1); sp.position.copy(dir).multiplyScalar(1.3); grp.add(sp);
    };
    // x nedstrøms (rød), y mot høyre vinge (grønn), z opp (blå) – vingeramme/vindakser
    mk(new THREE.Vector3(1, 0, 0), 0xe0645a, 'x'); mk(new THREE.Vector3(0, 0, 1), 0x6cc48a, 'y'); mk(new THREE.Vector3(0, 1, 0), 0x6f9cf0, 'z');
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 8), new THREE.MeshStandardMaterial({ color: 0xd8dde3 })); grp.add(dot);
    return {
      render(renderer, mainCam, x, y, size) {
        grp.quaternion.copy(mainCam.quaternion).invert();
        renderer.setScissorTest(true); renderer.setScissor(x, y, size, size); renderer.setViewport(x, y, size, size);
        const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(sc, cam); renderer.autoClear = ac;
        renderer.setScissorTest(false);
      }
    };
  };

  /* ---------- krysstrømsplan: virvlighet som farge (gjennomsiktig der den er liten) ---------- */
  CFD.planeMaterial = function (THREE, tex) {
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, op: { value: 0.92 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform float op; varying vec2 vUv; void main(){ vec4 c=texture2D(map,vUv); float e=smoothstep(0.0,0.02,vUv.x)*smoothstep(1.0,0.98,vUv.x)*smoothstep(0.0,0.03,vUv.y)*smoothstep(1.0,0.97,vUv.y); gl_FragColor=vec4(c.rgb,c.a*op*e); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
  };

  root.CFD = CFD;
})(window);
