// render/far-lod.js — Z328 FAR LOD: a big static model (a fort's towers and gatehouse, our HQ) swaps to a simplified copy of itself past FARLOD.far m.
//   meshoptimizer's simplifier (WASM, fetched on first use) keeps the silhouette and the UV seams at a fraction of the triangles; the copy shares the
//   model's material, so it is lit, graded and shadowed the same. Up close nothing changes. three's LOD picks the level for the camera before the
//   shadow pass, so the shadow map gets the light copy too. If the simplifier cannot load, the model simply stays whole.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ASSETDIET, FARLOD, SHADOWLOD } from '../../config.js';
import { MOBILE } from '../hub.js';

let _ms = null; const LO = new WeakMap();
const simplifier = () => _ms || (_ms = import(new URL(ASSETDIET.simplifier, document.baseURI).href).then(m => m.MeshoptSimplifier.ready.then(() => m.MeshoptSimplifier)).catch(() => null));
// PERF 3 ONE SIMPLIFICATION AT A TIME: a shadow rescan that met fifty new casters welded and simplified all fifty in the same frame (their callbacks all
//   ran as one microtask burst) — 1.7 s frozen in a battle's first seconds. Every weld + simplify now waits its turn in a queue worked in its own task,
//   at most JOB_MS a slice (always one job), a frame between slices; the light copies arrive a little later, nothing else changes.
const JOBS = [], JOB_MS = 6; let _jobT = 0;
function runJobs(){ _jobT = 0; const t0 = performance.now(); do JOBS.shift()(); while(JOBS.length && performance.now() - t0 < JOB_MS); if(JOBS.length) _jobT = setTimeout(runJobs, 16); }
const job = fn => new Promise((res, rej) => { JOBS.push(() => { try{ res(fn()); }catch(e){ rej(e); } }); if(!_jobT) _jobT = setTimeout(runJobs, 0); });
// A3 a light copy made offline (a species' phone copy: render/real-trees.js) stands in for any simplification of that geometry
const SEED = new WeakMap();
export function farSeed(geo, lo){ if(geo && lo) SEED.set(geo, lo); }
// the light copy of a geometry (cached per geometry: every tower of a fort shares one)
export function farGeo(geo, keep){ if(SEED.has(geo)) return Promise.resolve(SEED.get(geo)); const K = keep || FARLOD.keep, C = LO.get(geo) || {}; if(!LO.has(geo)) LO.set(geo, C); if(C[K]) return C[K];   // Z412 keep: the share of triangles kept (one copy per share)
  const p = simplifier().then(S => S && job(() => { const g = geo.index ? geo : mergeVertices(geo, 1e-4), P = g.attributes.position;
    if(!g.index || !P || P.isInterleavedBufferAttribute) return null; return { g, mi:!!(g.attributes.mi && geo.groups && geo.groups.length) }; })
    .then(r => r && offThread({ idx:new Uint32Array(r.g.index.array), pos:new Float32Array(r.g.attributes.position.array), keep:K, min:192, err:FARLOD.err, flags:[], mi:r.mi ? new Float32Array(r.g.attributes.mi.array) : null })
      .then(w => w && w.err === 'worker' ? job(() => farInline(S, r.g, K, r.mi)) : w && !w.err && w.out.length < w.n * 0.8 ? { out:w.out, groups:w.groups } : null)   // (it would barely be lighter: none)
      .then(w => { if(!w) return null; const g = r.g, lo = new THREE.BufferGeometry(); for(const [k, a] of Object.entries(g.attributes)) lo.setAttribute(k, a); lo.setIndex(new THREE.BufferAttribute(w.out, 1));
        if(w.groups) for(const [a, b, c] of w.groups) lo.addGroup(a, b, c);   // Z435 a model of several materials keeps a group per material
        if(!geo.boundingSphere) geo.computeBoundingSphere(); lo.boundingSphere = geo.boundingSphere.clone(); if(geo.boundingBox) lo.boundingBox = geo.boundingBox.clone(); lo.userData.farOf = geo.uuid; return lo; }))).catch(() => null);
  C[K] = p; return p; }
