// Insula Deserta: Империя — городские процедурные модели (Мессана, Сицилия, 264 г. до н. э.).
// Подключается после models.js: регистрирует BUILD.*, POI.*, SHIPDEF.penteres и экспортирует отдельные конструкторы.
// Соглашения те же: начало координат — центр на уровне земли, +Z — «лицо» (к морю / улице).
// Коллайдеры: userData.colliders — {x,z,w,d,ry} (w вдоль локальной X после поворота ry) или {x,z,r}.
import { H, makeShip, makeTree, makeBush } from './models.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const {
  THREE, PI, TAU, HPI, clamp, lerp, rng, G, box, cyl, sph, cone, tor, ico, lathe, rbox, extr, tube, lumpy, wuv, tbox,
  P, grp, MET, FLAME, EMB, bronzeM, ironM, steelM, goldM, canvasTex, TM, ASH, TILE, PLANK, BRICK, THATCH, FOL,
  amphora, dolium, crate, sack, barrel, brazier, bench, table, banner, column, stairs, statue, rope,
  B, colB, colC, WATER, plinth, wall, door, win, gable, shed, post, colRow, basin, statera, C, M, VLight, BUILD, POI, SHIPDEF,
} = H;

// ---------- мелкие утилиты ----------
const hstr = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 1000003) + 1; };
const newRoot = (name, extra = {}) => { const g = new THREE.Group(); g.name = name; g.userData = { colliders: [], ...extra }; return g; };
// брус между двумя точками на плоскости XZ (стена, перила), локальная X — вдоль отрезка
function beam(par, x0, z0, x1, z1, y, h, t, mat) {
  const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
  P(par, box(len, h, t), mat, (x0 + x1) / 2, y + h / 2, (z0 + z1) / 2, 0, ry, 0);
  return { len, ry, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
}
const MC = new Map();
const texMat = (key, texFn, color = 0xffffff, opts = {}) => {
  const k = key + color + JSON.stringify(opts);
  if (!MC.has(k)) MC.set(k, new THREE.MeshStandardMaterial({ map: texFn(), color, roughness: 0.9, metalness: 0, ...opts }));
  return MC.get(k);
};

// ---------- процедурные текстуры ----------
// базальтовая полигональная мостовая (вороной-ячейки, бесшовно)
function drawBasalt(x, n, r) {
  const N = 8, pts = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) pts.push([((i + 0.2 + r() * 0.6) / N) * n, ((j + 0.2 + r() * 0.6) / N) * n, 0.78 + r() * 0.42]);
  const img = x.createImageData(n, n), d = img.data;
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
    let d1 = 1e9, d2 = 1e9, k1 = 0;
    const ci = Math.floor((px / n) * N), cj = Math.floor((py / n) * N);
    for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
      const ii = (ci + di + N) % N, jj = (cj + dj + N) % N, p = pts[ii * N + jj];
      let dx = p[0] - px, dy = p[1] - py; dx -= Math.round(dx / n) * n; dy -= Math.round(dy / n) * n;
      const dd = dx * dx + dy * dy;
      if (dd < d1) { d2 = d1; d1 = dd; k1 = ii * N + jj; } else if (dd < d2) d2 = dd;
    }
    const e = Math.sqrt(d2) - Math.sqrt(d1), s = pts[k1][2], o = (py * n + px) * 4;
    const v = e < 2.4 ? 0.42 : s * (0.94 + 0.06 * Math.sin(px * 1.7 + py * 2.3)) * (e < 4 ? 0.85 : 1);
    d[o] = 104 * v; d[o + 1] = 100 * v; d[o + 2] = 96 * v; d[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
}
// прямоугольные плиты (травертин/известняк) рядами
function drawFlags(x, n, r) {
  x.fillStyle = '#9a917e'; x.fillRect(0, 0, n, n);
  const rows = 6, rh = n / rows;
  for (let j = 0; j < rows; j++) {
    let px = 0;
    while (px < n - 2) {
      const w = Math.min(n - px, rh * (1.0 + r() * 1.4));
      const k = 0.9 + r() * 0.12, c = (v) => Math.round(v * k);
      x.fillStyle = `rgb(${c(224)},${c(214)},${c(192)})`;
      x.fillRect(px + 1, j * rh + 1, w - 2, rh - 2);
      if (r() < 0.3) { x.fillStyle = 'rgba(120,110,90,0.15)'; x.fillRect(px + 1 + r() * w * 0.5, j * rh + 2 + r() * rh * 0.5, w * 0.3, rh * 0.25); }
      px += w;
    }
  }
}
const basaltTex = () => canvasTex('c_basalt', 256, drawBasalt, 3.2);
const flagsTex = () => canvasTex('c_flags', 256, drawFlags, 6);
const walkTex = () => canvasTex('c_walk', 128, drawFlags, 2.4);
const BASALT = () => texMat('basalt', basaltTex, 0xffffff);
const FLAGS = (c = 0xffffff) => texMat('flags', flagsTex, c);
const WALK = () => texMat('walk', walkTex, 0xe4dccb);

// знак Танит (треугольник-тело, перекладина-руки, диск-голова) — рельеф
function tanitSign(par, x, y, z, s = 1, mat = null, ry = 0) {
  const g = grp(par, x, y, z, 0, ry, 0); g.scale.setScalar(s);
  const m = mat || M(0xe8d8a0);
  P(g, extr('cTanitTri', [[-0.32, 0], [0.32, 0], [0, 0.62]], 0.04, 0), m, 0, 0, 0);
  P(g, box(0.62, 0.08, 0.04), m, 0, 0.62, 0);
  for (const sx of [-1, 1]) P(g, box(0.07, 0.16, 0.04), m, sx * 0.3, 0.7, 0);
  P(g, cyl(0.12, 0.12, 0.04, 12), m, 0, 0.82, 0, HPI);
  return g;
}

