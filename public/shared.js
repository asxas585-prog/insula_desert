// Общие данные и функции для сервера и клиента.
// Все числа баланса собраны здесь, чтобы их было удобно крутить.

export const CFG = {
  gameLength: 120 * 60,      // сек. Если Ратуша не построена — побеждает тёмная сторона
  dayLength: 7 * 60,         // сутки: 5 минут дня + 2 минуты ночи
  nightFrac: 2 / 7,
  invCap: 20,                // вместимость для ресурсов
  heirCapBonus: 10,
  gathererCapBonus: 10,
  slots: 10,                 // слоты для предметов (первые 6 — на панели)
  hotbar: 6,
  spearSlot: 5,              // копьё всегда в 6-м слоте
  gatherCd: 1.2,
  gathererGatherCd: 0.75,
  secretCd: 60,              // пауза между тайными действиями
  secretHold: 3,             // сколько держать F
  voteTime: 40,
  voteCd: 120,
  cluesForVote: 2,
  raidFirst: 300,
  raidInterval: 200,
  raidDuration: 110,
  breedInterval: 150,
  farmTick: 20,
  farmMax: 20,
  voyageTime: 90,
  minCargo: 5,
  prices: { lemon: 6, silk: 12, hide: 9 },
  shipCost: { plank: 14, log: 7 },
  shipRepair: { plank: 10 },
  respawnTime: 15,
  monsterWinTime: 300,
  monsterWinDestroy: 3,
  hpPerPlank: 25,
  nodeRegen: 75,             // секунд на восстановление одной единицы ресурса
  mountainH: 9,              // выше этой высоты не забраться
  oasisHeal: 3,              // лечение в воде оазиса, ед/с
  gullMax: 14,
  gullRespawn: 35,
  animalRespawn: 150,        // раз в столько секунд в каждом неполном логове появляется зверь
  lootRespawn: 240,          // раз в столько секунд на пустых местах находок может появиться предмет
  bossRegen: 15,             // через сколько секунд без урона слон начинает восстанавливаться
  buffTime: 60,
  oracleCd: 90,              // пауза между предсказаниями
  tameMax: 3,                // сколько зверей может держать приручитель (кроме слона)
  tamedMul: 1.5,             // прирученные звери сильнее
  hidePrice: 14,             // сколько торговец платит за шкуру
  stolenRate: 0.8,           // доля цены, за которую торговец берёт награбленное
  horseSpeed: 1.8,
  horseLife: 240,            // белый конь из храма исчезает через 4 минуты
  horseFeed: 180,            // гнедого коня с фермы нужно кормить лимоном раз в 3 минуты
  farmHorses: 2,             // гнедых коней с ферм — не больше двух, плюс один белый
  whiteHorseSpeed: 2.3,      // белый конь с фермы быстрее гнедого и не просит еды
  freeScroll: 120,           // свиток свободы для заключённого (тайный прилавок)
  stormTime: 80,             // песчаная буря: раз в 3 дня, днём, столько секунд
  stormSlow: 0.8,
  tamedBossHp: 700,          // здоровье слона после приручения
  bossRaidTime: 180,         // если за это время слон ничего не разрушит — вернётся на арену
  caesarKills: 10,           // столько зверей нужно убить Сыну императора, чтобы стать Цезарем
  diversionReward: 100,      // Сыну императора за каждую диверсию
  buildDeadlines: [120, 240, 420], // секунды на 1-ю…3-ю постройку, дальше — без срока
  // гробница фараона: её ищут наборами исследователя; саркофаг вдвоём несут в Лагерь (нужна Ратуша) — победа поселенцев
  kitCost: { log: 4, sand: 3 }, // набор исследователя
  tombScale: 0.7,            // гробница меньше прежней
  digR: 20,                  // раскопки находят гробницу в этом радиусе
  pharaohSonPay: 300,        // откопавший гробницу становится Сыном фараона
  curseMin: 180, curseMax: 300, // проклятие фараона (гробница до Ратуши): знамение раз в 3–5 минут
  statueSpread: 0.42,        // рука статуи: гробница в секторе ±24°
  mummyGift: 300,            // дары в Ратуше, чтобы мумия вернулась в саркофаг
  sarcSpeed: 0.55,           // скорость несущих саркофаг
  sarcGap: 3.2,              // расстояние между двумя носильщиками
  coveSeeR: 25,              // бухту контрабандиста другие видят только вблизи
  coveVoyageMax: 120,        // угнанный корабль идёт к бухте не дольше 2 минут
  diversionDelay: 15,        // через сколько секунд диверсия появляется в чате
  nightSecretMul: 0.5,       // ночью тёмные действия перезаряжаются вдвое быстрее
  nightNameDist: 14,         // ночью ники видны только вблизи
  nightMapDist: 30,          // ночью на миникарте видно игроков только рядом
  wellCost: 20,              // монетка в колодец желаний
  exileTime: 120,            // изгнание на остров тюремщиков
  leaderBoostPay: 5,         // тёмный лидер получает столько за каждый ресурс на стройке
  guardFail: 0.5,            // шанс сорвать тёмное действие, когда памятник восстановлен
  swimSpeed: 0.6,
  oracleVoteTime: 20,
  fallTime: 7,               // сколько секунд метеорит (и меч) летит с неба — видно всем
  oracleCost: 150,           // дары прорицателю
  scrollPrice: 150,          // свиток возрождения
  stealVoteCost: 100,        // подстрекатель крадёт голос в храме прорицателя
  frameItems: 2,             // ложная улика стоит 2 предмета тёмной стороны
  mercPrice: 150,            // наёмник подстрекателя
  mercMax: 3,
  campHp: 440,               // 20 ударов гладиусом
  buildPay: { warehouse: 100, workshop: 100, farm: 200, shipyard: 200 }, // награда участникам стройки (делится по вложенным ресурсам)
  landmarkPay: 200,          // за восстановление храма, маяка или башни
  levelCoins: 25,            // подарок за уровень: деньги, здоровье или обрывок тайны (по трети)
  levelHp: 15,
  scrapsNeed: 6,             // из стольких лоскутов в Лагере складывается карта: на каком расстоянии от какого места копать
  pharaohSlow: 1.25,         // фараон сохранён: тёмные действия на четверть медленнее
  pharaohFail: 0.25,         // и с таким шансом срываются
  voiceNear: 6,              // голосовой чат: до этого расстояния слышно в полную силу
  voiceFar: 32,              // дальше — не слышно
  megaR: 3.5,                // радиус у громкоговорителя в Лагере: голос слышит весь остров
  summonTime: 60,            // призыв лидера: за минуту все должны прийти в Лагерь
  summonCd: 120,
  summonR: 16,               // «пришёл в лагерь» — ближе этого к Лагерю
  trapCost: { log: 3, hide: 1 }, // капкан сыщика
  trapHold: 5,               // сколько секунд держит капкан
  trapDmg: 10,
  trapMax: 3,
  // рабы: погибший встаёт немым рабом; свободу дают 3 задания лидера (или победы на арене)
  slaveRespawn: 8,
  slaveTasksNeed: 3,
  slaveGoals: { fish: 10, log: 20, sand: 20, dark: 4 },
  slaveDishes: 2,            // 2 блюда для лидера = одно задание раба
  // колизей и гладиаторские бои
  gamesGather: 60, gamesChoose: 15, gamesFight: 120, gamesCd: 180, arenaR: 12, gladMin: 3, rudisWins: 2,
  // налоги
  taxTime: 120, taxCd: 300, taxSlave: 180,
  reelectCd: 600,            // перевыборы лидера — не чаще раза в 10 минут
  breadDelay: 25,
  betSizes: [10, 25, 50],
  // голод (наступает медленно)
  hungerTime: 16 * 60,       // за столько секунд сытость падает со 100 до 0
  starveDmg: 0.5,            // урон в секунду, когда голод на нуле
  breadFull: 120,            // хлеб: 2 минуты без голода
  foodCap: 24,
  food: { fish: 50, root: 15, turnip: 25, bread: 100 },
  castTime: 4, fishChance: 0.6, poisonFishChance: 0.25,
  netTick: 120, netMax: 5,
  turnipTick: 45, turnipMax: 6,
  rootPerOasis: 4, rootRespawn: 70,
  dishCd: 180, dishMax: 2,
  // шпион Карфагена
  spearVoteBan: 120, accidentTime: 90, carryTime: 60,
  // законы
  redClueTime: 60,
  // нейтрализующее копьё и маскировка
  stunTime: 30, stunWarlock: 10,
  disguiseTime: 20, disguisePrice: 100,
  nightBeastsMax: 2,
};

export const FOOD = { fish: 'Рыба', root: 'Коренья', turnip: 'Брюква', bread: 'Хлеб' };
export const RES = {
  log: 'Брёвна', sand: 'Песок', plank: 'Доски', brick: 'Кирпичи',
  lemon: 'Лимоны', silk: 'Шёлк', hide: 'Шкуры', marble: 'Мрамор', denarii: 'Денарии',
};
export const CARRY_RES = ['log', 'sand', 'plank', 'brick', 'lemon', 'silk', 'hide', 'marble'];

