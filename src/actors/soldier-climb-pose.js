// actors/soldier-climb-pose.js — Z451 HIS BODY ON THE FACE (game/soldier-climb.js runs the climb; the soldier's model has no climbing clip, so it is
//   posed here by IK, in the face's own frame — out from it, up, along it): the hips a hand off the face, the chest leaning in; four limbs on holds
//   up the face, moving diagonal pairs (right hand with left foot, then left hand with right foot), each limb arcing out and up one stride while the
//   others hold, the body rising between them; palms flat on the face fingers up, toes into it, knees and elbows out; the head turned up to the hand
//   that reaches. Over the top: both hands onto the top edge, a pull up until the chest is over it, the right knee up onto it, the left foot after,
//   then up on his feet (a low piece of cover: a hop, hands on its top, a knee up). The rifle rides slung across his back, muzzle up behind the left
//   shoulder, from the moment he steps to the face until he is up on top — eased off his hold and back into it.
import * as THREE from 'three';
import { CLIMB } from '../../config.js';
import { CV, LEGKIT, S, climbRecess, curlHand, ik2, lookAtHold, rollHand } from '../hub.js';

const C = CLIMB, V3 = () => new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = k => k * k * (3 - 2 * k);
const N = V3(), F = V3(), RK = V3(), Q = V3(), _a = V3(), _b = V3(), _c = V3(), _d = V3(), _e = V3();
// the targets this frame: hips, lean, the feet (ankle points, 0 left · 1 right), the hands (wrist points) and how far the hands are on the face (hw)
const T = { key:-1, hip:V3(), lean:0, feet:[V3(), V3()], fOn:[true, true], hands:[V3(), V3()], hw:0, look:V3() };
// a point d out from the face, y up (world), s along it to his right
const at = (out, d, y, s) => out.copy(Q).addScaledVector(N, d - climbRecess(CV.climb, y)).addScaledVector(RK, s).setY(y);   // (the face's own lean: a battered wall, a rock's bulge)
// mantle / vault key poses: [u, hip d, hip y, lean, LF [d, y], RF [d, y], hands [d, y], hw] — y over the top (the vault's ground is −h)
const MANTLE = [[0, 0.36, -1.07, 0.15, [0.12, -1.85], [0.12, -1.65], [-0.08, 0], 1], [0.3, 0.24, -0.5, 0.5, [0.12, -1.3], [0.12, -1.05], [-0.12, 0], 1],
  [0.55, 0.02, -0.04, 1.0, [0.12, -0.75], [-0.12, 0], [-0.3, 0], 1], [0.8, -0.35, 0.5, 0.55, [-0.2, 0], [-0.48, 0], [-0.55, 0.35], 0.35], [1, -1, 0.95, 0.05, [-1, 0], [-1, 0], [-0.7, 0.6], 0]];
function keys(K, u, vault){ const h = K.h, d0 = vault ? Math.max(0.45, K.d0 || 0.5) : 0, inn = K.in || C.mantleIn;
  const L = vault ? [[0, d0, 0.95 - h, 0.1, [d0, -h], [d0 - 0.05, -h], [-0.1, 0], 0], [0.25, 0.42, 0.8 - h, 0.45, [0.45, -h], [0.4, -h], [-0.1, 0], 1], [0.55, 0, 0.35, 0.75, [0.2, -h * 0.5], [-0.15, 0], [-0.25, 0], 1],
    [0.8, -0.35, 0.7, 0.35, [-0.25, 0], [-0.45, 0], [-0.4, 0.3], 0.3], [1, -1, 0.95, 0.05, [-1, 0], [-1, 0], [-0.6, 0.6], 0]] : MANTLE;
  let i = 0; while(i < L.length - 2 && u > L[i + 1][0]) i++; const a = L[i], b = L[i + 1], t = smooth(clamp((u - a[0]) / (b[0] - a[0]), 0, 1)), m = (x, y) => x + (y - x) * t;
  const dd = v => v === -1 ? -inn : v;   // (−1: where he stands up on top, in from the rim)
  const top = K.top, s = 0.13; at(T.hip, m(dd(a[1]), dd(b[1])), top + m(a[2], b[2]), 0); T.lean = m(a[3], b[3]); T.hw = m(a[7], b[7]);
  at(T.feet[0], m(dd(a[4][0]), dd(b[4][0])), Math.max(K.y0, top + m(a[4][1], b[4][1])), -s); at(T.feet[1], m(dd(a[5][0]), dd(b[5][0])), Math.max(K.y0, top + m(a[5][1], b[5][1])), s);
  for(let k = 0; k < 2; k++) T.fOn[k] = T.feet[k].y > top - 0.05 || T.feet[k].y < K.y0 + 0.02 ? false : true;
  for(let k = 0; k < 2; k++) at(T.hands[k], m(a[6][0], b[6][0]), top + m(a[6][1], b[6][1]), (k ? 1 : -1) * C.off.handW); T.look.copy(Q).addScaledVector(N, -2).setY(top + 0.3); }
