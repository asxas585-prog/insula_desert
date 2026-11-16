import {THREE,scene,camera,optimizeStatic} from './render.js';
import {S,net} from './cstate.js';
import {makeFish,M} from './models.js';
let armed=false,hunt=null;
const fish=new Map(),bolts=new Map();
const panel=document.createElement('div');panel.id='harpoonHud';panel.style.cssText='position:fixed;top:255px;left:14px;width:min(360px,42vw);background:#151d25ed;color:#f5e5ba;padding:12px;border:1px solid #b99e59;border-radius:8px;z-index:24;display:none;pointer-events:none;font:14px Georgia';document.body.appendChild(panel);
const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xdcc69a}));line.frustumCulled=false;line.visible=false;scene.add(line);
const stop=()=>{net({type:'harpoonReel',pulling:false});net({type:'harpoonCancel'});armed=false;};
export function toggleHarpoon(){const s=S.world?.ships.find(s=>s.id===S.ship);if(s?.type!=='barca'||s.owner!==S.char.id)return false;if(armed)stop();else armed=true;return true;}
addEventListener('keydown',e=>{
 if(!S.started||e.target.closest?.('input,textarea,[contenteditable=true]')||!document.querySelector('#modal')?.classList.contains('hidden'))return;
 if(armed&&e.code==='Space'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)net({type:'harpoonReel',pulling:true});}
},true);
addEventListener('keyup',e=>{if(e.code==='Space'&&armed){net({type:'harpoonReel',pulling:false});e.preventDefault();e.stopImmediatePropagation();}},true);
addEventListener('blur',()=>net({type:'harpoonReel',pulling:false}));
export function fireHarpoon(){
 if(!armed)return false;
 if(hunt)return true;
 const dir=new THREE.Vector3();camera.getWorldDirection(dir);
 const t=(-.1-camera.position.y)/dir.y;
 if(t>0&&t<120)net({type:'harpoonShot',x:camera.position.x+dir.x*t,z:camera.position.z+dir.z*t});
 return true;
}
export function syncTuna(data,ships){
 if(!data)return;hunt=data.hunt;
 if(!S.ship||S.world?.ships.find(s=>s.id===S.ship)?.type!=='barca')armed=false;
 if(hunt)armed=true;
 const seen=new Set();
 for(const[id,x,z,heading,kg,hooked]of data.fish){seen.add(id);let f=fish.get(id);
  if(!f){f=makeFish('tuna');f.scale.setScalar(1.15);f.name='visibleTuna';optimizeStatic(f);scene.add(f);fish.set(id,f);}
  f.position.set(x,-.13,z);f.rotation.y=heading;f.userData.hooked=hooked;
 }
 for(const[id,f]of fish)if(!seen.has(id)){scene.remove(f);fish.delete(id);}
 const shotIds=new Set();for(const[id,x,z,dx,dz]of data.shots){shotIds.add(id);let b=bolts.get(id);if(!b){b=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,2,6),M(0xbeb8a7));b.rotation.x=Math.PI/2;b.name='tunaHarpoon';scene.add(b);bolts.set(id,b);}b.position.set(x,.13,z);b.rotation.set(Math.PI/2,0,-Math.atan2(dx,dz));}
 for(const[id,b]of bolts)if(!shotIds.has(id)){scene.remove(b);b.geometry.dispose();bolts.delete(id);}
 for(const s of S.world?.ships||[]){if(s.type!=='barca')continue;const obj=ships.get(s.id)?.obj;if(!obj)continue;
  const host=obj.userData.rock||obj,signature=JSON.stringify(s.tunaHold||[]);
  if(obj.userData.tunaSignature===signature)continue;obj.userData.tunaSignature=signature;
  for(const old of obj.userData.tunaCargo||[])host.remove(old);obj.userData.tunaCargo=[];
  (s.tunaHold||[]).forEach((f,i)=>{if(!f)return;const mesh=makeFish('tuna');mesh.name='physicalTunaCatch';optimizeStatic(mesh);mesh.scale.setScalar(1.1);mesh.position.set(i===0?-1.9:1.9,.75,0);mesh.rotation.z=Math.PI/2;host.add(mesh);obj.userData.tunaCargo.push(mesh);});
 }
 panel.style.display=armed?'block':'none';
 if(armed){panel.innerHTML=hunt?`<b>Тунец ${hunt.kg} кг · ${hunt.surge?'⚠ РЫВОК — отпустите Пробел':'Подтягивайте: держите Пробел'}</b><p>Подтянуто ${Math.round(hunt.progress*100)}%</p><progress max="1" value="${hunt.progress}" style="width:100%"></progress><p>Натяжение ${Math.round(hunt.tension*100)}% — при 100% линь рвётся</p><div style="height:10px;background:#363c40"><div style="height:100%;width:${Math.min(100,hunt.tension*100)}%;background:${hunt.tension>.7?'#ef5344':'#78bfa6'}"></div></div><small>Отпускайте Пробел для ослабления · H — отпустить рыбу</small>`:'<b>Кормовой гарпун · H — убрать снасть</b><p>Остановите баркас. Найдите видимого тунца у поверхности и развернитесь кормой к нему.</p><p>Наведите центральный прицел с упреждением движения рыбы. ЛКМ — выстрел, дальность 60 м, перезарядка 3 с.</p>';
 }
 line.visible=!!hunt&&!!fish.get(hunt?.fid)&&!!ships.get(hunt?.sid);
 if(line.visible){const s=ships.get(hunt.sid).obj,f=fish.get(hunt.fid),a=new THREE.Vector3(0,1.7,-4.08);s.localToWorld(a);line.geometry.setFromPoints([a,f.position.clone()]);}
}
