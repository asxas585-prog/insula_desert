import { encounterLevel } from './balance.js';
import { hasCityOffice, cityOf } from './access.js';
// Общество и мир: должности и выборы, законы, события Рима и Карфагена, вражеские корабли,
// задания, сюжет, арена, подземелья
import * as RT from './routes.js';
import { G, D, WG, now, dist, rand, randi, pick, nid, angDiff, send, broadcast, log, fx, chronicle, addRes, takeRes, addGear, derivedOf, rankOf, hasOffice, officesOf, officeHolds, cityOff, romanCities, cityNear, holderOf } from './state.js';
import { grantXp, grantDig, spawnMob, dropItem, killPlayer, shoot, nearestBuildingFor } from './combat.js';
import { builtOf, hasBuilt, riders, shipById, sellPrice, collect } from './economy.js';

const { CFG, OFFICES, LAWS, BUILDINGS, RES, GEAR, ENEMIES, INSTANCES, STORY, ENEMY_SHIPS, ISLANDS, QUALITY } = D;
const W = () => G.W;
const playerByChar = (cid) => [...G.players.values()].find((q) => q.char && q.char.id === cid);
const isOffice = (p, k) => !!p.char && hasCityOffice(p.char, k, cityOf(p));
const forum = () => builtOf('forum')[0];
const atForum = (p) => builtOf('forum').some((f) => dist(p, f) < BUILDINGS[f.type].r + 12); // весь форум, в том числе у ростр (там открывается окно форума)
const ev = (kind) => W().events.find((e) => e.kind === kind && e.until > now());

// ---------- Должности и выборы: в каждом римском городе свои ----------
// форум, у которого стоит игрок → id города (или null)
const forumCity = (p) => { const f = [...builtOf('forum'), ...builtOf('forum_m')].find((f) => dist(p, f) < BUILDINGS[f.type].r + 12); return f ? (f.city || 'messana') : null; };
const cname = (cid) => (G.world.cities.find((C) => C.id === cid) || {}).name || cid;
export function voteWeight(c) { return D.RANKS[rankOf(c)].vote * (1 + (c.stats.cha || 0) * 0.05); }
export function electionTick() {
  const w = W(), t = w.time;
  const cities = romanCities().filter((C) => [...builtOf('forum'), ...builtOf('forum_m')].some((f) => (f.city || 'messana') === C.id));
  for (const [cid, o] of Object.entries(w.cityOff || {})) if (o.election && !cities.some((C) => C.id === cid)) o.election = null; // город без форума (руины) — его выборы не держат остальные
  if (!cities.length) return;
  if (t >= w.electionAt && G.players.size && !cities.some((C) => cityOff(C.id).election)) {
    for (const C of cities) cityOff(C.id).election = { ends: now() + (process.env.FAST === '1' ? 60 : 240), offices: Object.fromEntries(Object.keys(OFFICES).map((k) => [k, { cands: {} }])) };
    w.electionAt = w.time + CFG.electionEvery;
    log(`🗳 Начались выборы должностных лиц (${cities.map((C) => C.name).join(', ')}) — у каждого города свои! Выдвигайтесь и голосуйте на форуме своего города (4 минуты).`, 'warn');
    G.dirtyWorld = true;
  }
  for (const C of cities) {
    const co = cityOff(C.id), E = co.election; if (!E || now() < E.ends) continue;
    const res = [];
    for (const [k, o] of Object.entries(E.offices)) {
      const list = Object.entries(o.cands).map(([cid, c]) => [cid, c.name, Object.values(c.votes).reduce((a, v) => a + v, 0)]).sort((a, b) => b[2] - a[2] || Math.random() - 0.5);
      if (!list.length) continue;
      const [cid, name] = list[0], ch = G.chars[cid];
      { const mine = ch ? officeHolds(ch).filter((h) => !(h.city === C.id && h.k === k)) : []; if (mine.length >= D.MAX_OFFICES) delete cityOff(mine[0].city).offices[mine[0].k]; } // не больше двух должностей: самая старая уступается
      co.offices[k] = { id: cid, name, since: Date.now() };
      res.push(`${OFFICES[k].name}: ${name}`);
      const q = playerByChar(cid); if (q) grantDig(q, 25);
    }
    co.election = null; for (const q of G.players.values()) q.dirtyChar = true;
    log(res.length ? `🏛 Итоги выборов (${C.name}) — ` + res.join('; ') : `Выборы в городе ${C.name} прошли без кандидатов.`, 'good');
    if (res.length) chronicle(`Выборы (${C.name}): ` + res.join('; '));
    G.dirtyWorld = true;
  }
}
export function candidate(p, office) {
  const cid0 = forumCity(p); if (!cid0) return; const e = cityOff(cid0).election; if (!e || !OFFICES[office]) return;
  if (rankOf(p.char) < OFFICES[office].minRank) return send(p, { type: 'log', text: `Нужно звание «${D.RANKS[OFFICES[office].minRank].name}».`, kind: 'warn' });
  const O = OFFICES[office];
  if((p.char.officePoints?.[cid0]||0)<O.minOfficePoints)return send(p,{type:'log',text:`Нужно ${O.minOfficePoints} очков должности в ${cname(cid0)}. Выполняйте поручения форума и гавани этого города.`,kind:'warn'});
  if (O.minMil && D.milIdx(p.char.milPts || 0) < O.minMil) return send(p, { type: 'log', text: `Нужно военное звание «${D.MIL_RANKS[O.minMil].name}».`, kind: 'warn' });
  if (O.minTrade && ((p.char.stats2 && p.char.stats2.traded) || 0) < O.minTrade) return send(p, { type: 'log', text: `Нужен торговый оборот ${O.minTrade} ден. (у вас ${Math.round((p.char.stats2 && p.char.stats2.traded) || 0)}).`, kind: 'warn' });
  // у игрока — не больше двух должностей во всех городах: выдвигаться можно на столько, сколько ещё свободно
  const held = officeHolds(p.char).filter((h) => !(h.city === cid0 && h.k === office)).length;
  const running = romanCities().reduce((a, C) => { const E = cityOff(C.id).election; return a + (E ? Object.entries(E.offices).filter(([k, o]) => !(C.id === cid0 && k === office) && o.cands[p.char.id]).length : 0); }, 0);
  if (held + running >= D.MAX_OFFICES) return send(p, { type: 'log', text: `Должностей у одного человека — не больше ${D.MAX_OFFICES} во всех городах (вместе с теми, на которые вы уже выдвинулись). Снимите выдвижение или сложите одну.`, kind: 'warn' });
  e.offices[office].cands[p.char.id] = { name: p.char.name, votes: {} };
  log(`${p.char.name} выдвигается на должность: ${OFFICES[office].name} (${cname(cid0)})`, 'info');
  G.dirtyWorld = true;
}
export function vote(p, office, cid) {
  const c0 = forumCity(p); if (!c0) return; const e = cityOff(c0).election; if (!e || !e.offices[office]) return;
  const o = e.offices[office]; if (!o.cands[cid]) return;
  for (const c of Object.values(o.cands)) delete c.votes[p.char.id];
  if (!e.voted) e.voted = {}; if (!e.voted[p.char.id]) { e.voted[p.char.id] = 1; grantDig(p, 5); send(p, { type: 'log', text: '🗳 За участие в выборах Рим одобряет вас (+5).', kind: 'good' }); }
  o.cands[cid].votes[p.char.id] = voteWeight(p.char) * (hasCityOffice(p.char, 'senator', c0) ? 2 : 1);
  G.dirtyWorld = true;
}
// сложить полномочия: only — «город:должность» или просто должность (во всех городах)
export function resign(p, only) {
  const [oc, ok] = only && String(only).includes(':') ? String(only).split(':') : [null, only];
  for (const h of officeHolds(p.char)) if ((!ok || ok === h.k) && (!oc || oc === h.city)) { delete cityOff(h.city).offices[h.k]; log(`${p.char.name} слагает полномочия: ${OFFICES[h.k].name} (${cname(h.city)})`, 'info'); }
  G.dirtyWorld = true; p.dirtyChar = true;
}
export function callElection(p) {
  const cid = forumCity(p); if (!cid || romanCities().some((C) => cityOff(C.id).election)) return;
  if (W().time < W().electionAt - CFG.electionEvery + 300) return send(p, { type: 'log', text: 'Досрочные выборы можно объявить не раньше чем через 5 минут после прошлых.', kind: 'warn' });
  W().electionAt = W().time; electionTick();
}

