// Военное дело: отряды из вольных людей (пехота, конница, лучники, артиллерия), телохранитель,
// приказы (за мной / стоять / идти в точку), строй «стеной» или «врассыпную», улучшения, военные звания.
import { G, D, WG, now, dist, rand, randi, nid, send, log, hasAll, payAll, rankOf, hasOffice, officesOf, addRes, book } from './state.js';
import { spawnMob, grantXp, grantDig } from './combat.js';

const { SQUADS, SQUAD_UP, ENEMIES } = D;
const say = (p, text, kind = 'warn') => send(p, { type: 'log', text, kind });
const praetorium = (c) => G.W.buildings.find((b) => b.owner === c.id && b.type === 'praetorium' && b.built);
export const milRank = (c) => D.milIdx(c.milPts || 0);
// сколько отрядов можно держать: военное звание + гражданское звание + должность легата
export const squadLimit = (c) => (praetorium(c) ? Math.max(1, D.MIL_RANKS[milRank(c)].squads + Math.max(0, rankOf(c) - 2) + (hasOffice(c, 'legatus') ? 2 : 0)) : 1); // без Претория — только один отряд наёмников
const sqSize = (sq) => sq.slaves ? sq.slaves.length : SQUADS[sq.type].n + ((sq.up && sq.up.drill) || 0);
const officeOf = (c) => officesOf(c)[0] || null;
const homeOf = (c) => G.W.buildings.find((b) => b.id === c.home && b.owner === c.id) || G.W.buildings.find((b) => b.owner === c.id && (b.type === 'villa' || b.type === 'domus' || b.type === 'insula') && b.built);
const plOf = (cid) => [...G.players.values()].find((q) => q.char && q.char.id === cid);
const aliveOf = (ids) => (ids || []).filter((id) => { const m = G.mobs.get(id); return m && m.hp > 0; });

