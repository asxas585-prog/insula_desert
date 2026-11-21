import { overlaps } from './footprints.js';
import { baseSalePrice, purchasePrice } from './pricing.js';
// Интерфейс: стартовый экран, HUD, окна, карта, рыбалка
import * as THREE from 'three';
import * as D from './data.js';
import * as WG from './world.js';
import { S, net, esc, hexCss, fmtT } from './cstate.js';
import * as C from './client.js';
import * as MD from './models.js';
import * as R from './render.js';
import { icon, hasIcon, gearIcon } from './icons.js';

const { RES, GEAR, QUALITY, BUILDINGS, RECIPES, SHIPS, ENEMIES, OFFICES, LAWS, STORY, INSTANCES, PORTS, RANKS, STATS } = D;
const $ = (id) => document.getElementById(id);
let MB_PRE = ''; // плашка поверх окна здания (например, «здание продаётся»)
let modalPointerDown=false;
document.addEventListener('pointerdown',()=>{modalPointerDown=true;},true);
document.addEventListener('pointerup',()=>{modalPointerDown=false;},true);
addEventListener('blur',()=>{modalPointerDown=false;});
const setHTML=(el,h)=>{
  if(MB_PRE&&el.id==='mbody')h=MB_PRE+h;
  if(el._h===h)return;
  const arena=el.id==='mbody'&&cur?.kind==='bld'&&S.blds.find(b=>b.id===cur.id)?.type==='amphitheatrum';
  const context=arena?`${cur.id}:${cur.tab}`:null,keep=arena&&el._arenaContext===context;
  if(keep&&modalPointerDown)return; // A timer update must not replace a button between pointer-down and click.
  const values=keep?[...el.querySelectorAll('input[id],textarea[id],select[id]')].map(n=>({id:n.id,value:n.value,checked:n.checked})):[];
  const active=keep&&el.contains(document.activeElement)?document.activeElement:null;
  const focus=active?{id:active.id,start:active.selectionStart,end:active.selectionEnd}:null,scroll=el.scrollTop;
  el._h=h;el.innerHTML=h;el._arenaContext=context;
  for(const v of values){const n=document.getElementById(v.id);if(n&&el.contains(n)){n.value=v.value;n.checked=v.checked;}}
  if(focus?.id){const n=document.getElementById(focus.id);if(n&&el.contains(n)){n.focus({preventScroll:true});if(focus.start!=null&&n.setSelectionRange)try{n.setSelectionRange(focus.start,focus.end);}catch{}}}
  if(keep)el.scrollTop=scroll;
};
const resIco = (k) => hasIcon(k) ? icon(k) : (RES[k] ? RES[k].icon : '');
const resName = (k) => RES[k] ? `${resIco(k)} ${RES[k].name}` : k;
const gearName = (it) => it ? `<span class="q${it.q || 0}">${GEAR[it.k] ? GEAR[it.k].name : it.k}${it.q ? ` · ${QUALITY[it.q].name}` : ''}</span>` : '<span class="muted">—</span>';
const costHtml = (cost, have = {}) => Object.entries(cost).map(([k, n]) => `<span class="${(have[k] || 0) >= n ? 'ok' : 'no'}" style="white-space:nowrap">${resName(k)} ${n}</span>`).join(' · ');
const SLOT_NAMES = { weapon: 'Оружие', offhand: 'Щит', head: 'Шлем', body: 'Доспех', legs: 'Ноги' };

// ---------- Старт ----------
export function initStart(onJoin) {
  let color = D.COLORS[0];
  try { const c = Number(localStorage.getItem('imperiumColor')); if (D.COLORS.includes(c)) color = c; } catch {}
  const row = $('colorRow');
  row.innerHTML = D.COLORS.map((c) => `<button data-c="${c}" style="background:${hexCss(c)}" class="${c === color ? 'on' : ''}" title="Цвет туники"></button>`).join('');
  row.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; color = Number(b.dataset.c); for (const x of row.children) x.classList.toggle('on', x === b); };
  try { $('nameInput').value = localStorage.getItem('imperiumName') || ''; const code = localStorage.getItem('imperiumCode'); if (code) { $('codeInput').value = code; } } catch {}
  const go = () => {
    const name = $('nameInput').value.trim();
    const code = $('codeInput').value.trim();
    if (!name) { $('startErr').textContent = 'Введите имя персонажа.'; return; }
    if (code && $('passwordInput').value.length < 10) { $('startErr').textContent = 'Введите пароль от 10 символов.'; return; }
    if (code && !/^\d{5}$/.test(code)) { $('startErr').textContent = 'Код — ровно 5 цифр (или оставьте поле пустым).'; return; }
    try { localStorage.setItem('imperiumName', name); localStorage.setItem('imperiumColor', String(color)); if (code) localStorage.setItem('imperiumCode', code); } catch {}
    $('start').classList.add('hidden');
    onJoin(name, code, color, $('passwordInput').value);
  };
  $('joinBtn').onclick = go;
  $('nameInput').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  $('codeInput').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  $('mclose').onclick = closeModal;
}
export function onStarted(fresh) {
  $('hud').classList.remove('hidden');
  addLog('Добро пожаловать в колонию! WASD — идти, Shift — бег, мышь — камера, ЛКМ — удар; с луком удержать и отпустить ЛКМ — выстрел; удержать и отпустить F — пилум; ПКМ — блок или отмена выстрела, Пробел — прыжок, Q — перекат, E — действие, H — помощь.', 'good');
  if (fresh) setTimeout(() => openHelp(), 600);
  chatSetup();
}

// ---------- Лог и всплывашки ----------
export function addLog(html, kind = 'info') {
  const el = document.createElement('div'); el.className = kind; el.innerHTML = html;
  const log = $('log'); log.prepend(el);
  while (log.children.length > 12) log.lastChild.remove();
  setTimeout(() => { el.style.transition = 'opacity 1s'; el.style.opacity = '0.35'; }, 15000);
}
// запись из развалин древнего города
export function loreDialog(m) { const el = $('dialog'); el.innerHTML = `<div><div class="who">📜 ${esc(m.city)} — ${esc(m.title)} <span class="tag">${m.n}/${m.of}</span></div><div style="line-height:1.5">${esc(m.text)}</div><div class="acts"><button class="btn sm" id="loreOk">Закрыть</button></div></div>`; el.classList.remove('hidden'); $('loreOk').onclick = () => el.classList.add('hidden'); addLog(`<b>📜 ${esc(m.title)}:</b> ${esc(m.text)}`, 'info'); }
export function toast(text, big = false, ms = 3300) {
  const el = document.createElement('div'); el.textContent = text; if (big) el.className = 'big';
  $('toasts').append(el); setTimeout(() => el.remove(), ms);
  while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
}
export function lootToast(text, k) {
  const el = document.createElement('div'); el.innerHTML = (k && hasIcon(k) ? icon(k) + ' ' : '') + esc(text);
  $('toasts').append(el); setTimeout(() => el.remove(), 3300);
  while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
}
const floats = [];
export function floatText(x, y, z, text, color = '#fff', big = false) {
  const el = document.createElement('div'); el.textContent = text; el.style.color = color; if (big) el.className = 'big';
  $('floats').append(el); floats.push({ el, p: new THREE.Vector3(x + (Math.random() - 0.5) * 0.6, y, z), t: 0 });
}
export function hurtFlash() { const h = $('hurt'); h.style.transition = 'none'; h.style.opacity = '1'; requestAnimationFrame(() => { h.style.transition = 'opacity 0.6s'; h.style.opacity = '0'; }); }
export function levelUp(m) { toast(`⭐ Уровень ${m.level}! Очков характеристик: ${m.points} (C — персонаж)`, true); }
export function questDone(m) { toast(`✔ Задание выполнено: ${m.title}`, true); addLog(`Награда: ${m.reward.den} ден., ${m.reward.xp} опыта, ${m.reward.dig} достоинства, ${m.reward.office||0} очков должности (${esc(m.cityName||m.city||'Мессана')})`, 'good'); }
export function showDead(m) { $('deadBox').classList.remove('hidden'); $('deadText').textContent = `${m.by ? 'Вас сразил(а): ' + m.by + '. ' : ''}Потеряно ${m.lost} денариев. Возрождение через ${m.t} с…`; }
export function hideDead() { $('deadBox').classList.add('hidden'); }
export function setPrompt(t) { setHTML($('prompt'), esc(t)); }
export function showHold(p) { $('holdRing').classList.toggle('hidden', !p); if (p) $('holdArc').style.strokeDashoffset = String(100.5 * (1 - p)); }
export function npcDialog(m) {
  const d = $('dialog'); d.classList.remove('hidden');
  d.innerHTML = `<div class="who">${esc(m.name)}</div><div>${esc(m.text)}</div><div class="acts"><button class="btn sm" id="dlgOk">Понятно</button></div>`;
  $('dlgOk').onclick = () => d.classList.add('hidden');
  setTimeout(() => d.classList.add('hidden'), 30000);
}
export function duelAsk(m) {
  const d = $('dialog'); d.classList.remove('hidden');
  d.innerHTML = `<div class="who">Вызов на поединок</div><div>${esc(m.from)} вызывает вас на поединок в Амфитеатре (не насмерть).</div><div class="acts"><button class="btn sm good" id="dA">Принять</button><button class="btn sm alt" id="dN">Отказаться</button></div>`;
  $('dA').onclick = () => { net({ type: 'duelAccept' }); d.classList.add('hidden'); };
  $('dN').onclick = () => d.classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}

// ---------- Чат ----------
let chatting = false;
function chatSetup() {
  const inp = $('chatInput');
  inp.onkeydown = (e) => {
    if (e.key === 'Enter') { const t = inp.value.trim(); if (t) net({ type: 'chat', text: t }); inp.value = ''; closeChat(); e.preventDefault(); }
    else if (e.key === 'Escape') { closeChat(); e.preventDefault(); }
    e.stopPropagation();
  };
}
function openChat() { chatting = true; C.setChatting(true); $('chatWrap').classList.remove('hidden'); $('chatInput').focus(); if (document.pointerLockElement) document.exitPointerLock(); }
function closeChat() { chatting = false; C.setChatting(false); $('chatWrap').classList.add('hidden'); $('chatInput').blur(); }

// ---------- Клавиши ----------
export function handleKey(k) {
  if (k === 'Enter') { openChat(); return true; }
  if (k === 'Escape') { if (S.placing) { cancelPlacing(); return true; } if (anyModal()) { closeModal(); return true; } $('dialog').classList.add('hidden'); return false; }
  if (k === 'Tab' || k === 'KeyI') { toggle('inv'); return true; }
  if (k === 'KeyC') { toggle('char'); return true; }
  if (k === 'KeyJ') { toggle('journal'); return true; }
  if (k === 'KeyK') { toggle('econ'); return true; }
  if (k === 'KeyU') { toggle('army'); return true; }
  if (k === 'KeyM') { toggle('map'); return true; }
  if (k === 'KeyB' && S.ship && !anyModal()) { net({ type: 'boardStart' }); return true; } // на корабле B — абордаж
  if (k === 'KeyB') { if (S.inst) return true; toggle('build'); return true; }
  if (k === 'KeyH') { toggle('help'); return true; }
  if (k === 'KeyG' && S.ship && (S.seat ?? 0) === 0 && !anyModal()) { net({ type: 'moor' }); return true; }
  if (k === 'KeyG' && (S.ship || nearMyShip())) { toggle('ship'); return true; }
  return false;
}
function nearMyShip() { if (!S.world || !S.char) return null; for (const [id, o] of C.ships) { if (Math.hypot(o.obj.position.x - S.me.x, o.obj.position.z - S.me.z) < SHIPS[o.type].len / 2 + 8) return id; } return null; }
function toggle(kind) { if (cur && cur.kind === kind) closeModal(); else open(kind); }

