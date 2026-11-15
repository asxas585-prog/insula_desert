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
    const def = D.BUILDINGS[b.type], n = D.cellsOf(b.type);
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
