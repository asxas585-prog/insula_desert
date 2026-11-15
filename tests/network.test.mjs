import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn,spawnSync } from 'node:child_process';
import { once } from 'node:events';
import WebSocket from 'ws';
import { verifySecret } from '../rpg/auth.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('HTTP, authentication, malformed input, public ids and defaults', {timeout:120000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'insula-network-'));
 fs.writeFileSync(path.join(directory,'rpg-chars.json'),JSON.stringify({c11111:{id:'c11111',name:'Legacy',den:777,items:[],gear:{},x:null,z:null}}));
 const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,DATA_DIR:directory,PORT:String(port),EXTRA_PORT:'0',DEV:'0',CHEATS:'0',FAST:'0'},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);const sockets=[];
 t.after(async()=>{for(const ws of sockets)ws.terminate();child.kill('SIGTERM');await Promise.race([once(child,'exit'),pause(3000)]);if(child.exitCode===null)child.kill('SIGKILL');fs.rmSync(directory,{recursive:true,force:true});});
 for(let i=0;i<900&&!logs.includes('http://localhost:');i++){if(child.exitCode!==null)throw new Error(logs);await pause(100);}
 assert.match(logs,/http:\/\/localhost:/,'server failed to become ready: '+logs);
 const address=`http://127.0.0.1:${port}`;
 async function login(data){const ws=new WebSocket(`ws://127.0.0.1:${port}/rpg`),messages=[];sockets.push(ws);ws.on('message',b=>messages.push(JSON.parse(b)));await once(ws,'open');ws.send('null');ws.send(JSON.stringify(data));for(let i=0;i<100&&!messages.some(m=>['char','error'].includes(m.type));i++)await pause(50);return{ws,messages};}
 await t.test('current game, health and removed classic routes',async()=>{assert.equal((await fetch(address+'/healthz')).status,200);assert.equal((await fetch(address)).status,200);assert.equal((await fetch(address+'/classic')).status,404);});
 const owner=await login({type:'join',code:'77777',password:'correct-password-77777',name:'Owner'});
 await t.test('named account requires correct password',async()=>{assert(owner.messages.some(m=>m.type==='char'));const bad=await login({type:'join',code:'77777',password:'wrong-password',name:'Intruder'});assert.match(bad.messages.find(m=>m.type==='error')?.text,/пароль/);assert.equal(owner.ws.readyState,WebSocket.OPEN);});
 await t.test('malformed message does not crash game',async()=>{assert.equal((await fetch(address+'/healthz')).status,200);assert(!logs.includes('так_т'));});
 await t.test('public packet does not contain password hash',()=>{const raw=JSON.stringify(owner.messages);assert(!raw.includes('"auth"'));assert(!raw.includes('correct-password-77777'));});
 await t.test('legacy account cannot be claimed with a new arbitrary password',async()=>{const legacy=await login({type:'join',code:'11111',password:'some-new-password'});assert.match(legacy.messages.find(m=>m.type==='error')?.text,/администратора/);});
 await t.test('guest public id is not its login token',async()=>{const token='a2b3c4d5'.repeat(8),guest=await login({type:'join',token,name:'Guest'}),c=guest.messages.find(m=>m.type==='char')?.c;assert(c?.id.startsWith('g'));assert(!JSON.stringify(guest.messages).includes(token));const attacker=await login({type:'join',token:c.id,name:'Impostor'});assert.notEqual(attacker.messages.find(m=>m.type==='char')?.c.id,c.id);assert.equal(guest.ws.readyState,WebSocket.OPEN);});
 await t.test('cheats are disabled in ordinary production mode',async()=>{const before=owner.messages.filter(m=>m.type==='char').at(-1).c.den;owner.ws.send(JSON.stringify({type:'chat',text:'AURUM 1000'}));await pause(350);assert.equal(owner.messages.filter(m=>m.type==='char').at(-1).c.den,before);});
 await t.test('guild is available in Messana on a fresh world',()=>{const guild=owner.messages.find(m=>m.type==='blds').list.find(b=>b.type==='collegium'&&b.city==='messana');assert(guild?.built);assert(!guild.enemy);});
});
test('administrator recovery preserves legacy character and backs up data',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'insula-recovery-')),file=path.join(directory,'rpg-chars.json');
 try{fs.writeFileSync(file,JSON.stringify({c12345:{id:'c12345',den:912,home:22}}));const run=spawnSync(process.execPath,['tools/reset-login.mjs','c12345'],{cwd:new URL('..',import.meta.url),env:{...process.env,DATA_DIR:directory},input:'new-secure-password\n',encoding:'utf8'});assert.equal(run.status,0,run.stderr);const c=JSON.parse(fs.readFileSync(file)).c12345;assert.equal(c.den,912);assert.equal(c.home,22);assert(verifySecret(c.auth,'new-secure-password'));assert(fs.readdirSync(directory).some(n=>n.includes('before-auth-')));assert(!run.stdout.includes('new-secure-password'));}finally{fs.rmSync(directory,{recursive:true,force:true});}
});