// ======================================================================
// 1. Большой форум Мессаны (72 × 52 м)
// ======================================================================
BUILD.forum_m = (g, o = {}) => {
  const W = 72, D = 52, y = 0.2;
  P(g, tbox(W, y + 1.5, D), FLAGS(), 0, (y - 1.5) / 2, 0);
  P(g, box(W + 0.2, 0.08, D + 0.2), M(C.stoneD), 0, y - 0.06, 0);
  // рамка свободной середины 40 × 24 (место для прилавков)
  const bandM = M(0xb4a68a);
  for (const s of [-1, 1]) { P(g, box(40.6, 0.02, 0.3), bandM, 0, y + 0.01, s * 12.15); P(g, box(0.3, 0.02, 24.6), bandM, s * 20.15, y + 0.01, 0); }
  // портики вдоль длинных сторон (z = ±): колоннада, архитрав, кровля, глухая задняя стена с входом посередине
  for (const s of [-1, 1]) {
    const zB = s * 25.4, gap = s > 0 ? 8 : 5, L = W / 2 - gap / 2;
    // вместо глухой задней стены — второй ряд колонн (двойной портик, сквозной)
    colRow(g, -34, zB, 34, zB, 18, y, 7.2, 0.4, 'doric', M(C.marble));
    P(g, box(70.4, 0.7, 1.0), M(C.marble), 0, y + 7.4, zB);
    colRow(g, -34, s * 19.6, 34, s * 19.6, 18, y, 6.2, 0.36, 'ionic', M(C.marble));
    P(g, box(70.4, 0.7, 0.95), M(C.marble), 0, y + 6.4, s * 19.6);
    P(g, box(70.6, 0.2, 1.05), M(0xe0d8c8), 0, y + 6.82, s * 19.6);
    shed(g, 0, y + 7.45, s * 22.5, W, 6.4, 0.9, s > 0 ? PI : 0);
    P(g, box(W - 1, 0.1, 5.8), M(0xcfc3aa), 0, y + 6.75, s * 22.5);   // потолок портика
    stairs(g, 0, y, s * 26.05, gap, 1, 0.18, 0.5, s > 0 ? 0 : PI);
  }
  // ростры (−X): высокий помост, носы трофейных кораблей на фасаде, лестница сзади
  const ro = grp(g, -29, y, 0);
  P(ro, tbox(6, 3, 12), TM('ashlar', 0xf0eadc), 0, 1.5, 0);
  P(ro, box(6.3, 0.3, 12.3), M(C.stone), 0, 0.15, 0);
  P(ro, box(6.3, 0.25, 12.3), M(C.marble), 0, 3.0, 0);
  P(ro, box(5.9, 0.04, 11.9), M(0xe6dccb), 0, 3.14, 0);
  const brz = bronzeM(), brD = MET(0x7a5a2a, 0.45, 0.8);
  for (let i = 0; i < 6; i++) {
    const pr = grp(ro, 3.05, 1.7, -5 + i * 2);
    P(pr, cone(0.24, 1.1, 4), brz, 0.55, 0, 0, 0, PI / 4, -HPI).scale.set(1, 1, 0.7);
    for (const yy of [-0.12, 0.0, 0.12]) P(pr, box(0.8, 0.04, 0.42), brz, 0.35, yy, 0);
    P(pr, box(0.22, 1.1, 0.36), brD, 0.05, 0.25, 0);
    P(pr, tube(`cRoProw${i % 2}`, [[0.0, 0.7, 0], [0.12, 1.0, 0], [0.05, 1.3, 0], [-0.12, 1.35, 0]], 0.06, 0.03, 6, 5), brD, 0, 0, 0);
  }
  for (let i = 0; i < 12; i++) P(ro, cyl(0.03, 0.03, 0.9, 6), brz, 2.85, 3.6, -5.5 + i * 1.0);
  P(ro, cyl(0.035, 0.035, 11.2, 6), brz, 2.85, 4.05, 0, HPI);
  stairs(ro, -3, 3.0, 0, 4, 9, 3 / 9, 0.36, -HPI);
  statue(ro, 1.6, 3.15, -5, 0.75, bronzeM(), HPI);
  statue(ro, 1.6, 3.15, 5, 0.75, bronzeM(), HPI);
  banner(ro, -2.4, 3.15, -5.6, 4.2, HPI); banner(ro, -2.4, 3.15, 5.6, 4.2, HPI);
  // ограждение ростр: подняться можно только по лестнице сзади
  colB(g, -25.95, 0, 0.4, 12.3); for (const s of [-1, 1]) { colB(g, -29, s * 6.0, 6.3, 0.4); colB(g, -32.05, s * 4.1, 0.4, 4.1); colB(g, -33.7, s * 2.2, 3.4, 0.3); }
  // комиций / сэпты (+X): параллельные коридоры для голосования, урны, трибунал
  const wdR = M(C.woodL), wdP = M(C.woodD);
  for (let k = 0; k < 8; k++) {
    const z = -7 + k * 2;
    for (let i = 0; i < 5; i++) P(g, cyl(0.06, 0.07, 1.2, 6), wdP, 22.5 + i * 2, y + 0.6, z);
    for (const yy of [0.55, 1.05]) P(g, box(8.1, 0.07, 0.07), wdR, 26.5, y + yy, z);
    colB(g, 26.5, z, 8.2, 0.2);
  }
  // «мостки» в конце каждого коридора
  for (let k = 0; k < 7; k++) P(g, box(1.4, 0.25, 1.6), PLANK(), 31.2, y + 0.12, -6 + k * 2);
  plinth(g, 33.6, 0, 3.2, 9, y + 1.0, TM('ashlar', 0xe8e0cc));
  stairs(g, 33.6, y + 1.0, 4.5, 2.4, 3, 0.33, 0.33);
  table(g, 33.2, y + 1.0, 0, 2.2, 0.8, HPI);
  // курульное кресло
  const cu = grp(g, 34.4, y + 1.0, 0, 0, -HPI, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(cu, box(0.05, 0.62, 0.05), M(0xe8e0d0), sx * 0.22, 0.28, 0, sz * 0.5, 0, 0);
  P(cu, box(0.56, 0.06, 0.46), M(0x9a2a22), 0, 0.55, 0);
  for (const z of [-4.2, 0, 4.2]) {
    P(g, cyl(0.28, 0.32, 0.8, 10), M(C.stone), 31.0, y + 0.4, z + (z === 0 ? 0 : 0));
    P(g, lathe('cCista', [[0, 0], [0.2, 0], [0.24, 0.35], [0.2, 0.5], [0.08, 0.55], [0, 0.55]], 10), MET(0x9a7a3a, 0.45, 0.7), 31.0, y + 0.8, z);
    colC(g, 31.0, z, 0.35);
  }
  colB(g, 33.6, 0, 3.2, 9);
  // статуи на постаментах и алтарь
  statue(g, -12, y, 15.5, 1.2, M(0xe8e2d4), PI); colC(g, -12, 15.5, 0.8);
  statue(g, 12, y, 15.5, 1.2, bronzeM(), PI); colC(g, 12, 15.5, 0.8);
  P(g, tbox(2.2, 1.2, 2.2), TM('ashlar', 0xe8e0cc), -24, y + 0.6, -14);
  statue(g, -24, y + 1.2, -14, 1.35, MET(0xb89a4a, 0.35, 0.9), 0); colC(g, -24, -14, 1.2);
  const al = grp(g, 0, y, -15.5);
  P(al, rbox(1.8, 1.0, 1.1, 0.04), M(C.marble), 0, 0.5, 0); P(al, box(2.0, 0.12, 1.3), M(C.marble), 0, 1.06, 0);
  for (const s of [-1, 1]) P(al, cyl(0.13, 0.13, 1.1, 10), M(C.marble), s * 0.8, 1.17, 0, HPI);
  P(al, box(1.4, 0.4, 0.04), M(0x9a2a22), 0, 0.6, 0.56);
  P(al, ico(0.2, 0), EMB(), 0, 1.22, 0); P(al, cone(0.17, 0.45, 6), FLAME(), 0, 1.45, 0).castShadow = false;
  const l = new VLight(0xffa040, 5, 10, 1.6); l.position.set(0, 1.9, 0); al.add(l);
  colB(g, 0, -15.5, 2.0, 1.3);
  for (const sx of [-1, 1]) brazier(g, sx * 18, y, -17.5, 1, 4, 10);
  if ((o.level || 1) >= 2) for (const sx of [-1, 1]) banner(g, sx * 4.6, y, 24.4, 5, 0);
};

// ======================================================================
// 2. Курия (здание совета)
// ======================================================================
BUILD.curia = (g) => {
  const ph = 1.2, Wd = 10, Dp = 12, Hh = 9.5, cz = -1.5, zf = cz + Dp / 2;
  plinth(g, 0, cz, Wd + 0.6, Dp + 0.6, ph, TM('ashlar', 0xe8e0cc));
  wall(g, 0, ph, cz, Wd, Hh, Dp, 0, { mat: BRICK(), dado: false });
  // травертиновые пилястры и цоколь
  const trv = M(0xe4dac4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(g, box(0.7, Hh, 0.7), trv, sx * (Wd / 2 - 0.25), ph + Hh / 2, cz + sz * (Dp / 2 - 0.25));
  P(g, box(Wd + 0.12, 0.9, Dp + 0.12), trv, 0, ph + 0.45, cz);
  P(g, box(Wd + 0.3, 0.35, Dp + 0.3), M(C.stone), 0, ph + Hh - 0.6, cz);
  // высокие бронзовые двери
  const brz = MET(0x9a7a3a, 0.4, 0.85), brD = MET(0x6a5228, 0.5, 0.8), mar = M(C.marble);
  const dh = 5.4, dw = 3.0;
  for (const sx of [-1, 1]) P(g, box(0.5, dh + 0.2, 0.4), mar, sx * (dw / 2 + 0.25), ph + (dh + 0.2) / 2, zf + 0.12);
  P(g, box(dw + 1.4, 0.6, 0.5), mar, 0, ph + dh + 0.5, zf + 0.14);
  P(g, box(dw, dh, 0.06), M(0x140e0a), 0, ph + dh / 2, zf + 0.01);
  for (const sx of [-1, 1]) {
    const lf = grp(g, sx * dw / 4, ph, zf + 0.08);
    P(lf, rbox(dw / 2 - 0.04, dh - 0.04, 0.12, 0.02), brz, 0, dh / 2, 0);
    for (const yy of [0.9, 2.5, 4.1]) P(lf, box(dw / 2 - 0.4, 1.2, 0.05), brD, 0, yy + 0.3, 0.07);
    for (let i = 0; i < 4; i++) for (const yy of [0.5, 2.1, 3.7, 5.2]) P(lf, sph(0.04, 6, 4), brz, -dw / 4 + 0.25 + i * ((dw / 2 - 0.5) / 3), yy, 0.08);
    P(lf, tor(0.12, 0.02, 4, 12), brz, -sx * (dw / 4 - 0.25), 2.7, 0.1);
  }
  for (let i = -1; i <= 1; i++) win(g, i * 2.6, ph + 7.4, zf + 0.02, 0, 1.0, 1.6);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) win(g, sx * (Wd / 2 + 0.02), ph + 7.4, cz - 3.5 + i * 3.5, sx * HPI, 0.9, 1.4);
  P(g, box(4.6, 0.55, 0.06), mar, 0, ph + 8.75, zf + 0.03);
  P(g, box(4.2, 0.08, 0.07), M(0x9a2a22), 0, ph + 8.75, zf + 0.04);
  gable(g, 0, ph + Hh, cz, Wd, Dp, 0.3, 0.45, 'z', { gableCol: C.plaster });
  P(g, box(Wd + 0.9, 0.3, 0.5), M(C.stone), 0, ph + Hh + 0.05, zf + 0.3);
  P(g, sph(0.3, 8, 6), goldM(), 0, ph + Hh + 5 * Math.tan(0.3) + 0.55, zf + 0.35);
  stairs(g, 0, ph, cz + (Dp + 0.6) / 2, 6.0, 4, ph / 4, 0.42);
  for (const sx of [-1, 1]) { P(g, box(0.8, ph, 1.8), TM('ashlar', 0xe8e0cc), sx * 3.4, ph / 2, zf + 1.2); brazier(g, sx * 3.4, ph, zf + 1.0, 0.9, 4, 9); }
  colB(g, 0, cz, Wd + 0.6, Dp + 0.6);
};

// ======================================================================
// 3. Рыночный прилавок (opts.cls 0..7)
// ======================================================================
const STALL_COL = [0xc8a050, 0x9a3a22, 0x2a6a9a, 0xd8c8a0, 0x6a625a, 0xb86a30, 0x4a7a2a, 0x5e1f5a];
const basket = (par, x, y, z, r = 0.24, h = 0.18) => P(par, cyl(r, r * 0.8, h, 10), M(0xa88a50), x, y + h / 2, z);
BUILD.stall = (g, o = {}) => {
  const cls = (((o.cls | 0) % 8) + 8) % 8, col = STALL_COL[cls], r = rng(101 + cls * 17);
  const wdD = M(C.woodD), top = 1.0, zc = 0.9;
  P(g, tbox(3.6, 0.95, 0.8), PLANK(), 0, 0.475, zc);
  P(g, box(3.8, 0.06, 0.95), M(C.woodL), 0, 0.97, zc);
  for (const sx of [-1, 1]) { post(g, sx * 1.85, 0, 1.4, 2.55, 0.06, wdD); post(g, sx * 1.85, 0, -1.4, 3.0, 0.06, wdD); P(g, box(0.06, 0.06, 2.9), wdD, sx * 1.85, 2.74, 0.05, Math.atan2(0.45, 3.0), 0, 0); }
  // полосатый тент
  const aw = grp(g, 0, 2.82, 0.05, Math.atan2(0.45, 3.0), 0, 0), cream = M(0xeee4cc, { side: THREE.DoubleSide }), cm = M(col, { side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) P(aw, box(4.1 / 6, 0.03, 3.5), i % 2 ? cream : cm, -4.1 / 2 + (i + 0.5) * (4.1 / 6), 0, 0);
  P(aw, box(4.1, 0.28, 0.02), cm, 0, -0.14, 1.75);
  for (let i = 0; i < 8; i++) P(aw, box(0.22, 0.12, 0.02), cm, -1.8 + i * 0.514, -0.33, 1.75);
  // задняя полка
  P(g, box(3.4, 0.07, 0.55), M(C.woodL), 0, 0.85, -0.95);
  for (const sx of [-1, 1]) P(g, box(0.06, 0.85, 0.5), wdD, sx * 1.6, 0.42, -0.95);
  const T = top + 0.01;
  switch (cls) {
    case 0: { // хлеб и зерно
      for (let i = 0; i < 9; i++) { const row = i >= 5 ? 1 : 0; P(g, sph(0.13, 8, 6), M(i % 3 ? 0xb87a3a : 0xc89050), -1.5 + (i - row * 5) * 0.36 + row * 0.18, T + 0.05, zc + (row ? 0.17 : -0.12), 0, 0, 0, 1, 0.5, 1); }
      for (let i = 0; i < 3; i++) P(g, cyl(0.18, 0.18, 0.06, 10), M(0xa86a30), 0.7, T + 0.03 + i * 0.065, zc);
      P(g, cyl(0.22, 0.2, 0.32, 10), M(C.woodL), 1.3, T + 0.16, zc); P(g, cyl(0.2, 0.2, 0.02, 10), M(0xd8c070), 1.3, T + 0.31, zc);
      for (let i = 0; i < 4; i++) sack(g, 2.25, 0, -0.9 + i * 0.55, 0.9, i % 2 ? 0xd2be92 : 0xc8b07a, i);
      for (let i = 0; i < 4; i++) sack(g, -1.2 + i * 0.8, 0.88, -0.95, 0.7, 0xd2be92, i);
      break;
    }
    case 1: { // вино и масло
      for (let i = 0; i < 5; i++) P(g, lathe('cJug', [[0, 0], [0.08, 0], [0.11, 0.1], [0.07, 0.2], [0.04, 0.26], [0.05, 0.3], [0, 0.3]], 8), M(i % 2 ? 0xb8643c : 0x9a4a2a), -1.4 + i * 0.6, T, zc);
      for (let i = 0; i < 5; i++) amphora(g, -1.4 + i * 0.7, 0.88, -0.95, 0.9, i % 2 ? 0xb87a48 : 0x9a4a2a);
      for (let i = 0; i < 3; i++) amphora(g, 2.25, 0, -0.8 + i * 0.6, 1.2, C.terracotta);
      amphora(g, -2.2, 0.25, 0.4, 1.2, 0xb87a48, 1.2);
      break;
    }
    case 2: { // рыба на льду и в корзинах
      P(g, box(3.3, 0.08, 0.66), M(0xdcecf2, { roughness: 0.3 }), 0, T + 0.04, zc);
      const fishM = M(0x9ab0c0, { metalness: 0.4, roughness: 0.4 }), tunaM = M(0x34485e, { metalness: 0.3, roughness: 0.45 });
      for (let i = 0; i < 12; i++) P(g, sph(0.1, 8, 5), fishM, -1.45 + (i % 6) * 0.55, T + 0.12, zc + (i < 6 ? -0.15 : 0.15), 0, 0.3 + r() * 0.5, 0, 0.45, 0.32, 1.7);
      for (let i = 0; i < 2; i++) P(g, sph(0.2, 10, 6), tunaM, -0.6 + i * 1.3, T + 0.22, zc, 0, HPI + i * 0.2, 0, 0.7, 0.6, 2.6);
      for (let i = 0; i < 3; i++) { basket(g, 2.25, 0, -0.8 + i * 0.6, 0.26, 0.3); for (let k = 0; k < 3; k++) P(g, sph(0.08, 6, 4), fishM, 2.25 + (k - 1) * 0.1, 0.32, -0.8 + i * 0.6, 0, k, 0, 0.5, 0.35, 1.6); }
      break;
    }
    case 3: { // ткани в рулонах
      const cc = [0xd8c8a0, 0x9a2a22, 0x2a5a8a, 0xc89a3a, 0x3a6a2a, 0xe8e0cc, 0x7a4a2a];
      for (let i = 0; i < 7; i++) P(g, cyl(0.11, 0.11, 0.85, 10), M(cc[i]), -1.3 + (i % 4) * 0.85, T + 0.11 + (i >= 4 ? 0.2 : 0), zc + (i >= 4 ? 0 : (i % 2 ? 0.15 : -0.15)), 0, 0, HPI);
      for (let i = 0; i < 6; i++) P(g, rbox(0.5, 0.08, 0.38, 0.02), M(cc[(i + 2) % 7]), -1.2 + (i % 3) * 1.1, 0.93 + Math.floor(i / 3) * 0.09, -0.95);
      const hb = P(g, box(0.9, 1.2, 0.02), M(0x9a2a22, { side: THREE.DoubleSide }), -2.0, 1.7, -1.1, 0, HPI, 0); hb.castShadow = false;
      break;
    }
    case 4: { // железный товар и оружие
      const st = steelM(), ir = ironM(), wd = M(C.wood);
      for (let i = 0; i < 4; i++) { P(g, box(0.07, 0.015, 0.55), st, -1.5 + i * 0.22, T + 0.01, zc - 0.05, 0, 0.1, 0); P(g, box(0.1, 0.04, 0.03), M(C.bronze), -1.5 + i * 0.22, T + 0.02, zc + 0.24); P(g, cyl(0.02, 0.02, 0.13, 6), M(C.leatherD), -1.5 + i * 0.22, T + 0.02, zc + 0.32, HPI); }
      for (let i = 0; i < 2; i++) { P(g, cyl(0.02, 0.02, 0.7, 6), wd, -0.2 + i * 0.5, T + 0.02, zc, HPI, 0.3, 0); P(g, box(0.2, 0.03, 0.12), ir, -0.2 + i * 0.5 + 0.1, T + 0.03, zc - 0.32); }
      for (let i = 0; i < 2; i++) P(g, tor(0.17, 0.018, 3, 10, PI * 1.1), ir, 0.75 + i * 0.4, T + 0.02, zc, HPI, 0, 0);
      P(g, cyl(0.04, 0.05, 0.05, 6), ir, 1.5, T + 0.03, zc); P(g, box(0.3, 0.12, 0.14), ir, 1.45, T + 0.06, zc - 0.25);
      for (let i = 0; i < 3; i++) { const sp = grp(g, -1.6 + i * 0.12, 0, -1.25, -0.12, 0, 0); P(sp, cyl(0.02, 0.025, 2.2, 6), wd, 0, 1.1, 0); P(sp, cone(0.04, 0.3, 4), st, 0, 2.35, 0); }
      P(g, rbox(0.62, 1.0, 0.08, 0.03), M(0x9a2a22), 2.2, 0.55, 0.4, -0.2, -HPI, 0);
      P(g, sph(0.08, 8, 5), bronzeM(), 2.25, 0.57, 0.4);
      for (let i = 0; i < 3; i++) P(g, box(0.35, 0.05, 0.02), ir, -0.5 + i * 0.5, 2.2, -1.38, 0, 0, 0.1 * (i - 1));
      break;
    }
    case 5: { // посуда
      const pm = [0xb8643c, 0xa8573a, 0x1c1814, 0xd8a070];
      for (let i = 0; i < 6; i++) P(g, lathe('cBowl', [[0, 0], [0.08, 0], [0.16, 0.06], [0.2, 0.12], [0, 0.12]], 10), M(pm[i % 4]), -1.45 + i * 0.58, T, zc - 0.15);
      for (let i = 0; i < 5; i++) P(g, lathe('cJug2', [[0, 0], [0.07, 0], [0.12, 0.12], [0.08, 0.26], [0.05, 0.34], [0.07, 0.38], [0, 0.38]], 10), M(pm[(i + 1) % 4]), -1.2 + i * 0.6, T, zc + 0.2);
      for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) P(g, cyl(0.15, 0.1, 0.03, 10), M(pm[i % 4]), -1.2 + i * 0.8, 0.92 + k * 0.035, -0.95);
      dolium(g, 2.2, 0, -0.5, 0.75); dolium(g, 2.3, 0, 0.5, 0.6);
      break;
    }
    case 6: { // фрукты и оливки
      const fc = [0xc83a1a, 0xe0a020, 0x6a8a2a, 0x5a2a6a, 0xd8701a];
      for (let i = 0; i < 6; i++) {
        const x = -1.4 + (i % 3) * 1.1 + (i >= 3 ? 0.4 : 0), z = zc + (i >= 3 ? 0.18 : -0.15);
        basket(g, x, T, z, 0.22, 0.14);
        const olive = i === 2 || i === 4;
        for (let k = 0; k < (olive ? 9 : 5); k++) P(g, sph(olive ? 0.035 : 0.07, 6, 4), M(olive ? (k % 3 ? 0x3a4a1a : 0x1a1a10) : fc[i % 5]), x + Math.cos(k * 2.1) * (olive ? 0.12 : 0.1), T + 0.17, z + Math.sin(k * 2.1) * (olive ? 0.12 : 0.1));
      }
      for (let i = 0; i < 3; i++) { basket(g, 2.25, 0, -0.8 + i * 0.6, 0.27, 0.35); for (let k = 0; k < 4; k++) P(g, sph(0.08, 6, 4), M(fc[(i + k) % 5]), 2.25 + Math.cos(k * 1.6) * 0.1, 0.38, -0.8 + i * 0.6 + Math.sin(k * 1.6) * 0.1); }
      for (let i = 0; i < 2; i++) P(g, sph(0.09, 6, 4), M(0x4a1a4a), -0.6 + i * 1.4, 2.2, -1.38, 0, 0, 0, 1, 1.6, 1);
      break;
    }
    default: { // 7: пурпур и украшения
      for (let i = 0; i < 6; i++) P(g, rbox(0.5, 0.07, 0.36, 0.02), M(i % 2 ? 0x5e1f5a : 0x7a2a6a), -1.4 + (i % 3) * 0.55, T + 0.035 + Math.floor(i / 3) * 0.075, zc);
      P(g, box(1.1, 0.06, 0.55), M(0x3a2414), 0.9, T + 0.03, zc);
      const gm = goldM();
      for (let i = 0; i < 6; i++) P(g, tor(0.045, 0.01, 4, 10), gm, 0.5 + (i % 3) * 0.3, T + 0.07, zc - 0.12 + Math.floor(i / 3) * 0.24, HPI);
      for (let i = 0; i < 8; i++) P(g, sph(0.025, 6, 4), M([0xc02040, 0x2a6ad8, 0x20a060, 0xe8e0f0][i % 4], { roughness: 0.2 }), 0.5 + (i % 4) * 0.25, T + 0.09, zc + (i >= 4 ? 0.1 : -0.02));
      P(g, rbox(0.3, 0.18, 0.22, 0.02), M(0x6a3a22), 1.6, T + 0.09, zc);
      const hb = P(g, box(1.6, 1.3, 0.02), M(0x5e1f5a, { side: THREE.DoubleSide }), 0, 1.75, -1.4); hb.castShadow = false;
      for (let i = 0; i < 3; i++) dolium(g, -1.0 + i * 1.0, 0.88, -0.95, 0.35);
      break;
    }
  }
  colB(g, 0, zc, 3.8, 0.9);
};

// ======================================================================
// 4. Лавка оптового скупщика (mercator)
// ======================================================================
function drawMercSign(x, n) {
  x.fillStyle = '#b8863a'; x.fillRect(0, 0, n, n);
  x.save(); x.scale(n / 370, n / 100);
  x.strokeStyle = '#4a2a14'; x.lineWidth = 5; x.strokeRect(6, 8, 358, 84);
  x.fillStyle = '#3a1a0a'; x.font = 'bold 40px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('MERCATOR', 215, 52);
  // весы
  x.strokeStyle = '#3a1a0a'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(50, 22); x.lineTo(50, 80); x.moveTo(22, 34); x.lineTo(78, 34); x.moveTo(22, 34); x.lineTo(14, 58); x.moveTo(22, 34); x.lineTo(30, 58); x.moveTo(78, 34); x.lineTo(70, 58); x.moveTo(78, 34); x.lineTo(86, 58); x.stroke();
  x.beginPath(); x.arc(22, 58, 9, 0, PI); x.arc(78, 58, 9, 0, PI); x.fill();
  x.restore();
}
BUILD.mercator = (g) => {
  const y = 0.25, h = 4.0;
  plinth(g, 0, 0, 9.2, 7.4, y);
  wall(g, 0, y, -3.3, 8.8, h, 0.5); colB(g, 0, -3.3, 8.8, 0.6);
  for (const sx of [-1, 1]) { wall(g, sx * 4.15, y, 0, 0.5, h, 6.6); colB(g, sx * 4.15, 0, 0.6, 6.6); wall(g, sx * 3.55, y, 3.15, 1.2, h, 0.5); colB(g, sx * 3.55, 3.15, 1.2, 0.6); }
  P(g, box(8.8, 0.7, 0.5), M(C.plaster), 0, y + h - 0.35, 3.15);
  P(g, box(6.0, 0.25, 0.6), M(C.woodD), 0, y + h - 0.82, 3.2);
  gable(g, 0, y + h, -0.05, 8.8, 7.0, 0.34, 0.4, 'x');
  P(g, box(8.6, 0.06, 6.4), TM('plank', 0xc8a070), 0, y + 0.03, 0);
  const sm = texMat('mercSign', () => canvasTex('c_mercSign', 256, drawMercSign, 1), 0xffffff);
  P(g, box(2.8, 0.75, 0.06), sm, 0, y + h + 0.05, 3.45);
  for (const sx of [-1, 1]) P(g, box(0.05, 0.05, 0.4), ironM(), sx * 1.2, y + h + 0.3, 3.3);
  statera(g, 1.6, y, 0.6, 0); colB(g, 1.6, 0.6, 2.2, 0.4);
  for (let i = 0; i < 7; i++) sack(g, -3.2 + (i % 4) * 0.55, y + Math.floor(i / 4) * 0.45, -2.5 + (i % 2) * 0.1, 1, i % 3 ? 0xd2be92 : 0xc0a878, i);
  for (let i = 0; i < 5; i++) amphora(g, 0.6 + i * 0.6, y, -2.6, 1.1, i % 2 ? 0xb87a48 : C.terracotta);
  for (let i = 0; i < 3; i++) amphora(g, 3.4, y, -1.6 + i * 0.6, 1.0, 0x9a4a2a);
  crate(g, -3.2, y, 0.2, 1, 0.2); crate(g, -3.2, y + 0.6, 0.25, 0.85, -0.1); crate(g, -3.0, y, 1.2, 1, 0.5);
  table(g, -1.4, y, 1.6, 1.6, 0.7, 0);
  for (let i = 0; i < 8; i++) P(g, cyl(0.03, 0.03, 0.008, 8), MET(i % 3 ? 0xd8dce0 : 0xd8b040, 0.3, 1), -1.7 + (i % 4) * 0.05, y + 0.8 + Math.floor(i / 4) * 0.008, 1.5);
  P(g, box(0.3, 0.02, 0.22), M(0x3a2414), -1.0, y + 0.8, 1.6);
  colB(g, -1.4, 1.6, 1.6, 0.7);
  barrel(g, 2.8, y, 2.2, 1);
};

// ======================================================================
// 5. Невольничий рынок (катаста) — без фигур людей
// ======================================================================
function cage(par, x, z, ry = 0, w = 1.7, h = 1.6, d = 1.6) {
  const c = grp(par, x, 0, z, 0, ry, 0), wd = M(0x6a4a2a), wl = M(0x8a6a42);
  P(c, box(w, 0.15, d), PLANK(), 0, 0.075, 0);
  P(c, box(w + 0.1, 0.12, d + 0.1), wd, 0, h, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(c, box(0.12, h, 0.12), wd, sx * (w / 2), h / 2, sz * (d / 2));
  const nx = Math.round(w / 0.2), nz = Math.round(d / 0.2);
  for (let i = 1; i < nx; i++) for (const sz of [-1, 1]) P(c, box(0.05, h - 0.1, 0.05), wl, -w / 2 + i * (w / nx), h / 2, sz * d / 2);
  for (let i = 1; i < nz; i++) for (const sx of [-1, 1]) P(c, box(0.05, h - 0.1, 0.05), wl, sx * w / 2, h / 2, -d / 2 + i * (d / nz));
  P(c, box(0.12, 0.14, 0.08), ironM(), 0.2, h * 0.5, d / 2 + 0.05);
  return c;
}
BUILD.servile = (g) => {
  const ph = 1.4, pz = -1.2, wd = M(C.woodD);
  P(g, tbox(7, ph, 4.5), PLANK(), 0, ph / 2, pz);
  P(g, box(7.2, 0.08, 4.7), M(C.woodL), 0, ph + 0.02, pz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(g, box(0.25, ph + 0.05, 0.25), wd, sx * 3.45, ph / 2, pz + sz * 2.2);
  stairs(g, 0, ph, pz + 2.25, 1.6, 4, ph / 4, 0.35, 0, PLANK());
  // столбы с перекладиной, цепи и верёвки
  const zp = pz - 1.8, ir = ironM();
  for (const x of [-2.6, 0, 2.6]) post(g, x, ph, zp, 2.6, 0.1, wd);
  P(g, box(5.6, 0.16, 0.16), wd, 0, ph + 2.55, zp);
  for (let c = 0; c < 6; c++) {
    const x = -2.2 + c * 0.88, n = 6 + (c % 3) * 2;
    for (let i = 0; i < n; i++) P(g, tor(0.045, 0.012, 3, 6), ir, x, ph + 2.42 - i * 0.075, zp + 0.1, 0, i % 2 ? HPI : 0, 0);
    P(g, tor(0.08, 0.016, 4, 10), ir, x, ph + 2.42 - n * 0.075 - 0.06, zp + 0.1, 0, HPI, 0);
  }
  for (const x of [-2.6, 2.6]) { rope(g, [x + 0.1, ph + 2.0, zp + 0.1], [x + 0.25, ph + 0.6, zp + 0.25], 0.02); P(g, tor(0.18, 0.04, 4, 12), M(C.rope), x + 0.4, ph + 0.06, zp + 0.5, HPI); }
  for (let i = 0; i < 3; i++) P(g, tor(0.07, 0.014, 4, 10), ir, -1 + i * 0.5, ph + 0.06, pz + 0.6, HPI, 0, i);
  // тент на высоких столбах
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(g, sx * 3.45, ph, pz + sz * 2.2, sz < 0 ? 3.6 : 3.1, 0.08, wd);
  const aw = grp(g, 0, ph + 3.35, pz, Math.atan2(0.5, 4.4), 0, 0);
  P(aw, box(7.4, 0.04, 4.8), M(0xc8b088, { side: THREE.DoubleSide }), 0, 0, 0);
  for (let i = 0; i < 4; i++) P(aw, box(7.4, 0.045, 0.25), M(0x9a5a2a, { side: THREE.DoubleSide }), 0, 0.005, -1.8 + i * 1.2);
  P(aw, box(7.4, 0.35, 0.02), M(0x9a5a2a, { side: THREE.DoubleSide }), 0, -0.17, 2.4);
  colB(g, 0, pz, 7.2, 4.7);
  // кафедра продавца (пюпитр с табличками)
  const lc = grp(g, 3.2, 0, 2.6, 0, -0.5, 0);
  P(lc, box(0.5, 1.1, 0.4), M(C.wood), 0, 0.55, 0);
  P(lc, box(0.7, 0.05, 0.55), M(C.woodL), 0, 1.18, 0.02, 0.35, 0, 0);
  P(lc, box(0.3, 0.02, 0.22), M(0x3a2a1a), -0.12, 1.22, 0.02, 0.35, 0, 0);
  P(lc, cyl(0.04, 0.04, 0.3, 8), M(0xeee0b4), 0.15, 1.24, 0.0, 0.35, 0, HPI);
  colC(g, 3.2, 2.6, 0.45);
  bench(g, 4.6, 0, 1.4, 1.6, -HPI);
  // клетки
  for (const [x, z, ry] of [[-6, -3, 0.1], [-6, -0.6, -0.05], [6, -2.6, -0.15]]) { cage(g, x, z, ry); colB(g, x, z, 1.8, 1.7, ry); }
  // доски-«титулы» на шнурах у помоста
  for (let i = 0; i < 4; i++) { P(g, box(0.4, 0.28, 0.02), M(0xe8dcc0), -2.4 + i * 1.6, ph + 1.1, zp + 0.12, 0, 0, (i - 1.5) * 0.06); rope(g, [-2.55 + i * 1.6, ph + 1.24, zp + 0.11], [-2.25 + i * 1.6, ph + 1.24, zp + 0.11], 0.006); }
  crate(g, -3.8, 0, 2.4, 0.8, 0.3);
};

// ======================================================================
// 6. Греческий театр (кавея открыта на +Z, сцена на +Z)
// ======================================================================
BUILD.theatrum = (g) => {
  const zc = 0, Ri = 8.5, tiers = 16, rise = 0.5, dia = 9;
  const dr = (k) => (k === dia ? 1.6 : 0.8);
  const radii = [Ri]; for (let k = 0; k < tiers; k++) radii.push(radii[k] + dr(k));
  const Ro = radii[tiers], topY = tiers * rise;
  const pt = (r, th, yy) => [r * Math.cos(th), yy, zc + r * Math.sin(th)];
  const cav = G('cTheaCavea', () => {
    const pos = [], idx = [], N = 40;
    const quad = (a, b, c, d) => { const i = pos.length / 3; pos.push(...a, ...b, ...c, ...d); idx.push(i, i + 1, i + 2, i, i + 2, i + 3); };
    for (let k = 0; k < tiers; k++) {
      const r0 = radii[k], r1 = radii[k + 1], y0 = k * rise, y1 = (k + 1) * rise;
      for (let i = 0; i < N; i++) {
        const t0 = PI + (i / N) * PI, t1 = PI + ((i + 1) / N) * PI;
        quad(pt(r0, t0, y1), pt(r1, t0, y1), pt(r1, t1, y1), pt(r0, t1, y1));
        quad(pt(r0, t0, y0), pt(r0, t0, y1), pt(r0, t1, y1), pt(r0, t1, y0));
        if (i === 0) quad(pt(r0, t0, 0), pt(r1, t0, 0), pt(r1, t0, y1), pt(r0, t0, y1));
        if (i === N - 1) quad(pt(r0, t1, 0), pt(r0, t1, y1), pt(r1, t1, y1), pt(r1, t1, 0));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  });
  P(g, cav, M(0xd8ccb0, { side: THREE.DoubleSide }), 0, 0, 0);
  // лестницы-керкиды (полуступени)
  const stM = M(0xc4b89c);
  for (let j = 1; j <= 4; j++) {
    const th = PI + (j / 5) * PI, ry = Math.atan2(Math.cos(th), Math.sin(th));
    for (let k = 0; k < tiers; k++) {
      if (k === dia) continue;
      const r = radii[k] + dr(k) * 0.75, yy = (k + 1) * rise;
      P(g, box(1.1, rise / 2, dr(k) / 2), stM, r * Math.cos(th), yy + rise / 4, zc + r * Math.sin(th), 0, ry, 0);
    }
  }
  // наружная подпорная стена с контрфорсами
  const wm = TM('ashlar', 0xd8cbb0), N2 = 16, Rw = Ro + 0.6, Hw = topY + 1.1;
  for (let i = 0; i < N2; i++) {
    const t0 = PI + (i / N2) * PI, t1 = PI + ((i + 1) / N2) * PI, tm = (t0 + t1) / 2;
    const len = 2 * Rw * Math.sin(PI / N2 / 2) + 0.3, cx = Rw * Math.cos(tm), cz = zc + Rw * Math.sin(tm);
    const ry = Math.atan2(-Math.cos(tm), -Math.sin(tm));
    const s = grp(g, cx, 0, cz, 0, ry, 0);
    P(s, tbox(len, Hw + 1.5, 1.2), wm, 0, (Hw - 1.5) / 2, 0);
    P(s, box(len + 0.05, 0.2, 1.4), M(C.stone), 0, Hw - 0.1, 0);
    P(s, box(0.9, Hw - 0.6, 0.7), wm, len / 2, (Hw - 0.6) / 2, -0.9);
    colB(g, cx, cz, len, 1.3, ry);
  }
  // боковые стены-аналеммы у проходов
  const an = extr('cTheaAnal', [[Ri, -1.5], [Ro + 1.2, -1.5], [Ro + 1.2, Hw], [Ri, rise + 0.6]], 1.0, 0);
  for (const sx of [-1, 1]) { P(g, an, wm, 0, 0, zc + 0.5, 0, sx > 0 ? 0 : PI, 0); colB(g, sx * (Ri + Ro + 1.2) / 2, zc + 0.5, Ro + 1.2 - Ri, 1.0); }
  // невидимый барьер по краю нижнего ряда (в ряды не залезть)
  for (let i = 0; i < 10; i++) {
    const t0 = PI + (i / 10) * PI, t1 = PI + ((i + 1) / 10) * PI, tm = (t0 + t1) / 2, rr = Ri - 0.15;
    colB(g, rr * Math.cos(tm), zc + rr * Math.sin(tm), 2 * rr * Math.sin(PI / 20) + 0.2, 0.3, Math.atan2(-Math.cos(tm), -Math.sin(tm)));
  }
  // орхестра с алтарём (фимела)
  P(g, G('cOrch', () => { const c = new THREE.CircleGeometry(Ri - 0.5, 40); c.rotateX(-HPI); return c; }), M(0xe2d6b8), 0, 0.03, zc);
  P(g, G('cOrchRing', () => { const c = new THREE.RingGeometry(Ri - 0.5, Ri - 0.25, 40, 1); c.rotateX(-HPI); return c; }), M(0xb8aa8c), 0, 0.035, zc);
  P(g, cyl(0.55, 0.6, 0.9, 12), M(C.marble), 0, 0.45, zc); P(g, cyl(0.62, 0.62, 0.1, 12), M(C.marble), 0, 0.95, zc);
  colC(g, 0, zc, 0.65);
  // проскений (колоннада, на ней логейон), скена с фирометами, боковые параскении
  const pm = M(0xe6dcc6);
  colRow(g, -11, 8.6, 11, 8.6, 12, 0, 3.0, 0.2, 'tuscan', pm, false);
  P(g, box(24.4, 0.35, 2.5), PLANK(), 0, 3.12, 9.5);
  P(g, box(24.4, 0.3, 0.3), pm, 0, 3.0, 8.6);
  for (let i = 0; i < 11; i++) { if (i === 5 || i === 2 || i === 8) continue; P(g, box(1.6, 2.5, 0.08), M(i % 2 ? 0x8a3a2a : 0x3a5a6a), -10 + i * 2, 1.35, 8.75); }
  P(g, box(24, 2.95, 0.1), M(0x2a221a), 0, 1.48, 10.45);
  P(g, tbox(26, 9.5, 4), TM('ashlar', 0xe6dcc6), 0, 3.25, 12.6);
  for (const x of [-6, 0, 6]) P(g, box(3, 3.6, 0.06), M(0x1a140e), x, 3.3 + 1.8, 10.58);
  for (const x of [-9, -3, 3, 9]) P(g, box(0.6, 4.6, 0.25), pm, x, 3.3 + 2.3, 10.5);
  P(g, box(26.3, 0.35, 4.3), M(C.stone), 0, 8.0, 12.6);
  gable(g, 0, 8.0, 12.6, 26, 4, 0.3, 0.35, 'x');
  for (const sx of [-1, 1]) { P(g, tbox(2.6, 8.0, 2.4), TM('ashlar', 0xe6dcc6), sx * 12.7, 2.5, 9.4); P(g, box(2.8, 0.3, 2.6), M(C.stone), sx * 12.7, 6.6, 9.4); colB(g, sx * 12.7, 9.4, 2.6, 2.4); }
  colB(g, 0, 12.6, 26.2, 4.2); colB(g, 0, 9.5, 24.4, 2.4);
  // наружный портик со стороны улицы (+Z)
  colRow(g, -11, 15.9, 11, 15.9, 8, 0, 5.2, 0.28, 'ionic', M(C.marble), true);
  P(g, box(23.2, 0.5, 0.75), M(C.marble), 0, 5.4, 15.9);
  shed(g, 0, 5.95, 15.6, 25, 2.2, 0.45, 0);
  for (const x of [-6, 0, 6]) door(g, x, 0, 14.62, 0, 1.6, 2.8, true);
  for (const x of [-9, -3, 3, 9]) win(g, x, 4.0, 14.62, 0, 0.7, 0.9);
};

// ======================================================================
// 7. Арсенал
// ======================================================================
function ballista(par, x, z, ry = 0, s = 1, tripod = false) {
  const b = grp(par, x, 0, z, 0, ry, 0); b.scale.setScalar(s);
  const wd = M(0x6a4a2a), wl = M(0x9a7040), ir = ironM(), rp = M(0xb8a47a);
  if (tripod) for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; P(b, box(0.1, 1.35, 0.1), wd, Math.sin(a) * 0.35, 0.6, Math.cos(a) * 0.35, Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45); }
  else { for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P(b, box(0.1, 1.0, 0.1), wd, lx * 0.42, 0.45, lz * 0.42, lz * 0.3, 0, -lx * 0.3); P(b, box(1.1, 0.08, 0.08), wd, 0, 0.3, 0.38); P(b, box(1.1, 0.08, 0.08), wd, 0, 0.3, -0.38); }
  P(b, cyl(0.09, 0.11, 0.5, 8), wd, 0, 1.0, 0);
  const st = grp(b, 0, 1.3, 0, -0.06, 0, 0);
  P(st, box(0.3, 0.18, 2.6), wl, 0, 0, -0.3);
  P(st, box(0.08, 0.06, 2.3), wd, 0, 0.12, -0.3);
  for (const yy of [-0.36, 0.36]) P(st, box(1.2, 0.12, 0.32), wd, 0, yy, 0.8);
  for (const sx of [-1, 1]) {
    P(st, cyl(0.09, 0.09, 0.62, 8), rp, sx * 0.34, 0, 0.8);
    for (const yy of [-0.42, 0.42]) P(st, cyl(0.12, 0.12, 0.05, 8), ir, sx * 0.34, yy, 0.8);
    P(st, box(0.12, 0.84, 0.14), wd, sx * 0.6, 0, 0.8);
    const dx = sx * 0.72, dz = -0.48, len = Math.hypot(dx, dz);
    P(st, box(0.08, 0.1, len), wl, sx * 0.34 + dx / 2, 0, 0.8 + dz / 2, 0, Math.atan2(dx, dz), 0);
    rope(st, [sx * 1.06, 0, 0.32], [0, 0.1, -0.85], 0.012);
  }
  P(st, box(0.2, 0.14, 0.2), ir, 0, 0.12, -0.9);
  P(st, cyl(0.07, 0.07, 0.6, 8), wd, 0, 0, -1.55, 0, 0, HPI);
  for (const sx of [-1, 1]) P(st, box(0.05, 0.4, 0.05), wd, sx * 0.32, 0, -1.55, 0.8, 0, 0);
  P(st, cyl(0.02, 0.02, 1.3, 6), wl, 0, 0.17, 0.0, HPI, 0, 0);
  P(st, cone(0.035, 0.16, 4), ir, 0, 0.17, 0.72, HPI, 0, 0);
  return b;
}
function scutum(par, x, y, z, rx = 0, ry = 0, col = 0x9a2a22) {
  const s = grp(par, x, y, z, rx, ry, 0);
  P(s, rbox(0.66, 1.05, 0.07, 0.03), M(col), 0, 0, 0);
  P(s, box(0.68, 0.06, 0.08), M(C.bronze), 0, 0.5, 0); P(s, box(0.68, 0.06, 0.08), M(C.bronze), 0, -0.5, 0);
  P(s, sph(0.09, 8, 5), bronzeM(), 0, 0, 0.04, 0, 0, 0, 1, 1, 0.6);
  P(s, box(0.04, 0.9, 0.02), M(0xd8b040), 0, 0, 0.04);
  return s;
}
function spearRack(par, x, z, ry = 0, n = 8) {
  const r = grp(par, x, 0, z, 0, ry, 0), wd = M(C.woodD), wl = M(C.wood), st = steelM();
  for (const sx of [-1, 1]) P(r, box(0.1, 1.6, 0.1), wd, sx * 1.0, 0.8, -0.2);
  P(r, box(2.1, 0.08, 0.1), wd, 0, 1.5, -0.2); P(r, box(2.1, 0.1, 0.35), wd, 0, 0.1, 0.05);
  for (let i = 0; i < n; i++) { const sp = grp(r, -0.85 + i * (1.7 / (n - 1)), 0.1, 0.1, -0.13, 0, 0); P(sp, cyl(0.022, 0.026, 2.4, 6), wl, 0, 1.2, 0); P(sp, cone(0.04, 0.28, 4), st, 0, 2.54, 0); }
  return r;
}
BUILD.armamentarium = (g) => {
  const wm = TM('ashlar', 0xcfc3a8), cz = -2.5, Wd = 11, Dp = 7, Hh = 6.5;
  P(g, tbox(Wd, Hh + 1.5, Dp), wm, 0, (Hh - 1.5) / 2, cz);
  P(g, box(Wd + 0.3, 0.3, Dp + 0.3), M(0xb8ac90), 0, 1.0, cz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    P(g, tbox(1.6, Hh + 2.5, 1.6), wm, sx * Wd / 2, (Hh + 1 - 1.5) / 2, cz + sz * Dp / 2);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; P(g, box(0.5, 0.7, 0.5), wm, sx * Wd / 2 + Math.sin(a) * 0.55 + Math.cos(a) * 0.55, Hh + 1.35, cz + sz * Dp / 2 + Math.cos(a) * 0.55 - Math.sin(a) * 0.55); }
  }
  P(g, box(Wd + 0.4, 0.3, Dp + 0.4), M(0xb8ac90), 0, Hh - 0.15, cz);
  for (let i = 0; i < 9; i++) for (const sz of [-1, 1]) P(g, box(0.6, 0.75, 0.4), wm, -4.2 + i * 1.05, Hh + 0.37, cz + sz * (Dp / 2 - 0.05));
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) P(g, box(0.4, 0.75, 0.6), wm, sx * (Wd / 2 - 0.05), Hh + 0.37, cz - 2.4 + i * 0.95);
  for (const x of [-3.6, -2.0, 2.0, 3.6]) P(g, box(0.18, 1.0, 0.05), M(0x140e0a), x, 4.3, cz + Dp / 2 + 0.01);
  // окованные ворота
  const zf = cz + Dp / 2;
  P(g, box(3.4, 3.6, 0.35), M(0xb8ac90), 0, 1.8, zf + 0.05);
  for (const sx of [-1, 1]) { P(g, box(1.4, 3.1, 0.12), PLANK(), sx * 0.72, 1.55, zf + 0.25); for (const yy of [0.5, 1.5, 2.6]) P(g, box(1.4, 0.12, 0.05), ironM(), sx * 0.72, yy, zf + 0.33); for (let i = 0; i < 4; i++) P(g, sph(0.04, 6, 4), ironM(), sx * (0.2 + i * 0.32), 2.0, zf + 0.33); }
  P(g, box(1.6, 0.6, 0.06), MET(0x9a7a3a, 0.4, 0.85), 0, 4.0, zf + 0.04);
  colB(g, 0, cz, Wd + 1.6, Dp + 1.6);
  banner(g, 0, Hh, cz, 4.5); banner(g, -2.4, 0, zf + 0.6, 3.6); banner(g, 2.4, 0, zf + 0.6, 3.6);
  // двор: стойки с копьями, щиты, баллиста и скорпион
  spearRack(g, -3.9, 2.4, 0); colB(g, -3.9, 2.3, 2.2, 0.5);
  for (let i = 0; i < 5; i++) scutum(g, 3.2 + i * 0.5, 0.52, 1.6 + i * 0.03, -0.2, 0, i % 2 ? 0x9a2a22 : 0x8a2420);
  for (let i = 0; i < 4; i++) P(g, cyl(0.42, 0.42, 0.06, 14), M(i % 2 ? 0xb8904a : 0x7a5a32), 5.2, 0.04 + i * 0.07, 3.3);
  colB(g, 4.2, 1.8, 3.0, 0.6);
  for (let i = 0; i < 2; i++) crate(g, -5.4, 0, 4.0 + i * 0.9, 0.9, 0.1 * i);
  for (let i = 0; i < 12; i++) P(g, cyl(0.015, 0.015, 1.0, 4), M(0x9a7040), -4.6 + (i % 4) * 0.05, 0.62 + Math.floor(i / 4) * 0.035, 4.0, HPI, 0, 0);
  ballista(g, 2.8, 5.6, 0.15, 1, false); colC(g, 2.8, 5.6, 1.1);
  ballista(g, -2.2, 6.6, -0.2, 0.62, true); colC(g, -2.2, 6.6, 0.6);
  for (let i = 0; i < 6; i++) P(g, ico(0.16, 0), FOL(0x8a8478), 4.8 + (i % 3) * 0.32, 0.15 + (i >= 3 ? 0.25 : 0), 6.2 + (i % 2) * 0.2);
};

// ======================================================================
// 8. Кастеллум — распределитель воды акведука
// ======================================================================
BUILD.castellum = (g) => {
  const wm = TM('ashlar', 0xd8ccb0), cz = -0.7, S = 4, Hh = 3.4;
  P(g, tbox(S, Hh + 1.5, S), wm, 0, (Hh - 1.5) / 2, cz);
  P(g, box(S + 0.3, 0.25, S + 0.3), M(C.stone), 0, Hh, cz);
  P(g, box(S + 0.2, 0.3, S + 0.2), M(C.stoneD), 0, 0.15, cz);
  P(g, G('cCastRoof', () => wuv(new THREE.ConeGeometry(3.1, 1.1, 4, 1))), TILE(), 0, Hh + 0.67, cz, 0, PI / 4, 0);
  P(g, sph(0.15, 8, 6), M(C.stone), 0, Hh + 1.25, cz);
  // приходящий канал акведука сзади
  P(g, tbox(1.4, 1.1, 1.4), wm, 0, Hh - 0.8, cz - S / 2 - 0.7);
  P(g, box(0.7, 0.02, 1.4), WATER(), 0, Hh - 0.24, cz - S / 2 - 0.7);
  // ниша с тремя бронзовыми носиками и бассейн
  const zf = cz + S / 2;
  P(g, box(2.2, 1.6, 0.06), M(0x2a241c), 0, 1.6, zf + 0.01);
  P(g, box(2.6, 0.2, 0.25), M(C.stone), 0, 2.5, zf + 0.1);
  basin(g, 0, 0, zf + 0.75, 3.2, 0.7, 1.4, 0.12);
  const wtr = M(0x7ac0d4, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.75 });
  for (const x of [-0.7, 0, 0.7]) {
    P(g, cyl(0.06, 0.06, 0.35, 8), bronzeM(), x, 1.6, zf + 0.17, HPI);
    P(g, box(0.07, 1.0, 0.07), wtr, x, 1.07, zf + 0.37).castShadow = false;
  }
  // свинцовые трубы (фистулы) уходят в землю по бокам
  const lead = M(0x7a7c80, { roughness: 0.6, metalness: 0.3 });
  for (const sx of [-1, 1]) for (const k of [-1, 0, 1]) {
    const z = cz + k * 1.1;
    P(g, cyl(0.07, 0.07, 0.8, 8), lead, sx * (S / 2 + 0.4), 0.9, z, 0, 0, HPI);
    P(g, cyl(0.07, 0.07, 1.4, 8), lead, sx * (S / 2 + 0.8), 0.2, z);
    P(g, cyl(0.1, 0.1, 0.12, 8), lead, sx * (S / 2 + 0.05), 0.9, z, 0, 0, HPI);
  }
  P(g, box(1.6, 0.45, 0.04), M(C.marble), 0, 2.95, zf + 0.02);
  colB(g, 0, cz - 0.3, S + 0.4, S + 1.0); colB(g, 0, zf + 0.75, 3.2, 1.4);
};

// ======================================================================
// 9. Один пролёт акведука (вдоль Z), опора на z = −len/2
// ======================================================================
export function makeAqueductSpan(len = 10, h = 8) {
  const g = newRoot('aqueduct', { len, h });
  // арка всегда ниже настила: в низком пролёте — уже и ниже, совсем низкий — глухая стенка без арки
  const pt = 2.2, pw = 3.0, top = h - 0.15, room = top - 0.9 - 1.0, ra = Math.min((len - pt) / 2, room), solid = ra < 0.8, ys = solid ? 0 : top - 0.9 - ra;
  const wm = TM('ashlar', 0xd8c8a8);
  // опора
  P(g, tbox(pw, ys + 14, pt), wm, 0, (ys - 14) / 2, -len / 2);
  P(g, box(pw + 0.3, 0.3, pt + 0.3), M(C.stoneD), 0, ys - 0.15, -len / 2);
  P(g, box(pw + 0.25, 0.4, pt + 0.25), M(C.stoneD), 0, 0.0, -len / 2);
  // стена с аркой (контур: арка-полукруг от пяты на ys)
  const geo = G(`cAqArch${len},${h}`, () => {
    const s = new THREE.Shape();
    if (solid) { s.moveTo(-len / 2, -2); s.lineTo(len / 2, -2); s.lineTo(len / 2, top); s.lineTo(-len / 2, top); s.closePath(); }
    else { s.moveTo(-len / 2, ys); s.lineTo(-ra, ys); s.absarc(0, ys, ra, PI, 0, true); s.lineTo(len / 2, ys); s.lineTo(len / 2, top); s.lineTo(-len / 2, top); s.closePath(); }
    const e = new THREE.ExtrudeGeometry(s, { depth: pw, bevelEnabled: false, curveSegments: 14 });
    e.translate(0, 0, -pw / 2);
    return e;
  });
  P(g, geo, wm, 0, 0, 0, 0, -HPI, 0);
  const gapH = (len - pt) / 2; if (!solid && ra < gapH - 0.05) for (const sx of [-1, 1]) { const w = gapH - ra, cx = sx * (ra + w / 2); P(g, tbox(pw, ys + 2, w), wm, 0, (ys - 2) / 2, cx); } // простенки до земли у узкой арки
  // клинчатые камни-архивольт
  if (!solid) P(g, G(`cAqVouss${len},${h}`, () => { const s = new THREE.Shape(); s.absarc(0, 0, ra + 0.45, 0, PI, false); s.absarc(0, 0, ra, PI, 0, true); const e = new THREE.ExtrudeGeometry(s, { depth: pw + 0.12, bevelEnabled: false, curveSegments: 14 }); e.translate(0, 0, -(pw + 0.12) / 2); return e; }), M(0xc8b898), 0, ys, 0, 0, -HPI, 0);
  P(g, box(pw + 0.3, 0.25, len), M(C.stoneD), 0, top - 0.6, 0);
  // канал (specus) с водой
  P(g, box(pw, 0.3, len), wm, 0, top + 0.15, 0);
  for (const sx of [-1, 1]) P(g, box(0.7, 0.9, len), wm, sx * (pw / 2 - 0.35), top + 0.75, 0);
  P(g, box(pw - 1.4, 0.03, len), WATER(), 0, h + 0.45, 0);
  for (let i = 0; i < 2; i++) P(g, box(pw - 0.6, 0.2, 0.9), M(0xc8b898), 0, top + 1.3, -len / 2 + 1.5 + i * (len - 3));
  g.userData.colliders.push({ x: 0, z: -len / 2, w: pw + 0.3, d: pt + 0.3, ry: 0 });
  return g;
}

// ======================================================================
// 10. Кольцо городских стен
// ======================================================================
export function makeCityWalls(R, gates = [], keep = () => true, flag = null) {
  const g = newRoot('walls', { R, gates: [...gates] });
  g.name = 'walls';
  const WH = 6, T = 2, TS = 6.5, TH = 9.5, GW = 8, DEEP = 4;
  const N = Math.max(8, Math.round((TAU * R) / 6)), step = TAU / N;
  const wm = TM('ashlar', 0xd6c9aa), cap = M(0xbfb294), mer = M(0xcfc2a2), dark = M(0x16110c);
  const ad = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const gh = GW / 2 / R;
  const near = (a, w) => gates.some((ga) => Math.abs(ad(a, ga)) < w);
  const piece = (a0, a1) => {
    const x0 = Math.sin(a0) * R, z0 = Math.cos(a0) * R, x1 = Math.sin(a1) * R, z1 = Math.cos(a1) * R;
    const len = Math.hypot(x1 - x0, z1 - z0) + 0.3, am = (a0 + a1) / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const s = grp(g, cx, 0, cz, 0, am, 0); s.userData.wallPart = 'wall';
    P(s, tbox(len, WH + DEEP, T), wm, 0, (WH - DEEP) / 2, 0);
    P(s, box(len + 0.02, 0.22, T + 0.3), cap, 0, WH - 0.5, 0);
    const nm = Math.max(1, Math.round(len / 2));
    for (let k = 0; k < nm; k++) P(s, box(0.95, 0.9, 0.45), mer, -len / 2 + ((k + 0.5) * len) / nm, WH + 0.45, T / 2 - 0.22);
    P(s, box(len, 0.55, 0.3), mer, 0, WH + 0.27, -T / 2 + 0.15);
    colB(g, cx, cz, len, T, am);
  };
  for (let i = 0; i < N; i++) {
    let parts = [[i * step, (i + 1) * step]];
    for (const ga of gates) {
      const next = [];
      for (const [s, e] of parts) {
        const ds = ad(s, ga), de = ds + (e - s);
        if (de <= -gh || ds >= gh) next.push([s, e]);
        else { if (ds < -gh) next.push([s, s + (-gh - ds)]); if (de > gh) next.push([e - (de - gh), e]); }
      }
      parts = next;
    }
    for (const [s, e] of parts) if ((e - s) * R > 0.6 && keep((s + e) / 2)) piece(s, e);
  }
  // башни через ~40 м
  const te = Math.max(2, Math.round(40 / (R * step)));
  const tower = (a, rr = R + 0.6) => {
    const x = Math.sin(a) * rr, z = Math.cos(a) * rr, t = grp(g, x, 0, z, 0, a, 0); t.userData.wallPart = 'tower';
    P(t, tbox(TS, TH + DEEP, TS), wm, 0, (TH - DEEP) / 2, 0);
    P(t, box(TS + 0.4, 0.3, TS + 0.4), cap, 0, TH - 0.15, 0);
    P(t, box(TS + 0.2, 0.25, TS + 0.2), cap, 0, WH + 0.6, 0);
    for (let k = 0; k < 4; k++) { const b = (k * PI) / 2; for (let m = 0; m < 3; m++) { const o = (m - 1) * (TS / 3); P(t, box(0.9, 0.9, 0.5), mer, Math.sin(b) * (TS / 2 - 0.1) + Math.cos(b) * o, TH + 0.45, Math.cos(b) * (TS / 2 - 0.1) - Math.sin(b) * o, 0, b, 0); } }
    for (const xx of [-1.4, 1.4]) P(t, box(0.22, 1.1, 0.05), dark, xx, TH - 2.2, TS / 2 + 0.01);
    P(t, box(1.1, 2.0, 0.05), dark, 0, WH + 1.65, -TS / 2 - 0.01);
    colB(g, x, z, TS, TS, a);
  };
  for (let i = 0; i < N; i += te) { const a = i * step; if (near(a, (GW / 2 + TS + 6) / R) || !keep(a)) continue; tower(a); }
  // ворота: две башни и арочный проезд 8 м
  for (const ga of gates) {
    const cx = Math.sin(ga) * R, cz = Math.cos(ga) * R, gg = grp(g, cx, 0, cz, 0, ga, 0); gg.userData.wallPart = 'gate';
    const off = GW / 2 + TS / 2;
    for (const sx of [-1, 1]) {
      P(gg, tbox(TS, TH + 1 + DEEP, TS), wm, sx * off, (TH + 1 - DEEP) / 2, 0.6);
      P(gg, box(TS + 0.4, 0.3, TS + 0.4), cap, sx * off, TH + 0.85, 0.6);
      for (let m = 0; m < 3; m++) for (const sz of [-1, 1]) P(gg, box(0.9, 0.9, 0.5), mer, sx * off + (m - 1) * (TS / 3), TH + 1.45, 0.6 + sz * (TS / 2 - 0.1));
      P(gg, box(0.22, 1.1, 0.05), dark, sx * off, TH - 1.5, 0.6 + TS / 2 + 0.01);
      colB(g, cx + Math.cos(ga) * off * sx + Math.sin(ga) * 0.6, cz - Math.sin(ga) * off * sx + Math.cos(ga) * 0.6, TS, TS, ga);
    }
    const W2 = GW / 2 + 0.6;
    P(gg, G('cGateArch', () => {
      const s = new THREE.Shape(); s.moveTo(-W2, 0); s.lineTo(-GW / 2, 0); s.lineTo(-GW / 2, 4.0); s.absarc(0, 4.0, GW / 2, PI, 0, true); s.lineTo(GW / 2, 0); s.lineTo(W2, 0); s.lineTo(W2, TH); s.lineTo(-W2, TH); s.closePath();
      const e = new THREE.ExtrudeGeometry(s, { depth: T + 1.2, bevelEnabled: false, curveSegments: 12 }); e.translate(0, 0, -(T + 1.2) / 2); return e;
    }), wm, 0, 0, 0.3);
    P(gg, box(GW + 1.4, 0.3, T + 1.6), cap, 0, TH - 0.1, 0.3);
    for (let m = 0; m < 4; m++) P(gg, box(0.9, 0.9, 0.45), mer, -3 + m * 2, TH + 0.45, 0.3 + (T + 1.2) / 2 - 0.22);
    for (const sx of [-1, 1]) { const lf = grp(gg, sx * GW / 2, 0, -T / 2 - 0.1, 0, sx * -1.35, 0); P(lf, box(GW / 2, 6.0, 0.2), PLANK(), -sx * GW / 4, 3.0, 0); for (const yy of [0.8, 3, 5.2]) P(lf, box(GW / 2, 0.16, 0.26), ironM(), -sx * GW / 4, yy, 0); }
    if (flag) { const f = flag(); f.position.set(0, TH, 0.3); gg.add(f); } else banner(gg, 0, TH, 0.3, 3.5);
  }
  return g;
}

// ======================================================================
// 11. Отрезок мощёной улицы (вдоль Z) с тротуарами
// ======================================================================
export function makeStreetSlab(len = 8, wid = 6) {
  const g = newRoot('street', { len, wid });
  const sw = clamp(wid * 0.16, 0.6, 1.6), road = wid - 2 * sw;
  P(g, tbox(road, 0.25, len), BASALT(), 0, -0.005, 0);
  for (const s of [-1, 1]) {
    P(g, tbox(sw - 0.2, 0.45, len), WALK(), s * (road / 2 + 0.2 + (sw - 0.2) / 2), 0.095, 0);
    P(g, box(0.22, 0.47, len), M(0xb4aa94), s * (road / 2 + 0.11), 0.1, 0);
  }
  return g;
}

// One paved surface joins all three mouths; curbs stop at each entrance.
export function makeStreetJunction(junction) {
 const g=newRoot('street_junction'),{x,z,polygon,arms}=junction,positions=[0,.13,0],uv=[0,0],indices=[];
 for(const p of polygon){positions.push(p[0]-x,.13,p[1]-z);uv.push((p[0]-x)*.3,(p[1]-z)*.3);}
 for(let i=0;i<polygon.length;i++)indices.push(0,(i+1)%polygon.length+1,i+1);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,BASALT());mesh.receiveShadow=true;g.add(mesh);
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],mx=(a[0]+b[0])/2-x,mz=(a[1]+b[1])/2-z;
  const mouth=arms.some(arm=>{const d=Math.hypot(arm.x-x,arm.z-z);return Math.abs((mx*(arm.x-x)+mz*(arm.z-z))/d-Math.min(10,d/2))<.05;});
  if(!mouth)beam(g,a[0]-x,a[1]-z,b[0]-x,b[1]-z,.13,.18,.2,M(0xb4aa94));
 }
 return g;
}

