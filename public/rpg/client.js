import { rememberAuthenticated } from './login.js';
import {pushMotion,sampleMotion} from './motion.js';
import {RANGED,rangedProfile} from './ranged.js';
import * as TN from './tuna.js';
import { formationWorld, horseMotion } from './rules.js';
// Insula Deserta: Империя — клиент
import * as R from './render.js';
import { UnitRenderer } from './unit-renderer.js';
import {crateDeckSlot} from './cargo-layout.js';
import { THREE, scene, camera, $ } from './render.js';
import * as MD from './models.js';
import * as MC from './models_city.js';
import * as ME from './models_eco.js';
import * as D from './data.js';
import * as WG from './world.js';
import { S, net, connect, esc, hexCss } from './cstate.js';
import * as UI from './ui.js';
import { Sound } from '../sound.js';

const { CFG, GEAR, RES, ENEMIES, BUILDINGS, SHIPS } = D;
class GameSound extends Sound {
  play(name, vol = 1) {
    super.play(name, vol);
    if (!this.ctx || !this.on) return;
    if (name === 'swing') this.burst(0.16, { freq: 900, q: 0.6, vol: 0.12 * vol, slide: 2.2, type: 'highpass' });
    else if (name === 'hit') { this.burst(0.08, { freq: 500, q: 1.2, vol: 0.35 * vol }); this.burst(0.12, { freq: 250, q: 1, vol: 0.25 * vol, type: 'lowpass' }); }
    else if (name === 'clang') { this.burst(0.25, { freq: 3200, q: 12, vol: 0.2 * vol }); this.burst(0.1, { freq: 1500, q: 4, vol: 0.2 * vol }); }
    else if (name === 'splash') this.burst(0.5, { freq: 900, q: 0.5, vol: 0.25 * vol, slide: 0.4 });
    else if (name === 'bow') this.burst(0.12, { freq: 2400, q: 3, vol: 0.15 * vol, slide: 0.5 });
    else if (name === 'build') { this.burst(0.08, { freq: 600, q: 2, vol: 0.3 * vol }); this.burst(0.08, { freq: 600, q: 2, vol: 0.3 * vol, delay: 0.25 }); }
    else if (name === 'horn') this.burst(1.6, { freq: 220, q: 6, vol: 0.18 * vol, trem: 6 });
  }
}
export const SND = new GameSound();
window.__imp = { S, R, MD, net };

// ---------- Сущности ----------
const players = new Map(), mobs = new Map(), ships = new Map(), eships = new Map(), projs = new Map(), drops = new Map(), schools = new Map(), blds = new Map();
const chestObjs = new Map(), nodeInst = new Map(), nodeById = new Map(), crateObjs = new Map();
let W = null; // мир из seed
const colliders = []; // {x,z,r} | {x,z,w,d,ry}
const colGrid = new Map(); // ячейки 16 м
const cellKey = (x, z) => Math.floor(x / 16) + ',' + Math.floor(z / 16);
function addCollider(c) {
  colliders.push(c);
  const r = c.r || Math.hypot(c.w, c.d) / 2;
  for (let x = c.x - r; x <= c.x + r + 16; x += 16) for (let z = c.z - r; z <= c.z + r + 16; z += 16) { const k = cellKey(Math.min(x, c.x + r), Math.min(z, c.z + r)); if (!colGrid.has(k)) colGrid.set(k, []); const l = colGrid.get(k); if (!l.includes(c)) l.push(c); }
}
function removeColliders(owner) {
  for (const [k, l] of colGrid) { const f = l.filter((c) => c.owner !== owner); if (f.length !== l.length) colGrid.set(k, f); }
  for (let i = colliders.length - 1; i >= 0; i--) if (colliders[i].owner === owner) colliders.splice(i, 1);
}
function collidersOf(obj, ox, oz, ry, owner, scale = 1) {
  const list = (obj.userData && obj.userData.colliders) || [];
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const k of list) {
    const lx = k.x * scale, lz = k.z * scale;
    const x = ox + lx * c + lz * s, z = oz - lx * s + lz * c;
    if (k.r != null) addCollider({ x, z, r: k.r * scale, owner });
    else addCollider({ x, z, w: k.w * scale, d: k.d * scale, ry: ry + (k.ry || 0), owner });
  }
}
function pushOut(x, z, k, pad = 0.35) {
  if (k.r != null) {
    const dx = x - k.x, dz = z - k.z, d = Math.hypot(dx, dz), r = k.r + pad;
    if (d >= r || d < 1e-4) return null;
    return { x: k.x + dx / d * r, z: k.z + dz / d * r };
  }
  const c = Math.cos(k.ry), s = Math.sin(k.ry);
  const lx = (x - k.x) * c - (z - k.z) * s, lz = (x - k.x) * s + (z - k.z) * c;
  const hx = k.w / 2 + pad, hz = k.d / 2 + pad;
  if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) return null;
  let nx = lx, nz = lz;
  if (hx - Math.abs(lx) < hz - Math.abs(lz)) nx = Math.sign(lx || 1) * hx; else nz = Math.sign(lz || 1) * hz;
  return { x: k.x + nx * c + nz * s, z: k.z - nx * s + nz * c };
}
function collide(x, z) {
  for (let pass = 0; pass < 2; pass++) {
    const l = colGrid.get(cellKey(x, z)); if (!l) break;
    for (const k of l) { if(k.owner==='poi'+WG.wreckDeckAt(x,z)?.id)continue;const r = pushOut(x, z, k); if (r) { x = r.x; z = r.z; } }
  }
  return { x, z };
}
const instWalk = (x, z) => { const I = S.inst; if (!I) return true; return I.rooms.some((r) => Math.abs(x - r.x) < r.w / 2 - 0.6 && Math.abs(z - r.z) < r.d / 2 - 0.6) || I.cors.some((r) => Math.abs(x - r.x) < r.w / 2 + (r.ax === 'x' ? 1.5 : -0.4) && Math.abs(z - r.z) < r.d / 2 + (r.ax === 'z' ? 1.5 : -0.4)); };
export const groundAt = (x, z) => S.inst ? S.inst.y0 : Math.max(-0.7, WG.terrainHeight(x, z));
const bodyY = (x, z) => { if (S.inst) return S.inst.y0; const h = WG.terrainHeight(x, z); const g = h < -1.1 ? -1.25 : Math.max(-0.7, h); const dk = WG.deckHeight(x, z, S.blds); return dk != null && dk > g ? dk : g; };
const onDeck = (x, z) => WG.deckHeight(x, z, S.blds) != null;

// ---------- Внешность ----------
const SKIN = [0xd9a77c, 0xc68c5e, 0xe4b993, 0xa8714a, 0x8a5a3a];
const HAIR = [0x3b2a1a, 0x1e1510, 0x6a4a2a, 0x9a6a32, 0xb8823a, 0x2a2a2a];
const hashS = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const FACTION_LOOK = {
  barbarian: { tunic: 0x6b5a3a, hair: [0xb8823a, 0x9a4a22, 0xd8b060], beard: true },
  punic: { tunic: 0x6a2a5a, hair: [0x1e1510, 0x2a1a10], beard: true },
  pirate: { tunic: 0x2a3a4a, hair: [0x1e1510, 0x3b2a1a], beard: true },
  robber: { tunic: 0x9a8a62, hair: [0x1e1510], beard: false },
  glad: { tunic: 0x8a6a4a, hair: [0x3b2a1a, 0x1e1510], beard: true },
  rome: { tunic: 0x9e2a22, hair: [0x3b2a1a], beard: false },
};
function makeHumanFor(seed, look, color, faction) {
  const h = hashS(seed), fl = faction && FACTION_LOOK[faction];
  const o = MD.makeHuman({ tunic: color ?? (fl ? fl.tunic : 0x9e2a22), skin: SKIN[h % SKIN.length], hair: fl ? fl.hair[h % fl.hair.length] : HAIR[h % HAIR.length], beard: fl ? fl.beard && h % 3 > 0 : h % 4 === 0, female: false, cape: faction ? null : (h % 2 ? 0x8a1a1a : null) });
  return o;
}
function lookKey(l) { return JSON.stringify(l); }
function applyLook(o, l) {
  if (o.userData._crate) { o.remove(o.userData._crate); o.userData._crate = null; }
  if(o.userData._tuna){o.remove(o.userData._tuna);o.userData._tuna=null;}
  if(l.tuna){const f=MD.makeFish('tuna');f.rotation.z=Math.PI/2;f.position.set(0,1,.45);f.scale.setScalar(.85);o.add(f);o.userData._tuna=f;}
  if (l.carry) { // ящик в руках: перед грудью, оружие убрано
    let cr; try { cr = MD.makeTradeCrate(l.carry); } catch { cr = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.6), MD.M(0x9a7a4a)); }
    cr.position.set(0, 0.72, 0.42); o.add(cr); o.userData._crate = cr; o.userData._carry = true;
  } else o.userData._carry = false;
  MD.setGear(o, { weapon: l.carry || l.tuna ? null : l.weapon ? l.weapon[0] : null, q: l.weapon ? l.weapon[1] : 0, offhand: l.offhand ? l.offhand[0] : null, head: l.head ? l.head[0] : null, body: l.body ? l.body[0] : null, legs: l.legs ? l.legs[0] : null, torch: !!l.torch });
}
const ATK_DUR = { blade: 0.6, knife: 0.42, axe: 0.95, spear: 0.72, bow: 0.85, throw: 0.9, tool: 0.85, fist: 0.45, rod: 1.0, torch: 0.6, trident: 0.72 };
const wKind = (k) => (k && GEAR[k] ? GEAR[k].kind : k === 'falx' || k === 'sica' || k === 'falcata' || k === 'khopesh' ? 'blade' : k === 'sling' ? 'throw' : k === 'trident' ? 'trident' : 'fist');

// ---------- Подписи и полоски ----------
function hpBar(w = 1.4) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, 0.1), new THREE.MeshBasicMaterial({ color: 0xd8382a, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
  fg.position.z = 0.001; bg.renderOrder = 9; fg.renderOrder = 10;
  for (const m of [bg, fg]) m.layers.set(R.LABEL_LAYER);
  g.add(bg, fg); g.userData.fg = fg; g.userData.w = w;
  return g;
}
function setHp(bar, frac) { const fg = bar.userData.fg; fg.scale.x = Math.max(0.001, frac); fg.position.x = -(1 - frac) * (bar.userData.w - 0.04) / 2; }

// ---------- Вход ----------
const loadEl = $('loading');
function setLoad(t, p) { loadEl.classList.remove('hidden'); $('loadText').textContent = t; if (p != null) $('loadBar').style.width = Math.round(p * 100) + '%'; }
UI.initStart(async (name, code, color, password) => {
  setLoad('Соединение с сервером…', 0.02);
  try { await connect(onMsg, () => UI.addLog('Соединение с сервером потеряно. Обновите страницу.', 'bad')); }
  catch { loadEl.classList.add('hidden'); $('start').classList.remove('hidden'); $('startErr').textContent='Не удалось соединиться с сервером. Попробуйте ещё раз.'; return; }
  let token = ''; try { token = localStorage.getItem('imperiumToken') || ''; if (!token) { token = Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join(''); localStorage.setItem('imperiumToken', token); } } catch { token = Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join(''); }
  net({ type: 'join', name, code: code || undefined, password, token, color });
});

async function onWelcome(m) {
  try { rememberAuthenticated(localStorage, m.loginCode); } catch {}
  S.myId = m.id; S.seed = m.seed; S.dev = m.dev; S.nodes = m.nodes || {}; S.chests = m.chests || {}; S.chestPos = m.chestPos || {};
  S.me.x = m.x; S.me.z = m.z; S.clockOff = m.t - Date.now() / 1000;
  setLoad('Создаём архипелаг…', 0.05);
  await new Promise((r) => setTimeout(r, 30));
  WG.setCoastalExclusions(m.coastKeep || []);
  W = WG.generateWorld(S.seed);
  S.W = W; syncGuildFootprints();
  const n = R.planTerrain();
  setLoad(`Рельеф островов (${n} участков)…`, 0.08);
  await R.buildTerrain((p) => setLoad('Рельеф островов…', 0.08 + p * 0.5));
  setLoad('Море…', 0.6); await new Promise((r) => setTimeout(r, 10));
  R.buildWater();
  setLoad('Леса, скалы и руины…', 0.7); await new Promise((r) => setTimeout(r, 10));
  buildNodes(); buildDecor();
  setLoad('Точки интереса…', 0.85); await new Promise((r) => setTimeout(r, 10));
  buildPois(); buildWreckDecks();buildChests();
  setLoad('Города, дороги и акведуки…', 0.92); await new Promise((r) => setTimeout(r, 10));
  buildCities(); buildResearch();
  UI.buildMapBase(W);
  setLoad('Почти готово…', 0.97); await new Promise((r) => setTimeout(r, 10));
  for (const b of S.blds) syncBuilding(b);
  loadEl.classList.add('hidden');
  S.started = true; syncSuburbs();
  UI.onStarted(m.fresh);
  camYaw = Math.PI; // взгляд на север (к городу)
  requestAnimationFrame(loop);
}
function onMsg(m) {
  switch (m.type) {
    case 'error': loadEl.classList.add('hidden'); $('start').classList.remove('hidden'); $('startErr').textContent = m.text || 'Ошибка входа'; break;
    case 'welcome': onWelcome(m); break;
    case 's': onState(m); break;
    case 'char': { const war=S.char?.war?.lid; S.char = m.c; if(war!==S.char?.war?.lid) {clearTacticalSelection(); if(!S.char?.war && RTS.on)toggleRts();} else {const valid=new Set(barSquads().map(q=>q.id));S.selectedSquads=(S.selectedSquads||[]).filter(id=>valid.has(id));S.selSquad=S.selectedSquads[0]||null;} UI.syncTp(m.c.tpLeft); UI.onChar(); break; }
    case 'world': S.world = m; for (const e of m.events || []) if (e.left != null) e._end = performance.now() / 1000 + e.left; syncGates(); UI.onWorld(); syncSuburbs(); break;
    case 'blds': S.blds = m.list; WG.setCityRoadCells(S.blds); syncGuildFootprints(); if (S.started) syncBuildings(); UI.onBlds(); break;
    case 'roster': S.roster = new Map(m.list.map((q) => [q.id, q])); for (const [id, o] of players) if (!S.roster.has(id)) { scene.remove(o.obj); players.delete(id); } UI.syncPvp(); for (const [id, o] of players) { const q = S.roster.get(id); if (o.lbl && q && o.lbl.userData.pvp !== !!q.pvp) { o.lbl.userData.pvp = !!q.pvp; if (o.lbl.material && o.lbl.material.color) o.lbl.material.color.set(q.pvp ? 0xff7060 : 0xffffff); } } break;
    case 'log': UI.addLog(esc(m.text), m.kind); break;
    case 'loot': UI.lootToast(m.text, m.k, m.q); SND.play('pickup'); break;
    case 'announcement': UI.toast(m.text,true,10000);break;
    case 'speech': UI.toast(`📣 ${m.office ? D.OFFICES[m.office].icon + ' ' + D.OFFICES[m.office].name + ' ' : ''}${m.name} с ростр: «${m.text}»`, true, 10000); UI.addLog(`<b>📣 ${esc(m.name)} с ростр:</b> ${esc(m.text)}`, 'chat'); break;
    case 'chat': UI.addLog(`<b style="color:${hexCss(m.color)}">${m.office ? D.OFFICES[m.office].icon + ' ' : ''}${esc(m.name)}:</b> ${esc(m.text)}`, 'chat'); break;
    case 'node': S.nodes[m.id] = { a: m.a }; updateNode(m.id); break;
    case 'chest': { S.chests[m.id] = m.until; const co = chestObjs.get(m.id); if (co && m.x != null) { co.c.x = m.x; co.c.z = m.z; co.moveTo = { x: m.x, z: m.z }; } break; }
    case 'dropGone': { const d = drops.get(m.id); if (d) { scene.remove(d.obj); drops.delete(m.id); } break; }
    case 'fx': onFx(m); break;
    case 'healCooldown': S.healReady=performance.now()/1000+m.seconds;break;
    case 'dead': UI.showDead(m); S.me.alive = false; break;
    case 'respawn': S.me.x = m.x; S.me.z = m.z; S.me.alive = true; S.deadAt=0; UI.hideDead(); if(m.battleEnded){clearTacticalSelection();if(RTS.on)toggleRts();} break;
    case 'arenaSeated': S.seatingPending=null;S.spect=m.seat;S.horseVelocity=0;S.char.mounted=false;Object.assign(S.me,{x:m.seat.x,z:m.seat.z,y:m.seat.y,ry:m.seat.ry});UI.onBlds();UI.addLog('🪑 Вы на трибуне. E — меню арены; выход — кнопкой в меню.','info');break;
    case 'wreckBoardRejected': S.wreckBoardPending=null;break;
    case 'arenaLeft': S.seatingPending=null;S.spect=null;S.horseVelocity=0;Object.assign(S.me,{x:m.x,z:m.z,y:m.y});break;
    case 'arenaSeatRejected': S.seatingPending=null;UI.addLog(esc(m.text),'warn');break;
    case 'teleport': S.wreckBoardPending=null;S.seatingPending=null;S.horseVelocity=0; S.me.x = m.x; S.me.z = m.z; S.tower = null; S.spect = null; if (m.left) { S.ship = null; S.seat = null; } if (m.text) UI.addLog(esc(m.text), 'warn'); break;
    case 'levelup': UI.levelUp(m); SND.play('build'); break;
    case 'boarded': S.ship = m.sid; S.seat = m.seat; UI.addLog(m.seat === 0 ? 'Вы у руля: W/S — ход, A/D — поворот, E — сойти на берег.' : 'Вы на борту. E — сойти.', 'info'); break;
    case 'inst': enterInstance(m); break;
    case 'instExit': exitInstance(m); break;
    case 'instDone': UI.addLog('Подземелье пройдено! Выход — у входа в первую комнату (E).', 'good'); break;
    case 'cast': fishing = { x: m.x, z: m.z, px: S.me.x, pz: S.me.z, t: performance.now() / 1000, bite: false }; SND.play('splash', 0.5); break;
    case 'bite': if (fishing) fishing.bite = true; UI.fishGame(m, (ok) => net({ type: 'reel', ok })); SND.play('splash'); break;
    case 'fishEnd': fishing = null; UI.fishEnd(m); break;
    case 'npc': UI.npcDialog(m); break;
    case 'lore': UI.loreDialog(m); break;
    case 'channel': UI.channel(m); break;
    case 'tunaHelp': S.tunaHelpUntil = performance.now() + m.until * 1000; UI.addLog(`🐟 ${m.name} подсёк тунца! Жмите E — помогайте тянуть!`, 'warn'); break;
    case 'questDone': UI.questDone(m); SND.play('build'); break;
    case 'duelAsk': UI.duelAsk(m); break;
    case 'dodged': UI.floatText(S.me.x, S.me.y + 2, S.me.z, 'уклонение', '#9fd3ff'); break;
    case 'tired': UI.addLog('Не хватает выносливости.', 'warn'); break;
    case 'pong': break;
  }
}

// дальние кусты, трава и деревья не рисуем (по центру участка)
const distCull = [];
let cullT = 0;
const _bs = new THREE.Vector3();
function updateCull(dt) {
  cullT -= dt; if (cullT > 0) return; cullT = 0.4;
  const cx = camera.position.x, cz = camera.position.z, k = R.GFX.level === 0 ? 0.6 : R.GFX.level === 1 ? 0.8 : 1;
  for (const m of distCull) {
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    const s = m.isInstancedMesh ? m.boundingSphere : m.geometry.boundingSphere;
    if (!s) continue;
    const d = Math.hypot(s.center.x - cx, s.center.z - cz) - s.radius;
    m.visible = !S.inst && d < m.userData.cull * k;
  }
  // Бруттий: гулять нельзя — только гавань-деревня Регия и (во время боя) Поле Марса
  if (W.war && !WG.nearWreck(S.me.x,S.me.z) && !S.ship && !S.inst && S.me.alive && !(S.char && S.char.war)) { const v = W.war.village, isl = WG.islandAt(S.me.x, S.me.z); if (isl && isl.id === 'italia' && WG.terrainHeight(S.me.x, S.me.z) > 0.2 && Math.hypot(S.me.x - v.x, S.me.z - v.z) > v.r + 6 && performance.now() - (S._warHomeAt || 0) > 3000) { S._warHomeAt = performance.now(); net({ type: 'warHome' }); } }
  // постройки и точки интереса вдали не рисуем (большие видно дальше)
  const px = S.me.x, pz = S.me.z, far = (R.GFX.level === 0 ? 0.7 : R.GFX.level === 1 ? 0.85 : 1);
  for (const o of blds.values()) { const b = o.data, r = (BUILDINGS[b.type] || {}).r || 4, lim = (r >= 20 ? 1300 : r >= 9 ? 700 : 420) * far; o.obj.visible = !S.inst && Math.abs(b.x - px) < lim && Math.abs(b.z - pz) < lim && Math.hypot(b.x - px, b.z - pz) < lim; }
  for (const p of poiObjs) { if (!p.obj || p.inst || p.type === 'volcano') continue; const lim = ((p.r || 4) >= 10 ? 800 : 450) * far; p.obj.visible = !S.inst && Math.hypot(p.x - px, p.z - pz) < lim; }
  for (const [, c] of chestObjs) { const on = !S.inst && Math.hypot(c.c.x - px, c.c.z - pz) < (c.c.sea ? 700 : 300) * far; if (c._far !== !on) { c._far = !on; for (const ch of c.o.children) ch.visible = on; } }
  for (const o of cityObjs) { const c = o.userData.cullAt; if (c) o.visible = !S.inst && Math.hypot(c.x - px, c.z - pz) < c.d; }
}
// ---------- Ресурсы (инстансы) ----------
const NODE_MODEL = { olive: () => MD.makeTree('olive'), pine: () => MD.makeTree('pine'), cypress: () => MD.makeTree('cypress'), oak: () => MD.makeTree('oak'), palm: () => MD.makeTree('palm'), cedar: () => MD.makeTree('cedar'), stone: () => MD.makeRockNode('stone'), iron: () => MD.makeRockNode('iron'), marble: () => MD.makeRockNode('marble'), silver: () => MD.makeRockNode('silver'), clay: () => MD.makeRockNode('clay'), murex: () => MD.makeItemDrop('murex'), papyrus: () => MD.makeBush('papyrus'), reed: () => MD.makeBush('reed') };
const TREE = new Set(['olive', 'pine', 'cypress', 'oak', 'palm', 'cedar']);
const _zeroM = new THREE.Matrix4().makeScale(0, 0, 0), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
function buildNodes() {
  const groups = new Map(), srcGeo = new Map();
  for (const n of W.nodes) { const k = n.kind + '|' + Math.floor(n.x / 240) + ',' + Math.floor(n.z / 240); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); nodeById.set(n.id, n); }
  for (const [k, list] of groups) {
    const kind = k.split('|')[0];
    if (!srcGeo.has(kind)) { const src = (NODE_MODEL[kind] || NODE_MODEL.stone)(); const geos = []; R.collectGeos(src, geos, true); srcGeo.set(kind, R.mergeGeometries(geos, false)); for (const g of geos) g.dispose(); }
    const im = new THREE.InstancedMesh(srcGeo.get(kind), TREE.has(kind) ? R.treeMat : R.bakedMat, list.length);
    im.castShadow = true; im.receiveShadow = true;
    list.forEach((n, i) => {
      const y = TREE.has(kind) ? WG.terrainHeight(n.x, n.z) : lowest(n.x, n.z, 1.2 * n.s) + 0.02;
      n.y = y; n.im = im; n.ii = i;
      _m4.compose(_v.set(n.x, y, n.z), _q.setFromEuler(_e.set(0, n.ry, 0)), _s.setScalar(n.s));
      n.mat = _m4.clone();
      im.setMatrixAt(i, (S.nodes[n.id] && S.nodes[n.id].a <= 0) ? _zeroM : n.mat);
      if (TREE.has(kind)) addCollider({ x: n.x, z: n.z, r: 0.45 * n.s, node: n.id });
      else if (kind !== 'murex' && kind !== 'papyrus' && kind !== 'reed') addCollider({ x: n.x, z: n.z, r: 0.9 * n.s, node: n.id });
    });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    im.userData.cull = TREE.has(kind) ? 520 : 300; distCull.push(im);
    scene.add(im);
  }
}
function lowest(x, z, r) { let lo = WG.terrainHeight(x, z); for (let i = 0; i < 6; i++) lo = Math.min(lo, WG.terrainHeight(x + Math.cos(i * 1.05) * r, z + Math.sin(i * 1.05) * r)); return lo; }
function updateNode(id) {
  const n = nodeById.get(id); if (!n || !n.im) return;
  const a = S.nodes[id] ? S.nodes[id].a : n.max;
  n.im.setMatrixAt(n.ii, a > 0 ? n.mat : _zeroM); n.im.instanceMatrix.needsUpdate = true;
  if (a <= 0) removeNodeCollider(id); else if (TREE.has(n.kind) && !colliders.some((c) => c.node === id)) addCollider({ x: n.x, z: n.z, r: 0.45 * n.s, node: id });
}
function removeNodeCollider(id) { for (const [k, l] of colGrid) { const f = l.filter((c) => c.node !== id); if (f.length !== l.length) colGrid.set(k, f); } }
const nodeAmt = (n) => (S.nodes[n.id] ? S.nodes[n.id].a : n.max);

