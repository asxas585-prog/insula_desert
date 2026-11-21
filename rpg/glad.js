import {announce} from './state.js';
import { housingCapacity } from './logistics.js';
import { cityOf } from './access.js';
// Пленники и рабы-гладиаторы, очки арены, школа гладиаторов, приручение львов
import { G, D, WG, now, dist, rand, randi, pick, nid, send, log, fx, chronicle, rankOf, book, holderOf } from './state.js';
import { slaveLimitOf } from './state.js';
import { spawnMob, grantXp, grantDig } from './combat.js';
import { builtOf, slaveGrade } from './economy.js';
const say = (p, text, kind = 'info') => send(p, { type: 'log', text, kind });
const slaveLimit = c => Math.min(slaveLimitOf(c), housingCapacity(c));
const mySlaves = (c) => G.W.slaves.filter((s) => s.owner === c.id);

// ---------- Пленники: поверженный варвар/карфагенянин/пират может встать на колено ----------
const CAPTIVE = new Set(['barbarian', 'punic', 'pirate']);
export function tryKneel(m, p) {
  const def = m.def;
  if (!p || !p.char || m.inst || m.arena || !def.human || !CAPTIVE.has(def.faction)) return false;
  if (Math.random() > (def.boss ? 0.5 : 0.22)) return false;
  m.hp = 1; m.kneel = now() + 30; m.state = 'kneel'; m.target = null; m.goal = null; m.moving = 0;
  fx({ kind: 'kneel', id: m.id, x: m.x, z: m.z });
  say(p, `🙇 ${def.name} бросает оружие и встаёт на колено. E — сделать рабом (30 с).`, 'good');
  return true;
}
function captiveGrade(m) {
  const t = m.type;
  if (['barb_chief', 'punic_officer'].includes(t) || (m.def.boss && m.def.faction === 'pirate')) return 4;
  if (t === 'punic_vet') return 3;
  if (m.def.faction === 'punic') return 2;
  return Math.random() < 0.3 ? 2 : 1;
}
const ORIGIN = { barbarian: 'пленный варвар', punic: 'пленный карфагенянин', pirate: 'пленный пират' };
export function enslave(p, mid) {
  const m = G.mobs.get(mid), c = p.char; if (!m || !m.kneel) return;
  if (dist(p, m) > 4) return say(p, 'Подойдите ближе к пленнику.', 'warn');
  if (mySlaves(c).length >= slaveLimit(c)) return say(p, `Ваше звание позволяет держать не больше ${slaveLimit(c)} рабов. Продайте лишних работорговцу.`, 'warn');
  const grade = captiveGrade(m);
  G.W.slaves.push({ id: nid(), name: pick(D.SLAVE_NAMES), origin: grade === 4 ? 'бывший ' + (m.def.faction === 'punic' ? 'военачальник Карфагена' : m.def.faction === 'pirate' ? 'пиратский капитан' : 'вождь варваров') : ORIGIN[m.def.faction], grade, skill: Math.min(3, grade), ...D.rollSlave(grade), owner: c.id, bld: null, glvl: 0, gxp: 0, gw: 0, ga: 0 });
  finish(m, p);
  say(p, `⛓ Новый раб: ${D.SLAVE_GRADES[grade].name}. Назначьте его на хозяйство, лучником на корабль или гладиатором.`, 'good');
  grantXp(p, 10 * grade); G.dirtyWorld = true; p.dirtyChar = true;
}
// пленник уведён или сбежал: для лагерей и набегов он считается побеждённым
function finish(m, p) { G.mobs.delete(m.id); fx({ kind: 'mgone', id: m.id, x: m.x, z: m.z }); m.hp = 0; m.kneel = null; if (m.src && m.src.onDeath) try { m.src.onDeath(m, p); } catch (e) { console.error(e); } }
export function kneelTick(t) {
  for (const m of [...G.mobs.values()]) if (m.kneel && t > m.kneel) finish(m, null);
}

