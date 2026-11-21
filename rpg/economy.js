import {announce} from './state.js';
import { overlaps } from '../public/rpg/footprints.js';
import { baseSalePrice, purchasePrice } from '../public/rpg/pricing.js';
import { privateStores, availableResources, payResources, autoStoreProduction, housingCapacity, housingTick } from './logistics.js';
import { shipCargoAllowed, cargoAccess, nearShip, localOffices, hasCityOffice, cityOf } from './access.js';
// Добыча, сундуки, стройка, производства и рабы, рынок, ремесло, корабли, рыбалка, порты, колонии
import { G, D, WG, now, dist, rand, randi, pick, nid, angDiff, send, broadcast, log, fx, chronicle, addRes, takeRes, canTake, hasAll, payAll, addGear, hasTool, derivedOf, rankOf, bagFree, bagWeight, slaveLimitOf, shipLimitOf , book, hasOffice, holderOf, cityOff, lawsAt } from './state.js';
import { grantXp, grantDig, dropItem, spawnMob, shoot, damagePlayer, nearestBuildingFor } from './combat.js';
import { questHook, storyCheck } from './society.js';
import { landCheck, onPlaced, colonyProd } from './land.js';

const { CFG, RES, GEAR, QUALITY, BUILDINGS, SHIPS, RECIPES, PORTS, FISH, CHESTS } = D;
const B = (id) => G.W.buildings.find((b) => b.id === id);
// здания вражеских городов (b.enemy) Риму не служат; большой форум Мессаны считается форумом
const ALIAS = { forum: 'forum_m', macellum: 'mercator' };
export const builtOf = (type) => G.W.buildings.filter((b) => (b.type === type || ALIAS[type] === b.type) && b.built && !b.ruined && !b.enemy);
export const hasBuilt = (type) => builtOf(type).length > 0;
const isOffice = (p, k) => !!p.char && hasCityOffice(p.char, k, cityOf(p));
const anyOffice = p => !!p.char && localOffices(p.char, p).length > 0;

// ---------- Добыча ресурсов ----------
export function nodeAmt(n) { const s = G.W.nodes[n.id]; return s ? s.a : n.max; }
export function gatherPose(p,m){
 if(m.active===false){p.gathering=null;return;}
 const n=G.nodeById.get(m.id|0);if(!n||!p.alive||p.ship||p.inst||p.char.carry||p.char.tunaCarry||dist(p,n)>5.5||nodeAmt(n)<=0)return;
 if(n.tool==='axe'&&!hasTool(p.char,'chop')||n.tool==='pick'&&!hasTool(p.char,'mine'))return;
 p.ranged=null;p.gathering={tool:n.tool,node:n.id,until:now()+1.5};
 p.lastAtk={t:now(),kind:n.tool==='pick'?'tool':n.tool==='axe'?'axe':'fist',combo:0};
}
export function gather(p, id) {
  const c = p.char, n = G.nodeById.get(id), t = now();
  if (!n || !p.alive || p.ship || p.inst || c.carry || c.tunaCarry) return;
  if (dist(p, n) > 5.5) return;
  if (t < (p.gatherReady || 0) - 0.15) return;
  const a = nodeAmt(n);
  if (a <= 0) return;
  if (n.tool === 'axe' && !hasTool(c, 'chop')) return send(p, { type: 'log', text: 'Нужен топор.', kind: 'warn' });
  if (n.tool === 'pick' && !hasTool(c, 'mine')) return send(p, { type: 'log', text: 'Нужна кирка.', kind: 'warn' });
  const yieldN = 1 + (Math.random() < Math.min(0.75, c.level * 0.02 + (c.stats.str || 0) * 0.01 + D.specOf(c, 'gath') * 0.08) ? 1 : 0);
  const got = addRes(c, n.res, D.specTop(c, 'gath') && Math.random() < 0.25 ? yieldN * 3 : yieldN);
  if (!got) return send(p, { type: 'log', text: 'Сумка полна. Продайте или сдайте ресурсы на склад.', kind: 'warn' });
  p.gatherReady = t + 1.1;
  const left = a - 1;
  G.W.nodes[n.id] = { a: left, t: left <= 0 ? t + CFG.nodeRespawn * rand(0.8, 1.6) : (G.W.nodes[n.id]?.t || 0) };
  broadcast({ type: 'node', id: n.id, a: left });
  c.stats2.gathered += got;
  grantXp(p, 1.5);
  send(p, { type: 'loot', text: `+${got} ${RES[n.res].name}`, k: n.res });
  questHook(p, 'gather', { res: n.res, n: got });
  p.dirtyChar = true;
}
export function nodesRespawn() {
  const t = now();
  for (const [id, s] of Object.entries(G.W.nodes)) {
    if (s.t === -1) continue; // вырублено под постройку
    if (s.a <= 0 && s.t && t > s.t) { delete G.W.nodes[id]; const n = G.nodeById.get(Number(id)); if (n) broadcast({ type: 'node', id: n.id, a: n.max }); }
    else if (s.a > 0 && s.a < (G.nodeById.get(Number(id))?.max || 0) && (!s.t || t > s.t + 600)) { delete G.W.nodes[id]; }
  }
}

// ---------- Сундуки ----------
const ch_r = (ch) => (WG.rockAt(ch.x, ch.z) || { r: 8 }).r;
export function boardWreck(p,id){
 const d=WG.wreckDecks().find(d=>d.id===id);if(!d||!p.alive||p.inst)return;
 const ship=p.ship&&G.W.ships.find(s=>s.id===p.ship);if(p.ship&&!ship)return;
 const limit=ship?SHIPS[ship.type].len/2+7:8,origin=ship||p;if(dist(origin,d)>limit)return;
 if(ship&&Math.abs(ship.speed||0)>1)return send(p,{type:'log',text:'Остановите корабль рядом с обломками.',kind:'warn'});
 const x=d.x-Math.sin(d.ry)*3,z=d.z-Math.cos(d.ry)*3;
 if(ship&&p.seat===0){ship.speed=0;p.helmIn=null;}
 Object.assign(p,{x,z,y:d.y,jh:0,ship:null,seat:null,mounted:false,swim:false,moveSpeed:0,moveCredit:0,moveBudgetAt:now(),lastMv:now(),dirtyChar:true});
 send(p,{type:'teleport',x,z,y:d.y,left:true,text:'Вы на обломках. Подойдите к сундуку и нажмите E. Вернуться на корабль можно обычной посадкой.'});return true;
}
export function openChest(p, id) {
  const ch = G.chestById.get(id), c = p.char, t = now();
  if (!ch || !p.alive || p.inst) return;
  if (ch.sea ? !((p.ship && dist(p, ch) < ch_r(ch) + 14) || dist(p, ch) < 3.5) : dist(p, ch) > 3.5) return; // сундук на скале открывают с борта корабля
  if ((G.W.chests[id] || 0) > t) return send(p, { type: 'log', text: 'Сундук пуст. Загляните позже.', kind: 'info' });
  const def = CHESTS[ch.kind], lvl = WG.islandLevel[ch.island] || 1;
  const got = [];
  const entries = Object.entries(def.loot).sort(() => Math.random() - 0.5).slice(0, randi(2, 3));
  for (const [res, [a, b]] of entries) {
    const n = Math.round(randi(a, b) * (1 + lvl * 0.08)); if (n <= 0) continue;
    const k = addRes(c, res, n); if (k < n) dropItem(p.x, p.z, res, n - k);
    got.push(`${n} ${RES[res].name}`);
  }
  const den = Math.round(randi(...def.den) * (1 + lvl * 0.1)); c.den += den; got.push(`${den} денариев`);
  if (Math.random() < def.gear) {
    const pool = Object.keys(GEAR).filter((k) => !GEAR[k].rare && GEAR[k].tier <= Math.min(3, 1 + Math.floor(lvl / 4)));
    const k = pick(pool), q = Math.random() < 0.08 + lvl * 0.01 ? 2 : Math.random() < 0.35 ? 1 : 0;
    if (addGear(c, k, q)) got.push(`${GEAR[k].name} (${QUALITY[q].name})`); else dropItem(p.x, p.z, k, 1, q);
  }
  if (def.quad && Math.random() < def.quad) { c.quadScraps = (c.quadScraps || 0) + 1; got.push(`📜 лоскут чертежа квадриремы (${c.quadScraps}/4)`); }
  if (G.W.story >= 5 && (c.scraps || 0) < 5 && Math.random() < (ch.kind === 'ornate' || ch.kind === 'wreck' ? 0.45 : 0.18)) { c.scraps = (c.scraps || 0) + 1; got.push(`обрывок папируса (${c.scraps}/5)`); }
  G.W.chests[id] = t + rand(...CFG.chestRespawn);
  if (ch.kind === 'crate') { // простой ящик разламывается и потом появляется в другом месте острова
    const isl = WG.islandById(ch.island);
    if (isl) for (let i = 0; i < 80; i++) {
      const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * isl.r * 0.9, x = isl.x + Math.cos(a) * d, z = isl.z + Math.sin(a) * d;
      if (WG.terrainHeight(x, z) < 1 || WG.slopeAt(x, z, 1.5).d > 1.5 || WG.waterEdgeDist(x, z) < 3) continue;
      if (G.W.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < (BUILDINGS[b.type]?.r || 5) + 4)) continue;
      if (isl.id === 'main' && Math.hypot(x - WG.CITY.x, z - WG.CITY.z) < WG.CITY.r) continue;
      ch.x = Math.round(x * 10) / 10; ch.z = Math.round(z * 10) / 10; G.W.chestPos = G.W.chestPos || {}; G.W.chestPos[id] = { x: ch.x, z: ch.z }; break;
    }
    G.W.chests[id] = t + rand(180, 420);
  }
  broadcast({ type: 'chest', id, until: G.W.chests[id], x: ch.kind === 'crate' ? ch.x : undefined, z: ch.kind === 'crate' ? ch.z : undefined, broke: ch.kind === 'crate' });
  send(p, { type: 'log', text: `📦 ${def.name}: ${got.join(', ')}`, kind: 'good' });
  fx({ kind: 'chest', x: ch.x, z: ch.z, id });
  grantXp(p, 8 + lvl * 2);
  questHook(p, 'chest', { kind: ch.kind, island: ch.island });
  p.dirtyChar = true;
}

