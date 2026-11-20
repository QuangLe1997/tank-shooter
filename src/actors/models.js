// actors/models.js — Z247/Z248 REAL MODELS: glTF files put onto the procedural rigs — the photo-scanned CC0 rifle (Poly Haven) and the Meshy-generated war horse, operator and carbine (with their animation clips); each file loaded once and shared; while it loads, or if it is missing or fails, the procedural model stays (the game never breaks). `?procgun` in the URL keeps the procedural ones (before / after)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PHONE_LOD, REALAIR, REALRUIN, REALCITY, REALGUN, REALPROP, REALTANK, REALTREE } from '../../config.js';

export const MODEL_FILES = {
  // "Bolt Action Rifle 7.62" by Mateusz Sadek — polyhaven.com, CC0. ~20k tris, 1K PBR textures (5.8 MB).
  //   Model frame: +X to the muzzle (0.596), +Y up, the bolt handle on +Z; the trigger at (-0.288, -0.01), the butt at x -0.635, the bore at y 0.058
  rifle: 'assets/models/rifle/bolt_action_rifle_7_62_1k.gltf',
  // Z248 generated with Meshy (Pro plan: commercial use) from tools/meshy-assets.json, packed by tools/glb-pack.mjs
  horse: 'assets/models/real/horse.glb',                     // war horse, quadruped rig, clips horse_Idle / Walk / Canter / Sprint / Jump_Sprint
  soldier2: 'assets/models/real/soldier2.glb',             // Z294 the second soldier: Tripo P2, Mixamo skeleton, special-forces kit
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
// Z262 the tree species (world/real-trees.js)
const PHONE = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && PHONE_LOD.on;   // (= MOBILE; read here: this table is built before the hub is)
for(const k of Object.keys(REALTREE.h)) MODEL_FILES['tree_' + k] = 'assets/models/real/tree/' + (PHONE && PHONE_LOD.trees ? 'm/' : '') + k + '.glb';   // Z292 phones take the 3k-triangle trees
// Z264 the city's buildings and vehicles (world/real-city.js)
MODEL_FILES.camp_hq = 'assets/models/real/camp/hq.glb';
for(const k of ['wonder_taj','wonder_colosseum','wonder_djenne','wonder_volklingen']) MODEL_FILES[k] = 'assets/models/real/wonder/' + k + '.glb';   // Z284 the wonders
for(const k of ['deer','zebra','giraffe','elephant','reindeer','bear']) MODEL_FILES['wild_' + k] = 'assets/models/real/wild/' + k + '.glb';   // Z286 real wildlife (rigged, walking)
for(const k of ['xeom','xichlo','bagac','bantai']) MODEL_FILES['ride_' + k] = 'assets/models/real/ride/' + k + '.glb';   // Z293 the war rides
// Z285 enemy outposts
for(const k of ['base_tent','base_radar','base_bunker','base_barracks','base_wire','mil_truck','mil_apc','mil_jeep']) MODEL_FILES[k] = 'assets/models/real/camp/' + k + '.glb';
MODEL_FILES.base_wall = 'assets/models/real/camp/base_wall.glb'; MODEL_FILES.base_tower = 'assets/models/real/camp/base_tower.glb';   // Z273
for(const k of Object.keys(REALAIR.models)) MODEL_FILES[k] = 'assets/models/real/air/' + k + '.glb';
for(const k of Object.keys(REALRUIN.models)) MODEL_FILES[k] = 'assets/models/real/ruin/' + k + '.glb';   // Z275 the ruins
for(const st of ['citadel','desert','arctic','volcano','meadow','ruins','quarry','savanna','foundry']) for(const p of ['wall','tower','gate']) MODEL_FILES['fort_'+st+'_'+p] = 'assets/models/real/fort/'+(PHONE && PHONE_LOD.forts ? 'm/' : '')+'fort_'+st+'_'+p+'.glb';   // Z279 the colossal forts   // Z272 the aircraft   // Z269 the field headquarters
for(const k of Object.keys(REALCITY.blds).concat(Object.keys(REALCITY.cars), Object.keys(REALCITY.props), REALCITY.traffic.files)) MODEL_FILES[k] = 'assets/models/real/city/' + (PHONE && PHONE_LOD.city.includes(k) ? 'm/' : '') + k + '.glb';   // Z292 the light buildings on phones
const _load = {}, _gl = {};
let _loader = null;
const procOnly = () => typeof location !== 'undefined' && /procgun/.test((location.search || '') + (location.hash || ''));
const loader = () => (_loader = _loader || new GLTFLoader());
// the whole glTF (scene + animations), shared — clone the scene per use (SkeletonUtils.clone for skinned ones)
// Z289 a normal squashed to ~zero by mesh simplification / quantisation makes normalize() NaN in the shader, and the NaN guard paints that
//   triangle black (the black shards on the skyline towers). Any such vertex takes its triangle's own face normal when the model loads.
const _fa=new THREE.Vector3(), _fb=new THREE.Vector3(), _fc=new THREE.Vector3();
export function fixNormals(geo){ const N=geo.attributes.normal, P=geo.attributes.position; if(!N || !P) return 0; let bad=0; const weak=i=>Math.hypot(N.getX(i), N.getY(i), N.getZ(i))<0.5;
  for(let i=0;i<N.count;i++) if(weak(i)){ bad++; break; } if(!bad) return 0; bad=0; const I=geo.index, n=I?I.count:P.count;
  for(let t=0;t+2<n;t+=3){ const a=I?I.getX(t):t, b=I?I.getX(t+1):t+1, c=I?I.getX(t+2):t+2; if(!weak(a) && !weak(b) && !weak(c)) continue;
    _fa.fromBufferAttribute(P,a); _fb.fromBufferAttribute(P,b).sub(_fa); _fc.fromBufferAttribute(P,c).sub(_fa); _fb.cross(_fc); if(_fb.lengthSq()<1e-20) _fb.set(0,1,0); _fb.normalize();
    for(const v of [a,b,c]) if(weak(v)){ N.setXYZ(v, _fb.x, _fb.y, _fb.z); bad++; } }
  for(let i=0;i<N.count;i++) if(weak(i)){ N.setXYZ(i,0,1,0); bad++; } N.needsUpdate=true; return bad; }
export function loadGLTF(key){
  if(_gl[key]) return _gl[key];
  if(procOnly() || typeof window === 'undefined') return (_gl[key] = Promise.resolve(null));
  return (_gl[key] = loader().loadAsync(MODEL_FILES[key]).then(gl => {
    gl.scene.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; fixNormals(o.geometry); } }); return gl;
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