// ---------- Львы: убить матёрого льва и приручить сетью (50%) ----------
export function tame(p, mid) {
  const m = G.mobs.get(mid), c = p.char; if (!m || !m.def.tameable || m.hp > 0) return;
  if (dist(p, m) > 5) return say(p, 'Подойдите к телу льва.', 'warn');
  if (!(c.tamer > 0)) return say(p, 'Нужна «Сеть и аркан приручителя» — её продают на арене за очки арены.', 'warn');
  if (!G.W.buildings.some((b) => b.type === 'vivarium' && b.owner === c.id && b.built)) return say(p, 'Сначала постройте свой Зверинец (за очки арены) — льва негде держать.', 'warn');
  c.tamer--; m.tamedTry = true;
  if (Math.random() < 0.5) {
    c.lions = c.lions || []; c.lions.push({ id: nid(), name: pick(['Цезарь', 'Нерон', 'Гром', 'Аякс', 'Ганнибал', 'Рыжий', 'Сабин']), lvl: 1 });
    G.mobs.delete(m.id); fx({ kind: 'mgone', id: m.id });
    say(p, '🦁 Лев приручён и отправлен в ваш Зверинец! Его можно выставлять на арену.', 'good'); log(`🦁 ${c.name} приручил(а) матёрого льва!`, 'good');
  } else say(p, '🦁 Лев вырвался из сети и издох. Сеть порвана.', 'bad');
  p.dirtyChar = true;
}

// ---------- Школа гладиаторов: тренировка раз в минуту ----------
export const gladNeed = (lv) => 60 + lv * 50;
export function ludusTick() {
  for (const s of G.W.slaves) {
    if (!s.ludus) continue;
    const b = G.W.buildings.find((x) => x.id === s.ludus && x.built && !x.ruined); if (!b) { s.ludus = null; s.sale = null; continue; }
    if (b.owner && b.owner !== s.owner) { // чужой гладиатор в школе: содержание и обучение — хозяину школы
      const o = G.chars[s.owner], h = G.chars[b.owner], fee = D.LUDUS_FEE.keep;
      if (o && o.den >= fee) { o.den -= fee; book(o, 'Расход: содержание в чужой школе гладиаторов', -fee); if (h) { h.den += fee; h.rentGot = (h.rentGot || 0) + fee; book(h, 'Доход: Школа гладиаторов (содержание чужих)', fee); } } else { s.ludus = null; s.sale = null; continue; }
    }
    if ((s.glvl || 0) >= 10) continue;
    s.gxp = (s.gxp || 0) + 8 + slaveGrade(s) * 4;
    while ((s.glvl || 0) < 10 && s.gxp >= gladNeed(s.glvl || 0)) { s.gxp -= gladNeed(s.glvl || 0); s.glvl = (s.glvl || 0) + 1; }
  }
  G.dirtyWorld = true;
}