// ---------- Декор: трава, кусты, валуны ----------
function buildDecor() {
  const rnd = WG.makeRng(S.seed ^ 0x5151);
  const cells = new Map();
  const add = (obj, x, z, soft) => {
    obj.position.set(x, WG.terrainHeight(x, z), z); obj.rotation.y = rnd() * 6.28;
    const k = (soft ? 'g' : 'r') + Math.floor(x / 128) + ',' + Math.floor(z / 128);
    if (!cells.has(k)) cells.set(k, []);
    R.collectGeos(obj, cells.get(k), false, soft ? 0.12 : 0);
  };
  const protos = { grass: MD.makeGrassTuft(), med: MD.makeBush('med'), dry: MD.makeBush('dry'), reed: MD.makeBush('reed') };
  for (const isl of WG.ISLANDS_LIST) {
    const area = isl.poly ? 2.6e6 : isl.r * isl.r * 3.14, B = WG.SIC_BOX;
    const N = Math.round(area / (isl.biome === 'desert' ? 900 : isl.poly ? 330 : 260));
    for (let i = 0; i < N; i++) {
      let x, z;
      if (isl.poly) { x = B[0] + rnd() * (B[1] - B[0]); z = B[2] + rnd() * (B[3] - B[2]); if (WG.sdfBase(x, z) < 0) { i--; continue; } }
      else { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * isl.r * 1.05; x = isl.x + Math.cos(a) * d; z = isl.z + Math.sin(a) * d; }
      const h = WG.terrainHeight(x, z);
      if (h < 1.2 || h > 40) continue;
      if (isl.poly && (WG.cityAt(x, z, 20) || WG.onRoadNet(x, z))) continue;
      if (W.pois.some((p) => Math.abs(p.x - x) < p.r + 2 && Math.abs(p.z - z) < p.r + 2)) continue;
      const r = rnd();
      let proto, soft = true, sc = 0.7 + rnd() * 0.7;
      if (isl.biome === 'desert') proto = r < 0.6 ? protos.dry : protos.grass;
      else if (isl.biome === 'rock') proto = r < 0.5 ? protos.dry : r < 0.8 ? protos.grass : null;
      else proto = r < 0.62 ? protos.grass : r < 0.85 ? protos.med : protos.dry;
      if (r > 0.94) { const rock = MD.makeRock(0.6 + rnd() * 1.3); add(rock, x, z, false); if (rock.scale) {} addCollider({ x, z, r: 0.7 }); continue; }
      if (!proto) continue;
      const o = proto.clone(); o.scale.setScalar(sc); add(o, x, z, soft);
    }
  }
  // валуны по берегам рек
  for (const r of W.riverRocks || []) {
    const rock = MD.makeRock(r.s); rock.position.set(r.x, WG.terrainHeight(r.x, r.z) - r.s * 0.25, r.z); rock.rotation.y = rnd() * 6.28;
    const k = 'r' + Math.floor(r.x / 128) + ',' + Math.floor(r.z / 128); if (!cells.has(k)) cells.set(k, []); R.collectGeos(rock, cells.get(k), false, 0);
    addCollider({ x: r.x, z: r.z, r: r.s * 0.7 });
  }
  for (const [k, geos] of cells) if (geos.length) { const m = R.bakeMesh(geos, k[0] === 'g' ? R.grassMat : R.bakedMat); if (k[0] === 'g') m.castShadow = false; m.geometry.computeBoundingSphere(); m.userData.cull = k[0] === 'g' ? 170 : 320; distCull.push(m); scene.add(m); }
}

// ---------- Города: стены, улицы, молы, акведуки, дороги и мосты ----------
const cityObjs = [], towers = [], gateDoors = [];
export const towerAt = (x, z) => towers.find((t) => Math.abs(x - t.x) < t.half + 0.3 && Math.abs(z - t.z) < t.half + 0.3 && (() => { const c = Math.cos(t.a), s = Math.sin(t.a), dx = x - t.x, dz = z - t.z; return Math.abs(dx * c - dz * s) < t.half && Math.abs(dx * s + dz * c) < t.half; })());
// ворота: створки и препятствие, когда заперты
function syncGates() { const gs = (S.world && S.world.gates) || {}; for (const d of gateDoors) { const st = gs[d.city], shut = !!(st && st.closed && st.hp > 0); if (shut === d.shut) continue; d.shut = shut; d.obj.visible = shut; const own = 'gate_' + d.city + '_' + d.g.x.toFixed(0); if (shut) addCollider({ x: d.g.x, z: d.g.z, w: 8.4, d: 1.2, ry: d.g.a, owner: own }); else removeColliders(own); } }
function buildCities() {
  // всё неподвижное одного города (улицы, стены, акведук, молы, флаги) склеивается в несколько общих мешей — меньше вызовов отрисовки
  let cg = null;
  const add = (o, x, y, z, ry, owner) => { o.position.set(x, y, z); o.rotation.y = ry || 0; o.updateMatrixWorld(true); if (owner) collidersOf(o, x, z, ry || 0, owner); if (cg) cg.add(o); else { R.optimizeStatic(o, { ground: false }); scene.add(o); cityObjs.push(o); } return o; };
  for (const C of W.cities || []) {
    cg = new THREE.Group(); cg.name = 'city_' + C.id;
    // улицы кардо и декуманус — мощёные плиты
    if (MC.makeStreetSlab) for (const st of C.streets) {
      const [from,to]=st.pts,full=Math.hypot(to[0]-from[0],to[1]-from[1]),dx=(to[0]-from[0])/full,dz=(to[1]-from[1])/full;
      const a=[from[0]+dx*(st.junctionStart||0),from[1]+dz*(st.junctionStart||0)],b=[to[0]-dx*(st.junctionEnd||0),to[1]-dz*(st.junctionEnd||0)];
      const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(L/12),ry=Math.atan2(b[0]-a[0],b[1]-a[1]);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; if (WG.terrainHeight(x, z) < 1.2) continue; add(MC.makeStreetSlab(L / n + 0.1, st.w), x, WG.terrainHeight(x, z) + 0.01, z, ry); }
    }
    for(const junction of C.junctions||[])if(MC.makeStreetJunction)add(MC.makeStreetJunction(junction),junction.x,WG.terrainHeight(junction.x,junction.z)+.01,junction.z,0);
    // стены с воротами (над морем стен нет)
    if (MC.makeCityWalls) {
      const keep = (a) => { const x = C.x + Math.sin(a) * C.R, z = C.z + Math.cos(a) * C.R; return WG.terrainHeight(x, z) > -0.25 && WG.waterEdgeDist(x, z) > 3 && !WG.onMole(x, z); }; // стена доходит до кромки воды (берегом в обход ворот не пройти); у начала мола стены нет — на мол заходят с берега
      const rom = C.owner === 'rome' || (S.world && S.world.cityState && S.world.cityState[C.id] && S.world.cityState[C.id].owner === 'rome');
      const wl = MC.makeCityWalls(C.R, C.gates.map((g) => g.a), keep, rom ? null : MC.makePunicBanner);
      // каждый кусок стены, башня и ворота стоят на земле под собой
      // соседние куски — почти на одной высоте (без «ступенек» на холм): опускаем выступающие, фундамент уходит в землю
      const parts = []; wl.traverse((ch) => { if (!ch.userData || !ch.userData.wallPart) return; const wx = C.x + ch.position.x, wz = C.z + ch.position.z; let h = 1e9; for (const [ox, oz] of [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]]) h = Math.min(h, WG.terrainHeight(wx + ox, wz + oz)); parts.push({ ch, a: Math.atan2(ch.position.x, ch.position.z), raw: h, h }); });
      parts.sort((p, q) => p.a - q.a);
      for (let it = 0; it < 6; it++) for (let i = 0; i < parts.length; i++) { const p = parts[i], l = parts[(i + parts.length - 1) % parts.length], r = parts[(i + 1) % parts.length]; p.h = Math.max(p.raw - 3.2, Math.min(p.h, l.h + 0.6, r.h + 0.6)); }
      for (const p of parts) p.ch.position.y = p.h - 0.15;
      // башни стен и надвратные башни: на них поднимаются (E) и стреляют сверху
      for (const p of parts) { const ch = p.ch, wp = ch.userData.wallPart, a = ch.rotation.y;
        if (wp === 'tower') towers.push({ x: C.x + ch.position.x, z: C.z + ch.position.z, y: ch.position.y + 9.5, a, half: 2.4, city: C.id });
        else if (wp === 'gate') for (const sx of [-1, 1]) { const off = 4 + 3.25; towers.push({ x: C.x + ch.position.x + Math.cos(a) * off * sx + Math.sin(a) * 0.6, z: C.z + ch.position.z - Math.sin(a) * off * sx + Math.cos(a) * 0.6, y: ch.position.y + 10.5, a, half: 2.4, city: C.id, gate: true }); } }
      add(wl, C.x, 0, C.z, 0, 'walls_' + C.id);
    }
    // створки ворот, которые запирают должностные лица (отдельно от склеенных стен)
    for (const g of C.gates) { const d = new THREE.Group(), y = WG.terrainHeight(g.x, g.z); for (const sx of [-1, 1]) { const lf = MD.mesh(new THREE.BoxGeometry(3.9, 5.8, 0.3), MD.M(0x6a4a2a), sx * 1.98, 2.9, 0, d); lf.castShadow = true; for (const yy of [0.9, 2.9, 4.9]) MD.mesh(new THREE.BoxGeometry(3.9, 0.16, 0.36), MD.M(0x3a3a3a), sx * 1.98, yy, 0, d); }
      d.position.set(g.x, y, g.z); d.rotation.y = g.a; d.visible = false; scene.add(d); gateDoors.push({ city: C.id, g, obj: d, shut: false }); }
    // флаги хозяина у ворот
    for (const g of C.gates) { const mk = C.owner === 'rome' || (S.world && S.world.cityState && S.world.cityState[C.id] && S.world.cityState[C.id].owner === 'rome') ? MC.makeRomanBanner : MC.makePunicBanner; if (!mk) continue; for (const sd of [-1, 1]) { const x = g.x + Math.cos(g.a) * sd * 7 + Math.sin(g.a) * 4, z = g.z - Math.sin(g.a) * sd * 7 + Math.cos(g.a) * 4; add(mk(), x, WG.terrainHeight(x, z), z, g.a); } }
    // акведук: аркады от реки к водонапорной башне
    if (C.aqueduct && MC.makeAqueductSpan) {
      const [fx, fz] = C.aqueduct.from, [tx, tz] = C.aqueduct.to, L = Math.hypot(tx - fx, tz - fz), n = Math.max(1, Math.round(L / 10)), sl = L / n, ry = Math.atan2(tx - fx, tz - fz);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = fx + (tx - fx) * t, z = fz + (tz - fz) * t; const g0 = Math.min(WG.terrainHeight(x - Math.sin(ry) * sl / 2, z - Math.cos(ry) * sl / 2), WG.terrainHeight(x + Math.sin(ry) * sl / 2, z + Math.cos(ry) * sl / 2)); const top = C.aqueduct.top + (1 - t) * 0.4; if (top - g0 < 0.6) continue; add(MC.makeAqueductSpan(sl, top - g0), x, g0, z, ry, 'aq_' + C.id); }
    }
    // каменные молы гаваней
    if (MC.makeMoleSegment) for (const m of WG.MOLES) { if (m.city !== C.id) continue; for (let k = 0; k < m.pts.length - 1; k++) {
      const [ax, az] = m.pts[k], [bx, bz] = m.pts[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 8)), ry = Math.atan2(bx - ax, bz - az);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; add(MC.makeMoleSegment(L / n + 0.3, m.w), ax + (bx - ax) * t, WG.MOLE_TOP + 0.05 + ((i + k) % 2) * 0.014, az + (bz - az) * t, ry, 'mole'); } // чуть выше земли и с разной высотой стыков — без мерцания
    } }
    // мощёная площадь-парк вокруг арены: плиты, кипарисы, скамьи, факелы
    for (const L of C.layout) { if (L.type !== 'amphitheatrum') continue;
      const cs = Math.cos(L.ry), sn = Math.sin(L.ry), Ao = 60.21, Bo = 48.06, tileM = MD.M(0xc9bda2), tileM2 = MD.M(0xb7aa8c), geo = new THREE.BoxGeometry(4.05, 0.3, 4.05);
      for (let lx = -Ao - 14; lx <= Ao + 14; lx += 4) for (let lz = -Bo - 14; lz <= Bo + 14; lz += 4) {
        const e1 = (lx / (Ao - 1)) ** 2 + (lz / (Bo - 1)) ** 2, e2 = (lx / (Ao + 13)) ** 2 + (lz / (Bo + 13)) ** 2; if (e1 < 1 || e2 > 1) continue;
        const x = L.x + lx * cs + lz * sn, z = L.z - lx * sn + lz * cs, h = WG.terrainHeight(x, z); if (h < 1) continue;
        const t = new THREE.Mesh(geo, ((lx + lz) / 4) % 2 ? tileM : tileM2); t.receiveShadow = true; t.position.set(x, h - 0.1, z); t.rotation.y = L.ry; t.updateMatrixWorld(); cg.add(t); }
      for (let i = 0; i < 18; i++) { const th = (i / 18) * Math.PI * 2; if (Math.abs(Math.sin(th)) < 0.2) continue; const lx = (Ao + 11) * Math.cos(th), lz = (Bo + 11) * Math.sin(th), x = L.x + lx * cs + lz * sn, z = L.z - lx * sn + lz * cs, h = WG.terrainHeight(x, z); if (h < 1) continue;
        const tr = MD.makeTree(i % 3 ? 'cypress' : 'olive'); add(tr, x, h, z, th); addCollider({ x, z, r: 0.5 });
        if (i % 3 === 1 && MD.makeTorchPost) add(MD.makeTorchPost(), L.x + (Ao + 7) * Math.cos(th + 0.17) * cs + (Bo + 7) * Math.sin(th + 0.17) * sn, h, L.z - (Ao + 7) * Math.cos(th + 0.17) * sn + (Bo + 7) * Math.sin(th + 0.17) * cs, 0);
        if (i % 3 === 2 && MD.H && MD.H.bench) { const bg = new THREE.Group(); MD.H.bench(bg, 0, 0, 0, 2.2, 0); const bx = L.x + (Ao + 7) * Math.cos(th) * cs + (Bo + 7) * Math.sin(th) * sn, bz = L.z - (Ao + 7) * Math.cos(th) * sn + (Bo + 7) * Math.sin(th) * cs; add(bg, bx, WG.terrainHeight(bx, bz), bz, Math.atan2(L.x - bx, L.z - bz) + Math.PI / 2); } }
    }
    // уличные факелы вдоль главных улиц
    if (MD.makeTorchPost) for (const st of C.streets) { if (st.lane) continue; const [a, b] = st.pts, L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
      for (let d = 10, k = 0; d < L - 4; d += 16, k++) { const sd = k % 2 ? 1 : -1, x = a[0] + (b[0] - a[0]) * d / L + nx * sd * (st.w / 2 + 0.7), z = a[1] + (b[1] - a[1]) * d / L + nz * sd * (st.w / 2 + 0.7);
        if (WG.terrainHeight(x, z) < 1.2 || C.layout.some((l) => Math.hypot(l.x - x, l.z - z) < ((BUILDINGS[l.type] || {}).r || 4) + 0.5)) continue; add(MD.makeTorchPost(), x, WG.terrainHeight(x, z), z, 0); } }
    scene.add(cg); cg.updateMatrixWorld(true); R.optimizeStatic(cg, { ground: false }); cityObjs.push(cg); cg.userData.cullAt = { x: C.x, z: C.z, d: 1700 }; cg = null;
    // подпись города
    const fo = C.layout[0]; if (fo) { const lb = MD.makeLabel('🏛 ' + C.name, C.owner === 'rome' ? '#ffe9a8' : '#ff9a7a', {occluded:true}); lb.position.set(fo.x, 34, fo.z); lb.scale.multiplyScalar(2.2); scene.add(lb); cityObjs.push(lb); }
  }
  // римские дороги — лента по рельефу
  const roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const rd of WG.roadsList()) {
    const P = [], Cc = [], I = []; let prev = null, run = 0;
    const pts = []; for (let k = 0; k < rd.pts.length - 1; k++) { const [ax, az] = rd.pts[k], [bx, bz] = rd.pts[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 3)); for (let i = 0; i < n; i++) pts.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n]); }
    pts.push(rd.pts[rd.pts.length - 1]);
    for (let k = 0; k < pts.length; k++) {
      const [x, z] = pts[k], q = pts[Math.min(pts.length - 1, k + 1)], o = pts[Math.max(0, k - 1)], dx = q[0] - o[0], dz = q[1] - o[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * 2.6, nz = dx / l * 2.6;
      const ok = WG.terrainHeight(x, z) > -0.3 && !WG.cityAt(x, z, 2);
      if (!ok) { prev = null; continue; }
      const base = P.length / 3;
      for (const sd of [-1, 1]) { const px = x + nx * sd, pz = z + nz * sd; P.push(px,(WG.roadSurface(x,z)?.y??WG.terrainHeight(x,z))+.07,pz); const v = 0.42 + WG.vnoise(px * 0.4, pz * 0.4) * 0.12; Cc.push(v * 1.05, v, v * 0.9); }
      if (prev != null) I.push(prev, prev + 1, base, prev + 1, base + 1, base);
      prev = base; run++;
    }
    if (!I.length) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, roadMat);m.name='road_'+rd.id; m.receiveShadow = true; scene.add(m); cityObjs.push(m);
  }
  // факелы вдоль римских дорог (через ~45 м, по очереди с двух сторон)
  if (MD.makeTorchPost) { const tg = new THREE.Group(); let cnt = 0;
    for (const rd of WG.roadsList()) { let acc = 0, k = 0; for (let i = 0; i < rd.pts.length - 1; i++) { const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1], L = Math.hypot(bx - ax, bz - az); acc += L; if (acc < 45) continue; acc = 0; k++;
      const nx = -(bz - az) / L, nz = (bx - ax) / L, sd = k % 2 ? 1 : -1, x = bx + nx * sd * 3.8, z = bz + nz * sd * 3.8; if (WG.terrainHeight(x, z) < 0.6 || WG.cityAt(x, z, 10) || WG.waterEdgeDist(x, z) < 3) continue;
      const o = MD.makeTorchPost(); o.position.set(x, WG.terrainHeight(x, z), z); tg.add(o); cnt++;
    } }
    // по участкам 400 м — склеиваем и прячем вдали
    const parts = new Map(); for (const o of [...tg.children]) { const key = Math.floor(o.position.x / 400) + ',' + Math.floor(o.position.z / 400); let g = parts.get(key); if (!g) { g = new THREE.Group(); parts.set(key, g); } g.add(o); }
    for (const [key, g] of parts) { scene.add(g); g.updateMatrixWorld(true); R.optimizeStatic(g, { ground: false }); const [i, j] = key.split(',').map(Number); g.userData.cullAt = { x: i * 400 + 200, z: j * 400 + 200, d: 900 }; cityObjs.push(g); }
  }
  // мосты на дорогах
  for (const b of WG.staticBridges()) { const o = MD.makeBuilding('pons'); add(o, b.x, WG.bridgeDeckY(b), b.z, b.ry, 'sbr' + b.id); }
}

