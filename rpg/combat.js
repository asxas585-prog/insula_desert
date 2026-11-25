import { pairedArenaTarget } from './arena-pairs.js';
// Существа, их ИИ, бой, снаряды, добыча, опыт
import { G, D, WG, now, dist, rand, randi, pick, nid, angDiff, send, broadcast, log, fx, chronicle, addRes, addGear, gearArmor, derivedOf, rankOf, bagFree, hasOffice, lawsAt } from './state.js';
import * as NAV from './nav.js';
import { questHook } from './society.js';
import { damageBuilding } from './economy.js';

const { CFG, ENEMIES, GEAR, QUALITY } = D;
const ACTIVE_R = 260;

// ---------- Опыт ----------
export function grantXp(p, n) {
  const c = p.char;
  if (!c || n <= 0) return;
  if (p.buffs && p.buffs.bath > now()) n *= 1.25;
  n = Math.round(n);
  c.xp += n;
  let up = false;
  while (c.level < CFG.maxLevel && c.xp >= D.xpNeed(c.level)) { c.xp -= D.xpNeed(c.level); c.level++; c.points += CFG.pointsPerLevel; c.specPts = (c.specPts || 0) + 1; up = true; }
  if (up) {
    const d = derivedOf(c); p.hp = d.maxHp; p.st = d.maxSt;
    log(`⭐ ${c.name} достиг(ла) ${c.level} уровня!`, 'good');
    fx({ kind: 'levelup', x: p.x, z: p.z, id: p.id });
    send(p, { type: 'levelup', level: c.level, points: c.points });
  }
  p.dirtyChar = true;
}
export function grantDig(p, n, why) {
  const c = p.char; if (!c || n <= 0) return;
  const before = rankOf(c), e0 = D.rankIdx(c.dig || 0);
  const temple = G.W.buildings.some((b) => b.type === 'templum' && b.built);
  c.dig = (c.dig || 0) + Math.round(n * (temple ? 1.2 : 1));
  const after = rankOf(c), e1 = D.rankIdx(c.dig || 0);
  if (e1 > e0 && c.rankBought != null && e1 > c.rankBought) send(p, { type: 'log', text: `🦅 Рим одобряет вас для звания «${D.RANKS[c.rankBought + 1].name}». Внесите ${D.RANKS[c.rankBought + 1].fee} ден. в Курии, чтобы получить его.`, kind: 'good' });
  if (after > before) { log(`🏛 ${c.name} получает звание «${D.RANKS[after].name}»!`, 'good'); chronicle(`${c.name} стал(а) ${D.RANKS[after].name.toLowerCase()}ом колонии`); }
  p.dirtyChar = true;
}

// ---------- Существа ----------
let squadSlotFn = () => null, squadKillFn = () => {};
export function setSquadFns(slot, kill) { squadSlotFn = slot; squadKillFn = kill; }
let treasureFn = () => {}; export function setTreasureFn(f) { treasureFn = f; }
let unitKillFn = () => {}; export function setUnitKillFn(f) { unitKillFn = f; }
export function spawnMob(type, x, z, opts = {}) {
  const def = ENEMIES[type]; if (!def) return null;
  const lvl = Math.max(1, opts.lvl || 1);
  const hpMul = 1 + 0.16 * (lvl - 1), dmgMul = 1 + 0.08 * (lvl - 1);
  const m = {
    id: nid(), type, def, lvl, x, z, ry: rand(0, 6.28), hp: Math.round(def.hp * hpMul), maxHp: Math.round(def.hp * hpMul),
    dmg: (def.dmg || 0) * dmgMul, armor: def.armor || 0, home: { x: opts.hx ?? x, z: opts.hz ?? z }, leash: opts.leash || 40,
    state: 'idle', target: null, nextAct: now() + rand(0, 3), atkAt: 0, wind: 0, src: opts.src || null, inst: opts.inst || null,
    faction: def.faction, goal: opts.goal || null, speed: def.speed, lastHit: 0, y: opts.y || 0, arena: opts.arena || null, ship: opts.ship || null,
  };
  G.mobs.set(m.id, m);
  return m;
}
const isHostile = (m) => D.HOSTILE.has(m.faction);
const inWater = (x, z) => WG.terrainHeight(x, z) < -0.6;

