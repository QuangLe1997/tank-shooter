// actors/soldier-upper.js — Z343 HIS UPPER BODY IN TIME WITH HIS LEGS: walking under his own legs (Z339) the rifle, shoulders and head were one held
//   frame carried along — stiff. Now, laid between the legs and the hold every frame:
//   · his shoulders turn a little against each stride (the opposite way to the pelvis) and his trunk rides over the standing foot;
//   · he leans into a change of pace — forward setting off, back pulling up, into a turn or a sidestep — on a damped spring, so it settles, not snaps;
//   · stood still he breathes (the chest rises and falls);
//   · his head holds steady: every turn added to the trunk is taken back at the neck, so the eyes stay on the target while the body moves under them;
//   · the rifle has weight: it lags the chest's accelerations on a spring (a dip at each footfall, a drop on landing from a jump, a sway starting
//     off) and its muzzle traces a small figure of eight with the stride — less while he fires; the rounds still go where he aims;
//   · climbing on or off a ride he looks at what his left hand takes hold of (actors/soldier-mount.js).
import * as THREE from 'three';
import { SOLDIER_UPPER } from '../../config.js';
import { CV, S, turnBone } from '../hub.js';

const V3 = () => new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const _c = V3(), _v = V3(), _a = V3(), FA = V3(), RA = V3(), _q = new THREE.Quaternion();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const upState = R => R.upper || (R.upper = { prev:null, v:V3(), a:V3(), pv0:null, vy:0, ay:0, p:0, pv:0, r:0, rv:0, t:0, lag:V3(), lagV:V3(), sway:{ y:0, p:0 }, fall:0 });
// a damped spring toward `to` (value, velocity) → [value, velocity]
const spring = (x, v, to, k, z, dt) => { v += (-k * (x - to) - 2 * z * Math.sqrt(k) * v) * dt; return [x + v * dt, v]; };

// every frame, after his legs (soldierLegs) and before the hold (holdReal)
export function soldierUpper(R, G, dt, P, mounted){ const D = R.pup && R.pup.D; if(!D || !D.Spine2 || !dt) return; const K = SOLDIER_UPPER, U = upState(R); U.t += dt;
  // how he is speeding up: across the ground from the pace he is set to (clean), up and down from his chest (smoothed hard — a frame's jitter is
  //   not a shove); a jump across the map (respawn, onto a seat) starts it afresh
  const pl = S.player, pv = pl && pl.vel; D.Spine2.getWorldPosition(_c); if(!U.prev || _c.distanceTo(U.prev) > K.reset){ U.prev = _c.clone(); U.vy = 0; U.ay = 0; U.a.set(0, 0, 0); U.pv0 = null; }
  const vy = (_c.y - U.prev.y) / dt; U.prev.copy(_c); const ay = (vy - U.vy) / dt; U.vy += (vy - U.vy) * Math.min(1, dt * K.velK); U.ay += (clamp(ay, -K.accMax, K.accMax) - U.ay) * Math.min(1, dt * K.accK);
  if(pv){ if(!U.pv0) U.pv0 = pv.clone(); _a.subVectors(pv, U.pv0).divideScalar(dt); U.pv0.copy(pv); _a.y = 0; if(_a.length() > K.accMax) _a.setLength(K.accMax); U.a.x += (_a.x - U.a.x) * Math.min(1, dt * K.accK); U.a.z += (_a.z - U.a.z) * Math.min(1, dt * K.accK); }
  U.a.y = U.ay; U.v.set(pv ? pv.x : 0, U.vy, pv ? pv.z : 0);
  G.getWorldQuaternion(_q); _v.set(0, 0, 1).applyQuaternion(_q); const psi = Math.atan2(_v.x, _v.z); FA.set(Math.sin(psi), 0, Math.cos(psi)); RA.set(-Math.cos(psi), 0, Math.sin(psi));
  const L = R.ownLegs, mode = L && L.w > 0.3 ? L.mode : null, onFoot = !mounted && !P.trans && !P.dead && mode !== 'prone' && mode !== 'mount';
  let pitch = 0, roll = 0, yaw = 0;
  // ---- leaning into a change of pace (only on his feet) ----
  const tp = onFoot ? clamp(U.a.dot(FA) * K.lean, -K.leanMax, K.leanMax) : 0, tr = onFoot ? clamp(U.a.dot(RA) * K.leanSide, -K.leanMax, K.leanMax) : 0;
  [U.p, U.pv] = spring(U.p, U.pv, tp, K.leanK, K.leanZ, dt); [U.r, U.rv] = spring(U.r, U.rv, tr, K.leanK, K.leanZ, dt); pitch += U.p; roll += U.r;
  // ---- the stride: shoulders against the swinging leg, the trunk over the standing foot ----
  const sw = onFoot && L && L.on && L.feet ? L.feet.find(f => f.sw) : null, speed = Math.hypot(U.v.x, U.v.z);
  if(sw){ const sd = sw === L.feet[0] ? -1 : 1, k = sw.sw.t, s = Math.sin(Math.PI * k), m = Math.min(1, speed / 1.2); yaw -= sd * K.twist * s * m; roll -= sd * K.sway * s * m;
    U.ph = (sd < 0 ? 0 : Math.PI) + Math.PI * k; if(k > 0.97 && U.fall !== sw.sw){ U.fall = sw.sw; U.lagV.y -= K.gun.kick * m; } }   // (a footfall: the rifle dips)
  // ---- breathing, stood still ----
  const still = onFoot && speed < 0.25 || mode === 'prone' || mode === 'kneel'; if(still) pitch += Math.sin(U.t * Math.PI * 2 * K.breathHz) * K.breath;
  // the trunk takes it all (from the hips up), the neck takes it back so the head holds steady
  if(Math.abs(pitch) > 1e-5){ turnBone(D.Spine, RA, -pitch * 0.55); turnBone(D.Spine1, RA, -pitch * 0.45); }   // (about his right: forward is −)
  if(Math.abs(roll) > 1e-5){ turnBone(D.Spine, FA, roll * 0.6); turnBone(D.Spine1, FA, roll * 0.4); }
  if(Math.abs(yaw) > 1e-5){ turnBone(D.Spine1, UP, yaw * 0.5); turnBone(D.Spine2, UP, yaw * 0.5); }
  if(D.Neck){ const g = K.gaze; turnBone(D.Neck, RA, pitch * g); turnBone(D.Neck, FA, -roll * g); turnBone(D.Neck, UP, -yaw * g); }
  // ---- the rifle's weight: a spring that lags the chest (a dip at each footfall, a drop on landing), the muzzle's figure of eight walking ----
  const G2 = K.gun, dz = a => Math.sign(a) * Math.max(0, Math.abs(a) - G2.dead);   // (a nudge under `dead` m/s² is not felt)
  for(const ax of ['x', 'y', 'z']){ U.lagV[ax] += (-G2.k * U.lag[ax] - G2.c * U.lagV[ax] - dz(U.a[ax]) * G2.m) * dt; U.lag[ax] += U.lagV[ax] * dt; }
  if(U.lag.length() > G2.max) U.lag.setLength(G2.max); R.gunLag = U.lag;
  const fire = S.firing ? G2.fire : 1, sm = sw ? Math.min(1, speed / 1.2) * fire : 0, ph = U.ph || 0;
  U.sway.y += (G2.yaw * Math.sin(ph) * sm - U.sway.y) * Math.min(1, dt * 10); U.sway.p += (G2.pitch * Math.sin(2 * ph) * sm - U.sway.p) * Math.min(1, dt * 10); R.gunSway = U.sway; }

