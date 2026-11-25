import * as THREE from 'three';
import { M, mesh } from './model_utils.js';

export function makeTrainingTarget() {
  const g = new THREE.Group(), wood = M(0x6d482d), straw = M(0xb39b62), red = M(0x963e2c);
  mesh(new THREE.BoxGeometry(0.2, 2.5, 0.22), wood, 0, 1.25, 0, g);
  mesh(new THREE.BoxGeometry(1.55, 0.17, 0.2), wood, 0, 0.12, 0, g);
  mesh(new THREE.BoxGeometry(0.18, 0.17, 1.05), wood, 0, 0.12, 0, g);
  mesh(new THREE.CylinderGeometry(0.48, 0.42, 0.18, 24), straw, 0, 1.7, 0.15, g).rotation.x = Math.PI / 2;
  const face = mesh(new THREE.CircleGeometry(0.44, 32), M(0xd9c794), 0, 1.7, 0.25, g);
  for (const [inner, outer] of [[0.12, 0.19], [0.32, 0.39]]) mesh(new THREE.RingGeometry(inner, outer, 32), red, 0, 1.7, 0.255, g);
  mesh(new THREE.CircleGeometry(0.07, 16), red, 0, 1.7, 0.26, g);
  mesh(new THREE.BoxGeometry(1.05, 0.14, 0.16), wood, 0, 1.15, 0, g);
  face.castShadow = false;
  return g;
}
