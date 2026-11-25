// render/inst-view.js — VIEW 1 AN INSTANCED MESH SPREAD OVER THE WHOLE FIELD DRAWS ONLY WHAT IS NEAR. One InstancedMesh of 2000 stones, 170 scanned bushes
//   or 300 wall sections has ONE bounding sphere — the whole battlefield — so three can never cull it: every instance, 300 m off or behind the camera, was
//   drawn in full detail every frame, and again in the shadow pass (measured in a desert battle: 4 such families were 4.1 of the 7.4 million triangles).
//   Here such a mesh (found by a scan: static, many triangles, spread wide — INSTVIEW) keeps living exactly as before for the game — its matrices,
//   colours, count, geometry and material stay the truth, whoever crushes a bush or swaps a tree's model still writes to it — but it draws NOTHING itself
//   (its count reads 0 while the renderer is drawing). Beside it stand two views that copy from it:
//     near — the instances within dLite of the soldier, the mesh's own geometry, its shadows;
//     far  — those between dLite and dHide in a simplified copy (render/far-lod.js farGeo; the whole geometry until that is ready), no shadows;
//   and past dHide (small things only: a stone is a few pixels there) nothing. Distances come from the thing's size (a wall is never hidden, a stone
//   is), and stretch when the camera pulls back. A view is rebuilt when the soldier has moved INSTVIEW.step m or the source changed — a few a frame.
import * as THREE from 'three';
import { INSTVIEW } from '../../config.js';
import { MOBILE, S, camera, farGeo, renderer, scene } from '../hub.js';