// ---------- Модальное окно ----------
let cur = null; // {kind, tab, id}
export const anyModal = () => !!cur;
export function closeModal() { cur = null; $('modal').classList.add('hidden');if($('modal').contains(document.activeElement))document.activeElement.blur(); }
function open(kind, opts = {}) {
  cur = { kind, tab: opts.tab || null, id: opts.id ?? null, key: opts.key ?? null };
  $('modal').classList.remove('hidden'); $('modal').classList.toggle('big', kind === 'build');
  if (document.pointerLockElement) document.exitPointerLock();
  render();
}
function tabs(list) {
  if (!cur.tab || !list.some(([k]) => k === cur.tab)) cur.tab = list[0][0];
  setHTML($('mtabs'), list.map(([k, n, dot]) => `<button data-tab="${k}" class="${k === cur.tab ? 'on' : ''}">${n}${dot ? ' <span class="dot">●</span>' : ''}</button>`).join(''));
}
let tpReady = 0;
$('rateBtn').onclick = (e) => { e.currentTarget.blur(); open('ratings'); };
$('encBtn').onclick = (e) => { e.currentTarget.blur(); open('enc'); };
$('tpBtn').onclick = (e) => { e.currentTarget.blur(); net({ type: 'tpForum' }); };
export function syncTp(left) { tpReady = performance.now() / 1000 + (left || 0); }
setInterval(() => { const b = $('tpBtn'); if (!b) return; const l = Math.ceil(tpReady - performance.now() / 1000); b.textContent = l > 0 ? `🏛 На форум (${l} с)` : '🏛 На форум'; b.disabled = l > 0; }, 500);
$('pvpBtn').onclick = (e) => { e.currentTarget.blur(); net({ type: 'pvp' }); };
export function syncPvp() { const me = S.roster && [...S.roster.values()].find((q) => q.id === S.myId), on = !!(me && me.pvp), b = $('pvpBtn'); if (!b) return; b.classList.toggle('on', on); b.textContent = on ? '⚔ Бой с игроками: ВКЛ' : '🕊 Бой с игроками: выкл'; }
$('mtabs').onclick = (e) => { const b = e.target.closest('button'); if (!b || !cur) return; cur.tab = b.dataset.tab; render(); };
// кнопки: data-a="действие" data-*
$('mbody').addEventListener('change', (e) => { const t = e.target; if (t.dataset && t.dataset.a2 === 'routeCargo') net({ type: 'routeCargo', rid: Number(t.dataset.rid), cargo: t.value || null }); });
$('mbody').addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const a = b.dataset.a, d = b.dataset;
  const num = (sel) => { const el = $('mbody').querySelector(sel); return el ? Math.max(1, Number(el.value) || 1) : 1; };
  switch (a) {
    case 'equip': net({ type: 'equip', uid: Number(d.uid) }); break;
    case 'unequip': net({ type: 'unequip', slot: d.slot }); break;
    case 'dropGear': net({ type: 'dropGear', uid: Number(d.uid) }); break;
    case 'sellGear': net({ type: 'sellGear', uid: Number(d.uid) }); break;
    case 'dropRes': net({ type: 'dropRes', res: d.res, n: Number(d.n) }); break;
    case 'eat': net({ type: 'eat', res: d.res }); break;
    case 'stat': net({ type: 'stat', k: d.k }); break;
    case 'spec': net({ type: 'spec', k: d.k }); break;
    case 'slaveSell': net({ type: 'slaveSell', id: Number(d.id) }); break;
    case 'gladUp': net({ type: 'gladUp', sid: Number(d.sid), k: d.k }); break;
    case 'gladLudus': net({ type: 'gladLudus', sid: Number(d.sid), on: d.on === '1' }); break;
    case 'gladBout': net({ type: 'gladBout', sid: d.sid != null ? Number(d.sid) : undefined, lion: d.lion != null ? Number(d.lion) : undefined }); break;
    case 'arenaGear': net({ type: 'arenaGear', k: d.k }); break;
    case 'arenaBuy': net({ type: 'arenaBuy', k: d.k }); break;
    case 'invSel': cur.sel = cur.sel === d.key ? null : d.key; render(); break;
    case 'legend': { const l = $('mapLegend'); l.classList.toggle('mini'); b.textContent = l.classList.contains('mini') ? 'показать' : 'скрыть'; break; }
    case 'horseBuy': net({ type: 'horseBuy', kind: d.k }); break;
    case 'breed': net({ type: 'breed' }); break;
    case 'rentPublic': case 'foalBuy': case 'horseBuyFull': net({ type: d.a, kind: d.k }); break;
    case 'stockTake': case 'stockNpc': case 'stockBuy': case 'stockRentTake': net({ type: d.a, id: Number(d.id) }); break;
    case 'stockSale': net({ type: 'stockSale', id: Number(d.id), price: d.off ? 0 : Number(($('sp_' + d.id) || {}).value) || 0 }); break;
    case 'stockRent': net({ type: 'stockRent', id: Number(d.id), price: d.off ? 0 : Number(($('rp_' + d.id) || {}).value) || 0 }); break;
    case 'horseOut': net({ type: 'horseOut', id: Number(d.id) }); break;
    case 'horseStable': net({ type: 'horseStable' }); break;
    case 'horseFeedA': net({ type: 'horseFeed' }); break;
    case 'crateCraft': case 'crateTake': net({ type: a, k: d.k }); break;
    case 'crateStore': net({ type: 'crateStore' }); break;
    case 'leaveShip': net({ type: 'leave' }); closeModal(); break;
    case 'crateLoad': net({ type: 'crateLoad', sid: Number(d.sid) }); break;
    case 'crateUnload': net({ type: 'crateUnload', sid: Number(d.sid), i: Number(d.i) }); break;
    case 'crateSell': net({ type: 'crateSell', tid: d.tid, sid: d.sid != null ? Number(d.sid) : undefined, i: d.i != null ? Number(d.i) : undefined }); break;
    case 'shipRepair': net({ type: 'shipRepair', sid: Number(d.sid) }); break;
    case 'shipUp': net({ type: 'shipUp', sid: Number(d.sid), k: d.k }); break;
    case 'shipArcher': net({ type: 'shipArcher', sid: Number(d.sid), slave: Number(d.slave), on: d.on === '1' }); break;
    case 'stableFeed': net({ type: 'stableFeed', n: Number(d.n) }); break;
    case 'deliver': net({ type: 'deliver', bid: Number(d.bid), store: d.store === '1' }); break;
    case 'bldSale': net({ type: 'bldSale', bid: Number(d.bid), price: d.off ? 0 : num('#bs_' + d.bid) }); break;
    case 'bldBuy': net({ type: 'bldBuy', bid: Number(d.bid) }); break;
    case 'bldDemolish': if (confirm('Снести здание? Вернётся только часть материалов.')) net({ type: 'demolish', bid: Number(d.bid) }); break;
    case 'squadHome': net({ type: 'squadHome', id: Number(d.id) }); break;
    case 'watchBuy': case 'watchUp': net({ type: a }); break;
    case 'gladName': { const el = $('gn_' + d.sid); if (el && el.value.trim()) net({ type: 'gladName', sid: Number(d.sid), name: el.value.trim() }); break; }
    case 'gladSale': net({ type: 'gladSale', sid: Number(d.sid), price: d.off ? 0 : num('#gs_' + d.sid) }); break;
    case 'gladBuy': net({ type: 'gladBuy', sid: Number(d.sid) }); break;
    case 'ledgerBiz': ledgerOpen[d.s] = !ledgerOpen[d.s]; render(); break;
    case 'shopSub': shopSub = d.k; render(); break;
    case 'collect': net({ type: 'collect', bid: Number(d.bid), store: d.store === '1', res: d.res || null }); break;
    case 'repair': net({ type: 'repair', bid: Number(d.bid), store: d.store === '1' }); break;
    case 'storeTake': net({ type: 'storeTake', res: d.res, n: Number(d.n) }); break;
    case 'craft': net({ type: 'craft', id: d.id, n: Number(d.n) }); break;
    case 'sell': net({ type: 'sell', res: d.res, n: Number(d.n) || num(`#n_${d.res}`), cargo: d.cargo === '1' }); break;
    case 'buy': net({ type: 'buy', k: d.k, n: Number(d.n) || num(`#b_${d.k}`) }); break;
    case 'donate': net({ type: 'donate', res: d.res, n: Number(d.n) }); break;
    case 'slaveBuy': net({ type: 'slaveBuy', id: Number(d.id) }); break;
    case 'slaveFree': if (confirm('Отпустить на волю?')) net({ type: 'slaveFree', id: Number(d.id) }); break;
    case 'slaveAssign': { const sel = $('mbody').querySelector(`#sa_${d.id}`); net({ type: 'slaveAssign', id: Number(d.id), bid: sel && sel.value ? Number(sel.value) : null }); break; }
    case 'slaveHere': net({ type: 'slaveAssign', id: Number(d.id), bid: Number(d.bid) }); break;
    case 'home': net({ type: 'home', bid: Number(d.bid) }); break;
    case 'shipBuild': net({ type: 'shipBuild', st: d.st }); break;
    case 'cargo': net({ type: 'cargo', sid: Number(d.sid), res: d.res, n: Number(d.n), dir: d.dir }); break;
    case 'unload': net({ type: 'unload', sid: Number(d.sid) }); break;

    case 'colonyLoad': net({ type: 'colonyLoad', bid: Number(d.bid) }); break;
    case 'cand': net({ type: 'cand', office: d.office }); break;
    case 'vote': net({ type: 'vote', office: d.office, cid: d.cid }); break;
    case 'arenaSit': C.arenaSit(Number(d.bid));render();break;
    case 'arenaLeave': C.arenaLeave();closeModal();break;
    case 'warCreate': { const zv = ($('warZone') || {}).value; net({ type: 'warCreate', size: Number(d.size) || 1, mode: d.mode, zone: zv === '' || zv == null ? null : Number(zv) }); break; }
    case 'warRent': net({ type: 'warRent', k: d.k }); break;
    case 'warBot': net({ type: 'warBot', id: Number(d.id), side: d.side, on: d.on === '1' }); break;
    case 'warPickT': { const c2 = S.char, own2 = ((c2.army && c2.army.squads) || []).filter((q) => !q.war), pool2 = [...own2, ...(c2.warRent || [])], id = Number(d.id); let pk = (c2.warPick || []).length ? [...c2.warPick] : pool2.slice(0, D.WAR.maxSquads).map((q) => q.id); pk = pk.includes(id) ? pk.filter((x) => x !== id) : [...pk, id].slice(-D.WAR.maxSquads); net({ type: 'warPick', ids: pk }); break; }
    case 'warJoin': net({ type: 'warJoin', id: Number(d.id), side: d.side }); break;
    case 'warLeave': net({ type: 'warLeave' }); break;
    case 'ferry': net({ type: 'ferry', to: d.to }); closeModal(); break;
    case 'roomRent': net({ type: 'roomRent', bid: Number(d.bid) }); break;
    case 'stallBuy': net({ type: 'stallBuy', bid: Number(d.bid) }); break;
    case 'stallSell': if (confirm('Продать лавку городу?')) net({ type: 'stallSell', bid: Number(d.bid) }); break;
    case 'speech': { const t = speechDraft.trim(); if (t) { net({ type: 'speech', text: t }); speechDraft = ''; closeModal(); } break; }
    case 'resign': if (confirm('Сложить полномочия?')) net({ type: 'resign', office: d.office }); break;
    case 'callElection': net({ type: 'callElection' }); break;
    case 'propose': net({ type: 'propose', key: d.key, opt: Number(d.opt) }); break;
    case 'lawVote': net({ type: 'lawVote', yes: d.yes === '1' }); break;
    case 'office': net({ type: 'office', act: d.act, bt: d.bt, res: d.res, to: d.to, n: Number(d.n) || num('#rewardN') }); break;
    case 'reward': { const sel = $('mbody').querySelector('#rewardTo'); net({ type: 'office', act: 'reward', to: sel ? sel.value : null, n: num('#rewardN') }); break; }
    case 'romeDeliver': net({ type: 'romeDeliver', rid: Number(d.rid), store: d.store === '1' }); break;
    case 'quest': net({ type: 'quest', id: Number(d.id) }); break;
    case 'questDrop': net({ type: 'questDrop', id: Number(d.id) }); break;
    case 'instEnter': net({ type: 'instEnter', key: d.key }); closeModal(); break;
    case 'arena': net({ type: 'arena', grand: d.grand === '1' }); break;
    case 'duel': net({ type: 'duel', pid: Number(d.pid) }); break;
    case 'bet': net({ type: 'bet', on: d.on === 'p' ? Number(d.pid) : d.on, amt: num('#betN') }); break;
    case 'place': startPlacing(d.bt); break;
    case 'demolishMode': startDemolish(); break;
    case 'gfx': setGfx(d.v); break;
    case 'assault': net({ type: 'assault', city: d.city }); break;
    case 'permit': net({ type: 'permit', city: d.city, d: d.d, n: Number(($('pm_' + d.d) || {}).value) || 1 }); break;
    case 'release': net({ type: 'release', city: d.city }); break;
    case 'claimMode': startClaim(d.city); break;
    case 'roadMode': startClaim(d.city);S.placing.cityRoad=true;S.placing.n=1;addLog('Эдил: ЛКМ — улица 4×4 м; продолжайте от главной дороги. Esc — выйти.','info');break;
    case 'colonyUp': net({ type: 'colonyUp', bid: Number(d.bid), i: Number(d.i) }); break;
    case 'guardOrd': net({ type: 'guardOrder', mode: d.m, bid: d.bid ? Number(d.bid) : null }); break;
    case 'guardFire': if (confirm('Рассчитать телохранителя?')) net({ type: 'guardFire' }); break;
    case 'squadRecruit': net({ type: 'squadRecruit', k: d.k, slaves: !!d.slaves }); break;
    case 'squadUp': net({ type: 'squadUp', id: Number(d.id), k: d.k }); break;
    case 'squadOut': case 'squadIn': case 'squadDisband': net({ type: d.a, id: Number(d.id) }); break;
    case 'squadOrd': net({ type: 'squadOrder', id: Number(d.id), mode: d.m }); break;
    case 'squadForm': net({ type: 'squadOrder', id: Number(d.id), form: d.f }); break;
    case 'tunaUnload':case 'tunaLoad':net({type:d.a,sid:Number(d.sid),slot:Number(d.slot)});break;
    case 'tunaSell':net({type:d.a,bid:Number(d.bid)});break;
    case 'guardHire': case 'guardToggle': net({ type: d.a }); break;
    case 'guide': open('guide'); break;
    case 'guideTarget': C.markDestination(Number(d.x), Number(d.z), d.label); closeModal(); break;
    case 'warehouseMove': net({type:'warehouseMove',bid:Number(d.bid),res:d.res,n:Number(d.n)||10000,dir:d.dir}); break;
    case 'autoStore': net({type:'autoStore',bid:Number(d.bid)}); break;
    case 'shipScrap': if (confirm('Списать остов без восстановления?')) net({type:'shipScrap',sid:Number(d.sid)}); break;
    case 'squadReinforce': net({type:'squadReinforce',id:Number(d.id)}); break;
    case 'shipBuy': net({ type: 'shipBuy', sid: Number(d.sid) }); break;
    case 'shipRome': net({ type: 'shipRome', sid: Number(d.sid), gift: d.gift === '1' }); break;
    case 'shipForSale': net({ type: 'shipForSale', sid: Number(d.sid), price: d.off ? 0 : Number(($('sale_' + d.sid) || {}).value) || 0 }); break;
    case 'rankUp': net({ type: 'rankUp' }); break;
    case 'sciBuy': net({ type: 'sciBuy', k: d.k, n: Number(d.n) || 1 }); break;
    case 'sciStudy': net({ type: 'sciStudy' }); break;
    case 'sellCatch': net({ type: 'sellCatch', bid: Number(d.bid) }); break;
    case 'routeNew': net({ type: 'routeNew', post: Number($('rtPost').value), dest: $('rtDest').value }); break;
    case 'routeShip': net({ type: 'routeShip', rid: Number(d.rid), sid: Number(d.sid), on: d.on === '1' }); break;
    case 'routeWagons': case 'routeGuards': net({ type: d.a, rid: Number(d.rid), n: Number(d.n) }); break;
    case 'routeToggle': case 'routeDel': net({ type: d.a, rid: Number(d.rid) }); break;
    case 'crateOrder': net({ type: 'crateOrder', post: Number(d.post), k: d.k, n: Number(($('ord_' + d.post + '_' + d.k) || {}).value) || 0 }); break;
    case 'mapZoom': mapView.span = Math.max(150, Math.min(4800, mapView.span * Number(d.f))); break;
  }
  setTimeout(render, 150);
});
function render() {
  if (!cur) return;
  $('mmove').classList.add('hidden');
  const f = { guide: renderTradeGuide, war: renderWar, ratings: renderRatings, army: renderArmy, econ: renderEcon, city: renderCity, inv: renderInv, char: renderChar, journal: renderJournal, map: renderMapWin, build: renderBuild, bld: renderBld, camp: renderCamp, inst: renderInst, ship: renderShip, help: renderHelp, trader: renderTrader, enc: renderEnc }[cur.kind];
  if (f) f();
}
export function onChar() { renderHUD(); if (cur && ['guide', 'inv', 'char', 'bld', 'camp', 'ship', 'build', 'trader', 'econ', 'army'].includes(cur.kind)) render(); }
export function onWorld() { if (cur && cur.kind !== 'map') render(); }
// ---------- Военное дело (U) ----------
function renderArmy() {
  const c = S.char, w = S.world; if (!c || !c.army) return;
  const A = c.army, MR = D.MIL_RANKS, mi = A.mil, next = MR[mi + 1];
  $('mtitle').textContent = 'Военное дело';
  tabs([['sq', `⚔ Отряды (${A.squads.length}/${A.limit})`], ['guard', '🛡 Телохранитель'], ['fleet', '⛵ Боевые корабли'], ['glory', '🏆 Заслуги']]);
  if (cur.tab === 'glory') {
    const kills = c.kills || {}, sum = (f) => Object.entries(kills).filter(([k]) => ENEMIES[k] && ENEMIES[k].faction === f).reduce((a, [, n]) => a + n, 0);
    setHTML($('mbody'), `<div class="card"><div class="t">${MR[mi].name}</div><div class="stat"><span>Военные заслуги</span><span>${A.milPts}${next ? ` / ${next.pts} до «${next.name}»` : ''}</span></div>${next ? `<div class="prog"><div style="width:${Math.min(100, (A.milPts - MR[mi].pts) / (next.pts - MR[mi].pts) * 100)}%"></div></div>` : ''}<div class="muted">Заслуги дают за победы над карфагенянами, варварами и пиратами — самому, отрядами или на корабле (потопленный корабль Карфагена — 15). Военное звание открывает больше отрядов.</div></div>
      <div class="row"><span class="grow">Карфагеняне и сиракузцы</span><b>${sum('punic')}</b></div><div class="row"><span class="grow">Варвары</span><b>${sum('barbarian')}</b></div><div class="row"><span class="grow">Пираты</span><b>${sum('pirate')}</b></div><div class="row"><span class="grow">Разбойники</span><b>${sum('robber')}</b></div>
      <h3 class="sec">Военные звания</h3>` + MR.map((r, i) => `<div class="row" style="${i === mi ? 'color:var(--gold2)' : ''}"><span class="grow">${r.name}</span><span class="muted">от ${r.pts} заслуг · отрядов: ${r.squads}</span></div>`).join(''));
    return;
  }
  if (cur.tab === 'fleet') { const war = w.ships.filter((s) => s.owner === c.id && SHIPS[s.type].ram); setHTML($('mbody'), `<div class="card"><div class="muted">Боевым кораблём управляет один — тот, кто у руля. Улучшения: обшивка, паруса и вёсла (рабы-гребцы), таран; на позиции лучников сажают рабов. Для торговых путей военные корабли — охрана от пиратов.</div></div>` + (war.map((s) => shipCardHtml(s, true)).join('<hr class="sep">') || '<div class="muted">Боевых кораблей нет (либурна, трирема, квадрирема, пентера — на верфи).</div>')); return; }
  if (cur.tab === 'guard') {
    const G2 = A.guard, mine = S.blds.filter((b) => b.owner === c.id && b.built && !BUILDINGS[b.type].road);
    const ord = (m, t) => `<button class="btn sm ${G2 && G2.mode === m ? 'good' : ''}" data-a="guardOrd" data-m="${m}">${t}</button>`;
    setHTML($('mbody'), `<div class="card"><div class="t">🛡 Телохранитель</div><div class="muted">Нанимают в Арсенале города — только должностные лица (префект, эдил, легат, сенатор и др.). Плата — ${D.GUARD_PRICE} ден. за каждый день службы (первый день — при найме). Нечем платить — уходит.</div></div>` + (G2 ? `<div class="row"><span class="grow">${G2.alive ? '🛡 На службе' : G2.out ? 'ранен, скоро вернётся' : 'отдыхает'}${G2.pay != null ? ` · следующая плата через ${fmtT(G2.pay)}` : ''}</span><button class="btn sm" data-a="guardToggle">${G2.out ? 'Отпустить отдыхать' : 'Позвать'}</button><button class="btn sm bad" data-a="guardFire">Рассчитать</button></div>
      <h3 class="sec">Приказ</h3><div class="row">${ord('follow', 'За мной')}${ord('hold', 'Стоять здесь')}${ord('home', 'Охранять дом')}</div>
      <h3 class="sec">Охранять постройку</h3>${mine.map((b) => `<div class="row"><span class="grow">${BUILDINGS[b.type].name}</span><button class="btn sm ${G2.mode === 'bld' && G2.bid === b.id ? 'good' : 'alt'}" data-a="guardOrd" data-m="bld" data-bid="${b.id}">Охранять</button></div>`).join('') || '<div class="muted">Своих построек нет.</div>'}` : `<button class="btn" data-a="guardHire" ${A.office ? '' : 'disabled title="Нужна должность"'}>Нанять (у Арсенала, ${D.GUARD_PRICE} ден./день)</button>`)); return; }
  const rows = A.squads.map((q, i) => { const S2 = D.SQUADS[q.type], up = q.up || {};
    const ups = Object.entries(D.SQUAD_UP).map(([k, U]) => { const lv = up[k] || 0; return lv < U.max ? `<button class="btn sm alt" data-a="squadUp" data-id="${q.id}" data-k="${k}" title="${U.desc}: ${U.den(lv + 1)} ден. + ${Object.entries(U.cost(lv + 1)).map(([r, n]) => resName(r) + ' ×' + n).join(', ')}">${U.name} ${lv}→${lv + 1}</button>` : `<span class="tag">${U.name} ${lv}</span>`; }).join(' ');
    return `<div class="card"><div class="t">${i + 1}. ${S2.icon} ${esc(q.name)} <span class="tag">ур. ${q.lvl}</span> <span class="tag">${q.live ? `на поле ${q.live}/${q.size}` : q.homeAway ? 'дома (призвать у военных зданий)' : 'в претории'}</span> <span class="tag">${q.form === 'tight' ? 'сомкнутый' : q.form === 'line' ? 'линия' : 'рассыпной'}</span>${q.left != null ? ` <span class="tag">💰 уйдут через ${fmtT(q.left)}</span>` : ''}${q.slaves ? ' <span class="tag">из рабов</span>' : ''}</div><div class="muted">${S2.desc} ${q.stats ? `HP бойца ${q.stats.hp} · урон ${Math.round(q.stats.damage)} · броня ${Math.round(q.stats.armor)} · дальность ${q.stats.range} · скорость ${q.stats.speed.toFixed(1)}.<br>` : ''}Воинов: ${q.size} · побед: ${q.kills} · потерь: ${q.lost}</div>
      <div class="row">${q.replacementCost ? `<button class="btn sm good" data-a="squadReinforce" data-id="${q.id}">Пополнить: ${q.replacementCost} ден.</button>` : ''}${ups}</div><div class="row"><button class="btn sm good" data-a="squadOut" data-id="${q.id}" ${q.live ? 'disabled' : ''}>Вызвать</button><button class="btn sm alt" data-a="squadHome" data-id="${q.id}" ${q.live ? '' : 'disabled'}>🏠 Домой</button><button class="btn sm" data-a="squadOrd" data-id="${q.id}" data-m="follow">За мной</button><button class="btn sm" data-a="squadOrd" data-id="${q.id}" data-m="hold">Стоять</button><button class="btn sm" data-a="squadForm" data-id="${q.id}" data-f="${q.form === 'line' ? 'loose' : 'line'}">${q.form === 'line' ? 'Врассыпную' : 'Стеной'}</button><span class="grow"></span><button class="btn sm alt" data-a="squadDisband" data-id="${q.id}">Распустить</button></div></div>`; }).join('');
  const shop = Object.entries(D.SQUADS).map(([k, S2]) => { const no = (!A.praetorium && !S2.merc) || A.squads.length >= A.limit || c.rank < S2.rank;
    return `<div class="row"><span class="nm" style="width:230px">${S2.icon} ${S2.name}</span><span class="grow muted">${S2.desc} (${S2.n} воинов${S2.rank ? `, от звания «${RANKS[S2.rank].name}»` : ''}${S2.merc ? `, ${S2.upkeep} ден./мин` : ''})</span><span class="nm">${S2.price} ден.</span><button class="btn sm" data-a="squadRecruit" data-k="${k}" ${no ? 'disabled' : ''}>${S2.merc ? 'Нанять' : 'Набрать'}</button>${S2.merc ? '' : `<button class="btn sm alt" data-a="squadRecruit" data-k="${k}" data-slaves="1" ${no || (A.freeSlaves || 0) < S2.n ? 'disabled' : ''} title="Воинами станут ${S2.n} ваших свободных рабов (сейчас ${A.freeSlaves || 0}); павший — потерянный раб">Из рабов · ${Math.round(S2.price * D.SLAVE_SQUAD_K)} ден.</button>`}</div>`; }).join('');
  setHTML($('mbody'), `<div class="card"><div class="muted">Отряды набирают из вольных людей у своего Претория на латифундии. Можно держать: ${A.limit} (военное звание «${MR[mi].name}», гражданское звание и должность легата добавляют). Управление: 1–5 — выбрать отряд (значки над поясом), 0 — отменить все приказы, N — идти к прицелу, O — за мной, 6 — стоять, L — строй, Z — вид сверху: ПКМ по земле — идти, ПКМ по врагу — атаковать (пехота и конница идут в атаку строем, лучники и скорпионы стреляют издали). 🏠 — отправить домой (призвать снова — у Претория, в Казармах или Арсенале). Убитые отрядами и телохранителем враги дают вам опыт, добычу и военные очки.</div></div>${rows || ''}<h3 class="sec">Набрать отряд${A.praetorium ? '' : ' — нужен Преторий на латифундии'}</h3>${shop}`);
}
// ---------- Хозяйство и торговля (K) ----------
function renderEcon() {
  const c = S.char, w = S.world; if (!c) return;
  $('mtitle').textContent = 'Хозяйство и торговля';
  tabs([['sea', '⛵ Морские пути'], ['land', '🐂 Караваны'], ['own', '🏰 Владения'], ['posts', '📦 Посты и заказы'], ['slaves', `👥 Рабы и работники (${(w.slaves || []).length})`], ['ledger', '📒 Доходы и расходы']]);
  const my = S.blds.filter((b) => b.owner === c.id);
  const posts = my.filter((b) => b.built && (b.type === 'emporium' || b.type === 'statio'));
  const crateOpts = (sel) => `<option value="">любые ящики</option>` + Object.keys(D.CRATES).map((k) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${crateName(k)}</option>`).join('');
  if (cur.tab === 'sea' || cur.tab === 'land') {
    const kind = cur.tab, list = (c.routes || []).filter((r) => r.kind === kind);
    const ST = { idle: 'стоит', load: 'грузится на посту', go: 'в пути', back: 'возвращается' };
    const rows = list.map((r) => {
      const ships = kind === 'sea' ? w.ships.filter((s) => s.owner === c.id).map((s) => { const on = (r.ships || []).includes(s.id); return `<button class="btn sm ${on ? 'good' : 'alt'}" data-a="routeShip" data-rid="${r.id}" data-sid="${s.id}" data-on="${on ? 0 : 1}" title="${SHIPS[s.type].ram ? 'военный — охрана' : 'торговый — везёт ' + SHIPS[s.type].crates + ' ящ.'}">${on ? '✔ ' : ''}${esc(s.name)}</button>`; }).join(' ') : '';
      const comp = kind === 'sea' ? `<div class="row"><span class="nm" style="width:120px">Корабли</span><span class="grow">${ships || '<span class="muted">своих кораблей нет</span>'}</span></div>`
        : `<div class="row"><span class="nm" style="width:120px">Повозки</span><span class="grow">${r.wagons} × ${4} ящ.</span><button class="btn sm alt" data-a="routeWagons" data-rid="${r.id}" data-n="${r.wagons - 1}">−</button><button class="btn sm" data-a="routeWagons" data-rid="${r.id}" data-n="${r.wagons + 1}" title="${160} ден.">+ (160 ден.)</button></div><div class="row"><span class="nm" style="width:120px">Охрана</span><span class="grow">${r.guards} вольных людей (6 ден. за рейс каждый)</span><button class="btn sm alt" data-a="routeGuards" data-rid="${r.id}" data-n="${r.guards - 1}">−</button><button class="btn sm" data-a="routeGuards" data-rid="${r.id}" data-n="${r.guards + 1}">+</button></div>`;
      return `<div class="card"><div class="t">${kind === 'sea' ? '⛵' : '🐂'} → ${esc(r.destName)} <span class="tag">${ST[r.state] || r.state}${r.load ? ` · ${r.load} ящ.` : ''}</span> <span class="tag">${r.on ? 'работает' : 'остановлен'}</span></div>
        <div class="muted">Вместимость: ${r.cap} ящ. · охрана: ${r.guardsEff} · рейсов ${r.trips} · выручка ${r.earned} ден. · потеряно ${r.lost} ящ.</div>${comp}
        <div class="row"><span class="nm" style="width:120px">Груз</span><select data-a2="routeCargo" data-rid="${r.id}">${crateOpts(r.cargo)}</select><span class="grow"></span><button class="btn sm ${r.on ? 'alt' : 'good'}" data-a="routeToggle" data-rid="${r.id}">${r.on ? 'Остановить' : 'Запустить'}</button><button class="btn sm alt" data-a="routeDel" data-rid="${r.id}">Закрыть путь</button></div></div>`;
    }).join('') || `<div class="muted">Путей пока нет.</div>`;
    const kp = posts.filter((b) => b.type === (kind === 'sea' ? 'emporium' : 'statio'));
    const dests = (c.dests && c.dests[kind]) || [];
    const make = kp.length ? `<div class="card"><div class="t">Новый путь (${(c.routes || []).length} / ${c.routeLimit || 1})</div><div class="row"><span class="nm" style="width:120px">Откуда</span><select id="rtPost">${kp.map((b) => `<option value="${b.id}">${BUILDINGS[b.type].name} #${b.id}</option>`).join('')}</select><span class="nm" style="width:80px;margin-left:10px">Куда</span><select id="rtDest">${dests.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}</select><button class="btn good" data-a="routeNew">Открыть путь</button></div></div>`
      : `<div class="card muted">Сначала постройте ${kind === 'sea' ? 'морской торговый пост (на латифундии у моря или у своей колонии)' : 'сухопутный торговый пост на латифундии (караваны ходят только по римским дорогам)'}.</div>`;
    setHTML($('mbody'), `<div class="card"><div class="muted">${kind === 'sea' ? 'Морской путь возит ящики со склада вашего морского поста к торговцам островов, в римские гавани и в Остию (Рим). Торговые корабли везут груз, военные — охраняют от пиратов (на них можно посадить рабов-лучников).' : 'Караван — повозки с ящиками, которые идут только по римским дорогам от вашего поста к лавкам рынков римских городов. Охрана из вольных людей бережёт от разбойников.'} Ящики на склад поста собирают ваши работники по заказу (вкладка «Посты и заказы»).</div></div>${make}${rows}`);
    return;
  }
  if (cur.tab === 'posts') {
    const html = posts.map((b) => { const ord = b.orders || {}, cr = b.crates || {};
      return `<div class="card"><div class="t">${BUILDINGS[b.type].name} #${b.id}</div><div class="muted">На складе: ${Object.entries(cr).filter(([, n]) => n > 0).map(([k, n]) => `${crateName(k)} ×${n}`).join(', ') || 'пусто'}</div>` + Object.keys(D.CRATES).map((k) => `<div class="row"><span class="nm" style="width:230px">${crateName(k)}</span><span class="grow muted">${costHtml(D.CRATES[k].in, {})}</span><span style="width:90px">заказ: ${ord[k] || 0}</span><input id="ord_${b.id}_${k}" class="num" value="${ord[k] || 5}"><button class="btn sm" data-a="crateOrder" data-post="${b.id}" data-k="${k}">Заказать</button></div>`).join('') + '</div>'; }).join('')
      || '<div class="muted">Торговых постов нет. Морской пост ставят на латифундии у моря или у своей колонии, сухопутный — на латифундии.</div>';
    setHTML($('mbody'), `<div class="card"><div class="muted">Работники (рабы и вольные на ваших хозяйствах рядом) раз в минуту собирают ящики из запасов ваших построек вокруг поста (на латифундии — из всех хозяйств возле виллы, у колонии — из её склада) и кладут на склад поста. Отсюда их забирают торговые пути.</div></div>${html}`);
    return;
  }
  if (cur.tab === 'own') {
    const grp = { lat: my.filter((b) => b.lat || b.type === 'villa'), col: my.filter((b) => b.type === 'colonia'), city: my.filter((b) => b.city && !b.muni) };
    const row = (b) => { const d = BUILDINGS[b.type], canSell = b.type !== 'villa' && b.type !== 'colonia';
      return `<div class="row"><span class="nm" style="width:230px">${d.name}</span><span class="grow muted">${b.built ? '' : 'стройка '}${b.city ? ((S.W.cities.find((x) => x.id === b.city) || {}).name || '') : ''}${b.dmul ? ` · ×${b.dmul}` : ''}${d.rent ? ` · доход ${Math.round(d.rent * (b.dmul || 1))} ден./мин` : ''} ${Object.entries(b.store || {}).filter(([, n]) => n >= 1).map(([k, n]) => `${resName(k)} ${Math.floor(n)}`).join(', ')}</span>${canSell ? `<input id="bs_${b.id}" class="num" value="${b.sale || Math.round(Object.values(b.cost || {}).reduce((a, n) => a + n, 0) * 4)}"><button class="btn sm ${b.sale ? 'good' : 'alt'}" data-a="bldSale" data-bid="${b.id}">${b.sale ? 'Продаётся · изменить' : '🏷 Продать'}</button>${b.sale ? `<button class="btn sm alt" data-a="bldSale" data-bid="${b.id}" data-off="1">Снять</button>` : ''}` : ''}<button class="btn sm alt" data-a="bldDemolish" data-bid="${b.id}" title="Снести: вернётся часть материалов">🔨</button></div>`; };
    setHTML($('mbody'), `<div class="card"><div class="stat"><span>Латифундия</span><span>${c.lat ? 'есть' : `нет (звание «${RANKS[D.LATIFUNDIUM.rank].name}», ${D.LATIFUNDIUM.price} ден.; B → Латифундия → Вилла)`}</span></div><div class="stat"><span>Клетки в городах</span><span>${Object.values(w.plots || {}).filter((o) => o === c.id).length} / ${c.cellLimit}</span></div><div class="stat"><span>Доход с домов и лавок за всё время</span><span>${c.rentGot || 0} ден.</span></div></div>
      <h3 class="sec">📐 Разрешения Эдила и клетки</h3>${permitRows()}
      <h3 class="sec">🏰 Латифундия</h3>${grp.lat.map(row).join('') || '<div class="muted">—</div>'}<h3 class="sec">🚩 Колонии</h3>${grp.col.map(row).join('') || '<div class="muted">—</div>'}<h3 class="sec">🏛 В городах</h3>${grp.city.map(row).join('') || '<div class="muted">—</div>'}`);
    return;
  }
  if (cur.tab === 'ledger') { setHTML($('mbody'), ledgerHtml(c)); return; }
  setHTML($('mbody'), slavesList());
}
// книга доходов и расходов: по игровым дням, по статьям
const ledgerOpen = { '+': true, '-': true };
function ledgerHtml(c) {
  const L = c.ledger || {}, days = Object.keys(L).map(Number).sort((a, b) => b - a);
  if (!days.length) return '<div class="muted">Записей пока нет — доходы и расходы появятся здесь по мере торговли и работы ваших бизнесов.</div>';
  const cats = { '+': new Set(), '-': new Set() }; for (const d of days) for (const k of Object.keys(L[d])) cats[k[0]].add(k.slice(1));
  const cell = (v, sign) => `<td class="${v ? (sign === '+' ? 'ok' : 'no') : 'muted'}">${v ? (v > 0 ? '+' : '') + v : '—'}</td>`;
  const tbl = (sign, title) => { const cs = [...cats[sign]]; if (!cs.length) return '';
    const pre = sign === '+' ? 'Доход: ' : 'Расход: ', open = ledgerOpen[sign];
    const biz = cs.filter((k) => k.startsWith(pre) || k === 'Доход бизнесов'), rest = cs.filter((k) => !biz.includes(k));
    const row = (k, pad = '') => `<tr><td>${pad}${esc(k.replace(pre, ''))}</td>${days.map((d) => cell(L[d][sign + k] || 0, sign)).join('')}</tr>`;
    // здания и бизнесы — одной строкой, по щелчку раскрывается: какое здание и за что
    const bizRows = biz.length ? `<tr class="lgrp" data-a="ledgerBiz" data-s="${sign}" style="cursor:pointer"><td><b>${open ? '▾' : '▸'} ${sign === '+' ? '💼 Доход бизнесов' : '🏗 Расходы на здания и бизнесы'}</b> <span class="muted" style="font-size:12px">(${open ? 'свернуть' : 'щёлкните — подробно'})</span></td>${days.map((d) => cell(biz.reduce((a, k) => a + (L[d][sign + k] || 0), 0), sign)).join('')}</tr>${open ? biz.map((k) => row(k, '&nbsp;&nbsp;&nbsp;&nbsp;↳ ')).join('') : ''}` : '';
    return `<h3 class="sec">${title}</h3><table class="ledger"><tr><th>Статья</th>${days.map((d) => `<th>День ${d}</th>`).join('')}</tr>${bizRows}${rest.map((k) => row(k)).join('')}</table>`; };
  const tot = (d, sign) => Object.entries(L[d]).filter(([k]) => k[0] === sign).reduce((a, [, v]) => a + v, 0);
  const sum = `<table class="ledger"><tr><th>Итог</th>${days.map((d) => `<th>День ${d}</th>`).join('')}</tr><tr><td>Пришло</td>${days.map((d) => `<td class="ok">+${tot(d, '+')}</td>`).join('')}</tr><tr><td>Ушло</td>${days.map((d) => `<td class="no">${tot(d, '-')}</td>`).join('')}</tr><tr><td><b>Разница</b></td>${days.map((d) => { const v = tot(d, '+') + tot(d, '-'); return `<td><b class="${v >= 0 ? 'ok' : 'no'}">${v >= 0 ? '+' : ''}${v}</b></td>`; }).join('')}</tr></table>`;
  return `<div class="card"><div class="muted">Сколько денег пришло и ушло за каждый игровой день (сутки — 20 минут; хранятся последние 8 дней). Сейчас день ${S.world.day}.</div></div>${sum}${tbl('+', '💰 Доходы')}${tbl('-', '💸 Расходы')}`;
}
// разрешения по городам: разметить купленные клетки можно отсюда, не возвращаясь в курию
function permitRows() {
  const c = S.char, pm = c.permits || {}, by = {};
  for (const [k, n] of Object.entries(pm)) { const [cid, d] = k.split(':'); (by[cid] = by[cid] || []).push(`${D.DISTRICTS[d] ? D.DISTRICTS[d].name : d}: ${n}`); }
  const mine = {}; for (const k of Object.entries(S.world.plots || {}).filter(([, o]) => o === c.id).map(([k]) => k.split(':')[0])) mine[k] = (mine[k] || 0) + 1;
  const ids = [...new Set([...Object.keys(by), ...Object.keys(mine)])];
  return ids.map((cid) => { const Cy = S.W.cities.find((x) => x.id === cid); return `<div class="row"><span class="nm" style="width:150px">${Cy ? Cy.name : cid}</span><span class="grow muted">разрешения: ${(by[cid] || ['нет']).join(', ')} · размечено: ${mine[cid] || 0}</span>${by[cid] ? `<button class="btn sm good" data-a="claimMode" data-city="${cid}">📐 Разметить</button>` : ''}${mine[cid] ? `<button class="btn sm alt" data-a="release" data-city="${cid}">Освободить пустые</button>` : ''}</div>`; }).join('') || '<div class="muted">Разрешений нет. Купите их у Эдила в Курии города: сбор за разрешение небольшой, а каждая клетка оплачивается при разметке по своей цене (у форума и гавани — дороже).</div>';
}
// ---------- Поход на город ----------
export function openCity(id) { open('city', { key: id }); }
export function openWar() { open('war'); }
export function openRatings() { open('ratings'); }
// ---------- Поле Марса: лобби у распорядителя игр ----------
function renderWar() {
  const c = S.char, w = S.world, Wd = (w && w.war) || { lobbies: [], top: [] };
  $('mtitle').textContent = '🏟 Поле Марса — распорядитель игр'; tabs([['lob', '⚔ Бои и лобби'], ['army', '🛡 Отряды на бой'], ['top', '🏆 Рейтинг полководцев']]);
  if (cur.tab === 'top') { setHTML($('mbody'), warTopHtml(Wd.top)); return; }
  const own = ((c.army && c.army.squads) || []).filter((q) => !q.war), rent = c.warRent || [], pool = [...own, ...rent], pick = c.warPick || [], FL = (S.W.war && S.W.war.fields) || [];
  const chosen = pick.length ? pool.filter((q) => pick.includes(q.id)) : pool.slice(0, D.WAR.maxSquads);
  if (cur.tab === 'army') {
    const row = (q) => { const on = chosen.includes(q); const S2 = D.SQUADS[q.type] || {}; return `<div class="row"><span class="grow">${S2.icon || '⚔'} <b>${esc(q.name)}</b> <span class="muted">${S2.name || ''}${q.rent ? ' · аренда на один бой' : q.merc ? ' · наёмники' : ' · свой отряд'}</span></span><button class="btn sm ${on ? 'good' : 'alt'}" data-a="warPickT" data-id="${q.id}">${on ? '✔ идёт в бой' : 'Взять в бой'}</button></div>`; };
    setHTML($('mbody'), `<div class="card"><div class="muted">В бой идут до ${D.WAR.maxSquads} отрядов: ваши собственные, наёмники и отряды, взятые здесь в аренду на один бой (после боя аренда кончается). Если ничего не выбрано — идут первые ${D.WAR.maxSquads}. Выбрано: ${chosen.length}/${D.WAR.maxSquads}.</div></div>
      <h3 class="sec">Мои отряды</h3>${own.map(row).join('') || '<div class="muted">Своих отрядов нет.</div>'}
      <h3 class="sec">Арендованные на бой</h3>${rent.map(row).join('') || '<div class="muted">Пока нет.</div>'}
      <h3 class="sec">Взять отряд в аренду на один бой</h3>` + Object.entries(D.WAR.rent).map(([k, R]) => `<div class="row"><span class="grow">${D.SQUADS[k].icon} ${D.SQUADS[k].name} <span class="muted">${D.SQUADS[k].n} воинов</span></span><span class="nm">${R.price} ден.</span><button class="btn sm" data-a="warRent" data-k="${k}" ${c.den < R.price || rent.length >= 4 ? 'disabled' : ''}>Арендовать</button></div>`).join(''));
    return;
  }
  const meIn = Wd.lobbies.some((L) => L.A.includes(c.name) || L.B.includes(c.name));
  const lob = Wd.lobbies.map((L) => {
    const host = L.host === c.name, FZ = FL[L.zone || 0];
    const side = (sd) => { const names = L[sd], bots = L['bot' + sd] || 0, free = L.size - names.length - bots, slots = [];
      for (const n of names) slots.push(`<span class="tag">👤 ${esc(n)}</span>`);
      for (let i = 0; i < bots; i++) slots.push(`<span class="tag">🤖 бот${host && L.state === 'wait' ? ` <button class="btn sm alt" data-a="warBot" data-id="${L.id}" data-side="${sd}" data-on="0">✕</button>` : ''}</span>`);
      for (let i = 0; i < free; i++) slots.push(`<span class="tag muted">свободно${L.state === 'wait' && !meIn ? ` <button class="btn sm" data-a="warJoin" data-id="${L.id}" data-side="${sd}">Занять</button>` : ''}${host && L.state === 'wait' ? ` <button class="btn sm alt" data-a="warBot" data-id="${L.id}" data-side="${sd}" data-on="1">🤖 бот</button>` : ''}</span>`);
      if (L.state === 'wait' && !meIn && free <= 0 && bots > 0) slots.push(`<button class="btn sm" data-a="warJoin" data-id="${L.id}" data-side="${sd}">Занять место бота</button>`);
      return slots.join(' '); };
    return `<div class="card"><div class="t">Бой ${L.size} на ${L.size} <span class="tag">🏟 ${FZ ? FZ.name : ''}</span> <span class="tag">${L.state === 'fight' ? `идёт бой · ${fmtT(L.left || 0)}${L.cap ? ` · точка: Запад ${L.cap.A}/${L.capNeed}, Восток ${L.cap.B}/${L.capNeed}` : ''}` : 'набор — начнётся, когда все места заняты'}</span>${L.host ? ` <span class="muted">собрал ${esc(L.host)}</span>` : ''}</div><div class="row" style="border:0"><span class="nm" style="width:90px">🟦 Запад</span><span class="grow">${side('A')}</span></div><div class="row" style="border:0"><span class="nm" style="width:90px">🟥 Восток</span><span class="grow">${side('B')}</span></div></div>`; }).join('') || '<div class="muted">Сейчас никто не собирает бой.</div>';
  const zoneSel = `<select id="warZone"><option value="">поле — любое свободное</option>${FL.map((F) => `<option value="${F.id}">${F.name}</option>`).join('')}</select>`;
  const make = `${zoneSel} ${[1, 2, 3].map((n) => `<button class="btn sm ${n === 1 ? 'good' : 'alt'}" data-a="warCreate" data-size="${n}" ${meIn || !pool.length ? 'disabled' : ''}>Собрать бой ${n} на ${n}</button>`).join(' ')}`;
  setHTML($('mbody'), `<div class="card"><div class="muted">Соберите бой 1 на 1, 2 на 2 или 3 на 3: места занимают игроки, а свободные места собравший может отдать ботам (🤖). Бот выставляет столько же отрядов того же размера, что и игрок напротив. В бой идут выбранные вами отряды (вкладка «Отряды на бой», до ${D.WAR.maxSquads}): ${chosen.length ? chosen.map((q) => esc(q.name)).join(', ') : '<b>отрядов нет</b> — наберите, наймите или арендуйте'}. Четыре поля: открытое поле, деревушка, развалины, скалы. Победа — разбить все отряды противника или удержать точку в центре 45 секунд. Бой — до ${Math.round(D.WAR.time / 60)} минут; павшие не теряются. Победа: +${D.WAR.win} военных очков и рейтинг, поражение: +${D.WAR.lose}.</div></div>
    <h3 class="sec">Собрать бой</h3><div>${make}</div>${meIn ? '<div style="margin-top:6px"><button class="btn sm bad" data-a="warLeave">Выйти из записи</button></div>' : ''}
    <h3 class="sec">Лобби</h3>${lob}
    <h3 class="sec">Переправа</h3><button class="btn sm alt" data-a="ferry" data-to="messana">⛵ В гавань Мессаны (${D.WAR.ferry} ден.)</button>`);
}
function warTopHtml(top) { return (top || []).map((r, i) => `<div class="row"><span style="width:26px">${i + 1}.</span><span class="grow">${esc(r.name)}</span><span class="muted" style="width:170px">побед ${r.w} · поражений ${r.l} · ничьих ${r.d}</span><b>${r.r}</b></div>`).join('') || '<div class="muted">Пока никто не сражался на Поле Марса.</div>'; }
// ---------- Рейтинги: рыба, гладиаторы, полководцы Поля Марса ----------
function renderRatings() {
  const w = S.world || {};
  $('mtitle').textContent = '🏆 Рейтинги'; tabs([['fish', '🐟 Рыба'], ['glad', '🛡 Лучшие гладиаторы'], ['war', '⚔ Поле Марса']]);
  if (cur.tab === 'glad') setHTML($('mbody'), (w.gladTop || []).map((g, i) => `<div class="row"><span style="width:26px">${i + 1}.</span><span class="grow">${esc(g.name)} <span class="muted">— гладиатор ${esc(g.owner)}</span></span><span class="muted" style="width:130px">уровень ${g.lvl}</span><b>${g.w} побед</b></div>`).join('') || '<div class="muted">Гладиаторы ещё не выходили на арену.</div>');
  else if (cur.tab === 'war') setHTML($('mbody'), warTopHtml(w.war && w.war.top));
  else setHTML($('mbody'), trophyBoard());
}
function cityHtml(C, full = true) {
  const ci = S.world.cityState && S.world.cityState[C.id]; if (!ci) return '';
  const own = D.OWNER_NAME[ci.owner] || ci.owner, rome = ci.owner === 'rome';
  if (rome) {
    const mine = S.blds.filter((b) => b.city === C.id && b.muni), ok = mine.filter((b) => b.built).length;
    return `<div class="card"><div class="t">🦅 ${C.name} — под властью Рима</div><div class="muted">Восстановлено зданий: ${ok} из ${mine.length}. Руины восстанавливают так же, как стройку: несите материалы (E у здания).</div><div class="prog"><div style="width:${mine.length ? ok / mine.length * 100 : 0}%"></div></div></div>`;
  }
  const T = D.CAMPAIGN.tasks;
  const rows = ['spy', 'plunder', 'caravan', 'fleet'].filter((k) => ci.need[k]).map((k) => { const n = (ci.tasks && ci.tasks[k]) || 0, need = ci.need[k]; return `<div class="row"><span class="nm" style="width:230px">${T[k].icon} ${T[k].name}</span><span style="width:70px" class="${n >= need ? 'ok' : ''}">${Math.min(n, need)} / ${need}</span><span class="muted grow">${T[k].desc}</span><span class="tag">−${T[k].def} за раз</span></div>`; }).join('');
  return `<div class="card"><div class="t">${C.name} — ${own}</div><div class="stat"><span>Обороноспособность</span><span>${ci.def} / 100</span></div><div class="prog"><div style="width:${ci.def}%;background:#c0503a"></div></div>
    <div class="muted">Уровень гарнизона: ${D.CAMPAIGN.lvl[C.id] || '?'}. Каждая выполненная задача снижает оборону. Когда она упадёт до нуля — начинайте штурм у ворот.</div></div>
    ${full ? `<h3 class="sec">Задачи похода</h3>${rows}<h3 class="sec">⚔ Штурм</h3><div class="row"><span class="grow muted">${T.assault.desc}${ci.assault ? ' <b style="color:#ff8a6a">Штурм идёт!</b>' : ''}</span><button class="btn good" data-a="assault" data-city="${C.id}" ${ci.def > 0 || ci.assault ? 'disabled' : ''}>Начать штурм</button></div>` : ''}`;
}
function renderCity() {
  const C = (S.W.cities || []).find((x) => x.id === cur.key); if (!C) { closeModal(); return; }
  $('mtitle').textContent = '🏛 ' + C.name; tabs([['c', '⚔ Поход на город']]);
  setHTML($('mbody'), cityHtml(C));
}
// походы: каждый город раскрывается — что нужно сделать, как и что уже сделано
const campOpen = new Set();
document.addEventListener('toggle', (e) => { const d = e.target; if (d && d.classList && d.classList.contains('campd')) { if (d.open) campOpen.add(d.dataset.city); else campOpen.delete(d.dataset.city); } }, true);
function campDetail(C) {
  const ci = S.world.cityState && S.world.cityState[C.id]; if (!ci) return '';
  if (ci.owner === 'rome') {
    const mine = S.blds.filter((b) => b.city === C.id && b.muni);
    const rows = mine.map((b) => `<div class="row"><span class="grow">${b.built ? '✔' : '🏚'} ${BUILDINGS[b.type].name}</span><span class="muted">${b.built ? 'восстановлено' : `руины · собрано ${Math.round(progOf(b) * 100)}%`}</span></div>`).join('');
    return `<div class="muted" style="margin:6px 0">Как: подойдите к руинам и нажмите E — несите материалы из сумки или со склада. Здания восстанавливают все вместе.</div>${rows}`;
  }
  const T = D.CAMPAIGN.tasks;
  const rows = ['spy', 'plunder', 'caravan', 'fleet'].filter((k) => ci.need[k]).map((k) => { const n = (ci.tasks && ci.tasks[k]) || 0, need = ci.need[k], done = n >= need;
    return `<div class="card" style="${done ? 'border-color:#5a8a4a' : ''}"><div class="t">${done ? '✔' : '▫'} ${T[k].icon} ${T[k].name} — ${Math.min(n, need)} / ${need}</div><div class="prog"><div style="width:${Math.min(1, n / need) * 100}%"></div></div><div class="muted"><b>Как:</b> ${T[k].desc} Каждый раз оборона −${T[k].def}.</div></div>`; }).join('');
  const spied = Object.keys(ci.spied || {}).length, burnt = Object.keys(ci.burnt || {}).length;
  return `<div class="muted" style="margin:6px 0">Осмотрено тайников: ${spied} из ${C.spies.length} · разграблено усадеб: ${burnt} из ${C.suburbs.length}. Тайники и усадьбы — у стен города (ищите метки рядом с ним на карте). Каждый павший воин города (стража, охрана усадеб и обозов) — ещё оборона −${D.CAMPAIGN.killDef}.</div>${rows}
    <div class="card"><div class="t">${ci.def > 0 ? '▫' : '▶'} ⚔ Штурм</div><div class="muted"><b>Как:</b> ${T.assault.desc}${ci.def > 0 ? ` Сейчас оборона ${ci.def} — сначала задачи выше.` : ' Оборона сломлена — идите к воротам (E) или нажмите кнопку.'}${ci.assault ? ' <b style="color:#ff8a6a">Штурм идёт!</b>' : ''}</div><div style="margin-top:6px"><button class="btn sm good" data-a="assault" data-city="${C.id}" ${ci.def > 0 || ci.assault ? 'disabled' : ''}>Начать штурм</button></div></div>`;
}
export function campaignHtml() {
  return (S.W.cities || []).map((C) => `<details class="campd" data-city="${C.id}" ${campOpen.has(C.id) ? 'open' : ''}><summary>${cityHtml(C, false)}</summary><div style="padding:0 6px 10px 14px">${campDetail(C)}</div></details>`).join('');
}
let chanT = null;
export function channel(m) {
  let el = $('chanbar');
  if (!el) { el = document.createElement('div'); el.id = 'chanbar'; el.innerHTML = '<div class="t"></div><div class="prog"><div></div></div>'; document.body.appendChild(el); }
  clearInterval(chanT);
  if (!m.t) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden'); el.querySelector('.t').textContent = m.text || '';
  const t0 = performance.now(), bar = el.querySelector('.prog > div');
  chanT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / (m.t * 1000)); bar.style.width = k * 100 + '%'; if (k >= 1) { clearInterval(chanT); setTimeout(() => el.classList.add('hidden'), 300); } }, 50);
}
export function onBlds() { if (cur && (cur.kind === 'bld' || cur.kind === 'build')) render(); }

