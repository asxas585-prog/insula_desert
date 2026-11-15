// Insula Deserta: Империя — экономические постройки, промысловая лодка, удочки и природа островов (three.js r187).
// Сицилия, 264 г. до н. э.: реалистичный облик, без фантастики.
// Соглашения как в models.js: начало координат — центр на уровне земли, +Z — «перёд» (улица / море / морда зверя).
// Простые матовые материалы M(color) — клиент склеивает их в цвета вершин. Коллайдеры только для сплошных стен.
import { H, makeAnimal, makeShip, makeTradeCrate } from './models.js';
const {
  THREE, PI, TAU, HPI, clamp, lerp, rng, G, box, cyl, sph, hemi, cone, tor, ico, oct, dod, lathe, rbox, extr, tube, lumpy, wuv, tbox, tcyl,
  P, grp, MET, FLAME, EMB, bronzeM, ironM, goldM, TM, ASH, TILE, PLANK, BRICK, THATCH, FOL,
  amphora, dolium, crate, sack, barrel, logPile, plankStack, stoneBlocks, bench, table, cart, banner, column, stairs, statue, rope, darker,
  colB, colC, WATER, plinth, wall, door, win, gable, shed, fence, post, hut, tent, campfire, weaponRack, palus, lowWarehouse, basin, cropRows, colRow, statera,
  C, M, VLight, BUILD, SHIPDEF,
} = H;

// ======================================================================
// Местные утилиты
// ======================================================================
const DS = { side: THREE.DoubleSide };
const UP = new THREE.Vector3(0, 1, 0);
// брус/ствол между двумя точками
function beam(par, a, b, r, mat, s = 6, r1 = r) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const m = P(par, cyl(r1, r, 1, s), mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.scale.y = va.distanceTo(vb);
  m.quaternion.setFromUnitVectors(UP, vb.sub(va).normalize());
  return m;
}
const blob = (r, d, seed, sy = 1, amt = 0.22) => G(`ecoBlob${r},${d},${seed},${sy},${amt}`, () => lumpy(new THREE.IcosahedronGeometry(r, d), amt, seed, sy));
const rockG = (r, seed, d = 1) => G(`ecoRock${r},${seed},${d}`, () => lumpy(new THREE.DodecahedronGeometry(r, d), 0.2, seed));
const moundG = (r, h, seed, s = 12) => G(`ecoMound${r},${h},${seed},${s}`, () => lumpy(new THREE.ConeGeometry(r, h, s, 3), 0.12, seed));
const domeG = (r, seed, s = 14) => G(`ecoDomeL${r},${seed},${s}`, () => lumpy(new THREE.SphereGeometry(r, s, 6, 0, TAU, 0, HPI), 0.1, seed));
// провисающее полотнище (ткань на верёвке), верхний край на y = 0
const clothG = (w, h, sag = 0.06) => G(`ecoCloth${w},${h},${sag}`, () => {
  const q = new THREE.PlaneGeometry(w, h, 3, 3); q.translate(0, -h / 2, 0);
  const p = q.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), y = -p.getY(i) / h; p.setZ(i, Math.sin(x * 2.2 + y * 3) * sag); p.setY(i, p.getY(i) - (1 - x * x) * sag * 0.6); }
  q.computeVertexNormals(); return q;
});
// корзина (плетёнка) с наполнением fillCol
function basket(par, x, y, z, r = 0.25, h = 0.3, fillCol = null) {
  const g = grp(par, x, y, z);
  P(g, cyl(r, r * 0.8, h, 10, true), M(0xa8864c, DS), 0, h / 2, 0);
  P(g, cyl(r * 0.8, r * 0.8, 0.02, 10), M(0x8a6a3a), 0, 0.01, 0);
  P(g, tor(r, 0.02, 4, 12), M(0x8a6a3a), 0, h, 0, HPI);
  if (fillCol !== null) P(g, G(`ecoFill${r}`, () => lumpy(new THREE.SphereGeometry(r * 0.92, 10, 4, 0, TAU, 0, HPI), 0.15, 5)), FOL(fillCol), 0, h * 0.8, 0, 0, 0, 0, 1, 0.45, 1);
  return g;
}
// кувшин / горшок (лекиф, ольпа)
function jar(par, x, y, z, s = 1, col = C.terracotta) {
  return P(par, lathe('ecoJar', [[0, 0], [0.07, 0], [0.1, 0.06], [0.11, 0.14], [0.07, 0.22], [0.05, 0.25], [0.06, 0.28], [0, 0.28]], 10), M(col), x, y, z, 0, 0, 0, s);
}
// ящики-штабели
function crateStack(par, x, z, nx, ny, ry = 0, s = 1) {
  const g = grp(par, x, 0, z, 0, ry, 0);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx - j; i++) crate(g, (i - (nx - j - 1) / 2) * 0.84 * s, j * 0.6 * s, 0, s, (i + j) % 2 ? 0.05 : -0.04);
  return g;
}
function tcrate(par, grade, x, y, z, s = 1, ry = 0) { const c = makeTradeCrate(grade); c.position.set(x, y, z); c.rotation.y = ry; c.scale.setScalar(s); par.add(c); return c; }
// столб с перекладиной и верёвкой: сушилка
function dryLine(par, a, b, h, cloths = []) {
  post(par, a[0], 0, a[1], h, 0.05, M(C.woodD)); post(par, b[0], 0, b[1], h, 0.05, M(C.woodD));
  rope(par, [a[0], h - 0.05, a[1]], [b[0], h - 0.05, b[1]], 0.012);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = Math.atan2(b[0] - a[0], b[1] - a[1]) - HPI;
  cloths.forEach(([k, w, ch, col]) => { const cl = P(par, clothG(w, ch), M(col, DS), lerp(a[0], b[0], k), h - 0.06, lerp(a[1], b[1], k), 0, ry, 0); cl.castShadow = false; });
  return len;
}
// простой инструмент: молоток / тесло / кирка
function tool(par, kind, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = grp(par, x, y, z, rx, ry, rz), wd = M(C.woodL), ir = ironM();
  if (kind === 'hammer') { P(g, cyl(0.014, 0.016, 0.32, 5), wd, 0, 0.16, 0); P(g, box(0.05, 0.05, 0.13), ir, 0, 0.33, 0); }
  else if (kind === 'adze') { P(g, cyl(0.014, 0.016, 0.4, 5), wd, 0, 0.2, 0); P(g, box(0.04, 0.03, 0.14), ir, 0, 0.4, 0.06, 0.3); }
  else if (kind === 'pick') { P(g, cyl(0.02, 0.022, 0.8, 5), wd, 0, 0.4, 0); P(g, box(0.04, 0.04, 0.5), ir, 0, 0.78, 0, 0.1); }
  else if (kind === 'shovel') { P(g, cyl(0.016, 0.018, 1.1, 5), wd, 0, 0.55, 0); P(g, box(0.2, 0.26, 0.02), ir, 0, -0.08, 0); }
  else if (kind === 'saw') { P(g, box(0.6, 0.08, 0.005), ir, 0.3, 0, 0); P(g, box(0.05, 0.14, 0.03), wd, -0.02, 0, 0); }
  else if (kind === 'rake') { P(g, cyl(0.014, 0.016, 1.6, 5), wd, 0, 0.8, 0); P(g, box(0.5, 0.04, 0.04), wd, 0, 1.6, 0); for (let i = 0; i < 6; i++) P(g, box(0.015, 0.1, 0.015), wd, -0.22 + i * 0.088, 1.56, 0.02); }
  else if (kind === 'chisel') { P(g, cyl(0.01, 0.012, 0.12, 5), wd, 0, 0.06, 0); P(g, box(0.012, 0.1, 0.006), ir, 0, 0.17, 0); }
  return g;
}
// низкий настил-пол из утрамбованной земли / песка
function ground(par, x, z, w, d, col = 0xa89272, h = 0.05) { const m = P(par, box(w, h, d), M(col), x, h / 2 - 0.01, z); m.castShadow = false; return m; }
// пирс на сваях вдоль +Z (z0 → z1), настил на y = top
function pier(par, x, z0, z1, w = 2.4, top = 0.55, deep = 2.6) {
  const p = grp(par, x, 0, 0), len = z1 - z0;
  P(p, tbox(w, 0.16, len), PLANK(), 0, top, (z0 + z1) / 2);
  for (let z = z0 + 0.3; z <= z1 + 0.01; z += 2) for (const s of [-1, 1]) P(p, cyl(0.11, 0.13, deep + top, 6), M(0x4a3420), s * (w / 2 - 0.1), (top - deep) / 2, z);
  for (const s of [-1, 1]) P(p, box(0.1, 0.1, len), M(0x5a4028), s * (w / 2 - 0.05), top + 0.1, (z0 + z1) / 2);
  return p;
}
// римский щит-скутум, прислонённый
function scutum(par, x, y, z, rx = -0.2, ry = 0, col = 0x9a2a22) {
  const s = grp(par, x, y, z, rx, ry, 0);
  P(s, G('ecoScutum', () => { const q = new THREE.CylinderGeometry(0.75, 0.75, 1.1, 10, 1, true, -0.55, 1.1); q.translate(0, 0, -0.68); return q; }), M(col, DS), 0, 0.55, 0);
  P(s, sph(0.08, 8, 6), bronzeM(), 0, 0.55, 0.08, 0, 0, 0, 1, 1, 0.6);
  P(s, box(0.6, 0.03, 0.02), M(C.gold), 0, 0.55, 0.075);
  return s;
}

// ======================================================================
// ГОРОДСКИЕ И ПРОМЫСЛОВЫЕ ПОСТРОЙКИ
// ======================================================================
// ---------- Инсула (r 6): три этажа, лавки внизу, деревянные балконы ----------
BUILD.insula = (g) => {
  const W = 8, D = 7.2, z0 = -0.6, y = 0.3, fz = z0 + D / 2 + 0.01;
  plinth(g, 0, -0.3, 8.5, 7.9, y);
  wall(g, 0, y, z0, W, 3.3, D, 0, { col: 0xe6d6b4, dadoCol: 0x8a3a24 });
  // лавки (tabernae): проёмы с порогами, ставни-доски
  for (let i = 0; i < 3; i++) {
    const x = -2.7 + i * 2.7;
    P(g, box(2.0, 2.5, 0.08), M(0x1a120c), x, y + 1.25, fz);
    P(g, box(2.3, 0.25, 0.22), M(C.stone), x, y + 2.62, fz + 0.06);
    P(g, box(2.1, 0.1, 0.32), M(C.stone), x, y + 0.05, fz + 0.12);
    for (let k = 0; k < 3; k++) P(g, box(0.28, 2.2, 0.05), M(0x6a4626), x + 1.25, y + 1.1, fz + 0.16 + k * 0.06, 0, 0.1 * k, 0);
  }
  // 1: прилавок с амфорами, 2: ткани, 3: посуда
  const ct = grp(g, -2.7, y, fz + 0.5);
  P(ct, box(1.8, 0.95, 0.5), M(0xd8c8a8), 0, 0.47, 0); P(ct, box(1.9, 0.07, 0.6), M(C.marble), 0, 0.98, 0); P(ct, box(1.82, 0.4, 0.52), M(0x9a3a22), 0, 0.25, 0);
  for (let i = 0; i < 3; i++) jar(ct, -0.6 + i * 0.6, 1.01, 0, 0.9, i % 2 ? 0xb8643c : 0x9a5030);
  colB(g, -2.7, fz + 0.5, 1.9, 0.6);
  for (let i = 0; i < 3; i++) { const cl = P(g, clothG(0.5, 1.3, 0.03), M([0x9a2a22, 0x2a4a7a, 0xd8c8a0][i], DS), -0.5 + i * 0.5, y + 2.4, fz + 0.12); cl.castShadow = false; }
  for (let i = 0; i < 3; i++) sack(g, -0.6 + i * 0.6, y, fz + 0.55, 0.8, [0xc8b48a, 0xb89a6a, 0xd8c8a0][i], i);
  for (let i = 0; i < 4; i++) amphora(g, 2.0 + (i % 2) * 0.5, y, fz + 0.4 + Math.floor(i / 2) * 0.45, 0.8, i % 2 ? 0xa86a3a : C.terracotta);
  for (let i = 0; i < 3; i++) jar(g, 3.3, y, fz + 0.3 + i * 0.3, 1.0, 0xc87a4a);
  // верхние этажи (кладка с обмазкой, чуть разного оттенка)
  P(g, box(W + 0.24, 0.2, D + 0.24), M(C.stone), 0, y + 3.3, z0);
  P(g, box(W, 2.8, D), M(0xe2cfa8), 0, y + 3.4 + 1.4, z0);
  P(g, box(W + 0.12, 0.14, D + 0.12), M(C.woodD), 0, y + 6.2, z0);
  P(g, box(W - 0.2, 2.6, D - 0.2), M(0xd8c09a), 0, y + 6.25 + 1.3, z0);
  gable(g, 0, y + 8.85, z0, W - 0.2, D - 0.2, 0.4, 0.45, 'x');
  const bz = z0 - D / 2 - 0.01, sx = W / 2 + 0.01;
  for (const [yy, inset] of [[y + 5.0, 0], [y + 7.7, 0.1]]) {
    for (const x of [-3, 3]) win(g, x, yy, fz - inset, 0, 0.7, 0.9);
    if (inset) for (const x of [-1, 1]) win(g, x, yy, fz - inset, 0, 0.6, 0.8);
    for (const x of [-3, -1, 1, 3]) win(g, x, yy, bz + inset, PI, 0.6, 0.8);
    for (const s of [-1, 1]) for (const z of [-2.6, 0.0, 2.0]) win(g, s * (sx - inset), yy, z0 + z * 0.9, s * HPI, 0.55, 0.8);
  }
  // балкон второго этажа (maenianum) на консольных балках
  for (let i = 0; i < 6; i++) P(g, box(0.14, 0.16, 1.4), M(C.woodD), -3.75 + i * 1.5, y + 3.48, fz + 0.6);
  P(g, tbox(W + 0.2, 0.1, 1.2), PLANK(), 0, y + 3.62, fz + 0.62);
  for (let i = 0; i < 17; i++) P(g, box(0.05, 0.85, 0.05), M(C.wood), -4.0 + i * 0.5, y + 4.1, fz + 1.17);
  P(g, box(W + 0.15, 0.08, 0.1), M(C.wood), 0, y + 4.55, fz + 1.17);
  for (const s of [-1, 1]) P(g, box(0.08, 0.08, 1.2), M(C.wood), s * 4.05, y + 4.55, fz + 0.62);
  for (const x of [-4.0, 0, 4.0]) post(g, x, y + 3.67, fz + 1.17, 2.5, 0.06, M(C.woodD));
  shed(g, 0, y + 6.1, fz + 0.68, W + 0.2, 1.3, 0.3, 0, TILE());
  for (const x of [-1, 1]) { P(g, box(0.95, 1.95, 0.06), M(0x1a120c), x, y + 3.67 + 0.97, fz); P(g, box(0.8, 1.85, 0.07), M(0x6a4626), x - 0.08, y + 3.67 + 0.93, fz + 0.03); }
  for (let i = 0; i < 2; i++) { const pt = grp(g, -2.2 + i * 4.4, y + 3.67, fz + 0.9); P(pt, lathe('ecoPot', [[0, 0], [0.13, 0], [0.18, 0.22], [0.15, 0.3], [0, 0.3]], 10), M(C.terracotta)); P(pt, blob(0.22, 0, 40 + i, 0.9), FOL(0x4a7a2a), 0, 0.42, 0); }
  // сохнущее бельё на перилах, деревянная галерея третьего этажа сбоку
  for (let i = 0; i < 3; i++) { const cl = P(g, clothG(0.6, 0.5, 0.02), M([0xe8e0cc, 0xb04a2a, 0xd8d0b8][i], DS), -3.2 + i * 2.6, y + 4.52, fz + 1.2); cl.castShadow = false; }
  const gal = grp(g, sx, y + 6.3, z0 + 0.5);
  for (let i = 0; i < 4; i++) P(gal, box(0.9, 0.14, 0.14), M(C.woodD), 0.4, 0, -1.6 + i * 1.07);
  P(gal, tbox(0.9, 0.08, 3.6), PLANK(), 0.45, 0.1, 0);
  for (let i = 0; i < 8; i++) P(gal, box(0.04, 0.8, 0.04), M(C.wood), 0.85, 0.5, -1.75 + i * 0.5);
  P(gal, box(0.06, 0.06, 3.6), M(C.wood), 0.85, 0.9, 0);
  door(g, sx, y, z0 - 2.2, HPI, 1.0, 2.2);   // вход на лестницу к квартирам
  // вывеска над лавкой
  const sg = grp(g, 0, y + 2.85, fz + 0.06); P(sg, box(1.4, 0.32, 0.04), M(0xe8dcbc), 0, 0, 0); P(sg, box(1.2, 0.06, 0.05), M(0x9a2a22), 0, 0, 0.01);
  colB(g, 0, z0, W + 0.3, D + 0.3);
};

// ---------- Бани (balneum, r 6): кирпич, купольный кальдарий ----------
BUILD.balneum = (g) => {
  const y = 0.35;
  plinth(g, 0, -0.4, 8.4, 7.6, y);
  // раздевальня + фригидарий
  wall(g, 1.6, y, -0.8, 4.8, 4.2, 5.6, 0, { mat: BRICK(), dado: false });
  gable(g, 1.6, y + 4.2, -0.8, 4.8, 5.6, 0.38, 0.35, 'z');
  for (const z of [-2.4, -0.4]) win(g, 4.01, y + 3.0, z, HPI, 0.6, 0.9);
  win(g, 0.6, y + 3.4, 2.01, 0, 0.6, 0.6); win(g, 2.6, y + 3.4, 2.01, 0, 0.6, 0.6);
  // кальдарий: барабан и купол с окулюсом
  P(g, tcyl(2.1, 2.1, 3.6, 20), BRICK(), -2.0, y + 1.8, -1.2);
  P(g, cyl(2.22, 2.22, 0.22, 20), M(C.stone), -2.0, y + 3.65, -1.2);
  P(g, G('ecoBalDome', () => new THREE.SphereGeometry(2.1, 18, 7, 0, TAU, 0, HPI * 0.95)), M(0xc8b49a), -2.0, y + 3.7, -1.2);
  P(g, cyl(0.38, 0.38, 0.22, 10), M(C.stone), -2.0, y + 5.78, -1.2);
  for (const a of [0.9, 1.75, 2.6]) win(g, -2.0 + Math.cos(a) * 2.11, y + 2.6, -1.2 + Math.sin(a) * 2.11, HPI - a, 0.45, 0.8);
  // топка (praefurnium) с дровами и дымоходом
  P(g, tbox(1.6, 1.3, 1.1), BRICK(), -2.0, y + 0.45, -3.5);
  P(g, G('ecoArch', () => new THREE.CircleGeometry(0.35, 8, 0, PI)), M(0x1a0e08), -2.0, y + 0.55, -4.06, 0, PI, 0);
  P(g, box(0.7, 0.55, 0.06), M(0x1a0e08), -2.0, y + 0.28, -4.06);
  P(g, box(0.5, 0.18, 0.06), EMB(), -2.0, y + 0.12, -4.08);
  const fl = new VLight(0xff7a30, 3, 6, 1.6); fl.position.set(-2.0, y + 0.6, -4.6); g.add(fl);
  P(g, tbox(0.45, 2.2, 0.45), BRICK(), -0.6, y + 4.0, -2.9);
  logPile(g, 1.0, y, -3.9, 5, 1.2, HPI);
  // вход с портиком
  door(g, 1.6, y, 2.02, 0, 1.3, 2.4, true);
  colRow(g, 0.0, 3.05, 3.2, 3.05, 2, y, 3.0, 0.16, 'tuscan', null, true);
  P(g, box(3.8, 0.26, 0.34), M(C.stone), 1.6, y + 3.12, 3.05);
  shed(g, 1.6, y + 3.55, 2.6, 4.0, 1.3, 0.3, 0, TILE());
  P(g, box(1.6, 0.3, 0.05), M(0xf0e8d8), 1.6, y + 2.85, 2.04);
  stairs(g, 1.6, y - 0.05, 3.25, 3.4, 1, 0.3, 0.35);
  // лабрум (чаша для умывания) и скамьи
  const lb = grp(g, -2.4, y, 2.3);
  P(lb, cyl(0.12, 0.18, 0.75, 10), M(C.marble), 0, 0.37, 0);
  P(lb, lathe('ecoLabrum', [[0, 0], [0.4, 0.05], [0.62, 0.2], [0.6, 0.24], [0, 0.12]], 16), M(C.marble), 0, 0.72, 0);
  P(lb, cyl(0.52, 0.52, 0.02, 16), WATER(), 0, 0.92, 0);
  colC(g, -2.4, 2.3, 0.6);
  bench(g, 3.6, y, 1.0, 1.4, HPI); bench(g, -0.5, y, 2.7, 1.2);
  for (let i = 0; i < 2; i++) amphora(g, 3.5 + i * 0.4, y, -3.8, 0.9, 0xa8784a);
  colB(g, 1.6, -0.8, 5.0, 5.8); colC(g, -2.0, -1.2, 2.2); colB(g, -2.0, -3.5, 1.7, 1.2);
};

// ---------- Попина / термополий (r 5): прилавок с долиями ----------
BUILD.popina = (g) => {
  const y = 0.25;
  plinth(g, 0, -1.2, 7.0, 4.6, y);
  wall(g, 0, y, -3.1, 6.6, 3.4, 0.4, 0, { col: 0xe8d8b8, dadoCol: 0x9a2c22 });
  for (const s of [-1, 1]) wall(g, s * 3.1, y, -1.25, 0.4, 3.4, 3.4, 0, { col: 0xe8d8b8, dadoCol: 0x9a2c22 });
  gable(g, 0, y + 3.4, -1.25, 6.6, 4.1, 0.4, 0.4, 'x');
  P(g, box(6.2, 0.06, 3.4), M(0xb8a888), 0, y + 0.03, -1.3);
  P(g, box(6.3, 0.25, 0.25), M(C.woodD), 0, y + 3.2, 0.5);
  // L-образный прилавок, облицованный мрамором, с тремя врытыми долиями
  const ct = grp(g, -0.6, y, 0.1);
  P(ct, box(3.8, 0.95, 0.75), M(0xe8dcc0), 0, 0.47, 0); P(ct, box(3.8, 0.42, 0.77), M(0xa83a22), 0, 0.22, 0);
  for (let i = 0; i < 3; i++) P(ct, box(0.8, 0.32, 0.02), M([0x3a6a3a, 0xc8a040, 0x3a5a8a][i]), -1.2 + i * 1.2, 0.68, 0.385);
  P(ct, box(3.95, 0.07, 0.85), M(C.marble), 0, 0.98, 0);
  P(ct, box(0.75, 0.95, 1.2), M(0xe8dcc0), 1.55, 0.47, -0.95); P(ct, box(0.85, 0.07, 1.25), M(C.marble), 1.55, 0.98, -0.95);
  for (let i = 0; i < 3; i++) { P(ct, cyl(0.22, 0.22, 0.02, 12), M(0x1a100a), -1.3 + i * 1.1, 1.02, 0); P(ct, tor(0.23, 0.035, 4, 12), M(0xa65a36), -1.3 + i * 1.1, 1.02, 0, HPI); }
  for (let i = 0; i < 4; i++) P(ct, lathe('ecoCup', [[0, 0], [0.04, 0], [0.06, 0.08], [0, 0.08]], 8), M(i % 2 ? 0x2a2420 : 0xb8643c), 1.4 + (i % 2) * 0.2, 1.02, -0.6 - Math.floor(i / 2) * 0.3);
  colB(g, -0.6, 0.1, 3.95, 0.85); colB(g, 0.95, -0.85, 0.85, 1.25);
  // очаг с котлом у задней стены
  const hr = grp(g, 2.2, y, -2.4);
  P(hr, box(1.2, 0.8, 0.9), M(0xc8b898), 0, 0.4, 0); P(hr, box(0.5, 0.3, 0.05), M(0x1a0e08), 0, 0.35, 0.46); P(hr, box(0.36, 0.12, 0.05), EMB(), 0, 0.26, 0.47);
  P(hr, lathe('ecoPotB', [[0, 0], [0.15, 0.02], [0.2, 0.12], [0.18, 0.24], [0.16, 0.26], [0, 0.26]], 12), M(0x3a3430), 0, 0.8, 0);
  const hl = new VLight(0xff9040, 3, 7, 1.6); hl.position.set(0, 0.6, 0.7); hr.add(hl);
  colB(g, 2.2, -2.4, 1.2, 0.9);
  // полки с кувшинами, ларарий с росписью
  const sh = grp(g, -1.4, y, -2.75);
  for (const yy of [1.3, 1.8]) P(sh, box(2.6, 0.06, 0.32), M(C.woodL), 0, yy, 0);
  for (let i = 0; i < 9; i++) jar(sh, -1.1 + (i % 5) * 0.55, i < 5 ? 1.33 : 1.83, 0, 0.8, [0xb8643c, 0xd8c8a8, 0x8a4a2a][i % 3]);
  const lr = grp(g, 1.0, y + 1.6, -2.88);
  P(lr, box(0.9, 0.9, 0.05), M(0xc8a060), 0, 0.45, 0); P(lr, box(0.6, 0.5, 0.06), M(0x9a2c22), 0, 0.42, 0.01); P(lr, extr('ecoLarT', [[-0.5, 0], [0.5, 0], [0, 0.3]], 0.1, 0), M(C.stone), 0, 0.9, 0.02);
  // окорока и чеснок под балкой
  for (let i = 0; i < 3; i++) { rope(g, [-2.0 + i * 0.4, y + 3.15, 0.3], [-2.0 + i * 0.4, y + 2.75, 0.3], 0.008); P(g, sph(0.1, 8, 6), M(i === 1 ? 0xe8e0d0 : 0x8a3a2a), -2.0 + i * 0.4, y + 2.62, 0.3, 0, 0, 0, 0.8, 1.4, 0.7); }
  // навес и столики перед входом
  for (const x of [-2.8, 2.8]) { post(g, x, 0, 2.6, 2.7, 0.07, M(C.woodD)); colC(g, x, 2.6, 0.12); }
  P(g, box(5.8, 0.1, 0.1), M(C.woodD), 0, 2.7, 2.6);
  shed(g, 0, 3.05, 1.55, 6.0, 2.2, 0.45, 0, TILE());
  for (const [x, z] of [[-1.8, 2.3], [1.6, 2.6]]) {
    const t = grp(g, x, 0, z);
    P(t, cyl(0.4, 0.4, 0.05, 12), M(C.woodL), 0, 0.72, 0); P(t, cyl(0.05, 0.08, 0.7, 6), M(C.woodD), 0, 0.35, 0);
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; P(t, cyl(0.16, 0.16, 0.04, 8), M(C.wood), Math.cos(a) * 0.65, 0.45, Math.sin(a) * 0.65); P(t, cyl(0.03, 0.03, 0.45, 5), M(C.woodD), Math.cos(a) * 0.65, 0.22, Math.sin(a) * 0.65); }
    P(t, lathe('ecoCup', [[0, 0], [0.04, 0], [0.06, 0.08], [0, 0.08]], 8), M(0x2a2420), 0.1, 0.75, 0.05);
    colC(g, x, z, 0.45);
  }
  const sg = grp(g, 3.2, 2.6, 0.9); P(sg, box(0.06, 0.06, 0.7), ironM(), 0, 0, -0.35); P(sg, box(0.06, 0.5, 0.75), M(0xe8dcbc), 0, -0.32, 0); amphora(sg, 0.05, -0.55, 0, 0.35, 0x9a2a22);
  amphora(g, -2.6, y, -0.6, 1.0, 0xa86a3a); amphora(g, -2.6, y, -1.1, 1.0, 0xa86a3a); barrel(g, -2.5, y, -2.3, 0.9);
};

