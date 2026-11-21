// actors/driver-rant.js — Z361 THE DRIVER'S TEMPER: the bike dies under him and he takes it personally.
//   · on the seat (stall): the throttle wrung in vain, eyes down at the engine; the bike rolls to a stop and he stands on the kick-start —
//     three stamps, a cough of black smoke each time, nothing;
//   · off (off · kick): he steps down on his side and walks (his own walk clip) to a wheel's outer quarter — the one that leaves him farther from
//     the soldier — winds up and boots the tyre (the bike rocks on its stand), and hops round on one leg clutching the foot;
//   · the row (argue): he turns on the soldier: a finger jabbed at him, then hands on hips shaking his head at the answer; palms up, an open hand
//     at the bike, a slap to his forehead at the answer — two rounds of words (RIDE_TALK.argue: the soldier answers the line of the same index);
//   · he gives in (giveup): waves it off, walks back to the engine and squats to the repair (the Z303 fixStep in actors/driver.js), muttering
//     about the spark plug.
// Every pose is built fresh each frame on his own feet (the pelvis and limb helpers of actors/driver-acts.js) and eased from the last (snapPose /
//   blendPose). His lines float over his own head (driverLine), the soldier's answers over the soldier's.
import * as THREE from 'three';
import { RIDE, RIDE_RANT, RIDE_TALK, XEOM } from '../../config.js';
import { BIOME, RIDE_VOICE, S, blendPose, burst, curlHand, drvFlatFoot, drvHips, drvLens, drvRest, drvToWorld, floatText, heightAt, hudOn, ik2, rollHand, sfx, snapPose, spawnPart } from '../hub.js';

const V3 = () => new THREE.Vector3();
const _a = V3(), _b = V3(), _c = V3(), _d = V3(), _e = V3(), _f = V3(), _g = V3(), _h = V3(), _p = V3(), _t = V3(), _kf = V3(), _ia = V3(), _ib = V3();
const UPW = new THREE.Vector3(0, 1, 0), FWD = V3(), RT = V3(), RU = V3(), RF = V3(), RR = V3(), RC = V3(), _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = k => k * k * (3 - 2 * k), mix = (a, b, k) => a + (b - a) * k, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const SIDES = [['Left', -1], ['Right', 1]];   // (sd: which way is outward for that hand / foot, along his right)
export const DRIVER_RANT = new Set(['off', 'kick', 'argue', 'giveup']);   // (on his feet beside the dead bike; 'stall' is on the seat — driver.js poses it)

const wp = (b, out) => b.getWorldPosition(out);
const gnd = (v, up = 0) => (v.y = heightAt(v.x, v.z) + up, v);
function frame(hd){ FWD.set(Math.sin(hd), 0, Math.cos(hd)); RT.set(-Math.cos(hd), 0, Math.sin(hd)); }
function turn(b, axis, ang){ if(!b || Math.abs(ang) < 1e-5) return; _q.setFromAxisAngle(axis, ang); b.getWorldQuaternion(_qw); _qw.premultiply(_q); b.parent.getWorldQuaternion(_qp); b.quaternion.copy(_qp.invert().multiply(_qw)); b.updateMatrixWorld(true); }
function aim(b, c, dir){ if(!b || !c) return; wp(b, _ia); wp(c, _ib); _ib.sub(_ia); if(_ib.lengthSq() < 1e-10 || dir.lengthSq() < 1e-10) return;
  _q.setFromUnitVectors(_ib.normalize(), _ia.copy(dir).normalize()); b.getWorldQuaternion(_qw); _qw.premultiply(_q); b.parent.getWorldQuaternion(_qp); b.quaternion.copy(_qp.invert().multiply(_qw)); b.updateMatrixWorld(true); }
function rideFrame(H){ const b = H.body || H.B; H.B.updateWorldMatrix(true, true); b.getWorldQuaternion(_q); RU.set(0, 1, 0).applyQuaternion(_q); RF.set(0, 0, 1).applyQuaternion(_q); RR.set(-1, 0, 0).applyQuaternion(_q); H.root.getWorldPosition(RC); }
function steer(D, want, dt, rate){ const h = D.hd ?? D.w.rotation.y; D.hd = h + clamp(wrapA(want - h), -rate * dt, rate * dt); }

