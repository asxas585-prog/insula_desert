// Общее состояние сервера RPG, сохранение и утилиты
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as D from '../public/rpg/data.js';
import * as WG from '../public/rpg/world.js';
import { arrangeCityAdditions, protectCivicLayout } from './layout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEV = process.env.DEV === '1' || process.argv.includes('--dev');

function pickDir() {
  for (const d of [process.env.DATA_DIR, '/data', path.join(__dirname, '..', 'data')]) {
    if (!d) continue;
    try { fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); return d; } catch {}
  }
  return path.join(__dirname, '..');
}
export const DATA_DIR = pickDir();
const WORLD_FILE = path.join(DATA_DIR, 'rpg-world.json');
const CHARS_FILE = path.join(DATA_DIR, 'rpg-chars.json');

export const now = () => Date.now() / 1000;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const r1 = (v) => Math.round(v * 10) / 10;
export const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
let uid = 1;
export const nid = () => uid++;

// ---------- Состояние ----------
// W — постоянный мир (сохраняется), G — живое состояние (игроки, существа, снаряды)
export const G = {
  W: null, world: null, chars: {},
  players: new Map(), // pid -> player
  mobs: new Map(), proj: new Map(), drops: new Map(), schools: new Map(), eships: new Map(), crates: new Map(),
  instances: new Map(), arena: null,
  nodeAmt: new Map(), // id -> текущее количество (если тронут)
  nodeById: new Map(), chestById: new Map(),
  t0: now(), dirtyBld: true, dirtyWorld: true,
};

function freshWorld(seed) {
  return {
    v: 1, seed, created: Date.now(), time: 0, day: 1,
    buildings: [], ships: [], slaves: [],
    treasury: 300, storage: { wood: 60, stone: 40 },
    laws: Object.fromEntries(Object.keys(D.LAWS).map((k) => [k, 0])),
    offices: {}, election: null, lawVote: null, electionAt: 900,
    story: 0, threat: 10, favor: 50,
    events: [], requests: [], quests: [], nextEvent: 180,
    nodes: {}, chests: {}, camps: {},
    trophies: [], chronicle: [], market: {}, slaveMarket: [], slaveMarketAt: 0, garrison: 0,
    arenaRecord: 0, priority: null, nextQuest: 0,
  };
}

