// actors/driver.js — Z296 THE DRIVER, A CHARACTER OF HIS OWN: the xe ôm / ba gác / xích lô driver is no longer baked into the ride. He is his own rigged
// Tripo model (Mixamo skeleton), sat on his own ride, and he RIDES it: every frame his hips are set on the saddle, his hands are reached onto the
// grips and his feet onto the pegs (the xích lô's pedals turn, and his feet with them) by two-bone IK, so whatever the machine does he does with it.
//   · in the bends the bike banks and he leans with it, head turned into the corner and held level;
//   · fast and under fire he weaves (lạng lách); Space pulls a wheelie (bốc đầu) — front up off the rear axle, him back on his arms;
//   · opening the throttle he twists the right grip back; through the gears his left foot flicks the lever;
//   · shot at, he ducks down behind the bars, head tucked to one side;
//   · a hard hit or a crash at speed and the bike goes down on its side and slides; he is thrown off (his own fall clip), gets up, walks back,
//     heaves it upright, swings back on — and the soldier, who jumped clear, is called back on board.
// What the two of them say is kept in one table (RIDE_TALK: the driver's line, the soldier's answer, by event) so voices can be laid on later.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { RIDE, RIDE_TALK, XEOM } from '../../config.js';
import { BIOME, CV, S, burst, curlHand, floatText, heightAt, loadGLTF, scene, sfx, spawnPart } from '../hub.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3(), _g = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _m = new THREE.Matrix4();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = k => k * k * (3 - 2 * k);
const bones = root => { const B = {}; root.traverse(o => { if(o.isBone && o.name.startsWith('mixamorig')) B[o.name.slice(9)] = o; }); return B; };

// turn bone b (world) so that the direction from it to its child c points along dir
function aim(b, c, dir){ b.getWorldPosition(_a); c.getWorldPosition(_b); _e.subVectors(_b, _a); if(_e.lengthSq() < 1e-10) return; _e.normalize();
  _q.setFromUnitVectors(_e, dir); b.getWorldQuaternion(_qw); _qw.premultiply(_q); b.parent.getWorldQuaternion(_qp); b.quaternion.copy(_qp.invert().multiply(_qw)); b.updateMatrixWorld(true); }
// a world-space turn about an axis, laid onto bone b
function turn(b, axis, ang){ if(!b || Math.abs(ang) < 1e-5) return; _q.setFromAxisAngle(axis, ang); b.getWorldQuaternion(_qw); _qw.premultiply(_q); b.parent.getWorldQuaternion(_qp); b.quaternion.copy(_qp.invert().multiply(_qw)); b.updateMatrixWorld(true); }
// two-bone IK: root a → mid b → end c reaches target t, bending toward pole
const _ia = new THREE.Vector3(), _ib = new THREE.Vector3(), _ic = new THREE.Vector3(), _id = new THREE.Vector3(), _if = new THREE.Vector3(), _ig = new THREE.Vector3(), _it = new THREE.Vector3();
function ik2(a, b, c, t, pole){ a.getWorldPosition(_ia); b.getWorldPosition(_ib); c.getWorldPosition(_ic);
  const l1 = _ia.distanceTo(_ib), l2 = _ib.distanceTo(_ic); _id.subVectors(t, _ia); const dist = clamp(_id.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3); _id.normalize();
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _if.subVectors(pole, _ia); _if.addScaledVector(_id, -_if.dot(_id)); if(_if.lengthSq() < 1e-8) _if.set(0, -1, 0); _if.normalize();
  _ig.copy(_ia).addScaledVector(_id, x).addScaledVector(_if, h);   // where the elbow / knee goes
  _it.copy(_ia).addScaledVector(_id, dist);                        // the reachable target
  aim(a, b, _ig.clone().sub(_ia).normalize());
  b.getWorldPosition(_ib); aim(b, c, _it.clone().sub(_ib).normalize()); }

