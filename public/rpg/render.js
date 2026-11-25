// Рендер: three.js, постобработка, небо, свет, земля архипелага, вода, склейка статики
import * as THREE from 'three';
import {updateVisibleMatrices} from './transforms.js';
export {updateVisibleMatrices} from './transforms.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as WG from './world.js';
import * as MD from './models.js';

export const $ = (id) => document.getElementById(id);
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
export const LABEL_LAYER = MD.LABEL_LAYER;
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.15, 3800);

export const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.5, thickness: 1.4, scale: 1.1 });
gtao.blendIntensity = 0.75;
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.5, 0.93);
composer.addPass(bloom);
composer.addPass(new OutputPass());
export const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uWarm: { value: 0.5 }, uSat: { value: 1.06 }, uVig: { value: 0.7 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uWarm; uniform float uSat; uniform float uVig; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.05, 1.0, 0.9), uWarm);
      c.rgb = (c.rgb - 0.5) * 1.05 + 0.5;
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= mix(1.0, uVig, smoothstep(0.4, 0.88, d));
      gl_FragColor = c;
    }`,
});
composer.addPass(grade);

export const hemi = new THREE.HemisphereLight(0xdfeeff, 0x9a8a62, 0.55);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 400 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035; sun.shadow.radius = 2.5;
scene.add(sun, sun.target);
scene.fog = new THREE.Fog(0xcfe0ea, 220, 1500);

export const GFX = { mode: 'auto', level: 2, names: ['экономная', 'средняя', 'высокая'] };
export const terrainDetail = { value: 1 };
export function applyGfx(level) {
  GFX.level = level; renderer.shadowMap.enabled=level>0;
  const pr = level === 2 ? Math.min(1.5, devicePixelRatio) : level === 1 ? Math.min(1, devicePixelRatio) : Math.min(0.8, devicePixelRatio);
  renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  gtao.enabled = level >= 2; bloom.enabled = level >= 1;
  terrainDetail.value = level >= 1 ? 1 : 0;
  const sm = level === 0 ? 1024 : 2048;
  if (sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
}
try {
  const v = localStorage.getItem('imperiumGfx') || 'auto';
  GFX.mode = v === 'auto' ? 'auto' : Math.max(0, Math.min(2, Number(v) || 0));
  GFX.level = GFX.mode === 'auto' ? Math.max(0, Math.min(2, Number(localStorage.getItem('imperiumGfxAuto') ?? 2))) : GFX.mode;
} catch {}
applyGfx(GFX.level);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});
const fpsMon = { t0: 0, n: 0, last: 0, good: 0, peak: 0 };
export function autoGfx(onChange) {
  const now = performance.now();
  if (!fpsMon.t0) { fpsMon.t0 = now; return; }
  fpsMon.n++;
  if (now - fpsMon.t0 < 3000) return;
  const fps = fpsMon.n * 1000 / (now - fpsMon.t0); fpsMon.t0 = now; fpsMon.n = 0;
  fpsMon.peak = Math.max(fps, fpsMon.peak * 0.995);
  const target = Math.min(80, fpsMon.peak * 0.9);
  const tag = $('fpsTag'); if (tag) { tag.textContent = `${Math.round(fps)} к/с · ${GFX.names[GFX.level]}`; tag.className = fps < target ? 'low' : ''; }
  if (GFX.mode !== 'auto' || document.hidden || now - fpsMon.last < 6000) return;
  if (fps < target && GFX.level > 0) { fpsMon.last = now; applyGfx(GFX.level - 1); try { localStorage.setItem('imperiumGfxAuto', String(GFX.level)); } catch {} onChange && onChange(GFX.level); }
  else if (fps > Math.max(target * 1.15, fpsMon.peak * 0.97) && GFX.level < 2) { if (++fpsMon.good >= 10) { fpsMon.good = 0; fpsMon.last = now; applyGfx(GFX.level + 1); try { localStorage.setItem('imperiumGfxAuto', String(GFX.level)); } catch {} } }
  else fpsMon.good = 0;
}

// ---------- Небо ----------
export const skyUni = {
  top: { value: new THREE.Color(0x3d8fd6) }, bottom: { value: new THREE.Color(0xdbe9f0) },
  sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4) }, sunCol: { value: new THREE.Color(0xfff2c8) },
  moonDir: { value: new THREE.Vector3(-0.3, 0.6, -0.4) }, stars: { value: 0 }, uT: { value: 0 }, cloud: { value: 0.35 },
};
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyUni, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 moonDir; uniform float stars; uniform float uT; uniform float cloud; varying vec3 vp;
    float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y); }
    void main(){
      vec3 d = normalize(vp);
      float h = clamp(vp.y*1.4+0.05,0.0,1.0);
      vec3 col = mix(bottom, top, pow(h, 0.75));
      float s = max(dot(d, normalize(sunDir)), 0.0);
      col += sunCol * (pow(s, 1100.0) * 3.0 + pow(s, 14.0) * 0.22 + pow(s, 3.0) * 0.06);
      // перистые облака
      if (d.y > 0.0) {
        vec2 cp = d.xz / (d.y + 0.12) * 1.6 + vec2(uT * 0.004, uT * 0.002);
        float c = n2(cp) * 0.55 + n2(cp * 2.3) * 0.3 + n2(cp * 5.1) * 0.15;
        c = smoothstep(0.55 - cloud * 0.25, 0.95, c) * smoothstep(0.0, 0.25, d.y);
        vec3 cc = mix(vec3(1.0), sunCol, 0.25) * (0.75 + 0.35 * s) * (1.0 - stars * 0.85);
        col = mix(col, cc, c * 0.75);
      }
      if (stars > 0.01) {
        vec3 g = floor(d * 420.0);
        float hs = fract(sin(dot(g, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
        float dd = length(fract(d * 420.0) - 0.5);
        float st = step(0.993, hs) * smoothstep(0.45, 0.05, dd) * smoothstep(0.0, 0.3, d.y);
        col += vec3(0.9, 0.95, 1.0) * st * (0.65 + 0.35 * sin(uT * 2.5 + hs * 300.0)) * stars * (0.6 + 1.4 * fract(hs * 97.0));
        float band = exp(-pow(dot(d, normalize(vec3(0.4, 0.3, 1.0))) * 4.0, 2.0)) * smoothstep(0.0, 0.4, d.y);
        col += vec3(0.25, 0.27, 0.38) * band * stars * 0.35;
        float m = max(dot(d, normalize(moonDir)), 0.0);
        col += vec3(0.92, 0.95, 1.0) * (smoothstep(0.99965, 0.9998, m) * 1.6 + pow(m, 60.0) * 0.18 + pow(m, 8.0) * 0.05) * stars;
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
});
export const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMat);
sky.renderOrder = -10;
scene.add(sky);
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat));
const envCache = new Map();
export function updateEnv() {
  const q = (c) => [c.r, c.g, c.b].map((v) => Math.round(v * 10)).join(',');
  const key = q(skyUni.top.value) + '|' + q(skyUni.bottom.value) + '|' + q(skyUni.sunCol.value);
  let rt = envCache.get(key);
  if (!rt) { if (envCache.size >= 24) { const [k0, r0] = envCache.entries().next().value; r0.dispose(); envCache.delete(k0); } rt = pmrem.fromScene(envScene, 0.02); envCache.set(key, rt); }
  scene.environment = rt.texture; scene.environmentIntensity = 0.4;
}
updateEnv();

// ---------- Процедурные карты нормалей ----------
function makeNormalTex(size, heightFn, strength) {
  const data = new Uint8Array(size * size * 4), hgt = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) hgt[y * size + x] = heightFn(x / size, y / size);
  const v = new THREE.Vector3();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hl = hgt[y * size + ((x - 1 + size) % size)], hr = hgt[y * size + ((x + 1) % size)], hd = hgt[((y - 1 + size) % size) * size + x], hu = hgt[((y + 1) % size) * size + x];
    v.set((hl - hr) * strength, (hd - hu) * strength, 1).normalize();
    const o = (y * size + x) * 4; data[o] = (v.x * 0.5 + 0.5) * 255; data[o + 1] = (v.y * 0.5 + 0.5) * 255; data[o + 2] = (v.z * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}
const TAU = Math.PI * 2;
const tileNoise = (u, v, f) => { const x = u * f, y = v * f; return (WG.vnoise(x, y) * (1 - u) * (1 - v) + WG.vnoise(x - f, y) * u * (1 - v) + WG.vnoise(x, y - f) * (1 - u) * v + WG.vnoise(x - f, y - f) * u * v); };
const groundNormal = makeNormalTex(256, (u, v) => tileNoise(u, v, 8) * 0.7 + tileNoise(u, v, 32) * 0.5 + tileNoise(u, v, 64) * 0.25, 2.6);
const waterNormal = makeNormalTex(256, (u, v) => Math.sin((u + v) * TAU * 3) * 0.3 + Math.sin((u * 2 - v) * TAU * 2) * 0.3 + tileNoise(u, v, 8) + tileNoise(u, v, 16) * 0.5, 2.5);
groundNormal.repeat.set(1, 1);

// ---------- Земля ----------
// Куски 64×64 м строятся только там, где есть суша или мелководье. У каждого куска три уровня
// детализации (шаг 8 м, 2 м и 1 м — ближний строится лениво, когда камера рядом).
export const waterTime = { value: 0 };
export const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, normalMap: groundNormal, normalScale: new THREE.Vector2(0.55, 0.55), envMapIntensity: 0.35 });
terrainMat.onBeforeCompile = (sh) => {
  sh.uniforms.uDetail = terrainDetail;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW; varying float vRockSlope;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz; vRockSlope = 1.0 - abs(normal.y);')
    .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_NORMALMAP\nvNormalMapUv = (modelMatrix * vec4(position,1.0)).xz * 0.18;\n#endif');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vTW; varying float vRockSlope; uniform float uDetail;
float thash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(thash(i), thash(i + vec2(1.0, 0.0)), f.x), mix(thash(i + vec2(0.0, 1.0)), thash(i + vec2(1.0, 1.0)), f.x), f.y); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float camD = length(vTW - cameraPosition);
        float big = vn(vTW.xz * 0.035) * 0.6 + vn(vTW.xz * 0.11) * 0.4;
        float fine = vn(vTW.xz * 1.9) * 0.55 + vn(vTW.xz * 5.3) * 0.45;
        float near = (1.0 - smoothstep(6.0, 80.0, camD)) * uDetail;
        vec3 base = diffuseColor.rgb;
        float green = smoothstep(0.02, 0.12, base.g - base.r * 0.85);
        diffuseColor.rgb *= 0.9 + 0.2 * big;
        diffuseColor.rgb *= mix(1.0, 0.86 + 0.28 * fine, near);
        // травинки: тёмные и светлые крапинки на зелёном
        float blade = vn(vTW.xz * 11.0 + vec2(vn(vTW.xz * 2.0) * 3.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.78 + 0.45 * blade), green * near * 0.8);
        // слои камня
        float lum = dot(base, vec3(0.299, 0.587, 0.114));
        float rocky = max(vRockSlope, (1.0 - green) * (1.0 - smoothstep(0.3, 0.38, lum))) * step(0.5, vTW.y);
        diffuseColor.rgb *= mix(1.0, 0.86 + 0.24 * (0.5 + 0.5 * sin(vTW.y * 2.2 + vn(vTW.xz * 0.2) * 3.0)), rocky * uDetail);
        diffuseColor.rgb *= mix(1.0, 0.8, (1.0 - smoothstep(0.05, 0.55, vTW.y)) * step(-0.7, vTW.y));
      }`);
};
export const chunks = [];
const CH = 64;
const C = new THREE.Color();
const COL = {
  wet: new THREE.Color(0xa58a5e), sand: new THREE.Color(0xe8d2a0), sandD: new THREE.Color(0xd6b47a), seabed: new THREE.Color(0xb59a6c),
  grass: new THREE.Color(0x6f8c3c), grassD: new THREE.Color(0x8d9a48), grassF: new THREE.Color(0x4f7030), dry: new THREE.Color(0xb3a061),
  rock: new THREE.Color(0x8c8172), rockD: new THREE.Color(0x63594f), rockW: new THREE.Color(0xd8d2c6), rust: new THREE.Color(0x8a5a3e),
  ash: new THREE.Color(0x4e4742), sulf: new THREE.Color(0xa8803a),
  desert: new THREE.Color(0xe4c58c), desertD: new THREE.Color(0xcfa766), dirt: new THREE.Color(0x9a7a52), city: new THREE.Color(0x8d9150),
};
const _cc = new THREE.Color();
function colorAt(x, z, h, slope, isl) {
  const b = isl ? isl.biome : 'sea';
  if (h < -0.6) C.copy(COL.seabed).lerp(COL.wet, Math.max(0, 1 + h / 3) * 0.4);
  else if (h < 0.4) C.copy(COL.wet);
  else if (h < 1.6 || b === 'desert') C.copy(COL.sand).lerp(COL.sandD, WG.vnoise(x * 0.08, z * 0.08) * 0.6);
  else {
    const n = WG.vnoise(x * 0.04, z * 0.04), n2 = WG.vnoise(x * 0.17 + 5, z * 0.17);
    if (b === 'med' || b === 'forest' || b === 'beach') C.copy(b === 'forest' ? COL.grassF : COL.grass).lerp(COL.grassD, n * 0.8).lerp(COL.dry, Math.max(0, n2 - 0.45) * (b === 'beach' ? 1.4 : 0.9));
    else if (b === 'rock') C.copy(COL.dry).lerp(COL.rock, 0.35 + n * 0.4);
    else C.copy(COL.desert);
    const t = Math.min(1, (h - 1.6) / 1.2); C.lerp(COL.sand, 1 - t); // пляж → трава
  }
  if (b === 'desert' && h > 0.4) C.copy(COL.desert).lerp(COL.desertD, WG.vnoise(x * 0.05, z * 0.05) * 0.7);
  if (h > 18) C.lerp(b === 'desert' ? COL.desertD : COL.rock, Math.min(1, (h - 18) / 10));
  if (h > 34) C.lerp(COL.rockD, Math.min(1, (h - 34) / 14) * 0.7);
  if (h > 0.5 && slope > 0.6) C.lerp(isl && isl.id === 'marmor' ? COL.rockW : isl && isl.id === 'ferrum' ? COL.rust : COL.rockD, Math.min(0.8, (slope - 0.6) * 1.1));
  if (slope > 1.0 && h < 35 && h > 1.2 && WG.coastalLift(x, z, h) > 0.1) C.lerp(COL.rockW, 0.35 + 0.18 * Math.sin(h * 1.4));
  if (isl && isl.id === 'marmor' && h > 6) C.lerp(COL.rockW, 0.35);
  // вулкан: тёмный пепел и базальт, у кратера — рыжие натёки серы
  if (isl && isl.poly) { const V = WG.VOLCANO, dv = Math.hypot(x - V.x, z - V.z); if (dv < V.r) { const k = 1 - WG.smoothstep(V.r * 0.35, V.r * 0.9, dv); C.lerp(COL.ash, k * (0.75 + 0.25 * WG.vnoise(x * 0.06, z * 0.06))); if (dv < V.cr * 1.25) C.lerp(COL.sulf, 0.35 * WG.vnoise(x * 0.2, z * 0.2)); } }
  // города — утоптанная земля с пыльными пятнами; молы и набережные — тёсаный камень
  if (isl && isl.poly) {
    const c = WG.cityAt(x, z, 25);
    if (c && h > 1.2) { const dc = Math.hypot(x - c.x, z - c.z), k = 1 - WG.smoothstep(c.R * 0.95, c.R + 30, dc); _cc.copy(COL.grassD).lerp(COL.dirt, 0.35 + WG.vnoise(x * 0.04, z * 0.04) * 0.5); C.lerp(_cc, k * WG.smoothstep(1.2, 1.8, h)); }
    if (h > 1.0 && h < 1.75 && WG.onMole(x, z)) C.copy(COL.rockW).lerp(COL.rock, WG.vnoise(x * 0.3, z * 0.3) * 0.5);
  }
  return C;
}
function chunkGeo(cx0, cz0, step) {
  const n = Math.round(CH / step) + 1, ext = n + 2; // +1 по краям для нормалей
  const H = new Float32Array(ext * ext);
  for (let j = 0; j < ext; j++) for (let i = 0; i < ext; i++) H[j * ext + i] = WG.terrainHeight(cx0 + (i - 1) * step, cz0 + (j - 1) * step);
  const isl = WG.islandAt(cx0 + CH / 2, cz0 + CH / 2);
  const verts = n * n + 4 * n;
  const P = new Float32Array(verts * 3), N = new Float32Array(verts * 3), Cc = new Float32Array(verts * 3);
  const idx = [];
  const put = (v, i, j, dy) => {
    const x = cx0 + i * step, z = cz0 + j * step, h = H[(j + 1) * ext + i + 1];
    P[v * 3] = x - cx0 - CH / 2; P[v * 3 + 1] = h - dy; P[v * 3 + 2] = z - cz0 - CH / 2;
    const hl = H[(j + 1) * ext + i], hr = H[(j + 1) * ext + i + 2], hd = H[j * ext + i + 1], hu = H[(j + 2) * ext + i + 1];
    const nx = hl - hr, nz = hd - hu, ny = 2 * step, l = Math.hypot(nx, ny, nz);
    N[v * 3] = nx / l; N[v * 3 + 1] = ny / l; N[v * 3 + 2] = nz / l;
    const slope = Math.hypot(nx, nz) / (2 * step);
    const c = colorAt(x, z, h, slope, isl);
    Cc[v * 3] = c.r; Cc[v * 3 + 1] = c.g; Cc[v * 3 + 2] = c.b;
  };
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) put(b * n + a, a, b, 0);
  for (let b = 0; b < n - 1; b++) for (let a = 0; a < n - 1; a++) { const v = b * n + a; idx.push(v, v + n, v + 1, v + 1, v + n, v + n + 1); }
  const edges = [[(t) => t, () => 0], [(t) => t, () => n - 1], [() => 0, (t) => t], [() => n - 1, (t) => t]];
  let v0 = n * n;
  edges.forEach(([fa, fb]) => {
    for (let t = 0; t < n; t++) put(v0 + t, fa(t), fb(t), 2.5);
    for (let t = 0; t < n - 1; t++) { const a1 = fb(t) * n + fa(t), a2 = fb(t + 1) * n + fa(t + 1), s1 = v0 + t, s2 = v0 + t + 1; idx.push(a1, s1, a2, a2, s1, s2, a1, a2, s1, a2, s2, s1); }
    v0 += n;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(verts * 2), 2));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}
