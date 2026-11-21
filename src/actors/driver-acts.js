// actors/driver-acts.js — Z331 THE DRIVER OFF THE RIDE: the crawl to a downed bike, the heave that rights it, and giving himself up when the soldier falls
//   · a spill: he scrambles off his back onto all fours and crawls hell for leather to the bike (round its end if it lies between them), head up, rump
//     wagging; he squats beside it facing it, one hand on the bars and one on the seat, knees bent, back flat, and heaves — it comes up part way, slips
//     back (a grunt), a breath and a fresh grip, then the big heave brings it up, shuffling in step by step as it rises, trembling with the effort;
//   · the soldier is shot down: he abandons the ride at once — jumps off (moving, it goes over and slides), runs to the body with both hands in the air,
//     drops to his knees beside it, hands up, then laced behind his head, face down, trembling; on foot already, he drops to his knees where he is.
//     He stays so until the soldier is back (respawn) or the run starts over (driverBack).
// Every pose is built fresh each frame (rest pose → hips placed → limbs by two-bone IK), and each change of pose is eased in from the last (snapPose /
//   blendPose: the hips by their place and turn in the world, every other joint by its own turn).
import * as THREE from 'three';
import { RIDE, RIDE_ACT, RIDE_TALK, XEOM } from '../../config.js';
import { BIOME, CV, DRIVER_BREAK, DRIVER_RANT, RIDE_VOICE, S, burst, curlHand, floatText, heightAt, hudOn, ik2, rollHand, scene, sfx, spawnPart } from '../hub.js';

const V3 = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const _a = V3(), _b = V3(), _c = V3(), _d = V3(), _e = V3(), _f = V3(), _g = V3(), _h = V3(), _t1 = V3(), _t2 = V3(), _t3 = V3(), _hA = V3(), _hB = V3();
const _n1 = V3(), _n2 = V3(), _n3 = V3(), _n4 = V3(), _q = Q(), _q2 = Q(), _qw = Q(), _qp = Q();
const UPW = new THREE.Vector3(0, 1, 0), FWD = V3(), RT = V3(), RC = V3(), RU = V3(), RF = V3(), RR = V3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = k => k * k * (3 - 2 * k), mix = (a, b, k) => a + (b - a) * k;
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const SIDES = [['Left', -1], ['Right', 1]];   // (sd: which way is outward for that hand / knee, along his right)
export const DRIVER_ACTS = new Set(['crawl', 'lift', 'bail', 'run', 'kneel']);

// ---- bones (each helper has its own scratch vectors, so a caller's are never trodden on) ----
const _ia = V3(), _ib = V3(), _ip = V3(), _iq = Q(), _iqw = Q(), _iqp = Q();
function aim(b, c, dir){ if(!b || !c) return; b.getWorldPosition(_ia); c.getWorldPosition(_ib); _ib.sub(_ia); if(_ib.lengthSq() < 1e-10 || dir.lengthSq() < 1e-10) return; _ib.normalize();
  _iq.setFromUnitVectors(_ib, _ip.copy(dir).normalize()); b.getWorldQuaternion(_iqw); _iqw.premultiply(_iq); b.parent.getWorldQuaternion(_iqp); b.quaternion.copy(_iqp.invert().multiply(_iqw)); b.updateMatrixWorld(true); }
function turn(b, axis, ang){ if(!b || Math.abs(ang) < 1e-5) return; _iq.setFromAxisAngle(axis, ang); b.getWorldQuaternion(_iqw); _iqw.premultiply(_iq); b.parent.getWorldQuaternion(_iqp); b.quaternion.copy(_iqp.invert().multiply(_iqw)); b.updateMatrixWorld(true); }
const wp = (b, out) => b.getWorldPosition(out);
function rest(D){ for(const [b, q] of D.rest) b.quaternion.copy(q); D.mix.stopAllAction(); D.w.updateMatrixWorld(true); }
// his own lengths (world m), read once off the rest pose: thigh, shin, the whole arm, hips → shoulders
function lens(D){ if(D.len) return D.len; const B = D.B, P = n => wp(B[n], V3()), mid = (x, y) => P(x).add(P(y)).multiplyScalar(0.5);
  return D.len = { th:P('LeftUpLeg').distanceTo(P('LeftLeg')), sh:P('LeftLeg').distanceTo(P('LeftFoot')), arm:P('LeftArm').distanceTo(P('LeftForeArm')) + P('LeftForeArm').distanceTo(P('LeftHand')),
    tr:mid('LeftUpLeg', 'RightUpLeg').distanceTo(mid('LeftArm', 'RightArm')) }; }
