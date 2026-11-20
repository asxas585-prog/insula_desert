import {plotSize} from './footprints.js';
// Insula Deserta: Империя — общие данные RPG (сервер и клиент)
// Все числа баланса — здесь.

// время суток: доля 0..1 (0 — полночь, 0.25 — восход); ночь идёт вдвое быстрее дня
export function dayFrac(gt) { const r = ((gt / CFG.dayLength) % 1 + 1) % 1; return (r < 2 / 3 ? 0.25 + r * 0.75 : 0.75 + (r - 2 / 3) * 1.5) % 1; }
// часы на экране: светлое время суток — с 03:00 до 23:55, ночь — с 23:55 до 03:00
export function dayClock(gt) { const r = ((gt / CFG.dayLength) % 1 + 1) % 1, D0 = 3, D1 = 23 + 55 / 60; const h = r < 2 / 3 ? D0 + (r / (2 / 3)) * (D1 - D0) : D1 + ((r - 2 / 3) / (1 / 3)) * (24 - D1 + D0); return ((h % 24) + 24) % 24; }
export const CFG = {
  tick: 20, sendHz: 10,
  world: 2600,            // мир — квадрат ±2600 м
  dayLength: 1200,        // сутки — 20 минут (≈13 день, ≈7 ночь — ночь идёт вдвое быстрее, см. dayFrac)
  nightFrac: 0.2,

  walk: 5.2, run: 8.6, swim: 5.2, // плавание вдвое быстрее прежнего (Мореход: +10% за ступень)
  stamina: { run: 9, regen: 22, dodge: 22, block: 0.6, attack: 6, heavy: 16 },
  dodgeTime: 0.45, dodgeDist: 5,
  iframes: 0.3,
  bagBase: 150,           // вместимость сумки (единиц веса); +4 за силу
  maxLevel: 40,
  pointsPerLevel: 3,
  respawnTime: 6,
  saveEvery: 45,          // сек — сохранение мира
  eventEvery: [240, 420], // сек — между событиями мира
  electionEvery: 1800,    // сек — выборы должностей
  threatGrow: 0.6,        // угроза Карфагена в минуту
  pickupR: 2.2, interactR: 4,
  chestRespawn: [480, 900],
  nodeRespawn: 150,
  animalRespawn: 180,
  campRespawn: 900,       // лагерь варваров отстраивается
  fishCastR: 22,          // дальность заброса
  shipBoardR: 9,
};

// ---------- Ресурсы (сумка: количество) ----------
// w — вес единицы, p — базовая цена у торговца
export const RES = {
  wood: { name: 'Брёвна', w: 1, p: 2, icon: '🪵' },
  stone: { name: 'Камень', w: 1.5, p: 2, icon: '🪨' },
  clay: { name: 'Глина', w: 1, p: 2, icon: '🟫' },
  hide: { name: 'Шкуры', w: 1, p: 9, icon: '🟤' },
  meat: { name: 'Мясо', w: 0.5, p: 4, icon: '🍖', food: 30 },
  wheat: { name: 'Пшеница', w: 0.5, p: 3, icon: '🌾' },
  olives: { name: 'Оливки', w: 0.5, p: 4, icon: '🫒', food: 8 },
  grapes: { name: 'Виноград', w: 0.5, p: 4, icon: '🍇', food: 10 },
  iron_ore: { name: 'Железная руда', w: 2, p: 6, icon: '⛰' },
  marble: { name: 'Мрамор', w: 2, p: 9, icon: '⬜' },
  murex: { name: 'Раковины мурекса', w: 0.5, p: 10, icon: '🐚' },
  silver_ore: { name: 'Серебряная руда', w: 2, p: 14, icon: '🔘' },
  cedar: { name: 'Кедр', w: 1.5, p: 10, icon: '🌲' },
  papyrus: { name: 'Папирус', w: 0.3, p: 8, icon: '📜' },
  linen: { name: 'Лён', w: 0.5, p: 6, icon: '🧵' },
  calamus: { name: 'Камыш', w: 0.4, p: 4, icon: '🌾' },
  croc_hide: { name: 'Крокодилья кожа', w: 2, p: 120, icon: '🟫' },
  sulfur: { name: 'Сера', w: 1, p: 16, icon: '🟨' },
  salt: { name: 'Соль', w: 1, p: 7, icon: '🧂' },
  honey: { name: 'Мёд', w: 0.6, p: 12, icon: '🍯', food: 20 },
  pumice: { name: 'Пемза', w: 0.6, p: 12, icon: '⬜' },
  obsidian: { name: 'Обсидиан', w: 1, p: 40, icon: '⬛' },
  alum: { name: 'Квасцы', w: 1, p: 28, icon: '🔷' },
  coral: { name: 'Красный коралл', w: 0.5, p: 70, icon: '🪸' },
  pearl: { name: 'Жемчуг', w: 0.1, p: 160, icon: '⚪' },
  saffron: { name: 'Шафран', w: 0.1, p: 95, icon: '🌸' },
  amber: { name: 'Янтарь', w: 0.2, p: 120, icon: '🟠' },
  plank: { name: 'Доски', w: 1, p: 6, icon: '🟧' },
  brick: { name: 'Кирпичи', w: 1.5, p: 6, icon: '🧱' },
  iron: { name: 'Железо', w: 1.5, p: 18, icon: '⚙' },
  silver: { name: 'Серебро', w: 1, p: 45, icon: '🥈' },
  purple: { name: 'Пурпур', w: 0.3, p: 70, icon: '🟪' },
  leather: { name: 'Кожа', w: 0.8, p: 16, icon: '🟫' },
  bread: { name: 'Хлеб', w: 0.3, p: 5, icon: '🍞', food: 45 },
  oil: { name: 'Оливковое масло', w: 1, p: 14, icon: '🏺' },
  wine: { name: 'Вино', w: 1, p: 16, icon: '🍷', food: 15 },
  amphora: { name: 'Амфоры', w: 1.5, p: 10, icon: '⚱' },
  arrow: { name: 'Стрелы', w: 0.05, p: 1, icon: '➶' },
  pilum: { name: 'Пилумы', w: 1, p: 12, icon: '↗' },
  bandage: { name: 'Перевязки', w: 0.1, p: 10, icon: '🩹', heal: 45 },
  gem: { name: 'Самоцветы', w: 0.1, p: 120, icon: '💎' },
  gold: { name: 'Египетское золото', w: 0.5, p: 160, icon: '🟡' },
  artifact: { name: 'Древности', w: 0.5, p: 90, icon: '🏺' },
  // рыба
  f_sardine: { name: 'Сардина', w: 0.2, p: 3, icon: '🐟', food: 15, fish: true },
  f_mackerel: { name: 'Скумбрия', w: 0.4, p: 5, icon: '🐟', food: 22, fish: true },
  f_seabass: { name: 'Лаврак', w: 1, p: 9, icon: '🐟', food: 35, fish: true },
  f_dentex: { name: 'Зубан', w: 1.5, p: 12, icon: '🐠', food: 40, fish: true },
  f_octopus: { name: 'Осьминог', w: 1.5, p: 14, icon: '🐙', food: 40, fish: true },
  f_grouper: { name: 'Каменный окунь', w: 4, p: 26, icon: '🐠', food: 60, fish: true },
  f_moray: { name: 'Мурена', w: 3, p: 30, icon: '🐍', food: 50, fish: true },
  f_tuna: { name: 'Голубой тунец', w: 8, p: 60, icon: '🐟', food: 90, fish: true },
  f_swordfish: { name: 'Меч-рыба', w: 9, p: 80, icon: '🗡', food: 90, fish: true },
  f_trout: { name: 'Речная форель', w: 0.8, p: 14, icon: '🐟', food: 30, fish: true },
  f_eel: { name: 'Угорь', w: 1.2, p: 20, icon: '🐟', food: 35, fish: true },
  f_pike: { name: 'Щука', w: 3, p: 32, icon: '🐟', food: 45, fish: true },
  f_sturgeon: { name: 'Осётр', w: 7, p: 110, icon: '🐟', food: 80, fish: true },
};
export const FOOD_KEYS = Object.keys(RES).filter((k) => RES[k].food);

// Рыбы: шанс по месту (мелководье/открытое море), вес (кг) — трофей, если больше trophy
export const FISH = {
  f_sardine: { chance: [30, 18], kg: [0.05, 0.2], trophy: 0.18, diff: 0.15 },
  f_mackerel: { chance: [22, 18], kg: [0.2, 1.2], trophy: 1, diff: 0.25 },
  f_seabass: { chance: [16, 10], kg: [0.8, 9], trophy: 7, diff: 0.4 },
  f_dentex: { chance: [10, 10], kg: [1, 14], trophy: 10, diff: 0.45 },
  f_octopus: { chance: [12, 4], kg: [0.5, 10], trophy: 7, diff: 0.4 },
  f_grouper: { chance: [5, 8], kg: [3, 45], trophy: 30, diff: 0.6 },
  f_moray: { chance: [4, 5], kg: [1, 25], trophy: 15, diff: 0.65 },
  f_tuna: { chance: [0, 0], kg: [80, 420], trophy: 280, diff: 0.7, big: true }, // только большой удочкой с баркаса, вдвоём
  f_swordfish: { chance: [0.3, 8], kg: [25, 300], trophy: 200, diff: 0.85 },
  f_sturgeon: { chance: [0.2, 1.5], kg: [10, 160], trophy: 110, diff: 0.9 },
  // пресноводные: клюют только в реках и озёрах
  f_trout: { chance: [0, 0], fresh: 40, kg: [0.2, 3.5], trophy: 2.8, diff: 0.3 },
  f_eel: { chance: [0, 0], fresh: 30, kg: [0.3, 4], trophy: 3.2, diff: 0.45 },
  f_pike: { chance: [0, 0], fresh: 18, kg: [1, 22], trophy: 15, diff: 0.6 },
};

// ---------- Снаряжение (уникальные предметы) ----------
// slot: weapon | offhand | head | body | legs | tool ; kind оружия: blade|axe|spear|bow|fist|knife
// q — качество 0..3 (обычное, хорошее, отличное, легендарное) умножает урон/броню
export const QUALITY = [
  { name: 'обычное', mul: 1, color: '#d8d2c4' },
  { name: 'хорошее', mul: 1.15, color: '#7fd06a' },
  { name: 'отличное', mul: 1.32, color: '#5aa8ff' },
  { name: 'легендарное', mul: 1.55, color: '#ffb340' },
];
export const GEAR = {
  // оружие: dmg, cd — пауза между ударами, range, stam — выносливость за удар
  knife: { name: 'Нож (культер)', slot: 'weapon', kind: 'knife', dmg: 9, cd: 0.42, range: 2.0, stam: 4, p: 15, tier: 0 },
  gladius: { name: 'Гладиус', slot: 'weapon', kind: 'blade', dmg: 16, cd: 0.55, range: 2.4, stam: 6, p: 80, tier: 1 },
  spatha: { name: 'Спата', slot: 'weapon', kind: 'blade', dmg: 21, cd: 0.7, range: 2.8, stam: 8, p: 180, tier: 2 },
  axe: { name: 'Топор (секира)', slot: 'weapon', kind: 'axe', dmg: 24, cd: 0.95, range: 2.5, stam: 10, p: 60, tier: 1, chop: true },
  hasta: { name: 'Копьё (гаста)', slot: 'weapon', kind: 'spear', dmg: 18, cd: 0.75, range: 3.6, stam: 7, p: 70, tier: 1 },
  lance: {name:'Кавалерийское копьё (ксистон)',slot:'weapon',kind:'spear',dmg:23,cd:1.05,range:4.2,stam:9,p:240,tier:2,desc:'Длинное копьё: верхом удерживайте Shift и разгонитесь не менее 0,7 с. Касание наконечником наносит тройной урон.'},
  bow: { name: 'Составной лук', slot: 'weapon', kind: 'bow', dmg: 17, cd: 0.9, range: 60, stam: 5, p: 140, tier: 2, ammo: 'arrow' },
  khopesh: { name: 'Хопеш фараона', slot: 'weapon', kind: 'blade', dmg: 30, cd: 0.65, range: 2.7, stam: 7, p: 900, tier: 4, rare: true },
  falcata: { name: 'Фальката', slot: 'weapon', kind: 'blade', dmg: 28, cd: 0.62, range: 2.6, stam: 7, p: 800, tier: 4, rare: true },
  rudis: { name: 'Рудис чемпиона', slot: 'weapon', kind: 'blade', dmg: 24, cd: 0.5, range: 2.4, stam: 5, p: 0, tier: 3, rare: true, bound: true },
  // щиты: block — доля поглощённого урона
  parma: { name: 'Парма (малый щит)', slot: 'offhand', kind: 'shield', block: 0.6, armor: 2, p: 50, tier: 1 },
  scutum: { name: 'Скутум', slot: 'offhand', kind: 'shield', block: 0.85, armor: 4, p: 160, tier: 2, slow: 0.05 },
  // броня: armor — снижение урона в процентах (сумма, не больше 70)
  pileus: { name: 'Войлочная шапка', slot: 'head', armor: 2, p: 10, tier: 0 },
  galea_bronze: { name: 'Бронзовый шлем (Монтефортино)', slot: 'head', armor: 7, p: 90, tier: 1 },
  galea_iron: { name: 'Железный шлем (имперский галльский)', slot: 'head', armor: 11, p: 260, tier: 2 },
  galea_centurio: { name: 'Шлем центуриона', slot: 'head', armor: 14, p: 600, tier: 3 },
  subarmalis: { name: 'Стёганый поддоспешник', slot: 'body', armor: 8, p: 60, tier: 0 },
  hamata: { name: 'Кольчуга (лорика хамата)', slot: 'body', armor: 18, p: 320, tier: 2, slow: 0.04 },
  squamata: { name: 'Чешуйчатый доспех', slot: 'body', armor: 22, p: 520, tier: 2, slow: 0.05 },
  segmentata: { name: 'Лорика сегментата', slot: 'body', armor: 28, p: 900, tier: 3, slow: 0.06 },
  croc_armor: { name: 'Панцирь из крокодиловой кожи', slot: 'body', armor: 32, p: 1500, tier: 4, slow: 0.03 },
  croc_helm: { name: 'Шлем из крокодиловой кожи', slot: 'head', armor: 16, p: 900, tier: 4 },
  punic_mail: { name: 'Пунийская кираса', slot: 'body', armor: 25, p: 800, tier: 3, rare: true },
  caligae: { name: 'Калиги', slot: 'legs', armor: 2, p: 20, tier: 0 },
  ocreae: { name: 'Бронзовые поножи', slot: 'legs', armor: 6, p: 120, tier: 1 },
  ocreae_iron: { name: 'Железные поножи', slot: 'legs', armor: 9, p: 300, tier: 2 },
  // инструменты (в руке вместо оружия)
  pick: { name: 'Кирка (долабра)', slot: 'weapon', kind: 'tool', dmg: 10, cd: 0.8, range: 2.3, stam: 6, p: 35, tier: 0, mine: true },
  rod: { name: 'Удочка', slot: 'weapon', kind: 'rod', dmg: 2, cd: 1, range: 1.8, stam: 0, p: 25, tier: 0 },
  rod_bronze: { name: 'Тростниковая удочка с бронзовым кольцом', slot: 'weapon', kind: 'rod', dmg: 2, cd: 1, range: 1.8, stam: 0, p: 90, tier: 1, luck: 0.12 },
  rod_pro: { name: 'Удочка из бамбука с бронзовым крючком', slot: 'weapon', kind: 'rod', dmg: 2, cd: 1, range: 1.8, stam: 0, p: 220, tier: 2, luck: 0.25 },
  rod_master: { name: 'Кедровая удочка мастера с серебряной оснасткой', slot: 'weapon', kind: 'rod', dmg: 2, cd: 1, range: 1.8, stam: 0, p: 600, tier: 3, luck: 0.4 },
  rod_tuna: { name: 'Тяжёлая морская удочка', slot: 'weapon', kind: 'rod', dmg: 3, cd: 1, range: 1.8, stam: 0, p: 400, tier: 2, luck: 0.2, big: true },
  torch: { name: 'Факел', slot: 'weapon', kind: 'torch', dmg: 7, cd: 0.6, range: 2, stam: 4, p: 5, tier: 0 },
};
export const ARMOR_CAP = 70;

