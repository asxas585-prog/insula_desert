import {G,D,WG,now,dist,send} from './state.js';
// Seating crosses the entire arena; it is an authorized action, not a walking-speed exception.
export function arenaSeat(p,m){
 const b=G.W.buildings.find(b=>b.id===m.bid&&b.type==='amphitheatrum'&&b.built&&!b.ruined&&!b.enemy);
 if(!b||!p.alive||p.ship||p.inst||dist(p,b)>100||!Number.isFinite(m.angle)||!Number.isInteger(m.tier)||m.tier<3||m.tier>10)return null;
 const th=m.angle,k=m.tier,cs=Math.cos(b.ry||0),sn=Math.sin(b.ry||0),base=WG.bldBase(b,D.BUILDINGS.amphitheatrum.r),s0=(k+.5)/13;
 const a=(25.9+(41.6-25.9)*s0)*1.35,bb=(17.9+(32.6-17.9)*s0)*1.35,lx=a*Math.cos(th),lz=bb*Math.sin(th),x=b.x+lx*cs+lz*sn,z=b.z-lx*sn+lz*cs,y=base+3.6+(14.2-3.6)*(k+1)/13+.05;
 const gx=Math.cos(th)>0?66.15:-66.15,seat={bid:b.id,x,z,y,ry:Math.atan2(b.x-x,b.z-z),ox:b.x+gx*cs,oz:b.z-gx*sn};
 Object.assign(p,{x,z,y,ry:seat.ry,mounted:false,run:false,block:false,ranged:null,moveSpeed:0,lanceCharge:0,moveCredit:0,moveBudgetAt:now(),lastMv:now(),dirtyChar:true});
 p.jh=Math.max(0,y-Math.max(0,WG.terrainHeight(x,z)));
 p.arenaSeat=seat;send(p,{type:'arenaSeated',seat});return seat;
}
export function arenaLeave(p){
 const seat=p.arenaSeat;if(!seat||!p.alive||p.ship||p.inst||dist(p,seat)>3)return false;
 const x=seat.ox,z=seat.oz,y=Math.max(0,WG.deckHeight(x,z,G.W.buildings)??WG.terrainHeight(x,z));
 Object.assign(p,{x,z,y,jh:0,arenaSeat:null,mounted:false,run:false,moveSpeed:0,lanceCharge:0,moveCredit:0,moveBudgetAt:now(),lastMv:now(),dirtyChar:true});
 send(p,{type:'arenaLeft',x,z,y});return true;
}
