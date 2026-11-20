// actors/soldier-mount.js — Z342 GETTING ON AND OFF THE WAY A RIDER DOES: he used to walk to the ride's right side and glide on a straight line up into
//   the seat in a frozen kneel (through the horse's body), and getting off he floated up out of the saddle and sank through it. Now, from the near
//   (left) side, as horsemen and every xe ôm passenger do:
//   · the horse: he walks to the left stirrup (round the head or tail if he is on the far side), faces the saddle, left hand on the pommel, raises the
//     left foot into the stirrup, springs off the right foot and stands up in the stirrup leaning over the saddle, swings the right leg straight over
//     the croup, turns to face ahead and settles into the saddle, the right foot finding its stirrup; getting off, all of it the other way round:
//     stand in the stirrups, the right leg back over the croup, down the horse's side on the left stirrup, the right foot to the ground, the left
//     foot out, standing beside it;
//   · the xe ôm: beside the pillion, a hand on the rear rack, the right leg lifted high behind and over the seat, sat down, the feet onto the pegs —
//     and off again the same way;
//   · a ba gác / bán tải bed: the left foot up onto the bed edge, a hand on the side, a push up, the right foot in, turned to face ahead; off, turned
//     out to the side, a step down, the other foot after.
// Each is a short timeline of key poses (config SOLDIER_MOUNT: where the hip joints are, which way the hips face, the lean, each foot, the left hand),
//   in the ride's own frame — left, up, ahead of the point under its seat — eased between; the legs reach them by IK, the rifle is carried low in the
//   right hand. The ride's own seat height sets the heights marked relative.
import * as THREE from 'three';
import { SOLDIER_MOUNT, XEOM } from '../../config.js';
import { CV, LEGKIT, S, heightAt, ik2 } from '../hub.js';

const V3 = () => new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const _a = V3(), _b = V3(), _c = V3(), _d = V3(), _e = V3(), _p = V3(), FH = V3(), RH = V3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = k => k * k * (3 - 2 * k), wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
// a steady walk eased in and out over the first / last r of it (smoothstep's middle runs at 1.5× the pace)
const glide = (u, r = 0.2) => { u = clamp(u, 0, 1); const v = 1 / (1 - r); return u < r ? v * u * u / (2 * r) : u > 1 - r ? 1 - v * (1 - u) ** 2 / (2 * r) : v * (u - r / 2); };
// the real soldier is there to pose: then getting on / off is his own
export function mountOwn(){ return !!(CV.real && CV.real.pup); }
const kindOf = H => !H.bike ? 'horse' : XEOM[H.bike].pose === 'stand' ? 'bed' : 'pillion';

// ---- the ride's frame, once at the start: O = the ground under the seat, Fm ahead, Lm its left, Hs = the seat's height (the hips' — or, in a bed, the feet's) ----
function frame(T){ const H = CV.H, F = T.fr = { O:V3(), Fm:V3(), Lm:V3(), Hs:0, seat:V3() }, f = CV.facing;
  F.Fm.set(Math.sin(f), 0, Math.cos(f)); F.Lm.set(Math.cos(f), 0, -Math.sin(f));
  if(!H.bike && CV.real && CV.real.seat){ CV.real.seat.updateWorldMatrix(true, false); CV.real.seat.getWorldPosition(F.seat); }
  else { const X = XEOM[H.bike] || { seat:[0.4, 0] }, b = H.body || H.B; b.updateWorldMatrix(true, false); b.localToWorld(F.seat.set(0, X.seat[0], X.seat[1])); }
  const gy = heightAt(F.seat.x, F.seat.z); F.O.set(F.seat.x, gy, F.seat.z); F.Hs = F.seat.y - gy; return F; }
// a point given in the ride's frame [left, up, ahead(, 1 = up measured from the seat)] → the world
function at(F, v, out){ out.copy(F.O).addScaledVector(F.Lm, v[0]).addScaledVector(F.Fm, v[2]); out.y += v[1] + (v[3] ? F.Hs : 0); return out; }

