// Поле Марса (Бруттий, напротив Мессаны): бои армиями между игроками и ботами — лобби у распорядителя игр,
// бой на время, армии временные (потери не сохраняются), военные очки и рейтинг полководцев.
import { G, D, WG, now, dist, rand, nid, send, log, broadcast, derivedOf } from './state.js';
import { createTroop } from './troops.js';
import { squadSize, troopLevel, formationWorld, battleDeployment } from '../public/rpg/rules.js';

const W = () => G.W;
const war = () => (G.war = G.war || { lobbies: new Map() });
const fields = () => G.world.war.fields || [G.world.war.field];
const fieldOf = (L) => fields()[L.zone || 0] || fields()[0];
const fighting = () => [...war().lobbies.values()].filter((L) => L.state === 'fight');
const own = (c) => (c.squads || []).filter((x) => !x.war); // свои отряды игрока (только они выходят на поле)
const CAP = { r: 9, need: 45 }; // точка захвата: простоять 45 с без врагов рядом
const plOf = (pid) => G.players.get(pid);
const say = (p, text, kind = 'warn') => send(p, { type: 'log', text, kind });
const rating = (cid) => { const R = (W().warRating = W().warRating || {}); return (R[cid] = R[cid] || { r: 1000, w: 0, l: 0, d: 0, name: (G.chars[cid] || {}).name || '?' }); };
const nearHouse = (p) => { const h = G.world.war && G.world.war.house; return h && Math.hypot(p.x - h.x, p.z - h.z) < 16; };

