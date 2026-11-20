// actors/models.js — Z247 REAL MODELS: photo-scanned CC0 glTF props (Poly Haven) put onto the procedural rigs — each file loaded once and cloned per use; while it loads, or if it is missing or fails, the procedural model stays (the game never breaks). `?procgun` in the URL keeps the procedural ones (before / after)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const MODEL_FILES = {
  // "Bolt Action Rifle 7.62" by Mateusz Sadek — polyhaven.com, CC0. ~20k tris, 1K PBR textures (5.8 MB).
  //   Model frame: +X to the muzzle (0.596), +Y up, the bolt handle on +Z; the trigger at (-0.288, -0.01), the butt at x -0.635, the bore at y 0.058
  rifle: 'assets/models/rifle/bolt_action_rifle_7_62_1k.gltf',
};
const _load = {};
let _loader = null;
const procOnly = () => typeof location !== 'undefined' && /procgun/.test((location.search || '') + (location.hash || ''));
export function loadModel(key){
  if(_load[key]) return _load[key];
  if(procOnly() || typeof window === 'undefined') return (_load[key] = Promise.resolve(null));
  _loader = _loader || new GLTFLoader();
  return (_load[key] = _loader.loadAsync(MODEL_FILES[key]).then(gl => {
    const s = gl.scene; s.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } }); return s;
  }).catch(e => { console.warn('[models]', key, 'not loaded — keeping the procedural one:', e && e.message); return null; })); }

// the general's rifle → the scanned one. G is the procedural rifle group (gun space, +Z to the muzzle, the shooter's trigger side on +X).
//   The scan's trigger lands on the old trigger guard (0, -0.065, 0.02), which puts its butt at z -0.33 — the same shoulder pocket as the old butt pad.
//   The procedural meshes are hidden only once the real one is in; the muzzle flash point moves to the real muzzle.
export function fitRealRifle(G, u, off){
  return loadModel('rifle').then(src => {
    if(!src || !G.parent) return false;
    const m = src.clone(true);
    m.rotation.y = -Math.PI/2;                     // +X (muzzle) → +Z
    m.scale.set(1, 1, -1);                         // bolt handle on the trigger-hand side (+X in gun space)
    m.position.set(0, -0.055, 0.308);              // trigger (-0.288, -0.01) → (0, -0.065, 0.02)
    m.name = 'realRifle';
    m.traverse(o => { if(/bullet/i.test(o.name)) o.visible = false; });   // the scan ships a loose display cartridge beside the rifle
    for(const c of G.children) c.visible = false;
    G.add(m); u.realRifle = m;
    if(u.muzzle) u.muzzle.position.set(off.x, off.y + 0.003, off.z + 0.904);
    return true; }); }