// ---- what he says: RIDE_TALK[ev] line i (or any) over his own head; the soldier's answer j (or any) wait s later (RIDE_TALK.reply) over the soldier's ----
export function driverLine(D, ev, i, j, wait){ const T = RIDE_TALK[ev], p = S.player; if(!T || !D || !D.w) return; const show = hudOn('talk'); if(i == null || i >= T.d.length) i = (Math.random() * T.d.length) | 0;
  D.w.getWorldPosition(_h); if(show) floatText(T.d[i], RIDE_TALK.col.d, _h.clone().setY(_h.y + 2.2), 13); if(RIDE_VOICE.on && RIDE_VOICE.play) RIDE_VOICE.play('driver', ev, i);
  if(!T.s || !T.s.length || !p) return; if(j == null || j >= T.s.length) j = (Math.random() * T.s.length) | 0;
  setTimeout(() => { if(S.player !== p || D.give) return; D.heardT = performance.now() / 1000; if(show) floatText(T.s[j], RIDE_TALK.col.s, new THREE.Vector3(p.pos.x, p.pos.y + 3.2, p.pos.z), 13); if(RIDE_VOICE.on && RIDE_VOICE.play) RIDE_VOICE.play('soldier', ev, j); }, (wait ?? RIDE_TALK.reply) * 1000); }

// ---- the engine dies under him (game/ride-wear.js rideBreak; or the bike he has just righted after a spill won't go) ----
export function driverStall(H){ const D = H && H.drv; if(!D || !D.ok) return; D.state = 'stall'; D.t2 = 0; D.kickT = null; D.kickN = -1; D.kickW = 0; D.hipUp = 0; D.kickFoot = null; D.stallDone = false; driverLine(D, 'stall'); }
// on the seat, before the ride pose is built (actors/driver.js ridePose reads D.hipUp and D.kickFoot / D.kickW): the throttle first, the bike let
//   roll to a stop, then the kicks — the foot onto the lever's pad, stamped down (stood up on it), the lever let back up; a cough of smoke each time
export function drvStallStep(H, D, dt, v){ const A = RIDE_RANT.stall; D.t2 += dt; const t = D.t2; D.hipUp = 0;
  if(D.kickT == null){ D.kickW = 0; if(t < A.wring || (Math.abs(v) > A.still && t < A.wring + A.roll)) return; D.kickT = t; }
  const u = (t - D.kickT) / A.kick, n = Math.floor(u), f = u - n;
  if(n >= A.n){ D.kickW = Math.max(0, D.kickW - dt * 4); if(D.kickW <= 0 && u >= A.n + A.after / A.kick) D.stallDone = true; return; }
  rideFrame(H); const body = H.body || H.B; _a.fromArray(D.R.peg[1]); body.localToWorld(_a);
  _b.copy(_a).addScaledVector(RU, A.top[0]).addScaledVector(RF, A.top[1]).addScaledVector(RR, A.out);   // the lever's pad, up
  _c.copy(_a).addScaledVector(RU, A.bot[0]).addScaledVector(RF, A.bot[1]).addScaledVector(RR, A.out);   // stamped down
  const [a0, a1] = A.at, s = f < a0 ? 0 : f < a1 ? Math.pow((f - a0) / (a1 - a0), 1.6) : 1 - ease((f - a1) / (1 - a1));
  D.kickFoot = _kf.copy(_b).lerp(_c, s); D.kickW = Math.min(1, D.kickW + dt * 5);
  D.hipUp = A.rise * (f < a0 ? 0.3 * ease(f / a0) : f < a1 ? mix(0.3, 1, (f - a0) / (a1 - a0)) : mix(1, 0.3, ease((f - a1) / (1 - a1))));
  if(n !== D.kickN && f >= a1){ D.kickN = n; cough(H); if(n === 1) driverLine(D, 'kickstart'); } }
// after the ride pose: the right wrist wringing the throttle, his eyes down at the engine, then down past his right knee at the lever; done → off
export function drvStallLook(H, D){ const A = RIDE_RANT.stall, B = D.B, t = D.t2; rideFrame(H);
  const wr = t < A.wring ? clamp(t * 5, 0, 1) * clamp((A.wring - t) * 5, 0, 1) : 0, kk = D.kickT == null ? 0 : clamp((t - D.kickT) * 3, 0, 1) * D.kickW;
  if(wr > 0 && B.RightHand && B.RightForeArm){ wp(B.RightForeArm, _a); wp(B.RightHand, _b); turn(B.RightHand, _c.subVectors(_b, _a).normalize(), -A.twist * wr * Math.abs(Math.sin(t * A.twistF))); }
  const dn = clamp(t * 3, 0, 1); turn(B.Neck, RR, -A.look[0] * dn); turn(B.Head, RR, -A.look[1] * dn); turn(B.Neck, RU, -A.look[2] * kk);   // (+ about his right tips the head back; + about up turns it to his left)
  if(D.stallDone) offStart(H, D); }