export function warMsg(p, m) {
  const c = p.char, Wr = war();
  if (m.type === 'warHome') { // на Бруттии гулять нельзя — обратно в деревню у гавани
    if (p.war||WG.nearWreck(p.x,p.z)) return; const v = G.world.war.village; p.x = v.x + rand(-4, 4); p.z = v.z + rand(-4, 4); send(p, { type: 'teleport', x: p.x, z: p.z, text: 'По Бруттию не гуляют: здесь только гавань, деревня и Поле Марса.' }); return;
  }
  if (m.type === 'ferry') { // переправа: гавань Мессаны ↔ гавань Регия
    const pt = G.W.buildings.find((b) => b.type === 'portus' && b.city === 'messana'), w = G.world.war;
    const toRegium = m.to === 'regium';
    if (toRegium ? !(pt && dist(p, pt) < 40) : !(Math.hypot(p.x - w.pier.x, p.z - w.pier.z) < 30 || nearHouse(p))) return say(p, 'Переправа — у гавани.');
    if (c.den < D.WAR.ferry) return say(p, `Переправа стоит ${D.WAR.ferry} денариев.`);
    c.den -= D.WAR.ferry; p.mounted = false;
    const x = toRegium ? w.pier.x + (w.village.x - w.pier.x) * 0.4 : pt.x, z = toRegium ? w.pier.z + (w.village.z - w.pier.z) * 0.4 : pt.z;
    p.x = x; p.z = z; send(p, { type: 'teleport', x, z, text: toRegium ? '⛵ Лодочник переправил вас в Регий. Дом распорядителя игр — в деревне.' : '⛵ Лодочник доставил вас в гавань Мессаны.' }); p.dirtyChar = true; return;
  }
  if (!nearHouse(p)) return say(p, 'Бои записывают у распорядителя игр в Регии.');
  const inLob = (pid) => [...Wr.lobbies.values()].find((L) => L.A.includes(pid) || L.B.includes(pid));
  if (m.type === 'warRent') { // отряд на один бой у распорядителя игр
    const R = D.WAR.rent[m.k]; if (!R) return; c.warRent = c.warRent || [];
    if (c.warRent.length >= 4) return say(p, 'Арендовать можно не больше 4 отрядов на бой.');
    if (c.den < R.price) return say(p, `Аренда стоит ${R.price} денариев.`);
    c.den -= R.price; c.warRent.push({ id: nid(), type: m.k, name: `${D.SQUADS[m.k].name.split(' ')[0]} (аренда)`, rent: true });
    say(p, `🏟 Арендован отряд на один бой: ${D.SQUADS[m.k].name}.`, 'good'); p.dirtyChar = true; return;
  }
  if (m.type === 'warPick') { // какие отряды (до 4) идут в бой: свои, наёмники, арендованные
    const ids = (Array.isArray(m.ids) ? m.ids : []).map(Number).filter((id, i, ids) => ids.indexOf(id) === i && pool(c).some((q) => q.id === id)).slice(0, D.WAR.maxSquads);
    c.warPick = ids; p.dirtyChar = true; return;
  }
  if (m.type === 'warCreate') {
    if (p.war || inLob(p.id)) return say(p, 'Вы уже записаны на бой.');
    if (!pool(c).length) return say(p, 'Нужен хотя бы один отряд: свой (Преторий), наёмники (Арсенал) или арендованный здесь на один бой.');
    const LEG = { pvb: [1, 0, 1], pvp: [1, 0, 0], b2: [2, 0, 2], b3: [3, 0, 3], p2: [2, 0, 0], p3: [3, 0, 0] }[m.mode]; // старые режимы: размер, ботов слева, справа
    const size = LEG ? LEG[0] : Math.max(1, Math.min(3, m.size | 0 || 1));
    const zone = Number.isInteger(m.zone) && m.zone >= 0 && m.zone < fields().length ? m.zone : Math.floor(Math.random() * fields().length);
    const L = { id: nid(), size, zone, A: [p.id], B: [], botA: LEG ? LEG[1] : 0, botB: LEG ? LEG[2] : 0, host: p.id, state: 'wait', made: now() }; Wr.lobbies.set(L.id, L);
    log(`🏟 ${c.name} собирает бой ${size} на ${size} на Поле Марса (поле «${fieldOf(L).name}»). Свободные места — у распорядителя игр в Регии.`, 'info');
    tryStart();
  } else if (m.type === 'warJoin') {
    const L = Wr.lobbies.get(m.id); if (!L || L.state !== 'wait') return;
    if (inLob(p.id)) return say(p, 'Вы уже записаны на бой.');
    if (!pool(c).length) return say(p, 'Нужен хотя бы один отряд (свой, наёмники или аренда здесь).');
    const side = m.side === 'B' ? 'B' : 'A';
    if (L[side].length + L['bot' + side] >= L.size) { if (L['bot' + side] > 0) L['bot' + side]--; else return say(p, 'На этой стороне мест нет.'); } // место бота уступается игроку
    L[side].push(p.id); tryStart();
  } else if (m.type === 'warBot') { // хозяин лобби ставит бота на свободное место (или убирает)
    const L = Wr.lobbies.get(m.id); if (!L || L.state !== 'wait' || L.host !== p.id) return say(p, 'Ботов ставит тот, кто собрал бой.');
    const side = m.side === 'B' ? 'B' : 'A', k = 'bot' + side;
    if (m.on) { if (L[side].length + L[k] >= L.size) return say(p, 'На этой стороне мест нет.'); L[k]++; } else L[k] = Math.max(0, L[k] - 1);
    tryStart();
  } else if (m.type === 'warLeave') {
    for (const L of Wr.lobbies.values()) if (L.state === 'wait') { L.A = L.A.filter((x) => x !== p.id); L.B = L.B.filter((x) => x !== p.id); if (L.host === p.id) L.host = L.A[0] ?? L.B[0]; if (!L.A.length && !L.B.length) Wr.lobbies.delete(L.id); }
  }
  G.dirtyWorld = true;
}
// отряды, из которых выбирают для боя: свои (в том числе наёмники) и арендованные на один бой
const pool = (c) => [...own(c), ...(c.warRent || [])];
const full = (L) => L.A.length + (L.botA || 0) >= L.size && L.B.length + (L.botB || 0) >= L.size && (L.A.length + L.B.length) > 0;
function tryStart() { // на каждом из четырёх полей — свой бой
  const busy = new Set(fighting().map((q) => q.zone));
  for (const L of war().lobbies.values()) {
    if (L.state !== 'wait' || !full(L)) continue;
    if (busy.has(L.zone)) { const fz = fields().findIndex((F, i) => !busy.has(i)); if (fz < 0) continue; L.zone = fz; }
    busy.add(L.zone); start(L);
  }
}
// армия игрока: копии его собственных отрядов (тех же видов, численности и улучшений); потери не сохраняются
function spawnArmy(L, p, team, k) {
  const F = fieldOf(L), c = p.char, pos = battleDeployment(F,team,k,L.size);
  Object.assign(p,pos); p.mounted = false; p.hp = p.hp > 0 ? p.hp : 1;
  send(p, { type: 'teleport', x: p.x, z: p.z, text: `⚔ Бой начался на поле «${F.name}»! Вы — ${team === 'A' ? 'Запад' : 'Восток'}. Победа — разбить все отряды врага или удержать точку в центре ${CAP.need} с. 1–5 — отряд, Z — вид сверху (ПКМ — приказ).` });
  c.squads = c.squads || [];
  for (const q of own(c)) { for (const id of q.live || []) G.mobs.delete(id); q.live = []; }
  const P = pool(c), picked = [...new Set(c.warPick || [])].map((id) => P.find((q) => q.id === id)).filter(Boolean), mine = (picked.length ? picked : P).slice(0, D.WAR.maxSquads);
  c.warRent = (c.warRent || []).filter((q) => !mine.includes(q)); c.warPick = []; // аренда — на один бой
  L.armies = L.armies || {}; L.armies[p.id] = mine.map((q) => ({ type: q.type, n: squadSize(q), lvl: troopLevel(c, q), traits: (q.slaves || []).map(id => G.W.slaves.find(sl => sl.id === id)?.trait || null), up: { ...(q.up || {}) }, name: q.name })); // бот напротив повторит и численность, и силу
  mine.forEach((q0, gi) => {
    const n = L.armies[p.id][gi].n, up = q0.up || {}, anchor = battleDeployment(F,team,k,L.size,gi,mine.length);
    const sq = { id: nid(), type: q0.type, war: L.id, nominalSize: n, name: `${q0.name}`, up: { ...up }, xp: 0, lvl: q0.lvl || 1, form: 'line', mode: 'hold', columns: 6, pt: {...anchor}, live: [], lost: 0, kills: 0 };
    for (let i = 0; i < n; i++) {
      const {x:gx,z:gz} = formationWorld(i,n,'line',6,anchor.x,anchor.z,anchor.ry);
      const m = createTroop(q0.type, gx, gz, { level: L.armies[p.id][gi].lvl, up, trait: L.armies[p.id][gi].traits[i], team, war: L.id, src: { kind: 'squad', owner: c.id, sq: sq.id, war: L.id } });
      if (!m) continue; m.ry = anchor.ry; m.team = team; m.war = L.id; m.squad = { owner: c.id, sq: sq.id, slot: i, n }; m.gname = `${c.name}: ${sq.name}`;
      sq.live.push(m.id); L.units.push(m.id);
    }
    c.squads.push(sq);
  });
  p.war = { lid: L.id, team }; p.dirtyChar = true;
}
function spawnBot(L, team, k, mirror) {
  const F = fieldOf(L);
  const army = mirror?.length ? mirror : D.WAR.army.map(([type, n]) => ({ type, n, lvl: 6, up: {} }));
  army.forEach((a, g) => {
    const anchor = battleDeployment(F,team,k,L.size,g,army.length), ry=anchor.ry;
    for (let i = 0; i < a.n; i++) {
      const pt = formationWorld(i, a.n, 'line', 6, anchor.x, anchor.z, ry);
      const m = createTroop(a.type, pt.x, pt.z, { level: a.lvl, up: a.up, trait: a.traits?.[i], team, war: L.id, leash: 400, src: { kind: 'war', lid: L.id } });
      if(!m) continue; m.ry=ry; m.warBot=true;
      m.hp=m.maxHp=Math.max(1,Math.round(m.maxHp*D.WAR.botScale.hp));
      m.dmg*=D.WAR.botScale.damage; m.armor*=D.WAR.botScale.armor;
      m.grp = { id: `b${L.id}${team}${k}_${g}` }; m.gname = `Армия противника: ${D.SQUADS[a.type].name}`;
      m.warDest = { x: F.x + (anchor.x-F.x)*.2, z: F.z + (anchor.z-F.z)*.2 }; L.units.push(m.id);
    }
  });
}