// растения для исследования (с подписью)
function buildResearch() {
  if (!ME.makePlant) return;
  for (const r of W.research || []) { let o; try { o = ME.makePlant(r.sp); } catch { continue; } R.optimizeStatic(o); o.position.set(r.x, WG.terrainHeight(r.x, r.z), r.z); scene.add(o); const lb = MD.makeLabel('🌿 ' + D.PLANT_NAMES[r.sp], '#b8f0a0', {occluded:true}); lb.position.set(0, Math.max(1.6, (o.userData.height || 1) + 0.6), 0); o.add(lb); }
}
// разграбленные усадьбы — сгоревшие
function syncSuburbs() {
  if(!W||!S.started)return;
  const excluded=new Set(S.world?.excludedSuburbs||[]);
  for(const p of W.pois)if(p.type==='suburb_villa'&&(p.suppressed||excluded.has(p.id))){p.suppressed=true;const index=poiObjs.findIndex(o=>o.id===p.id);if(index>=0){scene.remove(poiObjs[index].obj);poiObjs.splice(index,1);}removeColliders('poi'+p.id);}

  const CI = S.world && S.world.cityState; if (!CI || !S.started) return;
  for (const p of poiObjs) {
    if (p.type !== 'suburb_villa' || p.burntShown) continue;
    const ci = CI[p.city]; if (!ci || !ci.burnt || !ci.burnt[p.id]) continue;
    p.burntShown = true; scene.remove(p.obj); removeColliders('poi' + p.id);
    const o = MD.makePOI('suburb_burnt'); R.optimizeStatic(o, { ground: true }); o.position.copy(p.obj.position); o.rotation.y = p.ry || 0; scene.add(o); collidersOf(o, p.x, p.z, p.ry || 0, 'poi' + p.id); p.obj = o;
  }
}
// ---------- Точки интереса ----------
const poiObjs = [];
function buildPois() {
  for (const p of W.pois) {
    if(p.suppressed)continue;
    let o;
    try { o = MD.makePOI(p.type); } catch (e) { console.warn('poi', p.type, e); continue; }
    const seaLvl = ['pier', 'trader', 'sea_rock', 'sea_wreck'].includes(p.type) && !p.warDeco;
    if (p.type !== 'volcano') R.optimizeStatic(o, { ground: !seaLvl });
    o.position.set(p.x,p.wreckDeck?p.wreckDeck.base:seaLvl?0:groundBase(p.x,p.z,p.r*.6),p.z); o.rotation.y = p.ry || 0;
    if (o.userData.smoke) volcanoSmoke = o.userData.smoke;
    scene.add(o);
    collidersOf(o, p.x, p.z, p.ry || 0, 'poi' + p.id);
    if (p.name) { const lb = MD.makeLabel(p.name, p.type === 'barb_camp' || p.type === 'punic_fort' ? '#ff9a7a' : '#ffe9a8', {occluded:true}); lb.position.set(0, { pyramid: 18, punic_fort: 14, statue: 7 }[p.type] || 6, 0); o.add(lb); }
    p.obj = o; poiObjs.push(p);
  }
  // Поле Марса: точка захвата в центре каждого поля (круг и знамя)
  for (const F of (W.war && W.war.fields) || []) {
    const y = groundBase(F.x, F.z, 4), ring = new THREE.Mesh(new THREE.RingGeometry(8.4, 9, 48), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(F.x, y + 0.12, F.z); scene.add(ring);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), new THREE.MeshStandardMaterial({ color: 0x6b4a2a })); pole.position.set(F.x, y + 3, F.z); scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshStandardMaterial({ color: 0xc9a227, side: THREE.DoubleSide })); flag.position.set(F.x + 0.9, y + 5.3, F.z); scene.add(flag);
    const lb = MD.makeLabel('🏟 ' + F.name, '#ffe9a8', {occluded:true}); lb.position.set(F.x, y + 7, F.z); scene.add(lb);
    warFlags.set(F.id, { ring, flag });
  }
  // портовые города за краем карты
  for (const [k, port] of Object.entries(D.PORTS)) {
    const o = MD.makePOI('port_city'); R.optimizeStatic(o);
    const a = Math.atan2(port.x, port.z);
    const px = port.x + Math.sin(a) * 140, pz = port.z + Math.cos(a) * 140;
    o.position.set(px, 0, pz); o.rotation.y = a + Math.PI; scene.add(o);
    const lb = MD.makeLabel('⚓ ' + port.name, '#bfe6ff', {occluded:true}); lb.position.set(0, 40, 0); lb.scale.multiplyScalar(4); o.add(lb);
  }
}
export const warFlags = new Map(); // id поля → знамя (цвет — кто держит точку)
const _seatV = new THREE.Vector3();
function seatWorld(sid, seat) {
  const o = ships.get(sid); if (!o) return null;
  const u = o.obj.userData, seats = u.seats; if (!seats || !seats.length) return null;
  const i = Math.max(0, Math.min(seats.length - 1, seat | 0));
  // Update only the root and rocking deck; oars, rigging and hull are irrelevant to a seat.
  (u.rock || o.obj).updateWorldMatrix(true,false);
  _seatV.copy(seats[i]).applyMatrix4((u.rock || o.obj).matrixWorld);
  return { x: _seatV.x, y: _seatV.y, z: _seatV.z, ry: o.obj.rotation.y, small: o.type === 'scapha' };
}
function placeCrew(dt, t) {
  if (me3 && S.ship && S.me.alive) {
    const sp = seatWorld(S.ship, S.seat ?? 0);
    if (sp) { S.me.x = sp.x; S.me.z = sp.z; me3.position.set(sp.x, sp.y, sp.z); if (!myAtk || t - myAtk.t > 0.8) { S.me.ry = sp.ry; me3.rotation.y = sp.ry; } }
  }
  for (const o of players.values()) {
    if (!o.ship) continue;
    const sp = seatWorld(o.ship, o.seat ?? 0);
    if (sp) { o.x = o.tx = sp.x; o.z = o.tz = sp.z; o.obj.position.set(sp.x, sp.y, sp.z); o.obj.rotation.y = sp.ry; }
  }
}
let volcanoSmoke = null;
function animSmoke(t) {
  if (!volcanoSmoke) return;
  volcanoSmoke.children.forEach((m, i) => { const ph = (t * 0.03 + i / 9) % 1; m.position.set(m.userData.base.x + Math.sin(t * 0.1 + i) * 3, 4 + ph * 70, m.userData.base.z + ph * 14); const k = m.userData.k * (0.5 + ph); m.scale.set(k, k * 0.7, k); m.material.opacity = 0.5 * Math.sin(ph * Math.PI); m.rotation.y = t * 0.05 + i; });
}
function groundBase(x, z, r) { const sl = WG.slopeAt(x, z, Math.max(1, r)); return (sl.lo + sl.hi) / 2; }
// прыжок
let jumpH = 0, jumpV = 0;
function doJump() {
  if (!S.me.alive || S.ship || S.inst && false || jumpH > 0.01 || UI.fishActive() || !S.char) return;
  if (WG.terrainHeight(S.me.x, S.me.z) < -1.1 && !onDeck(S.me.x, S.me.z) && !S.inst) return; // из воды не прыгнуть
  jumpV = S.char.mounted ? 7.2 : 6.2; jumpH = 0.001;
}
function buildWreckDecks(){
 for(const d of WG.wreckDecks()){const g=new THREE.Group(),mat=MD.M(0x80644a);g.name='wreckDeck_'+d.id;
  for(let z=-d.hl+.2;z<d.hl;z+=.42){const plank=new THREE.Mesh(new THREE.BoxGeometry(d.hw*2,.12,.38),mat);plank.position.set(0,-.06,z);g.add(plank);}
  g.position.set(d.x,d.y,d.z);g.rotation.y=d.ry;scene.add(g);R.optimizeStatic(g,{ground:false});
 }
}
function buildChests() {
  for (const c of W.chests) {
    const mv = S.chestPos && S.chestPos[c.id]; if (mv) { c.x = mv.x; c.z = mv.z; }
    const o = MD.makeChest(c.kind);
    R.optimizeStatic(o, { anchors: o.userData.lid ? [o.userData.lid] : [] });
    o.position.set(c.x, c.y != null ? c.y : lowest(c.x, c.z, 0.6), c.z); o.rotation.y = hashS(c.id) % 628 / 100;
    scene.add(o); chestObjs.set(c.id, { o, c, open: 0 });
  }
}

// ---------- Постройки ----------
function bKey(b) { return `${b.type}|${b.built ? 1 : 0}|${b.ruined ? 1 : 0}|${b.built ? 0 : Math.floor(progOf(b) * 4)}|${b.x}|${b.z}|${b.ry}`; }
const progOf = (b) => { const tot = Object.values(b.cost).reduce((a, n) => a + n, 0), got = Object.entries(b.prog || {}).reduce((a, [, n]) => a + n, 0); return tot ? got / tot : 0; };
function syncBuildings() {
  const seen = new Set();
  for (const b of S.blds) { seen.add(b.id); syncBuilding(b); }
  for (const [id, o] of blds) if (!seen.has(id)) { scene.remove(o.obj); removeColliders('b' + id); blds.delete(id); }
}
function syncBuilding(b) {
  let o = blds.get(b.id);
  const key = bKey(b);
  if (o && o.key === key) { o.data = b; return; }
  if (o) { scene.remove(o.obj); removeColliders('b' + b.id); }
  const def = BUILDINGS[b.type];
  let obj;
  try { obj = b.built ? MD.makeBuilding(b.type, { level: b.level || 1, cls: b.cls }) : b.muni && MC.makeRuin && progOf(b) < 0.5 ? MC.makeRuin(b.type, def.r) : MD.makeScaffold(b.type, def.r, progOf(b)); }
  catch (e) { console.warn('bld', b.type, e); obj = new THREE.Group(); }
  R.optimizeStatic(obj, { ground: true });
  if (b.ruined) obj.traverse((m) => { if (m.isMesh && m.material) { m.material = m.material.clone(); m.material.color && m.material.color.multiplyScalar(0.45); } });
  obj.position.set(b.x, b.type === 'portus' ? WG.portusBase(b) : groundBase(b.x, b.z, def.r * 0.7), b.z); obj.rotation.y = b.ry || 0;
  if (def.bridge) { // мост — на высоте настила, парапеты задерживают
    obj.position.y = WG.bridgeDeckY(b);
    scene.add(obj); collidersOf(obj, b.x, b.z, b.ry || 0, 'b' + b.id); blds.set(b.id, { obj, data: b, key }); return;
  }
  if (def.road) { // участок дороги ложится по склону
    const ry = b.ry || 0, sx = Math.sin(ry), cz = Math.cos(ry), hl = def.len / 2 - 0.2, hw = def.wid / 2 - 0.1;
    const hF = WG.terrainHeight(b.x + sx * hl, b.z + cz * hl), hB = WG.terrainHeight(b.x - sx * hl, b.z - cz * hl);
    const hR = WG.terrainHeight(b.x + cz * hw, b.z - sx * hw), hL = WG.terrainHeight(b.x - cz * hw, b.z + sx * hw);
    obj.rotation.order = 'YXZ'; obj.rotation.x = -Math.atan2(hF - hB, hl * 2); obj.rotation.z = Math.atan2(hR - hL, hw * 2);
    obj.position.y = (hF + hB + hR + hL) / 4 - 0.04;
    scene.add(obj); blds.set(b.id, { obj, data: b, key }); return;
  }
  scene.add(obj);
  if (b.built || b.muni) collidersOf(obj, b.x, b.z, b.ry || 0, 'b' + b.id);
  if (def.stall) { blds.set(b.id, { obj, data: b, key }); return; } // лавки — без подписей
  const lbl = MD.makeLabel((def.pub ? '' : '⌂ ') + def.name + (b.ownerName ? ` · ${b.ownerName}` : '') + (b.enemy ? ' (под властью врага)' : '') + (b.built ? (b.ruined ? ' (разрушено)' : '') : b.muni ? ` — руины, восстановление ${Math.round(progOf(b) * 100)}%` : ` — стройка ${Math.round(progOf(b) * 100)}%`), b.ruined ? '#ff8a6a' : def.pub ? '#ffe9a8' : '#cfe8b0', {occluded:true});
  lbl.position.set(0, Math.min(16, def.r * 0.9 + 4), 0); obj.add(lbl);
  blds.set(b.id, { obj, data: b, key });
  if (o === undefined && S.started && b.built && Date.now() - (b.done || 0) < 5000) SND.play('build');
}

// ---------- Жизнь города: работники хозяйств и горожане (только для красоты) ----------
const life = [];
let lifeKey = '',lifeNext=0;
function rebuildLife() {
  const now=performance.now();if(now<lifeNext)return;lifeNext=now+500;
  const w = S.world || {}, idle = (w.slaves || []).filter((x) => !x.bld && !x.ship && !x.ludus && !x.squad).length;
  const key = S.blds.filter((b) => b.built && !b.ruined).map((b) => b.id + ':' + (b.workers || 0) + ':' + b.x + ':' + b.z).join(',') + '|' + (w.slaveMarket || []).length + '|' + idle;
  if (key === lifeKey) return; lifeKey = key;
  for (const l of life) scene.remove(l.obj); life.length = 0;
  const rnd = WG.makeRng(12345);
  const TOOLS = { farm: 'pick', olivetum: null, vinea: null, lumber: 'axe', figlina: null, fishery: 'rod', pecus: null, linarium: null, colonia: 'pick' };
  for (const b of S.blds) {
    if (!b.built || b.ruined) continue;
    const def = BUILDINGS[b.type];
    const n = def.prod || def.colony ? Math.min(4, b.workers || 0) : 0;
    for (let i = 0; i < n; i++) {
      const o = makeHumanFor('w' + b.id + i, null, 0x8a7a62, null);
      MD.setGear(o, { weapon: TOOLS[b.type] || null, offhand: null, head: rnd() < 0.5 ? 'pileus' : null, body: null, legs: null });
      R.optimizeStatic(o); scene.add(o);
      life.push({ obj: o, home: { x: b.x, z: b.z }, r: def.r * 0.8, x: b.x + (rnd() - 0.5) * def.r, z: b.z + (rnd() - 0.5) * def.r, tx: b.x, tz: b.z, work: TOOLS[b.type] ? (b.type === 'lumber' ? 'axe' : b.type === 'fishery' ? 'rod' : 'tool') : 'fist', wt: 0 });
    }
  }
  // продавцы за прилавками (свой раб хозяина или наёмный торговец), скупщик; рабы на невольничьем рынке
  for (const b of S.blds) {
    if (!b.built || b.ruined || b.enemy) continue;
    const ry = b.ry || 0;
    if (b.type === 'stall' || b.type === 'mercator') {
      const slave = b.type === 'stall' && b.workers > 0, o = makeHumanFor('v' + b.id, null, slave ? 0x8a7a62 : [0x6a3a8a, 0x2a6a5a, 0xb86a2a][b.id % 3], null);
      if (!slave) MD.setGear(o, { weapon: null, offhand: null, head: b.id % 2 ? 'pileus' : null, body: null, legs: null });
      R.optimizeStatic(o); scene.add(o);
      const back = b.type === 'stall' ? -1.1 : 2; life.push({ obj: o, stand: true, x: b.x - Math.sin(ry) * back, z: b.z - Math.cos(ry) * back, ry, wt: 1e9 });
    }
    if (b.type === 'servile') {
      const n = Math.min(6, (w.slaveMarket || []).length), r = BUILDINGS.servile.r;
      for (let i = 0; i < n; i++) { const o = makeHumanFor('sm' + b.id + i, null, 0x8a7a62, null); R.optimizeStatic(o); scene.add(o); const off = (i - (n - 1) / 2) * 1.6; life.push({ obj: o, stand: true, x: b.x + Math.sin(ry) * (r * 0.4) + Math.cos(ry) * off, z: b.z + Math.cos(ry) * (r * 0.4) - Math.sin(ry) * off, ry, wt: 1e9 }); }
    }
  }
  // свои свободные рабы ходят за хозяином
  for (let i = 0; i < Math.min(4, idle); i++) { const o = makeHumanFor('my' + i, null, 0x8a7a62, null); R.optimizeStatic(o); scene.add(o); life.push({ obj: o, follow: i, x: S.me.x + 2 + i, z: S.me.z + 2, tx: S.me.x, tz: S.me.z, wt: 0 }); }
  // горожане гуляют между общественными зданиями
  const pubs = S.blds.filter((b) => b.built && !b.ruined && BUILDINGS[b.type].pub && !BUILDINGS[b.type].road);
  if (pubs.length >= 2) for (let i = 0; i < Math.min(18, pubs.length * 2); i++) {
    const a = pubs[Math.floor(rnd() * pubs.length)];
    const o = makeHumanFor('c' + i, null, [0xe8e0d0, 0x8a3a2a, 0x3a5a8a, 0x6a7a3a, 0xc9a227][i % 5], null);
    R.optimizeStatic(o); scene.add(o);
    life.push({ obj: o, citizen: true, pubs, x: a.x + 6, z: a.z + 6, tx: a.x, tz: a.z, wt: rnd() * 5 });
  }
}
function updateLife(dt, t) {
  rebuildLife();
  for (const l of life) {
    if (Math.abs(l.x - S.me.x) > 160 || Math.abs(l.z - S.me.z) > 160) { l.obj.visible = false; continue; }
    l.obj.visible = !S.inst;
    let speed = 0, atk = null;
    if (l.stand) { l.obj.position.set(l.x, groundAt(l.x, l.z), l.z); l.obj.rotation.y = l.ry || 0; animHuman(l.obj, dt, t, { t, speed: 0 }); continue; }
    if (l.follow != null) { // свита: идут позади хозяина, на корабле и в подземелье не видны
      l.obj.visible = !S.inst && !S.ship; const a = (S.me.ry || 0) + Math.PI + (l.follow - 1.5) * 0.5; l.tx = S.me.x + Math.sin(a) * (2.4 + (l.follow % 2)); l.tz = S.me.z + Math.cos(a) * (2.4 + (l.follow % 2)); l.wt = 0;
      if (Math.hypot(l.tx - l.x, l.tz - l.z) > 30) { l.x = l.tx; l.z = l.tz; }
      const dd = Math.hypot(l.tx - l.x, l.tz - l.z); if (dd > 0.6) { const sp = Math.min(dd * 2, 9), a2 = Math.atan2(l.tx - l.x, l.tz - l.z); l.x += Math.sin(a2) * sp * dt; l.z += Math.cos(a2) * sp * dt; l.ry = lerpAng(l.ry || a2, a2, Math.min(1, dt * 6)); speed = sp; }
      l.obj.position.set(l.x, groundAt(l.x, l.z), l.z); l.obj.rotation.y = l.ry || 0; animHuman(l.obj, dt, t, { t, speed, running: speed > 5 }); continue;
    }
    const d = Math.hypot(l.tx - l.x, l.tz - l.z);
    if (l.wt > 0) { l.wt -= dt; if (!l.citizen) atk = { kind: l.work, p: (t * 0.9) % 1, combo: 0 }; }
    else if (d > 0.8) { // идут к цели; упёршись в стену — обходят вдоль неё
      const sp = l.citizen ? 1.3 : 1.6; let a = Math.atan2(l.tx - l.x, l.tz - l.z);
      if (l.detour > 0) { l.detour -= dt; a += l.side * 1.2; }
      const nx = l.x + Math.sin(a) * sp * dt, nz = l.z + Math.cos(a) * sp * dt; const c = collide(nx, nz);
      const moved = Math.hypot(c.x - l.x, c.z - l.z);
      if (moved < sp * dt * 0.35) { l.side = l.side || (Math.random() < 0.5 ? -1 : 1); if (!(l.detour > 0)) l.detour = 1.4; else l.side = -l.side; l.stuckT = (l.stuckT || 0) + dt; if (l.stuckT > 6) { l.wt = 0; l.tx = l.x + (Math.random() - 0.5) * 20; l.tz = l.z + (Math.random() - 0.5) * 20; l.stuckT = 0; } }
      else l.stuckT = 0;
      l.x = c.x; l.z = c.z; l.ry = lerpAng(l.ry || a, a, Math.min(1, dt * 6)); speed = sp;
    }
    else {
      l.wt = 3 + Math.random() * 6;
      if (l.citizen) { const b = l.pubs[Math.floor(Math.random() * l.pubs.length)]; const r = BUILDINGS[b.type].r + 2.5, a = (b.ry || 0) + (Math.random() - 0.5) * 0.9; l.tx = b.x + Math.sin(a) * r; l.tz = b.z + Math.cos(a) * r; } // ко входу (фасад +Z)
      else { const a = Math.random() * 6.28; l.tx = l.home.x + Math.cos(a) * l.r * Math.random(); l.tz = l.home.z + Math.sin(a) * l.r * Math.random(); }
    }
    l.obj.position.set(l.x, groundAt(l.x, l.z), l.z); l.obj.rotation.y = l.ry || 0;
    animHuman(l.obj, dt, t, { t, speed, attack: atk });
  }
}