function mobGround(m, x, z) {
  if (m.inst) { const I = G.instances.get(m.inst); return !I || I.walkable(x, z); }
  if (m.arena) { const a = m.arena; return ((x - a.x) / a.rx) ** 2 + ((z - a.z) / a.rz) ** 2 < 1; }
  if (m.def.model === 'croc') return WG.terrainHeight(x, z) > -6; // крокодил плавает по рекам и озёрам
  if (inWater(x, z) && WG.deckHeight(x, z, G.W.buildings) == null) return false; // в воду не лезут, по мостам — можно
  // стены, акведуки, деревья, камни и здания — препятствие (цель набега не мешает подойти вплотную)
  const gb = m.goal ? (m._goalB && m._goalB.id === m.goal ? m._goalB : (m._goalB = G.W.buildings.find((b) => b.id === m.goal) || null)) : null;
  if (!NAV.free(x, z, gb)) return !NAV.free(m.x, m.z, gb) && Math.hypot(x - m.x, z - m.z) < 3; // появился внутри — выпускаем
  return true;
}
// водопой: ближайшая к логову точка на берегу реки или озера (кэш по логову)
const drinkCache = new Map();
function drinkSpot(home) {
  const k = Math.round(home.x) + ',' + Math.round(home.z);
  if (drinkCache.has(k)) return drinkCache.get(k);
  let best = null;
  outer: for (let r = 8; r <= 240; r += 8) for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2 + r * 0.01, x = home.x + Math.cos(a) * r, z = home.z + Math.sin(a) * r;
    const wd = WG.waterEdgeDist(x, z);
    if (wd > 0.8 && wd < 3.5 && WG.terrainHeight(x, z) > -0.5) { best = { x, z }; break outer; }
  }
  drinkCache.set(k, best); return best;
}
let pathBudget = 0; export function navBudget() { pathBudget = 3; } // не больше 3 поисков пути за такт
function moveMob(m, tx, tz, speed, dt) {
  const gx = tx, gz = tz, t = now();
  // идём по найденному пути в обход (если цель не убежала далеко)
  if (m.nav && (Math.hypot(m.nav.tx - gx, m.nav.tz - gz) > 10 || t > m.nav.until)) m.nav = null;
  if (m.nav) { const q = m.nav.pts[0]; if (Math.hypot(q[0] - m.x, q[1] - m.z) < 1.6) { m.nav.pts.shift(); if (!m.nav.pts.length) m.nav = null; } if (m.nav) { tx = m.nav.pts[0][0]; tz = m.nav.pts[0][1]; } }
  const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return 0;
  const step = Math.min(d, speed * dt);
  let ang = Math.atan2(dx, dz);
  const sd = m.side || (m.id % 2 ? 1 : -1);
  const order = t < (m.detourUntil || 0) ? [sd * 0.5, 0, sd * 1.0, sd * 1.5, sd * 2.0, sd * 2.6, -sd * 0.5, -sd * 1.0, -sd * 1.6] : [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.1, -2.1, 2.7, -2.7];
  const plan = () => { // упёрлись — ищем путь в обход по карте препятствий
    if (m.nav || t < (m.navAt || 0) || pathBudget <= 0 || m.arena || m.inst) return;
    pathBudget--; m.navAt = t + 1.5;
    const pts = NAV.findPath(m.x, m.z, gx, gz, (x, z) => mobGround(m, x, z), Math.min(140, Math.hypot(gx - m.x, gz - m.z) + 30));
    if (pts && pts.length) { m.nav = { pts, tx: gx, tz: gz, until: t + 15 }; m.detourT = 0; }
  };
  for (const off of order) {
    const a = ang + off, nx = m.x + Math.sin(a) * step, nz = m.z + Math.cos(a) * step;
    if (!mobGround(m, nx, nz)) continue;
    if (off !== 0) { m.side = Math.sign(off); m.detourUntil = t + 1.6; m.detourT = (m.detourT || 0) + dt; if (m.detourT > 1.0) plan(); } else if (!m.nav) m.detourT = Math.max(0, (m.detourT || 0) - dt);
    m.x = nx; m.z = nz; m.ry = a; m.stuck = 0;
    return step;
  }
  m.stuck = (m.stuck || 0) + dt; m.side = -sd; m.detourUntil = t + 1.6;
  if (m.nav) m.nav = null; else plan();
  if (m.stuck > 4) { // совсем застрял — шаг назад в случайную сторону
    for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28, nx = m.x + Math.sin(a) * 1.5, nz = m.z + Math.cos(a) * 1.5; if (mobGround(m, nx, nz)) { m.x = nx; m.z = nz; m.stuck = 0; break; } }
  }
  return 0;
}
function separate(list) { // расталкивание по сетке 2 м (не перебор всех пар — быстро и при сотне существ)
  const cell = new Map(), K = (i, j) => i * 100003 + j;
  for (const a of list) { const k = K(Math.floor(a.x / 2), Math.floor(a.z / 2)); let b = cell.get(k); if (!b) cell.set(k, (b = [])); b.push(a); }
  for (const a of list) {
    const ci = Math.floor(a.x / 2), cj = Math.floor(a.z / 2);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const arr = cell.get(K(ci + di, cj + dj)); if (!arr) continue;
      for (const b of arr) { if (b.id <= a.id) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.arena || b.arena ? 2.3 : (a.def.boss || b.def.boss ? 1.8 : 1.1);
        if (d > 0.001 && d < min) { const k = (min - d) / 2 / d; if (mobGround(a, a.x - dx * k, a.z - dz * k)) { a.x -= dx * k; a.z -= dz * k; } if (mobGround(b, b.x + dx * k, b.z + dz * k)) { b.x += dx * k; b.z += dz * k; } }
      } }
  }
}
// цель: игрок / союзный легионер / вражеский моб
function findTarget(m) {
  let best = null, bd = m.def.aggro || 0;
  if (!bd) return null;
  if (m.team) { // Поле Марса: враги — только чужая сторона того же боя
    bd = Math.max(bd, 45);
    for (const q of G.mobs.values()) if (q.hp > 0 && q.team && q.war === m.war && q.team !== m.team) { const d = dist(m, q); if (d < bd) { bd = d; best = { kind: 'mob', id: q.id }; } }
    for (const p of G.players.values()) if (p.alive && p.war && p.war.lid === m.war && p.war.team !== m.team) { const d = dist(m, p); if (d < bd) { bd = d; best = { kind: 'p', id: p.id }; } }
    return best;
  }
  if (m.ffa) return pairedArenaTarget(m);
  if (m.arena) { // на арене: свои бойцы (раб, лев) против гладиаторов арены; гладиаторы — ещё и против игроков-бойцов
    const mine = m.faction === 'rome';
    for (const q of G.mobs.values()) if (q.hp > 0 && q.arena && !q.kneel && (mine ? q.faction !== 'rome' : q.faction === 'rome')) { const d = dist(m, q); if (d < bd) { bd = d; best = { kind: 'mob', id: q.id }; } }
    if (!mine) for (const p of G.players.values()) if (p.alive && G.arena && G.arena.fighters.has(p.id)) { const d = dist(m, p); if (d < bd) { bd = d; best = { kind: 'p', id: p.id }; } }
    return best;
  }
  if (m.faction === 'rome') {
    if (m.watch) { // дозорные: любой враг у своего города — бегут навстречу
      const W0 = m.watch; bd = 1e9;
      for (const q of G.mobs.values()) if (q.hp > 0 && isHostile(q) && q.faction !== 'glad' && !q.inst && Math.hypot(q.x - W0.x, q.z - W0.z) < W0.R + 170) { const d = dist(m, q); if (d < bd) { bd = d; best = { kind: 'mob', id: q.id }; } }
      return best;
    }
    for (const q of G.mobs.values()) if (q.hp > 0 && isHostile(q) && q.faction !== 'glad' && q.inst === m.inst) { const d = dist(m, q); if (d < bd) { bd = d; best = { kind: 'mob', id: q.id }; } }
    return best;
  }
  for (const p of G.players.values()) {
    if (!p.alive || p.inst !== m.inst || !p.char) continue;
    if (m.arena && !(G.arena && G.arena.fighters.has(p.id))) continue;
    if (!m.arena && G.arena && G.arena.fighters.has(p.id)) continue;
    let d = dist(m, p);
    if (p.ship) d += 8;
    if (d < bd) { bd = d; best = { kind: 'p', id: p.id }; }
  }
  if (!m.arena) for (const q of G.mobs.values()) if (q.hp > 0 && q.faction === 'rome' && q.inst === m.inst) { const d = dist(m, q); if (d < bd) { bd = d; best = { kind: 'mob', id: q.id }; } }
  return best;
}
const tgtEnt = (t) => !t ? null : t.kind === 'p' ? G.players.get(t.id) : G.mobs.get(t.id);
const tgtAlive = (e, t) => e && (t.kind === 'p' ? e.alive : e.hp > 0);

function mobAttackResolve(m) {
  const t = tgtEnt(m.target);
  if (!t || !tgtAlive(t, m.target)) return;
  const d = dist(m, t);
  if (m.def.ranged) {
    shoot({ x: m.x, z: m.z, y: m.y + 1.5, kind: m.def.gear && m.def.gear.w === 'sling' ? 'stone' : 'arrow', owner: m.id, side: m.team ? 'team' + m.team : 'enemy', war: m.war, dmg: m.dmg, inst: m.inst, target: t });
    return;
  }
  const facing = Math.abs(angDiff(Math.atan2(t.x - m.x, t.z - m.z), m.ry));
  if (d > (m.def.range || 2) + 0.9 || facing > 1.3) { fx({ kind: 'whiff', x: m.x, z: m.z }); return; }
  if (m.target.kind === 'p' && !m.inst && (t.y || 0) - Math.max(0, WG.terrainHeight(t.x, t.z)) > 4) { fx({ kind: 'whiff', x: m.x, z: m.z }); return; } // на башне мечом не достать
  if (m.target.kind === 'p') damagePlayer(t, m.dmg * rand(0.9, 1.1), m);
  else hitMob(t, m.dmg * rand(0.9, 1.1), null, m);
}