export const ITEMS = {
  gladius:    { name: 'Гладиус', kind: 'weapon', dmg: 22, range: 2.9, cd: 0.55, color: 0xc9d0d6, desc: 'Короткий римский меч, быстрые удары. Только у торговца.' },
  spear:      { name: 'Копьё', kind: 'weapon', thrown: true, dmg: 28, range: 26, speed: 30, cd: 0.9, color: 0x9a7a4a, desc: 'Бросок (ЛКМ), потом подберите. Ловит чаек. Всегда в 6-м слоте.' },
  axe:        { name: 'Топор', kind: 'weapon', dmg: 20, range: 2.6, cd: 0.85, color: 0x777777, desc: 'Медленный рубящий удар сверху.' },
  bandage:    { name: 'Повязка', kind: 'heal', heal: 30, color: 0xf2efe6, desc: '+30 здоровья.' },
  salve:      { name: 'Целебная мазь', kind: 'heal', heal: 70, color: 0x5fc46a, desc: '+70 здоровья.' },
  coins:      { name: 'Мешочек денариев', kind: 'coins', value: 40, color: 0xf2c84b, desc: '+40 денариев в кошелёк.' },
  hide:       { name: 'Шкура', kind: 'res', res: 'hide', color: 0x9b6b3d, desc: 'Товар для Рима.' },
  gull:       { name: 'Чайка', kind: 'gull', heal: 15, color: 0xf4f4f4, desc: 'Сыщик бросает её в игрока — из злодея выпадет улика. Остальные могут съесть (+15).' },
  map:        { name: 'Карта сокровищ', kind: 'quest', dark: true, color: 0xd9c08f, desc: 'Старая карта с непонятными знаками.' },
  tools:      { name: 'Инструменты диверсанта', kind: 'quest', dark: true, color: 0x4a4a52, desc: 'Ломик, фитиль и отмычки.' },
  mandrake:   { name: 'Корень мандрагоры', kind: 'ingredient', dark: true, color: 0x8b5a2b, desc: 'Колдовской ингредиент.' },
  venom:      { name: 'Змеиный яд', kind: 'ingredient', dark: true, color: 0x7cff4a, desc: 'Колдовской ингредиент.' },
  bones:      { name: 'Древние кости', kind: 'ingredient', dark: true, color: 0xe8e2cc, desc: 'Колдовской ингредиент.' },
  darkpotion: { name: 'Тёмное зелье', kind: 'quest', dark: true, color: 0x7a2bd1, desc: 'Для тёмного ритуала.' },
  kit:        { name: 'Набор исследователя', kind: 'kit', color: 0xb08850, desc: 'Используйте (цифра) в любом месте: если гробница фараона ближе 20 шагов — она откроется всем. Иначе набор пропадёт, а место отметится на карте (Исследование).' },
  treasure:   { name: 'Сокровище', kind: 'treasure', color: 0xffd34d, desc: 'Тяжёлый сундук, замедляет.' },
  // товары бродячего торговца: светящееся оружие и зелья
  sungladius: { name: 'Сияющий гладиус', kind: 'weapon', glow: true, base: 'gladius', dmg: 30, range: 3.1, cd: 0.5, color: 0xffe066, desc: 'Светится солнцем, сильнее обычного.' },
  sunspear:   { name: 'Сияющее копьё', kind: 'weapon', glow: true, base: 'spear', thrown: true, dmg: 36, range: 32, speed: 36, cd: 0.8, color: 0x7fe3ff, desc: 'Летит дальше и бьёт сильнее.' },
  sunaxe:     { name: 'Сияющий топор', kind: 'weapon', glow: true, base: 'axe', dmg: 27, range: 2.8, cd: 0.8, color: 0xff8a3d, desc: 'Пылающий топор.' },
  marsblade:  { name: 'Клинок Марса', kind: 'weapon', glow: true, base: 'gladius', dmg: 50, range: 3.3, cd: 0.45, color: 0xff2a2a, desc: 'Лучшее оружие острова, дар бога войны.' },
  caesarrobe: { name: 'Облачение Цезаря', kind: 'robe', color: 0x7b1fa2, desc: 'Пурпур и лавры. Сын императора, убивший 10 зверей, побеждает.' },
  scroll:     { name: 'Свиток возрождения', kind: 'scroll', color: 0xf5e6a8, desc: 'Возвращает погибшего игрока (выберите в инвентаре).' },
  freescroll: { name: 'Свиток свободы', kind: 'scroll', color: 0x9fd8ff, desc: 'Тайный прилавок: даёт заключённому право уплыть с острова тюремщиков.' },
  shovel:     { name: 'Лопата', kind: 'tool', color: 0x8a6a3a, desc: 'Контрабандист: из Карты сокровищ и 60 денариев в тайной мастерской. Место клада появится на карте (M).' },
  pickaxe:    { name: 'Кирка', kind: 'tool', color: 0x8a8f96, desc: 'Для мрамора. Одна на игрока, не выбрасывается; чайка сыщика её выбивает.' },
  trap:       { name: 'Капкан', kind: 'trap', color: 0x777777, desc: 'Сыщик ставит под ноги. Попавший застрянет на 5 с, а вы узнаете его имя.' },
  stolen:     { name: 'Награбленное', kind: 'stolen', color: 0x8a6d3b, desc: 'Продать торговцу может только злодей. На Складе вернётся в запасы.' },
  biggull:    { name: 'Улучшенная чайка', kind: 'gull', big: true, heal: 25, color: 0xffd700, desc: 'Приручитель: тьма — приручить слона, свет — звери охраняют базу.' },
  bigheal:    { name: 'Большое зелье лечения', kind: 'heal', heal: 150, color: 0xff4d6d, desc: 'Полное лечение.' },
  strpotion:  { name: 'Зелье силы', kind: 'buff', buff: 'str', color: 0xff9f1c, desc: 'Урон ×1.5 на минуту.' },
  spdpotion:  { name: 'Зелье скорости', kind: 'buff', buff: 'spd', color: 0x2ec4b6, desc: 'Скорость ×1.4 на минуту.' },
  lockpick:   { name: 'Отмычка диверсанта', kind: 'token', color: 0x333344, desc: 'Улика: выпала из диверсанта.' },
  amulet:     { name: 'Колдовской амулет', kind: 'token', color: 0x9b30ff, desc: 'Улика: выпал из колдуна.' },
  quill:      { name: 'Перо подстрекателя', kind: 'token', color: 0x3b2f6b, desc: 'Улика: выпало из подстрекателя.' },
  whistle:    { name: 'Свисток приручителя', kind: 'token', color: 0x6fae4a, desc: 'Улика: выпал из тёмного приручителя.' },
  compass:    { name: 'Компас контрабандиста', kind: 'token', color: 0xc08a2a, desc: 'Улика: выпал из контрабандиста.' },
  coin:       { name: 'Печать Карфагена', kind: 'token', color: 0x6b2a8a, desc: 'Улика: выпала из шпиона Карфагена.' },
  // еда и рыбалка
  root:       { name: 'Коренья', kind: 'food', food: 'root', color: 0x9a6a3a, desc: 'Растут у оазисов. Утоляют голод на 15%.' },
  rod:        { name: 'Удочка', kind: 'rod', color: 0xa0784a, desc: 'У воды выберите её (клавиша предмета) — заброс. Рыба утоляет голод на 50%.' },
  fishnet:    { name: 'Рыболовная сеть', kind: 'net', color: 0xd8c8a0, desc: 'Ставится в воду у берега: раз в 2 минуты ловит рыбу (до 5). Забрать — E у сети.' },
  pfish:      { name: 'Ядовитая рыба', kind: 'quest', color: 0x5ad16b, desc: 'Ловится только диверсантом и шпионом (25% заброса). Для отравления амбара и копья.' },
  antidote:   { name: 'Противоядие', kind: 'antidote', color: 0x8fe3a0, desc: 'Снимает яд и оглушение (себе или оглушённому рядом). Делает священнослужитель из кореньев.' },
  firefly:    { name: 'Светлячок', kind: 'res2', color: 0xd9ff5a, desc: 'Выпадает из светящихся ночных зверей. Нужен для покупки светящегося оружия.' },
  pspear:     { name: 'Отравленное копьё', kind: 'weapon', thrown: true, dmg: 20, range: 26, speed: 30, cd: 0.9, color: 0x5ad16b, base: 'spear', desc: 'Шпион: попадание в лидера навсегда отнимает треть его здоровья и на 2 минуты лишает права голосований.' },
  nspear:     { name: 'Нейтрализующее копьё', kind: 'weapon', thrown: true, dmg: 4, range: 24, speed: 30, cd: 0.9, color: 0xb070ff, base: 'spear', desc: 'Тёмные роли: сбивает с ног на 30 с (у колдуна — 40 с).' },
  sack:       { name: 'Мешок для усмирения', kind: 'sack', color: 0x5a4a3a, desc: 'Шпион: скрутите лидера (рядом с ним) и унесите к Скрытой бухте.' },
  rudis:      { name: 'Рудис', kind: 'weapon', noDrop: true, dmg: 9, range: 2.6, cd: 0.5, color: 0xc8a070, desc: 'Деревянный меч свободы за 2 победы на арене. Пока он у вас — нельзя посадить в тюрьму или сделать рабом. Передать нельзя, на острове он один.' },
  sica:       { name: 'Сика', kind: 'weapon', dmg: 14, range: 2.9, cd: 0.55, color: 0xc0c6cc, desc: 'Кривой меч фракийца на арене.' },
  trident:    { name: 'Трезубец', kind: 'weapon', dmg: 13, range: 3.6, cd: 0.75, color: 0xc0c6cc, desc: 'Оружие ретиария на арене.' },
};
export const ROLE_TOKEN = { impostor: 'lockpick', warlock: 'amulet', smuggler: 'compass', tamer: 'whistle', instigator: 'quill', spy: 'coin' };
// гладиаторы: ретиарий с трезубцем (длиннее удар) и секутор с гладиусом (быстрее, крепче)
// три класса, как на настоящей арене: у каждого своё оружие и умение (клавиша F в бою)
export const GLAD = {
  trident: { name: 'Ретиарий', weapon: 'трезубец и сеть', dmg: 13, range: 3.6, cd: 0.75, armor: 1, skill: 'Сеть', skillDesc: 'бросок сети вперёд на 8 м — соперник опутан на 2,5 с (не двигается и не бьёт)', skillCd: 12 },
  gladius: { name: 'Секутор', weapon: 'гладиус и большой щит', dmg: 15, range: 2.7, cd: 0.5, armor: 0.8, skill: 'Стена щита', skillDesc: '3 с почти не получает урона (−80%)', skillCd: 10 },
  sica:    { name: 'Фракиец', weapon: 'кривая сика и малый щит', dmg: 14, range: 2.9, cd: 0.55, armor: 0.9, skill: 'Рывок', skillDesc: 'прыжок на 5 м вперёд с ударом ×1,8', skillCd: 8 },
};
// законы поселения: голосуют в Лагере по предложению лидера
export const LAWS = {
  nightbeast: { name: 'Закон о ночных зверях', desc: 'Запрещено убивать светящихся ночных зверей.', jail: true },
  slavery:    { name: 'Запрет работорговли', desc: 'Новые погибшие не становятся рабами, а уходят призраками. Нынешние рабы остаются рабами.', jail: false },
  peace:      { name: 'Мир в Лагере', desc: 'Запрещено нападать на поселенцев у Лагеря.', jail: true },
  masks:      { name: 'Запрет масок', desc: 'Запрещено надевать маску.', jail: true },
};
// задания рабам (лидер выбирает в Лагере одно для всех)
export const SLAVE_TASKS = {
  fish: 'Наловить рыбы', log: 'Собрать брёвна', sand: 'Собрать песок', dark: 'Сжечь в костре Лагеря предметы тёмной стороны',
};
// предметы тёмной стороны (ложная улика подстрекателя стоит 2 таких)
export const isDarkItem = (type) => !!(ITEMS[type] && ITEMS[type].dark);

// Бродячий торговец: цены в денариях из личного кошелька
// need — сколько построек должно стоять в поселении, чтобы товар появился
export const MERCHANT = [
  { item: 'salve', price: 35, need: 0 }, { item: 'caesarrobe', price: 1500, need: 0, heir: true },
  { item: 'gladius', price: 60, need: 1 }, { item: 'bigheal', price: 60, need: 1 }, { item: 'pickaxe', price: 80, need: 2 }, { item: 'strpotion', price: 80, need: 2 }, { item: 'sungladius', price: 220, need: 2 },
  { item: 'spdpotion', price: 150, need: 3 }, { item: 'sunspear', price: 200, need: 3 }, { item: 'sunaxe', price: 260, need: 4 },
  // тайный прилавок: всё для заданий тёмной стороны (видят и покупают только злодеи и тёмный приручитель)
  { item: 'tools', price: 150, need: 0, bad: true }, { item: 'map', price: 150, need: 0, bad: true },
  { item: 'mandrake', price: 35, need: 0, bad: true }, { item: 'venom', price: 35, need: 0, bad: true },
  { item: 'bones', price: 30, need: 0, bad: true }, { item: 'gull', price: 50, need: 0, bad: true },
  { item: 'freescroll', price: CFG.freeScroll, need: 0, bad: true, target: true },
  { item: 'rod', price: 40, need: 0 }, { item: 'fishnet', price: 120, need: 0 },
];
// цены на краденое (за единицу, до скидки stolenRate)
export const GOODS_PRICE = { log: 1, sand: 1, plank: 3, brick: 3, lemon: 6, silk: 12, hide: 9, marble: 4 };
// Тайная мастерская: крафт только для тёмных ролей
export const LAIR_RECIPES = [
  { item: 'biggull', cost: { hide: 6, sand: 3 }, items: ['gull'] },
  { item: 'shovel', cost: { denarii: 60 }, items: ['map'], role: 'smuggler' },
  { item: 'tools', cost: { log: 3, sand: 2, hide: 1 } },
  { item: 'map', cost: { hide: 2, sand: 1 } },
  { item: 'mandrake', cost: { log: 1, hide: 1 } },
  { item: 'venom', cost: { sand: 2, hide: 1 } },
  { item: 'bones', cost: { hide: 2 } },
  { item: 'spear', cost: { log: 3 } },
  { item: 'bandage', cost: { hide: 1, sand: 1 } },
  { item: 'nspear', cost: { denarii: 100 }, items: ['darkpotion', 'spear'], food: { root: 1 }, dark: true },
  { item: 'pspear', cost: {}, items: ['spear', 'pfish', 'pfish'], role: 'spy' },
  { item: 'sack', cost: { denarii: 150 }, darkAny: 3, role: 'spy' },
];
export const FIST = { dmg: 8, range: 2.2, cd: 0.45 };

export const SPECS = {
  farmer:    { name: 'Фермер', desc: 'Урожай с ферм ×1.5.' },
  craftsman: { name: 'Ремесленник', desc: 'В мастерской 1 сырьё → 1 изделие. Мрамор добывает без кирки.' },
  priest:    { name: 'Священнослужитель', desc: 'Вдвое чаще удача в случайных событиях. Делает противоядие из кореньев (от яда и оглушения).' },
  gatherer:  { name: 'Собиратель', desc: 'Быстрее добывает брёвна и песок, +10 к вместимости.' },
  prisoner:  { name: 'Заключённый', desc: 'Тюремная роба: открытая роль потеряна до конца изгнания.', hidden: true },
};

export const ROLES = {
  explorer:  { name: 'Исследователь', side: 'good', desc: 'Ищите гробницу фараона: наборы исследователя вы делаете с начала игры (журнал или инвентарь), за каждый уровень — лишний лоскут карты. Стройте, торгуйте, ищите предателей.' },
  detective: { name: 'Сыщик', side: 'good', desc: 'Только вы видите улики. Соберите 2+ и созовите собрание в Лагере.' },
  heir:      { name: 'Сын императора', side: 'good', desc: 'Двойной опыт и добыча. Если вас убьёт игрок — победа тёмных. Убейте 10 зверей и купите Облачение Цезаря — победа.' },
  impostor:  { name: 'Диверсант', side: 'bad', desc: 'С Инструментами диверсанта: сломайте постройку, украдите со Склада, сорвите торговлю на верфи.' },
  instigator:{ name: 'Подстрекатель', side: 'bad', desc: 'Подбросьте ложную улику, украдите чужой голос и разрушьте Лагерь своей бандой наёмников. Собрание созываете где угодно.' },
  warlock:   { name: 'Колдун', side: 'bad', desc: 'Сварите зелье в Святилище, проведите ритуал в Развалинах и призовите чудовище у Алтаря.' },
  smuggler:  { name: 'Контрабандист', side: 'bad', desc: 'Сделайте лопату из Карты сокровищ и выкопайте клад, постройте свою Скрытую бухту и спрячьте его там, угоните корабль с верфи — и уплывите с сокровищем.' },
  spy:       { name: 'Шпион Карфагена', side: 'bad', desc: 'Цель — лидер поселения: отравите его блюдо, ударьте отравленным копьём и подстройте несчастный случай у Скрытой бухты.' },
  tamer:     { name: 'Приручитель', side: 'neutral', desc: 'Выберите путь в журнале (J). Чайкой приручайте зверей (T — команды). Свет: звери охраняют вас или базу и лают на диверсантов. Тьма: натравите зверя на игрока, стаю на поселение и слона.' },
};

