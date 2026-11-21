// actors/driver.js — Z296 THE DRIVER, A CHARACTER OF HIS OWN: the xe ôm / ba gác driver is no longer baked into the ride. He is his own rigged
// Tripo model (Mixamo skeleton), sat on his own ride, and he RIDES it: every frame his hips are set on the saddle, his hands are reached onto the
// grips and his feet onto the pegs by two-bone IK, so whatever the machine does he does with it.
//   · in the bends the bike banks and he leans with it, head turned into the corner and held level;
//   · fast and under fire he weaves (lạng lách); Space pulls a wheelie (bốc đầu) — front up off the rear axle, him back on his arms;
//   · opening the throttle he twists the right grip back; through the gears his left foot flicks the lever;
//   · shot at, he ducks down behind the bars, head tucked to one side;
//   · a hard hit or a crash at speed and the bike goes down on its side and slides; he is thrown off (his own fall clip), scrambles onto all fours and
//     crawls back to it, heaves it upright, swings back on — and the soldier, who jumped clear, is called back on board (Z331 actors/driver-acts.js);
//   · Z331 the soldier shot down: he gives himself up — off the ride, to the body with his hands up, on his knees beside it (actors/driver-acts.js).
// What the two of them say is kept in one table (RIDE_TALK: the driver's line, the soldier's answer, by event) so voices can be laid on later.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { RIDE, RIDE_TALK, XEOM } from '../../config.js';
import { BIOME, CV, DRIVER_ACTS, DRIVER_RANT, NIGHT, S, bikeHop, blendPose, burst, curlHand, downedRide, driverAct, driverLine, driverRant, driverStall, drvStallLook, drvStallStep, fitFaceMask, floatText, heightAt, loadGLTF, outfitColor, rideFixed, rideWear, rollHand, scene, sfx, snapPose, spawnPart, hudOn } from '../hub.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3(), _g = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3(), _k3 = new THREE.Vector3(), _k4 = new THREE.Vector3();
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
  const D = H.drv = { kind, R, ok:false, state:'ride', t:0, duck:0, duckT:0, tilt:0, weave:0, wheel:0, wheelT:0, pitch:0, thr:0, gear:0, gearT:0, roll:0, lastV:0, sayAt:0, cool:0, look:0, ip:0, ivp:0, il:0, ivl:0, ih:0, ivh:0, glN:0, glE:0, glA:0, peek:false, pk:0, pkN:0, sacN:0, sacA:0, fd:[0, 0], fdab:[0, 0], ankle:0.04, toeSlope:-0.4, storm:0, dodgeN:0, threat:0, threatT:0, chatK:0, chatS:1, bk:0, bkN:0, bkS:1, bkOn:false };
  loadGLTF(RIDE.model[kind]).then(gl => { if(!gl || H.drv !== D) return; const sc = skClone(gl.scene), w = new THREE.Group(); w.name = 'driver';
    sc.traverse(o => { if(o.isSkinnedMesh){ o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; } });
    const b = new THREE.Box3().setFromObject(sc); w.add(sc); sc.rotation.y = RIDE.yaw; D.h0 = Math.max(1e-3, b.max.y - b.min.y); const s = D.s0 = RIDE.h / XEOM.k / D.h0; w.scale.setScalar(s);
    (H.body || H.B).add(w); D.w = w; D.sc = sc; D.B = bones(sc); D.rest = new Map(); for(const bn of Object.values(D.B)) D.rest.set(bn, bn.quaternion.clone());
    D.mix = new THREE.AnimationMixer(sc); D.A = {}; for(const c0 of gl.animations){ const c = c0.clone(); c.tracks = c.tracks.filter(t => !t.name.endsWith('.scale')); D.A[c.name] = D.mix.clipAction(c); }   // (Z300 the clips' scale keys dropped: they would undo his longer legs)
    D.ok = !!(D.B.Hips && D.B.LeftArm && D.B.LeftUpLeg);
    if(D.B.LeftFoot && D.B.LeftToeBase){ w.updateWorldMatrix(true, true); const bb = new THREE.Box3().setFromObject(sc);   // Z300 his ankle's height off the sole, and the foot's rest slope (both from the standing rest pose)
      D.B.LeftFoot.getWorldPosition(_a); D.B.LeftToeBase.getWorldPosition(_b); D.ankle = Math.max(0.01, (_a.y - bb.min.y) / Math.max(1e-6, w.getWorldScale(_g).y)) * s; _b.sub(_a); D.toeSlope = Math.atan2(_b.y, Math.hypot(_b.x, _b.z)); }
    const MS = RIDE.mask && RIDE.mask[RIDE.model[kind]];   // Z305 his mask pulled up over nose and mouth, fitted to his own face (rest pose)
    if(MS && D.B.Head && D.B.HeadTop_End){ w.updateWorldMatrix(true, true); w.getWorldQuaternion(_qw); const ms = []; sc.traverse(o => { if(o.isSkinnedMesh) ms.push(o); });
      D.mask = fitFaceMask(D.B.Head, D.B.HeadTop_End, ms, _c.set(0, 0, 1).applyQuaternion(_qw), _d.set(0, 1, 0).applyQuaternion(_qw), MS, outfitColor(ms, ['Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm'].map(n => D.B[n]).filter(Boolean))); }   // (in his own shirt's colour)
    const lk = RIDE.legK || 1; if(lk !== 1){ for(const L of ['Left', 'Right']) D.B[L + 'UpLeg'] && D.B[L + 'UpLeg'].scale.setScalar(lk); D.ankle *= lk; }   // Z300 a little longer in the leg (the whole leg, foot too)
    if(D.ok) talk(D, 'start'); });
  return D; }

