// Insula Deserta: Империя — процедурные 3D-модели RPG (three.js r187).
// Реалистичный облик: Рим, Карфаген, варвары, Египет. Без мистики.
// Соглашения: начало координат модели — центр на уровне земли, +Z — «вперёд» (лицо персонажа, нос корабля).
// Простые матовые материалы берутся через M(color) (roughness 0.9, metalness 0) — клиент склеивает их в цвета вершин.
import * as THREE from 'three';
import { VLight, VLIGHTS, LABEL_LAYER, makeLabel, makeCloud, M, mesh } from './model_utils.js';
export { VLight, VLIGHTS, LABEL_LAYER, makeLabel, makeCloud, M, mesh };

// ======================================================================
// Общие утилиты
// ======================================================================
const PI = Math.PI, TAU = Math.PI * 2, HPI = Math.PI / 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const seg = (k, a, b) => ease((k - a) / (b - a));
const fract = (x) => x - Math.floor(x);
// детерминированный генератор случайных чисел (одинаковые модели у всех игроков)
function rng(seed = 1) {
  let s = (typeof seed === 'string' ? [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) : seed | 0) >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash3 = (x, y, z) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);

// ---------- кэш геометрий ----------
const GC = new Map();
const G = (k, fn) => { let g = GC.get(k); if (!g) { g = fn(); GC.set(k, g); } return g; };
const box = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, s = 12, open = false) => G(`c${rt},${rb},${h},${s},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open));
const sph = (r, ws = 16, hs = 12) => G(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const hemi = (r, ws = 16, hs = 8) => G(`h${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs, 0, TAU, 0, HPI));
const cone = (r, h, s = 12) => G(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const tor = (R, r, rs = 6, ts = 20, arc = TAU) => G(`t${R},${r},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc));
const ico = (r, d = 0) => G(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
const oct = (r) => G(`o${r}`, () => new THREE.OctahedronGeometry(r, 0));
const dod = (r) => G(`d${r}`, () => new THREE.DodecahedronGeometry(r, 0));
const lathe = (key, pts, s = 16) => G(`l${key}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), s));
// брусок со скошенными рёбрами (имитация фаски)
const rbox = (w, h, d, b = 0.02) => G(`rb${w},${h},${d},${b}`, () => {
  b = Math.min(b, w / 3, h / 3, d / 3);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + b, -h / 2 + b); s.lineTo(w / 2 - b, -h / 2 + b); s.lineTo(w / 2 - b, h / 2 - b); s.lineTo(-w / 2 + b, h / 2 - b); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  g.computeVertexNormals();
  return g;
});
// плоская фигура из контура (точки XY), выдавленная по Z на толщину t, с фаской
function extr(key, pts, t, bev = 0, holes = null, curveSeg = 8) {
  return G(`x${key}`, () => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    if (holes) for (const h of holes) s.holes.push(h instanceof THREE.Path ? h : new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, t - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: curveSeg });
    g.translate(0, 0, -Math.max(0.001, t - 2 * bev) / 2);
    return g;
  });
}
// трубка вдоль кривой с сужением к концу
function tube(key, pts, r0, r1 = r0, ts = 12, rs = 6) {
  return G(`tu${key}`, () => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, ts, 1, rs, false);
    // сужение: радиус от r0 к r1 вдоль трубки
    const pos = g.attributes.position, n = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i <= ts; i++) {
      const c = curve.getPointAt(i / ts), r = lerp(r0, r1, i / ts);
      for (let j = 0; j <= rs; j++) {
        const idx = i * (rs + 1) + j;
        p.fromBufferAttribute(pos, idx); n.copy(p).sub(c).multiplyScalar(r).add(c);
        pos.setXYZ(idx, n.x, n.y, n.z);
      }
    }
    g.computeVertexNormals();
    return g;
  });
}
// «бугристость» для камней и крон: смещение вершин по хэшу положения (шов не рвётся)
function lumpy(geo, amt, seed = 1, sy = 1) {
  const g = geo.clone(), pos = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const h = hash3(Math.round(v.x * 100) + seed, Math.round(v.y * 100), Math.round(v.z * 100));
    const k = 1 + (h - 0.5) * 2 * amt;
    pos.setXYZ(i, v.x * k, v.y * k * sy, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}
// мировые UV: 1 единица UV = 1 метр (для текстур черепицы, камня, досок)
function wuv(geo, s = 1) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / s; uv[i * 2 + 1] = v / s;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
const tbox = (w, h, d) => G(`tb${w},${h},${d}`, () => wuv(new THREE.BoxGeometry(w, h, d)));
const tcyl = (rt, rb, h, s = 16) => G(`tc${rt},${rb},${h},${s}`, () => {
  const g = new THREE.CylinderGeometry(rt, rb, h, s, 1);
  // по окружности — развёртка в метрах
  const pos = g.attributes.position, uv = g.attributes.uv, nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(nor.getY(i)) > 0.9) uv.setXY(i, pos.getX(i), pos.getZ(i));
    else uv.setXY(i, uv.getX(i) * TAU * Math.max(rt, rb), pos.getY(i));
  }
  return g;
});
// изгиб бруска по дуге (для изогнутых щитов): x → угол на окружности радиуса R
function bendX(geo, R) {
  const g = geo.clone(), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), a = x / R, rr = R + z;
    pos.setXYZ(i, Math.sin(a) * rr, pos.getY(i), Math.cos(a) * rr - R);
  }
  g.computeVertexNormals();
  return g;
}
// раскраска геометрии цветами вершин по функции (x,y,z) → THREE.Color
function paint(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { fn(pos.getX(i), pos.getY(i), pos.getZ(i), c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ---------- сборка ----------
function P(par, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  if (sx !== 1 || sy !== 1 || sz !== 1) m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true;
  if (par) par.add(m);
  return m;
}
function grp(par, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); if (rx || ry || rz) g.rotation.set(rx, ry, rz);
  if (par) par.add(g);
  return g;
}
const noShadow = (o) => { o.traverse((c) => { c.castShadow = false; }); return o; };

// ---------- материалы ----------
const MET = (c, r = 0.35, m = 0.85) => M(c, { metalness: m, roughness: r });
const FLAME = () => M(0xffa030, { emissive: 0xff7010, emissiveIntensity: 3.5 });
const FLAME2 = () => M(0xfff0b0, { emissive: 0xffd060, emissiveIntensity: 4 });
const EMB = () => M(0xff5a10, { emissive: 0xff3a00, emissiveIntensity: 2.4 });
const C = {
  plaster: 0xebe0c6, plasterW: 0xf3ecdc, dado: 0x9a2c22, ochre: 0xc89a48, tile: 0xb4553a, tileD: 0x8e3d2a,
  wood: 0x8a5a32, woodD: 0x5b3a1f, woodL: 0xb48a58, stone: 0xd8cbad, stoneD: 0xa99b7f, marble: 0xf2eee4,
  bronze: 0xb08d3c, iron: 0x7f858c, steel: 0xc6ccd2, gold: 0xd9b23f, leather: 0x6b4423, leatherD: 0x4a2e18,
  linen: 0xe9e1cc, sand: 0xdcc08a, thatch: 0xb99c5a, rope: 0xb8a070, terracotta: 0xb8643c, clay: 0xa8573a,
  water: 0x2d8fa6, grass: 0x6f9a3a, leaf: 0x5a7f2c, dark: 0x1c1712, purple: 0x5e1f5a, punic: 0x3a2a6a,
};
const bronzeM = () => MET(C.bronze, 0.38, 0.85);
const ironM = () => MET(C.iron, 0.5, 0.75);
const steelM = () => MET(C.steel, 0.3, 0.9);
const goldM = () => MET(C.gold, 0.28, 0.95);

// ---------- процедурные текстуры (маленькие, кэшируются) ----------
const TEX = new Map();
function canvasTex(key, size, draw, meters = 2, alpha = false) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size, rng(key));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.repeat.set(1 / meters, 1 / meters);
  t.userData.alpha = alpha;
  TEX.set(key, t);
  return t;
}
const shade = (base, k) => { const c = new THREE.Color(base); c.multiplyScalar(k); return '#' + c.getHexString(); };
const TEXDRAW = {
  // черепица: тегулы и имбрексы (полосы вниз по скату), ряды по 0.5 м
  tile: (x, n, r) => {
    const cw = n / 4, rh = n / 4;
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      x.fillStyle = shade(0xc0603e, 0.82 + r() * 0.3); x.fillRect(col * cw, row * rh, cw, rh);
      const gr = x.createLinearGradient(0, row * rh, 0, row * rh + rh);
      gr.addColorStop(0, 'rgba(255,220,180,0.10)'); gr.addColorStop(0.85, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,10,0,0.45)');
      x.fillStyle = gr; x.fillRect(col * cw, row * rh, cw, rh);
    }
    for (let col = 0; col <= 4; col++) {
      const cx = col * cw;
      const gr = x.createLinearGradient(cx - 9, 0, cx + 9, 0);
      gr.addColorStop(0, 'rgba(60,15,5,0.7)'); gr.addColorStop(0.3, shade(0xb0553a, 1)); gr.addColorStop(0.55, shade(0xd88a64, 1)); gr.addColorStop(1, 'rgba(60,15,5,0.8)');
      x.fillStyle = gr; x.fillRect(cx - 9, 0, 18, n);
      for (let row = 0; row < 4; row++) { x.fillStyle = 'rgba(50,12,4,0.55)'; x.fillRect(cx - 9, row * rh + rh - 3, 18, 3); }
    }
  },
  // тёсаный камень: ряды блоков 0.5 × 1 м вперевязку
  ashlar: (x, n, r) => {
    x.fillStyle = '#9a8f7c'; x.fillRect(0, 0, n, n);
    const bh = n / 4, bw = n / 2;
    for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) {
      const ox = (row % 2) * bw / 2 + col * bw;
      x.fillStyle = shade(0xe2d6bb, 0.84 + r() * 0.22); x.fillRect(ox + 2, row * bh + 2, bw - 4, bh - 4);
      for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,250,235' : '90,75,55'},${0.08 + r() * 0.12})`; x.fillRect(ox + 4 + r() * (bw - 10), row * bh + 4 + r() * (bh - 10), 2 + r() * 4, 1 + r() * 3); }
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(ox + 2, row * bh + 2, bw - 4, 2);
      x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(ox + 2, row * bh + bh - 4, bw - 4, 2);
    }
  },
  // доски: вдоль u, ширина 0.25 м, с волокнами и стыками
  plank: (x, n, r) => {
    const ph = n / 8;
    for (let i = 0; i < 8; i++) {
      x.fillStyle = shade(0xa77a4c, 0.78 + r() * 0.3); x.fillRect(0, i * ph, n, ph);
      for (let k = 0; k < 7; k++) { x.strokeStyle = `rgba(60,35,15,${0.15 + r() * 0.2})`; x.lineWidth = 1; x.beginPath(); const y = i * ph + 3 + r() * (ph - 6); x.moveTo(0, y); x.bezierCurveTo(n * 0.3, y + r() * 4 - 2, n * 0.6, y + r() * 4 - 2, n, y); x.stroke(); }
      x.fillStyle = 'rgba(30,15,5,0.6)'; x.fillRect(0, i * ph, n, 2);
      const j = r() * n; x.fillRect(j, i * ph, 2, ph);
      x.fillStyle = 'rgba(20,10,0,0.7)'; x.fillRect(j + 5, i * ph + ph / 2 - 1, 2, 2); x.fillRect(j - 6, i * ph + ph / 2 - 1, 2, 2);
    }
  },
  // кирпичная кладка opus latericium
  brick: (x, n, r) => {
    x.fillStyle = '#cdbfa5'; x.fillRect(0, 0, n, n);
    const bh = n / 32, bw = n / 6;
    for (let row = 0; row < 32; row++) for (let col = -1; col < 7; col++) {
      const ox = col * bw + (row % 2) * bw / 2;
      x.fillStyle = shade(0xb2603c, 0.75 + r() * 0.35); x.fillRect(ox + 1, row * bh + 1, bw - 2, bh - 2);
    }
  },
  // солома
  thatch: (x, n, r) => {
    x.fillStyle = '#8e7440'; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 900; i++) {
      const px = r() * n, py = r() * n, l = 10 + r() * 22;
      x.strokeStyle = shade(0xc8aa62, 0.65 + r() * 0.5); x.lineWidth = 1 + r() * 1.5;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 4, py + l); x.stroke();
    }
    for (let row = 1; row < 4; row++) { x.fillStyle = 'rgba(40,25,5,0.35)'; x.fillRect(0, row * n / 4 - 2, n, 3); }
  },
  // египетская роспись: фризы и «иероглифические» колонки
  paint: (x, n, r) => {
    x.fillStyle = '#d9c08a'; x.fillRect(0, 0, n, n);
    const band = (y, h, cols) => { const w = n / cols.length / 2; for (let i = 0; i < cols.length * 2; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(i * w, y, w, h); } };
    band(0, 10, ['#1f4f9a', '#c8a030', '#a8321e', '#2f7a5a']); band(n - 14, 14, ['#1f4f9a', '#c8a030', '#a8321e', '#2f7a5a']);
    x.fillStyle = '#1b1b1b'; x.fillRect(0, 10, n, 2); x.fillRect(0, n - 16, n, 2);
    // колонки знаков
    for (let c = 0; c < 8; c++) {
      const cx = c * n / 8 + 4; x.fillStyle = 'rgba(40,30,20,0.6)'; x.fillRect(cx - 3, 16, 1, n - 36); x.fillRect(cx + n / 8 - 5, 16, 1, n - 36);
      for (let k = 0; k < 7; k++) {
        const y = 22 + k * 30, t = (r() * 6) | 0, w = n / 8 - 12;
        x.fillStyle = ['#1f3f8a', '#a8321e', '#2a2a2a', '#2f7a5a', '#b88a20'][(r() * 5) | 0];
        x.strokeStyle = x.fillStyle; x.lineWidth = 2;
        if (t === 0) { x.beginPath(); x.arc(cx + w / 2 + 2, y + 10, 7, 0, TAU); x.stroke(); x.fillRect(cx + w / 2, y + 9, 4, 3); }       // солнце
        else if (t === 1) { x.beginPath(); x.ellipse(cx + w / 2 + 2, y + 10, 9, 5, 0, 0, TAU); x.stroke(); x.beginPath(); x.arc(cx + w / 2 + 2, y + 10, 2.5, 0, TAU); x.fill(); } // глаз
        else if (t === 2) { x.beginPath(); for (let i = 0; i < 4; i++) { x.moveTo(cx + 3, y + 4 + i * 5); x.lineTo(cx + w, y + 4 + i * 5); } x.stroke(); }  // вода
        else if (t === 3) { x.beginPath(); x.ellipse(cx + w / 2, y + 12, 8, 6, 0, 0, TAU); x.fill(); x.fillRect(cx + w / 2 + 5, y + 2, 3, 8); x.fillRect(cx + w / 2 - 6, y + 17, 3, 8); } // птица
        else if (t === 4) { x.fillRect(cx + w / 2, y + 2, 3, 22); x.beginPath(); x.arc(cx + w / 2 + 1.5, y + 6, 5, 0, TAU); x.stroke(); x.fillRect(cx + w / 2 - 6, y + 11, 15, 3); } // анх
        else { x.fillRect(cx + 4, y + 16, w - 6, 5); x.beginPath(); x.arc(cx + w / 2, y + 10, 6, PI, 0); x.fill(); } // корзина/полукруг
      }
    }
  },
  // колосья (с прозрачностью): стебли и колосья по всей ширине
  crop: (x, n, r) => {
    x.clearRect(0, 0, n, n);
    for (let i = 0; i < 70; i++) {
      const px = r() * n, h = n * (0.55 + r() * 0.4), lean = (r() - 0.5) * 16;
      x.strokeStyle = shade(0xd8c890, 0.7 + r() * 0.4); x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(px, n); x.quadraticCurveTo(px + lean * 0.3, n - h * 0.5, px + lean, n - h); x.stroke();
      x.fillStyle = shade(0xf0e0a0, 0.75 + r() * 0.35);
      x.beginPath(); x.ellipse(px + lean, n - h - 6, 2.6, 9, lean * 0.02, 0, TAU); x.fill();
    }
  },
  // сеть (с прозрачностью)
  net: (x, n) => {
    x.clearRect(0, 0, n, n); x.strokeStyle = '#e8dcc0'; x.lineWidth = 2;
    for (let i = -n; i < n * 2; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + n, n); x.stroke(); x.beginPath(); x.moveTo(i, n); x.lineTo(i + n, 0); x.stroke(); }
  },
  // кольчуга
  mail: (x, n) => {
    x.fillStyle = '#4a4d50'; x.fillRect(0, 0, n, n);
    for (let row = 0; row < 16; row++) for (let col = 0; col < 16; col++) {
      const cx = col * n / 16 + (row % 2) * n / 32, cy = row * n / 16;
      x.strokeStyle = '#b8bec4'; x.lineWidth = 1.6; x.beginPath(); x.arc(cx, cy, n / 40, 0, TAU); x.stroke();
    }
  },
  // чешуя
  scale: (x, n) => {
    x.fillStyle = '#3a3020'; x.fillRect(0, 0, n, n);
    const s = n / 8;
    for (let row = 9; row >= -1; row--) for (let col = -1; col < 9; col++) {
      const cx = col * s + (row % 2) * s / 2, cy = row * s * 0.7;
      const gr = x.createLinearGradient(cx, cy, cx, cy + s); gr.addColorStop(0, '#e8d08a'); gr.addColorStop(1, '#8a6a2a');
      x.fillStyle = gr; x.beginPath(); x.moveTo(cx - s / 2, cy); x.lineTo(cx + s / 2, cy); x.lineTo(cx + s / 2, cy + s * 0.5); x.quadraticCurveTo(cx, cy + s * 1.15, cx - s / 2, cy + s * 0.5); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(40,25,5,0.8)'; x.lineWidth = 1; x.stroke();
    }
  },
  // знамя SPQR
  spqr: (x, n) => {
    x.fillStyle = '#8e1a14'; x.fillRect(0, 0, n, n);
    x.strokeStyle = '#d8b040'; x.lineWidth = 8; x.strokeRect(10, 10, n - 20, n - 20);
    x.fillStyle = '#e8c450'; x.font = `bold ${n / 4.2}px Georgia`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SPQR', n / 2, n / 2);
    for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(n * (0.2 + i * 0.15), n * 0.82, 6, 0, TAU); x.fill(); }
    x.beginPath(); x.moveTo(n / 2, n * 0.12); x.lineTo(n * 0.43, n * 0.27); x.lineTo(n * 0.57, n * 0.27); x.closePath(); x.fill();
  },
};
function T(key) {
  const size = { mail: 64, scale: 128, crop: 128, net: 128, spqr: 128, nemes: 64, flax: 128 }[key] || 256;
  const meters = { tile: 2, ashlar: 2, plank: 2, brick: 2, thatch: 2, paint: 2, crop: 1.2, flax: 1.2, net: 0.6, mail: 1, scale: 1, spqr: 1, scutum: 1, nemes: 1 }[key] || 2;
  return canvasTex(key, size, TEXDRAW[key], meters, key === 'crop' || key === 'net' || key === 'flax');
}
const TMC = new Map();
// текстурный материал (кэш по текстуре + цвету + опциям)
function TM(key, color = 0xffffff, opts = {}) {
  const k = key + color + JSON.stringify(opts);
  if (!TMC.has(k)) {
    const tex = T(key);
    const o = { map: tex, color, roughness: 0.9, metalness: 0, ...opts };
    if (tex.userData.alpha) { o.alphaTest = 0.45; o.side = THREE.DoubleSide; }
    TMC.set(k, new THREE.MeshStandardMaterial(o));
  }
  return TMC.get(k);
}
const ASH = () => TM('ashlar');
const TILE = () => TM('tile');
const PLANK = () => TM('plank');
const BRICK = () => TM('brick');
const THATCH = () => TM('thatch');

// ======================================================================
// Общие предметы-«реквизит» (используются в зданиях, точках интереса, добыче)
// ======================================================================
function amphora(par, x = 0, y = 0, z = 0, s = 1, col = C.terracotta, tilt = 0) {
  const g = grp(par, x, y, z, tilt, 0, 0);
  const geo = lathe('amph', [[0, 0], [0.03, 0.02], [0.07, 0.14], [0.17, 0.42], [0.19, 0.55], [0.17, 0.66], [0.07, 0.78], [0.055, 0.86], [0.055, 0.98], [0.07, 1.0], [0.06, 1.02], [0, 1.02]], 14);
  P(g, geo, M(col), 0, 0, 0).scale.setScalar(s * 0.62);
  for (const sx of [-1, 1]) P(g, tor(0.07, 0.014, 5, 8, PI), M(col), sx * 0.075 * s, 0.53 * s, 0, 0, 0, sx > 0 ? -1.2 : 1.2 + PI).scale.setScalar(s);
  return g;
}
function dolium(par, x, y, z, s = 1) {
  const g = grp(par, x, y, z);
  P(g, lathe('dol', [[0, 0], [0.18, 0.02], [0.38, 0.25], [0.45, 0.55], [0.4, 0.88], [0.24, 1.0], [0.26, 1.05], [0, 1.05]], 16), M(0xa65a36), 0, 0, 0).scale.setScalar(s);
  return g;
}
function crate(par, x, y, z, s = 1, ry = 0) {
  const g = grp(par, x, y, z, 0, ry, 0);
  P(g, rbox(0.8 * s, 0.6 * s, 0.6 * s, 0.03 * s), M(0x9a7044), 0, 0.3 * s, 0);
  const d = M(0x6e4a28);
  for (const sx of [-1, 1]) P(g, box(0.06 * s, 0.62 * s, 0.62 * s), d, sx * 0.37 * s, 0.3 * s, 0);
  P(g, box(0.82 * s, 0.06 * s, 0.62 * s), d, 0, 0.3 * s, 0);
  const diag = P(g, box(0.05 * s, 0.75 * s, 0.02), d, 0, 0.3 * s, 0.305 * s); diag.rotation.z = 0.9;
  return g;
}
function sack(par, x, y, z, s = 1, col = 0xc8b48a, ry = 0) {
  const g = grp(par, x, y, z, 0, ry, 0);
  P(g, G('sackG', () => lumpy(new THREE.SphereGeometry(0.28, 10, 8), 0.08, 3)), M(col), 0, 0.24 * s, 0, 0, 0, 0, s * 1.0, s * 0.9, s * 0.8);
  P(g, cyl(0.06, 0.1, 0.12, 8), M(col), 0, 0.5 * s, 0).scale.setScalar(s);
  P(g, tor(0.065, 0.015, 4, 10), M(C.rope), 0, 0.5 * s, 0, HPI).scale.setScalar(s);
  return g;
}
function barrel(par, x, y, z, s = 1) {
  const g = grp(par, x, y, z);
  P(g, lathe('barrel', [[0, 0], [0.26, 0], [0.31, 0.2], [0.32, 0.4], [0.31, 0.6], [0.26, 0.8], [0, 0.8]], 14), M(0x8a6038), 0, 0, 0).scale.setScalar(s);
  for (const yy of [0.12, 0.68]) P(g, tor(0.295, 0.012, 4, 16), ironM(), 0, yy * s, 0, HPI).scale.setScalar(s);
  return g;
}
function logPile(par, x, y, z, n = 6, len = 2.2, ry = 0, col = 0x7a5534) {
  const g = grp(par, x, y, z, 0, ry, 0);
  const bark = M(col), end = M(0xc8a070);
  let i = 0;
  for (let row = 0; i < n; row++) for (let k = 0; k < 4 - row && i < n; k++, i++) {
    const xx = (k - (3 - row) / 2) * 0.3, yy = 0.15 + row * 0.26;
    P(g, cyl(0.14, 0.15, len, 8), bark, xx, yy, 0, HPI);
    for (const sz of [-1, 1]) P(g, cyl(0.12, 0.12, 0.01, 8), end, xx, yy, sz * len / 2, HPI);
  }
  return g;
}
function plankStack(par, x, y, z, n = 6, ry = 0) {
  const g = grp(par, x, y, z, 0, ry, 0);
  const m = M(0xb98a56);
  for (let i = 0; i < n; i++) P(g, box(0.26, 0.05, 2.0), m, (i % 3 - 1) * 0.28, 0.05 + Math.floor(i / 3) * 0.06 + 0.04, 0);
  for (const zz of [-0.8, 0.8]) P(g, box(0.9, 0.06, 0.08), M(C.woodD), 0, 0.03, zz);
  return g;
}
function brickStack(par, x, y, z, ry = 0) {
  const g = grp(par, x, y, z, 0, ry, 0);
  P(g, box(0.9, 0.5, 0.6), BRICK(), 0, 0.25, 0);
  P(g, box(1.0, 0.06, 0.7), M(C.woodD), 0, 0.03, 0);
  return g;
}
function stoneBlocks(par, x, y, z, n = 4, ry = 0) {
  const g = grp(par, x, y, z, 0, ry, 0);
  const r = rng(n * 13 + 7);
  for (let i = 0; i < n; i++) {
    const w = 0.6 + r() * 0.4;
    P(g, rbox(w, 0.45, 0.5, 0.03), M(i % 2 ? C.stone : 0xcfc2a2), (i % 2) * 0.7 - 0.35, 0.225 + Math.floor(i / 2) * 0.46, (r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.2, 0);
  }
  return g;
}
// жаровня на треноге с огнём и «виртуальным» светом
function brazier(par, x, y, z, s = 1, lightI = 6, lightD = 12) {
  const g = grp(par, x, y, z);
  const br = bronzeM();
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; const l = P(g, cyl(0.02, 0.025, 0.95, 5), br, Math.cos(a) * 0.17 * s, 0.45 * s, Math.sin(a) * 0.17 * s); l.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); l.scale.setScalar(s); }
  P(g, lathe('brazB', [[0.05, 0], [0.22, 0.08], [0.3, 0.2], [0.27, 0.22], [0, 0.12]], 14), br, 0, 0.88 * s, 0).scale.setScalar(s);
  P(g, ico(0.16, 0), EMB(), 0, 1.06 * s, 0, 0, 0, 0, s, s * 0.5, s);
  const f = P(g, cone(0.18, 0.5, 7), FLAME(), 0, 1.3 * s, 0); f.scale.setScalar(s); f.castShadow = false;
  const f2 = P(g, cone(0.1, 0.32, 6), FLAME2(), 0, 1.24 * s, 0); f2.scale.setScalar(s); f2.castShadow = false;
  const l = new VLight(0xff9a40, lightI, lightD, 1.6); l.position.set(0, 1.6 * s, 0); g.add(l);
  g.userData.flame = f; g.userData.light = l;
  return g;
}
function bench(par, x, y, z, len = 1.6, ry = 0) {
  const g = grp(par, x, y, z, 0, ry, 0);
  P(g, rbox(len, 0.07, 0.36, 0.015), M(C.woodL), 0, 0.45, 0);
  for (const sx of [-1, 1]) P(g, box(0.07, 0.42, 0.3), M(C.wood), sx * (len / 2 - 0.12), 0.21, 0);
  return g;
}
function table(par, x, y, z, w = 1.2, d = 0.7, ry = 0) {
  const g = grp(par, x, y, z, 0, ry, 0);
  P(g, rbox(w, 0.06, d, 0.015), M(C.woodL), 0, 0.76, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(g, box(0.06, 0.74, 0.06), M(C.wood), sx * (w / 2 - 0.07), 0.37, sz * (d / 2 - 0.07));
  return g;
}
function cart(par, x, y, z, ry = 0, load = 'sacks') {
  const g = grp(par, x, y, z, 0, ry, 0);
  const w = M(C.wood), wd = M(C.woodD);
  P(g, box(1.3, 0.08, 2.0), w, 0, 0.72, 0);
  for (const sx of [-1, 1]) P(g, box(0.06, 0.32, 2.0), wd, sx * 0.62, 0.92, 0);
  P(g, box(1.3, 0.32, 0.06), wd, 0, 0.92, -0.97);
  for (const sx of [-1, 1]) {
    const wh = grp(g, sx * 0.78, 0.55, -0.1, 0, 0, HPI);
    P(wh, tor(0.5, 0.05, 6, 20), wd, 0, 0, 0, HPI);
    P(wh, cyl(0.09, 0.09, 0.16, 8), wd, 0, 0, 0);
    for (let i = 0; i < 4; i++) P(wh, box(0.96, 0.04, 0.04), w, 0, 0, 0, 0, (i * PI) / 4, 0);
  }
  P(g, cyl(0.04, 0.04, 1.8, 6), wd, 0.0, 0.5, 1.9, 1.35);
  for (const sx of [-1, 1]) P(g, box(0.06, 0.06, 1.7), wd, sx * 0.3, 0.6, 1.6, 0.25);
  if (load === 'sacks') for (let i = 0; i < 4; i++) sack(g, (i % 2 - 0.5) * 0.55, 0.76, (Math.floor(i / 2) - 0.5) * 0.8, 1, 0xd2be92, i);
  else if (load === 'amph') for (let i = 0; i < 4; i++) amphora(g, (i % 2 - 0.5) * 0.5, 1.0, (Math.floor(i / 2) - 0.5) * 0.8, 0.9, C.terracotta, HPI * 0.95);
  else if (load === 'logs') logPile(g, 0, 0.76, 0, 5, 1.9);
  return g;
}
// знамя SPQR (вексиллум) на шесте с перекладиной
function banner(par, x, y, z, h = 3.2, ry = 0, tex = 'spqr', col = 0xffffff) {
  const g = grp(par, x, y, z, 0, ry, 0);
  P(g, cyl(0.035, 0.04, h, 6), M(C.woodD), 0, h / 2, 0);
  P(g, cyl(0.025, 0.025, 0.9, 5), M(C.woodD), 0, h - 0.2, 0, 0, 0, HPI);
  P(g, cone(0.05, 0.14, 6), bronzeM(), 0, h + 0.07, 0);
  const cl = P(g, G('banQ', () => { const q = new THREE.PlaneGeometry(0.8, 1.0, 1, 4); const p = q.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 3) * 0.03); q.computeVertexNormals(); return q; }), tex ? TM(tex, col, { side: THREE.DoubleSide }) : M(col, { side: THREE.DoubleSide }), 0, h - 0.72, 0.02);
  for (let i = 0; i < 5; i++) P(g, cyl(0.012, 0.012, 0.14, 4), M(C.gold), -0.32 + i * 0.16, h - 1.29, 0.02);
  g.userData.cloth = cl;
  return g;
}
// классическая колонна: база, ствол с энтазисом, капитель (tuscan | ionic | corinth)
function column(par, x, y, z, h, r, order = 'tuscan', mat = null) {
  const g = grp(par, x, y, z);
  const m = mat || M(C.marble);
  P(g, box(r * 2.5, r * 0.4, r * 2.5), m, 0, r * 0.2, 0);
  P(g, cyl(r * 1.1, r * 1.18, r * 0.32, 12), m, 0, r * 0.56, 0);
  const sh = h - r * 1.7;
  P(g, cyl(r * 0.86, r, sh, 12), m, 0, r * 0.72 + sh / 2, 0);
  const top = r * 0.72 + sh;
  if (order === 'corinth') {
    P(g, cyl(r * 1.22, r * 0.88, r * 0.85, 12), m, 0, top + r * 0.42, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; P(g, cone(r * 0.26, r * 0.6, 4), m, Math.cos(a) * r * 1.0, top + r * 0.35, Math.sin(a) * r * 1.0, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); }
    P(g, box(r * 2.7, r * 0.22, r * 2.7), m, 0, top + r * 0.96, 0);
  } else if (order === 'ionic') {
    P(g, box(r * 2.1, r * 0.3, r * 1.6), m, 0, top + r * 0.15, 0);
    for (const sx of [-1, 1]) P(g, cyl(r * 0.3, r * 0.3, r * 1.7, 8), m, sx * r * 1.0, top + r * 0.05, 0, HPI);
    P(g, box(r * 2.3, r * 0.18, r * 2.0), m, 0, top + r * 0.4, 0);
  } else {
    P(g, cyl(r * 1.15, r * 0.88, r * 0.38, 12), m, 0, top + r * 0.19, 0);
    P(g, box(r * 2.4, r * 0.25, r * 2.4), m, 0, top + r * 0.5, 0);
  }
  return g;
}
// лестница: n ступеней от верхнего уровня y (у начала) вниз вдоль +Z (с поворотом ry); каждая ступень уходит до −1.5 м
function stairs(par, x, y, z, w, n, rise, run, ry = 0, mat = null) {
  const g = grp(par, x, 0, z, 0, ry, 0);
  const m = mat || M(C.stone);
  for (let i = 0; i < n; i++) {
    const top = y - rise * i, hh = top + 1.5;
    P(g, box(w, hh, run), m, 0, top - hh / 2, i * run + run / 2);
  }
  return g;
}
// статуя (простая фигура в тоге на постаменте)
function statue(par, x, y, z, s = 1, mat = null, ry = 0) {
  const g = grp(par, x, y, z, 0, ry, 0);
  const m = mat || M(C.marble);
  P(g, rbox(1.0 * s, 1.3 * s, 1.0 * s, 0.04), M(C.stone), 0, 0.65 * s - 0.0, 0);
  P(g, box(1.15 * s, 0.12 * s, 1.15 * s), M(C.stone), 0, 1.3 * s, 0);
  P(g, box(1.15 * s, 0.12 * s, 1.15 * s), M(C.stone), 0, 0.06 * s, 0);
  const f = grp(g, 0, 1.36 * s, 0); f.scale.setScalar(s * 1.15);
  P(f, lathe('togaS', [[0.2, 0], [0.22, 0.4], [0.2, 0.8], [0.19, 1.1], [0.22, 1.3], [0.2, 1.42], [0.08, 1.48], [0, 1.48]], 12), m, 0, 0, 0).scale.set(1, 1, 0.7);
  P(f, sph(0.11, 12, 10), m, 0, 1.6, 0.01);
  P(f, cyl(0.045, 0.05, 0.1, 8), m, 0, 1.48, 0);
  const ar = P(f, cyl(0.045, 0.04, 0.6, 8), m, -0.23, 1.25, 0.1); ar.rotation.set(-1.1, 0, -0.2);   // поднятая рука (adlocutio)
  P(f, cyl(0.045, 0.04, 0.55, 8), m, 0.22, 1.05, 0.05, 0.1, 0, 0.12);
  const dr = P(f, box(0.12, 0.9, 0.3), m, 0.16, 0.95, 0.02); dr.rotation.z = 0.35;
  return g;
}
function rope(par, a, b, r = 0.012, mat = null) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
  const m = P(par, cyl(r, r, 1, 4), mat || M(C.rope), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.scale.y = len;
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  m.castShadow = false;
  return m;
}

// ======================================================================
// Человек: шарнирная модель (группы с осью в суставах)
// ======================================================================
// Размеры (м): таз на 0.93, бедро 0.42, голень 0.41, лодыжка 0.08 над землёй; плечо 0.29, предплечье до кулака 0.30.
const HUM = { hip: 0.93, L1: 0.42, L2: 0.41, ankle: 0.08, A1: 0.29, A2: 0.3, sh: 0.44, hand0: 2.6 };
const darker = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
// профиль торса (радиус по высоте от талии), сплющивается по Z
const TORSO_PTS = [[0.148, -0.05], [0.152, 0.06], [0.162, 0.18], [0.183, 0.3], [0.192, 0.38], [0.186, 0.44], [0.152, 0.5], [0.08, 0.535], [0.001, 0.545]];
const TORSO_Z = 0.64;
function torsoGeo(key, inflate = 1, y0 = -0.05, y1 = 0.545, wx = 1) {
  return lathe(`torso${key}`, TORSO_PTS.filter(([, y]) => y >= y0 - 1e-6 && y <= y1 + 1e-6).map(([r, y]) => [r * inflate * wx, y]), 16);
}

export function makeHuman(opts = {}) {
  const o = { tunic: 0x9e2a22, skin: 0xd9a77c, hair: 0x3b2a1a, beard: false, female: false, cape: null, ...opts };
  const F = !!o.female;
  const g = new THREE.Group();
  const tun = M(o.tunic), skin = M(o.skin), hairM = M(o.hair), trim = M(darker(o.tunic, 0.62)), leather = M(C.leather);
  const cloth = [], bare = [];
  const body = grp(g, 0, HUM.hip, 0);
  const hips = grp(body);
  const torso = grp(body, 0, 0.04, 0);
  const wx = F ? 0.9 : 1;
  // --- таз и подол туники
  P(hips, sph(0.15, 10, 6), tun, 0, -0.02, 0, 0, 0, 0, wx * 1.02, 0.62, 0.72);
  const skirtLen = F ? 0.5 : 0.38;
  const skirt = P(hips, lathe(`skirt${F}`, [[0.245 * wx, -skirtLen], [0.235 * wx, -skirtLen + 0.06], [0.205 * wx, -0.2], [0.18 * wx, -0.06], [0.165 * wx, 0.07]], 18), tun, 0, 0, 0, 0, 0, 0, 1, 1, 0.78);
  const hem = P(hips, cyl(0.247 * wx, 0.247 * wx, 0.035, 18, true), trim, 0, -skirtLen + 0.015, 0, 0, 0, 0, 1, 1, 0.78);
  cloth.push(skirt, hem);
  const belt = P(hips, cyl(0.168 * wx, 0.168 * wx, 0.045, 18), leather, 0, 0.07, 0, 0, 0, 0, 1, 1, 0.68);
  P(hips, rbox(0.05, 0.04, 0.012, 0.004), bronzeM(), 0, 0.07, 0.118);
  // --- ноги
  const legs = {};
  for (const s of [1, -1]) {
    const leg = grp(hips, s * 0.095 * wx, -0.04, 0);
    P(leg, cyl(0.078, 0.057, HUM.L1, 10, true), skin, 0, -HUM.L1 / 2, 0);
    const shin = grp(leg, 0, -HUM.L1, 0);
    P(shin, sph(0.053, 8, 5), skin, 0, 0, 0.005);
    P(shin, cyl(0.051, 0.035, HUM.L2, 10, true), skin, 0, -HUM.L2 / 2, 0);
    P(shin, sph(0.05, 8, 5), skin, 0, -0.14, -0.016, 0, 0, 0, 0.95, 1.8, 0.95);  // икра
    const foot = grp(shin, 0, -HUM.L2, 0);
    const sandal = grp(foot);   // босая стопа в сандалии (прячется под калигами)
    P(sandal, rbox(0.082, 0.06, 0.2, 0.022), skin, 0, -0.045, 0.05);
    P(sandal, rbox(0.095, 0.022, 0.255, 0.008), M(C.leatherD), 0, -0.071, 0.045);   // подошва сандалии
    P(sandal, cyl(0.043, 0.043, 0.025, 10, true), leather, 0, -0.015, 0);
    P(sandal, box(0.09, 0.012, 0.022), leather, 0, -0.035, 0.1);
    P(sandal, box(0.09, 0.012, 0.022), leather, 0, -0.04, 0.03, 0.3);
    legs['sandal' + (s > 0 ? 'L' : 'R')] = sandal;
    const side = s > 0 ? 'L' : 'R';
    legs['leg' + side] = leg; legs['shin' + side] = shin; legs['foot' + side] = foot;
  }
  // --- торс
  const torM = P(torso, torsoGeo(`b${F}`, 1, -0.05, 0.545, wx), tun, 0, 0, 0, 0, 0, 0, 1, 1, TORSO_Z);
  cloth.push(torM);
  if (F) for (const s of [-1, 1]) cloth.push(P(torso, sph(0.062, 8, 6), tun, s * 0.07, 0.31, 0.085, 0, 0, 0, 1, 0.9, 0.85));
  const neckTrim = P(torso, tor(0.075, 0.016, 4, 12), trim, 0, 0.52, 0.0, HPI, 0, 0, 1, 0.8, 1);
  cloth.push(neckTrim);
  // --- руки
  const arms = {};
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const arm = grp(torso, s * 0.2 * wx, HUM.sh, 0);
    cloth.push(P(arm, sph(0.064, 10, 6), tun, 0, -0.005, 0));
    cloth.push(P(arm, cyl(0.068, 0.062, 0.13, 10, true), tun, 0, -0.065, 0));
    P(arm, cyl(0.047, 0.04, HUM.A1, 10, true), skin, 0, -HUM.A1 / 2, 0);
    const fore = grp(arm, 0, -HUM.A1, 0);
    P(fore, sph(0.041, 6, 4), skin);
    P(fore, cyl(0.04, 0.03, 0.25, 10, true), skin, 0, -0.125, 0);
    const hand = grp(fore, 0, -HUM.A2, 0);
    // кулак: ладонь, костяшки, большой палец (ось хвата — локальная Y кисти)
    const fist = grp(hand, 0, 0, 0, s < 0 ? -HUM.hand0 : 0);
    P(fist, rbox(0.06, 0.07, 0.085, 0.02), skin, 0, 0.02, 0);
    P(fist, cyl(0.026, 0.026, 0.075, 8), skin, 0.0, -0.022, 0.012, 0, 0, HPI);
    P(fist, cyl(0.013, 0.012, 0.05, 6), skin, s * 0.03, 0.01, 0.025, 0.5, 0, s * 0.3);
    if (s < 0) hand.rotation.x = HUM.hand0;
    arms['arm' + side] = arm; arms['fore' + side] = fore; arms['hand' + side] = hand;
  }
  // --- шея и голова
  const neck = grp(torso, 0, 0.5, 0);
  P(neck, cyl(0.047, 0.055, 0.14, 10, true), skin, 0, 0.04, 0);
  const head = grp(neck, 0, 0.1, 0.005);
  buildFace(head, o, skin, hairM);
  // --- плащ
  let cape = null;
  if (o.cape != null) {
    cape = grp(torso, 0, 0.47, -0.12);
    const cm = M(o.cape, { side: THREE.DoubleSide });
    P(cape, G('capeG', () => {
      const q = new THREE.PlaneGeometry(0.5, 1.02, 4, 8); q.translate(0, -0.5, 0);
      const p = q.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setXYZ(i, x * (1 + -y * 0.25), y, -0.05 * Math.cos((x / 0.5) * PI) - 0.02 + Math.sin(x * 18) * 0.008 * -y); }
      q.computeVertexNormals(); return q;
    }), cm, 0, 0, 0);
    P(cape, tor(0.16, 0.03, 6, 14, PI), M(o.cape), 0, 0.0, 0.07, -HPI + 0.2, 0, 0, 1, 1, 0.8);
    P(cape, cyl(0.03, 0.03, 0.015, 10), bronzeM(), -0.17, -0.03, 0.17, HPI);
  }
  g.userData = { body, hips, torso, neck, head, ...arms, ...legs, cape, gear: {}, _cloth: cloth, _bare: bare, _opts: o, _skin: skin };
  return g;
}
const tor_ = (R, r) => tor(R, r, 6, 16);
function buildFace(head, o, skin, hairM) {
  const F = !!o.female;
  const c = 0.11;
  P(head, sph(0.115, 16, 12), skin, 0, c, 0, 0, 0, 0, F ? 0.85 : 0.88, 1.06, 1.0);           // череп
  P(head, sph(0.088, 12, 8), skin, 0, c - 0.055, 0.03, 0, 0, 0, F ? 0.88 : 0.95, 0.85, 0.95); // челюсть и скулы
  P(head, sph(0.035, 6, 5), skin, 0, c - 0.1, 0.08, 0, 0, 0, 1.1, 0.8, 0.8);                    // подбородок
  P(head, box(0.026, 0.055, 0.03), skin, 0, c - 0.012, 0.11, -0.32);                           // нос
  P(head, sph(0.017, 6, 4), skin, 0, c - 0.036, 0.122, 0, 0, 0, 1.2, 0.9, 1);
  for (const s of [-1, 1]) P(head, sph(0.01, 4, 3), skin, s * 0.012, c - 0.04, 0.115);          // крылья носа
  const white = M(0xf0ece2), iris = M(0x2a1d14), brow = M(darker(o.hair, 0.8));
  for (const s of [-1, 1]) {
    P(head, sph(0.016, 6, 4), white, s * 0.036, c + 0.012, 0.095, 0, 0, 0, 1, 0.65, 0.6);
    P(head, sph(0.0085, 5, 3), iris, s * 0.036, c + 0.012, 0.103);
    P(head, box(0.042, 0.009, 0.014), brow, s * 0.037, c + 0.036, 0.104, 0, 0, s * -0.12);
    P(head, sph(0.025, 6, 4), skin, s * 0.1, c - 0.0, 0.0, 0, 0, 0, 0.4, 1.0, 0.7);             // уши
    P(head, sph(0.03, 6, 4), skin, s * 0.05, c - 0.035, 0.08, 0, 0, 0, 1, 0.8, 0.6);            // скулы
  }
  P(head, box(0.036, 0.007, 0.01), M(F ? 0xa04040 : 0x8a4a3a), 0, c - 0.062, 0.104);            // губы
  // волосы: шапочка, наклонённая назад (лоб открыт)
  const hcap = G('hairCap', () => new THREE.SphereGeometry(0.123, 16, 7, 0, TAU, 0, 1.75));
  P(head, hcap, hairM, 0, c + 0.006, -0.008, -0.48, 0, 0, 0.92, 1.04, 1.04);
  if (F) {
    P(head, sph(0.06, 10, 8), hairM, 0, c + 0.01, -0.13);                                        // узел волос
    P(head, sph(0.1, 12, 8), hairM, 0, c - 0.03, -0.05, 0, 0, 0, 0.95, 1.0, 0.75);
    P(head, tor(0.06, 0.012, 5, 12), M(0xd0b060), 0, c + 0.01, -0.12, 0, 0, 0);
  } else {
    for (const s of [-1, 1]) P(head, box(0.012, 0.04, 0.03), hairM, s * 0.098, c - 0.02, 0.03);  // виски
  }
  if (o.beard && !F) {
    const bg = G('beardG', () => new THREE.SphereGeometry(0.1, 16, 6, PI * 0.04, PI * 0.92, 1.72, 1.05));
    P(head, bg, hairM, 0, c - 0.035, 0.02, 0, 0, 0, 1.0, 1.0, 1.1);
    P(head, box(0.065, 0.014, 0.022), hairM, 0, c - 0.05, 0.112, 0.15);                          // усы
    for (const s of [-1, 1]) P(head, box(0.014, 0.06, 0.05), hairM, s * 0.09, c - 0.04, 0.03);
  }
}

// ======================================================================
// Снаряжение
// ======================================================================
const qSteel = (q) => MET(C.steel, q >= 2 ? 0.18 : 0.32, 0.9);
const qBronze = (q) => MET(q >= 2 ? 0xc8a050 : C.bronze, q >= 2 ? 0.22 : 0.4, 0.88);
const qIron = (q) => MET(q >= 2 ? 0x9ba2aa : C.iron, q >= 2 ? 0.25 : 0.48, 0.8);
// клинок: контур (x поперёк, y вдоль), ширина клинка ложится на ось Z кисти
function bladeMesh(par, key, pts, mat, t = 0.008, fuller = null) {
  const b = grp(par, 0, 0, 0, 0, HPI, 0);
  P(b, extr(key, pts, t, t * 0.35), mat);
  if (fuller) P(b, box(fuller[0], fuller[1], t * 1.15), MET(0x8d949b, 0.4, 0.8), 0, fuller[2], 0);
  return b;
}
function hilt(par, q, gripLen = 0.1, guardW = 0.09, pomR = 0.03, gripCol = C.leatherD, guardM = null) {
  const gm = guardM || (q >= 3 ? goldM() : M(0xd8cfb8));
  P(par, cyl(0.016, 0.017, gripLen, 8), M(gripCol), 0, 0, 0);
  for (const i of [-1, 1]) P(par, tor(0.017, 0.004, 3, 8), M(darker(gripCol, 0.7)), 0, i * gripLen * 0.3, 0, HPI);
  P(par, rbox(0.03, 0.026, guardW, 0.008), gm, 0, gripLen / 2 + 0.013, 0);
  P(par, sph(pomR, 8, 5), gm, 0, -gripLen / 2 - pomR * 0.6, 0, 0, 0, 0, 1, 0.75, 1.15);
}
// кривой клинок: средняя линия x = bend * y^2, ширина w(y)
function curvedPts(len, w0, w1, bend, y0 = 0.07, edgeBulge = 0) {
  const L = [], R = [], n = 10;
  for (let i = 0; i <= n; i++) {
    const k = i / n, y = y0 + k * len, cx = bend * (k * len) * (k * len), w = lerp(w0, w1, k) * (k > 0.85 ? (1 - k) / 0.15 : 1) + edgeBulge * Math.sin(k * PI);
    L.push([cx - w * 0.6, y]); R.push([cx + w * 0.4, y]);
  }
  return [...R, ...L.reverse()];
}
// --- оружие (в естественной системе: рукоять в начале координат, клинок вдоль +Y)
function buildWeapon(key, q = 0) {
  const g = new THREE.Group(); g.name = 'w_' + key;
  const st = qSteel(q), gold = q >= 3;
  switch (key) {
    case 'knife': {
      bladeMesh(g, 'knife', [[0.012, 0.05], [0.014, 0.17], [-0.004, 0.23], [-0.016, 0.16], [-0.012, 0.05]], st, 0.006);
      P(g, cyl(0.014, 0.016, 0.1, 8), M(C.woodD), 0, 0, 0);
      P(g, rbox(0.03, 0.012, 0.034, 0.004), qBronze(q), 0, 0.052, 0);
      break;
    }
    case 'gladius': case 'rudis': {
      const wood = key === 'rudis';
      const bm = wood ? M(0xc49a64) : st;
      bladeMesh(g, 'glad', [[-0.028, 0.075], [0.028, 0.075], [0.026, 0.43], [0.0, 0.57], [-0.026, 0.43]], bm, wood ? 0.02 : 0.008, wood ? null : [0.008, 0.33, 0.27]);
      hilt(g, q, 0.095, 0.085, 0.032, wood ? 0x6b4a2a : C.leatherD, wood ? M(0x8a6038) : null);
      if (gold && !wood) P(g, box(0.012, 0.012, 0.06), goldM(), 0, 0.09, 0);
      break;
    }
    case 'spatha': {
      bladeMesh(g, 'spatha', [[-0.024, 0.08], [0.024, 0.08], [0.022, 0.74], [0.012, 0.8], [0, 0.82], [-0.012, 0.8], [-0.022, 0.74]], st, 0.007, [0.007, 0.6, 0.42]);
      hilt(g, q, 0.11, 0.08, 0.034);
      break;
    }
    case 'khopesh': {
      const pts = [[-0.012, 0.06], [0.022, 0.06], [0.032, 0.27]];
      const cx = 0.13, cy = 0.4;
      for (let i = 0; i <= 8; i++) { const a = PI * 1.2 - (i / 8) * PI * 0.72; pts.push([cx + 0.085 * Math.cos(a), cy + 0.085 * Math.sin(a)]); }
      pts.push([cx + 0.112 * Math.cos(PI * 0.42), cy + 0.112 * Math.sin(PI * 0.42)]);
      for (let i = 8; i >= 0; i--) { const a = PI * 1.2 - (i / 8) * PI * 0.72; pts.push([cx + 0.135 * Math.cos(a), cy + 0.135 * Math.sin(a)]); }
      pts.push([-0.012, 0.26]);
      bladeMesh(g, 'khopesh', pts, MET(q >= 2 ? 0xd8a860 : 0xb88a4a, 0.3, 0.9), 0.009);
      hilt(g, q, 0.11, 0.06, 0.03, 0x2a2a3a, goldM());
      break;
    }
    case 'falcata': {
      bladeMesh(g, 'falcata', [[0.018, 0.07], [0.026, 0.2], [0.022, 0.34], [0.004, 0.46], [-0.02, 0.52], [-0.048, 0.44], [-0.05, 0.32], [-0.034, 0.18], [-0.022, 0.07]], st, 0.008, [0.006, 0.22, 0.22]);
      P(g, cyl(0.016, 0.018, 0.1, 8), M(C.leatherD), 0, 0, 0);
      const gm = gold ? goldM() : qBronze(q);
      P(g, rbox(0.03, 0.02, 0.07, 0.006), gm, 0, 0.06, 0);
      // рукоять-«голова птицы» с защитной дужкой
      P(g, tor(0.055, 0.008, 5, 12, PI * 1.1), gm, 0, 0.0, 0.03, 0, HPI, -HPI * 0.2);
      P(g, sph(0.022, 8, 6), gm, 0, -0.06, 0.01, 0, 0, 0, 1, 0.8, 1.6);
      break;
    }
    case 'falx': {
      bladeMesh(g, 'falxP', curvedPts(0.6, 0.045, 0.05, -0.32), st, 0.008);
      hilt(g, q, 0.11, 0.08, 0.03, 0x3a2416, qBronze(q));
      break;
    }
    case 'sica': {
      bladeMesh(g, 'sica', curvedPts(0.32, 0.034, 0.03, 0.9), st, 0.008);
      hilt(g, q, 0.1, 0.07, 0.028, 0x3a2a1a, qBronze(q));
      break;
    }
    case 'axe': {
      P(g, cyl(0.018, 0.021, 0.8, 8), M(C.wood), 0, 0.24, 0);
      P(g, cyl(0.022, 0.022, 0.14, 8), M(C.leatherD), 0, 0, 0);
      const h = grp(g, 0, 0.56, 0, 0, -HPI, 0);
      P(h, extr('axeHead', [[-0.03, -0.035], [0.05, -0.03], [0.1, -0.1], [0.135, -0.11], [0.15, 0.04], [0.12, 0.05], [0.05, 0.035], [-0.03, 0.035]], 0.024, 0.008), qIron(q));
      P(h, box(0.06, 0.07, 0.044), qIron(q), -0.01, 0, 0);
      if (gold) P(h, box(0.02, 0.06, 0.05), goldM(), 0.03, 0, 0);
      break;
    }
    case 'hasta': {
      P(g, cyl(0.017, 0.019, 2.25, 8), M(C.woodL), 0, 0.42, 0);
      const hd = grp(g, 0, 1.6, 0, 0, HPI, 0);
      P(hd, extr('leaf', [[0, -0.02], [0.03, 0.06], [0.034, 0.12], [0.0, 0.3], [-0.034, 0.12], [-0.03, 0.06]], 0.012, 0.005), st);
      P(g, cyl(0.02, 0.016, 0.1, 8), st, 0, 1.56, 0);
      P(g, cone(0.02, 0.12, 6), qIron(q), 0, -0.76, 0, PI);
      P(g, cyl(0.022, 0.022, 0.16, 8), M(C.leather), 0, 0, 0);
      break;
    }
    case 'pilum': {
      P(g, cyl(0.018, 0.02, 1.3, 8), M(C.woodL), 0, -0.05, 0);
      P(g, box(0.05, 0.08, 0.05), qIron(q), 0, 0.62, 0);
      P(g, cyl(0.006, 0.007, 0.62, 5), qIron(q), 0, 0.96, 0);
      P(g, cone(0.013, 0.06, 4), st, 0, 1.3, 0);
      P(g, cone(0.016, 0.06, 6), qIron(q), 0, -0.73, 0, PI);
      break;
    }
    case 'trident': {
      P(g, cyl(0.017, 0.019, 1.95, 8), M(C.woodL), 0, 0.37, 0);
      P(g, rbox(0.2, 0.03, 0.03, 0.008), st, 0, 1.35, 0);
      P(g, cyl(0.022, 0.018, 0.1, 8), st, 0, 1.3, 0);
      for (const x of [-0.09, 0, 0.09]) {
        P(g, cyl(0.008, 0.009, 0.3, 6), st, x, 1.5, 0);
        P(g, cone(0.016, 0.07, 4), st, x, 1.68, 0);
        P(g, box(0.006, 0.04, 0.006), st, x + Math.sign(x || 1) * 0.012, 1.62, 0, 0, 0, Math.sign(x || 1) * 0.5);
      }
      break;
    }
    case 'pick': {
      P(g, cyl(0.018, 0.021, 0.78, 8), M(C.wood), 0, 0.24, 0);
      const h = grp(g, 0, 0.56, 0, 0, -HPI, 0);
      P(h, extr('dolabraA', [[-0.03, -0.03], [0.12, -0.04], [0.15, -0.08], [0.16, 0.0], [0.12, 0.02], [-0.03, 0.03]], 0.026, 0.008), qIron(q));
      P(h, cone(0.022, 0.22, 4), qIron(q), -0.13, 0.0, 0, 0, 0, HPI);
      P(h, box(0.06, 0.07, 0.046), qIron(q), 0, 0, 0);
      break;
    }
    case 'rod': case 'rod_pro': case 'rod_bronze': case 'rod_master': case 'rod_tuna': {
      const pro = key !== 'rod';
      const rm = M(pro ? 0xd2b878 : 0x9a7448);
      P(g, cyl(0.007, 0.02, 2.6, 6), rm, 0, 1.05, 0);
      if (pro) for (let i = 0; i < 6; i++) P(g, cyl(0.02 - i * 0.002, 0.02 - i * 0.002, 0.02, 6), M(0xb09858), 0, 0.1 + i * 0.4, 0);
      P(g, cyl(0.024, 0.024, 0.2, 8), M(pro ? 0x5a3a20 : C.rope), 0, 0, 0);
      const line = grp(g, 0, 2.35, 0); line.userData.hang = true;
      P(line, cyl(0.002, 0.002, 1.1, 3), M(0xf0f0e8), 0, -0.55, 0).castShadow = false;
      P(line, sph(0.022, 6, 4), M(pro ? 0xc83a2a : 0xd8c8a0), 0, -0.55, 0);
      P(line, tor(0.012, 0.0025, 3, 8, PI * 1.4), pro ? goldM() : ironM(), 0, -1.1, 0);
      g.userData.line = line;
      break;
    }
    case 'torch': {
      P(g, cyl(0.02, 0.026, 0.62, 7), M(C.woodD), 0, 0.12, 0);
      P(g, cyl(0.045, 0.034, 0.16, 8), M(0x3a2a1a), 0, 0.48, 0);
      P(g, tor(0.04, 0.008, 4, 10), M(C.rope), 0, 0.44, 0, HPI);
      P(g, ico(0.04, 0), EMB(), 0, 0.57, 0);
      const fl = grp(g, 0, 0.6, 0);
      const f1 = P(fl, cone(0.075, 0.32, 7), FLAME(), 0, 0.15, 0); f1.castShadow = false;
      const f2 = P(fl, cone(0.045, 0.2, 6), FLAME2(), 0, 0.1, 0); f2.castShadow = false;
      const l = new VLight(0xffa040, 55, 48, 1.1); l.position.set(0, 0.35, 0); l.prio = 1; g.add(l);
      // ореол пламени — виден издалека, особенно ночью
      const halo = new THREE.Sprite(torchHaloMat()); halo.scale.set(1.3, 1.3, 1); halo.position.set(0, 0.22, 0); halo.renderOrder = 5; fl.add(halo);
      g.userData.flame = fl; g.userData.light = l;
      break;
    }
    case 'sling': {
      const sl = grp(g, 0, 0, 0); sl.userData.hang = true;
      for (const x of [-0.012, 0.012]) P(sl, cyl(0.003, 0.003, 0.5, 3), M(0xc8b080), x, -0.25, 0);
      P(sl, sph(0.04, 8, 6), M(C.leather), 0, -0.52, 0, 0, 0, 0, 1, 0.5, 0.7);
      P(sl, ico(0.026, 0), M(0x9a9080), 0, -0.51, 0);
      P(g, tor(0.02, 0.006, 4, 8), M(0xc8b080), 0, 0, 0, HPI);
      break;
    }
    case 'bow': {
      // лук держится в левой руке: ось лука — локальная Z, тетива — со стороны лучника (+Y)
      const limb = (sgn) => tube(`bowL${sgn}`, [[0, 0, 0], [0, 0.04, sgn * 0.2], [0, 0.1, sgn * 0.42], [0, 0.135, sgn * 0.58], [0, 0.12, sgn * 0.66]], 0.018, 0.008, 10, 5);
      const bm = M(q >= 2 ? 0x6a3a1a : 0x7a4a24);
      P(g, limb(1), bm); P(g, limb(-1), bm);
      P(g, cyl(0.022, 0.022, 0.12, 8), M(C.leatherD), 0, 0, 0, HPI);
      for (const sgn of [1, -1]) P(g, sph(0.012, 5, 4), M(0xe8e0c8), 0, 0.12, sgn * 0.66);
      const strM = M(0xf0e8d0);
      const sa = P(g, cyl(0.0025, 0.0025, 1, 3), strM), sb = P(g, cyl(0.0025, 0.0025, 1, 3), strM);
      sa.castShadow = sb.castShadow = false;
      g.userData.string = [sa, sb];
      setBowDraw(g, 0);
      break;
    }
    default: return null;
  }
  return g;
}
const _sv1 = new THREE.Vector3(), _sv2 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function setBowDraw(bow, d) {
  const [sa, sb] = bow.userData.string || [];
  if (!sa) return;
  const nock = _sv1.set(0, 0.12 + d * 0.55, 0);
  for (const [m, sgn] of [[sa, 1], [sb, -1]]) {
    const tip = _sv2.set(0, 0.12, sgn * 0.655);
    m.position.copy(tip).add(nock).multiplyScalar(0.5);
    const dir = tip.sub(nock); const len = dir.length();
    m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(_up, dir.normalize());
  }
}
// --- щиты (лицевая сторона +Z, верх +Y, рукоять в начале координат)
function buildShield(key, q = 0) {
  const g = new THREE.Group(); g.name = 's_' + key;
  const ds = { side: THREE.DoubleSide };
  const gold = q >= 3;
  const rimM = gold ? goldM() : qBronze(q);
  switch (key) {
    case 'parma': {
      const cap = G('parmaCap', () => new THREE.SphereGeometry(0.7, 24, 4, 0, TAU, 0, 0.46));
      P(g, cap, M(0x8a5a34, ds), 0, 0, -0.62, HPI);
      P(g, tor(0.31, 0.016, 5, 28), rimM, 0, 0, 0.0);
      P(g, hemi(0.07, 12, 6), rimM, 0, 0, 0.07, HPI);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; P(g, sph(0.012, 5, 4), rimM, Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0.035); }
      P(g, box(0.12, 0.025, 0.03), M(C.woodD), 0, 0, -0.03);
      break;
    }
    case 'scutum': {
      const geo = G('scutumG', () => bendX(new THREE.BoxGeometry(0.66, 1.06, 0.035, 10, 1, 1), 0.52));
      const sm = [M(0x7a1a14), M(0x7a1a14), M(0x7a1a14), M(0x7a1a14), TM('scutum', 0xffffff), M(0x6a4a2a)];
      const m = new THREE.Mesh(geo, sm); m.castShadow = m.receiveShadow = true; m.position.z = 0.04; g.add(m);
      const edge = G('scutumE', () => bendX(new THREE.BoxGeometry(0.67, 0.03, 0.05, 8, 1, 1), 0.52));
      for (const y of [-0.53, 0.53]) P(g, edge, rimM, 0, y, 0.04);
      for (const s of [-1, 1]) { const a = 0.335 / 0.52; P(g, box(0.02, 1.06, 0.05), rimM, s * Math.sin(a) * 0.52, 0, 0.04 + Math.cos(a) * 0.52 - 0.52, 0, s * -a, 0); }
      P(g, hemi(0.085, 10, 5), rimM, 0, 0, 0.06, HPI);
      P(g, rbox(0.22, 0.16, 0.012, 0.005), rimM, 0, 0, 0.055);
      P(g, box(0.14, 0.03, 0.03), M(C.woodD), 0, 0, -0.01);
      break;
    }
    case 'barbshield': {
      const pts = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; pts.push([Math.cos(a) * 0.3, Math.sin(a) * 0.48]); }
      P(g, extr('barbS', pts, 0.03, 0.008), M(0x6a4a2c), 0, 0, 0.04);
      const ring = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; ring.push([Math.cos(a) * 0.22, Math.sin(a) * 0.38]); }
      P(g, extr('barbS2', ring, 0.034, 0.004), M(0x8a6a2a), 0, 0, 0.042);
      P(g, extr('barbS3', ring.map(([x, y]) => [x * 0.55, y * 0.55]), 0.036, 0.004), M(0x6a1a14), 0, 0, 0.044);
      P(g, box(0.05, 0.9, 0.02), M(0x4a3420), 0, 0, 0.06);
      P(g, hemi(0.075, 12, 6), qIron(q), 0, 0, 0.065, HPI);
      P(g, cone(0.03, 0.06, 8), qIron(q), 0, 0, 0.13, HPI);
      break;
    }
    case 'punicshield': {
      const cap = G('punCap', () => new THREE.SphereGeometry(0.9, 28, 5, 0, TAU, 0, 0.5));
      P(g, cap, M(gold ? 0xd8b048 : 0xb8904a, { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }), 0, 0, -0.79, HPI);
      P(g, tor(0.43, 0.022, 6, 32), rimM, 0, 0, 0.0);
      // эмблема: знак Танит (треугольник, перекладина, диск)
      const em = M(0xf0e6d0);
      P(g, extr('tanitT', [[-0.08, -0.14], [0.08, -0.14], [0.0, 0.04]], 0.01, 0), em, 0, -0.02, 0.105);
      P(g, box(0.2, 0.024, 0.01), em, 0, 0.05, 0.103);
      P(g, cyl(0.04, 0.04, 0.01, 14), em, 0, 0.12, 0.096, HPI);
      P(g, box(0.14, 0.03, 0.03), M(C.woodD), 0, 0, -0.03);
      break;
    }
    case 'caetra': {
      P(g, cyl(0.25, 0.25, 0.03, 24), M(0x5a3a22), 0, 0, 0.03, HPI);
      for (const r of [0.24, 0.17, 0.1]) P(g, tor(r, 0.008, 4, 24), rimM, 0, 0, 0.048);
      P(g, hemi(0.05, 10, 5), rimM, 0, 0, 0.05, HPI);
      P(g, cone(0.022, 0.06, 6), rimM, 0, 0, 0.11, HPI);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; P(g, cyl(0.022, 0.022, 0.01, 8), rimM, Math.cos(a) * 0.135, Math.sin(a) * 0.135, 0.05, HPI); }
      break;
    }
    default: return null;
  }
  return g;
}
TEXDRAW.scutum = (x, n) => {
  x.fillStyle = '#8e1e16'; x.fillRect(0, 0, n, n);
  x.strokeStyle = '#e0b84a'; x.lineWidth = 6; x.strokeRect(8, 8, n - 16, n - 16);
  x.fillStyle = '#e0b84a';
  // крылья и молнии Юпитера
  const cx = n / 2, cy = n / 2;
  for (const s of [-1, 1]) {
    x.beginPath(); x.moveTo(cx + s * 22, cy); x.quadraticCurveTo(cx + s * 70, cy - 60, cx + s * 110, cy - 90); x.quadraticCurveTo(cx + s * 70, cy - 30, cx + s * 22, cy + 10); x.fill();
    x.beginPath(); x.moveTo(cx + s * 22, cy); x.quadraticCurveTo(cx + s * 70, cy + 60, cx + s * 110, cy + 90); x.quadraticCurveTo(cx + s * 70, cy + 30, cx + s * 22, cy - 10); x.fill();
    for (const k of [-1, 1]) { x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + s * 30, cy + k * 70); x.lineTo(cx + s * 20, cy + k * 72); x.lineTo(cx + s * 40, cy + k * 120); x.lineWidth = 5; x.strokeStyle = '#e0b84a'; x.stroke(); }
  }
  x.beginPath(); x.arc(cx, cy, 26, 0, TAU); x.fill();
};
TEXDRAW.nemes = (x, n) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#1f3f9a' : '#d8b040'; x.fillRect(0, i * n / 16, n, n / 16); } };

// --- шлемы (в системе головы; центр черепа на y = 0.11)
function buildHelmet(key, q = 0) {
  const g = new THREE.Group(); g.name = 'h_' + key;
  const c = 0.11;
  const bowl = (m, r = 0.133, tilt = -0.26) => P(g, hemi(r, 14, 5), m, 0, c + 0.004, -0.008, tilt, 0, 0, 0.93, 1.02, 1.04);
  const gold = q >= 3;
  switch (key) {
    case 'croc_helm': { // кожаный шлем с крокодиловой чешуёй и гребнем
      const m = TM('scale', 0x6a7448, { roughness: 0.62, metalness: 0.08 });
      bowl(m, 0.136);
      P(g, box(0.02, 0.05, 0.22), M(0x3e4628), 0, c + 0.14, -0.02, -0.3);
      for (const s of [-1, 1]) P(g, rbox(0.012, 0.09, 0.075, 0.004), M(0x4a3a22), s * 0.106, c - 0.04, 0.035, 0.1, 0, s * 0.08);
      P(g, box(0.18, 0.01, 0.05), M(0x4a3a22), 0, c - 0.03, -0.13, -0.5);
      break;
    }
    case 'pileus': {
      P(g, lathe('pileus', [[0.128, 0], [0.13, 0.04], [0.11, 0.12], [0.06, 0.18], [0.0, 0.2]], 14), M(0xb8a27a), 0, c + 0.02, -0.01, -0.15, 0, 0, 0.93, 1, 1.03);
      P(g, tor(0.124, 0.012, 3, 12), M(0x9a845e), 0, c + 0.025, -0.01, HPI - 0.15, 0, 0, 0.93, 1.03, 1);
      break;
    }
    case 'galea_bronze': {
      const m = qBronze(q);
      bowl(m);
      P(g, tor(0.122, 0.009, 3, 12), m, 0, c + 0.006, -0.008, HPI - 0.26, 0, 0, 0.93, 1.04, 1);
      P(g, cyl(0.012, 0.016, 0.04, 8), m, 0, c + 0.145, -0.03);
      P(g, sph(0.018, 8, 6), m, 0, c + 0.17, -0.03);
      P(g, cone(0.03, 0.16, 8), M(0x8a1a14), 0, c + 0.22, -0.06, -0.5);
      P(g, box(0.18, 0.01, 0.05), m, 0, c - 0.03, -0.13, -0.5);   // назатыльник
      for (const s of [-1, 1]) P(g, rbox(0.012, 0.09, 0.075, 0.004), m, s * 0.104, c - 0.04, 0.035, 0.1, 0, s * 0.08);
      if (gold) P(g, tor(0.124, 0.006, 3, 12), goldM(), 0, c + 0.03, -0.01, HPI - 0.26, 0, 0, 0.93, 1.04, 1);
      break;
    }
    case 'galea_iron': case 'galea_centurio': {
      const cen = key === 'galea_centurio';
      const m = cen ? MET(0xd8dde2, 0.18, 0.92) : qIron(q);
      const br = gold || cen ? goldM() : qBronze(q);
      bowl(m);
      P(g, tor(0.11, 0.01, 3, 12, PI * 0.9), br, 0, c + 0.06, 0.03, -0.05, 0, PI * 0.05);         // надбровный козырёк
      P(g, rbox(0.15, 0.012, 0.03, 0.004), m, 0, c + 0.035, 0.12, 0.3);
      P(g, rbox(0.25, 0.012, 0.12, 0.005), m, 0, c - 0.035, -0.145, -0.42);                            // широкий назатыльник
      for (const s of [-1, 1]) {
        P(g, rbox(0.012, 0.11, 0.085, 0.004), m, s * 0.106, c - 0.045, 0.035, 0.12, 0, s * 0.1);
        P(g, cyl(0.012, 0.012, 0.006, 8), br, s * 0.113, c - 0.03, 0.04, 0, 0, HPI);
        P(g, tor(0.03, 0.006, 3, 6, PI), m, s * 0.104, c + 0.0, -0.015, 0, s * HPI, 0);             // ушные вырезы
        P(g, tor(0.05, 0.005, 3, 6, PI * 0.8), br, s * 0.06, c + 0.09, -0.05, -0.6, s * 0.4, 0);    // «брови» на тулье
      }
      P(g, box(0.02, 0.03, 0.05), br, 0, c + 0.14, -0.02);
      if (cen) {
        const crest = G('cenCrest', () => new THREE.TorusGeometry(0.15, 0.03, 6, 18, PI));
        P(g, crest, M(0xb0181a), 0, c + 0.13, -0.02, 0, 0, 0, 1, 0.9, 0.7);
        for (let i = 0; i < 9; i++) { const a = (i / 8) * PI; P(g, box(0.018, 0.05, 0.035), M(0x8a1214), Math.cos(a) * 0.15, c + 0.13 + Math.sin(a) * 0.135, -0.02, 0, 0, a - HPI); }
      } else P(g, box(0.03, 0.06, 0.2), M(0x6a1a14), 0, c + 0.16, -0.02);
      break;
    }
    case 'horns': {
      P(g, G('furCap', () => lumpy(new THREE.SphereGeometry(0.14, 14, 7, 0, TAU, 0, HPI), 0.1, 5)), M(0x5a4430), 0, c + 0.0, -0.01, -0.22, 0, 0, 0.95, 1.05, 1.05);
      P(g, tor(0.124, 0.014, 3, 12), qBronze(q), 0, c + 0.025, -0.01, HPI - 0.22, 0, 0, 0.95, 1.05, 1);
      const hm = M(0xe8dcc0);
      for (const s of [-1, 1]) P(g, tube(`horn${s}`, [[s * 0.1, c + 0.07, 0], [s * 0.19, c + 0.12, 0.02], [s * 0.24, c + 0.22, 0.03], [s * 0.22, c + 0.31, 0.06]], 0.032, 0.004, 10, 6), hm);
      for (let i = 0; i < 6; i++) { const a = -0.8 + i * 0.32; P(g, cone(0.03, 0.12, 5), M(0x4a3420), Math.sin(a) * 0.12, c - 0.05, -Math.cos(a) * 0.11 - 0.02, -0.4 + Math.cos(a) * 0.2, 0, Math.sin(a) * 0.4); }
      break;
    }
    case 'punichelm': case 'punichelm_gold': {
      const gl = key === 'punichelm_gold';
      const m = gl ? MET(0xe0b848, 0.22, 0.95) : qBronze(q);
      bowl(m, 0.134, -0.2);
      P(g, extr('punPeak', [[-0.1, 0], [0.1, 0], [0.08, 0.03], [0, 0.045], [-0.08, 0.03]], 0.012, 0.004), m, 0, c + 0.04, 0.115, -0.2);
      for (const s of [-1, 1]) P(g, extr('punCheek', [[0, 0], [0.08, 0], [0.07, -0.08], [0.03, -0.1], [0, -0.06]], 0.01, 0.003), m, s * 0.103, c + 0.0, 0.07, 0, s * -HPI + (s > 0 ? PI : 0), 0);
      P(g, box(0.16, 0.012, 0.05), m, 0, c - 0.035, -0.125, -0.5);
      // гребень с конским волосом
      P(g, box(0.02, 0.05, 0.22), m, 0, c + 0.155, -0.02);
      P(g, G('punCrest', () => new THREE.CylinderGeometry(0.12, 0.12, 0.03, 12, 1, false, -HPI * 0.9, PI * 0.95)), M(gl ? 0xf0f0f0 : 0x1a1a1a), 0, c + 0.13, -0.03, 0, 0, HPI);
      if (gl) for (const s of [-1, 1]) P(g, cone(0.015, 0.22, 5), M(0x6a1a6a), s * 0.1, c + 0.18, -0.02, 0, 0, -s * 0.35);
      break;
    }
    case 'nemes': {
      const nm = TM('nemes', 0xffffff);
      P(g, lathe('nemes', [[0.0, 0.2], [0.07, 0.19], [0.125, 0.12], [0.14, 0.03], [0.14, -0.02]].reverse(), 18), nm, 0, c - 0.02, -0.01, -0.12, 0, 0, 0.95, 1, 1.05);
      for (const s of [-1, 1]) P(g, box(0.06, 0.22, 0.06), nm, s * 0.11, c - 0.13, 0.05, 0.1, 0, s * 0.12);
      P(g, box(0.11, 0.22, 0.04), nm, 0, c - 0.12, -0.12, -0.15);
      P(g, tor(0.13, 0.012, 3, 12), goldM(), 0, c + 0.04, -0.01, HPI - 0.12, 0, 0, 0.95, 1.05, 1);
      P(g, cyl(0.008, 0.012, 0.07, 6), goldM(), 0, c + 0.07, 0.125, -0.3);  // урей
      P(g, sph(0.014, 6, 4), goldM(), 0, c + 0.105, 0.135);
      break;
    }
    case 'murmillo': case 'thraex': {
      const th = key === 'thraex';
      const m = qBronze(q);
      bowl(m, 0.142, -0.1);
      P(g, cyl(0.2, 0.21, 0.012, 22), m, 0, c - 0.0, -0.01, -0.1);                                 // широкие поля
      P(g, hemi(0.13, 16, 6), m, 0, c - 0.01, 0.0, HPI + 0.1, 0, 0, 0.92, 0.95, 0.55);            // забрало
      const grill = M(0x2a2218);
      for (let i = 0; i < 5; i++) P(g, box(0.008, 0.07, 0.01), m, -0.04 + i * 0.02, c + 0.01, 0.124);
      P(g, box(0.1, 0.075, 0.006), grill, 0, c + 0.01, 0.118);
      if (th) {
        P(g, extr('thraexCrest', [[-0.12, 0], [0.12, 0], [0.16, 0.05], [0.2, 0.06], [0.14, 0.1], [0.06, 0.14], [-0.08, 0.13]], 0.02, 0.006), m, 0, c + 0.12, 0.0, 0, -HPI, 0);
        for (const s of [-1, 1]) P(g, cone(0.012, 0.2, 5), M(0xf0f0f0), s * 0.12, c + 0.16, -0.03, 0, 0, -s * 0.25);
      } else {
        P(g, extr('murmCrest', [[-0.14, 0], [0.12, 0], [0.16, 0.06], [0.1, 0.12], [-0.04, 0.15], [-0.16, 0.08]], 0.03, 0.008), m, 0, c + 0.12, -0.02, 0, HPI, 0);
        P(g, box(0.02, 0.07, 0.24), M(0x2a5a9a), 0, c + 0.25, -0.02);
      }
      break;
    }
    default: return null;
  }
  return g;
}

// --- доспехи корпуса: возвращает части по суставам
function buildBody(key, q = 0, o = {}) {
  const parts = {}; const at = (k) => (parts[k] || (parts[k] = new THREE.Group()));
  const tz = TORSO_Z;
  const wx = o.female ? 0.9 : 1;
  const shell = (k, mat, inf = 1.07, y0 = -0.05, y1 = 0.5) => P(at('torso'), torsoGeo(k + wx, inf, y0, y1, wx), mat, 0, 0, 0, 0, 0, 0, 1, 1, tz * 1.02);
  const belt = (mat = M(C.leather), y = 0.03, studs = true) => {
    P(at('hips'), cyl(0.18 * wx, 0.18 * wx, 0.05, 18), mat, 0, y + 0.04, 0, 0, 0, 0, 1, 1, 0.7);
    if (studs) for (let i = -3; i <= 3; i++) P(at('hips'), oct(0.012), qBronze(q), i * 0.035, y + 0.04, 0.127, 0, 0, 0, 1, 1, 0.5);
  };
  const apron = () => { for (let i = -2; i <= 2; i++) { const s = P(at('hips'), box(0.02, 0.24, 0.006), M(C.leatherD), i * 0.03, -0.08, 0.13); for (let k = 0; k < 3; k++) P(at('hips'), oct(0.009), qBronze(q), i * 0.03, -0.02 - k * 0.07, 0.135, 0, 0, 0, 1, 1, 0.5); s.rotation.x = -0.05; } };
  const pteruges = (par, n, r, y, len, mat, zs = 0.7, w = 0.05) => {
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const s = P(par, box(w, len, 0.012), mat, Math.sin(a) * r, y - len / 2, Math.cos(a) * r * zs); s.rotation.set(-0.12, a, 0, 'YXZ'); }
  };
  const trousers = (col, col2) => {
    for (const s of ['L', 'R']) {
      P(at('leg' + s), cyl(0.083, 0.064, HUM.L1 * 0.98, 10), M(col), 0, -HUM.L1 / 2, 0);
      P(at('shin' + s), cyl(0.06, 0.046, HUM.L2 * 0.92, 10), M(col), 0, -HUM.L2 / 2 + 0.01, 0);
      for (let i = 0; i < 4; i++) P(at('shin' + s), cyl(0.058 - i * 0.003, 0.058 - i * 0.003, 0.014, 10), M(col2), 0, -0.12 - i * 0.07, 0, 0.25 * (i % 2 ? 1 : -1));
    }
  };
  const fur = (col, big = 1) => {
    const fg = G('furMantle', () => lumpy(new THREE.SphereGeometry(0.25, 12, 6, 0, TAU, 0, 1.3), 0.14, 9));
    P(at('torso'), fg, M(col), 0, 0.33, -0.01, 0, 0, 0, 1.05 * big, 0.8, 0.82 * big);
    for (let i = 0; i < 9; i++) { const a = PI * 0.6 + (i / 8) * PI * 0.8; P(at('torso'), cone(0.04, 0.12, 5), M(darker(col, 0.8)), Math.sin(a) * 0.23 * big, 0.28, Math.cos(a) * 0.17 * big, PI + Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3); }
  };
  const cloak = (col) => {
    const cm = M(col, { side: THREE.DoubleSide });
    const cg = grp(at('torso'), 0, 0.47, -0.19);
    P(cg, G('capeG2', () => { const qg = new THREE.PlaneGeometry(0.52, 1.0, 4, 8); qg.translate(0, -0.5, 0); const p = qg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setXYZ(i, x * (1 - y * 0.3), y, -0.06 * Math.cos((x / 0.52) * PI) - 0.02); } qg.computeVertexNormals(); return qg; }), cm);
    parts.cloak = cg;
  };
  switch (key) {
    case 'subarmalis': {
      const m = M(0xd8ccb0);
      shell('suba', m, 1.06, -0.05, 0.48);
      for (let i = 0; i < 6; i++) { const y = 0.03 + i * 0.075; const r = TORSO_PTS.reduce((a, [rr, yy]) => (Math.abs(yy - y) < Math.abs(a[1] - y) ? [rr, yy] : a), [0, 9])[0]; P(at('torso'), tor(r * 1.075 * wx, 0.006, 3, 12), M(0xb8aa8a), 0, y, 0, HPI, 0, 0, 1, tz * 1.03, 1); }
      pteruges(at('hips'), 12, 0.19 * wx, 0.02, 0.2, M(0xc8bc9c));
      for (const s of ['L', 'R']) pteruges(at('arm' + s), 5, 0.068, 0.0, 0.11, M(0xc8bc9c), 1, 0.04);
      belt();
      break;
    }
    case 'croc_armor': { // панцирь из крокодиловой кожи: тёмная чешуя, кожаные птеруги, бронзовые застёжки
      const m = TM('scale', 0x6a7448, { roughness: 0.62, metalness: 0.08 });
      shell(key, m, 1.08, -0.05, 0.52);
      P(at('torso'), G('crocRidge', () => new THREE.BoxGeometry(0.05, 0.42, 0.04)), M(0x3e4628), 0, 0.26, -0.16);
      for (const s of ['L', 'R']) P(at('arm' + s), cyl(0.074, 0.064, 0.16, 10, true), m, 0, -0.06, 0);
      P(at('torso'), G('humer', () => new THREE.SphereGeometry(0.22, 16, 6, 0, TAU, 0, 0.75)), m, 0, 0.36, 0, 0, 0, 0, 1.0 * wx, 0.75, 0.7);
      pteruges(at('hips'), 12, 0.19 * wx, 0.02, 0.22, M(0x4a3a22));
      P(at('torso'), rbox(0.1, 0.04, 0.01, 0.004), qBronze(q), 0, 0.42, 0.13);
      belt(); break;
    }
    case 'hamata': case 'squamata': {
      const sq = key === 'squamata';
      const m = sq ? TM('scale', 0xffffff, { metalness: 0.75, roughness: 0.4 }) : TM('mail', 0xffffff, { metalness: 0.7, roughness: q >= 2 ? 0.3 : 0.5 });
      shell(key, m, 1.07, -0.05, 0.5);
      P(at('hips'), lathe(`mailSk${sq}${wx}`, [[0.26 * wx, -0.28], [0.22 * wx, -0.12], [0.18 * wx, 0.06]], 18), m, 0, 0, 0, 0, 0, 0, 1, 1, 0.78);
      for (const s of ['L', 'R']) P(at('arm' + s), cyl(0.07, 0.062, 0.15, 10, true), m, 0, -0.06, 0);
      // наплечная пелерина (humeralia) с застёжкой
      P(at('torso'), G('humer', () => new THREE.SphereGeometry(0.22, 16, 6, 0, TAU, 0, 0.75)), m, 0, 0.36, 0, 0, 0, 0, 1.0 * wx, 0.75, 0.7);
      P(at('torso'), rbox(0.1, 0.04, 0.01, 0.004), qBronze(q), 0, 0.42, 0.13);
      belt(); apron();
      break;
    }
    case 'segmentata': {
      const m = q >= 2 ? MET(0xd0d6dc, 0.2, 0.9) : MET(0xaab2ba, 0.3, 0.85);
      const fit = q >= 3 ? goldM() : qBronze(q);
      for (let i = 0; i < 7; i++) {
        const y = 0.0 + i * 0.045, r = lerp(0.155, 0.19, i / 6) * 1.1 * wx;
        P(at('torso'), cyl(r, r * 0.98, 0.05, 14, true), m, 0, y, 0, -0.04, 0, 0, 1, 1, tz * 1.05);
      }
      P(at('torso'), torsoGeo('segC' + wx, 1.1, 0.3, 0.5, wx), m, 0, 0, 0, 0, 0, 0, 1, 1, tz * 1.05);
      for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) P(at('torso'), cyl(0.012, 0.012, 0.006, 6), fit, sx * 0.05, 0.4 - i * 0.05, 0.135, HPI);
      P(at('torso'), box(0.012, 0.15, 0.01), fit, 0, 0.36, 0.135);
      for (const s of ['L', 'R']) for (let i = 0; i < 4; i++) {
        const sg = s === 'L' ? 1 : -1;
        P(at('arm' + s), G('lame', () => new THREE.CylinderGeometry(0.085, 0.085, 0.045, 9, 1, true, -PI * 0.6, PI * 1.2)), m, 0, 0.03 - i * 0.04, 0, 0, sg > 0 ? HPI : -HPI, 0.0);
      }
      belt(M(C.leather), 0.03); apron();
      break;
    }
    case 'punic_mail': case 'punic_gold': {
      const gl = key === 'punic_gold';
      const m = gl ? MET(0xe2bc4c, 0.22, 0.95) : qBronze(q);
      shell('pmus', m, 1.07, -0.05, 0.5);
      for (const s of [-1, 1]) P(at('torso'), sph(0.08, 8, 5), m, s * 0.075 * wx, 0.35, 0.088, 0, 0, 0, 1.1, 0.75, 0.55);
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) P(at('torso'), sph(0.032, 6, 5), m, s * 0.036, 0.1 + i * 0.07, 0.1, 0, 0, 0, 1, 0.8, 0.45);
      pteruges(at('hips'), 14, 0.2 * wx, 0.03, 0.24, M(gl ? 0x6a1a6a : 0xe8e0c8));
      for (const s of ['L', 'R']) pteruges(at('arm' + s), 5, 0.07, 0.0, 0.12, M(gl ? 0x6a1a6a : 0xe8e0c8), 1, 0.04);
      belt(gl ? goldM() : M(C.leather), 0.03, false);
      if (gl) { cloak(0x5a1a5a); P(at('torso'), tor(0.08, 0.012, 3, 12), goldM(), 0, 0.5, 0.02, HPI); }
      break;
    }
    case 'punic': {
      const m = M(0xe8e0c8);
      shell('lino', m, 1.07, -0.03, 0.47);
      for (const s of [-1, 1]) P(at('torso'), rbox(0.12, 0.02, 0.24, 0.006), m, s * 0.11 * wx, 0.47, 0.0, 0, 0, s * -0.25);  // наплечные клапаны
      P(at('torso'), tor(0.19 * wx, 0.012, 3, 12), M(0x5a1a6a), 0, 0.12, 0, HPI, 0, 0, 1, tz * 1.05, 1);
      P(at('torso'), cyl(0.06, 0.06, 0.012, 14), qBronze(q), 0, 0.32, 0.128, HPI - 0.25);
      pteruges(at('hips'), 14, 0.2 * wx, 0.03, 0.22, M(0xd8d0b8));
      belt(M(0x5a1a6a), 0.03, false);
      break;
    }
    case 'tunic_punic': {
      const sh = P(at('torso'), box(0.06, 0.62, 0.012), M(0x6a4a2a), 0, 0.25, 0.122); sh.rotation.z = 0.7;
      P(at('hips'), sph(0.08, 8, 6), M(0x8a6a44), -0.17, -0.05, 0.03, 0, 0, 0, 1, 1.2, 0.7);  // сумка для камней
      P(at('head'), tor(0.118, 0.012, 3, 12), M(0xc8b080), 0, 0.14, -0.01, HPI - 0.2, 0, 0, 0.93, 1.05, 1); // пращи на голове
      belt(M(0x4a3a2a), 0.03, false);
      break;
    }
    case 'iberian': {
      for (const z of [1, -1]) { P(at('torso'), cyl(0.085, 0.085, 0.012, 18), qBronze(q), 0, 0.3, z * 0.128, HPI); P(at('torso'), tor(0.075, 0.006, 3, 12), qBronze(q), 0, 0.3, z * 0.135); }
      for (const s of [-1, 1]) for (const z of [1, -1]) P(at('torso'), box(0.03, 0.3, 0.012), M(C.leather), s * 0.085, 0.38, z * 0.122, 0, 0, s * z * 0.18);
      P(at('hips'), cyl(0.185 * wx, 0.185 * wx, 0.08, 18), M(C.leather), 0, 0.07, 0, 0, 0, 0, 1, 1, 0.7);
      P(at('hips'), rbox(0.12, 0.07, 0.01, 0.004), qBronze(q), 0, 0.07, 0.13);
      P(at('hips'), cyl(0.249 * wx, 0.249 * wx, 0.05, 18, true), M(0x9a1a1a), 0, -0.34, 0, 0, 0, 0, 1, 1, 0.78);
      break;
    }
    case 'fur': case 'chief': {
      const ch = key === 'chief';
      if (ch) shell('chm', TM('mail', 0xffffff, { metalness: 0.7, roughness: 0.5 }), 1.07, -0.05, 0.48);
      fur(ch ? 0xd8d0c0 : 0x6a5038, ch ? 1.08 : 1);
      trousers(ch ? 0x4a3a5a : 0x5a5040, ch ? 0x8a6a3a : 0x3a3020);
      belt(M(0x3a2a1a), 0.03, ch);
      if (ch) {
        P(at('torso'), tor(0.075, 0.014, 3, 12, PI * 1.7), goldM(), 0, 0.5, 0.01, HPI, 0, PI * 0.65);  // гривна
        for (const s of ['L', 'R']) P(at('fore' + s), tor(0.042, 0.008, 3, 12), goldM(), 0, -0.1, 0, HPI);
        cloak(0x8a1a14);
      }
      break;
    }
    case 'pirate': {
      shell('pirV', M(0x4a2e1a), 1.06, -0.04, 0.46);
      P(at('torso'), box(0.06, 0.4, 0.02), M(0x7a5a3a), 0, 0.22, 0.125);   // шнуровка на груди
      P(at('hips'), cyl(0.185 * wx, 0.19 * wx, 0.1, 18), M(0xa02a1a), 0, 0.06, 0, 0, 0, 0, 1, 1, 0.72);
      P(at('hips'), box(0.06, 0.24, 0.02), M(0xa02a1a), 0.12, -0.08, 0.1, 0, 0, 0.2);
      P(at('head'), G('bandana', () => new THREE.SphereGeometry(0.128, 16, 7, 0, TAU, 0, 1.25)), M(0x3a3a5a), 0, 0.115, -0.01, -0.35, 0, 0, 0.93, 1.03, 1.04);
      P(at('head'), box(0.04, 0.12, 0.02), M(0x3a3a5a), 0.03, 0.06, -0.13, 0.3, 0, 0.3);
      P(at('head'), tor(0.012, 0.003, 3, 8), goldM(), -0.103, 0.075, 0.0, 0, HPI, 0);
      for (const s of ['L', 'R']) P(at('fore' + s), cyl(0.045, 0.038, 0.12, 10), M(C.leatherD), 0, -0.17, 0);
      trousers(0x6a5a48, 0x4a3a2a);
      break;
    }
    case 'robber': case 'robber_boss': {
      const bo = key === 'robber_boss';
      const wrap = M(bo ? 0xe8e0cc : 0xa89878);
      P(at('head'), tor(0.11, 0.035, 3, 12), wrap, 0, 0.17, -0.01, HPI - 0.15, 0, 0, 0.95, 1.08, 1);
      P(at('head'), hemi(0.124, 14, 6), wrap, 0, 0.16, -0.01, -0.15, 0, 0, 0.93, 0.7, 1.03);
      if (!bo) { P(at('head'), G('veil', () => new THREE.SphereGeometry(0.105, 14, 6, PI * 0.15, PI * 0.7, 1.55, 0.8)), M(0x8a7a5a), 0, 0.105, 0.015, 0, -HPI + PI * 0, 0); }
      const st = P(at('torso'), box(0.035, 0.6, 0.012), M(C.leatherD), 0, 0.25, 0.124); st.rotation.z = -0.65;
      P(at('hips'), sph(0.07, 8, 6), M(0x7a6040), 0.18, -0.06, -0.03, 0, 0, 0, 1, 1.2, 0.8);
      belt(M(bo ? 0x3a2a1a : C.rope), 0.03, false);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; P(at('hips'), box(0.05, 0.08, 0.01), M(0x8a7858), Math.sin(a) * 0.24, -0.38, Math.cos(a) * 0.19, 0, a, 0); }
      if (bo) {
        P(at('torso'), G('usekh', () => new THREE.CylinderGeometry(0.17, 0.25, 0.1, 16, 1, true)), M(0x1f4f9a, { side: THREE.DoubleSide }), 0, 0.48, 0, 0, 0, 0, 1, 1, 0.75);
        for (let i = 0; i < 2; i++) P(at('torso'), tor(0.2 + i * 0.03, 0.007, 3, 12), goldM(), 0, 0.5 - i * 0.04, 0, HPI, 0, 0, 1, 0.75, 1);
        P(at('hips'), lathe('shendyt' + wx, [[0.27 * wx, -0.3], [0.2 * wx, -0.1], [0.185 * wx, 0.08]], 18), M(0xf2ecd8), 0, 0, 0, 0, 0, 0, 1, 1, 0.78);
        P(at('hips'), box(0.12, 0.3, 0.012), goldM(), 0, -0.14, 0.17, -0.18);
        for (const s of ['L', 'R']) { P(at('arm' + s), tor(0.05, 0.01, 3, 12), goldM(), 0, -0.12, 0, HPI); P(at('fore' + s), tor(0.042, 0.009, 3, 12), goldM(), 0, -0.2, 0, HPI); }
        cloak(0x1a1a22);
      }
      break;
    }
    case 'glad': {
      parts.bare = true;
      P(at('hips'), lathe('sublig' + wx, [[0.17 * wx, -0.16], [0.16 * wx, -0.06], [0.155 * wx, 0.07]], 18), M(0xf0ead8), 0, 0, 0, 0, 0, 0, 1, 1, 0.8);
      P(at('hips'), box(0.14, 0.2, 0.012), M(0xf0ead8), 0, -0.2, 0.12, -0.15);
      P(at('hips'), cyl(0.18 * wx, 0.18 * wx, 0.11, 18), M(0x5a3a1a), 0, 0.07, 0, 0, 0, 0, 1, 1, 0.72);
      P(at('hips'), cyl(0.182 * wx, 0.182 * wx, 0.03, 18), qBronze(q), 0, 0.07, 0, 0, 0, 0, 1, 1, 0.72);
      // маника на правой руке
      for (let i = 0; i < 6; i++) P(at('armR'), cyl(0.056, 0.054, 0.04, 10), MET(0xb8bec6, 0.35, 0.8), 0, -0.03 - i * 0.045, 0);
      for (let i = 0; i < 5; i++) P(at('foreR'), cyl(0.046, 0.044, 0.04, 10), MET(0xb8bec6, 0.35, 0.8), 0, -0.03 - i * 0.045, 0);
      P(at('shinL'), G('gladGreave', () => new THREE.CylinderGeometry(0.06, 0.05, 0.3, 12, 1, true, -PI * 0.55, PI * 1.1)), M(0xa88a4a, { metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide }), 0, -0.17, 0.0);
      break;
    }
    default: break;
  }
  return parts;
}
function buildLegs(key, q = 0) {
  const parts = {}; const at = (k) => (parts[k] || (parts[k] = new THREE.Group()));
  if (key === 'caligae') {
    for (const s of ['L', 'R']) {
      const f = at('foot' + s), lm = M(0x5a3a20);
      P(f, rbox(0.1, 0.07, 0.24, 0.025), lm, 0, -0.04, 0.045);
      P(f, rbox(0.105, 0.025, 0.265, 0.008), M(0x2e1e10), 0, -0.07, 0.045);
      P(f, cyl(0.05, 0.048, 0.08, 10), lm, 0, 0.0, 0);
      for (let i = 0; i < 3; i++) P(f, box(0.106, 0.012, 0.02), M(0x3a2414), 0, -0.02, 0.0 + i * 0.05, 0.4);
    }
  } else if (key === 'ocreae' || key === 'ocreae_iron') {
    const m = key === 'ocreae' ? qBronze(q) : qIron(q);
    const gm = MET(key === 'ocreae' ? (q >= 2 ? 0xc8a050 : C.bronze) : 0xa0a8b0, 0.3, 0.85);
    for (const s of ['L', 'R']) {
      P(at('shin' + s), G('greave', () => new THREE.CylinderGeometry(0.064, 0.05, 0.34, 14, 1, true, -PI * 0.6, PI * 1.2)), M(gm.color.getHex(), { metalness: 0.85, roughness: q >= 2 ? 0.22 : 0.38, side: THREE.DoubleSide }), 0, -0.19, 0.0);
      P(at('shin' + s), sph(0.06, 8, 4), m, 0, 0.0, 0.025, 0, 0, 0, 1, 1, 0.6);
      for (const y of [-0.08, -0.3]) P(at('shin' + s), tor(0.058, 0.005, 3, 12), M(C.leather), 0, y, 0, HPI);
    }
    Object.assign(parts, Object.fromEntries(Object.entries(buildLegs('caligae', q))));
  }
  return parts;
}

// оружие в левой руке — лук; прочее — в правой
const LEFT_WEAPON = new Set(['bow']);
export function setGear(h, gear = {}) {
  const u = h.userData;
  // снять старое
  for (const o of u._gearObjs || []) {
    o.traverse((c) => { if (c.isVLight) VLIGHTS.delete(c); });
    if (o.parent) o.parent.remove(o);
  }
  u._gearObjs = [];
  u.gear = {}; u.torchFlame = null; u.torchLight = null;
  const q = gear.q | 0;
  const attach = (par, obj) => { if (!obj || !par) return obj; par.add(obj); u._gearObjs.push(obj); return obj; };
  // одежда по умолчанию
  for (const m of u._cloth) m.visible = true;
  for (const m of u._bare) m.visible = false;
  u._wkey = gear.weapon || null;
  u._okey = gear.offhand || null;
  // оружие
  if (gear.weapon) {
    const w = buildWeapon(gear.weapon, q);
    if (w) {
      attach(LEFT_WEAPON.has(gear.weapon) ? u.handL : u.handR, w);
      u.gear.weapon = w;
      if (gear.weapon === 'torch') { u.torchFlame = w.userData.flame; u.torchLight = w.userData.light; }
    }
  }
  u._torchL = false;
  if (gear.torch && gear.weapon !== 'torch' && !LEFT_WEAPON.has(gear.weapon)) { // факел в левой руке вместо щита
    const tw = buildWeapon('torch', 0);
    if (tw) { attach(u.handL, tw); u._torchL = true; u.torchFlame = tw.userData.flame; u.torchLight = tw.userData.light; }
  } else if (gear.offhand) {
    const s = buildShield(gear.offhand, q);
    if (s) { const wrap = new THREE.Group(); wrap.rotation.x = HPI; wrap.position.set(0.035, -0.02, 0); wrap.add(s); attach(u.handL, wrap); u.gear.offhand = wrap; }
  }
  if (gear.head) {
    const hm = buildHelmet(gear.head, q);
    if (hm) { attach(u.head, hm); u.gear.head = hm; }
  }
  const legMap = { legL: u.legL, legR: u.legR, shinL: u.shinL, shinR: u.shinR, footL: u.footL, footR: u.footR };
  const jointOf = (k) => ({ torso: u.torso, hips: u.hips, head: u.head, armL: u.armL, armR: u.armR, foreL: u.foreL, foreR: u.foreR, ...legMap })[k];
  if (gear.body) {
    const parts = buildBody(gear.body, q, u._opts);
    if (parts.bare) {
      if (!u._bare.length) {
        // голый торс гладиатора строится только при первой надобности
        const skin = u._skin, F = !!u._opts.female, wx = F ? 0.9 : 1;
        u._bare.push(P(u.torso, torsoGeo(`b${F}`, 0.985, -0.05, 0.545, wx), skin, 0, 0, 0, 0, 0, 0, 1, 1, TORSO_Z));
        for (const s of [-1, 1]) u._bare.push(P(u.torso, sph(0.075, 8, 6), skin, s * 0.075, 0.355, 0.075, 0, 0, 0, 1.1, 0.75, 0.55));
        for (let i = 0; i < 3; i++) for (const s of [-1, 1]) u._bare.push(P(u.torso, sph(0.03, 5, 3), skin, s * 0.035, 0.12 + i * 0.065, 0.095, 0, 0, 0, 1, 0.8, 0.5));
        for (const arm of [u.armL, u.armR]) u._bare.push(P(arm, sph(0.06, 8, 6), skin, 0, -0.005, 0));
      }
      for (const m of u._cloth) m.visible = false; for (const m of u._bare) m.visible = true;
    }
    const list = [];
    for (const [k, grpP] of Object.entries(parts)) { if (k === 'bare' || k === 'cloak') continue; const j = jointOf(k); if (j && grpP.isObject3D) list.push(attach(j, grpP)); }
    u.gear.body = list;
    if (parts.cloak) u.gear.cloak = parts.cloak;
  }
  if (gear.legs) {
    const parts = buildLegs(gear.legs, q);
    const list = [];
    for (const [k, grpP] of Object.entries(parts)) { const j = jointOf(k); if (j) list.push(attach(j, grpP)); }
    u.gear.legs = list;
  }
  for (const k of ['sandalL', 'sandalR']) if (u[k]) u[k].visible = !gear.legs;
  u.gear.keys = { ...gear };
  return h;
}

// ======================================================================
// Анимация человека
// ======================================================================
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3();
const _m4 = new THREE.Matrix4(), _m5 = new THREE.Matrix4();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _q4 = new THREE.Quaternion();
const _eu = new THREE.Euler();
// двухзвенная ИК: верхнее звено (плечо/бедро) и нижнее (предплечье/голень) с осью сгиба X.
// bendDir = +1: нижнее звено сгибается к локальной +Z (руки); −1: к −Z (ноги). Результат: кватернион в outQ, угол сгиба — возврат.
function ik2(S, T, pole, L1, L2, bendDir, outQ) {
  const D = _a.copy(T).sub(S);
  let dist = D.length();
  dist = clamp(dist, Math.abs(L1 - L2) + 0.02, (L1 + L2) * 0.9995);
  const n = D.lengthSq() > 1e-10 ? D.normalize() : D.set(0, -1, 0);
  const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const p = _b.copy(pole).addScaledVector(n, -pole.dot(n));
  if (p.lengthSq() < 1e-8) { p.set(0, 0, 1).addScaledVector(n, -n.z); if (p.lengthSq() < 1e-8) p.set(1, 0, 0); }
  p.normalize();
  const ud = _c.copy(n).multiplyScalar(cosA).addScaledVector(p, sinA);
  const f = _d.copy(n).multiplyScalar(dist).addScaledVector(ud, -L1).normalize();
  const b = _e.copy(f).addScaledVector(ud, -f.dot(ud));
  if (b.lengthSq() < 1e-8) b.copy(p).negate().addScaledVector(ud, p.dot(ud));
  b.normalize();
  _Y.copy(ud).negate(); _Z.copy(b).multiplyScalar(bendDir); _X.crossVectors(_Y, _Z).normalize(); _Z.crossVectors(_X, _Y);
  _m4.makeBasis(_X, _Y, _Z);
  outQ.setFromRotationMatrix(_m4);
  const cosE = clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1);
  return PI - Math.acos(cosE);
}
// ключевые позы атак (координаты кисти — в системе торса; правая сторона — −X)
// rh/lh — цель кисти, rp/lp — куда смотрит локоть, rw/lw — доворот кисти, ty/tx/tz — поворот/наклон торса,
// lunge — выпад правой ногой, drop — присед, two — вторая рука на древке (смещение вдоль оружия)
const G_GUARD = { rh: [-0.24, 0.2, 0.3], rp: [-1, -0.7, -0.4], wd: [-0.25, 0.55, 0.8] };
// wd — направление оружия (ось +Y кисти) в системе торса; ориентация кисти вычисляется из него
const ATK = {
  blade0: [[0, G_GUARD], [0.3, { rh: [-0.42, 0.66, -0.04], rp: [-0.8, -0.1, -0.7], wd: [-0.35, 0.5, -0.8], ty: -0.6, tx: -0.06, drop: 0.03 }], [0.48, { rh: [0.3, 0.1, 0.42], rp: [-0.4, -1, 0.1], wd: [0.75, -0.35, 0.55], ty: 0.65, tx: 0.22, lunge: 0.32, drop: 0.1 }], [0.6, { rh: [0.32, 0.06, 0.38], rp: [-0.4, -1, 0.1], wd: [0.75, -0.4, 0.5], ty: 0.6, tx: 0.2, lunge: 0.3, drop: 0.09 }], [1, G_GUARD]],
  blade1: [[0, G_GUARD], [0.3, { rh: [0.22, 0.56, 0.16], rp: [-0.4, -0.2, -1], wd: [0.55, 0.45, -0.7], ty: 0.55, tz: 0.05, drop: 0.03 }], [0.48, { rh: [-0.6, 0.24, 0.32], rp: [-0.2, -1, -0.4], wd: [-0.85, 0.05, 0.5], ty: -0.6, tx: 0.1, lunge: 0.2, drop: 0.06 }], [0.6, { rh: [-0.58, 0.22, 0.28], rp: [-0.2, -1, -0.4], wd: [-0.85, 0.0, 0.5], ty: -0.55, lunge: 0.18, drop: 0.05 }], [1, G_GUARD]],
  blade2: [[0, G_GUARD], [0.32, { rh: [-0.26, 0.14, -0.12], rp: [-0.4, -0.6, -1], wd: [0.05, 0.15, 1], ty: -0.45, drop: 0.06 }], [0.48, { rh: [-0.05, 0.36, 0.62], rp: [-0.6, -1, -0.2], wd: [0.05, 0.02, 1], ty: 0.32, tx: 0.2, lunge: 0.6, drop: 0.15 }], [0.62, { rh: [-0.06, 0.34, 0.58], rp: [-0.6, -1, -0.2], wd: [0.05, 0.0, 1], ty: 0.3, tx: 0.18, lunge: 0.55, drop: 0.14 }], [1, G_GUARD]],
  axe: [[0, { ...G_GUARD, wd: [-0.1, 0.6, 0.8] }], [0.38, { rh: [-0.14, 0.9, -0.18], rp: [-1, 0.2, -0.2], wd: [0.0, 0.45, -0.9], tx: -0.22, ty: -0.15, drop: 0.02 }], [0.55, { rh: [-0.08, 0.1, 0.5], rp: [-0.6, -1, 0], wd: [0, -0.55, 0.8], tx: 0.48, ty: 0.1, drop: 0.15, lunge: 0.35 }], [0.68, { rh: [-0.08, 0.08, 0.48], rp: [-0.6, -1, 0], wd: [0, -0.6, 0.75], tx: 0.45, ty: 0.1, drop: 0.14, lunge: 0.33 }], [1, { ...G_GUARD, wd: [-0.1, 0.6, 0.8] }]],
  tool: [[0, { rh: [-0.2, 0.1, 0.3], rp: [-1, -0.5, -0.3], wd: [0.1, 0.5, 0.85], two: -0.12 }], [0.4, { rh: [-0.1, 0.85, -0.12], rp: [-1, 0.3, -0.2], wd: [0.05, 0.4, -0.9], tx: -0.25, two: -0.12 }], [0.58, { rh: [-0.05, 0.05, 0.48], rp: [-0.6, -1, 0], wd: [0.05, -0.6, 0.8], tx: 0.55, drop: 0.18, lunge: 0.3, two: -0.12 }], [0.7, { rh: [-0.05, 0.04, 0.46], rp: [-0.6, -1, 0], wd: [0.05, -0.65, 0.75], tx: 0.5, drop: 0.16, lunge: 0.28, two: -0.12 }], [1, { rh: [-0.2, 0.1, 0.3], rp: [-1, -0.5, -0.3], wd: [0.1, 0.5, 0.85], two: -0.12 }]],
  spear: [[0, { rh: [-0.22, 0.06, 0.08], rp: [-1, -0.4, -0.6], wd: [0.08, 0.06, 1], two: 0.5 }], [0.35, { rh: [-0.24, 0.04, -0.2], rp: [-1, -0.4, -0.6], wd: [0.08, 0.08, 1], ty: -0.35, drop: 0.05, two: 0.5 }], [0.52, { rh: [-0.1, 0.22, 0.42], rp: [-1, -0.6, -0.2], wd: [0.04, 0.0, 1], ty: 0.3, tx: 0.15, lunge: 0.6, drop: 0.14, two: 0.5 }], [0.64, { rh: [-0.1, 0.2, 0.4], rp: [-1, -0.6, -0.2], wd: [0.04, 0.0, 1], ty: 0.28, tx: 0.14, lunge: 0.55, drop: 0.13, two: 0.5 }], [1, { rh: [-0.22, 0.06, 0.08], rp: [-1, -0.4, -0.6], wd: [0.08, 0.06, 1], two: 0.5 }]],
  spear1: [[0, { rh: [-0.3, 0.5, -0.06], rp: [-1, -0.2, -0.6], wd: [0.05, -0.15, 1] }], [0.35, { rh: [-0.32, 0.6, -0.26], rp: [-1, -0.2, -0.6], wd: [0.05, -0.12, 1], ty: -0.3 }], [0.52, { rh: [-0.16, 0.5, 0.52], rp: [-1, -0.4, -0.2], wd: [0.02, -0.25, 1], ty: 0.3, tx: 0.1, lunge: 0.5, drop: 0.1 }], [0.64, { rh: [-0.16, 0.5, 0.5], rp: [-1, -0.4, -0.2], wd: [0.02, -0.25, 1], ty: 0.28, lunge: 0.48, drop: 0.1 }], [1, { rh: [-0.3, 0.5, -0.06], rp: [-1, -0.2, -0.6], wd: [0.05, -0.15, 1] }]],
  knife: [[0, { rh: [-0.2, 0.26, 0.24], rp: [-1, -0.8, -0.3], wd: [0, 0.35, 0.95] }], [0.2, { rh: [-0.25, 0.28, 0.0], rp: [-1, -0.6, -0.5], wd: [0.05, 0.1, 1], ty: -0.3 }], [0.36, { rh: [-0.05, 0.34, 0.56], rp: [-0.8, -1, -0.2], wd: [0.05, 0.0, 1], ty: 0.32, lunge: 0.3, drop: 0.06 }], [0.55, { rh: [-0.06, 0.33, 0.52], rp: [-0.8, -1, -0.2], wd: [0.05, 0.0, 1], ty: 0.3, lunge: 0.28, drop: 0.05 }], [1, { rh: [-0.2, 0.26, 0.24], rp: [-1, -0.8, -0.3], wd: [0, 0.35, 0.95] }]],
  fist: [[0, { rh: [-0.14, 0.38, 0.24], rp: [-1, -1, -0.3], lh: [0.14, 0.42, 0.26], lp: [1, -1, -0.3] }], [0.15, { rh: [-0.15, 0.37, 0.18], rp: [-1, -1, -0.3], lh: [0.14, 0.42, 0.26], lp: [1, -1, -0.3], ty: -0.12 }], [0.34, { rh: [-0.04, 0.46, 0.6], rp: [-1, -0.5, -0.2], lh: [0.14, 0.4, 0.22], lp: [1, -1, -0.3], ty: 0.35, lunge: 0.22, drop: 0.04 }], [0.5, { rh: [-0.06, 0.44, 0.52], rp: [-1, -0.5, -0.2], lh: [0.14, 0.4, 0.22], lp: [1, -1, -0.3], ty: 0.3, lunge: 0.2 }], [1, { rh: [-0.14, 0.38, 0.24], rp: [-1, -1, -0.3], lh: [0.14, 0.42, 0.26], lp: [1, -1, -0.3] }]],
  throw: [[0, { rh: [-0.3, 0.45, 0.0], rp: [-1, -0.6, -0.3], wd: [0, 0.6, 0.8] }], [0.4, { rh: [-0.36, 0.62, -0.36], rp: [-1, -0.5, 0], wd: [0.05, 0.35, 0.94], ty: -0.6, tx: -0.15, lh: [0.32, 0.45, 0.42], lp: [1, -1, 0] }], [0.55, { rh: [-0.12, 0.62, 0.48], rp: [-1, -0.6, 0], wd: [0, 0.15, 1], ty: 0.42, tx: 0.25, lunge: 0.45, drop: 0.08, lh: [0.25, 0.12, 0.18], lp: [1, -1, 0] }], [0.7, { rh: [-0.08, 0.3, 0.5], rp: [-1, -0.8, 0], wd: [0, -0.1, 1], ty: 0.4, tx: 0.22, lunge: 0.4, drop: 0.07, lh: [0.25, 0.12, 0.18], lp: [1, -1, 0] }], [1, { rh: [-0.3, 0.45, 0.0], rp: [-1, -0.6, -0.3], wd: [0, 0.6, 0.8] }]],
  rod: [[0, { rh: [-0.14, 0.28, 0.38], rp: [-1, -0.8, -0.3], wd: [0, 0.75, 0.65] }], [0.35, { rh: [-0.16, 0.78, -0.02], rp: [-1, -0.3, -0.3], wd: [0, 0.75, -0.65], tx: -0.15 }], [0.55, { rh: [-0.08, 0.42, 0.52], rp: [-1, -0.8, 0], wd: [0, 0.35, 0.94], tx: 0.2, lunge: 0.2 }], [1, { rh: [-0.14, 0.28, 0.38], rp: [-1, -0.8, -0.3], wd: [0, 0.75, 0.65] }]],
};
ATK.trident = ATK.spear;
const FISH_POSE = { rh: [-0.14, 0.28, 0.38], rp: [-1, -0.8, -0.3], wd: [0, 0.7, 0.7] };
const _kv = {};
function keyPose(p, K) {
  let i = 0; while (i < K.length - 2 && p > K[i + 1][0]) i++;
  const [p0, a] = K[i], [p1, b] = K[i + 1];
  const k = ease((p - p0) / Math.max(1e-4, p1 - p0));
  for (const key in _kv) delete _kv[key];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const va = a[key], vb = b[key];
    if (Array.isArray(va) || Array.isArray(vb)) { const A = va || vb, B = vb || va; _kv[key] = [lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k)]; }
    else _kv[key] = lerp(va || 0, vb || 0, k);
  }
  return _kv;
}
function footPath(ph, L, beta, lift) {
  const u = fract(ph);
  if (u < beta) { const q = u / beta; return [L / 2 - q * L, 0.05 * seg(q, 0.72, 1), 0.45 * seg(q, 0.7, 1)]; }
  const sw = (u - beta) / (1 - beta), e = sw * sw * (3 - 2 * sw);
  return [-L / 2 + L * e, lift * Math.sin(PI * sw) + 0.05 * (1 - sw), lerp(0.45, -0.22, ease(sw * 1.3))];
}
const _T = new THREE.Vector3(), _pole = new THREE.Vector3(), _S = new THREE.Vector3();
const FWD = new THREE.Vector3(0, 0, 1);
export function animateHuman(h, dt, s = {}) {
  const u = h.userData; if (!u.body) return;
  const A = u._an || (u._an = { ph: 0, t: 0, blk: 0, sit: 0, swim: 0, fish: 0, carry: 0, spd: 0, atkW: 0, kneel: 0 });
  if (A.kneel == null) A.kneel = 0;
  dt = clamp(dt || 0, 0, 0.1);
  A.t += dt; const t = s.t != null ? s.t : A.t;
  const speed = Math.max(0, s.speed || 0);
  const kk = 1 - Math.exp(-dt * 10);
  A.spd = lerp(A.spd, speed, kk); const sp = A.spd;
  const appr = (k, on, rate) => (A[k] = lerp(A[k], on ? 1 : 0, 1 - Math.exp(-dt * rate)));
  appr('blk', s.block, 14); appr('sit', s.sit || s.row, 8); appr('swim', s.swim, 6); appr('fish', s.fishing && !s.attack, 6); appr('carry', s.carry, 8); appr('kneel', s.kneel && !s.swim && !s.ride, 5);
  const wk = u._wkey, hasShield = !!u.gear.offhand;
  const dead = s.dead || 0, dodge = s.dodge != null && s.dodge >= 0 ? s.dodge : -1;
  // ---------- позы по умолчанию ----------
  let by = HUM.hip, bz = 0, bx = 0, brx = 0, bry = 0, brz = 0;
  let hry = 0, hrz = 0, trx = 0, try_ = 0, trz = 0, nry = 0, nrx = 0, hdx = 0, hdz = 0;
  const aL = [0.02, 0, 0.1], aR = [0.02, 0, -0.1]; let eL = -0.15, eR = -0.15; const wL = [0, 0, 0], wR = [0, 0, 0];
  let ikR = null, ikL = null, ikRw = 0, ikLw = 0, two = 0, rwIK = 0, lwIK = 0, wdR = null;
  const fL = [0.11, HUM.ankle, 0.02], fR = [-0.11, HUM.ankle, -0.02]; let pL = 0, pR = 0;
  let legFK = null; // {lx, ls, rx, rs, lz, rz}
  let cape = 0.08;
  // ---------- ходьба / бег ----------
  const moving = sp > 0.15;
  const k = ease((sp - 1.6) / 2.9);
  let beta = lerp(0.6, 0.31, k); if (s.running) beta = Math.min(beta, lerp(0.31, 0.24, ease((sp - 6) / 3)));
  const Lmax = lerp(0.7, 0.86, k);
  const f = Math.max(0.85, (sp * beta) / Lmax);
  const L = moving ? (sp * beta) / f : 0;
  if (moving) A.ph = fract(A.ph + dt * f);
  const mw = ease(sp / 0.7);
  {
    const lift = lerp(0.1, 0.3, k) * mw;
    const [zl, yl, pl] = footPath(A.ph, L, beta, lift), [zr, yr, pr] = footPath(A.ph + 0.5, L, beta, lift);
    const fx = lerp(0.1, 0.075, k);
    fL[0] = lerp(fL[0], fx, mw); fR[0] = lerp(fR[0], -fx, mw);
    fL[1] += yl * mw; fR[1] += yr * mw; fL[2] = lerp(fL[2], zl, mw); fR[2] = lerp(fR[2], zr, mw);
    pL = pl * mw; pR = pr * mw;
    const nL = L > 0.01 ? zl / (L / 2) : 0, nR = L > 0.01 ? zr / (L / 2) : 0;
    const bob = lerp(0.022, -0.04, k) * Math.cos(4 * PI * (A.ph - beta / 2));
    by += (-lerp(0.015, 0.075, k) + bob) * mw;
    hry = -0.13 * (nL - nR) * 0.5 * mw;
    try_ = 0.1 * (nL - nR) * 0.5 * mw;
    hrz = 0.04 * Math.sin(2 * PI * A.ph) * mw * (1 - k);
    trx = (0.03 + 0.16 * k + (s.running ? 0.05 : 0)) * mw;
    nry = -try_ * 0.9; nrx = -trx * 0.6;
    const aa = lerp(0.32, 0.75, k) * mw;
    aL[0] = aa * nL; aR[0] = aa * nR;
    eL = -(lerp(0.2, 1.35, k * mw) + 0.35 * Math.max(0, -nL) * mw);
    eR = -(lerp(0.2, 1.35, k * mw) + 0.35 * Math.max(0, -nR) * mw);
    aL[2] = 0.1 + 0.06 * k; aR[2] = -0.1 - 0.06 * k;
    cape = 0.12 + sp * 0.07 + Math.sin(t * f * TAU * 2) * 0.04 * mw;
  }
  // дыхание в покое
  const idle = 1 - mw;
  trx += 0.012 * Math.sin(t * 1.7) * idle; aL[0] += 0.03 * Math.sin(t * 1.3) * idle; aR[0] += 0.03 * Math.sin(t * 1.3 + 1) * idle;
  by += 0.004 * Math.sin(t * 1.7) * idle; nrx += Math.sin(t * 0.37) * 0.04 * idle; nry += Math.sin(t * 0.23) * 0.12 * idle;
  // ---------- что в руках ----------
  if (wk && wk !== 'bow' && wk !== 'torch' && wk !== 'sling') { aR[0] = aR[0] * 0.5 - 0.22; eR = Math.min(eR, -0.65); }
  if (wk === 'torch') { aR[0] = aR[0] * 0.3 - 0.45; aR[2] = -0.12; eR = -1.1; wR[0] = -0.8; }
  if (wk === 'hasta' || wk === 'trident' || wk === 'pilum') { wR[0] = -0.9; }
  if (wk && wk.startsWith('rod')) { wR[0] = -1.4; }
  if (wk === 'bow') { aL[0] = aL[0] * 0.4 - 0.15; aL[2] = 0.18; eL = -0.7; }
  if (u._torchL) { aL[0] = aL[0] * 0.3 - 0.45; aL[2] = 0.12; eL = -1.1; wL[0] = -0.8; }
  if (hasShield) { aL[0] = aL[0] * 0.25 - 0.15; aL[2] = 0.2; eL = -1.38; }
  // ---------- переноска ----------
  if (A.carry > 0.01) {
    const w = A.carry; ikR = { t: [-0.17, 0.2, 0.36], p: [-1, -0.8, -0.3] }; ikL = { t: [0.17, 0.2, 0.36], p: [1, -0.8, -0.3] }; ikRw = ikLw = w;
  }
  // ---------- рыбалка: удочка вперёд-вверх ----------
  if (A.fish > 0.01 && !s.attack) { ikR = { t: FISH_POSE.rh, p: FISH_POSE.rp }; ikRw = A.fish; wdR = FISH_POSE.wd; }
  // ---------- блок ----------
  if (A.blk > 0.01) {
    const w = A.blk;
    by -= 0.1 * w; trx += 0.12 * w;
    fL[0] = lerp(fL[0], 0.15, w * idle); fL[2] = lerp(fL[2], 0.2, w * idle); fR[0] = lerp(fR[0], -0.14, w * idle); fR[2] = lerp(fR[2], -0.22, w * idle);
    if (hasShield) {
      aL[0] = lerp(aL[0], -0.95, w); aL[2] = lerp(aL[2], 0.12, w); eL = lerp(eL, -0.95, w);
      aR[0] = lerp(aR[0], -0.45, w); aR[2] = lerp(aR[2], -0.3, w); eR = lerp(eR, -1.3, w);
    } else {
      ikR = { t: [-0.08, 0.5, 0.42], p: [-1, -1, 0] }; ikRw = w; wdR = [0.8, 0.5, 0.3];
      ikL = { t: [0.1, 0.45, 0.36], p: [1, -1, 0] }; ikLw = w * (wk ? 0.5 : 1);
    }
  }
  // ---------- атака ----------
  const at = s.attack;
  if (at && at.p != null) {
    const p = clamp(at.p, 0, 1);
    let kind = at.kind || 'fist';
    let K;
    if (kind === 'blade') K = ATK['blade' + ((at.combo | 0) % 3)];
    else if (kind === 'spear' || kind === 'trident') K = hasShield ? ATK.spear1 : ATK.spear;
    else if (kind === 'bow') K = null;
    else K = ATK[kind] || ATK.fist;
    const w = seg(p, 0, 0.1) * (1 - seg(p, 0.86, 1));
    if (K) {
      const kp = keyPose(p, K);
      ikR = { t: kp.rh, p: kp.rp }; ikRw = Math.max(w, ikRw * (1 - w)); rwIK = kp.rw || 0; wdR = kp.wd || null;
      if (kp.lh) { ikL = { t: kp.lh, p: kp.lp || [1, -1, -0.3] }; ikLw = w; }
      two = kp.two || 0;
      if (kind === 'axe' && !hasShield && !kp.lh) two = -0.12;
      if ((kind === 'spear' || kind === 'trident') && hasShield) two = 0;
      try_ += (kp.ty || 0) * w; trx += (kp.tx || 0) * w; trz += (kp.tz || 0) * w;
      nry -= (kp.ty || 0) * 0.7 * w;
      const lunge = (kp.lunge || 0) * w, drop = (kp.drop || 0) * w;
      by -= drop;
      fR[2] += lunge * 0.55 * idle; fL[2] -= lunge * 0.35 * idle; bz += lunge * 0.12;
    } else {
      // лук: левая рука вытянута, правая натягивает тетиву к щеке
      const kp = keyPose(p, [[0, { aim: 0.3, draw: 0 }], [0.22, { aim: 1, draw: 0.05 }], [0.55, { aim: 1, draw: 1 }], [0.6, { aim: 1, draw: 0, rel: 1 }], [0.85, { aim: 1, draw: 0, rel: 1 }], [1, { aim: 0.3, draw: 0 }]]);
      const aim = kp.aim * seg(p, 0, 0.12) + (1 - seg(p, 0, 0.12)) * 0.0;
      const tw = -0.75 * aim; try_ += tw; nry -= tw * 0.95; hry += tw * 0.4;
      // вперёд в системе торса после поворота
      const fx = Math.sin(-tw), fz = Math.cos(-tw);
      const grip = [0.2 + 0.56 * fx, 0.47, 0.56 * fz];
      ikL = { t: grip, p: [0.3, -1, -0.5] }; ikLw = aim;
      const dl = 0.14 + 0.5 * kp.draw + 0.1 * (kp.rel || 0);
      ikR = { t: [grip[0] - fx * dl, grip[1] + 0.12 * Math.min(1, kp.draw * 2 + (kp.rel || 0)), grip[2] - fz * dl], p: [-0.6, 0.5, -1] }; ikRw = aim;
      lwIK = 0;
      if (u.gear.weapon && u.gear.weapon.userData.string) setBowDraw(u.gear.weapon, kp.draw);
    }
  } else if (u.gear.weapon && u.gear.weapon.userData.string) setBowDraw(u.gear.weapon, 0);
  // ---------- сидя / гребля ----------
  if (A.sit > 0.01) {
    const w = A.sit;
    by = lerp(by, 0.5, w); trx = lerp(trx, 0.05, w);
    legFK = { lx: -1.45, ls: 1.4, rx: -1.45, rs: 1.4, lz: 0.08, rz: -0.08, w };
    if (s.row) {
      const r = (t * 1.1) % 1, st = r < 0.55 ? ease(r / 0.55) : 1 - ease((r - 0.55) / 0.45);
      trx = lerp(trx, lerp(0.45, -0.2, st), w);
      const z = lerp(0.55, 0.12, st), y = lerp(0.22, 0.12, st);
      ikR = { t: [-0.16, y, z], p: [-1, -0.6, -0.4] }; ikL = { t: [0.16, y, z], p: [1, -0.6, -0.4] }; ikRw = ikLw = w;
    } else if (!at) {
      aL[0] = lerp(aL[0], -0.6, w); eL = lerp(eL, -0.7, w); aR[0] = lerp(aR[0], -0.6, w); eR = lerp(eR, -0.7, w);
    }
  }
  // ---------- верхом: ноги обхватывают бока коня ----------
  if (s.ride) {
    trx = 0.08; aL[0] = -0.35; eL = -0.9; if (!at) { aR[0] = -0.35; eR = -0.9; }
    legFK = { lx: -0.75, ls: 1.25, rx: -0.75, rs: 1.25, lz: 0.42, rz: -0.42, w: 1 };
  }
  // ---------- на коленях (пленник сдаётся): правое колено на земле, левая нога согнута впереди ----------
  if (A.kneel > 0.01) {
    const w = A.kneel, bw = 0.012 * Math.sin(t * 1.5);
    const mw0 = 1 - w;
    by = lerp(by, 0.5 + bw, w); bz = lerp(bz, -0.04, w); brx = lerp(brx, 0, w);
    hry *= mw0; hrz *= mw0; try_ *= mw0;
    trx = lerp(trx, 0.5 + bw * 2, w); trz = lerp(trz, 0.03, w);
    nrx = lerp(nrx, 0.95, w); nry = lerp(nry, 0.08 * Math.sin(t * 0.3), w);
    // левая рука на колене выставленной ноги, правая (с оружием) свисает вдоль тела
    if (hasShield) { aL[0] = lerp(aL[0], -0.55, w); aL[2] = lerp(aL[2], 0.16, w); eL = lerp(eL, -1.5, w); }   // щит опущен, кромкой у земли
    else { aL[0] = lerp(aL[0], -0.55, w); aL[2] = lerp(aL[2], 0.12, w); eL = lerp(eL, -0.55, w); wL[0] = lerp(wL[0], 0.3, w); }
    aL[1] = lerp(aL[1], 0, w);
    aR[0] = lerp(aR[0], wk ? 0.05 : -0.3, w); aR[2] = lerp(aR[2], -0.14, w); eR = lerp(eR, wk ? -0.25 : -0.5, w);
    if (wk) wR[0] = lerp(wR[0], -0.4, w);   // клинок остриём вниз-вперёд, к земле
    ikRw *= mw0; ikLw *= mw0;
    legFK = { lx: -1.38, ls: 1.62, rx: 0.12, rs: 1.6, lz: 0.1, rz: -0.06, lf: -0.18, rf: 1.15, w };
    cape = lerp(cape, 0.05, w);
  }
  // ---------- плавание ----------
  if (A.swim > 0.01) {
    const w = A.swim, sc = (t * 1.05) % 1;
    brx = lerp(brx, 1.38, w); by = lerp(by, 0.05, w); trx *= 1 - w; try_ *= 1 - w;
    nrx = lerp(nrx, -1.05, w);
    const st = Math.sin(sc * TAU);
    // руки: гребок брассом — вперёд, в стороны и назад к груди
    aL[0] = lerp(aL[0], -2.6 + 0.5 * Math.max(0, st), w); aL[2] = lerp(aL[2], 0.25 + 0.7 * Math.max(0, st), w); eL = lerp(eL, -0.3 - 1.2 * Math.max(0, -st), w);
    aR[0] = lerp(aR[0], -2.6 + 0.5 * Math.max(0, st), w); aR[2] = lerp(aR[2], -0.25 - 0.7 * Math.max(0, st), w); eR = lerp(eR, -0.3 - 1.2 * Math.max(0, -st), w);
    ikRw *= 1 - w; ikLw *= 1 - w;
    const kick = Math.max(0, Math.sin(sc * TAU + 1.5));
    legFK = { lx: 0.1 - 0.9 * kick, ls: 0.3 + 1.6 * kick, rx: 0.1 - 0.9 * kick, rs: 0.3 + 1.6 * kick, lz: 0.15 + 0.25 * kick, rz: -0.15 - 0.25 * kick, w };
    cape = 0.9 * w + cape * (1 - w);
  }
  // ---------- кувырок ----------
  if (dodge >= 0) {
    const p = clamp(dodge, 0, 1), tuck = Math.sin(PI * p);
    brx = TAU * ease(p); by = lerp(HUM.hip, 0.42, Math.min(1, tuck * 1.6));
    trx = 0.6 * tuck; nrx = 0.5 * tuck;
    legFK = { lx: -1.9 * tuck, ls: 2.1 * tuck, rx: -1.8 * tuck, rs: 2.0 * tuck, lz: 0.1, rz: -0.1, w: Math.min(1, tuck * 3) };
    aL[0] = -1.2 * tuck; eL = -1.6 * tuck; aR[0] = -1.2 * tuck; eR = -1.6 * tuck;
    ikRw *= 1 - tuck; ikLw *= 1 - tuck;
  }
  // ---------- вздрагивание от удара ----------
  const hit = s.hit || 0;
  if (hit > 0) { const fh = Math.sin(PI * clamp(hit, 0, 1)); trx -= 0.3 * fh; nrx -= 0.25 * fh; bz -= 0.07 * fh; aL[2] += 0.3 * fh; aR[2] -= 0.3 * fh; try_ += 0.15 * fh; }
  // ---------- смерть: падение на спину ----------
  if (dead > 0) {
    const kd = ease(dead / 0.4), bounce = Math.sin(clamp((dead - 0.4) / 0.15, 0, 1) * PI) * 0.06;
    brx = lerp(brx, -HPI, kd); by = lerp(by, 0.13 + bounce, kd); bz = lerp(bz, -0.45, kd);
    trx = lerp(trx, -0.05, kd); try_ *= 1 - kd; nrx = lerp(nrx, 0.1, kd); nry = lerp(nry, 0.7, kd);
    aL[0] = lerp(aL[0], -0.2, kd); aL[2] = lerp(aL[2], 1.3, kd); eL = lerp(eL, -0.5, kd);
    aR[0] = lerp(aR[0], -0.3, kd); aR[2] = lerp(aR[2], -1.1, kd); eR = lerp(eR, -0.8, kd); wR[0] = lerp(wR[0], -1.9, kd);
    ikRw *= 1 - kd; ikLw *= 1 - kd;
    legFK = { lx: -0.15, ls: 0.25, rx: 0.05, rs: 0.5, lz: 0.12, rz: -0.08, w: kd };
    cape = lerp(cape, 0, kd);
  }
  // ---------- применение ----------
  u.body.position.set(bx, by, bz);
  u.body.rotation.set(brx, bry, brz);
  u.hips.rotation.set(0, hry, hrz);
  u.torso.rotation.set(trx, try_ - hry * 0.3, trz);
  u.neck.rotation.set(nrx * 0.5, nry * 0.5, 0);
  u.head.rotation.set(nrx * 0.5 + hdx, nry * 0.5, hdz);
  // руки: прямая кинематика ↔ ИК
  const sideArm = (side, a, e, wv, ik, ikw, wIK, wd = null) => {
    const arm = u['arm' + side], fore = u['fore' + side], hand = u['hand' + side];
    _eu.set(a[0], a[1], a[2]); _q1.setFromEuler(_eu);
    let bend = -e;
    if (ik && ikw > 0.001) {
      _T.set(...ik.t); _pole.set(...ik.p).normalize();
      const bI = ik2(arm.position, _T, _pole, HUM.A1, HUM.A2, 1, _q2);
      _q1.slerp(_q2, ikw); bend = lerp(bend, bI, ikw);
      wv = [lerp(wv[0], wIK, ikw), wv[1], wv[2]];
    }
    arm.quaternion.copy(_q1);
    fore.rotation.set(-bend, 0, 0);
    hand.rotation.set((side === 'R' ? HUM.hand0 : 0) + wv[0], wv[1], wv[2]);
    // направление оружия задано явно: поворачиваем кисть так, чтобы её ось +Y смотрела в wd (в системе торса)
    if (wd && ikw > 0.001) {
      _q3.copy(arm.quaternion).multiply(fore.quaternion);
      _Y.set(wd[0], wd[1], wd[2]).normalize();
      _Z.set(0, 0, 1).applyQuaternion(_q3); _Z.addScaledVector(_Y, -_Z.dot(_Y));
      if (_Z.lengthSq() < 1e-6) { _Z.set(1, 0, 0).applyQuaternion(_q3); _Z.addScaledVector(_Y, -_Z.dot(_Y)); }
      _Z.normalize(); _X.crossVectors(_Y, _Z);
      _m4.makeBasis(_X, _Y, _Z); _q4.setFromRotationMatrix(_m4);
      _q3.invert().multiply(_q4);
      hand.quaternion.slerp(_q3, ikw);
    }
  };
  sideArm('R', aR, eR, wR, ikR, ikRw, rwIK, wdR);
  // вторая рука на древке (копьё, кирка, топор без щита)
  if (two && ikRw > 0.01 && !hasShield) {
    // положение и направление оружия в системе торса
    _q3.copy(u.armR.quaternion).multiply(u.foreR.quaternion).multiply(u.handR.quaternion);
    const hp = _S.set(0, -HUM.A1, 0).applyQuaternion(u.armR.quaternion).add(u.armR.position);
    _a.set(0, -HUM.A2, 0).applyQuaternion(_q4.copy(u.armR.quaternion).multiply(u.foreR.quaternion)); hp.add(_a);
    const dir = _b.set(0, 1, 0).applyQuaternion(_q3);
    ikL = { t: [hp.x + dir.x * two, hp.y + dir.y * two, hp.z + dir.z * two], p: [1, -0.6, -0.4] }; ikLw = ikRw;
  }
  sideArm('L', aL, eL, wL, ikL, ikLw, lwIK);
  // ноги: ИК по целям стоп в системе модели, либо прямые углы
  u.body.updateMatrix(); u.hips.updateMatrix();
  _m5.multiplyMatrices(u.body.matrix, u.hips.matrix).invert();
  _q3.copy(u.body.quaternion).multiply(u.hips.quaternion).invert();
  for (const side of ['L', 'R']) {
    const leg = u['leg' + side], shin = u['shin' + side], foot = u['foot' + side];
    const ft = side === 'L' ? fL : fR, pitch = side === 'L' ? pL : pR;
    _T.set(ft[0], ft[1], ft[2]).applyMatrix4(_m5);
    _pole.set(side === 'L' ? 0.15 : -0.15, 0, 1).applyQuaternion(_q3);
    const bend = ik2(leg.position, _T, _pole, HUM.L1, HUM.L2, -1, _q1);
    let sb = bend;
    if (legFK && legFK.w > 0) {
      const lx = side === 'L' ? legFK.lx : legFK.rx, ls = side === 'L' ? legFK.ls : legFK.rs, lz = side === 'L' ? legFK.lz : legFK.rz;
      _eu.set(lx, 0, lz); _q2.setFromEuler(_eu);
      _q1.slerp(_q2, legFK.w); sb = lerp(bend, ls, legFK.w);
    }
    leg.quaternion.copy(_q1);
    shin.rotation.set(sb, 0, 0);
    // стопа горизонтально (с учётом носка), кроме особых поз
    _q2.copy(u.body.quaternion).multiply(u.hips.quaternion).multiply(leg.quaternion).multiply(_q4.setFromEuler(shin.rotation)).invert();
    _eu.set(pitch, 0, 0); _q4.setFromEuler(_eu);
    foot.quaternion.copy(_q2.multiply(_q4));
    if (legFK && legFK.w > 0) { _q4.identity(); _eu.set((side === 'L' ? legFK.lf : legFK.rf) ?? 0.5, 0, 0); _q4.setFromEuler(_eu); foot.quaternion.slerp(_q4, legFK.w); }
  }
  // плащ, факел, леска
  if (u.cape) u.cape.rotation.x = clamp(cape, 0, 1.0);
  if (u.gear.cloak) u.gear.cloak.rotation.x = clamp(cape, 0, 1.0);
  if (u.torchFlame) {
    const fl = 1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 29.3) * 0.08;
    u.torchFlame.scale.set(1 + (fl - 1) * 0.5, fl, 1 + (fl - 1) * 0.5);
    u.torchLight.intensity = 55 * fl;
    // пламя всегда вверх
    u.torchFlame.parent.updateWorldMatrix(true, false);
    u.torchFlame.parent.getWorldQuaternion(_q1); _q1.invert();
    h.getWorldQuaternion(_q2); u.torchFlame.quaternion.copy(_q1.multiply(_q2));
  }
  const w = u.gear.weapon;
  if (w) w.traverse((c) => {
    if (c.userData.hang) {
      c.parent.updateWorldMatrix(true, false);
      c.parent.getWorldQuaternion(_q1); _q1.invert(); h.getWorldQuaternion(_q2);
      c.quaternion.copy(_q1.multiply(_q2));
    }
  });
}

// ======================================================================
// Звери
// ======================================================================
// нога из двух звеньев; rest — углы покоя [бедро, голень], длины подбираются так, чтобы копыто стояло на земле
function aLeg(body, x, y, z, H, r1, r2, mat, foot, hind, rest) {
  const [a1, a2] = rest;
  const ext = 0.5 * Math.cos(a1) + 0.5 * Math.cos(a1 + a2);
  const L1 = (0.5 * H) / ext, L2 = (0.5 * H) / ext;
  const upper = grp(body, x, y, z);
  P(upper, sph(r1 * 1.55, 10, 8), mat, 0, -L1 * 0.18, hind ? -r1 * 0.3 : 0, 0, 0, 0, 1, 2.0, 1.35);   // мышца бедра/плеча
  P(upper, cyl(r1, r1 * 0.72, L1, 8), mat, 0, -L1 / 2, 0);
  const lower = grp(upper, 0, -L1, 0);
  P(lower, sph(r1 * 0.78, 8, 6), mat);
  P(lower, cyl(r2, r2 * 0.85, L2, 8), mat, 0, -L2 / 2, 0);
  foot(lower, -L2);
  upper.rotation.x = a1; lower.rotation.x = a2;
  return { upper, lower, L1, L2, hind, rest };
}
const hoof = (col = 0x2a2018, r = 0.035) => (par, y) => { P(par, cyl(r * 0.85, r * 1.1, r * 1.4, 8), M(col), 0, y + r * 0.7, 0.005); };
const paw = (col, r = 0.05) => (par, y) => { P(par, sph(r, 8, 6), M(col), 0, y + r * 0.6, r * 0.45, 0, 0, 0, 1, 0.7, 1.35); };
// туловище: грудь, живот, круп (эллипсоиды)
function aTorso(body, len, gr, wid, mat, belly, chestK = 1.1, rumpK = 1.0) {
  P(body, sph(1, 18, 12), mat, 0, 0, 0, 0, 0, 0, gr * wid, gr, len * 0.62);
  P(body, sph(1, 14, 10), mat, 0, gr * 0.08, len * 0.3, 0, 0, 0, gr * wid * chestK, gr * chestK, len * 0.32);
  P(body, sph(1, 14, 10), mat, 0, gr * 0.05, -len * 0.3, 0, 0, 0, gr * wid * rumpK, gr * rumpK * 0.98, len * 0.3);
  if (belly) P(body, sph(1, 12, 8), M(belly), 0, -gr * 0.35, 0.02, 0, 0, 0, gr * wid * 0.8, gr * 0.62, len * 0.5);
}
function eyes(par, x, y, z, r = 0.018) {
  for (const s of [-1, 1]) { P(par, sph(r, 8, 6), M(0x14100c), s * x, y, z); P(par, sph(r * 0.35, 4, 3), M(0xffffff), s * x, y + r * 0.4, z + r * 0.6); }
}
function quadRig(g, body, neck, head, tail, legs, extra = {}) {
  g.userData = { body, neck, head, tail, legs, ...extra };
  return g;
}

export function makeAnimal(type) {
  const g = new THREE.Group(); g.name = 'animal_' + type;
  switch (type) {
    case 'deer': case 'goat': {
      const deer = type === 'deer';
      const H = deer ? 0.82 : 0.5, len = deer ? 0.95 : 0.62, gr = deer ? 0.27 : 0.21;
      const col = deer ? 0x9a6a3e : 0xa89070, mat = M(col), belly = deer ? 0xe2d2b4 : 0xd8ccb4;
      const yc = H + gr * 0.45;
      const body = grp(g, 0, yc, 0);
      aTorso(body, len, gr, deer ? 0.78 : 0.85, mat, belly, 1.08, 1.02);
      if (deer) P(body, sph(1, 10, 8), M(0xf0e6d4), 0, gr * 0.15, -len * 0.55, 0, 0, 0, gr * 0.5, gr * 0.6, 0.06);   // белое «зеркало»
      else P(body, G('goatHair', () => lumpy(new THREE.SphereGeometry(1, 12, 8), 0.12, 4)), M(darker(col, 0.85)), 0, -gr * 0.25, 0, 0, 0, 0, gr * 0.85, gr * 0.7, len * 0.55);
      const legs = [];
      const r1 = deer ? 0.05 : 0.045, r2 = deer ? 0.022 : 0.024, ft = hoof(0x2a2018, deer ? 0.026 : 0.024);
      for (const [x, z, hind] of [[0.1, len / 2, 0], [-0.1, len / 2, 0], [0.1, -len / 2, 1], [-0.1, -len / 2, 1]]) legs.push(aLeg(body, x * (deer ? 1 : 1.1), H - yc + 0.02, z, H + 0.02, r1, r2, mat, ft, hind, hind ? [0.32, -0.62] : [0.02, 0.06]));
      const neck = grp(body, 0, gr * 0.45, len * 0.5, deer ? 0.5 : 0.4);
      P(neck, cyl(deer ? 0.07 : 0.07, deer ? 0.11 : 0.1, deer ? 0.42 : 0.28, 10), mat, 0, (deer ? 0.42 : 0.28) / 2 - 0.04, 0);
      const head = grp(neck, 0, deer ? 0.4 : 0.27, 0.0, deer ? -0.15 : 0.0);
      P(head, sph(0.085, 12, 10), mat, 0, 0.0, 0.0, 0, 0, 0, deer ? 0.85 : 0.9, 0.9, 1.1);
      P(head, cyl(deer ? 0.035 : 0.04, deer ? 0.06 : 0.065, deer ? 0.17 : 0.14, 10), mat, 0, -0.03, 0.1, HPI + 0.25);
      P(head, sph(deer ? 0.034 : 0.04, 8, 6), M(0x1c1814), 0, -0.05, deer ? 0.19 : 0.17, 0, 0, 0, 1.1, 0.8, 0.8);
      eyes(head, 0.06, 0.02, 0.045);
      for (const s of [-1, 1]) {
        const ear = P(head, cone(0.032, deer ? 0.12 : 0.09, 6), mat, s * 0.06, 0.06, -0.03, 0, 0, s * -(deer ? 1.0 : 1.5)); ear.scale.z = 0.45;
      }
      if (deer) {
        const am = M(0xd8c8a0);
        for (const s of [-1, 1]) {
          P(head, tube(`ant${s}`, [[s * 0.03, 0.07, -0.02], [s * 0.1, 0.2, -0.06], [s * 0.15, 0.36, -0.04], [s * 0.13, 0.5, 0.02]], 0.016, 0.006, 8, 5), am);
          P(head, tube(`antA${s}`, [[s * 0.07, 0.15, -0.05], [s * 0.08, 0.24, 0.05], [s * 0.07, 0.3, 0.1]], 0.01, 0.004, 5, 4), am);
          P(head, tube(`antB${s}`, [[s * 0.14, 0.32, -0.05], [s * 0.21, 0.4, -0.04], [s * 0.25, 0.47, 0.0]], 0.01, 0.004, 5, 4), am);
        }
      } else {
        for (const s of [-1, 1]) P(head, tube(`ghorn${s}`, [[s * 0.03, 0.07, 0.0], [s * 0.06, 0.16, -0.06], [s * 0.08, 0.2, -0.16], [s * 0.1, 0.16, -0.24]], 0.02, 0.006, 8, 5), M(0x6a5a48));
        P(head, cone(0.025, 0.09, 6), M(0x6a5a48), 0, -0.1, 0.08, PI);  // бородка
      }
      const tail = grp(body, 0, gr * 0.3, -len * 0.62, 0.6);
      P(tail, cone(deer ? 0.04 : 0.035, deer ? 0.15 : 0.12, 6), deer ? M(0xf0e6d4) : mat, 0, deer ? -0.06 : 0.05, 0, deer ? PI : 0);
      return quadRig(g, body, neck, head, tail, legs, { yc, size: H, kind: 'prey', gr, wid: 0.8 });
    }
    case 'boar': {
      const H = 0.5, len = 0.95, gr = 0.34, col = 0x4a3a2e, mat = M(col);
      const yc = H + gr * 0.45;
      const body = grp(g, 0, yc, 0);
      aTorso(body, len, gr, 0.72, mat, 0x5a4a3c, 1.18, 0.95);
      for (let i = 0; i < 9; i++) P(body, cone(0.045, 0.16, 5), M(0x2a2018), 0, gr * 1.02 + Math.sin((i / 8) * PI) * 0.03, len * 0.4 - i * 0.1, -0.5 - i * 0.04);   // щетина-грива
      const legs = [];
      for (const [x, z, hind] of [[0.13, len / 2 - 0.05, 0], [-0.13, len / 2 - 0.05, 0], [0.12, -len / 2 + 0.05, 1], [-0.12, -len / 2 + 0.05, 1]]) legs.push(aLeg(body, x, H - yc + 0.05, z, H + 0.05, 0.06, 0.032, mat, hoof(0x1a1410, 0.032), hind, hind ? [0.25, -0.45] : [0, 0.04]));
      const neck = grp(body, 0, 0.02, len * 0.55, -0.1);
      P(neck, cyl(0.16, 0.22, 0.2, 10), mat, 0, 0, 0.0, HPI);
      const head = grp(neck, 0, 0.0, 0.12, 0.25);
      P(head, sph(0.15, 12, 10), mat, 0, 0, 0.06, 0, 0, 0, 0.85, 0.95, 1.1);
      P(head, cyl(0.06, 0.13, 0.32, 10), mat, 0, -0.03, 0.24, HPI);
      P(head, cyl(0.065, 0.065, 0.03, 12), M(0x6a4a3e), 0, -0.03, 0.405, HPI);
      for (const s of [-1, 1]) {
        P(head, sph(0.012, 4, 3), M(0x1a1010), s * 0.022, -0.03, 0.42);
        P(head, tube(`tusk${s}`, [[s * 0.06, -0.06, 0.3], [s * 0.1, -0.03, 0.34], [s * 0.11, 0.04, 0.33]], 0.016, 0.004, 6, 5), M(0xefe6cc));
        const ear = P(head, cone(0.045, 0.12, 5), mat, s * 0.09, 0.13, 0.0, -0.3, 0, s * -0.6); ear.scale.z = 0.5;
      }
      eyes(head, 0.08, 0.05, 0.16, 0.014);
      const jaw = grp(head, 0, -0.08, 0.15);
      P(jaw, box(0.1, 0.04, 0.2), mat, 0, 0, 0.06);
      const tail = grp(body, 0, gr * 0.5, -len * 0.6, 0.3);
      P(tail, cyl(0.012, 0.008, 0.2, 5), mat, 0, -0.1, 0);
      P(tail, cone(0.025, 0.06, 5), M(0x1a1410), 0, -0.22, 0, PI);
      return quadRig(g, body, neck, head, tail, legs, { yc, size: H, kind: 'boar', jaw, gr, wid: 0.72 });
    }
    case 'wolf': case 'jackal': case 'lion': {
      const lion = type === 'lion', jack = type === 'jackal';
      const H = lion ? 0.72 : jack ? 0.36 : 0.56, len = lion ? 1.25 : jack ? 0.55 : 0.8, gr = lion ? 0.34 : jack ? 0.14 : 0.22;
      const col = lion ? 0xc49a58 : jack ? 0xb88a4e : 0x8a8478, mat = M(col);
      const belly = lion ? 0xe0c898 : jack ? 0xe0cca8 : 0xc8c0b0;
      const yc = H + gr * 0.4;
      const body = grp(g, 0, yc, 0);
      aTorso(body, len, gr, 0.75, mat, belly, lion ? 1.15 : 1.12, 0.92);
      if (!lion) P(body, G('wolfFur', () => lumpy(new THREE.SphereGeometry(1, 12, 8), 0.14, 7)), M(darker(col, 0.8)), 0, gr * 0.3, len * 0.1, 0, 0, 0, gr * 0.8, gr * 0.75, len * 0.45);
      const legs = [];
      const r1 = lion ? 0.085 : jack ? 0.03 : 0.05, r2 = lion ? 0.05 : jack ? 0.018 : 0.03;
      const pw = paw(lion ? 0xb08848 : darker(col, 0.8), lion ? 0.07 : jack ? 0.026 : 0.04);
      for (const [x, z, hind] of [[0.13, len / 2, 0], [-0.13, len / 2, 0], [0.12, -len / 2, 1], [-0.12, -len / 2, 1]]) legs.push(aLeg(body, x * (gr / 0.22) * 0.85, H - yc + 0.02, z, H + 0.02, r1, r2, mat, pw, hind, hind ? [0.35, -0.65] : [0.05, 0.05]));
      const neck = grp(body, 0, gr * 0.3, len * 0.5, lion ? 0.35 : 0.5);
      const nl = lion ? 0.32 : jack ? 0.18 : 0.26;
      P(neck, cyl(gr * 0.45, gr * 0.62, nl, 10), mat, 0, nl / 2 - 0.03, 0);
      const head = grp(neck, 0, nl, 0.0, lion ? -0.25 : -0.4);
      const hs = lion ? 1.6 : jack ? 0.65 : 1.0;
      P(head, sph(0.1 * hs, 12, 10), mat, 0, 0, 0, 0, 0, 0, 0.95, 0.88, 1.0);
      const mz = P(head, cyl(0.03 * hs, 0.06 * hs, (lion ? 0.12 : 0.17) * hs, 10), mat, 0, -0.025 * hs, 0.1 * hs, HPI);
      P(head, sph(0.025 * hs, 8, 6), M(lion ? 0x6a4030 : 0x141010), 0, -0.01 * hs, (lion ? 0.17 : 0.19) * hs, 0, 0, 0, 1.2, 0.8, 0.8);
      const jaw = grp(head, 0, -0.05 * hs, 0.06 * hs);
      P(jaw, box(0.07 * hs, 0.025 * hs, (lion ? 0.11 : 0.15) * hs), M(belly), 0, -0.005, 0.05 * hs);
      eyes(head, 0.045 * hs, 0.03 * hs, 0.075 * hs, 0.014 * hs);
      for (const s of [-1, 1]) {
        if (lion) P(head, sph(0.03 * hs, 8, 6), mat, s * 0.065 * hs, 0.07 * hs, -0.02, 0, 0, 0, 1, 1, 0.5);
        else { const ear = P(head, cone(0.035 * hs * (jack ? 1.5 : 1), 0.09 * hs * (jack ? 1.45 : 1), 4), mat, s * 0.05 * hs, 0.09 * hs, -0.02, -0.1, 0, s * -0.25); ear.scale.z = 0.5; }
      }
      if (lion) {
        const mane = M(0x7a4a22);
        P(head, G('mane', () => lumpy(new THREE.SphereGeometry(0.22, 14, 10), 0.16, 11)), mane, 0, 0.0, -0.08, 0, 0, 0, 1.15, 1.2, 1.0);
        P(neck, G('mane2', () => lumpy(new THREE.SphereGeometry(0.25, 12, 8), 0.14, 13)), mane, 0, 0.12, -0.02, 0, 0, 0, 1.0, 1.2, 1.1);
      }
      const tail = grp(body, 0, gr * 0.45, -len * 0.6, lion ? 0.55 : 0.45);
      const tl = lion ? 0.75 : jack ? 0.26 : 0.38;
      P(tail, cyl(lion ? 0.02 : jack ? 0.03 : 0.05, lion ? 0.025 : jack ? 0.045 : 0.07, tl, 8), lion ? mat : M(darker(col, 0.85)), 0, -tl / 2, 0);
      if (lion) P(tail, sph(0.05, 8, 6), M(0x5a3418), 0, -tl, 0, 0, 0, 0, 1, 1.5, 1);
      return quadRig(g, body, neck, head, tail, legs, { yc, size: H, kind: lion ? 'cat' : 'canid', jaw, gr, wid: 0.75 });
    }
    case 'bear': {
      const H = 0.62, len = 1.15, gr = 0.42, col = 0x4e3626, mat = M(col);
      const yc = H + gr * 0.5;
      const body = grp(g, 0, yc, 0);
      aTorso(body, len, gr, 0.85, mat, null, 1.12, 1.05);
      P(body, G('bearFur', () => lumpy(new THREE.SphereGeometry(1, 14, 10), 0.1, 17)), M(0x5a4030), 0, gr * 0.35, len * 0.22, 0, 0, 0, gr * 0.75, gr * 0.65, len * 0.32);   // горб
      const legs = [];
      for (const [x, z, hind] of [[0.2, len / 2, 0], [-0.2, len / 2, 0], [0.2, -len / 2 + 0.05, 1], [-0.2, -len / 2 + 0.05, 1]]) legs.push(aLeg(body, x, H - yc + 0.08, z, H + 0.08, 0.11, 0.075, mat, paw(0x3a2a1e, 0.09), hind, hind ? [0.15, -0.2] : [0, 0]));
      const neck = grp(body, 0, gr * 0.15, len * 0.52, -0.1);
      P(neck, cyl(0.2, 0.28, 0.3, 10), mat, 0, 0.0, 0.08, HPI);
      const head = grp(neck, 0, 0.0, 0.25, 0.2);
      P(head, sph(0.19, 14, 10), mat, 0, 0, 0.0, 0, 0, 0, 1, 0.9, 1);
      P(head, cyl(0.06, 0.1, 0.16, 10), M(0x6a4a34), 0, -0.04, 0.2, HPI);
      P(head, sph(0.04, 8, 6), M(0x141010), 0, -0.02, 0.28, 0, 0, 0, 1.2, 0.8, 0.8);
      const jaw = grp(head, 0, -0.1, 0.12);
      P(jaw, box(0.1, 0.04, 0.14), M(0x5a4030), 0, 0, 0.06);
      eyes(head, 0.08, 0.06, 0.15, 0.016);
      for (const s of [-1, 1]) P(head, sph(0.05, 8, 6), mat, s * 0.13, 0.13, -0.03, 0, 0, 0, 1, 1, 0.55);
      const tail = grp(body, 0, gr * 0.5, -len * 0.62, 0.5);
      P(tail, sph(0.05, 6, 5), mat, 0, 0, 0);
      return quadRig(g, body, neck, head, tail, legs, { yc, size: H, kind: 'bear', jaw, gr, wid: 0.85 });
    }
    case 'horse': {
      const H = 0.98, len = 1.05, gr = 0.34, col = 0x7a4a28, mat = M(col);
      const yc = H + gr * 0.5;
      const body = grp(g, 0, yc, 0);
      aTorso(body, len, gr, 0.72, mat, null, 1.1, 1.1);
      const legs = [];
      for (const [x, z, hind] of [[0.14, len / 2, 0], [-0.14, len / 2, 0], [0.14, -len / 2, 1], [-0.14, -len / 2, 1]]) legs.push(aLeg(body, x, H - yc + 0.05, z, H + 0.05, 0.075, 0.036, mat, (par, y) => { P(par, cyl(0.045, 0.05, 0.08, 8), M(0xe8e0d0), 0, y + 0.1, 0); hoof(0x2a2420, 0.045)(par, y); }, hind, hind ? [0.32, -0.6] : [0.02, 0.04]));
      const neck = grp(body, 0, gr * 0.35, len * 0.52, 0.62);
      P(neck, cyl(0.1, 0.19, 0.62, 12), mat, 0, 0.27, 0, 0, 0, 0, 0.75, 1, 1);
      P(neck, box(0.04, 0.6, 0.1), M(0x2a1a10), 0, 0.3, -0.13, 0.08);   // грива
      const head = grp(neck, 0, 0.6, 0.0, 0.45);
      P(head, sph(0.11, 12, 10), mat, 0, 0, 0, 0, 0, 0, 0.8, 0.9, 1.0);
      P(head, cyl(0.07, 0.1, 0.36, 10), mat, 0, 0, 0.18, HPI, 0, 0, 0.75, 1, 1);
      P(head, sph(0.075, 10, 8), M(darker(col, 0.8)), 0, -0.01, 0.37, 0, 0, 0, 0.85, 0.85, 0.75);
      for (const s of [-1, 1]) P(head, sph(0.012, 4, 3), M(0x100c08), s * 0.035, 0.0, 0.43);
      const jaw = grp(head, 0, -0.06, 0.15);
      P(jaw, box(0.08, 0.04, 0.2), mat, 0, 0, 0.08);
      eyes(head, 0.075, 0.04, 0.05, 0.018);
      for (const s of [-1, 1]) { const e = P(head, cone(0.03, 0.12, 5), mat, s * 0.05, 0.12, -0.03, -0.2, 0, s * -0.2); e.scale.z = 0.5; }
      P(head, box(0.03, 0.08, 0.12), M(0x2a1a10), 0, 0.1, 0.03, 0.4);
      const tail = grp(body, 0, gr * 0.6, -len * 0.62, 0.35);
      P(tail, tube('htail', [[0, 0, 0], [0, -0.2, -0.08], [0, -0.5, -0.08], [0, -0.75, -0.02]], 0.05, 0.03, 8, 6), M(0x2a1a10));
      return quadRig(g, body, neck, head, tail, legs, { yc, size: H, kind: 'horse', jaw, gr, wid: 0.72 });
    }
    case 'elephant': {
      // боевой слон Карфагена: попона, башенка с щитами
      const H = 1.35, len = 1.9, gr = 0.9, col = 0x8a8278, mat = M(col);
      const yc = H + gr * 0.55;
      const body = grp(g, 0, yc, 0);
      aTorso(body, len, gr, 0.8, mat, null, 1.05, 1.05);
      const legs = [];
      for (const [x, z, hind] of [[0.42, len / 2 - 0.1, 0], [-0.42, len / 2 - 0.1, 0], [0.42, -len / 2 + 0.15, 1], [-0.42, -len / 2 + 0.15, 1]]) {
        legs.push(aLeg(body, x, H - yc + 0.25, z, H + 0.25, 0.2, 0.17, mat, (par, y) => { P(par, cyl(0.19, 0.21, 0.12, 12), mat, 0, y + 0.06, 0); for (let i = 0; i < 3; i++) P(par, sph(0.04, 6, 4), M(0xd8d0c0), (i - 1) * 0.09, y + 0.04, 0.18, 0, 0, 0, 1, 0.8, 0.6); }, hind, hind ? [0.05, -0.08] : [0, 0]));
      }
      // попона и башня
      const blan = M(0x6a1a5a), fr = M(C.gold);
      P(body, G('elBlanket', () => new THREE.CylinderGeometry(gr * 0.95, gr * 0.95, len * 0.9, 20, 1, true, PI * 0.38, PI * 1.24)), M(0x6a1a5a, { side: THREE.DoubleSide }), 0, gr * 0.12, 0, HPI, 0, 0, 0.9, 1, 1.0);
      for (const s of [-1, 1]) P(body, box(0.03, 0.06, len * 0.9), fr, s * 0.73, -0.22, 0, 0, 0, s * 0.1);
      const tw = grp(body, 0, gr * 0.98, -0.05);
      P(tw, box(1.15, 0.1, 1.2), M(C.woodD), 0, 0, 0);
      for (const [x, z, w, d] of [[0, 0.58, 1.15, 0.06], [0, -0.58, 1.15, 0.06], [0.56, 0, 0.06, 1.2], [-0.56, 0, 0.06, 1.2]]) P(tw, box(w, 0.75, d), PLANK(), x, 0.42, z);
      for (const [x, z] of [[0.56, 0.58], [-0.56, 0.58], [0.56, -0.58], [-0.56, -0.58]]) P(tw, box(0.1, 1.1, 0.1), M(C.woodD), x, 0.55, z);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const sh = P(tw, cyl(0.17, 0.17, 0.03, 16), M(i % 2 ? 0xb8904a : 0x7a1a14), s * 0.6, 0.45, -0.36 + i * 0.36, 0, 0, HPI); }
      for (const s of [-1, 1]) P(tw, cyl(0.17, 0.17, 0.03, 16), M(0xb8904a), 0, 0.45, s * 0.62, HPI);
      P(tw, cyl(0.02, 0.02, 1.4, 5), M(C.woodD), 0.45, 1.1, -0.45);
      const fl = P(tw, box(0.4, 0.3, 0.01), M(0x5a2a8a, { side: THREE.DoubleSide }), 0.65, 1.62, -0.45);
      for (const s of [-1, 1]) rope(body, [s * 0.5, gr * 0.95, 0.4], [s * gr * 0.62, -gr * 0.45, 0.35], 0.02);
      for (const s of [-1, 1]) rope(body, [s * 0.5, gr * 0.95, -0.5], [s * gr * 0.62, -gr * 0.45, -0.55], 0.02);
      // шея, голова, уши, бивни, хобот
      const neck = grp(body, 0, gr * 0.2, len * 0.55, -0.15);
      P(neck, sph(0.55, 12, 10), mat, 0, 0, 0.1, 0, 0, 0, 1, 1, 0.8);
      const head = grp(neck, 0, 0.15, 0.35, 0.1);
      P(head, sph(0.48, 14, 12), mat, 0, 0.05, 0.1, 0, 0, 0, 0.95, 1.0, 0.9);
      P(head, sph(0.2, 10, 8), mat, 0, 0.42, 0.1, 0, 0, 0, 1.6, 0.7, 1.2);
      P(head, box(0.5, 0.06, 0.4), M(0x6a1a5a), 0, 0.45, 0.25, -0.3);   // налобник
      P(head, cyl(0.1, 0.1, 0.03, 12), goldM(), 0, 0.45, 0.46, HPI - 0.3);
      eyes(head, 0.3, 0.1, 0.38, 0.025);
      const ears = [];
      for (const s of [-1, 1]) {
        const ep = grp(head, s * 0.38, 0.12, -0.05, 0, s * 0.25, 0);
        P(ep, G('elEar', () => { const q = new THREE.CircleGeometry(0.5, 14); q.scale(0.75, 1, 1); return q; }), M(0x7a7268, { side: THREE.DoubleSide }), s * 0.32, -0.05, 0, 0, s * 0.15, 0);
        ears.push(ep);
        P(head, tube(`tuskE${s}`, [[s * 0.2, -0.25, 0.4], [s * 0.26, -0.45, 0.62], [s * 0.24, -0.45, 0.88], [s * 0.18, -0.32, 1.05]], 0.07, 0.025, 10, 7), M(0xf0e6cc));
      }
      const trunk = [];
      let par = grp(head, 0, -0.18, 0.48, 0.35);
      for (let i = 0; i < 9; i++) {
        const r = lerp(0.16, 0.06, i / 8), l = 0.2;
        P(par, cyl(r * 0.9, r, l, 10), mat, 0, -l / 2, 0);
        P(par, tor(r * 0.95, 0.008, 3, 8), M(0x6a6258), 0, -l * 0.5, 0, HPI);
        trunk.push(par);
        par = grp(par, 0, -l, 0, 0.12);
      }
      const tail = grp(body, 0, gr * 0.4, -len * 0.6, 0.35);
      P(tail, cyl(0.02, 0.04, 0.8, 6), mat, 0, -0.4, 0);
      P(tail, cone(0.05, 0.14, 6), M(0x2a2420), 0, -0.84, 0, PI);
      const r = quadRig(g, body, neck, head, tail, legs, { yc, size: H, kind: 'elephant', trunk, ears, gr, wid: 0.8, flag: fl });
      return r;
    }
    case 'croc': {
      // нильский крокодил: низкое тело, растопыренные лапы, хвост из звеньев
      const col = 0x4e5a32, mat = M(col), belly = M(0xb8b080), dark = M(0x3a4428);
      const yc = 0.3;
      const body = grp(g, 0, yc, 0);
      P(body, sph(1, 18, 10), mat, 0, 0, 0, 0, 0, 0, 0.42, 0.2, 0.9);
      P(body, sph(1, 14, 8), belly, 0, -0.07, 0, 0, 0, 0, 0.38, 0.13, 0.85);
      for (let i = 0; i < 8; i++) for (const s of [-1, 1]) P(body, cone(0.035, 0.06, 4), dark, s * 0.12, 0.18, 0.6 - i * 0.16);   // костные щитки
      const legs = [];
      for (const [x, z, hind] of [[0.3, 0.5, 0], [-0.3, 0.5, 0], [0.32, -0.5, 1], [-0.32, -0.5, 1]]) {
        const s = Math.sign(x);
        const upper = grp(body, x, -0.05, z, 0, 0, s * 1.2);
        P(upper, cyl(0.07, 0.055, 0.26, 8), mat, 0, -0.13, 0);
        const lower = grp(upper, 0, -0.26, 0, 0, 0, -s * 1.2);
        P(lower, cyl(0.05, 0.04, 0.2, 8), mat, 0, -0.1, 0);
        P(lower, sph(0.07, 8, 5), dark, 0, -0.2, 0.04, 0, 0, 0, 1.2, 0.4, 1.4);
        legs.push({ upper, lower, hind, rest: [0, 0], sprawl: s });
      }
      const neck = grp(body, 0, 0.0, 0.85);
      P(neck, sph(0.26, 12, 8), mat, 0, 0, 0.0, 0, 0, 0, 1, 0.65, 1.1);
      const head = grp(neck, 0, 0.02, 0.2);
      P(head, sph(0.2, 12, 8), mat, 0, 0.02, 0.05, 0, 0, 0, 0.95, 0.55, 1);
      P(head, box(0.22, 0.09, 0.7), mat, 0, 0.0, 0.42).scale.set(1, 1, 1);
      P(head, box(0.12, 0.08, 0.2), mat, 0, 0.0, 0.8);
      for (const s of [-1, 1]) { P(head, sph(0.045, 8, 6), mat, s * 0.08, 0.1, 0.12); P(head, sph(0.022, 6, 4), M(0xd8c040), s * 0.08, 0.13, 0.14); }
      for (let i = 0; i < 7; i++) for (const s of [-1, 1]) P(head, cone(0.012, 0.04, 4), M(0xf0ead8), s * 0.1, -0.05, 0.2 + i * 0.09, PI);
      const jaw = grp(head, 0, -0.05, 0.08);
      P(jaw, box(0.2, 0.06, 0.78), belly, 0, -0.02, 0.38);
      const tail = grp(body, 0, 0.0, -0.85);
      const tsegs = []; let tp = tail;
      for (let i = 0; i < 7; i++) {
        const r = lerp(0.2, 0.04, i / 6), l = 0.28;
        P(tp, sph(1, 10, 6), mat, 0, 0, -l / 2, 0, 0, 0, r, r * 0.7, l * 0.62);
        P(tp, box(0.012, r * 0.6, l * 0.8), dark, 0, r * 0.6, -l / 2);
        tsegs.push(tp); tp = grp(tp, 0, 0, -l);
      }
      return quadRig(g, body, neck, head, tail, legs, { yc, size: 0.3, kind: 'croc', jaw, tsegs, gr: 0.2, wid: 2 });
    }
    case 'snake': {
      // египетская кобра: независимые звенья вдоль «хребта» (segs[0] — голова), капюшон на 2–3 звеньях
      const col = 0x6a5a34, mat = M(col), belly = M(0xd8c890), dark = M(0x4a3e22);
      const segs = [];
      for (let i = 0; i < 18; i++) {
        const sg = grp(g, 0, 0.05, 0.6 - i * 0.1);
        if (i === 0) {
          P(sg, sph(0.05, 10, 8), mat, 0, 0.0, 0.02, 0, 0, 0, 0.85, 0.6, 1.3);
          eyes(sg, 0.032, 0.015, 0.05, 0.008);
          P(sg, box(0.004, 0.003, 0.04), M(0xc02020), 0, -0.012, 0.09).castShadow = false;
        } else {
          const r = i < 4 ? 0.048 : lerp(0.046, 0.012, (i - 4) / 13);
          P(sg, sph(1, 8, 6), mat, 0, 0, 0, 0, 0, 0, r, r * 0.85, 0.068);
          if (i === 2 || i === 3) { P(sg, sph(1, 10, 6), mat, 0, 0, -0.01, 0, 0, 0, 0.12, 0.13, 0.025); P(sg, sph(1, 8, 5), belly, 0, 0, 0.014, 0, 0, 0, 0.08, 0.1, 0.012); }
          if (i % 3 === 0) P(sg, tor(r * 0.98, 0.006, 3, 10), dark, 0, 0, 0);
        }
        segs.push(sg);
      }
      g.userData = { segs, head: segs[0], body: segs[0], kind: 'snake', legs: [] };
      return g;
    }
    default: {
      const m = makeAnimal('goat'); return m;
    }
  }
}

// ---------- анимация зверей ----------
const GAITS = {
  walk: { off: [0.25, 0.75, 0, 0.5], beta: 0.64 },     // FL, FR, BL, BR — латеральная последовательность
  trot: { off: [0, 0.5, 0.5, 0], beta: 0.45 },          // диагональные пары
  gallop: { off: [0.45, 0.57, 0, 0.12], beta: 0.32 },   // поперечный галоп
  bound: { off: [0.5, 0.6, 0, 0.08], beta: 0.3 },       // ротационный галоп хищников
};
export function animateAnimal(a, dt, s = {}) {
  const u = a.userData; if (!u.body) return;
  const A = u._an || (u._an = { ph: 0, t: 0, spd: 0 });
  dt = clamp(dt || 0, 0, 0.1); A.t += dt;
  const t = s.t != null ? s.t : A.t;
  A.spd = lerp(A.spd, Math.max(0, s.speed || 0), 1 - Math.exp(-dt * 8));
  const sp = A.spd, dead = s.dead || 0, atk = s.attack != null ? clamp(s.attack, 0, 1) : -1;
  if (u.kind === 'snake') return animSnake(u, dt, t, sp, atk, dead);
  const H = u.size, legLen = Math.max(0.3, H);
  // выбор аллюра по числу Фруда
  const Fr = (sp * sp) / (9.8 * legLen);
  const fast = u.kind === 'canid' || u.kind === 'cat' || u.kind === 'bear' ? 'bound' : 'gallop';
  let wT = ease((Fr - 0.35) / 0.4), wG = ease((Fr - 2.0) / 1.2);
  if (u.kind === 'elephant' || u.kind === 'croc') { wT = 0; wG = 0; }
  if (u.kind === 'boar') wG = ease((Fr - 1.5) / 1.0);
  const off = [0, 1, 2, 3].map((i) => lerp(lerp(GAITS.walk.off[i], GAITS.trot.off[i], wT), GAITS[fast].off[i], wG));
  const beta = lerp(lerp(GAITS.walk.beta, GAITS.trot.beta, wT), GAITS[fast].beta, wG);
  const Lmax = legLen * lerp(lerp(0.75, 1.0, wT), 1.5, wG);
  const f = Math.max(u.kind === 'elephant' ? 0.35 : 0.6, (sp * beta) / Lmax);
  const moving = sp > 0.08;
  if (moving) A.ph = fract(A.ph + dt * f);
  const mw = ease(sp / 0.5);
  const stance = (sp * beta) / f;
  const amp = Math.asin(clamp(stance / 2 / legLen, 0, 0.9)) * mw;
  const flexK = lerp(lerp(0.7, 1.0, wT), 1.4, wG) * mw;
  // ноги
  u.legs.forEach((lg, i) => {
    const uu = fract(A.ph - off[i]);
    let ang, flex;
    if (uu < beta) { ang = lerp(-amp, amp, uu / beta); flex = 0; }
    else { const sw = (uu - beta) / (1 - beta); ang = lerp(amp, -amp, ease(sw)); flex = Math.sin(PI * sw); }
    if (u.kind === 'croc') {
      lg.upper.rotation.set(0, ang * 1.4 * (lg.hind ? -1 : 1) * 0 + ang * 1.2, lg.sprawl * (1.2 - flex * 0.35));
      lg.lower.rotation.set(0, 0, -lg.sprawl * (1.2 - flex * 0.2));
      return;
    }
    const [r1, r2] = lg.rest;
    lg.upper.rotation.set(r1 + ang, 0, 0);
    lg.lower.rotation.set(r2 + (lg.hind ? -1 : 1) * flex * flexK * (u.kind === 'elephant' ? 0.35 : 0.9), 0, 0);
  });
  // туловище: подпрыгивание, наклон, кивок головы
  const gal = wG;
  const bobW = (lerp(0.012, 0.03, wT) * (1 - gal)) * Math.sin(4 * PI * A.ph) * mw * H;
  const bobG = 0.06 * H * Math.sin(TAU * A.ph + 0.6) * gal * mw;
  const pitch = 0.09 * Math.sin(TAU * A.ph) * gal * mw;
  let by = u.yc + bobW + bobG, bz = 0, brx = pitch, brz = 0;
  let nx = 0, hx = -pitch * 1.2 - bobW * 2, tailX = 0, jaw = 0;
  if (u.kind === 'croc') { brz = Math.sin(TAU * A.ph) * 0.05 * mw; }
  const neckBase = u._neckBase || (u._neckBase = u.neck.rotation.x), headBase = u._headBase || (u._headBase = u.head.rotation.x);
  // покой: дыхание, оглядывание
  const idle = 1 - mw;
  by += Math.sin(t * 1.6) * 0.006 * idle * H;
  nx += Math.sin(t * 0.4) * 0.08 * idle;
  let ny = Math.sin(t * 0.27) * 0.3 * idle;
  // водопой: шея и голова опущены к воде, лакание
  A.dr = lerp(A.dr || 0, s.drink ? 1 : 0, 1 - Math.exp(-dt * 3));
  if (A.dr > 0.01) { nx += A.dr * (0.95 + Math.sin(t * 6) * 0.05); ny *= 1 - A.dr; by -= A.dr * 0.04 * H; }
  // атака
  if (atk >= 0) {
    const k = atk;
    const wind = seg(k, 0, 0.35), strike = seg(k, 0.35, 0.55), back = seg(k, 0.7, 1);
    const lunge = (strike - back * strike) - wind * 0.3 * (1 - strike);
    jaw = Math.max(0, Math.sin(PI * clamp((k - 0.2) / 0.5, 0, 1))) * 0.7;
    if (u.kind === 'bear') {
      // встаёт на задние лапы и бьёт передней
      const rear = Math.sin(PI * clamp(k / 0.8, 0, 1));
      brx -= 0.85 * rear; by += 0.45 * rear * H; bz -= 0.25 * rear;
      u.legs[2].upper.rotation.x += 0.85 * rear; u.legs[3].upper.rotation.x += 0.85 * rear;
      u.legs[0].upper.rotation.x += -1.4 * rear + 1.6 * strike * (1 - back); u.legs[0].lower.rotation.x += 0.4 * rear;
      u.legs[1].upper.rotation.x += -1.0 * rear; u.legs[1].lower.rotation.x += 0.6 * rear;
      hx += 0.3 * rear;
    } else if (u.kind === 'boar') {
      nx += 0.35 * (wind + strike) * (1 - back); hx += 0.2 - 0.6 * strike * (1 - back); bz += 0.5 * lunge;
    } else if (u.kind === 'elephant') {
      const rear = Math.sin(PI * clamp(k / 0.7, 0, 1));
      brx -= 0.22 * rear; by += 0.2 * rear; u.legs[0].upper.rotation.x -= 0.8 * rear; u.legs[0].lower.rotation.x += 0.9 * rear;
      u.legs[2].upper.rotation.x += 0.22 * rear; u.legs[3].upper.rotation.x += 0.22 * rear;
    } else if (u.kind === 'croc') {
      bz += 0.5 * lunge; jaw = Math.max(0, Math.sin(PI * clamp(k / 0.5, 0, 1))) * 0.8 * (1 - strike) + 0.05;
    } else if (u.kind === 'prey') {
      nx += 0.4 * wind - 0.6 * strike * (1 - back); bz += 0.25 * lunge;
    } else {
      // хищник: прыжок вперёд с вытянутыми передними лапами
      bz += 0.55 * lunge * H; by += 0.15 * Math.sin(PI * clamp((k - 0.2) / 0.5, 0, 1)) * H; brx -= 0.2 * strike * (1 - back);
      u.legs[0].upper.rotation.x -= 0.9 * strike * (1 - back); u.legs[1].upper.rotation.x -= 0.9 * strike * (1 - back);
      hx -= 0.3 * strike * (1 - back);
    }
  }
  // смерть: перекатывается на бок
  if (dead > 0) {
    const kd = ease(dead / 0.5);
    brz = lerp(brz, HPI * 0.97, kd); by = lerp(by, u.kind === 'croc' ? 0.22 : u.gr * u.wid * 1.02, kd); brx = lerp(brx, 0, kd);
    u.legs.forEach((lg, i) => { if (u.kind === 'croc') return; lg.upper.rotation.x = lerp(lg.upper.rotation.x, (i < 2 ? -0.35 : 0.45), kd); lg.lower.rotation.x = lerp(lg.lower.rotation.x, 0.1, kd); });
    nx = lerp(nx, 0.3, kd); jaw = lerp(jaw, 0.25, kd); ny *= 1 - kd;
  }
  u.body.position.set(0, by, bz);
  u.body.rotation.set(brx, 0, brz);
  u.neck.rotation.set(neckBase + nx, ny, 0);
  u.head.rotation.set(headBase + hx, 0, 0);
  if (u.jaw) u.jaw.rotation.x = jaw * (u.kind === 'croc' ? 0.6 : 0.5);
  if (u.tail) {
    const tb = u._tailBase != null ? u._tailBase : (u._tailBase = u.tail.rotation.x);
    u.tail.rotation.set(tb - gal * 0.4 * mw + tailX, Math.sin(t * (moving ? f * TAU : 2.2)) * (u.kind === 'canid' || u.kind === 'cat' ? 0.35 : 0.2), 0);
  }
  if (u.tsegs) u.tsegs.forEach((sg, i) => { sg.rotation.y = Math.sin(t * (moving ? f * TAU : 0.8) - i * 0.7) * (0.12 + 0.1 * mw) * (dead > 0 ? 0.1 : 1); });
  if (u.trunk) {
    const sw = atk >= 0 ? Math.sin(PI * clamp(atk / 0.7, 0, 1)) : 0;
    u.trunk.forEach((sg, i) => { sg.rotation.x = (i === 0 ? 0.35 : 0.12) + Math.sin(t * 1.3 - i * 0.5) * 0.06 - sw * (i < 5 ? 0.45 : -0.2) + (dead > 0 ? 0.05 : 0); sg.rotation.z = Math.sin(t * 0.9 - i * 0.4) * 0.05; });
  }
  if (u.ears) u.ears.forEach((e, i) => { e.rotation.y = (i ? 1 : -1) * (0.25 + Math.max(0, Math.sin(t * 1.7)) * 0.35); });
  if (u.flag) u.flag.rotation.y = Math.sin(t * 3) * 0.3;
}
const _sp = [];
function animSnake(u, dt, t, sp, atk, dead) {
  // хребет строится от головы назад с постоянным шагом звеньев: боковая волна + поднятая передняя часть
  const segs = u.segs, n = segs.length, l = 0.1;
  const freq = 0.7 + sp * 1.4;
  const alert = 1 - ease(sp / 1.2);
  let lift = 0.9 * alert, strike = 0;
  if (atk >= 0) { const w = seg(atk, 0, 0.35); strike = seg(atk, 0.35, 0.5) * (1 - seg(atk, 0.65, 1)); lift = Math.max(lift, 1) * (1 - strike * 0.55) + w * 0.1; }
  const kd = dead > 0 ? ease(dead / 0.5) : 0;
  lift *= 1 - kd;
  const nUp = 5, hy = 0.045 + lift * 0.34;
  const p = (_sp[0] || (_sp[0] = new THREE.Vector3())).set(0, hy, 0.6 + strike * 0.35 + lift * 0.12);
  for (let i = 1; i < n; i++) {
    const dy = i <= nUp ? (hy - 0.045) / nUp : 0;
    const hz = Math.sqrt(Math.max(1e-4, l * l - dy * dy));
    const amp = 0.55 * (1 - kd * 0.7) * Math.min(1, 0.25 + i / 6) * (i <= nUp ? 1 - lift * 0.8 : 1);
    const yaw = Math.sin(t * freq * TAU * 0.5 - i * 0.85) * amp;
    (_sp[i] || (_sp[i] = new THREE.Vector3())).set(_sp[i - 1].x + Math.sin(yaw) * hz, _sp[i - 1].y - dy, _sp[i - 1].z - Math.cos(yaw) * hz);
  }
  for (let i = 0; i < n; i++) {
    const sg = segs[i];
    sg.position.copy(_sp[i]);
    const dir = i === 0 ? _a.copy(_sp[0]).sub(_sp[1]) : _a.copy(_sp[i - 1]).sub(_sp[i]);
    if (i === 0) dir.y = -0.03 - strike * 0.25;
    sg.quaternion.setFromUnitVectors(FWD, dir.normalize());
    if (kd > 0) { _q1.setFromAxisAngle(FWD, PI * kd * 0.9); sg.quaternion.multiply(_q1); }
  }
}

// ======================================================================
// Постройки
// ======================================================================
function B(type) { const g = new THREE.Group(); g.name = 'b_' + type; g.userData = { colliders: [], type }; return g; }
const colB = (g, x, z, w, d, ry = 0) => g.userData.colliders.push({ x: +x.toFixed(2), z: +z.toFixed(2), w: +w.toFixed(2), d: +d.toFixed(2), ry: +ry.toFixed(3) });
const colC = (g, x, z, r) => g.userData.colliders.push({ x: +x.toFixed(2), z: +z.toFixed(2), r: +r.toFixed(2) });
const WATER = () => M(C.water, { roughness: 0.12, metalness: 0.2 });
// каменный фундамент: верх на top, низ на −1.5 м (здание не «висит» на неровной земле)
function plinth(g, x, z, w, d, top = 0.3, mat = null, ry = 0) {
  const p = grp(g, x, 0, z, 0, ry, 0);
  P(p, tbox(w, top + 1.5, d), mat || ASH(), 0, (top - 1.5) / 2, 0);
  P(p, box(w + 0.1, 0.07, d + 0.1), M(C.stoneD), 0, top - 0.05, 0); // кромка ниже верха — без мерцания
  return p;
}
function plinthC(g, x, z, r, top = 0.3, s = 24) {
  P(g, tcyl(r, r, top + 1.5, s), ASH(), x, (top - 1.5) / 2, z);
  P(g, cyl(r + 0.05, r + 0.05, 0.07, s), M(C.stoneD), x, top - 0.05, z);
}
// оштукатуренная стена (или сплошной объём дома) с красной нижней полосой и карнизом
function wall(g, x, y, z, w, h, d, ry = 0, o = {}) {
  const p = grp(g, x, y, z, 0, ry, 0);
  P(p, o.mat ? tbox(w, h, d) : box(w, h, d), o.mat || M(o.col || C.plaster), 0, h / 2, 0);
  if (o.dado !== false) P(p, box(w + 0.03, 0.85, d + 0.03), M(o.dadoCol || C.dado), 0, 0.425, 0);
  if (o.cornice !== false) P(p, box(w + 0.14, 0.14, d + 0.14), M(C.stone), 0, h - 0.07, 0);
  return p;
}
function door(g, x, y, z, ry = 0, w = 1.2, h = 2.2, dbl = false) {
  const p = grp(g, x, y, z, 0, ry, 0);
  const st = M(C.stone), wd = M(0x5a3a1e);
  for (const s of [-1, 1]) P(p, box(0.18, h + 0.1, 0.16), st, s * (w / 2 + 0.09), (h + 0.1) / 2, 0.03);
  P(p, box(w + 0.56, 0.24, 0.2), st, 0, h + 0.2, 0.03);
  P(p, box(w, h, 0.06), M(0x1a120c), 0, h / 2, -0.01);
  if (dbl) for (const s of [-1, 1]) { const lf = grp(p, s * w / 2, 0, 0.02, 0, s * -0.12, 0); P(lf, rbox(w / 2, h, 0.06, 0.01), wd, -s * w / 4, h / 2, 0); P(lf, box(w / 2 - 0.1, 0.06, 0.07), M(0x3a2414), -s * w / 4, h * 0.3, 0); P(lf, box(w / 2 - 0.1, 0.06, 0.07), M(0x3a2414), -s * w / 4, h * 0.75, 0); }
  else {
    P(p, rbox(w - 0.04, h - 0.02, 0.07, 0.012), wd, 0, h / 2, 0.02);
    for (const yy of [0.3, 0.72]) P(p, box(w - 0.2, 0.06, 0.08), M(0x3a2414), 0, h * yy, 0.025);
    P(p, tor(0.05, 0.008, 4, 10), bronzeM(), w * 0.25, h * 0.5, 0.065);
  }
  return p;
}
function win(g, x, y, z, ry = 0, w = 0.6, h = 0.7) {
  const p = grp(g, x, y, z, 0, ry, 0);
  P(p, box(w, h, 0.05), M(0x1a140e), 0, 0, 0);
  P(p, box(w + 0.12, 0.08, 0.1), M(C.stone), 0, -h / 2 - 0.04, 0.02);
  for (let i = 1; i < 3; i++) P(p, box(0.03, h, 0.06), M(0x3a2a1a), -w / 2 + (i * w) / 3, 0, 0.01);
  return p;
}
// двускатная крыша из черепицы; конёк вдоль X (axis='x') или Z; фронтоны оштукатурены
function gable(g, cx, y, cz, w, d, pitch = 0.42, over = 0.35, axis = 'x', o = {}) {
  const r = grp(g, cx, y, cz, 0, axis === 'z' ? HPI : 0, 0);
  if (axis === 'z') [w, d] = [d, w];
  const half = d / 2 + over, tp = Math.tan(pitch), yr = (d / 2) * tp;
  const sl = half / Math.cos(pitch), th = 0.12, mat = o.mat || TILE();
  for (const s of [-1, 1]) {
    const m = P(r, tbox(w + 2 * over, th, sl), mat, 0, yr - (half / 2) * tp + (th / 2) / Math.cos(pitch), s * half / 2, s * pitch);
    m.receiveShadow = true;
    P(r, box(w + 2 * over, 0.16, 0.06), M(C.woodD), 0, yr - half * tp - 0.02, s * half);   // карнизная доска
    if (o.antefix !== false) for (let x = -w / 2 - over + 0.3; x < w / 2 + over; x += 0.7) P(r, box(0.12, 0.16, 0.04), M(C.tileD), x, yr - half * tp + 0.1, s * (half + 0.01));
  }
  P(r, cyl(0.1, 0.1, w + 2 * over + 0.05, 8), M(C.tileD), 0, yr + 0.08, 0, 0, 0, HPI);
  if (o.gables !== false) for (const s of [-1, 1]) P(r, extr(`tri${d}_${pitch}`, [[-d / 2, 0], [d / 2, 0], [0, yr]], 0.12, 0), M(o.gableCol || C.plaster), s * (w / 2 - 0.04), 0, 0, 0, HPI, 0);
  return { top: y + yr + 0.1 };
}
// односкатный навес (низкий край в сторону +Z локально)
function shed(g, cx, y, cz, w, d, drop = 0.6, ry = 0, mat = null) {
  const r = grp(g, cx, y, cz, 0, ry, 0);
  const a = Math.atan2(drop, d);
  P(r, tbox(w + 0.4, 0.1, Math.hypot(d, drop) + 0.4), mat || TILE(), 0, -drop / 2 + 0.05, 0, a);
  return r;
}
// открытая чаша (бассейн, корыто): бортики + дно + вода на высоте rim − dip
function basin(g, x, y, z, w, h, d, dip = 0.1, mat = null, wmat = null) {
  const p = grp(g, x, y, z), m = mat || M(C.stone), t = Math.min(0.15, w * 0.12, d * 0.12);
  P(p, box(w, 1.58, d), m, 0, -0.75, 0);   // основание уходит в землю
  for (const s of [-1, 1]) { P(p, box(w, h, t), m, 0, h / 2, s * (d / 2 - t / 2)); P(p, box(t, h, d - 2 * t), m, s * (w / 2 - t / 2), h / 2, 0); }
  P(p, box(w - 2 * t, 0.02, d - 2 * t), wmat || WATER(), 0, h - dip, 0);
  return p;
}
function post(g, x, y, z, h, r = 0.1, mat = null) { return P(g, cyl(r * 0.9, r, h, 8), mat || M(C.wood), x, y + h / 2, z); }
function colRow(g, x0, z0, x1, z1, n, y, h, r, order, mat, cols = true) {
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0.5 : i / (n - 1), x = lerp(x0, x1, k), z = lerp(z0, z1, k);
    column(g, x, y, z, h, r, order, mat);
    if (cols) colC(g, x, z, r * 1.2);
  }
}
function fence(g, pts, h = 1.1, gap = -1, col = C.woodL) {
  const wm = M(col), pm = M(C.woodD);
  for (let i = 0; i < pts.length - 1; i++) {
    if (i === gap) continue;
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.8));
    for (let k = 0; k <= n; k++) P(g, cyl(0.05, 0.06, h + 0.5, 6), pm, lerp(x0, x1, k / n), (h + 0.5) / 2 - 0.5, lerp(z0, z1, k / n));
    for (const yy of [h * 0.45, h * 0.9]) P(g, box(0.05, 0.08, len), wm, (x0 + x1) / 2, yy, (z0 + z1) / 2, 0, ry, 0);
    colB(g, (x0 + x1) / 2, (z0 + z1) / 2, 0.15, len, ry);
  }
}
// ряды посевов: скрещенные полупрозрачные полосы с текстурой колосьев
function cropRows(g, x0, x1, z0, z1, step, h, col, tex = 'crop') {
  const m = TM(tex, col);
  P(g, box(x1 - x0 + 0.4, 0.06, z1 - z0 + 0.4), M(0x6e5034), (x0 + x1) / 2, 0.02, (z0 + z1) / 2);
  const len = z1 - z0;
  for (let x = x0; x <= x1 + 1e-6; x += step) {
    P(g, box(0.28, 0.06, len), M(0x5a4028), x, 0.05, (z0 + z1) / 2);
    for (const a of [-0.25, 0.25]) {
      const q = P(g, G(`crop${len},${h}`, () => { const p = new THREE.PlaneGeometry(len, h); p.rotateY(HPI); p.translate(0, h / 2, 0); const uv = p.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 1.2); return p; }), m, x, 0.04, (z0 + z1) / 2, 0, 0, a);
      q.castShadow = false;
    }
  }
}
// поленница, свёрток, сеть и т.п. — из реквизита (часть 1)

const BUILD = {};
// ---------- Форум ----------
BUILD.forum = (g, o) => {
  plinth(g, 0, 0, 20, 20, 0.25);
  const y = 0.25;
  // базилика в глубине
  plinth(g, 0, -7.2, 18, 5, 0.6);
  wall(g, 0, 0.6, -7.4, 17.4, 6, 4.4, 0, { mat: TM('ashlar', 0xf4eee0), dado: false });
  gable(g, 0, 6.6, -7.4, 17.4, 4.4, 0.38, 0.4, 'x');
  for (let i = 0; i < 4; i++) win(g, -6 + i * 4, 4.6, -5.17, 0, 0.9, 1.2);
  door(g, 0, 0.6, -5.17, 0, 1.6, 2.8, true);
  colB(g, 0, -7.4, 17.6, 4.6);
  // портик перед базиликой
  colRow(g, -8.2, -4.1, 8.2, -4.1, 9, 0.6, 4.6, 0.3, 'tuscan');
  P(g, box(17.4, 0.5, 0.7), M(C.marble), 0, 5.45, -4.1);
  shed(g, 0, 5.7, -4.6, 17.4, 1.4, 0.4);
  stairs(g, 0, 0.43, -3.7, 17.4, 1, 0.35, 0.5);
  // боковые портики с глухой задней стеной
  for (const s of [-1, 1]) {
    wall(g, s * 9.55, y, 2.2, 0.5, 4.2, 13, 0, { dadoCol: C.dado });
    colRow(g, s * 7.9, -2.6, s * 7.9, 8.8, 6, y, 3.8, 0.26, 'tuscan');
    P(g, box(0.5, 0.4, 11.8), M(C.marble), s * 7.9, y + 4.0, 3.1);
    shed(g, s * 8.75, y + 4.55, 2.2, 13.2, 1.6, 0.45, s * -HPI);
    colB(g, s * 9.55, 2.2, 0.6, 13);
  }
  // ростры: трибуна с таранами кораблей
  const ro = grp(g, 0, y, -1.2);
  P(ro, rbox(5, 1.6, 2.6, 0.05), M(C.marble), 0, 0.8, 0);
  P(ro, box(5.2, 0.15, 2.8), M(C.stone), 0, 1.62, 0);
  for (let i = 0; i < 4; i++) { const r = grp(ro, -1.8 + i * 1.2, 0.9, 1.35); P(r, cone(0.16, 0.5, 4), bronzeM(), 0, 0, 0.2, HPI); P(r, box(0.06, 0.34, 0.3), bronzeM(), 0, 0, 0.05); }
  for (let i = 0; i < 9; i++) P(ro, cyl(0.03, 0.03, 0.7, 6), bronzeM(), -2.3 + i * 0.575, 2.0, 1.25);
  P(ro, cyl(0.03, 0.03, 4.8, 6), bronzeM(), 0, 2.35, 1.25, 0, 0, HPI);
  stairs(g, 0, y + 1.6 - 0.32, -2.5, 1.6, 5, 0.32, 0.3, PI);
  colB(g, 0, -1.2, 5.2, 2.8);
  banner(g, -2.8, y, -1.2, 4.2); banner(g, 2.8, y, -1.2, 4.2);
  // статуя, жаровни, доска объявлений (album)
  statue(g, 0, y, 4.5, 1.0, M(0xd8d0c0));
  colC(g, 0, 4.5, 0.75);
  brazier(g, -3.5, y, 2.5); brazier(g, 3.5, y, 2.5);
  const al = grp(g, 6.6, y, 6.2, 0, -HPI, 0);
  for (const s of [-1, 1]) post(al, s * 0.9, 0, 0, 2.2, 0.07, M(C.woodD));
  P(al, box(2.1, 1.2, 0.08), M(0xe8dcc0), 0, 1.6, 0);
  P(al, box(2.2, 0.08, 0.14), M(C.woodD), 0, 2.24, 0);
  for (let i = 0; i < 5; i++) P(al, box(0.35, 0.45, 0.02), M(0xf6f0e0), -0.75 + i * 0.37, 1.6 + (i % 2) * 0.1, 0.05, 0, 0, (i - 2) * 0.05);
  stairs(g, 0, 0.12, 10, 14, 1, 0.25, 0.4);
  if ((o.level || 1) >= 2) { amphora(g, -6.5, y, 7.5); amphora(g, -6.1, y, 7.8); crate(g, -6.6, y, 6.6); }
};
// ---------- Хорреум ----------
BUILD.horreum = (g) => {
  plinth(g, 0, 0, 12.4, 7.4, 0.9);
  // вентиляционные отверстия в цоколе
  for (let i = 0; i < 6; i++) P(g, box(0.4, 0.25, 0.05), M(0x1a140e), -5 + i * 2, 0.45, 3.71);
  wall(g, 0, 0.9, 0, 12, 4.6, 7, 0, { mat: BRICK(), dado: false });
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) P(g, box(0.5, 4.6, 0.3), ASH(), -6 + i * 2, 0.9 + 2.3, s * 3.6);   // пилястры-контрфорсы
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) win(g, -4.8 + i * 2.4, 4.6, s * 3.53, s > 0 ? 0 : PI, 0.3, 0.6);
  gable(g, 0, 5.5, 0, 12, 7, 0.36, 0.45, 'x');
  door(g, 0, 0.9, 3.56, 0, 2.2, 3.0, true);
  stairs(g, 0, 0.9, 3.7, 3.4, 3, 0.3, 0.45);
  colB(g, 0, 0, 12.4, 7.6);
  for (let i = 0; i < 5; i++) sack(g, -4.2 + (i % 3) * 0.55, 0, 4.6 + Math.floor(i / 3) * 0.5, 1, 0xd2c08f, i);
  for (let i = 0; i < 4; i++) amphora(g, 3.2 + i * 0.45, 0, 4.4 + (i % 2) * 0.35);
  crate(g, 5.2, 0, 4.4, 1, 0.3);
  cart(g, -6.8, 0, 2.2, 0.2, 'sacks');
};
// ---------- Мастерская ----------
BUILD.fabrica = (g) => {
  plinth(g, 0, -2.4, 9, 4.4, 0.35);
  wall(g, 0, 0.35, -2.6, 8.6, 3.6, 4);
  gable(g, 0, 3.95, -2.6, 8.6, 4, 0.42, 0.35, 'x');
  door(g, -2.4, 0.35, -0.57, 0, 1.3, 2.3);
  win(g, 1.5, 2.3, -0.57); win(g, 3.2, 2.3, -0.57);
  colB(g, 0, -2.6, 8.8, 4.2);
  // навес на столбах
  plinth(g, 0, 1.6, 9, 3.6, 0.15);
  for (const x of [-4, 0, 4]) { post(g, x, 0.15, 3.1, 2.8, 0.11); colC(g, x, 3.1, 0.2); }
  P(g, box(8.4, 0.18, 0.18), M(C.woodD), 0, 3.0, 3.1);
  shed(g, 0, 3.4, 1.4, 8.6, 3.6, 0.6);
  table(g, -1.6, 0.15, 1.4, 2.2, 0.8);
  P(g, box(0.4, 0.04, 0.07), M(C.woodD), -2, 1.0, 1.3); P(g, box(0.06, 0.06, 0.2), ironM(), -1.2, 0.95, 1.5);
  // козлы для распила с бревном и пилой
  for (const x of [1.2, 2.8]) for (const s of [-1, 1]) P(g, box(0.07, 0.95, 0.07), M(C.wood), x, 0.6, 1.4 + s * 0.2, s * 0.35);
  P(g, cyl(0.16, 0.18, 2.4, 8), M(0x7a5534), 2.0, 1.05, 1.4, 0, 0, HPI);
  // точильный круг
  const gr = grp(g, -3.4, 0.15, 1.6); P(gr, box(0.5, 0.6, 0.3), M(C.wood), 0, 0.3, 0); P(gr, cyl(0.32, 0.32, 0.1, 14), M(0x9a9488), 0, 0.85, 0, 0, 0, HPI);
  plankStack(g, 3.2, 0, -5.3, 6, HPI);
  logPile(g, -3.6, 0, -5.4, 6, 2.0, HPI);
  for (let i = 0; i < 3; i++) amphora(g, 4.5, 0, 0.3 + i * 0.5, 0.9);
  colB(g, 3.2, -5.3, 2.2, 1, 0); colB(g, -3.6, -5.4, 2.2, 1.2, 0);
};
// ---------- Кузница ----------
BUILD.ferraria = (g) => {
  plinth(g, 0, -2, 9, 5, 0.35);
  wall(g, 0, 0.35, -2.2, 8.6, 3.8, 4.4, 0, { mat: TM('ashlar', 0xc8bca4), dado: false });
  gable(g, 0, 4.15, -2.2, 8.6, 4.4, 0.42, 0.35, 'x');
  P(g, tbox(1.1, 3.6, 1.1), BRICK(), 2.6, 5.6, -3.2);   // труба
  P(g, box(1.3, 0.2, 1.3), M(C.stone), 2.6, 7.45, -3.2);
  P(g, box(0.7, 0.05, 0.7), M(0x1a1410), 2.6, 7.56, -3.2);
  door(g, -2.6, 0.35, 0.03, 0, 1.4, 2.4);
  colB(g, 0, -2.2, 8.8, 4.6);
  plinth(g, 0, 1.9, 9, 3.2, 0.15);
  for (const x of [-4, 4]) { post(g, x, 0.15, 3.2, 2.9, 0.12); colC(g, x, 3.2, 0.2); }
  P(g, box(8.4, 0.2, 0.2), M(C.woodD), 0, 3.1, 3.2);
  shed(g, 0, 3.6, 1.6, 8.6, 3.4, 0.6);
  // горн с углями и светом
  const fo = grp(g, 1.4, 0.15, 0.9);
  P(fo, box(1.6, 0.9, 1.2), BRICK(), 0, 0.45, 0);
  P(fo, box(1.2, 0.12, 0.8), EMB(), 0, 0.92, 0);
  for (let i = 0; i < 5; i++) P(fo, ico(0.09, 0), M(0x2a1a10), -0.4 + i * 0.2, 0.98, (i % 2) * 0.2 - 0.1);
  P(fo, box(1.7, 1.6, 0.3), BRICK(), 0, 1.6, -0.6);
  const fl = new VLight(0xff7a30, 8, 10, 1.6); fl.position.set(0, 1.4, 0.2); fo.add(fl);
  // мехи
  const bl = grp(g, 2.7, 0.15, 0.9); P(bl, extr('bellows', [[0, -0.25], [0.9, -0.05], [0.9, 0.05], [0, 0.25]], 0.5, 0.02), M(0x5a3a22), 0, 0.8, 0, 0, 0, 0); P(bl, box(0.3, 0.06, 0.06), M(C.woodD), 1.0, 0.8, 0);
  // наковальня на колоде
  const an = grp(g, -0.6, 0.15, 1.5); P(an, cyl(0.28, 0.32, 0.6, 10), M(0x6a4a2a), 0, 0.3, 0); P(an, box(0.5, 0.2, 0.22), ironM(), 0, 0.7, 0); P(an, cone(0.11, 0.3, 4), ironM(), 0.38, 0.72, 0, 0, 0, -HPI); P(an, box(0.25, 0.12, 0.18), ironM(), 0, 0.56, 0);
  colC(g, -0.6, 1.5, 0.4);
  // корыто для закалки
  basin(g, -2.2, 0.15, 2.2, 1.2, 0.55, 0.55, 0.06, M(0x6a4a2a));
  // стойка с оружием
  const rk = grp(g, -3.4, 0.15, 0.6, 0, HPI * 0.5, 0);
  P(rk, box(1.6, 0.08, 0.3), M(C.woodD), 0, 0.15, 0); P(rk, box(1.6, 0.08, 0.3), M(C.woodD), 0, 1.3, 0);
  for (const s of [-1, 1]) P(rk, box(0.08, 1.4, 0.08), M(C.woodD), s * 0.75, 0.7, 0);
  ['gladius', 'spatha', 'hasta', 'axe'].forEach((k, i) => { const w = buildWeapon(k, 0); w.position.set(-0.55 + i * 0.36, 0.25, 0); w.scale.setScalar(k === 'hasta' ? 0.7 : 1); rk.add(w); });
  stoneBlocks(g, 3.6, 0, 3.4, 2); barrel(g, -4, 0.15, 2.4);
};
// ---------- Пекарня и пресс ----------
BUILD.pistrinum = (g) => {
  plinth(g, 0, -2.3, 8, 4, 0.35);
  wall(g, 0, 0.35, -2.4, 7.6, 3.4, 3.6);
  gable(g, 0, 3.75, -2.4, 7.6, 3.6, 0.42, 0.35, 'x');
  door(g, 1.8, 0.35, -0.57, 0, 1.3, 2.3);
  colB(g, 0, -2.4, 7.8, 3.8);
  plinth(g, 0, 1.6, 8.6, 3.4, 0.12);
  // помпейские мельницы из лавового камня
  for (const x of [-2.8, -0.9]) {
    const m = grp(g, x, 0.12, 1.4);
    P(m, cyl(0.6, 0.65, 0.35, 16), M(0x5a5450), 0, 0.17, 0);
    P(m, cone(0.38, 0.75, 14), M(0x4a4440), 0, 0.72, 0);
    P(m, lathe('catillus', [[0.42, 0], [0.26, 0.38], [0.42, 0.78]], 14), M(0x3e3834), 0, 0.42, 0);
    for (const s of [-1, 1]) P(m, box(0.14, 0.14, 0.3), M(0x3e3834), s * 0.42, 0.82, 0);
    P(m, box(1.9, 0.08, 0.1), M(C.woodD), 0, 0.82, 0);
    colC(g, x, 1.4, 0.7);
  }
  // купольная печь с огнём
  const ov = grp(g, 1.8, 0.12, 1.4);
  P(ov, cyl(1.1, 1.2, 0.8, 16), BRICK(), 0, 0.4, 0);
  P(ov, hemi(1.05, 16, 8), BRICK(), 0, 0.8, 0);
  P(ov, box(0.6, 0.5, 0.2), M(0x1a0e08), 0, 1.0, 1.0);
  P(ov, box(0.5, 0.18, 0.1), EMB(), 0, 0.85, 0.95);
  const ol = new VLight(0xff8030, 5, 8, 1.6); ol.position.set(0, 1.0, 1.4); ov.add(ol);
  P(ov, cyl(0.15, 0.18, 0.6, 8), BRICK(), 0.3, 1.9, -0.3);
  colC(g, 1.8, 1.4, 1.2);
  // оливковый пресс (рычажный)
  const pr = grp(g, -3.1, 0, -5.2);
  P(pr, cyl(0.8, 0.85, 0.5, 16), M(0xb8b0a0), 0, 0.25, 0);
  P(pr, cyl(0.6, 0.6, 0.06, 16), M(0x6a7a2a), 0, 0.5, 0);
  for (const s of [-1, 1]) P(pr, box(0.25, 2.4, 0.25), M(C.woodD), s * 0.9, 1.2, 0);
  P(pr, box(4.2, 0.22, 0.22), M(C.wood), 1.3, 1.6, 0, 0, 0, -0.08);
  P(pr, cyl(0.3, 0.3, 0.6, 10), M(0x8a8478), 3.2, 0.9, 0);
  rope(pr, [3.2, 1.2, 0], [3.2, 1.45, 0], 0.03);
  colC(g, -3.1, -5.2, 1.0);
  for (let i = 0; i < 3; i++) amphora(g, 3.2 + i * 0.45, 0, -4.9, 0.9, i === 1 ? 0x8a4a2a : C.terracotta);
  sack(g, -1.6, 0.12, 2.8, 1); sack(g, -1.1, 0.12, 2.9, 0.9);
};
// ---------- Рынок ----------
BUILD.macellum = (g, o) => {
  plinth(g, 0, 0, 16.6, 13.6, 0.25);
  const y = 0.25;
  // лавки (tabernae) по трём сторонам
  const shops = (cx, cz, w, d, ry, n) => {
    const p = grp(g, cx, y, cz, 0, ry, 0);
    wall(p, 0, 0, 0, w, 3.6, d);
    gable(p, 0, 3.6, 0, w, d, 0.38, 0.35, 'x');
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      P(p, box((w / n) * 0.7, 2.4, 0.06), M(0x1c140e), x, 1.2, d / 2 + 0.01);
      P(p, box((w / n) * 0.7, 0.9, 0.5), M(C.stone), x, 0.45, d / 2 + 0.25);
      P(p, box((w / n) * 0.75, 0.06, 1.2), M([0x9a2a22, 0x2a5a8a, 0xc89a3a, 0x3a6a2a][i % 4], { side: THREE.DoubleSide }), x, 2.6, d / 2 + 0.6, 0.25);
    }
  };
  shops(0, -5, 16, 3.4, 0, 5); colB(g, 0, -5, 16.2, 3.6);
  shops(-6.6, 1.7, 9.8, 3.0, HPI, 3); colB(g, -6.6, 1.7, 3.2, 10);
  shops(6.6, 1.7, 9.8, 3.0, -HPI, 3); colB(g, 6.6, 1.7, 3.2, 10);
  // толос с фонтаном
  plinthC(g, 0, 0.5, 2.5, 0.6);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; column(g, Math.cos(a) * 2.1, 0.6, 0.5 + Math.sin(a) * 2.1, 3.2, 0.18, 'ionic'); }
  P(g, cyl(2.45, 2.45, 0.4, 24), M(C.marble), 0, 4.0, 0.5);
  P(g, G('tholosRoof', () => wuv(new THREE.ConeGeometry(2.9, 1.6, 24, 1))), TILE(), 0, 5.0, 0.5);
  P(g, sph(0.2, 8, 6), bronzeM(), 0, 5.85, 0.5);
  P(g, cyl(1.2, 1.3, 0.6, 20), M(C.marble), 0, 0.9, 0.5); P(g, cyl(1.1, 1.1, 0.04, 20), WATER(), 0, 1.18, 0.5);
  P(g, cyl(0.15, 0.2, 0.8, 8), M(C.marble), 0, 1.4, 0.5);
  colC(g, 0, 0.5, 2.6);
  // прилавки под навесами
  const stall = (x, z, col, goods) => {
    const s = grp(g, x, y, z);
    P(s, box(2, 0.9, 0.9), M(C.wood), 0, 0.45, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(s, sx * 0.95, 0, sz * 0.5, 2.3, 0.05, M(C.woodD));
    P(s, box(2.3, 0.05, 1.5), M(col, { side: THREE.DoubleSide }), 0, 2.35, 0, 0.12);
    const r = rng(x * 10 + z);
    for (let i = 0; i < 6; i++) {
      const gx = -0.7 + (i % 3) * 0.7, gz = (Math.floor(i / 3) - 0.5) * 0.4;
      if (goods === 'fruit') { P(s, cyl(0.22, 0.17, 0.15, 10), M(0xb08a4a), gx, 0.97, gz); for (let k = 0; k < 4; k++) P(s, sph(0.07, 6, 5), M([0xc83a1a, 0xe0a020, 0x6a8a2a, 0x5a2a6a][(r() * 4) | 0]), gx + (r() - 0.5) * 0.18, 1.08, gz + (r() - 0.5) * 0.18); }
      else if (goods === 'fish') { const f = P(s, sph(0.1, 8, 6), M(0x9ab0c0, { metalness: 0.4, roughness: 0.4 }), gx, 0.95, gz, 0, r() * 3, 0, 0.5, 0.35, 1.6); }
      else amphora(s, gx, 0.9, gz, 0.55);
    }
    colB(g, x, z, 2.2, 1.1);
  };
  stall(-3.6, 4.4, 0xb83a2a, 'fruit'); stall(0.2, 5.0, 0x2a6a9a, 'fish'); stall(3.9, 4.4, 0xd8b048, 'amph');
  // невольничий помост (катаста)
  const ca = grp(g, -4.8, y, -1.4);
  P(ca, box(2.6, 0.8, 2.2), PLANK(), 0, 0.4, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(ca, sx * 1.15, 0.8, sz * 0.95, 1.4, 0.06, M(C.woodD));
  P(ca, box(2.4, 0.08, 0.08), M(C.woodD), 0, 2.15, -0.95);
  for (let i = 0; i < 6; i++) P(ca, tor(0.04, 0.012, 4, 8), ironM(), -0.6 + i * 0.07, 2.05 - Math.abs(i - 2.5) * 0.04, -0.95, 0, i % 2 ? HPI : 0, 0);
  stairs(ca, 0, 0.8, 1.1, 1.2, 3, 0.26, 0.3);
  colB(g, -4.8, -1.4, 2.7, 2.3);
  if ((o.level || 1) >= 2) banner(g, 4.5, y, -1.0, 4);
};
// ---------- Гавань и верфь (+Z — море) ----------
// низкий портовый склад (горреум): длинный, одноэтажный, с пологой черепичной крышей
function lowWarehouse(g, x, z, w, d, ry = 0) {
  const p = grp(g, x, 0, z, 0, ry, 0);
  plinth(p, 0, 0, w + 0.4, d + 0.4, 0.3);
  wall(p, 0, 0.3, 0, w, 2.5, d, 0, { col: 0xe6dcc4, dadoCol: 0xb05a3a });
  gable(p, 0, 2.8, 0, w, d, 0.26, 0.45, 'x');
  const nd = Math.max(2, Math.round(w / 4.5));
  for (let i = 0; i < nd; i++) door(p, -w / 2 + (i + 0.5) * (w / nd), 0.3, d / 2 + 0.02, 0, 1.5, 2.0, true);
  for (let i = 0; i < nd; i++) win(p, -w / 2 + (i + 0.5) * (w / nd), 2.1, -d / 2 - 0.02, PI, 0.5, 0.3);
  for (let i = 0; i < 3; i++) amphora(p, w / 2 - 1.2 - i * 0.5, 0.3, d / 2 + 0.8);
  crate(p, -w / 2 + 1.0, 0.3, d / 2 + 0.9, 0.9, 0.3);
  colB(g, x, z, (Math.abs(Math.cos(ry)) > 0.5 ? w : d) + 0.4, (Math.abs(Math.cos(ry)) > 0.5 ? d : w) + 0.4, 0);
}
// большая гавань: каменная набережная 56 м, три длинных причала на сваях уходят в море на 34 м (по ним ходят;
// с каждой стороны причала встаёт корабль), склады и контора за набережной
export const PORTUS_PIERS = [-26, 0, 26], PORTUS_PIER_LEN = 46;
BUILD.portus = (g) => {
  P(g, tbox(76, 2.4, 7), ASH(), 0, -0.6, -1.0);
  P(g, box(76.2, 0.12, 7.2), M(C.stoneD), 0, 0.62, -1.0);
  for (let i = 0; i < 17; i++) { const x = -36 + i * 4.5; if (PORTUS_PIERS.some((q) => Math.abs(x - q) < 2.6)) continue; P(g, cyl(0.16, 0.2, 0.5, 10), M(0x6a6a64), x, 0.9, 2.0); }
  for (const px of PORTUS_PIERS) {
    const pr = grp(g, px, 0, 0), L = PORTUS_PIER_LEN - 2.5, zc = 2.5 + L / 2;
    P(pr, tbox(3.4, 0.25, L), PLANK(), 0, 0.72, zc);
    for (let z = 3.5; z <= PORTUS_PIER_LEN; z += 2.6) for (const sx of [-1, 1]) P(pr, cyl(0.16, 0.18, 4.6, 8), M(0x4a3420), sx * 1.55, -1.5, z);
    for (const sx of [-1, 1]) P(pr, box(0.12, 0.12, L), M(0x5a4028), sx * 1.65, 0.88, zc);
    for (let z = 6; z <= PORTUS_PIER_LEN - 1; z += 5) for (const sx of [-1, 1]) P(pr, cyl(0.13, 0.15, 0.55, 8), M(0x5a4430), sx * 1.5, 1.05, z);
    P(pr, box(3.6, 0.3, 0.4), M(0x5a4028), 0, 0.9, PORTUS_PIER_LEN - 0.3);
    const lamp = grp(pr, 1.4, 0.85, PORTUS_PIER_LEN - 1); P(lamp, cyl(0.06, 0.08, 2.4, 6), M(C.woodD), 0, 1.2, 0); brazier(lamp, 0, 2.4, 0, 0.6, 4, 10);
  }
  // ряд низких складов за набережной
  lowWarehouse(g, -24, -11, 14, 6);
  lowWarehouse(g, 24, -11, 14, 6);
  lowWarehouse(g, -6, -11.5, 8, 5);
  // контора портового магистрата
  plinth(g, 7.5, -10.6, 8, 5, 0.4);
  wall(g, 7.5, 0.4, -10.6, 7.6, 3.8, 4.6);
  gable(g, 7.5, 4.2, -10.6, 7.6, 4.6, 0.4, 0.35, 'x');
  door(g, 7.5, 0.4, -8.27, 0, 1.8, 2.6, true);
  win(g, 5.1, 2.6, -8.27); win(g, 9.9, 2.6, -8.27);
  colB(g, 7.5, -10.6, 7.8, 4.8);
  // подъёмный кран у среднего причала
  const cr = grp(g, -3.2, 0.6, 0.6);
  for (const s2 of [-1, 1]) P(cr, box(0.2, 5.4, 0.2), M(C.wood), s2 * 0.6, 2.7, 0, 0.32, 0, 0);
  P(cr, box(1.4, 0.2, 0.2), M(C.wood), 0, 5.1, 1.7);
  rope(cr, [0, 5.0, 1.75], [0, 1.8, 1.9], 0.02);
  P(cr, cyl(0.15, 0.15, 0.4, 8), ironM(), 0, 1.7, 1.9);
  const wh = grp(cr, 0, 1.5, -0.8);
  P(wh, tor(1.4, 0.07, 4, 24), M(C.woodD), 0, 0, 0, 0, HPI, 0);
  for (let i = 0; i < 6; i++) P(wh, box(0.06, 2.8, 0.06), M(C.wood), 0, 0, 0, (i * PI) / 6, 0, 0);
  colC(g, -3.2, 0.6, 1.2);
  // грузы на набережной
  for (let i = 0; i < 6; i++) amphora(g, -13 + (i % 3) * 0.48, 0.6, -3.4 + Math.floor(i / 3) * 0.48);
  crate(g, 11.6, 0.6, -3.5); crate(g, 12.5, 0.6, -3.3, 0.9, 0.4); crate(g, 12.0, 1.2, -3.4, 0.8, 0.1);
  barrel(g, 24.2, 0.6, -2.0); for (let i = 0; i < 4; i++) dolium(g, -26 + i * 1.1, 0.6, -4.2, 0.8);
  P(g, tor(0.35, 0.08, 6, 14), M(C.rope), 9.5, 0.7, -1.5, HPI);
  plankStack(g, -24, 0, -6.6, 6, 0.3); logPile(g, 26, 0, -6.5, 6, 2.4, HPI * 0.9);
  colB(g, -24, -6.6, 1.2, 2.2, 0.3); colB(g, 26, -6.5, 1.4, 2.6, HPI * 0.9);
};
// ---------- Казармы ----------
BUILD.castra = (g) => {
  plinth(g, 0, 0, 17.2, 17.2, 0.15);
  const W = 16.4, h = 3.6, t = 0.9;
  const wallSeg = (x, z, w, d) => { P(g, tbox(w, h, d), ASH(), x, 0.15 + h / 2, z); colB(g, x, z, w, d); };
  wallSeg(0, -W / 2, W, t); wallSeg(-W / 2, 0, t, W); wallSeg(W / 2, 0, t, W);
  wallSeg(-5.0, W / 2, 6.4, t); wallSeg(5.0, W / 2, 6.4, t);
  // зубцы
  const merl = (x0, z0, x1, z1) => { const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.2); for (let i = 0; i <= n; i++) P(g, box(0.6, 0.6, 0.35), M(C.stone), lerp(x0, x1, i / n), 0.15 + h + 0.3, lerp(z0, z1, i / n), 0, Math.atan2(x1 - x0, z1 - z0), 0); };
  merl(-W / 2, -W / 2 - 0.27, W / 2, -W / 2 - 0.27); merl(-W / 2 - 0.27, -W / 2, -W / 2 - 0.27, W / 2); merl(W / 2 + 0.27, -W / 2, W / 2 + 0.27, W / 2);
  merl(-W / 2, W / 2 + 0.27, -2.2, W / 2 + 0.27); merl(2.2, W / 2 + 0.27, W / 2, W / 2 + 0.27);
  // башни: угловые и надвратные
  const tower = (x, z, s, th) => { P(g, tbox(s, th, s), ASH(), x, 0.15 + th / 2, z); P(g, box(s + 0.3, 0.2, s + 0.3), M(C.stone), x, 0.15 + th, z); for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) { P(g, box(0.5, 0.55, 0.3), M(C.stone), x + sx * (s / 2), 0.15 + th + 0.37, z + (i - 1.5) * (s / 4), 0, HPI, 0); P(g, box(0.5, 0.55, 0.3), M(C.stone), x + (i - 1.5) * (s / 4), 0.15 + th + 0.37, z + sx * (s / 2)); } colB(g, x, z, s, s); };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(sx * W / 2, sz * W / 2, 2.4, 4.8);
  for (const sx of [-1, 1]) { tower(sx * 2.6, W / 2, 2.4, 6.0); win(g, sx * 2.6, 4.2, W / 2 + 1.22, 0, 0.25, 0.6); }
  P(g, box(3.0, 0.8, 1.2), ASH(), 0, 5.4, W / 2);
  P(g, box(2.8, 0.06, 0.1), M(0xe0d8c0), 0, 5.4, W / 2 + 0.62);
  // распахнутые ворота
  for (const s of [-1, 1]) { const lf = grp(g, s * 1.4, 0.15, W / 2 - 0.3, 0, s * -1.2, 0); P(lf, box(1.4, 3.4, 0.12), PLANK(), -s * 0.7, 1.7, 0); for (const yy of [0.6, 2.8]) P(lf, box(1.4, 0.12, 0.16), ironM(), -s * 0.7, yy, 0); }
  // казарменный корпус (контубернии)
  plinth(g, 0, -4.0, 12, 4, 0.35);
  wall(g, 0, 0.35, -4.0, 11.6, 3.0, 3.6);
  gable(g, 0, 3.35, -4.0, 11.6, 3.6, 0.42, 0.35, 'x');
  for (let i = 0; i < 5; i++) door(g, -4.6 + i * 2.3, 0.35, -2.17, 0, 0.9, 2.0);
  colB(g, 0, -4.0, 11.8, 3.8);
  // штандарты: орёл и сигнум
  const st = grp(g, -3.5, 0.15, 2.0);
  P(st, cyl(0.04, 0.04, 3.4, 6), M(C.woodD), 0, 1.7, 0);
  P(st, box(0.5, 0.05, 0.05), goldM(), 0, 3.3, 0);
  const eg = grp(st, 0, 3.55, 0); P(eg, sph(0.1, 8, 6), goldM(), 0, 0, 0, 0, 0, 0, 0.8, 1, 1.3); for (const s of [-1, 1]) P(eg, extr('eagleW', [[0, 0], [0.32, 0.18], [0.3, 0.05], [0.12, -0.08]], 0.02, 0), goldM(), s * 0.05, 0.02, 0, 0, s > 0 ? 0 : PI, 0); P(eg, sph(0.05, 6, 5), goldM(), 0, 0.1, 0.1);
  const sg = grp(g, -2.4, 0.15, 2.0);
  P(sg, cyl(0.04, 0.04, 3.2, 6), M(C.woodD), 0, 1.6, 0);
  for (let i = 0; i < 5; i++) P(sg, cyl(0.12, 0.12, 0.03, 12), goldM(), 0, 1.4 + i * 0.32, 0.04, HPI);
  P(sg, extr('signumHand', [[-0.06, 0], [0.06, 0], [0.07, 0.18], [0.0, 0.24], [-0.07, 0.18]], 0.03, 0.005), goldM(), 0, 3.2, 0);
  // столбы для учебного боя
  for (let i = 0; i < 3; i++) { post(g, 3.2 + i * 1.6, 0.15, 2.5, 1.8, 0.12, M(0x8a6a44)); colC(g, 3.2 + i * 1.6, 2.5, 0.2); }
  const rk = grp(g, 6.4, 0.15, -0.3, 0, -HPI, 0);
  P(rk, box(1.8, 0.08, 0.3), M(C.woodD), 0, 1.1, 0); for (const s of [-1, 1]) P(rk, box(0.08, 1.2, 0.3), M(C.woodD), s * 0.85, 0.6, 0);
  for (let i = 0; i < 5; i++) { const w = buildWeapon(i % 2 ? 'pilum' : 'hasta', 0); w.scale.setScalar(0.62); w.position.set(-0.7 + i * 0.35, 0.5, 0.0); rk.add(w); }
  for (const sx of [-1, 1]) { const s = buildShield('scutum', 0); s.position.set(sx * 4.5, 0.15 + 0.53, -1.6); s.rotation.set(-0.15, 0, 0); g.add(s); }
  for (const sx of [-1, 1]) { brazier(g, sx * 1.9, 0.15, W / 2 + 1.6); banner(g, sx * 3.0, 6.15, W / 2 + 0.3, 2.2); }
};
// ---------- Термы ----------
BUILD.thermae = (g) => {
  plinth(g, 0, -2.0, 15, 9, 0.4);
  // центральный зал (фригидарий) с большими окнами
  wall(g, 1.6, 0.4, -2.2, 8.6, 6.4, 8.2, 0, { mat: BRICK(), dado: false });
  gable(g, 1.6, 6.8, -2.2, 8.6, 8.2, 0.36, 0.4, 'z');
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const x = 1.6 + s * 4.32; win(g, x, 4.5, -4.6 + i * 2.4, s > 0 ? HPI : -HPI, 1.0, 1.8); P(g, G('archW', () => new THREE.CircleGeometry(0.5, 10, 0, PI)), M(0x1a140e), x + s * 0.03, 5.4, -4.6 + i * 2.4, 0, s * HPI, 0); }
  P(g, cyl(1.8, 1.8, 6.0, 16, false), BRICK(), 1.6, 3.4, -6.4).scale.set(1, 1, 0.6);   // апсида
  // круглый кальдарий с куполом
  P(g, tcyl(3.3, 3.3, 5.2, 24), BRICK(), -4.2, 0.4 + 2.6, -2.2);
  P(g, cyl(3.45, 3.45, 0.3, 24), M(C.stone), -4.2, 5.75, -2.2);
  P(g, G('dome', () => new THREE.SphereGeometry(3.3, 24, 8, 0, TAU, 0, HPI * 0.92)), M(0xc8bca8), -4.2, 5.75, -2.2);
  P(g, cyl(0.5, 0.5, 0.3, 14), M(C.stone), -4.2, 9.0, -2.2);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI + PI * 0.08; win(g, -4.2 + Math.cos(a) * 3.32, 3.8, -2.2 + Math.sin(a) * 3.32, HPI - a, 0.8, 1.4); }
  colC(g, -4.2, -2.2, 3.4); colB(g, 1.6, -2.2, 8.8, 8.4);
  // топка с трубой
  P(g, tbox(1.4, 2.2, 1.4), BRICK(), 6.4, 1.5, -5.6); P(g, tbox(0.8, 3.6, 0.8), BRICK(), 6.4, 4.3, -5.6);
  P(g, box(0.6, 0.6, 0.1), M(0x1a0e08), 6.4, 1.0, -4.85); P(g, box(0.4, 0.2, 0.05), EMB(), 6.4, 0.85, -4.82);
  const fl = new VLight(0xff7a30, 4, 7, 1.6); fl.position.set(6.4, 1.2, -4.2); g.add(fl);
  colB(g, 6.4, -5.6, 1.5, 1.5);
  // портик входа
  colRow(g, -1.4, 2.4, 4.6, 2.4, 5, 0.4, 4.2, 0.24, 'ionic');
  P(g, box(7, 0.5, 0.6), M(C.marble), 1.6, 4.85, 2.4);
  shed(g, 1.6, 5.2, 2.15, 7.2, 0.9, 0.3);
  door(g, 1.6, 0.4, 1.93, 0, 1.6, 3.0, true);
  stairs(g, 1.6, 0.2, 2.5, 6, 1, 0.4, 0.5);
  // открытый бассейн (натацио)
  const pool = grp(g, -3.8, 0, 4.9);
  basin(pool, 0, 0, 0, 6.2, 0.55, 3.4, 0.3, M(C.marble));
  for (let i = 0; i < 3; i++) P(pool, box(1.0, 0.12, 0.3), M(C.marble), 2.3, 0.45 - i * 0.1, -1.0 + i * 0.3);
  for (const s of [-1, 1]) statue(pool, s * 3.4, 0, 0, 0.45, M(0xe8e4d8), s * -HPI);
  colB(g, -3.8, 4.9, 6.2, 3.4);
  amphora(g, 5.6, 0.4, 1.4, 1.1, 0xa8784a); amphora(g, 6.1, 0.4, 1.0, 1.1, 0xa8784a);
};
// ---------- Таверна ----------
BUILD.taberna = (g) => {
  plinth(g, 0, -1.0, 7.6, 5.6, 0.3);
  wall(g, 0, 0.3, -1.2, 7.2, 5.6, 5.0, 0, { dadoCol: 0x8a5a2a });
  P(g, box(7.24, 0.12, 5.04), M(C.stone), 0, 3.1, -1.2);
  gable(g, 0, 5.9, -1.2, 7.2, 5.0, 0.42, 0.4, 'x');
  // широкий вход и прилавок с долиями (термополий)
  P(g, box(4.2, 2.5, 0.06), M(0x1a120c), -0.9, 1.55, 1.31);
  const ct = grp(g, -0.9, 0.3, 1.9);
  P(ct, box(3.6, 1.0, 0.8), M(0xe0d4b8), 0, 0.5, 0); P(ct, box(3.7, 0.08, 0.9), M(C.marble), 0, 1.04, 0);
  P(ct, box(3.6, 0.5, 0.82), M(0xa83a22), 0, 0.3, 0);
  for (let i = 0; i < 3; i++) { P(ct, cyl(0.22, 0.22, 0.04, 12), M(0x2a1a10), -1.1 + i * 1.1, 1.09, 0); }
  for (let i = 0; i < 4; i++) amphora(ct, -1.6 + i * 1.07, 1.08, -0.25, 0.45, 0xa86a3a);
  colB(g, 0, -1.2, 7.4, 5.2); colB(g, -0.9, 1.9, 3.7, 0.9);
  // балкон второго этажа
  for (let i = 0; i < 5; i++) P(g, box(0.16, 0.16, 1.4), M(C.woodD), -3 + i * 1.5, 3.4, 1.8);
  P(g, tbox(7.0, 0.12, 1.3), PLANK(), 0, 3.5, 1.9);
  for (let i = 0; i < 15; i++) P(g, box(0.05, 0.8, 0.05), M(C.wood), -3.4 + i * 0.485, 3.95, 2.5);
  P(g, box(7.0, 0.08, 0.1), M(C.wood), 0, 4.38, 2.5);
  for (const x of [-3.4, 3.4]) post(g, x, 0.3, 2.45, 3.1, 0.08);
  P(g, box(1.3, 2.0, 0.06), M(0x1a120c), 0, 4.4, 1.31); P(g, box(1.1, 1.8, 0.07), M(0x5a3a1e), 0, 4.4, 1.33);
  win(g, -2.4, 4.7, 1.31); win(g, 2.4, 4.7, 1.31);
  // вывеска
  const sg = grp(g, 3.0, 2.8, 2.0); P(sg, box(0.06, 0.06, 0.8), ironM(), 0, 0, -0.4); P(sg, box(0.9, 0.55, 0.05), M(0xe8dcbc), 0, -0.35, 0, 0, HPI, 0); P(sg, cyl(0.12, 0.12, 0.06, 10), M(0x9a2a22), 0.03, -0.35, 0, 0, 0, HPI);
  // столы и лавки, перголa с лозой
  for (const [x, z] of [[2.4, 3.6], [-2.6, 3.8]]) { table(g, x, 0, z, 1.2, 0.7); bench(g, x, 0, z + 0.7, 1.2); bench(g, x, 0, z - 0.7, 1.2); colB(g, x, z, 1.3, 1.9); }
  for (const [x, z] of [[1.0, 3.0], [1.0, 5.0], [3.6, 3.0], [3.6, 5.0]]) post(g, x, 0, z, 2.6, 0.07);
  for (let i = 0; i < 4; i++) P(g, box(3.0, 0.08, 0.08), M(C.woodD), 2.3, 2.62, 3.0 + i * 0.66);
  for (let i = 0; i < 7; i++) P(g, G('vineBlob', () => lumpy(new THREE.IcosahedronGeometry(0.55, 0), 0.2, 3)), M(i % 2 ? 0x4a7a2a : 0x5a8a32), 1.2 + (i % 4) * 0.8, 2.85, 3.2 + Math.floor(i / 4) * 1.2, 0, i, 0, 1, 0.45, 1);
  barrel(g, 3.4, 0, 0.0); barrel(g, 3.4, 0, -0.75); crate(g, -3.6, 0, 1.9, 0.8);
  const l = new VLight(0xffb060, 3, 8, 1.6); l.position.set(-0.9, 2.6, 2.2); g.add(l);
  P(g, cyl(0.06, 0.08, 0.14, 8), M(0xc8783a), -0.9, 2.65, 1.5); P(g, cone(0.03, 0.08, 6), FLAME(), -0.9, 2.78, 1.5).castShadow = false;
};
// ---------- Храм Юпитера ----------
BUILD.templum = (g) => {
  const ph = 2.8;
  plinth(g, 0, -2.0, 10.2, 14.2, ph, TM('ashlar', 0xf2ecdc));
  P(g, box(10.5, 0.2, 14.5), M(C.marble), 0, 0.1, -2.0);
  P(g, box(10.4, 0.25, 14.4), M(C.marble), 0, ph - 0.1, -2.0);
  stairs(g, 0, ph, 5.1, 7.6, 10, ph / 10, 0.4, 0, M(C.marble));
  for (const s of [-1, 1]) P(g, box(1.2, ph, 4.0), TM('ashlar', 0xf2ecdc), s * 4.4, ph / 2, 7.0);
  // целла
  wall(g, 0, ph, -4.4, 8.0, 8.2, 8.8, 0, { col: C.marble, dado: false });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) P(g, box(0.35, 8.0, 0.2), M(0xe8e2d4), s * 4.05, ph + 4.0, -7.8 + i * 2.2, 0, HPI, 0);
  door(g, 0, ph, 0.03, 0, 2.2, 4.6, true);
  // портик: 6 коринфских колонн по фасаду, по две вглубь
  const ch = 8.5;
  colRow(g, -4.2, 4.0, 4.2, 4.0, 6, ph, ch, 0.38, 'corinth', null, false);
  for (const s of [-1, 1]) colRow(g, s * 4.2, 1.9, s * 4.2, 1.9, 1, ph, ch, 0.38, 'corinth', null, false);
  // антаблемент и фронтон
  P(g, box(9.6, 0.6, 14.0), M(C.marble), 0, ph + ch + 0.3, -2.4);
  P(g, box(9.8, 0.25, 14.2), M(0xe0d8c8), 0, ph + ch + 0.72, -2.4);
  P(g, box(9.62, 0.2, 0.05), M(0x9a2a22), 0, ph + ch + 0.3, 4.62);
  const r = gable(g, 0, ph + ch + 0.85, -2.4, 9.6, 14.0, 0.3, 0.35, 'z', { gableCol: C.marble });
  // акротерии и квадрига-намёк: позолоченные фигуры
  const yT = ph + ch + 0.85 + 4.8 * Math.tan(0.3);
  P(g, sph(0.35, 8, 6), goldM(), 0, yT + 0.4, 4.5);
  for (const s of [-1, 1]) P(g, cone(0.3, 0.8, 6), goldM(), s * 4.8, ph + ch + 1.3, 4.6);
  // рельеф во фронтоне: орёл
  P(g, extr('pedEagle', [[-1.2, 0], [1.2, 0], [0.6, 0.5], [0, 0.9], [-0.6, 0.5]], 0.1, 0), goldM(), 0, ph + ch + 1.0, 4.65);
  colB(g, 0, -2.0, 10.2, 14.2);
  // алтарь перед лестницей
  const al = grp(g, 0, 0, 9.4);
  P(al, rbox(1.4, 1.0, 0.9, 0.04), M(C.marble), 0, 0.5, 0); P(al, box(1.6, 0.12, 1.1), M(C.marble), 0, 1.06, 0);
  for (const s of [-1, 1]) P(al, cyl(0.12, 0.12, 0.9, 10), M(C.marble), s * 0.62, 1.15, 0, HPI);
  P(al, ico(0.18, 0), EMB(), 0, 1.2, 0); P(al, cone(0.15, 0.4, 6), FLAME(), 0, 1.4, 0).castShadow = false;
  const l = new VLight(0xffa040, 5, 10, 1.6); l.position.set(0, 1.8, 0); al.add(l);
  colB(g, 0, 9.4, 1.6, 1.1);
  for (const s of [-1, 1]) brazier(g, s * 3.2, ph, 4.9);
};
// ---------- Сторожевая башня ----------
BUILD.turris = (g) => {
  const s = 4.4, h = 9;
  P(g, tbox(s + 0.4, 2.0, s + 0.4), ASH(), 0, -0.5, 0);
  P(g, tbox(s, h, s), ASH(), 0, h / 2, 0);
  P(g, box(s + 0.12, 0.25, s + 0.12), M(C.stone), 0, 4.5, 0);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; for (const yy of [3.2, 6.6]) win(g, Math.sin(a) * (s / 2 + 0.01), yy, Math.cos(a) * (s / 2 + 0.01), a, 0.16, 0.8); }
  door(g, 0, 0.0, s / 2 + 0.01, 0, 1.1, 2.1);
  // выступающий парапет с зубцами
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; for (let k = 0; k < 6; k++) P(g, box(0.3, 0.4, 0.3), M(C.stone), Math.sin(a) * (s / 2 + 0.15) + Math.cos(a) * (-2 + k * 0.8), h - 0.2, Math.cos(a) * (s / 2 + 0.15) - Math.sin(a) * (-2 + k * 0.8)); }
  P(g, box(s + 0.6, 0.3, s + 0.6), M(C.stone), 0, h + 0.15, 0);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; for (let k = 0; k < 4; k++) P(g, box(0.55, 0.7, 0.35), ASH(), Math.sin(a) * (s / 2 + 0.12) + Math.cos(a) * (-1.8 + k * 1.2), h + 0.65, Math.cos(a) * (s / 2 + 0.12) - Math.sin(a) * (-1.8 + k * 1.2), 0, a, 0); }
  brazier(g, 1.2, h + 0.3, 1.2, 0.9, 6, 16);
  banner(g, -1.4, h + 0.3, -1.4, 2.6);
  colB(g, 0, 0, s + 0.4, s + 0.4);
};
// ---------- Участок стены ----------
BUILD.murus = (g) => {
  const L = 11, t = 1.6, h = 4.6;
  P(g, tbox(L, h + 1.5, t), ASH(), 0, (h - 1.5) / 2, 0);
  P(g, box(L + 0.1, 0.2, t + 0.25), M(C.stone), 0, h - 0.1, 0);
  for (let i = 0; i < 8; i++) P(g, box(0.75, 0.75, 0.35), ASH(), -L / 2 + 0.6 + i * ((L - 1.2) / 7), h + 0.37, t / 2 - 0.15);
  P(g, box(L, 0.45, 0.25), ASH(), 0, h + 0.22, -t / 2 + 0.12);
  for (let i = 0; i < 3; i++) P(g, tbox(0.9, h, 0.6), ASH(), -3.6 + i * 3.6, h / 2, -t / 2 - 0.3);
  stairs(g, 4.0, h - 0.4, -1.4, 0.9, 7, (h - 0.4) / 7, 0.38, -HPI);
  colB(g, 0, 0, L, t); colB(g, 0, -1.1, 8.4, 0.8);
};
// ---------- Маяк (+Z — море) ----------
BUILD.pharos = (g) => {
  P(g, tbox(8, 10.5, 8), ASH(), 0, 3.75, 0);
  P(g, box(8.3, 0.3, 8.3), M(C.stone), 0, 9.1, 0);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; for (const yy of [3.5, 6.5]) for (const k of [-1.8, 1.8]) win(g, Math.sin(a) * 4.01 + Math.cos(a) * k, yy, Math.cos(a) * 4.01 - Math.sin(a) * k, a, 0.4, 0.9); }
  door(g, 0, 1.6, -4.01, PI, 1.2, 2.2);
  stairs(g, 0, 1.6, -4.0, 1.6, 5, 0.32, 0.36, PI);
  P(g, tcyl(2.9, 3.1, 7, 8), ASH(), 0, 9.25 + 3.5, 0);
  P(g, cyl(3.2, 3.2, 0.3, 8), M(C.stone), 0, 16.4, 0);
  P(g, tcyl(1.7, 1.9, 2.5, 16), ASH(), 0, 17.8, 0);
  // фонарь: колонны, огонь, бронзовое зеркало, купол со статуей
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; column(g, Math.cos(a) * 1.5, 19.05, Math.sin(a) * 1.5, 2.6, 0.12, 'tuscan'); }
  P(g, cyl(1.9, 1.9, 0.25, 16), M(C.stone), 0, 21.75, 0);
  P(g, cone(1.9, 1.2, 16), M(0xb08d3c, { metalness: 0.6, roughness: 0.4 }), 0, 22.5, 0);
  statue(g, 0, 23.0, 0, 0.5, goldM());
  P(g, cyl(0.8, 0.9, 0.5, 12), bronzeM(), 0, 19.3, 0);
  P(g, ico(0.6, 0), EMB(), 0, 19.6, 0);
  const f1 = P(g, cone(0.7, 1.6, 8), FLAME(), 0, 20.3, 0); f1.castShadow = false;
  P(g, cone(0.4, 1.0, 7), FLAME2(), 0, 20.1, 0).castShadow = false;
  P(g, cyl(0.7, 0.7, 0.05, 16), MET(0xe8c870, 0.15, 1), 0, 20.2, -1.0, HPI - 0.3);
  const l = new VLight(0xffb050, 40, 60, 1.2); l.position.set(0, 20.5, 0); g.add(l);
  g.userData.flame = f1; g.userData.light = l;
  colB(g, 0, 0, 8, 8);
};
// ---------- Амфитеатр ----------
BUILD.amphitheatrum = (g) => {
  const A = 44.6, Bz = 35.6;        // наружный эллипс
  const aI = 25, bI = 17;           // арена 50 × 34
  const pw = 0.9, ph = 3.6;         // подиум
  const Ai = 41.6, Bi = 32.6;       // внутренняя стена кольцевой галереи
  const H1 = 5.6, H2 = 5.0, H3 = 5.0, HA = 3.2, Htot = H1 + H2 + H3 + HA;
  const tiers = 13, seatTop = 14.2;
  const gateA = 0.12;               // половина углового раствора ворот на длинной оси
  const ell = (a, b, th) => [a * Math.cos(th), b * Math.sin(th)];
  const inGate = (th) => { const t0 = ((th % TAU) + TAU) % TAU; return Math.min(Math.abs(t0), Math.abs(t0 - PI), Math.abs(t0 - TAU)) < gateA; };
  // фундамент-кольцо и песок арены
  P(g, G('amphFound', () => { const s = new THREE.Shape(); for (let i = 0; i <= 64; i++) { const [x, z] = ell(A + 0.6, Bz + 0.6, (i / 64) * TAU); i ? s.lineTo(x, z) : s.moveTo(x, z); } const h = new THREE.Path(); for (let i = 0; i <= 64; i++) { const [x, z] = ell(aI, bI, -(i / 64) * TAU); i ? h.lineTo(x, z) : h.moveTo(x, z); } s.holes.push(h); const gg = new THREE.ExtrudeGeometry(s, { depth: 1.7, bevelEnabled: false, curveSegments: 1 }); gg.rotateX(HPI); gg.translate(0, 0.2, 0); return gg; }), M(C.stoneD), 0, 0, 0);
  P(g, G('arenaSand', () => { const c = new THREE.CircleGeometry(1, 48); c.rotateX(-HPI); return c; }), M(0xd8bc84), 0, 0.06, 0, 0, 0, 0, aI + 0.3, 1, bI + 0.3);
  P(g, G('arenaSand2', () => new THREE.CylinderGeometry(1, 1, 1.5, 48, 1, true)), M(0xb89c6c), 0, -0.7, 0, 0, 0, 0, aI + 0.3, 1, bI + 0.3);
  // одна общая геометрия для ярусов, подиума и торцов у ворот
  const seats = G('amphSeats', () => {
    const pos = [], idx = [], N = 128;
    const quad = (a, b, c, d) => { const i = pos.length / 3; pos.push(...a, ...b, ...c, ...d); idx.push(i, i + 1, i + 2, i, i + 2, i + 3); };
    const pt = (s, th, y) => { const a = lerp(aI + pw, Ai, s), b = lerp(bI + pw, Bi, s); return [a * Math.cos(th), y, b * Math.sin(th)]; };
    for (let k = 0; k < tiers; k++) {
      const s0 = k / tiers, s1 = (k + 1) / tiers, y0 = lerp(ph, seatTop, k / tiers), y1 = lerp(ph, seatTop, (k + 1) / tiers);
      for (let i = 0; i < N; i++) {
        const t0 = (i / N) * TAU, t1 = ((i + 1) / N) * TAU;
        if (inGate((t0 + t1) / 2)) continue;
        quad(pt(s0, t0, y1), pt(s0, t1, y1), pt(s1, t1, y1), pt(s1, t0, y1));     // сиденье
        quad(pt(s0, t0, y0), pt(s0, t1, y0), pt(s0, t1, y1), pt(s0, t0, y1));     // подступенок
        // торцы у проходов ворот
        if (inGate(t1 + 1e-4 + TAU / N * 0.5)) quad(pt(s0, t1, 0), pt(s1, t1, 0), pt(s1, t1, y1), pt(s0, t1, y1));
        if (inGate(t0 - 1e-4 - TAU / N * 0.5)) quad(pt(s1, t0, 0), pt(s0, t0, 0), pt(s0, t0, y1), pt(s1, t0, y1));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  });
  P(g, seats, M(0xd2c6aa, { side: THREE.DoubleSide }), 0, 0, 0);
  // подиум арены с мраморной облицовкой и сеткой
  const ringWall = (a, b, y0, h, t, N, mat, skipGate, colli, gateW = gateA) => {
    for (let i = 0; i < N; i++) {
      const t0 = (i / N) * TAU, t1 = ((i + 1) / N) * TAU, tm = (t0 + t1) / 2;
      const tt = ((tm % TAU) + TAU) % TAU;
      if (skipGate && Math.min(Math.abs(tt), Math.abs(tt - PI), Math.abs(tt - TAU)) < gateW) continue;
      const [x0, z0] = ell(a, b, t0), [x1, z1] = ell(a, b, t1);
      const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) + HPI;
      const nx = Math.cos(tm) / a, nz = Math.sin(tm) / b, nl = Math.hypot(nx, nz);
      const cx = (x0 + x1) / 2 + (nx / nl) * t / 2, cz = (z0 + z1) / 2 + (nz / nl) * t / 2;
      P(g, box(len + 0.06, h, t), mat, cx, y0 + h / 2, cz, 0, ry, 0);
      if (colli) colB(g, cx, cz, len + 0.1, t + 0.2, ry);
    }
  };
  ringWall(aI, bI, -0.5, ph + 0.5, pw, 48, M(0xe8e0cc), true, true);
  ringWall(aI + 0.05, bI + 0.05, ph, 0.25, pw + 0.2, 48, M(C.marble), true, false);
  ringWall(Ai, Bi, -0.5, seatTop + 0.6, 1.0, 48, M(0x9a8e78), true, true, gateA * 0.75);
  // кольцевая галерея: перекрытия ярусов (видны сквозь арки)
  for (const [yy, th] of [[H1, 0.4], [H1 + H2, 0.4], [seatTop + 0.6, 0.35]]) {
    P(g, G(`amphFloor${yy}`, () => { const s = new THREE.Shape(); for (let i = 0; i <= 64; i++) { const [x, z] = ell(A - 0.6, Bz - 0.6, (i / 64) * TAU); i ? s.lineTo(x, z) : s.moveTo(x, z); } const h = new THREE.Path(); for (let i = 0; i <= 64; i++) { const [x, z] = ell(Ai, Bi, -(i / 64) * TAU); i ? h.lineTo(x, z) : h.moveTo(x, z); } s.holes.push(h); const gg = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 1 }); gg.rotateX(HPI); return gg; }), M(0xb8ac94), 0, yy, 0);
  }
  // наружный фасад: 3 яруса арок + аттик; одна грань = один пролёт
  const NF = 52;
  const facet = G('amphFacet', () => {
    const w = 1, s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(w / 2, Htot), new THREE.Vector2(-w / 2, Htot)]);
    const LA = 4.9;   // средняя длина грани: дуга арки в метрах по высоте равна полуширине
    const arch = (y0, hh, aw) => { const p = new THREE.Path(), ry = (aw / 2) * LA; p.moveTo(-aw / 2, y0); p.lineTo(aw / 2, y0); p.lineTo(aw / 2, y0 + hh - ry); for (let i = 1; i < 10; i++) { const a = (i / 10) * PI; p.lineTo((aw / 2) * Math.cos(a), y0 + hh - ry + ry * Math.sin(a)); } p.lineTo(-aw / 2, y0 + hh - ry); p.lineTo(-aw / 2, y0); return p; };
    s.holes.push(arch(0.0, H1 - 1.2, 0.62), arch(H1 + 0.6, H2 - 1.3, 0.56), arch(H1 + H2 + 0.6, H3 - 1.3, 0.56));
    const win4 = new THREE.Path([new THREE.Vector2(-0.12, H1 + H2 + H3 + 1.2), new THREE.Vector2(0.12, H1 + H2 + H3 + 1.2), new THREE.Vector2(0.12, H1 + H2 + H3 + 2.0), new THREE.Vector2(-0.12, H1 + H2 + H3 + 2.0)]);
    s.holes.push(win4);
    const gg = new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: false, curveSegments: 1 });
    gg.translate(0, 0, -1.2);
    return gg;
  });
  const fm = TM('ashlar', 0xf0e6d0);
  const facM = M(0xe6dcc4);
  for (let i = 0; i < NF; i++) {
    const t0 = (i / NF) * TAU, t1 = ((i + 1) / NF) * TAU, tm = (t0 + t1) / 2;
    const [x0, z0] = ell(A, Bz, t0), [x1, z1] = ell(A, Bz, t1);
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) + HPI;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const f = grp(g, cx, 0, cz, 0, ry, 0);
    const m = P(f, facet, facM, 0, 0, 0); m.scale.set(len + 0.02, 1, 1);
    // полуколонны между арками и карнизы ярусов
    for (const [yy, hh] of [[0, H1], [H1, H2], [H1 + H2, H3]]) {
      P(f, G('halfCol', () => new THREE.CylinderGeometry(0.32, 0.36, 1, 8, 1, false, -HPI, PI)), facM, len / 2, yy + hh / 2, 0, 0, 0, 0, 1, hh, 1);
      P(f, box(len + 0.05, 0.35, 0.5), M(0xd8ceb6), 0, yy + hh - 0.17, 0.2);
    }
    P(f, box(len + 0.05, 0.4, 0.6), M(0xd8ceb6), 0, Htot - 0.2, 0.15);
    // мачты велария
    if (i % 2 === 0) P(f, cyl(0.12, 0.14, 4, 6), M(C.woodD), 0, Htot + 1.6, 0.2);
    const tt = ((tm % TAU) + TAU) % TAU;
    const gate = Math.min(Math.abs(tt), Math.abs(tt - PI), Math.abs(tt - TAU)) < PI / NF + 1e-3;
    if (!gate) colB(g, cx, cz, len + 0.2, 1.6, ry);
    else {
      // ворота: решётка поднята, по бокам — пилоны с факелами
      P(f, box(len * 0.66, 0.2, 0.2), ironM(), 0, H1 - 1.6, -0.6);
      for (const s of [-1, 1]) brazier(f, s * len * 0.42, 0, 1.2, 0.9, 5, 12);
    }
  }
  // проходы ворот: стены по бокам (торцы трибун) — коллайдеры
  for (const side of [0, PI]) for (const s of [-1, 1]) {
    const th = side + s * gateA;
    const [x0, z0] = ell(aI + pw, bI + pw, th), [x1, z1] = ell(A, Bz, th);
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    colB(g, (x0 + x1) / 2, (z0 + z1) / 2, 0.8, len, ry);
  }
  // императорская ложа (пульвинар) на малой оси
  for (const s of [-1, 1]) {
    const pz = s * (bI + pw + 0.9);
    const pv = grp(g, 0, ph + 0.25, pz, 0, s > 0 ? PI : 0, 0);
    P(pv, box(6, 0.3, 3), M(C.marble), 0, 0.15, 0);
    for (const x of [-2.6, -0.9, 0.9, 2.6]) column(pv, x, 0.3, 1.2, 3.0, 0.15, 'corinth');
    P(pv, box(6.2, 0.3, 3.2), M(C.marble), 0, 3.45, 0);
    P(pv, box(6.4, 0.06, 3.4), M(s > 0 ? 0x6a1a6a : 0x8e1a14, { side: THREE.DoubleSide }), 0, 3.75, 0, 0.08);
    banner(pv, -3.2, 0.3, 1.4, 3.4); banner(pv, 3.2, 0.3, 1.4, 3.4);
  }
  // столбы и колонны-указатели в арене
  for (const s of [-1, 1]) { P(g, cyl(0.25, 0.3, 2.2, 10), M(C.marble), s * 12, 1.1, 0); colC(g, s * 12, 0, 0.35); }
  g.userData.arena = { a: aI, b: bI, gates: [[aI + pw, 0], [-(aI + pw), 0]] };
};
// ---------- Римская дорога: участок 4×8 м ----------
BUILD.via = (g) => {
  const r = rng(7);
  P(g, tbox(4.3, 1.0, 8.02), M(0x8a7a60), 0, -0.42, 0);          // насыпь уходит в землю
  const cols = [0x6e6862, 0x7a736a, 0x625c56, 0x837b70];
  for (let i = 0; i < 4; i++) for (let k = 0; k < 9; k++) {
    const w = 0.82 + r() * 0.12, d = 0.8 + r() * 0.12, x = -1.35 + i * 0.9 + (k % 2) * 0.12 - 0.06, z = -3.6 + k * 0.9;
    P(g, box(w, 0.12, d), M(cols[(i * 3 + k) % 4]), x, 0.12 + r() * 0.015, z, 0, (r() - 0.5) * 0.12, 0);
  }
  for (const sx of [-1, 1]) { P(g, box(0.3, 0.26, 8.02), M(0xb0a690), sx * 2.0, 0.13, 0); }   // бордюры
  P(g, box(0.18, 0.5, 0.18), M(0xd8d0c0), 2.28, 0.25, -3.8);                                  // мильный столбик
};
// мощение квадратного участка 4×4 (поворот, перекрёсток)
function paving4(g, seed) {
  const r = rng(seed); const cols = [0x6e6862, 0x7a736a, 0x625c56, 0x837b70];
  P(g, tbox(4.3, 1.0, 4.3), M(0x8a7a60), 0, -0.42, 0);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) P(g, box(0.82 + r() * 0.1, 0.12, 0.82 + r() * 0.1), M(cols[(i * 3 + k) % 4]), -1.35 + i * 0.9, 0.12 + r() * 0.015, -1.35 + k * 0.9, 0, (r() - 0.5) * 0.12, 0);
}
BUILD.via_turn = (g) => { // вход с -Z, выход на +X; бордюр по внешнему углу
  paving4(g, 11);
  P(g, box(4.3, 0.26, 0.3), M(0xb0a690), 0, 0.13, 2.0);
  P(g, box(0.3, 0.26, 4.3), M(0xb0a690), -2.0, 0.13, 0);
  P(g, box(0.3, 0.26, 0.3), M(0xb0a690), 2.0, 0.13, -2.0);
};
BUILD.via_cross = (g) => {
  paving4(g, 13);
  for (const [x, z] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) P(g, box(0.3, 0.3, 0.3), M(0xb0a690), x, 0.15, z);
  P(g, cyl(0.12, 0.14, 1.0, 8), M(0xd8d0c0), 2.25, 0.5, 2.25);
};
// ---------- Каменный горбатый мост 24 м: высокий свод посередине — под ним проходят лодки ----------
// y=0 — уровень концов настила; середина поднята на 4 м; вода примерно на y≈-1.5
BUILD.pons = (g) => {
  const st = TM('ashlar', 0xe0d6c2), dk = M(0x7a736a), HALF = 12, RISE = 4, N = 24;
  const lift = (z) => RISE * Math.max(0, 1 - (z / HALF) ** 2);
  const archTop = (z) => (Math.abs(z) < 7.8 ? -1.6 + 4.6 * Math.sqrt(1 - (z / 7.8) ** 2) : -4);
  const r = rng(17);
  for (let i = 0; i < N; i++) {
    const z0 = -HALF + i * (2 * HALF / N), z1 = z0 + 2 * HALF / N, zc = (z0 + z1) / 2;
    const y0 = lift(z0), y1 = lift(z1), yc = (y0 + y1) / 2, tilt = -Math.atan2(y1 - y0, z1 - z0), len = Math.hypot(z1 - z0, y1 - y0) + 0.04;
    const bot = Math.min(archTop(z0), archTop(z1)), hgt = yc - 0.05 - bot;
    if (hgt > 0.1) P(g, tbox(4.4, hgt, z1 - z0 + 0.02), st, 0, bot + hgt / 2, zc);
    P(g, box(4.0, 0.08, len), M([0x6e6862, 0x7a736a, 0x837b70][i % 3]), 0, yc, zc, tilt, (r() - 0.5) * 0.02, 0);
    for (const sx of [-1, 1]) { P(g, tbox(0.32, 0.85, len), st, sx * 2.06, yc + 0.42, zc, tilt); P(g, box(0.42, 0.1, len + 0.02), dk, sx * 2.06, yc + 0.9, zc, tilt); }
  }
  for (const sx of [-1, 1]) for (let k = 0; k <= 16; k++) { // клинчатые камни свода по фасадам
    const a = PI * k / 16, z = Math.cos(a) * 7.8, y = -1.6 + Math.sin(a) * 4.6;
    P(g, box(0.36, 0.6, 0.5), M(k % 2 ? 0xd2c8b2 : 0xbcb29c), sx * 2.15, y, z, -a + HPI);
  }
  for (const z of [-HALF + 1.5, HALF - 1.5]) P(g, tbox(4.8, 4, 3.2), st, 0, -2.0, z);
  for (const sx of [-1, 1]) for (const z of [-HALF - 0.1, HALF + 0.1]) { P(g, box(0.5, 1.2, 0.5), st, sx * 2.06, 0.6, z); P(g, sph(0.2, 8, 6), dk, sx * 2.06, 1.3, z); }
  for (const sx of [-1, 1]) colB(g, sx * 2.06, 0, 0.36, 2 * HALF);
};
// ---------- Своя (частная) конюшня: два денника, кормушка, маленький загон ----------
BUILD.equile = (g) => {
  plinth(g, 0, -2.6, 8.4, 4.6, 0.2);
  wall(g, 0, 0.2, -4.6, 8.0, 3.0, 0.5, 0, { mat: TM('ashlar', 0xe8e0cc), dado: false });
  for (const s of [-1, 1]) wall(g, s * 3.8, 0.2, -2.6, 0.5, 3.0, 4.0, 0, { mat: TM('ashlar', 0xe8e0cc), dado: false });
  for (let i = 0; i <= 2; i++) post(g, -3.8 + i * 3.8, 0.2, -0.5, 3.0, 0.12, M(C.woodD));
  P(g, box(0.12, 1.4, 3.6), PLANK(), 0, 0.9, -2.6);
  gable(g, 0, 3.2, -2.6, 8.0, 4.6, 0.42, 0.45, 'x', { mat: THATCH() });
  P(g, box(2.4, 0.35, 0.5), PLANK(), -1.9, 0.75, -4.0); P(g, box(2.4, 0.35, 0.5), PLANK(), 1.9, 0.75, -4.0);
  for (const x of [-1.6, 2.2]) P(g, G('hayPile', () => lumpy(new THREE.IcosahedronGeometry(0.6, 1), 0.2, 3)), M(0xd8bc6a), x, 0.25, -3.3, 0, x, 0, 1.1, 0.45, 0.9);
  fence(g, [[-4.2, 0.2], [-4.2, 5.4], [-1.2, 5.4]], 1.15); fence(g, [[1.2, 5.4], [4.2, 5.4], [4.2, 0.2]], 1.15);
  P(g, box(1.6, 0.45, 0.6), M(C.stone), 2.6, 0.22, 4.4); P(g, box(1.4, 0.03, 0.4), WATER(), 2.6, 0.43, 4.4);
  colB(g, 0, -4.6, 8.2, 0.6); for (const s of [-1, 1]) colB(g, s * 3.8, -2.6, 0.6, 4.2); colB(g, 2.6, 4.4, 1.6, 0.6);
};
// ---------- Конюшня ----------
BUILD.stabulum = (g) => {
  plinth(g, 0, -4.2, 13, 6.4, 0.25);
  const y = 0.25;
  wall(g, 0, y, -6.9, 12.6, 3.6, 0.6, 0, { mat: TM('ashlar', 0xe8e0cc), dado: false });          // задняя стена
  for (const s of [-1, 1]) wall(g, s * 6.0, y, -4.2, 0.6, 3.6, 6.0, 0, { mat: TM('ashlar', 0xe8e0cc), dado: false });
  for (let i = 0; i <= 4; i++) post(g, -6 + i * 3, y, -1.4, 3.6, 0.13, M(C.woodD));               // столбы фасада
  for (let i = 1; i < 4; i++) P(g, box(0.12, 1.5, 5.0), PLANK(), -6 + i * 3, y + 0.75, -4.1);       // перегородки денников
  P(g, box(12.4, 0.25, 0.25), M(C.woodD), 0, y + 3.55, -1.4);
  gable(g, 0, y + 3.6, -4.2, 12.6, 6.4, 0.42, 0.5, 'x');
  colB(g, 0, -6.9, 12.8, 0.7); for (const s of [-1, 1]) colB(g, s * 6.0, -4.2, 0.7, 6.2);
  // кони в денниках, сено, кормушки
  for (const [x, ry, col] of [[-4.5, 0.1, null], [1.5, -0.15, 0x231b17]]) {
    const h = makeAnimal('horse'); h.position.set(x, y, -4.0); h.rotation.y = PI + ry; h.scale.setScalar(1.12);
    if (col) h.traverse((m) => { if (m.isMesh && m.material && m.material.color && m.material.color.getHex() === 0x7a4a28) m.material = M(col); });
    g.add(h);
  }
  for (let i = 0; i < 4; i++) P(g, box(1.6, 0.4, 0.5), PLANK(), -4.5 + i * 3, y + 0.8, -6.3);       // кормушки
  for (let i = 0; i < 4; i++) P(g, G('hayPile', () => lumpy(new THREE.IcosahedronGeometry(0.6, 1), 0.2, 3)), M(0xd8bc6a), -4.5 + i * 3 + 0.5, y + 0.25, -5.6, 0, i, 0, 1.2, 0.45, 1);
  // загон перед конюшней
  fence(g, [[-6.4, -0.6], [-6.4, 7.6], [-1.6, 7.6]], 1.25); fence(g, [[1.6, 7.6], [6.4, 7.6], [6.4, -0.6]], 1.25);
  P(g, box(2.2, 0.5, 0.7), M(C.stone), -3.5, 0.25, 6.6); P(g, box(2.0, 0.03, 0.5), WATER(), -3.5, 0.49, 6.6);  // поилка
  colB(g, -3.5, 6.6, 2.2, 0.7);
  P(g, G('haystack', () => lumpy(new THREE.ConeGeometry(1.2, 2.2, 10, 2), 0.06, 2)), M(0xd8b860), 4.6, 1.1, 5.6); colC(g, 4.6, 5.6, 1.2);
  const h3 = makeAnimal('horse'); h3.position.set(1.0, 0, 3.6); h3.rotation.y = 1.9; h3.scale.setScalar(1.12);
  h3.traverse((m) => { if (m.isMesh && m.material && m.material.color && m.material.color.getHex() === 0x7a4a28) m.material = M(0xe2dccf); });
  g.add(h3); colC(g, 1.0, 3.6, 1.0);
  for (let i = 0; i < 3; i++) sack(g, 5.2, 0, -0.6 + i * 0.5, 1, 0xd2be92, i);
  banner(g, -6.6, 0, 0.0, 3.4);
};
// ---------- Дом ----------
BUILD.domus = (g) => {
  plinth(g, 0, 0, 8.4, 8.4, 0.3);
  const y = 0.3, W = 8, h = 3.8, op = 2.4;
  // стены вокруг атрия (сплошные блоки по сторонам), внутренний пол и имплювий
  wall(g, 0, y, -2.7, W, h, 2.6); wall(g, 0, y, 2.7, W, h, 2.6);
  wall(g, -2.7, y, 0, 2.6, h, op + 0.2, 0, { dado: false }); wall(g, 2.7, y, 0, 2.6, h, op + 0.2, 0, { dado: false });
  P(g, box(op + 0.2, 0.06, op + 0.2), M(0xd8c8a8), 0, y + 0.03, 0);
  P(g, box(1.8, 0.2, 1.8), M(C.marble), 0, y + 0.1, 0); P(g, box(1.5, 0.04, 1.5), WATER(), 0, y + 0.19, 0);
  // кровля с комплювием: четыре ската внутрь
  const rf = grp(g, 0, y + h, 0);
  const sl = Math.atan2(0.7, 2.8);
  for (let i = 0; i < 4; i++) {
    const r = grp(rf, 0, 0, 0, 0, (i * PI) / 2, 0);
    P(r, tbox(W + 0.8, 0.12, 3.15), TILE(), 0, 0.42, op / 2 + 1.55, -sl);
    P(r, box(op + 0.1, 0.18, 0.12), M(C.tileD), 0, 0.06, op / 2 + 0.05);
  }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const hr = grp(rf, sx * (op / 2 + 0.05), 0.08, sz * (op / 2 + 0.05), 0, Math.atan2(sx, sz), 0); P(hr, box(0.14, 0.14, 4.3), M(C.tileD), 0, 0.42, 2.1, -Math.atan2(0.72, 4.0)); }
  // вход с пилястрами, окна, скамья, растения в горшках
  door(g, 0, y, 4.02, 0, 1.4, 2.6, true);
  for (const s of [-1, 1]) { P(g, box(0.3, 3.0, 0.2), M(C.marble), s * 1.15, y + 1.5, 4.08); P(g, box(0.4, 0.2, 0.3), M(C.marble), s * 1.15, y + 3.1, 4.08); }
  for (const s of [-1, 1]) { win(g, s * 4.02, y + 2.6, -1.8, s * HPI, 0.5, 0.6); win(g, s * 2.6, y + 2.7, 4.02, 0, 0.5, 0.5); }
  win(g, 1.8, y + 2.6, -4.02, PI, 0.5, 0.6); win(g, -1.8, y + 2.6, -4.02, PI, 0.5, 0.6);
  bench(g, 2.6, y, 4.6, 1.4);
  for (const s of [-1, 1]) { const pt = grp(g, s * 3.6, y, 4.6); P(pt, lathe('pot', [[0, 0], [0.18, 0], [0.26, 0.3], [0.22, 0.45], [0, 0.45]], 12), M(C.terracotta)); P(pt, G('potBush', () => lumpy(new THREE.IcosahedronGeometry(0.35, 1), 0.2, 6)), M(0x4a7a2a), 0, 0.7, 0); }
  P(g, cyl(0.04, 0.04, 0.6, 6), bronzeM(), 1.0, y + 2.9, 4.3, 0.6);
  colB(g, 0, 0, 8.4, 8.4);
};
// ---------- Ферма (пшеница) ----------
BUILD.farm = (g) => {
  // хижина-вилла
  plinth(g, -4.0, -4.6, 4.2, 3.2, 0.25);
  wall(g, -4.0, 0.25, -4.6, 3.8, 2.8, 2.8, 0, { col: 0xe0d0b0 });
  gable(g, -4.0, 3.05, -4.6, 3.8, 2.8, 0.45, 0.35, 'x');
  door(g, -4.0, 0.25, -3.18, 0, 1.0, 2.0);
  colB(g, -4.0, -4.6, 4.2, 3.2);
  cropRows(g, -0.8, 5.6, -5.2, 5.0, 0.58, 0.95, 0xe8cc78);
  fence(g, [[-1.4, -5.8], [6.2, -5.8], [6.2, 5.6], [-1.4, 5.6], [-1.4, -5.8]], 1.0, 3);
  // стог, гумно, плуг, долии
  P(g, G('haystack', () => lumpy(new THREE.ConeGeometry(1.2, 2.2, 10, 2), 0.06, 2)), M(0xd8b860), -5.0, 1.1, 0.6); P(g, cyl(0.04, 0.04, 2.8, 5), M(C.woodD), -5.0, 1.4, 0.6);
  colC(g, -5.0, 0.6, 1.2);
  P(g, cyl(1.5, 1.5, 0.12, 20), M(0xb8a888), -3.6, 0.06, 3.4);
  for (let i = 0; i < 3; i++) sack(g, -3.4 + i * 0.5, 0.12, 3.2, 0.9, 0xd8c08a, i);
  const pl = grp(g, -6.0, 0, -1.8, 0, 0.5, 0); P(pl, box(0.1, 0.1, 2.2), M(C.wood), 0, 0.4, 0, -0.3); P(pl, box(0.06, 0.3, 0.3), ironM(), 0, 0.12, 0.9);
  dolium(g, -2.0, 0, -3.6, 0.8); dolium(g, -2.0, 0, -2.6, 0.7);
};
// ---------- Оливковая роща ----------
BUILD.olivetum = (g) => {
  for (let i = 0; i < 9; i++) {
    const x = (i % 3 - 1) * 4.4, z = (Math.floor(i / 3) - 1) * 4.4;
    const t = makeTree('olive'); t.position.set(x + (i % 2) * 0.3, 0, z); t.rotation.y = i * 1.3; t.scale.setScalar(0.9 + (i % 3) * 0.08); g.add(t);
    colC(g, x + (i % 2) * 0.3, z, 0.35);
    P(g, cyl(0.9, 1.0, 0.1, 12), M(0x8a6a44), x + (i % 2) * 0.3, 0.03, z);
  }
  // сухая каменная ограда сзади, корзины с оливками, лестница
  for (let i = 0; i < 16; i++) P(g, ico(0.35, 0), M(i % 2 ? 0xb8ac94 : 0xa89c84), -6.4 + i * 0.85, 0.25, -6.3 + Math.sin(i) * 0.1, i, i * 2, 0, 1, 0.7, 0.9);
  colB(g, 0, -6.3, 13.6, 0.7);
  for (const [x, z] of [[2.2, 2.0], [2.7, 2.3], [-2.0, -2.2]]) { P(g, cyl(0.28, 0.22, 0.3, 12), M(0xa88a50), x, 0.15, z); for (let k = 0; k < 5; k++) P(g, sph(0.06, 5, 4), M(0x3a4a1a), x + Math.cos(k * 1.3) * 0.12, 0.32, z + Math.sin(k * 1.3) * 0.12); }
  const ld = grp(g, 4.6, 0, 3.6, -0.35, 0.6, 0); for (const s of [-1, 1]) P(ld, box(0.06, 3.0, 0.06), M(C.woodL), s * 0.22, 1.5, 0); for (let i = 0; i < 8; i++) P(ld, box(0.44, 0.04, 0.04), M(C.woodL), 0, 0.3 + i * 0.35, 0);
  for (let i = 0; i < 3; i++) amphora(g, -5.6 + i * 0.5, 0, 5.0, 1.0, 0xa8784a);
};
// ---------- Виноградник ----------
BUILD.vinea = (g) => {
  const blob = G('vineRow', () => lumpy(new THREE.IcosahedronGeometry(0.5, 0), 0.25, 8));
  for (let r = 0; r < 6; r++) {
    const x = -5 + r * 2;
    P(g, box(0.5, 0.05, 11), M(0x6e5034), x, 0.02, 0);
    for (let k = 0; k <= 6; k++) post(g, x, -0.4, -5.4 + k * 1.8, 1.9, 0.045, M(C.woodD));
    for (const yy of [0.8, 1.4]) P(g, cyl(0.01, 0.01, 10.8, 3), M(0x8a8a80), x, yy, 0, HPI);
    for (let k = 0; k < 10; k++) {
      const z = -4.9 + k * 1.09;
      P(g, blob, M(k % 2 ? 0x4a7a2a : 0x5e8a34), x + Math.sin(k * 2.3 + r) * 0.08, 1.15 + Math.sin(k + r) * 0.08, z, k, r, 0, 0.55, 0.7, 0.85);
      if ((k + r) % 2 === 0) for (const s of [-1, 1]) { const gx = x + s * 0.28, gz = z + 0.2; for (let i = 0; i < 3; i++) P(g, ico(0.07, 0), M(0x4a1a4a), gx, 0.82 - i * 0.07, gz + (i % 2) * 0.05); }
    }
    P(g, cyl(0.06, 0.08, 0.9, 6), M(0x5a3a22), x, 0.45, -5.0);
    colB(g, x, 0, 0.35, 10.8);
  }
  // давильный чан и корзины
  const vt = grp(g, -6.8, 0, 3.2);
  P(vt, cyl(1.0, 1.05, 0.7, 16), PLANK(), 0, 0.35, 0); P(vt, cyl(0.92, 0.92, 0.05, 16), M(0x4a1a3a), 0, 0.6, 0);
  for (const yy of [0.15, 0.55]) P(vt, tor(1.04, 0.025, 4, 18), ironM(), 0, yy, 0, HPI);
  colC(g, -6.8, 3.2, 1.1);
  for (const [x, z] of [[6.6, 2.8], [6.8, 3.5]]) { P(g, cyl(0.3, 0.24, 0.35, 12), M(0xa88a50), x, 0.17, z); for (let k = 0; k < 5; k++) P(g, ico(0.07, 0), M(0x4a1a4a), x + Math.cos(k * 1.3) * 0.12, 0.36, z + Math.sin(k * 1.3) * 0.12); }
  amphora(g, 6.4, 0, -3.5, 1.0, 0x8a4a2a); amphora(g, 6.9, 0, -3.2, 1.0, 0x8a4a2a);
};
// ---------- Лесопилка ----------
BUILD.lumber = (g) => {
  plinth(g, 0, 0, 6, 3.8, 0.1, M(0x8a7a5a));
  for (const [x, z] of [[-2.7, -1.6], [2.7, -1.6], [-2.7, 1.6], [2.7, 1.6]]) { post(g, x, 0.1, z, 3.0, 0.12); colC(g, x, z, 0.2); }
  P(g, box(5.8, 0.18, 0.18), M(C.woodD), 0, 3.1, -1.6); P(g, box(5.8, 0.18, 0.18), M(C.woodD), 0, 3.0, 1.6);
  shed(g, 0, 3.4, 0, 5.8, 3.6, 0.4, 0, THATCH());
  // козлы, бревно и рамная пила
  for (const x of [-1.6, 1.6]) for (const s of [-1, 1]) P(g, box(0.1, 1.2, 0.1), M(C.wood), x, 0.65, s * 0.3, s * 0.4);
  P(g, cyl(0.28, 0.3, 4.4, 10), M(0x7a5534), 0, 1.35, 0, 0, 0, HPI);
  for (const s of [-1, 1]) P(g, cyl(0.25, 0.25, 0.02, 10), M(0xc8a070), s * 2.2, 1.35, 0, 0, 0, HPI);
  const sw = grp(g, 0.6, 1.35, 0);
  P(sw, box(0.06, 1.6, 0.02), steelM(), 0, 0, 0); P(sw, box(0.08, 1.6, 0.08), M(C.woodL), 0, 0, -0.5);
  for (const s of [-1, 1]) P(sw, box(0.08, 0.08, 0.6), M(C.woodL), 0, s * 0.8, -0.25);
  colB(g, 0, 0, 4.6, 0.8);
  logPile(g, -1.2, 0, -4.8, 9, 3.2, HPI); colB(g, -1.2, -4.8, 3.4, 1.4, 0);
  plankStack(g, 3.6, 0, 3.6, 9, 0.6); colB(g, 3.6, 3.6, 1.2, 2.2, 0.6);
  // колода для колки с топором, опилки
  const cb = grp(g, -4.0, 0, 2.4); P(cb, cyl(0.35, 0.4, 0.6, 10), M(0x6a4a2a), 0, 0.3, 0); P(cb, cyl(0.33, 0.33, 0.02, 10), M(0xc8a070), 0, 0.61, 0);
  const ax = buildWeapon('axe', 0); ax.position.set(0.05, 0.62, 0); ax.rotation.set(0.25, 0, 2.8); cb.add(ax);
  P(g, G('sawdust', () => lumpy(new THREE.SphereGeometry(0.8, 10, 6, 0, TAU, 0, HPI), 0.15, 3)), M(0xd8b880), 1.0, 0.0, 0.6, 0, 0, 0, 1, 0.25, 1);
  for (let i = 0; i < 5; i++) P(g, cyl(0.12, 0.13, 0.4, 7), M(0xb88a5a), -4.6 + (i % 3) * 0.3, 0.2, 3.3 + Math.floor(i / 3) * 0.3);
};
// ---------- Гончарня ----------
BUILD.figlina = (g) => {
  // печь для обжига с топочным сводом и огнём
  const k = grp(g, -2.8, 0, -2.4);
  P(k, tcyl(1.5, 1.7, 1.6, 16), BRICK(), 0, 0.3, 0);
  P(k, hemi(1.5, 16, 7), BRICK(), 0, 1.1, 0);
  P(k, cyl(0.35, 0.35, 0.25, 10), BRICK(), 0, 2.6, 0);
  P(k, box(0.8, 0.8, 0.6), BRICK(), 0, 0.4, 1.45); P(k, box(0.55, 0.55, 0.1), M(0x1a0c06), 0, 0.4, 1.76); P(k, box(0.45, 0.2, 0.08), EMB(), 0, 0.25, 1.78);
  const kl = new VLight(0xff7a30, 5, 9, 1.6); kl.position.set(0, 0.6, 2.2); k.add(kl);
  colC(g, -2.8, -2.4, 1.7);
  logPile(g, -0.6, 0, -4.2, 5, 1.6, 0.2);
  // гончарный круг под навесом
  for (const [x, z] of [[1.4, -1.0], [4.4, -1.0], [1.4, -4.0], [4.4, -4.0]]) { post(g, x, 0, z, 2.6, 0.09); colC(g, x, z, 0.15); }
  shed(g, 2.9, 2.85, -2.5, 3.4, 3.4, 0.4, 0, TILE());
  const wh = grp(g, 2.9, 0, -2.5);
  P(wh, cyl(0.45, 0.45, 0.08, 16), M(0x8a7a6a), 0, 0.12, 0); P(wh, cyl(0.05, 0.05, 0.6, 6), M(C.woodD), 0, 0.45, 0); P(wh, cyl(0.28, 0.28, 0.05, 14), M(0x8a7a6a), 0, 0.76, 0);
  P(wh, lathe('wetpot', [[0, 0], [0.12, 0], [0.16, 0.12], [0.1, 0.24], [0.08, 0.3], [0, 0.3]], 12), M(0xa05a3a), 0, 0.79, 0);
  bench(g, 2.9, 0, -3.4, 1.0);
  // стеллажи с сохнущими амфорами
  for (const z of [1.6, 3.2]) {
    const r = grp(g, 1.6, 0, z);
    for (const yy of [0.05, 0.75]) P(r, box(4.2, 0.06, 0.7), M(C.woodL), 0, yy + 0.4, 0);
    for (const s of [-1, 1]) for (const sz of [-1, 1]) P(r, box(0.08, 1.5, 0.08), M(C.woodD), s * 2.05, 0.75, sz * 0.3);
    for (let i = 0; i < 6; i++) amphora(r, -1.75 + i * 0.7, 0.48, 0, 0.6, i % 2 ? 0xc87a4a : 0xb86a3a);
    colB(g, 1.6, z, 4.2, 0.8);
  }
  // глиняная яма
  P(g, G('clayPit', () => lumpy(new THREE.SphereGeometry(1.3, 12, 6, 0, TAU, 0, HPI), 0.12, 9)), M(C.clay), -3.2, -0.05, 2.4, 0, 0, 0, 1, 0.3, 1);
  P(g, box(0.2, 0.05, 1.2), M(C.woodD), -2.2, 0.45, 2.4, 0, 0, 0.3);
};
// ---------- Рыбный промысел (+Z — море) ----------
BUILD.fishery = (g) => {
  plinth(g, -3.0, -3.6, 4.2, 3.2, 0.25, M(0x9a8a6a));
  wall(g, -3.0, 0.25, -3.6, 3.8, 2.6, 2.8, 0, { col: 0xd8ccb0 });
  gable(g, -3.0, 2.85, -3.6, 3.8, 2.8, 0.5, 0.35, 'x', { mat: THATCH(), antefix: false });
  door(g, -3.0, 0.25, -2.18, 0, 1.0, 1.9);
  colB(g, -3.0, -3.6, 4.2, 3.2);
  // мостки на сваях
  const pier = grp(g, 3.0, 0, 0);
  P(pier, tbox(1.8, 0.16, 6.6), PLANK(), 0, 0.55, 3.2);
  for (let z = 0.4; z <= 6.4; z += 2) for (const s of [-1, 1]) P(pier, cyl(0.1, 0.12, 2.6, 6), M(0x4a3420), s * 0.8, -0.6, z);
  // рамы с сетями
  for (const [x, z] of [[-3.6, 0.6], [-0.6, 0.6]]) {
    const r = grp(g, x, 0, z);
    for (const s of [-1, 1]) post(r, s * 1.2, -0.4, 0, 2.6, 0.05, M(C.woodD));
    P(r, box(2.6, 0.06, 0.06), M(C.woodD), 0, 2.1, 0);
    const n = P(r, G('netQ', () => { const q = new THREE.PlaneGeometry(2.3, 1.6, 4, 4); const p = q.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2) * 0.08 + (p.getY(i) + 0.8) * -0.1); const uv = q.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3.8, uv.getY(i) * 2.6); return q; }), TM('net', 0xe0d4b4), 0, 1.25, 0);
    n.castShadow = false;
    for (let i = 0; i < 5; i++) P(r, sph(0.04, 5, 4), M(0xc8a060), -1 + i * 0.5, 0.45, 0.02);
    colB(g, x, z, 2.6, 0.3);
  }
  // вешала с вялящейся рыбой
  const dr = grp(g, 0.4, 0, -3.6);
  for (const s of [-1, 1]) post(dr, s * 1.4, 0, 0, 1.9, 0.05, M(C.woodD));
  P(dr, cyl(0.03, 0.03, 3.0, 5), M(C.woodD), 0, 1.85, 0, 0, 0, HPI);
  for (let i = 0; i < 9; i++) { const f = grp(dr, -1.2 + i * 0.3, 1.6, 0); P(f, sph(0.06, 6, 4), M(0x9aa8b0, { metalness: 0.3, roughness: 0.5 }), 0, -0.1, 0, 0, 0, 0, 0.45, 1.8, 0.3); P(f, cone(0.05, 0.08, 4), M(0x7a8890), 0, -0.3, 0, PI); }
  colB(g, 0.4, -3.6, 3.0, 0.3);
  // вытащенная на берег лодка, корзины, бухта каната
  const bt = makeShip('scapha'); bt.position.set(-0.6, 0.35, 4.4); bt.rotation.set(0, 0.9, 0.12); g.add(bt);
  colB(g, -0.6, 4.4, 1.6, 5, 0.9);
  for (const [x, z] of [[1.6, -1.4], [2.1, -1.2], [1.9, -1.8]]) P(g, cyl(0.25, 0.2, 0.32, 10), M(0xa88a50), x, 0.16, z);
  P(g, tor(0.3, 0.07, 5, 12), M(C.rope), 2.4, 0.62, 2.2, HPI);
};
// ---------- Скотный двор ----------
BUILD.pecus = (g) => {
  fence(g, [[-5.2, -4.2], [5.2, -4.2], [5.2, 4.2], [1.0, 4.2]], 1.1);
  fence(g, [[-1.4, 4.2], [-5.2, 4.2], [-5.2, -4.2]], 1.1);
  // хлев
  plinth(g, -1.0, -2.6, 6.2, 2.8, 0.15, M(0x8a7a5a));
  P(g, tbox(6.0, 2.4, 0.3), PLANK(), -1.0, 1.35, -3.85);
  for (const s of [-1, 1]) P(g, tbox(0.3, 2.4, 2.4), PLANK(), -1.0 + s * 2.85, 1.35, -2.65);
  for (const x of [-3.8, -1.0, 1.8]) post(g, x, 0.15, -1.3, 2.3, 0.1);
  shed(g, -1.0, 2.7, -2.6, 6.2, 2.8, 0.5, 0, THATCH());
  for (let i = 0; i < 3; i++) P(g, rbox(1.0, 0.5, 0.6, 0.06), M(0xd8bc6a), -3.0 + i * 1.1, 0.4, -3.2);
  colB(g, -1.0, -3.85, 6.2, 0.4); colB(g, -3.85, -2.65, 0.4, 2.6); colB(g, 1.85, -2.65, 0.4, 2.6);
  // кормушка и поилка
  P(g, box(2.2, 0.4, 0.5), M(C.woodD), 3.0, 0.3, -2.6); P(g, box(2.0, 0.05, 0.4), M(0xc8b060), 3.0, 0.48, -2.6);
  basin(g, 3.4, 0, 2.6, 1.4, 0.5, 0.6, 0.06, M(0x9a9080));
  // овцы и козы
  const r = rng(77);
  for (let i = 0; i < 6; i++) {
    const sh = i % 2 === 0;
    const a = grp(g, -3.2 + (i % 3) * 2.6 + r() * 0.6, 0, 0.2 + Math.floor(i / 3) * 2.0 + r() * 0.5, 0, r() * TAU, 0);
    const wool = M(sh ? 0xece4d4 : 0x8a7a64);
    P(a, sh ? G('woolBody', () => lumpy(new THREE.SphereGeometry(0.34, 10, 8), 0.1, 3)) : sph(0.3, 10, 8), wool, 0, 0.62, 0, 0, 0, 0, 0.8, 0.75, 1.15);
    P(a, sph(0.12, 8, 6), M(sh ? 0x2a2420 : 0x6a5a48), 0, 0.78, 0.42, 0, 0, 0, 0.8, 0.9, 1.25);
    for (const [x, z] of [[0.13, 0.22], [-0.13, 0.22], [0.13, -0.22], [-0.13, -0.22]]) P(a, cyl(0.03, 0.025, 0.42, 5), M(0x3a3028), x, 0.21, z);
    if (!sh) for (const s of [-1, 1]) P(a, cone(0.025, 0.16, 5), M(0x5a4a38), s * 0.05, 0.92, 0.38, -0.6);
  }
};
// ---------- Льняное поле ----------
TEXDRAW.flax = (x, n, r) => {
  x.clearRect(0, 0, n, n);
  for (let i = 0; i < 80; i++) {
    const px = r() * n, h = n * (0.6 + r() * 0.35), lean = (r() - 0.5) * 10;
    x.strokeStyle = shade(0x7aa04a, 0.75 + r() * 0.4); x.lineWidth = 1.4;
    x.beginPath(); x.moveTo(px, n); x.quadraticCurveTo(px + lean * 0.3, n - h * 0.5, px + lean, n - h); x.stroke();
    if (r() < 0.6) { x.fillStyle = r() < 0.8 ? '#6a8ad8' : '#9ab0f0'; x.beginPath(); x.arc(px + lean, n - h, 3, 0, TAU); x.fill(); }
  }
};
BUILD.linarium = (g) => {
  cropRows(g, -5.4, 2.2, -4.6, 4.6, 0.62, 0.75, 0xe8f0d8, 'flax');
  // мочило (пруд для вымачивания льна)
  const pd = grp(g, 4.4, 0, -1.6);
  basin(pd, 0, 0, 0, 2.4, 0.35, 4.0, 0.15, M(0x8a8070), M(0x4a7a6a, { roughness: 0.2 }));
  for (let i = 0; i < 4; i++) P(pd, cyl(0.07, 0.07, 1.6, 6), M(0x8a9a5a), -0.4 + i * 0.26, 0.33, 0, HPI, 0, 0.2);
  colB(g, 4.4, -1.6, 2.4, 4.0);
  // снопы льна
  for (let i = 0; i < 5; i++) { const s = grp(g, -4.6 + i * 1.6, 0, 5.6); P(s, cone(0.3, 1.1, 7), M(0xc8b070), 0, 0.55, 0); P(s, tor(0.12, 0.03, 4, 8), M(0x8a6a3a), 0, 0.7, 0, HPI); }
  // навес с вертикальным ткацким станком (с грузилами)
  for (const [x, z] of [[3.0, 2.0], [5.8, 2.0], [3.0, 4.6], [5.8, 4.6]]) post(g, x, 0, z, 2.4, 0.08);
  shed(g, 4.4, 2.65, 3.3, 3.2, 2.9, 0.3, 0, THATCH());
  const lm = grp(g, 4.4, 0, 3.6, -0.15, 0, 0);
  for (const s of [-1, 1]) P(lm, box(0.08, 2.0, 0.08), M(C.wood), s * 0.8, 1.0, 0);
  P(lm, cyl(0.04, 0.04, 1.8, 6), M(C.woodD), 0, 1.95, 0, 0, 0, HPI);
  P(lm, box(1.4, 1.3, 0.01), M(0xe8e0c8, { side: THREE.DoubleSide }), 0, 1.25, 0.02);
  for (let i = 0; i < 9; i++) P(lm, sph(0.05, 5, 4), M(0x9a8a7a), -0.64 + i * 0.16, 0.5, 0.04);
  colB(g, 4.4, 3.3, 3.0, 2.8);
};
// ---------- Колония (аванпост) ----------
BUILD.colonia = (g) => {
  // частокол по кругу с воротами на +Z
  const R = 9.2, N = 44, gateHalf = 0.17;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, d = Math.abs(((a - HPI + PI) % TAU) - PI);
    if (d < gateHalf) continue;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    for (let k = 0; k < 3; k++) { const aa = a + (k - 1) * (TAU / N / 3); P(g, cyl(0.12, 0.14, 3.6 + (k % 2) * 0.3, 6), M(0x7a5a3a), Math.cos(aa) * R, 1.3, Math.sin(aa) * R); P(g, cone(0.12, 0.3, 6), M(0x6a4a2a), Math.cos(aa) * R, 3.25 + (k % 2) * 0.15, Math.sin(aa) * R); }
    colB(g, x, z, 0.5, (TAU * R) / N + 0.1, -a);
  }
  for (const s of [-1, 1]) { const a = HPI + s * gateHalf * 1.2; post(g, Math.cos(a) * R, -0.5, Math.sin(a) * R, 4.6, 0.18, M(0x5a3a22)); }
  P(g, box(3.6, 0.3, 0.3), M(0x5a3a22), 0, 3.9, R);
  // дом начальника, склад, вышка
  plinth(g, -3.4, -3.6, 4.4, 3.4, 0.3);
  wall(g, -3.4, 0.3, -3.6, 4.0, 2.8, 3.0);
  gable(g, -3.4, 3.1, -3.6, 4.0, 3.0, 0.42, 0.3, 'x');
  door(g, -3.4, 0.3, -2.08, 0, 1.0, 2.0);
  colB(g, -3.4, -3.6, 4.4, 3.4);
  plinth(g, 3.2, -4.4, 3.4, 2.6, 0.15, M(0x8a7a5a));
  P(g, tbox(3.0, 2.2, 2.2), PLANK(), 3.2, 1.25, -4.4);
  gable(g, 3.2, 2.35, -4.4, 3.0, 2.2, 0.5, 0.3, 'x', { mat: THATCH(), antefix: false, gableCol: 0x8a6a44 });
  colB(g, 3.2, -4.4, 3.2, 2.4);
  const tw = grp(g, 5.6, 0, 1.2);
  for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { post(tw, x, -0.5, z, 6.6, 0.1, M(0x6a4a2a)); colC(g, 5.6 + x, 1.2 + z, 0.15); }
  P(tw, tbox(2.2, 0.15, 2.2), PLANK(), 0, 4.5, 0);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; P(tw, box(2.2, 0.9, 0.06), PLANK(), Math.sin(a) * 1.1, 5.0, Math.cos(a) * 1.1, 0, a, 0); }
  P(tw, cone(1.8, 1.0, 4), THATCH(), 0, 6.6, 0, 0, PI / 4, 0);
  for (let i = 0; i < 4; i++) for (const yy of [1.2, 3.0]) P(tw, box(0.05, 0.05, 2.3), M(0x6a4a2a), (i < 2 ? -0.8 : 0.8), yy, 0, (i % 2 ? 0.7 : -0.7), 0, 0);
  // флаг, костёр, припасы, палатка
  banner(g, 0, 0, -0.5, 4.2);
  const fp = grp(g, 1.4, 0, 2.4);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; P(fp, ico(0.16, 0), M(0x8a8478), Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55); }
  for (let i = 0; i < 4; i++) P(fp, cyl(0.05, 0.05, 0.8, 5), M(0x3a2a1a), 0, 0.15, 0, HPI, (i * PI) / 4, 0.3);
  P(fp, cone(0.3, 0.8, 7), FLAME(), 0, 0.45, 0).castShadow = false; P(fp, cone(0.16, 0.5, 6), FLAME2(), 0, 0.35, 0).castShadow = false;
  const fl = new VLight(0xff9a40, 8, 14, 1.6); fl.position.set(0, 1.0, 0); fp.add(fl);
  for (let i = 0; i < 4; i++) sack(g, 2.2 + (i % 2) * 0.5, 0, -1.6 + Math.floor(i / 2) * 0.5, 0.9, 0xd2be92, i);
  crate(g, -0.6, 0, -6.6, 1); crate(g, 0.4, 0, -6.6, 0.9, 0.3); amphora(g, -1.4, 0, -6.4); amphora(g, -1.8, 0, -6.2);
  const tn = grp(g, -4.8, 0, 3.0, 0, 0.4, 0);
  for (const s of [-1, 1]) P(tn, box(0.06, 2.2, 3.0), M(0xc8b090, { side: THREE.DoubleSide }), s * 0.75, 0.9, 0, 0, 0, s * 0.6);
  P(tn, cyl(0.03, 0.03, 3.1, 5), M(C.woodD), 0, 1.8, 0, HPI);
  colB(g, -4.8, 3.0, 2.2, 3.1, 0.4);
};

// ---------- Торговая гильдия (collegium mercatorum) ----------
// торговый ящик сорта grade, поставленный в группу (масштаб s, s=1 → 0.8×0.6×0.6 м)
function tcrate(par, grade, x, y, z, s = 1, ry = 0) { const c = makeTradeCrate(grade); c.position.set(x, y, z); c.rotation.y = ry; c.scale.setScalar(s); par.add(c); return c; }
// безмен (statera) на П-образной раме: короткое плечо с чашей, длинное — с гирей
function statera(par, x, y, z, ry = 0) {
  const g = grp(par, x, y, z, 0, ry, 0);
  const wd = M(C.woodD), br = bronzeM();
  for (const sx of [-1, 1]) { P(g, box(0.16, 2.7, 0.16), wd, sx * 0.95, 1.35, 0); P(g, box(0.16, 0.12, 0.9), wd, sx * 0.95, 0.06, 0); P(g, box(0.08, 0.7, 0.08), wd, sx * 0.72, 2.4, 0, 0, 0, sx * 0.8); }
  P(g, box(2.2, 0.18, 0.2), wd, 0, 2.72, 0);
  rope(g, [0, 2.63, 0], [0, 2.25, 0], 0.012, br);
  const bm = grp(g, 0, 2.22, 0, 0, 0, -0.05);
  P(bm, cyl(0.028, 0.02, 1.75, 6), br, 0.42, 0, 0, 0, 0, HPI);
  for (let i = 0; i < 8; i++) P(bm, box(0.008, 0.06, 0.06), br, 0.1 + i * 0.13, 0, 0);
  for (const a of [0, 2.1, 4.2]) rope(bm, [-0.38, 0, 0], [-0.38 + Math.cos(a) * 0.3, -1.12, Math.sin(a) * 0.3], 0.008, br);
  P(bm, cyl(0.36, 0.3, 0.06, 12), br, -0.38, -1.15, 0);
  sack(bm, -0.38, -1.12, 0, 0.75, 0xc8b48a);
  rope(bm, [1.05, 0, 0], [1.05, -0.4, 0], 0.008, br);
  P(bm, sph(0.1, 8, 6), br, 1.05, -0.48, 0);
  P(bm, cone(0.06, 0.12, 6), br, 1.05, -0.36, 0);
  return g;
}
BUILD.collegium = (g) => {
  const y = 0.5;
  // фундамент зала и погрузочный двор
  plinth(g, 0, -3.1, 17, 10.2, y);
  plinth(g, 0, 5.5, 17, 7.0, 0.2, TM('ashlar', 0xd2c6aa));
  stairs(g, 0, 0.35, 2.0, 10, 1, 0.15, 0.5);
  // контора (табуларий) у задней стены
  wall(g, 0, y, -6.3, 15, 5.0, 3.6, 0, { dadoCol: 0x2a4a6a });
  door(g, 0, y, -4.48, 0, 1.8, 3.0, true);
  door(g, 5.0, y, -4.48, 0, 1.1, 2.3);
  door(g, -5.0, y, -4.48, 0, 1.1, 2.3);
  for (const x of [-3, 3]) win(g, x, y + 3.6, -4.48);
  P(g, box(3.4, 0.6, 0.08), M(C.marble), 0, y + 4.2, -4.46);                // доска с надписью
  for (const yy of [0.12, -0.1]) P(g, box(2.8, 0.07, 0.02), goldM(), 0, y + 4.2 + yy, -4.41);
  colB(g, 0, -6.3, 15.2, 3.8);
  // колоннада и крыша с фронтоном к фасаду
  colRow(g, -7.2, 1.3, 7.2, 1.3, 7, y, 5.0, 0.28, 'tuscan', M(C.stone));
  colRow(g, -7.2, -1.6, -7.2, -1.6, 1, y, 5.0, 0.28, 'tuscan', M(C.stone));
  colRow(g, 7.2, -1.6, 7.2, -1.6, 1, y, 5.0, 0.28, 'tuscan', M(C.stone));
  P(g, box(15.2, 0.5, 0.6), M(C.stone), 0, y + 5.25, 1.3);
  for (const s of [-1, 1]) P(g, box(0.6, 0.5, 5.8), M(C.stone), s * 7.2, y + 5.25, -1.6);
  P(g, box(15.0, 0.12, 0.62), M(0x2a4a6a), 0, y + 5.1, 1.3);
  gable(g, 0, y + 5.5, -3.4, 15.6, 10.0, 0.3, 0.4, 'z', { gableCol: C.stone });
  P(g, box(3.2, 0.5, 0.06), M(0x2a4a6a), 0, y + 5.25, 1.62);                   // титул над входом
  P(g, box(2.7, 0.08, 0.02), goldM(), 0, y + 5.25, 1.66);
  // под портиком: прилавки, весы, мерный стол, ларь
  table(g, -4.6, y, -2.2, 2.2, 0.8);
  table(g, 4.6, y, -2.2, 2.2, 0.8);
  colB(g, -4.6, -2.2, 2.3, 0.9); colB(g, 4.6, -2.2, 2.3, 0.9);
  {
    const lb = grp(g, -4.2, y + 0.79, -2.2), br = bronzeM();             // ручные весы (libra)
    P(lb, cyl(0.02, 0.025, 0.5, 6), br, 0, 0.25, 0);
    P(lb, box(0.7, 0.025, 0.025), br, 0, 0.5, 0);
    for (const s of [-1, 1]) { rope(lb, [s * 0.34, 0.5, 0], [s * 0.34, 0.2, 0], 0.005, br); P(lb, cyl(0.1, 0.08, 0.02, 10), br, s * 0.34, 0.19, 0); }
    for (let i = 0; i < 5; i++) P(g, cyl(0.04, 0.04, 0.012 + i * 0.008, 8), goldM(), -5.2 + i * 0.07, y + 0.8, -2.0);
    P(g, cyl(0.04, 0.04, 0.55, 8), M(0xe8dcc0), -5.3, y + 0.83, -2.4, 0, 0, HPI);   // свиток
    amphora(g, 4.0, y + 0.79, -2.2, 0.6); amphora(g, 4.5, y + 0.79, -2.3, 0.6, 0x9a5a34);
    tcrate(g, 3, 5.2, y + 0.79, -2.2, 0.7, 0.2);
  }
  const mp = grp(g, 0, y, -2.0);                                              // mensa ponderaria
  P(mp, box(2.0, 0.9, 0.8), M(C.marble), 0, 0.45, 0);
  for (let i = 0; i < 4; i++) P(mp, cyl(0.12 + i * 0.03, 0.1, 0.02, 10), M(0x3a3226), -0.7 + i * 0.45, 0.905, 0);
  colB(g, 0, -2.0, 2.0, 0.8);
  for (let i = 0; i < 4; i++) amphora(g, -6.8 + i * 0.5, y, -3.9);
  for (let i = 0; i < 3; i++) amphora(g, 5.9 + i * 0.5, y, -3.9, 1, 0x9a5a34);
  const ch = makeChest('chest'); ch.position.set(2.2, y, -3.9); g.add(ch);
  bench(g, -2.4, y, 0.6, 1.8); bench(g, 2.4, y, 0.6, 1.8);
  // погрузочный двор: ограда, ворота, штабели ящиков, безмен, амфоры
  const yd = 0.2;
  for (const s of [-1, 1]) {
    wall(g, s * 8.25, yd, 5.5, 0.5, 1.3, 7.0, 0, { mat: ASH(), dado: false });
    colB(g, s * 8.25, 5.5, 0.6, 7.0);
    wall(g, s * 5.4, yd, 8.75, 5.2, 1.3, 0.5, 0, { mat: ASH(), dado: false });
    colB(g, s * 5.4, 8.75, 5.2, 0.6);
    P(g, rbox(0.7, 2.6, 0.7, 0.04), M(C.stone), s * 2.6, yd + 1.3, 8.75);
    P(g, sph(0.22, 8, 6), M(C.stone), s * 2.6, yd + 2.75, 8.75);
    colB(g, s * 2.6, 8.75, 0.8, 0.8);
  }
  // левый штабель: большие ящики снизу, меньше — сверху
  tcrate(g, 2, -7.05, yd, 3.6, 1.5); tcrate(g, 1, -5.8, yd, 3.6, 1.5, 0.03);
  tcrate(g, 2, -6.4, yd + 0.9, 3.6, 1.25, -0.06); tcrate(g, 3, -6.5, yd + 1.65, 3.6, 0.95, 0.1);
  colB(g, -6.4, 3.6, 2.6, 1.0);
  crate(g, -7.0, yd, 5.6, 1.3); crate(g, -5.9, yd, 5.6, 1.3, 0.05); crate(g, -6.5, yd + 0.78, 5.6, 1.1, -0.2);
  tcrate(g, 1, -7.1, yd, 7.2, 1.0, 0.3); tcrate(g, 1, -6.0, yd, 7.4, 0.8, -0.2); tcrate(g, 4, -7.1, yd + 0.6, 7.2, 0.85, 0.35);
  colB(g, -6.4, 5.6, 2.4, 1.0); colB(g, -6.6, 7.3, 2.0, 1.0);
  statera(g, -3.0, yd, 4.6);
  colB(g, -3.0, 4.6, 2.3, 1.0);
  tcrate(g, 2, -2.6, yd, 6.0, 1.1, 0.4);
  // правый край: стойка с амфорами, ящики, мешки
  const rk = grp(g, 4.4, yd, 3.4);
  for (const s of [-1, 1]) { P(rk, box(0.1, 1.2, 0.1), M(C.woodD), s * 1.35, 0.6, -0.35); P(rk, box(0.1, 1.2, 0.1), M(C.woodD), s * 1.35, 0.6, 0.35); }
  P(rk, box(2.8, 0.08, 0.1), M(C.wood), 0, 1.0, -0.35); P(rk, box(2.8, 0.08, 0.1), M(C.wood), 0, 1.0, 0.35);
  for (let i = 0; i < 5; i++) for (const zz of [-0.18, 0.18]) amphora(rk, -1.0 + i * 0.5, 0, zz, 0.95, i % 2 ? 0x9a5a34 : C.terracotta);
  colB(g, 4.4, 3.4, 2.9, 0.9);
  tcrate(g, 1, 6.9, yd, 3.4, 1.4, HPI); tcrate(g, 2, 6.9, yd, 4.6, 1.4, HPI + 0.04); tcrate(g, 3, 6.9, yd + 0.84, 4.0, 1.1, HPI - 0.1);
  colB(g, 6.9, 4.0, 1.0, 2.4);
  tcrate(g, 4, 6.9, yd, 6.3, 0.9, -1.4); tcrate(g, 1, 5.7, yd, 6.6, 1.2, 0.15); tcrate(g, 1, 5.75, yd + 0.72, 6.55, 0.9, -0.2);
  colB(g, 6.3, 6.4, 2.2, 1.2);
  for (let i = 0; i < 4; i++) sack(g, 3.4 + (i % 2) * 0.55, yd, 6.6 + Math.floor(i / 2) * 0.5, 1, 0xd2be92, i);
  barrel(g, 7.3, yd, 7.8); barrel(g, 6.6, yd, 7.9, 0.9);
  for (const s of [-1, 1]) banner(g, s * 3.2, 0.35, 2.3, 3.6);
};

// ---------- Школа гладиаторов (ludus) ----------
// чучело для отработки ударов: столб, перекладина-руки, соломенное туловище в мешковине, голова-мешок
function dummy(par, x, y, z, ry = 0, shield = true) {
  const g = grp(par, x, y, z, 0, ry, 0), wd = M(C.woodD), sk = M(0xc2ab7c), rp = M(C.rope);
  P(g, box(0.5, 0.12, 0.5), M(C.stoneD), 0, 0.06, 0);
  P(g, cyl(0.07, 0.08, 1.75, 8), wd, 0, 0.875, 0);
  P(g, box(1.0, 0.08, 0.08), wd, 0, 1.33, 0);
  P(g, G('dumBody', () => lumpy(new THREE.CylinderGeometry(0.2, 0.18, 0.62, 10, 3), 0.05, 5)), sk, 0, 1.05, 0);
  for (const yy of [0.82, 1.05, 1.28]) P(g, tor(0.2, 0.014, 4, 14), rp, 0, yy, 0, HPI);
  P(g, G('dumHead', () => lumpy(new THREE.SphereGeometry(0.14, 10, 8), 0.06, 9)), sk, 0, 1.6, 0, 0, 0, 0, 1, 1.12, 1);
  P(g, tor(0.07, 0.014, 4, 10), rp, 0, 1.47, 0, HPI);
  for (const s of [-1, 1]) P(g, G('dumArm', () => lumpy(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 8, 2), 0.04, 4)), sk, s * 0.36, 1.33, 0, 0, 0, HPI);
  // зарубки от мечей на туловище
  for (let i = 0; i < 4; i++) P(g, box(0.1, 0.012, 0.02), M(0x7a6440), -0.06 + (i % 2) * 0.1, 0.9 + i * 0.1, 0.19, 0, 0, (i % 2 ? 0.5 : -0.4));
  if (shield) { const s = buildShield('parma', 0); s.position.set(0.5, 1.2, 0.08); s.rotation.set(0, 0.25, 0.1); s.scale.setScalar(0.85); g.add(s); }
  return g;
}
// палус — вкопанный столб с зарубками
function palus(par, x, y, z, h = 1.85, seed = 1) {
  const g = grp(par, x, y, z, 0, seed, 0), r = rng(seed * 7 + 3);
  P(g, G('palusG', () => lumpy(new THREE.CylinderGeometry(0.15, 0.18, 1, 10, 4), 0.025, 2)), M(0x6e4a2a), 0, h / 2, 0, 0, 0, 0, 1, h, 1);
  P(g, cyl(0.155, 0.155, 0.04, 10), M(0x4a3020), 0, h + 0.005, 0);
  P(g, G('palusMound', () => lumpy(new THREE.CylinderGeometry(0.22, 0.38, 0.12, 10, 1), 0.04, 6)), M(0xc4a46c), 0, 0.04, 0);
  for (let i = 0; i < 6; i++) { const a = r() * TAU, yy = 0.8 + r() * 0.8; P(g, box(0.12, 0.014, 0.03), M(0xb08a5a), Math.sin(a) * 0.155, yy, Math.cos(a) * 0.155, 0, a, (r() - 0.5) * 0.8); }
  return g;
}
// стойка с оружием у стены: деревянные мечи (rudes), трезубцы, копья
function weaponRack(par, x, y, z, ry = 0, w = 2.0, list = ['rudis', 'rudis', 'rudis', 'trident', 'rudis', 'trident']) {
  const g = grp(par, x, y, z, 0, ry, 0), wd = M(C.woodD), wl = M(C.wood);
  for (const s of [-1, 1]) P(g, box(0.09, 1.5, 0.09), wd, s * w / 2, 0.75, 0);
  P(g, box(w + 0.1, 0.08, 0.14), wl, 0, 0.12, 0.05);            // нижняя планка с гнёздами
  P(g, box(w + 0.1, 0.07, 0.07), wl, 0, 1.0, -0.06);            // верхний упор
  P(g, box(w + 0.1, 0.06, 0.06), wl, 0, 1.45, -0.06);
  list.forEach((k, i) => {
    const wp = buildWeapon(k, 0), xx = -w / 2 + 0.2 + (i * (w - 0.4)) / Math.max(1, list.length - 1);
    const long = k === 'trident' || k === 'hasta';
    wp.position.set(xx, long ? 0.62 : 0.16, long ? 0.02 : 0.06); wp.rotation.set(long ? -0.06 : -0.14, 0, 0);
    g.add(wp);
  });
  return g;
}
BUILD.ludus = (g) => {
  const y = 0.2, H = 2.8, T = 0.45, E = 8.2, wc = E - T / 2;
  plinth(g, 0, 0, 2 * E, 2 * E, y);
  // песок арены-двора
  P(g, box(2 * E - 2 * T, 0.04, 12.6), M(C.sand), 0, y + 0.02, 1.6);
  for (let i = 0; i < 9; i++) { const r = rng(i + 40); P(g, G('sandHeap', () => lumpy(new THREE.SphereGeometry(0.6, 8, 4, 0, TAU, 0, HPI), 0.15, 8)), M(0xd2b47c), (r() - 0.5) * 12, y + 0.01, -1.5 + r() * 8.5, 0, r() * 3, 0, 1 + r(), 0.06, 0.7 + r()); }
  // ограда: штукатурка с красным цоколем
  for (const s of [-1, 1]) {
    wall(g, s * (1.5 + (wc - 1.5) / 2 + T / 4), y, wc, wc - 1.5 + T / 2, H, T);   // фасад по обе стороны ворот
    colB(g, s * (1.5 + (wc - 1.5) / 2 + T / 4), wc, wc - 1.5 + T / 2, T + 0.1);
    wall(g, s * wc, y, 1.8, T, H, 12.8);                                           // боковые стены
    colB(g, s * wc, 1.8, T + 0.1, 12.8);
    // столбы ворот и распахнутые внутрь створки с железными полосами
    P(g, rbox(0.7, 3.3, 0.75, 0.04), ASH(), s * 1.55, y + 1.65, wc);
    P(g, box(0.8, 0.14, 0.85), M(C.stone), s * 1.55, y + 3.37, wc);
    colB(g, s * 1.55, wc, 0.8, 0.85);
    const lf = grp(g, s * 1.2, y, wc - 0.1, 0, s * -1.75, 0);
    P(lf, tbox(1.2, 2.6, 0.08), PLANK(), -s * 0.6, 1.32, 0);
    for (const yy of [0.35, 1.3, 2.25]) P(lf, box(1.18, 0.07, 0.1), ironM(), -s * 0.6, yy, 0);
    for (let i = 0; i < 4; i++) for (const yy of [0.35, 1.3, 2.25]) P(lf, sph(0.025, 5, 4), ironM(), -s * (0.15 + i * 0.3), yy, 0.055);
  }
  P(g, box(3.9, 0.45, 0.8), M(C.stone), 0, y + 3.0, wc);                           // перемычка ворот
  P(g, box(2.2, 0.36, 0.06), M(C.marble), 0, y + 3.0, wc + 0.42);                  // титул «LVDVS»
  for (const yy of [0.07, -0.07]) P(g, box(1.8, 0.05, 0.02), M(0x7a1e18), 0, y + 3.0 + yy, wc + 0.46);
  // корпус с кельями и колоннада
  const cz = -6.4, cd = 3.6, ch = 3.8;
  wall(g, 0, y, -E + T / 2, 2 * E, 4.75, T, 0, { dado: false, cornice: false });    // высокая задняя стена под односкатной крышей
  wall(g, 0, y, cz, 2 * E - 0.02, ch, cd, 0, { cornice: false });                   // массив келий
  colB(g, 0, cz, 2 * E, cd + 0.1);
  for (let i = 0; i < 6; i++) win(g, -6.25 + i * 2.5, y + 3.0, -E - 0.01, PI, 0.42, 0.34);   // окошки келий на задний фасад
  const fz = cz + cd / 2;
  for (let i = 0; i < 6; i++) {
    const x = -6.25 + i * 2.5;
    door(g, x, y, fz + 0.01, 0, 0.85, 2.0);
    win(g, x + 0.85, y + 2.75, fz + 0.03, 0, 0.36, 0.3);
    P(g, box(0.5, 0.18, 0.03), M(C.marble), x, y + 2.5, fz + 0.03);           // табличка с номером кельи
  }
  P(g, box(2 * E - 0.6, 0.06, 1.75), M(C.stone), 0, y + 0.03, fz + 0.87);        // мостовая портика
  colRow(g, -6.9, -3.25, 6.9, -3.25, 7, y, 3.75, 0.2, 'tuscan', M(C.stone));
  P(g, box(2 * E - 0.4, 0.4, 0.42), M(C.stone), 0, y + 3.95, -3.25);
  P(g, box(2 * E - 0.38, 0.1, 0.44), M(0x9a2c22), 0, y + 3.8, -3.25);
  // односкатная черепичная крыша: от задней стены (≈4.95) к архитраву (≈4.15)
  { const z0 = -E + 0.1, z1 = -2.9, y0 = y + 4.95, y1 = y + 4.15, a = Math.atan2(y0 - y1, z1 - z0);
    P(g, tbox(2 * E + 0.5, 0.12, Math.hypot(z1 - z0, y0 - y1) + 0.2), TILE(), 0, (y0 + y1) / 2 + 0.06, (z0 + z1) / 2, a);
    P(g, box(2 * E + 0.5, 0.16, 0.08), M(C.woodD), 0, y1 - 0.02, z1 + 0.08); }
  for (const s of [-1, 1]) P(g, extr('ludEnd', [[0, 0], [5.3, 0], [5.3, 1.15], [0, 0.35]], 0.3, 0), M(C.plaster), s * (E - 0.15), y + 3.8, -2.9, 0, HPI, 0);   // торцы под скатом
  // под портиком: скамьи, амфоры, жаровня
  bench(g, -4.9, y, -4.2, 1.6); bench(g, 4.9, y, -4.2, 1.6); colB(g, -4.9, -4.2, 1.6, 0.4); colB(g, 4.9, -4.2, 1.6, 0.4);
  for (let i = 0; i < 3; i++) amphora(g, 7.3, y, -4.3 + i * 0.42, 0.85, i % 2 ? 0x9a5a34 : C.terracotta);
  colB(g, 7.3, -3.9, 0.5, 1.3);
  // палусы и чучела
  for (const [x, z, s] of [[-5.0, 0.4, 1], [-5.2, 3.2, 2], [-2.9, 1.7, 3], [-3.1, 4.6, 4]]) { palus(g, x, y, z, 1.85, s); colC(g, x, z, 0.25); }
  dummy(g, 1.9, y, 0.6, -0.2); colC(g, 1.9, 0.6, 0.35);
  dummy(g, 3.4, y, 3.4, 0.4, false); colC(g, 3.4, 3.4, 0.35);
  // оружейные стойки у левой стены, щиты на стене
  weaponRack(g, -wc + 0.35, y, 5.3, HPI, 2.2); colB(g, -wc + 0.4, 5.3, 0.45, 2.3);
  weaponRack(g, -wc + 0.35, y, -1.4, HPI, 1.8, ['trident', 'rudis', 'rudis', 'hasta', 'rudis']); colB(g, -wc + 0.4, -1.4, 0.45, 1.9);
  for (const [k, z] of [['scutum', 1.0], ['parma', 2.2], ['scutum', 3.1]]) { const s = buildShield(k, 0); s.position.set(-wc + T / 2 + 0.06, y + 1.55, z); s.rotation.y = HPI; g.add(s); }
  // поилка у правой стены
  basin(g, wc - T / 2 - 0.4, y, 0.6, 0.7, 0.6, 2.2, 0.12); colB(g, wc - T / 2 - 0.4, 0.6, 0.75, 2.25);
  P(g, cyl(0.12, 0.1, 0.28, 10), M(0x8a6038), wc - T / 2 - 0.45, y + 0.14, 2.1);   // ведро
  // тенистое место ланисты: навес на столбах, скамья с подушкой, столик со свитком и шлемом
  { const lx = 5.5, lz = 5.6, sh = grp(g, lx, y, lz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(sh, sx * 1.2, 0, sz * 0.9, 2.4, 0.07, M(C.woodD));
    for (const sz of [-1, 1]) P(sh, box(2.55, 0.1, 0.1), M(C.woodD), 0, 2.42, sz * 0.9);
    const aw = P(sh, G('awnQ', () => { const q = new THREE.PlaneGeometry(2.7, 2.1, 6, 1); const p = q.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(Math.sin(p.getX(i) * 3.5)) * 0.06); q.computeVertexNormals(); return q; }), M(0xd8c8a2, { side: THREE.DoubleSide }), 0, 2.52, 0, -HPI + 0.08);
    aw.receiveShadow = true;
    for (const sx of [-1, 1]) P(sh, box(0.03, 0.22, 2.0), M(0x9a2c22), sx * 1.33, 2.4, 0);
    bench(sh, 0.3, 0, 0.55, 1.8); P(sh, rbox(0.7, 0.07, 0.34, 0.03), M(0x8a1e1a), 0.5, 0.52, 0.55);
    table(sh, 0.2, 0, -0.35, 1.0, 0.55);
    P(sh, cyl(0.035, 0.035, 0.45, 8), M(0xe8dcc0), 0.0, 0.81, -0.35, 0, 0.3, HPI);
    P(sh, lathe('cup', [[0, 0], [0.035, 0], [0.04, 0.06], [0.05, 0.1], [0, 0.1]], 10), bronzeM(), 0.45, 0.79, -0.25);
    const hm = buildHelmet('murmillo', 0); if (hm) { hm.position.set(-0.15, 0.93, -0.38); hm.rotation.y = 0.6; sh.add(hm); }
    amphora(sh, 0.95, 0, -0.65, 0.75);
    colB(g, lx + 0.25, lz + 0.1, 2.0, 1.6); }
  barrel(g, -6.9, y, -2.6); barrel(g, -6.3, y, -2.7, 0.85);
  colC(g, -6.6, -2.65, 0.5);
};
// ---------- Зверинец (vivarium) ----------
// лев, лежащий «сфинксом»: передние лапы вытянуты, задние подогнуты, лёгкий крен
function lyingLion(par, x, y, z, ry = 0) {
  const a = makeAnimal('lion'), u = a.userData;
  a.position.set(x, y, z); a.rotation.y = ry;
  u.body.position.y = 0.37; u.body.rotation.set(-0.02, 0, 0.1);
  const [fl, fr, bl, br] = u.legs;
  for (const lg of [fl, fr]) { lg.upper.rotation.set(-1.32, 0, 0); lg.lower.rotation.set(-0.18, 0, 0); }
  fl.upper.rotation.z = 0.06; fr.upper.rotation.z = -0.06;
  bl.upper.rotation.set(-1.25, 0, 0.55); bl.lower.rotation.set(2.75, 0, 0);
  br.upper.rotation.set(-1.25, 0, -0.35); br.lower.rotation.set(2.75, 0, 0);
  if (u.neck) u.neck.rotation.x -= 0.1;
  if (u.head) u.head.rotation.set(u.head.rotation.x + 0.15, 0.35, 0.04);
  if (u.tail) u.tail.rotation.set(0.8, 0, 0.55);   // хвост лежит на соломе сбоку
  par.add(a);
  return a;
}
// ряд железных прутьев с поперечными полосами и решётчатой дверцей с замком
function bars(g, x0, x1, z, y0, h, step = 0.16, doorX = null) {
  const im = ironM(), n = Math.round((x1 - x0) / step);
  for (let i = 0; i <= n; i++) P(g, cyl(0.022, 0.022, h, 6), im, lerp(x0, x1, i / n), y0 + h / 2, z);
  for (const yy of [0.12, h * 0.5, h - 0.12]) P(g, box(x1 - x0 + 0.1, 0.05, 0.05), im, (x0 + x1) / 2, y0 + yy, z);
  if (doorX != null) {
    const dw = 0.95, dh = 2.05;
    for (const s of [-1, 1]) P(g, box(0.06, dh, 0.07), im, doorX + s * dw / 2, y0 + dh / 2, z + 0.04);
    for (const yy of [0.06, dh * 0.55, dh]) P(g, box(dw + 0.06, 0.06, 0.07), im, doorX, y0 + yy, z + 0.04);
    P(g, rbox(0.12, 0.15, 0.06, 0.015), M(0x4a4440, { metalness: 0.7, roughness: 0.5 }), doorX + dw / 2 - 0.06, y0 + 1.05, z + 0.1);
    P(g, tor(0.04, 0.009, 4, 10, PI), im, doorX + dw / 2 - 0.06, y0 + 1.15, z + 0.1);
    for (const yy of [0.3, 1.8]) P(g, cyl(0.03, 0.03, 0.12, 6), im, doorX - dw / 2, y0 + yy, z + 0.04);
  }
}
BUILD.vivarium = (g) => {
  const y = 0.2, E = 7.6, T = 0.5, wc = E - T / 2;
  plinth(g, 0, 0, 2 * E, 2 * E, y);
  P(g, box(2 * E - 2 * T, 0.03, 9.2), M(0xb8a47c), 0, y + 0.015, 2.4);           // утоптанный двор
  const am = TM('ashlar', 0xd8ccb0);
  // корпус: задняя и боковые стены, простенки между клетками, перемычка над решётками
  const bz0 = -E, bz1 = -2.1, bd = bz1 - bz0, bh = 3.4;
  wall(g, 0, y, -E + T / 2, 2 * E, bh, T, 0, { mat: am, dado: false });
  colB(g, 0, -E + T / 2, 2 * E, T + 0.1);
  for (const s of [-1, 1]) { wall(g, s * wc, y, (bz0 + bz1) / 2, T, bh, bd, 0, { mat: am, dado: false }); colB(g, s * wc, (bz0 + bz1) / 2, T + 0.1, bd); }
  for (const x of [-2.5, 2.5]) { wall(g, x, y, (bz0 + bz1) / 2 + 0.1, 0.5, bh, bd - 0.2, 0, { mat: am, dado: false }); colB(g, x, (bz0 + bz1) / 2, 0.6, bd); }
  for (const x of [-2.5, 2.5, -wc, wc]) P(g, rbox(0.7, 2.8, 0.7, 0.03), M(C.stone), x, y + 1.4, bz1 - 0.1);
  P(g, box(2 * E, 0.62, 0.72), M(C.stone), 0, y + 3.1, bz1 - 0.1);
  P(g, box(2 * E + 0.05, 0.12, 0.76), M(C.stoneD), 0, y + 2.85, bz1 - 0.1);
  gable(g, 0, y + bh, (bz0 + bz1) / 2, 2 * E, bd + 0.2, 0.4, 0.35, 'x', { gableCol: 0xd8ccb0 });
  // полы клеток, солома, решётки
  const cages = [[-wc + T / 2, -2.75], [-2.25, 2.25], [2.75, wc - T / 2]];
  cages.forEach(([x0, x1], i) => {
    const cx = (x0 + x1) / 2;
    P(g, box(x1 - x0, 0.04, bd - T), M(0x8a7c62), cx, y + 0.02, (bz0 + T + bz1) / 2 - 0.15);
    const r = rng(i * 11 + 5);
    for (let k = 0; k < 5; k++) P(g, G('straw', () => lumpy(new THREE.SphereGeometry(0.6, 10, 5, 0, TAU, 0, HPI), 0.25, 21)), M(k % 2 ? 0xd6bc6a : 0xc4a456), cx + (r() - 0.5) * (x1 - x0 - 1.2), y + 0.02, -5.8 + r() * 2.6, 0, r() * 3, 0, 1.1 + r() * 0.6, 0.22 + r() * 0.12, 0.9 + r() * 0.5);
    bars(g, x0 + 0.05, x1 - 0.05, bz1 - 0.1, y, 2.8, 0.16, cx + (i === 1 ? 1.1 : 0));
    colB(g, cx, bz1 - 0.1, x1 - x0 + 0.2, 0.3);
    // кольцо с цепью на задней стене
    P(g, tor(0.07, 0.015, 4, 10), ironM(), cx + 0.8, y + 1.2, -E + T + 0.02);
    for (let k = 0; k < 5; k++) P(g, tor(0.035, 0.009, 4, 8), ironM(), cx + 0.8, y + 1.08 - k * 0.075, -E + T + 0.04, 0, k % 2 ? HPI : 0, 0);
  });
  // лев в средней клетке, кости в левой, корытце с водой у льва
  lyingLion(g, -0.2, y + 0.02, -4.4, 0.35);
  basin(g, 1.55, y, -6.5, 0.9, 0.3, 0.55, 0.06);
  for (const [x, z, a] of [[-5.2, -3.4, 0.5], [-4.4, -4.6, 2.0], [4.6, -3.2, 1.1]]) { const b = grp(g, x, y + 0.05, z, 0, a, 0); P(b, cyl(0.025, 0.025, 0.4, 6), M(0xe8e0cc), 0, 0, 0, 0, 0, HPI); for (const s of [-1, 1]) P(b, sph(0.04, 6, 4), M(0xe8e0cc), s * 0.2, 0, 0); }
  // низкая ограда двора с укреплёнными воротами
  const wh = 1.5;
  for (const s of [-1, 1]) {
    wall(g, s * wc, y, (bz1 + wc + T / 2) / 2, T, wh, wc + T / 2 - bz1, 0, { mat: am, dado: false });
    colB(g, s * wc, (bz1 + wc + T / 2) / 2, T + 0.1, wc + T / 2 - bz1);
    const fx = (1.85 + E) / 2;
    wall(g, s * fx, y, wc, E - 1.85, wh, T, 0, { mat: am, dado: false });
    colB(g, s * fx, wc, E - 1.85, T + 0.1);
    P(g, rbox(0.85, 2.7, 0.9, 0.04), am, s * 1.6, y + 1.35, wc);
    P(g, box(0.95, 0.14, 1.0), M(C.stoneD), s * 1.6, y + 2.77, wc);
    P(g, sph(0.24, 8, 6), M(C.stone), s * 1.6, y + 3.06, wc);
    colB(g, s * 1.6, wc, 0.95, 1.0);
  }
  // створки: дубовые доски, железные полосы и диагональ, заклёпки; левая приоткрыта внутрь
  for (const s of [-1, 1]) {
    const open = s < 0 ? -1.15 : 0;
    const lf = grp(g, s * 1.17, y + 0.04, wc - 0.05, 0, open * s, 0);
    P(lf, tbox(1.15, 2.35, 0.12), PLANK(), -s * 0.575, 1.18, 0);
    for (const yy of [0.25, 1.18, 2.1]) { P(lf, box(1.15, 0.09, 0.15), ironM(), -s * 0.575, yy, 0); for (let i = 0; i < 4; i++) P(lf, sph(0.028, 5, 4), ironM(), -s * (0.12 + i * 0.3), yy, 0.08); }
    P(lf, box(0.07, 1.95, 0.14), ironM(), -s * 0.575, 1.18, 0, 0, 0, s * 0.5);
    for (const yy of [0.4, 1.95]) P(lf, cyl(0.04, 0.04, 0.16, 6), ironM(), 0, yy, 0);
    if (s > 0) { P(lf, box(0.12, 0.12, 0.3), ironM(), -s * 1.0, 1.15, 0.12); colB(g, s * 0.58, wc - 0.05, 1.2, 0.2); }
  }
  // двор: колода для мяса с тесаком, корыто, сено, вёдра, вилы
  { const b = grp(g, 3.6, y, 1.6);
    P(b, G('chopBlock', () => lumpy(new THREE.CylinderGeometry(0.36, 0.4, 0.7, 12, 2), 0.03, 4)), M(0x7a5434), 0, 0.35, 0);
    P(b, cyl(0.34, 0.34, 0.02, 12), M(0xb08a5e), 0, 0.705, 0);
    P(b, G('meat', () => lumpy(new THREE.SphereGeometry(0.2, 10, 8), 0.2, 15)), M(0x9a2420, { roughness: 0.55 }), -0.05, 0.8, 0.02, 0, 0.3, 0, 1.2, 0.5, 0.85);
    P(b, G('meat2', () => lumpy(new THREE.SphereGeometry(0.12, 8, 6), 0.25, 17)), M(0xb83a30, { roughness: 0.5 }), 0.15, 0.77, -0.12, 0, 1, 0, 1, 0.55, 1);
    P(b, sph(0.1, 8, 6), M(0xe8d4b4), -0.2, 0.8, 0.0, 0, 0, 0, 0.5, 0.5, 1.1);
    P(b, cyl(0.025, 0.025, 0.42, 6), M(0xe8e0cc), 0.1, 0.78, 0.15, 0, 0.6, HPI);
    const cl = grp(b, 0.18, 0.72, 0.12, 0, -0.5, 0);
    P(cl, box(0.12, 0.2, 0.012), steelM(), 0, 0.08, 0, 0.0, 0, 0.0);
    P(cl, cyl(0.016, 0.016, 0.13, 6), M(C.woodD), 0, 0.24, 0);
    for (const s of [-1, 1]) P(b, sph(0.12, 6, 4), M(0x6a1a14), s * 0.3, 0.01, 0.35, 0, 0, 0, 1.2, 0.08, 0.9);   // пятна крови
    colC(g, 3.6, 1.6, 0.45); }
  basin(g, -5.6, y, 1.2, 0.8, 0.55, 2.4, 0.12); colB(g, -5.6, 1.2, 0.85, 2.45);
  for (const [x, z, a] of [[5.6, 4.6, 0.2], [5.9, 3.4, -0.1]]) { P(g, tbox(1.1, 0.5, 0.55), THATCH(), x, y + 0.25, z, 0, a, 0); for (const s of [-1, 1]) P(g, box(0.02, 0.51, 0.57), M(C.rope), x + s * 0.3, y + 0.25, z, 0, a, 0); }
  P(g, tbox(1.1, 0.5, 0.55), THATCH(), 5.75, y + 0.75, 4.0, 0, 0.05, 0); colB(g, 5.75, 4.0, 1.4, 1.9);
  for (const [x, z] of [[-4.6, 2.8], [-4.2, 3.2]]) { P(g, cyl(0.15, 0.12, 0.32, 10), M(0x8a6038), x, y + 0.16, z); P(g, tor(0.14, 0.01, 4, 12), ironM(), x, y + 0.26, z, HPI); }
  { const pf = grp(g, 6.78, y, -0.6, 0, 0, -0.18); P(pf, cyl(0.022, 0.025, 1.7, 6), M(C.woodL), 0, 0.85, 0); for (const s of [-1, 0, 1]) P(pf, cyl(0.008, 0.012, 0.3, 4), ironM(), s * 0.06, 1.8, 0); P(pf, box(0.16, 0.03, 0.03), ironM(), 0, 1.66, 0); }
  P(g, box(0.9, 0.5, 0.06), M(C.marble), 0, y + 3.1, bz1 + 0.27);                      // табличка «VIVARIVM»
  for (const yy of [0.08, -0.08]) P(g, box(0.7, 0.05, 0.02), M(0x7a1e18), 0, y + 3.1 + yy, bz1 + 0.31);
};

export function makeBuilding(type, opts = {}) {
  const g = B(type);
  const fn = BUILD[type];
  if (fn) fn(g, opts);
  else { plinth(g, 0, 0, 4, 4, 0.3); wall(g, 0, 0.3, 0, 3.6, 3, 3.6); gable(g, 0, 3.3, 0, 3.6, 3.6); colB(g, 0, 0, 4, 4); }
  return g;
}

// ---------- Стройплощадка ----------
export function makeScaffold(type, r = 8, progress = 0) {
  const g = new THREE.Group(); g.name = 'scaffold_' + type;
  g.userData = { colliders: [], type, progress };
  const p = clamp(progress, 0, 1);
  const half = Math.max(1.6, r * 0.68), w = half * 2;
  const rnd = rng(type);
  // разметка: колья и верёвка
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) P(g, cyl(0.04, 0.05, 1.2, 5), M(C.woodL), sx * (half + 0.3), 0.3, sz * (half + 0.3));
  for (let i = 0; i < 4; i++) { const a = (i * PI) / 2; rope(g, [Math.cos(a) * (half + 0.3) - Math.sin(a) * (half + 0.3), 0.7, Math.sin(a) * (half + 0.3) + Math.cos(a) * (half + 0.3)], [Math.cos(a) * (half + 0.3) + Math.sin(a) * (half + 0.3), 0.7, Math.sin(a) * (half + 0.3) - Math.cos(a) * (half + 0.3)], 0.01, M(0xe0d0a0)); }
  // траншея / фундамент растёт по высоте
  const fh = 0.2 + 0.5 * seg(p, 0, 0.3);
  P(g, tbox(w, 1.5 + fh, w), ASH(), 0, (fh - 1.5) / 2, 0).scale.set(1, 1, 1);
  if (p < 0.15) P(g, box(w - 1.0, 0.05, w - 1.0), M(0x7a5a3a), 0, fh + 0.01, 0);
  // стены поднимаются
  const wh = 4.5 * seg(p, 0.2, 0.9) * Math.min(1, r / 6 + 0.3);
  if (wh > 0.05) for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2, cx = Math.sin(a) * (half - 0.4), cz = Math.cos(a) * (half - 0.4);
    const len = i === 0 ? w * 0.38 : w - 0.8;
    P(g, tbox(len, wh, 0.6), i % 2 ? BRICK() : ASH(), i === 0 ? cx - w * 0.25 : cx, fh + wh / 2, cz, 0, a, 0);
    if (i === 0) P(g, tbox(len, wh, 0.6), ASH(), cx + w * 0.25, fh + wh / 2, cz, 0, a, 0);
  }
  // леса: стойки, ригели, настилы, лестницы — по мере роста стен
  const sh = Math.max(1.8, wh + 1.2);
  const step = 1.8, n = Math.max(2, Math.round(w / step));
  const wood = M(0x9a7a50), dark = M(0x6a4a2a);
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2, ox = Math.sin(a) * (half + 0.6), oz = Math.cos(a) * (half + 0.6), tx = Math.cos(a), tz = -Math.sin(a);
    for (let k = 0; k <= n; k++) {
      const s = -half + (k / n) * w;
      P(g, cyl(0.05, 0.06, sh, 5), wood, ox + tx * s, fh + sh / 2 - 0.2, oz + tz * s);
    }
    for (let lv = 1.6; lv < sh; lv += 1.8) {
      P(g, box(w + 0.2, 0.08, 0.08), dark, ox, fh + lv, oz, 0, a, 0);
      P(g, box(w, 0.05, 0.5), PLANK(), ox - Math.sin(a) * 0.3, fh + lv + 0.06, oz - Math.cos(a) * 0.3, 0, a, 0);
    }
    for (let k = 0; k < n; k += 2) { const s0 = -half + (k / n) * w; const d = P(g, box(0.05, Math.hypot(step, Math.min(sh, 1.8)), 0.05), dark, ox + tx * (s0 + step / 2), fh + 0.9, oz + tz * (s0 + step / 2), 0, a, Math.atan2(step, 1.8)); d.castShadow = false; }
  }
  const ld = grp(g, half + 1.1, fh, half * 0.4, -0.25, 0, 0);
  for (const s of [-1, 1]) P(ld, box(0.06, sh, 0.06), wood, 0, sh / 2, s * 0.22);
  for (let y = 0.3; y < sh; y += 0.35) P(ld, box(0.04, 0.04, 0.44), wood, 0, y, 0);
  // материалы: убывают с прогрессом
  const left = 1 - p * 0.8;
  stoneBlocks(g, -half - 2.0, 0, -half * 0.5, Math.max(1, Math.round(6 * left)), 0.2);
  logPile(g, -half - 1.8, 0, half * 0.6, Math.max(1, Math.round(6 * left)), 2.4, 0.1);
  plankStack(g, half * 0.5, 0, -half - 1.8, Math.max(1, Math.round(9 * left)), HPI);
  brickStack(g, -half * 0.4, 0, -half - 1.7, 0.1);
  sack(g, half + 1.6, 0, -half * 0.5, 1, 0xd8d0c0); sack(g, half + 1.9, 0, -half * 0.5 + 0.5, 0.9, 0xd8d0c0);
  // треножный кран для больших построек
  if (r >= 10) {
    const cr = grp(g, -half * 0.3, fh, half * 0.2);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; const l = P(cr, cyl(0.08, 0.1, 7, 6), wood, Math.cos(a) * 1.2, 3.3, Math.sin(a) * 1.2); l.rotation.set(Math.sin(a) * 0.33, 0, -Math.cos(a) * 0.33); }
    rope(cr, [0, 6.5, 0], [0, 2.0 + p * 2, 0], 0.02);
    P(cr, rbox(0.8, 0.5, 0.6, 0.03), M(C.stone), 0, 1.7 + p * 2, 0);
  }
  P(g, box(0.06, 0.6, 0.9), M(0xe8dcc0), half + 2.2, 1.1, half + 0.6, 0, -0.4, 0);
  post(g, half + 2.2, 0, half + 0.6, 0.85, 0.04);
  g.userData.colliders.push({ x: 0, z: 0, w: w + 1.4, d: w + 1.4, ry: 0 });
  return g;
}

// ======================================================================
// Корабли
// ======================================================================
// Корпус по шпангоутам: ватерлиния на y = 0, киль ниже на D, борт — по линии седловатости
function hullFns(c) {
  const { L, Bm, D, deckY, bul, riseB, riseS, pb = 2.2, ps = 2.6 } = c;
  const hw = (z) => { const zn = (2 * z) / L; return Math.max(0.02, (Bm / 2) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(zn), zn > 0 ? pb : ps)), 0.55)); };
  const sheer = (z) => { const zn = (2 * z) / L; return deckY + bul + riseB * Math.pow(Math.max(0, zn), 3) + riseS * Math.pow(Math.max(0, -zn), 3); };
  const dep = (z) => { const zn = (2 * z) / L; return D * (1 - 0.6 * Math.pow(Math.abs(zn), 4)); };
  // точка сечения: phi 0 — киль, PI/2 — верх борта
  const pt = (z, phi, s) => [s * hw(z) * Math.pow(Math.sin(phi), 0.85), -dep(z) + (sheer(z) + dep(z)) * (1 - Math.cos(phi)), z];
  const halfAt = (z, y) => { const c1 = clamp((y + dep(z)) / (sheer(z) + dep(z)), 0, 1); const phi = Math.acos(1 - c1); return hw(z) * Math.pow(Math.sin(phi), 0.85); };
  return { hw, sheer, dep, pt, halfAt };
}
function hullGeo(key, c, N = 26, K = 9) {
  return G('hull' + key, () => {
    const f = hullFns(c), pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const z = -c.L / 2 + (i / N) * c.L;
      for (let j = 0; j <= 2 * K; j++) {
        const s = j < K ? -1 : 1, phi = (Math.abs(j - K) / K) * HPI;
        const p = f.pt(z, phi, j === K ? 0 : s);
        pos.push(...p); uv.push(z, p[1] + (j < K ? 0 : 0.001));
      }
    }
    const W = 2 * K + 1;
    for (let i = 0; i < N; i++) for (let j = 0; j < 2 * K; j++) { const a = i * W + j, b = a + W; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  });
}
function deckGeo(key, c, z0, z1, N = 18) {
  return G('deck' + key, () => {
    const f = hullFns(c), pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) { const z = lerp(z0, z1, i / N), w = f.halfAt(z, c.deckY) * 0.98; pos.push(-w, c.deckY, z, w, c.deckY, z); uv.push(z, -w, z, w); }
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  });
}
function sailGeo(w, h, bulge) {
  return G(`sail${w},${h},${bulge}`, () => {
    const q = new THREE.PlaneGeometry(w, h, 8, 6); q.translate(0, -h / 2, 0);
    const p = q.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), y = -p.getY(i) / h; p.setZ(i, bulge * (1 - x * x) * Math.sin(Math.PI * Math.min(1, y * 0.9 + 0.1))); }
    q.computeVertexNormals(); return q;
  });
}
const SHIPDEF = {
  scapha: { L: 5, Bm: 1.6, D: 0.45, deckY: 0.15, bul: 0.4, riseB: 0.25, riseS: 0.3, pb: 1.8, ps: 1.8, hull: 0x8a5a34, open: true, banks: [[1, 0]], seats: 2 },
  corbita: { L: 14, Bm: 4.6, D: 1.2, deckY: 0.9, bul: 0.7, riseB: 0.6, riseS: 1.6, pb: 1.5, ps: 1.7, hull: 0x7a4a2a, banks: [], mast: 0.0, mastH: 10, sail: [7.5, 6.0], sailCol: 0xe8dcc0, seats: 6 },
  liburna: { L: 18, Bm: 3.2, D: 0.9, deckY: 0.75, bul: 0.55, riseB: 0.5, riseS: 1.4, pb: 2.6, ps: 2.8, hull: 0x5a3a22, banks: [[12, 0]], mast: 1.0, mastH: 9, sail: [7, 5], sailCol: 0xd8ccb0, ram: 1, seats: 8, shields: 0x9a2a22 },
  trireme: { L: 26, Bm: 4.2, D: 1.1, deckY: 1.25, bul: 0.6, riseB: 0.7, riseS: 2.0, pb: 2.8, ps: 3.0, hull: 0x4e3420, banks: [[14, 0], [14, 1], [14, 2]], mast: 1.5, mastH: 12, sail: [10, 7], sailCol: 0xece2c8, ram: 1, eye: 1, aplustre: 1, seats: 12, shields: 0x9a2a22 },
  pirate_ship: { L: 15, Bm: 3.2, D: 0.85, deckY: 0.7, bul: 0.5, riseB: 0.5, riseS: 1.2, pb: 2.4, ps: 2.6, hull: 0x2e241c, banks: [[10, 0]], mast: 0.5, mastH: 8, sail: [6.5, 4.6], sailCol: 0x3a1a18, ram: 1, seats: 6, patched: 1 },
  quadrireme: { L: 30, Bm: 5.0, D: 1.3, deckY: 1.4, bul: 0.65, riseB: 0.8, riseS: 2.2, pb: 2.8, ps: 3.0, hull: 0x463020, banks: [[15, 0], [15, 1], [15, 2], [15, 3]], oarY0: 0.55, bankDY: 0.33, mast: 2.0, mastH: 13, sail: [11, 7.5], sailCol: 0xe8dcc0, stripe: 0x2a3a6a, ram: 1, eye: 1, aplustre: 1, seats: 14, shields: 0x2a4a8a, catapult: 1 },
  punic_ship: { L: 26, Bm: 4.6, D: 1.2, deckY: 1.3, bul: 0.7, riseB: 0.8, riseS: 2.1, pb: 2.6, ps: 3.0, hull: 0x33384a, banks: [[13, 0], [13, 1], [13, 2]], mast: 1.0, mastH: 12, sail: [10, 7], sailCol: 0x4a2a7a, ram: 1, eye: 1, aplustre: 1, seats: 10, shields: 0xb8904a, tanit: 1, band: 0xb8904a },
};
export function makeShip(type) {
  const c = SHIPDEF[type] || SHIPDEF.scapha;
  const g = new THREE.Group(); g.name = 'ship_' + type;
  const rock = grp(g);
  const f = hullFns(c);
  const hm = TM('plank', c.hull, { side: THREE.DoubleSide });
  const hull = P(rock, hullGeo(type, c), hm);
  const woodD = M(darker(c.hull, 0.7)), oars = [], seats = [];
  // привальные брусья по линии борта и ватерлинии
  const railPts = (dy, inset = 1) => { const a = []; for (let i = 1; i < 12; i++) { const z = -c.L / 2 + (i / 12) * c.L; a.push(z); } return a; };
  for (const s of [-1, 1]) {
    const pts = railPts().map((z) => [s * f.hw(z) * 1.0, f.sheer(z), z]);
    P(rock, tube(`rail${type}${s}`, pts, 0.07, 0.07, 22, 5), woodD);
    const pts2 = railPts().map((z) => [s * f.halfAt(z, c.deckY * 0.45) * 1.02, c.deckY * 0.45, z]);
    P(rock, tube(`wale${type}${s}`, pts2, 0.06, 0.06, 22, 4), M(c.band || darker(c.hull, 0.6)));
  }
  // палуба / банки
  if (!c.open) P(rock, deckGeo(type, c, -c.L * 0.43, c.L * 0.42), TM('plank', 0xc8a070));
  else {
    P(rock, deckGeo(type + 'f', { ...c, deckY: -0.15 }, -c.L * 0.38, c.L * 0.36), TM('plank', 0xb08a5a));
    for (const z of [-1.6, -0.2, 1.0]) { const w = f.halfAt(z, 0.25) * 2; P(rock, box(w, 0.06, 0.28), M(C.woodL), 0, 0.25, z); }
  }
  // форштевень и ахтерштевень
  const bowZ = c.L / 2, sternZ = -c.L / 2;
  P(rock, tube(`stem${type}`, [[0, -c.D * 0.4, bowZ - 0.1], [0, f.sheer(bowZ) * 0.6, bowZ + 0.05], [0, f.sheer(bowZ) + 0.3, bowZ - 0.05], [0, f.sheer(bowZ) + 0.7, bowZ - 0.35]], 0.08 * (c.L / 14 + 0.5), 0.05, 10, 6), woodD);
  if (type === 'corbita') {
    P(rock, tube('goose', [[0, -c.D * 0.4, sternZ + 0.1], [0, f.sheer(sternZ), sternZ - 0.1], [0, f.sheer(sternZ) + 1.0, sternZ + 0.1], [0, f.sheer(sternZ) + 1.4, sternZ + 0.7], [0, f.sheer(sternZ) + 1.2, sternZ + 1.0]], 0.14, 0.07, 12, 6), woodD);
    P(rock, sph(0.15, 8, 6), M(C.gold), 0, f.sheer(sternZ) + 1.22, sternZ + 1.05);
  } else if (c.aplustre) {
    for (let i = 0; i < 5; i++) P(rock, tube(`apl${type}${i}`, [[0, f.sheer(sternZ) - 0.3, sternZ + 0.3], [(i - 2) * 0.1, f.sheer(sternZ) + 0.6, sternZ - 0.1], [(i - 2) * 0.25, f.sheer(sternZ) + 1.4 + (2 - Math.abs(i - 2)) * 0.2, sternZ + 0.3], [(i - 2) * 0.3, f.sheer(sternZ) + 1.6 + (2 - Math.abs(i - 2)) * 0.2, sternZ + 0.8]], 0.07, 0.03, 10, 5), woodD);
  } else {
    P(rock, tube(`stern${type}`, [[0, -c.D * 0.4, sternZ + 0.1], [0, f.sheer(sternZ), sternZ - 0.1], [0, f.sheer(sternZ) + 0.6, sternZ + 0.2]], 0.08 * (c.L / 14 + 0.5), 0.05, 8, 6), woodD);
  }
  // таран
  if (c.ram) {
    const rm = grp(rock, 0, -0.05, bowZ + 0.1);
    const br = MET(0x9a7a3a, 0.4, 0.8);
    P(rm, cone(0.22, 1.3, 4), br, 0, 0, 0.55, HPI, PI / 4, 0).scale.set(1, 1, 0.7);
    for (const y of [-0.12, 0.0, 0.12]) P(rm, box(0.42, 0.04, 0.9), br, 0, y, 0.35);
    P(rm, box(0.3, 0.5, 0.25), br, 0, 0, -0.05);
    P(rock, tube(`proem${type}`, [[0, f.sheer(bowZ) - 0.4, bowZ - 0.5], [0, f.sheer(bowZ) - 0.2, bowZ + 0.3], [0, f.sheer(bowZ) - 0.1, bowZ + 0.5]], 0.07, 0.05, 6, 5), br);
  }
  // глаз на носу
  if (c.eye) for (const s of [-1, 1]) {
    const z = bowZ - 1.6, x = f.halfAt(z, c.deckY * 0.75) + 0.02, e = grp(rock, s * x, c.deckY * 0.75, z, 0, s * HPI + s * -0.25, 0);
    P(e, sph(0.32, 12, 6), M(0xf2ece0), 0, 0, 0, 0, 0, 0, 1.3, 0.75, 0.15); P(e, sph(0.17, 10, 6), M(0x1a1a20), 0.08, 0, 0.03, 0, 0, 0, 1, 1, 0.2);
    P(e, box(0.9, 0.05, 0.05), M(0x9a2a22), 0, 0.27, 0.01);
  }
  // рулевые вёсла по раковинам
  if (type !== 'scapha') for (const s of [-1, 1]) {
    const z = sternZ + c.L * 0.1, x = f.hw(z) + 0.15;
    const so = grp(rock, s * x, f.sheer(z), z, 0.35, 0, s * 0.2);
    P(so, cyl(0.07, 0.08, 3.4, 6), woodD, 0, -1.4, 0);
    P(so, rbox(0.06, 1.3, 0.5, 0.02), woodD, 0, -2.9, -0.05);
  }
  // мачта, рей, парус
  let sail = null;
  if (c.sail) {
    const mz = c.mast;
    P(rock, cyl(0.12, 0.16, c.mastH, 8), woodD, 0, c.deckY + c.mastH / 2, mz);
    P(rock, cyl(0.17, 0.17, 0.4, 8), woodD, 0, c.deckY + c.mastH - 0.3, mz);
    const yard = grp(rock, 0, c.deckY + c.mastH - 0.6, mz + 0.18);
    P(yard, cyl(0.07, 0.07, c.sail[0] + 0.8, 6), woodD, 0, 0, 0, 0, 0, HPI);
    sail = grp(yard, 0, -0.05, 0.05);
    const sm = M(c.sailCol, { side: THREE.DoubleSide });
    P(sail, sailGeo(c.sail[0], c.sail[1], c.sail[0] * 0.08), sm).receiveShadow = false;
    // гитовы (вертикальные снасти) и швы
    for (let i = -3; i <= 3; i++) P(sail, box(0.02, c.sail[1], 0.02), M(darker(c.sailCol, 0.75)), (i * c.sail[0]) / 7.5, -c.sail[1] / 2, c.sail[0] * 0.08 * (1 - Math.pow((i / 3.75), 2)) * 0.8 + 0.02);
    if (c.patched) for (let i = 0; i < 4; i++) P(sail, box(1.0 + (i % 2) * 0.5, 0.8, 0.02), M([0x5a2a1a, 0x2a2018, 0x4a3a2a, 0x6a2a1a][i]), -2 + i * 1.3, -1.2 - (i % 3) * 1.1, 0.25);
    if (c.tanit) {
      const em = M(0xf0e6d0, { side: THREE.DoubleSide });
      P(sail, extr('tanitSail', [[-1.1, -1.6], [1.1, -1.6], [0, 0.5]], 0.02, 0), em, 0, -c.sail[1] * 0.62, c.sail[0] * 0.08 + 0.04);
      P(sail, box(2.6, 0.25, 0.03), em, 0, -c.sail[1] * 0.62 + 0.75, c.sail[0] * 0.08 + 0.05);
      P(sail, cyl(0.5, 0.5, 0.03, 16), em, 0, -c.sail[1] * 0.62 + 1.6, c.sail[0] * 0.08 + 0.05, HPI);
    } else if (type === 'trireme' || c.stripe) { for (let i = 0; i < 2; i++) P(sail, box(c.sail[0] * 0.98, 0.35, 0.03), M(c.stripe || 0x9a2a22, { side: THREE.DoubleSide }), 0, -c.sail[1] * (0.25 + i * 0.5), c.sail[0] * 0.08 * 0.85 + 0.03); }
    // ванты и штаги
    rope(rock, [0, c.deckY + c.mastH - 0.4, mz], [0, f.sheer(bowZ), bowZ - 0.3], 0.018);
    rope(rock, [0, c.deckY + c.mastH - 0.4, mz], [0, f.sheer(sternZ) + 0.2, sternZ + 1.0], 0.018);
    for (const s of [-1, 1]) { rope(rock, [0, c.deckY + c.mastH - 0.5, mz], [s * f.hw(mz - 1.2), f.sheer(mz - 1.2), mz - 1.2], 0.014); rope(rock, [0, c.deckY + c.mastH - 0.5, mz], [s * f.hw(mz + 1.0), f.sheer(mz + 1.0), mz + 1.0], 0.014); }
    // артемон у корбиты
    if (type === 'corbita') {
      const ar = grp(rock, 0, f.sheer(bowZ - 1), bowZ - 1.0, 0.9);
      P(ar, cyl(0.07, 0.08, 4, 6), woodD, 0, 2, 0);
      const ay = grp(ar, 0, 3.6, 0.1, -0.9); P(ay, cyl(0.04, 0.04, 2.6, 5), woodD, 0, 0, 0, 0, 0, HPI);
      P(ay, sailGeo(2.4, 1.8, 0.2), M(c.sailCol, { side: THREE.DoubleSide }), 0, -0.02, 0.04);
    }
  }
  // кормовая надстройка / рубка у корбиты, груз
  if (type === 'corbita') {
    const cb = grp(rock, 0, c.deckY, sternZ + 3.2);
    P(cb, box(2.6, 1.5, 2.2), M(0xd8c8a8), 0, 0.75, 0);
    P(cb, box(2.8, 0.12, 2.4), TILE(), 0, 1.56, 0);
    P(cb, box(0.7, 1.1, 0.04), M(0x3a2a1a), 0, 0.55, 1.11);
    for (let i = 0; i < 10; i++) amphora(rock, -1.0 + (i % 4) * 0.62, c.deckY, 1.5 + Math.floor(i / 4) * 0.7, 0.85);
    crate(rock, 1.2, c.deckY, 4.0, 1, 0.2); sack(rock, -1.2, c.deckY, 4.0, 1);
    P(rock, cyl(0.25, 0.25, 0.4, 10), M(C.woodD), 0, c.deckY + 0.2, sternZ + 4.8);
  }
  // щиты вдоль борта, кормовое укрытие для воинов
  if (c.shields) for (const s of [-1, 1]) for (let i = 0; i < Math.floor(c.L / 2.2); i++) {
    const z = -c.L * 0.32 + i * 2.0; if (z > c.L * 0.3) break;
    const sh = P(rock, cyl(0.38, 0.38, 0.05, 14), M(i % 2 ? c.shields : 0xe8dcc0), s * (f.hw(z) + 0.05), f.sheer(z) + 0.1, z, 0, 0, HPI);
    P(rock, sph(0.08, 6, 4), bronzeM(), s * (f.hw(z) + 0.09), f.sheer(z) + 0.1, z);
  }
  if (type === 'trireme' || type === 'punic_ship' || type === 'quadrireme') {
    // выносная рама для верхних гребцов (парексейресия)
    for (const s of [-1, 1]) P(rock, box(0.5, 0.35, c.L * 0.62), woodD, s * (f.hw(0) + 0.15), c.deckY + 0.05, 0);
    const tw = grp(rock, 0, c.deckY, c.L * 0.28);
    if (type === 'punic_ship') { P(tw, box(2.0, 1.8, 2.0), PLANK(), 0, 0.9, 0); for (let i = 0; i < 4; i++) for (const s of [-1, 1]) P(tw, box(0.4, 0.4, 0.3), PLANK(), s * 0.8, 2.0, -0.7 + i * 0.47); }
  }
  // вёсла: группа-уключина (ось Y — гребок), внутри — наклон (ось Z — подъём)
  const oarM = M(0xb8905a);
  if (c.banks.length) for (const [n, bank] of c.banks) {
    if (!n) continue;
    const span = type === 'scapha' ? 0 : c.L * 0.56;
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
      const z = type === 'scapha' ? -0.2 : -span / 2 + (i / Math.max(1, n - 1)) * span;
      const y = type === 'scapha' ? 0.45 : c.deckY - (c.oarY0 ?? 0.35) + bank * (c.bankDY ?? 0.42);
      const x = (type === 'scapha' ? f.hw(z) : f.halfAt(z, y)) + bank * 0.2 + 0.02;
      const o = grp(rock, s * x, y, z);
      const tilt = grp(o, 0, 0, 0, 0, 0, s * -(0.32 + bank * 0.1));
      const len = type === 'scapha' ? 2.6 : 3.8 + bank * 0.8;
      P(tilt, cyl(0.035, 0.04, len, 5), oarM, s * (len / 2 - 0.9), 0, 0, 0, 0, HPI);
      P(tilt, box(0.65, 0.03, 0.18), oarM, s * (len - 0.9 - 0.25), 0, 0);
      o.userData.side = s; o.userData.tilt = tilt; o.userData.bank = bank; o.userData.base = s * -(0.32 + bank * 0.1);
      oars.push(o);
    }
  }
  // места: рулевой первый
  if (type === 'scapha') { seats.push(new THREE.Vector3(0, 0.25, -1.6), new THREE.Vector3(0, 0.25, -0.2)); }
  else {
    seats.push(new THREE.Vector3(0, c.deckY, sternZ + c.L * 0.12));
    const n = c.seats - 1;
    for (let i = 0; i < n; i++) { const z = -c.L * 0.25 + (Math.floor(i / 2) / Math.max(1, Math.ceil(n / 2) - 1)) * c.L * 0.5; const w = f.halfAt(z, c.deckY) * 0.55; seats.push(new THREE.Vector3(i % 2 ? w : -w, c.deckY, z)); }
  }
  // катапульта (онагр) на кормовой палубе: рычаг userData.catapultArm, rotation.x от catapultRest (взведён) до catapultFired (выстрел)
  let catapult = null, catapultArm = null;
  if (c.catapult) {
    const cz = sternZ + c.L * 0.22;
    P(rock, rbox(2.0, 0.22, 3.4, 0.03), PLANK(), 0, c.deckY + 0.1, cz);
    ({ cg: catapult, arm: catapultArm } = onager(rock, 0, c.deckY + 0.21, cz));
  }
  g.userData = { oars, sail, seats, hull, rock, type, len: c.L, deckY: c.deckY, catapult, catapultArm, catapultRest: ONAGER_REST, catapultFired: ONAGER_FIRED };
  return g;
}
const ONAGER_REST = -1.35, ONAGER_FIRED = 0.17;
// онагр: рама, торсионный пучок жил, упорная рама с кожаной подушкой, ворот; рычаг — группа с осью в пучке
function onager(par, x, y, z) {
  const cg = grp(par, x, y, z);
  const wd = M(0x5e4026), wl = M(0x8a6238), ir = ironM(), rp = M(0xb8a47a);
  for (const s of [-1, 1]) P(cg, box(0.18, 0.22, 2.4), wd, s * 0.55, 0.11, 0);
  for (const zz of [-1.05, 0.0, 1.05]) P(cg, box(1.3, 0.14, 0.18), wd, 0, 0.12, zz);
  for (const s of [-1, 1]) {
    P(cg, box(0.2, 0.56, 0.4), wd, s * 0.55, 0.5, 0.2);
    P(cg, cyl(0.17, 0.17, 0.05, 10), ir, s * 0.67, 0.55, 0.2, 0, 0, HPI);
    P(cg, box(0.04, 0.05, 0.5), ir, s * 0.7, 0.55, 0.2);
    P(cg, box(0.15, 1.6, 0.15), wd, s * 0.5, 0.9, 0.72);
    P(cg, box(0.1, 1.15, 0.1), wd, s * 0.5, 0.62, 1.05, 0.55, 0, 0);
    for (const k of [0, 1]) P(cg, box(0.04, 0.62, 0.04), wl, s * 0.68, 0.36, -0.95, k * HPI, 0, 0);
  }
  P(cg, cyl(0.16, 0.16, 0.92, 10), rp, 0, 0.55, 0.2, 0, 0, HPI);                // пучок жил
  P(cg, box(1.18, 0.18, 0.18), wd, 0, 1.62, 0.72);
  P(cg, box(0.8, 0.32, 0.22), M(0x7a5232), 0, 1.3, 0.52);                     // подушка
  P(cg, cyl(0.09, 0.09, 1.24, 8), wl, 0, 0.36, -0.95, 0, 0, HPI);              // ворот
  const arm = grp(cg, 0, 0.55, 0.2, ONAGER_REST, 0, 0);
  P(arm, box(0.15, 2.0, 0.15), wl, 0, 0.95, 0);
  for (const yy of [0.35, 1.1, 1.7]) P(arm, box(0.18, 0.06, 0.18), ir, 0, yy, 0);
  P(arm, cyl(0.17, 0.09, 0.14, 8), ir, 0, 1.88, 0.1, HPI, 0, 0);              // ложка
  P(arm, ico(0.13, 1), FOL(0x8a8478), 0, 1.88, 0.2);                           // камень
  cg.userData.arm = arm;
  return { cg, arm };
}
export function animateShip(sh, t, speed = 0) {
  const u = sh.userData; if (!u.rock) return;
  const rowing = Math.abs(speed) > 0.3;
  const k = clamp(Math.abs(speed) / 8, 0, 1);
  // гребля в такт: проводка (лопасть в воде) и занос
  const ph = t * (0.75 + 0.35 * k) * TAU;
  for (const o of u.oars) {
    const s = o.userData.side;
    if (rowing) {
      const sw = Math.sin(ph), lift = Math.cos(ph) > 0 ? -0.12 : 0.18 * Math.min(1, -Math.cos(ph) * 2);
      o.rotation.y = s * sw * 0.42 * Math.sign(speed || 1);
      o.userData.tilt.rotation.z = o.userData.base + s * -lift;
    } else { o.rotation.y = lerp(o.rotation.y, s * 0.15, 0.05); o.userData.tilt.rotation.z = lerp(o.userData.tilt.rotation.z, o.userData.base + s * 0.25, 0.05); }
  }
  if (u.sail) { u.sail.scale.z = 0.8 + 0.25 * Math.sin(t * 1.3) + 0.15 * Math.sin(t * 3.1) + 0.3 * k; u.sail.rotation.x = 0.02 * Math.sin(t * 2.2); }
  const sc = 1 / Math.sqrt(u.len / 10);
  u.rock.rotation.z = Math.sin(t * 0.8) * 0.035 * sc;
  u.rock.rotation.x = Math.sin(t * 0.55 + 1) * 0.018 * sc - 0.01 * k;
  u.rock.position.y = Math.sin(t * 1.1) * 0.05 * sc;
}

// ======================================================================
// Сундуки
// ======================================================================
TEXDRAW.paintChest = TEXDRAW.paint;
export function makeChest(kind = 'chest') {
  const g = new THREE.Group(); g.name = 'chest_' + kind;
  let lid;
  const iron = ironM();
  if (kind === 'crate') {
    const w = 0.9, h = 0.6, d = 0.6, wm = M(0xa07a4c), dk = M(0x6e4a28);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) P(g, box(w, h / 3 - 0.01, 0.03), wm, 0, 0.1 + i * h / 3 + 0.0, s * (d / 2 - 0.015));
    for (const s of [-1, 1]) P(g, box(0.03, h, d), wm, s * (w / 2 - 0.015), h / 2, 0);
    P(g, box(w, 0.03, d), dk, 0, 0.015, 0);
    for (const s of [-1, 1]) for (const sz of [-1, 1]) P(g, box(0.06, h, 0.06), dk, s * (w / 2 - 0.03), h / 2, sz * (d / 2 - 0.03));
    for (const s of [-1, 1]) { const dg = P(g, box(0.05, Math.hypot(w, h) - 0.1, 0.02), dk, 0, h / 2, s * (d / 2 + 0.005)); dg.rotation.z = Math.atan2(h, w) * s; }
    P(g, box(w - 0.06, 0.04, d - 0.06), M(0xd8c8a0), 0, h - 0.1, 0);
    lid = grp(g, 0, h, -d / 2);
    for (let i = 0; i < 4; i++) P(lid, box(w + 0.02, 0.035, d / 4 - 0.01), wm, 0, 0.018, d / 8 + (i * d) / 4);
    for (const s of [-1, 1]) P(lid, box(0.06, 0.04, d), dk, s * (w / 2 - 0.06), 0.04, d / 2);
  } else if (kind === 'chest' || kind === 'wreck') {
    const wreck = kind === 'wreck';
    const w = 1.0, h = 0.5, d = 0.6;
    const wm = wreck ? M(0x4e4234) : M(0x7a4e2a), band = wreck ? M(0x6a4a30, { roughness: 0.9 }) : iron;
    P(g, rbox(w, h, d, 0.02), wm, 0, h / 2, 0);
    for (const x of [-0.35, 0, 0.35]) P(g, box(0.06, h + 0.01, d + 0.02), band, x, h / 2, 0);
    P(g, box(w + 0.02, 0.05, d + 0.02), band, 0, 0.04, 0);
    P(g, box(0.14, 0.16, 0.03), wreck ? band : M(C.bronze, { metalness: 0.7, roughness: 0.4 }), 0, h - 0.08, d / 2 + 0.01);
    for (const s of [-1, 1]) P(g, tor(0.06, 0.012, 4, 10, PI), band, s * (w / 2 + 0.01), h * 0.6, 0, 0, HPI, PI);
    lid = grp(g, 0, h, -d / 2);
    P(lid, G('chestLid', () => new THREE.CylinderGeometry(d / 2, d / 2, w, 14, 1, false, -HPI, PI)), wm, 0, 0, d / 2, 0, 0, HPI).scale.set(1, 1, 0.55);
    lid.children[0].scale.set(0.55, 1, 1);
    for (const x of [-0.35, 0, 0.35]) P(lid, G('lidBand', () => new THREE.CylinderGeometry(d / 2 + 0.01, d / 2 + 0.01, 0.06, 14, 1, true, -HPI, PI)), band, x, 0, d / 2, 0, 0, HPI).scale.set(0.57, 1, 1.02);
    if (wreck) {
      const r = rng(5);
      for (let i = 0; i < 26; i++) { const sx = (r() - 0.5) * w, sy = r() * h, side = r() < 0.5 ? 1 : -1; P(g, cone(0.025 + r() * 0.02, 0.03, 6), M(0xd8d0c0), sx, sy, side * (d / 2 + 0.01), side * HPI, 0, 0); }
      for (let i = 0; i < 10; i++) P(lid, cone(0.025, 0.03, 6), M(0xc8c0b0), (r() - 0.5) * w * 0.9, 0.12 + r() * 0.1, d / 2 + (r() - 0.5) * d * 0.6);
      for (let i = 0; i < 6; i++) P(g, tube(`weed${i}`, [[(r() - 0.5) * w, h, d / 2], [(r() - 0.5) * w, h * 0.6, d / 2 + 0.05], [(r() - 0.5) * w, 0.05, d / 2 + 0.1]], 0.015, 0.006, 5, 3), M(0x3a5a2a));
      P(g, G('sandMound', () => lumpy(new THREE.SphereGeometry(0.7, 10, 5, 0, TAU, 0, HPI), 0.15, 2)), M(C.sand), 0.1, -0.05, 0.1, 0, 0, 0, 1, 0.25, 0.8);
      g.rotation.z = 0.08;
    }
  } else {
    // расписной египетский ларец на ножках
    const w = 0.85, h = 0.5, d = 0.55;
    const pm = TM('paint', 0xffffff);
    for (const s of [-1, 1]) for (const sz of [-1, 1]) P(g, box(0.07, 0.18, 0.07), M(0x2a1a10), s * (w / 2 - 0.05), 0.09, sz * (d / 2 - 0.05));
    P(g, box(w, h, d), pm, 0, 0.18 + h / 2, 0);
    for (const s of [-1, 1]) { P(g, box(w + 0.03, 0.04, d + 0.03), goldM(), 0, 0.18 + (s > 0 ? h : 0.02), 0); P(g, box(0.04, h, d + 0.03), goldM(), s * (w / 2 + 0.005), 0.18 + h / 2, 0); }
    P(g, box(0.4, 0.2, 0.02), M(0x1f3f8a), 0, 0.18 + h / 2, d / 2 + 0.01);
    P(g, sph(0.035, 8, 6), goldM(), 0, 0.18 + h / 2, d / 2 + 0.03);
    lid = grp(g, 0, 0.18 + h, -d / 2);
    P(lid, box(w + 0.04, 0.06, d + 0.04), M(0x1f3f8a), 0, 0.03, d / 2);
    P(lid, G('ornLid', () => new THREE.CylinderGeometry(0.0, 1, 1, 4, 1)), M(0x1f3f8a), 0, 0.14, d / 2, 0, PI / 4, 0).scale.set(w * 0.68, 0.16, d * 0.68);
    P(lid, box(w + 0.06, 0.03, d + 0.06), goldM(), 0, 0.075, d / 2);
    P(lid, sph(0.04, 8, 6), goldM(), 0, 0.24, d / 2);
  }
  g.userData = { lid, kind };
  return g;
}

// ======================================================================
// Торговые ящики (переносимый груз, сорт 1..4): ~0.8×0.6×0.6 м, начало — центр дна
// ======================================================================
// дощатый короб: щель между досками показывает тёмный остов
function slatBox(g, w, h, d, y0, wood, core) {
  P(g, box(w - 0.04, h - 0.04, d - 0.04), core, 0, y0 + h / 2, 0);
  const n = 3, sh = h / n;
  for (let i = 0; i < n; i++) {
    const yy = y0 + sh * (i + 0.5);
    for (const s of [-1, 1]) P(g, box(w, sh - 0.025, 0.03), wood, 0, yy, s * (d / 2 - 0.015));
    for (const s of [-1, 1]) P(g, box(0.03, sh - 0.025, d - 0.06), wood, s * (w / 2 - 0.015), yy, 0);
  }
  for (let i = 0; i < 3; i++) P(g, box(w, 0.03, d / 3 - 0.02), wood, 0, y0 + h - 0.015, -d / 3 + (i * d) / 3);
}
export function makeTradeCrate(grade = 1) {
  grade = clamp(grade | 0, 1, 4);
  const g = new THREE.Group(); g.name = 'tradecrate_' + grade;
  const W = 0.8, H = 0.6, D = 0.6;
  if (grade === 1) {
    // сосновые доски, обвязка верёвкой
    const wood = M(0xc9a46a), core = M(0x7a5a34), bat = M(0xb08a54), rp = M(C.rope);
    slatBox(g, W, H, D, 0, wood, core);
    for (const s of [-1, 1]) for (const sz of [-1, 1]) P(g, box(0.05, H, 0.05), bat, s * (W / 2 - 0.02), H / 2, sz * (D / 2 - 0.02));
    for (const x of [-0.22, 0.22]) {
      P(g, box(0.025, 0.025, D + 0.04), rp, x, H + 0.012, 0);
      for (const s of [-1, 1]) P(g, box(0.025, H, 0.025), rp, x, H / 2, s * (D / 2 + 0.012));
    }
    P(g, box(W + 0.04, 0.025, 0.025), rp, 0, H + 0.02, 0);
    P(g, sph(0.035, 6, 4), rp, 0.22, H + 0.03, 0);
    rope(g, [0.22, H + 0.03, 0.02], [0.3, H - 0.1, D / 2 + 0.02], 0.01, rp);
  } else if (grade === 2) {
    // тёмное дерево, железные уголки и обвязка
    const wood = M(0x7a5434), core = M(0x3e2a18), ir = ironM();
    slatBox(g, W, H, D, 0, wood, core);
    for (const s of [-1, 1]) for (const sz of [-1, 1]) P(g, box(0.07, H + 0.01, 0.07), ir, s * (W / 2 - 0.03), H / 2, sz * (D / 2 - 0.03));
    for (const yy of [0.03, H - 0.02]) {
      for (const sz of [-1, 1]) P(g, box(W + 0.01, 0.05, 0.035), ir, 0, yy, sz * (D / 2 + 0.002));
      for (const s of [-1, 1]) P(g, box(0.035, 0.05, D + 0.01), ir, s * (W / 2 + 0.002), yy, 0);
    }
    for (const s of [-1, 1]) {
      P(g, box(0.04, 0.06, 0.12), ir, s * (W / 2 + 0.02), H * 0.62, 0);
      P(g, tor(0.07, 0.012, 3, 8, PI), ir, s * (W / 2 + 0.035), H * 0.55, 0, 0, HPI, PI);
    }
    P(g, box(0.1, 0.12, 0.02), ir, 0, H - 0.1, D / 2 + 0.01);
  } else if (grade === 3) {
    // окованный ларь: бронзовые накладки, нарисованная метка купца
    const wood = M(0x6a4024), br = bronzeM(), h = 0.46;
    P(g, rbox(W, h, D, 0.02), wood, 0, h / 2, 0);
    P(g, G('tcLid3', () => new THREE.CylinderGeometry(D / 2, D / 2, W, 10, 1, false, -HPI, PI)), wood, 0, h, 0, 0, 0, HPI).scale.set(0.4, 1, 1);
    for (const x of [-0.25, 0.25]) {
      P(g, box(0.06, h + 0.01, D + 0.02), br, x, h / 2, 0);
      P(g, G('tcLidB3', () => new THREE.CylinderGeometry(D / 2 + 0.01, D / 2 + 0.01, 0.06, 10, 1, true, -HPI, PI)), br, x, h, 0, 0, 0, HPI).scale.set(0.42, 1, 1);
    }
    for (const s of [-1, 1]) for (const sz of [-1, 1]) for (const yy of [0.04, h - 0.04]) P(g, box(0.09, 0.09, 0.09), br, s * (W / 2 - 0.035), yy, sz * (D / 2 - 0.035));
    P(g, box(W + 0.02, 0.04, D + 0.02), br, 0, 0.02, 0);
    P(g, box(0.14, 0.16, 0.025), br, 0, h - 0.08, D / 2 + 0.01);
    // метка: красный круг с монограммой
    P(g, cyl(0.1, 0.1, 0.01, 10), M(0xb83a22), 0, h * 0.42, D / 2 + 0.006, HPI, 0, 0);
    P(g, box(0.025, 0.13, 0.012), M(0xf0e6cc), 0, h * 0.42, D / 2 + 0.013, 0, 0, 0.5);
    P(g, box(0.025, 0.13, 0.012), M(0xf0e6cc), 0, h * 0.42, D / 2 + 0.013, 0, 0, -0.5);
    for (const s of [-1, 1]) P(g, tor(0.065, 0.012, 3, 8, PI), br, s * (W / 2 + 0.012), h * 0.6, 0, 0, HPI, PI);
  } else {
    // роскошный: тёмное дерево, золото и пурпур, восковая печать
    const wood = M(0x34200f), gd = goldM(), pur = M(C.purple), h = 0.44, y0 = 0.06;
    for (const s of [-1, 1]) for (const sz of [-1, 1]) P(g, cyl(0.035, 0.045, y0, 6), gd, s * (W / 2 - 0.06), y0 / 2, sz * (D / 2 - 0.06));
    P(g, rbox(W, h, D, 0.02), wood, 0, y0 + h / 2, 0);
    P(g, rbox(W + 0.03, 0.08, D + 0.03, 0.02), wood, 0, y0 + h + 0.04, 0);
    P(g, box(W - 0.2, 0.012, D - 0.2), pur, 0, y0 + h + 0.085, 0);
    P(g, box(W - 0.24, 0.016, D - 0.24), gd, 0, y0 + h + 0.088, 0).scale.set(0.15, 1, 1);
    for (const yy of [y0 + 0.015, y0 + h, y0 + h + 0.08]) {
      for (const sz of [-1, 1]) P(g, box(W + 0.035, 0.025, 0.02), gd, 0, yy, sz * (D / 2 + 0.012));
      for (const s of [-1, 1]) P(g, box(0.02, 0.025, D + 0.035), gd, s * (W / 2 + 0.012), yy, 0);
    }
    for (const s of [-1, 1]) for (const sz of [-1, 1]) P(g, box(0.035, h + 0.08, 0.035), gd, s * (W / 2 + 0.005), y0 + (h + 0.08) / 2, sz * (D / 2 + 0.005));
    // пурпурная лента через крышку и печать на ней
    P(g, box(0.1, 0.012, D + 0.05), pur, 0, y0 + h + 0.088, 0);
    P(g, box(0.1, h * 0.6, 0.012), pur, 0, y0 + h + 0.08 - h * 0.3, D / 2 + 0.022);
    P(g, cyl(0.055, 0.06, 0.022, 9), M(0x8a1414, { roughness: 0.5 }), 0, y0 + h * 0.48, D / 2 + 0.035, HPI, 0, 0);
    P(g, cyl(0.03, 0.03, 0.006, 8), M(0x6a0e0e, { roughness: 0.5 }), 0, y0 + h * 0.48, D / 2 + 0.048, HPI, 0, 0);
    P(g, box(0.16, 0.12, 0.012), gd, 0, y0 + h - 0.05, D / 2 + 0.014);
    for (const s of [-1, 1]) P(g, tor(0.06, 0.011, 3, 8, PI), gd, s * (W / 2 + 0.015), y0 + h * 0.62, 0, 0, HPI, PI);
  }
  g.userData = { grade, kind: 'tradecrate' };
  return g;
}
// ящик, плывущий по воде: начало — уровень воды; ящик притоплен наполовину, рядом доски и обрывок верёвки
export function makeFloatingCrate(grade = 1) {
  const g = new THREE.Group(); g.name = 'floatcrate_' + grade;
  const bob = grp(g);
  const tilt = grp(bob, 0, 0, 0, 0.12, 0.35, -0.15);
  const cr = makeTradeCrate(grade); cr.position.y = -0.3; tilt.add(cr);
  const pl = M(0x8a6a44), pl2 = M(0x6e5436);
  P(bob, box(0.2, 0.05, 1.5), pl, 0.85, -0.005, 0.35, 0.03, 0.7, 0.02);
  P(bob, box(0.16, 0.05, 1.1), pl2, -0.75, -0.01, -0.55, -0.04, -0.4, 0.05);
  P(bob, box(0.12, 0.04, 0.6), pl, -0.35, 0.0, 0.8, 0, 1.4, 0);
  P(bob, tube('fcRope', [[0.3, 0.12, 0.2], [0.5, 0.02, 0.45], [0.75, 0.0, 0.6], [1.05, 0.01, 0.95], [1.3, -0.01, 1.05]], 0.016, 0.012, 10, 4), M(C.rope));
  g.userData = { crate: cr, bob, grade, kind: 'floatcrate' };
  return g;
}

// ======================================================================
// Природа (экземпляры: мало граней)
// ======================================================================
const FOL = (c) => M(c, { flatShading: true });
function trunkSeg(par, x0, y0, z0, x1, y1, z1, r0, r1, mat, seg = 5) {
  const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), len = a.distanceTo(b);
  const m = P(par, cyl(r1, r0, 1, seg, true), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.scale.y = len; m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return m;
}
const blobG = (r, d, seed, sy = 1) => G(`blob${r},${d},${seed},${sy}`, () => lumpy(new THREE.IcosahedronGeometry(r, d), 0.22, seed, sy));
export function makeTree(kind = 'olive') {
  const g = new THREE.Group(); g.name = 'tree_' + kind;
  switch (kind) {
    case 'olive': {
      const bark = M(0x6a5a48), leaf = FOL(0x7d8f5c), leaf2 = FOL(0x6a7d4c);
      trunkSeg(g, 0, -0.5, 0, 0.1, 0.9, 0.05, 0.26, 0.18, bark, 6);
      trunkSeg(g, 0.1, 0.9, 0.05, -0.35, 1.7, 0.1, 0.16, 0.09, bark);
      trunkSeg(g, 0.1, 0.9, 0.05, 0.55, 1.8, -0.15, 0.15, 0.08, bark);
      trunkSeg(g, 0.1, 0.9, 0.05, 0.1, 1.9, 0.5, 0.12, 0.07, bark, 4);
      P(g, blobG(0.95, 1, 1, 0.65), leaf, -0.45, 2.1, 0.1);
      P(g, blobG(0.9, 1, 2, 0.6), leaf2, 0.65, 2.15, -0.2);
      P(g, blobG(0.8, 1, 3, 0.65), leaf, 0.15, 2.3, 0.6);
      P(g, blobG(0.75, 0, 4, 0.7), leaf2, 0.05, 2.6, -0.3);
      break;
    }
    case 'cypress': {
      trunkSeg(g, 0, -0.5, 0, 0, 1.0, 0, 0.18, 0.13, M(0x5a4430));
      P(g, blobG(0.75, 1, 5, 1), FOL(0x2f4a26), 0, 3.6, 0, 0, 0, 0, 1, 4.2, 1);
      P(g, blobG(0.45, 0, 6, 1), FOL(0x3a5a2e), 0, 6.4, 0, 0, 0, 0, 1, 2.2, 1);
      break;
    }
    case 'pine': {
      const bark = M(0x7a5a42);
      trunkSeg(g, 0, -0.5, 0, 0.3, 3.2, 0.1, 0.3, 0.22, bark, 6);
      trunkSeg(g, 0.3, 3.2, 0.1, 0.1, 5.6, -0.1, 0.22, 0.14, bark, 6);
      trunkSeg(g, 0.2, 4.6, 0, 1.3, 5.6, 0.4, 0.1, 0.06, bark, 4);
      trunkSeg(g, 0.2, 4.6, 0, -1.1, 5.7, -0.5, 0.1, 0.06, bark, 4);
      const lf = FOL(0x3e5a2a), lf2 = FOL(0x4a6a32);
      P(g, blobG(1.6, 1, 7, 0.35), lf, 0.0, 6.2, 0.0, 0, 0, 0, 1.4, 1, 1.4);
      P(g, blobG(1.2, 1, 8, 0.4), lf2, 1.4, 5.9, 0.5);
      P(g, blobG(1.1, 1, 9, 0.4), lf2, -1.3, 6.0, -0.6);
      P(g, blobG(1.0, 0, 10, 0.4), lf, 0.2, 6.6, -0.9);
      break;
    }
    case 'oak': {
      const bark = M(0x5e4a36);
      trunkSeg(g, 0, -0.5, 0, 0, 1.8, 0, 0.42, 0.32, bark, 7);
      trunkSeg(g, 0, 1.6, 0, 1.2, 2.9, 0.3, 0.24, 0.14, bark, 5);
      trunkSeg(g, 0, 1.6, 0, -1.0, 3.0, -0.4, 0.24, 0.14, bark, 5);
      trunkSeg(g, 0, 1.8, 0, 0.1, 3.4, 0.9, 0.2, 0.12, bark, 5);
      const lf = FOL(0x4e6e2a), lf2 = FOL(0x5e7e32);
      P(g, blobG(1.7, 1, 11, 0.75), lf, 0, 3.8, 0);
      P(g, blobG(1.2, 1, 12, 0.8), lf2, 1.5, 3.3, 0.4);
      P(g, blobG(1.2, 1, 13, 0.8), lf2, -1.4, 3.4, -0.5);
      P(g, blobG(1.0, 0, 14, 0.8), lf, 0.2, 3.5, 1.4);
      break;
    }
    case 'palm': {
      // финиковая пальма: изогнутый ствол из колец и перистые листья
      const bark = M(0x8a6e4a), ring = M(0x6e5434);
      let x = 0, y = -0.5;
      for (let i = 0; i < 6; i++) { const nx = x + 0.08 * i * 0.4, ny = y + 1.15; trunkSeg(g, x, y, 0, nx, ny, 0, 0.24 - i * 0.015, 0.22 - i * 0.015, i % 2 ? bark : ring, 6); x = nx; y = ny; }
      const frond = G('frond', () => {
        const pos = [], n = 5;
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n;
          const p = (t) => [0, 0.6 * Math.sin(t * PI * 0.8) - t * t * 1.1, t * 2.6];
          const w = (t) => 0.38 * Math.sin(Math.min(1, t * 1.2) * PI) + 0.04;
          const a = p(t0), b = p(t1);
          pos.push(-w(t0), a[1], a[2], 0, a[1] + 0.05, a[2], -w(t1), b[1], b[2]);
          pos.push(0, a[1] + 0.05, a[2], 0, b[1] + 0.05, b[2], -w(t1), b[1], b[2]);
          pos.push(0, a[1] + 0.05, a[2], w(t0), a[1], a[2], w(t1), b[1], b[2]);
          pos.push(0, a[1] + 0.05, a[2], w(t1), b[1], b[2], 0, b[1] + 0.05, b[2]);
        }
        const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); q.computeVertexNormals(); return q;
      });
      const lm = M(0x5a7a2a, { side: THREE.DoubleSide }), lm2 = M(0x6e8e34, { side: THREE.DoubleSide });
      for (let i = 0; i < 10; i++) { const fr = P(g, frond, i % 2 ? lm : lm2, x, y, 0, 0, (i / 10) * TAU + (i % 2) * 0.3, 0); fr.rotation.set(-0.2 - (i % 3) * 0.12, (i / 10) * TAU, 0, 'YXZ'); fr.castShadow = true; }
      for (let i = 0; i < 3; i++) P(g, ico(0.16, 0), M(0xc8742a), x + Math.cos(i * 2.1) * 0.25, y - 0.35, Math.sin(i * 2.1) * 0.25, 0, 0, 0, 1, 1.6, 1);
      break;
    }
    case 'cedar': {
      trunkSeg(g, 0, -0.5, 0, 0, 5.5, 0, 0.36, 0.14, M(0x5a4636), 6);
      const lf = FOL(0x2e4a3a), lf2 = FOL(0x3a5a44);
      [[2.6, 1.6], [2.1, 2.9], [1.6, 4.1], [1.0, 5.2], [0.55, 6.1]].forEach(([r, y], i) => P(g, blobG(r, i < 3 ? 1 : 0, 20 + i, 0.28), i % 2 ? lf : lf2, (i % 2) * 0.2, y + 0.3, 0, 0, i, 0, 1.15, 1, 1));
      break;
    }
    default: { // dead
      const bark = M(0x6e5a44);
      trunkSeg(g, 0, -0.5, 0, 0.1, 2.4, 0, 0.24, 0.14, bark, 6);
      trunkSeg(g, 0.08, 1.6, 0, 1.0, 2.6, 0.3, 0.1, 0.04, bark, 4);
      trunkSeg(g, 0.1, 2.0, 0, -0.8, 3.0, -0.2, 0.09, 0.03, bark, 4);
      trunkSeg(g, 0.1, 2.4, 0, 0.3, 3.4, 0.5, 0.08, 0.03, bark, 4);
      trunkSeg(g, 0.6, 2.2, 0.15, 0.9, 2.9, -0.4, 0.04, 0.02, bark, 3);
      break;
    }
  }
  return g;
}
export function makeBush(kind = 'med') {
  const g = new THREE.Group(); g.name = 'bush_' + kind;
  if (kind === 'med') {
    const a = FOL(0x3e5e2a), b = FOL(0x4e6e30);
    P(g, blobG(0.55, 1, 31, 0.7), a, 0, 0.32, 0); P(g, blobG(0.42, 0, 32, 0.75), b, 0.42, 0.26, 0.15); P(g, blobG(0.4, 0, 33, 0.75), b, -0.35, 0.25, -0.2);
    for (let i = 0; i < 5; i++) P(g, oct(0.05), M(i % 2 ? 0xe8e0f0 : 0xd84a8a), Math.cos(i * 1.7) * 0.4, 0.55 + (i % 2) * 0.1, Math.sin(i * 1.7) * 0.35);
  } else if (kind === 'dry') {
    const a = FOL(0x8a7a4a), s = M(0x6a5a3a);
    P(g, blobG(0.45, 0, 34, 0.6), a, 0, 0.25, 0, 0, 0, 0, 1, 1, 1);
    for (let i = 0; i < 7; i++) { const an = (i / 7) * TAU; trunkSeg(g, 0, 0.05, 0, Math.cos(an) * 0.6, 0.6 + (i % 3) * 0.15, Math.sin(an) * 0.6, 0.025, 0.01, s, 3); }
  } else if (kind === 'papyrus') {
    const st = M(0x5a8a3a), hd = FOL(0x7aa04a);
    for (let i = 0; i < 11; i++) {
      const an = i * 2.4, r = 0.08 + (i % 4) * 0.1, h = 1.6 + (i % 3) * 0.5, lean = 0.15 + r * 0.6;
      const x1 = Math.cos(an) * (r + lean), z1 = Math.sin(an) * (r + lean);
      trunkSeg(g, Math.cos(an) * r * 0.5, -0.1, Math.sin(an) * r * 0.5, x1, h, z1, 0.02, 0.012, st, 3);
      P(g, G('umbel', () => new THREE.ConeGeometry(0.28, 0.32, 6, 1, true)), hd, x1, h + 0.05, z1, PI, 0, 0);
    }
  } else { // reed
    const a = M(0x7a9a4a, { side: THREE.DoubleSide }), b = M(0x9aa85a, { side: THREE.DoubleSide });
    const blade = G('reedBlade', () => new THREE.CylinderGeometry(0, 0.035, 1, 3, 1, true));
    for (let i = 0; i < 16; i++) { const an = i * 2.4, r = (i % 5) * 0.07, h = 1.2 + (i % 4) * 0.35; const m = P(g, blade, i % 2 ? a : b, Math.cos(an) * r, h / 2 - 0.05, Math.sin(an) * r, Math.sin(an) * 0.18, 0, Math.cos(an) * 0.18); m.scale.y = h; }
    for (let i = 0; i < 3; i++) P(g, cyl(0.035, 0.035, 0.25, 5), M(0x6a4a2a), Math.cos(i * 2) * 0.15, 1.6 + i * 0.12, Math.sin(i * 2) * 0.15);
  }
  return g;
}
export function makeRockNode(kind = 'stone') {
  const g = new THREE.Group(); g.name = 'node_' + kind;
  const rg = (r, seed) => G(`rk${r},${seed}`, () => lumpy(new THREE.DodecahedronGeometry(r, 0), 0.25, seed));
  if (kind === 'clay') {
    P(g, G('clayMound', () => lumpy(new THREE.SphereGeometry(1.0, 9, 5, 0, TAU, 0, HPI), 0.18, 41)), FOL(C.clay), 0, -0.1, 0, 0, 0, 0, 1.2, 0.6, 1);
    P(g, rg(0.3, 42), FOL(0x8a4a30), 0.6, 0.15, 0.4); P(g, rg(0.25, 43), FOL(0xb86a48), -0.5, 0.1, -0.5);
    P(g, cyl(0.35, 0.4, 0.04, 8), M(0x6a3a28, { roughness: 0.4 }), -0.2, 0.45, 0.2, 0.1, 0, 0.1);
    return g;
  }
  const base = { stone: 0x9a9284, iron: 0x6a5e56, marble: 0xeeeae2, silver: 0x8a8e94 }[kind] || 0x9a9284;
  const m1 = FOL(base), m2 = FOL(darker(base, 0.85));
  P(g, rg(0.75, 44), m1, 0, 0.35, 0, 0.2, 0.5, 0, 1.1, 0.85, 1);
  P(g, rg(0.5, 45), m2, 0.7, 0.2, 0.3, 0.6, 1.2, 0.2);
  P(g, rg(0.42, 46), m1, -0.6, 0.15, 0.4, 1.0, 0.3, 0.5);
  if (kind === 'iron') { const rust = FOL(0xa0522d), r2 = FOL(0x8a3a1a); for (let i = 0; i < 6; i++) P(g, oct(0.16 + (i % 3) * 0.05), i % 2 ? rust : r2, Math.cos(i * 1.9) * 0.55, 0.45 + (i % 3) * 0.18, Math.sin(i * 1.9) * 0.45, i, i * 2, 0, 1, 0.6, 1); }
  if (kind === 'marble') { P(g, rbox(0.7, 0.5, 0.5, 0.03), M(0xf4f2ec), -0.2, 0.75, -0.25, 0, 0.4, 0.1); P(g, box(0.02, 0.6, 0.5), M(0xb8b4ac), 0.25, 0.5, 0.45, 0, 0.3, 0.6); }
  if (kind === 'silver') { const sm = M(0xf4f6fa, { metalness: 0.35, roughness: 0.15, emissive: 0x404448 }); for (let i = 0; i < 9; i++) P(g, oct(0.05 + (i % 3) * 0.02), sm, Math.cos(i * 1.4) * 0.6, 0.5 + (i % 4) * 0.12, Math.sin(i * 1.4) * 0.5, i, i, 0); }
  if (kind === 'stone') P(g, rg(0.25, 47), m2, 0.2, 0.08, -0.7);
  return g;
}
export function makeGrassTuft() {
  const g = new THREE.Group(); g.name = 'grass';
  const blade = G('grassBlade', () => new THREE.CylinderGeometry(0, 0.04, 1, 3, 1, true));
  const a = M(0x6f9a3a, { side: THREE.DoubleSide }), b = M(0x8ab04e, { side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) { const an = i * 2.4, r = (i % 3) * 0.06, h = 0.35 + (i % 4) * 0.12; const m = P(g, blade, i % 2 ? a : b, Math.cos(an) * r, h / 2 - 0.02, Math.sin(an) * r, Math.sin(an) * 0.35, 0, Math.cos(an) * 0.35); m.scale.y = h; m.castShadow = false; }
  return g;
}
export function makeRock(s = 1) {
  const g = new THREE.Group(); g.name = 'rock';
  P(g, G('boulder', () => lumpy(new THREE.IcosahedronGeometry(1, 1), 0.22, 51)), FOL(0xa09682), 0, 0.45 * s, 0, 0.3, 0.7, 0, 1.2 * s, 0.85 * s, 1 * s);
  P(g, G('boulder2', () => lumpy(new THREE.DodecahedronGeometry(0.5, 0), 0.25, 52)), FOL(0x8e8472), 0.9 * s, 0.15 * s, 0.4 * s, 0.4, 0.2, 0, s);
  return g;
}

// ======================================================================
// Рыбы (масштаб 1:1, характерные формы и окраска)
// ======================================================================
const FISHDEF = {
  sardine: { L: 0.18, d: 0.17, w: 0.6, back: 0x2a5a7a, belly: 0xdce4ea, tail: 'fork', dorsal: [[0.45, 0.1, 0.08]], spots: 0x1a3a5a },
  mackerel: { L: 0.35, d: 0.17, w: 0.75, back: 0x2a6a6a, belly: 0xe8ecef, tail: 'fork', dorsal: [[0.62, 0.12, 0.1], [0.38, 0.07, 0.07]], stripes: 0x10302a, finlets: 1 },
  seabass: { L: 0.6, d: 0.24, w: 0.55, back: 0x5a6670, belly: 0xe0e4e6, tail: 'fork', dorsal: [[0.6, 0.18, 0.13], [0.36, 0.12, 0.1]] },
  dentex: { L: 0.6, d: 0.33, w: 0.5, back: 0xb07a8a, belly: 0xece0e0, tail: 'fork', dorsal: [[0.55, 0.36, 0.13]], dots: 0x3a6aaa, blunt: 1 },
  grouper: { L: 0.9, d: 0.32, w: 0.6, back: 0x5a4632, belly: 0xb8a888, tail: 'round', dorsal: [[0.6, 0.45, 0.1]], blotch: 0xd8c8a0, mouth: 1 },
  tuna: { L: 2.0, d: 0.27, w: 0.8, back: 0x1a2a4a, belly: 0xd8dde4, tail: 'crescent', dorsal: [[0.62, 0.14, 0.12], [0.42, 0.12, 0.1]], finlets: 0xd8c040, pect: 0.2 },
  swordfish: { L: 1.9, d: 0.22, w: 0.75, back: 0x3a2a3a, belly: 0xb8b4c0, tail: 'crescent', dorsal: [[0.72, 0.3, 0.14]], sword: 0.65 },
  sturgeon: { L: 1.8, d: 0.14, w: 1.0, back: 0x5a5a4e, belly: 0xd8d4c4, tail: 'hetero', dorsal: [[0.25, 0.06, 0.08]], scutes: 1, snout: 1 },
};
function fishBody(key, D) {
  return G('fishB' + key, () => {
    const L = D.L, R = (L * D.d) / 2, pts = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n;               // 0 — хвостовой стебель, 1 — рыло
      let r = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.85) * R;
      if (t < 0.12) r = Math.max(r, R * 0.12);
      if (D.blunt && t > 0.75) r *= 1 + (t - 0.75) * 0.6;
      if (D.snout && t > 0.8) r *= 1 - (t - 0.8) * 2.5;
      pts.push(new THREE.Vector2(Math.max(0.0005, r), -L / 2 + t * L * 0.86));
    }
    pts[n].x = 0.0005;
    const g = new THREE.LatheGeometry(pts, 14);
    g.rotateX(HPI); g.scale(D.w, 1, 1);
    // цвет: тёмная спина, светлое брюхо, рисунок
    const back = new THREE.Color(D.back), belly = new THREE.Color(D.belly);
    return paint(g, (x, y, z, c) => {
      const k = ease((y / R) * 1.2 + 0.45);
      c.copy(belly).lerp(back, k);
      if (D.stripes && y > 0 && Math.sin(z * 90 + Math.sin(x * 40) * 2) > 0.55) c.multiplyScalar(0.35);
      if (D.spots && Math.abs(y - R * 0.1) < R * 0.25 && Math.sin(z * 120) > 0.7) c.lerp(new THREE.Color(D.spots), 0.7);
      if (D.dots && hash3(Math.round(x * 300), Math.round(y * 300), Math.round(z * 300)) > 0.86) c.lerp(new THREE.Color(D.dots), 0.8);
      if (D.blotch && hash3(Math.round(x * 25), Math.round(y * 25), Math.round(z * 25)) > 0.6) c.lerp(new THREE.Color(D.blotch), 0.45);
      if (Math.abs(y) < R * 0.08 && D.L > 0.3) c.multiplyScalar(0.85);   // боковая линия
    });
  });
}
function fishBodyLite() {
  const R = 0.014, L = 0.16, pts = [];
  for (let i = 0; i <= 7; i++) { const t = i / 7; pts.push(new THREE.Vector2(Math.max(0.0005, Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.85) * R + (t < 0.1 ? R * 0.15 : 0)), -L / 2 + t * L * 0.86)); }
  pts[7].x = 0.0005;
  const g = new THREE.LatheGeometry(pts, 7); g.rotateX(HPI); g.scale(0.6, 1, 1);
  const back = new THREE.Color(0x2a5a7a), belly = new THREE.Color(0xdce4ea);
  return paint(g, (x, y, z, c) => c.copy(belly).lerp(back, ease((y / R) * 1.2 + 0.45)));
}
const FISHMAT = () => M(0xffffff, { vertexColors: true, roughness: 0.35, metalness: 0.25 });
export function makeFish(species = 'sardine') {
  species = String(species).replace(/^f_/, '');
  const g = new THREE.Group(); g.name = 'fish_' + species;
  if (species === 'octopus') {
    const m = M(0xa85a4a, { roughness: 0.6 }), m2 = M(0xd89a8a, { roughness: 0.6 });
    P(g, sph(0.11, 14, 10), m, 0, 0.13, -0.08, 0.6, 0, 0, 1, 1.35, 1);
    P(g, sph(0.085, 12, 8), m, 0, 0.06, 0.02);
    for (const s of [-1, 1]) { P(g, sph(0.02, 6, 5), M(0xe8d8a0), s * 0.06, 0.1, 0.06); P(g, box(0.02, 0.006, 0.01), M(0x101010), s * 0.06, 0.1, 0.078); }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2, c = Math.cos(a), s = Math.sin(a);
      P(g, tube(`octArm${i}`, [[c * 0.05, 0.03, s * 0.05 + 0.02], [c * 0.18, 0.0, s * 0.18 + 0.02], [c * 0.32 + s * 0.05, 0.02, s * 0.3 - c * 0.05], [c * 0.4 + s * 0.12, 0.05, s * 0.36 - c * 0.12], [c * 0.42 + s * 0.2, 0.03, s * 0.36 - c * 0.2]], 0.028, 0.004, 14, 6), i % 2 ? m : m2);
    }
    return g;
  }
  if (species === 'moray') {
    const L = 1.2, pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([Math.sin(t * PI * 1.6) * 0.08, 0.05, L / 2 - t * L]); }
    const body = G('morayB', () => {
      const tg = tube('moray0', pts, 0.045, 0.012, 30, 10).clone();
      return paint(tg, (x, y, z, c) => { c.set(0x6a5a2a); if (hash3(Math.round(x * 40), Math.round(y * 40), Math.round(z * 40)) > 0.55) c.set(0xc8b050); if (y < 0.03) c.lerp(new THREE.Color(0x9a8a4a), 0.5); });
    });
    P(g, body, FISHMAT());
    P(g, sph(0.05, 10, 8), M(0x6a5a2a), 0, 0.055, L / 2 + 0.02, 0, 0, 0, 0.8, 0.9, 1.4);
    const jw = P(g, box(0.05, 0.012, 0.07), M(0x5a4a22), 0, 0.03, L / 2 + 0.05, 0.25);
    for (const s of [-1, 1]) P(g, sph(0.008, 5, 4), M(0xe8d070), s * 0.03, 0.075, L / 2 + 0.05);
    for (let i = 0; i < 9; i++) { const p = pts[i + 1]; P(g, box(0.004, 0.04, L / 10), M(0x5a4a22), p[0], 0.1, p[2]); }
    return g;
  }
  const D = FISHDEF[species] || FISHDEF.sardine;
  const L = D.L, R = (L * D.d) / 2;
  const yc = R * D.w + 0.0;
  const fm = FISHMAT(), fin = M(darker(D.back, 0.9), { side: THREE.DoubleSide, roughness: 0.5 }), finY = M(D.finlets && D.finlets !== 1 ? D.finlets : darker(D.back, 0.9), { side: THREE.DoubleSide });
  const body = grp(g, 0, R, 0);
  P(body, fishBody(species, D), fm);
  const tailZ = -L / 2;
  // хвостовой плавник
  const tl = grp(body, 0, 0, tailZ + 0.01);
  const ts = L * 0.22;
  const tailPts = D.tail === 'round' ? [[0, -0.15], [0.6, -0.55], [0.95, -0.3], [1.0, 0], [0.95, 0.3], [0.6, 0.55], [0, 0.15]]
    : D.tail === 'crescent' ? [[0, -0.1], [0.5, -0.6], [1.0, -1.1], [0.7, -0.35], [0.6, 0], [0.7, 0.35], [1.0, 1.1], [0.5, 0.6], [0, 0.1]]
      : D.tail === 'hetero' ? [[0, -0.12], [0.6, -0.35], [0.7, -0.15], [1.2, 0.5], [0.4, 0.2], [0, 0.12]]
        : [[0, -0.12], [0.55, -0.5], [0.95, -0.75], [0.6, -0.1], [0.55, 0], [0.6, 0.1], [0.95, 0.75], [0.55, 0.5], [0, 0.12]];
  P(tl, extr(`tail${species}`, tailPts.map(([x, y]) => [x * ts, y * ts]), 0.004, 0), fin, 0, 0, 0, 0, HPI, 0);
  // спинные плавники
  D.dorsal.forEach(([pz, h, len], i) => {
    const z = -L / 2 + pz * L, hh = h * L, ll = len * L;
    P(body, extr(`dors${species}${i}`, [[ll * 0.5, 0], [-ll * 0.5, 0], [-ll * 0.35, hh * 0.3], [ll * 0.15, hh], [ll * 0.35, hh * 0.9]], 0.003, 0), fin, 0, R * 0.85, z, 0, HPI, 0);
  });
  // анальный, брюшные и грудные плавники
  P(body, extr(`anal${species}`, [[L * 0.06, 0], [-L * 0.06, 0], [-L * 0.03, -L * 0.06], [L * 0.03, -L * 0.05]], 0.003, 0), fin, 0, -R * 0.8, -L * 0.18, 0, HPI, 0);
  for (const s of [-1, 1]) {
    const pl = (D.pect || 0.1) * L;
    P(body, extr(`pect${species}`, [[0, 0], [-pl, pl * 0.25], [-pl * 0.9, -pl * 0.1]], 0.003, 0), fin, s * R * D.w * 0.85, -R * 0.2, L * 0.22, -0.3, s > 0 ? -0.5 : PI + 0.5, 0);
    P(body, extr(`pelv${species}`, [[0, 0], [-L * 0.07, L * 0.02], [-L * 0.06, -L * 0.02]], 0.003, 0), fin, s * R * D.w * 0.5, -R * 0.85, L * 0.12, 0.6, s > 0 ? -0.3 : PI + 0.3, 0);
  }
  if (D.finlets) for (let i = 0; i < 5; i++) for (const s of [1, -1]) P(body, cone(L * 0.008, L * 0.025, 3), finY, 0, s * R * (0.4 - i * 0.05), -L * 0.25 - i * L * 0.045, s > 0 ? -0.8 : -PI + 0.8);
  // голова: глаз, жаберная крышка, рот
  const hz = L * 0.3;
  for (const s of [-1, 1]) {
    P(body, sph(R * 0.2, 8, 6), M(0xe8d898), s * R * D.w * 0.72, R * 0.28, hz, 0, 0, 0, 0.5, 1, 1);
    P(body, sph(R * 0.11, 6, 5), M(0x0a0a0a), s * R * D.w * 0.8, R * 0.28, hz + R * 0.02, 0, 0, 0, 0.5, 1, 1);
    P(body, G('gill' + species, () => new THREE.TorusGeometry(R * 0.75, R * 0.03, 3, 10, PI * 0.9)), M(darker(D.back, 0.6)), s * R * D.w * 0.62, -R * 0.05, L * 0.2, 0, s * HPI, -PI * 0.45);
  }
  P(body, box(R * D.w * (D.mouth ? 1.1 : 0.6), R * 0.05, R * 0.35), M(0x3a2020), 0, -R * 0.15, L * 0.36 + R * 0.1);
  if (D.sword) P(body, extr('sword', [[-0.025, 0], [0.025, 0], [0, D.sword]], 0.01, 0.003), M(0x2a2228), 0, R * 0.05, L * 0.36, -HPI, 0, 0);
  if (D.scutes) for (let i = 0; i < 12; i++) { P(body, cone(R * 0.12, R * 0.22, 4), M(0xd8d0b8), 0, R * 0.95, L * 0.32 - i * L * 0.06); for (const s of [-1, 1]) P(body, cone(R * 0.08, R * 0.15, 4), M(0xd8d0b8), s * R * 0.92, 0, L * 0.3 - i * L * 0.06, 0, 0, s * -HPI); }
  if (D.snout) for (let i = 0; i < 4; i++) P(body, cyl(0.003, 0.002, 0.04, 3), M(0xc8b890), (i - 1.5) * 0.012, -R * 0.4, L * 0.38);
  g.userData = { body, tail: tl, species, length: L };
  return g;
}
// косяк: InstancedMesh из маленьких рыбок + рябь на поверхности
let _schoolGeo = null;
export function makeFishSchool(n = 24) {
  const g = new THREE.Group(); g.name = 'fishSchool';
  if (!_schoolGeo) {
    const D = FISHDEF.sardine;
    const b = fishBodyLite();
    const tail = paint(extr('schoolTail', [[0, -0.01], [0.04, -0.035], [0.03, 0], [0.04, 0.035], [0, 0.01]], 0.003, 0).clone().rotateY(HPI).translate(0, 0, -0.07), (x, y, z, c) => c.set(0x4a6a80));
    const parts = [b, tail].map((q) => { const nq = q.index ? q.toNonIndexed() : q; const out = new THREE.BufferGeometry(); out.setAttribute('position', nq.attributes.position); out.setAttribute('normal', nq.attributes.normal); out.setAttribute('color', nq.attributes.color); return out; });
    const pos = [], nor = [], col = [];
    for (const p of parts) { pos.push(...p.attributes.position.array); nor.push(...p.attributes.normal.array); col.push(...p.attributes.color.array); }
    _schoolGeo = new THREE.BufferGeometry();
    _schoolGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    _schoolGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    _schoolGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  const im = new THREE.InstancedMesh(_schoolGeo, FISHMAT(), n);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  const r = rng(n * 7 + 3), fish = [];
  for (let i = 0; i < n; i++) fish.push({ rad: 0.5 + r() * 1.5, ph: r() * TAU, sp: (0.6 + r() * 0.5) * (r() < 0.85 ? 1 : -1), y: -0.3 - r() * 1.2, yw: r() * TAU, s: 0.8 + r() * 0.45 });
  g.add(im);
  const rip = P(g, G('ripple', () => { const q = new THREE.RingGeometry(0.6, 2.4, 32, 1); q.rotateX(-HPI); return q; }), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.12, depthWrite: false }), 0, 0.02, 0);
  rip.castShadow = rip.receiveShadow = false;
  g.userData = { im, fish, ripple: rip };
  animateFishSchool(g, 0);
  return g;
}
const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fp = new THREE.Vector3(), _fs = new THREE.Vector3(), _fe = new THREE.Euler();
export function animateFishSchool(g, t) {
  const u = g.userData; if (!u.im) return;
  const cx = Math.sin(t * 0.21) * 1.6, cz = Math.cos(t * 0.17) * 1.6;
  u.fish.forEach((f, i) => {
    const a = f.ph + t * f.sp * 0.9;
    const rr = f.rad * (1 + 0.15 * Math.sin(t * 0.7 + i));
    _fp.set(cx + Math.cos(a) * rr, clamp(f.y + Math.sin(t * 1.1 + f.yw) * 0.18, -1.5, -0.3), cz + Math.sin(a) * rr);
    const dir = Math.sign(f.sp);
    const yaw = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir) + Math.sin(t * 9 + i) * 0.12;
    _fe.set(Math.sin(t * 1.1 + f.yw) * 0.15, yaw, 0); _fq.setFromEuler(_fe);
    _fs.setScalar(f.s);
    _fm.compose(_fp, _fq, _fs);
    u.im.setMatrixAt(i, _fm);
  });
  u.im.instanceMatrix.needsUpdate = true;
  if (u.ripple) { u.ripple.position.set(cx, 0.02, cz); const k = (t * 0.4) % 1; u.ripple.scale.setScalar(0.7 + k * 0.8); u.ripple.material.opacity = 0.14 * (1 - k); }
}

// ======================================================================
// Предметы на земле
// ======================================================================
const GEAR_SLOT = {
  weapon: ['knife', 'gladius', 'spatha', 'axe', 'hasta', 'bow', 'khopesh', 'falcata', 'rudis', 'pick', 'rod', 'rod_pro', 'torch', 'pilum', 'falx', 'sling', 'trident', 'sica'],
  offhand: ['parma', 'scutum', 'barbshield', 'punicshield', 'caetra'],
  head: ['pileus', 'galea_bronze', 'galea_iron', 'galea_centurio', 'horns', 'punichelm', 'punichelm_gold', 'nemes', 'murmillo', 'thraex'],
  body: ['subarmalis', 'hamata', 'squamata', 'segmentata', 'croc_armor', 'punic_mail', 'fur', 'chief', 'pirate', 'punic', 'punic_gold', 'tunic_punic', 'iberian', 'robber', 'robber_boss', 'glad'],
  legs: ['caligae', 'ocreae', 'ocreae_iron'],
};
const slotOf = (k) => Object.keys(GEAR_SLOT).find((s) => GEAR_SLOT[s].includes(k));
const _box3 = new THREE.Box3(), _bv = new THREE.Vector3();
// уложить объект на землю: центр по XZ в 0, низ на y = 0.01; ограничить размер
function settle(o, maxLen = 1.3) {
  const w = new THREE.Group(); w.add(o);
  w.updateMatrixWorld(true);
  _box3.setFromObject(o); _box3.getSize(_bv);
  const L = Math.max(_bv.x, _bv.y, _bv.z);
  if (L > maxLen) { o.scale.multiplyScalar(maxLen / L); w.updateMatrixWorld(true); _box3.setFromObject(o); }
  const c = _box3.getCenter(new THREE.Vector3());
  o.position.x -= c.x; o.position.z -= c.z; o.position.y -= _box3.min.y - 0.01;
  return w;
}
// уличный факел на столбе (города и дороги)
export function makeTorchPost() {
  const g = new THREE.Group(); g.name = 'torchPost';
  P(g, cyl(0.07, 0.09, 2.5, 6), M(C.woodD), 0, 1.25, 0);
  P(g, box(0.3, 0.12, 0.3), M(C.stone), 0, 0.06, 0);
  P(g, cyl(0.12, 0.08, 0.22, 6), ironM(), 0, 2.58, 0);
  const f = P(g, cone(0.11, 0.42, 6), FLAME(), 0, 2.86, 0); f.castShadow = false;
  const l = new VLight(0xffa040, 26, 22, 1.3); l.position.set(0, 2.9, 0); g.add(l);
  const halo = new THREE.Sprite(torchHaloMat()); halo.scale.set(1.8, 1.8, 1); halo.position.set(0, 2.85, 0); halo.renderOrder = 5; g.add(halo);
  return g;
}
let _haloMat = null;
export function setTorchNight(n) { if (_haloMat) { _haloMat.visible = n > 0.25; _haloMat.opacity = Math.min(1, (n - 0.25) * 1.6); } } // днём ореола нет
function torchHaloMat() {
  if (_haloMat) return _haloMat;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,220,150,1)'); gr.addColorStop(0.25, 'rgba(255,160,60,0.55)'); gr.addColorStop(1, 'rgba(255,120,30,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.premultiplyAlpha = false;
  _haloMat = new THREE.SpriteMaterial({ map: tx, blending: THREE.NormalBlending, depthWrite: false, transparent: true, fog: false, toneMapped: false, alphaTest: 0.01, visible: false });
  return _haloMat;
}
function stripLights(o) { const ls = []; o.traverse((c) => { if (c.isVLight) ls.push(c); }); for (const l of ls) { VLIGHTS.delete(l); l.parent && l.parent.remove(l); } return o; }
function gearDrop(key) {
  const slot = slotOf(key);
  if (slot === 'weapon') {
    const w = buildWeapon(key, 0); if (!w) return null;
    stripLights(w);
    if (key === 'bow') { w.rotation.set(0, 0, HPI); }   // лук лежит плашмя
    else w.rotation.set(-HPI, 0, 0.35);
    if (w.userData.line) w.userData.line.rotation.x = HPI;
    if (key === 'sling') w.children[0].rotation.x = HPI;
    const s = settle(w, 1.25);
    if (key === 'torch') { s.add(P(null, ico(0.03, 0), M(0x2a2a2a), 0, 0.03, 0)); }
    return s;
  }
  if (slot === 'offhand') { const s = buildShield(key, 0); s.rotation.x = -HPI + 0.08; return settle(s, 1.2); }
  if (slot === 'head') { const h = buildHelmet(key, 0); h.rotation.x = -0.15; return settle(h, 0.8); }
  if (slot === 'body') {
    const parts = buildBody(key, 0, {});
    const t = new THREE.Group();
    if (parts.torso) t.add(parts.torso);
    if (parts.hips) { parts.hips.position.y = -0.04; t.add(parts.hips); }
    for (const s of ['L', 'R']) if (parts['arm' + s]) { parts['arm' + s].position.set(s === 'L' ? 0.2 : -0.2, 0.44, 0); t.add(parts['arm' + s]); }
    if (parts.cloak) parts.cloak.rotation.x = 0.2;
    if (parts.bare && !parts.torso) { /* набедренник и пояс гладиатора */ }
    t.rotation.set(-HPI, 0, 0.2);
    return settle(t, 1.2);
  }
  if (slot === 'legs') {
    const parts = buildLegs(key, 0), t = new THREE.Group();
    ['L', 'R'].forEach((s, i) => {
      const leg = grp(t, i ? 0.14 : -0.14, 0, 0);
      if (parts['shin' + s]) leg.add(parts['shin' + s]);
      if (parts['foot' + s]) { parts['foot' + s].position.y = -0.41; leg.add(parts['foot' + s]); }
      leg.rotation.set(-HPI + 0.05, 0, i ? 0.15 : -0.1);
    });
    return settle(t, 0.9);
  }
  return null;
}
const RES_DROP = {
  wood: (g) => { logPile(g, 0, 0, 0, 3, 1.0); rope(g, [-0.35, 0.45, 0.3], [0.35, 0.45, 0.3], 0.02); },
  cedar: (g) => logPile(g, 0, 0, 0, 3, 1.0, 0, 0x8a4a2a),
  stone: (g) => { for (let i = 0; i < 5; i++) P(g, G('dropStone', () => lumpy(new THREE.DodecahedronGeometry(0.16, 0), 0.25, 61)), FOL(i % 2 ? 0xa09684 : 0x8a8272), Math.cos(i * 1.3) * 0.18, 0.12 + (i === 4 ? 0.15 : 0), Math.sin(i * 1.3) * 0.18, i, i * 2, 0); },
  clay: (g) => { P(g, G('dropClay', () => lumpy(new THREE.SphereGeometry(0.28, 10, 6, 0, TAU, 0, HPI), 0.15, 62)), M(C.clay), 0, 0, 0, 0, 0, 0, 1, 0.7, 1); P(g, box(0.25, 0.08, 0.15), M(0xa85a3a), 0.25, 0.04, 0.2, 0, 0.5, 0); },
  hide: (g) => { P(g, cyl(0.16, 0.16, 0.7, 12), M(0x8a6a48), 0, 0.16, 0, 0, 0, HPI); P(g, G('hideFlap', () => { const q = new THREE.PlaneGeometry(0.6, 0.5, 3, 2); q.rotateX(-HPI); return q; }), M(0x9a7a56, { side: THREE.DoubleSide }), 0, 0.02, 0.35); for (const x of [-0.2, 0.2]) P(g, tor(0.165, 0.015, 4, 12), M(C.rope), x, 0.16, 0, 0, HPI, 0); },
  leather: (g) => { P(g, cyl(0.13, 0.13, 0.55, 12), M(0x6a4428), 0, 0.13, 0, 0, 0, HPI); P(g, tor(0.135, 0.012, 4, 12), M(0x3a2414), 0, 0.13, 0, 0, HPI, 0); },
  meat: (g) => { P(g, sph(0.16, 10, 8), M(0xa83a2a), 0, 0.12, 0, 0, 0, 0, 1.3, 0.75, 1); P(g, sph(0.1, 8, 6), M(0xf0e0d0), 0.18, 0.1, 0, 0, 0, 0, 0.6, 0.6, 0.9); P(g, cyl(0.03, 0.035, 0.22, 6), M(0xf0e8dc), -0.25, 0.08, 0, 0, 0, HPI); },
  wheat: (g) => { sack(g, 0, 0, 0, 0.9, 0xd8c08a); for (let i = 0; i < 9; i++) { const s = P(g, cyl(0.008, 0.008, 0.55, 3), M(0xd8b860), 0.35 + (i % 3) * 0.02, 0.06, -0.05 + i * 0.03, 0, 0, HPI - 0.1); P(g, sph(0.02, 4, 3), M(0xe8cc70), 0.62, 0.08, -0.05 + i * 0.03, 0, 0, 0, 2, 1, 1); } },
  olives: (g) => { P(g, cyl(0.22, 0.16, 0.2, 12), M(0xa88a50), 0, 0.1, 0); for (let i = 0; i < 9; i++) P(g, sph(0.035, 6, 4), M(i % 3 ? 0x3a4a1a : 0x1a1a10), Math.cos(i * 1.9) * 0.12, 0.21, Math.sin(i * 1.9) * 0.12, 0, 0, 0, 1.3, 1, 1); },
  grapes: (g) => { P(g, cyl(0.24, 0.18, 0.2, 12), M(0xa88a50), 0, 0.1, 0); for (let i = 0; i < 14; i++) P(g, sph(0.035, 6, 4), M(0x4a1a4a), Math.cos(i * 2.3) * (0.05 + (i % 3) * 0.04), 0.22 + (i % 2) * 0.03, Math.sin(i * 2.3) * (0.05 + (i % 3) * 0.04)); P(g, box(0.08, 0.01, 0.1), M(0x4a7a2a), 0.1, 0.27, 0.05, 0.2, 0.4, 0); },
  iron_ore: (g) => { for (let i = 0; i < 4; i++) P(g, G('ore1', () => lumpy(new THREE.DodecahedronGeometry(0.17, 0), 0.3, 63)), FOL(i % 2 ? 0x6a5a50 : 0x8a4a2a), Math.cos(i * 1.6) * 0.16, 0.13, Math.sin(i * 1.6) * 0.16, i, i, 0); },
  silver_ore: (g) => { for (let i = 0; i < 4; i++) P(g, G('ore2', () => lumpy(new THREE.DodecahedronGeometry(0.17, 0), 0.3, 64)), FOL(0x8a8e94), Math.cos(i * 1.6) * 0.16, 0.13, Math.sin(i * 1.6) * 0.16, i, i, 0); for (let i = 0; i < 6; i++) P(g, oct(0.03), MET(0xe8ecf0, 0.15, 1), Math.cos(i * 2.2) * 0.2, 0.25, Math.sin(i * 2.2) * 0.2); },
  marble: (g) => { P(g, rbox(0.6, 0.35, 0.4, 0.03), M(0xf2efe8), 0, 0.18, 0); P(g, box(0.62, 0.01, 0.02), M(0xb8b4a8), 0, 0.2, 0.2, 0, 0, 0.3); },
  murex: (g) => { for (let i = 0; i < 5; i++) { const s = grp(g, Math.cos(i * 1.3) * 0.15, 0.05, Math.sin(i * 1.3) * 0.15, 0, i, 0.3); P(s, cone(0.06, 0.18, 8), M(0xd8b8a0), 0, 0.04, 0, 0, 0, HPI); for (let k = 0; k < 4; k++) P(s, cone(0.012, 0.04, 4), M(0xb89880), -0.04 + k * 0.03, 0.08, 0); P(s, sph(0.03, 6, 4), M(0x7a3a6a), 0.08, 0.03, 0); } },
  papyrus: (g) => { const s = grp(g, 0, 0.06, 0, 0, 0.4, 0); P(s, cyl(0.055, 0.055, 0.42, 12), M(0xe8d8a8), 0, 0, 0, 0, 0, HPI); for (const x of [-0.23, 0.23]) P(s, cyl(0.015, 0.015, 0.1, 6), M(C.woodD), x, 0, 0, 0, 0, HPI); P(s, G('scrollFlap', () => { const q = new THREE.PlaneGeometry(0.4, 0.3, 1, 3); q.rotateX(-HPI); return q; }), M(0xeee0b4, { side: THREE.DoubleSide }), 0, -0.05, 0.18); P(s, tor(0.057, 0.006, 3, 10), M(0x9a2a22), 0, 0, 0, 0, HPI, 0); },
  linen: (g) => { for (let i = 0; i < 3; i++) P(g, rbox(0.5, 0.07, 0.35, 0.025), M(i % 2 ? 0xe8e0cc : 0xdcd2bc), 0, 0.04 + i * 0.07, 0, 0, i * 0.08, 0); },
  bandage: (g) => { for (let i = 0; i < 3; i++) P(g, cyl(0.06, 0.06, 0.1, 12), M(0xf0eadc), (i - 1) * 0.15, 0.06, 0, 0, 0, HPI); },
  plank: (g) => { for (let i = 0; i < 4; i++) P(g, box(0.18, 0.04, 1.0), M(0xc09060), (i % 2 - 0.5) * 0.2, 0.03 + Math.floor(i / 2) * 0.045, 0, 0, (i % 2) * 0.05, 0); },
  brick: (g) => { for (let i = 0; i < 6; i++) P(g, box(0.3, 0.07, 0.15), M(i % 2 ? 0xb2603c : 0xa85434), (i % 2 - 0.5) * 0.31, 0.04 + Math.floor(i / 2) * 0.075, 0, 0, Math.floor(i / 2) % 2 ? HPI : 0, 0); },
  iron: (g) => { for (let i = 0; i < 3; i++) P(g, G('ingot', () => new THREE.CylinderGeometry(0.11, 0.14, 0.07, 4, 1)), MET(0x7a8088, 0.45, 0.85), (i - 1) * 0.12, 0.04 + (i === 1 ? 0.07 : 0), 0, 0, PI / 4, 0, 1.4, 1, 0.7); },
  silver: (g) => { for (let i = 0; i < 3; i++) P(g, G('ingot', () => new THREE.CylinderGeometry(0.11, 0.14, 0.07, 4, 1)), MET(0xdde2e8, 0.15, 1), (i - 1) * 0.12, 0.04 + (i === 1 ? 0.07 : 0), 0, 0, PI / 4, 0, 1.4, 1, 0.7); },
  gold: (g) => { for (let i = 0; i < 3; i++) P(g, G('ingot', () => new THREE.CylinderGeometry(0.11, 0.14, 0.07, 4, 1)), goldM(), (i - 1) * 0.12, 0.04 + (i === 1 ? 0.07 : 0), 0, 0, PI / 4, 0, 1.4, 1, 0.7); for (let i = 0; i < 5; i++) P(g, cyl(0.03, 0.03, 0.008, 10), goldM(), Math.cos(i * 1.7) * 0.25, 0.005, Math.sin(i * 1.7) * 0.2, 0.1, 0, 0.1); },
  purple: (g) => { P(g, lathe('dyeJar', [[0, 0], [0.12, 0], [0.16, 0.12], [0.1, 0.22], [0.1, 0.26], [0, 0.26]], 12), M(0xc8a080)); P(g, cyl(0.095, 0.095, 0.01, 12), M(0x5a1a5a, { roughness: 0.3 }), 0, 0.25, 0); P(g, rbox(0.4, 0.05, 0.3, 0.02), M(0x6a1a6a), 0.3, 0.025, 0.1, 0, 0.4, 0); },
  bread: (g) => { for (let i = 0; i < 3; i++) { const b = grp(g, (i - 1) * 0.24, 0.0, (i % 2) * 0.1); P(b, sph(0.11, 12, 8), M(0xb87a3a), 0, 0.05, 0, 0, 0, 0, 1, 0.5, 1); for (let k = 0; k < 4; k++) P(b, box(0.21, 0.012, 0.01), M(0x7a4a1a), 0, 0.09, 0, 0, (k * PI) / 4, 0); } },
  oil: (g) => { amphora(g, 0, 0, 0, 1.1, 0xb87a48, 0); P(g, cyl(0.04, 0.04, 0.03, 8), M(0x6a7a2a), 0, 0.64, 0); },
  wine: (g) => { amphora(g, 0, 0, 0, 1.1, 0x9a4a2a, 0); P(g, cyl(0.04, 0.04, 0.04, 8), M(0x6a1a2a), 0, 0.65, 0); },
  amphora: (g) => { const a = amphora(g, 0, 0.2, 0, 1.1, C.terracotta, HPI); a.rotation.z = 0.0; },
  arrow: (g) => { for (let i = 0; i < 6; i++) { const a = makeArrow(); a.rotation.y = (i - 2.5) * 0.06; a.position.set((i - 2.5) * 0.03, 0.02 + (i % 2) * 0.02, 0); g.add(a); } rope(g, [-0.1, 0.05, 0.1], [0.1, 0.05, 0.1], 0.012); },
  pilum: (g) => { for (let i = 0; i < 2; i++) { const p = makePilum(); p.scale.setScalar(0.6); p.position.set((i - 0.5) * 0.12, 0.03, 0); p.rotation.y = (i - 0.5) * 0.1; g.add(p); } },
  gem: (g) => { [0xc02040, 0x2a6ad8, 0x20a060, 0xa040d0, 0xe8e0f0].forEach((c, i) => P(g, oct(0.05), M(c, { metalness: 0.2, roughness: 0.1, emissive: c, emissiveIntensity: 0.25 }), Math.cos(i * 1.3) * 0.08, 0.05, Math.sin(i * 1.3) * 0.08, i, i, 0, 1, 1.3, 1)); P(g, G('gemPouch', () => lumpy(new THREE.SphereGeometry(0.1, 8, 6), 0.1, 3)), M(0x6a3a22), -0.18, 0.08, 0.05, 0, 0, 0, 1, 0.8, 1); },
  artifact: (g) => { const u = grp(g, -0.1, 0, 0); P(u, box(0.08, 0.26, 0.06), M(0x2a8a7a), 0, 0.13, 0); P(u, sph(0.05, 8, 6), M(0x2a8a7a), 0, 0.3, 0); P(u, box(0.1, 0.12, 0.07), M(0x1f3f8a), 0, 0.29, -0.02); P(g, lathe('canopic', [[0, 0], [0.08, 0], [0.11, 0.1], [0.08, 0.2], [0.07, 0.22], [0, 0.22]], 12), M(0xe8dcc0), 0.15, 0, 0.05); P(g, sph(0.065, 8, 6), goldM(), 0.15, 0.27, 0.05); },
  denarii: (g) => { const r = rng(9); for (let i = 0; i < 18; i++) { const st = i < 10; P(g, cyl(0.035, 0.035, 0.008, 12), MET(i % 4 ? 0xd8dce0 : 0xd8b040, 0.25, 1), st ? 0.02 * Math.sin(i) : (r() - 0.5) * 0.35, st ? 0.004 + i * 0.008 : 0.004, st ? 0.02 * Math.cos(i) : (r() - 0.5) * 0.3, st ? 0 : r() * 0.3, 0, st ? 0 : r() * 0.3); } P(g, G('purse', () => lumpy(new THREE.SphereGeometry(0.11, 8, 6), 0.12, 4)), M(0x7a4a2a), 0.18, 0.08, 0.1, 0, 0, 0, 1, 0.85, 1); },
};
export function makeItemDrop(key) {
  const g = new THREE.Group(); g.name = 'drop_' + key;
  if (key && key.startsWith && key.startsWith('f_')) {
    const f = makeFish(key.slice(2));
    const L = f.userData.length || 0.5;
    f.rotation.z = HPI;
    const s = settle(f, Math.min(1.3, Math.max(0.35, L)));
    g.add(s); return g;
  }
  const gd = gearDrop(key);
  if (gd) { g.add(gd); return g; }
  const fn = RES_DROP[key];
  if (fn) fn(g); else crate(g, 0, 0, 0, 0.6);
  return g;
}

// ======================================================================
// Снаряды
// ======================================================================
export function makeArrow() {
  const g = new THREE.Group(); g.name = 'arrow';
  P(g, cyl(0.006, 0.006, 0.75, 5), M(0xc8a878), 0, 0, 0, HPI);
  P(g, cone(0.014, 0.06, 4), steelM(), 0, 0, 0.4, HPI);
  for (let i = 0; i < 3; i++) P(g, box(0.002, 0.03, 0.09), M(i ? 0xe8e0d0 : 0x9a2a22), 0, 0, -0.32, 0, 0, (i * TAU) / 3);
  g.children.slice(2).forEach((f, i) => { f.position.set(Math.sin((i * TAU) / 3) * 0.012, Math.cos((i * TAU) / 3) * 0.012, -0.32); });
  return noShadow(g);
}
export function makePilum() {
  const g = new THREE.Group(); g.name = 'pilum';
  const w = buildWeapon('pilum', 0); w.rotation.x = HPI; w.position.z = -0.25; g.add(w);
  return g;
}
export function makeSlingStone() {
  const g = new THREE.Group(); g.name = 'slingStone';
  P(g, sph(0.025, 8, 6), MET(0x8a8a90, 0.5, 0.6), 0, 0, 0, 0, 0, 0, 0.8, 0.8, 1.4);   // свинцовая «глянда»
  return g;
}

// ======================================================================
// Точки интереса
// ======================================================================
function tent(par, x, z, ry = 0, col = 0xc8b08a, s = 1) {
  const t = grp(par, x, 0, z, 0, ry, 0);
  const m = M(col, { side: THREE.DoubleSide });
  for (const sd of [-1, 1]) P(t, box(0.04, 1.75 * s, 2.6 * s), m, sd * 0.62 * s, 0.75 * s, 0, 0, 0, sd * 0.62);
  P(t, extr('tentEnd', [[-1.22, 0], [1.22, 0], [0, 1.45]], 0.03, 0), M(darker(col, 0.9)), 0, 0, -1.28 * s, 0, 0, 0).scale.setScalar(s);
  P(t, cyl(0.03, 0.03, 2.8 * s, 5), M(C.woodD), 0, 1.47 * s, 0, HPI);
  for (const sz of [-1, 1]) P(t, cyl(0.03, 0.03, 1.5 * s, 5), M(C.woodD), 0, 0.73 * s, sz * 1.35 * s);
  for (const sd of [-1, 1]) for (const sz of [-1, 1]) rope(t, [sd * 1.2 * s, 0.05, sz * 1.5 * s], [sd * 0.3 * s, 1.3 * s, sz * 1.3 * s], 0.008);
  return t;
}
function campfire(par, x, z, i = 8, d = 14) {
  const fp = grp(par, x, 0, z);
  for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU; P(fp, G('fireStone', () => lumpy(new THREE.DodecahedronGeometry(0.17, 0), 0.25, 71)), FOL(0x8a8478), Math.cos(a) * 0.6, 0.08, Math.sin(a) * 0.6, k, k, 0); }
  for (let k = 0; k < 4; k++) P(fp, cyl(0.05, 0.06, 0.9, 5), M(0x3a2a1a), 0, 0.15, 0, HPI, (k * PI) / 4, 0.35);
  P(fp, ico(0.2, 0), EMB(), 0, 0.08, 0, 0, 0, 0, 1, 0.4, 1);
  P(fp, cone(0.32, 0.85, 7), FLAME(), 0, 0.5, 0).castShadow = false;
  P(fp, cone(0.17, 0.55, 6), FLAME2(), 0, 0.38, 0).castShadow = false;
  const l = new VLight(0xff9a40, i, d, 1.6); l.position.set(0, 1.0, 0); fp.add(l);
  return fp;
}
function hut(par, x, z, r = 2.2, ry = 0) {
  const h = grp(par, x, 0, z, 0, ry, 0);
  P(h, cyl(r, r * 1.03, 3.2, 14), M(0x9a8462), 0, 0.1, 0);       // стена (плетень с обмазкой), уходит в землю
  for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; P(h, cyl(0.06, 0.07, 1.8, 5), M(0x5a4430), Math.cos(a) * (r + 0.02), 0.7, Math.sin(a) * (r + 0.02)); }
  P(h, G(`hutRoof${r}`, () => wuv(lumpy(new THREE.ConeGeometry(r + 0.6, 2.8, 14, 2), 0.04, 3))), THATCH(), 0, 3.0, 0);
  P(h, box(1.0, 1.4, 0.2), M(0x1a120c), 0, 0.7, r - 0.02);
  P(h, cyl(0.15, 0.1, 0.4, 6), M(0x6a5a40), 0.2, 4.5, 0);
  return h;
}
const POI = {};
POI.start_camp = (g) => {
  tent(g, -3.5, -2.5, 0.3); tent(g, 0.5, -4.2, -0.1, 0xb8a07a); tent(g, 4.0, -2.0, -0.5);
  campfire(g, 0, 0);
  const tri = grp(g, 0, 0, 0); for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; const l = P(tri, cyl(0.025, 0.025, 1.7, 5), M(C.woodD), Math.cos(a) * 0.45, 0.8, Math.sin(a) * 0.45); l.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); }
  P(tri, lathe('pot2', [[0, 0], [0.18, 0.02], [0.22, 0.15], [0.18, 0.28], [0, 0.28]], 12), ironM(), 0, 0.75, 0); rope(tri, [0, 1.55, 0], [0, 1.03, 0], 0.01);
  for (const [x, z, r] of [[-1.6, 1.2, 0.3], [1.5, 1.4, -0.4], [-0.2, 2.0, 1.2]]) { P(g, cyl(0.2, 0.22, 1.4, 8), M(0x7a5534), x, 0.2, z, 0, r, HPI); g.userData.colliders.push({ x, z, r: 0.5 }); }
  for (let i = 0; i < 3; i++) crate(g, 5.5 + (i % 2) * 0.9, i === 2 ? 0.6 : 0, 1.5, 1, 0.2 * i);
  for (let i = 0; i < 4; i++) sack(g, -5.5 + (i % 2) * 0.55, 0, 1.6 + Math.floor(i / 2) * 0.5, 1, 0xd2be92, i);
  for (let i = 0; i < 3; i++) amphora(g, -5.6 + i * 0.45, 0, 3.0);
  banner(g, 2.0, 0, -0.6, 3.6);
  g.userData.colliders.push({ x: -3.5, z: -2.5, w: 2.6, d: 2.9, ry: 0.3 }, { x: 0.5, z: -4.2, w: 2.6, d: 2.9, ry: -0.1 }, { x: 4.0, z: -2.0, w: 2.6, d: 2.9, ry: -0.5 }, { x: 6, z: 1.5, w: 2, d: 1, ry: 0 });
};
// причал в бухте: настил на сваях, лодка у причала (y=0 — уровень моря)
POI.pier = (g) => {
  const wood = M(0x8a6a44), dark = M(0x5a4228), deckY = 1.15;
  for (let z = -4; z <= 16; z += 1.1) P(g, box(2.8, 0.1, 1.0), z % 2.2 < 1.1 ? wood : M(0x7e6040), 0, deckY, z);
  for (const sx of [-1.3, 1.3]) {
    P(g, box(0.16, 0.16, 20.4), dark, sx, deckY - 0.14, 6);
    for (let z = -3; z <= 16; z += 2.5) { P(g, cyl(0.12, 0.14, 4.6, 7), dark, sx, deckY - 2.2, z); }
  }
  for (const [x, z] of [[1.3, 15.5], [-1.3, 15.5], [1.3, 9]]) { P(g, cyl(0.13, 0.13, 0.9, 8), dark, x, deckY + 0.45, z); P(g, tor(0.14, 0.03, 5, 10), M(C.rope), x, deckY + 0.6, z, HPI); }
  rope(g, [1.3, deckY + 0.6, 9], [2.6, 0.5, 10], 0.015);
  for (let i = 0; i < 2; i++) crate(g, -0.6 + i * 0.9, deckY + 0.05, 13.5, 0.8, i * 0.3);
  P(g, cyl(0.25, 0.25, 0.8, 10), M(0x7a5534), 0.6, deckY + 0.45, 2.5);
};
// дым над кратером вулкана (анимируется в клиенте через userData.smoke)
POI.volcano = (g) => {
  const sm = new THREE.Group(); sm.name = 'smoke'; g.add(sm); g.userData.smoke = sm;
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: i < 3 ? 0x6a625c : 0x9a948e, transparent: true, opacity: 0.5 - i * 0.035, depthWrite: false });
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat);
    const k = 6 + i * 2.6; m.scale.set(k, k * 0.7, k); m.position.set(Math.sin(i * 1.7) * i * 1.4, 6 + i * 7, Math.cos(i * 2.3) * i * 1.4);
    m.userData.base = m.position.clone(); m.userData.k = k; m.castShadow = false; m.receiveShadow = false;
    sm.add(m);
  }
  const glow = new VLight(0xff6a2a, 40, 60, 1.6); glow.position.set(0, 3, 0); g.add(glow);
};
POI.barb_camp = (g) => {
  const R = 15, N = 64, gateHalf = 0.13;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, d = Math.abs(((a - HPI + PI) % TAU + TAU) % TAU - PI);
    if (d < gateHalf) continue;
    for (let k = 0; k < 2; k++) { const aa = a + (k - 0.5) * (TAU / N / 2), h = 3.4 + ((i * 7 + k) % 3) * 0.25; P(g, cyl(0.13, 0.15, h + 1, 6), M(k ? 0x6a5034 : 0x7a5a3a), Math.cos(aa) * R, h / 2 - 0.5, Math.sin(aa) * R); P(g, cone(0.13, 0.35, 6), M(0x5a4028), Math.cos(aa) * R, h + 0.17, Math.sin(aa) * R); }
    g.userData.colliders.push({ x: +(Math.cos(a) * R).toFixed(2), z: +(Math.sin(a) * R).toFixed(2), w: 0.5, d: +((TAU * R) / N + 0.15).toFixed(2), ry: +(-a).toFixed(3) });
  }
  P(g, cyl(0.06, 0.06, TAU * R, 4), M(0x5a4430), 0, 0, 0).visible = false;
  for (const s of [-1, 1]) { const a = HPI + s * gateHalf * 1.15; P(g, cyl(0.22, 0.26, 5.5, 7), M(0x5a3a22), Math.cos(a) * R, 2.2, Math.sin(a) * R); P(g, sph(0.25, 8, 6), M(0xe8e0cc), Math.cos(a) * R, 5.1, Math.sin(a) * R, 0, 0, 0, 1, 0.8, 1.3); }
  P(g, box(4.6, 0.35, 0.35), M(0x5a3a22), 0, 4.4, R);
  for (const s of [-1, 1]) { const lf = grp(g, s * 1.9, 0, R - 0.2, 0, s * -1.1, 0); for (let k = 0; k < 5; k++) P(lf, cyl(0.1, 0.11, 3.2, 6), M(0x6a4a2e), -s * (0.2 + k * 0.32), 1.6, 0); P(lf, box(1.7, 0.12, 0.12), M(0x4a3420), -s * 0.85, 2.5, 0.1); P(lf, box(1.7, 0.12, 0.12), M(0x4a3420), -s * 0.85, 0.7, 0.1); }
  // хижины
  const huts = [[-7, -4, 2.4, 0.9], [6, -6, 2.6, -0.8], [-2, -9, 2.2, 0.1], [8, 3, 2.0, -1.8], [-8.5, 4, 2.0, 2.0]];
  for (const [x, z, r, ry] of huts) { hut(g, x, z, r, ry); g.userData.colliders.push({ x, z, r: r + 0.1 }); }
  campfire(g, 0, 0, 10, 16);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; P(g, cyl(0.2, 0.22, 1.3, 8), M(0x6a4a2e), Math.cos(a) * 2.2, 0.2, Math.sin(a) * 2.2, 0, -a, HPI); }
  // резной столб с рогами оленя
  const tp = grp(g, 2.5, 0, -3.5);
  P(tp, cyl(0.28, 0.32, 6, 8), M(0x6a4a30), 0, 2.5, 0);
  for (let i = 0; i < 4; i++) P(tp, cyl(0.31, 0.31, 0.25, 8), M([0x8a2a1a, 0xc8a050, 0x2a4a6a, 0xe8e0cc][i]), 0, 1.2 + i * 1.1, 0);
  for (const s of [-1, 1]) P(tp, tube(`totAnt${s}`, [[s * 0.15, 5.4, 0], [s * 0.5, 5.8, 0], [s * 0.7, 6.3, 0.1], [s * 0.6, 6.7, 0.2]], 0.05, 0.02, 6, 5), M(0xd8c8a0));
  P(tp, sph(0.25, 8, 6), M(0xe8e0cc), 0, 5.6, 0.2, 0, 0, 0, 0.8, 0.9, 1.3);
  g.userData.colliders.push({ x: 2.5, z: -3.5, r: 0.4 });
  // рамы со шкурами
  for (const [x, z, ry] of [[-4, 7, 0.4], [3.5, 8.5, -0.3], [-10, -1, 1.4]]) {
    const r = grp(g, x, 0, z, 0, ry, 0);
    for (const s of [-1, 1]) P(r, cyl(0.05, 0.06, 2.6, 5), M(0x5a4028), s * 0.9, 1.1, 0);
    P(r, cyl(0.04, 0.04, 2.0, 5), M(0x5a4028), 0, 2.0, 0, 0, 0, HPI); P(r, cyl(0.04, 0.04, 2.0, 5), M(0x5a4028), 0, 0.4, 0, 0, 0, HPI);
    P(r, G('hideRack', () => { const s = new THREE.Shape(); s.moveTo(-0.7, -0.6); s.quadraticCurveTo(-0.9, 0, -0.7, 0.6); s.lineTo(0.7, 0.6); s.quadraticCurveTo(0.9, 0, 0.7, -0.6); s.closePath(); return new THREE.ShapeGeometry(s, 4); }), M(0x8a6a48, { side: THREE.DoubleSide }), 0, 1.2, 0.02);
    g.userData.colliders.push({ x, z, w: 2.0, d: 0.4, ry });
  }
  for (let i = 0; i < 4; i++) P(g, cyl(0.03, 0.03, 2.2, 5), M(0x6a5a40), 9.5 + i * 0.2, 1.0, -2 + (i % 2) * 0.1, 0.1 * i - 0.15, 0, 0.12);
  logPile(g, -3, 0, 10.5, 6, 2.0, 0.3);
  for (let i = 0; i < 3; i++) { const sh = buildShield('barbshield', 0); sh.position.set(-11 + i * 0.7, 0.5, 6.5); sh.rotation.set(-0.3, 0.6, 0); g.add(sh); }
};
POI.pyramid = (g) => {
  const sm = TM('ashlar', 0xe8cc94), N = 6, base = 22, hgt = 2.4;
  for (let i = 0; i < N; i++) {
    const s = base - i * (base / (N + 0.5)), y0 = i * hgt;
    P(g, tbox(s, hgt + (i === 0 ? 1.5 : 0), s), sm, 0, y0 + hgt / 2 - (i === 0 ? 0.75 : 0), 0);
    P(g, box(s + 0.12, 0.12, s + 0.12), M(0xd8bc84), 0, y0 + hgt - 0.06, 0);
  }
  P(g, G('pyrCap', () => new THREE.ConeGeometry(2.2, 1.6, 4)), goldM(), 0, N * hgt + 0.8, 0, 0, PI / 4, 0);
  // вход и заупокойная часовня
  P(g, box(2.0, 2.6, 0.2), M(0x1a140e), 0, 1.3, base / 2 + 0.02);
  for (const s of [-1, 1]) P(g, box(0.5, 3.0, 0.6), sm, s * 1.25, 1.5, base / 2 + 0.2);
  P(g, box(3.2, 0.6, 0.8), sm, 0, 3.2, base / 2 + 0.2);
  for (const s of [-1, 1]) { const ob = grp(g, s * 3.5, 0, base / 2 + 3); P(ob, box(0.9, 0.5, 0.9), M(0xd8bc84), 0, 0.25, 0); P(ob, cyl(0.2, 0.35, 4.5, 4), M(0xc89a7a), 0, 2.75, 0, 0, PI / 4, 0); P(ob, cone(0.2, 0.4, 4), goldM(), 0, 5.2, 0, 0, PI / 4, 0); g.userData.colliders.push({ x: s * 3.5, z: base / 2 + 3, r: 0.6 }); }
  g.userData.colliders.push({ x: 0, z: 0, w: base, d: base, ry: 0 });
};
POI.obelisk = (g) => {
  P(g, tbox(2.6, 2.3, 2.6), TM('ashlar', 0xd8c49a), 0, -0.35, 0);
  P(g, box(2.0, 0.6, 2.0), M(0xc8b48a), 0, 1.1, 0);
  const sh = P(g, G('obeliskG', () => { const q = new THREE.CylinderGeometry(0.55, 0.85, 11, 4, 1); q.rotateY(PI / 4); return q; }), M(0xb8786a), 0, 6.9, 0);
  P(g, G('obeliskTip', () => { const q = new THREE.ConeGeometry(0.55 * Math.SQRT1_2 * 1.41, 1.0, 4); q.rotateY(PI / 4); return q; }), goldM(), 0, 12.9, 0);
  // колонка знаков на гранях
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; for (let k = 0; k < 9; k++) P(g, box(0.18, 0.2, 0.02), M(0x7a4a3a), Math.sin(a) * (0.82 - k * 0.026), 2.3 + k * 1.05, Math.cos(a) * (0.82 - k * 0.026), -Math.cos(a) * 0.027, a, 0); }
  g.userData.colliders.push({ x: 0, z: 0, w: 2.6, d: 2.6, ry: 0 });
};
POI.sphinx = (g) => {
  const sm = M(0xd8bc84), s2 = M(0xc8ac74);
  P(g, tbox(3.4, 2.3, 7.4), TM('ashlar', 0xe0c890), 0, -0.35, 0);
  P(g, rbox(2.2, 1.6, 4.4, 0.3), sm, 0, 1.6, -0.6);
  P(g, sph(1.1, 12, 8), sm, 0, 1.75, -2.4, 0, 0, 0, 1, 0.8, 1.1);
  for (const s of [-1, 1]) { P(g, rbox(0.55, 0.5, 2.4, 0.15), s2, s * 0.65, 1.05, 1.9); P(g, rbox(0.6, 0.3, 0.6, 0.1), s2, s * 0.65, 0.95, 3.0); P(g, rbox(0.5, 0.9, 1.4, 0.2), s2, s * 1.0, 1.2, -2.6); }
  P(g, cyl(0.45, 0.6, 1.4, 12), sm, 0, 2.7, 1.0, -0.2);
  const h = grp(g, 0, 3.3, 1.3);
  P(h, sph(0.5, 14, 10), sm, 0, 0.25, 0, 0, 0, 0, 0.85, 1.0, 0.9);
  P(h, box(0.16, 0.3, 0.2), sm, 0, 0.2, 0.45, -0.2);
  for (const sx of [-1, 1]) { P(h, box(0.5, 1.1, 0.3), TM('nemes', 0xe8d8a8), sx * 0.48, -0.2, 0.1, 0, 0, sx * 0.12); P(h, box(0.12, 0.05, 0.03), M(0x3a3020), sx * 0.15, 0.36, 0.44); }
  P(h, lathe('sphNemes', [[0.58, -0.05], [0.56, 0.3], [0.4, 0.62], [0.0, 0.72]], 14), TM('nemes', 0xe8d8a8), 0, 0.0, -0.05, -0.1);
  P(h, box(0.18, 0.4, 0.15), sm, 0, -0.35, 0.36);
  P(h, cyl(0.04, 0.05, 0.25, 6), goldM(), 0, 0.7, 0.42, -0.3);
  g.userData.colliders.push({ x: 0, z: 0, w: 3.4, d: 7.4, ry: 0 });
};
POI.ruin = (g) => {
  const st = M(0xe6e0d0), st2 = M(0xd0c8b4);
  P(g, tbox(12, 2.2, 8), TM('ashlar', 0xe8e2d4), 0, -0.4, 0);
  for (let i = 0; i < 2; i++) P(g, box(12.6 + i * 0.8, 0.35, 8.6 + i * 0.8), st2, 0, 0.17 - i * 0.35 + 0.35, 0);
  const cols = [[-5, -3, 1], [-3, -3, 0.45], [-1, -3, 1], [1, -3, 1], [3, -3, 0.3], [5, -3, 0.75], [-5, 3, 0.6], [-1, 3, 0.2], [3, 3, 1], [5, 3, 1], [-5, 0, 0.35], [5, 0, 0.9]];
  for (const [x, z, h] of cols) {
    const hh = 6 * h;
    const c = grp(g, x, 0.7, z);
    P(c, box(0.95, 0.25, 0.95), st, 0, 0.12, 0);
    const n = Math.max(1, Math.round(hh / 1.2));
    for (let k = 0; k < n; k++) { const sh = P(c, cyl(0.36, 0.38, hh / n - 0.02, 12), st, 0, 0.25 + (k + 0.5) * (hh / n), 0, (k === n - 1 && h < 1) ? 0.15 : 0, k * 0.3, 0); }
    if (h >= 1) { P(c, cyl(0.48, 0.36, 0.3, 12), st, 0, 0.25 + hh + 0.15, 0); P(c, box(1.0, 0.25, 1.0), st, 0, 0.25 + hh + 0.42, 0); }
    g.userData.colliders.push({ x, z, r: 0.5 });
  }
  P(g, box(4.4, 0.7, 1.0), st, 2.0, 7.95, -3);   // уцелевший кусок архитрава
  P(g, box(2.2, 0.7, 1.0), st, 4.0, 7.95, 3);
  // упавшие барабаны колонн и блоки
  for (let i = 0; i < 6; i++) P(g, cyl(0.37, 0.37, 1.1, 12), st2, -3 + i * 1.15, 0.37, 5.7 + Math.sin(i) * 0.3, 0, 0.3 + i * 0.05, HPI);
  for (let i = 0; i < 7; i++) P(g, rbox(1.0, 0.6, 0.7, 0.06), st2, -6 + (i % 4) * 1.6, 0.3 + Math.floor(i / 4) * 0.6, -5.4 + (i % 2) * 0.3, 0.05 * i, i * 0.4, 0.04 * i);
  g.userData.colliders.push({ x: 0.3, z: 5.7, w: 7.2, d: 0.9, ry: 0 }, { x: -3.6, z: -5.3, w: 6.6, d: 1.0, ry: 0 });
  for (let i = 0; i < 5; i++) { const b = makeBush(i % 2 ? 'dry' : 'med'); b.position.set(-6 + i * 3, 0, (i % 2 ? 4.5 : -4.6)); b.scale.setScalar(0.8); g.add(b); }
};
POI.shipwreck = (g) => {
  const c = { ...SHIPDEF.corbita, L: 13 };
  const hull = P(g, hullGeo('wreck', c, 20, 8), TM('plank', 0x9a8a70, { side: THREE.DoubleSide }), 0, 0.2, 0, 0.1, 0.3, 0.45);
  // проломленный борт: торчащие шпангоуты
  for (let i = 0; i < 6; i++) P(g, G('wRib', () => new THREE.TorusGeometry(1.6, 0.09, 4, 8, PI * 0.5)), M(0x5a4a38), -1.6 + i * 0.25, 1.0, -2 + i * 0.9, 0, 0.3 + HPI, 0);
  P(g, cyl(0.15, 0.2, 7, 7), M(0x4a3a2a), 3.2, 0.25, -1.5, 0, 0.7, HPI);
  P(g, cyl(0.08, 0.08, 4, 6), M(0x4a3a2a), 3.6, 0.15, 1.5, 0, -0.4, HPI);
  for (let i = 0; i < 8; i++) P(g, box(0.25, 0.05, 1.8 + (i % 3) * 0.6), M(0x6a5a44), -4 + (i % 4) * 2.4, 0.03, 4 + Math.floor(i / 4) * 1.5, 0, i * 0.7, 0);
  for (let i = 0; i < 5; i++) { const a = amphora(g, -4.5 + i * 1.2, 0.2, 2.6 + (i % 2) * 0.6, 1, C.terracotta, HPI * 0.95); a.rotation.y = i; }
  P(g, G('wreckSand', () => lumpy(new THREE.SphereGeometry(4, 12, 6, 0, TAU, 0, HPI), 0.1, 3)), M(C.sand), -0.5, -0.6, 0.5, 0, 0, 0, 1.6, 0.35, 1.0);
  P(g, G('sailRag', () => { const q = new THREE.PlaneGeometry(3, 2, 4, 3); const p = q.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2) * 0.2); q.rotateX(-HPI + 0.1); return q; }), M(0xb8a888, { side: THREE.DoubleSide }), 4.5, 0.15, 0.5, 0, 0.6, 0);
  g.userData.colliders.push({ x: 0, z: 0, w: 4.5, d: 12, ry: 0.3 });
};
POI.cave_entrance = (g) => {
  const rk = FOL(0x8a8070), rk2 = FOL(0x7a7062);
  const r = rng(81);
  for (let i = 0; i < 14; i++) {
    const a = PI * 0.78 + (i / 13) * PI * 1.44, rr = 5 + r() * 1.5;
    const s = 2 + r() * 1.6;
    P(g, G(`caveRock${i % 4}`, () => lumpy(new THREE.DodecahedronGeometry(1, 0), 0.3, 90 + i % 4)), i % 2 ? rk : rk2, Math.cos(a) * rr * 0.9, s * 0.6, Math.sin(a) * rr * 0.75 - 1, r() * 3, r() * 3, 0, s, s * 1.1, s);
  }
  P(g, G('caveMound', () => lumpy(new THREE.SphereGeometry(5, 12, 7, 0, TAU, 0, HPI), 0.15, 82)), rk, 0, -0.3, -3.2, 0, 0, 0, 1.1, 1.05, 1.0);
  // тёмный зев
  P(g, G('caveMouth', () => { const s = new THREE.Shape(); s.moveTo(-1.8, 0); s.lineTo(1.8, 0); s.quadraticCurveTo(2.2, 2.6, 0, 3.4); s.quadraticCurveTo(-2.2, 2.6, -1.8, 0); return new THREE.ShapeGeometry(s, 6); }), M(0x0a0806), 0, 0.0, 2.25);
  P(g, box(3.4, 3.0, 2.0), M(0x0a0806), 0, 1.4, 1.2);
  for (let i = 0; i < 5; i++) P(g, cone(0.15, 0.6 + (i % 2) * 0.4, 5), rk2, -1.2 + i * 0.6, 3.1 - (i % 2) * 0.2, 2.2, PI);
  for (let i = 0; i < 6; i++) P(g, G('rubble', () => lumpy(new THREE.DodecahedronGeometry(0.3, 0), 0.3, 83)), rk2, -2.5 + i * 1.0, 0.15, 3.4 + (i % 2) * 0.6, i, i, 0);
  g.userData.colliders.push({ x: 0, z: -2.5, r: 4.6 }, { x: -3.6, z: 0.8, r: 1.6 }, { x: 3.6, z: 0.8, r: 1.6 });
};
POI.mine_entrance = (g) => {
  POI.cave_entrance(g);
  // деревянная крепь штольни
  const w = M(0x6a4a2a);
  for (const s of [-1, 1]) P(g, box(0.3, 3.2, 0.3), w, s * 1.6, 1.6, 2.4);
  P(g, box(3.8, 0.35, 0.4), w, 0, 3.3, 2.4);
  for (const s of [-1, 1]) P(g, box(0.25, 0.25, 0.6), w, s * 1.4, 3.0, 2.4, 0, 0, s * 0.7);
  for (let i = 0; i < 6; i++) P(g, box(1.6, 0.1, 0.2), M(0x5a4028), 0, 0.05, 2.0 + i * 0.7);
  for (const s of [-1, 1]) P(g, box(0.07, 0.08, 4.4), ironM(), s * 0.55, 0.13, 3.6);
  const cart = grp(g, 0, 0.2, 5.0); P(cart, box(1.1, 0.6, 1.4), M(0x5a4430), 0, 0.5, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(cart, cyl(0.18, 0.18, 0.08, 10), ironM(), sx * 0.55, 0.1, sz * 0.45, 0, 0, HPI);
  for (let i = 0; i < 5; i++) P(cart, ico(0.15, 0), FOL(0x7a6a5a), (i % 3 - 1) * 0.3, 0.85, (Math.floor(i / 3) - 0.5) * 0.4);
  const ln = grp(g, 1.6, 2.6, 2.75); P(ln, cyl(0.08, 0.1, 0.25, 6), bronzeM()); P(ln, cone(0.05, 0.15, 6), FLAME(), 0, 0.15, 0).castShadow = false;
  const l = new VLight(0xffa040, 4, 10, 1.6); l.position.set(0, 0.3, 0.2); ln.add(l);
  logPile(g, 4.5, 0, 4.0, 6, 2.4, 0.4);
  g.userData.colliders.push({ x: 0, z: 5.0, w: 1.2, d: 1.5, ry: 0 });
};
POI.tomb_entrance = (g) => {
  P(g, G('dune', () => lumpy(new THREE.SphereGeometry(7, 14, 7, 0, TAU, 0, HPI), 0.1, 85)), M(C.sand), 0, -1.0, -3.5, 0, 0, 0, 1.3, 0.55, 1.0);
  const sm = M(0xe0c890), pm = TM('paint', 0xffffff);
  // портал: две папирусные колонны, карниз-«выкружка» с крылатым солнцем
  for (const s of [-1, 1]) { const c = grp(g, s * 2.0, 0, 2.4); P(c, cyl(0.42, 0.5, 4.2, 12), pm, 0, 2.1, 0); P(c, lathe('papCap', [[0.35, 0], [0.7, 0.55], [0.72, 0.7], [0, 0.7]], 12), M(0x4a8a6a), 0, 4.2, 0); P(c, box(1.0, 0.25, 1.0), sm, 0, 5.0, 0); }
  P(g, box(5.4, 0.9, 1.4), pm, 0, 5.55, 2.4);
  P(g, box(5.8, 0.3, 1.7), sm, 0, 6.15, 2.5, -0.15);
  P(g, cyl(0.3, 0.3, 0.06, 14), goldM(), 0, 5.55, 3.12, HPI);
  for (const s of [-1, 1]) P(g, extr('sunWing', [[0, 0.15], [1.4, 0.25], [1.2, -0.05], [0, -0.15]], 0.04, 0), M(0x1f4f9a), s * 0.25, 5.55, 3.12, 0, s > 0 ? 0 : PI, 0);
  // ступени вниз к тёмному проёму
  for (let i = 0; i < 6; i++) P(g, box(3.0, 0.3, 0.6), sm, 0, -0.15 - i * 0.3, 1.6 - i * 0.55);
  P(g, box(3.0, 4.0, 0.2), M(0x0a0806), 0, 0.2, -1.6);
  for (const s of [-1, 1]) P(g, box(0.6, 4.6, 4.2), TM('ashlar', 0xe0c890), s * 1.8, 0.8, 0.0);
  for (const s of [-1, 1]) { const sp = grp(g, s * 4.5, 0, 4.0, 0, s * 0.2, 0); P(sp, box(1.0, 0.5, 2.2), sm, 0, 0.25, 0); P(sp, rbox(0.7, 0.6, 1.6, 0.1), sm, 0, 0.8, -0.2); P(sp, sph(0.3, 10, 8), sm, 0, 1.35, 0.55); P(sp, box(0.4, 0.5, 0.1), TM('nemes', 0xe8d8a8), 0, 1.15, 0.5); g.userData.colliders.push({ x: s * 4.5, z: 4.0, w: 1.1, d: 2.3, ry: s * 0.2 }); }
  g.userData.colliders.push({ x: 0, z: -4.5, r: 6.5 }, { x: -2.0, z: 2.4, r: 0.6 }, { x: 2.0, z: 2.4, r: 0.6 }, { x: -2.0, z: 0, w: 0.8, d: 4.2, ry: 0 }, { x: 2.0, z: 0, w: 0.8, d: 4.2, ry: 0 });
};
function punicWallSeg(g, x0, z0, x1, z1, h = 7, t = 2.2, col = true) {
  const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const wm = TM('ashlar', 0xd8c8a8);
  P(g, tbox(t, h + 1.5, len), wm, cx, (h - 1.5) / 2, cz, 0, ry, 0);
  const n = Math.max(2, Math.round(len / 1.4));
  const ox = Math.cos(ry) * (t / 2 - 0.2), oz = -Math.sin(ry) * (t / 2 - 0.2);
  for (let i = 0; i < n; i++) { const k = (i + 0.5) / n; P(g, box(0.4, 0.8, 0.8), M(0xc8b898), lerp(x0, x1, k) + ox, h + 0.4, lerp(z0, z1, k) + oz, 0, ry, 0); }
  P(g, box(t + 0.2, 0.25, len), M(0xb8a888), cx, h - 0.6, cz, 0, ry, 0);
  if (col) g.userData.colliders.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), w: t, d: +len.toFixed(2), ry: +ry.toFixed(3) });
}
function punicTower(g, x, z, s = 4.2, h = 10, ry = 0) {
  const wm = TM('ashlar', 0xd2c2a2);
  P(g, tbox(s, h + 1.5, s), wm, x, (h - 1.5) / 2, z, 0, ry, 0);
  P(g, box(s + 0.4, 0.3, s + 0.4), M(0xb8a888), x, h - 0.15, z, 0, ry, 0);
  for (let i = 0; i < 4; i++) { const a = ry + (i * PI) / 2; for (let k = 0; k < 3; k++) { const o = (k - 1) * (s / 3); P(g, box(0.5, 0.8, 0.5), M(0xc8b898), x + Math.sin(a) * (s / 2) + Math.cos(a) * o, h + 0.4, z + Math.cos(a) * (s / 2) - Math.sin(a) * o, 0, a, 0); } }
  for (let i = 0; i < 4; i++) { const a = ry + (i * PI) / 2; win(g, x + Math.sin(a) * (s / 2 + 0.01), h * 0.62, z + Math.cos(a) * (s / 2 + 0.01), a, 0.25, 0.9); }
  g.userData.colliders.push({ x: +x.toFixed(2), z: +z.toFixed(2), w: s, d: s, ry: +ry.toFixed(3) });
}
POI.fortress_gate = (g) => {
  for (const s of [-1, 1]) { punicTower(g, s * 4.4, 0, 4.6, 11); punicWallSeg(g, s * 6.7, 0, s * 13, 0, 8); }
  P(g, tbox(4.2, 3.2, 4.0), TM('ashlar', 0xd2c2a2), 0, 7.4, 0);
  P(g, G('punArch', () => { const s = new THREE.Shape(); s.moveTo(-2.1, 0); s.lineTo(2.1, 0); s.lineTo(2.1, 6.0); s.lineTo(-2.1, 6.0); s.closePath(); const h = new THREE.Path(); h.moveTo(-1.6, 0); h.lineTo(-1.6, 4.2); h.absarc(0, 4.2, 1.6, PI, 0, true); h.lineTo(1.6, 0); h.lineTo(-1.6, 0); s.holes.push(h); return new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false, curveSegments: 10 }); }), M(0xc8b898), 0, 0, 1.75);
  for (const s of [-1, 1]) { const lf = grp(g, s * 1.6, 0, 0.3, 0, s * -1.3, 0); P(lf, box(1.6, 5.4, 0.18), PLANK(), -s * 0.8, 2.7, 0); for (const yy of [0.8, 2.7, 4.6]) P(lf, box(1.6, 0.14, 0.24), ironM(), -s * 0.8, yy, 0); }
  P(g, box(1.6, 1.0, 0.04), M(0x4a2a7a, { side: THREE.DoubleSide }), 0, 8.4, 2.05);
  for (const s of [-1, 1]) banner(g, s * 4.4, 11, 0, 3, 0, null, 0x4a2a7a);
};
POI.punic_fort = (g) => {
  const R = 29, N = 12, gateI = 3;   // ворота смотрят на +Z
  const pts = []; for (let i = 0; i < N; i++) { const a = HPI + ((i - gateI) / N) * TAU + PI / N; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
  for (let i = 0; i < N; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % N];
    if (i === (gateI - 1 + N) % N) {
      // сегмент с воротами: два куска стены и надвратные башни
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, dx = (x1 - x0), dz = (z1 - z0), L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
      punicWallSeg(g, x0, z0, mx - ux * 4.6, mz - uz * 4.6);
      punicWallSeg(g, mx + ux * 4.6, mz + uz * 4.6, x1, z1);
      const ry = Math.atan2(dx, dz);
      punicTower(g, mx - ux * 3.6, mz - uz * 3.6, 3.6, 10, ry); punicTower(g, mx + ux * 3.6, mz + uz * 3.6, 3.6, 10, ry);
      P(g, box(2.2, 1.6, 3.6), TM('ashlar', 0xd2c2a2), mx, 8.6, mz, 0, ry, 0);
    } else punicWallSeg(g, x0, z0, x1, z1);
  }
  for (let i = 0; i < N; i++) if (i !== gateI && i !== (gateI - 1 + N) % N + 0.5) { const [x, z] = pts[i]; if (i === gateI || i === (gateI) % N) {} punicTower(g, x, z, 4.4, 10, Math.atan2(x, z)); }
  // внутри: казарма, храм Баал-Хаммона, склады
  const bk = grp(g, -8, 0, -8, 0, 0.3, 0);
  plinth(bk, 0, 0, 12, 5, 0.3); wall(bk, 0, 0.3, 0, 11.6, 4, 4.6, 0, { col: 0xe8dcc4, dadoCol: 0x4a2a6a }); gable(bk, 0, 4.3, 0, 11.6, 4.6, 0.3, 0.3, 'x');
  g.userData.colliders.push({ x: -8, z: -8, w: 12.6, d: 6.2, ry: 0.3 });
  const tp = grp(g, 9, 0, -6, 0, -0.4, 0);
  plinth(tp, 0, 0, 6, 8, 1.4); wall(tp, 0, 1.4, -0.8, 4.6, 5, 5.4, 0, { col: 0xf0e8d8, dado: false });
  for (const s of [-1, 1]) column(tp, s * 1.6, 1.4, 2.6, 4.6, 0.3, 'ionic', M(0xf0e8d8));
  P(tp, box(5, 0.5, 6.8), M(0xe8dcc4), 0, 6.65, 0.4);
  stairs(tp, 0, 1.4, 4.0, 3, 5, 0.28, 0.35);
  g.userData.colliders.push({ x: 9, z: -6, w: 6.4, d: 8.4, ry: -0.4 });
  for (let i = 0; i < 6; i++) crate(g, -2 + (i % 3), i > 2 ? 0.6 : 0, 6, 1, i * 0.2);
  for (const [x, z] of [[-4, 10], [4, 10], [0, -14]]) banner(g, x, 0, z, 5, 0, null, 0x4a2a7a);
  for (const s of [-1, 1]) brazier(g, s * 3.5, 0, R - 4, 1, 6, 12);
};
POI.scribe_hut = (g) => {
  const mud = M(0xb8946a), mud2 = M(0xa8845a);
  P(g, box(5.4, 3.6, 4.4), mud, 0, 0.9, -0.6);
  P(g, box(5.6, 0.25, 4.6), mud2, 0, 2.8, -0.6);
  for (let i = 0; i < 8; i++) P(g, box(0.25, 0.3, 0.25), mud2, -2.6 + (i % 4) * 1.73, 3.05, i < 4 ? 1.6 : -2.8);
  P(g, box(1.0, 1.9, 0.08), M(0x1a120c), -1.2, 0.95, 1.61);
  P(g, box(0.5, 0.4, 0.08), M(0x1a120c), 1.2, 1.9, 1.61);
  for (const [x, z] of [[-2.5, 3.6], [2.5, 3.6]]) post(g, x, 0, z, 2.4, 0.07, M(0x6a5a3a));
  P(g, box(5.4, 0.12, 2.2), M(0x8a9a4a), 0, 2.42, 2.6, 0.08);
  for (let i = 0; i < 12; i++) P(g, box(0.4, 0.04, 2.3), M(i % 2 ? 0x7a8a3a : 0x9aa85a), -2.4 + i * 0.44, 2.5, 2.6, 0.08, 0, 0.05 * Math.sin(i));
  P(g, box(2.4, 0.04, 1.6), M(0xb89a5a), 0.4, 0.02, 2.6);
  const tb = grp(g, 0.4, 0, 2.6); P(tb, box(1.2, 0.35, 0.6), M(0x6a4a2a), 0, 0.17, 0);
  for (let i = 0; i < 3; i++) P(tb, cyl(0.04, 0.04, 0.32, 8), M(0xe8d8a8), -0.35 + i * 0.3, 0.39, 0, 0, i * 0.3, HPI);
  P(tb, box(0.35, 0.01, 0.25), M(0xeee0b4), 0.25, 0.355, 0.1, 0, 0.2, 0);
  P(tb, box(0.12, 0.04, 0.08), M(0x2a2a2a), -0.45, 0.37, 0.18);
  for (let i = 0; i < 3; i++) P(g, lathe('jar2', [[0, 0], [0.18, 0.05], [0.24, 0.3], [0.14, 0.55], [0.1, 0.62], [0, 0.62]], 10), M(0xa8784a), -2.8 + i * 0.5, 0, 2.0 + (i % 2) * 0.4);
  for (let i = 0; i < 3; i++) { const b = makeBush('papyrus'); b.position.set(3.5 + (i % 2) * 1.2, 0, 2.5 - i * 1.6); g.add(b); }
  g.userData.colliders.push({ x: 0, z: -0.6, w: 5.6, d: 4.6, ry: 0 }, { x: 0.4, z: 2.6, w: 1.3, d: 0.7, ry: 0 });
};
POI.colony_site = (g) => {
  const r = rng(91);
  for (let i = -2; i <= 2; i++) for (let k = -2; k <= 2; k++) {
    if ((i + k) % 2) continue;
    const x = i * 3.2, z = k * 3.2;
    P(g, cyl(0.035, 0.045, 1.4, 5), M(C.woodL), x, 0.45, z, (r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.1);
    P(g, box(0.12, 0.2, 0.01), M(0xc02a1a, { side: THREE.DoubleSide }), x + 0.06, 1.05, z);
  }
  for (const z of [-6.4, 6.4]) rope(g, [-6.4, 0.6, z], [6.4, 0.6, z], 0.008, M(0xe8dcc0));
  for (const x of [-6.4, 6.4]) rope(g, [x, 0.6, -6.4], [x, 0.6, 6.4], 0.008, M(0xe8dcc0));
  // грома — римский землемерный инструмент
  const gr = grp(g, 1.0, 0, 1.0);
  P(gr, cyl(0.03, 0.035, 2.1, 6), M(C.woodD), 0, 1.05, 0);
  P(gr, box(0.5, 0.04, 0.04), M(C.woodD), 0.2, 2.05, 0);
  const cross = grp(gr, 0.45, 2.1, 0);
  for (const ry of [0, HPI]) P(cross, box(1.4, 0.04, 0.04), M(C.woodL), 0, 0, 0, 0, ry, 0);
  for (let i = 0; i < 4; i++) { const a = (i * PI) / 2; rope(cross, [Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7], [Math.cos(a) * 0.7, -0.9, Math.sin(a) * 0.7], 0.004); P(cross, cone(0.03, 0.07, 6), bronzeM(), Math.cos(a) * 0.7, -0.93, Math.sin(a) * 0.7, PI); }
  banner(g, -2.5, 0, -1.5, 3.6);
  crate(g, 3.6, 0, -3.2, 0.9); crate(g, 4.4, 0, -3.0, 0.8, 0.4); sack(g, 3.8, 0, -2.3, 0.9);
  for (let i = 0; i < 4; i++) P(g, cyl(0.04, 0.04, 1.4, 5), M(C.woodL), -4.2 + i * 0.12, 0.05, 3.6, 0, 0.1 * i, HPI);
  g.userData.colliders.push({ x: 1.0, z: 1.0, r: 0.3 }, { x: 4, z: -3.1, w: 1.8, d: 0.8, ry: 0 });
};
POI.port_city = (g) => {
  // далёкий силуэт большого порта (~120 м): стены с башнями, молы, маяк, храмы на холме, плотная застройка
  const r = rng(101);
  const wallM = M(0xd8ccb0), roofs = [M(0xb4553a), M(0xa04a32), M(0xc0643e)], walls = [M(0xeee4cc), M(0xe2d6bc), M(0xd8c8a8), M(0xf2ead8)];
  P(g, G('cityHill', () => lumpy(new THREE.SphereGeometry(40, 16, 6, 0, TAU, 0, HPI), 0.06, 7)), M(0xb8a878), 0, -6, -38, 0, 0, 0, 1.6, 0.6, 0.8);
  for (let i = 0; i < 11; i++) { const x = -60 + i * 12; P(g, box(12.2, 9, 3), wallM, x, 3, 0); P(g, box(5, 13, 5), wallM, x + 6, 5, 0.5); for (let k = 0; k < 4; k++) P(g, box(1, 1.2, 1), wallM, x + 6 - 1.8 + k * 1.2, 12.1, 3); }
  P(g, box(14, 10, 1), M(0x2a2018), 0, 4, 1.6);
  for (const s of [-1, 1]) { P(g, box(4, 3, 40), ASH(), s * 46, 0.5, 20, 0, s * 0.25, 0); }
  // маяк
  const lh = grp(g, 52, 0, 38); P(lh, box(10, 14, 10), wallM, 0, 6, 0); P(lh, cyl(3.6, 4.0, 10, 8), wallM, 0, 18, 0); P(lh, cyl(2.2, 2.4, 6, 12), wallM, 0, 26, 0); P(lh, cone(2.6, 2.4, 12), bronzeM(), 0, 30.2, 0);
  P(lh, cone(1.2, 2.4, 7), FLAME(), 0, 30, 0).castShadow = false;
  const ll = new VLight(0xffb050, 30, 90, 1.2); ll.position.set(0, 31, 0); lh.add(ll);
  // дома террасами
  for (let i = 0; i < 230; i++) {
    const x = -56 + r() * 112, z = -4 - r() * 52, hill = Math.max(0, 1 - Math.hypot(x / 64, (z + 38) / 32)) * 18;
    const w = 4 + r() * 6, d = 4 + r() * 6, h = 4 + r() * 7;
    const ry = (r() - 0.5) * 0.3;
    P(g, box(w, h, d), walls[(r() * 4) | 0], x, hill + h / 2 - 2, z, 0, ry, 0);
    P(g, G('cityRoof', () => { const c = new THREE.ConeGeometry(0.75, 0.35, 4); c.rotateY(PI / 4); return c; }), roofs[(r() * 3) | 0], x, hill + h - 2 + 0.17 * Math.max(w, d) * 0.6, z, 0, ry, 0).scale.set(w * 1.05 * 1.414 / 1.06, Math.max(w, d) * 0.9, d * 1.05 * 1.414 / 1.06);
  }
  // храмы на вершине
  for (const [x, z, s] of [[-14, -40, 1.4], [12, -46, 1.1], [-34, -30, 0.9], [30, -28, 0.8]]) {
    const hill = Math.max(0, 1 - Math.hypot(x / 64, (z + 38) / 32)) * 18;
    const t = grp(g, x, hill, z, 0, 0.1, 0); t.scale.setScalar(s);
    P(t, box(14, 3, 22), M(0xf2ecdc), 0, 1.5, 0);
    P(t, box(10, 10, 16), M(0xf6f0e2), 0, 8, -2);
    for (let i = 0; i < 6; i++) P(t, cyl(0.6, 0.7, 9, 6), M(0xf6f0e2), -5 + i * 2, 7.5, 9.5);
    P(t, G('cityTempleRoof', () => { const c = new THREE.CylinderGeometry(1, 1, 1, 3, 1); c.rotateX(-HPI); return c; }), M(0xb4553a), 0, 13.6, -2, 0, 0, 0, 6.4, 2.2, 17);
  }
  // корабли у причалов (силуэты)
  for (let i = 0; i < 6; i++) { const x = -36 + i * 14, z = 12 + (i % 2) * 8; P(g, box(3.5, 1.8, 14), M(0x4a3a2a), x, 0.2, z); P(g, cyl(0.2, 0.25, 11, 5), M(0x3a2a1a), x, 6, z); P(g, box(8, 6, 0.1), M(0xe8dcc0), x, 7, z + 0.4); }
};
POI.dock = (g) => {
  P(g, tbox(2.6, 0.2, 9), PLANK(), 0, 0.6, 4.5);
  for (let z = 0.4; z <= 9; z += 2.1) for (const s of [-1, 1]) P(g, cyl(0.13, 0.15, 3.0, 7), M(0x4a3420), s * 1.15, -0.8, z);
  for (const s of [-1, 1]) P(g, box(0.1, 0.1, 9), M(0x5a4028), s * 1.25, 0.75, 4.5);
  for (const z of [3, 8]) for (const s of [-1, 1]) P(g, cyl(0.1, 0.12, 0.45, 7), M(0x5a4430), s * 1.1, 0.92, z);
  P(g, tor(0.28, 0.06, 5, 12), M(C.rope), 0.7, 0.75, 7.6, HPI);
};
POI.well = (g) => {
  P(g, tcyl(1.0, 1.05, 2.4, 14), ASH(), 0, -0.4, 0);
  P(g, tor(0.98, 0.1, 6, 18), M(C.stone), 0, 0.82, 0, HPI);
  P(g, cyl(0.85, 0.85, 0.04, 16), M(0x1a2a2a, { roughness: 0.2 }), 0, 0.3, 0);
  for (const s of [-1, 1]) P(g, box(0.16, 2.4, 0.16), M(C.woodD), s * 0.95, 1.6, 0);
  P(g, box(2.3, 0.14, 0.14), M(C.woodD), 0, 2.7, 0);
  P(g, cyl(0.14, 0.14, 0.2, 10), M(C.wood), 0, 2.55, 0, 0, 0, HPI);
  rope(g, [0, 2.45, 0], [0, 1.3, 0], 0.012);
  P(g, cyl(0.15, 0.12, 0.25, 10), M(C.wood), 0, 1.15, 0);
  P(g, tor(0.15, 0.012, 4, 12, PI), ironM(), 0, 1.27, 0);
  g.userData.colliders.push({ x: 0, z: 0, r: 1.1 });
};
POI.statue = (g) => {
  // статуя императора: та же шарнирная фигура в кирасе и плаще, целиком из мрамора, рука поднята (adlocutio)
  P(g, tbox(2.6, 2.0, 2.6), TM('ashlar', 0xe8e2d4), 0, -0.5, 0);
  P(g, rbox(1.9, 2.0, 1.9, 0.06), M(C.marble), 0, 1.5, 0);
  P(g, box(2.2, 0.2, 2.2), M(C.marble), 0, 2.6, 0); P(g, box(2.2, 0.2, 2.2), M(C.marble), 0, 0.6, 0);
  P(g, box(1.2, 0.35, 0.02), M(0xc8c0b0), 0, 1.7, 0.96);
  const h = makeHuman({ tunic: 0xffffff, skin: 0xffffff, hair: 0xffffff, beard: true, cape: 0xffffff });
  setGear(h, { body: 'punic_mail', legs: 'caligae' });
  animateHuman(h, 0.016, { speed: 0 });
  const u = h.userData;
  _q1.setFromEuler(new THREE.Euler(-2.2, 0, -0.35)); u.armR.quaternion.copy(_q1); u.foreR.rotation.set(-0.4, 0, 0); u.handR.rotation.set(0.6, 0, 0);
  u.armL.rotation.set(-0.3, 0, 0.15); u.foreL.rotation.set(-1.2, 0, 0);
  u.legL.rotation.set(-0.12, 0, 0.03); u.shinL.rotation.set(0.24, 0, 0); u.footL.rotation.set(-0.12, 0, 0);
  u.neck.rotation.set(0, -0.25, 0);
  const marble = M(0xece6da);
  h.traverse((c) => { if (c.isMesh) { c.material = marble; } });
  h.scale.setScalar(1.45); h.position.set(0, 2.7, 0);
  g.add(h);
  g.userData.colliders.push({ x: 0, z: 0, w: 2.6, d: 2.6, ry: 0 });
};
// фактория купца на берегу: начало — у кромки воды на суше, +Z — к морю (y=0 — уровень моря)
POI.trader = (g) => {
  const top = 0.9, deckY = 1.15;
  // мощёный двор — толстая кладка, уходит ниже воды
  P(g, tbox(12, top + 2.6, 10), TM('ashlar', 0xd4c8aa), 0, (top - 2.6) / 2, -5);
  P(g, box(12.1, 0.07, 10.1), M(C.stoneD), 0, top - 0.05, -5);
  for (const s of [-1, 1]) {                                                   // низкий парапет вдоль берега и по бокам
    P(g, tbox(4.3, 0.5, 0.45), ASH(), s * 3.85, top + 0.25, -0.25); colB(g, s * 3.85, -0.25, 4.3, 0.5);
    P(g, tbox(0.45, 0.5, 9.5), ASH(), s * 5.78, top + 0.25, -5.0); colB(g, s * 5.78, -5.0, 0.5, 9.5);
    P(g, cyl(0.16, 0.2, 0.55, 8), M(0x6a6a64), s * 1.75, top + 0.27, -0.3);
  }
  // лавка под тентом: столбы, полосатый холст, прилавок
  const st = grp(g, -3.0, top, -3.4), wd = M(C.woodD);
  for (const [x, z, h] of [[1.3, -1.6, 2.45], [1.3, 1.6, 2.45], [-1.4, -1.6, 2.85], [-1.4, 1.6, 2.85]]) post(st, x, 0, z, h, 0.07, wd);
  for (const s of [-1, 1]) P(st, box(2.9, 0.08, 0.08), wd, -0.05, 2.62, s * 1.6, 0, 0, -0.15);
  const cv = grp(st, -0.05, 2.72, 0, 0, 0, -0.15);
  for (let i = 0; i < 5; i++) P(cv, box(3.3, 0.03, 0.75), M(i % 2 ? 0xe8dcc0 : 0x9a2a22, { side: THREE.DoubleSide }), 0, 0, -1.5 + i * 0.75);
  for (let i = 0; i < 9; i++) P(st, box(0.03, 0.3, 0.38), M(i % 2 ? 0xe8dcc0 : 0x9a2a22), 1.62, 2.28, -1.55 + i * 0.39);
  P(st, rbox(0.65, 0.95, 2.8, 0.02), PLANK(), 1.0, 0.475, 0);                  // прилавок
  P(st, rbox(0.8, 0.07, 3.0, 0.015), M(C.woodL), 1.0, 0.985, 0);
  amphora(st, 1.0, 1.02, -1.1, 0.5); amphora(st, 1.05, 1.02, -0.75, 0.5, 0x9a5a34);
  for (const [z, col] of [[0.1, C.purple], [0.35, 0x2a5a8a], [0.6, 0xc89a48]]) P(st, cyl(0.1, 0.1, 0.5, 8), M(col), 1.0, 1.12, z, 0, 0, HPI);
  for (let i = 0; i < 4; i++) P(st, cyl(0.035, 0.035, 0.01 + i * 0.006, 8), goldM(), 0.9, 1.03, 1.0 + i * 0.08);
  { const lb = grp(st, 1.05, 1.02, 1.0), br = bronzeM(); P(lb, cyl(0.015, 0.02, 0.4, 6), br, 0, 0.2, 0); P(lb, box(0.025, 0.02, 0.55), br, 0, 0.4, 0); for (const s of [-1, 1]) { rope(lb, [0, 0.4, s * 0.26], [0, 0.16, s * 0.26], 0.005, br); P(lb, cyl(0.08, 0.06, 0.015, 8), br, 0, 0.15, s * 0.26); } }
  P(st, box(0.35, 1.6, 2.8), PLANK(), -1.35, 0.8, 0);                          // полки у задней стойки
  for (const yy of [0.55, 1.1]) P(st, box(0.5, 0.05, 2.8), M(C.wood), -1.1, yy, 0);
  for (let i = 0; i < 5; i++) amphora(st, -1.1, 1.13, -1.1 + i * 0.55, 0.55, i % 2 ? 0x9a5a34 : C.terracotta);
  for (let i = 0; i < 4; i++) tcrate(st, 1 + (i % 2), -1.1, 0.58, -0.9 + i * 0.6, 0.6, HPI);
  colB(g, -2.0, -3.4, 0.8, 3.0); colB(g, -4.35, -3.4, 0.6, 3.0);
  // купец за прилавком
  const h = makeHuman({ tunic: 0x2f5f7a, skin: 0xc89870, hair: 0x2a1e14, beard: true, cape: 0x8a6a3a });
  setGear(h, {});
  for (let i = 0; i < 20; i++) animateHuman(h, 1 / 30, { speed: 0, t: i / 30 });
  h.position.set(-2.55, top, -3.4); h.rotation.y = HPI; g.add(h);
  g.userData.merchant = h;
  // товары во дворе: штабели ящиков, амфоры, мешки, бочки
  const y = top;
  tcrate(g, 1, 3.4, y, -7.6, 1.4, 0.05); tcrate(g, 2, 4.6, y, -7.6, 1.4, -0.03); tcrate(g, 1, 4.0, y + 0.84, -7.6, 1.2, 0.1); tcrate(g, 3, 4.1, y + 1.56, -7.6, 0.9, -0.15);
  colB(g, 4.0, -7.6, 2.6, 1.0);
  crate(g, 4.8, y, -5.6, 1.2, HPI); crate(g, 4.8, y, -4.5, 1.2, HPI + 0.1); crate(g, 4.8, y + 0.72, -5.0, 1.0, HPI - 0.2);
  colB(g, 4.8, -5.0, 0.9, 2.2);
  for (let i = 0; i < 6; i++) amphora(g, 2.6 + (i % 3) * 0.45, y, -3.4 + Math.floor(i / 3) * 0.45, 1, i % 2 ? 0x9a5a34 : C.terracotta);
  colB(g, 3.05, -3.2, 1.5, 1.0);
  for (let i = 0; i < 3; i++) sack(g, 4.6 + (i % 2) * 0.5, y, -2.6 + Math.floor(i / 2) * 0.5, 1, 0xd2be92, i);
  barrel(g, 4.9, y, -1.2); barrel(g, 4.3, y, -1.0, 0.9);
  dolium(g, -4.6, y, -7.6, 0.85); dolium(g, -3.6, y, -8.0, 0.75); colB(g, -4.1, -7.8, 2.0, 1.2);
  tcrate(g, 4, -1.9, y, -1.3, 0.9, 0.5);
  banner(g, 1.9, y, -0.9, 3.8);
  // деревянный причал на сваях: настил x −1.5…1.5, z −0.38…18.58, ширина 3 м, верх доски ≈ deckY+0.05
  const wood = M(0x8a6a44), dark = M(0x5a4228);
  P(g, box(3.4, 3.6, 1.2), ASH(), 0, deckY - 0.05 - 1.8, 0.0);              // каменный устой у берега
  let k = 0;
  for (let z = 0.1; z <= 18.15; z += 1.0, k++) P(g, box(3.0, 0.1, 0.96), k % 2 ? M(0x7e6040) : wood, 0, deckY, z);
  for (const sx of [-1.35, 1.35]) {
    P(g, box(0.16, 0.16, 18.4), dark, sx, deckY - 0.13, 9.2);
    for (let z = 1.4; z <= 18.3; z += 2.3) P(g, cyl(0.12, 0.14, 4.0, 7), dark, sx * 1.04, deckY - 0.2 - 2.0, z);
  }
  for (let z = 1.4; z <= 17.6; z += 4.6) P(g, box(3.1, 0.14, 0.14), dark, 0, deckY - 0.3, z);
  for (const z of [5.0, 11.0, 17.2]) for (const sx of [-1, 1]) {
    P(g, cyl(0.13, 0.15, 0.75, 8), dark, sx * 1.42, deckY + 0.42, z);
    P(g, cyl(0.17, 0.17, 0.06, 8), dark, sx * 1.42, deckY + 0.8, z);
  }
  P(g, tor(0.17, 0.035, 4, 10), M(C.rope), 1.42, deckY + 0.6, 11.0, HPI);
  rope(g, [1.42, deckY + 0.6, 11.0], [2.8, 0.3, 12.2], 0.016);
  P(g, tor(0.32, 0.07, 5, 12), M(C.rope), -0.8, deckY + 0.1, 15.6, HPI);
  P(g, tor(0.22, 0.06, 5, 12), M(C.rope), -0.8, deckY + 0.2, 15.6, HPI);
  for (const s of [-1, 1]) P(g, box(0.07, 2.4, 0.07), dark, 0.6 + s * 0.25, deckY - 1.1, 18.62, 0.15, 0, 0);    // лесенка к воде
  for (let i = 0; i < 5; i++) P(g, box(0.5, 0.04, 0.05), dark, 0.6, deckY - 0.25 - i * 0.42, 18.62 + 0.03 + i * 0.065);
  tcrate(g, 1, -0.7, deckY + 0.05, 8.0, 0.9, 0.2); tcrate(g, 2, -0.75, deckY + 0.05, 8.75, 0.8, -0.1);
};
// скалистый островок в море (y=0 — уровень моря); ровная площадка наверху — центр (0, 5.5, 0), радиус ≈2 м
function jagged(key, geo, amt, seed) {
  return G(key, () => {
    const g = geo.clone(), pos = g.attributes.position;
    g.computeBoundingBox(); const ymax = g.boundingBox.max.y;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (y >= ymax - 1e-4) continue;                                           // верх остаётся ровным
      const h = hash3(Math.round(x * 100) + seed, Math.round(y * 100), Math.round(z * 100)), k = 1 + (h - 0.5) * 2 * amt;
      pos.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    return g;
  });
}
function seaRock(root, ry = 0) {
  const g = grp(root, 0, 0, 0, 0, ry, 0), cs = Math.cos(ry), sn = Math.sin(ry);
  const colC = (_, x, z, r) => root.userData.colliders.push({ x: +(x * cs + z * sn).toFixed(2), z: +(-x * sn + z * cs).toFixed(2), r });
  const rk = FOL(0x8a7f70), rk2 = FOL(0x6e6458), rk3 = FOL(0x9a8e7c), wet = FOL(0x4e463c), wh = FOL(0xeeeae2);
  P(g, G('seaRockMain', () => lumpy(new THREE.IcosahedronGeometry(1, 1), 0.15, 61)), rk, 0, -0.8, 0, 0, 0.4, 0, 6.6, 5.3, 5.6);
  // ровная «столовая» вершина: верх ровно на y = 5.5
  P(g, jagged('seaCap', new THREE.CylinderGeometry(2.5, 3.3, 2.4, 9, 2), 0.1, 17), rk3, 0, 5.5 - 1.2, 0);
  // боковые утёсы и камни у воды
  const crag = (key, x, y, z, sx, sy, sz, ry, m, seed) => P(g, G(key, () => lumpy(new THREE.DodecahedronGeometry(1, 0), 0.22, seed)), m, x, y, z, 0, ry, 0, sx, sy, sz);
  crag('seaCragA', -4.6, 1.0, -2.6, 2.2, 4.8, 2.0, 0.3, rk2, 71);
  crag('seaCragB', 4.9, -0.6, 2.4, 3.0, 3.2, 2.6, 1.1, rk, 72);
  crag('seaCragC', 2.4, -1.0, -5.0, 3.2, 3.6, 2.5, 0.6, rk2, 73);
  crag('seaCragD', -3.6, -1.3, 4.6, 2.6, 2.6, 2.4, 2.0, rk, 74);
  const r = rng(91);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + r() * 0.4, d = 7.0 + r() * 1.4, s = 0.5 + r() * 0.9;
    crag('seaBoulder' + (i % 3), Math.cos(a) * d, -0.35 * s, Math.sin(a) * d, s * 1.2, s, s * 1.1, a, i % 2 ? wet : rk2, 80 + (i % 3));
  }
  // белые потёки птичьего помёта по бокам вершины и пятна наверху у края
  for (let i = 0; i < 8; i += 1) {
    if (i % 3 === 1) continue;
    const th = ((i + 0.5) / 9) * TAU, yy = 4.6 - (i % 2) * 0.3, rr = 0.94 * (3.3 - 0.8 * (yy - 3.1) / 2.4);
    const sg = grp(g, Math.sin(th) * rr, yy, Math.cos(th) * rr, 0, th, 0);
    P(sg, box(0.22 + (i % 2) * 0.15, 1.3, 0.5), wh, 0, 0, 0, -0.32, 0, 0).castShadow = false;
  }
  for (let i = 0; i < 6; i++) { const a = r() * TAU, d = 1.9 + r() * 0.4; P(g, cyl(0.25 + r() * 0.2, 0.3, 0.03, 7), wh, Math.cos(a) * d, 5.505, Math.sin(a) * d).castShadow = false; }
  P(g, sph(0.6, 6, 4), wh, -4.6, 5.2, -2.6, 0, 0, 0, 1.4, 0.4, 1.2).castShadow = false;
  P(g, sph(0.6, 6, 4), wh, 4.9, 2.2, 2.4, 0, 0, 0, 1.6, 0.35, 1.4).castShadow = false;
  colC(g, 0, 0, 6.6); colC(g, -4.6, -2.6, 2.0); colC(g, 4.9, 2.4, 2.6); colC(g, 2.4, -5.0, 2.6); colC(g, -3.6, 4.6, 2.2);
  root.userData.top = new THREE.Vector3(0, 5.5, 0);
}
POI.sea_rock = (g) => { seaRock(g); };
// разбитый корабль у скалы: корпус без кормы, пробоина, рёбра шпангоутов, сломанная мачта, рваный парус, обломки на воде
function wreckHullGeo(key, c, zCut, seed, N = 16, K = 8) {
  return G('whull' + key, () => {
    const f = hullFns(c), r = rng(seed), pos = [], uv = [], idx = [], W = 2 * K + 1, jag = [];
    for (let j = 0; j < W; j++) jag.push(r() * 1.8);
    for (let i = 0; i <= N; i++) for (let j = 0; j < W; j++) {
      const z = lerp(zCut + jag[j], c.L / 2, i / N), s = j < K ? -1 : 1, phi = (Math.abs(j - K) / K) * HPI;
      const p = f.pt(z, phi, j === K ? 0 : s); pos.push(...p); uv.push(z, p[1]);
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < 2 * K; j++) {
      if (j >= K + 3 && j <= K + 5 && i >= 4 && i <= 7) continue;               // пробоина в правом борту
      const a = i * W + j, b = a + W; idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  });
}
POI.sea_wreck = (g) => {
  seaRock(g, PI * 0.6);   // та же скала, повёрнутая (вершина в центре не смещается)
  const c = { ...SHIPDEF.corbita, L: 15 }, f = hullFns(c), zCut = -3.0;
  const wg = grp(g, 7.6, -0.55, 0.6, 0, 0.35, 0);
  const w = grp(wg, 0, 0, 0, -0.1, 0, 0.5);
  const hm = TM('plank', 0x7a6a56, { side: THREE.DoubleSide }), rib = M(0x4e3e2c), dk = M(0x3e3226);
  P(w, wreckHullGeo('sea', c, zCut, 7), hm);
  // шпангоуты: внутри корпуса и обломанные — торчат за проломом кормы
  for (let i = 0; i < 11; i++) {
    const z = -6.6 + i * 1.2, broken = z < zCut + 1.2, n = 6;
    for (const s of [-1, 1]) {
      if (broken && (i + (s > 0 ? 1 : 0)) % 2) continue;
      const k = broken ? 0.55 + ((i * 7 + s) % 4) * 0.12 : 1;
      const pts = []; for (let j = 0; j <= n; j++) { const p = f.pt(z, (j / n) * HPI * k, j ? s : 0); pts.push([p[0] * 0.96, p[1] + 0.03, p[2]]); }
      P(w, tube(`wrRib${i}${s}`, pts, 0.08, 0.06, 6, 4), rib);
    }
  }
  P(w, tube('wrKeel', [[0, -c.D + 0.05, zCut - 3.6], [0, -c.D, 0], [0, -c.D * 0.6, c.L / 2 - 0.2]], 0.14, 0.12, 8, 4), dk);
  for (const s of [-1, 1]) P(w, tube(`wrRail${s}`, [-0.5, 2, 4, 6].map((z) => [s * f.hw(z), f.sheer(z), z]), 0.07, 0.07, 8, 4), dk);
  // палубный настил местами
  for (let i = 0; i < 6; i++) { const z = 1.0 + i * 0.75; if (i === 3) continue; P(w, box(f.halfAt(z, c.deckY) * 1.7, 0.06, 0.6), M(0x8a7458), 0, c.deckY, z, 0, 0, (i % 2 - 0.5) * 0.1); }
  // обломок мачты и упавшая мачта с рваным парусом
  P(w, cyl(0.15, 0.17, 2.2, 7), dk, 0, c.deckY + 1.1, 0.3);
  P(w, cone(0.15, 0.5, 5), dk, 0.03, c.deckY + 2.45, 0.3, 0.1, 0, 0.15);
  const mg = grp(g, 11.4, 0.1, 5.2, 0, 0.5, 0);
  P(mg, cyl(0.12, 0.15, 7.5, 7), dk, 0, 0, 0, 0.12, 0, HPI);
  P(mg, cyl(0.06, 0.06, 5, 6), dk, -1.2, 0.2, 0.9, 0, 0.5, HPI);
  P(mg, G('tornSail', () => {
    const q = new THREE.PlaneGeometry(4.2, 3.2, 6, 4), p = q.attributes.position, rr = rng(23);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 1.6) * 0.25 + (rr() - 0.5) * 0.12); if (y < -1.5) p.setY(i, y + rr() * 1.2); if (Math.abs(x) > 2) p.setX(i, x * (0.8 + rr() * 0.25)); }
    q.rotateX(-HPI + 0.25); q.computeVertexNormals(); return q;
  }), M(0xbcae90, { side: THREE.DoubleSide }), -0.6, -0.02, 1.6, 0, 0.3, 0).castShadow = false;
  rope(g, [7.4, 2.2, 1.0], [10.6, 0.05, 4.6], 0.02);
  // плавающие доски и бочки
  const r = rng(44);
  for (let i = 0; i < 9; i++) {
    const a = 0.2 + r() * 2.6, d = 10.5 + r() * 5;
    P(g, box(0.25, 0.07, 1.4 + r() * 1.6), M(i % 2 ? 0x6a5a44 : 0x7e6a50), Math.cos(a) * d, 0.0, Math.sin(a) * d - 2, (r() - 0.5) * 0.1, r() * PI, (r() - 0.5) * 0.1);
  }
  for (const [x, z, ry] of [[12.6, 3.8, 0.4], [11.2, -4.6, 1.8], [7.4, 7.2, 2.6]]) { const b = barrel(g, x, -0.05, z); b.rotation.set(0, ry, HPI * 0.96); }
  colB(g, 7.6, 0.6, 5.0, 15, 0.35);
};
export function makePOI(kind) {
  const g = new THREE.Group(); g.name = 'poi_' + kind; g.userData = { colliders: [], kind };
  (POI[kind] || POI.ruin)(g);
  return g;
}

// ======================================================================
// Подземелья: комнаты без потолка (камера сверху)
// ======================================================================
const DUNGEON = {
  cave: { floor: 0x4e4840, wall: 0x5e564c, h: 4.5 },
  mine: { floor: 0x5a4a3a, wall: 0x5a5248, h: 4.5 },
  tomb: { floor: 0xd8c08a, wall: 0xd8c08a, h: 4.5 },
  fortress: { floor: 0x9a9286, wall: 0xb8ae9a, h: 4.5 },
};
function paintWallMat() {
  if (!TMC.has('paintWall')) { const t = T('paint').clone(); t.needsUpdate = true; t.repeat.set(1 / 4.5, 1 / 4.5); t.offset.set(0, 0); TMC.set('paintWall', new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })); }
  return TMC.get('paintWall');
}
function dWallMat(theme) {
  if (theme === 'tomb') return paintWallMat();
  if (theme === 'fortress') return TM('ashlar', 0xc8c0b0);
  return FOL(DUNGEON[theme].wall);
}
function dFloorMat(theme) {
  if (theme === 'tomb') return TM('ashlar', 0xf0d8a8);
  if (theme === 'fortress') return TM('ashlar', 0x9a948a);
  return M(DUNGEON[theme].floor);
}
function wallTorch(par, x, z, ry, h = 2.6, li = 5) {
  const t = grp(par, x, 0, z, 0, ry, 0);
  P(t, box(0.12, 0.3, 0.1), ironM(), 0, h - 0.2, 0.05);
  P(t, cyl(0.03, 0.04, 0.5, 6), M(C.woodD), 0, h, 0.2, -0.4);
  P(t, cyl(0.05, 0.04, 0.12, 6), M(0x3a2a1a), 0, h + 0.25, 0.3, -0.4);
  P(t, cone(0.08, 0.3, 6), FLAME(), 0, h + 0.45, 0.35).castShadow = false;
  const l = new VLight(0xffa040, li, 11, 1.6); l.position.set(0, h + 0.5, 0.6); t.add(l);
  return t;
}
// стены по периметру w×d (внутренний размер) с проёмами 4 м в центрах сторон
function dWalls(g, theme, w, d, doors, h) {
  const wm = dWallMat(theme), t = 1.0, cols = g.userData.colliders;
  const sides = { n: { cx: 0, cz: -d / 2 - t / 2, len: w + 2 * t, ax: 'x' }, s: { cx: 0, cz: d / 2 + t / 2, len: w + 2 * t, ax: 'x' }, w: { cx: -w / 2 - t / 2, cz: 0, len: d, ax: 'z' }, e: { cx: w / 2 + t / 2, cz: 0, len: d, ax: 'z' } };
  const segs = [];
  for (const [k, sd] of Object.entries(sides)) {
    const open = doors.includes(k);
    const pieces = open ? [[-sd.len / 2, -2], [2, sd.len / 2]] : [[-sd.len / 2, sd.len / 2]];
    for (const [a, b] of pieces) {
      const L = b - a, m = (a + b) / 2;
      if (L < 0.05) continue;
      const x = sd.ax === 'x' ? sd.cx + m : sd.cx, z = sd.ax === 'z' ? sd.cz + m : sd.cz;
      const bw = sd.ax === 'x' ? L : t, bd = sd.ax === 'x' ? t : L;
      const geo = theme === 'tomb' ? G(`tw${bw},${h},${bd}`, () => { const q = new THREE.BoxGeometry(bw, h + 0.2, bd); const p = q.attributes.position, uv = q.attributes.uv, n = q.attributes.normal; for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)) > 0.5; uv.setXY(i, ((ax ? p.getZ(i) : p.getX(i)) + 100) , p.getY(i) + (h + 0.2) / 2 - 0.1); } return q; }) : tbox(bw, h + 1.5, bd);
      P(g, geo, wm, x, theme === 'tomb' ? h / 2 - 0.1 + 0.1 : (h - 1.5) / 2, z);
      cols.push({ x: +x.toFixed(2), z: +z.toFixed(2), w: +bw.toFixed(2), d: +bd.toFixed(2), ry: 0 });
      segs.push({ x, z, bw, bd, side: k });
      if (theme === 'fortress' || theme === 'tomb') P(g, box(bw + 0.1, 0.3, bd + 0.1), M(theme === 'tomb' ? 0x1f3f8a : 0x8a8478), x, h + 0.05, z);
    }
    if (open) for (const s of [-1, 1]) {
      const px = sd.ax === 'x' ? sd.cx + s * 2.15 : sd.cx, pz = sd.ax === 'z' ? sd.cz + s * 2.15 : sd.cz;
      if (theme === 'mine') { P(g, box(0.35, h, 0.35), M(0x6a4a2a), px, h / 2, pz); }
      else if (theme === 'tomb') P(g, box(0.5, h + 0.4, 0.5), M(0xc8a860), px, (h + 0.4) / 2, pz);
      else if (theme === 'fortress') P(g, box(0.6, h + 0.6, 1.3), TM('ashlar', 0xb8b0a0), px, (h + 0.6) / 2, pz);
    }
  }
  return segs;
}
export function makeDungeonRoom(theme = 'cave', w = 12, d = 12, doors = []) {
  if (!DUNGEON[theme]) theme = 'cave';
  const g = new THREE.Group(); g.name = 'room_' + theme; g.userData = { colliders: [], theme, w, d };
  const h = DUNGEON[theme].h;
  P(g, theme === 'tomb' || theme === 'fortress' ? tbox(w + 2, 0.4, d + 2) : box(w + 2, 0.4, d + 2), dFloorMat(theme), 0, -0.2, 0);
  dWalls(g, theme, w, d, doors || [], h);
  const r = rng(`${theme}${w}x${d}${(doors || []).join('')}`);
  const area = w * d, nLights = Math.max(2, Math.min(4, Math.round(area / 60)));
  // точки у стен (не в проёмах)
  const wallSpots = [];
  for (const [side, ax, len, off] of [['n', 'x', w, -d / 2], ['s', 'x', w, d / 2], ['w', 'z', d, -w / 2], ['e', 'z', d, w / 2]]) {
    for (let k = 0; k < 6; k++) {
      const m = (-0.42 + (k / 5) * 0.84) * len;
      if ((doors || []).includes(side) && Math.abs(m) < 2.6) continue;
      const ry = side === 'n' ? 0 : side === 's' ? PI : side === 'w' ? HPI : -HPI;
      wallSpots.push({ x: ax === 'x' ? m : off, z: ax === 'z' ? m : off, ry, side });
    }
  }
  const pick = (n) => { const out = []; const pool = wallSpots.slice(); for (let i = 0; i < n && pool.length; i++) out.push(pool.splice((r() * pool.length) | 0, 1)[0]); return out; };
  const inward = (s, k) => ({ x: s.x + Math.sin(s.ry) * k, z: s.z + Math.cos(s.ry) * k });
  // свет: факелы на стенах (или жаровни в гробнице)
  const lights = pick(nLights);
  for (const s of lights) {
    if (theme === 'tomb') { const p = inward(s, 1.0); brazier(g, p.x, 0, p.z, 0.9, 6, 12); g.userData.colliders.push({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: 0.35 }); }
    else wallTorch(g, s.x, s.z, s.ry, 2.6, 5);
  }
  if (theme === 'cave') {
    const rk = FOL(0x5e564c), rk2 = FOL(0x6a6256);
    for (const s of wallSpots) { const p = inward(s, 0.3); const sc = 1.2 + r() * 1.3; P(g, G(`dRock${(r() * 4) | 0}`, () => lumpy(new THREE.DodecahedronGeometry(1, 0), 0.32, 120 + ((r() * 4) | 0))), r() < 0.5 ? rk : rk2, p.x, sc * 0.6, p.z, r() * 3, r() * 3, 0, sc * 0.8, sc * 1.5, sc * 0.8); }
    for (let i = 0; i < Math.round(area / 25); i++) {
      const x = (r() - 0.5) * (w - 3), z = (r() - 0.5) * (d - 3);
      if (Math.abs(x) < 2.5 || Math.abs(z) < 2.5) continue;
      const hh = 0.6 + r() * 1.6; P(g, cone(0.25 + r() * 0.2, hh, 6), rk2, x, hh / 2, z); g.userData.colliders.push({ x: +x.toFixed(2), z: +z.toFixed(2), r: 0.35 });
    }
    for (let i = 0; i < 4; i++) P(g, cyl(0.6 + r(), 0.6 + r(), 0.02, 10), M(0x2a3a3a, { roughness: 0.15 }), (r() - 0.5) * (w - 4), 0.01, (r() - 0.5) * (d - 4));
    for (let i = 0; i < 8; i++) P(g, G('dRubble', () => lumpy(new THREE.DodecahedronGeometry(0.25, 0), 0.3, 131)), rk, (r() - 0.5) * (w - 2), 0.1, (r() - 0.5) * (d - 2), r() * 3, r() * 3, 0);
  } else if (theme === 'mine') {
    // крепь вдоль стен, рельсы, вагонетки с рудой
    const tm = M(0x6a4a2a);
    for (const s of wallSpots) { const p = inward(s, 0.25); P(g, box(0.3, h, 0.3), tm, p.x, h / 2, p.z); }
    for (const [side, ax, len, off] of [['n', 'x', w, -d / 2], ['s', 'x', w, d / 2], ['w', 'z', d, -w / 2], ['e', 'z', d, w / 2]]) { const ox = ax === 'z' ? off + Math.sign(-off) * 0.25 : 0, oz = ax === 'x' ? off + Math.sign(-off) * 0.25 : 0; P(g, box(ax === 'x' ? len : 0.3, 0.3, ax === 'x' ? 0.3 : len), tm, ox, h - 0.15, oz); }
    const along = w >= d ? 'x' : 'z', L = along === 'x' ? w + 2 : d + 2;
    for (let i = 0; i < L / 0.8; i++) { const k = -L / 2 + i * 0.8; P(g, box(along === 'x' ? 0.18 : 1.4, 0.08, along === 'x' ? 1.4 : 0.18), M(0x4a3420), along === 'x' ? k : 0, 0.04, along === 'x' ? 0 : k); }
    for (const s of [-1, 1]) P(g, box(along === 'x' ? L : 0.07, 0.08, along === 'x' ? 0.07 : L), ironM(), along === 'x' ? 0 : s * 0.5, 0.12, along === 'x' ? s * 0.5 : 0);
    const cart = grp(g, along === 'x' ? w * 0.25 : 0, 0.15, along === 'x' ? 0 : d * 0.25, 0, along === 'x' ? HPI : 0, 0);
    P(cart, box(1.1, 0.6, 1.4), M(0x5a4430), 0, 0.5, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(cart, cyl(0.18, 0.18, 0.08, 10), ironM(), sx * 0.55, 0.1, sz * 0.45, 0, 0, HPI);
    for (let i = 0; i < 5; i++) P(cart, ico(0.15, 0), FOL(0x8a8e94), (i % 3 - 1) * 0.3, 0.85, (Math.floor(i / 3) - 0.5) * 0.4);
    g.userData.colliders.push({ x: along === 'x' ? +(w * 0.25).toFixed(2) : 0, z: along === 'x' ? 0 : +(d * 0.25).toFixed(2), w: along === 'x' ? 1.5 : 1.2, d: along === 'x' ? 1.2 : 1.5, ry: 0 });
    for (const s of pick(3)) { const p = inward(s, 1.4); const n = makeRockNode('silver'); n.scale.setScalar(0.7); n.position.set(p.x, 0, p.z); g.add(n); g.userData.colliders.push({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: 0.8 }); }
    for (const s of pick(2)) { const p = inward(s, 1.2); barrel(g, p.x, 0, p.z); crate(g, p.x + 0.8, 0, p.z, 0.8); }
  } else if (theme === 'tomb') {
    // колонны с капителями-папирусами, саркофаги, статуи, сосуды
    const pm = TM('paint', 0xffffff);
    if (w >= 10 && d >= 10) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * w * 0.28, z = sz * d * 0.28;
      P(g, cyl(0.45, 0.5, h - 0.8, 12), pm, x, (h - 0.8) / 2, z);
      P(g, lathe('papCap2', [[0.4, 0], [0.62, 0.45], [0.64, 0.6], [0, 0.6]], 12), M(0x3a7a6a), x, h - 0.8, z);
      P(g, box(1.0, 0.25, 1.0), M(0xc8a860), x, h - 0.1, z);
      g.userData.colliders.push({ x: +x.toFixed(2), z: +z.toFixed(2), r: 0.6 });
    }
    const sar = (x, z, ry) => { const s = grp(g, x, 0, z, 0, ry, 0); P(s, rbox(1.0, 0.9, 2.2, 0.05), M(0x9a8a70), 0, 0.45, 0); P(s, rbox(1.06, 0.25, 2.26, 0.08), M(0x8a7a60), 0, 1.0, 0); P(s, box(0.6, 0.06, 1.6), pm, 0, 1.14, 0); P(s, sph(0.22, 10, 8), goldM(), 0, 1.2, 0.75, 0, 0, 0, 1, 0.5, 1.1); g.userData.colliders.push({ x: +x.toFixed(2), z: +z.toFixed(2), w: 1.1, d: 2.3, ry: +ry.toFixed(3) }); };
    if (area > 90) sar(0, 0, 0);
    for (const s of pick(2)) { const p = inward(s, 1.6); sar(p.x, p.z, s.ry + HPI); }
    for (const s of pick(2)) {
      const p = inward(s, 0.8), st = grp(g, p.x, 0, p.z, 0, s.ry, 0);
      P(st, box(0.8, 0.5, 0.8), M(0xc8a860), 0, 0.25, 0); P(st, rbox(0.55, 1.0, 0.6, 0.08), M(0x2a2a30), 0, 1.0, -0.05); P(st, sph(0.18, 10, 8), M(0x2a2a30), 0, 1.7, 0); P(st, box(0.4, 0.35, 0.3), TM('nemes', 0xffffff), 0, 1.68, -0.06); P(st, box(0.5, 0.15, 0.35), M(0x2a2a30), 0, 0.75, 0.2);
      g.userData.colliders.push({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: 0.55 });
    }
    for (let i = 0; i < 6; i++) { const s = wallSpots[(r() * wallSpots.length) | 0]; if (!s) break; const p = inward(s, 0.5); P(g, lathe('jar3', [[0, 0], [0.14, 0.04], [0.2, 0.25], [0.12, 0.45], [0.08, 0.5], [0, 0.5]], 10), M(i % 2 ? 0xa8784a : 0xe8dcc0), p.x + (r() - 0.5), 0, p.z); }
  } else if (theme === 'fortress') {
    // стойки с оружием, знамёна на стенах, ящики и бочки
    for (const s of pick(2)) {
      const p = inward(s, 0.6), rk = grp(g, p.x, 0, p.z, 0, s.ry, 0);
      P(rk, box(1.8, 0.08, 0.3), M(C.woodD), 0, 1.2, 0); P(rk, box(1.8, 0.08, 0.3), M(C.woodD), 0, 0.2, 0); for (const sx of [-1, 1]) P(rk, box(0.08, 1.3, 0.3), M(C.woodD), sx * 0.85, 0.65, 0);
      for (let i = 0; i < 4; i++) { const wpn = buildWeapon(i % 2 ? 'hasta' : 'falcata', 0); wpn.scale.setScalar(i % 2 ? 0.6 : 1); wpn.position.set(-0.6 + i * 0.4, 0.3, 0.05); rk.add(wpn); }
      g.userData.colliders.push({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), w: 1.9, d: 0.5, ry: +s.ry.toFixed(3) });
    }
    for (const s of pick(3)) { const p = inward(s, 0.08); const b = grp(g, p.x, 0, p.z, 0, s.ry, 0); P(b, box(1.0, 2.2, 0.03), M(0x4a2a7a), 0, 2.6, 0); P(b, cyl(0.03, 0.03, 1.2, 5), M(C.woodD), 0, 3.72, 0.02, 0, 0, HPI); P(b, extr('tanitBan', [[-0.25, -0.35], [0.25, -0.35], [0, 0.1]], 0.01, 0), M(0xe8d8a0), 0, 2.4, 0.02); P(b, cyl(0.12, 0.12, 0.01, 12), M(0xe8d8a0), 0, 2.75, 0.02, HPI); }
    for (const s of pick(3)) { const p = inward(s, 1.0); crate(g, p.x, 0, p.z, 1, r()); if (r() < 0.6) barrel(g, p.x + 0.9, 0, p.z + 0.2); g.userData.colliders.push({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: 0.6 }); }
    for (const s of pick(1)) { const p = inward(s, 1.4); brazier(g, p.x, 0, p.z, 1, 5, 10); g.userData.colliders.push({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: 0.35 }); }
    for (const s of pick(2)) { const p = inward(s, 0.35); const sh = buildShield(r() < 0.5 ? 'punicshield' : 'caetra', 0); sh.position.set(p.x, 2.3, p.z); sh.rotation.y = s.ry; g.add(sh); }
  }
  return g;
}
export function makeDungeonCorridor(theme = 'cave', len = 10) {
  if (!DUNGEON[theme]) theme = 'cave';
  const g = new THREE.Group(); g.name = 'corridor_' + theme; g.userData = { colliders: [], theme, len };
  const h = DUNGEON[theme].h, wm = dWallMat(theme), W = 4, t = 1.0;
  P(g, theme === 'tomb' || theme === 'fortress' ? tbox(W + 2 * t, 0.4, len) : box(W + 2 * t, 0.4, len), dFloorMat(theme), 0, -0.2, 0);
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + t / 2);
    const geo = theme === 'tomb' ? G(`tcw${len}`, () => { const q = new THREE.BoxGeometry(t, h + 0.2, len); const p = q.attributes.position, uv = q.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) + 100, p.getY(i) + (h + 0.2) / 2 - 0.1); return q; }) : tbox(t, h + 1.5, len);
    P(g, geo, wm, x, theme === 'tomb' ? h / 2 : (h - 1.5) / 2, 0);
    g.userData.colliders.push({ x, z: 0, w: t, d: len, ry: 0 });
    if (theme === 'cave') for (let k = 0; k < len / 2.2; k++) { const sc = 1.0 + ((k * 7 + (s > 0 ? 3 : 0)) % 5) * 0.2; P(g, G('dRock0', () => lumpy(new THREE.DodecahedronGeometry(1, 0), 0.32, 120)), FOL(0x5e564c), s * (W / 2 + 0.2), sc * 0.6, -len / 2 + 1 + k * 2.2, k, k * 2, 0, sc * 0.7, sc * 1.4, sc * 0.9); }
  }
  if (theme === 'mine') for (let z = -len / 2 + 1; z < len / 2; z += 2.5) { for (const s of [-1, 1]) P(g, box(0.3, h, 0.3), M(0x6a4a2a), s * (W / 2 - 0.15), h / 2, z); P(g, box(W, 0.3, 0.3), M(0x6a4a2a), 0, h - 0.15, z); }
  if (theme === 'mine') { for (const s of [-1, 1]) P(g, box(0.07, 0.08, len), ironM(), s * 0.5, 0.12, 0); for (let z = -len / 2; z < len / 2; z += 0.8) P(g, box(1.4, 0.08, 0.18), M(0x4a3420), 0, 0.04, z); }
  if (theme === 'fortress' || theme === 'tomb') for (const s of [-1, 1]) P(g, box(t + 0.1, 0.3, len), M(theme === 'tomb' ? 0x1f3f8a : 0x8a8478), s * (W / 2 + t / 2), h + 0.05, 0);
  const nT = Math.max(1, Math.round(len / 10));
  for (let i = 0; i < nT; i++) { const z = -len / 2 + ((i + 0.5) / nT) * len, s = i % 2 ? 1 : -1; wallTorch(g, s * W / 2, z, s > 0 ? -HPI : HPI, 2.6, 4); }
  return g;
}

// ---------- Помощники для дополнительных модулей моделей (models_city.js, models_eco.js) ----------
export const H = { THREE, PI, TAU, HPI, clamp, lerp, ease, seg, fract, rng, hash3, G, box, cyl, sph, hemi, cone, tor, ico, oct, dod, lathe, rbox, extr, tube, lumpy, wuv, tbox, tcyl, bendX, paint, P, grp, noShadow, MET, FLAME, EMB, bronzeM, ironM, steelM, goldM, canvasTex, shade, T, TM, ASH, TILE, PLANK, BRICK, THATCH, FOL, amphora, dolium, crate, sack, barrel, logPile, plankStack, brickStack, stoneBlocks, brazier, bench, table, cart, banner, column, stairs, statue, rope, darker, B, colB, colC, WATER, plinth, plinthC, wall, door, win, gable, shed, fence, post, palus, paving4, hut, tent, campfire, weaponRack, statera, lowWarehouse, basin, cropRows, colRow, onager, punicTower, punicWallSeg, seaRock, C, M, VLight, BUILD, POI, SHIPDEF, makeLabel };

export { makeTrainingTarget } from './training-model.js';
