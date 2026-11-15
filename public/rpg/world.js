// Insula Deserta: Империя — архипелаг: рельеф и генерация мира (одинаково на сервере и клиенте)
import { ANCIENT_RUINS, ISLANDS, INSTANCES, CFG, CITIES, BUILDINGS, CELL, RESEARCH, DISTRICTS, cellsOf } from './data.js';

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash2(i, j) { let h = (i * 374761393 + j * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f) * a; f *= 2.03; a *= 0.5; } return s; }
export const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ======================================================================
// Сицилия: настоящий контур (долгота/широта) → метры игры (~1:100), север — к −Z
// ======================================================================
export const proj = (lon, lat) => [(lon - 14) * 880, -(lat - 37.6) * 1110];
const SIC_LL = [
  [15.652, 38.268], [15.52, 38.262], [15.39, 38.245], [15.30, 38.235], [15.235, 38.268], [15.215, 38.235], [15.235, 38.205], [15.14, 38.16], [15.05, 38.158], [14.92, 38.175],
  [14.76, 38.165], [14.62, 38.09], [14.48, 38.04], [14.25, 38.02], [14.02, 38.045], [13.86, 37.995], [13.70, 37.982], [13.58, 38.04], [13.46, 38.10], [13.385, 38.118],
  [13.36, 38.15], [13.31, 38.22], [13.20, 38.19], [13.08, 38.10], [12.97, 38.04], [12.86, 38.06], [12.78, 38.18], [12.70, 38.12], [12.58, 38.07], [12.505, 38.02],
  [12.44, 37.93], [12.42, 37.80], [12.48, 37.71], [12.585, 37.65], [12.80, 37.575], [13.06, 37.50], [13.28, 37.40], [13.50, 37.285], [13.72, 37.19], [13.93, 37.10],
  [14.24, 37.065], [14.44, 37.005], [14.58, 36.86], [14.75, 36.76], [14.90, 36.71], [15.09, 36.68], [15.135, 36.78], [15.12, 36.88], [15.21, 36.97], [15.29, 37.045],
  [15.315, 37.10], [15.26, 37.17], [15.22, 37.23], [15.19, 37.30], [15.10, 37.39], [15.085, 37.47], [15.13, 37.56], [15.20, 37.66], [15.245, 37.76], [15.29, 37.85],
  [15.34, 37.94], [15.42, 38.03], [15.50, 38.12], [15.56, 38.19], [15.61, 38.24],
];
export const SICILY = SIC_LL.map(([a, b]) => proj(a, b));
function segDist(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz; let t = L ? ((x - a[0]) * dx + (z - a[1]) * dz) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); }
function polyDist(x, z, pts) { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) { const dd = segDist(x, z, pts[i], pts[i + 1]); if (dd < d) d = dd; } return d; }
// поле расстояний до берега (+ — суша), сетка 6 м
const SG = { x0: -1580, z0: -900, c: 6 }; SG.w = Math.ceil((1660 - SG.x0) / SG.c) + 1; SG.h = Math.ceil((1200 - SG.z0) / SG.c) + 1;
const SDF = new Float32Array(SG.w * SG.h);
(function buildSdf() {
  const P = SICILY, n = P.length;
  for (let j = 0; j < SG.h; j++) {
    const z = SG.z0 + j * SG.c, xs = [];
    for (let k = 0; k < n; k++) { const a = P[k], b = P[(k + 1) % n]; if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + ((z - a[1]) / (b[1] - a[1])) * (b[0] - a[0])); }
    for (let i = 0; i < SG.w; i++) {
      const x = SG.x0 + i * SG.c;
      let d = 1e9; for (let k = 0; k < n; k++) { const a = P[k], b = P[(k + 1) % n]; if (Math.abs(a[0] - x) - 800 > d && Math.abs(b[0] - x) - 800 > d) continue; const dd = segDist(x, z, a, b); if (dd < d) d = dd; }
      let inside = false; for (const q of xs) if (q < x) inside = !inside;
      SDF[j * SG.w + i] = inside ? d : -d;
    }
  }
})();
export function sdfBase(x, z) {
  const fx = (x - SG.x0) / SG.c, fz = (z - SG.z0) / SG.c;
  if (fx < 0 || fz < 0 || fx >= SG.w - 1 || fz >= SG.h - 1) return -600;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, o = j * SG.w + i;
  return (SDF[o] * (1 - u) + SDF[o + 1] * u) * (1 - v) + (SDF[o + SG.w] * (1 - u) + SDF[o + SG.w + 1] * u) * v;
}
function sdfGrad(x, z, r = 40) { let gx = 0, gz = 0; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), v = sdfBase(x + c * r, z + s * r); gx += c * v; gz += s * v; } const l = Math.hypot(gx, gz) || 1; return { x: gx / l, z: gz / l }; }
// ---------- Города ----------
export const CITY_LIST = CITIES.map((c) => {
  const [x0, z0] = proj(c.lon, c.lat);
  if (!c.harbor) return { ...c, x: x0, z: z0, hx: x0, hz: z0, ry: 0, inland: true };
  let x = x0, z = z0;
  for (let it = 0; it < 40; it++) { const s = sdfBase(x, z); if (Math.abs(s) < 0.3) break; const g = sdfGrad(x, z, 12); x -= g.x * s * 0.8; z -= g.z * s * 0.8; }
  const g = sdfGrad(x, z, 45), nx = -g.x, nz = -g.z; // к морю
  return { ...c, x: x - nx * c.R * 0.62, z: z - nz * c.R * 0.62, hx: x, hz: z, ry: Math.atan2(nx, nz) };
});
export const cityById = (id) => CITY_LIST.find((c) => c.id === id);
// локальные координаты города: u — вдоль берега, v — к морю (к гавани)
export function cityPt(c, u, v, fromHarbor = false) { const cs = Math.cos(c.ry), sn = Math.sin(c.ry), ox = fromHarbor ? c.hx : c.x, oz = fromHarbor ? c.hz : c.z; return [ox + u * cs + v * sn, oz - u * sn + v * cs]; }
export function cityLocal(c, x, z) { const cs = Math.cos(c.ry), sn = Math.sin(c.ry), dx = x - c.x, dz = z - c.z; return [dx * cs - dz * sn, dx * sn + dz * cs]; }
export const cityAt = (x, z, pad = 0) => CITY_LIST.find((c) => Math.abs(x - c.x) < c.R + pad && Math.abs(z - c.z) < c.R + pad && Math.hypot(x - c.x, z - c.z) < c.R + pad);
// Мессана — первый римский город (старое имя CITY оставлено для совместимости)
export const CITY = (() => { const m = CITY_LIST[0]; return { x: m.x, z: m.z, r: m.R, id: m.id }; })();
// каменные молы гаваней (в координатах от гавани: u, v)
const MOLE_SHAPES = {
  // мол начинается внутри стен (у гавани), сначала уходит прямо в море и лишь потом заворачивает — стена пересекает его только над водой
  falcata: [{ w: 10, pts: [[-46, -12], [-50, 26], [-78, 54], [-96, 86], [-80, 114], [-52, 132]] }],
  catana: [{ w: 9, pts: [[-46, -12], [-50, 30], [-80, 60], [-90, 96], [-66, 120]] }],
  syr: [{ w: 9, pts: [[-46, -12], [-50, 28], [-82, 58], [-86, 98]] }, { w: 9, pts: [[46, -12], [50, 28], [82, 58], [86, 96]] }],
  std: [{ w: 8, pts: [[-44, -12], [-48, 26], [-78, 56], [-84, 98]] }],
};
export const MOLES = [];
for (const c of CITY_LIST) if (c.harbor) for (const m of MOLE_SHAPES[c.harbor] || []) {
  const pts = m.pts.map(([u, v]) => cityPt(c, u, v, true));
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  MOLES.push({ city: c.id, w: m.w, pts, box: [Math.min(...xs) - 20, Math.max(...xs) + 20, Math.min(...zs) - 20, Math.max(...zs) + 20] });
}
export const MOLE_TOP = 1.6, CITY_H = 2.0;
function moleDist(x, z) { let d = 1e9; for (const m of MOLES) { if (x < m.box[0] || x > m.box[1] || z < m.box[2] || z > m.box[3]) continue; const dd = polyDist(x, z, m.pts) - m.w / 2; if (dd < d) d = dd; } return d; }
export const onMole = (x, z) => moleDist(x, z) < 0;
// береговая линия Сицилии с «рваным» шумом (у гаваней — спокойнее)
function sicS(x, z) {
  const s = sdfBase(x, z);
  if (s < -260) return s;
  let calm = 1;
  for (const c of CITY_LIST) { const dx = Math.abs(x - c.hx), dz = Math.abs(z - c.hz); if (dx < c.R * 2.4 && dz < c.R * 2.4) calm = Math.min(calm, smoothstep(c.R * 0.9, c.R * 2.4, Math.hypot(dx, dz))); }
  return s + ((fbm(x * 0.0045 + 3, z * 0.0045, 3) - 0.5) * 46 + (vnoise(x * 0.025, z * 0.025) - 0.5) * 7) * calm;
}
// Этна
export const VOLCANO = { x: 880, z: -170, r: 280, h: 155, cr: 28, name: 'Этна' };
// горы: Пелоританские, Неброди, Мадоние, Сикани, Эреи, Иблеи, Эрикс, горы у Панорма
const RIDGES = [
  { h: 40, w: 70, pts: [[1340, -780], [1262, -640], [1180, -500], [1120, -380]] },
  { h: 46, w: 90, pts: [[1080, -470], [850, -478], [620, -455], [420, -432]] },
  { h: 58, w: 95, pts: [[380, -420], [200, -398], [30, -388], [-120, -372]] },
  { h: 34, w: 110, pts: [[-250, -240], [-420, -60], [-620, 40]] },
  { h: 26, w: 120, pts: [[120, 30], [330, 150], [480, 280]] },
  { h: 30, w: 120, pts: [[520, 560], [720, 640], [860, 760]] },
  { h: 38, w: 46, pts: [[-1290, -450], [-1250, -410]] },
  { h: 32, w: 80, pts: [[-720, -430], [-920, -350]] },
];
for (const r of RIDGES) { const xs = r.pts.map((p) => p[0]), zs = r.pts.map((p) => p[1]); r.box = [Math.min(...xs) - r.w * 2.2, Math.max(...xs) + r.w * 2.2, Math.min(...zs) - r.w * 2.2, Math.max(...zs) + r.w * 2.2]; }
// озёра и реки Сицилии
export const LAKES = [{ x: 264, z: 89, r: 30, name: 'Озеро Пергуза' }, { x: 836, z: 300, r: 30, name: 'Озеро Леонтин' }, { x: 493, z: -258, r: 24, name: 'Озеро Анкипа' }];
export const RIVERS = [
  { name: 'Симет', w: 7, pts: [[592, -110], [690, -10], [790, 110], [880, 215], [985, 240], [1040, 252]] },
  { name: 'Гимера', w: 7, pts: [[44, -330], [90, -150], [100, 55], [44, 277], [-50, 520], [-62, 600]] },
  { name: 'Галик', w: 7, pts: [[-352, -120], [-420, 30], [-500, 140], [-616, 236], [-650, 300]] },
  { name: 'Гипса', w: 7, pts: [[-704, -300], [-780, -170], [-850, -60], [-994, 36], [-1020, 100]] },
  { name: 'Акесин', w: 7, pts: [[720, -430], [900, -445], [1060, -330], [1112, -258]] },
  { name: 'Анап', w: 7, pts: [[820, 600], [930, 690], [1040, 735], [1150, 745]] },
  { name: 'Мессанский ручей', w: 5, clay: true, pts: [[1004, -362], [1058, -341], [1108, -324], [1160, -306]] }, // короткий: камыш и глина у самой Мессаны
  { name: 'Орет', w: 7, pts: [[-560, -380], [-500, -470], [-470, -560], [-462, -620]] },
];
for (const r of RIVERS) { const xs = r.pts.map((p) => p[0]), zs = r.pts.map((p) => p[1]); r.box = [Math.min(...xs) - 170, Math.max(...xs) + 170, Math.min(...zs) - 170, Math.max(...zs) + 170]; }
// расстояние до кромки воды реки/озера (<0 — в воде)
export function waterEdgeDist(x, z) {
  let d = 1e9;
  for (const l of LAKES) { if (Math.abs(x - l.x) > l.r + 170 || Math.abs(z - l.z) > l.r + 170) continue; const dd = Math.hypot(x - l.x, z - l.z) - l.r * (1 + 0.12 * Math.sin(Math.atan2(z - l.z, x - l.x) * 3 + l.x)); if (dd < d) d = dd; }
  for (const r of RIVERS) {
    if (x < r.box[0] || x > r.box[1] || z < r.box[2] || z > r.box[3]) continue;
    for (let i = 0; i < r.pts.length - 1; i++) { const dd = segDist(x, z, r.pts[i], r.pts[i + 1]) - r.w * (1 + 0.1 * Math.sin(x * 0.05 + z * 0.04)); if (dd < d) d = dd; }
  }
  return d;
}
function sicilyH(x, z) {
  const s = sicS(x, z);
  if (s < -200) return -30;
  let h;
  if (s < 0) h = Math.max(-30, -0.9 + s * 0.17 - fbm(x * 0.01, z * 0.01, 2) * 2);
  else {
    h = smoothstep(0, 8, s) * 1.3 + Math.min(s, 300) * 0.012;
    const inl = smoothstep(4, 140, s);
    h += inl * Math.max(0, fbm(x * 0.0035 + 5, z * 0.0035 - 2, 4) * 30 - 8);
    for (const r of RIDGES) {
      if (x < r.box[0] || x > r.box[1] || z < r.box[2] || z > r.box[3]) continue;
      const d = polyDist(x, z, r.pts), sg = r.w * 0.5;
      h += r.h * Math.exp(-(d * d) / (2 * sg * sg)) * (0.5 + 0.95 * fbm(x * 0.012 + r.h, z * 0.012, 3)) * smoothstep(0, 60, s);
    }
    h += (fbm(x * 0.05, z * 0.05, 3) - 0.5) * 1.6 * smoothstep(0, 10, s);
  }
  // Этна: конус с кратером и бороздами застывшей лавы
  const V = VOLCANO, vd = Math.hypot(x - V.x, z - V.z);
  let cone = -99;
  if (vd < V.r) {
    let c = V.h * Math.pow(1 - vd / V.r, 1.45) * (0.95 + 0.08 * vnoise(x * 0.018 + 11, z * 0.018 - 4)); // круглый конус (шум по координатам — без шва)
    if (vd < V.cr) { const rim = V.h * Math.pow(1 - V.cr / V.r, 1.45); const q = 1 - vd / V.cr; c = rim - (1 - (1 - q) * (1 - q)) * 24; }
    cone = c; if (c > h) h = c;
  }
  // города — ровные площадки у моря
  for (const c of CITY_LIST) {
    const dx = x - c.x, dz = z - c.z; if (Math.abs(dx) > c.R * 1.4 + 40 || Math.abs(dz) > c.R * 1.4 + 40) continue;
    const k = (1 - smoothstep(c.R * 1.12, c.R * 1.4 + 40, Math.hypot(dx, dz))) * smoothstep(0, 10, s);
    if (k > 0) h = h * (1 - k) + CITY_H * k;
  }
  // реки и озёра
  const wd = waterEdgeDist(x, z);
  // у воды — невысокая кромка (на неё опираются мосты), дальше — широкая пологая долина без обрывов
  if (wd < 165) { const bed = wd <= 0 ? -2.2 + Math.min(1, -wd / 4) * -0.5 : -2.2 + 3.0 * smoothstep(0, 3, wd) + Math.max(0, wd - 2.5) * 0.12 + Math.max(0, wd - 45) ** 2 * 0.008; if (bed < h) h = bed + (h - bed) * smoothstep(110, 165, wd); } // к краю долины влияние реки плавно сходит на нет — без обрывов
  if (cone > h) h += (cone - h) * smoothstep(8, 40, wd); // склоны Этны река не подрезает: долина — только у самого русла
  // молы гаваней
  const md = moleDist(x, z);
  if (md < 3) { const t = md <= 0 ? MOLE_TOP : MOLE_TOP - md * 4; if (t > h) h = t; }
  return h;
}