// ---------- Состояние ----------
let lastStateAt = 0;
// абордажные палубы и мостики (по ним ходят как по земле)
let bdKey = '', bdMeshes = [];
function syncBoardDecks(list) {
  const key = JSON.stringify(list || []); if (key === bdKey) return; bdKey = key; WG.setBoardDecks(list || []);
  for (const m of bdMeshes) {scene.remove(m);m.geometry.dispose();} bdMeshes = [];
  for (const d of list || []) if (d.plank) { const m = new THREE.Mesh(new THREE.BoxGeometry(d.hw * 2, 0.18, d.hl * 2), MD.M(0x8a6a44)); m.position.set(d.x, d.y - 0.1, d.z); m.rotation.y = d.ry; scene.add(m); bdMeshes.push(m); }
}
function onState(s) {
  const arrival=performance.now()/1000,stamp=s.stamp??arrival;S.motionClock=Math.max(S.motionClock??-Infinity,stamp-arrival);
  TN.syncTuna(s.tuna,ships);
  if (s.wa && S.world) S.world.war = s.wa;
  syncBoardDecks(s.bd);
  S.st = s; S.serverT = s.t; S.timeAt = performance.now() / 1000; lastStateAt = performance.now();
  const [hp, mhp, st, mst, sat, alive, poison, bath] = s.me;
  Object.assign(S.me, { hp, mhp, st, mst, sat, alive: !!alive, poison: !!poison, bath: !!bath });
  if(alive) UI.hideDead();
  if (!S.started) return;
  const seen = new Set();
  for (const a of s.p) {
    const [id, x, z, ry, fl, hpp, ship, seat, inst, at, fish, jh, gatherTool] = a;
    seen.add(id);
    if (id === S.myId) {
      S.ship = ship || null; S.seat = seat >= 0 ? seat : null;
      if (ship && !ships.get(ship)) { S.me.x = x; S.me.z = z; S.me.ry = ry; } // на корабле место задаёт палуба (placeCrew)
      continue;
    }
    let o = players.get(id);
    const info = S.roster.get(id);
    if (!info) continue;
    const displayLook=at?.[0]==='throw'?{...info.look,weapon:['pilum',0],offhand:null}:gatherTool?{...info.look,weapon:[gatherTool==='pick'?'pick':gatherTool==='axe'?'axe':null,0],offhand:null}:info.look;
    const lk = lookKey(displayLook) + info.color;
    if (!o || o.lk !== lk) {
      if (o) scene.remove(o.obj);
      const obj = makeHumanFor(info.cid, displayLook, info.color);
      applyLook(obj, displayLook);
      R.optimizeStatic(obj);
      const lbl = MD.makeLabel(`${info.office ? D.OFFICES[info.office].icon + ' ' : ''}${info.name} · ${info.level}`, '#d8f0ff');
      lbl.position.set(0, 2.45, 0); obj.add(lbl); lbl.userData.base = lbl.scale.clone();
      const bar = hpBar(1.1); bar.position.set(0, 2.2, 0); obj.add(bar);
      scene.add(obj);
      o = { id, obj, lk, x, z, ry, tx: x, tz: z, tr: ry, bar, sp: 0, lbl };
      players.set(id, o);
    }
    Object.assign(o, { tx: x, tz: z, tr: ry, fl, hpp, ship, seat, inst, at, fish, tjh: jh || 0 });
    o.obj.visible = (inst || 0) === (S.inst ? S.inst.id : 0);
  }
  for (const [id, o] of players) if (!seen.has(id)) { scene.remove(o.obj); players.delete(id); const h = horses.get('p' + id); if (h) { scene.remove(h.obj); horses.delete('p' + id); } }
  // существа
  const ms = new Set();
  for (const a of s.m) {
    const [id, type, x, z, ry, hpp, st2, lvl, wind, sq, gid, gname, foe] = a;
    ms.add(id);
    let o = mobs.get(id);
    if (!o) {
      const def = ENEMIES[type];
      let obj;
      if (def.human) { obj = makeHumanFor(id, null, null, def.faction); const g = def.gear || {}; MD.setGear(obj, { weapon: g.w || null, offhand: g.off || null, head: g.head || null, body: g.body || null, legs: null, q: def.boss ? 3 : 0 }); }
      else if (def.model === 'wagon' && MC.makeWagon) obj = MC.makeWagon();
      else if (def.model === 'scorpio') obj = makeScorpio();
      else if (def.training) obj = MD.makeTrainingTarget();
      else if (def.critter && ME.makeCritter) obj = ME.makeCritter(def.critter);
      else obj = MD.makeAnimal(def.model || type);
      if (def.boss && !def.human) {} else if (def.boss) obj.scale.setScalar(1.12);
      R.optimizeStatic(obj);
      const hostile = D.HOSTILE.has(def.faction), ally = def.faction === 'rome';
      const lbl = MD.makeLabel(`${def.name} · ${lvl}`, ally ? '#9fe39a' : hostile ? (def.boss ? '#ff6a4a' : '#ffb39a') : '#f0e6b0');
      const top = def.human ? 2.45 : { elephant: 5.2, bear: 2.4, lion: 2.1, croc: 1.2, snake: 0.9, deer: 2.2 }[def.model || type] || 1.7;
      lbl.position.set(0, top, 0); obj.add(lbl); lbl.userData.base = lbl.scale.clone();
      const bar = hpBar(def.boss ? 2.2 : 1.2); bar.position.set(0, top - 0.25, 0); obj.add(bar);
      scene.add(obj);
      o = { obj, type, def, x, z, ry, tx: x, tz: z, tr: ry, bar, lbl, deadT: 0, sp: 0 };
      mobs.set(id, o);
    }
    o.history||=[];pushMotion(o.history,{t:stamp,x,z,ry,moving:st2===1||st2===4});
    if (st2 === 3 && o.st !== 3) { o.deadT = performance.now() / 1000; }
    Object.assign(o, { tx: x, tz: z, tr: ry, hpp, st: st2, wind, sq: sq || 0, gid: gid || 0, gname: gname || '', id, foe: !!foe });
  }
  for (const [id, o] of mobs) if (!ms.has(id)) { scene.remove(o.obj); mobs.delete(id); updateHorse('m' + id, null); }
  // корабли
  syncShips(s.sh, ships, false); syncShips(s.es, eships, true);
  // снаряды
  const ps = new Set();
  for (const a of s.pr) {
    const [id, kind, x, y, z, vx, vy, vz] = a; ps.add(id);
    let o = projs.get(id);
    if (!o) { const obj = kind === 'arrow' || kind === 'bolt' ? MD.makeArrow() : kind === 'pilum' ? MD.makePilum() : MD.makeSlingStone(); if (kind === 'boulder') obj.scale.setScalar(6); if (kind === 'bolt') obj.scale.set(1.8,1.8,2.4); scene.add(obj); o = { obj }; projs.set(id, o); if (kind !== 'stone') SND.play('bow', 0.6); }
    Object.assign(o, { x, y, z, vx, vy, vz, t: performance.now() / 1000 });
  }
  for (const [id, o] of projs) if (!ps.has(id)) { scene.remove(o.obj); projs.delete(id); }
  // предметы на земле
  const ds = new Set();
  for (const a of s.d) {
    const [id, k, x, z, q] = a; ds.add(id);
    if (drops.has(id)) continue;
    let obj; try { obj = MD.makeItemDrop(k === 'scrap' ? 'papyrus' : k); } catch { obj = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), MD.M(0xc0a060)); }
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24), new THREE.MeshBasicMaterial({ color: q >= 2 ? 0x5aa8ff : q === 1 ? 0x7fd06a : 0xffe08a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.03; obj.add(glow);
    obj.position.set(x, groundAt(x, z), z); obj.rotation.y = id % 6;
    scene.add(obj); drops.set(id, { obj, k, x, z });
  }
  for (const [id, o] of drops) if (!ds.has(id)) { scene.remove(o.obj); drops.delete(id); }
  // торговые ящики на земле и в воде
  const cs = new Set();
  for (const a of s.fc || []) {
    const [id, grade, x, z, ground] = a; cs.add(id);
    let o = crateObjs.get(id);
    if (!o) { let obj; try { obj = ground ? MD.makeTradeCrate(grade) : MD.makeFloatingCrate(grade); } catch { obj = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.6), MD.M(0x9a7a4a)); } obj.position.set(x, ground ? groundAt(x, z) : 0, z); obj.rotation.y = id % 6; scene.add(obj); o = { obj, x, z, grade, ground }; crateObjs.set(id, o); }
  }
  for (const [id, o] of crateObjs) if (!cs.has(id)) { scene.remove(o.obj); crateObjs.delete(id); }
  S.ecrew = new Map((s.ec || []).map((e) => [e[0], e]));
  // косяки рыб
  const fs = new Set();
  for (const a of s.f) {
    const [id, x, z, kind] = a; fs.add(id);
    let o = schools.get(id);
    if (!o) { const obj = MD.makeFishSchool(); if (kind === 'tuna') obj.scale.setScalar(2.2); obj.position.set(x, 0, z); scene.add(obj); o = { obj, x, z, tx: x, tz: z }; schools.set(id, o); }
    o.tx = x; o.tz = z;
  }
  for (const [id, o] of schools) if (!fs.has(id)) { scene.remove(o.obj); schools.delete(id); }
}
function syncShips(list, map, enemy) {
  const seen = new Set();
  for (const a of list) {
    const [id, type, x, z, ry, speed, hpp] = a; seen.add(id);
    let o = map.get(id);
    if (!o) {
      const def = enemy ? D.ENEMY_SHIPS[type] : SHIPS[type];
      const obj = MD.makeShip(enemy && def.model ? def.model : type); if (type === 'barca' && ME.addBarcaGear) try { ME.addBarcaGear(obj); } catch {} R.optimizeStatic(obj);
      const info = !enemy && S.world ? S.world.ships.find((q) => q.id === id) : null;
      const lbl = MD.makeLabel(enemy ? def.name : (info ? info.name + (info.ownerName ? ' · ' + info.ownerName : '') : def.name), enemy ? '#ff9a7a' : '#bfe6ff');
      lbl.position.set(0, Math.max(5, def.len * 0.45), 0); obj.add(lbl);
      const bar = hpBar(3); bar.position.set(0, Math.max(5, def.len * 0.45) - 0.4, 0); obj.add(bar);
      obj.position.set(x, 0, z); obj.rotation.y = ry;
      scene.add(obj); o = { id, obj, type, x, z, ry, tx: x, tz: z, tr: ry, speed, bar, enemy };
      map.set(id, o);
    }
    Object.assign(o, { tx: x, tz: z, tr: ry, speed, hpp });
    if (!enemy) { // рабы-лучники стоят на палубе
      const info = S.world && S.world.ships.find((q) => q.id === id);syncShipCrates(o,info?.crates||[]);
      const na = info && info.archers ? Math.min(8, info.archers.length) : 0, n = Math.min(14, na + ((info && info.troops) || 0));
      if (o.archN !== n) {
        o.archN = n; const host = o.obj.userData.rock || o.obj; for (const a2 of o.arch || []) host.remove(a2); o.arch = [];
        const seats = o.obj.userData.seats || [], L = (enemy ? D.ENEMY_SHIPS[type] : SHIPS[type]).len;
        for (let i = 0; i < n; i++) { const h = makeHumanFor('ar' + id + i, null, 0x8a7a62, null); MD.setGear(h, i < na ? { weapon: 'bow', offhand: null, head: null, body: null, legs: null } : { weapon: 'gladius', offhand: 'scutum', head: 'galea_iron', body: 'hamata', legs: null });
          MD.animateHuman(h,1/30,{speed:0});R.optimizeStatic(h,{rigid:true});
          const sv = seats.length ? seats[(seats.length - 1 - i % seats.length + seats.length) % seats.length] : null, side = i % 2 ? 1 : -1;
          h.position.set(sv ? sv.x + side * 0.6 : side * 0.9, sv ? sv.y : 1.2, sv ? sv.z - 0.8 - Math.floor(i / 2) * 0.9 : -L * 0.25 + Math.floor(i / 2) * 1.2); host.add(h); o.arch.push(h); }
      }
    }
  }
  for (const [id, o] of map) if (!seen.has(id)) { if (enemy) spawnSplash(o.obj.position.x, o.obj.position.z, 3); scene.remove(o.obj); map.delete(id); }
}

function syncShipCrates(ship,crates){
 const signature=crates.join('|');if(ship.crateSignature===signature)return;ship.crateSignature=signature;
 const host=ship.obj.userData.rock||ship.obj;
 for(const old of ship.crateMeshes||[]){host.remove(old);old.traverse(o=>{if(o.userData.compiledGeometry)o.geometry.dispose();});}
 ship.crateMeshes=crates.map((kind,i)=>{const mesh=MD.makeTradeCrate(D.CRATES[kind]?.grade||1);R.optimizeStatic(mesh,{rigid:true});const slot=crateDeckSlot(ship.type,i,ship.obj.userData.deckY);mesh.position.set(slot.x,slot.y,slot.z);mesh.scale.setScalar(slot.scale);mesh.name='loadedTradeCrate';host.add(mesh);return mesh;});
}

// ---------- Эффекты ----------
const parts = [];
const partGeo = new THREE.SphereGeometry(0.07, 5, 4);
function spawnBits(x, y, z, color, n = 10, speed = 3, life = 0.6, size = 1) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(partGeo, mat); m.position.set(x, y, z); m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
    scene.add(m);
    parts.push({ m, vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed * 0.8 + 0.5, vz: (Math.random() - 0.5) * speed, life, t: 0, g: 9 });
  }
}
function spawnSplash(x, z, s = 1) { spawnBits(x, 0.1, z, 0xe8f6ff, 18 * s, 4 * s, 0.9, 1.6 * s); }
const rings = [];
function spawnRing(x, y, z, color, r1 = 2.5, life = 0.8) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.35, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.08, z); scene.add(m); rings.push({ m, r1, life, t: 0 });
}
function onFx(m) {
  const y = (m.y ?? groundAt(m.x || S.me.x, m.z || S.me.z)) + 0;
  switch (m.kind) {
    case 'skill': if (Math.hypot(m.x - S.me.x, m.z - S.me.z) < 80) { const o = mobs.get(m.id); UI.addLog(`🏟 ${o ? o.def.name + ': ' : ''}${m.text}!`, 'info'); SND.play('clang'); } break;
    case 'burn': SND.play('build'); break;
    case 'mhit': { const o = mobs.get(m.id); const p = o ? o.obj.position : { x: m.x, y: groundAt(m.x, m.z), z: m.z }; spawnBits(p.x, p.y + 1.2, p.z, 0xa01818, 7, 3, 0.5); UI.floatText(p.x, p.y + 2.2, p.z, (m.crit ? '✦' : '') + m.n, m.crit ? '#ffd24a' : '#ffffff', m.crit); if (o) o.hitT = performance.now() / 1000; SND.play('hit'); break; }
    case 'hit': { const mine = m.pid === S.myId; spawnBits(m.x, groundAt(m.x, m.z) + 1.2, m.z, 0xa01818, 6, 2.5, 0.5); UI.floatText(m.x, groundAt(m.x, m.z) + 2.3, m.z, '-' + m.n, mine ? '#ff5a4a' : '#ffaaaa'); if (mine) { shake = Math.min(0.5, shake + 0.25); UI.hurtFlash(); myHitT = performance.now() / 1000; } const o = players.get(m.pid); if (o) o.hitT = performance.now() / 1000; SND.play('hit'); break; }
    case 'block': spawnBits(m.x, groundAt(m.x, m.z) + 1.3, m.z, 0xffe08a, 10, 4, 0.35, 0.7); SND.play('clang'); if (m.pid === S.myId) UI.floatText(m.x, groundAt(m.x, m.z) + 2.3, m.z, 'блок ' + m.n, '#ffe08a'); break;
    case 'whiff': break;
    case 'catapult': { const o = ships.get(m.sid); if (o && o.obj.userData.catapultArm) { o.obj.userData.catapultArm.rotation.x = o.obj.userData.catapultFired ?? 0.17; o.catT = performance.now() / 1000; } SND.play('swing'); break; }
    case 'board': spawnBits(m.x, 2.5, m.z, 0xa01818, 8, 3, 0.5); UI.floatText(m.x, 3.5, m.z, 'абордаж −' + m.n, '#ffb070'); SND.play('clang'); break;
    case 'mdie': { const o = mobs.get(m.id); if (o) { o.st = 3; o.deadT = performance.now() / 1000; } break; }
    case 'kneel': { const o = mobs.get(m.id); if (o) o.st = 6; UI.floatText(m.x, groundAt(m.x, m.z) + 2.4, m.z, 'сдаётся!', '#ffe08a'); break; }
    case 'mgone': { updateHorse('m' + m.id, null); const o = mobs.get(m.id); if (o) { scene.remove(o.obj); mobs.delete(m.id); } break; }
    case 'levelup': spawnRing(m.x, groundAt(m.x, m.z), m.z, 0xffd24a, 3, 1.2); spawnBits(m.x, groundAt(m.x, m.z) + 1, m.z, 0xffd24a, 24, 3, 1.2); break;
    case 'heal': spawnBits(m.x, groundAt(m.x, m.z) + 1, m.z, 0x8aff8a, 12, 1.5, 0.9); break;
    case 'chest': { const c = chestObjs.get(m.id); if (c) spawnBits(c.c.x, c.o.position.y + 0.8, c.c.z, 0xffe08a, 14, 2, 0.8); SND.play('pickup'); break; }
    case 'built': spawnBits(m.x, groundAt(m.x, m.z) + 2, m.z, 0xd8c8a0, 40, 8, 1.4, 3); SND.play('build'); break;
    case 'deliver': SND.play('build', 0.4); break;
    case 'ruin': spawnBits(m.x, groundAt(m.x, m.z) + 2, m.z, 0x555048, 50, 9, 1.6, 3); break;
    case 'bldhit': spawnBits(m.x, groundAt(m.x, m.z) + 1.4, m.z, 0xb8a888, 5, 3, 0.5); break;
    case 'crash': case 'ram': spawnSplash(m.x, m.z, 1.5); SND.play('hit'); shake = Math.min(0.6, shake + (Math.hypot(m.x - S.me.x, m.z - S.me.z) < 40 ? 0.4 : 0)); break;
    case 'sink': spawnSplash(m.x, m.z, 3); SND.play('splash'); break;
    case 'shiphit': spawnBits(m.x, 2.5, m.z, 0x8a6a4a, 8, 3, 0.6, 1.4); break;
    case 'thud': spawnBits(m.x, m.y + 0.1, m.z, groundAt(m.x, m.z) < -0.5 ? 0xe8f6ff : 0xb09a70, 5, 1.5, 0.4); break;
    case 'cavein': { spawnRing(m.x, m.y, m.z, 0xff5a3a, 2.6, m.warn); setTimeout(() => { spawnBits(m.x, m.y + 4, m.z, 0x8a7a62, 40, 3, 1.2, 3); shake = 0.5; SND.play('hit'); }, m.warn * 1000); break; }
    case 'horn': SND.play('horn'); break;
  }
}

// ---------- Подземелья ----------
let instGroup = null;
const savedEnv = {};
function enterInstance(m) {
  S.inst = { id: m.id, key: m.key, theme: m.theme, rooms: m.rooms, cors: m.cors, y0: m.y0, exit: m.exit };
  S.me.x = m.x; S.me.z = m.z;
  instGroup = new THREE.Group();
  for (const r of m.rooms) {
    let o; try { o = MD.makeDungeonRoom(m.theme, r.w, r.d, r.doors); } catch (e) { console.warn(e); o = new THREE.Group(); }
    R.optimizeStatic(o); o.position.set(r.x, m.y0, r.z); instGroup.add(o);
  }
  for (const c of m.cors) {
    let o; try { o = MD.makeDungeonCorridor(m.theme, c.ax === 'x' ? c.w : c.d); } catch { o = new THREE.Group(); }
    R.optimizeStatic(o); o.position.set(c.x, m.y0, c.z); if (c.ax === 'x') o.rotation.y = Math.PI / 2; instGroup.add(o);
  }
  // выход
  const ex = new THREE.Group(); const glow = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.05, 24), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.5 }));
  ex.add(glow); const lv = new MD.VLight(0xffd8a0, 2, 12); lv.position.y = 2; ex.add(lv);
  const lb = MD.makeLabel('Выход (E)', '#ffe9a8'); lb.position.y = 2.2; ex.add(lb);
  ex.position.set(m.exit.x, m.y0 + 0.02, m.exit.z); instGroup.add(ex);
  scene.add(instGroup);
  Object.assign(savedEnv, { fog: scene.fog.color.getHex(), near: scene.fog.near, far: scene.fog.far });
  R.sky.visible = false; if (R.water) R.water.visible = false;
  scene.background = new THREE.Color(0x050403);
  scene.fog.color.set(0x0a0806); scene.fog.near = 25; scene.fog.far = 90;
  UI.addLog(`Вы в подземелье: ${D.INSTANCES[m.key].name}. ${m.lootCd ? 'Добыча для вас ещё не обновилась — но опыт и задания засчитаются.' : 'Победите главаря — сокровищница в последнем зале.'}`, 'warn');
}
function exitInstance(m) {
  S.inst = null; S.me.x = m.x; S.me.z = m.z;
  if (instGroup) { scene.remove(instGroup); instGroup = null; }
  R.sky.visible = true; if (R.water) R.water.visible = true; scene.background = null;
  scene.fog.color.setHex(savedEnv.fog || 0xcfe0ea); scene.fog.near = savedEnv.near || 220; scene.fog.far = savedEnv.far || 1500;
}