// (the same on this thread, where no worker can run: the simplified index and its groups per material)
function farInline(S, g, K, mi){ const idx = Uint32Array.from(g.index.array), pos = Float32Array.from(g.attributes.position.array), target = Math.max(192, Math.floor(idx.length * K / 3) * 3), [out] = S.simplify(idx, pos, 3, target, FARLOD.err, []);
  if(!out || out.length >= idx.length * 0.8) return null; return mi ? byMat(out, g.attributes.mi.array) : { out, groups:null }; }
function byMat(out, M){ const n = out.length / 3, ord = [...Array(n).keys()].sort((a, b) => M[out[a * 3]] - M[out[b * 3]]), o2 = new Uint32Array(out.length), groups = [];
  ord.forEach((t, i) => { o2[i * 3] = out[t * 3]; o2[i * 3 + 1] = out[t * 3 + 1]; o2[i * 3 + 2] = out[t * 3 + 2]; });
  let s0 = 0; for(let i = 1; i <= n; i++) if(i === n || M[o2[i * 3]] !== M[o2[s0 * 3]]){ groups.push([s0 * 3, (i - s0) * 3, M[o2[s0 * 3]]]); s0 = i; } return { out:o2, groups }; }
// DIET 6 THE WELD AND THE SIMPLIFY OFF THE MAIN THREAD: PERF 3's queue slices the work by job, but one job is one geometry — a scanned fort wall or a
//   big rock family took 690 ms in a single frame 1.5 s into a desert battle (its attributes no longer interleaved since DIET 2, so its far copy is made
//   at all now). A module worker (the vendored simplifier) welds and simplifies; this thread only copies the arrays in and builds the geometry from
//   what comes back. A page where the worker cannot start (or dies) does it here as before.
const WSRC = url => `import { MeshoptSimplifier as S } from ${JSON.stringify(url)};
${byMat.toString()}
const weld = (pos, idx, tol) => { const m = 1 / tol, H = new Map(), n = pos.length / 3, rem = new Uint32Array(n), P = []; let k = 0;
  for(let i = 0; i < n; i++){ const h = Math.round(pos[i * 3] * m) + ',' + Math.round(pos[i * 3 + 1] * m) + ',' + Math.round(pos[i * 3 + 2] * m); let j = H.get(h); if(j === undefined){ j = k++; H.set(h, j); P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); } rem[i] = j; }
  const I = new Uint32Array(idx ? idx.length : n); for(let i = 0; i < I.length; i++) I[i] = rem[idx ? idx[i] : i]; return { pos:new Float32Array(P), idx:I }; };
onmessage = async ({ data:d }) => { try{ await S.ready; let pos = d.pos, idx = d.idx; if(d.weld){ const w = weld(pos, idx, d.weld); pos = w.pos; idx = w.idx; }
  const [out] = S.simplify(idx, pos, 3, Math.max(d.min, Math.floor(idx.length * d.keep / 3) * 3), d.err, d.flags); const r = d.mi && out ? byMat(out, d.mi) : { out, groups:null };
  postMessage({ id:d.id, out:r.out, groups:r.groups, n:idx.length, pos:d.weld ? pos : null }, d.weld ? [r.out.buffer, pos.buffer] : [r.out.buffer]); }catch(e){ postMessage({ id:d.id, err:String(e && e.message || e) }); } };`;
let _wk = null, _wid = 0; const WCB = new Map();
function wk(){ if(_wk !== null) return _wk; if(!ASSETDIET.offThread || typeof window === 'undefined' || !window.Worker){ _wk = false; return _wk; }
  try{ const w = new window.Worker(URL.createObjectURL(new Blob([WSRC(new URL(ASSETDIET.simplifier, document.baseURI).href)], { type:'text/javascript' })), { type:'module' });
    w.onmessage = e => { const f = WCB.get(e.data.id); if(f){ WCB.delete(e.data.id); f(e.data); } };
    w.onerror = () => { _wk = false; for(const f of WCB.values()) f({ err:'worker' }); WCB.clear(); }; _wk = w; }catch(e){ _wk = false; } return _wk; }
