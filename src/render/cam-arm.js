// render/cam-arm.js — VIS 2 THE SPRING ARM: the follow camera never sits inside a rock, a ruin's pillar or a wall, nor presses its lens to one. Every
//   VISLOOK.arm.every s ONE ray runs from the soldier's head to where the lens wants to be, against the standing solids of the scene (gathered every
//   sweep s: meshes that throw a shadow, have not moved between two sweeps, and are small enough to read — a whole fort's merged wall is left to the
//   fade); a reverse ray tells a surface the lens is inside from one it is merely behind. A surface the lens is inside, or one within near m of it,
//   pulls the lens in to pad m short of it; one nearer the soldier is cut away by render/see-through.js instead (the old leap in front of every post
//   is not back). The share eases in fast and back out slowly once the way has been clear for hold s. Also solidHit(): the first solid on a segment
//   (a headlamp's cone ends there). No allocation per frame.
import * as THREE from 'three';
import { VISLOOK } from '../../config.js';
import { scene } from '../hub.js';

export const ARM = { list:[], seen:new Map(), sweepAt:-1, at:-1, share:1, want:1, clearAt:0, ms:0, rays:0, n:0, pulls:0 };
const _rc = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _hits = [], _rev = [], _sph = new THREE.Sphere(), _m = new THREE.Matrix4(), _v = new THREE.Vector3();
_rc.firstHitOnly = true;
let _skip = null;
// SWEEP: who counts as a solid (static over two sweeps: a moving man, horse, bike, a falling wall never does)
function sweep(now, skip){ const A = VISLOOK.arm; if(now - ARM.sweepAt < A.sweep) return; ARM.sweepAt = now; const mine = _skip || (_skip = new Set()); mine.clear();
  if(skip) for(const r of skip) if(r) r.traverse(o => mine.add(o));
  const L = ARM.list; L.length = 0; const seen = ARM.seen, keep = new Set();
  scene.traverseVisible(o => { if(!o.isMesh || o.isSkinnedMesh || !o.castShadow || mine.has(o) || !o.geometry || !o.geometry.attributes.position) return; const u = o.userData;
    if(u && (u.tree || u.forest || u.noArm)) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if(!m || m.transparent || m.alphaTest > 0 || m.side === THREE.BackSide) return;
    const g = o.geometry, tri = (g.index ? g.index.count : g.attributes.position.count) / 3; if(tri > A.maxTri) return;
    const ver = o.isInstancedMesh ? o.instanceMatrix.version + o.count * 1e6 : 0, e = o.matrixWorld.elements, sig = e[12] * 7.1 + e[13] * 3.3 + e[14] * 5.7 + e[0] + e[2] + ver;
    const was = seen.get(o); keep.add(o); seen.set(o, sig); if(was === undefined || was !== sig) return;   // new or moved since the last sweep: not yet a solid
    if(o.isInstancedMesh){ if(!o.boundingSphere || o._armV !== ver){ o.computeBoundingSphere(); o._armV = ver; } _sph.copy(o.boundingSphere); }
    else { if(!g.boundingSphere) g.computeBoundingSphere(); _sph.copy(g.boundingSphere); }
    _sph.applyMatrix4(o.matrixWorld); if(_sph.radius < 0.5 || _sph.radius > 400) return;
    L.push(o, _sph.center.x, _sph.center.y, _sph.center.z, _sph.radius); });
  for(const k of seen.keys()) if(!keep.has(k)) seen.delete(k);
  ARM.n = L.length / 5; }
// the nearest solid hit along o → o + d·far (d unit); its distance and mesh in out[0], out[1]; Infinity when clear
const _out = [Infinity, null];
function cast(ox, oy, oz, dx, dy, dz, far, out){ out[0] = Infinity; out[1] = null; const L = ARM.list; _o.set(ox, oy, oz); _d.set(dx, dy, dz); _rc.set(_o, _d); _rc.near = 0; _rc.far = far;
  for(let i = 0; i < L.length; i += 5){ const cx = L[i + 1] - ox, cy = L[i + 2] - oy, cz = L[i + 3] - oz, r = L[i + 4], t = cx * dx + cy * dy + cz * dz;   // the sphere against the segment first
    if(t < -r || t > far + r) continue; const tt = Math.max(0, Math.min(far, t)), ex = cx - dx * tt, ey = cy - dy * tt, ez = cz - dz * tt; if(ex * ex + ey * ey + ez * ez > r * r) continue;
    _hits.length = 0; L[i].raycast(_rc, _hits); for(const h of _hits) if(h.distance < out[0]){ out[0] = h.distance; out[1] = L[i]; } }
  return out; }
// the first solid on the segment a → b (share 0…1 of the way, or 1 when clear) — throttled callers only
export function solidHit(ax, ay, az, bx, by, bz){ if(!ARM.list.length) return 1; const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz); if(L < 0.05) return 1;
  cast(ax, ay, az, dx / L, dy / L, dz / L, L, _out); return _out[0] < L ? _out[0] / L : 1; }
// the arm: pos (the lens as the camera wants it) is pulled toward the head at (hx, hy, hz) in place; skip = his own kit (never a solid)
export function armPull(pos, hx, hy, hz, dt, now, skip){ const A = VISLOOK.arm; if(!A.on){ ARM.share = 1; return pos; } sweep(now, skip);
  const dx = pos.x - hx, dy = pos.y - hy, dz = pos.z - hz, L = Math.hypot(dx, dy, dz);
  if(L > 0.5 && now - ARM.at >= A.every){ ARM.at = now; const t0 = performance.now(), ux = dx / L, uy = dy / L, uz = dz / L; let want = 1;
    cast(hx, hy, hz, ux, uy, uz, L + A.pad, _out); const d = _out[0], obj = _out[1];
    if(obj){ let pull = d >= L - A.near; if(!pull){ _o.set(pos.x, pos.y, pos.z); _d.set(-ux, -uy, -uz); _rc.set(_o, _d); _rc.far = L - d + 0.01; _rev.length = 0; obj.raycast(_rc, _rev); pull = !_rev.length; }   // inside it (no face of it seen from the lens), or it is right at the lens
      if(pull && d - A.pad >= A.minD) want = (d - A.pad) / L; }
    ARM.want = want; if(want < 0.999){ ARM.clearAt = now; ARM.pulls++; } ARM.rays++; ARM.ms += (performance.now() - t0 - ARM.ms) * 0.1; }
  let w = ARM.want; if(w >= 0.999 && now - ARM.clearAt < A.hold) w = Math.min(1, ARM.share);   // clear: hold a moment before easing out (no in-out-in past a row of posts)
  ARM.share += (w - ARM.share) * (w < ARM.share ? Math.min(1, dt * A.inK) : Math.min(1, dt / Math.max(0.05, A.outT)));
  if(ARM.share < 0.999) pos.set(hx + dx * ARM.share, hy + dy * ARM.share, hz + dz * ARM.share);
  return pos; }
export function armReset(){ ARM.share = 1; ARM.want = 1; ARM.at = -1; }
export const armStats = () => ({ solids:ARM.n, share:+ARM.share.toFixed(2), ms:+ARM.ms.toFixed(3), rays:ARM.rays, pulls:ARM.pulls });
