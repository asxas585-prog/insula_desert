import { G, cityNear, cityOff, dist, D, now, send } from './state.js';
export const cityOf = pos => pos?.city || (G.world.cities || []).filter(c => dist(c, pos || {x:0,z:0}) <= c.R + 230).sort((a,b) => dist(a,pos || {x:0,z:0}) - dist(b,pos || {x:0,z:0}))[0]?.id || null;
export function hasCityOffice(c, office, city) { return !!city && cityOff(city).offices?.[office]?.id === c.id; }
export const localOffices = (c, pos) => cityOf(pos) ? Object.entries(cityOff(cityOf(pos)).offices || {}).filter(([, v]) => v?.id === c.id).map(([k]) => k) : [];
export const ownsShip = (p, s) => !!s && s.owner === p.char.id;
export const cargoAccess = (p, s) => !!s && (ownsShip(p, s) || (!s.owner && s.starter));
export const nearShip = (p, s) => !!s && !p.inst && (p.ship === s.id || dist(p, s) <= (D.SHIPS[s.type]?.len || 0) / 2 + 7);
export function shipCargoAllowed(p, s) {
  if (!cargoAccess(p, s)) { send(p, { type: 'log', text: 'Чужой груз: доступ есть только у владельца. Общая лодка колонии доступна всем.', kind: 'warn' }); return false; }
  return nearShip(p, s);
}
