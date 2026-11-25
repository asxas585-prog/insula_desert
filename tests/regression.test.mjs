import test from 'node:test';
import assert from 'node:assert/strict';
import { G,D,WG,newChar,now,shipLimitOf,hasOffice,cityOff } from '../rpg/state.js';
import * as CB from '../rpg/combat.js';
import * as EC from '../rpg/economy.js';
import * as T from '../rpg/trade.js';
import * as AR from '../rpg/army.js';
import * as WAR from '../rpg/wargame.js';
import * as LG from '../rpg/logistics.js';
import * as RT from '../rpg/routes.js';
import * as SO from '../rpg/society.js';
import { troopStats, formationWorld, horseMotion, battleDeployment } from '../public/rpg/rules.js';
import { createTroop } from '../rpg/troops.js';
import { credentials,passwordRecord,verifySecret } from '../rpg/auth.js';
import { hasCityOffice } from '../rpg/access.js';
import { tradeVisit, tradeStep } from '../rpg/tutorial.js';
import { encounterLevel } from '../rpg/balance.js';
function reset(){
 G.players.clear();G.mobs.clear();G.proj.clear();G.drops.clear();G.eships.clear();G.chars={};G.war=null;G.convoys.clear();
 G.world={cities:[{id:'messana',x:0,z:0,R:90,gates:[],owner:'rome',layout:[]},{id:'catana',x:1000,z:0,R:90,gates:[],owner:'rome',layout:[]}],nodes:[],traders:[],pois:[],dens:[],camps:[],war:{house:{x:0,z:0},village:{x:0,z:0},fields:[{x:0,z:0,r:100,name:'test',a:{x:-60,z:0},b:{x:60,z:0}}]}};
 G.W={time:0,day:100,buildings:[],ships:[],slaves:[],offices:{},laws:{},cityOff:{},cityState:{messana:{owner:'rome'},catana:{owner:'rome'}},storage:{},treasury:1000,chronicle:[],story:0,flags:{},fleetBuilt:{},routes:[],market:{},favor:50,slaveMarket:[],watch:{}};
 CB.setKneelFn(()=>false);CB.setSquadFns(AR.squadSlot,AR.squadKill);
}
function player(id='alice',x=0){const c=newChar(id,id,D.COLORS[0]);G.chars[id]=c;const msgs=[];const p={id:G.players.size+1,char:c,x,z:0,y:Math.max(0,WG.terrainHeight(x,0)),ry:0,inst:null,alive:true,hp:100,st:100,buffs:{},msgs,ws:{readyState:1,send:s=>msgs.push(JSON.parse(s))}};G.players.set(p.id,p);return p;}
function building(type,owner,id=500,x=0,city='messana'){const b={id,type,owner,x,z:0,ry:0,city,built:true,ruined:false,hp:100,maxHp:100,store:{},cost:{plank:10},contrib:{},lastProd:now()-65};G.W.buildings.push(b);return b;}
function ship(owner,id=900){const d=D.SHIPS.scapha,s={id,type:'scapha',owner,x:0,z:0,ry:0,name:'Test',hp:d.hp,maxHp:d.hp,cargo:{},crates:[],up:{}};G.W.ships.push(s);return s;}
function projectile(side,target,owner=100){G.proj.set(888,{id:888,kind:'arrow',x:target.x,z:target.z,y:target.y+1.3,vx:0,vz:0,vy:0,g:0,life:3,born:now(),side,owner,inst:null,dmg:20});}
function check(name,fn){test(name,()=>{reset();return fn();});}
check('public account id does not authenticate without a secret',()=>{const rec=passwordRecord('very-long-password');assert(verifySecret(rec,'very-long-password'));assert(!verifySecret(rec,'c12345'));assert(!verifySecret(rec,'wrong'));});
check('guest public identifier is a digest, not the browser secret',()=>{const token='a'.repeat(64),cred=credentials({token},{});assert(!cred.id.includes(token));assert.equal(cred.secret,token);assert.match(cred.id,/^g[0-9a-f]{64}$/);});
check('negative purchase multipliers are bounded for maximum character stats',()=>{const p=player();p.char.stats.cha=117;p.char.spec.merc=5;assert.equal(D.derived(p.char).buy,.35);});
check('high charisma slave purchase deducts money',()=>{const p=player();p.x=WG.START.x;p.z=WG.START.z;p.char.stats.cha=70;G.W.slaveMarket=[{id:22,price:100,name:'worker'}];EC.buySlave(p,22);assert.equal(p.char.den,25);});
check('all office permissions are scoped by city',()=>{const p=player();for(const office of Object.keys(D.OFFICES)){G.W.offices[office]={id:p.char.id};assert(hasCityOffice(p.char,office,'messana'));assert(!hasCityOffice(p.char,office,'catana'));p.x=1000;assert(!hasOffice(p.char,office));p.x=0;} });
check('foreign prefect cannot pay rewards from another city forum',()=>{const p=player('alice',1000),q=player('bob');G.W.offices.praefectus={id:p.char.id};building('forum',null,3,1000,'catana');SO.officeAct(p,{act:'reward',to:q.char.id,n:100});assert.equal(q.char.den,60);assert.equal(G.W.treasury,1000);});
check('foreign legate cannot buy guards in another city arsenal',()=>{const p=player('alice',1000);G.W.offices.legatus={id:p.char.id};building('armamentarium',null,3,1000,'catana');AR.watchMsg(p,{type:'watchBuy'});assert.equal(G.W.treasury,1000);assert.match(p.msgs.at(-1).text,/легат/);});
check('combined fleet allowance uses current city offices',()=>{const p=player();G.W.offices={navarchus:{id:p.char.id},senator:{id:p.char.id}};assert.equal(shipLimitOf(p.char),6);p.x=1000;assert.equal(shipLimitOf(p.char),3);});
check('three wrecks do not block new construction',()=>{const p=player();p.char.sunk=[{},{},{}];p.char.bag={plank:50,wood:50};building('portus',null);EC.setBerthFn(()=>({x:0,z:0,ry:0,key:'test'}));EC.buildShip(p,'scapha');assert.equal(G.W.ships.length,1);});
check('foreign crates cannot be unloaded',()=>{const p=player();const s=ship('bob');s.crates=['crate4'];T.crateMsg(p,{type:'crateUnload',sid:s.id,i:0});assert.equal(p.char.carry,undefined);assert.equal(s.crates.length,1);});
check('foreign resources cannot be unloaded remotely to colony storage',()=>{const p=player();const s=ship('bob');s.cargo={wood:10};building('portus',null);EC.unloadToStorage(p,s.id);assert.deepEqual(s.cargo,{wood:10});assert.equal(G.W.storage.wood,undefined);});
check('foreign hold cannot be accessed through cargoMove',()=>{const p=player();const s=ship('bob');s.cargo={wood:10};EC.cargoMove(p,s.id,'wood',10,'out');assert.equal(p.char.bag.wood,0);assert.equal(s.cargo.wood,10);});
check('zero-count cargo no longer blocks ship sale',()=>{const p=player();const s=ship(p.char.id);s.cargo={wood:0};building('portus',null);T.shipTrade(p,{type:'shipRome',sid:s.id});assert.equal(G.W.ships.length,0);assert(p.char.den>60);});
check('wreck can be scrapped independently of active fleet',()=>{const p=player();p.char.sunk=[{id:1}];T.shipTrade(p,{type:'shipScrap',sid:1});assert.equal(p.char.sunk.length,0);});
check('allied arrows hit enemies above terrain',()=>{player();const e=CB.spawnMob('punic_inf',10,0);projectile('ally',e);CB.updateProj(0);assert(e.hp<e.maxHp);});
check('allied arrows cannot damage player owner',()=>{const p=player();projectile('ally',p);CB.updateProj(0);assert.equal(p.hp,100);});
check('swept projectile catches targets between network positions',()=>{const target={x:1,z:0,y:20};assert(CB.projectileHits({px:0,pz:0,py:21,x:3,z:0,y:21},target,.5,2.6));assert(!CB.projectileHits({px:0,pz:0,py:1,x:3,z:0,y:1},target,.5,2.6));});
check('ranged AI actually emits a projectile above the ground',()=>{const p=player();const a=CB.spawnMob('rom_arch',8,0),e=CB.spawnMob('punic_inf',24,0);a.state='wind';a.windEnd=0;a.target={kind:'mob',id:e.id};CB.updateMobs(.05);const pr=[...G.proj.values()].find(pr=>pr.owner===a.id);assert(pr);assert.equal(pr.side,'ally');assert(pr.y>=WG.terrainHeight(a.x,a.z)+1);});
check('artillery emits a bolt with the same friendly-fire rules',()=>{player();const a=CB.spawnMob('rom_art',8,0),e=CB.spawnMob('punic_inf',24,0);a.state='wind';a.windEnd=0;a.target={kind:'mob',id:e.id};CB.updateMobs(.05);assert.equal([...G.proj.values()].find(p=>p.owner===a.id)?.kind,'bolt');});
check('commander can personally hit opposing Roman units',()=>{const p=player();p.war={lid:1,team:'A'};const e=CB.spawnMob('rom_inf',0,0);e.team='B';e.war=1;CB.hitMob(e,20,p);assert(e.hp<e.maxHp);});
check('mercenary slingers really are ranged',()=>{assert(D.ENEMIES[D.SQUADS.merc_l.unit].ranged);assert(D.ENEMIES[D.SQUADS.merc_l.unit].range>20);});
check('field bots mirror player army but have weaker health damage and armor',()=>{const p=player();p.char.level=10;p.char.squads=[{id:10,type:'cav',name:'Cav',lvl:6,up:{arm:5,wpn:5,drill:5},live:[]}];WAR.warMsg(p,{type:'warCreate',mode:'pvb'});const a=[...G.mobs.values()].find(m=>m.team==='A'),b=[...G.mobs.values()].find(m=>m.team==='B');assert.equal(b.maxHp,Math.round(a.maxHp*.8));assert.equal(b.dmg,a.dmg*.8);assert.equal(b.armor,a.armor*.85);for(const field of ['speed','lvl','type'])assert.equal(a[field],b[field],field);assert(a.def.mounted&&b.def.mounted);});
check('formation preview math matches squad destination slots',()=>{const p=player();const sq={id:10,type:'inf',mode:'move',form:'tight',columns:3,pt:{x:10,z:20,ry:1},live:[]};p.char.squads=[sq];const m=createTroop('inf',0,0,{level:1});m.squad={owner:p.char.id,sq:10,slot:4,n:6};sq.live=[m.id];const actual=AR.squadSlot(m),expected=formationWorld(4,6,'tight',3,10,20,1);assert.equal(actual.x,expected.x);assert.equal(actual.z,expected.z);});
check('horse must accelerate and cannot turn on the spot at full gallop',()=>{const start=horseMotion(0,0,0,true,true,'numida',.1);assert(start.speed<=.35+.001);const turn=horseMotion(11,0,Math.PI,true,true,'numida',.1);assert(turn.heading<.1);assert(turn.speed<11);});
check('housing is real capacity and workers are assigned to quarters',()=>{const p=player();const b=building('quarters',p.char.id);G.W.slaves=Array.from({length:5},(_,id)=>({id:id+1,owner:p.char.id}));LG.housingTick();assert.equal(LG.housingCapacity(p.char),12);assert(G.W.slaves.every(s=>s.housed&&s.home===b.id));});
check('worker cannot occupy a squad and ship archer station together',()=>{const p=player();const s=ship(p.char.id);G.W.slaves=[{id:2,owner:p.char.id,squad:5}];T.shipMsg(p,{type:'shipArcher',sid:s.id,slave:2,on:true});assert.equal(G.W.slaves[0].ship,undefined);});
check('freeing a serving worker is rejected without dangling squad ids',()=>{const p=player();G.W.slaves=[{id:2,owner:p.char.id,squad:5}];EC.freeSlave(p,2);assert.equal(G.W.slaves.length,1);});
check('city production automatically flows to owner warehouse',()=>{const p=player();const a=building('lumber',p.char.id,1),wh=building('warehouse',p.char.id,2);a.store={wood:20};wh.store={};LG.autoStoreProduction();assert.equal(a.store.wood,0);assert.equal(wh.store.wood,20);});
check('automatic transfer never crosses city or owner boundaries',()=>{const p=player();const a=building('lumber',p.char.id,1),far=building('warehouse',p.char.id,2,1000,'catana'),other=building('warehouse','bob',3);a.store={wood:20};LG.autoStoreProduction();assert.equal(a.store.wood,20);assert.deepEqual(far.store,{});assert.deepEqual(other.store,{});});
check('private warehouse supplies construction without resources in bag',()=>{const p=player();p.char.bag={};const wh=building('warehouse',p.char.id,2);wh.store={plank:10};const b=building('domus',p.char.id,3);b.built=false;b.prog={};b.cost={plank:10};EC.deliver(p,b.id);assert(b.built);assert.equal(wh.store.plank,0);});
check('private warehouse supplies repair within city',()=>{const p=player();p.char.bag={};const wh=building('warehouse',p.char.id,2);wh.store={stone:10,plank:10};const b=building('domus',p.char.id,3);b.hp=50;EC.repair(p,b.id);assert.equal(b.hp,100);assert(wh.store.stone<10);});
check('warehouse resources cannot be taken by another owner',()=>{const p=player();const wh=building('warehouse','bob');wh.store={wood:10};LG.warehouseMsg(p,{type:'warehouseMove',bid:wh.id,res:'wood',n:10,dir:'out'});assert.equal(wh.store.wood,10);});
check('supply depot deliberately permits cooperative access',()=>{const p=player();const wh=building('supply_depot','bob');wh.store={wood:10};LG.warehouseMsg(p,{type:'warehouseMove',bid:wh.id,res:'wood',n:10,dir:'out'});assert.equal(p.char.bag.wood,10);});
check('trade lesson advances only through validated activities',()=>{const p=player();const b=building('collegium',null);tradeVisit(p,{bid:b.id});assert.equal(p.char.tradeTutorial,1);tradeStep(p,5);assert.equal(p.char.tradeTutorial,1);p.char.bag={...D.CRATES.crate1.in,wheat:14};T.crateMsg(p,{type:'crateCraft',k:'crate1'});assert.equal(p.char.tradeTutorial,2);const s=ship(p.char.id);T.crateMsg(p,{type:'crateLoad',sid:s.id});assert.equal(p.char.tradeTutorial,3);G.world.traders=[{id:'buyer',x:0,z:0,mult:1,name:'buyer'}];tradeVisit(p,{tid:'buyer'});T.crateMsg(p,{type:'crateSell',tid:'buyer',sid:s.id,i:0});assert.equal(p.char.tradeTutorial,5);});
check('age of server cannot make beginner raids level 52',()=>{player();G.W.day=1000;assert.equal(encounterLevel(),1);});
check('guard recall returns stuck guard to city after ten-minute deadline',()=>{player();building('armamentarium',null,1);building('forum',null,2);const st=AR.watchState('messana');st.n=2;AR.watchTick();const m=G.mobs.get(st.live[0]);assert(m);m.x=500;m.z=500;st.recallAt=now()-1;AR.watchTick();assert(Math.hypot(m.x,m.z)<90);assert(st.recallAt>now()+590);assert(m.watch.forum);});
check('route cargo is persisted in world and returned on closure',()=>{const p=player();const post=building('statio',p.char.id,1);post.crates={crate1:2};const r={id:2,owner:p.char.id,kind:'land',post:post.id,path:[[0,0],[100,0]],on:true,wagons:1,guards:0,ships:[],trips:0,earned:0,lost:0};G.W.routes=[r];RT.routesTick(.01);assert.equal(r.transit.load.length,2);assert(JSON.stringify(G.W).includes('"load":["crate1","crate1"]'));RT.routeMsg(p,{type:'routeDel',rid:r.id});assert.equal(post.crates.crate1,2);});
check('legacy office lookup without city grants no authority',async()=>{const {holderOf}=await import('../rpg/state.js');const p=player();G.W.offices.lanista={id:p.char.id};assert.equal(holderOf('lanista'),null);});
check('civil office perks do not apply in wilderness',()=>{const p=player();G.W.offices.navarchus={id:p.char.id};p.x=2500;p.z=2500;assert(!hasOffice(p.char,'navarchus'));assert.equal(shipLimitOf(p.char),3);});
check('private colony cargo cannot be transferred by non-owner',()=>{const p=player();const b=building('colonia','bob');b.store={wood:20};ship(p.char.id);EC.colonyLoad(p,b.id);assert.equal(b.store.wood,20);});
check('repeated calls cannot avoid cost of replenishing fallen soldiers',()=>{const p=player();p.char.den=0;p.char.squads=[{id:10,type:'inf',name:'Inf',lvl:1,up:{},live:[],lost:0}];const sq=p.char.squads[0],m=createTroop('inf',0,0,{level:1});m.squad={owner:p.char.id,sq:10,slot:0,n:1};m.hp=0;sq.live=[m.id];AR.armyMsg(p,{type:'squadOut',id:10});assert.equal(sq.replacements,1);assert.equal(sq.live.length,0);assert.equal(sq.lost,1);assert.match(p.msgs.at(-1).text,/Пополнение/);});
check('a fallen slave removes that specific worker rather than last worker in list',()=>{const p=player();G.W.slaves=[{id:11,owner:p.char.id,squad:10},{id:12,owner:p.char.id,squad:10}];const sq={id:10,type:'inf',name:'Slaves',lvl:1,up:{},live:[],slaves:[11,12],lost:0};p.char.squads=[sq];const m=createTroop('inf',0,0,{level:1});m.squad={owner:p.char.id,sq:10,slot:0,n:2};m.slaveId=11;m.hp=0;sq.live=[m.id];AR.armyMsg(p,{type:'squadOrder',id:10,mode:'hold'});assert.deepEqual(sq.slaves,[12]);assert.deepEqual(G.W.slaves.map(s=>s.id),[12]);});
check('ship building can use the personal city warehouse',()=>{const p=player();p.char.bag={};const wh=building('warehouse',p.char.id,1);wh.store={plank:60,wood:60};building('portus',null,2);EC.setBerthFn(()=>({x:0,z:0,ry:0,key:'test'}));EC.buildShip(p,'scapha');assert.equal(G.W.ships.length,1);assert(wh.store.plank<60);assert(wh.store.wood<60);});
check('ship repairs use city materials and still require owner proximity',()=>{const p=player();p.char.bag={};const wh=building('warehouse',p.char.id,1);wh.store={plank:10,linen:5};building('portus',null,2);const s=ship(p.char.id);s.hp-=50;T.shipMsg(p,{type:'shipRepair',sid:s.id});assert.equal(s.hp,s.maxHp);assert.equal(wh.store.plank,8);s.hp-=50;p.x=1000;T.shipMsg(p,{type:'shipRepair',sid:s.id});assert.equal(s.hp,s.maxHp-50);});
check('high trade skills cannot create same-merchant buy-sell arbitrage',()=>{const p=player();p.char.stats.cha=117;p.char.spec.merc=5;for(const key of ['wood','wheat','iron','silver'])assert(EC.buyPrice(p,key)>EC.sellPrice(p,key));});
check('guards cannot pursue an enemy outside the city boundary',()=>{player();const m=CB.spawnMob('legionary',87,0),e=CB.spawnMob('punic_inf',110,0);m.watch={city:'messana',x:0,z:0,R:90,forum:false};m.leash=9999;m.target={kind:'mob',id:e.id};for(let i=0;i<20;i++)CB.updateMobs(.1);assert(Math.hypot(m.x,m.z)<=88);});
check('new municipal guild does not overwrite an existing private building',async()=>{const {ensureCities}=await import('../rpg/state.js');const p=player(),C=G.world.cities[0];C.ry=0;C.layout=[{type:'collegium',x:0,z:0,ry:0}];G.world.cities=[C];const home=building('domus',p.char.id,1);G.W.nodes={};ensureCities(G.W);const guild=G.W.buildings.find(b=>b.type==='collegium'&&b.muni);assert(guild);assert(Math.hypot(guild.x-home.x,guild.z-home.z)>D.BUILDINGS.collegium.r+D.BUILDINGS.domus.r);assert(G.W.buildings.includes(home));assert(guild.built);});
check('passenger cannot sell somebody else hold cargo at an overseas port',()=>{const p=player();const s=ship('bob');s.cargo={wood:10};p.ship=s.id;p.x=D.PORTS.ostia.x;p.z=D.PORTS.ostia.z;EC.sell(p,'wood',10,true);assert.equal(s.cargo.wood,10);assert.equal(p.char.den,60);});

