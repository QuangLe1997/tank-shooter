// render/static-batch.js — PERF 14 THE SAME PIECE, ONE DRAW: a battlefield holds hundreds of plain meshes that are copies of one another — the same
//   geometry wearing the same material (crates, barrels, posts, lamp heads, a fort's repeated blocks, a city's kerb furniture) — and each was its own
//   draw call, twice with its shadow (CITY: ~200 draws from ~45 such pairs, of ~800). Here each pair of PERF_BUDGET.batch.min copies or more is drawn as
//   ONE instanced mesh: every frame, right before the battle is drawn (scene.onBeforeRender: world matrices fresh), the copies that are shown and in
//   view (or in the sun's shadow box) put their world matrix into it, and they themselves are skipped by that render (visible off for its length,
//   back on at once after: the game, its rays and its colliders never see a difference). Same geometry, same material object, same shader: near
//   stays exactly as sharp (near detail's sharp maps follow each instance), nothing is simplified. A copy that changes (its material swapped by a
//   hit flash or the see-through cut, moved to another layer, a hook of its own) simply draws itself. ?nosbatch turns it off.
// PERF 15 A LOD'S LEVELS TOO (PERF_BUDGET.batch.lod): a fort's towers, its keep, a field's repeated scenery wear a LOD (near copy / light copy); three
//   switches a LOD while it draws — after this pass had read which level shows. A LOD that has a batched level is switched here instead (its
//   autoUpdate off, update(camera) once a frame before the levels are read), so the batch and the LOD agree in the same frame.
import * as THREE from 'three';
import { PERF_BUDGET } from '../../config.js';
import { SHADOW_EXT, renderer, scene, sun } from '../hub.js';

const C = PERF_BUDGET.batch, OFF = typeof location === 'undefined' || /[?&]nosbatch\b/.test(location.search);
const GROUPS = new Map(), LODS = new Set(), HID = [], _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere();
let _scanT = 0;
export const SBATCH = { groups:0, members:0, drawn:0, draws:0 };
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function eligible(o){ if(!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh || !o.geometry || !o.material || Array.isArray(o.material)) return false;
  const m = o.material; if(m.transparent || m.alphaToCoverage || o.layers.mask !== 1 || !o.frustumCulled || own(o, 'onBeforeRender') || own(o, 'onAfterRender')) return false;
  const u = o.userData; if(u.cb || u.viewOf || u.noBatch || u.sb || o.matrixWorld.determinant() < 0) return false;   // (a mirrored copy: one instanced draw cannot flip its faces per instance) if(o.morphTargetInfluences || (o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length)) return false;
  if(!o.geometry.attributes.position || o.geometry.attributes.position.isInterleavedBufferAttribute) return false;
  for(let p = o.parent; p; p = p.parent){ if((p.isLOD && (p !== o.parent || !C.lod)) || (p.userData && p.userData.noBatch)) return false; if(p === scene) return true; } return false; }   // (PERF 15 a level of a LOD: its LOD is switched here, see frame)
const keyOf = o => o.geometry.id + ':' + o.material.id + ':' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + ':' + o.renderOrder + ':' + (o.customDepthMaterial ? o.customDepthMaterial.id : 0);
function grow(g, cap){ if(g.im){ scene.remove(g.im); g.im.dispose(); } const im = new THREE.InstancedMesh(g.geo, g.mat, cap); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false; im.castShadow = g.cast; im.receiveShadow = g.recv; im.renderOrder = g.ro; if(g.cdm) im.customDepthMaterial = g.cdm; im.count = 0; im.visible = false;
  im.name = 'staticBatch'; im.userData.sb = true; im.userData.keep = true; im.raycast = () => {}; scene.add(im); g.im = im; g.cap = cap; }
