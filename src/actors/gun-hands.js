// actors/gun-hands.js — GUN 1 THE HANDS ON THE GUN, HELD TO A MAN'S OWN JOINTS (config GUNFEEL.hold; the soldier on his feet — actors/real-cav.js holdReal):
//   measured on both soldiers × 16 weapons × stand / kneel / prone (tools/pose-studio.mjs), the old hold put the palms on the gun and nothing else right:
//   · THE TRIGGER FINGER lay 15–22 cm from the trigger (it carried on along the hand, down past the trigger guard) — it is now laid by its own two-bone IK:
//     its last joint on the trigger's face when he aims, straight along the frame over the guard when he runs, carries or reloads (triggerFinger);
//     where the trigger is comes off the gun's own profile: just ahead of the pistol grip's front edge, a finger's breadth over the guard's bottom (triggerAt)
//   · BOTH WRISTS were bent 55–105° (a hand turned to a fixed direction whatever the forearm did): a hand now gives toward its forearm until the wrist
//     bends no more than GUNFEEL.hold.wrist (wristGive) — the palm stays on its spot, the hand lies round it at the angle his arm allows
//   · THE SUPPORT ARM was out to 93–96 % of its length stood and 98–99 % lying (the palm already slid back to the magazine): reachFeel reads its stretch
//     each frame and brings the left shoulder forward (the collar bone, then the chest turned further side-on: holdReal's blade) until the arm is bent
//   · THE EYE (eyePoint: off the head's own axes, so bowing the head lowers it) — the old weld bowed the head ~45° and still left the eye 8–9 cm over a
//     low sight and 6–8 cm to its left, and lying down 8–16 cm UNDER the sight: the head now bows / lifts / tilts within a man's range and the gun is
//     brought the rest of the way to the eye (holdReal: the butt a little higher and further in — it comes back down when he lowers the gun)
//   · PORT ARMS at a sprint folded the left arm to 13 % of its length (the handguard on his left shoulder): carryClear holds the gun off him
//   · a weapon with no cheek weld (the B41 on his shoulder, a hip-fired gun) still has his head brought up (headLevel)
//   Mounted (the saddle, the pillion, a bed) the hold is unchanged.
import * as THREE from 'three';
import { GUNFEEL } from '../../config.js';
import { LEGKIT, ik2, turnBone } from '../hub.js';

const V3 = () => new THREE.Vector3(), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const _f = V3(), _h = V3(), _a = V3(), _b = V3(), _c = V3(), _t = V3(), _s = V3(), _p = V3(), _d = V3();

// the arm's stretch: shoulder → wrist over its two bones' length (1 = straight)
export function armStretch(D, side){ const a = D[side + 'Arm'], f = D[side + 'ForeArm'], h = D[side + 'Hand']; if(!a || !f || !h) return 0;
  a.getWorldPosition(_a); f.getWorldPosition(_b); h.getWorldPosition(_c); return _a.distanceTo(_c) / (_a.distanceTo(_b) + _b.distanceTo(_c) || 1); }
// the wrist's bend: the forearm against the hand (wrist → middle knuckle), rad
export function wristBend(D, side){ const f = D[side + 'ForeArm'], h = D[side + 'Hand'], m = D[side + 'HandMiddle1']; if(!f || !h || !m) return 0;
  f.getWorldPosition(_a); h.getWorldPosition(_b); m.getWorldPosition(_c); _a.subVectors(_b, _a).normalize(); _c.sub(_b).normalize(); return Math.acos(clamp(_a.dot(_c), -1, 1)); }
// the way a hand should point (want, unit) eased toward its own forearm until the wrist bends no more than max rad → out (unit)
export function wristGive(D, side, want, max, out){ const fa = D[side + 'ForeArm'], h = D[side + 'Hand']; out.copy(want); if(!fa || !h) return out;
  fa.getWorldPosition(_f); h.getWorldPosition(_h); _h.sub(_f); if(_h.lengthSq() < 1e-8) return out; _h.normalize();
  const th = Math.acos(clamp(_h.dot(want), -1, 1)); if(th <= max || th < 1e-3) return out; const t = (th - max) / th, s = Math.sin(th);
  return out.multiplyScalar(Math.sin((1 - t) * th) / s).addScaledVector(_h, Math.sin(t * th) / s).normalize(); }

// where the trigger is on this weapon → [share of its length from the middle, m over the middle]: a fitted weapon (actors/gun-fit.js) — ahead of the
//   grip's front edge, `up` over the bottom of what is there (the guard), kept within lo…hi under the bore; a hand-set one — off its grip point
const _trig = new Map();
export function triggerAt(g, len){ let t = _trig.get(g); if(t) return t; const T = GUNFEEL.hold.trig, bore = g.bore ?? 0.02;
  if(g.parts && g.parts.grip && g.rows){ const x = g.parts.grip[0] - T.ahead / len, N = g.rows.length, r = g.rows[clamp(Math.round((x + 0.5) * N - 0.5), 0, N - 1)];
    t = [x, clamp((r ? r[0] : bore - 0.06) + T.up, bore - T.lo, bore - T.hi)]; }
  else t = [g.grip[0] - T.bare[0] / len, g.grip[1] + T.bare[1]];
  _trig.set(g, t); return t; }