// the heading he faces (yaw): FWD ahead of him, RT his right
function frame(hd){ FWD.set(Math.sin(hd), 0, Math.cos(hd)); RT.set(-Math.cos(hd), 0, Math.sin(hd)); }
// the pelvis: its hip joints' midpoint to p, its up (toward the spine) along up, its right (left hip → right hip) along rt
const _s1 = V3(), _s2 = V3(), _s3 = V3(), _s4 = V3(), _s5 = V3(), _s6 = V3(), _s7 = V3(), _s8 = V3(), _sm = new THREE.Matrix4(), _sm2 = new THREE.Matrix4(), _sq = Q(), _sq2 = Q(), _sqw = Q(), _sqp = Q();
function setHips(D, p, up, rt){ const B = D.B, h = B.Hips;
  wp(h, _s1); wp(B.Spine, _s2); wp(B.RightUpLeg, _s3); wp(B.LeftUpLeg, _s4);
  _s5.subVectors(_s2, _s1).normalize(); _s6.subVectors(_s3, _s4); _s7.crossVectors(_s6, _s5).normalize(); _s6.crossVectors(_s5, _s7); _sm.makeBasis(_s6, _s5, _s7);
  _s5.copy(up).normalize(); _s7.crossVectors(rt, _s5).normalize(); _s8.crossVectors(_s5, _s7); _sm2.makeBasis(_s8, _s5, _s7);   // (right × up points backward, in both frames)
  _sq.setFromRotationMatrix(_sm2); _sq2.setFromRotationMatrix(_sm); _sq.multiply(_sq2.invert());
  h.getWorldQuaternion(_sqw); _sqw.premultiply(_sq); h.parent.getWorldQuaternion(_sqp); h.quaternion.copy(_sqp.invert().multiply(_sqw)); h.updateMatrixWorld(true);
  wp(B.RightUpLeg, _s3); wp(B.LeftUpLeg, _s4); _s3.add(_s4).multiplyScalar(0.5); wp(h, _s1); _s1.add(p).sub(_s3); h.parent.worldToLocal(_s1); h.position.copy(_s1); h.updateMatrixWorld(true); }
const _sh = V3(); const shoulders = (D, out) => wp(D.B.LeftArm, out).add(wp(D.B.RightArm, _sh)).multiplyScalar(0.5);
// a leg: hip → knee → ankle at `ankle`, the knee bent toward `pole`; the foot laid along `toe` if given
function leg(D, L, ankle, pole, toe){ const B = D.B; ik2(B[L + 'UpLeg'], B[L + 'Leg'], B[L + 'Foot'], ankle, pole); if(toe) aim(B[L + 'Foot'], B[L + 'ToeBase'], toe); }
// the sole flat on the ground (the foot's own rest slope kept)
const _f1 = V3(), _f2 = V3(), _f3 = V3(), _f4 = V3();
function flatFoot(D, L){ const f = D.B[L + 'Foot'], t = D.B[L + 'ToeBase']; if(!f || !t) return; wp(f, _f1); wp(t, _f2); _f2.sub(_f1); const n = _f2.length(); if(n < 1e-5) return; _f2.divideScalar(n);
  _f3.set(_f2.x, 0, _f2.z); if(_f3.lengthSq() < 1e-6) return; _f3.normalize().multiplyScalar(Math.cos(D.toeSlope)); _f3.y = Math.sin(D.toeSlope);
  const ang = Math.acos(clamp(_f2.dot(_f3), -1, 1)); if(ang < 1e-4) return; _f4.crossVectors(_f2, _f3).normalize(); turn(f, _f4, ang); }
const arm = (D, L, hand, pole) => ik2(D.B[L + 'Arm'], D.B[L + 'ForeArm'], D.B[L + 'Hand'], hand, pole);
// Z361 lent to actors/driver-rant.js (the bike dies, he boots it and rows with the soldier on his own feet): the pelvis, his lengths, the rest pose, a flat sole, off the ride
export { setHips as drvHips, lens as drvLens, rest as drvRest, flatFoot as drvFlatFoot, toWorld as drvToWorld };
const gnd = (v, up = 0) => (v.y = heightAt(v.x, v.z) + up, v);

// ---- easing one pose into the next: a snapshot of where he was, blended toward what is built this frame ----
export function snapPose(D, dur){ const s = D.bl || (D.bl = { q:new Map(), hp:V3(), hq:Q() }); for(const [b] of D.rest){ let q = s.q.get(b); if(!q) s.q.set(b, q = Q()); q.copy(b.quaternion); }
  const h = D.B.Hips; h.updateWorldMatrix(true, false); h.getWorldPosition(s.hp); h.getWorldQuaternion(s.hq); s.t = 0; s.dur = Math.max(0.01, dur); s.on = true; }
export function blendPose(D, dt){ const s = D.bl; if(!s || !s.on) return; s.t += dt; const k = ease(clamp(s.t / s.dur, 0, 1)); if(k >= 1){ s.on = false; return; }
  const h = D.B.Hips; h.updateWorldMatrix(true, false); h.getWorldPosition(_a); h.getWorldQuaternion(_qw); _b.copy(s.hp).lerp(_a, k); _q2.copy(s.hq).slerp(_qw, k);
  for(const [b, q] of s.q){ if(b === h) continue; _q.copy(b.quaternion); b.quaternion.copy(q).slerp(_q, k); }
  h.parent.worldToLocal(_b); h.position.copy(_b); h.parent.getWorldQuaternion(_qp); h.quaternion.copy(_qp.invert().multiply(_q2)); D.w.updateMatrixWorld(true); }

