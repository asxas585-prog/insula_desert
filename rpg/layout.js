import * as D from '../public/rpg/data.js';
import * as WG from '../public/rpg/world.js';

// Repair placements of the additions from early saves without losing their stock,
// workers or construction progress. Ordinary valid player placements stay intact.
export function arrangeCityAdditions(W, cities) {
  const moved = [];
  const ports = W.buildings.filter(b => b.type === 'portus');
  W.plots ||= {};
  for (const b of W.buildings) {
    if (b.muni || b.lat || !b.owner || !['warehouse', 'supply_depot', 'quarters'].includes(b.type)) continue;
    const C = cities.find(c => c.id === b.city) || cities.find(c => Math.hypot(c.x-b.x,c.z-b.z) <= c.R+140);
    if (!C) continue;
    const def = D.BUILDINGS[b.type], n = b.blk?.n || D.cellsOf(b.type);
    const cells = p => Array.from({length:n*n}, (_,k) => [p.i0+k%n,p.j0+Math.floor(k/n)]);
    const fits = (p, owned) => {
      const dd = WG.districtAt(p.x,p.z);
      if (!dd || dd.city !== C.id || WG.portOverlap(p.x,p.z,def.r,ports)) return false;
      const sl = WG.slopeAt(p.x,p.z,def.r*.75);
      if (sl.lo < .5 || sl.d > Math.max(3.5,def.r*.4) || WG.waterEdgeDist(p.x,p.z) < def.r+22) return false;
      if (W.buildings.some(o => o !== b && Math.hypot(o.x-p.x,o.z-p.z) < (D.BUILDINGS[o.type]?.r||4)+def.r+1)) return false;
      return cells(p).every(([i,j]) => {
        const owner = W.plots[`${C.id}:${i}:${j}`];
        return WG.cellFree(C,i,j) && (owned ? owner === b.owner : !owner || owner === b.owner);
      });
    };
    const origin = WG.blockSnap(C,b.x,b.z,n);
    const angle = (b.ry-(C.ry||0))/(Math.PI/2);
    if (Math.hypot(origin.x-b.x,origin.z-b.z) < .15 && Math.abs(angle-Math.round(angle)) < .025 && fits(origin,true)) continue;
    let target = null;
    // Existing owned land is preferred. A correction may grant the replacement
    // footprint; purchased old plots remain owned rather than being silently lost.
    for (const owned of [true,false]) {
      const seen = new Set();
      for (let k=0;k<5000&&!target;k++) {
        const i0=origin.i0+Math.round(Math.cos(k*2.399)*Math.sqrt(k)),j0=origin.j0+Math.round(Math.sin(k*2.399)*Math.sqrt(k));
        const key=i0+':'+j0;if(seen.has(key))continue;seen.add(key);
        const [x,z]=WG.cityPt(C,(i0+n/2)*D.CELL,(j0+n/2)*D.CELL),p={i0,j0,x,z};
        if(fits(p,owned))target=p;
      }
      if(target)break;
    }
    if(!target)continue;
    b.x=target.x;b.z=target.z;b.ry=C.ry||0;b.city=C.id;
    b.blk={city:C.id,i0:target.i0,j0:target.j0,n};
    for(const [i,j] of cells(target))W.plots[`${C.id}:${i}:${j}`]=b.owner;
    b.gridRepair=1;
    moved.push(b.id);
  }
  return moved;
}

export function protectCivicLayout(W,C){
 const privateBuildings=W.buildings.filter(b=>!b.muni&&!D.BUILDINGS[b.type]?.road);
 const claims=Object.keys(W.plots||{}).filter(k=>k.startsWith(C.id+':')).map(k=>{const[,i,j]=k.split(':');const[x,z]=WG.cellCenter(C,+i,+j);return{x,z};});
 for(const L of C.layout){
  if(!['curia','templum','mercator','thermae','armamentarium','theatrum','horreum','stabulum','campus','servile','collegium'].includes(L.type))continue;
  const r=D.BUILDINGS[L.type].r;
  const clear=p=>!WG.portOverlap(p.x,p.z,r,C.layout.filter(q=>q.type==='portus'))&&!privateBuildings.some(b=>Math.hypot(b.x-p.x,b.z-p.z)<r+(D.BUILDINGS[b.type]?.r||4)+3)&&!claims.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<r+3);
  if(clear(L))continue;
  let found=null;
  for(let d=24;d<C.R+240&&!found;d+=4)for(const side of [-1,1])for(const axis of [0,1]){
   const [x,z]=WG.cityPt(C,axis?side*d:-r-7,axis?r+7:side*d),p=WG.blockSnap(C,x,z,D.cellsOf(L.type));
   if(WG.terrainHeight(p.x,p.z)<1||WG.slopeAt(p.x,p.z,r*.7).d>4||!clear(p)||C.layout.some(o=>o!==L&&Math.hypot(o.x-p.x,o.z-p.z)<r+(D.BUILDINGS[o.type]?.r||4)+3))continue;
   found={x:p.x,z:p.z,ry:C.ry+(axis?Math.PI:Math.PI/2)};break;
  }
  if(found)Object.assign(L,found,{avenue:true});
 }
 WG.extendCivicAvenues(C);
}
