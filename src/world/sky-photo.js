// world/sky-photo.js — Z255 PHOTOGRAPHED SKY: a real pure-sky HDRI (Poly Haven, CC0; tools/sky-hdri.mjs → assets/sky) laid into the sky dome per hour of the day (and an overcast one for storms), turned so the sun in the photo stands where our sun light comes from, our sun lowered / raised to the photo's elevation so the shadows agree with the sky, the procedural cloud layer thinned under it (the procedural sky, its storms and lightning stay underneath), the fog taking the photo's horizon colour. Night keeps the procedural stars, Milky Way and moon. Loaded per battle; until then (or on failure, or `?procsky`) the procedural sky stays.
import * as THREE from 'three';
import { SKY_PHOTO } from '../../config.js';
import { MOBILE, S, SKY, SKYMOOD, SUN_DIR, scene } from '../hub.js';

const _tex = {}; let _meta = null, _req = 0;
const off = () => typeof location !== 'undefined' && /procsky/.test((location.search || '') + (location.hash || ''));
const meta = () => _meta || (_meta = fetch('assets/sky/skies.json').then(r => r.json()));
function tex(name){ const url = 'assets/sky/' + name + (MOBILE ? '_2k' : '') + '.jpg';
  return _tex[url] || (_tex[url] = new THREE.TextureLoader().loadAsync(url).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return t; })); }

// called by applyAtmosphere once the hour and the sky mood are set
export function applySkyPhoto(A){
  const u = SKY.material.uniforms, id = ++_req; u.hdrAmt.value = 0;
  if(A.night || A.cave || off() || typeof window === 'undefined') return Promise.resolve(false);
  const mood = SKYMOOD.id, name = (SKY_PHOTO.mood && SKY_PHOTO.mood[mood]) || SKY_PHOTO.tod[S.tod || 'day']; if(!name) return Promise.resolve(false);
  return Promise.all([tex(name), meta()]).then(([t, M]) => { const m = M[name]; if(id !== _req || !m) return false;
    // our sun to the photo's elevation (shadows match the sky), keeping our azimuth; the photo turned so its sun lands there
    const az = Math.atan2(SUN_DIR.x, SUN_DIR.z), el = Math.max(SKY_PHOTO.minEl, m.sunEl);
    SUN_DIR.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize(); u.sunDir.value.copy(SUN_DIR);
    u.hdrTex.value = t; u.hdrRot.value = (m.sunU - 0.5) * Math.PI * 2 - Math.PI / 2 + az;
    u.hdrAmt.value = SKY_PHOTO.amt[mood] ?? 1;
    u.cCov.value.z *= 1 - u.hdrAmt.value * (1 - SKY_PHOTO.cloudK);
    const h = new THREE.Color().setRGB(m.hor[0], m.hor[1], m.hor[2], THREE.SRGBColorSpace);
    scene.fog.color.lerp(h, SKY_PHOTO.fogMix); if(scene.background && scene.background.isColor) scene.background.copy(scene.fog.color); u.hor.value.lerp(h, SKY_PHOTO.fogMix);
    return true; }).catch(e => { console.warn('[sky] photo sky not loaded — keeping the procedural sky:', e && e.message); return false; }); }