// ---------- Стройка ----------
export function costOf(type, pos = null) {
  const def = BUILDINGS[type];
  const mul = def.pub && pos && holderOf('aedilis', cityOf(pos)) ? 0.85 : 1;
  const cost = {};
  for (const [k, n] of Object.entries(def.cost)) cost[k] = Math.ceil(n * mul);
  return cost;
}
export function placeCheck(p, type, x, z, ry, moving = false) {
  const def = BUILDINGS[type], c = p.char;
  if (!def) return 'Нет такой постройки';
  if(type==='via_cell')return 'Городские улицы прокладывает местный эдил через Курию.';
  if (def.need && !def.need.every((k) => hasBuilt(k))) return 'Сначала постройте: ' + def.need.filter((k) => !hasBuilt(k)).map((k) => BUILDINGS[k].name).join(', ');
  const isl = WG.islandAt(x, z);
  if (def.colony) {
    const site = G.world.colonySites.find((s) => Math.hypot(s.x - x, s.z - z) < 12);
    if (!site) return 'Колонию можно основать только на отмеченном месте соседнего острова';
    if (G.W.buildings.some((b) => b.type === 'colonia' && b.site === site.id)) return 'Здесь колония уже есть';
    return null;
  }
  if (def.road) {
    if (!isl || isl.id !== 'main') return 'Дороги и мосты — только на главном острове';
    if (def.bridge) { if (WG.bridgeRy(x, z) == null) return 'Мост ставят над рекой или озером так, чтобы оба конца были на берегу'; }
    else {
      if (WG.terrainHeight(x, z) < 0.5) return 'Слишком близко к воде';
      if (WG.slopeAt(x, z, Math.min(3, def.len / 2)).d > 2.6) return 'Слишком крутой склон для дороги';
    }
    for (const b of G.W.buildings) { const bd = BUILDINGS[b.type]; const d = Math.hypot(b.x - x, b.z - z); if (bd.road ? d < Math.min(bd.len, def.len) / 2 + 0.5 : d < bd.r + 1.5) return bd.road ? 'Здесь уже есть дорога' : 'Мешает постройка: ' + bd.name; }
    if (!moving && !Object.entries(costOf(type,{x,z})).every(([k,n])=>(availableResources(c,{x,z})[k]||0)>=n)) return 'Нужно в сумке и личном городском складе: ' + Object.entries(costOf(type)).map(([k, n]) => `${RES[k].name} ×${n}`).join(', ');
    return null;
  }
  let L = null;
  if (def.pub || def.muni || def.cat === 'muni') return 'Городские здания стоят на своих местах — их не строят, а восстанавливают (E у руин).';
  else {
    const mine = G.W.buildings.filter((b) => b.owner === c.id && !BUILDINGS[b.type].colony && !b.muni);
    const rk = D.RANKS[rankOf(c)], lim = rk.priv + (c.lat ? D.LATIFUNDIUM.extraPriv : 0);
    if (!moving && mine.length >= lim) return `Ваше звание (${rk.name}) позволяет не больше ${lim} частных построек`;
    if ((def.rank || 0) > rankOf(c)) return `Нужно звание «${D.RANKS[def.rank].name}»`;
    if (!moving && def.ap && (c.ap || 0) < def.ap) return `Нужно ${def.ap} очков арены (бои на Арене)`;
    if (!moving && def.limit && mine.filter((b) => b.type === type).length >= def.limit) return 'У вас уже есть такая постройка';
    L = landCheck(p, type, x, z, ry); if (L.err) return L.err;
    x = L.x; z = L.z; p._land = L;
  }
  const r = def.r;
  if(WG.portOverlap(x,z,r,G.W.buildings.filter(b=>b.type==='portus')))return 'Здесь территория гавани: оставьте свободными здания порта, набережную и проходы к причалам.';
  const h = WG.terrainHeight(x, z);
  if (h < (def.shore ? 0.2 : 0.5)) return 'Слишком близко к воде';
  if (def.shore) {
    if (WG.seaDir(x, z, r) == null) return 'Это здание ставится у самой воды: наведите на берег моря';
  } else {
    const sl = WG.slopeAt(x, z, r * 0.75);
    if (sl.lo < 0.2) return 'Часть площадки уходит в воду';
    if (sl.d > Math.max(3.5, r * 0.4)) return 'Слишком крутой склон';
    if (WG.waterEdgeDist(x, z) < r + 22 && type !== 'fishery') return 'На речном склоне не строят — отойдите от реки или озера';
  }
  for (const b of G.W.buildings) { if (moving && b.id === moving) continue; if(overlaps({type,x,z,ry:L?.ry??ry},def,b,BUILDINGS[b.type]))return 'Мешает другая постройка: '+BUILDINGS[b.type].name; }
  for (const q of G.world.pois) if (q.type !== 'statue' && Math.hypot(q.x - x, q.z - z) < (q.r || 6) + r + 2) return 'Мешает: ' + (q.name || 'место');
  return null;
}
export function placeBuilding(p, type, x, z, ry) {
  x = Number(x); z = Number(z); ry = Number(ry) || 0;
  if (!isFinite(x) || !isFinite(z)) return;
  if (dist(p, { x, z }) > 80) return;
  if (BUILDINGS[type] && BUILDINGS[type].shore) { const sn = WG.shoreSnap(x, z, BUILDINGS[type].r, WG.SHORE_FRONT[type]); if (sn) { x = sn.x; z = sn.z; ry = sn.ry; } }
  p._land = null;
  const err = placeCheck(p, type, x, z, ry);
  if (err) return send(p, { type: 'log', text: '🚫 ' + err, kind: 'warn' });
  const def = BUILDINGS[type], c = p.char, LND = p._land;
  if (LND) { x = LND.x; z = LND.z; ry = LND.ry; }
  let site = null;
  if (def.colony) { site = G.world.colonySites.find((s) => Math.hypot(s.x - x, s.z - z) < 12); x = site.x; z = site.z; }
  if (def.shore && WG.seaDir(x, z, def.r) != null && !WG.shoreSnap(x, z, def.r, WG.SHORE_FRONT[type])) ry = WG.seaDir(x, z, def.r);
  if (def.road) { // дорога и мост кладутся сразу из сумки
    if (def.bridge) ry = WG.bridgeRy(x, z);
    const cost = costOf(type, { x, z }); if (!payResources(c,{x,z},cost)) return;
    G.W.buildings.push({ id: nid(), by: c.id, type, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, ry: Math.round(ry * 100) / 100, owner: null, ownerName: null, built: true, prog: { ...cost }, cost, hp: 100, maxHp: 100, ruined: false, store: {}, slaves: [], level: 1, lastProd: now(), contrib: {}, island: 'main', placed: Date.now(), done: Date.now() });
    for (const n of G.world.nodes) if (Math.hypot(n.x - x, n.z - z) < def.r + 0.5) G.W.nodes[n.id] = { a: 0, t: -1 };
    c.stats2.built++; grantXp(p, 3); grantDig(p, 1); p.dirtyChar = true; G.dirtyBld = true;
    return;
  }
  if (def.ap) c.ap = (c.ap || 0) - def.ap;
  const cost = costOf(type, { x, z });
  if (!def.pub && !def.colony) for (const k in cost) cost[k] = Math.max(1, Math.ceil(cost[k] * (1 - D.specOf(c, 'build') * 0.06)));
  const b = { id: nid(), type, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, ry: Math.round(ry * 100) / 100, owner: def.pub ? null : c.id, ownerName: def.pub ? null : c.name, built: false, prog: {}, cost, hp: 0, maxHp: Object.values(cost).reduce((a, n) => a + n, 0) * 10, ruined: false, store: {}, slaves: [], level: 1, lastProd: now(), contrib: {}, site: site ? site.id : null, island: site ? site.island : 'main', placed: Date.now() };
  if (def.colony) { b.owner = c.id; b.ownerName = c.name; b.crafts = [1, 0, 0, 0, 0]; }
  if (LND) onPlaced(p, b, LND);
  G.W.buildings.push(b);
  // вырубаем ресурсы под постройкой
  for (const n of G.world.nodes) if (Math.abs(n.x - b.x) < def.r + 1 && Math.abs(n.z - b.z) < def.r + 1 && Math.hypot(n.x - b.x, n.z - b.z) < def.r + 0.8) { G.W.nodes[n.id] = { a: 0, t: -1 }; }
  G.dirtyBld = true;
  log(`🏗 ${c.name} заложил(а) стройку: ${def.name}${def.colony ? ' — ' + D.ISLANDS.find((i) => i.id === b.island).name : ''}`, 'info');
  if (FASTB) { b.prog = { ...cost }; completeBuilding(b, p); }
}
const FASTB = process.env.FAST === '1';
// снос постройки: дорогу — кто её положил, эдил, префект (или любой, если обе должности свободны); частное — хозяин; возврат части материалов
export function demolish(p, bid) {
  const b = B(bid), c = p.char; if (!b) return;
  if(b.type==='via_cell'&&cityOff(b.city).offices.aedilis?.id!==c.id)return;
  const def = BUILDINGS[b.type], say = (t, k = 'warn') => send(p, { type: 'log', text: t, kind: k });
  if (dist(p, b) > 60 && !(b.owner === c.id && !def.pub)) return say('Подойдите ближе.'); // своё частное здание можно снести издалека (из «Владений»)
  const o = cityOff(b.city || 'messana').offices, official = (o.aedilis && o.aedilis.id === c.id) || (o.praefectus && o.praefectus.id === c.id), vacant = !o.aedilis && !o.praefectus;
  if (def.colony || !def.pub) { if (b.owner !== c.id) return say('Сносить можно только свои постройки.'); }
  else if (!(official || vacant || (def.road && b.by === c.id))) return say(def.road ? 'Дорогу сносит тот, кто её положил, эдил или префект.' : 'Общественные здания сносят эдил или префект.');
  const k = (def.road ? 0.5 : 0.3) * (D.specTop(c, 'build') ? 2 : 1), back = [];
  for (const [r, n] of Object.entries(b.built ? b.cost : b.prog || {})) { const m = Math.floor(n * k); if (m > 0) { addRes(c, r, m, true); back.push(`${RES[r].name} ×${m}`); } }
  G.W.buildings = G.W.buildings.filter((x) => x !== b);
  if(b.type==='via_cell')WG.setCityRoadCells(G.W.buildings);
  for (const sl of G.W.slaves) if (sl.bld === b.id) sl.bld = null;
  for (const s of G.W.ships) if (s.berth && s.berth.startsWith('b' + b.id + ':')) s.berth = null;
  G.dirtyBld = true; G.dirtyWorld = true; p.dirtyChar = true;
  if (!def.road) log(`🔨 ${c.name} снёс(ла) «${def.name}».`, 'info');
  say(`🔨 Снесено: ${def.name}${back.length ? '. Возвращено: ' + back.join(', ') : ''}`, 'info');
}
// перенос постройки на новое место (бесплатно): частное — хозяин; общественное — эдил/префект или любой, если обе должности свободны
export function moveBuilding(p, bid, x, z, ry) {
  const b = B(bid), c = p.char; if (!b) return;
  const def = BUILDINGS[b.type];
  x = Number(x); z = Number(z); ry = Number(ry) || 0;
  if (!isFinite(x) || !isFinite(z) || dist(p, { x, z }) > 90) return;
  const say = (t) => send(p, { type: 'log', text: t, kind: 'warn' });
  if (def.colony) return say('Колонию перенести нельзя.');
  if (!b.built) return say('Сначала достройте здание.');
  if (!def.pub && b.owner !== c.id) return say('Это чужая постройка.');
  if (def.pub) { const o = cityOff(b.city || 'messana').offices; const mine = (o.aedilis && o.aedilis.id === c.id) || (o.praefectus && o.praefectus.id === c.id); if (!mine && (o.aedilis || o.praefectus)) return say('Общественные здания переносят эдил или префект.'); }
  if (def.lat || b.muni) return say('Это здание не переносится.');
  const i = G.W.buildings.indexOf(b); G.W.buildings.splice(i, 1);
  p._land = null;
  const err = placeCheck(p, b.type, x, z, ry, true);
  if (!err && p._land) { x = p._land.x; z = p._land.z; ry = p._land.ry; b.dmul = p._land.dmul || 1; if (p._land.blk) b.blk = p._land.blk; }
  G.W.buildings.splice(i, 0, b);
  if (err) return say('🚫 ' + err);
  if (def.shore) ry = WG.seaDir(x, z, def.r);
  if (def.bridge) ry = WG.bridgeRy(x, z);
  b.x = Math.round(x * 10) / 10; b.z = Math.round(z * 10) / 10; b.ry = Math.round(ry * 100) / 100;
  for (const n of G.world.nodes) if (Math.hypot(n.x - b.x, n.z - b.z) < def.r + 0.8) G.W.nodes[n.id] = { a: 0, t: -1 };
  G.dirtyBld = true;
  log(`⇄ ${c.name} перенёс(ла) «${def.name}» на новое место.`, 'info');
}
export function deliver(p, bid, fromStore = false) {
  const b = B(bid), c = p.char;
  if (!b || b.built || dist(p, b) > BUILDINGS[b.type].r + 6) return;
  const def = BUILDINGS[b.type];
  if (b.owner && b.owner !== c.id) return send(p, { type: 'log', text: 'Стройка принадлежит другому игроку.', kind: 'warn' });
  if (fromStore && !def.pub && !def.colony) return send(p, { type: 'log', text: 'Склад колонии — только для общественных построек.', kind: 'warn' });
  if (fromStore && !anyOffice(p)) return send(p, { type: 'log', text: 'Брать со склада колонии могут только должностные лица.', kind: 'warn' });
  let n = 0;
  for (const [k, need] of Object.entries(b.cost)) {
    const left = need - (b.prog[k] || 0); if (left <= 0) continue;
    let k2;
    if (fromStore) { k2 = Math.min(left, G.W.storage[k] || 0); G.W.storage[k] = (G.W.storage[k] || 0) - k2; if (!G.W.storage[k]) delete G.W.storage[k]; }
    else { k2 = takeRes(c, k, left); if (b.owner === c.id && k2 < left) for (const wh of privateStores(c, b)) { const n = Math.min(left - k2, wh.store[k] || 0); wh.store[k] = (wh.store[k] || 0) - n; k2 += n; if (k2 >= left) break; } }
    b.prog[k] = (b.prog[k] || 0) + k2; n += k2;
  }
  if (!n) return send(p, { type: 'log', text: fromStore ? 'На складе нет нужных ресурсов.' : 'У вас нет нужных ресурсов.', kind: 'warn' });
  if (!fromStore) { b.contrib[c.id] = (b.contrib[c.id] || 0) + n; grantXp(p, n * 1.5); if (b.muni) grantDig(p, Math.max(1, Math.ceil(n * 0.15))); } // восстановление городских руин — одобрение Рима сразу
  else G.dirtyWorld = true;
  G.dirtyBld = true; p.dirtyChar = true;
  fx({ kind: 'deliver', x: b.x, z: b.z });
  if (Object.entries(b.cost).every(([k, need]) => (b.prog[k] || 0) >= need)) completeBuilding(b, p);
}
export function completeBuilding(b, p) {
  const def = BUILDINGS[b.type];
  b.built = true; b.hp = b.maxHp; b.lastProd = now(); b.done = Date.now(); housingTick();
  G.dirtyBld = true;
  log(`🏛 Построено: ${def.name}!`, 'good');
  chronicle(`Возведено: ${def.name}${b.ownerName ? ` (${b.ownerName})` : ''}`);
  fx({ kind: 'built', x: b.x, z: b.z, type: b.type });
  const total = Object.values(b.cost).reduce((a, n) => a + n, 0);
  const prio = G.W.priority === b.type ? 2 : 1;
  for (const [cid, n] of Object.entries(b.contrib)) {
    const q = [...G.players.values()].find((x) => x.char && x.char.id === cid);
    const ch = G.chars[cid]; if (!ch) continue;
    const dig = Math.round((def.pub ? 0.6 : 0.25) * n * prio + (def.pub ? 5 : 2));
    if (q) { grantDig(q, dig); grantXp(q, n * 2); q.char.stats2.built++; send(q, { type: 'log', text: `Ваш вклад в «${def.name}»: +${dig} достоинства`, kind: 'good' }); }
    else ch.dig = (ch.dig || 0) + dig;
  }
  if (G.W.priority === b.type) G.W.priority = null;
  if (b.type === 'castra') G.W.garrison = Math.max(G.W.garrison, 2);
  if(b.type==='colonia'){const isl=D.ISLANDS.find(i=>i.id===b.island),resources=(D.COLONY_RES[b.island]||[]).map(([k])=>D.RES[k]?.name||k).join(', ');announce('colony',`🚩 ${p?.char?.name||b.ownerName||'Рим'} основал(а) колонию на острове «${isl?.name||b.island}»!${resources?' Промыслы: '+resources+'.':''}`);}
  storyCheck();
  G.dirtyWorld = true;
}
export function damageBuilding(b, dmg, by) {
  if (!b.built || b.ruined) return;
  b.hp -= dmg;
  if (!b.lastAlarm || now() - b.lastAlarm > 25) { b.lastAlarm = now(); log(`⚠ Нападение на «${BUILDINGS[b.type].name}»${b.ownerName ? ` (${b.ownerName})` : ''}!`, 'bad'); }
  if (b.hp <= 0) {
    b.hp = 0; b.ruined = true; G.dirtyBld = true;
    log(`🔥 «${BUILDINGS[b.type].name}» разрушено! Нужен ремонт (камень и доски).`, 'bad');
    chronicle(`Налётчики разрушили: ${BUILDINGS[b.type].name}`);
    fx({ kind: 'ruin', x: b.x, z: b.z });
  } else if (Math.random() < 0.2) G.dirtyBld = true;
}
export function repairCost(b) { const total = Object.values(b.cost).reduce((a, n) => a + n, 0); return { stone: Math.ceil(total * 0.15), plank: Math.ceil(total * 0.1) }; }
export function repair(p, bid, useStore = false) {
  const b = B(bid), c = p.char;
  if (!b || !b.built || dist(p, b) > BUILDINGS[b.type].r + 6) return;
  if (!b.ruined && b.hp >= b.maxHp) return;
  if (b.owner && b.owner !== c.id) return send(p, { type: 'log', text: 'Это чужая постройка.', kind: 'warn' });
  const cost = repairCost(b);
  const mul = b.ruined ? 1 : (1 - b.hp / b.maxHp);
  const W = G.W, st = W.storage || {}, pub = BUILDINGS[b.type].pub || b.muni;
  const fromStore = useStore && anyOffice(p) && pub && Object.entries(cost).every(([k, n]) => (st[k] || 0) >= Math.ceil(n * mul));
  if (!isOffice(p, 'aedilis')) {
    if (fromStore) { for (const [k, n] of Object.entries(cost)) st[k] -= Math.ceil(n * mul); G.dirtyWorld = true; }
    else {
      if (!Object.entries(cost).every(([k, n]) => (availableResources(c, b)[k] || 0) >= Math.ceil(n * mul))) return send(p, { type: 'log', text: `Для ремонта нужно: ${Object.entries(cost).map(([k, n]) => Math.ceil(n * mul) + ' ' + RES[k].name).join(', ')}${useStore && !anyOffice(p) ? ' (со склада берут только должностные лица)' : ''}`, kind: 'warn' });
      payResources(c, b, cost, mul);
    }
  }
  b.ruined = false; b.hp = b.maxHp; G.dirtyBld = true; p.dirtyChar = true;
  // одобрение Рима за ремонт — по размеру работы (своими материалами — больше)
  const work = Object.values(cost).reduce((a, n) => a + n, 0) * mul;
  grantDig(p, Math.max(3, Math.round(work * (fromStore ? 0.05 : 0.15)))); log(`🔧 ${c.name} отремонтировал(а): ${BUILDINGS[b.type].name}`, 'good');
}

