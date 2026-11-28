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
import { ASSETDIET, GLTFLOAD } from '../../config.js';
import { S, blendIn, compileReady, renderer } from '../hub.js';

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
export const gltfLoader = () => ktx2Ok().then(ok => ok ? (_l1 || (_l1 = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(_k2).register(blobless))) : (_l0 || (_l0 = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(blobless))));
// GLTF 1 an embedded picture read straight from the file's bytes (config GLTFLOAD): three's loadImageSource made a Blob + blob: URL per picture and fetched
//   it back; a used Blob's bytes stay counted against Chrome's live-blob cap until its JS object is collected, and once the cap is full every new blob
//   fetch fails ("Couldn't load texture blob:…", the map left off). A KTX2 one: its bytes to the transcoder (no Blob); a JPEG / PNG: decoded from its bytes
//   by WebCodecs' ImageDecoder (where there is none — Safari — createImageBitmap on one Blob, no URL), once more after retryMs if it fails. Same textures
//   as three's path (all 2243 of the repo's: format, levels, size, colour space, sampling), pixels ±1 on a few bytes of a 4K JPEG; same source cache and
//   userData; a picture by URI (none in our files) still takes three's path.
const DS = { ktx2:0, img:0, retry:0, fail:0 }; DIET_STATE.blobless = DS;
function blobless(P){ const base = P.loadImageSource;
  P.loadImageSource = function(i, loader){ const d = this.json.images[i];
    if(!GLTFLOAD.on || !d || d.bufferView === undefined || this.sourceCache[i] !== undefined || !(loader === _k2 || loader.isImageBitmapLoader)) return base.call(this, i, loader);
    const k = loader === _k2, O = Object.assign({}, loader.options, { colorSpaceConversion:'none' });
    const viaBlob = b => createImageBitmap(new Blob([b], { type:d.mimeType }), O), D0 = typeof ImageDecoder !== 'undefined' && GLTFLOAD.decoder;
    const viaDec = b => { const D = new ImageDecoder({ data:b, type:d.mimeType, colorSpaceConversion:'none', premultiplyAlpha:'none' }); return D.decode().then(r => createImageBitmap(r.image, O).finally(() => { r.image.close(); D.close(); })); };
    const pic = b => (D0 ? Promise.resolve().then(() => viaDec(b)).catch(() => viaBlob(b)) : viaBlob(b)).then(bm => { const t = new THREE.Texture(bm); t.needsUpdate = true; return t; });
    const p = this.getDependency('bufferView', d.bufferView).then(b => k ? new Promise((ok, no) => _k2.parse(b.slice(0), ok, no)).then(t => (DS.ktx2++, t))
        : pic(b).catch(() => { DS.retry++; return new Promise(r => setTimeout(r, GLTFLOAD.retryMs)).then(() => pic(b)); }).then(t => (DS.img++, t)))
      .then(t => { if(d.extras && typeof d.extras === 'object') Object.assign(t.userData, d.extras); t.userData.mimeType = d.mimeType; return t; })
      .catch(e => { DS.fail++; console.error('THREE.GLTFLoader: Couldn\'t load texture', 'image ' + i + ' (' + d.mimeType + ')', e && e.message || e); throw e; });
    this.sourceCache[i] = p; return p; };
  return { name:'DIET_BLOBLESS' }; }
export function loadGLB(url){ INFL.n++; return gltfLoader().then(L => L.loadAsync(url)).then(gl => { DIET_STATE.files++; return ASSETDIET.pxFrom.some(s => url.includes(s)) || (gl.parser && (gl.parser.json.skins || []).length) ? withPx(gl) : gl; }).then(gl => { keepLean(gl, url); return lateWarm(gl); }).finally(() => { if(--INFL.n <= 0){ INFL.n = 0; const W = INFL.w.splice(0); for(const f of W) f(); } }); }
// DIET 10 the model files still on their way: a stage's countdown waits for them (ui/briefing.js beginStage, at most late.waitMs) so SPLIT's 3-2-1 compiles and uploads them
const INFL = { n:0, w:[] };
export const dietBusy = () => INFL.n > 0;
export const dietIdle = ms => INFL.n <= 0 ? Promise.resolve(true) : new Promise(res => { const t = setTimeout(() => res(false), ms); INFL.w.push(() => { clearTimeout(t); res(true); }); });
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
// DIET 10 A MODEL THAT ARRIVES MID-FIGHT IS READY BEFORE ANYONE DRAWS IT: a file that finishes loading during a fight (a missile at its first launch, a
//   near scan on approach, a loot chute, a prop) had its shaders built, linked and its maps uploaded by the first frame that drew it — 100–900 ms of link
//   waits in a city battle's first seconds. Now its loader holds it back until (a) its programs are built and linked off the scene — as a plain mesh and as
//   an instanced one: no — as itself and with the field's grading (blendIn, on a copy of the material: the same program its owner will ask for) — through SPLIT's
//   compileReady (the scene pass's target, the field's lights), at most late.linkMs; (b) its maps are on the GPU, renderer.initTexture spread at late.upMs a
//   frame, at most late.maxMs. Its owner then adds it as before; nothing is drawn half-made. Outside a fight nothing changes.
const fight = () => S.mode === 'playing' || S.mode === 'dying';
function lateWarm(gl){ const L = ASSETDIET.late; if(!L.on || typeof window === 'undefined' || !fight() || !gl || !gl.scene) return gl; DIET_STATE.late = (DIET_STATE.late || 0) + 1;
  const G = new THREE.Group(), tex = [], seen = new Set(), extra = []; gl.scene.updateMatrixWorld(true);
  gl.scene.traverse(o => { if(!o.isMesh) return; const mats = [].concat(o.material).filter(Boolean);
    for(const m of mats) for(const k of KTXK){ const t = m[k]; if(t && t.isTexture && !seen.has(t) && !renderer.properties.get(t).__webglTexture){ seen.add(t); tex.push(t); } }
    if(o.isSkinnedMesh) return; for(const m of mats){ const c = m.clone(); if(blendIn(c)) extra.push(c); }
    for(const m of extra) G.add(new THREE.Mesh(o.geometry, m)); });   // (its own variant: gl.scene itself; an instanced owner built at load time is compiled by the 3-2-1)
  return Promise.all([compileReady(gl.scene, L.linkMs), compileReady(G, L.linkMs)]).catch(() => {})
    .then(() => new Promise(res => { const t0 = performance.now(), step = () => { const s = performance.now(); while(tex.length && performance.now() - s < L.upMs){ const t = tex.shift(); try{ renderer.initTexture(t); }catch(e){} }
      if(tex.length && performance.now() - t0 < L.maxMs) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); }))
    .then(() => { for(const c of extra) c.dispose(); G.clear(); return gl; }); }