function start(L) {
  L.state = 'fight'; L.until = now() + D.WAR.time; L.units = []; L.cap = { A: 0, B: 0 };
  L.A.forEach((pid, i) => { const p = plOf(pid); if (p) spawnArmy(L, p, 'A', i); });
  L.B.forEach((pid, i) => { const p = plOf(pid); if (p) spawnArmy(L, p, 'B', i); });
  for (let i = 0; i < (L.botB || 0); i++) spawnBot(L, 'B', L.B.length+i, L.armies[L.A[L.B.length+i] ?? L.A[0]] || Object.values(L.armies)[0]);
  for (let i = 0; i < (L.botA || 0); i++) spawnBot(L, 'A', L.A.length+i, L.armies[L.B[L.A.length+i] ?? L.B[0]] || Object.values(L.armies)[0]);
  log(`🏟 На Поле Марса («${fieldOf(L).name}») начался бой ${L.size} на ${L.size} (${Math.round(D.WAR.time / 60)} мин).`, 'warn');
  G.dirtyWorld = true;
}
const aliveTeam = (L, team) => L.units.filter((id) => { const m = G.mobs.get(id); return m && m.hp > 0 && m.team === team; }).length;
export function warTick() {
  tryStart();
  for (const L of fighting()) {
    const F = fieldOf(L);
    for (const pid of [...L.A, ...L.B]) { const p = plOf(pid); if (!p) continue; if (Math.hypot(p.x - F.x, p.z - F.z) > F.r + 25 && p.alive) { p.x = F.x; p.z = F.z; send(p, { type: 'teleport', x: p.x, z: p.z, text: 'С Поля Марса до конца боя не уйти.' }); } }
    const a = aliveTeam(L, 'A'), b = aliveTeam(L, 'B');
    // точка захвата: в круге только одна сторона — её счёт растёт, другой — падает
    const inA = L.units.some((id) => { const m = G.mobs.get(id); return m && m.hp > 0 && m.team === 'A' && Math.hypot(m.x - F.x, m.z - F.z) < CAP.r; }) || L.A.some((pid) => { const p = plOf(pid); return p && p.alive && Math.hypot(p.x - F.x, p.z - F.z) < CAP.r; });
    const inB = L.units.some((id) => { const m = G.mobs.get(id); return m && m.hp > 0 && m.team === 'B' && Math.hypot(m.x - F.x, m.z - F.z) < CAP.r; }) || L.B.some((pid) => { const p = plOf(pid); return p && p.alive && Math.hypot(p.x - F.x, p.z - F.z) < CAP.r; });
    if (inA && !inB) { L.cap.A++; L.cap.B = Math.max(0, L.cap.B - 2); } else if (inB && !inA) { L.cap.B++; L.cap.A = Math.max(0, L.cap.A - 2); }
    if (L.cap.A >= CAP.need || L.cap.B >= CAP.need) { finish(L, L.cap.A >= CAP.need ? 'A' : 'B', a, b, true); continue; }
    if (now() < L.until && a > 0 && b > 0) continue;
    finish(L, a > b ? 'A' : b > a ? 'B' : null, a, b);
  }
}
function finish(L, win, a, b, byCap = false) {
  const Wr = war();
  for (const id of L.units) G.mobs.delete(id); // армии сворачиваются
  const humans = [...L.A.map((x) => [x, 'A']), ...L.B.map((x) => [x, 'B'])];
  const avg = (team) => { const ids = (team === 'A' ? L.A : L.B).map((pid) => plOf(pid)).filter(Boolean); const bots = (team === 'A' ? L.botA : L.botB) || 0; const sum = ids.reduce((s, p) => s + rating(p.char.id).r, 0) + bots * 1000; return sum / Math.max(1, ids.length + bots); };
  for (const [pid, team] of humans) {
    const p = plOf(pid); if (!p) continue; const c = p.char, R = rating(c.id); R.name = c.name;
    const res = win == null ? 0.5 : win === team ? 1 : 0, opp = avg(team === 'A' ? 'B' : 'A'), exp = 1 / (1 + Math.pow(10, (opp - R.r) / 400)), dR = Math.round(32 * (res - exp));
    R.r += dR; if (res === 1) R.w++; else if (res === 0) R.l++; else R.d++;
    const mil = res === 1 ? D.WAR.win : res === 0.5 ? Math.round((D.WAR.win + D.WAR.lose) / 2) : D.WAR.lose; c.milPts = (c.milPts || 0) + mil;
    c.squads = (c.squads || []).filter((sq) => sq.war !== L.id); p.war = null;
    const v = G.world.war.village; p.x = v.x + rand(-5, 5); p.z = v.z + rand(-5, 5);
    send(p, { type: 'teleport', x: p.x, z: p.z, text: `🏟 Бой окончен: ${res === 1 ? 'ПОБЕДА' : res === 0 ? 'поражение' : 'ничья'}${byCap ? ' — точка в центре захвачена' : ''} (осталось воинов: ${team === 'A' ? a : b} против ${team === 'A' ? b : a}). +${mil} военных очков, рейтинг ${R.r} (${dR >= 0 ? '+' : ''}${dR}).` });
    const stats=derivedOf(c); p.alive=true; p.hp=stats.maxHp; p.st=stats.maxSt; p.deadAt=0; p.block=false; p.mounted=false; p.godUntil=now()+3;
    send(p,{type:'respawn',x:p.x,z:p.z,battleEnded:true});
    p.dirtyChar = true;
  }
  log(`🏟 Поле Марса (${L.size} на ${L.size}) — ${win ? `победа стороны ${win === 'A' ? 'Запада' : 'Востока'}` : 'ничья'} (${a} : ${b}).`, 'info');
  Wr.lobbies.delete(L.id); G.dirtyWorld = true;
}
// павший в бою полководец не теряет деньги и встаёт у своего края поля
export function warSpawnOf(p) { if (!p.war) return null; const L=war().lobbies.get(p.war.lid); if(!L || L.state!=='fight') return null; const pos=battleDeployment(fieldOf(L),p.war.team,Math.max(0,L[p.war.team].indexOf(p.id)),L.size); return {x:pos.x,z:pos.z}; }
export function warPlayerGone(p) { // вышел из игры во время боя или записи
  const Wr = war();
  for (const L of Wr.lobbies.values()) { if (L.state === 'wait') { L.A = L.A.filter((x) => x !== p.id); L.B = L.B.filter((x) => x !== p.id); if (!L.A.length && !L.B.length) Wr.lobbies.delete(L.id); } }
  if (p.char) p.char.squads = (p.char.squads || []).filter((sq) => !sq.war);
  p.war = null;
}
export function warPublic() {
  const Wr = war(), names = (ids) => ids.map((pid) => { const p = plOf(pid); return p ? p.char.name : '?'; });
  const R = W().warRating || {};
  return { lobbies: [...Wr.lobbies.values()].map((L) => ({ id: L.id, size: L.size, botA: L.botA || 0, botB: L.botB || 0, host: (plOf(L.host) || {}).char ? plOf(L.host).char.name : null, zone: L.zone || 0, cap: L.cap || null, capNeed: CAP.need, A: names(L.A), B: names(L.B), state: L.state, left: L.until ? Math.max(0, Math.round(L.until - now())) : null })), top: Object.entries(R).map(([cid, r]) => ({ cid, ...r })).sort((a, b) => b.r - a.r).slice(0, 15) };
}