// ---------- Фуллоника и красильня (r 6) ----------
BUILD.fullonica = (g) => {
  // мастерская сзади
  plinth(g, 0, -3.0, 8.4, 2.6, 0.25);
  wall(g, 0, 0.25, -3.0, 8.0, 3.2, 2.2, 0, { col: 0xe0d4ba, dadoCol: 0x6a5a8a });
  gable(g, 0, 3.45, -3.0, 8.0, 2.2, 0.45, 0.35, 'x');
  door(g, -1.2, 0.25, -1.88, 0, 1.4, 2.2, true); win(g, 1.6, 2.2, -1.89, 0, 0.7, 0.6); win(g, 3.0, 2.2, -1.89, 0, 0.7, 0.6);
  colB(g, 0, -3.0, 8.4, 2.6);
  ground(g, 0, 1.2, 8.4, 6.0, 0xb8a888, 0.06);
  // три промывочных бассейна, соединённые жёлобом
  for (let i = 0; i < 3; i++) basin(g, -2.8 + i * 2.1, 0, -0.75, 1.9, 0.6, 1.1, 0.12, M(0xc8bca0), M([0x6a8a9a, 0x7a96a0, 0x8aa8b0][i], { roughness: 0.2 }));
  P(g, box(6.0, 0.12, 0.25), M(0xa89c84), -0.7, 0.62, -0.1);
  colB(g, -0.7, -0.75, 6.2, 1.1);
  // красильные чаны: марена, резеда, вайда
  [[0x8a1a1a, -3.3], [0xc8a020, -2.0], [0x2a3a7a, -0.7]].forEach(([col, x]) => {
    P(g, cyl(0.5, 0.55, 0.75, 14), M(0xb8ac94), x, 0.37, 1.2); P(g, tor(0.5, 0.05, 4, 14), M(0xa89c84), x, 0.75, 1.2, HPI);
    P(g, cyl(0.45, 0.45, 0.02, 14), M(col, { roughness: 0.3 }), x, 0.7, 1.2);
    colC(g, x, 1.2, 0.55);
  });
  P(g, cyl(0.015, 0.015, 1.4, 4), M(C.woodL), -2.0, 1.0, 1.2, 0.6, 0, 0.3);
  // котёл на огне для горячей краски
  const kt = grp(g, 0.7, 0, 1.4);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; P(kt, rockG(0.16, 60 + i, 0), FOL(0x8a8478), Math.cos(a) * 0.48, 0.12, Math.sin(a) * 0.48); }
  P(kt, lathe('ecoCaul', [[0, 0], [0.25, 0.03], [0.4, 0.2], [0.42, 0.4], [0.38, 0.44], [0, 0.4]], 12), M(0x4a4440), 0, 0.22, 0);
  P(kt, cyl(0.37, 0.37, 0.02, 12), M(0x5a1a4a), 0, 0.6, 0);
  P(kt, ico(0.14, 0), EMB(), 0, 0.12, 0, 0, 0, 0, 1.4, 0.5, 1.4);
  const kl = new VLight(0xff8a40, 3, 6, 1.6); kl.position.set(0, 0.4, 0.4); kt.add(kl);
  colC(g, 0.7, 1.4, 0.55);
  // «прыжковые» стойла для топтания ткани (saltus fullonicus)
  for (let i = 0; i < 4; i++) {
    const x = -3.3 + i * 1.0, s = grp(g, x, 0, 3.3);
    P(s, lathe('ecoTub', [[0, 0], [0.3, 0], [0.38, 0.45], [0.36, 0.5], [0, 0.4]], 12), M(0xb8643c), 0, 0, 0);
    P(s, cyl(0.33, 0.33, 0.02, 12), M(0xa8b0a8, { roughness: 0.3 }), 0, 0.4, 0);
    if (i < 3) P(g, box(0.1, 1.1, 0.9), M(0xd8ccb0), x + 0.5, 0.55, 3.3);
  }
  P(g, box(4.1, 1.1, 0.1), M(0xd8ccb0), -1.8, 0.55, 2.82);
  colB(g, -1.8, 3.3, 4.2, 1.0);
  // винтовой пресс для ткани
  const pr = grp(g, 2.6, 0, 0.2);
  for (const s of [-1, 1]) P(pr, box(0.16, 2.1, 0.16), M(C.woodD), s * 0.6, 1.05, 0);
  P(pr, box(1.5, 0.2, 0.22), M(C.woodD), 0, 2.05, 0); P(pr, box(1.36, 0.12, 0.6), M(C.wood), 0, 0.3, 0);
  P(pr, cyl(0.07, 0.07, 1.2, 8), M(C.woodL), 0, 1.4, 0); for (let i = 0; i < 6; i++) P(pr, tor(0.075, 0.015, 3, 8), M(C.woodD), 0, 0.95 + i * 0.16, 0, HPI);
  P(pr, box(1.0, 0.1, 0.5), M(C.wood), 0, 0.8, 0); P(pr, cyl(0.025, 0.025, 1.0, 5), M(C.woodD), 0, 1.75, 0, 0, 0, HPI);
  for (let i = 0; i < 4; i++) P(pr, box(0.9, 0.06, 0.45), M([0xe8e0cc, 0x9a2a22, 0xe8e0cc, 0x2a3a7a][i]), 0, 0.4 + i * 0.07, 0);
  colB(g, 2.6, 0.2, 1.4, 0.6);
  // сушильные верёвки с крашеными полотнищами
  dryLine(g, [1.3, 3.8], [4.0, 3.8], 2.2, [[0.2, 0.65, 1.3, 0x9a2a22], [0.5, 0.65, 1.4, 0xc8a020], [0.8, 0.65, 1.2, 0x2a3a7a]]);
  dryLine(g, [4.0, -1.2], [4.0, 2.4], 2.3, [[0.25, 0.8, 1.2, 0xe8e0cc], [0.7, 0.8, 1.3, 0x6a1a4a]]);
  for (const [x, z] of [[1.3, 3.8], [4.0, 3.8], [4.0, -1.2], [4.0, 2.4]]) colC(g, x, z, 0.1);
  // сосуды для сбора мочи у входа (как в Помпеях), корзины с шерстью
  for (let i = 0; i < 3; i++) amphora(g, -3.9, 0, -0.2 + i * 0.45, 0.9, 0x9a6a3a, 0);
  basket(g, 1.8, 0, 2.4, 0.3, 0.35, 0xe8e0d0); basket(g, 2.4, 0, 2.6, 0.28, 0.3, 0xe8e0d0);
};

// ---------- Мастерская ремесленника (officina, r 5) ----------
BUILD.officina = (g) => {
  plinth(g, 0, -1.4, 7.0, 4.2, 0.2);
  const y = 0.2;
  wall(g, 0, y, -3.2, 6.6, 3.4, 0.35, 0, { col: 0xd8c8a6, dadoCol: 0x7a5a3a, cornice: false });
  for (const s of [-1, 1]) wall(g, s * 3.15, y, -2.2, 0.35, 3.0, 2.3, 0, { col: 0xd8c8a6, dadoCol: 0x7a5a3a, cornice: false });
  for (const x of [-3.15, -1.05, 1.05, 3.15]) { post(g, x, y, 0.6, 2.75, 0.09, M(C.woodD)); colC(g, x, 0.6, 0.14); }
  P(g, box(6.6, 0.18, 0.18), M(C.woodD), 0, y + 2.75, 0.6);
  shed(g, 0, y + 3.5, -1.3, 6.8, 4.1, 0.75, 0, TILE());
  colB(g, 0, -3.2, 6.8, 0.45); for (const s of [-1, 1]) colB(g, s * 3.15, -2.2, 0.45, 2.3);
  // верстак с инструментами
  const wb = grp(g, -1.4, y, -2.4);
  P(wb, rbox(2.6, 0.12, 0.8, 0.02), M(0xa07a4a), 0, 0.85, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(wb, box(0.1, 0.8, 0.1), M(C.woodD), sx * 1.15, 0.4, sz * 0.3);
  tool(wb, 'hammer', -0.9, 0.93, 0.1, HPI, 0, 0.3); tool(wb, 'adze', -0.4, 0.93, 0.05, HPI, 0, -0.2);
  tool(wb, 'saw', 0.1, 0.93, -0.15, -HPI, 0, 0); tool(wb, 'chisel', 0.7, 0.93, 0.15, HPI, 0, 0.6); tool(wb, 'chisel', 0.82, 0.93, 0.12, HPI, 0, 0.4);
  P(wb, box(0.8, 0.12, 0.2), M(0xc8a070), 0.6, 0.97, -0.15, 0, 0.2, 0);
  colB(g, -1.4, -2.4, 2.6, 0.8);
  // доска с инструментами на стене
  const tb = grp(g, -1.4, y + 1.6, -3.0);
  P(tb, box(2.2, 0.9, 0.04), M(0x8a6a44), 0, 0.3, 0);
  tool(tb, 'saw', -0.9, 0.5, 0.05, 0, 0, 0); tool(tb, 'hammer', 0.3, 0.0, 0.05); tool(tb, 'adze', 0.6, 0.0, 0.05); tool(tb, 'chisel', 0.9, 0.2, 0.05);
  // гончарный круг, точильный круг
  const wh = grp(g, 1.6, y, -1.6);
  P(wh, cyl(0.45, 0.45, 0.08, 16), M(0x8a7a6a), 0, 0.12, 0); P(wh, cyl(0.05, 0.05, 0.6, 6), M(C.woodD), 0, 0.45, 0); P(wh, cyl(0.28, 0.28, 0.05, 14), M(0x8a7a6a), 0, 0.76, 0);
  P(wh, lathe('ecoWet', [[0, 0], [0.12, 0], [0.16, 0.12], [0.1, 0.24], [0.08, 0.3], [0, 0.3]], 12), M(0xa05a3a), 0, 0.79, 0);
  bench(wh, 0, 0, -0.75, 0.9);
  colC(g, 1.6, -1.6, 0.5);
  const gs = grp(g, 2.6, 0, 1.6, 0, -0.4, 0);
  for (const s of [-1, 1]) P(gs, box(0.08, 0.9, 0.5), M(C.woodD), s * 0.18, 0.45, 0);
  P(gs, cyl(0.4, 0.4, 0.14, 16), M(0xb0a898), 0, 0.9, 0, 0, 0, HPI); P(gs, cyl(0.03, 0.03, 0.6, 6), ironM(), 0, 0.9, 0, 0, 0, HPI);
  P(gs, box(0.4, 0.3, 0.3), M(C.woodD), 0, 0.15, 0.25); P(gs, cyl(0.02, 0.02, 0.4, 5), M(C.woodL), 0.35, 0.9, 0.18, 0.8);
  colC(g, 2.6, 1.6, 0.45);
  // полки с товаром, корзины, поленья, вывеска
  const sh = grp(g, 2.2, y, -2.9);
  for (const yy of [0.5, 1.1, 1.7]) P(sh, box(1.4, 0.05, 0.4), M(C.woodL), 0, yy, 0);
  for (const s of [-1, 1]) P(sh, box(0.06, 1.8, 0.4), M(C.woodD), s * 0.7, 0.9, 0);
  for (let i = 0; i < 9; i++) jar(sh, -0.5 + (i % 3) * 0.5, 0.53 + Math.floor(i / 3) * 0.6, 0, 0.9, [0xb8643c, 0xc8784a, 0x2a2420][i % 3]);
  basket(g, -2.6, 0, 1.4, 0.3, 0.35, 0xb8643c); basket(g, -2.0, 0, 1.8, 0.25, 0.3, 0x9a7a4a);
  logPile(g, -2.2, 0, 2.8, 4, 1.4, HPI);
  P(g, tor(0.45, 0.04, 4, 16), M(C.woodD), 0.4, 0.5, 2.0, 0, 0.6, 0);   // готовое колесо
  for (let i = 0; i < 4; i++) P(g, box(0.86, 0.04, 0.04), M(C.wood), 0.4, 0.5, 2.0, 0, 0.6, i * PI / 4);
  const sg = grp(g, 0, y + 2.45, 0.7); P(sg, box(1.2, 0.36, 0.05), M(0xe8dcbc), 0, 0, 0); tool(sg, 'hammer', -0.2, -0.12, 0.03, 0, 0, -0.7);
};

// ---------- Верфь (navalia, r 12): стапель уходит в воду на +Z ----------
// корпус в постройке: функции полуширины и сечения (u ∈ [-1, 1]: −1 — левый верх, 0 — киль, 1 — правый верх)
const NAV = { L: 15, B: 4.2, D: 1.8 };
const navHw = (z) => { const zn = Math.abs((2 * z) / NAV.L); return Math.max(0.06, (NAV.B / 2) * Math.pow(Math.max(0, 1 - Math.pow(zn, 2.2)), 0.5)); };
const navTop = (z) => { const zn = Math.abs((2 * z) / NAV.L); return NAV.D * (1 - 0.2 * Math.pow(zn, 3)) + 0.6 * Math.pow(zn, 3); };
const navPt = (z, u, k = 1) => { const phi = ((u + 1) / 2) * PI, c = Math.cos(phi), s = Math.sin(phi); return [-k * navHw(z) * Math.sign(c) * Math.pow(Math.abs(c), 0.55), navTop(z) * (1 - Math.pow(s, 1.6)) - (k - 1) * 0.5, z]; };
function ribbon(key, fn, z0, z1, u0, u1, nz = 20, nu = 6) {
  return G('ecoRbn' + key, () => {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= nz; i++) for (let j = 0; j <= nu; j++) { const z = lerp(z0, z1, i / nz), u = lerp(u0, u1, j / nu), p = fn(z, u); pos.push(...p); uv.push(z, u * 3); }
    for (let i = 0; i < nz; i++) for (let j = 0; j < nu; j++) { const a = i * (nu + 1) + j, b = a + nu + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); q.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); q.setIndex(idx); q.computeVertexNormals();
    return q;
  });
}
BUILD.navalia = (g) => {
  const wood = M(0x7a5634), woodD = M(C.woodD), woodL = M(C.woodL);
  ground(g, -1.0, -2.0, 16.6, 12.4, 0xb8a47e, 0.04);
  // каменный стапель с деревянными полозьями
  const z0 = -8.2, z1 = 12.5, y0 = 0.5, y1 = -1.3, ang = Math.atan2(y0 - y1, z1 - z0), len = Math.hypot(z1 - z0, y0 - y1);
  const sl = grp(g, 0, (y0 + y1) / 2, (z0 + z1) / 2, ang, 0, 0);
  P(sl, tbox(5.4, 1.4, len), ASH(), 0, -0.7, 0);
  for (const s of [-1, 1]) P(sl, box(0.38, 0.24, len), wood, s * 1.0, 0.12, 0);
  for (let z = -len / 2 + 0.5; z < len / 2; z += 1.25) P(sl, box(4.8, 0.1, 0.24), woodD, 0, 0.05, z);
  // недостроенный корпус на клетях
  const hz = -3.6, hg = grp(sl, 0, 1.45, hz);
  P(hg, box(0.26, 0.32, NAV.L), woodD, 0, 0, 0);
  P(hg, tube('ecoNavStem', [[0, 0, NAV.L / 2 - 0.3], [0, 0.6, NAV.L / 2 + 0.25], [0, navTop(NAV.L / 2) + 0.3, NAV.L / 2 + 0.55], [0, navTop(NAV.L / 2) + 0.9, NAV.L / 2 + 0.3]], 0.13, 0.09, 10, 5), woodD);
  P(hg, tube('ecoNavStern', [[0, 0, -NAV.L / 2 + 0.3], [0, 0.7, -NAV.L / 2 - 0.25], [0, navTop(-NAV.L / 2) + 0.4, -NAV.L / 2 - 0.4], [0, navTop(-NAV.L / 2) + 1.1, -NAV.L / 2 - 0.1]], 0.13, 0.09, 10, 5), woodD);
  for (let i = 1; i < 14; i++) {
    const z = -NAV.L / 2 + (i * NAV.L) / 14, pts = [];
    for (let k = 0; k <= 8; k++) pts.push(navPt(z, -1 + k / 4));
    P(hg, tube(`ecoNavRib${i}`, pts, 0.075, 0.075, 10, 4), wood);
    if (i % 3 === 1) P(hg, box(navHw(z) * 2, 0.14, 0.18), woodD, 0, navTop(z) - 0.05, z);
  }
  const plank = TM('plank', 0xb08a5a, DS);
  P(hg, ribbon('navLow', (z, u) => navPt(z, u, 1.03), -NAV.L / 2 + 0.25, NAV.L / 2 - 0.25, -0.5, 0.5, 24, 8), plank);
  P(hg, ribbon('navS1', (z, u) => navPt(z, u, 1.03), -NAV.L / 2 + 0.4, 2.5, 0.52, 0.62, 14, 1), plank);
  P(hg, ribbon('navS2', (z, u) => navPt(z, u, 1.03), -2.5, NAV.L / 2 - 0.4, -0.62, -0.52, 14, 1), plank);
  P(hg, ribbon('navS3', (z, u) => navPt(z, u, 1.03), -NAV.L / 2 + 0.5, -1.0, 0.64, 0.72, 10, 1), plank);
  for (let z = -6; z <= 6; z += 2) P(hg, box(0.6, 1.45, 0.5), woodD, 0, -0.85, z);
  for (const s of [-1, 1]) for (const z of [-4.5, -1, 2.5]) beam(hg, [s * (navHw(z) + 1.5), -1.4, z], [s * navHw(z) * 0.92, navTop(z) * 0.5, z], 0.07, wood);
  colB(g, 0, (z0 + z1) / 2 + hz * Math.cos(ang), NAV.B + 0.6, NAV.L + 1.2);
  // кран — наклонная двунога с воротом над корпусом
  const cr = grp(g, 5.4, 0, -1.2);
  beam(cr, [0.6, 0, -1.6], [-2.6, 9.2, 0], 0.13, wood); beam(cr, [0.6, 0, 1.6], [-2.6, 9.2, 0], 0.13, wood);
  P(cr, cyl(0.18, 0.18, 0.3, 10), woodD, -2.6, 9.0, 0, HPI);
  rope(cr, [-2.6, 9.0, 0], [-2.6, 4.6, 0], 0.02); rope(cr, [-2.6, 9.15, 0], [2.6, 0.2, 0], 0.016);
  P(cr, cyl(0.06, 0.06, 0.4, 5), woodD, 2.6, 0.2, 0);
  P(cr, tube('ecoNavFrame', [[-3.6, 4.4, 0], [-3.2, 3.8, 0.0], [-2.6, 3.6, 0], [-2.0, 3.8, 0], [-1.6, 4.4, 0]], 0.08, 0.08, 8, 4), wood);
  rope(cr, [-2.6, 4.6, 0], [-3.4, 4.2, 0], 0.012); rope(cr, [-2.6, 4.6, 0], [-1.8, 4.2, 0], 0.012);
  P(cr, cyl(0.16, 0.16, 2.6, 8), woodL, 0.5, 0.7, 0, HPI);
  for (const s of [-1, 1]) { P(cr, box(0.14, 0.9, 0.14), woodD, 0.5, 0.45, s * 1.3); for (let k = 0; k < 4; k++) P(cr, box(0.05, 0.9, 0.05), woodD, 0.5, 0.7, s * 1.45, k * PI / 4); }
  rope(cr, [0.5, 0.86, 0], [-2.6, 9.0, 0], 0.02);
  for (const s of [-1, 1]) colC(g, 6.0, -1.2 + s * 1.6, 0.2);
  // навес плотников
  const sh = grp(g, -6.4, 0, -5.6);
  for (const [x, z] of [[-1.8, -1.6], [1.8, -1.6], [-1.8, 1.6], [1.8, 1.6]]) { post(sh, x, 0, z, 2.8, 0.1); colC(g, -6.4 + x, -5.6 + z, 0.14); }
  shed(sh, 0, 3.1, 0, 4.0, 3.6, 0.4, 0, TILE());
  plankStack(sh, -0.8, 0, -0.5, 12, HPI); plankStack(sh, 0.9, 0, 0.6, 9, HPI);
  for (const x of [-0.6, 0.8]) { const sw = grp(sh, x, 0, 1.0); for (const s of [-1, 1]) P(sw, box(0.06, 0.8, 0.06), woodD, s * 0.25, 0.38, 0, 0, 0, s * 0.25); P(sw, box(0.08, 0.08, 0.7), woodD, 0, 0.75, 0); }
  P(sh, box(1.8, 0.1, 0.25), woodL, -0.1, 0.84, 1.0); tool(sh, 'saw', 0.1, 0.9, 1.0, -HPI, 0, 0); tool(sh, 'adze', -0.6, 0.9, 1.05, HPI, 0, 0.3);
  // запасы леса, гнутые шпангоуты, котёл со смолой, вёсла, якорь
  logPile(g, 6.6, 0, -6.4, 10, 3.8, 0.1); colB(g, 6.6, -6.4, 1.5, 3.9, 0.1);
  logPile(g, -6.8, 0, 1.2, 6, 3.2, 0); colB(g, -6.8, 1.2, 1.3, 3.3);
  for (let i = 0; i < 4; i++) P(g, tube(`ecoNavCurve${i}`, [[-0.8, 0.1, 0], [-0.3, 0.12, 0.5 + i * 0.05], [0.4, 0.1, 0.7 + i * 0.08], [1.0, 0.1, 0.4]], 0.07, 0.07, 6, 4), wood, -5.6, i * 0.14, 4.4 - i * 0.25);
  const pt = grp(g, -3.6, 0, -6.6);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; beam(pt, [Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6], [0, 1.4, 0], 0.03, ironM(), 4); }
  rope(pt, [0, 1.4, 0], [0, 1.0, 0], 0.01, ironM());
  P(pt, lathe('ecoCaul', [[0, 0], [0.25, 0.03], [0.4, 0.2], [0.42, 0.4], [0.38, 0.44], [0, 0.4]], 12), M(0x2a2622), 0, 0.5, 0);
  P(pt, cyl(0.37, 0.37, 0.02, 12), M(0x0e0a08, { roughness: 0.2 }), 0, 0.88, 0);
  campfire(pt, 0, 0, 4, 8);
  colC(g, -3.6, -6.6, 0.7);
  for (let i = 0; i < 5; i++) { const o = grp(g, 3.38 + i * 0.11, 1.25, 6.0 + (i % 2) * 0.3, HPI - 0.02, 0, 0); P(o, cyl(0.035, 0.04, 3.6, 5), M(0xb8905a), 0, 0, 0); P(o, box(0.18, 0.7, 0.03), M(0xb8905a), 0, -1.9, 0); }
  P(g, box(0.8, 1.2, 0.3), woodD, 3.6, 0.6, 5.0); P(g, box(0.8, 1.2, 0.3), woodD, 3.6, 0.6, 7.2);
  const an = grp(g, -3.6, 0, 6.0, 0, 0.5, 0);
  P(an, box(0.18, 1.6, 0.18), woodD, 0, 0.12, 0, HPI); P(an, box(1.2, 0.18, 0.18), M(0x5a5a58), 0, 0.12, 0.6); P(an, rbox(0.5, 0.4, 0.3, 0.05), M(0x8a8478), 0, 0.2, -0.6);
  P(g, tor(0.35, 0.08, 5, 12), M(C.rope), -2.6, 0.08, 6.4, HPI); P(g, tor(0.3, 0.07, 5, 12), M(C.rope), -2.6, 0.22, 6.4, HPI);
  banner(g, -7.6, 0, -1.6, 4.0);
};