// ---------- Окно гладиаторов: улучшения, магазин, назначения ----------
export function gladMsg(p, m) {
  const c = p.char, ap = () => c.ap || 0;
  const amph = builtOf('amphitheatrum').find((b) => dist(p, b) < 95);
  if (m.type === 'enslave') return enslave(p, m.id);
  if (m.type === 'tame') return tame(p, m.id);
  if (m.type === 'gladLudus') { // раб в школу гладиаторов / из неё
    const s = G.W.slaves.find((x) => x.id === m.sid); if (!s || s.owner !== c.id) return;
    if (!m.on) { s.ludus = null; G.dirtyWorld = true; return; }
    if (s.squad) return say(p, 'Сначала распустите отряд работника.');
    // своя школа — бесплатно; чужая (рядом, до 30 м) — 25 ден. хозяину за обучение
    const b = G.W.buildings.find((x) => x.type === 'ludus' && x.owner === c.id && x.built) || G.W.buildings.find((x) => x.type === 'ludus' && x.built && dist(p, x) < 30); if (!b) return say(p, 'Нет своей Школы гладиаторов (или подойдите к чужой).', 'warn');
    if (G.W.slaves.filter((x) => x.ludus === b.id).length >= D.BUILDINGS.ludus.slots) return say(p, `В школе ${D.BUILDINGS.ludus.slots} мест.`, 'warn');
    if (b.owner !== c.id) { const F = D.LUDUS_FEE.train; if (c.den < F) return say(p, `Обучение в чужой школе — ${F} денариев сразу и ${D.LUDUS_FEE.keep} ден. в минуту за содержание.`, 'warn'); c.den -= F; book(c, 'Расход: обучение в чужой школе гладиаторов', -F); const o = G.chars[b.owner]; if (o) { o.den += F; o.rentGot = (o.rentGot || 0) + F; book(o, 'Доход: Школа гладиаторов (обучение чужих)', F); } }
    s.ludus = b.id; s.bld = null; s.ship = null; G.dirtyWorld = true; return say(p, `${s.name} тренируется в школе гладиаторов.`, 'good');
  }
  if (m.type === 'gladName') { // своему гладиатору — имя (прозвище)
    const s = G.W.slaves.find((x) => x.id === m.sid); if (!s || s.owner !== c.id) return;
    const n = String(m.name || '').replace(/[<>]/g, '').trim().slice(0, 20); if (n.length < 2) return say(p, 'Имя — от 2 до 20 букв.', 'warn');
    s.name = n; G.dirtyWorld = true; G.dirtyBld = true; return say(p, `🛡 Гладиатор теперь зовётся «${n}».`, 'good');
  }
  if (m.type === 'gladSale') { // выставить своего гладиатора на продажу (он должен быть в школе гладиаторов)
    const s = G.W.slaves.find((x) => x.id === m.sid); if (!s || s.owner !== c.id) return;
    if (!s.ludus) return say(p, 'Продают гладиаторов в школе гладиаторов: сначала отправьте его в школу.', 'warn');
    s.sale = Math.max(0, Math.min(1e6, Number(m.price) | 0)) || null; G.dirtyBld = true; G.dirtyWorld = true;
    return say(p, s.sale ? `🏷 ${s.name} продаётся в школе за ${s.sale} ден.` : 'Снят с продажи.', 'info');
  }
  if (m.type === 'gladBuy') { // купить чужого гладиатора в школе (хозяину школы — 10%, если он не продавец)
    const s = G.W.slaves.find((x) => x.id === m.sid); if (!s || !s.sale || s.owner === c.id) return;
    const b = G.W.buildings.find((x) => x.id === s.ludus); if (!b || dist(p, b) > 25) return say(p, 'Подойдите к школе гладиаторов.', 'warn');
    if (G.W.slaves.filter((x) => x.owner === c.id).length >= Math.min(slaveLimitOf(c), housingCapacity(c))) return say(p, `Ваше звание позволяет держать не больше ${slaveLimitOf(c)} рабов.`, 'warn');
    if (c.den < s.sale) return say(p, `Нужно ${s.sale} денариев.`, 'warn');
    const seller = G.chars[s.owner], host = b.owner && b.owner !== s.owner ? G.chars[b.owner] : null, cut = host ? Math.round(s.sale * 0.1) : 0, tax = Math.round(s.sale * 0.05);
    c.den -= s.sale; book(c, 'Покупка гладиаторов', -s.sale); G.W.treasury += tax;
    if (seller) { seller.den += s.sale - cut - tax; book(seller, 'Продажа гладиаторов', s.sale - cut - tax); }
    if (host) { host.den += cut; host.rentGot = (host.rentGot || 0) + cut; book(host, 'Доход: Школа гладиаторов (доля с продаж)', cut); }
    log(`🛡 ${c.name} купил(а) гладиатора «${s.name}» за ${s.sale} ден.`, 'info');
    s.owner = c.id; s.sale = null; s.ludus = b.owner === c.id ? b.id : null; s.bld = null; s.ship = null; s.squad = null;
    G.dirtyWorld = true; G.dirtyBld = true; p.dirtyChar = true; return;
  }
  if (!amph) return say(p, 'Это делают в Амфитеатре.', 'warn');
  if (m.type === 'gladUp') { // снаряжение раба-гладиатора
    const s = G.W.slaves.find((x) => x.id === m.sid), U = D.GLAD_UP[m.k]; if (!s || s.owner !== c.id || !U) return;
    const key = 'g' + m.k, lv = (s[key] || 0) + 1; if (lv > U.max) return;
    if (ap() < U.ap(lv)) return say(p, `Нужно ${U.ap(lv)} очков арены.`, 'warn');
    c.ap -= U.ap(lv); s[key] = lv; G.dirtyWorld = true; say(p, `⚔ ${s.name}: ${U.name} — ступень ${lv}.`, 'good');
  } else if (m.type === 'arenaGear') { // своё гладиаторское снаряжение
    const U = D.ARENA_GEAR[m.k]; if (!U) return; c.arenaGear = c.arenaGear || {};
    const lv = (c.arenaGear[m.k] || 0) + 1; if (lv > U.max) return;
    if (ap() < U.ap(lv)) return say(p, `Нужно ${U.ap(lv)} очков арены.`, 'warn');
    c.ap -= U.ap(lv); c.arenaGear[m.k] = lv; say(p, `🛡 ${U.name} — ступень ${lv}.`, 'good');
  } else if (m.type === 'arenaBuy') {
    const it = D.ARENA_SHOP[m.k]; if (!it) return;
    if (ap() < it.ap) return say(p, `Нужно ${it.ap} очков арены.`, 'warn');
    c.ap -= it.ap; if (m.k === 'tamer') c.tamer = (c.tamer || 0) + 1; say(p, `Куплено: ${it.name}.`, 'good');
  } else if (m.type === 'gladBout') return startBout(p, amph, m);
  p.dirtyChar = true;
}