// продажа своего здания другому игроку: хозяин назначает цену, покупатель жмёт «Купить» в окне здания
export function bldSale(p, bid, price) {
  const b = B(bid), c = p.char; if (!b || b.owner !== c.id || BUILDINGS[b.type].pub || b.type === 'villa') return send(p, { type: 'log', text: 'Продавать можно свои частные здания (кроме виллы латифундии).', kind: 'warn' });
  price = Math.max(0, Math.min(1e6, Number(price) | 0)); b.sale = price || null; G.dirtyBld = true;
  send(p, { type: 'log', text: price ? `🏷 «${BUILDINGS[b.type].name}» выставлено на продажу за ${price} ден.` : 'Снято с продажи.', kind: 'info' });
}
export function bldBuy(p, bid) {
  const b = B(bid), c = p.char; if (!b || !b.sale || !b.owner || b.owner === c.id) return;
  if(b.type==='via_cell'&&cityOff(b.city).offices.aedilis?.id!==c.id)return;
  const def = BUILDINGS[b.type], say = (t, k = 'warn') => send(p, { type: 'log', text: t, kind: k });
  if (dist(p, b) > def.r + 12) return say('Подойдите к зданию.');
  const mine = G.W.buildings.filter((x) => x.owner === c.id && !BUILDINGS[x.type].colony && !x.muni && !BUILDINGS[x.type].pub);
  const lim = D.RANKS[rankOf(c)].priv + (c.lat ? D.LATIFUNDIUM.extraPriv : 0); if (mine.length >= lim) return say(`Ваше звание позволяет не больше ${lim} частных построек.`);
  if (def.limit && mine.filter((x) => x.type === b.type).length >= def.limit) return say('У вас уже есть такая постройка.');
  if ((def.rank || 0) > rankOf(c)) return say(`Нужно звание «${D.RANKS[def.rank].name}».`);
  if (c.den < b.sale) return say(`Нужно ${b.sale} денариев.`);
  const seller = G.chars[b.owner], tax = Math.round(b.sale * tradeTax(b));
  c.den -= b.sale; book(c, 'Расход: покупка здания', -b.sale); G.W.treasury += tax;
  if (seller) { seller.den += b.sale - tax; book(seller, 'Продажа зданий', b.sale - tax); for (const sl of G.W.slaves) if (sl.bld === b.id && sl.owner === seller.id) sl.bld = null; }
  log(`🏷 ${c.name} купил(а) «${def.name}» у ${b.ownerName} за ${b.sale} ден.`, 'info');
  b.owner = c.id; b.ownerName = c.name; b.sale = null;
  G.dirtyBld = true; G.dirtyWorld = true; p.dirtyChar = true;
}

