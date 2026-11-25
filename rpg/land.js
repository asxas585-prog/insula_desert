// Земля: разрешения Эдила на клетки в районах городов, разметка своих клеток, латифундии, колонии с промыслами
import { G, D, WG, now, dist, send, log, chronicle, hasAll, payAll, rankOf, rankEarned, hasOffice, officesOf, book } from './state.js';

const { BUILDINGS, DISTRICTS, CELL, RANKS, LATIFUNDIUM } = D;
const say = (p, text, kind = 'warn') => send(p, { type: 'log', text, kind });
const key = (city, i, j) => `${city}:${i}:${j}`;
const plots = () => (G.W.plots = G.W.plots || {});
const roman = (cityId) => G.W.cityState && G.W.cityState[cityId] && G.W.cityState[cityId].owner === 'rome';
export const myCells = (cid) => Object.values(plots()).filter((o) => o === cid).length;
const permitsOf = (c) => (c.permits = c.permits || {});
const permitTotal = (c) => Object.values(permitsOf(c)).reduce((a, n) => a + n, 0);
export const cellLimit = (c) => RANKS[rankOf(c)].cells + (officesOf(c).length ? 40 : 0);
const aedileDisc = (p) => (hasOffice(p.char, 'aedilis') ? 0.8 : 1);