// скалы в открытом море (часть — с обломками кораблей и сундуком на вершине); кораблям — препятствие
export const SEA_ROCKS = [
  { x: -150, z: -900, r: 9, wreck: true }, { x: 380, z: -800, r: 8 }, { x: -1100, z: -720, r: 9, wreck: true }, { x: 1560, z: 80, r: 8 },
  { x: 1330, z: 880, r: 9, wreck: true }, { x: -1560, z: 260, r: 8 }, { x: -560, z: 760, r: 9, wreck: true }, { x: 650, z: 1300, r: 8, wreck: true }, { x: -1320, z: 1180, r: 9 }, { x: 1680, z: 820, r: 8, wreck: true },
];
export const rockAt = (x, z, pad = 0) => SEA_ROCKS.find((r) => Math.abs(x - r.x) < r.r + pad && Math.abs(z - r.z) < r.r + pad && Math.hypot(x - r.x, z - r.z) < r.r + pad);
const ISL = ISLANDS.map((i, k) => ({ ...i, k, seedOff: k * 97.3 }));
export const islandById = (id) => ISL.find((i) => i.id === id);
let FLATS = []; // {x,z,r,h} — выровненные площадки (лагеря, колонии, входы)

const PEAK = { med: 26, rock: 34, beach: 9, forest: 22, desert: 14 };
// радиус берега по направлению: изрезанность
function coastR(isl, a) {
  const o = isl.seedOff;
  let f = 1 + 0.16 * Math.sin(a * 3 + o) + 0.09 * Math.sin(a * 5 + o * 1.7) + 0.06 * Math.sin(a * 9 + o * 0.3) + 0.04 * Math.sin(a * 14 + o * 2.1);
  return isl.r * f;
}
function islandH(isl, x, z) {
  const dx = x - isl.x, dz = z - isl.z, d = Math.hypot(dx, dz);
  if (d > isl.r * 1.7) return -30;
  const a = Math.atan2(dz, dx), R = coastR(isl, a), t = d / R;
  const n = fbm(x * 0.011 + isl.seedOff, z * 0.011, 4);
  if (t > 1) return Math.max(-30, -0.9 - (t - 1) * 26 - n * 2);
  const inland = 1 - t;
  // пологий пляж у берега, дальше холмы
  let h = smoothstep(0, 0.06, inland) * 1.2 + inland * 2.5;
  const peak = (PEAK[isl.biome] || 20) * Math.max(0.3, Math.min(1, isl.r / 130)); // маленькие острова — пологие, по ним можно ходить
  const hills = Math.pow(smoothstep(0.08, 0.9, inland), 1.3) * peak * (0.45 + 0.9 * fbm(x * 0.006 + 7 + isl.seedOff, z * 0.006 - 3, 4));
  h += hills;
  // мелкая неровность
  h += (fbm(x * 0.05, z * 0.05, 3) - 0.5) * 1.6 * smoothstep(0, 0.1, inland);
  if (isl.volc) { // вулканический остров: конус с кратером
    const vr = isl.r * 0.85, vh = isl.volc * Math.max(0.45, Math.min(1, isl.r / 90)); if (d < vr) { const q = 1 - d / vr; let c = vh * Math.pow(q, 1.5); if (d < isl.r * 0.12) c -= (1 - d / (isl.r * 0.12)) * vh * 0.18; h = Math.max(h, c * smoothstep(0, 0.1, inland)); }
  }
  if (isl.id === 'italia') h += Math.pow(smoothstep(0.2, 0.9, inland), 1.2) * 40 * fbm(x * 0.008, z * 0.008, 3);
  if (isl.biome === 'desert') {
    // сухие холмы и пресный пруд с папирусом
    h += Math.sin(x * 0.08 + Math.sin(z * 0.03) * 2) * 0.6 * smoothstep(0.05, 0.3, inland);
    const lr = isl.r * 0.16, lake = Math.hypot(x - (isl.x - isl.r * 0.3), z - (isl.z + isl.r * 0.1));
    if (lake < lr * 2.4) h = h * smoothstep(lr, lr * 2.4, lake) + (-1.6) * (1 - smoothstep(lr, lr * 2.4, lake));
  }
  return h;
}
export function terrainHeight(x, z) {
  let h = -30;
  for (const r of SEA_ROCKS) { const dx = x - r.x, dz = z - r.z; if (Math.abs(dx) > r.r * 3.2 || Math.abs(dz) > r.r * 3.2) continue; const d = Math.hypot(dx, dz) / (r.r * 3.2); if (d < 1) h = Math.max(h, 3.2 * (1 - Math.pow(d, 1.4)) - 1.2 - (d > 0.8 ? (d - 0.8) * 8 : 0)); }
  for (const isl of ISL) {
    if (Math.abs(x - isl.x) > isl.r * 1.75 || Math.abs(z - isl.z) > isl.r * 1.75) continue;
    h = Math.max(h, isl.poly ? sicilyH(x, z) : islandH(isl, x, z));
  }
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    const fr = f.fall || f.r * 1.6;
    if (d < fr) { let k = 1 - smoothstep(f.r, fr, d); if (f.fall) k *= smoothstep(-1.6, 0.6, h); h = h * (1 - k) + f.h * k; }
  }
  return h;
}
// приют новоприбывших и причал стартовой лодки — в Мессане
const _ms = CITY_LIST[0];
export const START = (() => { const [x, z] = cityPt(_ms, 52, 44); return { x, z, h: CITY_H, ry: _ms.ry }; })();
START.spawn = (() => { const [x, z] = cityPt(_ms, 52, 32); return { x, z }; })();
export const PIER = (() => { const [x, z] = cityPt(_ms, -50, -2.5, true); return { x, z, ry: _ms.ry }; })();
// ---------- Настилы (причалы, набережные): по ним ходят, как по земле ----------
// локальные прямоугольники [x0, x1, z0, z1, y]; y — высота настила над основанием постройки
export const PIER_DECK = [-1.45, 1.45, -4.2, 16.6, 1.2];
export const PORTUS_PIERS = [-26, 0, 26], PORTUS_LEN = 46;
export const PORTUS_DECKS = [[-38, 38, -4.6, 2.5, 0.68], ...PORTUS_PIERS.map((x) => [x - 1.7, x + 1.7, 1.5, PORTUS_LEN + 0.3, 0.85])];
const _baseCache = new Map();
// гавань стоит на уровне суши у набережной (а не по среднему с морским дном)
export function portusBase(b) { const c = Math.cos(b.ry || 0), s = Math.sin(b.ry || 0); let h = -9; for (const [lx, lz] of [[0, -9], [-24, -9], [24, -9], [0, -5]]) h = Math.max(h, terrainHeight(b.x + lx * c + lz * s, b.z - lx * s + lz * c)); return Math.max(1.0, h); }
export function bldBase(b, r) { const k = b.id + ':' + b.x + ':' + b.z; let v = _baseCache.get(k); if (v == null) { if (b.type === 'portus') v = portusBase(b); else { const sl = slopeAt(b.x, b.z, Math.max(1, r * 0.7)); v = (sl.lo + sl.hi) / 2; } _baseCache.set(k, v); } return v; }
function inRect(x, z, ox, oz, ry, R) { const dx = x - ox, dz = z - oz, c = Math.cos(ry), s = Math.sin(ry); const lx = dx * c - dz * s, lz = dx * s + dz * c; return lx >= R[0] && lx <= R[1] && lz >= R[2] && lz <= R[3]; }
// мост: сам разворачивается поперёк русла; null — здесь мост не встаёт (концы должны быть на суше, середина — над водой)
export function bridgeRy(x, z, half = 11.6) {
  if (terrainHeight(x, z) > -0.7) return null;
  let best = null, bw = 1e9;
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a);
    if (terrainHeight(x + sx * half, z + sz * half) < 0.25 || terrainHeight(x - sx * half, z - sz * half) < 0.25) continue;
    let w = 0; for (let k = -half; k <= half; k += 1) if (terrainHeight(x + sx * k, z + sz * k) < -0.7) w++;
    if (w < bw) { bw = w; best = a; }
  }
  return best;
}
export function bridgeDeckY(b) {
  const sx = Math.sin(b.ry || 0), sz = Math.cos(b.ry || 0);
  return Math.max(1.1, terrainHeight(b.x + sx * 12, b.z + sz * 12) + 0.15, terrainHeight(b.x - sx * 12, b.z - sz * 12) + 0.15);
}
// горбатый мост: настил поднимается к середине на PONS_RISE — под сводом проходят лодки
export const PONS_HALF = 12, PONS_RISE = 4;
// лавка торговца (y=0 — уровень моря): двор и причал
export const TRADER_DECKS = [[-6, 6, -10, -0.2, 0.9], [-1.5, 1.5, -0.4, 18.6, 1.2]];
let TRADERS = [];
export const PONS_DECK = [-2.1, 2.1, -12.4, 12.4];
export const ponsLift = (lz) => PONS_RISE * Math.max(0, 1 - (lz / PONS_HALF) ** 2);
// мощёные площади и улицы: по ним ходят на высоте плит
const PLATFORMS = { forum_m: [-36, 36, -26, 26, 0.2], forum: [-10, 10, -10, 10, 0.25] };
// ростры на форуме Мессаны (в координатах форума): помост и лестница сзади
export const ROSTRA_TOP = [-32, -26, -6, 6, 3.34], ROSTRA_STAIRS = [-35.3, -32, -2, 2];
export function rostraAt(x, z, blds) {
  if (blds) for (const b of blds) {
    if (b.type !== 'forum_m' || Math.abs(x - b.x) > 40 || Math.abs(z - b.z) > 40) continue;
    if (inRect(x, z, b.x, b.z, b.ry || 0, ROSTRA_TOP)) return { b, part: 'top' };
    if (inRect(x, z, b.x, b.z, b.ry || 0, ROSTRA_STAIRS)) return { b, part: 'stairs' };
  }
  return null;
}
let STREETS = [];
// абордаж: палубы двух сцепленных кораблей и мостик между ними — по ним ходят как по земле
let BOARD_DECKS = []; export function setBoardDecks(l) { BOARD_DECKS = l || []; }
export function deckHeight(x, z, blds) {
  let y = null;
  for (const r of BOARD_DECKS) { const dx = x - r.x, dz = z - r.z, R = r.hw + r.hl; if (Math.abs(dx) > R || Math.abs(dz) > R) continue; const c = Math.cos(r.ry), s = Math.sin(r.ry), lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) <= r.hw && Math.abs(lz) <= r.hl && (y == null || r.y > y)) y = r.y; }
  for (const st of STREETS) { if (x < st.box[0] || x > st.box[1] || z < st.box[2] || z > st.box[3]) continue; if (segDist(x, z, st.pts[0], st.pts[1]) < st.w / 2) { y = terrainHeight(x, z) + 0.12; break; } }
  if (Math.abs(x - PIER.x) < 25 && Math.abs(z - PIER.z) < 25 && inRect(x, z, PIER.x, PIER.z, PIER.ry, PIER_DECK)) y = PIER_DECK[4];
  for (const t of TRADERS) if (Math.abs(x - t.x) < 25 && Math.abs(z - t.z) < 25) for (const R of TRADER_DECKS) if (inRect(x, z, t.x, t.z, t.ry, R)) { if (y == null || R[4] > y) y = R[4]; }
  for (const b of STATIC_BRIDGES) if (Math.abs(x - b.x) < 16 && Math.abs(z - b.z) < 16 && inRect(x, z, b.x, b.z, b.ry, PONS_DECK)) { const dx = x - b.x, dz = z - b.z, lz = dx * Math.sin(b.ry) + dz * Math.cos(b.ry); const yy = bridgeDeckY(b) + ponsLift(lz); if (y == null || yy > y) y = yy; }
  if (blds) for (const b of blds) {
    if (!b.built || Math.abs(x - b.x) > 58 || Math.abs(z - b.z) > 58) continue;
    if (b.type === 'pons') { if (inRect(x, z, b.x, b.z, b.ry || 0, PONS_DECK)) { const dx = x - b.x, dz = z - b.z, lz = dx * Math.sin(b.ry || 0) + dz * Math.cos(b.ry || 0); const yy = bridgeDeckY(b) + ponsLift(lz); if (y == null || yy > y) y = yy; } continue; }
    const pl = PLATFORMS[b.type];
    if (pl) {
      if (Math.abs(x - b.x) < 40 && Math.abs(z - b.z) < 40 && inRect(x, z, b.x, b.z, b.ry || 0, pl)) {
        const base = bldBase(b, (BUILDINGS[b.type] || {}).r || 10); let yy = base + pl[4];
        if (b.type === 'forum_m') {
          if (inRect(x, z, b.x, b.z, b.ry || 0, ROSTRA_TOP)) yy = base + ROSTRA_TOP[4];
          else if (inRect(x, z, b.x, b.z, b.ry || 0, ROSTRA_STAIRS)) { const lx = (x - b.x) * Math.cos(b.ry || 0) - (z - b.z) * Math.sin(b.ry || 0); yy = base + pl[4] + 3.14 * Math.max(0, Math.min(1, (lx + 35.3) / 3.3)); }
        }
        if (y == null || yy > y) y = yy;
      }
      continue;
    }
    if (b.type !== 'portus') continue;
    if (Math.abs(x - b.x) > 56 || Math.abs(z - b.z) > 56) continue;
    for (const R of PORTUS_DECKS) if (inRect(x, z, b.x, b.z, b.ry || 0, R)) { const yy = bldBase(b, 20) + R[4]; if (y == null || yy > y) y = yy; }
  }
  return y;
}
export function islandAt(x, z) {
  let best = null, bd = 1e9;
  for (const isl of ISL) {
    if (isl.poly) { const s = sdfBase(x, z); if (s > -150) { const d = s > 0 ? 0 : 1 - s / 300; if (d < bd) { bd = d; best = isl; } } continue; }
    const d = Math.hypot(x - isl.x, z - isl.z) / isl.r; if (d < 1.6 && d < bd) { bd = d; best = isl; }
  }
  return best;
}
export const biomeAt = (x, z) => { const i = islandAt(x, z); return i ? i.biome : 'sea'; };
export const isWater = (x, z) => terrainHeight(x, z) < -0.7;
export const shipOk = (x, z) => terrainHeight(x, z) < -1.3 && Math.abs(x) < CFG.world && Math.abs(z) < CFG.world && !rockAt(x, z, 2);
export function slopeAt(x, z, r) {
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, h = terrainHeight(x + Math.cos(a) * r, z + Math.sin(a) * r); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  const c = terrainHeight(x, z); lo = Math.min(lo, c); hi = Math.max(hi, c);
  return { lo, hi, d: hi - lo };
}
// направление к открытой воде (для гаваней): угол ry, при котором +Z смотрит в море
export function seaDir(x, z, r) {
  let best = null, bs = 0;
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2; let s = 0;
    for (let k = r + 2; k <= r + 34; k += 4) { const h = terrainHeight(x + Math.sin(a) * k, z + Math.cos(a) * k); if (h < -1.3) s += 1 + Math.min(3, -h / 3); }
    if (s > bs) { bs = s; best = a; }
  }
  return bs >= 3 ? best : null;
}
// береговое здание (гавань, маяк, рыбный промысел): сдвигаем к самой кромке воды — набережная у воды, причалы уходят в море
export function shoreSnap(x, z, r, front = 1.5) {
  const ry = seaDir(x, z, r); if (ry == null) return null;
  const sx = Math.sin(ry), sz = Math.cos(ry);
  let d = -r; while (d < r + 40 && terrainHeight(x + sx * d, z + sz * d) > -0.2) d += 0.5;
  if (d >= r + 40) return null;
  let back = front; while (back < front + 14 && terrainHeight(x + sx * (d - back), z + sz * (d - back)) < 0.35) back += 0.5;
  const nx = x + sx * (d - back), nz = z + sz * (d - back);
  if (terrainHeight(nx, nz) < 0.3) return null;
  const ry2 = seaDir(nx, nz, r); return { x: nx, z: nz, ry: ry2 == null ? ry : ry2 };
}
export const SHORE_FRONT = { portus: 3, pharos: 4, fishery: 1.5 };
// точка на берегу острова в направлении a (последняя сухая точка)
export function shorePoint(isl, a, inset = 4) {
  let lastLand = null;
  for (let d = isl.r * 0.3; d < isl.r * 1.5; d += 2) {
    const x = isl.x + Math.cos(a) * d, z = isl.z + Math.sin(a) * d;
    if (terrainHeight(x, z) > 0.3) lastLand = d; else if (lastLand && d - lastLand > 6) break;
  }
  if (!lastLand) return null;
  const d = lastLand - inset;
  return { x: isl.x + Math.cos(a) * d, z: isl.z + Math.sin(a) * d, ry: a, a };
}

