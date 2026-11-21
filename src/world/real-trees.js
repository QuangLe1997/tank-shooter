// world/real-trees.js — Z262 REAL TREES: thirteen Meshy-generated species (oak, linden, birch, poplar, Scots pine, snowy spruce, coconut palm,
// umbrella acacia, baobab, burnt dead tree, cypress, olive, an ancient giant) take the place of the procedural trees. Each battlefield maps its
// procedural kinds to a mix of real species (a meadow's broadleaves become oaks, lindens, birches and poplars; a citadel's become olives and
// cypresses…), every tree keeps its own scale, turn, lean and tint, and each species stands at its true height. The wind is in the vertex shader:
// the whole tree bends from the root (more toward the top and the outer limbs) under slow gusts that roll across the field, and the leaves — found
// by reading the model's own texture: green (or snow) is foliage, brown / grey is wood — flutter on top of that, the trunk does not. Until the files
// load, or if they fail, the procedural trees stay.
import * as THREE from 'three';
import { NEARDETAIL, REALTREE } from '../../config.js';
import { BIOME, FLORA, SUN_VIEW, WTIME, crushables, loadGLTF, NEAR_DETAIL, nearFrame, nearModel } from '../hub.js';

const SP = {}, GEO = {}, EXTRA = new Set(); let _p = null;
const U = { wDir:{ value:new THREE.Vector2(REALTREE.wind.dir[0], REALTREE.wind.dir[1]).normalize() }, wAmp:{ value:REALTREE.wind.sway }, wLeaf:{ value:REALTREE.wind.leaf } };

export function loadRealTrees(){ if(_p) return _p; if(typeof window === 'undefined' || /proctree/.test(location.search + location.hash)) return (_p = Promise.resolve(false));
  return (_p = Promise.all(Object.keys(REALTREE.h).map(k => loadGLTF('tree_' + k).then(gl => [k, gl]))).then(L => {
    for(const [k, gl] of L){ if(!gl) continue; try{ SP[k] = prepTree(gl, k); } catch(e){ console.warn('[trees]', k, e.message); } }
    for(const im of FLORA.meshes) dressTrees(im); for(const im of EXTRA) dressTrees(im); EXTRA.clear(); return true; })); }
// a tree mesh planted outside the flora (the city's street trees, palms): dressed now if the species are in, else as soon as they are
export function trackTrees(im){ if(Object.keys(SP).length) dressTrees(im); else { EXTRA.add(im); loadRealTrees(); } return im; }

// read the texture once (small) to tell leaf from wood at each vertex's uv
function sampler(map){ const img = map && map.image; if(!img || !img.width) return null; const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const x = cv.getContext('2d', { willReadFrequently:true }); x.drawImage(img, 0, 0, N, N); const d = x.getImageData(0, 0, N, N).data;
  return (u, v) => { const px = Math.min(N - 1, Math.max(0, Math.floor((u - Math.floor(u)) * N))), py = Math.min(N - 1, Math.max(0, Math.floor((1 - (v - Math.floor(v))) * N))), i = (py * N + px) * 4; return [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]; }; }
function prepTree(gl, k, geoOnly){ let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; });
  const g = src.geometry.clone().applyMatrix4(src.matrixWorld); g.computeBoundingBox(); const b = g.boundingBox, H = b.max.y - b.min.y, P = g.attributes.position;
  let bx = 0, bz = 0, n = 0; for(let i = 0; i < P.count; i++) if(P.getY(i) < b.min.y + H * 0.04){ bx += P.getX(i); bz += P.getZ(i); n++; }   // the trunk's foot
  if(n){ bx /= n; bz /= n; } else { bx = (b.min.x + b.max.x) / 2; bz = (b.min.z + b.max.z) / 2; }
  g.translate(-bx, -b.min.y, -bz); g.scale(1 / H, 1 / H, 1 / H); g.computeBoundingBox(); g.computeBoundingSphere();
  const UV = g.attributes.uv, smp = sampler(src.material.map), flex = new Float32Array(P.count), leaf = new Float32Array(P.count), snowy = /snow/.test(k);
  let R = 0; for(let i = 0; i < P.count; i++) R = Math.max(R, Math.hypot(P.getX(i), P.getZ(i)));
  for(let i = 0; i < P.count; i++){ const y = P.getY(i), r = Math.hypot(P.getX(i), P.getZ(i)) / (R || 1);
    flex[i] = Math.pow(Math.max(0, y), 1.6) * (0.55 + 0.45 * Math.min(1, r * 2));
    let lf; if(smp && UV){ const [cr, cg, cb] = smp(UV.getX(i), UV.getY(i)), green = cg - Math.max(cr, cb) * 0.92, white = Math.min(cr, cg, cb);
      lf = Math.min(1, Math.max(0, green * 9 + (snowy && white > 0.6 ? 0.5 : 0))); }
    else lf = y > 0.35 && r > 0.15 ? 1 : 0;
    leaf[i] = lf * Math.min(1, y * 3); }
  g.setAttribute('aFlex', new THREE.BufferAttribute(flex, 1)); g.setAttribute('aLeaf', new THREE.BufferAttribute(leaf, 1));
  if(geoOnly) return { geo:g };   // (Z395 the whole tree for up close: the shipped one's material is used)
  const m = src.material.clone(); m.side = THREE.DoubleSide; m.envMapIntensity = REALTREE.env; m.roughness = Math.max(m.roughness, 0.8);
  if(REALTREE.tint[k]) m.color.setRGB(...REALTREE.tint[k]); windify(m);
  return { geo:g, mat:m, leafy:k !== 'dead' && k !== 'baobab' }; }

