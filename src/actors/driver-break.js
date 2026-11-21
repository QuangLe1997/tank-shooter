// actors/driver-break.js — Z363 THE DRIVER'S BREAK: after a long stretch of quiet riding he has had enough. He pulls over, the soldier steps down,
//   he gets off on the far side and walks a few metres off — for a smoke squatting on his heels (lit in cupped hands, three long drags, the smoke let
//   out slow, the butt flicked away) or, his back to everyone, a pee (a whistle at the sky, a shiver at the end) — then back to the bike, and he rides
//   over to pick the soldier up. It only comes when it is quiet (no hit on the ride, the soldier's gun quiet, nobody near: RIDE_BREAK); shots or an
//   enemy coming and he cuts it short and runs back.
import * as THREE from 'three';
import { RIDE, RIDE_BREAK, XEOM } from '../../config.js';
import { CV, S, blendPose, blocksNear, curlHand, driverLine, drvFlatFoot, drvHang, drvHips, drvLens, drvLook, drvPlant, drvRest, drvStand, drvStartWalk, drvStopWalk, drvToWorld, drvWalkTo, enemies, heightAt, ik2, rollHand, scene, sfx, snapPose, spawnPart } from '../hub.js';

const V3 = () => new THREE.Vector3();
const _a = V3(), _b = V3(), _c = V3(), _d = V3(), _e = V3(), _p = V3(), _mo = V3(), _ia = V3(), _ib = V3();
const UPW = new THREE.Vector3(0, 1, 0), FWD = V3(), RT = V3(), RF = V3(), RR = V3(), _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = k => k * k * (3 - 2 * k), mix = (a, b, k) => a + (b - a) * k, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const SIDES = [['Left', -1], ['Right', 1]];
export const DRIVER_BREAK = new Set(['smoke', 'pee']);   // (off the bike; 'pull', slowing to a stop on the seat, is posed by actors/driver.js)

const wp = (b, out) => b.getWorldPosition(out);
const gnd = (v, up = 0) => (v.y = heightAt(v.x, v.z) + up, v);
const now = () => performance.now() / 1000;
function frame(hd){ FWD.set(Math.sin(hd), 0, Math.cos(hd)); RT.set(-Math.cos(hd), 0, Math.sin(hd)); }
function turn(b, axis, ang){ if(!b || Math.abs(ang) < 1e-5) return; _q.setFromAxisAngle(axis, ang); b.getWorldQuaternion(_qw); _qw.premultiply(_q); b.parent.getWorldQuaternion(_qp); b.quaternion.copy(_qp.invert().multiply(_qw)); b.updateMatrixWorld(true); }
function aim(b, c, dir){ if(!b || !c) return; wp(b, _ia); wp(c, _ib); _ib.sub(_ia); if(_ib.lengthSq() < 1e-10) return; _q.setFromUnitVectors(_ib.normalize(), _ia.copy(dir).normalize());
  b.getWorldQuaternion(_qw); _qw.premultiply(_q); b.parent.getWorldQuaternion(_qp); b.quaternion.copy(_qp.invert().multiply(_qw)); b.updateMatrixWorld(true); }
function rideFrame(H){ const b = H.body || H.B; H.B.updateWorldMatrix(true, true); b.getWorldQuaternion(_q); RF.set(0, 0, 1).applyQuaternion(_q); RR.set(-1, 0, 0).applyQuaternion(_q); }
const onRide = (H, arr, out) => H.toWorld ? H.toWorld(arr, out) : H.B.localToWorld(out.fromArray(arr));
function steer(D, want, dt, rate){ const h = D.hd ?? D.w.rotation.y; D.hd = h + clamp(wrapA(want - h), -rate * dt, rate * dt); }
// nobody within r of the ride
function quietAround(H, r){ const x = H.root.position.x, z = H.root.position.z; for(const e of enemies) if(e.pos && Math.hypot(e.pos.x - x, e.pos.z - z) < r) return false; return true; }

// ---- when: tired from riding, and only when it is quiet (from driveDriver, every frame) ----
export function driverBreakCheck(H, D, dt, v){ const K = RIDE_BREAK, t = now(); if(S.firing) D.fireT = t;
  if(D.state !== 'ride' || !CV.mounted || CV.trans || CV.H !== H || H.broken) return;
  D.tired = (D.tired || 0) + (Math.abs(v) > 1 ? dt : 0); if(D.tiredAt == null) D.tiredAt = K.every[0] + Math.random() * K.every[1];   // (riding time only; never undefined, or the first quiet moment would do)
  if(D.tired < D.tiredAt) return; const hit = D.hits && D.hits.length ? D.hits[D.hits.length - 1] : -99;
  if(t - hit < K.calm || t - (D.fireT ?? -99) < K.calm * 0.5 || !quietAround(H, K.safeR)) return;
  driverBreakStart(H, Math.random() < K.peeK ? 'pee' : 'smoke'); }
