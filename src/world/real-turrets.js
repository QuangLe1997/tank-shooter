// world/real-turrets.js — Z424 REAL GUNS ON THE DRAWN MOUNTS, REAL ROCKETS ON THE DRAWN ROUNDS. Our base's guard cannons (the fort gun turret scan)
//   and its automatic MG towers (the remote weapon station scan), the radar station's AA guns (a 40 mm gun in its sandbagged concrete pit, one scan
//   cut in two: the pit stays, the gun turns), and the rockets and missiles in flight (one missile scan) are real models now. Each mount keeps its drawn rig — the yaw group that turns, the
//   recoil groups and the muzzle points the rounds leave from — only its meshes hide once the model is in; the muzzles move to the model's own barrel
//   tip. A model's barrel is found by itself (the point of its upper part farthest from its turning axis) and turned onto +z, so no file needs a
//   hand-set heading. Until a file is in, or without it, the drawn gun stays.
import * as THREE from 'three';
import { REALTURRET } from '../../config.js';
import { loadGLTF } from '../hub.js';

const PREP = {};
// one model as one geometry: its first mesh baked, its barrel (the upper part's farthest point from the middle) turned onto +z, standing on y = 0
//   round its turning axis, scaled so `by` (its width across x, or its length along z) is n m; tip = [height, reach] of the barrel's end
export function turretPiece(key, n, by = 'w'){ const id = key + ':' + n + by; if(PREP[id]) return PREP[id];
  return (PREP[id] = loadGLTF(key).then(gl => { if(!gl) return null; let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; }); if(!src) return null;
    const g = src.geometry.clone().applyMatrix4(src.matrixWorld); g.computeBoundingBox(); const b0 = g.boundingBox, cx = (b0.min.x + b0.max.x) / 2, cz = (b0.min.z + b0.max.z) / 2, h = b0.max.y - b0.min.y, P = g.attributes.position;
    let best = 0, ang = 0, ty = 0; for(let i = 0; i < P.count; i++){ const y = P.getY(i) - b0.min.y; if(y < h * 0.3) continue; const dx = P.getX(i) - cx, dz = P.getZ(i) - cz, r = dx * dx + dz * dz; if(r > best){ best = r; ang = Math.atan2(dx, dz); ty = y; } }
    g.translate(-cx, -b0.min.y, -cz); g.rotateY(-ang); g.computeBoundingBox(); const b = g.boundingBox, k = n / Math.max(by === 'len' ? b.max.z - b.min.z : b.max.x - b.min.x, 1e-3);
    g.scale(k, k, k); g.computeBoundingBox(); g.computeBoundingSphere();
    const mat = src.material.clone(); return { geo:g, mat, tip:[ty * k, Math.sqrt(best) * k], box:g.boundingBox.clone() }; })); }

// a guard gun of our base (core-walls.js makeGun / makeMG): the model turns with its yaw group; the recoil groups / spinning barrels sit at its barrel
export function dressCoreGun(G, kind){ const C = REALTURRET[kind]; if(!C || typeof window === 'undefined') return;
  turretPiece(C.k, C.w).then(T => { if(!T || !G.root.parent) return; const m = new THREE.Mesh(T.geo, T.mat); m.castShadow = m.receiveShadow = true; m.userData.realTurret = true; G.yaw.add(m);
    G.root.traverse(o => { if(o.isMesh && o !== m) o.visible = false; });   // the drawn mount hides; its Object3Ds (muzzles, recoil, spin) carry on
    if(G.muz) G.muz.forEach((q, i) => { q.b.position.x = (i ? 1 : -1) * C.spread; q.b.position.y = T.tip[0]; q.tip.position.z = T.tip[1] - q.b.position.z; });
    if(G.barrels){ G.barrels.position.y = T.tip[0]; G.tip.position.z = T.tip[1] - G.barrels.position.z; } }); }