// ---------- Законы: в каждом городе свои; должность предлагает законы своего ведомства, префект и сенатор — любые ----------
export function canPropose(c, cid, key) {
  const offs = cityOff(cid).offices || {}, mine = Object.entries(offs).filter(([, h]) => h && h.id === c.id).map(([k]) => k);
  if (mine.includes('praefectus') || mine.includes('senator')) return true;
  if (mine.some((k) => (D.LAW_AREA[key] || []).includes(k))) return true;
  return !offs.praefectus && !offs.senator && rankOf(c) >= 1 && !(D.LAW_AREA[key] || []).some((k) => offs[k]); // нет ни префекта, ни сенатора, ни ведомства — может любой от Плебея
}
export function proposeLaw(p, key, opt) {
  const cid = forumCity(p); if (!LAWS[key] || !cid) return;
  const co = cityOff(cid); if (co.lawVote) return;
  opt = Math.max(0, Math.min(LAWS[key].opts.length - 1, opt | 0));
  if (!canPropose(p.char, cid, key)) return send(p, { type: 'log', text: `Закон «${LAWS[key].name}» в городе ${cname(cid)} предлагают: ${(D.LAW_AREA[key] || []).map((k) => OFFICES[k].name).join(', ')}, а также префект и сенатор (если их нет — любой от Плебея).`, kind: 'warn' });
  if ((co.laws[key] ?? LAWS[key].def ?? 0) === opt) return;
  co.lawVote = { key, opt, by: p.char.name, ends: now() + (process.env.FAST === '1' ? 30 : 90), votes: {} };
  log(`📜 ${p.char.name} предлагает закон (${cname(cid)}): «${LAWS[key].name}» → ${LAWS[key].opts[opt]}. Голосуйте на форуме города!`, 'warn');
  G.dirtyWorld = true;
}
export function lawVote(p, yes) {
  const cid = forumCity(p) || (G.players.size <= 1 ? cityNear(p.x, p.z) : null);
  if (!cid) return send(p, { type: 'log', text: 'Голосовать можно на форуме города.', kind: 'warn' });
  const v = cityOff(cid).lawVote; if (!v) return;
  v.votes[p.char.id] = { w: voteWeight(p.char), yes: !!yes };
  G.dirtyWorld = true;
}
export function lawTick() {
  for (const C of romanCities()) {
    const co = cityOff(C.id), v = co.lawVote; if (!v || now() < v.ends) continue;
    let y = 0, n = 0; for (const x of Object.values(v.votes)) (x.yes ? (y += x.w) : (n += x.w));
    co.lawVote = null;
    if (y > n) { co.laws[v.key] = v.opt; log(`📜 Закон принят (${C.name}): «${LAWS[v.key].name}» — ${LAWS[v.key].opts[v.opt]} (за ${y.toFixed(1)}, против ${n.toFixed(1)})`, 'good'); chronicle(`${C.name}: принят закон «${LAWS[v.key].name}: ${LAWS[v.key].opts[v.opt]}»`); }
    else log(`📜 Закон отклонён (${C.name}): «${LAWS[v.key].name}» (за ${y.toFixed(1)}, против ${n.toFixed(1)})`, 'info');
    G.dirtyWorld = true;
  }
}

// ---------- Действия должностей ----------
export function officeAct(p, m) {
  const w = W(), c = p.char, cid = cityOf(p);
  if (!forumCity(p)) return send(p, { type: 'log', text: 'Городские распоряжения — на форуме своего города.', kind: 'warn' });
  switch (m.act) {
    case 'reward': {
      if (!isOffice(p, 'praefectus')) return;
      const q = playerByChar(m.to); const n = Math.max(1, Math.min(200, m.n | 0, w.treasury));
      if (!q || !n) return; w.treasury -= n; q.char.den += n; q.dirtyChar = true;
      log(`🏛 Префект ${c.name} наградил(а) ${q.char.name}: ${n} денариев из казны`, 'good'); break;
    }
    case 'priority': if (!isOffice(p, 'praefectus') || !BUILDINGS[m.bt]) return; w.priority = m.bt; log(`🏛 Префект объявил приоритетную стройку: ${BUILDINGS[m.bt].name} (двойное достоинство за вклад)`, 'info'); break;
    case 'hire': {
      if (!isOffice(p, 'legatus')) return;
      if (!builtOf('castra').some(b => cityOf(b) === cid)) return send(p, { type: 'log', text: 'Нужны Казармы.', kind: 'warn' });
      const cap = 4 + builtOf('turris').filter(b => cityOf(b) === cid).length;
      const co = cityOff(cid); co.garrison ||= 0;
      if (co.garrison >= cap) return send(p, { type: 'log', text: `Предел гарнизона: ${cap} (каждая башня +1).`, kind: 'warn' });
      if (w.treasury < 100) return send(p, { type: 'log', text: 'В казне нужно 100 денариев.', kind: 'warn' });
      w.treasury -= 100; co.garrison++; w.watch ||= {}; const watch = w.watch[cid] ||= { n: 2, lvl: 0, live: [] }; watch.n++; log(`🦅 Легат ${c.name} нанял легионера в гарнизон (${co.garrison}/${cap})`, 'good'); break;
    }
    case 'muster': {
      if (!isOffice(p, 'legatus') || (p.musterT && now() - p.musterT < 180)) return;
      p.musterT = now(); G.muster = { city: cid, x: p.x, z: p.z, until: now() + 60, by: c.name, got: new Set() };
      log(`🦅 Легат ${c.name} объявляет сбор! Подойдите к нему за 60 секунд — +опыт и +10% урона на 3 минуты.`, 'warn'); break;
    }
    case 'convoy': {
      if (!isOffice(p, 'magister') || !builtOf('portus').some(b => cityOf(b) === cid)) return;
      if (w.convoyAt && now() < w.convoyAt) return send(p, { type: 'log', text: 'Следующий обоз — позже.', kind: 'warn' });
      const res = m.res; if (!RES[res]) return;
      const n = Math.min(150, Math.floor(w.storage[res] || 0)); if (!n) return;
      const price = RES[res].p * (D.PORTS.ostia.mult[res] || 1.1) * (0.85 + w.favor / 333);
      w.storage[res] -= n; const gain = Math.round(n * price); w.treasury += gain; w.convoyAt = now() + 600;
      log(`⚖ Магистр ${c.name} отправил обоз в Рим: ${n} ${RES[res].name} → +${gain} денариев в казну`, 'good'); grantDig(p, 10); break;
    }
  }
  G.dirtyWorld = true;
}
export function musterTick() {
  const M = G.muster; if (!M) return;
  if (now() > M.until) { G.muster = null; return; }
  for (const p of G.players.values()) if (p.char && cityOf(p) === M.city && !M.got.has(p.id) && dist(p, M) < 20) { M.got.add(p.id); grantXp(p, 30); p.buffs.muster = now() + 180; send(p, { type: 'log', text: 'Вы явились на сбор легата: +10% урона на 3 минуты.', kind: 'good' }); }
}