// ---------- Города: стены, улицы, общественные здания на своих местах, акведук, пригороды ----------
export const SIC_BOX = [-1400, 1470, -770, 1040];
const CITY_SLOTS = [
  // [тип, u/R, v/R] — желаемое место (v — к гавани); точное место подбирается без наложений
  ['curia', -0.42, -0.08], ['templum', 0, -0.45], ['mercator', 0.4, -0.12], ['thermae', -0.45, -0.45], ['armamentarium', 0.48, -0.45],
  ['theatrum', -0.6, 0.12], ['horreum', -0.3, 0.42], ['stabulum', 0.6, 0.25],
];
export const STALL_CLASSES = ['Хлеб и зерно', 'Вино и масло', 'Рыба', 'Ткани', 'Железо и оружие', 'Гончарные товары', 'Плоды и оливки', 'Пурпур и украшения'];
const AQUEDUCTS = [];
function segCross(a, b, c, d) { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); }
function genCities(W, rnd, addPoi) {
  W.cities = []; AQUEDUCTS.length = 0;
  for (const c of CITY_LIST) {
    const C = { id: c.id, name: c.name, owner: c.owner, x: c.x, z: c.z, R: c.R, ry: c.ry, hx: c.hx, hz: c.hz, harbor: c.harbor, layout: [], streets: [], gates: [], aqueduct: null, suburbs: [], spies: [] };
    const coastV = c.inland ? c.R : c.R * 0.62;
    const occ = [];
    const W2L = (x, z) => cityLocal(c, x, z);
    const free = (u, v, r, inside = true) => {
      const [x, z] = cityPt(c, u, v);
      if (inside && Math.hypot(u, v) + r > c.R - 7) return false;
      if (inside && v + r * 0.6 > coastV - 3 && !c.inland) return false;
      if (Math.abs(u) < r + 5 && v < coastV) return false; // кардо
      if (Math.abs(v) < r + 5) return false; // декуманус
      for (const o of occ) if (Math.hypot(o.x - x, o.z - z) < o.r + r + 3) return false;
      for (let i = 0; i < 6; i++) { const a = i * 1.047; if (terrainHeight(x + Math.cos(a) * r * 0.8, z + Math.sin(a) * r * 0.8) < 1.2) return false; }
      return terrainHeight(x, z) > 1.2;
    };
    const put = (type, u, v, ry, extra = {}) => { const [x, z] = cityPt(c, u, v); const r = BUILDINGS[type] ? BUILDINGS[type].r : 4; occ.push({ x, z, r }); const L = { type, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, ry: Math.round(ry * 100) / 100, ...extra }; C.layout.push(L); return L; };
    const place = (type, pu, pv, inside = true) => {
      const r = BUILDINGS[type].r;
      for (let k = 0; k < 500; k++) {
        const rad = 3.2 * Math.sqrt(k), a = k * 2.399;
        const u = pu + Math.cos(a) * rad, v = pv + Math.sin(a) * rad;
        if (free(u, v, r, inside)) { const face = Math.abs(u) <= Math.abs(v) ? (u > 0 ? -Math.PI / 2 : Math.PI / 2) : (v > 0 ? Math.PI : 0); return put(type, u, v, c.ry + face, { lane: true }); }
      }
      return null;
    };
    // форум на перекрёстке кардо и декуманус
    const F = c.id === 'messana' ? 'forum_m' : 'forum';
    put(F, 0, 0, c.ry);
    if (c.id === 'messana') occ.push({ x: START.x, z: START.z, r: 13 });
    // лавки рынка: на большом форуме Мессаны — два ряда, в других городах — вдоль кардо к гавани
    const Fr = BUILDINGS[F].r;
    for (let k = 0; k < 8; k++) {
      if (c.id === 'messana') { const row = k < 4 ? -1 : 1, i = k % 4; put('stall', -12.75 + i * 8.5, row * 6.5, c.ry + (row < 0 ? 0 : Math.PI), { cls: k }); }
      else { const side = k % 2 ? 1 : -1, i = k >> 1, v = (c.inland ? -1 : 1) * (Fr + 6 + i * 7); put('stall', side * 9, v, c.ry + side * Math.PI / 2 + (side > 0 ? Math.PI : 0), { cls: k }); }
    }
    for (const [type, fu, fv] of CITY_SLOTS) place(type, fu * c.R, fv * c.R);
    if (c.id === 'messana') place('campus', 0.45 * c.R, 0.3 * c.R);
    if (!c.inland) {
      // гавань у самой воды: причалы уходят в море
      const [hx, hz] = cityPt(c, 0, -3, true), sp0 = shoreSnap(hx, hz, 20, SHORE_FRONT.portus);
      // гавань — строго по берегу города: причалы смотрят прямо в море
      let sp = null; if (sp0) { const [u0, v0] = cityLocal(c, sp0.x, sp0.z); const [qx, qz] = cityPt(c, 0, v0); sp = { x: qx, z: qz, ry: c.ry }; }
      if (sp) { C.layout.push({ type: 'portus', x: Math.round(sp.x * 10) / 10, z: Math.round(sp.z * 10) / 10, ry: Math.round(sp.ry * 100) / 100 }); for (const ox of [-26, 0, 26]) { occ.push({ x: sp.x + Math.cos(sp.ry) * ox, z: sp.z - Math.sin(sp.ry) * ox, r: 22 }); occ.push({ x: sp.x + Math.cos(sp.ry) * ox + Math.sin(sp.ry) * 30, z: sp.z - Math.sin(sp.ry) * ox + Math.cos(sp.ry) * 30, r: 22 }); } C.portusV = cityLocal(c, sp.x, sp.z)[1]; }
      // невольничий рынок — у гавани, но не вплотную к причалам
      place('servile', 0.42 * c.R, coastV - 24);
      // маяк на конце мола
      const m = MOLES.find((q) => q.city === c.id);
      if (m) { const a = m.pts[m.pts.length - 2], b = m.pts[m.pts.length - 1], ry = Math.atan2(b[0] - a[0], b[1] - a[1]); C.layout.push({ type: 'pharos', x: Math.round(b[0] * 10) / 10, z: Math.round(b[1] * 10) / 10, ry: Math.round(ry * 100) / 100, mole: true }); }
    }
    // ворота: концы декуманус и кардо (со стороны суши)
    for (const [du, dv] of [[1, 0], [-1, 0], [0, -1]]) { const [gx, gz] = cityPt(c, du * c.R, dv * c.R), a = Math.atan2(gx - c.x, gz - c.z); if (terrainHeight(gx, gz) > 1 && terrainHeight(gx + Math.sin(a) * 14, gz + Math.cos(a) * 14) > 1) C.gates.push({ x: gx, z: gz, a }); }
    if (c.inland) { const [gx, gz] = cityPt(c, 0, c.R); C.gates.push({ x: gx, z: gz, a: Math.atan2(gx - c.x, gz - c.z) }); }
    // акведук: от склона горы к водонапорной башне, стоящей вплотную к стене (не выше стен, не через здания и чужие акведуки)
    {
      const top = CITY_H + 5.2, blockers = [...C.layout, ...W.cities.flatMap((o) => o.layout)].filter((l) => l.outside).map((l) => ({ x: l.x, z: l.z, r: BUILDINGS[l.type].r + 8 }));
      let best = null;
      for (let pass = 0; pass < 3 && !best; pass++) for (let ai = 0; ai < 126; ai++) { // второй проход — мягче (склон пониже)
        const a = ai * 0.05, sx = Math.sin(a), sz = Math.cos(a), tx = c.x + sx * (c.R + 5.5), tz = c.z + sz * (c.R + 5.5);
        if (terrainHeight(tx, tz) < (pass > 1 ? 0.6 : 1.2) || waterEdgeDist(tx, tz) < (pass > 1 ? 3 : 8) || sdfBase(tx, tz) < 12) continue;
        if (C.gates.some((g) => Math.hypot(g.x - tx, g.z - tz) < 26)) continue;
        let src = null, vis = 0;
        for (let d = c.R + 14; d < c.R + 600; d += 6) {
          const x = c.x + sx * d, z = c.z + sz * d, h = terrainHeight(x, z);
          if (h < 0.8 || waterEdgeDist(x, z) < (pass ? 2 : 5) || CITY_LIST.some((o) => o !== c && Math.hypot(x - o.x, z - o.z) < o.R + 40)) break;
          if (h < top - 1) vis += 6;
          if (h >= top + [10, 3, 1.5][pass] && d >= c.R + (pass ? 25 : 40)) { src = { x, z, d, sc: vis - (d - c.R) * 0.25 }; break; } // исток — на настоящей горе
        }
        if (!src || vis < [24, 10, 0][pass] || (best && src.sc <= best.sc)) continue;
        const seg = [[tx, tz], [src.x, src.z]];
        if (blockers.some((o) => polyDist(o.x, o.z, seg) < o.r)) continue;
        if (AQUEDUCTS.some((q) => segCross(q[0], q[1], seg[0], seg[1]) || polyDist(q[0][0], q[0][1], seg) < 30 || polyDist(q[1][0], q[1][1], seg) < 30)) continue;
        best = { a, tx, tz, x: src.x, z: src.z, d: src.d, sc: src.sc };
      }
      if (best) {
        AQUEDUCTS.push([[best.tx, best.tz], [best.x, best.z]]);
        const sx = Math.sin(best.a), sz = Math.cos(best.a);
        C.layout.push({ type: 'castellum', x: Math.round(best.tx * 10) / 10, z: Math.round(best.tz * 10) / 10, ry: Math.round(best.a * 100) / 100, outside: true });
        C.aqueduct = { from: [best.x, best.z], to: [best.tx + sx * 3.5, best.tz + sz * 3.5], top };
        for (let d = 0; d < best.d - c.R; d += 8) occ.push({ x: best.tx + sx * d, z: best.tz + sz * d, r: 4 });
      }
    }
    // за стенами, на ровном месте: арена (амфитеатр для гладиаторов) и театр, если в стенах тесно
    const outside = (type, a0, step, d0) => {
      const r = BUILDINGS[type].r;
      for (let k = 0; k < 800; k++) {
        const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step, d = c.R + d0 + (k % 5) * 8 + Math.floor((k % 400) / 100) * 30;
        const u = Math.cos(a) * d, v = Math.sin(a) * d, [x, z] = cityPt(c, u, v);
        if (sdfBase(x, z) < r + 24 || waterEdgeDist(x, z) < (k < 400 ? r + 20 : r + 6) || CITY_LIST.some((o) => o !== c && Math.hypot(x - o.x, z - o.z) < o.R + 80)) continue;
        if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.r * 0.8 || occ.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 6)) continue;
        const sl = slopeAt(x, z, r); if (k < 400 && (sl.hi > CITY_H + 8 || sl.hi - sl.lo > 9)) continue; // только ровное место, не на холме
        const h = Math.max(CITY_H, Math.min(CITY_H + 1, terrainHeight(x, z))); FLATS.push({ x, z, r: r + 6, h, fall: r + 70 }); occ.push({ x, z, r }); // широкий плавный спуск к площадке — без крутых холмов
        return C.layout.push({ type, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, ry: Math.round(Math.atan2(c.x - x, c.z - z) * 100) / 100, outside: true });
      }
    };
    if (c.id === 'messana' || c.id === 'syracusae') outside('amphitheatrum', -Math.PI / 2, 0.09, 64); // арены — только в Мессане и Сиракузах
    if (c.id !== 'messana' && !C.layout.some((l) => l.type === 'theatrum')) outside('theatrum', -Math.PI / 2 + 1.2, 0.08, 34);
    // улицы: кардо (от ворот к гавани) и декуманус (между воротами)
    const cardoEnd = c.inland ? c.R + 4 : (C.portusV != null ? C.portusV - 16 : coastV - 2);
    C.streets.push({ w: 8, pts: [cityPt(c, 0, -c.R - 4), cityPt(c, 0, cardoEnd)] });
    C.streets.push({ w: 8, pts: [cityPt(c, -c.R - 4, 0), cityPt(c, c.R + 4, 0)] });
    // переулки: от входа каждого здания к ближайшей главной улице
    // New civic buildings follow the same cell grid as player construction.
    const guildN=cellsOf('collegium'),guildR=BUILDINGS.collegium.r;
    let guild=null;
    for(const inside of [true,false]){
      const [gx,gz]=cityPt(c,inside?-.55*c.R:-c.R-32,inside?.35*c.R:-30),base=blockSnap(c,gx,gz,guildN),seen=new Set();
      for(let k=0;k<1600&&!guild;k++){
        const i0=base.i0+Math.round(Math.cos(k*2.399)*Math.sqrt(k)),j0=base.j0+Math.round(Math.sin(k*2.399)*Math.sqrt(k)),key=i0+':'+j0;
        if(seen.has(key))continue;seen.add(key);
        const u=(i0+guildN/2)*CELL,v=(j0+guildN/2)*CELL,[x,z]=cityPt(c,u,v);
        if(!free(u,v,guildR,inside)||portOverlap(x,z,guildR,C.layout.filter(b=>b.type==='portus')))continue;
        const face=Math.abs(u)<=Math.abs(v)?(u>0?-Math.PI/2:Math.PI/2):(v>0?Math.PI:0);
        guild=put('collegium',u,v,c.ry+face,{lane:true,grid:{i0,j0,n:guildN}});
      }
      if(guild)break;
    }
    for (const L of C.layout) {
      if (!L.lane) continue;
      const r = BUILDINGS[L.type].r, fx = Math.sin(L.ry), fz = Math.cos(L.ry);
      const [u0, v0] = cityLocal(c, L.x + fx * (r + 0.5), L.z + fz * (r + 0.5));
      const toCardo = Math.abs(u0) <= Math.abs(v0), [u1, v1] = toCardo ? [Math.sign(u0) * 4, v0] : [u0, Math.sign(v0) * 4];
      if (Math.hypot(u1 - u0, v1 - v0) < 1) continue;
      const a = cityPt(c, u0, v0), b = cityPt(c, u1, v1);
      const hit = C.layout.some((o) => o !== L && polyDist(o.x, o.z, [a, b]) < ((BUILDINGS[o.type] || {}).r || 3) * 0.8);
      if (!hit) C.streets.push({ w: 3.6, pts: [a, b], lane: true });
    }
    // пригороды и места для слежки — у вражеских городов
    if (c.owner !== 'rome') {
      for (let k = 0, n = 0; k < 300 && n < 3; k++) {
        const a = rnd() * Math.PI * 2, d = c.R + 50 + rnd() * 90, x = c.x + Math.sin(a) * d, z = c.z + Math.cos(a) * d;
        if (sdfBase(x, z) < 25 || waterEdgeDist(x, z) < 40 || slopeAt(x, z, 10).d > 5 || C.layout.some((l) => Math.hypot(l.x - x, l.z - z) < 60) || AQUEDUCTS.some((q) => polyDist(x, z, q) < 40) || C.suburbs.some((q) => Math.hypot(q.x - x, q.z - z) < 50)) continue;
        FLATS.push({ x, z, r: 13, h: Math.max(1.2, terrainHeight(x, z)) }); const p = addPoi('suburb_villa', x, z, { r: 12, city: c.id, name: 'Пригородная усадьба' }); C.suburbs.push({ poi: p.id, x, z }); n++;
      }
      for (let k = 0, n = 0; k < 900 && n < 3; k++) {
        const a = (n / 3) * Math.PI * 2 + rnd() * 2.5, d = c.R + 16 + rnd() * (60 + k * 0.15), x = c.x + Math.sin(a) * d, z = c.z + Math.cos(a) * d;
        if (terrainHeight(x, z) < 1.2 || waterEdgeDist(x, z) < 6 || C.suburbs.some((q) => Math.hypot(q.x - x, q.z - z) < 25)) continue;
        const p = addPoi('spy_post', x, z, { r: 3, city: c.id }); C.spies.push({ poi: p.id, x, z }); n++;
      }
    }
    W.cities.push(C);
  }
  W.roads = genRoads(W);
  setMuniFootprints(W.cities);
  STREETS = W.cities.flatMap((C) => C.streets.map((st) => { const [a, b] = st.pts; return { pts: st.pts, w: st.w, box: [Math.min(a[0], b[0]) - st.w, Math.max(a[0], b[0]) + st.w, Math.min(a[1], b[1]) - st.w, Math.max(a[1], b[1]) + st.w] }; }));
}
// ---------- Римские дороги между городами (поиск пути по рельефу; мосты через реки) ----------
const ROAD_LINKS = [['messana', 'tyndaris'], ['tyndaris', 'panormus'], ['panormus', 'hybla'], ['hybla', 'syracusae'], ['syracusae', 'catana'], ['catana', 'messana'], ['catana', 'hybla']];
function genRoads(W) {
  const S = 16, X0 = SIC_BOX[0] - 40, Z0 = SIC_BOX[2] - 40, NX = Math.ceil((SIC_BOX[1] - X0 + 40) / S), NZ = Math.ceil((SIC_BOX[3] - Z0 + 40) / S);
  const H = new Float32Array(NX * NZ), WT = new Uint8Array(NX * NZ);
  const OBST = [...W.cities.flatMap((C) => C.layout.filter((l) => l.outside).map((l) => ({ x: l.x, z: l.z, r: BUILDINGS[l.type].r }))), ...W.pois.filter((q) => q.r >= 6).map((q) => ({ x: q.x, z: q.z, r: q.r }))].filter((q) => !W.cities.some((C) => C.gates.some((g) => Math.hypot(g.x - q.x, g.z - q.z) < q.r + 40)));
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const x = X0 + i * S, z = Z0 + j * S, o = j * NX + i; H[o] = terrainHeight(x, z); WT[o] = H[o] < 0.6 ? (waterEdgeDist(x, z) < 3 && sdfBase(x, z) > 30 ? 2 : 1) : 0; if (CITY_LIST.some((c) => Math.hypot(x - c.x, z - c.z) < c.R + 3)) WT[o] = 3; if (OBST.some((q) => Math.abs(q.x - x) < q.r + 10 && Math.abs(q.z - z) < q.r + 10 && Math.hypot(q.x - x, q.z - z) < q.r + 9)) WT[o] = 3; if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.r * 0.55) WT[o] = 1; }
  const cell = (x, z) => [Math.round((x - X0) / S), Math.round((z - Z0) / S)];
  const roads = [];
  for (const [a, b] of ROAD_LINKS) {
    const A = W.cities.find((c) => c.id === a), B = W.cities.find((c) => c.id === b);
    const gate = (C, T) => C.gates.reduce((m, g) => (Math.hypot(g.x - T.x, g.z - T.z) < Math.hypot(m.x - T.x, m.z - T.z) ? g : m));
    const ga = gate(A, B), gb = gate(B, A);
    const out = (g, C) => [g.x + Math.sin(g.a) * 14, g.z + Math.cos(g.a) * 14];
    const [sx, sz] = cell(...out(ga, A)), [tx, tz] = cell(...out(gb, B));
    // A* по сетке 16 м
    const N = NX * NZ, gS = new Float32Array(N).fill(1e30), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const heap = [], push = (o, f) => { heap.push([f, o]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const s0 = sz * NX + sx, t0 = tz * NX + tx; gS[s0] = 0; push(s0, 0);
    while (heap.length) {
      const [, o] = pop(); if (done[o]) continue; done[o] = 1; if (o === t0) break;
      const i = o % NX, j = (o / NX) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
        const q = nj * NX + ni; if (done[q] || (WT[q] && WT[q] !== 2 && q !== t0)) continue;
        const L = Math.hypot(di, dj) * S, dh = Math.abs(H[q] - H[o]);
        const c = L * (1 + (dh / L) * 14 + Math.max(0, H[q] - 30) * 0.02) + (WT[q] === 2 ? 900 : 0);
        const g = gS[o] + c; if (g < gS[q]) { gS[q] = g; from[q] = o; push(q, g + Math.hypot(ni - tx, nj - tz) * S); }
      }
    }
    if (from[t0] < 0) continue;
    let pts = []; for (let o = t0; o >= 0; o = from[o]) pts.push([X0 + (o % NX) * S, Z0 + ((o / NX) | 0) * S]);
    pts.reverse(); pts.unshift([ga.x, ga.z]); pts.push([gb.x, gb.z]);
    // сглаживание (пара проходов Чайкина)
    for (let it = 0; it < 2; it++) { const q = [pts[0]]; for (let k = 0; k < pts.length - 1; k++) { const p0 = pts[k], p1 = pts[k + 1]; q.push([p0[0] * 0.75 + p1[0] * 0.25, p0[1] * 0.75 + p1[1] * 0.25], [p0[0] * 0.25 + p1[0] * 0.75, p0[1] * 0.25 + p1[1] * 0.75]); } q.push(pts[pts.length - 1]); pts = q; }
    pts = pts.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
    // мосты: где дорога пересекает реку
    const bridges = [];
    for (let k = 1; k < pts.length; k++) {
      const [x, z] = pts[k]; if (terrainHeight(x, z) > -0.7 || sdfBase(x, z) < 20) continue;
      if (bridges.some((b) => Math.hypot(b.x - x, b.z - z) < 30)) continue;
      // центр русла: ближайшая точка с наибольшей глубиной поблизости
      let bx = x, bz = z, bd = terrainHeight(x, z);
      for (let a = 0; a < 6.28; a += 0.5) for (let r = 2; r < 10; r += 2) { const h = terrainHeight(x + Math.cos(a) * r, z + Math.sin(a) * r); if (h < bd) { bd = h; bx = x + Math.cos(a) * r; bz = z + Math.sin(a) * r; } }
      const ry = bridgeRy(bx, bz); if (ry != null) bridges.push({ x: Math.round(bx * 10) / 10, z: Math.round(bz * 10) / 10, ry: Math.round(ry * 100) / 100 });
    }
    roads.push({ id: a + '-' + b, a, b, pts, bridges });
  }
  ROADS = roads; buildRoadGrid();
  return roads;
}
// дороги: быстрый поиск «на дороге ли точка» (сетка 8 м)
let ROADS = [], ROAD_GRID = new Set(), STATIC_BRIDGES = [];
function buildRoadGrid() {
  ROAD_GRID = new Set(); STATIC_BRIDGES = [];
  const mark = (pts, w) => { for (let k = 0; k < pts.length - 1; k++) { const [ax, az] = pts[k], [bx, bz] = pts[k + 1], L = Math.hypot(bx - ax, bz - az); for (let d = 0; d <= L; d += 3) { const x = ax + (bx - ax) * d / L, z = az + (bz - az) * d / L; for (let ox = -w; ox <= w; ox += 4) for (let oz = -w; oz <= w; oz += 4) ROAD_GRID.add(Math.floor((x + ox) / 8) + ',' + Math.floor((z + oz) / 8)); } } };
  for (const c of CITY_LIST) { mark([cityPt(c, 0, -c.R - 4), cityPt(c, 0, c.R)], 3); mark([cityPt(c, -c.R - 4, 0), cityPt(c, c.R + 4, 0)], 3); }
  for (const r of ROADS) { mark(r.pts, 2); for (const b of r.bridges) STATIC_BRIDGES.push({ ...b, type: 'pons', built: true, id: 'sb' + STATIC_BRIDGES.length }); }
}
export const roadsList = () => ROADS;
export const staticBridges = () => STATIC_BRIDGES;
export const onRoadNet = (x, z) => ROAD_GRID.has(Math.floor(x / 8) + ',' + Math.floor(z / 8));