// the engine coughs and dies again: a click of the lever, a dull thud, black smoke out of the exhaust
function cough(H){ rideFrame(H); sfx('click'); sfx('thud', undefined, 0.35); const e = XEOM.wear.engine[H.bike] || [0, 0.2, 0]; (H.body || H.B).localToWorld(_e.fromArray(e)); _e.addScaledVector(RF, -0.55).addScaledVector(RR, 0.12);
  for(let k = 0; k < 3; k++) spawnPart(_e.x, _e.y, _e.z, (Math.random() - 0.5) * 0.6 - RF.x * 0.8, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6 - RF.z * 0.8, { color:0x2a2622, size:0.45 + Math.random() * 0.3, grow:1.6, life:1.1, grav:0.3, drag:1.1, smoke:true, op:0.55 }); }

// ---- off the seat: down onto the road on his side (the bike's left), then a few steps to the tyre he boots ----
const onRideW = (H, arr, out) => H.toWorld ? H.toWorld(arr, out) : H.B.localToWorld(out.fromArray(arr));
function offStart(H, D){ const O = RIDE_RANT.off; D.stallDone = false; D.kickT = null; D.kickW = 0; D.kickFoot = null; D.hipUp = 0;
  snapPose(D, O.step); drvToWorld(D); D.mix.stopAllAction(); kickSpot(H, D);
  const dn = D.ks.down; D.w.position.copy(dn); D.hd = Math.atan2(D.ks.st.x - dn.x, D.ks.st.z - dn.z); D.w.rotation.set(0, D.hd, 0);   // (stepped down beside the seat, turned toward the tyre)
  D.state = 'off'; D.t2 = 0; D.said = {}; D.gest = null; D.rockT = 9; D.walking = false; }
// the tyre to boot: a wheel on his side (or on the centre line), at its outer quarter (the back of the rear tyre, the front of the front one), from
//   45° off its line — whichever leaves him farther from the soldier, his walk there included (he steps down beside the seat, a little toward
//   that end, and walks); and where the repair squat will be (RIDE.fix: between its feet)
function kickSpot(H, D){ rideFrame(H); const O = RIDE_RANT.off, p = S.player, X = XEOM[H.bike]; let best = null;
  for(const [k, wh] of (H.wheels || []).entries()){ if(wh.x < -1e-3) continue; const wd = X && X.wheels ? X.wheels[k] : null, end = wh.pivot.position.z >= 0 ? 1 : -1;
    const P = V3(); wh.pivot.getWorldPosition(P); P.addScaledVector(RR, -((wd ? wd.w * XEOM.k / 2 : 0.05) + 0.03)).addScaledVector(RF, end * wh.R * O.quarter).addScaledVector(RU, wh.R * 0.15);
    const dir = V3().copy(RR).negate().multiplyScalar(Math.cos(O.angle)).addScaledVector(RF, end * Math.sin(O.angle)); dir.y = 0; dir.normalize();
    const hd = Math.atan2(-dir.x, -dir.z); frame(hd); const st = V3().copy(P).addScaledVector(dir, O.out).addScaledVector(RT, -0.1); gnd(st);
    const down = onRideW(H, D.R.hip, V3()).addScaledVector(RR, -O.side).addScaledVector(RF, end * O.lead); gnd(down);
    const score = p ? Math.min(Math.hypot(st.x - p.pos.x, st.z - p.pos.z), segDist(p.pos, down, st) + 0.6) : -Math.abs(end + 1); if(!best || score > best.score) best = { P, st, hd, down, score }; }
  if(!best){ const P = V3(); onRideW(H, [0.08, 0.15, -0.25], P); const hd = Math.atan2(RR.x, RR.z); frame(hd); best = { P, st:gnd(V3().copy(P).addScaledVector(FWD, -O.out)), hd, down:gnd(onRideW(H, D.R.hip, V3()).addScaledVector(RR, -O.side)) }; }
  const F = RIDE.fix[D.kind], fx = F ? [(F.foot[0][0] + F.foot[1][0]) / 2, 0, (F.foot[0][2] + F.foot[1][2]) / 2] : [0.35, 0, 0];
  D.ks = { P:best.P, st:best.st, hd:best.hd, down:best.down, bike:RC.clone().setY(best.P.y + 0.35), fix:gnd(onRideW(H, fx, V3())) }; }