// разрешение Эдила: n клеток в районе города (в курии)
export function buyPermit(p, m) {
  const c = p.char, C = WG.cityById(m.city), d = DISTRICTS[m.d]; if (!C || !d) return;
  if (!roman(C.id)) return say(p, 'Город не под властью Рима.');
  const curia = G.W.buildings.find((b) => b.city === C.id && b.type === 'curia' && b.built);
  if (!curia) return say(p, 'Эдил принимает в Курии — сначала восстановите её.');
  if (dist(p, curia) > 22) return say(p, 'Подойдите к Курии — там сидит Эдил.');
  const n = Math.max(1, Math.min(100, m.n | 0));
  if (rankOf(c) < d.rank) return say(p, `Для района «${d.name}» нужно звание «${RANKS[d.rank].name}».`);
  if (myCells(c.id) + permitTotal(c) + n > cellLimit(c)) return say(p, `Ваше звание позволяет иметь не больше ${cellLimit(c)} клеток (сейчас ${myCells(c.id)} + разрешений ${permitTotal(c)}).`);
  const price = Math.round(n * d.price * D.PERMIT_K * aedileDisc(p) * D.derived(c).buy); // сбор за разрешение; сама клетка оплачивается при разметке
  const rare = d.rare ? Object.fromEntries(Object.entries(d.rare).map(([k, v]) => [k, Math.ceil(n * v)])) : {};
  if (c.den < price) return say(p, `Нужно ${price} денариев.`);
  if (!hasAll(c, rare)) return say(p, 'Нужны редкие материалы: ' + Object.entries(rare).map(([k, v]) => `${D.RES[k].name} ×${v}`).join(', '));
  c.den -= price; book(c, 'Расход: разрешение на район (Эдил)', -price); payAll(c, rare); G.W.treasury += price;
  const pk = C.id + ':' + m.d; permitsOf(c)[pk] = (permitsOf(c)[pk] || 0) + n;
  say(p, `📜 Эдил выдал разрешение: ${n} клеток — ${C.name}, ${d.name}. Разметьте их на месте (окно Хозяйства K → «Владения» → «Разметить»); каждая клетка оплачивается по своей цене.`, 'good');
  p.dirtyChar = true; G.dirtyWorld = true;
}
// разметка: прямоугольник клеток w×h от клетки (i0, j0)
export function claimCells(p, m) {
  const c = p.char, C = WG.cityById(m.city); if (!C || !roman(C.id)) return;
  const w = Math.max(1, Math.min(10, m.w | 0)), h = Math.max(1, Math.min(10, m.h | 0)), i0 = m.i0 | 0, j0 = m.j0 | 0;
  const P = plots(), need = {};
  for (let i = i0; i < i0 + w; i++) for (let j = j0; j < j0 + h; j++) {
    const [x, z] = WG.cellCenter(C, i, j);
    if (Math.hypot(x - p.x, z - p.z) > 90) return say(p, 'Размечайте рядом с собой.');
    if (P[key(C.id, i, j)]) { if (P[key(C.id, i, j)] === c.id) continue; return say(p, 'Часть клеток уже чужая.'); }
    if (!WG.cellFree(C, i, j)) return say(p, 'Здесь нельзя: улица, стена, вода или городское здание.');
    const dd = WG.districtAt(x, z); if (!dd || dd.city !== C.id) return say(p, 'Клетка вне районов города.');
    need[dd.d] = (need[dd.d] || 0) + 1;
  }
  const pm = permitsOf(c);
  for (const [d, n] of Object.entries(need)) if ((pm[C.id + ':' + d] || 0) < n) return say(p, `Не хватает разрешений Эдила: ${DISTRICTS[d].name} — нужно ${n}, есть ${pm[C.id + ':' + d] || 0}.`);
  let cost = 0; for (let i = i0; i < i0 + w; i++) for (let j = j0; j < j0 + h; j++) if (!P[key(C.id, i, j)]) cost += WG.cellPrice(C, i, j) || 0;
  cost = Math.round(cost * aedileDisc(p) * D.derived(c).buy);
  if (c.den < cost) return say(p, `Эти клетки стоят ${cost} денариев.`);
  c.den -= cost; book(c, 'Расход: клетки под застройку', -cost); G.W.treasury += cost;
  let got = 0;
  for (let i = i0; i < i0 + w; i++) for (let j = j0; j < j0 + h; j++) { const k = key(C.id, i, j); if (P[k]) continue; const [x, z] = WG.cellCenter(C, i, j); const dd = WG.districtAt(x, z); P[k] = c.id; pm[C.id + ':' + dd.d]--; got++; }
  for (const k of Object.keys(pm)) if (pm[k] <= 0) delete pm[k];
  say(p, `📐 Размечено клеток: ${got} за ${cost} ден. Теперь на них можно строить.`, 'good');
  p.dirtyChar = true; G.dirtyWorld = true;
}
// отказ от клеток (без построек на них) — разрешение возвращается
export function releaseCells(p, m) {
  const c = p.char, C = WG.cityById(m.city); if (!C) return;
  const P = plots(); let n = 0;
  for (const [k, o] of Object.entries(P)) {
    if (o !== c.id || !k.startsWith(C.id + ':')) continue;
    const [, i, j] = k.split(':').map(Number), [x, z] = WG.cellCenter(C, i, j);
    if (G.W.buildings.some((b) => b.owner === c.id && Math.hypot(b.x - x, b.z - z) < BUILDINGS[b.type].r + 1)) continue;
    const dd = WG.districtAt(x, z); delete P[k]; if (dd) { const pk = C.id + ':' + dd.d; permitsOf(c)[pk] = (permitsOf(c)[pk] || 0) + 1; } n++;
  }
  say(p, n ? `Освобождено клеток: ${n} (разрешения вернулись).` : 'Свободных от построек клеток нет.', 'info');
  p.dirtyChar = true; G.dirtyWorld = true;
}
// ---------- Проверка места для частной постройки ----------
// город: блок n×n своих клеток подходящего района; вне города — латифундия; возвращает {err} или {x, z, ry, dmul}
export function landCheck(p, type, x, z, ry) {
  const c = p.char, def = BUILDINGS[type];
  if (def.colony || def.road || def.muni) return { x, z, ry };
  const lat = c.lat;
  const inLat = lat && Math.abs(x - lat.x) < lat.half - def.r * 0.6 && Math.abs(z - lat.z) < lat.half - def.r * 0.6;
  if (def.lat && type === 'villa') {
    if (lat) return { err: 'Латифундия у вас уже есть.' };
    if (rankOf(c) < LATIFUNDIUM.rank) return { err: `Латифундию дают за службу Риму: нужно звание «${RANKS[LATIFUNDIUM.rank].name}».` };
    if (c.den < LATIFUNDIUM.price) return { err: `Взнос за землю латифундии — ${LATIFUNDIUM.price} денариев.` };
    const half = LATIFUNDIUM.cells * CELL / 2;
    if (WG.CITY_LIST.some((C) => Math.hypot(x - C.x, z - C.z) < C.R + 150 + half)) return { err: 'Слишком близко к городу: латифундия — в свободных землях.' };
    if (Object.values(G.chars).some((o) => o.lat && o.id !== c.id && Math.abs(o.lat.x - x) < o.lat.half + half + 20 && Math.abs(o.lat.z - z) < o.lat.half + half + 20)) return { err: 'Рядом чужая латифундия.' };
    let land = 0; for (let i = 0; i < 25; i++) { const xx = x - half + (i % 5 + 0.5) * half * 0.4, zz = z - half + (Math.floor(i / 5) + 0.5) * half * 0.4; if (WG.terrainHeight(xx, zz) > 0.8) land++; }
    if (land < 18) return { err: 'Для латифундии нужно больше суши вокруг.' };
    return { x, z, ry, dmul: 1.2, newLat: { x, z, half } };
  }
  // торговые посты и склад — и у своей колонии на острове
  if (['emporium', 'statio', 'horreum_s'].includes(type)) { const col = G.W.buildings.find((b) => b.type === 'colonia' && b.owner === c.id && Math.hypot(b.x - x, b.z - z) < 80); if (col) return { x, z, ry, dmul: 1, near: col.id }; }
  if (inLat) {
    if (!(def.cat === 'lat' || def.cat === 'rural' || def.cat === 'any' || ['ludus', 'vivarium', 'domus', 'fabrica', 'ferraria'].includes(type))) return { err: 'Это здание ставят в городе.' };
    if (def.lat && !G.W.buildings.some((b) => b.owner === c.id && b.type === 'villa')) return { err: 'Сначала постройте виллу латифундии.' };
    const villa = G.W.buildings.find((b) => b.owner === c.id && b.type === 'villa');
    return { x, z, ry, dmul: 1.2, lat: true, near: villa && villa.id };
  }
  if (def.cat === 'lat') return { err: type === 'emporium' || type === 'statio' ? 'Торговый пост ставят на своей латифундии или рядом со своей колонией (до 80 м).' : 'Это здание ставят только на своей латифундии.' };
  const dd = WG.districtAt(x, z);
  if (!dd) return { err: 'Частные постройки — на своих клетках в городе (разрешение Эдила в Курии) или на своей латифундии.' };
  const C = dd.C;
  if (!roman(C.id)) return { err: 'Город не под властью Рима.' };
  const zones = def.cat === 'any' ? ['center', 'outer', 'harbor', 'extra'] : D.CAT_ZONES[def.cat] || [];
  const n = D.cellsOf(type), bs = WG.blockSnap(C, x, z, n), P = plots();
  let worst = null;
  for (let i = bs.i0; i < bs.i0 + n; i++) for (let j = bs.j0; j < bs.j0 + n; j++) {
    if (P[key(C.id, i, j)] !== c.id) return { err: `Нужен свой участок ${n}×${n} клеток (купите разрешение у Эдила и разметьте).` };
    const [cx, cz] = WG.cellCenter(C, i, j), d2 = WG.districtAt(cx, cz);
    if (!d2 || !zones.includes(d2.d)) return { err: `«${def.name}» ставят в районах: ${zones.map((k) => DISTRICTS[k].name).join(', ')}.` };
    if (!worst || DISTRICTS[d2.d].mul < DISTRICTS[worst].mul) worst = d2.d;
  }
  // поворот — по улицам города, шагом 90°
  const q = Math.round((ry - C.ry) / (Math.PI / 2)) * (Math.PI / 2);
  // свои здания на клетках не должны пересекаться блоками
  for (const b of G.W.buildings) { const k = b.blk; if (!k || k.city !== C.id || b.id === p._movingId) continue; if (bs.i0 < k.i0 + k.n && bs.i0 + n > k.i0 && bs.j0 < k.j0 + k.n && bs.j0 + n > k.j0) return { err: 'На этих клетках уже стоит ' + BUILDINGS[b.type].name };
  }
  return { x: bs.x, z: bs.z, ry: C.ry + q, dmul: DISTRICTS[worst].mul, city: C.id, district: worst, cells: true, blk: { city: C.id, i0: bs.i0, j0: bs.j0, n } };
}
export function onPlaced(p, b, chk) {
  if (chk.newLat) { p.char.lat = chk.newLat; p.char.den -= LATIFUNDIUM.price; book(p.char, 'Расход: основание латифундии', -LATIFUNDIUM.price); log(`🏰 ${p.char.name} основал(а) латифундию.`, 'info'); chronicle(`Основана латифундия ${p.char.name}`); }
  b.dmul = chk.dmul || 1; if (chk.city) { b.city = chk.city; b.district = chk.district; } if (chk.lat) b.lat = true; if (chk.blk) b.blk = chk.blk; if (chk.near) b.near = chk.near;
}
// ---------- Колонии: пять промыслов с уровнями ----------
export function colonyUp(p, m) {
  const c = p.char, b = G.W.buildings.find((x) => x.id === m.bid && x.type === 'colonia'); if (!b || b.owner !== c.id || !b.built) return;
  if (dist(p, b) > 30) return say(p, 'Подойдите к колонии.');
  const list = D.COLONY_RES[b.island]; if (!list) return;
  const i = m.i | 0; if (i < 0 || i > 4) return;
  b.crafts = b.crafts || [1, 0, 0, 0, 0];
  const lv = b.crafts[i] || 0; if (lv >= D.COLONY_LV_MAX) return say(p, 'Промысел уже на высшей ступени.');
  const tier = D.COLONY_TIERS[i < 3 ? 0 : i - 2], cost = tier.cost(lv + 1);
  if (i === 4 && (b.crafts[3] || 0) < 2) return say(p, 'Сначала поднимите редкий промысел до 2 ступени.');
  if (i === 3 && Math.max(b.crafts[0], b.crafts[1], b.crafts[2]) < 2) return say(p, 'Сначала поднимите любой обычный промысел до 2 ступени.');
  if (!hasAll(c, cost)) return say(p, 'Нужно: ' + Object.entries(cost).map(([k, n]) => `${D.RES[k].name} ×${n}`).join(', '));
  payAll(c, cost); b.crafts[i] = lv + 1;
  say(p, `🚩 Промысел «${D.RES[list[i][0]].name}» — ступень ${lv + 1}.`, 'good');
  p.dirtyChar = true; G.dirtyBld = true;
}
// выработка колонии в минуту: сумма по промыслам (ступень × база тира)
export function colonyProd(b) {
  const list = D.COLONY_RES[b.island]; if (!list) return {};
  const cr = b.crafts || [1, 0, 0, 0, 0], out = {};
  list.forEach(([k], i) => { const lv = cr[i] || 0; if (!lv) return; const tier = D.COLONY_TIERS[i < 3 ? 0 : i - 2]; out[k] = (out[k] || 0) + tier.base * lv * (1 + (lv - 1) * 0.15); });
  return out;
}

// взнос в Курии за следующее звание (когда Рим уже одобрил — хватает очков одобрения)
export function buyRank(p) {
  const c = p.char;
  const curia = G.W.buildings.find((b) => b.type === 'curia' && b.built && !b.enemy && dist(p, b) < 25);
  if (!curia) return say(p, 'Взнос за звание принимают в Курии города.');
  const cur = rankOf(c), next = D.RANKS[cur + 1]; if (!next) return say(p, 'У вас высшее звание.', 'info');
  if (rankEarned(c) <= cur) return say(p, `Рим ещё не одобрил вас для звания «${next.name}»: нужно ${next.dig} очков одобрения (у вас ${c.dig || 0}).`);
  if (c.den < next.fee) return say(p, `Взнос за звание «${next.name}» — ${next.fee} денариев.`);
  c.den -= next.fee; G.W.treasury += next.fee; c.rankBought = cur + 1;
  log(`🏛 ${c.name} внёс(ла) взнос в Курии и получает звание «${next.name}»!`, 'good'); chronicle(`${c.name} получил(а) звание «${next.name}»`);
  p.dirtyChar = true; G.dirtyWorld = true;
}