check('automatic crate orders use city warehouse beyond local post radius',()=>{const p=player(),post=building('statio',p.char.id,1),wh=building('warehouse',p.char.id,2,200);post.orders={crate1:1};wh.store={...D.CRATES.crate1.in,wheat:14};RT.routesTick(60);assert.equal(post.crates.crate1,1);assert(Object.values(wh.store).every(n=>n===0));});
check('automatic crate orders cannot consume another city warehouse',()=>{const p=player(),post=building('statio',p.char.id,1),wh=building('warehouse',p.char.id,2,1000,'catana');post.orders={crate1:1};wh.store={...D.CRATES.crate1.in,wheat:14};RT.routesTick(60);assert.equal(post.crates.crate1,undefined);assert.deepEqual(wh.store,{...D.CRATES.crate1.in,wheat:14});});

check('finishing a field battle revives a dead commander and explicitly closes the death screen',()=>{
 const p=player();p.char.squads=[{id:10,type:'inf',name:'Inf',lvl:1,up:{},live:[]}];WAR.warMsg(p,{type:'warCreate',mode:'pvb'});
 const lid=p.war.lid;p.alive=false;p.hp=0;p.deadAt=now();for(const m of G.mobs.values())if(m.team==='B')m.hp=0;
 WAR.warTick();assert.equal(p.war,null);assert.equal(p.alive,true);assert.equal(p.hp,D.derived(p.char).maxHp);assert.equal(p.deadAt,0);
 assert(p.msgs.some(m=>m.type==='respawn'&&m.battleEnded));assert(!p.char.squads.some(s=>s.war));assert(p.char.squads.some(s=>s.id===10));
 assert(!G.war.lobbies.has(lid));assert.equal(G.mobs.size,0);assert.equal(WAR.warSpawnOf(p),null);
});
check('a stale field lobby cannot crash ordinary respawn',()=>{const p=player();p.war={lid:999,team:'A'};assert.equal(WAR.warSpawnOf(p),null);});
check('armies deploy on matching lanes and face their opponents on a rotated battlefield',()=>{
 const yaw=.73,F={x:100,z:-200,r:70,a:{x:100-Math.sin(yaw)*48,z:-200-Math.cos(yaw)*48},b:{x:100+Math.sin(yaw)*48,z:-200+Math.cos(yaw)*48}};
 for(let size=1;size<=3;size++)for(let k=0;k<size;k++)for(let g=0;g<4;g++){
  const a=battleDeployment(F,'A',k,size,g,4),b=battleDeployment(F,'B',k,size,g,4);
  assert(Math.abs((b.x-a.x)*Math.cos(yaw)-(b.z-a.z)*Math.sin(yaw))<1e-8);
  assert(Math.abs(Math.cos(a.ry-b.ry)+1)<1e-8);assert(Math.hypot(a.x-F.x,a.z-F.z)<F.r);
 }
});
check('every temporary player unit starts facing the enemy in its holding formation',()=>{
 const p=player();p.char.squads=[{id:10,type:'inf',name:'Inf',lvl:1,up:{},live:[]}];WAR.warMsg(p,{type:'warCreate',mode:'pvb'});
 for(const m of G.mobs.values()){const sq=p.char.squads.find(s=>s.id===m.squad?.sq);if(sq){const pos=AR.squadSlot(m);assert(Math.hypot(m.x-pos.x,m.z-pos.z)<1e-7);assert.equal(m.ry,p.ry);}else assert(Math.cos(m.ry-p.ry)<-.99);}
});
check('forum always contains ten quests per city and harbour keeps its separate board',()=>{
 G.world.cities[0].harbor=true;SO.questBoardTick();for(const c of G.world.cities)assert.equal(G.W.quests.filter(q=>q.city===c.id&&q.source==='forum').length,10);
 assert.equal(G.W.quests.filter(q=>q.source==='harbor').length,4);const ids=G.W.quests.map(q=>q.id),at=G.W.questsAt;SO.questBoardTick();assert.deepEqual(G.W.quests.map(q=>q.id),ids);assert.equal(G.W.questsAt,at);
 G.W.questsAt=Date.now()-1;SO.questBoardTick();assert(!G.W.quests.some(q=>ids.includes(q.id)));assert.equal(G.W.quests.filter(q=>q.source==='forum').length,20);
});
check('buyer hours include late evening and early morning but exclude the forty minute break',()=>{
 function gt(h){const f=h>=3?(h-3)/(23+55/60-3)*(2/3):(2/3)+(h+24-(23+55/60))/(24-(23+55/60)+3)/3;return f*D.CFG.dayLength;}
 for(const h of [12,12.2,12.65])assert.equal(D.buyerOpen(gt(h)),false,String(h));
 for(const h of [0,.32,1,3,11.99,12+40/60,23.99])assert.equal(D.buyerOpen(gt(h)),true,String(h));assert(D.MARKET_GOODS.includes('plank'));
});
check('buyer sells planks using the shared server catalogue',()=>{const p=player();building('mercator',null,1);G.W.events=[];G.W.time=0;p.char.den=1000;const n=p.char.bag.plank||0;EC.buy(p,'plank',2);assert.equal(p.char.bag.plank,n+2);});
check('bandages enforce a three second server cooldown without consuming a second item',async()=>{
 const {bandage}=await import('../rpg/game.js');const p=player();p.hp=1;p.char.bag.bandage=5;bandage(p);
 assert.equal(p.char.bag.bandage,4);assert(p.healReady-now()>2.9&&p.healReady-now()<=3);assert.deepEqual(p.msgs.find(m=>m.type==='healCooldown'),{type:'healCooldown',seconds:3});
 const hp=p.hp;bandage(p);assert.equal(p.hp,hp);assert.equal(p.char.bag.bandage,4);p.healReady=now()+.01;bandage(p);assert.equal(p.char.bag.bandage,4);p.healReady=now()-.01;bandage(p);assert.equal(p.char.bag.bandage,3);
});