// up the face: diagonal pairs, each limb's hold one stride (×2) above its last, the moving one arcing out off the face
function gait(K, c){ const s = C.stride, u = c / (2 * s), O = C.off, top = K.top, y0 = K.y0 + C.hipStand;
  at(T.hip, O.hip, y0 + c, Math.sin(u * Math.PI * 2) * 0.03); T.lean = 0.15; T.hw = 1; let hi = -1, hy = -1e9;
  for(const [k, hand, sd, o] of [[1, true, 1, 0], [0, false, -1, 0], [0, true, -1, 0.5], [1, false, 1, 0.5]]){ const w = u - o, n = Math.floor(w), f = w - n, base = y0 + (hand ? O.handY : O.footY) + s * (2 * o - 0.5);
    const mv = f < 0.5, y = base + 2 * s * (n + (mv ? smooth(f * 2) : 1)), arc = mv && c > 0.02 ? Math.sin(Math.PI * f * 2) * 0.1 : 0;
    if(hand){ const yy = Math.min(y, top - 0.02), lip = yy >= top - 0.03; at(T.hands[k], lip ? -0.08 : O.hand + arc, lip ? top : yy, sd * O.handW); if(mv && y > hy){ hy = y; hi = k; } }
    else { at(T.feet[k], O.foot + arc, Math.max(K.y0, y), sd * O.footW); T.fOn[k] = y > K.y0 + 0.03; } }
  T.look.copy(T.hands[hi < 0 ? 1 : hi]).addScaledVector(UP, 0.25); }
function targets(){ const K = CV.climb, key = K.t * 7 + K.ph.length; if(T.key === key) return T; T.key = key;
  N.set(K.nx, 0, K.nz); F.copy(N).negate(); const yaw = Math.atan2(F.x, F.z); RK.set(-Math.cos(yaw), 0, Math.sin(yaw)); Q.set(K.qx, 0, K.qz);
  if(K.ph === 'mantle') keys(K, clamp(K.t / C.mantleT, 0, 1), false); else if(K.ph === 'vault'){ if(K.d0 == null) K.d0 = (K.fx0 - K.qx) * K.nx + (K.fz0 - K.qz) * K.nz; keys(K, clamp(K.t / C.vaultT, 0, 1), true); }
  else gait(K, K.ph === 'climb' ? K.c : 0); return T; }
// ---- the legs, hips and trunk (actors/soldier-legs.js, mode 'climb') ----
export function climbBody(D, len, ankleH, slope){ const K = CV.climb; if(!K || K.ph === 'top' || K.ph === 'fall' || K.ph === 'reach') return; const t = targets(), { setHips, torso, aim } = LEGKIT, yaw = Math.atan2(F.x, F.z);
  setHips(D, t.hip, _a.copy(UP).multiplyScalar(Math.cos(t.lean * 0.4)).addScaledVector(F, Math.sin(t.lean * 0.4)), RK);
  torso(D, _a.copy(UP).multiplyScalar(Math.cos(t.lean)).addScaledVector(F, Math.sin(t.lean)), yaw);
  for(const [L1, k, sd] of [['Left', 0, -1], ['Right', 1, 1]]){ const ft = t.feet[k]; _b.copy(ft).addScaledVector(UP, ankleH); if(t.fOn[k]) _b.addScaledVector(N, -0.02);
    D[L1 + 'UpLeg'].getWorldPosition(_c); _d.copy(_c).add(_b).multiplyScalar(0.5).addScaledVector(N, 0.6).addScaledVector(RK, sd * 0.18).addScaledVector(F, -0.1);   // (knees out from the face, a little apart)
    ik2(D[L1 + 'UpLeg'], D[L1 + 'Leg'], D[L1 + 'Foot'], _b, _d);
    aim(D[L1 + 'Foot'], D[L1 + 'ToeBase'], _e.copy(F).multiplyScalar(Math.cos(slope)).addScaledVector(UP, Math.sin(slope))); } }   // (toes into the face, or flat on the top)
