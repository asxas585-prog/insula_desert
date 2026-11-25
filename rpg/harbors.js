import { G, WG } from './state.js';

export const HARBOR_SAFE_RADIUS = 180;
export function inHarborZone(x, z, padding = 0) {
  return G.W.buildings.some(b => ['portus', 'emporium'].includes(b.type) && b.built && !b.ruined
    && Math.hypot(x - b.x, z - b.z) < HARBOR_SAFE_RADIUS + padding);
}
export function pirateWater(x, z, hull = 15) {
  return !inHarborZone(x, z, hull / 2 + 4) && WG.shipOk(x, z);
}
export function safePirateSpawn(x, z, hull = 15) {
  if (pirateWater(x, z, hull)) return { x, z };
  for (let r = 20; r <= 420; r += 20) for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16, nx = x + Math.sin(a) * r, nz = z + Math.cos(a) * r;
    if (pirateWater(nx, nz, hull)) return { x: nx, z: nz };
  }
  return null;
}
