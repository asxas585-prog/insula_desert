import * as TN from './tuna.js';
import { tradeVisit } from './tutorial.js';
import { shipLimitOf } from './state.js';
import * as LG from './logistics.js';
import { credentials, passwordRecord, verifySecret, allowLogin } from './auth.js';
import { cityOf, localOffices, hasCityOffice } from './access.js';
// Insula Deserta: Империя — сервер кооперативной RPG (постоянный мир)
import { G, D, WG, DEV, now, dist, rand, randi, pick, nid, r1, send, broadcast, log, fx, chronicle, loadAll, saveAll, newChar, derivedOf, rankOf, gearArmor, gearSlow, addRes, takeRes, addGear, charPublic, bagWeight , book, ledgerTick, cityOff, cityNear, officeHolds, officesOf, romanCities } from './state.js';
import * as CB from './combat.js';
import * as EC from './economy.js';
import * as SO from './society.js';
import * as T from './trade.js';
import * as GL from './glad.js';
import * as CP from './campaign.js';
import * as LD from './land.js';
import * as RT from './routes.js';
import * as AR from './army.js';
import * as SC from './sci.js';
import * as NAV from './nav.js';
import * as WAR from './wargame.js';

const { CFG, RES, GEAR, BUILDINGS, ENEMIES, SHIPS, QUALITY } = D;
G.pendingHits = [];
let pidSeq = 1;

// ---------- Вход ----------
function spawnPoint(c) {
  const home = c.home && G.W.buildings.find((b) => b.id === c.home && b.built && !b.ruined);
  if (home) return { x: home.x + Math.sin(home.ry) * (BUILDINGS.domus.r + 2), z: home.z + Math.cos(home.ry) * (BUILDINGS.domus.r + 2) };
  const f = EC.builtOf('forum')[0];
  if (f) return { x: f.x + 4, z: f.z + BUILDINGS.forum.r + 3 };
  return { x: WG.START.spawn.x + rand(-2, 2), z: WG.START.spawn.z + rand(-2, 2) };
}
function join(ws, m) {
  const name = String(m.name || 'Гость').trim().slice(0, 18) || 'Гость';
  const cred = credentials(m, G.chars);
  const fail = text => { ws.send(JSON.stringify({ type: 'error', text })); return null; };
  if (!cred || cred.secret.length > 256) return fail('Проверьте код и пароль.');
  if (!allowLogin('account:' + cred.id)) return fail('Слишком много попыток входа. Подождите минуту.');
  const id = cred.id;
  let c = G.chars[id]; const fresh = !c;
  if (c) {
    if (!c.auth) return fail('Для старого персонажа нужен новый пароль от администратора. Персонаж и имущество сохранены.');
    if (!verifySecret(c.auth, cred.secret)) return fail('Неверный код или пароль.');
  } else {
    if (cred.named && cred.secret.length < 10) return fail('Для нового кода задайте пароль от 10 символов.');
    c = G.chars[id] = newChar(id, name, D.COLORS.includes(m.color) ? m.color : pick(D.COLORS));
    c.auth = passwordRecord(cred.secret);
  }
  for (const q of G.players.values()) if (q.char?.id === id) { dropPlayer(q); try { q.ws.close(4001, 'Вход с другого устройства'); } catch {} }
  if (name !== 'Гость') c.name = name;
  if (D.COLORS.includes(m.color)) c.color = m.color;
  if (!c.gotTorch) { c.items.push({ uid: nid(), k: 'torch', q: 0 }); c.gotTorch = true; }
  if (c.horses) { const pubSt = G.W.buildings.find((b) => b.type === 'stabulum'); for (const h of c.horses) { if (h.sat == null) h.sat = 100; if (!h.stable && c.horseOut !== h.id && pubSt) h.stable = pubSt.id; } }
  if (!c.spec) { c.spec = {}; c.specPts = Math.max(0, c.level - 1); }
  const p = { id: pidSeq++, ws, char: c, x: 0, z: 0, y: 0, ry: 0, alive: true, hp: 0, st: 0, buffs: {}, inst: null, ship: null, seat: null, block: false, iframe: 0, lastMv: now(), dirtyChar: true, joined: now() };
  let pos = (c.x != null && (WG.terrainHeight(c.x, c.z) > 0.2 || WG.deckHeight(c.x,c.z,G.W.buildings)!=null) && Math.abs(c.x) < CFG.world) ? { x: c.x, z: c.z } : spawnPoint(c);
  p.x = pos.x; p.z = pos.z;
  const d = derivedOf(c); p.hp = c.hp && c.hp > 0 ? Math.min(c.hp, d.maxHp) : d.maxHp; p.st = d.maxSt;
  G.players.set(p.id, p);
  send(p, { type: 'welcome', id: p.id, seed: G.W.seed, x: p.x, z: p.z, dev: DEV, fresh, nodes: G.W.nodes, chests: G.W.chests, chestPos: G.W.chestPos || {}, t: now() });
  sendBuildings(p); sendWorld(p); sendRoster();
  log(`${c.name} ${fresh ? 'прибыл(а) в колонию впервые' : 'вернулся(лась) в колонию'}.`, 'info');
  SO.claimStory(p);
  return p;
}
function dropPlayer(p) {
  if (!G.players.has(p.id)) return;
  WAR.warPlayerGone(p);
  if (p.char) { p.char.x = r1(p.inst ? p.instRet.x : p.x); p.char.z = r1(p.inst ? p.instRet.z : p.z); p.char.hp = p.alive ? Math.round(p.hp) : null; p.char.lastSeen = Date.now(); }
  if (p.inst) { const I = G.instances.get(p.inst); if (I) I.players.delete(p.id); }
  G.players.delete(p.id);
  if (G.arena) G.arena.fighters.delete(p.id);
  sendRoster();
}

