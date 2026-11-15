// Процедурные low-poly модели (Рим + пустыня)
import * as THREE from 'three';
import { ITEMS } from './shared.js';

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
const box = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const DETAIL = 2; // во сколько раз больше граней у круглых форм
const cyl = (rt, rb, h, s = 8, open = false) => G(`c${rt},${rb},${h},${s},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, Math.round(s * DETAIL), 1, open));
const sph = (r, s = 8) => G(`s${r},${s}`, () => new THREE.SphereGeometry(r, Math.round(s * DETAIL), Math.max(4, Math.round((s - 2) * DETAIL))));
const cone = (r, h, s = 8) => G(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s <= 5 ? s : Math.round(s * DETAIL)));

export function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

export const PAL = {
  stone: 0xe6dcc3, stoneDark: 0xbfb295, marble: 0xf3efe4, roof: 0xb4513a, roofDark: 0x8f3b2a,
  wood: 0x8a5a32, woodDark: 0x5e3b1f, sand: 0xe3c48d, skin: 0xd9a77c, bronze: 0xb08d3c, red: 0x9e2a22,
  green: 0x6f8f3a, leaf: 0x5d8a2e, dry: 0x9c8a4c, rock: 0xa89580, water: 0x2a9db0,
};

// ---------- Персонаж ----------
// spec — открытая специализация: от неё зависит снаряжение
export function makePlayer(color, spec = '') {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const tunic = M(color);
  const skin = M(PAL.skin);
  const leather = M(0x6b4423);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.17, 0.88, 0); legR.position.set(0.17, 0.88, 0);
  for (const leg of [legL, legR]) {
    mesh(cyl(0.1, 0.085, 0.82, 8), skin, 0, -0.42, 0, leg);
    mesh(box(0.2, 0.1, 0.32), leather, 0, -0.84, 0.05, leg);            // сандалия
    mesh(cyl(0.095, 0.095, 0.05, 8), leather, 0, -0.62, 0, leg);         // ремешки
    mesh(cyl(0.09, 0.09, 0.05, 8), leather, 0, -0.72, 0, leg);
  }
  body.add(legL, legR);
  mesh(cyl(0.3, 0.44, 0.55, 12), tunic, 0, 1.06, 0, body);              // подол
  mesh(cyl(0.33, 0.3, 0.62, 12), tunic, 0, 1.6, 0, body).scale.set(1, 1, 0.7); // торс
  mesh(cyl(0.31, 0.31, 0.09, 12), leather, 0, 1.3, 0, body).scale.set(1, 1, 0.72); // пояс
  mesh(box(0.08, 0.08, 0.04), M(PAL.bronze, { metalness: 0.6, roughness: 0.4 }), 0, 1.3, 0.23, body); // пряжка
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.4, 1.85, 0); armR.position.set(0.4, 1.85, 0);
  for (const arm of [armL, armR]) {
    mesh(sph(0.13, 8), tunic, 0, -0.02, 0, arm);                         // рукав
    mesh(cyl(0.075, 0.065, 0.68, 8), skin, 0, -0.36, 0, arm);
    mesh(sph(0.075, 6), skin, 0, -0.72, 0, arm);
  }
  body.add(armL, armR);
  const hand = new THREE.Group(); hand.position.set(0, -0.72, 0.05); armR.add(hand);
  mesh(cyl(0.08, 0.09, 0.18, 8), skin, 0, 2.02, 0, body);               // шея
  const head = new THREE.Group(); head.position.set(0, 2.32, 0); body.add(head);
  mesh(sph(0.25, 14), skin, 0, 0, 0, head).scale.set(0.95, 1.05, 1);
  mesh(box(0.06, 0.1, 0.08), skin, 0, -0.02, 0.24, head);              // нос
  mesh(sph(0.03, 5), M(0x1a1a1a), -0.09, 0.04, 0.22, head);             // глаза
  mesh(sph(0.03, 5), M(0x1a1a1a), 0.09, 0.04, 0.22, head);
  const hair = mesh(sph(0.265, 14), M(0x3b2a1a), 0, 0.06, -0.03, head); hair.scale.set(1, 0.85, 1);
  // детали лица: уши, брови, губы, чёлка
  for (const sx of [-1, 1]) {
    mesh(sph(0.055, 6), skin, sx * 0.245, 0, 0.0, head).scale.set(0.6, 1, 0.9);
    const br = mesh(box(0.09, 0.022, 0.03), M(0x2a1c10), sx * 0.09, 0.1, 0.225, head); br.rotation.z = -sx * 0.18;
    mesh(sph(0.012, 4), M(0xffffff), sx * 0.083, 0.045, 0.245, head);           // блик в глазу
  }
  mesh(box(0.08, 0.018, 0.02), M(0x8a3a2a), 0, -0.1, 0.235, head);           // губы
  for (let i = -2; i <= 2; i++) { const f = mesh(box(0.07, 0.07, 0.05), M(0x3b2a1a), i * 0.07, 0.19, 0.18 - Math.abs(i) * 0.02, head); f.rotation.x = -0.5; }
  // туника: тёмная кайма по подолу и вороту, перевязь через плечо, бронзовая фибула плаща, наручи
  const trim = M(new THREE.Color(color).multiplyScalar(0.55).getHex());
  mesh(cyl(0.447, 0.447, 0.07, 14), trim, 0, 0.82, 0, body);
  mesh(cyl(0.2, 0.24, 0.07, 12), trim, 0, 1.92, 0, body).scale.set(1, 1, 0.75);
  const strap = mesh(box(0.08, 0.86, 0.04), leather, 0.02, 1.62, 0.235, body); strap.rotation.z = 0.62;
  const strapB = mesh(box(0.08, 0.86, 0.04), leather, 0.02, 1.62, -0.235, body); strapB.rotation.z = -0.62;
  const bronzeM = M(PAL.bronze, { metalness: 0.6, roughness: 0.4 });
  for (const sx of [-1, 1]) { const fb = mesh(cyl(0.055, 0.055, 0.03, 10), bronzeM, sx * 0.27, 1.92, 0.13, body); fb.rotation.x = Math.PI / 2; }
  for (const arm of [armL, armR]) mesh(cyl(0.083, 0.078, 0.2, 8), leather, 0, -0.52, 0, arm);
  // плащ
  const cape = new THREE.Group(); cape.position.set(0, 1.92, -0.2); body.add(cape);
  mesh(box(0.62, 1.15, 0.05), M(PAL.red), 0, -0.56, 0, cape);
  // снаряжение по специализации
  if (spec === 'warrior') {
    const helm = M(0xc9a74a, { metalness: 0.7, roughness: 0.35 });
    mesh(sph(0.29, 12), helm, 0, 0.08, 0, head).scale.set(1, 0.85, 1.05);
    mesh(box(0.06, 0.18, 0.5), M(0xb01c1c), 0, 0.36, 0, head);            // гребень
    mesh(box(0.04, 0.22, 0.12), helm, -0.25, -0.1, 0.05, head);           // нащёчники
    mesh(box(0.04, 0.22, 0.12), helm, 0.25, -0.1, 0.05, head);
    mesh(box(0.72, 0.5, 0.05), helm, 0, 1.62, 0.21, body);                // нагрудник
    const shield = mesh(box(0.7, 1.0, 0.08), M(0x9e2a22), 0, 1.5, -0.32, body);
    mesh(sph(0.1, 8), helm, 0, 0, -0.05, shield);
  } else if (spec === 'farmer') {
    mesh(cyl(0.48, 0.48, 0.03, 14), M(0xe0c46a), 0, 0.2, 0, head);       // соломенная шляпа
    mesh(cone(0.22, 0.26, 12), M(0xd6b85a), 0, 0.33, 0, head);
  } else if (spec === 'craftsman') {
    mesh(box(0.5, 0.75, 0.04), leather, 0, 1.25, 0.25, body);            // фартук
    mesh(box(0.06, 0.32, 0.06), M(0x777777, { metalness: 0.5 }), 0.3, 1.2, 0.2, body); // молоток на поясе
    mesh(cyl(0.27, 0.27, 0.08, 12), M(0x8a6a4a), 0, 0.14, 0, head);       // шапочка
  } else if (spec === 'gatherer') {
    const basket = mesh(cyl(0.26, 0.2, 0.55, 10), M(0xb08a4a), 0, 1.55, -0.36, body);
    mesh(cyl(0.27, 0.27, 0.05, 10), M(0x8a6a3a), 0, 0.28, 0, basket);
    mesh(box(0.04, 0.6, 0.04), M(0x6e5438), 0.08, 0.4, 0, basket);        // торчащие ветки
  }
  // маска (видна, когда тёмная роль её надела)
  const mask = new THREE.Group(); mask.visible = false; head.add(mask);
  mesh(sph(0.27, 12), M(0x15151a), 0, -0.02, 0.02, mask).scale.set(1.02, 0.6, 1.02);
  mesh(box(0.08, 0.04, 0.02), M(0xffffff, { emissive: 0x999999 }), -0.09, 0.05, 0.26, mask);
  mesh(box(0.08, 0.04, 0.02), M(0xffffff, { emissive: 0x999999 }), 0.09, 0.05, 0.26, mask);
  g.userData = { body, legL, legR, armL, armR, hand, head, cape, mask, weapon: null, weaponType: null };
  return g;
}
// облик (скин) за ауреусы: головные уборы, плащи, нагрудники, пурпур и золото
export function applySkin(pl, sk) {
  if (!sk || sk.id === 'none') return;
  const u = pl.userData, H = u.head, Bd = u.body;
  const metal = (col) => M(col, { metalness: 0.75, roughness: 0.32 });
  if (sk.cape != null) u.cape.traverse((c) => { if (c.isMesh) c.material = M(sk.cape); });
  if (sk.capeTrim != null) { mesh(box(0.64, 0.06, 0.06), metal(sk.capeTrim), 0, -1.12, 0, u.cape); for (const sx of [-1, 1]) mesh(box(0.05, 1.15, 0.06), metal(sk.capeTrim), sx * 0.3, -0.56, 0, u.cape); }
  if (sk.laurel != null) {
    const lm = sk.laurel === 0xd4af37 ? metal(sk.laurel) : M(sk.laurel), dark = sk.laurel === 0xd4af37 ? metal(0xb8902a) : M(0x4f7a22);
    const ring = mesh(G('laurelP', () => new THREE.TorusGeometry(0.25, 0.03, 6, 18)), lm, 0, 0.13, -0.01, H); ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2; if (Math.abs(Math.sin(a / 2)) < 0.15) continue;
      for (const [up, m, tw] of [[0.03, lm, 0.5], [-0.015, dark, -0.5]]) { const lf = mesh(G('lleaf', () => new THREE.SphereGeometry(0.055, 6, 4)), m, Math.sin(a) * 0.26, 0.13 + up, Math.cos(a) * 0.26 - 0.01, H); lf.scale.set(0.45, 0.3, 1); lf.rotation.y = a + tw; }
    }
    if (sk.ribbons != null) for (const sx of [-1, 1]) { const rb = mesh(box(0.045, 0.34, 0.015), M(sk.ribbons), sx * 0.08, -0.1, -0.27, H); rb.rotation.z = sx * 0.18; }
  }
  if (sk.helm != null) {
    const hm = metal(sk.helm);
    mesh(sph(0.29, 12), hm, 0, 0.08, 0, H).scale.set(1, 0.85, 1.05);
    mesh(box(0.56, 0.05, 0.1), hm, 0, 0.05, 0.24, H);                     // козырёк
    mesh(box(0.5, 0.18, 0.08), hm, 0, -0.12, -0.27, H).rotation.x = 0.4;   // назатыльник
    if (sk.crest != null) { const c = mesh(box(0.06, 0.18, 0.5), M(sk.crest), 0, 0.36, 0, H); if (sk.crestSide) c.rotation.y = Math.PI / 2; mesh(box(0.03, 0.1, 0.06), hm, 0, 0.28, 0, H); }
    for (const sx of [-1, 1]) mesh(box(0.04, 0.22, 0.12), hm, sx * 0.25, -0.1, 0.05, H);
  }
  if (sk.band != null) { mesh(cyl(0.27, 0.27, 0.07, 14), M(sk.band), 0, 0.1, 0, H); for (let i = 0; i < 2; i++) mesh(cyl(0.272, 0.272, 0.015, 14), M(0x1f4f88), 0, 0.08 + i * 0.04, 0, H); }
  if (sk.anchor) { mesh(box(0.03, 0.14, 0.02), metal(0xc9ced6), 0, 1.78, 0.25, Bd); mesh(box(0.1, 0.03, 0.02), metal(0xc9ced6), 0, 1.72, 0.25, Bd); }
  if (sk.hood != null) { const h = mesh(sph(0.31, 12), M(sk.hood), 0, 0.06, -0.11, H); h.scale.set(1.02, 1.05, 0.92); mesh(box(0.5, 0.35, 0.08), M(sk.hood), 0, -0.25, -0.1, H); }
  if (sk.scarf != null) { mesh(cyl(0.21, 0.24, 0.12, 12), M(sk.scarf), 0, -0.24, 0.02, H); mesh(box(0.12, 0.3, 0.03), M(sk.scarf), 0.12, 1.75, 0.24, Bd).rotation.z = 0.2; }
  if (sk.nemes) {
    const gold = metal(0xd4af37), blue = M(0x1f4fa0);
    mesh(box(0.58, 0.2, 0.55), gold, 0, 0.17, -0.02, H);
    for (let i = 0; i < 4; i++) mesh(box(0.6, 0.03, 0.56), blue, 0, 0.1 + i * 0.05, -0.02, H);
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) mesh(box(0.13, 0.11, 0.2), i % 2 ? blue : gold, sx * 0.25, -0.02 - i * 0.11, 0.05, H);
    mesh(cyl(0.03, 0.02, 0.12, 6), gold, 0, 0.3, 0.26, H).rotation.x = 0.4; // урей
  }
  if (sk.wool != null) { for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; mesh(sph(0.1, 6), M(sk.wool), Math.cos(a) * 0.2, 0.2 + (i % 2) * 0.04, Math.sin(a) * 0.2, H); } mesh(sph(0.15, 8), M(sk.wool), 0, 0.3, 0, H); }
  if (sk.staff) { const st = mesh(cyl(0.025, 0.03, 1.9, 6), M(PAL.wood), 0.15, 1.35, -0.32, Bd); st.rotation.z = 0.35; const hk = mesh(G('crook', () => new THREE.TorusGeometry(0.1, 0.022, 5, 10, Math.PI)), M(PAL.wood), 0.5, 2.25, -0.32, Bd); hk.rotation.z = 0.35; }
  if (sk.straw) { mesh(cyl(0.48, 0.5, 0.03, 16), M(0xe0c46a), 0, 0.2, 0, H); mesh(cone(0.24, 0.24, 12), M(0xd6b85a), 0, 0.32, 0, H); mesh(cyl(0.245, 0.245, 0.04, 12), M(0x8a3a2a), 0, 0.23, 0, H); }
  if (sk.netBack) { const n = mesh(box(0.5, 0.6, 0.04), M(0xd8c8a0, { transparent: true, opacity: 0.85 }), 0, 1.55, -0.3, Bd); n.rotation.z = 0.3; for (let i = 0; i < 3; i++) mesh(sph(0.04, 4), M(0xe8742a), -0.15 + i * 0.15, 1.3 + i * 0.1, -0.33, Bd); }
  if (sk.fishBelt) { const f = mesh(sph(0.1, 6), M(0x9ab8c8, { metalness: 0.3, roughness: 0.4 }), 0.3, 1.15, 0.1, Bd); f.scale.set(0.6, 1.8, 0.5); mesh(cone(0.07, 0.1, 4), M(0x7a98a8), 0.3, 0.95, 0.1, Bd).rotation.x = Math.PI; }
  if (sk.bandana != null) { mesh(sph(0.27, 12), M(sk.bandana), 0, 0.08, -0.02, H).scale.set(1, 0.75, 1); for (const sx of [-1, 1]) { const k = mesh(box(0.05, 0.16, 0.03), M(sk.bandana), sx * 0.05, -0.02, -0.28, H); k.rotation.z = sx * 0.4; } for (let i = 0; i < 4; i++) mesh(sph(0.025, 4), M(0xffffff), Math.cos(i * 1.4) * 0.2, 0.18, Math.sin(i * 1.4) * 0.2, H); }
  if (sk.eyepatch) { mesh(box(0.08, 0.07, 0.02), M(0x111111), 0.09, 0.04, 0.245, H); const st = mesh(box(0.5, 0.015, 0.02), M(0x111111), 0, 0.08, 0.2, H); st.rotation.z = -0.25; }
  if (sk.earring) mesh(G('earR', () => new THREE.TorusGeometry(0.03, 0.008, 4, 10)), metal(0xd4af37), -0.26, -0.06, 0.0, H);
  if (sk.chefHat) { mesh(cyl(0.22, 0.2, 0.26, 12), M(0xffffff), 0, 0.3, 0, H); mesh(sph(0.26, 10), M(0xffffff), 0, 0.5, 0, H).scale.set(1, 0.6, 1); }
  if (sk.ladle) { const l = mesh(cyl(0.015, 0.015, 0.5, 5), metal(0xaaaaaa), -0.32, 1.1, 0.12, Bd); l.rotation.z = 0.2; mesh(sph(0.07, 6), metal(0xaaaaaa), -0.37, 0.85, 0.12, Bd); }
  if (sk.chest != null) { mesh(box(0.68, 0.48, 0.05), metal(sk.chest), 0, 1.62, 0.21, Bd); mesh(box(0.66, 0.06, 0.06), metal(sk.chest), 0, 1.4, 0.22, Bd); for (const sx of [-1, 1]) mesh(sph(0.11, 8), metal(sk.chest), sx * 0.4, 1.86, 0, Bd).scale.set(1, 0.7, 1); }
  if (sk.phalerae) for (let i = 0; i < 5; i++) { const ph = mesh(cyl(0.045, 0.045, 0.02, 10), metal(0xd4af37), -0.16 + (i % 3) * 0.16, 1.72 - Math.floor(i / 3) * 0.16, 0.245, Bd); ph.rotation.x = Math.PI / 2; }
  if (sk.collar != null) { const c = mesh(cyl(0.3, 0.36, 0.08, 14), metal(sk.collar), 0, 1.95, 0, Bd); c.scale.set(1, 1, 0.75); }
  if (sk.sash != null) { const sh = mesh(box(0.14, 0.95, 0.05), M(sk.sash), -0.02, 1.5, 0.245, Bd); sh.rotation.z = -0.55; }
  if (sk.toga != null) {
    // пурпурная тога: драпировка через плечо и широкий подол поверх туники
    const tg = M(sk.toga), gold = metal(0xd4af37);
    mesh(cyl(0.46, 0.5, 0.42, 14), tg, 0, 1.02, 0, Bd);
    mesh(cyl(0.505, 0.505, 0.05, 14), gold, 0, 0.82, 0, Bd);
    const dr = mesh(box(0.3, 0.9, 0.36), tg, 0.2, 1.6, 0, Bd); dr.rotation.z = 0.45;
    mesh(sph(0.15, 8), tg, 0.36, 1.86, 0, Bd).scale.set(1, 0.8, 1.3);
  }
  if (sk.glow != null) { const l = new VLight(sk.glow, 1.2, 5); l.position.set(0, 2.2, 0.6); pl.add(l); }
}
// золотой венок лидера поселения: листья светятся, над головой мягкий золотой свет
export function makeLeaderWreath() {
  const g = new THREE.Group();
  const gold = M(0xffd34d, { metalness: 0.8, roughness: 0.25, emissive: 0xffb020, emissiveIntensity: 0.9 });
  const ring = mesh(G('wreathR', () => new THREE.TorusGeometry(0.27, 0.03, 6, 20)), gold, 0, 0, 0, g); ring.rotation.x = Math.PI / 2;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2; if (Math.abs(Math.sin(a / 2)) < 0.12) continue; // спереди разрыв, как у настоящего венка
    for (const up of [0.035, -0.02]) { const lf = mesh(G('wreathL', () => new THREE.SphereGeometry(0.06, 6, 4)), gold, Math.sin(a) * 0.28, up, Math.cos(a) * 0.28, g); lf.scale.set(0.45, 0.28, 1); lf.rotation.y = a + (up > 0 ? 0.5 : -0.5); lf.castShadow = false; }
  }
  for (const sx of [-1, 1]) { const rb = mesh(box(0.04, 0.32, 0.015), M(0x7b1fa2), sx * 0.08, -0.22, -0.27, g); rb.rotation.z = sx * 0.15; } // пурпурные ленты
  const l = new VLight(0xffd36b, 1.6, 6); l.position.set(0, 0.4, 0.2); g.add(l);
  g.position.set(0, 0.14, -0.01);
  return g;
}
export function setWeapon(pl, type) {
  const u = pl.userData;
  if (u.weaponType === type) return;
  if (u.weapon) u.hand.remove(u.weapon);
  u.weapon = null; u.weaponType = type; u.weaponBase = null;
  if (!type) return;
  const w = new THREE.Group();
  const glowCol = { sungladius: 0xffe066, sunspear: 0x7fe3ff, sunaxe: 0xff8a3d, marsblade: 0xff2020, pspear: 0x5ad16b, nspear: 0xb070ff }[type];
  const base = { sungladius: 'gladius', sunspear: 'spear', sunaxe: 'axe', marsblade: 'gladius', pspear: 'spear', nspear: 'spear' }[type] || type;
  const blade = glowCol ? M(glowCol, { emissive: glowCol, emissiveIntensity: 2.2, metalness: 0.3, roughness: 0.3 }) : null;
  type = base;
  u.weaponBase = base;
  if (type === 'gladius') {
    // гладиус: клинок с долом и остриём, бронзовая гарда, обмотанная рукоять и шар-навершие
    const steel = blade || M(0xd0d6dc, { metalness: 0.6, roughness: 0.3 });
    mesh(box(0.08, 0.62, 0.03), steel, 0, 0, 0.42, w).rotation.x = Math.PI / 2;
    mesh(box(0.02, 0.5, 0.034), M(0x9aa2aa, { metalness: 0.7, roughness: 0.35 }), 0, 0, 0.4, w).rotation.x = Math.PI / 2;
    const tip = mesh(cone(0.057, 0.16, 4), steel, 0, 0, 0.81, w); tip.rotation.x = Math.PI / 2; tip.rotation.y = Math.PI / 4; tip.scale.set(1, 1, 0.3);
    mesh(box(0.25, 0.05, 0.07), M(PAL.bronze, { metalness: 0.6, roughness: 0.4 }), 0, 0, 0.1, w);
    mesh(cyl(0.03, 0.03, 0.16, 6), M(0x4a2e18), 0, 0, 0.0, w).rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) mesh(cyl(0.033, 0.033, 0.015, 6), M(PAL.bronze), 0, 0, -0.05 + i * 0.05, w).rotation.x = Math.PI / 2;
    mesh(sph(0.045, 6), M(PAL.bronze, { metalness: 0.6, roughness: 0.4 }), 0, 0, -0.1, w);
  } else if (type === 'spear') {
    // копьё: листовидный наконечник, обмотка у втулки и бронзовый подток
    mesh(cyl(0.03, 0.03, 2.2, 5), M(PAL.wood), 0, 0, 0.6, w).rotation.x = Math.PI / 2;
    const head = mesh(sph(0.075, 6), blade || M(0xc0c6cc, { metalness: 0.6 }), 0, 0, 1.86, w); head.scale.set(1, 0.35, 3.2);
    mesh(cyl(0.04, 0.035, 0.14, 6), M(0x6b4423), 0, 0, 1.66, w).rotation.x = Math.PI / 2;
    mesh(cone(0.04, 0.12, 6), M(PAL.bronze, { metalness: 0.6 }), 0, 0, -0.56, w).rotation.x = -Math.PI / 2;
  } else if (type === 'axe') {
    // топор: расширяющееся лезвие, обух и кожаная обмотка рукояти
    const ax = blade || M(0x8a9096, { metalness: 0.6, roughness: 0.35 });
    mesh(cyl(0.035, 0.035, 0.9, 5), M(PAL.wood), 0, 0, 0.35, w).rotation.x = Math.PI / 2;
    mesh(box(0.05, 0.18, 0.14), ax, 0, 0.08, 0.72, w);
    const edge = mesh(box(0.045, 0.34, 0.08), ax, 0, 0.21, 0.72, w); edge.scale.set(1, 1, 1);
    mesh(box(0.06, 0.08, 0.1), ax, 0, -0.06, 0.72, w);
    mesh(cyl(0.042, 0.042, 0.22, 6), M(0x4a2e18), 0, 0, 0.0, w).rotation.x = Math.PI / 2;
  } else if (type === 'trident') {
    // трезубец ретиария: длинное древко и три зубца
    mesh(cyl(0.03, 0.03, 2.0, 6), M(PAL.wood), 0, 0, 0.55, w).rotation.x = Math.PI / 2;
    const steel = M(0xc0c6cc, { metalness: 0.7, roughness: 0.3 });
    mesh(box(0.42, 0.05, 0.05), steel, 0, 0, 1.55, w);
    for (const x of [-0.19, 0, 0.19]) mesh(cone(0.04, 0.38, 5), steel, x, 0, 1.76, w).rotation.x = Math.PI / 2;
  } else if (type === 'sica') {
    // сика фракийца: короткий изогнутый клинок
    const steel = M(0xc8ced4, { metalness: 0.7, roughness: 0.3 });
    mesh(box(0.06, 0.4, 0.03), steel, 0, 0, 0.3, w).rotation.x = Math.PI / 2;
    const tip = mesh(box(0.06, 0.32, 0.03), steel, 0, 0.08, 0.6, w); tip.rotation.x = Math.PI / 2 - 0.6;
    mesh(box(0.2, 0.05, 0.06), M(PAL.bronze), 0, 0, 0.08, w);
  } else if (type === 'rudis') {
    // рудис — деревянный меч свободы
    mesh(box(0.1, 0.7, 0.05), M(0xc8a070), 0, 0, 0.42, w).rotation.x = Math.PI / 2;
    mesh(box(0.26, 0.06, 0.07), M(0x8a5a32), 0, 0, 0.06, w);
  } else if (type === 'rod') {
    // удочка: длинное гибкое удилище с леской
    const r1 = mesh(cyl(0.02, 0.035, 2.4, 5), M(0xa0784a), 0, 0.4, 1.0, w); r1.rotation.x = 1.0;
    mesh(cyl(0.005, 0.005, 1.6, 3), M(0xeeeeee), 0, 0.6, 2.4, w);
  } else if (type === 'treasure') {
    // сундук с золотом: сияет, его видно издалека
    // держится двумя руками перед грудью: смещён к середине тела
    mesh(box(0.7, 0.45, 0.45), M(0x6b4423), -0.4, 0.05, 0.3, w);
    mesh(box(0.74, 0.08, 0.49), M(0xd4af37, { metalness: 0.8, roughness: 0.3 }), -0.4, 0.2, 0.3, w);
    mesh(box(0.66, 0.2, 0.42), M(0xffd34d, { emissive: 0xffb000, emissiveIntensity: 3.5 }), -0.4, 0.34, 0.3, w); // золото под крышкой
    for (let i = 0; i < 4; i++) mesh(cyl(0.07, 0.07, 0.03, 8), M(0xffe680, { emissive: 0xffc000, emissiveIntensity: 3 }), -0.6 + i * 0.13, 0.46, 0.25 + (i % 2) * 0.1, w); // монеты
    const tl = new VLight(0xffc040, 10, 22); tl.position.set(-0.4, 0.8, 0.3); w.add(tl);
  }
  if (glowCol) { const l = new VLight(glowCol, 1.5, 5); l.position.set(0, 0, 0.6); w.add(l); }
  u.hand.add(w); u.weapon = w;
}
// факел в левой руке
export function setTorch(pl, on) {
  const u = pl.userData;
  if (!!u.torch === !!on) return;
  if (u.torch) { u.armL.remove(u.torch); u.torch = null; }
  if (!on) return;
  // рукоять в кулаке, горящий конец — вверх и чуть вперёд (рука вытянута вперёд, поэтому факел наклонён к ней)
  const t = new THREE.Group(); t.position.set(0, -0.74, 0.04); t.rotation.x = 1.25;
  mesh(cyl(0.035, 0.045, 0.8, 6), M(PAL.woodDark), 0, 0.2, 0, t);          // рукоять: снизу торчит из кулака
  mesh(cyl(0.075, 0.06, 0.16, 6), M(0x3a2a1a), 0, 0.62, 0, t);              // обмотка с паклей
  mesh(cyl(0.08, 0.08, 0.04, 6), M(0x6b4423), 0, 0.53, 0, t);
  const flame = mesh(cone(0.17, 0.55, 7), M(0xffa02a, { emissive: 0xff7a00, emissiveIntensity: 4 }), 0, 0.95, 0, t);
  mesh(cone(0.09, 0.32, 6), M(0xfff0a0, { emissive: 0xffe060, emissiveIntensity: 4 }), 0, 0.86, 0, t).castShadow = false;
  flame.castShadow = false;
  const l = new VLight(0xff9a3a, 30, 24, 1.4); l.position.set(0, 1.15, 0); t.add(l);
  u.armL.add(t); u.torch = t; u.torchFlame = flame; u.torchLight = l;
}
const ease = (x) => x * x * (3 - 2 * x);
const seg = (k, a, b) => ease(Math.min(1, Math.max(0, (k - a) / (b - a))));
// скорость анимации удара: топор — тяжёлый и медленный, кулак — быстрый
export function atkRate(pl) {
  const b = pl.userData.weaponBase;
  return b === 'axe' ? 1.7 : b === 'gladius' ? 2.6 : b === 'spear' ? 2.4 : 3.6;
}
// opts.ride: 0 — стоит, 1 — сидит в седле, между ними — посадка на коня
export function animatePlayer(pl, t, moving, running, attacking, atkType = 'melee', opts = {}) {
  const u = pl.userData;
  const ride = opts.ride || 0;
  const walk = moving && ride === 0;
  const sp = running ? 13 : 8.5;
  const a = walk ? Math.sin(t * sp) * (running ? 0.85 : 0.55) : 0;
  u.legL.rotation.set(a, 0, 0); u.legR.rotation.set(-a, 0, 0);
  u.armL.rotation.set(u.torch ? -1.0 : -a * 0.7, 0, 0);
  u.body.rotation.set(0, 0, 0);
  if (u.torch) { const f = 1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 29) * 0.08; u.torchFlame.scale.set(1, f, 1); u.torchLight.intensity = 28 * f; }
  let rx = a * 0.7, rz = 0;
  if (ride > 0) {
    // посадка: левая нога в стремя, правая перекидывается через круп, затем — посадка верхом
    const sit = seg(ride, 0.45, 1), lift = seg(ride, 0, 0.35), swing = Math.sin(seg(ride, 0.3, 0.85) * Math.PI);
    u.legL.rotation.x = -1.35 * Math.max(lift * 0.8, sit); u.legL.rotation.z = -0.5 * sit;
    u.legR.rotation.x = -1.35 * sit - 0.3 * swing; u.legR.rotation.z = 0.5 * sit + 1.3 * swing;
    u.body.rotation.x = 0.25 * lift * (1 - sit) + 0.08 * sit;
    if (!u.torch) u.armL.rotation.x = -0.7 * sit - 1.6 * lift * (1 - sit);
    rx = -0.7 * sit - 1.6 * lift * (1 - sit);
    if (ride >= 1 && moving) { const b = Math.sin(t * (running ? 14 : 9)); u.body.rotation.x = 0.1 + b * 0.05; }
  }
  if (attacking > 0) {
    const k = 1 - attacking;
    const base = u.weaponBase;
    if (atkType === 'throw') {
      // замах назад-вверх и бросок вперёд
      rx = k < 0.35 ? -2.8 * (k / 0.35) : -2.8 + (k - 0.35) / 0.65 * 3.6;
      u.body.rotation.y = k < 0.35 ? -0.5 * (k / 0.35) : -0.5 + (k - 0.35) / 0.65 * 0.8;
    } else if (base === 'axe') {
      // топор: высокий замах над головой и рубящий удар сверху вниз с наклоном корпуса
      const up = seg(k, 0, 0.38), down = seg(k, 0.38, 0.58), back = seg(k, 0.62, 1);
      rx = (-3.0 * up + 2.5 * down) * (1 - back) + 0 * back;
      rz = 0.18 * up * (1 - back);
      u.body.rotation.x += (-0.14 * up + 0.4 * down) * (1 - back);
      u.body.rotation.y = 0.15 * up * (1 - down);
      u.armL.rotation.x = Math.min(u.armL.rotation.x, (-1.2 * up + 0.6 * down) * (1 - back));
    } else if (base === 'gladius') {
      // гладиус: короткий замах к плечу и диагональный рубящий удар с поворотом корпуса
      const wind = seg(k, 0, 0.28), cut = seg(k, 0.28, 0.6), back = seg(k, 0.65, 1);
      rx = (-2.2 * wind + 1.4 * cut) * (1 - back);
      rz = (0.75 * wind - 1.35 * cut) * (1 - back);
      u.body.rotation.y = (0.45 * wind - 0.95 * cut) * (1 - back);
      u.body.rotation.x += 0.1 * cut * (1 - back);
      u.armL.rotation.x = Math.min(u.armL.rotation.x, -0.4 * wind * (1 - back));
    } else {
      // удар кулаком: короткий прямой
      const jab = Math.sin(seg(k, 0, 0.7) * Math.PI);
      rx = -1.55 * jab; u.body.rotation.y = -0.35 * jab;
    }
  }
  if (u.weaponType === 'treasure' && !(attacking > 0)) { rx = -1.15; rz = 0; u.armL.rotation.set(-1.15, 0, 0); } // сундук — в обеих руках
  u.armR.rotation.set(rx, 0, rz);
  u.body.position.y = walk ? Math.abs(Math.sin(t * sp)) * 0.07 : ride > 0 ? 0 : Math.sin(t * 2) * 0.015;
  u.cape.rotation.x = walk ? 0.25 + Math.sin(t * sp * 0.5) * 0.08 : ride >= 1 && moving ? 0.5 : 0.05;
}

// ---------- Чайка ----------
export function makeGull(scale = 1) {
  const g = new THREE.Group();
  const white = M(0xf4f4f0), grey = M(0x9aa3ab);
  const body = new THREE.Group(); g.add(body);
  mesh(sph(0.22, 8), white, 0, 0.32, 0, body).scale.set(0.8, 0.75, 1.4);
  mesh(sph(0.13, 8), white, 0, 0.45, 0.25, body);
  mesh(cone(0.04, 0.16, 5), M(0xf0b429), 0, 0.43, 0.42, body).rotation.x = Math.PI / 2;
  mesh(box(0.2, 0.04, 0.2), grey, 0, 0.3, -0.32, body);                   // хвост
  const wL = new THREE.Group(), wR = new THREE.Group();
  wL.position.set(-0.12, 0.38, 0); wR.position.set(0.12, 0.38, 0);
  mesh(box(0.55, 0.03, 0.25), grey, -0.27, 0, 0, wL);
  mesh(box(0.55, 0.03, 0.25), grey, 0.27, 0, 0, wR);
  body.add(wL, wR);
  mesh(box(0.03, 0.18, 0.03), M(0xf0b429), -0.06, 0.09, 0, body);
  mesh(box(0.03, 0.18, 0.03), M(0xf0b429), 0.06, 0.09, 0, body);
  g.scale.setScalar(scale);
  g.userData = { wL, wR, body };
  return g;
}
export function animateGull(gm, t, flying) {
  const u = gm.userData;
  const f = flying ? Math.sin(t * 14) * 0.9 : -0.15;
  u.wL.rotation.z = f; u.wR.rotation.z = -f;
  u.body.rotation.x = flying ? 0 : Math.sin(t * 3) * 0.05;
}
export function makeSpearProjectile(glow) {
  const g = new THREE.Group();
  if (glow) { mesh(cone(0.1, 0.4, 6), M(0x7fe3ff, { emissive: 0x7fe3ff, emissiveIntensity: 2.5 }), 0, 0, 1.3, g).rotation.x = Math.PI / 2; g.add(new VLight(0x7fe3ff, 2, 6)); }
  mesh(cyl(0.035, 0.035, 2.2, 6), M(PAL.wood), 0, 0, 0, g).rotation.x = Math.PI / 2;
  mesh(cone(0.08, 0.32, 6), M(0xc0c6cc, { metalness: 0.7, roughness: 0.3 }), 0, 0, 1.25, g).rotation.x = Math.PI / 2;
  return g;
}
export function makeGrass(s = 1) {
  const g = new THREE.Group();
  const m = M(0x6f9a3a), m2 = M(0x88b04b);
  for (let i = 0; i < 5; i++) {
    const c = mesh(cone(0.08, 0.7 + (i % 3) * 0.2, 4), i % 2 ? m : m2, Math.cos(i * 1.3) * 0.18, 0.35, Math.sin(i * 1.3) * 0.18, g);
    c.rotation.z = Math.cos(i * 2.1) * 0.25; c.castShadow = false;
  }
  g.scale.setScalar(s);
  return g;
}

// ---------- Звери ----------
export function makeAnimal(type) {
  const g = new THREE.Group();
  const parts = { legs: [] };
  let col, s;
  if (type === 'jackal') { col = 0xb98a52; s = 0.8; }
  else if (type === 'boar') { col = 0x4b3a2e; s = 1.0; }
  else { col = 0xc9a15d; s = 1.45; }
  const mat = M(col);
  const body = new THREE.Group(); g.add(body);
  const bl = type === 'boar' ? 1.5 : 1.3, bh = type === 'boar' ? 0.75 : 0.5;
  mesh(box(0.6 * s, bh * s, bl * s), mat, 0, 0.75 * s, 0, body);
  const head = mesh(box(0.45 * s, 0.42 * s, 0.5 * s), mat, 0, (0.85 + (type === 'boar' ? 0 : 0.15)) * s, (bl / 2 + 0.2) * s, body);
  if (type === 'jackal') {
    mesh(cone(0.08 * s, 0.3 * s, 4), mat, -0.13 * s, 0.25 * s, -0.05 * s, head);
    mesh(cone(0.08 * s, 0.3 * s, 4), mat, 0.13 * s, 0.25 * s, -0.05 * s, head);
    mesh(box(0.22 * s, 0.2 * s, 0.35 * s), mat, 0, -0.08 * s, 0.35 * s, head);
    mesh(cyl(0.05 * s, 0.1 * s, 0.6 * s, 5), mat, 0, 0.85 * s, -(bl / 2 + 0.2) * s, body).rotation.x = -0.9;
  } else if (type === 'boar') {
    mesh(box(0.3, 0.25, 0.25), M(0x6b4f3f), 0, -0.08, 0.32, head);
    mesh(cone(0.04, 0.25, 4), M(0xeeeedd), -0.15, -0.05, 0.35, head).rotation.x = -1.2;
    mesh(cone(0.04, 0.25, 4), M(0xeeeedd), 0.15, -0.05, 0.35, head).rotation.x = -1.2;
    mesh(box(0.15, 0.25, 1.2), M(0x2e231b), 0, 0.42, -0.1, body);
  } else {
    mesh(sph(0.48 * s, 7), M(0x7a4a22), 0, 0.02 * s, -0.08 * s, head).scale.set(1, 1, 0.8); // грива
    mesh(box(0.3 * s, 0.24 * s, 0.25 * s), mat, 0, -0.08 * s, 0.32 * s, head);
    mesh(cyl(0.04 * s, 0.04 * s, 0.8 * s, 4), mat, 0, 0.8 * s, -(bl / 2 + 0.3) * s, body).rotation.x = -1.1;
  }
  const lh = 0.55 * s;
  for (const [x, z] of [[-0.2, 0.45], [0.2, 0.45], [-0.2, -0.45], [0.2, -0.45]]) {
    const leg = new THREE.Group(); leg.position.set(x * s, 0.6 * s, z * bl * s); body.add(leg);
    mesh(box(0.14 * s, lh, 0.14 * s), mat, 0, -lh / 2, 0, leg);
    parts.legs.push(leg);
  }
  parts.body = body; parts.head = head;
  g.userData = parts;
  return g;
}
export function makeMonster() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const sandM = M(0x8a6a3a), dark = M(0x3b2a1c), glow = M(0xff5a1f, { emissive: 0xff3a00, emissiveIntensity: 2 });
  mesh(box(3.2, 3.6, 2.2), sandM, 0, 4.6, 0, body);
  mesh(box(2.4, 1.6, 1.8), dark, 0, 2.2, 0, body);
  const head = mesh(box(1.6, 1.4, 1.6), sandM, 0, 7.1, 0.3, body);
  mesh(box(0.35, 0.2, 0.1), glow, -0.4, 0.15, 0.82, head);
  mesh(box(0.35, 0.2, 0.1), glow, 0.4, 0.15, 0.82, head);
  mesh(cone(0.25, 1.2, 4), dark, -0.7, 0.9, 0, head).rotation.z = 0.4;
  mesh(cone(0.25, 1.2, 4), dark, 0.7, 0.9, 0, head).rotation.z = -0.4;
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-2.0, 6, 0); armR.position.set(2.0, 6, 0);
  mesh(box(1.0, 3.8, 1.0), sandM, 0, -1.8, 0, armL); mesh(box(1.3, 1.0, 1.3), dark, 0, -3.8, 0, armL);
  mesh(box(1.0, 3.8, 1.0), sandM, 0, -1.8, 0, armR); mesh(box(1.3, 1.0, 1.3), dark, 0, -3.8, 0, armR);
  body.add(armL, armR);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.9, 2.2, 0); legR.position.set(0.9, 2.2, 0);
  mesh(box(1.0, 2.2, 1.1), dark, 0, -1.1, 0, legL); mesh(box(1.0, 2.2, 1.1), dark, 0, -1.1, 0, legR);
  body.add(legL, legR);
  for (let i = 0; i < 5; i++) mesh(cone(0.3, 1.0, 4), dark, (i - 2) * 0.6, 6.6, -1.0, body).rotation.x = -0.6;
  const light = new VLight(0xff5a1f, 6, 14); light.position.set(0, 7, 2); body.add(light);
  g.userData = { body, armL, armR, legL, legR, legs: [legL, legR] };
  return g;
}
export function animateAnimal(a, t, moving, attacking) {
  const u = a.userData;
  const sw = moving ? Math.sin(t * 12) * 0.6 : 0;
  if (u.armL) {
    u.legL.rotation.x = Math.sin(t * 4) * (moving ? 0.4 : 0); u.legR.rotation.x = -u.legL.rotation.x;
    u.armL.rotation.x = attacking > 0 ? -2 + (1 - attacking) * 2 : -u.legL.rotation.x * 0.6;
    u.armR.rotation.x = attacking > 0 ? -2 + (1 - attacking) * 2 : u.legL.rotation.x * 0.6;
    return;
  }
  u.legs.forEach((l, i) => (l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? 1 : -1) * sw));
  u.body.position.y = moving ? Math.abs(Math.sin(t * 12)) * 0.06 : 0;
  u.head.rotation.x = attacking > 0 ? Math.sin(attacking * Math.PI) * 0.6 : 0;
}

// ---------- Растения, камни, ресурсы ----------
export function makePalm(s = 1) {
  const g = new THREE.Group();
  const trunkM = M(0x8b6b42);
  let y = 0, x = 0;
  for (let i = 0; i < 6; i++) { mesh(cyl(0.22 - i * 0.02, 0.26 - i * 0.02, 1.0, 6), trunkM, x, y + 0.5, 0, g); mesh(cyl(0.25 - i * 0.02, 0.25 - i * 0.02, 0.08, 6), M(0x6e5434), x, y + 0.92, 0, g); y += 0.95; x += 0.08 * i * 0.3; }
  // листья из двух изогнутых частей, светлая и тёмная зелень
  const leafA = M(PAL.leaf), leafB = M(0x4a7424), leafC = M(0x6f9c38);
  for (let i = 0; i < 9; i++) {
    const piv = new THREE.Group(); piv.position.set(x, y, 0); piv.rotation.y = (i / 9) * Math.PI * 2 + (i % 2) * 0.2; piv.rotation.x = 0.35 + (i % 3) * 0.12; g.add(piv);
    const m = i % 3 === 0 ? leafB : i % 3 === 1 ? leafA : leafC;
    const l1 = mesh(box(0.55, 0.05, 1.5), m, 0, 0, 0.7, piv); l1.rotation.x = 0.1;
    const l2 = mesh(box(0.42, 0.05, 1.4), m, 0, -0.32, 1.95, piv); l2.rotation.x = 0.5;
  }
  for (let i = 0; i < 4; i++) mesh(G('coco', () => new THREE.IcosahedronGeometry(0.18, 0)), M(0x5a3d1f), x + Math.cos(i * 1.6) * 0.22, y - 0.25 - (i % 2) * 0.1, Math.sin(i * 1.6) * 0.22, g); // кокосы
  g.scale.setScalar(s);
  return g;
}
export function makeDeadTree(s = 1) {
  const g = new THREE.Group();
  const m = M(0x6e5438);
  mesh(cyl(0.18, 0.32, 3, 6), m, 0, 1.5, 0, g);
  const b1 = mesh(cyl(0.08, 0.14, 1.8, 5), m, 0.5, 2.6, 0, g); b1.rotation.z = -0.8;
  const b2 = mesh(cyl(0.07, 0.12, 1.5, 5), m, -0.4, 2.9, 0.2, g); b2.rotation.z = 0.7;
  const b3 = mesh(cyl(0.06, 0.1, 1.2, 5), m, 0, 3.4, -0.4, g); b3.rotation.x = 0.6;
  // лежащее бревно рядом
  const log = mesh(cyl(0.22, 0.22, 2.2, 6), M(0x7d6040), 1.2, 0.22, 0.6, g); log.rotation.z = Math.PI / 2; log.rotation.y = 0.5;
  g.scale.setScalar(s);
  return g;
}
export function makeMarbleNode(s = 1) {
  const g = new THREE.Group();
  const m1 = M(0xf2efe8), m2 = M(0xdcd6cc);
  mesh(box(1.6, 1.2, 1.2), m1, 0, 0.6, 0, g).rotation.y = 0.3;
  mesh(box(1.0, 0.8, 1.0), m2, 1.1, 0.4, 0.6, g).rotation.y = -0.4;
  mesh(box(0.8, 1.4, 0.8), m1, -0.9, 0.7, -0.4, g).rotation.y = 0.8;
  mesh(box(0.1, 0.9, 0.1), M(PAL.wood), 0.6, 0.9, -0.8, g).rotation.z = 0.5; // кирка
  mesh(box(0.5, 0.12, 0.08), M(0x777777), 0.85, 1.3, -0.8, g);
  g.scale.setScalar(s);
  return g;
}
export function makeSandPile(s = 1) {
  // округлый бархан песка: низ уходит в землю, поэтому на склонах куча не «висит»
  const g = new THREE.Group();
  const top = M(0xf6e6bf), side = M(0xe9d29c), wet = M(0xcdb07a);
  // кучи стоят сотнями — у них своя умеренная детализация
  const lsph = (r, w, h) => G(`ls${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI * 0.62));
  mesh(cyl(1.75, 1.95, 1.2, 9), wet, 0, -0.55, 0, g);                       // «юбка» в землю
  mesh(lsph(1.7, 16, 7), side, 0, -0.2, 0, g).scale.set(1, 0.55, 0.85);
  mesh(lsph(1.15, 14, 6), top, 0.35, 0.25, -0.15, g).scale.set(1, 0.6, 0.9);
  mesh(lsph(0.8, 12, 5), top, -0.9, -0.05, 0.55, g).scale.set(1.1, 0.5, 0.9);
  for (let i = 0; i < 5; i++) mesh(sph(0.12, 5), M(0xb39a78), Math.cos(i * 1.3) * 1.6, -0.02, Math.sin(i * 1.3) * 1.3, g); // камешки
  // корзина и деревянное ведро старателя
  const bucket = mesh(cyl(0.28, 0.22, 0.42, 10), M(PAL.wood), 1.55, 0.1, 0.9, g);
  mesh(G('bucketRing', () => new THREE.TorusGeometry(0.28, 0.025, 5, 12)), M(0x555555, { metalness: 0.5 }), 0, 0.12, 0, bucket).rotation.x = Math.PI / 2;
  g.scale.setScalar(s);
  return g;
}
export function makeRock(s = 1) {
  const g = new THREE.Group();
  const geo = G('rock', () => new THREE.DodecahedronGeometry(0.8, 0));
  const m1 = mesh(geo, M(PAL.rock), 0, 0.3, 0, g); m1.scale.set(1.2, 0.7, 1);
  const m2 = mesh(geo, M(0x9a8670), 0.7, 0.15, 0.3, g); m2.scale.set(0.6, 0.45, 0.6);
  const m3 = mesh(geo, M(0xb8a68e), -0.15, 0.62, 0.1, g); m3.scale.set(0.55, 0.22, 0.5); m3.rotation.y = 1.1;
  for (let i = 0; i < 4; i++) mesh(geo, M(0x8a7866), Math.cos(i * 1.9) * 1.1, 0.04, Math.sin(i * 1.9) * 0.9, g).scale.setScalar(0.12 + (i % 2) * 0.06);
  g.scale.setScalar(s);
  return g;
}
// скала в море: основание на дне (depth — глубина), вершина торчит над водой на 1.5–4 м
export function makeSeaRock(s = 1, depth = 2) {
  const g = new THREE.Group();
  const geo = G('rock', () => new THREE.DodecahedronGeometry(0.8, 0));
  const top = depth + 1.5 + s * 1.2, m1 = M(0x8a7a68), m2 = M(0x6f6255), wet = M(0x4f4a44);
  const base = mesh(geo, wet, 0, top * 0.25, 0, g); base.scale.set(2.6 * s, top * 0.45, 2.2 * s);
  const mid = mesh(geo, m2, 0.3 * s, top * 0.6, -0.2 * s, g); mid.scale.set(1.9 * s, top * 0.42, 1.7 * s); mid.rotation.y = 0.7;
  const hi = mesh(geo, m1, -0.2 * s, top * 0.88, 0.25 * s, g); hi.scale.set(1.2 * s, top * 0.25, 1.1 * s); hi.rotation.y = 1.9;
  mesh(geo, m2, 1.8 * s, top * 0.15, 1.2 * s, g).scale.set(1.1 * s, top * 0.25, 1.0 * s);
  mesh(geo, M(0xf2f0e8), -0.1 * s, top * 1.02, 0.2 * s, g).scale.set(0.6 * s, 0.12, 0.5 * s); // птичий помёт на вершине
  return g;
}
export function makeShrub(s = 1) {
  const g = new THREE.Group();
  const m = M(PAL.dry);
  for (let i = 0; i < 4; i++) mesh(sph(0.35, 5), i % 2 ? m : M(0x8a7a40), Math.cos(i * 1.7) * 0.3, 0.25, Math.sin(i * 1.7) * 0.3, g).scale.set(1, 0.7, 1);
  for (let i = 0; i < 3; i++) mesh(G('berry', () => new THREE.OctahedronGeometry(0.06, 0)), M(0xc0492b), Math.cos(i * 2.2) * 0.35, 0.45, Math.sin(i * 2.2) * 0.35, g); // ягоды (8 граней — кустов тысячи)
  g.scale.setScalar(s * 0.8);
  return g;
}

