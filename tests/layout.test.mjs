import test from 'node:test';
import assert from 'node:assert/strict';
import * as WG from '../public/rpg/world.js';
import * as D from '../public/rpg/data.js';
import {arrangeCityAdditions} from '../rpg/layout.js';

test('harbour reservation covers both wings, quay, piers and rotated approach',()=>{
  for(const ry of [0,Math.PI/2,1.1]){
    const port={x:100,z:70,ry};
    for(const [u,v] of [[40,-20],[-40,-20],[26,45],[-26,45],[0,-36]]){
      const x=port.x+u*Math.cos(ry)+v*Math.sin(ry),z=port.z-u*Math.sin(ry)+v*Math.cos(ry);
      assert(WG.portOverlap(x,z,1,[port]),`${ry}:${u},${v}`);
    }
    const [x,z]=[port.x+100*Math.cos(ry),port.z-100*Math.sin(ry)];
    assert(!WG.portOverlap(x,z,7,[port]));
  }
});

const world=WG.generateWorld(9001);
WG.setMuniFootprints(world.cities);
test('every city has a grid-aligned guild outside harbour buildings',()=>{
  for(const C of world.cities){
    const b=C.layout.find(b=>b.type==='collegium');assert(b,C.id);
    const snap=WG.blockSnap(C,b.x,b.z,D.cellsOf('collegium'));
    assert(Math.hypot(b.x-snap.x,b.z-snap.z)<.15,C.id);
    assert(!WG.portOverlap(b.x,b.z,D.BUILDINGS.collegium.r,C.layout.filter(q=>q.type==='portus')),C.id);
  }
});
test('old additions in Messana relocate onto free city cells and retain all stock',()=>{
  const C=world.cities.find(c=>c.id==='messana'),port=C.layout.find(b=>b.type==='portus');
  const W={plots:{'messana:50:50':'alice'},buildings:C.layout.map((b,i)=>({...b,id:i+1,muni:C.id+':'+i}))};
  const additions=['warehouse','quarters','supply_depot'].map((type,i)=>({id:1000+i,type,city:C.id,owner:'alice',x:port.x+3*i,z:port.z-5,built:true,store:{wood:73},slaves:[91],hp:123,ry:0}));
  W.buildings.push(...additions);
  const moved=arrangeCityAdditions(W,world.cities);assert.equal(moved.length,3);
  for(const b of additions){
    assert.deepEqual(b.store,{wood:73});assert.deepEqual(b.slaves,[91]);assert.equal(b.hp,123);assert(b.built);
    assert.equal(b.blk.n,3);assert.equal(b.ry,C.ry);assert(!WG.portOverlap(b.x,b.z,D.BUILDINGS[b.type].r,[port]));
    const snap=WG.blockSnap(C,b.x,b.z,b.blk.n);assert(Math.hypot(b.x-snap.x,b.z-snap.z)<.001);
    for(let i=b.blk.i0;i<b.blk.i0+b.blk.n;i++)for(let j=b.blk.j0;j<b.blk.j0+b.blk.n;j++){
      assert(WG.cellFree(C,i,j));assert.equal(W.plots[`messana:${i}:${j}`],'alice');
    }
    for(const other of W.buildings.filter(q=>q!==b))assert(Math.hypot(other.x-b.x,other.z-b.z)>=D.BUILDINGS[b.type].r+D.BUILDINGS[other.type].r+1);
  }
  assert.equal(W.plots['messana:50:50'],'alice');
  assert.deepEqual(arrangeCityAdditions(W,world.cities),[],'repeat restart must keep the corrected positions');
});

test('Messana southern gate road ends at the actual arena entrance and guild is near port',()=>{
 const c=world.cities.find(c=>c.id==='messana'),arena=c.layout.find(b=>b.type==='amphitheatrum'),gate=c.gates.reduce((a,b)=>a.z>b.z?a:b),road=c.streets.find(s=>s.arenaApproach);
 const junction=c.junctions[0],link=c.streets.find(s=>s.arenaGateLink);assert.deepEqual(link.pts,[[gate.x,gate.z],[junction.x,junction.z]]);assert.deepEqual(road.pts[0],[junction.x,junction.z]);assert.deepEqual(road.pts[1],[arena.entrance.x,arena.entrance.z]);
 const dx=gate.x-arena.x,dz=gate.z-arena.z,d=Math.hypot(dx,dz);assert(Math.abs(Math.cos(arena.ry)-dx/d)<1e-9);assert(Math.abs(-Math.sin(arena.ry)-dz/d)<1e-9);
 const guild=c.layout.find(b=>b.type==='collegium'),port=c.layout.find(b=>b.type==='portus');assert(Math.hypot(guild.x-port.x,guild.z-port.z)<75);
});

test('Messana junction is outside the wall and shares full-width mouths with every road',()=>{
 const c=world.cities[0],j=c.junctions[0],r=world.roads.find(r=>r.id===j.road);assert(j.arms.length===3);assert(Math.hypot(j.x-c.x,j.z-c.z)>c.R+15);assert(r.pts.some(p=>Math.hypot(p[0]-j.x,p[1]-j.z)<1e-8));
 const inside=p=>j.polygon.every((a,i)=>{const b=j.polygon[(i+1)%j.polygon.length];return(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-1e-7;});
 for(const arm of j.arms){const d=Math.hypot(arm.x-j.x,arm.z-j.z),dx=(arm.x-j.x)/d,dz=(arm.z-j.z)/d,reach=Math.min(10,d/2);for(const side of [-1,0,1])assert(inside([j.x+dx*reach-dz*arm.width*.5*side,j.z+dz*reach+dx*arm.width*.5*side]));}
 assert(inside([j.x,j.z]));const gateLink=c.streets.find(s=>s.arenaGateLink);assert(Math.abs(gateLink.junctionEnd-Math.min(10,Math.hypot(gateLink.pts[0][0]-j.x,gateLink.pts[0][1]-j.z)/2))<1e-8);
});

test('the whole paved junction has a walkable surface matching the mesh height',()=>{
 const j=world.cities[0].junctions[0],height=WG.terrainHeight(j.x,j.z)+.14;
 for(const p of j.polygon){const x=j.x+(p[0]-j.x)*.9,z=j.z+(p[1]-j.z)*.9;assert(Math.abs(WG.deckHeight(x,z,[])-height)<1e-8);}
});