export function loadAll() {
  let W = null;
  try { W = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw new Error('Повреждено сохранение мира: ' + e.message); }
  if (!W || !W.seed) W = freshWorld(Math.floor(Math.random() * 1e9));
  const def = freshWorld(W.seed);
  for (const k of Object.keys(def)) if (W[k] === undefined) W[k] = def[k];
  G.W = W;
  try { G.chars = JSON.parse(fs.readFileSync(CHARS_FILE, 'utf8')) || {}; } catch (e) { if (e.code !== 'ENOENT') throw new Error('Повреждено сохранение персонажей: ' + e.message); G.chars = {}; }
  G.world = WG.generateWorld(W.seed);
  for (const n of G.world.nodes) G.nodeById.set(n.id, n);
  for (const c of G.world.chests) { const mv = W.chestPos && W.chestPos[c.id]; if (mv) { c.x = mv.x; c.z = mv.z; } G.chestById.set(c.id, c); }
  for (const b of W.buildings) uid = Math.max(uid, (b.id | 0) + 1);
  for (const s of W.ships) uid = Math.max(uid, (s.id | 0) + 1);
  for (const s of W.slaves) uid = Math.max(uid, (s.id | 0) + 1);
  for (const c of Object.values(G.chars)) for (const it of c.items || []) uid = Math.max(uid, (it.uid | 0) + 1);
  for (const c of Object.values(G.chars)) { for (const sq of c.squads || []) { uid = Math.max(uid, (sq.id | 0) + 1); sq.live = []; delete sq._previousLive; } for (const h of c.horses || []) uid = Math.max(uid, (h.id | 0) + 1); for (const l of c.lions || []) uid = Math.max(uid, (l.id | 0) + 1); if (c.guard) c.guard.id = null; }
  for (const r of W.routes || []) uid = Math.max(uid, (r.id | 0) + 1);
  for (const q of W.quests || []) uid = Math.max(uid,(q.id|0)+1);
  for(const s of W.ships)for(const f of s.tunaHold||[])if(f)uid=Math.max(uid,(f.id|0)+1);
  for (const o of W.slaveMarket || []) uid = Math.max(uid, (o.id | 0) + 1);
  for (const st of Object.values(W.watch || {})) st.live = [];
  uid += 10;
  for (const c of Object.values(G.chars)) for (const record of [...(c.sunk || []), ...(c.warRent || []),...(c.quests||[]),...(c.tunaCarry?[c.tunaCarry]:[])]) uid = Math.max(uid, (record.id | 0) + 1);
  for(const c of Object.values(G.chars))for(const id of c.doneQuests||[])uid=Math.max(uid,(id|0)+1);
  for (const c of Object.values(G.chars)) if (c.squads) c.squads = c.squads.filter((sq) => !sq.war); // отряды Поля Марса — только на время боя
  W.cityOff = W.cityOff || {}; if (W.election !== undefined && W.cityOff.messana && W.cityOff.messana.election === undefined) W.cityOff.messana.election = W.election; cityOff('messana'); // Мессана: те же объекты, что G.W.offices / G.W.laws
  for (const s of W.slaves) if (!s.trait) Object.assign(s, D.rollSlave(s.grade || 1)); // навык и характеристики старым рабам
  migrateGeo(W);
  console.log(`[RPG] Мир seed=${W.seed}, день ${W.day}, построек ${W.buildings.length}, персонажей ${Object.keys(G.chars).length}. Данные: ${DATA_DIR}`);
}
// версия 7: весь мир — Сицилия и острова вокруг. Старые постройки и корабли не переносятся (другая карта):
// персонажи (уровень, сумка, деньги, снаряжение, рабы) сохраняются и появляются в Мессане.
function migrateGeo(W) {
  const v = W.geo || 1;
  if (v < 7) {
    W.geo = 7;
    const nb = W.buildings.length, ns = W.ships.length;
    W.buildings = []; W.ships = []; W.nodes = {}; W.chests = {}; W.camps = {}; W.chestPos = {};
    W.story = 0; W.priority = null; W.cityState = {};
    for (const s of W.slaves) { s.bld = null; s.ludus = null; }
    for (const c of Object.values(G.chars)) { c.x = null; c.z = null; c.home = null; c.horseOut = null; c.mounted = false; if (c.lions) for (const l of c.lions) l.out = false; }
    if (nb || ns) console.log(`[RPG] Новая карта (Сицилия): старые постройки (${nb}) и корабли (${ns}) убраны, персонажи сохранены.`);
  }
  ensureCities(W);
}
// городские здания стоят на своих местах: в римских городах — целые (арена Мессаны — в руинах), во вражеских — заняты врагом
export function ensureCities(W) {
  W.cityState = W.cityState || {};
  const ids = new Set(G.world.cities.map((C) => C.id)); // убранные города (Акрагант, Лилибей): их здания и состояние удаляются
  for (const k of Object.keys(W.cityState)) if (!ids.has(k)) delete W.cityState[k];
  W.buildings = W.buildings.filter((x) => !x.muni || ids.has(x.muni.split(':')[0]));
  for (const C of G.world.cities) {
    const st = W.cityState[C.id] = W.cityState[C.id] || { owner: C.owner, def: C.owner === 'rome' ? 0 : 100, tasks: {}, captured: null };
    // здание из сохранения ищем по городу и типу (ближайшее), чтобы смена планировки не путала здания
    protectCivicLayout(W,C);
    const used = new Set();
    C.layout.forEach((L, i) => {
      const key = C.id + ':' + i;
      let b = W.buildings.find((x) => x.muni === key && x.type === L.type && !used.has(x));
      if (!b) { let bd = 1e9; for (const x of W.buildings) { if (!x.muni || used.has(x) || x.type !== L.type || !x.muni.startsWith(C.id + ':')) continue; const d = Math.hypot(x.x - L.x, x.z - L.z); if (d < bd) { bd = d; b = x; } } }
      if (b) { if(C.id==='messana'&&b.type==='amphitheatrum'){b.built=true;b.ruined=false;b.hp=b.maxHp;b.prog={...b.cost};} used.add(b); b.muni = key; b.x = L.x; b.z = L.z; b.ry = L.ry; if(L.guildRelocated)b.guildRelocated=true; b.enemy = st.owner !== 'rome'; if (L.cls != null) b.cls = L.cls; return; }
      const def = D.BUILDINGS[L.type]; if (!def) return;
      const cost = { ...def.cost }, tot = Object.values(cost).reduce((a, n) => a + n, 0);
      const roman = st.owner === 'rome', ruin = roman && C.id !== 'messana';
      b = { id: nid(), type: L.type, x: L.x, z: L.z, ry: L.ry, owner: null, ownerName: null, built: !ruin, prog: ruin ? {} : { ...cost }, cost, hp: ruin ? 0 : tot * 10, maxHp: tot * 10, ruined: false, store: {}, slaves: [], level: 1, lastProd: Date.now() / 1000, contrib: {}, island: 'main', placed: Date.now(), done: Date.now(), muni: key, city: C.id, enemy: !roman };
      if (L.cls != null) b.cls = L.cls; if(L.guildRelocated)b.guildRelocated=true;
      W.buildings.push(b); used.add(b);
    });
    W.buildings = W.buildings.filter((x) => !x.muni || !x.muni.startsWith(C.id + ':') || used.has(x)); // лишние (больше нет в планировке) — убираем
  }
  W.buildings=W.buildings.filter(b=>b.type!=='amphitheatrum'||(b.muni&&['messana','syracusae'].includes(b.city)));
  WG.setMuniFootprints(G.world.cities);
  WG.setCityRoadCells(W.buildings);
  arrangeCityAdditions(W,G.world.cities);
  WG.protectEstates(G.world,W.cityState,W.buildings);
  // городские здания, которых больше нет в планировке, убираются
  // ресурсы под городскими зданиями и улицами вырублены
  for (const b of W.buildings) { if (!b.muni) continue; const r = (D.BUILDINGS[b.type] || {}).r || 4; for (const n of G.world.nodes) if (Math.abs(n.x - b.x) < r + 1 && Math.abs(n.z - b.z) < r + 1 && Math.hypot(n.x - b.x, n.z - b.z) < r + 0.8) W.nodes[n.id] = { a: 0, t: -1 }; }
}
function snapShores(W) {
  for (const b of W.buildings) { const def = D.BUILDINGS[b.type]; if (!def || !def.shore) continue; const sn = WG.shoreSnap(b.x, b.z, def.r, WG.SHORE_FRONT[b.type]); if (sn) { b.x = r1(sn.x); b.z = r1(sn.z); b.ry = Math.round(sn.ry * 100) / 100; } }
  for (const s of W.ships) s.berth = null;
}
// версия 3: на главном острове появились реки и озёра — постройки, попавшие в воду, отодвигаются на сушу
function migrateRivers(W) {
  let moved = 0;
  for (const b of W.buildings) {
    const def = D.BUILDINGS[b.type]; if (!def || def.colony || def.shore) continue;
    if (def.bridge) { if (WG.bridgeRy(b.x, b.z) == null) { W.buildings = W.buildings.filter((x) => x !== b); moved++; } continue; } // мост, оставшийся без реки, убирается
    if (WG.waterEdgeDist(b.x, b.z) > def.r + 2) continue;
    let best = null;
    for (let r = 4; r < 160 && !best; r += 4) for (let i = 0; i < 24; i++) { const x = b.x + Math.cos(i * 0.26) * r, z = b.z + Math.sin(i * 0.26) * r; if (WG.waterEdgeDist(x, z) > def.r + 3 && WG.terrainHeight(x, z) > 0.8 && !W.buildings.some((o) => o !== b && Math.hypot(o.x - x, o.z - z) < D.BUILDINGS[o.type].r + def.r + 1)) { best = { x, z }; break; } }
    if (best) { b.x = r1(best.x); b.z = r1(best.z); moved++; }
  }
  W.nodes = {}; W.chests = {}; W.camps = {};
  for (const b of W.buildings) { const def = D.BUILDINGS[b.type]; if (!def) continue; for (const n of G.world.nodes) if (Math.hypot(n.x - b.x, n.z - b.z) < def.r + 0.8) W.nodes[n.id] = { a: 0, t: -1 }; }
  for (const c of Object.values(G.chars)) if (c.x != null && WG.terrainHeight(c.x, c.z) < 0.2) { c.x = null; c.z = null; }
  console.log(`[RPG] Реки и озёра: отодвинуто построек — ${moved}.`);
}
let saving = false;
export function saveAll() {
  if (saving || !G.W) return;
  saving = true;
  try {
    for (const p of G.players.values()) if (p.char) { p.char.x = r1(p.inst ? p.instRet.x : p.x); p.char.z = r1(p.inst ? p.instRet.z : p.z); p.char.lastSeen = Date.now(); }
    fs.writeFileSync(WORLD_FILE + '.tmp', JSON.stringify(G.W)); fs.renameSync(WORLD_FILE + '.tmp', WORLD_FILE);
    fs.writeFileSync(CHARS_FILE + '.tmp', JSON.stringify(G.chars, (key, value) => key === '_previousLive' ? undefined : value)); fs.renameSync(CHARS_FILE + '.tmp', CHARS_FILE);
  } catch (e) { console.error('[RPG] Не удалось сохранить:', e.message); }
  saving = false;
}