export const SECRET = {
  sabotage: { role: 'impostor', name: 'Диверсия', clue: 'Следы диверсии', hint: 'У любой постройки (кроме Лагеря) с Инструментами.' },
  steal:    { role: 'impostor', name: 'Кража припасов', clue: 'Взломанный ящик', hint: 'У Склада, где 3+ товаров.' },
  poisonBarn: { role: 'impostor', name: 'Отравить амбар', clue: 'Рыбья чешуя с ядовитой слизью', hint: 'У Амбара с 2 ядовитыми рыбами (ловятся удочкой, 25% заброса). Треть еды пропадёт, остальная на минуту станет ядовитой.' },
  poison:   { role: 'spy', name: 'Отравить блюдо лидера', clue: 'Пустой флакон из-под яда', hint: 'В Лагере: блюдо + 1 змеиный яд — отравленное блюдо с вашим именем; или 3 яда — отравить все блюда. Лидер съест — треть здоровья навсегда.' },
  pspear:   { role: 'spy', name: 'Отравленное копьё', clue: 'Ядовитый наконечник', hint: 'Копьё + 2 ядовитые рыбы (тайная мастерская). Попадите в лидера.' },
  accident: { role: 'spy', name: 'Несчастный случай', clue: 'Обрывки мешковины у бухты', hint: 'Мешок усмирения (3 тёмных предмета + 150): скрутите лидера (E рядом), донесите до Скрытой бухты и нажмите F. Если за 1,5 мин его не спасут — победа.' },
  wreck:    { role: 'impostor', name: 'Срыв торговли', clue: 'Перерезанный канат', hint: 'У верфи с кораблём у причала.' },
  brew:     { role: 'warlock', name: 'Варка зелья', clue: 'Осадок тёмного зелья', hint: '2 ингредиента, Старое святилище.' },
  ritual:   { role: 'warlock', name: 'Тёмный ритуал', clue: 'Ритуальный круг', hint: 'Тёмное зелье, Развалины храма.' },
  summon:   { role: 'warlock', name: 'Призыв чудовища', clue: 'Кровавая печать', hint: '3 мандрагоры + 3 яда, Древний алтарь. Чудовище должно разрушить 3 постройки или прожить 5 минут.' },
  dig:      { role: 'smuggler', name: 'Клад из карты', clue: 'Свежая яма', hint: 'Карта сокровищ + 60 денариев → лопата (тайная мастерская). Место клада — на карте (M), копайте там (F).' },
  hidecove: { role: 'smuggler', name: 'Тайник в бухте', clue: 'Следы сундука на песке', hint: 'Постройте Скрытую бухту (B, только из своих ресурсов, на берегу) и спрячьте в ней сокровище (F). Бухту видят вблизи, издалека — только сыщик.' },
  hijack:   { role: 'smuggler', name: 'Угон корабля', clue: 'Перевязанный штурвал', hint: 'У Верфи (F): следующий рейс корабль уйдёт не в Рим, а к вашей бухте.' },
  escape:   { role: 'smuggler', name: 'Побег с сокровищем', clue: 'Следы лодки', hint: 'Когда угнанный корабль встанет у вашей бухты — F в бухте, и вы уплываете с кладом.' },
  beast:    { role: 'tamer', name: 'Натравить зверя', clue: 'Клочья шерсти и следы когтей', hint: 'Приручите зверя и натравите на игрока (T).' },
  pack:     { role: 'tamer', name: 'Стая на поселение', clue: 'Следы стаи у разрушенной постройки', hint: '3 зверя (T → «Набег») должны разрушить самое дорогое здание.' },
  bossTame: { role: 'tamer', name: 'Слон против поселения', clue: 'Золотые перья и следы слона', hint: 'Улучшенной чайкой приручите слона и натравите на постройки (3 минуты).' },
  frame:    { role: 'instigator', name: 'Ложная улика', clue: 'Подозрительная находка', hint: 'F где угодно, нужны 2 предмета тёмной стороны. Улика укажет на честного игрока. Один раз.' },
  forge:    { role: 'instigator', name: 'Украденный голос', clue: 'Лишний черепок для голосования', hint: 'В Храме прорицателя (100 денариев) украдите голос игрока и отдайте его на собрании (V).' },
  raze:     { role: 'instigator', name: 'Банда наёмников', clue: 'Следы наёмников', hint: 'Захватите деревню (E), наймите до 3 наёмников и, когда кто-то сидит на острове тюремщиков, разрушьте ими Лагерь.' },
  douse:    { role: 'any', name: 'Потушить маяк', clue: 'Залитый водой очаг маяка', hint: 'У горящего маяка.' },
  rob:      { role: 'any', name: 'Ограбление', clue: 'Рассыпанные товары', hint: 'Склад или ферма с товарами.' },
};
export const ROLE_TASKS = {
  impostor: ['sabotage', 'poisonBarn', 'wreck'],
  spy: ['poison', 'pspear', 'accident'],
  instigator: ['frame', 'forge', 'raze'],
  warlock: ['brew', 'ritual', 'summon'],
  smuggler: ['dig', 'hidecove', 'escape'],
  tamer: ['beast', 'pack', 'bossTame'],
};

export const BUILDINGS = {
  camp:      { name: 'Лагерь поселенцев', cost: {}, hp: CFG.campHp, r: 5, max: 1, req: [], fixed: true,
    desc: 'Голосования, выборы лидера и колодец желаний. Разрушить его могут только наёмники.' },
  warehouse: { name: 'Склад', cost: { log: 15, sand: 10 }, hp: 500, r: 5.5, shore: true, max: 1, req: [],
    desc: 'Хранит ресурсы и казну. Только на берегу.' },
  workshop:  { name: 'Мастерская', cost: { log: 20, sand: 10, hide: 4 }, hp: 350, r: 4.5, max: 2, req: ['warehouse'],
    desc: 'Брёвна → доски, песок → кирпичи.' },
  farm:      { name: 'Ферма', cost: { log: 7, plank: 7, brick: 3, hide: 4 }, hp: 250, r: 6, max: 3, req: ['workshop'], oasis: true,
    desc: 'Только у оазиса. Лимоны и шёлк; каждая ферма приводит коня.' },
  shipyard:  { name: 'Верфь', cost: { plank: 11, brick: 5, marble: 3, hide: 6 }, hp: 400, r: 6.5, shore: true, max: 1, req: ['workshop'],
    desc: 'Корабль для торговли с Римом. Только на берегу.' },
  townhall:  { name: 'Ратуша', cost: { plank: 30, brick: 30, log: 10, marble: 7, hide: 10 }, hp: 1200, r: 8, max: 1,
    req: ['warehouse', 'workshop', 'farm', 'shipyard'], voyages: 2,
    desc: 'Нужно 2 рейса. Раскрывает одного злодея. Здесь все делают наборы исследователя и задабривают мумию. Без Ратуши Лагерь не примет саркофаг фараона.' },
  barn:      { name: 'Амбар', cost: { log: 10, plank: 6, brick: 4, hide: 4 }, hp: 300, r: 4.5, max: 1, req: ['farm'],
    desc: 'Хранит еду поселения: рыбу, коренья, брюкву и хлеб из Рима.' },
  statue:    { name: 'Статуя Цезаря', cost: { denarii: 500 }, hp: 800, r: 4, max: 1, req: [], anytime: true,
    desc: 'Только за денарии. Рука Цезаря указывает, в какой стороне зарыта гробница фараона.' },
  scove:     { name: 'Скрытая бухта', cost: { log: 12, sand: 8 }, hp: 220, r: 4, shore: true, max: 1, req: [], anytime: true, role: 'smuggler', own: true,
    desc: 'Тайник контрабандиста. Строится только из своих ресурсов. Издалека её видит лишь сыщик, остальные — вблизи; на карте — только у контрабандиста.' },
};

// памятники на карте: их нужно восстановить. guard — чьи тайные действия вдвое медленнее и срываются в половине случаев
export const LANDMARKS = {
  lighthouse: { name: 'Фаросский маяк', repair: { marble: 5, plank: 5 }, relight: { marble: 2, plank: 2 }, guard: ['smuggler'],
    desc: 'Пока горит: контрабандист действует вдвое медленнее и срывается в половине случаев, рейсы на четверть быстрее.' },
  olympus: { name: 'Храм Олимпа', repair: { marble: 4, brick: 5, plank: 5 }, guard: ['warlock'],
    desc: 'Колдун действует вдвое медленнее, его действия и призыв срываются в половине случаев.' },
  tower: { name: 'Боевая башня', repair: { plank: 8, brick: 8, marble: 3 }, guard: ['impostor', 'instigator'],
    desc: 'Дозор у Лагеря: диверсант и подстрекатель действуют вдвое медленнее и срываются в половине случаев.' },
  colosseum: { name: 'Колизей', repair: { marble: 6, brick: 10, plank: 10 }, guard: [],
    desc: 'Арена гладиаторских боёв (стоит с начала игры): лидер объявляет бои, рабов и заключённых сразу доставляют на арену, зрители делают ставки, Рим шлёт хлеб.' },
};

export const ANIMALS = {
  jackal: { name: 'Шакал', hp: 28, dmg: 4, speed: 5.2, aggro: 10, reach: 1.6, atkCd: 1.2, bldg: 4, xp: 15, leash: 35, hides: 1 },
  boar:   { name: 'Кабан', hp: 55, dmg: 8, speed: 4.3, aggro: 7, reach: 1.9, atkCd: 1.5, bldg: 8, xp: 25, leash: 30, hides: 2 },
  lion:   { name: 'Лев', hp: 110, dmg: 14, speed: 4.9, aggro: 13, reach: 2.3, atkCd: 1.7, bldg: 12, xp: 55, leash: 45, hides: 3 },
  pharaoh:{ name: 'Мумия фараона', hp: 700, dmg: 16, speed: 3.7, aggro: 15, reach: 2.6, atkCd: 1.3, bldg: 0, xp: 200, leash: 999, hides: 0 },
  merc:   { name: 'Наёмник', hp: 140, dmg: 10, speed: 4.6, aggro: 9, reach: 2.2, atkCd: 1.1, bldg: 16, xp: 40, leash: 999, hides: 0 },
  nightbeast:{ name: 'Светящийся шакал', hp: 40, dmg: 5, speed: 5.6, aggro: 8, reach: 1.6, atkCd: 1.2, bldg: 0, xp: 35, leash: 30, hides: 0, night: true },
  gladbot:{ name: 'Гладиатор из Капуи', hp: 100, dmg: 12, speed: 4.3, aggro: 40, reach: 2.4, atkCd: 1.1, bldg: 0, xp: 0, leash: 999, hides: 0 },
  elephant:{ name: 'Боевой слон', hp: 3400, dmg: 38, speed: 4.2, aggro: 24, reach: 4.5, atkCd: 2.0, bldg: 0, xp: 1000, leash: 40, hides: 0 },
  monster:{ name: 'Чудовище из песков', hp: 3200, dmg: 45, speed: 3.8, aggro: 18, reach: 5, atkCd: 1.5, bldg: 85, xp: 600, leash: 999, hides: 0 },
};

export const POI_TYPES = {
  ruins:   { name: 'Развалины храма' },
  village: { name: 'Брошенная деревня' },
  shrine:  { name: 'Старое святилище' },
  altar:   { name: 'Древний алтарь' },
  cove:    { name: 'Скрытая бухта' },
  oasis:   { name: 'Оазис' },
  lair:    { name: 'Тайная мастерская' },
  market:  { name: 'Ларёк торговца' },
  arena:   { name: 'Арена боевого слона' },
  temple:  { name: 'Храм прорицателя' },
  lighthouse: { name: 'Фаросский маяк' },
  quarry:  { name: 'Каменоломня' },
  olympus: { name: 'Храм Олимпа' },
  tower:   { name: 'Боевая башня' },
  tomb:    { name: 'Гробница фараона' },
  colosseum: { name: 'Колизей' },
  prison:  { name: 'Остров тюремщиков' },
};