// ---- what he says (RIDE_TALK: by event, the driver's line then the soldier's answer) — floating words for now, voices later ----
export const RIDE_VOICE = { on:false, play:null };   // a voice player can be hung here: play(who, event, index)
function talk(D, ev, force){ const T = RIDE_TALK[ev], now = performance.now() / 1000, p = S.player; if(!T || !p || (!force && now < D.sayAt)) return; D.sayAt = now + RIDE_TALK.gap;
  D.chatT = now; D.chatS = D.bkOn ? D.bkS : Math.random() < 0.5 ? -1 : 1;   // (Z361 he turns his head back over a shoulder to say it: ridePose)
  const i = (Math.random() * T.d.length) | 0, at = () => new THREE.Vector3(p.pos.x, p.pos.y + 3.2, p.pos.z);
  const show = hudOn('talk'); if(show) floatText(T.d[i], RIDE_TALK.col.d, at(), 13); if(RIDE_VOICE.on && RIDE_VOICE.play) RIDE_VOICE.play('driver', ev, i);   // (Z324 the lines on screen only when THOẠI TRÊN MÀN HÌNH is on; the voice always)
  if(T.s && T.s.length){ const j = (Math.random() * T.s.length) | 0; setTimeout(() => { if(S.player === p){ D.heardT = performance.now() / 1000; if(show) floatText(T.s[j], RIDE_TALK.col.s, at(), 13); if(RIDE_VOICE.on && RIDE_VOICE.play) RIDE_VOICE.play('soldier', ev, j); } }, RIDE_TALK.reply * 1000); } }

// ---- events from the game ----
export function bikeWheelie(H){ const D = H && H.drv; if(!D || D.state !== 'ride' || !RIDE.fit[D.kind].wheelie) return false; D.wheelT = RIDE.wheelie.dur; sfx('whoosh'); talk(D, 'wheelie', true);
  const P = XEOM.air.hop, av = Math.abs(H.v || 0); if(av > P.v) bikeHop(H, P.vy[0] + (P.vy[1] - P.vy[0]) * Math.min(1, (av - P.v) / 3));   // Z311 fast, the wheelie leaves the ground: a short hop, the faster the higher
  return true; }
export function rideHit(dmg, dx, dz){ const H = CV.H, D = H && H.drv; if(H && CV.mounted) rideWear(H, dmg * XEOM.wear.share);   // Z303 the ride takes its share of the hit
  if(!D || !D.ok) return; D.duckT = RIDE.duck.t; if(D.state !== 'ride' || !CV.mounted) return;
  // Z300 every hit makes him flinch (a jerk down and to one side); several close together and he is under a storm of fire: he dodges and ducks his face
  const now = performance.now() / 1000, F = RIDE.dodge; D.hits = (D.hits || []).filter(t => now - t < F.win); D.hits.push(now);
  if(dx || dz){ (H.body || H.B).getWorldQuaternion(_qw); _e.set(-1, 0, 0).applyQuaternion(_qw); D.threat = -Math.sign(dx * _e.x + dz * _e.z) || D.threat || 1; D.threatT = now; }   // which side it came from (+ his right)
  D.ivp += F.flinch * (0.7 + Math.random() * 0.6); D.ivl += (D.threat ? -D.threat : Math.random() < 0.5 ? -1 : 1) * F.flinch * 0.7; D.ivh += F.flinch;
  if(dmg >= RIDE.crash.hit && Math.random() < RIDE.crash.p && performance.now() / 1000 > D.cool) bikeCrash(H, 'hit'); else talk(D, 'underfire'); }