const C = INSTVIEW, RECS = new Map(), _m = new THREE.Matrix4(), _v = new THREE.Vector3();
let DRAW = 0, _scanT = 0, _was = '';
const trisOf = g => (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3;
const instNames = g => Object.keys(g.attributes).filter(k => g.attributes[k].isInstancedBufferAttribute);
const cutout = im => (Array.isArray(im.material) ? im.material : [im.material]).some(m => m && (m.alphaTest > 0 || m.transparent));

// while the renderer draws the game's scene the wrapped sources report no instances (three skips a draw of 0); everywhere else they read as they are
if(renderer && renderer.render){ const base = renderer.render;
  renderer.render = function(sc, cam){ if(sc !== scene || !RECS.size) return base.call(this, sc, cam); DRAW++; try{ return base.call(this, sc, cam); } finally{ DRAW--; } }; }

function eligible(o){ if(!o.isInstancedMesh || RECS.has(o) || o.isSkinnedMesh) return false; const u = o.userData; if(u.viewOf || u.noView || u.skyline || u.forest) return false;
  if(o.instanceMatrix.usage !== THREE.StaticDrawUsage || o.count < C.minN || !o.parent) return false;
  const g = o.geometry; if(!g || !g.attributes.position || trisOf(g) * o.count < C.minTris) return false;
  for(const k of instNames(g)) if(g.attributes[k].usage !== THREE.StaticDrawUsage) return false;   // a per-instance attribute rewritten as it goes: left alone
  for(let p = o; p; p = p.parent){ if(!p.visible) return false; if(p === scene) break; if(!p.parent) return false; }
  if(!o.boundingSphere) o.computeBoundingSphere(); return o.boundingSphere.radius >= C.minSpread; }

// a view's geometry: the source's own when it has no per-instance attribute; else a twin sharing every vertex attribute, with its own per-instance ones
function viewGeo(src, names, cap){ if(!names.length) return src; const g = new THREE.BufferGeometry();
  for(const k in src.attributes){ const a = src.attributes[k]; g.setAttribute(k, a.isInstancedBufferAttribute ? new THREE.InstancedBufferAttribute(new a.array.constructor(cap * a.itemSize), a.itemSize, a.normalized, a.meshPerAttribute).setUsage(THREE.DynamicDrawUsage) : a); }
  g.setIndex(src.index); for(const q of src.groups) g.addGroup(q.start, q.count, q.materialIndex); g.boundingBox = src.boundingBox; g.boundingSphere = src.boundingSphere; return g; }

function wrap(im){ const g = im.geometry, names = instNames(g), cap = im.instanceMatrix.count, n = trisOf(g); if(!g.boundingSphere) g.computeBoundingSphere();
  let sc = 0, k = 0; for(let i = 0; i < im.count && k < 8; i += Math.max(1, (im.count / 8) | 0)){ im.getMatrixAt(i, _m); const s = _v.setFromMatrixColumn(_m, 0).length(); if(s > 1e-4){ sc += s; k++; } }
  const r = g.boundingSphere.radius * (k ? sc / k : 1); if(!(r > 0) || r > C.maxR){ im.userData.noView = true; return; }   // (a ridge, a backdrop piece: tuned where it is made)
  const hide = r * C.hideK < C.never ? Math.max(C.hideMin, r * C.hideK) : Infinity, lite = !MOBILE && n >= C.liteMinTris;
  const shade = !!im.castShadow && !MOBILE;   // VIEW 2 a shadow caster gains even with no light copy and never hidden: only its near instances go into the shadow pass
  if(!lite && !shade && hide === Infinity){ im.userData.noView = true; return; }   // nothing to gain
  const dLite = lite || shade ? Math.min(hide, Math.min(C.liteMax, Math.max(C.liteMin, r * C.liteK))) : hide;
  const G = new THREE.Group(); G.name = 'instView'; G.position.copy(im.position); G.quaternion.copy(im.quaternion); G.scale.copy(im.scale);
  const mk = (geo, shadow) => { const v = new THREE.InstancedMesh(viewGeo(geo, names, cap), im.material, cap); v.instanceMatrix.setUsage(THREE.DynamicDrawUsage); v.count = 0; v.visible = false; v.frustumCulled = false;
    v.castShadow = shadow && im.castShadow; v.receiveShadow = im.receiveShadow; v.renderOrder = im.renderOrder; v.layers.mask = im.layers.mask; v.raycast = () => {};   // (rays still find the source, with the source's instance ids)
    if(im.customDepthMaterial) v.customDepthMaterial = im.customDepthMaterial; if(im.customDistanceMaterial) v.customDistanceMaterial = im.customDistanceMaterial;
    if(im.instanceColor) v.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    v.userData.viewOf = im; G.add(v); return v; };
  const R = { im, G, geo:g, mat:im.material, cap, names, hasCol:!!im.instanceColor, dLite, dHide:hide, near:mk(g, true), far:null, pos:null, sig:-1, cx:1e9, cz:1e9, k:1, dirty:true, count:im.count, off:null };
  if((lite || shade) && dLite < hide){ R.far = mk(g, false); if(lite)   // the far view wears the whole geometry until its light copy is ready (or for good: a packed scan, a tree of loose leaves)
    farGeo(g, cutout(im) ? C.keepCut : C.keep).then(lo => { if(RECS.get(im) !== R || im.geometry !== g) return; if(lo){ R.far.geometry = viewGeo(lo, names, cap); R.dirty = true; }
      else if(hide === Infinity && !shade){ unwrap(R); im.userData.noView = true; } }); }   // (it would not simplify, is never hidden and casts no shadow: nothing to gain, it draws itself again)
  Object.defineProperty(im, 'count', { configurable:true, enumerable:true, get(){ return DRAW ? 0 : R.count; }, set(x){ R.count = x; } });
  R.off = () => unwrap(R); im.addEventListener('removed', R.off); im.parent.add(G); RECS.set(im, R); }

function unwrap(R){ const im = R.im; if(RECS.get(im) !== R) return; RECS.delete(im); im.removeEventListener('removed', R.off);
  Object.defineProperty(im, 'count', { value:R.count, writable:true, configurable:true, enumerable:true }); R.G.removeFromParent();
  for(const v of [R.near, R.far]) if(v) v.dispose(); }   // (their matrices and colours leave the GPU; a twin geometry shares the source's vertex buffers and is left to the collector)

const sigOf = (im, R) => { let s = im.instanceMatrix.version * 7 + R.count * 13 + (im.instanceColor ? im.instanceColor.version * 3 : 0); for(const k of R.names) s += im.geometry.attributes[k].version * 5; return s; };
// where each instance stands (world x, z)
function positions(R){ const im = R.im, N = R.count, A = im.instanceMatrix.array; if(!R.pos || R.pos.length < N * 2) R.pos = new Float32Array(Math.max(N, R.cap) * 2); im.updateWorldMatrix(true, false); const E = im.matrixWorld.elements, P = R.pos;
  for(let i = 0; i < N; i++){ const o = i * 16, x = A[o + 12], y = A[o + 13], z = A[o + 14]; P[i * 2] = E[0] * x + E[4] * y + E[8] * z + E[12]; P[i * 2 + 1] = E[2] * x + E[6] * y + E[10] * z + E[14]; } }

function rebuild(R, px, pz, k){ const im = R.im, N = R.count, A = im.instanceMatrix.array, CA = R.hasCol ? im.instanceColor.array : null, P = R.pos, GA = im.geometry.attributes, near = R.near, far = R.far;
  const dl = R.dLite * k, d2l = dl * dl, d2h = R.dHide === Infinity ? Infinity : R.dHide * R.dHide * k * k; let a = 0, b = 0;
  for(let i = 0; i < N; i++){ const dx = P[i * 2] - px, dz = P[i * 2 + 1] - pz, d2 = dx * dx + dz * dz; let V, j;
    if(d2 < d2l){ V = near; j = a++; } else if(far && d2 < d2h){ V = far; j = b++; } else continue;
    const T = V.instanceMatrix.array, o = i * 16, t = j * 16; for(let q = 0; q < 16; q++) T[t + q] = A[o + q];
    if(CA){ const TC = V.instanceColor.array; TC[j * 3] = CA[i * 3]; TC[j * 3 + 1] = CA[i * 3 + 1]; TC[j * 3 + 2] = CA[i * 3 + 2]; }
    for(let q = 0; q < R.names.length; q++){ const s = GA[R.names[q]], d = V.geometry.attributes[R.names[q]], w = s.itemSize; for(let e = 0; e < w; e++) d.array[j * w + e] = s.array[i * w + e]; } }
  for(const V of [near, far]){ if(!V) continue; const n = V === near ? a : b; V.count = n; V.visible = n > 0; if(!n) continue; V.instanceMatrix.needsUpdate = true; if(CA) V.instanceColor.needsUpdate = true;
    for(let q = 0; q < R.names.length; q++) V.geometry.attributes[R.names[q]].needsUpdate = true; }
  R.cx = px; R.cz = pz; R.k = k; R.dirty = false; }

// every frame (game/loop.js): find new field-wide meshes now and then, follow the soldier
export function updateInstViews(){ if(!C.on){ if(RECS.size) for(const R of [...RECS.values()]) unwrap(R); return; } const now = performance.now() / 1000;   // (INSTVIEW.on switched off while playing: every source draws itself again)
  if(now > _scanT || (S.mode === 'playing' && _was !== 'playing')){ _scanT = now + C.scan; scene.traverse(o => { if(eligible(o)) wrap(o); }); } _was = S.mode;
  if(!RECS.size) return; const pl = S.player && S.player.pos, px = pl ? pl.x : camera.position.x, pz = pl ? pl.z : camera.position.z;
  const k = pl ? Math.min(C.maxK, Math.max(1, Math.hypot(camera.position.x - px, camera.position.y - (pl.y || 0), camera.position.z - pz) / C.ref)) : 1; let budget = C.perFrame;
  for(const R of RECS.values()){ const im = R.im;
    if(!im.parent || im.geometry !== R.geo || im.material !== R.mat || !!im.instanceColor !== R.hasCol || im.instanceMatrix.count !== R.cap){ unwrap(R); continue; }   // (changed under us: wrapped anew at the next scan)
    R.G.visible = im.visible; const s = sigOf(im, R);
    if(s !== R.sig){ R.sig = s; positions(R); R.dirty = true; }
    else if(!R.dirty){ const dx = px - R.cx, dz = pz - R.cz; if(dx * dx + dz * dz > C.step * C.step || Math.abs(k - R.k) > C.kStep) R.dirty = true; }
    if(R.dirty && budget > 0){ budget--; rebuild(R, px, pz, k); } } }
// what the views save right now (tools/ts.mjs probes, the perf HUD)
export function instViewSwitch(on){ C.on = !!on; _scanT = 0; }   // (tests: compare both ways in one battle)
export function instViewStats(){ let src = 0, drawn = 0, n = 0; for(const R of RECS.values()){ const t = trisOf(R.geo); src += t * R.count; drawn += trisOf(R.near.geometry) * R.near.count + (R.far ? trisOf(R.far.geometry) * R.far.count : 0); n++; }
  return { meshes:n, tris:Math.round(src), drawn:Math.round(drawn) }; }