// the wind: the tree bends from its root (gusts rolling across the field, world-space, the same for every tree), the leaves flutter on top
function windify(m){ m.onBeforeCompile = sh => { sh.uniforms.wT = WTIME; Object.assign(sh.uniforms, U); sh.uniforms.uSunView = SUN_VIEW; sh.uniforms.uTrans = { value:REALTREE.trans };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunView; uniform float uTrans; varying float vLeaf;')
      .replace('#include <opaque_fragment>', 'float trL = pow(clamp(dot(normalize(vViewPosition), uSunView), 0.0, 1.0), 4.0) * vLeaf;   // Z276 a leaf with the sun behind it glows through\n outgoingLight += diffuseColor.rgb * vec3(1.0, 0.92, 0.55) * trL * uTrans;\n#include <opaque_fragment>');
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float wT, wAmp, wLeaf; uniform vec2 wDir; attribute float aFlex; attribute float aLeaf; attribute float aHide; varying float vLeaf;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec4 tp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); mat3 tIm = mat3(instanceMatrix);
      #else
      vec4 tp = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0); mat3 tIm = mat3(modelMatrix);
      #endif
      float ph = tp.x * 0.061 + tp.z * 0.047, gust = 0.55 * sin(wT * 0.8 - ph) + 0.3 * sin(wT * 1.9 - ph * 1.7) + 0.25 * sin(wT * 0.31 - ph * 0.4);
      vec3 wb = vec3(wDir.x, 0.0, wDir.y) * (0.45 + 0.55 * gust) * wAmp * aFlex;   // metres, world space
      vec3 lb = transpose(tIm) * wb; lb /= vec3(dot(tIm[0], tIm[0]), dot(tIm[1], tIm[1]), dot(tIm[2], tIm[2]));
      vLeaf = aLeaf;
      transformed += lb + vec3(sin(wT * 6.3 + position.y * 31.0 + ph * 7.0), sin(wT * 7.7 + position.x * 29.0), sin(wT * 5.9 + position.z * 33.0)) * wLeaf * aLeaf * (0.6 + 0.4 * gust);
      if(aHide > 0.5) transformed = vec3(0.0);   // (Z395 drawn whole by its near copy)`); };
  m.customProgramCacheKey = () => 'realTree'; }

// a flora InstancedMesh planted as procedural tree kind `tk`, variant vi: give it the real species this battlefield maps it to
export function dressTrees(im){ const T = im.userData.tree; if(!T || T.real) return; const map = (REALTREE.map[BIOME.name] || {})[T.tk] || REALTREE.map._[T.tk]; if(!map) return;
  const k = map[T.vi % map.length], S = SP[k]; if(!S) return; const key = k + ':' + T.sMid.toFixed(2);
  if(!GEO[key]){ const g = S.geo.clone(), h = REALTREE.h[k] / T.sMid; g.scale(h, h, h); g.computeBoundingBox(); g.computeBoundingSphere(); GEO[key] = g; }
  im.geometry = ownGeo(GEO[key], im.instanceMatrix.count); im.material = S.mat; im.computeBoundingSphere(); T.real = k; T.h = REALTREE.h[k] / T.sMid; NT.ims.add(im);
  if(!S.leafy) for(const c of crushables) if(c.im === im) c.leafy = false; }

