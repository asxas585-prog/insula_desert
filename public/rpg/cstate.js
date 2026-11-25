// Общее состояние клиента и связь с сервером
export const S = {
  myId: null, seed: null, char: null, world: null, blds: [], roster: new Map(), st: null, dev: false,
  me: { x: 0, z: 0, y: 0, ry: 0, alive: true, hp: 100, mhp: 100, st: 100, mst: 100, sat: 100 },
  inst: null, ship: null, seat: null, nodes: {}, chests: {}, panel: null, placing: null, started: false,
  serverT: 0, timeAt: 0,
};
let ws = null;
export function connect(onMsg, onClose) {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/rpg');
  ws.onmessage = (ev) => { if (typeof ev.data === 'string') onMsg(JSON.parse(ev.data)); };
  ws.onclose = onClose;
  return new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
}
export const net = (m) => ws && ws.readyState === 1 && ws.send(JSON.stringify(m));
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const hexCss = (h) => '#' + (h >>> 0).toString(16).padStart(6, '0');
export const fmtT = (sec) => { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
