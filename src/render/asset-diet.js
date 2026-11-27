// render/asset-diet.js — DIET 1 ONE LOADER FOR EVERY MODEL FILE: meshopt geometry always (EXT_meshopt_compression), and KTX2 maps (KHR_texture_basisu,
//   tools/asset-diet.mjs) sent to the GPU still compressed — ASTC / BC7 / ETC2, a quarter to an eighth of the RGBA8 a JPEG unpacks to. The Basis
//   transcoder is vendored (assets/lib/basis — the desktop and phone shells run offline) and proven once on a tiny file before any model asks for it;
//   if it cannot load (or ASSETDIET.ktx2 is off, or ?noktx2) the loader goes without it and every texture reads its own fallback picture, glTF's plain
//   source beside the KTX2 one. A compressed colour map carries that small picture as userData.px for the code that reads a map's pixels (a tree's
//   leaf mask, a soldier's shirt colour): texPixels(t).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ASSETDIET } from '../../config.js';
import { renderer } from '../hub.js';

let _k2 = null, _ok = null, _l1 = null, _l0 = null;
export const DIET_STATE = { ktx2:null, files:0, px:0, dropped:0, refill:0, refillMB:0, slim:0 };
// is the KTX2 reader usable here? (once: the transcoder fetched and a 4×4 test file read, within ASSETDIET.probeMs)
export function ktx2Ok(){ if(_ok) return _ok;
  if(!ASSETDIET.ktx2 || typeof window === 'undefined' || !renderer || /noktx2/.test(location.search + location.hash)) return (_ok = Promise.resolve(DIET_STATE.ktx2 = false));
  try{ _k2 = new KTX2Loader().setTranscoderPath(ASSETDIET.basis).setWorkerLimit(ASSETDIET.workers).detectSupport(renderer); }catch(e){ return (_ok = Promise.resolve(DIET_STATE.ktx2 = false)); }
  const late = new Promise(r => setTimeout(() => r(false), ASSETDIET.probeMs));
  return (_ok = Promise.race([_k2.loadAsync(ASSETDIET.basis + 'probe.ktx2').then(t => { t.dispose(); return true; }), late]).catch(e => { console.warn('[diet] KTX2 off —', e && e.message); return false; })
    .then(ok => (DIET_STATE.ktx2 = ok))); }
// a GLTF loader: the KTX2 one once proven, else the one that reads the fallback pictures (both read meshopt)
export const gltfLoader = () => ktx2Ok().then(ok => ok ? (_l1 || (_l1 = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(_k2))) : (_l0 || (_l0 = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder))));
export function loadGLB(url){ return gltfLoader().then(L => L.loadAsync(url)).then(gl => { DIET_STATE.files++; return withPx(gl); }).then(gl => { keepLean(gl, url); return gl; }); }
// each compressed colour map gets its fallback picture (decoded off the main thread, never sent to the GPU) as userData.px
function withPx(gl){ const P = gl.parser, J = P && P.json; if(!J || !(J.extensionsUsed || []).includes('KHR_texture_basisu')) return gl; const jobs = [];
  gl.scene.traverse(o => { if(!o.isMesh) return; for(const m of [].concat(o.material)){ const t = m && m.map; if(!t || !t.isCompressedTexture || t.userData.px !== undefined) continue;
    const a = P.associations.get(t), td = a && a.textures != null ? J.textures[a.textures] : null; t.userData.px = null;
    if(td && td.source != null) jobs.push(P.loadImageSource(td.source, P.textureLoader).then(x => { t.userData.px = x.image; DIET_STATE.px++; }).catch(() => {})); } });
  return Promise.all(jobs).then(() => gl); }
// what to draw on a canvas to read a map's pixels: its own picture, or a compressed one's small fallback (null when there is none)
export const texPixels = t => !t ? null : t.isCompressedTexture ? (t.userData.px || null) : t.image || null;

// DIET 4 THE PAGE KEEPS NO COPY OF WHAT THE GPU HOLDS: a KTX2 map's transcoded levels stayed in the JS heap for good (three keeps them to upload again),
//   and the loader's caches held each whole file (1.7 GB of heap in a city battle, 2.6 GB after four). Now: once a map's levels are on the GPU
//   (texture.onUpdate) its CPU copy is dropped (source.dataReady false: three keeps the storage, uploads nothing more); the parsed file's buffers are
//   let go as soon as its scene is built (keepLean), and each colour map's small fallback picture after ASSETDIET.pxHold s. A map whose GPU copy
//   is gone or was never filled (disposed by a battle that no longer drew it, a clone with its own sampling, warmed while empty) is noticed when
//   something wearing it is about to be drawn and filled again from its file (refill: fetched again — the browser's cache — and transcoded), one
//   or two frames late; renderer.initTexture (the warm-up queue) skips an empty one rather than send nothing.
const FILLED = new WeakSet(), KTXK = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap'], FILES = new Map();
function onUp(t){ const m0 = t.mipmaps && t.mipmaps[0]; if(!m0 || !m0.data || !ASSETDIET.drop) return; const p = renderer.properties.get(t); if(p.__webglTexture) FILLED.add(p.__webglTexture);
  for(const m of t.mipmaps) m.data = null; t.source.dataReady = false; DIET_STATE.dropped++; }
