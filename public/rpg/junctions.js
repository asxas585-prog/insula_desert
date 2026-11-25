// Convex paving between the full-width mouths of a three-way junction.
export function junctionPolygon(x, z, arms) {
  const points = [];
  for (const arm of arms) {
    const d = Math.hypot(arm.x-x,arm.z-z), dx = (arm.x-x)/d, dz = (arm.z-z)/d;
    const reach = Math.min(10,d/2), half = arm.width/2;
    for (const side of [-1,1]) points.push([x+dx*reach-dz*half*side,z+dz*reach+dx*half*side]);
  }
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  const lower=half(points),upper=half([...points].reverse());lower.pop();upper.pop();return lower.concat(upper);
}
