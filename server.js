// Insula Deserta: Империя — сервер постоянного мира RPG.
import http from 'http';
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { startRpg, saveAll as rpgSave } from './rpg/game.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DEV = process.env.DEV === '1' || process.argv.includes('--dev');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
const fileCache = new Map();
function handleHttp(req, res) {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); res.end(); return; }
  // проверка «жив ли сервер» для хостингов
  if (url === '/health' || url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  // Главная страница — RPG «Империя». Классическая игра удалена.
  const rel = path.normalize(url === '/' ? 'rpg/index.html' : url).replace(/^([/\\])+/, '').replace(/^(\.\.[/\\])+/, '');
  const file = path.join(__dirname, 'public', rel);
  if (!file.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); res.end(); return; }
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const ext = path.extname(file);
  const vendor = rel.startsWith('vendor') || rel.startsWith('addons');
  const reply = (entry) => {
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': vendor ? 'public, max-age=604800' : 'no-cache', Vary: 'Accept-Encoding' };
    if (gz && entry.gz) { headers['Content-Encoding'] = 'gzip'; res.writeHead(200, headers); res.end(entry.gz); }
    else { res.writeHead(200, headers); res.end(entry.raw); }
  };
  const cached = fileCache.get(file);
  if (cached && (vendor || !DEV)) return reply(cached);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const entry = { raw: data, gz: ['.js', '.html', '.css', '.txt'].includes(ext) && data.length > 1024 ? zlib.gzipSync(data, { level: 9 }) : null };
    fileCache.set(file, entry);
    reply(entry);
  });
}
// сжатие сообщений (permessage-deflate): состояние игры — JSON, сжимается в 5–10 раз
const wssRpg = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: { threshold: 256, zlibDeflateOptions: { level: 3 }, serverNoContextTakeover: false, clientNoContextTakeover: true } });
const servers = [];
function startHttp(port, main) {
  const srv = http.createServer(handleHttp);
  srv.on('upgrade', (req, socket, head) => {
    const endpoint = (req.url || '').split('?')[0];
    if (endpoint !== '/rpg' && endpoint !== '/rpg/') {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    wssRpg.handleUpgrade(req, socket, head, (ws) => wssRpg.emit('connection', ws, req));
  });
  srv.on('error', (e) => {
    if (main) { console.error(`Не удалось открыть порт ${port}:`, e.message); process.exit(1); }
    else console.log(`(дополнительный порт ${port} недоступен: ${e.code} — это не страшно)`);
  });
  srv.listen(port, '0.0.0.0', () => console.log(main
    ? `Insula Deserta: Империя — http://localhost:${port} ${DEV ? '[DEV]' : ''}`
    : `Также слушаю порт ${port}`));
  servers.push(srv);
}


startRpg(wssRpg);
startHttp(PORT, true);
// на хостингах (Amvera и др.) дополнительно слушаем порт 80 — их порт по умолчанию.
// Отключить: EXTRA_PORT=0
const EXTRA_PORT = Number(process.env.EXTRA_PORT ?? (process.platform === 'linux' ? 80 : 0));
if (EXTRA_PORT && EXTRA_PORT !== PORT) startHttp(EXTRA_PORT, false);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  console.log(`Получен сигнал ${sig}: хостинг или пользователь останавливает сервер.`);
  try { rpgSave(); } catch (e) { console.error(e); }
  for (const s of servers) s.close();
  process.exit(0);
});