export function updateMobs(dt) {
  const t = now(); navBudget(); NAV.navTick(t);
  const actives = [];
  for (const m of G.mobs.values()) {
    if (m.hp <= 0) { if (t - m.deadAt > (m.def.tameable && !m.tamedTry ? 45 : 8)) G.mobs.delete(m.id); continue; }
    if (m.kneel) { m.moving = 0; continue; } // пленник на коленях
    // спим, если рядом никого (кроме набегов, подземелий, арены)
    if (!m.src || (m.src.kind !== 'raid' && m.src.kind !== 'caravan' && m.src.kind !== 'assault')) {
      let near = false;
      for (const p of G.players.values()) if (p.inst === m.inst && Math.abs(p.x - m.x) < ACTIVE_R && Math.abs(p.z - m.z) < ACTIVE_R) { near = true; break; }
      if (!near && !m.arena) { m.sleep = true; continue; }
    }
    m.sleep = false;
    actives.push(m);
    const def = m.def;
    if (def.training) { m.moving = 0; m.target = null; continue; }
    if (m.path) { // обоз едет по дороге
      const q = m.path[m.pi]; if (!q) { m.arrived = true; m.moving = 0; continue; }
      const dx = q[0] - m.x, dz = q[1] - m.z, d = Math.hypot(dx, dz);
      if (d < 1.5) { m.pi++; continue; }
      const sp = m.speed * (t - (m.lastHit || 0) < 2 ? 0.4 : 1) * dt;
      m.x += dx / d * Math.min(sp, d); m.z += dz / d * Math.min(sp, d); m.ry = Math.atan2(dx, dz); m.moving = 1;
      continue;
    }
    if (m.stun > t) continue;
    if (m.state === 'wind') {
      if (t >= m.windEnd) { m.state = 'chase'; mobAttackResolve(m); m.atkAt = t + (def.cd || 1.2); }
      continue;
    }
    if (def.faction === 'prey') {
      // травоядные: пасутся, убегают
      let threat = null;
      for (const p of G.players.values()) if (p.alive && p.inst === m.inst && dist(p, m) < 14 && !p.ship) { threat = p; break; }
      if (threat || (m.fleeUntil && m.fleeUntil > t)) {
        const src = threat || m.fleeFrom || m; if (threat) m.fleeFrom = { x: threat.x, z: threat.z };
        const a = Math.atan2(m.x - src.x, m.z - src.z);
        moveMob(m, m.x + Math.sin(a) * 10, m.z + Math.cos(a) * 10, def.speed, dt); m.moving = 2;
      } else wander(m, dt, t);
      continue;
    }
    if (m.squad) { const sl = squadSlotFn(m); if (sl) { m.home = { x: sl.x, z: sl.z }; m.leash = sl.sq && sl.sq.mode === 'hold' ? 16 : 26; } }
    // цель
    if (!m.target || t > (m.retarget || 0)) { const nt = findTarget(m); if (nt) m.target = nt; else if (m.ffa) m.target = null; else if (m.target && !tgtAlive(tgtEnt(m.target), m.target)) m.target = null; m.retarget = t + 0.8; }
    if (m.squad && m.squad.sq !== 'guard') { // отряд держит строй: бьёт только тех, кто рядом со своим местом; по приказу — цель отряда
      const sl = squadSlotFn(m);
      if (sl) {
        if (sl.focus) { const fo = G.mobs.get(sl.focus); if (fo && fo.hp > 0 && dist(m, fo) < (def.ranged ? (def.range || 30) : 9)) m.target = { kind: 'mob', id: fo.id }; }
        const t0 = tgtEnt(m.target); if (t0 && Math.hypot(t0.x - sl.x, t0.z - sl.z) > (def.ranged ? (def.range || 30) + 2 : 7)) m.target = null;
      }
    }
    const tg = tgtEnt(m.target);
    if (m.target && (!tg || !tgtAlive(tg, m.target) || tg.inst !== m.inst || dist(m, tg) > (def.aggro || 20) * 2.2)) m.target = null;
    // отступление к логову
    if (m.target && m.drink) { m.drink = null; m.drinking = false; }
    if (!m.goal && !m.arena && !m.inst && !m.drink && dist(m, m.home) > m.leash + 20) { m.target = null; m.returning = true; }
    if (m.returning) { moveMob(m, m.home.x, m.home.z, def.speed, dt); m.moving = 2; m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.1 * dt); if (dist(m, m.home) < 4) m.returning = false; continue; }
    if (m.target && tg) {
      const d = dist(m, tg), range = def.range || 2;
      const want = def.ranged ? Math.min(range * 0.75, 20) : range * 0.85;
      m.ry = Math.atan2(tg.x - m.x, tg.z - m.z);
      if (def.ranged && d < 6) { // лучники держат дистанцию
        const a = Math.atan2(m.x - tg.x, m.z - tg.z); moveMob(m, m.x + Math.sin(a) * 4, m.z + Math.cos(a) * 4, def.speed * 0.8, dt); m.moving = 1;
        m.ry = Math.atan2(tg.x - m.x, tg.z - m.z);
      } else if (d > want) { moveMob(m, tg.x, tg.z, def.speed * (d > 12 ? 1 : 0.75), dt); m.moving = d > 12 ? 2 : 1; }
      else if (m.arena && !m.ffa) { // на арене бойцы кружат вокруг соперника, отскакивают после удара, применяют приёмы своего класса
        if (!m.skillAt) m.skillAt = t + rand(3, 7);
        if (t > m.skillAt && d < 4.6) { m.skillAt = t + rand(6, 11); arenaSkill(m, tg, t); }
        if ((m.backUntil || 0) > t) { const a = Math.atan2(m.x - tg.x, m.z - tg.z); moveMob(m, m.x + Math.sin(a) * 5, m.z + Math.cos(a) * 5, def.speed * 0.9, dt); m.moving = 1; m.ry = Math.atan2(tg.x - m.x, tg.z - m.z); continue; }
        if (Math.random() < dt * 0.1) m.backUntil = t + rand(1.0, 2.0); // иногда расходятся, чтобы снова сойтись
        m.circ = m.circ || (m.id % 2 ? 1 : -1); if (Math.random() < dt * 0.25) m.circ = -m.circ;
        const a0 = Math.atan2(m.x - tg.x, m.z - tg.z) + m.circ * 0.9 * dt * 2, rr = Math.max(want * 0.9, (t - (m.lastSwing || 0) < 0.8 ? want + 1.6 : want));
        moveMob(m, tg.x + Math.sin(a0) * rr, tg.z + Math.cos(a0) * rr, def.speed * 0.55, dt); m.moving = 1;
        m.ry = Math.atan2(tg.x - m.x, tg.z - m.z);
      } else m.moving = 0;
      if (d <= range + 0.3 && t >= m.atkAt) { m.lastSwing = t; m.state = 'wind'; m.windEnd = t + (def.boss ? 0.75 : def.ranged ? 0.6 : 0.5); m.windStart = t; m.moving = 0; m.ry = Math.atan2(tg.x - m.x, tg.z - m.z); }
      continue;
    }
    // цель набега: постройка
    if (m.goal) {
      const b = G.W.buildings.find((x) => x.id === m.goal);
      if (!b || b.ruined || !b.built) { m.goal = nearestBuildingFor(m); if (!m.goal) { m.goal = null; m.src = null; } continue; }
      const r = D.BUILDINGS[b.type].r;
      const d = dist(m, b);
      // цель за стенами, ворота заперты — ломятся в ближайшие ворота
      const gc = NAV.cityGateBlock(m, b);
      if (gc) {
        const dg = Math.hypot(gc.g.x - m.x, gc.g.z - m.z);
        if (dg > 4.5) { moveMob(m, gc.g.x + Math.sin(gc.g.a) * 3.5, gc.g.z + Math.cos(gc.g.a) * 3.5, def.speed * 0.9, dt); m.moving = 1; }
        else if (t >= m.atkAt) { m.atkAt = t + (def.cd || 1.2) * 1.4; m.ry = Math.atan2(gc.g.x - m.x, gc.g.z - m.z); fx({ kind: 'bldhit', x: m.x, z: m.z, id: m.id }); NAV.hitGate(gc.city, m.dmg * 0.8); m.moving = 0; }
        continue;
      }
      if (d > r + 1.5) { moveMob(m, b.x, b.z, def.speed * 0.9, dt); m.moving = 1; }
      else if (t >= m.atkAt) { m.atkAt = t + (def.cd || 1.2) * 1.4; m.ry = Math.atan2(b.x - m.x, b.z - m.z); fx({ kind: 'bldhit', x: m.x, z: m.z, id: m.id }); damageBuilding(b, m.dmg * 0.8, m); m.moving = 0; }
      continue;
    }
    if (m.warDest && !m.target) { moveMob(m, m.warDest.x, m.warDest.z, def.speed * 0.85, dt); m.moving = 1; continue; } // армия бота наступает на чужой край поля
    wander(m, dt, t);
  }
  separate(actives);
}
// приёмы гладиаторов и зверей арены
const SKILLS = {
  glad_murmillo: ['Удар щитом', 'stun', 1.3, 0.6], glad_slave: ['Удар щитом', 'stun', 1.1, 0.6], glad_retiarius: ['Бросок сети', 'stun', 2.2, 0.3],
  glad_thraex: ['Двойной выпад', 'hit', 0, 1.5], glad_champion: ['Вихрь клинка', 'area', 0, 1.1], lion_tamed: ['Прыжок льва', 'leap', 0.8, 1.4], lion_boss: ['Прыжок льва', 'leap', 0.8, 1.4],
};
function arenaSkill(m, tg, t) {
  const sk = SKILLS[m.type]; if (!sk) return;
  const [name, kind, stun, mul] = sk, dmg = m.dmg * mul;
  const hit = (e) => { if (e.char) damagePlayer(e, dmg, m); else { hitMob(e, dmg, null, m); if (stun) e.stun = t + stun; } };
  if (kind === 'leap') { const a = Math.atan2(tg.x - m.x, tg.z - m.z), dd = Math.max(0, dist(m, tg) - 1.4); m.x += Math.sin(a) * dd; m.z += Math.cos(a) * dd; }
  if (kind === 'area') { for (const o of G.mobs.values()) if (o !== m && o.arena && o.hp > 0 && o.faction !== m.faction && dist(o, m) < 3.4) hit(o); for (const q of G.players.values()) if (q.alive && G.arena && G.arena.fighters.has(q.id) && dist(q, m) < 3.4 && m.faction !== 'rome') hit(q); }
  else hit(tg);
  fx({ kind: 'skill', x: m.x, z: m.z, text: name, id: m.id });
}
function wander(m, dt, t) {
  if (m.board) { m.moving = 0; return; } // абордаж: стоят на палубе
  if (m.squad) { // воин отряда держит место в строю
    const sl = squadSlotFn(m); if (!sl) { m.moving = 0; return; }
    const d = Math.hypot(sl.x - m.x, sl.z - m.z);
    if (d > 1.0) { moveMob(m, sl.x, sl.z, m.speed * (d > 10 ? 1.15 : d > 3 ? 0.8 : 0.45), dt); m.moving = d > 10 ? 2 : 1; } else m.moving = 0;
    return;
  }
  if (m.faction === 'rome' && !m.inst) { // гарнизон и дозорные патрулируют свой город (вдоль стен)
    if (!m.patrol || dist(m, m.patrol) < 2) { if (m.watch) { const a = Math.random() * 6.28, r = m.watch.R * (0.6 + Math.random() * 0.3); m.patrol = { x: m.watch.x + Math.sin(a) * r, z: m.watch.z + Math.cos(a) * r }; } else m.patrol = { x: WG.CITY.x + rand(-120, 120), z: WG.CITY.z + rand(-120, 120) }; }
    moveMob(m, m.patrol.x, m.patrol.z, m.def.speed * 0.4, dt); m.moving = 1; return;
  }
  if (m.arena || m.inst) { m.moving = 0; return; }
  // звери из логов время от времени ходят на водопой к реке или озеру и возвращаются
  if (m.src && m.src.kind === 'den' && m.def.model !== 'croc') {
    if (m.nextDrink == null) m.nextDrink = t + rand(40, 200);
    if (!m.drink && t > m.nextDrink) { m.nextDrink = t + rand(300, 600); const sp = drinkSpot(m.home); if (sp) m.drink = { x: sp.x, z: sp.z, ph: 'go' }; }
    const dr = m.drink;
    if (dr) {
      if (dr.ph === 'go') { if (dist(m, dr) > 1.2) { moveMob(m, dr.x, dr.z, m.def.speed * 0.45, dt); m.moving = 1; } else { dr.ph = 'drink'; dr.until = t + rand(18, 35); } }
      else if (dr.ph === 'drink') { m.moving = 0; m.drinking = true; if (t > dr.until) { dr.ph = 'back'; m.drinking = false; } }
      else { if (dist(m, m.home) > 4) { moveMob(m, m.home.x, m.home.z, m.def.speed * 0.45, dt); m.moving = 1; } else m.drink = null; }
      return;
    }
  }
  if (t > m.nextAct) { m.nextAct = t + rand(3, 9); m.wTo = Math.random() < 0.5 ? null : { x: m.home.x + rand(-10, 10), z: m.home.z + rand(-10, 10) }; }
  if (m.wTo && dist(m, m.wTo) > 0.6) { moveMob(m, m.wTo.x, m.wTo.z, m.def.speed * 0.3, dt); m.moving = 1; } else m.moving = 0;
}
export function nearestBuildingFor(m) { // ближайшее целое здание; где уже двое налётчиков — ищут другое рядом
  const busy = new Map(); for (const o of G.mobs.values()) if (o !== m && o.goal && o.hp > 0) busy.set(o.goal, (busy.get(o.goal) || 0) + 1);
  let best = null, bd = 1e9;
  for (const b of G.W.buildings) if (b.built && !b.ruined && !b.enemy && !D.BUILDINGS[b.type].road && !D.BUILDINGS[b.type].stall) { const d = dist(m, b) + Math.max(0, (busy.get(b.id) || 0) - 1) * 40; if (d < bd) { bd = d; best = b.id; } }
  return best;
}