// Z395 THE NEAR TREES: the shipped trees were simplified to about 40 % of their triangles, and up close a canopy of leaf cards collapses into spiky
//   shards. The few standing nearest the camera (NEARDETAIL.trees: n within at m) are drawn whole from the original (hd/tree_<k>.glb through
//   render/near-detail.js nearModel): one more instanced mesh beside each tree mesh, wearing the same material (wind, sun through the leaves, the
//   sharp maps), holding copies of just those trees' matrices, refreshed every frame so a felled tree's copy falls with it. The shipped mesh hides
//   them in its vertex shader by its own per-instance aHide — its matrices, which felling and collisions read and write, are never touched. The near
//   copy casts no shadow: the shipped tree's still does.
const NT = { ims:new Set(), hd:{}, t:0 }, _mt = new THREE.Matrix4(), _tv = new THREE.Vector3(), _tc = new THREE.Vector3();
// a tree mesh's own geometry: the species' (shared buffers, nothing copied) plus its own aHide, one per instance
function ownGeo(src, n){ const g = new THREE.BufferGeometry(); for(const [a, v] of Object.entries(src.attributes)) g.setAttribute(a, v); g.setIndex(src.index);
  g.boundingBox = src.boundingBox; g.boundingSphere = src.boundingSphere; g.setAttribute('aHide', new THREE.InstancedBufferAttribute(new Float32Array(n), 1)); return g; }
// the whole tree of a species at a size (null while it loads, or when there is none)
function nearGeo(k, h){ const id = k + ':' + h.toFixed(3); if(id in NT.hd) return NT.hd[id]; NT.hd[id] = null;
  nearModel('tree_' + k).then(gl => { if(!gl) return; const g = prepTree(gl, k, true).geo; g.scale(h, h, h); g.computeBoundingBox(); g.computeBoundingSphere(); NT.hd[id] = g; }); return null; }
function pick(im, P, hd){ const H = im.geometry.attributes.aHide; let N = im.userData.nearTrees; if(!H) return;
  if(N) for(const i of N.idx) H.array[i] = 0;
  if(P.length && !N){ const C = NEARDETAIL.trees, nim = new THREE.InstancedMesh(ownGeo(hd, C.n), im.material, C.n); nim.castShadow = false; nim.receiveShadow = im.receiveShadow;
    nim.frustumCulled = false; nim.layers.mask = im.layers.mask; nim.renderOrder = im.renderOrder; nim.position.copy(im.position); nim.quaternion.copy(im.quaternion); nim.scale.copy(im.scale);
    nim.name = 'nearTrees'; im.parent.add(nim); N = im.userData.nearTrees = { nim, idx:[] }; }
  if(!N) return; N.idx = P; for(const i of P) H.array[i] = 1; H.needsUpdate = true; N.nim.count = P.length; N.nim.visible = P.length > 0; copyNear(im, N); }
function copyNear(im, N){ for(let j = 0; j < N.idx.length; j++){ im.getMatrixAt(N.idx[j], _mt); N.nim.setMatrixAt(j, _mt); } N.nim.instanceMatrix.needsUpdate = true; N.nim.material = im.material; }
function drop(im){ const N = im.userData.nearTrees; if(N){ N.nim.parent && N.nim.parent.remove(N.nim); N.nim.dispose(); delete im.userData.nearTrees; } NT.ims.delete(im); }
nearFrame(cam => { if(!NT.ims.size) return; const C = NEARDETAIL.trees, now = performance.now();
  for(const im of NT.ims){ const N = im.userData.nearTrees; if(N && N.idx.length) copyNear(im, N); }   // (every frame: a falling tree's copy falls with it)
  if(now - NT.t < C.every * 1000) return; NT.t = now; _tc.setFromMatrixPosition(cam.matrixWorld); const cand = [];
  for(const im of NT.ims){ if(!im.parent){ drop(im); continue; } const r = im.geometry.boundingSphere ? im.geometry.boundingSphere.radius : 5;
    for(let i = 0; i < im.count; i++){ im.getMatrixAt(i, _mt); const e = _mt.elements, s = Math.hypot(e[0], e[1], e[2]); if(s < 1e-4) continue;
      const d = _tv.setFromMatrixPosition(_mt).applyMatrix4(im.matrixWorld).distanceTo(_tc) - r * s * 0.5; if(d < C.at && !NEAR_DETAIL.off) cand.push([d, im, i]); } }   // (off: the before / after toggle)
  cand.sort((a, b) => a[0] - b[0]); const by = new Map(); for(const [, im, i] of cand.slice(0, C.n)){ if(!by.has(im)) by.set(im, []); by.get(im).push(i); }
  for(const im of NT.ims){ const P = by.get(im) || [], T = im.userData.tree, hd = P.length && T && T.real ? nearGeo(T.real, T.h) : null;
    if(hd || im.userData.nearTrees) pick(im, hd ? P : [], hd); } });
