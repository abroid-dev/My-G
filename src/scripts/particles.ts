/**
 * THE LIVING PORTRAIT
 * One field of particles carries the whole site. It assembles into her
 * portrait (sampled from the real photo, backdrop removed), then morphs
 * between shapes as the page scrolls: a wave, the rising path of her
 * career, a five-petal flower of expertise, orbiting credentials, and
 * back to the portrait.
 *
 * Shapes are plain Float32Arrays; the GPU only ever blends two of them
 * (aFrom → aTo) with a per-particle delay, so 60k points stay smooth.
 */
import * as THREE from 'three';

export type ShapeName = 'dust' | 'portrait' | 'wave' | 'path' | 'flower' | 'rings' | 'portraitEnd';
type Shape = { pos: Float32Array; col: Float32Array; tag: Float32Array; size: number };

const VERT = /* glsl */ `
  attribute vec3 aFrom; attribute vec3 aTo;
  attribute vec3 aColFrom; attribute vec3 aColTo;
  attribute float aTagTo; attribute vec4 aRand;
  uniform float uMix, uTime, uSizeFrom, uSizeTo, uHi, uReveal, uFade, uDim;
  uniform vec2 uMouse; uniform vec3 uAccent; uniform float uHiMix;
  varying vec3 vCol; varying float vAlpha;

  void main() {
    float t = clamp(uMix * 1.5 - aRand.x * 0.5, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec3 p = mix(aFrom, aTo, t);
    // mid-flight swirl
    float fl = sin(t * 3.14159);
    p += vec3(sin(aRand.y * 40.0 + uTime * 0.6), cos(aRand.z * 40.0 + uTime * 0.5), sin(aRand.w * 40.0)) * fl * 1.1;
    // idle breathing
    p.xy += vec2(sin(uTime * 0.7 + aRand.y * 6.28), cos(uTime * 0.6 + aRand.z * 6.28)) * 0.012;
    // the pointer parts the particles like water
    vec2 d = p.xy - uMouse;
    float dl = length(d);
    p.xy += normalize(d + 1e-4) * 0.42 * exp(-dl * dl * 2.6);
    p.z += 0.5 * exp(-dl * dl * 2.6);

    float hi = (uHi > -0.5 && abs(aTagTo - uHi) < 0.5) ? 1.0 : 0.0;
    float dim = (uHi > -0.5 && aTagTo > -0.5 && hi < 0.5) ? 0.45 : 1.0;
    vec3 c = mix(aColFrom, aColTo, t);
    vCol = mix(c, uAccent, hi * uHiMix);
    vAlpha = dim * uFade * uDim * smoothstep(0.0, 0.25, uReveal - aRand.x * 0.75);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = mix(uSizeFrom, uSizeTo, t) * (0.8 + aRand.y * 0.45) * (1.0 + hi * 0.9) * (10.0 / -mv.z);
  }`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vCol; varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.36, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vCol, a);
  }`;

type RGB = [number, number, number];
// Two palettes. Light: dark ink on ivory. Dark: warm ivory, gold and rose, glowing on near-black.
const PALETTES: Record<'light' | 'dark', { ink: RGB; red: RGB; gold: RGB; rose: RGB; plum: RGB; wine: RGB; bg: RGB; lift: number }> = {
  light: { ink: [0.16, 0.12, 0.19], red: [0.70, 0.15, 0.18], gold: [0.72, 0.55, 0.24], rose: [0.78, 0.38, 0.45], plum: [0.42, 0.26, 0.48], wine: [0.55, 0.20, 0.30], bg: [0.97, 0.95, 0.93], lift: 0 },
  dark: { ink: [0.93, 0.88, 0.80], red: [0.94, 0.36, 0.38], gold: [0.90, 0.70, 0.33], rose: [0.96, 0.55, 0.60], plum: [0.70, 0.55, 0.86], wine: [0.86, 0.40, 0.50], bg: [0.059, 0.047, 0.063], lift: 0.14 },
};
let INK: RGB, RED: RGB, GOLD: RGB, ROSE: RGB, PLUM: RGB, BG: RGB, PETALS: RGB[], LIFT = 0, DARK = false;
const applyPalette = (t: 'light' | 'dark') => {
  const p = PALETTES[t];
  INK = p.ink; RED = p.red; GOLD = p.gold; ROSE = p.rose; PLUM = p.plum; BG = p.bg; LIFT = p.lift; DARK = t === 'dark';
  PETALS = [RED, GOLD, PLUM, ROSE, p.wine];
};
applyPalette('light');

// deterministic random so shapes are stable between resizes
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2;

export interface Field {
  setMorph(from: ShapeName, to: ShapeName, mix: number): void;
  highlight(tag: number): void;
  /** Re-colour every shape for the light or dark page. */
  setTheme(t: 'light' | 'dark'): void;
  /** 0..1 opacity of the whole field (used to hand over to the real photo). */
  fade(a: number): void;
  /** Second opacity control: lets text be read over the field on phones. */
  dim(a: number): void;
  /** Where the two portraits sit, in CSS pixels: centre x, centre y, size. */
  portraitBox(which: 'start' | 'end'): { x: number; y: number; size: number };
  anchors: { path: { x: number; y: number }[]; petals: { x: number; y: number }[] };
  onLayout(fn: () => void): void;
  reveal(seconds: number, delay: number): void;
  destroy(): void;
}

export async function createField(canvas: HTMLCanvasElement, imgUrl: string, opts: { nodes: number; weights?: number[]; reduced: boolean; theme?: 'light' | 'dark' }): Promise<Field | null> {
  applyPalette(opts.theme ?? 'light');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch { return null; }
  const mobile = Math.min(innerWidth, innerHeight) < 700;
  const N = mobile ? 34000 : 64000;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 10;
  const H = 2 * 10 * Math.tan((50 * Math.PI) / 360); // world height at z = 0
  let W = H;

  // ── sample the portrait once ──
  const img = new Image();
  img.decoding = 'async';
  img.src = imgUrl;
  try { await img.decode(); } catch { return null; }
  const G = mobile ? 230 : 300;
  const cv = document.createElement('canvas');
  cv.width = cv.height = G;
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(img, 0, 0, G, G);
  const data = cx.getImageData(0, 0, G, G).data;
  const pix: number[] = []; // x, y, r, g, b
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const i = (y * G + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const l = (r + g + b) / 3;
    if (b - r > 10 && l > 150 && b - g > 6) continue; // studio backdrop
    pix.push(x / G, y / G, r / 255, g / 255, b / 255);
  }
  const PN = pix.length / 5;

  const rand = new Float32Array(N * 4);
  seed = 11;
  for (let i = 0; i < N * 4; i++) rand[i] = rnd();

  const fineSize = (mobile ? 1.5 : 1.9) * dpr;
  const blank = (): Shape => ({ pos: new Float32Array(N * 3), col: new Float32Array(N * 3), tag: new Float32Array(N).fill(-1), size: fineSize });
  const put = (s: Shape, i: number, x: number, y: number, z: number, c: readonly number[], tag = -1) => {
    s.pos[i * 3] = x; s.pos[i * 3 + 1] = y; s.pos[i * 3 + 2] = z;
    s.col[i * 3] = c[0]; s.col[i * 3 + 1] = c[1]; s.col[i * 3 + 2] = c[2];
    s.tag[i] = tag;
  };
  const tone = (i: number) => (rand[i * 4 + 3] < 0.1 ? RED : rand[i * 4 + 3] < 0.17 ? GOLD : INK);

  const shapes = {} as Record<ShapeName, Shape>;
  const anchors: Field['anchors'] = { path: [], petals: [] };
  const layoutFns: (() => void)[] = [];
  const boxes = { start: { cx: 0, cy: 0, size: 1 }, end: { cx: 0, cy: 0, size: 1 } };

  // Every kept pixel gets a particle before any pixel gets a second one,
  // and points are sized to overlap, so the portrait reads as a continuous
  // image made of soft dots rather than as noise.
  seed = 19;
  const order = new Uint32Array(PN);
  for (let i = 0; i < PN; i++) order[i] = i;
  for (let i = PN - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  function portrait(cxw: number, cyw: number, size: number): Shape {
    const s = blank();
    seed = 23;
    for (let i = 0; i < N; i++) {
      const k = order[i % PN] * 5;
      const jx = (rnd() - 0.5) * 0.7 / G, jy = (rnd() - 0.5) * 0.7 / G;
      const lum = (pix[k + 2] + pix[k + 3] + pix[k + 4]) / 3;
      const lf = (v: number) => v * (1 - LIFT) + LIFT;
      put(s, i, cxw + (pix[k] + jx - 0.5) * size, cyw - (pix[k + 1] + jy - 0.5) * size, (lum - 0.5) * 0.25, [lf(pix[k + 2]), lf(pix[k + 3]), lf(pix[k + 4])]);
    }
    // one grid cell in CSS pixels, with overlap
    s.size = Math.max(fineSize, ((size / H) * innerHeight / G) * 2.3 * dpr);
    return s;
  }

  function build() {
    const wide = W > H * 1.05;
    // dust: where everything begins
    seed = 3;
    const dust = blank();
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2, r = 2 + Math.pow(rnd(), 0.6) * W * 0.9;
      put(dust, i, Math.cos(a) * r, Math.sin(a) * r * 0.7, (rnd() - 0.5) * 8, tone(i));
    }
    shapes.dust = dust;

    // portrait: right of the name on wide screens, above it on phones
    // On phones the photo takes exactly the room above the text, measured from the page,
    // so the name never sits on her arms, whatever the screen height.
    const fit = (textTopPx: number | null, fallback: { cx: number; cy: number; size: number }) => {
      if (textTopPx === null) return fallback;
      const topPx = 72, availPx = textTopPx - 14 - topPx;
      if (availPx < 120) return fallback;
      const sizePx = Math.min(innerWidth * 1.02, availPx * 1.1);
      const k = H / innerHeight;
      return { cx: 0, cy: (0.5 - (topPx + availPx / 2) / innerHeight) * H, size: sizePx * k };
    };
    const heroTop = (() => { const e = document.querySelector<HTMLElement>('.hero__loc'); return e ? e.getBoundingClientRect().top + scrollY : null; })();
    const endTop = (() => {
      const sec = document.querySelector<HTMLElement>('.end'), t = document.querySelector<HTMLElement>('.end__title');
      if (!sec || !t) return null;
      const r = sec.getBoundingClientRect();
      return innerHeight - r.height + (t.getBoundingClientRect().top - r.top);
    })();
    boxes.start = wide ? { cx: W * 0.21, cy: 0, size: H * 0.8 } : fit(heroTop, { cx: 0, cy: H * 0.13, size: Math.min(W * 1.02, H * 0.52) });
    shapes.portrait = portrait(boxes.start.cx, boxes.start.cy, boxes.start.size);
    boxes.end = wide ? { cx: -W * 0.24, cy: -H * 0.02, size: H * 0.72 } : fit(endTop, { cx: 0, cy: H * 0.25, size: Math.min(W * 0.78, H * 0.34) });
    shapes.portraitEnd = portrait(boxes.end.cx, boxes.end.cy, boxes.end.size);

    // wave: a ribbon of light under the statement
    seed = 5;
    const wave = blank();
    for (let i = 0; i < N; i++) {
      const u = rnd(), v = rnd();
      const x = (u - 0.5) * W * 1.25;
      const band = (v - 0.5) * H * 0.34;
      const y = -H * 0.34 + Math.sin(u * 7.0) * H * 0.05 + Math.sin(u * 15.0 + v * 4.0) * H * 0.02 + band * 0.6 * (0.35 + 0.65 * Math.abs(Math.sin(u * 3.2 + 0.6)));
      // softened toward the paper colour so text stays readable over it
      const tc = tone(i), k = wide ? 0.35 : 0.6;
      put(wave, i, x, y, Math.cos(u * 9.0) * 1.2 + (v - 0.5) * 1.5, [tc[0] + (BG[0] - tc[0]) * k, tc[1] + (BG[1] - tc[1]) * k, tc[2] + (BG[2] - tc[2]) * k]);
    }
    shapes.wave = wave;

    // path: her career. On wide screens a river of light runs left to right
    // along the top, one cluster per role, each sized by how long the role
    // lasted; on phones it climbs the field.
    seed = 7;
    const path = blank();
    const n = opts.nodes;
    const wts = opts.weights && opts.weights.length === n ? opts.weights : new Array(n).fill(0.5);
    const x0 = wide ? -W * 0.4 : -W * 0.36, x1 = wide ? W * 0.4 : W * 0.36;
    const y0 = wide ? H * 0.13 : H * 0.13, y1 = wide ? H * 0.25 : H * 0.36;
    const at = (t: number): [number, number, number] => wide
      ? [x0 + (x1 - x0) * t, y0 + (y1 - y0) * (t * t * 0.5 + t * 0.5) + Math.sin(t * Math.PI * 2.6) * H * 0.022, Math.sin(t * 5) * 0.6]
      : [
        x0 + (x1 - x0) * t + Math.sin(t * Math.PI * 2) * W * 0.05,
        y0 + (y1 - y0) * (t * t * 0.55 + t * 0.45) + Math.sin(t * Math.PI * 3) * H * 0.02,
        Math.sin(t * 5) * 0.6,
      ];
    const rad = (k: number) => (wide ? 0.15 + 0.3 * wts[k] : 0.17 + 0.2 * wts[k]);
    const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const grad = (t: number): RGB => (t < 0.5 ? mixc(PLUM, GOLD, t * 2) : mixc(GOLD, RED, (t - 0.5) * 2));
    const shade = (c: RGB, r: number): RGB => { const f = 0.78 + 0.22 * r; return [c[0] * f, c[1] * f, c[2] * f]; };
    anchors.path = [];
    for (let k = 0; k < n; k++) { const p = at(n === 1 ? 0.5 : k / (n - 1)); anchors.path.push({ x: p[0], y: p[1] }); }
    for (let i = 0; i < N; i++) {
      const pick = rnd();
      if (pick < (wide ? 0.5 : 0.3)) {
        const k = Math.floor(rnd() * n);
        const c = at(n === 1 ? 0.5 : k / (n - 1));
        const r = Math.pow(rnd(), 0.62) * rad(k);
        const a = rnd() * Math.PI * 2, b = Math.acos(2 * rnd() - 1);
        put(path, i, c[0] + r * Math.sin(b) * Math.cos(a), c[1] + r * Math.sin(b) * Math.sin(a), c[2] + r * Math.cos(b), DARK ? shade(grad(n === 1 ? 0.5 : k / (n - 1)), rand[i * 4 + 1]) : tone(i), k);
      } else if (pick < 0.86) {
        const tt = rnd(), c = at(tt);
        put(path, i, c[0] + gauss() * 0.05, c[1] + gauss() * 0.05, c[2] + gauss() * 0.1, DARK ? grad(tt) : INK);
      } else {
        const c = at(rnd());
        put(path, i, c[0] + gauss() * W * (wide ? 0.05 : 0.1), c[1] + gauss() * H * (wide ? 0.045 : 0.12), c[2] + gauss() * 2, GOLD);
      }
    }
    if (!wide) path.size = fineSize * 0.72;   // phones: finer dots, so clusters read as soft orbs, not blobs
    shapes.path = path;

    // flower: five petals, five areas of expertise
    seed = 9;
    const flower = blank();
    const fx = 0, fy = wide ? -H * 0.02 : H * 0.2;
    const R = wide ? H * 0.3 : Math.min(W * 0.42, H * 0.19);
    anchors.petals = [];
    for (let k = 0; k < 5; k++) {
      const a = Math.PI / 2 - (k * Math.PI * 2) / 5;
      anchors.petals.push({ x: fx + Math.cos(a) * R * 1.08, y: fy + Math.sin(a) * R * 1.08 });
    }
    for (let i = 0; i < N; i++) {
      if (rnd() < 0.07) { // golden heart
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R * 0.13;
        put(flower, i, fx + Math.cos(a) * r, fy + Math.sin(a) * r, 0.3 + rnd() * 0.2, GOLD);
        continue;
      }
      const k = Math.floor(rnd() * 5);
      const mid = Math.PI / 2 - (k * Math.PI * 2) / 5;
      const off = (rnd() - 0.5) * (Math.PI * 2) / 5;       // angle within the petal
      const u = Math.abs(off) / (Math.PI / 5);              // 0 at the midrib, 1 at the edge
      const edge = Math.pow(Math.cos(u * Math.PI / 2), 0.7); // petal outline
      const r = R * (0.12 + 0.88 * edge * Math.sqrt(rnd()));
      const curl = Math.sin((r / R) * Math.PI) * 0.5;
      const c = PETALS[k];
      const shade = 0.7 + 0.5 * (r / R);
      put(flower, i, fx + Math.cos(mid + off) * r, fy + Math.sin(mid + off) * r, curl - u * 0.3, [Math.min(1, c[0] * shade), Math.min(1, c[1] * shade), Math.min(1, c[2] * shade)], k);
    }
    shapes.flower = flower;

    // rings: credentials in orbit
    seed = 13;
    const rings = blank();
    const rx = wide ? -W * 0.24 : 0, ry = wide ? 0 : H * 0.22;
    const RR = wide ? H * 0.34 : Math.min(W * 0.4, H * 0.15);
    for (let i = 0; i < N; i++) {
      const k = Math.floor(rnd() * 5);
      if (rnd() < 0.08) {
        const a = rnd() * Math.PI * 2, b = Math.acos(2 * rnd() - 1), r = Math.pow(rnd(), 0.5) * RR * 0.13;
        put(rings, i, rx + r * Math.sin(b) * Math.cos(a), ry + r * Math.sin(b) * Math.sin(a), r * Math.cos(b), RED);
        continue;
      }
      const a = rnd() * Math.PI * 2;
      const r = RR * (0.34 + k * 0.16) + gauss() * 0.035;
      const tilt = 0.5 + k * 0.28, spin = k * 0.9;
      const x = Math.cos(a) * r, y = Math.sin(a) * r * Math.cos(tilt), z = Math.sin(a) * r * Math.sin(tilt);
      put(rings, i, rx + x * Math.cos(spin) - y * Math.sin(spin), ry + x * Math.sin(spin) + y * Math.cos(spin), z, k % 2 ? GOLD : INK, k);
    }
    shapes.rings = rings;
  }

  const geo = new THREE.BufferGeometry();
  const attr = (name: string, size: number, arr?: Float32Array) => {
    const a = new THREE.BufferAttribute(arr ?? new Float32Array(N * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(name, a);
    return a;
  };
  attr('position', 3); // unused by the shader, required by three
  const aFrom = attr('aFrom', 3), aTo = attr('aTo', 3), aColFrom = attr('aColFrom', 3), aColTo = attr('aColTo', 3), aTagTo = attr('aTagTo', 1);
  attr('aRand', 4, rand);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e3);

  const uniforms = {
    uMix: { value: 0 }, uTime: { value: 0 }, uSizeFrom: { value: fineSize }, uSizeTo: { value: fineSize }, uHi: { value: -1 }, uFade: { value: 1 }, uDim: { value: 1 },
    uMouse: { value: new THREE.Vector2(99, 99) }, uAccent: { value: new THREE.Vector3(...RED) }, uHiMix: { value: DARK ? 0.82 : 0.55 }, uReveal: { value: opts.reduced ? 2 : 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthTest: false, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let curFrom: ShapeName | '' = '', curTo: ShapeName | '' = '';
  const load = (from: ShapeName, to: ShapeName) => {
    if (from !== curFrom) { (aFrom.array as Float32Array).set(shapes[from].pos); (aColFrom.array as Float32Array).set(shapes[from].col); aFrom.needsUpdate = aColFrom.needsUpdate = true; uniforms.uSizeFrom.value = shapes[from].size; curFrom = from; }
    if (to !== curTo) { (aTo.array as Float32Array).set(shapes[to].pos); (aColTo.array as Float32Array).set(shapes[to].col); (aTagTo.array as Float32Array).set(shapes[to].tag); aTo.needsUpdate = aColTo.needsUpdate = aTagTo.needsUpdate = true; uniforms.uSizeTo.value = shapes[to].size; curTo = to; }
  };

  const size = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    W = H * camera.aspect;
    build();
    const f = (curFrom || 'dust') as ShapeName, t = (curTo || 'portrait') as ShapeName;
    curFrom = curTo = '';
    load(f, t);
    layoutFns.forEach((fn) => fn());
  };
  size();
  let rt = 0, lastW = innerWidth;
  const onResize = () => {
    // phones fire resize when the address bar hides; only rebuild on real changes
    if (mobile && innerWidth === lastW) { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); return; }
    lastW = innerWidth;
    clearTimeout(rt); rt = window.setTimeout(size, 180);
  };
  addEventListener('resize', onResize);

  // pointer in world units
  const target = new THREE.Vector2(99, 99);
  const onMove = (e: PointerEvent) => { target.set((e.clientX / innerWidth - 0.5) * W, -(e.clientY / innerHeight - 0.5) * H); };
  const onLeave = () => target.set(99, 99);
  if (!mobile) { addEventListener('pointermove', onMove, { passive: true }); document.addEventListener('pointerleave', onLeave); }

  let raf = 0, running = true;
  const t0 = performance.now();
  const tick = () => {
    if (!running) return;
    uniforms.uTime.value = (performance.now() - t0) / 1000;
    const m = uniforms.uMouse.value;
    if (target.x > 50) m.set(99, 99); else if (m.x > 50) m.copy(target); else m.lerp(target, 0.12);
    // a little parallax so the field has depth
    const px = target.x > 50 ? 0 : target.x / W, py = target.x > 50 ? 0 : target.y / H;
    points.rotation.y += (px * 0.12 - points.rotation.y) * 0.05;
    points.rotation.x += (-py * 0.08 - points.rotation.x) * 0.05;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { cancelAnimationFrame(raf); tick(); } });
  tick();

  return {
    anchors,
    setMorph(from, to, mix) { load(from, to); uniforms.uMix.value = mix; },
    highlight(tag) { uniforms.uHi.value = tag; },
    setTheme(t) { applyPalette(t); uniforms.uAccent.value.set(RED[0], RED[1], RED[2]); uniforms.uHiMix.value = DARK ? 0.82 : 0.55; size(); },
    fade(a) { uniforms.uFade.value = a; },
    dim(a) { uniforms.uDim.value = a; },
    portraitBox(which) {
      const b = boxes[which];
      return { x: (b.cx / W + 0.5) * innerWidth, y: (0.5 - b.cy / H) * innerHeight, size: (b.size / H) * innerHeight };
    },
    onLayout(fn) { layoutFns.push(fn); fn(); },
    reveal(seconds, delay) {
      const start = performance.now() + delay * 1000;
      const step = () => {
        const k = Math.min(1, Math.max(0, (performance.now() - start) / (seconds * 1000)));
        uniforms.uReveal.value = k * 2;
        if (k < 1) requestAnimationFrame(step);
      };
      step();
    },
    destroy() { running = false; cancelAnimationFrame(raf); removeEventListener('resize', onResize); renderer.dispose(); },
  };
}

/** World units → CSS pixels, for placing labels on particle anchors. */
export const toScreen = (p: { x: number; y: number }) => {
  const H = 2 * 10 * Math.tan((50 * Math.PI) / 360);
  const W = H * (innerWidth / innerHeight);
  return { left: (p.x / W + 0.5) * innerWidth, top: (0.5 - p.y / H) * innerHeight };
};
