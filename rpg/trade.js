import { availableResources, payResources } from './logistics.js';
import { tradeStep } from './tutorial.js';
import { encounterLevel } from './balance.js';
import { shipCargoAllowed, cargoAccess, cityOf } from './access.js';
// Торговля ящиками, торговцы, причалы, пираты и морской бой (абордаж, лучники на борту, катапульта), свои корабли
import { G, D, WG, now, dist, rand, randi, pick, nid, angDiff, send, broadcast, log, fx, chronicle, takeRes, shipLimitOf, hasAll, payAll, derivedOf, rankOf, lawsAt } from './state.js';
import { grantXp, grantDig, shoot, damagePlayer, spawnMob } from './combat.js';
import { riders, builtOf, leaveShip, board as boardShip } from './economy.js';
import { spawnEnemyShip, storyCheck } from './society.js';
const { SHIPS, CRATES, BUILDINGS, SHIP_UP, ENEMY_SHIPS } = D;
const say = (p, text, kind = 'info') => send(p, { type: 'log', text, kind });
const crateCap = (s) => Math.round((SHIPS[s.type]?.crates || 0));
const shipById = (id) => G.W.ships.find((s) => s.id === id);
export const MAX_SHIPS = 3;

// ---------- Причалы: гавань — 4 места (два причала, по кораблю с каждой стороны); торговец — 2 места ----------
const BEAM = { scapha: 1.6, barca: 2, corbita: 4.6, liburna: 3.2, trireme: 4.2, quadrireme: 5, penteres: 5.4 };
function local(o, lx, lz) { const c = Math.cos(o.ry || 0), s = Math.sin(o.ry || 0); return { x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c }; }
export function berths(type) { // места вдоль каждого мостика гавани (с обеих сторон, несколько кораблей подряд), у набережной и у торговцев
  const L = SHIPS[type].len, B = BEAM[type] || 3, list = [];
  for (const b of builtOf('portus')) {
    for (const px of WG.PORTUS_PIERS) for (const sd of [-1, 1]) for (let k = 0, z0 = 4; z0 + L <= WG.PORTUS_LEN + L * 0.15 || k === 0; k++, z0 += L + 1.5) {
      const zc = Math.min(z0 + L / 2, WG.PORTUS_LEN - L * 0.35), p = local(b, px + sd * (2.0 + B / 2), zc), dk = local(b, px, zc);
      list.push({ key: `b${b.id}:${px}:${sd}:${k}`, x: p.x, z: p.z, ry: b.ry || 0, port: b.id, deck: dk });
      if (zc < z0 + L / 2) break;
    }
    if (L <= 12) for (const qx of [-13, 13, -33, 33]) { const p = local(b, qx, 2.5 + B / 2 + 0.6), dk = local(b, qx, 0); list.push({ key: `b${b.id}:q${qx}`, x: p.x, z: p.z, ry: (b.ry || 0) + Math.PI / 2, port: b.id, deck: dk }); } // лодки — вдоль набережной
  }
  for (const t of G.world.traders || []) for (const sd of [-1, 1]) { const p = local(t, sd * (1.8 + B / 2), 9 + L * 0.25), dk = local(t, 0, 9 + L * 0.25); list.push({ key: `t${t.id}:${sd}`, x: p.x, z: p.z, ry: t.ry, trader: t.id, deck: dk }); }
  return list;
}
export const berthByKey = (type, key) => key && berths(type).find((b) => b.key === key);
export function freeBerth(type, near, maxD = 40, port = null) {
  const used = new Set(G.W.ships.filter((s) => s.berth).map((s) => s.berth));
  let best = null, bd = maxD;
  for (const b of berths(type)) { if (used.has(b.key) || (port && b.port !== port)) continue; if (!WG.shipOk(b.x, b.z)) continue; const d = near ? Math.hypot(b.x - near.x, b.z - near.z) : 0; if (d < bd) { bd = d; best = b; } }
  return best;
}
function moorTick() {
  for (const s of G.W.ships) {
    const rs = riders(s), helm = rs.find((q) => q.seat === 0);
    if (s.berth && helm && Math.abs(s.speed) > 0.8) s.berth = null;
    if (s.berth && helm && Math.abs(helm.helmIn?.f || 0) > 0.1) s.berth = null;
    if (s.berth || helm || Math.abs(s.speed) > 0.5) continue;
    const b = freeBerth(s.type, s, 35); if (!b) continue;
    s.x = b.x; s.z = b.z; s.ry = b.ry; s.speed = 0; s.berth = b.key; G.dirtyWorld = true;
    for (const q of rs) say(q, '⚓ Корабль пришвартован у причала.');
  }
}