// ---- build: the driver onto ride H (once his model is in) ----
export function makeDriver(H, kind){ const R = RIDE.fit[kind]; if(!R || typeof window === 'undefined') return null;
  const D = H.drv = { kind, R, ok:false, state:'ride', t:0, duck:0, duckT:0, tilt:0, weave:0, wheel:0, wheelT:0, pitch:0, thr:0, gear:0, gearT:0, crank:0, roll:0, lastV:0, sayAt:0, cool:0, look:0 };
  loadGLTF(RIDE.model[kind]).then(gl => { if(!gl || H.drv !== D) return; const sc = skClone(gl.scene), w = new THREE.Group(); w.name = 'driver';
    sc.traverse(o => { if(o.isSkinnedMesh){ o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; } });
    const b = new THREE.Box3().setFromObject(sc); w.add(sc); sc.rotation.y = RIDE.yaw; D.h0 = Math.max(1e-3, b.max.y - b.min.y); const s = D.s0 = RIDE.h / XEOM.k / D.h0; w.scale.setScalar(s);
    H.B.add(w); D.w = w; D.sc = sc; D.B = bones(sc); D.rest = new Map(); for(const bn of Object.values(D.B)) D.rest.set(bn, bn.quaternion.clone());
    D.mix = new THREE.AnimationMixer(sc); D.A = {}; for(const c of gl.animations){ const a = D.mix.clipAction(c); D.A[c.name] = a; }
    D.ok = !!(D.B.Hips && D.B.LeftArm && D.B.LeftUpLeg); if(D.ok) talk(D, 'start'); });
  return D; }

// ---- what he says (RIDE_TALK: by event, the driver's line then the soldier's answer) — floating words for now, voices later ----
export const RIDE_VOICE = { on:false, play:null };   // a voice player can be hung here: play(who, event, index)
function talk(D, ev, force){ const T = RIDE_TALK[ev], now = performance.now() / 1000, p = S.player; if(!T || !p || (!force && now < D.sayAt)) return; D.sayAt = now + RIDE_TALK.gap;
  const i = (Math.random() * T.d.length) | 0, at = () => new THREE.Vector3(p.pos.x, p.pos.y + 3.2, p.pos.z);
  floatText(T.d[i], RIDE_TALK.col.d, at(), 13); if(RIDE_VOICE.on && RIDE_VOICE.play) RIDE_VOICE.play('driver', ev, i);
  if(T.s && T.s.length){ const j = (Math.random() * T.s.length) | 0; setTimeout(() => { if(S.player === p){ floatText(T.s[j], RIDE_TALK.col.s, at(), 13); if(RIDE_VOICE.on && RIDE_VOICE.play) RIDE_VOICE.play('soldier', ev, j); } }, RIDE_TALK.reply * 1000); } }
export function rideTalk(ev, force){ const D = CV.H && CV.H.drv; if(D) talk(D, ev, force); }

// ---- events from the game ----
export function bikeWheelie(H){ const D = H && H.drv; if(!D || D.state !== 'ride' || !RIDE.fit[D.kind].wheelie) return false; D.wheelT = RIDE.wheelie.dur; sfx('whoosh'); talk(D, 'wheelie', true); return true; }
export function rideHit(dmg){ const H = CV.H, D = H && H.drv; if(!D || !D.ok) return; D.duckT = RIDE.duck.t; if(D.state !== 'ride' || !CV.mounted) return;
  if(dmg >= RIDE.crash.hit && Math.random() < RIDE.crash.p && performance.now() / 1000 > D.cool) bikeCrash(H, 'hit'); else talk(D, 'underfire'); }