// he wants one now: he says so and pulls over (game/ride-wear.js rideSpeedK holds the ride to a stop while H.onBreak)
export function driverBreakStart(H, kind){ const D = H && H.drv, K = RIDE_BREAK; if(!D || !D.ok || D.state !== 'ride') return;
  D.tired = 0; D.tiredAt = K.every[0] + Math.random() * K.every[1]; D.brk = kind; D.state = 'pull'; D.t2 = 0; D.still = 0; H.onBreak = true; driverLine(D, kind); }
// on the seat, stopping (after the ride pose): stopped a moment, the soldier steps down and he gets off on the far side
export function drvBreakPull(H, D, dt, v){ D.t2 += dt; D.still = Math.abs(v) < 0.3 ? (D.still || 0) + dt : 0; if(D.still < RIDE_BREAK.still && D.t2 < 6) return;
  if(CV.H === H && CV.mounted && !CV.trans) CV.trans = { k:'off', t:0 }; offToBreak(H, D); }
// off on the bike's right (the soldier gets down on its left), to a spot away m off, ahead at angle (or behind, or straight out, whichever is clear)
function offToBreak(H, D){ const K = RIDE_BREAK; rideFrame(H); D.mix.stopAllAction(); drvToWorld(D);
  const down = gnd(onRide(H, D.R.hip, V3()).addScaledVector(RR, K.side)), away = D.brk === 'pee' ? K.peeAway : K.away, out = [];
  let dir = null, spot = null; for(const a of [K.angle, -K.angle, 0]){ const d0 = V3().copy(RR).multiplyScalar(Math.cos(a)).addScaledVector(RF, Math.sin(a)); d0.y = 0; d0.normalize();
    const s0 = gnd(V3().copy(down).addScaledVector(d0, away)); if(!dir) { dir = d0; spot = s0; } if(!blocksNear(s0.x, s0.z, 1.2, out).length){ dir = d0; spot = s0; break; } }
  // facing: the smoke squatting side-on to the bike (looking out along its nose), the pee with his back to the bike
  D.br = { down, spot, hd:D.brk === 'pee' ? Math.atan2(dir.x, dir.z) : Math.atan2(RF.x, RF.z) };
  D.w.position.copy(down); D.hd = Math.atan2(spot.x - down.x, spot.z - down.z); D.w.rotation.set(0, D.hd, 0);
  D.state = D.brk; D.ph = 'walk'; D.t2 = 0; D.said = {}; D.cut = false; drvStartWalk(D); snapPose(D, K.step); }

// ---- every frame, for the states this module owns ----
export function driverBreak(H, D, dt){ const K = RIDE_BREAK, br = D.br; D.t2 += dt;
  if(D.ph !== 'home' && !D.cut && (S.firing || !quietAround(H, K.safeR * 0.6))){ D.cut = true; driverLine(D, 'cut'); goHome(D); }   // shots, or someone coming: back to the bike
  if(D.ph === 'walk'){ if(drvWalkTo(D, br.spot, dt) < 0.05 || D.t2 > 7){ drvStopWalk(D); D.ph = 'act'; D.t2 = 0; D.pAcc = 0; } return; }
  if(D.ph === 'home'){ if(drvWalkTo(D, br.down, dt) < 0.05 || D.t2 > 9) remount(H, D); return; }
  if(D.state === 'smoke') smokeAct(H, D, dt); else peeAct(H, D, dt); }
function goHome(D){ if(D.mask) D.mask.visible = true; if(D.ph === 'home') return; D.ph = 'home'; D.t2 = 0; drvStartWalk(D); }
// back on the seat (eased up onto it: 'mount'); once on, he rides over to the soldier and picks him up (D.pickup: game/cavalry.js onBack)
function remount(H, D){ snapPose(D, RIDE.crash.mount); D.mix.stopAllAction(); D.walking = false; const body = H.body || H.B; body.add(D.w); D.w.position.set(0, 0, 0); D.w.rotation.set(0, 0, 0, 'XYZ'); D.w.scale.setScalar(D.s0);
  D.state = 'mount'; D.t2 = 0; D.hd = null; D.br = null; D.brk = null; D.ph = null; H.onBreak = false; D.pickup = true; }