// ---------- Производства, рабы ----------
export const slaveGrade = (s) => s.grade || Math.max(1, Math.min(3, s.skill || 1));
export function slaveEff(s, at = null) { if (s.ship || s.ludus || s.squad || (s.rest || 0) > now()) return 0; const T = D.SLAVE_TRAITS[s.trait], tb = T && T.at && at && T.at.includes(at) ? T.eff : 1; return (s.hired ? 0.55 * 1.25 : D.SLAVE_GRADES[slaveGrade(s)].eff) * tb * (1 + ((s.str || 5) - 5) * 0.02); }
export function productionTick() {
  const t = now(), W = G.W;
  for (const b of W.buildings) {
    const def = BUILDINGS[b.type];
    if (!b.built || b.ruined) { b.lastProd = t; continue; }
    if (!def.prod && !def.colony && !def.rent) continue;
    const mins = Math.min(30, (t - b.lastProd) / 60);
    if (mins < 1) continue;
    b.lastProd = t;
    const own0 = b.owner && G.chars[b.owner];
    if (b.type === 'insula') insulaRooms(b);
    const share = b.type === 'insula' ? b.rooms.filter((r) => r.bot).length / D.INSULA.rooms : 1; // горожане платят за свои комнаты, игроки — сразу за сутки
    if (def.rent && own0) { const sv = b.type === 'stall' ? W.slaves.filter((x) => x.bld === b.id).reduce((a, x) => a + ((D.SLAVE_TRAITS[x.trait] || {}).stall || 1), 0) : 0; const inc = Math.round(def.rent * (b.dmul || 1) * mins * share * (1 + sv)); own0.den += inc; own0.rentGot = (own0.rentGot || 0) + inc; book(own0, 'Доход: ' + def.name + (b.type === 'insula' ? ' (горожане)' : b.type === 'stall' ? (sv ? ' (с продавцом)' : '') : ''), inc); }
    if (!def.prod && !def.colony) continue;
    const slaves = W.slaves.filter((s) => s.bld === b.id);
    let mul = 0.3;
    const ownF = b.owner && G.chars[b.owner], topF = ownF && D.specTop(ownF, 'farm');
    for (const s of slaves) mul += slaveEff(s, b.type) * (s.hungry && !topF ? 0.5 : 1) * (s.housed === false ? 0.75 : 1);
    let prod = def.prod;
    if (def.colony) { prod = colonyProd(b); mul = 0.5 + slaves.reduce((a, s) => a + slaveEff(s), 0) * 0.9; }
    mul *= b.dmul || 1;
    const own = b.owner && G.chars[b.owner]; if (own) mul *= 1 + D.specOf(own, 'farm') * 0.1;
    const cap = def.colony ? 500 : 160;
    for (const [k, n] of Object.entries(prod)) b.store[k] = Math.min(cap, Math.round(((b.store[k] || 0) + n * mul * mins) * 10) / 10);
    G.dirtyBld = true;
  }
  autoStoreProduction();
}
// содержание рабов: раз в минуту
const SLAVE_FOOD = ['bread', 'wheat', 'f_sardine', 'f_mackerel', 'meat', 'olives', 'grapes', 'f_bream', 'f_mullet'];
export function upkeepTick() {
  const W = G.W; housingTick();
  // вольные работники — жалованье деньгами (2 ден./мин); рабы — едой (≈6 сытости в минуту: хлеб, рыба, мясо, зерно…)
  const starving = new Set();
  for (const s of W.slaves) {
    const owner = G.chars[s.owner]; if (!owner) continue;
    if (s.hired) { if (owner.den >= 2) { owner.den -= 2; book(owner, 'Расход: жалованье работникам', -2); s.hungry = false; } else { s.hungry = true; starving.add(owner.id + ':den'); } continue; }
    s.fed = (s.fed ?? 30) - (D.specTop(owner, 'farm') ? 3 : 6) * ((D.SLAVE_TRAITS[s.trait] || {}).food || 1);
    if (s.fed <= 0) {
      const b = s.bld && B(s.bld), wh = W.buildings.filter((x) => x.owner === owner.id && ['horreum_s', 'warehouse', 'quarters'].includes(x.type) && x.built && !x.ruined);
      const stores = [b && b.store, ...wh.map((x) => x.store), owner.bag].filter(Boolean);
      let ate = false;
      for (const st of stores) { const k = SLAVE_FOOD.find((f) => (st[f] || 0) >= 1); if (k) { st[k] -= 1; s.fed += (RES[k].food || 10); ate = true; if (st !== owner.bag) G.dirtyBld = true; break; } }
      s.hungry = !ate; if (!ate) { s.fed = 0; starving.add(owner.id + ':food'); }
    } else s.hungry = false;
  }
  for (const k of starving) { const [cid, why] = k.split(':'), p = [...G.players.values()].find((q) => q.char && q.char.id === cid); if (!p || (p.starveMsg || 0) > now()) continue; p.starveMsg = now() + 120; send(p, { type: 'log', text: why === 'food' ? '🍞 Рабы голодают и работают вполсилы: положите еду (хлеб, рыбу, мясо, зерно) в их хозяйство, свой склад или сумку.' : '💰 Нечем платить работникам — они работают вполсилы.', kind: 'warn' }); }
  if (W.laws.conscription) for (const p of G.players.values()) if (p.char && p.char.den >= 2) { p.char.den -= 2; W.treasury += 2; }
  if (W.laws.night_watch) W.treasury = Math.max(0, W.treasury - 3);
  for (const p of G.players.values()) p.dirtyChar = true;
}
export function collect(p, bid, toStore = false, only = null) {
  const b = B(bid), c = p.char;
  if (!b || dist(p, b) > BUILDINGS[b.type].r + 8) return;
  if (b.owner && b.owner !== c.id) return send(p, { type: 'log', text: 'Это чужое хозяйство.', kind: 'warn' });
  let total = 0, txt = [];
  for (const [k, v] of Object.entries(b.store)) {
    if (only && k !== only) continue; // можно забрать один вид ресурса
    if (b.type === 'equile' && k === 'wheat') continue; // корм в кормушке не забирается
    const n = Math.floor(v); if (n <= 0) continue;
    let got;
    if (toStore) { got = n; G.W.storage[k] = (G.W.storage[k] || 0) + n; }
    else got = addRes(c, k, n);
    b.store[k] = v - got; total += got; if (got) txt.push(`${got} ${RES[k].name}`);
  }
  if (!total) return send(p, { type: 'log', text: toStore ? 'Нечего сдавать.' : 'Нечего забрать (или сумка полна).', kind: 'warn' });
  if (toStore) { grantDig(p, Math.ceil(total * 0.1)); G.dirtyWorld = true; }
  send(p, { type: 'log', text: (toStore ? 'Сдано на склад колонии: ' : 'Забрано: ') + txt.join(', '), kind: 'good' });
  G.dirtyBld = true; p.dirtyChar = true;
}
export function refreshSlaveMarket(force) {
  const W = G.W, t = now();
  if (!force && W.slaveMarket.length && t < W.slaveMarketAt) return;
  W.slaveMarketAt = t + 600;
  W.slaveMarket = Array.from({ length: 6 }, (_, i) => {
    const grade = i === 5 && Math.random() < 0.25 ? 4 : i >= 4 ? 3 : i >= 2 ? 2 : 1;
    return { id: nid(), name: pick(D.SLAVE_NAMES), origin: grade === 4 ? pick(['бывший вождь галлов', 'бывший карфагенский военачальник', 'бывший пиратский капитан']) : pick(D.SLAVE_ORIGINS), grade, skill: Math.min(3, grade), ...D.rollSlave(grade), price: Math.round(D.SLAVE_GRADES[grade].price * rand(0.9, 1.15)) };
  });
  G.dirtyWorld = true;
}
export function buySlave(p, sid) {
  const W = G.W, c = p.char;
  if (!slaveTraderNear(p)) return send(p, { type: 'log', text: 'Работорговец — на Рынке и в лагере колонистов.', kind: 'warn' });
  const mine = W.slaves.filter((s) => s.owner === c.id).length, lim = slaveCapacity(c);
  if (mine >= lim) return send(p, { type: 'log', text: `Ваше звание позволяет держать не больше ${lim} работников.`, kind: 'warn' });
  const hired = !!lawsAt(p).slavery_ban;
  let offer;
  if (hired) offer = { id: nid(), name: pick(D.SLAVE_NAMES), origin: 'вольноотпущенник', skill: 2, price: 60, ...D.rollSlave(2) };
  else { offer = W.slaveMarket.find((s) => s.id === sid); if (!offer) return; }
  const price = Math.round(offer.price * derivedOf(c).buy);
  if (c.den < price) return send(p, { type: 'log', text: `Нужно ${price} денариев.`, kind: 'warn' });
  c.den -= price;
  if (!hired) W.slaveMarket = W.slaveMarket.filter((s) => s !== offer);
  W.slaves.push({ id: offer.id, name: offer.name, origin: offer.origin, skill: offer.skill, grade: offer.grade || 2, trait: offer.trait, str: offer.str, agi: offer.agi, end: offer.end, owner: c.id, bld: null, hired, glvl: 0, gxp: 0, gw: 0, ga: 0 });
  send(p, { type: 'log', text: hired ? `Нанят работник ${offer.name}. Назначьте его на своё хозяйство.` : `Куплен раб ${offer.name} (${offer.origin}). Назначьте его на своё хозяйство или колонию.`, kind: 'good' });
  housingTick(); G.dirtyWorld = true; p.dirtyChar = true;
}
export function assignSlave(p, sid, bid) {
  const W = G.W, c = p.char, s = W.slaves.find((x) => x.id === sid);
  if (!s || s.owner !== c.id) return;
  if (s.squad) return send(p, { type: 'log', text: `${s.name} служит в отряде — сначала распустите отряд.`, kind: 'warn' });
  if (bid == null) { s.bld = null; G.dirtyWorld = true; return; }
  const b = B(bid);
  if (!b || !b.built) return;
  const def = BUILDINGS[b.type];
  if (!def.slots) return send(p, { type: 'log', text: 'Здесь работникам нечего делать.', kind: 'warn' });
  if (b.owner !== c.id) return send(p, { type: 'log', text: 'Можно назначать только на свои хозяйства и колонии.', kind: 'warn' });
  if (W.slaves.filter((x) => x.bld === b.id).length >= def.slots) return send(p, { type: 'log', text: 'Все места заняты.', kind: 'warn' });
  s.bld = b.id; s.ship = null; s.ludus = null; G.dirtyWorld = true;
  send(p, { type: 'log', text: `${s.name} работает: ${def.name}`, kind: 'good' });
}
// работорговец: на Рынке или в лагере колонистов
export function slaveTraderNear(p) { const mk = builtOf('servile').find((b) => dist(p, b) < 18) || builtOf('mercator').find((b) => dist(p, b) < 16); return mk || Math.hypot(p.x - WG.START.x, p.z - WG.START.z) < 22; }
export const slaveSellPrice = (s) => Math.round(D.SLAVE_GRADES[slaveGrade(s)].price * 0.55 + (s.glvl || 0) * 25 + ((s.gw || 0) + (s.ga || 0)) * 10);
export function sellSlave(p, sid) {
  const W = G.W, c = p.char, s = W.slaves.find((x) => x.id === sid);
  if (!s || s.owner !== c.id || s.hired) return;
  if (s.squad) return send(p, { type: 'log', text: `${s.name} служит в отряде.`, kind: 'warn' });
  if (!slaveTraderNear(p)) return send(p, { type: 'log', text: 'Работорговец — на Рынке и в лагере колонистов.', kind: 'warn' });
  const price = Math.round(slaveSellPrice(s) * derivedOf(c).sell);
  W.slaves = W.slaves.filter((x) => x !== s); c.den += price;
  send(p, { type: 'log', text: `Работорговец купил ${s.name} за ${price} ден.`, kind: 'good' }); G.dirtyWorld = true; p.dirtyChar = true;
}
export const slaveCapacity = c => Math.min(slaveLimitOf(c), housingCapacity(c));
export function freeSlave(p, sid) {
  const W = G.W, c = p.char, s = W.slaves.find((x) => x.id === sid);
  if (!s || s.owner !== c.id) return;
  if (s.squad) return send(p, { type: 'log', text: 'Сначала распустите отряд этого работника.', kind: 'warn' });
  W.slaves = W.slaves.filter((x) => x !== s);
  if (!s.hired) { grantDig(p, 12); log(`🕊 ${c.name} отпустил(а) на волю ${s.name}.`, 'info'); }
  G.dirtyWorld = true;
}