// ---------- Ввод ----------
function handle(p, m) {
  const c = p.char;
  if (!p.alive && !['mv','chat','ping'].includes(m.type)) return;
  switch (m.type) {
    case 'mv': return onMove(p, m);
    case 'atk': if (!p.ship || true) CB.playerAttack(p, m); return;
    case 'throw': return CB.playerThrow(p, m);
    case 'block': p.block = !!m.on && p.alive && !(p.guardBreak > now()) && !p.ship; return;
    case 'dodge': {
      const t = now(); if (!p.alive || p.ship || p.st < CFG.stamina.dodge || t < (p.dodgeReady || 0)) return;
      p.st -= CFG.stamina.dodge; p.iframe = t + CFG.iframes + 0.1; p.dodgeReady = t + 0.7; p.dodgeT = t; p.block = false; return;
    }
    case 'tradeVisit': return tradeVisit(p, m);
    case 'warehouseMove': case 'autoStore': return LG.warehouseMsg(p, m);
    case 'gather': return EC.gather(p, m.id | 0);
    case 'open': return EC.openChest(p, String(m.id));
    case 'eat': return eat(p, m.res);
    case 'heal': return bandage(p);
    case 'crateCraft': case 'crateTake': case 'crateStore': case 'crateDrop': case 'cratePick': case 'crateLoad': case 'crateUnload': case 'crateSell': return T.crateMsg(p, m);
    case 'squadRecruit': case 'guardHire': case 'guardToggle': case 'guardFire': case 'guardOrder': case 'squadUp': case 'squadReinforce': case 'squadOut': case 'squadIn': case 'squadOrder': case 'squadDisband': case 'squadHome': AR.armyMsg(p, m); break;
    case 'squadCancel': AR.cancelOrders(p); break;
    case 'watchBuy': case 'watchUp': AR.watchMsg(p, m); break;
    case 'sciBuy': case 'sciSample': case 'sciCatch': case 'sciStudy': SC.sciMsg(p, m); break;
    case 'ruinStudy': SC.ruinStudy(p, m); break;
    case 'treasureDig': SC.treasureDig(p, m); break;
    case 'moor': T.moor(p); break;
    case 'boardStart': T.boardStart(p); break;
    case 'shipBuy': case 'shipForSale': case 'shipRome': case 'shipScrap': T.shipTrade(p, m); break;
    case 'rankUp': LD.buyRank(p); break;
    case 'tunaPull': EC.tunaPull(p); break;
    case 'harpoonShot':case 'harpoonReel':case 'harpoonCancel':case 'tunaUnload':case 'tunaLoad':case 'tunaSell':return TN.tunaMsg(p,m);
    case 'sellCatch': EC.sellCatch(p, m.bid); break;
    case 'crateOrder': RT.orderMsg(p, m); break;
    case 'routeNew': case 'routeDel': case 'routeShip': case 'routeWagons': case 'routeGuards': case 'routeCargo': case 'routeToggle': RT.routeMsg(p, m); break;
    case 'permit': LD.buyPermit(p, m); break;
    case 'claim': LD.claimCells(p, m); break;
    case 'cityRoad': LD.cityRoad(p,m); break;
    case 'release': LD.releaseCells(p, m); break;
    case 'colonyUp': LD.colonyUp(p, m); break;
    case 'spy': CP.spy(p, m.poi); break;
    case 'plunder': CP.plunder(p, m.poi); break;
    case 'assault': CP.assault(p, m.city); break;
    case 'enslave': case 'tame': case 'gladLudus': case 'gladUp': case 'arenaGear': case 'arenaBuy': case 'gladBout': case 'gladName': case 'gladSale': case 'gladBuy': return GL.gladMsg(p, m);
    case 'shipRepair': case 'shipUp': case 'shipArcher': case 'catapult': return T.shipMsg(p, m);
    case 'horseBuy': case 'horseOut': case 'horseStable': case 'mount': case 'horseFeed': case 'stableFeed': case 'breed': case 'rentPublic': case 'foalBuy': case 'horseBuyFull': case 'stockTake': case 'stockSale': case 'stockRent': case 'stockNpc': case 'stockBuy': case 'stockRentTake': return horseMsg(p, m);
    case 'spec': {
      if ((c.specPts || 0) <= 0 || !D.SPECS[m.k] || D.specOf(c, m.k) >= D.SPEC_MAX) return;
      c.spec[m.k] = D.specOf(c, m.k) + 1; c.specPts--; p.dirtyChar = true;
      return send(p, { type: 'log', text: `${D.SPECS[m.k].icon} ${D.SPECS[m.k].name}: ступень ${c.spec[m.k]}`, kind: 'good' });
    }
    case 'torch': {
      const has = c.items.some((i) => i.k === 'torch') || (c.gear.weapon && c.gear.weapon.k === 'torch');
      if (!has && !c.torch) return send(p, { type: 'log', text: 'Нет факела: купите у купца в лагере или на рынке.', kind: 'warn' });
      c.torch = !c.torch; p.dirtyChar = true; sendRoster();
      return send(p, { type: 'log', text: c.torch ? '🔥 Факел зажжён (T — потушить).' : 'Факел потушен.', kind: 'info' });
    }
    case 'equip': return equip(p, m.uid);
    case 'unequip': return unequip(p, m.slot);
    case 'dropGear': { const i = c.items.findIndex((x) => x.uid === m.uid); if (i < 0 || GEAR[c.items[i].k].bound) return; const it = c.items.splice(i, 1)[0]; const dd = CB.dropItem(p.x, p.z, it.k, 1, it.q, p.inst); dd.noPick = p.id; dd.noPickUntil = now() + 8; p.dirtyChar = true; return; }
    case 'dropRes': { const n = takeRes(c, m.res, Math.max(1, m.n | 0)); if (n) { const dd = CB.dropItem(p.x + Math.sin(p.ry), p.z + Math.cos(p.ry), m.res, n, 0, p.inst); dd.noPick = p.id; dd.noPickUntil = now() + 8; p.dirtyChar = true; } return; }
    case 'stat': if (c.points > 0 && D.STATS[m.k]) { c.points--; c.stats[m.k]++; p.dirtyChar = true; } return;
    case 'place': return EC.placeBuilding(p, m.bt, m.x, m.z, m.ry);
    case 'moveBld': return EC.moveBuilding(p, m.bid, m.x, m.z, m.ry);
    case 'demolish': return EC.demolish(p, m.bid);
    case 'bldSale': return EC.bldSale(p, m.bid, m.price);
    case 'bldBuy': return EC.bldBuy(p, m.bid);
    case 'deliver': return EC.deliver(p, m.bid, !!m.store);
    case 'collect': return EC.collect(p, m.bid, !!m.store, typeof m.res === 'string' ? m.res : null);
    case 'repair': return EC.repair(p, m.bid, !!m.store);
    case 'storeTake': return EC.storeTake(p, m.res, m.n);
    case 'donate': {
      const h = EC.builtOf('horreum').find((b) => dist(p, b) < 20) || (!EC.hasBuilt('horreum') && G.world.pois.find((q) => q.type === 'start_camp' && dist(p, q) < 18));
      if (!h || !RES[m.res]) return;
      const n = takeRes(c, m.res, Math.max(1, m.n | 0)); if (!n) return;
      G.W.storage[m.res] = (G.W.storage[m.res] || 0) + n; CB.grantDig(p, Math.ceil(n * RES[m.res].p / 40)); SO.questHook(p, 'store', { res: m.res, n });
      p.dirtyChar = true; G.dirtyWorld = true; return;
    }
    case 'craft': return EC.craft(p, m.id, m.n);
    case 'sell': return EC.sell(p, m.res, m.n, !!m.cargo);
    case 'buy': return EC.buy(p, m.k, m.n);
    case 'sellGear': return EC.sellGear(p, m.uid);
    case 'slaveBuy': return EC.buySlave(p, m.id);
    case 'slaveAssign': return EC.assignSlave(p, m.id, m.bid ?? null);
    case 'slaveFree': return EC.freeSlave(p, m.id);
    case 'slaveSell': return EC.sellSlave(p, m.id);
    case 'home': { const b = G.W.buildings.find((x) => x.id === m.bid && x.type === 'domus' && x.owner === c.id); if (b) { c.home = b.id; send(p, { type: 'log', text: 'Теперь вы возрождаетесь у своего дома.', kind: 'good' }); } return; }
    case 'shipBuild': return EC.buildShip(p, m.st);
    case 'board': return EC.board(p, m.sid);
    case 'leave': return EC.leaveShip(p);
    case 'helm': return EC.helm(p, m);
    case 'cargo': return EC.cargoMove(p, m.sid, m.res, m.n, m.dir);
    case 'colonyLoad': return EC.colonyLoad(p, m.bid);
    case 'unload': return EC.unloadToStorage(p, m.sid);
    case 'cast': return EC.cast(p, m.x, m.z);
    case 'reel': return EC.reel(p, !!m.ok);
    case 'uncast': if (p.fishing) { p.fishing = null; send(p, { type: 'fishEnd' }); } return;
    case 'cand': return SO.candidate(p, m.office);
    case 'vote': return SO.vote(p, m.office, m.cid);
    case 'resign': return SO.resign(p, m.office);
    case 'callElection': return SO.callElection(p);
    case 'propose': return SO.proposeLaw(p, m.key, m.opt);
    case 'lawVote': return SO.lawVote(p, m.yes);
    case 'office': return SO.officeAct(p, m);
    case 'romeDeliver': return SO.romeDeliver(p, m.rid, !!m.store);
    case 'quest': return SO.acceptQuest(p, m.id);
    case 'questDrop': return SO.dropQuest(p, m.id);
    case 'talk': return SO.talkNpc(p, m.npc);
    case 'instEnter': return SO.instanceEnter(p, m.key);
    case 'instExit': { const I = G.instances.get(p.inst); if (I && Math.hypot(p.x - I.exit.x, p.z - I.exit.z) < 6) SO.instanceExit(p); return; }
    case 'arena': return SO.arenaStart(p, 'waves', !!m.grand);
    case 'duel': return SO.duelChallenge(p, m.pid);
    case 'duelAccept': return SO.duelAccept(p);
    case 'bet': return SO.bet(p, m.on, m.amt);
    case 'respawn': return;
    case 'chat': return chat(p, m.text);
    case 'speech': return speech(p, m.text);
    case 'stallBuy': return EC.stallBuy(p, m.bid);
    case 'roomRent': return EC.roomRent(p, m.bid);
    case 'tpForum': { // телепорт на ближайший римский форум: раз в 2 минуты
      const c = p.char; if (p.inst || p.ship) return send(p, { type: 'log', text: 'Отсюда телепорт не работает.', kind: 'warn' });
      if (G.arena && G.arena.fighters.has(p.id)) return send(p, { type: 'log', text: 'Бойцы не покидают арену до конца боя.', kind: 'warn' });
      const left = Math.ceil((c.tpAt || 0) - now()); if (left > 0) return send(p, { type: 'log', text: `Телепорт будет готов через ${left} с.`, kind: 'warn' });
      const fs = G.W.buildings.filter((b) => (b.type === 'forum_m' || b.type === 'forum') && b.built && !b.enemy); if (!fs.length) return;
      const f = fs.reduce((a, b) => (dist(b, p) < dist(a, p) ? b : a)), x = f.x + rand(-6, 6), z = f.z + 12 + rand(-3, 3);
      c.tpAt = now() + 120; p.x = x; p.z = z; send(p, { type: 'teleport', x, z, text: '🏛 Вы на форуме. Следующий телепорт — через 2 минуты.' }); p.dirtyChar = true; return;
    }
    case 'warCreate': case 'warJoin': case 'warLeave': case 'warHome': case 'ferry': case 'warRent': case 'warPick': case 'warBot': return WAR.warMsg(p, m);
    case 'pvp': { // режим сражения между игроками: бьются только те, у кого он включён
      if (!p.pvp) {
        const C = WG.cityAt(p.x, p.z); if (C && cityOff(C.id).laws.pvp_town && C && Math.hypot(p.x - C.x, p.z - C.z) < C.R) return send(p, { type: 'log', text: 'По закону включать режим сражения в стенах города нельзя.', kind: 'warn' });
        if ((p.pvpOffAt || 0) > now()) return send(p, { type: 'log', text: 'Подождите немного, прежде чем снова включать.', kind: 'warn' });
      } else { if ((p.lastHurtByP || 0) > now() - 10) return send(p, { type: 'log', text: 'В бою режим не выключить — подождите 10 секунд без ударов.', kind: 'warn' }); p.pvpOffAt = now() + 5; }
      p.pvp = !p.pvp; sendRoster(); send(p, { type: 'log', text: p.pvp ? '⚔ Режим сражения включён: вас могут атаковать игроки, у которых он тоже включён.' : '🕊 Режим сражения выключен.', kind: p.pvp ? 'warn' : 'info' }); return;
    }
    case 'gateToggle': { // запереть или открыть ворота города: любое должностное лицо, у ворот
      const C = G.world.cities.find((x) => x.id === m.city); if (!C) return;
      const cs = G.W.cityState && G.W.cityState[C.id]; if (!cs || cs.owner !== 'rome') return;
      if (!localOffices(p.char, C).length) return send(p, { type: 'log', text: 'Ворота запирают и отпирают только должностные лица.', kind: 'warn' });
      if (!C.gates.some((g) => Math.hypot(g.x - p.x, g.z - p.z) < 18)) return send(p, { type: 'log', text: 'Подойдите к воротам.', kind: 'warn' });
      const st = NAV.gateState(C.id); if (st.hp <= 0) return send(p, { type: 'log', text: 'Ворота проломлены — их чинят, когда враги уйдут.', kind: 'warn' });
      st.closed = !st.closed; G.dirtyWorld = true;
      log(st.closed ? `🚪 ${p.char.name} запер(ла) ворота города ${C.name}.` : `🚪 ${p.char.name} открыл(а) ворота города ${C.name}.`, st.closed ? 'warn' : 'info'); return;
    }
    case 'stallSell': return EC.stallSell(p, m.bid);
    case 'ping': return send(p, { type: 'pong', t: m.t });
  }
}
// ---------- Кони ----------
// общественная конюшня: кормят там, содержание 1 ден./мин; своя конюшня (частная): корм — пшено, которое приносит хозяин
function nearStable(p) { return G.W.buildings.find((b) => (b.type === 'stabulum' || b.type === 'equile') && b.built && !b.ruined && Math.hypot(b.x - p.x, b.z - p.z) < BUILDINGS[b.type].r + 7); }
function horseMsg(p, m) {
  const c = p.char; c.horses = c.horses || [];
  const say = (text, kind = 'info') => send(p, { type: 'log', text, kind });
  if (m.type === 'mount') {
    if (!c.horseOut) return say('Нет коня рядом: выведите его из Конюшни.', 'warn');
    if (p.ship || p.inst) return;
    if (!p.mounted && (p.swim || !p.alive)) return;
    const h = c.horses.find((x) => x.id === c.horseOut);
    if (!p.mounted && h && (h.sat ?? 100) <= 0) return say('Конь обессилел от голода — накормите его пшеном (в окне конюшни или «Корм» в сумке).', 'warn');
    p.mounted = !p.mounted; p.dirtyChar = true; sendRoster();
    return say(p.mounted ? '🐎 Вы в седле (V — спешиться).' : 'Вы спешились.');
  }
  if (m.type === 'horseFeed') { // покормить выведенного коня пшеном из сумки
    const h = c.horses.find((x) => x.id === c.horseOut); if (!h) return say('Рядом нет вашего коня.', 'warn');
    if (!takeRes(c, 'wheat', 1)) return say('Нужна пшеница (её выращивают на фермах, продают на рынке).', 'warn');
    h.sat = Math.min(100, (h.sat ?? 100) + 35); p.dirtyChar = true; return say(`🐎 ${h.name} сыт на ${Math.round(h.sat)}%.`);
  }
  const st = nearStable(p); if (!st) return say('Подойдите к конюшне.', 'warn');
  const HE = D.HORSE_ECON, tax = () => EC.tradeTax(st), mine = (b) => b.type === 'equile' && b.owner === c.id;
  const payOwner = (b, gross, what) => { const t2 = Math.round(gross * tax()), net = gross - t2; G.W.treasury += t2; const oc = G.chars[b.owner]; if (oc) { oc.den += net; oc.rentGot = (oc.rentGot || 0) + net; book(oc, 'Доход: Своя конюшня (продажа и аренда коней)', net); } const op = [...G.players.values()].find((q) => q.char && q.char.id === b.owner); if (op) { send(op, { type: 'log', text: `💰 ${c.name}: ${what} — вам ${net} ден. (налог ${t2})`, kind: 'good' }); op.dirtyChar = true; } };
  if (m.type === 'horseBuy' || m.type === 'rentPublic') { // общественная конюшня: коня берут на сутки
    if (st.type !== 'stabulum') return say('Коня на время дают в общественной конюшне.', 'warn');
    const kind = HE.publicRent.includes(m.kind) ? m.kind : HE.publicRent[0], def = D.HORSES[kind];
    if (c.horses.length >= 3) return say('У вас уже три коня.', 'warn');
    const price = Math.round(def.price * HE.rentK * derivedOf(c).buy); if (c.den < price) return say(`Аренда на сутки — ${price} денариев.`, 'warn');
    c.den -= price; G.W.treasury += price;
    c.horses.push({ id: nid(), kind, name: def.name, stable: st.id, sat: 100, until: now() + HE.rentTime, rented: true });
    say(`🐎 ${def.name} взят на сутки за ${price} ден. Он стоит здесь — выведите его.`, 'good');
  } else if (m.type === 'horseBuyFull') { // взрослый конь (жеребец) в собственность — по полной цене
    if (st.type !== 'stabulum') return say('Коней продают в общественной конюшне.', 'warn');
    const def = D.HORSES[m.kind]; if (!def) return;
    if (c.horses.length >= 3) return say('У вас уже три коня.', 'warn');
    const price = Math.round(def.price * derivedOf(c).buy); if (c.den < price) return say(`${def.name} стоит ${price} денариев.`, 'warn');
    c.den -= price; G.W.treasury += price; book(c, 'Кони', -price);
    c.horses.push({ id: nid(), kind: m.kind, name: pick(FOAL_NAMES), stable: st.id, sat: 100 });
    say(`🐎 Куплен ${def.name} — он ваш навсегда и стоит здесь. Выведите его.`, 'good');
  } else if (m.type === 'foalBuy') { // жеребёнок — только владельцу своей конюшни, со скидкой 90%
    if (st.type !== 'stabulum') return say('Жеребят продают в общественной конюшне.', 'warn');
    const eq = G.W.buildings.find((b) => mine(b) && b.built); if (!eq) return say('Жеребят покупают владельцы своих конюшен: сначала постройте Свою конюшню.', 'warn');
    const def = D.HORSES[m.kind]; if (!def) return; eq.stock = eq.stock || [];
    if (eq.stock.length >= HE.stock) return say(`В вашей конюшне уже ${HE.stock} коней.`, 'warn');
    const price = Math.round(def.price * HE.foalK); if (c.den < price) return say(`Жеребёнок стоит ${price} денариев.`, 'warn');
    c.den -= price; book(c, 'Расход: жеребёнок для своей конюшни', -price); eq.stock.push({ id: nid(), kind: m.kind, name: pick(FOAL_NAMES), grow: 0, sat: 100, sale: null, rent: null }); G.dirtyBld = true;
    say(`🐴 Жеребёнок (${def.name}) отправлен в вашу конюшню. Кормите пшеном — через 3 игровых дня вырастет.`, 'good');
  } else if (m.type === 'horseOut') {
    const h = c.horses.find((x) => x.id === m.id); if (!h) return;
    if (h.stable && h.stable !== st.id && G.W.buildings.some((b) => b.id === h.stable)) return say('Этот конь стоит в другой конюшне.', 'warn');
    if (c.horseOut && c.horseOut !== h.id) { const o = c.horses.find((x) => x.id === c.horseOut); if (o) o.stable = st.id; }
    c.horseOut = h.id; h.stable = null; p.mounted = (h.sat ?? 100) > 0; say(`🐎 ${h.name} осёдлан. V — спешиться/сесть.`, 'good');
  } else if (m.type === 'horseStable') {
    const h = c.horses.find((x) => x.id === c.horseOut); if (!h) return;
    if (st.type === 'equile' && st.owner !== c.id && !(h.rentFrom && h.rentFrom.bid === st.id)) return say('Это чужая конюшня — ставьте коня в свою или в общественную.', 'warn');
    h.stable = st.id; c.horseOut = null; p.mounted = false;
    say(st.type === 'stabulum' ? 'Конь оставлен в общественной конюшне: там его кормят, содержание — 1 денарий в минуту.' : 'Конь в вашей конюшне: следите, чтобы в кормушке было пшено.');
  } else if (m.type === 'breed') { // разведение: два своих сытых коня в стойле + пшеница → жеребёнок в стойло
    if (!mine(st)) return say('Разводят коней в своей конюшне.', 'warn');
    st.stock = st.stock || []; if (st.stock.length >= HE.stock) return say(`В конюшне уже ${HE.stock} коней.`, 'warn');
    const pair = c.horses.filter((h) => h.stable === st.id && !h.rented && (h.sat ?? 100) >= 50);
    if (pair.length < 2) return say('Нужны два ваших сытых коня (сытость от 50%) в этом стойле.', 'warn');
    if ((st.store.wheat || 0) < D.BREED.wheat) return say(`Нужно ${D.BREED.wheat} пшеницы в кормушке.`, 'warn');
    st.store.wheat -= D.BREED.wheat;
    const order = Object.keys(D.HORSES), a = order.indexOf(pair[0].kind), b2 = order.indexOf(pair[1].kind);
    let ki = Math.random() < 0.5 ? Math.max(a, b2) : Math.min(a, b2); if (Math.random() < D.BREED.upChance && ki < order.length - 1) ki++;
    st.stock.push({ id: nid(), kind: order[ki], name: pick(FOAL_NAMES), grow: 0, sat: 100, sale: null, rent: null }); G.dirtyBld = true;
    say(`🐴 Родился жеребёнок: ${D.HORSES[order[ki]].name}. Кормите — через 3 игровых дня вырастет.`, 'good');
  } else if (['stockTake', 'stockSale', 'stockRent', 'stockNpc'].includes(m.type)) { // владелец распоряжается своими конями в стойле
    if (!mine(st)) return;
    const f = (st.stock || []).find((x) => x.id === m.id); if (!f) return; const def = D.HORSES[f.kind];
    if (f.grow < HE.grow && m.type !== 'stockSale' && m.type !== 'stockRent') return say('Жеребёнок ещё растёт.', 'warn');
    if (f.out) return say('Этот конь сейчас в аренде.', 'warn');
    if (m.type === 'stockTake') { if (c.horses.length >= 3) return say('У вас уже три коня.', 'warn'); st.stock = st.stock.filter((x) => x !== f); c.horses.push({ id: f.id, kind: f.kind, name: f.name, stable: st.id, sat: f.sat }); say(`🐎 ${f.name} теперь ваш конь.`, 'good'); }
    else if (m.type === 'stockNpc') { const pr = Math.round(def.price * HE.npcK * derivedOf(c).sell); st.stock = st.stock.filter((x) => x !== f); c.den += pr; c.stats2.traded += pr; say(`💰 Конюший с рынка купил ${f.name} за ${pr} ден.`, 'good'); }
    else if (m.type === 'stockSale') { const pr = Math.max(0, Math.min(50000, Number(m.price) | 0)); f.sale = pr || null; say(pr ? `${f.name} выставлен на продажу за ${pr} ден.${f.grow < HE.grow ? ' (купить можно, когда вырастет)' : ''}` : 'Снят с продажи.'); }
    else { const pr = Math.max(0, Math.min(5000, Number(m.price) | 0)); f.rent = pr || null; say(pr ? `${f.name} сдаётся в аренду за ${pr} ден. в сутки.` : 'Аренда снята.'); }
    G.dirtyBld = true;
  } else if (m.type === 'stockBuy' || m.type === 'stockRentTake') { // другой игрок покупает или берёт в аренду коня из чужой конюшни
    if (st.type !== 'equile') return;
    const f = (st.stock || []).find((x) => x.id === m.id); if (!f || f.out) return say('Этого коня уже нет.', 'warn');
    if (f.grow < HE.grow) return say('Конь ещё не вырос.', 'warn');
    if (c.horses.length >= 3) return say('У вас уже три коня.', 'warn');
    const def = D.HORSES[f.kind];
    if (m.type === 'stockBuy') {
      if (!f.sale) return; if (st.owner === c.id) return say('Это ваш конь — возьмите его себе.', 'warn');
      if (c.den < f.sale) return say(`Нужно ${f.sale} денариев.`, 'warn');
      c.den -= f.sale; st.stock = st.stock.filter((x) => x !== f); c.horses.push({ id: f.id, kind: f.kind, name: f.name, stable: st.id, sat: f.sat });
      payOwner(st, f.sale, `купил коня «${f.name}»`); say(`🐎 Куплен ${def.name} «${f.name}» за ${f.sale} ден.`, 'good');
    } else {
      if (!f.rent) return; if (c.den < f.rent) return say(`Аренда — ${f.rent} денариев в сутки.`, 'warn');
      c.den -= f.rent; f.out = c.id; f.outUntil = now() + HE.rentTime;
      c.horses.push({ id: nid(), kind: f.kind, name: f.name, stable: st.id, sat: 100, until: f.outUntil, rented: true, rentFrom: { bid: st.id, sid: f.id } });
      if (st.owner !== c.id) payOwner(st, f.rent, `взял в аренду «${f.name}»`); say(`🐎 ${f.name} взят в аренду на сутки за ${f.rent} ден.`, 'good');
    }
    G.dirtyBld = true;
  } else if (m.type === 'stableFeed') { // положить пшено в кормушку своей конюшни
    if (st.type !== 'equile' || st.owner !== c.id) return;
    const n = Math.min(c.bag.wheat || 0, Math.max(1, Number(m.n) || 10)); if (n <= 0) return say('В сумке нет пшеницы.', 'warn');
    takeRes(c, 'wheat', n); st.store.wheat = Math.round(((st.store.wheat || 0) + n) * 10) / 10; G.dirtyBld = true;
    say(`В кормушке ${st.store.wheat} пшеницы.`);
  }
  p.dirtyChar = true; sendRoster();
}
// корм раз в минуту
const FOAL_NAMES = ['Ветер', 'Буцефал', 'Аквилон', 'Фульгур', 'Кастор', 'Поллукс', 'Сагитта', 'Аврора', 'Луна', 'Стелла', 'Фортуна', 'Цезий', 'Ардор', 'Нотус', 'Зефир'];
export function horsesTick() {
  // кони в стойлах своих конюшен: едят пшено из кормушки (¼ в минуту) и растут; голодные не растут
  for (const b of G.W.buildings) if (b.type === 'equile' && b.foals) { b.stock = [...(b.stock || []), ...b.foals.map((f) => ({ ...f, grow: D.HORSE_ECON.grow, sat: 100, sale: null, rent: null }))]; delete b.foals; delete b.breed; }
  for (const b of G.W.buildings) if (b.type === 'equile' && b.stock && b.stock.length) {
    for (const f of b.stock) {
      if (f.out && now() >= (f.outUntil || 0)) { f.out = null; f.outUntil = null; } // вернулся из аренды
      if (f.out) continue;
      if ((b.store.wheat || 0) >= 0.25) { b.store.wheat = Math.round((b.store.wheat - 0.25) * 100) / 100; f.sat = Math.min(100, (f.sat ?? 100) + 15);
        if (f.grow < D.HORSE_ECON.grow) { f.grow += 60; if (f.grow >= D.HORSE_ECON.grow) { const p = [...G.players.values()].find((q) => q.char && q.char.id === b.owner); if (p) send(p, { type: 'log', text: `🐎 В вашей конюшне вырос ${D.HORSES[f.kind].name} «${f.name}»: продайте, сдайте в аренду или возьмите себе.`, kind: 'good' }); } } }
      else f.sat = Math.max(0, (f.sat ?? 100) - 2);
    }
    G.dirtyBld = true;
  }
  for (const c of Object.values(G.chars)) {
    if (!c.horses || !c.horses.length) continue;
    const old = c.horses.filter((h) => h.until && now() >= h.until);
    if (old.length) { c.horses = c.horses.filter((h) => !old.includes(h)); for (const p of G.players.values()) if (p.char === c) { if (old.some((h) => h.id === c.horseOut)) { c.horseOut = null; p.mounted = false; sendRoster(); } send(p, { type: 'log', text: `🐎 Срок аренды вышел — конь вернулся в конюшню: ${old.map((h) => h.name).join(', ')}.`, kind: 'warn' }); } if (old.some((h) => h.id === c.horseOut)) c.horseOut = null; }
    for (const h of c.horses) {
      h.sat = h.sat ?? 100;
      if (c.horseOut === h.id) { h.sat = Math.max(0, h.sat - 2); continue; }
      const b = h.stable && G.W.buildings.find((x) => x.id === h.stable);
      if (b && b.type === 'stabulum') { if ((c.den || 0) >= 1) { c.den -= 1; book(c, 'Расход: постой коня в общественной конюшне', -1); h.sat = Math.min(100, h.sat + 20); } else h.sat = Math.max(0, h.sat - 2); }
      else if (b && b.type === 'equile') { if ((b.store.wheat || 0) >= 0.25) { b.store.wheat = Math.round((b.store.wheat - 0.25) * 100) / 100; h.sat = Math.min(100, h.sat + 15); G.dirtyBld = true; } else h.sat = Math.max(0, h.sat - 2); }
      else h.sat = Math.max(0, h.sat - 1);
    }
    for (const p of G.players.values()) if (p.char === c) { p.dirtyChar = true; const h = c.horses.find((x) => x.id === c.horseOut); if (p.mounted && h && h.sat <= 0) { p.mounted = false; sendRoster(); send(p, { type: 'log', text: 'Конь обессилел от голода — накормите его пшеном.', kind: 'warn' }); } }
  }
}
export function horseSpeed(p) { const c = p.char; if (!p.mounted || !c.horseOut) return 1; const h = (c.horses || []).find((x) => x.id === c.horseOut); return h ? D.HORSES[h.kind].speed * ((h.sat ?? 100) < 30 ? 0.75 : 1) : 1; }
function onMove(p, m) {
  if (!p.alive) return;
  const t = now(), dt = Math.max(0, Math.min(.3, t - p.lastMv)); p.lastMv = t;
  p.ry = Number(m.ry) || 0; p.run = !!m.run; p.anim = m.a | 0; p.jh = Math.max(0, Math.min(16, Number(m.jh) || 0)); // до 16 м — зритель на трибуне или лучник на башне
  if (p.ship) return;
  const x = Number(m.x), z = Number(m.z);
  if (!isFinite(x) || !isFinite(z)) return;
  const d = Math.hypot(x - p.x, z - p.z), limit = (p.mounted ? 12.5 : Math.min(26, CFG.run * derivedOf(p.char).speed * 1.3))*(p.char.tunaCarry?.55:1);
  p.moveCredit = Math.min(3, (p.moveCredit ?? 3) + limit * dt);
  const maxD = p.moveCredit + (t - (p.dodgeT || 0) < .6 ? 1.5 : 0);
  const platform = !!m.pj && !p.mounted && !p.inst && G.W.buildings.some(b => b.type === 'amphitheatrum' && b.built && Math.hypot(b.x - p.x,b.z - p.z) < 65 && Math.hypot(b.x-x,b.z-z)<65 && d<75);
  if (d > maxD && !platform) { send(p, { type: 'teleport', x: p.x, z: p.z }); return; } // pj — сел на трибуну или поднялся на башню (место далеко от входа)
  if (p.inst) { const I = G.instances.get(p.inst); if (I && !I.walkable(x, z)) return; }
  else if (Math.abs(x) > CFG.world - 5 || Math.abs(z) > CFG.world - 5) return;
  p.moveCredit = Math.max(0, p.moveCredit - d); p.x = x; p.z = z;
  const ground = p.inst ? G.instances.get(p.inst)?.y0 || 60 : Math.max(0, WG.deckHeight(x,z,G.W.buildings) ?? WG.terrainHeight(x,z));
  p.y = ground + Math.max(0, Math.min(16, (Number(m.y) || ground) - ground));
  p.swim = !p.inst && WG.terrainHeight(x, z) < -1.1 && WG.deckHeight(x, z, G.W.buildings) == null && !(p.jh > 0);
  if (p.fishing && Math.hypot(p.x - p.fishing.x, p.z - p.fishing.z) > CFG.fishCastR + 6) { p.fishing = null; send(p, { type: 'fishEnd' }); }
  if (p.mounted && p.swim) { p.mounted = false; sendRoster(); }
}
function eat(p, res) {
  const c = p.char;
  if (!res) { // самое сытное, что есть
    res = Object.keys(c.bag).filter((k) => RES[k] && RES[k].food && c.bag[k] > 0).sort((a, b) => RES[a].food - RES[b].food).find((k) => c.sat + RES[k].food <= 115) || Object.keys(c.bag).find((k) => RES[k] && RES[k].food && c.bag[k] > 0);
  }
  if (!res || !RES[res] || !RES[res].food || !c.bag[res]) return send(p, { type: 'log', text: 'Нечего есть.', kind: 'warn' });
  if (c.sat >= 100) return send(p, { type: 'log', text: 'Вы сыты.', kind: 'info' });
  takeRes(c, res, 1); c.sat = Math.min(100, c.sat + RES[res].food);
  p.hp = Math.min(derivedOf(c).maxHp, p.hp + RES[res].food * 0.3);
  if (res === 'wine') p.buffs.wine = now() + 120;
  send(p, { type: 'log', text: `Вы съели: ${RES[res].name}`, kind: 'info' }); p.dirtyChar = true;
}
function bandage(p) {
  const c = p.char, t = now();
  if (!c.bag.bandage || t < (p.healReady || 0) || !p.alive) return;
  takeRes(c, 'bandage', 1); p.healReady = t + 2.5; p.poison = 0;
  p.hp = Math.min(derivedOf(c).maxHp, p.hp + RES.bandage.heal + c.level * 2);
  fx({ kind: 'heal', x: p.x, z: p.z, pid: p.id }); p.dirtyChar = true;
}
function equip(p, uid) {
  const c = p.char, i = c.items.findIndex((x) => x.uid === uid); if (i < 0) return;
  const it = c.items[i], g = GEAR[it.k]; if (!g) return;
  const slot = g.slot;
  if (slot === 'offhand' && c.gear.weapon && ['bow', 'spear'].includes(GEAR[c.gear.weapon.k].kind) && GEAR[c.gear.weapon.k].kind === 'bow') return send(p, { type: 'log', text: 'С луком щит не взять.', kind: 'warn' });
  c.items.splice(i, 1);
  if (c.gear[slot]) c.items.push(c.gear[slot]);
  c.gear[slot] = it;
  if (slot === 'weapon' && g.kind === 'bow' && c.gear.offhand) { c.items.push(c.gear.offhand); c.gear.offhand = null; }
  if (slot === 'weapon' && g.kind !== 'rod') p.fishing = null;
  p.dirtyChar = true; sendRoster();
}
function unequip(p, slot) {
  const c = p.char; if (!c.gear[slot]) return;
  if (c.items.length >= 24) return send(p, { type: 'log', text: 'Нет места в снаряжении.', kind: 'warn' });
  c.items.push(c.gear[slot]); c.gear[slot] = null; p.dirtyChar = true; sendRoster();
}
function chat(p, text) {
  text = String(text || '').trim().slice(0, 200); if (!text) return;
  if (text.startsWith('/') && (DEV || process.env.FAST === '1')) return devCommand(p, text);
  if (cheatCode(p, text)) return;
  broadcast({ type: 'chat', name: p.char.name, color: p.char.color, text, office: officeOf(p.char.id) });
}
// ---------- Коды (вводятся в чат, никому не показываются; CHEATS=0 — выключить) ----------
const CHEATS = { SUBSIDIUM: 'kit', AURUM: 'money', DENARII: 'money', COPIA: 'res', NAVIS: 'ship', TRIREMIS: 'trireme', PENTERES: 'penteres', EQUUS: 'horse', FIDES: 'fides', GLORIA: 'gloria' };
// речь с ростр форума: только должностные лица, стоя на помосте
function speech(p, text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200), c = p.char, off = officeOf(c.id);
  if (!t) return;
  if (!off) return send(p, { type: 'log', text: 'С ростр говорят только должностные лица.', kind: 'warn' });
  if (!WG.rostraAt(p.x, p.z, G.W.buildings)) return send(p, { type: 'log', text: 'Поднимитесь на ростры форума.', kind: 'warn' });
  if (c.speechAt && now() - c.speechAt < 20) return send(p, { type: 'log', text: 'Дайте народу обдумать прошлую речь.', kind: 'warn' });
  const bonus = !c.speechBonus || now() - c.speechBonus > 300; c.speechAt = now();
  broadcast({ type: 'speech', name: c.name, office: off, text: t });
  if (bonus) { c.speechBonus = now(); CB.grantDig(p, 3, 'речь с ростр'); }
}
export function cheatCode(p, text) {
  const [w, arg] = text.trim().toUpperCase().split(/\s+/), kind = CHEATS[w];
  if (!kind) return false;
  if(process.env.CHEATS==='0'){send(p,{type:'log',text:'Игровые коды отключены администратором сервера.',kind:'warn'});return true;}
  const c = p.char, say = (t) => send(p, { type: 'log', text: '🔑 ' + t, kind: 'good' });
  if (kind === 'kit') { // по 20 основных ресурсов и 500 денариев — не чаще раза в 10 минут
    const left = Math.ceil((c.kitAt || 0) - now()); if (left > 0) { send(p, { type: 'log', text: `🔑 SUBSIDIUM снова можно через ${Math.floor(left / 60)} мин ${left % 60} с.`, kind: 'warn' }); return true; }
    c.kitAt = now() + 600; c.den += 500; for (const k of ['wood', 'stone', 'plank', 'brick', 'iron', 'clay', 'leather', 'linen', 'wheat', 'bread']) addRes(c, k, 20, true); say('+500 денариев и по 20 брёвен, камня, досок, кирпичей, железа, глины, кожи, льна, пшеницы и хлеба'); }
  else if (kind === 'money') { const n = Math.max(1, Math.min(100000, Number(arg) || 1000)); c.den += n; say(`+${n} денариев`); }
  else if (kind === 'res') { const n = Math.max(1, Math.min(500, Number(arg) || 50)); for (const k of ['wood', 'stone', 'plank', 'brick', 'iron', 'clay', 'marble', 'leather', 'linen', 'bread']) addRes(c, k, n, true); say(`+${n} каждого строительного ресурса и хлеба`); }
  else if (kind === 'fides') { const n = Math.max(1, Math.min(20000, Number(arg) || 500)); CB.grantDig(p, n, 'код',false); say(`+${n} одобрения Рима (звание — взнос в курии)`); }
  else if (kind === 'gloria') { const n = Math.max(1, Math.min(20000, Number(arg) || 300)); c.milPts = (c.milPts || 0) + n; say(`+${n} военных очков`); }
  else if (kind === 'horse') { c.horses = c.horses || []; const h = { id: nid(), kind: 'albus', name: D.HORSES.albus.name }; c.horses.push(h); c.horseOut = h.id; p.mounted = true; sendRoster(); say('Белый скакун под седлом (V — спешиться).'); }
  else {
    const t = kind === 'trireme' ? 'trireme' : kind === 'penteres' ? 'penteres' : SHIPS[String(arg || '').toLowerCase()] ? String(arg).toLowerCase() : 'scapha';
    let sp = null; for (let r = 8; r < 260 && !sp; r += 4) for (let i = 0; i < 24; i++) { const x = p.x + Math.cos(i * 0.26) * r, z = p.z + Math.sin(i * 0.26) * r; if (WG.shipOk(x, z) && WG.shipOk(x + 7, z) && WG.shipOk(x - 7, z) && WG.shipOk(x, z + 7) && WG.shipOk(x, z - 7)) { sp = { x, z }; break; } }
    if (!sp) { send(p, { type: 'log', text: 'Рядом нет глубокой воды.', kind: 'warn' }); return true; }
    const def = SHIPS[t]; G.W.ships.push({ id: nid(), type: t, owner: c.id, ownerName: c.name, name: `${def.name.split(' ')[0]} «Фортуна»`, x: sp.x, z: sp.z, ry: 0, hp: def.hp, maxHp: def.hp, cargo: {}, speed: 0 });
    G.dirtyWorld = true; say(`${def.name} ждёт у берега в ${Math.round(Math.hypot(sp.x - p.x, sp.z - p.z))} м.`);
  }
  p.dirtyChar = true; return true;
}
const officeOf = cid => { const c=G.chars[cid]; if(!c) return null; const p=[...G.players.values()].find(p=>p.char?.id===cid); return localOffices(c,p||c)[0]||null; };
function devCommand(p, text) {
  const [cmd, a, b] = text.slice(1).split(/\s+/), c = p.char;
  const tp = (x, z) => { p.x = x; p.z = z; send(p, { type: 'teleport', x, z }); };
  switch (cmd) {
    case 'give': for (const k of ['wood', 'stone', 'plank', 'brick', 'iron', 'leather', 'linen', 'clay', 'marble', 'cedar']) addRes(c, k, Number(a) || 40, true); break;
    case 'store': for (const k of ['wood', 'stone', 'plank', 'brick', 'iron', 'marble']) G.W.storage[k] = (G.W.storage[k] || 0) + 300; G.dirtyWorld = true; break;
    case 'money': c.den += Number(a) || 1000; break;
    case 'lvl': { const n = Number(a) || 5; for (let i = 0; i < n; i++) CB.grantXp(p, D.xpNeed(c.level)); break; }
    case 'dig': CB.grantDig(p, Number(a) || 200); break;
    case 'gear': if (GEAR[a]) addGear(c, a, Number(b) || 0); break;
    case 'res': if (RES[a]) addRes(c, a, Number(b) || 10, true); break;
    case 'tp': { const isl = WG.islandById(a); if (isl) { for (let r = 0; r < isl.r; r += 5) { const x = isl.x + r, z = isl.z; if (WG.terrainHeight(x, z) > 1) { tp(x, z); break; } } } else if (a === 'city') tp(WG.CITY.x, WG.CITY.z); else if (G.world.entrances.find((e) => e.id === a)) { const e = G.world.entrances.find((x) => x.id === a); tp(e.x, e.z + 6); } else if (a === 'camp') { const k = G.world.camps[Number(b) || 0]; tp(k.x + 25, k.z); } else if (a === 'scribe') { const h = G.world.pois.find((q) => q.npc === 'scribe'); tp(h.x + 5, h.z); } else if (a === 'site') { const s = G.world.colonySites[Number(b) || 0]; tp(s.x + 16, s.z); } break; }
    case 'event': SO.startRandomEvent(a); break;
    case 'build': for (const bb of G.W.buildings) if (!bb.built && dist(bb, p) < 60) { bb.prog = { ...bb.cost }; EC.completeBuilding(bb, p); } break;
    case 'threat': G.W.threat = Number(a) || 80; G.dirtyWorld = true; break;
    case 'time': G.W.time += Number(a) || 300; break;
    case 'hour': { const h = Math.max(3, Math.min(23.5, Number(a) || 12)), L = CFG.dayLength; G.W.time = Math.floor(G.W.time / L) * L + ((h - 3) / (23 + 55 / 60 - 3)) * (2 / 3) * L; G.dirtyWorld = true; break; } // часы дня (для проверки скупщика)
    case 'scraps': c.scraps = 5; break;
    case 'story': G.W.story = Math.min(D.STORY.length, Number(a) || G.W.story + 1); G.W.flags = G.W.flags || {}; if (G.W.story > 4) G.W.flags.scribe = true; if (G.W.story > 5) G.W.flags.scraps = true; G.dirtyWorld = true; break;
    case 'elect': G.W.electionAt = 0; SO.electionTick(); break;
    case 'rank': { const n = Math.max(0, Math.min(D.RANKS.length - 1, Number(a) || 0)); c.rankBought = n; c.dig = Math.max(c.dig || 0, D.RANKS[n].dig); break; }
    case 'office': { const cid0 = cityNear(p.x, p.z), mine = officeHolds(c).filter((h) => !(h.city === cid0 && h.k === a)); if (mine.length >= D.MAX_OFFICES) delete cityOff(mine[0].city).offices[mine[0].k]; cityOff(cid0).offices[a] = { id: c.id, name: c.name, since: Date.now() }; G.dirtyWorld = true; break; }
    case 'heal': p.hp = derivedOf(c).maxHp; p.st = derivedOf(c).maxSt; c.sat = 100; break;
    case 'god': p.godUntil = now() + 3600; break;
    case 'spawn': if (ENEMIES[a]) CB.spawnMob(a, p.x + 6, p.z + 6, { lvl: Number(b) || 1 }); break;
    case 'ship': { const t = SHIPS[a] ? a : 'scapha'; let s = null; for (let r = 8; r < 200 && !s; r += 4) for (let i = 0; i < 16; i++) { const x = p.x + Math.cos(i * 0.39) * r, z = p.z + Math.sin(i * 0.39) * r; if (WG.shipOk(x, z) && WG.shipOk(x + 6, z) && WG.shipOk(x - 6, z)) { s = { x, z }; break; } } if (s) G.W.ships.push({ id: nid(), type: t, owner: c.id, ownerName: c.name, name: SHIPS[t].name, x: s.x, z: s.z, ry: 0, hp: SHIPS[t].hp, maxHp: SHIPS[t].hp, cargo: {}, speed: 0 }); G.dirtyWorld = true; break; }
    case 'eship': { const s = SO.spawnEnemyShip(a === 'punic' ? 'punic_ship' : 'pirate_ship', p.x + (b === 'near' ? 14 : 120), p.z, { mode: b === 'near' ? 'patrol' : 'hunt', lvl: 4 }); if (b === 'near') s.hp = s.maxHp * 0.4; break; } // /eship pirate near — рядом и потрёпанный (проверка абордажа)
    case 'arena': { const bb = EC.builtOf('amphitheatrum')[0]; if (bb) tp(bb.x, bb.z); break; }
    case 'save': saveAll(); break;
    case 'def': { const st = G.W.cityState[a]; if (st) { st.def = Number(b) || 0; G.dirtyWorld = true; } break; }
    case 'killnear': { const r = Number(a) || 40; for (const m of [...G.mobs.values()]) if (m.hp > 0 && D.HOSTILE.has(m.faction) && Math.hypot(m.x - p.x, m.z - p.z) < r) { m.kneelDone = true; CB.killMob(m, p); } break; }
    case 'slave': { const gr = Math.max(1, Math.min(4, Number(a) || 3)); G.W.slaves.push({ id: nid(), name: 'Тест', origin: 'тест', owner: c.id, grade: gr, skill: 2, ...D.rollSlave(gr), bld: null }); G.dirtyWorld = true; break; }
    case 'tmap': SC.giveTreasureMap(p, 'Тест'); break;
    case 'squad': { const k = D.SQUADS[a] ? a : 'inf'; c.squads = c.squads || []; c.squads.push({ id: nid(), type: k, name: D.SQUADS[k].name.split(' ')[0] + ' (тест)', up: {}, xp: 0, lvl: 1, form: 'line', mode: 'follow', live: [], lost: 0, kills: 0 }); p.dirtyChar = true; break; }
    case 'games': { G.W.gamesDay = G.W.day; const L = CFG.dayLength; G.W.time = Math.floor(G.W.time / L) * L + ((13 - 3) / (23 + 55 / 60 - 3)) * (2 / 3) * L; break; } // Великие игры — сейчас
    case 'mil': c.milPts = (c.milPts || 0) + (Number(a) || 500); p.dirtyChar = true; break;
    case 'arenaoff': if (G.arena) { for (const m of [...G.mobs.values()]) if (m.arena) G.mobs.delete(m.id); G.arena = null; } break;
    case 'ap': c.ap = (c.ap || 0) + (Number(a) || 100); break;
    case 'captive': { const mm = CB.spawnMob(a && ENEMIES[a] ? a : 'barb_warrior', p.x + 2, p.z + 2, { lvl: 1 }); mm.hp = 1; mm.kneel = now() + 30; mm.kneelDone = true; mm.state = 'kneel'; break; }
    case 'goto': tp(Number(a), Number(b)); break;
    default: send(p, { type: 'log', text: 'Команды: /give /store /money /lvl /dig /gear k q /res k n /tp main|ferrum|marmor|murex|silva|aegyptus|punic|city|cave|mine|tomb|fortress|camp N|scribe|site N /event rome|barb|punic|storm|tuna|merchant|pirates|inspect /build /threat /time /scraps /story N /elect /office k /heal /god /spawn type lvl /ship type /eship /arena /save', kind: 'info' });
  }
  p.dirtyChar = true;
}