// ---------- Ремесло ----------
// где (здание) → рецепты: in — ресурсы, out — ресурс или gear
export const RECIPES = [
  { id: 'plank', at: 'fabrica', in: { wood: 2 }, out: { plank: 1 }, n: 'Доски' },
  { id: 'brick', at: 'fabrica', in: { clay: 2, wood: 1 }, out: { brick: 2 }, n: 'Кирпичи' },
  { id: 'amphora', at: 'fabrica', in: { clay: 3 }, out: { amphora: 1 }, n: 'Амфора' },
  { id: 'arrow', at: 'fabrica', in: { wood: 1, iron: 1 }, out: { arrow: 15 }, n: 'Стрелы ×15' },
  { id: 'bandage', at: 'fabrica', in: { linen: 1 }, out: { bandage: 2 }, n: 'Перевязки ×2' },
  { id: 'leather', at: 'fabrica', in: { hide: 2 }, out: { leather: 1 }, n: 'Кожа' },
  { id: 'iron', at: 'ferraria', in: { iron_ore: 2, wood: 2 }, out: { iron: 1 }, n: 'Железо' },
  { id: 'silver', at: 'ferraria', in: { silver_ore: 2, wood: 2 }, out: { silver: 1 }, n: 'Серебро' },
  { id: 'pilum', at: 'ferraria', in: { iron: 1, wood: 1 }, out: { pilum: 2 }, n: 'Пилумы ×2' },
  { id: 'g_knife', at: 'ferraria', in: { iron: 1, wood: 1 }, gear: 'knife' },
  { id: 'g_pick', at: 'ferraria', in: { iron: 1, wood: 2 }, gear: 'pick' },
  { id: 'g_gladius', at: 'ferraria', in: { iron: 3, leather: 1 }, gear: 'gladius' },
  { id: 'g_axe', at: 'ferraria', in: { iron: 2, wood: 2 }, gear: 'axe' },
  { id: 'g_hasta', at: 'ferraria', in: { iron: 1, wood: 3 }, gear: 'hasta' },
  { id: 'g_spatha', at: 'ferraria', in: { iron: 5, leather: 1, silver: 1 }, gear: 'spatha', lvl: 6 },
  {id:'g_lance',at:'fabrica',in:{plank:3,iron:2,leather:1},gear:'lance',lvl:3},
  { id: 'g_bow', at: 'fabrica', in: { cedar: 3, leather: 1, linen: 1 }, gear: 'bow', lvl: 4 },
  { id: 'g_parma', at: 'fabrica', in: { plank: 3, leather: 1, iron: 1 }, gear: 'parma' },
  { id: 'g_scutum', at: 'ferraria', in: { plank: 4, leather: 2, iron: 2 }, gear: 'scutum', lvl: 5 },
  { id: 'g_subarmalis', at: 'fabrica', in: { linen: 4, leather: 1 }, gear: 'subarmalis' },
  { id: 'g_caligae', at: 'fabrica', in: { leather: 2, iron: 1 }, gear: 'caligae' },
  { id: 'g_galea_bronze', at: 'ferraria', in: { iron: 2, leather: 1 }, gear: 'galea_bronze', lvl: 2 },
  { id: 'g_ocreae', at: 'ferraria', in: { iron: 3, leather: 1 }, gear: 'ocreae', lvl: 3 },
  { id: 'g_hamata', at: 'ferraria', in: { iron: 10, leather: 2 }, gear: 'hamata', lvl: 7 },
  { id: 'g_galea_iron', at: 'ferraria', in: { iron: 6, leather: 1, silver: 1 }, gear: 'galea_iron', lvl: 8 },
  { id: 'g_ocreae_iron', at: 'ferraria', in: { iron: 6, leather: 2 }, gear: 'ocreae_iron', lvl: 8 },
  { id: 'g_squamata', at: 'ferraria', in: { iron: 12, leather: 3, silver: 1 }, gear: 'squamata', lvl: 10 },
  { id: 'g_segmentata', at: 'ferraria', in: { iron: 18, leather: 4, silver: 2 }, gear: 'segmentata', lvl: 14 },
  { id: 'g_galea_centurio', at: 'ferraria', in: { iron: 8, silver: 3, purple: 1 }, gear: 'galea_centurio', lvl: 16 },
  { id: 'g_croc_armor', at: 'ferraria', in: { croc_hide: 4, leather: 6, iron: 4 }, gear: 'croc_armor', lvl: 10 },
  { id: 'g_croc_helm', at: 'ferraria', in: { croc_hide: 2, leather: 2, iron: 2 }, gear: 'croc_helm', lvl: 8 },
  { id: 'g_rod_bronze', at: 'fabrica', in: { calamus: 3, iron: 1, linen: 1 }, gear: 'rod_bronze', lvl: 2 },
  { id: 'g_rod_pro', at: 'fabrica', in: { cedar: 2, iron: 1, linen: 2 }, gear: 'rod_pro', lvl: 5 },
  { id: 'g_rod_master', at: 'fabrica', in: { cedar: 4, silver: 1, linen: 3 }, gear: 'rod_master', lvl: 9 },
  { id: 'g_rod_tuna', at: 'fabrica', in: { cedar: 3, iron: 3, linen: 4, leather: 1 }, gear: 'rod_tuna', lvl: 4 },
  { id: 'bread', at: 'pistrinum', in: { wheat: 3, wood: 1 }, out: { bread: 2 }, n: 'Хлеб ×2' },
  { id: 'oil', at: 'pistrinum', in: { olives: 4, amphora: 1 }, out: { oil: 1 }, n: 'Масло' },
  { id: 'wine', at: 'pistrinum', in: { grapes: 4, amphora: 1 }, out: { wine: 1 }, n: 'Вино' },
  { id: 'purple', at: 'fabrica', in: { murex: 6, wood: 1 }, out: { purple: 1 }, n: 'Пурпур', lvl: 3 },
];