export const COLORS = [
  { hex: 0xc0392b, name: 'красного' }, { hex: 0x2e5fb8, name: 'синего' },
  { hex: 0x2f8f4e, name: 'зелёного' }, { hex: 0xe0b52a, name: 'жёлтого' },
  { hex: 0x7d3c98, name: 'фиолетового' }, { hex: 0xe67e22, name: 'оранжевого' },
  { hex: 0xeeeeee, name: 'белого' }, { hex: 0x2b2b2b, name: 'чёрного' },
];

// Быстрый режим для тестирования: всё дешевле и быстрее
export function applyFast() {
  for (const b of Object.values(BUILDINGS)) {
    for (const k in b.cost) b.cost[k] = Math.max(1, Math.ceil(b.cost[k] / 4));
    if (b.voyages) b.voyages = 1;
  }
  for (const k in CFG.shipCost) CFG.shipCost[k] = Math.ceil(CFG.shipCost[k] / 4);
  CFG.secretCd = 10; CFG.raidFirst = 90; CFG.raidInterval = 120; CFG.voyageTime = 20;
  CFG.farmTick = 6; CFG.voteCd = 30; CFG.monsterWinTime = 180; CFG.minCargo = 2;
  CFG.animalRespawn = 45; CFG.lootRespawn = 60; CFG.oracleCd = 15; CFG.horseLife = 20; CFG.bossRaidTime = 30; CFG.exileTime = 20; CFG.horseFeed = 40;
  CFG.mercPrice = 40; CFG.stealVoteCost = 25; CFG.summonTime = 25; CFG.summonCd = 30;
  CFG.gamesGather = 8; CFG.gamesChoose = 4; CFG.gamesCd = 5; CFG.taxTime = 8; CFG.taxCd = 5; CFG.taxSlave = 10; CFG.reelectCd = 5; CFG.breadDelay = 3;
  for (const m of MERCHANT) m.price = Math.ceil(m.price / 4);
  CFG.mummyGift = 60;
}

// Доля суток 0..1; игра стартует утром
export function dayFrac(t) { return ((t + CFG.dayLength * 0.12) % CFG.dayLength) / CFG.dayLength; }
// Песчаная буря: каждый третий день, в середине дня. Сила 0..1 (плавно нарастает и стихает)
export function stormAt(t) {
  const L = CFG.dayLength, tt = t + L * 0.12, day = Math.floor(tt / L);
  if (day % 3 !== 2) return 0;
  const s = (tt % L) - L * 0.3;
  if (s < 0 || s > CFG.stormTime) return 0;
  return Math.max(0, Math.min(1, s / 12, (CFG.stormTime - s) / 12));
}
// громкоговоритель Лагеря — в локальных координатах постройки
export const MEGA_LOCAL = { x: -2.2, z: 1.4 };
// громкоговорители у памятников (в метрах от центра, до поворота)
export const MEGA_POI = { lighthouse: { x: 3.5, z: 9 }, temple: { x: 5, z: 9.5 }, olympus: { x: 6, z: 9 } };
const rotLocal = (o, l) => { const c = Math.cos(o.ry || 0), s = Math.sin(o.ry || 0); return { x: o.x + l.x * c + l.z * s, z: o.z - l.x * s + l.z * c }; };
export function megaPos(b) { return rotLocal(b, MEGA_LOCAL); }
export function megaPoiPos(p) { return MEGA_POI[p.type] ? rotLocal(p, MEGA_POI[p.type]) : null; }
// ферма ставится только у оазиса (но не в пруду)
export function oasisFarmOk(x, z, r = 6) {
  return OASES.some((o) => { const d = Math.hypot(x - o.x, z - o.z); return d < o.r * 1.9 && d > o.r * 0.5 + r * 0.6; });
}

// ---------- Случайность и шум ----------
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(i, j) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sstep = (t) => t * t * (3 - 2 * t);
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = sstep(x - xi), zf = sstep(z - zi);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}
export function fbm(x, z) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += vnoise(x * f, z * f) * amp; amp *= 0.5; f *= 2.03; }
  return s / 0.9375;
}
export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ---------- Рельеф острова ----------
// Остров каждый раз новый: форма берега, гавань, горы, оазисы и арена слона зависят от сида мира.
// Значения ниже — «живые» экспорты: setTerrainSeed() перезаписывает их, и сервер, и клиент видят новые.
export let ISLAND_R = 400;
export const MAP_LIMIT = 570; // дальше этой границы не уплыть
export let HARBOR = null, CAMP = null, MOUNTAINS = [], BOSS = null, OASES = [], BAYS = [], PRISON = null, FLATS = [], SHAPE = null;
// ровные площадки под точками интереса (сервер вычисляет, клиент получает вместе с миром)
export function setFlats(list) { FLATS = list || []; }

