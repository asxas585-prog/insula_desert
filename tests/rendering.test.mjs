import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Object3D,Scene,Mesh,BoxGeometry,MeshBasicMaterial} from '../public/vendor/three.core.js';
import {updateVisibleMatrices} from '../public/rpg/transforms.js';
const x=o=>o.matrixWorld.elements[12];
test('a hidden terrain chunk initializes its frozen world matrix when first shown',()=>{
 const scene=new Scene(),group=new Group(),mesh=new Mesh(new BoxGeometry(),new MeshBasicMaterial());group.position.x=1200;mesh.matrixAutoUpdate=false;mesh.visible=false;scene.add(group);group.add(mesh);
 updateVisibleMatrices(scene);mesh.visible=true;updateVisibleMatrices(scene);assert.equal(x(mesh),1200);
});
test('a newly streamed frozen LOD inherits an already stationary chunk transform',()=>{
 const scene=new Scene(),group=new Group();group.position.x=-1536;scene.add(group);updateVisibleMatrices(scene);const mesh=new Object3D();mesh.matrixAutoUpdate=false;group.add(mesh);updateVisibleMatrices(scene);assert.equal(x(mesh),-1536);
});
test('a hidden child catches up with a parent that already moved in earlier frames',()=>{
 const scene=new Scene(),group=new Group(),child=new Object3D();scene.add(group);group.add(child);group.position.x=10;child.position.x=3;updateVisibleMatrices(scene);child.visible=false;group.position.x=40;updateVisibleMatrices(scene);updateVisibleMatrices(scene);child.visible=true;updateVisibleMatrices(scene);assert.equal(x(child),43);
});
test('a hidden ancestor restores the entire hierarchy after an earlier ancestor update',()=>{
 const scene=new Scene(),root=new Group(),hidden=new Group(),leaf=new Object3D();scene.add(root);root.add(hidden);hidden.add(leaf);hidden.position.x=4;leaf.position.x=5;updateVisibleMatrices(scene);hidden.visible=false;root.position.x=100;updateVisibleMatrices(scene);hidden.visible=true;updateVisibleMatrices(scene);assert.equal(x(leaf),109);
});
test('reparenting a stationary frozen mesh updates its world transform',()=>{
 const scene=new Scene(),a=new Group(),b=new Group(),child=new Object3D();a.position.x=20;b.position.x=80;child.matrixAutoUpdate=false;scene.add(a,b);a.add(child);updateVisibleMatrices(scene);b.add(child);updateVisibleMatrices(scene);assert.equal(x(child),80);
});
test('unchanged visible transforms do not recalculate world matrices every frame',()=>{
 const scene=new Scene(),group=new Group(),child=new Object3D();scene.add(group);group.add(child);updateVisibleMatrices(scene);let calls=0;const fn=child.matrixWorld.multiplyMatrices.bind(child.matrixWorld);child.matrixWorld.multiplyMatrices=(a,b)=>{calls++;return fn(a,b);};
 for(let i=0;i<10;i++)updateVisibleMatrices(scene);assert.equal(calls,0);group.position.x=10;updateVisibleMatrices(scene);assert.equal(calls,1);assert.equal(x(child),10);
});