// ---------- Постройки ----------
// pub — общественная (строят вместе), иначе — частная (владелец). r — радиус, cost — ресурсы,
// need — что должно быть построено, rank — звание для частной, prod — производство в минуту
export const BUILDINGS = {
  forum: { name: 'Форум', pub: true, r: 15, cost: { wood: 40, stone: 60, plank: 20 }, desc: 'Сердце колонии: выборы, законы, доска заданий, запросы Рима.' },
  horreum: { name: 'Хорреум (склад)', pub: true, r: 9, cost: { wood: 30, stone: 30 }, need: ['forum'], desc: 'Общий склад и казна колонии.' },
  fabrica: { name: 'Мастерская', cat: 'civic', pub: true, r: 8, cost: { wood: 30, stone: 20 }, need: ['forum'], desc: 'Доски, кирпичи, амфоры, стрелы, кожа, луки, щиты.' },
  ferraria: { name: 'Кузница', cat: 'civic', pub: true, r: 8, cost: { plank: 15, brick: 20, stone: 20 }, need: ['fabrica'], desc: 'Плавка железа и серебра, оружие и доспехи.' },
  pistrinum: { name: 'Пекарня и пресс', cat: 'civic', pub: true, r: 7, cost: { plank: 10, brick: 15 }, need: ['fabrica'], desc: 'Хлеб, оливковое масло, вино.' },
  macellum: { name: 'Рынок и невольничий рынок', pub: true, r: 12, cost: { plank: 25, brick: 25, stone: 20 }, need: ['horreum'], desc: 'Торговля с купцами, покупка рабов.' },
  portus: { name: 'Гавань и верфь', pub: true, r: 30, shore: true, cost: { plank: 40, wood: 30, stone: 30 }, need: ['fabrica'], desc: 'Большая гавань: три длинных причала (6 мест для кораблей, швартовка — G у руля), портовые склады, постройка кораблей.' },
  castra: { name: 'Казармы', pub: true, r: 13, cost: { plank: 30, brick: 40, iron: 10 }, need: ['ferraria'], desc: 'Гарнизон колонии: легат нанимает солдат.' },
  thermae: { name: 'Термы', pub: true, r: 11, cost: { brick: 50, marble: 15, stone: 30 }, need: ['macellum'], desc: 'Быстрое лечение и бодрость: +25% опыта на 10 минут.' },
  taberna: { name: 'Таверна', cat: 'civic', pub: true, r: 8, cost: { plank: 20, brick: 15 , calamus: 10}, need: ['forum'], desc: 'Местные жители дают поручения; сытная еда.' },
  templum: { name: 'Храм Юпитера', pub: true, r: 12, cost: { marble: 40, brick: 30, stone: 40 }, need: ['thermae'], desc: 'Гордость колонии: расположение Рима растёт быстрее, граждане получают больше достоинства.' },
  turris: { name: 'Сторожевая башня', pub: true, r: 4, cost: { stone: 30, plank: 10 }, need: ['castra'], multi: true, desc: 'Лучники на башне стреляют по врагам в 45 м.' },
  murus: { name: 'Участок стены', pub: true, r: 6, cost: { stone: 25 }, need: ['castra'], multi: true, desc: 'Стена задерживает налётчиков.' },
  pharos: { name: 'Маяк', pub: true, r: 6, shore: true, cost: { stone: 60, marble: 20, plank: 20 }, need: ['portus'], desc: 'Набеги с моря видны на 60 секунд раньше; корабли быстрее на 10%.' },
  stabulum: { name: 'Общественная конюшня', cat: 'rural', pub: true, muni: true, r: 9, cost: { wood: 40, stone: 15 , calamus: 20}, desc: 'Городская конюшня: коня берут на время (на сутки), здесь же оставляют на постой. Владельцы своих конюшен покупают тут жеребят со скидкой 90%.' },
  via_cell: { name:'Городская улица (клетка)',pub:true,road:true,multi:true,r:2,len:4,wid:4,cost:{stone:5},desc:'Улица 4×4 м. Прокладывает только местный эдил, по сетке города, соединяя с существующей дорогой.' },
  via: { name: 'Римская дорога', pub: true, road: true, multi: true, r: 4, len: 8, wid: 4, ports: [[0, 4, 0], [0, -4, Math.PI]], cost: { stone: 10 }, desc: 'Мощёный участок 4×8 м. Ставится сразу из вашей сумки где угодно на главном острове; по дороге ходят на 25% быстрее.' },
  via_turn: { name: 'Поворот дороги', pub: true, road: true, multi: true, r: 2.5, len: 4, wid: 4, ports: [[0, -2, Math.PI], [2, 0, Math.PI / 2]], cost: { stone: 5 }, desc: 'Угловой участок 4×4 м: дорога поворачивает под прямым углом. Колесо — повернуть в другую сторону.' },
  via_cross: { name: 'Перекрёсток', pub: true, road: true, multi: true, r: 2.5, len: 4, wid: 4, ports: [[0, 2, 0], [0, -2, Math.PI], [2, 0, Math.PI / 2], [-2, 0, -Math.PI / 2]], cost: { stone: 5 }, desc: 'Перекрёсток 4×4 м: дороги расходятся на четыре стороны.' },
  pons: { name: 'Мост', pub: true, road: true, bridge: true, multi: true, r: 4, len: 24, wid: 4.4, ports: [[0, 12, 0], [0, -12, Math.PI]], cost: { stone: 40, plank: 25 }, desc: 'Горбатый каменный мост 24 м через реку: под высоким сводом проходят лодки. Ставится поперёк русла (сам разворачивается), из вашей сумки.' },
  collegium: { name: 'Торговая гильдия', cat: 'civic', pub: true, r: 10, cost: { plank: 40, brick: 30, stone: 30, marble: 6 }, need: ['macellum'], desc: 'Здесь собирают торговые ящики четырёх сортов. Ящики несут в руках, грузят на корабли и продают торговцам на островах и у истоков рек.' },
  amphitheatrum: { name: 'Арена', pub: true, r: 63, cost: { stone: 200, brick: 120, marble: 40, plank: 60 }, need: ['macellum'], desc: 'Большая арена: гладиаторские бои, волны противников, поединки и ставки.' },
  // городские здания на постоянных местах (их не закладывают — ремонтируют)
  forum_m: { name: 'Форум Мессаны', pub: true, muni: true, r: 36, cost: { stone: 150, marble: 30, plank: 50 }, desc: 'Большой форум на перекрёстке кардо и декуманус: ростры для речей, место голосований, ряды рыночных лавок.' },
  curia: { name: 'Курия (ратуша)', pub: true, muni: true, r: 9, cost: { brick: 40, stone: 40, marble: 10 }, desc: 'Ратуша: здесь платят взнос за новое звание, заседает совет города.' },
  stall: { name: 'Лавка рынка', pub: true, muni: true, stall: true, rent: 3, slots: 1, r: 2.6, cost: { plank: 8, wood: 6 }, desc: 'Лавка в торговом ряду: у каждой свой класс товаров. Покупатели-горожане платят дороже скупщика.' },
  mercator: { name: 'Лавка скупщика', pub: true, muni: true, r: 6, cost: { plank: 20, brick: 15 }, desc: 'Скупщик берёт всё и сразу, но по сниженной цене. Открыт с 12:00 до 20:00.' },
  servile: { name: 'Невольничий рынок', pub: true, muni: true, r: 9, cost: { plank: 30, wood: 20 }, desc: 'Помост работорговцев у гавани: покупка и продажа рабов.' },
  theatrum: { name: 'Амфитеатр (театр)', pub: true, muni: true, r: 24, cost: { stone: 120, marble: 20, plank: 30 }, desc: 'Полукруглый театр: представления, речи сенаторов, сбор граждан.' },
  armamentarium: { name: 'Арсенал', pub: true, muni: true, r: 10, cost: { stone: 50, iron: 20, plank: 20 }, desc: 'Оружейные склады города: снаряжение отрядов.' },
  castellum: { name: 'Акведук', pub: true, muni: true, r: 4, cost: { stone: 80, brick: 40 }, desc: 'Акведук от ближайшей реки и водонапорная башня: вода для терм и фонтанов.' },
  // частные
  domus: { name: 'Дом', cat: 'civic', r: 6, cost: { wood: 20, stone: 15 }, desc: 'Ваш дом в городе: место возрождения, личный сундук. Землю он не закрепляет — свою территорию даёт только вилла латифундии.', rank: 0, limit: 1 },
  farm: { name: 'Ферма', cat: 'rural', r: 9, cost: { wood: 20, stone: 10 , calamus: 15}, prod: { wheat: 6 }, slots: 4, rank: 0, desc: 'Пшеница.' },
  olivetum: { name: 'Оливковая роща', cat: 'rural', r: 9, cost: { wood: 25, stone: 10 }, prod: { olives: 5 }, slots: 4, rank: 1, desc: 'Оливки.' },
  vinea: { name: 'Виноградник', cat: 'rural', r: 9, cost: { wood: 25, stone: 10 }, prod: { grapes: 5 }, slots: 4, rank: 1, desc: 'Виноград.' },
  lumber: { name: 'Лесопилка', cat: 'rural', r: 7, cost: { wood: 30, stone: 10 }, prod: { wood: 8, plank: 1 }, slots: 3, rank: 0, desc: 'Брёвна и немного досок.' },
  figlina: { name: 'Гончарня', cat: 'rural', r: 7, cost: { wood: 20, stone: 20 }, prod: { clay: 6, amphora: 1 }, slots: 3, rank: 1, desc: 'Глина и амфоры.' },
  fishery: { name: 'Рыбный промысел', cat: 'harbor', r: 7, shore: true, cost: { wood: 25, plank: 10 , calamus: 12}, prod: { f_sardine: 4, f_mackerel: 2 }, slots: 3, rank: 0, desc: 'Сети на берегу: рыба.' },
  pecus: { name: 'Скотный двор', cat: 'rural', r: 9, cost: { wood: 30, plank: 10 , calamus: 15}, prod: { hide: 2, meat: 3 }, slots: 3, rank: 1, desc: 'Козы и овцы: шкуры и мясо.' },
  linarium: { name: 'Льняное поле', cat: 'rural', r: 8, cost: { wood: 20, stone: 5 , calamus: 10}, prod: { linen: 4 }, slots: 3, rank: 0, desc: 'Лён для перевязок и поддоспешников.' },
  equile: { name: 'Своя конюшня', cat: 'rural', r: 7, cost: { wood: 30, plank: 12, calamus: 12 }, rank: 0, limit: 1, desc: 'Своё конное дело: жеребят (со скидкой 90% в общественной конюшне) кормят пшеном 3 дня, пока вырастут, потом продают или сдают в аренду другим игрокам — выручка (после налога) ваша. Свои кони стоят здесь бесплатно.' },
  ludus: { name: 'Школа гладиаторов', cat: 'civic', r: 9, ap: 40, cost: { wood: 30, stone: 20, plank: 10 }, rank: 1, limit: 1, slots: 8, desc: 'Частная школа в черте города (40 очков арены): здесь тренируются и живут гладиаторы — свои бесплатно, чужие платят хозяину за обучение и содержание; здесь же продают и покупают гладиаторов (хозяину школы — 10% с чужих сделок).' },
  vivarium: { name: 'Зверинец', cat: 'civic', r: 8, ap: 60, cost: { wood: 25, stone: 25, iron: 6 }, rank: 1, limit: 1, desc: 'Покупается за 60 очков арены: здесь держат прирученных львов для боёв на арене.' },
  // новые частные постройки на купленных клетках
  insula: { name: 'Инсула (доходный дом)', r: 6, cat: 'civic', rank: 1, rent: 6, cost: { plank: 30, brick: 40, stone: 20 }, desc: 'Многоэтажный дом под сдачу: жильцы платят хозяину денарии каждую минуту (в дорогом районе — больше).' },
  balneum: { name: 'Баня', r: 6, cat: 'civic', rank: 1, rent: 4, cost: { brick: 40, stone: 20, plank: 10 }, desc: 'Небольшие бани: посетители платят хозяину; здесь быстро лечатся.' },
  popina: { name: 'Закусочная (термополий)', r: 5, cat: 'civic', rank: 0, rent: 3, prod: { bread: 1 }, slots: 2, cost: { plank: 20, brick: 15 }, desc: 'Горячая еда на вынос: доход и немного хлеба.' },
  fullonica: { name: 'Сукновальня и красильня', r: 6, cat: 'civic', rank: 1, rent: 2, prod: { linen: 3 }, slots: 3, cost: { plank: 25, brick: 20, linen: 10 }, desc: 'Моют и красят ткани: лён и доход.' },
  officina: { name: 'Мастерская ремесленника', r: 5, cat: 'civic', rank: 0, rent: 2, prod: { amphora: 1, plank: 1 }, slots: 2, cost: { plank: 20, stone: 15 }, desc: 'Гончар и столяр: амфоры и доски.' },
  campus: { name: 'Кампус (мусейон)', r: 12, cat: 'civic', rank: 2, limit: 1, cost: { marble: 20, brick: 40, plank: 30, papyrus: 10 }, desc: 'Учёные делают здесь снаряжение для исследований, ведут записи открытий и присваивают учёные звания.' },
  horreum_s: { name: 'Частный склад', r: 6, cat: 'any', rank: 0, cost: { plank: 20, stone: 20 }, desc: 'Склад для торговых ящиков: сюда складываются ящики, которые делают ваши работники; отсюда их забирают торговые пути.' },
  navalia: { name: 'Верфь', r: 12, cat: 'harbor', shore: true, rank: 1, cost: { plank: 60, wood: 40, stone: 20 }, desc: 'Своя верфь при гавани: здесь строят малые, средние и большие корабли.' },
  murex_farm: { name: 'Пурпурная и жемчужная ферма', r: 7, cat: 'harbor', shore: true, rank: 1, prod: { murex: 3, pearl: 0.05 }, slots: 3, cost: { plank: 20, stone: 20 }, desc: 'Садки с мурексом у воды: раковины для пурпура и изредка жемчуг.' },
  alvearia: { name: 'Пасека', r: 5, cat: 'rural', rank: 0, prod: { honey: 2 }, slots: 2, cost: { wood: 15, clay: 10 }, desc: 'Ульи: мёд.' },
  salinae: { name: 'Солеварня', r: 8, cat: 'rural', rank: 0, prod: { salt: 4 }, slots: 3, cost: { wood: 15, stone: 20 }, desc: 'Солевые пруды: соль для заготовок рыбы и мяса.' },
  villa: { name: 'Вилла латифундии', r: 14, cat: 'lat', lat: true, rank: 3, limit: 1, cost: { plank: 60, stone: 60, brick: 30, marble: 6 }, desc: 'Главный дом латифундии. Здесь живут ваши рабы и гладиаторы, а в преторий ставят отряды.' },
  praetorium: { name: 'Преторий (казармы отрядов)', r: 10, cat: 'lat', rank: 3, limit: 1, cost: { plank: 40, stone: 40, iron: 10 }, desc: 'Здесь живут ваши отряды: пехота, конница, лучники и артиллерия.' },
  statio: { name: 'Сухопутный торговый пост', r: 8, cat: 'lat', rank: 2, cost: { plank: 30, wood: 20, stone: 10 }, desc: 'Станция караванов: отсюда повозки с ящиками идут по римским дорогам.' },
  emporium: { name: 'Морской торговый пост', r: 9, cat: 'lat', shore: true, rank: 2, cost: { plank: 40, stone: 20, wood: 20 }, desc: 'Пристань со складом: отсюда морские торговые пути везут ящики в города.' },
  warehouse: { name: 'Личный городской склад', r: 7, cat: 'any', rank: 0, capacity: 5000, cost: { plank: 25, stone: 20 }, desc: 'Ресурсы владельца для стройки и ремонта в этом городе и его пригородах. Хозяйства автоматически доставляют сюда продукцию; доставку можно отключить в окне хозяйства.' },
  supply_depot: { name: 'Общий склад снабжения', r: 7, cat: 'any', rank: 1, capacity: 8000, cost: { plank: 40, stone: 30, iron: 4 }, desc: 'Общий запас кооперативной группы: любой гражданин может внести или забрать припасы у здания. Частные городские склады остаются доступны только хозяину.' },
  quarters: { name: 'Жильё работников', r: 6, cat: 'any', rank: 0, housing: 8, cost: { plank: 20, brick: 12, linen: 4 }, desc: 'Жильё и отдых для 8 работников. Проживание назначается автоматически. Еда расходуется со складов и из сумки хозяина.' },
  // колония
  colonia: { name: 'Колония', r: 10, colony: true, cost: { plank: 40, stone: 40, iron: 5, bread: 20 }, slots: 6, desc: 'Аванпост на острове: пять промыслов (три обычных, редкий и очень редкий), каждый улучшается до 5 ступени. Товары вывозят кораблём или торговым путём.' },
};
// каждое частное здание приносит хозяину доход (ден./мин), если своего дохода у него нет
const PRIV_RENT = { domus: 1, equile: 2, ludus: 3, vivarium: 3, campus: 3, horreum_s: 1, navalia: 3, villa: 5, praetorium: 2, statio: 3, emporium: 4, farm: 1, olivetum: 1, vinea: 1, lumber: 1, figlina: 1, fishery: 1, pecus: 1, linarium: 1, murex_farm: 2, alvearia: 1, salinae: 1, fabrica: 2, ferraria: 2, pistrinum: 2, taberna: 3, collegium: 3, stabulum: 0 };
for (const [k, b] of Object.entries(BUILDINGS)) if (!b.pub && !b.road && !b.colony && !b.rent && PRIV_RENT[k]) b.rent = PRIV_RENT[k];
// стройка стала дешевле в 2,5 раза
for (const b of Object.values(BUILDINGS)) for (const k in b.cost) b.cost[k] = Math.max(1, Math.ceil(b.cost[k] / 2.5));
// бывшие общественные мастерские теперь ставят частники на своих клетках (пользуются все)
for (const k of ['fabrica', 'ferraria', 'pistrinum', 'taberna', 'collegium', 'stabulum']) { const b = BUILDINGS[k]; delete b.pub; delete b.need; b.rank = b.rank || 0; b.open = true; }
for (const b of Object.values(BUILDINGS)) if (!b.cat && !b.muni && !b.road && !b.colony && b.pub) b.cat = 'muni';
for(const type of ['warehouse','supply_depot','quarters']) BUILDINGS[type].cells=4; BUILDINGS.collegium.cells=5;
BUILDINGS.domus.housing = 2; BUILDINGS.villa.housing = 6;
// вкладки окна строительства
const notMuni = (k) => !BUILDINGS[k].muni;
export const BUILD_TABS = [
  ['civic', '🏛 Общественные', Object.keys(BUILDINGS).filter((k) => (BUILDINGS[k].cat === 'civic' || BUILDINGS[k].cat === 'any') && notMuni(k))],
  ['harbor', '⚓ При гавани', Object.keys(BUILDINGS).filter((k) => (BUILDINGS[k].cat === 'harbor' || BUILDINGS[k].cat === 'any') && notMuni(k))],
  ['rural', '🌾 За стенами', Object.keys(BUILDINGS).filter((k) => (BUILDINGS[k].cat === 'rural' || BUILDINGS[k].cat === 'any') && notMuni(k))],
  ['lat', '🏰 Латифундия', Object.keys(BUILDINGS).filter((k) => (['lat', 'rural', 'any'].includes(BUILDINGS[k].cat) || ['ludus', 'vivarium', 'fabrica', 'ferraria'].includes(k)) && notMuni(k))],
  ['roads', '🛣 Дороги и мосты', ['via', 'via_turn', 'via_cross', 'pons']],
  ['colony', '🚩 Колония', ['colonia']],
];
// группы построек внутри вкладок окна строительства
export const BUILD_GROUPS = [
  ['🏠 Жильё', ['domus', 'insula', 'villa', 'quarters']],
  ['🍷 Еда и отдых', ['taberna', 'popina', 'balneum', 'pistrinum']],
  ['🔨 Ремесло', ['fabrica', 'ferraria', 'officina', 'fullonica', 'figlina', 'lumber']],
  ['📦 Торговля и склады', ['collegium', 'warehouse', 'supply_depot', 'horreum_s', 'statio', 'emporium']],
  ['🌾 Поля и сады', ['farm', 'olivetum', 'vinea', 'linarium', 'alvearia']],
  ['🐄 Скот и кони', ['pecus', 'stabulum', 'equile']],
  ['🐟 Промыслы', ['fishery', 'murex_farm', 'salinae']],
  ['⚓ Флот', ['navalia']],
  ['⚔ Арена и войско', ['ludus', 'vivarium', 'praetorium']],
  ['📜 Наука', ['campus']],
  ['🛣 Дороги', ['via', 'via_turn', 'via_cross']],
  ['🌉 Мосты', ['pons']],
];
export const buildGroupOf = (k) => (BUILD_GROUPS.find((g) => g[1].includes(k)) || ['🏛 Прочее'])[0];
// разведение коней в своей конюшне: пшеница, время (с), шанс породы лучше родителей, продажа конюшему (доля цены), молодых не больше
export const BREED = { wheat: 20, time: 900, upChance: 0.15, npcK: 0.7, maxFoals: 4 };
// кони (покупаются в Конюшне)
// пять пород: чем дороже конь, тем быстрее и тем больше перемётная сумка (кг к вместимости, пока конь с вами)
export const HORSES = {
  gnedoy: { name: 'Гнедой конь', price: 150, speed: 1.6, bag: 20, col: 0x7a4a28 },
  voronoy: { name: 'Вороной конь', price: 320, speed: 1.75, bag: 35, col: 0x231b17 },
  albus: { name: 'Белый скакун', price: 650, speed: 1.9, bag: 50, col: 0xe2dccf },
  thessalus: { name: 'Фессалийский конь', price: 1100, speed: 2.0, bag: 70, col: 0x9a6a3a },
  numida: { name: 'Нумидийский скакун', price: 1800, speed: 2.1, bag: 100, col: 0x3a2a22 },
};
// конюшни: жеребята (только владельцам своих конюшен, со скидкой 90%), растут 3 игровых дня; аренда — на сутки
export const HORSE_ECON = { foalK: 0.1, grow: 3 * 1200, rentK: 0.12, rentTime: 1200, npcK: 0.7, stock: 6, publicRent: ['gnedoy', 'voronoy', 'albus'] };
export const horseBag = (c) => { if (!c || !c.horseOut) return 0; const h = (c.horses || []).find((x) => x.id === c.horseOut); return h && HORSES[h.kind] ? HORSES[h.kind].bag : 0; };
export const PUBLIC_ORDER = Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].pub);
export const cellsOf = type => (!BUILDINGS[type].pub&&!BUILDINGS[type].muni?plotSize(type,CELL):null)||BUILDINGS[type].cells||Math.max(1,Math.ceil(BUILDINGS[type].r*1.5/CELL));

