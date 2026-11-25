// Единый план упаковки для клиента, гильдии и автоматических торговых постов.
import { CRATES, RES, GEAR, QUALITY } from './data.js';

export function tradeGear(item) {
  const g = item && GEAR[item.k];
  return !!(g && !g.bound && g.p > 0 && (g.armor || g.kind === 'shield' || ['knife', 'blade', 'axe', 'spear', 'bow'].includes(g.kind)));
}
export function gearTradeValue(item) {
  return Math.round((GEAR[item.k]?.p || 0) * (QUALITY[item.q || 0]?.mul || 1));
}
export function planCrate(key, stocks = [], items = [], only = '') {
  const def = CRATES[key];
  const plan = { ok: false, resources: [], gear: [], value: 0, reason: '' };
  if (!def) { plan.reason = 'Неизвестный ящик.'; return plan; }
  const left = stocks.map(s => ({ ...s }));
  const take = (k, n) => {
    for (let i = 0; i < left.length && n > 0; i++) {
      const amount = Math.min(n, Math.max(0, Math.floor(left[i][k] || 0)));
      if (!amount) continue;
      left[i][k] -= amount; n -= amount; plan.resources.push({ source: i, k, n: amount });
    }
    return n === 0;
  };
  for (const [k, n] of Object.entries(def.in)) if (!take(k, n)) {
    plan.reason = `Для упаковки нужны ${RES[k].name.toLowerCase()}: ${n}.`; return plan;
  }
  if (def.gear) {
    const seen = new Set();
    const eligible = items.filter(it => tradeGear(it) && (!only || it.k === only) && !seen.has(it.uid) && seen.add(it.uid))
      .sort((a, b) => gearTradeValue(a) - gearTradeValue(b) || a.uid - b.uid);
    for (const it of eligible) {
      if (plan.value >= def.value) break;
      plan.gear.push(it.uid); plan.value += gearTradeValue(it);
    }
  } else {
    const keys = def.goods.filter(k => !only || only === k).sort((a, b) => RES[a].p - RES[b].p);
    for (const k of keys) {
      const n = Math.min(left.reduce((sum, s) => sum + Math.max(0, Math.floor(s[k] || 0)), 0), Math.ceil((def.value - plan.value) / RES[k].p));
      if (n > 0 && take(k, n)) plan.value += n * RES[k].p;
      if (plan.value >= def.value) break;
    }
  }
  plan.ok = plan.value >= def.value;
  if (!plan.ok) plan.reason = `Товары: ${plan.value}/${def.value} ед. стоимости. ${def.desc}`;
  return plan;
}

export function applyCratePlan(plan, stocks, itemLists = []) {
  if (!plan.ok) return false;
  for (const t of plan.resources) stocks[t.source][t.k] -= t.n;
  const ids = new Set(plan.gear);
  for (const list of itemLists) for (let i = list.length - 1; i >= 0; i--) if (ids.has(list[i].uid)) list.splice(i, 1);
  return true;
}