// ---- the ride as it lies: its centre on the ground, its up / ahead / right in the world ----
const onRide = (H, arr, out, steered) => H.toWorld ? H.toWorld(arr, out, steered) : H.B.localToWorld(out.fromArray(arr));
const _rq = Q();
function rideFrame(H){ const b = H.body || H.B; H.B.updateWorldMatrix(true, true); b.getWorldQuaternion(_rq); RU.set(0, 1, 0).applyQuaternion(_rq); RF.set(0, 0, 1).applyQuaternion(_rq); RR.set(-1, 0, 0).applyQuaternion(_rq); H.root.getWorldPosition(RC); }
const sparks = (x, z) => spawnPart(x, heightAt(x, z) + 0.15, z, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, { color:Math.random() < 0.5 ? 0xffd27a : 0xc8b890, size:0.12 + Math.random() * 0.2, life:0.4, grav:-9, drag:1 });
const dust = (x, z, n, sz) => burst({ x, z }, BIOME.ground, n, 2.5, { y:heightAt(x, z) + 0.2, life:0.6, size:sz, smoke:true, grav:-0.3, drag:2, op:0.4 });
// down on its side, sliding to a stop (sparks and grit) — the crash's lying-there, shared with crashStep in actors/driver.js
export function downedRide(D, dt){ D.roll += ((D.side || 1) * 1.35 - D.roll) * Math.min(1, dt * 7);
  if(D.slide > 0.2){ D.slide *= Math.exp(-dt * 2.2); CV.hPos.x += Math.sin(CV.facing) * D.slide * dt; CV.hPos.z += Math.cos(CV.facing) * D.slide * dt; CV.speed = 0; if(Math.random() < 0.6) sparks(CV.hPos.x, CV.hPos.z); } }
// what he says (RIDE_TALK), floating over his own head — the soldier answers if he still can
function say(D, ev){ const T = RIDE_TALK[ev], now = performance.now() / 1000; if(!T || now < (D.sayAct || 0)) return; D.sayAct = now + 2.2; const i = (Math.random() * T.d.length) | 0, show = hudOn('talk');
  D.w.getWorldPosition(_a); if(show) floatText(T.d[i], RIDE_TALK.col.d, _a.clone().setY(_a.y + 2.2), 13); if(RIDE_VOICE.on && RIDE_VOICE.play) RIDE_VOICE.play('driver', ev, i);
  const p = S.player; if(T.s && T.s.length && p && !D.give){ const j = (Math.random() * T.s.length) | 0; setTimeout(() => { if(S.player === p && !D.give){ if(show) floatText(T.s[j], RIDE_TALK.col.s, new THREE.Vector3(p.pos.x, p.pos.y + 3.2, p.pos.z), 13); if(RIDE_VOICE.on && RIDE_VOICE.play) RIDE_VOICE.play('soldier', ev, j); } }, RIDE_TALK.reply * 1000); } }
// off the ride into the world, where he is (his heading kept, upright)
function toWorld(D){ const w = D.w; if(w.parent === scene) return; w.getWorldPosition(_a); w.getWorldQuaternion(_qw); scene.add(w); w.position.copy(_a); w.rotation.order = 'YXZ'; w.rotation.setFromQuaternion(_qw, 'YXZ'); w.rotation.x = 0; w.rotation.z = 0; w.scale.setScalar(RIDE.h / Math.max(1e-3, D.h0 || 1)); }
function steer(D, want, dt, rate){ const h = D.hd ?? D.w.rotation.y; D.hd = h + clamp(wrapA(want - h), -rate * dt, rate * dt); D.w.rotation.set(0, D.hd, 0); }

// ---- every frame, for the states this module owns ----
export function driverAct(H, D, dt){ D.t2 = (D.t2 || 0) + dt; const st = D.state;
  if(st === 'crawl') crawlStep(H, D, dt); else if(st === 'lift') heaveStep(H, D, dt);
  else { leftRide(H, D, dt); if(st === 'bail') bailStep(H, D, dt); else if(st === 'run') runStep(H, D, dt); else kneelStep(H, D, dt); } }

// ---- the crawl: onto all fours and off to the bike as fast as hands and knees will go ----
// the spot to make for: out from the bike's top (seat and bars) side, where his hands will go; past its end first if it lies between them
function heaveSpot(H, D, out){ rideFrame(H); _t1.set(RU.x, 0, RU.z); if(_t1.lengthSq() < 1e-4) _t1.copy(RR); _t1.normalize(); _t2.set(RF.x, 0, RF.z).normalize();
  const A = RIDE_ACT.heave, w = D.w.position, side = (w.x - RC.x) * _t1.x + (w.z - RC.z) * _t1.z, along = (w.x - RC.x) * _t2.x + (w.z - RC.z) * _t2.z, half = (XEOM[H.bike] ? XEOM[H.bike].len : 2) / 2 + 0.35;
  if(side > 0.3 || Math.abs(along) > half) return gnd(out.copy(RC).addScaledVector(_t1, (D.R.grip[0][1] + 0.05) * XEOM.k + A.off[0] + 0.2));
  return gnd(out.copy(RC).addScaledVector(_t2, (along >= 0 ? 1 : -1) * (half + 0.25)).addScaledVector(_t1, clamp(side, -0.6, 0.6))); }