// ---- the smoke: down on his heels, lit in cupped hands, three long drags, the butt flicked away ----
function squat(D, k, lean){ const B = D.B, L = drvLens(D), w = D.w, aw = D.ankle * XEOM.k, SM = RIDE_BREAK.smoke; frame(D.hd); w.rotation.set(0, D.hd, 0); w.position.y = heightAt(w.position.x, w.position.z); drvRest(D);
  _p.copy(w.position).addScaledVector(FWD, -mix(0.01, SM.back, k)); _p.y += mix(aw + (L.th + L.sh) * 0.975, SM.hipH, k);   // hips: stood → low and back over the heels
  const ln = mix(0.04, lean, k); drvHips(D, _p, _a.copy(UPW).multiplyScalar(Math.cos(ln)).addScaledVector(FWD, Math.sin(ln)), RT);
  for(const [L1, sd] of SIDES){ _a.copy(w.position).addScaledVector(RT, sd * mix(0.11, SM.wide, k)).addScaledVector(FWD, mix(0.01, 0.08, k)); gnd(_a, aw);
    _b.copy(_a).addScaledVector(FWD, 0.6).addScaledVector(UPW, 0.5).addScaledVector(RT, sd * mix(0.1, 0.35, k)); ik2(B[L1 + 'UpLeg'], B[L1 + 'Leg'], B[L1 + 'Foot'], _a.clone(), _b.clone()); drvFlatFoot(D, L1); } }
// a forearm laid over its knee, the hand hanging
function onKnee(D, L1, sd){ const B = D.B; wp(B[L1 + 'Leg'], _a); _a.addScaledVector(FWD, 0.17).addScaledVector(UPW, -0.04).addScaledVector(RT, -sd * 0.03);
  wp(B[L1 + 'Arm'], _b); _b.addScaledVector(RT, sd * 0.35).addScaledVector(UPW, -0.25).addScaledVector(FWD, -0.1); ik2(B[L1 + 'Arm'], B[L1 + 'ForeArm'], B[L1 + 'Hand'], _a.clone(), _b.clone());
  aim(B[L1 + 'Hand'], B[L1 + 'HandMiddle1'], _c.copy(FWD).addScaledVector(UPW, -1.2)); curlHand(B, L1, 0.35, _a.clone().addScaledVector(FWD, -0.1)); }
