import {arenaSeat,arenaLeave} from '../rpg/seating.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {G,D,WG,newChar,now,announce} from '../rpg/state.js';
import {onMove} from '../rpg/game.js';
import {movementAllowance} from '../rpg/movement.js';
import {horseMaxSpeed,horseMotion} from '../public/rpg/rules.js';
import * as EC from '../rpg/economy.js';
import * as SO from '../rpg/society.js';
import * as CP from '../rpg/campaign.js';
import {buyRank} from '../rpg/land.js';
import {tunaTick,tunaWaterAllowed} from '../rpg/tuna.js';
const world=WG.generateWorld(9001),C=world.cities[0];
function setup(){
 G.world=world;G.players.clear();G.mobs.clear();G.eships.clear();G.chars={};G.arena=null;G.tuna=new Map();G.harpoons=new Map();G.tunaSpawnAt=Infinity;
 G.W={time:Array.from({length:D.CFG.dayLength},(_,i)=>i).find(t=>D.buyerOpen(t)),day:1,story:0,flags:{},chronicle:[],treasury:10000,offices:{},cityOff:{},cityState:Object.fromEntries(world.cities.map(c=>[c.id,{owner:c.owner,def:100,tasks:{}}])),buildings:world.cities.flatMap(c=>c.layout.map((b,i)=>({...b,id:c.id+':'+i,city:c.id,built:true,hp:100,maxHp:100,store:{},slaves:[],cost:{},contrib:{},enemy:false,muni:c.id+':'+i}))),nodes:{},ships:[],slaves:[],events:[],market:{},laws:{},favor:50,storage:{},quests:[],trophies:[],camps:{}};
 const make=(id)=>{const c=newChar('c'+id,'Игрок '+id,D.COLORS[0]);G.chars[c.id]=c;c.den=10000;const messages=[];const p={id,char:c,x:C.x,z:C.z,y:2,ry:0,alive:true,hp:100,st:100,inst:null,buffs:{},lastMv:now(),messages,ws:{readyState:1,send:s=>messages.push(JSON.parse(s))}};G.players.set(id,p);return p;};
 const p=make(1),other=make(2);other.x=-2000;other.z=2000;other.inst='distant-instance';return{p,other};
}
const check=(name,fn)=>test(name,()=>fn(setup()));
function mounted(p,kind='numida'){p.mounted=true;p.char.horses=[{id:777,kind,sat:100}];p.char.horseOut=777;}
function announcements(p,kind){return p.messages.filter(m=>m.type==='announcement'&&m.kind===kind);}
check('lance can actually be bought in an ordinary smith stall',({p})=>{G.W.buildings=[{id:300,type:'stall',cls:4,x:p.x,z:p.z,built:true,owner:null}];assert(EC.shopList(p).gear.includes('lance'));const before=p.char.den;EC.buy(p,'lance',1);assert(p.char.items.some(i=>i.k==='lance'));assert(p.char.den<before);});
check('lance can be bought at the city buyer without a fleet event',({p})=>{G.W.buildings=[{id:300,type:'mercator',x:p.x,z:p.z,built:true}];assert.equal(EC.MARKET_GEAR,D.MARKET_GEAR);assert(EC.shopList(p).gear.includes('lance'));G.W.time=Array.from({length:D.CFG.dayLength},(_,i)=>i).find(t=>D.buyerOpen(t));assert(D.buyerOpen(G.W.time));EC.buy(p,'lance',1);assert(p.char.items.some(i=>i.k==='lance'));});
check('announcements reach every online player including distant instances',({p,other})=>{announce('games','Тест игр');for(const q of [p,other]){assert.equal(announcements(q,'games').length,1);assert.equal(q.messages.filter(m=>m.type==='log').length,1);}});
check('arena games start from the enlarged stands in either city and announce once',({p,other})=>{const b=G.W.buildings.find(b=>b.type==='amphitheatrum'&&b.city==='syracusae');Object.assign(p,{x:b.x+65,z:b.z});SO.arenaStart(p);assert.equal(G.arena.bid,b.id);assert.equal(G.arena.rx,32.4);assert.equal(announcements(other,'games').length,1);SO.arenaStart(p);assert.equal(announcements(other,'games').length,1);});
check('city capture announces to distant players',({other})=>{CP.capture(world.cities.find(c=>c.id==='tyndaris'));assert.equal(announcements(other,'capture').length,1);});
check('civil title is announced only after a successful purchase',({p,other})=>{const curia=G.W.buildings.find(b=>b.type==='curia'&&b.city===C.id);Object.assign(p,{x:curia.x,z:curia.z});p.char.dig=D.RANKS[1].dig;p.char.rankBought=0;p.char.den=0;buyRank(p);assert.equal(announcements(other,'title').length,0);p.char.den=10000;buyRank(p);assert.equal(announcements(other,'title').length,1);});
check('completing a colony sends its announcement to distant players',({p,other})=>{const island=D.ISLANDS.find(i=>D.COLONY_RES[i.id]);assert(island);const b={id:900,type:'colonia',x:p.x,z:p.z,owner:p.char.id,island:island.id,cost:{},contrib:{},maxHp:100,store:{},slaves:[]};G.W.buildings.push(b);EC.completeBuilding(b,p);assert(b.built);assert.equal(announcements(other,'colony').length,1);});
check('tuna catch is global and does not repeat on the next tick',({p,other})=>{const port=G.W.buildings.find(b=>b.type==='portus');let point;for(let r=140;r<300&&!point;r+=10)for(let k=0;k<24;k++){const x=port.x+Math.sin(k*Math.PI/12)*r,z=port.z+Math.cos(k*Math.PI/12)*r;if(tunaWaterAllowed(x,z)&&tunaWaterAllowed(x,z-5)){point={x,z};break;}}assert(point);const s={id:900,type:'barca',owner:p.char.id,...point,speed:0,tunaHold:[null,null]};G.W.ships=[s];p.ship=s.id;G.tuna.set(800,{id:800,x:s.x,z:s.z-5,home:point,kg:140,born:now(),hooked:p.id});p.harpoon={sid:s.id,fid:800,progress:.999,tension:.2,pulling:true,start:now()};tunaTick(.1);assert.equal(announcements(other,'tuna').length,1);tunaTick(.1);assert.equal(announcements(other,'tuna').length,1);});
check('maximum riding speeds match prediction for every breed and hunger state',()=>{for(const kind of Object.keys(D.HORSES))for(const hungry of [false,true]){let speed=0;for(let i=0;i<250;i++)speed=horseMotion(speed,0,0,true,true,kind,.05,hungry).speed;assert(Math.abs(speed-horseMaxSpeed(kind,true,hungry))<.001);}});
check('two seconds of delayed horse packets can arrive in one burst without rollback',({p})=>{mounted(p);const start=p.x,t=p.lastMv+1.8,speed=horseMaxSpeed('numida');for(let i=1;i<=27;i++)onMove(p,{x:start+speed*i/15,z:p.z,ry:Math.PI/2,run:true},t);assert.equal(p.messages.filter(m=>m.type==='teleport').length,0);assert(Math.abs(p.x-start-speed*1.8)<.01);});
check('long pauses do not grant unbounded instant movement',({p})=>{mounted(p);const start=p.x;onMove(p,{x:start+100,z:p.z},p.lastMv+600);assert.equal(p.x,start);assert.equal(p.messages.filter(m=>m.type==='teleport').length,1);});
check('many packets without elapsed time cannot bypass speed limits',({p})=>{mounted(p);const x=p.x,t=p.lastMv;for(let i=1;i<100;i++)onMove(p,{x:x+i,z:p.z},t);assert(p.x-x<5);assert(p.messages.some(m=>m.type==='teleport'));assert.equal(p.moveSpeed,0);});
check('movement allowance uses elapsed server time with a finite two-second capacity',()=>{const p={lastMv:0};movementAllowance(p,100,10);assert.equal(p.moveCredit,20.75);p.moveCredit=0;movementAllowance(p,100,10);assert.equal(p.moveCredit,0);movementAllowance(p,100.5,10);assert.equal(p.moveCredit,5);});