function crawlStep(H, D, dt){ const A = RIDE_ACT.crawl, w = D.w; downedRide(D, dt); if(D.give) return kneelNow(H, D);
  heaveSpot(H, D, _h); const dx = _h.x - w.position.x, dz = _h.z - w.position.z, dist = Math.hypot(dx, dz);
  if(D.hd == null) D.hd = Math.atan2(dx, dz); steer(D, Math.atan2(dx, dz), dt, A.turn);
  const go = D.t2 > A.scramble * 0.4 ? A.v * Math.min(1, dist / 0.5 + 0.3) : 0;
  if(dist > 0.08){ w.position.x += Math.sin(D.hd) * go * dt; w.position.z += Math.cos(D.hd) * go * dt; } w.position.y = heightAt(w.position.x, w.position.z);
  D.ph = (D.ph || 0) + dt * Math.max(go, A.v * 0.35) / (A.reach * 1.25);
  crawlPose(D); blendPose(D, dt);
  if(D.t2 > A.scramble && (dist < 0.3 || D.t2 > A.max)) startHeave(H, D); }
function crawlPose(D){ const A = RIDE_ACT.crawl, B = D.B, w = D.w; rest(D); const L = lens(D), ph = D.ph; frame(D.hd);
  const g = heightAt(w.position.x, w.position.z), bob = Math.sin(ph * 2) * 0.012;
  const hipY = g + 0.06 + Math.sqrt(Math.max(0.01, L.th * L.th - A.kneeF * A.kneeF)) + bob, shY = g + 0.06 + L.arm * 0.93 + bob * 0.6;
  const beta = Math.asin(clamp((shY - hipY) / Math.max(0.1, L.tr), -0.4, 0.9));
  _t1.copy(FWD).multiplyScalar(Math.cos(beta)).addScaledVector(UPW, Math.sin(beta)); _t2.copy(w.position).setY(hipY);
  setHips(D, _t2, _t1, _t3.copy(RT).applyAxisAngle(FWD, Math.sin(ph) * 0.09));   // (the rump wags with the gait)
  shoulders(D, _a); turn(B.Spine, RT, clamp((shY - _a.y) / Math.max(0.1, L.tr), -0.4, 0.4));   // (shoulders brought to the height his arms want)
  turn(B.Spine2, FWD, -Math.sin(ph) * 0.07); turn(B.Spine1, UPW, Math.sin(ph) * 0.05);
  turn(B.Neck, RT, 0.75 + Math.sin(ph * 2) * 0.05); turn(B.Head, RT, 0.35);   // head up, eyes on the bike
  for(const [L1, sd] of SIDES){ const hp = ph + (sd < 0 ? 0 : Math.PI), kp = hp + Math.PI + 0.25;   // the left hand with the right knee, then the other pair
    wp(B[L1 + 'Arm'], _a); _b.copy(_a).addScaledVector(FWD, A.handF + A.reach * Math.sin(hp)).addScaledVector(RT, sd * 0.03); gnd(_b, 0.06 + Math.max(0, Math.cos(hp)) * A.lift);
    _c.copy(_a).addScaledVector(FWD, -0.4).addScaledVector(RT, sd * 0.25); arm(D, L1, _b, _c);
    aim(B[L1 + 'Hand'], B[L1 + 'HandMiddle1'], _d.copy(FWD).addScaledVector(UPW, -0.15)); rollHand(B, L1, _e.copy(RT).multiplyScalar(sd)); curlHand(B, L1, 0.12, _f.copy(_b).addScaledVector(UPW, -0.1));
    if(Math.cos(hp) > 0.97 && D.t2 > 0.3 && Math.random() < 0.5) spawnPart(_b.x, g + 0.05, _b.z, (Math.random() - 0.5), 0.4 + Math.random() * 0.5, (Math.random() - 0.5), { color:BIOME.ground, size:0.35, life:0.5, grav:-0.6, drag:2.5, smoke:true, op:0.35 });
    wp(B[L1 + 'UpLeg'], _a); _b.copy(_a).addScaledVector(FWD, A.kneeF + A.reach * Math.sin(kp)).addScaledVector(RT, sd * A.kneeW * 0.3); gnd(_b, 0.06 + Math.max(0, Math.cos(kp)) * A.lift * 0.8);
    _c.copy(_b).addScaledVector(FWD, -L.sh * 0.99); gnd(_c, 0.07 + Math.max(0, Math.cos(kp)) * A.lift * 0.5);
    leg(D, L1, _c, _d.copy(_b).addScaledVector(FWD, 0.3).addScaledVector(UPW, -0.1), _e.copy(FWD).negate().addScaledVector(UPW, -0.35)); } }

// ---- the heave: squat beside it facing it, a hand on the bars and one on the seat, and lift with the legs — twice ----
function startHeave(H, D){ rideFrame(H); const R = D.R, hv = D.hv = { bU:V3().set(RU.x, 0, RU.z), ft:[V3(), V3()], go:[-1, -1], from:[V3(), V3()], last:0, ph:-1, prev:null, sv:V3() };
  if(hv.bU.lengthSq() < 1e-4) hv.bU.copy(RR); hv.bU.normalize();
  onRide(H, R.grip[0], _a, true); onRide(H, R.grip[1], _b, true); hv.gi = _a.y >= _b.y ? 0 : 1;   // the grip up in the air, and the seat's upper edge
  const S0 = RIDE_ACT.heave.seat; hv.seat = [S0[0], R.hip[1] + S0[1], R.hip[2] + S0[2]]; onRide(H, hv.seat, _c); onRide(H, [-S0[0], hv.seat[1], hv.seat[2]], _d); if(_d.y > _c.y) hv.seat[0] = -S0[0];
  D.hd = Math.atan2(-hv.bU.x, -hv.bU.z); frame(D.hd); hv.gripHand = RF.dot(RT) > 0 ? 'Right' : 'Left';   // (the bars on his right: the right hand takes them)
  heaveStand(H, D, 0, _e); for(const i of [0, 1]){ hv.ft[i].copy(_e).addScaledVector(RT, (i ? 1 : -1) * RIDE_ACT.heave.feet); gnd(hv.ft[i]); }
  snapPose(D, RIDE_ACT.heave.grab); D.state = 'lift'; D.t2 = 0; say(D, 'lift'); }