export function rideBump(vn){ const H = CV.H, D = H && H.drv; if(D && D.ok && D.state === 'ride' && CV.mounted && vn > RIDE.crash.v && performance.now() / 1000 > D.cool) bikeCrash(H, 'bump'); }
export function bikeCrash(H, why, wear){ const D = H.drv; if(!D || D.state !== 'ride') return; const now = performance.now() / 1000; rideWear(H, wear ?? XEOM.wear.crash);   // (Z303 a crash knocks it about · Z306 a spill in traffic only a little)
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
  const onSeat = D.state === 'ride' || D.state === 'mount' || D.state === 'stall';
  let roll = H.two === false ? 0 : H.lean + wv * 1.4 * sp; if(!onSeat) roll = D.roll;   // (three wheels don't bank: they weave flat)
  H.B.rotation.set(-D.pitch, wv * 0.5, roll, 'YXZ'); H.B.position.x = 0; H.B.position.z = 0;
  if(D.pitch > 1e-3){ _a.set(0, 0, R.rear); _b.copy(_a).applyEuler(H.B.rotation); H.B.position.add(_c.subVectors(_a, _b)); }
  if(!onSeat && H.lie) H.B.position.y += H.lie[D.roll < 0 ? 0 : 1] * Math.min(1, Math.abs(D.roll) / 1.35);   // Z300 down on its side it rests ON the ground (its lowest point there), not half sunk into it
  // throttle and gears: the right grip twists back as he opens it; the left foot flicks up through the gears
  D.thr += (clamp(acc / 6, -0.4, 1) - D.thr) * Math.min(1, dt * 8);
  const g = RIDE.gears.filter(x => Math.abs(v) > x).length; if(g !== D.gear){ if(g > D.gear && R.gearFoot){ D.gearT = 0.28; sfx('click'); } D.gear = g; } D.gearT = Math.max(0, D.gearT - dt);
  if(onSeat){ const st = D.state === 'stall'; if(st) drvStallStep(H, D, dt, v); ridePose(H, D, dt, v, yr); if(st) drvStallLook(H, D);   // (Z361 the engine dead under him: actors/driver-rant.js)
    if(D.state === 'mount'){ blendPose(D, dt); D.t2 += dt; if(D.t2 >= RIDE.crash.mount){ if(H.broken) driverStall(H); else { D.state = 'ride'; talk(D, 'remount', true); if(D.onBack) D.onBack(); } } } }   // (Z303 picked up but dead: straight to the repair)
  else if(D.state === 'fix') fixStep(H, D, dt);
  else if(DRIVER_ACTS.has(D.state)) driverAct(H, D, dt);   // Z331 crawling to it, heaving it up, giving himself up
  else if(DRIVER_RANT.has(D.state)) driverRant(H, D, dt);   // Z361 off the dead bike: a boot to the tyre, a row with the soldier
  else crashStep(H, D, dt);
  if(D.state === 'ride' && sp > 0.85 && Math.abs(yr) > 1.1) talk(D, 'turn');
  else if(D.state === 'ride' && sp > 0.9) talk(D, 'fast'); }