export function rideBump(vn){ const H = CV.H, D = H && H.drv; if(D && D.ok && D.state === 'ride' && CV.mounted && vn > RIDE.crash.v && performance.now() / 1000 > D.cool) bikeCrash(H, 'bump'); }
export function bikeCrash(H, why){ const D = H.drv; if(!D || D.state !== 'ride') return; const now = performance.now() / 1000;
  D.state = 'fall'; D.t = 0; D.cool = now + RIDE.crash.cool; D.side = Math.random() < 0.5 ? -1 : 1; D.slide = Math.max(4, Math.abs(CV.speed)); D.wheelT = 0;
  // he is thrown: out of the ride, into the world where he was, carried forward and to the side
  const w = D.w; w.getWorldPosition(_a); w.getWorldQuaternion(_qw); scene.add(w); w.position.copy(_a); w.rotation.order = 'YXZ'; w.rotation.setFromQuaternion(_qw, 'YXZ'); w.rotation.x = 0; w.rotation.z = 0; w.scale.setScalar(RIDE.h / Math.max(1e-3, D.h0 || 1));
  const f = CV.facing; D.vel = new THREE.Vector3(Math.sin(f) * D.slide * 0.7 + Math.cos(f) * D.side * 2.2, 3.2, Math.cos(f) * D.slide * 0.7 - Math.sin(f) * D.side * 2.2);
  D.mix.stopAllAction(); const fa = D.A.hurt || D.A.fall; if(fa){ fa.reset(); fa.setLoop(THREE.LoopRepeat, Infinity); fa.timeScale = 1.4; fa.play(); }   // flailing as he goes over
  D.tip = 0;
  S.shake = Math.min(3, S.shake + 1.4); sfx('crunch'); burst({ x:H.root.position.x, z:H.root.position.z }, BIOME.ground, 10, 5, { y:heightAt(H.root.position.x, H.root.position.z) + 0.3, life:0.8, size:1.1, smoke:true, grav:-0.3, drag:2, op:0.5 });
  talk(D, 'crash', true); if(CV.mounted && RIDE.crash.throwSoldier && D.onCrash) D.onCrash(); }

// ---- every frame (from animateBike): v = speed, yr = yaw rate ----
export function driveDriver(H, dt, v, yr){ const D = H.drv; if(!D || !D.ok || !dt) return; const R = D.R, now = performance.now() / 1000; D.t += dt;
  const acc = (v - D.lastV) / dt; D.lastV = v; const sp = Math.min(1, Math.abs(v) / 9);
  // the machine: lean, wheelie (about the rear axle), weave, lying on its side after a crash
  D.wheelT = Math.max(0, D.wheelT - dt); const wantP = D.wheelT > 0 ? RIDE.wheelie.pitch * Math.min(1, (RIDE.wheelie.dur - D.wheelT) * 5, D.wheelT * 3) : 0;
  D.pitch += (wantP - D.pitch) * Math.min(1, dt * 8);
  const underFire = D.duckT > 0; D.duckT = Math.max(0, D.duckT - dt); D.duck += ((underFire ? 1 : 0) - D.duck) * Math.min(1, dt * 6);
  const weaveOn = D.state === 'ride' && sp > 0.55 && (underFire || S.firing); D.weave += ((weaveOn ? 1 : 0) - D.weave) * Math.min(1, dt * 3);
  const wv = D.weave * RIDE.weave.amp * Math.sin(D.t * RIDE.weave.f * Math.PI * 2);
  let roll = H.lean + wv * 1.4 * sp; if(D.state !== 'ride' && D.state !== 'mount') roll = D.roll;
  H.B.rotation.set(-D.pitch, wv * 0.5, roll, 'YXZ'); H.B.position.x = 0; H.B.position.z = 0;
  if(D.pitch > 1e-3){ _a.set(0, 0, R.rear); _b.copy(_a).applyEuler(H.B.rotation); H.B.position.add(_c.subVectors(_a, _b)); }
  if(D.state === 'fall' || D.state === 'down' || D.state === 'getup' || D.state === 'walk') H.B.position.y -= 0.12 * Math.abs(D.roll) / 1.4;
  // throttle and gears: the right grip twists back as he opens it; the left foot flicks up through the gears
  D.thr += (clamp(acc / 6, -0.4, 1) - D.thr) * Math.min(1, dt * 8);
  const g = RIDE.gears.filter(x => Math.abs(v) > x).length; if(g !== D.gear){ if(g > D.gear && R.gearFoot){ D.gearT = 0.28; sfx('click'); } D.gear = g; } D.gearT = Math.max(0, D.gearT - dt);
  D.crank += v * dt / (R.crankR || 0.17) * (R.pedal ? 0.5 : 0);
  if(D.state === 'ride' || D.state === 'mount'){ ridePose(H, D, dt, v, yr); if(D.state === 'mount'){ D.t2 += dt; if(D.t2 >= RIDE.crash.mount){ D.state = 'ride'; talk(D, 'remount', true); if(D.onBack) D.onBack(); } } }
  else crashStep(H, D, dt);
  if(D.state === 'ride' && sp > 0.85 && Math.abs(yr) > 1.1) talk(D, 'turn');
  else if(D.state === 'ride' && sp > 0.9) talk(D, 'fast'); }