// ---------- Урон ----------
export function damagePlayer(p, dmg, src, opts = {}) {
  if (!p.alive || !p.char) return;
  const t = now();
  if (p.iframe > t) { send(p, { type: 'dodged' }); return; }
  if (p.godUntil > t) return;
  if (src && src.char) p.lastHurtByP = t; // удар от игрока: режим сражения сейчас не выключить
  if (G.arena && G.arena.fighters.has(p.id) && p.char.arenaGear) dmg *= 1 - 0.05 * (p.char.arenaGear.def || 0);
  const c = p.char;
  let blocked = false;
  if (p.block && src) {
    const ang = Math.atan2(src.x - p.x, src.z - p.z);
    if (Math.abs(angDiff(ang, p.ry)) < 1.3) {
      const sh = c.gear.offhand && GEAR[c.gear.offhand.k];
      const k = sh ? sh.block * QUALITY[c.gear.offhand.q || 0].mul ** 0.3 : 0.35;
      const cost = dmg * CFG.stamina.block * (sh ? 1 : 1.6);
      if (p.st >= cost) { p.st -= cost; dmg *= 1 - Math.min(0.92, k); blocked = true; }
      else { p.st = 0; p.block = false; p.guardBreak = t + 1.2; }
    }
  }
  dmg *= 1 - gearArmor(c) / 100;
  if (lawsAt(p).conscription && src && src.src && src.src.kind === 'raid') dmg *= 0.95;
  dmg = Math.max(1, Math.round(dmg));
  p.hp -= dmg; p.lastHurt = t;
  fx({ kind: blocked ? 'block' : 'hit', x: p.x, z: p.z, y: 1.3, pid: p.id, n: dmg });
  if (src && src.def && src.def.poison && !blocked && Math.random() < 0.4) { p.poison = t + 8; send(p, { type: 'log', text: 'Укус кобры! Яд жжёт — перевяжите рану (R).', kind: 'bad' }); }
  if (p.hp <= 0) killPlayer(p, src);
}
export function killPlayer(p, src) {
  p.hp = 0; p.alive = false; p.deadAt = now(); p.block = false; p.mounted = false;
  const c = p.char;
  if (G.arena && G.arena.fighters.has(p.id)) { arenaKnockout(p); return; }
  if (p.war) { send(p, { type: 'dead', by: src && src.char ? src.char.name : src && src.def ? src.def.name : 'враг', lost: 0, t: CFG.respawnTime }); return; } // Поле Марса: без потерь, встаёт у своего края
  const lost = Math.floor(c.den * 0.1);
  c.den -= lost; c.stats2.deaths++;
  if (p.ship) leaveShipSilently(p);
  const who = src ? (src.def ? src.def.name : src.char ? src.char.name : 'неизвестность') : 'стихия';
  log(`☠ ${c.name} пал(а)${src && src.def ? ` — ${src.def.name}` : ''}.`, 'bad');
  send(p, { type: 'dead', by: who, lost, t: CFG.respawnTime });
  p.dirtyChar = true;
}
let arenaKnockout = () => {}, leaveShipSilently = () => {};
export function setCombatHooks(h) { if (h.arenaKnockout) arenaKnockout = h.arenaKnockout; if (h.leaveShip) leaveShipSilently = h.leaveShip; }