// ---------- Пурпурная красильня и жемчужный промысел (murex_farm, r 7) ----------
const shellG = () => G('ecoMurex', () => { const q = new THREE.ConeGeometry(0.035, 0.1, 5, 1); q.translate(0, 0.03, 0); return q; });
function shellPile(par, x, z, r, h, seed) {
  const g = grp(par, x, 0, z), rr = rng(seed);
  P(g, moundG(r, h, seed, 10), FOL(0xd8c4b0), 0, h / 2 - 0.05, 0);
  const cols = [M(0xe0cfc0), M(0xb89a8a), M(0xcdb4a0), M(0x9a7a72)];
  for (let i = 0; i < 26; i++) {
    const a = rr() * TAU, k = Math.sqrt(rr()) * 0.92, yy = (1 - k) * h;
    P(g, shellG(), cols[i % 4], Math.cos(a) * k * r, yy - 0.02, Math.sin(a) * k * r, rr() * 3, rr() * 3, rr() * 3, 1.3);
  }
  return g;
}
BUILD.murex_farm = (g) => {
  ground(g, 0, -0.6, 9.8, 7.8, 0xcdb88e, 0.04);
  // мастерская
  plinth(g, -2.8, -3.8, 4.4, 2.4, 0.2);
  wall(g, -2.8, 0.2, -3.8, 4.0, 2.7, 2.0, 0, { col: 0xe0d4ba, dadoCol: 0x5e1f5a });
  gable(g, -2.8, 2.9, -3.8, 4.0, 2.0, 0.45, 0.3, 'x');
  door(g, -2.2, 0.2, -2.78, 0, 1.0, 2.0); win(g, -3.8, 1.8, -2.79, 0, 0.5, 0.5);
  colB(g, -2.8, -3.8, 4.4, 2.4);
  // каменные чаны для вымачивания моллюсков (разные стадии пурпура)
  [[0x4a1040, -3.9, -1.1], [0x6a1a5a, -2.5, -1.1], [0x3a0a2a, -3.9, 0.3], [0x7a2a6a, -2.5, 0.3]].forEach(([col, x, z]) => basin(g, x, 0, z, 1.25, 0.7, 1.25, 0.12, M(0xb8ac94), M(col, { roughness: 0.25 })));
  colB(g, -3.2, -0.4, 2.7, 2.7);
  // свинцовый котёл на печи
  const kt = grp(g, -0.6, 0, -1.2);
  P(kt, tbox(1.3, 0.9, 1.3), ASH(), 0, 0.45, 0);
  P(kt, box(0.5, 0.4, 0.05), M(0x1a0e08), 0, 0.3, 0.66); P(kt, box(0.4, 0.15, 0.05), EMB(), 0, 0.18, 0.67);
  P(kt, lathe('ecoLeadPot', [[0, 0], [0.3, 0.02], [0.48, 0.18], [0.5, 0.42], [0.46, 0.46], [0, 0.4]], 14), M(0x6a6e74, { metalness: 0.3, roughness: 0.6 }), 0, 0.9, 0);
  P(kt, cyl(0.45, 0.45, 0.02, 14), M(0x5a0a4a, { roughness: 0.2 }), 0, 1.32, 0);
  const kl = new VLight(0xff8040, 3, 6, 1.6); kl.position.set(0, 0.4, 1.0); kt.add(kl);
  colB(g, -0.6, -1.2, 1.3, 1.3);
  logPile(g, 0.6, 0, -2.6, 4, 1.2, HPI);
  // кучи раковин мурекса
  shellPile(g, 1.8, -3.6, 1.1, 0.7, 11); shellPile(g, 3.6, -2.4, 0.9, 0.55, 23);
  colC(g, 1.8, -3.6, 1.0); colC(g, 3.6, -2.4, 0.8);
  // сушильные рамы с пурпурной тканью
  for (const z of [0.0, 1.5]) {
    dryLine(g, [1.6, z], [4.4, z], 2.0, [[0.2, 0.7, 1.2, 0x5e1f5a], [0.5, 0.7, 1.3, 0x7a2a6a], [0.8, 0.7, 1.1, 0x4a1040]]);
    colC(g, 1.6, z, 0.1); colC(g, 4.4, z, 0.1);
  }
  // стол сортировки: мурекс, устрицы, блюдо с жемчугом
  const tb = grp(g, -1.6, 0, 2.2);
  table(tb, 0, 0, 0, 1.6, 0.8);
  for (let i = 0; i < 10; i++) P(tb, shellG(), M(0xd8c4b0), -0.6 + (i % 5) * 0.28, 0.82, -0.2 + Math.floor(i / 5) * 0.18, HPI, i, 0, 1.3);
  for (let i = 0; i < 4; i++) P(tb, sph(0.07, 8, 4), M(0x8a8478), 0.4 + (i % 2) * 0.18, 0.81, 0.15 + Math.floor(i / 2) * 0.14, 0, i, 0, 1, 0.35, 1.2);
  P(tb, cyl(0.12, 0.09, 0.03, 12), M(0xb8643c), 0.55, 0.8, -0.2);
  for (let i = 0; i < 5; i++) P(tb, sph(0.012, 6, 4), M(0xf4f0ea, { roughness: 0.25, metalness: 0.2 }), 0.52 + (i % 3) * 0.03, 0.83, -0.2 + Math.floor(i / 3) * 0.03);
  bench(tb, 0, 0, -0.7, 1.4);
  colB(g, -1.6, 2.2, 1.7, 0.9);
  basket(g, -3.2, 0, 2.4, 0.3, 0.35, 0xd8c4b0); basket(g, -3.6, 0, 1.9, 0.28, 0.3, 0xcdb4a0);
  // мостки в море с ловушками-вершами
  pier(g, 1.0, 2.6, 10.0, 2.0, 0.5, 2.6);
  for (let i = 0; i < 4; i++) { const tr = grp(g, 0.5 + (i % 2) * 0.9, 0.58, 5.2 + Math.floor(i / 2) * 1.3, HPI, 0, 0.2 * i); P(tr, lathe('ecoTrap', [[0.05, 0], [0.18, 0.05], [0.24, 0.3], [0.2, 0.55], [0.1, 0.6]], 10), M(0xa88a50, DS)); }
  P(g, tor(0.28, 0.06, 5, 12), M(C.rope), 1.4, 0.64, 8.6, HPI);
  rope(g, [1.8, 0.6, 9.8], [2.6, -0.2, 11.2], 0.012);
  P(g, sph(0.15, 8, 6), M(0xc8a060), 2.6, -0.1, 11.2);
};

// ---------- Вилла латифундии (villa rustica, r 14) ----------
BUILD.villa = (g) => {
  const hx = -3, hz = -3.5, W = 12, D = 10, t = 3, y = 0.4;
  plinth(g, hx, hz, W + 0.4, D + 0.4, y);
  const wcol = { col: 0xece0c6, dadoCol: 0x9a2c22 };
  wall(g, hx, y, hz + D / 2 - t / 2, W, 3.8, t, 0, wcol);
  wall(g, hx, y, hz - D / 2 + t / 2, W, 4.4, t, 0, wcol);
  for (const s of [-1, 1]) wall(g, hx + s * (W / 2 - t / 2), y, hz, t, 3.4, D - 2 * t, 0, { ...wcol, cornice: false });
  gable(g, hx, y + 3.8, hz + D / 2 - t / 2, W, t, 0.42, 0.35, 'x');
  gable(g, hx, y + 4.4, hz - D / 2 + t / 2, W, t, 0.42, 0.35, 'x');
  for (const s of [-1, 1]) gable(g, hx + s * (W / 2 - t / 2), y + 3.4, hz, t, D - 2 * t + 0.6, 0.42, 0.25, 'z', { gables: false });
  for (const zz of [hz + D / 2 - t / 2, hz - D / 2 + t / 2]) colB(g, hx, zz, W, t);
  for (const s of [-1, 1]) colB(g, hx + s * (W / 2 - t / 2), hz, t, D - 2 * t);
  // перистиль: колоннада, кровельки внутрь, сад с фонтаном
  const cx0 = hx - W / 2 + t, cx1 = hx + W / 2 - t, cz0 = hz - D / 2 + t, cz1 = hz + D / 2 - t;
  ground(g, hx, hz, cx1 - cx0, cz1 - cz0, 0x6e8a3a, y + 0.05);
  const ci = 0.55;
  colRow(g, cx0 + ci, cz1 - ci, cx1 - ci, cz1 - ci, 4, y, 2.8, 0.13, 'tuscan', M(0xf0e8d8), false);
  colRow(g, cx0 + ci, cz0 + ci, cx1 - ci, cz0 + ci, 4, y, 2.8, 0.13, 'tuscan', M(0xf0e8d8), false);
  for (const s of [-1, 1]) column(g, s < 0 ? cx0 + ci : cx1 - ci, y, hz, 2.8, 0.13, 'tuscan', M(0xf0e8d8));
  shed(g, hx, y + 3.4, cz1 - 0.05, cx1 - cx0, ci * 2, 0.4, PI, TILE());
  shed(g, hx, y + 3.4, cz0 + 0.05, cx1 - cx0, ci * 2, 0.4, 0, TILE());
  for (const s of [-1, 1]) shed(g, s < 0 ? cx0 + 0.5 : cx1 - 0.5, y + 3.2, hz, cz1 - cz0 - ci * 4, 1.0, 0.3, s * -HPI, TILE());
  basin(g, hx, y, hz, 1.4, 0.35, 1.0, 0.08, M(C.marble));
  P(g, cyl(0.06, 0.08, 0.6, 6), M(C.marble), hx, y + 0.5, hz);
  for (const [dx, dz, k] of [[-1.8, -0.9, 'myrtle'], [1.8, -0.9, 'rosemary'], [-1.8, 0.9, 'oleander'], [1.8, 0.9, 'myrtle']]) { const p = makePlant(k); p.position.set(hx + dx, y, hz + dz); p.scale.setScalar(0.6); g.add(p); }
  // вход: двери, ступени, знамёна
  door(g, hx, y, hz + D / 2 + 0.02, 0, 1.6, 2.8, true);
  stairs(g, hx, y, hz + D / 2 + 0.2, 2.6, 2, 0.2, 0.45);
  for (const s of [-1, 1]) { win(g, hx + s * 3.5, y + 2.7, hz + D / 2 + 0.02, 0, 0.5, 0.5); win(g, hx + s * 3.5, y + 3.0, hz - D / 2 - 0.02, PI, 0.6, 0.6); banner(g, hx + s * 1.9, 0, hz + D / 2 + 1.4, 4.0); }
  ground(g, hx, 6.0, 2.2, 7.6, 0xc8b890, 0.04);
  // жильё рабов (cellae familiae)
  plinth(g, 6.9, -7.1, 5.6, 3.2, 0.2);
  wall(g, 6.9, 0.2, -7.1, 5.4, 2.6, 3.0, 0, { col: 0xd8c8a8, dadoCol: 0x7a5a3a });
  gable(g, 6.9, 2.8, -7.1, 5.4, 3.0, 0.48, 0.3, 'x', { mat: THATCH(), antefix: false });
  for (let i = 0; i < 4; i++) door(g, 4.9 + i * 1.33, 0.2, -5.58, 0, 0.75, 1.75);
  colB(g, 6.9, -7.1, 5.6, 3.2);
  // зернохранилище на столбах
  const gr = grp(g, 7.4, 0, -1.6);
  for (const x of [-1.8, 0, 1.8]) for (const z of [-1.2, 1.2]) { P(gr, rbox(0.4, 1.0, 0.4, 0.03), M(C.stone), x, 0.5, z); P(gr, box(0.6, 0.08, 0.6), M(C.stoneD), x, 1.02, z); }
  P(gr, tbox(4.4, 2.3, 3.0), PLANK(), 0, 2.2, 0);
  gable(gr, 0, 3.35, 0, 4.4, 3.0, 0.45, 0.3, 'x', { gableCol: 0x9a7a50 });
  P(gr, box(0.8, 1.3, 0.05), M(0x2a1a10), 0.8, 1.9, 1.53);
  const ld = grp(gr, 0.8, 0, 2.3, -0.5, 0, 0); for (const s of [-1, 1]) P(ld, box(0.06, 1.9, 0.06), M(C.woodL), s * 0.25, 0.85, 0); for (let i = 0; i < 5; i++) P(ld, box(0.5, 0.04, 0.04), M(C.woodL), 0, 0.2 + i * 0.36, 0);
  colB(g, 7.4, -1.6, 4.4, 3.0);
  // давильня (torcularium) с рычажным прессом
  const tq = grp(g, 6.6, 0, 4.8);
  for (const [x, z] of [[-2.4, -1.6], [2.4, -1.6], [-2.4, 1.6], [2.4, 1.6]]) { post(tq, x, 0, z, 2.9, 0.1); colC(g, 6.6 + x, 4.8 + z, 0.15); }
  shed(tq, 0, 3.2, 0, 5.0, 3.6, 0.45, 0, TILE());
  for (const s of [-1, 1]) P(tq, box(0.25, 2.6, 0.25), M(C.woodD), -2.0, 1.3, s * 0.3);
  P(tq, box(4.4, 0.3, 0.3), M(C.wood), 0.1, 1.15, 0, 0, 0, -0.08);
  P(tq, cyl(0.7, 0.7, 0.2, 16), M(C.stone), -0.6, 0.1, 0); P(tq, cyl(0.5, 0.5, 0.35, 12), M(0x6a3a2a), -0.6, 0.35, 0);
  P(tq, cyl(0.4, 0.45, 0.6, 12), M(0x9a9080), 2.2, 0.3, 0); P(tq, box(0.12, 1.4, 0.12), M(C.woodD), 2.2, 0.9, 0);
  P(tq, cyl(0.06, 0.06, 0.7, 6), M(C.woodL), 2.2, 1.2, 0, HPI);
  basin(tq, -0.6, 0, 1.25, 1.2, 0.35, 0.7, 0.1, M(C.stone), M(0x4a0a1a, { roughness: 0.2 }));
  for (let i = 0; i < 4; i++) dolium(g, 3.8 + (i % 2) * 1.0, -0.35, 7.4 + Math.floor(i / 2) * 0.9, 0.85);
  colB(g, 6.6, 4.8, 3.2, 1.0);
  // огород и колодец
  cropRows(g, -9.0, -4.6, 4.2, 8.8, 0.7, 0.45, 0x8ab04a);
  fence(g, [[-9.5, 3.7], [-9.5, 9.3], [-4.1, 9.3], [-4.1, 3.7], [-6.0, 3.7]], 1.0);
  const wl = grp(g, 1.6, 0, 3.6);
  P(wl, tcyl(0.7, 0.75, 0.8, 14), ASH(), 0, 0.4, 0); P(wl, cyl(0.55, 0.55, 0.02, 12), M(0x10181a), 0, 0.78, 0);
  for (const s of [-1, 1]) P(wl, box(0.1, 1.6, 0.1), M(C.woodD), s * 0.7, 1.0, 0);
  P(wl, cyl(0.06, 0.06, 1.6, 6), M(C.wood), 0, 1.7, 0, 0, 0, HPI); rope(wl, [0, 1.7, 0], [0, 1.1, 0], 0.01);
  P(wl, cyl(0.1, 0.08, 0.16, 8), M(C.woodD), 0, 1.0, 0);
  colC(g, 1.6, 3.6, 0.8);
  cart(g, 0.8, 0, 7.6, 0.4, 'amph'); colB(g, 0.8, 7.6, 1.5, 3.4, 0.4);
  for (let i = 0; i < 3; i++) sack(g, 4.8 + i * 0.5, 0, 0.4, 1, 0xd2be92, i);
};

// ---------- Морская фактория (emporium, r 9): склад, кран, пирс на +Z ----------
BUILD.emporium = (g) => {
  lowWarehouse(g, -1.6, -3.7, 9, 4.6);
  // контора
  plinth(g, 4.6, -3.8, 3.2, 3.4, 0.3);
  wall(g, 4.6, 0.3, -3.8, 2.8, 3.0, 3.0, 0, { col: 0xeadcc0 });
  gable(g, 4.6, 3.3, -3.8, 2.8, 3.0, 0.42, 0.3, 'z');
  door(g, 4.6, 0.3, -2.28, 0, 1.0, 2.0); win(g, 6.01, 2.1, -3.8, HPI, 0.5, 0.5);
  colB(g, 4.6, -3.8, 3.2, 3.4);
  // каменная набережная и пирс
  P(g, tbox(12.6, 2.2, 1.8), ASH(), 0, -0.8, 2.9); P(g, box(12.7, 0.08, 1.9), M(C.stoneD), 0, 0.28, 2.9);
  for (const x of [-5, -1, 4.8]) P(g, cyl(0.14, 0.18, 0.45, 8), M(0x6a6a64), x, 0.5, 3.4);
  pier(g, 2.4, 3.6, 11.6, 3.2, 0.55, 3.0);
  for (const z of [6, 10]) for (const s of [-1, 1]) P(g, cyl(0.12, 0.14, 0.45, 8), M(0x5a4430), 2.4 + s * 1.45, 0.85, z);
  // поворотный кран (журавль) на конце пирса
  const cr = grp(g, 2.4, 0.63, 9.6);
  P(cr, box(1.4, 0.3, 1.4), M(C.woodD), 0, 0.15, 0);
  P(cr, cyl(0.16, 0.2, 5.2, 8), M(C.wood), 0, 2.9, 0);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + PI / 4; beam(cr, [Math.cos(a) * 0.9, 0.3, Math.sin(a) * 0.9], [0, 2.2, 0], 0.06, M(C.woodD)); }
  const jib = grp(cr, 0, 4.6, 0, 0, -0.9, 0);
  beam(jib, [0, 0, -1.4], [0, 1.6, 4.0], 0.1, M(C.wood));
  rope(jib, [0, 1.55, 3.9], [0, -2.0, 3.85], 0.018); rope(jib, [0, 0.6, 0], [0, 1.55, 3.9], 0.014);
  P(jib, box(0.5, 0.4, 0.4), M(0x8a8478), 0, 0.1, -1.4);
  const net = grp(jib, 0, -2.4, 3.85);
  P(net, G('ecoNetBag', () => lumpy(new THREE.SphereGeometry(0.45, 10, 6), 0.08, 3)), TM('net', 0xe0d4b4), 0, 0, 0, 0, 0, 0, 1, 0.9, 1);
  for (let i = 0; i < 4; i++) amphora(net, (i % 2 - 0.5) * 0.3, -0.35, (Math.floor(i / 2) - 0.5) * 0.3, 0.55);
  for (const k of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) rope(net, [0, 0.45, 0], [k[0], -0.1, k[1]], 0.008);
  colB(g, 2.4, 9.6, 1.4, 1.4);
  // двор: весы, ящики, амфоры в штабеле, мешки
  statera(g, -3.6, 0, 0.6, 0);
  colB(g, -3.6, 0.6, 2.2, 0.5);
  crateStack(g, 0.8, 0.0, 3, 2, 0.1); colB(g, 0.8, 0.0, 2.6, 0.7, 0.1);
  for (let i = 0; i < 3; i++) tcrate(g, 1 + i, 3.2 + i * 0.9, 0, 0.2, 1, 0.1 * i);
  tcrate(g, 2, 3.6, 0.6, 0.2, 1, 0.3); colB(g, 4.1, 0.2, 2.8, 0.7);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) amphora(g, -5.8 + i * 0.42 + row * 0.21, 0.22 + row * 0.36, -0.6, 0.8, 0xa8784a, HPI);
  colB(g, -5.2, -0.6, 1.8, 1.2);
  for (let i = 0; i < 4; i++) sack(g, -1.0 + (i % 2) * 0.55, 0, 1.6 + Math.floor(i / 2) * 0.5, 1, 0xd2be92, i);
  barrel(g, 5.6, 0, 1.6); barrel(g, 5.9, 0, 0.9);
  P(g, tor(0.3, 0.07, 5, 12), M(C.rope), 3.4, 0.68, 4.6, HPI);
};

// ---------- Сухопутная фактория / почтовая станция (statio, r 8) ----------
BUILD.statio = (g) => {
  ground(g, 0, 4.4, 11.2, 2.4, 0xb8a888, 0.05);                  // дорога
  for (let i = 0; i < 6; i++) P(g, box(1.8, 0.02, 0.06), M(0x9a8a6a), -4.6 + i * 1.85, 0.05, 4.0 + (i % 2) * 0.8);
  // каретный сарай
  const sh = grp(g, -2.6, 0, -3.2);
  for (const [x, z] of [[-2.6, -1.8], [0, -1.8], [2.6, -1.8], [-2.6, 1.8], [0, 1.8], [2.6, 1.8]]) { post(sh, x, 0, z, 3.0, 0.11); colC(g, -2.6 + x, -3.2 + z, 0.16); }
  P(sh, tbox(5.4, 2.6, 0.12), PLANK(), 0, 1.3, -1.9);
  shed(sh, 0, 3.35, 0, 5.6, 4.0, 0.55, 0, TILE());
  cart(sh, -1.3, 0, 0, 0, 'sacks'); cart(sh, 1.3, 0, 0.2, 0.05, 'amph');
  colB(g, -2.6, -5.1, 5.6, 0.3); colB(g, -3.9, -3.2, 1.5, 3.4); colB(g, -1.3, -3.0, 1.5, 3.4);
  // станционный дом
  plinth(g, 3.4, -3.8, 4.2, 3.2, 0.25);
  wall(g, 3.4, 0.25, -3.8, 3.8, 2.9, 2.8, 0, { col: 0xe6d8bc });
  gable(g, 3.4, 3.15, -3.8, 3.8, 2.8, 0.42, 0.35, 'x');
  door(g, 2.6, 0.25, -2.38, 0, 1.0, 2.0); win(g, 4.3, 1.9, -2.39, 0, 0.6, 0.5);
  colB(g, 3.4, -3.8, 4.2, 3.2);
  const sg = grp(g, 4.6, 2.5, -2.3); P(sg, box(1.0, 0.4, 0.05), M(0xe8dcbc), 0, 0, 0); P(sg, tor(0.12, 0.025, 4, 12), M(C.woodD), 0, 0, 0.03);
  bench(g, 4.4, 0.25, -1.9, 1.4);
  // штабели ящиков и мешков
  crateStack(g, 0.9, -0.8, 3, 3, 0.0); colB(g, 0.9, -0.8, 2.6, 0.7);
  for (let i = 0; i < 2; i++) tcrate(g, 1 + i, 2.8 + i * 0.9, 0, -0.6, 1, 0.2);
  for (let i = 0; i < 5; i++) sack(g, -4.4 + (i % 3) * 0.55, 0, 0.2 + Math.floor(i / 3) * 0.55, 1, 0xd2be92, i);
  // коновязь, конь, поилка
  const hp = grp(g, 2.6, 0, 1.6);
  for (const x of [-1.4, 0, 1.4]) { post(hp, x, 0, 0, 1.1, 0.08); colC(g, 2.6 + x, 1.6, 0.12); }
  P(hp, cyl(0.05, 0.05, 3.0, 6), M(C.wood), 0, 1.05, 0, 0, 0, HPI);
  const hr = makeAnimal('horse'); hr.position.set(2.0, 0, 2.8); hr.rotation.y = PI + 0.15; g.add(hr); colC(g, 2.0, 2.8, 0.9);
  rope(g, [2.0, 1.05, 1.6], [2.02, 1.4, 1.95], 0.01);
  basin(g, 4.8, 0, 2.4, 1.6, 0.5, 0.6, 0.08, M(C.stone)); colB(g, 4.8, 2.4, 1.6, 0.6);
  P(g, G('haystack', () => lumpy(new THREE.ConeGeometry(1.2, 2.2, 10, 2), 0.06, 2)), M(0xd8b860), -4.6, 0.7, 2.0, 0, 0, 0, 0.7); colC(g, -4.6, 2.0, 0.8);
  // мильный столб (miliarium) у дороги
  const ms = grp(g, -2.4, 0, 3.0);
  P(ms, box(0.8, 0.3, 0.8), M(C.stoneD), 0, 0.15, 0);
  P(ms, cyl(0.26, 0.3, 1.7, 12), M(0xe0d6c0), 0, 1.15, 0);
  P(ms, cyl(0.3, 0.3, 0.12, 12), M(C.stone), 0, 2.05, 0);
  for (let i = 0; i < 3; i++) P(ms, box(0.36 - i * 0.06, 0.04, 0.02), M(0x5a4a3a), 0, 1.6 - i * 0.12, 0.29);
  colC(g, -2.4, 3.0, 0.4);
  // запасное колесо, амфора с водой
  const wh = grp(g, 5.4, 0.62, -1.4, 0, 0, 0.25); P(wh, tor(0.5, 0.05, 6, 20), M(C.woodD), 0, 0, 0); for (let i = 0; i < 4; i++) P(wh, box(0.96, 0.04, 0.04), M(C.wood), 0, 0, 0, 0, 0, i * PI / 4);
  amphora(g, 5.2, 0, 0.2, 1.0, 0xa8784a);
};