// ---------- Инвентарь ----------
function renderInv() {
  const c = S.char; if (!c) return;
  $('mtitle').textContent = 'Снаряжение и сумка';
  tabs([['gear', '⚔ Снаряжение'], ['bag', '🎒 Сумка'], ['ships', '⛵ Мои корабли']]);
  if (cur.tab === 'ships') { setHTML($('mbody'), myShipsHtml()); return; }
  // ячейки как в MMORPG: квадраты со значком и количеством; щелчок — выбрать, внизу — действия
  const gIco = (it) => { const g = GEAR[it.k]; return gearIcon(g.slot, g.kind); };
  const slotHtml = (key, inner, n, q, title, sel) => `<div class="slot q${q || 0}${sel ? ' sel' : ''}" data-a="invSel" data-key="${key}" title="${esc(title)}">${inner}${n != null ? `<span class="n">${n}</span>` : ''}</div>`;
  const sel = cur.sel || null;
  if (cur.tab === 'gear') {
    const w = c.gear.weapon && GEAR[c.gear.weapon.k];
    const eq = Object.keys(SLOT_NAMES).map((s) => { const it = c.gear[s]; return `<div class="eqcell"><div class="eqlbl">${SLOT_NAMES[s]}</div>${it ? slotHtml('eq:' + s, gIco(it), null, it.q, GEAR[it.k].name, sel === 'eq:' + s) : `<div class="slot empty" title="${SLOT_NAMES[s]}: пусто"></div>`}</div>`; }).join('');
    const cells = c.items.map((it) => slotHtml('it:' + it.uid, gIco(it), null, it.q, `${GEAR[it.k].name} — ${gearStats(it)}`, sel === 'it:' + it.uid)).join('') + '<div class="slot empty"></div>'.repeat(Math.max(0, 24 - c.items.length));
    let det = '<div class="muted">Выберите вещь, чтобы увидеть её и надеть или снять.</div>';
    if (sel && sel.startsWith('eq:')) { const sl = sel.slice(3), it = c.gear[sl]; if (it) det = `<div class="itemName">${gearName(it)}</div><div class="muted">${SLOT_NAMES[sl]} · ${gearStats(it)}</div><div class="acts"><button class="btn sm alt" data-a="unequip" data-slot="${sl}">Снять</button></div>`; }
    if (sel && sel.startsWith('it:')) { const it = c.items.find((x) => String(x.uid) === sel.slice(3)); if (it) { const g = GEAR[it.k]; det = `<div class="itemName">${gearName(it)}</div><div class="muted">${SLOT_NAMES[g.slot]} · ${gearStats(it)}</div><div class="acts"><button class="btn sm" data-a="equip" data-uid="${it.uid}">Надеть</button>${g.bound ? '' : `<button class="btn sm alt" data-a="dropGear" data-uid="${it.uid}">Выбросить</button>`}</div>`; } }
    setHTML($('mbody'), `<div class="cols"><div><h3 class="sec">На персонаже</h3><div class="eqgrid">${eq}</div>
      <div class="card" style="margin-top:12px"><div class="stat"><span>Броня</span><span>${c.armor}%</span></div><div class="stat"><span>Урон оружия</span><span>${w ? Math.round((w.dmg || 0) * QUALITY[c.gear.weapon.q || 0].mul) : 7}</span></div><div class="stat"><span>Замедление от доспехов</span><span>${Math.round((c.slow || 0) * 100)}%</span></div><div class="stat"><span>Стрелы / пилумы</span><span>${c.bag.arrow || 0} / ${c.bag.pilum || 0}</span></div></div>
      <div class="muted">Топор и кирка работают из сумки. Удочку и факел (T) берут в руки.</div></div>
      <div><h3 class="sec">Вещи (${c.items.length}/24)</h3><div class="invgrid">${cells}</div><div class="invdet">${det}</div></div></div>`);
  } else {
    const food = Object.keys(c.bag).filter((k) => RES[k] && RES[k].food && c.bag[k] > 0);
    const ents = Object.entries(c.bag).filter(([, n]) => n >= 1).sort((a, b) => (RES[a[0]]?.name || '').localeCompare(RES[b[0]]?.name || ''));
    const cells = ents.map(([k, n]) => slotHtml('r:' + k, hasIcon(k) ? icon(k) : `<span style="font-size:22px">${RES[k]?.icon || '?'}</span>`, Math.floor(n), 0, `${RES[k]?.name || k} ×${Math.floor(n)} · ${Math.round((RES[k]?.w || 0) * n * 10) / 10} кг`, sel === 'r:' + k)).join('') + '<div class="slot empty"></div>'.repeat(Math.max(0, 30 - ents.length));
    let det = '<div class="muted">Выберите предмет в ячейке.</div>';
    if (sel && sel.startsWith('r:')) { const k = sel.slice(2), n = Math.floor(c.bag[k] || 0); if (n > 0) det = `<div class="itemName">${resName(k)} ×${n}</div><div class="muted">вес ${Math.round((RES[k]?.w || 0) * n * 10) / 10} кг · цена ~${RES[k]?.p || 0} ден./шт.</div><div class="acts">${RES[k] && RES[k].food ? `<button class="btn sm good" data-a="eat" data-res="${k}">Съесть</button>` : ''}${k === 'wheat' && c.horseOut ? '<button class="btn sm" data-a="horseFeedA">Покормить коня</button>' : ''}<button class="btn sm alt" data-a="dropRes" data-res="${k}" data-n="1">Выбросить 1</button><button class="btn sm alt" data-a="dropRes" data-res="${k}" data-n="${n}">Выбросить все</button></div>`; }
    const tunaCarry=c.tunaCarry?`<div class="card"><b>В руках: тунец ${c.tunaCarry.kg} кг</b><p>Отнесите в гавань → Рыбный причал, либо верните на свободный борт баркаса через G → Корабль.</p></div>`:'';
    const carry = c.carry ? `<div class="card"><div class="t">В руках: 📦 ${crateName(c.carry)}</div><div class="muted">X — поставить на землю. E у корабля — погрузить. Продаётся торговцам.</div></div>` : '';
    setHTML($('mbody'), `<div class="card"><div class="stat"><span>Нагрузка</span><span>${c.bagW} / ${c.bagMax} кг${c.bagW > c.bagMax ? ' — перегруз!' : ''}</span></div><div class="prog"><div style="width:${Math.min(100, c.bagW / c.bagMax * 100)}%"></div></div><div class="stat"><span>Денарии</span><span>${c.den}</span></div><div class="stat"><span>Обрывки папируса · лоскуты чертежа</span><span>${c.scraps}/5 · ${c.quadScraps || 0}/4</span></div></div>${carry}${tunaCarry}<div class="invgrid">${cells}</div><div class="invdet">${det}</div><div class="muted" style="margin-top:8px">Y — съесть самое подходящее. Еда: ${food.map((k) => RES[k].name).join(', ') || 'нет'}.</div>`);
  }
}
function gearStats(it) { const g = GEAR[it.k]; if (!g) return ''; const m = QUALITY[it.q || 0].mul; if (g.slot === 'weapon') return g.kind === 'rod' ? 'рыбалка' : `урон ${Math.round(g.dmg * m)}`; if (g.slot === 'offhand') return `блок ${Math.round(g.block * 100)}%, броня ${Math.round(g.armor * m)}`; return `броня ${Math.round(g.armor * m)}`; }

// ---------- Персонаж ----------
function renderChar() {
  const c = S.char; if (!c) return;
  $('mtitle').textContent = c.name;
  tabs([['stats', '📜 Характеристики'], ['spec', `🎓 Специализации${c.specPts ? ' (' + c.specPts + ')' : ''}`], ['rank', '🏛 Звание и должности'], ['tro', '🏆 Трофеи']]);
  const d = D.derived({ ...c });
  if (cur.tab === 'stats') {
    const st = Object.entries(STATS).map(([k, s]) => `<div class="row"><span class="nm" style="width:120px">${s.name}</span><b style="width:28px">${c.stats[k]}</b><span class="grow muted">${s.desc}</span>${c.points ? `<button class="btn sm" data-a="stat" data-k="${k}">+1</button>` : ''}</div>`).join('');
    setHTML($('mbody'), `<div class="cols"><div><h3>Уровень ${c.level}</h3><div class="prog"><div style="width:${c.xp / c.need * 100}%"></div></div><div class="muted">${c.xp} / ${c.need} опыта</div>
      <h3 style="margin-top:14px">Характеристики ${c.points ? `<span class="tag" style="color:var(--gold2)">свободно: ${c.points}</span>` : ''}</h3>${st}</div>
      <div><h3>Итог</h3><div class="card">${[['Здоровье', d.maxHp], ['Выносливость', d.maxSt], ['Урон в ближнем бою', '×' + d.melee.toFixed(2)], ['Урон из лука и пилумом', '×' + d.ranged.toFixed(2)], ['Скорость ударов', '×' + d.atkSpeed.toFixed(2)], ['Вместимость сумки', d.bag + ' кг'], ['Цены покупки', Math.round(d.buy * 100) + '%'], ['Цены продажи', Math.round(d.sell * 100) + '%'], ['Броня', c.armor + '%']].map(([a, b]) => `<div class="stat"><span>${a}</span><span>${b}</span></div>`).join('')}</div>
      <h3>Статистика</h3><div class="card">${[['Добыто ресурсов', c.stats2.gathered], ['Вклад в постройки', c.stats2.built], ['Поймано рыбы', c.stats2.fish], ['Побеждено врагов', c.stats2.killed], ['Падений в бою', c.stats2.deaths], ['Оборот торговли', c.stats2.traded + ' ден.']].map(([a, b]) => `<div class="stat"><span>${a}</span><span>${b}</span></div>`).join('')}</div></div></div>`);
  } else if (cur.tab === 'spec') {
    const rows = Object.entries(D.SPECS).map(([k, sp]) => { const lv = D.specOf(c, k); return `<div class="row"><span class="nm" style="width:150px">${sp.icon} ${sp.name}</span><span style="width:110px;letter-spacing:2px;color:var(--gold2)">${'●'.repeat(lv)}<span class="muted">${'○'.repeat(D.SPEC_MAX - lv)}</span></span><span class="grow muted">${sp.desc}<br><span class="${lv >= D.SPEC_MAX ? 'ok' : ''}">★ ${D.SPEC_MAX}-я ступень: ${sp.top}</span></span>${c.specPts && lv < D.SPEC_MAX ? `<button class="btn sm" data-a="spec" data-k="${k}">+1</button>` : ''}</div>`; }).join('');
    setHTML($('mbody'), `<div class="card"><div class="t">Очки специализаций: ${c.specPts || 0}</div><div class="muted">Каждый новый уровень даёт одно очко. В каждой специализации до ${D.SPEC_MAX} ступеней — выбирайте свой путь: торговец, земледелец, воин, мореход…</div></div>${rows}`);
  } else if (cur.tab === 'rank') {
    const offOf = (i) => Object.values(OFFICES).filter((o) => o.minRank === i);
    const rows = RANKS.map((r, i) => `<div class="row" style="${i <= c.rank ? '' : 'opacity:.6'}"><span class="nm" style="width:110px;${i === c.rank ? 'color:var(--gold2);font-weight:700' : ''}">${i <= c.rank ? '✔ ' : ''}${r.name}</span><span class="muted" style="width:96px">от ${r.dig} дост.</span><span class="grow muted">частных построек: ${r.priv}, работников: ${r.slaves}, голос ×${r.vote}${offOf(i).length ? `<br><span style="color:var(--gold2)">открывает должности: ${offOf(i).map((o) => o.icon + ' ' + o.name).join(', ')}</span>` : ''}</span></div>`).join('');
    const next = RANKS[c.rank + 1];
    setHTML($('mbody'), `<div class="card"><div class="t">Звание: ${RANKS[c.rank].name}${(c.offices || []).map((k) => ` · ${OFFICES[k].icon} ${OFFICES[k].name}`).join('')}</div><div class="muted">Достоинство: ${c.dig}${next ? ` — до звания «${next.name}» ещё ${next.dig - c.dig}` : ''}</div>${next ? `<div class="prog"><div style="width:${(c.dig - RANKS[c.rank].dig) / (next.dig - RANKS[c.rank].dig) * 100}%"></div></div>` : ''}</div>
      <div class="muted" style="margin-bottom:8px">Достоинство растёт за вклад в общественные стройки, поставки на склад, запросы Рима, оборону, задания, трофеи и должности. Звание определяет, на какие должности можно выдвигаться на выборах (Форум).</div>${rows}
      <h3 style="margin-top:12px">Должности <span class="muted" style="font-size:12px">(щёлкните — откроется описание)</span></h3>${Object.keys(OFFICES).map((k) => offDetails(k)).join('')}`);
  } else {
    const tr = (c.trophies || []).slice().reverse().map((t) => `<div class="row"><span class="grow">${resName(t.sp)}</span><b>${t.kg} кг</b></div>`).join('') || '<div class="muted">Пока нет трофейных рыб. Ищите косяки в море и ловите крупных!</div>';
    setHTML($('mbody'), `<div class="cols"><div><h3>Мои трофеи</h3>${tr}</div><div><h3>Рекорды колонии</h3>${trophyBoard()}</div></div>`);
  }
}
function trophyBoard() { const w = S.world; if (!w) return ''; return (w.trophies || []).map((t, i) => `<div class="row"><span style="width:22px">${i + 1}.</span><span class="grow">${resName(t.sp)} — ${esc(t.name)}</span><b>${t.kg} кг</b></div>`).join('') || '<div class="muted">Пусто</div>'; }

const evCard = (I) => `<div class="card"><div class="t">${I.icon} ${I.name} <span class="tag">${I.dur}</span></div><div class="muted">Когда: ${I.when}</div><div>${I.what}</div><div><b>Что делать:</b> ${I.todo}</div><div class="muted"><b>Награда:</b> ${I.reward}</div></div>`;
// ---------- Журнал ----------
function renderJournal() {
  const w = S.world, c = S.char; if (!w || !c) return;
  $('mtitle').textContent = 'Журнал';
  tabs([['story', '📖 Сюжет'], ['camp', '⚔ Походы на города'], ['quests', `🗒 Задания (${c.quests.length})`], ['world', '🌍 События'], ['allev', '📋 Возможные события'], ['chron', '📜 Летопись'], ['ruins', '🏛 Развалины']]);
  if (cur.tab === 'ruins') { // развалины древних городов: собранные записи истории
    setHTML($('mbody'), `<div class="card"><div class="muted">На месте погибших Акраганта и Лилибея — развалины. Учёный со снаряжением исследователя (гербарный нож и папка — в Кампусе Мессаны) изучает по порядку четыре места в каждых развалинах (E у руин) и узнаёт всю историю гибели города. За полную историю — ${D.ANCIENT_RUINS[0].reward.den} ден., опыт и одобрение Рима. Развалины отмечены на карте.</div></div>`
      + D.ANCIENT_RUINS.map((R) => { const n = (c.lore || {})[R.id] || 0; return `<div class="card"><div class="t">🏛 ${R.name} <span class="tag">${n}/${R.stages.length}${n >= R.stages.length ? ' · история собрана' : ''}</span></div>${R.stages.map((st, i) => i < n ? `<div style="margin-top:6px"><b>${i + 1}. ${st.title}.</b> ${st.text}</div>` : `<div class="muted" style="margin-top:6px">${i + 1}. ${i === n ? `Следующее место: «${st.title}»` : '???'}</div>`).join('')}</div>`; }).join(''));
    return;
  }
  if (cur.tab === 'allev') {
    setHTML($('mbody'), `<div class="muted" style="margin-bottom:8px">Все события, которые могут случиться на сервере.</div>` + Object.values(D.EVENT_INFO).map((e) => evCard(e)).join(''));
    return;
  }
  if (cur.tab === 'camp') {
    const fb = w.fleetBuilt || {}, rs = w.romeSent || {};
    setHTML($('mbody'), `<div class="card"><div class="t">Флот Республики</div><div class="muted">Построено пентер: ${fb.penteres || 0} / 8 · трирем: ${fb.trireme || 0} / 4</div><div class="t" style="margin-top:6px">Ящики, сданные Риму в Остии</div><div class="muted">Припасы: ${rs.crate1 || 0} / 20 · ремесленные товары: ${rs.crate2 || 0} / 10</div></div>` + campaignHtml());
  } else if (cur.tab === 'story') {
    const list = STORY.map((s, i) => `<div class="card" style="${i === w.story ? 'border-color:var(--gold)' : i > w.story ? 'opacity:.45' : ''}"><div class="t">${i < w.story ? '✔' : i === w.story ? '▶' : '•'} Глава ${i + 1}. ${s.title}</div>${i <= w.story ? `<div>${s.text}</div><div class="muted">Награда всем колонистам: ${s.reward.den} ден., ${s.reward.xp} опыта, ${s.reward.dig} достоинства</div>` : ''}</div>`).join('');
    setHTML($('mbody'), list);
  } else if (cur.tab === 'quests') {
    setHTML($('mbody'), (c.quests.map((q) => `<div class="card"><div class="t">${q.title}</div><div class="muted">${q.desc}</div><div class="prog"><div style="width:${q.got / q.n * 100}%"></div></div><div class="row" style="border:0;padding:4px 0"><span class="grow muted">${q.got}/${q.n} · награда ${q.reward.den} ден., ${q.reward.xp} опыта, ${q.reward.office||5} очк. должности</span><button class="btn sm alt" data-a="questDrop" data-id="${q.id}">Отказаться</button></div></div>`).join('') || '<div class="muted">Нет заданий. Их берут на Форуме, в Таверне или в лагере колонистов.</div>'));
  } else if (cur.tab === 'world') {
    const ev = (w.events || []).map((e) => { const I = D.EVENT_INFO[e.kind === 'raid' ? e.foe : e.kind]; return `<div class="card evc" title="${I ? esc(`${I.what}\nЧто делать: ${I.todo}\nНаграда: ${I.reward}`) : ''}"><div class="t">${I ? I.icon + ' ' : ''}${e.title}</div><div class="muted">${e.text}${(e._end ? e._end - performance.now() / 1000 : e.left) > 0 ? ` · ${e.kind === 'raid' ? 'набег закончится через' : 'осталось'} ${fmtT(e._end ? e._end - performance.now() / 1000 : e.left)}` : ''}</div>${I ? `<div class="evmore"><div>${I.what}</div><div><b>Что делать:</b> ${I.todo}</div><div><b>Награда:</b> ${I.reward}</div></div>` : ''}</div>`; }).join('') || '<div class="muted">Сейчас спокойно. Все возможные события — во вкладке «Возможные события».</div>';
    const rq = (w.requests || []).map((r) => `<div class="card"><div class="t">🦅 Рим просит: ${resName(r.res)} — ${r.got}/${r.n}</div><div class="muted">Осталось ${fmtT(r.left)}. Сдавать на Форуме.</div></div>`).join('');
    setHTML($('mbody'), `<div class="cols"><div><h3>События</h3>${ev}${rq}</div><div><h3>Положение колонии</h3><div class="card">${[['День колонии', w.day], ['Угроза Карфагена', w.threat + '%'], ['Расположение Рима', w.favor + '%'], ['Казна', w.treasury + ' ден.'], ['Гарнизон', w.garrison + ' легионеров'], ['Рекорд арены', w.arenaRecord + ' волн'], ['Онлайн', w.online]].map(([a, b]) => `<div class="stat"><span>${a}</span><span>${b}</span></div>`).join('')}</div>
      <h3>Должности</h3>${Object.keys(OFFICES).map((k) => offDetails(k, `<span class="nm">${w.offices[k] ? esc(w.offices[k].name) : '<span class="muted">свободно</span>'}</span>`)).join('')}
      <h3 style="margin-top:10px">Законы</h3>${Object.entries(LAWS).map(([k, l]) => `<div class="row"><span class="grow">${l.name}</span><span class="nm">${l.opts[w.laws[k] ?? l.def ?? 0]}</span></div>`).join('')}</div></div>`);
  } else {
    setHTML($('mbody'), (w.chronicle || []).map((e) => `<div class="row"><span class="tag">день ${e.day}</span><span class="grow">${esc(e.text)}</span></div>`).join('') || '<div class="muted">Летопись пуста.</div>');
  }
}