// ---------- Римская архитектура ----------
function column(parent, x, z, h, r = 0.3, mat = M(PAL.marble), broken = 0) {
  const hh = h * (1 - broken);
  const cg = new THREE.Group(); cg.position.set(x, 0, z); parent.add(cg);
  mesh(box(r * 2.6, 0.2, r * 2.6), mat, 0, 0.1, 0, cg);
  mesh(cyl(r, r * 1.1, hh, 10), mat, 0, 0.2 + hh / 2, 0, cg);
  if (!broken) mesh(box(r * 2.6, 0.25, r * 2.6), mat, 0, 0.2 + hh + 0.12, 0, cg);
  return cg;
}
function gableRoof(parent, w, d, y, h, mat = M(PAL.roof)) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.3, 0); shape.lineTo(w / 2 + 0.3, 0); shape.lineTo(0, h); shape.lineTo(-w / 2 - 0.3, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false });
  geo.translate(0, 0, -(d + 0.6) / 2);
  return mesh(geo, mat, 0, y, 0, parent);
}

export function makeBuilding(type, opt = {}) {
  const g = new THREE.Group();
  const st = M(PAL.stone), stD = M(PAL.stoneDark), wood = M(PAL.wood), woodD = M(PAL.woodDark);
  if (type === 'warehouse') {
    mesh(box(9, 0.4, 7), stD, 0, 0.2, 0, g);
    mesh(box(8.5, 3.6, 6.5), st, 0, 2.2, 0, g);
    gableRoof(g, 8.5, 6.5, 4, 2.2);
    mesh(box(2.2, 2.6, 0.2), woodD, 0, 1.7, 3.3, g);
    for (let i = -1; i <= 1; i += 2) mesh(box(0.8, 0.8, 0.8), wood, i * 3.5, 0.8, 4.2, g);
    mesh(cyl(0.4, 0.35, 1, 8), M(0xb06b3a), 2.5, 0.9, 4.0, g); // амфора
    mesh(cyl(0.4, 0.35, 1, 8), M(0xb06b3a), -2.4, 0.9, 4.4, g);
    // помост для собраний
    mesh(box(4, 0.3, 2), stD, 0, 0.15, 5.4, g);
  } else if (type === 'workshop') {
    mesh(box(7, 0.3, 6), stD, 0, 0.15, 0, g);
    mesh(box(5, 2.8, 4), st, -0.8, 1.7, -0.5, g);
    gableRoof(g, 5, 4, 3.1, 1.4).position.x = -0.8;
    mesh(box(1, 4, 1), M(0x9c5a3a), 1.3, 2.3, -1.6, g); // печь
    mesh(box(1.2, 0.3, 1.2), M(0x333333), 1.3, 4.4, -1.6, g);
    mesh(box(2, 0.9, 1), wood, 2.0, 0.75, 1.5, g); // верстак
    for (let i = 0; i < 4; i++) mesh(box(0.4, 0.25, 0.25), M(0xa5402f), -2.5 + (i % 2) * 0.45, 0.42 + Math.floor(i / 2) * 0.27, 2.2, g); // кирпичи
    for (let i = 0; i < 3; i++) mesh(box(2.2, 0.12, 0.35), M(0xc79a63), -0.2, 0.36 + i * 0.13, 2.2, g); // доски
  } else if (type === 'farm') {
    mesh(box(11, 0.15, 10), M(0x8a6a3c), 0, 0.08, 0, g);
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const lemon = (r + 2) % 2 === 0;
        const px = c * 1.8 + 0.5, pz = r * 1.8 + 0.5;
        if (lemon) { mesh(cyl(0.07, 0.09, 0.8, 5), M(0x6e5438), px, 0.5, pz, g); mesh(sph(0.55, 6), M(0x4f7d2a), px, 1.1, pz, g); mesh(sph(0.1, 5), M(0xffe03a), px + 0.3, 1.0, pz + 0.3, g); }
        else { mesh(box(0.9, 0.7, 0.9), M(0x7a9a3a), px, 0.4, pz, g); } // тутовник (шёлк)
      }
    }
    for (let i = -5; i <= 5; i += 2.5) { mesh(box(0.12, 0.9, 0.12), wood, i, 0.45, 5, g); mesh(box(0.12, 0.9, 0.12), wood, i, 0.45, -5, g); mesh(box(0.12, 0.9, 0.12), wood, 5.4, 0.45, i, g); mesh(box(0.12, 0.9, 0.12), wood, -5.4, 0.45, i, g); }
    mesh(box(11, 0.08, 0.08), wood, 0, 0.8, 5, g); mesh(box(11, 0.08, 0.08), wood, 0, 0.8, -5, g);
    mesh(box(0.08, 0.08, 10), wood, 5.4, 0.8, 0, g); mesh(box(0.08, 0.08, 10), wood, -5.4, 0.8, 0, g);
    const hut = new THREE.Group(); hut.position.set(-4, 0, -6.4); g.add(hut);
    mesh(box(2.4, 1.8, 1.8), st, 0, 0.9, 0, hut); gableRoof(hut, 2.4, 1.8, 1.8, 0.9);
  } else if (type === 'shipyard') {
    mesh(box(10, 0.5, 6), stD, 0, 0.25, -3, g);
    // деревянный слип уходит к воде (вдоль +z)
    mesh(box(5, 0.3, 12), wood, 0, 0.0, 5, g).rotation.x = 0.08;
    for (let i = 0; i < 5; i++) { mesh(cyl(0.2, 0.2, 3, 6), woodD, -2.3, -0.8, 1 + i * 2.6, g); mesh(cyl(0.2, 0.2, 3, 6), woodD, 2.3, -0.8, 1 + i * 2.6, g); }
    // кран
    mesh(box(0.4, 6, 0.4), wood, -4, 3, -2, g);
    const arm = mesh(box(0.3, 0.3, 6), wood, -4, 6, 0.5, g);
    mesh(cyl(0.02, 0.02, 3, 4), M(0x333333), -4, 4.5, 3.3, g);
    mesh(box(4, 2.5, 3), st, 2.5, 1.5, -4, g); gableRoof(g, 4, 3, 2.75, 1.2).position.set(2.5, 0, -4);
  } else if (type === 'barn') {
    g.add(makeBarn());
  } else if (type === 'scove') {
    // скрытая бухта: низкий причал из досок, навес из шкур, бочки и сундук
    const wood = M(PAL.wood), dark = M(PAL.woodDark), hide = M(0x8a6a48);
    mesh(box(2.2, 0.25, 7), wood, 0, 0.4, 2.5, g);
    for (const [x, z] of [[-1, 0], [1, 0], [-1, 3], [1, 3], [-1, 5.8], [1, 5.8]]) mesh(cyl(0.12, 0.12, 2, 6), dark, x, -0.3, z, g);
    for (const [x, z] of [[-1.8, -1.6], [1.8, -1.6], [-1.8, 1.2], [1.8, 1.2]]) mesh(cyl(0.1, 0.1, 2.4, 6), dark, x, 1.2, z, g);
    const roof = mesh(box(4.2, 0.1, 3.4), hide, 0, 2.45, -0.2, g); roof.rotation.x = 0.12;
    for (const [x, z] of [[-1.2, -1], [-0.4, -1.3]]) mesh(cyl(0.38, 0.38, 0.9, 10), dark, x, 0.45, z, g);
    mesh(box(0.9, 0.6, 0.6), M(0x6b4a2a), 1.1, 0.3, -0.9, g);
    mesh(box(0.95, 0.12, 0.65), M(0xd4af37, { metalness: 0.7, roughness: 0.35 }), 1.1, 0.65, -0.9, g);
    const net = mesh(box(1.6, 1.2, 0.04), M(0x9a8a6a), -1.85, 1.2, -0.2, g); net.rotation.y = Math.PI / 2;
  } else if (type === 'statue') {
    // до улучшения статуя мраморная, после — золотая
    const marble = M(PAL.marble), gold = opt.gold ? M(0xd4af37, { metalness: 0.85, roughness: 0.3, emissive: 0x3a2a00, emissiveIntensity: 0.3 }) : M(0xece6d8);
    mesh(box(5.5, 0.5, 5.5), M(PAL.stoneDark), 0, 0.25, 0, g);
    mesh(box(3.6, 0.5, 3.6), marble, 0, 0.75, 0, g);
    mesh(box(2.6, 2.6, 2.6), marble, 0, 2.3, 0, g);
    mesh(box(2.9, 0.3, 2.9), marble, 0, 3.75, 0, g);
    mesh(box(1.4, 0.4, 0.05), gold, 0, 2.4, 1.33, g); // табличка CAESAR
    const fig = new THREE.Group(); fig.position.y = 3.9; g.add(fig);
    if (opt.point != null) fig.rotation.y = opt.point; // фигура повёрнута туда, куда указывает рука
    mesh(cyl(0.35, 0.55, 1.8, 10), gold, 0, 0.9, 0, fig);           // тога
    mesh(cyl(0.38, 0.32, 1.2, 10), gold, 0, 2.3, 0, fig);           // торс
    mesh(sph(0.36, 12), gold, 0, 3.2, 0, fig);                      // голова
    const laurel = mesh(G('laurel', () => new THREE.TorusGeometry(0.36, 0.06, 6, 14)), M(0x9bbd3b, { metalness: 0.6, roughness: 0.4 }), 0, 3.35, 0, fig);
    laurel.rotation.x = Math.PI / 2;
    // вытянутая вперёд рука указывает направление к гробнице фараона
    const arm = mesh(cyl(0.11, 0.1, 1.4, 8), gold, 0.42, 2.85, 0.62, fig); arm.rotation.x = Math.PI / 2 - 0.25;
    mesh(cyl(0.035, 0.03, 0.35, 6), gold, 0.42, 3.04, 1.42, fig).rotation.x = Math.PI / 2 - 0.25;   // указательный палец
    mesh(box(0.9, 1.6, 0.1), M(0x9e2a22), -0.1, 1.9, -0.38, fig);    // плащ
    if (opt.gold) { const l = new VLight(0xffd36b, 3, 14); l.position.set(0, 6, 2); g.add(l); }
    for (const [x, z] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) mesh(cyl(0.18, 0.18, 1.2, 8), marble, x, 1.1, z, g);
  } else if (type === 'camp') {
    // Лагерь поселенцев: помост для собраний, штандарт с орлом, доска объявлений и колодец желаний
    const wood = M(PAL.wood), dark = M(PAL.woodDark), st = M(PAL.stone);
    mesh(box(7, 0.4, 5), wood, 0, 0.2, 0, g);
    for (let i = -1; i <= 1; i++) mesh(box(5, 0.25, 0.5), dark, 0, 0.55, 2.8 + i * 0.01, g).position.z = 3.2;
    for (let i = 0; i < 3; i++) mesh(box(4, 0.3, 0.6), dark, -1.5 + i * 0.01, 0.35, -3.3 - i * 0.9, g).position.x = 0; // скамьи
    // штандарт с орлом
    mesh(cyl(0.07, 0.07, 5, 6), M(PAL.bronze, { metalness: 0.6 }), -3, 2.9, 0, g);
    mesh(box(1.1, 1.4, 0.05), M(PAL.red), -3, 3.8, 0.05, g);
    mesh(box(0.6, 0.2, 0.06), M(0xd4af37, { metalness: 0.7 }), -3, 3.4, 0.1, g);
    mesh(sph(0.22, 8), M(0xd4af37, { metalness: 0.7 }), -3, 5.6, 0, g);
    for (const sx of [-1, 1]) mesh(box(0.5, 0.08, 0.2), M(0xd4af37, { metalness: 0.7 }), -3 + sx * 0.35, 5.7, 0, g).rotation.z = sx * 0.4; // крылья
    // доска объявлений
    mesh(box(0.15, 2.2, 0.15), dark, 2.4, 1.3, -1.6, g); mesh(box(0.15, 2.2, 0.15), dark, 3.6, 1.3, -1.6, g);
    mesh(box(1.5, 1.1, 0.1), M(0xd9c08f), 3, 1.9, -1.55, g);
    // колодец желаний
    const well = new THREE.Group(); well.position.set(3.2, 0, 2.6); g.add(well);
    mesh(cyl(0.9, 1.0, 0.9, 12), st, 0, 0.45, 0, well);
    mesh(cyl(0.7, 0.7, 0.92, 12), M(0x1a3a4a), 0, 0.47, 0, well);
    mesh(box(0.12, 1.8, 0.12), dark, -0.85, 1.5, 0, well); mesh(box(0.12, 1.8, 0.12), dark, 0.85, 1.5, 0, well);
    mesh(cone(1.3, 0.8, 4), M(PAL.roof), 0, 2.7, 0, well).rotation.y = Math.PI / 4;
    mesh(cyl(0.06, 0.06, 1.8, 6), dark, 0, 2.1, 0, well).rotation.z = Math.PI / 2;
    const sparkle = mesh(sph(0.1, 6), M(0x9ad9ff, { emissive: 0x6fc8ff, emissiveIntensity: 2 }), 0, 0.95, 0, well);
    g.userData.sparkle = sparkle;
  } else if (type === 'townhall') {
    // храмоподобная базилика на подиуме
    for (let i = 0; i < 3; i++) mesh(box(14 - i * 0.6, 0.4, 11 - i * 0.6), M(PAL.marble), 0, 0.2 + i * 0.4, 0, g);
    const top = 1.2;
    mesh(box(9.5, 4.5, 6.5), st, 0, top + 2.25, -0.8, g);
    for (let i = 0; i < 6; i++) column(g, -5 + i * 2, 4.2, 4.6, 0.35).position.y = top;
    for (let i = 0; i < 4; i++) { column(g, -5.6, 2.4 - i * 2.2, 4.6, 0.35).position.y = top; column(g, 5.6, 2.4 - i * 2.2, 4.6, 0.35).position.y = top; }
    mesh(box(12.6, 0.6, 10), M(PAL.marble), 0, top + 5.2, 0, g);
    gableRoof(g, 12, 10, top + 5.5, 2.4);
    // фронтон: треугольник на фасаде
    mesh(box(2.4, 0.5, 0.2), M(PAL.bronze, { metalness: 0.5 }), 0, top + 6.4, 5.35, g);
    // орёл-штандарт
    mesh(cyl(0.06, 0.06, 3, 5), M(PAL.bronze), 6.6, 2.6, 5.2, g);
    mesh(box(0.8, 1.0, 0.05), M(PAL.red), 6.6, 3.5, 5.2, g);
    mesh(sph(0.2, 6), M(0xd4af37, { metalness: 0.7 }), 6.6, 4.2, 5.2, g);
  }
  decorate(g, type);
  return g;
}
// Гробница фараона: ступенчатая пирамида с золотой вершиной, обелиски, сфинксы и саркофаг у входа.
// state: shown — саркофаг запечатан; kept — печать светится (фараон сохранён); woken — крышка сдвинута, саркофаг пуст
export function makeTomb(state = 'shown') {
  const g = new THREE.Group();
  const sand = M(0xd8b878), sandD = M(0xb8955a), gold = M(0xd4af37, { metalness: 0.8, roughness: 0.3 }), blue = M(0x1f4fa0);
  for (let i = 0; i < 5; i++) mesh(box(16 - i * 3, 1.8, 16 - i * 3), i % 2 ? sandD : sand, 0, 0.9 + i * 1.8, -4, g);
  mesh(cone(1.6, 2.2, 4), gold, 0, 10.1, -4, g).rotation.y = Math.PI / 4;
  mesh(box(3, 3.4, 0.4), M(0x2a1a10), 0, 1.7, 4.05, g);                 // тёмный вход
  mesh(box(3.8, 0.5, 0.6), gold, 0, 3.6, 4.1, g);
  for (const sx of [-1, 1]) {
    // обелиски
    mesh(box(0.9, 7, 0.9), sandD, sx * 6.5, 3.5, 6, g); mesh(cone(0.65, 1.2, 4), gold, sx * 6.5, 7.6, 6, g).rotation.y = Math.PI / 4;
    // сфинксы
    const sp = new THREE.Group(); sp.position.set(sx * 3.6, 0, 8.5); g.add(sp);
    mesh(box(1.4, 1.1, 3), sand, 0, 0.55, 0, sp); mesh(box(1.1, 1.3, 1.1), sand, 0, 1.6, 1.1, sp);
    mesh(box(1.4, 0.9, 0.3), blue, 0, 1.7, 0.9, sp); mesh(box(0.9, 0.3, 0.9), gold, 0, 2.35, 1.1, sp);
  }
  // саркофаг перед входом
  const sc = new THREE.Group(); sc.position.set(0, 0, 9); g.add(sc);
  mesh(box(2.6, 0.4, 4), sandD, 0, 0.2, 0, sc);
  mesh(box(1.4, 0.9, 3), gold, 0, 0.85, 0, sc);
  const lid = new THREE.Group(); sc.add(lid);
  if (state !== 'woken') {
    mesh(box(1.45, 0.25, 3.05), gold, 0, 1.42, 0, lid);
    mesh(box(0.7, 0.18, 0.7), blue, 0, 1.6, 1.0, lid);                 // маска фараона на крышке
    mesh(box(0.5, 0.12, 0.5), gold, 0, 1.72, 1.0, lid);
    for (let i = 0; i < 4; i++) mesh(box(1.0, 0.04, 0.12), blue, 0, 1.56, -0.8 + i * 0.4, lid);
  } else {
    lid.position.set(1.6, -0.6, 0.4); lid.rotation.z = 0.5;
    mesh(box(1.45, 0.25, 3.05), gold, 0, 1.42, 0, lid);
    mesh(box(1.2, 0.2, 2.7), M(0x1a1008), 0, 1.32, 0, sc);              // пустая тёмная внутренность
  }
  if (state === 'kept') {
    const seal = mesh(cyl(0.4, 0.4, 0.06, 16), M(0x7fe3ff, { emissive: 0x4fc3ff, emissiveIntensity: 2.5 }), 0, 1.6, -0.6, lid); seal.castShadow = false;
    const l = new VLight(0x7fe3ff, 3, 14); l.position.set(0, 2.5, 9); g.add(l);
  }
  for (const sx of [-1.8, 1.8]) brazier(g, sx, 11.5, 1.0);
  return g;
}
// саркофаг фараона (переносной): золотой, с маской на крышке
export function makeSarcophagus() {
  const g = new THREE.Group();
  const gold = M(0xd4af37, { metalness: 0.8, roughness: 0.3 }), blue = M(0x1f4fa0);
  mesh(box(1.1, 0.75, 2.6), gold, 0, 0.38, 0, g);
  mesh(box(1.15, 0.2, 2.65), gold, 0, 0.85, 0, g);
  mesh(box(0.6, 0.16, 0.6), blue, 0, 1.02, 0.8, g);
  mesh(box(0.44, 0.1, 0.44), gold, 0, 1.12, 0.8, g);
  for (let i = 0; i < 4; i++) mesh(box(0.9, 0.03, 0.1), blue, 0, 0.96, -0.6 + i * 0.35, g);
  for (const z of [-1.2, 1.2]) mesh(box(1.5, 0.08, 0.12), M(PAL.woodDark), 0, 0.5, z, g); // ручки для носильщиков
  const l = new VLight(0xffd36b, 1.4, 8); l.position.set(0, 1.6, 0); g.add(l);
  return g;
}
// фараон-мумия: в бинтах, с золотой маской и полосатым платком-немесом
export function makePharaoh() {
  const p = makePlayer(0xe8e0c8, '');
  const u = p.userData, gold = M(0xd4af37, { metalness: 0.8, roughness: 0.3 }), blue = M(0x1f4fa0);
  for (let i = 0; i < 6; i++) mesh(box(0.7, 0.05, 0.5), M(0xcfc6a8), 0, 0.95 + i * 0.22, 0, u.body).rotation.z = (i % 2 ? 0.15 : -0.15); // бинты
  mesh(sph(0.29, 12), gold, 0, 0.02, 0.02, u.head).scale.set(1, 1.05, 1.02);    // золотая маска
  for (const sx of [-1, 1]) { mesh(box(0.12, 0.55, 0.3), blue, sx * 0.28, -0.25, -0.02, u.head); mesh(box(0.13, 0.08, 0.31), gold, sx * 0.28, -0.12, -0.02, u.head); }
  mesh(box(0.08, 0.3, 0.08), gold, 0, -0.38, 0.2, u.head);                       // церемониальная борода
  mesh(sph(0.04, 5), M(0x7fe3ff, { emissive: 0x4fc3ff, emissiveIntensity: 3 }), -0.09, 0.05, 0.27, u.head);
  mesh(sph(0.04, 5), M(0x7fe3ff, { emissive: 0x4fc3ff, emissiveIntensity: 3 }), 0.09, 0.05, 0.27, u.head);
  const l = new VLight(0x7fe3ff, 2, 9); l.position.set(0, 2.4, 0.5); p.add(l);
  p.scale.setScalar(1.3);
  return p;
}
// громкоговоритель: трибуна с бронзовым рупором на столбе
export function makeMegaphone() {
  const g = new THREE.Group();
  const br = M(PAL.bronze, { metalness: 0.7, roughness: 0.35 });
  mesh(box(1.4, 0.5, 1.4), M(PAL.stoneDark), 0, 0.25, 0, g);
  mesh(box(1.0, 0.9, 0.9), M(PAL.marble), 0, 0.95, 0, g);
  mesh(cyl(0.06, 0.07, 2.6, 6), br, 0.45, 1.8, -0.3, g);
  const horn = new THREE.Group(); horn.position.set(0.45, 3.0, -0.3); horn.rotation.x = Math.PI / 2 - 0.25; g.add(horn);
  mesh(cyl(0.45, 0.08, 1.1, 12, true), br, 0, 0.55, 0, horn);
  mesh(cyl(0.12, 0.12, 0.25, 8), br, 0, -0.05, 0, horn);
  mesh(G('megaRing', () => new THREE.TorusGeometry(0.45, 0.04, 5, 14)), br, 0, 1.1, 0, horn).rotation.x = Math.PI / 2;
  return g;
}
// детали, которые делают постройки живыми: амфоры, мешки, жаровни, знамёна, инструменты
function brazier(g, x, z, h = 1.1) {
  const br = M(PAL.bronze, { metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 3; i++) { const lg = mesh(cyl(0.04, 0.04, h, 5), br, x + Math.cos(i * 2.1) * 0.22, h / 2, z + Math.sin(i * 2.1) * 0.22, g); lg.rotation.z = Math.cos(i * 2.1) * 0.15; }
  mesh(cyl(0.38, 0.2, 0.25, 10), br, x, h, z, g);
  const f = mesh(cone(0.25, 0.6, 7), M(0xffa02a, { emissive: 0xff6a00, emissiveIntensity: 3 }), x, h + 0.38, z, g); f.castShadow = false;
  const l = new VLight(0xff8a3a, 2.2, 12); l.position.set(x, h + 0.9, z); g.add(l);
}
function amphora(g, x, z, s = 1, col = 0xb06b3a) {
  const m = M(col);
  mesh(sph(0.32 * s, 10), m, x, 0.42 * s, z, g).scale.set(1, 1.35, 1);
  mesh(cyl(0.1 * s, 0.14 * s, 0.35 * s, 8), m, x, 0.95 * s, z, g);
  for (const sx of [-1, 1]) mesh(G('amphH', () => new THREE.TorusGeometry(0.11, 0.025, 5, 10, Math.PI)), m, x + sx * 0.14 * s, 0.98 * s, z, g).rotation.set(0, Math.PI / 2, sx * 0.3);
}
function sack(g, x, z, ry = 0) { const sk = mesh(sph(0.38, 8), M(0xcdb68a), x, 0.3, z, g); sk.scale.set(1, 0.75, 0.8); sk.rotation.y = ry; mesh(cyl(0.08, 0.12, 0.15, 6), M(0xb59a6a), x, 0.62, z, g); }
function crate(g, x, z, s = 0.8, y = 0) { const c = mesh(box(s, s, s), M(0x9a6a3a), x, y + s / 2, z, g); mesh(box(s * 1.02, s * 0.12, s * 1.02), M(0x5e3b1f), x, y + s * 0.85, z, g); return c; }
function banner(g, x, y, z, ry = 0) {
  mesh(box(0.9, 1.9, 0.04), M(PAL.red), x, y, z, g).rotation.y = ry;
  mesh(box(0.5, 0.18, 0.06), M(0xd4af37, { metalness: 0.7 }), x, y + 0.4, z, g).rotation.y = ry;
  mesh(cyl(0.03, 0.03, 1.1, 5), M(PAL.woodDark), x, y + 0.98, z, g).rotation.z = Math.PI / 2;
}
function decorate(g, type) {
  if (type === 'warehouse') {
    for (let i = 0; i < 4; i++) amphora(g, 4.7, -2.4 + i * 0.75, 0.9, i % 2 ? 0xa65e33 : 0xb87a45);
    for (let i = 0; i < 3; i++) sack(g, -4.7, -2 + i * 0.85, i);
    crate(g, -3.6, 3.6, 0.8); crate(g, -3.6, 3.6, 0.6, 0.8); crate(g, 3.4, 4.9, 0.7);
    for (const x of [-1.6, 1.6]) { mesh(cyl(0.22, 0.25, 3.4, 10), M(PAL.marble), x, 2.1, 3.55, g); }
    mesh(box(4.4, 0.35, 0.9), M(PAL.marble), 0, 3.9, 3.6, g);
    mesh(box(1.6, 0.4, 0.06), M(0xd9c08f), 0, 3.2, 3.42, g); // вывеска HORREUM
    brazier(g, -2.2, 5.6, 0.9); brazier(g, 2.2, 5.6, 0.9);
  } else if (type === 'workshop') {
    mesh(box(0.7, 0.5, 0.4), M(0x555555, { metalness: 0.6, roughness: 0.4 }), 2.7, 0.75, -0.3, g); // наковальня
    mesh(cyl(0.25, 0.3, 0.5, 8), M(PAL.woodDark), 2.7, 0.25, -0.3, g);
    mesh(box(0.5, 0.5, 0.06), M(0xff6a00, { emissive: 0xff4a00, emissiveIntensity: 2.5 }), 1.3, 1.0, -1.07, g); // огонь в печи
    const l = new VLight(0xff6a2a, 2, 9); l.position.set(1.3, 1.2, -0.6); g.add(l);
    for (let i = 0; i < 3; i++) mesh(sph(0.35 + i * 0.12, 7), M(0x9a948c, { transparent: true, opacity: 0.45 - i * 0.1 }), 1.3 + i * 0.2, 5.0 + i * 0.7, -1.6 - i * 0.15, g); // дым
    for (let i = 0; i < 5; i++) mesh(cyl(0.18, 0.18, 2.2, 8), M(0x7a5232), -3.2, 0.2 + (i > 2 ? 0.34 : 0), -2 + (i % 3) * 0.38, g).rotation.z = Math.PI / 2; // поленница
    mesh(box(1.4, 0.08, 0.3), M(PAL.wood), 0.4, 0.75, 2.4, g); mesh(box(0.1, 0.7, 0.5), M(PAL.woodDark), -0.1, 0.38, 2.4, g); mesh(box(0.1, 0.7, 0.5), M(PAL.woodDark), 0.9, 0.38, 2.4, g); // козлы
    amphora(g, -2.8, 1.8, 0.8);
  } else if (type === 'farm') {
    // пугало, стога, поилка для коня, канал
    const sc = new THREE.Group(); sc.position.set(3.5, 0, -3.5); g.add(sc);
    mesh(box(0.1, 2.2, 0.1), M(PAL.wood), 0, 1.1, 0, sc); mesh(box(1.4, 0.1, 0.1), M(PAL.wood), 0, 1.6, 0, sc);
    mesh(box(0.6, 0.8, 0.3), M(0x9e6a3a), 0, 1.4, 0, sc); mesh(sph(0.22, 8), M(0xd6b85a), 0, 2.05, 0, sc); mesh(cone(0.35, 0.3, 10), M(0xc9a74a), 0, 2.3, 0, sc);
    for (let i = 0; i < 3; i++) mesh(cyl(0.55, 0.55, 0.9, 12), M(0xd8b860), -6.6, 0.45 + (i === 2 ? 0.9 : 0), -2 + (i % 2) * 1.2 + (i === 2 ? 0.6 : 0), g).rotation.x = Math.PI / 2;
    mesh(box(2.2, 0.5, 0.7), M(PAL.woodDark), -2, 0.25, 6.3, g); mesh(box(2.0, 0.08, 0.5), M(0x2a9db0, { roughness: 0.2 }), -2, 0.48, 6.3, g); // поилка
    mesh(box(0.4, 0.06, 10), M(0x2a9db0, { roughness: 0.2 }), 0.5, 0.09, 0, g); // оросительная канавка
    const st = new THREE.Group(); st.position.set(-1, 0, -6.6); g.add(st); // навес-конюшня
    for (const [x, z] of [[-1.2, -0.8], [1.2, -0.8], [-1.2, 0.8], [1.2, 0.8]]) mesh(box(0.15, 2.2, 0.15), M(PAL.wood), x, 1.1, z, st);
    mesh(box(2.8, 0.15, 2.0), M(0xc9a876), 0, 2.25, 0, st).rotation.x = 0.12;
    amphora(g, -6.4, 3.6, 0.8, 0xc09050);
  } else if (type === 'shipyard') {
    for (let i = 0; i < 3; i++) mesh(cyl(0.35, 0.35, 0.8, 10), M(0x7a5232), 4.5 - i * 0.8, 0.9, -0.6, g); // бочки
    mesh(G('rope', () => new THREE.TorusGeometry(0.4, 0.12, 6, 14)), M(0xc9b48f), -1.5, 0.62, -1.5, g).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) mesh(box(3.2, 0.12, 0.35), M(0xc79a63), -1.6, 0.56 + i * 0.13, -4.6 + (i % 2) * 0.05, g); // доски
    mesh(cyl(0.06, 0.06, 6, 6), M(PAL.woodDark), 4.6, 3.4, -5.5, g); mesh(box(1.4, 0.9, 0.04), M(PAL.red), 5.3, 5.8, -5.5, g); // флаг
    const anc = new THREE.Group(); anc.position.set(-4.4, 0.55, -5); anc.rotation.z = 0.3; g.add(anc); // якорь
    mesh(box(0.12, 1.3, 0.12), M(0x555555, { metalness: 0.6 }), 0, 0.65, 0, anc); mesh(box(0.9, 0.12, 0.12), M(0x555555, { metalness: 0.6 }), 0, 0.1, 0, anc);
    brazier(g, 0, -0.9, 1.0);
  } else if (type === 'townhall') {
    brazier(g, -3.2, 6.2, 1.5); brazier(g, 3.2, 6.2, 1.5);
    for (const x of [-6.3, 6.3]) { // статуи на постаментах
      mesh(box(1.1, 1.6, 1.1), M(PAL.marble), x, 2.0, 3.0, g);
      mesh(cyl(0.3, 0.45, 1.6, 10), M(0xf3efe4), x, 3.6, 3.0, g); mesh(sph(0.28, 10), M(0xf3efe4), x, 4.65, 3.0, g);
    }
    for (let i = 0; i < 5; i++) banner(g, -4 + i * 2, 4.4, 4.25);
    for (let i = 0; i < 3; i++) mesh(box(6 - i, 0.3, 0.8), M(PAL.marble), 0, 0.15 + i * 0.3, 6.6 - i * 0.4, g); // ступени
  } else if (type === 'camp') {
    brazier(g, -3.2, 2.2, 1.0); brazier(g, 3.2, -2.2, 1.0);
    crate(g, 2.6, -3.6, 0.7); amphora(g, -2.2, -3.4, 0.8); sack(g, -3.4, -3.0);
    banner(g, -1.2, 2.2, -2.45); banner(g, 1.2, 2.2, -2.45);
    const mg = makeMegaphone(); mg.position.set(-2.2, 0.35, 1.4); mg.scale.setScalar(0.8); g.add(mg); // громкоговоритель Лагеря
  }
}
export function makeScaffold(type, r) {
  const g = new THREE.Group();
  const wood = M(PAL.wood);
  const s = r * 0.8;
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) mesh(box(0.2, 3.5, 0.2), wood, x, 1.75, z, g);
  mesh(box(s * 2, 0.15, 0.15), wood, 0, 3.4, -s, g); mesh(box(s * 2, 0.15, 0.15), wood, 0, 3.4, s, g);
  mesh(box(0.15, 0.15, s * 2), wood, -s, 3.4, 0, g); mesh(box(0.15, 0.15, s * 2), wood, s, 3.4, 0, g);
  mesh(box(s * 2, 0.15, 0.15), wood, 0, 1.6, -s, g).rotation.z = 0.5;
  mesh(box(s * 2, 0.3, s * 2), M(PAL.stoneDark), 0, 0.15, 0, g);
  // штабель материалов
  mesh(box(1.5, 0.5, 0.8), M(0xc79a63), s * 0.4, 0.5, s * 0.3, g);
  mesh(box(1, 0.6, 1), M(0xa5402f), -s * 0.4, 0.6, -s * 0.2, g);
  return g;
}
export function makeRuinedOverlay(r) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    mesh(box(1 + Math.random(), 0.5, 1), M(PAL.stoneDark), Math.cos(a) * r * 0.7, 0.25, Math.sin(a) * r * 0.7, g).rotation.y = a;
  }
  const smoke = mesh(sph(1.2, 6), M(0x333333, { transparent: true, opacity: 0.5 }), 0, 4, 0, g);
  g.userData.smoke = smoke;
  return g;
}
// римская галера (бирема) с тараном, двумя рядами вёсел и штандартом с орлом
function textTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let sailTex = null, flagTex = null;
export function makeShip() {
  const g = new THREE.Group();
  const hullM = M(0x5a3820), plank = M(0x7a5232), dark = M(0x3a2414), bronze = M(0xb08d3c, { metalness: 0.7, roughness: 0.35 }), red = M(0x9e2a22), gold = M(0xd4af37, { metalness: 0.8, roughness: 0.3 });
  // корпус: длинный и узкий, сужается к носу и корме
  const L = 14;
  for (let i = 0; i < 9; i++) {
    const z = -L / 2 + (i + 0.5) * (L / 9), k = 1 - Math.pow(Math.abs(z) / (L / 2), 2) * 0.6;
    mesh(box(2.6 * k, 1.3, L / 9 + 0.05), hullM, 0, 0.45, z, g);
    mesh(box(2.7 * k, 0.15, L / 9 + 0.05), red, 0, 1.12, z, g);          // красная полоса вдоль борта
  }
  mesh(box(2.2, 0.12, L * 0.82), plank, 0, 1.2, 0, g);                    // палуба
  // нос: таран и изогнутый форштевень
  const ram = mesh(cone(0.35, 1.8, 8), bronze, 0, 0.0, L / 2 + 0.7, g); ram.rotation.x = Math.PI / 2;
  const prow = mesh(box(0.5, 2.6, 0.6), hullM, 0, 1.4, L / 2 - 0.2, g); prow.rotation.x = 0.35; // форштевень наклонён вперёд
  mesh(sph(0.35, 8), gold, 0, 2.75, L / 2 + 0.24, g);
  for (const sx of [-1, 1]) {
    mesh(sph(0.22, 8), M(0xffffff), sx * 0.75, 0.75, L / 2 - 0.9, g).scale.set(0.3, 1, 1.2); // нарисованный глаз
    mesh(sph(0.11, 6), M(0x111111), sx * 0.79, 0.75, L / 2 - 0.85, g).scale.set(0.3, 1, 1);
  }
  // корма: загнутая вверх, как хвост скорпиона
  let sz = -L / 2, sy = 1.2;
  for (let i = 0; i < 5; i++) { const seg = mesh(box(0.5, 0.9, 0.5), hullM, 0, sy, sz, g); seg.rotation.x = 0.35 + i * 0.25; sz -= 0.35 - i * 0.05; sy += 0.6; }
  mesh(box(1.8, 0.8, 1.8), dark, 0, 1.6, -L / 2 + 1.6, g);               // кормовая надстройка
  for (const sx of [-1, 1]) { const rud = mesh(box(0.12, 2.2, 0.5), dark, sx * 1.15, 0.6, -L / 2 + 1.0, g); rud.rotation.x = 0.4; } // рулевые вёсла
  // два ряда вёсел и щиты легионеров вдоль бортов
  const oars = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) {
    const z = -L / 2 + 2.6 + i * 1.05;
    const o = new THREE.Group(); o.position.set(sx * (1.2 + row * 0.05), 0.65 + row * 0.35, z); g.add(o);
    const blade = mesh(box(0.06, 0.06, 3.2), plank, sx * 1.4, -0.55, 0, o); blade.rotation.z = sx * (0.45 + row * 0.12); blade.rotation.y = Math.PI / 2;
    oars.push(o);
  }
  for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) { const sh = mesh(cyl(0.38, 0.38, 0.08, 10), i % 2 ? red : M(0xe0b52a), sx * 1.32, 1.45, -L / 2 + 3 + i * 1.3, g); sh.rotation.z = Math.PI / 2; }
  // мачта и прямой парус в полоску с орлом
  mesh(cyl(0.13, 0.15, 8, 8), plank, 0, 5.1, 1, g);
  mesh(cyl(0.08, 0.08, 6, 6), plank, 0, 8.6, 1.1, g).rotation.z = Math.PI / 2;
  if (!sailTex) sailTex = textTex(128, 128, (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f0e6d2' : '#a52a22'; x.fillRect(i * w / 8, 0, w / 8, h); }
    x.fillStyle = '#d4af37'; x.beginPath(); x.arc(w / 2, h * 0.45, 22, 0, 7); x.fill();
    x.fillStyle = '#7a1414'; x.font = 'bold 26px Georgia'; x.textAlign = 'center'; x.fillText('SPQR', w / 2, h * 0.88);
    x.strokeStyle = '#5a3a1a'; x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2 - 14, h * 0.45); x.lineTo(w / 2 + 14, h * 0.45); x.moveTo(w / 2, h * 0.32); x.lineTo(w / 2, h * 0.58); x.stroke();
  });
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 4.6, 6, 4), new THREE.MeshStandardMaterial({ map: sailTex, side: THREE.DoubleSide, roughness: 0.9 }));
  { const pos = sail.geometry.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.cos(pos.getX(i) / 2.8 * 1.2) * 0.6); sail.geometry.computeVertexNormals(); }
  sail.position.set(0, 6.2, 1.25); sail.castShadow = true; g.add(sail);
  // римский штандарт на корме: золотой орёл и красный вексиллум
  const pole = mesh(cyl(0.05, 0.05, 4.2, 6), bronze, 0, 4.0, -L / 2 + 1.6, g);
  mesh(sph(0.22, 8), gold, 0, 6.3, -L / 2 + 1.6, g);
  for (const sx of [-1, 1]) { const w = mesh(box(0.7, 0.1, 0.25), gold, sx * 0.4, 6.45, -L / 2 + 1.6, g); w.rotation.z = sx * 0.5; }
  mesh(box(0.9, 0.08, 0.08), bronze, 0, 5.6, -L / 2 + 1.6, g);
  if (!flagTex) flagTex = textTex(64, 80, (x, w, h) => { x.fillStyle = '#a52a22'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d4af37'; x.lineWidth = 4; x.strokeRect(3, 3, w - 6, h - 6); x.fillStyle = '#d4af37'; x.font = 'bold 15px Georgia'; x.textAlign = 'center'; x.fillText('SPQR', w / 2, h / 2 + 5); });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.05), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide }));
  flag.position.set(0, 5.0, -L / 2 + 1.6); flag.rotation.y = Math.PI / 2; g.add(flag);
  g.userData = { oars, sail, flag };
  return g;
}
// гребля и колыхание паруса/знамени
export function animateShip(sh, t, rowing) {
  const u = sh.userData; if (!u.oars) return;
  const a = rowing ? Math.sin(t * 3) * 0.35 : 0;
  u.oars.forEach((o, i) => { o.rotation.y = a * (i % 2 ? -1 : 1); o.rotation.x = rowing ? Math.cos(t * 3) * 0.15 : 0; });
  u.flag.rotation.y = Math.PI / 2 + Math.sin(t * 2.3) * 0.25;
}
// каркас строящегося корабля: киль, рёбра и часть обшивки по мере готовности
export function makeShipFrame(progress = 0) {
  const g = new THREE.Group();
  const wood = M(0x8a5a32), dark = M(0x5e3b1f);
  mesh(box(0.35, 0.35, 9.5), dark, 0, 0.1, 0, g);                       // киль
  const ribs = 9, shown = Math.max(2, Math.round(ribs * (0.3 + 0.7 * progress)));
  for (let i = 0; i < shown; i++) {
    const z = -4 + i;
    for (const sx of [-1, 1]) { const r = mesh(box(0.15, 1.6, 0.15), wood, sx * 1.1, 0.8, z, g); r.rotation.z = sx * 0.35; }
  }
  const planks = Math.round(5 * progress);
  for (let j = 0; j < planks; j++) for (const sx of [-1, 1]) mesh(box(0.06, 0.25, 9), wood, sx * (0.75 + j * 0.1), 0.3 + j * 0.28, 0, g);
  // строительные леса и подпорки
  for (const z of [-4, 0, 4]) for (const sx of [-1, 1]) mesh(cyl(0.08, 0.08, 3.5, 5), dark, sx * 2, -0.6, z, g);
  return g;
}
export function makeBoat() {
  const g = new THREE.Group();
  mesh(box(1.5, 0.6, 4), M(0x6b4423), 0, 0.3, 0, g);
  mesh(box(1.2, 0.1, 3.6), M(0x8a5a32), 0, 0.6, 0, g);
  mesh(box(1.4, 0.05, 0.25), M(0x5e3b1f), 0, 0.65, 0.3, g);
  return g;
}

// ---------- Точки интереса ----------
export function makePOI(type, opt = {}) {
  const g = new THREE.Group();
  const st = M(PAL.stone), stD = M(PAL.stoneDark);
  if (type === 'ruins') {
    for (let i = 0; i < 3; i++) mesh(box(14 - i, 0.4, 9 - i), stD, 0, 0.2 + i * 0.4, 0, g);
    const br = [0, 0.6, 0.2, 0.8, 0, 0.5, 0.9, 0.3];
    for (let i = 0; i < 4; i++) { column(g, -4.5 + i * 3, 3, 5, 0.38, st, br[i]).position.y = 1.2; column(g, -4.5 + i * 3, -3, 5, 0.38, st, br[i + 4]).position.y = 1.2; }
    mesh(box(7, 0.6, 1), st, -1.5, 6.9, 3, g); // уцелевший архитрав
    for (let i = 0; i < 5; i++) mesh(cyl(0.38, 0.38, 1.6, 10), st, -6 + i * 2.8, 0.4, 6 + (i % 2), g).rotation.z = Math.PI / 2;
    mesh(box(1.4, 2, 1), M(PAL.marble), 0, 2.2, 0, g); // постамент
  } else if (type === 'village') {
    const spots = [[-6, -4], [5, -5], [-4, 6], [6, 5], [0, -9]];
    for (const [x, z] of spots) {
      const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = Math.random() * 6; g.add(h);
      mesh(box(3.5, 2, 3), M(0xc9a876), 0, 1, 0, h);
      mesh(box(1, 1.4, 0.1), M(0x3a2a1a), 0, 0.7, 1.52, h);
      if (Math.random() < 0.5) gableRoof(h, 3.5, 3, 2, 1.0, M(PAL.roofDark)).rotation.z = 0.15;
      else mesh(box(1.5, 0.8, 3), M(0xb89866), 1, 2.1, 0, h).rotation.z = 0.3; // обвал
    }
    mesh(cyl(1.1, 1.2, 0.9, 10), st, 0, 0.45, 0, g); // колодец
    mesh(cyl(0.8, 0.8, 0.95, 10), M(0x222222), 0, 0.5, 0, g);
  } else if (type === 'shrine') {
    mesh(cyl(4.5, 5, 0.5, 12), stD, 0, 0.25, 0, g);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; column(g, Math.cos(a) * 3.5, Math.sin(a) * 3.5, 3.5, 0.25, st, i === 2 ? 0.5 : 0).position.y = 0.5; }
    mesh(cyl(4, 4, 0.4, 12), st, 0, 4.6, 0, g);
    mesh(cone(4.2, 1.6, 12), M(0x8e9a6a), 0, 5.6, 0, g);
    mesh(box(1.2, 1.1, 0.8), M(PAL.marble), 0, 1.05, 0, g);
    const fire = mesh(cone(0.3, 0.6, 6), M(0x77ff88, { emissive: 0x33ff66, emissiveIntensity: 1.5 }), 0, 1.9, 0, g);
    g.userData.fire = fire;
  } else if (type === 'altar') {
    const dark = M(0x4a3b33);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const s = mesh(box(1.2, 3.5 + (i % 3), 0.8), dark, Math.cos(a) * 7, 1.8, Math.sin(a) * 7, g); s.rotation.y = -a; s.rotation.z = (i % 2 ? 0.1 : -0.08); }
    mesh(box(3, 1.2, 1.8), dark, 0, 0.6, 0, g);
    mesh(box(2.6, 0.08, 1.4), M(0x6a0d0d, { emissive: 0x330000 }), 0, 1.24, 0, g);
    mesh(sph(0.3, 6), M(0xddddcc), 0.8, 1.45, 0.2, g); // череп
  } else if (type === 'cove') {
    for (let i = 0; i < 5; i++) mesh(G('rock', () => new THREE.DodecahedronGeometry(0.8, 0)), M(PAL.rock), Math.cos(i) * 6, 1, Math.sin(i * 2) * 4, g).scale.set(3, 2.5, 2.5);
    const boat = makeBoat(); boat.position.set(0, -0.2, 6); g.add(boat);
    mesh(box(0.2, 1.6, 0.2), M(PAL.wood), 1.5, 0.8, 3.5, g);
    mesh(box(0.6, 0.6, 0.6), M(0x6b4423), -1.5, 0.3, 3.5, g);
  } else if (type === 'market') {
    // ларёк с полосатым навесом
    const wood = M(PAL.wood);
    for (const [x, z] of [[-2.5, -1.5], [2.5, -1.5], [-2.5, 1.5], [2.5, 1.5]]) mesh(box(0.15, 2.6, 0.15), wood, x, 1.3, z, g);
    for (let i = 0; i < 6; i++) { const st = mesh(box(0.9, 0.06, 3.6), M(i % 2 ? 0xf4ead2 : 0xb3282d), -2.25 + i * 0.9, 2.75, 0, g); st.rotation.x = 0.12; }
    mesh(box(5, 1, 1.2), wood, 0, 0.5, 1.4, g);                      // прилавок
    for (let i = 0; i < 5; i++) mesh(cyl(0.12, 0.15, 0.35, 8), M([0xff4d6d, 0xff9f1c, 0x2ec4b6, 0x5fc46a, 0xff4d6d][i], { emissive: [0xff4d6d, 0xff9f1c, 0x2ec4b6, 0x5fc46a, 0xff4d6d][i], emissiveIntensity: 0.6 }), -1.8 + i * 0.9, 1.2, 1.4, g);
    const sw = mesh(box(0.1, 0.9, 0.04), M(0xffe066, { emissive: 0xffe066, emissiveIntensity: 2 }), 1.9, 1.5, 1.6, g); sw.rotation.z = 0.5;
    for (let i = 0; i < 3; i++) mesh(cyl(0.35, 0.25, 1.0, 8), M(0xb06b3a), -3.4, 0.5, -1 + i * 0.9, g);
    mesh(box(1.5, 1, 1), M(0x6b4423), 3.4, 0.5, -0.8, g);
    // торговец
    const mer = makePlayer(0x5b3a8c, ''); mer.position.set(0, 0, 0); mer.rotation.y = 0; g.add(mer);
    mesh(sph(0.3, 10), M(0xf2efe6), 0, 2.55, 0, mer.userData.body).scale.set(1.05, 0.7, 1.05); // тюрбан
    // ослик с поклажей
    const don = makeAnimal('boar'); don.position.set(-5, 0, 2); don.rotation.y = 1.2; don.scale.setScalar(0.9);
    don.traverse((c) => { if (c.isMesh) c.material = M(0x8a8a8a); }); g.add(don);
    g.userData.merchant = mer;
  } else if (type === 'lair') {
    // тайная мастерская: шатёр из шкур, наковальня, ящики, тёмный костёр
    const hide = M(0x7a5232), dark = M(0x2b2420);
    const tent = mesh(cone(4, 3.6, 7), hide, 0, 1.8, -1.5, g);
    mesh(box(1.2, 1.6, 0.1), dark, 0, 0.8, 1.9, g);
    mesh(box(0.8, 0.5, 0.5), M(0x444444, { metalness: 0.7, roughness: 0.4 }), 3, 0.7, 2, g); // наковальня
    mesh(box(0.5, 0.45, 0.4), dark, 3, 0.22, 2, g);
    for (let i = 0; i < 4; i++) mesh(box(0.8, 0.7, 0.8), M(0x5e3b1f), -3.2 + (i % 2) * 0.9, 0.35 + Math.floor(i / 2) * 0.7, 2.4, g);
    for (let i = 0; i < 3; i++) mesh(box(1.4, 0.04, 0.9), hide, -1 + i * 1.2, 0.03, 3.6, g).rotation.y = i; // шкуры на земле
    const fire = mesh(cone(0.3, 0.7, 6), M(0x9b30ff, { emissive: 0x7a1fd1, emissiveIntensity: 2 }), 1, 0.4, 4.2, g);
    const fl = new VLight(0x9b30ff, 3, 12); fl.position.set(1, 1.5, 4.2); g.add(fl);
    g.userData.fire = fire;
    for (let i = 0; i < 3; i++) mesh(sph(0.2, 6), M(0xe8e2cc), -2 + i * 0.5, 0.2, 4.5, g); // черепа
  } else if (type === 'lighthouse') {
    // Фаросский маяк: ступенчатая башня на скале; огонь — только когда восстановлен
    const st = M(PAL.stone), stD = M(PAL.stoneDark);
    mesh(cyl(6, 7, 1.2, 12), M(PAL.rock), 0, 0.6, 0, g);
    mesh(box(7, 7, 7), st, 0, 4.7, 0, g);
    mesh(box(7.6, 0.5, 7.6), stD, 0, 8.4, 0, g);
    const broken = !opt.lit;
    mesh(cyl(2.6, 3.2, broken ? 5 : 8, 8), st, 0, broken ? 11.1 : 12.6, 0, g);
    if (broken) {
      for (let i = 0; i < 5; i++) mesh(box(1.2, 0.8, 1.0), stD, Math.cos(i * 1.3) * 5, 0.4, Math.sin(i * 1.3) * 5, g).rotation.y = i;
    } else {
      mesh(cyl(2.9, 2.9, 0.4, 8), stD, 0, 16.8, 0, g);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; mesh(box(0.35, 2.2, 0.35), st, Math.cos(a) * 2.2, 18.1, Math.sin(a) * 2.2, g); }
      mesh(cone(2.8, 1.6, 8), M(0x8a4a2a), 0, 20.0, 0, g);
      const fire = mesh(cone(1.1, 2.0, 8), M(0xffb030, { emissive: 0xff8000, emissiveIntensity: 3.5 }), 0, 18.0, 0, g); fire.castShadow = false;
      const l = new VLight(0xffa040, 40, 120, 1.2); l.position.set(0, 18.5, 0); g.add(l);
      g.userData.fire = fire;
    }
    mesh(box(1.6, 2.6, 0.2), M(PAL.woodDark), 0, 2.4, 3.55, g);
  } else if (type === 'quarry') {
    // каменоломня: ступенчатый срез скалы с мраморными жилами, кран с подвешенным блоком, штабеля, тележка на рельсах
    const rock = M(0xb8aa98), rockD = M(0x9c8e7c), marble = M(0xf2efe8), vein = M(0xdcd8ff), wood = M(PAL.wood), woodD = M(PAL.woodDark);
    for (let i = 0; i < 3; i++) {
      mesh(box(12 - i * 3, 2.5, 4), i % 2 ? rockD : rock, 0, 1.25 + i * 2.5, -4.5 - i * 2.2, g);
      mesh(box(11.6 - i * 3, 0.5, 0.06), marble, 0, 1.6 + i * 2.5, -2.48 - i * 2.2, g);           // срез мрамора
      mesh(box(0.25, 1.8, 0.05), vein, -2 + i * 1.5, 1.4 + i * 2.5, -2.46 - i * 2.2, g).rotation.z = 0.4; // жила
      mesh(box(0.2, 1.4, 0.05), vein, 2.5 - i, 1.3 + i * 2.5, -2.46 - i * 2.2, g).rotation.z = -0.6;
    }
    for (let i = 0; i < 6; i++) mesh(G('rock', () => new THREE.DodecahedronGeometry(0.8, 0)), rockD, Math.cos(i * 1.7) * 7.5, 0.4, -3 + Math.sin(i * 2.3) * 3, g).scale.set(1.1, 0.7, 1);
    // ступени-подмостки на срез
    for (let i = 0; i < 3; i++) mesh(box(1.4, 0.15, 1.2), wood, -5 + i * 0.1, 0.9 + i * 2.5, -2.2 - i * 2.2, g);
    for (let i = 0; i < 6; i++) mesh(box(0.12, 2.5, 0.12), woodD, -5.6 + (i % 2) * 1.2, 1.25 + Math.floor(i / 2) * 2.5, -2.2 - Math.floor(i / 2) * 2.2, g);
    // штабель тёсаных блоков, обвязанных верёвкой
    for (let i = 0; i < 6; i++) { const b = mesh(box(1.4, 0.95, 1.0), marble, -4 + (i % 3) * 1.6, 0.48 + Math.floor(i / 3) * 0.95, 3, g); if (i === 4) mesh(box(1.45, 0.08, 1.05), M(0xc9b48f), 0, 0, 0, b); }
    // кран: две ноги, стрела, ворот, верёвка и подвешенный блок
    mesh(box(0.3, 6.5, 0.3), wood, 4.4, 3.25, 1.4, g); mesh(box(0.3, 6.5, 0.3), wood, 5.6, 3.25, 0.6, g);
    mesh(box(0.25, 0.25, 6.4), wood, 5, 6.4, -1.3, g).rotation.x = 0.12;
    mesh(cyl(0.35, 0.35, 1.4, 10), woodD, 5, 1.2, 1.0, g).rotation.z = Math.PI / 2;
    mesh(cyl(0.025, 0.025, 3.2, 4), M(0x5a4a30), 5, 4.6, -4.1, g);
    mesh(box(1.2, 0.8, 0.8), marble, 5, 2.6, -4.1, g);
    // рельсы и тележка с мрамором
    for (const x of [-6.5, -5.5]) mesh(box(0.08, 0.06, 9), M(0x5e3b1f), x, 0.05, 1, g);
    for (let i = 0; i < 8; i++) mesh(box(1.5, 0.08, 0.25), woodD, -6, 0.03, -3 + i * 1.15, g);
    mesh(box(1.3, 0.7, 1.8), wood, -6, 0.6, 4, g); mesh(box(1.1, 0.5, 1.4), marble, -6, 1.1, 4, g);
    for (const z of [3.3, 4.7]) for (const x of [-6.7, -5.3]) mesh(cyl(0.25, 0.25, 0.12, 10), woodD, x, 0.25, z, g).rotation.z = Math.PI / 2;
    // стойка с инструментами и навес каменотёсов
    mesh(box(1.6, 0.1, 0.1), woodD, 2, 1.4, 4.5, g);
    for (let i = 0; i < 3; i++) { mesh(box(0.06, 1.3, 0.06), wood, 1.4 + i * 0.6, 0.75, 4.55, g); mesh(box(0.35, 0.12, 0.08), M(0x777777, { metalness: 0.6 }), 1.4 + i * 0.6, 1.35, 4.6, g); }
    const tent = new THREE.Group(); tent.position.set(7.5, 0, 3.5); g.add(tent);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(box(0.12, 2.2, 0.12), wood, x, 1.1, z, tent);
    for (let i = 0; i < 4; i++) mesh(box(0.55, 0.06, 2.3), M(i % 2 ? 0xe8dcc0 : 0x9e2a22), -0.83 + i * 0.55, 2.25, 0, tent).rotation.x = 0.08;
    brazier(g, 2.5, 1.8, 1.0);
    for (let i = 0; i < 10; i++) mesh(box(0.25, 0.08, 0.2), marble, Math.cos(i * 2.1) * (2 + i * 0.3), 0.04, 1 + Math.sin(i * 1.3) * 1.5, g).rotation.y = i; // крошка
  } else if (type === 'colosseum') {
    g.add(makeColosseum(!!opt.restored));
  } else if (type === 'olympus') {
    // Храм Олимпа: большой храм; руины или восстановленный, с золотой крышей и статуей Зевса
    const marble = M(PAL.marble), st = M(PAL.stone), gold = M(0xd4af37, { metalness: 0.7, roughness: 0.35 });
    const ok = !!opt.restored;
    for (let i = 0; i < 4; i++) mesh(box(20 - i * 1.0, 0.45, 13 - i * 1.0), st, 0, 0.22 + i * 0.45, 0, g);
    const base = 1.8;
    const br = [0, 0.5, 0, 0.7, 0.2, 0, 0.6, 0, 0.3, 0.8, 0, 0.4, 0.2, 0.6];
    let k = 0;
    for (let i = 0; i < 7; i++) for (const z of [-5, 5]) column(g, -7.5 + i * 2.5, z, 7, 0.45, marble, ok ? 0 : br[k++ % br.length]).position.y = base;
    if (ok) {
      mesh(box(18.5, 0.8, 12), marble, 0, base + 7.6, 0, g);
      const ped = new THREE.Shape(); ped.moveTo(-9.6, 0); ped.lineTo(9.6, 0); ped.lineTo(0, 3); ped.lineTo(-9.6, 0);
      const pg = new THREE.ExtrudeGeometry(ped, { depth: 12.4, bevelEnabled: false }); pg.translate(0, 0, -6.2);
      mesh(pg, gold, 0, base + 8, 0, g);
      // Зевс с молнией
      const z = new THREE.Group(); z.position.set(0, base, 0); g.add(z);
      mesh(box(2, 1.2, 2), marble, 0, 0.6, 0, z);
      mesh(cyl(0.5, 0.75, 2.4, 10), marble, 0, 2.4, 0, z);
      mesh(sph(0.45, 10), marble, 0, 4.0, 0, z);
      const bolt = mesh(box(0.15, 1.6, 0.15), M(0xfff27a, { emissive: 0xffe040, emissiveIntensity: 2.5 }), 0.8, 3.8, 0, z); bolt.rotation.z = 0.4;
      const l = new VLight(0xfff0a0, 8, 30); l.position.set(0, 5, 3); g.add(l);
    } else {
      mesh(box(8, 0.8, 1.6), marble, -4, base + 7.6, 5, g);
      for (let i = 0; i < 6; i++) mesh(cyl(0.45, 0.45, 2.2, 10), marble, -8 + i * 3.2, 0.45, 8 + (i % 2), g).rotation.z = Math.PI / 2;
      mesh(box(2, 1.2, 2), marble, 0, base + 0.6, 0, g); // пустой постамент
    }
  } else if (type === 'tower') {
    // Боевая башня римского дозора: руины или восстановленная, с баллистой и жаровней
    const wood = M(PAL.wood), woodD = M(PAL.woodDark), ok = !!opt.restored, H = ok ? 11 : 5.5;
    mesh(box(6.2, 0.6, 6.2), stD, 0, 0.3, 0, g);
    mesh(box(4.6, H, 4.6), st, 0, 0.6 + H / 2, 0, g);
    for (let y = 3; y < H; y += 3.5) mesh(box(4.85, 0.25, 4.85), stD, 0, 0.6 + y, 0, g);
    mesh(box(1.2, 2.1, 0.12), woodD, 0, 1.65, 2.33, g);
    mesh(box(1.5, 0.25, 0.2), stD, 0, 2.8, 2.36, g);
    for (const [x, z, ry] of [[0, 2.33, 0], [2.33, 0, Math.PI / 2], [-2.33, 0, Math.PI / 2], [0, -2.33, 0]]) for (const y of [4.6, 8.2]) if (y < H) mesh(box(0.28, 0.95, 0.1), M(0x222222), x, y, z, g).rotation.y = ry;
    if (ok) {
      const top = 0.6 + H;
      mesh(box(5.6, 0.4, 5.6), stD, 0, top + 0.2, 0, g);
      for (let k = -2; k <= 2; k += 1.33) for (const [x, z] of [[k, -2.6], [k, 2.6], [-2.6, k], [2.6, k]]) mesh(box(0.75, 0.9, 0.75), st, x, top + 0.85, z, g);
      const bal = new THREE.Group(); bal.position.set(0, top + 0.4, 0.4); g.add(bal);
      mesh(box(0.35, 0.7, 0.35), woodD, 0, 0.35, 0, bal);
      mesh(box(0.28, 0.22, 2.4), wood, 0, 0.8, 0.3, bal);
      mesh(box(2.2, 0.14, 0.14), woodD, 0, 0.85, 1.1, bal);
      mesh(cyl(0.03, 0.03, 1.6, 4), M(0x9a7a4a), 0, 0.95, 0.6, bal).rotation.x = Math.PI / 2; // болт
      mesh(cyl(0.06, 0.06, 3.8, 6), M(PAL.bronze, { metalness: 0.6 }), 1.9, top + 2.3, -1.9, g);
      mesh(box(1.2, 1.6, 0.05), M(PAL.red), 2.55, top + 3.3, -1.9, g);
      mesh(box(0.7, 0.2, 0.06), M(0xd4af37, { metalness: 0.7 }), 2.55, top + 3.0, -1.86, g);
      mesh(sph(0.2, 8), M(0xd4af37, { metalness: 0.7 }), 1.9, top + 4.3, -1.9, g);
      mesh(cyl(0.45, 0.3, 0.4, 10), M(PAL.bronze, { metalness: 0.6 }), -1.7, top + 0.6, 1.7, g);
      const fire = mesh(cone(0.32, 0.8, 7), M(0xffa02a, { emissive: 0xff6a00, emissiveIntensity: 3 }), -1.7, top + 1.15, 1.7, g); fire.castShadow = false;
      const l = new VLight(0xff8a3a, 4, 26); l.position.set(-1.7, top + 1.8, 1.7); g.add(l);
      g.userData.fire = fire;
      for (let i = 0; i < 9; i++) mesh(box(0.9, 0.1, 0.25), wood, 2.55, 0.9 + i * 1.2, 1.4, g); // лестница снаружи
      mesh(box(0.1, H, 0.1), wood, 2.55, 0.6 + H / 2, 1.0, g); mesh(box(0.1, H, 0.1), wood, 2.55, 0.6 + H / 2, 1.8, g);
    } else {
      for (let i = 0; i < 10; i++) { const a = i * 0.69, d = 3.4 + (i % 3) * 0.9; mesh(box(0.8 + (i % 2) * 0.5, 0.55, 0.7), stD, Math.cos(a) * d, 0.28, Math.sin(a) * d, g).rotation.y = a; }
      mesh(box(2.6, 1.1, 0.7), st, 0.9, 0.6 + H + 0.35, 1.7, g).rotation.z = 0.3;
      mesh(box(1.4, 0.8, 0.7), st, -1.4, 0.6 + H + 0.2, -1.5, g).rotation.z = -0.2;
      for (const [x, z] of [[-3, -3], [3, -3], [-3, 3]]) mesh(box(0.15, 5.5, 0.15), wood, x, 2.75, z, g);
      mesh(box(6, 0.12, 0.15), wood, 0, 5.2, -3, g);
    }
  } else if (type === 'prison') {
    // остров тюремщиков: клетки, остатки лагеря, сторожевая вышка
    const wood = M(PAL.woodDark), iron = M(0x4a4a4e, { metalness: 0.6, roughness: 0.5 });
    for (let c = 0; c < 3; c++) {
      const cg = new THREE.Group(); cg.position.set(-5 + c * 5, 0, -3); cg.rotation.y = (c - 1) * 0.3; g.add(cg);
      mesh(box(3.2, 0.25, 3.2), wood, 0, 0.12, 0, cg);
      mesh(box(3.2, 0.25, 3.2), wood, 0, 2.6, 0, cg);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; if (c === 1 && i === 2) continue; mesh(cyl(0.05, 0.05, 2.4, 5), iron, Math.cos(a) * 1.5, 1.35, Math.sin(a) * 1.5, cg); }
    }
    const tent = mesh(cone(2.5, 2.4, 6), M(0x8a7a5a), 4, 1.2, 4, g); tent.rotation.z = 0.25; // покосившийся шатёр
    mesh(box(2.2, 0.15, 1.4), M(0x7a6a4a), -4, 0.08, 4.5, g).rotation.y = 0.7; // рваная ткань
    for (const [x, z] of [[-1, 6], [1.5, 6]]) mesh(box(0.25, 5, 0.25), wood, x, 2.5, z, g);
    mesh(box(3, 0.2, 2.4), wood, 0.25, 5, 6, g);
    mesh(box(3, 1, 0.1), wood, 0.25, 5.5, 7.2, g);
    for (let i = 0; i < 4; i++) mesh(sph(0.18, 6), M(0xe8e2cc), -2 + i * 1.3, 0.15, 1.5, g); // кандалы и кости
    mesh(cyl(0.3, 0.3, 0.5, 8), M(0x3a2a1a), 2.5, 0.25, 1, g); // погасший костёр
  } else if (type === 'temple') {
    // маленький полуразрушенный Парфенон с предсказателем
    const marble = M(PAL.marble), st = M(PAL.stone);
    for (let i = 0; i < 3; i++) mesh(box(13 - i * 0.8, 0.4, 8.5 - i * 0.8), st, 0, 0.2 + i * 0.4, 0, g);
    const br = [0, 0.4, 0, 0, 0.7, 0, 0.2, 0.55, 0, 0, 0.8, 0.3];
    let k = 0;
    for (let i = 0; i < 6; i++) for (const z of [-3, 3]) column(g, -5 + i * 2, z, 5, 0.35, marble, br[k++]).position.y = 1.2;
    // уцелевший фрагмент антаблемента и фронтона
    mesh(box(6.5, 0.6, 1.0), marble, -2, 7.0, 3, g);
    const ped = new THREE.Shape(); ped.moveTo(-3.3, 0); ped.lineTo(3.3, 0); ped.lineTo(0, 1.6); ped.lineTo(-3.3, 0);
    const pg = new THREE.ExtrudeGeometry(ped, { depth: 0.6, bevelEnabled: false });
    mesh(pg, marble, -2, 7.3, 2.7, g);
    mesh(box(1.4, 0.5, 1.4), marble, 4, 1.45, -1, g).rotation.y = 0.5; // упавшие блоки
    mesh(cyl(0.35, 0.35, 2.2, 10), marble, 5.5, 0.55, 5.2, g).rotation.z = Math.PI / 2;
    // треножник с огнём
    for (let i = 0; i < 3; i++) { const lg = mesh(cyl(0.04, 0.04, 1.4, 5), M(PAL.bronze, { metalness: 0.7 }), Math.cos(i * 2.1) * 0.3, 1.9, -1.2 + Math.sin(i * 2.1) * 0.3, g); lg.rotation.z = Math.cos(i * 2.1) * 0.2; }
    mesh(cyl(0.45, 0.25, 0.25, 10), M(PAL.bronze, { metalness: 0.7 }), 0, 2.6, -1.2, g);
    const flame = mesh(cone(0.3, 0.8, 7), M(0x8fd3ff, { emissive: 0x4fb3ff, emissiveIntensity: 2.2 }), 0, 3.1, -1.2, g);
    const fl = new VLight(0x8fd3ff, 3, 14); fl.position.set(0, 3.5, -1.2); g.add(fl);
    // предсказатель в капюшоне, с посохом
    const sage = new THREE.Group(); sage.position.set(0, 1.2, 0.6); g.add(sage);
    const robe = M(0xe8e2d0);
    mesh(cyl(0.3, 0.55, 1.7, 10), robe, 0, 0.85, 0, sage);
    mesh(sph(0.24, 10), M(PAL.skin), 0, 1.95, 0.02, sage);
    mesh(sph(0.3, 10), robe, 0, 2.0, -0.06, sage).scale.set(1, 1.1, 1); // капюшон
    mesh(cone(0.18, 0.5, 6), M(0xdddddd), 0, 1.65, 0.18, sage).rotation.x = Math.PI; // седая борода
    mesh(cyl(0.035, 0.035, 2.6, 5), M(PAL.woodDark), 0.5, 1.3, 0.1, sage);
    const orb = mesh(sph(0.14, 8), M(0x9ad9ff, { emissive: 0x6fc8ff, emissiveIntensity: 2 }), 0.5, 2.7, 0.1, sage);
    g.userData.fire = flame; g.userData.orb = orb;
  } else if (type === 'arena') {
    // кольцо полуразрушенных колонн и частокол — арена боевого слона
    const st = M(PAL.stoneDark), bone = M(0xe8e2cc);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      if (i % 4 === 0) continue; // проходы
      column(g, Math.cos(a) * 24, Math.sin(a) * 24, 6, 0.6, st, (i % 3) * 0.3);
    }
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      if (Math.abs(((i / 40) * 4) % 1) < 0.12) continue;
      const pk = mesh(cone(0.18, 2.2, 5), M(0x6e5438), Math.cos(a) * 26, 1.1, Math.sin(a) * 26, g); pk.rotation.z = Math.cos(a) * 0.25; pk.rotation.x = -Math.sin(a) * 0.25;
    }
    for (let i = 0; i < 8; i++) { const b = mesh(cyl(0.12, 0.12, 2.5, 5), bone, Math.cos(i * 0.8) * 15, 0.15, Math.sin(i * 1.3) * 15, g); b.rotation.z = Math.PI / 2; b.rotation.y = i; }
    mesh(sph(1.2, 8), bone, 8, 0.6, -10, g).scale.set(1, 0.8, 1.3); // огромный череп
  }
  return g;
}

