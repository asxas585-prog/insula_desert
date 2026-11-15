// Карта препятствий для существ (сетка 1 м): стены городов, опоры акведуков, деревья и камни, здания.
// Быстрая проверка «можно ли сюда шагнуть» и поиск пути A* в обход, когда существо упёрлось.
import fs from 'fs';
import { G, D, WG, now, log } from './state.js';
// препятствия моделей зданий (снимаются из браузера: node tools/extract-colliders.mjs) — те же, что у игрока
let BCOL = {}; try { BCOL = JSON.parse(fs.readFileSync(new URL('../public/rpg/colliders.json', import.meta.url), 'utf8')); } catch { BCOL = {}; }

const C = 1, HALF = 2700, N = (HALF * 2) / C; // мир ±2600 м (подземелья — отдельно)
let ST = null; // статичные препятствия: стены, акведуки, деревья, камни
let BL = null, blKey = ''; // здания (перестраивается при изменениях)
const idx = (x, z) => { const i = Math.floor((x + HALF) / C), j = Math.floor((z + HALF) / C); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
const SET = (A, o) => { A[o >> 3] |= 1 << (o & 7); }, GET = (A, o) => (A[o >> 3] >> (o & 7)) & 1;
const mk = () => new Uint8Array(Math.ceil(N * N / 8)); // по биту на клетку
function disc(A, x, z, r) { for (let dz = -r; dz <= r; dz += C) for (let dx = -r; dx <= r; dx += C) if (dx * dx + dz * dz <= r * r) { const o = idx(x + dx, z + dz); if (o >= 0) SET(A, o); } }
function rect(A, x, z, hw, hd, ry) {
  const c = Math.cos(ry), s = Math.sin(ry), R = Math.hypot(hw, hd);
  for (let dz = -R; dz <= R; dz += C * 0.7) for (let dx = -R; dx <= R; dx += C * 0.7) { const lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) <= hw && Math.abs(lz) <= hd) { const o = idx(x + dx, z + dz); if (o >= 0) SET(A, o); } }
}
// здания, по которым ходят (площади, причалы, дороги, мосты) или которые сами — поле боя
const WALKABLE = new Set(['forum_m', 'forum', 'portus', 'via', 'via_turn', 'via_cross', 'pons', 'amphitheatrum', 'colonia']);
export function buildStatic() {
  ST = mk();
  const W = G.world;
  for (const Cy of W.cities || []) {
    const gh = 5.5 / Cy.R, ad = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    const n = Math.ceil(Math.PI * 2 * Cy.R / 0.6);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2; if (Cy.gates.some((g) => Math.abs(ad(a, g.a)) < gh)) continue;
      const x = Cy.x + Math.sin(a) * Cy.R, z = Cy.z + Math.cos(a) * Cy.R;
      if (WG.terrainHeight(x, z) <= -0.25 || WG.waterEdgeDist(x, z) <= 3 ) continue; // поперёк мола (на линии стен) существа тоже не проходят — в город только через ворота // над морем и у начала мола стен нет
      for (let t = -1.4; t <= 1.4; t += 0.7) { const o = idx(Cy.x + Math.sin(a) * (Cy.R + t), Cy.z + Math.cos(a) * (Cy.R + t)); if (o >= 0) SET(ST, o); }
    }
    if (Cy.aqueduct) { // опоры аркад (через пролёты можно пройти)
      const [fx, fz] = Cy.aqueduct.from, [tx, tz] = Cy.aqueduct.to, L = Math.hypot(tx - fx, tz - fz), m = Math.max(1, Math.round(L / 10));
      for (let i = 0; i <= m; i++) disc(ST, fx + (tx - fx) * i / m, fz + (tz - fz) * i / m, 1.6);
    }
  }
  for (const r of W.riverRocks || []) disc(ST, r.x, r.z, r.s * 0.7);
  for (const nd of W.nodes) { if (nd.kind === 'murex' || nd.kind === 'papyrus' || nd.kind === 'reed') continue; const r = Math.max(0.5, (nd.res === 'wood' || /tree|pine|oak|palm|cedar|olive|cypress/.test(nd.kind) ? 0.45 : 0.85) * (nd.s || 1)); disc(ST, nd.x, nd.z, r); }
}
function buildBlds() {
  const bs = G.W.buildings, key = bs.length + ':' + bs.reduce((a, b) => a + (b.built ? b.id * 7 + Math.round(b.x) * 3 + Math.round(b.z) : 0), 0);
  if (BL && key === blKey) return; blKey = key;
  BL = mk();
  for (const b of bs) {
    const bd = D.BUILDINGS[b.type]; if (!bd || !(b.built || b.muni) || bd.road) continue; // руины городских зданий — тоже препятствие (как у игрока)
    const L = BCOL[b.type], ry = b.ry || 0, c = Math.cos(ry), sn = Math.sin(ry);
    if (L) { for (const k of L) { const x = b.x + k[0] * c + k[1] * sn, z = b.z - k[0] * sn + k[1] * c; if (k.length === 3) disc(BL, x, z, k[2] + 0.3); else rect(BL, x, z, Math.max(0.55, k[2] / 2 + 0.25), Math.max(0.55, k[3] / 2 + 0.25), ry + k[4]); } continue; }
    if (WALKABLE.has(b.type)) continue;
    rect(BL, b.x, b.z, bd.r * 0.74, bd.r * 0.74, ry);
  }
}
let lastCheck = 0;
export function navTick(t) { if (!ST) buildStatic(); if (t - lastCheck > 2) { lastCheck = t; buildBlds(); } }
// можно ли стоять в точке (без учёта воды); goalBld — здание-цель набега (к нему подходят вплотную)
export function free(x, z, goalBld = null) {
  if (!ST) buildStatic(); if (!BL) buildBlds();
  const o = idx(x, z); if (o < 0) return true;
  if (GET(ST, o)) return false;
  if (gateShut(x, z)) return false;
  if (GET(BL, o)) { if (goalBld && Math.abs(x - goalBld.x) < 40 && Math.abs(z - goalBld.z) < 40) return true; return false; }
  return true;
}
// A* по сетке 2 м в окне ±R вокруг старта; возвращает путевые точки или null
export function findPath(sx, sz, tx, tz, ok, R = 120) {
  const S = 2, n = Math.ceil(R * 2 / S), x0 = sx - R, z0 = sz - R;
  let ti = Math.round((tx - x0) / S), tj = Math.round((tz - z0) / S);
  ti = Math.max(0, Math.min(n - 1, ti)); tj = Math.max(0, Math.min(n - 1, tj));
  const si = Math.round(R / S), sj = si, NN = n * n, g = new Float32Array(NN).fill(1e9), from = new Int32Array(NN).fill(-1), done = new Uint8Array(NN), blk = new Uint8Array(NN);
  const pass = (i, j) => { const o = j * n + i; if (blk[o]) return blk[o] === 1; const v = ok(x0 + i * S, z0 + j * S) ? 1 : 2; blk[o] = v; return v === 1; };
  const heap = [], push = (o, f) => { heap.push([f, o]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const s0 = sj * n + si, t0 = tj * n + ti; g[s0] = 0; push(s0, 0);
  let best = s0, bh = 1e9, it = 0;
  while (heap.length && it++ < 9000) {
    const [, o] = pop(); if (done[o]) continue; done[o] = 1;
    const i = o % n, j = (o / n) | 0, h = Math.hypot(i - ti, j - tj); if (h < bh) { bh = h; best = o; }
    if (o === t0) break;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const q = nj * n + ni; if (done[q] || !pass(ni, nj)) continue;
      if (di && dj && (!pass(i + di, j) || !pass(i, j + dj))) continue; // без срезания углов
      const ng = g[o] + (di && dj ? 1.414 : 1); if (ng < g[q]) { g[q] = ng; from[q] = o; push(q, ng + Math.hypot(ni - ti, nj - tj)); }
    }
  }
  if (best === s0) return null;
  const pts = []; for (let o = best; o >= 0 && o !== s0; o = from[o]) pts.push([x0 + (o % n) * S, z0 + ((o / n) | 0) * S]);
  pts.reverse();
  // прореживаем: оставляем каждую 3-ю точку и последнюю
  return pts.filter((p, k) => k % 3 === 2 || k === pts.length - 1);
}

// ---------- Ворота городов: запираются должностными лицами, варвары их ломают ----------
export const GATE_HP = 900;
export function gateState(cid) { const W = G.W; W.gates = W.gates || {}; return (W.gates[cid] = W.gates[cid] || { closed: false, hp: GATE_HP }); }
function gateShut(x, z) {
  const W = G.W; if (!W || !W.gates) return false;
  for (const C of G.world.cities || []) {
    const st = W.gates[C.id]; if (!st || !st.closed || st.hp <= 0) continue;
    if (Math.abs(x - C.x) > C.R + 8 || Math.abs(z - C.z) > C.R + 8) continue;
    for (const g of C.gates) if (Math.abs(x - g.x) < 6 && Math.abs(z - g.z) < 6 && Math.hypot(x - g.x, z - g.z) < 5.2) return true;
  }
  return false;
}
// моб снаружи, цель внутри стен, ворота заперты и целы → к каким воротам ломиться
export function cityGateBlock(m, b) {
  const W = G.W; if (!W.gates) return null;
  for (const C of G.world.cities || []) {
    const st = W.gates[C.id]; if (!st || !st.closed || st.hp <= 0) continue;
    if (Math.hypot(b.x - C.x, b.z - C.z) > C.R - 2 || Math.hypot(m.x - C.x, m.z - C.z) < C.R + 1) continue;
    let g = null, bd = 1e9; for (const q of C.gates) { const d = Math.hypot(q.x - m.x, q.z - m.z); if (d < bd) { bd = d; g = q; } }
    if (g) return { city: C.id, g };
  }
  return null;
}
export function hitGate(cid, dmg) {
  const st = gateState(cid); if (st.hp <= 0) return;
  st.hp = Math.max(0, st.hp - dmg); G.dirtyWorld = true;
  const C = G.world.cities.find((c) => c.id === cid);
  if (st.hp <= 0) log(`💥 Враги проломили ворота: ${C ? C.name : cid}! Ворота открыты, пока их не починят.`, 'bad');
  else if (!st.warnAt || now() - st.warnAt > 20) { st.warnAt = now(); log(`🔨 Враги ломают ворота ${C ? C.name : cid}: прочность ${Math.round(st.hp / GATE_HP * 100)}%. Стреляйте с башен!`, 'bad'); }
}
// раз в секунду: вне набега ворота чинятся сами
export function gateTick() {
  const W = G.W; if (!W.gates) return;
  const raid = (W.events || []).some((e) => e.kind === 'raid' && e.live);
  for (const st of Object.values(W.gates)) if (!raid && st.hp < GATE_HP) { st.hp = Math.min(GATE_HP, st.hp + 15); G.dirtyWorld = true; }
}
