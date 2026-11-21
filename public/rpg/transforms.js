// Update visible branches once per frame. A hidden child may miss parent updates,
// and a mesh with matrixAutoUpdate=false still needs its first world transform.
const states = new WeakMap();
export function updateVisibleMatrices(root, force = false) {
  if (!root.visible) return;
  let state = states.get(root);
  const parentVersion = states.get(root.parent)?.version || 0;
  if (!state) {
    state = { version: 0, parent: root.parent, parentVersion, local: null };
    states.set(root, state);
    force = true;
  } else if (state.parent !== root.parent || state.parentVersion !== parentVersion) force = true;
  if (root.matrixAutoUpdate) {
    const p = root.position, q = root.quaternion, s = root.scale, old = state.local;
    if (!old || old[0] !== p.x || old[1] !== p.y || old[2] !== p.z || old[3] !== q.x || old[4] !== q.y || old[5] !== q.z || old[6] !== q.w || old[7] !== s.x || old[8] !== s.y || old[9] !== s.z) {
      const local = state.local ||= new Float64Array(10);
      local[0] = p.x; local[1] = p.y; local[2] = p.z;
      local[3] = q.x; local[4] = q.y; local[5] = q.z; local[6] = q.w;
      local[7] = s.x; local[8] = s.y; local[9] = s.z;
      root.updateMatrix();
    }
  }
  if (root.matrixWorldNeedsUpdate || force) {
    if (root.matrixWorldAutoUpdate) {
      if (root.parent) root.matrixWorld.multiplyMatrices(root.parent.matrixWorld, root.matrix);
      else root.matrixWorld.copy(root.matrix);
    }
    root.matrixWorldNeedsUpdate = false;
    state.version++;
    force = true;
  }
  state.parent = root.parent; state.parentVersion = parentVersion;
  for (const child of root.children) updateVisibleMatrices(child, force);
}
