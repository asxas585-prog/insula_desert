import { G, D, WG, dist, send, addRes, takeRes, now } from './state.js';
const STORE_TYPES = new Set(['warehouse', 'horreum_s', 'supply_depot']);
export function logisticsScope(pos) {
  if (pos.city) return 'city:' + pos.city;
  let closest = null, distance = Infinity;
  for (const c of G.world.cities || []) { const d = dist(pos, c); if (d <= c.R + 230 && d < distance) { closest = c; distance = d; } }
  if (closest) return 'city:' + closest.id;
  if (pos.owner && G.chars[pos.owner]?.lat && dist(pos, G.chars[pos.owner].lat) < G.chars[pos.owner].lat.half * 1.5) return 'estate:' + pos.owner;
  return 'island:' + (pos.island || WG.islandAt(pos.x, pos.z)?.id || 'main') + ':' + Math.floor(pos.x / 180) + ':' + Math.floor(pos.z / 180);
}
export const usableStore = b => STORE_TYPES.has(b.type) && b.built && !b.ruined && !b.enemy;
export const privateStores = (c, target) => G.W.buildings.filter(b => usableStore(b) && b.owner === c.id && b.type !== 'supply_depot' && logisticsScope(b) === logisticsScope(target));
export function constructionSources(c, target) { return [c.bag, ...privateStores(c, target).map(b => b.store)]; }
export function availableResources(c, target) {
  const out = {}; for (const store of constructionSources(c, target)) for (const [k, n] of Object.entries(store || {})) out[k] = (out[k] || 0) + n; return out;
}
export function payResources(c, target, cost, mul = 1) {
  const src = constructionSources(c, target), have = availableResources(c, target);
  if (!Object.entries(cost).every(([k, n]) => (have[k] || 0) >= Math.ceil(n * mul))) return false;
  for (const [k, n] of Object.entries(cost)) { let left = Math.ceil(n * mul); for (const st of src) { const take = Math.min(left, st[k] || 0); if (take) { st[k] -= take; left -= take; if (!st[k]) delete st[k]; } if (!left) break; } }
  G.dirtyBld = true; return true;
}
export const storeWeight = b => Object.entries(b.store || {}).reduce((n, [k, a]) => n + (D.RES[k]?.w || 1) * a, 0);
export const storeCapacity = b => D.BUILDINGS[b.type]?.capacity || 2500;
export function warehouseMsg(p, m) {
  const b = G.W.buildings.find(x => x.id === m.bid); if (!b || !p.alive || p.inst || dist(p, b) > (D.BUILDINGS[b.type]?.r || 5) + 8) return;
  if (m.type === 'autoStore') { if (b.owner !== p.char.id || !D.BUILDINGS[b.type]?.prod && !D.BUILDINGS[b.type]?.colony) return; b.autoStore = !b.autoStore; G.dirtyBld = true; return; }
  if (!usableStore(b) || (b.owner !== p.char.id && b.type !== 'supply_depot') || !D.RES[m.res]) return;
  const n = Math.max(1, Math.min(10000, m.n | 0)); b.store ||= {};
  if (m.dir === 'in') {
    const room = Math.max(0, Math.floor((storeCapacity(b) - storeWeight(b)) / D.RES[m.res].w));
    const taken = takeRes(p.char, m.res, Math.min(n, room)); if (taken) b.store[m.res] = (b.store[m.res] || 0) + taken;
  } else if (m.dir === 'out') { const taken = addRes(p.char, m.res, Math.min(n, Math.floor(b.store[m.res] || 0))); b.store[m.res] = (b.store[m.res] || 0) - taken; if (!b.store[m.res]) delete b.store[m.res]; }
  G.dirtyBld = true; p.dirtyChar = true;
}
export function autoStoreProduction() {
  for (const b of G.W.buildings) {
    if (!b.owner || !b.built || b.ruined || b.enemy || b.autoStore === false || !(D.BUILDINGS[b.type]?.prod || D.BUILDINGS[b.type]?.colony)) continue;
    const c = G.chars[b.owner]; if (!c) continue;
    for (const wh of privateStores(c, b)) {
      let free = storeCapacity(wh) - storeWeight(wh); wh.store ||= {};
      for (const [k, amount] of Object.entries(b.store || {})) {
        if (!D.RES[k]) continue; const n = Math.min(Math.floor(amount), Math.floor(free / D.RES[k].w)); if (n <= 0) continue;
        wh.store[k] = (wh.store[k] || 0) + n; b.store[k] -= n; free -= n * D.RES[k].w; G.dirtyBld = true;
      }
    }
  }
}
export const campCapacity = c => D.RANKS[D.rankIdx(c.dig || 0)].slaves;
export function housingCapacity(c) {
  return campCapacity(c) + G.W.buildings.filter(b => b.owner === c.id && b.built && !b.ruined).reduce((n, b) => n + (D.BUILDINGS[b.type]?.housing || 0), 0);
}
export function housingTick() {
  for (const c of Object.values(G.chars)) {
    const homes = G.W.buildings.filter(b => b.owner === c.id && b.built && !b.ruined && D.BUILDINGS[b.type]?.housing), used = new Map(); let camp = 0;
    for (const sl of G.W.slaves.filter(s => s.owner === c.id)) {
      const old = homes.find(b => b.id === sl.home && (used.get(b.id) || 0) < D.BUILDINGS[b.type].housing);
      const home = old || homes.find(b => (used.get(b.id) || 0) < D.BUILDINGS[b.type].housing);
      sl.home = home?.id || null; sl.housed = !!home || camp++ < campCapacity(c);
      if (home) used.set(home.id, (used.get(home.id) || 0) + 1);
    }
  }
  G.dirtyWorld = true;
}
