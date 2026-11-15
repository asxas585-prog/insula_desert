// Поход на города Сицилии: шпионаж, разграбление пригородов, караваны и торговые корабли снабжения,
// штурм при нулевой обороне; захваченный город переходит Риму в руинах (здания восстанавливают).
import { G, D, WG, now, dist, rand, randi, pick, nid, send, log, fx, chronicle, addGear } from './state.js';
import { spawnMob, grantXp, grantDig, dropItem, setUnitKillFn } from './combat.js';
import { spawnEnemyShip, storyCheck } from './society.js';

const T = D.CAMPAIGN.tasks;
const cityW = (id) => G.world.cities.find((c) => c.id === id);
const CS = (id) => G.W.cityState[id];
const RT = new Map(); // состояние в памяти: стража, караваны, корабли, штурм
const rt = (id) => { let r = RT.get(id); if (!r) { r = { guards: [], guardAt: 0, sub: {}, caravan: null, caravanAt: now() + rand(40, 90), fleet: null, fleetAt: now() + rand(60, 120), assault: null }; RT.set(id, r); } return r; };
const alive = (ids) => ids.filter((id) => { const m = G.mobs.get(id); return m && m.hp > 0 && !m.kneel; });
const nearPlayers = (x, z, r) => [...G.players.values()].filter((p) => p.char && !p.inst && Math.abs(p.x - x) < r && Math.abs(p.z - z) < r && Math.hypot(p.x - x, p.z - z) < r);
const lvlOf = (id) => D.CAMPAIGN.lvl[id] || 5;
// весть только тем, кто рядом с городом
const near = (C, text, kind = 'warn', r = 1300) => { for (const p of nearPlayers(C.x, C.z, r)) send(p, { type: 'log', text, kind }); };
const syr = (C) => C.owner === 'syr';
export const need = (C, k) => (k === 'fleet' && !C.harbor ? 0 : k === 'caravan' && !C.harbor ? T.caravan.n * 2 : T[k].n);
const troop = (C, role) => syr(C) ? { inf: 'syr_hoplite', rng: 'syr_archer', vet: 'syr_hoplite', boss: 'syr_strategos' }[role] : { inf: 'punic_inf', rng: 'punic_slinger', vet: 'punic_vet', boss: 'punic_officer' }[role];

// убит воин чужого города (стража, охрана усадеб и обозов): оборона −1
setUnitKillFn((cid, p) => {
  const st = CS(cid); if (!st || st.owner === 'rome' || st.def <= 0) return;
  const C = cityW(cid); st.def = Math.max(0, st.def - D.CAMPAIGN.killDef); G.dirtyWorld = true;
  if (p && p.char) send(p, { type: 'log', text: `⚔ ${C.name}: павший воин ослабил оборону — ${Math.round(st.def)}.`, kind: 'info' });
  if (st.def <= 0 && !st.readyLogged) { st.readyLogged = true; log(`⚔ Оборона ${C.name} сломлена! Можно начинать штурм: подойдите к воротам города (E).`, 'warn'); chronicle(`Оборона города ${C.name} сломлена`); }
});
function cut(C, k, by) {
  const st = CS(C.id); if (!st || st.owner === 'rome') return;
  st.tasks[k] = (st.tasks[k] || 0) + 1;
  const before = st.def; st.def = Math.max(0, st.def - (T[k].def || 0));
  const left = Math.max(0, need(C, k) - st.tasks[k]);
  log(`${T[k].icon} ${C.name}: «${T[k].name}» — оборона ${Math.round(before)} → ${Math.round(st.def)}${left ? ` (ещё ${left})` : ' (задача выполнена)'}${by ? ' · ' + by.char.name : ''}`, 'good');
  if (st.def <= 0 && !st.readyLogged) { st.readyLogged = true; log(`⚔ Оборона ${C.name} сломлена! Можно начинать штурм: подойдите к воротам города (E).`, 'warn'); chronicle(`Оборона города ${C.name} сломлена`); }
  for (const p of nearPlayers(C.x, C.z, C.R + 450)) { grantXp(p, 80 + lvlOf(C.id) * 15); grantDig(p, 4); }
  G.dirtyWorld = true;
}
const done = (C, k) => (CS(C.id).tasks[k] || 0) >= need(C, k);

