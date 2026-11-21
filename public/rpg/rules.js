// Pure rules shared by the authoritative server and tactical previews.
import { SQUADS, ENEMIES, SLAVE_TRAITS, HORSES } from './data.js';
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
export function squadSize(sq) {
  if (sq.war && Number.isInteger(sq.nominalSize)) return sq.nominalSize;
  if (sq.slaves) return sq.slaves.length;
  return (SQUADS[sq.type]?.n || 0) + clamp(sq.up?.drill, 0, 5);
}
export function troopStats(type, level = 1, up = {}, trait = null) {
  const s = SQUADS[type], u = ENEMIES[s.unit], t = SLAVE_TRAITS[trait] || {};
  level = clamp(level, 1, 30);
  const arm = clamp(up.arm, 0, 5), wpn = clamp(up.wpn, 0, 5), drill = clamp(up.drill, 0, 5);
  return {
    level, hp: Math.round(u.hp * (1 + .16 * (level - 1)) * (1 + .12 * arm) * (s.hpK || 1) * (t.hp || 1)),
    damage: (u.dmg || 0) * (1 + .08 * (level - 1)) * (1 + .1 * wpn) * (s.dmgK || 1) * (t.glad || 1) * (u.ranged ? t.arch || 1 : 1),
    armor: (u.armor || 0) * (1 + .12 * arm), speed: u.speed * (1 + .05 * drill),
    range: u.range || 2, cooldown: u.cd || 1.2, ranged: !!u.ranged, mounted: !!u.mounted,
  };
}
export const troopLevel = (character, sq) => clamp((character.level || 1) + (sq.lvl || 1) - 1, 1, 30);
export function formationSlot(i, n, form = 'line', columns = null) {
  if (form === 'loose') { const a = i * 2.399963; const r = 2 + Math.sqrt(i) * 2; return { x: Math.cos(a) * r, z: Math.sin(a) * r }; }
  const tight = form === 'tight', per = Math.round(clamp(columns || (tight ? 8 : 6), 2, 12));
  const row = Math.floor(i / per), width = Math.min(per, n - row * per);
  return { x: (i % per - (width - 1) / 2) * (tight ? 1.35 : 2.2), z: -row * (tight ? 1.6 : 2.5) };
}
export function formationWorld(i, n, form, columns, x, z, ry) {
  const p = formationSlot(i, n, form, columns);
  return { x: x + p.x * Math.cos(ry) + p.z * Math.sin(ry), z: z - p.x * Math.sin(ry) + p.z * Math.cos(ry) };
}
export function horseMaxSpeed(kind,run=true,hungry=false){const quality=HORSES[kind]?.speed||1.6;return(run?10+(quality-1.6)*3:5.5)*(hungry?.75:1);}
export function horseMotion(current, heading, desiredHeading, moving, run, kind, dt, hungry = false) {
  dt = clamp(dt, 0, .15);
  const max=horseMaxSpeed(kind,run,hungry);
  let delta = Math.atan2(Math.sin(desiredHeading - heading), Math.cos(desiredHeading - heading));
  const turnRate = 2.3 / (1 + current * .22), turn = clamp(Math.abs(delta), 0, turnRate * dt) * Math.sign(delta);
  const target = moving ? max * (Math.abs(delta) > 1.1 ? .35 : 1) : 0;
  const speed = current + Math.sign(target - current) * Math.min(Math.abs(target - current), (target > current ? 3.5 : 6) * dt);
  return { speed: Math.max(0, speed), heading: heading + turn };
}