// ---- riding: hips on the saddle, back bent to the bars, head into the bend, hands on the grips, feet on the pegs / pedals ----
const UP = new THREE.Vector3(), FWD = new THREE.Vector3(), RIGHT = new THREE.Vector3();
function ridePose(H, D, dt, v, yr){ const B = D.B, R = D.R, k = XEOM.k;
  for(const [b, q] of D.rest) b.quaternion.copy(q); D.mix.stopAllAction();
  H.B.updateMatrixWorld(true); D.w.updateMatrixWorld(true); H.B.getWorldQuaternion(_qw);
  UP.set(0, 1, 0).applyQuaternion(_qw); FWD.set(0, 0, 1).applyQuaternion(_qw); RIGHT.set(-1, 0, 0).applyQuaternion(_qw);   // the ride's own frame (+z ahead)
  // the hips: on the seat, square to the ride (side = his right), sat back a little in a wheelie
  const stopped = Math.abs(v) < 0.4 && !R.pedal;
  _a.fromArray(R.hip); H.B.localToWorld(_a); const hips = B.Hips; hips.parent.worldToLocal(_a); hips.position.copy(_a); hips.updateMatrixWorld(true);
  hips.getWorldPosition(_a); B.Spine.getWorldPosition(_b); B.RightUpLeg.getWorldPosition(_c); B.LeftUpLeg.getWorldPosition(_d);
  _e.subVectors(_b, _a).normalize(); _f.subVectors(_c, _d).normalize(); _g.crossVectors(_f, _e).normalize();
  _m.makeBasis(_f, _e, _g); _q.setFromRotationMatrix(_m); _m.makeBasis(RIGHT, UP, _a.copy(FWD).negate()); _qp.setFromRotationMatrix(_m); _qp.multiply(_q.invert());   // (side × up points backward: the same hand in both frames)
  hips.getWorldQuaternion(_qw); _qw.premultiply(_qp); hips.parent.getWorldQuaternion(_qp); hips.quaternion.copy(_qp.invert().multiply(_qw)); hips.updateMatrixWorld(true);
  // the back: bent forward to reach the bars (more when ducking, back when the front is up), leaning into the bend
  const bend = R.bend + D.duck * RIDE.duck.bend - D.pitch * 0.9, lean = clamp(-yr * Math.min(1, Math.abs(v) / 8) * RIDE.lean.body, -0.35, 0.35);
  for(const n of ['Spine', 'Spine1', 'Spine2']){ turn(B[n], RIGHT, bend / 3); turn(B[n], FWD, lean / 3); }
  // the head: into the bend, held level against the bank; tucked down and to one side when ducking
  D.look += (clamp(yr * 0.35, -0.6, 0.6) - D.look) * Math.min(1, dt * 5); D.tilt += ((D.duck > 0.3 ? (D.side || 1) * 0.35 : 0) - D.tilt) * Math.min(1, dt * 4);
  turn(B.Neck, UP, D.look * 0.6); turn(B.Head, UP, D.look * 0.4); turn(B.Head, FWD, -H.B.rotation.z * RIDE.lean.head + D.tilt); turn(B.Neck, RIGHT, -bend * 0.5 + D.duck * 0.45);
  // hands to the grips (the right one twists the throttle), elbows out and down
  for(const sd of [['Left', 0], ['Right', 1]]){ const [L, i] = sd; _a.fromArray(R.grip[i]); H.B.localToWorld(_a);
    B[L + 'Arm'].getWorldPosition(_b); _b.addScaledVector(RIGHT, (i ? 1 : -1) * 0.5).addScaledVector(UP, -0.35).addScaledVector(FWD, -0.15);
    const gp = _a.clone(), wrist = gp.clone().addScaledVector(UP, 0.035).addScaledVector(FWD, -0.065);   // the bar in the palm: the wrist just behind and above it
    ik2(B[L + 'Arm'], B[L + 'ForeArm'], B[L + 'Hand'], wrist, _b.clone()); curlHand(B, L, RIDE.grip, gp.addScaledVector(UP, -0.03)); }   // fingers closed round the grip
  if(B.RightHand && B.RightForeArm){ B.RightForeArm.getWorldPosition(_a); B.RightHand.getWorldPosition(_b); turn(B.RightHand, _c.subVectors(_b, _a).normalize(), -D.thr * 0.7); }
  // feet: on the pegs / floorboard; the xích lô's pedals go round; stopped, the left foot goes down to the road; the gear flick lifts the left toe
  for(const [L, i] of [['Left', 0], ['Right', 1]]){
    if(R.pedal){ const ph = D.crank + (i ? Math.PI : 0); _a.set(R.pedal[0] * (i ? -1 : 1), R.pedal[1] + Math.sin(ph) * R.crankR / k, R.pedal[2] + Math.cos(ph) * R.crankR / k); }
    else _a.fromArray(R.peg[i]);
    if(!R.pedal && stopped && i === 0){ _a.x += 0.12; _a.y = -0.02; }
    if(!R.pedal && i === 0 && D.gearT > 0) _a.y += Math.sin(D.gearT / 0.28 * Math.PI) * 0.035;
    H.B.localToWorld(_a); B[L + 'UpLeg'].getWorldPosition(_b); _b.addScaledVector(FWD, 1).addScaledVector(RIGHT, (i ? 1 : -1) * 0.35).addScaledVector(UP, 0.3);
    ik2(B[L + 'UpLeg'], B[L + 'Leg'], B[L + 'Foot'], _a.clone(), _b.clone()); } }