// ---------- Звания поселенцев (по достоинству) ----------
export const RANKS = [
  { name: 'Колонист', fee: 0, dig: 0, priv: 4, slaves: 2, vote: 1, cells: 20 },
  { name: 'Плебей', fee: 80, dig: 60, priv: 5, slaves: 4, vote: 1, cells: 40 },
  { name: 'Гражданин', fee: 250, dig: 180, priv: 6, slaves: 6, vote: 2, cells: 70 },
  { name: 'Всадник', fee: 700, dig: 450, priv: 8, slaves: 9, vote: 2, cells: 110 },
  { name: 'Патриций', fee: 1800, dig: 1000, priv: 10, slaves: 12, vote: 3, cells: 170 },
  { name: 'Сенатор', fee: 4500, dig: 2200, priv: 12, slaves: 15, vote: 4, cells: 260 },
];
// звание: нужно одобрение Рима (очки) И взнос в Курии; rankBought — купленный уровень
export const rankIdx = (dig) => { let r = 0; RANKS.forEach((x, i) => { if (dig >= x.dig) r = i; }); return r; };

// ---------- Опыт персонажа ----------
export const xpNeed = (lvl) => Math.round(80 * Math.pow(lvl, 1.55));
export const STATS = {
  str: { name: 'Сила', desc: '+4% урона в ближнем бою, +4 к вместимости сумки' },
  end: { name: 'Выносливость', desc: '+10 здоровья, +5 выносливости' },
  agi: { name: 'Ловкость', desc: '+2% скорости ударов, +4% урона из лука и пилумом, +1% скорости бега' },
  cha: { name: 'Красноречие', desc: '−1.5% к ценам покупки, +1.5% к ценам продажи, +5% к голосу на выборах' },
};
// ---------- Специализации (1 очко за каждый уровень, до 5 ступеней) ----------
export const SPECS = {
  war: { name: 'Воин', icon: '⚔', desc: '+5% урона в бою и +2% брони за ступень', top: 'Боевой клич: каждый 5-й удар — двойной урон' },
  merc: { name: 'Торговец', icon: '⚖', desc: 'Покупка дешевле и продажа дороже на 3% за ступень', top: 'Без налога с торговли' },
  farm: { name: 'Земледелец', icon: '🌾', desc: 'Ваши хозяйства и колонии производят на 10% больше за ступень', top: 'Рабы в ваших хозяйствах не голодают вполсилы и едят вдвое меньше' },
  gath: { name: 'Добытчик', icon: '⛏', desc: '+8% шанс добыть лишний ресурс, +6 кг к сумке за ступень', top: 'Шанс 25% добыть сразу втрое больше' },
  fish: { name: 'Рыбак', icon: '🎣', desc: 'Рыба клюёт быстрее на 10% и крупнее за ступень', top: 'Шанс 20% поймать сразу две рыбы' },
  build: { name: 'Строитель', icon: '🧱', desc: 'Частные постройки дешевле на 6% за ступень, ремонт быстрее', top: 'Ремонт и снос возвращают вдвое больше материалов' },
  sail: { name: 'Мореход', icon: '⚓', desc: 'Корабль под вашим рулём быстрее на 4% за ступень, плавание вплавь быстрее на 10%', top: 'Корабль под вашим рулём не получает урона от скал и шторма' },
  craft: { name: 'Ремесленник', icon: '🔨', desc: '+3% шанс лучшего качества снаряжения за ступень, ремесло без доплаты хозяину', top: 'Шанс 25% сделать два изделия вместо одного' },
};
export const SPEC_MAX = 5;
export const specTop = (c, k) => specOf(c, k) >= SPEC_MAX; // навык последней ступени
// шансы ремесла: q1 — «хорошее», q2 — «отличное» качество, dbl — два изделия (Ремесленник 5-й ступени)
export function craftChance(c) { const lv = c.level || 1, cr = specOf(c, 'craft'); const q2 = 0.02 + lv * 0.002 + cr * 0.01, q1 = 0.13 + lv * 0.004 + cr * 0.02; return { q1: Math.min(0.6, q1), q2: Math.min(0.3, q2), dbl: specTop(c, 'craft') ? 0.25 : 0 }; }
export const specOf = (c, k) => (c && c.spec && c.spec[k]) || 0;
export function derived(c) {
  const st = c.stats || {};
  const war = specOf(c, 'war'), merc = specOf(c, 'merc'), gath = specOf(c, 'gath');
  return {
    maxHp: 100 + (st.end || 0) * 10 + (c.level - 1) * 6,
    maxSt: 100 + (st.end || 0) * 5,
    melee: 1 + (st.str || 0) * 0.04 + (c.level - 1) * 0.02 + war * 0.05,
    ranged: 1 + (st.agi || 0) * 0.04 + (c.level - 1) * 0.02 + war * 0.05,
    atkSpeed: 1 + (st.agi || 0) * 0.02,
    speed: 1 + (st.agi || 0) * 0.01,
    bag: CFG.bagBase + (st.str || 0) * 4 + gath * 6 + horseBag(c),
    buy: Math.max(0.35, 1 - (st.cha || 0) * 0.015 - merc * 0.03),
    sell: 1 + (st.cha || 0) * 0.015 + merc * 0.03,
  };
}

// ---------- Существа ----------
// faction: beast | prey | barbarian | pirate | punic | robber | glad ; gear — что в руках/на теле (для модели)
export const ENEMIES = {
  deer: { name: 'Олень', faction: 'prey', hp: 40, dmg: 0, speed: 8, xp: 8, loot: { meat: [2, 3], hide: [1, 2] }, model: 'deer' },
  goat: { name: 'Дикая коза', faction: 'prey', hp: 30, dmg: 0, speed: 7, xp: 6, loot: { meat: [1, 2], hide: [1, 1] }, model: 'goat' },
  boar: { name: 'Кабан', faction: 'beast', hp: 70, dmg: 12, speed: 6.5, range: 1.8, cd: 1.3, aggro: 10, xp: 18, loot: { meat: [2, 4], hide: [1, 2] }, model: 'boar' },
  wolf: { name: 'Волк', faction: 'beast', hp: 60, dmg: 10, speed: 7.5, range: 1.8, cd: 1.1, aggro: 18, xp: 16, loot: { hide: [1, 2], meat: [1, 1] }, model: 'wolf', pack: true },
  bear: { name: 'Медведь', faction: 'beast', hp: 220, dmg: 26, speed: 6, range: 2.4, cd: 1.8, aggro: 14, xp: 55, loot: { hide: [3, 5], meat: [4, 6] }, model: 'bear' },
  jackal: { name: 'Шакал', faction: 'beast', hp: 35, dmg: 7, speed: 7.5, range: 1.6, cd: 1, aggro: 14, xp: 9, loot: { hide: [1, 1] }, model: 'jackal', pack: true },
  lion: { name: 'Лев', faction: 'beast', hp: 260, dmg: 30, speed: 8, range: 2.4, cd: 1.6, aggro: 20, xp: 70, loot: { hide: [4, 6] }, model: 'lion' },
  snake: { name: 'Египетская кобра', faction: 'beast', hp: 25, dmg: 14, speed: 3, range: 1.6, cd: 1.5, aggro: 6, xp: 12, loot: {}, model: 'snake', poison: true },
  croc_boss: { name: 'Речной крокодил-людоед', faction: 'beast', hp: 1100, dmg: 38, speed: 5, range: 3.2, cd: 2.1, aggro: 14, xp: 420, armor: 20, boss: true, loot: { croc_hide: [2, 3], meat: [4, 6] }, model: 'croc', denarii: [40, 80] },
  croc: { name: 'Нильский крокодил', faction: 'beast', hp: 300, dmg: 34, speed: 4.5, range: 2.6, cd: 2, aggro: 9, xp: 80, loot: { hide: [5, 7] }, model: 'croc' },
  // люди: gear — оружие, щит, броня (модель)
  barb_warrior: { name: 'Варвар-воин', faction: 'barbarian', hp: 90, dmg: 15, speed: 5.6, range: 2.5, cd: 1.2, aggro: 22, xp: 26, armor: 8, gear: { w: 'axe', body: 'fur' }, loot: { hide: [0, 2], iron: [0, 1] }, human: true, denarii: [3, 12] },
  barb_spear: { name: 'Варвар-копейщик', faction: 'barbarian', hp: 80, dmg: 14, speed: 5.6, range: 3.4, cd: 1.1, aggro: 22, xp: 24, armor: 6, gear: { w: 'hasta', off: 'barbshield', body: 'fur' }, loot: { wood: [0, 2] }, human: true, denarii: [3, 10] },
  barb_archer: { name: 'Варвар-лучник', faction: 'barbarian', hp: 60, dmg: 11, speed: 5.4, range: 30, cd: 2.2, aggro: 32, xp: 24, armor: 2, ranged: true, gear: { w: 'bow', body: 'fur' }, loot: { arrow: [3, 8] }, human: true, denarii: [2, 8] },
  barb_chief: { name: 'Вождь варваров', faction: 'barbarian', hp: 420, dmg: 28, speed: 5.4, range: 2.8, cd: 1.4, aggro: 26, xp: 160, armor: 20, boss: true, gear: { w: 'axe', off: 'barbshield', body: 'chief', head: 'horns' }, loot: { iron: [2, 4], hide: [2, 4], gem: [0, 1] }, human: true, denarii: [60, 120] },
  pirate: { name: 'Киликийский пират', faction: 'pirate', hp: 85, dmg: 15, speed: 5.8, range: 2.4, cd: 1.0, aggro: 24, xp: 28, armor: 6, gear: { w: 'falx', body: 'pirate' }, loot: { wine: [0, 1] }, human: true, denarii: [8, 20] },
  pirate_slinger: { name: 'Пират-пращник', faction: 'pirate', hp: 60, dmg: 10, speed: 5.8, range: 28, cd: 1.8, aggro: 30, xp: 24, armor: 2, ranged: true, gear: { w: 'sling', body: 'pirate' }, loot: {}, human: true, denarii: [5, 15] },
  punic_inf: { name: 'Карфагенский пехотинец', faction: 'punic', hp: 120, dmg: 17, speed: 5.4, range: 3.3, cd: 1.15, aggro: 26, xp: 36, armor: 18, gear: { w: 'hasta', off: 'punicshield', body: 'punic', head: 'punichelm' }, loot: { iron: [0, 1] }, human: true, denarii: [10, 22] },
  punic_slinger: { name: 'Балеарский пращник', faction: 'punic', hp: 70, dmg: 13, speed: 5.8, range: 34, cd: 1.6, aggro: 36, xp: 30, armor: 4, ranged: true, gear: { w: 'sling', body: 'tunic_punic' }, loot: {}, human: true, denarii: [6, 15] },
  punic_vet: { name: 'Иберийский ветеран', faction: 'punic', hp: 160, dmg: 24, speed: 5.8, range: 2.6, cd: 1.0, aggro: 26, xp: 50, armor: 16, gear: { w: 'falcata', off: 'caetra', body: 'iberian' }, loot: { iron: [1, 2] }, human: true, denarii: [15, 30] },
  punic_officer: { name: 'Карфагенский военачальник', faction: 'punic', hp: 700, dmg: 32, speed: 5.4, range: 2.8, cd: 1.2, aggro: 30, xp: 300, armor: 30, boss: true, gear: { w: 'falcata', off: 'punicshield', body: 'punic_gold', head: 'punichelm_gold' }, loot: { silver: [2, 4], gem: [1, 2] }, human: true, denarii: [150, 260] },
  war_elephant: { name: 'Боевой слон Карфагена', faction: 'punic', hp: 1600, dmg: 45, speed: 4.5, range: 4, cd: 2.4, aggro: 30, xp: 400, armor: 25, boss: true, model: 'elephant', loot: { hide: [6, 10] } },
  punic_wagon: { name: 'Обоз снабжения', faction: 'punic', hp: 520, dmg: 0, speed: 3.2, xp: 60, armor: 10, model: 'wagon', loot: { wheat: [4, 8], wine: [1, 3], oil: [1, 2] }, denarii: [30, 70], wagon: true },
  syr_hoplite: { name: 'Сиракузский гоплит', faction: 'punic', hp: 130, dmg: 17, speed: 5.4, range: 3.3, cd: 1.1, aggro: 26, xp: 38, armor: 20, gear: { w: 'hasta', off: 'scutum', body: 'hamata', head: 'galea_bronze' }, loot: { iron: [0, 1] }, human: true, denarii: [10, 22] },
  syr_archer: { name: 'Критский лучник Гиерона', faction: 'punic', hp: 70, dmg: 13, speed: 5.8, range: 34, cd: 1.7, aggro: 36, xp: 30, armor: 4, ranged: true, gear: { w: 'bow', body: 'subarmalis' }, loot: { arrow: [3, 8] }, human: true, denarii: [6, 15] },
  syr_strategos: { name: 'Стратег Гиерона', faction: 'punic', hp: 760, dmg: 32, speed: 5.4, range: 2.8, cd: 1.2, aggro: 30, xp: 320, armor: 30, boss: true, gear: { w: 'spatha', off: 'scutum', body: 'squamata', head: 'galea_centurio' }, loot: { silver: [2, 4], gem: [1, 2] }, human: true, denarii: [150, 260] },
  robber: { name: 'Расхититель гробниц', faction: 'robber', hp: 75, dmg: 13, speed: 5.8, range: 2.2, cd: 0.9, aggro: 20, xp: 26, armor: 4, gear: { w: 'knife', body: 'robber' }, loot: { papyrus: [0, 1], linen: [0, 2] }, human: true, denarii: [5, 15] },
  robber_boss: { name: 'Главарь расхитителей', faction: 'robber', hp: 520, dmg: 26, speed: 5.8, range: 2.6, cd: 1.0, aggro: 24, xp: 220, armor: 15, boss: true, gear: { w: 'khopesh', off: 'parma', body: 'robber_boss', head: 'nemes' }, loot: { gold: [1, 3], artifact: [1, 2] }, human: true, denarii: [80, 160] },
  bandit: { name: 'Разбойник', faction: 'robber', hp: 70, dmg: 12, speed: 5.8, range: 2.3, cd: 1.0, aggro: 22, xp: 22, armor: 4, gear: { w: 'gladius', body: 'robber' }, loot: { iron_ore: [0, 2] }, human: true, denarii: [5, 14] },
  bandit_boss: { name: 'Атаман шахты', faction: 'robber', hp: 480, dmg: 24, speed: 5.6, range: 2.6, cd: 1.1, aggro: 24, xp: 200, armor: 16, boss: true, gear: { w: 'axe', off: 'parma', body: 'hamata', head: 'galea_bronze' }, loot: { silver: [2, 5] }, human: true, denarii: [70, 140] },
  // арена
  glad_murmillo: { name: 'Мирмиллон', faction: 'glad', hp: 150, dmg: 18, speed: 5.2, range: 2.4, cd: 1.0, aggro: 99, xp: 40, armor: 18, gear: { w: 'gladius', off: 'scutum', head: 'murmillo', body: 'glad' }, human: true },
  glad_retiarius: { name: 'Ретиарий', faction: 'glad', hp: 110, dmg: 16, speed: 6.4, range: 3.4, cd: 0.9, aggro: 99, xp: 40, armor: 6, gear: { w: 'trident', body: 'glad' }, human: true },
  glad_thraex: { name: 'Фракиец', faction: 'glad', hp: 130, dmg: 20, speed: 5.8, range: 2.4, cd: 0.85, aggro: 99, xp: 42, armor: 12, gear: { w: 'sica', off: 'parma', head: 'thraex', body: 'glad' }, human: true },
  glad_champion: { name: 'Чемпион Капуи', faction: 'glad', hp: 600, dmg: 30, speed: 6, range: 2.6, cd: 0.9, aggro: 99, xp: 260, armor: 25, boss: true, gear: { w: 'spatha', off: 'scutum', head: 'galea_centurio', body: 'segmentata' }, human: true },
  // гарнизон колонии
  // свои бойцы на арене (раб-гладиатор и прирученный лев) — союзники игрока
  glad_slave: { name: 'Ваш гладиатор', faction: 'rome', hp: 140, dmg: 14, speed: 5.8, range: 2.4, cd: 0.95, aggro: 99, xp: 0, armor: 10, gear: { w: 'gladius', off: 'parma', head: 'thraex', body: 'glad' }, human: true },
  lion_tamed: { name: 'Ваш лев', faction: 'rome', hp: 320, dmg: 30, speed: 8, range: 2.4, cd: 1.5, aggro: 99, xp: 0, model: 'lion' },
  lion_boss: { name: 'Матёрый лев', faction: 'beast', hp: 900, dmg: 40, speed: 8.5, range: 2.6, cd: 1.5, aggro: 22, xp: 300, armor: 12, boss: true, tameable: true, loot: { hide: [6, 9] }, model: 'lion' },
  // отряды игрока (вольные люди на службе) и телохранитель
  merc_inf: { name: 'Наёмник', faction: 'rome', hp: 140, dmg: 16, speed: 6.0, range: 2.5, cd: 1.0, aggro: 22, xp: 0, armor: 14, gear: { w: 'falcata', off: 'parma', head: 'galea_bronze', body: 'subarmalis' }, human: true },
  merc_sling: { name: 'Наёмный пращник', faction: 'rome', hp: 100, dmg: 14, speed: 5.8, range: 34, cd: 1.7, aggro: 40, xp: 0, armor: 6, ranged: true, gear: { w: 'sling', body: 'subarmalis' }, human: true },
  rom_inf: { name: 'Легионер отряда', faction: 'rome', hp: 150, dmg: 17, speed: 5.8, range: 2.5, cd: 1.0, aggro: 22, xp: 0, armor: 20, gear: { w: 'gladius', off: 'scutum', head: 'galea_iron', body: 'hamata' }, human: true },
  rom_cav: { name: 'Всадник отряда', faction: 'rome', hp: 170, dmg: 21, speed: 9.5, range: 4.2, cd: 1.1, aggro: 28, xp: 0, armor: 14, gear: { w: 'lance', off: 'parma', head: 'galea_bronze', body: 'hamata' }, human: true, mounted: true },
  rom_arch: { name: 'Лучник отряда', faction: 'rome', hp: 90, dmg: 14, speed: 5.8, range: 38, cd: 1.5, aggro: 40, xp: 0, armor: 6, ranged: true, gear: { w: 'bow', body: 'subarmalis', head: 'pileus' }, human: true },
  rom_art: { name: 'Скорпион (расчёт)', faction: 'rome', hp: 260, dmg: 46, speed: 1.8, range: 62, cd: 3.4, aggro: 64, xp: 0, armor: 10, ranged: true, model: 'scorpio' },
  rom_guard: { name: 'Телохранитель', faction: 'rome', hp: 220, dmg: 19, speed: 6.4, range: 2.5, cd: 0.9, aggro: 20, xp: 0, armor: 22, gear: { w: 'gladius', off: 'scutum', head: 'galea_centurio', body: 'segmentata' }, human: true },
  legionary: { name: 'Легионер гарнизона', faction: 'rome', hp: 160, dmg: 18, speed: 5.6, range: 2.5, cd: 1.0, aggro: 28, xp: 0, armor: 22, gear: { w: 'gladius', off: 'scutum', head: 'galea_iron', body: 'segmentata' }, human: true },
};
export const HOSTILE = new Set(['beast', 'barbarian', 'pirate', 'punic', 'robber', 'glad']);