// ======================================================================
// 12. Секция каменного мола (вдоль Z); верх на y = 0
// ======================================================================
export function makeMoleSegment(len = 8, wid = 10) {
  const g = newRoot('mole', { len, wid });
  const big = TM('ashlar', 0xc4b89c);
  P(g, tbox(wid / 2, 3, len / 2), big, 0, -3.07, 0, 0, 0, 0, 2, 2, 2);
  P(g, tbox(wid - 0.3, 0.14, len), TM('ashlar', 0xd8ccb0), 0.15, -0.07, 0);
  P(g, box(wid + 2.2, 1.6, len), FOL(0x6a6458), 0, -5.4, 0);
  for (const sx of [-1, 1]) P(g, box(0.2, 1.0, len), M(0x55604a), sx * (wid / 2 + 0.02), -1.5, 0);
  P(g, box(0.55, 0.18, len), M(0xb8ac94), -wid / 2 + 0.27, 0.05, 0);
  P(g, tbox(0.8, 1.15, len), big, wid / 2 - 0.4, 0.5, 0);
  P(g, box(0.95, 0.14, len), M(0xb8ac94), wid / 2 - 0.4, 1.12, 0);
  const bm = M(0x5a5a56);
  P(g, cyl(0.2, 0.26, 0.7, 10), bm, -wid / 2 + 0.75, 0.35, 0);
  P(g, cyl(0.28, 0.22, 0.12, 10), bm, -wid / 2 + 0.75, 0.74, 0);
  P(g, tor(0.18, 0.03, 4, 10), ironM(), -wid / 2 - 0.03, -0.6, 0, 0, HPI, 0);
  colB(g, wid / 2 - 0.4, 0, 0.8, len);
  return g;
}

