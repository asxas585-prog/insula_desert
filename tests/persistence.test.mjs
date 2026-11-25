import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('catch, office points and reserved identifiers survive restart',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'insula-wreck-'));
  try{
    fs.writeFileSync(path.join(directory,'rpg-chars.json'),JSON.stringify({c11111:{id:'c11111',name:'Legacy',items:[],tunaCarry:{id:2000000,kg:116},officePoints:{messana:20},doneQuests:[2097152],warRent:[{id:1048576,type:'inf',rent:true}],sunk:[{id:987654,type:'scapha',name:'Saved wreck'}]}}));
    const source="import {G,loadAll,saveAll,nid} from './rpg/state.js';loadAll();G.W.ships.push({id:700,type:'barca',x:0,z:0,ry:0,owner:'c11111',hp:260,maxHp:260,cargo:{},tunaHold:[{id:2000001,kg:148},null]});saveAll();loadAll();console.log(JSON.stringify({tunaCarry:G.chars.c11111.tunaCarry,officePoints:G.chars.c11111.officePoints,done:G.chars.c11111.doneQuests,hold:G.W.ships.find(s=>s.id===700).tunaHold,next:nid(),wreck:G.chars.c11111.sunk[0],rental:G.chars.c11111.warRent[0]}));";
    const child=spawnSync(process.execPath,['--input-type=module','-e',source],{cwd:new URL('..',import.meta.url),env:{...process.env,DATA_DIR:directory},encoding:'utf8',timeout:90000});
    assert.equal(child.status,0,child.stderr);
    const result=JSON.parse(child.stdout.trim().split('\n').at(-1));
    assert(result.next>2097152,'new ship and entity identifiers must not collide with a saved wreck');
    assert.deepEqual(result.hold,[{id:2000001,kg:148},null]);assert.equal(result.tunaCarry.kg,116);assert.equal(result.officePoints.messana,20);assert.deepEqual(result.done,[2097152]);
    assert.equal(result.rental.id,1048576);assert.equal(result.wreck.id,987654);assert.equal(result.wreck.name,'Saved wreck');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