// ---------- Корабли ----------
export const SHIPS = {
  barca: { name: 'Рыбацкий баркас', cost: { plank: 25, wood: 15, linen: 4 }, speed: 8.5, turn: 1.2, seats: 4, cargo: 400, hp: 260, len: 12, desc: 'Морской баркас с носовым гарпуном и двумя бортовыми ложементами для тунца. Улов выгружают и несут в гавань.' },
  scapha: { name: 'Лодка (скафа)', cost: { plank: 15, wood: 10 }, speed: 9, turn: 1.4, seats: 2, cargo: 60, hp: 160, len: 5, need: null, desc: 'Быстрая лодка для рыбалки и перевозки двух человек.' },
  corbita: { name: 'Торговая корбита', cost: { plank: 60, wood: 40, linen: 10, iron: 4 }, speed: 8, turn: 0.7, seats: 6, cargo: 600, hp: 450, len: 14, desc: 'Пузатое торговое судно: большой трюм для вывоза ресурсов колоний.' },
  liburna: { name: 'Либурна', cost: { plank: 80, cedar: 20, linen: 12, iron: 12 }, speed: 12, turn: 1.0, seats: 8, cargo: 120, hp: 700, len: 18, ram: 160, rank: 2, desc: 'Лёгкий военный корабль с тараном. Экипаж может стрелять с палубы.' },
  trireme: { name: 'Трирема', cost: { plank: 160, cedar: 50, linen: 25, iron: 30, silver: 4 }, speed: 11.5, turn: 0.75, seats: 12, cargo: 200, hp: 1300, len: 26, ram: 320, rank: 3, desc: 'Флагман флота: огромный таран и много места для воинов.' },
  penteres: { name: 'Пентера (квинквирема)', cost: { plank: 180, cedar: 55, linen: 28, iron: 36, silver: 5 }, speed: 10.5, turn: 0.6, seats: 16, cargo: 260, hp: 2200, len: 32, ram: 480, rank: 3, desc: 'Главный корабль войны с Карфагеном: пять рядов гребцов и «ворон» — мостик для абордажа.' },
  quadrireme: { name: 'Квадрирема', cost: { plank: 200, cedar: 60, linen: 30, iron: 45, silver: 6 }, scraps: 4, speed: 11, turn: 0.7, seats: 14, cargo: 240, hp: 1900, len: 30, ram: 420, rank: 3, catapult: true, desc: 'Тяжёлый корабль с катапультой на носу (F у руля — выстрел). Нужны 4 лоскута чертежа.' },
};
// ящики на борту: лодка 2, торговый 10, военные 4; лучники-рабы на позициях
for (const [k, n] of Object.entries({ barca: 2, scapha: 2, corbita: 10, liburna: 4, trireme: 4, quadrireme: 4, penteres: 4 })) SHIPS[k].crates = n;
for (const [k, n] of Object.entries({ barca: 1, scapha: 1, corbita: 2, liburna: 4, trireme: 6, quadrireme: 6, penteres: 8 })) SHIPS[k].archers = n;
export const shipLimit = c => c.shipLimit ?? (3 + ((c.offices || [c.office]).some(k => ['praefectus', 'senator'].includes(k)) ? 1 : 0) + ((c.offices || [c.office]).includes('navarchus') ? 2 : 0));
export const SHIP_UP = {
  hull: { name: 'Обшивка медью', max: 3, cost: (lv) => ({ plank: 20 * lv, iron: 8 * lv }), desc: '+25% прочности за ступень' },
  sail: { name: 'Новые паруса и вёсла', max: 3, cost: (lv) => ({ linen: 10 * lv, plank: 10 * lv }), desc: '+8% скорости за ступень' },
  ram: { name: 'Окованный таран', max: 2, cost: (lv) => ({ iron: 15 * lv, silver: lv }), desc: '+40% урона тараном за ступень (только военные)' },
};
// ---------- Торговые ящики (делают в Торговой гильдии, продают торговцам) ----------
export const CRATES = {
  crate1: { name: 'Ящик припасов', grade: 1, in: { bread: 4, wheat: 6, calamus: 4, plank: 1 }, price: 80, desc: 'Хлеб, зерно и камыш.' },
  crate2: { name: 'Ящик ремесленных товаров', grade: 2, in: { amphora: 2, oil: 2, leather: 3, plank: 3 }, price: 170, lvl: 4, desc: 'Масло в амфорах, выделанная кожа, доски.' },
  crate3: { name: 'Ящик дорогих товаров', grade: 3, in: { wine: 3, iron: 4, linen: 4, brick: 4, plank: 2 }, price: 340, lvl: 8, desc: 'Вино, железо, полотно и кирпич.' },
  crate4: { name: 'Ящик роскоши', grade: 4, in: { purple: 1, silver: 2, marble: 3, wine: 3, papyrus: 3, plank: 2 }, price: 650, lvl: 12, desc: 'Пурпур, серебро, мрамор, вино и папирус.' },
};
export const ENEMY_SHIPS = {
  pirate_ship: { name: 'Пиратская миопарона', hp: 500, speed: 10, crew: ['pirate', 'pirate', 'pirate_slinger', 'pirate'], len: 15 },
  punic_merchant: { name: 'Пунийское торговое судно', hp: 600, speed: 7, crew: ['punic_inf', 'punic_slinger'], len: 14, model: 'corbita' },
  punic_ship: { name: 'Карфагенская квинквирема', hp: 1100, speed: 9, crew: ['punic_inf', 'punic_inf', 'punic_slinger', 'punic_vet', 'punic_inf'], len: 26 },
};

// ---------- Торговые порты за краем карты ----------
// mult — множитель цены продажи по ресурсам; sells — что продают
export const PORTS = {
  ostia: { name: 'Остия (Рим)', x: 900, z: -2480, r: 120, mult: { purple: 1.6, silver: 1.4, wine: 1.3, oil: 1.3, marble: 1.3, gem: 1.3, gold: 1.4, artifact: 1.8 }, sells: ['iron', 'linen', 'galea_iron', 'hamata', 'scutum', 'spatha', 'segmentata'], desc: 'Столица платит дороже всего за роскошь.' },
  alexandria: { name: 'Александрия', x: 2460, z: 1700, r: 120, mult: { wine: 1.5, oil: 1.4, iron: 1.4, cedar: 1.3, f_tuna: 1.4 }, sells: ['papyrus', 'linen', 'wheat', 'bow', 'rod_pro'], desc: 'Египетские купцы любят вино, масло и железо.' },
  massilia: { name: 'Массилия', x: -2460, z: -1500, r: 120, mult: { purple: 1.3, papyrus: 1.6, wheat: 1.3, bread: 1.4, f_swordfish: 1.4 }, sells: ['iron_ore', 'hide', 'cedar', 'parma', 'galea_bronze'], desc: 'Греческая колония: зерно и папирус в цене.' },
};

// ---------- Должности ----------
export const OFFICES = {
  praefectus: { name: 'Префект', icon: '🏛', minRank: 4, desc: 'Глава своего города (в каждом римском городе — свой префект): предлагает любые законы города, приоритетная стройка, казна. +1 корабль, +1 путь, +3 раба.' },
  legatus: { name: 'Легат', icon: '🦅', minRank: 2, minMil: 3, desc: 'Военная должность (от звания «Центурион»): нанимает легионеров, +2 отряда, союзники рядом бьют на 15% сильнее.' },
  magister: { name: 'Магистр торговой гильдии', icon: '⚖', minRank: 1, minTrade: 1000, desc: 'Нужен торговый оборот 1 000 ден. — это сумма всех ваших продаж и покупок на рынке, в лавках, портах и у торговцев (видна в окне персонажа C → «Статистика»): сбор с торговли, торгует на 10% выгоднее, +2 торговых пути.' },
  senator: { name: 'Сенатор', icon: '📜', minRank: 3, desc: 'Среднее одобрение Рима: голос весит вдвое, предлагает любые законы своего города, +1 корабль, +40 клеток, +3 раба.' },
  aedilis: { name: 'Эдил', icon: '🧱', minRank: 2, desc: 'От звания «Гражданин»: ведает стройкой и землёй — клетки дешевле на 20%, общественные здания на 15%, бесплатный ремонт.' },
  quaestor: { name: 'Квестор', icon: '💰', minRank: 2, desc: 'Казначей: видит казну, выдаёт награды из казны вместе с префектом, +1 торговый путь.' },
  navarchus: { name: 'Наварх', icon: '⚓', minRank: 2, minMil: 3, desc: 'Командует флотом (военное звание от «Центуриона»): +2 корабля, корабли под его рулём быстрее на 10%.' },
  censor: { name: 'Цензор', icon: '⚖', minRank: 5, desc: 'Высшее одобрение Рима: пересматривает списки граждан — одобрение Рима всем, кто рядом на Форуме, растёт на 20% быстрее.' },
  lanista: { name: 'Ланиста (распорядитель игр)', icon: '🏟', minRank: 1, desc: 'Устраивает гладиаторские игры на Арене и получает долю ставок.' },
};

