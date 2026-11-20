// actors/models.js — Z247/Z248 REAL MODELS: glTF files put onto the procedural rigs — the photo-scanned CC0 rifle (Poly Haven) and the Meshy-generated war horse, operator and carbine (with their animation clips); each file loaded once and shared; while it loads, or if it is missing or fails, the procedural model stays (the game never breaks). `?procgun` in the URL keeps the procedural ones (before / after)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { REALGUN, REALPROP, REALTANK } from '../../config.js';

export const MODEL_FILES = {
  // "Bolt Action Rifle 7.62" by Mateusz Sadek — polyhaven.com, CC0. ~20k tris, 1K PBR textures (5.8 MB).
  //   Model frame: +X to the muzzle (0.596), +Y up, the bolt handle on +Z; the trigger at (-0.288, -0.01), the butt at x -0.635, the bore at y 0.058
  rifle: 'assets/models/rifle/bolt_action_rifle_7_62_1k.gltf',
  // Z248 generated with Meshy (Pro plan: commercial use) from tools/meshy-assets.json, packed by tools/glb-pack.mjs
  horse: 'assets/models/real/horse.glb',                     // war horse, quadruped rig, clips horse_Idle / Walk / Canter / Sprint / Jump_Sprint
  operator: 'assets/models/real/operator.glb',               // the general: Mixamo skeleton with fingers, 10 rifle clips
  rideGallop: 'assets/models/real/operator-ride-gallop.glb', // Text-to-Motion riding clips (animation only, hips rebased to the library frame)
  rideWalk: 'assets/models/real/operator-ride-walk.glb',
  carbine: 'assets/models/real/carbine.glb',                 // M4-style carbine: +X to the stock, muzzle at -X
  // Z249 every infantryman (Z254 re-made: ~10k tris, 2K textures + normal map, arms clear of the body): the trooper (rig + the two clips its pose is taken from), the enemy side's retextured base colour, an 814-triangle carbine
  trooper: 'assets/models/real/trooper.glb',
  trooperEnemyTex: 'assets/models/real/trooper-enemy.jpg',
  troopGun: 'assets/models/real/carbine-light.glb',
};
// Z252 battlefield cover pieces (world/real-props.js)
for(const k of REALPROP.kinds) MODEL_FILES['cover_' + k] = 'assets/models/real/cover/' + k + '.glb';
// Z256 one vehicle per tank family (tank/real-tanks.js)
for(const k of Object.keys(REALTANK.fams)) MODEL_FILES['tank_' + k] = 'assets/models/real/tank/' + k + '.glb';
// Z257 one model per player-gun family that has its own file (tank/real-guns.js)
for(const [k, f] of Object.entries(REALGUN.fams)) if(!f.fromTank) MODEL_FILES['gun_' + k] = 'assets/models/real/gun/' + k + '.glb';
const _load = {}, _gl = {};
let _loader = null;
const procOnly = () => typeof location !== 'undefined' && /procgun/.test((location.search || '') + (location.hash || ''));
const loader = () => (_loader = _loader || new GLTFLoader());
// the whole glTF (scene + animations), shared — clone the scene per use (SkeletonUtils.clone for skinned ones)
export function loadGLTF(key){
  if(_gl[key]) return _gl[key];
  if(procOnly() || typeof window === 'undefined') return (_gl[key] = Promise.resolve(null));
  return (_gl[key] = loader().loadAsync(MODEL_FILES[key]).then(gl => {
    gl.scene.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } }); return gl;
  }).catch(e => { console.warn('[models]', key, 'not loaded — keeping the procedural one:', e && e.message); return null; })); }
export function loadModel(key){
  if(_load[key]) return _load[key];
  return (_load[key] = loadGLTF(key).then(gl => gl ? gl.scene : null)); }

// the general's rifle → the scanned one. G is the procedural rifle group (gun space, +Z to the muzzle, the shooter's trigger side on +X).
//   The scan's trigger lands on the old trigger guard (0, -0.065, 0.02), which puts its butt at z -0.33 — the same shoulder pocket as the old butt pad.
//   The procedural meshes are hidden only once the real one is in; the muzzle flash point moves to the real muzzle.
export function fitRealRifle(G, u, off){
  return loadGLTF('operator').then(op => op ? false : loadModel('rifle')).then(src => {   // Z248 only when the Meshy operator (with his carbine) is unavailable
    if(!src || !G.parent || u.realOp) return false;
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