// ---------- Рынок и ремесло ----------
export function marketMul(res) { return G.W.market[res] ?? 1; }
export function tradeTax(pos = null) { const L = lawsAt(pos); return [0, 0.05, 0.1, 0.25][L.trade_tax ?? D.LAWS.trade_tax.def ?? 0] ?? 0.05; } // налог того города, где сделка
export function sellPrice(p, res, where = null) {
  return baseSalePrice(p.char,res,{market:marketMul(res),favor:G.W.favor,openPort:!!lawsAt(p).open_port,magister:isOffice(p,'magister'),portMultiplier:where?(PORTS[where].mult[res]||1.1):1});
}
export function buyPrice(p, k, where = null) {
  const spot=tradeSpot(p),stall=spot?.kind==='stall'?B(spot.bid):null;
  const localSale=spot?.kind==='stall'?D.STALL_SELL*(stall?.owner===p.char.id?D.STALL_OWN:1):spot?.kind==='market'?D.BUYER_SELL:1;
  return purchasePrice(p.char,k,{market:marketMul(k),favor:G.W.favor,openPort:!!lawsAt(p).open_port,magister:isOffice(p,'magister'),foreign:!!where,portMultiplier:where?(PORTS[where].mult[k]||1.1):1,localSale});
}

export const MARKET_GOODS = ['wood', 'stone', 'clay', 'wheat', 'bread', 'linen', 'calamus', 'leather', 'iron', 'arrow', 'bandage', 'pilum', 'amphora', 'meat'];
export const MARKET_GEAR = D.MARKET_GEAR;
export const CAMP_GOODS = ['bread', 'bandage', 'arrow', 'wood', 'stone', 'plank', 'calamus', 'linen'];
export const CAMP_GEAR = ['knife', 'gladius', 'axe', 'pick', 'rod', 'rod_bronze', 'torch', 'parma', 'galea_bronze', 'bow'];
// покупка лавки рынка: любое звание, лавок не больше stallLimit(звание)
export function stallBuy(p, bid) {
  const c = p.char, b = B(bid); if (!b || b.type !== 'stall' || !b.built || b.enemy) return;
  if (dist(p, b) > 8) return send(p, { type: 'log', text: 'Подойдите к лавке.', kind: 'warn' });
  if (b.owner) return send(p, { type: 'log', text: b.owner === c.id ? 'Это уже ваша лавка.' : `Лавка занята: ${b.ownerName}.`, kind: 'warn' });
  const mine = G.W.buildings.filter((x) => x.type === 'stall' && x.owner === c.id && x.city === b.city).length, lim = D.stallLimit(rankOf(c));
  if (mine >= lim) return send(p, { type: 'log', text: `В этом городе на вашем звании можно держать лавок: ${lim}.`, kind: 'warn' });
  const price = Math.round(D.STALL_PRICE * derivedOf(c).buy); if (c.den < price) return send(p, { type: 'log', text: `Лавка стоит ${price} денариев.`, kind: 'warn' });
  c.den -= price; book(c, 'Расход: покупка лавки', -price); G.W.treasury += price; b.owner = c.id; b.ownerName = c.name; b.lastProd = now();
  log(`🏪 ${c.name} купил(а) лавку «${WG.STALL_CLASSES[b.cls || 0]}».`, 'info');
  p.dirtyChar = true; G.dirtyBld = true; G.dirtyWorld = true;
}
export function stallSell(p, bid) {
  const c = p.char, b = B(bid); if (!b || b.type !== 'stall' || b.owner !== c.id) return;
  const back = Math.round(D.STALL_PRICE * 0.6); c.den += back; b.owner = null; b.ownerName = null;
  send(p, { type: 'log', text: `Лавка продана городу за ${back} ден.`, kind: 'info' }); p.dirtyChar = true; G.dirtyBld = true;
}
// должностное лицо берёт ресурсы со склада колонии себе (запись в летописи)
export function storeTake(p, res, n) {
  const c = p.char, st = G.W.storage || {}; n = Math.max(1, Math.min(500, n | 0));
  if (!anyOffice(p)) return send(p, { type: 'log', text: 'Брать со склада колонии могут только должностные лица.', kind: 'warn' });
  const h = builtOf('horreum').concat(builtOf('forum_m'), builtOf('forum')).find((b) => dist(p, b) < BUILDINGS[b.type].r + 10); if (!h) return send(p, { type: 'log', text: 'Подойдите к складу или форуму.', kind: 'warn' });
  const k = Math.min(n, Math.floor(st[res] || 0)); if (!k || !RES[res]) return;
  st[res] -= k; if (!st[res]) delete st[res]; addRes(c, res, k, true);
  log(`📦 ${c.name} (должностное лицо) взял(а) со склада: ${RES[res].name} ×${k}.`, 'info');
  p.dirtyChar = true; G.dirtyWorld = true;
}
// комнаты инсулы: по умолчанию живут горожане; съехавший игрок уступает место новому горожанину
export function insulaRooms(b) {
  b.rooms = b.rooms || [];
  while (b.rooms.length < D.INSULA.rooms) b.rooms.push({ bot: true, name: D.INSULA.names[(b.id * 3 + b.rooms.length) % D.INSULA.names.length] });
  for (let i = 0; i < b.rooms.length; i++) { const r = b.rooms[i]; if (!r.bot && r.until && now() > r.until) { const c = G.chars[r.cid]; if (c && c.home === b.id) c.home = null; b.rooms[i] = { bot: true, name: D.INSULA.names[(b.id + i * 5) % D.INSULA.names.length] }; G.dirtyBld = true; } }
  return b.rooms;
}
export function roomRent(p, bid) {
  const c = p.char, b = B(bid); if (!b || b.type !== 'insula' || !b.built) return;
  if (dist(p, b) > BUILDINGS.insula.r + 8) return send(p, { type: 'log', text: 'Подойдите к инсуле.', kind: 'warn' });
  if (b.owner === c.id) return send(p, { type: 'log', text: 'Это ваша инсула.', kind: 'warn' });
  const rooms = insulaRooms(b); if (rooms.some((r) => r.cid === c.id)) return send(p, { type: 'log', text: 'Вы уже снимаете здесь комнату.', kind: 'warn' });
  const i = rooms.findIndex((r) => r.bot); if (i < 0) return send(p, { type: 'log', text: 'Все комнаты заняты игроками.', kind: 'warn' });
  const price = Math.round(D.INSULA.roomPrice * (b.dmul || 1)); if (c.den < price) return send(p, { type: 'log', text: `Комната на сутки — ${price} денариев.`, kind: 'warn' });
  c.den -= price; book(c, 'Расход: аренда комнаты в инсуле', -price); const t = Math.round(price * tradeTax(b)); G.W.treasury += t; const own = G.chars[b.owner]; if (own) { own.den += price - t; own.rentGot = (own.rentGot || 0) + price - t; book(own, 'Доход: Инсула (аренда комнат игроками)', price - t); }
  rooms[i] = { bot: false, cid: c.id, name: c.name, until: now() + D.CFG.dayLength }; c.home = b.id;
  send(p, { type: 'log', text: `🏠 Комната в инсуле снята на сутки за ${price} ден. Здесь вы и возрождаетесь.`, kind: 'good' });
  p.dirtyChar = true; G.dirtyBld = true;
}
// где можно торговать: рынок, стартовый купец, порт (на корабле)
export function tradeSpot(p) {
  if (p.ship) { const port = Object.entries(PORTS).find(([, q]) => Math.hypot(q.x - p.x, q.z - p.z) < q.r + 40); if (port) return { kind: 'port', id: port[0] }; }
  const st = builtOf('stall').find((b) => dist(p, b) < 6); if (st) return { kind: 'stall', cls: st.cls || 0, bid: st.id };
  const mk = builtOf('mercator').find((b) => dist(p, b) < 16); if (mk) return { kind: 'market' };
  const camp = G.world.pois.find((q) => q.type === 'start_camp'); if (camp && dist(p, camp) < 18) return { kind: 'camp' };
  return null;
}
function fleetGear() { return G.W.events.find((e) => e.kind === 'merchant' && e.until > now()) ? ['spatha', 'hamata', 'galea_iron', 'scutum', 'bow', 'rod_pro', 'squamata'] : []; }
export function shopList(p) {
  const s = tradeSpot(p); if (!s) return null;
  if (s.kind === 'port') return { spot: s, goods: PORTS[s.id].sells.filter((k) => RES[k]), gear: PORTS[s.id].sells.filter((k) => GEAR[k]) };
  if (s.kind === 'market') return { spot: s, goods: MARKET_GOODS, gear: [...MARKET_GEAR, ...fleetGear()] };
  if (s.kind === 'stall') return { spot: s, goods: D.STALL_GOODS[s.cls], gear: D.STALL_GEAR[s.cls] || [] };
  return { spot: s, goods: CAMP_GOODS, gear: CAMP_GEAR };
}
export function sell(p, res, n, fromCargo = false) {
  const c = p.char; n = Math.max(1, Math.min(9999, n | 0));
  const s = tradeSpot(p); if (!s || !RES[res]) return;
  if (s.kind === 'market' && !D.buyerOpen(G.W.time)) return send(p, { type: 'log', text: '🕛 Скупщик открыт с 12:00 до 20:00.', kind: 'warn' });
  let src = c.bag;
  const ship = fromCargo && p.ship ? G.W.ships.find((x) => x.id === p.ship) : null;
  if (fromCargo) { if (!ship || !cargoAccess(p,ship) || s.kind !== 'port') return; src = ship.cargo; }
  if (s.kind === 'stall' && !D.STALL_GOODS[s.cls].includes(res)) return send(p, { type: 'log', text: 'В этой лавке такой товар не берут — ищите лавку своего ряда или скупщика.', kind: 'warn' });
  const have = Math.min(n, Math.floor(src[res] || 0)); if (!have) return;
  const sb = s.kind === 'stall' ? B(s.bid) : null, ownStall = sb && sb.owner === c.id;
  const price = Math.max(0.1, Math.round(sellPrice(p, res, s.kind === 'port' ? s.id : null) * (s.kind === 'stall' ? D.STALL_SELL * (ownStall ? D.STALL_OWN : 1) : s.kind === 'market' ? D.BUYER_SELL : 1) * 10) / 10);
  const gross = price * have, tax = D.specTop(c, 'merc') ? 0 : Math.round(gross * tradeTax(p));
  if (sb && sb.owner && !ownStall && G.chars[sb.owner]) { const fee = Math.round(gross * D.STALL_FEE); G.chars[sb.owner].den += fee; G.chars[sb.owner].rentGot = (G.chars[sb.owner].rentGot || 0) + fee; book(G.chars[sb.owner], 'Доход: Лавка (доля с чужих продаж)', fee); }
  src[res] -= have; if (!src[res]) delete src[res];
  c.den += Math.round(gross - tax); G.W.treasury += tax; book(c, 'Продажи', gross - tax);
  if (s.kind !== 'port') G.W.market[res] = Math.max(0.45, marketMul(res) - have * (s.kind === 'stall' ? 0.005 : 0.003));
  c.stats2.traded += Math.round(gross);
  if (gross >= 30) grantXp(p, Math.min(60, gross / 15));
  if (gross >= 200) grantDig(p, Math.round(gross / 200));
  questHook(p, 'sell', { res, n: have, den: gross });
  send(p, { type: 'log', text: `Продано: ${have} ${RES[res].name} за ${Math.round(gross - tax)} ден.${tax ? ` (налог ${tax})` : ''}`, kind: 'good' });
  p.dirtyChar = true; G.dirtyWorld = true;
}
export function buy(p, k, n = 1) {
  const c = p.char; const L = shopList(p); if (!L) return;
  if (L.spot.kind === 'market' && !D.buyerOpen(G.W.time)) return send(p, { type: 'log', text: '🕛 Скупщик открыт с 12:00 до 20:00.', kind: 'warn' });
  n = Math.max(1, Math.min(200, n | 0));
  if (RES[k]) {
    if (!L.goods.includes(k)) return;
    const price = buyPrice(p, k, L.spot.kind === 'port' ? L.spot.id : null);
    n = Math.min(n, canTake(c, k, n), Math.floor(c.den / price));
    if (n <= 0) return send(p, { type: 'log', text: 'Не хватает денег или места в сумке.', kind: 'warn' });
    const sb = L.spot.kind === 'stall' ? B(L.spot.bid) : null, so = sb && sb.owner && sb.owner !== c.id ? G.chars[sb.owner] : null, extra = so ? Math.max(1, Math.ceil(price * n * D.STALL_FEE)) : 0;
    if (extra && c.den < price * n + extra) n = Math.max(0, Math.floor((c.den - 1) / (price * (1 + D.STALL_FEE))));
    if (n <= 0) return send(p, { type: 'log', text: 'Не хватает денег.', kind: 'warn' });
    c.den -= price * n; book(c, 'Покупки', -price * n); addRes(c, k, n); c.stats2.traded += Math.round(price * n); // покупки тоже идут в торговый оборот
    if (so) { const ex = Math.max(1, Math.ceil(price * n * D.STALL_FEE)); c.den -= ex; book(c, 'Расход: доля хозяину чужой лавки', -ex); so.den += ex; so.rentGot = (so.rentGot || 0) + ex; book(so, 'Доход: Лавка (доля с чужих покупок)', ex); }
    G.W.treasury += Math.round(price * n * tradeTax(p));
    if (L.spot.kind === 'market' || L.spot.kind === 'stall') G.W.market[k] = Math.min(1.6, marketMul(k) + n * 0.002);
    send(p, { type: 'log', text: `Куплено: ${n} ${RES[k].name} за ${price * n} ден.`, kind: 'good' });
  } else if (GEAR[k]) {
    if (!L.gear.includes(k)) return;
    const price = buyPrice(p, k);
    if (c.den < price) return send(p, { type: 'log', text: `Нужно ${price} денариев.`, kind: 'warn' });
    if (!addGear(c, k, 0)) return send(p, { type: 'log', text: 'Нет места в снаряжении (24 вещи).', kind: 'warn' });
    c.den -= price; book(c, 'Покупки', -price);
    send(p, { type: 'log', text: `Куплено: ${GEAR[k].name}`, kind: 'good' });
  }
  p.dirtyChar = true;
}
// рыбный причал гавани: свежий улов из сумки и из трюма пришвартованных кораблей
export function sellCatch(p, bid) {
  const b = B(bid), c = p.char; if (!b || b.type !== 'portus' || !b.built || b.enemy || dist(p, b) > 50) return;
  let total = 0, n = 0;
  const srcs = [c.bag, ...G.W.ships.filter((s) => s.owner === c.id && s.berth && s.berth.startsWith('b' + b.id + ':')).map((s) => s.cargo)];
  for (const src of srcs) for (const [k, v] of Object.entries(src)) { if (!RES[k] || !RES[k].fish || v < 1) continue; const q = Math.floor(v); total += sellPrice(p, k) * 1.15 * q * (k === 'f_tuna' ? 1.15 : 1); n += q; src[k] = v - q; if (src[k] <= 0) delete src[k]; }
  if (!n) return send(p, { type: 'log', text: 'Улова нет.', kind: 'warn' });
  total = Math.round(total); c.den += total; book(c, 'Продажа улова', total); c.stats2.traded += total; grantXp(p, Math.min(80, total / 12)); questHook(p, 'sell', { res: 'fish', n, den: total });
  send(p, { type: 'log', text: `🐟 Рыбаки гавани приняли улов: ${n} шт. за ${total} ден.`, kind: 'good' });
  p.dirtyChar = true; G.dirtyWorld = true;
}
export function sellGear(p, uid) {
  const c = p.char, s = tradeSpot(p); if (!s) return;
  if (s.kind === 'market' && !D.buyerOpen(G.W.time)) return send(p, { type: 'log', text: '🕛 Скупщик открыт с 12:00 до 20:00.', kind: 'warn' });
  const i = c.items.findIndex((x) => x.uid === uid); if (i < 0) return;
  const it = c.items[i], g = GEAR[it.k]; if (g.bound) return;
  const price = Math.round(g.p * 0.35 * QUALITY[it.q || 0].mul * derivedOf(c).sell);
  c.items.splice(i, 1); c.den += price; book(c, 'Продажи', price);
  send(p, { type: 'log', text: `Продано: ${g.name} за ${price} ден.`, kind: 'good' });
  p.dirtyChar = true;
}
export function craft(p, rid, n = 1) {
  const c = p.char, r = RECIPES.find((x) => x.id === rid); if (!r) return;
  const at = builtOf(r.at).find((b) => dist(p, b) < BUILDINGS[r.at].r + 8);
  const campOk = r.at === 'fabrica' && ['plank', 'bandage', 'leather'].includes(r.id) && G.world.pois.some((q) => q.type === 'start_camp' && dist(p, q) < 18);
  if (!at && !campOk) return send(p, { type: 'log', text: `Нужно здание: ${BUILDINGS[r.at].name}`, kind: 'warn' });
  if (r.lvl && c.level < r.lvl) return send(p, { type: 'log', text: `Нужен ${r.lvl} уровень.`, kind: 'warn' });
  n = Math.max(1, Math.min(r.gear ? 1 : 50, n | 0));
  // в чужом частном предприятии — небольшая доплата хозяину (1 ден. за изделие, за снаряжение — 5)
  const host = at && at.owner && at.owner !== c.id ? G.chars[at.owner] : null, fee = host && !D.specOf(c, 'craft') ? (r.gear ? D.CRAFT_FEE.gear : D.CRAFT_FEE.res) : 0;
  let made = 0, paid = 0;
  for (let i = 0; i < n; i++) {
    if (!hasAll(c, r.in)) break;
    if (fee && c.den < fee) { send(p, { type: 'log', text: `Хозяину мастерской нужно доплатить ${fee} ден. за изделие.`, kind: 'warn' }); break; }
    if (fee) { c.den -= fee; book(c, 'Расход: ремесло в чужой мастерской', -fee); host.den += fee; host.rentGot = (host.rentGot || 0) + fee; book(host, 'Доход: ' + BUILDINGS[at.type].name + ' (ремесло гостей)', fee); paid += fee; }
    if (r.gear) {
      const ch = D.craftChance(c), roll = Math.random();
      const q = roll < ch.q2 ? 2 : roll < ch.q2 + ch.q1 ? 1 : 0;
      if (c.items.length >= 24) { send(p, { type: 'log', text: 'Нет места для снаряжения.', kind: 'warn' }); break; }
      payAll(c, r.in); addGear(c, r.gear, q);
      const two = Math.random() < ch.dbl && c.items.length < 24; if (two) addGear(c, r.gear, q);
      send(p, { type: 'log', text: `Изготовлено: ${GEAR[r.gear].name} (${QUALITY[q].name})${two ? ' — Ремесленник: сразу два!' : ''}`, kind: q ? 'good' : 'info' });
    } else {
      payAll(c, r.in); const dbl = Math.random() < D.craftChance(c).dbl ? 2 : 1;
      for (const [k, v] of Object.entries(r.out)) addRes(c, k, v * dbl, true);
    }
    made++;
  }
  if (!made) return send(p, { type: 'log', text: 'Не хватает материалов.', kind: 'warn' });
  if (paid) { send(p, { type: 'log', text: `Хозяину (${host.name}) уплачено за работу: ${paid} ден.`, kind: 'info' }); const hp = [...G.players.values()].find((q) => q.char === host); if (hp) hp.dirtyChar = true; }
  grantXp(p, made * (r.gear ? 20 : 2));
  questHook(p, 'craft', { id: r.id, n: made });
  if (!r.gear) send(p, { type: 'log', text: `Изготовлено: ${r.n} ×${made}`, kind: 'good' });
  p.dirtyChar = true;
}