// Городская служба: очки за выполненные поручения, без автоматического назначения.
for(const [k,n] of Object.entries({praefectus:50,legatus:30,magister:20,senator:40,aedilis:20,quaestor:20,navarchus:30,censor:60,lanista:10}))OFFICES[k].minOfficePoints=n;

// ---------- Законы ----------
export const LAWS = {
  trade_tax: { name: 'Налог с торговли', opts: ['0%', '5%', '10%', '25%'], def: 1, desc: 'Доля каждой сделки на рынке, в портах, при продаже и аренде коней уходит в казну колонии. По умолчанию — 5%.' },
  pvp_town: { name: 'Мир в городских стенах', opts: ['нет', 'да'], desc: 'Если принят — внутри городских стен нельзя включить режим сражения между игроками.' },
  free_bread: { name: 'Хлебная раздача', opts: ['нет', 'да'], desc: 'Граждане раз в 10 минут бесплатно получают хлеб из склада.' },
  slavery_ban: { name: 'Запрет рабства', opts: ['нет', 'да'], desc: 'Рабов нельзя покупать; вместо них — вольнонаёмные работники, вдвое дороже в содержании, но работают на 25% лучше.' },
  conscription: { name: 'Воинская повинность', opts: ['нет', 'да'], desc: 'Каждый гражданин при защите от набегов получает +20% урона, но платит 2 денария в минуту в казну.' },
  open_port: { name: 'Открытый порт', opts: ['нет', 'да'], desc: 'Купцы платят на 10% больше, но угроза Карфагена растёт вдвое быстрее.' },
  night_watch: { name: 'Ночная стража', opts: ['нет', 'да'], desc: 'Башни бьют дальше, гарнизон крепче; казна платит 3 денария в минуту.' },
};

// ведомства: какая должность может предложить закон (префект и сенатор — любой)
export const LAW_AREA = { trade_tax: ['magister', 'quaestor'], pvp_town: ['legatus', 'aedilis'], free_bread: ['aedilis', 'quaestor'], slavery_ban: ['censor', 'lanista'], conscription: ['legatus'], open_port: ['navarchus', 'magister'], night_watch: ['legatus', 'aedilis'] };

// ---------- Острова ----------
// kind: main | colony | egypt | punic ; res — особый ресурс колонии
export const ISLANDS = [
  // Сицилия — по настоящим очертаниям (контур в world.js), масштаб ~1:100
  { id: 'main', name: 'Сицилия', kind: 'main', x: 40, z: 130, r: 1520, biome: 'med', poly: true },
  { id: 'italia', name: 'Бруттий (Италия)', kind: 'mainland', x: 1890, z: -640, r: 360, biome: 'forest', desc: 'Берег Италии за проливом: земли союзников Рима.' },
  // Липарские (Эолийские) острова
  { id: 'lipara', name: 'Липара', kind: 'colony', x: 820, z: -1000, r: 70, biome: 'med', desc: 'Главный из Эолийских островов: обсидиан и пемза.' },
  { id: 'hiera', name: 'Гиера (Вулкан)', kind: 'colony', x: 905, z: -830, r: 55, biome: 'rock', volc: 34, desc: 'Дымящийся остров — кузница Гефеста. Сера и квасцы.' },
  { id: 'strongyle', name: 'Стронгила (Стромболи)', kind: 'colony', x: 1065, z: -1320, r: 52, biome: 'rock', volc: 48, desc: 'Вечно курящийся вулкан посреди моря.' },
  { id: 'silva', name: 'Дидима (Салина)', kind: 'colony', x: 690, z: -1120, r: 58, biome: 'forest', res: 'cedar', res2: 'silver_ore', desc: 'Зелёный двуглавый остров: леса и старая серебряная шахта.' },
  { id: 'ericusa', name: 'Эрикуса (Аликуди)', kind: 'colony', x: 480, z: -1085, r: 44, biome: 'rock', desc: 'Крутой остров с вересковыми склонами.' },
  { id: 'euonymos', name: 'Эвоним (Панарея)', kind: 'colony', x: 945, z: -1160, r: 36, biome: 'beach', desc: 'Маленький остров с бухтами и тёплыми источниками.' },
  { id: 'ustica', name: 'Остеодес (Устика)', kind: 'colony', x: -722, z: -1210, r: 62, biome: 'rock', desc: 'Чёрный вулканический остров к северу от Панорма.' },
  { id: 'ferrum', name: 'Остров Феррум', kind: 'colony', x: -240, z: -1150, r: 70, biome: 'rock', res: 'iron_ore', desc: 'Скалистый остров с железными жилами. Здесь лагерь варваров.' },
  // Эгадские острова
  { id: 'marmor', name: 'Эгуса (Фавиньяна)', kind: 'colony', x: -1505, z: -385, r: 56, biome: 'rock', res: 'marble', desc: 'Плоский остров с каменоломнями — белый камень для храмов.' },
  { id: 'phorbantia', name: 'Форбантия (Леванцо)', kind: 'colony', x: -1440, z: -520, r: 36, biome: 'beach', desc: 'Крошечный остров с пещерами древних людей.' },
  { id: 'maritima', name: 'Гиера Эгадская (Мареттимо)', kind: 'colony', x: -1720, z: -420, r: 50, biome: 'forest', desc: 'Самый дальний из Эгадских островов, сосновые склоны.' },
  // юг
  { id: 'punic', name: 'Коссира (Пантеллерия)', kind: 'punic', x: -1800, z: 860, r: 92, biome: 'rock', volc: 30, desc: 'Передовая база Карфагена. Отсюда выходят флоты в набеги.' },
  { id: 'aegyptus', name: 'Мелита (Мальта)', kind: 'colony', x: 380, z: 1890, r: 100, biome: 'desert', res: 'papyrus', res2: 'linen', desc: 'Сухой остров финикийских купцов: древние храмы и подземный гипогей.' },
  { id: 'murex', name: 'Гавлос (Гоцо)', kind: 'colony', x: 190, z: 1705, r: 58, biome: 'beach', res: 'murex', desc: 'Рифы с мурексом — из него делают пурпур, дороже серебра.' },
  { id: 'pirata', name: 'Лопадуса (Лампедуза)', kind: 'pirate', x: -1150, z: 1760, r: 62, biome: 'beach', desc: 'Остров киликийских пиратов: частокол, хижины, награбленное. Разгромите логово — пиратские засады на грузы временно прекратятся, но морские патрули останутся.' },
  { id: 'linosa', name: 'Эфуса (Линоза)', kind: 'colony', x: -880, z: 1540, r: 36, biome: 'rock', volc: 22, desc: 'Пёстрый вулканический островок.' },
  { id: 'pachynus', name: 'Остров у Пахина', kind: 'colony', x: 1110, z: 1140, r: 40, biome: 'beach', desc: 'Песчаный остров у южного мыса Сицилии.' },
  // Ионическое море
  { id: 'achillea', name: 'Остров Ахилла', kind: 'colony', x: 1720, z: 320, r: 72, biome: 'forest', desc: 'Лесистый остров в Ионическом море.' },
  { id: 'cyclopum', name: 'Скалы Циклопов', kind: 'colony', x: 1120, z: -70, r: 26, biome: 'rock', desc: 'Базальтовые утёсы, что, по преданию, швырнул Полифем.' },
];

