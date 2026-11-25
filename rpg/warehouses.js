import { G, D, WG, dist, send, cityNear, canTake, takeRes } from './state.js';
import { tradeGear } from '../public/rpg/crates.js';

export function cityWarehouses(c, guild) {
  const cid = guild.city || WG.cityAt(guild.x, guild.z, 30)?.id || cityNear(guild.x, guild.z);
  return G.W.buildings.filter(b => b.owner === c.id && b.type === 'horreum_s' && b.built && !b.ruined && !b.enemy
    && (b.city || WG.cityAt(b.x, b.z, 30)?.id) === cid).sort((a, b) => a.id - b.id);
}
export function warehouseMsg(p, m) {
  const c = p.char, b = G.W.buildings.find(b => b.id === Number(m.bid));
  if (!b || b.owner !== c.id || b.type !== 'horreum_s' || !b.built || b.ruined || dist(p, b) > 20) return;
  b.store ||= {}; b.items ||= [];
  if (m.type === 'warehouseRes') {
    if (!D.RES[m.res]) return;
    const n = Math.max(0, Math.min(100000, Math.floor(Number(m.n) || 0)));
    if (m.dir === 'in') { const amount = takeRes(c, m.res, n); b.store[m.res] = (b.store[m.res] || 0) + amount; }
    else if (m.dir === 'out') { const amount = canTake(c, m.res, Math.min(n, Math.floor(b.store[m.res] || 0))); b.store[m.res] = (b.store[m.res] || 0) - amount; c.bag[m.res] = (c.bag[m.res] || 0) + amount; }
    else return;
  } else if (m.type === 'warehouseGear') {
    const from = m.dir === 'in' ? c.items : m.dir === 'out' ? b.items : null;
    const to = m.dir === 'in' ? b.items : c.items;
    if (!from || (m.dir === 'in' && b.items.length >= 100) || (m.dir === 'out' && c.items.length >= 24)) return;
    const index = from.findIndex(it => it.uid === Number(m.uid));
    if (index < 0 || (m.dir === 'in' && !tradeGear(from[index]))) return;
    to.push(from.splice(index, 1)[0]);
  } else return;
  p.dirtyChar = true; G.dirtyBld = true;
  send(p, { type: 'log', text: 'Запасы вашего склада обновлены. Их видит Торговая гильдия этого города.', kind: 'good' });
}