// ---------- События мира ----------
export function eventsTick() {
  if (![...G.players.values()].some(p => p.char && !p.bot)) return;
  const w = W(), t = now();
  // угроза растёт
  w.threat = Math.min(100, w.threat + CFG.threatGrow / 60 * (w.laws.open_port ? 2 : 1) * (1 / 1));
  w.favor += (50 - w.favor) * 0.0005;
  // запросы Рима: просрочка
  for (const r of w.requests) if (!r.done && t > r.until) {
    r.done = true; w.favor = Math.max(0, w.favor - 10); const fine = Math.min(w.treasury, 80); w.treasury -= fine;
    log(`🦅 Рим недоволен: запрос «${RES[r.res].name}» не выполнен. Расположение Рима падает, штраф ${fine} денариев.`, 'bad');
  }
  w.requests = w.requests.filter((r) => !r.done || t - r.until < 30);
  w.events = w.events.filter((e) => e.until > t || e.kind === 'raid' && e.live);
  // набеги: проверяем, остались ли налётчики
  for (const e of w.events) if (e.kind === 'raid' && e.live) {
    const alive = [...G.mobs.values()].some((m) => m.hp > 0 && m.src && m.src.raid === e.id);
    const shipsLeft = [...G.eships.values()].some((s) => s.raid === e.id && !s.landed);
    if (!alive && !shipsLeft && t > e.start + 5) { if (e.retreated && ![...G.eships.values()].some((s) => s.raid === e.id && !s.retreated)) { e.live = false; e.until = t; G.dirtyWorld = true; } else if (!e.retreated) raidWon(e); }
    else if (t > e.start + (e.dur || 900)) { e.live = false; e.until = t; for (const m of G.mobs.values()) if (m.src && m.src.raid === e.id) G.mobs.delete(m.id); log(e.foe === 'barb' ? '🏃 Варвары за 5 минут не взяли своё и ушли в леса.' : 'Налётчики отступили.', 'info'); }
  }
  if (w.time < w.nextEvent) return;
  w.nextEvent = w.time + rand(...CFG.eventEvery) * (process.env.FAST === '1' ? 0.4 : 1);
  startRandomEvent(); // события идут и когда на сервере никого нет
}
export function startRandomEvent(force) {
  const w = W();
  const opts = [];
  if (forum()) opts.push(['rome', 3]);
  opts.push(['barb', w.day >= 1 ? 1 : 0], ['storm', 1], ['tuna', 1.2]);
  if (hasBuilt('portus')) opts.push(['merchant', 1.5]);
  if (w.ships.length) opts.push(['pirates', 1.2]);
  if (w.day >= 2 || w.threat > 25) opts.push(['punic', 0.5 + w.threat / 30]);
  if (builtOf('forum').length && w.buildings.filter((b) => b.built && BUILDINGS[b.type].pub && !BUILDINGS[b.type].road).length >= 4) opts.push(['inspect', 0.6]);
  let kind = force;
  if (!kind) { const sum = opts.reduce((a, [, v]) => a + v, 0); let r = Math.random() * sum; for (const [k, v] of opts) { r -= v; if (r <= 0) { kind = k; break; } } }
  const t = now();
  switch (kind) {
    case 'rome': {
      const q = pick(D.ROME_REQUESTS), n = randi(...q.n);
      const r = { id: nid(), res: q.res, n, got: 0, den: q.den, until: t + 900, contrib: {} };
      w.requests.push(r);
      log(`🦅 Запрос Рима: доставить на Форум ${n} × ${RES[q.res].name} за 15 минут. Награда — денарии в казну и расположение Рима.`, 'warn');
      break;
    }
    case 'barb': barbarianRaid(); break;
    case 'punic': punicRaid(); break;
    case 'storm': w.events.push({ id: nid(), kind: 'storm', title: 'Шторм', text: 'Ветер и дождь: корабли медленнее, видимость хуже.', until: t + 200 }); log('⛈ Надвигается шторм! Корабли идут медленнее, на мели легко разбиться.', 'warn'); break;
    case 'tuna': w.events.push({ id: nid(), kind: 'tuna', title: 'Ход тунца', text: 'Косяки тунца у островов — лучшее время для рыбалки.', until: t + 360 }); log('🐟 Рыбаки кричат: к островам подошёл тунец! Косяки видно на воде.', 'good'); break;
    case 'merchant': w.events.push({ id: nid(), kind: 'merchant', title: 'Купцы из Александрии', text: 'На рынке редкое снаряжение.', until: t + 480 }); log('⛵ В гавань вошёл александрийский купеческий флот: на рынке редкое оружие и доспехи (8 минут).', 'good'); break;
    case 'pirates': pirateAttack(); break;
    case 'inspect': {
      const pubs = w.buildings.filter((b) => b.built && !b.ruined && BUILDINGS[b.type].pub && !BUILDINGS[b.type].road).length, ruined = w.buildings.filter((b) => b.ruined).length;
      const ok = pubs >= 5 && ruined === 0;
      w.favor = Math.max(0, Math.min(100, w.favor + (ok ? 10 : -6))); if (ok) w.treasury += pubs * 40;
      log(ok ? `🦅 Легат из Рима осмотрел колонию и остался доволен: +${pubs * 40} денариев в казну, расположение Рима растёт.` : '🦅 Легат из Рима осмотрел колонию: разрушенные здания и мало общественных построек. Расположение Рима падает.', ok ? 'good' : 'bad');
      chronicle(ok ? 'Инспекция Рима: колония в порядке' : 'Инспекция Рима: недовольство');
      break;
    }
  }
  G.dirtyWorld = true;
}
export function romeDeliver(p, rid, fromStore) {
  const w = W(), r = w.requests.find((x) => x.id === rid && !x.done); if (!r) return;
  const f = forum(); if (!f || dist(p, f) > 30) return send(p, { type: 'log', text: 'Сдавать запросы Рима — на Форуме.', kind: 'warn' });
  const left = r.n - r.got; let k;
  if (fromStore) { k = Math.min(left, Math.floor(w.storage[r.res] || 0)); w.storage[r.res] -= k; }
  else k = takeRes(p.char, r.res, left);
  if (!k) return send(p, { type: 'log', text: 'Нечего сдавать.', kind: 'warn' });
  r.got += k; r.contrib[p.char.id] = (r.contrib[p.char.id] || 0) + k;
  if (!fromStore) { p.char.den += Math.round(k * r.den * 0.4); grantXp(p, k * 2); }
  if (r.got >= r.n) {
    r.done = true; const gain = Math.round(r.n * r.den * 0.6); w.treasury += gain; w.favor = Math.min(100, w.favor + 8);
    log(`🦅 Запрос Рима выполнен: ${r.n} × ${RES[r.res].name}! +${gain} денариев в казну, Рим доволен.`, 'good');
    chronicle(`Колония выполнила запрос Рима (${RES[r.res].name})`);
    for (const [cid, n] of Object.entries(r.contrib)) { const q = playerByChar(cid); if (q) grantDig(q, 5 + Math.round(n * 0.3)); }
  }
  p.dirtyChar = true; G.dirtyWorld = true;
}
// варвары
function barbarianRaid() {
  const w = W();
  // набег идёт из конкретного лагеря варваров на Сицилии; разгромленный лагерь ~40 мин не нападает, каждый лагерь — не чаще раза в 20 мин
  const t0 = now(), cst = (c) => (w.camps[c.id] = w.camps[c.id] || {});
  const camps = G.world.camps.filter((c) => !c.punic && !c.pirate && c.island === 'main' && !(cst(c).destroyedAt && t0 - cst(c).destroyedAt < D.BARB_CALM) && t0 - (cst(c).raidAt || 0) > D.BARB_CAMP_CD);
  const targets = w.buildings.filter((b) => b.built && !b.ruined && !b.enemy && !BUILDINGS[b.type].road && !BUILDINGS[b.type].stall);
  if (!targets.length || !camps.length) return;
  const near = (c) => targets.reduce((m, b) => Math.min(m, Math.hypot(b.x - c.x, b.z - c.z)), 1e9);
  camps.sort((a, b) => near(a) - near(b)); // ближайший к римским постройкам лагерь (иногда — второй)
  const camp = camps.length > 1 && Math.random() < 0.3 ? camps[1] : camps[0]; cst(camp).raidAt = t0;
  const src = camp;
  const tgt = targets.sort((a, b) => dist(a, src) - dist(b, src))[0];
  const C0 = WG.CITY_LIST.reduce((a, c) => (Math.hypot(c.x - camp.x, c.z - camp.z) < Math.hypot(a.x - camp.x, a.z - camp.z) ? c : a)), ang = Math.atan2(camp.x - C0.x, -(camp.z - C0.z)), DIRS = ['к северу', 'к северо-востоку', 'к востоку', 'к юго-востоку', 'к югу', 'к юго-западу', 'к западу', 'к северо-западу'], dir = DIRS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
  const campName = `лагерь ${dir} от города ${C0.name}`;
  const e = { id: nid(), kind: 'raid', foe: 'barb', title: 'Набег варваров', camp: camp.id, cx: camp.x, cz: camp.z, text: `Из лагеря ${dir} от города ${C0.name} идут на «${BUILDINGS[tgt.type].name}»`, until: now() + 330, dur: 300, start: now() + 30, live: true, x: tgt.x, z: tgt.z };
  w.events.push(e);
  log(`🔥 Дозорные: варвары вышли из лагеря (${campName}) и идут на «${BUILDINGS[tgt.type].name}»${tgt.ownerName ? ` (${tgt.ownerName})` : ''}! Через 30 секунд, набег — 5 минут.`, 'bad');
  // варваров на одного больше, чем людей на сервере, но не больше 6 за раз
  const n = Math.min(6, [...G.players.values()].filter((q) => q.char && !q.bot).length + 1);
  setTimeout(() => {
    if (!G.W) return;
    const types = ['barb_warrior', 'barb_warrior', 'barb_spear', 'barb_archer'];
    const group = targets.filter((b) => !b.ruined && b.built && dist(b, tgt) < 90).sort((a, b) => dist(a, tgt) - dist(b, tgt)).slice(0, 3); // по 2 налётчика на здание — громят сразу несколько
    for (let i = 0; i < n; i++) {
      let x = src.x + rand(-8, 8), z = src.z + rand(-8, 8);
      if (WG.terrainHeight(x, z) < 0.5) { x = tgt.x + rand(-60, 60); z = tgt.z + 80; }
      spawnMob(i === n - 1 && encounterLevel() >= 6 && n >= 3 ? 'barb_chief' : pick(types), x, z, { lvl: encounterLevel(), goal: (group[Math.floor(i / 2) % (group.length || 1)] || tgt).id, leash: 9999, src: { kind: 'raid', raid: e.id } });
    }
  }, 30000);
}
// Карфаген: корабли с десантом
function punicRaid() {
  const w = W();
  const cols = w.buildings.filter((b) => b.type === 'colonia' && b.built && !b.ruined);
  const toColony = cols.length && Math.random() < 0.35;
  const target = toColony ? pick(cols) : (forum() || w.buildings.find((b) => b.built && !BUILDINGS[b.type].road));
  if (!target) return;
  const isl = WG.islandAt(target.x, target.z) || WG.islandById('main');
  // место высадки: берег острова со стороны цели, повернутый к югу
  let land = null;
  // город: высадка не в гавани, а на берегу за стенами — оттуда десант идёт к воротам (их можно запереть)
  const CT = !toColony && WG.CITY_LIST.find((c) => Math.hypot(target.x - c.x, target.z - c.z) < c.R + 10);
  if (CT) for (let i = 0; i < 80 && !land; i++) {
    const a = rand(0, Math.PI * 2), d = CT.R + 50 + rand(0, 110), px = CT.x + Math.sin(a) * d, pz = CT.z + Math.cos(a) * d;
    if (WG.terrainHeight(px, pz) < 1 || WG.waterEdgeDist(px, pz) < 6) continue;
    const sp = WG.seaApproach(px, pz, 0); if (!sp) continue;
    if (Math.hypot(sp.x - CT.x, sp.z - CT.z) > CT.R + 35 && Math.hypot(sp.x - CT.hx, sp.z - CT.hz) > 90 && Math.hypot(sp.x - px, sp.z - pz) < 160) land = sp;
  }
  for (let i = 0; i < 24 && !land; i++) { const sp = WG.seaApproach(target.x, target.z, i ? rand(-1.2, 1.2) : 0); if (sp && dist(sp, target) < (toColony ? 200 : 350)) land = sp; }
  if (!land) return;
  // десант не больше числа игроков на карте и не сильнее их среднего уровня
  const online = [...G.players.values()].filter((q) => q.char);
  const nPl = Math.max(1, online.length);
  const avgLvl = Math.max(1, Math.floor(online.reduce((a, q) => a + q.char.level, 0) / nPl) || 1);
  const ships = nPl >= 6 && w.threat > 70 ? 2 : 1;
  const perShip = Math.min(5, Math.ceil(nPl / ships));
  const lvl = Math.max(1, Math.min(avgLvl, 8, 2 + Math.floor(w.threat / 20) + Math.floor(w.day / 6)));
  const warn = 90 + (hasBuilt('pharos') ? 60 : 0);
  const e = { id: nid(), kind: 'raid', foe: 'punic', title: 'Флот Карфагена', text: `Карфагенские корабли идут к «${BUILDINGS[target.type].name}»`, until: now() + 420, dur: 420, start: now(), live: true, x: land.x, z: land.z };
  w.events.push(e);
  const a = land.a;
  for (let i = 0; i < ships; i++) {
    const d = Math.min(1500, warn * 9);
    let sx = land.x + Math.cos(a + (i - 1) * 0.15) * d, sz = land.z + Math.sin(a + (i - 1) * 0.15) * d;
    sx = Math.max(-CFG.world + 50, Math.min(CFG.world - 50, sx)); sz = Math.max(-CFG.world + 50, Math.min(CFG.world - 50, sz));
    spawnEnemyShip('punic_ship', sx, sz, { raid: e.id, land, target: target.id, lvl, crewN: Math.min(perShip, nPl - i * perShip), elephant: w.threat > 90 && nPl >= 5 && i === 0, officer: w.threat > 80 && nPl >= 3 && i === 0 });
  }
  log(`⚔ ${hasBuilt('pharos') ? 'Маяк заметил' : 'Дозорные заметили'} флот Карфагена: ${ships} ${ships > 1 ? 'корабля' : 'корабль'} идут к ${toColony ? 'колонии' : 'городу'}! Высадка примерно через ${Math.round(Math.min(1500, warn * 9) / 9)} секунд. Можно перехватить их в море! Через 7 минут флот уйдёт.`, 'bad');
  chronicle('Карфаген отправил флот в набег');
}
export function spawnEnemyShip(type, x, z, o = {}) {
  const def = ENEMY_SHIPS[type];
  const s = { id: nid(), type, def, x, z, ry: 0, hp: def.hp * (1 + (o.lvl || 1) * 0.04), maxHp: def.hp * (1 + (o.lvl || 1) * 0.04), speed: 0, raid: o.raid || null, land: o.land || null, target: o.target || null, lvl: o.lvl || 4, landed: false, elephant: !!o.elephant, officer: !!o.officer, crewN: o.crewN || 3, born: now(), mode: o.mode || 'raid', until: now() + (o.life || 1500), shotAt: 0 };
  G.eships.set(s.id, s);
  return s;
}
function pirateAttack() {
  const w = W();
  if ((w.pirateCalm || 0) > Date.now() / 1000) return;
  const sh = w.ships.filter((s) => !builtOf('portus').some((b) => dist(b, s) < 120));
  let x, z;
  if (sh.length) { const s = pick(sh); const a = rand(0, 6.28); x = s.x + Math.cos(a) * 260; z = s.z + Math.sin(a) * 260; }
  else { const c = w.buildings.find((b) => b.type === 'colonia'); if (!c) return; x = c.x + 250; z = c.z; }
  if (!WG.shipOk(x, z)) return;
  spawnEnemyShip('pirate_ship', x, z, { mode: 'hunt', lvl: encounterLevel(1), life: 600 });
  w.events.push({ id: nid(), kind: 'pirates', title: 'Пираты', text: 'Киликийские пираты охотятся за кораблями.', until: now() + 600 });
  log('🏴 Киликийские пираты замечены в море! Берегите корабли — или потопите их ради добычи.', 'bad');
}
// прямая по воде между точками (последние `skip` метров до цели не проверяем — там причал или берег высадки)
function seaClear(ax, az, bx, bz, skip = 0) { const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(Math.max(0, L - skip) / 12); for (let i = 1; i <= n; i++) { const k = Math.min(1, (i * 12) / (L || 1)); if (!WG.shipOk(ax + (bx - ax) * k, az + (bz - az) * k)) return false; } return true; }
export function updateEnemyShips(dt) {
  const t = now();
  for (const s of G.eships.values()) {
    const def = s.def;
    if (s.boarded) { s.speed = 0; continue; } // сцеплен абордажным мостиком
    let tx = null, tz = null;
    if (s.mode === 'raid' && !s.landed && s.land) { tx = s.land.x; tz = s.land.z; }
    else if (s.mode === 'hunt') {
      let best = null, bd = 400;
      const prey = s.prey && W().ships.find((x) => x.id === s.prey);
      if (prey) { best = prey; bd = dist(prey, s); } // пират гонится за кораблём с грузом
      else for (const ps of W().ships) { if (ps.berth) continue; const d = dist(ps, s); if (d < bd) { bd = d; best = ps; } }
      if (best) { tx = best.x; tz = best.z; if (bd < def.len && (!s.ramT || t - s.ramT > 3)) { s.ramT = t; best.hp -= 45; fx({ kind: 'ram', x: best.x, z: best.z }); for (const q of riders(best)) send(q, { type: 'log', text: 'Пираты таранят ваш корабль!', kind: 'bad' }); } }
    }
    if (s.mode === 'raid' && !s.landed && t > s.born + 300) { s.landed = true; s.leaveAt = t; retreat(s, false); }
    if (s.mode === 'raid' && s.landed && t > s.born + 420 && s.leaveAt > t) s.leaveAt = t; // флот Карфагена — не дольше 7 минут
    if (s.mode === 'trade' && s.dest) { tx = s.dest.x; tz = s.dest.z; if (Math.hypot(tx - s.x, tz - s.z) < 45) { G.eships.delete(s.id); continue; } }
    if (s.mode === 'flee') { const a = Math.atan2(s.x, s.z); tx = s.x + Math.sin(a) * 200; tz = s.z + Math.cos(a) * 200; }
    if (s.landed && t > s.leaveAt) {
      if (!s.retreated) retreat(s, true);
      tx = s.x + Math.sin(s.ry) * 100; tz = s.z + Math.cos(s.ry) * 100; if (t > s.leaveAt + 40) { G.eships.delete(s.id); continue; }
    }
    if (t > s.until) { G.eships.delete(s.id); continue; }
    if (tx != null) {
      // суша между кораблём и целью — плывём по морскому пути в обход островов
      const d0 = Math.hypot(tx - s.x, tz - s.z), clear = seaClear(s.x, s.z, tx, tz, s.mode === 'raid' ? 70 : 10);
      if (!clear) {
        if ((!s.path || Math.hypot(s.pathGoal[0] - tx, s.pathGoal[1] - tz) > 80) && t > (s.pathTry || 0)) { s.pathTry = t + 4; const pth = RT.seaPath(s, { x: tx, z: tz }); s.path = pth && pth.length ? pth : null; s.pi = 0; s.pathGoal = [tx, tz]; }
        if (s.path) { while (s.pi < s.path.length - 1 && Math.hypot(s.path[s.pi][0] - s.x, s.path[s.pi][1] - s.z) < 30) s.pi++; tx = s.path[s.pi][0]; tz = s.path[s.pi][1]; }
      } else s.path = null;
      let want = Math.atan2(tx - s.x, tz - s.z); const d = s.path ? d0 : Math.hypot(tx - s.x, tz - s.z);
      // впереди берег — заранее отворачиваем туда, где вода
      const look = def.len / 2 + 22, okAt = (a) => WG.shipOk(s.x + Math.sin(a) * look, s.z + Math.cos(a) * look) && WG.shipOk(s.x + Math.sin(a) * look * 0.5, s.z + Math.cos(a) * look * 0.5);
      if (!(s.mode === 'raid' && d < 90) && !okAt(want)) { for (const off of [0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 1.9, -1.9, 2.6, -2.6]) if (okAt(want + off)) { want += off; break; } }
      s.ry += Math.max(-0.5 * dt, Math.min(0.5 * dt, angDiff(want, s.ry)));
      s.speed = Math.min(def.speed, s.speed + dt * 1.5);
      // высадка у берега
      if (s.mode === 'raid' && !s.landed) {
        const ahead = WG.terrainHeight(s.x + Math.sin(s.ry) * (def.len / 2 + 6), s.z + Math.cos(s.ry) * (def.len / 2 + 6));
        if (d < 30 || ahead > -1.3 && d < 90) { landCrew(s); continue; }
      }
    } else s.speed = Math.max(0, s.speed - dt);
    const nx = s.x + Math.sin(s.ry) * s.speed * dt, nz = s.z + Math.cos(s.ry) * s.speed * dt;
    const bow = def.len / 2;
    if (WG.shipOk(nx, nz) && WG.shipOk(nx + Math.sin(s.ry) * bow, nz + Math.cos(s.ry) * bow) && WG.waterEdgeDist(nx + Math.sin(s.ry) * bow, nz + Math.cos(s.ry) * bow) > 6) { s.x = nx; s.z = nz; }
    else { s.ry += 0.9 * dt * (s.id % 2 ? 1 : -1) * 3; s.speed *= 0.6; s.pathTry = 0; if (s.mode === 'raid' && !s.landed && Math.hypot(s.land.x - s.x, s.land.z - s.z) < 150) landCrew(s); }
    // стрелки на борту
    if (t > s.shotAt) {
      s.shotAt = t + 2.2;
      for (const p of G.players.values()) if (p.alive && !p.inst && dist(p, s) < 35) { shoot({ x: s.x, z: s.z, y: 3, kind: s.type === 'pirate_ship' ? 'stone' : 'arrow', owner: -s.id, side: 'enemy', dmg: 9 + s.lvl, target: p }); break; }
    }
  }
}
// десант уходит: оставшиеся на берегу садятся на корабль, корабль уплывает
function retreat(s, landed) {
  s.retreated = true;
  let n = 0; for (const m of [...G.mobs.values()]) if (m.src && m.src.ship === s.id && m.hp > 0) { G.mobs.delete(m.id); n++; }
  const e = W().events.find((x) => x.id === s.raid); if (e) e.retreated = true;
  log(landed ? `⛵ Карфагеняне ${n ? 'вернулись на корабль' : 'бросили берег'} и уплывают.` : '⛵ Карфагенский корабль повернул назад.', 'info');
  G.dirtyWorld = true;
}
function landCrew(s) {
  s.landed = true; s.leaveAt = now() + 150; s.speed = 0;
  const land = s.land, w = W();
  const crew = s.def.crew.slice(0, Math.max(1, s.crewN));
  if (s.officer) crew[0] = 'punic_officer';
  if (s.elephant && crew.length > 1) crew[crew.length - 1] = 'war_elephant';
  for (const type of crew) {
    let x = land.x, z = land.z;
    for (let i = 0; i < 20; i++) { const xx = land.x + rand(-7, 7), zz = land.z + rand(-7, 7); if (WG.terrainHeight(xx, zz) > 0.4) { x = xx; z = zz; break; } }
    const goal = s.target && w.buildings.find((b) => b.id === s.target && b.built && !b.ruined) ? s.target : null;
    const m = spawnMob(type, x, z, { lvl: s.lvl, goal, leash: 9999, src: { kind: 'raid', raid: s.raid, ship: s.id } });
    if (m && !goal) m.goal = nearestBuildingFor(m);
  }
  log('⚔ Карфагеняне высадились на берег! К оружию!', 'bad');
  fx({ kind: 'horn', x: land.x, z: land.z });
}
let onEnemySunkHook = () => {};
export function setEnemySunkHook(fn) { onEnemySunkHook = fn; }
export function hitEnemyShip(s, dmg, p) {
  s.hp -= dmg;
  fx({ kind: 'shiphit', x: s.x, z: s.z, n: Math.round(dmg) });
  if (s.hp > 0) return;
  G.eships.delete(s.id);
  fx({ kind: 'sink', x: s.x, z: s.z, eship: s.id });
  try { onEnemySunkHook(s, p); } catch (e) { console.error(e); }
  const w = W();
  if (s.type === 'punic_ship') { w.threat = Math.max(0, w.threat - (s.landed ? 4 : 9)); log(`⚓ Карфагенский корабль потоплен${s.landed ? '' : ' вместе с десантом'}! Угроза снижена.`, 'good'); chronicle('Потоплен карфагенский корабль'); }
  else log('⚓ Пиратский корабль пошёл ко дну!', 'good');
  for (const q of G.players.values()) if (q.char && !q.inst && dist(q, s) < 120) { const den = randi(40, 90) + s.lvl * 5; q.char.den += den; grantXp(q, 80 + s.lvl * 6); grantDig(q, 8); send(q, { type: 'log', text: `Добыча с потопленного корабля: ${den} денариев`, kind: 'good' }); q.dirtyChar = true; }
  G.dirtyWorld = true;
}
function raidWon(e) {
  e.live = false; e.until = now();
  const w = W();
  if (e.foe === 'punic') { w.threat = Math.max(0, w.threat - 12); w.favor = Math.min(100, w.favor + 5); }
  log(`🏆 Набег отбит! ${e.foe === 'punic' ? 'Карфаген потерял десант, угроза снижена. ' : ''}Защитники получают награду.`, 'good');
  chronicle(e.foe === 'punic' ? 'Колония отбила высадку Карфагена' : 'Колония отбила набег варваров');
  for (const q of G.players.values()) if (q.char && !q.inst && dist(q, e) < 250) { const den = e.foe === 'punic' ? 80 : 40; q.char.den += den; grantXp(q, e.foe === 'punic' ? 150 : 70); grantDig(q, e.foe === 'punic' ? 20 : 10); questHook(q, 'defend', {}); q.dirtyChar = true; }
  G.dirtyWorld = true;
}

