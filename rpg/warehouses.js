import { G, dist, send } from './state.js';
import { tradeGear } from '../public/rpg/crates.js';

import { privateStores, logisticsScope } from './logistics.js';
export function cityWarehouses(c, guild) {
  if (!logisticsScope(guild).startsWith('city:')) return [];
  return privateStores(c, guild).sort((a,b)=>a.id-b.id);
}
export function warehouseMsg(p, m) {
  const c = p.char, b = G.W.buildings.find(b => b.id === Number(m.bid));
  if (!p.alive || p.inst || !b || b.owner !== c.id || !['warehouse','horreum_s'].includes(b.type) || !b.built || b.ruined || dist(p, b) > 20) return;
  b.store ||= {}; b.items ||= [];
  if (m.type === 'warehouseGear') {
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