function segDist0(px, pz, a, b) {
  const vx = b.x - a.x, vz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (pz - a.z) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - a.x - vx * t, pz - a.z - vz * t);
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
// Форма острова — не круг: центральное «тело» + вытянутые рукава + ветви-полуострова.
// 0 — хребет суши, 1 — линия берега, больше 1 — море
function shapeT(x, z) {
  const a = Math.atan2(z, x);
  let wob = 1;
  for (const [amp, f, ph] of SHAPE.wob) wob += amp * Math.sin(f * a + ph);
  let t = Math.hypot(x, z) / (SHAPE.r * wob);
  for (const g of SHAPE.segs) {
    const vx = g.b.x - g.a.x, vz = g.b.z - g.a.z;
    const u = Math.max(0, Math.min(1, ((x - g.a.x) * vx + (z - g.a.z) * vz) / (vx * vx + vz * vz)));
    const d = Math.hypot(x - g.a.x - vx * u, z - g.a.z - vz * u);
    t = smin(t, d / (g.w0 + (g.w1 - g.w0) * u), 0.3);
  }
  return t;
}
export function islandT(x, z) {
  return shapeT(x, z) * (1 + (vnoise(x * 0.011 + 7, z * 0.011 - 3) - 0.5) * 0.32 + (vnoise(x * 0.045, z * 0.045 + 9) - 0.5) * 0.08);
}
// направление «наружу», к морю (градиент islandT)
function outward(x, z) {
  const e = 2, gx = islandT(x + e, z) - islandT(x - e, z), gz = islandT(x, z + e) - islandT(x, z - e), l = Math.hypot(gx, gz) || 1;
  return { x: gx / l, z: gz / l };
}
// расстояние от точки до моря (грубо, по 16 лучам)
export function coastDist(x, z, max = 200) {
  let best = max;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    for (let d = 3; d < best; d += 3) if (islandT(x + c * d, z + s * d) >= 1) { best = d; break; }
  }
  return best;
}
// берег по лучу из центра (самый внешний)
function coastR(a) {
  for (let r = MAP_LIMIT; r > 5; r -= 2) if (islandT(Math.cos(a) * r, Math.sin(a) * r) < 1) return r;
  return 5;
}
export function setTerrainSeed(seed) {
  if (typeof resetWaterCache === 'function') try { resetWaterCache(); } catch {}
  const r = makeRng((seed ^ 0x5bd1e995) >>> 0);
  const R = (a, b) => a + r() * (b - a);
  const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  // --- форма: тело, два рукава (вытянутость) и 2–4 ветви ---
  SHAPE = { r: R(195, 230), wob: [[R(0.04, 0.08), 2, R(0, 6.28)], [R(0.03, 0.06), 3, R(0, 6.28)], [R(0.02, 0.04), 5, R(0, 6.28)]], segs: [] };
  const fit = (a, b, w1) => {
    // не выходить за пределы карты
    const L = Math.hypot(b.x, b.z), lim = 515 - w1 * 1.25;
    return L > lim ? { x: b.x * lim / L, z: b.z * lim / L } : b;
  };
  const ax = R(0, Math.PI * 2);
  const arms = [];
  const armSpecs = [[ax + R(-0.2, 0.2), R(290, 400)], [ax + Math.PI + R(-0.6, 0.6), R(r() < 0.35 ? 80 : 190, 370)]];
  if (r() < 0.35) armSpecs.push([ax + Math.PI / 2 * (r() < 0.5 ? 1 : -1) + R(-0.3, 0.3), R(160, 270)]);
  for (const [ang, len] of armSpecs) {
    const w0 = R(125, 160), w1 = R(65, 95);
    const a = { x: 0, z: 0 }, b = fit(a, { x: Math.cos(ang) * len, z: Math.sin(ang) * len }, w1);
    const g = { a, b, w0, w1, ang };
    SHAPE.segs.push(g); arms.push(g);
  }
  const nBr = 3 + Math.floor(r() * 3);
  for (let i = 0; i < nBr; i++) {
    const arm = arms[Math.floor(r() * arms.length)], u = R(0.35, 0.9);
    const a = { x: arm.a.x + (arm.b.x - arm.a.x) * u, z: arm.a.z + (arm.b.z - arm.a.z) * u };
    const ang = arm.ang + (r() < 0.5 ? 1 : -1) * R(0.7, 1.4), len = R(130, 240);
    const w1 = R(36, 52), wa = arm.w0 + (arm.w1 - arm.w0) * u;
    SHAPE.segs.push({ a, b: fit(a, { x: a.x + Math.cos(ang) * len, z: a.z + Math.sin(ang) * len }, w1), w0: Math.min(wa * 0.75, R(62, 86)), w1, ang });
  }
  const armAngles = SHAPE.segs.map((g) => Math.atan2(g.b.z - g.a.z, g.b.x - g.a.x));
  // природная гавань с проливом к морю — в теле острова, пролив не режет рукава
  let th = R(0, Math.PI * 2);
  for (let i = 0; i < 40; i++) { const c = R(0, Math.PI * 2); if (armAngles.every((a) => angDiff(a, c) > 0.6)) { th = c; break; } }
  const dH = R(30, 80), hr = R(50, 64);
  const hx = Math.cos(th) * dH, hz = Math.sin(th) * dH, ta = th + R(-0.15, 0.15);
  HARBOR = { x: hx, z: hz, r: hr, th, end: { x: Math.cos(ta) * ISLAND_R * 1.8, z: Math.sin(ta) * ISLAND_R * 1.8 }, w: R(18, 24) };
  // лагерь — на берегу гавани со стороны центра острова
  CAMP = { x: hx - Math.cos(th) * (hr + 11), z: hz - Math.sin(th) * (hr + 11), dirx: Math.cos(th), dirz: Math.sin(th) };
  FLATS = [];
  const box = (tMin, tMax) => {
    for (let i = 0; i < 4000; i++) { const x = R(-540, 540), z = R(-540, 540), t = islandT(x, z); if (t >= tMin && t <= tMax) return { x, z }; }
    return { x: 0, z: 0 };
  };
  // изрезанный берег: от 0 до 5 узких бухт, врезающихся в остров
  BAYS = [];
  const roll = r(), bayCount = roll < 0.2 ? 0 : roll < 0.6 ? 1 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3);
  for (let i = 0; i < 120 && BAYS.length < bayCount; i++) {
    const p = box(0.97, 1.02), n = outward(p.x, p.z);
    const depth = R(40, 100), w = R(10, 20), side = R(-0.25, 0.25) * depth;
    const s0 = { x: p.x + n.x * 20, z: p.z + n.z * 20 };
    const e = { x: p.x - n.x * depth - n.z * side, z: p.z - n.z * depth + n.x * side };
    if (islandT(e.x, e.z) > 0.55 || islandT(e.x - n.x * 45, e.z - n.z * 45) > 0.8) continue; // бухта не должна разрезать сушу насквозь
    if (Math.hypot(e.x - CAMP.x, e.z - CAMP.z) < w + 70 || segDist0(CAMP.x, CAMP.z, s0, e) < w + 60) continue;
    if (Math.hypot(e.x - hx, e.z - hz) < hr + w + 35) continue;
    const a = Math.atan2(p.z, p.x);
    if (BAYS.some((b) => Math.hypot(b.e.x - e.x, b.e.z - e.z) < 90)) continue;
    BAYS.push({ a, s: s0, e, w });
  }
  const awayFromBays = (x, z, pad) => BAYS.every((b) => segDist0(x, z, b.s, b.e) > b.w * 1.3 + pad);
  const awayFromHarbor = (x, z, pad) => Math.hypot(x - hx, z - hz) > hr + pad && segDist0(x, z, HARBOR, HARBOR.end) > HARBOR.w + pad && awayFromBays(x, z, pad * 0.6);
  // горы — только там, где суша достаточно широкая, чтобы не перегородить рукав
  MOUNTAINS = [];
  const mCount = 6 + Math.floor(r() * 3);
  for (let i = 0; i < 700 && MOUNTAINS.length < mCount; i++) {
    const p = box(0, 0.7), mr = R(26, 66), mh = 26 + mr * R(0.45, 0.6);
    if (Math.hypot(p.x - CAMP.x, p.z - CAMP.z) < mr + 50) continue;
    if (!awayFromHarbor(p.x, p.z, mr + 18)) continue;
    if (MOUNTAINS.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < (m.r + mr) * 0.85)) continue;
    if (coastDist(p.x, p.z, mr + 30) < mr + 25) continue;
    MOUNTAINS.push({ x: p.x, z: p.z, r: mr, h: mh });
  }
  // оазисы
  OASES = [];
  const oCount = 3 + Math.floor(r() * 2);
  // первый оазис — недалеко от Лагеря (60–110 м): там удобно ставить первую ферму
  for (let i = 0; i < 3000 && !OASES.length; i++) {
    const a = R(0, Math.PI * 2), d = R(60, 110) + i * 0.02, or = R(19, 23);
    const p = { x: CAMP.x + Math.cos(a) * d, z: CAMP.z + Math.sin(a) * d };
    if (islandT(p.x, p.z) > 0.6) continue;
    if (!awayFromHarbor(p.x, p.z, or + 22)) continue;
    if (MOUNTAINS.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r + or + 22)) continue;
    OASES.push({ x: p.x, z: p.z, r: or });
  }
  for (let i = 0; i < 700 && OASES.length < oCount; i++) {
    const p = box(0, 0.5), or = R(19, 24);
    if (Math.hypot(p.x - CAMP.x, p.z - CAMP.z) < 70) continue;
    if (!awayFromHarbor(p.x, p.z, or + 25)) continue;
    if (MOUNTAINS.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r + or + 22)) continue;
    if (OASES.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 125)) continue;
    OASES.push({ x: p.x, z: p.z, r: or });
  }
  // арена боевого слона — далеко от лагеря
  BOSS = null;
  for (let i = 0; i < 900 && !BOSS; i++) {
    const p = box(0, 0.5);
    if (Math.hypot(p.x - CAMP.x, p.z - CAMP.z) < 170) continue;
    if (!awayFromHarbor(p.x, p.z, 60)) continue;
    if (MOUNTAINS.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r + 35)) continue;
    if (OASES.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < o.r + 50)) continue;
    BOSS = { x: p.x, z: p.z, r: 24 };
  }
  if (!BOSS) { const p = box(0, 0.4); BOSS = { x: p.x, z: p.z, r: 24 }; }
  // скалистый остров тюремщиков недалеко от берега, в открытом море
  PRISON = null;
  for (let i = 0; i < 120 && !PRISON; i++) {
    const a = R(0, Math.PI * 2);
    if (angDiff(a, th) < 0.6 || BAYS.some((b) => angDiff(a, b.a) < 0.45)) continue;
    const d = coastR(a) + R(36, 46);
    if (d > MAP_LIMIT - 30) continue;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    let ok = islandT(x, z) > 1.3;
    for (let k = 0; k < 10 && ok; k++) { const b = (k / 10) * Math.PI * 2; if (islandT(x + Math.cos(b) * 38, z + Math.sin(b) * 38) < 1.05) ok = false; }
    if (ok) PRISON = { x, z, r: 24, a };
  }
  if (!PRISON) { const a = th + Math.PI / 2; const d = Math.min(MAP_LIMIT - 30, coastR(a) + 40); PRISON = { x: Math.cos(a) * d, z: Math.sin(a) * d, r: 24, a }; }
}
function baySD(x, z) {
  let m = 1e9;
  for (const b of BAYS) m = Math.min(m, segDist0(x, z, b.s, b.e) - b.w, Math.hypot(x - b.e.x, z - b.e.z) - b.w * 1.3);
  return m;
}
setTerrainSeed(1);
function segDist(px, pz, a, b) {
  const vx = b.x - a.x, vz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (pz - a.z) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - a.x - vx * t, pz - a.z - vz * t);
}
// расстояние до кромки гавани (отрицательное — внутри воды)
export function harborSD(x, z) {
  const c = Math.hypot(x - HARBOR.x, z - HARBOR.z) - HARBOR.r;
  const ch = segDist(x, z, HARBOR, HARBOR.end) - HARBOR.w;
  return Math.min(c, ch) + (vnoise(x * 0.07 + 3, z * 0.07) - 0.5) * 7;
}
export function terrainHeight(x, z) {
  const t = islandT(x, z);
  let h;
  if (t > 1) {
    h = -1.2 - Math.min(14, (t - 1) * 30);
    // остров тюремщиков: скалистый холм с ровной площадкой наверху
    const dp = Math.hypot(x - PRISON.x, z - PRISON.z);
    if (dp < PRISON.r + 8) {
      const top = 2.4 + (vnoise(x * 0.3, z * 0.3) - 0.5) * 0.8;
      const isl = dp < 11 ? 2.4 : top * (1 - smoothstep(11, PRISON.r + 6, dp)) - 1.5 * smoothstep(PRISON.r - 4, PRISON.r + 8, dp);
      h = Math.max(h, isl);
    }
    for (const f of FLATS) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r * 1.6) { const w = 1 - smoothstep(f.r, f.r * 1.6, d); h = Math.max(h, h * (1 - w) + f.h * w); }
    }
    return h;
  } else {
    const land = 1 - smoothstep(0.5, 1.0, t);
    const dunes = fbm(x * 0.017 + 10, z * 0.017 - 4);
    const ridges = Math.pow(Math.abs(Math.sin(x * 0.04 + z * 0.012 + fbm(x * 0.01, z * 0.01) * 6)), 2);
    h = land * (2.5 + dunes * 8 + ridges * 2.0 * land) + (1 - t) * 2.0 - 1.2;
  }
  // горы
  for (const m of MOUNTAINS) {
    const d = Math.hypot(x - m.x, z - m.z);
    if (d < m.r) {
      const k = 1 - d / m.r;
      const n = fbm(x * 0.06 + m.x, z * 0.06 + m.z);
      // крутые скалистые склоны с гребнями
      const ridge = 1 - Math.abs(vnoise(x * 0.09 + m.z, z * 0.09 - m.x) * 2 - 1);
      h += m.h * Math.pow(k, 1.35) * (0.55 + 0.45 * n + 0.25 * ridge);
    }
  }
  // оазисы: ровная низина с прудом
  for (const o of OASES) {
    const d = Math.hypot(x - o.x, z - o.z);
    if (d < o.r * 2.2) {
      const w = 1 - smoothstep(o.r * 1.35, o.r * 2.2, d); // широкий ровный пояс — место под фермы
      h = h * (1 - w) + 0.7 * w;
      const pw = 1 - smoothstep(o.r * 0.25, o.r * 0.45, d);
      h = h * (1 - pw) - 0.5 * pw;
    }
  }
  // ровные площадки под точками интереса — чтобы постройки не висели в воздухе и не тонули в песке
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r * 1.6) { const w = 1 - smoothstep(f.r, f.r * 1.6, d); h = h * (1 - w) + f.h * w; }
  }
  // ровная арена слона
  const db = Math.hypot(x - BOSS.x, z - BOSS.z);
  if (db < BOSS.r * 1.6) { const w = 1 - smoothstep(BOSS.r, BOSS.r * 1.6, db); h = h * (1 - w) + 1.6 * w; }
  // площадка лагеря
  const dc = Math.hypot(x - CAMP.x, z - CAMP.z);
  if (dc < 40) { const w = 1 - smoothstep(18, 40, dc); h = h * (1 - w) + 1.0 * w; }
  // гавань и бухты
  h = Math.min(h, Math.max(-9, -1.2 + 0.45 * harborSD(x, z)));
  if (BAYS.length) h = Math.min(h, Math.max(-7, -1.2 + 0.45 * (baySD(x, z) + (vnoise(x * 0.08, z * 0.08 + 5) - 0.5) * 6)));
  return h;
}
// сколько добавляют горы в этой точке (без дюн) — по этому определяется непроходимость
export function mountainAmount(x, z) {
  let h = 0;
  for (const m of MOUNTAINS) {
    const d = Math.hypot(x - m.x, z - m.z);
    if (d < m.r) {
      const k = 1 - d / m.r;
      const n = fbm(x * 0.06 + m.x, z * 0.06 + m.z);
      const ridge = 1 - Math.abs(vnoise(x * 0.09 + m.z, z * 0.09 - m.x) * 2 - 1);
      h += m.h * Math.pow(k, 1.35) * (0.55 + 0.45 * n + 0.25 * ridge);
    }
  }
  return h;
}
// непроходимо там, где горы поднимают склон выше mountainH (высокие дюны проходимы)
export const isBlocked = (x, z) => mountainAmount(x, z) > CFG.mountainH;
export const inOasisWater = (x, z) => OASES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r * 0.5);

export function isShore(x, z) {
  const h = terrainHeight(x, z);
  if (h < -0.4 || h > 2.2) return false;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    if (terrainHeight(x + Math.cos(a) * 13, z + Math.sin(a) * 13) < -0.6) return true;
  }
  return false;
}

// Точка на берегу: случайная (по маске islandT) с нужной высотой
function coastSample(rnd, tMin, tMax, hMin, hMax, check, tries = 3000) {
  for (let i = 0; i < tries; i++) {
    const x = (rnd() - 0.5) * 1080, z = (rnd() - 0.5) * 1080, t = islandT(x, z);
    if (t < tMin || t > tMax) continue;
    const h = terrainHeight(x, z);
    if (h < hMin || h > hMax) continue;
    if (check && !check(x, z)) continue;
    return { x, z, n: outward(x, z) };
  }
  return null;
}
const nearMountain = (x, z, pad = 8) => MOUNTAINS.some((m) => Math.hypot(x - m.x, z - m.z) < m.r + pad);