// how near p comes to the segment a → b (on the ground)
function segDist(p, a, b){ const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez, u = L2 > 1e-6 ? clamp(((p.x - a.x) * ex + (p.z - a.z) * ez) / L2, 0, 1) : 0; return Math.hypot(a.x + ex * u - p.x, a.z + ez * u - p.z); }
// walking (his own walk clip) toward T; returns how far is left
function startWalk(D){ snapPose(D, 0.25); D.walking = true; D.mix.stopAllAction(); const a = D.A.walk; if(a){ a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.timeScale = RIDE_RANT.off.clip; a.play(); } }
function walkTo(D, T, dt){ const O = RIDE_RANT.off, w = D.w, dx = T.x - w.position.x, dz = T.z - w.position.z, d = Math.hypot(dx, dz); if(!D.A.walk){ w.position.x = T.x; w.position.z = T.z; return 0; }
  steer(D, Math.atan2(dx, dz), dt, 7); const s = Math.min(d, O.walkV * dt); w.position.x += Math.sin(D.hd) * s; w.position.z += Math.cos(D.hd) * s; w.position.y = heightAt(w.position.x, w.position.z);
  w.rotation.set(0, D.hd, 0); D.mix.update(dt); blendPose(D, dt); return d - s; }
function stopWalk(D){ snapPose(D, 0.25); D.mix.stopAllAction(); D.walking = false; }

// ---- every frame, for the states this module owns ----
export function driverRant(H, D, dt){ D.t2 = (D.t2 || 0) + dt; const st = D.state; rock(D, dt);
  if(st === 'off') offStep(H, D, dt); else if(st === 'kick') kickStep(H, D, dt); else if(st === 'argue') argueStep(H, D, dt); else giveupStep(H, D, dt); }
// the bike rocking on its stand after the boot (driver.js lays D.roll on it while he is off it)
function rock(D, dt){ const K = RIDE_RANT.kick; D.rockT = (D.rockT ?? 9) + dt; D.roll = D.rockT < 2.5 ? K.rock * Math.exp(-D.rockT * K.rockD) * Math.sin(D.rockT * K.rockF) : 0; }

// ---- his body on his own feet ----
// stood at w.position facing D.hd: leaning `lean` forward (− back, the hips back to balance it), `sink` m down on soft knees, `hop` m off the ground
function standPose(D, lean, sink, hop){ const L = drvLens(D), w = D.w, aw = D.ankle * XEOM.k; frame(D.hd); w.rotation.set(0, D.hd, 0); w.position.y = heightAt(w.position.x, w.position.z); drvRest(D);
  _p.copy(w.position).addScaledVector(FWD, -Math.sin(lean) * 0.12); _p.y += aw + (L.th + L.sh) * 0.975 - sink + hop;
  drvHips(D, _p, _t.copy(UPW).multiplyScalar(Math.cos(lean)).addScaledVector(FWD, Math.sin(lean)), RT); }
// a foot planted under its hip (lifted `lift` m), the knee bent forward, the sole flat
function plant(D, L1, sd, lift){ const w = D.w, aw = D.ankle * XEOM.k; _a.copy(w.position).addScaledVector(RT, sd * 0.11).addScaledVector(FWD, 0.01); gnd(_a, aw + lift);
  _b.copy(_a).addScaledVector(FWD, 0.6).addScaledVector(UPW, 0.5).addScaledVector(RT, sd * 0.1); ik2(D.B[L1 + 'UpLeg'], D.B[L1 + 'Leg'], D.B[L1 + 'Foot'], _a, _b); drvFlatFoot(D, L1); }
// arms hanging easy at his sides (or only the one named), hands half closed against the thighs
function hang(D, only){ const B = D.B, L = drvLens(D); for(const [L1, sd] of SIDES){ if(only && only !== L1) continue; wp(B[L1 + 'Arm'], _a);
  _b.copy(_a).addScaledVector(UPW, -L.arm * 0.92).addScaledVector(FWD, 0.07).addScaledVector(RT, sd * 0.06); _c.copy(_a).addScaledVector(FWD, -0.4).addScaledVector(RT, sd * 0.15).addScaledVector(UPW, -0.2);
  ik2(B[L1 + 'Arm'], B[L1 + 'ForeArm'], B[L1 + 'Hand'], _b, _c); rollHand(B, L1, _d.copy(FWD).negate()); curlHand(B, L1, 0.3, _e.copy(_b).addScaledVector(RT, -sd * 0.1)); } }