// ---- the arms onto the face, the rifle slung on his back; w eases it from / back to his hold (actors/real-cav.js) ----
const _gp = V3(), _gx = V3(), _gy = V3(), _gz = V3(), _gm = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _q0 = new THREE.Quaternion(), _p0 = V3(), _s1 = new THREE.Vector3(1, 1, 1), _fw = V3(), _rt = V3();
export function climbArms(R, G, w){ const D = R.pup && R.pup.D, K = CV.climb; if(!D || !K || !D.Spine2 || !D.LeftArm) return false; const p = S.player, f = p ? p.facing : 0;
  _fw.set(Math.sin(f), 0, Math.cos(f)); _rt.set(-Math.cos(f), 0, Math.sin(f));
  // the rifle across his back: its centre a hand behind the upper back, the muzzle up over the left shoulder, its top away from him
  const met = R.arms._metric && R.arms._metric[R.armK], gun = met && met.visible ? met : R.cb;
  if(gun){ D.Spine2.getWorldPosition(_gp); _gp.addScaledVector(_fw, -0.19).addScaledVector(UP, 0.02);
    _gx.copy(UP).multiplyScalar(-Math.cos(0.62)).addScaledVector(_rt, Math.sin(0.62));   // (+X runs to the butt: down toward his right hip)
    _gy.copy(_fw).negate().addScaledVector(_gx, _fw.dot(_gx)).normalize(); _gz.crossVectors(_gx, _gy); _gm.makeBasis(_gx, _gy, _gz); _gq.setFromRotationMatrix(_gm);
    _gm.compose(_gp, _gq, _s1); _mi.copy(G.matrixWorld).invert(); _gm.premultiply(_mi);
    if(w < 0.999){ _p0.copy(gun.position); _q0.copy(gun.quaternion); _gm.decompose(gun.position, gun.quaternion, gun.scale); gun.position.lerpVectors(_p0, gun.position, w); gun.quaternion.slerpQuaternions(_q0, gun.quaternion, w); }
    else _gm.decompose(gun.position, gun.quaternion, gun.scale); gun.updateMatrixWorld(true); }
  if(K.ph === 'top' || K.ph === 'fall') return true;   // (up on top: only the rifle comes back round; his hold has the hands)
  const t = targets(), hw = t.hw * w; if(hw < 0.01) return true;
  for(const [L1, k, sd] of [['Left', 0, -1], ['Right', 1, 1]]){ const onTop = t.hands[k].y >= K.top - 0.03 && K.ph !== 'reach';
    _b.copy(t.hands[k]).addScaledVector(N, onTop ? 0 : 0.05).addScaledVector(UP, onTop ? 0.05 : -0.07); D[L1 + 'Hand'].getWorldPosition(_c); _b.lerp(_c, 1 - hw);
    D[L1 + 'Arm'].getWorldPosition(_d); _d.addScaledVector(UP, -0.4).addScaledVector(N, 0.35).addScaledVector(RK, sd * 0.45);   // (elbows out and down)
    ik2(D[L1 + 'Arm'], D[L1 + 'ForeArm'], D[L1 + 'Hand'], _b, _d);
    if(D[L1 + 'HandMiddle1']){ LEGKIT.aim(D[L1 + 'Hand'], D[L1 + 'HandMiddle1'], onTop ? _e.copy(F).addScaledVector(UP, -0.25) : _e.copy(UP).addScaledVector(F, 0.35)); rollHand(D, L1, _e.copy(RK).multiplyScalar(sd), hw); }   // (palm flat on the face, fingers up · on the top, fingers over its lip)
    curlHand(D, L1, 0.5 * hw, _c.copy(t.hands[k]).addScaledVector(F, 0.1), 0, 0.6); }
  lookAtHold(D, t.look, 0.75 * hw); return true; }