// удар по существу; by — игрок (p) или существо
export function hitMob(m, dmg, p, byMob = null, opts = {}) {
  if (m.hp <= 0) return;
  if (m.def.training) {
    const hit = Math.max(1, Math.round(dmg));
    m.hp = m.maxHp; m.lastHit = now();
    fx({ kind: 'mhit', x: m.x, z: m.z, y: m.y + 1.2, id: m.id, n: hit, crit: false });
    return;
  }
  if (m.kneel) { m.kneel = null; killMob(m, p); return; } // добить пленника
  if (m.faction === 'rome' && p) return; // своих не бьём
  if (byMob) m.lastByMob = byMob;
  if (m.arena && p && !(G.arena && G.arena.fighters.has(p.id))) return;
  let mul = 1;
  if (p && G.arena && G.arena.fighters.has(p.id) && p.char.arenaGear) mul *= 1 + 0.08 * (p.char.arenaGear.atk || 0);
  if (p) {
    // легат рядом — союзники бьют сильнее
    const leg = [...G.players.values()].find((q) => q.char && hasOffice(q.char, 'legatus') && Math.hypot(q.x - p.x, q.z - p.z) < 40);
    if (leg && dist(leg, p) < 25) mul *= 1.15;
    if (lawsAt(p).conscription && m.src && m.src.kind === 'raid') mul *= 1.2;
  }
  const crit = p && Math.random() < 0.1;
  dmg = Math.max(1, Math.round(dmg * mul * (crit ? 1.6 : 1) * (1 - Math.min(60, m.armor) / 100)));
  m.hp -= dmg; m.lastHit = now();
  if (p) { m.target = { kind: 'p', id: p.id }; m.returning = false; p.dmgDealt = (p.dmgDealt || 0) + dmg; (m.hitters || (m.hitters = new Set())).add(p.id); }
  else if (byMob) m.target = { kind: 'mob', id: byMob.id };
  if (m.faction === 'prey') { m.fleeUntil = now() + 6; m.fleeFrom = p ? { x: p.x, z: p.z } : null; }
  // отбрасывание
  if (opts.knock && p) { const a = Math.atan2(m.x - p.x, m.z - p.z), k = m.def.boss ? 0.2 : 0.7; const nx = m.x + Math.sin(a) * k, nz = m.z + Math.cos(a) * k; if (mobGround(m, nx, nz)) { m.x = nx; m.z = nz; } }
  if (opts.stagger && !m.def.boss && m.state === 'wind' && Math.random() < 0.35) { m.state = 'chase'; m.atkAt = now() + 0.6; m.stun = now() + 0.4; }
  fx({ kind: 'mhit', x: m.x, z: m.z, y: m.y + 1.2, id: m.id, n: dmg, crit });
  if (m.hp <= 0) killMob(m, p);
}
let kneelFn = () => false;
export function setKneelFn(fn) { kneelFn = fn; }
export function killMob(m, p) {
  if (m.war) { m.hp = 0; m.deadAt = now(); m.state = 'dead'; fx({ kind: 'mdie', id: m.id, x: m.x, z: m.z }); return; } // Поле Марса: без добычи и пленных — награда за победу в бою
  const kneel = !m.kneelDone && kneelFn(m, p); // поверженный враг может встать на колено — тогда его можно сделать рабом
  if (kneel) m.kneelDone = true;
  else { m.hp = 0; m.deadAt = now(); m.state = 'dead'; fx({ kind: 'mdie', id: m.id, x: m.x, z: m.z }); }
  const def = m.def;
  const killers = m.hitters ? [...m.hitters].map((id) => G.players.get(id)).filter(Boolean) : p ? [p] : [];
  if (m.lastByMob && m.lastByMob.squad) try { squadKillFn(m.lastByMob, m); } catch (e) { console.error(e); }
  if (def.xp && killers.length) {
    const xp = def.xp * (1 + 0.12 * (m.lvl - 1));
    for (const k of killers) { grantXp(k, xp / Math.sqrt(killers.length)); k.char.kills[m.type] = (k.char.kills[m.type] || 0) + 1; k.char.stats2.killed++; questHook(k, 'kill', { type: m.type, mob: m }); const mp = D.MIL_PTS[def.faction]; if (mp) k.char.milPts = (k.char.milPts || 0) + mp * (def.boss ? 5 : 1); if (m.src && (m.src.kind === 'raid' || m.src.ship) && (def.faction === 'punic' || def.faction === 'barbarian')) grantDig(k, def.boss ? 10 : 2); } // защитникам от набега — одобрение Рима
  }
  // добыча
  if (killers.length || m.src?.kind === 'raid') {
    for (const [res, [a, b]] of Object.entries(def.loot || {})) { const n = randi(a, b); if (n > 0) dropItem(m.x + rand(-1, 1), m.z + rand(-1, 1), res, n, 0, m.inst); }
    if (def.denarii) dropItem(m.x, m.z, 'denarii', Math.round(randi(...def.denarii) * (1 + 0.1 * (m.lvl - 1))), 0, m.inst);
    if (def.human && Math.random() < (def.boss ? 0.6 : 0.06)) {
      const pool = def.boss ? ['spatha', 'hamata', 'galea_iron', 'scutum', 'ocreae_iron', 'bow'] : ['gladius', 'parma', 'galea_bronze', 'hasta', 'ocreae', 'axe'];
      dropItem(m.x, m.z, pick(pool), 1, Math.random() < 0.15 ? 2 : Math.random() < 0.45 ? 1 : 0, m.inst);
    }
    if (def.faction === 'robber' && Math.random() < 0.18) dropItem(m.x, m.z, 'scrap', 1, 0, m.inst);
  }
  if (kneel) return; // смерть «засчитается», когда пленника уведут или он сбежит
  if (m.src && m.src.city && ['cityguard', 'caravan', 'suburb'].includes(m.src.kind) && !m.def.wagon) unitKillFn(m.src.city, p); // каждый павший воин чужого города — минус к его обороне
  if (m.src && m.src.onDeath) m.src.onDeath(m, p);
}

