// render/far-lod.js — Z328 FAR LOD: a big static model (a fort's towers and gatehouse, our HQ) swaps to a simplified copy of itself past FARLOD.far m.
//   meshoptimizer's simplifier (WASM, fetched on first use) keeps the silhouette and the UV seams at a fraction of the triangles; the copy shares the
//   model's material, so it is lit, graded and shadowed the same. Up close nothing changes. three's LOD picks the level for the camera before the
//   shadow pass, so the shadow map gets the light copy too. If the simplifier cannot load, the model simply stays whole.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { FARLOD } from '../../config.js';
import { MOBILE } from '../hub.js';

const MS_URL = 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.21.0/meshopt_simplifier.module.js';
let _ms = null; const LO = new WeakMap();
const simplifier = () => _ms || (_ms = import(MS_URL).then(m => m.MeshoptSimplifier.ready.then(() => m.MeshoptSimplifier)).catch(() => null));
// the light copy of a geometry (cached per geometry: every tower of a fort shares one)
export function farGeo(geo){ if(LO.has(geo)) return LO.get(geo);
  const p = simplifier().then(S => { if(!S) return null; const g = geo.index ? geo : mergeVertices(geo, 1e-4), P = g.attributes.position;
    if(!g.index || !P || P.isInterleavedBufferAttribute) return null; const idx = Uint32Array.from(g.index.array), pos = Float32Array.from(P.array);
    const target = Math.max(192, Math.floor(idx.length * FARLOD.keep / 3) * 3), [out] = S.simplify(idx, pos, 3, target, FARLOD.err, []);
    if(!out || out.length >= idx.length * 0.8) return null;   // it would barely be lighter
    const lo = new THREE.BufferGeometry(); for(const [k, a] of Object.entries(g.attributes)) lo.setAttribute(k, a); lo.setIndex(new THREE.BufferAttribute(out, 1));
    if(!geo.boundingSphere) geo.computeBoundingSphere(); lo.boundingSphere = geo.boundingSphere.clone(); lo.userData.farOf = geo.uuid; return lo; }).catch(() => null);
  LO.set(geo, p); return p; }
// put a mesh under a LOD: itself near, its light copy (once ready) past `far` m (default: FARLOD.far, more for a big one — rK × its radius) — returns the LOD in its place
export function farLOD(m, far){ if(!FARLOD.on || !m || !m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || !m.parent) return m;
  if(!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); const r = m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z);
  const par = m.parent, lod = new THREE.LOD(), d = (far || Math.max(FARLOD.far, r * FARLOD.rK)) * (MOBILE ? FARLOD.mobileK : 1);
  lod.name = m.name; lod.position.copy(m.position); lod.quaternion.copy(m.quaternion); lod.scale.copy(m.scale); lod.userData.far = true;
  m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1); par.add(lod); par.remove(m); lod.addLevel(m, 0, FARLOD.hys);
  farGeo(m.geometry).then(lo => { if(!lo || !lod.parent) return; const lm = new THREE.Mesh(lo, m.material); lm.castShadow = m.castShadow; lm.receiveShadow = m.receiveShadow;
    lm.renderOrder = m.renderOrder; lod.addLevel(lm, d, FARLOD.hys); });
  return lod; }