// where his feet should be now: out from his hands, square to the bike (closer in as it comes up)
function heaveStand(H, D, k, out){ const hv = D.hv, A = RIDE_ACT.heave; onRide(H, D.R.grip[hv.gi], _t1, true); onRide(H, hv.seat, _t2); out.copy(_t1).add(_t2).multiplyScalar(0.5).addScaledVector(hv.bU, mix(A.off[0], A.off[1], k)); return gnd(out); }
// how far up it is (0 on its side … 1 stood) and how hard he is straining, by time: grab · heave · it slips back · a breath · the big heave · stood up
function heaveCurve(t){ const A = RIDE_ACT.heave; let u = t;
  if(u < A.grab) return [0, 0.4 * u / A.grab, 0]; u -= A.grab;
  if(u < A.h1[0]) return [A.h1[1] * ease(u / A.h1[0]), 1, 1]; u -= A.h1[0];
  if(u < A.slip[0]) return [mix(A.h1[1], A.slip[1], ease(u / A.slip[0])), 0.55, 2]; u -= A.slip[0];
  if(u < A.breath) return [A.slip[1], 0.2, 3]; u -= A.breath;
  if(u < A.h2) return [mix(A.slip[1], 1, ease(Math.pow(u / A.h2, 1.4))), 1, 4]; u -= A.h2;
  return [1, Math.max(0, 1 - u / A.hold), u >= A.hold ? 6 : 5]; }
function heaveStep(H, D, dt){ const A = RIDE_ACT.heave, hv = D.hv, w = D.w, B = D.B;
  if(D.give) return kneelNow(H, D);
  const [k, str, ph] = heaveCurve(D.t2); D.roll = (D.side || 1) * 1.35 * (1 - k); H.B.rotation.z = D.roll; rideFrame(H);
  if(ph !== hv.ph){ if(ph === 2){ say(D, 'slip'); sfx('thud', undefined, 0.5); } if(ph === 4) sfx('whoosh', undefined, 0.6); if(ph === 5){ sfx('thud'); dust(RC.x, RC.z, 6, 0.8); } hv.ph = ph; }
  if(ph === 6){ snapPose(D, RIDE.crash.mount); D.state = 'mount'; D.t2 = 0; D.roll = 0; D.hv = null; (H.body || H.B).add(w); w.position.set(0, 0, 0); w.rotation.set(0, 0, 0, 'XYZ'); w.scale.setScalar(D.s0); return; }
  rest(D); frame(D.hd);
  // the feet: each steps in toward where it should be as the bike comes up (a step aimed where that will be by the time it lands), one at a time
  //   unless one is left well behind; a short lift and down
  heaveStand(H, D, k, _e); w.position.copy(_e); w.rotation.set(0, D.hd, 0); w.updateMatrixWorld(true);
  if(hv.prev){ _g.subVectors(_e, hv.prev).divideScalar(Math.max(dt, 1e-3)); _g.y = 0; hv.sv.lerp(_g, Math.min(1, dt * 12)); } else hv.prev = V3(); hv.prev.copy(_e);
  for(const i of [0, 1]){ const sd = i ? 1 : -1; _f.copy(_e).addScaledVector(RT, sd * A.feet).addScaledVector(FWD, sd * 0.05).addScaledVector(hv.sv, A.lead); gnd(_f); const far = _f.distanceTo(hv.ft[i]);
    if(hv.go[i] < 0 && far > A.step && (hv.go[1 - i] < 0 || far > A.step * 2.5) && D.t2 - hv.last > 0.04){ hv.go[i] = 0; hv.from[i].copy(hv.ft[i]); }
    if(hv.go[i] >= 0){ hv.go[i] += dt / A.stepT; const s = Math.min(1, hv.go[i]); hv.ft[i].lerpVectors(hv.from[i], _f, ease(s)); hv.ft[i].y = heightAt(hv.ft[i].x, hv.ft[i].z) + Math.sin(s * Math.PI) * A.stepH;
      if(s >= 1){ hv.go[i] = -1; hv.last = D.t2; } } }
  // the hips: a deep squat, back flat and leaning in, rising and straightening as it comes up; he sags back against the weight while straining
  const shake = str > 0.6 ? (Math.random() - 0.5) * A.shake * 2 * str : 0, sag = str * 0.05 + (ph === 3 ? 0.04 : 0);
  const hipH = mix(A.hip[0], A.hip[1], k) - sag, bend = mix(A.bend[0], A.bend[1], k) - str * 0.12;
  _t3.copy(hv.ft[0]).add(hv.ft[1]).multiplyScalar(0.5); _t3.lerp(_e, 0.5);   // (his weight between where his feet really are and where they are going)
  _t1.copy(_t3).addScaledVector(FWD, -mix(A.back[0], A.back[1], k) - sag * 0.6); _t1.y = _e.y + hipH;
  setHips(D, _t1, _t2.copy(UPW).multiplyScalar(Math.cos(bend)).addScaledVector(FWD, Math.sin(bend)), RT);
  turn(B.Spine1, RT, -0.05 + shake); turn(B.Spine2, RT, -0.05 - shake); turn(B.Spine2, FWD, shake * 0.7);
  turn(B.Neck, RT, bend * 0.5 + str * 0.12); turn(B.Head, RT, str * 0.18);   // eyes on it, the chin up with the effort
  // the legs: knees forward and out over the feet, soles flat
  for(const [L1, sd] of SIDES){ const i = sd < 0 ? 0 : 1; _f.copy(hv.ft[i]).addScaledVector(UPW, D.ankle * XEOM.k);
    leg(D, L1, _f, _g.copy(hv.ft[i]).addScaledVector(FWD, 0.8).addScaledVector(RT, sd * 0.3).addScaledVector(UPW, 0.4)); flatFoot(D, L1); }
  // the hands: one round the grip in the air, one on the seat's edge — they ride the bike up
  onRide(H, D.R.grip[hv.gi], _hA, true); onRide(H, hv.seat, _hB);
  for(const [L1, sd] of SIDES){ const onGrip = L1 === hv.gripHand, t = _a.copy(onGrip ? _hA : _hB), o = onGrip ? _hB : _hA; if(shake) t.addScaledVector(UPW, shake * 0.8);
    wp(B[L1 + 'Arm'], _c); _c.addScaledVector(RT, sd * 0.45).addScaledVector(UPW, -0.3).addScaledVector(FWD, -0.1);
    arm(D, L1, t, _c); rollHand(B, L1, _d.subVectors(t, o)); curlHand(B, L1, RIDE.grip, _b.copy(t).addScaledVector(UPW, -0.02)); }
  if((ph === 1 || ph === 4) && Math.random() < dt * 6) spawnPart(RC.x + (Math.random() - 0.5) * 1.2, heightAt(RC.x, RC.z) + 0.1, RC.z + (Math.random() - 0.5) * 1.2, (Math.random() - 0.5), 0.5, (Math.random() - 0.5), { color:BIOME.ground, size:0.4, life:0.5, grav:-0.5, drag:2.5, smoke:true, op:0.3 });
  blendPose(D, dt); }

