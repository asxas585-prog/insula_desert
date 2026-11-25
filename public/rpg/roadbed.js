// A level cross-section with a bounded longitudinal grade. Rivers remain unmodified.
export function buildRoadbeds(roads,height,{maxGrade=.12,width=3,shoulder=9}={}){
 const grid=new Map(),sections=[],key=(x,z)=>Math.floor(x/32)+','+Math.floor(z/32);
 for(const road of roads){
  const pts=[];
  for(let i=1;i<road.pts.length;i++){const a=road.pts[i-1],b=road.pts[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4));for(let k=0;k<n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n;pts.push({x,z,raw:height(x,z)});}}
  const end=road.pts.at(-1);pts.push({x:end[0],z:end[1],raw:height(...end)});
  const raw=pts.map(p=>Math.max(1.1,p.raw));
  for(let i=0;i<pts.length;i++){let total=0,n=0;for(let j=Math.max(0,i-5);j<=Math.min(pts.length-1,i+5);j++){total+=raw[j];n++;}pts[i].y=Math.min(raw[i],total/n);}
  pts[0].y=raw[0];pts.at(-1).y=raw.at(-1);
  // The lower Lipschitz envelope cuts humps, while keeping endpoints no higher than their gates.
  for(let pass=0;pass<2;pass++){
   for(let i=1;i<pts.length;i++)pts[i].y=Math.min(pts[i].y,pts[i-1].y+maxGrade*Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z));
   for(let i=pts.length-2;i>=0;i--)pts[i].y=Math.min(pts[i].y,pts[i+1].y+maxGrade*Math.hypot(pts[i].x-pts[i+1].x,pts[i].z-pts[i+1].z));
  }
  road.profile=pts;
  for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i],s={a,b,road:road.id};sections.push(s);
   for(let x=Math.floor((Math.min(a.x,b.x)-shoulder)/32);x<=Math.floor((Math.max(a.x,b.x)+shoulder)/32);x++)for(let z=Math.floor((Math.min(a.z,b.z)-shoulder)/32);z<=Math.floor((Math.max(a.z,b.z)+shoulder)/32);z++){const k=x+','+z;let list=grid.get(k);if(!list)grid.set(k,list=[]);list.push(s);}
  }
 }
 function at(x,z){let best=null,dist=shoulder;for(const s of grid.get(key(x,z))||[]){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=Math.max(0,Math.min(1,((x-s.a.x)*dx+(z-s.a.z)*dz)/(dx*dx+dz*dz||1))),d=Math.hypot(x-s.a.x-dx*t,z-s.a.z-dz*t);if(d<dist){dist=d;best={y:s.a.y+(s.b.y-s.a.y)*t,d,road:s.road};}}return best;}
 return{at,sections,terrain(x,z,natural){if(natural<.6)return natural;const p=at(x,z);if(!p)return natural;const q=Math.max(0,Math.min(1,(p.d-width)/(shoulder-width))),blend=q*q*(3-2*q);return p.y*(1-blend)+natural*blend;}};
}
