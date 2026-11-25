import crypto from 'node:crypto';
const attempts = new Map();
export function allowLogin(key, time = Date.now()) {
  if (attempts.size > 2000) for (const [k, v] of attempts) if (time - v.start > 60000) attempts.delete(k);
  let a = attempts.get(key);
  if (!a || time - a.start >= 60000) attempts.set(key, a = { start: time, n: 0 });
  return ++a.n <= (key.startsWith('ip:') ? 60 : 12);
}
export function passwordRecord(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(secret, salt, 32).toString('hex') };
}
export function verifySecret(record, secret) {
  if (!record?.salt || !/^[a-f0-9]{64}$/.test(record.hash || '') || typeof secret !== 'string' || secret.length > 256) return false;
  return crypto.timingSafeEqual(Buffer.from(record.hash, 'hex'), crypto.scryptSync(secret, record.salt, 32));
}
export function credentials(m, chars) {
  const code = /^\d{5}$/.test(String(m.code || '')) ? String(m.code) : null;
  const token = /^[a-z0-9]{16,128}$/i.test(String(m.token || '')) ? String(m.token) : null;
  if (code) return { id: 'c' + code, secret: typeof m.password === 'string' ? m.password : '', named: true };
  if (!token) return null;
  const legacy = chars['t' + token];
  return { id: legacy ? legacy.id : 'g' + crypto.createHash('sha256').update(token).digest('hex'), secret: legacy ? String(m.password || token) : token, named: false };
}