// ---------- Бой своих бойцов (раб-гладиатор и/или лев) против гладиаторов арены ----------
const FOES = ['glad_murmillo', 'glad_retiarius', 'glad_thraex'];
export function gladPower(s) { const g = D.SLAVE_GRADES[slaveGrade(s)].glad, lv = s.glvl || 0, T = D.SLAVE_TRAITS[s.trait] || {}; return { hp: Math.round(140 * g * (1 + lv * 0.12) * (1 + (s.ga || 0) * 0.12) * (T.hp || 1) * (1 + ((s.end || 5) - 5) * 0.03)), dmg: Math.round(14 * g * (1 + lv * 0.08) * (1 + (s.gw || 0) * 0.1) * (T.glad || 1) * (1 + ((s.str || 5) - 5) * 0.03)) }; }
function startBout(p, amph, m) {
  const c = p.char;
  if (G.arena) return say(p, 'На арене уже идёт бой.', 'warn');
  const s = m.sid != null && G.W.slaves.find((x) => x.id === m.sid && x.owner === c.id);
  const lion = m.lion != null && (c.lions || []).find((x) => x.id === m.lion);
  if (!s && !lion) return;
  if (s && (s.rest || 0) > now()) return say(p, `${s.name} ещё не оправился от ран (${Math.ceil(s.rest - now())} с).`, 'warn');
  if (s && slaveGrade(s) < 2 && (s.glvl || 0) < 2) return say(p, `${s.name} слишком слаб для арены: нужен раб 2-го разряда и выше или тренировка в школе гладиаторов до 2 уровня.`, 'warn');
  const ry = amph.ry || 0, A = { x: amph.x, z: amph.z, rx: 32.4, rz: 21.6, ry };
  G.arena = { bid: amph.id, x: amph.x, z: amph.z, rx: 32.4, rz: 21.6, ry, mode: 'bout', fighters: new Set(), bets: [], state: 'fight', t: now() + 150, owner: c.id, by: c.name, allies: [], foes: [], slave: s ? s.id : null, lion: lion ? lion.id : null };
  const a = G.arena, side = (k) => ({ x: A.x + Math.cos(ry) * 12 * k, z: A.z - Math.sin(ry) * 12 * k });
  const L = side(-1), Rr = side(1);
  if (s) { const pw = gladPower(s); const mm = spawnMob('glad_slave', L.x, L.z, { lvl: 1, leash: 99 }); mm.maxHp = mm.hp = pw.hp; mm.dmg = pw.dmg; mm.arena = A; mm.ownerName = c.name; mm.title = s.name; a.allies.push(mm.id); }
  if (lion) { const mm = spawnMob('lion_tamed', L.x + 3, L.z + 3, { lvl: lion.lvl || 1, leash: 99 }); mm.arena = A; a.allies.push(mm.id); }
  const grade = s ? slaveGrade(s) : 2, lv = s ? s.glvl || 0 : 2, nFoes = 1 + (grade >= 3 ? 1 : 0) + (lion && s ? 1 : 0);
  for (let i = 0; i < nFoes; i++) { const f = spawnMob(pick(FOES), Rr.x + i * 2.5, Rr.z + i * 2.5, { lvl: 1 + Math.round(grade * 1.5 + lv * 0.6), leash: 99 }); f.arena = A; a.foes.push(f.id); }
  announce('games',`🏟 ${c.name} выставил(а) на арену: ${[s && s.name, lion && 'льва ' + lion.name].filter(Boolean).join(' и ')}! Делайте ставки.`, 'warn');
  fx({ kind: 'horn', x: A.x, z: A.z });
}
export function boutTick(a) { // вызывается из arenaTick; true — бой окончен
  const t = now();
  const alive = (ids) => ids.filter((id) => { const m = G.mobs.get(id); return m && m.hp > 0; });
  const al = alive(a.allies), fo = alive(a.foes);
  if (al.length && fo.length && t < a.t) return false;
  const owner = Object.values(G.chars).find((c) => c.id === a.owner), win = al.length > 0 && fo.length === 0;
  const s = a.slave && G.W.slaves.find((x) => x.id === a.slave);
  const p = [...G.players.values()].find((q) => q.char && q.char.id === a.owner);
  if (owner) {
    if (win) { const pts = 6 + (s ? slaveGrade(s) * 2 : 4); owner.ap = (owner.ap || 0) + pts; owner.den += 30 + pts * 5; if (s) { s.gxp = (s.gxp || 0) + 40; while ((s.glvl || 0) < 10 && s.gxp >= gladNeed(s.glvl || 0)) { s.gxp -= gladNeed(s.glvl || 0); s.glvl = (s.glvl || 0) + 1; } } if (p) { say(p, `🏆 Победа на арене! +${pts} очков арены.`, 'good'); grantDig(p, 4); } log(`🏟 Бойцы ${owner.name} победили на арене!`, 'good'); }
    else { if (s) s.rest = t + 180; if (p) say(p, 'Ваши бойцы проиграли. Гладиатор ранен и 3 минуты отдыхает.', 'warn'); log('🏟 Бойцы арены одержали верх.', 'info'); }
  }
  for (const id of [...a.allies, ...a.foes]) G.mobs.delete(id);
  if (p) p.dirtyChar = true;
  G.dirtyWorld = true;
  return true;
}
export function gladTick(t) { kneelTick(t); }