// ---- riding: hips on the saddle, back bent to the bars, head into the bend, hands on the grips, feet on the pegs ----
const UP = new THREE.Vector3(), FWD = new THREE.Vector3(), RIGHT = new THREE.Vector3();
const onRide = (H, arr, out, steered) => H.toWorld ? H.toWorld(arr, out, steered) : H.B.localToWorld(out.fromArray(arr));   // a point on the body (or the bars), in the world
function ridePose(H, D, dt, v, yr){ const B = D.B, R = D.R, k = XEOM.k;
  for(const [b, q] of D.rest) b.quaternion.copy(q); D.mix.stopAllAction();
  H.B.updateMatrixWorld(true); D.w.updateMatrixWorld(true); (H.body || H.B).getWorldQuaternion(_qw);   // Z299 his frame is the sprung body's: it dives, squats and rolls under him
  UP.set(0, 1, 0).applyQuaternion(_qw); FWD.set(0, 0, 1).applyQuaternion(_qw); RIGHT.set(-1, 0, 0).applyQuaternion(_qw);   // the ride's own frame (+z ahead)
  // the hips: on the seat, square to the ride (side = his right), sat back a little in a wheelie
  const stopped = Math.abs(v) < 0.4;
  onRide(H, R.hip, _a); if(D.state === 'stall' && D.hipUp) _a.addScaledVector(UP, D.hipUp); const hips = B.Hips; hips.parent.worldToLocal(_a); hips.position.copy(_a); hips.updateMatrixWorld(true);   // (Z361 stood up off the seat on the kick-start)
  hips.getWorldPosition(_a); B.Spine.getWorldPosition(_b); B.RightUpLeg.getWorldPosition(_c); B.LeftUpLeg.getWorldPosition(_d);
  _e.subVectors(_b, _a).normalize(); _f.subVectors(_c, _d).normalize(); _g.crossVectors(_f, _e).normalize();
  _m.makeBasis(_f, _e, _g); _q.setFromRotationMatrix(_m); _m.makeBasis(RIGHT, UP, _a.copy(FWD).negate()); _qp.setFromRotationMatrix(_m); _qp.multiply(_q.invert());   // (side × up points backward: the same hand in both frames)
  hips.getWorldQuaternion(_qw); _qw.premultiply(_qp); hips.parent.getWorldQuaternion(_qp); hips.quaternion.copy(_qp.invert().multiply(_qw)); hips.updateMatrixWorld(true);
  // the back: bent forward to reach the bars (more when ducking, back when the front is up), leaning into the bend
  // Z299 his trunk is a damped pendulum: thrown forward onto his arms under the brakes, rocked back as the throttle opens, leaning into the bend on three
  //   wheels (against the roll), nodding with each heave of the suspension; he breathes
  const I = H.inert, Z = RIDE.sway; if(I){ const spr = (x, vx, t, kk) => vx + (-kk * (x - t) - 2 * Z.z * Math.sqrt(kk) * vx) * Math.min(dt, 0.05);
    D.ivp = spr(D.ip, D.ivp, clamp(-I.acc * Z.acc, -Z.max, Z.max), Z.k); D.ip += D.ivp * Math.min(dt, 0.05);
    D.ivl = spr(D.il, D.ivl, (H.two === false ? clamp(-I.lat * Z.lat, -Z.max, Z.max) : 0) - (D.threat || 0) * D.storm * RIDE.dodge.lean, Z.k); D.il += D.ivl * Math.min(dt, 0.05);
    D.ivh = spr(D.ih, D.ivh, clamp(-I.vy * Z.heave, -0.3, 0.3), Z.k * 2); D.ih += D.ivh * Math.min(dt, 0.05); }
  // Z300 under a storm of fire (several hits close together): down low behind the bars, face down and turned away from the guns, jinking his trunk
  //   side to side (mostly away from where it comes from), elbows tucked in
  const nowS = performance.now() / 1000, DG = RIDE.dodge, nh = (D.hits || []).filter(t => nowS - t < DG.win).length, storming = nh >= DG.n;
  D.storm += ((storming ? 1 : 0) - D.storm) * Math.min(1, dt * (storming ? 6 : 1.1)); if(nowS - D.threatT > DG.win * 2) D.threat = 0;
  if(D.storm > 0.3 && nowS > D.dodgeN){ D.dodgeN = nowS + DG.every[0] + Math.random() * DG.every[1]; const side = D.threat && Math.random() < 0.7 ? -D.threat : (Math.random() < 0.5 ? -1 : 1);
    D.ivl += side * DG.jink * D.storm; D.ivp += DG.jink * 0.45 * D.storm; }
  // Z304 ...but he can't ride blind: he ducks, then bobs up to see the road (eyes darting: ahead, left, right), and ducks again — over and over
  const cover = Math.max(D.duck, D.storm); if(cover > 0.3){ if(nowS > D.pkN){ D.peek = !D.peek; D.pkN = nowS + (D.peek ? DG.peek[0] + Math.random() * DG.peek[1] : DG.hide[0] + Math.random() * DG.hide[1]); } } else D.peek = false;
  D.pk += ((D.peek ? 1 : 0) - D.pk) * Math.min(1, dt * 12); const hid = 1 - 0.75 * D.pk;
  const bend = R.bend + (D.duck * RIDE.duck.bend + D.storm * DG.bend) * hid - D.pitch * 0.9 + D.ip, lean = clamp(-yr * Math.min(1, Math.abs(v) / 8) * RIDE.lean.body, -0.35, 0.35) + D.il;
  for(const n of ['Spine', 'Spine1', 'Spine2']){ turn(B[n], RIGHT, -bend / 3); turn(B[n], FWD, lean / 3); } turn(B.Spine2, RIGHT, Math.sin(D.t * 1.7) * 0.014);   // (Z300 about his right, + tips him BACK: bending to the bars is −)
  // Z358 SAT TALL, BACK STRAIGHT: the model's own spine curls him over the bars (a hunched rider) — each link laid on the trunk's line as bent and leant
  //   above, the upper back a touch proud of it (RIDE.straight): the same lean, carried on a straight back
  { const S2 = RIDE.straight, hp = B.Hips.getWorldPosition(new THREE.Vector3()), tl = B.Neck.getWorldPosition(new THREE.Vector3()).sub(hp).normalize(), cd = new THREE.Vector3(), td = new THREE.Vector3();
    for(const [b, c, k] of [[B.Spine, B.Spine1, 0], [B.Spine1, B.Spine2, 0], [B.Spine2, B.Neck, S2.chest]]){ if(!b || !c) continue; c.getWorldPosition(cd).sub(b.getWorldPosition(td)).normalize();
      td.copy(tl).applyAxisAngle(RIGHT, k); aim(b, c, cd.lerp(td, S2.k).normalize()); } }
  // Z361 TALKING TO THE MAN BEHIND HIM: as he says a line (talk) his head turns back over a shoulder (less, and for less long, the faster he goes),
  //   the chest a little with it; a double nod at the soldier's answer. PANIC under fire: for a while after a hit he snatches looks back over one
  //   shoulder then the other (toward where the shots came from, mostly), eyes on the road between — and now and then shouts what he sees
  const CH = RIDE.chat, PN = RIDE.panic, fastK = clamp(Math.abs(v) / CH.fast, 0, 1), ct = nowS - (D.chatT ?? -99);
  D.chatK += ((ct < CH.hold * (1 - 0.45 * fastK) && cover < 0.2 && CV.mounted && D.state === 'ride' ? 1 : 0) - D.chatK) * Math.min(1, dt * CH.rate);
  const lastHit = D.hits && D.hits.length ? D.hits[D.hits.length - 1] : -99, panic = D.state === 'ride' && nowS - lastHit < PN.t;
  if(!panic) D.bkOn = false; else if(nowS > D.bkN){ D.bkOn = !D.bkOn; if(D.bkOn){ D.bkS = D.threat && Math.random() < PN.toThreat ? -D.threat : -(D.bkS || 1); if(Math.random() < PN.say) talk(D, 'behind'); }
    D.bkN = nowS + (D.bkOn ? PN.back[0] + Math.random() * PN.back[1] : PN.ahead[0] + Math.random() * PN.ahead[1]); }
  D.bk += ((D.bkOn ? 1 : 0) - D.bk) * Math.min(1, dt * PN.snap); const bkW = D.bk * (cover > 0.3 ? D.pk : 1);   // (ducked low he only looks back as he bobs up)
  const backY = bkW * D.bkS * PN.yaw + D.chatK * D.chatS * (CH.yaw + (CH.fastYaw - CH.yaw) * fastK) * (1 - D.bk), twist = bkW * D.bkS * PN.twist + D.chatK * D.chatS * CH.twist * (1 - D.bk);
  if(Math.abs(twist) > 1e-4){ turn(B.Spine1, UP, twist * 0.45); turn(B.Spine2, UP, twist * 0.55); }
  // the head: into the bend, held level against the bank; tucked down and to one side when ducking
  // Z299 and now and then a glance — a mirror, a side street, back at his passenger when slow — unless he is ducking under fire
  // Z304 in a fight (shot at in the last few seconds, or the soldier firing) he is all nerves: quicker, shorter, more frequent looks round
  const now = nowS, alert = S.firing || (D.hits && D.hits.length && now - D.hits[D.hits.length - 1] < RIDE.alert.t), Gl = alert ? RIDE.alert.glance : Z.glance;
  if(now > D.glN || (alert && D.glN - now > Gl[0] + Gl[1])){ D.glN = now + Gl[0] + Math.random() * Gl[1]; D.glE = now + Gl[2] + Math.random() * Gl[3]; D.glA = (Math.random() < 0.5 ? -1 : 1) * (Math.abs(v) < 3 ? 1.1 : alert ? 0.45 + Math.random() * 0.45 : 0.55 + Math.random() * 0.3); }
  if(D.peek && now > D.sacN){ D.sacN = now + RIDE.alert.sac[0] + Math.random() * RIDE.alert.sac[1]; D.sacA = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4); }   // peeking: the eyes dart
  // Z361 FIRED UP: now and then (more often in a fight) his left hand comes off the bar and jabs ahead at the enemy — or punches the air — and
  //   he roars the soldier on (RIDE_TALK.charge): eyes front, chin up, the throttle kept open in his right; not ducking, panicking or in a hard turn
  const CG = RIDE.charge; if(D.chgN == null) D.chgN = now + CG.first;
  if(D.state === 'ride' && CV.mounted && now > D.chgN){ const E = alert ? CG.fight : CG.every; D.chgN = now + E[0] + Math.random() * E[1];
    if(cover < 0.2 && !panic && Math.abs(yr) < CG.yr && D.wheelT <= 0 && Math.abs(v) > CG.v){ D.chgT = now; D.chgFist = Math.random() < CG.fist; talk(D, 'charge', true); D.chatT = -99; } }
  D.chg = (D.chg || 0) + ((D.state === 'ride' && now - (D.chgT ?? -99) < CG.dur && cover < 0.3 ? 1 : 0) - (D.chg || 0)) * Math.min(1, dt * CG.rate);
  const glance = (D.peek ? D.sacA : (now < D.glE && cover < 0.2 ? D.glA : 0)) * (1 - D.bk) * (1 - D.chatK) * (1 - D.chg);
  D.look += (clamp(yr * 0.35 + glance, -1.2, 1.2) - D.look) * Math.min(1, dt * (D.peek || alert ? RIDE.alert.snap : 5)); D.tilt += ((D.duck > 0.3 ? (D.side || 1) * 0.35 : 0) - D.tilt) * Math.min(1, dt * 4);
  turn(B.Neck, UP, D.look * 0.6 + backY * 0.55); turn(B.Head, UP, D.look * 0.4 + backY * 0.45); turn(B.Head, FWD, -(H.B.rotation.z + (I ? I.r : 0)) * RIDE.lean.head + D.tilt); turn(B.Neck, RIGHT, bend * 0.5 - D.duck * 0.45 * hid - D.ih); turn(B.Head, RIGHT, I ? -I.p * 0.7 : 0);   // eyes held level (chin back up as the back bends; down when ducking)
  if(D.storm > 0.01){ turn(B.Neck, RIGHT, -D.storm * DG.face * (1 - D.pk)); turn(B.Head, UP, (D.threat || D.side || 1) * D.storm * DG.away * (1 - D.pk)); }   // face down, turned from the guns
  { const hn = nowS - (D.heardT ?? -99), spk = D.chatK * clamp(1 - ct / CH.speak, 0, 1), nod = hn < CH.nodT && D.state === 'ride' ? -CH.nod * Math.sin(hn / CH.nodT * Math.PI * 4) * (1 - hn / CH.nodT) : 0;   // Z361 the words nodded out; a double nod at the answer
    if(nod || spk > 0.01) turn(B.Head, RIGHT, nod + spk * Math.sin(ct * 11) * CH.bob); if(D.chg > 0.01) turn(B.Neck, RIGHT, CG.chin * D.chg); }
  // hands to the grips (the right one twists the throttle), elbows out and down
  for(const sd of [['Left', 0], ['Right', 1]]){ const [L, i] = sd; onRide(H, R.grip[i], _a, true);   // (the grips turn with the bars)
    B[L + 'Arm'].getWorldPosition(_b); _b.addScaledVector(RIGHT, (i ? 1 : -1) * 0.5 * (1 - 0.6 * D.storm)).addScaledVector(UP, -0.35).addScaledVector(FWD, -0.15);   // (tucked in under fire)
    const gp = _a.clone(), wrist = gp.clone().addScaledVector(UP, 0.035).addScaledVector(FWD, -0.065);   // the bar in the palm: the wrist just behind and above it
    ik2(B[L + 'Arm'], B[L + 'ForeArm'], B[L + 'Hand'], wrist, _b.clone()); rollHand(B, L, _c.copy(RIGHT).multiplyScalar(i ? 1 : -1).applyAxisAngle(UP, (i ? -1 : 1) * (R.sweep || 0))); curlHand(B, L, RIDE.grip, gp.addScaledVector(UP, -0.03)); }   // (Z304 knuckles out along the bar)   // fingers closed round the grip
  if(B.RightHand && B.RightForeArm){ B.RightForeArm.getWorldPosition(_a); B.RightHand.getWorldPosition(_b); turn(B.RightHand, _c.subVectors(_b, _a).normalize(), -D.thr * 0.7); }
  if(D.chg > 0.01 && B.LeftHandMiddle1) chargeArm(H, D, ease(D.chg), now - (D.chgT ?? now));   // Z361 the left hand off the bar: jabbing ahead, or a fist in the air
  // feet: on the pegs / floorboard; stopped, the left foot goes down to the road; the gear flick lifts the left toe
  // Z300 THE FEET ON THE ROAD: slowing to a stop both feet come off the pegs / pedals and are planted on the actual ground either side (its real height under
  //   each foot, the sole flat); hard through a bend at speed the inside foot goes out ahead and skims the road like a racer's, kicking up dust
  const FT = RIDE.feet, body = H.body || H.B, ws = body.getWorldScale(_g).y, lat = I ? I.lat : 0, inner = yr > 0 ? 0 : 1;
  const dab = H.two !== false && Math.abs(v) > FT.dabV && Math.abs(lat) > FT.dabLat && D.state === 'ride';
  for(const [L, i] of [['Left', 0], ['Right', 1]]){ const sd = i ? -1 : 1;   // (+x is his left)
    D.fd[i] += ((Math.abs(v) < FT.stopV && (D.state === 'ride' || D.state === 'stall') ? 1 : 0) - D.fd[i]) * Math.min(1, dt * FT.rate * (i ? 0.8 : 1.15));   // (the left foot first, the right a beat later)
    D.fdab[i] += ((dab && i === inner ? 1 : 0) - D.fdab[i]) * Math.min(1, dt * FT.rate * 1.4);
    _a.fromArray(R.peg[i]);
    if(i === 0 && D.gearT > 0) _a.y += Math.sin(D.gearT / 0.28 * Math.PI) * 0.035;
    body.localToWorld(_a); const down = Math.max(D.fd[i], D.fdab[i]);
    if(down > 1e-3){ // where that foot meets the road: out to the side (and ahead, for the dab), at the ground's real height under it
      const dk = D.fdab[i] > D.fd[i] ? 1 : 0; _c.set(sd * (Math.abs(R.peg[i][0]) + (dk ? FT.dabOut : FT.out)), 0, dk ? R.peg[i][2] + FT.dabFwd : R.hip[2] + FT.hipFwd); body.localToWorld(_c);   // (Z362 stopped, the foot down nearly under the hip — the leg straight, the knee just soft; not stuck out ahead)
      _c.y = heightAt(_c.x, _c.z) + D.ankle * ws + (dk ? FT.hover : 0); _a.lerp(_c, ease(down));
      if(dk && D.fdab[i] > 0.6 && Math.random() < dt * Math.abs(v) * FT.dust) spawnPart(_c.x, _c.y - D.ankle * ws + 0.05, _c.z, (Math.random() - 0.5) * 1.2, 0.6 + Math.random(), (Math.random() - 0.5) * 1.2, { color:new THREE.Color(FT.dustC).multiplyScalar(1 - 0.7 * (NIGHT.k || 0)).getHex(), size:0.5, life:0.7, grav:-1, drag:2.4, smoke:true, op:0.5 }); }
    if(i === 1 && D.state === 'stall' && D.kickW > 0 && D.kickFoot) _a.lerp(D.kickFoot, ease(D.kickW));   // Z361 on the kick-start lever
    B[L + 'UpLeg'].getWorldPosition(_b); _b.addScaledVector(FWD, 1).addScaledVector(RIGHT, sd * -0.35 * (1 + down)).addScaledVector(UP, 0.3);
    ik2(B[L + 'UpLeg'], B[L + 'Leg'], B[L + 'Foot'], _a.clone(), _b.clone());
    if(down > 0.05) flatFoot(B[L + 'Foot'], B[L + 'ToeBase'], D.toeSlope, down); } }