// ---------- Белый конь ----------
export function makeHorse(brown = false) {
  const g = new THREE.Group();
  const w = brown ? M(0x7a4a26) : M(0xf7f5ef, { emissive: 0x2a2a30, emissiveIntensity: 0.2 }), mane = brown ? M(0x2a1a10) : M(0xe8e4d8), hoof = M(0x555555);
  const body = new THREE.Group(); g.add(body);
  mesh(cyl(0.48, 0.5, 1.9, 10), w, 0, 1.45, 0, body).rotation.x = Math.PI / 2;
  const neck = mesh(cyl(0.22, 0.34, 1.0, 8), w, 0, 2.0, 0.95, body); neck.rotation.x = 0.6;
  const head = mesh(box(0.32, 0.36, 0.75), w, 0, 2.4, 1.45, body); head.rotation.x = 0.35;
  mesh(box(0.08, 0.5, 0.9), mane, 0, 2.25, 0.85, body).rotation.x = 0.6;
  mesh(cone(0.06, 0.18, 4), w, -0.1, 2.65, 1.25, body); mesh(cone(0.06, 0.18, 4), w, 0.1, 2.65, 1.25, body);
  const tail = mesh(cyl(0.08, 0.15, 0.9, 6), mane, 0, 1.3, -1.15, body); tail.rotation.x = -0.5;
  // седло с римским чепраком, стремена и уздечка
  mesh(box(0.8, 0.12, 0.8), M(0x9e2a22), 0, 1.97, 0.05, body);
  mesh(box(0.6, 0.15, 0.6), M(0x6b4423), 0, 2.08, 0.05, body);
  mesh(box(0.62, 0.12, 0.08), M(0x6b4423), 0, 2.2, -0.22, body);            // задняя лука
  for (const sx of [-1, 1]) {
    mesh(box(0.03, 0.55, 0.04), M(0x3a2a1a), sx * 0.5, 1.75, 0.1, body);   // путлище
    mesh(box(0.14, 0.04, 0.1), M(0x888888, { metalness: 0.6 }), sx * 0.5, 1.47, 0.1, body); // стремя
    mesh(box(0.03, 0.03, 0.9), M(0x3a2a1a), sx * 0.18, 2.25, 0.95, body).rotation.x = 0.35; // поводья
  }
  if (brown) { mesh(box(0.34, 0.06, 0.3), M(0xf2efe6), 0, 2.58, 1.62, body).rotation.x = 0.35; } // белая проточина
  const legs = [];
  for (const [x, z] of [[-0.28, 0.7], [0.28, 0.7], [-0.28, -0.7], [0.28, -0.7]]) {
    const leg = new THREE.Group(); leg.position.set(x, 1.15, z); body.add(leg);
    mesh(cyl(0.09, 0.07, 1.05, 6), w, 0, -0.52, 0, leg);
    mesh(cyl(0.09, 0.1, 0.12, 6), hoof, 0, -1.08, 0, leg);
    legs.push(leg);
  }
  g.scale.setScalar(1.3);
  g.userData = { body, legs };
  return g;
}
export function animateHorse(h, t, moving, fast) {
  const sw = moving ? Math.sin(t * (fast ? 16 : 10)) * 0.7 : 0;
  h.userData.legs.forEach((l, i) => (l.rotation.x = (i === 0 || i === 3 ? 1 : -1) * sw));
  h.userData.body.position.y = moving ? Math.abs(Math.sin(t * (fast ? 16 : 10))) * 0.12 : 0;
}