// ---------- Рудник (metallum, r 7): вход в штольню, вагонетки, отвал ----------
BUILD.metallum = (g) => {
  const rk = FOL(0x8a7a66);
  P(g, G('ecoMineHill', () => lumpy(new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, HPI), 0.12, 7)), rk, 0, -0.1, -3.6, 0, 0, 0, 5.0, 4.2, 3.2);
  for (const [x, z, r, s] of [[-3.6, -1.2, 0.8, 1], [3.8, -1.4, 0.7, 2], [-1.6, -0.9, 0.5, 3], [2.0, -0.6, 0.45, 4]]) P(g, rockG(r, s), FOL(0x9a8a76), x, r * 0.4, z);
  colB(g, 0, -3.8, 9.6, 5.0);
  // устье штольни с крепью
  const mz = -0.85;
  P(g, box(1.7, 2.2, 1.2), M(0x0c0a08), 0, 1.1, mz - 0.4);
  const wd = M(0x6a4a2a);
  for (const [z, k] of [[mz + 0.25, 1], [mz - 0.35, 0.95], [mz - 0.95, 0.9]]) {
    for (const s of [-1, 1]) P(g, cyl(0.12, 0.13, 2.4 * k, 6), wd, s * 0.95 * k, 1.2 * k, z, 0, 0, s * 0.05);
    P(g, cyl(0.13, 0.13, 2.3 * k, 6), wd, 0, 2.4 * k, z, 0, 0, HPI);
  }
  P(g, box(2.4, 0.6, 0.3), PLANK(), 0, 2.75, mz + 0.2);
  for (let i = 0; i < 6; i++) P(g, rockG(0.35, 30 + i, 0), FOL(0x8a7a66), (i < 3 ? -1 : 1) * (1.4 + (i % 3) * 0.35), 0.25 + (i % 3) * 0.5, mz + 0.1);
  P(g, cyl(0.04, 0.05, 0.12, 6), M(0xb8643c), 1.05, 1.9, mz + 0.4); P(g, cone(0.025, 0.07, 5), FLAME(), 1.05, 2.0, mz + 0.42).castShadow = false;
  // рельсы-колеи из брусьев и вагонетки
  for (const s of [-1, 1]) P(g, box(0.08, 0.08, 5.8), M(0x5a4028), s * 0.4, 0.12, 1.9);
  for (let z = -0.8; z < 4.8; z += 0.6) P(g, box(1.2, 0.07, 0.16), M(0x4a3420), 0, 0.04, z);
  const cartM = (x, z, ry, tilt, load) => {
    const c = grp(g, x, 0, z, 0, ry, 0), bd = grp(c, 0, 0.42, 0, tilt, 0, 0);
    P(bd, box(0.9, 0.08, 1.2), PLANK(), 0, 0, 0);
    for (const s of [-1, 1]) { P(bd, box(0.06, 0.5, 1.2), PLANK(), s * 0.45, 0.25, 0); P(bd, box(0.9, 0.5, 0.06), PLANK(), 0, 0.25, s * 0.6); }
    for (const s of [-1, 1]) P(bd, box(1.0, 0.05, 0.05), ironM(), 0, 0.48, s * 0.62);
    if (load) for (let i = 0; i < 9; i++) P(bd, ico(0.16, 0), FOL(i % 3 ? 0x7a5a4a : 0x5a4a44), -0.25 + (i % 3) * 0.25, 0.48 + (i % 2) * 0.06, -0.4 + Math.floor(i / 3) * 0.4, i, i, 0);
    for (const s of [-1, 1]) for (const sz of [-1, 1]) P(c, cyl(0.17, 0.17, 0.08, 10), M(0x4a3a2a), s * 0.4, 0.2, sz * 0.4, 0, 0, HPI);
    return c;
  };
  cartM(0, 2.6, 0, 0, true); colB(g, 0, 2.6, 1.0, 1.3);
  cartM(2.2, 1.6, -0.5, -0.5, false); colB(g, 2.2, 1.6, 1.0, 1.3, -0.5);
  // отвал пустой породы
  P(g, moundG(1.8, 1.6, 17, 12), FOL(0x8a7258), 3.4, 0.75, 2.6); colC(g, 3.4, 2.6, 1.6);
  P(g, box(0.5, 0.05, 2.6), PLANK(), 2.6, 0.6, 2.0, 0.42, 0.5, 0);
  // куча отобранной руды, корзины, инструменты, сарай
  P(g, moundG(0.9, 0.7, 19, 9), FOL(0x6a3a2a), -2.6, 0.3, 2.8);
  for (let i = 0; i < 6; i++) P(g, ico(0.12, 0), FOL(0x8a4a2a), -2.0 + (i % 3) * 0.2, 0.08, 3.5 + Math.floor(i / 3) * 0.2, i, i, 0);
  colC(g, -2.6, 2.8, 0.9);
  basket(g, -1.4, 0, 3.8, 0.25, 0.3, 0x6a3a2a); basket(g, -3.4, 0, 4.0, 0.25, 0.3, 0x7a5a4a);
  tool(g, 'pick', -1.2, 0.05, 1.6, HPI, 0.4, 0); tool(g, 'shovel', -1.6, 0.05, 2.0, HPI, -0.3, 0);
  const st = grp(g, -3.8, 0, 0.8);
  for (const [x, z] of [[-0.9, -0.7], [0.9, -0.7], [-0.9, 0.7], [0.9, 0.7]]) post(st, x, 0, z, 2.1, 0.07);
  shed(st, 0, 2.35, 0, 2.0, 1.6, 0.3, 0, THATCH());
  P(st, rbox(0.5, 0.45, 0.5, 0.05), M(0x6a6a64), 0, 0.22, 0); P(st, box(0.25, 0.06, 0.06), ironM(), 0, 0.48, 0);
  barrel(st, 0.5, 0, -0.4, 0.8);
  colB(g, -3.8, 0.8, 2.0, 1.6);
};

// ---------- Каменоломня (lapicidina, r 8): уступы, блоки, подъёмная тренога ----------
BUILD.lapicidina = (g) => {
  const cut = [M(0xe2d8c0), M(0xd8ccb0), M(0xcfc2a2)];
  P(g, box(11.0, 5.0, 2.4), cut[0], 0, 2.5, -4.4);
  P(g, box(9.8, 3.3, 1.8), cut[1], 0, 1.65, -2.6);
  // нижний уступ с полуотделёнными блоками
  P(g, box(6.6, 0.9, 1.4), cut[2], -0.8, 0.45, -1.1);
  for (let i = 0; i < 4; i++) { P(g, rbox(1.45, 0.75, 1.3, 0.02), cut[i % 3], -3.2 + i * 1.6, 0.9 + 0.37, -1.1); P(g, box(0.08, 0.76, 1.32), M(0x8a7e66), -2.42 + i * 1.6, 1.27, -1.1); }
  for (let i = 0; i < 5; i++) P(g, box(0.05, 0.12, 0.03), M(0x5a5040), -3.6 + i * 0.4, 1.0, -0.44);
  for (let i = 0; i < 5; i++) P(g, box(1.6, 0.06, 0.02), M(0xb8ac90), -3.8 + i * 1.9, 0.6 + (i % 3) * 1.0, -1.69);
  P(g, box(11.0, 0.12, 0.04), M(0xb8ac90), 0, 3.4, -3.19);
  // грубая скала по краям и сверху
  for (const [x, y, z, r, s] of [[-5.4, 1.4, -1.8, 1.4, 1], [5.4, 1.2, -2.0, 1.3, 2], [-4.2, 5.2, -4.6, 1.2, 3], [-1.0, 5.3, -4.8, 1.1, 4], [2.4, 5.2, -4.4, 1.3, 5], [5.0, 5.0, -4.8, 1.0, 6], [-5.6, 3.2, -3.8, 1.3, 7], [5.6, 3.4, -3.6, 1.2, 8]])
    P(g, rockG(r, s), FOL(0xb0a48a), x, y, z, 0, s, 0, 1, 0.8, 1);
  for (let i = 0; i < 3; i++) { const b = makePlant(i % 2 ? 'thyme' : 'juniper'); b.position.set(-3 + i * 3.2, 5.0, -4.6); b.scale.setScalar(0.5); g.add(b); }
  colB(g, 0, -3.3, 11.2, 4.6); colB(g, -0.8, -1.1, 6.8, 1.5);
  // щебень на полу
  const rr = rng(91); for (let i = 0; i < 30; i++) P(g, ico(0.06 + rr() * 0.08, 0), FOL(i % 2 ? 0xd8ccb0 : 0xc8bca0), (rr() - 0.5) * 10, 0.03, -0.2 + rr() * 5, rr() * 3, rr() * 3, 0);
  // подъёмная тренога с воротом и висящим блоком
  const tp = grp(g, 1.8, 0, 2.2);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.3; beam(tp, [Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7], [0, 5.2, 0], 0.1, M(C.wood)); colC(g, 1.8 + Math.cos(a) * 1.7, 2.2 + Math.sin(a) * 1.7, 0.15); }
  P(tp, cyl(0.12, 0.12, 0.25, 8), M(C.woodD), 0, 5.0, 0, HPI);
  rope(tp, [0, 5.0, 0], [0, 2.1, 0], 0.02);
  for (const s of [-1, 1]) rope(tp, [0, 2.1, 0], [s * 0.5, 1.75, 0], 0.014);
  P(tp, rbox(1.3, 0.7, 0.8, 0.03), cut[1], 0, 1.4, 0);
  const wl = grp(tp, Math.cos(0.3) * 1.2, 0, Math.sin(0.3) * 1.2, 0, -0.3, 0);
  for (const s of [-1, 1]) P(wl, box(0.1, 0.9, 0.1), M(C.woodD), 0, 0.45, s * 0.5);
  P(wl, cyl(0.1, 0.1, 1.1, 8), M(C.woodL), 0, 0.8, 0, HPI); for (let k = 0; k < 2; k++) P(wl, box(0.04, 0.7, 0.04), M(C.woodD), 0, 0.8, 0.55, k * HPI);
  rope(g, [1.8 + Math.cos(0.3) * 1.2, 0.85, 2.2 + Math.sin(0.3) * 1.2], [1.8, 5.0, 2.2], 0.014);
  // блок на катках, штабель, сани, инструменты
  const rb = grp(g, -2.8, 0, 2.4, 0, 0.2, 0);
  for (let i = 0; i < 3; i++) P(rb, cyl(0.12, 0.12, 1.4, 8), M(C.wood), 0, 0.12, -0.7 + i * 0.7, 0, 0, HPI);
  P(rb, rbox(1.2, 0.9, 1.8, 0.03), M(C.marble), 0, 0.69, 0);
  colB(g, -2.8, 2.4, 1.3, 1.9, 0.2);
  stoneBlocks(g, 4.4, 0, 3.6, 6, 0.3); colB(g, 4.4, 3.6, 1.8, 1.0, 0.3);
  const sl = grp(g, -4.6, 0, 4.4, 0, -0.4, 0);
  for (const s of [-1, 1]) P(sl, box(0.14, 0.14, 2.2), M(C.woodD), s * 0.5, 0.07, 0);
  for (let i = 0; i < 4; i++) P(sl, box(1.2, 0.06, 0.18), M(C.wood), 0, 0.17, -0.8 + i * 0.55);
  P(sl, rbox(1.0, 0.6, 1.0, 0.03), cut[0], 0, 0.5, 0);
  colB(g, -4.6, 4.4, 1.3, 2.3, -0.4);
  const tb = grp(g, 0.0, 0, 4.6);
  P(tb, rbox(0.6, 0.5, 0.6, 0.04), cut[2], 0, 0.25, 0);
  tool(tb, 'hammer', 0.1, 0.5, 0, HPI, 0, 0.4); tool(tb, 'pick', -0.6, 0.05, 0.1, HPI, 1.2, 0); tool(tb, 'chisel', -0.1, 0.5, 0.12, HPI, 0, -0.5);
  for (let i = 0; i < 4; i++) P(tb, box(0.04, 0.12, 0.08), ironM(), 0.5 + i * 0.07, 0.06, 0.3);
};

// ---------- Солеварни (salinae, r 8): мелкие бассейны, кучи соли, сарай ----------
BUILD.salinae = (g) => {
  ground(g, 0, 0, 11.2, 11.2, 0xc8b898, 0.04);
  const pw = 2.5, wcols = [0x5a8a9a, 0x7aa0a8, 0x9ab8b8, 0xc8d4cc, 0xe0e4dc, 0xf2f2ec];
  let k = 0;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++, k++) {
    const x = -4.0 + i * (pw + 0.25), z = -2.4 + j * (pw + 0.25);
    basin(g, x, 0, z, pw, 0.22, pw, 0.14, M(0xa89070), M(wcols[k], { roughness: k > 3 ? 0.8 : 0.15 }));
    if (k > 2) for (let q = 0; q < 4 + k; q++) P(g, ico(0.12, 0), M(0xf4f2ec), x + Math.sin(q * 2.3) * 0.8, 0.1, z + Math.cos(q * 1.7) * 0.8, 0, q, 0, 1, 0.35, 1);
    if (k === 5) for (let q = 0; q < 3; q++) P(g, moundG(0.3, 0.3, 50 + q, 8), M(0xf6f4ee), x - 0.7 + q * 0.7, 0.2, z + 0.5);
  }
  // канал от моря (+Z) с заслонкой
  P(g, box(0.6, 0.04, 3.4), M(0x5a8a9a, { roughness: 0.15 }), -4.0, 0.06, 3.9);
  for (const s of [-1, 1]) P(g, box(0.15, 0.2, 3.4), M(0xa89070), -4.0 + s * 0.38, 0.1, 3.9);
  P(g, box(0.9, 0.5, 0.08), PLANK(), -4.0, 0.3, 2.6); for (const s of [-1, 1]) post(g, -4.0 + s * 0.48, 0, 2.6, 0.8, 0.05, M(C.woodD));
  // мостки между бассейнами
  P(g, tbox(0.5, 0.06, 5.4), PLANK(), -2.6, 0.26, -1.0); P(g, tbox(0.5, 0.06, 5.4), PLANK(), 0.15, 0.26, -1.0);
  // кучи соли под соломенными шапками и без
  for (const [x, z, r, s, cap] of [[4.0, -2.6, 0.95, 61, 1], [4.2, -0.2, 0.8, 62, 0], [3.6, 2.0, 0.9, 63, 1], [5.0, 1.0, 0.6, 64, 0]]) {
    P(g, moundG(r, r * 1.3, s, 10), M(0xf4f2ec), x, r * 0.62, z);
    if (cap) P(g, cone(r * 0.75, r * 0.6, 10), THATCH(), x, r * 1.25, z);
    colC(g, x, z, r * 0.9);
  }
  // сарай для грабель, корзины, мешки соли
  const sh = grp(g, 2.8, 0, -4.4);
  for (const [x, z] of [[-1.4, -0.8], [1.4, -0.8], [-1.4, 0.8], [1.4, 0.8]]) post(sh, x, 0, z, 2.3, 0.08);
  P(sh, tbox(3.0, 2.0, 0.1), PLANK(), 0, 1.0, -0.85);
  shed(sh, 0, 2.55, 0, 3.2, 1.9, 0.35, 0, THATCH());
  for (let i = 0; i < 4; i++) tool(sh, 'rake', -1.0 + i * 0.3, 0, -0.7, -0.15, 0, 0.05 * i);
  tool(sh, 'shovel', 0.6, 0.1, -0.7, -0.12, 0, 0);
  for (let i = 0; i < 3; i++) sack(sh, 0.4 + i * 0.45, 0, 0.2, 0.9, 0xece8dc, i);
  colB(g, 2.8, -4.4, 3.2, 1.9);
  for (let i = 0; i < 3; i++) basket(g, 5.0 - i * 0.6, 0, 3.6, 0.28, 0.3, 0xf4f2ec);
  tool(g, 'rake', 1.6, 0.05, 2.6, HPI, 0.6, 0);
};

// ---------- Серная копь (sulfur, r 7) ----------
BUILD.sulfur = (g) => {
  P(g, G('ecoSulCrust', () => lumpy(new THREE.CylinderGeometry(4.7, 4.9, 0.14, 22, 1), 0.06, 4)), FOL(0xcdb040), 0, 0.02, 0);
  const rr = rng(33);
  for (let i = 0; i < 14; i++) P(g, cyl(0.3 + rr() * 0.5, 0.4 + rr() * 0.5, 0.03, 7), FOL([0xe0cc40, 0xa89030, 0xe8e0b0, 0x8a7a40][i % 4]), (rr() - 0.5) * 8, 0.09, (rr() - 0.5) * 8);
  // разработанная яма с кристаллами по краям
  const pt = grp(g, -1.4, 0, -1.2);
  P(pt, cyl(1.5, 1.2, 0.04, 16), M(0x6a5a20), 0, 0.1, 0);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; P(pt, rockG(0.28, 70 + i, 0), FOL(i % 3 ? 0xb8a040 : 0x9a8a6a), Math.cos(a) * 1.6, 0.15, Math.sin(a) * 1.6, 0, i, 0, 1, 0.7, 1); }
  for (let i = 0; i < 16; i++) { const a = rr() * TAU, d = 0.6 + rr() * 0.9; P(pt, oct(0.06 + rr() * 0.06), M(0xf0dc30, { roughness: 0.5 }), Math.cos(a) * d, 0.14, Math.sin(a) * d, rr(), rr(), rr(), 1, 1.6, 1); }
  colC(g, -1.4, -1.2, 1.4);
  // фумаролы — серые бугры с жёлтой каймой
  for (const [x, z, s] of [[2.6, 2.8, 1], [-3.2, 2.4, 2], [3.6, -0.4, 3]]) { P(g, moundG(0.5, 0.35, 80 + s, 9), FOL(0x9a9488), x, 0.2, z); P(g, tor(0.32, 0.06, 4, 10), M(0xe8d030), x, 0.3, z, HPI); P(g, cyl(0.1, 0.1, 0.02, 8), M(0x2a261e), x, 0.38, z); }
  // печь для вытапливания серы и формы со слитками
  const kn = grp(g, 2.6, 0, -2.6);
  P(kn, G('ecoSulKiln', () => lumpy(new THREE.SphereGeometry(1.3, 12, 6, 0, TAU, 0, HPI), 0.06, 9)), FOL(0x9a8a74), 0, 0, 0);
  P(kn, box(0.6, 0.6, 0.08), M(0x1a0e08), 0, 0.3, 1.25); P(kn, box(0.45, 0.2, 0.06), EMB(), 0, 0.15, 1.28);
  for (let i = 0; i < 3; i++) P(kn, lathe('ecoSulPot', [[0, 0], [0.16, 0.02], [0.2, 0.18], [0.14, 0.32], [0, 0.32]], 10), M(0xa86a3a), -0.4 + i * 0.4, 1.05 + (i % 2) * 0.05, -0.1);
  P(kn, box(0.15, 0.06, 1.2), M(0x8a7a5a), 0.9, 0.25, 0.9, 0, 0.5, 0); P(kn, box(0.1, 0.02, 1.1), M(0xe8c820, { emissive: 0x4a3a00 }), 0.9, 0.29, 0.9, 0, 0.5, 0);
  const kl = new VLight(0xff9040, 3, 6, 1.6); kl.position.set(0, 0.4, 1.8); kn.add(kl);
  colC(g, 2.6, -2.6, 1.3);
  const mo = grp(g, 3.0, 0, 0.8, 0, -0.3, 0);
  P(mo, box(1.6, 0.16, 0.9), M(C.woodD), 0, 0.08, 0);
  for (let i = 0; i < 6; i++) P(mo, box(0.4, 0.14, 0.32), M(0xe8cc30, { roughness: 0.6 }), -0.55 + (i % 3) * 0.55, 0.22, (Math.floor(i / 3) - 0.5) * 0.42);
  for (let i = 0; i < 6; i++) P(g, box(0.4, 0.14, 0.32), M(0xd8bc30), 0.8 + (i % 2) * 0.44, 0.13 + Math.floor(i / 2) * 0.15, 2.4, 0, 0.1 * i, 0);
  colB(g, 3.0, 0.8, 1.6, 0.9, -0.3);
  // корзины с кусками серы, инструменты, навес
  for (const [x, z] of [[-0.2, 1.8], [0.4, 2.2], [-0.8, 2.4], [0.2, 2.8]]) basket(g, x, 0, z, 0.26, 0.32, 0xe0c830);
  tool(g, 'pick', -2.2, 0.1, 1.2, HPI, 0.8, 0); tool(g, 'shovel', -2.6, 0.1, 0.8, HPI, -0.4, 0);
  const sh = grp(g, -3.2, 0, -3.6);
  for (const [x, z] of [[-0.9, -0.7], [0.9, -0.7], [-0.9, 0.7], [0.9, 0.7]]) post(sh, x, 0, z, 2.1, 0.07);
  shed(sh, 0, 2.35, 0, 2.1, 1.7, 0.3, 0, THATCH());
  for (let i = 0; i < 3; i++) sack(sh, -0.5 + i * 0.5, 0, 0, 0.9, 0xd8c070, i);
  amphora(sh, 0.6, 0, -0.5, 0.9);
  colB(g, -3.2, -3.6, 2.1, 1.7);
};

// ---------- Пасека (alvearia, r 5) ----------
BUILD.alvearia = (g) => {
  ground(g, 0, 0, 7.0, 7.0, 0x8a9a4a, 0.03);
  // глиняные горизонтальные ульи-трубы на каменной скамье
  const st = grp(g, 0, 0, -2.4);
  P(st, box(4.4, 0.45, 0.9), M(C.stone), 0, 0.22, 0);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 6 - row; i++) {
    const x = -1.85 + i * 0.74 + row * 0.37, yy = 0.72 + row * 0.5;
    P(st, cyl(0.24, 0.24, 0.85, 10), M(row ? 0xb8643c : 0xa85a36), x, yy, 0, HPI);
    P(st, cyl(0.2, 0.2, 0.02, 10), M(0x8a4a2a), x, yy, 0.43, HPI);
    P(st, cyl(0.035, 0.035, 0.03, 6), M(0x1a100a), x, yy - 0.08, 0.44, HPI);
  }
  P(st, box(4.6, 0.08, 1.1), TILE(), 0, 1.58, 0, 0.08); for (const s of [-1, 1]) P(st, box(0.12, 1.2, 0.12), M(C.stone), s * 2.25, 1.0, -0.35);
  colB(g, 0, -2.4, 4.4, 0.9);
  // соломенные ульи-колпаки на дощатой скамье
  const sk = lathe('ecoSkep', [[0.0, 0], [0.32, 0], [0.33, 0.15], [0.3, 0.32], [0.22, 0.46], [0.1, 0.54], [0, 0.56]], 12);
  P(g, box(3.6, 0.06, 0.6), PLANK(), -0.2, 0.42, -0.3); for (const x of [-1.8, -0.2, 1.4]) P(g, box(0.08, 0.4, 0.5), M(C.woodD), x, 0.2, -0.3);
  for (let i = 0; i < 4; i++) { const x = -1.6 + i * 0.95; P(g, sk, THATCH(), x, 0.45, -0.3); for (let k = 1; k < 4; k++) P(g, tor(0.33 - k * 0.04, 0.02, 3, 12), M(0x9a7a40), x, 0.45 + k * 0.13, -0.3, HPI); P(g, box(0.1, 0.05, 0.03), M(0x1a100a), x, 0.5, 0.02); }
  colB(g, -0.2, -0.3, 3.6, 0.6);
  // пчёлы
  const rr = rng(5); for (let i = 0; i < 14; i++) P(g, sph(0.012, 4, 3), M(0x2a2010), (rr() - 0.5) * 4, 0.6 + rr() * 1.4, -2.0 + rr() * 2.0).castShadow = false;
  // стол с мёдом и сотами, дымарь
  const tb = grp(g, 1.8, 0, 2.0);
  table(tb, 0, 0, 0, 1.4, 0.7);
  for (let i = 0; i < 5; i++) P(tb, lathe('ecoHoney', [[0, 0], [0.06, 0], [0.09, 0.08], [0.08, 0.15], [0.05, 0.17], [0.055, 0.2], [0, 0.2]], 8), M(i % 2 ? 0xb8643c : 0xc87a4a), -0.5 + i * 0.22, 0.79, -0.15);
  P(tb, cyl(0.2, 0.18, 0.03, 12), M(0xb8643c), 0.35, 0.8, 0.15); P(tb, box(0.24, 0.05, 0.16), M(0xe0a020, { roughness: 0.4 }), 0.35, 0.83, 0.15);
  P(tb, box(0.3, 0.04, 0.2), M(0xd89a28, { roughness: 0.4 }), -0.25, 0.8, 0.15);
  colB(g, 1.8, 2.0, 1.4, 0.7);
  for (let i = 0; i < 4; i++) amphora(g, -2.8 + (i % 2) * 0.45, 0, 2.6 + Math.floor(i / 2) * 0.45, 0.7, 0xb8743c);
  P(g, lathe('ecoSmoker', [[0, 0], [0.1, 0], [0.12, 0.2], [0.06, 0.3], [0.03, 0.34], [0, 0.34]], 8), M(0x8a5a3a), 0.6, 0, 2.6);
  // плетень и цветущие травы
  fence(g, [[-3.4, -3.3], [-3.4, 3.3]], 0.9); fence(g, [[3.4, -3.3], [3.4, 0.8]], 0.9);
  for (const [x, z, k] of [[-2.6, 1.0, 'thyme'], [-1.6, 1.6, 'rosemary'], [2.6, -0.8, 'thyme'], [-0.4, 3.0, 'thyme'], [0.6, 1.2, 'cistus'], [2.8, 3.0, 'rosemary']]) { const p = makePlant(k); p.position.set(x, 0, z); g.add(p); }
};