// ---------- Корабли ----------
export function shipById(id) { return G.W.ships.find((s) => s.id === id); }
function dockSpot(b) {
  const r = BUILDINGS[b.type].r;
  for (let k = r + 8; k < r + 60; k += 3) for (const off of [0, 0.3, -0.3, 0.6, -0.6]) {
    const a = b.ry + off, x = b.x + Math.sin(a) * k, z = b.z + Math.cos(a) * k;
    if (WG.shipOk(x, z) && WG.shipOk(x + Math.sin(a) * 8, z + Math.cos(a) * 8)) return { x, z, ry: a };
  }
  return null;
}
export function buildShip(p, type) {
  const c = p.char, def = SHIPS[type]; if (!def) return;
  const port = [...builtOf('portus'), ...builtOf('navalia').filter(b => b.owner === c.id)].find((b) => dist(p, b) < 30);
  if (!port) return send(p, { type: 'log', text: 'Корабли строят на Верфи в Гавани.', kind: 'warn' });
  if ((def.rank || 0) > rankOf(c)) return send(p, { type: 'log', text: `Нужно звание «${D.RANKS[def.rank].name}».`, kind: 'warn' });
  if (G.W.ships.filter((s) => s.owner === c.id).length >= shipLimitOf(c)) return send(p, { type: 'log', text: `Вам можно держать не больше ${shipLimitOf(c)} кораблей (затонувшие не учитываются); должности сенатора, префекта и наварха дают больше.`, kind: 'warn' });
  if (def.scraps && (c.quadScraps || 0) < def.scraps) return send(p, { type: 'log', text: `Нужен чертёж: лоскуты ${c.quadScraps || 0}/${def.scraps} (сундуки на скалах с обломками, потопленные пиратские и карфагенские корабли).`, kind: 'warn' });
  if (!Object.entries(def.cost).every(([k,n])=>(availableResources(c,port)[k]||0)>=n)) return send(p, { type: 'log', text: 'Не хватает материалов в сумке и городском складе: ' + Object.entries(def.cost).map(([k, n]) => `${n} ${RES[k].name}`).join(', '), kind: 'warn' });
  const actualPort = port.type === 'navalia' ? builtOf('portus').find(b => dist(b, port) < 180) : port;
  const bth = actualPort && berthFn(type, actualPort); const spot = bth || dockSpot(port);
  if (!spot) return send(p, { type: 'log', text: 'У гавани нет свободного причала (4 места) или глубокой воды.', kind: 'warn' });
  if (!payResources(c,port,def.cost)) return; if (def.scraps) c.quadScraps -= def.scraps;
  const s = { id: nid(), type, owner: c.id, ownerName: c.name, name: `${def.name.split(' ')[0]} «${pick(['Фортуна', 'Аврора', 'Конкордия', 'Виктория', 'Салюс', 'Нептун', 'Меркурий', 'Феликс', 'Минерва', 'Пакс'])}»`, x: spot.x, z: spot.z, ry: spot.ry, hp: def.hp, maxHp: def.hp, cargo: {}, speed: 0, crates: [], up: {}, berth: bth ? bth.key : null };
  G.W.ships.push(s);
  G.W.fleetBuilt = G.W.fleetBuilt || {}; G.W.fleetBuilt[type] = (G.W.fleetBuilt[type] || 0) + 1;
  log(`⚓ ${c.name} спустил(а) на воду: ${s.name}`, 'good'); chronicle(`Спущен на воду корабль ${s.name}`);
  grantXp(p, 60); grantDig(p, 10);
  storyCheck(); p.dirtyChar = true; G.dirtyWorld = true;
}
export function cargoWeight(s) { let w = 0; for (const [k, n] of Object.entries(s.cargo)) w += (RES[k]?.w || 1) * n; return w; }
export function riders(s) { return [...G.players.values()].filter((p) => p.ship === s.id); }
export function board(p, sid) {
  const s = shipById(sid); if (!s || p.ship || !p.alive || p.inst) return;
  const def = SHIPS[s.type];
  if (s.route) return send(p, { type: 'log', text: 'Корабль ходит по торговому пути — снимите его с пути в окне торговли (K).', kind: 'warn' });
  if (dist(p, s) > def.len / 2 + 7) return;
  const rs = riders(s);
  if (rs.length >= def.seats) return send(p, { type: 'log', text: 'На корабле нет мест.', kind: 'warn' });
  p.ship = s.id; p.mounted = false;
  const taken = new Set(rs.map((q) => q.seat));
  const ownerHelm = s.owner === p.char.id || !rs.some((q) => q.seat === 0);
  p.seat = ownerHelm && !taken.has(0) ? 0 : [...Array(def.seats).keys()].find((i) => i > 0 && !taken.has(i)) ?? 1;
  if (p.seat === 0 && taken.has(0)) p.seat = [...Array(def.seats).keys()].find((i) => !taken.has(i));
  p.helmIn = { f: 0, t: 0 };
  send(p, { type: 'boarded', sid: s.id, seat: p.seat });
  p.block = false;
}
let berthDeckFn = () => null; export function setBerthDeckFn(fn) { berthDeckFn = fn; }
export function leaveShip(p) {
  const s = shipById(p.ship); p.ship = null; p.seat = null;
  if (!s) return;
  const dk = s.berth && berthDeckFn(s); // у причала — сходим прямо на мостик рядом с бортом
  if (dk) { p.x = dk.x; p.z = dk.z; send(p, { type: 'teleport', x: p.x, z: p.z, left: true }); return; }
  // ищем сушу рядом
  let best = null, bd = 1e9;
  for (let r = 4; r < 22; r += 2) for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
    if (WG.terrainHeight(x, z) > 0.3) { const d = r; if (d < bd) { bd = d; best = { x, z }; } }
  }
  if (!best) best = { x: s.x + Math.cos(s.ry) * 3, z: s.z - Math.sin(s.ry) * 3 };
  p.x = best.x; p.z = best.z;
  send(p, { type: 'teleport', x: p.x, z: p.z, left: true });
}
export function helm(p, m) { if (p.ship && p.seat === 0) p.helmIn = { f: Math.max(-1, Math.min(1, Number(m.f) || 0)), t: Math.max(-1, Math.min(1, Number(m.t) || 0)) }; }
export function updateShips(dt) {
  const storm = G.W.events.some((e) => e.kind === 'storm' && e.until > now());
  const pharos = hasBuilt('pharos') ? 1.1 : 1;
  for (const s of G.W.ships) {
    if (s.route) continue; // корабль на торговом пути — ведёт караван
    if (s.boardLock) { s.speed = 0; continue; } // сцеплен абордажным мостиком
    const def = SHIPS[s.type], rs = riders(s);
    const h = rs.find((q) => q.seat === 0);
    const inp = h ? h.helmIn : { f: 0, t: 0 };
    const target = inp.f * def.speed * (1 + 0.08 * ((s.up && s.up.sail) || 0)) * (h ? 1 + D.specOf(h.char, 'sail') * 0.04 : 1) * pharos * (storm ? 0.8 : 1) * (inp.f < 0 ? 0.35 : 1);
    s.speed += Math.sign(target - s.speed) * Math.min(Math.abs(target - s.speed), (target === 0 ? 1.2 : 2.2) * dt);
    if(!s.berth)s.ry += inp.t * def.turn * dt * Math.min(1, Math.abs(s.speed) / 3 + 0.25) * (s.speed < 0 ? -1 : 1);
    if (Math.abs(s.speed) > 0.01) {
      const nx = s.x + Math.sin(s.ry) * s.speed * dt, nz = s.z + Math.cos(s.ry) * s.speed * dt;
      const bow = def.len / 2 * Math.sign(s.speed || 1);
      const bx = nx + Math.sin(s.ry) * bow, bz = nz + Math.cos(s.ry) * bow;
      const riverBlock = s.type !== 'scapha' && WG.waterEdgeDist(bx, bz) < 6; // по рекам и озёрам — только лодки
      if (!riverBlock && WG.shipOk(nx, nz) && WG.shipOk(bx, bz)) { s.x = nx; s.z = nz; }
      else {
        if (riverBlock && !s.riverWarn) { s.riverWarn = true; for (const q of rs) send(q, { type: 'log', text: 'Река слишком узкая для большого корабля — по рекам ходят только лодки.', kind: 'warn' }); setTimeout(() => { s.riverWarn = false; }, 8000); }
        if (Math.abs(s.speed) > 5 && !riverBlock) { if (!(h && D.specTop(h.char, 'sail'))) s.hp -= Math.abs(s.speed) * 4; fx({ kind: 'crash', x: s.x, z: s.z }); for (const q of rs) send(q, { type: 'log', text: 'Корабль сел на мель!', kind: 'bad' }); }
        s.speed = -s.speed * 0.15;
      }
    }
    const safe = h && D.specTop(h.char, 'sail'); // Мореход 5-й ступени: скалы и шторм не вредят
    if (storm && !safe && Math.abs(s.speed) > 2 && Math.random() < dt * 0.02) s.hp -= 5;
    // таран
    if (def.ram && Math.abs(s.speed) > 5) for (const e of G.eships.values()) {
      if (Math.hypot(e.x - s.x, e.z - s.z) < (def.len + e.def.len) / 2 * 0.7 && (!s.ramT || now() - s.ramT > 2)) {
        s.ramT = now(); hitEnemyShipFn(e, def.ram * (1 + 0.4 * ((s.up && s.up.ram) || 0)) * Math.abs(s.speed) / def.speed, h); s.speed *= 0.3;
        fx({ kind: 'ram', x: e.x, z: e.z });
      }
    }
    // на море корабли могут атаковать кого угодно — в том числе корабли других игроков (таран)
    if (def.ram && Math.abs(s.speed) > 5 && h) for (const o of G.W.ships) {
      if (o === s || o.owner === s.owner || o.berth || !o.hp) continue; const od = SHIPS[o.type];
      if (Math.hypot(o.x - s.x, o.z - s.z) < (def.len + od.len) / 2 * 0.7 && (!s.ramT || now() - s.ramT > 2)) {
        s.ramT = now(); const dmg = def.ram * (1 + 0.4 * ((s.up && s.up.ram) || 0)) * Math.abs(s.speed) / def.speed * 0.6; o.hp = Math.max(0, o.hp - dmg); s.speed *= 0.3; G.dirtyWorld = true;
        fx({ kind: 'ram', x: o.x, z: o.z }); for (const q of riders(o)) send(q, { type: 'log', text: `⚓ ${h.char.name} таранит ваш корабль!`, kind: 'bad' });
      }
    }
    for (const q of rs) { const seat = seatPos(s, q.seat); q.x = seat.x; q.z = seat.z; q.ry = s.ry; }
    if (s.hp <= 0) sinkShip(s);
  }
}
export function seatPos(s, i) {
  const def = SHIPS[s.type], n = def.seats;
  // штурвал на носу, остальные — по палубе
  const lz = i === 0 ? -def.len * 0.38 : -def.len * 0.25 + (i / n) * def.len * 0.6, lx = i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.min(1.4, def.len * 0.06);
  return { x: s.x + Math.sin(s.ry) * lz + Math.cos(s.ry) * lx, z: s.z + Math.cos(s.ry) * lz - Math.sin(s.ry) * lx };
}
export function sinkShip(s) {
  log(`🌊 ${s.name} пошёл ко дну!`, 'bad'); chronicle(`Затонул корабль ${s.name}`);
  fx({ kind: 'sink', x: s.x, z: s.z, sid: s.id });
  for (const q of riders(s)) { q.ship = null; q.seat = null; send(q, { type: 'teleport', x: q.x, z: q.z, left: true }); }
  try { shipSunkHook(s); } catch (e) { console.error(e); }
  G.W.ships = G.W.ships.filter((x) => x !== s);
  G.dirtyWorld = true;
}
let shipSunkHook = () => {};
let berthFn = () => null;
export function setBerthFn(fn) { berthFn = fn; }
export function setShipSunkHook(fn) { shipSunkHook = fn; }
let hitEnemyShipFn = () => {};
export function setEnemyShipHit(fn) { hitEnemyShipFn = fn; }
export function cargoMove(p, sid, res, n, dir) {
  const s = shipById(sid), c = p.char; if (!s || !RES[res] || !shipCargoAllowed(p, s)) return;
  if (p.ship !== s.id && dist(p, s) > SHIPS[s.type].len / 2 + 8) return;
  n = Math.max(1, n | 0);
  if (dir === 'in') {
    const room = Math.floor((SHIPS[s.type].cargo - cargoWeight(s)) / RES[res].w);
    const k = Math.min(n, room, c.bag[res] || 0); if (k <= 0) return send(p, { type: 'log', text: 'Трюм полон или нечего грузить.', kind: 'warn' });
    takeRes(c, res, k); s.cargo[res] = (s.cargo[res] || 0) + k;
  } else {
    const k = addRes(c, res, Math.min(n, Math.floor(s.cargo[res] || 0))); if (!k) return;
    s.cargo[res] -= k; if (!s.cargo[res]) delete s.cargo[res];
  }
  p.dirtyChar = true; G.dirtyWorld = true;
}
// погрузка запасов колонии на корабль у колонии
export function colonyLoad(p, bid) {
  const b = B(bid), c = p.char; if (!b || b.type !== 'colonia' || b.owner !== c.id || p.inst || dist(p,b)>30) return;
  const s = G.W.ships.filter((x) => x.owner === c.id).find((x) => dist(x, b) < 90);
  if (!s) return send(p, { type: 'log', text: 'Подведите свой корабль к колонии (до 90 м).', kind: 'warn' });
  let moved = 0;
  for (const [k, v] of Object.entries(b.store)) {
    const room = Math.floor((SHIPS[s.type].cargo - cargoWeight(s)) / RES[k].w);
    const n = Math.min(Math.floor(v), room); if (n <= 0) continue;
    b.store[k] = v - n; s.cargo[k] = (s.cargo[k] || 0) + n; moved += n;
  }
  send(p, { type: 'log', text: moved ? `На борт «${s.name}» погружено ${moved} ед. Отвезите груз в Гавань колонии.` : 'Нечего грузить или трюм полон.', kind: moved ? 'good' : 'warn' });
  G.dirtyBld = true; G.dirtyWorld = true;
}
// разгрузка трюма на склад колонии в гавани
export function unloadToStorage(p, sid) {
  const s = shipById(sid); if (!s || !shipCargoAllowed(p, s)) return;
  const port = builtOf('portus').find((b) => dist(b, s) < 80 && dist(p, b) < 80);
  if (!port) return send(p, { type: 'log', text: 'Разгружать на склад можно у Гавани колонии.', kind: 'warn' });
  let n = 0;
  for (const [k, v] of Object.entries(s.cargo)) { const q = Math.floor(v); G.W.storage[k] = (G.W.storage[k] || 0) + q; n += q; questHook(p, 'store', { res: k, n: q }); }
  s.cargo = {};
  if (!n) return;
  grantDig(p, Math.ceil(n * 0.12)); grantXp(p, Math.min(300, n));
  log(`📦 ${p.char.name} доставил(а) в колонию ${n} ед. груза.`, 'good');
  G.dirtyWorld = true;
}
export function repairShip(p, sid) {
  const s = shipById(sid), c = p.char; if (!s) return;
  const port = builtOf('portus').find((b) => dist(b, s) < 80); if (!port) return send(p, { type: 'log', text: 'Корабль чинят у Гавани.', kind: 'warn' });
  const need = Math.ceil((s.maxHp - s.hp) / 25); if (!need) return;
  const k = takeRes(c, 'plank', need); s.hp = Math.min(s.maxHp, s.hp + k * 25);
  send(p, { type: 'log', text: k ? `Корабль починен (${k} досок).` : 'Нужны доски.', kind: k ? 'good' : 'warn' });
  p.dirtyChar = true; G.dirtyWorld = true;
}