check('successful city assault announces globally once',({p,other})=>{const c=world.cities.find(c=>c.id==='tyndaris');Object.assign(p,{x:c.x,z:c.z});G.W.cityState[c.id].def=0;CP.assault(p,c.id);assert.equal(announcements(other,'siege').length,1);CP.assault(p,c.id);assert.equal(announcements(other,'siege').length,1);});

check('server-authorized seating works across the entire arena diameter and dismounts atomically',({p})=>{
 const b=G.W.buildings.find(b=>b.type==='amphitheatrum'&&b.city==='messana'),cs=Math.cos(b.ry),sn=Math.sin(b.ry);
 for(let i=0;i<32;i++){Object.assign(p,{x:b.x+cs*68,z:b.z-sn*68});mounted(p);const seat=arenaSeat(p,{bid:b.id,angle:i*Math.PI/16,tier:10});assert(seat);assert(!p.mounted);onMove(p,{...seat,pj:1,jh:p.jh},p.lastMv+.01);assert(!p.messages.some(m=>m.type==='teleport'));assert.equal(p.x,seat.x);}
});
check('seating refuses remote, dead, sailing and malformed requests',({p})=>{
 const b=G.W.buildings.find(b=>b.type==='amphitheatrum'),m={bid:b.id,angle:1,tier:5};Object.assign(p,{x:b.x+1000,z:b.z});assert.equal(arenaSeat(p,m),null);Object.assign(p,{x:b.x,z:b.z,alive:false});assert.equal(arenaSeat(p,m),null);p.alive=true;p.ship=1;assert.equal(arenaSeat(p,m),null);p.ship=null;assert.equal(arenaSeat(p,{...m,angle:NaN}),null);assert.equal(arenaSeat(p,{...m,tier:99}),null);assert(!p.messages.some(m=>m.type==='arenaSeated'));
});

check('leaving the opposite stand and immediately mounting does not cause a position rollback',({p})=>{
 const b=G.W.buildings.find(b=>b.type==='amphitheatrum');Object.assign(p,{x:b.x,z:b.z});const seat=arenaSeat(p,{bid:b.id,angle:Math.PI+.6,tier:10});assert(seat);assert(arenaLeave(p));mounted(p);onMove(p,{x:seat.ox+.1,z:seat.oz,y:p.y},p.lastMv+.05);assert.equal(p.messages.filter(m=>m.type==='teleport').length,0);assert.equal(p.arenaSeat,null);assert.equal(arenaLeave(p),false);
});
