import { inHarborZone } from './harbors.js';
import { planCrate, applyCratePlan } from '../public/rpg/crates.js';
// Торговые пути: заказы ящиков в латифундии/колонии → склад торгового поста → морские пути (свои корабли)
// и караваны повозок по римским дорогам → торговцы, Рим (Остия), рынки римских городов. Пираты и разбойники.
import { G, D, WG, now, dist, rand, randi, pick, nid, send, log, hasAll, payAll, rankOf, hasOffice, officesOf, book } from './state.js';
import { grantXp, grantDig } from './combat.js';
import { storyCheck } from './society.js';

const { BUILDINGS, CRATES, SHIPS } = D;
const say = (p, text, kind = 'warn') => send(p, { type: 'log', text, kind });
const B = (id) => G.W.buildings.find((b) => b.id === id);
const sayChar = (cid, text, kind = 'info') => { for (const p of G.players.values()) if (p.char && p.char.id === cid) send(p, { type: 'log', text, kind }); };
export const WAGON = { price: 160, crates: 4, speed: 3.6 }, GUARD_PAY = 6;
export const routeLimit = (c) => 1 + Math.floor(rankOf(c) / 2) + (hasOffice(c, 'magister') ? 2 : 0) + (officesOf(c).length ? 1 : 0);
const routes = () => (G.W.routes = G.W.routes || []);
const isPost = (b, kind) => b && b.built && (kind ? b.type === (kind === 'sea' ? 'emporium' : 'statio') : b.type === 'emporium' || b.type === 'statio');
// источник товаров для заказа: колония (её склад) или латифундия (склады построек владельца вокруг виллы)
function sources(b) {
  if (b.type === 'colonia') return [b];
  const own = b.owner; return G.W.buildings.filter((x) => x.owner === own && x.built && x.store && Math.hypot(x.x - b.x, x.z - b.z) < 140);
}
// ---------- Заказы на ящики: работники собирают их и раз в минуту складывают на склад поста ----------
export function orderMsg(p, m) {
  const c = p.char;
  if (m.type === 'crateOrder') {
    const post = B(m.post); if (!post || post.owner !== c.id || !isPost(post)) return say(p, 'Выберите свой торговый пост.');
    if (!CRATES[m.k]) return;
    const n = Math.max(0, Math.min(99, m.n | 0));
    post.orders = post.orders || {}; if (n) post.orders[m.k] = n; else delete post.orders[m.k];
    say(p, n ? `Заказ: ${CRATES[m.k].name} ×${n}. Работники соберут их из запасов ваших хозяйств и сложат на склад поста.` : 'Заказ снят.', 'good');
    G.dirtyBld = true;
  }
}
function orderTick() {
  for (const post of G.W.buildings) {
    if (!isPost(post) || !post.orders) continue;
    const owner = G.chars[post.owner]; if (!owner) continue;
    const base = post.near ? B(post.near) : null;
    const srcs = sources(base || post);
    const workers = G.W.slaves.filter((s) => s.owner === post.owner && s.bld && srcs.some((b) => b.id === s.bld)).length;
    let made = 0, cap = 1 + Math.floor(workers / 2); // за минуту
    post.crates = post.crates || {};
    for (const [k, n] of Object.entries(post.orders)) {
      while (made < cap && post.orders[k] > 0 && Object.values(post.crates).reduce((a, x) => a + x, 0) < 40) {
        if (!CRATES[k] || (CRATES[k].lvl || 0) > owner.level) break;
        const stocks = srcs.map(b => b.store || {}), lists = srcs.map(b => b.items || []);
        const plan = planCrate(k, stocks, lists.flat()); if (!plan.ok) break;
        applyCratePlan(plan, stocks, lists);
        post.crates[k] = (post.crates[k] || 0) + 1; post.orders[k]--; made++;
      }
      if (!post.orders[k]) delete post.orders[k];
    }
    if (made) G.dirtyBld = true;
  }
}
// ---------- Пути ----------
const SEA_S = 22, SX0 = -CFGW(), NS = Math.ceil(2 * CFGW() / SEA_S);
function CFGW() { return D.CFG.world; }
let SEA = null;
function seaGrid() {
  if (SEA) return SEA;
  SEA = new Uint8Array(NS * NS);
  for (let j = 0; j < NS; j++) for (let i = 0; i < NS; i++) { const x = SX0 + (i + 0.5) * SEA_S, z = SX0 + (j + 0.5) * SEA_S; SEA[j * NS + i] = WG.shipOk(x, z) && WG.terrainHeight(x, z) < -3 ? 1 : 0; }
  return SEA;
}
export function seaPath(a, b) {
  const g = seaGrid(), cell = (x, z) => [Math.max(0, Math.min(NS - 1, Math.floor((x - SX0) / SEA_S))), Math.max(0, Math.min(NS - 1, Math.floor((z - SX0) / SEA_S)))];
  const near = (x, z) => { let [i, j] = cell(x, z); if (g[j * NS + i]) return j * NS + i; for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < NS && jj < NS && g[jj * NS + ii]) return jj * NS + ii; } return -1; };
  const s0 = near(a.x, a.z), t0 = near(b.x, b.z); if (s0 < 0 || t0 < 0) return null;
  const N = NS * NS, gs = new Float32Array(N).fill(1e30), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = [];
  const push = (o, f) => { heap.push([f, o]); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const ti = t0 % NS, tj = (t0 / NS) | 0; gs[s0] = 0; push(s0, 0);
  while (heap.length) { const [, o] = pop(); if (done[o]) continue; done[o] = 1; if (o === t0) break; const i = o % NS, j = (o / NS) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= NS || nj >= NS) continue; const q = nj * NS + ni; if (done[q] || !g[q]) continue; const c = gs[o] + Math.hypot(di, dj); if (c < gs[q]) { gs[q] = c; from[q] = o; push(q, c + Math.hypot(ni - ti, nj - tj)); } } }
  if (from[t0] < 0 && s0 !== t0) return null;
  const pts = []; for (let o = t0; o >= 0; o = from[o]) pts.push([SX0 + (o % NS + 0.5) * SEA_S, SX0 + (((o / NS) | 0) + 0.5) * SEA_S]);
  pts.reverse();
  return pts.filter((p, i) => i % 3 === 0 || i === pts.length - 1);
}
// путь по дорогам: от поста к ближайшей точке дороги, по сети дорог до города
function roadPath(a, cityId) {
  const roads = WG.roadsList(); if (!roads.length) return null;
  let best = null, bd = 1e9;
  for (const r of roads) r.pts.forEach((q, k) => { const d = Math.hypot(q[0] - a.x, q[1] - a.z); if (d < bd) { bd = d; best = { r, k }; } });
  if (!best || bd > 400) return null;
  // граф городов
  const adj = {}; for (const r of roads) { (adj[r.a] = adj[r.a] || []).push(r); (adj[r.b] = adj[r.b] || []).push(r); }
  const tryDir = (endCity, part) => { // от точки дороги к городу endCity, затем поиск в ширину до цели
    const seq = [part]; if (endCity === cityId) return seq;
    const prev = { [endCity]: null }, q = [endCity];
    while (q.length) { const c = q.shift(); if (c === cityId) break; for (const r of adj[c] || []) { const o = r.a === c ? r.b : r.a; if (o in prev) continue; prev[o] = { c, r }; q.push(o); } }
    if (!(cityId in prev)) return null;
    const chain = []; for (let c = cityId; prev[c]; c = prev[c].c) chain.unshift(prev[c]);
    for (const { c, r } of chain) seq.push(r.a === c ? r.pts : r.pts.slice().reverse());
    return seq;
  };
  const { r, k } = best;
  const toB = tryDir(r.b, r.pts.slice(k)), toA = tryDir(r.a, r.pts.slice(0, k + 1).reverse());
  const len = (seq) => seq ? seq.reduce((a, s) => a + s.length, 0) : 1e9;
  const seq = len(toB) <= len(toA) ? toB : toA; if (!seq) return null;
  const C = WG.cityById(cityId), out = [[a.x, a.z]]; for (const s of seq) out.push(...s); out.push([C.x, C.z]);
  return out;
}
// куда можно ехать
export function destinations(kind) {
  if (kind === 'sea') return [...(G.world.traders || []).filter((t) => !t.river).map((t) => ({ id: t.id, name: t.name, x: t.x, z: t.z, mult: t.mult, rome: !!t.rome })),
    ...G.world.cities.filter((C) => C.harbor && G.W.cityState[C.id] && G.W.cityState[C.id].owner === 'rome').map((C) => ({ id: 'city:' + C.id, name: 'Рынок ' + C.name, x: C.hx + Math.sin(C.ry) * 40, z: C.hz + Math.cos(C.ry) * 40, mult: 0.95, city: C.id }))];
  return G.world.cities.filter((C) => G.W.cityState[C.id] && G.W.cityState[C.id].owner === 'rome').map((C) => ({ id: 'city:' + C.id, name: 'Лавки рынка ' + C.name, x: C.x, z: C.z, mult: 1.0, city: C.id }));
}
export function routeMsg(p, m) {
  const c = p.char, R = routes();
  if (m.type === 'routeNew') {
    const post = B(m.post); if (!post || post.owner !== c.id || !isPost(post)) return say(p, 'Нужен свой торговый пост (морской или сухопутный).');
    const kind = post.type === 'emporium' ? 'sea' : 'land';
    if (R.filter((r) => r.owner === c.id).length >= routeLimit(c)) return say(p, `Ваше звание и должность позволяют не больше ${routeLimit(c)} торговых путей.`);
    const dst = destinations(kind).find((d) => d.id === m.dest); if (!dst) return say(p, 'Нет такого места назначения.');
    const path = kind === 'sea' ? seaPath(post, dst) : roadPath(post, dst.city);
    if (!path || path.length < 2) return say(p, kind === 'sea' ? 'Морем туда не пройти от этого поста.' : 'От поста до дорог слишком далеко (до 400 м) или дорога не ведёт в этот город.');
    const r = { id: nid(), owner: c.id, ownerName: c.name, kind, post: post.id, dest: dst.id, destName: dst.name, path, ships: [], wagons: kind === 'land' ? 1 : 0, guards: 0, cargo: m.cargo && CRATES[m.cargo] ? m.cargo : null, on: false, trips: 0, earned: 0, lost: 0 };
    R.push(r); say(p, `🛤 Торговый путь: ${post.type === 'emporium' ? 'морской' : 'караван'} → ${dst.name} (${Math.round(path.length)} точек пути).`, 'good');
  } else {
    const r = R.find((x) => x.id === m.rid && x.owner === c.id); if (!r) return;
    if (m.type === 'routeDel') { stopRoute(r); G.W.routes = R.filter((x) => x !== r); say(p, 'Путь закрыт.', 'info'); }
    else if (m.type === 'routeShip') { // назначить/снять корабль
      const s = G.W.ships.find((x) => x.id === m.sid && x.owner === c.id); if (!s || r.kind !== 'sea') return;
      if (m.on) { if (s.route && s.route !== r.id) return say(p, 'Корабль уже на другом пути.'); if ([...G.players.values()].some((q) => q.ship === s.id)) return say(p, 'Сначала сойдите с корабля.'); if (!r.ships.includes(s.id)) r.ships.push(s.id); }
      else { r.ships = r.ships.filter((x) => x !== s.id); if (s.route === r.id) { s.route = null; s.speed = 0; } }
    } else if (m.type === 'routeWagons') { const n = Math.max(1, Math.min(6, m.n | 0)); if (n > r.wagons) { const cost = (n - r.wagons) * WAGON.price; if (c.den < cost) return say(p, `Повозки стоят ${WAGON.price} ден. за штуку.`); c.den -= cost; book(c, 'Расход: повозки торгового пути', -cost); } r.wagons = n; }
    else if (m.type === 'routeGuards') r.guards = Math.max(0, Math.min(20, m.n | 0));
    else if (m.type === 'routeCargo') r.cargo = m.cargo && CRATES[m.cargo] ? m.cargo : null;
    else if (m.type === 'routeToggle') { r.on = !r.on; if (!r.on) stopRoute(r); else if (r.kind === 'sea' && !r.ships.length) { r.on = false; return say(p, 'Назначьте на путь хотя бы один свой корабль (торговый везёт 10 ящиков, военные охраняют).'); } }
  }
  p.dirtyChar = true; G.dirtyWorld = true;
}
function stopRoute(r) { for (const sid of r.ships) { const s = G.W.ships.find((x) => x.id === sid); if (s && s.route === r.id) { s.route = null; s.speed = 0; } } G.convoys.delete(r.id); }
// ---------- Движение обозов и кораблей ----------
G.convoys = G.convoys || new Map(); // id пути → {x,z,ry,i,dir,state,load,t}
const capOf = (r) => r.kind === 'sea' ? r.ships.reduce((a, sid) => { const s = G.W.ships.find((x) => x.id === sid); return a + (s ? (SHIPS[s.type].ram ? 0 : SHIPS[s.type].crates) : 0); }, 0) : r.wagons * WAGON.crates;
const guardsOf = (r) => r.kind === 'sea' ? r.ships.filter((sid) => { const s = G.W.ships.find((x) => x.id === sid); return s && SHIPS[s.type].ram; }).length * 3 + G.W.slaves.filter((x) => x.ship && r.ships.includes(x.ship)).length * 0.5 : r.guards;
function routeTick(dt) {
  const t = now();
  for (const r of routes()) {
    if (!r.on) continue;
    const post = B(r.post); if (!post || !post.built) { r.on = false; continue; }
    let v = G.convoys.get(r.id);
    if (!v) { v = { x: r.path[0][0], z: r.path[0][1], ry: 0, i: 0, dir: 1, state: 'load', load: [], t: t, kind: r.kind, owner: r.owner, rid: r.id }; G.convoys.set(r.id, v); }
    if (v.state === 'load') {
      if (t < v.t) continue;
      const cap = capOf(r); if (!cap) { v.t = t + 10; continue; }
      post.crates = post.crates || {};
      for (const k of Object.keys(post.crates)) while (v.load.length < cap && post.crates[k] > 0 && (!r.cargo || r.cargo === k)) { post.crates[k]--; v.load.push(k); }
      for (const k of Object.keys(post.crates)) if (!post.crates[k]) delete post.crates[k];
      if (!v.load.length) { v.t = t + 15; continue; }
      if (r.kind === 'land' && r.guards) { const ow = G.chars[r.owner]; const pay = r.guards * GUARD_PAY; if (ow && ow.den >= pay) { ow.den -= pay; book(ow, 'Расход: охрана караванов', -pay); } else r.guardsUnpaid = true; }
      v.state = 'go'; v.dir = 1; v.i = 0; v.risk = false; G.dirtyBld = true;
    }
    if (v.state === 'go' || v.state === 'back') {
      const sp = (r.kind === 'sea' ? 7.5 : WAGON.speed) * dt;
      const nxt = r.path[v.i + v.dir];
      if (!nxt) { if (v.state === 'go') arrive(r, v); else { v.state = 'load'; v.t = t + 5; } continue; }
      const dx = nxt[0] - v.x, dz = nxt[1] - v.z, d = Math.hypot(dx, dz);
      if (d < sp + 0.5) { v.x = nxt[0]; v.z = nxt[1]; v.i += v.dir; } else { v.x += dx / d * sp; v.z += dz / d * sp; v.ry = Math.atan2(dx, dz); }
      // нападение разбойников или пиратов — посреди пути
      if (v.state === 'go' && !v.risk && v.i > r.path.length * 0.45) { v.risk = true; ambush(r, v); }
      // корабли пути идут строем
      if (r.kind === 'sea') r.ships.forEach((sid, k) => { const s = G.W.ships.find((x) => x.id === sid); if (!s) return; s.route = r.id; const off = k * 16; s.x = v.x - Math.sin(v.ry) * off + Math.cos(v.ry) * (k % 2 ? 7 : -7) * (k ? 1 : 0); s.z = v.z - Math.cos(v.ry) * off - Math.sin(v.ry) * (k % 2 ? 7 : -7) * (k ? 1 : 0); s.ry = v.ry; s.speed = 6; s.berth = null; });
    }
  }
}
function ambush(r, v) {
  const sea = r.kind === 'sea';
  if (sea && inHarborZone(v.x, v.z)) return;
  if (sea && (G.W.pirateCalm || 0) > Date.now() / 1000) return;
  const risk = (sea ? 0.28 : 0.24) / (1 + guardsOf(r) * 0.35);
  if (Math.random() > risk) return;
  const lose = Math.max(1, Math.ceil(v.load.length * (0.3 + Math.random() * 0.4)));
  const lost = v.load.splice(0, lose); r.lost += lost.length;
  sayChar(r.owner, `${sea ? '🏴 Пираты' : '🗡 Разбойники'} напали на ваш ${sea ? 'морской путь' : 'караван'} (${r.destName}) и забрали ${lost.length} ящ. Больше охраны — меньше потерь.`, 'bad');
}
function arrive(r, v) {
  const dst = destinations(r.kind).find((d) => d.id === r.dest);
  const ow = G.chars[r.owner];
  let total = 0;
  if (dst && ow) for (const k of v.load) {
    const pr = Math.round(CRATES[k].price * (dst.mult || 1) * D.derived(ow).sell);
    total += pr;
    if (dst.rome) { G.W.romeSent = G.W.romeSent || {}; G.W.romeSent[k] = (G.W.romeSent[k] || 0) + 1; ow.dig = (ow.dig || 0) + CRATES[k].grade * 2; }
  }
  if (ow) { ow.den += total; ow.stats2 = ow.stats2 || {}; ow.stats2.traded = (ow.stats2.traded || 0) + total; }
  r.trips++; r.earned += total;
  if (v.load.length) sayChar(r.owner, `⚖ ${r.kind === 'sea' ? 'Корабли' : 'Караван'} продали ${v.load.length} ящ. в «${r.destName}» за ${total} ден.`, 'good');
  if (dst && dst.rome) storyCheck();
  v.load = []; v.state = 'back'; v.dir = -1; G.dirtyWorld = true;
}
let acc = 0, accO = 0;
export function routesTick(dt) {
  routeTick(dt);
  accO += dt; if (accO >= 60) { accO = 0; orderTick(); }
}
// караваны для рассылки: [id, kind, x, z, ry, грузов]
export const convoyState = () => [...G.convoys.values()].filter((v) => v.kind === 'land' && (v.state === 'go' || v.state === 'back')).map((v) => [v.rid, 0, Math.round(v.x * 10) / 10, Math.round(v.z * 10) / 10, Math.round(v.ry * 100) / 100, v.load.length]);
export const routesOf = (cid) => routes().filter((r) => r.owner === cid).map((r) => { const v = G.convoys.get(r.id); return { ...r, path: undefined, plen: r.path.length, state: v ? v.state : 'idle', load: v ? v.load.length : 0, cap: capOf(r), guardsEff: Math.round(guardsOf(r) * 10) / 10 }; });