// ---------- Рыбалка ----------
export function spawnSchools() {
  const t = now();
  const tuna = G.W.events.find((e) => e.kind === 'tuna' && e.until > t);
  const want = 34 + (tuna ? 10 : 0);
  if (G.schools.size >= want) return;
  for (let tries = 0; tries < 30 && G.schools.size < want; tries++) {
    // рядом с игроками или у островов
    const ps = [...G.players.values()].filter((p) => !p.inst);
    let x, z;
    if (ps.length && Math.random() < 0.6) { const p = pick(ps); const a = rand(0, 6.28), d = rand(30, 220); x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d; }
    else { x = rand(-1500, 1500); z = rand(-1500, 1500); }
    const h = WG.terrainHeight(x, z);
    if (h > -2.2) continue;
    const deep = h < -14;
    const kind = tuna && Math.random() < 0.5 ? 'tuna' : deep ? 'deep' : 'shallow';
    G.schools.set(nid(), { id: null, x, z, a: rand(0, 6.28), n: randi(6, 14), kind, born: t, life: rand(240, 600) });
  }
  for (const [id, s] of G.schools) s.id = id;
}
export function updateSchools(dt) {
  const t = now();
  for (const s of G.schools.values()) {
    s.a += rand(-0.4, 0.4) * dt;
    const sp = s.kind === 'tuna' ? 2.4 : 1.1;
    const nx = s.x + Math.cos(s.a) * sp * dt, nz = s.z + Math.sin(s.a) * sp * dt;
    if (WG.terrainHeight(nx, nz) < -2) { s.x = nx; s.z = nz; } else s.a += Math.PI * 0.7;
    if (s.n <= 0 || t - s.born > s.life) G.schools.delete(s.id);
  }
}
export function cast(p, x, z) {
  const c = p.char, w = c.gear.weapon && GEAR[c.gear.weapon.k];
  if (!w || w.kind !== 'rod') return send(p, { type: 'log', text: 'Возьмите в руки удочку (инвентарь → надеть).', kind: 'warn' });
  x = Number(x); z = Number(z);
  if (!isFinite(x) || Math.hypot(x - p.x, z - p.z) > CFG.fishCastR + 2) return;
  if (WG.terrainHeight(x, z) > -0.8) return send(p, { type: 'log', text: 'Забрасывайте в воду.', kind: 'warn' });
  let school = null, bd = 9;
  for (const s of G.schools.values()) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; school = s; } }
  const t = now();
  p.fishing = { x, z, t0: t, biteAt: t + (school ? rand(1.2, 3.5) : rand(4, 10)) * (1 - D.specOf(c, 'fish') * 0.1) * (1 - (w.luck || 0) * 0.5), school: school ? school.id : null, state: 'wait' };
  if (w.big) { const sh = p.ship && G.W.ships.find((s) => s.id === p.ship); if (!sh || sh.type !== 'barca') send(p, { type: 'log', text: 'Тяжёлая удочка предназначена для морской рыбалки. Тунца ловят носовым гарпуном баркаса (H), а не удочкой.', kind: 'warn' }); }
  p.lastAtk = { t, kind: 'rod', combo: 0 };
  send(p, { type: 'cast', x, z, school: !!school });
}
function rollFish(p, school, x, z) {
  const c = p.char, w = GEAR[c.gear.weapon.k], luck = (w.luck || 0) + (c.level * 0.004) + D.specOf(c, 'fish') * 0.02;
  const deep = WG.terrainHeight(x, z) < -14 ? 1 : 0;
  if (WG.waterEdgeDist(x, z) < 1) { // река или озеро: пресноводная рыба
    if (Math.random() < 0.25) return null;
    const fr = Object.entries(FISH).filter(([, f]) => f.fresh).map(([k, f]) => [k, f.fresh * (f.fresh < 20 ? 1 + luck * 4 : 1)]);
    let sum = fr.reduce((a, [, v]) => a + v, 0), r = Math.random() * sum;
    for (const [k, v] of fr) { r -= v; if (r <= 0) return k; }
    return 'f_trout';
  }
  // тунец — только большой удочкой с баркаса, в открытом море или у косяка тунца
  const ship = p.ship && G.W.ships.find((s) => s.id === p.ship);
  // Tuna are physical harpoon catches; rods keep their ordinary fish table.
  if (!school) { return Math.random() < 0.25 ? null : pick(['f_sardine', 'f_sardine', 'f_mackerel', 'f_seabass']); }
  const ent = Object.entries(FISH).map(([k, f]) => [k, f.chance[deep] * (f.chance[deep] < 5 ? 1 + luck * 4 : 1)]);
  let sum = ent.reduce((a, [, v]) => a + v, 0), r = Math.random() * sum;
  for (const [k, v] of ent) { r -= v; if (r <= 0) return k; }
  return 'f_sardine';
}
export function fishingTick() {
  const t = now();
  for (const p of G.players.values()) {
    const f = p.fishing; if (!f || !p.alive) continue;
    const w = p.char.gear.weapon && GEAR[p.char.gear.weapon.k];
    if (!w || w.kind !== 'rod' || Math.hypot(p.x - f.x, p.z - f.z) > CFG.fishCastR + 6) { p.fishing = null; send(p, { type: 'fishEnd' }); continue; }
    if (f.state === 'wait' && t >= f.biteAt) {
      const school = f.school ? G.schools.get(f.school) : null;
      const sp = rollFish(p, school, f.x, f.z);
      if (!sp) { f.biteAt = t + rand(6, 14); continue; }
      const F = FISH[sp], luck = GEAR[p.char.gear.weapon.k].luck || 0;
      const u = Math.pow(Math.random(), 2.2 - luck * 2);
      f.sp = sp; f.kg = Math.round((F.kg[0] + (F.kg[1] - F.kg[0]) * u) * 100) / 100;
      f.state = 'bite'; f.until = t + 14;
      send(p, { type: 'bite', diff: Math.max(0.08, (F.diff + (f.kg / F.kg[1]) * 0.2) * 0.72 * (1 - luck * 0.6)), big: f.kg >= F.trophy, tuna: sp === 'f_tuna' });
      if (sp === 'f_tuna') { f.helped = false; for (const q of riders(G.W.ships.find((s) => s.id === p.ship) || { id: -1 })) if (q !== p) send(q, { type: 'tunaHelp', name: p.char.name, until: 14 }); }
    } else if (f.state === 'bite' && t > f.until) { p.fishing = null; send(p, { type: 'fishEnd', text: 'Рыба сорвалась.' }); }
  }
}
export function tunaPull(p) {
  if (!p.ship) return;
  for (const q of riders(G.W.ships.find((s) => s.id === p.ship) || { id: -1 })) if (q !== p && q.fishing && q.fishing.sp === 'f_tuna' && q.fishing.state === 'bite') { q.fishing.helped = true; send(q, { type: 'log', text: `💪 ${p.char.name} помогает тянуть!`, kind: 'good' }); send(p, { type: 'log', text: 'Вы налегли на снасть вместе с рыбаком!', kind: 'good' }); grantXp(p, 20); }
}
export function reel(p, ok) {
  const f = p.fishing; if (!f || f.state !== 'bite') return;
  p.fishing = null;
  if (!ok) return send(p, { type: 'fishEnd', text: 'Рыба сорвалась с крючка!' });
  if (f.sp === 'f_tuna' && !f.helped) return send(p, { type: 'fishEnd', text: '🐟 Тунец слишком силён один на один — нужен напарник на баркасе (он жмёт E, пока вы тянете).' });
  const c = p.char, F = FISH[f.sp];
  const school = f.school ? G.schools.get(f.school) : null; if (school) school.n--;
  const got = addRes(c, f.sp, 1, RES[f.sp].w * 1 > bagFree(c) ? false : true);
  if (!got) return send(p, { type: 'fishEnd', text: 'Сумка полна — рыбу пришлось отпустить.' });
  c.stats2.fish++;
  if (D.specTop(c, 'fish') && Math.random() < 0.2 && addRes(c, f.sp, 1)) send(p, { type: 'log', text: '🎣 Рыбак: на крючке сразу две рыбы!', kind: 'good' });
  if (Math.random() < 0.25 + F.diff * 0.5) grantDig(p, 1); // рыбаки кормят Республику
  const trophy = f.kg >= F.trophy;
  grantXp(p, 4 + F.diff * 30 + (trophy ? 80 : 0));
  questHook(p, 'fish', { sp: f.sp, kg: f.kg });
  send(p, { type: 'fishEnd', caught: f.sp, kg: f.kg, trophy });
  if (trophy) {
    c.trophies.push({ sp: f.sp, kg: f.kg, t: Date.now() });
    G.W.trophies.push({ name: c.name, sp: f.sp, kg: f.kg, t: Date.now() });
    G.W.trophies.sort((a, b) => b.kg / FISH[b.sp].trophy - a.kg / FISH[a.sp].trophy);
    G.W.trophies.length = Math.min(20, G.W.trophies.length);
    log(`🏆 ${c.name} поймал(а) трофей: ${RES[f.sp].name} весом ${f.kg} кг!`, 'good');
    grantDig(p, 8); G.dirtyWorld = true;
  }
  p.dirtyChar = true;
}