// ---------- Лесоповал (silva_cut, r 7) ----------
function simplePine(par, x, z, h = 7, seed = 1) {
  const t = grp(par, x, 0, z, 0, seed, 0);
  P(t, cyl(0.14, 0.22, h * 0.6, 6), M(0x6a4e36), 0, h * 0.3, 0);
  P(t, blob(1.4, 1, seed, 0.5), FOL(0x3e5a2a), 0, h * 0.72, 0, 0, 0, 0, 1.2, 1, 1.2);
  P(t, blob(0.9, 0, seed + 1, 0.6), FOL(0x4a6a32), 0.3, h * 0.9, -0.2);
  return t;
}
BUILD.silva_cut = (g) => {
  ground(g, 0, 0, 9.8, 9.8, 0x8a7a52, 0.03);
  hut(g, -3.0, -3.0, 1.6, 0.6); colC(g, -3.0, -3.0, 1.7);
  // пни и стоящие деревья по краю
  const rr = rng(44);
  for (const [x, z] of [[1.0, -1.6], [-0.6, -3.6], [3.2, 0.2], [-3.8, 1.2], [0.8, 3.8], [-1.6, 4.2], [4.2, 3.8]]) {
    const r = 0.22 + rr() * 0.15;
    P(g, cyl(r, r * 1.2, 0.45, 8), M(0x6a4a2a), x, 0.22, z); P(g, cyl(r * 0.92, r * 0.92, 0.02, 8), M(0xd0aa76), x, 0.455, z);
    colC(g, x, z, r);
  }
  for (const [x, z, s] of [[-4.4, 4.2, 3], [4.4, -4.2, 5], [-4.6, -0.6, 7]]) { simplePine(g, x, z, 7 + s * 0.2, s); colC(g, x, z, 0.25); }
  // поленницы и брёвна
  logPile(g, 2.6, 0, -3.6, 10, 3.6, 0.1); colB(g, 2.6, -3.6, 1.4, 3.7, 0.1);
  logPile(g, 3.2, 0, 2.4, 6, 3.0, HPI + 0.2); colB(g, 3.2, 2.4, 3.1, 1.1, 0.2);
  // пильная яма с бревном на перекладинах и продольной пилой
  const sp = grp(g, -1.0, 0, 1.2, 0, 0.3, 0);
  P(sp, box(1.1, 0.05, 3.2), M(0x2a1e14), 0, 0.01, 0);
  for (const s of [-1, 1]) { P(sp, box(0.18, 0.18, 3.4), M(C.woodD), s * 0.65, 0.09, 0); P(sp, box(1.6, 0.18, 0.18), M(C.woodD), 0, 0.27, s * 1.1); }
  P(sp, cyl(0.26, 0.28, 3.6, 10), M(0x7a5534), 0, 0.62, 0, HPI);
  for (const s of [-1, 1]) P(sp, cyl(0.24, 0.24, 0.02, 10), M(0xd0aa76), 0, 0.62, s * 1.8, HPI);
  const saw = grp(sp, 0, 0.62, 0.4); P(saw, box(0.02, 2.0, 0.18), MET(0xa0a6ac, 0.4, 0.8), 0, 0, 0); for (const s of [-1, 1]) P(saw, cyl(0.025, 0.025, 0.5, 5), M(C.woodL), 0, s * 1.0, 0, 0, 0, HPI);
  colB(g, -1.0, 1.2, 1.7, 3.6, 0.3);
  // колода с топором, щепа, волокуша
  const cb = grp(g, 0.8, 0, -0.2); P(cb, cyl(0.35, 0.4, 0.6, 10), M(0x6a4a2a), 0, 0.3, 0); P(cb, cyl(0.33, 0.33, 0.02, 10), M(0xc8a070), 0, 0.61, 0);
  const ax = grp(cb, 0.05, 0.62, 0, 0.3, 0, 2.6); P(ax, cyl(0.016, 0.02, 0.75, 6), M(C.woodL), 0, 0.3, 0); P(ax, box(0.03, 0.14, 0.16), ironM(), 0, 0.02, 0.05);
  colC(g, 0.8, -0.2, 0.4);
  for (let i = 0; i < 18; i++) P(g, box(0.1, 0.02, 0.05), M(0xd8b880), 0.8 + (rr() - 0.5) * 1.6, 0.04, -0.2 + (rr() - 0.5) * 1.6, 0, rr() * 3, 0);
  for (let i = 0; i < 5; i++) P(g, cyl(0.12, 0.13, 0.4, 7), M(0xb88a5a), -2.2 + (i % 3) * 0.3, 0.2, -0.8 + Math.floor(i / 3) * 0.3);
  const sl = grp(g, -3.6, 0, 3.2, 0, 0.8, 0);
  for (const s of [-1, 1]) P(sl, box(0.12, 0.12, 2.0), M(C.woodD), s * 0.4, 0.06, 0, 0, 0, 0);
  P(sl, cyl(0.2, 0.22, 2.4, 8), M(0x7a5534), 0, 0.3, 0, HPI);
  rope(sl, [0, 0.12, 1.0], [0, 0.1, 2.0], 0.02);
  campfire(g, -1.6, -1.6, 5, 9); colC(g, -1.6, -1.6, 0.6);
  bench(g, -2.6, 0, -1.2, 1.2, 0.6);
};

// ---------- Мусейон: исследовательский кампус и библиотека (campus, r 12) ----------
function armillary(par, x, y, z, s = 1) {
  const g = grp(par, x, y, z); g.scale.setScalar(s);
  const br = bronzeM();
  P(g, cyl(0.04, 0.06, 0.5, 8), br, 0, 0.25, 0);
  const sp = grp(g, 0, 1.05, 0, 0, 0, 0.65);   // ось мира наклонена на широту Сицилии (~37°)
  P(sp, tor(0.55, 0.018, 4, 28), br, 0, 0, 0);                       // меридиан
  P(sp, tor(0.52, 0.016, 4, 28), br, 0, 0, 0, HPI);                  // экватор
  P(sp, tor(0.52, 0.03, 4, 28), M(0xc8a050, { metalness: 0.7, roughness: 0.35 }), 0, 0, 0, HPI + 0.41); // эклиптика (зодиак)
  P(sp, tor(0.5, 0.012, 4, 24), br, 0, 0, 0, 0, HPI, 0);             // колюр
  P(sp, cyl(0.01, 0.01, 1.3, 4), br, 0, 0, 0);
  P(sp, sph(0.09, 10, 8), M(0x4a7a9a), 0, 0, 0);
  P(g, tor(0.6, 0.025, 4, 28), br, 0, 1.05, 0, HPI);                 // горизонт
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + PI / 4; beam(g, [Math.cos(a) * 0.6, 1.05, Math.sin(a) * 0.6], [Math.cos(a) * 0.15, 0.45, Math.sin(a) * 0.15], 0.015, br, 4); }
  return g;
}
function cage(par, x, z, w, h, d, kind) {
  const g = grp(par, x, 0, z), wd = M(C.woodD), bar = M(C.woodL);
  P(g, box(w, 0.08, d), PLANK(), 0, 0.6, 0); P(g, box(w + 0.06, 0.06, d + 0.06), wd, 0, 0.6 + h, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(g, box(0.06, h + 0.6, 0.06), wd, sx * w / 2, (h + 0.6) / 2, sz * d / 2);
  const n = Math.round(w / 0.12);
  for (let i = 1; i < n; i++) for (const sz of [-1, 1]) P(g, box(0.015, h, 0.015), bar, -w / 2 + (i * w) / n, 0.6 + h / 2, sz * d / 2);
  for (let i = 1; i < 4; i++) for (const sx of [-1, 1]) P(g, box(0.015, h, 0.015), bar, sx * w / 2, 0.6 + h / 2, -d / 2 + (i * d) / 4);
  if (kind) { const c = makeCritter(kind); c.position.set(0, 0.64, 0); c.rotation.y = 0.5; g.add(c); g.userData.critter = c; }
  return g;
}
BUILD.campus = (g) => {
  const y = 0.3;
  plinth(g, 0, 0, 16.6, 16.6, y, TM('ashlar', 0xe8dfca));
  // библиотечный зал: открытая колоннада спереди, стеллажи со свитками
  wall(g, 0, y, -8.0, 14.4, 5.4, 0.5, 0, { mat: TM('ashlar', 0xf0e8d6), dado: false });
  for (const s of [-1, 1]) wall(g, s * 6.95, y, -5.85, 0.5, 5.4, 4.4, 0, { mat: TM('ashlar', 0xf0e8d6), dado: false });
  P(g, box(14.4, 0.06, 4.4), M(0xc8b898), 0, y + 0.03, -5.85);
  colRow(g, -6.0, -3.6, 6.0, -3.6, 6, y, 5.0, 0.22, 'ionic');
  P(g, box(14.6, 0.5, 0.7), M(C.marble), 0, y + 5.25, -3.6);
  gable(g, 0, y + 5.5, -5.8, 14.6, 5.2, 0.3, 0.3, 'z');
  P(g, extr('ecoCampPed', [[-7.3, 0], [7.3, 0], [0, 2.3]], 0.2, 0), M(C.marble), 0, y + 5.5, -3.25);
  colB(g, 0, -8.0, 14.6, 0.6); for (const s of [-1, 1]) colB(g, s * 6.95, -5.85, 0.6, 4.6);
  const scrollM = [M(0xe8dcb4), M(0xd8c8a0), M(0xc8b088)], tag = M(0x9a2a22);
  for (const x of [-5.0, -2.4, 2.4, 5.0]) {
    const ar = grp(g, x, y, -7.45);
    P(ar, box(2.2, 2.7, 0.05), M(0x3a2414), 0, 1.35, -0.27);
    for (const sx of [-1, 1]) P(ar, box(0.06, 2.7, 0.56), M(0x6a4626), sx * 1.08, 1.35, 0.0);
    for (let r = 0; r < 4; r++) { P(ar, box(2.1, 0.05, 0.5), M(0x8a6040), 0, 0.25 + r * 0.6, 0.02); }
    for (let c = 1; c < 4; c++) P(ar, box(0.04, 2.4, 0.5), M(0x8a6040), -1.0 + c * 0.5, 1.4, 0.02);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 3; k++) {
      const sx = -0.75 + c * 0.5 + (k - 1) * 0.12, sy = 0.33 + r * 0.6 + (k === 1 ? 0.09 : 0);
      P(ar, cyl(0.045, 0.045, 0.42, 5), scrollM[(r + c + k) % 3], sx, sy, 0.05, HPI);
      if (k === 1) P(ar, box(0.04, 0.06, 0.01), tag, sx, sy - 0.03, 0.27);
    }
    P(ar, box(2.3, 0.15, 0.62), M(0x5a3a20), 0, 2.76, 0);
  }
  colB(g, 0, -7.45, 12.4, 0.6);
  statue(g, 0, y, -7.2, 0.62, M(0xf2eee4));
  const rt = grp(g, 0, y, -5.4);
  table(rt, 0, 0, 0, 3.0, 1.0);
  for (const s of [-1, 1]) bench(rt, 0, 0, s * 0.85, 2.6);
  for (let i = 0; i < 3; i++) { const sc = grp(rt, -0.9 + i * 0.9, 0.8, 0); P(sc, box(0.5, 0.005, 0.28), M(0xece0bc), 0, 0, 0); for (const s of [-1, 1]) P(sc, cyl(0.03, 0.03, 0.3, 6), M(0xd8c8a0), s * 0.27, 0.025, 0, HPI); }
  P(rt, lathe('ecoInk', [[0, 0], [0.04, 0], [0.04, 0.05], [0.015, 0.06], [0, 0.06]], 8), M(0x2a2420), 1.3, 0.79, 0.2);
  colB(g, 0, -5.4, 3.0, 2.0);
  // боковые стои: клетки с живыми образцами (запад) и гербарий (восток)
  for (const s of [-1, 1]) {
    wall(g, s * 8.0, y, 2.1, 0.4, 3.6, 10.6, 0, { col: 0xebe0c8, dadoCol: 0x6a5a3a });
    colB(g, s * 8.0, 2.1, 0.5, 10.6);
    colRow(g, s * 6.4, -2.4, s * 6.4, 6.4, 5, y, 3.2, 0.16, 'tuscan');
    shed(g, s * 7.2, y + 3.65, 2.0, 10.6, 1.8, 0.45, s < 0 ? HPI : -HPI, TILE());
  }
  cage(g, -7.2, -1.6, 1.0, 0.7, 0.8, 'partridge'); cage(g, -7.2, 0.6, 1.2, 0.8, 0.8, 'hare');
  cage(g, -7.2, 2.8, 0.8, 0.6, 0.7, 'tortoise'); cage(g, -7.2, 4.8, 0.8, 1.0, 0.7, 'chameleon');
  for (const z of [-1.6, 0.6, 2.8, 4.8]) colB(g, -7.2, z, 1.2, 0.9);
  const hb = grp(g, 7.2, y, 1.4);
  table(hb, 0, 0, 0, 0.9, 4.6, 0);
  const rr = rng(12);
  for (let i = 0; i < 6; i++) {
    const sh = grp(hb, 0, 0.8, -1.9 + i * 0.75, 0, rr() * 0.3 - 0.15, 0);
    P(sh, box(0.55, 0.008, 0.42), M(0xe8dcb4), 0, 0, 0);
    for (let k = 0; k < 4; k++) P(sh, G('ecoPressLeaf', () => new THREE.CircleGeometry(0.05, 5)), M([0x5a7a2a, 0x7a8a3a, 0x9a5a7a, 0x6a8a4a][(i + k) % 4], DS), (k - 1.5) * 0.11, 0.006, (k % 2) * 0.1 - 0.05, -HPI, 0, 0, 1, 2.2, 1);
  }
  for (const [z, k] of [[-2.0, 'saffron'], [2.6, 'sea_lavender']]) { const pt = grp(hb, 0.1, 0.8, z); P(pt, lathe('ecoPot', [[0, 0], [0.13, 0], [0.18, 0.22], [0.15, 0.3], [0, 0.3]], 10), M(C.terracotta)); const p = makePlant(k); p.position.y = 0.28; p.scale.setScalar(0.7); pt.add(p); }
  P(hb, cyl(0.02, 0.02, 4.4, 5), M(C.woodD), 0.3, 2.4, 0, HPI);
  for (let i = 0; i < 7; i++) { rope(hb, [0.3, 2.4, -2 + i * 0.66], [0.3, 2.05, -2 + i * 0.66], 0.006); P(hb, cone(0.08, 0.35, 5), FOL([0x6a7a3a, 0x8a8a4a, 0x7a6a5a][i % 3]), 0.3, 1.88, -2 + i * 0.66, PI); }
  colB(g, 7.2, 1.4, 1.0, 4.7);
  // двор: армиллярная сфера, солнечные часы, сад
  const pd = grp(g, 0, y, 1.6);
  P(pd, rbox(0.9, 1.0, 0.9, 0.04), M(C.marble), 0, 0.5, 0); P(pd, box(1.1, 0.1, 1.1), M(C.stone), 0, 1.05, 0);
  armillary(pd, 0, 1.1, 0, 1.0);
  colC(g, 0, 1.6, 0.65);
  const sd = grp(g, -3.0, y, 4.6);
  P(sd, rbox(0.7, 0.9, 0.6, 0.03), M(C.marble), 0, 0.45, 0);
  P(sd, G('ecoSundial', () => new THREE.SphereGeometry(0.3, 10, 5, 0, PI, 0, HPI)), M(0xe0d8c8, DS), 0, 0.92, 0, -HPI, 0, 0);
  P(sd, box(0.02, 0.02, 0.32), bronzeM(), 0, 0.92, 0);
  colC(g, -3.0, 4.6, 0.45);
  for (const [x, z, k] of [[-3.6, -1.0, 'myrtle'], [3.6, -1.0, 'oleander'], [3.2, 4.6, 'strawberry_tree'], [-1.4, 5.8, 'rosemary'], [1.4, 5.8, 'caper']]) {
    P(g, cyl(0.6, 0.6, 0.12, 12), M(0x6a5034), x, y + 0.03, z);
    const p = makePlant(k); p.position.set(x, y + 0.05, z); p.scale.setScalar(k === 'strawberry_tree' ? 0.55 : 0.8); g.add(p);
  }
  for (const s of [-1, 1]) bench(g, s * 2.0, y, -1.6, 1.6);
  // передняя ограда с пропилеем
  for (const s of [-1, 1]) { wall(g, s * 4.9, y, 7.9, 6.2, 3.0, 0.4, 0, { col: 0xebe0c8, dadoCol: 0x6a5a3a }); colB(g, s * 4.9, 7.9, 6.2, 0.5); }
  colRow(g, -1.4, 7.9, 1.4, 7.9, 2, y, 3.8, 0.2, 'ionic');
  P(g, box(3.6, 0.4, 0.6), M(C.marble), 0, y + 4.0, 7.9);
  P(g, extr('ecoPropPed', [[-1.9, 0], [1.9, 0], [0, 0.7]], 0.4, 0), M(C.marble), 0, y + 4.2, 7.9);
  P(g, box(2.0, 0.24, 0.05), M(0xf0e8d8), 0, y + 3.85, 8.21);
};

// ---------- Преторий: штаб и казармы личной дружины (praetorium, r 10) ----------
BUILD.praetorium = (g) => {
  ground(g, 0, 0, 13.8, 13.8, 0xa8946c, 0.04);
  ground(g, 0, -1.4, 13.6, 1.6, 0xc8b890, 0.06); ground(g, 0, 2.8, 1.6, 8.2, 0xc8b890, 0.06);
  // принципия из камня
  const y = 0.4;
  plinth(g, 0, -4.7, 9.4, 4.4, y);
  wall(g, 0, y, -5.1, 8.6, 4.0, 3.2, 0, { mat: TM('ashlar', 0xe8e0cc), dado: false });
  gable(g, 0, y + 4.0, -5.1, 8.6, 3.2, 0.4, 0.4, 'x');
  colRow(g, -3.6, -2.95, 3.6, -2.95, 4, y, 3.4, 0.17, 'tuscan');
  P(g, box(8.0, 0.3, 0.4), M(C.stone), 0, y + 3.5, -2.95);
  shed(g, 0, y + 4.0, -3.2, 8.4, 1.0, 0.3, 0, TILE());
  door(g, 0, y, -3.48, 0, 1.5, 2.6, true);
  for (const s of [-1, 1]) win(g, s * 2.6, y + 2.6, -3.48, 0, 0.5, 0.6);
  P(g, box(2.4, 0.4, 0.05), M(0xf0e8d8), 0, y + 3.05, -3.47);
  stairs(g, 0, y, -2.6, 3.0, 2, 0.2, 0.4);
  colB(g, 0, -5.1, 8.8, 3.4);
  // знамёна и орёл легиона
  for (const s of [-1, 1]) banner(g, s * 1.6, 0, -1.9, 3.6);
  const st = grp(g, 0, 0, -1.9);
  P(st, cyl(0.04, 0.04, 3.4, 6), M(C.woodD), 0, 1.7, 0); P(st, box(0.5, 0.05, 0.05), goldM(), 0, 3.3, 0);
  const eg = grp(st, 0, 3.55, 0); P(eg, sph(0.1, 8, 6), goldM(), 0, 0, 0, 0, 0, 0, 0.8, 1, 1.3);
  for (const s of [-1, 1]) P(eg, extr('ecoEagleW', [[0, 0], [0.32, 0.18], [0.3, 0.05], [0.12, -0.08]], 0.02, 0), goldM(), s * 0.05, 0.02, 0, 0, s > 0 ? 0 : PI, 0);
  P(eg, sph(0.05, 6, 5), goldM(), 0, 0.1, 0.1);
  // ряды палаток контуберниев
  for (const x of [-5.3, -2.8]) for (const z of [0.5, 4.3]) { tent(g, x, z, 0, x < -4 ? 0xc8b08a : 0xb8a07a, 0.95); colB(g, x, z, 2.4, 2.6); }
  for (const z of [2.2, 5.9]) { scutum(g, -1.5, 0, z, -0.25, -HPI); scutum(g, -1.5, 0, z + 0.5, -0.25, -HPI, 0xb8302a); }
  // учебная площадка: столбы-палы, стойки с оружием, костёр
  for (let i = 0; i < 3; i++) { palus(g, 2.6 + i * 1.5, 0, 5.8, 1.85, 30 + i); colC(g, 2.6 + i * 1.5, 5.8, 0.2); }
  weaponRack(g, 6.0, 0, 1.8, -HPI, 2.0, ['gladius', 'hasta', 'pilum', 'gladius', 'hasta', 'pilum']); colB(g, 6.0, 1.8, 0.4, 2.1);
  weaponRack(g, 3.4, 0, 0.2, 0, 2.0, ['rudis', 'rudis', 'hasta', 'rudis', 'rudis']); colB(g, 3.4, 0.2, 2.1, 0.4);
  for (let i = 0; i < 3; i++) scutum(g, 5.6, 0, 3.2 + i * 0.7, -0.2, -HPI, i % 2 ? 0xb8302a : 0x9a2a22);
  campfire(g, 3.4, 3.2, 8, 14); colC(g, 3.4, 3.2, 0.6);
  for (let i = 0; i < 2; i++) bench(g, 3.4, 0, 2.1 + i * 2.2, 1.4);
  for (let i = 0; i < 3; i++) amphora(g, 5.8 + (i % 2) * 0.4, 0, -1.0 + i * 0.35, 0.9);
  crate(g, -5.8, 0, -2.0, 1); crate(g, -5.0, 0, -2.2, 0.9, 0.3); sack(g, -4.4, 0, -1.9, 1);
  // частокол с воротами на +Z
  fence(g, [[-1.8, 6.9], [-6.9, 6.9], [-6.9, -6.9], [6.9, -6.9], [6.9, 6.9], [1.8, 6.9]], 1.4);
  for (const s of [-1, 1]) post(g, s * 1.8, -0.5, 6.9, 3.4, 0.14, M(C.woodD));
  P(g, box(3.9, 0.22, 0.22), M(C.woodD), 0, 2.8, 6.9);
};

// ---------- Малый частный склад (horreum_s, r 6) ----------
BUILD.horreum_s = (g) => {
  plinth(g, 0, -0.6, 7.8, 6.6, 0.7);
  for (let i = 0; i < 5; i++) P(g, box(0.3, 0.18, 0.04), M(0x1a140e), -3.0 + i * 1.5, 0.35, 2.71);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) P(g, box(0.04, 0.18, 0.3), M(0x1a140e), s * 3.91, 0.35, -3.2 + i * 1.6);
  wall(g, 0, 0.7, -0.7, 7.2, 3.4, 5.6, 0, { mat: TM('ashlar', 0xe4d8bc), dado: false });
  for (const s of [-1, 1]) for (const z of [-2.8, -0.7, 1.4]) P(g, tbox(0.4, 3.2, 0.6), ASH(), s * 3.75, 0.7 + 1.6, z);
  for (const x of [-2.2, 0, 2.2]) P(g, tbox(0.6, 3.2, 0.4), ASH(), x, 0.7 + 1.6, -3.65);
  gable(g, 0, 4.1, -0.7, 7.4, 5.6, 0.36, 0.45, 'x');
  door(g, 0, 0.7, 2.12, 0, 1.8, 2.5, true);
  for (const s of [-1, 1]) { P(g, box(0.18, 0.8, 0.04), M(0x1a140e), s * 2.4, 3.3, 2.12); for (const z of [-1.8, 0.4]) P(g, box(0.04, 0.8, 0.18), M(0x1a140e), s * 3.61, 3.3, z); }
  P(g, box(2.6, 0.4, 0.06), M(0xe8dcc0), 0, 3.65, 2.13);
  P(g, extr('ecoRamp', [[0, 0], [1.5, 0], [0, 0.7]], 2.2, 0), ASH(), 0, 0, 2.7, 0, -HPI, 0);
  colB(g, 0, -0.7, 8.0, 6.0);
  // товар: торговые ящики, мешки, амфоры, ручная тележка
  for (const [x, z, gr, yy] of [[-2.6, 3.4, 1, 0], [-1.8, 3.4, 2, 0], [-2.2, 3.4, 3, 0.6], [2.6, 3.2, 2, 0], [2.6, 3.9, 1, 0]]) tcrate(g, gr, x, yy, z, 1, 0.1 * x);
  colB(g, -2.2, 3.4, 1.8, 0.8); colB(g, 2.6, 3.55, 1.0, 1.4);
  for (let i = 0; i < 3; i++) sack(g, 3.6, 0, 1.6 - i * 0.5, 1, 0xd2be92, i);
  for (let i = 0; i < 3; i++) amphora(g, -3.7, 0, 1.8 - i * 0.45, 0.9, 0xa8784a);
  const hc = grp(g, 1.4, 0, 3.8, 0, -0.5, 0);
  P(hc, box(0.7, 0.08, 1.0), PLANK(), 0, 0.45, 0); for (const s of [-1, 1]) { P(hc, box(0.05, 0.05, 1.4), M(C.woodD), s * 0.3, 0.45, 0.5, 0.3); P(hc, box(0.05, 0.4, 0.05), M(C.woodD), s * 0.3, 0.22, -0.4); }
  P(hc, cyl(0.25, 0.25, 0.06, 12), M(C.woodD), 0, 0.25, -0.55, 0, 0, HPI);
};

// ======================================================================
// Рыбацкий баркас (barca) и снасти
// ======================================================================
// Структура как у SHIPDEF.scapha — makeShip('barca') строит корпус, банки, 2 пары вёсел и рулевые вёсла.
// Тунцовую стойку и корзину для сети добавляет addBarcaGear(ship) (или сразу makeBarca()).
SHIPDEF.barca = { L: 9, Bm: 2.3, D: 0.7, deckY: 0.2, bul: 0.5, riseB: 0.35, riseS: 0.45, pb: 1.9, ps: 1.9, hull: 0x7a5034, open: true, banks: [[2, 0]], oarY0: -0.3, seats: 2 };
export function addBarcaGear(ship) {
  const rock = ship.userData.rock || ship, fy = -0.12;
  const gear = grp(rock, 0, 0, 0); gear.name = 'barcaGear';
  // стойка для тяжёлой тунцовой удочки на корме
  const mt = grp(gear, 0.35, fy, -3.55);
  P(mt, box(0.22, 0.85, 0.22), M(C.woodD), 0, 0.42, 0);
  P(mt, cyl(0.07, 0.07, 0.35, 10, true), MET(C.bronze, 0.4, 0.8), 0, 0.95, 0, -0.75);
  for (const s of [-1, 1]) P(mt, box(0.05, 0.3, 0.05), MET(C.bronze, 0.4, 0.8), s * 0.09, 0.85, 0.05);
  const rod = makeBigRod(); rod.position.set(0, 0.85, 0.05); rod.rotation.set(-0.75, 0, 0); mt.add(rod);
  gear.userData.bigRod = rod;
  // большая корзина с сетью и поплавками
  const nb = grp(gear, 0, fy, 1.3);
  P(nb, cyl(0.5, 0.42, 0.55, 12, true), M(0xa8864c, DS), 0, 0.27, 0);
  P(nb, tor(0.5, 0.03, 4, 14), M(0x8a6a3a), 0, 0.55, 0, HPI);
  P(nb, G('ecoNetHeap', () => lumpy(new THREE.SphereGeometry(0.48, 10, 5, 0, TAU, 0, HPI), 0.18, 8)), TM('net', 0xd8ccb0), 0, 0.42, 0, 0, 0, 0, 1, 0.6, 1);
  for (let i = 0; i < 5; i++) P(nb, cyl(0.06, 0.06, 0.08, 7), M(0xc8a060), Math.cos(i * 1.3) * 0.32, 0.6, Math.sin(i * 1.3) * 0.32, 0.4, 0, 0.3);
  // ведро с наживкой, бухта каната, багор
  P(gear, cyl(0.17, 0.14, 0.3, 10), M(C.wood), -0.45, fy + 0.15, -2.2); P(gear, cyl(0.15, 0.15, 0.02, 10), M(0x6a7a80, { roughness: 0.2 }), -0.45, fy + 0.27, -2.2);
  P(gear, tor(0.22, 0.05, 4, 12), M(C.rope), 0.45, fy + 0.05, 2.4, HPI);
  const gf = grp(gear, -0.55, fy + 0.25, 0.2, 0, 0, 0); P(gf, cyl(0.025, 0.025, 2.4, 5), M(C.woodL), 0, 0, 0, HPI); P(gf, tor(0.06, 0.012, 4, 8, PI * 1.3), ironM(), 0, 0.04, 1.22, 0, HPI, 0);
  return gear;
}
export function makeBarca() { const s = makeShip('barca'); addBarcaGear(s); return s; }