// climbing on or off: his eyes on what his left hand takes hold of (w = how much; target = that point)
const _h = V3(), _d = V3();
export function lookAtHold(D, target, w){ if(!D.Head || !D.Neck || w < 0.02) return; D.Head.getWorldPosition(_h); _d.subVectors(target, _h); const dist = Math.hypot(_d.x, _d.z); if(dist < 0.05) return;
  CV.G.getWorldQuaternion(_q); _v.set(0, 0, 1).applyQuaternion(_q); const fy = Math.atan2(_v.x, _v.z), want = Math.atan2(_d.x, _d.z), dy = clamp(Math.atan2(Math.sin(want - fy), Math.cos(want - fy)), -0.9, 0.9) * w;
  turnBone(D.Neck, UP, dy * 0.45); turnBone(D.Head, UP, dy * 0.55);
  RA.set(-Math.cos(fy + dy), 0, Math.sin(fy + dy)); const dp = clamp(Math.atan2(_d.y, dist), -0.8, 0.4) * w; turnBone(D.Neck, RA, dp * 0.4); turnBone(D.Head, RA, dp * 0.6); }   // (about his right: down is −)
// after the hold: the head steadied — its turn eased toward where it is heading (a quick jolt from the body under it is mostly taken out, a real turn
//   of the head follows a moment later); `steady` = how much of the jolt is taken out, `rate` = how fast the eased turn follows (/s)
const _hq = new THREE.Quaternion(), _hp = new THREE.Quaternion();
export function steadyHead(R, dt){ const D = R.pup && R.pup.D, U = R.upper, K = SOLDIER_UPPER.head; if(!D || !D.Head || !U || !dt) return;
  D.Head.getWorldQuaternion(_hq); if(!U.hq || U.hq.angleTo(_hq) > K.snap){ U.hq = _hq.clone(); return; }
  U.hq.slerp(_hq, Math.min(1, dt * K.rate)); _hq.slerp(U.hq, K.steady); D.Head.parent.getWorldQuaternion(_hp); D.Head.quaternion.copy(_hp.invert().multiply(_hq)); D.Head.updateMatrixWorld(true); }
