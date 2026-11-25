// Общие графические утилиты текущей RPG.
import * as THREE from 'three';

// «Виртуальный» источник света: в сцене постоянно живёт небольшой пул настоящих ламп (см. client.js),
// и каждый кадр они раздаются ближайшим виртуальным источникам. Так число источников света в шейдерах
// не меняется, когда кто-то зажигает факел или строит жаровню, — и браузер не пересобирает шейдеры (это давало фризы).
export const VLIGHTS = new Set();
export const LABEL_LAYER = 3; // подписи рисуются отдельным проходом поверх постобработки
export class VLight extends THREE.Object3D {
  constructor(color = 0xffffff, intensity = 1, distance = 0, decay = 2) {
    super();
    this.isVLight = true;
    this.color = new THREE.Color(color); this.intensity = intensity; this.distance = distance; this.decay = decay;
    this.castShadow = false;
    VLIGHTS.add(this);
  }
}
const matCache = new Map();
export function M(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: false, roughness: 0.9, metalness: 0, ...opts }));
  return matCache.get(key);
}
const geoCache = new Map();
const G = (key, fn) => { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); };
const DETAIL = 2;
const sph = (r, s = 8) => G(`s${r},${s}`, () => new THREE.SphereGeometry(r, Math.round(s * DETAIL), Math.max(4, Math.round((s - 2) * DETAIL))));
export function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

export function makeCloud(seed = 1) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, flatShading: true });
  const n = 5 + (seed % 4);
  for (let i = 0; i < n; i++) {
    const r = 6 + ((seed * 7 + i * 13) % 7);
    const c = new THREE.Mesh(sph(r, 7), m);
    c.position.set((i - n / 2) * 7 + ((seed * i) % 5), ((i * 3) % 4), ((i * 5 + seed) % 7) - 3);
    c.scale.y = 0.55;
    g.add(c);
  }
  return g;
}

export function makeLabel(text, color = '#fff', opt = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = 'bold 36px Georgia';
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  c.width = w; c.height = 52;
  ctx.font = 'bold 36px Georgia';
  if (opt.gold) {
    // золотое имя: тёмно-коричневая плашка с золотой рамкой, текст с градиентом и обводкой
    ctx.fillStyle = 'rgba(40,20,4,0.82)'; ctx.fillRect(0, 0, w, 52);
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, w - 3, 49);
    const gr = ctx.createLinearGradient(0, 6, 0, 46); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.5, '#ffd34d'); gr.addColorStop(1, '#c08a1e');
    ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#2a1404'; ctx.strokeText(text, 12, 27);
    ctx.fillStyle = gr; ctx.fillText(text, 12, 27);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, w, 52);
    ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(text, 12, 27);
    ctx.fillStyle = color; ctx.fillText(text, 12, 27);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: !!opt.occluded, depthWrite: false, transparent: true, toneMapped: false, fog: !!opt.occluded }));
  sp.layers.set(opt.occluded ? 0 : LABEL_LAYER);
  sp.scale.set(w / 52 * 0.45, 0.45, 1);
  sp.renderOrder = 10;
  return sp;
}
