// render/cover-batch.js — Z338 COVER IN A FEW DRAWS: every piece of cover (sandbags, crates, drums, concrete, HESCO, jersey, pipes, teeth, tyres, logs,
//   wrecks…) stays its own mesh — the game moves it, scales it as it is beaten down, darkens it, flashes it, breaks it, swaps in the real model — but it
//   no longer draws itself: it waits on its own layer, and once a frame its place and its colour are copied into one instanced mesh per kind of piece
//   (same shape, same material), only the ones in view, in the sun's shadow box or short of the fog. A piece that is flashing from a hit (or anything
//   unusual about its material) draws itself for that moment. ~500 draws (plus their shadows) became a few dozen; a GPU bound by draw calls feels it
//   at once. `?nobatch` switches it off.
import * as THREE from 'three';
import { COVER_MAT, SHADOW_EXT, camera, fogDist, scene, sun } from '../hub.js';

const ON = typeof location === 'undefined' || !/nobatch/.test(location.search + location.hash);
export const BATCH_LAYER = 6;
const LIVE = new Set(), GROUPS = new Map(), _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _c = new THREE.Vector3(), _sph = new THREE.Sphere();
let _at = -1;
// a piece of cover joins the batch while it is in the battle's scene
export function batchCover(m){ if(!ON || !m) return m; m.userData.cb = true;
  m.addEventListener('added', () => LIVE.add(m)); m.addEventListener('removed', () => { LIVE.delete(m); if(m.layers.mask === 1 << BATCH_LAYER) m.layers.set(0); }); return m; }
const plain = m => { const mt = m.material; return mt && !Array.isArray(mt) && mt.isMeshStandardMaterial && !mt.transparent && mt.userData._e0 === undefined; };
const sceneOf = o => { let r = o; while(r.parent) r = r.parent; return r; };
const shown = o => { for(let q = o; q; q = q.parent) if(q.visible === false) return false; return true; };
function group(m, key){ let g = GROUPS.get(key); if(g) return g;
  const src = m.material, mat = src.clone(); mat.onBeforeCompile = src.onBeforeCompile; mat.customProgramCacheKey = src.customProgramCacheKey; mat.color.setRGB(1, 1, 1);
  g = { key, geo:m.geometry, mat, cast:m.castShadow, recv:m.receiveShadow, im:null, cap:0, n:0, idle:0 }; grow(g, 64); GROUPS.set(key, g); return g; }
function grow(g, cap){ const old = g.im, im = new THREE.InstancedMesh(g.geo, g.mat, cap);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.setColorAt(0, new THREE.Color(1, 1, 1)); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false; im.castShadow = g.cast; im.receiveShadow = g.recv; im.name = 'coverBatch'; im.userData.keep = true; im.count = 0; im.visible = false;
  if(old){ for(let i = 0; i < g.n; i++){ old.getMatrixAt(i, _pm); im.setMatrixAt(i, _pm); old.getColorAt(i, _col); im.setColorAt(i, _col); } scene.remove(old); old.dispose(); }
  scene.add(im); g.im = im; g.cap = cap; }
const _col = new THREE.Color();
// once a frame, right before the battle is drawn (scene.onBeforeRender: world matrices are fresh)
export function updateCoverBatch(){ const now = performance.now(); if(now - _at < 3) return; _at = now;
  camera.updateMatrixWorld(); _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, fd = fogDist(), tg = sun.target.position, sr = SHADOW_EXT.r * 1.45;
  for(const g of GROUPS.values()) g.n = 0;
  for(const m of LIVE){
    if(sceneOf(m) !== scene){ if(m.layers.mask === 1 << BATCH_LAYER) m.layers.set(0); continue; }   // (the shop or the boot screen draw their own)
    if(!shown(m)) continue;
    if(!plain(m)){ if(m.layers.mask === 1 << BATCH_LAYER) m.layers.set(0); continue; }               // flashing: it draws itself for now
    if(m.layers.mask !== 1 << BATCH_LAYER) m.layers.set(BATCH_LAYER);
    const geo = m.geometry; if(!geo.boundingSphere) geo.computeBoundingSphere(); const e = m.matrixWorld.elements;
    _sph.copy(geo.boundingSphere).applyMatrix4(m.matrixWorld); _c.copy(_sph.center);
    const d = Math.hypot(_c.x - cx, _c.y - cy, _c.z - cz); if(d - _sph.radius > fd) continue;   // lost in the fog
    if(!_fr.intersectsSphere(_sph) && !(m.castShadow && Math.hypot(_c.x - tg.x, _c.z - tg.z) < sr + _sph.radius)) continue;   // neither seen nor shadowing what is
    const base = COVER_MAT[m.userData.kind] || m.material, g = group(m, geo.id + ':' + base.id + ':' + (m.castShadow ? 1 : 0) + (m.receiveShadow ? 1 : 0));
    if(g.n >= g.cap) grow(g, g.cap * 2);
    g.im.instanceMatrix.array.set(e, g.n * 16); g.im.setColorAt(g.n, m.material.color); g.n++; }
  for(const [k, g] of GROUPS){ const im = g.im; im.count = g.n; im.visible = g.n > 0;
    if(g.n){ g.idle = 0; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
    else if(++g.idle > 600){ scene.remove(im); im.dispose(); g.mat.dispose(); GROUPS.delete(k); } } }   // a kind gone for good (the real model replaced it, the stage changed)
export function coverBatchStats(){ let draws = 0, pieces = 0; for(const g of GROUPS.values()) if(g.n){ draws++; pieces += g.n; } return { groups:GROUPS.size, draws, pieces, live:LIVE.size }; }
if(ON && typeof window !== 'undefined'){ const prev = scene.onBeforeRender; scene.onBeforeRender = function(...a){ updateCoverBatch(); if(prev) prev.apply(this, a); }; }