export function armyMsg(p, m) {
  const c = p.char; c.squads = c.squads || [];
  if (m.type === 'squadRecruit') {
    const S = SQUADS[m.k]; if (!S) return;
    const ars = G.W.buildings.find((b) => b.type === 'armamentarium' && b.built && !b.enemy && dist(p, b) < 25);
    if (S.merc) { if (!praetorium(c) && !ars) return say(p, 'Наёмников нанимают в Арсенале города или у своего Претория.'); }
    else {
      if (!praetorium(c)) return say(p, 'Отряды живут на латифундии: постройте Преторий (до этого — только телохранитель и наёмники).');
      if (dist(p, praetorium(c)) > 30) return say(p, 'Набор — у вашего Претория.');
    }
    if (rankOf(c) < S.rank) return say(p, `Нужно звание «${D.RANKS[S.rank].name}».`);
    if (c.squads.length >= squadLimit(c)) return say(p, `Сейчас можно держать отрядов: ${squadLimit(c)} (растёт с военным званием, званием и должностью легата).`);
    const fromSlaves = !!m.slaves && !S.merc;
    const free = fromSlaves ? G.W.slaves.filter((x) => x.owner === c.id && !x.bld && !x.ludus && !x.ship && !x.squad && !x.hired) : [];
    if (fromSlaves && free.length < S.n) return say(p, `Нужно ${S.n} свободных рабов (не на работе, не в школе гладиаторов), у вас ${free.length}.`);
    const price = Math.round(S.price * D.derived(c).buy * (fromSlaves ? D.SLAVE_SQUAD_K : 1)); if (c.den < price) return say(p, `Нужно ${price} денариев.`);
    c.den -= price;
    const sq = { id: nid(), type: m.k, name: `${S.merc ? 'Наёмники' : fromSlaves ? 'Рабы' : S.name.split(' ')[0]} ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][c.squads.length] || ''}`, up: {}, xp: 0, lvl: 1, form: 'line', mode: 'follow', live: [], lost: 0, kills: 0 };
    if (fromSlaves) { sq.slaves = free.slice(0, S.n).map((x) => { x.squad = sq.id; return x.id; }); G.dirtyWorld = true; }
    if (S.merc) { sq.merc = true; sq.until = now() + S.days * D.CFG.dayLength; sq.payAt = now() + 60; }
    c.squads.push(sq);
    if (S.merc) { if (!p.inst) spawnSquad(p, sq); say(p, `💰 Наёмники пришли и следуют за вами. Плата — ${S.upkeep} ден. в минуту, срок — ${S.days} дня.`, 'good'); }
    else say(p, `⚔ Набран отряд: ${S.name}${fromSlaves ? ' (из ваших рабов)' : ''}. Вызовите его в окне «Военное дело» (U).`, 'good');
  } else if (m.type === 'guardHire') {
    if (c.guard) return say(p, 'Телохранитель у вас уже есть.');
    if (!officeOf(c)) return say(p, 'Телохранителя дают только должностным лицам (префект, эдил, легат, сенатор и др.).');
    const ar = G.W.buildings.find((b) => b.type === 'armamentarium' && b.built && !b.enemy && dist(p, b) < 25);
    if (!ar) return say(p, 'Телохранителя нанимают в Арсенале города.');
    if (c.den < D.GUARD_PRICE) return say(p, `Нужно ${D.GUARD_PRICE} денариев (первый день службы).`);
    c.den -= D.GUARD_PRICE; c.guard = { out: true, id: null, mode: 'follow', payAt: now() + D.CFG.dayLength }; say(p, `🛡 Телохранитель нанят и следует за вами. Плата — ${D.GUARD_PRICE} ден. за каждый день службы.`, 'good');
  } else if (m.type === 'guardToggle') { if (!c.guard) return; c.guard.out = !c.guard.out; if (!c.guard.out && c.guard.id) { G.mobs.delete(c.guard.id); c.guard.id = null; } }
  else if (m.type === 'guardFire') { if (!c.guard) return; if (c.guard.id) G.mobs.delete(c.guard.id); c.guard = null; say(p, 'Телохранитель рассчитан.', 'info'); }
  else if (m.type === 'guardOrder') {
    const g = c.guard; if (!g) return;
    if (m.mode === 'follow') g.mode = 'follow';
    else if (m.mode === 'hold') { const mob = g.id && G.mobs.get(g.id); g.mode = 'hold'; g.pt = { x: mob ? mob.x : p.x, z: mob ? mob.z : p.z }; }
    else if (m.mode === 'home') { const h = homeOf(c); if (!h) return say(p, 'У вас нет дома (Дом или вилла латифундии).'); g.mode = 'home'; g.pt = { x: h.x, z: h.z }; }
    else if (m.mode === 'bld') { const b = G.W.buildings.find((x) => x.id === Number(m.bid) && x.owner === c.id); if (!b) return; g.mode = 'bld'; g.bid = b.id; g.pt = { x: b.x, z: b.z }; }
    say(p, `🛡 Телохранитель: ${{ follow: 'идёт за вами', hold: 'стоит на месте', home: 'охраняет дом', bld: 'охраняет постройку' }[g.mode]}.`, 'info');
  } else {
    const sq = c.squads.find((x) => x.id === m.id); if (!sq) return;
    if (m.type === 'squadUp') {
      const U = SQUAD_UP[m.k]; if (!U) return; sq.up = sq.up || {}; const lv = sq.up[m.k] || 0; if (lv >= U.max) return;
      const cost = U.cost(lv + 1), den = U.den(lv + 1);
      if (c.den < den || !hasAll(c, cost)) return say(p, `Нужно ${den} ден. и ` + Object.entries(cost).map(([k, n]) => `${D.RES[k].name} ×${n}`).join(', '));
      c.den -= den; payAll(c, cost); sq.up[m.k] = lv + 1; dismiss(sq);
      say(p, `⚔ ${sq.name}: ${U.name} — ступень ${lv + 1}.`, 'good');
    } else if (m.type === 'squadOut') {
      if (aliveOf(sq.live).length) return;
      if (p.inst) return say(p, 'Здесь отряд не пройдёт.');
      if (sq.homeAway && !nearMilitary(p, c)) return say(p, `${sq.name} отправлен домой — призвать его снова можно у своего Претория, в Казармах или в Арсенале города.`);
      sq.homeAway = false;
      sq.mode = 'follow'; spawnSquad(p, sq);
      say(p, `⚔ ${sq.name} вышел на поле. Значок — над поясом: 1–5 выбрать, 0 — отменить приказы, Z — вид сверху (ПКМ — приказ).`, 'good');
    } else if (m.type === 'squadIn' || m.type === 'squadHome') { // домой: отряд уходит сам; снова призвать — у военных зданий
      if (!aliveOf(sq.live).length) { sq.homeAway = true; return; }
      sq.mode = 'home'; sq.homeAt = now(); sq.homeAway = true; const h = praetorium(c) || homeOf(c); const a = avgPos(sq);
      sq.pt = h ? { x: h.x, z: h.z, ry: 0 } : { x: a.x + Math.sin(p.ry) * -80, z: a.z + Math.cos(p.ry) * -80, ry: 0 };
      say(p, `🏠 ${sq.name} уходит домой. Призвать снова — у своего Претория, в Казармах или в Арсенале.`, 'info');
    }
    else if (m.type === 'squadOrder') {
      if (m.mode === 'follow' || m.mode === 'hold' || m.mode === 'move' || m.mode === 'attack') sq.mode = m.mode;
      if (sq.mode === 'attack') {
        let t = m.tgt != null ? G.mobs.get(Number(m.tgt)) : null;
        if (!t) { const a = avgPos(sq); let bd = 90; for (const q of G.mobs.values()) if (q.hp > 0 && !q.inst && isFoe(q, c)) { const d = Math.hypot(q.x - a.x, q.z - a.z); if (d < bd) { bd = d; t = q; } } } // кнопка «Атаковать» — на ближайшего врага
        if (!t || t.hp <= 0 || !isFoe(t, c)) { sq.mode = 'hold'; const a = avgPos(sq); sq.pt = { x: a.x, z: a.z, ry: p.ry }; say(p, 'Врагов рядом нет — отряд держит оборону.', 'info'); } else { sq.tgt = t.id; sq.pt = { x: t.x, z: t.z, ry: 0 }; }
      }
      else sq.tgt = null;
      if (m.form === 'line' || m.form === 'loose' || m.form === 'tight') sq.form = m.form;
      if (sq.mode === 'hold') sq.pt = { x: sq.pt && m.mode !== 'hold' ? sq.pt.x : avgPos(sq).x, z: sq.pt && m.mode !== 'hold' ? sq.pt.z : avgPos(sq).z, ry: p.ry };
      if (sq.mode === 'move' && isFinite(m.x) && isFinite(m.z)) sq.pt = { x: Number(m.x), z: Number(m.z), ry: Math.atan2(Number(m.x) - p.x, Number(m.z) - p.z) };
    } else if (m.type === 'squadDisband') { disband(c, sq); say(p, 'Отряд распущен.', 'info'); }
  }
  p.dirtyChar = true;
}
// 0 — отменить все приказы: все отряды идут за хозяином
export function cancelOrders(p) { const c = p.char; for (const sq of c.squads || []) if (sq.mode !== 'home') { sq.mode = 'follow'; sq.tgt = null; } p.dirtyChar = true; say(p, '⚔ Приказы отменены: все отряды идут за вами.', 'info'); }
const nearMilitary = (p, c) => { const pr = praetorium(c); if (pr && dist(p, pr) < 40) return true; return G.W.buildings.some((b) => (b.type === 'armamentarium' || b.type === 'castra') && b.built && !b.enemy && dist(p, b) < 30); };
// враг для отряда: налётчики, пираты, Карфаген, варвары, разбойники; на Поле Марса — чужая команда
function isFoe(t, c) { if (t.team) { const pl = plOf(c.id); return !!(pl && pl.war && t.war === pl.war.lid && t.team !== pl.war.team); } if (t.squad) return false; return ['barbarian', 'pirate', 'punic', 'robber', 'beast', 'syr'].includes(t.faction) || (t.def && t.def.faction !== 'rome' && t.def.faction !== 'prey'); }
function avgPos(sq) { const l = aliveOf(sq.live).map((id) => G.mobs.get(id)); if (!l.length) return { x: 0, z: 0 }; return { x: l.reduce((a, m) => a + m.x, 0) / l.length, z: l.reduce((a, m) => a + m.z, 0) / l.length }; }
function spawnSquad(p, sq) {
  const S = SQUADS[sq.type], up = sq.up || {}, n = sqSize(sq), lvl = Math.max(1, Math.min(30, p.char.level + (sq.lvl - 1)));
  sq.live = [];
  for (let i = 0; i < n; i++) {
    const a = p.ry + Math.PI + (i - n / 2) * 0.25, x = p.x + Math.sin(a) * 6, z = p.z + Math.cos(a) * 6;
    const m = spawnMob(S.unit, WG.terrainHeight(x, z) > 0.3 ? x : p.x, WG.terrainHeight(x, z) > 0.3 ? z : p.z, { lvl, leash: 30, src: { kind: 'squad', owner: p.char.id, sq: sq.id } });
    if (!m) continue;
    const sl = sq.slaves && G.W.slaves.find((x) => x.id === sq.slaves[i]), T = (sl && D.SLAVE_TRAITS[sl.trait]) || {};
    m.hp = m.maxHp = Math.round(m.maxHp * (1 + 0.12 * (up.arm || 0)) * (S.hpK || 1) * (T.hp || 1)); m.armor *= 1 + 0.12 * (up.arm || 0); m.dmg *= (1 + 0.1 * (up.wpn || 0)) * (S.dmgK || 1) * (T.glad || 1) * (sq.type === 'arch' ? T.arch || 1 : 1); m.speed *= 1 + 0.05 * (up.drill || 0);
    m.squad = { owner: p.char.id, sq: sq.id, slot: i, n }; m.gname = `${p.char.name}: ${sq.name}`;
    sq.live.push(m.id);
  }
}
function disband(c, sq) { dismiss(sq); for (const s of G.W.slaves) if (s.squad === sq.id) s.squad = null; G.dirtyWorld = true; c.squads = c.squads.filter((x) => x !== sq); }
function dismiss(sq) { for (const id of sq.live || []) G.mobs.delete(id); sq.live = []; }
// куда стремится воин отряда (если не в бою): место в строю
export function squadSlot(m) {
  if (m.squad.sq === 'guard') { const c = G.chars[m.squad.owner], g = c && c.guard; if (!g) return null;
    if (g.mode && g.mode !== 'follow' && g.pt) return { x: g.pt.x + 3, z: g.pt.z + 3, sq: { mode: 'hold' } };
    const pl = plOf(m.squad.owner); if (!pl) return null; return { x: pl.x - Math.sin(pl.ry) * 2.5 + Math.cos(pl.ry) * 1.5, z: pl.z - Math.cos(pl.ry) * 2.5 - Math.sin(pl.ry) * 1.5, sq: { mode: 'follow' } }; }
  const c = G.chars[m.squad.owner], sq = c && (c.squads || []).find((x) => x.id === m.squad.sq); if (!c || !sq) return null;
  const pl = plOf(c.id);
  let ax, az, ry, focus = null;
  if (sq.mode === 'attack') { // атака: пехота и конница идут строем прямо на врага, лучники и артиллерия стреляют издали
    const t = G.mobs.get(sq.tgt);
    if (!t || t.hp <= 0) { let nb = null, bd = 18; for (const q of G.mobs.values()) if (q.hp > 0 && q !== t && sq.pt && isFoe(q, c) && Math.hypot(q.x - sq.pt.x, q.z - sq.pt.z) < bd) { bd = Math.hypot(q.x - sq.pt.x, q.z - sq.pt.z); nb = q; } if (nb) sq.tgt = nb.id; else { sq.mode = 'hold'; } }
    const t2 = G.mobs.get(sq.tgt);
    if (sq.mode === 'attack' && t2) {
      const me = avgPos(sq), ranged = ['arch', 'art'].includes(sq.type), R0 = ranged ? (sq.type === 'art' ? 45 : 26) : 0, d0 = Math.hypot(t2.x - me.x, t2.z - me.z) || 1;
      ry = Math.atan2(t2.x - me.x, t2.z - me.z); focus = t2.id;
      if (ranged && d0 > R0) { ax = t2.x - (t2.x - me.x) / d0 * R0; az = t2.z - (t2.z - me.z) / d0 * R0; } else if (ranged) { ax = me.x; az = me.z; } else { ax = t2.x; az = t2.z; }
      sq.pt = { x: t2.x, z: t2.z, ry };
    }
  }
  if (focus == null) {
    if (sq.mode === 'follow') { if (!pl) return null; ax = pl.x - Math.sin(pl.ry) * 5; az = pl.z - Math.cos(pl.ry) * 5; ry = pl.ry; }
    else { if (!sq.pt) return null; ax = sq.pt.x; az = sq.pt.z; ry = sq.pt.ry || 0; }
  }
  // каждый отряд — своей группой: места в общем строю рядом (по порядку отрядов), лучники и артиллерия — позади
  { const order = (c.squads || []).filter((x) => (x.live || []).length && x.mode === sq.mode && (sq.mode === 'follow' || (x.pt && sq.pt && Math.hypot(x.pt.x - sq.pt.x, x.pt.z - sq.pt.z) < 25)));
    const k = Math.max(0, order.indexOf(sq)), back = ['arch', 'art'].includes(sq.type) ? 9 : 0, side = k === 0 ? 0 : (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 16;
    if (order.length > 1 || back) { ax += side * Math.cos(ry) - (back + (sq.mode === 'follow' ? 2 : 0)) * Math.sin(ry); az += -side * Math.sin(ry) - (back + (sq.mode === 'follow' ? 2 : 0)) * Math.cos(ry); } }
  const i = m.squad.slot, n = m.squad.n;
  if (sq.form === 'line' || sq.form === 'tight') { // стеной: ряд по 6; «плечом к плечу» — сомкнутый строй, ряд по 8 вплотную
    const T = sq.form === 'tight', per = T ? 8 : 6, row = Math.floor(i / per), col = i % per, w = Math.min(per, n - row * per), lx = (col - (w - 1) / 2) * (T ? 1.15 : 2.2), lz = -row * (T ? 1.3 : 2.4) - (SQUADS[sq.type].unit === 'rom_arch' ? 4 : 0);
    return { x: ax + lx * Math.cos(ry) + lz * Math.sin(ry), z: az - lx * Math.sin(ry) + lz * Math.cos(ry), sq, focus };
  }
  const a = i * 2.399 + m.id, r = 3 + (i % 4) * 2.6; // врассыпную
  return { x: ax + Math.cos(a) * r, z: az + Math.sin(a) * r, sq, focus };
}
// тик: телохранители, возвращение павших, опыт отрядов
let acc = 0;
export function armyTick(dt) {
  acc += dt; if (acc < 1) return; acc = 0;
  for (const p of G.players.values()) {
    const c = p.char; if (!c) continue;
    if (c.guard && c.guard.payAt && now() >= c.guard.payAt) { // плата за каждый день службы
      if (c.den >= D.GUARD_PRICE) { c.den -= D.GUARD_PRICE; c.guard.payAt = now() + D.CFG.dayLength; send(p, { type: 'log', text: `🛡 Телохранителю уплачено за день: ${D.GUARD_PRICE} ден.`, kind: 'info' }); }
      else { if (c.guard.id) G.mobs.delete(c.guard.id); c.guard = null; send(p, { type: 'log', text: '🛡 Нечем платить — телохранитель ушёл.', kind: 'warn' }); }
      p.dirtyChar = true;
    }
    if (c.guard && c.guard.id && p.ship) { G.mobs.delete(c.guard.id); c.guard.id = null; } // телохранитель садится на корабль вместе с хозяином
    if (c.guard && c.guard.out && !p.inst && !p.ship && p.alive) {
      const g = c.guard.id && G.mobs.get(c.guard.id);
      if (!g || g.hp <= 0) {
        if (g && g.hp <= 0) { c.guard.id = null; c.guard.downUntil = now() + 120; send(p, { type: 'log', text: '🛡 Телохранитель ранен — вернётся через 2 минуты.', kind: 'warn' }); }
        else if (!c.guard.downUntil || now() > c.guard.downUntil) { const gp = c.guard.mode && c.guard.mode !== 'follow' && c.guard.pt ? { x: c.guard.pt.x + 3, z: c.guard.pt.z + 3 } : { x: p.x - Math.sin(p.ry) * 3, z: p.z - Math.cos(p.ry) * 3 }; const m = spawnMob('rom_guard', gp.x, gp.z, { lvl: c.level + 2, leash: 30, src: { kind: 'squad', owner: c.id, sq: 'guard' } }); if (m) { m.squad = { owner: c.id, sq: 'guard', slot: 0, n: 1 }; c.guard.id = m.id; } }
      }
    }
    for (const sq of [...(c.squads || [])]) {
      if (sq.war) continue; // отряды Поля Марса живут только на время боя
      const before = (sq.live || []).length; sq.live = aliveOf(sq.live); const lost = before - sq.live.length;
      if (lost > 0 && sq.slaves) { for (let k = 0; k < lost && sq.slaves.length; k++) { const sid = sq.slaves.pop(); G.W.slaves = G.W.slaves.filter((x) => x.id !== sid); } G.dirtyWorld = true; } // павший воин-раб потерян
      if (lost > 0) { sq.lost += lost; if (!sq.live.length) send(p, { type: 'log', text: `⚔ ${sq.name} разбит и отступил в преторий. Его можно снова вызвать.`, kind: 'warn' }); p.dirtyChar = true; }
      if (sq.slaves && !sq.slaves.length) { disband(c, sq); send(p, { type: 'log', text: `⚔ ${sq.name}: все рабы-воины пали.`, kind: 'warn' }); continue; }
      if (sq.merc) { // наёмники: плата раз в минуту, уходят через 3 дня или без платы
        if (now() >= sq.payAt) { const S = SQUADS[sq.type]; sq.payAt = now() + 60; if (c.den >= S.upkeep) { c.den -= S.upkeep; book(c, 'Наёмники', -S.upkeep); } else { disband(c, sq); send(p, { type: 'log', text: '💰 Нечем платить — наёмники ушли.', kind: 'warn' }); p.dirtyChar = true; continue; } p.dirtyChar = true; }
        if (now() >= sq.until) { disband(c, sq); send(p, { type: 'log', text: '💰 Срок найма вышел — наёмники ушли.', kind: 'info' }); p.dirtyChar = true; continue; }
      }
      if (p.ship && sq.live.length && sq.mode !== 'home' && sq.mode !== 'attack' && sq.mode !== 'hold') { // вместе с хозяином — на корабль (не больше двух отрядов, лучники-рабы — сверх того)
        if ((c.squads || []).filter((x) => x.aboard === p.ship).length >= D.SHIP_SQUADS) { const a = avgPos(sq); sq.mode = 'hold'; sq.pt = { x: a.x, z: a.z, ry: 0 }; send(p, { type: 'log', text: `⚓ На корабле места только для ${D.SHIP_SQUADS} отрядов — ${sq.name} ждёт на берегу.`, kind: 'warn' }); continue; }
        dismiss(sq); sq.aboard = p.ship; G.dirtyWorld = true; continue; }
      if (!p.ship && sq.aboard && !sq.live.length && !p.inst && p.alive) { sq.aboard = null; sq.mode = 'follow'; spawnSquad(p, sq); G.dirtyWorld = true; continue; } // и вместе на берег
      if (sq.mode === 'home' && sq.live.length && (now() - (sq.homeAt || 0) > 25 || (sq.pt && Math.hypot(avgPos(sq).x - sq.pt.x, avgPos(sq).z - sq.pt.z) < 12))) { dismiss(sq); sq.mode = 'follow'; continue; } // дошли до дома (или скрылись из виду)
      if (sq.live.length && (p.inst || Math.hypot(avgPos(sq).x - p.x, avgPos(sq).z - p.z) > 500)) dismiss(sq);
    }
  }
}
// убийство врага воином отряда: опыт отряду, военные очки хозяину
export function squadKill(byMob, dead) {
  const c = G.chars[byMob.squad.owner]; if (!c) return;
  const f = dead.def.faction, pts = D.MIL_PTS[f] || 0;
  if (pts) c.milPts = (c.milPts || 0) + pts * (dead.def.boss ? 5 : 1);
  const sq = (c.squads || []).find((x) => x.id === byMob.squad.sq);
  if (sq) { sq.kills++; sq.xp += (dead.def.xp || 10); const need = 150 * sq.lvl; if (sq.xp >= need && sq.lvl < 10) { sq.xp -= need; sq.lvl++; const p = plOf(c.id); if (p) send(p, { type: 'log', text: `⚔ ${sq.name} получил опыт: ${sq.lvl} уровень.`, kind: 'good' }); } }
  const p = plOf(c.id);
  // убитые отрядом или телохранителем: хозяину — опыт, добыча в сумку и военные очки
  if (p && !dead.war) {
    if (dead.def.xp) grantXp(p, dead.def.xp * (1 + 0.12 * ((dead.lvl || 1) - 1)) * 0.7);
    const got = [];
    for (const [res, [a, b]] of Object.entries(dead.def.loot || {})) { const n = randi(a, b); if (n > 0 && addRes(c, res, n)) got.push(`${D.RES[res] ? D.RES[res].name : res} ${n}`); }
    if (dead.def.denarii) { const n = Math.round(randi(...dead.def.denarii) * (1 + 0.1 * ((dead.lvl || 1) - 1))); c.den += n; book(c, 'Добыча отрядов', n); got.push(`${n} ден.`); }
    if (dead.src && dead.src.kind === 'raid') grantDig(p, dead.def.boss ? 10 : 2);
    if (got.length) send(p, { type: 'log', text: `⚔ ${byMob.squad.sq === 'guard' ? 'Телохранитель' : sq ? sq.name : 'Отряд'} сразил: ${dead.def.name} — ${got.join(', ')}${pts ? `, +${pts * (dead.def.boss ? 5 : 1)} воен. оч.` : ''}`, kind: 'good' });
  }
  if (p) p.dirtyChar = true;
}
// ---------- Дозорные города: покупает и улучшает легат в Арсенале; при набеге бегут навстречу врагу ----------
export function watchState(cid) { const W = G.W; W.watch = W.watch || {}; return (W.watch[cid] = W.watch[cid] || { n: 0, lvl: 0, live: [] }); }
export function watchMsg(p, m) {
  const c = p.char, ar = G.W.buildings.find((b) => b.type === 'armamentarium' && b.built && !b.enemy && dist(p, b) < 30);
  if (!ar) return say(p, 'Дозорных нанимают в Арсенале римского города.');
  if (!hasOffice(c, 'legatus')) return say(p, 'Дозорными распоряжается легат.');
  const st = watchState(ar.city || 'messana'), W = G.W, WT = D.WATCH;
  if (m.type === 'watchBuy') {
    if (st.n >= WT.max) return say(p, `Дозорных уже ${WT.max} — больше город не прокормит.`);
    if (W.treasury < WT.price) return say(p, `В казне нужно ${WT.price} ден.`);
    W.treasury -= WT.price; st.n++; log(`🛡 Легат ${c.name} нанял дозорного (${st.n}/${WT.max}).`, 'good');
  } else if (m.type === 'watchUp') {
    if (st.lvl >= WT.upMax) return; const cost = WT.upCost(st.lvl + 1); if (W.treasury < cost) return say(p, `В казне нужно ${cost} ден.`);
    W.treasury -= cost; st.lvl++; for (const id of st.live) G.mobs.delete(id); st.live = []; log(`🛡 Легат ${c.name} улучшил выучку дозорных: ступень ${st.lvl}.`, 'good');
  }
  G.dirtyWorld = true; p.dirtyChar = true;
}
export function watchTick() {
  for (const C of G.world.cities) {
    const cs = G.W.cityState && G.W.cityState[C.id]; if (!cs || cs.owner !== 'rome') continue;
    const st = watchState(C.id); st.live = (st.live || []).filter((id) => { const m = G.mobs.get(id); return m && m.hp > 0; });
    if (st.live.length < st.n) {
      const ar = G.W.buildings.find((b) => b.type === 'armamentarium' && b.city === C.id && b.built) || { x: C.x, z: C.z };
      const m = spawnMob('legionary', ar.x + rand(-5, 5), ar.z + rand(-5, 5), { lvl: 5 + st.lvl * 2, leash: 9999, src: { kind: 'watch', city: C.id, onDeath: () => { const s2 = watchState(C.id); s2.n = Math.max(0, s2.n - 1); log(`🛡 Дозорный ${C.name} пал. Легат может нанять нового в Арсенале.`, 'bad'); G.dirtyWorld = true; } } });
      if (m) { m.hp = m.maxHp = Math.round(m.maxHp * (1 + D.WATCH.hpK * st.lvl)); m.dmg *= 1 + D.WATCH.dmgK * st.lvl; m.watch = { city: C.id, x: C.x, z: C.z, R: C.R }; m.def = { ...m.def, aggro: 70, name: 'Дозорный' }; st.live.push(m.id); }
    }
  }
}
export const armyOf = (c) => ({ freeSlaves: G.W.slaves.filter((x) => x.owner === c.id && !x.bld && !x.ludus && !x.ship && !x.squad && !x.hired).length, squads: (c.squads || []).map((s) => ({ ...s, live: aliveOf(s.live).length, size: sqSize(s), left: s.until ? Math.max(0, Math.round(s.until - now())) : null })), limit: squadLimit(c), milPts: c.milPts || 0, mil: milRank(c), guard: c.guard ? { out: c.guard.out, mode: c.guard.mode || 'follow', bid: c.guard.bid || null, pay: c.guard.payAt ? Math.max(0, Math.round(c.guard.payAt - now())) : null, alive: !!(c.guard.id && G.mobs.get(c.guard.id)) } : null, office: officeOf(c), praetorium: !!praetorium(c) });