// ---------- Удочки: rod по оси +Y, рука на y = 0, леска — userData.line (как у оружия 'rod') ----------
function rodLine(g, tipY, floatCol, hookM, bigHook = false) {
  const line = grp(g, 0, tipY, 0); line.userData.hang = true;
  P(line, cyl(bigHook ? 0.004 : 0.002, bigHook ? 0.004 : 0.002, 1.1, 3), M(0xf0f0e8), 0, -0.55, 0).castShadow = false;
  P(line, sph(bigHook ? 0.045 : 0.022, 6, 4), M(floatCol), 0, -0.55, 0, 0, 0, 0, 1, bigHook ? 1.6 : 1, 1);
  P(line, tor(bigHook ? 0.035 : 0.012, bigHook ? 0.006 : 0.0025, 3, 8, PI * 1.4), hookM, 0, -1.1, 0);
  g.userData.line = line; g.userData.tip = new THREE.Vector3(0, tipY, 0);
  return line;
}
export function makeRod(tier = 0) {
  tier = clamp(tier | 0, 0, 3);
  const g = new THREE.Group(); g.name = 'rod_' + tier;
  const L = [2.65, 2.8, 3.0, 3.15][tier], y0 = -0.3, tipY = y0 + L;
  const shaftC = [0xc8b070, 0xd2b878, 0x9a5a34, 0x4a2a1a][tier];
  const sm = M(shaftC), fit = tier >= 3 ? MET(0xdcdfe4, 0.22, 0.95) : bronzeM();
  if (tier === 0 || tier === 1) {
    // тростник: 4 колена с узлами
    const n = 4;
    for (let i = 0; i < n; i++) {
      const a = y0 + (i * L) / n, b = y0 + ((i + 1) * L) / n, r0 = 0.02 - i * 0.0035, r1 = 0.02 - (i + 1) * 0.0035;
      P(g, cyl(Math.max(0.005, r1), r0, b - a, 6), sm, 0, (a + b) / 2, 0);
      if (i) P(g, cyl(r0 + 0.003, r0 + 0.003, 0.025, 6), M(0xa08850), 0, a, 0);
    }
  } else {
    P(g, cyl(0.007, 0.021, L, 7), sm, 0, y0 + L / 2, 0);
  }
  // рукоять
  P(g, cyl(0.026, 0.026, 0.42, 8), M(tier === 0 ? C.rope : tier === 3 ? 0x2a1a12 : C.leather), 0, -0.02, 0);
  if (tier === 0) for (let i = 0; i < 5; i++) P(g, tor(0.026, 0.004, 3, 8), M(0x8a7048), 0, -0.18 + i * 0.08, 0, HPI);
  // кольца-проводники
  if (tier >= 1) for (let i = 1; i <= 5; i++) {
    const yy = y0 + (i / 6) * L + 0.3, rr = 0.02 - (i / 6) * 0.013;
    P(g, box(0.004, 0.004, 0.03), fit, 0, yy, rr + 0.012);
    P(g, tor(0.012 - i * 0.0012, 0.002, 3, 8), fit, 0, yy, rr + 0.028, HPI);
  }
  // катушка-шпуля с намотанной леской
  if (tier >= 2) {
    const sp = grp(g, 0, 0.32, 0.055);
    P(sp, cyl(0.035, 0.035, 0.04, 10), M(0xe8e0cc), 0, 0, 0, 0, 0, HPI);
    for (const s of [-1, 1]) P(sp, cyl(0.055, 0.055, 0.006, 12), fit, s * 0.024, 0, 0, 0, 0, HPI);
    P(sp, box(0.01, 0.01, 0.05), fit, 0, 0, -0.03);
    P(sp, cyl(0.006, 0.006, 0.05, 5), fit, 0.05, 0.03, 0, 0, 0, HPI); P(sp, sph(0.011, 6, 4), M(0x2a1a12), 0.078, 0.03, 0);
  }
  // окантовка, торцевой колпак, украшения
  if (tier >= 2) { P(g, cyl(0.028, 0.028, 0.03, 8), fit, 0, 0.2, 0); P(g, cyl(0.029, 0.026, 0.05, 8), fit, 0, y0 + 0.03, 0); }
  if (tier === 3) {
    for (let i = 0; i < 3; i++) P(g, cyl(0.022 - i * 0.003, 0.022 - i * 0.003, 0.02, 8), fit, 0, 0.6 + i * 0.7, 0);
    P(g, sph(0.032, 10, 6), fit, 0, y0 - 0.01, 0);
    P(g, tor(0.03, 0.005, 4, 10), goldM(), 0, -0.24, 0, HPI);
    P(g, oct(0.012), M(0x2a8a6a, { roughness: 0.2, metalness: 0.3 }), 0, y0 - 0.01, 0.03);
  }
  rodLine(g, tipY, [0xd8c8a0, 0xd8c8a0, 0xc83a2a, 0xe8d050][tier], tier >= 2 ? fit : ironM());
  g.userData.tier = tier; g.userData.len = L;
  return g;
}
// тяжёлая тунцовая удочка: толстое древко, барабан с толстой леской, упор под стойку
export function makeBigRod() {
  const g = new THREE.Group(); g.name = 'rod_big';
  const L = 2.6, y0 = -0.45, tipY = y0 + L, wd = M(0x6a4024), br = bronzeM();
  P(g, cyl(0.016, 0.042, L, 8), wd, 0, y0 + L / 2, 0);
  P(g, cyl(0.05, 0.05, 0.5, 8), M(C.leatherD), 0, -0.05, 0);
  P(g, cyl(0.048, 0.04, 0.12, 8), br, 0, y0 + 0.06, 0);
  P(g, box(0.1, 0.02, 0.02), br, 0, y0 + 0.01, 0);
  for (let i = 1; i <= 4; i++) { const yy = y0 + 0.5 + i * 0.45; P(g, box(0.006, 0.006, 0.05), br, 0, yy, 0.04); P(g, tor(0.02, 0.004, 3, 8), br, 0, yy, 0.068, HPI); }
  const sp = grp(g, 0, 0.35, 0.1);
  P(sp, cyl(0.075, 0.075, 0.1, 12), M(0xd8ccb0), 0, 0, 0, 0, 0, HPI);
  for (const s of [-1, 1]) { P(sp, cyl(0.11, 0.11, 0.012, 14), br, s * 0.056, 0, 0, 0, 0, HPI); P(sp, box(0.012, 0.03, 0.1), br, s * 0.056, 0, -0.06); }
  for (let i = 0; i < 3; i++) P(sp, tor(0.078, 0.006, 3, 12), M(0xc8bc9a), -0.03 + i * 0.03, 0, 0, 0, HPI, 0);
  P(sp, cyl(0.008, 0.008, 0.12, 5), br, 0.11, 0.06, 0, 0, 0, HPI); P(sp, cyl(0.016, 0.016, 0.07, 6), M(0x2a1a12), 0.17, 0.06, 0);
  rope(g, [0, 0.35, 0.17], [0, tipY - 0.05, 0.03], 0.004, M(0xe8e0cc));
  rodLine(g, tipY, 0xc8302a, ironM(), true);
  g.userData.tier = 4; g.userData.len = L; g.userData.big = true;
  return g;
}

// ======================================================================
// Фауна островов (для исследований): makeCritter(kind) → Group, userData.anim(dt, t, moving)
// Размеры в метрах, +Z — вперёд. Птицы: userData.flies; userData.mode = 'fly' | 'walk' — принудительный режим.
// ======================================================================
function eyePair(par, x, y, z, r, white = true) {
  for (const s of [-1, 1]) { P(par, sph(r, 6, 4), M(0x14100c), s * x, y, z); if (white) P(par, sph(r * 0.35, 4, 3), M(0xffffff), s * (x + r * 0.2), y + r * 0.4, z + r * 0.55); }
}
const approach = (v, tgt, k) => v + (tgt - v) * k;
// бугорки-иглы по верхней половине эллипсоида (ёж, дикобраз)
function spines(par, rx, ry, rz, n, len, r, mats, seed, back = 0.6) {
  const rr = rng(seed), d = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const th = 0.2 + rr() * (PI - 0.3), ph = (rr() - 0.5) * PI * 0.95;
    const x = Math.sin(ph), y = Math.cos(ph) * Math.sin(th), z = Math.cos(ph) * Math.cos(th);
    d.set(x, y, z - back).normalize();
    const l = len * (0.7 + rr() * 0.5);
    const m = P(par, cone(r, l, 3), mats[i % mats.length], x * rx + d.x * l * 0.4, y * ry + d.y * l * 0.4, z * rz + d.z * l * 0.4);
    m.quaternion.setFromUnitVectors(UP, d); m.castShadow = false;
  }
}
// четвероногое
function quad(g, o) {
  const mat = M(o.col), yc = o.h + o.gr * 0.75, seed = o.seed || 1;
  const body = grp(g, 0, yc, 0);
  P(body, sph(1, 12, 8), mat, 0, 0, 0, 0, 0, 0, o.gr * o.wid, o.gr, o.len / 2);
  if (o.belly) P(body, sph(1, 10, 6), M(o.belly), 0, -o.gr * 0.32, 0.02, 0, 0, 0, o.gr * o.wid * 0.82, o.gr * 0.68, o.len * 0.4);
  const legs = [], lm = M(o.legCol ?? o.col), fm = M(o.footCol ?? o.legCol ?? o.col), py = -o.gr * 0.35, L = yc + py;
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const lg = grp(body, sx * o.gr * o.wid * 0.55, py, sz * o.len * 0.32);
    const lr = o.legR * (sz < 0 ? 1.15 : 1);
    if (sz < 0 && o.thigh !== false) P(lg, sph(lr * 2.2, 8, 6), mat, 0, -lr * 1.2, -lr * 0.3, 0, 0, 0, 1, 1.8, 1.4);
    P(lg, cyl(lr * 0.75, lr, L, 6), lm, 0, -L / 2, 0);
    P(lg, sph(lr * 1.15, 6, 4), fm, 0, -L + lr * 0.5, lr * 0.5, 0, 0, 0, 1, 0.6, 1.6);
    lg.userData.ph = o.hop ? (sz > 0 ? 0 : PI * 0.6) : (sx * sz > 0 ? 0 : PI) + (sz > 0 ? 0 : 0.4);
    legs.push(lg);
  }
  const tilt = o.neckTilt ?? 0.3, nl = o.neckLen ?? 0;
  const neck = grp(body, 0, o.gr * (o.neckY ?? 0.35), o.len / 2 - o.gr * 0.15, -tilt);
  if (nl) P(neck, cyl(o.headR * 0.6, o.gr * 0.5, nl, 8), M(o.neckCol ?? o.col), 0, 0, nl / 2, HPI);
  const head = grp(neck, 0, 0, nl + o.headR * 0.2, tilt * 0.85), hm = M(o.headCol ?? o.col);
  P(head, sph(o.headR, 10, 8), hm, 0, 0, o.headR * 0.3, 0, 0, 0, o.headW ?? 0.9, 0.9, 1.1);
  if (o.snout) {
    P(head, cyl(o.headR * 0.28, o.headR * 0.6, o.snout, 7), M(o.snoutCol ?? o.headCol ?? o.col), 0, -o.headR * 0.2, o.headR * 0.75 + o.snout / 2, HPI);
    P(head, sph(o.headR * 0.17, 6, 4), M(0x1a1410), 0, -o.headR * 0.15, o.headR * 0.78 + o.snout);
  }
  eyePair(head, o.headR * 0.5, o.headR * 0.25, o.headR * 0.85, o.headR * (o.eyeK ?? 0.15));
  if (o.ears) o.ears(head, hm, o);
  const tail = grp(body, 0, o.gr * 0.3, -o.len / 2 + o.gr * 0.1);
  const tt = o.tail;
  if (tt) {
    if (tt.fn) tt.fn(tail, mat);
    else {
      P(tail, cyl(tt.r0, tt.r1, tt.len, 6), M(tt.col ?? o.col), 0, 0, -tt.len / 2, HPI);
      if (tt.bush) P(tail, sph(1, 8, 6), M(tt.bushCol ?? tt.col ?? o.col), 0, 0, -tt.len * 0.55, 0, 0, 0, tt.bush, tt.bush * (tt.flat ?? 1), tt.len * 0.5);
      if (tt.tip) P(tail, sph(tt.bush ? tt.bush * 0.7 : tt.r1 * 1.3, 6, 4), M(tt.tip), 0, 0, -tt.len * 0.98);
    }
  }
  if (o.extra) o.extra(body, head, mat, o);
  const up0 = tt ? tt.up ?? 0.3 : 0;
  let ph = 0, mv = 0, hx = 0;
  g.userData.anim = (dt, t, moving) => {
    const k = Math.min(1, dt * 6);
    mv = approach(mv, moving ? 1 : 0, k);
    ph += dt * o.gait * (0.25 + 0.75 * mv);
    for (const lg of legs) lg.rotation.x = Math.sin(ph + lg.userData.ph) * o.swing * mv;
    if (o.hop) { body.position.y = yc + Math.max(0, Math.sin(ph)) * o.bob * mv; body.rotation.x = -Math.cos(ph) * 0.12 * mv; }
    else { body.position.y = yc + Math.abs(Math.sin(ph)) * o.bob * mv; body.rotation.z = Math.sin(ph) * 0.03 * mv; }
    body.scale.y = 1 + Math.sin(t * 2.6 + seed) * 0.012;
    head.rotation.y = Math.sin(t * 0.45 + seed) * 0.45 * (1 - mv);
    const graze = o.graze && Math.sin(t * 0.21 + seed * 3) > 0.55 ? 0.9 : 0;
    hx = approach(hx, graze * (1 - mv), Math.min(1, dt * 2.5)); neck.rotation.x = -tilt + hx;
    tail.rotation.y = Math.sin(t * (o.wag ?? 2.2) + seed) * (o.wagA ?? 0.2) * (moving ? 0.6 : 1);
    tail.rotation.x = up0 + Math.sin(ph * 2) * 0.08 * mv;
  };
  g.userData.parts = { body, head, neck, tail, legs };
  return g;
}
// ящерица / геккон / хамелеон: ноги в стороны
function rept(g, o) {
  const mat = M(o.col), seed = o.seed || 1;
  const body = grp(g, 0, o.y, 0);
  P(body, sph(1, 10, 7), mat, 0, 0, 0, 0, 0, 0, o.w, o.hh, o.len / 2);
  if (o.belly) P(body, sph(1, 8, 5), M(o.belly), 0, -o.hh * 0.3, 0, 0, 0, 0, o.w * 0.85, o.hh * 0.7, o.len * 0.45);
  const head = grp(body, 0, o.hh * 0.15, o.len * 0.42), hm = M(o.headCol ?? o.col);
  P(head, sph(1, 9, 6), hm, 0, 0, o.headLen * 0.5, 0, 0, 0, o.headW, o.headH, o.headLen * 0.55);
  if (o.turret) for (const s of [-1, 1]) { P(head, sph(o.headH * 0.55, 8, 6), hm, s * o.headW * 0.8, o.headH * 0.35, o.headLen * 0.55); P(head, sph(o.headH * 0.18, 5, 4), M(0x14100c), s * o.headW * 1.25, o.headH * 0.4, o.headLen * 0.6); }
  else eyePair(head, o.headW * 0.72, o.headH * 0.4, o.headLen * 0.6, o.eyeR ?? o.headH * 0.3, false);
  if (o.casque) P(head, cone(o.headW * 0.6, o.headH * 2.2, 4), hm, 0, o.headH * 0.9, o.headLen * 0.15, -0.9, 0, 0, 1, 1, 0.5);
  // хвост из двух звеньев (или закрученный)
  const t1 = grp(body, 0, 0, -o.len * 0.44), l1 = o.tailLen * 0.4, l2 = o.tailLen * 0.6;
  P(t1, cyl(o.tailR, o.tailR * 0.6, l1, 6), mat, 0, 0, -l1 / 2, HPI);
  const t2 = grp(t1, 0, 0, -l1);
  if (o.curl) P(t2, tube(`ecoCurl${o.key}`, [[0, 0, 0], [0, -0.03, -0.06], [0, -0.09, -0.07], [0, -0.1, -0.02], [0, -0.07, 0.0], [0, -0.06, -0.03]].map(([x, y, z]) => [x, y * o.curl, z * o.curl]), o.tailR * 0.6, o.tailR * 0.2, 12, 5), mat);
  else P(t2, cyl(o.tailR * 0.6, 0.002, l2, 5), mat, 0, 0, -l2 / 2, HPI);
  const legs = [], drop = o.y - o.hh * 0.1;
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const lg = grp(body, sx * o.w * 0.65, -o.hh * 0.1, sz * o.len * 0.3);
    P(lg, cyl(o.legR, o.legR, o.legLen, 5), mat, sx * o.legLen / 2, 0, 0, 0, 0, HPI);
    P(lg, cyl(o.legR * 0.8, o.legR * 0.7, drop, 5), mat, sx * o.legLen, -drop / 2, 0);
    P(lg, sph(o.legR * (o.pads ? 2.0 : 1.5), 5, 3), M(o.footCol ?? o.col), sx * o.legLen, -drop + o.legR * 0.3, o.legR, 0, 0, 0, 1.4, 0.4, 1.4);
    lg.userData.ph = sx * sz > 0 ? 0 : PI; lg.userData.sx = sx;
    legs.push(lg);
  }
  if (o.extra) o.extra(body, head, mat, o);
  let ph = 0, mv = 0;
  g.userData.anim = (dt, t, moving) => {
    mv = approach(mv, moving ? 1 : 0, Math.min(1, dt * 8));
    ph += dt * o.gait * mv;
    body.rotation.y = Math.sin(ph) * 0.2 * mv;
    t1.rotation.y = -Math.sin(ph - 0.8) * 0.4 * mv + Math.sin(t * 0.6 + seed) * 0.08;
    t2.rotation.y = -Math.sin(ph - 1.6) * 0.5 * mv;
    for (const lg of legs) lg.rotation.y = Math.sin(ph + lg.userData.ph) * 0.55 * mv * lg.userData.sx;
    if (o.slow) { g.userData.parts.body.position.z = Math.sin(t * 1.7) * 0.006 * (1 - mv); head.rotation.y = Math.sin(t * 0.3 + seed) * 0.25; }
    else head.rotation.y = Math.sin(Math.floor(t * 0.9 + seed) * 12.9898) * 0.35 * (1 - mv);
    body.position.y = o.y + Math.sin(t * (o.slow ? 0.8 : 3.0)) * 0.002;
  };
  g.userData.parts = { body, head, tail: t1, legs };
  return g;
}
// крыло: контур в плоскости XY (X — размах, Y — хорда назад), выдавленный тонко
const wingG = (pointed) => extr(pointed ? 'ecoWingP' : 'ecoWingR', pointed
  ? [[0, 0], [0.5, -0.02], [1.0, 0.22], [0.78, 0.42], [0.45, 0.72], [0, 0.85]]
  : [[0, 0], [0.45, -0.03], [0.85, 0.04], [1.0, 0.18], [0.96, 0.42], [0.72, 0.62], [0.4, 0.82], [0.1, 0.95], [0, 0.9]], 0.025, 0);
const wingTipG = (pointed) => extr(pointed ? 'ecoWingTP' : 'ecoWingTR', pointed
  ? [[0.62, 0.06], [1.0, 0.22], [0.78, 0.42], [0.6, 0.55]]
  : [[0.62, 0.0], [0.85, 0.04], [1.0, 0.18], [0.96, 0.42], [0.72, 0.62], [0.6, 0.6]], 0.035, 0);