// ---------- Ввод ----------
export const keys = {};
let camYaw = 0, camPitch = 0.32, camDist = 7.5;
let mouseL = false, mouseR = false, chatting = false;
let combo = 0, comboT = 0, myAtk = null, myHitT = 0, shake = 0, dodgeT = -9, dodgeDir = 0, fishing = null;
const canvas = R.renderer.domElement;
$('game').appendChild(canvas);
canvas.addEventListener('mousedown', (e) => {
  if (!S.started) return;
  if (RTS.on) { if (e.button === 0 && S.placing) { UI.confirmPlacing(); return; } tacticalDown(e); return; }
  if (document.pointerLockElement !== canvas && !S.placing) { canvas.requestPointerLock(); if (e.button === 0) return; }
  if (e.button === 0) { mouseL = true; onLeftClick(); }
  if (e.button === 2) { mouseR = true; if(rangedHold){cancelRanged();return;} if (S.placing) { UI.cancelPlacing(); return; } setBlock(true); }
});
addEventListener('mouseup', (e) => { if (RTS.on) tacticalUp(e); if (e.button === 0) {mouseL = false;if(rangedHold?.kind==='bow')releaseRanged();} if (e.button === 2) { mouseR = false; setBlock(false); } });
addEventListener('contextmenu', (e) => { if (S.started) e.preventDefault(); });
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) { camYaw -= e.movementX * 0.0026; camPitch = Math.max(-0.35, Math.min(1.25, camPitch + e.movementY * 0.0022)); }
  if (RTS.on && RTS.drag?.button === 1) { camYaw -= e.movementX * .006; RTS.pitch = Math.max(.4, Math.min(1.2, RTS.pitch + e.movementY * .003)); }
  S.mouse = { x: e.clientX, y: e.clientY };
});
addEventListener('wheel', (e) => { if (!S.started || UI.anyModal()) return; if (S.placing) { if (S.placing.demolish) return; if (S.placing.claim) { S.placing.n = Math.max(1, Math.min(8, S.placing.n - Math.sign(e.deltaY))); return; } S.placing.ry += Math.sign(e.deltaY) * (S.placing.cellSnap || S.placing.bt === 'via_turn' || S.placing.bt === 'via_cross' ? Math.PI / 2 : BUILDINGS[S.placing.bt].road ? Math.PI / 8 : 0.2); S.placing.turned = true; return; } if (RTS.on) { RTS.dist = Math.max(30, Math.min(220, RTS.dist * (e.deltaY > 0 ? 1.12 : 0.9))); return; } camDist = Math.max(2.8, Math.min(S.ship ? 45 : 18, camDist + Math.sign(e.deltaY) * (S.ship ? 2.5 : 0.8))); }, { passive: true });
let blocking = false;
function setBlock(on) { if (on === blocking) return; if (on && (S.ship || !S.me.alive || UI.anyModal())) return; blocking = on; net({ type: 'block', on }); }
export function setChatting(v) { chatting = v;if(v)cancelRanged(); }
addEventListener('keydown', (e) => {
  if (!S.started) return;
  if (chatting) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  const k = e.code;
  keys[k] = true;
  if (e.repeat) return; // автоповтор клавиши не должен сбрасывать удержание E и переключать окна
  if(k==='KeyH'&&!UI.anyModal()&&TN.toggleHarpoon()){e.preventDefault();return;}
  if (UI.handleKey(k, e)) { e.preventDefault(); return; }
  if (UI.anyModal()) return;
  if (k === 'KeyR' && S.placing && S.placing.bt && !S.placing.claim && !S.placing.demolish) { const pl = S.placing; pl.ry += pl.cellSnap || pl.bt === 'via_turn' || pl.bt === 'via_cross' ? Math.PI / 2 : BUILDINGS[pl.bt].road ? Math.PI / 8 : Math.PI / 4; pl.turned = true; return; } // R — повернуть здание при стройке и переносе
  if (k === 'Space') { e.preventDefault(); doJump(); }
  else if (k === 'KeyQ') { e.preventDefault(); doDodge(); }
  else if (k === 'KeyE') onInteract();
  else if (k === 'KeyX' && S.ship && S._shipTrader != null) UI.openTrader(S._shipTrader);
  else if (k === 'KeyX') net({ type: 'crateDrop' });
  else if (k === 'KeyZ') toggleRts();
  else if (k === 'Digit1' || k === 'Digit2' || k === 'Digit3' || k === 'Digit4' || k === 'Digit5') selectSquad(Number(k.slice(5)) - 1, e.shiftKey);
  else if (k === 'Digit0') { net({ type: 'squadCancel' }); S.selSquad = null; S.selectedSquads = []; }
  else if (k === 'KeyN') squadCmd('move', aimPoint());
  else if (k === 'KeyO') squadCmd('follow');
  else if (k === 'Digit6') squadCmd('hold');
  else if (k === 'KeyL') squadCmd('form');
  else if (k === 'KeyF' && S.ship && S.world && SHIPS[(S.world.ships.find((x) => x.id === S.ship) || {}).type]?.catapult) { net({ type: 'catapult', aim: aimMsg() }); }
  else if (k === 'KeyF') startRanged('pilum');
  else if (k === 'KeyT') net({ type: 'torch' });
  else if (k === 'KeyV'&&!S.spect&&!S.seatingPending) net({ type: 'mount' });
  else if (k === 'KeyR') net({ type: 'heal' });
  else if (k === 'KeyY') net({ type: 'eat' });
  else if (k === 'KeyK') { const on = SND.toggle(); UI.addLog(on ? 'Звук включён' : 'Звук выключен', 'info'); }
  else if (k === 'KeyP') UI.cycleGfx();
});
addEventListener('keyup', (e) => { keys[e.code] = false;if(e.code==='KeyF'&&rangedHold?.kind==='pilum')releaseRanged(); if (e.code === 'KeyE') {holdE=null;net({type:'gatherPose',active:false});} });
addEventListener('blur', () => { cancelRanged(); for (const k in keys) keys[k] = false; mouseL = false; setBlock(false); });

function aimYaw() { return camYaw + Math.PI; }
function onLeftClick() {
  if (UI.anyModal()) return;
  if(TN.fireHarpoon())return;
  if (S.placing) { UI.confirmPlacing(); return; }
  if (!S.me.alive || !S.char) return;
  const w = S.char.gear.weapon && GEAR[S.char.gear.weapon.k];
  if (w && w.kind === 'rod') {
    if (UI.fishActive()) return;
    const tgt = aimWaterPoint(); if (tgt) net({ type: 'cast', x: tgt.x, z: tgt.z }); else UI.addLog('Наведите прицел на воду поблизости.', 'warn');
    myAtk = { kind: 'rod', t: performance.now() / 1000, combo: 0 };
    return;
  }
  if (S.char.carry || S.char.tunaCarry) return; // руки заняты ящиком
  if (S.ship && (!w || w.kind !== 'bow')) { // с палубы — абордаж, если рядом вражеский корабль
    const so = ships.get(S.ship); if (!so) return;
    if (![...eships.values()].some((e) => Math.hypot(e.obj.position.x - so.obj.position.x, e.obj.position.z - so.obj.position.z) < 16 + SHIPS[so.type].len / 2)) return;
  }
  if(w?.kind==='bow'){startRanged('bow');return;}
  const t = performance.now() / 1000;
  const dur = (ATK_DUR[w ? w.kind : 'fist'] || 0.6) / (1 + (S.char.stats.agi || 0) * 0.02);
  if (myAtk && t - myAtk.t < dur * 0.75) { queuedAtk = true; return; }
  doAttack(t);
}
let rangedHold=null,rangedReady=0;
function startRanged(kind){
 if(rangedHold||!S.char||!S.me.alive||S.spect||S.placing||S.char.carry||S.char.tunaCarry||blocking||performance.now()/1000<rangedReady)return;
 const ammo=kind==='bow'?'arrow':'pilum';if(!(S.char.bag[ammo]>0)){UI.addLog(kind==='bow'?'Нет стрел.':'Нет пилумов.','warn');return;}
 if(S.me.st<RANGED[kind].stamina)return;
 queuedAtk=false;rangedHold={kind,t:performance.now()/1000};net({type:'rangedStart',kind});
}
function cancelRanged(){if(!rangedHold)return;rangedHold=null;net({type:'rangedCancel'});}
function freeAimDirection(){
 ray.setFromCamera(new THREE.Vector2(0,0),camera);let distance=120;
 // Aim at the surface under the reticle, not the centre of a nearby enemy.
 for(let t=1;t<=120;t+=.4){const p=ray.ray.at(t,new THREE.Vector3());const h=S.inst?S.inst.y0:Math.max(0,WG.terrainHeight(p.x,p.z));if(p.y<h){distance=t;break;}}
 const objects=[...mobs.values(),...players.values(),...eships.values(),...blds.values()].map(o=>o.obj).filter(o=>o?.visible);
 const hits=ray.intersectObjects(objects,true);if(hits.length&&hits[0].distance<distance)distance=hits[0].distance;
 const point=ray.ray.at(distance,new THREE.Vector3());point.sub(new THREE.Vector3(S.me.x,S.me.y+(rangedHold?.kind==='pilum'?1.8:1.5),S.me.z)).normalize();return [point.x,point.y,point.z];
}
function releaseRanged(){
 const h=rangedHold;if(!h)return;if(UI.anyModal()||!S.me.alive||S.placing){cancelRanged();return;}
 const dir=freeAimDirection();rangedHold=null;const t=performance.now()/1000;
 if(t-h.t<RANGED[h.kind].min){net({type:'rangedCancel'});return;}
 net({type:h.kind==='bow'?'atk':'throw',dir});S.me.ry=Math.atan2(dir[0],dir[2]);
 myAtk={kind:h.kind==='bow'?'bow':'throw',t:t-(h.kind==='bow'?.5:.495),combo:0};rangedReady=t+(h.kind==='bow'?.65:.85);SND.play('bow');
}
function updateRanged(){
 const cross=$('cross');if(!cross)return;
 if(rangedHold&&(UI.anyModal()||RTS.on||!S.me.alive||S.placing||S.char.carry||S.char.tunaCarry||S.spect||S.me.st<RANGED[rangedHold.kind].stamina||performance.now()/1000-rangedHold.t>12))cancelRanged();
 const active=!!rangedHold;cross.classList.toggle('ranged',active);
 if(active){const p=rangedProfile(rangedHold.kind,performance.now()/1000-rangedHold.t,{speed:moveSpeed,running:S.me.run,mounted:S.char.mounted,stamina:S.me.st/S.me.mst});cross.style.setProperty('--spread',Math.round(8+p.spread*700)+'px');cross.style.setProperty('--draw',Math.round(p.power*100)+'%');cross.title='ЛКМ — отпуск тетивы; F — отпуск пилума; ПКМ — отмена';S.me.ry=aimYaw();}
}

let queuedAtk = false;
function doAttack(t) {
  const w = S.char.gear.weapon && GEAR[S.char.gear.weapon.k];
  combo = t - comboT < 1.0 ? (combo + 1) % 3 : 0;
  comboT = t;
  S.me.ry = aimYaw();
  myAtk = { kind: w ? w.kind : 'fist', t, combo };
  net({ type: 'atk', ry: S.me.ry, combo, pitch: -camPitch + 0.3, aim: w && w.kind === 'bow' ? aimMsg() : undefined });
  SND.play(w && w.kind === 'bow' ? 'bow' : 'swing');
}
function doDodge() {
  cancelRanged();
  const t = performance.now() / 1000;
  if (!S.me.alive || S.ship || t - dodgeT < 0.75 || S.me.st < CFG.stamina.dodge) return;
  dodgeT = t;
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  dodgeDir = (f || r) ? Math.atan2(-r, f) + camYaw + Math.PI : S.me.ry;
  S.me.ry = dodgeDir;
  net({ type: 'dodge' });
}
const ray = new THREE.Raycaster(), waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function aimWaterPoint() {
  ray.setFromCamera(new THREE.Vector2(0, 0.15), camera);
  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(waterPlane, p)) return null;
  let dx = p.x - S.me.x, dz = p.z - S.me.z, d = Math.hypot(dx, dz);
  if (d > CFG.fishCastR) { dx *= CFG.fishCastR / d; dz *= CFG.fishCastR / d; }
  const x = S.me.x + dx, z = S.me.z + dz;
  if (WG.terrainHeight(x, z) > -0.8) return null;
  return { x, z };
}
// точка под прицелом (центр экрана): ближайший враг на луче или земля/вода
const _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
function aimPoint(maxD = 140) {
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  _ro.copy(ray.ray.origin); _rd.copy(ray.ray.direction);
  let best = null, bt = maxD;
  for (const o of mobs.values()) {
    if (o.st === 3 || !o.obj.visible) continue;
    const cx = o.obj.position.x - _ro.x, cy = o.obj.position.y + 1.0 - _ro.y, cz = o.obj.position.z - _ro.z;
    const t = cx * _rd.x + cy * _rd.y + cz * _rd.z; if (t < 2 || t > bt) continue;
    const px = cx - _rd.x * t, py = cy - _rd.y * t, pz = cz - _rd.z * t;
    if (px * px + py * py + pz * pz < 1.3 * 1.3) { bt = t; best = { x: o.obj.position.x, y: o.obj.position.y + 1.0, z: o.obj.position.z }; }
  }
  for (const o of eships.values()) {
    const cx = o.obj.position.x - _ro.x, cy = 2 - _ro.y, cz = o.obj.position.z - _ro.z;
    const t = cx * _rd.x + cy * _rd.y + cz * _rd.z; if (t < 2 || t > bt) continue;
    const px = cx - _rd.x * t, py = cy - _rd.y * t, pz = cz - _rd.z * t;
    if (px * px + py * py + pz * pz < 5 * 5) { bt = t; best = { x: o.obj.position.x, y: 2, z: o.obj.position.z }; }
  }
  if (best) return best;
  const floor = S.inst ? S.inst.y0 : null;
  for (let t = 2; t < maxD; t += 0.5) { const x = _ro.x + _rd.x * t, y = _ro.y + _rd.y * t, z = _ro.z + _rd.z * t; const g = floor != null ? floor : Math.max(-0.6, WG.terrainHeight(x, z)); if (y < g) return { x, y: g, z }; }
  return { x: _ro.x + _rd.x * maxD, y: _ro.y + _rd.y * maxD, z: _ro.z + _rd.z * maxD };
}
const aimMsg = () => { const a = aimPoint(); return [Math.round(a.x * 10) / 10, Math.round(a.y * 10) / 10, Math.round(a.z * 10) / 10]; };
const bowMode = () => { const w = S.char && S.char.gear.weapon && GEAR[S.char.gear.weapon.k]; return (!!(w && w.kind === 'bow')||rangedHold?.kind==='pilum') && !S.placing; };
export function groundPointAtMouse() {
  const v = new THREE.Vector2(S.mouse ? (S.mouse.x / innerWidth) * 2 - 1 : 0, S.mouse ? -(S.mouse.y / innerHeight) * 2 + 1 : 0);
  if (document.pointerLockElement === canvas) v.set(0, 0);
  ray.setFromCamera(v, camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  for (let t = 1; t < 800; t += 2) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y < WG.terrainHeight(x, z)) return { x, z }; }
  return null;
}

// ---------- Взаимодействие ----------
let focus = null, holdE = null;
function findFocus() {
  const me = S.me; let best = null, bd = 99;
  const consider = (d, f) => { if (d < bd) { bd = d; best = f; } };
  if (!me.alive) return null;
  if (S.ship) {
    const wdeck=WG.wreckDecks().find(d=>Math.hypot(d.x-me.x,d.z-me.z)<(SHIPS[ships.get(S.ship)?.type]?.len||8)/2+7);if(wdeck)return{kind:'wreckBoard',id:wdeck.id,text:'E — перейти на обломки и осмотреть сундук'};
    const so = ships.get(S.ship), sx = so ? so.obj.position.x : me.x, sz = so ? so.obj.position.z : me.z, L = SHIPS[so ? so.type : 'scapha'].len;
    const moored0 = S.world && (S.world.ships.find((x) => x.id === S.ship) || {}).berth;
    if (!moored0) for (const [id, o] of crateObjs) { const d = Math.hypot(o.x - sx, o.z - sz); if (!o.ground && d < L / 2 + 9) return { kind: 'cratePick', id, text: 'E — поднять плавающий ящик на борт' }; }
    for (const [id, c] of chestObjs) { if (!c.c.sea) continue; const rk = WG.rockAt(c.c.x, c.c.z) || { r: 8 }; if (Math.hypot(c.c.x - sx, c.c.z - sz) < rk.r + 14) return { kind: 'chest', id, text: (S.chests[id] || 0) > Date.now() / 1000 + S.clockOff ? 'Сундук на скале — пусто' : 'E — обыскать сундук на скале (с борта)' }; }
    const myS = S.world && S.world.ships.find((x) => x.id === S.ship);
    const trd = myS && (myS.crates || []).length ? (S.W.traders || []).find((tr) => Math.hypot(tr.x - sx, tr.z - sz) < 50) : null; S._shipTrader = trd ? trd.id : null; // ящики торговцу — клавишей X, E — всегда сойти
    const nearPort = (S.seat ?? 0) === 0 && (S.blds.some((b) => b.type === 'portus' && b.built && Math.hypot(b.x - sx, b.z - sz) < 120) || (S.W.traders || []).some((t) => Math.hypot(t.x - sx, t.z - sz) < 90));
    return { kind: 'leave', text: 'E — сойти с корабля' + (nearPort ? ' · G — пришвартоваться и сойти на причал' : '') + (trd ? ` · X — ${trd.name}: продать ящики с борта` : '') + ((() => { const en = [...eships.values()].find((e) => Math.hypot(e.obj.position.x - sx, e.obj.position.z - sz) < 22 + L / 2); return en ? (en.hpp < 50 ? ' · B — АБОРДАЖ (перекинуть мостик)!' : ` · враг рядом: ${en.hpp}% прочности, абордаж — когда меньше 50%`) : ''; })()) };
  }
  if (S.inst) { const d = Math.hypot(me.x - S.inst.exit.x, me.z - S.inst.exit.z); if (d < 4) return { kind: 'instExit', text: 'E — выйти из подземелья' }; return null; }
  for (const [id, o] of crateObjs) { if (!o.ground) continue; const d = Math.hypot(o.x - me.x, o.z - me.z); if (d < 2.5 && !S.char.carry) consider(d - 1.2, { kind: 'cratePick', id, text: 'E — взять ящик в руки' }); }
  for (const [id, o] of mobs) { if (Math.abs(o.x - me.x) > 6 || Math.abs(o.z - me.z) > 6) continue; const d = Math.hypot(o.x - me.x, o.z - me.z);
    if (o.st === 6 && d < 3.5) consider(d - 2, { kind: 'enslave', id, text: `E — сделать рабом: ${o.def.name}` });
    else if (o.st === 3 && o.def.tameable && d < 5) consider(d - 2, { kind: 'tame', id, text: `E — приручить льва сетью (${S.char.tamer || 0} шт., шанс 50%)` }); }
  for (const tr of S.W.traders || []) { if (!tr.poi) continue; const d = Math.hypot(tr.x - me.x, tr.z - me.z); if (d < 11) consider(d - 3, { kind: 'trader', id: tr.id, text: `E — ${tr.name}` }); }
  // клады: в отмеченном районе можно копать
  for (const tm of (S.char.sci && S.char.sci.maps) || []) { const d = Math.hypot(tm.ax - me.x, tm.az - me.z); if (d < 28) consider(3, { kind: 'dig', id: tm.id, text: 'E — копать клад здесь (по карте сокровищ)' }); }
  // исследования: растения и живые звери
  for (const A of S.W.ancient || []) { if (Math.abs(A.x - me.x) > 70 || Math.abs(A.z - me.z) > 70) continue; const R = D.ANCIENT_RUINS.find((x) => x.id === A.id), n = (S.char.lore || {})[A.id] || 0; for (const sp of A.spots) { const d = Math.hypot(sp.x - me.x, sp.z - me.z); if (d < 5) consider(d - 1.5, { kind: 'ruin', id: A.id, k: sp.k, text: sp.k < n ? `📜 ${R.stages[sp.k].title} — изучено (E — перечитать)` : sp.k === n ? `E — изучить развалины: ${R.stages[sp.k].title} (${n + 1}/${R.stages.length})` : `${R.stages[sp.k].title} — сначала «${R.stages[n].title}»` }); } }
  for (const r of S.W.research || []) { if (Math.abs(r.x - me.x) > 6 || Math.abs(r.z - me.z) > 6) continue; const d = Math.hypot(r.x - me.x, r.z - me.z); if (d < 3.5) { const done = S.char.sci && S.char.sci.rec[r.island + '|f:' + r.sp]; consider(d - 1.5, { kind: 'sciSample', id: r.id, text: done ? `🌿 ${D.PLANT_NAMES[r.sp]} — уже описано` : `E — описать растение: ${D.PLANT_NAMES[r.sp]}` }); } }
  for (const [id, o] of mobs) { if (!o.def.critter || o.st === 3) continue; const d = Math.hypot(o.obj.position.x - me.x, o.obj.position.z - me.z); if (d < 3.2) consider(d - 1.5, { kind: 'sciCatch', id, text: `E — поймать сетью: ${o.def.name} (сетей: ${(S.char.sci && S.char.sci.tools.net) || 0})` }); }
  // башни: подняться / спуститься
  if(!WG.wreckDeckAt(me.x,me.z)){const d=WG.wreckDecks().find(d=>Math.hypot(d.x-me.x,d.z-me.z)<8);if(d)consider(1,{kind:'wreckBoard',id:d.id,text:'E — подняться на обломки'});}
  if(S.spect)return{kind:'bld',id:S.spect.bid,text:'E — меню арены · ставки и игры · выход с трибуны'};
  if (S.tower) return { kind: 'towerDown', text: 'E — спуститься с башни · стреляйте из лука по врагам' };
  for (const t of towers) { if (Math.abs(t.x - me.x) > 8 || Math.abs(t.z - me.z) > 8) continue; const d = Math.hypot(t.x - me.x, t.z - me.z); if (d < t.half + 3) consider(d - 2.5, { kind: 'towerUp', t, text: `E — подняться на ${t.gate ? 'надвратную башню' : 'башню'}` }); }
  // ворота своего города: должностные лица запирают и открывают
  if (S.char.office && S.world) for (const C of S.W.cities || []) { const ci = S.world.cityState && S.world.cityState[C.id]; if (!ci || ci.owner !== 'rome') continue; for (const g of C.gates) { const d = Math.hypot(g.x - me.x, g.z - me.z); if (d < 9) { const st = (S.world.gates || {})[C.id]; consider(d - 3.5, { kind: 'gate', city: C.id, text: st && st.hp <= 0 ? 'Ворота проломлены — починятся после набега' : st && st.closed ? `E — открыть ворота ${C.name}` : `E — запереть ворота ${C.name} (от набега)` }); } } }
  // поход на города: тайники для слежки, пригородные усадьбы, ворота вражеского города
  const CI = S.world && S.world.cityState;
  if (CI) for (const C of S.W.cities || []) {
    const ci = CI[C.id]; if (!ci || ci.owner === 'rome') continue;
    if (Math.abs(me.x - C.x) > C.R + 200 || Math.abs(me.z - C.z) > C.R + 200) continue;
    for (const sp of C.spies) { const d = Math.hypot(sp.x - me.x, sp.z - me.z); if (d < 4) consider(d - 2, { kind: 'spy', poi: sp.poi, text: ci.spied[sp.poi] ? 'Отсюда город уже осмотрен' : `E — следить за городом ${C.name} (6 с не двигаться)` }); }
    for (const sb of C.suburbs) { const d = Math.hypot(sb.x - me.x, sb.z - me.z); if (d < 12 && !ci.burnt[sb.poi]) consider(d - 4, { kind: 'plunder', poi: sb.poi, text: 'E — разграбить усадьбу' }); }
    for (const g of C.gates) { const d = Math.hypot(g.x - me.x, g.z - me.z); if (d < 16) consider(d - 3, { kind: 'city', id: C.id, text: ci.def > 0 ? `E — ${C.name}: оборона ${ci.def}` : `E — ${C.name}: ШТУРМ!` }); }
  }
  for (const [id, c] of chestObjs) { if (c.c.kind === 'crate' && !c.o.visible) continue; const d = Math.hypot(c.c.x - me.x, c.c.z - me.z); if (d < 2.8) consider(d - 1, { kind: 'chest', id, text: (S.chests[id] || 0) > Date.now() / 1000 + S.clockOff ? `${D.CHESTS[c.c.kind].name} — пусто` : `E — открыть: ${D.CHESTS[c.c.kind].name}` }); }
  const l = colGrid.get(cellKey(me.x, me.z));
  for (const n of W.nodes) {
    if (Math.abs(n.x - me.x) > 5 || Math.abs(n.z - me.z) > 5) continue;
    const d = Math.hypot(n.x - me.x, n.z - me.z);
    if (d < (TREE.has(n.kind) ? 3.2 : 3) && nodeAmt(n) > 0) consider(d, { kind: 'node', id: n.id, n, text: `Удерживайте E — ${TREE.has(n.kind) ? 'рубить' : n.tool === 'pick' ? 'добывать' : 'собирать'}: ${RES[n.res].name} (${nodeAmt(n)})` });
  }
  for (const [id, o] of ships) { const def = SHIPS[o.type]; const d = Math.hypot(o.obj.position.x - me.x, o.obj.position.z - me.z); if (d < def.len / 2 + 5) consider(d - 2, S.char.carry ? { kind: 'crateLoad', id, text: `E — погрузить ящик на корабль · G — трюм` } : { kind: 'ship', id, text: `E — подняться на борт · G — трюм и груз` }); }
  for (const [id, o] of blds) {
    const b = o.data, def = BUILDINGS[b.type];
    if (def.road) continue;
    if (b.type === 'forum_m') { // форум: окно — только у ростр, речь — с самих ростр
      const ro = WG.rostraAt(me.x, me.z, [b]), cs = Math.cos(b.ry || 0), sn = Math.sin(b.ry || 0), lx = (me.x - b.x) * cs - (me.z - b.z) * sn, lz = (me.x - b.x) * sn + (me.z - b.z) * cs;
      if (ro && ro.part === 'top') consider(0, { kind: 'rostra', id, text: 'E — выступить с ростр (речь услышат все)' });
      else if (lx > -38 && lx < -22 && Math.abs(lz) < 9) consider(1, { kind: 'bld', id, text: 'E — Форум: задания, выборы, законы, казна' });
      continue;
    }
    if (b.type === 'portus') { // окно гавани — только у конторы портового магистрата, на причалах E садит на корабль
      const cs = Math.cos(b.ry || 0), sn = Math.sin(b.ry || 0), ox = b.x + 7.5 * cs - 7.2 * sn, oz = b.z - 7.5 * sn - 7.2 * cs, d = Math.hypot(ox - me.x, oz - me.z);
      if (d < 5) consider(d - 1, { kind: 'bld', id, text: b.built ? `E — ${def.name} (контора)` : `E — стройка: ${def.name} (${Math.round(progOf(b) * 100)}%)` });
      continue;
    }
    const d = Math.hypot(b.x - me.x, b.z - me.z);
    if (d < def.r + 4) consider(d - def.r + 1.5, { kind: 'bld', id, text: b.built ? `E — ${def.name}${b.ruined ? ' (ремонт)' : ''}` : `E — стройка: ${def.name} (${Math.round(progOf(b) * 100)}%)` });
  }
  for (const p of poiObjs) {
    const d = Math.hypot(p.x - me.x, p.z - me.z);
    if (p.inst && d < 10) consider(d - 3, { kind: 'inst', key: p.inst, text: `E — ${D.INSTANCES[p.inst].name}` });
    if (p.npc && d < 9) consider(d - 3, { kind: 'npc', npc: p.npc, text: 'E — поговорить с писцом Хеви' });
    if (p.games && d < 10) consider(d - 4, { kind: 'war', text: 'E — Дом распорядителя игр: бои армиями на Поле Марса' });
    if (p.type === 'start_camp' && d < 14) consider(d - 2, { kind: 'camp', text: 'E — лагерь колонистов: купец, задания, склад' });
    if (p.type === 'colony_site' && d < 14 && !S.blds.some((b) => b.type === 'colonia' && Math.hypot(b.x - p.x, b.z - p.z) < 12)) consider(d - 2, { kind: 'site', p, text: 'E — основать колонию' });
  }
  return best;
}
function onInteract() {
  if (S.tunaHelpUntil && performance.now() < S.tunaHelpUntil) { net({ type: 'tunaPull' }); return; }
  const f = focus; if (!f) return;
  switch (f.kind) {
    case 'wreckBoard': if(S.ship&&S.seat===0)net({type:'helm',f:0,t:0});S.wreckBoardPending=performance.now();net({type:'wreckBoard',id:f.id});break;
    case 'chest': if(!S.ship)net({type:'mv',x:S.me.x,z:S.me.z,y:S.me.y,ry:S.me.ry,run:!!S.me.run,a:0,jh:jumpH||0});net({ type: 'open', id: f.id }); break;
    case 'cratePick': net({ type: 'cratePick', id: f.id }); break;
    case 'enslave': net({ type: 'enslave', id: f.id }); break;
    case 'tame': net({ type: 'tame', id: f.id }); break;
    case 'crateLoad': net({ type: 'crateLoad', sid: f.id }); break;
    case 'trader': UI.openTrader(f.id); break;
    case 'spy': net({ type: 'spy', poi: f.poi }); break;
    case 'sciSample': net({ type: 'sciSample', id: f.id }); break;
    case 'ruin': net({ type: 'ruinStudy', id: f.id, k: f.k }); break;
    case 'dig': net({ type: 'treasureDig', id: f.id }); SND.play('build'); break;
    case 'sciCatch': net({ type: 'sciCatch', mid: f.id }); break;
    case 'plunder': net({ type: 'plunder', poi: f.poi }); break;
    case 'city': UI.openCity(f.id); break;
    case 'node': cancelRanged(); holdE = { id: f.id, t: 0 };net({type:'gatherPose',id:f.id}); break;
    case 'ship': net({ type: 'board', sid: f.id }); break;
    case 'leave': net({ type: 'leave' }); break;
    case 'bld': UI.openBuilding(f.id); break;
    case 'rostra': UI.openSpeech(f.id); break;
    case 'gate': net({ type: 'gateToggle', city: f.city }); break;
    case 'war': UI.openWar(); break;
    case 'arenaLeave': arenaLeave();break;
    case 'towerUp': { if(S.char.mounted){net({type:'mount'});S.char.mounted=false;} const T = f.t; S.tower = T; S.me.x = T.x; S.me.z = T.z; UI.addLog('🏹 Вы на башне: стреляйте из лука (ЛКМ) по наступающим. E — спуститься.', 'info'); break; }
    case 'towerDown': { const T = S.tower, Cy = S.W.cities.find((c) => c.id === T.city); S.tower = null; const a = Math.atan2(Cy.x - T.x, Cy.z - T.z); S.me.x = T.x + Math.sin(a) * (T.half + 2.2); S.me.z = T.z + Math.cos(a) * (T.half + 2.2); S._perchT = performance.now() + 1500; break; }
    case 'inst': UI.openInstance(f.key); break;
    case 'instExit': net({ type: 'instExit' }); break;
    case 'npc': net({ type: 'talk', npc: f.npc }); break;
    case 'camp': UI.openCamp(); break;
    case 'site': net({ type: 'place', bt: 'colonia', x: f.p.x, z: f.p.z, ry: 0 }); break;
  }
}
function updateHold(dt) {
  if (!holdE || !keys.KeyE) { holdE = null; UI.showHold(0); return; }
  const n = nodeById.get(holdE.id); if (!n || nodeAmt(n) <= 0 || Math.hypot(n.x - S.me.x, n.z - S.me.z) > 4) { holdE = null; UI.showHold(0); return; }
  holdE.t += dt;
  S.me.ry = Math.atan2(n.x - S.me.x, n.z - S.me.z);
  if (!myAtk || performance.now() / 1000 - myAtk.t > 0.85) { myAtk = { kind: n.tool === 'pick' ? 'tool' : n.tool === 'axe' ? 'axe' : 'fist', t: performance.now() / 1000, combo: 0, gather: true }; setTimeout(() => SND.play(n.tool === 'pick' ? 'dig' : 'chop'), 350); }
  UI.showHold(Math.min(1, holdE.t / 1.15));
  if (holdE.t >= 1.15) { holdE.t = 0; net({type:'gatherPose',id:n.id});net({ type: 'gather', id: n.id }); }
}