// ---------- Генерация мира ----------
export function generateWorld(seed) {
  setTerrainSeed(seed);
  const rnd = makeRng(seed);
  const R = (a, b) => a + rnd() * (b - a);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  let nextId = 1;
  const id = () => nextId++;
  const W = { seed, nodes: [], pois: [], loot: [], dens: [], decor: [], camp: null, treasureSpots: [], gullSpots: [], oases: OASES };
  // ровная площадка под точкой интереса (высота — как в центре, но не ниже 0.6)
  const addFlat = (x, z, r) => { FLATS.push({ x, z, r, h: Math.max(0.6, Math.min(5, terrainHeight(x, z))) }); };
  const POI_FLAT = { colosseum: 19, ruins: 14, village: 15, shrine: 8, altar: 9, market: 8, lair: 8, temple: 16, quarry: 12, olympus: 15, lighthouse: 8, tower: 9, tomb: 14 };

  // Лагерь — на северном берегу гавани, лодка в воде
  W.camp = { x: CAMP.x, z: CAMP.z, dirx: CAMP.dirx, dirz: CAMP.dirz, boat: { x: CAMP.x + CAMP.dirx * 19, z: CAMP.z + CAMP.dirz * 19 } };
  // палатки — на суше позади костра (по направлению вглубь острова), никогда не у воды
  W.camp.tents = [];
  {
    const px = -CAMP.dirz, pz = CAMP.dirx;
    for (const [lat, back0] of [[-9, 3], [9, 3], [0, 24]]) {
      for (let k = 0; k < 12; k++) {
        const back = back0 + k * 2, x = CAMP.x - CAMP.dirx * back + px * lat, z = CAMP.z - CAMP.dirz * back + pz * lat;
        let lo = terrainHeight(x, z);
        for (let i = 0; i < 8; i++) lo = Math.min(lo, terrainHeight(x + Math.cos(i * 0.785) * 2, z + Math.sin(i * 0.785) * 2));
        if (lo > 0.5) { W.camp.tents.push({ x, z, ry: Math.atan2(CAMP.dirx, CAMP.dirz) }); break; }
      }
    }
  }

  const occupied = [{ x: W.camp.x, z: W.camp.z, r: 30 }];
  for (const o of OASES) occupied.push({ x: o.x, z: o.z, r: o.r * 1.3 });
  occupied.push({ x: BOSS.x, z: BOSS.z, r: BOSS.r + 12 });
  const free = (x, z, r) => occupied.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r);
  function randLand(tMin, tMax, r, tries = 400, check) {
    for (let i = 0; i < tries; i++) {
      const x = R(-540, 540), z = R(-540, 540), t = islandT(x, z);
      if (t < tMin || t > tMax) continue;
      const h = terrainHeight(x, z);
      if (h < 0.4 || h > 6) continue;
      if (!free(x, z, r)) continue;
      // не вплотную к гавани и бухтам — вода прорезала бы площадку
      const need = Math.min(r, 16) + 14; // склон от воды поднимается полого — нужен запас
      if (harborSD(x, z) < need || (BAYS.length && baySD(x, z) < need)) continue;
      if (check && !check(x, z)) continue;
      return { x, z };
    }
    return null;
  }

  // Точки интереса (под каждой — ровная площадка)
  const addPoi = (type, x, z, ry, occR) => {
    if (POI_FLAT[type]) addFlat(x, z, POI_FLAT[type]);
    const p = { id: id(), type, x, z, ry };
    W.pois.push(p); occupied.push({ x, z, r: occR });
    return p;
  };
  const poiList = ['ruins', 'ruins', 'ruins', 'ruins', 'village', 'village', 'village', 'village', 'shrine', 'shrine', 'shrine', 'altar'];
  for (const type of poiList) {
    const p = randLand(0, 0.82, 22, 800, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 90 && !nearMountain(x, z, 12));
    if (p) addPoi(type, p.x, p.z, R(0, 6.28), 22);
  }
  // Боевая башня — недалеко от лагеря, на возвышении
  {
    const tw = randLand(0, 0.8, 10, 1500, (x, z) => { const d = Math.hypot(x - W.camp.x, z - W.camp.z); return d > 38 && d < 85 && !nearMountain(x, z, 6); })
      || randLand(0, 0.9, 8, 2000, (x, z) => { const d = Math.hypot(x - W.camp.x, z - W.camp.z); return d > 30 && d < 130; })
      || randLand(0, 0.95, 6, 4000, (x, z) => { const d = Math.hypot(x - W.camp.x, z - W.camp.z); return d > 25 && d < 220; });
    if (tw) addPoi('tower', tw.x, tw.z, Math.atan2(W.camp.x - tw.x, W.camp.z - tw.z), 12);
  }
  // Фаросский маяк — на побережье в самой дальней от лагеря точке (обычно на конце рукава)
  {
    let best = null, bd = -1;
    for (let i = 0; i < 400; i++) {
      const sp = coastSample(rnd, 0.8, 1.0, 0.6, 4, (x, z) => !nearMountain(x, z, 10) && free(x, z, 8), 200);
      if (!sp) continue;
      const d = Math.hypot(sp.x - W.camp.x, sp.z - W.camp.z);
      if (d > bd) { bd = d; best = sp; }
    }
    if (best) {
      // чуть вглубь суши, лицом к морю
      let x = best.x, z = best.z;
      for (let k = 0; k < 12 && terrainHeight(x - best.n.x, z - best.n.z) > 0.5; k++) { x -= best.n.x; z -= best.n.z; }
      x -= best.n.x * 6; z -= best.n.z * 6;
      addPoi('lighthouse', x, z, Math.atan2(best.n.x, best.n.z), 16);
    }
  }
  // Ларёк бродячего торговца — недалеко от лагеря; тайная мастерская — в глуши
  {
    const m = randLand(0, 0.6, 18, 800, (x, z) => { const d = Math.hypot(x - W.camp.x, z - W.camp.z); return d > 50 && d < 130 && !nearMountain(x, z, 10); });
    const m2 = m || randLand(0, 0.85, 12, 3000, (x, z) => { const d = Math.hypot(x - W.camp.x, z - W.camp.z); return d > 35 && d < 200 && !nearMountain(x, z, 6); });
    if (m2) addPoi('market', m2.x, m2.z, Math.atan2(W.camp.x - m2.x, W.camp.z - m2.z), 18);
    const l = randLand(0, 0.85, 18, 800, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 150 && !nearMountain(x, z, 8))
      || randLand(0, 0.9, 12, 3000, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 90 && !nearMountain(x, z, 4));
    if (l) addPoi('lair', l.x, l.z, R(0, 6.28), 18);
    W.pois.push({ id: id(), type: 'arena', x: BOSS.x, z: BOSS.z, ry: 0 });
    const tp = randLand(0, 0.75, 32, 800, (x, z) => { const d = Math.hypot(x - W.camp.x, z - W.camp.z); return d > 60 && d < 170 && !nearMountain(x, z, 10); })
      || randLand(0, 0.85, 24, 1500, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 45 && !nearMountain(x, z, 6))
      || randLand(0, 0.9, 16, 3000, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 40);
    if (tp) addPoi('temple', tp.x, tp.z, Math.atan2(W.camp.x - tp.x, W.camp.z - tp.z), 32);
    // Храм Олимпа — руины, которые можно восстановить
    const ol = randLand(0, 0.75, 26, 800, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 90 && !nearMountain(x, z, 12))
      || randLand(0, 0.85, 18, 3000, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 60 && !nearMountain(x, z, 6));
    if (ol) addPoi('olympus', ol.x, ol.z, Math.atan2(W.camp.x - ol.x, W.camp.z - ol.z), 26);
    // Колизей — руины арены, которые можно восстановить; не слишком далеко от лагеря
    const co = randLand(0, 0.78, 24, 1200, (x, z) => { const d = Math.hypot(x - W.camp.x, z - W.camp.z); return d > 70 && d < 220 && !nearMountain(x, z, 12); })
      || randLand(0, 0.88, 20, 3000, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 50 && !nearMountain(x, z, 6))
      || randLand(0, 0.95, 16, 5000, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 40);
    if (co) addPoi('colosseum', co.x, co.z, Math.atan2(W.camp.x - co.x, W.camp.z - co.z), 24);
  }
  // Каменоломня — у подножия горы, здесь добывают мрамор
  {
    let q = null;
    const ms = [...MOUNTAINS].sort((m1, m2) => Math.hypot(m1.x - W.camp.x, m1.z - W.camp.z) - Math.hypot(m2.x - W.camp.x, m2.z - W.camp.z));
    for (const m of ms) {
      for (let i = 0; i < 16 && !q; i++) {
        const a = Math.atan2(-m.z, -m.x) + (i % 2 ? 1 : -1) * Math.floor(i / 2) * 0.35;
        const x = m.x + Math.cos(a) * (m.r + 9), z = m.z + Math.sin(a) * (m.r + 9);
        const h = terrainHeight(x, z);
        if (h > 0.5 && h < 7 && !isBlocked(x, z) && free(x, z, 12) && Math.hypot(x - W.camp.x, z - W.camp.z) > 70 && harborSD(x, z) > 30 && (!BAYS.length || baySD(x, z) > 30)) q = { x, z, ry: a + Math.PI / 2 };
      }
      if (q) break;
    }
    if (q) {
      addPoi('quarry', q.x, q.z, q.ry, 16);
      for (let i = 0; i < 5; i++) {
        const a = q.ry + (i - 2) * 0.55, d = 6 + (i % 2) * 2;
        W.nodes.push({ id: id(), res: 'marble', kind: 'marble', x: q.x + Math.cos(a) * d, z: q.z + Math.sin(a) * d, amount: 12, max: 12, ry: R(0, 6.28), s: R(0.9, 1.2) });
      }
    }
  }
  // остров тюремщиков
  W.pois.push({ id: id(), type: 'prison', x: PRISON.x, z: PRISON.z, ry: PRISON.a + Math.PI / 2 });
  // Скрытая бухта — на дальнем от гавани берегу, подальше от гор
  {
    let best = null, bd = -1;
    for (let i = 0; i < 80; i++) {
      const sp = coastSample(rnd, 0.9, 1.02, 0.4, 1.4, (x, z) => !nearMountain(x, z, 6) && free(x, z, 14) && Math.hypot(x - HARBOR.x, z - HARBOR.z) > 150, 150);
      if (!sp) continue;
      const d = Math.hypot(sp.x - HARBOR.x, sp.z - HARBOR.z) * (0.6 + rnd() * 0.4);
      if (d > bd) { bd = d; best = sp; }
    }
    if (!best) best = coastSample(rnd, 0.9, 1.05, 0.2, 2, null, 5000) || { x: 0, z: 0, n: { x: 1, z: 0 } };
    W.pois.push({ id: id(), type: 'cove', x: best.x, z: best.z, ry: Math.atan2(best.n.z, best.n.x) + Math.PI / 2 });
    occupied.push({ x: best.x, z: best.z, r: 14 });
  }

  // Гробница фараона — в любом месте острова, без ровной площадки (наполовину занесена песком, издалека не заметна):
  // не в воде, не у Лагеря, не на горе и не впритык к точкам интереса (между краями — не меньше 7 шагов)
  {
    const TR = 9; // радиус самой гробницы
    const ok = (x, z) => {
      if (Math.hypot(x - W.camp.x, z - W.camp.z) < 70) return false;
      if (nearMountain(x, z, 4) || mountainAmount(x, z) > 1.5) return false;
      for (let i = 0; i < 8; i++) { const a = i * 0.785; if (terrainHeight(x + Math.cos(a) * TR, z + Math.sin(a) * TR) < 0.5) return false; }
      for (const p of W.pois) if (Math.hypot(p.x - x, p.z - z) < (POI_FLAT[p.type] || 10) + TR + 7) return false;
      for (const o of OASES) if (Math.hypot(o.x - x, o.z - z) < o.r + TR + 4) return false;
      if (Math.hypot(x - BOSS.x, z - BOSS.z) < BOSS.r + TR + 7) return false;
      return true;
    };
    let t = null;
    for (let i = 0; i < 6000 && !t; i++) { const x = R(-540, 540), z = R(-540, 540); if (islandT(x, z) > 0.95) continue; const h = terrainHeight(x, z); if (h < 0.6 || h > 9) continue; if (ok(x, z)) t = { x, z }; }
    if (t) { occupied.push({ x: t.x, z: t.z, r: TR + 3 }); W.tomb = { x: t.x, z: t.z, ry: R(0, 6.28) }; }
  }
  // Добыча в точках интереса
  const guaranteed = ['tools', 'tools', 'tools', 'map', 'map', 'map', 'pickaxe', 'pickaxe', 'mandrake', 'mandrake', 'mandrake', 'mandrake', 'mandrake', 'venom', 'venom', 'venom', 'venom', 'venom', 'bones', 'bones',
    'spear', 'spear', 'spear', 'axe', 'axe', 'salve', 'salve', 'salve', 'bandage', 'bandage', 'bandage', 'bandage',
    'coins', 'coins', 'coins', 'coins', 'coins', 'coins', 'darkpotion', 'darkpotion', 'rod', 'rod', 'bones'];
  const pref = {
    ruins: ['coins', 'map', 'tools', 'bones', 'spear', 'bandage'],
    village: ['bandage', 'salve', 'coins', 'tools', 'axe', 'spear', 'rod'],
    shrine: ['mandrake', 'venom', 'salve', 'map', 'bones', 'bandage', 'darkpotion'],
    altar: ['bones', 'venom', 'mandrake', 'coins', 'darkpotion'],
    cove: ['coins', 'spear', 'map', 'bandage', 'rod'],
  };
  const slots = [];
  for (const p of W.pois) {
    if (!pref[p.type]) continue;
    const n = p.type === 'cove' ? 3 : p.type === 'altar' ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const a = R(0, 6.28), d = R(3, p.type === 'village' ? 13 : 9);
      slots.push({ poi: p, x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d });
    }
  }
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  let gi = 0;
  for (const s of slots) {
    const type = gi < guaranteed.length ? guaranteed[gi++] : pick(pref[s.poi.type]);
    W.loot.push({ id: id(), item: type, x: s.x, z: s.z, poi: s.poi.type });
  }
  // копьё у лагеря — чтобы было чем ловить чаек
  W.loot.push({ id: id(), item: 'spear', x: W.camp.x + 4, z: W.camp.z - 3, poi: 'camp' });
  W.loot.push({ id: id(), item: 'rod', x: W.camp.x - 3, z: W.camp.z - 4, poi: 'camp' }); // удочка у лагеря
  // в оазисах — немного лечения
  for (const o of OASES) W.loot.push({ id: id(), item: pick(['bandage', 'salve']), x: o.x + o.r * 0.7, z: o.z + R(-3, 3) });
  // места, где растут съедобные коренья (у оазисов)
  W.rootSpots = [];
  for (const o of OASES) for (let i = 0, k = 0; i < 40 && k < 7; i++) {
    const a = R(0, 6.28), d = o.r * R(0.85, 1.45), x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d;
    if (terrainHeight(x, z) > 0.2 && !isBlocked(x, z)) { W.rootSpots.push({ x, z }); k++; }
  }

  // Логова зверей
  const denTypes = ['jackal', 'jackal', 'jackal', 'jackal', 'jackal', 'boar', 'boar', 'boar', 'boar', 'lion', 'lion', 'lion', 'jackal', 'boar', 'jackal'];
  for (const type of denTypes) {
    const p = randLand(0, 0.88, 15, 800, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 110);
    if (!p) continue;
    const count = type === 'lion' ? 2 : type === 'boar' ? 3 : 4;
    W.dens.push({ id: id(), type, x: p.x, z: p.z, count });
    occupied.push({ x: p.x, z: p.z, r: 12 });
  }

  // Ресурсы: деревья — по острову (не у лагеря) и густо в оазисах; песок — у берегов
  const awayFromCamp = (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 65;
  for (let i = 0; i < 210; i++) {
    const p = randLand(0, 0.9, 3, 200, awayFromCamp);
    if (!p) continue;
    const kind = islandT(p.x, p.z) > 0.65 && rnd() < 0.7 ? 'palm' : 'deadtree';
    W.nodes.push({ id: id(), res: 'log', kind, x: p.x, z: p.z, amount: 8, max: 8, ry: R(0, 6.28), s: R(0.85, 1.25) });
    occupied.push({ x: p.x, z: p.z, r: 2 });
  }
  // пальмовые рощи в оазисах
  for (const o of OASES) {
    for (let i = 0; i < 22; i++) {
      const ring = i < 10 ? R(0.55, 0.85) : R(0.95, 1.45);
      const a = (i / (i < 10 ? 10 : 12)) * Math.PI * 2 + R(-0.25, 0.25), d = o.r * ring;
      W.nodes.push({ id: id(), res: 'log', kind: 'palm', x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d, amount: 8, max: 8, ry: R(0, 6.28), s: R(1.0, 1.4) });
    }
    for (let i = 0; i < 45; i++) {
      const a = R(0, 6.28), d = o.r * Math.sqrt(R(0.2, 1.6));
      W.decor.push({ kind: 'grass', x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d, ry: R(0, 6.28), s: R(0.7, 1.4) });
    }
  }
  // песок — на пляжах внешнего берега, у гавани и бухт
  const sandOk = (x, z) => { const h = terrainHeight(x, z); return h > 0.3 && h < 2.6 && !isBlocked(x, z) && free(x, z, 2.5) && awayFromCamp(x, z); };
  for (let i = 0, n = 0; i < 400 && n < 150; i++) {
    const sp = coastSample(rnd, 0.8, 0.99, 0.3, 2.6, sandOk, 60);
    if (!sp) continue;
    const { x, z } = sp;
    W.nodes.push({ id: id(), res: 'sand', kind: 'sandpile', x, z, amount: 10, max: 10, ry: R(0, 6.28), s: R(0.9, 1.3) });
    occupied.push({ x, z, r: 2 }); n++;
  }
  for (let i = 0, n = 0; i < 1500 && n < 40; i++) {
    const x = R(-540, 540), z = R(-540, 540);
    if (islandT(x, z) > 0.95) continue;
    const sd = Math.min(harborSD(x, z), BAYS.length ? baySD(x, z) : 1e9);
    if (sd < 3 || sd > 22 || !sandOk(x, z)) continue;
    W.nodes.push({ id: id(), res: 'sand', kind: 'sandpile', x, z, amount: 10, max: 10, ry: R(0, 6.28), s: R(0.9, 1.3) });
    occupied.push({ x, z, r: 2 }); n++;
  }
  // у лагеря — ровно на первую постройку (Склад), и это не восстанавливается: дальше — за пределы лагеря
  {
    const need = BUILDINGS.warehouse.cost;
    const spots = [];
    for (let i = 0; i < 200 && spots.length < 4; i++) {
      const a = R(0, Math.PI * 2), d = R(12, 26), x = W.camp.x + Math.cos(a) * d, z = W.camp.z + Math.sin(a) * d;
      if (terrainHeight(x, z) < 0.4 || spots.some((q) => Math.hypot(q.x - x, q.z - z) < 6)) continue;
      spots.push({ x, z });
    }
    const logEach = Math.ceil((need.log || 0) / 2), sandEach = Math.ceil((need.sand || 0) / 2);
    spots.forEach((q, i) => {
      const isLog = i < 2;
      W.nodes.push({ id: id(), res: isLog ? 'log' : 'sand', kind: isLog ? 'palm' : 'sandpile', x: q.x, z: q.z, amount: isLog ? logEach : sandEach, max: isLog ? logEach : sandEach, ry: R(0, 6.28), s: 1, noRegen: true });
    });
  }

  // Места клада
  for (let i = 0; i < 12; i++) {
    const p = randLand(0, 0.85, 6, 300, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 110);
    if (p) W.treasureSpots.push(p);
  }

  // Места для чаек: внешний берег и берег гавани
  for (let i = 0; i < 90 && W.gullSpots.length < 40; i++) {
    const sp = coastSample(rnd, 0.85, 1.05, 0.15, 0.8, (x, z) => !nearMountain(x, z, 0), 120);
    if (sp) W.gullSpots.push({ x: sp.x, z: sp.z });
  }
  for (let i = 0; i < 100 && W.gullSpots.length < 54; i++) {
    const a = R(0, Math.PI * 2);
    for (let r = HARBOR.r - 5; r < HARBOR.r + 20; r += 0.5) {
      const x = HARBOR.x + Math.cos(a) * r, z = HARBOR.z + Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h > 0.15 && h < 1.5) { if (Math.hypot(x - W.camp.x, z - W.camp.z) > 12) W.gullSpots.push({ x, z }); break; }
    }
  }

  // Декор
  for (let i = 0; i < 650; i++) {
    const p = randLand(0.0, 0.97, 1, 50);
    if (!p) continue;
    const nearCamp = Math.hypot(p.x - W.camp.x, p.z - W.camp.z) < 75; // в поселении камней нет — только кусты
    if (nearCamp && rnd() < 0.7) continue;
    W.decor.push({ kind: !nearCamp && rnd() < 0.45 ? 'rock' : 'shrub', x: p.x, z: p.z, ry: R(0, 6.28), s: R(0.5, 1.6) });
  }
  // скалы в море у берегов
  for (let i = 0, n = 0; i < 3000 && n < 45; i++) {
    const x = R(-560, 560), z = R(-560, 560), t = islandT(x, z);
    if (t < 1.03 || t > 1.7) continue;
    const h = terrainHeight(x, z);
    if (h > -0.9 || h < -6) continue;
    if (harborSD(x, z) < 12 || Math.hypot(x - PRISON.x, z - PRISON.z) < PRISON.r + 20) continue;
    if (W.decor.some((d) => d.kind === 'searock' && Math.hypot(d.x - x, d.z - z) < 25)) continue;
    W.decor.push({ kind: 'searock', x, z, ry: R(0, 6.28), s: R(1.2, 2.4), h });
    n++;
  }
  // валуны у подножия гор
  for (const m of MOUNTAINS) for (let i = 0; i < 10; i++) {
    const a = R(0, 6.28), d = m.r * R(0.85, 1.15);
    const x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d;
    if (terrainHeight(x, z) > 0.3 && Math.hypot(x - W.camp.x, z - W.camp.z) > 75) W.decor.push({ kind: 'rock', x, z, ry: R(0, 6.28), s: R(1.4, 2.6) });
  }
  W.flats = FLATS;
  return W;
}