// ---------- Города Сицилии (264 г. до н. э.) ----------
// lon/lat — настоящие координаты (гавань), R — радиус стен; owner: rome | punic | syr (Сиракузы Гиерона, союзник Карфагена)
// harbor: falcata (серп Мессаны) | catana | syr | std | null (город без моря)
export const CITIES = [
  { id: 'messana', name: 'Мессана', lon: 15.47, lat: 38.075, R: 120, owner: 'rome', harbor: 'falcata', big: true },
  { id: 'tyndaris', name: 'Тиндарида', lon: 15.04, lat: 38.15, R: 72, owner: 'punic', harbor: 'std', small: true },
  { id: 'catana', name: 'Катана', lon: 15.09, lat: 37.50, R: 96, owner: 'syr', harbor: 'catana' },
  { id: 'syracusae', name: 'Сиракузы', lon: 15.29, lat: 37.06, R: 124, owner: 'syr', harbor: 'syr', big: true },
  { id: 'hybla', name: 'Гибла (Рагуза)', lon: 14.73, lat: 36.93, R: 76, owner: 'syr', harbor: null, small: true },
  { id: 'panormus', name: 'Панорм', lon: 13.37, lat: 38.125, R: 112, owner: 'punic', harbor: 'std', big: true },
];
// развалины древних городов (на месте Акраганта и Лилибея): исследователь (с гербарным ножом учёного) по порядку изучает 4 места
// и узнаёт всю историю гибели города; за полную историю — награда
export const ANCIENT_RUINS = [
  { id: 'akragas', name: 'Развалины Акраганта', lon: 13.585, lat: 37.30, reward: { den: 500, xp: 900, dig: 45 }, stages: [
    { title: 'Ворота Гелы', text: 'На треснувшей плите ворот — надпись: «Акрагант, прекраснейший из городов смертных». Город основали выходцы из Гелы и Родоса; при тиране Фероне он богател на зерне и вине.' },
    { title: 'Храм Олимпийского Зевса', text: 'Обломки исполинских атлантов. Храм строили пленные карфагеняне после битвы при Гимере — но так и не достроили: стены поднялись выше, чем гордость, а кровля так и не легла.' },
    { title: 'Колодец у агоры', text: 'В колодец сброшены монеты и амфоры — горожане прятали добро. Глиняная табличка: «Пунийцы у стен восьмой месяц. Хлеба нет. Стратеги бежали ночью».' },
    { title: 'Пепелище на акрополе', text: 'Слой золы и оплавленная бронза. Город сдали без боя: Гимилькон увёз статуи в Карфаген, а дома сжёг. Те, кто остался, ушли в Гелу. Акрагант больше не поднялся — только ветер гуляет между колоннами.' },
  ] },
  { id: 'lilybaeum', name: 'Развалины Лилибея', lon: 12.47, lat: 37.80, reward: { den: 500, xp: 900, dig: 45 }, stages: [
    { title: 'Пристань беглецов', text: 'Каменные кнехты старой пристани. Город основали жители Мотии, бежавшие после того, как Дионисий Сиракузский сжёг их остров. Здесь они поклялись, что их стены не падут.' },
    { title: 'Ров и вал', text: 'Ров шириной в шестьдесят локтей, выбитый в скале. За ним — обломки баллист. Пирр осаждал Лилибей два месяца и отступил: город с моря кормили карфагенские корабли.' },
    { title: 'Святилище Баал-Хаммона', text: 'Тофет с урнами и стелами со знаком Танит. На одной стеле: «Мы отдали богам лучшее — пусть боги отдадут нам море». Жрецы молились о помощи из Карфагена.' },
    { title: 'Обрушенная башня', text: 'Подкоп под башню и следы пожара. Землетрясение расшатало стены, а наёмники-кельты, не получив платы, открыли ворота разбойникам с гор. Уцелевшие бежали в Панорм. С тех пор здесь только чайки и развалины.' },
  ] },
];
// рынок: лавки по классам товаров (горожане платят дороже), скупщик — дешевле
export const STALL_GOODS = [
  ['wheat', 'bread', 'meat', 'calamus'], ['wine', 'oil', 'amphora', 'grapes'], ['f_sardine', 'f_mackerel', 'f_seabass', 'f_dentex', 'f_octopus', 'f_grouper', 'f_moray', 'f_tuna', 'f_swordfish', 'f_trout', 'f_eel', 'f_pike', 'f_sturgeon'],
  ['linen', 'leather', 'hide', 'bandage'], ['iron', 'iron_ore', 'arrow', 'pilum'], ['amphora', 'clay', 'brick', 'plank'], ['olives', 'grapes', 'wheat'], ['purple', 'silver', 'gem', 'gold', 'murex', 'artifact'],
];
export const STALL_GEAR = { 4: ['knife', 'gladius', 'axe', 'hasta', 'parma', 'pileus', 'galea_bronze', 'caligae', 'ocreae'] };
export const STALL_SELL = 1.3, BUYER_SELL = 0.85;
// своя лавка: купить может игрок любого звания; хозяину — 3 ден./мин, +10% к цене своих товаров и 4% с продаж других в его лавке
// ремесло в чужом частном предприятии: доплата хозяину за изделие
export const CRAFT_FEE = { res: 1, gear: 5 };
export const STALL_PRICE = 350, STALL_OWN = 1.1, STALL_FEE = 0.04, stallLimit = (rank) => 2 + Math.floor(rank / 3); // лавок в каждом городе
export const BUYER_HOURS = [12, 20]; // скупщик открыт с 12:00 до 20:00
export const buyerOpen = (gt) => { const h = dayClock(gt); return h >= BUYER_HOURS[0] && h < BUYER_HOURS[1]; };
// ---------- Районы городов: участки покупают у Эдила (клетки 4×4 м) ----------
// price — денарии за клетку, rank — звание, rare — редкие ресурсы за клетку, mul — множитель производства и дохода
export const CELL = 4;
export const DISTRICTS = {
  center: { name: 'Жилой квартал (четверть города)', price: 55, rank: 2, rare: { marble: 0.5 }, mul: 1.4, color: '#8ed59b' },
  harbor: { name: 'При гавани', price: 32, rank: 1, rare: null, mul: 1.25, color: '#7fc6ff' },
  outer: { name: 'Окраинный (до стен)', price: 22, rank: 1, rare: null, mul: 1.15, color: '#b8d890' },
  extra: { name: 'Застенный (за стенами)', price: 9, rank: 0, rare: null, mul: 1.0, color: '#d8b880' },
};
// где разрешено строить: civic — в стенах (центр, окраина), harbor — при гавани, rural — за стенами; lat — только на латифундии
export const CAT_ZONES = { civic: ['center', 'outer'], harbor: ['harbor'], rural: ['extra'], lat: [] };
export const CAT_NAMES = { civic: 'Общественные (в стенах)', harbor: 'Портовые (при гавани)', rural: 'Сельские (за стенами)', lat: 'Только на латифундии' };
// латифундия: квадрат 30×30 клеток в любой свободной зоне, все клетки — владельца
// все возможные события на сервере (для журнала): как начинается, сколько длится, что делать, награда
export const EVENT_INFO = {
  barb: { icon: '🔥', name: 'Набег варваров', when: 'Со 2-го дня, время от времени.', dur: '5 минут', what: 'Из конкретного лагеря варваров (он отмечен на карте) выходят варвары — на одного больше, чем людей на сервере (не больше 6), и идут на ближайшую постройку. Каждый лагерь нападает не чаще раза в 20 минут.', todo: 'Встретьте их у цели или по дороге. Разгромите сам лагерь — налётчики разбегутся, и из него около 40 минут не будет набегов. Через 5 минут уцелевшие сами уходят.', reward: 'Опыт, добыча, военные очки, одобрение Рима; разгромленный лагерь иногда даёт карту сокровищ.' },
  punic: { icon: '⚔', name: 'Флот Карфагена', when: 'Со 2-го дня или при угрозе Карфагена выше 25%. Чем выше угроза — тем чаще.', dur: '7 минут', what: 'Карфагенские корабли с десантом идут к городу или колонии. Маяк замечает их раньше.', todo: 'Перехватите корабли в море (таран, лучники, абордаж) или встретьте десант на берегу. Через 7 минут флот уходит.', reward: 'Опыт, добыча, военные очки; угроза Карфагена снижается.' },
  pirates: { icon: '🏴', name: 'Пираты', when: 'Когда у колонистов есть корабли.', dur: '10 минут', what: 'Киликийские пираты охотятся за кораблями с грузом и таранят их.', todo: 'Держите корабли у причала или потопите пиратов.', reward: 'Добыча, карта сокровищ с потопленного пирата.' },
  rome: { icon: '🦅', name: 'Запрос Рима', when: 'Когда в городе есть форум.', dur: '15 минут', what: 'Рим просит привезти на Форум партию товара.', todo: 'Сдайте товар на Форуме из сумки или со склада.', reward: 'Денарии вам и в казну, расположение Рима, достоинство.' },
  storm: { icon: '⛈', name: 'Шторм', when: 'Случайно.', dur: '≈3 минуты', what: 'Ветер и дождь: корабли идут медленнее, видно хуже.', todo: 'Переждать у берега или плыть осторожно.', reward: '—' },
  tuna: { icon: '🐟', name: 'Ход тунца', when: 'Случайно.', dur: '6 минут', what: 'У островов идут косяки тунца.', todo: 'Тунца видно у поверхности: H на баркасе — носовой гарпун, ЛКМ — выстрел, Пробел — подтягивать линь. Улов несут в гавань.', reward: 'Дорогая рыба и трофеи.' },
  merchant: { icon: '⛵', name: 'Купцы из Александрии', when: 'Когда в городе есть гавань.', dur: '8 минут', what: 'На рынке появляется редкое снаряжение.', todo: 'Загляните на рынок, пока купцы не уплыли.', reward: 'Редкие вещи за денарии.' },
  inspect: { icon: '🏛', name: 'Инспекция Рима', when: 'Когда построено 4+ общественных здания.', dur: 'мгновенно', what: 'Легат из Рима осматривает колонию.', todo: 'Держите 5+ общественных зданий целыми и без руин.', reward: 'Довольный легат — денарии в казну и расположение Рима; недовольный — расположение падает.' },
  caravan: { icon: '🐂', name: 'Обоз снабжения врага', when: 'Во время похода на вражеский город.', dur: 'пока едет', what: 'Пунийский обоз под охраной едет по дороге к вражескому городу.', todo: 'Перехватите его на дороге и разбейте.', reward: 'Добыча; оборона города снижается.' },
  trade_ship: { icon: '⛵', name: 'Пунийское торговое судно', when: 'Во время похода на вражеский город.', dur: 'пока плывёт', what: 'Вражеский купец идёт в гавань города.', todo: 'Потопите его в море.', reward: 'Добыча; оборона города снижается.' },
};
// набеги варваров: лагерь нападает не чаще раза в 20 мин; разгромленный — молчит 40 мин
export const BARB_CAMP_CD = 1200, BARB_CALM = 2400;
// Поле Марса (Бруттий): бои армиями; армия каждого полководца — временная, на время боя
export const WAR = {
  time: 300, ferry: 5, win: 40, lose: 10, maxSquads: 4,
  rent: { inf: { price: 60 }, arch: { price: 50 }, cav: { price: 80 }, art: { price: 110 } }, // отряды на один бой у распорядителя игр
  army: [['inf', 6], ['arch', 4], ['cav', 3]],
  botArmy: [['punic_inf', 6], ['punic_slinger', 4], ['punic_vet', 3]],
  modes: {
    pvb: { name: 'Вы против армии бота', A: { p: 1 }, B: { b: 1 } },
    pvp: { name: '1 на 1 (игроки)', A: { p: 1 }, B: { p: 1 } },
    b2: { name: '2 игрока против 2 ботов', A: { p: 2 }, B: { b: 2 } },
    b3: { name: '3 игрока против 3 ботов', A: { p: 3 }, B: { b: 3 } },
    p2: { name: '2 на 2 (игроки)', A: { p: 2 }, B: { p: 2 } },
    p3: { name: '3 на 3 (игроки)', A: { p: 3 }, B: { p: 3 } },
  },
};
// инсула: 3 комнаты; живут горожане (платят хозяину в минуту) или игроки — снимают комнату на сутки, там же возрождаются
export const INSULA = { rooms: 3, roomPrice: 40, names: ['вдова Корнелия', 'гончар Тит', 'вольноотпущенник Филон', 'ткач Луций', 'писец Гай', 'моряк Дион', 'торговка Юлия', 'плотник Марк'] };
export const MAX_OFFICES = 2; // должностей у одного игрока
export const PERMIT_K = 0.2; // разрешение Эдила — 20% от цены района; клетка оплачивается при разметке по своей цене
export const LATIFUNDIUM = { cells: 30, rank: 3, price: 1500, cost: { plank: 60, stone: 60, brick: 30, marble: 6 }, extraPriv: 8, slavesBonus: 6 };
// колонии: по три места на острове, у каждой 5 своих промыслов (3 обычных, 1 редкий, 1 очень редкий)
export const COLONY_LV_MAX = 5;
export const COLONY_TIERS = [{ name: 'обычный', base: 5, cost: (lv) => ({ plank: 12 * lv, stone: 10 * lv }) }, { name: 'редкий', base: 1.6, cost: (lv) => ({ plank: 20 * lv, stone: 16 * lv, iron: 4 * lv }) }, { name: 'очень редкий', base: 0.5, cost: (lv) => ({ plank: 30 * lv, brick: 20 * lv, iron: 8 * lv, silver: lv }) }];
// [ресурс, модель промысла]: первые три — обычные, четвёртый — редкий, пятый — очень редкий
export const COLONY_RES = {
  lipara: [['stone', 'lapicidina'], ['pumice', 'lapicidina'], ['wood', 'silva_cut'], ['alum', 'sulfur'], ['obsidian', 'metallum']],
  hiera: [['stone', 'lapicidina'], ['clay', 'lapicidina'], ['pumice', 'lapicidina'], ['sulfur', 'sulfur'], ['alum', 'sulfur']],
  strongyle: [['stone', 'lapicidina'], ['pumice', 'lapicidina'], ['grapes', 'farm'], ['sulfur', 'sulfur'], ['obsidian', 'metallum']],
  silva: [['wood', 'silva_cut'], ['cedar', 'silva_cut'], ['grapes', 'farm'], ['silver_ore', 'metallum'], ['saffron', 'farm']],
  ericusa: [['stone', 'lapicidina'], ['wood', 'silva_cut'], ['honey', 'alvearia'], ['hide', 'farm'], ['saffron', 'farm']],
  euonymos: [['f_sardine', 'murex_farm'], ['salt', 'salinae'], ['clay', 'lapicidina'], ['murex', 'murex_farm'], ['coral', 'murex_farm']],
  ustica: [['stone', 'lapicidina'], ['f_mackerel', 'murex_farm'], ['olives', 'farm'], ['coral', 'murex_farm'], ['pearl', 'murex_farm']],
  ferrum: [['stone', 'lapicidina'], ['iron_ore', 'metallum'], ['wood', 'silva_cut'], ['silver_ore', 'metallum'], ['gem', 'metallum']],
  marmor: [['stone', 'lapicidina'], ['salt', 'salinae'], ['f_tuna', 'murex_farm'], ['marble', 'lapicidina'], ['coral', 'murex_farm']],
  phorbantia: [['stone', 'lapicidina'], ['salt', 'salinae'], ['honey', 'alvearia'], ['murex', 'murex_farm'], ['artifact', 'metallum']],
  maritima: [['wood', 'silva_cut'], ['cedar', 'silva_cut'], ['honey', 'alvearia'], ['hide', 'farm'], ['amber', 'metallum']],
  aegyptus: [['wheat', 'farm'], ['linen', 'farm'], ['stone', 'lapicidina'], ['papyrus', 'farm'], ['artifact', 'metallum']],
  murex: [['f_sardine', 'murex_farm'], ['salt', 'salinae'], ['olives', 'farm'], ['murex', 'murex_farm'], ['pearl', 'murex_farm']],
  linosa: [['stone', 'lapicidina'], ['pumice', 'lapicidina'], ['clay', 'lapicidina'], ['sulfur', 'sulfur'], ['obsidian', 'metallum']],
  pachynus: [['salt', 'salinae'], ['f_sardine', 'murex_farm'], ['wheat', 'farm'], ['murex', 'murex_farm'], ['coral', 'murex_farm']],
  achillea: [['wood', 'silva_cut'], ['olives', 'farm'], ['grapes', 'farm'], ['cedar', 'silva_cut'], ['amber', 'metallum']],
  cyclopum: [['stone', 'lapicidina'], ['f_moray', 'murex_farm'], ['salt', 'salinae'], ['coral', 'murex_farm'], ['pearl', 'murex_farm']],
};
// ---------- Отряды (военное дело) ----------
export const SQUADS = {
  inf: { name: 'Пехота (манипул)', icon: '🛡', unit: 'rom_inf', n: 6, price: 400, rank: 2, desc: 'Тяжёлая пехота: держит строй стеной, принимает удар.' },
  cav: { name: 'Конница (турма)', icon: '🐎', unit: 'rom_cav', n: 4, price: 650, rank: 2, desc: 'Быстрые всадники с копьями: догоняют лучников и обозы.' },
  arch: { name: 'Лучники', icon: '🏹', unit: 'rom_arch', n: 5, price: 450, rank: 2, desc: 'Стреляют издалека, держатся за пехотой.' },
  art: { name: 'Артиллерия (скорпионы)', icon: '🎯', unit: 'rom_art', n: 2, price: 900, rank: 3, desc: 'Станковые стрелометы: очень дальний и сильный выстрел, медленные.' },
  merc_l: { name: 'Наёмные пращники', icon: '🪨', unit: 'merc_sling', n: 3, price: 150, rank: 0, merc: true, upkeep: 4, days: 3, hpK: 0.6, dmgK: 0.75, desc: 'Дешёвые наёмники: мало здоровья, слабый удар. Берут плату каждую минуту, уходят через 3 дня.' },
  merc: { name: 'Наёмные гоплиты', icon: '💰', unit: 'merc_inf', n: 3, price: 320, rank: 0, merc: true, upkeep: 7, days: 3, hpK: 1, dmgK: 1, desc: 'Крепкие наёмники-гоплиты. Берут плату каждую минуту, уходят через 3 дня или когда нечем платить.' },
  merc_h: { name: 'Кельтские ветераны', icon: '🪓', unit: 'merc_inf', n: 3, price: 700, rank: 0, merc: true, upkeep: 12, days: 3, hpK: 2.2, dmgK: 1.7, desc: 'Самые сильные наёмники — сильнее обычной пехоты легиона. Дорогие.' },
};
// отряд из своих рабов: дешевле в 3 раза, нужны свободные рабы (по одному на воина); павший воин — потерянный раб
export const SLAVE_SQUAD_K = 0.35;
export const SQUAD_UP = {
  arm: { name: 'Доспехи', max: 5, cost: (lv) => ({ iron: 4 * lv, leather: 2 * lv }), den: (lv) => 120 * lv, desc: '+12% здоровья и брони за ступень' },
  wpn: { name: 'Оружие', max: 5, cost: (lv) => ({ iron: 5 * lv, plank: 2 * lv }), den: (lv) => 140 * lv, desc: '+10% урона за ступень' },
  drill: { name: 'Выучка', max: 5, cost: (lv) => ({ bread: 6 * lv }), den: (lv) => 160 * lv, desc: '+5% скорости и +1 воин в отряде за ступень' },
};
export const GUARD_PRICE = 180;
export const LUDUS_FEE = { train: 25, keep: 2 }; // чужой гладиатор в школе: за обучение сразу и за содержание в минуту — хозяину школы
export const SHIP_SQUADS = 2; // на одном корабле — рабы-лучники и не больше двух отрядов
// дозорные города: легат докупает их в Арсенале (из казны) и улучшает; при набеге выбегают навстречу врагу
export const WATCH = { price: 120, max: 12, upMax: 5, upCost: (lv) => 250 * lv, hpK: 0.15, dmgK: 0.12 };
// военные звания (за победы над Карфагеном, варварами, пиратами — самому, отрядами или на корабле)
export const MIL_RANKS = [
  { name: 'Новобранец', pts: 0, squads: 0 }, { name: 'Легионер', pts: 20, squads: 1 }, { name: 'Декурион', pts: 70, squads: 1 },
  { name: 'Центурион', pts: 175, squads: 2 }, { name: 'Военный трибун', pts: 400, squads: 3 }, { name: 'Префект лагеря', pts: 800, squads: 4 }, { name: 'Легат легиона', pts: 1500, squads: 5 },
];
export const milIdx = (pts) => { let r = 0; MIL_RANKS.forEach((x, i) => { if ((pts || 0) >= x.pts) r = i; }); return r; };
export const MIL_PTS = { barbarian: 1, pirate: 2, punic: 2, robber: 1 };
// ---------- Исследования: на каждом острове 2 животных и 3 растения ----------
export const CRITTER_NAMES = { tortoise: 'Средиземноморская черепаха', hare: 'Сицилийский заяц', fox: 'Лисица', hedgehog: 'Ёж', porcupine: 'Дикобраз', heron: 'Серая цапля', flamingo: 'Фламинго', vulture: 'Белоголовый сип', monk_seal: 'Тюлень-монах', sea_turtle: 'Морская черепаха', lizard: 'Эолийская ящерица', falcon: 'Сокол Элеоноры', wildcat: 'Лесной кот', mouflon: 'Муфлон', sea_eagle: 'Скопа', partridge: 'Каменная куропатка', gecko: 'Геккон', chameleon: 'Хамелеон', dormouse: 'Соня-полчок', pelican: 'Пеликан' };
export const PLANT_NAMES = { dwarf_palm: 'Карликовая пальма', caper: 'Каперс', etna_broom: 'Этнийский ракитник', cork_oak: 'Пробковый дуб', carob: 'Рожковое дерево', myrtle: 'Мирт', oleander: 'Олеандр', saffron: 'Шафран', papyrus_s: 'Сицилийский папирус', sea_lavender: 'Кермек', wild_fig: 'Дикая смоковница', strawberry_tree: 'Земляничное дерево', juniper: 'Можжевельник', rosemary: 'Розмарин', thyme: 'Тимьян', mastic: 'Мастиковое дерево', giant_fennel: 'Гигантский фенхель', sea_daffodil: 'Морской нарцисс', aloe: 'Алоэ', cistus: 'Ладанник' };
const _CR = Object.keys(CRITTER_NAMES), _PL = Object.keys(PLANT_NAMES);
export const RESEARCH = {};
ISLANDS.forEach((isl, i) => { RESEARCH[isl.id] = { fauna: [_CR[(i * 3) % _CR.length], _CR[(i * 3 + 7) % _CR.length]], flora: [_PL[(i * 4) % _PL.length], _PL[(i * 4 + 5) % _PL.length], _PL[(i * 4 + 11) % _PL.length]] }; });
RESEARCH.main = { fauna: ['porcupine', 'wildcat'], flora: ['etna_broom', 'papyrus_s', 'dwarf_palm'] };
export const SCI_TOOLS = { knife: { name: 'Гербарный нож и папка', price: 60, desc: 'Срезать и засушить образец растения (E у растения).' }, net: { name: 'Ловчая сеть учёного', price: 25, desc: 'Поймать живое животное для изучения (E рядом с ним, сеть расходуется).' } };
export const SCI_TITLES = [{ n: 0, name: '—' }, { n: 1, name: 'Любознательный' }, { n: 3, name: 'Натуралист' }, { n: 6, name: 'Учёный муж' }, { n: 10, name: 'Член мусейона' }, { n: 16, name: 'Великий естествоиспытатель' }];
for (const [k, n] of Object.entries(CRITTER_NAMES)) ENEMIES['cr_' + k] = { name: n, faction: 'prey', hp: 25, dmg: 0, speed: ['vulture', 'falcon', 'sea_eagle', 'heron', 'flamingo', 'pelican', 'partridge'].includes(k) ? 6 : ['tortoise', 'sea_turtle', 'chameleon'].includes(k) ? 1.2 : 5.5, xp: 4, loot: {}, critter: k };
export const OWNER_NAME = { rome: 'Рим', punic: 'Карфаген', syr: 'Сиракузы (союз с Карфагеном)' };