// who belongs where (every C.scan s, and when a fight begins): pairs of C.min copies or more
function scan(){ const by = new Map(); scene.traverse(o => { if(!eligible(o)) return; const k = keyOf(o); let L = by.get(k); if(!L) by.set(k, L = []); L.push(o); });
  for(const [k, g] of GROUPS) if(!by.has(k) || by.get(k).length < C.min){ if(g.im){ scene.remove(g.im); g.im.dispose(); } GROUPS.delete(k); }
  const lods = new Set(); for(const L of by.values()) if(L.length >= C.min) for(const o of L) if(o.parent.isLOD) lods.add(o.parent);
  for(const l of LODS) if(!lods.has(l)) l.autoUpdate = true; LODS.clear(); for(const l of lods){ l.autoUpdate = false; LODS.add(l); }   // PERF 15 a LOD with a batched level is switched in frame(), before its levels are read
  let n = 0; for(const [k, L] of by){ if(L.length < C.min) continue; let g = GROUPS.get(k);
    if(!g){ const o = L[0]; g = { geo:o.geometry, mat:o.material, cast:o.castShadow, recv:o.receiveShadow, ro:o.renderOrder, cdm:o.customDepthMaterial || null, im:null, cap:0, list:L }; GROUPS.set(k, g); grow(g, Math.max(8, L.length)); }
    else { g.list = L; if(L.length > g.cap) grow(g, L.length); } n += L.length; }
  SBATCH.groups = GROUPS.size; SBATCH.members = n; }
const shown = o => { for(let q = o; q; q = q.parent){ if(q.visible === false) return false; if(q === scene) return true; } return false; };
// once a frame, before the battle is drawn: the copies into their batches, the copies themselves off for this render
function frame(cam){ const now = performance.now() / 1000; if(now > _scanT){ _scanT = now + C.scan; scan(); }
  for(const l of LODS) l.update(cam);   // PERF 15 (three would switch it while drawing — after the batch had read which level shows)
  cam.updateMatrixWorld(); _fr.setFromProjectionMatrix(_pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const tg = sun.target.position, sr = SHADOW_EXT.r * 1.45; let drawn = 0, draws = 0;
  for(const g of GROUPS.values()){ const A = g.im.instanceMatrix.array; let n = 0;
    for(const o of g.list){ if(o.material !== g.mat || o.layers.mask !== 1 || o.geometry !== g.geo || !shown(o)) continue;   // (changed, or hidden: it is not ours this frame)
      HID.push(o); o.visible = false; if(!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); _sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      if(!_fr.intersectsSphere(_sph) && !(g.cast && Math.hypot(_sph.center.x - tg.x, _sph.center.z - tg.z) < sr + _sph.radius)) continue;   // neither seen nor shadowing what is
      A.set(o.matrixWorld.elements, n * 16); n++; }
    g.im.count = n; g.im.visible = n > 0; if(n){ g.im.instanceMatrix.clearUpdateRanges(); g.im.instanceMatrix.addUpdateRange(0, n * 16); g.im.instanceMatrix.needsUpdate = true; drawn += n; draws++; } }
  SBATCH.drawn = drawn; SBATCH.draws = draws; }
function restore(){ for(const o of HID) o.visible = true; HID.length = 0; }
export function staticBatchSwitch(on){ C.on = !!on; if(!C.on){ for(const l of LODS) l.autoUpdate = true; LODS.clear(); for(const g of GROUPS.values()){ scene.remove(g.im); g.im.dispose(); } GROUPS.clear(); } _scanT = 0; }
export function staticBatchStats(){ return { ...SBATCH }; }
if(!OFF && typeof window !== 'undefined' && renderer){
  const prev = scene.onBeforeRender; scene.onBeforeRender = function(r, sc, cam, ...a){ if(C.on && cam && cam.isPerspectiveCamera && !r.getRenderTarget()?.isWebGLCubeRenderTarget){ try{ frame(cam); }catch(e){ restore(); } }
    else for(const g of GROUPS.values()) if(g.im) g.im.visible = false;   // (another view of the battle — a photo from above: every copy draws itself)
    if(prev) return prev.call(this, r, sc, cam, ...a); };
  const base = renderer.render; renderer.render = function(sc, cam){ try{ return base.call(this, sc, cam); } finally{ if(HID.length) restore(); } }; }