// ---------- Атака игрока ----------
const HIT_DELAY = { blade: 0.2, knife: 0.13, axe: 0.38, spear: 0.24, fist: 0.15, tool: 0.33, torch: 0.2, rod: 0.3 };
let boardFn = () => false;
export function setBoardFn(fn) { boardFn = fn; }
export function playerAttack(p, m) {
  const c = p.char, t = now();
  if (!p.alive) return;
  if (c.carry) return; // в руках ящик
  const w = c.gear.weapon ? GEAR[c.gear.weapon.k] : { kind: 'fist', dmg: 7, cd: 0.45, range: 2, stam: 3 };
  if (p.ship && w.kind !== 'bow') { // с палубы: абордаж — удар по команде вражеского корабля рядом
    if (t < (p.atkReady || 0) - 0.08 || p.st < (w.stam || 3) * 0.5) return;
    const der0 = derivedOf(c), q0 = c.gear.weapon ? QUALITY[c.gear.weapon.q || 0].mul : 1;
    p.st -= w.stam || 3; p.atkReady = t + (w.cd || 0.6) / der0.atkSpeed; p.lastAtk = { t, kind: w.kind, combo: m.combo | 0 };
    boardFn(p, (w.dmg || 7) * q0 * der0.melee);
    return;
  }
  const q = c.gear.weapon ? QUALITY[c.gear.weapon.q || 0].mul : 1;
  const der = derivedOf(c);
  if (t < (p.atkReady || 0) - 0.08) return;
  if (w.kind === 'bow') return playerShoot(p, m, w, q);
  if (w.kind === 'rod') return;
  if (p.st < w.stam * 0.5) { send(p, { type: 'tired' }); return; }
  p.st -= w.stam; p.lastSt = t;
  const combo = Math.max(0, Math.min(2, m.combo | 0));
  p.atkReady = t + w.cd / der.atkSpeed * (combo === 2 ? 1.25 : 1);
  p.ry = Number(m.ry) || p.ry;
  p.lastAtk = { t, kind: w.kind, combo };
  const delay = (HIT_DELAY[w.kind] || 0.2) / der.atkSpeed;
  let mul = der.melee; if (D.specTop(p.char, 'war')) { p.warHits = (p.warHits || 0) + 1; if (p.warHits % 5 === 0) mul *= 2; } // боевой клич Воина
  G.pendingHits.push({ at: t + delay, p, w, q, combo, mul });
}
export function resolvePendingHits() {
  const t = now();
  for (let i = G.pendingHits.length - 1; i >= 0; i--) {
    const h = G.pendingHits[i];
    if (h.at > t) continue;
    G.pendingHits.splice(i, 1);
    const p = h.p; if (!p.alive) continue;
    const w = h.w, arc = w.kind === 'spear' || h.combo === 2 ? 0.55 : w.kind === 'axe' ? 1.1 : 1.0;
    const range = (w.range || 2) + (h.combo === 2 ? 0.4 : 0);
    let base = w.dmg * h.q * h.mul * (h.combo === 2 ? 1.35 : h.combo === 1 ? 1.1 : 1);
    const maxT = w.kind === 'axe' ? 2 : w.kind === 'blade' ? 2 : 1;
    const cands = [];
    for (const m of G.mobs.values()) {
      if (m.hp <= 0 || m.inst !== p.inst || (m.team ? !(p.war && p.war.lid === m.war && p.war.team !== m.team) : m.faction === 'rome')) continue;
      const d = dist(p, m), rad = m.def.boss ? 1.6 : 0.8;
      if (d > range + rad) continue;
      if (Math.abs(angDiff(Math.atan2(m.x - p.x, m.z - p.z), p.ry)) > arc + (d < 1.2 ? 1 : 0)) continue;
      cands.push([d, m]);
    }
    // поединок на арене или вольный бой (оба включили режим сражения): удар по сопернику
    const duel = G.arena && G.arena.duel && G.arena.fighters.has(p.id);
    if (duel || p.pvp) for (const q of G.players.values()) {
      if (q === p || !q.alive || q.inst !== p.inst || (duel ? !G.arena.fighters.has(q.id) : !q.pvp)) continue;
      const d = dist(p, q); if (d > range + 0.6) continue;
      if (Math.abs(angDiff(Math.atan2(q.x - p.x, q.z - p.z), p.ry)) > arc) continue;
      damagePlayer(q, base * 0.7, p);
    }
    cands.sort((a, b) => a[0] - b[0]);
    for (const [, m] of cands.slice(0, maxT)) hitMob(m, base * rand(0.92, 1.08), p, null, { knock: true, stagger: true });
    if (!cands.length) { // удар по ресурсам — по дереву топором и т.п. делается сбором
    }
  }
}
function aimDir(p, m, range, grav) {
  // точка под прицелом от клиента: стреляем точно в неё (враг рядом с точкой — подстраиваемся под него)
  if (Array.isArray(m.aim) && m.aim.every((v) => isFinite(Number(v)))) {
    const ax = Number(m.aim[0]), ay = Number(m.aim[1]), az = Number(m.aim[2]);
    const d = Math.hypot(ax - p.x, az - p.z);
    if (d > 1.5 && d < range * 1.6) {
      let best = null, bd = 2.2;
      for (const q of G.mobs.values()) { if (q.hp <= 0 || q.inst !== p.inst || q.faction === 'rome') continue; const dd = Math.hypot(q.x - ax, q.z - az); if (dd < bd) { bd = dd; best = q; } }
      for (const e of G.eships.values()) { const dd = Math.hypot(e.x - ax, e.z - az); if (dd < 7 && dd < bd + 5) { best = e; bd = dd; } }
      return { ry: Math.atan2((best ? best.x : ax) - p.x, (best ? best.z : az) - p.z), pitch: 0, target: best || { x: ax, z: az, y: ay - 1.1 } };
    }
  }
  // помощь в прицеливании: ближайший враг в узком конусе
  const ry = Number(m.ry) || p.ry, pitch = Math.max(-0.6, Math.min(0.9, Number(m.pitch) || 0));
  let best = null, bs = 0.16;
  for (const q of G.mobs.values()) {
    if (q.hp <= 0 || q.inst !== p.inst || q.faction === 'rome' || q.faction === 'prey' && false) continue;
    const d = dist(p, q); if (d > range || d < 1) continue;
    const da = Math.abs(angDiff(Math.atan2(q.x - p.x, q.z - p.z), ry));
    if (da < bs) { bs = da; best = q; }
  }
  for (const e of G.eships.values()) {
    const d = dist(p, e); if (d > range) continue;
    const da = Math.abs(angDiff(Math.atan2(e.x - p.x, e.z - p.z), ry));
    if (da < bs) { bs = da; best = e; }
  }
  return { ry: best ? Math.atan2(best.x - p.x, best.z - p.z) : ry, pitch, target: best };
}
function playerShoot(p, m, w, q) {
  const c = p.char, t = now();
  if ((c.bag.arrow || 0) <= 0) { send(p, { type: 'log', text: 'Нет стрел. Их делают в Мастерской или покупают на рынке.', kind: 'warn' }); return; }
  const der = derivedOf(c);
  p.atkReady = t + w.cd / der.atkSpeed; p.st -= w.stam;
  c.bag.arrow--; if (!c.bag.arrow) delete c.bag.arrow; p.dirtyChar = true;
  const a = aimDir(p, m, w.range, 0.5);
  p.ry = a.ry; p.lastAtk = { t, kind: 'bow', combo: 0 };
  shoot({ x: p.x, z: p.z, y: (p.y || 0) + 1.5, kind: 'arrow', owner: p.id, side: 'player', dmg: w.dmg * q * der.ranged, inst: p.inst, ry: a.ry, pitch: a.pitch, target: a.target, delay: 0.25 / der.atkSpeed });
}
export function playerThrow(p, m) {
  const c = p.char, t = now();
  if (!p.alive || (c.bag.pilum || 0) <= 0 || t < (p.atkReady || 0)) return;
  if (p.st < 10) return;
  const der = derivedOf(c);
  c.bag.pilum--; if (!c.bag.pilum) delete c.bag.pilum; p.dirtyChar = true;
  p.st -= 10; p.atkReady = t + 1.0;
  const a = aimDir(p, m, 30, 1);
  p.ry = a.ry; p.lastAtk = { t, kind: 'throw', combo: 0 };
  shoot({ x: p.x, z: p.z, y: (p.y || 0) + 1.8, kind: 'pilum', owner: p.id, side: 'player', dmg: 34 * der.ranged, inst: p.inst, ry: a.ry, pitch: a.pitch, target: a.target, delay: 0.3 });
}
// снаряд: летит баллистически; если есть цель — выставляем угол, чтобы долететь
export function shoot(o) {
  const speed = o.kind === 'arrow' ? 46 : o.kind === 'pilum' ? 28 : 34, g = o.kind === 'arrow' ? 9 : 12;
  let ry = o.ry, vy;
  let horiz = speed;
  if (o.target) {
    const tx = o.target.x, tz = o.target.z, d = Math.hypot(tx - o.x, tz - o.z);
    ry = Math.atan2(tx - o.x, tz - o.z);
    const tt = d / speed; vy = (((o.target.y || 0) + 1.1 - o.y) / tt) + 0.5 * g * tt;
  } else vy = Math.sin(o.pitch || 0) * speed + 2;
  const pr = { id: nid(), kind: o.kind, x: o.x, y: o.y, z: o.z, vx: Math.sin(ry) * horiz, vz: Math.cos(ry) * horiz, vy, g, owner: o.owner, side: o.side, war: o.war, dmg: o.dmg, inst: o.inst, born: now() + (o.delay || 0), life: 3 };
  G.proj.set(pr.id, pr);
}
export function updateProj(dt) {
  const t = now();
  for (const pr of G.proj.values()) {
    if (t < pr.born) continue;
    pr.x += pr.vx * dt; pr.z += pr.vz * dt; pr.vy -= pr.g * dt; pr.y += pr.vy * dt;
    if (t - pr.born > pr.life) { G.proj.delete(pr.id); continue; }
    const ground = pr.inst ? (G.instances.get(pr.inst)?.y0 || 0) : Math.max(-0.5, WG.terrainHeight(pr.x, pr.z));
    let hit = false;
    if (pr.side && pr.side.startsWith('team')) { // стрелы армий Поля Марса
      const tm = pr.side.slice(4);
      for (const m of G.mobs.values()) { if (m.hp <= 0 || !m.team || m.team === tm || m.war !== pr.war) continue; if (Math.abs(m.x - pr.x) < 0.9 && Math.abs(m.z - pr.z) < 0.9 && pr.y - (m.y || ground) < 2.6) { hitMob(m, pr.dmg, null, G.mobs.get(pr.owner)); hit = true; break; } }
      if (!hit) for (const p of G.players.values()) { if (!p.alive || !p.war || p.war.lid !== pr.war || p.war.team === tm) continue; if (Math.abs(p.x - pr.x) < 0.7 && Math.abs(p.z - pr.z) < 0.7 && pr.y - (p.y || ground) < 2.2) { damagePlayer(p, pr.dmg, { x: pr.x - pr.vx * 0.1, z: pr.z - pr.vz * 0.1 }); hit = true; break; } }
    } else if (pr.side === 'player') {
      for (const m of G.mobs.values()) {
        const shw = G.players.get(pr.owner);
        if (m.hp <= 0 || m.inst !== pr.inst || (m.team ? !(shw && shw.war && shw.war.lid === m.war && shw.war.team !== m.team) : m.faction === 'rome')) continue;
        const r = m.def.boss ? 1.8 : 0.9;
        if (Math.abs(m.x - pr.x) < r && Math.abs(m.z - pr.z) < r && pr.y - (m.y || ground) < 2.6) { hitMob(m, pr.dmg, G.players.get(pr.owner)); hit = true; break; }
      }
      const sh = G.players.get(pr.owner); // стрелы по игрокам — только если оба в режиме сражения
      if (!hit && sh) for (const q of G.players.values()) { // в бою с игроками, а на море — с любого корабля по людям на чужом корабле
        if (q === sh || !q.alive || q.inst !== pr.inst) continue;
        if (!((sh.pvp && q.pvp) || (sh.ship && q.ship && q.ship !== sh.ship) || (sh.war && q.war && sh.war.lid === q.war.lid && sh.war.team !== q.war.team))) continue;
        if (Math.abs(q.x - pr.x) < 0.7 && Math.abs(q.z - pr.z) < 0.7 && pr.y - (q.y || ground) < 2.2) { damagePlayer(q, pr.dmg * 0.7, sh); hit = true; break; }
      }
      if (!hit) for (const e of G.eships.values()) {
        const dx = pr.x - e.x, dz = pr.z - e.z, ca = Math.cos(e.ry), sa = Math.sin(e.ry);
        const lz = dx * sa + dz * ca, lx = dx * ca - dz * sa;
        if (Math.abs(lz) < e.def.len / 2 && Math.abs(lx) < 3 && pr.y < 4) { hitEnemyShip(e, pr.dmg * 0.6, G.players.get(pr.owner)); hit = true; break; }
      }
    } else {
      for (const p of G.players.values()) {
        if (!p.alive || p.inst !== pr.inst) continue;
        if (Math.abs(p.x - pr.x) < 0.7 && Math.abs(p.z - pr.z) < 0.7 && pr.y - (p.y || ground) < 2.2) { damagePlayer(p, pr.dmg, { x: pr.x - pr.vx * 0.1, z: pr.z - pr.vz * 0.1 }); hit = true; break; }
      }
      if (!hit) for (const m of G.mobs.values()) {
        if (m.hp <= 0 || m.faction !== 'rome' || m.inst !== pr.inst) continue;
        if (Math.abs(m.x - pr.x) < 0.8 && Math.abs(m.z - pr.z) < 0.8 && pr.y < 2.4) { hitMob(m, pr.dmg, null); hit = true; break; }
      }
    }
    if (hit || pr.y < ground) { G.proj.delete(pr.id); if (!hit) fx({ kind: 'thud', x: pr.x, z: pr.z, y: ground }); }
  }
}
let hitEnemyShip = () => {};
export function setShipHit(fn) { hitEnemyShip = fn; }

