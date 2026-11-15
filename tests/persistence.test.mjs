import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('wreck and rented squad identifiers stay reserved after restart',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'insula-wreck-'));
  try{
    fs.writeFileSync(path.join(directory,'rpg-chars.json'),JSON.stringify({c11111:{id:'c11111',name:'Legacy',items:[],warRent:[{id:1048576,type:'inf',rent:true}],sunk:[{id:987654,type:'scapha',name:'Saved wreck'}]}}));
    const source="import {G,loadAll,nid} from './rpg/state.js';loadAll();console.log(JSON.stringify({next:nid(),wreck:G.chars.c11111.sunk[0],rental:G.chars.c11111.warRent[0]}));";
    const child=spawnSync(process.execPath,['--input-type=module','-e',source],{cwd:new URL('..',import.meta.url),env:{...process.env,DATA_DIR:directory},encoding:'utf8',timeout:90000});
    assert.equal(child.status,0,child.stderr);
    const result=JSON.parse(child.stdout.trim().split('\n').at(-1));
    assert(result.next>1048576,'new ship and entity identifiers must not collide with a saved wreck');
    assert.equal(result.rental.id,1048576);assert.equal(result.wreck.id,987654);assert.equal(result.wreck.name,'Saved wreck');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
