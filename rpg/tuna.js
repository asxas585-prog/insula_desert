import {announce} from './state.js';
import {G,D,WG,now,nid,dist,send,book} from './state.js';
import {questHook} from './society.js';
import {grantXp,grantDig} from './combat.js';
const fish=()=>G.tuna||(G.tuna=new Map());
const shots=()=>G.harpoons||(G.harpoons=new Map());
const say=(p,text)=>send(p,{type:'log',text,kind:'info'});
export function bow(s){return{x:s.x+Math.sin(s.ry)*D.SHIPS.barca.len*.34,z:s.z+Math.cos(s.ry)*D.SHIPS.barca.len*.34};}
export function segmentDistance(x,z,a,b){const dx=b.x-a.x,dz=b.z-a.z,n=dx*dx+dz*dz,t=n?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/n)):0;return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);}
export function reelStep(h,pulling,surge,dt){return{tension:Math.max(0,h.tension+dt*(pulling?(surge?.43:.12):(surge?-.04:-.26))),progress:Math.max(0,Math.min(1,h.progress+dt*(pulling?(surge?.012:.09):-.008)))};}
const hold=s=>{s.tunaHold||=[null,null];return s.tunaHold;};
function release(p,text){if(p.harpoon){const f=fish().get(p.harpoon.fid);if(f){f.hooked=null;f.heading+=Math.PI/2;}p.harpoon=null;}if(text)say(p,text);}
export function tunaMsg(p,m){
 if(!p.alive||p.inst)return;
 const s=G.W.ships.find(s=>s.id===(m.sid??p.ship));
 if(m.type==='tunaSell'){
  const b=G.W.buildings.find(b=>b.id===m.bid&&b.type==='portus'&&b.built&&!b.ruined&&!b.enemy);
  if(!b||p.ship||dist(p,b)>D.BUILDINGS.portus.r+10||!p.char.tunaCarry)return;
  const f=p.char.tunaCarry,value=Math.round(f.kg*.9*D.derived(p.char).sell);p.char.tunaCarry=null;p.char.den+=value;
  p.char.stats2||={};p.char.stats2.traded=(p.char.stats2.traded||0)+value;book(p.char,'Доход: тунец в гавани',value);questHook(p,'tunaSale',{n:1});questHook(p,'sell',{n:1,den:value,res:'f_tuna'});grantDig(p,3,'свежий тунец');p.dirtyChar=true;G.dirtyRoster=true;say(p,`Тунец ${f.kg} кг продан гавани за ${value} ден.`);return;
 }
 if(!s||s.type!=='barca'||s.owner!==p.char.id)return;
 if(['tunaUnload','tunaLoad'].includes(m.type)){
  if(p.ship||dist(p,s)>D.SHIPS.barca.len/2+7||Math.abs(s.speed||0)>1)return;
  const i=m.slot|0;if(i<0||i>1)return;
  if(m.type==='tunaUnload'){
   if(p.char.carry||p.char.tunaCarry||!hold(s)[i])return;
   p.char.tunaCarry=hold(s)[i];hold(s)[i]=null;say(p,'Тунец в руках. Отнесите его к рыбному причалу гавани (E → Рыбный причал).');
  }else{if(!p.char.tunaCarry||hold(s)[i])return;hold(s)[i]=p.char.tunaCarry;p.char.tunaCarry=null;}
  p.dirtyChar=true;G.dirtyRoster=true;G.dirtyWorld=true;return;
 }
 if(p.ship!==s.id||s.route)return;
 if(m.type==='harpoonCancel'){release(p,'Линь отпущен.');return;}
 if(m.type==='harpoonReel'){if(p.harpoon)p.harpoon.pulling=m.pulling===true;return;}
 if(m.type!=='harpoonShot'||p.harpoon)return;
 if(hold(s).every(Boolean))return say(p,'Оба бортовых места заняты. Сначала выгрузите тунца.');
 if(Math.abs(s.speed||0)>2)return say(p,'Сбавьте ход до остановки перед выстрелом.');
 if((p.harpoonAt||0)>now())return;
 const x=Number(m.x),z=Number(m.z),origin=bow(s),L=dist(origin,{x,z});
 if(!Number.isFinite(x)||!Number.isFinite(z)||L<2||L>60)return say(p,'Гарпун достаёт на 60 м. Наведите прицел на воду перед носом.');
 const dx=(x-origin.x)/L,dz=(z-origin.z)/L;
 if(dx*Math.sin(s.ry)+dz*Math.cos(s.ry)<-.3)return say(p,'Гарпун установлен на носу: разверните баркас носом к тунцу.');
 p.harpoonAt=now()+3;
 const id=nid();shots().set(id,{id,pid:p.id,sid:s.id,x:origin.x,z:origin.z,dx,dz,left:60});
}
export function tunaWaterAllowed(x,z){return WG.terrainHeight(x,z)<-1.5&&WG.shipOk(x,z)&&!WG.portOverlap(x,z,5,G.W.buildings.filter(b=>b.type==='portus'));}
export function tunaPathAllowed(a,b){const n=Math.max(1,Math.ceil(dist(a,b)/2));for(let i=1;i<=n;i++)if(!tunaWaterAllowed(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;return true;}
export function tunaTick(dt){
 const t=now();
 // Persistent sea population, including reachable water around fishing boats.
 if((G.tunaSpawnAt||0)<t){G.tunaSpawnAt=t+12;
  const anchors=[...G.W.ships.filter(s=>s.type==='barca'),...G.world.cities.filter(c=>c.harbor).map(c=>({x:c.hx,z:c.hz}))];
  for(const a of anchors){if(fish().size>=36)break;if([...fish().values()].filter(f=>dist(f,a)<120).length>=3)continue;
   for(let k=0;k<50;k++){const angle=k*2.399+Math.random(),r=30+(k%6)*10,x=a.x+Math.sin(angle)*r,z=a.z+Math.cos(angle)*r;
    if(WG.terrainHeight(x,z)>-2||!WG.shipOk(x,z)||WG.portOverlap(x,z,5,G.W.buildings.filter(b=>b.type==='portus')))continue;
    const id=nid();fish().set(id,{id,x,z,home:{x,z},heading:angle,kg:Math.round(90+Math.random()*170),hooked:null,born:t});break;
   }
  }
 }
 for(const f of fish().values()){
  if(!tunaWaterAllowed(f.x,f.z)){
   if(f.hooked){const p=G.players.get(f.hooked);if(p)release(p,'Линь отпущен у границы гавани.');}
   let safe=null;for(let r=6;r<200&&!safe;r+=6)for(let k=0;k<24;k++){const x=f.x+Math.sin(k*Math.PI/12)*r,z=f.z+Math.cos(k*Math.PI/12)*r;if(tunaWaterAllowed(x,z)){safe={x,z};break;}}
   if(!safe){fish().delete(f.id);continue;}Object.assign(f,safe);f.home={...safe};
  }
  if(f.hooked&&!G.players.has(f.hooked))f.hooked=null;
  if(f.hooked)continue;
  if(dist(f,f.home)>65)f.heading=Math.atan2(f.home.x-f.x,f.home.z-f.z);
  const nx=f.x+Math.sin(f.heading)*2.5*dt,nz=f.z+Math.cos(f.heading)*2.5*dt;
  if(tunaPathAllowed(f,{x:nx,z:nz})){f.x=nx;f.z=nz;}else f.heading+=1.4;
  if(t-f.born>1200)fish().delete(f.id);
 }
 for(const h of shots().values()){
  const p=G.players.get(h.pid),s=G.W.ships.find(s=>s.id===h.sid),old={x:h.x,z:h.z},step=Math.min(h.left,32*dt);
  if(!p||!p.alive||!s||p.ship!==s.id||s.owner!==p.char.id||p.harpoon){shots().delete(h.id);continue;}
  h.x+=h.dx*step;h.z+=h.dz*step;h.left-=step;
  const target=[...fish().values()].filter(f=>!f.hooked&&segmentDistance(f.x,f.z,old,h)<1.35).sort((a,b)=>dist(a,old)-dist(b,old))[0];
  if(target){target.hooked=p.id;p.harpoon={fid:target.id,sid:s.id,progress:0,tension:.25,pulling:false,start:t};shots().delete(h.id);say(p,'Попадание! Пробел — тянуть линь, отпустить — ослабить. Во время рывка не тяните: линь оборвётся.');}
  else if(h.left<=0){shots().delete(h.id);say(p,'Промах. Дождитесь перезарядки гарпуна.');}
 }
 for(const p of G.players.values()){
  const h=p.harpoon;if(!h)continue;const f=fish().get(h.fid),s=G.W.ships.find(s=>s.id===h.sid);
  if(!p.alive||!f||!s||p.ship!==s.id||s.owner!==p.char.id||Math.abs(s.speed||0)>4||dist(f,s)>65){release(p,'Линь сорвался: баркас отошёл или рыбак покинул снасть.');continue;}
  h.surge=((t-h.start)%5)>3.1;Object.assign(h,reelStep(h,h.pulling,h.surge,dt));
  if(h.tension>=1||t-h.start>65){release(p,'Тунец сорвался. Чередуйте подтягивание и отпускание линя.');continue;}
  if(h.pulling){const a=Math.atan2(s.x-f.x,s.z-f.z),step=Math.max(0,Math.min(dist(f,s)-3,2.7*dt)),next={x:f.x+Math.sin(a)*step,z:f.z+Math.cos(a)*step};if(!tunaPathAllowed(f,next)){release(p,'Тунец не заходит в гавань: ловите в открытой воде.');continue;}f.heading=a;Object.assign(f,next);}
  if(h.progress>=1){const i=hold(s).findIndex(x=>!x);if(i<0){release(p,'Нет свободного бортового места.');continue;}
   hold(s)[i]={id:f.id,kg:f.kg,caught:Date.now()};fish().delete(f.id);p.harpoon=null;announce('tuna',`🐟 ${p.char.name} выловил(а) тунца весом ${f.kg} кг!`);p.char.stats2.fish=(p.char.stats2.fish||0)+1;questHook(p,'fish',{sp:'f_tuna',kg:f.kg});grantXp(p,90);p.dirtyChar=true;G.dirtyWorld=true;say(p,`Тунец ${f.kg} кг закреплён ${i===0?'слева':'справа'}. Возвращайтесь в гавань, сойдите на берег и выгрузите рыбу через G.`);
  }
 }
}
export const tunaState=p=>({fish:[...fish().values()].filter(f=>!p.inst&&dist(f,p)<250).map(f=>[f.id,f.x,f.z,f.heading,f.kg,f.hooked||0]),shots:[...shots().values()].filter(h=>dist(h,p)<150).map(h=>[h.id,h.x,h.z,h.dx,h.dz]),hunt:p.harpoon?{...p.harpoon,kg:fish().get(p.harpoon.fid)?.kg}:null});
