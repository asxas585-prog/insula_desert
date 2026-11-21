// Distant troops share articulated model parts. Positions still update every frame;
// animation runs once per type/pose, instead of once per individual soldier.
import * as THREE from 'three';
export class UnitRenderer {
  constructor(scene, makeTemplate, animate) { this.scene=scene; this.makeTemplate=makeTemplate; this.animate=animate; this.batches=new Map(); this.matrix=new THREE.Matrix4(); }
  begin(){for(const b of this.batches.values())b.units.length=0;}
  add(unit, state){
    const phase=unit.id%2, action=state.attack ? state.attack.kind+'/'+(state.attack.p<.55?'wind':'release') : state.speed>.2?'walk':'idle';
    const key=`${unit.type}/${state.ride?1:0}/${action}/${phase}`;
    let b=this.batches.get(key);
    if(!b){const template=this.makeTemplate(unit); const parts=[]; template.traverse(o=>{if(o.isMesh&&o.visible&&o.layers.test(new THREE.Layers()))parts.push(o);}); b={template,parts,meshes:[],units:[],capacity:0,phase}; this.batches.set(key,b);}
    b.units.push({unit,state});
  }
  end(dt,t){
    for(const [key,b] of this.batches){
      if(!b.units.length){for(const m of b.meshes)m.visible=false;if(t-(b.lastUsed||0)>20){this.dispose(b);this.batches.delete(key);}continue;}b.lastUsed=t;
      if(b.units.length>b.capacity){
        for(const m of b.meshes){this.scene.remove(m);m.dispose();}
        b.capacity=2**Math.ceil(Math.log2(Math.max(8,b.units.length)));
        b.meshes=b.parts.map(p=>{const m=new THREE.InstancedMesh(p.geometry,p.material,b.capacity);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.castShadow=p.castShadow;m.receiveShadow=p.receiveShadow;m.frustumCulled=false;m.name='troopBatch_'+key;this.scene.add(m);return m;});
      }
      for(const {unit} of b.units)unit.obj.updateMatrix();
      const state=b.units[0].state;
      this.animate(b.template,dt,{...state,t:t+b.phase*.23});
      // Separate phases prevent every soldier in a formation stepping in unison.
      if(b.template.userData._an&&!b.phased){b.template.userData._an.ph=b.phase*.5;b.phased=true;}
      b.template.updateMatrixWorld(true);
      for(let j=0;j<b.parts.length;j++){
        const mesh=b.meshes[j],part=b.parts[j];mesh.visible=true;for(let node=part;node;node=node.parent)if(!node.visible){mesh.visible=false;break;}mesh.count=b.units.length;
        for(let i=0;i<b.units.length;i++){
          const obj=b.units[i].unit.obj;
          this.matrix.multiplyMatrices(obj.matrix,part.matrixWorld);mesh.setMatrixAt(i,this.matrix);
        }
        mesh.instanceMatrix.needsUpdate=true;
      }
    }
  }
  dispose(b){for(const m of b.meshes){this.scene.remove(m);m.dispose();}b.template.traverse(o=>{if(o.userData.compiledGeometry)o.geometry.dispose();});}
  clear(){for(const b of this.batches.values())this.dispose(b);this.batches.clear();}
}