// ---------- Движение ----------
let sendT = 0, moveSpeed = 0;
function updateMe(dt) {
  const me = S.me, c = S.char;
  if(S.wreckBoardPending){moveSpeed=0;if(performance.now()-S.wreckBoardPending>3000)S.wreckBoardPending=null;else return;}
  if(S.seatingPending){moveSpeed=0;S.horseVelocity=0;if(performance.now()-S.seatingPending.at>5000)S.seatingPending=null;else return;}
  if (S.ship) {
    // руль
    if (S.seat === 0) { const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), t = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0); if (!S.helmT || performance.now() - S.helmT > 100) { S.helmT = performance.now(); net({ type: 'helm', f: UI.anyModal() || chatting ? 0 : f, t: UI.anyModal() || chatting ? 0 : t }); } }
    const o = ships.get(S.ship); if (o) { me.x = o.obj.position.x + (me.x - o.obj.position.x) * 0; }
    me.y = 0.9; moveSpeed = 0; me.swim = false; me.run = false; return;
  }
  if (!me.alive || !c) { moveSpeed = 0; S.spect = null; return; }
  if (S.spect) { me.x = S.spect.x; me.z = S.spect.z; me.y = S.spect.y; me.ry = S.spect.ry; moveSpeed = 0; me.swim = false; me.run = false; sendT -= dt; if (sendT <= 0) { sendT = 0.2; net({ type: 'mv', pj: 1, x: Math.round(me.x * 100) / 100, z: Math.round(me.z * 100) / 100, y: Math.round(me.y * 10) / 10, ry: Math.round(me.ry * 100) / 100, run: false, a: 0, jh: Math.round((me.y - bodyY(me.x, me.z)) * 10) / 10 }); } return; } // зритель сидит на трибуне
  const t = performance.now() / 1000;
  let f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (chatting || UI.anyModal()) { f = 0; r = 0; }
  if (RTS.on) { // вид сверху: WASD двигают камеру, персонаж стоит
    const sp = 60 * dt * (RTS.dist / 80) * 1.4;
    RTS.cx += (-Math.sin(camYaw) * -f + Math.cos(camYaw) * r) * sp; RTS.cz += (-Math.cos(camYaw) * -f - Math.sin(camYaw) * r) * sp;
    f = 0; r = 0;
  }
  const swim = !S.inst && WG.terrainHeight(me.x, me.z) < -1.1 && !onDeck(me.x, me.z) && jumpH <= 0.01;
  const dodging = t - dodgeT < CFG.dodgeTime;
  let speed = 0, dir = me.ry;
  const run = keys.ShiftLeft && me.st > 5 && !blocking;
  if (dodging) { speed = CFG.dodgeDist / CFG.dodgeTime; dir = dodgeDir; }
  else if (f || r) {
    dir = Math.atan2(-r, f) + camYaw + Math.PI;
    const base = swim ? CFG.swim * (1 + D.specOf(c, 'sail') * 0.1) : run ? CFG.run : CFG.walk;
    speed = base * (1 + (c.stats.agi || 0) * 0.01) * (1 - (c.slow || 0)) * (blocking ? 0.45 : 1);
    if(rangedHold&&!c.mounted)speed*=.65;
    if (myAtk && t - myAtk.t < 0.4 && !myAtk.gather) speed *= 0.4;
    if (c.bagW > c.bagMax) speed *= 0.6;
    if (c.carry) speed *= 0.8;
    if(c.tunaCarry)speed*=.55;
    if (c.mounted && c.horseOut && !swim) { speed = 1; }
    else if (onRoad(me.x, me.z) || WG.onRoadNet(me.x, me.z)) speed *= 1.25;
  }
  if (c.mounted && c.horseOut && !swim) { const hh = (c.horses || []).find(h => h.id === c.horseOut), motion = horseMotion(S.horseVelocity || 0, me.ry, dir, !!(f || r), run, hh?.kind, dt, (hh?.sat ?? 100) < 30); S.horseVelocity = motion.speed; speed = motion.speed; dir = motion.heading; me.ry = motion.heading; } else S.horseVelocity = 0;
  // лицом — в сторону атаки/блока, иначе — по ходу
  if (!c.mounted && (blocking || (myAtk && t - myAtk.t < 0.5 && !myAtk.gather) || UI.fishActive())) me.ry = lerpAng(me.ry, aimYaw(), Math.min(1, dt * 14));
  else if (!c.mounted && speed > 0) me.ry = lerpAng(me.ry, dir, Math.min(1, dt * 12));
  if (speed > 0) {
    let nx = me.x + Math.sin(dir) * speed * dt, nz = me.z + Math.cos(dir) * speed * dt;
    if (S.inst) {
      if (!instWalk(nx, nz)) { if (instWalk(nx, me.z)) nz = me.z; else if (instWalk(me.x, nz)) nx = me.x; else { nx = me.x; nz = me.z; } }
    } else {
      // крутые склоны гор не пускают
      const h0=bodyY(me.x,me.z),h1=bodyY(nx,nz),platform=onDeck(me.x,me.z)||onDeck(nx,nz);
      if(h1-h0>(platform?1.5:speed*dt*1.6)&&h1>2) { nx = me.x; nz = me.z; }
      if (S.tower) { const T = S.tower, c2 = Math.cos(T.a), s2 = Math.sin(T.a); let lx = (nx - T.x) * c2 - (nz - T.z) * s2, lz = (nx - T.x) * s2 + (nz - T.z) * c2; lx = Math.max(-T.half + 0.4, Math.min(T.half - 0.4, lx)); lz = Math.max(-T.half + 0.4, Math.min(T.half - 0.4, lz)); nx = T.x + lx * c2 + lz * s2; nz = T.z - lx * s2 + lz * c2; } // на башне — в пределах площадки
      else { const cc = collide(nx, nz); nx = cc.x; nz = cc.z; }
      // арена во время боя: на песок — только бойцы, бойцы — не уходят до конца боя
      { const A = S.st && S.st.ar; if (A && A.st !== 'prep') { const ab = S.blds.find((b) => b.type === 'amphitheatrum' && b.built && Math.abs(b.x - A.x) < 2 && Math.abs(b.z - A.z) < 2); if (ab) { const fl = (x, z) => { const cs = Math.cos(ab.ry || 0), sn = Math.sin(ab.ry || 0), lx = (x - ab.x) * cs - (z - ab.z) * sn, lz = (x - ab.x) * sn + (z - ab.z) * cs; return (lx / 34.425) ** 2 + (lz / 23.625) ** 2 < 1; };
        const mine = (A.f || []).includes(S.myId), was = fl(me.x, me.z), will = fl(nx, nz);
        if (!mine && !was && will) { nx = me.x; nz = me.z; if (!S._arWarn || t - S._arWarn > 4) { S._arWarn = t; UI.addLog('Идёт бой: на песок выходят только бойцы. Смотрите с трибуны (E у арены → «Сесть на трибуну»).', 'warn'); } }
        else if (mine && was && !will) { nx = me.x; nz = me.z; if (!S._arWarn || t - S._arWarn > 4) { S._arWarn = t; UI.addLog('Бойцы покидают арену только после окончания боя.', 'warn'); } } } } }
      // на ростры поднимаются только должностные лица
      if (!c.office && WG.rostraAt(nx, nz, S.blds) && !WG.rostraAt(me.x, me.z, S.blds)) { nx = me.x; nz = me.z; if (!S._rostraWarn || t - S._rostraWarn > 4) { S._rostraWarn = t; UI.addLog('Ростры — только для должностных лиц города (префект, эдил, сенатор и др.).', 'warn'); } }
      nx = Math.max(-CFG.world + 6, Math.min(CFG.world - 6, nx)); nz = Math.max(-CFG.world + 6, Math.min(CFG.world - 6, nz));
    }
    moveSpeed = Math.hypot(nx - me.x, nz - me.z) / dt;
    me.x = nx; me.z = nz;
  } else moveSpeed = 0;
  if (jumpH > 0) { jumpV -= 19 * dt; jumpH += jumpV * dt; if (jumpH <= 0) { jumpH = 0; jumpV = 0; } }
  me.y = (S.tower ? S.tower.y : bodyY(me.x, me.z)) + jumpH;
  me.swim = swim; me.run = run && speed > 0;
  if (queuedAtk && myAtk) { const w = c.gear.weapon && GEAR[c.gear.weapon.k]; const dur = (ATK_DUR[w ? w.kind : 'fist'] || 0.6) / (1 + (c.stats.agi || 0) * 0.02); if (t - myAtk.t > dur * 0.75) { queuedAtk = false; doAttack(t); } }
  if (mouseL && !queuedAtk && myAtk && !UI.anyModal() && !S.placing) { const w = c.gear.weapon && GEAR[c.gear.weapon.k]; if (!w || !['rod','bow'].includes(w.kind)) { const dur = (ATK_DUR[w ? w.kind : 'fist'] || 0.6) / (1 + (c.stats.agi || 0) * 0.02); if (t - myAtk.t > dur) doAttack(t); } }
  sendT -= dt;
  if (sendT <= 0) { sendT = 0.066; net({ type: 'mv', pj: S.tower || S._perchT > performance.now() ? 1 : 0, x: Math.round(me.x * 100) / 100, z: Math.round(me.z * 100) / 100, y: Math.round(me.y * 10) / 10, ry: Math.round(me.ry * 100) / 100, run: me.run, a: speed > 0 ? 1 : 0, jh: Math.round((S.spect || S.tower ? me.y - bodyY(me.x, me.z) : jumpH) * 10) / 10 }); }
}
// подписи: на экране примерно одного размера, дальние скрываем
function fitLabel(lbl, bar, pos, maxD) {
  if (!lbl || !lbl.userData.base) return;
  const d = camera.position.distanceTo(pos);
  const k = Math.max(0.3, Math.min(1.4, d / 16));
  lbl.scale.copy(lbl.userData.base).multiplyScalar(k);
  if (d > maxD) lbl.visible = false;
  if (bar) { bar.scale.setScalar(Math.max(0.5, Math.min(1.4, d / 14))); if (d > maxD) bar.visible = false; }
}
const lerpAng = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };

// ---------- Кони: под седлом или идут следом ----------
const horses = new Map(); // ключ (игрок) -> {obj, kind, x, z, ry, sp, top}
function makeScorpio() { // станковый стреломёт на колёсах
  const g = new THREE.Group(), wd = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 }), ir = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.5, metalness: 0.6 });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(1.4, 0.2, 2.2), wd, 0, 0.6, 0);
  for (const sx of [-1, 1]) for (const sz of [-0.7, 0.7]) add(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 14), wd, sx * 0.78, 0.45, sz, 0, 0, Math.PI / 2);
  add(new THREE.BoxGeometry(0.25, 0.9, 0.25), wd, 0, 1.1, -0.2);
  add(new THREE.BoxGeometry(0.22, 0.18, 2.4), wd, 0, 1.6, 0.1, -0.12);
  add(new THREE.BoxGeometry(1.6, 0.16, 0.16), wd, 0, 1.68, 0.8);
  for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), ir, sx * 0.6, 1.68, 0.8);
  add(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), ir, 0, 1.78, 0.4, Math.PI / 2 - 0.12);
  return g;
}
function horseObj(key, kind) {
  let h = horses.get(key);
  if (h && h.kind === kind) return h;
  if (h) scene.remove(h.obj);
  const obj = MD.makeAnimal('horse'); obj.userData.horse = true; obj.userData.riderKey = key; obj.scale.setScalar(1.15);
  const col = D.HORSES[kind] ? D.HORSES[kind].col : 0x7a4a28;
  if (col !== 0x7a4a28) obj.traverse((m) => { if (m.isMesh && m.material && m.material.color && m.material.color.getHex() === 0x7a4a28) { m.material = m.material.clone(); m.material.color.setHex(col); } });
  const back = 1.49; // высота спины модели коня (без масштаба)
  const saddleM = new THREE.MeshStandardMaterial({ color: 0x5a2a16, roughness: 0.75 }), clothM = new THREE.MeshStandardMaterial({ color: 0x8e1a14, roughness: 0.9 });
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.5), saddleM); saddle.position.set(0, back + 0.02, -0.05); obj.add(saddle);
  const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.06), saddleM); pommel.position.set(0, back + 0.08, 0.2); obj.add(pommel);
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.56), clothM); c.position.set(sx * 0.33, back - 0.16, -0.05); c.rotation.z = sx * 0.18; obj.add(c); }
  const top = (back + 0.06) * 1.15;
  R.optimizeStatic(obj);
  scene.add(obj);
  h = { obj, kind, x: null, z: null, ry: 0, sp: 0, top };
  horses.set(key, h); return h;
}
// возвращает высоту седла или null; смещает всадника/коня
function updateHorse(key, kind, mounted, px, pz, ry, speed, visible, dt, t, jh = 0) {
  if (!kind || !visible) { const h = horses.get(key); if (h) { h.obj.visible = false; h.x = null; } return null; }
  const h = horseObj(key, kind); h.obj.visible = true;
  if (h.x == null) { h.x = px - Math.sin(ry) * 2.5; h.z = pz - Math.cos(ry) * 2.5; h.ry = ry; }
  let sp = 0;
  if (mounted) { sp = Math.hypot(px - h.x, pz - h.z) / Math.max(dt, 1e-3); h.x = px; h.z = pz; h.ry = lerpAng(h.ry, ry, Math.min(1, dt * 10)); }
  else { // идёт следом и останавливается в паре шагов
    const dx = px - h.x, dz = pz - h.z, d = Math.hypot(dx, dz);
    if (d > 60) { h.x = px - dx / d * 3; h.z = pz - dz / d * 3; }
    else if (d > 3.2) { const v = Math.min(d > 12 ? 13 : 5, (d - 2.8) * 3); h.x += dx / d * v * dt; h.z += dz / d * v * dt; sp = v; h.ry = lerpAng(h.ry, Math.atan2(dx, dz), Math.min(1, dt * 5)); }
  }
  h.sp += (sp - h.sp) * Math.min(1, dt * 6);
  const y = bodyY(h.x, h.z) + (mounted ? jh : 0);
  h.obj.position.set(h.x, y, h.z); h.obj.rotation.y = h.ry;
  try { MD.animateAnimal(h.obj, dt, { t, speed: h.sp }); } catch {}
  return mounted ? y + h.top - 0.92 : null;
}
const onRoad = (x, z) => { for (const b of S.blds) { const d = BUILDINGS[b.type]; if (!d.road) continue; const dx = x - b.x, dz = z - b.z; if (Math.abs(dx) > 9 || Math.abs(dz) > 9) continue; const c = Math.cos(b.ry), s = Math.sin(b.ry); const lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) < d.wid / 2 + 0.2 && Math.abs(lz) < d.len / 2 + 0.1) return true; } return false; };
const myHorseKind = () => { const c = S.char; if (!c || !c.horseOut) return null; const h = (c.horses || []).find((x) => x.id === c.horseOut); return h ? h.kind : null; };