// ---------- Вода: стоянка корабля и морской путь (одинаково считают сервер и клиент) ----------
// место у постройки на берегу, где вода достаточно глубокая для корпуса
export function shipDock(b) {
  let best = null;
  for (let r = 6; r <= 48 && !best; r += 2) for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2, x = b.x + Math.sin(a) * r, z = b.z + Math.cos(a) * r;
    if (terrainHeight(x, z) < -0.9 && terrainHeight(x + Math.sin(a) * 4, z + Math.cos(a) * 4) < -0.9) { best = { x: x + Math.sin(a) * 3, z: z + Math.cos(a) * 3, ry: a + Math.PI / 2 }; break; }
  }
  if (!best) for (let r = 6; r <= 60 && !best; r += 2) for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2, x = b.x + Math.sin(a) * r, z = b.z + Math.cos(a) * r;
    if (terrainHeight(x, z) < 0) { best = { x, z, ry: a + Math.PI / 2 }; break; }
  }
  if (!best) best = { x: b.x + Math.sin(b.ry || 0) * 10, z: b.z + Math.cos(b.ry || 0) * 10, ry: b.ry || 0 };
  best.y = Math.max(0, terrainHeight(best.x, best.z));
  return best;
}
// путь корабля только по воде (A* по сетке 6 м), затем спрямлённый. Возвращает точки [{x,z}] и длину
var pathCache = new Map();
function resetWaterCache() { pathCache = new Map(); seaGrid = null; }
// открытое море у края карты — сюда должна вести вода от любой пристани
export const OPEN_SEA = { x: MAP_LIMIT - 20, z: 0 };
// какие клетки воды связаны с открытым морем (заливка один раз на остров)
var seaGrid = null;
export function seaConnected(x, z) {
  const STEP = 6, L = MAP_LIMIT, N = Math.ceil((2 * L) / STEP) + 1;
  if (!seaGrid) {
    seaGrid = new Uint8Array(N * N);
    const wet = (i) => terrainHeight((i % N) * STEP - L, Math.floor(i / N) * STEP - L) < -1.1;
    const st = [Math.round((OPEN_SEA.z + L) / STEP) * N + Math.round((OPEN_SEA.x + L) / STEP)];
    seaGrid[st[0]] = 1;
    while (st.length) {
      const i = st.pop(), ix = i % N, iz = Math.floor(i / N);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = ix + dx, nz = iz + dz; if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const j = nz * N + nx; if (seaGrid[j]) continue;
        if (wet(j)) { seaGrid[j] = 1; st.push(j); } else seaGrid[j] = 2;
      }
    }
  }
  const i0 = Math.round((z + L) / STEP) * N + Math.round((x + L) / STEP);
  for (let r = 0; r <= 4; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const j = i0 + dz * N + dx; if (j >= 0 && j < N * N && seaGrid[j] === 1) return true; }
  return false;
}
export function waterPath(a, b) {
  const key = `${a.x.toFixed(1)},${a.z.toFixed(1)}>${b.x.toFixed(1)},${b.z.toFixed(1)}`;
  if (pathCache.has(key)) return pathCache.get(key);
  const STEP = 6, L = MAP_LIMIT, N = Math.ceil((2 * L) / STEP) + 1;
  const idx = (x, z) => Math.round((z + L) / STEP) * N + Math.round((x + L) / STEP);
  const cx = (i) => (i % N) * STEP - L, cz = (i) => Math.floor(i / N) * STEP - L;
  seaConnected(0, 0); // строим сетку моря, связанного с открытой водой
  const isWet = (i) => seaGrid[i] === 1;
  // начало и конец — ближайшие клетки с глубокой водой
  const snap = (p) => { const i0 = idx(p.x, p.z); if (isWet(i0)) return i0; for (let r = 1; r <= 4; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const j = i0 + dz * N + dx; if (j >= 0 && j < N * N && isWet(j)) return j; } return i0; };
  const s = snap(a), g = snap(b);
  const gs = new Float64Array(N * N).fill(Infinity), closed = new Uint8Array(N * N), from = new Int32Array(N * N).fill(-1);
  const heap = []; // [f, i]
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const h = (i) => Math.hypot(cx(i) - cx(g), cz(i) - cz(g));
  gs[s] = 0; push(h(s), s);
  let found = false, iter = 0;
  while (heap.length && iter++ < 400000) {
    const [, i] = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === g) { found = true; break; }
    const ix = i % N, iz = Math.floor(i / N);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = ix + dx, nz = iz + dz;
      if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
      const j = nz * N + nx;
      if (!isWet(j)) continue;
      const ng = gs[i] + (dx && dz ? 1.414 : 1) * STEP;
      if (ng < gs[j]) { gs[j] = ng; from[j] = i; push(ng + h(j), j); }
    }
  }
  let pts;
  if (!found) pts = [{ x: a.x, z: a.z }, { x: b.x, z: b.z }];
  else {
    const raw = []; for (let i = g; i >= 0; i = from[i]) { raw.push({ x: cx(i), z: cz(i) }); if (i === s) break; }
    raw.reverse(); raw.unshift({ x: a.x, z: a.z }); raw.push({ x: b.x, z: b.z });
    // спрямляем: от каждой точки — к самой дальней, до которой видно по воде
    const clear = (p, q) => { const d = Math.hypot(q.x - p.x, q.z - p.z), n = Math.ceil(d / 3); for (let k = 1; k < n; k++) { const t = k / n; if (terrainHeight(p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t) > -0.9) return false; } return true; };
    pts = [raw[0]];
    let k = 0;
    while (k < raw.length - 1) { let m = raw.length - 1; while (m > k + 1 && !clear(raw[k], raw[m])) m--; pts.push(raw[m]); k = m; }
  }
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  const res = { pts, len, found };
  pathCache.set(key, res);
  return res;
}
// точка на пути по доле 0..1 и направление движения
export function alongPath(path, f) {
  let d = Math.max(0, Math.min(1, f)) * path.len;
  const P = path.pts;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], l = Math.hypot(b.x - a.x, b.z - a.z);
    if (d <= l || i === P.length - 1) { const t = l ? Math.min(1, d / l) : 1; return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, ry: Math.atan2(b.x - a.x, b.z - a.z) }; }
    d -= l;
  }
  return { x: P[0].x, z: P[0].z, ry: 0 };
}

