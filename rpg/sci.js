// Исследования островов: образцы растений (гербарный нож), отлов животных (сеть) и изучение в Кампусе;
// остров открыт, когда изучены все его 3 растения и 2 животных; учёные звания за открытые острова.
import { G, D, now, dist, send, log, chronicle } from './state.js';
import { grantXp, grantDig } from './combat.js';

const say = (p, text, kind = 'warn') => send(p, { type: 'log', text, kind });
const campusNear = (p) => G.W.buildings.find((b) => b.type === 'campus' && b.built && !b.enemy && dist(p, b) < 28);
const sciOf = (c) => (c.sci = c.sci || { tools: { knife: 0, net: 0 }, rec: {}, caught: [], isl: {} });
export const sciTitle = (c) => { const n = Object.keys(sciOf(c).isl).length; let t = D.SCI_TITLES[0]; for (const x of D.SCI_TITLES) if (n >= x.n) t = x; return t.name; };
function checkIsland(p, isl) {
  const c = p.char, S = sciOf(c), R = D.RESEARCH[isl]; if (!R || S.isl[isl]) return;
  if (![...R.flora.map((k) => 'f:' + k), ...R.fauna.map((k) => 'a:' + k)].every((k) => S.rec[isl + '|' + k])) return;
  const before = sciTitle(c);
  S.isl[isl] = Date.now();
  const I = D.ISLANDS.find((x) => x.id === isl);
  c.den += 150; grantXp(p, 400); grantDig(p, 25);
  log(`🔭 ${c.name} полностью исследовал(а) остров «${I ? I.name : isl}»: вся флора и фауна описаны!`, 'good'); chronicle(`${c.name} открыл(а) остров ${I ? I.name : isl}`);
  const after = sciTitle(c); if (after !== before) log(`🎓 ${c.name} получает учёное звание «${after}».`, 'good');
  G.W.sci = G.W.sci || {}; G.W.sci[c.id] = { name: c.name, n: Object.keys(S.isl).length, rec: Object.keys(S.rec).length };
}
// развалины древних городов: 4 места по порядку — вся история гибели города
export function ruinStudy(p, m) {
  const c = p.char, S = sciOf(c), A = (G.world.ancient || []).find((x) => x.id === m.id), R = D.ANCIENT_RUINS.find((x) => x.id === m.id); if (!A || !R) return;
  const sp = A.spots.find((x) => x.k === (m.k | 0)); if (!sp || dist(p, sp) > 6) return;
  if (!S.tools.knife) return say(p, 'Развалины изучают учёные: нужно снаряжение исследователя (гербарный нож и папка — в Кампусе Мессаны).');
  c.lore = c.lore || {}; const done = c.lore[R.id] || 0;
  if (sp.k < done) return send(p, { type: 'lore', title: R.stages[sp.k].title, text: R.stages[sp.k].text, city: R.name, n: done, of: R.stages.length });
  if (sp.k > done) return say(p, `Сначала изучите «${R.stages[done].title}» — история складывается по порядку.`);
  c.lore[R.id] = done + 1; grantXp(p, 150); grantDig(p, 8);
  send(p, { type: 'lore', title: R.stages[sp.k].title, text: R.stages[sp.k].text, city: R.name, n: done + 1, of: R.stages.length });
  if (done + 1 >= R.stages.length) {
    c.den += R.reward.den; grantXp(p, R.reward.xp); grantDig(p, R.reward.dig); S.lore = (S.lore || 0) + 1;
    log(`📜 ${c.name} восстановил(а) полную историю: ${R.name}. Рим благодарит учёного!`, 'good'); chronicle(`${c.name} записал(а) историю гибели: ${R.name}`);
    say(p, `🏛 История собрана целиком! Награда: ${R.reward.den} ден., опыт и одобрение Рима.`, 'good');
  } else say(p, `📜 ${R.name}: изучено ${done + 1} из ${R.stages.length}. Следующее место — «${R.stages[done + 1].title}».`, 'info');
  p.dirtyChar = true;
}
export function sciMsg(p, m) {
  const c = p.char, S = sciOf(c);
  if (m.type === 'sciBuy') {
    const T = D.SCI_TOOLS[m.k]; if (!T) return; if (!campusNear(p)) return say(p, 'Снаряжение учёных делают в Кампусе.');
    const n = m.k === 'net' ? Math.max(1, Math.min(10, m.n | 0)) : 1;
    if (m.k === 'knife' && S.tools.knife) return say(p, 'Нож у вас уже есть.');
    if (c.den < T.price * n) return say(p, `Нужно ${T.price * n} денариев.`);
    c.den -= T.price * n; S.tools[m.k] = (S.tools[m.k] || 0) + n; say(p, `🔭 Куплено: ${T.name}${n > 1 ? ' ×' + n : ''}.`, 'good');
  } else if (m.type === 'sciSample') {
    const r = (G.world.research || []).find((x) => x.id === m.id); if (!r || dist(p, r) > 4) return;
    if (!S.tools.knife) return say(p, 'Нужен гербарный нож (Кампус в Мессане).');
    const k = r.island + '|f:' + r.sp; if (S.rec[k]) return say(p, 'Это растение вы уже описали.', 'info');
    S.rec[k] = Date.now(); grantXp(p, 60); say(p, `🌿 Образец описан: ${D.PLANT_NAMES[r.sp]}.`, 'good'); checkIsland(p, r.island);
  } else if (m.type === 'sciCatch') {
    const mob = G.mobs.get(m.mid); if (!mob || mob.hp <= 0 || !mob.def.critter || dist(p, mob) > 3.5) return;
    if (!S.tools.net) return say(p, 'Нужна ловчая сеть учёного (Кампус в Мессане).');
    if (S.caught.length >= 6) return say(p, 'Клетки полны: отвезите пойманных в Кампус и изучите.');
    S.tools.net--; G.mobs.delete(mob.id);
    const den = G.world.dens.find((d) => d.type === mob.type && Math.hypot(d.x - mob.x, d.z - mob.z) < 80);
    S.caught.push({ sp: mob.def.critter, island: den ? den.island : 'main' });
    say(p, `🪤 Поймано: ${D.CRITTER_NAMES[mob.def.critter]}. Отвезите в Кампус для изучения.`, 'good');
  } else if (m.type === 'sciStudy') {
    if (!campusNear(p)) return say(p, 'Изучают в Кампусе.');
    if (!S.caught.length) return say(p, 'Нет пойманных животных.', 'info');
    const isl = new Set(); let n = 0;
    for (const a of S.caught) { const k = a.island + '|a:' + a.sp; if (!S.rec[k]) { S.rec[k] = Date.now(); n++; isl.add(a.island); } }
    S.caught = []; grantXp(p, 80 * n + 10);
    say(p, n ? `📜 Учёные изучили и описали новых животных: ${n}.` : 'Этих животных уже описали — их отпустили.', 'good');
    for (const i of isl) checkIsland(p, i);
  }
  G.W.sci = G.W.sci || {}; G.W.sci[c.id] = { name: c.name, n: Object.keys(S.isl).length, rec: Object.keys(S.rec).length };
  p.dirtyChar = true; G.dirtyWorld = true;
}
export const sciPublic = (c) => { const S = sciOf(c); return { tools: S.tools, rec: S.rec, caught: S.caught, isl: S.isl, title: sciTitle(c), maps: (S.maps || []).map((m) => ({ id: m.id, island: m.island, ax: m.ax, az: m.az })), treasures: S.treasures || 0 }; };