// the index finger: its last joint to the trigger (on = 1) or laid straight along the frame over the guard (on = 0), the tip curled across the
//   trigger / straight ahead. FR = the gun's frame { p, q, x (back to the butt), y (up), z (his left) }
export function triggerFinger(D, FR, g, len, on){ const i1 = D.RightHandIndex1, i2 = D.RightHandIndex2, i3 = D.RightHandIndex3, i4 = D.RightHandIndex4; if(!i1 || !i2 || !i3) return;
  const T = GUNFEEL.hold.trig, t = triggerAt(g, len);
  _t.set(t[0] * len, t[1], 0).applyQuaternion(FR.q).add(FR.p);
  _s.copy(_t).addScaledVector(FR.y, T.safe[0]).addScaledVector(FR.x, -T.safe[1]).addScaledVector(FR.z, -T.safe[2]);   // (off it: over the guard, a little ahead, flat on the gun's right side)
  _t.addScaledVector(FR.z, -T.side).addScaledVector(FR.x, -T.face); _t.lerp(_s, 1 - on);
  i1.getWorldPosition(_p).addScaledVector(FR.z, -0.06).addScaledVector(FR.x, -0.03).addScaledVector(FR.y, 0.02);   // (the finger bows out to the right, round the frame)
  ik2(i1, i2, i3, _t, _p);
  if(i4){ _d.copy(FR.z).multiplyScalar(T.pad[0] * on).addScaledVector(FR.x, T.pad[1] * on - (1 - on)).normalize(); LEGKIT.aim(i3, i4, _d); } }

// his right eye off the head's own axes (up = head joint → crown; ahead = the aim, square to that; right): e = [right, up, ahead] m — bowing or
//   tilting the head moves it, as it does a man's (a point fixed over the head joint did not move when the head turned on it)
export function eyePoint(D, e, gu, gf, out){ D.Head.getWorldPosition(out); const top = D.HeadTop_End;
  if(top){ top.getWorldPosition(_a).sub(out); if(_a.lengthSq() > 1e-8){ _a.normalize(); _b.copy(gf).addScaledVector(_a, -gf.dot(_a)); if(_b.lengthSq() > 1e-6){ _b.normalize(); _c.crossVectors(_b, _a);
        return out.addScaledVector(_a, e[1]).addScaledVector(_b, e[2]).addScaledVector(_c, e[0]); } } }
  _c.crossVectors(gf, gu); return out.addScaledVector(gu, e[1]).addScaledVector(gf, e[2]).addScaledVector(_c, e[0]); }

// the head brought near upright before the weld (the aim clips hang it 35–55° over the gun and 25–35° to the side, the prone one 50° down: a face
//   to the ground, not to the sights): bowed forward no more than lim[0], back no more than −lim[2], tilted no more than lim[1] — w = how much (the weld)
export function headLevel(D, gu, gf, gr, lim, w){ const top = D.HeadTop_End; if(!top || !D.Head || !D.Neck) return; D.Head.getWorldPosition(_a); top.getWorldPosition(_b).sub(_a); if(_b.lengthSq() < 1e-8) return; _b.normalize();
  const up = _b.dot(gu), bow = Math.atan2(_b.dot(gf), up), tilt = Math.atan2(_b.dot(gr), up), db = (bow > lim[0] ? bow - lim[0] : bow < lim[2] ? bow - lim[2] : 0) * w, dt = (Math.abs(tilt) > lim[1] ? tilt - Math.sign(tilt) * lim[1] : 0) * w;
  if(Math.abs(db) > 1e-3){ turnBone(D.Neck, gr, db * 0.4); turnBone(D.Head, gr, db * 0.6); }   // (about his right: + lifts the head)
  if(Math.abs(dt) > 1e-3){ turnBone(D.Neck, gf, -dt * 0.4); turnBone(D.Head, gf, -dt * 0.6); } }
// the support arm's stretch over its comfortable reach → R.pro (rad the left collar bone is brought forward) and what is left for the chest's turn
//   (holdReal's blade); returns the excess (+ = too straight), 0 within the dead band
export function reachFeel(R, D, prone, dt){ const K = GUNFEEL.hold.reach, e = armStretch(D, 'Left') - (prone ? K.prone : K.comfort), pro = R.pro || 0;
  R.pro = clamp(pro + (e > K.dead[0] ? e * K.proK : e < -K.dead[1] ? -K.back : 0) * dt, 0, K.protract);
  return e > K.dead[0] ? (R.pro >= K.protract * 0.98 ? e : 0) : e < -K.dead[1] ? e : 0; }

// PORT ARMS kept off his left shoulder: the gun's place cc (its hold frame's origin, turned q) moved until the support palm's spot (pt = [share, m] on
//   the gun) is at least GUNFEEL.hold.carry.min of the left arm's length from the shoulder joint — out ahead of him, not on it
export function carryClear(D, cc, q, pt, grip, len, armL, armR, gf){ const C = GUNFEEL.hold.carry, mn = C.min * armL; if(!D.LeftArm) return;
  for(let it = 0; it < 2; it++){ D.LeftArm.getWorldPosition(_a); _b.set(pt[0] * len, pt[1], 0).applyQuaternion(q).add(cc).sub(_a); const d = _b.length(); if(d >= mn) break;
    _b.y *= 0.3; _b.addScaledVector(gf, 0.5 * (d || 0.1)); if(_b.lengthSq() < 1e-8) _b.copy(gf); cc.addScaledVector(_b.normalize(), (mn - d) * 1.15); }
  if(D.RightArm && grip){ D.RightArm.getWorldPosition(_a); _b.set(grip[0] * len, grip[1], 0).applyQuaternion(q).add(cc).sub(_a); const d = _b.length(), mx = C.max * armR; if(d > mx) cc.addScaledVector(_b.normalize(), mx - d); } }   // (and never so far out that the right arm, on the grip, locks straight)
