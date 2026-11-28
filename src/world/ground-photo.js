// world/ground-photo.js — Z250 PHOTO GROUND: the battlefield floor wears photo-scanned CC0 materials (Poly Haven, see config GROUND_PHOTO): a base set (colour + normal + roughness at its real-world size) over the whole field, a second set showing through on steep faces, crater bowls and bare patches, and the base blended with itself at another scale under the macro noise so no tile repeats. Loaded per battlefield on entering it; until then — or if a file fails, or `?procground` is in the URL — the procedural ground stays.
import * as THREE from 'three';
import { GROUND_PHOTO, LOOK, VISLOOK } from '../../config.js';
import { APPLE, ARENA, MACRO, MOBILE, PHOTO_U, S, WX, groundMat } from '../hub.js';

const _tex = {}, _set = {};
let _sizes = null, _want = null, _ns0 = null;
const off = () => typeof location !== 'undefined' && /procground/.test((location.search || '') + (location.hash || ''));
function tex(url, srgb){ if(_tex[url]) return _tex[url];
  return (_tex[url] = new THREE.TextureLoader().loadAsync(url).then(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = APPLE ? 8 : (MOBILE ? 2 : 8); return t; })); }
export const photoDiff = name => tex('assets/ground/' + name + '/diff.jpg', true);   // Z259 just the colour photo of a set (the far hills)
export function photoSet(name, hi){ const key = name + (hi ? ':2k' : ''); if(_set[key]) return _set[key]; const d = 'assets/ground/' + name + '/', h = hi ? d + '2k/' : d;   // Z263 hi = colour + normal at 2K
  return (_set[key] = Promise.all([tex(h + 'diff.jpg', true), tex(h + 'nor.jpg', false), tex(d + 'arm.jpg', false)]).then(([diff, nor, arm]) => ({ diff, nor, arm }))); }
function sizes(){ return _sizes || (_sizes = fetch('assets/ground/sizes.json').then(r => r.json())); }

// called by applyBiome right after it puts the procedural maps on: back to the procedural look at once, the photo sets swap in when loaded
export const GROUND_READY = { p:Promise.resolve(false) };   // Z322 the photo floor of the battlefield being built (the intro waits for it)
export function applyGroundPhoto(b){ return (GROUND_READY.p = groundPhoto(b)); }
function hexFor(b){ const X = GROUND_PHOTO.hex || {}, P = (GROUND_PHOTO.hexPer || {})[b.name] || {};   // Z405 this battlefield's hex lattice
  PHOTO_U.hex.value.set(P.s ?? X.s ?? 1, P.rot ?? X.rot ?? 1, X.exp ?? 7, X.con ?? 0.6); PHOTO_U.nrmVar.value = GROUND_PHOTO.nrmVar || 0; }
function groundPhoto(b){
  hexFor(b); _ns0 = _ns0 || groundMat.normalScale.clone(); PHOTO_U.altOn.value = 0; groundMat.roughnessMap = null; groundMat.normalScale.copy(_ns0); groundMat.color.setRGB(1, 1, 1); (groundMat.userData.tint = groundMat.userData.tint || new THREE.Color()).setRGB(1, 1, 1); _want = b.name;
  const pair = GROUND_PHOTO.biomes[b.name]; if(!pair || off() || typeof window === 'undefined') return Promise.resolve(false);
  const PB = (GROUND_PHOTO.per && GROUND_PHOTO.per[b.name]) || {}, G = k => PB[k] ?? GROUND_PHOTO[k];   // Z394 a battlefield's own normal strength, patch share, second-scale blend, patch size
  return Promise.all([photoSet(pair[0], GROUND_PHOTO.hi && !MOBILE && (GROUND_PHOTO.hi2k || []).includes(pair[0])), photoSet(pair[1]), sizes()]).then(([A, B, Z]) => {   // (Z394 the 2K maps only where they are on disk)
    if(_want !== b.name) return false;                                   // the player moved on to another battlefield meanwhile
    const rep = (ARENA * 2) / (Z[pair[0]] || 2);
    for(const t of [A.diff, A.nor, A.arm]) t.repeat.set(rep, rep);
    groundMat.map = A.diff; groundMat.normalMap = A.nor; groundMat.normalScale.set(G('nrm'), G('nrm'));
    groundMat.roughnessMap = A.arm; groundMat.roughness = 1; groundMat.color.setRGB(...((LOOK.tone[b.name] || {}).tint || GROUND_PHOTO.tint[b.name] || GROUND_PHOTO.tint._)); groundMat.needsUpdate = true;
    groundMat.userData.tint.copy(groundMat.color);   // LOOK 1 kept: the weather darkens the floor from it (a passing storm used to leave it white)
    if(WX && WX.def && WX.def.wet) groundMat.color.multiplyScalar(0.82);
    { const ng=S.tod==='night' && VISLOOK.night[b.name]; if(ng && ng.gnd) groundMat.color.multiplyScalar(ng.gnd); }   // VIS 10 the night's floor here too: the photo floor arrives after the weather and wiped it (the citadel's pale gravel read as snow)
    MACRO.pamt.value *= G('patchK');
    PHOTO_U.altMap.value = B.diff; PHOTO_U.altScale.value = 1 / ((Z[pair[1]] || 2) * G('altRep')); PHOTO_U.dual.value = G('dual'); PHOTO_U.altOn.value = 1;
    return true; }).catch(e => { console.warn('[ground] photo set not loaded — keeping the procedural ground:', e && e.message); return false; }); }