// ---------- Клады: карта сокровищ с разгромленных лагерей и пиратов → место на острове → копать (E) ----------
export function giveTreasureMap(p, why) {
  const c = p.char, S = sciOf(c); S.maps = S.maps || [];
  if (S.maps.length >= 3) return;
  const isls = D.ISLANDS.filter((i) => i.kind === 'colony' || i.kind === 'pirate' || i.kind === 'main');
  for (let k = 0; k < 60; k++) {
    const I = isls[Math.floor(Math.random() * isls.length)];
    let x, z;
    if (I.poly) { x = -1300 + Math.random() * 2700; z = -700 + Math.random() * 1700; } else { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * I.r * 0.8; x = I.x + Math.cos(a) * d; z = I.z + Math.sin(a) * d; }
    const h = WGh(x, z); if (h < 1.2 || h > 30) continue;
    if (I.poly && G.world.cities.some((C) => Math.hypot(C.x - x, C.z - z) < C.R + 60)) continue;
    // район поиска (на карте) смещён от самого места
    const a2 = Math.random() * 6.28, off = Math.random() * 22;
    S.maps.push({ id: Date.now() % 1e9 + k, island: I.id, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, ax: Math.round(x + Math.cos(a2) * off), az: Math.round(z + Math.sin(a2) * off) });
    send(p, { type: 'log', text: `🗺 ${why}: найдена карта сокровищ! Клад зарыт на острове «${I.name}» — район отмечен на карте (M).`, kind: 'good' });
    p.dirtyChar = true; return;
  }
}
let WGh = () => 0; export function setTerrain(fn) { WGh = fn; }
export function treasureDig(p, m) {
  const c = p.char, S = sciOf(c); S.maps = S.maps || [];
  const tm = S.maps.find((x) => x.id === m.id); if (!tm) return;
  const d = Math.hypot(p.x - tm.x, p.z - tm.z);
  if (d > 5) return say(p, d < 25 ? `Земля тут нетронута… Клад где-то рядом (≈${Math.round(d)} м).` : 'Клад зарыт в отмеченном районе — ищите там.', d < 25 ? 'info' : 'warn');
  S.maps = S.maps.filter((x) => x !== tm); S.treasures = (S.treasures || 0) + 1;
  const den = 150 + Math.floor(Math.random() * 250); c.den += den;
  const loot = [['gem', 1 + Math.floor(Math.random() * 2)], ['silver', 2 + Math.floor(Math.random() * 3)], [Math.random() < 0.5 ? 'gold' : 'artifact', 1]];
  for (const [k, n] of loot) c.bag[k] = (c.bag[k] || 0) + n;
  grantXp(p, 250); grantDig(p, 8);
  log(`💰 ${c.name} откопал(а) клад: ${den} денариев, самоцветы и серебро!`, 'good');
  G.W.sci = G.W.sci || {}; G.W.sci[c.id] = { name: c.name, n: Object.keys(S.isl).length, rec: Object.keys(S.rec).length, tr: S.treasures };
  p.dirtyChar = true;
}