function bird(g, o) {
  const yc = o.legH + o.r * 0.75, seed = o.seed || 1, pitch = o.pitch ?? 0;
  const body = grp(g, 0, yc, 0, pitch);
  P(body, sph(1, 12, 8), M(o.col), 0, 0, 0, 0, 0, 0, o.r * (o.wid ?? 0.85), o.r, o.len / 2);
  if (o.belly) P(body, sph(1, 10, 6), M(o.belly), 0, -o.r * 0.25, o.len * 0.06, 0, 0, 0, o.r * 0.72, o.r * 0.75, o.len * 0.38);
  const nk = grp(body, 0, o.r * 0.45, o.len * 0.38);
  const pts = o.neck || [[0, 0], [0.02, 0.02]];
  P(nk, tube(`ecoNeck_${o.key}`, pts.map(([y, z]) => [0, y, z]), o.neckR, o.neckR * 0.75, 10, 6), M(o.neckCol ?? o.col));
  const hp = pts[pts.length - 1];
  const head = grp(nk, 0, hp[0], hp[1], -pitch);
  P(head, sph(o.headR, 10, 8), M(o.headCol ?? o.col), 0, 0, 0, 0, 0, 0, 0.85, 0.95, 1.15);
  const bl = o.beakLen, bd = o.beakDown ?? 0;
  P(head, cone(o.beakR, bl, 6), M(o.beakCol), 0, -o.headR * 0.1 - Math.sin(bd) * bl * 0.4, o.headR * 0.8 + bl / 2, HPI + bd, 0, 0, 1, 1, o.beakFlat ?? 1);
  if (o.hook) P(head, cone(o.beakR * 0.5, o.beakR * 1.6, 5), M(o.beakCol), 0, -o.headR * 0.1 - o.beakR * 0.6, o.headR * 0.8 + bl * 0.95, PI - 0.4);
  eyePair(head, o.headR * 0.6, o.headR * 0.25, o.headR * 0.45, o.headR * 0.16);
  // ноги (на группе-корне, вертикальны при любом наклоне тела)
  const legs = [], lm = M(o.legCol);
  for (const s of [-1, 1]) {
    const lg = grp(g, s * o.r * 0.32, o.legH, o.legZ ?? 0);
    P(lg, cyl(o.legR, o.legR, o.legH, 5), lm, 0, -o.legH / 2, 0);
    const toe = o.toe ?? o.legH * 0.25 + 0.02;
    for (const a of [-0.55, 0, 0.55]) P(lg, box(o.legR * 1.3, o.legR * 0.9, toe), lm, Math.sin(a) * toe / 2, -o.legH + o.legR * 0.45, Math.cos(a) * toe / 2, 0, a, 0);
    P(lg, box(o.legR * 1.3, o.legR * 0.9, toe * 0.5), lm, 0, -o.legH + o.legR * 0.45, -toe * 0.25);
    lg.userData.s = s; legs.push(lg);
  }
  // крылья: плечо → поворот (сложение назад) → взмах → разворот хорды вниз → сетка
  const wings = [], wm = M(o.wingCol ?? o.col, DS), tm = M(o.tipCol ?? o.wingCol ?? o.col, DS);
  for (const s of [-1, 1]) {
    const sh = grp(body, s * o.r * (o.wid ?? 0.85) * 0.9, o.r * 0.45, o.len * 0.22);
    const yaw = grp(sh), flap = grp(yaw), roll = grp(flap);
    const w1 = P(roll, wingG(o.pointed), wm, 0, 0, 0, -HPI, 0, 0);
    const w2 = P(roll, wingTipG(o.pointed), tm, 0, 0, 0, -HPI, 0, 0);
    wings.push({ yaw, flap, roll, s, w1, w2 });
  }
  const tl = grp(body, 0, o.r * 0.2, -o.len * 0.45, o.tailUp ?? 0.1);
  P(tl, box(o.tailW, Math.max(0.01, o.r * 0.07), o.tailLen), M(o.tailCol ?? o.wingCol ?? o.col), 0, 0, -o.tailLen / 2);
  if (o.extra) o.extra(body, head, nk, o);
  g.userData.flies = !!o.fly;
  let f = 1, mv = 0, ph = 0;
  g.userData.anim = (dt, t, moving) => {
    const mode = g.userData.mode;
    const flying = mode === 'fly' || (mode !== 'walk' && o.fly && moving);
    f = approach(f, flying ? 0 : 1, Math.min(1, dt * 5));
    mv = approach(mv, moving && !flying ? 1 : 0, Math.min(1, dt * 6));
    ph += dt * (o.step ?? 8) * mv;
    const amp = o.soar ? 0.2 + 0.45 * Math.max(0, Math.sin(t * 0.35 + seed)) : 0.75;
    const fl = Math.sin(t * (o.flapHz ?? 3) * TAU) * amp * (1 - f);
    for (const w of wings) {
      w.yaw.rotation.y = w.s * HPI * 0.92 * f;
      w.roll.rotation.x = -HPI * 0.88 * f;
      w.flap.rotation.z = w.s * (fl + 0.06 * (1 - f) + 0.12 * f);
      const sx = w.s * lerp(o.span, o.len * 0.82, f), sy = lerp(o.chord, o.r * 1.15, f);   // сложенное крыло короче и уже
      w.w1.scale.set(sx, sy, 1); w.w2.scale.set(sx, sy, 1);
    }
    body.rotation.x = lerp(0, pitch, f);
    body.position.y = yc + Math.abs(Math.sin(ph)) * o.r * 0.1 * mv;
    for (const lg of legs) lg.rotation.x = (1 - f) * 1.3 + Math.sin(ph + (lg.userData.s > 0 ? 0 : PI)) * 0.5 * mv;
    nk.rotation.x = Math.sin(ph * 2) * 0.14 * mv + Math.sin(t * 0.7 + seed) * 0.06 * f;
    head.rotation.y = Math.sin(t * 0.55 + seed) * 0.5 * f * (1 - mv);
    tl.rotation.x = (o.tailUp ?? 0.1) + Math.sin(t * 1.3) * 0.04;
  };
  g.userData.parts = { body, head, neck: nk, legs, wings, tail: tl };
  return g;
}
// ---------- конкретные виды ----------
const earCone = (h, r, col, lean = 0.25, dark = null) => (head, hm, o) => {
  for (const s of [-1, 1]) {
    const e = P(head, cone(r, h, 5), M(col ?? 0), s * o.headR * 0.45, o.headR * 0.75 + h * 0.4, -o.headR * 0.05, -lean, 0, s * -0.25); e.scale.z = 0.45;
    if (dark) P(head, cone(r * 0.5, h * 0.35, 4), M(dark), s * (o.headR * 0.45 + Math.sin(0.25) * h * 0.38), o.headR * 0.75 + h * 0.85, -o.headR * 0.05 - Math.sin(lean) * h * 0.4, -lean, 0, s * -0.25);
  }
};
const CRIT = {
  hare: (g) => quad(g, { len: 0.48, h: 0.15, gr: 0.11, wid: 0.85, col: 0x9a7a56, belly: 0xe8dcc8, headR: 0.058, snout: 0.035, legR: 0.015, hop: true, gait: 9, swing: 0.9, bob: 0.1, neckLen: 0.04, neckTilt: 0.5, eyeK: 0.2, seed: 2,
    ears: (head, hm, o) => { for (const s of [-1, 1]) { const e = P(head, cone(0.022, 0.13, 5), hm, s * 0.025, 0.1, -0.03, -0.45, 0, s * -0.15); e.scale.z = 0.4; P(head, cone(0.012, 0.03, 4), M(0x1a1410), s * 0.03, 0.155, -0.075, -0.45, 0, s * -0.15); } },
    tail: { len: 0.04, r0: 0.02, r1: 0.02, up: 1.0, bush: 0.035, bushCol: 0xf0ece4 } }),
  fox: (g) => quad(g, { len: 0.6, h: 0.27, gr: 0.11, wid: 0.8, col: 0xc0622a, belly: 0xeee0cc, legCol: 0x3a2618, headR: 0.072, snout: 0.1, legR: 0.019, gait: 10, swing: 0.6, bob: 0.015, neckLen: 0.08, neckTilt: 0.5, seed: 3,
    ears: earCone(0.08, 0.035, 0xb85a28, 0.15, 0x2a1810),
    tail: { len: 0.42, r0: 0.035, r1: 0.03, up: 0.2, bush: 0.07, bushCol: 0xb85a28, tip: 0xf0e8dc },
    extra: (body, head) => P(head, sph(0.05, 8, 6), M(0xf0e8dc), 0, -0.035, 0.07, 0, 0, 0, 1, 0.6, 1.4) }),
  wildcat: (g) => quad(g, { len: 0.52, h: 0.25, gr: 0.1, wid: 0.8, col: 0x8a7a62, belly: 0xc8b89a, headR: 0.068, headW: 1.0, snout: 0.03, legR: 0.019, gait: 9, swing: 0.6, bob: 0.012, neckLen: 0.05, neckTilt: 0.35, seed: 4, wag: 1.2, wagA: 0.3,
    ears: earCone(0.045, 0.03, 0x7a6a52, 0.1, 0x2a2018),
    tail: { up: 0.15, fn: (tl, mat) => { for (let i = 0; i < 6; i++) P(tl, cyl(0.03, 0.03, 0.05, 6), M(i === 5 ? 0x1a1410 : i % 2 ? 0x3a3024 : 0x8a7a62), 0, 0, -0.025 - i * 0.05, HPI); } },
    extra: (body, head, mat, o) => { P(body, box(0.02, 0.01, o.len * 0.7), M(0x2a2018), 0, o.gr * 0.96, -0.02); for (const s of [-1, 1]) for (let i = 0; i < 4; i++) P(body, box(0.006, o.gr * 0.7, 0.018), M(0x4a3e30), s * o.gr * o.wid * 0.93, o.gr * 0.25, -0.16 + i * 0.09, 0, 0, s * 0.35); } }),
  mouflon: (g) => quad(g, { len: 0.95, h: 0.48, gr: 0.2, wid: 0.75, col: 0x7a4a2a, belly: 0xe8dcc8, legCol: 0x8a6a4a, footCol: 0x2a2018, headR: 0.085, snout: 0.12, snoutCol: 0x8a5a3a, legR: 0.026, gait: 8, swing: 0.5, bob: 0.02, neckLen: 0.24, neckTilt: 0.75, graze: true, seed: 5,
    ears: earCone(0.07, 0.025, 0x7a4a2a, 0.9),
    tail: { len: 0.1, r0: 0.03, r1: 0.02, up: -0.4, col: 0x4a2a1a },
    extra: (body, head) => {
      for (const s of [-1, 1]) {
        P(body, sph(0.09, 8, 6), M(0xe8dcc8), s * 0.14, 0.06, 0.0, 0, 0, 0, 0.3, 1, 1.6);
        P(head, tube(`ecoMfHorn${s}`, [[s * 0.035, 0.06, -0.01], [s * 0.1, 0.12, -0.08], [s * 0.17, 0.07, -0.15], [s * 0.18, -0.05, -0.11], [s * 0.14, -0.09, -0.01], [s * 0.15, -0.04, 0.07]], 0.03, 0.008, 14, 6), M(0x9a8a6a));
      }
      P(head, sph(0.04, 6, 4), M(0xe8dcc8), 0, -0.04, 0.2, 0, 0, 0, 1, 0.6, 1);
    } }),
  dormouse: (g) => quad(g, { len: 0.13, h: 0.028, gr: 0.038, wid: 0.95, col: 0x8a8478, belly: 0xe0dcd0, headR: 0.028, snout: 0.014, legR: 0.0055, gait: 18, swing: 0.8, bob: 0.008, neckTilt: 0.2, eyeK: 0.26, seed: 6, thigh: false,
    ears: (head) => { for (const s of [-1, 1]) P(head, sph(0.011, 6, 4), M(0xb8aca0), s * 0.017, 0.024, -0.003, 0, 0, 0, 1, 1, 0.35); },
    tail: { len: 0.13, r0: 0.01, r1: 0.008, up: 0.45, bush: 0.02, flat: 0.8 } }),
  hedgehog: (g) => quad(g, { len: 0.2, h: 0.03, gr: 0.068, wid: 0.95, col: 0x8a7a68, headR: 0.033, snout: 0.035, snoutCol: 0xb89a7a, headCol: 0xb89a7a, legR: 0.008, legCol: 0x5a4a3a, gait: 16, swing: 0.7, bob: 0.004, neckTilt: -0.1, neckY: 0.0, seed: 7, thigh: false,
    extra: (body, head, mat, o) => spines(body, o.gr * o.wid, o.gr, o.len / 2, 60, 0.035, 0.007, [M(0x5a4a3a), M(0xd8ccb8), M(0x3a2e22)], 7, 0.5) }),
  porcupine: (g) => quad(g, { len: 0.55, h: 0.09, gr: 0.14, wid: 0.9, col: 0x2a2420, headR: 0.065, snout: 0.045, legR: 0.022, gait: 7, swing: 0.5, bob: 0.01, neckTilt: -0.1, neckY: 0.1, seed: 8,
    tail: { len: 0.08, r0: 0.03, r1: 0.02, up: 0.3 },
    extra: (body, head, mat, o) => {
      spines(body, o.gr * o.wid, o.gr, o.len / 2, 70, 0.3, 0.008, [M(0xf0ece4), M(0x1a1612), M(0xd8d0c4)], 8, 1.0);
      for (let i = 0; i < 8; i++) { const m = P(head, cone(0.006, 0.12, 3), M(0xe8e0d4), (i - 3.5) * 0.008, 0.06, -0.02 - i * 0.006); m.rotation.x = -1.0; }
    } }),
  tortoise: (g) => {
    const shell = grp(g, 0, 0.055, 0);
    P(shell, G('ecoTortShell', () => new THREE.SphereGeometry(1, 10, 5, 0, TAU, 0, HPI)), FOL(0x8a7a3a), 0, 0, 0, 0, 0, 0, 0.12, 0.1, 0.15);
    P(shell, cyl(0.125, 0.12, 0.03, 12), FOL(0x6a5a2a), 0, 0.005, 0, 0, 0, 0, 1, 1, 1.25);
    for (let i = 0; i < 5; i++) P(shell, sph(0.03, 5, 3), FOL(i % 2 ? 0x4a3a1a : 0xb8a050), (i % 2 - 0.5) * 0.06 * (i > 2 ? 1 : 0), 0.09 - Math.abs(i - 2) * 0.012, -0.08 + i * 0.04, 0, 0, 0, 1.2, 0.3, 1);
    P(shell, sph(1, 8, 4), M(0xc8b070), 0, -0.012, 0, 0, 0, 0, 0.1, 0.02, 0.13);
    const sk = M(0x8a8060), legs = [];
    const head = grp(shell, 0, 0.01, 0.15);
    P(head, cyl(0.018, 0.022, 0.05, 6), sk, 0, 0, 0.0, HPI);
    P(head, sph(0.026, 8, 6), sk, 0, 0.005, 0.035, 0, 0, 0, 0.9, 0.85, 1.2);
    eyePair(head, 0.016, 0.012, 0.05, 0.005, false);
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const lg = grp(shell, sx * 0.085, 0.0, sz * 0.09);
      P(lg, cyl(0.02, 0.024, 0.06, 6), sk, 0, -0.03, 0, 0, 0, sx * 0.3);
      P(lg, sph(0.024, 6, 4), sk, sx * 0.01, -0.052, 0.006, 0, 0, 0, 1.1, 0.5, 1.2);
      lg.userData.ph = sx * sz > 0 ? 0 : PI; legs.push(lg);
    }
    P(shell, cone(0.008, 0.03, 4), sk, 0, 0.0, -0.155, -HPI);
    let ph = 0, mv = 0;
    g.userData.anim = (dt, t, moving) => {
      mv = approach(mv, moving ? 1 : 0, Math.min(1, dt * 3)); ph += dt * 3.5 * mv;
      for (const lg of legs) lg.rotation.x = Math.sin(ph + lg.userData.ph) * 0.45 * mv;
      shell.rotation.z = Math.sin(ph) * 0.04 * mv; shell.position.y = 0.055 + Math.abs(Math.sin(ph)) * 0.004 * mv;
      head.position.z = 0.15 + (mv * 0.015) - (Math.sin(t * 0.2) > 0.85 ? 0.03 : 0) * (1 - mv);
      head.rotation.y = Math.sin(t * 0.3) * 0.3 * (1 - mv);
    };
    g.userData.parts = { body: shell, head, legs };
    return g;
  },
  sea_turtle: (g) => {
    const body = grp(g, 0, 0.16, 0), sk = M(0x7a7058);
    P(body, G('ecoSeaTShell', () => lumpy(new THREE.SphereGeometry(1, 12, 7), 0.04, 5)), FOL(0x7a5634), 0, 0.03, 0, 0, 0, 0, 0.42, 0.16, 0.52);
    P(body, sph(1, 10, 5), M(0xd8c08a), 0, -0.04, 0, 0, 0, 0, 0.36, 0.08, 0.46);
    for (let i = 0; i < 5; i++) P(body, sph(0.08, 5, 3), FOL(0x5a3e24), 0, 0.17, -0.3 + i * 0.15, 0, 0, 0, 1.2, 0.25, 1.3);
    const head = grp(body, 0, 0.0, 0.5);
    P(head, sph(0.1, 10, 8), sk, 0, 0.0, 0.06, 0, 0, 0, 0.85, 0.75, 1.15);
    P(head, sph(0.1, 8, 4), M(0x8a5a2a), 0, 0.03, 0.06, 0, 0, 0, 0.8, 0.5, 1.0);
    eyePair(head, 0.07, 0.025, 0.12, 0.014, false);
    const fl = [];
    for (const [s, z, span, chord, sweep] of [[1, 0.28, 0.5, 0.2, 0.55], [-1, 0.28, 0.5, 0.2, 0.55], [1, -0.4, 0.22, 0.14, 0.9], [-1, -0.4, 0.22, 0.14, 0.9]]) {
      const sh = grp(body, s * 0.34, -0.02, z, 0, s * sweep, 0), fp = grp(sh);
      const m = P(fp, wingG(false), sk, 0, 0, 0, -HPI, 0, 0); m.scale.set(s * span, chord, 1.6);
      fl.push({ fp, s, front: z > 0 });
    }
    P(body, cone(0.03, 0.1, 4), sk, 0, -0.02, -0.55, -HPI);
    let ph = 0, mv = 0;
    g.userData.anim = (dt, t, moving) => {
      mv = approach(mv, moving ? 1 : 0, Math.min(1, dt * 4)); ph += dt * (1.2 + 2.0 * mv);
      for (const f of fl) f.fp.rotation.z = f.s * Math.sin(ph + (f.front ? 0 : PI)) * (f.front ? 0.15 + 0.5 * mv : 0.1 + 0.2 * mv);
      head.rotation.y = Math.sin(t * 0.4) * 0.2; head.rotation.x = Math.sin(t * 0.25) * 0.1;
      body.position.y = 0.16 + Math.sin(ph) * 0.01 * mv;
    };
    g.userData.parts = { body, head, flippers: fl };
    return g;
  },
  monk_seal: (g) => {
    const mat = M(0x4a443e), bel = M(0xb8b0a0);
    const body = grp(g, 0, 0.3, 0);
    P(body, sph(1, 14, 8), mat, 0, 0, 0.1, 0, 0, 0, 0.36, 0.3, 0.78);
    P(body, sph(1, 10, 6), bel, 0, -0.14, 0.15, 0, 0, 0, 0.3, 0.17, 0.55);
    const hip = grp(body, 0, -0.04, -0.55);
    P(hip, sph(1, 10, 6), mat, 0, -0.02, -0.28, 0, 0, 0, 0.26, 0.21, 0.5);
    const hf = [];
    for (const s of [-1, 1]) { const f = grp(hip, s * 0.08, -0.06, -0.72, 0, s * -0.35, 0); P(f, box(0.18, 0.03, 0.32), M(0x3a342e), 0, 0, -0.14); hf.push(f); }
    const head = grp(body, 0, 0.12, 0.82);
    P(head, sph(0.17, 10, 8), mat, 0, 0, 0.04, 0, 0, 0, 0.9, 0.85, 1.15);
    P(head, sph(0.09, 8, 6), M(0x5a524a), 0, -0.04, 0.2, 0, 0, 0, 1.1, 0.8, 0.8);
    P(head, sph(0.015, 5, 3), M(0x14100c), 0, -0.02, 0.27);
    eyePair(head, 0.08, 0.04, 0.15, 0.025);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const w = P(head, cyl(0.002, 0.002, 0.12, 3), M(0xe0dcd0), s * 0.08, -0.05 - k * 0.01, 0.22, 0, 0, s * (HPI + 0.1 * k)); w.castShadow = false; }
    const ff = [];
    for (const s of [-1, 1]) { const f = grp(body, s * 0.3, -0.18, 0.42, 0, 0, s * 0.5); P(f, box(0.26, 0.035, 0.13), M(0x3a342e), s * 0.12, 0, 0, 0, s * 0.3, 0); ff.push({ f, s }); }
    let ph = 0, mv = 0;
    g.userData.anim = (dt, t, moving) => {
      mv = approach(mv, moving ? 1 : 0, Math.min(1, dt * 4)); ph += dt * 5 * mv;
      body.position.y = 0.3 + Math.max(0, Math.sin(ph)) * 0.07 * mv;
      body.rotation.x = Math.sin(ph) * 0.07 * mv;
      hip.rotation.x = -Math.sin(ph - 1) * 0.18 * mv + Math.sin(t * 0.5) * 0.04 * (1 - mv);
      head.rotation.x = (-0.35 + Math.sin(t * 0.35) * 0.15) * (1 - mv) + Math.sin(ph) * 0.1 * mv;
      head.rotation.y = Math.sin(t * 0.27) * 0.3 * (1 - mv);
      for (const { f, s } of ff) f.rotation.z = s * (0.5 + Math.sin(ph) * 0.4 * mv);
      for (const f of hf) f.rotation.x = Math.sin(t * 1.1) * 0.15;
    };
    g.userData.parts = { body, head, hip };
    return g;
  },
  lizard: (g) => rept(g, { key: 'liz', len: 0.08, w: 0.016, hh: 0.011, y: 0.016, col: 0x6a8a3a, belly: 0xc8c890, headLen: 0.03, headW: 0.011, headH: 0.009, tailLen: 0.15, tailR: 0.008, legLen: 0.016, legR: 0.0035, gait: 22, seed: 9,
    extra: (body) => { for (let i = 0; i < 6; i++) P(body, sph(0.004, 4, 3), M(0x2a3a1a), (i % 2 - 0.5) * 0.014, 0.009, -0.03 + i * 0.012); } }),
  gecko: (g) => rept(g, { key: 'gec', len: 0.065, w: 0.017, hh: 0.008, y: 0.013, col: 0x8a8070, belly: 0xd8d0c0, headLen: 0.028, headW: 0.014, headH: 0.008, eyeR: 0.004, tailLen: 0.07, tailR: 0.008, legLen: 0.018, legR: 0.0035, pads: true, gait: 18, seed: 10,
    extra: (body) => { for (let i = 0; i < 10; i++) P(body, sph(0.0025, 4, 3), M(0x5a5248), Math.sin(i * 2.4) * 0.011, 0.007, -0.025 + i * 0.005); } }),
  chameleon: (g) => rept(g, { key: 'cha', len: 0.12, w: 0.02, hh: 0.035, y: 0.05, col: 0x5a9a3a, belly: 0xc8d870, headLen: 0.045, headW: 0.016, headH: 0.02, tailLen: 0.09, tailR: 0.01, curl: 1.0, legLen: 0.01, legR: 0.005, turret: true, casque: true, gait: 3, slow: true, seed: 11,
    extra: (body) => { for (let i = 0; i < 7; i++) P(body, cone(0.004, 0.01, 3), M(0x4a8a2a), 0, 0.034, -0.045 + i * 0.015); for (let i = 0; i < 3; i++) P(body, sph(0.012, 5, 3), M(0xd8e080), 0.016, 0.0, -0.03 + i * 0.03, 0, 0, 0, 0.3, 1, 1); } }),
  heron: (g) => bird(g, { key: 'her', len: 0.5, r: 0.12, wid: 0.8, legH: 0.55, legR: 0.008, legCol: 0x8a7a50, col: 0x9aa0a8, belly: 0xe8e8e4, neck: [[0, 0], [0.1, 0.06], [0.2, 0.02], [0.3, 0.06], [0.38, 0.12]], neckR: 0.028, neckCol: 0xe0e0dc, headR: 0.038, headCol: 0xe8e8e4, beakLen: 0.13, beakR: 0.011, beakCol: 0xd8b040, span: 0.85, chord: 0.35, wingCol: 0x8a909a, tipCol: 0x2a2a30, tailLen: 0.14, tailW: 0.14, fly: true, flapHz: 1.5, pitch: -0.3, step: 5, seed: 12,
    extra: (body, head) => { P(head, box(0.008, 0.008, 0.12), M(0x1a1a20), 0, 0.03, -0.07, 0.3); P(head, box(0.05, 0.012, 0.04), M(0x1a1a20), 0, 0.03, 0.0); } }),
  flamingo: (g) => bird(g, { key: 'fla', len: 0.5, r: 0.14, wid: 0.8, legH: 0.8, legR: 0.008, legCol: 0xe08a98, col: 0xf2b0b8, neck: [[0, 0], [0.18, 0.03], [0.34, -0.05], [0.5, 0.0], [0.6, 0.08]], neckR: 0.024, headR: 0.04, beakLen: 0.1, beakR: 0.018, beakCol: 0xf0d8d0, beakDown: 0.7, span: 0.8, chord: 0.32, wingCol: 0xe8789a, tipCol: 0x1a1a1a, tailLen: 0.12, tailW: 0.12, fly: true, flapHz: 1.8, pitch: -0.1, step: 4, seed: 13,
    extra: (body, head) => P(head, cone(0.012, 0.04, 5), M(0x1a1a1a), 0, -0.08, 0.1, PI - 0.3) }),
  vulture: (g) => bird(g, { key: 'vul', len: 0.75, r: 0.25, wid: 0.9, legH: 0.18, legR: 0.02, legCol: 0x8a8a80, col: 0xa08060, belly: 0x8a6a4a, neck: [[0, 0], [0.08, 0.06], [0.12, 0.14]], neckR: 0.045, neckCol: 0xe0d4c4, headR: 0.06, headCol: 0xd8ccc0, beakLen: 0.07, beakR: 0.024, beakCol: 0x9a9a90, hook: true, span: 1.3, chord: 0.6, wingCol: 0x8a6a48, tipCol: 0x2a2018, tailLen: 0.25, tailW: 0.3, tailCol: 0x3a2a1a, fly: true, flapHz: 0.9, soar: true, pitch: -0.5, step: 4, seed: 14,
    extra: (body, head, nk) => P(nk, tor(0.08, 0.035, 5, 10), M(0xf0e8dc), 0, 0.01, 0.0, HPI + 0.6) }),
  falcon: (g) => bird(g, { key: 'fal', len: 0.3, r: 0.08, wid: 0.85, legH: 0.06, legR: 0.008, legCol: 0xe8c030, col: 0x5a6270, belly: 0xe8e0d0, neck: [[0, 0], [0.02, 0.03]], neckR: 0.04, headR: 0.04, headCol: 0x2a2e38, beakLen: 0.025, beakR: 0.012, beakCol: 0x3a3a40, hook: true, span: 0.45, chord: 0.16, pointed: true, wingCol: 0x5a6270, tipCol: 0x2a2e38, tailLen: 0.13, tailW: 0.06, fly: true, flapHz: 4, pitch: -0.6, step: 8, seed: 15,
    extra: (body, head) => { for (const s of [-1, 1]) P(head, box(0.006, 0.03, 0.012), M(0x1a1c22), s * 0.03, -0.02, 0.02); P(head, sph(0.03, 6, 4), M(0xf0e8dc), 0, -0.022, 0.02, 0, 0, 0, 0.9, 0.6, 0.8); } }),
  sea_eagle: (g) => bird(g, { key: 'sea', len: 0.6, r: 0.19, wid: 0.85, legH: 0.12, legR: 0.018, legCol: 0xe0c040, col: 0x6a5038, belly: 0x5a4030, neck: [[0, 0], [0.06, 0.06], [0.09, 0.12]], neckR: 0.07, neckCol: 0x9a8466, headR: 0.075, headCol: 0xc8b89a, beakLen: 0.09, beakR: 0.03, beakCol: 0xe8c838, hook: true, span: 1.1, chord: 0.5, wingCol: 0x5a4030, tipCol: 0x2a2018, tailLen: 0.25, tailW: 0.22, tailCol: 0xf4f0e8, fly: true, flapHz: 1.1, soar: true, pitch: -0.45, step: 4, seed: 16 }),
  partridge: (g) => bird(g, { key: 'par', len: 0.26, r: 0.1, wid: 0.9, legH: 0.08, legR: 0.008, legCol: 0xc83a2a, col: 0x9a9488, belly: 0xd8b088, neck: [[0, 0], [0.04, 0.03], [0.06, 0.05]], neckR: 0.04, headR: 0.04, beakLen: 0.022, beakR: 0.01, beakCol: 0xc83a2a, span: 0.25, chord: 0.14, wingCol: 0x8a8070, tipCol: 0x6a6050, tailLen: 0.08, tailW: 0.08, tailCol: 0xa86a3a, fly: false, flapHz: 6, pitch: -0.05, step: 14, seed: 17,
    extra: (body, head, nk) => {
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) P(body, box(0.006, 0.05, 0.012), M(i % 2 ? 0x1a1612 : 0xd8ccb8), s * 0.083, -0.01, -0.04 + i * 0.022, 0, 0, s * 0.2);
      P(nk, sph(0.03, 8, 6), M(0xf0ece4), 0, 0.03, 0.06, 0, 0, 0, 0.9, 0.9, 0.6);
      P(nk, tor(0.032, 0.006, 3, 10), M(0x1a1612), 0, 0.03, 0.05, 0.4);
      P(head, box(0.05, 0.008, 0.03), M(0x1a1612), 0, 0.0, 0.015);
    } }),
  pelican: (g) => bird(g, { key: 'pel', len: 0.9, r: 0.28, wid: 0.85, legH: 0.22, legR: 0.025, legCol: 0xe8a050, toe: 0.12, col: 0xf2eee8, belly: 0xe8e4dc, neck: [[0, 0], [0.15, 0.02], [0.28, -0.02], [0.36, 0.06]], neckR: 0.06, headR: 0.08, headCol: 0xf4f0ea, beakLen: 0.42, beakR: 0.045, beakCol: 0xe8b860, beakFlat: 0.45, span: 1.4, chord: 0.5, wingCol: 0xf2eee8, tipCol: 0x1a1a1a, tailLen: 0.18, tailW: 0.2, fly: true, flapHz: 1.2, soar: true, pitch: -0.15, step: 4, seed: 18,
    extra: (body, head) => { P(head, sph(1, 10, 6), M(0xe8a050), 0, -0.07, 0.3, 0, 0, 0, 0.05, 0.06, 0.18); P(head, cone(0.015, 0.04, 4), M(0xc87a30), 0, -0.02, 0.5, PI - 0.6); } }),
};
export const CRITTERS = Object.keys(CRIT);
export function makeCritter(kind = 'hare') {
  const g = new THREE.Group(); g.name = 'critter_' + kind;
  (CRIT[kind] || CRIT.hare)(g);
  g.userData.kind = kind;
  if (!g.userData.anim) g.userData.anim = () => {};
  g.userData.anim(1, 0, false);   // начальная поза (крылья сложены)
  const bb = new THREE.Box3().setFromObject(g); g.userData.len = +(bb.max.z - bb.min.z).toFixed(2); g.userData.height = +bb.max.y.toFixed(2);
  return g;
}