// ---------- Задания ----------
const QUEST_ENEMIES = [['wolf', 'main'], ['boar', 'main'], ['bear', 'main'], ['barb_warrior', 'main'], ['barb_archer', 'ferrum'], ['jackal', 'aegyptus'], ['snake', 'aegyptus'], ['bandit', 'cave'], ['robber', 'tomb'], ['punic_inf', 'punic'], ['deer', 'silva'], ['lion', 'aegyptus']];
function genQuest(source='forum',city='messana',slot=0) {
  const w = W(), lvl = Math.max(1, Math.round(w.day / 2));
  const types=source==='harbor'?['fish','deliver','sell','tunaSale']:['hunt','gather','craft','chest','camp','instance'];
  const type = source==='harbor'?types[slot%types.length]:pick(types);
  const q = { id: nid(), type, source, city, n: 1, lvl, made: Date.now() };
  const isl = (id) => (ISLANDS.find((i) => i.id === id) || {}).name || id;
  switch (type) {
    case 'hunt': { const [e, where] = pick(QUEST_ENEMIES); q.target = e; q.n = (ENEMIES[e].boss ? 1 : randi(3,7)); q.title = `Охота: ${ENEMIES[e].name} ×${q.n}`; q.desc = `Убейте ${q.n} (${ENEMIES[e].name}). Где искать: ${INSTANCES[where] ? INSTANCES[where].name : isl(where)}.`; q.reward = { den: 15 * q.n + ENEMIES[e].xp, xp: ENEMIES[e].xp * q.n, dig: 4 + q.n }; break; }
    case 'gather': { const r = pick(['wood', 'stone', 'clay', 'iron_ore', 'marble', 'cedar', 'murex', 'papyrus', 'silver_ore']); q.target = r; q.n = randi(10, 30); q.title = `Добыча: ${RES[r].name} ×${q.n}`; q.desc = `Добудьте ${q.n} ед. (${RES[r].name}).`; q.reward = { den: Math.round(q.n * RES[r].p * 1.2), xp: q.n * 4, dig: 3 + Math.round(q.n / 5) }; break; }
    case 'deliver': { const r = pick(['plank', 'brick', 'bread', 'iron', 'hide', 'f_mackerel', 'wine', 'oil', 'marble']); q.target = r; q.n = randi(8, 25); q.title = `Поставка: ${RES[r].name} ×${q.n}`; q.desc = `Сдайте ${q.n} ед. (${RES[r].name}) на склад колонии (Хорреум или трюм в гавани).`; q.reward = { den: Math.round(q.n * RES[r].p * 1.5), xp: q.n * 5, dig: 6 + Math.round(q.n / 3) }; break; }
    case 'fish': { const sp = pick(['f_seabass', 'f_dentex', 'f_octopus', 'f_grouper', 'f_moray', 'f_tuna', 'f_swordfish']); q.target = sp; q.title = `Улов: ${RES[sp].name}`; q.desc = `Поймайте рыбу: ${RES[sp].name}. Ищите косяки на воде.`; q.reward = { den: RES[sp].p * 3, xp: 60 + RES[sp].p * 2, dig: 5 }; break; }
    case 'chest': { const i = pick(ISLANDS.filter((x) => x.kind !== 'punic')); q.target = i.id; q.title = `Поиск: сундук — ${i.name}`; q.desc = `Найдите и откройте любой сундук или ящик на острове «${i.name}».`; q.reward = { den: 50 + (WG.islandLevel[i.id] || 1) * 15, xp: 80 + (WG.islandLevel[i.id] || 1) * 20, dig: 6 }; break; }
    case 'craft': { const r = pick(D.RECIPES.filter((x) => !x.lvl || x.lvl < 8)); q.target = r.id; q.n = r.gear ? 1 : randi(4, 12); q.title = `Ремесло: ${r.n || GEAR[r.gear].name}${q.n > 1 ? ' ×' + q.n : ''}`; q.desc = `Изготовьте в здании «${BUILDINGS[r.at].name}».`; q.reward = { den: 40 + q.n * 5, xp: 70 + q.n * 6, dig: 5 }; break; }
    case 'camp': { const c = pick(G.world.camps.filter((x) => !x.punic)); if (!c) return null; q.target = c.id; q.title = `Зачистка: лагерь варваров (${isl(c.island)})`; q.desc = 'Разгромите лагерь варваров вместе с вождём.'; q.reward = { den: 160 + c.lvl * 20, xp: 300 + c.lvl * 40, dig: 18 }; break; }
    case 'instance': { const k = pick(Object.keys(INSTANCES)); q.target = k; q.title = `Подземелье: ${INSTANCES[k].name}`; q.desc = `Пройдите подземелье (рекомендуемый уровень ${INSTANCES[k].lvl}).`; q.reward = { den: 120 + INSTANCES[k].lvl * 25, xp: 200 + INSTANCES[k].lvl * 50, dig: 15 }; break; }
    case 'tunaSale': {q.target='f_tuna';q.n=1;q.title='Гавань: свежий тунец';q.desc='Попадите гарпуном, вытяните тунца, выгрузите его с баркаса и принесите в гавань на продажу.';q.reward={den:250,xp:180,dig:12};break;}
    case 'sell': { q.n = randi(4, 10) * 50; q.title = `Торговля: продать на ${q.n} ден.`; q.desc = 'Продайте товары на рынке или в порту на эту сумму.'; q.reward = { den: Math.round(q.n * 0.2), xp: Math.round(q.n * 0.4), dig: 6 }; break; }
  }
  q.reward.office=type==='tunaSale'?8:5;
  return q;
}
export function questBoardTick(){
 const w=W();
 if(w.questBoardVersion!==3||Date.now()>=(w.questsAt||0)){w.quests=[];w.questBoardVersion=3;w.questsAt=Date.now()+600000;G.dirtyWorld=true;}
 for(const C of G.world.cities)for(const source of ['forum','harbor']){
  if(source==='harbor'&&!C.harbor)continue;
  let n=w.quests.filter(q=>q.city===C.id&&q.source===source).length;
  while(n<4){const q=genQuest(source,C.id,n);if(!q)break;w.quests.push(q);n++;G.dirtyWorld=true;}
 }
}
const questSpot=(p,q)=>{
 const types=q.source==='harbor'?['portus']:['forum','forum_m','taberna'];
 if(G.W.buildings.some(b=>types.includes(b.type)&&b.city===q.city&&b.built&&!b.enemy&&!b.ruined&&dist(p,b)<(D.BUILDINGS[b.type].r||10)+12))return true;
 const camp=G.world.pois.find(q=>q.type==='start_camp');return q.source!=='harbor'&&q.city==='messana'&&camp&&dist(p,camp)<18;
};
export function acceptQuest(p, qid) {
  const c = p.char, q = W().quests.find((x) => x.id === qid); if (!q) return;
  if (!questSpot(p,q)) return send(p, { type: 'log', text: 'Это задание берут у своей доски: на форуме или в гавани указанного города.', kind: 'warn' });
  if((c.doneQuests||[]).includes(q.id))return send(p,{type:'log',text:'Вы уже выполнили это поручение. Следующее появится при обновлении доски.',kind:'warn'});
  if (c.quests.length >= 6) return send(p, { type: 'log', text: 'Не больше 6 заданий одновременно.', kind: 'warn' });
  if (c.quests.some((x) => x.id === q.id)) return;
  c.quests.push({ ...q, got: 0 });
  send(p, { type: 'log', text: `Задание принято: ${q.title}`, kind: 'good' });
  p.dirtyChar = true;
}
export function dropQuest(p, qid) { p.char.quests = p.char.quests.filter((x) => x.id !== qid); p.dirtyChar = true; }
export function questHook(p, ev, d) {
  const c = p.char; if (!c) return;
  let changed = false;
  for (const q of c.quests) {
    let add = 0;
    if(['store','sell','tunaSale'].includes(ev)&&q.city&&cityNear(p.x,p.z)!==q.city)continue;
    if(ev==='tunaSale'&&q.type==='tunaSale')add=d.n;
    else
    if (ev === 'kill' && q.type === 'hunt' && d.type === q.target) add = 1;
    else if (ev === 'gather' && q.type === 'gather' && d.res === q.target) add = d.n;
    else if (ev === 'store' && q.type === 'deliver' && d.res === q.target) add = d.n;
    else if (ev === 'fish' && q.type === 'fish' && d.sp === q.target) add = 1;
    else if (ev === 'chest' && q.type === 'chest' && d.island === q.target) add = 1;
    else if (ev === 'craft' && q.type === 'craft' && d.id === q.target) add = d.n;
    else if (ev === 'camp' && q.type === 'camp' && d.camp === q.target) add = 1;
    else if (ev === 'instance' && q.type === 'instance' && d.key === q.target) add = 1;
    else if (ev === 'sell' && q.type === 'sell') add = d.den;
    if (add) { q.got = Math.min(q.n, q.got + add); changed = true; }
  }
  for (const q of [...c.quests]) if (q.got >= q.n) {
    c.quests = c.quests.filter((x) => x !== q);
    if((c.doneQuests||[]).includes(q.id))continue;
    c.doneQuests=[...(c.doneQuests||[]),q.id].slice(-256);
    const city=q.city||'messana',points=q.reward.office||5;
    c.officePoints||={};c.officePoints[city]=(c.officePoints[city]||0)+points;
    c.den += q.reward.den; grantXp(p, q.reward.xp); grantDig(p, q.reward.dig);
    send(p, { type: 'questDone', title: q.title, reward: {...q.reward,office:points},city,cityName:cname(city) });
    log(`✔ ${c.name} выполнил(а) задание «${q.title}»`, 'good');
  }
  if (changed) p.dirtyChar = true;
}