// ---------- Облако ----------
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

// ---------- Боевой слон ----------
export function makeElephant() {
  const g = new THREE.Group();
  const skin = M(0x7d7b78), dark = M(0x5c5a57), ivory = M(0xf2ead7);
  const body = new THREE.Group(); g.add(body);
  mesh(sph(2.6, 14), skin, 0, 4.4, 0, body).scale.set(1, 0.9, 1.35);
  const head = new THREE.Group(); head.position.set(0, 5.2, 3.6); body.add(head);
  mesh(sph(1.5, 12), skin, 0, 0, 0, head).scale.set(1, 1.05, 1);
  for (const sx of [-1, 1]) { const ear = mesh(sph(1.4, 10), dark, sx * 1.5, 0.1, -0.4, head); ear.scale.set(0.2, 1.1, 0.9); }
  // хобот из сегментов
  const trunk = new THREE.Group(); trunk.position.set(0, -0.5, 1.2); head.add(trunk);
  let seg = trunk;
  for (let i = 0; i < 5; i++) {
    const s2 = new THREE.Group(); s2.position.set(0, i ? -0.65 : 0, 0); seg.add(s2);
    mesh(cyl(0.42 - i * 0.06, 0.38 - i * 0.06, 0.7, 8), skin, 0, -0.35, 0, s2);
    s2.rotation.x = 0.18; seg = s2;
  }
  for (const sx of [-1, 1]) { const t = mesh(cone(0.18, 2.2, 7), ivory, sx * 0.7, -0.9, 1.4, head); t.rotation.x = -2.1; }
  mesh(sph(0.12, 6), M(0x111111), -0.8, 0.4, 1.2, head); mesh(sph(0.12, 6), M(0x111111), 0.8, 0.4, 1.2, head);
  // боевая башенка и попона карфагенского слона
  mesh(box(3.6, 0.15, 3.2), M(0x9e2a22), 0, 6.7, -0.3, body);
  mesh(box(2.4, 1.4, 2.2), M(PAL.wood), 0, 7.5, -0.4, body);
  mesh(box(2.6, 0.2, 2.4), M(PAL.bronze, { metalness: 0.6 }), 0, 8.25, -0.4, body);
  for (const sx of [-1, 1]) mesh(box(0.1, 2.4, 3.4), M(0xc9a74a, { metalness: 0.4 }), sx * 2.4, 4.6, 0, body);
  const legs = [];
  for (const [x, z] of [[-1.3, 2], [1.3, 2], [-1.3, -2], [1.3, -2]]) {
    const leg = new THREE.Group(); leg.position.set(x, 3, z); body.add(leg);
    mesh(cyl(0.75, 0.7, 3, 10), skin, 0, -1.5, 0, leg);
    mesh(cyl(0.78, 0.78, 0.2, 10), M(0xd8d3c8), 0, -2.95, 0, leg);
    legs.push(leg);
  }
  mesh(cyl(0.08, 0.05, 1.6, 5), skin, 0, 4.4, -3.6, body).rotation.x = 0.4; // хвост
  g.userData = { body, head, trunk, legs };
  return g;
}
export function animateElephant(e, t, moving, attacking) {
  const u = e.userData;
  const sw = moving ? Math.sin(t * 4) * 0.35 : 0;
  u.legs.forEach((l, i) => (l.rotation.x = (i === 0 || i === 3 ? 1 : -1) * sw));
  u.body.position.y = moving ? Math.abs(Math.sin(t * 4)) * 0.15 : 0;
  u.head.rotation.x = attacking > 0 ? -Math.sin(attacking * Math.PI) * 0.5 : Math.sin(t * 0.8) * 0.05;
  u.trunk.rotation.x = attacking > 0 ? -Math.sin(attacking * Math.PI) * 1.4 : Math.sin(t * 1.3) * 0.2;
}