// ======================================================================
// 13. Разрушенное здание (детерминировано по type)
// ======================================================================
export function makeRuin(type = 'domus', r = 8) {
  const seed = hstr(type) + Math.round(r * 10), rnd = rng(seed);
  const g = newRoot('ruin_' + type, { type, ruined: true });
  const w = r * 1.4, d = r * 1.05;
  const st = M(0xd2c6ae), stB = M(0x6a6258), soot = M(0x1d1915), charM = M(0x2a2018), tileM = M(C.tile);
  P(g, tbox(w + 0.6, 1.8, d + 0.6), TM('ashlar', 0xb8ae98), 0, -0.6, 0);
  for (let i = 0; i < 5; i++) { const s = 1 + rnd() * Math.min(3, r * 0.25); P(g, cyl(1, 1, 0.02, 10), soot, (rnd() - 0.5) * w * 0.8, 0.31, (rnd() - 0.5) * d * 0.8, 0, rnd() * 3, 0, s, 1, s * 0.7).castShadow = false; }
  const sides = [[-w / 2, -d / 2, w / 2, -d / 2, 1.0], [w / 2, -d / 2, w / 2, d / 2, 0.8], [w / 2, d / 2, -w / 2, d / 2, 0.45], [-w / 2, d / 2, -w / 2, -d / 2, 0.75]];
  sides.forEach(([x0, z0, x1, z1, hk], si) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L, ry = Math.atan2(-uz, ux);
    let t = 0, k = 0;
    while (t < L - 0.8) {
      const pl = Math.min(L - t, 1.5 + rnd() * 2.5);
      if (rnd() < 0.72) {
        const hMax = 0.6 + rnd() * 3.6 * hk, pts = [[0, 0], [pl, 0]], n = Math.max(2, Math.round(pl / 0.45));
        for (let i = n; i >= 0; i--) pts.push([(i / n) * pl, Math.max(0.25, hMax * (0.45 + 0.55 * rnd()) * (i === 0 || i === n ? 0.6 : 1))]);
        const mat = rnd() < 0.35 ? stB : st;
        P(g, extr(`cRuinW${seed}_${si}_${k}`, pts, 0.6, 0), mat, x0 + ux * t, 0.3, z0 + uz * t, 0, ry, 0);
        if (mat === st && hMax > 1.8) P(g, box(pl * 0.7, 0.5, 0.62), soot, x0 + ux * (t + pl / 2), 0.3 + hMax * 0.3, z0 + uz * (t + pl / 2), 0, ry, 0).castShadow = false;
        colB(g, x0 + ux * (t + pl / 2), z0 + uz * (t + pl / 2), pl, 0.6, ry);
        k++;
      }
      t += pl + (rnd() < 0.3 ? 0.6 + rnd() * 1.2 : 0);
    }
  });
  // груды щебня
  const rubG = [0, 1, 2].map((i) => G(`cRub${i}`, () => lumpy(new THREE.DodecahedronGeometry(0.5, 0), 0.3, 200 + i)));
  for (let p = 0; p < 4 + Math.round(r / 4); p++) {
    const cx = (rnd() - 0.5) * w * 0.75, cz = (rnd() - 0.5) * d * 0.75, s0 = 0.7 + rnd() * 0.8;
    P(g, rubG[p % 3], FOL(0x9a907e), cx, 0.3, cz, rnd(), rnd() * 3, 0, s0 * 2.2, s0 * 0.9, s0 * 1.8);
    for (let i = 0; i < 6; i++) P(g, rubG[i % 3], FOL(i % 2 ? 0xb4a890 : 0x7a7264), cx + (rnd() - 0.5) * 2.2 * s0, 0.35 + rnd() * 0.2, cz + (rnd() - 0.5) * 2.2 * s0, rnd() * 3, rnd() * 3, rnd() * 3, 0.4 + rnd() * 0.5);
    for (let i = 0; i < 4; i++) P(g, box(0.4, 0.04, 0.28), tileM, cx + (rnd() - 0.5) * 3, 0.33 + rnd() * 0.3, cz + (rnd() - 0.5) * 3, rnd() * 0.6, rnd() * 3, rnd() * 0.6);
  }
  // обломанные колонны
  const nc = 2 + Math.round(rnd() * 3);
  for (let i = 0; i < nc; i++) {
    const x = (-0.5 + (i + 0.5) / nc) * w * 0.7, z = -d * 0.18, hh = 0.8 + rnd() * 3.2;
    P(g, box(0.95, 0.25, 0.95), st, x, 0.42, z);
    P(g, cyl(0.34, 0.37, hh, 10), i % 2 ? st : stB, x, 0.55 + hh / 2, z, (rnd() - 0.5) * 0.06, 0, (rnd() - 0.5) * 0.06);
    P(g, cone(0.35, 0.3, 6), i % 2 ? st : stB, x, 0.55 + hh + 0.1, z, 0.4, rnd() * 3, 0.3);
    colC(g, x, z, 0.5);
    if (rnd() < 0.6) P(g, cyl(0.35, 0.35, 1.0, 10), st, x + 0.9, 0.65, z + 1.0 + rnd(), 0, rnd() * 3, HPI);
  }
  // упавшие балки кровли
  P(g, box(0.35, 0.35, Math.min(9, r * 1.1)), charM, -w * 0.15, 1.1, 0, 0.22, 0.3 + rnd() * 0.4, 0.1);
  P(g, box(0.3, 0.3, Math.min(7, r * 0.8)), charM, w * 0.18, 0.5, d * 0.1, 0.05, -0.6 - rnd() * 0.4, 0);
  P(g, box(0.28, 0.28, Math.min(5, r * 0.6)), M(0x3a2c20), 0, 0.45, d * 0.25, 0, 1.2 + rnd(), 0.05);
  for (let i = 0; i < 4; i++) P(g, ico(0.12, 0), EMB(), (rnd() - 0.5) * w * 0.5, 0.36, (rnd() - 0.5) * d * 0.5);
  for (let i = 0; i < 3; i++) { const b = makeBush(i % 2 ? 'dry' : 'med'); b.position.set((rnd() - 0.5) * w, 0.3, (rnd() - 0.5) * d); b.scale.setScalar(0.5 + rnd() * 0.4); g.add(b); }
  return g;
}