// ---------- Районы и клетки городов (4×4 м, сетка повёрнута по улицам города) ----------
export function districtAt(x, z) {
  for (const C of CITY_LIST) {
    const dx = x - C.x, dz = z - C.z; if (Math.abs(dx) > C.R + 150 || Math.abs(dz) > C.R + 150) continue;
    const d = Math.hypot(dx, dz); if (d > C.R + 140) continue;
    const [u, v] = cityLocal(C, x, z);
    let k = null;
    if (!C.inland && Math.hypot(x - C.hx, z - C.hz) < 72 && d < C.R + 30) k = 'harbor';
    else if (d < C.R * 0.52) k = 'center';
    else if (d < C.R - 5) k = 'outer';
    else if (d > C.R + 7) k = 'extra';
    return k ? { city: C.id, C, d: k, u, v } : null;
  }
  return null;
}
export const cellOf = (C, x, z) => { const [u, v] = cityLocal(C, x, z); return [Math.floor(u / CELL), Math.floor(v / CELL)]; };
export const cellCenter = (C, i, j) => cityPt(C, (i + 0.5) * CELL, (j + 0.5) * CELL);
// блок n×n клеток, ближайший к точке: центр блока и первая клетка
export function blockSnap(C, x, z, n) { const [u, v] = cityLocal(C, x, z); const i0 = Math.round(u / CELL - n / 2), j0 = Math.round(v / CELL - n / 2); const [bx, bz] = cityPt(C, (i0 + n / 2) * CELL, (j0 + n / 2) * CELL); return { i0, j0, x: bx, z: bz }; }
// клетка свободна от улиц, стен, воды и городских зданий
const _muni = new Map(), _ports = new Map();
// Reserve the harbour's wings, quay, piers and approach, rather than one small circle.
export function portOverlap(x,z,r,ports){
  return ports.some(b=>{const dx=x-b.x,dz=z-b.z,c=Math.cos(b.ry||0),s=Math.sin(b.ry||0),lx=dx*c-dz*s,lz=dx*s+dz*c;
    const boxes=[[-44,44,-25,12],[-44,44,0,PORTUS_LEN+8],[-8,8,-42,12]];
    return boxes.some(([x0,x1,z0,z1])=>Math.hypot(lx-Math.max(x0,Math.min(x1,lx)),lz-Math.max(z0,Math.min(z1,lz)))<r+3);
  });
}
// цена клетки (денарии): у каждой клетки своя — по району, близости к форуму и гавани и «удачности» места
export function cellPrice(C, i, j) {
  const [x, z] = cellCenter(C, i, j), dd = districtAt(x, z); if (!dd) return null;
  const base = DISTRICTS[dd.d].price, dc = Math.hypot(x - C.x, z - C.z), dh = C.hx != null ? Math.hypot(x - C.hx, z - C.hz) : 1e9;
  const k = 0.7 + 0.55 * Math.max(0, 1 - dc / (C.R + 140)) + 0.3 * Math.max(0, 1 - dh / 90) + 0.25 * hash2(i * 7 + 3, j * 11 + 5);
  return Math.max(2, Math.round(base * k));
}
export function cellFree(C, i, j) {
  const u = (i + 0.5) * CELL, v = (j + 0.5) * CELL, d = Math.hypot(u, v);
  if (Math.abs(u) < 6.5 && d < C.R + 140) return false; // кардо (и дорога от ворот)
  if (Math.abs(v) < 6.5 && d < C.R + 140) return false; // декуманус
  if (d > C.R - 6 && d < C.R + 8) return false; // стены
  const [x, z] = cityPt(C, u, v);
  if (terrainHeight(x, z) < 1.1 || waterEdgeDist(x, z) < 3 || onRoadNet(x, z) || portOverlap(x,z,CELL*.72,_ports.get(C.id)||[])) return false;
  let L = _muni.get(C.id); if (!L) { L = []; _muni.set(C.id, L); }
  for (const b of L) if (Math.hypot(b.x - x, b.z - z) < b.r + 2.2) return false;
  return true;
}
export function setMuniFootprints(cities) { _ports.clear(); for(const C of cities)_ports.set(C.id,C.layout.filter(l=>l.type==='portus')); _muni.clear(); for (const c of cities) _muni.set(c.id, c.layout.map((l) => ({ x: l.x, z: l.z, r: (BUILDINGS[l.type] || {}).r || 4 })).concat(c.layout.filter((l) => l.type === 'portus').flatMap((l) => [-26, 0, 26].flatMap((ox) => [0, 26].map((oz) => ({ x: l.x + Math.cos(l.ry) * ox + Math.sin(l.ry) * oz, z: l.z - Math.sin(l.ry) * ox + Math.cos(l.ry) * oz, r: 20 })))))); }
// точка высадки с моря у цели (x,z): берег и направление в море (a: cos/sin)
export function seaApproach(x, z, spread = 0) {
  const isl = islandAt(x, z); if (!isl) return null;
  if (!isl.poly) { const a = Math.atan2(z - isl.z, x - isl.x) + spread; const sp = shorePoint(isl, a, 3); return sp ? { x: sp.x, z: sp.z, a } : null; }
  const g = sdfGrad(x, z, 70), c = Math.cos(spread), sn = Math.sin(spread), gx = g.x * c - g.z * sn, gz = g.x * sn + g.z * c;
  for (let d = 0; d < 900; d += 3) { const px = x - gx * d, pz = z - gz * d; if (terrainHeight(px, pz) < -1.5) return { x: px + gx * 9, z: pz + gz * 9, a: Math.atan2(-gz, -gx) }; }
  return null;
}
// ---------- Генерация ----------
// Мир полностью определяется seed: сервер и клиент считают его одинаково.
export function generateWorld(seed) {
  const rnd = makeRng(seed);
  const R = (a, b) => a + rnd() * (b - a);
  FLATS = [];
  const W = { seed, nodes: [], dens: [], camps: [], chests: [], pois: [], colonySites: [], entrances: [], flats: FLATS };
  let nid = 1;
  const pois = W.pois;
  const farFromPois = (x, z, r) => pois.every((p) => Math.hypot(p.x - x, p.z - z) > r + (p.r || 6));
  const landPoint = (isl, tMin, tMax, hMin = 0.8, hMax = 60, tries = 400, check) => {
    for (let i = 0; i < tries; i++) {
      let x, z;
      if (isl.poly) { x = SIC_BOX[0] + rnd() * (SIC_BOX[1] - SIC_BOX[0]); z = SIC_BOX[2] + rnd() * (SIC_BOX[3] - SIC_BOX[2]); const s = sdfBase(x, z); if (s < tMin * 260 || (tMax < 0.85 && s > tMax * 500)) continue; }
      else { const a = rnd() * Math.PI * 2, d = Math.sqrt(R(tMin * tMin, tMax * tMax)) * isl.r; x = isl.x + Math.cos(a) * d; z = isl.z + Math.sin(a) * d; }
      const h = terrainHeight(x, z);
      if (h < hMin || h > hMax) continue;
      if (isl.poly && waterEdgeDist(x, z) < 38) continue; // на речных склонах ничего не ставим
      if (isl.poly && CITY_LIST.some((c) => Math.hypot(x - c.x, z - c.z) < c.R + 30)) continue;
      if (isl.poly && Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.r * 0.3) continue;
      if (check && !check(x, z, h)) continue;
      return { x, z, h };
    }
    return null;
  };
  const addPoi = (type, x, z, extra = {}) => { const p = { id: 'p' + pois.length, type, x, z, ry: extra.ry ?? rnd() * Math.PI * 2, r: extra.r || 8, ...extra }; pois.push(p); return p; };
  const flat = (x, z, r) => { const h = Math.max(1.2, terrainHeight(x, z)); FLATS.push({ x, z, r, h }); return h; };

  // приют новоприбывших в Мессане (купец, задания, склад), причал стартовой лодки
  addPoi('start_camp', START.x, START.z, { ry: START.ry + Math.PI, r: 13, name: 'Приют новоприбывших' });
  addPoi('pier', PIER.x, PIER.z, { ry: PIER.ry, r: 4 });
  genCities(W, rnd, addPoi);
  addPoi('volcano', VOLCANO.x, VOLCANO.z, { ry: 0, r: 2, name: 'Этна' });
  // скалы и обломки в море
  W.traders = []; TRADERS = W.traders;
  W.traders.push({ id: 'tr_rome', poi: null, name: 'Римский квестор в Остии', x: 900, z: -2480, ry: 0, river: false, mult: 1.15, rome: true });
  SEA_ROCKS.forEach((r, i) => { const p = addPoi(r.wreck ? 'sea_wreck' : 'sea_rock', r.x, r.z, { ry: i * 1.7, r: r.r, name: r.wreck ? 'Обломки на скале' : null, sea: true }); if (r.wreck) { const cx = r.x + r.r * 1.35, cz = r.z + r.r * 0.4; W.chests.push({ id: 'chs' + i, kind: 'sea_wreck', x: cx, z: cz, island: 'sea', sea: true }); } });
  // торговцы у истоков рек (на берегу озера-истока), цены на ящики ниже, чем у морских
  [[0, 'Торговец у озера Пергуза'], [2, 'Торговец у озера Анкипа']].forEach(([li, name], k) => {
    const l = LAKES[li], a = Math.atan2(CITY.z - l.z, CITY.x - l.x) + (k ? 0.5 : -0.5);
    let d = l.r; while (d < l.r + 30 && terrainHeight(l.x + Math.cos(a) * d, l.z + Math.sin(a) * d) < 0.3) d += 0.5;
    const x = l.x + Math.cos(a) * (d + 1), z = l.z + Math.sin(a) * (d + 1), ry = Math.atan2(l.x - x, l.z - z);
    const p = addPoi('trader', x, z, { ry, r: 7, name, trader: true });
    W.traders.push({ id: 'tr' + k, poi: p.id, name, x, z, ry, river: true, mult: 0.8 });
  });

  for (const isl of ISL) {
    const main = isl.id === 'main';
    // торговец острова (назван по городу, откуда прибыл) — у берега со стороны главного острова
    if ((isl.kind === 'colony' || isl.kind === 'egypt') && isl.r >= 50) {
      const TOWN = { ferrum: 'Неаполя', marmor: 'Массилии', murex: 'Тира', silva: 'Тарракона', aegyptus: 'Мемфиса', lipara: 'Кум', hiera: 'Регия', strongyle: 'Локр', ustica: 'Остии', maritima: 'Гадеса', punic: 'Утики', achillea: 'Коринфа' }[isl.id] || 'Остии';
      const base = Math.atan2(130 - isl.z, 40 - isl.x);
      for (let i = 0; i < 12; i++) {
        const sp = shorePoint(isl, base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.18, 1.5); if (!sp) continue;
        const ry = seaDir(sp.x, sp.z, 4); if (ry == null || !farFromPois(sp.x, sp.z, 12)) continue;
        const name = 'Торговец из ' + TOWN, p = addPoi('trader', sp.x, sp.z, { ry, r: 7, name, trader: true });
        W.traders.push({ id: 'tr_' + isl.id, poi: p.id, name, x: sp.x, z: sp.z, ry, river: false, mult: { ferrum: 1.05, marmor: 1.1, murex: 1.2, silva: 1.1, aegyptus: 1.3, achillea: 1.25, maritima: 1.2, ustica: 1.15 }[isl.id] || 1 });
        break;
      }
    }
    // места колоний
    if (isl.kind === 'colony' || isl.kind === 'egypt') {
      for (let k = 0; k < 3; k++) {
        const p = landPoint(isl, 0.05, 0.8, 0.9, 45, 2500, (x, z) => slopeAt(x, z, 9).d < 8 && W.colonySites.every((q) => Math.hypot(q.x - x, q.z - z) > Math.max(34, isl.r * 0.45)) && farFromPois(x, z, 12));
        if (p) { flat(p.x, p.z, 14); W.colonySites.push({ id: 'col_' + isl.id + (k ? '_' + k : ''), island: isl.id, x: p.x, z: p.z }); addPoi('colony_site', p.x, p.z, { r: 14, island: isl.id, name: 'Место для колонии' }); }
      }
    }
    // входы в подземелья
    for (const [k, ins] of Object.entries(INSTANCES)) {
      if (ins.island !== isl.id) continue;
      const p = landPoint(isl, 0.35, 0.75, 2, 40, 800, (x, z) => farFromPois(x, z, 30) && slopeAt(x, z, 6).d < 6);
      if (p) {
        flat(p.x, p.z, 8);
        const kind = k === 'cave' ? 'cave_entrance' : k === 'mine' ? 'mine_entrance' : k === 'tomb' ? 'tomb_entrance' : 'fortress_gate';
        const e = addPoi(kind, p.x, p.z, { r: 8, inst: k, name: ins.name });
        W.entrances.push({ id: k, x: p.x, z: p.z, poi: e.id });
      }
    }
    // лагеря варваров
    const nCamps = main ? 4 : isl.id === 'ferrum' || isl.id === 'silva' ? 1 : 0;
    for (let c = 0; c < nCamps; c++) {
      const p = landPoint(isl, 0.3, 0.8, 1.5, 30, 800, (x, z) => farFromPois(x, z, 50) && slopeAt(x, z, 12).d < 5 && (!main || CITY_LIST.every((c) => Math.hypot(x - c.x, z - c.z) > c.R + 220)) && !AQUEDUCTS.some((q) => polyDist(x, z, q) < 45));
      if (!p) continue;
      flat(p.x, p.z, 17);
      addPoi('barb_camp', p.x, p.z, { r: 17, name: 'Лагерь варваров' });
      W.camps.push({ id: 'camp' + W.camps.length, island: isl.id, x: p.x, z: p.z, lvl: main ? 2 + c * 2 : 6 });
    }
    // Египет
    if (isl.kind === 'egypt') {
      for (let i = 0; i < 3; i++) { const p = landPoint(isl, 0.3, 0.75, 1.5, 20, 800, (x, z) => farFromPois(x, z, 30) && slopeAt(x, z, 14).d < 5); if (p) { flat(p.x, p.z, 16); addPoi('pyramid', p.x, p.z, { r: 16, ry: 0, name: 'Пирамида' }); } }
      for (let i = 0; i < 2; i++) { const p = landPoint(isl, 0.2, 0.7, 1.2, 20, 400, (x, z) => farFromPois(x, z, 15)); if (p) addPoi('obelisk', p.x, p.z, { r: 3 }); }
      const sp = landPoint(isl, 0.2, 0.6, 1.2, 20, 400, (x, z) => farFromPois(x, z, 20)); if (sp) addPoi('sphinx', sp.x, sp.z, { r: 6, name: 'Сфинкс' });
      const sh = landPoint(isl, 0.1, 0.45, 1.2, 20, 600, (x, z) => farFromPois(x, z, 15)); if (sh) { flat(sh.x, sh.z, 7); addPoi('scribe_hut', sh.x, sh.z, { r: 7, name: 'Хижина писца Хеви', npc: 'scribe' }); }
    }
    if (isl.kind === 'pirate') {
      const c = { x: isl.x - 10, z: isl.z + 5 }; flat(c.x, c.z, 20);
      addPoi('barb_camp', c.x, c.z, { r: 17, ry: Math.atan2(-isl.x, -isl.z), name: 'Пиратское логово', pirate: true });
      W.camps.push({ id: 'pirate', island: isl.id, x: c.x, z: c.z, lvl: 7, pirate: true });
      for (let i = 0; i < 2; i++) { const sp = shorePoint(isl, i * 2.6 + 0.8, 2); if (sp) { addPoi('shipwreck', sp.x, sp.z, { r: 8, ry: sp.a + Math.PI / 2, name: 'Разбитый корабль' }); W.chests.push({ id: 'chp' + i, kind: 'ornate', x: sp.x + 1, z: sp.z + 1, island: isl.id }); } }
    }
    if (isl.kind === 'punic') {
      const c = { x: isl.x + 10, z: isl.z - 10 }; flat(c.x, c.z, 34);
      addPoi('punic_fort', c.x, c.z, { r: 34, ry: -Math.PI / 2, name: 'Пунийская крепость' });
      W.camps.push({ id: 'punic', island: isl.id, x: c.x, z: c.z, lvl: 12, punic: true });
    }
    // руины и затонувшие корабли
    const nRuins = main ? 6 : 1;
    for (let i = 0; i < nRuins; i++) { const p = landPoint(isl, 0.2, 0.85, 1.5, 30, 400, (x, z) => farFromPois(x, z, 25) && slopeAt(x, z, 8).d < 4); if (p) { flat(p.x, p.z, 9); addPoi('ruin', p.x, p.z, { r: 9, name: 'Древние руины' }); W.chests.push({ id: 'ch' + W.chests.length, kind: rnd() < 0.3 ? 'ornate' : 'chest', x: p.x + R(-3, 3), z: p.z + R(-3, 3), island: isl.id }); } }
    for (let i = 0; i < (main ? 5 : 1); i++) {
      const sp = main ? null : shorePoint(isl, rnd() * Math.PI * 2, 2);
      if (sp && farFromPois(sp.x, sp.z, 20) && !(main && Math.hypot(sp.x - CITY.x, sp.z - CITY.z) < CITY.r + 40)) { addPoi('shipwreck', sp.x, sp.z, { r: 8, ry: sp.a + Math.PI / 2, name: 'Остов корабля' }); W.chests.push({ id: 'ch' + W.chests.length, kind: 'wreck', x: sp.x + R(-2, 2), z: sp.z + R(-2, 2), island: isl.id }); }
    }
    // разбросанные ящики и сундуки
    const nCh = main ? 40 : Math.round(isl.r / 45);
    for (let i = 0; i < nCh; i++) { const p = landPoint(isl, 0.1, 0.92, 0.8, 40, 200, (x, z) => farFromPois(x, z, 6)); if (p) W.chests.push({ id: 'ch' + W.chests.length, kind: rnd() < 0.6 ? 'crate' : 'chest', x: p.x, z: p.z, island: isl.id }); }

    // ресурсы
    const area = isl.poly ? 62 : isl.r * isl.r * 3.14 / 10000; // гектары/100 (Сицилия — пореже)
    const put = (kind, res, tool, n, tMin, tMax, hMin, hMax, amt, sMin = 0.85, sMax = 1.25, check) => {
      for (let i = 0; i < n; i++) {
        const p = landPoint(isl, tMin, tMax, hMin, hMax, 40, (x, z, h) => farFromPois(x, z, 4) && (!main || !onRoadNet(x, z)) && (!check || check(x, z, h)));
        if (!p) continue;
        W.nodes.push({ id: nid++, kind, res, tool, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, s: R(sMin, sMax), ry: rnd() * 6.28, max: amt, island: isl.id });
      }
    };
    const B = isl.biome;
    if (B === 'med') {
      put('olive', 'wood', 'axe', area * 22, 0.05, 0.9, 1.2, 20, 6);
      put('pine', 'wood', 'axe', area * 26, 0.15, 0.95, 3, 45, 8);
      put('cypress', 'wood', 'axe', area * 10, 0.05, 0.8, 1.5, 25, 5);
      put('oak', 'wood', 'axe', area * 14, 0.3, 0.95, 4, 40, 9);
      put('stone', 'stone', 'pick', area * 12, 0.1, 0.95, 2, 60, 10);
      put('clay', 'clay', null, area * 6, 0.05, 0.6, 0.6, 6, 10);
      put('iron', 'iron_ore', 'pick', area * 2.5, 0.4, 0.95, 12, 80, 8);
      put('marble', 'marble', 'pick', area * 1.5, 0.4, 0.95, 10, 80, 6);
    } else if (B === 'rock') {
      put('pine', 'wood', 'axe', area * 10, 0.1, 0.9, 2, 30, 7);
      put('stone', 'stone', 'pick', area * 18, 0.1, 0.95, 1, 60, 10);
      if (isl.id === 'ferrum') put('iron', 'iron_ore', 'pick', area * 22, 0.1, 0.95, 2, 70, 10);
      if (isl.id === 'marmor') put('marble', 'marble', 'pick', area * 24, 0.1, 0.95, 2, 70, 10);
      if (isl.id === 'punic') put('iron', 'iron_ore', 'pick', area * 4, 0.3, 0.95, 2, 70, 8);
    } else if (B === 'beach') {
      put('palm', 'wood', 'axe', area * 22, 0.05, 0.9, 0.8, 12, 5);
      put('murex', 'murex', null, area * 26, 0.85, 1.03, -0.6, 1.2, 4, 0.8, 1.2);
      put('stone', 'stone', 'pick', area * 6, 0.2, 0.9, 1, 12, 8);
    } else if (B === 'forest') {
      put('cedar', 'cedar', 'axe', area * 30, 0.1, 0.95, 1.5, 40, 6);
      put('oak', 'wood', 'axe', area * 26, 0.05, 0.95, 1, 40, 9);
      put('pine', 'wood', 'axe', area * 16, 0.2, 0.95, 3, 40, 8);
      put('silver', 'silver_ore', 'pick', area * 7, 0.35, 0.95, 6, 60, 6);
      put('stone', 'stone', 'pick', area * 6, 0.2, 0.95, 2, 60, 8);
    } else if (B === 'desert') {
      put('palm', 'wood', 'axe', area * 12, 0.05, 0.85, 0.6, 10, 5);
      put('papyrus', 'papyrus', null, area * 22, 0, 0.6, -1.4, 1.2, 5, 0.8, 1.3, (x, z) => Math.hypot(x - (isl.x - 60), z - (isl.z + 20)) < 75);
      put('reed', 'linen', null, area * 14, 0.2, 0.95, 0.5, 6, 5);
      put('stone', 'stone', 'pick', area * 8, 0.2, 0.9, 1, 20, 8);
    }
    // камыш по берегам рек и озёр (главный остров)
    if (main) {
      const reed = (x, z) => { const h = terrainHeight(x, z); if (h > -1.3 && h < 0.9 && farFromPois(x, z, 3)) W.nodes.push({ id: nid++, kind: 'reed', res: 'calamus', tool: null, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, s: R(0.8, 1.25), ry: rnd() * 6.28, max: 6, island: 'main' }); };
      for (const rv of RIVERS) for (let i = 0; i < rv.pts.length - 1; i++) {
        const [ax, az] = rv.pts[i], [bx, bz] = rv.pts[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
        for (let d = 4; d < L; d += 9) for (const sd of [-1, 1]) if (rnd() < 0.55) { const k = d / L; reed(ax + (bx - ax) * k + nx * sd * (rv.w * 1.1 + R(0, 2.5)), az + (bz - az) * k + nz * sd * (rv.w * 1.1 + R(0, 2.5))); }
      }
      // глина по берегам ручья у Мессаны
      for (const rv of RIVERS) if (rv.clay) for (let i = 0; i < rv.pts.length - 1; i++) { const [ax, az] = rv.pts[i], [bx, bz] = rv.pts[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
        for (let d = 6; d < L; d += 13) { const sd = rnd() < 0.5 ? -1 : 1, x = ax + (bx - ax) * d / L + nx * sd * (rv.w + R(3, 6)), z = az + (bz - az) * d / L + nz * sd * (rv.w + R(3, 6)), h = terrainHeight(x, z); if (h > 0.3 && h < 3 && farFromPois(x, z, 3)) W.nodes.push({ id: nid++, kind: 'clay', res: 'clay', tool: null, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, s: R(0.8, 1.2), ry: rnd() * 6.28, max: 10, island: 'main' }); } }
      for (const l of LAKES) for (let a = 0; a < 6.28; a += 0.32) if (rnd() < 0.6) { const rr = l.r * (1 + 0.12 * Math.sin(a * 3 + l.x)) + R(0.5, 2.5); reed(l.x + Math.cos(a) * rr, l.z + Math.sin(a) * rr); }
    }
    // матёрые львы (минибоссы) — их можно приручить для арены
    if (['silva', 'aegyptus', 'ferrum'].includes(isl.id)) { const lp = landPoint(isl, 0.3, 0.75, 1.5, 30, 400, (x, z) => farFromPois(x, z, 30)); if (lp) W.dens.push({ id: 'dlion_' + isl.id, type: 'lion_boss', x: lp.x, z: lp.z, n: 1, island: isl.id, boss: true }); }
    // босс: речной крокодил-людоед в озере у южного хребта
    if (main) { const l = LAKES[0]; W.dens.push({ id: 'dcroc', type: 'croc_boss', x: l.x + l.r * 0.4, z: l.z, n: 1, island: 'main', boss: true }); }
    // исследования: три растения и два вида животных на каждом острове
    const RS = RESEARCH[isl.id]; W.research = W.research || [];
    if (RS && isl.kind !== 'mainland') {
      RS.flora.forEach((sp, i) => { const p = landPoint(isl, 0.1, 0.85, 1, 40, 600, (x, z) => farFromPois(x, z, 10)); if (p) W.research.push({ id: 'rs_' + isl.id + '_' + i, island: isl.id, sp, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 }); });
      RS.fauna.forEach((sp, i) => { const p = landPoint(isl, 0.1, 0.85, 1, 40, 600, (x, z) => farFromPois(x, z, 20)); if (p) W.dens.push({ id: 'dcr_' + isl.id + '_' + i, type: 'cr_' + sp, x: p.x, z: p.z, n: 2, island: isl.id, critter: true }); });
    }
    // логова зверей
    const fauna = { med: [['boar', 3], ['wolf', 3], ['deer', 4], ['goat', 3], ['bear', 1]], rock: [['goat', 4], ['wolf', 2]], beach: [['goat', 2], ['jackal', 2]], forest: [['bear', 2], ['wolf', 3], ['deer', 4], ['boar', 3]], desert: [['jackal', 3], ['snake', 4], ['lion', 1], ['croc', 1]] }[B] || [];
    if (isl.kind !== 'punic') for (const [type, n] of fauna) for (let i = 0; i < n * (main ? 5 : 1); i++) {
      const p = landPoint(isl, 0.08, 0.9, 1, 45, 200, (x, z) => farFromPois(x, z, 30) && (type !== 'croc' || Math.hypot(x - (isl.x - 60), z - (isl.z + 20)) < 80));
      if (p) W.dens.push({ id: 'd' + W.dens.length, type, x: p.x, z: p.z, n: ['wolf', 'jackal'].includes(type) ? 3 : type === 'deer' || type === 'goat' ? 2 : 1, island: isl.id });
    }
  }
  // Поле Марса на Бруттии: гавань-деревня напротив гавани Мессаны, дом распорядителя игр, ровное поле боя армиями
  {
    const I = islandById('italia'), M = CITY_LIST[0], a = Math.atan2(M.hz - I.z, M.hx - I.x);
    let d = 0; while (d < I.r * 1.6 && terrainHeight(I.x + Math.cos(a) * d, I.z + Math.sin(a) * d) > 0.3) d += 1;
    const sx = I.x + Math.cos(a) * d, sz = I.z + Math.sin(a) * d, ux = -Math.cos(a), uz = -Math.sin(a); // u — вглубь острова
    const ryPier = Math.atan2(-ux, -uz); // причал смотрит в море, к Мессане
    const vx = sx + ux * 26, vz = sz + uz * 26; // центр деревни
    FLATS.push({ x: vx, z: vz, r: 34, h: 2.0, fall: 60 });
    const pier = addPoi('trader', sx + ux * 3, sz + uz * 3, { ry: ryPier, r: 7, name: 'Гавань Регия', warPier: true });
    W.traders.push({ id: 'tr_regium', poi: pier.id, name: 'Гавань Регия', x: pier.x, z: pier.z, ry: ryPier, river: false, mult: 1 });
    const house = addPoi('games_house', vx + ux * 10, vz + uz * 10, { ry: ryPier, r: 7, name: 'Дом распорядителя игр', games: true });
    const huts = [[-18, 4], [18, 2], [-14, 18], [16, 17], [-24, -8], [24, -10]].map(([pu, pv], i) => { const x = vx + ux * pv + uz * pu, z = vz + uz * pv - ux * pu; return addPoi('war_hut', x, z, { ry: ryPier + (i % 2 ? 0.3 : -0.3), r: 4 }); });
    // четыре поля боя (2×2) вглубь острова: открытое поле, деревушка, развалины, скалы; в центре каждого — точка захвата
    const cx0 = sx + ux * 250, cz0 = sz + uz * 250, wx = -uz, wz = ux, ZN = [['Открытое поле', 'plain'], ['Деревушка', 'village'], ['Развалины', 'ruins'], ['Скалы', 'rocks']];
    const fields = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([pu, pv], i) => {
      const fx = cx0 + ux * pu * 82 + wx * pv * 82, fz = cz0 + uz * pu * 82 + wz * pv * 82;
      FLATS.push({ x: fx, z: fz, r: 72, h: Math.max(4, Math.min(10, terrainHeight(fx, fz))), fall: 60 });
      return { id: i, name: ZN[i][0], kind: ZN[i][1], x: fx, z: fz, r: 70, a: { x: fx - wx * 48, z: fz - wz * 48 }, b: { x: fx + wx * 48, z: fz + wz * 48 } };
    });
    const deco = [];
    for (const F of fields) {
      const ring = (n, r0, type, ex = {}) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + 0.4, x = F.x + Math.cos(a) * r0, z = F.z + Math.sin(a) * r0; deco.push(addPoi(type, x, z, { ry: a, r: 4, warDeco: true, ...ex })); } };
      if (F.kind === 'village') ring(6, 19, 'war_hut');
      if (F.kind === 'ruins') { ring(5, 18, 'ruin'); ring(3, 34, 'ruin'); }
      if (F.kind === 'rocks') { ring(5, 18, 'sea_rock'); ring(3, 36, 'sea_rock'); }
    }
    const f0 = fields[0];
    W.war = { village: { x: vx, z: vz, r: 40 }, pier: { x: pier.x, z: pier.z }, house: { x: house.x, z: house.z, id: house.id }, field: f0, fields, huts: huts.map((h) => h.id) };
    const inF = (x, z, pad) => fields.some((F) => Math.hypot(x - F.x, z - F.z) < F.r + pad);
    W.nodes = W.nodes.filter((n) => !(inF(n.x, n.z, 30) || Math.hypot(n.x - vx, n.z - vz) < 46));
    W.dens = W.dens.filter((q) => q.island !== 'italia');
    W.pois = W.pois.filter((q) => q.warDeco || q.ancient || !(q.island === 'italia' && !q.warPier && !q.games && q.type !== 'war_hut' && (inF(q.x, q.z, 40) || Math.hypot(q.x - vx, q.z - vz) < 50)));
  }
  // развалины древних городов: Акрагант и Лилибей (исследовательские задания — ANCIENT_RUINS в data.js)
  W.ancient = [];
  for (const R of ANCIENT_RUINS) {
    let [x, z] = proj(R.lon, R.lat); const ax = 40 - x, az = 130 - z, al = Math.hypot(ax, az) || 1;
    for (let k = 0; k < 60 && (terrainHeight(x, z) < 1.5 || waterEdgeDist(x, z) < 30); k++) { x += ax / al * 8; z += az / al * 8; } // вглубь острова, на сушу
    FLATS.push({ x, z, r: 50, h: Math.max(2, Math.min(8, terrainHeight(x, z))), fall: 60 });
    const mk = [], addA = (...a) => { const p = addPoi(...a); mk.push(p); return p; };
    const spots = R.stages.map((st, i) => { const a = i / R.stages.length * Math.PI * 2 + 0.5; let d = 24 + (i % 2) * 10; while (d > 12 && terrainHeight(x + Math.cos(a) * (d + 7), z + Math.sin(a) * (d + 7)) < 1) d -= 3; const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; const p = addA('ruin', px, pz, { ry: a + Math.PI / 2, r: 8, ancient: R.id, name: st.title }); return { k: i, x: px + Math.cos(a) * 7, z: pz + Math.sin(a) * 7, poi: p.id }; });
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + 1.2, px = x + Math.cos(a) * 46, pz = z + Math.sin(a) * 46; if (terrainHeight(px, pz) > 1) addA('ruin', px, pz, { ry: a, r: 8, ancient: R.id }); }
    addA('well', x, z, { ry: 0, r: 3, ancient: R.id, name: R.name });
    W.ancient.push({ id: R.id, name: R.name, x, z, spots });
    W.nodes = W.nodes.filter((n) => Math.hypot(n.x - x, n.z - z) > 62);
    W.pois = W.pois.filter((q) => q.ancient || Math.hypot(q.x - x, q.z - z) > 62); for (const p of mk) if (!W.pois.includes(p)) W.pois.push(p);
  }
  // большие валуны по берегам рек (не у мостов и не в городах)
  W.riverRocks = [];
  for (const rv of RIVERS) for (let i = 0; i < rv.pts.length - 1; i++) {
    const [ax, az] = rv.pts[i], [bx, bz] = rv.pts[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let d = 4; d < L; d += 6.5) for (const sd of [-1, 1]) {
      if (rnd() < 0.42) continue;
      const off = rv.w + 1.5 + rnd() * 5, x = ax + (bx - ax) * d / L + nx * sd * off + (rnd() - 0.5) * 3, z = az + (bz - az) * d / L + nz * sd * off + (rnd() - 0.5) * 3;
      const h = terrainHeight(x, z); if (h < -0.6 || h > 4) continue;
      if (onRoadNet(x, z) || cityAt(x, z, 30) || STATIC_BRIDGES.some((b) => Math.hypot(b.x - x, b.z - z) < 18) || W.pois.some((q) => Math.hypot(q.x - x, q.z - z) < (q.r || 4) + 4)) continue;
      W.riverRocks.push({ x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, s: Math.round((0.9 + rnd() * 1.6) * 100) / 100 });
    }
  }
  return W;
}
// уровень острова (для опасности): чем дальше от центра, тем сложнее
export const islandLevel = { sea: 6, pirata: 8, main: 1, marmor: 4, ferrum: 6, murex: 4, silva: 7, aegyptus: 9, punic: 13 };
export const ISLANDS_LIST = ISL;