// the radar station's AA gun (radar.js aaGun): the gun in its sandbagged concrete pit, one scan cut in two where the gun ends — the pit stays on the
//   ground, the gun (its turntable, shields, ammo racks, barrel) turns with the drawn rig's turret; the drawn mount hides, the muzzle moves to the tip
let EMP = null;
function emplacement(C){ return EMP || (EMP = turretPiece(C.k, C.w).then(T => { if(!T) return null; const g = T.geo, P = g.attributes.position, I = g.index ? g.index.array : null, b = T.box;
  const R = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2, H = b.max.y - b.min.y, gun = [], pit = [], n = I ? I.length : P.count;
  for(let t = 0; t < n; t += 3){ let x = 0, y = 0, z = 0; for(let k = 0; k < 3; k++){ const v = I ? I[t + k] : t + k; x += P.getX(v); y += P.getY(v); z += P.getZ(v); }
    const r = Math.hypot(x / 3, z / 3) / R, h = (y / 3 - b.min.y) / H; ((r < C.gunR && h > C.gunY) || h > C.top ? gun : pit).push(I ? I[t] : t, I ? I[t + 1] : t + 1, I ? I[t + 2] : t + 2); }
  const part = L => { const q = new THREE.BufferGeometry(); for(const a in g.attributes) q.setAttribute(a, g.attributes[a]); q.setIndex(L); q.computeBoundingSphere(); return q; };
  return { gun:part(gun), pit:part(pit), mat:T.mat, tip:T.tip }; })); }
export function dressAAGun(g){ const C = REALTURRET.aa, T0 = g.userData.turret, mz = g.userData.muzzle; if(!C || !T0 || typeof window === 'undefined') return;
  emplacement(C).then(E => { if(!E || !g.parent) return; g.traverse(o => { if(o.isMesh) o.visible = false; });
    const pit = new THREE.Mesh(E.pit, E.mat), gun = new THREE.Mesh(E.gun, E.mat); for(const m of [pit, gun]){ m.castShadow = m.receiveShadow = true; m.userData.realTurret = true; }
    g.add(pit); T0.add(gun); gun.position.y = -T0.position.y; if(mz) mz.position.set(0, E.tip[0] - T0.position.y, E.tip[1]); }); }

// a rocket / missile in flight (its group's +z is its nose): the missile scan at the drawn body's length; the drawn body (g.userData.body) hides, its
//   flame, glow and beacon stay. Prepared once: the scan's long axis laid on +z, its nose (the narrow end — the fins make the tail wide) forward
let RP = null, _rp = null;
function realRound(){ if(_rp) return _rp; return (_rp = loadGLTF(REALTURRET.proj.k).then(gl => { if(!gl) return null; let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; }); if(!src) return null;
  const g = src.geometry.clone().applyMatrix4(src.matrixWorld); g.computeBoundingBox(); let b = g.boundingBox; const s = b.getSize(new THREE.Vector3());
  if(s.x >= s.y && s.x >= s.z) g.rotateY(-Math.PI / 2); else if(s.y >= s.x && s.y >= s.z) g.rotateX(Math.PI / 2);   // the long axis onto z
  g.computeBoundingBox(); b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2); g.computeBoundingBox(); b = g.boundingBox;
  const P = g.attributes.position, L = b.max.z - b.min.z; let wTail = 0, wNose = 0; for(let i = 0; i < P.count; i++){ const z = P.getZ(i), r = Math.hypot(P.getX(i), P.getY(i)); if(z > b.max.z - L * 0.15) wNose = Math.max(wNose, r); else if(z < b.min.z + L * 0.15) wTail = Math.max(wTail, r); }
  if(wNose > wTail) g.rotateY(Math.PI);   // the fins were at +z: turn it nose-first
  g.computeBoundingBox(); g.computeBoundingSphere(); const mat = src.material.clone(); mat.envMapIntensity = 0.8; return (RP = { geo:g, mat, len:L }); })); }
export function dressRound(g, len){ if(typeof window === 'undefined' || g.userData.realRound) return g; g.userData.realRound = true;
  const put = R => { if(!R) return; const m = new THREE.Mesh(R.geo, R.mat); m.scale.setScalar(len / R.len); m.castShadow = false; g.add(m); for(const b of g.userData.body || []) b.visible = false; };
  if(RP) put(RP); else realRound().then(put); return g; }