function mkChunkMesh(geo) { const m = new THREE.Mesh(geo, terrainMat); m.receiveShadow = true; m.matrixAutoUpdate = false; return m; }
// список кусков (только у островов)
export function planTerrain() {
  for (const isl of WG.ISLANDS_LIST) {
    const R = isl.r * 1.45;
    for (let cz = Math.floor((isl.z - R) / CH) * CH; cz < isl.z + R; cz += CH) for (let cx = Math.floor((isl.x - R) / CH) * CH; cx < isl.x + R; cx += CH) {
      if (chunks.some((c) => c.x0 === cx && c.z0 === cz)) continue;
      let mx = -99; for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) mx = Math.max(mx, WG.terrainHeight(cx + i * 16, cz + j * 16));
      if (mx < -9) continue;
      chunks.push({ x0: cx, z0: cz, x: cx + CH / 2, z: cz + CH / 2, max: mx, lv: [null, null, null, null], cur: -1, group: new THREE.Group() });
    }
  }
  for (const c of chunks) { c.group.position.set(c.x, 0, c.z); c.group.updateMatrix(); c.group.matrixAutoUpdate = false; scene.add(c.group); }
  return chunks.length;
}
// первичная постройка: дальний и средний уровни (по частям, чтобы не замирать)
export async function buildTerrain(onProgress) {
  let k = 0;
  for (const c of chunks) {
    c.lv[3] = mkChunkMesh(chunkGeo(c.x0, c.z0, 8));
    c.lv[3].visible = false;
    c.group.add(c.lv[3]);
    if (++k % 12 === 0) { onProgress && onProgress(k / chunks.length); await new Promise((r) => setTimeout(r, 0)); }
  }
  // дальние куски склеены в блоки 256 м: вместо 16 вызовов отрисовки — один
  for (const c of chunks) { const key = Math.floor(c.x0 / 256) + ',' + Math.floor(c.z0 / 256); let B = BLOCKS.get(key); if (!B) BLOCKS.set(key, B = { chunks: [], mesh: null }); B.chunks.push(c); c.block = B; }
  for (const B of BLOCKS.values()) {
    if (B.chunks.length < 2) { B.chunks.forEach((c) => { c.block = null; }); continue; }
    const geos = B.chunks.map((c) => c.lv[3].geometry.clone().translate(c.x, 0, c.z));
    const m = mkChunkMesh(mergeGeometries(geos, false)); geos.forEach((g) => g.dispose()); m.geometry.computeBoundingSphere(); m.visible = false; m.updateMatrix(); scene.add(m); B.mesh = m;
  }
}
const BLOCKS = new Map();
// уровни: 0 — 1 м (рядом), 1 — 2 м, 2 — 4 м, 3 — 8 м (всегда есть); дальше тумана куски не рисуются
const LOD_STEP = [1, 2, 4, 8], LOD_NEAR = [110, 250, 560], LOD_KEEP = [260, 420, 900];
let lodBuilds = 0;
let lodNext=0,lodX=Infinity,lodZ=Infinity,lodPending=true,lodFar=0;
export function updateTerrainLod(cx, cz) {
  const now=performance.now();
  const far = scene.fog ? scene.fog.far + 120 : 1700;
  if(now<lodNext || (!lodPending && Math.hypot(cx-lodX,cz-lodZ)<12 && Math.abs(far-lodFar)<16))return;
  lodNext=now+100;lodX=cx;lodZ=cz;lodFar=far;lodPending=false;
  lodBuilds = 0;
  for (const c of chunks) {
    const d = Math.hypot(c.x - cx, c.z - cz);
    let want = d < LOD_NEAR[0] && c.max > -3 ? 0 : d < LOD_NEAR[1] ? 1 : d < LOD_NEAR[2] ? 2 : 3;
    if (c.max < -2 && want < 3) want = Math.max(want, 2); // морское дно — грубо
    // нужного уровня ещё нет — строим понемногу (не больше одного куска за обновление), пока показываем более грубый
    while (want < 3 && !c.lv[want]) {
      lodPending=true; if (lodBuilds < 1) { lodBuilds++; c.lv[want] = mkChunkMesh(chunkGeo(c.x0, c.z0, LOD_STEP[want])); c.lv[want].visible = false; c.group.add(c.lv[want]); break; }
      want++;
    }
    for (let i = 0; i < 3; i++) if (c.lv[i] && d > LOD_KEEP[i]) { c.group.remove(c.lv[i]); c.lv[i].geometry.dispose(); c.lv[i] = null; if (c.cur === i) c.cur = -1; }
    if (d - 46 > far) want = -1;
    c.want = want;
  }
  for (const B of BLOCKS.values()) { if (!B.mesh) continue; const allFar = B.chunks.every((c) => c.want === 3 || c.want === -1); B.on = allFar && B.chunks.some((c) => c.want === 3); B.mesh.visible = B.on; B.all = allFar; }
  for (const c of chunks) {
    const want = c.block && c.block.all ? -1 : c.want; // блок показан целиком — свои уровни куска скрыты
    if (want !== c.cur && (want < 0 || c.lv[want])) { for (let i = 0; i < 4; i++) if (c.lv[i]) c.lv[i].visible = i === want; c.cur = want; }
  }
}

