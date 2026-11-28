// world/zone-mark.js — VIS 8 A HOLD ZONE'S MARK ON THE GROUND: a painted band draped over the ground (it follows every rise and dip — the old flat
//   ring floated a metre over the low side and read as a neon wall cutting the screen) and a ring of short marker posts; the paint is lit by the
//   scene like the ground it lies on, and the band and the post caps light up only as he nears the rim or steps outside (VISLOOK.ring)
import * as THREE from 'three';
import { VISLOOK } from '../../config.js';
import { heightAt, scene } from '../hub.js';

const SEG = 96, PMAX = 48;
let _dash = null;
function dashTex(){ if(_dash) return _dash; const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 4, 64);
  const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.12, '#fff'); g.addColorStop(0.62, '#fff'); g.addColorStop(0.72, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 64);
  _dash = new THREE.CanvasTexture(c); _dash.wrapS = _dash.wrapT = THREE.RepeatWrapping; return _dash; }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();
// one mark (made once, moved, hidden): { g, set(x, z, r), tick(px, pz), hide() } — g.visible tells whether it shows
export function zoneMark(){ const R = VISLOOK.ring, g = new THREE.Group(); g.visible = false; scene.add(g);
  const P = new Float32Array((SEG + 1) * 6), U = new Float32Array((SEG + 1) * 4), I = []; for(let i = 0; i < SEG; i++){ const a = i * 2; I.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.setIndex(I);
  const tex = dashTex().clone(); tex.needsUpdate = true;
  const paint = new THREE.MeshStandardMaterial({ color:R.col, roughness:0.95, metalness:0, transparent:true, opacity:R.op, alphaMap:tex, depthWrite:false, emissive:new THREE.Color(R.col), emissiveIntensity:0,
    polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-8 });
  const band = new THREE.Mesh(geo, paint); band.renderOrder = 1; band.frustumCulled = false; g.add(band);
  const postG = new THREE.CylinderGeometry(0.045, 0.06, 1, 6); postG.translate(0, 0.5, 0); const capG = new THREE.BoxGeometry(0.11, 0.07, 0.11);
  const posts = new THREE.InstancedMesh(postG, new THREE.MeshStandardMaterial({ color:0x3a3a2e, roughness:0.8 }), PMAX), capM = new THREE.MeshBasicMaterial({ color:R.col }), caps = new THREE.InstancedMesh(capG, capM, PMAX);
  posts.castShadow = true; posts.frustumCulled = caps.frustumCulled = false; g.add(posts, caps);
  const M = { g, x:NaN, z:NaN, r:0, lit:-1,
    set(x, z, r){ g.visible = true; if(x === M.x && z === M.z && r === M.r) return; M.x = x; M.z = z; M.r = r; const w = R.w / 2, rep = Math.max(8, Math.round(6.283 * r / 1.4));
      for(let i = 0; i <= SEG; i++){ const a = i / SEG * 6.283, c = Math.cos(a), s = Math.sin(a);
        for(let k = 0; k < 2; k++){ const rr = r + (k ? w : -w), px = x + c * rr, pz = z + s * rr, o = (i * 2 + k) * 3; P[o] = px; P[o + 1] = heightAt(px, pz) + 0.05; P[o + 2] = pz; U[(i * 2 + k) * 2] = k; U[(i * 2 + k) * 2 + 1] = i / SEG * rep; } }
      geo.attributes.position.needsUpdate = geo.attributes.uv.needsUpdate = true; geo.computeBoundingSphere();
      const n = Math.min(PMAX, Math.max(6, Math.round(6.283 * r / R.step))); posts.count = caps.count = n;
      for(let i = 0; i < n; i++){ const a = (i + 0.5) / n * 6.283, px = x + Math.cos(a) * (r + w + 0.15), pz = z + Math.sin(a) * (r + w + 0.15), gy = heightAt(px, pz);
        _p.set(px, gy, pz); _s.set(1, R.h, 1); posts.setMatrixAt(i, _m.compose(_p, _q, _s)); _p.y = gy + R.h + 0.03; _s.set(1, 1, 1); caps.setMatrixAt(i, _m.compose(_p, _q, _s)); }
      posts.instanceMatrix.needsUpdate = caps.instanceMatrix.needsUpdate = true; },
    // how near the rim he is: deep inside the paint stays quiet, at the rim / outside it lights
    tick(px, pz){ if(!g.visible) return; const d = Math.hypot(px - M.x, pz - M.z), lit = Math.max(0, Math.min(1, 1 - (M.r - d) / R.edge)); if(Math.abs(lit - M.lit) < 0.02) return; M.lit = lit;
      paint.emissiveIntensity = 0.06 + lit * 0.35; paint.opacity = R.op * (0.75 + 0.25 * lit); capM.color.copy(_c.setHex(R.col)).multiplyScalar(0.25 + lit * R.glow); },
    hide(){ g.visible = false; } };
  return M; }