// ---------- Башни ----------
export function towersTick() {
  const r = G.W.laws.night_watch ? 60 : 45;
  for (const b of G.W.buildings) {
    if (b.type !== 'turris' || !b.built || b.ruined) continue;
    let best = null, bd = r;
    for (const m of G.mobs.values()) if (m.hp > 0 && !m.inst && D.HOSTILE.has(m.faction) && m.faction !== 'glad' && m.faction !== 'prey') { const d = dist(m, b); if (d < bd) { bd = d; best = m; } }
    if (best) shoot({ x: b.x, z: b.z, y: WG.terrainHeight(b.x, b.z) + 9, kind: 'arrow', owner: -b.id, side: 'player', dmg: 18, target: best });
  }
}
// бесплатный хлеб
export function breadTick() {
  if (!G.W.laws.free_bread) return;
  for (const p of G.players.values()) {
    if (!p.char) continue;
    const n = Math.min(2, G.W.storage.bread || 0); if (!n) { return; }
    G.W.storage.bread -= n; addRes(p.char, 'bread', n, true);
    send(p, { type: 'log', text: `🍞 Хлебная раздача: +${n} хлеба`, kind: 'good' }); p.dirtyChar = true;
  }
  G.dirtyWorld = true;
}
// рынок: цены возвращаются к обычным
export function marketDrift() { for (const k of Object.keys(G.W.market)) { G.W.market[k] += (1 - G.W.market[k]) * 0.05; if (Math.abs(G.W.market[k] - 1) < 0.01) delete G.W.market[k]; } }
