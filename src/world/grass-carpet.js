// world/grass-carpet.js — Z251 GRASS CARPET: on grassy battlefields a carpet of real blades grows round the camera's ground point — one instanced mesh (a clump of crossed, tapered blades per instance), clumps on a world-anchored hashed grid so they never swim as you move, re-laid only when you cross a cell, thinned and shrunk toward the rim so there is no edge, kept off water, and swayed by a gust field in the vertex shader. One draw call; none on phones' lowest tier.
import * as THREE from 'three';
import { GRASS } from '../../config.js';
import { BIOME, MOBILE, camera, heightAt, scene, wetAt } from '../hub.js';

const G = { mesh:null, biome:null, cx:1e9, cz:1e9, time:{ value:0 }, cap:0 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _ray = new THREE.Vector3();
const hash = (x, z, k) => { const h = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453; return h - Math.floor(h); };

// one clump: N tapered blades fanned round the centre, each leaning out a little; uv.y = 0 at the root, 1 at the tip (sway + colour use it)
function clumpGeo(n){ const pos = [], uv = [], idx = []; let v = 0;
  for(let b = 0; b < n; b++){ const a = b / n * Math.PI * 2 + b * 0.7, r = 0.05 + (b % 3) * 0.03, h = 0.75 + (b % 4) * 0.12, lean = 0.18 + (b % 2) * 0.12, w = GRASS.bladeW * (0.8 + (b % 3) * 0.15);
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r, tx = Math.cos(a) * lean, tz = Math.sin(a) * lean, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    pos.push(cx - px, 0, cz - pz,  cx + px, 0, cz + pz,  cx + tx * 0.5 - px * 0.6, h * 0.55, cz + tz * 0.5 - pz * 0.6,  cx + tx * 0.5 + px * 0.6, h * 0.55, cz + tz * 0.5 + pz * 0.6,  cx + tx, h, cz + tz);
    uv.push(0, 0, 1, 0, 0, 0.55, 1, 0.55, 0.5, 1);
    idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2, v + 2, v + 3, v + 4); v += 5; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g; }
function grassMat(col){
  const m = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.85, metalness:0, side:THREE.DoubleSide });
  m.onBeforeCompile = sh => { sh.uniforms.gTime = G.time; sh.uniforms.gRoot = { value:new THREE.Color(col[0]) }; sh.uniforms.gTip = { value:new THREE.Color(col[1]) }; sh.uniforms.gDry = { value:new THREE.Color(col[2]) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float gTime; varying float vGh; varying float vGv;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vGh = uv.y; vec4 gp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); vGv = fract(sin(dot(gp.xz, vec2(12.9898, 78.233))) * 43758.5453);
      float gust = sin(gp.x * 0.11 + gTime * 1.7) * 0.6 + sin(gp.z * 0.07 - gTime * 1.1) * 0.4, flut = sin(gTime * 6.0 + gp.x * 1.3 + gp.z * 1.7) * 0.12;
      float bend = (gust * 0.16 + flut * 0.05) * uv.y * uv.y; mat3 gIm = mat3(instanceMatrix);
      vec3 wb = vec3(bend, -abs(bend) * 0.3, bend * 0.6), lb = transpose(gIm) * wb; lb /= vec3(dot(gIm[0], gIm[0]), dot(gIm[1], gIm[1]), dot(gIm[2], gIm[2]));
      transformed += lb;   // the gust in world space (one wind for the whole field), taken back into this clump's turned, scaled frame`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 gRoot, gTip, gDry; varying float vGh; varying float vGv;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(mix(gRoot, gTip, vGh), gDry, smoothstep(0.86, 1.0, vGv) * 0.7);'); };
  m.customProgramCacheKey = () => 'grassCarpet'; return m; }

function build(){
  if(G.mesh){ scene.remove(G.mesh); G.mesh.geometry.dispose(); G.mesh.material.dispose(); G.mesh = null; }
  G.biome = BIOME.name; G.cx = G.cz = 1e9;
  const C = GRASS.biomes[BIOME.name]; if(!C || (MOBILE && !GRASS.mobile)) return;
  const R = MOBILE ? GRASS.Rm : GRASS.R, per = Math.ceil(Math.PI * (R / GRASS.cell) ** 2 * GRASS.perCell * C.dens);
  G.cap = per; const mesh = new THREE.InstancedMesh(clumpGeo(MOBILE ? 5 : GRASS.blades), grassMat(C.col), per);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.count = 0;
  scene.add(mesh); G.mesh = mesh; }
// lay the clumps in the cells round (x, z): a hashed spot, size and turn per clump, sparser and smaller toward the rim, none on water
function lay(x, z){ const C = GRASS.biomes[BIOME.name], R = MOBILE ? GRASS.Rm : GRASS.R, c = GRASS.cell, n0 = Math.ceil(R / c), M = G.mesh; let n = 0;
  const ix0 = Math.floor(x / c), iz0 = Math.floor(z / c);
  for(let i = -n0; i <= n0; i++) for(let j = -n0; j <= n0; j++){ const ci = ix0 + i, cj = iz0 + j;
    for(let k = 0; k < GRASS.perCell; k++){ if(n >= G.cap) break;
      if(hash(ci, cj, k + 9) > C.dens) continue;
      const px = (ci + hash(ci, cj, k)) * c, pz = (cj + hash(ci, cj, k + 3)) * c, d = Math.hypot(px - x, pz - z); if(d > R) continue;
      const rim = 1 - Math.max(0, (d - R * GRASS.rim) / (R * (1 - GRASS.rim))); if(hash(ci, cj, k + 5) > rim + 0.15) continue;
      if(wetAt(px, pz, 0.3)) continue;
      const sz = (GRASS.h[0] + (GRASS.h[1] - GRASS.h[0]) * hash(ci, cj, k + 7)) * (0.35 + 0.65 * rim);
      _p.set(px, heightAt(px, pz) - 0.02, pz); _q.setFromAxisAngle(_up, hash(ci, cj, k + 11) * 6.283); _s.set(sz * 1.4, sz, sz * 1.4);
      M.setMatrixAt(n++, _m.compose(_p, _q, _s)); } }
  M.count = n; M.instanceMatrix.needsUpdate = true; }
// every frame: follow the camera's ground point (re-lay when it crosses a cell, or the battlefield changed)
export function updateGrass(dt){
  if(G.biome !== BIOME.name) build();
  if(!G.mesh) return; G.time.value += dt;
  camera.getWorldDirection(_ray); const t = _ray.y < -0.05 ? Math.min(GRASS.ahead, camera.position.y / -_ray.y * 0.6) : GRASS.ahead;   // a little ahead of the camera, where it looks
  const x = camera.position.x + _ray.x * t, z = camera.position.z + _ray.z * t, cx = Math.floor(x / GRASS.step), cz = Math.floor(z / GRASS.step);
  if(cx !== G.cx || cz !== G.cz){ G.cx = cx; G.cz = cz; lay((cx + 0.5) * GRASS.step, (cz + 0.5) * GRASS.step); } }