// ---- giving himself up ----
export function driverSurrender(H){ const D = H && H.drv; if(!D || !D.ok || D.give) return; D.give = true;
  const st = D.state; D.rollTo = st === 'ride' || st === 'mount' || st === 'fix' || st === 'stall' || st === 'pull' ? D.roll : DRIVER_RANT.has(st) || DRIVER_BREAK.has(st) ? 0 : (D.side || 1) * 1.35; H.onBreak = false; D.rollV = 0; D.toppled = Math.abs(D.roll) > 1.2;   // (Z361 the dead bike stands on its stand)
  if(st === 'ride' || st === 'mount' || st === 'stall' || st === 'pull') return bail(H, D);
  if(st === 'fall') return;   // still in the air: he gives up once he is down
  kneelNow(H, D); }
// the body he kneels by: where it lies (its chest, read off the soldier's own skeleton where it can be), and which way it lies
function bodyAt(out){ const p = S.player; return CV.dead ? out.copy(CV.dead.pos) : p ? out.copy(p.pos) : out.set(0, 0, 0); }
const shown = o => { for(let q = o; q; q = q.parent) if(!q.visible) return false; return true; };
function bodyBones(D){ const G = CV.G; if(D.bb && D.bb.G === G) return D.bb; let sk = null; if(G) G.traverse(o => { if(!sk && o.isSkinnedMesh && o.skeleton && shown(o)) sk = o; });
  const f = n => sk && sk.skeleton.bones.find(b => b.name.endsWith(n)); return D.bb = { G, hips:f('Hips'), head:f('Head'), lf:f('LeftFoot'), rf:f('RightFoot') }; }
// the spot beside it, level with its chest, on his side of it (out = where he kneels, returns the chest in _n4)
function kneelSpot(D, out){ const bb = bodyBones(D), G = RIDE_ACT.give; bodyAt(_n4);
  if(bb.hips && bb.head){ wp(bb.hips, _n1); wp(bb.head, _n2); _n4.addVectors(_n1, _n2).multiplyScalar(0.5); if(bb.lf && bb.rf){ wp(bb.lf, _n1); wp(bb.rf, _n3); _n1.add(_n3).multiplyScalar(0.5); } _n3.subVectors(_n2, _n1); }
  else _n3.set(0, 0, 0);
  _n3.y = 0; if(_n3.lengthSq() < 0.04) return out.copy(_n4).addScaledVector(D.kDir || _n3.set(1, 0, 0), G.beside);   // (no skeleton to read: out from where he fell)
  _n3.normalize().set(-_n3.z, 0, _n3.x); if(D.kSide == null){ const w = D.w.position; D.kSide = (w.x - _n4.x) * _n3.x + (w.z - _n4.z) * _n3.z >= 0 ? 1 : -1; }
  return out.copy(_n4).addScaledVector(_n3, D.kSide * G.beside); }
