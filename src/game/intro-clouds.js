// game/intro-clouds.js — Z322 THE INTRO'S SKY: high over the field the air is hazy and a thin deck of soft clouds drifts between the camera and
//   the ground; the swoop down to the tank passes through that deck — the picture whitens for a moment inside a cloud — and below it the
//   battlefield is clear again. Puffs are camera-facing sprites of a soft canvas cloud, laid along the descent (so it really flies through
//   them) plus a few wisps over the field; each fades as the camera reaches it (no sprite edge cutting the screen) and a screen veil
//   (haze by altitude + the whiteout inside a puff) does the rest. Only for the grand tour (desktop); none underground.
import * as THREE from 'three';
import { INTRO_CLOUDS } from '../../config.js';
import { BIOME, camera, scene } from '../hub.js';

const CL = { g:null, puffs:[], lo:0, hi:1, veil:null, tex:null, tint:new THREE.Color() };
// a soft cloud: overlapping round blobs, denser in the middle, faded to nothing at the edge (white; the sprite colour tints it)
function cloudTex(seed){ const c = document.createElement('canvas'), S = 256; c.width = c.height = S; const x = c.getContext('2d');
  let s = seed * 9301 + 49297; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for(let i = 0; i < 26; i++){ const a = rnd() * 6.283, d = Math.pow(rnd(), 0.7) * S * 0.26, r = S * (0.12 + rnd() * 0.16), cx = S / 2 + Math.cos(a) * d, cy = S / 2 + Math.sin(a) * d * 0.7;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,0.32)'); g.addColorStop(0.55, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
  const m = x.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.5); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');   // fade the whole cloud out toward the edge
  x.globalCompositeOperation = 'destination-in'; x.fillStyle = m; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function veil(){ if(CL.veil) return CL.veil; const v = document.createElement('div'); v.id = 'introMist';
  v.innerHTML = '<i class="haze"></i><i class="fill"></i>'; document.body.appendChild(v); return (CL.veil = v); }
// tour: the intro's grand tour (pose(w), wA); T: our tank. Built once per intro, behind the veil (so its material compiles in the warm-up)
export function buildIntroClouds(tour, T){ clearIntroClouds(); const C = INTRO_CLOUDS; if(!C.on || !tour || BIOME.name === 'CAVERN') return;
  CL.tex = CL.tex || [cloudTex(1), cloudTex(2), cloudTex(3)];
  const fc = scene.fog ? scene.fog.color : new THREE.Color(0.7, 0.75, 0.8), lum = (fc.r + fc.g + fc.b) / 3;
  CL.tint.copy(fc).lerp(new THREE.Color(1, 1, 1), lum > 0.25 ? C.tintK : C.tintK * 0.3);   // day: bright mist · night: the dark sky's own grey-blue
  const p = new THREE.Vector3(), l = new THREE.Vector3(); tour.pose(0, p, l); const top = p.y; tour.pose(1, p, l); const bottom = p.y;
  CL.hi = bottom + (top - bottom) * C.band[1]; CL.lo = bottom + (top - bottom) * C.band[0];
  const g = new THREE.Group(); g.renderOrder = 40; CL.g = g; scene.add(g);
  const add = (x, y, z, size, op) => { const m = new THREE.SpriteMaterial({ map:CL.tex[CL.puffs.length % 3], color:CL.tint, transparent:true, opacity:0, depthWrite:false, fog:false });
    m.rotation = Math.random() * 6.283; const s = new THREE.Sprite(m); s.position.set(x, y, z); s.scale.set(size, size * 0.62, 1); s.renderOrder = 40; g.add(s);
    CL.puffs.push({ s, op, r:size * 0.5, drift:(Math.random() - 0.5) * C.drift }); };
  // the deck the swoop flies through: puffs round the descent while it is inside the band
  for(let i = 0; i < C.puffs; i++){ const w = tour.wA + (1 - tour.wA) * (0.05 + 0.6 * i / C.puffs); tour.pose(w, p, l); if(p.y < CL.lo * 0.9 || p.y > CL.hi * 1.1) continue;
    const a = Math.random() * 6.283, d = 6 + Math.random() * 16, size = C.size[0] + Math.random() * (C.size[1] - C.size[0]);
    add(p.x + Math.cos(a) * d, p.y - 4 + Math.random() * 8, p.z + Math.sin(a) * d, size, C.op * (0.7 + Math.random() * 0.3)); }
  // thin wisps over the field (seen from the high orbit as haze drifting between us and the ground)
  for(let i = 0; i < C.wisps; i++){ const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * top * 1.4, size = C.size[1] * (1 + Math.random());
    add(T.x * 0.35 + Math.cos(a) * d, CL.lo + Math.random() * (CL.hi - CL.lo), T.z * 0.35 + Math.sin(a) * d, size, C.wispOp * (0.6 + Math.random() * 0.4)); }
  const v = veil(); v.style.setProperty('--mist', '#' + CL.tint.getHexString()); v.classList.add('on'); updateIntroClouds(0); }
const _d = new THREE.Vector3();
export function updateIntroClouds(dt){ if(!CL.g) return; const C = INTRO_CLOUDS, cam = camera.position; let inside = 0;
  for(const q of CL.puffs){ const s = q.s; s.position.x += q.drift * dt; s.material.rotation += q.drift * dt * 0.004;
    const d = _d.subVectors(s.position, cam).length(), k = THREE.MathUtils.smoothstep(d, q.r * 0.35, q.r * 1.1);   // fades as we reach it — the veil takes over
    s.material.opacity = q.op * k; inside = Math.max(inside, (1 - k) * q.op / C.op); }
  const alt = THREE.MathUtils.smoothstep(cam.y, CL.lo * 0.8, CL.hi), below = THREE.MathUtils.smoothstep(cam.y, CL.lo * 0.55, CL.lo), v = CL.veil; inside *= below;   // under the deck the air is clear
  if(v){ v.style.setProperty('--haze', (alt * C.haze).toFixed(3)); v.style.setProperty('--fill', (Math.min(1, inside) * C.inside).toFixed(3)); } }
export function clearIntroClouds(){ if(CL.g){ scene.remove(CL.g); for(const q of CL.puffs) q.s.material.dispose(); } CL.g = null; CL.puffs.length = 0;
  if(CL.veil){ CL.veil.classList.remove('on'); CL.veil.style.setProperty('--haze', '0'); CL.veil.style.setProperty('--fill', '0'); } }