// Z361 his left arm from the grip to the charge: thrust ahead and a little up, index out, jabbing — or the fist punched up, pumping
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
function chargeArm(H, D, k, t){ const B = D.B, R = D.R, CG = RIDE.charge;
  if(!D.armL){ B.LeftArm.getWorldPosition(_k1); B.LeftForeArm.getWorldPosition(_k2); B.LeftHand.getWorldPosition(_k3); D.armL = _k1.distanceTo(_k2) + _k2.distanceTo(_k3); } const L = D.armL;
  onRide(H, R.grip[0], _k1, true); _k1.addScaledVector(UP, 0.035).addScaledVector(FWD, -0.065);   // where the wrist was, on the bar
  B.LeftArm.getWorldPosition(_k2); _k4.copy(FWD).multiplyScalar(Math.cos(CG.up)).addScaledVector(UP, Math.sin(CG.up)).addScaledVector(RIGHT, 0.08).normalize();
  if(D.chgFist) _k3.copy(_k2).addScaledVector(UP, L * 0.8 + Math.abs(Math.sin(t * CG.pump * 0.5)) * 0.08).addScaledVector(FWD, 0.12).addScaledVector(RIGHT, 0.06);
  else _k3.copy(_k2).addScaledVector(_k4, L * (0.86 + Math.max(0, Math.sin(t * CG.pump)) * 0.08));
  _k1.lerp(_k3, k); _k3.copy(_k2).addScaledVector(RIGHT, -0.4).addScaledVector(UP, -0.35).addScaledVector(FWD, -0.1); ik2(B.LeftArm, B.LeftForeArm, B.LeftHand, _k1.clone(), _k3.clone());
  for(const F of FINGERS) for(let s = 1; s <= 3; s++){ const b = B['LeftHand' + F + s], q = b && D.rest.get(b); if(q) b.quaternion.copy(q); } B.LeftHand.updateMatrixWorld(true);   // (the grip's curl undone)
  if(k < 0.5){ curlHand(B, 'Left', RIDE.grip * (1 - k * 2), _k1.clone().addScaledVector(UP, -0.03)); return; }
  if(D.chgFist){ rollHand(B, 'Left', _k4.copy(FWD)); curlHand(B, 'Left', 1, _k1.clone().addScaledVector(FWD, 0.06)); }
  else { aim(B.LeftHand, B.LeftHandMiddle1, _k4.clone()); rollHand(B, 'Left', _k3.copy(UP).negate()); curlHand(B, 'Left', 0.95, _k1.clone().addScaledVector(RIGHT, 0.1), 0, 0); } }
