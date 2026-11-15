import { RES, GEAR, derived } from './data.js';
export function baseSalePrice(c, key, context = {}) {
  if (!RES[key]) return 0;
  const amount = RES[key].p * (context.market ?? 1) * derived(c).sell * (context.openPort ? 1.1 : 1) * (context.magister ? 1.1 : 1) * (.85 + (context.favor ?? 50) / 333) * (context.portMultiplier ?? 1);
  return Math.max(1, Math.round(amount * 10) / 10);
}
export function purchasePrice(c, key, context = {}) {
  const base = RES[key] ? RES[key].p * 1.6 * (context.market ?? 1) : GEAR[key]?.p || 999;
  const discounted = Math.max(1, Math.round(base * derived(c).buy * (context.magister ? .9 : 1) * (context.foreign && RES[key] ? 1.05 : 1)));
  return RES[key] ? Math.max(discounted, Math.ceil(baseSalePrice(c,key,context) * (context.localSale ?? 1) * 1.12)) : discounted;
}
