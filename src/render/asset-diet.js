// render/asset-diet.js — DIET 1 ONE LOADER FOR EVERY MODEL FILE: meshopt geometry always (EXT_meshopt_compression), and KTX2 maps (KHR_texture_basisu,
//   tools/asset-diet.mjs) sent to the GPU still compressed — ASTC / BC7 / ETC2, a quarter to an eighth of the RGBA8 a JPEG unpacks to. The Basis
//   transcoder is vendored (assets/lib/basis — the desktop and phone shells run offline) and proven once on a tiny file before any model asks for it;
//   if it cannot load (or ASSETDIET.ktx2 is off, or ?noktx2) the loader goes without it and every texture reads its own fallback picture, glTF's plain
//   source beside the KTX2 one. A compressed colour map carries that small picture as userData.px for the code that reads a map's pixels (a tree's
//   leaf mask, a soldier's shirt colour): texPixels(t).
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ASSETDIET } from '../../config.js';
import { renderer } from '../hub.js';

let _k2 = null, _ok = null, _l1 = null, _l0 = null;
export const DIET_STATE = { ktx2:null, files:0, px:0 };
// is the KTX2 reader usable here? (once: the transcoder fetched and a 4×4 test file read, within ASSETDIET.probeMs)
export function ktx2Ok(){ if(_ok) return _ok;
  if(!ASSETDIET.ktx2 || typeof window === 'undefined' || !renderer || /noktx2/.test(location.search + location.hash)) return (_ok = Promise.resolve(DIET_STATE.ktx2 = false));
  try{ _k2 = new KTX2Loader().setTranscoderPath(ASSETDIET.basis).setWorkerLimit(ASSETDIET.workers).detectSupport(renderer); }catch(e){ return (_ok = Promise.resolve(DIET_STATE.ktx2 = false)); }
  const late = new Promise(r => setTimeout(() => r(false), ASSETDIET.probeMs));
  return (_ok = Promise.race([_k2.loadAsync(ASSETDIET.basis + 'probe.ktx2').then(t => { t.dispose(); return true; }), late]).catch(e => { console.warn('[diet] KTX2 off —', e && e.message); return false; })
    .then(ok => (DIET_STATE.ktx2 = ok))); }
// a GLTF loader: the KTX2 one once proven, else the one that reads the fallback pictures (both read meshopt)
export const gltfLoader = () => ktx2Ok().then(ok => ok ? (_l1 || (_l1 = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(_k2))) : (_l0 || (_l0 = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder))));
export function loadGLB(url){ return gltfLoader().then(L => L.loadAsync(url)).then(gl => { DIET_STATE.files++; return withPx(gl); }); }
// each compressed colour map gets its fallback picture (decoded off the main thread, never sent to the GPU) as userData.px
function withPx(gl){ const P = gl.parser, J = P && P.json; if(!J || !(J.extensionsUsed || []).includes('KHR_texture_basisu')) return gl; const jobs = [];
  gl.scene.traverse(o => { if(!o.isMesh) return; for(const m of [].concat(o.material)){ const t = m && m.map; if(!t || !t.isCompressedTexture || t.userData.px !== undefined) continue;
    const a = P.associations.get(t), td = a && a.textures != null ? J.textures[a.textures] : null; t.userData.px = null;
    if(td && td.source != null) jobs.push(P.loadImageSource(td.source, P.textureLoader).then(x => { t.userData.px = x.image; DIET_STATE.px++; }).catch(() => {})); } });
  return Promise.all(jobs).then(() => gl); }
// what to draw on a canvas to read a map's pixels: its own picture, or a compressed one's small fallback (null when there is none)
export const texPixels = t => !t ? null : t.isCompressedTexture ? (t.userData.px || null) : t.image || null;
