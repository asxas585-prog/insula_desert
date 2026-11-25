// Physical wall/column footprints share the collider catalogue with walking.
import fs from 'node:fs';
import {G,D,WG} from './state.js';
const shapes=JSON.parse(fs.readFileSync(new URL('../public/rpg/colliders.json',import.meta.url),'utf8'));
let cacheKey='',grid=new Map();
const key=(x,z)=>Math.floor(x/16)+','+Math.floor(z/16);
export function prepareProjectileObstacles(){
 const buildings=G.W.buildings||[],signature=buildings.map(b=>[b.id,b.type,b.x,b.z,b.ry,b.built,b.muni].join(':')).join('|');
 if(signature===cacheKey)return;cacheKey=signature;grid=new Map();
 for(const b of buildings){if(!b.built&&!b.muni||D.BUILDINGS[b.type]?.road)continue;const c=Math.cos(b.ry||0),s=Math.sin(b.ry||0),base=WG.terrainHeight(b.x,b.z);
  const type=({warehouse:'horreum_s',supply_depot:'horreum_s',quarters:'domus'})[b.type]||b.type;
  for(const shape of shapes[type]||[]){const [lx,lz]=shape,x=b.x+lx*c+lz*s,z=b.z-lx*s+lz*c,a=(b.ry||0)+(shape[4]||0),hw=shape.length===3?shape[2]:shape[2]/2,hd=shape.length===3?shape[2]:shape[3]/2,r=Math.hypot(hw,hd),item={x,z,hw,hd,c:Math.cos(a),s:Math.sin(a),round:shape.length===3,base,top:base+(type==='amphitheatrum'?(Math.hypot(lx/1.35,lz/1.35)>37?18:3.6):4)};
   for(let i=Math.floor((x-r)/16);i<=Math.floor((x+r)/16);i++)for(let j=Math.floor((z-r)/16);j<=Math.floor((z+r)/16);j++){const k=i+','+j;let arr=grid.get(k);if(!arr)grid.set(k,arr=[]);arr.push(item);}
  }
 }
}
export function projectileBlocked(x,y,z){
 for(const b of grid.get(key(x,z))||[]){if(y<b.base||y>b.top)continue;const dx=x-b.x,dz=z-b.z;if(b.round?Math.hypot(dx,dz)<b.hw:Math.abs(dx*b.c-dz*b.s)<b.hw&&Math.abs(dx*b.s+dz*b.c)<b.hd)return true;}
 // City wall ring, with the same open gate spans as navigation. Sea sections have no wall.
 for(const C of G.world.cities||[]){if(Math.abs(Math.hypot(x-C.x,z-C.z)-C.R)>1.5)continue;const h=WG.terrainHeight(x,z);if(h<0||y<h||y>h+8)continue;const a=Math.atan2(x-C.x,z-C.z),gate=C.gates?.find(g=>Math.abs(Math.atan2(Math.sin(a-g.a),Math.cos(a-g.a)))<5.5/C.R);if(!gate||G.W.gates?.[C.id]?.closed)return true;}
 return false;
}