// his face toward T, plus a turn (+ to his left) and a nod (+ up); the trunk's lean forward allowed for; the neck takes half, the head the rest
function look(D, T, yawA, pitchA, lean){ const B = D.B; wp(B.Head, _a); _b.subVectors(T, _a);
  const yaw = clamp(wrapA(Math.atan2(_b.x, _b.z) - D.hd), -1.35, 1.35) + yawA, pitch = clamp(Math.atan2(_b.y, Math.hypot(_b.x, _b.z)) + lean, -0.8, 0.55) + pitchA;
  turn(B.Neck, UPW, yaw * 0.5); turn(B.Head, UPW, yaw * 0.5); _c.copy(RT).applyAxisAngle(UPW, yaw); turn(B.Neck, _c, pitch * 0.45); turn(B.Head, _c, pitch * 0.55); }

// ---- the step down, and the walk to the tyre ----
function offStep(H, D, dt){ const O = RIDE_RANT.off, ks = D.ks;
  if(D.walking){ if(walkTo(D, ks.st, dt) < 0.04 || D.t2 > O.step + O.walkMax) toKick(D); return; }
  standPose(D, 0.04, 0.02, 0); plant(D, 'Left', -1, 0); plant(D, 'Right', 1, 0); look(D, ks.P, 0, 0, 0.04); hang(D); blendPose(D, dt);
  if(D.t2 >= O.step){ if(Math.hypot(ks.st.x - D.w.position.x, ks.st.z - D.w.position.z) < 0.12) toKick(D); else startWalk(D); } }
function toKick(D){ stopWalk(D); D.state = 'kick'; D.t2 = 0; D.said = {}; D.hit = false; }

// ---- the boot: wind up, swing, the tyre (the bike rocks) — and hopping round on one leg clutching the foot ----
function kickStep(H, D, dt){ const K = RIDE_RANT.kick, B = D.B, w = D.w, t = D.t2, aw = D.ankle * XEOM.k, P = D.ks.P;
  const t1 = K.wind, t2 = t1 + K.swing, t3 = t2 + K.back, t4 = t3 + K.hop;
  if(!D.said.kick){ D.said.kick = 1; driverLine(D, 'kick'); }
  if(t >= t2 && !D.hit){ D.hit = true; D.rockT = 0; sfx('clang'); sfx('thud', undefined, 0.8); S.shake = Math.min(3, (S.shake || 0) + 0.2);
    burst({ x:P.x, z:P.z }, BIOME.ground, 4, 1.5, { y:heightAt(P.x, P.z) + 0.15, life:0.5, size:0.5, smoke:true, grav:-0.3, drag:2, op:0.35 }); }
  if(t >= t3 && !D.said.ouch){ D.said.ouch = 1; driverLine(D, 'ouch'); }
  if(t >= t4){ const p = S.player; snapPose(D, 0.3); D.t2 = 0; D.said = {}; D.gest = null;
    if(p && !S.firing && Math.hypot(p.pos.x - w.position.x, p.pos.z - w.position.z) < RIDE_RANT.argue.far){ D.state = 'argue'; D.rounds = pickRounds(); } else D.state = 'giveup'; return; }   // (no row with the guns going, or the soldier off away)
  if(t < t1) steer(D, D.ks.hd, dt, 9);   // (squared up to it as he winds up)
  const hu = Math.max(0, t - t3), hopping = t >= t3, hop = hopping ? Math.abs(Math.sin(hu * Math.PI * K.hopF)) * K.hopH * clamp(hu * 4, 0, 1) : 0;
  if(hopping){ D.hd += K.spin * dt; frame(D.hd); w.position.addScaledVector(FWD, -K.spin * 0.18 * dt); }   // (round in a little circle)
  const lean = t < t1 ? 0.12 * ease(t / t1) : t < t3 ? mix(0.12, -0.14, ease((t - t1) / (t3 - t1))) : mix(-0.14, K.bow, ease(clamp(hu / 0.3, 0, 1)));
  standPose(D, lean, hopping ? K.sink : 0.03, hop); plant(D, 'Left', -1, hop * 0.85);
  // the right foot: where it stood → drawn back → into the tyre → clutched up in front of him
  _f.copy(w.position).addScaledVector(RT, 0.11); gnd(_f, aw); _g.copy(_f).addScaledVector(FWD, -K.wb[0]).addScaledVector(UPW, K.wb[1]);
  wp(B.RightUpLeg, _h); _h.addScaledVector(FWD, K.held[0]).addScaledVector(UPW, -K.held[1]).addScaledVector(RT, -K.held[2]);
  if(t < t1) _a.copy(_f).lerp(_g, ease(t / t1)); else if(t < t2) _a.copy(_g).lerp(P, Math.pow((t - t1) / K.swing, 1.5)); else if(t < t3) _a.copy(P).lerp(_h, ease((t - t2) / K.back)); else _a.copy(_h);
  const ank = _p.copy(_a); wp(B.RightUpLeg, _c); _b.copy(ank).lerp(_c, 0.5).addScaledVector(FWD, 0.6).addScaledVector(UPW, 0.35); ik2(B.RightUpLeg, B.RightLeg, B.RightFoot, ank, _b);
  if(!hopping){ const k = t < t1 ? ease(t / t1) : 1;   // arms out for balance: the left one ahead, the right flung back
    wp(B.LeftArm, _a); _b.copy(_a).addScaledVector(FWD, 0.3 * k).addScaledVector(RT, -0.32 * k - 0.06).addScaledVector(UPW, -0.5 + 0.25 * k); _c.copy(_a).addScaledVector(RT, -0.4).addScaledVector(UPW, -0.3).addScaledVector(FWD, -0.2);
    ik2(B.LeftArm, B.LeftForeArm, B.LeftHand, _b, _c); curlHand(B, 'Left', 0.3, _d.copy(_b).addScaledVector(UPW, -0.1));
    wp(B.RightArm, _a); _b.copy(_a).addScaledVector(FWD, -0.28 * k + 0.05).addScaledVector(RT, 0.2 * k + 0.06).addScaledVector(UPW, -0.52); _c.copy(_a).addScaledVector(RT, 0.4).addScaledVector(FWD, 0.1).addScaledVector(UPW, -0.2);
    ik2(B.RightArm, B.RightForeArm, B.RightHand, _b, _c); curlHand(B, 'Right', 0.6, _d.copy(_b).addScaledVector(UPW, -0.1));
    look(D, P, 0, 0, lean); }
  else { for(const [L1, sd] of SIDES){ _b.copy(ank).addScaledVector(UPW, K.grab).addScaledVector(RT, sd * 0.05); wp(B[L1 + 'Arm'], _c); _c.addScaledVector(RT, sd * 0.45).addScaledVector(UPW, 0.1);   // both hands round the hurt foot
      ik2(B[L1 + 'Arm'], B[L1 + 'ForeArm'], B[L1 + 'Hand'], _b, _c); rollHand(B, L1, _d.copy(FWD).negate()); curlHand(B, L1, 0.65, ank); }
    look(D, ank, Math.sin(hu * 13) * 0.1, 0, lean); }   // (eyes on it, wincing)
  blendPose(D, dt); }