function smokeAct(H, D, dt){ const SM = RIDE_BREAK.smoke, B = D.B, t = D.t2, w = D.w, br = D.br;
  const tL = SM.squat, tD = tL + SM.light, tF = tD + SM.n * SM.drag, tU = tF + SM.flick, tE = tU + SM.squat;
  if(t >= tE){ driverLine(D, 'rested'); goHome(D); return; }
  steer(D, br.hd, dt, 5); const k = t < SM.squat ? ease(t / SM.squat) : t > tU ? 1 - ease((t - tU) / SM.squat) : 1;
  if(D.mask) D.mask.visible = !(t > tL - 0.25 && t < tF + SM.flick * 0.5);   // his mask pulled down off his mouth to smoke
  squat(D, k, SM.lean);
  // eyes out over the field, chin up as he lets the smoke out
  const dn = Math.floor((t - tD) / SM.drag), df = (t - tD) / SM.drag - dn, smoking = t >= tD && t < tF, exhale = smoking && df > 0.55;
  drvLook(D, _e.copy(w.position).addScaledVector(FWD, 12).setY(w.position.y + 1.2), Math.sin(t * 0.5) * 0.25, (exhale ? 0.18 : 0) + (t < tD && t > tL ? -0.25 : 0), mix(0.04, SM.lean, k));
  wp(B.Head, _mo).addScaledVector(FWD, 0.1).addScaledVector(UPW, 0.02);   // his mouth
  onKnee(D, 'Left', -1);
  // the right hand: both hands cupped at the mouth to light it · each drag up to the mouth, held, down to the knee · the flick
  let toMouth = 0; if(t >= tL && t < tD) toMouth = ease(clamp((t - tL) / 0.3, 0, 1)) * (1 - ease(clamp((t - tD + 0.3) / 0.3, 0, 1)));
  else if(smoking) toMouth = df < 0.2 ? ease(df / 0.2) : df < 0.45 ? 1 : 1 - ease(clamp((df - 0.45) / 0.2, 0, 1));
  onKnee(D, 'Right', 1); if(toMouth > 0.01){ wp(B.RightHand, _a); _b.copy(_mo).addScaledVector(FWD, 0.03).addScaledVector(UPW, -0.03).addScaledVector(RT, 0.02); _a.lerp(_b, toMouth);
    wp(B.RightArm, _c); _c.addScaledVector(RT, 0.3).addScaledVector(UPW, -0.4); ik2(B.RightArm, B.RightForeArm, B.RightHand, _a.clone(), _c.clone()); rollHand(B, 'Right', _d.copy(UPW).negate()); }
  if(t >= tL && t < tD){ _a.copy(_mo).addScaledVector(FWD, 0.06).addScaledVector(UPW, -0.05).addScaledVector(RT, -0.03); wp(B.LeftArm, _c); _c.addScaledVector(RT, -0.35).addScaledVector(UPW, -0.4);   // the left hand cupped round the flame
    ik2(B.LeftArm, B.LeftForeArm, B.LeftHand, _a.clone(), _c.clone()); curlHand(B, 'Left', 0.45, _mo.clone());
    if(!D.said.lit && t > tL + SM.light * 0.45){ D.said.lit = 1; sfx('click', undefined, 0.4); spawnPart(_mo.x + FWD.x * 0.08, _mo.y - 0.02, _mo.z + FWD.z * 0.08, 0, 0.3, 0, { color:0xffb030, size:0.06, life:0.35, grav:0.6, drag:2 }); } }
  if(t >= tF && t < tU){ const f = (t - tF) / SM.flick; wp(B.RightArm, _c); _a.copy(_c).addScaledVector(FWD, mix(0.25, 0.45, f)).addScaledVector(UPW, mix(-0.3, -0.15, f)).addScaledVector(RT, 0.1);   // the flick
    _c.addScaledVector(RT, 0.3).addScaledVector(UPW, -0.4); ik2(B.RightArm, B.RightForeArm, B.RightHand, _a.clone(), _c.clone());
    if(!D.said.fl && f > 0.5){ D.said.fl = 1; spawnPart(_a.x, _a.y, _a.z, FWD.x * 3, 1.4, FWD.z * 3, { color:0xff7a20, size:0.05, life:0.8, grav:-9, drag:0.3 }); } }
  // the smoke: out of his mouth after each drag, slow, drifting up
  if(exhale && Math.random() < dt * 14) spawnPart(_mo.x, _mo.y, _mo.z, FWD.x * 0.35 + (Math.random() - 0.5) * 0.15, 0.22, FWD.z * 0.35 + (Math.random() - 0.5) * 0.15, { color:0xc4c4c4, size:0.18, grow:2.6, life:1.9, grav:0.12, drag:1.3, smoke:true, op:0.5 });
  if(smoking && dn === 0 && !D.said.puff && df > 0.6){ D.said.puff = 1; driverLine(D, 'puff'); }
  // the cigarette: in his lips while he lights it, then between his fingers until the flick
  const lit = t >= tL + SM.light * 0.45; if(t >= tL && t < tF + SM.flick * 0.5){ if(t < tD) cigAt(D, _a.copy(_mo).addScaledVector(FWD, 0.035), FWD, lit ? 0.6 : 0); else cigInHand(D, toMouth > 0.9 ? 1 : 0.4); }
  blendPose(D, dt); }
// the cigarette prop (a world-space group posed when it shows): paper, filter, the glowing tip
let CIG = null;
function cigMesh(){ if(!CIG) CIG = { p:new THREE.CylinderGeometry(0.0045, 0.0045, 0.055, 6).translate(0, 0.0275 + 0.02, 0), f:new THREE.CylinderGeometry(0.0047, 0.0047, 0.02, 6).translate(0, 0.01, 0),
    e:new THREE.SphereGeometry(0.0055, 6, 4).translate(0, 0.076, 0), pm:new THREE.MeshStandardMaterial({ color:0xf2efe6, roughness:0.9 }), fm:new THREE.MeshStandardMaterial({ color:0xc98a4a, roughness:0.8 }), em:new THREE.MeshBasicMaterial({ color:0xff5a1a }) };
  const g = new THREE.Group(); g.add(new THREE.Mesh(CIG.p, CIG.pm), new THREE.Mesh(CIG.f, CIG.fm), new THREE.Mesh(CIG.e, CIG.em)); g.matrixAutoUpdate = false; g.visible = false; scene.add(g); return g; }