// ---------- Такт ----------
let lastT = now(), tickN = 0;
function tick() {
  const t = now(), dt = Math.min(0.1, t - lastT); lastT = t; tickN++;
  const W = G.W;
  W.time += dt;
  const day = Math.floor(W.time / CFG.dayLength) + 1;
  if (day !== W.day) { W.day = day; log(`🌅 Наступил день ${day} колонии.`, 'info'); G.dirtyWorld = true; }
  CB.resolvePendingHits();
  CB.updateMobs(dt);
  CB.updateProj(dt);
  EC.updateShips(dt);
  SO.updateEnemyShips(dt);
  T.tradeTick(dt); GL.gladTick(now()); CP.campaignTick(dt); RT.routesTick(dt); AR.armyTick(dt);
  EC.updateSchools(dt); TN.tunaTick(dt);
  if(G.dirtyRoster){G.dirtyRoster=false;sendRoster();}
  for (const p of G.players.values()) playerTick(p, dt, t);
  if (tickN % 5 === 0) { EC.fishingTick(); for (const p of G.players.values()) CB.pickupDrops(p); SO.musterTick(); }
  if (tickN % 20 === 0) { // раз в секунду
    CB.populate(); EC.spawnSchools(); EC.nodesRespawn(); SO.eventsTick(); SO.questBoardTick(); SO.electionTick(); SO.lawTick(); SO.arenaTick(); SO.instancesTick(); CB.syncGarrison();
    if (tickN % 40 === 0) { EC.towersTick(); ledgerTick(); }
    for (const d of G.drops.values()) if (t > d.until) { G.drops.delete(d.id); }
  }
  if (tickN % 20 === 0) { NAV.gateTick(); WAR.warTick(); }
  if (tickN % 20 === 0) GL.gamesTick();
  if (tickN % 60 === 0) { AR.watchTick(); for (const p of G.players.values()) if (p.char && !p.bot && p.wCity && cityNear(p.x, p.z) !== p.wCity) sendWorld(p); }
  if (tickN % 1200 === 0) { EC.productionTick(); EC.upkeepTick(); horsesTick(); GL.ludusTick(); EC.marketDrift(); EC.refreshSlaveMarket(); if (W.favor > 40) { W.treasury += Math.round(W.favor / 5); } G.dirtyWorld = true; }
  if (tickN % 12000 === 0) EC.breadTick();
  if (tickN % (CFG.saveEvery * 20) === 0) saveAll();
  if (tickN % 2 === 0) sendState();
  if (G.dirtyBld && tickN % 4 === 0) { G.dirtyBld = false; for (const p of G.players.values()) sendBuildings(p); }
  if (G.dirtyWorld && tickN % 10 === 0) { G.dirtyWorld = false; for (const p of G.players.values()) sendWorld(p); }
  for (const p of G.players.values()) if (p.dirtyChar && tickN % 3 === 0) { p.dirtyChar = false; sendChar(p); }
}
function playerTick(p, dt, t) {
  const c = p.char, d = derivedOf(c);
  if (!p.alive) {
    if (t - p.deadAt > CFG.respawnTime) {
      if (p.inst) { const I = G.instances.get(p.inst); if (I) I.players.delete(p.id); p.inst = null; p.x = p.instRet.x; p.z = p.instRet.z; send(p, { type: 'instExit', x: p.x, z: p.z }); }
      else { const sp = WAR.warSpawnOf(p) || spawnPoint(c); p.x = sp.x; p.z = sp.z; }
      p.alive = true; p.hp = d.maxHp; p.st = d.maxSt * 0.5; p.godUntil = t + 3;
      send(p, { type: 'respawn', x: p.x, z: p.z });
    }
    return;
  }
  // голод
  c.sat = Math.max(0, c.sat - dt * 100 / 1800);
  // выносливость
  const busy = p.block || (p.run && p.moving) || t - (p.lastSt || 0) < 0.8;
  if (p.run && p.anim & 1) p.st = Math.max(0, p.st - CFG.stamina.run * dt);
  if (p.block) p.st = Math.max(0, p.st - 2 * dt);
  else if (!(p.run && p.anim & 1)) p.st = Math.min(d.maxSt, p.st + CFG.stamina.regen * dt * (c.sat > 0 ? 1 : 0.5));
  // здоровье
  const bath = EC.builtOf('thermae').find((b) => dist(p, b) < BUILDINGS.thermae.r + 3);
  if (bath) { p.hp = Math.min(d.maxHp, p.hp + d.maxHp * 0.06 * dt); if (!p.buffs.bath || p.buffs.bath < t + 300) { if (!p.buffs.bath || p.buffs.bath < t) send(p, { type: 'log', text: '♨ Термы: раны заживают, +25% опыта на 10 минут.', kind: 'good' }); p.buffs.bath = t + 600; } }
  else if (c.sat > 15 && t - (p.lastHurt || 0) > 6) p.hp = Math.min(d.maxHp, p.hp + d.maxHp * 0.012 * dt);
  if (c.sat <= 0 && Math.random() < dt * 0.3) { p.hp -= 1; if (p.hp <= 0) CB.killPlayer(p, null); }
  if (p.poison > t) { p.hp -= 2.2 * dt; if (p.hp <= 0) CB.killPlayer(p, null); }
  if (p.hp > d.maxHp) p.hp = d.maxHp;
  // в воде долго нельзя: усталость
  if (p.swim && p.ship) p.swim = false;
  if (p.swim) { p.st = Math.max(0, p.st - 3 * dt); if (p.st <= 0) { p.hp -= 4 * dt; if (p.hp <= 0) CB.killPlayer(p, null); } }
}