// ======================================================================
// 14. Воловья повозка (+Z вперёд), userData.wheels — вращать по X
// ======================================================================
function ox(par, x, z) {
  const o = grp(par, x, 0, z);
  const hide = M(0xd8cdb8), dk = M(0x3a302a), horn = M(0xe8dcc0);
  P(o, sph(0.5, 10, 8), hide, 0, 1.12, 0, 0, 0, 0, 0.72, 0.78, 1.75);
  P(o, sph(0.42, 8, 6), hide, 0, 1.24, 0.5, 0, 0, 0, 0.78, 0.86, 1.0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { P(o, cyl(0.075, 0.06, 0.86, 6), hide, sx * 0.21, 0.43, sz * 0.58); P(o, cyl(0.065, 0.075, 0.1, 6), dk, sx * 0.21, 0.05, sz * 0.58); }
  P(o, box(0.12, 0.42, 0.5), hide, 0, 0.8, 0.82);
  const hd = grp(o, 0, 1.2, 1.05, 0.55, 0, 0);
  P(hd, box(0.32, 0.36, 0.62), hide, 0, 0, 0.25);
  P(hd, box(0.27, 0.24, 0.16), M(0x5a4a40), 0, -0.06, 0.6);
  for (const sx of [-1, 1]) { P(hd, cone(0.05, 0.42, 5), horn, sx * 0.3, 0.2, 0.05, 0, 0, -sx * 1.15); P(hd, box(0.12, 0.06, 0.16), hide, sx * 0.2, 0.12, 0.02, 0, 0, sx * 0.4); P(hd, sph(0.03, 5, 4), dk, sx * 0.165, 0.06, 0.32); }
  P(o, cyl(0.025, 0.02, 0.75, 4), hide, 0, 0.82, -0.87, 0.12, 0, 0);
  P(o, sph(0.06, 5, 4), dk, 0, 0.45, -0.92);
  return o;
}
export function makeWagon() {
  const g = newRoot('wagon', { len: 6.4 });
  const root = grp(g, 0, 0, -0.55), wheels = [];
  const wd = M(C.wood), wdD = M(C.woodD), ir = ironM();
  const bz = -1.1;
  P(root, tbox(1.8, 0.12, 3.4), PLANK(), 0, 1.0, bz);
  for (const sx of [-1, 1]) { P(root, box(0.08, 0.45, 3.4), wd, sx * 0.9, 1.28, bz); for (let i = 0; i < 4; i++) P(root, box(0.1, 0.62, 0.1), wdD, sx * 0.92, 1.2, bz - 1.6 + i * 1.07); }
  for (const sz of [-1, 1]) P(root, box(1.86, 0.45, 0.08), wd, 0, 1.28, bz + sz * 1.7);
  P(root, box(0.16, 0.16, 3.6), wdD, 0, 0.88, bz);
  for (const az of [bz - 1.1, bz + 0.95]) {
    P(root, cyl(0.06, 0.06, 2.3, 6), wdD, 0, 0.6, az, 0, 0, HPI);
    P(root, box(1.6, 0.14, 0.18), wdD, 0, 0.82, az);
    for (const sx of [-1, 1]) {
      const wh = grp(root, sx * 1.07, 0.6, az);
      P(wh, cyl(0.58, 0.58, 0.12, 14), wd, 0, 0, 0, 0, 0, HPI);
      P(wh, tor(0.58, 0.035, 4, 16), ir, 0, 0, 0, 0, HPI, 0);
      P(wh, cyl(0.13, 0.13, 0.28, 8), wdD, 0, 0, 0, 0, 0, HPI);
      for (const xs of [-1, 1]) P(wh, box(0.04, 1.0, 0.12), wdD, xs * 0.075, 0, 0);
      P(wh, box(0.04, 0.12, 1.0), wdD, sx * 0.075, 0, 0);
      wheels.push(wh);
    }
  }
  // груз: ящики под парусиной
  for (let i = 0; i < 4; i++) crate(root, (i % 2 - 0.5) * 0.85, 1.06, bz - 1.2 + Math.floor(i / 2) * 0.75, 0.95, (i % 2) * 0.1);
  crate(root, 0, 1.66, bz - 0.85, 0.85, 0.15);
  P(root, G('cWagonTarp', () => { const c = new THREE.CylinderGeometry(0.95, 0.95, 2.6, 10, 1, true, HPI, PI); c.rotateX(HPI); return c; }), M(0xd8ccb0, { side: THREE.DoubleSide }), 0, 1.3, bz - 0.35);
  for (const sz of [-1.3, 0, 1.3]) P(root, tor(0.96, 0.03, 4, 10, PI), wdD, 0, 1.3, bz - 0.35 + sz);
  for (let i = 0; i < 2; i++) sack(root, (i - 0.5) * 0.7, 1.06, bz + 1.2, 0.9, 0xd2be92, i);
  // козлы возницы
  P(root, box(1.6, 0.1, 0.42), M(C.woodL), 0, 1.6, bz + 1.45);
  for (const sx of [-1, 1]) P(root, box(0.08, 0.5, 0.08), wdD, sx * 0.7, 1.33, bz + 1.45);
  P(root, box(1.6, 0.08, 0.3), wdD, 0, 1.1, bz + 1.95);
  // дышло, ярмо, волы
  P(root, box(0.12, 0.12, 2.6), wdD, 0, 1.0, bz + 2.9, -0.06, 0, 0);
  P(root, box(1.8, 0.13, 0.15), wd, 0, 1.47, bz + 4.05);
  for (const sx of [-1, 1]) { P(root, box(0.05, 0.4, 0.05), wdD, sx * 0.45, 1.3, bz + 4.12); P(root, box(0.05, 0.4, 0.05), wdD, sx * 0.75, 1.3, bz + 4.12); ox(root, sx * 0.6, bz + 3.2); }
  g.userData.wheels = wheels;
  g.userData.wheelR = 0.6;
  g.userData.colliders.push({ x: 0, z: 0, w: 2.3, d: 6.4, ry: 0 });
  return g;
}

// ======================================================================
// 15. Пентера (квинквирема) с «вороном» (corvus)
// ======================================================================
SHIPDEF.penteres = { L: 32, Bm: 5.4, D: 1.45, deckY: 1.6, bul: 0.7, riseB: 0.85, riseS: 2.4, pb: 2.8, ps: 3.0, hull: 0x4a3220, banks: [[16, 0], [16, 1], [16, 2]], oarY0: 0.6, bankDY: 0.42, mast: 2.0, mastH: 14, sail: [12, 8], sailCol: 0xece2c8, stripe: 0x9a2a22, ram: 1, eye: 1, aplustre: 1, seats: 16, shields: 0x9a2a22, corvus: 1 };
// makeShip() не знает про «ворон»: заранее кладём в кэш геометрию форштевня пентеры, в которую вклеены
// мостик-«ворон», его мачта, блок и выносные рамы гребцов. makeShip('penteres') подхватит её сама.
(function primePenteres() {
  const c = SHIPDEF.penteres, bowZ = c.L / 2, sh = c.deckY + c.bul + c.riseB;
  const stemPts = [[0, -c.D * 0.4, bowZ - 0.1], [0, sh * 0.6, bowZ + 0.05], [0, sh + 0.3, bowZ - 0.05], [0, sh + 0.7, bowZ - 0.35]];
  G('tustempenteres', () => {
    const base = tube('stempenteres_base', stemPts, 0.08 * (c.L / 14 + 0.5), 0.05, 10, 6);
    const tmp = new THREE.Group(), mm = M(0xffffff);
    const zp = bowZ - 5.2, yd = c.deckY;
    P(tmp, cyl(0.16, 0.2, 8.2, 8), mm, 0, yd + 4.1, zp);
    P(tmp, box(0.45, 0.45, 0.45), mm, 0, yd + 8.0, zp);
    P(tmp, box(0.9, 0.4, 0.9), mm, 0, yd + 0.2, zp);
    const ang = 1.08, bl = 10.5, b0 = [0, yd + 1.3, zp - 1.2];
    const br = grp(tmp, b0[0] + 0, b0[1] + Math.sin(ang) * bl / 2, b0[2] + Math.cos(ang) * bl / 2, -ang, 0, 0);
    P(br, box(1.25, 0.12, bl), mm, 0, 0, 0);
    for (const sx of [-1, 1]) { P(br, box(0.06, 0.06, bl), mm, sx * 0.62, 0.62, 0); for (let i = 0; i < 6; i++) P(br, box(0.05, 0.62, 0.05), mm, sx * 0.62, 0.31, -bl / 2 + 0.6 + i * ((bl - 1.2) / 5)); }
    for (let i = 0; i < 8; i++) P(br, box(1.3, 0.04, 0.12), mm, 0, 0.08, -bl / 2 + 0.7 + i * 1.3);
    P(br, cone(0.11, 0.9, 6), mm, 0, -0.45, bl / 2 - 0.15, PI, 0, 0);
    const tip = new THREE.Vector3(0, b0[1] + Math.sin(ang) * bl, b0[2] + Math.cos(ang) * bl), top = new THREE.Vector3(0, yd + 8.0, zp);
    for (const sx of [-0.25, 0.25]) { const a = new THREE.Vector3(sx, top.y, top.z), b = new THREE.Vector3(sx, tip.y, tip.z), m = P(tmp, cyl(0.025, 0.025, 1, 4), mm, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); m.scale.y = a.distanceTo(b); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); }
    for (const sx of [-1, 1]) P(tmp, box(0.5, 0.35, c.L * 0.62), mm, sx * (c.Bm / 2 + 0.15), yd + 0.05, 0);
    tmp.updateMatrixWorld(true);
    const parts = [base.index ? base.clone() : base.clone()];
    tmp.traverse((o) => { if (o.isMesh) { let q = o.geometry.clone().applyMatrix4(o.matrixWorld); if (!q.index) q = null; if (q) { for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); parts.push(q); } } });
    for (const p of parts) for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(k)) p.deleteAttribute(k);
    return mergeGeometries(parts, false) || base;
  });
})();
export function makePenteres() { return makeShip('penteres'); }