// the sole flat on the road: the ankle → toe line turned level (with the foot's own rest slope), as much as the foot is down
function flatFoot(f, t, slope, w){ if(!f || !t) return; f.getWorldPosition(_d); t.getWorldPosition(_e); _e.sub(_d); const L = _e.length(); if(L < 1e-5) return; _e.divideScalar(L);
  _f.set(_e.x, 0, _e.z); if(_f.lengthSq() < 1e-6) return; _f.normalize().multiplyScalar(Math.cos(slope)); _f.y = Math.sin(slope);
  const ang = Math.acos(clamp(_e.dot(_f), -1, 1)) * w; if(ang < 1e-4) return; _g.crossVectors(_e, _f).normalize(); turn(f, _g, ang); }

// ---- Z303 the repair: off the seat into a squat on the ride's left side, facing it; one hand braced on the frame, the other hammering at the engine
//   head down over it; then up and back onto the seat, the engine fires (rideFixed) and he waits for the soldier ----
const _fk = new THREE.Vector3(), _rk = new THREE.Vector3(), _h1 = new THREE.Vector3(), _h2 = new THREE.Vector3(), _h3 = new THREE.Vector3(), _h4 = new THREE.Vector3(), _hq = new THREE.Quaternion(), _hm = new THREE.Matrix4();
function fixStep(H, D, dt){ const F = RIDE.fix, T = D.fixT || XEOM.wear.fixT; D.t2 += dt; const back = D.t2 > T;   // (Z361 quicker after the rant: D.fixT)
  D.fixK = clamp((D.fixK || 0) + (back ? -1 : 1) * dt * F.ease, 0, 1);
  fixPose(H, D, dt, ease(D.fixK)); blendPose(D, dt); if(D.fixSay && D.t2 > D.fixSay){ D.fixSay = 0; driverLine(D, 'fixing'); }   // (Z361 eased down from the row; the spark-plug mutter)
  if(back && D.fixK <= 0){ D.state = 'ride'; D.t2 = 0; D.fixT = 0; rideFixed(H); talk(D, 'remount', true); if(D.onBack) D.onBack(); } }