// ---------- Предметы на земле ----------
export function dropItem(x, z, k, n = 1, q = 0, inst = null) {
  const d = { id: nid(), k, n, q, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, inst, until: now() + 300 };
  G.drops.set(d.id, d);
  return d;
}
export function pickupDrops(p) {
  const c = p.char; if (!c || !p.alive) return;
  for (const d of G.drops.values()) {
    if (d.inst !== p.inst || (d.noPick === p.id && now() < d.noPickUntil) || Math.abs(d.x - p.x) > CFG.pickupR || Math.abs(d.z - p.z) > CFG.pickupR) continue;
    if (d.k === 'denarii') { c.den += d.n; send(p, { type: 'loot', text: `+${d.n} денариев`, k: 'denarii' }); }
    else if (d.k === 'scrap') {
      c.scraps = (c.scraps || 0) + 1; send(p, { type: 'loot', text: `Обрывок древнего папируса (${c.scraps}/5)`, k: 'papyrus' });
    } else if (D.RES[d.k]) {
      const got = addRes(c, d.k, d.n);
      if (!got) { if (!p.fullWarn || now() - p.fullWarn > 5) { p.fullWarn = now(); send(p, { type: 'log', text: 'Сумка полна — продайте или сдайте ресурсы.', kind: 'warn' }); } continue; }
      send(p, { type: 'loot', text: `+${got} ${D.RES[d.k].name}`, k: d.k });
      if (got < d.n) { d.n -= got; p.dirtyChar = true; continue; }
    } else if (GEAR[d.k]) {
      if (!addGear(c, d.k, d.q)) continue;
      send(p, { type: 'loot', text: `Найдено: ${GEAR[d.k].name} (${QUALITY[d.q].name})`, k: d.k, q: d.q });
    }
    G.drops.delete(d.id); p.dirtyChar = true;
    broadcast({ type: 'dropGone', id: d.id });
  }
}