// ---------- Сюжет ----------
export function storyStepDone(step) {
  const w = W(), g = step.goal;
  const built = (t) => hasBuilt(t);
  if (g.build && ![].concat(g.build).every(built)) return false;
  if (g.ship && w.ships.length < g.ship) return false;
  if (g.colony && w.buildings.filter((b) => b.type === 'colonia' && b.built).length < g.colony) return false;
  if (g.talk && !(w.flags && w.flags.scribe)) return false;
  if (g.scraps && !(w.flags && w.flags.scraps)) return false;
  if (g.instance && !(w.flags && w.flags['inst_' + g.instance])) return false;
  const cs = w.cityState || {};
  if (g.capture && !(cs[g.capture] && cs[g.capture].owner === 'rome')) return false;
  if (g.captureAll && !Object.values(cs).every((x) => x.owner === 'rome')) return false;
  if (g.rebuild && !g.rebuild.types.every((t) => w.buildings.some((b) => b.city === g.rebuild.city && b.muni && (b.type === t || (t === 'forum' && b.type === 'forum_m')) && b.built))) return false;
  if (g.fleet && !Object.entries(g.fleet).every(([k, n]) => ((w.fleetBuilt || {})[k] || 0) >= n)) return false;
  if (g.romeCrates && !Object.entries(g.romeCrates).every(([k, n]) => ((w.romeSent || {})[k] || 0) >= n)) return false;
  return true;
}
export function storyCheck() {
  const w = W();
  while (w.story < STORY.length && storyStepDone(STORY[w.story])) {
    const st = STORY[w.story];
    w.story++;
    log(`📖 Глава завершена: «${st.title}»! Все колонисты получают награду.`, 'good');
    chronicle(`Глава летописи: «${st.title}»`);
    for (const p of G.players.values()) if (p.char) claimStory(p);
    if (w.story < STORY.length) log(`📖 Новая глава: «${STORY[w.story].title}» — ${STORY[w.story].text}`, 'warn');
    G.dirtyWorld = true;
  }
}
export function claimStory(p) {
  const c = p.char;
  while ((c.storyClaimed || 0) < W().story) {
    const r = STORY[c.storyClaimed].reward; c.storyClaimed++;
    c.den += r.den; grantXp(p, r.xp); grantDig(p, r.dig);
  }
  p.dirtyChar = true;
}
export function talkNpc(p, npc) {
  const w = W(); w.flags = w.flags || {};
  const hut = G.world.pois.find((q) => q.npc === npc); if (!hut || dist(p, hut) > 12) return;
  if (npc === 'scribe') {
    const cur = STORY[w.story];
    if (!w.flags.scribe) { w.flags.scribe = true; send(p, { type: 'npc', name: 'Писец Хеви', text: 'Приветствую, римлянин. Я храню память о фараоне Неферкаре — он правил этими песками, когда Рим был деревней. Его гробницу ищут расхитители. Принеси мне 5 обрывков древнего папируса — их находят в сундуках и у грабителей — и я прочту, где вход.' }); storyCheck(); return; }
    if (!w.flags.scraps) {
      const c = p.char;
      if ((c.scraps || 0) >= 5) { c.scraps -= 5; w.flags.scraps = true; send(p, { type: 'npc', name: 'Писец Хеви', text: 'Да... «Под глазом сокола, у сломанной пальмы». Вход в гробницу Неферкара открыт — он отмечен на твоей карте. Будь осторожен: внутри обвалы и люди с ножами.' }); grantXp(p, 200); storyCheck(); p.dirtyChar = true; return; }
      send(p, { type: 'npc', name: 'Писец Хеви', text: `У тебя ${c.scraps || 0} из 5 обрывков. Ищи в сундуках, у затонувших кораблей и у расхитителей гробниц.` }); return;
    }
    send(p, { type: 'npc', name: 'Писец Хеви', text: w.flags.inst_tomb ? 'Ты вернул имя Неферкара из тьмы. Рим запомнит это. А в песках ещё много тайн...' : 'Вход в гробницу открыт. Да хранят тебя боги, римлянин.' });
  }
}