// ======================================================================
// 16. Пунийская пригородная усадьба (целая и сожжённая)
// ======================================================================
function villa(g, burnt) {
  const r = rng(77);
  const plast = M(burnt ? 0x57514a : 0xece4d2), sootM = M(0x1c1814), roofM = M(burnt ? 0x2a2420 : 0xdcd2bc), socle = M(burnt ? 0x4a443c : 0xb8a888);
  const beamM = M(burnt ? 0x1e1610 : C.woodD), dark = M(0x15100c);
  // крыло: полые стены (4 бруса), плоская крыша с парапетом (у целой)
  const wing = (cx, cz, w, d, h) => {
    const t = 0.45;
    for (const [x, z, ww, dd] of [[cx, cz - d / 2 + t / 2, w, t], [cx, cz + d / 2 - t / 2, w, t], [cx - w / 2 + t / 2, cz, t, d - 2 * t], [cx + w / 2 - t / 2, cz, t, d - 2 * t]]) {
      const hh = burnt ? h * (0.6 + r() * 0.4) : h;
      P(g, box(ww, hh, dd), plast, x, hh / 2, z);
      P(g, box(ww + 0.04, 0.6, dd + 0.04), socle, x, 0.3, z);
      if (burnt) P(g, box(ww + 0.03, 0.8, dd + 0.03), sootM, x, hh - 0.4, z).castShadow = false;
      colB(g, x, z, ww, dd);
    }
    if (!burnt) {
      P(g, box(w + 0.2, 0.25, d + 0.2), roofM, cx, h + 0.12, cz);
      for (const s of [-1, 1]) P(g, box(w + 0.2, 0.4, 0.15), plast, cx, h + 0.45, cz + s * (d / 2 + 0.03));
      for (let i = 0; i < Math.round(w / 0.9); i++) P(g, cyl(0.07, 0.07, 0.35, 6), beamM, cx - w / 2 + 0.45 + i * 0.9, h - 0.25, cz + d / 2 + 0.12, HPI);
    } else {
      for (let i = 0; i < 3; i++) P(g, box(0.25, 0.25, Math.min(w, d) * 0.9), beamM, cx + (r() - 0.5) * w * 0.5, 0.4 + r() * h * 0.4, cz + (r() - 0.5) * d * 0.4, 0.3 + r() * 0.4, r() * 3, 0.1);
      for (let i = 0; i < 4; i++) P(g, G('cVilRub', () => lumpy(new THREE.DodecahedronGeometry(0.6, 0), 0.3, 77)), FOL(0x4a443c), cx + (r() - 0.5) * w * 0.6, 0.2, cz + (r() - 0.5) * d * 0.6, r(), r(), 0, 1.4, 0.6, 1.2);
      P(g, cyl(1, 1, 0.02, 10), sootM, cx, 0.02, cz, 0, 0, 0, w * 0.4, 1, d * 0.4).castShadow = false;
    }
  };
  // жилой дом вокруг двора: x ∈ [−9, 5], z ∈ [−7, 5]
  wing(-2, -5.25, 14, 3.5, 5.2);
  wing(-7.25, 0.75, 3.5, 8.5, 3.8);
  wing(3.25, 0.75, 3.5, 8.5, 3.8);
  // фасадная стена двора с воротами
  for (const [x0, x1] of [[-5.5, -3.1], [-0.9, 1.5]]) { const hh = burnt ? 2.2 : 2.8; P(g, box(x1 - x0, hh, 0.45), plast, (x0 + x1) / 2, hh / 2, 4.78); P(g, box(x1 - x0 + 0.04, 0.6, 0.49), socle, (x0 + x1) / 2, 0.3, 4.78); colB(g, (x0 + x1) / 2, 4.78, x1 - x0, 0.45); }
  P(g, box(2.6, 0.35, 0.55), burnt ? beamM : M(C.stone), -2, burnt ? 2.0 : 2.95, 4.78, 0, 0, burnt ? 0.25 : 0);
  if (!burnt) for (const sx of [-1, 1]) { const lf = grp(g, -2 + sx * 1.1, 0, 4.6, 0, sx * -1.2, 0); P(lf, box(1.05, 2.4, 0.1), PLANK(), -sx * 0.52, 1.2, 0); }
  // знак Танит над воротами и на стеле
  if (!burnt) tanitSign(g, -2, 3.15, 5.08, 0.7, M(0x9a2a22));
  P(g, box(0.5, 1.4, 0.25), M(burnt ? 0x6a6258 : 0xd8ccb0), 0.1, 0.7, 6.0);
  tanitSign(g, 0.1, 0.55, 6.14, 0.55, M(burnt ? 0x2a2420 : 0x3a2a6a));
  colC(g, 0.1, 6.0, 0.35);
  // двери и окна, выходящие во двор
  for (const [x, z, ry] of [[-2, -3.48, 0], [-5.48, 1, HPI], [1.48, 1, -HPI], [-5.48, -1.6, HPI]]) P(g, box(1.0, 2.0, 0.06), dark, x, 1.0, z, 0, ry, 0);
  for (const [x, z, ry] of [[-6, -7.02, PI], [1, -7.02, PI], [-9.02, 2, -HPI], [5.02, 2, HPI]]) P(g, box(0.4, 0.5, 0.06), dark, x, 3.0, z, 0, ry, 0);
  // двор: цистерна, очаг-тандыр, амфоры
  P(g, cyl(0.55, 0.6, 0.8, 12), M(burnt ? 0x5a544c : 0xd8ccb0), -2, 0.4, 1.0); P(g, cyl(0.42, 0.42, 0.02, 12), dark, -2, 0.81, 1.0); colC(g, -2, 1.0, 0.65);
  P(g, lathe('cTannur', [[0, 0], [0.5, 0], [0.45, 0.6], [0.25, 0.85], [0, 0.85]], 10), M(burnt ? 0x3a2a20 : 0xb8643c), 0.3, 0, -2.2); colC(g, 0.3, -2.2, 0.5);
  if (!burnt) { for (let i = 0; i < 4; i++) amphora(g, -4.8 + i * 0.5, 0, -3.0, 1.1, 0xc8a080); sack(g, 0.6, 0, 3.4, 1); crate(g, -4.6, 0, 3.6, 0.9, 0.3); }
  else { for (let i = 0; i < 3; i++) P(g, lathe('cAmphBroken', [[0, 0], [0.17, 0.12], [0.19, 0.3], [0.12, 0.38], [0, 0.38]], 10), M(0x5a3a28), -4.8 + i * 0.6, 0, -3.0, 0.3 * i, i, 1.3); for (let i = 0; i < 3; i++) P(g, ico(0.14, 0), EMB(), -3 + i * 1.6, 0.1, 0.5 - i); }
  // амбар (поднят на каменный цоколь)
  P(g, box(4.4, 0.8, 5), socle, 8, 0.4, -5.5); colB(g, 8, -5.5, 4.4, 5);
  for (let i = 0; i < 4; i++) P(g, box(0.3, 0.2, 0.06), dark, 6.5 + i, 0.4, -2.98);
  const gh = burnt ? 2.6 : 3.8;
  P(g, box(4.0, gh, 4.6), plast, 8, 0.8 + gh / 2, -5.5);
  if (!burnt) { P(g, box(4.3, 0.25, 4.9), roofM, 8, 0.8 + gh + 0.12, -5.5); P(g, box(1.1, 1.8, 0.06), PLANK(), 8, 1.7, -3.18); stairs(g, 8, 0.8, -3.0, 1.2, 3, 0.27, 0.3); }
  else { P(g, box(4.06, 1.0, 4.66), sootM, 8, 0.8 + gh - 0.49, -5.5); P(g, box(0.25, 0.25, 4.2), beamM, 8, 1.6, -5.5, 0.45, 0.3, 0); P(g, box(1.1, 1.8, 0.06), dark, 8, 1.7, -3.18); P(g, cyl(1.2, 1.6, 0.4, 8), M(0x2a2420), 8, 0.9, -5.5); }
  // стога (у целой) / пепелища (у сожжённой)
  for (const [x, z, s] of [[7.6, 2.6, 1.0], [9.4, 5.6, 0.85], [5.6, 6.2, 0.75]]) {
    if (!burnt) { P(g, lathe('cHay', [[0, 0], [1.2, 0], [1.35, 0.8], [1.15, 1.7], [0.6, 2.4], [0, 2.6]], 10), THATCH(), x, 0, z, 0, 0, 0, s); P(g, cyl(0.04, 0.04, 1.2, 4), M(C.woodD), x, 2.6 * s + 0.3, z); }
    else { P(g, cone(1.3 * s, 0.35, 10), M(0x2a2622), x, 0.17, z); P(g, ico(0.15, 0), EMB(), x, 0.3, z); }
    colC(g, x, z, burnt ? 0.4 : 1.3 * s);
  }
  // пальма у дома
  if (!burnt) { const p = makeTree('palm'); p.position.set(-10.2, 0, 6.0); g.add(p); }
  else { for (let i = 0; i < 4; i++) P(g, cyl(0.2 - i * 0.015, 0.22 - i * 0.015, 1.15, 6), M(i % 2 ? 0x1e1814 : 0x2a221c), -10.2 + i * 0.05, 0.57 + i * 1.12, 6.0, 0, 0, -0.04); for (let i = 0; i < 4; i++) P(g, box(0.05, 0.05, 0.9), sootM, -10.0, 4.6, 6.0, 0.9, i * 1.6, 0); }
  colC(g, -10.2, 6.0, 0.35);
  // низкая ограда огорода
  for (const [x0, z0, x1, z1] of [[-11, -9, -11, 2.5], [-11, -9, -1, -9]]) { const b = beam(g, x0, z0, x1, z1, 0, 0.9, 0.45, burnt ? M(0x6a6258) : M(0xc8b898)); colB(g, b.cx, b.cz, b.len, 0.45, b.ry); }
}
POI.suburb_villa = (g) => villa(g, false);
POI.suburb_burnt = (g) => villa(g, true);