// ---- the row ----
function pickRounds(){ const n = RIDE_TALK.argue.d.length, R = RIDE_RANT.argue.rounds, want = Math.min(n, R[0] + Math.floor(Math.random() * (R[1] - R[0] + 1))), out = []; while(out.length < want){ const i = (Math.random() * n) | 0; if(!out.includes(i)) out.push(i); } return out; }
function toGiveup(D){ snapPose(D, 0.3); D.state = 'giveup'; D.t2 = 0; D.gest = null; D.said = {}; }
function argueStep(H, D, dt){ const A = RIDE_RANT.argue, w = D.w, p = S.player, t = D.t2; if(!p) return toGiveup(D);
  _h.set(p.pos.x, heightAt(p.pos.x, p.pos.z) + A.eye, p.pos.z); steer(D, Math.atan2(_h.x - w.position.x, _h.z - w.position.z), dt, A.turn);   // (his face: turned on him)
  const r = Math.floor(t / A.round), u = t - r * A.round; if(r >= D.rounds.length) return toGiveup(D);
  if(!D.said['a' + r] && u >= A.say){ D.said['a' + r] = 1; driverLine(D, 'argue', D.rounds[r], D.rounds[r], A.answer); }
  const talking = u >= A.say && u < A.say + A.answer, odd = r % 2;
  const g = talking ? (odd ? (u - A.say < A.answer * 0.5 ? 'shrug' : 'bike') : 'point') : (odd ? 'slap' : 'hips');
  if(g !== D.gest){ if(D.gest) snapPose(D, A.blend); D.gest = g; D.gT = 0; D.slapped = false; } D.gT += dt; const gt = D.gT;
  const lean = g === 'point' ? 0.1 : g === 'slap' ? -0.05 : 0.03; standPose(D, lean, 0.02, 0); plant(D, 'Left', -1, 0); plant(D, 'Right', 1, 0);
  // head first (the slap's hand goes to where his brow is now): on the soldier — nodding his words out, shaking his head at the answer, eyes to the sky at the slap
  const yawA = g === 'hips' ? Math.sin(gt * 12) * 0.22 * clamp(1.6 - gt, 0, 1) : 0, pitchA = g === 'point' ? Math.sin(gt * 9) * 0.05 : g === 'shrug' ? 0.06 : g === 'slap' ? 0.22 * clamp(gt * 4, 0, 1) : 0;
  look(D, _h, yawA, pitchA, lean);
  if(g === 'point'){ gestPoint(D, _h, gt); gestHip(D, 'Left', -1); }
  else if(g === 'hips'){ gestHip(D, 'Left', -1); gestHip(D, 'Right', 1); }
  else if(g === 'shrug') gestShrug(D, clamp(gt * 5, 0, 1));
  else if(g === 'bike'){ gestOpen(D, 'Left', -1, D.ks.bike); hang(D, 'Right'); }
  else { gestSlap(D, gt); hang(D, 'Right'); }
  blendPose(D, dt); }