// ---------- Подземелья ----------
let slot = 0;
export function instanceEnter(p, key) {
  const def = INSTANCES[key], c = p.char; if (!def || p.inst || p.ship) return;
  const ent = G.world.entrances.find((e) => e.id === key); if (!ent || dist(p, ent) > 12) return;
  if (key === 'tomb' && !(W().flags && W().flags.scraps)) return send(p, { type: 'log', text: 'Вход завален песком. Писец Хеви на Малом Египте знает, как его найти (сюжет).', kind: 'warn' });
  let I = [...G.instances.values()].find((x) => x.key === key && !x.done && x.players.size < 6);
  if (!I) I = makeInstance(key);
  I.players.add(p.id);
  p.inst = I.id; p.mounted = false; p.instRet = { x: ent.x, z: ent.z + 6 };
  p.x = I.start.x; p.z = I.start.z; p.fishing = null;
  send(p, { type: 'inst', id: I.id, key, theme: I.theme, rooms: I.rooms, cors: I.cors, y0: I.y0, x: p.x, z: p.z, exit: I.exit, lootCd: (c.instCd[key] || 0) > Date.now() / 1000 });
  log(`${c.name} спускается: ${def.name}`, 'info');
}
function makeInstance(key) {
  const def = INSTANCES[key];
  const id = nid(), x0 = 6000 + (slot++ % 12) * 700, z0 = 0;
  const theme = key === 'cave' ? 'cave' : key === 'mine' ? 'mine' : key === 'tomb' ? 'tomb' : 'fortress';
  const cells = [[0, 0]], seen = new Set(['0,0']);
  const dirs = [[0, 1], [1, 0], [-1, 0]];
  while (cells.length < def.rooms) {
    const [ci, cj] = cells[cells.length - 1];
    const opts = dirs.map(([a, b]) => [ci + a, cj + b]).filter(([a, b]) => !seen.has(a + ',' + b));
    if (!opts.length) break;
    const nx = pick(opts); cells.push(nx); seen.add(nx.join(','));
  }
  const CELL = 34;
  const rooms = cells.map(([i, j], k) => ({ x: x0 + i * CELL, z: z0 + j * CELL, w: k === cells.length - 1 ? 26 : randi(16, 22), d: k === cells.length - 1 ? 26 : randi(16, 22), doors: [], boss: k === cells.length - 1, start: k === 0 }));
  const cors = [];
  for (let k = 1; k < rooms.length; k++) {
    const a = rooms[k - 1], b = rooms[k];
    const dx = Math.sign(b.x - a.x), dz = Math.sign(b.z - a.z);
    const side = dx > 0 ? 'e' : dx < 0 ? 'w' : 's', back = dx > 0 ? 'w' : dx < 0 ? 'e' : 'n';
    a.doors.push(side); b.doors.push(back);
    if (dx) { const x1 = a.x + dx * a.w / 2, x2 = b.x - dx * b.w / 2; cors.push({ x: (x1 + x2) / 2, z: a.z, w: Math.abs(x2 - x1) + 1, d: 4.5, ax: 'x' }); }
    else { const z1 = a.z + a.d / 2, z2 = b.z - b.d / 2; cors.push({ x: a.x, z: (z1 + z2) / 2, w: 4.5, d: Math.abs(z2 - z1) + 1, ax: 'z' }); }
  }
  // вход — у южной стены первой комнаты
  rooms[0].doors.push('n');
  const start = { x: rooms[0].x, z: rooms[0].z - rooms[0].d / 2 + 3 };
  const I = { id, key, def, theme, x0, z0, y0: 60, rooms, cors, players: new Set(), done: false, created: now(), empty: 0, start, exit: { x: start.x, z: start.z - 1.5 } };
  I.walkable = (x, z) => rooms.some((r) => Math.abs(x - r.x) < r.w / 2 - 0.6 && Math.abs(z - r.z) < r.d / 2 - 0.6) || cors.some((r) => Math.abs(x - r.x) < r.w / 2 + (r.ax === 'x' ? 1.5 : -0.4) && Math.abs(z - r.z) < r.d / 2 + (r.ax === 'z' ? 1.5 : -0.4));
  G.instances.set(id, I);
  // враги
  const party = 1;
  rooms.forEach((r, k) => {
    if (k === 0) return;
    const n = r.boss ? 2 : randi(2, 4);
    for (let i = 0; i < n; i++) spawnMob(pick(def.mobs), r.x + rand(-r.w / 3, r.w / 3), r.z + rand(-r.d / 3, r.d / 3), { lvl: def.lvl + randi(0, 1), inst: id, leash: 99, y: 60 });
    if (r.boss) { const b = spawnMob(def.boss, r.x, r.z + 4, { lvl: def.lvl + 1, inst: id, leash: 99, y: 60, src: { kind: 'boss', onDeath: (m, p) => instanceWon(I, p) } }); I.boss = b.id; }
  });
  return I;
}
function instanceWon(I, killer) {
  I.done = true;
  const def = I.def;
  log(`🏆 ${def.name}: главарь повержен!`, 'good');
  const w = W(); w.flags = w.flags || {};
  if (!w.flags['inst_' + I.key]) { w.flags['inst_' + I.key] = true; chronicle(`Колонисты прошли: ${def.name}`); }
  if (def.threat) { w.threat = Math.max(0, w.threat + def.threat); log(`Угроза Карфагена снижена на ${-def.threat}.`, 'good'); }
  const boss = G.mobs.get(I.boss) || I.rooms[I.rooms.length - 1];
  for (const pid of I.players) {
    const p = G.players.get(pid); if (!p || !p.char || p.inst !== I.id) continue;
    const c = p.char, t = Date.now() / 1000;
    questHook(p, 'instance', { key: I.key });
    grantDig(p, 20);
    if ((c.instCd[I.key] || 0) > t) { send(p, { type: 'log', text: 'Сокровищница пуста для вас — добыча обновится позже.', kind: 'info' }); continue; }
    c.instCd[I.key] = t + def.cd;
    const got = [];
    for (const [res, [a, b]] of Object.entries(def.loot)) { const n = randi(a, b); if (n) { const k = addRes(c, res, n, true); got.push(`${k} ${RES[res].name}`); } }
    if (Math.random() < 0.55) { const k = pick(def.gear), q = Math.random() < 0.15 ? 3 : Math.random() < 0.5 ? 2 : 1; if (addGear(c, k, q)) got.push(`${GEAR[k].name} (${QUALITY[q].name})`); }
    const den = randi(80, 160) + def.lvl * 15; c.den += den; got.push(`${den} денариев`);
    send(p, { type: 'log', text: `💰 Сокровищница: ${got.join(', ')}`, kind: 'good' });
    p.dirtyChar = true;
  }
  storyCheck(); G.dirtyWorld = true;
  broadcast({ type: 'instDone', id: I.id }, (q) => q.inst === I.id);
}
export function instanceExit(p) {
  const I = G.instances.get(p.inst); if (!I) { p.inst = null; return; }
  I.players.delete(p.id);
  p.inst = null; p.x = p.instRet.x; p.z = p.instRet.z;
  send(p, { type: 'instExit', x: p.x, z: p.z });
}
export function instancesTick() {
  const t = now();
  for (const I of G.instances.values()) {
    for (const pid of [...I.players]) { const p = G.players.get(pid); if (!p || p.inst !== I.id) I.players.delete(pid); }
    if (!I.players.size) { if (!I.empty) I.empty = t; if (t - I.empty > 60) { for (const m of G.mobs.values()) if (m.inst === I.id) G.mobs.delete(m.id); G.instances.delete(I.id); } continue; }
    I.empty = 0;
    // обвалы в гробнице и шахте
    if ((I.theme === 'tomb' || I.theme === 'mine') && !I.done && t > (I.trapAt || 0)) {
      I.trapAt = t + rand(5, 10);
      const p = G.players.get(pick([...I.players])); if (p && p.alive) {
        const x = p.x + rand(-1.5, 1.5), z = p.z + rand(-1.5, 1.5);
        fx({ kind: 'cavein', x, z, y: I.y0, warn: 1.4 });
        setTimeout(() => { for (const q of G.players.values()) if (q.inst === I.id && q.alive && Math.hypot(q.x - x, q.z - z) < 2.6) damagePlayerSafe(q, 22 + I.def.lvl); }, 1400);
      }
    }
  }
}
let damagePlayerSafe = () => {};
export function setDmgFn(fn) { damagePlayerSafe = fn; }

