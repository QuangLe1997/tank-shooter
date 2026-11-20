// world/grass-carpet.js — Z251 GRASS CARPET → Z263 PHOTOGRAPHED GRASS: on grassy battlefields a carpet of real grass grows round the camera's ground
// point — one instanced mesh, each instance three crossed cards showing one of five photographed grass clumps (Poly Haven grass_medium_01, CC0:
// the green one, or its dry version on the savanna), cut out by the photo's own alpha; clumps sit on a world-anchored hashed grid so they never swim
// as you move, re-laid only when you cross a cell, thinned and shrunk toward the rim so there is no edge, kept off water; darker at the root, a
// few drier clumps here and there, and swayed by one gust field for the whole field (world space). One draw call; none on phones' lowest tier.
import * as THREE from 'three';
import { GRASS } from '../../config.js';
import { BIOME, GRASS_FAR, MOBILE, SUN_VIEW, camera, groundMat, heightAt, scene, wetAt } from '../hub.js';

const G = { mesh:null, biome:null, cx:1e9, cz:1e9, time:{ value:0 }, cap:0, tex:{} };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _ray = new THREE.Vector3();
const hash = (x, z, k) => { const h = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453; return h - Math.floor(h); };
// the five clump cards in the strip (pixels, y down) → uv rects [u0, v0, du, dv] (the texture is flipped: v = 1 − y / H)
const RECTS = GRASS.cards.map(([x, y, w, h]) => [x / GRASS.atlas[0], 1 - (y + h) / GRASS.atlas[1], w / GRASS.atlas[0], h / GRASS.atlas[1]]);

function load(file, srgb){ if(G.tex[file]) return G.tex[file];
  return (G.tex[file] = new THREE.TextureLoader().loadAsync(GRASS.dir + file).then(t => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t; })); }