// ---------- Стройка ----------
function renderBuild() {
  const c = S.char; if (!c) return;
  $('mtitle').textContent = 'Строительство';
  tabs(D.BUILD_TABS.map(([k, n]) => [k, n]));
  const tabDef = D.BUILD_TABS.find((x) => x[0] === cur.tab) || D.BUILD_TABS[0];
  const built = (t) => S.blds.some((b) => b.type === t && b.built && !b.ruined);
  const exists = (t) => S.blds.some((b) => b.type === t);
  const mine = S.blds.filter((b) => b.owner === c.id && b.type !== 'colonia').length;
  const rk = RANKS[c.rank];
  const isPriv = tabDef[0] === 'priv';
  const entries = (tabDef[2] ? tabDef[2].map((k) => [k, BUILDINGS[k]]) : Object.entries(BUILDINGS).filter(([, d]) => !d.pub && !d.colony));
  const gOrder = D.BUILD_GROUPS.map((g) => g[0]); const grpOf = (k) => D.buildGroupOf(k);
  entries.sort((a, b) => { const ga = gOrder.indexOf(grpOf(a[0])), gb = gOrder.indexOf(grpOf(b[0])); return (ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb); });
  let lastG = null;
  const list = entries.map(([k, d]) => {
    const g = grpOf(k), head = g !== lastG ? `<h3 class="sec bgrp">${g}</h3>` : ''; lastG = g;
    let why = '';
    if (d.need && !d.need.every(built)) why = 'нужно: ' + d.need.filter((x) => !built(x)).map((x) => BUILDINGS[x].name).join(', ');
    else if (d.pub && !d.multi && exists(k)) why = built(k) ? 'построено' : 'уже строится';
    else if (!d.pub && (d.rank || 0) > c.rank) why = `звание «${RANKS[d.rank].name}»`;
    else if (!d.pub && mine >= rk.priv) why = `лимит частных построек (${rk.priv})`;
    const cost = d.pub && S.world && S.world.offices.aedilis ? Object.fromEntries(Object.entries(d.cost).map(([a, n]) => [a, Math.ceil(n * 0.85)])) : d.cost;
    const nC = D.cellsOf(k), cellTag = d.road || d.colony ? '' : d.lat ? '<span class="tag" title="Ставится на латифундии">латифундия</span>' : `<span class="tag" title="Участок из своих клеток ${nC}×${nC} (клетка 4×4 м)">▦ ${nC}×${nC} = ${nC * nC} кл.</span>`;
    return head + `<div class="row"><span class="nm" style="width:230px">${d.name} ${cellTag}${d.prod ? ` <span class="tag">${Object.keys(d.prod).map((x) => resIco(x)).join('')}</span>` : ''}</span><span class="grow muted" title="${esc(d.desc)}">${d.desc}</span><span class="nm" style="font-size:12px">${costHtml(cost, c.cityResources || c.bag)}</span><button class="btn sm" data-a="place" data-bt="${k}" ${why ? 'disabled' : ''} title="${esc(why)}">${why ? esc(why.length > 18 ? why.slice(0, 18) + '…' : why) : 'Поставить'}</button></div>`;
  }).join('');
  setHTML($('mbody'), `<div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button class="btn sm alt" data-a="demolishMode" title="Убрать дорогу, мост или свою постройку (часть материалов вернётся)">🔨 Снос</button></div><div class="muted" style="margin-bottom:8px">${tabDef[0] === 'roads' ? 'Дорогу и мост кладут сразу: ресурсы берутся из сумки и личных складов этого города.' : tabDef[0] === 'colony' ? 'Колония основывается на отмеченном месте острова (E на месте).' : `Постройки ставятся на ваших клетках: разрешение на район покупают у Эдила в Курии, клетки размечают на месте. Вкладка — это район: «Общественные» — в стенах, «При гавани» — у порта, «За стенами» — в полях. Ваших построек: ${mine}/${rk.priv}.`}</div>${list}`);
}
// установка постройки: призрак следует за курсором
// перенос: частное — хозяин; общественное — эдил или префект (если обе должности свободны — любой колонист)
export function canMove(b) {
  const c = S.char, w = S.world, def = BUILDINGS[b.type]; if (!c || !def || def.colony || !b.built) return false;
  if (!def.pub) return b.owner === c.id;
  return hasOff('aedilis') || hasOff('praefectus') || !(w && (w.offices.aedilis || w.offices.praefectus));
}
$('mmove').onclick = () => { const b = cur && cur.kind === 'bld' && S.blds.find((x) => x.id === cur.id); if (b) { startPlacing(b.type, b.id); addLog(`Перенос «${BUILDINGS[b.type].name}»: выберите новое место и нажмите ЛКМ.`, 'info'); } };
export function startPlacing(bt, moveId = null) {
  closeModal();
  const def = BUILDINGS[bt];
  let obj; try { obj = MD.makeBuilding(bt, {}); } catch { obj = new THREE.Mesh(new THREE.CylinderGeometry(def.r, def.r, 1, 24), new THREE.MeshBasicMaterial()); }
  obj.traverse((m) => { if (m.isMesh) { m.material = new THREE.MeshBasicMaterial({ color: 0x88ff88, transparent: true, opacity: 0.35, depthWrite: false }); m.castShadow = false; } if (m.isSprite) m.visible = false; });
  const ring = new THREE.Mesh(new THREE.RingGeometry(def.r - 0.3, def.r, 48), new THREE.MeshBasicMaterial({ color: 0x88ff88, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3; obj.add(ring);
  R.scene.add(obj);
  S.placing = { bt, obj, ry: C.aimYaw ? C.aimYaw() + Math.PI : 0, ok: false, move: moveId };
  addLog(`Стройка «${def.name}»: наведите место и нажмите ЛКМ. Колесо мыши или R — поворот (в городе — на четверть), ПКМ или Esc — отмена.`, 'info');
}
export function cancelPlacing() { if (S.placing) { R.scene.remove(S.placing.obj); if (S.placing.cells) R.scene.remove(S.placing.cells); S.placing = null; } }
// разметка клеток: сетка под курсором; зелёная — можно, синяя — ваша, красная — нельзя
export function startClaim(cityId) {
  closeModal(); cancelPlacing();
  const g = new THREE.Group(); R.scene.add(g);
  S.placing = { claim: cityId, n: 3, obj: g, ry: 0, key: '' };
  addLog('📐 Разметка: колесо — размер участка, ЛКМ — разметить, ПКМ или Esc — выход.', 'info');
}
const cellMat = {}; const cellM = (c) => cellMat[c] || (cellMat[c] = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
const cellGeo = new THREE.PlaneGeometry(D.CELL - 0.25, D.CELL - 0.25); cellGeo.rotateX(-Math.PI / 2);
function drawCells(g, C, i0, j0, w, h, colorOf) {
  while (g.children.length) g.remove(g.children[0]);
  for (let i = i0; i < i0 + w; i++) for (let j = j0; j < j0 + h; j++) { const [x, z] = WG.cellCenter(C, i, j); const m = new THREE.Mesh(cellGeo, cellM(colorOf(i, j))); m.position.set(x, WG.terrainHeight(x, z) + 0.15, z); m.rotation.y = C.ry; g.add(m); }
}
function claimColor(C, i, j) {
  const o = (S.world.plots || {})[`${C.id}:${i}:${j}`];
  if (o) return o === S.char.id ? 0x4a8aff : 0xff4a3a;
  if (!WG.cellFree(C, i, j)) return 0xff4a3a;
  const [x, z] = WG.cellCenter(C, i, j), dd = WG.districtAt(x, z); if (!dd || dd.city !== C.id) return 0xff4a3a;
  return (S.char.permits || {})[C.id + ':' + dd.d] ? 0x6aff6a : 0xffd24a;
}
// режим сноса: наведите на постройку или дорогу и нажмите ЛКМ; ПКМ или Esc — выход
export function startDemolish() {
  closeModal(); cancelPlacing();
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 40), new THREE.MeshBasicMaterial({ color: 0xff5544, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; R.scene.add(ring);
  S.placing = { demolish: true, obj: ring, ry: 0, bt: null };
  addLog('🔨 Снос: наведите на дорогу или свою постройку и нажмите ЛКМ. ПКМ или Esc — выйти.', 'info');
}
function demolishTarget(g) {
  let best = null, bd = 1e9;
  for (const b of S.blds) {
    const d = BUILDINGS[b.type]; if (!d) continue;
    const dx = g.x - b.x, dz = g.z - b.z, c = Math.cos(b.ry || 0), s2 = Math.sin(b.ry || 0), lx = dx * c - dz * s2, lz = dx * s2 + dz * c;
    const inside = d.road ? Math.abs(lx) < d.wid / 2 + 0.4 && Math.abs(lz) < d.len / 2 + 0.2 : Math.hypot(dx, dz) < d.r;
    const dd = Math.hypot(dx, dz); if (inside && dd < bd) { bd = dd; best = b; }
  }
  return best;
}
export function confirmPlacing() {
  const p = S.placing; if (!p || !p.pos) return;
  if (p.demolish) { if (p.target) net({ type: 'demolish', bid: p.target.id }); return; }
  if(p.claim&&p.cityRoad){if(p.blk)net({type:'cityRoad',city:p.claim,i:p.blk.i0,j:p.blk.j0});return;}
  if (p.claim) { if (p.blk) net({ type: 'claim', city: p.claim, i0: p.blk.i0, j0: p.blk.j0, w: p.n, h: p.n }); return; }
  if (p.move) { net({ type: 'moveBld', bid: p.move, x: p.pos.x, z: p.pos.z, ry: p.ry }); cancelPlacing(); return; }
  net({ type: 'place', bt: p.bt, x: p.pos.x, z: p.pos.z, ry: p.ry });
  if (BUILDINGS[p.bt].road && !BUILDINGS[p.bt].bridge) { p.last = { x: p.pos.x, z: p.pos.z, ry: p.ry, t: p.bt }; return; } // дорогу кладём участок за участком
  cancelPlacing();
}
function updatePlacing() {
  const p = S.placing; if (!p) return;
  const g = C.groundPointAtMouse(); if (!g) return;
  if (p.claim) {
    if(p.cityRoad)p.n=1;
    const Cy = WG.cityById(p.claim); const bs = WG.blockSnap(Cy, g.x, g.z, p.n); p.blk = bs; p.pos = g;
    const k = bs.i0 + ':' + bs.j0 + ':' + p.n + ':' + Object.keys(S.world.plots || {}).length + ':' + JSON.stringify(S.char.permits || {})+':'+S.blds.length;
    if (k !== p.key) { p.key = k; drawCells(p.obj, Cy, bs.i0, bs.j0, p.n, p.n, (i,j)=>p.cityRoad?(WG.cityRoadAllowed(Cy,i,j,S.blds,S.world.plots||{})?0x6aff6a:0xff4a3a):claimColor(Cy,i,j)); }
    if(p.cityRoad){setPrompt('Улица 4×4 м · камень ×'+BUILDINGS.via_cell.cost.stone+' · ЛКМ — проложить · Esc — выйти');return;}
    let cost = 0; for (let i = bs.i0; i < bs.i0 + p.n; i++) for (let j = bs.j0; j < bs.j0 + p.n; j++) if (!(S.world.plots || {})[`${Cy.id}:${i}:${j}`] && WG.cellFree(Cy, i, j)) cost += WG.cellPrice(Cy, i, j) || 0;
    const [ci, cj] = WG.cellOf(Cy, g.x, g.z), one = WG.cellPrice(Cy, ci, cj);
    setPrompt(`Участок ${p.n}×${p.n} · ≈${cost} ден. (клетка под курсором — ${one ?? '—'} ден.) · зелёные — по разрешению, жёлтые — нет разрешения, синие — ваши, красные — нельзя`);
    return;
  }
  if (p.demolish) {
    p.pos = g; const b = demolishTarget(g); p.target = b;
    const d = b && BUILDINGS[b.type], r = d ? (d.road ? Math.max(d.wid, d.len) / 2 : d.r) : 1.5;
    p.obj.position.set(b ? b.x : g.x, (b && d.bridge ? WG.bridgeDeckY(b) : WG.terrainHeight(b ? b.x : g.x, b ? b.z : g.z)) + 0.35, b ? b.z : g.z); p.obj.scale.setScalar(r / 2);
    p.obj.material.color.set(b ? 0xff3322 : 0x888888);
    setPrompt(b ? `ЛКМ — снести: ${d.name}` : 'Наведите на дорогу или постройку');
    return;
  }
  const def = BUILDINGS[p.bt];
  if (def.shore) { const sn = WG.shoreSnap(g.x, g.z, def.r, WG.SHORE_FRONT[p.bt]); if (sn) { g.x = sn.x; g.z = sn.z; p.ry = sn.ry; } else { const a = WG.seaDir(g.x, g.z, def.r); if (a != null) p.ry = a; } }
  if (def.bridge) { const a = WG.bridgeRy(g.x, g.z); if (a != null) p.ry = a; }
  else if (def.road) { // примыкание к свободному концу ближайшей дороги (порты участков)
    const segs = S.blds.filter((b) => BUILDINGS[b.type].road && b.id !== p.move).map((b) => ({ x: b.x, z: b.z, ry: b.ry || 0, t: b.type }));
    if (p.last) segs.push(p.last);
    const wp = (b, pt) => { const c = Math.cos(b.ry), s2 = Math.sin(b.ry); return { x: b.x + pt[0] * c + pt[1] * s2, z: b.z - pt[0] * s2 + pt[1] * c, a: b.ry + pt[2] }; };
    let best = null, bd = 5;
    for (const b of segs) for (const pt of BUILDINGS[b.t].ports) {
      const P0 = wp(b, pt);
      if (segs.some((o) => o !== b && BUILDINGS[o.t].ports.some((op) => { const Q = wp(o, op); return Math.hypot(Q.x - P0.x, Q.z - P0.z) < 0.8; }))) continue; // к этому концу уже примыкает дорога
      for (const q of def.ports) {
        const ry = P0.a + Math.PI - q[2]; // наш порт смотрит навстречу
        if (p.turned && Math.abs(Math.atan2(Math.sin(ry - p.ry), Math.cos(ry - p.ry))) > 0.3) continue;
        const c = Math.cos(ry), s2 = Math.sin(ry), x = P0.x - (q[0] * c + q[1] * s2), z = P0.z - (-q[0] * s2 + q[1] * c);
        const d = Math.hypot(x - g.x, z - g.z); if (d < bd) { bd = d; best = { x, z, ry }; }
      }
    }
    if (best) { g.x = best.x; g.z = best.z; p.ry = best.ry; }
  }
  // в городе — по клеткам своего участка, поворот по улицам
  let cellOk = null;
  const dd = !def.road && !def.colony && !(S.char.lat && Math.abs(g.x - S.char.lat.x) < S.char.lat.half && Math.abs(g.z - S.char.lat.z) < S.char.lat.half) ? WG.districtAt(g.x, g.z) : null;
  if (!p.cells) { p.cells = new THREE.Group(); p.obj.parent && p.obj.parent.add(p.cells); }
  if (dd) {
    const Cy = dd.C, n = D.cellsOf(p.bt), bs = WG.blockSnap(Cy, g.x, g.z, n); g.x = bs.x; g.z = bs.z;
    const q = Math.round((p.ry - Cy.ry) / (Math.PI / 2)); p.ry = Cy.ry + q * Math.PI / 2; p.cellSnap = true; // в городе поворот — четвертями (колесо мыши)
    const zones = def.cat === 'any' ? ['center', 'outer', 'harbor', 'extra'] : D.CAT_ZONES[def.cat] || [];
    cellOk = true;
    const k = bs.i0 + ':' + bs.j0 + ':' + n;
    const col = (i, j) => { const o = (S.world.plots || {})[`${Cy.id}:${i}:${j}`]; const [cx, cz] = WG.cellCenter(Cy, i, j), d2 = WG.districtAt(cx, cz); const good = o === S.char.id && d2 && zones.includes(d2.d); if (!good) cellOk = false; return good ? 0x6aff6a : 0xff4a3a; };
    drawCells(p.cells, Cy, bs.i0, bs.j0, n, n, col); p.cellKey = k;
  } else { p.cellSnap = false; if (p.cells.children.length) drawCells(p.cells, WG.CITY_LIST[0], 0, 0, 0, 0, () => 0); }
  p.pos = g;
  const sl = WG.slopeAt(g.x, g.z, def.r * 0.75);
  p.obj.position.set(g.x, (sl.lo + sl.hi) / 2, g.z); p.obj.rotation.y = p.ry;
  let ok = WG.terrainHeight(g.x, g.z) > 0.3 && (def.shore ? !!WG.shoreSnap(g.x, g.z, def.r, WG.SHORE_FRONT[p.bt]) : sl.lo > 0.2 && sl.d < Math.max(3.5, def.r * 0.4));
  if (def.road) ok = (def.bridge ? WG.bridgeRy(g.x, g.z) != null : WG.terrainHeight(g.x, g.z) > 0.5 && WG.slopeAt(g.x, g.z, Math.min(3, def.len / 2)).d < 2.6) && WG.islandAt(g.x, g.z)?.id === 'main' && !S.blds.some((b) => { if (b.id === p.move) return false; const bb = BUILDINGS[b.type], d = Math.hypot(b.x - g.x, b.z - g.z); return bb.road ? d < Math.min(bb.len, def.len) / 2 + 0.5 : d < bb.r + 1.5; });
  else if (ok) for (const b of S.blds) if (b.id !== p.move && overlaps({type:p.bt,x:g.x,z:g.z,ry:p.ry},def,b,BUILDINGS[b.type])) { ok = false; break; }
  if (def.bridge) p.obj.position.y = Math.max(1.1, WG.terrainHeight(g.x + Math.sin(p.ry) * 12, g.z + Math.cos(p.ry) * 12) + 0.15, WG.terrainHeight(g.x - Math.sin(p.ry) * 12, g.z - Math.cos(p.ry) * 12) + 0.15);
  if (cellOk != null) ok = cellOk && ok;
  else if (ok && !def.road && !def.colony) { const L = S.char.lat; ok = def.type === 'villa' || p.bt === 'villa' || !!(L && Math.abs(g.x - L.x) < L.half && Math.abs(g.z - L.z) < L.half); }
  if (!def.road && WG.portOverlap(g.x,g.z,def.r,S.blds.filter(b=>b.type==='portus'))) ok=false;
  if (p.ok !== ok) { p.ok = ok; p.obj.traverse((m) => { if (m.isMesh && m.material.color) m.material.color.set(ok ? 0x88ff88 : 0xff6655); }); }
}

// ---------- Постройка: окно ----------
export function openBuilding(id) { open('bld', { id }); }
export function openSpeech(id) { open('bld', { id, tab: 'speech' }); }
export function openCamp() { open('camp'); }
export function openInstance(key) { open('inst', { key }); }
const B = () => S.blds.find((b) => b.id === cur.id);
function renderBld() {
  const b = B(); if (!b) { closeModal(); return; }
  const def = BUILDINGS[b.type], c = S.char, w = S.world;
  $('mtitle').textContent = def.name + (b.ownerName ? ` · ${b.ownerName}` : '');
  $('mmove').classList.toggle('hidden', !canMove(b));
  if (!b.built) {
    tabs([['site', '🏗 Стройка']]);
    const rows = Object.entries(b.cost).map(([k, n]) => `<div class="row"><span class="grow">${resName(k)}</span><span class="nm">${b.prog[k] || 0} / ${n}</span><span class="muted" style="width:120px;text-align:right">сумка и личные склады: ${Math.floor((c.cityResources || c.bag)[k] || 0)}${def.pub ? `, склад ${Math.floor(w.storage[k] || 0)}` : ''}</span></div>`).join('');
    setHTML($('mbody'), `<div class="card"><div class="t">${def.desc}</div><div class="prog"><div style="width:${progOf(b) * 100}%"></div></div></div>${rows}<div style="margin-top:12px;display:flex;gap:8px"><button class="btn" data-a="deliver" data-bid="${b.id}">Вложить из сумки и личных складов</button>${(def.pub || def.colony) && S.char.office ? `<button class="btn alt" data-a="deliver" data-bid="${b.id}" data-store="1">Вложить со склада колонии</button>` : (def.pub ? '<span class="muted" style="align-self:center">со склада колонии берут только должностные лица</span>' : '')}</div><div class="muted" style="margin-top:8px">За вклад в общественные здания растёт достоинство и опыт.${w.priority === b.type ? ' <b style="color:var(--gold2)">Приоритет префекта: двойное достоинство!</b>' : ''}</div>`);
    return;
  }
  if (b.ruined || b.hp < b.maxHp * 0.98) {
    const tot = Object.values(b.cost).reduce((a, n) => a + n, 0);
    const mul = b.ruined ? 1 : 1 - b.hp / b.maxHp;
    const rc = { stone: Math.ceil(tot * 0.15 * mul), plank: Math.ceil(tot * 0.1 * mul) };
    if (b.ruined) { tabs([['rep', '🔧 Ремонт']]); setHTML($('mbody'), `<div class="card"><div class="t">Здание разрушено налётчиками</div><div class="muted">Прочность ${b.hp}/${b.maxHp}. Нужен ремонт: ${costHtml(rc, c.bag)}${hasOff('aedilis') ? ' (эдил чинит бесплатно)' : ''}</div></div><button class="btn" data-a="repair" data-bid="${b.id}">Отремонтировать</button>`); return; }
  }
  const T = {
    warehouse: warehousePanel, horreum_s: warehousePanel, supply_depot: warehousePanel, quarters: housingPanel, navalia: portPanel,
    campus: campusPanel, curia: curiaPanel, forum: forumPanel, forum_m: forumPanel, horreum: storePanel,
    mercator: (b) => { tabs([['trade', '⚖ Скупщик']]); setHTML($('mbody'), `<div class="card"><div class="muted">Скупщик берёт любой товар сразу, но платит меньше: ×${D.BUYER_SELL}. В лавках торгового ряда на форуме горожане платят дороже (×${D.STALL_SELL}), но каждая лавка берёт только товары своего ряда.</div></div>` + shopHtml(MARKET_GOODS, MARKET_GEAR, true, null, { mul: D.BUYER_SELL, hours: { open: D.buyerOpen(S.serverT + (performance.now() / 1000 - S.timeAt)), from: D.BUYER_HOURS[0], to: D.BUYER_HOURS[1] } })); },
    stall: (b) => { const k = b.cls || 0, c = S.char, mine = b.owner === c.id, nMine = S.blds.filter((x) => x.type === 'stall' && x.owner === c.id && x.city === b.city).length, lim = D.stallLimit(c.rank), pr = Math.round(D.STALL_PRICE * D.derived(c).buy);
      const own = mine ? `<div class="row"><span class="grow">🏪 <b>Ваша лавка</b>: ${D.BUILDINGS.stall.rent} ден. в минуту, свои товары здесь на ${Math.round((D.STALL_OWN - 1) * 100)}% дороже, ${Math.round(D.STALL_FEE * 100)}% с продаж других.</span><button class="btn sm alt" data-a="stallSell" data-bid="${b.id}">Продать городу (${Math.round(D.STALL_PRICE * 0.6)})</button></div>`
        : b.owner ? `<div class="muted">Хозяин лавки: ${esc(b.ownerName || '?')}.</div>` : `<div class="row"><span class="grow muted">Лавку может купить игрок любого звания (ваших в этом городе ${nMine}/${lim}): хозяину ${D.BUILDINGS.stall.rent} ден. в минуту, свои товары дороже на ${Math.round((D.STALL_OWN - 1) * 100)}%, ${Math.round(D.STALL_FEE * 100)}% с чужих продаж.</span><button class="btn sm good" data-a="stallBuy" data-bid="${b.id}" ${nMine >= lim || c.den < pr ? 'disabled' : ''}>Купить за ${pr}</button></div>`;
      tabs([['trade', '🏪 ' + WG.STALL_CLASSES[k]], ...(mine ? [['staff', '🧑 Продавец']] : [])]);
      if (cur.tab === 'staff') { const sv = (S.world.slaves || []).find((x) => x.bld === b.id); setHTML($('mbody'), `<div class="card"><div class="t">Свой раб за прилавком</div><div class="muted">Поставьте раба продавцом — лавка приносит вдвое больше (раб с навыком «Торговец» — втрое). Продавец стоит за прилавком, его видно всем.</div><div style="margin-top:6px">Сейчас: ${sv ? '<b>' + esc(sv.name) + '</b>' : 'никого'}</div></div>${slavesList(b)}`); return; }
      setHTML($('mbody'), `<div class="card"><div class="t">Лавка: ${WG.STALL_CLASSES[k]}</div><div class="muted">Горожане покупают здесь дороже скупщика (×${D.STALL_SELL}), но только товары этого ряда.</div>${own}</div>` + shopHtml(D.STALL_GOODS[k], D.STALL_GEAR[k] || [], false, null, { mul: D.STALL_SELL * (mine ? D.STALL_OWN : 1), only: D.STALL_GOODS[k] })); },
    servile: (b) => { tabs([['slaves', '⛓ Невольничий рынок'], ['mine', `👥 Мои работники (${(S.world.slaves || []).length})`]]); if (cur.tab === 'mine') setHTML($('mbody'), slavesList()); else setHTML($('mbody'), slaveTradeHtml()); }, fabrica: craftPanel, ferraria: craftPanel, pistrinum: craftPanel, macellum: marketPanel, portus: portPanel,
    insula: (b) => { // инсула: три комнаты — кто живёт (игрок или горожанин)
      const c = S.char, rooms = b.rooms || [], mine = b.owner === c.id, pr = Math.round(D.INSULA.roomPrice * (b.dmul || 1)), iLive = rooms.some((r) => !r.bot && r.name === c.name);
      tabs([['r', `🏠 Комнаты (${rooms.length})`]]);
      setHTML($('mbody'), `<div class="card"><div class="t">Инсула ${b.ownerName ? '— хозяин ' + esc(b.ownerName) : ''}</div><div class="muted">${D.INSULA.rooms} комнаты. Горожане платят хозяину понемногу каждую минуту; игрок снимает комнату на сутки за ${pr} ден. (деньги — хозяину, минус налог) и возрождается здесь.</div></div>`
        + rooms.map((r, i) => `<div class="row"><span class="nm" style="width:110px">Комната ${i + 1}</span><span class="grow">${r.bot ? `🧑 ${esc(r.name)} <span class="muted">(горожанин)</span>` : `👤 <b>${esc(r.name)}</b> <span class="muted">(игрок · ещё ${fmtT(r.left || 0)})</span>`}</span></div>`).join('')
        + (!mine && !iLive && rooms.some((r) => r.bot) ? `<div style="margin-top:8px"><button class="btn good" data-a="roomRent" data-bid="${b.id}" ${c.den < pr ? 'disabled' : ''}>Снять комнату на сутки (${pr} ден.)</button></div>` : '') + repairBtn(b));
    },
    armamentarium: (b) => { // арсенал: наёмники (три вида по 3 воина) — для всех, телохранитель — для должностных лиц, дозорные — легат
      const c = S.char, A = c.army || {}, mine = (A.squads || []).filter((q) => q.merc), full = (A.squads || []).length >= (A.limit || 1);
      tabs([['m', '💰 Наёмники'], ['g', '🛡 Телохранитель'], ['w', '🗼 Дозорные города'], ['h', '⚔ Призвать отряды']]);
      if (cur.tab === 'g') { setHTML($('mbody'), `<div class="card"><div class="muted">Телохранителя нанимают только должностные лица: ${D.GUARD_PRICE} ден. за каждый день службы. Приказы — в окне «Военное дело» (U) → «Телохранитель».</div></div>${A.guard ? '<div class="muted">Телохранитель у вас уже есть.</div>' : `<button class="btn" data-a="guardHire" ${c.offices && c.offices.length ? '' : 'disabled title="Нужна должность"'}>Нанять телохранителя (${D.GUARD_PRICE} ден./день)</button>`}` + repairBtn(b)); return; }
      if (cur.tab === 'w') { const st = (S.world.watch || {})[b.city || 'messana'] || { n: 0, lvl: 0, live: 0 }, WT = D.WATCH, leg = hasOff('legatus');
        setHTML($('mbody'), `<div class="card"><div class="t">🗼 Дозорные: ${st.n}/${WT.max} · выучка ${st.lvl}/${WT.upMax}</div><div class="muted">Дозорные обходят город вдоль стен, а при набеге сами выбегают навстречу врагу. Павший дозорный не возвращается — легат нанимает нового здесь, из казны. Выучка: +${Math.round(WT.hpK * 100)}% здоровья и +${Math.round(WT.dmgK * 100)}% урона за ступень. Казна: ${S.world.treasury} ден.</div></div>
          ${leg ? `<button class="btn good" data-a="watchBuy" ${st.n >= WT.max ? 'disabled' : ''}>Нанять дозорного (${WT.price} из казны)</button> ${st.lvl < WT.upMax ? `<button class="btn" data-a="watchUp">Улучшить выучку → ${st.lvl + 1} (${WT.upCost(st.lvl + 1)} из казны)</button>` : '<span class="tag">выучка наивысшая</span>'}` : `<div class="muted">Распоряжается легат: ${S.world.offices.legatus ? esc(S.world.offices.legatus.name) : 'должность свободна'}.</div>`}` + repairBtn(b)); return; }
      if (cur.tab === 'h') { setHTML($('mbody'), `<div class="card"><div class="muted">Отправленные домой отряды снова призывают здесь, в Казармах или у своего Претория.</div></div>` + ((A.squads || []).map((q) => `<div class="row"><span class="grow">${(D.SQUADS[q.type] || {}).icon || '⚔'} ${esc(q.name)} <span class="muted">${q.live ? `на поле ${q.live}/${q.size}` : 'дома'}</span></span><button class="btn sm good" data-a="squadOut" data-id="${q.id}" ${q.live ? 'disabled' : ''}>Призвать</button></div>`).join('') || '<div class="muted">Отрядов нет.</div>')); return; }
      const kinds = Object.entries(D.SQUADS).filter(([, M]) => M.merc);
      setHTML($('mbody'), `<div class="card"><div class="muted">Наёмников может нанять любой — сразу, но они берут плату каждую минуту и уходят через ${D.SQUADS.merc.days} дня. В каждом отряде по 3 воина. Отрядов: ${(A.squads || []).length}/${A.limit || 1}. Приказы — 1–5, 0, N, O, L, Z (ПКМ) и окно «Военное дело» (U).</div></div>`
        + kinds.map(([k, M]) => { const pr = Math.round(M.price * D.derived(c).buy); return `<div class="row"><span class="nm" style="width:220px">${M.icon} ${M.name}</span><span class="grow muted">${M.desc} Здоровье ×${M.hpK}, урон ×${M.dmgK} · ${M.upkeep} ден./мин</span><span class="nm">${pr} ден.</span><button class="btn sm good" data-a="squadRecruit" data-k="${k}" ${c.den < pr || full ? 'disabled' : ''}>Нанять</button></div>`; }).join('')
        + mine.map((q) => `<div class="row"><span class="grow">${(D.SQUADS[q.type] || {}).icon || '💰'} ${esc(q.name)} · уйдут через ${fmtT(q.left || 0)}</span><button class="btn sm alt" data-a="squadDisband" data-id="${q.id}">Распустить</button></div>`).join('') + repairBtn(b));
    },
    castra: castraPanel, taberna: tabernaPanel, stabulum: stablePanel, equile: stablePanel, collegium: guildPanel,
    ludus: (b) => { // частная школа: свои гладиаторы бесплатно, чужие — за плату хозяину; продажа и покупка гладиаторов
      const c = S.char, mine = b.owner === c.id, all = b.glads || [], my = all.filter((x) => x.owner === c.id), other = all.filter((x) => x.owner !== c.id);
      tabs([['l', `🛡 Школа гладиаторов (${all.length}/${BUILDINGS.ludus.slots})`], ['m', `🏷 Гладиаторы на продажу (${other.filter((x) => x.sale).length})`]]);
      if (cur.tab === 'm') { setHTML($('mbody'), `<div class="muted" style="margin-bottom:6px">Гладиаторы, которых хозяева продают в этой школе. Хозяину школы — 10% с чужих сделок, казне — 5%.</div>` + (other.filter((x) => x.sale).map((x) => `<div class="row"><span class="grow">🛡 <b>${esc(x.name)}</b> ${gradeTag(x)} ${traitTag(x)} <span class="muted">ур. ${x.glvl} · хозяин ${esc(x.ownerName)}</span></span><button class="btn sm good" data-a="gladBuy" data-sid="${x.id}" ${c.den < x.sale ? 'disabled' : ''}>Купить за ${x.sale}</button></div>`).join('') || '<div class="muted">Сейчас никто не продаёт.</div>')); return; }
      const fee = mine ? 'бесплатно (ваша школа)' : `${D.LUDUS_FEE.train} ден. сразу и ${D.LUDUS_FEE.keep} ден. в минуту хозяину (${esc(b.ownerName || '?')})`;
      setHTML($('mbody'), `<div class="card"><div class="muted">Школа в черте города: гладиаторы живут и тренируются здесь — раз в минуту растёт опыт (до 10 уровня). Обучение и содержание: ${fee}. ${mine ? 'Чужие гладиаторы приносят вам плату за обучение и содержание и 10% с продаж.' : ''}</div></div>
        <h3 class="sec">Мои гладиаторы здесь</h3>` + (my.map((x) => `<div class="row"><span class="grow">🛡 <b>${esc(x.name)}</b> ${gradeTag(x)} <span class="muted">ур. ${x.glvl}</span></span><input id="gs_${x.id}" class="num" value="${x.sale || 300}"><button class="btn sm ${x.sale ? 'good' : 'alt'}" data-a="gladSale" data-sid="${x.id}">${x.sale ? 'Продаётся · изменить' : '🏷 Продать'}</button>${x.sale ? `<button class="btn sm alt" data-a="gladSale" data-sid="${x.id}" data-off="1">Снять</button>` : ''}<button class="btn sm alt" data-a="gladLudus" data-sid="${x.id}" data-on="0">Забрать</button></div>`).join('') || '<div class="muted">Пока нет.</div>')
        + (mine && other.length ? `<h3 class="sec">Чужие гладиаторы (платят вам)</h3>` + other.map((x) => `<div class="row"><span class="grow">🛡 ${esc(x.name)} <span class="muted">— ${esc(x.ownerName)}, ур. ${x.glvl}</span></span></div>`).join('') : '')
        + `<h3 class="sec">Отправить в школу</h3>` + ((S.world.slaves || []).filter((x) => !x.ludus && !x.hired).map((x) => `<div class="row"><span class="grow">${esc(x.name)} ${gradeTag(x)}</span><button class="btn sm" data-a="gladLudus" data-sid="${x.id}" data-on="1">В школу</button></div>`).join('') || '<div class="muted">Нет свободных рабов.</div>') + repairBtn(b)); },
    vivarium: (b) => { tabs([['v', '🦁 Зверинец']]); const c = S.char; setHTML($('mbody'), `<div class="card"><div class="muted">Здесь живут ваши прирученные львы. Ловля: убейте матёрого льва на островах Дидима, Мелита или Феррум, подойдите к телу и нажмите E с сетью приручителя (покупается на арене за ${D.ARENA_SHOP.tamer.ap} очков). Шанс — 50%.</div></div><h3 class="sec">Львы</h3>` + ((c.lions || []).map((l) => `<div class="row"><span class="grow">🦁 ${esc(l.name)}</span><span class="muted">выпускают на арену в Амфитеатре</span></div>`).join('') || '<div class="muted">Пока нет.</div>') + repairBtn(b)); }, amphitheatrum: arenaPanel, colonia: colonyPanel, domus: domusPanel,
  }[b.type];
  MB_PRE = b.sale && b.owner && b.owner !== c.id ? `<div class="card" style="border-color:var(--gold)"><div class="row" style="border:0"><span class="grow">🏷 <b>Продаётся</b>: ${def.name} — хозяин ${esc(b.ownerName || '?')}</span><button class="btn good" data-a="bldBuy" data-bid="${b.id}" ${c.den < b.sale ? 'disabled' : ''}>Купить за ${b.sale} ден.</button></div></div>` : '';
  try {
    if (T) T(b);
    else if (def.prod) prodPanel(b);
    else { tabs([['info', 'ℹ Сведения']]); setHTML($('mbody'), `<div class="card"><div class="t">${def.name}</div><div>${def.desc}</div><div class="muted">Прочность ${b.hp}/${b.maxHp}${def.rent && b.owner ? ` · доход хозяину ${Math.round(def.rent * (b.dmul || 1))} ден./мин` : ''}</div></div>${repairBtn(b)}`); }
  } finally { MB_PRE = ''; }
}
function horseRow(h, c, here) {
  const sat = Math.round(h.sat ?? 100), out = c.horseOut === h.id;
  const where = out ? '<span class="tag">с вами</span>' : here ? '<span class="muted">в этой конюшне</span>' : '<span class="muted">в другой конюшне</span>';
  return `<div class="row"><span class="nm" style="width:170px">🐎 ${esc(h.name)}</span><span style="width:150px">${where}</span><span style="width:120px" title="Сытость"><span class="${sat < 30 ? 'no' : 'ok'}">сытость ${sat}%</span></span><span style="width:130px" class="muted">${h.left != null ? `⏳ аренда ещё ${Math.floor(h.left / 60)} мин` : `♾ свой · сумка +${D.HORSES[h.kind].bag} кг`}</span><span class="muted grow">скорость ×${D.HORSES[h.kind].speed}</span>${out ? `<button class="btn sm" data-a="horseFeedA">Покормить (1 пшеница)</button><button class="btn sm alt" data-a="horseStable">Оставить здесь</button>` : here || !h.stable ? `<button class="btn sm" data-a="horseOut" data-id="${h.id}">Вывести и сесть</button>` : ''}</div>`;
}
function stablePanel(b) {
  const c = S.char, pub = b.type === 'stabulum', own = !pub && b.owner === c.id, HE = D.HORSE_ECON, k = D.derived(c);
  tabs([['h', pub ? '🐎 Общественная конюшня' : own ? '🐎 Своя конюшня' : `🐎 Конюшня: ${esc(b.ownerName || '')}`]]);
  const list = (c.horses || []).map((h) => horseRow(h, c, h.stable === b.id)).join('') || '<div class="muted">У вас пока нет коней.</div>';
  const bagInfo = (kk) => `сумка +${D.HORSES[kk].bag} кг · ×${D.HORSES[kk].speed}`;
  let h = `<h3 class="sec">Мои кони</h3>${list}`;
  if (pub) {
    const myEq = S.blds.some((x) => x.type === 'equile' && x.owner === c.id && x.built);
    h += `<h3 class="sec">Взять коня на время (сутки)</h3>` + HE.publicRent.map((kk) => { const H = D.HORSES[kk], pr = Math.round(H.price * HE.rentK * k.buy); return `<div class="row"><span class="grow">${H.name} <span class="muted">${bagInfo(kk)}</span></span><span class="nm">◉ ${pr}</span><button class="btn sm" data-a="rentPublic" data-k="${kk}" ${c.den < pr ? 'disabled' : ''}>Взять на сутки</button></div>`; }).join('');
    h += `<h3 class="sec">Купить коня насовсем</h3>` + Object.entries(D.HORSES).map(([kk, H]) => { const pr = Math.round(H.price * k.buy); return `<div class="row"><span class="grow">${H.name} <span class="muted">${bagInfo(kk)}</span></span><span class="nm">◉ ${pr}</span><button class="btn sm good" data-a="horseBuyFull" data-k="${kk}" ${c.den < pr ? 'disabled' : ''}>Купить</button></div>`; }).join('');
    h += `<h3 class="sec">Жеребята — для владельцев своих конюшен (скидка 90%)</h3><div class="muted" style="margin-bottom:4px">${myEq ? 'Жеребёнок поедет в вашу конюшню: кормите его пшеном 3 игровых дня, потом продавайте или сдавайте в аренду.' : 'Сначала постройте Свою конюшню (стройка → «За стенами» или «Латифундия»).'}</div>` + Object.entries(D.HORSES).map(([kk, H]) => { const pr = Math.round(H.price * HE.foalK); return `<div class="row"><span class="grow">${H.name} <span class="muted">взрослый ~${H.price} ден. · ${bagInfo(kk)}</span></span><span class="nm">◉ ${pr}</span><button class="btn sm alt" data-a="foalBuy" data-k="${kk}" ${!myEq || c.den < pr ? 'disabled' : ''}>Купить жеребёнка</button></div>`; }).join('');
    const dir = (S.world.horseStables || []).map((q) => `<div class="row"><span class="grow">🏠 Конюшня ${esc(q.owner || '?')}</span><span class="muted">на продажу ${q.sale} · в аренду ${q.rent} · ${Math.round(Math.hypot(q.x - S.me.x, q.z - S.me.z))} м</span></div>`).join('');
    h += `<h3 class="sec">Кони у игроков</h3>${dir || '<div class="muted">Пока никто не продаёт и не сдаёт коней.</div>'}`;
    h += `<div class="card"><div class="muted">Конь в стойле здесь — 1 денарий в минуту за корм. Не больше трёх коней (вместе с арендованными). V — сесть или спешиться. Перемётная сумка коня прибавляет вместимость, пока конь с вами.</div></div>`;
  } else {
    const stock = b.stock || [];
    if (own) {
      h += `<div class="card"><div class="t">Кормушка: ${Math.floor(b.store.wheat || 0)} пшеницы</div><div class="muted">Каждый конь в стойле съедает ¼ пшеницы в минуту; голодный жеребёнок не растёт.</div><div style="margin-top:6px;display:flex;gap:6px"><button class="btn sm" data-a="stableFeed" data-n="10" ${(c.bag.wheat || 0) < 1 ? 'disabled' : ''}>Положить 10 пшеницы</button><button class="btn sm alt" data-a="stableFeed" data-n="999" ${(c.bag.wheat || 0) < 1 ? 'disabled' : ''}>Всю пшеницу</button><span class="muted" style="align-self:center">в сумке: ${Math.floor(c.bag.wheat || 0)}</span></div></div>`;
      const here = (c.horses || []).filter((x) => x.stable === b.id && !x.rented && (x.sat ?? 100) >= 50).length;
      h += `<h3 class="sec">🐴 Стойло (${stock.length}/${HE.stock})</h3><div class="muted" style="margin-bottom:4px">Жеребят покупают в общественной конюшне (скидка 90%) или разводят: два своих сытых коня в стойле + ${D.BREED.wheat} пшеницы. Жеребёнок растёт 3 игровых дня. Выручка с продажи и аренды — ваша, минус налог с торговли.</div><button class="btn sm good" data-a="breed" ${here < 2 || (b.store.wheat || 0) < D.BREED.wheat ? 'disabled' : ''}>Свести коней (подходящих: ${here})</button>`;
      h += stock.map((f) => { const H = D.HORSES[f.kind], grown = f.grow >= HE.grow, npc = Math.round(H.price * HE.npcK * k.sell);
        return `<div class="card"><div class="t">🐎 ${esc(f.name)} — ${H.name} <span class="tag">${grown ? 'взрослый' : `растёт: ${Math.floor(f.grow / HE.grow * 100)}%`}</span>${f.out ? ' <span class="tag">в аренде</span>' : ''}</div><div class="muted">${bagInfo(f.kind)} · сытость ${Math.round(f.sat ?? 100)}%</div>
          <div class="row" style="border:0">${grown && !f.out ? `<button class="btn sm" data-a="stockTake" data-id="${f.id}">Взять себе</button><button class="btn sm alt" data-a="stockNpc" data-id="${f.id}">Конюшему ${npc}</button>` : ''}
          <input id="sp_${f.id}" class="num" value="${f.sale || H.price}"><button class="btn sm ${f.sale ? 'good' : 'alt'}" data-a="stockSale" data-id="${f.id}">${f.sale ? 'Продаётся · изменить' : 'Продавать'}</button>${f.sale ? `<button class="btn sm alt" data-a="stockSale" data-id="${f.id}" data-off="1">Снять</button>` : ''}
          <input id="rp_${f.id}" class="num" value="${f.rent || Math.round(H.price * HE.rentK)}"><button class="btn sm ${f.rent ? 'good' : 'alt'}" data-a="stockRent" data-id="${f.id}">${f.rent ? 'Сдаётся · изменить' : 'Сдавать в аренду'}</button>${f.rent ? `<button class="btn sm alt" data-a="stockRent" data-id="${f.id}" data-off="1">Снять</button>` : ''}</div></div>`; }).join('');
    } else {
      const offer = stock.filter((f) => f.grow >= HE.grow && !f.out && (f.sale || f.rent));
      h += `<h3 class="sec">Кони на продажу и в аренду</h3>` + (offer.map((f) => { const H = D.HORSES[f.kind]; return `<div class="row"><span class="grow">🐎 ${esc(f.name)} — ${H.name} <span class="muted">${bagInfo(f.kind)}</span></span>${f.sale ? `<button class="btn sm" data-a="stockBuy" data-id="${f.id}" ${c.den < f.sale ? 'disabled' : ''}>Купить ${f.sale}</button>` : ''}${f.rent ? `<button class="btn sm alt" data-a="stockRentTake" data-id="${f.id}" ${c.den < f.rent ? 'disabled' : ''}>В аренду на сутки ${f.rent}</button>` : ''}</div>`; }).join('') || '<div class="muted">Сейчас хозяин ничего не предлагает.</div>');
    }
  }
  setHTML($('mbody'), h + repairBtn(b));
}
const progOf = (b) => { const tot = Object.values(b.cost).reduce((a, n) => a + n, 0), got = Object.values(b.prog || {}).reduce((a, n) => a + n, 0); return tot ? got / tot : 0; };
const repairBtn = (b) => b.hp < b.maxHp ? `<button class="btn sm alt" data-a="repair" data-bid="${b.id}">Подлатать (${b.hp}/${b.maxHp}) · +одобрение Рима</button>${S.char.office && (BUILDINGS[b.type].pub || b.muni) ? ` <button class="btn sm alt" data-a="repair" data-bid="${b.id}" data-store="1">Подлатать со склада</button>` : ''}` : '';
function questBoard(source='forum',city=B()?.city||S.world.city) {
  const w = S.world, c = S.char;
  const have = new Set(c.quests.map((q) => q.id));
  return `<div class="card">Очки должности в этом городе: <b>${c.officePoints?.[city]||0}</b>. Общие задания можно брать нескольким игрокам; прогресс личный. Обновление доски раз в 10 минут.</div>`+(w.quests || []).filter(q=>(q.source||'forum')===source&&(!q.city||q.city===city)).map((q) => `<div class="row"><span class="grow"><b>${q.title}</b> <span class="muted">— ${q.desc}</span></span><span class="nm muted" style="font-size:12px">${q.reward.den} ден. · ${q.reward.xp} оп. · ${q.reward.office||5} очк. должности</span><button class="btn sm" data-a="quest" data-id="${q.id}" ${have.has(q.id)||(c.doneQuests||[]).includes(q.id) ? 'disabled' : ''}>${(c.doneQuests||[]).includes(q.id)?'Выполнено':have.has(q.id)?'Взято':'Взять'}</button></div>`).join('');
}
// должность: щелчок — разворачивается полное описание и требования
const offOpen = new Set();
document.addEventListener('toggle', (e) => { const d = e.target; if (d && d.classList && d.classList.contains('offd')) { if (d.open) offOpen.add(d.dataset.k); else offOpen.delete(d.dataset.k); } }, true);
function offDetails(k, right = '') {
  const o = OFFICES[k], c = S.char, req = [`звание «${RANKS[o.minRank].name}»`, o.minMil ? `военное звание «${D.MIL_RANKS[o.minMil].name}»` : '', o.minTrade ? `торговый оборот ${o.minTrade} ден. (сумма ваших покупок и продаж; у вас ${(c.stats2 && c.stats2.traded) || 0})` : ''].filter(Boolean).join(', ');
  const mine = hasOff(k), okR = c.rank >= o.minRank;
  return `<details class="offd" data-k="${k}" ${offOpen.has(k) ? 'open' : ''}><summary class="row"><span class="grow">${o.icon} <b>${o.name}</b>${mine ? ' <span class="tag">ваша</span>' : ''}</span><span class="${okR ? 'ok' : 'no'}" style="font-size:12px;margin-right:8px">${okR ? 'можно' : 'нужно звание выше'}</span>${right}</summary><div class="offbody"><div>${o.desc}</div><div class="muted" style="margin-top:4px">Нужно: ${req}. У одного игрока — не больше ${D.MAX_OFFICES} должностей.</div></div></details>`;
}
const hasOff = (k) => !!(S.char && (S.char.offices || []).includes(k)); // у игрока может быть до двух должностей
let speechDraft = '';
$('mbody').addEventListener('input', (e) => { if (e.target.id === 'speechText') speechDraft = e.target.value; });
function forumPanel(b) {
  const w = S.world, c = S.char;
  tabs([['quests', '🗒 Задания'], ['rome', '🦅 Рим', (w.requests || []).length], ['elect', '🗳 Выборы', !!w.election], ['laws', '📜 Законы', !!w.lawVote], ['treasury', '💰 Казна'], ['chron', '📖 Летопись'], ...(c.office && b.type === 'forum_m' ? [['speech', '📣 Речь с ростр']] : [])]);
  let h = '';
  if (cur.tab === 'speech') h = `<div class="muted" style="margin-bottom:6px">Вы на рострах. Речь крупно увидят все граждане на острове. Раз в 5 минут речь приносит +3 одобрения Рима.</div><textarea id="speechText" maxlength="200" style="width:100%;height:70px" placeholder="Квириты! …">${esc(speechDraft)}</textarea><div style="margin-top:6px"><button class="btn" data-a="speech">📣 Произнести речь</button></div>`;
  else if (cur.tab === 'quests') h = `<div class="muted" style="margin-bottom:6px">Доска объявлений колонии. Задания обновляются каждые 10 минут${w.questsIn != null ? ` (новые — через ${fmtT(w.questsIn)})` : ''}. Выполненное задание засчитывается сразу. Не больше 6 одновременно.</div>${questBoard()}`;
  else if (cur.tab === 'rome') {
    h = (w.requests || []).map((r) => `<div class="card"><div class="t">${resName(r.res)}: ${r.got} / ${r.n}</div><div class="prog"><div style="width:${r.got / r.n * 100}%"></div></div><div class="row" style="border:0"><span class="grow muted">Осталось ${fmtT(r.left)} · вам ${Math.round(r.den * 0.4)} ден. за штуку, казне — больше</span><button class="btn sm" data-a="romeDeliver" data-rid="${r.id}">Сдать из сумки (${Math.floor(c.bag[r.res] || 0)})</button><button class="btn sm alt" data-a="romeDeliver" data-rid="${r.id}" data-store="1">Со склада (${Math.floor(w.storage[r.res] || 0)})</button></div></div>`).join('') || '<div class="muted">Сейчас Рим ничего не просит. Запросы приходят время от времени — выполняйте их, чтобы Рим был благосклонен (лучше цены, выплаты в казну).</div>';
    h += `<div class="card"><div class="stat"><span>Расположение Рима</span><span>${w.favor}%</span></div><div class="stat"><span>Угроза Карфагена</span><span>${w.threat}%</span></div></div>`;
  } else if (cur.tab === 'elect') {
    const E = w.election;
    h = `<h3>Должностные лица города ${esc(w.cityName || '')} <span class="muted" style="font-size:12px">(в каждом римском городе — свои; щёлкните — откроется описание)</span></h3>${Object.keys(OFFICES).map((k) => offDetails(k, `<b class="nm">${w.offices[k] ? esc(w.offices[k].name) : '—'}</b>`)).join('')}`;
    h+=`<div class="card">Очки должности в ${esc(w.cityName||w.city)}: <b>${c.officePoints?.[w.city]||0}</b>. Их дают поручения форума и гавани. Очки открывают выдвижение и не расходуются.</div>`;
    if (E) {
      h += `<h3 style="margin-top:12px">Идут выборы · ${fmtT(E.ends)}</h3>` + Object.entries(OFFICES).map(([k, o]) => {
        const cands = Object.entries(E.offices[k] || {});
        const req = [`очки должности в этом городе: ${c.officePoints?.[w.city]||0} / ${o.minOfficePoints}`,o.minTrade ? `торговый оборот ${o.minTrade} ден. — сумма ваших сделок на рынке, в лавках, портах и у торговцев (у вас ${(c.stats2 && c.stats2.traded) || 0})` : '', o.minMil ? `военное звание «${D.MIL_RANKS[o.minMil].name}»` : ''].filter(Boolean).join('; ');
        return `<div class="card"><div class="row" style="border:0"><span class="grow t">${o.icon} ${o.name}${req ? `<div class="muted" style="font-weight:400;font-size:12px">Нужно: ${req}</div>` : ''}</span><button class="btn sm" data-a="cand" data-office="${k}" ${c.rank < o.minRank || (c.officePoints?.[w.city]||0)<o.minOfficePoints ? 'disabled title="Нужны указанное звание и очки должности этого города"' : ''}>Выдвинуться</button></div>${cands.map(([cid, x]) => `<div class="row"><span class="grow">${esc(x.name)}</span><span class="nm">${x.votes.toFixed(1)} гол.</span><button class="btn sm ${x.mine ? 'good' : ''}" data-a="vote" data-office="${k}" data-cid="${cid}">${x.mine ? 'Ваш голос' : 'Голосовать'}</button></div>`).join('') || '<div class="muted">Кандидатов нет</div>'}</div>`;
      }).join('');
    } else h += `<div class="muted" style="margin-top:10px">Следующие выборы через ${fmtT(w.electionIn)}. Голос весит по званию (и красноречию).</div><button class="btn sm alt" data-a="callElection" style="margin-top:6px">Объявить досрочные выборы</button>`;
    for (const o of c.offs || []) h += ` <button class="btn sm bad" data-a="resign" data-office="${o.city}:${o.k}">Сложить: ${OFFICES[o.k].name} (${esc(o.cityName)})</button>`;
    const others = Object.entries(w.cityOffices || {}).filter(([id]) => id !== w.city);
    if (others.length) h += `<h3 class="sec">Должности других городов</h3>` + others.map(([, X]) => `<div class="row"><span class="nm" style="width:140px">${esc(X.name)}</span><span class="grow muted">${Object.entries(X.offices || {}).filter(([, v]) => v).map(([k, v]) => `${OFFICES[k].icon} ${OFFICES[k].name}: ${esc(v.name)}`).join(' · ') || 'никого'}</span></div>`).join('');
  } else if (cur.tab === 'laws') {
    const V = w.lawVote;
    if (V) h += `<div class="card" style="border-color:var(--gold)"><div class="t">Голосование: «${LAWS[V.key].name}» → ${LAWS[V.key].opts[V.opt]}</div><div class="muted">Предложил(а) ${esc(V.by)} · ${fmtT(V.ends)} · за ${V.yes.toFixed(1)}, против ${V.no.toFixed(1)}</div><div style="margin-top:6px;display:flex;gap:6px"><button class="btn sm good" data-a="lawVote" data-yes="1">${V.mine === 1 ? '✔ ' : ''}За</button><button class="btn sm bad" data-a="lawVote" data-yes="0">${V.mine === -1 ? '✔ ' : ''}Против</button></div></div>`;
    const canK = (k) => !!(w.canLaw && w.canLaw[k]), can = Object.keys(LAWS).some(canK);
    h += Object.entries(LAWS).map(([k, l]) => `<div class="card"><div class="row" style="border:0"><span class="grow t">${l.name}: <span style="color:var(--gold2)">${l.opts[w.laws[k] ?? l.def ?? 0]}</span> <span class="muted" style="font-size:12px;font-weight:400">· предлагают: ${(D.LAW_AREA[k] || []).map((o) => OFFICES[o].name).join(', ')}, префект, сенатор</span></span>${canK(k) && !V ? l.opts.map((o, i) => i === (w.laws[k] ?? l.def ?? 0) ? '' : `<button class="btn sm alt" data-a="propose" data-key="${k}" data-opt="${i}">Предложить «${o}»</button>`).join('') : ''}</div><div class="muted">${l.desc}</div></div>`).join('');
    h = `<div class="muted" style="margin-bottom:8px">Законы города ${esc(w.cityName || '')} — в каждом городе свои и действуют только в нём. Каждая должность предлагает законы своего ведомства, префект и сенатор — любые (если в городе нет ни префекта, ни сенатора, ни нужной должности — любой от звания «Плебей»). Голосовать может каждый.${can ? '' : ' <b>Вы сейчас не можете предлагать законы здесь.</b>'}</div>` + h;
  } else if (cur.tab === 'treasury') {
    const st = Object.entries(w.storage).filter(([, n]) => n >= 1).map(([k, n]) => `<div class="row"><span class="grow">${resName(k)}</span><b>${Math.floor(n)}</b>${hasOff('magister') ? `<button class="btn sm alt" data-a="office" data-act="convoy" data-res="${k}">Обоз в Рим</button>` : ''}</div>`).join('') || '<div class="muted">Склад пуст</div>';
    let off = '';
    if (hasOff('praefectus')) {
      const ppl = [...S.roster.values()];
      off += `<div class="card"><div class="t">🏛 Префект</div><div class="row" style="border:0">Наградить <select id="rewardTo">${ppl.map((q) => `<option value="${q.cid}">${esc(q.name)}</option>`).join('')}</select><input id="rewardN" class="num" value="50"> ден. <button class="btn sm" data-a="reward">Выдать из казны</button></div><div class="row" style="border:0">Приоритетная стройка: ${S.blds.filter((x) => !x.built && BUILDINGS[x.type].pub).map((x) => `<button class="btn sm alt" data-a="office" data-act="priority" data-bt="${x.type}">${BUILDINGS[x.type].name}</button>`).join('') || '<span class="muted">нет строек</span>'}</div></div>`;
    }
    h = `<div class="cols"><div><div class="card"><div class="stat"><span>Казна</span><span>${w.treasury} ден.</span></div><div class="stat"><span>Налог с торговли</span><span>${LAWS.trade_tax.opts[w.laws.trade_tax ?? LAWS.trade_tax.def]}</span></div></div>${off}</div><div><h3>Склад колонии</h3>${st}</div></div>`;
  } else h = `<div class="cols"><div><h3>Летопись</h3>${(w.chronicle || []).map((e) => `<div class="row"><span class="tag">день ${e.day}</span><span class="grow">${esc(e.text)}</span></div>`).join('')}</div><div><h3>Трофеи рыбаков</h3>${trophyBoard()}</div></div>`;
  setHTML($('mbody'), h);
}
function storePanel(b) {
  const w = S.world, c = S.char;
  tabs([['store', '📦 Склад колонии']]);
  const st = Object.entries(w.storage).filter(([, n]) => n >= 1).map(([k, n]) => `<div class="row"><span class="grow">${resName(k)}</span><b>${Math.floor(n)}</b>${c.office ? `<button class="btn sm alt" data-a="storeTake" data-res="${k}" data-n="10">Взять 10</button>` : ''}</div>`).join('') || '<div class="muted">Пусто</div>';
  const bag = Object.entries(c.bag).filter(([k, n]) => n >= 1 && RES[k]).map(([k, n]) => `<div class="row"><span class="grow">${resName(k)}</span><span class="nm">${Math.floor(n)}</span><button class="btn sm" data-a="donate" data-res="${k}" data-n="10">+10</button><button class="btn sm" data-a="donate" data-res="${k}" data-n="${Math.floor(n)}">Всё</button></div>`).join('') || '<div class="muted">Сумка пуста</div>';
  setHTML($('mbody'), `<div class="cols"><div><h3>Сдать на склад</h3><div class="muted" style="margin-bottom:6px">Сданное идёт на общественные стройки, запросы Рима и хлебную раздачу. За поставки растёт достоинство. Брать со склада — себе или на ремонт в городе — могут только должностные лица (каждое взятие пишется в журнал).</div>${bag}</div><div><h3>На складе · казна ${w.treasury} ден.</h3>${st}</div></div>`);
}
function craftPanel(b) {
  const c = S.char;
  tabs([['craft', '🔨 Ремесло']]);
  const list = RECIPES.filter((r) => r.at === b.type).map((r) => {
    const can = Object.entries(r.in).every(([k, n]) => (c.bag[k] || 0) >= n) && (!r.lvl || c.level >= r.lvl);
    const title = r.gear ? `<span class="q0">${GEAR[r.gear].name}</span> <span class="muted">${gearStats({ k: r.gear, q: 0 })}</span>` : r.n;
    return `<div class="row"><span class="nm" style="width:260px">${title}${r.lvl ? ` <span class="tag">ур. ${r.lvl}</span>` : ''}</span><span class="grow" style="font-size:12px">${costHtml(r.in, c.bag)}</span><button class="btn sm" data-a="craft" data-id="${r.id}" data-n="1" ${can ? '' : 'disabled'}>Сделать</button>${r.gear ? '' : `<button class="btn sm alt" data-a="craft" data-id="${r.id}" data-n="10" ${can ? '' : 'disabled'}>×10</button>`}</div>`;
  }).join('');
  const ch = D.craftChance(c), chTxt = `<div class="card" style="margin-bottom:6px"><div class="t">Шанс качества снаряжения</div><div><span class="q2">отличное ${Math.round(ch.q2 * 100)}%</span> · <span class="q1">хорошее ${Math.round(ch.q1 * 100)}%</span> · обычное ${Math.round((1 - ch.q1 - ch.q2) * 100)}%${ch.dbl ? ` · <b>два изделия ${Math.round(ch.dbl * 100)}%</b>` : ''}</div><div class="muted">Растёт с уровнем и специализацией «Ремесленник».</div></div>`;
  const feeNote = b.owner && b.owner !== c.id && !D.specOf(c, 'craft') ? `<div class="card" style="margin-bottom:6px"><div class="muted">Это частное предприятие (${esc(b.ownerName || '?')}): за работу хозяину доплачивается ${D.CRAFT_FEE.res} ден. за изделие, за снаряжение — ${D.CRAFT_FEE.gear} ден.</div></div>` : '';
  setHTML($('mbody'), feeNote + chTxt + list);
}
// товары по группам; покупка и продажа — на разных вкладках
const RGROUPS = [['🍞 Еда', ['wheat', 'bread', 'meat', 'olives', 'grapes', 'oil', 'wine', 'honey', 'salt', 'saffron']], ['🪵 Сырьё', ['wood', 'stone', 'clay', 'hide', 'iron_ore', 'marble', 'murex', 'silver_ore', 'cedar', 'papyrus', 'linen', 'calamus', 'croc_hide', 'sulfur', 'pumice', 'obsidian', 'alum']], ['🔨 Изделия', ['plank', 'brick', 'iron', 'leather', 'amphora', 'arrow', 'pilum', 'bandage', 'purple']], ['💎 Ценности', ['silver', 'gold', 'gem', 'pearl', 'coral', 'amber', 'artifact']]];
const rGroup = (k) => { if (RES[k] && RES[k].fish) return '🐟 Рыба'; const g = RGROUPS.find(([, l]) => l.includes(k)); return g ? g[0] : '📦 Прочее'; };
const GROUP_ORDER = ['🍞 Еда', '🐟 Рыба', '🪵 Сырьё', '🔨 Изделия', '💎 Ценности', '📦 Прочее'];
function grouped(keys, row) { const by = {}; for (const k of keys) (by[rGroup(k)] = by[rGroup(k)] || []).push(row(k)); return GROUP_ORDER.filter((g) => by[g]).map((g) => `<div class="sgrp"><h4>${g}</h4>${by[g].join('')}</div>`).join(''); }
let shopSub = 'buy';
function shopHtml(goods, gear, sellAll = true, where = null, o = {}) {
  const c = S.char, w = S.world;
  const mm = (k) => (w.market && w.market[k]) || 1;
  const context = k => ({ market:mm(k),favor:w.favor,openPort:!!w.laws.open_port,magister:hasOff('magister'),foreign:!!where,portMultiplier:where?(PORTS[where].mult[k]||1.1):1,localSale:o.mul||1 });
  const buyP = k => purchasePrice(c,k,context(k));
  const sellP = k => Math.round(baseSalePrice(c,k,context(k))*(o.mul||1)*10)/10;
  const buyRow = (k) => `<div class="row"><span class="grow">${resName(k)}</span><span class="nm">${buyP(k)} ден.</span><input id="b_${k}" class="num" value="10"><button class="btn sm" data-a="buy" data-k="${k}">Купить</button></div>`;
  const buy = grouped(goods, buyRow) + (gear.length ? `<div class="sgrp"><h4>⚔ Снаряжение</h4>${gear.map((k) => `<div class="row"><span class="grow itemName">${GEAR[k].name} <span class="muted">${gearStats({ k, q: 0 })}</span></span><span class="nm">${buyP(k)} ден.</span><button class="btn sm" data-a="buy" data-k="${k}" data-n="1">Купить</button></div>`).join('')}</div>` : '');
  const sk = Object.entries(c.bag).filter(([k, n]) => n >= 1 && RES[k] && (!o.only || o.only.includes(k))).map(([k]) => k);
  const sell = grouped(sk, (k) => { const n = c.bag[k]; return `<div class="row"><span class="grow">${resName(k)} <span class="muted">×${Math.floor(n)}</span></span><span class="nm">${sellP(k)} ден.${where && PORTS[where].mult[k] ? ' ↑' : ''}</span><button class="btn sm" data-a="sell" data-res="${k}" data-n="1">1</button><button class="btn sm" data-a="sell" data-res="${k}" data-n="${Math.floor(n)}">Всё</button></div>`; }) || '<div class="muted">Нечего продать</div>';
  const sg = sellAll ? c.items.filter((it) => !GEAR[it.k].bound).map((it) => `<div class="row"><span class="grow itemName">${gearName(it)}</span><span class="nm">${Math.round(GEAR[it.k].p * 0.35 * QUALITY[it.q || 0].mul)} ден.</span><button class="btn sm alt" data-a="sellGear" data-uid="${it.uid}">Продать</button></div>`).join('') : '';
  const closed = o.hours && !o.hours.open ? `<div class="card" style="border-color:var(--red,#a33)">🕛 Скупщик открыт с ${o.hours.from}:00 до ${o.hours.to}:00 — сейчас закрыто.</div>` : '';
  const sw = `<div class="subtabs"><button class="btn sm ${shopSub === 'buy' ? 'good' : 'alt'}" data-a="shopSub" data-k="buy">🛒 Купить · у вас ${c.den} ден.</button><button class="btn sm ${shopSub === 'sell' ? 'good' : 'alt'}" data-a="shopSub" data-k="sell">💰 Продать${w.laws.trade_tax ? ` · налог ${LAWS.trade_tax.opts[w.laws.trade_tax]}` : ''}</button></div>`;
  return closed + sw + (shopSub === 'buy' ? `<div class="sgrid">${buy}</div>` : `<div class="sgrid">${sell}${sg ? `<div class="sgrp"><h4>⚔ Снаряжение</h4>${sg}</div>` : ''}</div>`);
}
const MARKET_GOODS = ['wood', 'stone', 'clay', 'wheat', 'bread', 'linen', 'calamus', 'leather', 'iron', 'arrow', 'bandage', 'pilum', 'amphora', 'meat'];
const MARKET_GEAR = D.MARKET_GEAR;
function marketPanel(b) {
  const w = S.world, c = S.char;
  tabs([['trade', '⚖ Торговля'], ['slaves', w.laws.slavery_ban ? '👷 Работники' : '⛓ Невольничий рынок'], ['mine', `👥 Мои работники (${(w.slaves || []).length})`]]);
  const fleet = (w.events || []).some((e) => e.kind === 'merchant') ? ['spatha', 'hamata', 'galea_iron', 'scutum', 'bow', 'rod_pro', 'squamata'] : [];
  if (cur.tab === 'trade') setHTML($('mbody'), (fleet.length ? '<div class="card" style="border-color:var(--gold)">⛵ Александрийские купцы в гавани: редкое снаряжение в продаже!</div>' : '') + shopHtml(MARKET_GOODS, [...MARKET_GEAR, ...fleet]));
  else if (cur.tab === 'slaves') {
    const lim = c.slaveLimit ?? RANKS[c.rank].slaves;
    if (w.laws.slavery_ban) setHTML($('mbody'), `<div class="card">Действует запрет рабства. Можно нанять вольнонаёмного работника: 60 ден. сразу и 2 ден. в минуту. Работают на 25% лучше.</div><button class="btn" data-a="slaveBuy" data-id="0">Нанять работника</button><div class="muted">Лимит по званию: ${lim}</div>`);
    else setHTML($('mbody'), slaveTradeHtml());
  } else setHTML($('mbody'), slavesList());
}
function gladHtml() {
  const c = S.char, w = S.world, A = S.st && S.st.ar, busy = !!A;
  const ups = (s) => Object.entries(D.GLAD_UP).map(([k, u]) => { const lv = s['g' + k] || 0; return lv < u.max ? `<button class="btn sm alt" data-a="gladUp" data-sid="${s.id}" data-k="${k}" title="${u.desc}">${u.name.split(' ')[0]} ${lv}→${lv + 1} (${u.ap(lv + 1)} оч.)</button>` : `<span class="tag">${u.name.split(' ')[0]} макс.</span>`; }).join('');
  const ludus = S.blds.find((b) => b.type === 'ludus' && b.owner === c.id && b.built);
  const slaves = (w.slaves || []).filter((s) => !s.hired).map((s) => { const rest = (s.rest || 0) > (S.st ? S.st.t : 0) && false; return `<div class="row"><span class="grow">${esc(s.name)} ${gradeTag(s)} <span class="muted">гладиатор ${s.glvl || 0} ур. · оружие ${s.gw || 0} · доспех ${s.ga || 0}${s.ludus ? ' · в школе' : ''}${s.gamesWon ? ` · 🏆 ${s.gamesWon}` : ''}</span></span><input id="gn_${s.id}" class="num" style="width:110px" placeholder="новое имя" maxlength="20"><button class="btn sm alt" data-a="gladName" data-sid="${s.id}" title="Дать гладиатору имя">✎</button>${ups(s)}${ludus ? (s.ludus ? `<button class="btn sm alt" data-a="gladLudus" data-sid="${s.id}" data-on="0">Из школы</button>` : `<button class="btn sm alt" data-a="gladLudus" data-sid="${s.id}" data-on="1">В школу</button>`) : ''}<button class="btn sm good" data-a="gladBout" data-sid="${s.id}" ${busy ? 'disabled' : ''}>На арену</button></div>`; }).join('') || '<div class="muted">Нет рабов. Купите у работорговца или возьмите пленника.</div>';
  const lions = (c.lions || []).map((l) => `<div class="row"><span class="grow">🦁 ${esc(l.name)}</span><button class="btn sm good" data-a="gladBout" data-lion="${l.id}" ${busy ? 'disabled' : ''}>Выпустить на арену</button></div>`).join('') || '<div class="muted">Львов нет. Убейте матёрого льва (Дидима, Мелита, Феррум) и приручите сетью — нужен свой Зверинец.</div>';
  const gear = Object.entries(D.ARENA_GEAR).map(([k, u]) => { const lv = (c.arenaGear || {})[k] || 0; return `<div class="row"><span class="nm" style="width:240px">${u.name}</span><span style="width:80px;color:var(--gold2)">${'●'.repeat(lv)}<span class="muted">${'○'.repeat(u.max - lv)}</span></span><span class="grow muted">${u.desc}</span>${lv < u.max ? `<button class="btn sm" data-a="arenaGear" data-k="${k}">${u.ap(lv + 1)} оч.</button>` : '<span class="tag">макс.</span>'}</div>`; }).join('');
  const shop = Object.entries(D.ARENA_SHOP).map(([k, it]) => `<div class="row"><span class="nm" style="width:240px">${it.name} <span class="muted">(у вас ${c.tamer || 0})</span></span><span class="grow muted">${it.desc}</span><button class="btn sm" data-a="arenaBuy" data-k="${k}">${it.ap} оч.</button></div>`).join('')
    + `<div class="row"><span class="nm" style="width:240px">Школа гладиаторов</span><span class="grow muted">${BUILDINGS.ludus.desc}</span><span class="tag">${BUILDINGS.ludus.ap} оч. · стройка (B → Частные)</span></div><div class="row"><span class="nm" style="width:240px">Зверинец для львов</span><span class="grow muted">${BUILDINGS.vivarium.desc}</span><span class="tag">${BUILDINGS.vivarium.ap} оч. · стройка (B → Частные)</span></div>`;
  return `<div class="card"><div class="t">Очки арены: ${c.ap || 0}</div><div class="muted">Очки дают за волны и поединки на арене и за победы своих гладиаторов. Свои рабы бьются против гладиаторов арены (проигравший раб не умирает — 3 минуты отдыхает).</div></div>
    <h3 class="sec">Мои гладиаторы</h3>${slaves}<h3 class="sec">Мои львы</h3>${lions}<h3 class="sec">Моё гладиаторское снаряжение (действует только на арене)</h3>${gear}<h3 class="sec">За очки арены</h3>${shop}`;
}
function slavesList(here) {
  const w = S.world, c = S.char;
  const my = S.blds.filter((b) => b.owner === c.id && b.built && BUILDINGS[b.type].slots);
  return (w.slaves || []).map((s) => { const at = S.blds.find((b) => b.id === s.bld); return `<div class="row"><span class="grow">${esc(s.name)} <span class="muted">(${esc(s.origin)})</span> ${gradeTag(s)} ${traitTag(s)}${s.hungry ? ' <span class="no">голодает</span>' : ''}${s.housed === false ? ' <span class="no">нет жилья</span>' : ''}</span><span class="nm muted">${at ? BUILDINGS[at.type].name : s.ship ? 'лучник на корабле' : s.ludus ? 'школа гладиаторов' : 'без дела'}</span>${here ? (s.bld === here.id ? `<button class="btn sm alt" data-a="slaveHere" data-id="${s.id}" data-bid="">Снять</button>` : `<button class="btn sm" data-a="slaveHere" data-id="${s.id}" data-bid="${here.id}">Сюда</button>`) : `<select id="sa_${s.id}"><option value="">— без дела —</option>${my.map((b) => `<option value="${b.id}" ${b.id === s.bld ? 'selected' : ''}>${BUILDINGS[b.type].name}</option>`).join('')}</select><button class="btn sm" data-a="slaveAssign" data-id="${s.id}">Назначить</button>`}<button class="btn sm alt" data-a="slaveFree" data-id="${s.id}" title="Отпустить на волю (+достоинство)">🕊</button></div>`; }).join('') || '<div class="muted">У вас нет работников. Купите их на Рынке.</div>';
}
function prodPanel(b) {
  const def = BUILDINGS[b.type], c = S.char, w = S.world, mine = b.owner === c.id;
  tabs([['prod', '🌾 Хозяйство']]);
  const store = Object.entries(b.store || {}).map(([k, n]) => `<div class="row"><span class="grow">${resName(k)}</span><b>${Math.floor(n)}</b>${mine && n >= 1 ? `<button class="btn sm" data-a="collect" data-bid="${b.id}" data-res="${k}">Забрать</button>` : ''}</div>`).join('') || '<div class="muted">Пока пусто — выработка идёт раз в минуту.</div>';
  const working = (w.slaves || []).filter((s) => s.bld === b.id).length;
  setHTML($('mbody'), `<div class="cols"><div><div class="card"><div class="t">${def.desc}</div><div class="muted">Выработка в минуту: ${Object.entries(def.prod).map(([k, n]) => `${resName(k)} ${n}`).join(', ')} × (0.3 + работники). Работников: ${working}/${def.slots}. Склад хозяйства до 160 ед.</div></div><h3>Запасы</h3>${store}${mine ? `<div style="margin-top:8px;display:flex;gap:6px"><button class="btn" data-a="collect" data-bid="${b.id}">Забрать всё в сумку</button><button class="btn alt" data-a="collect" data-bid="${b.id}" data-store="1">Сдать на склад колонии</button></div>` : '<div class="muted">Хозяйство принадлежит ' + esc(b.ownerName) + '</div>'}${repairBtn(b)}</div>
    <div>${mine ? `<button class="btn sm alt" data-a="autoStore" data-bid="${b.id}">Доставка на личный городской склад: ${b.autoStore ? 'вкл.' : 'выкл.'}</button><h3>Работники</h3>${slavesList(b)}` : ''}</div></div>`);
}
function colonyPanel(b) {
  const c = S.char, mine = b.owner === c.id;
  const isl = D.ISLANDS.find((i) => i.id === b.island), list = D.COLONY_RES[b.island] || [];
  tabs([['col', '🚩 Колония'], ['craft', '⛏ Промыслы']]);
  const store = Object.entries(b.store || {}).map(([k, n]) => `<div class="row"><span class="grow">${resName(k)}</span><b>${Math.floor(n)}</b></div>`).join('') || '<div class="muted">Пусто</div>';
  if (cur.tab === 'craft') {
    const cr = b.crafts || [1, 0, 0, 0, 0];
    const rows = list.map(([k], i) => { const ti = i < 3 ? 0 : i - 2, T2 = D.COLONY_TIERS[ti], lv = cr[i] || 0, cost = lv < D.COLONY_LV_MAX ? T2.cost(lv + 1) : null; const per = lv ? Math.round(T2.base * lv * (1 + (lv - 1) * 0.15) * 10) / 10 : 0;
      return `<div class="row"><span class="nm" style="width:190px">${resName(k)}</span><span class="tag" style="width:110px">${T2.name}</span><span style="width:90px;color:var(--gold2)">${'●'.repeat(lv)}<span class="muted">${'○'.repeat(D.COLONY_LV_MAX - lv)}</span></span><span class="muted" style="width:110px">${per}/мин</span><span class="grow">${cost ? costHtml(cost, c.bag) : '<span class="muted">высшая ступень</span>'}</span>${mine && cost ? `<button class="btn sm" data-a="colonyUp" data-bid="${b.id}" data-i="${i}">${lv ? 'Улучшить' : 'Открыть'}</button>` : ''}</div>`; }).join('');
    setHTML($('mbody'), `<div class="card"><div class="muted">У каждой колонии пять промыслов своего острова: три обычных, один редкий и один очень редкий. У каждого — своё здание, ступени 1–5, каждая дороже прежней. Выработка растёт и от работников.</div></div>${rows}`);
    return;
  }
  setHTML($('mbody'), `<div class="cols"><div><div class="card"><div class="t">${isl.name}</div><div>${isl.desc}</div><div class="muted">Промыслы: ${list.map(([k]) => resName(k)).join(', ')}. Запасы вывозят кораблём (подведите свой корабль и погрузите) или торговым путём.</div></div><h3>Запасы колонии</h3>${store}<div style="margin-top:8px;display:flex;gap:6px"><button class="btn" data-a="colonyLoad" data-bid="${b.id}">Погрузить на мой корабль</button>${mine ? `<button class="btn alt" data-a="collect" data-bid="${b.id}">Забрать в сумку</button>` : ''}</div>${repairBtn(b)}</div><div>${mine ? `<button class="btn sm alt" data-a="autoStore" data-bid="${b.id}">Доставка на личный городской склад: ${b.autoStore ? 'вкл.' : 'выкл.'}</button><h3>Работники</h3>${slavesList(b)}` : `<div class="muted">Основатель: ${esc(b.ownerName)}</div>`}</div></div>`);
}
// ---------- Кампус: снаряжение учёных, изучение пойманных, прогресс исследователей ----------
function campusPanel(b) {
  const c = S.char, w = S.world, Sx = c.sci || { tools: {}, rec: {}, caught: [], isl: {} };
  tabs([['tools', '🔭 Снаряжение и изучение'], ['isl', '🏝 Острова'], ['sci', '🎓 Учёные']]);
  if (cur.tab === 'isl') {
    const rows = D.ISLANDS.filter((i) => D.RESEARCH[i.id] && i.kind !== 'mainland').map((i) => { const R2 = D.RESEARCH[i.id]; const f = R2.flora.map((k) => `<span class="${Sx.rec[i.id + '|f:' + k] ? 'ok' : 'muted'}">🌿 ${D.PLANT_NAMES[k]}</span>`).join(', '), a = R2.fauna.map((k) => `<span class="${Sx.rec[i.id + '|a:' + k] ? 'ok' : 'muted'}">🐾 ${D.CRITTER_NAMES[k]}</span>`).join(', '); return `<div class="row"><span class="nm" style="width:220px">${Sx.isl[i.id] ? '✔ ' : ''}${i.name}</span><span class="grow">${f}<br>${a}</span></div>`; }).join('');
    setHTML($('mbody'), `<div class="card"><div class="muted">Остров считается открытым вами, когда описаны все его три растения и два животных. Растения описывают на месте (гербарный нож), животных ловят сетью и изучают здесь.</div></div>${rows}`); return;
  }
  if (cur.tab === 'sci') { const L = Object.values(w.sci || {}).sort((a, b) => b.n - a.n || b.rec - a.rec); setHTML($('mbody'), `<div class="card"><div class="t">Ваше звание: ${Sx.title || '—'}</div><div class="muted">Звания: ${D.SCI_TITLES.slice(1).map((t) => `${t.name} — ${t.n} ост.`).join(' · ')}</div></div>` + (L.map((r) => `<div class="row"><span class="grow">${esc(r.name)}</span><span class="nm">${r.n} островов · ${r.rec} описаний</span></div>`).join('') || '<div class="muted">Пока никто не исследовал.</div>')); return; }
  setHTML($('mbody'), Object.entries(D.SCI_TOOLS).map(([k, T]) => `<div class="row"><span class="nm" style="width:240px">${T.name}</span><span class="grow muted">${T.desc}</span><span class="nm" style="width:90px">у вас ${Sx.tools[k] || 0}</span><span class="nm">${T.price} ден.</span><button class="btn sm" data-a="sciBuy" data-k="${k}" data-n="${k === 'net' ? 5 : 1}">${k === 'net' ? 'Купить 5' : 'Купить'}</button></div>`).join('') + `<h3 class="sec">Карты сокровищ (${(Sx.maps || []).length}/3) · найдено кладов: ${Sx.treasures || 0}</h3>${(Sx.maps || []).map((m) => `<div class="row"><span class="grow">🗺 ${(D.ISLANDS.find((i) => i.id === m.island) || {}).name || m.island} — район отмечен на карте (M), копайте на месте (E)</span></div>`).join('') || '<div class="muted">Карты сокровищ добывают в разгромленных лагерях варваров, пиратском логове и на потопленных пиратских кораблях.</div>'}<h3 class="sec">Пойманные животные (${Sx.caught.length}/6)</h3>${Sx.caught.map((a) => `<div class="row"><span class="grow">🐾 ${D.CRITTER_NAMES[a.sp]} <span class="muted">(${(D.ISLANDS.find((i) => i.id === a.island) || {}).name || a.island})</span></span></div>`).join('') || '<div class="muted">Никого.</div>'}<div style="margin-top:8px"><button class="btn good" data-a="sciStudy" ${Sx.caught.length ? '' : 'disabled'}>Изучить всех</button></div>`);
}
// ---------- Курия: Эдил продаёт разрешения на клетки ----------
function curiaPanel(b) {
  const c = S.char, w = S.world, C = (S.W.cities || []).find((x) => x.id === b.city);
  tabs([['rank', '🦅 Звание'], ['aed', '📜 Эдил: участки'], ['mine', '📐 Мои клетки']]);
  if (cur.tab === 'rank') { const nx = RANKS[c.rank + 1], ok = nx && (c.rankEarned || 0) > c.rank; setHTML($('mbody'), `<div class="card"><div class="t">Ваше звание: ${RANKS[c.rank].name}</div><div class="muted">Новое звание даёт Рим: сначала нужно его одобрение (очки за помощь в стройке, рыбалку, дары в склад по заданиям лидеров и просто так, бесплатную передачу кораблей, ящики для Рима, голосование, освобождение рабов), затем — взнос здесь, в Курии.</div></div>` + (nx ? `<div class="row"><span class="grow">Следующее: <b>${nx.name}</b> — одобрение ${c.dig || 0} / ${nx.dig}, взнос ${nx.fee} ден.</span><button class="btn good" data-a="rankUp" ${ok && c.den >= nx.fee ? '' : 'disabled'}>Внести взнос</button></div>` : '<div class="muted">У вас высшее звание.</div>') + RANKS.map((r, i) => `<div class="row" style="${i === c.rank ? 'color:var(--gold2)' : ''}"><span class="grow">${r.name}</span><span class="muted">одобрение ${r.dig} · взнос ${r.fee} · частных построек ${r.priv} · рабов ${r.slaves} · клеток ${r.cells}</span></div>`).join('')); return; }
  const pm = c.permits || {}, cells = Object.values(w.plots || {}).filter((o) => o === c.id).length, perm = Object.values(pm).reduce((a, n) => a + n, 0);
  if (cur.tab === 'mine') {
    const by = {}; for (const [k, o] of Object.entries(w.plots || {})) if (o === c.id) { const [cid] = k.split(':'); by[cid] = (by[cid] || 0) + 1; }
    setHTML($('mbody'), `<div class="card"><div class="stat"><span>Размечено клеток</span><span>${cells}</span></div><div class="stat"><span>Неиспользованные разрешения</span><span>${perm}</span></div><div class="stat"><span>Предел по званию</span><span>${c.cellLimit || '?'}</span></div><div class="stat"><span>Доход с домов и лавок за всё время</span><span>${c.rentGot || 0} ден.</span></div></div>` + (Object.entries(by).map(([cid, n]) => `<div class="row"><span class="grow">${(S.W.cities.find((x) => x.id === cid) || {}).name || cid}</span><span class="nm">${n} клеток</span></div>`).join('') || '<div class="muted">Клеток пока нет.</div>') + (C ? `<div style="margin-top:8px"><button class="btn sm alt" data-a="release" data-city="${C.id}">Освободить незастроенные клетки в ${C.name}</button></div>` : ''));
    return;
  }
  const rows = Object.entries(D.DISTRICTS).map(([k, d]) => { const have = pm[(C && C.id) + ':' + k] || 0, k2 = (hasOff('aedilis') ? 0.8 : 1) * D.derived(c).buy, pr = Math.max(1, Math.round(d.price * D.PERMIT_K * k2));
    return `<div class="row"><span class="nm" style="width:220px"><span style="color:${d.color}">■</span> ${d.name}</span><span style="width:150px">разрешение ${pr} ден.<br><span class="muted">клетка ${Math.round(d.price * 0.7 * k2)}–${Math.round(d.price * 1.8 * k2)} ден.</span>${d.rare ? '<br><span class="muted">+ ' + Object.entries(d.rare).map(([r, v]) => `${resName(r)} ×${v}`).join(', ') + '</span>' : ''}</span><span class="muted" style="width:120px">от звания «${RANKS[d.rank].name}»</span><span class="muted" style="width:120px">доход и выработка ×${d.mul}</span><span class="grow">${have ? `<b>разрешений: ${have}</b>` : ''}</span><input id="pm_${k}" class="num" value="9"><button class="btn sm" data-a="permit" data-city="${C && C.id}" data-d="${k}" ${c.rank < d.rank ? 'disabled' : ''}>Купить</button></div>`; }).join('');
  setHTML($('mbody'), `<div class="card"><div class="t">Эдил ${C ? C.name : ''}</div><div class="muted">Участки 4×4 м жилого квартала находятся в четверти города справа от кардо, со стороны суши (на карте — зелёный район). Кольцо вокруг форума остаётся общественным. Купите у Эдила разрешение на нужное число клеток в районе, затем разметьте участок на месте (кнопка «Разметить» есть и в окне Хозяйства K → «Владения»). Каждая клетка оплачивается при разметке по своей цене: у форума и гавани дороже, на окраине дешевле. В стенах (центр и окраина) — общественные постройки (таверна, баня, кузница, инсула, дом…), при гавани — пристань, верфь, пурпурная ферма, за стенами — сельские (ферма, конюшня, хлев…). Чем дороже район — тем быстрее производство и больше доход хозяина.</div></div>${rows}${hasOff('aedilis')?`<div class="card"><button class="btn" data-a="roadMode" data-city="${C?.id}">🛣 Проложить улицу: 1 клетка</button><p>Камень ×${BUILDINGS.via_cell.cost.stone}. Только свободные клетки, от главной дороги. Занимать купленные участки нельзя.</p></div>`:''}
    <div class="card"><div class="stat"><span>Ваши клетки / разрешения / предел</span><span>${cells} / ${perm} / ${c.cellLimit || '?'}</span></div><div style="margin-top:6px"><button class="btn good" data-a="claimMode" data-city="${C && C.id}" ${perm ? '' : 'disabled'}>📐 Разметить участок</button> <span class="muted">колесо — размер, ЛКМ — разметить, Esc — выход</span></div></div>`);
}
function domusPanel(b) {
  const c = S.char, mine = b.owner === c.id;
  tabs([['home', '⌂ Дом']]);
  setHTML($('mbody'), `<div class="card"><div class="t">Дом ${esc(b.ownerName)}</div><div class="muted">${mine ? (c.home === b.id ? 'Вы возрождаетесь здесь.' : 'Сделайте дом местом возрождения.') : ''}</div></div>${mine && c.home !== b.id ? `<button class="btn" data-a="home" data-bid="${b.id}">Возрождаться здесь</button>` : ''} ${repairBtn(b)}`);
}
function castraPanel(b) {
  const w = S.world, c = S.char;
  tabs([['army', '🦅 Казармы']]);
  const leg = hasOff('legatus');
  setHTML($('mbody'), `<div class="card"><div class="t">Гарнизон: ${w.garrison} легионеров</div><div class="muted">Легионеры патрулируют город и сражаются с налётчиками. Предел — 4 плюс по одному за каждую сторожевую башню. Нанимает легат за 100 ден. из казны (в казне ${w.treasury}).</div></div>
    ${leg ? `<button class="btn" data-a="office" data-act="hire">Нанять легионера (100 из казны)</button> <button class="btn alt" data-a="office" data-act="muster">Объявить сбор</button>` : `<div class="muted">Распоряжается легат: ${w.offices.legatus ? esc(w.offices.legatus.name) : 'должность свободна — выборы на Форуме'}.</div>`}
    <div class="card" style="margin-top:10px"><div class="stat"><span>Угроза Карфагена</span><span>${w.threat}%</span></div><div class="muted">Угрозу снижают: отбитые высадки, потопленные корабли Карфагена, штурм Цитадели Пунийской крепости (подземелье).</div></div>${repairBtn(b)}`);
}
function tabernaPanel(b) {
  tabs([['q', '🗒 Поручения'], ['food', '🍷 Еда']]);
  if (cur.tab === 'q') setHTML($('mbody'), questBoard());
  else setHTML($('mbody'), shopHtml(['bread', 'wine', 'meat', 'f_mackerel'], [], false));
}
function arenaPanel(b) {
  const w = S.world, c = S.char, A = S.st && S.st.ar;
  MB_PRE+=`<div class="card"><div class="row" style="border:0"><span class="grow muted">${S.spect?.bid===b.id?'Вы сидите на трибуне. E открывает меню, вкладки и ставки доступны.':'С трибуны можно наблюдать игры и делать ставки.'}</span>${S.spect?.bid===b.id?'<button class="btn sm alt" data-a="arenaLeave">Встать и выйти с трибуны</button>':`<button class="btn sm good" data-a="arenaSit" data-bid="${b.id}">🪑 Сесть на трибуну</button>`}</div></div>`;
  tabs([['games', '🏟 Игры'], ['glad', `🛡 Гладиаторы (${c.ap || 0} оч.)`], ['duel', '⚔ Поединок']]);
  if (cur.tab === 'glad') { setHTML($('mbody'), gladHtml()); return; }
  if (cur.tab === 'games' && A && A.mode === 'games') { // Великие игры: ставки на любого гладиатора
    setHTML($('mbody'), `<div class="card"><div class="t">🏆 Великие игры — бой «все против всех»</div><div class="muted">${A.st === 'prep' ? `Ставки ещё ${A.t} с. Поставьте на любого гладиатора: весь банк делят те, кто угадал победителя (ланисте — 10%).` : 'Идёт бой! Победит последний, кто устоит на песке.'}</div>${A.st === 'prep' ? '<div style="margin-top:6px">Сумма: <input id="betN" class="num" value="25"></div>' : ''}</div>` + A.list.map((g) => `<div class="row"><span class="grow">🛡 <b>${esc(g.name)}</b> <span class="muted">— ${esc(g.owner)}</span></span>${A.st === 'prep' ? `<button class="btn sm good" data-a="bet" data-on="${g.key}">Ставлю</button>` : ''}</div>`).join(''));
    return;
  }
  if (cur.tab === 'games') {
    let h = `<div class="card"><div class="t">🏆 Великие игры</div><div class="muted">Раз в 3 дня в полдень — обязательные игры, даже если на сервере никого нет: лучшие рабы-гладиаторы всех граждан и гладиаторы арены бьются в одном бою «все против всех». Победитель — последний на песке: хозяину 300 ден. и 20 очков арены, проигравшие ранены, но живы. ${w.gamesIn != null ? (w.gamesIn <= 0 ? 'Следующие — сегодня в полдень.' : `Следующие — через ${w.gamesIn} дн.`) : ''}</div>${(w.gamesLog || []).length ? `<div style="margin-top:6px">${w.gamesLog.map((g) => `<div class="muted">День ${g.day}: 🏆 ${esc(g.name)} (${esc(g.owner)})</div>`).join('')}</div>` : ''}</div>`;
    h += `<div class="card"><div class="t">Гладиаторские бои: волны противников</div><div class="muted">Откройте игры и выйдите на песок арены за 15 секунд. Каждая волна сильнее: мирмиллоны, ретиарии, фракийцы, звери, а на 5-й и 10-й — чемпион Капуи. Награда за каждую волну; прошедшим все 10 — рудис чемпиона. Поражение на арене не смертельно. Рекорд колонии: ${w.arenaRecord} волн.</div></div>`;
    if (!A) h += `<button class="btn" data-a="arena">Открыть игры</button>${hasOff('lanista') ? ' <button class="btn alt" data-a="arena" data-grand="1">Большие игры (150 из казны, награды ×2)</button>' : ''}`;
    else if (A.st === 'prep' && !A.duel) h += `<div class="card">Сбор бойцов: ${A.t} с. Зрители, ставки: <input id="betN" class="num" value="25"> <button class="btn sm" data-a="bet" data-on="w3">Дойдут до 3-й волны (×2)</button> <button class="btn sm" data-a="bet" data-on="w5">До 5-й (×4)</button> <button class="btn sm" data-a="bet" data-on="w8">До 8-й (×8)</button></div>`;
    else h += `<div class="card">Идёт бой: волна ${A.wave}, бойцов ${A.f.length}.</div>`;
    h += '<div class="card muted">Во время боя на песке остаются только бойцы. Зрители могут пользоваться меню и выйти с трибуны в любое время.</div>';
    setHTML($('mbody'), h);
  } else {
    let h = '<div class="muted" style="margin-bottom:8px">Вызовите игрока у Амфитеатра на поединок (до поражения, не насмерть). Зрители ставят на победителя.</div>';
    if (A && A.duel && A.st === 'prep') h += `<div class="card">Ставки: <input id="betN" class="num" value="25"> ${A.names.map((n, i) => `<button class="btn sm" data-a="bet" data-on="p" data-pid="${A.ids[i]}">${esc(n)}</button>`).join(' ')}</div>`;
    h += [...S.roster.values()].filter((q) => q.id !== S.myId).map((q) => `<div class="row"><span class="grow">${esc(q.name)} <span class="muted">ур. ${q.level}</span></span><button class="btn sm" data-a="duel" data-pid="${q.id}">Вызвать</button></div>`).join('') || '<div class="muted">Нет других игроков.</div>';
    setHTML($('mbody'), h);
  }
}
function portPanel(b) {
  const c = S.char, w = S.world;
  tabs([['ships', '⚓ Верфь'], ['mine', '⛵ Мои корабли'], ['catch', '🐟 Рыбный причал'],['q','🗒 Задания гавани'], ...(b.city === 'messana' ? [['ferry', '⛵ Переправа в Регий']] : [])]);
  if(cur.tab==='q'){setHTML($('mbody'),'<p>Поручения гавани: улов, снабжение и торговля. Отдельная доска, обновление раз в 10 минут.</p>'+questBoard('harbor',b.city));return;}
  if (cur.tab === 'ferry') { setHTML($('mbody'), `<div class="card"><div class="t">Регий и Поле Марса</div><div class="muted">Напротив гавани Мессаны, на Бруттии, — гавань Регия: деревня и дом распорядителя игр. Там бьются армиями — с ботами и с игроками, за военные очки и рейтинг полководцев. По Бруттию просто гулять нельзя: туда приплывают на своём корабле или переправляются здесь.</div><div style="margin-top:8px"><button class="btn good" data-a="ferry" data-to="regium">⛵ Переправиться в Регий (${D.WAR.ferry} ден.)</button></div></div>`); return; }
  if (cur.tab === 'catch' && c.tunaCarry){setHTML($('mbody'),`<div class="card"><h3>Свежий тунец: ${c.tunaCarry.kg} кг</h3><p>Улов принесён с баркаса. Покупатель платит ${Math.round(c.tunaCarry.kg*.9*D.derived(c).sell)} денариев.</p><button class="btn good" data-a="tunaSell" data-bid="${b.id}" ${S.ship?'disabled':''}>Продать принесённого тунца</button></div>`);return;}
  if (cur.tab === 'catch') { const fish = Object.entries(c.bag).filter(([k, n]) => RES[k] && RES[k].fish && n >= 1); const moored = w.ships.filter((s) => s.owner === c.id && s.berth && s.berth.startsWith('b' + b.id + ':')); const hold = moored.flatMap((s) => Object.entries(s.cargo || {}).filter(([k, n]) => RES[k] && RES[k].fish && n >= 1));
    setHTML($('mbody'), `<div class="card"><div class="muted">Рыбаки гавани берут свежий улов прямо с причала — дороже скупщика (×1.15). Пришвартуйте баркас или лодку (G у руля) и сдайте рыбу из трюма или из сумки. Гарпунного тунца сначала выгрузите с баркаса (G → Корабль → Взять тунца), затем принесите сюда в руках.</div></div><h3 class="sec">В сумке</h3>${fish.map(([k, n]) => `<div class="row"><span class="grow">${resName(k)} ×${Math.floor(n)}</span></div>`).join('') || '<div class="muted">Рыбы нет.</div>'}<h3 class="sec">В трюме пришвартованных кораблей</h3>${hold.map(([k, n]) => `<div class="row"><span class="grow">${resName(k)} ×${Math.floor(n)}</span></div>`).join('') || '<div class="muted">Пусто.</div>'}<div style="margin-top:8px"><button class="btn good" data-a="sellCatch" data-bid="${b.id}" ${fish.length || hold.length ? '' : 'disabled'}>Сдать весь улов</button></div>`); return; }
  if (cur.tab === 'ships') setHTML($('mbody'), Object.entries(SHIPS).map(([k, s]) => `<div class="card"><div class="row" style="border:0"><span class="grow t">${s.name}</span><span class="nm muted">скорость ${s.speed}, мест ${s.seats}, трюм ${s.cargo}, прочность ${s.hp}${s.ram ? ', таран' : ''}</span></div><div class="muted">${s.desc}</div><div class="row" style="border:0"><span class="grow" style="font-size:12px">${costHtml(s.cost, c.bag)}${s.rank ? ` · звание «${RANKS[s.rank].name}»` : ''}</span><button class="btn sm" data-a="shipBuild" data-st="${k}" ${(s.rank || 0) > c.rank ? 'disabled' : ''}>Построить</button></div></div>`).join(''));
  else setHTML($('mbody'), shipsList());
}
function shipsList() { return myShipsHtml(); }

function renderCamp() {
  const c = S.char;
  $('mtitle').textContent = 'Лагерь колонистов';
  tabs([['trade', '⚖ Купец Луций'], ['slv', '⛓ Работорговец'], ['q', '🗒 Задания'], ['craft', '🔨 Верстак'], ['store', '📦 Запасы']]);
  if (cur.tab === 'slv') { setHTML($('mbody'), slaveTradeHtml()); return; }
  if (cur.tab === 'trade') setHTML($('mbody'), shopHtml(['bread', 'bandage', 'arrow', 'wood', 'stone', 'plank', 'calamus', 'linen'], ['knife', 'gladius', 'axe', 'pick', 'rod', 'torch', 'parma', 'galea_bronze', 'bow']));
  else if (cur.tab === 'q') setHTML($('mbody'), questBoard());
  else if (cur.tab === 'craft') setHTML($('mbody'), RECIPES.filter((r) => ['plank', 'bandage', 'leather'].includes(r.id)).map((r) => { const can = Object.entries(r.in).every(([k, n]) => (c.bag[k] || 0) >= n); return `<div class="row"><span class="nm" style="width:200px">${r.n}</span><span class="grow">${costHtml(r.in, c.bag)}</span><button class="btn sm" data-a="craft" data-id="${r.id}" data-n="1" ${can ? '' : 'disabled'}>Сделать</button><button class="btn sm alt" data-a="craft" data-id="${r.id}" data-n="10" ${can ? '' : 'disabled'}>×10</button></div>`; }).join('') + '<div class="muted" style="margin-top:8px">Полная мастерская появится, когда колония построит её в городе.</div>');
  else storePanel(null);
}
function renderInst() {
  const k = cur.key, ins = INSTANCES[k], c = S.char;
  $('mtitle').textContent = ins.name;
  tabs([['i', '⛏ Подземелье']]);
  const cd = (c.instCd[k] || 0) - Date.now() / 1000 - (S.clockOff || 0);
  const locked = k === 'tomb' && !(S.world.flags && S.world.flags.scraps);
  setHTML($('mbody'), `<div class="card"><div class="t">${ins.name}</div><div>${ins.desc}</div><div class="muted">Рекомендуемый уровень: ${ins.lvl} (у вас ${c.level}). Залов: ${ins.rooms}. Главарь: ${ENEMIES[ins.boss].name}. Добыча: ${Object.keys(ins.loot).map(resName).join(', ')}; шанс редкого снаряжения: ${ins.gear.map((g) => GEAR[g].name).join(', ')}.</div>${cd > 0 ? `<div class="muted">Сокровищница для вас обновится через ${fmtT(cd)} (войти можно — опыт и задания засчитаются).</div>` : ''}</div>${locked ? '<div class="card">Вход завален песком. Узнайте путь у писца на Мелите (сюжет).</div>' : `<button class="btn" data-a="instEnter" data-key="${k}">Спуститься${c.level < ins.lvl - 2 ? ' (опасно!)' : ''}</button>`}<div class="muted" style="margin-top:8px">Заходите группой: все, кто войдёт, пока подземелье не пройдено, окажутся вместе.</div>`);
}
function renderShip() {
  const sid = S.ship || nearMyShip(); const c = S.char, w = S.world;
  const s = w.ships.find((x) => x.id === sid);
  if (!s) { closeModal(); return; }
  $('mtitle').textContent = s.name;
  const port = Object.entries(PORTS).find(([, p]) => Math.hypot(p.x - S.me.x, p.z - S.me.z) < p.r + 40);
  const tl = [['cargo', '📦 Трюм'], ['crates', `▣ Ящики (${(s.crates || []).length}/${SHIPS[s.type].crates})`]]; if (s.owner === c.id) tl.push(['manage', '⚙ Корабль']); if (port && S.ship) tl.push(['port', '⚓ ' + port[1].name]);
  tabs(tl);
  if (cur.tab === 'crates' || cur.tab === 'manage') { setHTML($('mbody'), (cur.tab === 'crates' ? shipCardHtml(s, false) : shipCardHtml(s, true)) + (S.ship ? '<div style="margin-top:10px"><button class="btn sm alt" data-a="leaveShip">⚓ Сойти на берег</button></div>' : '')); return; }
  if (cur.tab === 'port' && port) { const rome = port[0] === 'ostia' ? `<h3 class="sec">🦅 Ящики для Рима (квестор)</h3><div class="muted">Сданные ящики идут в зачёт задания «Хлеб для Рима».</div>` + ((s.crates || []).map((k, i) => `<div class="row"><span class="grow">📦 ${crateName(k)}</span><button class="btn sm good" data-a="crateSell" data-tid="tr_rome" data-sid="${s.id}" data-i="${i}">Сдать Риму</button></div>`).join('') || '<div class="muted">В трюме нет ящиков.</div>') : ''; setHTML($('mbody'), `<div class="card">${port[1].desc} Товары с ↑ здесь дороже обычного.</div>` + rome + shopHtml(port[1].sells.filter((k) => RES[k]), port[1].sells.filter((k) => GEAR[k]), false, port[0]) + cargoSellHtml(s, port[0])); return; }
  const def = SHIPS[s.type];
  const used = Object.entries(s.cargo).reduce((a, [k, n]) => a + (RES[k]?.w || 1) * n, 0);
  const cargo = Object.entries(s.cargo).filter(([, n]) => n >= 1).map(([k, n]) => `<div class="row"><span class="grow">${resName(k)}</span><b>${Math.floor(n)}</b><button class="btn sm alt" data-a="cargo" data-sid="${s.id}" data-res="${k}" data-n="${Math.floor(n)}" data-dir="out">В сумку</button></div>`).join('') || '<div class="muted">Трюм пуст</div>';
  const bag = Object.entries(c.bag).filter(([k, n]) => n >= 1 && RES[k]).map(([k, n]) => `<div class="row"><span class="grow">${resName(k)}</span><span class="nm">${Math.floor(n)}</span><button class="btn sm" data-a="cargo" data-sid="${s.id}" data-res="${k}" data-n="${Math.floor(n)}" data-dir="in">В трюм</button></div>`).join('') || '<div class="muted">Сумка пуста</div>';
  setHTML($('mbody'), `<div class="card"><div class="stat"><span>Трюм</span><span>${Math.round(used)} / ${def.cargo}</span></div><div class="stat"><span>Прочность</span><span>${s.hp}/${s.maxHp}</span></div><div class="muted">Порты для торговли — за краем карты: Остия (север), Александрия (юго-восток), Массилия (запад). Подплывите к порту и откройте трюм (G).</div></div><div class="cols"><div><h3>Сумка → трюм</h3>${bag}</div><div><h3>Трюм</h3>${cargo}</div></div>`);
}
// ---------- Корабли игрока: трюм с ящиками, лучники, улучшения, ремонт ----------
const sGrade = (s) => s.grade || Math.max(1, Math.min(3, s.skill || 1));
const traitTag = (s) => { const T = D.SLAVE_TRAITS[s.trait]; return T ? `<span class="tag" title="${T.desc}. Сила ${s.str || 5}, ловкость ${s.agi || 5}, выносливость ${s.end || 5}">${T.icon} ${T.name} · ${s.str || 5}/${s.agi || 5}/${s.end || 5}</span>` : ''; };
const gradeTag = (s) => { const g = sGrade(s), G2 = D.SLAVE_GRADES[g]; return `<span class="tag g${g}" title="${G2.name}: работа ×${G2.eff}, лучник ${G2.arch} урона, гладиатор ×${G2.glad}">${'◆'.repeat(g)} ${G2.name}</span>`; };
function slaveTradeHtml() {
  const w = S.world, c = S.char, lim = c.slaveLimit ?? RANKS[c.rank].slaves, mine = (w.slaves || []);
  const buy = (w.slaveMarket || []).map((s) => `<div class="row"><span class="grow">${esc(s.name)} <span class="muted">(${esc(s.origin)})</span></span>${gradeTag(s)} ${traitTag(s)}<span class="nm" style="width:80px">${Math.round(s.price * D.derived(c).buy)} ден.</span><button class="btn sm" data-a="slaveBuy" data-id="${s.id}" ${mine.length >= lim ? 'disabled title="лимит по званию"' : ''}>Купить</button></div>`).join('') || '<div class="muted">Сейчас продавать некого — новых привозят каждые 10 минут.</div>';
  const sell = mine.filter((s) => !s.hired).map((s) => `<div class="row"><span class="grow">${esc(s.name)} <span class="muted">${s.glvl ? `гладиатор ${s.glvl} ур.` : ''}</span></span>${gradeTag(s)}<button class="btn sm alt" data-a="slaveSell" data-id="${s.id}">Продать</button></div>`).join('') || '<div class="muted">Своих рабов нет.</div>';
  return `<div class="card"><div class="t">Работорговец</div><div class="muted">Рабов четыре разряда: чем выше, тем лучше работают, сильнее стреляют лучниками и бьются гладиаторами. 4-й разряд — бывшие вожди, военачальники и капитаны. Рабов можно и взять в плен: поверженный варвар, карфагенянин или пират иногда встаёт на колено — подойдите и нажмите E. Лимит по званию: ${mine.length}/${lim} (от 2 до 15).</div></div><h3 class="sec">Купить</h3>${buy}<h3 class="sec">Продать своих</h3>${sell}`;
}
const crateName = (k) => D.CRATES[k] ? `${'▣'.repeat(D.CRATES[k].grade)} ${D.CRATES[k].name}` : k;
function shipCardHtml(s, full = true) {
  const c = S.char, def = SHIPS[s.type], mine = s.owner === c.id, access = mine || (!s.owner && s.starter);
  const pos=C.ships.get(s.id)?.obj.position, saleProblems=[];
  if (!pos || !S.blds.some(b=>b.type==='portus'&&b.built&&!b.ruined&&!b.enemy&&Math.hypot(b.x-pos.x,b.z-pos.z)<90&&Math.hypot(b.x-S.me.x,b.z-S.me.z)<90)) saleProblems.push('Вы и корабль должны быть у одной римской гавани');
  if (S.ship===s.id||[...C.players.values()].some(p=>p.ship===s.id)) saleProblems.push('Высадите всех пассажиров');
  if((s.tunaHold||[]).some(Boolean)||(s.crates||[]).length||Object.values(s.cargo||{}).some(n=>n>0)) saleProblems.push('Разгрузите трюм и ящики');
  if (s.route) saleProblems.push('Остановите торговый путь');
  const saleDisabled=saleProblems.length?'disabled title="'+esc(saleProblems.join('. '))+'"':'';
  const crates = (s.crates || []).map((k, i) => `<div class="row"><span class="grow">📦 ${crateName(k)}</span>${!c.carry && access ? `<button class="btn sm alt" data-a="crateUnload" data-sid="${s.id}" data-i="${i}">Взять в руки</button>` : ''}</div>`).join('') || '<div class="muted">Ящиков на борту нет.</div>';
  let html = `<div class="card"><div class="t">${esc(s.name)} <span class="muted">· ${def.name}</span></div><div class="stat"><span>Прочность</span><span>${s.hp}/${s.maxHp}</span></div><div class="stat"><span>Ящики</span><span>${(s.crates || []).length} / ${def.crates}</span></div>${s.berth ? '<div class="muted">⚓ стоит у причала</div>' : ''}</div>
    <h3 class="sec">Ящики на борту</h3>${crates}${c.carry && access ? `<button class="btn sm" data-a="crateLoad" data-sid="${s.id}" style="margin-top:6px">Погрузить ящик из рук (${crateName(c.carry)})</button>` : ''}`;
  if(s.type==='barca')html+=`<div class="card"><h3>Носовой гарпун и два места улова</h3><p>На борту: H — гарпун, ЛКМ — выстрел, Пробел — тянуть; отпускайте во время рывков. Для выгрузки сойдите на берег рядом с баркасом.</p>${[0,1].map(i=>`<div class="row"><span class="grow">${i===0?'Левый':'Правый'} борт: ${s.tunaHold?.[i]?`тунец ${s.tunaHold[i].kg} кг`:'свободно'}</span>${mine&&s.tunaHold?.[i]?`<button class="btn sm" data-a="tunaUnload" data-sid="${s.id}" data-slot="${i}" ${S.ship||c.tunaCarry||c.carry?'disabled':''}>Взять тунца</button>`:mine&&c.tunaCarry?`<button class="btn sm" data-a="tunaLoad" data-sid="${s.id}" data-slot="${i}">Вернуть на борт</button>`:''}</div>`).join('')}${c.tunaCarry?`<p>В руках: тунец ${c.tunaCarry.kg} кг. Несите к гавани → Рыбный причал.</p>`:''}</div>`;
  if (!mine && s.forSale) html += `<div class="row"><span class="grow">⚖ Продаётся владельцем за <b>${s.forSale}</b> ден.</span><button class="btn sm good" data-a="shipBuy" data-sid="${s.id}">Купить</button></div>`;
  if (!full || !mine) return html;
  html += `<h3 class="sec">Продать или передать</h3>${saleProblems.length?`<div class="muted">Для продажи: ${saleProblems.map(esc).join(' · ')}</div>`:''}<div class="row"><span class="grow muted">Риму — в римской гавани у причала: продажа за 55% стоимости материалов или безвозмездный дар (большое одобрение Рима). Другим гражданам — выставьте цену, покупатель подойдёт и купит.</span></div><div class="row"><button class="btn sm" data-a="shipRome" data-sid="${s.id}" ${saleDisabled}>Продать Риму</button><button class="btn sm good" data-a="shipRome" data-sid="${s.id}" data-gift="1" ${saleDisabled}>Подарить Республике</button><input id="sale_${s.id}" class="num" value="${s.forSale || 1000}"><button class="btn sm alt" data-a="shipForSale" data-sid="${s.id}">${s.forSale ? 'Изменить цену' : 'Выставить на продажу'}</button>${s.forSale ? `<button class="btn sm alt" data-a="shipForSale" data-sid="${s.id}" data-off="1">Снять</button>` : ''}</div>`;
  const myArch = (S.world.slaves || []).filter((x) => x.ship === s.id), free = (S.world.slaves || []).filter((x) => !x.ship && !x.bld);
  html += `<h3 class="sec">Лучники на борту (${myArch.length}/${def.archers})</h3>` + (myArch.map((x) => `<div class="row"><span class="grow">🏹 ${esc(x.name)} <span class="muted">${esc(x.origin || '')}</span></span><button class="btn sm alt" data-a="shipArcher" data-sid="${s.id}" data-slave="${x.id}" data-on="0">Снять</button></div>`).join('') || '<div class="muted">Никого. Лучники-рабы сами стреляют по пиратам и врагам в 45 м.</div>')
    + (myArch.length < def.archers ? free.map((x) => `<div class="row"><span class="grow muted">${esc(x.name)} — свободен</span><button class="btn sm" data-a="shipArcher" data-sid="${s.id}" data-slave="${x.id}" data-on="1">Поставить лучником</button></div>`).join('') : '');
  html += `<h3 class="sec">Улучшения (в Гавани)</h3>` + Object.entries(D.SHIP_UP).filter(([k]) => k !== 'ram' || def.ram).map(([k, u]) => { const lv = (s.up || {})[k] || 0; return `<div class="row"><span class="nm" style="width:210px">${u.name}</span><span style="width:70px;color:var(--gold2)">${'●'.repeat(lv)}<span class="muted">${'○'.repeat(u.max - lv)}</span></span><span class="grow muted">${u.desc}</span>${lv < u.max ? `<span class="nm" style="font-size:12px">${costHtml(u.cost(lv + 1), c.bag)}</span><button class="btn sm" data-a="shipUp" data-sid="${s.id}" data-k="${k}">Улучшить</button>` : '<span class="tag">макс.</span>'}</div>`; }).join('');
  if (s.hp < s.maxHp) html += `<h3 class="sec">Ремонт</h3><div class="row"><span class="grow muted">У Гавани: доски и лён по размеру повреждений.</span><button class="btn sm" data-a="shipRepair" data-sid="${s.id}">Починить</button></div>`;
  return html;
}
function myShipsHtml() {
  const c = S.char, w = S.world, mine = w.ships.filter((s) => s.owner === c.id), sunk = c.sunk || [];
  const live = mine.map((s) => shipCardHtml(s)).join('<hr class="sep">') || '<div class="muted">Своих кораблей нет. Их строят на Верфи в Гавани.</div>';
  const dead = sunk.map((k) => { const def = SHIPS[k.type], cost = Object.fromEntries(Object.entries(def.cost).map(([a, n]) => [a, Math.ceil(n * 0.4)])); return `<div class="row"><span class="grow">🌊 ${esc(k.name)} <span class="muted">· ${def.name} — затонул</span></span><span class="nm" style="font-size:12px">${costHtml(cost, c.bag)}</span><button class="btn sm" data-a="shipRepair" data-sid="${k.id}">Поднять и починить</button><button class="btn sm alt" data-a="shipScrap" data-sid="${k.id}">Списать остов</button></div>`; }).join('');
  return `<div class="card"><div class="t">Кораблей: ${mine.length} / ${D.shipLimit(c)}</div><div class="muted">Ящики: лодка — 2, торговая корбита — 10, военные — 4. Лоскуты чертежа квадриремы: ${c.quadScraps || 0}/4.</div></div><div class="muted">Затонувшие остовы не занимают места активного флота.</div>${live}${dead ? `<h3 class="sec">Затонувшие (поднимают на Верфи в Гавани за 40% стоимости)</h3>${dead}` : ''}`;
}
// ---------- Торговая гильдия ----------
$('tradeBtn').onclick=()=>open('guide');
$('plotsBtn').onclick=()=>{S.showPlots=S.showPlots===false; $('plotsBtn').textContent='▦ Участки: '+(S.showPlots?'видны':'скрыты');};
function warehousePanel(b) {
  tabs([['store','📦 Ресурсы']]); const c=S.char, allowed=b.owner===c.id||b.type==='supply_depot';
  const rows=(source,dir)=>Object.entries(source||{}).filter(([k,n])=>RES[k]&&n>=1).map(([k,n])=>`<div class="row"><span class="grow">${resName(k)} ×${Math.floor(n)}</span>${allowed?`<button class="btn sm" data-a="warehouseMove" data-bid="${b.id}" data-res="${k}" data-dir="${dir}" data-n="10000">${dir==='in'?'Положить':'Забрать'}</button>`:''}</div>`).join('')||'<div class="muted">Пусто</div>';
  const weight=Object.entries(b.store||{}).reduce((a,[k,n])=>a+(RES[k]?.w||1)*n,0);
  setHTML($('mbody'),`<div class="card"><b>${BUILDINGS[b.type].name}</b><p>${BUILDINGS[b.type].desc}</p><div>Занято: ${Math.round(weight)} / ${b.capacity} веса · область: ${esc(b.scope||'')}</div>${!allowed?'<div class="no">Личные ресурсы другого владельца: операции недоступны.</div>':''}</div><div class="warehouse-cols"><div><h3>Сумка → склад</h3>${rows(c.bag,'in')}</div><div><h3>Склад → сумка</h3>${rows(b.store,'out')}</div></div>${repairBtn(b)}`);
}
function housingPanel(b) {
  tabs([['home','🏠 Работники']]);const people=(S.world.slaves||[]).filter(s=>s.home===b.id);
  setHTML($('mbody'),`<div class="card">${BUILDINGS.quarters.desc}<p>Заселено: ${b.residents||0} / ${b.housing}. Общая вместимость вашего жилья: ${S.char.housing}. Два места доступны в стартовом лагере.</p></div>${people.map(s=>`<div class="row">${esc(s.name)} ${s.hungry?'· голодает':'· обеспечен едой'}</div>`).join('')||'<div class="muted">Свободные места: новые работники заселятся автоматически.</div>'}${repairBtn(b)}`);
}
function renderTradeGuide() {
  $('mtitle').textContent='Первая торговая поставка';tabs([['guide','📦 Пять шагов']]);
  const c=S.char,stage=c.tutorial||0,guild=S.blds.filter(b=>b.type==='collegium'&&b.built&&!b.ruined&&!b.enemy).sort((a,b)=>Math.hypot(a.x-S.me.x,a.z-S.me.z)-Math.hypot(b.x-S.me.x,b.z-S.me.z))[0];
  const trader=(S.W?.traders||[]).filter(t=>!t.river).sort((a,b)=>Math.hypot(a.x-S.me.x,a.z-S.me.z)-Math.hypot(b.x-S.me.x,b.z-S.me.z))[0];
  const marker=(p,label)=>p?`<button class="btn sm" data-a="guideTarget" data-x="${p.x}" data-z="${p.z}" data-label="${label}">Отметить: ${label} (${Math.round(Math.hypot(p.x-S.me.x,p.z-S.me.z))} м)</button>`:'';
  const steps=[['Гильдия','Городская Торговая гильдия уже стоит в Мессане. Подойдите и нажмите E. Пользоваться городской гильдией можно без строительства своей. Дополнительная: B → Общественные. Если гильдия разрушена, внесите ресурсы на её восстановление.',marker(guild,'Торговая гильдия')],['Рецепт и ящик','В гильдии выберите припасы: 4 хлеба, 6 пшеницы, 4 камыша и 1 доска. Нажмите «Собрать» — ящик окажется в руках.',''],['Погрузка','Подойдите к своему кораблю, откройте G → Ящики → «Погрузить ящик из рук». Для начала достаточно лодки.',''],['Доставка','Плывите к морскому торговцу. Он покупает упакованные товары. Подведите судно к причалу, откройте торговца. Если первым ящиком торгуете с Римом, зайдите в окно торговца Рима у Остии.',marker(trader,'Покупатель ящиков')],['Продажа','Продайте ящик из трюма. Продажа и завершение обучения подтвердятся в журнале сообщений.','']];
  setHTML($('mbody'),`<div class="card">${stage>=5?'Первая поставка выполнена. Можно развивать торговые посты и автоматические маршруты.':`Выполнено шагов: ${stage}/5. У ящиков, ресурсов в трюме и запасов гильдии разные места хранения.`}</div>`+steps.map(([title,text,action],i)=>`<div class="trade-step ${stage===i?'current':''}"><b>${stage>i?'✓':i+1}. ${title}</b><p>${text}</p>${action}</div>`).join(''));
}

function guildPanel(b) {
  if ((S.char.tutorial || 0) < 1) net({type:'tradeVisit',bid:b.id});
  const c = S.char; tabs([['g', '⚖ Торговая гильдия']]);
  const rows = Object.entries(D.CRATES).map(([k, d]) => `<div class="row"><span class="nm" style="width:240px">${crateName(k)}</span><span class="grow muted">${d.desc}<br>${costHtml(d.in, c.bag)}</span><span class="nm muted" style="width:120px">~${d.price} ден.${d.lvl ? `<br>с ${d.lvl} ур.` : ''}</span><button class="btn sm" data-a="crateCraft" data-k="${k}" ${(d.lvl || 0) > c.level ? 'disabled' : ''}>Собрать</button></div>`).join('');
  const store = Object.entries(c.guildCrates || {}).filter(([, n]) => n > 0).map(([k, n]) => `<div class="row"><span class="grow">📦 ${crateName(k)} <b>×${n}</b></span>${!c.carry ? `<button class="btn sm" data-a="crateTake" data-k="${k}">Взять в руки</button>` : ''}</div>`).join('') || '<div class="muted">Пусто.</div>';
  setHTML($('mbody'), `<div class="card"><div class="t">В руках: ${c.carry ? crateName(c.carry) : '—'}</div><div class="muted">Ящик несут в руках (только один). X — поставить на землю, E у корабля — погрузить. Торговцы на островах и у истоков рек покупают только ящики; у истоков рек платят меньше, чем в море.</div>${c.carry ? '<button class="btn sm alt" data-a="crateStore" style="margin-top:6px">Оставить на складе гильдии</button>' : ''}</div>
    <h3 class="sec">Собрать ящик</h3>${rows}<h3 class="sec">Мой склад в гильдии</h3>${store}${repairBtn(b)}`);
}
// ---------- Окно торговца ----------
export function openTrader(tid) { open('trader', { key: tid }); }
function renderTrader() {
  if ((S.char.tutorial || 0) === 3) net({type:'tradeVisit',tid:cur.key});
  const c = S.char, tr = (S.W.traders || []).find((x) => x.id === cur.key); if (!tr) { closeModal(); return; }
  $('mtitle').textContent = tr.name; tabs([['t', '⚖ Покупает ящики']]);
  const price = (k) => Math.round(D.CRATES[k].price * tr.mult * D.derived(c).sell);
  const table = Object.keys(D.CRATES).map((k) => `<div class="row"><span class="grow">${crateName(k)}</span><b>${price(k)} ден.</b></div>`).join('');
  const hand = c.carry ? `<div class="row"><span class="grow">В руках: 📦 ${crateName(c.carry)}</span><button class="btn sm good" data-a="crateSell" data-tid="${tr.id}">Продать за ${price(c.carry)}</button></div>` : '<div class="muted">В руках ящика нет.</div>';
  const near = S.world.ships.filter((s) => s.owner === c.id && (s.crates || []).length).map((s) => { const o = C.ships.get(s.id); return o && Math.hypot(o.obj.position.x - tr.x, o.obj.position.z - tr.z) < 50 ? s : null; }).filter(Boolean);
  const ship = near.map((s) => `<h3 class="sec">С корабля «${esc(s.name)}»</h3>` + s.crates.map((k, i) => `<div class="row"><span class="grow">📦 ${crateName(k)}</span><button class="btn sm good" data-a="crateSell" data-tid="${tr.id}" data-sid="${s.id}" data-i="${i}">Продать за ${price(k)}</button></div>`).join('')).join('');
  setHTML($('mbody'), `<div class="card"><div class="muted">${tr.river ? 'Торговец у истока реки: сюда добираются по реке на лодке, цены ниже морских.' : 'Морской торговец: везите ящики на кораблях, у причала — 2 места.'} Принимает только товары в ящиках (их собирают в Торговой гильдии).</div></div><h3 class="sec">Продать</h3>${hand}${ship}<h3 class="sec">Цены</h3>${table}`);
}
function cargoSellHtml(s, port) {
  const c = S.char, w = S.world;
  const rows = Object.entries(s.cargo).filter(([, n]) => n >= 1).map(([k, n]) => `<div class="row"><span class="grow">${resName(k)} <span class="muted">×${Math.floor(n)} в трюме</span></span><button class="btn sm" data-a="sell" data-res="${k}" data-n="${Math.floor(n)}" data-cargo="1">Продать всё из трюма</button></div>`).join('');
  return rows ? `<h3 style="margin-top:12px">Продать из трюма</h3>${rows}` : '';
}
// ---------- Энциклопедия: для чего каждое окно и вкладка и что там делать ----------
const ENC = {
  win: ['🪟 Окна (клавиши)', [
    ['Tab / I — Снаряжение', 'Сумка и снаряжение: надеть/снять оружие и доспехи, съесть еду, выбросить или продать вещь. Вес сумки ограничен — тяжёлая сумка замедляет.'],
    ['C — Персонаж', '«Характеристики» — раздать очки уровня (сила, ловкость, выносливость, красноречие). «Специализации» — путь развития (воин, торговец, земледелец, ремесленник, мореход…), на 5-й ступени — особый навык. «Звание и должности» — гражданское звание, взнос в Курии, ваши должности (их можно сложить). «Трофеи» — лучшая рыба.'],
    ['J — Журнал', '«Сюжет» — текущая глава истории. «Походы на города» — что сделать, чтобы ослабить вражеский город и взять его штурмом. «Задания» — взятые с доски объявлений. «События» и «Возможные события» — набеги, флоты, купцы, шторм. «Летопись» — что случилось в мире. «Развалины» — собранная история древних городов.'],
    ['K — Хозяйство и торговля', '«Морские пути» и «Караваны» — торговые пути от ваших постов. «Владения» — все ваши здания: доход, запасы, продать или снести. «Посты и заказы» — заказать ящики товаров. «Рабы и работники» — кто где работает. «Доходы и расходы» — книга денег по дням (доход бизнесов и расходы на здания раскрываются по статьям).'],
    ['U — Военное дело', '«Отряды» — набор, улучшения, приказы, «домой». «Телохранитель» — для должностных лиц. «Боевые корабли» — улучшения и лучники. «Заслуги» — военные очки и звания.'],
    ['M — Карта', 'Вся Сицилия и острова: города, ваши клетки, налётчики, клады. Легенда с фильтрами.'],
    ['B — Стройка', 'Здания по районам: в стенах, при гавани, за стенами, латифундия, дороги, колонии. Колесо или R — поворот, ЛКМ — поставить. «Снос» — убрать свою постройку.'],
    ['G — Корабль', 'Трюм и груз, ящики, лучники-рабы, улучшения. У руля G — пришвартоваться к мостику и сойти.'],
    ['H — Помощь', 'Как играть и все клавиши по группам. 📖 Энциклопедия — это окно. 🏆 Рейтинги — рыба, гладиаторы, полководцы.'],
  ]],
  city: ['🏛 Здания города (E у здания)', [
    ['Форум', '«Задания» — доска объявлений (обновляется каждые 10 минут). «Рим» — запросы Рима. «Выборы» — должности этого города, выдвинуться и голосовать. «Законы» — законы этого города: предлагают должностные лица своего ведомства, префект и сенатор — любые. «Казна», «Летопись». У ростр — «Речь».'],
    ['Курия', 'Взнос за следующее звание, разрешения Эдила на районы и разметка клеток под застройку.'],
    ['Лавки рынка и скупщик', 'Лавка покупает дорого, но только товары своего ряда; её можно купить (2 в каждом городе) и поставить своего раба продавцом. Скупщик берёт всё, но дешевле, и работает с 12:00 до 20:00. «Купить» и «Продать» — на разных вкладках, товары по группам.'],
    ['Невольничий рынок', 'Купить и продать рабов: у каждого разряд, характеристики и навык.'],
    ['Арсенал', '«Наёмники» — три вида отрядов по 3 воина, сразу. «Телохранитель» — для должностных лиц. «Дозорные города» — легат нанимает и улучшает стражу. «Призвать отряды» — вернуть отправленных домой.'],
    ['Казармы и гарнизон', 'Легат нанимает легионеров гарнизона и объявляет сбор.'],
    ['Мастерская, кузница, пекарня', 'Ремесло: видны шансы хорошего и отличного качества. В чужой мастерской — небольшая доплата хозяину.'],
    ['Общественная конюшня', 'Взять коня на сутки, купить коня насовсем, жеребята для владельцев своих конюшен.'],
    ['Амфитеатр (арена)', '«Игры» — волны противников, Великие игры раз в 3 дня и ставки. «Гладиаторы» — улучшения своих гладиаторов, имена, бои рабов. «Поединок» — вызвать игрока.'],
    ['Гавань', '«Верфь» — построить корабль. «Мои корабли». «Рыбный причал» — продать улов. В Мессане — переправа в Регий (Поле Марса).'],
    ['Кампус', 'Снаряжение учёного: гербарный нож и сеть — описывать растения, ловить животных и изучать развалины древних городов.'],
  ]],
  own: ['🏠 Свои здания', [
    ['Хозяйства (ферма, роща, виноградник…)', 'Производят ресурсы раз в минуту; работники ускоряют. Забрать можно всё сразу или по одному виду ресурса.'],
    ['Доход зданий', 'Каждое частное здание приносит хозяину денарии каждую минуту; сколько — видно во «Владениях» и в книге доходов.'],
    ['Инсула', 'Три комнаты: горожане платят понемногу каждую минуту, игроки снимают комнату на сутки.'],
    ['Своя конюшня', 'Жеребята растут 3 дня; продажа и аренда коней другим игрокам.'],
    ['Школа гладиаторов', 'В черте города: свои гладиаторы тренируются бесплатно, чужие платят вам за обучение и содержание; продажа и покупка гладиаторов (вам — 10% с чужих сделок).'],
    ['Латифундия и преторий', 'Вилла даёт земли вокруг; в претории набирают отряды.'],
  ]],
  war: ['⚔ Армия и Поле Марса', [
    ['Значки отрядов (над поясом)', 'Номер (1–5), численность, здоровье. Кнопки: ⚔ атаковать ближайшего врага, 🛡 стоять и держать оборону, ▦ сомкнуть строй плечом к плечу, 👣 за мной, 🏠 домой. 0 — отменить все приказы.'],
    ['Вид сверху (Z)', 'ПКМ по земле — идти, ПКМ по врагу — атаковать: пехота и конница идут строем, лучники и скорпионы стреляют издали.'],
    ['Распорядитель игр (Регий)', '«Бои и лобби» — собрать бой 1/2/3 на 1/2/3, занять место, отдать свободные места ботам. «Отряды на бой» — выбрать до 4 отрядов (свои, наёмники, аренда на один бой). «Рейтинг полководцев».'],
    ['Абордаж', 'Когда у вражеского корабля меньше 50% прочности — B у борта: корабли сцепляются мостиком, бой на палубах.'],
  ]],
};
function renderEnc() {
  $('mtitle').textContent = '📖 Энциклопедия';
  tabs(Object.entries(ENC).map(([k, [t]]) => [k, t]));
  const [, list] = ENC[cur.tab] || ENC.win;
  setHTML($('mbody'), `<div class="sgrid">${list.map(([t, d]) => `<div class="sgrp card"><h4>${t}</h4><div class="muted" style="line-height:1.45">${d}</div></div>`).join('')}</div>`);
}
function renderHelp() {
  $('mtitle').textContent = 'Как играть';
  tabs([['keys', '⌨ Управление'], ['goal', '🎯 Цели'], ['gfx', '⚙ Графика']]);
  if (cur.tab === 'keys') {
    const G0 = [
      ['🪟 Окна интерфейса', [['Tab / I', 'снаряжение и сумка'], ['C', 'персонаж, специализации, звание и должности'], ['J', 'журнал: сюжет, задания, события'], ['K', 'хозяйство и торговля (пути, владения, рабы, доходы и расходы)'], ['U', 'военное дело: отряды, телохранитель, заслуги'], ['M', 'карта'], ['B', 'строительство'], ['G', 'трюм корабля и груз'], ['H', 'эта справка'], ['Enter', 'чат']]],
      ['🚶 Движение', [['WASD', 'идти'], ['Shift', 'бег (тратит выносливость)'], ['Пробел', 'прыжок'], ['Q', 'перекат — неуязвимость на миг'], ['V', 'сесть на коня / спешиться'], ['Мышь', 'камера (клик — захватить мышь)'], ['Колесо', 'приближение']]],
      ['⚔ Бой', [['ЛКМ', 'удар; три удара подряд — серия (последний — выпад)'], ['ПКМ (удерживать)', 'блок щитом или оружием'], ['F', 'метнуть пилум'], ['R', 'перевязка'], ['Y', 'поесть']]],
      ['🛡 Отряды', [['1–5', 'выбрать отряд (значки над поясом)'], ['0', 'отменить все приказы — все идут за вами'], ['N', 'идти к прицелу'], ['O', 'за мной'], ['6', 'стоять'], ['L', 'строй: стеной / врассыпную'], ['Z', 'вид сверху: ПКМ по земле — идти, ПКМ по врагу — атаковать']]],
      ['⛵ Корабль', [['W/S', 'ход'], ['A/D', 'руль'], ['E', 'сойти на берег или на мостик'], ['G (у руля)', 'пришвартоваться к причалу и сойти'], ['B', 'абордаж (враг потрёпан меньше чем на 50%)'], ['X', 'продать ящики торговцу с борта'], ['F (квадрирема)', 'выстрел катапульты']]],
      ['🔧 Действия и прочее', [['E', 'действие; удерживать — рубить/добывать'], ['T', 'факел'], ['X', 'поставить ящик из рук на землю'], ['R (при стройке)', 'повернуть здание'], ['P', 'качество графики'], ['Рыбалка', 'удочка, ЛКМ по воде; при поклёвке держите рыбу в зелёной зоне']]],
    ];
    setHTML($('mbody'), `<div class="sgrid">${G0.map(([t, l]) => `<div class="sgrp"><h4>${t}</h4>${l.map(([a2, b2]) => `<div class="stat"><span><b>${a2}</b></span><span>${b2}</span></div>`).join('')}</div>`).join('')}</div>`);
  }
  else if (cur.tab === 'goal') setHTML($('mbody'), `<div class="card"><div class="t">Колония Рима на архипелаге</div><div>Мир общий и постоянный: всё, что вы построите, остаётся и после выхода из игры. Вместе развивайте город на главном острове, основывайте колонии на соседних островах, торгуйте с портами Империи, выполняйте запросы Рима и отражайте набеги варваров и Карфагена. Вместе освободите и восстановите города Сицилии. Начните с арены Мессаны и похода на Тиндариду.</div></div>
    <div class="cols"><div class="card"><div class="t">Развитие персонажа</div><div class="muted">Опыт — за бой, добычу, стройку, ремесло, рыбалку, задания. Уровень даёт очки характеристик. Звание поселенца (от Колониста до Сенатора) растёт от достоинства и открывает частные хозяйства, рабов, корабли и должности.</div></div>
    <div class="card"><div class="t">Хозяйство и торговля</div><div class="muted">Стройте фермы, рощи, виноградники, гончарни — покупайте рабов на Рынке и ставьте их работать. Колонии добывают железо, мрамор, пурпур, кедр и серебро, папирус — их надо вывозить кораблём. Дороже всего роскошь продаётся в Остии.</div></div>
    <div class="card"><div class="t">Общество</div><div class="muted">На Форуме — выборы (префект, легат, магистр торговцев, эдил, ланиста), законы и доска заданий. Голос весит по званию.</div></div>
    <div class="card"><div class="t">Угрозы</div><div class="muted">Варвары нападают на хозяйства. Флоты Карфагена высаживают десант — их можно перехватить в море на военных кораблях. Угроза растёт со временем: снижайте её победами и штурмом Пунийской крепости.</div></div></div>`);
  else setHTML($('mbody'), `<div class="muted">Сейчас: ${R.GFX.mode === 'auto' ? 'авто (' + R.GFX.names[R.GFX.level] + ')' : R.GFX.names[R.GFX.level]}</div><div style="display:flex;gap:6px;margin-top:8px"><button class="btn sm" data-a="gfx" data-v="auto">Авто</button><button class="btn sm" data-a="gfx" data-v="2">Высокая</button><button class="btn sm" data-a="gfx" data-v="1">Средняя</button><button class="btn sm" data-a="gfx" data-v="0">Экономная</button></div>`);
}
function openHelp() { open('help', { tab: 'goal' }); }
function setGfx(v) { R.GFX.mode = v === 'auto' ? 'auto' : Number(v); if (v !== 'auto') R.applyGfx(Number(v)); try { localStorage.setItem('imperiumGfx', String(v)); } catch {} }
export function cycleGfx() { const order = ['auto', 2, 1, 0]; const i = order.indexOf(R.GFX.mode); const v = order[(i + 1) % order.length]; setGfx(String(v)); addLog(`Графика: ${v === 'auto' ? 'авто' : R.GFX.names[v]}`, 'info'); }

// ---------- Карта ----------
let mapBase = null;
const MAPW = 5200, MAPH = MAPW / 2;
const mapView = { cx: 150, cz: 150, span: 3400 };
export function buildMapBase(W) {
  const N = 900, cv = document.createElement('canvas'); cv.width = N; cv.height = N;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -MAPH + i / N * MAPW, z = -MAPH + j / N * MAPW;
    const isl = WG.islandAt(x, z); const h = isl ? WG.terrainHeight(x, z) : -30;
    let r, g, b;
    if (h < -0.7) { const d = Math.min(1, -h / 20); r = 40 - d * 20; g = 110 - d * 50; b = 140 - d * 40; }
    else if (h < 1.6 || (isl && isl.biome === 'desert')) { r = 226; g = 204; b = 150; if (isl && isl.biome === 'desert' && h > 1.6) { r = 222; g = 190; b = 130; } }
    else if (isl && isl.biome === 'rock') { r = 150 + h; g = 140 + h; b = 120 + h; }
    else { const k = Math.min(1, h / 60); r = 100 + k * 70; g = 135 + k * 15; b = 70 + k * 60; }
    if (h > -0.7 && h < 0.3 && WG.waterEdgeDist(x, z) < 1) { r = 70; g = 140; b = 190; }
    const o = (j * N + i) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  mapBase = cv;
}
// значки карты рисуются фигурами (не эмодзи — те бывают квадратиками)
const MARK = {
  start_camp: { c: '#ffe9a8', sh: 'tent', n: 'Приют новоприбывших' }, pier: { c: '#c8a070', sh: 'pier', n: 'Причал' },
  barb_camp: { c: '#ff6a4a', sh: 'fire', n: 'Лагерь варваров' }, punic_fort: { c: '#d8443a', sh: 'fort', n: 'Пунийская крепость' },
  colony_site: { c: '#7fc6ff', sh: 'flag', n: 'Место для колонии' }, cave_entrance: { c: '#ffb050', sh: 'dia', n: 'Подземелье (пещера, шахта, крепость)' },
  mine_entrance: { c: '#ffb050', sh: 'dia' }, fortress_gate: { c: '#ffb050', sh: 'dia' }, tomb_entrance: { c: '#ffe070', sh: 'dia' }, spy_post: { c: '#d0a0ff', sh: 'dia', n: 'Тайник для слежки за городом' }, suburb_villa: { c: '#ff9a5a', sh: 'sq', n: 'Пригородная усадьба врага' },
  pyramid: { c: '#f0d8a0', sh: 'tri' }, scribe_hut: { c: '#ffffff', sh: 'sq' }, ruin: { c: '#d8d0c0', sh: 'col', n: 'Руины (сундук)' },
  shipwreck: { c: '#b8b0a0', sh: 'hull', n: 'Остов корабля (сундук)' }, volcano: { c: '#e0603a', sh: 'volc', n: 'Вулкан' },
  trader: { c: '#ffd24a', sh: 'sq', n: 'Торговец (покупает ящики)' }, sea_rock: { c: '#8a8278', sh: 'tri', n: 'Скала в море' }, sea_wreck: { c: '#c8a070', sh: 'hull', n: 'Обломки на скале (сундук с борта)' },
};
function drawMark(ctx, sh, c, x, y, r) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = c; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 1.2; ctx.beginPath();
  if (sh === 'tent' || sh === 'tri') { ctx.moveTo(0, -r); ctx.lineTo(r, r * 0.8); ctx.lineTo(-r, r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); if (sh === 'tent') { ctx.beginPath(); ctx.moveTo(0, -r * 0.1); ctx.lineTo(0, r * 0.8); ctx.stroke(); } }
  else if (sh === 'fire') { ctx.arc(0, 0, r * 0.9, 0, 6.28); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(0, -r * 0.55); ctx.quadraticCurveTo(r * 0.45, 0, 0, r * 0.5); ctx.quadraticCurveTo(-r * 0.45, 0, 0, -r * 0.55); ctx.fill(); }
  else if (sh === 'fort') { ctx.rect(-r, -r * 0.8, r * 2, r * 1.6); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(0,0,0,.6)'; for (let i = -1; i <= 1; i++) ctx.fillRect(i * r * 0.6 - r * 0.15, -r * 0.8, r * 0.3, r * 0.4); }
  else if (sh === 'flag') { ctx.moveTo(-r * 0.6, r); ctx.lineTo(-r * 0.6, -r); ctx.lineTo(r, -r * 0.5); ctx.lineTo(-r * 0.6, 0); ctx.stroke(); ctx.fill(); }
  else if (sh === 'dia') { ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (sh === 'sq') { ctx.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); ctx.fill(); ctx.stroke(); }
  else if (sh === 'col') { ctx.rect(-r * 0.35, -r * 0.6, r * 0.7, r * 1.4); ctx.rect(-r * 0.75, -r * 0.9, r * 1.5, r * 0.35); ctx.fill(); ctx.stroke(); }
  else if (sh === 'hull') { ctx.moveTo(-r, -r * 0.2); ctx.lineTo(r, -r * 0.2); ctx.lineTo(r * 0.5, r * 0.6); ctx.lineTo(-r * 0.5, r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -r * 0.2); ctx.lineTo(0, -r); ctx.stroke(); }
  else if (sh === 'volc') { ctx.moveTo(-r, r * 0.8); ctx.lineTo(-r * 0.3, -r * 0.6); ctx.lineTo(r * 0.3, -r * 0.6); ctx.lineTo(r, r * 0.8); ctx.closePath(); ctx.fillStyle = '#5a4a44'; ctx.fill(); ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(-r * 0.3, -r * 0.75, r * 0.6, r * 0.3); }
  else if (sh === 'pier') { ctx.rect(-r * 0.3, -r, r * 0.6, r * 2); ctx.fill(); ctx.stroke(); }
  else if (sh === 'dot') { ctx.arc(0, 0, r * 0.6, 0, 6.28); ctx.fill(); }
  else if (sh === 'ring') { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.arc(0, 0, r * 0.8, 0, 6.28); ctx.stroke(); }
  else if (sh === 'box') { ctx.rect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2); ctx.fill(); }
  else if (sh === 'me') { ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, r * 0.8); ctx.lineTo(0, r * 0.4); ctx.lineTo(-r * 0.7, r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (sh === 'dash') { ctx.setLineDash([3, 3]); ctx.strokeStyle = c; ctx.arc(0, 0, r * 0.85, 0, 6.28); ctx.stroke(); }
  ctx.restore();
}
// легенда по группам; галочкой группу можно скрыть с карты (запоминается)
const LEG_GROUPS = [
  ['people', '👥 Люди', [['me', '#ffd24a', 'Вы'], ['dot', '#7fd0ff', 'Другие колонисты'], ['box', '#ff6a5a', 'Враги рядом (миникарта)']]],
  ['places', '📍 Места', Object.values(MARK).filter((m) => m.n).map((m) => [m.sh, m.c, m.n])],
  ['cities', '🏛 Города и дороги', [['dot', '#ffdc78', 'Город Рима'], ['dot', '#ff6e5a', 'Город Карфагена или Сиракуз'], ['box', '#8a8278', 'Дорога'], ['box', '#c8bca8', 'Мост'], ['box', '#3a7ab0', 'Река, озеро']]],
  ['builds', '🏠 Постройки', [['box', '#f3d98b', 'Общественное здание'], ['box', '#b8d890', 'Частное хозяйство'], ['box', '#7fb6ff', 'Колония'], ['box', '#c9a', 'Стройка'], ['box', '#a33', 'Разрушено']]],
  ['land', '📐 Земля', [['box', '#5a96ff', 'Ваши клетки'], ['box', '#ff965a', 'Клетки других (цвет — владелец, имя при приближении)'], ['dash', '#9fe0ff', 'Ваша латифундия'], ['ring', '#ffd24a', 'Район клада']]],
  ['sea', '⛵ Море', [['dot', '#e8f4ff', 'Корабль колонистов'], ['dot', '#ff5a4a', 'Вражеский корабль'], ['dot', '#9fe0ff', 'Косяк рыбы'], ['box', '#bfe6ff', 'Порты']]],
  ['events', '⚠ События', [['ring', '#ff4a3a', 'Событие: набег, высадка'], ['dia', '#ff9a2a', 'Налётчики-варвары (идут)'], ['dia', '#ff3a2a', 'Десант и корабли Карфагена'], ['ring', '#ffd24a', 'Сбор, объявленный легатом']]],
];
const LEGEND = LEG_GROUPS.flatMap((g) => g[2]);
let mapOff = {}; try { mapOff = JSON.parse(localStorage.getItem('imperiumMapOff') || '{}') || {}; } catch {}
const lay = (k) => !mapOff[k];
function legendHtml() {
  let i = 0;
  return LEG_GROUPS.map(([k, n, items]) => `<div class="lgg"><label class="lgh"><input type="checkbox" data-lay="${k}" ${lay(k) ? 'checked' : ''}> ${n}</label>${items.map(([, , t]) => `<div class="lg ${lay(k) ? '' : 'off'}"><canvas data-lg="${i++}" width="18" height="18"></canvas><span>${t}</span></div>`).join('')}</div>`).join('');
}
document.addEventListener('change', (e) => { const k = e.target && e.target.dataset && e.target.dataset.lay; if (!k) return; if (e.target.checked) delete mapOff[k]; else mapOff[k] = 1; try { localStorage.setItem('imperiumMapOff', JSON.stringify(mapOff)); } catch {} const g = e.target.closest('.lgg'); if (g) g.querySelectorAll('.lg').forEach((x) => x.classList.toggle('off', !e.target.checked)); });
function paintLegend() { for (const cv of document.querySelectorAll('canvas[data-lg]')) { const [sh, c] = LEGEND[Number(cv.dataset.lg)]; const x = cv.getContext('2d'); x.clearRect(0, 0, 18, 18); drawMark(x, sh, c, 9, 9, 6.5); } }
const ownerCol = (cid) => { let h = 0; for (const ch of String(cid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `hsla(${h % 360},75%,60%,.7)`; };
function drawMap(ctx, W2, H2, cx, cz, span, mini) {
  const w = S.world; const s = W2 / span;
  const toX = (x) => (x - cx) * s + W2 / 2, toY = (z) => (z - cz) * s + H2 / 2;
  ctx.fillStyle = '#183848'; ctx.fillRect(0, 0, W2, H2);
  if (mapBase) { const k = mapBase.width / MAPW; ctx.imageSmoothingEnabled = true; ctx.drawImage(mapBase, (cx - span / 2 + MAPH) * k, (cz - span * H2 / W2 / 2 + MAPH) * k, span * k, span * H2 / W2 * k, 0, 0, W2, H2); }
  // клетки участков (крупный масштаб) и латифундии
  if (lay('land') && w && w.plots && span < 1200) {
    const grp = {};
    for (const [k, o] of Object.entries(w.plots)) { const [cid, i, j] = k.split(':'); const Cy = WG.cityById(cid); if (!Cy) continue; const [x, z] = WG.cellCenter(Cy, +i, +j); ctx.fillStyle = o === S.char?.id ? 'rgba(90,150,255,.8)' : ownerCol(o); const r = Math.max(1.5, D.CELL * s); ctx.fillRect(toX(x) - r / 2, toY(z) - r / 2, r, r); const g = grp[o + cid] = grp[o + cid] || { o, x: 0, z: 0, n: 0 }; g.x += x; g.z += z; g.n++; }
    if (!mini && span < 600) { ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; for (const g of Object.values(grp)) { const nm = g.o === S.char?.id ? 'вы' : (w.plotNames || {})[g.o] || '?'; ctx.fillStyle = '#000'; ctx.fillText(nm, toX(g.x / g.n) + 1, toY(g.z / g.n) + 1); ctx.fillStyle = '#fff'; ctx.fillText(nm, toX(g.x / g.n), toY(g.z / g.n)); } }
  }
  if (lay('land')) for (const tm of (S.char && S.char.sci && S.char.sci.maps) || []) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(toX(tm.ax), toY(tm.az), Math.max(5, 25 * s), 0, 6.28); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('✕ клад', toX(tm.ax), toY(tm.az) - Math.max(8, 25 * s) - 4); }
  if (lay('land') && S.char && S.char.lat) { const L = S.char.lat; ctx.strokeStyle = '#9fe0ff'; ctx.lineWidth = 2; ctx.strokeRect(toX(L.x - L.half), toY(L.z - L.half), L.half * 2 * s, L.half * 2 * s); ctx.lineWidth = 1; }
  if(lay('land')&&!mini&&span<1100)for(const C of S.W.cities){const r=C.R-12,pts=[[12,-12],[r,-12],[r*.7,-r*.7],[12,-r]].map(([u,v])=>WG.cityPt(C,u,v));ctx.beginPath();pts.forEach(([x,z],i)=>i?ctx.lineTo(toX(x),toY(z)):ctx.moveTo(toX(x),toY(z)));ctx.closePath();ctx.fillStyle='rgba(85,190,125,.2)';ctx.fill();ctx.strokeStyle='#8ed59b';ctx.lineWidth=1;ctx.stroke();if(span<550){const[x,z]=WG.cityPt(C,C.R*.42,-C.R*.42);ctx.fillStyle='#8ed59b';ctx.font='11px sans-serif';ctx.fillText('Жилой квартал',toX(x),toY(z));}}
  // римские дороги
  ctx.strokeStyle = 'rgba(120,100,80,.85)'; ctx.lineWidth = Math.max(1.2, 5 * s);
  if (lay('cities')) for (const rd of WG.roadsList()) { ctx.beginPath(); rd.pts.forEach((p, i) => (i ? ctx.lineTo(toX(p[0]), toY(p[1])) : ctx.moveTo(toX(p[0]), toY(p[1])))); ctx.stroke(); }
  ctx.lineWidth = 1;
  // города: стены и хозяин (Рим — золотой, Карфаген и Сиракузы — красный)
  if (lay('cities') && S.W && S.W.cities) for (const C of S.W.cities) {
    const own = (w && w.cityState && w.cityState[C.id] ? w.cityState[C.id].owner : C.owner), rome = own === 'rome';
    ctx.strokeStyle = rome ? 'rgba(255,220,120,.95)' : 'rgba(255,110,90,.95)'; ctx.fillStyle = rome ? 'rgba(255,220,120,.18)' : 'rgba(255,110,90,.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(toX(C.x), toY(C.z), Math.max(4, C.R * s), 0, 6.28); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
    if (!mini || span < 1500) { ctx.fillStyle = rome ? '#ffe9a8' : '#ffb0a0'; ctx.font = `bold ${mini ? 11 : 14}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(C.name, toX(C.x), toY(C.z) - Math.max(6, C.R * s) - 8); }
  }
  // постройки
  for (const b of S.blds) { const d = BUILDINGS[b.type]; if (d.road ? !lay('cities') : !lay('builds')) continue; if (d.road) { ctx.save(); ctx.translate(toX(b.x), toY(b.z)); ctx.rotate(-(b.ry || 0)); ctx.fillStyle = d.bridge ? '#c8bca8' : '#8a8278'; ctx.fillRect(-Math.max(1, d.wid / 2 * s), -Math.max(1.5, (d.len / 2 + 0.2) * s), Math.max(2, d.wid * s), Math.max(3, (d.len + 0.4) * s)); ctx.restore(); continue; } ctx.fillStyle = b.ruined ? '#a33' : !b.built ? '#c9a' : d.pub ? '#f3d98b' : d.colony ? '#7fb6ff' : '#b8d890'; const r = Math.max(2, d.r * s); ctx.fillRect(toX(b.x) - r / 2, toY(b.z) - r / 2, r, r); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${mini ? 11 : 14}px sans-serif`;
  if (S.W && lay('places')) for (const p of S.W.pois) { if(p.suppressed)continue; const ic = MARK[p.type]; if (!ic) continue; if (p.type === 'barb_camp') { const camp = S.W.camps.find((c) => Math.hypot(c.x - p.x, c.z - p.z) < 3); if (camp && w && w.camps[camp.id] && w.camps[camp.id].destroyedAt) continue; } drawMark(ctx, ic.sh, ic.c, toX(p.x), toY(p.z), mini ? 4.5 : 6.5); }
  // события
  if (w && lay('events')) for (const e of w.events || []) if (e.cx != null) { ctx.strokeStyle = '#ff8a1a'; ctx.lineWidth = 3; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(toX(e.cx), toY(e.cz), mini ? 9 : 13, 0, 6.28); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; if (!mini) { ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffb08a'; ctx.fillText('лагерь налётчиков', toX(e.cx), toY(e.cz) - 18); } }
  if (w && lay('events')) for (const e of w.events || []) if (e.x != null) { ctx.strokeStyle = '#ff4a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(toX(e.x), toY(e.z), 8 + Math.sin(performance.now() / 200) * 2, 0, 6.28); ctx.stroke(); ctx.lineWidth = 1; }
  // порты
  if (!mini && lay('sea')) for (const p of Object.values(PORTS)) { ctx.fillStyle = '#bfe6ff'; ctx.fillText('Порт ' + p.name, Math.max(60, Math.min(W2 - 60, toX(p.x))), Math.max(12, Math.min(H2 - 12, toY(p.z)))); }
  // косяки
  if(S.st?.tuna&&lay('sea'))for(const f of S.st.tuna.fish){ctx.fillStyle='#79e9ff';ctx.beginPath();ctx.arc(toX(f[1]),toY(f[2]),mini?2:4,0,6.28);ctx.fill();}
  if (S.st && lay('sea')) for (const f of S.st.f) { ctx.fillStyle = f[3] === 'tuna' ? '#9fe0ff' : 'rgba(200,240,255,0.7)'; ctx.beginPath(); ctx.arc(toX(f[1]), toY(f[2]), mini ? 2 : 3, 0, 6.28); ctx.fill(); }
  // корабли
  if (S.st && lay('sea')) { for (const sh of S.st.sh) { ctx.fillStyle = '#e8f4ff'; ctx.beginPath(); ctx.arc(toX(sh[2]), toY(sh[3]), 3.5, 0, 6.28); ctx.fill(); } for (const sh of S.st.es) { ctx.fillStyle = '#ff5a4a'; ctx.beginPath(); ctx.arc(toX(sh[2]), toY(sh[3]), 4.5, 0, 6.28); ctx.fill(); } }
  // враги рядом
  if (S.st && mini && lay('people')) for (const m of S.st.m) { const def = ENEMIES[m[1]]; if (!def || m[6] === 3) continue; ctx.fillStyle = D.HOSTILE.has(def.faction) ? '#ff6a5a' : def.faction === 'rome' ? '#7fdf7f' : '#e8dca0'; ctx.fillRect(toX(m[2]) - 1.5, toY(m[3]) - 1.5, 3, 3); }
  // игроки
  if (S.st && lay('people')) for (const p of S.st.p) { if (p[0] === S.myId) continue; ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.arc(toX(p[1]), toY(p[2]), 4, 0, 6.28); ctx.fill(); if (!mini) { const r = S.roster.get(p[0]); if (r) { ctx.fillStyle = '#fff'; ctx.fillText(r.name, toX(p[1]), toY(p[2]) - 10); } } }
  // сбор легата
  // набег: где идут налётчики (варвары — оранжевые, карфагеняне — красные, корабли десанта — красные лодки)
  if (S.st && S.st.rd && S.st.rd.length && lay('events')) {
    const bl = 0.55 + 0.45 * Math.sin(performance.now() / 160), R0 = mini ? W2 / 2 - 8 : 0, cxm = W2 / 2, cym = H2 / 2;
    for (const [x, z, k] of S.st.rd) {
      let X = toX(x), Y = toY(z), off = false;
      if (mini) { const dx = X - cxm, dy = Y - cym, dd = Math.hypot(dx, dy); if (dd > R0) { X = cxm + dx / dd * R0; Y = cym + dy / dd * R0; off = true; } } // миникарта круглая: дальние — у края
      else if (X < 8 || Y < 8 || X > W2 - 8 || Y > H2 - 8) { X = Math.max(8, Math.min(W2 - 8, X)); Y = Math.max(8, Math.min(H2 - 8, Y)); off = true; }
      const col = k ? '#ff2a1a' : '#ff8a1a', sz = mini ? 5 : 7;
      ctx.globalAlpha = bl; ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      if (off) { const a = Math.atan2(toY(z) - cym, toX(x) - cxm); ctx.save(); ctx.translate(X, Y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(sz + 2, 0); ctx.lineTo(-sz, -sz * 0.8); ctx.lineTo(-sz, sz * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
      else if (k === 2) drawMark(ctx, 'hull', col, X, Y, sz + 1);
      else { ctx.beginPath(); ctx.moveTo(X, Y - sz); ctx.lineTo(X + sz * 0.9, Y + sz * 0.7); ctx.lineTo(X - sz * 0.9, Y + sz * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }
    if (!mini) { const nb = S.st.rd.filter((q) => q[2] === 0).length, np = S.st.rd.filter((q) => q[2] === 1).length, ns = S.st.rd.filter((q) => q[2] === 2).length; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; const t = `⚠ Набег: ${nb ? 'варваров ' + nb : ''}${np ? ' карфагенян ' + np : ''}${ns ? ' кораблей ' + ns : ''}`; ctx.fillText(t, W2 / 2 + 1, 23); ctx.fillStyle = '#ffb08a'; ctx.fillText(t, W2 / 2, 22); }
  }
  if (S.st && S.st.mu && lay('events')) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(toX(S.st.mu[0]), toY(S.st.mu[1]), 10, 0, 6.28); ctx.stroke(); ctx.lineWidth = 1; }
  // я
  const me = S.me; const a = me.ry;
  ctx.save(); ctx.translate(toX(me.x), toY(me.z)); ctx.rotate(-a + Math.PI); ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#000';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function renderMapWin() {
  $('mtitle').textContent = 'Карта архипелага';
  tabs([['map', '🗺 Карта']]);
  if (!$('bigmap')) {
    $('mbody').innerHTML = `<div style="position:relative;height:100%"><canvas id="bigmap"></canvas><div style="position:absolute;right:10px;top:10px;display:flex;gap:4px"><button class="btn sm" data-a="mapZoom" data-f="0.7">＋</button><button class="btn sm" data-a="mapZoom" data-f="1.4">－</button></div><div id="mapLegend"><div class="t">Легенда <button class="btn sm alt" data-a="legend">скрыть</button></div><div class="lgl">${legendHtml()}</div></div></div>`;
    paintLegend();
    $('mbody')._h = null;
    const cv = $('bigmap');
    let drag = null;
    cv.onmousedown = (e) => { drag = { x: e.clientX, y: e.clientY, cx: mapView.cx, cz: mapView.cz }; };
    addEventListener('mousemove', (e) => { if (!drag || !$('bigmap')) return; const s = mapView.span / cv.clientWidth; mapView.cx = drag.cx - (e.clientX - drag.x) * s; mapView.cz = drag.cz - (e.clientY - drag.y) * s; });
    addEventListener('mouseup', () => { drag = null; });
    cv.onwheel = (e) => { mapView.span = Math.max(150, Math.min(4800, mapView.span * (e.deltaY > 0 ? 1.15 : 0.87))); e.preventDefault(); };
  }
}

// ---------- Рыбалка: мини-игра ----------
let fish = null;
export const fishActive = () => !!fish;
export function fishGame(m, cb) {
  const diff = Math.min(1, m.diff || 0.3);
  fish = { pos: 0.5, v: 0, zone: 0.3, zoneV: 0, prog: 0.3, diff, cb, t: 0, hold: false, zoneH: 0.36 - diff * 0.18 };
  $('fishBox').classList.remove('hidden');
  $('fishZone').style.height = (fish.zoneH * 100) + '%';
  toast(m.big ? '🎣 Клюёт что-то очень крупное!' : '🎣 Клюёт!');
}
addEventListener('mousedown', (e) => { if (fish && e.button === 0) fish.hold = true; });
addEventListener('mouseup', (e) => { if (fish && e.button === 0) fish.hold = false; });
addEventListener('keydown', (e) => { if (fish && e.code === 'Space') { fish.hold = true; e.preventDefault(); } });
addEventListener('keyup', (e) => { if (fish && e.code === 'Space') fish.hold = false; });
function fishTick(dt) {
  const f = fish; if (!f) return;
  f.t += dt;
  // рыба мечется
  if (Math.random() < dt * (1 + f.diff * 3)) f.v = (Math.random() - 0.5) * (0.8 + f.diff * 2.4);
  f.pos = Math.max(0.03, Math.min(0.97, f.pos + f.v * dt));
  if (f.pos <= 0.03 || f.pos >= 0.97) f.v = -f.v;
  // зона поднимается, пока держим
  f.zoneV += (f.hold ? 1.6 : -1.4) * dt; f.zoneV *= 0.92;
  f.zone = Math.max(0, Math.min(1 - f.zoneH, f.zone + f.zoneV * dt));
  if (f.zone <= 0 || f.zone >= 1 - f.zoneH) f.zoneV *= -0.3;
  const inZone = f.pos >= f.zone && f.pos <= f.zone + f.zoneH;
  f.prog = Math.max(0, Math.min(1, f.prog + (inZone ? 0.28 : -0.2 - f.diff * 0.12) * dt));
  $('fishZone').style.bottom = (f.zone * 100) + '%';
  $('fishMark').style.bottom = (f.pos * 100) + '%';
  $('fishProg').firstElementChild.style.height = (f.prog * 100) + '%';
  if (f.prog >= 1) endFish(true); else if (f.prog <= 0 || f.t > 14) endFish(false);
}
function endFish(ok) { const cb = fish.cb; fish = null; $('fishBox').classList.add('hidden'); cb(ok); }
export function fishEnd(m) {
  if (fish) { fish = null; $('fishBox').classList.add('hidden'); }
  if (m.caught) toast(`${m.trophy ? '🏆 ТРОФЕЙ! ' : '🐟 '}${RES[m.caught].name} — ${m.kg} кг`, !!m.trophy);
  else if (m.text) addLog(esc(m.text), 'warn');
}

// ---------- HUD ----------
function renderHUD() {
  const c = S.char; if (!c) return;
  setHTML($('hudName'), `${esc(c.name)} <small>· ур. ${c.level} · ${RANKS[c.rank].name}${(c.offices || []).map((k) => ' · ' + OFFICES[k].icon + ' ' + OFFICES[k].name).join('')}</small>`);
  $('hudTL').querySelector('.xp > div').style.width = (c.xp / c.need * 100) + '%';
  setHTML($('denarii'), `◉ ${c.den} денариев${c.points ? ` · <span style="color:#7fd0ff">+${c.points} очков (C)</span>` : ''}`);
  const w = c.gear.weapon && GEAR[c.gear.weapon.k];
  const food = Object.keys(c.bag).filter((k) => RES[k] && RES[k].food && c.bag[k] > 0).reduce((a, k) => a + c.bag[k], 0);
  setHTML($('actionBar'), [
    ['ЛКМ', w ? (w.kind === 'rod' ? '🎣' : w.kind === 'bow' ? '🏹' : '⚔') : '👊', w ? w.name.split(' (')[0] : 'Кулаки', w && w.kind === 'bow' ? c.bag.arrow || 0 : ''],
    ['ПКМ', '🛡', c.gear.offhand ? 'Блок щитом' : 'Блок', ''],
    ['F', '↗', 'Пилум', c.bag.pilum || 0],
    ['R', '🩹', 'Перевязка', c.bag.bandage || 0],
    ['Y', '🍞', 'Еда', food],
    ['Q', '↻', 'Перекат', ''],
  ].map(([k, ic, t, n]) => `<div class="slot"><span class="k">${k}</span>${n !== '' ? `<span class="n">${Math.floor(n)}</span>` : ''}<span class="ic">${ic}</span><span class="t">${esc(t)}</span></div>`).join(''));
}
let hudT = 0;
// значки отрядов: номер (1–5), численность, здоровье, приказ; щелчок — выбрать, 🏠 — отправить домой
const MODE_IC = { follow: '👣', hold: '⛔', move: '➜', attack: '⚔', home: '🏠' };
export function squadStats(ents, id) { let hp = 0, n = 0; for (const o of ents.mobs.values()) if (o.sq === id && o.st !== 3) { hp += o.hpp || 0; n++; } return { n, hp }; }
function squadBar(ents) {
  const c = S.char, el = $('squadBar'); if (!el) return; const l = C.barSquads(); // в бою на Поле Марса — только отряды боя
  const h = l.slice(0, 8).map((q, i) => { const st = squadStats(ents, q.id), size = q.size || 1, hpPct = st.n ? Math.round(st.hp / size) : 0, SQ = D.SQUADS[q.type] || {};
    const fm = q.form === 'tight';
    return `<div class="sqi ${(S.selectedSquads || [S.selSquad]).includes(q.id) ? 'sel' : ''} ${st.n ? '' : 'off'}" data-sq="${q.id}" title="${esc(q.name)} — ${SQ.name || ''}. Щелчок — выбрать. В виде сверху (Z): ПКМ по земле — идти, ПКМ по врагу — атаковать.">${i < 5 ? `<span class="k">${i + 1}</span>` : ''}<span class="md">${st.n ? MODE_IC[q.mode] || '' : q.homeAway ? '🏠' : '💤'}</span><div class="ic">${SQ.icon || '⚔'}</div><div class="nm">${esc(q.name)}</div><div class="cnt">👥 ${st.n}/${size}</div><div class="hb"><div style="width:${Math.min(100,hpPct)}%"></div></div><div class="details">${Math.round(hpPct)}% HP${q.stats ? ` · ⚔ ${Math.round(q.stats.damage)} · ◈ ${Math.round(q.stats.armor)}<br>Дальность ${q.stats.range} · ход ${q.stats.speed.toFixed(1)}` : ''}</div>${st.n ? `<div class="sqb"><button data-sqa="attack" data-id="${q.id}" title="Атаковать ближайшего врага" class="${q.mode === 'attack' ? 'on' : ''}">⚔</button><button data-sqa="hold" data-id="${q.id}" title="Стоять — держать оборону на месте" class="${q.mode === 'hold' ? 'on' : ''}">🛡</button><button data-sqa="form" data-id="${q.id}" data-f="${fm ? 'line' : 'tight'}" title="${fm ? 'Строй плечом к плечу (вкл.) — разомкнуть' : 'Сомкнуть строй плечом к плечу'}" class="${fm ? 'on' : ''}">▦</button><button data-sqa="follow" data-id="${q.id}" title="За мной" class="${q.mode === 'follow' ? 'on' : ''}">👣</button><button data-home="${q.id}" title="Отправить домой">🏠</button></div>` : ''}</div>`; }).join('');
  setHTML(el, h);
}
$('squadBar') && $('squadBar').addEventListener('click', (e) => { const sa = e.target.closest('[data-sqa]'); if (sa) { const id = Number(sa.dataset.id); if (!(S.selectedSquads || [S.selSquad]).includes(id)) C.chooseSquad(id); if (sa.dataset.sqa === 'form') net({ type: 'squadOrder', id, form: sa.dataset.f }); else net({ type: 'squadOrder', id, mode: sa.dataset.sqa }); e.stopPropagation(); return; } const hb = e.target.closest('[data-home]'); if (hb) { net({ type: 'squadHome', id: Number(hb.dataset.home) }); e.stopPropagation(); return; } const b = e.target.closest('[data-sq]'); if (!b) return; C.chooseSquad(Number(b.dataset.sq), e.shiftKey || e.ctrlKey); });
export function frame(dt, t, ents) {
  fishTick(dt);
  updatePlacing();
  // всплывающие цифры
  const v = new THREE.Vector3();
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt; f.p.y += dt * 0.9;
    v.copy(f.p).project(R.camera);
    if (v.z > 1 || f.t > 1.2) { if (f.t > 1.2) { f.el.remove(); floats.splice(i, 1); } else f.el.style.display = 'none'; continue; }
    f.el.style.display = ''; f.el.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px'; f.el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px'; f.el.style.opacity = String(Math.min(1, 2 - f.t * 1.6));
  }
  $('cross').style.display = document.pointerLockElement ? '' : 'none';
  hudT -= dt; if (hudT > 0) return; hudT = 0.12;
  squadBar(ents);
  const me = S.me;
  const bar = (cls, v, m, txt) => { const el = $('hudTL').querySelector('.' + cls); el.firstElementChild.style.width = Math.max(0, Math.min(100, v / m * 100)) + '%'; if (el.children[1]) el.children[1].textContent = txt; };
  bar('hp', me.hp, me.mhp, `${Math.max(0, Math.round(me.hp))} / ${me.mhp}`);
  bar('st', me.st, me.mst, `${Math.round(me.st)} / ${me.mst}`);
  bar('sat', me.sat, 100, `Сытость ${Math.round(me.sat)}%`);
  setHTML($('hudBuffs'), [me.poison ? '<span class="no">☠ яд — перевяжитесь (R)</span>' : '', me.bath ? '♨ термы: +25% опыта' : '', me.sat < 15 ? '<span class="no">🍞 голод — поешьте (Y)</span>' : ''].filter(Boolean).join(' · '));
  const w = S.world;
  if (w) {
    const gt = S.serverT + (performance.now() / 1000 - S.timeAt);
    const hrs = D.dayClock(gt), hh = Math.floor(hrs), mm = Math.floor((hrs - hh) * 60); // день — с 03:00 до 23:55
    setHTML($('hudClock'), `День ${w.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${S.inst ? ' · подземелье' : ''}`);
    setHTML($('hudColony'), `<span title="Угроза Карфагена">⚔ ${w.threat}%</span><span title="Расположение Рима">🦅 ${w.favor}%</span><span title="Казна">💰 ${w.treasury}</span><span title="Онлайн">👥 ${w.online}</span>`);
    // баннеры событий
    const bn = [];
    for (const e of w.events || []) { const left = e._end ? e._end - performance.now() / 1000 : e.left; if (e.kind === 'raid') bn.push(`<div class="banner bad">${e.foe === 'punic' ? '⚔' : '🔥'} ${esc(e.title)}: ${esc(e.text)} · уйдут через ${fmtT(left)}</div>`); else bn.push(`<div class="banner">${e.kind === 'storm' ? '⛈' : e.kind === 'tuna' ? '🐟' : e.kind === 'merchant' ? '⛵' : e.kind === 'pirates' ? '🏴' : '•'} ${esc(e.title)} · ${fmtT(left)}</div>`); }
    if (S.char && S.char.war && w.war) { const L = w.war.lobbies.find((q) => q.state === 'fight' && q.id === S.char.war.lid); if (L) bn.push(`<div class="banner bad">🏟 Поле Марса: вы — ${S.char.war.team === 'A' ? 'Запад' : 'Восток'} · до конца боя ${fmtT(L.left || 0)}${L.cap ? ` · точка: Запад ${L.cap.A}/${L.capNeed} · Восток ${L.cap.B}/${L.capNeed}` : ''}</div>`); }
    if (w.election) bn.push(`<div class="banner good">🗳 Выборы на Форуме · ${fmtT(w.election.ends)}</div>`);
    if (w.lawVote) bn.push(`<div class="banner good">📜 Голосование: ${LAWS[w.lawVote.key].name} · ${fmtT(w.lawVote.ends)}</div>`);
    if (S.st && S.st.ar) bn.push(`<div class="banner">🏟 Арена: ${S.st.ar.st === 'prep' ? 'сбор ' + S.st.ar.t + ' с' : S.st.ar.duel ? 'поединок' : 'волна ' + S.st.ar.wave}</div>`);
    if (S.st && S.st.mu) bn.push(`<div class="banner good">🦅 Сбор легата · ${S.st.mu[2]} с</div>`);
    setHTML($('hudTop'), bn.slice(0, 4).join(''));
    // трекер
    const c = S.char; const tk = [];
    if (w.story < STORY.length) tk.push(`<div class="tk"><b>📖 ${STORY[w.story].title}</b><div class="sm">${STORY[w.story].text}</div></div>`);
    for (const r of (w.requests || []).slice(0, 2)) tk.push(`<div class="tk rome"><b>🦅 Рим: ${resName(r.res)} ${r.got}/${r.n}</b> <span class="sm">· ${fmtT(r.left)}</span></div>`);
    if (c) for (const q of c.quests.slice(0, 4)) tk.push(`<div class="tk q"><b>${esc(q.title)}</b> <span class="sm">${q.got}/${q.n}</span></div>`);
    setHTML($('tracker'), tk.join(''));
  }
  // миникарта
  const mm = $('minimap'), ctx = mm.getContext('2d');
  ctx.save(); ctx.beginPath(); ctx.arc(100, 100, 99, 0, 6.28); ctx.clip();
  drawMap(ctx, 200, 200, me.x, me.z, S.inst ? 200 : 420, true);
  ctx.restore();
  if (cur && cur.kind === 'map' && $('bigmap')) { const cv = $('bigmap'); if (cv.width !== cv.clientWidth) { cv.width = cv.clientWidth; cv.height = cv.clientHeight; } if (!mapView.init) { mapView.init = true; mapView.cx = me.x; mapView.cz = me.z; mapView.span = 1400; } drawMap(cv.getContext('2d'), cv.width, cv.height, mapView.cx, mapView.cz, mapView.span, false); }
  if (cur && ['bld', 'camp'].includes(cur.kind) && Math.random() < 0.1) render();
}