// продажа и дар кораблей: Риму (в римской гавани) или другим гражданам
export function shipTrade(p, m) {
  const c = p.char;
  if (m.type === 'shipScrap') { const i = (c.sunk || []).findIndex(s => s.id === m.sid); if (i < 0) return; c.sunk.splice(i, 1); p.dirtyChar = true; return; }
  const s = shipById(m.sid); if (!s) return;
  const value = Object.entries(SHIPS[s.type].cost).reduce((a, [k, n]) => a + (D.RES[k] ? D.RES[k].p * n : 0), 0);
  if (['shipBuy','shipForSale','shipRome'].includes(m.type) && (s.route || (G.W.routes || []).some(r => r.on && r.ships.includes(s.id)))) return say(p, 'Сначала остановите торговый путь корабля.', 'warn');
  if (m.type === 'shipBuy') {
    if (!s.forSale || s.owner === c.id) return; if (dist(p, s) > SHIPS[s.type].len / 2 + 12) return say(p, 'Подойдите к кораблю.', 'warn');
    if (G.W.ships.filter((x) => x.owner === c.id).length >= shipLimitOf(c)) return say(p, 'У вас уже предел кораблей.', 'warn');
    if (c.den < s.forSale) return say(p, `Нужно ${s.forSale} денариев.`, 'warn');
    const seller = G.chars[s.owner]; c.den -= s.forSale; if (seller) seller.den += s.forSale;
    for (const q of G.players.values()) if (q.char && q.char.id === s.owner) { say(q, `⚖ ${c.name} купил(а) ваш корабль «${s.name}» за ${s.forSale} ден.`, 'good'); q.dirtyChar = true; }
    for (const r of G.W.routes || []) r.ships = r.ships.filter(id => id !== s.id);
    s.owner = c.id; s.ownerName = c.name; s.forSale = 0; s.route = null; for (const sl of G.W.slaves) if (sl.ship === s.id) sl.ship = null;
    say(p, `⚓ Корабль «${s.name}» теперь ваш.`, 'good'); p.dirtyChar = true; G.dirtyWorld = true; return;
  }
  if (s.owner !== c.id) return;
  if (m.type === 'shipForSale') { s.forSale = Math.max(0, Math.min(1e6, m.price | 0)); say(p, s.forSale ? `Корабль выставлен на продажу за ${s.forSale} ден. Покупатель подходит к нему и открывает окно корабля (G).` : 'Продажа снята.'); G.dirtyWorld = true; return; }
  if (m.type === 'shipRome') {
    const port = builtOf('portus').find((b) => dist(b, s) < 90 && dist(p, b) < 90); if (!port) return say(p, 'Передать корабль Риму можно в римской гавани (корабль у причала).', 'warn');
    if ([...G.players.values()].some((q) => q.ship === s.id)) return say(p, 'Сначала все должны сойти на берег.', 'warn');
    if ((s.crates || []).length || Object.values(s.cargo || {}).some(n => n > 0)) return say(p, 'Сначала разгрузите корабль.', 'warn');
    for (const r of G.W.routes || []) r.ships = r.ships.filter(id => id !== s.id);
    G.W.ships = G.W.ships.filter((x) => x !== s); for (const sl of G.W.slaves) if (sl.ship === s.id) sl.ship = null;
    if (m.gift) { grantDig(p, Math.round(value / 6)); log(`🦅 ${c.name} безвозмездно передал(а) Республике корабль «${s.name}». Рим благодарит!`, 'good'); }
    else { const pay = Math.round(value * 0.55); c.den += pay; say(p, `⚖ Рим купил «${s.name}» за ${pay} ден.`, 'good'); }
    p.dirtyChar = true; G.dirtyWorld = true;
  }
}
// швартовка вручную (G у руля): ближайшее свободное место у причала гавани или торговца в 60 м; повторно — отдать швартовы
export function moor(p) {
  const s = p.ship && shipById(p.ship); if (!s) return;
  if (p.seat !== 0) return say(p, 'Швартует корабль тот, кто у руля.', 'warn');
  if (s.berth) { s.berth = null; s.speed = 0; s.unmoorT = now(); G.dirtyWorld = true; return say(p, '⚓ Швартовы отданы — можно отходить.'); }
  const b = freeBerth(s.type, s, 110);
  if (!b) { const any = freeBerth(s.type, s, 1e6); return say(p, any ? `Свободное место у причала — в ${Math.round(Math.hypot(any.x - s.x, any.z - s.z))} м: подойдите к гавани ближе (до 110 м).` : 'Свободных мест у причалов нет: все заняты или гаваней поблизости нет.', 'warn'); }
  s.x = b.x; s.z = b.z; s.ry = b.ry; s.speed = 0; s.berth = b.key; G.dirtyWorld = true;
  leaveShip(p); // сразу сходим на мостик у борта
  say(p, '⚓ Корабль пришвартован вдоль причала, вы сошли на мостик. E у борта — подняться, G — трюм и груз.', 'good');
}
// ---------- Ящики ----------
const nearGuild = (p) => builtOf('collegium').find((b) => dist(p, b) < BUILDINGS.collegium.r + 8);
export function crateMsg(p, m) {
  const c = p.char; c.guildCrates = c.guildCrates || {};
  const t = m.type;
  if (t === 'crateCraft') {
    const g = nearGuild(p), def = CRATES[m.k]; if (!g || !def) return say(p, 'Ящики собирают в Торговой гильдии.', 'warn');
    if ((def.lvl || 0) > c.level) return say(p, `Нужен ${def.lvl} уровень.`, 'warn');
    if (!hasAll(c, def.in)) return say(p, 'Не хватает товаров: ' + Object.entries(def.in).map(([k, n]) => `${D.RES[k].name} ×${n}`).join(', '), 'warn');
    payAll(c, def.in); tradeStep(p, 1);
    if (!c.carry) { c.carry = m.k; say(p, `📦 ${def.name} собран — он у вас в руках.`, 'good'); }
    else { c.guildCrates[m.k] = (c.guildCrates[m.k] || 0) + 1; say(p, `📦 ${def.name} собран и оставлен на складе гильдии (руки заняты).`, 'good'); }
    grantXp(p, 6 * def.grade); tradeStep(p, 2);
  } else if (t === 'crateTake') {
    if (!nearGuild(p) || c.carry || !(c.guildCrates[m.k] > 0)) return;
    c.guildCrates[m.k]--; c.carry = m.k;
  } else if (t === 'crateStore') {
    if (!nearGuild(p) || !c.carry) return;
    c.guildCrates[c.carry] = (c.guildCrates[c.carry] || 0) + 1; c.carry = null;
  } else if (t === 'crateDrop') {
    if (!c.carry) return;
    if (p.ship) return say(p, 'Чтобы поставить ящик в трюм: G — окно корабля.', 'info');
    const id = nid(); G.crates.set(id, { id, k: c.carry, x: p.x + Math.sin(p.ry) * 1.2, z: p.z + Math.cos(p.ry) * 1.2, ground: WG.terrainHeight(p.x, p.z) > -0.7, until: now() + 1800 });
    c.carry = null;
  } else if (t === 'cratePick') {
    const cr = G.crates.get(m.id); if (!cr) return;
    if (p.ship) { // с корабля — в трюм
      const s = shipById(p.ship); if (!s || !shipCargoAllowed(p, s) || Math.hypot(s.x - cr.x, s.z - cr.z) > SHIPS[s.type].len / 2 + 9) return say(p, 'Подплывите ближе к ящику.', 'warn');
      s.crates = s.crates || []; if (s.crates.length >= crateCap(s)) return say(p, 'На корабле нет места для ящиков.', 'warn');
      s.crates.push(cr.k); G.crates.delete(cr.id); G.dirtyWorld = true; say(p, `📦 ${CRATES[cr.k].name} поднят на борт.`, 'good');
    } else {
      if (dist(p, cr) > 3) return; if (c.carry) return say(p, 'Руки заняты: сначала поставьте свой ящик.', 'warn');
      if (!cr.ground) return say(p, 'Ящик в воде — его можно поднять только с корабля.', 'warn');
      c.carry = cr.k; G.crates.delete(cr.id);
    }
  } else if (t === 'crateLoad') {
    const s = shipById(m.sid); if (!s || !c.carry || !shipCargoAllowed(p, s)) return;
    if (dist(p, s) > SHIPS[s.type].len / 2 + 7 && p.ship !== s.id) return say(p, 'Подойдите к кораблю.', 'warn');
    s.crates = s.crates || []; if (s.crates.length >= crateCap(s)) return say(p, `В ${SHIPS[s.type].name} помещается ящиков: ${crateCap(s)}.`, 'warn');
    s.crates.push(c.carry); c.carry = null; tradeStep(p, 3); G.dirtyWorld = true; say(p, '📦 Ящик погружен на корабль.');
  } else if (t === 'crateUnload') {
    const s = shipById(m.sid); if (!s || !shipCargoAllowed(p, s) || c.carry || !s.crates || !s.crates[m.i | 0]) return;
    if (dist(p, s) > SHIPS[s.type].len / 2 + 7 && p.ship !== s.id) return say(p, 'Подойдите к кораблю.', 'warn');
    c.carry = s.crates.splice(m.i | 0, 1)[0]; G.dirtyWorld = true;
  } else if (t === 'crateSell') return sellCrate(p, m);
  p.dirtyChar = true;
}
export const tradersNear = (p, r = 14) => (G.world.traders || []).filter((tr) => Math.hypot(tr.x - p.x, tr.z - p.z) < r);
export function cratePrice(p, tr, k) { const d = CRATES[k]; return Math.round(d.price * tr.mult * derivedOf(p.char).sell * (1 + (lawsAt(p).open_port ? 0.05 : 0))); }
function sellCrate(p, m) {
  const c = p.char, tr = (G.world.traders || []).find((x) => x.id === m.tid); if (!tr) return;
  let k = null;
  if (m.sid != null) { // из трюма корабля, стоящего у торговца
    const s = shipById(m.sid); if (!s || !s.crates || !s.crates[m.i | 0]) return;
    const lim = tr.rome ? 170 : 50; if (Math.hypot(s.x - tr.x, s.z - tr.z) > lim || Math.hypot(p.x - tr.x, p.z - tr.z) > lim) return say(p, 'Подведите корабль к причалу торговца.', 'warn');
    if (!cargoAccess(p,s)) return say(p, 'Это чужой груз.', 'warn');
    k = s.crates.splice(m.i | 0, 1)[0]; G.dirtyWorld = true;
  } else {
    if (!c.carry) return say(p, 'Торговец берёт только товары в ящиках — принесите ящик или подведите корабль.', 'warn');
    if (Math.hypot(p.x - tr.x, p.z - tr.z) > 14) return;
    k = c.carry; c.carry = null;
  }
  const price = cratePrice(p, tr, k);
  c.den += price; c.stats2.traded += price; tradeStep(p, 4); tradeStep(p, 5);
  if (tr.rome) { G.W.romeSent = G.W.romeSent || {}; G.W.romeSent[k] = (G.W.romeSent[k] || 0) + 1; storyCheck(); G.dirtyWorld = true; }
  grantXp(p, 10 * CRATES[k].grade); grantDig(p, CRATES[k].grade);
  say(p, `⚖ ${tr.name} купил «${CRATES[k].name}» за ${price} денариев.`, 'good');
  p.dirtyChar = true;
}