function bail(H, D){ const G = RIDE_ACT.give, w = D.w; rideFrame(H); bodyAt(_b); const sgn = (_b.x - RC.x) * RR.x + (_b.z - RC.z) * RR.z >= 0 ? 1 : -1, v = CV.speed || 0;
  snapPose(D, 0.25); toWorld(D); D.hd = w.rotation.y; D.mix.stopAllAction(); const run = D.A.run; if(run){ run.reset(); run.setLoop(THREE.LoopRepeat, Infinity); run.timeScale = G.runClip * 1.4; run.play(); }
  D.vel = new THREE.Vector3().copy(RR).multiplyScalar(sgn * G.jump[0]).addScaledVector(RF, v * G.jump[2]); D.vel.y = G.jump[1];
  if(H.two !== false && Math.abs(v) > 1.5){ D.side = -sgn; D.rollTo = -sgn * 1.35; }   // left moving, a two-wheeler goes over (away from him); stood, it stays on its stand
  D.state = 'bail'; D.t2 = 0; D.saidGive = true; sfx('whoosh'); say(D, 'surrender'); }
function bailStep(H, D, dt){ const G = RIDE_ACT.give, w = D.w; D.vel.y -= 9.8 * dt; w.position.addScaledVector(D.vel, dt); const g = heightAt(w.position.x, w.position.z);
  D.mix.update(dt); handsUp(D, D.t2); blendPose(D, dt);
  if(w.position.y <= g && D.vel.y < 0){ w.position.y = g; sfx('thud', undefined, 0.6); dust(w.position.x, w.position.z, 4, 0.7);
    bodyAt(_a); _b.subVectors(w.position, _a); _b.y = 0; const d = _b.length(); D.kDir = d > 0.05 ? _b.normalize().clone() : new THREE.Vector3(1, 0, 0); D.kSide = null;
    if(d > G.far){ D.kAt = w.position.clone(); kneelNow(H, D); } else { D.state = 'run'; D.t2 = 0; snapPose(D, 0.15); } } }   // (too far off: down where he landed)
function runStep(H, D, dt){ const G = RIDE_ACT.give, w = D.w; kneelSpot(D, _b); const dx = _b.x - w.position.x, dz = _b.z - w.position.z, d = Math.hypot(dx, dz);
  steer(D, Math.atan2(dx, dz), dt, 9); const s = Math.min(d, G.run * dt); w.position.x += Math.sin(D.hd) * s; w.position.z += Math.cos(D.hd) * s; w.position.y = heightAt(w.position.x, w.position.z);
  const run = D.A.run; if(run) run.timeScale = G.runClip; D.mix.update(dt); handsUp(D, D.t2); blendPose(D, dt);
  if(d < 0.12 || D.t2 > 6){ D.kAt = w.position.clone(); kneelNow(H, D); } }
// both hands up in the air, open, shaking: "đừng bắn!"
function handsUp(D, t){ const B = D.B, L = lens(D); D.w.updateMatrixWorld(true); frame(D.hd ?? D.w.rotation.y);
  for(const [L1, sd] of SIDES){ wp(B[L1 + 'Arm'], _a); _b.copy(_a).addScaledVector(UPW, L.arm * 0.9).addScaledVector(RT, sd * 0.14).addScaledVector(FWD, 0.08 + Math.sin(t * 19 + sd) * 0.02);
    _c.copy(_a).addScaledVector(RT, sd * 0.45).addScaledVector(FWD, -0.2); arm(D, L1, _b, _c); rollHand(B, L1, _d.copy(RT).multiplyScalar(sd)); } }
// down on his knees, where he is (or where he got to), facing the body
function kneelNow(H, D){ const w = D.w; snapPose(D, RIDE_ACT.give.drop); toWorld(D); w.rotation.x = 0; w.rotation.z = 0; w.position.y = heightAt(w.position.x, w.position.z);
  if(!D.kAt) D.kAt = w.position.clone(); kneelSpot(D, _a); _a.copy(_n4); const dx = _a.x - D.kAt.x, dz = _a.z - D.kAt.z;   // (facing the body's chest) D.hd = Math.hypot(dx, dz) > 0.3 ? Math.atan2(dx, dz) : w.rotation.y;
  D.mix.stopAllAction(); D.state = 'kneel'; D.t2 = 0; D.knelt = false; D.hv = null; if(!D.saidGive){ D.saidGive = true; say(D, 'surrender'); } }