const offThread = d => new Promise(res => { const w = wk(); if(!w) return res({ err:'worker' }); d.id = ++_wid; WCB.set(d.id, res); w.postMessage(d, [d.pos.buffer, d.idx.buffer].concat(d.mi ? [d.mi.buffer] : [])); });
// Z412 A RING ROUND THE HORIZON, CULLED BY ARC: an instanced mesh laid all round the field (frustumCulled off, its one bounding sphere is the whole
//   ring) was drawn whole every frame — the arc behind the camera too. Split by bearing into n meshes, each with its own bounds, the camera skips
//   the arcs it does not face. keep (optional): swap in a simplified copy at that share of the triangles once it is ready (they stand 50–300 m off).
export function sectorize(im, n, keep){ const N = im.count, by = Array.from({ length:n }, () => []), M = new THREE.Matrix4(), V = new THREE.Vector3(), g = new THREE.Group();
  for(let i = 0; i < N; i++){ im.getMatrixAt(i, M); V.setFromMatrixPosition(M); by[Math.min(n - 1, Math.floor((Math.atan2(V.z, V.x) / (2 * Math.PI) + 1) % 1 * n))].push(i); }
  for(const L of by){ if(!L.length) continue; const m = new THREE.InstancedMesh(im.geometry, im.material, L.length); L.forEach((i, j) => { im.getMatrixAt(i, M); m.setMatrixAt(j, M); });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.renderOrder = im.renderOrder; m.castShadow = im.castShadow; m.receiveShadow = im.receiveShadow; m.layers.mask = im.layers.mask;
    Object.assign(m.userData, im.userData); g.add(m); }
  if(keep && !MOBILE) farGeo(im.geometry, keep).then(lo => { if(lo) for(const m of g.children) m.geometry = lo; });
  im.dispose(); return g; }
// put a mesh under a LOD: itself near, its light copy (once ready) past `far` m (default: FARLOD.far, more for a big one — rK × its radius) — returns the LOD in its place
export function farLOD(m, far){ if(!FARLOD.on || !m || !m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || !m.parent) return m;
  if(!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); const r = m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z);
  const par = m.parent, lod = new THREE.LOD(), d = (far || Math.max(FARLOD.far, r * FARLOD.rK)) * (MOBILE ? FARLOD.mobileK : 1);
  lod.name = m.name; lod.position.copy(m.position); lod.quaternion.copy(m.quaternion); lod.scale.copy(m.scale); lod.userData.far = true;
  m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1); par.add(lod); par.remove(m); lod.addLevel(m, 0, FARLOD.hys);
  farGeo(m.geometry).then(lo => { if(!lo || !lod.parent) return; const lm = new THREE.Mesh(lo, m.material); lm.castShadow = m.castShadow; lm.receiveShadow = m.receiveShadow;
    lm.renderOrder = m.renderOrder; lod.addLevel(lm, d, FARLOD.hys); });
  return lod; }

// Z412 SHADOWS FROM LIGHT COPIES: the sun's shadow pass drew every caster at full detail (2.8M triangles in a ruins battle, ~11 ms of an M4's
//   frame) for a 2048² depth map in which a 6k-triangle prop and its 1k-triangle copy cast the same shade. Every opaque caster above SHADOWLOD.min
//   triangles gets a position-only copy (welded, so the simplifier can really collapse it) at SHADOWLOD.keep of its triangles; during the shadow
//   pass the caster wears it, then its own geometry again. Skinned / custom-depth / cut-out (alpha-tested) casters keep their own.
const SH = new WeakMap(), SH_BY = new WeakMap();   // geometry → its shadow copy · scene → { casters, passes } (each scene its own list: the radar / showroom renders draw other scenes)
function shadowGeo(geo){ if(SH.has(geo)) return SH.get(geo); SH.set(geo, null);
  simplifier().then(S => S && job(() => { const A = geo.attributes.position, f = new Float32Array(A.count * 3); for(let i = 0; i < A.count; i++){ f[i * 3] = A.getX(i); f[i * 3 + 1] = A.getY(i); f[i * 3 + 2] = A.getZ(i); }   // (plain floats, a meshopt-packed glTF's interleaved / quantized positions too)
    return { f, I:geo.index ? new Uint32Array(geo.index.array) : null }; })
    .then(r => r && offThread({ pos:r.f, idx:r.I || new Uint32Array(r.f.length / 3).map((_, i) => i), weld:1e-3, keep:SHADOWLOD.keep, min:96, err:SHADOWLOD.err, flags:['LockBorder'] }))
    .then(w => { if(w && w.err === 'worker') return job(() => shadowInline(S, geo)); if(!w || w.err || w.out.length >= w.n * 0.7) return; const lo = new THREE.BufferGeometry(); lo.setAttribute('position', new THREE.BufferAttribute(w.pos, 3)); lo.setIndex(new THREE.BufferAttribute(w.out, 1));
      if(geo.groups.length) lo.addGroup(0, w.out.length, 0);   // a multi-material caster: one group (the depth pass draws every material the same)
      if(!geo.boundingSphere) geo.computeBoundingSphere(); lo.boundingSphere = geo.boundingSphere.clone(); SH.set(geo, lo); })).catch(() => {});
  return null; }