check('idle soldiers respect target scan cooldown instead of scanning every server tick',()=>{
 const p=player(),m=CB.spawnMob('legionary',0,0);m.nextAct=now()+100;m.def={...m.def};let scans=0;const aggro=m.def.aggro;Object.defineProperty(m.def,'aggro',{get(){scans++;return aggro;}});
 for(let i=0;i<20;i++)CB.updateMobs(.05);assert(scans<=2,`unexpected scans: ${scans}`);assert.equal(m.target,null);
});

check('all trade crate slots fit on decks and do not overlap each other',async()=>{
 const {crateDeckSlot}=await import('../public/rpg/cargo-layout.js');
 for(const[type,def]of Object.entries(D.SHIPS)){const slots=Array.from({length:def.crates||0},(_,i)=>crateDeckSlot(type,i,1));
  for(const a of slots){assert(a.y>1);assert(Math.abs(a.z)+.3*a.scale<def.len/2);assert(Math.abs(a.x)+.4*a.scale<def.len*.25);}
  for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){const a=slots[i],b=slots[j];assert(Math.abs(a.x-b.x)>=.4*(a.scale+b.scale)||Math.abs(a.z-b.z)>=.3*(a.scale+b.scale));}
 }
});

check('a bot beside a human mirrors the player opposite its own deployment lane',()=>{
 const a=player('a'),b=player('b'),c=player('c');a.char.squads=[{id:10,type:'inf',name:'Inf',lvl:1,up:{},live:[]}];b.char.level=20;b.char.squads=[{id:20,type:'cav',name:'Cav',lvl:4,up:{arm:3},live:[]}];c.char.squads=[{id:30,type:'arch',name:'Arch',lvl:1,up:{},live:[]}];
 WAR.warMsg(a,{type:'warCreate',size:2,zone:0});const id=[...G.war.lobbies.keys()][0];WAR.warMsg(b,{type:'warJoin',id,side:'A'});WAR.warMsg(c,{type:'warJoin',id,side:'B'});WAR.warMsg(a,{type:'warBot',id,side:'B',on:true});
 const bot=[...G.mobs.values()].find(m=>m.warBot),opponent=[...G.mobs.values()].find(m=>m.squad?.owner===b.char.id);assert(bot);assert.equal(bot.type,opponent.type);assert.equal(bot.lvl,opponent.lvl);assert.equal(bot.maxHp,Math.round(opponent.maxHp*.8));
});
