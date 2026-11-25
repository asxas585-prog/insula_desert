import { G } from './state.js';
export function encounterLevel(extra = 0) {
  const levels = [...G.players.values()].filter(p => p.char && !p.bot && p.alive && !p.inst && !p.war).map(p => p.char.level).sort((a,b) => a-b);
  const median = levels.length ? levels[Math.floor((levels.length - 1) / 2)] : 1;
  return Math.max(1, Math.min(20, median + extra));
}
