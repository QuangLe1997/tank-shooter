// world/ground-photo.js — Z250 PHOTO GROUND: the battlefield floor wears photo-scanned CC0 materials (Poly Haven, see config GROUND_PHOTO): a base set (colour + normal + roughness at its real-world size) over the whole field, a second set showing through on steep faces, crater bowls and bare patches, and the base blended with itself at another scale under the macro noise so no tile repeats. Loaded per battlefield on entering it; until then — or if a file fails, or `?procground` is in the URL — the procedural ground stays.
import * as THREE from 'three';
import { GROUND_PHOTO } from '../../config.js';
import { APPLE, ARENA, MACRO, MOBILE, PHOTO_U, groundMat } from '../hub.js';

const _tex = {}, _set = {};
let _sizes = null, _want = null, _ns0 = null;
const off = () => typeof location !== 'undefined' && /procground/.test((location.search || '') + (location.hash || ''));
function tex(url, srgb){ if(_tex[url]) return _tex[url];
  return (_tex[url] = new THREE.TextureLoader().loadAsync(url).then(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = APPLE ? 8 : (MOBILE ? 2 : 8); return t; })); }
export const photoDiff = name => tex('assets/ground/' + name + '/diff.jpg', true);   // Z259 just the colour photo of a set (the far hills)
export function photoSet(name){ if(_set[name]) return _set[name]; const d = 'assets/ground/' + name + '/';
  return (_set[name] = Promise.all([tex(d + 'diff.jpg', true), tex(d + 'nor.jpg', false), tex(d + 'arm.jpg', false)]).then(([diff, nor, arm]) => ({ diff, nor, arm }))); }
function sizes(){ return _sizes || (_sizes = fetch('assets/ground/sizes.json').then(r => r.json())); }

// called by applyBiome right after it puts the procedural maps on: back to the procedural look at once, the photo sets swap in when loaded
export function applyGroundPhoto(b){
  _ns0 = _ns0 || groundMat.normalScale.clone(); PHOTO_U.altOn.value = 0; groundMat.roughnessMap = null; groundMat.normalScale.copy(_ns0); groundMat.color.setRGB(1, 1, 1); _want = b.name;
  const pair = GROUND_PHOTO.biomes[b.name]; if(!pair || off() || typeof window === 'undefined') return Promise.resolve(false);
  return Promise.all([photoSet(pair[0]), photoSet(pair[1]), sizes()]).then(([A, B, Z]) => {
    if(_want !== b.name) return false;                                   // the player moved on to another battlefield meanwhile
    const rep = (ARENA * 2) / (Z[pair[0]] || 2);
    for(const t of [A.diff, A.nor, A.arm]) t.repeat.set(rep, rep);
    groundMat.map = A.diff; groundMat.normalMap = A.nor; groundMat.normalScale.set(GROUND_PHOTO.nrm, GROUND_PHOTO.nrm);
    groundMat.roughnessMap = A.arm; groundMat.roughness = 1; groundMat.color.setRGB(...(GROUND_PHOTO.tint[b.name] || GROUND_PHOTO.tint._)); groundMat.needsUpdate = true;
    MACRO.pamt.value *= GROUND_PHOTO.patchK;
    PHOTO_U.altMap.value = B.diff; PHOTO_U.altScale.value = 1 / ((Z[pair[1]] || 2) * GROUND_PHOTO.altRep); PHOTO_U.dual.value = GROUND_PHOTO.dual; PHOTO_U.altOn.value = 1;
    return true; }).catch(e => { console.warn('[ground] photo set not loaded — keeping the procedural ground:', e && e.message); return false; }); }