// ---------- Кадр ----------
let me3 = null, meLook = '';
let lastT = performance.now();
const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
let rain = null;
function ensureMe() {
  const c = S.char; if (!c) return;
  const look = {}; for (const s of ['weapon', 'offhand', 'head', 'body', 'legs']) look[s] = c.gear[s] ? [c.gear[s].k, c.gear[s].q] : null;
  if(holdE&&keys.KeyE){const n=nodeById.get(holdE.id);if(n?.tool){look.weapon=[n.tool==='pick'?'pick':'axe',0];look.offhand=null;}}
  if(rangedHold?.kind==='pilum'||myAtk?.kind==='throw'&&performance.now()/1000-myAtk.t<.9){look.weapon=['pilum',0];look.offhand=null;}
  if (c.torch) look.torch = 1;
  if(c.tunaCarry)look.tuna=c.tunaCarry.kg;
  if (c.carry) look.carry = D.CRATES[c.carry] ? D.CRATES[c.carry].grade : 1;
  const key = lookKey(look) + c.color;
  if (me3 && key === meLook) return;
  if (me3) scene.remove(me3);
  me3 = makeHumanFor(c.id, look, c.color); applyLook(me3, look); R.optimizeStatic(me3);
  scene.add(me3); meLook = key;
}
const unitRenderer=new UnitRenderer(scene,o=>{const h=makeHumanFor(o.type,null,null,o.def.faction);const g=o.def.gear||{};MD.setGear(h,{weapon:g.w||null,offhand:g.off||null,head:g.head||null,body:g.body||null,legs:null,q:0});R.optimizeStatic(h);return h;},MD.animateHuman);
let focusNext=0,tagsNext=0;
function animHuman(obj, dt, t, s) { try { MD.animateHuman(obj, dt, s); } catch (e) { if (!animHuman.warned) { animHuman.warned = true; console.warn(e); } } }
function loop() {
  requestAnimationFrame(loop);
  const nowMs = performance.now(), dt = Math.min(0.05, (nowMs - lastT) / 1000), t = nowMs / 1000; lastT = nowMs;
  R.autoGfx((lv) => UI.addLog(`Графика снижена до «${R.GFX.names[lv]}» для плавности (P — выбрать вручную)`, 'info'));
  ensureMe();
  updateMe(dt);
  updateHold(dt);
  updateRanged();
  if(nowMs>=focusNext){focus=findFocus();focusNext=nowMs+80;}
  UI.setPrompt(focus && !UI.anyModal() ? focus.text : '');
  const me = S.me;
  // я
  if (me3) {
    const ship = S.ship ? ships.get(S.ship) : null;
    const hk = myHorseKind(), riding = !!(hk && S.char.mounted && !ship && !S.inst);
    const seatY = updateHorse('me', hk, riding, me.x, me.z, me.ry, moveSpeed, !!hk && !ship && !S.inst && me.alive, dt, t, jumpH);
    me3.position.set(me.x, ship ? 0.9 + Math.sin(t * 1.3) * 0.05 : seatY != null ? seatY : me.y, me.z); me3.rotation.y = me.ry;
    const w = S.char && S.char.gear.weapon ? GEAR[S.char.gear.weapon.k] : null;
    const ak = myAtk && t - myAtk.t < (ATK_DUR[myAtk.kind] || 0.6) ? { kind: myAtk.kind === 'tool' ? 'tool' : myAtk.kind, p: (t - myAtk.t) / (ATK_DUR[myAtk.kind] || 0.6), combo: myAtk.combo } : null;
    const dodge = t - dodgeT < CFG.dodgeTime ? (t - dodgeT) / CFG.dodgeTime : -1;
    animHuman(me3, dt, t, { t, speed: seatY != null ? 0 : moveSpeed, running: me.run && seatY == null, swim: me.swim && !ship, dodge, attack: rangedHold?{kind:rangedHold.kind==='bow'?'bow':'throw',p:rangedHold.kind==='bow'?Math.min(.54,(t-rangedHold.t)*.54):.35,combo:0}:ak, block: blocking, dead: me.alive ? 0 : Math.min(1, (t - (S.deadAt || t)) / 1), sit: (!!ship && ship.type === 'scapha') || !!S.spect, ride: seatY != null, lanceSpeed:moveSpeed, row: false, fishing: !!fishing, hit: Math.max(0, 1 - (t - myHitT) * 4), carry: !!me3.userData._carry });
    if (!me.alive && !S.deadAt) S.deadAt = t; if (me.alive) S.deadAt = 0;
  }
  // другие игроки
  for (const o of players.values()) {
    const k = Math.min(1, dt * 10);
    const px = o.x, pz = o.z;
    o.x += (o.tx - o.x) * k; o.z += (o.tz - o.z) * k; o.ry = lerpAng(o.ry, o.tr, k);
    const sp = Math.hypot(o.x - px, o.z - pz) / Math.max(dt, 1e-3); o.sp += (sp - o.sp) * Math.min(1, dt * 8);
    o.obj.visible=(o.inst||0)===(S.inst?.id||0)&&Math.hypot(o.x-camera.position.x,o.z-camera.position.z)<Math.max(180,RTS.on?RTS.dist*1.8:180);
    if(!o.obj.visible){updateHorse('p'+o.id,null);continue;}
    const onShip = o.ship ? ships.get(o.ship) : null;
    const fl = o.fl || 0;
    const inf = S.roster.get(o.id);
    o.jh = (o.jh || 0) + ((o.tjh || 0) - (o.jh || 0)) * Math.min(1, dt * 14);
    const oSeat = updateHorse('p' + o.id, inf && inf.horse, !!(inf && inf.mounted), o.x, o.z, o.ry, o.sp, !!(inf && inf.horse) && !onShip && !o.inst && o.obj.visible && !!(fl & 1), dt, t, o.jh);
    const oT = !onShip && !o.inst ? towerAt(o.x, o.z) : null; o.obj.position.set(o.x, onShip ? 0.9 : o.inst ? (S.inst ? S.inst.y0 : 60) : oSeat != null ? oSeat : oT ? oT.y : bodyY(o.x, o.z) + o.jh, o.z); o.obj.rotation.y = o.ry;
    const at = o.at ? { kind: o.at[0], p: Math.min(1, o.at[3]?o.at[1]:o.at[1] / (ATK_DUR[o.at[0]] || 0.6) + 0.05), combo: o.at[2] } : null;
    animHuman(o.obj, dt, t, { t, speed: onShip || oSeat != null ? 0 : o.sp, ride: oSeat != null, lanceSpeed:o.sp, running: !!(fl & 2), swim: !!(fl & 8) && !onShip, dodge: fl & 16 ? ((t * 2.2) % 1) : -1, attack: at && at.p < 1 ? at : null, block: !!(fl & 4), dead: fl & 1 ? 0 : 1, sit: (!!onShip && onShip.type === 'scapha') || (!onShip && (o.jh || 0) > 2.5 && !oT && (fl & 1) && o.sp < 0.3), fishing: !!(fl & 32), hit: o.hitT ? Math.max(0, 1 - (t - o.hitT) * 4) : 0, carry: !!o.obj.userData._carry });
    setHp(o.bar, (o.hpp || 0) / 100); o.bar.visible = o.hpp < 100;
    o.bar.quaternion.copy(camera.quaternion);
    if (o.lbl) o.lbl.visible = true; fitLabel(o.lbl, o.bar, o.obj.position, 90);
  }
  // существа
  unitRenderer.begin();
  for (const o of mobs.values()) {
    const pose=sampleMotion(o.history||[],t+(S.motionClock||0));
    if(pose){o.x=pose.x;o.z=pose.z;o.ry=pose.ry;o.sp+=(pose.speed-o.sp)*Math.min(1,dt*8);}
    { const th = WG.terrainHeight(o.x, o.z), dk = !S.inst ? WG.deckHeight(o.x, o.z, S.blds) : null; o.obj.position.set(o.x, S.inst ? S.inst.y0 : dk != null ? dk : Math.max(-0.7, th), o.z); } o.obj.rotation.y = o.ry;
    const dead = o.st === 3 ? Math.min(1, (t - o.deadT) / 1) : 0;
    const wind = o.st === 2 ? Math.min(1, o.wind + (t - S.timeAt) * 1.5) : null;
    const distance=Math.hypot(o.x-camera.position.x,o.z-camera.position.z);
    const visible=distance<Math.max(180,RTS.on?RTS.dist*1.8:180);
    o.obj.visible=visible;
    if(!visible){if(o.def.mounted)updateHorse('m'+o.id,null);continue;}
    if (o.def.human) {
      const kind = wKind(o.def.gear && o.def.gear.w);
      const atk = o.st === 2 ? { kind: o.def.ranged ? (o.def.gear.w === 'bow' ? 'bow' : 'throw') : kind, p: wind * 0.55, combo: o.id % 3 } : (o.lastWind && t - o.lastWind < 0.4 ? { kind: o.def.ranged ? (o.def.gear.w === 'bow' ? 'bow' : 'throw') : kind, p: 0.55 + (t - o.lastWind) / 0.4 * 0.45, combo: 0 } : null);
      if (o.st === 2) o.lastWind = t;
      const seat = o.def.mounted ? updateHorse('m' + o.id, 'gnedoy', o.st !== 3, o.x, o.z, o.ry, o.sp, o.obj.visible, dt, t) : null;
      if (seat != null) o.obj.position.y = seat;
      const state={t,speed:o.st===6||seat!=null?0:o.sp,ride:seat!=null,lanceSpeed:o.sp,running:o.sp>5,attack:o.st===6?null:atk,dead,kneel:o.st===6,hit:o.hitT?Math.max(0,1-(t-o.hitT)*4):0};
      const batched=(o.sq>0||o.gid)&&!dead&&o.st!==6&&distance>32&&mobs.size>=12&&!o.def.boss;
      o.obj.userData.body.visible=!batched;
      if(batched)unitRenderer.add(o,state);else animHuman(o.obj,dt,t,state);
    } else {
      if (o.def.critter) { try { o.obj.userData.anim && o.obj.userData.anim(dt, t, o.sp > 0.3); } catch {} if (dead) o.obj.rotation.z = dead * 1.5; }
      else try { MD.animateAnimal(o.obj, dt, { t, speed: o.sp, attack: o.st === 2 ? wind : null, dead, drink: o.st === 5 }); } catch {}
    }
    setHp(o.bar, (o.hpp || 0) / 100); o.bar.visible = o.hpp < 100 && o.st !== 3; o.bar.quaternion.copy(camera.quaternion);
    o.lbl.visible = o.st !== 3 && !(o.sq > 0) && !o.gid; fitLabel(o.lbl, o.bar, o.obj.position, o.def.boss ? 90 : 55);
    if (o.st === 3 && t - o.deadT > 4) o.obj.position.y -= Math.min(1, (t - o.deadT - 4)) * 0.8;
    // свои отряды: кольцо под выбранным отрядом
    if (o.sq > 0 || o.sq === 'guard') { if (!o.selRing) { o.selRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 20), new THREE.MeshBasicMaterial({ color: 0x7fdf7f, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); o.selRing.rotation.x = -Math.PI / 2; o.selRing.position.y = 0.08; o.obj.add(o.selRing); } o.selRing.material.color.setHex((S.selectedSquads || [S.selSquad]).includes(o.sq) ? 0xffd24a : 0x7fdf7f); o.selRing.scale.setScalar(RTS.on ? 2.2 : 1); }
  }
  unitRenderer.end(dt,t);
  // корабли
  for (const map of [ships, eships]) for (const o of map.values()) {
    // плавное движение: корабль идёт сам по скорости и курсу, а к серверной точке подтягивается мягко (без рывков камеры)
    const ex = Math.min(0.3, (performance.now() - lastStateAt) / 1000);
    o.ry = lerpAng(o.ry, o.tr, Math.min(1, dt * 4));
    o.x += Math.sin(o.ry) * o.speed * dt; o.z += Math.cos(o.ry) * o.speed * dt;
    const px = o.tx + Math.sin(o.tr) * o.speed * ex, pz = o.tz + Math.cos(o.tr) * o.speed * ex;
    const ed = Math.hypot(px - o.x, pz - o.z);
    if (ed > 12) { o.x = px; o.z = pz; } else { const kk = Math.min(1, dt * 2.5); o.x += (px - o.x) * kk; o.z += (pz - o.z) * kk; }
    o.obj.position.set(o.x, 0, o.z); o.obj.rotation.y = o.ry;
    o.obj.visible=!S.inst&&(o.id===S.ship||Math.hypot(o.x-camera.position.x,o.z-camera.position.z)<1400);
    if(o.obj.visible)try { MD.animateShip(o.obj, t, Math.abs(o.speed)); } catch {}
    if (o.catT && o.obj.userData.catapultArm) { const k = Math.min(1, (t - o.catT) / 3.5); const u = o.obj.userData; u.catapultArm.rotation.x = (u.catapultFired ?? 0.17) + ((u.catapultRest ?? -1.35) - (u.catapultFired ?? 0.17)) * k; if (k >= 1) o.catT = 0; }
    setHp(o.bar, (o.hpp ?? 100) / 100); o.bar.visible = (o.hpp ?? 100) < 100; o.bar.quaternion.copy(camera.quaternion);
  }
  // экипаж стоит на палубе: место берётся из модели корабля (качается вместе с ним), рулевой — у руля на корме
  placeCrew(dt, t);
  // снаряды
  for (const o of projs.values()) {
    const e = t - o.t;
    const x = o.x + o.vx * e, y = o.y + o.vy * e - 0.5 * 9 * e * e, z = o.z + o.vz * e;
    o.obj.position.set(x, y, z);
    o.obj.rotation.set(0, 0, 0); o.obj.lookAt(x + o.vx, y + o.vy - 9 * e, z + o.vz);
  }
  for (const o of drops.values()) { o.obj.rotation.y += dt * 0.6; }
  for (const o of schools.values()) { o.obj.position.x += (o.tx - o.obj.position.x) * Math.min(1, dt * 2); o.obj.position.z += (o.tz - o.obj.position.z) * Math.min(1, dt * 2); try { MD.animateFishSchool(o.obj, t); } catch {} }
  for (const o of crateObjs.values()) if (!o.ground) { o.obj.position.y = Math.sin(t * 1.3 + o.x) * 0.08; o.obj.rotation.z = Math.sin(t * 0.9 + o.z) * 0.08; }
  // сундуки: крышки
  for (const c of chestObjs.values()) {
    if (Math.abs(c.o.position.x - me.x) > 60 || Math.abs(c.o.position.z - me.z) > 60) continue;
    const open = (S.chests[c.c.id] || 0) > Date.now() / 1000 + (S.clockOff || 0) ? 1 : 0;
    if (c.c.kind === 'crate') { // разломанный ящик исчезает и потом появляется на новом месте
      c.o.visible = !open;
      if (!open && c.moveTo) { c.o.position.set(c.moveTo.x, lowest(c.moveTo.x, c.moveTo.z, 0.6), c.moveTo.z); c.moveTo = null; }
      continue;
    }
    c.open += (open - c.open) * Math.min(1, dt * 4);
    if (c.o.userData.lid) c.o.userData.lid.rotation.x = -1.2 * c.open;
  }
  // частицы
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t += dt; p.vy -= p.g * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.m.material.opacity = Math.max(0, 1 - p.t / p.life); if (p.t > p.life) { scene.remove(p.m); parts.splice(i, 1); } }
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const k = r.t / r.life; r.m.scale.setScalar(1 + k * r.r1 * 3); r.m.material.opacity = 0.9 * (1 - k); if (k >= 1) { scene.remove(r.m); rings.splice(i, 1); } }
  // удочка: поплавок
  updateBobber(t); animSmoke(t);
  updateLife(dt, t);
  if(nowMs>=tagsNext){updateSquadTags();tagsNext=nowMs+100;}
  updateCull(dt);
  updateEnvironment(dt, t);
  updateCamera(dt, t);
  updateTactical(); updateLandOverlay(); updateDestination();
  R.updateTerrainLod(camera.position.x, camera.position.z);
  R.updateLights(me.x, me.z, envNight > 0.5 || !!S.inst);
  UI.frame(dt, t, { players, mobs, ships, eships, schools });
  R.renderFrame();
  SND.ambient({ t, nearWater: S.inst ? 0 : Math.max(0, 1 - Math.max(0, WG.terrainHeight(me.x, me.z)) / 4), beast: null });
}
let bobber = null, line = null;
function updateBobber(t) {
  if (fishing) { // ушёл от лунки или убрал удочку — сматываем леску
    const w = S.char && S.char.gear.weapon && GEAR[S.char.gear.weapon.k];
    if (!S.me.alive || !w || w.kind !== 'rod' || Math.hypot(S.me.x - fishing.x, S.me.z - fishing.z) > CFG.fishCastR + 3 || (fishing.px != null && Math.hypot(S.me.x - fishing.px, S.me.z - fishing.pz) > 1.6)) { if (UI.fishActive() || fishing.bite) UI.addLog('Вы отошли — рыбалка прервана.', 'warn'); fishing = null; net({ type: 'uncast' }); if (UI.fishActive()) UI.fishEnd({}); }
  }
  const wo = me3 && me3.userData.gear && me3.userData.gear.weapon, hang = wo && wo.userData.line;
  if (hang) hang.visible = !fishing; // пока заброшено — висящей лески нет
  if (!fishing) { if (bobber) { scene.remove(bobber); scene.remove(line); bobber = null; line = null; } return; }
  if (!bobber) {
    bobber = new THREE.Group(); MD.mesh(new THREE.SphereGeometry(0.09, 10, 8), MD.M(0xd83a2a), 0, 0.05, 0, bobber); MD.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), MD.M(0xf0f0f0), 0, 0.15, 0, bobber);
    scene.add(bobber);
    line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.6 }));
    scene.add(line);
  }
  const bob = fishing.bite ? Math.sin(t * 22) * 0.08 - 0.05 : Math.sin(t * 2.5) * 0.03;
  bobber.position.set(fishing.x, bob, fishing.z);
  const tip = new THREE.Vector3(); if (hang) hang.getWorldPosition(tip); else if (me3 && me3.userData.handR) { me3.userData.handR.getWorldPosition(tip); tip.y += 1.6; } else tip.set(S.me.x, S.me.y + 2.5, S.me.z); // леска — с кончика удочки
  line.geometry.setFromPoints([tip, bobber.position]);
}
// ---------- Время суток и погода ----------
let envNight = 0, envT = 0;
const _sdir = new THREE.Vector3(), _sx = new THREE.Vector3(), _sy = new THREE.Vector3(), _sc = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const cDay = { top: new THREE.Color(0x3d8fd6), bot: new THREE.Color(0xdbe9f0), fog: new THREE.Color(0xcfe0ea) };
const cDusk = { top: new THREE.Color(0x30406a), bot: new THREE.Color(0xf0a070), fog: new THREE.Color(0xd8a888) };
const cNight = { top: new THREE.Color(0x050a18), bot: new THREE.Color(0x14203a), fog: new THREE.Color(0x0e1626) };
const cStorm = { top: new THREE.Color(0x4a5560), bot: new THREE.Color(0x8a959e), fog: new THREE.Color(0x7a858e) };
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
function updateEnvironment(dt, t) {
  R.waterTime.value = t; R.windT.value = t; R.skyUni.uT.value = t;
  if (S.inst) { R.sun.intensity = 0.15; R.hemi.intensity = 0.32; R.hemi.color.set(0xffd8a8); R.grade.uniforms.uVig.value = 0.45; return; }
  const gt = S.serverT + (performance.now() / 1000 - S.timeAt);
  const frac = D.dayFrac(gt); // 0.25 — утро, ночь короче дня
  const dayF = frac; // 0..1: 0 — полночь
  const sunA = (dayF - 0.25) * Math.PI * 2; // восход в 0.25
  const elev = Math.sin(sunA);
  const night = 1 - THREE.MathUtils.smoothstep(elev, -0.18, 0.12);
  const dusk = Math.max(0, 1 - Math.abs(elev - 0.05) / 0.25) * (1 - night * 0.5);
  envNight = night; MD.setTorchNight(night);
  const storm = S.world && S.world.events && S.world.events.some((e) => e.kind === 'storm');
  envT += ((storm ? 1 : 0) - envT) * Math.min(1, dt * 0.5);
  const sd = new THREE.Vector3(Math.cos(sunA) * 0.8, Math.max(0.05, elev), 0.45).normalize();
  R.skyUni.sunDir.value.copy(sd);
  R.skyUni.moonDir.value.set(-sd.x, Math.max(0.2, -elev), -sd.z).normalize();
  R.skyUni.stars.value = night;
  R.skyUni.cloud.value = 0.35 + envT * 0.6;
  tmpC.copy(cDay.top).lerp(cDusk.top, dusk).lerp(cNight.top, night).lerp(cStorm.top, envT * (1 - night * 0.7));
  R.skyUni.top.value.copy(tmpC);
  tmpC.copy(cDay.bot).lerp(cDusk.bot, dusk).lerp(cNight.bot, night).lerp(cStorm.bot, envT * (1 - night * 0.7));
  R.skyUni.bottom.value.copy(tmpC);
  tmpC2.copy(cDay.fog).lerp(cDusk.fog, dusk).lerp(cNight.fog, night).lerp(cStorm.fog, envT * (1 - night * 0.7));
  scene.fog.color.copy(tmpC2);
  scene.fog.near = 200 - envT * 150; scene.fog.far = 1500 - envT * 1100;
  R.sun.intensity = (2.6 * (1 - night) + 0.35 * night) * (1 - envT * 0.6);
  R.sun.color.set(night > 0.5 ? 0xa8b8e8 : dusk > 0.3 ? 0xffc890 : 0xfff0d0);
  const inTown = S.me && WG.cityAt(S.me.x, S.me.z, 60) ? 1 : 0; // ночью в городе светлее: факелы и окна
  R.hemi.intensity = 0.55 * (1 - night) + (0.18 + 0.14 * inTown) * night;
  if (R.water) { R.water.material.envMapIntensity = 0.6 * (1 - night * 0.6); R.water.material.roughness = 0.38 + night * 0.17; } // без слепящих бликов солнца и луны
  R.hemi.color.set(night > 0.5 ? (inTown ? 0xb09a88 : 0x8090c0) : 0xdfeeff);
  const sp = night > 0.5 ? R.skyUni.moonDir.value : sd;
  // центр тени привязан к сетке текселей теневой карты — иначе края теней «плывут» при движении
  _sdir.set(sp.x, sp.y, sp.z).normalize(); _sx.crossVectors(_up, _sdir).normalize(); _sy.crossVectors(_sdir, _sx);
  const sc = R.sun.shadow.camera, tx = (sc.right - sc.left) / R.sun.shadow.mapSize.x;
  _sc.set(S.me.x, S.me.y, S.me.z);
  const su = Math.round(_sc.dot(_sx) / tx) * tx, sv = Math.round(_sc.dot(_sy) / tx) * tx, sw = _sc.dot(_sdir);
  _sc.copy(_sx).multiplyScalar(su).addScaledVector(_sy, sv).addScaledVector(_sdir, sw);
  R.sun.target.position.copy(_sc); R.sun.position.copy(_sc).addScaledVector(_sdir, 160);
  R.windK.value = 1 + envT * 2.5;
  R.grade.uniforms.uWarm.value = 0.5 * (1 - night) * (1 - envT); R.grade.uniforms.uVig.value = 0.7;
  if (Math.floor(t * 0.25) !== Math.floor((t - dt) * 0.25)) R.updateEnv();
  // дождь
  if (envT > 0.05) {
    if (!rain) {
      const N = 2500, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 80; pos[i * 3 + 1] = Math.random() * 40; pos[i * 3 + 2] = (Math.random() - 0.5) * 80; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      rain = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaabbcc, size: 0.08, transparent: true, opacity: 0.5, depthWrite: false })); scene.add(rain);
    }
    rain.material.opacity = 0.55 * envT; rain.visible = true;
    const p = rain.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * 22; if (y < 0) y += 40; p.setY(i, y); }
    p.needsUpdate = true; rain.position.set(S.me.x, S.me.y - 5, S.me.z);
  } else if (rain) rain.visible = false;
}
// ---------- Отряды: выбор 1–4, приказы, вид сверху (Z) ----------
// над каждым своим отрядом на карте — подпись (имя, численность) и полоска здоровья
const sqTags = new Map();
function updateSquadTags() {
  const l = (S.char && S.char.army && S.char.army.squads) || [], seen = new Set();
  for (const q of l) {
    let x = 0, z = 0, n = 0, hp = 0; for (const o of mobs.values()) if (o.sq === q.id && o.st !== 3) { x += o.obj.position.x; z += o.obj.position.z; hp += o.hpp || 0; n++; }
    if (!n) continue; seen.add(q.id); x /= n; z /= n;
    let tg = sqTags.get(q.id); const txt = `${(D.SQUADS[q.type] || {}).icon || '⚔'} ${q.name} · ${n}/${q.size}`;
    if (!tg || tg.txt !== txt || tg.sel !== (S.selSquad === q.id)) { if (tg) scene.remove(tg.g); const g = new THREE.Group(), lb = MD.makeLabel(txt, S.selSquad === q.id ? '#ffd24a' : '#9fe39a'); lb.scale.multiplyScalar(0.85); g.add(lb); const bar = hpBar(3.2); bar.position.y = -0.55; g.add(bar); scene.add(g); tg = { g, bar, txt, sel: S.selSquad === q.id }; sqTags.set(q.id, tg); }
    const up = RTS.on ? 9 : 4.2; tg.g.position.set(x, groundAt(x, z) + up, z); setHp(tg.bar, Math.max(0, Math.min(1, hp / 100 / (q.size || n)))); tg.bar.quaternion.copy(camera.quaternion); tg.g.visible = !S.inst;
  }
  // чужие и вражеские отряды (Поле Марса, штурм, отряды других игроков): название, численность и полоска здоровья
  const grp = new Map();
  for (const o of mobs.values()) { if (!o.gid || o.st === 3 || o.sq > 0) continue; let g = grp.get(o.gid); if (!g) grp.set(o.gid, (g = { x: 0, z: 0, n: 0, hp: 0, name: o.gname, foe: o.foe })); g.x += o.obj.position.x; g.z += o.obj.position.z; g.n++; g.hp += o.hpp || 0; }
  for (const [gid, g] of grp) {
    const key = 'g:' + gid; seen.add(key); const x = g.x / g.n, z = g.z / g.n, txt = `${g.name || 'Отряд'} · ${g.n}`;
    let tg = sqTags.get(key); g.max = Math.max(g.n, (tg && tg.max) || 0);
    if (!tg || tg.txt !== txt) { if (tg) scene.remove(tg.g); const G2 = new THREE.Group(), lb = MD.makeLabel(txt, g.foe ? '#ff9a7a' : '#bfe6ff'); lb.scale.multiplyScalar(0.85); G2.add(lb); const bar = hpBar(3.2); bar.position.y = -0.55; G2.add(bar); scene.add(G2); tg = { g: G2, bar, txt, max: g.max }; sqTags.set(key, tg); }
    tg.max = g.max; tg.g.position.set(x, groundAt(x, z) + (RTS.on ? 9 : 4.2), z); setHp(tg.bar, Math.max(0, Math.min(1, g.hp / 100 / tg.max))); tg.bar.quaternion.copy(camera.quaternion); tg.g.visible = !S.inst;
  }
  for (const [id, tg] of sqTags) if (!seen.has(id)) { scene.remove(tg.g); sqTags.delete(id); }
  // знамёна Поля Марса: синее — держит Запад, красное — Восток
  if (warFlags.size && S.world && S.world.war) for (const [zid, f] of warFlags) { const L = S.world.war.lobbies.find((q) => q.state === 'fight' && (q.zone || 0) === zid); const col = !L || !L.cap || L.cap.A === L.cap.B ? 0xc9a227 : L.cap.A > L.cap.B ? 0x3a6ad0 : 0xc0392b; if (f.col !== col) { f.col = col; f.flag.material.color.setHex(col); f.ring.material.color.setHex(col === 0xc9a227 ? 0xffd24a : col); } }
}
export const RTS = { on: false, cx: 0, cz: 0, dist: 85, pitch: .78, drag: null, hover: null, preview: null, previewUntil: 0 };
const selected = () => barSquads().filter(q => (S.selectedSquads || [S.selSquad]).includes(q.id));
function clearTacticalSelection(){S.selectedSquads=[];S.selSquad=null;RTS.drag=null;RTS.hover=null;RTS.preview=null;ghostPoints.visible=false;UI.refreshSquadSelection();}
export function chooseSquad(id, additive = false) {
  if(!barSquads().some(q=>q.id===id))return; RTS.drag=null; RTS.preview=null;ghostPoints.visible=false;
  const ids = new Set(additive ? S.selectedSquads || [S.selSquad] : []);
  if (additive && ids.has(id)) ids.delete(id); else ids.add(id);
  S.selectedSquads = [...ids].filter(Boolean); S.selSquad = S.selectedSquads[0] || null; UI.refreshSquadSelection();
}
export function toggleRts() {
  RTS.on = !RTS.on; RTS.drag = null; ghostPoints.visible = false;
  document.body.classList.toggle('tactical', RTS.on);
  if (RTS.on) { RTS.cx = S.me.x; RTS.cz = S.me.z; if (document.pointerLockElement) document.exitPointerLock(); UI.addLog('Стратег: ЛКМ — выбрать, Shift+ЛКМ — несколько, рамка ЛКМ — группа. ПКМ по врагу — атака; удерживайте ПКМ по земле, чтобы задать фронт и увидеть места бойцов. WASD — камера, колесо — масштаб, средняя кнопка — поворот. Z — назад.', 'info'); }
}
export const barSquads = () => { const l = S.char?.army?.squads || [], war = !!S.char?.war; return l.filter(q => !!q.war === war); };
const mySquads = () => barSquads().filter(q => q.live > 0);
export function selectSquad(i, additive = false) { const q = barSquads()[i]; if (!q) return; chooseSquad(q.id, additive); if (!q.live) net({ type: 'squadOut', id: q.id }); }
export function squadCmd(mode, pt) {
  const list = selected(); if (!list.length) return UI.addLog('Выберите отряд на панели войска.', 'warn');
  for (const q of list) net({ type: 'squadOrder', id: q.id, mode: mode === 'form' ? undefined : mode, form: mode === 'form' ? (q.form === 'line' ? 'loose' : 'line') : undefined, x: pt?.x, z: pt?.z, ry: pt?.ry, columns: pt?.columns });
}
function screenPoint(pos) { const p = pos.clone().project(camera); return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2, visible: p.z > -1 && p.z < 1 }; }
function tacticalPick() {
  const mouse = S.mouse || { x: innerWidth / 2, y: innerHeight / 2 }; let best = null, bd = 22;
  for (const o of mobs.values()) {
    if (o.st === 3 || !o.obj.visible) continue;
    const p = screenPoint(o.obj.position.clone().add(new THREE.Vector3(0, 1, 0))), d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
    if (p.visible && d < bd) { bd = d; best = o; }
  }
  for (const [id, tag] of sqTags) {
    const p = screenPoint(tag.g.position), d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
    if (!p.visible || d > 34) continue;
    const unit = [...mobs.values()].find(o => o.st !== 3 && (typeof id === 'number' ? o.sq === id : 'g:' + o.gid === id));
    if (unit && d < bd + 12) { best = unit; bd = d; }
  }
  return best;
}
function tacticalDown(e) {
  S.mouse = { x: e.clientX, y: e.clientY };
  if (e.button === 1) { RTS.drag = { button: 1, sx: e.clientX, sy: e.clientY }; return; }
  if (e.button !== 0 && e.button !== 2) return;
  RTS.drag = { button: e.button, sx: e.clientX, sy: e.clientY, start: groundPointAtMouse(), target: tacticalPick(), additive: e.shiftKey || e.ctrlKey };
}
function tacticalUp(e) {
  const drag = RTS.drag; if (!drag || drag.button !== e.button) return; RTS.drag = null; selectionBox.style.display = 'none';
  if (e.button === 1) return;
  const length = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
  if (e.button === 0) {
    if (length > 7) {
      const ids = new Set(drag.additive ? S.selectedSquads || [] : []);
      for (const o of mobs.values()) if (o.sq > 0 && o.st !== 3) { const p = screenPoint(o.obj.position); if (p.visible && p.x >= Math.min(drag.sx,e.clientX) && p.x <= Math.max(drag.sx,e.clientX) && p.y >= Math.min(drag.sy,e.clientY) && p.y <= Math.max(drag.sy,e.clientY)) ids.add(o.sq); }
      S.selectedSquads = [...ids]; S.selSquad = S.selectedSquads[0] || null;
    } else if (drag.target?.sq > 0) chooseSquad(drag.target.sq, drag.additive);
    return;
  }
  const list = selected().filter(q => q.live); if (!list.length) return;
  if (drag.target?.foe) { for (const q of list) net({ type: 'squadOrder', id: q.id, mode: 'attack', tgt: drag.target.id }); fxRing(drag.target.x,drag.target.z); return; }
  const preview = formationPreview(drag); if (!preview || !preview.valid) return UI.addLog('Приказ недоступен: строй должен стоять на суше или настиле.', 'warn');
  for (const q of preview.orders) net({ type:'squadOrder', id:q.id, mode:'move', x:q.x,z:q.z,ry:q.ry,columns:q.columns });
  RTS.preview = preview; RTS.previewUntil = performance.now() + 4000;
}
function formationPreview(drag) {
  const end = groundPointAtMouse(); if (!end || !drag.start) return null;
  const dx=end.x-drag.start.x,dz=end.z-drag.start.z,width=Math.hypot(dx,dz), list=selected().filter(q=>q.live);
  const ry=width > 3 ? Math.atan2(-dz,dx) : (()=>{const q=list[0], m=[...mobs.values()].find(m=>m.sq===q?.id);return m?Math.atan2(end.x-m.x,end.z-m.z):S.me.ry;})();
  const columns=width>3?Math.max(2,Math.min(12,Math.round(width/Math.max(1,list.length)/2.2))):6;
  const cx=width>3?(end.x+drag.start.x)/2:end.x,cz=width>3?(end.z+drag.start.z)/2:end.z;
  const orders=[],points=[];let valid=true;
  list.forEach((q,k)=>{const side=(k-(list.length-1)/2)*(Math.min(columns,q.live)*2.2+5), x=cx+Math.cos(ry)*side,z=cz-Math.sin(ry)*side;
    orders.push({id:q.id,x,z,ry,columns});
    for(let i=0;i<q.live;i++){const pt=formationWorld(i,q.live,q.form,columns,x,z,ry);const h=WG.terrainHeight(pt.x,pt.z),deck=WG.deckHeight(pt.x,pt.z,S.blds);const collision=collide(pt.x,pt.z);if((h<.2&&deck==null)||Math.hypot(collision.x-pt.x,collision.z-pt.z)>.25)valid=false;points.push({...pt,y:Math.max(h,deck??h)+.22});}
  });return{orders,points,valid};
}
const selectionBox=document.createElement('div');selectionBox.id='tacticalSelection';document.body.appendChild(selectionBox);
const tacticalCursor=document.createElement('div');tacticalCursor.id='tacticalCursor';document.body.appendChild(tacticalCursor);
const tacticalHint=document.createElement('div');tacticalHint.id='tacticalHint';document.body.appendChild(tacticalHint);
const ghostGeo=new THREE.CircleGeometry(.38,10);ghostGeo.rotateX(-Math.PI/2);
const ghostPoints=new THREE.InstancedMesh(ghostGeo,new THREE.MeshBasicMaterial({color:0x8cff9a,transparent:true,opacity:.85,depthTest:false,depthWrite:false}),512);ghostPoints.frustumCulled=false;ghostPoints.visible=false;ghostPoints.renderOrder=50;scene.add(ghostPoints);
const ghostMatrix=new THREE.Matrix4();
function updateTactical() {
  if(!RTS.on||UI.anyModal()){canvas.style.cursor='';ghostPoints.visible=false;selectionBox.style.display='none';tacticalHint.style.display='none';tacticalCursor.style.display='none';return;}
  const hover=tacticalPick();RTS.hover=hover;
  const attack=!!hover?.foe&&selected().length>0; const mouse=S.mouse||{x:0,y:0};Object.assign(tacticalCursor.style,{display:attack?'block':'none',left:(mouse.x+12)+'px',top:(mouse.y+10)+'px'});tacticalCursor.textContent='⚔';canvas.style.cursor=attack?'crosshair':hover?.sq>0?'pointer':'default';
  tacticalHint.style.display='block';tacticalHint.textContent=attack?'⚔ Атаковать отряд':hover?.sq>0?'Выбрать отряд':'ПКМ: движение · удержание ПКМ: фронт строя';tacticalHint.classList.toggle('attack',attack);
  if(RTS.drag?.button===0){const d=RTS.drag,m=S.mouse||{x:d.sx,y:d.sy};Object.assign(selectionBox.style,{display:'block',left:Math.min(d.sx,m.x)+'px',top:Math.min(d.sy,m.y)+'px',width:Math.abs(m.x-d.sx)+'px',height:Math.abs(m.y-d.sy)+'px'});}
  let p=RTS.drag?.button===2&&!RTS.drag.target?.foe?formationPreview(RTS.drag):performance.now()<RTS.previewUntil?RTS.preview:null;
  ghostPoints.visible=!!p;if(p){ghostPoints.count=Math.min(512,p.points.length);ghostPoints.material.color.setHex(p.valid?0x8cff9a:0xff6050);p.points.slice(0,512).forEach((pt,i)=>{ghostMatrix.makeTranslation(pt.x,pt.y,pt.z);ghostPoints.setMatrixAt(i,ghostMatrix);});ghostPoints.instanceMatrix.needsUpdate=true;}
}