// ---------- Свои корабли: ремонт, улучшения, лучники-рабы ----------
export function shipUpMax(s) { const u = s.up || {}; return Math.round(SHIPS[s.type].hp * (1 + 0.25 * (u.hull || 0))); }
export function shipMsg(p, m) {
  const c = p.char;
  if (m.type === 'shipRepair') {
    const s = shipById(m.sid);
    if (s) { // ремонт на плаву — в гавани
      if (s.owner !== c.id) return;
      const port = builtOf('portus').find((b) => dist(b, s) < 60 && dist(p,b)<40); if (!port) return say(p, 'Корабль чинят у Гавани.', 'warn');
      const miss = s.maxHp - s.hp; if (miss <= 1) return say(p, 'Корабль цел.');
      const cost = { plank: Math.ceil(miss / 25), linen: Math.ceil(miss / 120) };
      if (!Object.entries(cost).every(([k,n])=>(availableResources(c,port)[k]||0)>=n)) return say(p, `Нужно: доски ×${cost.plank}, лён ×${cost.linen}`, 'warn');
      if(!payResources(c,port,cost)) return; s.hp = s.maxHp; G.dirtyWorld = true; say(p, '🔧 Корабль отремонтирован.', 'good');
    } else { // поднять затонувший — заново в гавани
      const i = (c.sunk || []).findIndex((x) => x.id === m.sid); if (i < 0) return;
      const sk = c.sunk[i], def = SHIPS[sk.type];
      const port = builtOf('portus').find((b) => dist(p, b) < 40); if (!port) return say(p, 'Затонувший корабль восстанавливают на Верфи в Гавани — подойдите к ней.', 'warn');
      const cost = Object.fromEntries(Object.entries(def.cost).map(([k, n]) => [k, Math.ceil(n * 0.4)]));
      if (!Object.entries(cost).every(([k,n])=>(availableResources(c,port)[k]||0)>=n)) return say(p, 'Нужно (40% постройки): ' + Object.entries(cost).map(([k, n]) => `${D.RES[k].name} ×${n}`).join(', '), 'warn');
      if (G.W.ships.filter(x => x.owner === c.id).length >= shipLimitOf(c)) return say(p, 'Нет места в активном флоте.', 'warn');
      const b = freeBerth(sk.type, port, 200, port.id); if (!b) return say(p, 'У гавани нет свободного причала (4 места).', 'warn');
      if(!payResources(c,port,cost)) return; c.sunk.splice(i, 1);
      const s2 = { id: nid(), type: sk.type, owner: c.id, ownerName: c.name, name: sk.name, x: b.x, z: b.z, ry: b.ry, berth: b.key, hp: 0, maxHp: 0, cargo: {}, speed: 0, up: sk.up || {}, crates: [] };
      s2.maxHp = shipUpMax(s2); s2.hp = s2.maxHp; G.W.ships.push(s2); G.dirtyWorld = true;
      say(p, `⚓ ${sk.name} снова на плаву!`, 'good');
    }
  } else if (m.type === 'shipUp') {
    const s = shipById(m.sid), U = SHIP_UP[m.k]; if (!s || s.owner !== c.id || !U) return;
    if (m.k === 'ram' && !SHIPS[s.type].ram) return;
    const port=builtOf('portus').find(b=>dist(b,s)<60&&dist(p,b)<40); if(!port) return say(p, 'Улучшают корабли в Гавани.', 'warn');
    s.up = s.up || {}; const lv = (s.up[m.k] || 0) + 1; if (lv > U.max) return;
    const cost = U.cost(lv); if (!Object.entries(cost).every(([k,n])=>(availableResources(c,port)[k]||0)>=n)) return say(p, 'Нужно: ' + Object.entries(cost).map(([k, n]) => `${D.RES[k].name} ×${n}`).join(', '), 'warn');
    if(!payResources(c,port,cost)) return; s.up[m.k] = lv; const old = s.maxHp; s.maxHp = shipUpMax(s); s.hp += s.maxHp - old; G.dirtyWorld = true;
    say(p, `🔨 ${s.name}: ${U.name} — ступень ${lv}.`, 'good');
  } else if (m.type === 'shipArcher') {
    const s = shipById(m.sid), sl = G.W.slaves.find((x) => x.id === m.slave); if (!s || !sl || s.owner !== c.id || sl.owner !== c.id) return;
    if (m.on) {
      if (sl.squad) return say(p, 'Сначала распустите отряд работника.', 'warn');
      const n = G.W.slaves.filter((x) => x.ship === s.id).length; if (n >= SHIPS[s.type].archers) return say(p, `Мест для лучников: ${SHIPS[s.type].archers}.`, 'warn');
      sl.ship = s.id; sl.bld = null; sl.ludus = null; say(p, `🏹 ${sl.name} — лучник на «${s.name}».`, 'good');
    } else { sl.ship = null; }
    G.dirtyWorld = true;
  } else if (m.type === 'catapult') return catapult(p, m);
  p.dirtyChar = true;
}
// корабль утонул: ящики всплывают, корабль уходит в список «затонувших» хозяина (его можно поднять)
export function onShipSunk(s) {
  for (const k of s.crates || []) { const id = nid(); G.crates.set(id, { id, k, x: s.x + rand(-6, 6), z: s.z + rand(-6, 6), ground: false, until: now() + 900 }); }
  for (const sl of G.W.slaves) if (sl.ship === s.id) sl.ship = null;
  const own = s.owner && G.chars[s.owner];
  if (own) { own.sunk = own.sunk || []; own.sunk.push({ id: s.id, type: s.type, name: s.name, up: s.up || {} }); }
}
// ---------- Катапульта квадриремы ----------
function catapult(p, m) {
  const s = shipById(p.ship); if (!s || !SHIPS[s.type].catapult) return;
  const t = now(); if (t < (s.catAt || 0)) return say(p, `Катапульта заряжается: ${Math.ceil(s.catAt - t)} с.`, 'warn');
  s.catAt = t + 5;
  const sx = s.x - Math.sin(s.ry) * SHIPS[s.type].len * 0.38, sz = s.z - Math.cos(s.ry) * SHIPS[s.type].len * 0.38;
  let target = null;
  if (Array.isArray(m.aim)) { const ax = Number(m.aim[0]), az = Number(m.aim[2]); if (isFinite(ax) && isFinite(az) && Math.hypot(ax - sx, az - sz) < 160) { target = { x: ax, z: az, y: 0 }; let bd = 12; for (const e of G.eships.values()) { const d = Math.hypot(e.x - ax, e.z - az); if (d < bd) { bd = d; target = e; } } } }
  if (!target) { let bd = 140; for (const e of G.eships.values()) { const d = Math.hypot(e.x - sx, e.z - sz); if (d < bd) { bd = d; target = e; } } }
  if (!target) return say(p, 'Цели для катапульты нет.', 'warn');
  shoot({ x: sx, z: sz, y: 4, kind: 'boulder', owner: p.id, side: 'player', dmg: 170, target, delay: 0.35 });
  fx({ kind: 'catapult', sid: s.id, x: sx, z: sz });
}

