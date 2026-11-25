import { G, send } from './state.js';

// Одновременные поединки в разных секторах. Боты не собираются вокруг одного бойца.
export function placeArenaPairs(a, ids) {
  const fighters = ids.map(id => typeof id === 'object' ? G.players.get(id.player) : G.mobs.get(id)).filter(Boolean), pairs = Math.ceil(fighters.length / 2);
  for (let i = 0; i < fighters.length; i += 2) {
    const pair = i / 2, angle = pair * Math.PI * 2 / pairs;
    const cx = Math.cos(angle) * a.rx * 0.43, cz = Math.sin(angle) * a.rz * 0.43;
    const members = fighters.slice(i, i + 2);
    members.forEach((m, j) => {
      const lx = cx, lz = cz + (j === 0 ? -3.2 : 3.2), cs = Math.cos(a.ry || 0), sn = Math.sin(a.ry || 0);
      m.x = a.x + lx * cs + lz * sn; m.z = a.z - lx * sn + lz * cs;
      m.home = { x: m.x, z: m.z };
      const peer = members[1 - j];
      m.arenaPair = peer && !peer.char ? peer.id : null; m.arenaPlayerPair = peer?.char ? peer.id : null;
      m.target = peer ? { kind: peer.char ? 'p' : 'mob', id: peer.id } : null; m.retarget = 0;
      if (m.char) send(m, { type: 'teleport', x: m.x, z: m.z, text: 'Ваш первый соперник — напротив. Остальные пары сражаются в своих секторах.' });
      if (m.arenaPair) { const otherZ = cz + (j === 0 ? 3.2 : -3.2); m.ry = Math.atan2((otherZ - lz) * sn, (otherZ - lz) * cs); }
    });
  }
}
export function pairedArenaTarget(m) {
  const players = [...G.players.values()].filter(p => p.alive && p.arenaFfa === m.ffa && G.arena?.fighters.has(p.id));
  const human = players.find(p => p.id === m.arenaPlayerPair);
  if (human) return { kind: 'p', id: human.id };
  m.arenaPlayerPair = null;
  const foes = [...G.mobs.values()].filter(q => q !== m && q.hp > 0 && q.ffa === m.ffa && (!m.arenaSide || q.arenaSide !== m.arenaSide));
  const paired = foes.find(q => q.id === m.arenaPair);
  if (paired) return { kind: 'mob', id: paired.id };
  m.arenaPair = null;
  const free = foes.filter(q => !players.some(p => p.id === q.arenaPlayerPair) && (!q.arenaPair || !G.mobs.get(q.arenaPair) || G.mobs.get(q.arenaPair).hp <= 0));
  free.sort((a, b) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(b.x - m.x, b.z - m.z));
  const next = free[0];
  if (!next) {
    const human = players.find(p => !p.arenaPair || !(G.mobs.get(p.arenaPair)?.hp > 0));
    if (human) { m.arenaPlayerPair = human.id; human.arenaPair = m.id; return { kind: 'p', id: human.id }; }
    return null;
  }
  m.arenaPair = next.id; next.arenaPair = m.id; next.target = { kind: 'mob', id: m.id };
  return { kind: 'mob', id: next.id };
}