// ---------- Сеть ----------
export const send = (p, msg) => { if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg)); };
export const broadcast = (msg, filter) => { const s = JSON.stringify(msg); for (const p of G.players.values()) if (p.ws && p.ws.readyState === 1 && (!filter || filter(p))) p.ws.send(s); };
export function log(text, kind = 'info', to = null) {
  if (to) send(to, { type: 'log', text, kind });
  else broadcast({ type: 'log', text, kind });
}
export function announce(kind,text,tone='good'){log(text,tone);broadcast({type:'announcement',kind,text});}
export function chronicle(text) {
  G.W.chronicle.unshift({ t: Date.now(), day: G.W.day, text });
  if (G.W.chronicle.length > 60) G.W.chronicle.length = 60;
  G.dirtyWorld = true;
}
export const fx = (m) => broadcast({ type: 'fx', ...m }, (p) => !m.x || Math.abs(p.x - m.x) < 260 && Math.abs(p.z - m.z) < 260);

// ---------- Персонажи ----------
export function newChar(id, name, color) {
  const it = (k, q = 0) => ({ uid: nid(), k, q });
  return {
    id, name, color, created: Date.now(), level: 1, xp: 0, points: 0, rankBought: 0,
    stats: { str: 0, end: 0, agi: 0, cha: 0 }, dig: 0, den: 60,
    bag: { bread: 6, bandage: 3, wood: 0 },
    gear: { weapon: it('gladius'), offhand: null, head: it('pileus'), body: it('subarmalis'), legs: it('caligae') },
    items: [it('axe'), it('pick'), it('rod'), it('knife'), it('torch')], gotTorch: true, spec: {}, specPts: 0,
    quests: [], storyClaimed: 0, scraps: 0, kills: {}, sat: 100, hp: null,
    trophies: [], instCd: {}, stats2: { gathered: 0, built: 0, fish: 0, killed: 0, deaths: 0, traded: 0 },
    x: null, z: null, home: null,
  };
}
export const charOf = (p) => p.char;
export const rankOf = (c) => Math.min(D.rankIdx(c.dig || 0), c.rankBought ?? D.rankIdx(c.dig || 0));
export const rankEarned = (c) => D.rankIdx(c.dig || 0);
// пределы по должностям и латифундии
export const slaveLimitOf = (c) => D.RANKS[rankOf(c)].slaves + (hasOffice(c, 'praefectus') || hasOffice(c, 'senator') ? 3 : 0) + (c.lat ? D.LATIFUNDIUM.slavesBonus : 0);
// ---------- Должности и законы — у каждого города свои (Мессана: G.W.offices / G.W.laws) ----------
export function cityOff(cid) {
  const W = G.W; W.cityOff = W.cityOff || {};
  if (!cid || cid === 'messana') { const o = (W.cityOff.messana = W.cityOff.messana || {}); o.offices = W.offices; o.laws = W.laws; return o; }
  return (W.cityOff[cid] = W.cityOff[cid] || { offices: {}, laws: Object.fromEntries(Object.keys(D.LAWS).map((k) => [k, D.LAWS[k].def || 0])), election: null, lawVote: null });
}
export const romanCities = () => (G.world && G.world.cities ? G.world.cities.filter((C) => C.id === 'messana' || (G.W.cityState && G.W.cityState[C.id] && G.W.cityState[C.id].owner === 'rome')) : []);
// ближайший римский город к точке (его законы и должности действуют здесь); вдали от городов — Мессана
export function cityNear(x, z) { let best = 'messana', bd = 1e9; for (const C of romanCities()) { const d = Math.hypot(C.x - x, C.z - z) - C.R; if (d < bd && d < 400) { bd = d; best = C.id; } } return best; }
export const lawsAt = (pos) => (pos && isFinite(pos.x) ? cityOff(cityNear(pos.x, pos.z)).laws : G.W.laws);
// все должности персонажа во всех городах: [{ city, k }] (не больше двух)
export function officeHolds(c) { const out = []; if (!c || !G.W) return out; cityOff('messana'); for (const [cid, o] of Object.entries(G.W.cityOff || {})) for (const [k, h] of Object.entries(o.offices || {})) if (h && h.id === c.id) out.push({ city: cid, k }); return out; }
export const officesOf = (c) => [...new Set(officeHolds(c).map((h) => h.k))];
export function officeCityOf(c) { const p = [...G.players.values()].find(p => p.char?.id === c.id); const pos = {x:p?.x ?? c.x ?? 0,z:p?.z ?? c.z ?? 0}; return (G.world?.cities || []).filter(t=>dist(t,pos)<=t.R+230).sort((a,b)=>dist(a,pos)-dist(b,pos))[0]?.id || null; }
export const hasOffice = (c, k, city = officeCityOf(c)) => !!city && cityOff(city).offices?.[k]?.id === c.id;
export const holderOf = (k, cid) => cid ? cityOff(cid).offices?.[k] || null : null;
export const shipLimitOf = c => 3 + (hasOffice(c, 'praefectus') || hasOffice(c, 'senator') ? 1 : 0) + (hasOffice(c, 'navarchus') ? 2 : 0);
export const derivedOf = (c) => D.derived(c);
// книга доходов и расходов по игровым дням: book(c, 'Продажи', +n) / book(c, 'Покупки', -n); остальное — «Прочее» (ledgerTick)
export function book(c, cat, n) {
  n = Math.round(n || 0); if (!c || !n) return;
  const d = G.W.day || 0; c.ledger = c.ledger || {}; const L = (c.ledger[d] = c.ledger[d] || {});
  const k = (n > 0 ? '+' : '-') + cat; L[k] = (L[k] || 0) + n;
  c._denSeen = (c._denSeen ?? c.den - n) + n;
  const days = Object.keys(c.ledger); if (days.length > 8) for (const x of days.sort((a, b) => a - b).slice(0, days.length - 8)) delete c.ledger[x];
}
export function ledgerTick() {
  for (const c of Object.values(G.chars)) {
    if (c._denSeen == null) { c._denSeen = c.den; continue; }
    const d = Math.round(c.den - c._denSeen); if (Math.abs(d) >= 1) book(c, d > 0 ? 'Прочие доходы' : 'Прочие расходы', d);
    c._denSeen = c.den;
  }
}
export function gearArmor(c) {
  let a = 0;
  for (const s of ['offhand', 'head', 'body', 'legs']) { const g = c.gear[s]; if (g && D.GEAR[g.k]) a += (D.GEAR[g.k].armor || 0) * D.QUALITY[g.q || 0].mul; }
  a += D.specOf(c, 'war') * 2;
  return Math.min(D.ARMOR_CAP, a);
}
export function gearSlow(c) { let s = 0; for (const k of ['offhand', 'body']) { const g = c.gear[k]; if (g && D.GEAR[g.k]) s += D.GEAR[g.k].slow || 0; } return s; }
export function bagWeight(c) { let w = 0; for (const [k, n] of Object.entries(c.bag)) if (D.RES[k]) w += D.RES[k].w * n; return w; }
export function bagFree(c) { return derivedOf(c).bag - bagWeight(c); }
// сколько штук ресурса влезет
export function canTake(c, res, n) { const w = D.RES[res] ? D.RES[res].w : 1; return Math.max(0, Math.min(n, Math.floor((bagFree(c) + 1e-6) / w))); }
export function addRes(c, res, n, force = false) {
  const k = force ? n : canTake(c, res, n);
  if (k > 0) c.bag[res] = (c.bag[res] || 0) + k;
  return k;
}
export function takeRes(c, res, n) { const k = Math.min(n, c.bag[res] || 0); c.bag[res] = (c.bag[res] || 0) - k; if (!c.bag[res]) delete c.bag[res]; return k; }
export function hasAll(c, cost, mul = 1) { return Object.entries(cost).every(([k, n]) => (c.bag[k] || 0) >= Math.ceil(n * mul)); }
export function payAll(c, cost, mul = 1) { for (const [k, n] of Object.entries(cost)) takeRes(c, k, Math.ceil(n * mul)); }
export const MAX_ITEMS = 24;
export function addGear(c, k, q = 0) {
  if (c.items.length >= MAX_ITEMS) return null;
  const it = { uid: nid(), k, q }; c.items.push(it); return it;
}
export const hasTool = (c, flag) => [c.gear.weapon, ...c.items].some((g) => g && D.GEAR[g.k] && D.GEAR[g.k][flag]);

export function charPublic(c) {
  const look = {}; for (const s of ['weapon', 'offhand', 'head', 'body', 'legs']) look[s] = c.gear[s] ? [c.gear[s].k, c.gear[s].q] : null;
  if (c.torch) look.torch = 1;
  if(c.tunaCarry)look.tuna=c.tunaCarry.kg;
  if (c.carry) look.carry = D.CRATES[c.carry] ? D.CRATES[c.carry].grade : 1;
  return { name: c.name, color: c.color, level: c.level, rank: rankOf(c), look };
}

export { D, WG };