// ---- the crash: thrown and sliding · down · up again · back to the bike · heave it up · back on ----
function crashStep(H, D, dt){ const C = RIDE.crash, w = D.w; D.t2 = (D.t2 || 0) + dt; const st = D.state;
  // the ride: on its side, sliding to a stop, sparks and dust while it slides
  if(st === 'fall' || st === 'down' || st === 'getup' || st === 'walk'){ D.roll += ((D.side || 1) * 1.35 - D.roll) * Math.min(1, dt * 7);
    if(D.slide > 0.2){ D.slide *= Math.exp(-dt * 2.2); CV.hPos.x += Math.sin(CV.facing) * D.slide * dt; CV.hPos.z += Math.cos(CV.facing) * D.slide * dt; CV.speed = 0;
      if(Math.random() < 0.6) spawnPart(CV.hPos.x, heightAt(CV.hPos.x, CV.hPos.z) + 0.15, CV.hPos.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, { color:Math.random() < 0.5 ? 0xffd27a : 0xc8b890, size:0.12 + Math.random() * 0.2, life:0.4, grav:-9, drag:1 }); } }
  D.mix.update(dt);
  // he goes over backwards (tipped about his feet), lands flat on his back, lies a moment twitching, then sits up and gets to his feet
  const lie = () => { w.rotation.x = -D.tip; w.position.y = heightAt(w.position.x, w.position.z) + Math.sin(D.tip) * 0.14; };
  if(st === 'fall'){ D.vel.y -= 9.8 * dt; w.position.addScaledVector(D.vel, dt); D.tip = Math.min(Math.PI / 2, D.tip + dt * 3.2); w.rotation.x = -D.tip;
    const g = heightAt(w.position.x, w.position.z) + Math.sin(D.tip) * 0.14;
    if(w.position.y <= g){ w.position.y = g; D.vel.multiplyScalar(0.3); D.vel.y = 0; if(D.t2 > 0.25){ D.state = 'down'; D.t2 = 0; sfx('thud');
      burst({ x:w.position.x, z:w.position.z }, BIOME.ground, 6, 3, { y:w.position.y + 0.2, life:0.6, size:0.9, smoke:true, grav:-0.3, drag:2, op:0.45 }); } } }
  else if(st === 'down'){ D.tip += (Math.PI / 2 - D.tip) * Math.min(1, dt * 8); lie(); const fa = D.A.hurt; if(fa) fa.timeScale = 0.5;
    if(D.t2 > C.down){ D.state = 'getup'; D.t2 = 0; talk(D, 'getup', true); } }
  else if(st === 'getup'){ const k = ease(Math.min(1, D.t2 / C.getup)); D.tip = Math.PI / 2 * (1 - k); lie();
    const fa = D.A.hurt; if(fa) fa.timeScale = 0.8;
    if(D.t2 > C.getup){ D.state = 'walk'; D.t2 = 0; D.tip = 0; w.rotation.x = 0; D.mix.stopAllAction(); const wk = D.A.walk; if(wk){ wk.reset(); wk.setLoop(THREE.LoopRepeat, Infinity); wk.play(); } } }
  else if(st === 'walk'){ const tx = CV.hPos.x + Math.cos(CV.facing) * 0.9, tz = CV.hPos.z - Math.sin(CV.facing) * 0.9, dx = tx - w.position.x, dz = tz - w.position.z, d = Math.hypot(dx, dz);
    w.rotation.set(0, Math.atan2(dx, dz), 0); if(d > 0.15){ const s = Math.min(d, 1.6 * dt); w.position.x += dx / d * s; w.position.z += dz / d * s; } w.position.y = heightAt(w.position.x, w.position.z);
    if(d <= 0.15 || D.t2 > 5){ D.state = 'lift'; D.t2 = 0; D.mix.stopAllAction(); talk(D, 'lift', true); } }
  else if(st === 'lift'){ const k = ease(Math.min(1, D.t2 / C.lift)); D.roll = (D.side || 1) * 1.35 * (1 - k); w.rotation.set(0, CV.facing - Math.PI / 2, 0);
    for(const [b, q] of D.rest) b.quaternion.copy(q); w.updateMatrixWorld(true);   // braced beside it, hands on the grips, heaving it up
    H.B.updateMatrixWorld(true); const B = D.B; for(const [L, i] of [['Left', 0], ['Right', 1]]){ _a.fromArray(D.R.grip[i]); H.B.localToWorld(_a); B[L + 'Arm'].getWorldPosition(_b); _b.y -= 0.4; ik2(B[L + 'Arm'], B[L + 'ForeArm'], B[L + 'Hand'], _a.clone(), _b.clone()); }
    for(const n of ['Spine', 'Spine1']) turn(B[n], _e.set(Math.cos(CV.facing), 0, -Math.sin(CV.facing)), 0.35 * (1 - k));
    if(D.t2 >= C.lift){ D.state = 'mount'; D.t2 = 0; D.roll = 0; H.B.add(w); w.position.set(0, 0, 0); w.rotation.set(0, 0, 0, 'XYZ'); w.scale.setScalar(D.s0); } } }
export function driverReady(H){ const D = H && H.drv; return !D || !D.ok || D.state === 'ride'; }