// ---------- Населяем мир ----------
// звери в логовах и варвары в лагерях появляются, когда рядом есть игроки
export function populate() {
  const t = now();
  const W = G.W;
  const near = (x, z, r) => [...G.players.values()].some((p) => !p.inst && Math.abs(p.x - x) < r && Math.abs(p.z - z) < r);
  const arsenals = W.buildings.filter(b => b.type === 'armamentarium' && b.built && !b.ruined && !b.enemy);
  for (const m of [...G.mobs.values()]) if (m.def.training && !arsenals.some(b => b.id === m.src?.arsenal)) G.mobs.delete(m.id);
  for (const b of arsenals) {
    if (!near(b.x, b.z, 230)) continue;
    const existing = [...G.mobs.values()].filter(m => m.def.training && m.src?.arsenal === b.id);
    for (let i = existing.length; i < 3; i++) {
      let point = null;
      for (let r = 13; r <= 31 && !point; r += 3) for (let j = 0; j < 24; j++) {
        const a = (b.ry || 0) + j * Math.PI / 12, x = b.x + Math.sin(a) * r, z = b.z + Math.cos(a) * r;
        if (WG.terrainHeight(x, z) < 0.5 || !NAV.free(x, z) || WG.onRoadNet(x, z) || [...G.mobs.values()].some(m => m.def.training && Math.hypot(m.x - x, m.z - z) < 4)) continue;
        point = { x, z, a }; break;
      }
      if (!point) break;
      const m = spawnMob('training_dummy', point.x, point.z, { src: { kind: 'training', arsenal: b.id } });
      m.ry = point.a + Math.PI; m.home = { x: m.x, z: m.z };
    }
  }
  for (const den of G.world.dens) {
    const alive = den.live ? den.live.filter((id) => G.mobs.has(id) && G.mobs.get(id).hp > 0) : [];
    den.live = alive;
    if (!near(den.x, den.z, 330)) { if (alive.length && !near(den.x, den.z, 420)) { for (const id of alive) G.mobs.delete(id); den.live = []; } continue; }
    if (alive.length >= den.n) continue;
    if (den.nextAt && den.nextAt > t) continue;
    const lvl = den.boss ? 6 : (WG.islandLevel[den.island] || 1) + randi(0, 1);
    const m = spawnMob(den.type, den.x + rand(-4, 4), den.z + rand(-4, 4), { lvl, src: { kind: 'den', den: den.id }, leash: den.boss ? 30 : 45 });
    if (m) den.live.push(m.id);
    den.nextAt = t + (alive.length === 0 && !den.spawnedOnce ? 0.1 : den.boss ? 1800 : CFG.animalRespawn * rand(0.6, 1.2));
    if (alive.length + 1 >= den.n) den.spawnedOnce = true;
  }
  for (const camp of G.world.camps) {
    const st = W.camps[camp.id] || (W.camps[camp.id] = {});
    if (st.destroyedAt && Date.now() / 1000 - st.destroyedAt < CFG.campRespawn) continue;
    if (st.destroyedAt) { st.destroyedAt = 0; G.dirtyWorld = true; }
    if (!near(camp.x, camp.z, 300)) { if (camp.live && camp.live.length && !near(camp.x, camp.z, 400)) { for (const id of camp.live) G.mobs.delete(id); camp.live = []; camp.spawned = false; } continue; }
    if (camp.spawned) continue;
    camp.spawned = true; camp.live = [];
    const units = camp.pirate ? ['pirate', 'pirate', 'pirate_slinger', 'pirate', 'pirate', 'pirate_slinger', 'pirate', 'pirate'] : camp.punic ? ['punic_inf', 'punic_inf', 'punic_slinger', 'punic_inf', 'punic_vet', 'punic_slinger'] : ['barb_warrior', 'barb_warrior', 'barb_spear', 'barb_archer', 'barb_warrior', 'barb_chief'];
    if (camp.lvl >= 5 && !camp.punic) units.push('barb_spear', 'barb_archer');
    units.forEach((u, i) => {
      const a = i / units.length * Math.PI * 2;
      const m = spawnMob(u, camp.x + Math.cos(a) * 7, camp.z + Math.sin(a) * 7, { lvl: camp.lvl + randi(0, 1), leash: 34, src: { kind: 'camp', camp: camp.id, onDeath: () => campCheck(camp) } });
      if (m) camp.live.push(m.id);
    });
  }
}
function campCheck(camp) {
  const alive = camp.live.filter((id) => G.mobs.has(id) && G.mobs.get(id).hp > 0);
  if (alive.length) return;
  if (camp.punic) { camp.spawned = false; camp.live = []; G.W.camps[camp.id] = { destroyedAt: now() - CFG.campRespawn + 300 }; G.W.threat = Math.max(0, G.W.threat - 6); log('⚔ Гарнизон у стен Пунийской крепости перебит! Угроза Карфагена снижена.', 'good'); G.dirtyWorld = true; return; }
  G.W.camps[camp.id] = { destroyedAt: now(), raidAt: (G.W.camps[camp.id] || {}).raidAt || 0 };
  if (!camp.pirate && camp.island === 'main') log('🔥 Лагерь варваров разгромлен — из него не будет набегов около 40 минут.', 'good');
  for (const e of G.W.events || []) if (e.kind === 'raid' && e.live && e.camp === camp.id) { let n = 0; for (const m of [...G.mobs.values()]) if (m.src && m.src.raid === e.id && m.hp > 0) { G.mobs.delete(m.id); n++; } e.live = false; e.until = now(); G.dirtyWorld = true; if (n) log(`🏃 Узнав о разгроме лагеря, ${n} варваров бросили набег и разбежались.`, 'good'); }
  camp.spawned = false; camp.live = [];
  if (camp.pirate) { // логово пиратов разгромлено: море на время спокойно
    G.W.pirateCalm = Date.now() / 1000 + 1800;
    for (const e of G.eships.values()) if (e.type === 'pirate_ship') { e.mode = 'flee'; e.prey = null; e.until = now() + 60; }
    dropItem(camp.x, camp.z, 'denarii', randi(150, 300)); dropItem(camp.x + 1, camp.z, 'silver', randi(2, 4)); dropItem(camp.x - 1, camp.z, 'wine', randi(2, 5));
    log('🏴 Пиратское логово разгромлено! Полчаса пираты не посмеют выйти в море.', 'good'); chronicle('Колонисты разгромили пиратское логово');
    for (const p of G.players.values()) if (!p.inst && dist(p, camp) < 90) { grantDig(p, 30); grantXp(p, 250); treasureFn(p, 'Пиратское логово разгромлено'); }
    G.dirtyWorld = true; return;
  }
  dropItem(camp.x, camp.z, 'denarii', randi(60, 140));
  dropItem(camp.x + 1, camp.z, 'iron', randi(2, 5)); dropItem(camp.x - 1, camp.z, 'hide', randi(3, 6));
  log('🔥 Лагерь варваров разгромлен! Добыча лежит у костра.', 'good');
  chronicle('Колонисты разгромили лагерь варваров');
  for (const p of G.players.values()) if (!p.inst && dist(p, camp) < 80) { grantDig(p, 15); questHook(p, 'camp', { camp: camp.id }); if (Math.random() < 0.6) treasureFn(p, 'Лагерь варваров разгромлен'); }
  G.dirtyWorld = true;
}
// гарнизон легионеров
export function syncGarrison() {
  const want = G.W.garrison || 0;
  const live = [...G.mobs.values()].filter((m) => m.src && m.src.kind === 'garrison' && !m.inst && m.hp > 0);
  if (live.length < want) {
    const c = G.W.buildings.find((b) => b.type === 'castra' && b.built) || G.W.buildings.find((b) => b.type === 'forum' && b.built);
    if (!c) return;
    const m = spawnMob('legionary', c.x + rand(-6, 6), c.z + rand(-6, 6), { lvl: 4 + Math.floor(G.W.day / 3), src: { kind: 'garrison', onDeath: () => { G.W.garrison = Math.max(0, G.W.garrison - 1); log('Легионер гарнизона пал в бою.', 'bad'); G.dirtyWorld = true; } } });
    if (m && G.W.laws.night_watch) { m.hp *= 1.3; m.maxHp = m.hp; }
  }
}