function fixPose(H, D, dt, k){ const B = D.B, R = D.R, F = RIDE.fix, P = F[D.kind], body = H.body || H.B; if(!P) return;
  for(const [b, q] of D.rest) b.quaternion.copy(q); D.mix.stopAllAction();
  H.B.updateMatrixWorld(true); D.w.updateMatrixWorld(true); body.getWorldQuaternion(_qw); const ws = body.getWorldScale(_h4).y;
  UP.set(0, 1, 0).applyQuaternion(_qw); FWD.set(0, 0, 1).applyQuaternion(_qw); RIGHT.set(-1, 0, 0).applyQuaternion(_qw);
  _fk.copy(FWD).lerp(RIGHT, k).normalize(); _rk.crossVectors(_fk, UP).normalize();   // he turns from facing ahead to facing the ride from its left side
  // hips: from the saddle down to a squat, at the ground's real height under him
  const hips = B.Hips; onRide(H, R.hip, _h1); onRide(H, P.hip, _h2); _h2.y = heightAt(_h2.x, _h2.z) + F.hipH; _h1.lerp(_h2, k);
  hips.parent.worldToLocal(_h1); hips.position.copy(_h1); hips.updateMatrixWorld(true);
  hips.getWorldPosition(_a); B.Spine.getWorldPosition(_b); B.RightUpLeg.getWorldPosition(_c); B.LeftUpLeg.getWorldPosition(_d);
  _e.subVectors(_b, _a).normalize(); _f.subVectors(_c, _d).normalize(); _g.crossVectors(_f, _e).normalize();
  _hm.makeBasis(_f, _e, _g); _q.setFromRotationMatrix(_hm); _hm.makeBasis(_rk, UP, _h3.copy(_fk).negate()); _hq.setFromRotationMatrix(_hm); _hq.multiply(_q.invert());
  hips.getWorldQuaternion(_qw); _qw.premultiply(_hq); hips.parent.getWorldQuaternion(_qp); hips.quaternion.copy(_qp.invert().multiply(_qw)); hips.updateMatrixWorld(true);
  // bent over the engine, looking down at it
  const bend = R.bend + (F.bend - R.bend) * k; for(const n of ['Spine', 'Spine1', 'Spine2']) turn(B[n], _rk, -bend / 3);
  turn(B.Neck, _rk, bend * 0.5 - F.look * k);
  // hands: the grips → one braced on the frame, the other at work (the hammer lifts and falls; a tap and a spark on each blow)
  const ph = D.t * F.rate, lift = k > 0.9 ? Math.pow(Math.abs(Math.sin(ph)), 0.6) * F.hammer : 0, blow = Math.floor(ph / Math.PI);
  for(const [L, i, pt] of [['Left', 0, P.brace], ['Right', 1, P.tool]]){ onRide(H, R.grip[i], _h1, true); onRide(H, pt, _h2); if(i) _h2.addScaledVector(UP, lift * ws); _h1.lerp(_h2, k);
    B[L + 'Arm'].getWorldPosition(_b); _b.addScaledVector(_rk, (i ? 1 : -1) * 0.5).addScaledVector(UP, -0.35).addScaledVector(_fk, -0.15);
    ik2(B[L + 'Arm'], B[L + 'ForeArm'], B[L + 'Hand'], _h1.clone(), _b.clone()); curlHand(B, L, RIDE.grip, _h1.clone().addScaledVector(UP, -0.03)); }
  if(k > 0.9 && blow !== D.blow){ D.blow = blow; onRide(H, P.tool, _h2); sfx('click'); for(let n = 0; n < 3; n++) spawnPart(_h2.x, _h2.y, _h2.z, (Math.random() - 0.5) * 2, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 2, { color:0xffc860, size:0.12, life:0.35, grav:-9, drag:1 }); }
  // feet: off the pegs onto the ground either side of the squat, soles flat
  for(const [L, i] of [['Left', 0], ['Right', 1]]){ const sd = i ? -1 : 1;
    _h1.fromArray(R.peg[i]); body.localToWorld(_h1);
    onRide(H, P.foot[i], _h2); _h2.y = heightAt(_h2.x, _h2.z) + D.ankle * ws; _h1.lerp(_h2, k);
    B[L + 'UpLeg'].getWorldPosition(_b); _b.addScaledVector(_fk, 1).addScaledVector(_rk, sd * -0.3).addScaledVector(UP, 0.5);
    ik2(B[L + 'UpLeg'], B[L + 'Leg'], B[L + 'Foot'], _h1.clone(), _b.clone()); if(k > 0.3) flatFoot(B[L + 'Foot'], B[L + 'ToeBase'], D.toeSlope, k); } }