const ringObj = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 32), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); ringObj.rotation.x = -Math.PI / 2; ringObj.visible = false; scene.add(ringObj);
let ringT = 0; function fxRing(x, z) { ringObj.position.set(x, WG.terrainHeight(x, z) + 0.3, z); ringObj.visible = true; ringT = performance.now(); }
function updateCamera(dt, t) {
  if (ringObj.visible && performance.now() - ringT > 1500) ringObj.visible = false;
  if (RTS.on) {
    camTgt.set(RTS.cx, WG.terrainHeight(RTS.cx, RTS.cz) + 1, RTS.cz);
    camPos.set(RTS.cx + Math.sin(camYaw) * RTS.dist * Math.cos(RTS.pitch), camTgt.y + RTS.dist * Math.sin(RTS.pitch), RTS.cz + Math.cos(camYaw) * RTS.dist * Math.cos(RTS.pitch));
    camera.position.lerp(camPos, Math.min(1, dt * 6)); camera.lookAt(camTgt);
    R.sky.position.copy(camera.position);
    if (R.water) { R.water.position.x = Math.round(camera.position.x / 50) * 50; R.water.position.z = Math.round(camera.position.z / 50) * 50; }
    return;
  }
  const me = S.me;
  const ship = S.ship ? ships.get(S.ship) : null;
  const tx = ship ? ship.obj.position.x : me.x, tz = ship ? ship.obj.position.z : me.z, ty = (ship ? 2 : me.y) + 1.6;
  const dist = ship ? Math.max(camDist, 14) : camDist;
  camTgt.set(tx, ty, tz);
  let cx = tx + Math.sin(camYaw) * Math.cos(camPitch) * dist, cz = tz + Math.cos(camYaw) * Math.cos(camPitch) * dist, cy = ty + Math.sin(camPitch) * dist;
  // плечо: камера чуть правее — видно, куда бьём; с луком — за правым плечом, прицел смотрит вперёд, а не в затылок
  if (!ship) {
    const sh = bowMode() ? 1.05 : 0.6, sx = Math.cos(camYaw) * sh, sz = -Math.sin(camYaw) * sh; cx += sx; cz += sz; camTgt.x += sx; camTgt.z += sz;
    if (bowMode()) { const fx = -Math.sin(camYaw) * Math.cos(camPitch), fz = -Math.cos(camYaw) * Math.cos(camPitch), fy = -Math.sin(camPitch); camTgt.x += fx * 12; camTgt.y += fy * 12 + 0.25; camTgt.z += fz * 12; }
  }
  const gmin = (S.inst ? S.inst.y0 : Math.max(0, WG.terrainHeight(cx, cz))) + 0.6;
  if (cy < gmin) cy = gmin;
  if (S.inst) cy = Math.min(cy, S.inst.y0 + 9);
  camPos.set(cx, cy, cz);
  if (ship) camera.position.copy(camPos); else camera.position.lerp(camPos, Math.min(1, dt * 14));
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.6); }
  camera.lookAt(camTgt);
  R.sky.position.copy(camera.position);
  if (R.water) { R.water.position.x = Math.round(camera.position.x / 50) * 50; R.water.position.z = Math.round(camera.position.z / 50) * 50; }
}
export function arenaLeave(){if(!S.spect||S.seatingPending)return;S.seatingPending={bid:S.spect.bid,at:performance.now()};net({type:'arenaLeave'});}
// зритель садится на свободное место трибуны (ярус 3–10), лицом к арене; уходит через ближайший вход
export function arenaSit(bid){
 const b=S.blds.find(b=>b.id===bid);if(!b||S.ship||S.tower||S.seatingPending)return;
 S.seatingPending={bid,at:performance.now()};
 let angle=Math.random()*Math.PI*2;if(Math.abs(Math.sin(angle))<.25)angle+=.6;
 net({type:'arenaSeat',bid,angle,tier:3+Math.floor(Math.random()*8)});
}

export { players, mobs, ships, eships, blds, chestObjs, poiObjs, aimYaw };
export const getCam = () => ({ yaw: camYaw, pitch: camPitch });
window.__imp.cam = (y, p, d) => { camYaw = y; camPitch = p; camDist = d; };
window.__imp.state = () => ({ players, mobs, ships, blds, S });

const landOverlay = new THREE.Group(); scene.add(landOverlay); let landKey = '';
export function updateLandOverlay() {
  landOverlay.visible = !S.inst && S.showPlots !== false;
  if (!S.char || !S.world) return;
  const key = JSON.stringify(S.world.plots || {}) + S.char.id;
  if (key === landKey) return; landKey = key;
  for (const o of [...landOverlay.children]) { landOverlay.remove(o); o.geometry.dispose(); o.material.dispose(); }
  const own = [], other = [], half = D.CELL / 2;
  for (const [key, owner] of Object.entries(S.world.plots || {})) {
    const [cid, i, j] = key.split(':'), C = WG.cityById(cid); if (!C) continue;
    const [cx, cz] = WG.cellCenter(C, Number(i), Number(j)), points = owner === S.char.id ? own : other, co=Math.cos(C.ry),sn=Math.sin(C.ry);
    const corners=[[-half,-half],[half,-half],[half,half],[-half,half]];
    for(let edge=0;edge<4;edge++) for(let part=0;part<4;part++) {
      const a=corners[edge],b=corners[(edge+1)%4];
      for(const k of [part/4,(part+1)/4]) { const x=cx+(a[0]+(b[0]-a[0])*k)*co+(a[1]+(b[1]-a[1])*k)*sn,z=cz-(a[0]+(b[0]-a[0])*k)*sn+(a[1]+(b[1]-a[1])*k)*co;points.push(x,WG.terrainHeight(x,z)+.17,z); }
    }
  }
  for(const [points,color] of [[own,0x8ff0a0],[other,0xd7ad73]]) { const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const lines=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.75,depthWrite:false}));lines.renderOrder=4;landOverlay.add(lines); }
}
export function markDestination(x,z,label='Цель') { S.navTarget={x,z,label}; fxRing(x,z); UI.addLog(`${label}: ${Math.round(Math.hypot(x-S.me.x,z-S.me.z))} м. Метка показана в мире.`, 'info'); }
const destinationLabel=MD.makeLabel('Цель','#ffdf80');destinationLabel.visible=false;scene.add(destinationLabel);
function updateDestination() { const target=S.navTarget;destinationLabel.visible=!!target&&!S.inst;if(target){destinationLabel.position.set(target.x,WG.terrainHeight(target.x,target.z)+8,target.z);const d=Math.hypot(target.x-S.me.x,target.z-S.me.z);if(d<8){S.navTarget=null;destinationLabel.visible=false;} } }

function syncGuildFootprints() {
  if(!S.W)return;
  for(const C of S.W.cities)for(const l of C.layout){if(l.type==='stall')continue;const b=S.blds.find(b=>b.type===l.type&&b.muni&&b.city===C.id);if(b){l.x=b.x;l.z=b.z;l.ry=b.ry;}}
  for(const C of S.W.cities)WG.extendCivicAvenues(C);
  WG.setMuniFootprints(S.W.cities);
}