// ---------- Пираты охотятся за кораблями с грузом; абордаж; лучники-рабы ----------
let pirateCheckAt = 0;
function pirateTick(t) {
  if (t < pirateCheckAt) return; pirateCheckAt = t + 60;
  if ((G.W.pirateCalm || 0) > Date.now() / 1000) return; // логово разгромлено — пиратов нет
  for (const s of G.W.ships) {
    if (!s.crates || !s.crates.length || s.berth || (s.pirateAt || 0) > t) continue;
    if (WG.islandAt(s.x, s.z)?.id === 'main' && WG.terrainHeight(s.x, s.z) > -8) continue; // у берега главного острова спокойно
    if ([...G.eships.values()].some((e) => e.type === 'pirate_ship' && e.prey === s.id)) continue;
    if (Math.random() > 0.18 + s.crates.length * 0.04) continue;
    const a = rand(0, 6.28); let x = s.x + Math.cos(a) * 230, z = s.z + Math.sin(a) * 230;
    if (!WG.shipOk(x, z)) continue;
    const e = spawnEnemyShip('pirate_ship', x, z, { mode: 'hunt', lvl: encounterLevel(1), life: 900 });
    e.prey = s.id; e.loot = randi(1, 3); s.pirateAt = t + 420;
    for (const q of riders(s)) say(q, '🏴 На горизонте пираты — они идут за вашим грузом! Тараньте, стреляйте или берите на абордаж.', 'bad');
    log(`🏴 Пиратский корабль погнался за «${s.name}» с грузом!`, 'bad');
  }
}
export const crewMax = (e) => Math.round((ENEMY_SHIPS[e.type].crew || []).length * 55 * (1 + (e.lvl || 1) * 0.08));
function boardingTick(t, dt) {
  for (const e of G.eships.values()) {
    if (e.crew == null) e.crew = crewMax(e);
    // пираты цепляются к кораблю с грузом и идут на абордаж
    const prey = e.prey && shipById(e.prey);
    if (prey) {
      const d = Math.hypot(prey.x - e.x, prey.z - e.z);
      if (d < (SHIPS[prey.type].len + ENEMY_SHIPS[e.type].len) / 2 + 3) {
        e.grapple = (e.grapple || 0) + dt;
        if (e.grapple > 4 && e.crew > 0 && t > (e.boardHitAt || 0)) {
          e.boardHitAt = t + 2;
          const rs = riders(prey).filter((q) => q.alive);
          if (rs.length) damagePlayer(pick(rs), 8 + (e.lvl || 1) * 1.5, { id: -e.id, x: e.x, z: e.z, faction: 'pirate' });
          else if (prey.crates && prey.crates.length && t > (e.stealAt || 0)) { e.stealAt = t + 8; prey.crates.pop(); e.loot = (e.loot || 0) + 1; G.dirtyWorld = true; }
          if (!(prey.crates || []).length && !rs.length) { e.prey = null; e.mode = 'flee'; e.until = t + 60; }
        }
      } else e.grapple = 0;
    }
  }
}
// ---------- Абордаж: враг потрёпан (меньше 50% прочности) — корабли сцепляются широким мостиком, бой идёт на палубах ----------
const DECK_Y = { scapha: 0.55, barca: 0.8, corbita: 1.6, liburna: 1.4, trireme: 1.8, quadrireme: 2.1, penteres: 2.3, pirate_ship: 1.4, punic_merchant: 1.6, punic_ship: 2.2 };
const EBEAM = { pirate_ship: 3.4, punic_merchant: 4.4, punic_ship: 5.4 };
const boards = () => (G.boards = G.boards || new Map());
const syncDecks = () => WG.setBoardDecks([...boards().values()].flatMap((B) => B.decks));
export const boardDecks = () => [...boards().values()].flatMap((B) => B.decks.map((d) => ({ ...d, x: Math.round(d.x * 10) / 10, z: Math.round(d.z * 10) / 10, ry: Math.round(d.ry * 100) / 100 })));
export function boardStart(p) {
  const s = p.ship && shipById(p.ship); if (!s) return;
  if ([...boards().values()].some((B) => B.sid === s.id)) return say(p, 'Абордаж уже идёт.', 'warn');
  const L1 = SHIPS[s.type].len; let e = null, bd = 1e9;
  for (const q of G.eships.values()) { const d = Math.hypot(q.x - s.x, q.z - s.z) - (L1 + ENEMY_SHIPS[q.type].len) / 2; if (d < 22 && d < bd && !q.boarded) { bd = d; e = q; } }
  if (!e) return say(p, 'Для абордажа подойдите к вражескому кораблю вплотную.', 'warn');
  if (e.hp > e.maxHp * 0.5) return say(p, `Абордаж возможен, когда у врага меньше половины прочности (сейчас ${Math.round(e.hp / e.maxHp * 100)}%). Тараньте и обстреливайте его.`, 'warn');
  const B1 = BEAM[s.type] || 3, B2 = EBEAM[e.type] || 4, gap = 3.6, L2 = ENEMY_SHIPS[e.type].len;
  const cx = Math.cos(s.ry), sz = -Math.sin(s.ry), side = ((e.x - s.x) * cx + (e.z - s.z) * sz) >= 0 ? 1 : -1, off = B1 / 2 + B2 / 2 + gap;
  e.x = s.x + cx * off * side; e.z = s.z + sz * off * side; e.ry = s.ry; e.speed = 0;
  const y1 = DECK_Y[s.type] || 1.4, y2 = DECK_Y[e.type] || 1.6, id = nid();
  const decks = [{ x: s.x, z: s.z, ry: s.ry, hw: B1 / 2, hl: L1 * 0.42, y: y1 }, { x: e.x, z: e.z, ry: s.ry, hw: B2 / 2, hl: L2 * 0.42, y: y2 },
    { x: s.x + cx * side * (B1 / 2 + gap / 2), z: s.z + sz * side * (B1 / 2 + gap / 2), ry: s.ry, hw: gap / 2 + 0.9, hl: 2.4, y: (y1 + y2) / 2, plank: true }];
  const B = { id, sid: s.id, eid: e.id, decks, enemy: [], mine: [], until: now() + 300, by: p.id };
  boards().set(id, B); s.boardLock = id; e.boarded = id; syncDecks();
  // вся команда врага выходит на палубу
  const types = ENEMY_SHIPS[e.type].crew || ['pirate'], n = Math.max(2, Math.min(4, Math.round(types.length * Math.max(0.3, (e.crew ?? crewMax(e)) / crewMax(e))))); // команда на абордаже — 2–4 бойца
  for (let i = 0; i < n; i++) { const lx = (Math.random() - 0.5) * B2 * 0.7, lz = (Math.random() - 0.5) * L2 * 0.7, x = e.x + lx * cx + lz * Math.sin(s.ry), z = e.z + lx * sz + lz * Math.cos(s.ry); const m = spawnMob(types[i % types.length], x, z, { lvl: e.lvl || 4, leash: 40, src: { kind: 'board', board: id } }); if (m) { m.board = id; B.enemy.push(m.id); } }
  // все на нашем корабле встают на палубу; рабы-лучники тоже вступают в бой
  for (const q of riders(s)) { q.ship = null; q.seat = null; const lz = (Math.random() - 0.5) * L1 * 0.5; q.x = s.x + lz * Math.sin(s.ry); q.z = s.z + lz * Math.cos(s.ry); send(q, { type: 'teleport', x: q.x, z: q.z, left: true }); say(q, '⚔ АБОРДАЖ! Мостик перекинут — бегите на палубу врага и перебейте всю команду. Ваши отряды и рабы-лучники сражаются с вами.', 'bad'); }
  for (const a of G.W.slaves.filter((x) => x.ship === s.id)) { const lz = (Math.random() - 0.5) * L1 * 0.6, m = spawnMob('rom_arch', s.x + lz * Math.sin(s.ry) - cx * side * B1 * 0.25, s.z + lz * Math.cos(s.ry) - sz * side * B1 * 0.25, { lvl: 3 + (a.grade || 1) * 2, leash: 30, src: { kind: 'board', board: id } }); if (m) { m.dmg = D.SLAVE_GRADES[a.grade || 1].arch * ((D.SLAVE_TRAITS[a.trait] || {}).arch || 1); m.board = id; B.mine.push(m.id); } }
  log(`⚔ ${p.char.name} берёт на абордаж «${ENEMY_SHIPS[e.type].name}»!`, 'warn');
  G.dirtyWorld = true;
}
function boardEnd(B, win) {
  const s = shipById(B.sid), e = G.eships.get(B.eid), p0 = G.players.get(B.by);
  for (const id of [...B.enemy, ...B.mine]) G.mobs.delete(id);
  boards().delete(B.id); syncDecks();
  if (s) { s.boardLock = null; for (const q of G.players.values()) if (q.alive && !q.ship && Math.hypot(q.x - s.x, q.z - s.z) < 30 && WG.terrainHeight(q.x, q.z) < -0.5) boardShip(q, s.id); } // все обратно на свой корабль
  if (e) { e.boarded = null; if (win) { if (p0) { grantXp(p0, 160); grantDig(p0, 14); } log(`⚔ Абордаж удался: «${ENEMY_SHIPS[e.type].name}» захвачен!`, 'good'); hitEnemyShipHook(e, 99999, p0 || null); } else e.crew = Math.max(1, Math.round((e.crew ?? crewMax(e)) * 0.6)); }
  if (!win && p0) say(p0, '⚔ Абордаж отбит — корабли расцепились.', 'warn');
  G.dirtyWorld = true;
}
function boardTick() {
  for (const B of [...boards().values()]) {
    const s = shipById(B.sid), e = G.eships.get(B.eid);
    if (!s || !e) { boardEnd(B, false); continue; }
    const foes = B.enemy.filter((id) => { const m = G.mobs.get(id); return m && m.hp > 0; });
    if (!foes.length) { boardEnd(B, true); continue; }
    const ours = [...G.players.values()].some((q) => q.alive && Math.hypot(q.x - s.x, q.z - s.z) < 40);
    if (!ours || now() > B.until) boardEnd(B, false);
  }
}
// удар ближнего боя с палубы по вражеской команде (абордаж)
export function boardStrike(p, dmg) {
  let best = null, bd = 16;
  for (const e of G.eships.values()) { const d = Math.hypot(e.x - p.x, e.z - p.z) - ENEMY_SHIPS[e.type].len / 2; if (d < bd) { bd = d; best = e; } }
  if (!best) return false;
  if (best.crew == null) best.crew = crewMax(best);
  best.crew -= dmg; fx({ kind: 'board', x: best.x, z: best.z, n: Math.round(dmg) });
  if (best.crew <= 0) {
    log(`⚔ ${p.char.name} взял(а) на абордаж «${ENEMY_SHIPS[best.type].name}»!`, 'good');
    grantXp(p, 120); grantDig(p, 12);
    hitEnemyShipHook(best, 99999, p);
  }
  return true;
}
let hitEnemyShipHook = () => {};
export function setTradeHooks(h) { hitEnemyShipHook = h.hitEnemyShip; }
// потоплен/захвачен вражеский корабль: ящики всплывают, лоскут чертежа квадриремы — тому, кто потопил
let treasureFn = () => {}; export function setTreasureFn(f) { treasureFn = f; }
export function onEnemySunk(e, p) {
  if (p && p.char && e.type === 'pirate_ship' && Math.random() < 0.45) treasureFn(p, 'Пиратский корабль потоплен');
  if (p && p.char) p.char.milPts = (p.char.milPts || 0) + (e.type === 'punic_ship' ? 15 : e.type === 'pirate_ship' ? 8 : 4);
  const n = e.loot != null ? e.loot : e.type === 'punic_ship' ? randi(1, 2) : randi(0, 2);
  for (let i = 0; i < n; i++) { const id = nid(); const k = e.type === 'punic_ship' ? pick(['crate2', 'crate3', 'crate4']) : pick(['crate1', 'crate2', 'crate2', 'crate3']); G.crates.set(id, { id, k, x: e.x + rand(-6, 6), z: e.z + rand(-6, 6), ground: false, until: now() + 900 }); }
  if (p && p.char && Math.random() < (e.type === 'punic_ship' ? 0.6 : 0.35)) { p.char.quadScraps = (p.char.quadScraps || 0) + 1; say(p, `📜 Среди обломков — лоскут чертежа квадриремы (${p.char.quadScraps}/4)!`, 'good'); p.dirtyChar = true; }
  if (n) fx({ kind: 'loot', x: e.x, z: e.z });
}
function archerTick(t) {
  for (const s of G.W.ships) {
    const arch = G.W.slaves.filter((x) => x.ship === s.id); if (!arch.length || t < (s.archAt || 0)) continue;
    s.archAt = t + 2.4;
    let tgt = null, bd = 48;
    for (const e of G.eships.values()) { const d = Math.hypot(e.x - s.x, e.z - s.z); if (d < bd) { bd = d; tgt = e; } }
    if (!tgt) { bd = 34; for (const m of G.mobs.values()) { if (m.hp <= 0 || m.inst || !D.HOSTILE.has(m.faction) || m.faction === 'glad') continue; const d = Math.hypot(m.x - s.x, m.z - s.z); if (d < bd) { bd = d; tgt = m; } } }
    if (!tgt) continue;
    const own = s.owner && [...G.players.values()].find((q) => q.char && q.char.id === s.owner);
    for (const a of arch) shoot({ x: s.x + rand(-1.5, 1.5), z: s.z + rand(-3, 3), y: 2.6, kind: 'arrow', owner: own ? own.id : -s.id, side: 'player', dmg: Math.round(D.SLAVE_GRADES[a.grade || Math.min(3, a.skill || 1)].arch * ((D.SLAVE_TRAITS[a.trait] || {}).arch || 1) * (1 + ((a.agi || 5) - 5) * 0.03)), target: tgt, delay: rand(0, 0.8) });
  }
}
export function tradeTick(dt) {
  const t = now();
  moorTick(); pirateTick(t); boardingTick(t, dt); archerTick(t); boardTick();
  for (const cr of G.crates.values()) if (t > cr.until) G.crates.delete(cr.id);
}