// ---- the crash: thrown and sliding · down · (Z331 actors/driver-acts.js) onto all fours, the crawl back to it, the heave ----
function crashStep(H, D, dt){ const C = RIDE.crash, w = D.w; D.t2 = (D.t2 || 0) + dt; const st = D.state;
  downedRide(D, dt);   // the ride: on its side, sliding to a stop, sparks and dust while it slides
  D.mix.update(dt);
  // he goes over backwards (tipped about his feet), lands flat on his back, lies a moment twitching, then scrambles onto hands and knees
  const lie = () => { w.rotation.x = -D.tip; w.position.y = heightAt(w.position.x, w.position.z) + Math.sin(D.tip) * 0.14; };
  if(st === 'fall'){ D.vel.y -= 9.8 * dt; w.position.addScaledVector(D.vel, dt); D.tip = Math.min(Math.PI / 2, D.tip + dt * 3.2); w.rotation.x = -D.tip;
    const g = heightAt(w.position.x, w.position.z) + Math.sin(D.tip) * 0.14;
    if(w.position.y <= g){ w.position.y = g; D.vel.multiplyScalar(0.3); D.vel.y = 0; if(D.t2 > 0.25){ D.state = 'down'; D.t2 = 0; sfx('thud');
      burst({ x:w.position.x, z:w.position.z }, BIOME.ground, 6, 3, { y:w.position.y + 0.2, life:0.6, size:0.9, smoke:true, grav:-0.3, drag:2, op:0.45 }); } } }
  else { D.tip += (Math.PI / 2 - D.tip) * Math.min(1, dt * 8); lie(); const fa = D.A.hurt; if(fa) fa.timeScale = 0.5;
    if(D.t2 > C.down){ snapPose(D, C.getup); D.state = 'crawl'; D.t2 = 0; D.tip = 0; D.hd = null; D.mix.stopAllAction(); talk(D, 'getup', true); } } }
export function driverReady(H){ const D = H && H.drv; return !D || !D.ok || D.state === 'ride'; }