// ---------- Великие игры: раз в 3 дня, даже без игроков — один бой «все против всех», победитель — последний на песке ----------
const NPC_GLADS = [['glad_murmillo', 'Мирмиллон Кальв'], ['glad_retiarius', 'Ретиарий Нерей'], ['glad_thraex', 'Фракиец Спиклон'], ['glad_murmillo', 'Мирмиллон Атрокс'], ['glad_thraex', 'Фракиец Тетраит']];
export function gamesTick() {
  const W = G.W; if (W.gamesDay == null) W.gamesDay = Math.ceil((W.day || 1) / 3) * 3;
  const A = G.arena;
  if (A && A.mode === 'games') return gamesRun(A);
  if (A || W.day < W.gamesDay || D.dayClock(W.time) < 12) return;
  const amph = builtOf('amphitheatrum').find((b) => !b.ruined && b.city === 'messana') || builtOf('amphitheatrum').find((b) => !b.ruined);
  W.gamesDay = W.day + 3;
  if (!amph) { log('🏟 Великие игры не состоялись: арена в руинах. Восстановите Амфитеатр!', 'warn'); return; }
  // лучшие рабы-гладиаторы всех граждан (даже тех, кто не в игре) + гладиаторы арены
  const cand = W.slaves.filter((x) => !x.hired && !x.ship && !x.squad && (x.rest || 0) < now() && ((x.glvl || 0) >= 1 || slaveGrade(x) >= 2)).map((x) => ({ x, pw: gladPower(x) })).sort((a, b) => b.pw.hp * b.pw.dmg - a.pw.hp * a.pw.dmg).slice(0, 6);
  const list = cand.map(({ x, pw }) => ({ key: 's' + x.id, name: x.name, owner: (G.chars[x.owner] || {}).name || '?', sid: x.id, hp: pw.hp, dmg: pw.dmg, type: 'glad_slave' }));
  for (let i = 0; list.length < 4 && i < NPC_GLADS.length; i++) list.push({ key: 'n' + i, name: NPC_GLADS[i][1], owner: 'арена', type: NPC_GLADS[i][0], lvl: 6 + W.day });
  G.arena = { bid: amph.id, x: amph.x, z: amph.z, rx: 32.4, rz: 21.6, ry: amph.ry || 0, mode: 'games', fighters: new Set(), bets: [], state: 'prep', t: now() + (process.env.FAST === '1' ? 12 : 60), list, ffa: nid(), mobs: [] };
  announce('games',`🏟 ВЕЛИКИЕ ИГРЫ в Амфитеатре! Бой «все против всех»: ${list.map((g) => g.name).join(', ')}. Ставки — 60 секунд (E у Амфитеатра).`, 'warn');
  chronicle('Начались Великие игры'); G.dirtyWorld = true;
}
function gamesRun(a) {
  const t = now(), A = { x: a.x, z: a.z, rx: a.rx, rz: a.rz, ry:a.ry };
  if (a.state === 'prep') {
    if (t < a.t) return;
    a.state = 'fight'; a.t = t + (process.env.FAST === '1' ? 40 : 240);
    a.list.forEach((g, i) => { const ang = i / a.list.length * Math.PI * 2, x = a.x + Math.sin(ang) * 14, z = a.z + Math.cos(ang) * 10;
      const m = spawnMob(g.type, x, z, { lvl: g.lvl || 1, leash: 99 }); if (!m) return; if (g.hp) { m.maxHp = m.hp = g.hp; m.dmg = g.dmg; } m.arena = A; m.ffa = a.ffa; m.title = g.name; m.gkey = g.key; a.mobs.push(m.id); });
    fx({ kind: 'horn', x: a.x, z: a.z }); announce('games','🏟 Великие игры: бой начался!', 'warn'); return;
  }
  const alive = a.mobs.map((id) => G.mobs.get(id)).filter((m) => m && m.hp > 0);
  if (alive.length > 1 && t < a.t) return;
  const win = alive.sort((x, y) => y.hp / y.maxHp - x.hp / x.maxHp)[0], g = win && a.list.find((q) => q.key === win.gkey);
  // ставки: весь банк делят поставившие на победителя (ланисте — 10%), иначе банк — в казну
  const pool = a.bets.reduce((s2, b) => s2 + b.amt, 0), wins = a.bets.filter((b) => g && b.on === g.key), wsum = wins.reduce((s2, b) => s2 + b.amt, 0), cut = holderOf('lanista', cityOf(a)) ? Math.round(pool * 0.1) : 0;
  for (const b of wins) { const p = G.players.get(b.pid); const n = Math.round((pool - cut) * b.amt / wsum); if (p) { p.char.den += n; book(p.char, 'Ставки', n); send(p, { type: 'log', text: `🏟 Ставка на ${g.name} сыграла: +${n} ден.`, kind: 'good' }); p.dirtyChar = true; } }
  if (!wins.length) G.W.treasury += pool - cut;
  if (cut) { const L = G.chars[holderOf('lanista', cityOf(a)).id]; if (L) { L.den += cut; book(L, 'Доля ланисты', cut); } }
  for (const x of G.W.slaves) if (a.list.some((q) => q.sid === x.id) && (!g || g.sid !== x.id)) x.rest = t + 180; // проигравшие — ранены, не убиты
  if (g) {
    if (g.sid != null) { const x = G.W.slaves.find((q) => q.id === g.sid), o = x && G.chars[x.owner]; if (x) { x.gw = x.gw || 0; x.gxp = (x.gxp || 0) + 120; x.gamesWon = (x.gamesWon || 0) + 1; while ((x.glvl || 0) < 10 && x.gxp >= gladNeed(x.glvl || 0)) { x.gxp -= gladNeed(x.glvl || 0); x.glvl = (x.glvl || 0) + 1; } } if (o) { o.den += 300; book(o, 'Победа на Великих играх', 300); o.ap = (o.ap || 0) + 20; } }
    G.W.gamesLog = [{ day: G.W.day, name: g.name, owner: g.owner }, ...(G.W.gamesLog || [])].slice(0, 10);
    log(`🏆 Победитель Великих игр — ${g.name} (${g.owner})!${g.sid != null ? ' Хозяину — 300 ден. и 20 очков арены.' : ''}`, 'good'); chronicle(`Великие игры выиграл ${g.name} (${g.owner})`);
  } else log('🏟 Великие игры окончились без победителя.', 'info');
  for (const id of a.mobs) G.mobs.delete(id);
  G.arena = null; G.dirtyWorld = true;
}
