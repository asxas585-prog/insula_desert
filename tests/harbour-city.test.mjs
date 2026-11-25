import test from 'node:test';
import assert from 'node:assert/strict';
import {G,D,WG,newChar,now,cityOff} from '../rpg/state.js';
import {cheatCode} from '../rpg/game.js';
import {cityRoad} from '../rpg/land.js';
import {tunaMsg,tunaTick,reelStep,bow} from '../rpg/tuna.js';
import * as SO from '../rpg/society.js';
import * as EC from '../rpg/economy.js';
import * as T from '../rpg/trade.js';
const world=WG.generateWorld(9001),C=world.cities.find(c=>c.id==='messana');
function setup(){
 G.world=world;G.players.clear();G.chars={};G.tuna=new Map();G.harpoons=new Map();G.tunaSpawnAt=Infinity;G.schools.clear();
 G.W={day:1,time:0,buildings:world.cities.flatMap(c=>c.layout.map((b,i)=>({...b,id:c.id+':'+i,city:c.id,built:true,hp:100,maxHp:100,muni:c.id+':'+i,store:{},cost:{},prog:{}}))),ships:[],slaves:[],offices:{},cityOff:{},cityState:Object.fromEntries(world.cities.map(c=>[c.id,{owner:'rome'}])),plots:{},quests:[],chronicle:[],events:[],laws:{},market:{},storage:{},treasury:1000,favor:50};
 WG.setMuniFootprints(world.cities);WG.setCityRoadCells([]);
 const c=newChar('alice','Рыбак',D.COLORS[0]);G.chars[c.id]=c;const messages=[];
 const p={id:1,char:c,alive:true,x:C.x,z:C.z,ry:0,inst:null,hp:100,st:100,buffs:{},ws:{readyState:1,send:s=>messages.push(JSON.parse(s))},messages};G.players.set(1,p);return p;
}
function boat(p){const port=C.layout.find(b=>b.type==='portus');let point;
 for(let d=150;d<300&&!point;d+=4)for(let k=0;k<32;k++){const a=k*Math.PI/16,x=port.x+Math.sin(a)*d,z=port.z+Math.cos(a)*d;if(WG.terrainHeight(x,z)<-3&&WG.shipOk(x,z)&&!WG.portOverlap(x,z,8,[port])){point={x,z};break;}}
 assert(point);const s={id:700,type:'barca',owner:p.char.id,...point,ry:0,speed:0,cargo:{},tunaHold:[null,null],hp:260,maxHp:260};G.W.ships.push(s);p.ship=s.id;Object.assign(p,point);return s;
}
function code(p,text){const old=process.env.CHEATS;process.env.CHEATS='1';try{return cheatCode(p,text);}finally{if(old===undefined)delete process.env.CHEATS;else process.env.CHEATS=old;}}
function check(name,fn){test(name,()=>fn(setup()));}
check('production chat codes work without DEV, quantities stay positive',p=>{code(p,'FIDES 500');assert.equal(p.char.dig,500);code(p,'GLORIA 300');assert.equal(p.char.milPts,300);const money=p.char.den;code(p,'DENARII 150');assert.equal(p.char.den,money+150);code(p,'AURUM -100');assert(p.char.den>money+150);code(p,'EQUUS');assert(p.mounted);assert.equal(p.char.horses.length,1);});
check('SUBSIDIUM grants exact kit once per ten minutes',p=>{p.char.bag={};const money=p.char.den;code(p,'SUBSIDIUM');for(const k of ['wood','stone','plank','brick','iron','clay','leather','linen','wheat','bread'])assert.equal(p.char.bag[k],20);assert.equal(p.char.den,money+500);code(p,'SUBSIDIUM');assert.equal(p.char.den,money+500);p.char.kitAt=now()-1;code(p,'SUBSIDIUM');assert.equal(p.char.den,money+1000);});
check('PENTERES and NAVIS barca create the requested ship',p=>{code(p,'PENTERES');code(p,'NAVIS barca');assert.deepEqual(G.W.ships.map(s=>s.type),['penteres','barca']);});
check('central purchasable district occupies one inland quarter, forum is public',()=>{for(let i=-28;i<28;i++)for(let j=-28;j<28;j++){const[x,z]=WG.cellCenter(C,i,j),d=WG.districtAt(x,z);if(d?.city===C.id&&d.d==='center'){assert(d.u>10&&d.v< -10);}}assert.notEqual(WG.districtAt(C.x,C.z)?.d,'center');});
check('civic frontage follows a main avenue and leaves the residential quarter',()=>{for(const c of world.cities)for(const b of c.layout.filter(b=>b.avenue)){const[u,v]=WG.cityLocal(c,b.x,b.z),r=D.BUILDINGS[b.type].r;assert(!(u>0&&v<0),c.id+':'+b.type);assert(Math.min(Math.abs(u),Math.abs(v))<r+10,c.id+':'+b.type);}});
function roadSite(){for(let i=-22;i<=22;i++)for(let j=-22;j<=22;j++)if(WG.cityRoadAllowed(C,i,j,G.W.buildings,G.W.plots))return{i,j};assert.fail('no avenue-connected cell available');}
check('only local aedile can place one city road cell, plots stay protected',p=>{const site=roadSite(),[x,z]=WG.cellCenter(C,site.i,site.j);Object.assign(p,{x,z});p.char.bag={stone:40};cityRoad(p,{city:C.id,...site});assert(!G.W.buildings.some(b=>b.type==='via_cell'));cityOff('catana').offices.aedilis={id:p.char.id};cityRoad(p,{city:C.id,...site});assert(!G.W.buildings.some(b=>b.type==='via_cell'));cityOff(C.id).offices.aedilis={id:p.char.id};G.W.plots[`${C.id}:${site.i}:${site.j}`]='bob';cityRoad(p,{city:C.id,...site});assert(!G.W.buildings.some(b=>b.type==='via_cell'));delete G.W.plots[`${C.id}:${site.i}:${site.j}`];cityRoad(p,{city:C.id,...site});assert.equal(G.W.buildings.filter(b=>b.type==='via_cell').length,1);assert.equal(p.char.bag.stone,40-D.BUILDINGS.via_cell.cost.stone);assert(!WG.cellFree(C,site.i,site.j));cityRoad(p,{city:C.id,...site});assert.equal(G.W.buildings.filter(b=>b.type==='via_cell').length,1);});
check('generic building API cannot bypass aedile road rules',p=>{assert.match(EC.placeCheck(p,'via_cell',p.x,p.z,0),/эдил/);});
check('harbour and forum have separate city quest boards and acceptance locations',p=>{SO.questBoardTick();const qs=G.W.quests.filter(q=>q.city===C.id);assert(qs.some(q=>q.source==='forum'));assert(qs.some(q=>q.source==='harbor'&&q.type==='tunaSale'));const q=qs.find(q=>q.source==='harbor'),forum=G.W.buildings.find(b=>b.city===C.id&&b.type==='forum_m'),port=G.W.buildings.find(b=>b.city===C.id&&b.type==='portus');Object.assign(p,{x:forum.x,z:forum.z});SO.acceptQuest(p,q.id);assert.equal(p.char.quests.length,0);Object.assign(p,{x:port.x,z:port.z});SO.acceptQuest(p,q.id);assert.equal(p.char.quests.length,1);});
check('harpoon must physically intersect visible tuna before reeling',p=>{const s=boat(p),a=bow(s),f={id:800,x:a.x,z:a.z+14,heading:Math.PI,home:{x:a.x,z:a.z+14},kg:140,born:now(),hooked:null};G.tuna.set(f.id,f);tunaMsg(p,{type:'harpoonShot',x:f.x,z:f.z});assert.equal(p.harpoon,undefined);for(let i=0;i<25&&!p.harpoon;i++)tunaTick(.05);assert.equal(p.harpoon?.fid,f.id);tunaMsg(p,{type:'harpoonReel',pulling:false,progress:1});assert.equal(p.harpoon.progress,0);});
check('surge pulling raises danger; easing reduces tension',()=>{const h={progress:.2,tension:.5},pull=reelStep(h,true,true,1),ease=reelStep(h,false,false,1);assert(pull.tension>h.tension);assert(ease.tension<h.tension);assert(pull.progress>h.progress);});
check('successful reeling creates a physical catch in a free side slot',p=>{const s=boat(p),f={id:800,x:s.x,z:s.z-6,heading:0,home:{x:s.x,z:s.z},kg:140,born:now(),hooked:p.id};G.tuna.set(f.id,f);p.harpoon={fid:f.id,sid:s.id,tension:.4,progress:.995,pulling:true,start:now()};tunaTick(.1);assert.equal(s.tunaHold[0].kg,140);assert(!p.char.bag.f_tuna);assert(!G.tuna.has(f.id));});
check('full tuna racks and foreign boats reject harpoon use',p=>{const s=boat(p);s.tunaHold=[{kg:100},{kg:150}];tunaMsg(p,{type:'harpoonShot',x:s.x,z:s.z-20});assert.equal(G.harpoons.size,0);s.tunaHold=[null,null];s.owner='bob';tunaMsg(p,{type:'harpoonShot',x:s.x,z:s.z-20});assert.equal(G.harpoons.size,0);});
check('physical tuna must be unloaded nearby, carried and sold on foot in harbour',p=>{const s=boat(p);s.tunaHold[0]={id:800,kg:120};tunaMsg(p,{type:'tunaUnload',sid:s.id,slot:0});assert(!p.char.tunaCarry);p.ship=null;s.owner='bob';tunaMsg(p,{type:'tunaUnload',sid:s.id,slot:0});assert(!p.char.tunaCarry);s.owner=p.char.id;tunaMsg(p,{type:'tunaUnload',sid:s.id,slot:0});assert.equal(p.char.tunaCarry.kg,120);assert.equal(s.tunaHold[0],null);const port=G.W.buildings.find(b=>b.city===C.id&&b.type==='portus'),before=p.char.den;tunaMsg(p,{type:'tunaSell',bid:port.id});assert.equal(p.char.den,before);Object.assign(p,{x:port.x,z:port.z});tunaMsg(p,{type:'tunaSell',bid:port.id});assert(p.char.den>before);assert.equal(p.char.tunaCarry,null);tunaMsg(p,{type:'tunaSell',bid:port.id});});
check('disconnect frees hooked fish instead of leaving it unavailable',p=>{const s=boat(p),f={id:800,x:s.x,z:s.z-10,home:{x:s.x,z:s.z-10},heading:0,kg:100,hooked:p.id,born:now()};G.tuna.set(f.id,f);G.players.delete(p.id);tunaTick(.05);assert.equal(f.hooked,null);});
check('players can share a board quest but progress and office points stay personal',p=>{
 SO.questBoardTick();const q=G.W.quests.find(q=>q.city===C.id&&q.source==='harbor'&&q.type==='fish'),port=G.W.buildings.find(b=>b.city===C.id&&b.type==='portus');Object.assign(p,{x:port.x,z:port.z});
 const c=newChar('bob','Напарник',D.COLORS[1]),other={...p,id:2,char:c};G.chars[c.id]=c;G.players.set(2,other);
 SO.acceptQuest(p,q.id);SO.acceptQuest(other,q.id);assert.equal(p.char.quests[0].id,other.char.quests[0].id);
 SO.questHook(p,'fish',{sp:q.target});assert.equal(p.char.quests.length,0);assert.equal(other.char.quests[0].got,0);assert.equal(p.char.officePoints[C.id],5);assert(!other.char.officePoints?.[C.id]);assert(G.W.quests.some(x=>x.id===q.id));SO.questHook(p,'fish',{sp:q.target});assert.equal(p.char.officePoints[C.id],5);SO.acceptQuest(p,q.id);assert.equal(p.char.quests.length,0);SO.questHook(other,'fish',{sp:q.target});assert.equal(other.char.officePoints[C.id],5);
});
check('board is stable for ten minutes and refresh leaves accepted quests intact',p=>{
 SO.questBoardTick();const ids=G.W.quests.map(q=>q.id),until=G.W.questsAt;SO.questBoardTick();assert.equal(G.W.questsAt,until);assert.deepEqual(G.W.quests.map(q=>q.id),ids);assert(until>=Date.now()+599000);
 const q=G.W.quests.find(q=>q.city===C.id&&q.source==='harbor'),port=G.W.buildings.find(b=>b.city===C.id&&b.type==='portus');Object.assign(p,{x:port.x,z:port.z});SO.acceptQuest(p,q.id);G.W.questsAt=Date.now()-1;SO.questBoardTick();assert(!G.W.quests.some(x=>x.id===q.id));assert.equal(p.char.quests[0].id,q.id);
});
check('office points are required in the candidacy city and are not spent',p=>{
 const forum=G.W.buildings.find(b=>b.city===C.id&&b.type==='forum_m');Object.assign(p,{x:forum.x,z:forum.z});p.char.rankBought=3;p.char.dig=5000;
 const co=cityOff(C.id);G.W.election=co.election={ends:now()+100,offices:{aedilis:{cands:{}}}};p.char.officePoints={catana:50};SO.candidate(p,'aedilis');assert(!co.election.offices.aedilis.cands[p.char.id]);p.char.officePoints[C.id]=20;SO.candidate(p,'aedilis');assert(co.election.offices.aedilis.cands[p.char.id]);assert.equal(p.char.officePoints[C.id],20);
});
check('pulling a fully strained line loses the fish instead of granting catch',p=>{const s=boat(p),f={id:800,x:s.x,z:s.z-10,home:{x:s.x,z:s.z-10},heading:0,kg:100,hooked:p.id,born:now()};G.tuna.set(f.id,f);p.harpoon={sid:s.id,fid:f.id,progress:.2,tension:.999,pulling:true,start:now()};tunaTick(.1);assert.equal(p.harpoon,null);assert.equal(f.hooked,null);assert(s.tunaHold.every(x=>!x));});
check('civic rearrangement preserves private holdings and stored civic resources',async p=>{
 const {ensureCities}=await import('../rpg/state.js'),L=C.layout.find(b=>b.type==='curia'),curia=G.W.buildings.find(b=>b.type==='curia'&&b.city===C.id);curia.store={wood:37};
 const home={id:9000,type:'domus',owner:p.char.id,city:C.id,x:L.x,z:L.z,ry:0,built:true,store:{iron:11},hp:80,maxHp:100};G.W.buildings.push(home);const before={x:home.x,z:home.z};G.W.nodes={};
 ensureCities(G.W);assert.equal(home.x,before.x);assert.equal(home.z,before.z);assert.deepEqual(home.store,{iron:11});assert.deepEqual(curia.store,{wood:37});assert(Math.hypot(curia.x-home.x,curia.z-home.z)>D.BUILDINGS.curia.r+D.BUILDINGS.domus.r);
});

check('berthing checks the entire barca instead of a wet centre point',()=>{const port=G.W.buildings.find(b=>b.city===C.id&&b.type==='portus');const candidates=T.berths('barca').filter(b=>b.port===port.id);assert(candidates.some(b=>WG.shipOk(b.x,b.z)&&!T.berthFits('barca',b)),'fixture must include a shoreline berth that clips the hull');const b=T.freeBerth('barca',port,500,port.id);assert(b);assert(T.berthFits('barca',b));});