const _cx = V3(), _cz = V3(), _cm = new THREE.Matrix4();
function cigAt(D, pos, axis, glow){ const g = D.cig || (D.cig = cigMesh()); _cx.set(0, 1, 0).cross(axis); if(_cx.lengthSq() < 1e-6) _cx.set(1, 0, 0); _cx.normalize(); _cz.crossVectors(_cx, axis);
  _cm.makeBasis(_cx, axis, _cz).setPosition(pos); g.matrix.copy(_cm); g.matrixWorldNeedsUpdate = true; g.children[2].scale.setScalar(1 + glow * 0.6); g.visible = true; }
function cigInHand(D, glow){ const B = D.B; if(!B.RightHandIndex2 || !B.RightHandMiddle2 || !B.RightHandPinky1 || !B.RightHandIndex1) return;
  wp(B.RightHandIndex2, _a); wp(B.RightHandMiddle2, _b); _a.add(_b).multiplyScalar(0.5); wp(B.RightHandIndex1, _c); wp(B.RightHandPinky1, _b); _c.sub(_b).normalize();   // between the index and middle fingers, out past the thumb side
  cigAt(D, _a.addScaledVector(_c, -0.012), _c, glow); }

// ---- the pee: his back to the bike, feet apart, hands in front, a whistle at the sky, the stream, a shiver, done ----
function peeAct(H, D, dt){ const P = RIDE_BREAK.pee, B = D.B, t = D.t2, w = D.w, br = D.br, tS = P.open, tV = tS + P.stream, tE = tV + P.shiver + P.close;
  if(t >= tE){ driverLine(D, 'rested'); goHome(D); return; }
  steer(D, br.hd, dt, 5); drvStand(D, -0.06, 0.02, 0); frame(D.hd); drvPlant(D, 'Left', -1, 0, 0.17); drvPlant(D, 'Right', 1, 0, 0.17);
  const shiver = t >= tV && t < tV + P.shiver ? Math.sin((t - tV) / P.shiver * Math.PI) : 0;
  if(shiver){ turn(B.Spine1, UPW, Math.sin(t * 62) * 0.06 * shiver); turn(B.Spine2, FWD, Math.sin(t * 47) * 0.07 * shiver); }
  drvLook(D, _e.copy(w.position).addScaledVector(FWD, 6).setY(w.position.y + 3.5), Math.sin(t * 0.9) * 0.45, shiver * 0.2, 0);   // up at the sky, looking round
  // both hands in front of him, low
  wp(B.LeftUpLeg, _a); wp(B.RightUpLeg, _b); const cr = _p.copy(_a).add(_b).multiplyScalar(0.5).addScaledVector(FWD, 0.13).addScaledVector(UPW, -0.06);
  for(const [L1, sd] of SIDES){ _a.copy(cr).addScaledVector(RT, sd * 0.035).addScaledVector(FWD, -0.02); wp(B[L1 + 'Arm'], _b); _b.addScaledVector(RT, sd * 0.4).addScaledVector(FWD, -0.25).addScaledVector(UPW, -0.1);
    ik2(B[L1 + 'Arm'], B[L1 + 'ForeArm'], B[L1 + 'Hand'], _a.clone(), _b.clone()); curlHand(B, L1, 0.55, cr.clone()); }
  if(!D.said.wh && t > tS + 0.5){ D.said.wh = 1; sfx('whistle', undefined, 0.45); }
  if(!D.said.pp && t > tS + 1.6){ D.said.pp = 1; driverLine(D, 'peeing'); }
  // the stream (small, pale drops arcing down ahead of him), easing off at the end
  if(t >= tS && t < tV){ const f = 1 - Math.max(0, (t - (tV - 0.6)) / 0.6); D.pAcc = (D.pAcc || 0) + dt * P.rate * f;
    while(D.pAcc >= 1){ D.pAcc -= 1; spawnPart(cr.x + FWD.x * 0.05, cr.y, cr.z + FWD.z * 0.05, FWD.x * P.v * f + (Math.random() - 0.5) * 0.15, 0.45 * f, FWD.z * P.v * f + (Math.random() - 0.5) * 0.15, { color:0xf0d050, size:0.045, life:0.6, grav:-9.8, drag:0.2, op:0.9 }); } }
  blendPose(D, dt); }
