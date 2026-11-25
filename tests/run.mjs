import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insula-tests-'));
process.env.DATA_DIR = testDir;
try { await import('./features.mjs'); }
finally { fs.rmSync(testDir, { recursive: true, force: true }); }