export function makeDen() {
  const g = new THREE.Group();
  const geo = G('rock', () => new THREE.DodecahedronGeometry(0.8, 0));
  for (let i = 0; i < 6; i++) { const a = i * 1.05; mesh(geo, M(0x8f7a62), Math.cos(a) * 3, 0.6, Math.sin(a) * 3, g).scale.set(2, 1.4 + (i % 2), 2); }
  for (let i = 0; i < 5; i++) mesh(box(0.1, 0.1, 0.7), M(0xeeeedd), Math.cos(i * 2) * 1.5, 0.05, Math.sin(i * 2) * 1.5, g).rotation.y = i;
  return g;
}

// ---------- Предметы на земле ----------
export function makeLootMesh(type) {
  const g = new THREE.Group();
  const def = ITEMS[type];
  const c = def ? def.color : 0xffffff;
  const k = def ? def.kind : '';
  if (type === 'pickaxe') { const h = mesh(cyl(0.04, 0.04, 0.9, 6), M(PAL.wood), 0, 0.12, 0, g); h.rotation.z = Math.PI / 2; mesh(box(0.08, 0.5, 0.08), M(0x8a8f96, { metalness: 0.7, roughness: 0.4 }), 0.42, 0.12, 0, g).rotation.x = Math.PI / 2; }
  else if (type === 'scroll') { mesh(cyl(0.12, 0.12, 0.6, 8), M(0xf5e6a8, { emissive: 0x806a20, emissiveIntensity: 0.5 }), 0, 0.2, 0, g).rotation.z = Math.PI / 2; mesh(box(0.08, 0.28, 0.28), M(0xb3282d), 0, 0.2, 0, g); }
  else if (type === 'stolen') { mesh(sph(0.35, 8), M(0x8a6d3b), 0, 0.32, 0, g).scale.set(1, 0.9, 1); mesh(cyl(0.08, 0.12, 0.2, 6), M(0x5e4a28), 0, 0.68, 0, g); mesh(box(0.2, 0.2, 0.02), M(0xc0392b), 0, 0.35, 0.33, g); }
  else if (type === 'biggull') { const gl = makeGull(1.2); gl.rotation.z = Math.PI / 2; gl.position.y = 0.3; gl.traverse((c) => { if (c.isMesh) c.material = M(0xffd700, { emissive: 0xffaa00, emissiveIntensity: 0.8, metalness: 0.5 }); }); g.add(gl); }
  else if (type === 'hide') { mesh(box(0.9, 0.05, 0.6), M(c), 0, 0.05, 0, g); mesh(box(0.3, 0.05, 0.25), M(c), 0.5, 0.05, 0.2, g); }
  else if (type === 'gull') { const gl = makeGull(1); gl.rotation.z = Math.PI / 2; gl.position.y = 0.25; g.add(gl); }
  else if (type === 'root') { const rm = M(0x9a6a3a); for (let i = 0; i < 3; i++) { const r = mesh(cone(0.07, 0.45, 5), rm, (i - 1) * 0.12, 0.18, (i % 2) * 0.08, g); r.rotation.z = Math.PI / 2 + (i - 1) * 0.5; } mesh(sph(0.1, 6), M(0x6f8f3a), 0, 0.3, 0, g).scale.set(1.4, 0.6, 1.4); }
  else if (type === 'pfish') { mesh(sph(0.2, 8), M(0x5ad16b, { emissive: 0x1a6a2a, emissiveIntensity: 0.6 }), 0, 0.2, 0, g).scale.set(1.8, 0.7, 0.6); mesh(cone(0.14, 0.22, 4), M(0x3a9a4a), -0.42, 0.2, 0, g).rotation.z = Math.PI / 2; }
  else if (type === 'rod') { const r = mesh(cyl(0.025, 0.04, 1.8, 5), M(0xa0784a), 0, 0.08, 0, g); r.rotation.z = Math.PI / 2; mesh(cyl(0.08, 0.08, 0.08, 8), M(0x555555), -0.6, 0.12, 0.08, g).rotation.x = Math.PI / 2; }
  else if (type === 'fishnet') { mesh(cyl(0.35, 0.4, 0.25, 10), M(0xd8c8a0), 0, 0.14, 0, g); for (let i = 0; i < 3; i++) mesh(sph(0.08, 6), M(0xe8742a), Math.cos(i * 2.1) * 0.35, 0.3, Math.sin(i * 2.1) * 0.35, g); }
  else if (type === 'firefly') { mesh(sph(0.12, 8), M(0xd9ff5a, { emissive: 0xd9ff5a, emissiveIntensity: 3 }), 0, 0.5, 0, g); const l = new VLight(0xd9ff5a, 1.5, 5); l.position.y = 0.6; g.add(l); }
  else if (type === 'sack') { mesh(sph(0.35, 8), M(0x6b5a44), 0, 0.3, 0, g).scale.set(1, 0.8, 0.9); mesh(cyl(0.05, 0.1, 0.18, 6), M(0x3a2a1a), 0, 0.62, 0, g); }
  else if (type === 'antidote') { mesh(sph(0.16, 8), M(0x8fe3a0, { emissive: 0x2a8a3a, emissiveIntensity: 0.6 }), 0, 0.22, 0, g); mesh(cyl(0.05, 0.05, 0.16, 6), M(0xd8c8a0), 0, 0.42, 0, g); }
  else if (k === 'token') mesh(G('oct', () => new THREE.OctahedronGeometry(0.22, 0)), M(c, { emissive: c, emissiveIntensity: 0.6 }), 0, 0.35, 0, g);
  else if (k === 'weapon') mesh(box(0.15, 0.9, 0.08), def.glow ? M(c, { emissive: c, emissiveIntensity: 2 }) : M(c, { metalness: 0.5, roughness: 0.4 }), 0, 0.6, 0, g).rotation.z = 0.6;
  else if (k === 'buff') { mesh(sph(0.2, 8), M(c, { emissive: c, emissiveIntensity: 0.8 }), 0, 0.3, 0, g); mesh(cyl(0.06, 0.06, 0.2, 6), M(0xddd4bb), 0, 0.55, 0, g); }
  else if (k === 'heal') { mesh(cyl(0.15, 0.2, 0.4, 10), M(c), 0, 0.3, 0, g); mesh(box(0.25, 0.08, 0.05), M(0xc0392b), 0, 0.35, 0.18, g); mesh(box(0.08, 0.25, 0.05), M(0xc0392b), 0, 0.35, 0.18, g); mesh(cyl(0.1, 0.12, 0.08, 10), M(0x8a6a48), 0, 0.54, 0, g); }
  else if (k === 'coins') {
    // кошель и горка монет рядом
    const gold = M(0xe8c24a, { metalness: 0.75, roughness: 0.3 });
    mesh(sph(0.22, 8), M(0x7a5230), -0.1, 0.22, 0, g).scale.set(1, 0.9, 1);
    mesh(cyl(0.07, 0.11, 0.12, 8), M(0x5e3b1f), -0.1, 0.44, 0, g);
    for (let i = 0; i < 7; i++) { const cn = mesh(cyl(0.07, 0.07, 0.02, 10), gold, 0.2 + (i % 3) * 0.05, 0.02 + Math.floor(i / 3) * 0.022, (i % 2) * 0.05, g); cn.rotation.z = (i % 2) * 0.15; }
  }
  else if (k === 'ingredient') mesh(G('ico', () => new THREE.IcosahedronGeometry(0.22, 0)), M(c, { emissive: c, emissiveIntensity: 0.3 }), 0, 0.3, 0, g);
  else if (type === 'map') { mesh(cyl(0.08, 0.08, 0.6, 8), M(c), 0, 0.2, 0, g).rotation.z = Math.PI / 2; for (const x of [-0.32, 0.32]) mesh(cyl(0.03, 0.03, 0.22, 6), M(PAL.woodDark), x, 0.2, 0, g).rotation.x = Math.PI / 2; mesh(cyl(0.085, 0.085, 0.05, 8), M(0xb3282d), 0, 0.2, 0, g).rotation.z = Math.PI / 2; }
  else if (type === 'tools') { mesh(box(0.5, 0.22, 0.3), M(0x6b4a2a), 0, 0.12, 0, g); mesh(box(0.52, 0.04, 0.32), M(c), 0, 0.25, 0, g); mesh(box(0.06, 0.04, 0.36), M(PAL.bronze, { metalness: 0.6 }), 0, 0.12, 0, g); const hm = mesh(cyl(0.025, 0.025, 0.45, 5), M(PAL.wood), 0.05, 0.32, 0, g); hm.rotation.z = 1.2; mesh(box(0.08, 0.1, 0.06), M(0x888888, { metalness: 0.6 }), 0.24, 0.4, 0, g); }
  else if (type === 'kit') { mesh(box(0.42, 0.3, 0.26), M(0x8a6a48), 0, 0.15, 0, g); mesh(box(0.44, 0.06, 0.28), M(0x6b4423), 0, 0.31, 0, g); const sh = mesh(cyl(0.025, 0.025, 0.7, 5), M(PAL.wood), 0.1, 0.35, 0, g); sh.rotation.z = 0.9; mesh(box(0.16, 0.2, 0.03), M(0x8a8f96, { metalness: 0.6 }), 0.38, 0.58, 0, g); mesh(G('kitRing', () => new THREE.TorusGeometry(0.1, 0.015, 5, 12)), M(PAL.bronze, { metalness: 0.7 }), -0.12, 0.34, 0.13, g); }
  else mesh(box(0.4, 0.3, 0.3), M(c, { emissive: c, emissiveIntensity: 0.4 }), 0, 0.3, 0, g);
  if (def && def.glow) { const l = new VLight(c, 2.5, 6); l.position.y = 0.8; g.add(l); }
  // свечение
  const ring = new THREE.Mesh(G('ring', () => new THREE.RingGeometry(0.5, 0.65, 16)), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  g.userData.ring = ring;
  return g;
}
// Колизей: овальная арена с аркадой; руины — обломанные стены, восстановленный — два яруса арок, знамёна и жаровни
export function makeColosseum(restored = false) {
  const g = new THREE.Group();
  const st = M(0xd9c9a3), stD = M(0xb8a37a), sand = M(0xe8cf98), red = M(PAL.red);
  mesh(cyl(12.6, 12.8, 0.14, 40), sand, 0, 0.07, 0, g);                // песок арены
  const N = 28;
  const brk = [0, 0.6, 0.2, 0.9, 0, 0.4, 0.8, 0.1, 0.7, 0, 0.5, 0.3, 0.95, 0.2, 0, 0.6, 0.85, 0.1, 0.45, 0, 0.7, 0.3, 0.9, 0, 0.5, 0.2, 0.75, 0.1];
  for (let i = 0; i < N; i++) {
    if (i % 7 === 0) continue;                                          // четыре ворот
    const a = (i / N) * Math.PI * 2, R = 14.2;
    const seg = new THREE.Group(); seg.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); seg.rotation.y = -a + Math.PI / 2; g.add(seg);
    const b = restored ? 0 : brk[i];
    if (b > 0.9) { mesh(box(2.2, 0.8, 1.4), stD, 0, 0.4, 0, seg).rotation.y = 0.3; continue; }
    const H = 5.2 * (1 - b * 0.7);
    mesh(box(0.7, H, 1.5), st, -1.25, H / 2, 0, seg);                  // опоры арки
    if (H > 3.6) { mesh(box(3.2, 0.7, 1.5), st, 0, H - 0.35, 0, seg); mesh(box(1.8, 0.35, 1.5), stD, 0, H - 0.9, 0, seg); }
    if (restored) {
      mesh(box(0.55, 3.2, 1.3), st, -1.25, 5.2 + 1.6, 0, seg);         // второй ярус
      mesh(box(3.2, 0.55, 1.3), st, 0, 8.4, 0, seg);
      if (i % 2) mesh(box(0.05, 1.6, 0.9), red, 0, 7.4, -0.68, seg);   // знамёна
    }
  }
  // ворота с колоннами
  for (let k = 0; k < 4; k++) {
    const a = (k * 7 / N) * Math.PI * 2, R = 14.2;
    for (const off of [-0.11, 0.11]) column(g, Math.cos(a + off) * R, Math.sin(a + off) * R, restored ? 6 : 4, 0.38, M(PAL.marble), restored ? 0 : 0.3 * (k % 2));
  }
  // ложа лидера и жаровни
  const lg = new THREE.Group(); lg.position.set(0, 0, -15.6); g.add(lg);
  mesh(box(4.5, restored ? 2.2 : 1, 2), stD, 0, restored ? 1.1 : 0.5, 0, lg);
  if (restored) {
    mesh(box(4.6, 0.12, 2.2), red, 0, 2.26, 0, lg);
    for (let k = 0; k < 4; k++) {
      const a = ((k * 7 + 3.5) / N) * Math.PI * 2;
      const bz = new THREE.Group(); bz.position.set(Math.cos(a) * 11.6, 0, Math.sin(a) * 11.6); g.add(bz);
      mesh(cyl(0.12, 0.2, 1.4, 6), M(0x3a3a3a, { metalness: 0.5 }), 0, 0.7, 0, bz);
      mesh(cyl(0.45, 0.25, 0.35, 8), M(0x3a3a3a, { metalness: 0.5 }), 0, 1.5, 0, bz);
      mesh(cone(0.3, 0.7, 6), M(0xff9a2a, { emissive: 0xff6a00, emissiveIntensity: 2.5 }), 0, 1.95, 0, bz).castShadow = false;
      const l = new VLight(0xff8a3a, 4, 16); l.position.y = 2.4; bz.add(l);
    }
  } else {
    for (let i = 0; i < 7; i++) mesh(box(1.4, 0.6, 1.0), stD, Math.cos(i * 1.7) * 9, 0.3, Math.sin(i * 1.7) * 9, g).rotation.y = i;
  }
  return g;
}
// амбар: каменный низ, деревянный верх на сваях, мешки и корзины
export function makeBarn() {
  const g = new THREE.Group();
  const st = M(PAL.stoneDark), wood = M(PAL.wood), woodD = M(PAL.woodDark);
  mesh(box(7, 0.4, 6), st, 0, 0.2, 0, g);
  for (const [x, z] of [[-2.8, -2.2], [2.8, -2.2], [-2.8, 2.2], [2.8, 2.2]]) mesh(cyl(0.22, 0.26, 1.2, 8), st, x, 0.9, z, g);
  mesh(box(6.4, 0.25, 5.2), woodD, 0, 1.6, 0, g);
  mesh(box(6, 2.6, 4.8), wood, 0, 3.0, 0, g);
  for (let i = -2; i <= 2; i++) mesh(box(0.12, 2.6, 4.9), woodD, i * 1.4, 3.0, 0, g);
  gableRoof(g, 6, 4.8, 4.3, 2.0, M(0xc9a35a));                         // соломенная крыша
  mesh(box(1.4, 1.8, 0.15), woodD, 0, 2.6, 2.48, g);
  mesh(box(1.6, 0.15, 2.6), wood, 0, 0.95, 3.9, g).rotation.x = 0.55; // сходни
  for (let i = 0; i < 4; i++) mesh(sph(0.4, 7), M(0xd8c39a), -2.6 + i * 0.6, 0.6, 3.3 + (i % 2) * 0.3, g).scale.set(1, 1.2, 1); // мешки зерна
  for (let i = 0; i < 2; i++) { mesh(cyl(0.45, 0.35, 0.5, 10), M(0xb08a4a), 2.3 + i * 0.9, 0.65, 3.2, g); mesh(sph(0.16, 6), M(0x8fb0c8), 2.3 + i * 0.9, 0.95, 3.2, g).scale.set(1.6, 0.6, 0.6); } // рыба в корзинах
  for (let i = 0; i < 3; i++) mesh(sph(0.22, 6), M(0xa86a9a), -0.9 + i * 0.4, 0.55, 4.4, g); // брюква
  return g;
}
// рыболовная сеть на воде: поплавки по кругу и колья
export function makeNetMesh() {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; mesh(sph(0.16, 6), M(i % 2 ? 0xe8742a : 0xf2efe6), Math.cos(a) * 1.6, 0.08, Math.sin(a) * 1.6, g); }
  for (const a of [0, Math.PI]) mesh(cyl(0.05, 0.06, 2.2, 5), M(PAL.woodDark), Math.cos(a) * 1.8, 0.3, Math.sin(a) * 1.8, g);
  const net = new THREE.Mesh(G('netring', () => new THREE.RingGeometry(0.2, 1.6, 16, 2)), new THREE.MeshStandardMaterial({ color: 0xd8c8a0, wireframe: true, transparent: true, opacity: 0.6 }));
  net.rotation.x = -Math.PI / 2; net.position.y = 0.04; g.add(net);
  return g;
}
// блюдо для лидера: глиняная тарелка с рыбой, кореньями и брюквой
export function makeDish() {
  const g = new THREE.Group();
  // столик
  mesh(cyl(0.5, 0.5, 0.08, 12), M(PAL.wood), 0, 0.82, 0, g);
  mesh(cyl(0.06, 0.08, 0.8, 6), M(PAL.woodDark), 0, 0.4, 0, g);
  const p = new THREE.Group(); p.position.y = 0.86; g.add(p);
  mesh(cyl(0.38, 0.28, 0.08, 12), M(0xb0663a), 0, 0.04, 0, p);
  mesh(sph(0.12, 8), M(0x8fb0c8), 0, 0.14, 0, p).scale.set(1.8, 0.6, 0.8);
  mesh(sph(0.08, 6), M(0xa86a9a), 0.18, 0.12, 0.12, p);
  mesh(cone(0.04, 0.2, 5), M(0x9a6a3a), -0.15, 0.12, -0.1, p).rotation.z = 1.4;
  return g;
}
// красная улика нарушения закона: видна всем, живёт минуту
export function makeRedClueMesh() {
  const g = new THREE.Group();
  mesh(box(0.3, 0.04, 0.2), M(0xf0d8d8, { emissive: 0x8a2020, emissiveIntensity: 0.6 }), 0, 0.08, 0, g);
  const beam = new THREE.Mesh(cyl(0.22, 0.22, 60, 6, true), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.28, depthWrite: false }));
  beam.position.y = 30; beam.renderOrder = 5; g.add(beam);
  return g;
}
export function makeClueMesh() {
  const g = new THREE.Group();
  mesh(box(0.3, 0.04, 0.2), M(0xd8e6f0, { emissive: 0x3a6a8a, emissiveIntensity: 0.4 }), 0, 0.08, 0, g);
  // неяркий синий столб — заметен, только если смотреть внимательно
  const beam = new THREE.Mesh(cyl(0.18, 0.18, 60, 6, true), new THREE.MeshBasicMaterial({ color: 0x4f9dff, transparent: true, opacity: 0.18, depthWrite: false }));
  beam.position.y = 30; beam.renderOrder = 5; g.add(beam);
  return g;
}
// капкан: стальные зубья на кольце
export function makeTrapMesh() {
  const g = new THREE.Group();
  const steel = M(0x8a8f96, { metalness: 0.8, roughness: 0.35 });
  const ring = new THREE.Mesh(G('trapring', () => new THREE.TorusGeometry(0.55, 0.05, 6, 18)), steel); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const t = mesh(cone(0.05, 0.22, 4), steel, Math.cos(a) * 0.5, 0.15, Math.sin(a) * 0.5, g); t.rotation.z = Math.cos(a) * 0.5; t.rotation.x = -Math.sin(a) * 0.5; }
  mesh(box(0.3, 0.03, 0.3), M(0x5a4a3a), 0, 0.03, 0, g);
  mesh(cyl(0.015, 0.015, 0.8, 4), M(0x555555), 0.6, 0.04, 0, g).rotation.z = Math.PI / 2; // цепь
  return g;
}

// ---------- Надписи ----------
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
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, fog: false }));
  sp.layers.set(LABEL_LAYER);
  sp.scale.set(w / 52 * 0.45, 0.45, 1);
  sp.renderOrder = 10;
  return sp;
}
