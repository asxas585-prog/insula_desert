// Offline administrator recovery: stop server, back up data, then pipe new password on stdin.
import fs from 'node:fs';
import path from 'node:path';
import { passwordRecord } from '../rpg/auth.js';
const id = process.argv[2], dir = process.env.DATA_DIR;
if (!id || !dir) throw new Error('DATA_DIR=/data node tools/reset-login.mjs c12345 < password-file (server stopped)');
const password = fs.readFileSync(0, 'utf8').trim();
if (password.length < 10 || password.length > 128) throw new Error('Password must contain 10–128 characters');
const file = path.join(dir, 'rpg-chars.json'), chars = JSON.parse(fs.readFileSync(file));
if (!chars[id]) throw new Error('Character not found');
fs.copyFileSync(file, file + '.before-auth-' + Date.now());
chars[id].auth = passwordRecord(password);
fs.writeFileSync(file + '.tmp', JSON.stringify(chars)); fs.renameSync(file + '.tmp', file);
console.log('Login credentials updated for', id);