// ======================================================================
// 17. Наблюдательный пункт лазутчика
// ======================================================================
POI.spy_post = (g) => {
  const rk = FOL(0x8a8070), rk2 = FOL(0x9a9080);
  P(g, G('cSpyR1', () => lumpy(new THREE.DodecahedronGeometry(1.3, 1), 0.22, 301, 0.75)), rk, 0, 0.7, -0.6, 0.1, 0.5, 0, 1.2, 1, 1);
  P(g, G('cSpyR2', () => lumpy(new THREE.DodecahedronGeometry(0.9, 0), 0.25, 302, 0.8)), rk2, 1.5, 0.45, -1.3, 0.3, 1.2, 0.1);
  P(g, G('cSpyR3', () => lumpy(new THREE.DodecahedronGeometry(0.6, 0), 0.3, 303)), rk, -1.4, 0.3, -1.4, 0.4, 0.2, 0.2);
  for (let i = 0; i < 4; i++) P(g, ico(0.18, 0), rk2, -1.5 + i * 0.9, 0.08, 0.9 + (i % 2) * 0.4, i, i, 0, 1, 0.5, 1);
  const b = makeBush('med'); b.position.set(1.0, 0, 0.6); g.add(b);
  const b2 = makeBush('dry'); b2.position.set(-1.3, 0, -0.1); b2.scale.setScalar(0.8); g.add(b2);
  const st = grp(g, -0.6, 0, 1.2, 0.12, 0, -0.08);
  P(st, cyl(0.022, 0.028, 1.4, 5), M(0x6a4a2a), 0, 0.6, 0);
  const rag = P(st, G('cSpyRag', () => { const q = new THREE.PlaneGeometry(0.22, 0.3, 1, 2); const p = q.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 9) * 0.03); q.translate(0.11, -0.15, 0); q.computeVertexNormals(); return q; }), M(0xb02a1e, { side: THREE.DoubleSide }), 0.02, 1.28, 0, 0, 0.4, -0.15);
  rag.castShadow = false;
  g.userData.rag = rag;
  colC(g, 0, -0.6, 1.5); colC(g, 1.5, -1.3, 0.9);
};