// one clump: three vertical cards crossed at 60°, 1 high and 1 wide (the shader widens each to its card's aspect); normals up (soft, even light)
function clumpGeo(){ const pos = [], uv = [], nrm = [], idx = []; let v = 0;
  for(let k = 0; k < 3; k++){ const a = k * Math.PI / 3, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
    pos.push(-cx, 0, -cz,  cx, 0, cz,  cx, 1, cz,  -cx, 1, -cz); uv.push(0, 0, 1, 0, 1, 1, 0, 1); for(let q = 0; q < 4; q++) nrm.push(0, 1, 0);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  return g; }
function grassMat(map, alpha, C){
  const m = new THREE.MeshStandardMaterial({ map, alphaMap:alpha, alphaTest:GRASS.alphaTest, alphaToCoverage:!MOBILE, color:new THREE.Color().setRGB(...C.tint), roughness:0.9, metalness:0, side:THREE.DoubleSide });
  m.onBeforeCompile = sh => { sh.uniforms.gTime = G.time; sh.uniforms.gAtlasK = { value:GRASS.atlas[0] / GRASS.atlas[1] }; sh.uniforms.gDry = { value:new THREE.Color().setRGB(...(C.dryTint || [1.15, 1.0, 0.7])) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float gTime, gAtlasK; attribute vec4 aRect; varying float vGh; varying float vGv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = aRect.xy + uv * aRect.zw; vAlphaMapUv = vMapUv;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      float asp = aRect.z / aRect.w * gAtlasK; transformed.xz *= asp;   // the card as wide as its photo
      vGh = uv.y; vec4 gp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); vGv = fract(sin(dot(gp.xz, vec2(12.9898, 78.233))) * 43758.5453);
      float gust = sin(gp.x * 0.11 + gTime * 1.7) * 0.6 + sin(gp.z * 0.07 - gTime * 1.1) * 0.4, flut = sin(gTime * 6.0 + gp.x * 1.3 + gp.z * 1.7) * 0.12;
      float bend = (gust * 0.16 + flut * 0.05) * uv.y * uv.y; mat3 gIm = mat3(instanceMatrix);
      vec3 wb = vec3(bend, -abs(bend) * 0.3, bend * 0.6), lb = transpose(gIm) * wb; lb /= vec3(dot(gIm[0], gIm[0]), dot(gIm[1], gIm[1]), dot(gIm[2], gIm[2]));
      transformed += lb;   // the gust in world space (one wind for the whole field), taken back into this clump's turned, scaled frame`);
    sh.uniforms.uSunView = SUN_VIEW; sh.uniforms.uTrans = { value:GRASS.trans };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 gDry; uniform vec3 uSunView; uniform float uTrans; varying float vGh; varying float vGv;')
      .replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * vec3(1.0, 0.93, 0.6) * pow(clamp(dot(normalize(vViewPosition), uSunView), 0.0, 1.0), 4.0) * smoothstep(0.3, 1.0, vGh) * uTrans;   // Z276 blade tips glow against the sun\n#include <opaque_fragment>')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);   // both faces lit as the sky lights them (three flips a back face\'s normal: an up-normal card would go black)')
      .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= mix(${GRASS.rootDark.toFixed(2)}, 1.0, smoothstep(0.0, 0.45, vGh));   // shade down among the stems
      diffuseColor.rgb *= mix(vec3(1.0), gDry, smoothstep(0.82, 1.0, vGv) * 0.6);   // a drier clump here and there`); };
  m.customProgramCacheKey = () => 'grassPhoto'; return m; }

// Z322 the carpet's colour seen from afar: the clump photo averaged where it is opaque (inside the cards, linear light) × the battlefield's tint;
//   and the floor's own average under it — the ground shader paints that colour past the carpet's rim, so far and near read the same
let _cv = null;
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
function pixels(img, W, H){ _cv = _cv || document.createElement('canvas'); _cv.width = W; _cv.height = H; const x = _cv.getContext('2d', { willReadFrequently:true }); x.clearRect(0, 0, W, H); x.drawImage(img, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; }
function avgOf(img, alpha){ const W = 128, H = Math.max(8, Math.round(W * (img.height || 1) / (img.width || 1))), d = pixels(img, W, H), a = alpha ? pixels(alpha, W, H) : null, A = GRASS.atlas; let r = 0, g = 0, b = 0, n = 0;
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const i = (y * W + x) * 4;
    if(a){ const px = x / W * A[0], py = y / H * A[1]; if(a[i] < GRASS.alphaTest * 255 || !GRASS.cards.some(([cx, cy, cw, ch]) => px >= cx && px < cx + cw && py >= cy && py < cy + ch)) continue; }
    r += lin(d[i]); g += lin(d[i + 1]); b += lin(d[i + 2]); n++; }
  return n ? new THREE.Color(r / n, g / n, b / n) : null; }
function farColour(){ const k = GRASS_FAR.k.value, C = GRASS.biomes[BIOME.name];
  if(!C || !G.mesh || !G.blade){ k.x = 0; return; }
  const img = groundMat.map && groundMat.map.image; if(img === G.farImg) return; G.farImg = img;   // again when the photo floor swaps in
  let gl = 0.3; try{ const c = img ? avgOf(img) : null; if(c){ c.multiply(groundMat.color); gl = (c.r + c.g + c.b) / 3; } }catch(e){}
  GRASS_FAR.col.value.copy(G.blade); k.set(C.dens * GRASS.far.cover, Math.max(0.02, gl), 0, 0); }
export function grassReady(){ return G.ready || Promise.resolve(); }   // Z322 the intro waits for it
function build(){
  if(G.mesh){ scene.remove(G.mesh); G.mesh.material.dispose(); G.mesh = null; }
  G.biome = BIOME.name; G.cx = G.cz = 1e9; G.blade = null; G.farImg = null; GRASS_FAR.k.value.x = 0; G.ready = null;
  const C = GRASS.biomes[BIOME.name]; if(!C || (MOBILE && !GRASS.mobile) || /procgrass/.test(location.search + location.hash)) return;
  const want = BIOME.name;
  G.ready = Promise.all([load(C.tex === 'dry' ? 'dry.jpg' : 'diff.jpg', true), load('alpha.jpg', false)]).then(([map, alpha]) => {
    if(G.biome !== want || G.mesh) return;   // the battlefield changed while it loaded
    try{ const c = avgOf(map.image, alpha.image); G.blade = c ? c.multiply(new THREE.Color().setRGB(...C.tint)).multiplyScalar(0.93 * GRASS.far.k) : null; }catch(e){ G.blade = null; }
    const R = MOBILE ? GRASS.Rm : GRASS.R, per = Math.ceil(Math.PI * (R / GRASS.cell) ** 2 * GRASS.perCell * C.dens);
    G.cap = per; const geo = clumpGeo(); geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(new Float32Array(per * 4), 4));
    const mesh = new THREE.InstancedMesh(geo, grassMat(map, alpha, C), per);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.count = 0;
    scene.add(mesh); G.mesh = mesh; }).catch(() => {}); }
// lay the clumps in the cells round (x, z): a hashed spot, size, turn and photo per clump, sparser and smaller toward the rim, none on water
function lay(x, z){ const C = GRASS.biomes[BIOME.name], R = MOBILE ? GRASS.Rm : GRASS.R, c = GRASS.cell, n0 = Math.ceil(R / c), M = G.mesh, A = M.geometry.attributes.aRect; let n = 0;
  const ix0 = Math.floor(x / c), iz0 = Math.floor(z / c);
  for(let i = -n0; i <= n0; i++) for(let j = -n0; j <= n0; j++){ const ci = ix0 + i, cj = iz0 + j;
    for(let k = 0; k < GRASS.perCell; k++){ if(n >= G.cap) break;
      if(hash(ci, cj, k + 9) > C.dens) continue;
      const px = (ci + hash(ci, cj, k)) * c, pz = (cj + hash(ci, cj, k + 3)) * c, d = Math.hypot(px - x, pz - z); if(d > R) continue;
      const rim = 1 - Math.max(0, (d - R * GRASS.rim) / (R * (1 - GRASS.rim))); if(hash(ci, cj, k + 5) > rim + 0.15) continue;
      if(wetAt(px, pz, 0.3)) continue;
      const sz = (GRASS.h[0] + (GRASS.h[1] - GRASS.h[0]) * hash(ci, cj, k + 7)) * (0.4 + 0.6 * rim);
      _p.set(px, heightAt(px, pz) - 0.03, pz); _q.setFromAxisAngle(_up, hash(ci, cj, k + 11) * 6.283); _s.set(sz, sz * (0.85 + 0.3 * hash(ci, cj, k + 13)), sz);
      M.setMatrixAt(n, _m.compose(_p, _q, _s)); const r = RECTS[Math.floor(hash(ci, cj, k + 17) * RECTS.length) % RECTS.length]; A.setXYZW(n, r[0], r[1], r[2], r[3]); n++; } }
  M.count = n; M.instanceMatrix.needsUpdate = true; A.needsUpdate = true; }
// every frame: follow the camera's ground point (re-lay when it crosses a cell, or the battlefield changed)
export function updateGrass(dt){
  if(G.biome !== BIOME.name) build();
  if(!G.mesh) return; G.time.value += dt; farColour();
  camera.getWorldDirection(_ray); const t = _ray.y < -0.05 ? Math.min(GRASS.ahead, camera.position.y / -_ray.y * 0.6) : GRASS.ahead;   // a little ahead of the camera, where it looks
  const x = camera.position.x + _ray.x * t, z = camera.position.z + _ray.z * t, cx = Math.floor(x / GRASS.step), cz = Math.floor(z / GRASS.step);
  if(cx !== G.cx || cz !== G.cz){ G.cx = cx; G.cz = cz; lay((cx + 0.5) * GRASS.step, (cz + 0.5) * GRASS.step); const R = MOBILE ? GRASS.Rm : GRASS.R; GRASS_FAR.c.value.set((cx + 0.5) * GRASS.step, (cz + 0.5) * GRASS.step, R * GRASS.far.rim0, R * GRASS.far.rim1); } }