// ---------- Арена ----------
const arenaB = () => builtOf('amphitheatrum')[0];
export function arenaStart(p, mode, grand) {
  const b = arenaB(); if (!b || dist(p, b) > 60) return send(p, { type: 'log', text: 'Игры проходят в Амфитеатре.', kind: 'warn' });
  if (G.arena) return send(p, { type: 'log', text: 'Игры уже идут.', kind: 'warn' });
  if (grand) { if (!isOffice(p, 'lanista')) return; if (W().treasury < 150) return send(p, { type: 'log', text: 'Нужно 150 денариев в казне.', kind: 'warn' }); W().treasury -= 150; }
  const ry = b.ry || 0;
  G.arena = { bid: b.id, x: b.x, z: b.z, rx: 24, rz: 16, ry, mode: 'waves', fighters: new Set(), wave: 0, bets: [], state: 'prep', t: now() + 15, grand: !!grand, by: p.char.name };
  log(`🏟 ${grand ? 'Ланиста объявил Большие игры' : `${p.char.name} открыл(а) гладиаторские бои`} в Амфитеатре! Бойцы — выходите на песок арены (15 с). Зрители — делайте ставки.`, 'warn');
  G.dirtyWorld = true;
}
export function onArenaFloor(p) { const a = G.arena; if (!a) return false; const dx = p.x - a.x, dz = p.z - a.z; const c = Math.cos(a.ry), s = Math.sin(a.ry); const lx = dx * c - dz * s, lz = dx * s + dz * c; return (lx / a.rx) ** 2 + (lz / a.rz) ** 2 < 1; }
export function duelChallenge(p, pid) {
  const q = G.players.get(pid), b = arenaB(); if (!q || !b || q === p) return;
  if (dist(p, b) > 60 || dist(q, b) > 60) return send(p, { type: 'log', text: 'Оба бойца должны быть у Амфитеатра.', kind: 'warn' });
  q.duelFrom = { pid: p.id, until: now() + 30 };
  send(q, { type: 'duelAsk', from: p.char.name, pid: p.id });
  send(p, { type: 'log', text: `Вызов на поединок отправлен: ${q.char.name}`, kind: 'info' });
}
export function duelAccept(p) {
  const d = p.duelFrom; if (!d || now() > d.until || G.arena) return;
  const q = G.players.get(d.pid); const b = arenaB(); if (!q || !b) return;
  G.arena = { bid: b.id, x: b.x, z: b.z, rx: 24, rz: 16, ry: b.ry || 0, duel: true, mode: 'duel', fighters: new Set([p.id, q.id]), bets: [], state: 'prep', t: now() + 10, names: [q.char.name, p.char.name], ids: [q.id, p.id] };
  for (const [i, x] of [q, p].entries()) { const s = i ? 1 : -1; x.x = b.x + Math.sin(b.ry || 0) * 12 * s; x.z = b.z + Math.cos(b.ry || 0) * 12 * s; send(x, { type: 'teleport', x: x.x, z: x.z }); x.hp = derivedOf(x.char).maxHp; }
  log(`⚔ Поединок в Амфитеатре: ${q.char.name} против ${p.char.name}! Ставки — 10 секунд.`, 'warn');
  G.dirtyWorld = true;
}
export function bet(p, on, amt) {
  const a = G.arena; if (!a || a.state !== 'prep' || a.fighters.has(p.id)) return;
  if (a.mode === 'games' && !a.list.some((g) => g.key === on)) return;
  amt = Math.max(5, Math.min(500, amt | 0)); if (p.char.den < amt) return;
  p.char.den -= amt; a.bets.push({ pid: p.id, on, amt });
  send(p, { type: 'log', text: `Ставка ${amt} ден. принята.`, kind: 'good' }); p.dirtyChar = true;
}
const GLADS = ['glad_murmillo', 'glad_retiarius', 'glad_thraex'];
let boutFn = () => true;
export function setBoutFn(fn) { boutFn = fn; }
export function arenaTick() {
  if (G.arena && G.arena.mode === 'bout') { if (boutFn(G.arena)) G.arena = null; return; }
  if (G.arena && G.arena.mode === 'games') return; // Великие игры ведёт glad.js
  const a = G.arena; if (!a) return;
  const t = now();
  if (a.state === 'prep' && t >= a.t) {
    if (!a.duel) for (const p of G.players.values()) if (p.alive && p.char && onArenaFloor(p)) a.fighters.add(p.id);
    if (!a.fighters.size) { log('🏟 На арену никто не вышел — игры отменены.', 'info'); refundBets(a); G.arena = null; return; }
    a.state = 'fight'; a.t = t + 3;
    if (!a.duel) log(`🏟 Бой начинается! Бойцов: ${a.fighters.size}.`, 'warn');
  }
  if (a.state !== 'fight') return;
  for (const pid of [...a.fighters]) { const p = G.players.get(pid); if (!p || !p.alive) a.fighters.delete(pid); }
  if (a.duel) {
    if (a.fighters.size < 2) { const win = G.players.get([...a.fighters][0]); arenaEnd(win ? win.char.name : null, win); }
    return;
  }
  if (!a.fighters.size) { arenaEnd(null); return; }
  const alive = [...G.mobs.values()].filter((m) => m.arena === a && m.hp > 0);
  if (!alive.length && t >= a.t) {
    if (a.wave > 0) {
      const rew = 20 * a.wave * (a.grand ? 2 : 1);
      for (const pid of a.fighters) { const p = G.players.get(pid); if (p) { p.char.den += rew; p.char.ap = (p.char.ap || 0) + 2 * a.wave; grantXp(p, 40 * a.wave); p.dirtyChar = true; send(p, { type: 'log', text: `🏟 +${2 * a.wave} очков арены`, kind: 'good' }); } }
      log(`🏟 Волна ${a.wave} пройдена! Бойцам по ${rew} денариев.`, 'good');
      if (a.wave > W().arenaRecord) { W().arenaRecord = a.wave; G.dirtyWorld = true; }
      payBets(a, 'w' + a.wave);
      if (a.wave >= 10) { for (const pid of a.fighters) { const p = G.players.get(pid); if (p && ![p.char.gear.weapon, ...p.char.items].some((g) => g && g.k === 'rudis')) addGear(p.char, 'rudis', 3); } log('🏆 Бойцы прошли все 10 волн! Каждый получает рудис чемпиона.', 'good'); chronicle('Бойцы прошли все 10 волн арены'); arenaEnd('all'); return; }
    }
    a.wave++; a.t = t + 6;
    const n = Math.min(8, 1 + a.wave + Math.floor(a.fighters.size / 2));
    const R = (k) => ({ x: a.x + Math.sin(a.ry + k) * 18, z: a.z + Math.cos(a.ry + k) * 12 });
    for (let i = 0; i < n; i++) {
      let type = pick(GLADS);
      if (a.wave % 3 === 0 && i === 0) type = pick(['lion', 'bear']);
      if (a.wave % 5 === 0 && i === 0) type = 'glad_champion';
      const s = R(rand(0, 6.28));
      spawnMob(type, s.x, s.z, { lvl: 2 + a.wave * 2, arena: a, leash: 999 });
    }
    log(`🏟 Волна ${a.wave}: ${n} противников!`, 'warn');
  }
}
function payBets(a, key) {
  const win = a.bets.filter((b) => b.on === key);
  for (const b of win) { const p = G.players.get(b.pid); const mul = key === 'w3' ? 2 : key === 'w5' ? 4 : key === 'w8' ? 8 : 2; if (p) { p.char.den += b.amt * mul; send(p, { type: 'log', text: `Ставка сыграла: +${b.amt * mul} ден.`, kind: 'good' }); p.dirtyChar = true; } }
  a.bets = a.bets.filter((b) => b.on !== key);
}
function refundBets(a) { for (const b of a.bets) { const p = G.players.get(b.pid); if (p) { p.char.den += b.amt; p.dirtyChar = true; } } }
function arenaEnd(winner, wp) {
  const a = G.arena; if (!a) return;
  if (a.duel && wp) {
    const pool = a.bets.reduce((s, b) => s + b.amt, 0), wins = a.bets.filter((b) => b.on === wp.id), wsum = wins.reduce((s, b) => s + b.amt, 0);
    const cut = isOfficeAny('lanista') ? Math.round(pool * 0.1) : 0;
    for (const b of wins) { const p = G.players.get(b.pid); if (p) { p.char.den += Math.round((pool - cut) * b.amt / wsum); p.dirtyChar = true; } }
    if (cut) payLanista(cut);
    grantDig(wp, 10); grantXp(wp, 120); wp.char.ap = (wp.char.ap || 0) + 10; wp.dirtyChar = true;
    log(`⚔ Поединок выиграл(а) ${winner}! (+10 очков арены)`, 'good');
  } else if (!a.duel) {
    const lost = a.bets.reduce((s, b) => s + b.amt, 0); if (lost && isOfficeAny('lanista')) payLanista(Math.round(lost * 0.3));
    log(`🏟 Игры окончены. Пройдено волн: ${Math.max(0, a.wave - (winner === 'all' ? 0 : 1))}. Рекорд арены: ${W().arenaRecord}.`, 'info');
  }
  for (const m of G.mobs.values()) if (m.arena === a) G.mobs.delete(m.id);
  G.arena = null; G.dirtyWorld = true;
}
const isOfficeAny = k => !!holderOf(k, cityOf(G.arena));
function payLanista(n) { const id = holderOf('lanista', cityOf(G.arena || { x: 0, z: 0 }))?.id; const q = playerByChar(id); if (q) { q.char.den += n; q.dirtyChar = true; send(q, { type: 'log', text: `Доля ланисты: +${n} ден.`, kind: 'good' }); } else if (G.chars[id]) G.chars[id].den += n; }
export function arenaKnockout(p) {
  const a = G.arena; a.fighters.delete(p.id);
  p.alive = true; p.hp = 1;
  const b = { x: a.x + Math.sin(a.ry) * 30, z: a.z + Math.cos(a.ry) * 30 };
  p.x = b.x; p.z = b.z; send(p, { type: 'teleport', x: p.x, z: p.z, text: 'Вы повержены на арене. Лекари унесли вас с песка.' });
  log(`🏟 ${p.char.name} повержен(а) на арене.`, 'info');
}