// ======================================================================
// Флора островов: makePlant(kind) → Group (высота реалистичная, userData.height)
// ======================================================================
const bladeG = () => G('ecoBladeG', () => { const q = new THREE.CylinderGeometry(0, 0.5, 1, 3, 1, true); q.translate(0, 0.5, 0); return q; });
const _bd = new THREE.Vector3();
function blade(par, x, y, z, a, lean, h, w, mat, flat = 0.35) {
  const m = P(par, bladeG(), mat, x, y, z); m.scale.set(w, h, w * flat);
  m.quaternion.setFromUnitVectors(UP, _bd.set(Math.sin(lean) * Math.cos(a), Math.cos(lean), Math.sin(lean) * Math.sin(a)));
  m.castShadow = false; return m;
}
function tuft(par, x, z, n, h, w, mat, lean0 = 0.2, lean1 = 0.9, seed = 1, y = 0) {
  const rr = rng(seed);
  for (let i = 0; i < n; i++) blade(par, x, y, z, (i / n) * TAU + rr() * 0.5, lerp(lean0, lean1, rr()), h * (0.7 + rr() * 0.4), w, mat);
}
// точки на поверхности кроны (для плодов и цветов)
function dots(par, cx, cy, cz, rx, ry, rz, n, geo, mats, seed, below = -0.2) {
  const rr = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = rr() * TAU, v = lerp(below, 1, rr()), c = Math.sqrt(1 - v * v);
    const m = P(par, geo, mats[i % mats.length], cx + Math.cos(a) * c * rx, cy + v * ry, cz + Math.sin(a) * c * rz, rr() * 3, rr() * 3, 0);
    m.castShadow = false;
  }
}
const fanG = () => G('ecoFan', () => {
  const q = new THREE.CircleGeometry(0.5, 12, 0.15, PI - 0.3), p = q.attributes.position;
  for (let i = 1; i < p.count; i++) p.setZ(i, (i % 2) * 0.05 - p.getY(i) * 0.25);
  q.computeVertexNormals(); return q;
});
const PL = {
  dwarf_palm: (g) => {
    const tr = M(0x6a4a30), lf = M(0x5a7a3a, DS), lf2 = M(0x6a8a44, DS);
    for (const [x, z, h, s] of [[0, 0, 0.55, 1], [0.35, 0.15, 0.3, 2], [-0.25, 0.3, 0.2, 3]]) {
      P(g, G('ecoPalmTr', () => lumpy(new THREE.CylinderGeometry(0.1, 0.13, 1, 7, 3), 0.15, 3)), tr, x, h / 2, z, 0, 0, 0, 1, h, 1);
      const rr = rng(s);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + rr(), lean = 0.35 + rr() * 0.7, pl = 0.45 + rr() * 0.25;
        const tip = [x + Math.sin(lean) * Math.cos(a) * pl, h + Math.cos(lean) * pl, z + Math.sin(lean) * Math.sin(a) * pl];
        beam(g, [x, h, z], tip, 0.012, M(0x7a8a4a), 4);
        const fg = grp(g, tip[0], tip[1], tip[2], 0, HPI - a, 0);
        P(fg, fanG(), i % 2 ? lf : lf2, 0, 0, 0, -(lean + 0.2), 0, 0, 0.75 + rr() * 0.2).castShadow = true;
      }
    }
    g.userData.height = 1.3;
  },
  caper: (g) => {
    const st = M(0x7a6a4a), lf = FOL(0x6a8a4a), lf2 = FOL(0x5a7a40);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3, r = 0.65;
      P(g, tube(`ecoCaper${i}`, [[0, 0.05, 0], [Math.cos(a) * r * 0.4, 0.45, Math.sin(a) * r * 0.4], [Math.cos(a) * r * 0.8, 0.4, Math.sin(a) * r * 0.8], [Math.cos(a) * r, 0.12, Math.sin(a) * r]], 0.015, 0.008, 6, 4), st);
      for (let k = 1; k <= 3; k++) P(g, blob(0.13, 0, 50 + i * 3 + k, 0.7), k % 2 ? lf : lf2, Math.cos(a) * r * k * 0.28, 0.4 - (k === 3 ? 0.15 : 0) + 0.05, Math.sin(a) * r * k * 0.28);
    }
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9, r = 0.3 + (i % 3) * 0.15, fl = grp(g, Math.cos(a) * r, 0.52 + (i % 2) * 0.05, Math.sin(a) * r);
      for (let k = 0; k < 4; k++) P(fl, box(0.06, 0.004, 0.035), M(0xf4eef0), Math.cos(k * HPI) * 0.03, 0, Math.sin(k * HPI) * 0.03, 0, -k * HPI, 0);
      for (let k = 0; k < 5; k++) P(fl, cyl(0.002, 0.002, 0.05, 3), M(0xb04aa0), Math.cos(k * 1.2) * 0.01, 0.03, Math.sin(k * 1.2) * 0.01, 0.4 * Math.cos(k), 0, 0.4 * Math.sin(k)).castShadow = false;
    }
    g.userData.height = 0.6;
  },
  etna_broom: (g) => {
    const bark = M(0x5a4a38), lf = FOL(0x7a9a3a), lf2 = FOL(0x8aa840);
    beam(g, [0, -0.3, 0], [0.1, 2.2, 0.05], 0.14, bark, 6, 0.09);
    beam(g, [0.1, 2.0, 0.05], [-0.7, 3.4, 0.2], 0.07, bark, 5, 0.04);
    beam(g, [0.1, 2.0, 0.05], [0.8, 3.5, -0.3], 0.07, bark, 5, 0.04);
    beam(g, [0.1, 2.2, 0.05], [0.0, 3.8, 0.6], 0.06, bark, 5, 0.03);
    for (const [x, y, z, r, s] of [[-0.8, 3.7, 0.2, 0.95, 1], [0.9, 3.8, -0.3, 1.0, 2], [0.0, 4.2, 0.6, 0.9, 3], [0.1, 4.5, -0.2, 0.8, 4]]) {
      P(g, blob(r, 1, 60 + s, 1.3), s % 2 ? lf : lf2, x, y - 0.3, z, 0, s, 0, 1, 1, 1);
      for (let k = 0; k < 4; k++) { const a = k * 1.6 + s; beam(g, [x + Math.cos(a) * r * 0.8, y - 0.4, z + Math.sin(a) * r * 0.8], [x + Math.cos(a) * r * 1.05, y - 1.5, z + Math.sin(a) * r * 1.05], 0.012, lf, 3); }
    }
    dots(g, 0.0, 3.9, 0.1, 1.5, 0.9, 1.4, 34, oct(0.05), [M(0xf0d020), M(0xe8c018)], 5);
    g.userData.height = 5.2;
  },
  cork_oak: (g) => {
    const bark = FOL(0x8a7e6c), cork = FOL(0xa8502e), lf = FOL(0x3e5a2e), lf2 = FOL(0x4a6a34);
    P(g, G('ecoCorkTr', () => lumpy(new THREE.CylinderGeometry(0.36, 0.5, 1, 9, 4), 0.1, 6)), bark, 0, 2.0, 0, 0, 0, 0, 1, 2.6, 1);
    P(g, G('ecoCorkBot', () => lumpy(new THREE.CylinderGeometry(0.45, 0.5, 1, 9, 2), 0.05, 7)), cork, 0, 0.45, 0, 0, 0, 0, 1, 1.6, 1);
    beam(g, [0, 3.0, 0], [1.6, 5.0, 0.4], 0.24, bark, 6, 0.14);
    beam(g, [0, 3.0, 0], [-1.5, 5.2, -0.5], 0.24, bark, 6, 0.14);
    beam(g, [0, 3.1, 0], [0.2, 5.6, -1.2], 0.2, bark, 6, 0.12);
    for (const [x, y, z, r, s] of [[0, 6.6, 0, 2.2, 1], [1.9, 5.9, 0.6, 1.7, 2], [-1.8, 6.0, -0.6, 1.8, 3], [0.3, 6.1, -1.7, 1.5, 4], [-0.4, 5.8, 1.6, 1.5, 5]])
      P(g, blob(r, 1, 70 + s, 0.6), s % 2 ? lf : lf2, x, y, z);
    g.userData.height = 7.8;
  },
  carob: (g) => {
    const bark = FOL(0x6a5a4a), lf = FOL(0x34521f), lf2 = FOL(0x3e5e26);
    beam(g, [0, -0.3, 0], [0.2, 1.8, 0], 0.38, bark, 7, 0.3);
    beam(g, [0.2, 1.6, 0], [1.4, 3.0, 0.5], 0.2, bark, 6, 0.12); beam(g, [0.2, 1.6, 0], [-1.2, 3.0, -0.4], 0.2, bark, 6, 0.12);
    P(g, blob(2.6, 1, 81, 0.7), lf, 0, 3.7, 0);
    P(g, blob(1.6, 1, 82, 0.7), lf2, 1.8, 3.2, 0.6); P(g, blob(1.6, 1, 83, 0.7), lf2, -1.7, 3.3, -0.7); P(g, blob(1.4, 0, 84, 0.8), lf, 0.3, 4.9, -0.4);
    const pod = M(0x3a2214), rr = rng(85);
    for (let i = 0; i < 16; i++) { const a = rr() * TAU, r = 1.6 + rr() * 1.2; P(g, box(0.035, 0.2, 0.012), pod, Math.cos(a) * r, 2.25 + rr() * 0.4, Math.sin(a) * r, 0.1, a, 0.3).castShadow = false; }
    g.userData.height = 5.6;
  },
  myrtle: (g) => {
    const lf = FOL(0x34502a), lf2 = FOL(0x3e5e30);
    for (let i = 0; i < 4; i++) beam(g, [0, 0, 0], [Math.cos(i * 1.6) * 0.4, 1.0, Math.sin(i * 1.6) * 0.4], 0.04, M(0x6a5038), 4, 0.025);
    for (const [x, y, z, r, s] of [[0, 0.8, 0, 0.75, 1], [0.35, 1.35, 0.1, 0.6, 2], [-0.3, 1.4, -0.15, 0.55, 3], [0, 1.8, 0, 0.42, 4]]) P(g, blob(r, 1, 90 + s, 0.85), s % 2 ? lf : lf2, x, y, z);
    dots(g, 0, 1.25, 0, 0.75, 0.75, 0.75, 16, oct(0.035), [M(0xf8f4ee)], 91);
    dots(g, 0, 1.2, 0, 0.72, 0.7, 0.72, 10, sph(0.03, 5, 3), [M(0x2a2a4a)], 92);
    g.userData.height = 2.1;
  },
  oleander: (g) => {
    const st = M(0x6a7a4a), lf = M(0x4a6a32, DS), rr = rng(95);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rr(), lean = 0.08 + rr() * 0.25, h = 2.0 + rr() * 1.0;
      const tip = [Math.sin(lean) * Math.cos(a) * h, Math.cos(lean) * h, Math.sin(lean) * Math.sin(a) * h];
      beam(g, [Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1], tip, 0.025, st, 4, 0.015);
      for (const k of [0.55, 0.8]) tuft(g, tip[0] * k, tip[2] * k, 5, 0.32, 0.07, lf, 0.6, 1.2, 96 + i, tip[1] * k);
      tuft(g, tip[0], tip[2], 6, 0.3, 0.07, lf, 0.5, 1.1, 120 + i, tip[1] - 0.05);
      P(g, blob(0.2, 0, 130 + i, 0.6), FOL(i % 3 ? 0xe07a9a : 0xf0a8c0), tip[0], tip[1] + 0.08, tip[2]);
    }
    g.userData.height = 3.0;
  },
  saffron: (g) => {
    const gr = M(0x5a8a3a, DS), pet = M(0x9a6ac8, DS);
    tuft(g, 0, 0, 10, 0.22, 0.012, gr, 0.05, 0.4, 140);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7, x = Math.cos(a) * 0.04, z = Math.sin(a) * 0.04, h = 0.1 + (i % 2) * 0.03;
      P(g, cyl(0.003, 0.003, h, 3), M(0xe8e0d0), x, h / 2, z);
      P(g, cyl(0.035, 0.006, 0.05, 6, true), pet, x, h + 0.02, z);
      for (let k = 0; k < 3; k++) P(g, box(0.003, 0.04, 0.003), M(0xd83018), x + Math.cos(k * 2.1) * 0.008, h + 0.04, z + Math.sin(k * 2.1) * 0.008, Math.sin(k * 2.1) * 0.5, 0, -Math.cos(k * 2.1) * 0.5).castShadow = false;
    }
    g.userData.height = 0.22;
  },
  papyrus_s: (g) => {
    const st = M(0x5a8a3a), hd = M(0x8aa84a, DS), rr = rng(150);
    for (let i = 0; i < 15; i++) {
      const a = i * 2.4, r = 0.06 + (i % 4) * 0.08, h = 2.0 + rr() * 1.3, lean = 0.08 + r * 0.6;
      const tip = [Math.cos(a) * (r + Math.sin(lean) * h), Math.cos(lean) * h, Math.sin(a) * (r + Math.sin(lean) * h)];
      beam(g, [Math.cos(a) * r * 0.5, -0.1, Math.sin(a) * r * 0.5], tip, 0.022, st, 3, 0.012);
      P(g, G('ecoUmbel', () => new THREE.ConeGeometry(0.3, 0.32, 7, 1, true)), hd, tip[0], tip[1] + 0.05, tip[2], PI, 0, 0).castShadow = false;
      if (i % 3 === 0) P(g, oct(0.06), FOL(0xa8a050), tip[0], tip[1] + 0.2, tip[2]);
    }
    tuft(g, 0, 0, 8, 0.4, 0.06, M(0x6a8a3a, DS), 0.4, 1.0, 151);
    g.userData.height = 3.2;
  },
  sea_lavender: (g) => {
    const lf = M(0x5a7a4a, DS), st = M(0x7a8a5a), fl = [M(0x9a8ad8), M(0xb0a0e0), M(0x8a7ac8)];
    tuft(g, 0, 0, 7, 0.16, 0.07, lf, 1.1, 1.35, 160, 0, 0.2);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26, tip = [Math.cos(a) * 0.16, 0.42 + (i % 2) * 0.08, Math.sin(a) * 0.16];
      beam(g, [0, 0.02, 0], tip, 0.006, st, 3);
      for (let k = 0; k < 3; k++) { const b = a + (k - 1) * 0.7, t2 = [tip[0] + Math.cos(b) * 0.09, tip[1] + 0.03, tip[2] + Math.sin(b) * 0.09]; beam(g, tip, t2, 0.004, st, 3); P(g, ico(0.025, 0), fl[(i + k) % 3], ...t2).castShadow = false; P(g, ico(0.02, 0), fl[k % 3], (tip[0] + t2[0]) / 2, tip[1] + 0.01, (tip[2] + t2[2]) / 2).castShadow = false; }
    }
    g.userData.height = 0.52;
  },
  wild_fig: (g) => {
    const bark = M(0x9a948a), lf = FOL(0x5e8a3a), lf2 = FOL(0x6a9440);
    beam(g, [0, -0.3, 0], [0.1, 1.4, 0], 0.2, bark, 6, 0.16);
    for (const [x, y, z] of [[1.3, 2.6, 0.4], [-1.1, 2.7, -0.3], [0.2, 3.0, -1.0], [-0.2, 2.9, 1.0]]) beam(g, [0.1, 1.3, 0], [x, y, z], 0.12, bark, 5, 0.06);
    for (const [x, y, z, r, s] of [[1.4, 3.0, 0.4, 1.1, 1], [-1.2, 3.1, -0.3, 1.1, 2], [0.2, 3.4, -1.0, 1.0, 3], [-0.2, 3.2, 1.1, 1.0, 4], [0.1, 3.6, 0.1, 1.1, 5]]) P(g, blob(r, 1, 170 + s, 0.75, 0.3), s % 2 ? lf : lf2, x, y, z);
    dots(g, 0, 3.0, 0, 1.9, 0.6, 1.9, 10, sph(0.035, 5, 4), [M(0x6a4a5a), M(0x7a8a3a)], 171, -0.6);
    g.userData.height = 4.3;
  },
  strawberry_tree: (g) => {
    const bark = M(0x8a3a24), lf = FOL(0x34522a), lf2 = FOL(0x3e5e30);
    beam(g, [0, -0.3, 0], [0.2, 1.5, 0.1], 0.16, bark, 6, 0.12);
    beam(g, [0.2, 1.3, 0.1], [1.0, 2.8, 0.3], 0.1, bark, 5, 0.06); beam(g, [0.2, 1.3, 0.1], [-0.8, 3.0, -0.2], 0.1, bark, 5, 0.06); beam(g, [0.2, 1.5, 0.1], [0.1, 3.4, -0.7], 0.08, bark, 5, 0.05);
    for (const [x, y, z, r, s] of [[1.1, 3.3, 0.3, 1.0, 1], [-0.9, 3.5, -0.2, 1.0, 2], [0.1, 3.9, -0.7, 0.9, 3], [0.1, 4.2, 0.3, 0.9, 4]]) P(g, blob(r, 1, 180 + s, 0.85), s % 2 ? lf : lf2, x, y, z);
    dots(g, 0.1, 3.7, 0, 1.6, 0.9, 1.4, 22, ico(0.045, 0), [M(0xd83a1a), M(0xe87a1a), M(0xe8c040)], 181);
    g.userData.height = 5.0;
  },
  juniper: (g) => {
    beam(g, [0, -0.2, 0], [0, 0.6, 0], 0.12, M(0x6a4a30), 5, 0.1);
    P(g, G('ecoJunCone', () => lumpy(new THREE.ConeGeometry(1.0, 2.6, 9, 3), 0.15, 9)), FOL(0x4a5e3a), 0, 1.75, 0);
    P(g, blob(0.7, 0, 191, 0.8), FOL(0x55684a), 0.4, 0.9, 0.2); P(g, blob(0.6, 0, 192, 0.8), FOL(0x4a5e3a), -0.4, 1.0, -0.3);
    dots(g, 0, 1.4, 0, 0.75, 1.1, 0.75, 14, sph(0.025, 5, 3), [M(0x8a3a20), M(0x6a4a30)], 193);
    g.userData.height = 3.0;
  },
  rosemary: (g) => {
    const lf = FOL(0x5a7a5a), lf2 = FOL(0x6a8a68), tw = M(0x5a7058);
    for (const [x, y, z, r, s] of [[0, 0.4, 0, 0.5, 1], [0.35, 0.55, 0.1, 0.38, 2], [-0.3, 0.6, -0.1, 0.36, 3]]) P(g, blob(r, 1, 200 + s, 0.8, 0.3), s % 2 ? lf : lf2, x, y, z);
    const rr = rng(201);
    for (let i = 0; i < 14; i++) { const a = rr() * TAU, r = rr() * 0.4; beam(g, [Math.cos(a) * r, 0.5, Math.sin(a) * r], [Math.cos(a) * (r + 0.1), 0.85 + rr() * 0.2, Math.sin(a) * (r + 0.1)], 0.012, tw, 3); }
    dots(g, 0, 0.6, 0, 0.55, 0.38, 0.5, 18, oct(0.02), [M(0xa8b8e8), M(0xc0c8f0)], 202, 0.1);
    g.userData.height = 1.0;
  },
  thyme: (g) => {
    P(g, blob(0.25, 1, 210, 0.5, 0.25), FOL(0x6a7a4a), 0, 0.1, 0); P(g, blob(0.17, 0, 211, 0.55), FOL(0x7a8a54), 0.2, 0.08, 0.1);
    dots(g, 0.05, 0.12, 0.03, 0.27, 0.14, 0.24, 22, oct(0.016), [M(0xc890c8), M(0xd8a8d8), M(0xb878b8)], 212, 0.2);
    g.userData.height = 0.3;
  },
  mastic: (g) => {
    const lf = FOL(0x3a5a2e), lf2 = FOL(0x46663a);
    for (let i = 0; i < 3; i++) beam(g, [0, 0, 0], [Math.cos(i * 2.1) * 0.5, 1.0, Math.sin(i * 2.1) * 0.5], 0.06, M(0x6a5444), 4, 0.04);
    for (const [x, y, z, r, s] of [[0, 1.0, 0, 1.0, 1], [0.7, 1.2, 0.3, 0.8, 2], [-0.7, 1.1, -0.2, 0.85, 3], [0.1, 1.8, -0.1, 0.75, 4]]) P(g, blob(r, 1, 220 + s, 0.8), s % 2 ? lf : lf2, x, y, z);
    dots(g, 0, 1.3, 0, 1.25, 0.9, 1.2, 24, sph(0.028, 5, 3), [M(0xb83a2a), M(0xd8502a), M(0x2a1a1a)], 223);
    g.userData.height = 2.5;
  },
  giant_fennel: (g) => {
    const lf = M(0x7aa04a, DS), st = M(0x7a9a4a), yl = FOL(0xd8c030);
    tuft(g, 0, 0, 16, 0.6, 0.18, lf, 0.6, 1.3, 230);
    beam(g, [0, 0, 0], [0.05, 2.4, 0], 0.045, st, 6, 0.025);
    P(g, ico(0.2, 0), yl, 0.05, 2.5, 0, 0, 0, 0, 1, 0.45, 1);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3, y0 = 1.3 + i * 0.2, tip = [Math.cos(a) * 0.45, y0 + 0.35, Math.sin(a) * 0.45];
      beam(g, [0.02, y0, 0], tip, 0.015, st, 4);
      for (let k = 0; k < 5; k++) beam(g, tip, [tip[0] + Math.cos(k * 1.26) * 0.12, tip[1] + 0.1, tip[2] + Math.sin(k * 1.26) * 0.12], 0.004, st, 3);
      P(g, ico(0.13, 0), yl, tip[0], tip[1] + 0.12, tip[2], 0, 0, 0, 1, 0.4, 1);
    }
    g.userData.height = 2.6;
  },
  sea_daffodil: (g) => {
    const lf = M(0x7a9a8a, DS), wh = M(0xf8f6f0, DS);
    tuft(g, 0, 0, 9, 0.35, 0.05, lf, 0.3, 0.9, 240);
    for (let i = 0; i < 2; i++) {
      const sx = i ? 0.05 : -0.04, h = 0.38 + i * 0.05;
      beam(g, [sx, 0, 0], [sx, h, 0.02], 0.007, M(0x7a9a7a), 4);
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + i, fl = grp(g, sx + Math.cos(a) * 0.05, h + 0.02, 0.02 + Math.sin(a) * 0.05, 0, -a, 0);
        const fh = grp(fl, 0, 0, 0, 0, 0, 1.0);
        P(fh, cyl(0.03, 0.008, 0.07, 7, true), wh, 0, 0.045, 0);
        for (let p = 0; p < 6; p++) P(fh, box(0.008, 0.07, 0.003), wh, Math.cos(p * PI / 3) * 0.015, 0.03, Math.sin(p * PI / 3) * 0.015, Math.sin(p * PI / 3) * 0.6, 0, -Math.cos(p * PI / 3) * 0.6).castShadow = false;
      }
    }
    g.userData.height = 0.45;
  },
  aloe: (g) => {
    const lf = FOL(0x6a8a6a), lf2 = FOL(0x7a9a72), rr = rng(250);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU * 2 + rr(), lean = i < 5 ? 0.25 + rr() * 0.2 : 0.6 + rr() * 0.5, h = 0.45 + rr() * 0.2;
      const m = P(g, cone(0.055, 1, 4), i % 2 ? lf : lf2, 0, 0, 0);
      m.scale.set(1, h, 0.45);
      m.quaternion.setFromUnitVectors(UP, _bd.set(Math.sin(lean) * Math.cos(a), Math.cos(lean), Math.sin(lean) * Math.sin(a)));
      m.position.set(Math.sin(lean) * Math.cos(a) * h * 0.5, Math.cos(lean) * h * 0.5, Math.sin(lean) * Math.sin(a) * h * 0.5);
    }
    beam(g, [0, 0.2, 0], [0.05, 0.95, 0], 0.012, M(0x7a8a5a), 4);
    P(g, cyl(0.025, 0.05, 0.28, 7), M(0xe8902a), 0.05, 1.05, 0);
    P(g, cone(0.025, 0.08, 6), M(0xe8b040), 0.05, 1.23, 0);
    g.userData.height = 1.25;
  },
  cistus: (g) => {
    for (const [x, y, z, r, s] of [[0, 0.45, 0, 0.5, 1], [0.35, 0.5, 0.15, 0.38, 2], [-0.3, 0.55, -0.15, 0.36, 3]]) P(g, blob(r, 1, 260 + s, 0.8), FOL(s % 2 ? 0x5a7a4a : 0x6a8456), x, y, z);
    const rr = rng(261), pk = M(0xe89ab8, DS), pk2 = M(0xf0b4cc, DS), yc = M(0xe8c030);
    for (let i = 0; i < 11; i++) {
      const a = rr() * TAU, v = 0.2 + rr() * 0.8, c = Math.sqrt(1 - v * v);
      const fl = grp(g, Math.cos(a) * c * 0.55, 0.5 + v * 0.42, Math.sin(a) * c * 0.5);
      fl.quaternion.setFromUnitVectors(UP, _bd.set(Math.cos(a) * c, v, Math.sin(a) * c));
      P(fl, cyl(0.045, 0.045, 0.006, 5), i % 2 ? pk : pk2, 0, 0.01, 0).castShadow = false;
      P(fl, cyl(0.012, 0.012, 0.012, 5), yc, 0, 0.015, 0).castShadow = false;
    }
    g.userData.height = 1.0;
  },
};
export const PLANTS = Object.keys(PL);
export function makePlant(kind = 'myrtle') {
  const g = new THREE.Group(); g.name = 'plant_' + kind;
  (PL[kind] || PL.myrtle)(g);
  g.userData.kind = kind;
  return g;
}

// ======================================================================
// Реестр
// ======================================================================
export const ECO_R = { insula: 6, balneum: 6, popina: 5, fullonica: 6, officina: 5, navalia: 12, murex_farm: 7, villa: 14, emporium: 9, statio: 8, metallum: 7, lapicidina: 8, salinae: 8, sulfur: 7, alvearia: 5, silva_cut: 7, campus: 12, praetorium: 10, horreum_s: 6 };
export const ECO_MODELS = Object.keys(ECO_R);