// ---- the plan: how long it takes; getting on, the walk to the stirrup first (round the ride when he is on its far side) ----
export function mountDur(T){ if(T.dur != null) return T.dur; const p = S.player, kind = T.kind = kindOf(CV.H), M = SOLDIER_MOUNT[kind], F = frame(T), K = M[T.k];
  T.climb = M.dur[T.k]; T.walkT = 0;
  if(T.k === 'on'){ const k0 = K[0].hips; T.spot = at(F, [k0[0], 0, k0[2]], V3()); T.spot.y = 0; T.path = [p.pos.clone().setY(0)];
    _a.subVectors(p.pos, F.O); const side = _a.x * F.Lm.x + _a.z * F.Lm.z, along = _a.x * F.Fm.x + _a.z * F.Fm.z, half = M.len / 2 + SOLDIER_MOUNT.clear;
    if(side < 0.25 && Math.abs(along) < half){ const end = (along >= 0 ? 1 : -1) * half, out = SOLDIER_MOUNT.clear;   // (on the far side: along it past its head / tail, across in front of it, back along the near side)
      T.path.push(_b.copy(F.O).addScaledVector(F.Fm, end).addScaledVector(F.Lm, Math.min(side, -out)).setY(0).clone(), _b.copy(F.O).addScaledVector(F.Fm, end).addScaledVector(F.Lm, out).setY(0).clone()); }
    T.path.push(T.spot); let L = 0; for(let i = 1; i < T.path.length; i++) L += T.path[i].distanceTo(T.path[i - 1]); T.walkLen = L; T.walkT = clamp(L / SOLDIER_MOUNT.walkV, SOLDIER_MOUNT.walkMin, SOLDIER_MOUNT.walkMax); }
  return (T.dur = T.walkT + T.climb); }
// the key poses at u (0…1 through the climb), eased between: hips, yaw, lean, feet, the hand
function keysAt(K, u, F){ let i = 0; while(i < K.length - 2 && u > K[i + 1].u) i++; const a = K[i], b = K[i + 1], t = smooth(clamp((u - a.u) / Math.max(1e-4, b.u - a.u), 0, 1));
  const hA = v => v[1] + (v[3] ? F.Hs : 0), L = (x, y) => [x[0] + (y[0] - x[0]) * t, hA(x) + (hA(y) - hA(x)) * t, x[2] + (y[2] - x[2]) * t];   // (heights made absolute before they are eased)
  return { hips:L(a.hips, b.hips), la:L(a.la, b.la), ra:L(a.ra, b.ra), yaw:a.yaw + wrapA(b.yaw - a.yaw) * t, lean:(a.lean || 0) + ((b.lean || 0) - (a.lean || 0)) * t, lh:(a.lh || 0) + ((b.lh || 0) - (a.lh || 0)) * t }; }
const climbU = T => clamp((T.t - (T.k === 'on' ? T.walkT : 0)) / T.climb, 0, 1);
// ---- every frame of the transition (game/cavalry.js): where he is (the camera follows his hips), which way he faces ----
export function mountMove(p, T){ const F = T.fr, f = CV.facing;
  if(T.k === 'on' && T.t < T.walkT){ const u = glide(T.t / T.walkT), P = T.path; let d = u * T.walkLen, i = 1;   // walking there along the path
    while(i < P.length - 1 && d > P[i].distanceTo(P[i - 1])){ d -= P[i].distanceTo(P[i - 1]); i++; } const seg = P[i].distanceTo(P[i - 1]) || 1;
    p.pos.lerpVectors(P[i - 1], P[i], Math.min(1, d / seg)); _a.subVectors(P[i], P[i - 1]);
    const face = f + SOLDIER_MOUNT[T.kind].on[0].yaw, walk = Math.atan2(_a.x, _a.z), k = smooth(clamp((T.t / T.walkT - 0.6) / 0.4, 0, 1));
    p.facing = wrapA(walk + wrapA(face - walk) * k); }
  else { const u = climbU(T), K = keysAt(SOLDIER_MOUNT[T.kind][T.k], u, F), w = T.k === 'on' ? smooth(u) : 1 - smooth(u);
    at(F, K.hips, p.pos); p.pos.y = 0; p.pos.x += (CV.hPos.x - F.seat.x) * w; p.pos.z += (CV.hPos.z - F.seat.z) * w;   // (under his hips — and, the nearer the seat, the ride's own centre, where a rider's place is)
    p.facing = wrapA(f + K.yaw); }
  p.vel.set(0, 0, 0); p.mesh.position.set(p.pos.x, heightAt(p.pos.x, p.pos.z), p.pos.z); p.mesh.rotation.y = p.facing; CV.G.position.set(0, 0, 0); }