function kneelStep(H, D, dt){ const G = RIDE_ACT.give, B = D.B, w = D.w; rest(D); const L = lens(D); frame(D.hd); w.position.set(D.kAt.x, heightAt(D.kAt.x, D.kAt.z), D.kAt.z); w.rotation.set(0, D.hd, 0); w.updateMatrixWorld(true);
  if(!D.knelt && D.t2 > G.drop * 0.8){ D.knelt = true; sfx('thud', undefined, 0.7); dust(w.position.x, w.position.z, 5, 0.7); }
  const back = ease(clamp((D.t2 - G.up) / G.behind, 0, 1)), sink = G.sink * back, t = D.t2, tremble = Math.sin(t * 31) * G.shake + Math.sin(t * 17.3) * G.shake * 0.6, breath = Math.sin(t * 2.4) * 0.012;
  const g = w.position.y, kneeF = 0.06, slump = 0.1 + sink * 0.8;
  _t1.copy(w.position).addScaledVector(FWD, -0.02 - sink); _t1.y = g + 0.06 + Math.sqrt(Math.max(0.01, L.th * L.th - (kneeF + 0.02 + sink) ** 2)) - sink * 0.6 + breath;
  setHips(D, _t1, _t2.copy(UPW).multiplyScalar(Math.cos(slump)).addScaledVector(FWD, Math.sin(slump)), RT);
  turn(B.Spine1, RT, -0.06 + tremble); turn(B.Spine2, RT, -0.05 - breath); turn(B.Spine2, FWD, tremble * 0.8);
  turn(B.Neck, RT, -G.bow[0] * (0.6 + 0.4 * back)); turn(B.Head, RT, -G.bow[1] * (0.5 + 0.5 * back) + tremble);   // face down
  for(const [L1, sd] of SIDES){ _a.copy(w.position).addScaledVector(RT, sd * 0.12).addScaledVector(FWD, kneeF); gnd(_a, 0.06);
    _b.copy(_a).addScaledVector(FWD, -L.sh * 0.99); gnd(_b, 0.07); leg(D, L1, _b, _c.copy(_a).addScaledVector(FWD, 0.3), _d.copy(FWD).negate().addScaledVector(UPW, -0.3)); }
  // hands up first, then laced behind his head, elbows out
  wp(B.Head, _n1); if(B.HeadTop_End) wp(B.HeadTop_End, _n2); else _n2.copy(_n1).addScaledVector(UPW, 0.2); _n3.subVectors(_n2, _n1); const hl = _n3.length() || 1; _n3.divideScalar(hl);
  _n4.copy(FWD).negate(); _n4.addScaledVector(_n3, -_n4.dot(_n3)).normalize();   // (the back of his head, bowed as it is)
  for(const [L1, sd] of SIDES){ wp(B[L1 + 'Arm'], _a);
    _b.copy(_a).addScaledVector(UPW, L.arm * 0.9).addScaledVector(RT, sd * 0.15).addScaledVector(FWD, 0.06 + Math.sin(t * 21 + sd) * 0.015 * (1 - back));
    _c.copy(_n1).addScaledVector(_n3, hl * 0.55).addScaledVector(_n4, 0.1).addScaledVector(RT, sd * 0.05); _b.lerp(_c, back);
    _d.copy(_a).addScaledVector(RT, sd * 0.45).addScaledVector(FWD, -0.2 + 0.25 * back).addScaledVector(UPW, 0.2 * back);
    arm(D, L1, _b, _d); rollHand(B, L1, _e.copy(RT).multiplyScalar(sd).lerp(_f.copy(UPW).negate(), back)); if(back > 0.5) curlHand(B, L1, 0.35 * back, _n1); }
  blendPose(D, dt); }
// the ride he left: one moving goes over and slides to a stop; one dropped mid-heave falls back down
function leftRide(H, D, dt){ const to = D.rollTo ?? D.roll;
  if(Math.abs(to - D.roll) > 1e-3){ D.rollV = (D.rollV || 0) + 7 * dt; D.roll += clamp(to - D.roll, -D.rollV * dt, D.rollV * dt);
    if(Math.abs(to - D.roll) < 1e-3 && Math.abs(to) > 0.5 && !D.toppled){ D.toppled = true; rideFrame(H); sfx('crunch', undefined, 0.6); dust(RC.x, RC.z, 6, 1); } }
  if(Math.abs(D.roll) > 1 && Math.abs(CV.speed) > 0.3){ CV.speed *= Math.exp(-dt * 2.5); if(Math.random() < 0.5){ rideFrame(H); sparks(RC.x, RC.z); } } }
// the last beat can end once he is on his knees (and a moment more)
export function driverDone(H){ const D = H && H.drv; return !D || !D.ok || !D.give || (D.state === 'kneel' && D.t2 > RIDE_ACT.give.show); }
// the soldier is back (respawn) or a new run: back on the seat as if nothing happened
export function driverBack(H){ const D = H && H.drv; if(!D) return; D.give = false; D.saidGive = false; D.kAt = null; D.kDir = null; D.kSide = null; D.bb = null; D.hv = null; D.rollTo = null; if(D.bl) D.bl.on = false;
  D.state = 'ride'; D.t2 = 0; D.roll = 0; D.tip = 0; D.slide = 0; D.wheelT = 0; D.hipUp = 0; D.kickW = 0; D.kickFoot = null; D.kickT = null; D.stallDone = false; D.ks = null; D.hd = null; D.fixT = 0; D.walking = false; D.chg = 0; D.chgT = null; D.br = null; D.brk = null; D.ph = null; D.pickup = false; H.onBreak = false; D.fixSide = 1; if(D.mask) D.mask.visible = true; if(D.maskDown) D.maskDown.visible = false; if(!D.ok || !D.w) return;   // (Z361 the rant's own marks wiped too)
  const body = H.body || H.B; if(D.w.parent !== body) body.add(D.w); D.w.position.set(0, 0, 0); D.w.rotation.set(0, 0, 0, 'XYZ'); D.w.scale.setScalar(D.s0); D.mix.stopAllAction(); }