// ---------- Рассылка ----------
const NEAR = 230;
function sendState() {
  const t = now(), warStatus = G.war?.lobbies?.size ? WAR.warPublic() : null;
  const plist = [];
  for (const q of G.players.values()) {
    const at = q.lastAtk && t - q.lastAtk.t < 1.2 ? [q.lastAtk.kind, r1(t - q.lastAtk.t), q.lastAtk.combo] : null;
    plist.push([q.id, r1(q.x), r1(q.z), Math.round(q.ry * 100) / 100, (q.alive ? 1 : 0) | (q.run ? 2 : 0) | (q.block ? 4 : 0) | (q.swim ? 8 : 0) | (t - (q.dodgeT || 0) < CFG.dodgeTime ? 16 : 0) | (q.fishing ? 32 : 0) | ((q.anim & 1) ? 64 : 0) | (q.fishing && q.fishing.state === 'bite' ? 128 : 0), Math.round(q.hp / derivedOf(q.char).maxHp * 100), q.ship || 0, q.seat ?? -1, q.inst || 0, at, q.fishing ? [r1(q.fishing.x), r1(q.fishing.z)] : null, q.jh ? r1(q.jh) : 0]);
  }
  const ships = G.W.ships.map((s) => [s.id, s.type, r1(s.x), r1(s.z), Math.round(s.ry * 100) / 100, r1(s.speed), Math.round(s.hp / s.maxHp * 100)]);
  const eships = [...G.eships.values()].map((s) => [s.id, s.type, r1(s.x), r1(s.z), Math.round(s.ry * 100) / 100, r1(s.speed), Math.round(s.hp / s.maxHp * 100)]);
  // налётчики (набеги варваров и десант Карфагена) — для карты: откуда идёт угроза
  const raidDots = []; for (const m of G.mobs.values()) if (m.hp > 0 && m.src && m.src.kind === 'raid' && !m.inst && raidDots.length < 200) raidDots.push([r1(m.x), r1(m.z), m.def.faction === 'punic' ? 1 : 0]);
  for (const e of G.eships.values()) if (e.raid && raidDots.length < 220) raidDots.push([r1(e.x), r1(e.z), 2]);
  for (const p of G.players.values()) {
    if (!p.ws || p.ws.readyState !== 1) continue;
    const c = p.char, d = derivedOf(c);
    const mobs = [];
    for (const m of G.mobs.values()) {
      if (m.inst !== p.inst || Math.abs(m.x - p.x) > NEAR || Math.abs(m.z - p.z) > NEAR) continue;
      const st = m.kneel ? 6 : m.hp <= 0 ? 3 : m.state === 'wind' ? 2 : m.moving === 2 ? 4 : m.moving ? 1 : m.drinking ? 5 : 0;
      mobs.push([m.id, m.type, r1(m.x), r1(m.z), Math.round(m.ry * 100) / 100, Math.round(Math.max(0, m.hp) / m.maxHp * 100), st, m.lvl, st === 2 ? r1((t - m.windStart) / (m.windEnd - m.windStart)) : 0, m.squad ? (m.squad.owner === p.char.id ? m.squad.sq : -1) : 0, m.squad && m.squad.owner !== p.char.id && m.squad.sq !== 'guard' ? 'q' + m.squad.sq : m.grp ? m.grp.id : 0, (m.squad || m.grp) && !(m.squad && m.squad.owner === p.char.id) ? m.gname || '' : 0, m.team ? !!(p.war && p.war.lid === m.war && p.war.team !== m.team) : D.HOSTILE.has(m.faction)]);
    }
    const proj = [];
    for (const pr of G.proj.values()) if (pr.inst === p.inst && t >= pr.born && Math.abs(pr.x - p.x) < 150 && Math.abs(pr.z - p.z) < 150) proj.push([pr.id, pr.kind, r1(pr.x), r1(pr.y), r1(pr.z), r1(pr.vx), r1(pr.vy), r1(pr.vz)]);
    const drops = [];
    for (const dd of G.drops.values()) if (dd.inst === p.inst && Math.abs(dd.x - p.x) < 90 && Math.abs(dd.z - p.z) < 90) drops.push([dd.id, dd.k, dd.x, dd.z, dd.q]);
    const fc = [];
    for (const cr of G.crates.values()) if (!p.inst && Math.abs(cr.x - p.x) < 220 && Math.abs(cr.z - p.z) < 220) fc.push([cr.id, D.CRATES[cr.k].grade, r1(cr.x), r1(cr.z), cr.ground ? 1 : 0]);
    const ec = []; for (const e of G.eships.values()) if (e.crew != null && Math.abs(e.x - p.x) < 200 && Math.abs(e.z - p.z) < 200) ec.push([e.id, Math.round(Math.max(0, e.crew) / T.crewMax(e) * 100), e.prey ? 1 : 0]);
    const schools = [];
    if (!p.inst) for (const s of G.schools.values()) if (Math.abs(s.x - p.x) < 320 && Math.abs(s.z - p.z) < 320) schools.push([s.id, r1(s.x), r1(s.z), s.kind]);
    const ar = G.arena ? { mode: G.arena.mode, list: G.arena.mode === 'games' ? G.arena.list.map((g) => ({ key: g.key, name: g.name, owner: g.owner })) : undefined, st: G.arena.state, wave: G.arena.wave, f: [...G.arena.fighters], duel: !!G.arena.duel, names: G.arena.names, ids: G.arena.ids, x: G.arena.x, z: G.arena.z, t: Math.max(0, Math.round(G.arena.t - t)) } : null;
    send(p, { type: 's', tuna: TN.tunaState(p), wa: warStatus, bd: T.boardDecks(), rd: raidDots, cv: RT.convoyState(), t: r1(W_time()), me: [Math.round(p.hp), d.maxHp, Math.round(p.st), d.maxSt, Math.round(c.sat), p.alive ? 1 : 0, p.poison > t ? 1 : 0, (p.buffs.bath || 0) > t ? 1 : 0], p: plist, m: mobs, pr: proj, d: drops, sh: ships, es: eships, f: schools, fc, ec, ar, mu: G.muster ? [r1(G.muster.x), r1(G.muster.z), Math.round(G.muster.until - t)] : null });
  }
}
const W_time = () => G.W.time;
let bldCache = null, bldCacheT = -1; // список зданий одинаков для всех — собираем и упаковываем один раз за такт
function sendBuildings(p) {
  if (bldCacheT !== tickN || !bldCache) { bldCacheT = tickN; bldCache = JSON.stringify(bldsPayload()); }
  if (p.ws && p.ws.readyState === 1) p.ws.send(bldCache);
}
function bldsPayload() {
  return ({ type: 'blds', list: G.W.buildings.map((b) => ({ id: b.id, type: b.type, x: b.x, z: b.z, ry: b.ry, owner: b.owner, ownerName: b.ownerName, built: b.built, prog: b.prog, cost: b.cost, hp: Math.round(b.hp), maxHp: b.maxHp, ruined: b.ruined, store: b.store, level: b.level, island: b.island, workers: G.W.slaves.filter((s) => s.bld === b.id).length, done: b.done, orders: b.orders, crates: b.crates, muni: b.muni ? 1 : 0, cell: b.cell, city: b.city, enemy: b.enemy ? 1 : 0, cls: b.cls, dmul: b.dmul, sale: b.sale || undefined, autoStore: b.autoStore !== false, scope: LG.logisticsScope(b), capacity: LG.storeCapacity(b), housing: D.BUILDINGS[b.type]?.housing || 0, residents: G.W.slaves.filter(s => s.home === b.id).length, crafts: b.crafts, lat: b.lat ? 1 : 0, stock: b.stock, glads: b.type === 'ludus' ? G.W.slaves.filter((x) => x.ludus === b.id).map((x) => ({ id: x.id, name: x.name, owner: x.owner, ownerName: (G.chars[x.owner] || {}).name || '?', glvl: x.glvl || 0, grade: x.grade, trait: x.trait, sale: x.sale || null })) : undefined, rooms: b.type === 'insula' ? EC.insulaRooms(b).map((r) => ({ bot: !!r.bot, name: r.name, left: r.until ? Math.max(0, Math.round(r.until - now())) : null })) : undefined })) });
}
function sendWorld(p) {
  const W = G.W, t = now();
  const cid = cityNear(p.x, p.z), CO = { id: cid, name: (G.world.cities.find((C) => C.id === cid) || {}).name || cid, o: cityOff(cid) }, LV = CO.o.lawVote; if (p.wCity !== cid) p.dirtyChar = true; p.wCity = cid; // должности и законы — того города, где игрок
  send(p, {
    type: 'world', war: WAR.warPublic(), gladTop: G.W.slaves.filter((x) => (x.gw || 0) + (x.glvl || 0) > 0).sort((a, b) => ((b.gw || 0) * 3 + (b.glvl || 0)) - ((a.gw || 0) * 3 + (a.glvl || 0))).slice(0, 15).map((x) => ({ name: x.name, owner: (G.chars[x.owner] || {}).name || '?', lvl: x.glvl || 0, w: x.gw || 0 })), horseStables: W.buildings.filter((b) => b.type === 'equile' && b.built && (b.stock || []).some((f) => f.sale || f.rent)).map((b) => ({ id: b.id, x: b.x, z: b.z, owner: b.ownerName, sale: b.stock.filter((f) => f.sale && f.grow >= D.HORSE_ECON.grow).length, rent: b.stock.filter((f) => f.rent && !f.out && f.grow >= D.HORSE_ECON.grow).length })), gamesIn: W.gamesDay != null ? W.gamesDay - W.day : null, gamesLog: W.gamesLog || [], gates: W.gates || {}, watch: Object.fromEntries(Object.entries(W.watch || {}).map(([k, v]) => [k, { n: v.n, lvl: v.lvl, live: (v.live || []).length }])), sci: W.sci || {}, plots: W.plots || {}, plotNames: Object.fromEntries([...new Set(Object.values(W.plots || {}))].map((cid) => [cid, G.chars[cid] ? G.chars[cid].name : '?'])), cityState: CP.cityInfo(), fleetBuilt: W.fleetBuilt || {}, romeSent: W.romeSent || {}, treasury: Math.round(W.treasury), storage: W.storage, city: CO.id, cityName: CO.name, laws: CO.o.laws, offices: CO.o.offices, cityOffices: Object.fromEntries(romanCities().map((C) => [C.id, { name: C.name, offices: cityOff(C.id).offices }])), election: CO.o.election ? { ends: Math.round(CO.o.election.ends - t), offices: Object.fromEntries(Object.entries(CO.o.election.offices).map(([k, o]) => [k, Object.fromEntries(Object.entries(o.cands).map(([cid, cc]) => [cid, { name: cc.name, votes: Object.values(cc.votes).reduce((a, v) => a + v, 0), mine: !!cc.votes[p.char.id] }]))])) } : null,
    electionIn: Math.max(0, Math.round(W.electionAt - W.time)), questsIn: W.questsAt ? Math.max(0, Math.round((W.questsAt - Date.now()) / 1000)) : null,
    lawVote: LV ? { key: LV.key, opt: LV.opt, by: LV.by, ends: Math.round(LV.ends - t), yes: Object.values(LV.votes).filter((v) => v.yes).reduce((a, v) => a + v.w, 0), no: Object.values(LV.votes).filter((v) => !v.yes).reduce((a, v) => a + v.w, 0), mine: LV.votes[p.char.id] ? (LV.votes[p.char.id].yes ? 1 : -1) : 0 } : null, canLaw: Object.fromEntries(Object.keys(D.LAWS).map((k) => [k, SO.canPropose(p.char, CO.id, k)])),
    story: W.story, flags: W.flags || {}, threat: Math.round(W.threat), favor: Math.round(W.favor), day: W.day, time: Math.round(W.time),
    events: W.events.filter((e) => e.until > t || e.live).map((e) => ({ kind: e.kind, title: e.title, text: e.text, left: Math.round(e.until - t), x: e.x, z: e.z, foe: e.foe, cx: e.cx, cz: e.cz })),
    requests: W.requests.filter((r) => !r.done).map((r) => ({ id: r.id, res: r.res, n: r.n, got: r.got, left: Math.round(r.until - t), den: r.den })),
    quests: W.quests, trophies: W.trophies.slice(0, 10), chronicle: W.chronicle.slice(0, 15), slaveMarket: W.slaveMarket, slaves: W.slaves.filter((s) => s.owner === p.char.id), garrison: W.garrison, arenaRecord: W.arenaRecord, priority: W.priority, market: W.market,
    ships: W.ships.map((s) => ({ forSale: s.forSale || 0, route: s.route || null, berth: s.berth || null, id: s.id, type: s.type, name: s.name, owner: s.owner, ownerName: s.ownerName, cargo: s.cargo, tunaHold: s.tunaHold || [null,null], hp: Math.round(s.hp), maxHp: s.maxHp, starter: !!s.starter, crates: s.crates || [], up: s.up || {}, berth: s.berth || null, archers: W.slaves.filter((x) => x.ship === s.id).map((x) => x.id), troops: [...G.players.values()].filter((q) => q.ship === s.id && q.char).reduce((a, q) => a + (q.char.squads || []).filter((x) => x.aboard === s.id).reduce((b, x) => b + Math.min(6, (D.SQUADS[x.type] || {}).n || 3), 0), 0) })),
    camps: W.camps, online: G.players.size,
  });
}
function sendChar(p) {
  const c = p.char;
  send(p, { type: 'char', c: { housing: LG.housingCapacity(c), cityResources: LG.availableResources(c, p), tutorial: c.tradeTutorial || 0, officePoints: c.officePoints || {}, doneQuests: c.doneQuests || [], sci: SC.sciPublic(c), rankEarned: D.rankIdx(c.dig || 0), milPts: c.milPts || 0, army: AR.armyOf(c), routes: RT.routesOf(c.id), routeLimit: RT.routeLimit(c), dests: { sea: RT.destinations('sea').map((d) => [d.id, d.name]), land: RT.destinations('land').map((d) => [d.id, d.name]) }, permits: c.permits || {}, lat: c.lat || null, rentGot: c.rentGot || 0, ledger: c.ledger || {}, warRent: c.warRent || [], warPick: c.warPick || [], lore: c.lore || {}, cellLimit: LD.cellLimit(c), id: c.id, name: c.name, color: c.color, level: c.level, xp: c.xp, need: D.xpNeed(c.level), points: c.points, stats: c.stats, dig: c.dig, rank: rankOf(c), den: Math.round(c.den), bag: c.bag, gear: c.gear, items: c.items, quests: c.quests, scraps: c.scraps || 0, trophies: c.trophies.slice(-20), armor: Math.round(gearArmor(c)), slow: gearSlow(c), bagW: Math.round(bagWeight(c) * 10) / 10, bagMax: derivedOf(c).bag, home: c.home, stats2: c.stats2, instCd: c.instCd, office: localOffices(c, p)[0] || null, offices: localOffices(c, p), allOffices: officesOf(c), shipLimit: shipLimitOf(c), slaveLimit: EC.slaveCapacity(c), offs: officeHolds(c).map((h) => ({ ...h, cityName: (G.world.cities.find((C) => C.id === h.city) || {}).name || h.city })), kills: c.kills, ap: c.ap || 0, tamer: c.tamer || 0, lions: c.lions || [], arenaGear: c.arenaGear || {}, carry: c.carry || null, tunaCarry: c.tunaCarry || null, guildCrates: c.guildCrates || {}, quadScraps: c.quadScraps || 0, sunk: c.sunk || [], spec: c.spec || {}, specPts: c.specPts || 0, torch: !!c.torch, horses: (c.horses || []).map((h) => (h.until ? { ...h, left: Math.max(0, Math.round(h.until - now())) } : h)), horseOut: c.horseOut || null, mounted: !!p.mounted, war: p.war || null, tpLeft: Math.max(0, Math.round((c.tpAt || 0) - now())) } });
}
function sendRoster() {
  const list = [...G.players.values()].map((q) => { const h = q.char.horseOut && (q.char.horses || []).find((x) => x.id === q.char.horseOut); return { id: q.id, cid: q.char.id, office: officeOf(q.char.id), ...charPublic(q.char), horse: h ? h.kind : null, mounted: !!q.mounted, pvp: !!q.pvp }; });
  broadcast({ type: 'roster', list });
}