// (the same on this thread, where no worker can run)
function shadowInline(S, geo){ const A = geo.attributes.position, p = new THREE.BufferGeometry();
    if(A.isInterleavedBufferAttribute){ const f = new Float32Array(A.count * 3); for(let i = 0; i < A.count; i++){ f[i * 3] = A.getX(i); f[i * 3 + 1] = A.getY(i); f[i * 3 + 2] = A.getZ(i); } p.setAttribute('position', new THREE.BufferAttribute(f, 3)); }   // (a meshopt-packed glTF: positions interleaved, quantized)
    else p.setAttribute('position', A); if(geo.index) p.setIndex(geo.index);
    const g = mergeVertices(p, 1e-3), P = g.attributes.position; if(!g.index) return; const idx = Uint32Array.from(g.index.array);
    const [out] = S.simplify(idx, Float32Array.from(P.array), 3, Math.max(96, Math.floor(idx.length * SHADOWLOD.keep / 3) * 3), SHADOWLOD.err, ['LockBorder']);
    if(!out || out.length >= idx.length * 0.7) return; const lo = new THREE.BufferGeometry(); lo.setAttribute('position', P); lo.setIndex(new THREE.BufferAttribute(out, 1));
    if(geo.groups.length) lo.addGroup(0, out.length, 0);   // a multi-material caster: one group (the depth pass draws every material the same)
    if(!geo.boundingSphere) geo.computeBoundingSphere(); lo.boundingSphere = geo.boundingSphere.clone(); SH.set(geo, lo); }
const tris = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
const cutout = m => m.alphaTest > 0 || m.transparent || m.alphaMap || !m.visible;
function shadowable(o){ const m = o.material; if(!m || (Array.isArray(m) ? !m.length || m.some(cutout) : cutout(m)) || o.isSkinnedMesh || o.customDepthMaterial || o.morphTargetInfluences) return false;
  const g = o.geometry; return !!(g && g.attributes.position && tris(g) >= SHADOWLOD.min); }
export function shadowLOD(renderer){ if(MOBILE || !SHADOWLOD.on) return; const sm = renderer.shadowMap, base = sm.render.bind(sm), worn = [];
  sm.render = (lights, scene, camera) => {
    let E = SH_BY.get(scene); if(!E) SH_BY.set(scene, E = { set:new Set(), n:0 });
    if(E.n++ % SHADOWLOD.rescan === 0){ E.set.clear(); scene.traverse(o => { if(o.isMesh && o.castShadow && shadowable(o)){ E.set.add(o); shadowGeo(o.geometry); } }); }
    for(const o of E.set){ const lo = o.castShadow && o.parent ? SH.get(o.geometry) : null; if(lo){ worn.push(o, o.geometry); o.geometry = lo; } }
    try{ return base(lights, scene, camera); } finally{ for(let i = 0; i < worn.length; i += 2) worn[i].geometry = worn[i + 1]; worn.length = 0; } }; }
export function shadowLODStats(scene){ const E = SH_BY.get(scene) || { set:[] }; let ready = 0, t0 = 0, t1 = 0; for(const o of E.set){ const lo = SH.get(o.geometry), n = o.isInstancedMesh ? o.count : 1; t0 += tris(o.geometry) * n; if(lo){ ready++; t1 += tris(lo) * n; } else t1 += tris(o.geometry) * n; }
  return { casters:E.set.size, ready, tris:Math.round(t0), worn:Math.round(t1) }; }
