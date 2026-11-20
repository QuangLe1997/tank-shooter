// world/real-trees.js — Z262 REAL TREES: thirteen Meshy-generated species (oak, linden, birch, poplar, Scots pine, snowy spruce, coconut palm,
// umbrella acacia, baobab, burnt dead tree, cypress, olive, an ancient giant) take the place of the procedural trees. Each battlefield maps its
// procedural kinds to a mix of real species (a meadow's broadleaves become oaks, lindens, birches and poplars; a citadel's become olives and
// cypresses…), every tree keeps its own scale, turn, lean and tint, and each species stands at its true height. The wind is in the vertex shader:
// the whole tree bends from the root (more toward the top and the outer limbs) under slow gusts that roll across the field, and the leaves — found
// by reading the model's own texture: green (or snow) is foliage, brown / grey is wood — flutter on top of that, the trunk does not. Until the files
// load, or if they fail, the procedural trees stay.
import * as THREE from 'three';
import { REALTREE } from '../../config.js';
import { BIOME, FLORA, WTIME, crushables, loadGLTF } from '../hub.js';

const SP = {}, GEO = {}, EXTRA = new Set(); let _p = null;
const U = { wDir:{ value:new THREE.Vector2(REALTREE.wind.dir[0], REALTREE.wind.dir[1]).normalize() }, wAmp:{ value:REALTREE.wind.sway }, wLeaf:{ value:REALTREE.wind.leaf } };
export const REAL_TREES = SP;

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
function prepTree(gl, k){ let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; });
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
  const m = src.material.clone(); m.side = THREE.DoubleSide; m.envMapIntensity = REALTREE.env; m.roughness = Math.max(m.roughness, 0.8);
  if(REALTREE.tint[k]) m.color.setRGB(...REALTREE.tint[k]); windify(m);
  return { geo:g, mat:m, leafy:k !== 'dead' && k !== 'baobab' }; }

// the wind: the tree bends from its root (gusts rolling across the field, world-space, the same for every tree), the leaves flutter on top
function windify(m){ m.onBeforeCompile = sh => { sh.uniforms.wT = WTIME; Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float wT, wAmp, wLeaf; uniform vec2 wDir; attribute float aFlex; attribute float aLeaf;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec4 tp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); mat3 tIm = mat3(instanceMatrix);
      #else
      vec4 tp = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0); mat3 tIm = mat3(modelMatrix);
      #endif
      float ph = tp.x * 0.061 + tp.z * 0.047, gust = 0.55 * sin(wT * 0.8 - ph) + 0.3 * sin(wT * 1.9 - ph * 1.7) + 0.25 * sin(wT * 0.31 - ph * 0.4);
      vec3 wb = vec3(wDir.x, 0.0, wDir.y) * (0.45 + 0.55 * gust) * wAmp * aFlex;   // metres, world space
      vec3 lb = transpose(tIm) * wb; lb /= vec3(dot(tIm[0], tIm[0]), dot(tIm[1], tIm[1]), dot(tIm[2], tIm[2]));
      transformed += lb + vec3(sin(wT * 6.3 + position.y * 31.0 + ph * 7.0), sin(wT * 7.7 + position.x * 29.0), sin(wT * 5.9 + position.z * 33.0)) * wLeaf * aLeaf * (0.6 + 0.4 * gust);`); };
  m.customProgramCacheKey = () => 'realTree'; }

// a flora InstancedMesh planted as procedural tree kind `tk`, variant vi: give it the real species this battlefield maps it to
export function dressTrees(im){ const T = im.userData.tree; if(!T || T.real) return; const map = (REALTREE.map[BIOME.name] || {})[T.tk] || REALTREE.map._[T.tk]; if(!map) return;
  const k = map[T.vi % map.length], S = SP[k]; if(!S) return; const key = k + ':' + T.sMid.toFixed(2);
  if(!GEO[key]){ const g = S.geo.clone(), h = REALTREE.h[k] / T.sMid; g.scale(h, h, h); g.computeBoundingBox(); g.computeBoundingSphere(); GEO[key] = g; }
  im.geometry = GEO[key]; im.material = S.mat; im.computeBoundingSphere(); T.real = k;
  if(!S.leafy) for(const c of crushables) if(c.im === im) c.leafy = false; }
export function realTreesReady(){ return !!_p && Object.keys(SP).length > 0; }