// ---------- Шпионаж: 6 секунд на месте у тайника ----------
export function spy(p, poiId) {
  const q = G.world.pois.find((x) => x.id === poiId && x.type === 'spy_post'); if (!q || dist(p, q) > 5) return;
  const C = cityW(q.city), st = CS(q.city); if (!st || st.owner === 'rome') return;
  st.spied = st.spied || {};
  if (st.spied[q.id]) return send(p, { type: 'log', text: 'Отсюда город уже осмотрен.', kind: 'info' });
  if (done(C, 'spy')) return send(p, { type: 'log', text: 'Разведка этого города закончена.', kind: 'info' });
  for (const m of G.mobs.values()) if (m.hp > 0 && D.HOSTILE.has(m.faction) && !m.inst && dist(m, p) < 14 && m.target === p.id) return send(p, { type: 'log', text: '👁 Вас заметили! Сначала уйдите от погони.', kind: 'warn' });
  p.spyT = { poi: q.id, at: now() + 6, x: p.x, z: p.z };
  send(p, { type: 'channel', t: 6, text: '👁 Наблюдение за городом…' });
}
function spyTick(t) {
  for (const p of G.players.values()) {
    const s = p.spyT; if (!s) continue;
    if (!p.alive || Math.hypot(p.x - s.x, p.z - s.z) > 2.5) { p.spyT = null; send(p, { type: 'channel', t: 0 }); send(p, { type: 'log', text: 'Наблюдение прервано.', kind: 'warn' }); continue; }
    if (t < s.at) continue;
    p.spyT = null;
    const q = G.world.pois.find((x) => x.id === s.poi), C = cityW(q.city), st = CS(C.id);
    st.spied = st.spied || {}; if (st.spied[q.id]) continue;
    st.spied[q.id] = 1;
    const info = ['посты стражи у ворот', 'склады зерна у гавани', 'смену караулов на стенах', 'слабое место в кладке у ворот', 'где стоит военачальник'][randi(0, 4)];
    send(p, { type: 'log', text: `👁 Вы высмотрели ${info}.`, kind: 'good' });
    cut(C, 'spy', p);
  }
}
// ---------- Пригороды ----------
export function plunder(p, poiId) {
  const q = G.world.pois.find((x) => x.id === poiId && x.type === 'suburb_villa'); if (!q || dist(p, q) > 14) return;
  const C = cityW(q.city), st = CS(q.city); if (!st || st.owner === 'rome') return;
  st.burnt = st.burnt || {};
  if (st.burnt[q.id]) return;
  const r = rt(C.id).sub[q.id];
  if (r && alive(r.live).length) return send(p, { type: 'log', text: `Усадьбу ещё охраняют (${alive(r.live).length}).`, kind: 'warn' });
  st.burnt[q.id] = Date.now();
  // добыча: денарии сразу, товары и вещь из усадьбы, военные очки
  const lv = lvlOf(C.id), c = p.char, den = randi(80, 160) + lv * 12, mil = 15 + lv * 3;
  c.den += den; c.milPts = (c.milPts || 0) + mil;
  dropItem(q.x + 1.5, q.z, 'wheat', randi(6, 14)); dropItem(q.x - 1.5, q.z, pick(['wine', 'oil', 'olives']), randi(2, 5)); dropItem(q.x, q.z + 1.5, pick(['linen', 'leather', 'iron', 'amphora']), randi(2, 5));
  const gear = pick(lv >= 9 ? ['spatha', 'hamata', 'galea_iron', 'scutum', 'falcata'] : ['gladius', 'parma', 'galea_bronze', 'subarmalis', 'bow']);
  const got = addGear(c, gear, Math.random() < 0.25 ? 1 : 0);
  send(p, { type: 'log', text: `🔥 Усадьба разграблена: +${den} денариев, +${mil} военных очков${got ? `, ${D.GEAR[gear].name}` : ''}. Товары — на земле рядом.`, kind: 'good' });
  p.dirtyChar = true;
  fx({ kind: 'burn', x: q.x, z: q.z });
  cut(C, 'plunder', p);
}
// ---------- Стража, пригороды, караваны и корабли ----------
function guardsTick(C, t) {
  const R = rt(C.id), st = CS(C.id), lv = lvlOf(C.id);
  const near = nearPlayers(C.x, C.z, C.R + 220).length > 0;
  R.guards = alive(R.guards);
  if (!near) { if (R.guards.length && !nearPlayers(C.x, C.z, C.R + 400).length) { for (const id of R.guards) G.mobs.delete(id); R.guards = []; } }
  else if (!R.assault && R.guards.length < 4 + Math.floor(lv / 3) && t > R.guardAt) {
    R.guardAt = t + (R.guards.length < 2 ? 4 : 40);
    const g = pick(C.gates), a = g.a + rand(-0.15, 0.15), x = C.x + Math.sin(a) * (C.R - 10), z = C.z + Math.cos(a) * (C.R - 10);
    const m = spawnMob(troop(C, pick(['inf', 'inf', 'rng', 'vet'])), x, z, { lvl: lv + randi(0, 1), leash: 60, src: { kind: 'cityguard', city: C.id } });
    if (m) R.guards.push(m.id);
  }
  // пригородные усадьбы: охрана появляется, когда кто-то подходит
  st.burnt = st.burnt || {};
  for (const s of C.suburbs) {
    if (st.burnt[s.poi]) continue;
    const r = R.sub[s.poi] || (R.sub[s.poi] = { live: [], at: 0 });
    r.live = alive(r.live);
    const nr = nearPlayers(s.x, s.z, 130).length;
    if (!nr) { if (r.live.length && !nearPlayers(s.x, s.z, 300).length) { for (const id of r.live) G.mobs.delete(id); r.live = []; r.at = 0; } continue; }
    if (r.live.length || t < r.at) continue;
    r.at = t + 300;
    for (let i = 0; i < 3 + Math.floor(lv / 4); i++) { const a = i * 2.1; const m = spawnMob(troop(C, i === 0 ? 'vet' : i % 2 ? 'rng' : 'inf'), s.x + Math.cos(a) * 6, s.z + Math.sin(a) * 6, { lvl: lv, leash: 30, src: { kind: 'suburb', city: C.id } }); if (m) r.live.push(m.id); }
  }
}
function caravanTick(C, t) {
  const R = rt(C.id);
  if (R.caravan) {
    const w = G.mobs.get(R.caravan.wagon);
    if (!w || w.hp <= 0) { R.caravan = null; R.caravanAt = t + rand(100, 160); }
    else if (w.arrived) { for (const id of [R.caravan.wagon, ...R.caravan.escort]) G.mobs.delete(id); R.caravan = null; R.caravanAt = t + rand(90, 150); near(C, `🐂 Обоз снабжения прорвался в ${C.name}.`, 'info'); }
    return;
  }
  if (done(C, 'caravan') || t < R.caravanAt) return;
  if (!nearPlayers(C.x, C.z, C.R + 450).length) return;
  const roads = WG.roadsList().filter((r) => r.a === C.id || r.b === C.id); if (!roads.length) return;
  const rd = pick(roads); let pts = rd.pts.slice(); if (rd.a === C.id) pts.reverse(); // путь к городу
  const k0 = Math.floor(pts.length * rand(0.35, 0.55)); pts = pts.slice(k0);
  const [x, z] = pts[0], lv = lvlOf(C.id);
  const wagon = spawnMob('punic_wagon', x, z, { lvl: lv, leash: 9999, src: { kind: 'caravan', city: C.id, onDeath: () => { cut(C, 'caravan'); } } });
  if (!wagon) return;
  wagon.path = pts; wagon.pi = 1;
  const escort = [];
  for (let i = 0; i < 2 + Math.floor(lv / 4); i++) { const m = spawnMob(troop(C, i ? 'inf' : 'vet'), x + rand(-4, 4), z + rand(-4, 4), { lvl: lv, leash: 26, src: { kind: 'caravan', city: C.id } }); if (m) { m.follow = wagon.id; escort.push(m.id); } }
  R.caravan = { wagon: wagon.id, escort };
  near(C, `🐂 Разведчики: к ${C.name} идёт обоз снабжения под охраной — перехватите его на дороге.`);
}
function fleetTick(C, t) {
  const R = rt(C.id);
  if (!C.harbor) return;
  if (R.fleet) { if (!G.eships.has(R.fleet)) { R.fleet = null; R.fleetAt = t + rand(110, 170); } return; }
  if (done(C, 'fleet') || t < R.fleetAt) return;
  if (!nearPlayers(C.hx, C.hz, C.R + 500).length) return;
  const a = C.ry + rand(-0.5, 0.5);
  let sx = C.hx + Math.sin(a) * 520, sz = C.hz + Math.cos(a) * 520;
  for (let i = 0; i < 12 && !WG.shipOk(sx, sz); i++) { sx = C.hx + Math.sin(a + i * 0.3) * 560; sz = C.hz + Math.cos(a + i * 0.3) * 560; }
  if (!WG.shipOk(sx, sz)) { R.fleetAt = t + 60; return; }
  const dx = C.hx + Math.sin(C.ry) * 60, dz = C.hz + Math.cos(C.ry) * 60;
  const s = spawnEnemyShip('punic_merchant', sx, sz, { mode: 'trade', lvl: lvlOf(C.id), life: 700 });
  s.mode = 'trade'; s.dest = { x: dx, z: dz }; s.city = C.id; s.loot = randi(1, 3);
  R.fleet = s.id;
  near(C, `⛵ Дозорные: пунийское торговое судно идёт в гавань ${C.name}. Потопите его!`);
}
export function onEnemySunk(s) {
  if (s.city && s.type === 'punic_merchant') { const C = cityW(s.city); if (C && CS(C.id).owner !== 'rome') cut(C, 'fleet'); }
}
// повозка едет по дороге; охрана держится рядом
export function pathTick(m, dt) {
  const p = m.path[m.pi]; if (!p) { m.arrived = true; m.moving = 0; return; }
  const dx = p[0] - m.x, dz = p[1] - m.z, d = Math.hypot(dx, dz);
  if (d < 1.5) { m.pi++; return; }
  const sp = m.speed * (m.lastHit && now() - m.lastHit < 2 ? 0.4 : 1) * dt;
  m.x += dx / d * Math.min(sp, d); m.z += dz / d * Math.min(sp, d); m.ry = Math.atan2(dx, dz); m.moving = 1;
}
export function followTick(m) {
  const w = G.mobs.get(m.follow); if (!w || w.hp <= 0) { m.follow = null; return; }
  m.home = { x: w.x, z: w.z };
}
// ---------- Штурм ----------
export function assault(p, cityId) {
  const C = cityW(cityId), st = CS(cityId); if (!C || !st || st.owner === 'rome') return;
  if (Math.hypot(p.x - C.x, p.z - C.z) > C.R + 70) return send(p, { type: 'log', text: 'Подойдите к стенам города.', kind: 'warn' });
  if (st.def > 0) return send(p, { type: 'log', text: `Оборона ${C.name} ещё ${Math.round(st.def)} — сначала ослабьте город.`, kind: 'warn' });
  const R = rt(C.id); if (R.assault) return;
  for (const id of R.guards) G.mobs.delete(id); R.guards = [];
  const lv = lvlOf(C.id), nP = Math.max(1, nearPlayers(C.x, C.z, C.R + 300).length), n = Math.min(26, 8 + nP * 3 + Math.floor(lv / 2));
  const live = [], fo = C.layout[0];
  for (let i = 0; i < n; i++) { const a = rand(0, 6.28), d = rand(8, C.R * 0.7); const m = spawnMob(troop(C, pick(['inf', 'inf', 'rng', 'vet'])), fo.x + Math.sin(a) * d, fo.z + Math.cos(a) * d, { lvl: lv + randi(0, 1), leash: C.R + 40, hx: fo.x, hz: fo.z, src: { kind: 'assault', city: C.id } }); if (m) live.push(m.id); }
  const boss = spawnMob(troop(C, 'boss'), fo.x, fo.z, { lvl: lv + 2, leash: C.R, src: { kind: 'assault', city: C.id } });
  // у защитников — столько же отрядов, сколько у нападающих (каждый — своей группой у ворот)
  const atk = nearPlayers(C.x, C.z, C.R + 300).flatMap((q) => (q.char.squads || []).filter((x) => (x.live || []).some((id) => G.mobs.has(id))));
  atk.forEach((sq, k) => {
    const role = sq.type === 'arch' || sq.type === 'art' ? 'rng' : sq.type === 'cav' || sq.type === 'merc_h' ? 'vet' : 'inf', size = (sq.live || []).length || 4;
    const g = C.gates[k % (C.gates.length || 1)] || fo, gx = g.x - Math.sin(g.a || 0) * 14, gz = g.z - Math.cos(g.a || 0) * 14;
    for (let i = 0; i < size; i++) { const m = spawnMob(troop(C, role), gx + (i % 4 - 1.5) * 2.2, gz + Math.floor(i / 4) * 2.4, { lvl: lv + 1, leash: C.R + 40, hx: gx, hz: gz, src: { kind: 'assault', city: C.id } }); if (m) { m.grp = { id: `as${C.id}${k}` }; m.gname = `${C.name}: отряд ${k + 1}`; live.push(m.id); } }
  });
  if (atk.length) log(`🛡 Защитники ${C.name} выводят ${atk.length} отряд(а) навстречу вашим.`, 'bad');
  R.assault = { t0: now(), live, boss: boss && boss.id };
  log(`⚔ ШТУРМ ${C.name.toUpperCase()}! ${p.char.name} ведёт римлян на стены. Гарнизон: ${n} воинов и ${boss ? boss.def.name : 'военачальник'}.`, 'bad');
  chronicle(`Начался штурм города ${C.name}`);
  G.dirtyWorld = true;
}
function assaultTick(C, t) {
  const R = rt(C.id), A = R.assault; if (!A) return;
  A.live = alive(A.live);
  const bossAlive = A.boss && G.mobs.has(A.boss) && G.mobs.get(A.boss).hp > 0;
  if (!bossAlive && A.live.length <= 2) return capture(C);
  if (t - A.t0 > 900 || (!nearPlayers(C.x, C.z, C.R + 200).length && t - A.t0 > 60)) {
    for (const id of [...A.live, A.boss]) G.mobs.delete(id);
    R.assault = null; CS(C.id).def = Math.min(100, 20); CS(C.id).readyLogged = false;
    log(`🛡 Штурм ${C.name} отбит. Гарнизон укрепил оборону (20) — придётся ослабить город снова.`, 'bad');
    G.dirtyWorld = true;
  }
}
export function capture(C) {
  const R = rt(C.id), st = CS(C.id);
  if (R.assault) for (const id of R.assault.live) G.mobs.delete(id);
  R.assault = null; for (const id of R.guards) G.mobs.delete(id); R.guards = [];
  for (const r of Object.values(R.sub)) { for (const id of r.live) G.mobs.delete(id); r.live = []; }
  st.owner = 'rome'; st.captured = Date.now(); st.def = 0;
  let n = 0;
  for (const b of G.W.buildings) if (b.city === C.id && b.muni) { b.enemy = false; b.built = false; b.prog = {}; b.hp = 0; b.ruined = false; b.contrib = {}; n++; }
  const lv = lvlOf(C.id);
  for (const p of nearPlayers(C.x, C.z, C.R + 300)) { p.char.den += 150 + lv * 40; grantXp(p, 400 + lv * 80); grantDig(p, 30 + lv * 4); p.dirtyChar = true; }
  log(`🦅 ${C.name} взят! Город переходит под власть Рима. Здания лежат в руинах (${n}) — восстановите их всем миром.`, 'good');
  chronicle(`Рим взял город ${C.name}`);
  G.dirtyBld = true; G.dirtyWorld = true;
  storyCheck();
}
let acc = 0;
export function campaignTick(dt) {
  acc += dt; const t = now();
  spyTick(t);
  for (const m of G.mobs.values()) if (m.follow) followTick(m);
  if (acc < 1) return; acc = 0;
  for (const C of G.world.cities) {
    const st = CS(C.id); if (!st || st.owner === 'rome') continue;
    guardsTick(C, t); caravanTick(C, t); fleetTick(C, t); assaultTick(C, t);
  }
}
// для окна города и карты
export function cityInfo() {
  const out = {};
  for (const C of G.world.cities) { const st = CS(C.id); if (!st) continue; const R = RT.get(C.id); out[C.id] = { owner: st.owner, def: Math.round(st.def), tasks: st.tasks, spied: st.spied || {}, burnt: st.burnt || {}, assault: !!(R && R.assault), captured: st.captured, need: Object.fromEntries(['spy', 'plunder', 'caravan', 'fleet'].map((k) => [k, need(C, k)])) }; }
  return out;
}
