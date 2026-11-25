import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'insula-tests-'));
try {
  const result=spawnSync(process.execPath,['--test',...fs.readdirSync(new URL('../tests/',import.meta.url)).filter(name=>name.endsWith('.test.mjs')).map(name=>'tests/'+name)],{cwd:new URL('..',import.meta.url),env:{...process.env,DATA_DIR:directory,DEV:'0',CHEATS:'0',FAST:'0'},stdio:'inherit'});
  process.exitCode=result.status??1;
} finally { fs.rmSync(directory,{recursive:true,force:true}); }