// a finger jabbed at him (index straight, the rest curled, thumb up), the arm not quite locked
function gestPoint(D, T, gt){ const B = D.B, L = drvLens(D); wp(B.RightArm, _a); _b.subVectors(T, _a).normalize(); const jab = Math.max(0, Math.sin(gt * 10)) * 0.07;
  _c.copy(_a).addScaledVector(_b, L.arm * 0.84 + jab); _d.copy(_a).addScaledVector(UPW, -0.5).addScaledVector(RT, 0.25).addScaledVector(FWD, -0.1);
  ik2(B.RightArm, B.RightForeArm, B.RightHand, _c, _d); aim(B.RightHand, B.RightHandMiddle1, _b); rollHand(B, 'Right', _e.copy(UPW).negate()); curlHand(B, 'Right', 0.95, _f.copy(_c).addScaledVector(RT, -0.1), 0, 0); }
// a hand on the hip, the elbow out (chống nạnh)
function gestHip(D, L1, sd){ const B = D.B; wp(B[L1 + 'UpLeg'], _a); _a.addScaledVector(RT, sd * 0.09).addScaledVector(UPW, 0.1).addScaledVector(FWD, -0.01);
  wp(B[L1 + 'Arm'], _b); _b.addScaledVector(RT, sd * 0.55).addScaledVector(FWD, -0.1).addScaledVector(UPW, -0.25);
  ik2(B[L1 + 'Arm'], B[L1 + 'ForeArm'], B[L1 + 'Hand'], _a, _b); aim(B[L1 + 'Hand'], B[L1 + 'HandMiddle1'], _c.copy(FWD).addScaledVector(UPW, -0.6).addScaledVector(RT, -sd * 0.2));
  rollHand(B, L1, _d.copy(UPW).negate()); curlHand(B, L1, 0.25, _e.copy(_a).addScaledVector(RT, -sd * 0.1)); }
// shoulders up, elbows in at his sides, forearms out, palms up: "and what was I supposed to do?"
function gestShrug(D, k){ const B = D.B; for(const [L1, sd] of SIDES){ const sh = B[L1 + 'Shoulder']; if(sh){ wp(sh, _a); wp(B[L1 + 'Arm'], _b); _c.subVectors(_b, _a).normalize().addScaledVector(UPW, 0.4 * k); aim(sh, B[L1 + 'Arm'], _c); }
    wp(B[L1 + 'Arm'], _a); _b.copy(_a).addScaledVector(FWD, 0.26 * k + 0.05).addScaledVector(RT, sd * (0.24 * k + 0.06)).addScaledVector(UPW, -0.33 - 0.2 * (1 - k));
    _c.copy(_a).addScaledVector(RT, sd * 0.25).addScaledVector(UPW, -0.45).addScaledVector(FWD, -0.15);
    ik2(B[L1 + 'Arm'], B[L1 + 'ForeArm'], B[L1 + 'Hand'], _b, _c); aim(B[L1 + 'Hand'], B[L1 + 'HandMiddle1'], _d.copy(FWD).addScaledVector(RT, sd * 0.5)); rollHand(B, L1, _e.copy(RT).multiplyScalar(-sd)); curlHand(B, L1, 0.12, _f.copy(_b).addScaledVector(UPW, 0.1)); } }