// ---------- Инстансы (подземелья) ----------
export const INSTANCES = {
  cave: { name: 'Разбойничья пещера', island: 'main', lvl: 3, rooms: 5, mobs: ['bandit', 'bandit', 'wolf'], boss: 'bandit_boss', loot: { silver: [1, 2], iron: [2, 4] }, gear: ['spatha', 'galea_bronze', 'ocreae', 'parma'], cd: 600, desc: 'Логово разбойников в горах Сицилии.' },
  mine: { name: 'Старая серебряная шахта', island: 'silva', lvl: 7, rooms: 7, mobs: ['bandit', 'bandit', 'bandit', 'bear'], boss: 'bandit_boss', loot: { silver_ore: [6, 12], silver: [2, 4], gem: [0, 2] }, gear: ['hamata', 'galea_iron', 'spatha', 'scutum'], cd: 900, desc: 'Заброшенные выработки — серебро и самоцветы.' },
  tomb: { name: 'Гипогей Мелиты', island: 'aegyptus', lvl: 10, rooms: 8, mobs: ['robber', 'robber', 'snake', 'robber'], boss: 'robber_boss', loot: { gold: [2, 4], artifact: [1, 3], papyrus: [2, 4] }, gear: ['khopesh', 'squamata', 'galea_iron'], cd: 1200, desc: 'Подземное святилище древних мелитян. Расхитители уже внутри: обвалы, ловушки и сокровища.' },
  fortress: { name: 'Цитадель Пунийской крепости', island: 'punic', lvl: 14, rooms: 9, mobs: ['punic_inf', 'punic_inf', 'punic_slinger', 'punic_vet'], boss: 'punic_officer', loot: { silver: [3, 6], gem: [1, 3] }, gear: ['falcata', 'punic_mail', 'segmentata', 'galea_centurio'], cd: 1500, threat: -35, desc: 'Штурм цитадели Карфагена: снижает угрозу набегов.' },
};

// ---------- Сундуки ----------
export const CHESTS = {
  crate: { name: 'Ящик', loot: { wood: [2, 6], linen: [0, 3], bread: [0, 2], bandage: [0, 2] }, den: [2, 15], gear: 0.04 },
  chest: { name: 'Сундук', loot: { iron: [0, 3], leather: [0, 2], arrow: [5, 15], bandage: [1, 3] }, den: [15, 50], gear: 0.18 },
  wreck: { name: 'Сундук с затонувшего корабля', loot: { wine: [0, 2], oil: [0, 2], silver: [0, 1], amphora: [1, 2] }, den: [30, 90], gear: 0.25 },
  sea_wreck: { name: 'Сундук с обломков на скале', loot: { wine: [1, 3], silver: [1, 2], iron: [2, 5], purple: [0, 1], gem: [0, 1] }, den: [60, 180], gear: 0.35, quad: 0.5 },
  ornate: { name: 'Расписной ларец', loot: { gem: [0, 1], silver: [1, 2], purple: [0, 1], artifact: [0, 1] }, den: [60, 160], gear: 0.45 },
};

// ---------- Задания и события ----------
export const QUEST_TYPES = {
  hunt: 'Охота', clear: 'Зачистка', deliver: 'Поставка', fish: 'Улов', chest: 'Поиск', instance: 'Подземелье', colony: 'Колония',
};
// сюжет: 264 г. до н. э. — Рим готовится к войне с Сиракузами и Карфагеном за Сицилию
export const STORY = [
  { id: 's1', title: 'Арена Мессаны', text: 'Мамертинцы Мессаны позвали Рим на помощь. Город наш, арена за стенами готова принимать бойцов. Посетите её и подготовьтесь к походу на Тиндариду.', goal: { build: 'amphitheatrum' }, reward: { den: 150, dig: 25, xp: 200 } },
  { id: 's2', title: 'Тиндарида', text: 'Соседняя Тиндарида — в руках Карфагена. Ослабьте её: шпионаж, разграбление пригородов, удар по караванам и торговым кораблям — и возьмите штурмом.', goal: { capture: 'tyndaris' }, reward: { den: 500, dig: 60, xp: 900 } },
  { id: 's3', title: 'Отстроить Тиндариду', text: 'Город наш, но лежит в руинах. Восстановите форум, курию, храм, склады и гавань Тиндариды.', goal: { rebuild: { city: 'tyndaris', types: ['forum', 'curia', 'templum', 'horreum', 'portus'] } }, reward: { den: 600, dig: 70, xp: 1200 } },
  { id: 's4', title: 'Флот Республики', text: 'Сенат требует флот: постройте 8 пентер и 4 триремы (их можно продать Риму или другим гражданам — в зачёт идут построенные).', goal: { fleet: { penteres: 8, trireme: 4 } }, reward: { den: 1200, dig: 120, xp: 2500 } },
  { id: 's5', title: 'Хлеб для Рима', text: 'Наладьте торговлю с Римом: доставьте в Остию 20 ящиков припасов и 10 ящиков ремесленных товаров (на корабле или торговым путём).', goal: { romeCrates: { crate1: 20, crate2: 10 } }, reward: { den: 1500, dig: 150, xp: 3000 } },
  { id: 's6', title: 'Сиракузы', text: 'Гиерон Сиракузский держит сторону Карфагена. Ослабьте Сиракузы и возьмите город штурмом — тогда вся Сицилия склонится перед Римом.', goal: { capture: 'syracusae' }, reward: { den: 3000, dig: 300, xp: 6000 } },
  { id: 's7', title: 'Вся Сицилия', text: 'Остались Катана, Гибла и Панорм. Возьмите все города острова.', goal: { captureAll: true }, reward: { den: 5000, dig: 500, xp: 10000 } },
];
// поход на город: каждая задача снижает обороноспособность; при нуле — штурм
export const CAMPAIGN = {
  tasks: {
    spy: { name: 'Шпионаж', icon: '👁', n: 3, def: 8, desc: 'Осмотрите город с трёх тайных мест у стен (подойти и E: 6 секунд не двигаться).' },
    plunder: { name: 'Разграбление пригородов', icon: '🔥', n: 3, def: 10, desc: 'Перебейте охрану пригородных усадеб и разграбьте их (E).' },
    caravan: { name: 'Караваны снабжения', icon: '🐂', n: 3, def: 8, desc: 'Уничтожьте обозы, которые идут в город по дорогам (появляются, когда вы рядом с городом).' },
    fleet: { name: 'Торговые пути', icon: '⛵', n: 3, def: 8, desc: 'Потопите торговые корабли, идущие в гавань города.' },
    assault: { name: 'Штурм', icon: '⚔', desc: 'Когда оборона упадёт до нуля — у ворот начните штурм: перебейте гарнизон и его военачальника.' },
  },
  killDef: 1, // каждый павший воин города: оборона −1
  lvl: { tyndaris: 3, catana: 6, hybla: 7, panormus: 12, syracusae: 14 },
};


// запросы Рима: что просит и чем платит
export const ROME_REQUESTS = [
  { res: 'wheat', n: [40, 90], den: 4 }, { res: 'bread', n: [30, 60], den: 9 }, { res: 'oil', n: [8, 20], den: 30 },
  { res: 'wine', n: [8, 20], den: 32 }, { res: 'iron', n: [10, 25], den: 34 }, { res: 'marble', n: [15, 40], den: 18 },
  { res: 'purple', n: [2, 6], den: 140 }, { res: 'silver', n: [3, 8], den: 90 }, { res: 'hide', n: [15, 35], den: 16 },
  { res: 'f_tuna', n: [2, 5], den: 110 }, { res: 'papyrus', n: [10, 25], den: 16 }, { res: 'cedar', n: [15, 30], den: 20 },
];

export const SLAVE_NAMES = ['Даос', 'Сира', 'Андроник', 'Тимей', 'Галла', 'Бренн', 'Арминия', 'Ксанф', 'Пелагия', 'Нубий', 'Феликс', 'Кальва', 'Мирра', 'Оптат', 'Эвтих', 'Зосима', 'Бато', 'Тирон', 'Хрисида', 'Сабина'];
// ---------- Рабы: четыре разряда ----------
// eff — как работают в хозяйствах; arch — урон лучника на корабле; glad — сила гладиатора
export const SLAVE_GRADES = {
  1: { name: 'Неумелый', eff: 0.35, arch: 9, glad: 1.0, price: 80 },
  2: { name: 'Обученный', eff: 0.6, arch: 14, glad: 1.25, price: 200 },
  3: { name: 'Мастер', eff: 0.9, arch: 19, glad: 1.55, price: 450 },
  4: { name: 'Бывший военачальник', eff: 1.0, arch: 25, glad: 2.1, price: 1100 },
};
// очки арены: снаряжение гладиаторов, своё гладиаторское снаряжение, инструмент приручителя
export const ARENA_SHOP = {
  tamer: { name: 'Сеть и аркан приручителя', ap: 25, desc: 'Подойдите к поверженному матёрому льву и нажмите E: шанс 50% приручить (сеть расходуется).' },
};
export const GLAD_UP = { w: { name: 'Оружие гладиатора', max: 5, ap: (lv) => 8 * lv, desc: '+10% урона за ступень' }, a: { name: 'Доспех гладиатора', max: 5, ap: (lv) => 8 * lv, desc: '+12% здоровья за ступень' } };
export const ARENA_GEAR = { atk: { name: 'Моё гладиаторское оружие', max: 5, ap: (lv) => 10 * lv, desc: '+8% урона на арене за ступень' }, def: { name: 'Мой гладиаторский доспех', max: 5, ap: (lv) => 10 * lv, desc: '−5% получаемого урона на арене за ступень' } };
// у каждого раба — сила, ловкость, выносливость (1–10) и один навык
export const SLAVE_TRAITS = {
  glad: { name: 'Гладиатор', icon: '⚔', desc: '+30% урона на арене и в отряде', glad: 1.3 },
  farmer: { name: 'Земледелец', icon: '🌾', desc: 'Работает на 40% лучше на полях, в рощах, виноградниках, пасеке и скотном дворе', eff: 1.4, at: ['farm', 'olivetum', 'vinea', 'linarium', 'alvearia', 'pecus', 'salinae'] },
  artisan: { name: 'Ремесленник', icon: '🔨', desc: 'Работает на 40% лучше в мастерских, гончарне, лесопилке, сукновальне и закусочной', eff: 1.4, at: ['officina', 'figlina', 'lumber', 'fullonica', 'popina'] },
  fisher: { name: 'Рыбак', icon: '🎣', desc: 'Работает на 50% лучше на рыбном промысле и пурпурной ферме', eff: 1.5, at: ['fishery', 'murex_farm'] },
  archer: { name: 'Стрелок', icon: '🏹', desc: '+40% урона лучником на корабле и в отряде лучников', arch: 1.4 },
  trader: { name: 'Торговец', icon: '⚖', desc: 'За прилавком своей лавки приносит вдвое больше', stall: 2 },
  frugal: { name: 'Неприхотливый', icon: '🍞', desc: 'Ест вдвое меньше', food: 0.5 },
  strong: { name: 'Силач', icon: '💪', desc: '+30% здоровья на арене и в отряде', hp: 1.3 },
};
export function rollSlave(grade = 1) { const k = Object.keys(SLAVE_TRAITS), r = () => Math.max(1, Math.min(10, Math.round(2 + grade * 1.3 + Math.random() * 4 - 1))); return { trait: k[Math.floor(Math.random() * k.length)], str: r(), agi: r(), end: r() }; }
export const SLAVE_ORIGINS = ['фракиец', 'галл', 'сириец', 'нубиец', 'грек', 'германец', 'иллириец', 'египтянин'];

export const COLORS = [0x9e2a22, 0x2a5a9e, 0x3a7a32, 0xc9a227, 0x6b2a8a, 0x2a8a8a, 0xb8642a, 0x555555, 0xe0e0d0, 0x7a1a3a];

export const nowS = () => Date.now() / 1000;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