// ---------- Прогресс между партиями: звания, достижения, облики ----------
// звание — по опыту: победы ×30, игры ×5, лидерство ×20, задания тёмных ролей ×10 и опыт достижений
export const RANKS = [
  { name: 'Новобранец', xp: 0 }, { name: 'Легионер', xp: 60 }, { name: 'Опцион', xp: 160 }, { name: 'Центурион', xp: 320 },
  { name: 'Трибун', xp: 560 }, { name: 'Легат', xp: 900 }, { name: 'Консул', xp: 1400 }, { name: 'Император', xp: 2200 },
];
export function rankOf(xp) {
  let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const n = RANKS[i + 1];
  return { name: RANKS[i].name, xp: RANKS[i].xp, next: n ? n.name : null, nextXp: n ? n.xp : null, i };
}
// достижения: tier 1–4 (бронза, серебро, золото, легенда) — чем сложнее, тем больше опыта (xp) и ауреусов (au)
const TIER = { 1: [15, 10], 2: [40, 25], 3: [90, 60], 4: [200, 150] };
const T = (p, k) => (p.total && p.total[k]) || 0, BEST = (p, k) => (p.best && p.best[k]) || 0, RW = (p, r) => (p.roleWins && p.roleWins[r]) || 0;
const A = (id, icon, name, desc, tier, fn, target, group) => ({ id, icon, name, desc, tier, xp: TIER[tier][0], au: TIER[tier][1], group, test: (p) => fn(p) >= target, prog: [fn, target] });
export const ACHIEVEMENTS = [
  // весёлые и лёгкие — берутся почти сразу
  A('first', '🏝', 'Высадка', 'Сыграть первую партию', 1, (p) => p.games || 0, 1, 'Для начала'),
  A('oops', '💀', 'Ой, всё', 'Погибнуть в первый раз', 1, (p) => T(p, 'deaths'), 1, 'Для начала'),
  A('sandman', '⛏', 'Песочный человек', 'Добыть 30 ресурсов', 1, (p) => T(p, 'gather'), 30, 'Для начала'),
  A('fish1', '🎣', 'Клюёт!', 'Поймать первую рыбу', 1, (p) => T(p, 'fish'), 1, 'Для начала'),
  A('boar1', '🐗', 'Гроза кабанов', 'Убить первого зверя', 1, (p) => T(p, 'beasts'), 1, 'Для начала'),
  A('tourist', '🥾', 'Турист с картой', 'Пройти 1500 м за партию', 1, (p) => BEST(p, 'dist'), 1500, 'Для начала'),
  A('stash', '📦', 'Хомяк', 'Сдать на Склад 20 ресурсов', 1, (p) => T(p, 'deposit'), 20, 'Для начала'),
  A('loser', '🤷', 'Главное — участие', 'Проиграть 2 партии', 1, (p) => (p.games || 0) - (p.wins || 0), 2, 'Для начала'),
  A('builder1', '🔨', 'Прораб', 'Внести 20 ресурсов в стройки', 1, (p) => T(p, 'build'), 20, 'Для начала'),
  A('vet25', '🧭', 'Бывалый', 'Сыграть 10 партий', 2, (p) => p.games || 0, 10, 'Путь'),
  A('vet100', '🏺', 'Старожил острова', 'Сыграть 40 партий', 3, (p) => p.games || 0, 40, 'Путь'),
  A('win1', '🏆', 'Первая победа', 'Победить в партии', 1, (p) => p.wins || 0, 1, 'Путь'),
  A('win10', '🥈', 'Пять триумфов', 'Победить 5 раз', 2, (p) => p.wins || 0, 5, 'Путь'),
  A('win50', '🥇', 'Триумфатор', 'Победить 25 раз', 4, (p) => p.wins || 0, 25, 'Путь'),
  A('clean5', '🛡', 'Без единой царапины', '2 победы, ни разу не погибнув в партии', 3, (p) => T(p, 'cleanWins'), 2, 'Путь'),
  A('leader1', '👑', 'Глас народа', 'Стать лидером поселения', 1, (p) => T(p, 'leader'), 1, 'Власть'),
  A('leader10', '🏛', 'Отец поселения', 'Стать лидером 5 раз', 3, (p) => T(p, 'leader'), 5, 'Власть'),
  A('jail5', '⛓', 'Завсегдатай тюрьмы', 'Попасть на остров тюремщиков 3 раза', 2, (p) => T(p, 'jailed'), 3, 'Власть'),
  A('slave3', '🪢', 'Несломленный', 'Выполнить 3 задания раба', 2, (p) => T(p, 'slaveTasks'), 3, 'Власть'),
  A('dark10', '🌑', 'Тень острова', 'Выполнить 5 заданий тёмных ролей', 2, (p) => T(p, 'darkTasks'), 5, 'Тьма'),
  A('dark40', '🕷', 'Повелитель интриг', 'Выполнить 20 заданий тёмных ролей', 4, (p) => T(p, 'darkTasks'), 20, 'Тьма'),
  A('kill10', '🗡', 'Кровавая слава', 'Убить 5 поселенцев', 2, (p) => T(p, 'kills'), 5, 'Тьма'),
  A('secret50', '🎭', 'Мастер тайных дел', '20 тайных действий', 3, (p) => T(p, 'secrets'), 20, 'Тьма'),
  A('detective3', '🔎', 'Око Рима', '2 победы Сыщиком', 2, (p) => RW(p, 'detective'), 2, 'Роли'),
  A('heir3', '🟣', 'Наследник пурпура', '2 победы Сыном императора', 2, (p) => RW(p, 'heir'), 2, 'Роли'),
  A('explorer3', '🗺', 'Первопроходец', '2 победы Исследователем', 2, (p) => RW(p, 'explorer'), 2, 'Роли'),
  A('impostor3', '🔧', 'Тень диверсий', '2 победы Диверсантом', 3, (p) => RW(p, 'impostor'), 2, 'Роли'),
  A('warlock3', '🔮', 'Повелитель тьмы', '2 победы Колдуном', 3, (p) => RW(p, 'warlock'), 2, 'Роли'),
  A('smuggler3', '🏴‍☠️', 'Король контрабанды', '2 победы Контрабандистом', 3, (p) => RW(p, 'smuggler'), 2, 'Роли'),
  A('instigator3', '📜', 'Мастер раздоров', '2 победы Подстрекателем', 3, (p) => RW(p, 'instigator'), 2, 'Роли'),
  A('spy3', '🐍', 'Кинжал Карфагена', '2 победы Шпионом Карфагена', 3, (p) => RW(p, 'spy'), 2, 'Роли'),
  A('tamer3', '🐘', 'Властелин зверей', '2 победы Приручителем', 3, (p) => RW(p, 'tamer'), 2, 'Роли'),
  A('allroles', '🌟', 'Многоликий', 'Победить хотя бы раз каждой из 9 ролей', 4, (p) => ['explorer', 'detective', 'heir', 'impostor', 'warlock', 'smuggler', 'instigator', 'spy', 'tamer'].filter((r) => RW(p, r) > 0).length, 9, 'Роли'),
  A('tomb', '☥', 'Сын фараона', 'Откопать гробницу и стать Сыном фараона', 2, (p) => T(p, 'tomb'), 1, 'Тайны'),
  A('sarc3', '🪦', 'Носильщик фараона', 'Принести саркофаг в Лагерь 2 раза', 3, (p) => T(p, 'sarc'), 2, 'Тайны'),
  A('mummy', '🧟', 'Упокоитель мумий', 'Победить мумию фараона', 2, (p) => T(p, 'mummy'), 1, 'Тайны'),
  A('clues25', '🧩', 'Следопыт', 'Найти 10 улик', 2, (p) => T(p, 'clues'), 10, 'Тайны'),
  A('beasts15', '🦁', 'Гроза зверей', 'Убить 10 зверей за одну партию', 2, (p) => BEST(p, 'beasts'), 10, 'Остров'),
  A('beasts200', '🏹', 'Великий охотник', 'Убить 60 зверей всего', 3, (p) => T(p, 'beasts'), 60, 'Остров'),
  A('build120', '🏗', 'Великий зодчий', 'Внести 80 ресурсов в стройки за партию', 2, (p) => BEST(p, 'build'), 80, 'Остров'),
  A('build2000', '🏰', 'Строитель империи', 'Внести 600 ресурсов в стройки всего', 3, (p) => T(p, 'build'), 600, 'Остров'),
  A('fish50', '🐟', 'Рыбак Нептуна', 'Поймать 15 рыб', 2, (p) => T(p, 'fish'), 15, 'Остров'),
  A('voy10', '⛵', 'Владыка морей', 'Отправить 4 рейса в Рим', 2, (p) => T(p, 'voyages'), 4, 'Остров'),
  A('rich', '💰', 'Богач', 'Заработать 300 денариев за партию', 2, (p) => BEST(p, 'money'), 300, 'Остров'),
  A('walker', '👣', 'Неутомимый', 'Пройти 4000 м за партию', 1, (p) => BEST(p, 'dist'), 4000, 'Остров'),
  A('lvl8', '⭐', 'Опытный', 'Достичь 6-го уровня в партии', 2, (p) => BEST(p, 'lvl'), 6, 'Остров'),
  A('glad3', '🏟', 'Любимец арены', '2 победы на арене', 2, (p) => T(p, 'glad'), 2, 'Арена'),
  A('rudis', '🪵', 'Рудиарий', 'Получить рудис — деревянный меч свободы', 3, (p) => T(p, 'rudis'), 1, 'Арена'),
  A('ko10', '💥', 'Гроза Колизея', 'Повергнуть 5 соперников на арене', 3, (p) => T(p, 'gladKO'), 5, 'Арена'),
];
// облики персонажа: покупаются за ауреусы, меняются в лобби до начала игры
export const SKINS = [
  { id: 'none', name: 'Обычный поселенец', price: 0, desc: 'Простая туника и красный плащ.' },
  // дешёвые и забавные — почти сразу
  { id: 'shepherd', name: 'Пастух с козьей шапкой', price: 10, desc: 'Пушистая шапка и посох за спиной.', wool: 0xf1ead8, staff: true, cape: 0x8a6a48 },
  { id: 'fisher', name: 'Рыбак-неудачник', price: 15, desc: 'Соломенная шляпа, сеть через плечо и рыбина на поясе.', straw: true, netBack: true, fishBelt: true, cape: 0x3d6b7a },
  { id: 'pirate', name: 'Пират Киликии', price: 25, desc: 'Бандана, повязка на глаз и серьга.', bandana: 0xb01c1c, eyepatch: true, earring: true, cape: 0x2b2b2b },
  { id: 'chef', name: 'Повар лагеря', price: 30, desc: 'Высокий колпак и половник на поясе.', chefHat: true, ladle: true, cape: 0xe8e0d0 },
  { id: 'bluecape', name: 'Синий плащ', price: 40, desc: 'Плащ цвета моря с серебряной фибулой.', cape: 0x2e5fb8, capeTrim: 0xc9ced6 },
  { id: 'laurel', name: 'Лавровый венок', price: 70, desc: 'Зелёный венок победителя с лентами.', laurel: 0x6f9c2f, ribbons: 0xf3efe4 },
  { id: 'plume', name: 'Шлем легионера', price: 120, desc: 'Бронзовый шлем с гребнем и нащёчниками.', helm: 0xc9a74a, crest: 0xb01c1c },
  { id: 'sailor', name: 'Мореход', price: 140, desc: 'Полосатая повязка, синий плащ и якорь-подвеска.', cape: 0x1f4f88, band: 0xf3efe4, anchor: true },
  { id: 'nomad', name: 'Кочевник пустыни', price: 180, desc: 'Песочный капюшон и платок.', hood: 0xcdb27a, cape: 0xa88a52, scarf: 0xb85a2a },
  { id: 'centurion', name: 'Центурион', price: 260, desc: 'Поперечный гребень, серебряный нагрудник с фалерами.', helm: 0xbfc5cc, crest: 0xb01c1c, crestSide: true, chest: 0xbfc5cc, phalerae: true, rank: 'Центурион' },
  { id: 'pharaoh', name: 'Наследник фараона', price: 340, desc: 'Полосатый немес и золотой воротник.', nemes: true, collar: 0xd4af37, cape: 0x1f4fa0 },
  { id: 'shadow', name: 'Тень Карфагена', price: 400, desc: 'Чёрный капюшон, тёмный плащ и багровый платок.', hood: 0x1d1a22, cape: 0x2a1030, scarf: 0x6a1020 },
  { id: 'gold', name: 'Золотой триумфатор', price: 600, desc: 'Золотой венок, нагрудник и пурпурный плащ с золотой каймой.', laurel: 0xd4af37, chest: 0xd4af37, cape: 0x6a1b9a, capeTrim: 0xd4af37, sash: 0x7b1fa2, glow: 0xffd36b, rank: 'Легат' },
  { id: 'emperor', name: 'Император', price: 1000, desc: 'Тирийский пурпур с головы до пят: пурпурная тога, плащ, ленты венка — и золото.', laurel: 0xd4af37, ribbons: 0x7b1fa2, chest: 0xd4af37, cape: 0x6a1b9a, capeTrim: 0xd4af37, collar: 0xd4af37, sash: 0x7b1fa2, toga: 0x7b1fa2, glow: 0xd08aff, rank: 'Император' },
];