// ---------- Вода ----------
export let water = null;
export function buildWater() {
  waterNormal.repeat.set(380, 380);
  const HM = 1536, SZ = 5400, hb = new Uint8Array(HM * HM * 4);
  for (let j = 0; j < HM; j++) for (let i = 0; i < HM; i++) {
    const x = -SZ / 2 + (i / (HM - 1)) * SZ, z = -SZ / 2 + (j / (HM - 1)) * SZ;
    // в открытом море не считаем (быстрее)
    let h = -30;
    if (WG.islandAt(x, z)) h = WG.terrainHeight(x, z);
    const v = Math.round(Math.min(1, Math.max(0, (h + 20) / 30)) * 255), o = (j * HM + i) * 4;
    hb[o] = v; hb[o + 1] = v; hb[o + 2] = v; hb[o + 3] = 255;
  }
  const hTex = new THREE.DataTexture(hb, HM, HM); hTex.magFilter = THREE.LinearFilter; hTex.minFilter = THREE.LinearFilter; hTex.needsUpdate = true;
  water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1), new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.85, roughness: 0.38, metalness: 0.0, // матовее: без слепящих бликов солнца
    normalMap: waterNormal, normalScale: new THREE.Vector2(0.32, 0.32), envMapIntensity: 0.6,
  }));
  water.rotation.x = -Math.PI / 2; water.receiveShadow = true;
  water.material.onBeforeCompile = (sh) => {
    sh.uniforms.hMap = { value: hTex }; sh.uniforms.uTime = waterTime; sh.uniforms.mapSize = { value: SZ };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D hMap; uniform float uTime; uniform float mapSize; varying vec3 vWPos;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // волны: несколько бегущих синусоид сверх карты нормалей
          float w1 = cos(vWPos.x * 0.21 + uTime * 1.1) * 0.06, w2 = cos(vWPos.z * 0.17 - uTime * 0.9) * 0.06, w3 = cos((vWPos.x + vWPos.z) * 0.07 + uTime * 0.6) * 0.05;
          normal = normalize(normal + (viewMatrix * vec4(w1 + w3, 0.0, w2 + w3, 0.0)).xyz);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 huv = vWPos.xz / mapSize + 0.5;
        float th = -20.0;
        if (huv.x > 0.0 && huv.x < 1.0 && huv.y > 0.0 && huv.y < 1.0) th = texture2D(hMap, huv).r * 30.0 - 20.0;
        float depth = max(0.0, -th);
        vec3 shallow = vec3(0.26, 0.74, 0.70), mid = vec3(0.05, 0.44, 0.58), deep = vec3(0.02, 0.15, 0.32);
        vec3 wc = mix(shallow, mid, smoothstep(0.0, 3.0, depth));
        wc = mix(wc, deep, smoothstep(3.0, 16.0, depth));
        float n = sin(vWPos.x * 0.35 + uTime * 1.3) * sin(vWPos.z * 0.31 - uTime * 1.1);
        float foam = 1.0 - smoothstep(0.0, 0.8, depth + n * 0.12);
        float band = smoothstep(0.75, 1.0, sin(depth * 4.5 - uTime * 1.6) * 0.5 + 0.5) * (1.0 - smoothstep(0.2, 2.0, depth));
        foam = clamp(foam + band * 0.5, 0.0, 1.0);
        diffuseColor.rgb = mix(wc, vec3(0.95), foam * 0.8);
        diffuseColor.a = max(mix(0.55, 0.95, smoothstep(0.0, 5.0, depth)), foam * 0.9);`);
  };
  scene.add(water);
}

// ---------- Склейка статичных моделей ----------
export const bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
export const windT = { value: 0 }, windK = { value: 1 };
export function swayMat(base, mode) {
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windT; sh.uniforms.uWindK = windK;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind; uniform float uWindK;' + (mode === 'world' ? '\nattribute float sway;' : ''))
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        ${mode === 'inst' ? 'vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]); float hh = max(0.0, position.y - 1.5); float amp = hh * hh * 0.006;' : 'vec3 ip = position; float amp = sway;'}
        float ph = ip.x * 0.11 + ip.z * 0.13;
        float w = sin(uWind * 1.4 + ph) * 0.7 + sin(uWind * 3.3 + ph * 2.3) * 0.3;
        transformed.x += w * amp * uWindK; transformed.z += cos(uWind * 1.1 + ph * 1.7) * amp * 0.45 * uWindK;
      }`);
  };
  m.customProgramCacheKey = () => 'sway-' + mode;
  return m;
}
export const treeMat = swayMat(bakedMat, 'inst'), grassMat = swayMat(bakedMat, 'world');
export function collectGeos(obj, out, relative, swayK = 0) {
  const baseY = obj.position.y;
  if (relative) { obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0); obj.scale.set(1, 1, 1); }
  obj.updateMatrixWorld(true);
  obj.traverse((c) => {
    if (!c.isMesh || !c.geometry || !c.material || Array.isArray(c.material) || !c.material.color || c.isSprite) return;
    let g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(c.matrixWorld);
    const n = g.attributes.position.count, col = new Float32Array(n * 3), cc = c.material.color, pa0 = g.attributes.position, vr = 0.94 + Math.random() * 0.12;
    const vc = c.geometry.attributes.color;
    for (let i = 0; i < n; i++) { const k = vr * (0.76 + 0.24 * Math.min(1, Math.max(0, pa0.getY(i) - (relative ? 0 : baseY)) / 1.3)); col[i * 3] = cc.r * k; col[i * 3 + 1] = cc.g * k; col[i * 3 + 2] = cc.b * k; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (swayK) { const sw = new Float32Array(n); for (let i = 0; i < n; i++) sw[i] = Math.max(0, pa0.getY(i) - baseY) * swayK; g.setAttribute('sway', new THREE.BufferAttribute(sw, 1)); }
    out.push(g);
  });
}
export function bakeMesh(geos, mat = bakedMat) {
  const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
  m.castShadow = true; m.receiveShadow = true;
  for (const g of geos) g.dispose();
  return m;
}
const isPlainMat = (m) => m.isMeshStandardMaterial && !m.map && !m.normalMap && !m.transparent && m.opacity === 1 && m.metalness === 0 && m.roughness === 0.9 && m.fog !== false && m.side === THREE.FrontSide && m.vertexColors === false && (m.emissiveIntensity === 0 || m.emissive.getHex() === 0);
const _bm = new THREE.Matrix4();
let groundAO = false;
function prepGeo(c, toAnchor, withColor, withUv) {
  let g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(c.material.vertexColors && k === 'color') && !(withUv && k === 'uv')) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.morphAttributes = {};
  _bm.copy(toAnchor).multiply(c.matrixWorld);
  g.applyMatrix4(_bm);
  if (_bm.determinant() < 0) for (const a of Object.values(g.attributes)) { const n = a.itemSize, arr = a.array; for (let i = 0; i < arr.length; i += 3 * n) for (let j = 0; j < n; j++) { const t = arr[i + n + j]; arr[i + n + j] = arr[i + 2 * n + j]; arr[i + 2 * n + j] = t; } }
  if (withColor) { const n = g.attributes.position.count, col = new Float32Array(n * 3), cc = c.material.color, pa = g.attributes.position, vr = 0.96 + Math.random() * 0.08;
    for (let i = 0; i < n; i++) { const k = vr * (groundAO ? 0.72 + 0.28 * Math.min(1, Math.max(0, pa.getY(i)) / 1.4) : 1); col[i * 3] = cc.r * k; col[i * 3 + 1] = cc.g * k; col[i * 3 + 2] = cc.b * k; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  return g;
}
export function optimizeStatic(root, opts = {}) {
  groundAO = !!opts.ground;
  const anchors = new Set([root, ...(opts.anchors || [])]);
  const addRef = (v, depth) => { if (!v || depth > 3) return; if (v.isObject3D) anchors.add(v); else if (Array.isArray(v)) v.forEach((x) => addRef(x, depth + 1)); else if (typeof v === 'object' && depth < 2 && !(v instanceof THREE.Vector3)) Object.values(v).forEach((x) => addRef(x, depth + 1)); };
  if(!opts.rigid)root.traverse((o) => { for (const v of Object.values(o.userData || {})) addRef(v, 0); });
  root.updateMatrixWorld(true);
  const buckets = new Map(); const merged = [];
  root.traverse((c) => {
    if (!c.isMesh || c.isInstancedMesh || c.isSkinnedMesh || anchors.has(c) || !c.geometry || Array.isArray(c.material) || !c.geometry.attributes.position) return;
    if (c.renderOrder || c.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    let a = c, hidden = !c.visible;
    while (!anchors.has(a)) { a = a.parent; if (!a) return; if (!anchors.has(a) && !a.visible) hidden = true; }
    if (hidden) return;
    const plain = isPlainMat(c.material);
    const key = (plain ? 'plain' : c.material.uuid) + (c.castShadow ? 's' : '') + (c.receiveShadow ? 'r' : '');
    if (!buckets.has(a)) buckets.set(a, new Map());
    const bm = buckets.get(a);
    if (!bm.has(key)) bm.set(key, { mat: plain ? bakedMat : c.material, plain, list: [], cast: c.castShadow, recv: c.receiveShadow });
    bm.get(key).list.push(c);
  });
  for (const [a, bm] of buckets) {
    const inv = new THREE.Matrix4().copy(a.matrixWorld).invert();
    for (const b of bm.values()) {
      if (b.list.length < 2 && !b.plain) continue;
      const withUv = !!(b.mat.map || b.mat.normalMap || b.mat.roughnessMap);
      const geos = b.list.map((c) => prepGeo(c, inv, b.plain, withUv));
      if (withUv && geos.some((g) => !g.attributes.uv)) continue;
      let geo; try { geo = mergeGeometries(geos, false); } catch { geo = null; }
      for (const g of geos) g.dispose();
      if (!geo) continue;
      const m = new THREE.Mesh(geo, b.mat); m.castShadow = b.cast; m.receiveShadow = b.recv || b.plain;
      m.userData.compiledGeometry=true;m.updateMatrix();m.matrixAutoUpdate=false; a.add(m); merged.push(...b.list);
    }
  }
  const mergedSet = new Set(merged);
  for (const c of merged) { let tgt = c.parent; while (mergedSet.has(tgt)) tgt = tgt.parent; for (const ch of [...c.children]) if (!mergedSet.has(ch)) tgt.attach(ch); }
  for (const c of merged) if (c.parent) c.parent.remove(c);
  const prune=o=>{for(const c of [...o.children]){prune(c);if(c.isGroup&&!c.children.length&&!anchors.has(c))o.remove(c);}};prune(root);
  return root;
}

// ---------- Пул настоящих ламп для виртуальных источников ----------
const LIGHT_POOL = 8;
const lightPool = Array.from({ length: LIGHT_POOL }, () => { const l = new THREE.PointLight(0xffffff, 0, 10, 2); l.castShadow = false; scene.add(l); return l; });
const vlTmp = new THREE.Vector3();
let lightsNext=0;
function attachedVisible(o) { for (let c = o; c; c = c.parent) { if (!c.visible) return false; if (c === scene) return true; } return false; }
export function updateLights(fx, fz, night) {
  const now=performance.now();if(now<lightsNext)return;lightsNext=now+100;
  const cand = [];
  for (const v of MD.VLIGHTS) {
    let root = v; while (root.parent) root = root.parent;
    if (root !== scene) { v._lost = v._lost || now; if (now - v._lost > 8000) MD.VLIGHTS.delete(v); continue; }
    v._lost = 0;
    if (v.intensity <= 0 || !attachedVisible(v)) continue;
    v.getWorldPosition(vlTmp);
    const d = Math.hypot(vlTmp.x - fx, vlTmp.z - fz);
    if (d > (v.distance || 40) + 70) continue;
    cand.push({ v, d: d / Math.sqrt(v.intensity + 1) / (v.prio ? 3 : 1), x: vlTmp.x, y: vlTmp.y, z: vlTmp.z });
  }
  cand.sort((a, b) => a.d - b.d);
  for (let i = 0; i < LIGHT_POOL; i++) {
    const l = lightPool[i], c = cand[i];
    if (!c) { l.intensity = 0; continue; }
    l.position.set(c.x, c.y, c.z); l.color.copy(c.v.color); l.intensity = c.v.intensity * (night ? 1.3 : 0.6); l.distance = c.v.distance; l.decay = c.v.decay;
  }
}
export const frameStats={calls:0,triangles:0,renderMs:0};
export function renderFrame() {
  const start=performance.now();updateVisibleMatrices(scene);camera.updateMatrixWorld();
  scene.matrixWorldAutoUpdate=false;
  renderer.info.autoReset=false;renderer.info.reset();
  if (GFX.level === 0) renderer.render(scene, camera); else composer.render();
  const ac = renderer.autoClear; renderer.autoClear = false; camera.layers.set(LABEL_LAYER);
  const sb = scene.background, fg = scene.fog, su = renderer.shadowMap.autoUpdate;
  scene.background = null; scene.fog = null; renderer.shadowMap.autoUpdate = false;
  renderer.render(scene, camera);
  renderer.shadowMap.autoUpdate = su; scene.background = sb; scene.fog = fg; camera.layers.set(0); renderer.autoClear = ac;scene.matrixWorldAutoUpdate=true;
  frameStats.calls=renderer.info.render.calls;frameStats.triangles=renderer.info.render.triangles;frameStats.renderMs=performance.now()-start;
}
export { THREE, mergeGeometries };
