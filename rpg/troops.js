import { spawnMob } from './combat.js';
import { D } from './state.js';
import { troopStats } from '../public/rpg/rules.js';
export function createTroop(type, x, z, options = {}) {
  const stats = troopStats(type, options.level, options.up, options.trait);
  const m = spawnMob(D.SQUADS[type].unit, x, z, { lvl: stats.level, leash: options.leash || 60, src: options.src });
  if (!m) return null;
  m.hp = m.maxHp = stats.hp; m.dmg = stats.damage; m.armor = stats.armor; m.speed = stats.speed;
  m.def = { ...m.def, speed: stats.speed, mounted: stats.mounted };
  if (options.team) { m.team = options.team; m.war = options.war; }
  return m;
}