// ======================================================================
// 18. Знамёна: пунийское (пурпур, знак Танит с полумесяцем) и римское
// ======================================================================
function drawPunicBanner(x, n) {
  x.fillStyle = '#4a1a5a'; x.fillRect(0, 0, n, n);
  x.strokeStyle = '#c8a040'; x.lineWidth = n / 22; x.strokeRect(n * 0.05, n * 0.05, n * 0.9, n * 0.9);
  x.fillStyle = '#e8d090';
  x.beginPath(); x.moveTo(n * 0.3, n * 0.86); x.lineTo(n * 0.7, n * 0.86); x.lineTo(n * 0.5, n * 0.46); x.closePath(); x.fill();
  x.fillRect(n * 0.28, n * 0.43, n * 0.44, n * 0.05);
  x.fillRect(n * 0.28, n * 0.36, n * 0.04, n * 0.1); x.fillRect(n * 0.68, n * 0.36, n * 0.04, n * 0.1);
  x.beginPath(); x.arc(n * 0.5, n * 0.33, n * 0.075, 0, TAU); x.fill();
  x.beginPath(); x.arc(n * 0.5, n * 0.17, n * 0.085, 0, TAU); x.fill();
  x.fillStyle = '#4a1a5a'; x.beginPath(); x.arc(n * 0.5, n * 0.13, n * 0.075, 0, TAU); x.fill();
}
const PUNIC_BAN = () => texMat('punicBan', () => canvasTex('c_punicBan', 128, drawPunicBanner, 1), 0xffffff, { side: THREE.DoubleSide });
export function makePunicBanner(h = 5.5) {
  const g = newRoot('banner_punic');
  P(g, box(0.6, 0.35, 0.6), M(0xb8a888), 0, 0.17, 0);
  P(g, cyl(0.04, 0.05, h, 6), M(C.woodD), 0, h / 2, 0);
  P(g, cyl(0.03, 0.03, 1.15, 5), M(C.woodD), 0, h - 0.25, 0.03, 0, 0, HPI);
  const br = bronzeM();
  P(g, cyl(0.1, 0.1, 0.02, 12), br, 0, h + 0.14, 0, HPI);
  P(g, tor(0.12, 0.022, 4, 10, PI), br, 0, h + 0.3, 0, PI);
  const cl = P(g, G('cPunBanQ', () => { const q = new THREE.PlaneGeometry(1.0, 1.35, 1, 5); const p = q.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 3) * 0.035); q.computeVertexNormals(); return q; }), PUNIC_BAN(), 0, h - 0.95, 0.04);
  cl.castShadow = false;
  for (let i = 0; i < 6; i++) P(g, cyl(0.012, 0.012, 0.16, 4), goldM(), -0.42 + i * 0.168, h - 1.7, 0.04);
  g.userData.cloth = cl;
  g.userData.colliders.push({ x: 0, z: 0, r: 0.35 });
  return g;
}
export function makeRomanBanner(h = 5.0) {
  const g = newRoot('banner_roman');
  P(g, box(0.6, 0.35, 0.6), M(C.stone), 0, 0.17, 0);
  const b = banner(g, 0, 0.3, 0, h, 0, 'spqr');
  P(g, sph(0.08, 8, 6), goldM(), 0, h + 0.45, 0);
  g.userData.cloth = b.userData.cloth;
  g.userData.colliders.push({ x: 0, z: 0, r: 0.35 });
  return g;
}

// ======================================================================
// Поле Марса (Бруттий): дом распорядителя игр и хижины деревни у гавани
// ======================================================================
POI.games_house = (g) => {
  g.userData.colliders = g.userData.colliders || [];
  plinth(g, 0, 0, 12, 9, 0.5);
  wall(g, 0, 0.5, 0, 11, 4.6, 8, 0, { col: 0xe8dcc4, dadoCol: 0x9a3a2a });
  gable(g, 0, 5.1, 0, 11.6, 8.6, 0.42, 0.35, 'x', { col: 0xb04a32 });
  door(g, 0, 0.5, 4.02, 0, 1.8, 2.8, true);
  for (const x of [-3.2, 3.2]) { win(g, x, 2.8, 4.02); column(g, x * 1.4, 0.5, 4.9, 4.2, 0.24, 'tuscan', M(C.marble)); }
  banner(g, -5.2, 0.5, 5.6, 4.6, 0, 'spqr'); banner(g, 5.2, 0.5, 5.6, 4.6, 0, 'spqr');
  statue(g, 0, 0.5, 7.2, 0.9, bronzeM(), 0);
  for (const x of [-2.2, 2.2]) P(g, box(0.5, 1.6, 0.5), M(0x6a4a2a), x, 0.8, 7.8); // стойки с оружием
  P(g, box(5, 0.1, 0.4), M(0x6a4a2a), 0, 1.5, 7.8);
  colB(g, 0, 0, 11.4, 8.4);
};
POI.war_hut = (g) => {
  g.userData.colliders = g.userData.colliders || [];
  plinth(g, 0, 0, 6, 5, 0.3);
  wall(g, 0, 0.3, 0, 5.4, 2.8, 4.4, 0, { col: 0xd8c8a8 });
  gable(g, 0, 3.1, 0, 6, 5, 0.5, 0.3, 'x', { col: 0x8a6a3a });
  door(g, 0, 0.3, 2.22, 0, 1.1, 2.0);
  P(g, cyl(0.5, 0.45, 0.8, 10), M(0x8a6a4a), 2.4, 0.4, 2.8);
  colB(g, 0, 0, 5.6, 4.6);
};
export const CITY_MODELS = ['forum_m', 'curia', 'stall', 'mercator', 'servile', 'theatrum', 'armamentarium', 'castellum'];
export const CITY_POI = ['suburb_villa', 'suburb_burnt', 'spy_post'];
