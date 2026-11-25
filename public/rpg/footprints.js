// Full model bounds (Three.js Box3), including steps and eaves, plus 0.25 m clearance.
// Shared by land purchase and client/server placement.
const BOUNDS = {"forum":[-10.3,10.3,-10.3,10.65],"horreum":[-7.986,6.725,-4.23,5.706],"fabrica":[-4.925,4.925,-6.25,3.7],"ferraria":[-4.925,4.925,-5.03,3.934],"pistrinum":[-4.6,4.6,-6.3,3.6],"macellum":[-8.73,8.73,-7.33,7.225],"portus":[-38.35,38.35,-14.73,46.25],"castra":[-9.8,9.8,-9.8,10.35],"thermae":[-7.9,7.8,-7.73,6.85],"taberna":[-4.275,4.429,-4.38,5.32],"templum":[-5.5,5.5,-10.025,10.2],"turris":[-2.75,2.75,-2.75,2.75],"murus":[-5.8,5.8,-2.1,1.175],"pharos":[-4.4,4.4,-6.05,4.4],"stabulum":[-7.3,7.075,-8.18,7.91],"collegium":[-8.82,8.82,-9.075,9.35],"amphitheatrum":[-62.431,62.431,-49.12,49.12],"forum_m":[-36.45,36.45,-26.8,26.8],"curia":[-5.73,5.73,-8.225,6.85],"stall":[-2.3,2.802,-1.933,2.041],"mercator":[-5.075,5.075,-4.23,4.13],"servile":[-7.241,7.278,-4.197,3.27],"theatrum":[-23.896,24.362,-24.362,17.156],"armamentarium":[-6.55,6.55,-7.05,7.521],"castellum":[-4.634,4.634,-5.334,3.934],"domus":[-4.65,4.65,-4.65,5.202],"farm":[-6.805,6.502,-6.63,5.91],"olivetum":[-6.948,6.911,-7.039,6.647],"vinea":[-8.115,7.35,-5.75,5.75],"lumber":[-4.977,4.753,-5.65,4.907],"figlina":[-4.874,5.05,-5.353,4.01],"fishery":[-5.525,4.154,-5.63,6.906],"pecus":[-5.502,5.502,-4.51,4.51],"linarium":[-5.85,6.45,-5.05,6.15],"equile":[-4.725,4.725,-5.63,5.71],"ludus":[-8.7,8.7,-8.53,8.695],"vivarium":[-8.225,8.225,-8.33,8.1],"insula":[-4.625,5.16,-4.83,4.796],"balneum":[-4.5,4.63,-4.75,3.85],"popina":[-3.975,3.975,-3.98,3.399],"fullonica":[-4.625,4.625,-4.73,4.45],"officina":[-3.85,3.85,-3.806,3.65],"campus":[-8.6,8.6,-8.975,8.6],"horreum_s":[-4.425,4.425,-4.23,5.238],"navalia":[-9.55,8.307,-9.568,12.771],"murex_farm":[-5.375,5.15,-5.38,11.6],"alvearia":[-3.75,3.75,-3.75,3.805],"salinae":[-5.85,5.85,-5.85,5.85],"villa":[-9.802,10.175,-9.18,10.43],"praetorium":[-7.202,7.202,-7.38,7.29],"statio":[-5.85,6.319,-5.83,5.85],"emporium":[-6.825,6.6,-6.73,12.873],"warehouse":[-4.425,4.425,-4.23,5.238],"supply_depot":[-4.425,4.425,-4.23,5.238],"quarters":[-4.65,4.65,-4.65,5.202],"colonia":[-9.571,9.571,-9.59,9.6]};
export function footprint(b,def={}) {
 const type=({warehouse:'horreum_s',supply_depot:'horreum_s',quarters:'domus'})[b.type]||b.type,v=BOUNDS[type]||[-(def.r||4),def.r||4,-(def.r||4),def.r||4],a=b.ry||0,c=Math.cos(a),s=Math.sin(a),u=(v[0]+v[1])/2,vv=(v[2]+v[3])/2;
 return {x:b.x+c*u+s*vv,z:b.z-s*u+c*vv,hw:(v[1]-v[0])/2,hd:(v[3]-v[2])/2,c,s};
}
export function overlaps(a,ad,b,bd,gap=.15){
 const A=footprint(a,ad),B=footprint(b,bd),dx=B.x-A.x,dz=B.z-A.z;
 for(const [x,z] of [[A.c,-A.s],[A.s,A.c],[B.c,-B.s],[B.s,B.c]]){
  const ra=A.hw*Math.abs(x*A.c-z*A.s)+A.hd*Math.abs(x*A.s+z*A.c),rb=B.hw*Math.abs(x*B.c-z*B.s)+B.hd*Math.abs(x*B.s+z*B.c);
  if(Math.abs(dx*x+dz*z)>=ra+rb+gap)return false;
 }return true;
}
export function cellOverlaps(x,z,ry,size,b,def){return overlaps({x,z,ry,type:'__cell'},{r:size/2},b,def);}

export function plotSize(type,cell=4){const b=BOUNDS[type];return b?Math.max(1,Math.ceil(2*Math.max(...b.map(Math.abs))/cell)):null;}
