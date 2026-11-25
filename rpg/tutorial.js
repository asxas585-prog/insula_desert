import { G, D, dist, send } from './state.js';
export function tradeStep(p, stage) {
  const before = p.char.tradeTutorial || 0;
  if (stage <= before || (stage > 1 && before < stage - 1)) return;
  p.char.tradeTutorial = stage; p.dirtyChar = true;
  send(p, { type:'log', text: ['','Торговля: гильдия найдена. Соберите ящик припасов.','Ящик готов. Погрузите его на свой корабль через G.','Груз на борту. Доставьте его к торговцу.','Торговец найден. Продайте ящик из трюма.','Первая торговая поставка завершена!'][stage], kind:'good' });
}
export function tradeVisit(p, m) {
  if (m.bid) { const b=G.W.buildings.find(b=>b.id===m.bid&&b.type==='collegium'&&b.built&&!b.ruined&&!b.enemy);if(b&&dist(p,b)<D.BUILDINGS.collegium.r+8)tradeStep(p,1); }
  if (m.tid) { const t=G.world.traders.find(t=>t.id===m.tid);if(t&&dist(p,t)<(t.rome?170:50))tradeStep(p,4); }
}