// ---------- Подключение ----------
// общая лодка колонии у причала стартового лагеря (если утонула или пропала — появляется снова)
function ensureStarterBoat() {
  if (G.W.ships.some((s) => s.starter)) return;
  const P = WG.PIER, c = Math.cos(P.ry), sn = Math.sin(P.ry);
  let pos = null;
  for (const [lx, lz] of [[3.4, 11], [3.6, 14], [-3.4, 12], [3.4, 18], [0, 22]]) { const x = P.x + lx * c + lz * sn, z = P.z - lx * sn + lz * c; if (WG.shipOk(x, z)) { pos = { x, z }; break; } }
  if (!pos) return;
  G.W.ships.push({ id: nid(), type: 'scapha', owner: null, ownerName: 'колония', name: 'Лодка колонии', starter: true, x: r1(pos.x), z: r1(pos.z), ry: P.ry, hp: SHIPS.scapha.hp, maxHp: SHIPS.scapha.hp, cargo: {}, speed: 0 });
  G.dirtyWorld = true;
}
export function startRpg(wss) {
  loadAll();
  ensureStarterBoat(); setInterval(() => { try { ensureStarterBoat(); } catch {} }, 120000);
  EC.refreshSlaveMarket(true); SO.questBoardTick(); LG.housingTick();
  CB.setCombatHooks({ arenaKnockout: SO.arenaKnockout, leaveShip: (p) => { p.ship = null; p.seat = null; } });
  CB.setShipHit(SO.hitEnemyShip); CB.setKneelFn(GL.tryKneel); SO.setBoutFn(GL.boutTick);
  EC.setShipSunkHook(T.onShipSunk); EC.setBerthFn((type, port) => T.freeBerth(type, port, 200, port.id)); EC.setBerthDeckFn((s) => { const b = T.berthByKey(s.type, s.berth); return b && b.deck; }); CB.setSquadFns(AR.squadSlot, AR.squadKill); SC.setTerrain(WG.terrainHeight); CB.setTreasureFn(SC.giveTreasureMap); T.setTreasureFn(SC.giveTreasureMap); SO.setEnemySunkHook((e, q) => { T.onEnemySunk(e, q); CP.onEnemySunk(e, q); }); CB.setBoardFn(T.boardStrike); T.setTradeHooks({ hitEnemyShip: SO.hitEnemyShip }); EC.setEnemyShipHit(SO.hitEnemyShip); SO.setDmgFn((q, n) => CB.damagePlayer(q, n, null));
  setInterval(() => { try { tick(); } catch (e) { console.error('[RPG] такт:', e); } }, 1000 / CFG.tick);
  wss.on('connection', (ws, req) => {
    let p = null, budget = 0, budgetAt = now(); const ip = req?.socket?.remoteAddress || 'local';
    ws.on('message', (raw, isBin) => {
      if (isBin) return;
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.type !== 'string') return;
      if (now() - budgetAt > 1) { budget = 0; budgetAt = now(); }
      if (++budget > 80) return;
      if (!p) { if (m.type === 'join' && allowLogin('ip:' + ip)) { try { p = join(ws, m); } catch (e) { console.error('[RPG] вход:', e.message); send({ ws }, { type: 'error', text: 'Не удалось войти.' }); } } return; }
      if (G.players.get(p.id) !== p) return;
      try { handle(p, m); } catch (e) { console.error('[RPG]', m.type, e); }
    });
    ws.on('close', () => { if (p) { log(`${p.char.name} покинул(а) колонию.`, 'info'); dropPlayer(p); } });
  });
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { saveAll(); });
  console.log('[RPG] Сервер RPG запущен (/rpg)');
}
export { saveAll };