// ---- his body at the key pose (actors/soldier-legs.js, mode 'mount'): the pelvis, the torso, the legs onto their feet ----
let lastT = null;
export function mountPose(D, len, ankleH, slope){ const T = CV.trans && CV.trans.fr ? (lastT = CV.trans) : lastT; if(!T || !T.fr) return; if(!CV.trans && CV.mounted) frame(T);   // (just up: held on his seat — wherever the ride has got to — while the riding clip eases in)
  const F = T.fr, K = keysAt(SOLDIER_MOUNT[T.kind][T.k], climbU(T), F), { setHips, torso, aim } = LEGKIT;
  const yaw = CV.facing + K.yaw; FH.set(Math.sin(yaw), 0, Math.cos(yaw)); RH.set(-Math.cos(yaw), 0, Math.sin(yaw));
  at(F, K.hips, _p); setHips(D, _p, _a.copy(UP).multiplyScalar(Math.cos(K.lean * 0.4)).addScaledVector(FH, Math.sin(K.lean * 0.4)), RH);
  torso(D, _a.copy(UP).multiplyScalar(Math.cos(K.lean)).addScaledVector(FH, Math.sin(K.lean)), yaw);
  for(const [L1, key, sd] of [['Left', K.la, -1], ['Right', K.ra, 1]]){ at(F, key, _b); const onGround = key[1] < 0.02; if(onGround) _b.y = heightAt(_b.x, _b.z); _b.y += ankleH;
    D[L1 + 'UpLeg'].getWorldPosition(_c); _d.copy(_b).addScaledVector(FH, 0.6).addScaledVector(UP, 0.5).addScaledVector(RH, sd * 0.1);
    _e.subVectors(_b, _c); if(_e.dot(F.Fm) < -0.25 && _b.y > _c.y - 0.4) _d.copy(_c).add(_b).multiplyScalar(0.5).addScaledVector(UP, -0.6);   // (swung back over the croup: the leg long, the knee down)
    else if(_b.y > _c.y - 0.25) _d.copy(_c).addScaledVector(FH, 0.4).addScaledVector(UP, 0.3);   // (a foot up high in front: the knee bends forward and up)
    ik2(D[L1 + 'UpLeg'], D[L1 + 'Leg'], D[L1 + 'Foot'], _b, _d);
    aim(D[L1 + 'Foot'], D[L1 + 'ToeBase'], _e.copy(FH).multiplyScalar(Math.cos(slope)).addScaledVector(UP, Math.sin(slope))); } }
// ---- after the hold: the left hand off the rifle onto the pommel / the rear rack / the bed's side while he climbs ----
export function mountHand(R){ const T = CV.trans, D = R.pup && R.pup.D; if(!T || !T.fr || T.crash || !D || !D.LeftArm || (T.k === 'on' && T.t < T.walkT)) return;
  const K = keysAt(SOLDIER_MOUNT[T.kind][T.k], climbU(T), T.fr); if(K.lh < 0.02) return;
  at(T.fr, SOLDIER_MOUNT[T.kind].grab, _b); D.LeftHand.getWorldPosition(_c); _b.lerp(_c, 1 - K.lh);
  D.LeftArm.getWorldPosition(_d); _d.addScaledVector(UP, -0.4); ik2(D.LeftArm, D.LeftForeArm, D.LeftHand, _b, _d); }