// an open hand held out at T, palm up ("look at it!")
function gestOpen(D, L1, sd, T){ const B = D.B, L = drvLens(D); wp(B[L1 + 'Arm'], _a); _b.subVectors(T, _a).normalize(); _c.copy(_a).addScaledVector(_b, L.arm * 0.85);
  _d.copy(_a).addScaledVector(UPW, -0.4).addScaledVector(RT, sd * 0.3); ik2(B[L1 + 'Arm'], B[L1 + 'ForeArm'], B[L1 + 'Hand'], _c, _d); aim(B[L1 + 'Hand'], B[L1 + 'HandMiddle1'], _b);
  rollHand(B, L1, _e.copy(RT).multiplyScalar(-sd)); curlHand(B, L1, 0.1, _f.copy(_c).addScaledVector(UPW, 0.1)); }
// the left hand slapped to his brow (fingers across it), the elbow out ahead — a smack as it lands
function gestSlap(D, gt){ const B = D.B, L = drvLens(D), k = ease(clamp(gt / 0.18, 0, 1)); wp(B.Head, _a); _a.addScaledVector(FWD, 0.11).addScaledVector(UPW, 0.09).addScaledVector(RT, -0.07);
  wp(B.LeftArm, _b); _c.copy(_b).addScaledVector(UPW, -L.arm * 0.92).addScaledVector(FWD, 0.07).addScaledVector(RT, -0.06).lerp(_a, k);
  _d.copy(_b).addScaledVector(RT, -0.4).addScaledVector(FWD, 0.25).addScaledVector(UPW, -0.15); ik2(B.LeftArm, B.LeftForeArm, B.LeftHand, _c, _d);
  rollHand(B, 'Left', UPW); curlHand(B, 'Left', 0.15, _e.copy(_c).addScaledVector(FWD, -0.1)); if(k >= 1 && !D.slapped){ D.slapped = true; sfx('click', undefined, 0.6); } }

// ---- he gives in: waves it away, turns back to the bike, down to the repair ----
function giveupStep(H, D, dt){ const G = RIDE_RANT.giveup, t = D.t2, w = D.w, p = S.player, ks = D.ks; if(!D.said.g){ D.said.g = 1; driverLine(D, 'giveup'); }
  if(D.walking){ if(walkTo(D, ks.fix, dt) < 0.04 || t > G.dur + RIDE_RANT.off.walkMax){ stopWalk(D); fixStart(H, D); } return; }
  steer(D, Math.atan2(ks.fix.x - w.position.x, ks.fix.z - w.position.z), dt, t > G.wave * 0.5 ? G.turn : 0.5);
  standPose(D, 0.04, 0.02, 0); plant(D, 'Left', -1, 0); plant(D, 'Right', 1, 0);
  look(D, t < G.wave && p ? _h.set(p.pos.x, heightAt(p.pos.x, p.pos.z) + RIDE_RANT.argue.eye, p.pos.z) : D.ks.P, 0, 0, 0.04);
  if(t < G.wave) gestWave(D, t / G.wave); else hang(D, 'Right'); hang(D, 'Left'); blendPose(D, dt);
  if(t >= G.dur){ if(Math.hypot(ks.fix.x - w.position.x, ks.fix.z - w.position.z) < 0.12) fixStart(H, D); else startWalk(D); } }
// the right hand flicked out and down, palm down: "thôi, thôi"
function gestWave(D, k){ const B = D.B; wp(B.RightArm, _a); const e = ease(clamp(k * 1.4, 0, 1));
  _b.copy(_a).addScaledVector(FWD, mix(0.3, 0.18, e)).addScaledVector(RT, mix(-0.02, 0.38, e)).addScaledVector(UPW, mix(-0.2, -0.46, e)); _c.copy(_a).addScaledVector(RT, 0.35).addScaledVector(UPW, -0.4).addScaledVector(FWD, -0.1);
  ik2(B.RightArm, B.RightForeArm, B.RightHand, _b, _c); rollHand(B, 'Right', _d.copy(RT)); curlHand(B, 'Right', 0.1, _e.copy(_b).addScaledVector(UPW, -0.1)); }
// back onto the ride's frame, eased down into the repair squat (actors/driver.js fixStep, already squatting: fixK 1); the mutter a moment in
function fixStart(H, D){ snapPose(D, RIDE_RANT.giveup.squat); const body = H.body || H.B; body.add(D.w); D.w.position.set(0, 0, 0); D.w.rotation.set(0, 0, 0, 'XYZ'); D.w.scale.setScalar(D.s0);
  D.roll = 0; D.ks = null; D.hd = null; D.state = 'fix'; D.t2 = 0; D.fixK = 1; D.fixSay = RIDE_RANT.giveup.mutter; D.fixT = XEOM.wear.fixT * RIDE_RANT.giveup.fixK; }   // (the row ate into the time: a quicker repair)