function keepLean(gl, url){ const P = gl.parser, J = P && P.json; if(!J) return;
  gl.scene.traverse(o => { if(!o.isMesh) return; for(const m of [].concat(o.material)){ if(!m) continue; for(const k of KTXK){ const t = m[k]; if(!t || !t.isCompressedTexture || t.source.diet) continue;
    const a = P.associations.get(t), td = a && a.textures != null ? J.textures[a.textures] : null, e = td && td.extensions && td.extensions.KHR_texture_basisu;
    if(e){ t.source.diet = { url, img:e.source, busy:false }; t.onUpdate = onUp; } if(t.userData.px) setTimeout(() => { const b = t.userData.px; t.userData.px = null; if(b && b.close) b.close(); }, ASSETDIET.pxHold * 1000); } } });
  if(!ASSETDIET.drop) return; try{ P.cache.removeAll(); }catch(e){} P.sourceCache = {}; P.textureCache = {}; const B = P.extensions && P.extensions.KHR_binary_glTF; if(B){ B.body = null; B.content = null; } DIET_STATE.slim++; }
const needs = t => t.isCompressedTexture && t.source.diet && !t.source.dataReady && !FILLED.has(renderer.properties.get(t).__webglTexture);
function fileOf(url){ let f = FILES.get(url); if(!f){ f = fetch(url).then(r => r.arrayBuffer()).then(b => { const jl = new DataView(b).getUint32(12, true); return new Blob([new Uint8Array(b, 20, jl)]).text().then(t => ({ J:JSON.parse(t), bin:b.slice(28 + jl) })); });
  FILES.set(url, f); setTimeout(() => FILES.delete(url), 4000); } return f; }   // (the maps of one file asked for together share one fetch)
function refill(t){ const D = t.source.diet; if(D.busy || !_k2) return; D.busy = true;
  fileOf(D.url).then(({ J, bin }) => { const v = J.bufferViews[J.images[D.img].bufferView]; return new Promise((ok, no) => _k2.parse(bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), ok, no)); })
    .then(n => { const L = t.mipmaps; if(n.mipmaps.length === L.length && n.mipmaps.every((m, i) => m.width === L[i].width && m.height === L[i].height)) L.forEach((m, i) => { m.data = n.mipmaps[i].data; DIET_STATE.refillMB += m.data.byteLength / 1048576; });
      else t.mipmaps = n.mipmaps; n.mipmaps = []; n.dispose(); t.source.dataReady = true; if(t.onUpdate !== onUp) t.onUpdate = onUp; t.dispose(); t.needsUpdate = true; DIET_STATE.refill++; })
    .catch(e => console.warn('[diet] refill', D.url, e && e.message)).finally(() => { D.busy = false; }); }
if(typeof window !== 'undefined' && renderer){ const base = THREE.Mesh.prototype.onBeforeRender;
  THREE.Mesh.prototype.onBeforeRender = function(r, sc, cam, geo, mat, grp){ if(mat) for(const k of KTXK){ const t = mat[k]; if(t && t.isCompressedTexture && t.source.diet){ if(t.onUpdate !== onUp) t.onUpdate = onUp; if(needs(t)) refill(t); } } return base.call(this, r, sc, cam, geo, mat, grp); };
  const init = renderer.initTexture.bind(renderer); renderer.initTexture = t => { if(t && t.isCompressedTexture && t.source.diet && !t.source.dataReady) return; return init(t); }; }
// (tests) the worn KTX2 maps now drawn empty, waiting for their refill, and the CPU copies still held by worn maps (MB)
export function dietCheck(scene){ const seen = new Set(); let empty = 0, held = 0; const L = [];
  scene.traverse(o => { if(!o.isMesh) return; for(const m of [].concat(o.material)){ if(!m) continue; for(const k of KTXK){ const t = m[k]; if(!t || !t.isCompressedTexture || seen.has(t)) continue; seen.add(t);
    if(t.source.diet && !t.source.dataReady && !FILLED.has(renderer.properties.get(t).__webglTexture)){ empty++; if(L.length < 6) L.push(t.source.diet.url.split('/').slice(-2).join('/') + ':' + k); }
    if(t.mipmaps) for(const q of t.mipmaps) if(q.data) held += q.data.byteLength; } } });
  return { worn:seen.size, empty, heldMB:Math.round(held / 1048576), sample:L }; }
