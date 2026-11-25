import assert from 'node:assert/strict';
import fs from 'node:fs';
import { G, D, WG, newChar, slaveLimitOf, ensureCities, loadAll } from '../rpg/state.js';
import { planCrate, applyCratePlan } from '../public/rpg/crates.js';
import { cityWarehouses, warehouseMsg } from '../rpg/warehouses.js';
import * as T from '../rpg/trade.js';
import * as SO from '../rpg/society.js';
import * as GL from '../rpg/glad.js';
import * as CB from '../rpg/combat.js';
import * as NAV from '../rpg/nav.js';
import * as WAR from '../rpg/wargame.js';
import * as RT from '../rpg/routes.js';
import { inHarborZone, pirateWater } from '../rpg/harbors.js';
import { pairedArenaTarget } from '../rpg/arena-pairs.js';
const passed=[];
function ok(name,fn){fn();passed.push(name);}
function reset(){G.players.clear();G.mobs.clear();G.proj.clear();G.eships.clear();G.chars={};G.arena=null;G.W={buildings:[],ships:[],slaves:[],offices:{},laws:{},cityOff:{},cityState:{},events:[],day:1,time:0,treasury:100,flags:{},trophies:[],chronicle:[],camps:{},nodes:{}};G.world={cities:[],nodes:[],pois:[],dens:[],camps:[]};}
function player(){const c=newChar('audit','Test',D.COLORS[0]);c.level=12;c.den=10000;c.bag={};c.items=[];G.chars[c.id]=c;const messages=[];const p={id:1,char:c,x:0,z:0,hp:100,st:100,alive:true,buffs:{},ws:{readyState:1,send:s=>messages.push(JSON.parse(s))}};G.players.set(1,p);return {c,p,messages};}
reset();
ok('Tier 1: any crop and mixed crops',()=>{assert(planCrate('crate1',[{plank:1,olives:10}]).ok);assert(planCrate('crate1',[{plank:1,wheat:8,grapes:4}]).ok);assert(!planCrate('crate1',[{plank:1,iron:1000}]).ok);});
ok('Tier 2: products; raw crops excluded',()=>{assert(planCrate('crate2',[{plank:2,oil:8}]).ok);assert(!planCrate('crate2',[{plank:2,wheat:100}]).ok);});
ok('Tier 3: equipment quality, bound items and tools protected',()=>{assert(planCrate('crate3',[{plank:3}],[{uid:1,k:'hamata',q:0}]).ok);assert(!planCrate('crate3',[{plank:3}],[{uid:2,k:'rudis',q:3},{uid:3,k:'rod_master',q:3}]).ok);});
ok('Tier 4: rare goods; insufficient recipe does not mutate stocks',()=>{let stocks=[{plank:4,pearl:5}],p=planCrate('crate4',stocks);assert(p.ok);applyCratePlan(p,stocks);assert.equal(stocks[0].pearl,0);const a={plank:1,wheat:1},b=JSON.stringify(a);assert(!planCrate('crate1',[a]).ok);assert.equal(JSON.stringify(a),b);});
reset();let {p,c}=player();const guild={id:1,type:'collegium',x:0,z:0,city:'messana',built:true},own={id:2,type:'horreum_s',x:1,z:1,city:'messana',owner:c.id,built:true,store:{olives:10},items:[]},foreign={...own,id:3,owner:'other',store:{wheat:1000}},away={...own,id:4,city:'catana',store:{grapes:1000}};G.W.buildings=[guild,own,foreign,away];
ok('Guild: only own warehouses in the same city; mixed bag and storage',()=>{assert.deepEqual(cityWarehouses(c,guild).map(b=>b.id),[2]);c.bag={plank:1};T.crateMsg(p,{type:'crateCraft',k:'crate1'});assert.equal(c.carry,'crate1');assert.equal(own.store.olives,0);assert.equal(foreign.store.wheat,1000);assert.equal(away.store.grapes,1000);});
ok('Warehouse: gear transfer then crate assembly; equipped gear untouched',()=>{c.carry=null;c.bag={plank:3};c.items=[{uid:91,k:'hamata',q:0}];const before=c.gear.weapon;warehouseMsg(p,{type:'warehouseGear',bid:2,uid:91,dir:'in'});assert.equal(c.items.length,0);assert.equal(own.items.length,1);T.crateMsg(p,{type:'crateCraft',k:'crate3'});assert.equal(c.carry,'crate3');assert.equal(own.items.length,0);assert.equal(c.gear.weapon,before);});
ok('Buyer: 40 minute break in game clock, including midnight service',()=>{const gt=h=>h>=3?(h-3)/(23+55/60-3)*(2/3)*D.CFG.dayLength:(2/3)*D.CFG.dayLength+(h+24-(23+55/60))/(24-(23+55/60)+3)*(1/3)*D.CFG.dayLength;assert(D.buyerOpen(gt(11.99)));assert(!D.buyerOpen(gt(12.01)));assert(!D.buyerOpen(gt(12.65)));assert(D.buyerOpen(gt(12.68)));assert(D.buyerOpen(gt(1)));});
reset();({p,c}=player());const amph={id:9,type:'amphitheatrum',built:true,x:0,z:0,ry:0};G.W.buildings=[amph];const slave={id:20,owner:c.id,name:'Test Gladiator',grade:2,glvl:2,str:5,end:5};G.W.slaves=[slave];GL.gladMsg(p,{type:'gladBout',sid:20});
ok('Arena: minimum four, even count, different opening pairs, bot versus bot from start',()=>{const a=G.arena;assert(a);const fighters=[...G.mobs.values()];assert.equal(fighters.length,4);for(const m of fighters){assert(m.ffa);assert(m.arenaPair);assert.equal(G.mobs.get(m.arenaPair).arenaPair,m.id);assert.equal(pairedArenaTarget(m).id,m.arenaPair);}const bots=fighters.filter(m=>m.faction!=='rome');assert(bots.some(m=>G.mobs.get(m.arenaPair).faction!=='rome'));});
ok('Arena loss: XP and AP awarded; no victory money',()=>{const a=G.arena;for(const id of a.allies)G.mobs.get(id).hp=0;for(let i=1;i<a.foes.length;i++)G.mobs.get(a.foes[i]).hp=0;const money=c.den;assert(GL.boutTick(a));assert.equal(slave.gxp,15);assert.equal(c.ap,2);assert.equal(c.den,money);});
reset();({p,c}=player());const dummy=CB.spawnMob('training_dummy',0,0);ok('Training target: survives lethal hits; no XP or loot',()=>{CB.hitMob(dummy,100000,p);assert.equal(dummy.hp,dummy.maxHp);assert.equal(c.xp,0);assert.equal(G.drops.size,0);});
// Use the real generated sea and land for movement and obstacle checks.
reset();G.world=WG.generateWorld(123456789);G.W.buildings=[{id:50,type:'portus',built:true,x:-2100,z:-1700}];
ok('Pirate: spawn and pursuit cannot enter harbor safety radius',()=>{const e=SO.spawnEnemyShip('pirate_ship',-2100,-1700,{mode:'hunt'});assert(e);assert(pirateWater(e.x,e.z,e.def.len));G.W.ships=[{id:60,type:'corbita',x:-2100,z:-1700,hp:450,owner:'test'}];e.prey=60;e.ry=Math.atan2(-2100-e.x,-1700-e.z);e.speed=10;for(let i=0;i<300;i++){SO.updateEnemyShips(0.05);assert(!inHarborZone(e.x,e.z,e.def.len/2+4));}assert.equal(G.W.ships[0].hp,450);});
ok('Coastal relief: rock escarpments exist, city centers remain unchanged',()=>{let raised=0;for(let x=-1400;x<1400;x+=20)for(let z=-800;z<1100;z+=20){const h=WG.terrainHeight(x,z);if(WG.coastalLift(x,z,h)>8)raised++;}assert(raised>10);for(const city of G.world.cities)assert.equal(WG.coastalLift(city.x,city.z,3),0);});
reset();({p,c}=player());
ok('Workers: early ranks doubled, Eques limit never falls back to two',()=>{assert.deepEqual(D.RANKS.map(r=>r.slaves),[4,8,12,12,12,15]);c.dig=450;c.rankBought=0;assert.equal(slaveLimitOf(c),12);c.rankBought=3;assert.equal(slaveLimitOf(c),12);c.lat={};assert.equal(slaveLimitOf(c),18);});
G.world=WG.generateWorld(123456789);
ok('Tyndaris: arena and theater removed; old saved arena purged',()=>{const C=G.world.cities.find(c=>c.id==='tyndaris');assert(!C.layout.some(l=>['theatrum','amphitheatrum'].includes(l.type)));G.W.buildings=[{id:999,type:'amphitheatrum',x:C.x+100,z:C.z,city:'tyndaris',built:true}];ensureCities(G.W);assert(!G.W.buildings.some(b=>b.id===999));assert(G.W.buildings.some(b=>b.type==='amphitheatrum'&&b.city==='messana'));});
reset();({p,c}=player());G.W.buildings=[{id:1,type:'amphitheatrum',built:true,x:0,z:0,ry:0}];
ok('Personal arena: first wave has at least four participants and NPC duels',()=>{SO.arenaStart(p);G.arena.t=0;SO.arenaTick();const a=G.arena;a.t=0;SO.arenaTick();const bots=[...G.mobs.values()].filter(m=>m.ffa===a.ffa);assert(bots.length+1>=4);assert.equal((bots.length+1)%2,0);assert(bots.some(m=>m.arenaPlayerPair===p.id));assert(bots.some(m=>m.arenaPair&&G.mobs.get(m.arenaPair)?.faction==='glad'));});
reset();({p,c}=player());c.bag={};G.W.buildings=[{id:1,type:'statio',owner:c.id,built:true,x:0,z:0,store:{plank:1,olives:10},orders:{crate1:1}}];
ok('Automatic trading post uses the same flexible recipes',()=>{RT.routesTick(60);assert.equal(G.W.buildings[0].crates.crate1,1);assert.equal(G.W.buildings[0].store.olives,0);});
reset();({p,c}=player());c.squads=[{id:900,type:'inf',name:'Test',lvl:1,up:{arm:5,wpn:5,drill:5},live:[]}];G.war={lobbies:new Map()};G.world.war={house:{x:0,z:0},fields:[{name:'Test',x:0,z:100,r:200,a:{x:-80,z:100},b:{x:80,z:100}}]};
ok('Field of Mars: mirror bonuses equal; duplicate squad selection rejected',()=>{WAR.warMsg(p,{type:'warPick',ids:[900,900,900,900]});assert.equal(c.warPick.length,1);WAR.warMsg(p,{type:'warCreate',mode:'pvb'});const a=[...G.mobs.values()].filter(m=>m.team==='A'),b=[...G.mobs.values()].filter(m=>m.team==='B');assert.equal(a.length,b.length);for(const k of ['maxHp','dmg','armor','speed'])assert.equal(a[0][k],b[0][k]);assert.equal(a[0].def.speed,b[0].def.speed);});
reset();loadAll();({p,c}=player());
ok('Three training targets are placed near the real Roman arsenal',()=>{const arsenal=G.W.buildings.find(b=>b.type==='armamentarium'&&b.built&&!b.enemy);assert(arsenal);p.x=arsenal.x;p.z=arsenal.z;NAV.navTick(Date.now()/1000);CB.populate();const targets=[...G.mobs.values()].filter(m=>m.def.training&&m.src?.arsenal===arsenal.id);assert.equal(targets.length,3);for(const m of targets)assert(Math.hypot(m.x-arsenal.x,m.z-arsenal.z)<=31);});
console.log(JSON.stringify({status:'PASS',checks:passed},null,2));
