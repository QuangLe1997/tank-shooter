// actors/real-cav.js — Z248 THE REAL CAVALRY: the Meshy-generated war horse, operator and carbine dressed over the procedural horse and general. The procedural rigs keep running unseen (gait engine, hoof falls, positions, aim, recoil) and drive the real ones: the horse plays its library gaits (idle / walk / canter / sprint) blended by gait and paced by speed; the rider sits on the real horse's back bone and plays the riding clips (Text-to-Motion) or, on foot, rifle walk / run / charge / crouch-walk and frozen aim / kneel / prone frames, his torso twisting toward the aim; the carbine is laid between his hands every frame (grip in the right palm, barrel through the left hand) and carries the muzzle point. Nothing changes until every file has loaded; if one fails the procedural models stay.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { ANIMGRAPH, BODYFIX, BODYMEND, GUNFIT, GUNHOLD, HUMAN_SCALE, INFGUN, PUPPET, REALCAV, RIDEFEEL, XEOM, AIRAIM, AIRPOSE, RIDER_TURN, XHAIR, GUNFEEL } from '../../config.js';
import { bladeClip, bladeHold, bladePre, ANIMGRAPH_STAT, graphFeet, graphHipYaw, graphOwned, graphPose, XH, FIT, GUNKICK, GUNS, LEGKIT, PROFILE, S, curlHand, stirrupFeet, fitHold, sideProfile, underAt, drivePuppet, handRoll, limbTwist, trunkLean, heightAt, ik2, loadGLTF, asShipped, nearShape, makePuppet, rollHand, sfx, spawnPart, turnBone, airPitch, soldierLegs, soldierUpper, steadyHead, mountHand, seatUpright, climbArms, climbW, carryClear, eyePoint, reachFeel, triggerFinger, wristGive, gunEase, handsEase, reloadHands, reloadProps, reloadState, headLevel, gunRecoil, burstClimb, shotCycle, shotSeen } from '../hub.js';
import { swimClip, swimPose } from '../hub.js';   // SWIM 1 (game/swim.js)
import { horseSwimClip, horseSwimMix, horseSwimPose } from '../hub.js';   // HSWIM 1 (game/horse-swim.js)
import { trunkUp } from '../hub.js';   // GRAPH 6 (actors/soldier-upper.js)

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qd = new THREE.Quaternion(), _m = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _s = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const under = (o, p) => { for(let q = o; q; q = q.parent) if(q === p) return true; return false; };
// clips that walk the root forward (Meshy's Z-up armature: local Y is the way it faces) are pinned in place — the game moves the body
function inPlace(clip, track){ const t = clip.tracks.find(k => k.name === track); if(!t || clip.userData_inPlace) return clip; const v = t.values, n = v.length / 3;
  if(Math.abs(v[3 * n - 2] - v[1]) > 0.3) for(let i = 0; i < n; i++) v[3 * i + 1] = v[1];
  clip.userData_inPlace = true; return clip; }
// a set of looping actions blended by weight: the wanted one fades in, the rest fade out; `freeze` holds a clip on one frame (a pose)
function actions(mixer, clips, rename){ const A = {}; for(const c of clips){ const a = mixer.clipAction(c); a.enabled = true; a.setEffectiveWeight(0); a.play(); A[rename ? rename(c.name) : c.name] = a; } return A; }
function blend(A, want, ts, dt, freeze){ const k = Math.min(1, dt / REALCAV.fade);
  for(const [name, a] of Object.entries(A)){ const on = name === want, w = a.getEffectiveWeight() + ((on ? 1 : 0) - a.getEffectiveWeight()) * (on ? Math.max(k, 0.0001) : k);
    a.setEffectiveWeight(w < 0.002 && !on ? 0 : w);
    if(on){ if(freeze != null){ a.timeScale = 0; a.time = freeze; } else a.timeScale = ts; } } }

// a one-frame pose clip assembled from parts of other clips: [[clip, time, which tracks]…]
export function poseClip(name, parts){ const tracks = [];
  for(const [clip, t, keep] of parts){ if(!clip) continue; for(const k of clip.tracks){ if(!keep(k)) continue; const I = k.createInterpolant(), v = Array.from(I.evaluate(t));
    tracks.push(new k.constructor(k.name, [0], v)); } }
  return new THREE.AnimationClip(name, 0.1, tracks); }
// Z295 THE INFANTRY ARSENAL: nine Tripo hand weapons (assault rifle, belt-fed LMG, hand-held minigun, pump shotgun, .50 anti-materiel rifle, RPG, revolver grenade
//   launcher, flamethrower, energy rifle), each set into the carbine's frame — turned muzzle to −X, scaled to its true length, slid so its pistol grip lands where the
//   carbine's does — so every pose that holds the carbine holds them; the game's muzzle point moves to each one's muzzle
function armInfantry(arms, cb, C){ const K = C.carbine.len / 0.954;
  for(const [k, g] of Object.entries(INFGUN.guns)) loadGLTF('inf_' + k).then(gl => { if(!gl) return; const m = gl.scene.clone(true), b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3()), L = b.max.z - b.min.z || 1;
    // Z297 the same weapon at its true size in metres (muzzle −X, centred): the special-forces soldier holds this one, aimed, with his hands on it
    const m2 = gl.scene.clone(true); for(const x of [m, m2]) x.traverse(o => { if(o.isMesh) nearShape(o, 'inf_' + k, asShipped('inf_' + k)); });   // (Z395 the gun in his hands drawn whole)
    m2.position.sub(c); const t2 = new THREE.Group(); t2.add(m2); t2.rotation.y = g.muzzle > 0 ? -Math.PI / 2 : Math.PI / 2; const met = new THREE.Group(); met.add(t2); met.scale.setScalar(g.len / L);
    const hold = new THREE.Group(); hold.add(met); hold.visible = false;
    // Z360 its own shape measured: the hold it is held by (fit:true weapons — actors/gun-fit.js), its bore (every weapon: the rounds and the flash leave the real muzzle)
    const kid = Object.keys(GUNS).find(id => GUNS[id].trooper && INFGUN.map[id] === k), fit = fitHold(sideProfile(hold, g.len), g.len, { gun:kid ? GUNS[kid] : null, bore:g.bore, gripAt:g.gripAt }); GUNKICK[k] = gunRecoil(kid ? GUNS[kid] : null, g.len);   // (Z390 per-gun overrides · GUN 3 GUNKICK filled again: the line had been swallowed by this comment — the B41 had no shake, the studio no kick to report)
    if(fit && g.fit){ const h = GUNHOLD[k] || {}; FIT[k] = Object.assign(fit, h.hold ? { hold:h.hold, butt:[+(fit.grip[0] + h.butt[0] - h.grip[0]).toFixed(3), h.butt[1]] } : {}, h.load ? { load:h.load } : {}); } const bore = fit ? fit.bore : 0.02, gx = g.fit && fit ? fit.grip[0] : g.grip;
    hold.userData = { k, len:g.len, muzzle:[-g.len / 2, bore, 0], fit }; m2.traverse(o => { if(o.isMesh){ o.castShadow = true; o.frustumCulled = false; } });
    if(arms._G) arms._G.add(hold); (arms._metric || (arms._metric = {}))[k] = hold;
    // the same weapon set into the carbine's frame (the steel operator's hold): turned muzzle to −X, scaled to its true length, its pistol grip where the carbine's is
    m.position.sub(c); const turn = new THREE.Group(); turn.add(m); turn.rotation.y = t2.rotation.y;
    const wl = g.len / K, s = wl / L, w = new THREE.Group(); w.add(turn); w.scale.setScalar(s); w.position.set(C.carbine.grip[0] - gx * wl, C.carbine.grip[1] + 0.05 + (g.lift || 0) / K, 0); w.visible = false;
    m.traverse(o => { if(o.isMesh){ o.castShadow = true; o.frustumCulled = false; } }); cb.add(w); arms[k] = w; w.userData.muzzle = [w.position.x - wl / 2, w.position.y + bore / K, 0]; }); }
function holdGun(R, G){ const p = S.player, id = p && p.guns && p.guns.length ? p.guns[p.gunIdx].id : 'carbine', want = R.arms[INFGUN.map[id]] ? INFGUN.map[id] : '_carbine';
  const met = R.pup && R.arms._metric && R.arms._metric[want], mode = met ? 'met' : 'cb';
  if(want === R.armK && mode === R.armMode) return; R.armK = want; R.armMode = mode; const u = G.userData;
  for(const [k, o] of Object.entries(R.arms)) if(o && o.isObject3D && k[0] !== '_' || k === '_carbine') o.visible = mode === 'cb' && k === want;
  for(const [k, o] of Object.entries(R.arms._metric || {})) o.visible = mode === 'met' && k === want;
  if(!u.muzzle) return; if(mode === 'met'){ met.add(u.muzzle); u.muzzle.position.fromArray(met.userData.muzzle); }
  else { R.cb.add(u.muzzle); u.muzzle.position.fromArray(want === '_carbine' ? REALCAV.carbine.muzzle : R.arms[want].userData.muzzle); } }
import { carryAfter, carryGun } from '../hub.js';   // CARRY 1 (actors/gun-carry.js)
import { BODYFULL } from '../../config.js';   // BODY 10 the cheek on the stock in the saddle, the B41's loading hand
import { FEELFX } from '../../config.js';   // FEEL 1 (his kick) · FEEL 3 (the clip follows the speed he really makes)
// Z297 THE SOLDIER'S HOLD: the gun first — its butt in his shoulder pocket (on top of the shoulder for the RPG, at the hip for the minigun and flamethrower),
//   its bore along where he aims (up / down to the target too) — then his hands onto it by IK: the right on the pistol grip, trigger finger along the guard,
//   the left under the handguard; fingers closed round both. Every shot kicks it STRAIGHT BACK along the bore with a little muzzle climb, a spring
//   brings it home, and his shoulders take the push.
const _gp = new THREE.Vector3(), _gq = new THREE.Quaternion(), _gx = new THREE.Vector3(), _gy = new THREE.Vector3(), _gz = new THREE.Vector3(), _gr = new THREE.Vector3(), _gu = new THREE.Vector3(), _gf = new THREE.Vector3(), _gt = new THREE.Vector3(), _gm = new THREE.Matrix4(), _gw = new THREE.Vector3();
function gunPoint(out, pts, len, o, q){ return out.set(pts[0] * len, pts[1], 0).applyQuaternion(q).add(o); }
// Z345 where the support palm goes on this weapon: at its `palm` share of the length, just under the handguard's real underside — found once from
//   the model's own surface (rays cast up at the gun from below, round that spot in the bore's plane; the middle of what they meet), so the palm
//   meets the gun, not the air under it
const _ray = new THREE.Raycaster();
function palmSpot(met, g, len){ const U = met.userData; if(U.palm && U.palmFor === g) return U.palm; met.updateWorldMatrix(true, true);
  const M = met.matrixWorld, inv = new THREE.Matrix4().copy(M).invert(), up = new THREE.Vector3(0, 1, 0).transformDirection(M), o = new THREE.Vector3(), ys = [];
  for(const dx of GUNHOLD.palmRays[0]) for(const dz of GUNHOLD.palmRays[1]){ _ray.set(o.set(g.palm * len + dx, -0.6, dz).applyMatrix4(M), up); _ray.far = 1.2; const h = _ray.intersectObject(met, true)[0]; if(h) ys.push(h.point.applyMatrix4(inv).y); }
  ys.sort((a, b) => a - b); U.palmFor = g; return (U.palm = ys.length ? [g.palm, ys[ys.length >> 1] - GUNHOLD.palmGap] : null); }
// Z356 the sight line's height in the hold's frame: the top of the gun at its `sightX` share (behind the middle: the optic / rear sight), found once by a
//   ray cast down at the model, less GUNHOLD.cheek.under (the eye looks through the optic, a little under its top)
function sightLine(met, g, len){ const U = met.userData; if(U.sight != null && U.sightFor === g) return U.sight; met.updateWorldMatrix(true, true);
  const M = met.matrixWorld, inv = new THREE.Matrix4().copy(M).invert(), dn = new THREE.Vector3(0, -1, 0).transformDirection(M), o = new THREE.Vector3(), ys = [];
  for(const dx of [-0.015, 0, 0.015]){ _ray.set(o.set((g.sightX ?? GUNHOLD.cheek.sightX) * len + dx * len, 0.6, 0).applyMatrix4(M), dn); _ray.far = 1.2; const h = _ray.intersectObject(met, true)[0]; if(h) ys.push(h.point.applyMatrix4(inv).y); }
  ys.sort((a, b) => a - b); U.sightFor = g; return (U.sight = ys.length ? ys[ys.length - 1] - GUNHOLD.cheek.under : 0.08); }
const palmOf = (D, s, out) => { D[s + 'Hand'].getWorldPosition(out); const m = D[s + 'HandMiddle1']; if(m) out.lerp(m.getWorldPosition(_pk), 0.55); return out; }, _pk = new THREE.Vector3(), _pd = new THREE.Vector3(), _pa = new THREE.Vector3();
// Z360 A FITTED WEAPON (actors/gun-fit.js): the support palm at the gun's own spot for it; when this soldier's left arm (his own length, this stance, this
//   aim) cannot reach that far, slid back along the handguard just as far as it needs (never past g.slideTo: the magazine's front), instead of the gun being
//   dragged back through his shoulder to the hand; its height is the handguard's underside there, off the gun's measured profile
const _pc = new THREE.Vector3();
function palmFit(R, g, len, D, wl, fore, dt, rK){ const H = GUNHOLD, r = armLen(D, 'Left') * rK; D.LeftArm.getWorldPosition(_pa);
  gunPoint(_pc, [g.palm, underAt(g, g.palm) - H.palmGap], len, _gp, _gq).addScaledVector(_gz, H.wrap[0]).addScaledVector(_gy, H.wrap[1]).sub(fore).add(wl).sub(_pa);
  const b = _pc.dot(_gx), c = _pc.lengthSq() - r * r, disc = b * b - c; let s = c <= 0 ? 0 : disc >= 0 ? -b - Math.sqrt(disc) : -b;
  s = clamp(s, 0, Math.max(0, (g.slideTo - g.palm) * len)); if(R.pslideK !== R.armK){ R.pslideK = R.armK; R.pslide = s; } R.pslide += (s - R.pslide) * Math.min(1, dt * 10);
  const x = g.palm + R.pslide / len; return [x, underAt(g, x) - H.palmGap]; }
// Z360 AT A SPRINT THE GUN IS CARRIED ACROSS HIS CHEST (port arms; GUNFIT.carry): its grip by his chest, the muzzle across to his left and up (a long gun
//   lies flatter), canted; blended in (R.spr) as he breaks into a sprint, out as he slows or fires. Turns _gq / _gp and the gun's axes toward that
const _cq = new THREE.Quaternion(), _cx = new THREE.Vector3(), _cy = new THREE.Vector3(), _cz = new THREE.Vector3(), _cm = new THREE.Matrix4(), _cc = new THREE.Vector3();
function carryPose(R, D, g, len, s = R.spr){ const P = GUNFIT.carry, up = P.up * Math.sqrt(Math.min(1.3, GUNFIT.recoil.ref / len));
  _cx.copy(_gf).multiplyScalar(Math.cos(up) * Math.cos(P.yaw)).addScaledVector(_gr, -Math.cos(up) * Math.sin(P.yaw)).addScaledVector(_gu, Math.sin(up)).negate();
  _cy.copy(_gu).addScaledVector(_cx, -_gu.dot(_cx)).normalize().applyAxisAngle(_cx, P.roll); _cz.crossVectors(_cx, _cy); _cq.setFromRotationMatrix(_cm.makeBasis(_cx, _cy, _cz));
  (D.Spine1 || D.Spine2).getWorldPosition(_cc); _cc.addScaledVector(_gr, P.at[0]).addScaledVector(_gu, P.at[1]).addScaledVector(_gf, P.at[2]).sub(gunPoint(_pc, g.grip, len, _gw.set(0, 0, 0), _cq));
  if(g.fore){ const aL = armLen(D, 'Left'), aR = armLen(D, 'Right'); carryClear(D, _cc, _cq, g.palm != null ? [g.palm, g.fore[1]] : g.fore, g.grip, len, aL, aR, _gf); }   // GUN 1 not folded onto his left shoulder (actors/gun-hands.js)
  _gq.slerp(_cq, s); _gp.lerp(_cc, s); _gx.set(1, 0, 0).applyQuaternion(_gq); _gy.set(0, 1, 0).applyQuaternion(_gq); _gz.set(0, 0, 1).applyQuaternion(_gq); }
// Z411 THE B41 LOADED AT ITS MUZZLE (GUNHOLD.rpg.load): off his shoulder for it — the pistol grip down by his right hip, the tube slanted up across his
//   chest, the muzzle out front-left at chest height, so the left hand can reach it with a round from the bag on his front (on the shoulder the muzzle
//   stood ~0.9 m out of the left arm's reach and the round came from behind his back: the arm swung round behind him); blended in with the reload's `low`
function loadPose(D, g, len, low, yaw, prone){ const L = g.load, P = prone && L.prone || L, yw = yaw + P.turn, pt = P.pitch;
  _cx.set(Math.sin(yw) * Math.cos(pt), Math.sin(pt), Math.cos(yw) * Math.cos(pt)).negate(); _cy.set(0, 1, 0).addScaledVector(_cx, -_cx.y).normalize(); _cz.crossVectors(_cx, _cy); _cq.setFromRotationMatrix(_cm.makeBasis(_cx, _cy, _cz));
  D.RightArm.getWorldPosition(_cc).addScaledVector(_gr, P.at[0]).addScaledVector(_gu, P.at[1]).addScaledVector(_gf, P.at[2]); _cc.y = Math.max(_cc.y, heightAt(_cc.x, _cc.z) + L.floor);   // (kneeling or lying: kept off the ground)
  _cc.sub(gunPoint(_pc, g.grip, len, _gw.set(0, 0, 0), _cq));
  _gq.slerp(_cq, low); _gp.lerp(_cc, low); _gx.set(1, 0, 0).applyQuaternion(_gq); _gy.set(0, 1, 0).applyQuaternion(_gq); _gz.set(0, 0, 1).applyQuaternion(_gq); }
const FR = { p:_gp, q:_gq, x:_gx, y:_gy, z:_gz, r:_gr, u:_gu, f:_gf }, _wg = new THREE.Vector3(), _tb = new THREE.Vector3();   // GUN 1 the gun's frame and his own, handed to actors/gun-hands.js
const armLen = (D, s) => D[s + 'Arm'].getWorldPosition(_pk).distanceTo(D[s + 'ForeArm'].getWorldPosition(_pd)) + _pd.distanceTo(D[s + 'Hand'].getWorldPosition(_pa));
const POLE_L = [-0.5, -0.15, 0.15];
// BODY 6 a collar bone raised more than cap rad over the line chest → neck (up) is lowered to it about the axis square to both (before the arms are set on the gun)
const _kU = new THREE.Vector3(), _kC = new THREE.Vector3(), _kA = new THREE.Vector3(), _kB = new THREE.Vector3();
function collarCap(D, sd, cap){ const sh = D[sd + 'Shoulder'], arm = D[sd + 'Arm']; if(!sh || !arm) return; D.Neck.getWorldPosition(_kU); D.Spine2.getWorldPosition(_kA); _kU.sub(_kA).normalize();
  arm.getWorldPosition(_kC); sh.getWorldPosition(_kB); _kC.sub(_kB).normalize(); const e = Math.asin(Math.max(-1, Math.min(1, _kC.dot(_kU)))); if(e <= cap) return;
  _kA.crossVectors(_kC, _kU); if(_kA.lengthSq() < 1e-8) return; turnBone(sh, _kA.normalize(), -(e - cap)); }
function holdReal(R, G, dt, P){ const met = R.arms._metric && R.arms._metric[R.armK]; if(!met || !met.visible) return false; const H = GUNHOLD, g = FIT[R.armK] || H[R.armK] || H.ar, D = R.pup.D, p = S.player, len = met.userData.len;
  // recoil: a shot is a new fireAt; the impulse goes into a damped spring (back along the bore, muzzle up)
  // Z360 every weapon's own recoil (actors/gun-fit.js gunRecoil: its round's push over its weight) and a random twitch aside and round its bore with it
  const rc = R.rc || (R.rc = { z:0, zv:0, a:0, av:0, y:0, yv:0, r:0, rv:0, last:0 }), KK = GUNKICK[R.armK] || g;
  if(p && p.fireAt > rc.last + 1e-4){ if(rc.last){ const j = H.k * 0.12 * (FEELFX.on && p === S.player ? FEELFX.gun.kick : 1), sh = KK.shake;   /* FEEL 1 his own shoulder takes the kick you can see */ rc.zv += KK.kick[0] * j; rc.av += KK.kick[1] * j; if(sh){ rc.yv += (Math.random() * 2 - 1) * sh[0] * j; rc.rv += (Math.random() * 2 - 1) * sh[1] * j; } rc.shot = true; } rc.last = p.fireAt; }
  const c = 2 * Math.sqrt(H.k) * H.damp; for(const [x, v] of [['z', 'zv'], ['a', 'av'], ['y', 'yv'], ['r', 'rv']]){ rc[v] += (-H.k * rc[x] - c * rc[v]) * dt; rc[x] += rc[v] * dt; }
  const foot = !!(p && p.cav && !p.cav.mounted && !p.cav.trans), wrists = foot || !!(BODYMEND.rideWrist && p && p.cav && !p.cav.trans), FH = GUNFEEL.hold, eyeW = foot || !!(BODYFULL.ride && p && p.cav && p.cav.mounted && !p.cav.trans);   // (BODY 10 eyeW: the cheek laid on the stock as on foot, in the saddle too)   // GUN 1 on his feet: the hold held to his own joints (actors/gun-hands.js); mounted it is as it was
  const prone = !!(p && p.cav && !p.cav.mounted && p.cav.stance === 'prone'), reachL = prone ? (foot ? FH.reach.hardProne : H.reachProne ?? H.reach) : H.reach, hip = g.hold === 'hip' && !(foot && prone && FH.hipProne);   // (GUN 1 lying down a hip-fired gun goes to the shoulder: at the hip it stood 20 cm over him, his right arm folded to a quarter)   // (Z326 lying flat he cannot lean back to an aircraft · Z416 lying, the support arm goes out straighter: the elbow is on the ground)
  // the body frame: up, and his facing turned by the aim twist
  G.getWorldQuaternion(_gq); _gu.set(0, 1, 0).applyQuaternion(_gq);
  _gf.set(0, 0, 1).applyQuaternion(_gq); const gy = Math.atan2(_gf.x, _gf.z), ay = p ? p.aimSmoothed : gy, dyw = R.av ?? Math.atan2(Math.sin(ay - gy), Math.cos(ay - gy));   // (Z303 the calmed, unwrapped aim: the gun never flips sides)
  const hy = R.hy || 0, chest = hy + (R.tw || 0); let yaw = R.sat ? gy + chest + clamp(dyw - chest, -RIDER_TURN.lead, RIDER_TURN.lead) : gy + hy + clamp(dyw - hy, -1.15, 1.15); let pitch = 0;   // no further round than his shoulders (and, sat on a ride, his hips) can turn (Z340 in the saddle: where his chest is turned, the arms a little ahead)
  // the shoulders take the kick before the gun is laid in them
  // Z356 SQUARE TO THE TARGET: the standing aim clip stands him bladed some 60° — the rifle then lay across his chest and the support arm reached right
  //   across it. On his feet (not lying, not sat) the chest is turned to face the aim, bladed only `square` (his right shoulder a little back)
  if(!R.sat && !prone && D.LeftArm && D.RightArm){ D.LeftArm.getWorldPosition(_pa); D.RightArm.getWorldPosition(_pd); _pd.sub(_pa).addScaledVector(_gu, -_pd.dot(_gu)); if(_pd.lengthSq() > 1e-6){ _pd.normalize();
    _pk.crossVectors(_gu, _pd); const cy = Math.atan2(_pk.x, _pk.z), sq = H.square + (R.bx || 0), dq = Math.atan2(Math.sin(yaw - sq - cy), Math.cos(yaw - sq - cy)) * (1 - (R.rdy || 0) * 0.5) * trunkUp(D);   // (GRAPH 6 none of it tipped over: rolling, the shoulders' line turned past ±180° and flung the chest round in one frame)
    if(Math.abs(dq) > 1e-3){ turnBone(D.Spine, _gu, dq * 0.3); turnBone(D.Spine1, _gu, dq * 0.35); turnBone(D.Spine2, _gu, dq * 0.35); } } }
  else if((R.bx || 0) > 1e-3){ turnBone(D.Spine1, _gu, -R.bx * 0.5); turnBone(D.Spine2, _gu, -R.bx * 0.5); }   // Z365 sat (his chest turned on his hips) or lying (his body angled to the gun on the ground): the same turn
  if(foot) trunkLean(R, D, yaw, dt, !prone && !(P && P.move && P.move.roll >= 0), !!(p.cav && p.cav.stance === 'crouch'), Math.hypot(p.vel.x, p.vel.z));   // BODY 1 leaning into the gun, in the aim's own frame (actors/soldier-upper.js)
  if(foot && (R.pro || 0) > 1e-3 && D.LeftShoulder) turnBone(D.LeftShoulder, _gu, -R.pro);   // GUN 1 the left shoulder brought forward to a handguard at the end of his reach (after the chest is squared: that reads the shoulders' line)
  if(foot && prone && BODYMEND.collar && D.Neck && D.Spine2){ collarCap(D, 'Left', BODYMEND.collar); collarCap(D, 'Right', BODYMEND.collar); }   // BODY 6 lying down the prone clip shrugs the support shoulder 48° up: a hump
  _gr.set(Math.cos(yaw), 0, -Math.sin(yaw)); for(const n of ['Spine1', 'Spine2']) turnBone(D[n], _gr, -(rc.a + (foot ? (R.clb || 0) * GUNFEEL.shot.climb.body : 0)) * H.body);   // (about his left: the kick rocks him back · GUN 3 and a burst's climb leans him back a little)
  if(foot && rc.z > 1e-4) turnBone(D.Spine2, _gu, -rc.z * GUNFEEL.shot.shoulder);   // GUN 3 his right shoulder driven back by the butt (the gun is laid in it after this: it goes with it)
  // Z326 an aircraft above: he leans back from the waist, up the spine, so the butt stays in his shoulder as the muzzle climbs past its usual tip-up
  { let want = 0; if(D.RightArm){ D.RightArm.getWorldPosition(_gt); const a0 = airPitch(_gt.x, _gt.y, _gt.z); if(a0 != null && !prone) want = clamp((a0 - H.pitch[1]) * AIRPOSE.k, 0, AIRPOSE.max); }
    R.lean = (R.lean || 0) + (want - (R.lean || 0)) * Math.min(1, dt * AIRPOSE.rate); if(R.lean > 1e-3) ['Spine', 'Spine1', 'Spine2'].forEach((n, i) => turnBone(D[n], _gr, -R.lean * AIRPOSE.split[i])); }
  // Z298 reloading: how far through (0…1), only when the reload is long enough to show; the gun comes down and in for it, and back up at the end
  // GUN 2 where he is in the reload's steps (actors/gun-reload.js reloadState): low = the gun off the aim (in over the first step, back over the last), RP = how this family holds it meanwhile
  const inst = p && p.guns && p.guns[p.gunIdx], nowS = performance.now() / 1000, RS = reloadState(R, inst, nowS, prone), rk = RS.rk, low = RS.low, RP = RS.P || GUNFEEL.reload.pose.mag;
  if(rc.shot){ rc.shot = false; if(foot) shotSeen(R, rc, KK, p, nowS); } const climb = foot ? burstClimb(rc, nowS, dt) : 0; R.clb = climb;   // GUN 3 a burst climbs, then he takes it back (actors/gun-feel.js)
  // the pocket the butt sits in
  const sh = D.RightArm, hipB = D.RightUpLeg; if(!sh || !D.RightHand || !D.LeftHand) return false; _gf.set(Math.sin(yaw), 0, Math.cos(yaw)); _gr.set(-Math.cos(yaw), 0, Math.sin(yaw));   // ahead · his right
  if(hip){ hipB.getWorldPosition(_gp); _gp.addScaledVector(_gu, 0.22).addScaledVector(_gf, 0.12).addScaledVector(_gr, 0.05); }
  else { sh.getWorldPosition(_gp); _gp.addScaledVector(_gr, -H.pocket[0]).addScaledVector(_gu, g.hold === 'top' ? 0.1 : H.pocket[1]).addScaledVector(_gf, H.pocket[2]);
    if(eyeW && R.cw && R.weld > 0.01) _gp.addScaledVector(_gu, R.cw.u * R.weld).addScaledVector(_gr, -R.cw.i * R.weld); }   // GUN 1 the gun brought to his eye: the butt a little higher / further in than the pocket while he aims
  const odw = overDriver(R, _gp, yaw);   // Z335 sat behind the driver, a gun laid forward goes over his shoulder, not into his back
  const MV = P && P.move, CR = REALCAV.cv; if(MV && MV.cover != null){ const want = MV.cover + CR.rest; if(_gp.y < want) _gp.y += Math.min(want - _gp.y, CR.restMax); }   // Z336 behind cover: the rifle laid on top of it
  if(R.gunLag) _gp.add(R.gunLag);   // Z343 the rifle's weight: it lags the chest a moment (actors/soldier-upper.js)
  const tuck = MV && MV.roll >= 0;   // Z336 going over in a roll: the rifle held in to the chest, along the body
  // where he aims: the pointer's ground point lifted to a man's chest, or straight ahead
  if(p && S.aimPoint && S.pointerActive){ const tx = S.aimPoint.x, tz = S.aimPoint.z, ty = XH.live ? S.aimPoint.y : heightAt(tx, tz) + 1.1, hd = Math.hypot(tx - _gp.x, tz - _gp.z); if(hd > 1.5) pitch = Math.atan2(ty - _gp.y, hd);   // Z376 to the crosshair's own point (its height: a chest, a wall, the ground)
    if(XH.live && hd > 1.5 && !tuck){ const de0 = Math.atan2(tx - _gp.x, tz - _gp.z) - yaw, de = Math.atan2(Math.sin(de0), Math.cos(de0)); if(Math.abs(de) < XHAIR.fireTol) yaw += de; } }   // (and the bore on the bearing from the gun itself, not from the middle of his body)
  const airP = airPitch(_gp.x, _gp.y, _gp.z); if(airP != null) pitch = airP;   // Z313 laid on an aircraft: up to its height
  if(hip) pitch *= 0.5; pitch = clamp(pitch, H.pitch[0], airP != null ? (prone ? AIRPOSE.prone : AIRAIM.manUp) : H.pitch[1]) + rc.a + climb + low * RP.pitch - (R.rdy || 0) * REALCAV.ready[1] * (1 - low); const yw = yaw + low * RP.turn; R.gunYaw = yw;   // (Z304 running, not firing: the muzzle carried low · Z340 where the bore really points, for the trigger)
  if(low > 0){ _gp.addScaledVector(_gu, -RP.down * low).addScaledVector(_gr, -RP.in * low); }   // drawn down and in to the chest
  const ywS = yw + (R.gunSway ? R.gunSway.y : 0) + rc.y, ptS = pitch + (R.gunSway ? R.gunSway.p : 0);   // Z343 the muzzle's small figure of eight with the stride (looks only: the rounds go where he aims)
  _gx.set(Math.sin(ywS) * Math.cos(ptS), Math.sin(ptS), Math.cos(ywS) * Math.cos(ptS)).negate();   // the gun's +X runs back to the butt
  _gy.set(0, 1, 0).addScaledVector(_gx, -_gx.y).normalize(); if(rc.r) _gy.applyAxisAngle(_gx, rc.r);   // (Z360 the shot's twitch round the bore)
  if(tuck){ _gx.set(0, 0, -1).applyQuaternion(_gq).addScaledVector(_gu, 0.6).normalize(); _gy.copy(_gu).addScaledVector(_gx, -_gu.dot(_gx)).normalize(); D.Spine2.getWorldPosition(_gp); _gp.addScaledVector(_gu, -0.05).addScaledVector(_gr, 0.12); } if(low > 0 && !g.load) _gy.applyAxisAngle(_gx, -RP.cant * low);   // canted: the mag well to his left hand
  _gz.crossVectors(_gx, _gy); _gm.makeBasis(_gx, _gy, _gz); _gq.setFromRotationMatrix(_gm);
  // butt into the pocket, then the whole gun pushed straight back by the kick
  gunPoint(_gt, g.butt, len, _gw.set(0, 0, 0), _gq); _gp.sub(_gt).addScaledVector(_gx, rc.z);
  if(R.spr * (1 - low) > 0.001 && !g.hold && !tuck) carryPose(R, D, g, len, R.spr * (1 - low));   // Z360 at a sprint: across his chest (GUN 2 eased out as a reload brings the gun to his hands: it cut)
  if(g.load && low > 0.001 && !tuck) loadPose(D, g, len, low, yaw + odw * (g.load.clear || 0), prone);   // Z411 the B41 off his shoulder, stood up to be loaded at its muzzle
  carryGun(R, D, FR, g, len, dt, P, low);   // CARRY 1 at a run, not firing: the rifle at the ready carry (actors/gun-carry.js)
  if(foot) gunEase(R, D, FR, dt);   // GUN 2 a jump of the gun in his chest's frame (a reload begun at a sprint, a hold that flips) eased out, never a teleport
  _gm.compose(_gp, _gq, _gt.set(1, 1, 1)); _mi.copy(G.matrixWorld).invert(); _gm.premultiply(_mi); _gm.decompose(met.position, met.quaternion, met.scale); met.updateMatrixWorld(true);
  // hands onto it: the wrist just behind / above each contact, so the grip sits in the palm; elbows down (the right one out)
  const grip = gunPoint(new THREE.Vector3(), g.grip, len, _gp, _gq), fore = gunPoint(new THREE.Vector3(), g.fore, len, _gp, _gq);
  const wr = grip.clone().addScaledVector(_gy, 0.045).addScaledVector(_gx, 0.035); let wl = fore.clone().addScaledVector(_gy, -0.035).addScaledVector(_gx, 0.02).addScaledVector(_gz, hip ? 0 : 0.02), lc = 0.8;
  // Z365 carried at the hip, the right hand must reach the grip: a soldier with short arms has the gun lifted toward his right shoulder just enough
  if(hip && D.RightArm){ const rR = armLen(D, 'Right') * H.reach; D.RightArm.getWorldPosition(_pa); const dR = _pa.distanceTo(wr);
    if(dR > rR){ _pd.subVectors(_pa, wr).setLength(dR - rR); for(const v of [wr, wl, grip, fore]) v.add(_pd); _gp.add(_pd); _gm.compose(_gp, _gq, _pk.set(1, 1, 1)); _gm.premultiply(_mi); _gm.decompose(met.position, met.quaternion, met.scale); met.updateMatrixWorld(true); } }
  // Z345 THE SUPPORT HAND ON THE GUN: its palm on the handguard's underside at this weapon's own spot (palmSpot) — and out of the left arm's reach
  //   (turned right round to his right in the saddle), the gun is brought across toward it rather than the hand stopping in the air short of it
  const PL = rk < 0 && g.palm != null ? (g.rows ? palmFit(R, g, len, D, wl, fore, dt, reachL) : palmSpot(met, g, len)) : null, palmP = PL ? gunPoint(new THREE.Vector3(), PL, len, _gp, _gq).addScaledVector(_gz, H.wrap[0]).addScaledVector(_gy, H.wrap[1]) : null; if(palmP) wl.add(_pd.subVectors(palmP, fore));   // (Z348 the palm on the handguard's lower near side: a hand round it, not a cup under it)
  { const reach = armLen(D, 'Left') * reachL; D.LeftArm.getWorldPosition(_pa); const d = _pa.distanceTo(wl);   // (Z360 the shoulder's place taken after armLen, which reuses _pa)
    R.pull = Math.max(0, d - reach); if(d > reach){ _pd.subVectors(_pa, wl).setLength(d - reach); for(const v of [wr, wl, grip, fore]) v.add(_pd); if(palmP) palmP.add(_pd); _gp.add(_pd);
      _gm.compose(_gp, _gq, _pk.set(1, 1, 1)); _gm.premultiply(_mi); _gm.decompose(met.position, met.quaternion, met.scale); met.updateMatrixWorld(true); } }
  // GUN 2 the reload's own steps for this weapon's family (actors/gun-reload.js): where the left hand is in them (the bolt gun: the right hand too), what it holds, each step's sound
  if(rk >= 0){ const RH = reloadHands(R, RS, D, g, len, FR, wl, wr); wl = RH.l.clone(); if(RS.fam === 'tube' && BODYFULL.tube.palm) _tb.copy(wl); lc = RH.lc; if(RH.rOn) wr.copy(RH.r); D.Neck && turnBone(D.Neck, _gr, -RH.look * low); }   // and he looks down at it (about his right: negative is down)
  // GUN 3 a gun worked by hand after each shot: the 12.7's bolt (the right hand off the grip), the shotgun's pump (the left palm back along it and forward) — the case is thrown at the stroke
  const CY = foot && rk < 0 && !tuck ? shotCycle(R, g, len, FR, wr, nowS) : null, bolt = !!(CY && CY.rOn); if(bolt) wr.copy(CY.r); if(CY && CY.dx && palmP) palmP.addScaledVector(_gx, CY.dx);
  const pR = foot ? FH.gripPole : [-0.45, 0.3, -0.1]; sh.getWorldPosition(_gt); ik2(D.RightArm, D.RightForeArm, D.RightHand, wr, _gt.clone().addScaledVector(_gu, pR[0]).addScaledVector(_gr, pR[1]).addScaledVector(_gf, pR[2]));
  D.LeftArm.getWorldPosition(_gt); const pL = foot ? BODYFIX.hold.poleL : POLE_L, poleL = _gt.clone().addScaledVector(_gu, pL[0]).addScaledVector(_gr, pL[1]).addScaledVector(_gf, pL[2]); ik2(D.LeftArm, D.LeftForeArm, D.LeftHand, wl, poleL);   // (BODY 1 on his feet: where the support elbow goes, BODYFIX.hold)
  rollHand(D, 'Right', _gt.copy(_gy).negate()); if(rk < 0) rollHand(D, 'Left', _gx); else if(foot) handRoll(R.pup, 'Left', BODYFIX.hold.freeRoll);   // Z304 knuckles down the pistol grip; the support hand's along the handguard (BODY 1 off the gun in a reload: turned no further on its forearm than a wrist turns)
  if(rk >= 0 && RS.fam === 'tube' && BODYFULL.tube.palm) for(let it = 0; it < 2; it++){ wl.add(_pd.subVectors(_tb, palmOf(D, 'Left', _pa))); ik2(D.LeftArm, D.LeftForeArm, D.LeftHand, wl, poleL); if(foot) handRoll(R.pup, 'Left', BODYFIX.hold.freeRoll); }   // BODY 10 loading the B41: the PALM (the rocket in it) on each point of the reload, not the wrist — it stood a hand's length short of the muzzle
  // Z345 the support hand cupped under the handguard: palm up, the fingers across it to its far side (to curl up round it), index ahead — not
  //   carried on from the forearm with the fingers hanging under the gun; then the palm itself onto its spot (twice: the hand's own length taken up)
  const cup = palmP && D.LeftHandMiddle1 ? _pk.copy(_gz).multiplyScalar(-H.cup[0]).addScaledVector(_gy, H.cup[1]).addScaledVector(_gx, -H.cup[2]).normalize().clone() : null;
  let moved = false;
  const cupL = () => (wrists ? wristGive(D, 'Left', cup, FH.wrist[1], _wg) : cup);   // GUN 1 the support hand gives toward its forearm: no wrist bent past a man's (actors/gun-hands.js)
  if(palmP) for(let it = 0; it < (foot ? 3 : 2); it++){ if(cup){ LEGKIT.aim(D.LeftHand, D.LeftHandMiddle1, cupL()); rollHand(D, 'Left', _gx); } wl.add(_pd.subVectors(palmP, palmOf(D, 'Left', _pa)));
    const reach = armLen(D, 'Left') * reachL, shL = D.LeftArm.getWorldPosition(new THREE.Vector3()), d = shL.distanceTo(wl);   // (Z348 still out of reach with the palm on its spot: the gun comes back to the hand — no arm locked straight)
    if(d > reach){ const dv = shL.sub(wl).setLength(d - reach); R.pull += d - reach; for(const v of [wr, wl, grip, fore, palmP]) v.add(dv); _gp.add(dv); _gm.compose(_gp, _gq, _pk.set(1, 1, 1)); _gm.premultiply(_mi); _gm.decompose(met.position, met.quaternion, met.scale); met.updateMatrixWorld(true); moved = true; }
    ik2(D.LeftArm, D.LeftForeArm, D.LeftHand, wl, poleL); rollHand(D, 'Left', _gx); }
  // Z360 still dragged off his shoulder for the left hand (a long gun, a short arm): he turns further side-on, his left shoulder forward — a little more each
  //   frame it pulls, easing back once it does not; on his feet, sat (his chest turned on his hips) or lying (his body angled to the gun, less: B[4])
  { const B = H.blade, e = foot && rk < 0 && (R.spr || 0) < 0.05 ? reachFeel(R, D, prone, dt) : -1, cap = B[3] * (prone ? B[4] : 1), CF = FH.cheek, es = foot ? -(R.cdr || 0) : 0, eb = es > CF.side ? es : 0;   // GUN 1 and, on his feet, until the support arm is comfortably bent (collar bone first: reachFeel) and the stock is under his eye (eb: the eye still left of the sights)
    R.bx = clamp((R.bx || 0) + (R.pull > B[0] ? R.pull / B[1] * Math.min(1, dt * 8) : (e > 0 || eb > 0) && (R.bx || 0) < FH.reach.blade ? (Math.max(0, e) * FH.reach.k + eb * CF.bladeK) * dt : e < 0 && es < CF.side * 0.4 ? -B[2] * dt : 0), 0, cap); }
  // Z348 THE FIRING HAND ROUND THE PISTOL GRIP: its palm put on the grip itself (twice, as the support hand's) and the hand turned round it — fingers
  //   ahead and across, the knuckles down the grip — not left where the forearm happens to point (kneeling it stood 4–6 cm off the grip)
  const poleR = sh.getWorldPosition(new THREE.Vector3()).addScaledVector(_gu, pR[0]).addScaledVector(_gr, pR[1]).addScaledVector(_gf, pR[2]);
  if(moved){ ik2(D.RightArm, D.RightForeArm, D.RightHand, wr, poleR); rollHand(D, 'Right', _gt.copy(_gy).negate()); }   // (the firing hand follows the gun)
  if(rk < 0 && !bolt && D.RightHandMiddle1 && H.gripR){ const gp = grip.clone().addScaledVector(_gz, -H.gripR[3]).addScaledVector(_gy, H.gripR[4]), ax0 = _gx.clone().multiplyScalar(-H.gripR[0]).addScaledVector(_gz, H.gripR[1]).addScaledVector(_gy, -H.gripR[2]).normalize();
    if(foot && g.rows) gp.addScaledVector(_gx, FH.grip[0]).addScaledVector(_gy, FH.grip[1]);   // GUN 1 the palm on the pistol grip itself, high under the receiver (a fitted gun's grip point is its front edge, low: the hand closed on air ahead of it)
    const axR = () => (wrists ? wristGive(D, 'Right', ax0, FH.wrist[0], _wg) : ax0);
    for(let it = 0; it < (foot ? 3 : 2); it++){ LEGKIT.aim(D.RightHand, D.RightHandMiddle1, axR()); rollHand(D, 'Right', _gt.copy(_gy).negate()); wr.add(_pd.subVectors(gp, palmOf(D, 'Right', _pa))); ik2(D.RightArm, D.RightForeArm, D.RightHand, wr, poleR); }
    LEGKIT.aim(D.RightHand, D.RightHandMiddle1, axR()); rollHand(D, 'Right', _gt.copy(_gy).negate()); }
  if(cup){ LEGKIT.aim(D.LeftHand, D.LeftHandMiddle1, cupL()); rollHand(D, 'Left', _gx); lc = H.cup[3]; }
  curlHand(D, 'Right', 0.85, grip, 0, 0.35); curlHand(D, 'Left', lc, rk >= 0 ? wl.clone().addScaledVector(_gy, -0.05) : palmP ? palmP.clone().addScaledVector(_gz, -H.wrap[0]).addScaledVector(_gy, 0.05) : fore.clone().addScaledVector(_gy, 0.02));   // (Z345 the fingers curl up round the handguard · Z348 toward its middle, tight)
  if(foot) handsEase(R, D, dt, poleL, poleR);   // GUN 2 nor a hand
  if(wrists) triggerFinger(D, FR, g, len, rk < 0 && !tuck && !bolt ? (1 - (R.rdy || 0)) * (1 - (R.spr || 0)) : 0);   // GUN 1 the index finger on the trigger when he aims, straight along the frame when he runs, carries, reloads (actors/gun-hands.js)
  // Z356 CHEEK TO THE STOCK: the right eye brought down behind the sight — the neck bowed over the stock, the head tilted onto it. Upright, his eyes stood
  //   some 25 cm over the gun: a man looking over his sights, not through them, the gun at his chest (kneeling it read as held too low)
  const weld = rk < 0 && !g.hold && !tuck ? (1 - (R.rdy || 0)) * (1 - low) : 0;   // (only aiming: running at the ready or reloading he keeps his head up)
  R.weld = weld; if(weld < 0.5) R.cdr = 0;
  // GUN 1 on his feet: the eye read off the head's own axes (bowing it lowers the eye), the head moved only within a man's range, and the gun brought the
  //   rest of the way to the eye (R.cw: the butt up / in, eased — applied where the pocket is taken, next frame)
  if(eyeW && weld > 0.01 && D.Head && D.Neck){ const CW = H.cheek, CF = FH.cheek, sY = sightLine(met, g, len), cw = R.cw || (R.cw = { u:0, i:0 }); let bs = 0, ts = 0, dy = 0, dr = 0;
    headLevel(D, _gu, _gf, _gr, CF.head, weld);   // (first near upright: the clip hangs it over the gun)
    const gap = () => { eyePoint(D, CW.eye, _gu, _gf, _pa); _pd.subVectors(_pa, _gp); const al = _pd.dot(_gx); _pk.copy(_gp).addScaledVector(_gx, al).addScaledVector(_gy, sY); _pd.subVectors(_pa, _pk); dy = _pd.dot(_gy); dr = _pd.dot(_gr); };
    for(let it = 0; it < CF.iter; it++){ gap(); const bow = clamp(Math.atan2(dy, CW.reach) * CW.k * weld, CF.bow[0] - bs, CF.bow[1] - bs), tilt = clamp(Math.atan2(-dr, CW.reach) * CW.k * weld, -CF.tilt - ts, CF.tilt - ts); bs += bow; ts += tilt;
      turnBone(D.Neck, _gr, -bow * 0.5); turnBone(D.Head, _gr, -bow * 0.5); turnBone(D.Neck, _gf, tilt * 0.5); turnBone(D.Head, _gf, tilt * 0.5); }
    gap(); const k = Math.min(1, dt * CF.rate); cw.u = clamp(cw.u + dy * k, CF.up[0], CF.up[1]); cw.i = clamp(cw.i - dr * k, CF.in[0], CF.in[1]); R.cdr = dr; }   // (R.cdr: the eye still beside the sights — the chest turns side-on for it, below)
  else if(foot && g.hold && rk < 0 && !tuck && D.Head && D.Neck) headLevel(D, _gu, _gf, _gr, FH.cheek.head, 1 - (R.rdy || 0));   // (GUN 1 no weld on the B41 or a hip-fired gun, but his head is up: lying down the clip hung it 70° over the ground)
  else if(weld > 0.01 && D.Head && D.Neck){ const CW = H.cheek, sY = sightLine(met, g, len);
    for(let it = 0; it < 2; it++){ D.Head.getWorldPosition(_pa); _pa.addScaledVector(_gu, CW.eye[1]).addScaledVector(_gf, CW.eye[2]).addScaledVector(_gr, CW.eye[0]);   // (his right eye)
      _pd.subVectors(_pa, _gp); const al = _pd.dot(_gx); _pk.copy(_gp).addScaledVector(_gx, al).addScaledVector(_gy, sY); _pd.subVectors(_pa, _pk);   // (eye − the sight line beside it)
      const bow = clamp(Math.atan2(_pd.dot(_gy), CW.reach), 0, CW.max[0]) * CW.k * weld, tilt = clamp(Math.atan2(-_pd.dot(_gr), CW.reach), -CW.max[1], CW.max[1]) * CW.k * weld;
      turnBone(D.Neck, _gr, -bow * 0.6); turnBone(D.Head, _gr, -bow * 0.4); turnBone(D.Neck, _gf, tilt * 0.5); turnBone(D.Head, _gf, tilt * 0.5); } }
  // Z299 the head leads: the eyes are on the target before the shoulders get there, up / down to it, and held level when the ride banks and pitches
  const lead = clamp(dyw - hy - (R.tw || 0), -0.65, 0.65) * (1 - low);   // (_gu is still his up)
  turnBone(D.Neck, _gu, lead * 0.45); turnBone(D.Head, _gu, lead * 0.55);
  if(airP != null){ const up = Math.max(0, pitch * AIRPOSE.sight - (R.lean || 0) - rc.a) * (1 - low); turnBone(D.Neck, _gr, up * AIRPOSE.neck); turnBone(D.Head, _gr, up * (1 - AIRPOSE.neck)); }   // Z326 cheek to the stock: head and neck tip back to sight along the barrel
  else turnBone(D.Head, _gr, (pitch - rc.a + (R.rdy || 0) * REALCAV.ready[1]) * 0.55 * (1 - low));   // (Z368 not the low-ready drop: the muzzle down, his eyes ahead)
  if(D.Head){ _gt.crossVectors(_gu, _gw.set(0, 1, 0)); const sn = _gt.length(); if(sn > 1e-4) turnBone(D.Head, _gt.normalize(), Math.asin(Math.min(1, sn)) * 0.65); }
  reloadProps(R, RS, D, g, len, FR, dt);   // GUN 2 what his left hand holds (a magazine, a box, a shell, a rocket), the one let go falling
  return true; }
// Z335 OVER THE DRIVER'S SHOULDER: sat on the pillion behind the driver, a gun laid ahead (within fw of straight ahead, eased in) is carried at the height of the
//   driver's shoulder plus `up` — on it, not into his back or his head; turned to the side or behind there is nothing in the way and it sits in his own shoulder
const _od = new THREE.Vector3(), _oq = new THREE.Quaternion();
function overDriver(R, gp, yaw){ const Hh = R.H, D = Hh && Hh.drv, B = D && D.ok && D.state === 'ride' && D.B, C = REALCAV.overDrv; if(!B || !R.seated || !C) return 0;
  const ds = B.RightShoulder || B.RightArm; if(!ds) return 0; (Hh.body || Hh.B).getWorldQuaternion(_oq); _od.set(0, 0, 1).applyQuaternion(_oq);
  const c = _od.x * Math.sin(yaw) + _od.z * Math.cos(yaw), w = smooth((c - C.fw[0]) / (C.fw[1] - C.fw[0])); if(w <= 0) return 0;
  ds.getWorldPosition(_od); const need = _od.y + C.up - gp.y; if(need > 0) gp.y += need * w; return w; }   // (Z416 how far ahead over the driver: the B41's reload swings out beside the ride)
// Z304 SITTING TALL: the riding clip slumps him forward over the pillion; his back is brought up toward upright (a soldier's alert sit, a slight lean
//   forward kept), spread over the three spine bones about his own right
function sitTall(R, G){ const D = R.pup.D, C = REALCAV.sit; if(!D.Hips || !D.Neck || !D.RightUpLeg || !D.LeftUpLeg) return;
  D.Hips.getWorldPosition(_fa); D.Neck.getWorldPosition(_fb); _fb.sub(_fa).normalize(); G.getWorldQuaternion(_fq); _fu.set(0, 1, 0).applyQuaternion(_fq);
  D.RightUpLeg.getWorldPosition(_fr); D.LeftUpLeg.getWorldPosition(_ff); _fr.sub(_ff); _fr.addScaledVector(_fu, -_fr.dot(_fu)).normalize(); _ff.crossVectors(_fu, _fr).normalize();   // his right · ahead
  const corr = (Math.atan2(_fb.dot(_ff), _fb.dot(_fu)) - C.lean) * C.k; if(Math.abs(corr) < 1e-3) return;   // (about his right: + leans him back)
  turnBone(D.Spine, _fr, corr * 0.45); turnBone(D.Spine1, _fr, corr * 0.35); turnBone(D.Spine2, _fr, corr * 0.2); }
// Z302 A PASSENGER'S FEET: sat on the ride his feet go onto the passenger pegs (the xe ôm's fold-out pegs) instead of hanging
//   in the air — less so as he swings his hips round on the seat to fire behind (a foot comes off the peg), none at all getting on or off
const _fa = new THREE.Vector3(), _fb = new THREE.Vector3(), _fq = new THREE.Quaternion(), _ff = new THREE.Vector3(), _fr = new THREE.Vector3(), _fu = new THREE.Vector3();
function seatFeet(R, H, dt, on){ const F = XEOM[H.bike] && XEOM[H.bike].feet, D = R.pup.D; R.fw = (R.fw || 0) + ((on && F ? 1 : 0) - (R.fw || 0)) * Math.min(1, dt * 4);
  if(!F || R.fw < 0.02) return; const body = H.body || H.B; body.updateWorldMatrix(true, false); body.getWorldQuaternion(_fq);
  _ff.set(0, 0, 1).applyQuaternion(_fq); _fr.set(-1, 0, 0).applyQuaternion(_fq); _fu.set(0, 1, 0).applyQuaternion(_fq);   // ahead · the ride's right · up
  for(const [L, sd] of [['Left', 1], ['Right', -1]]){ const up = D[L + 'UpLeg'], kn = D[L + 'Leg'], ft = D[L + 'Foot']; if(!up || !kn || !ft) continue;
    const w = R.fw * clamp(1 - Math.max(0, (R.hy || 0) * sd) * 0.7, 0.25, 1);   // (swung round toward a side, the foot on that side lifts off)
    body.localToWorld(_fa.set(F[0] * sd, F[1], F[2])); ft.getWorldPosition(_fb); _fb.lerp(_fa, w);
    up.getWorldPosition(_fa); _fa.addScaledVector(_ff, 1).addScaledVector(_fr, -sd * 0.35).addScaledVector(_fu, 0.2); ik2(up, kn, ft, _fb.clone(), _fa.clone()); } }
// Z299 THE BODY ON A MOVING RIDE: his trunk is a damped pendulum on his hips — it lurches forward when the ride brakes and back when it surges, leans out
//   in a bend on three wheels (on two he banks with the bike), and nods and settles with every heave of the suspension; the gun is laid in after this,
//   so it rides on his shoulders and his arms take up the difference
const _sr = new THREE.Vector3(), _sf = new THREE.Vector3(), _sq = new THREE.Quaternion();
function rideSway(R, G, dt, I, H){ const W = R.sw || (R.sw = { p:0, vp:0, r:0, vr:0, h:0, vh:0 }), C = REALCAV.sway, D = R.pup.D; dt = Math.min(dt, 0.05);
  const two = !!(H && H.two), pT = I ? clamp(-I.acc * C.acc, -C.max, C.max) : 0, rT = I && !two ? clamp(I.lat * C.lat, -C.max, C.max) : I && I.lean || 0,   // (RIDE 3 on two wheels he leans into the bend with the driver)
    hT = I ? clamp(-I.vy * C.heave, -0.3, 0.3) : 0;
  const spr = (x, v, t, k, z) => v + (-k * (x - t) - 2 * z * Math.sqrt(k) * v) * dt;
  W.vp = spr(W.p, W.vp, pT, C.k, C.z); W.p += W.vp * dt; W.vr = spr(W.r, W.vr, rT, C.k, C.z); W.r += W.vr * dt; W.vh = spr(W.h, W.vh, hT, C.k * 1.8, C.z); W.h += W.vh * dt;
  if(!I && Math.abs(W.p) + Math.abs(W.r) + Math.abs(W.h) < 1e-3) return;
  G.getWorldQuaternion(_sq); _sr.set(-1, 0, 0).applyQuaternion(_sq); _sf.set(0, 0, 1).applyQuaternion(_sq);   // his right · ahead
  const sp = [['Spine', 0.45], ['Spine1', 0.33], ['Spine2', 0.22]]; for(const [n, f] of sp){ turnBone(D[n], _sr, -W.p * f); turnBone(D[n], _sf, W.r * f); }
  turnBone(D.Neck, _sr, -W.h); }
// RIDE 2 THE REAL HORSE ON ITS HAUNCHES (game/ride-feel.js H.stop.k): its clips fade out to the rig's own square stand, and over that the whole body is
//   pitched nose-up about its forefeet (croup down RIDEFEEL.stop.horse.drop, the braced forelegs reaching ahead with it), the hind legs folded under the
//   belly — femur forward, tibia back, cannon forward (angles solved off the rig so the hooves stay on the ground from k = 0 to 1) — the neck raised and
//   the nose tucked. The bones it turns are put back before the mixer's next step (the mixer only writes a bone whose animated value changed).
const HAUNCH = [['rearUpr', 'femur', 1], ['rearLwr', 'tibia', -1], ['rearHorselink', 'cannon', 1]];
function haunchBones(R){ const hr = R.hr, get = n => hr.getObjectByName(n) || hr.getObjectByName(n.replace('.', '')), L = [];
  for(const [n, key, sg] of HAUNCH) for(const sd of ['.L', '.R']){ const b = get(n + sd); if(b) L.push({ b, key, sg, q:new THREE.Quaternion() }); }
  for(const [n, key, sg] of [['neck_01', 'neck', 1], ['head', 'head', -1]]){ const b = get(n); if(b) L.push({ b, key, sg, q:new THREE.Quaternion() }); }
  return L; }
function haunchOff(R){ if(R.hbOn){ for(const e of R.hb) e.b.quaternion.copy(e.q); R.hbOn = false; } }
// RIDE 3 …and the real horse stands on the ground it is on: pitched to the slope under it (the ground len m ahead of and behind its middle), lifted to it,
//   and leant into its turns by the rig's own bank (actors/horse.js S.bank) — it used to stay bolt upright and level, hooves in or over a dune
function haunchPose(R, H, k, about, dt){ const hr = R.hr, C = RIDEFEEL.stop.horse, F = RIDEFEEL.horse.body, K = H.root.scale.x || 1; H.root.getWorldPosition(_v); H.root.getWorldQuaternion(_q); _z.set(0, 0, 1).applyQuaternion(_q);
  const air = H.air && H.air.y > 0.02, hf = heightAt(_v.x + _z.x * F.len, _v.z + _z.z * F.len), hb = heightAt(_v.x - _z.x * F.len, _v.z - _z.z * F.len), hc = heightAt(_v.x, _v.z), e = Math.min(1, (dt || 0.016) * F.rate);
  R.gp = (R.gp || 0) + ((air ? 0 : clamp(Math.atan2(hf - hb, 2 * F.len), -F.maxPitch, F.maxPitch)) - (R.gp || 0)) * e; R.gy = (R.gy || 0) + ((air ? 0 : clamp((hf + hb) / 2 - hc, -0.3, 0.3)) - (R.gy || 0)) * e;
  hr.rotation.x = -C.pitch * k - R.gp; hr.rotation.z = (H.bank || 0) * F.bank - about * k * C.roll; hr.position.set(0, (R.gy - C.drop * k) / K, C.shift * k / K);
  if(k < 0.004) return; const L = R.hb || (R.hb = haunchBones(R)); _x.set(-1, 0, 0).applyQuaternion(_q);   // its right: + about it brings a hoof forward / tips a neck back
  for(const e of L) e.q.copy(e.b.quaternion); R.hbOn = true; for(const e of L) turnBone(e.b, _x, e.sg * C[e.key] * k); }
export function fitRealCav(CV){
  if(CV.realP) return CV.realP;
  return (CV.realP = Promise.all(['horse', 'operator', 'rideGallop', 'rideWalk', 'carbine', 'soldier2'].map(loadGLTF)).then(L => {
    if(L.slice(1, 5).some(x => !x) || (!L[0] && !CV.H?.bike) || !CV.H || !CV.G) return false;
    const [hg, og, rg, rw, cg, sg] = L, H = CV.H, G = CV.G, u = G.userData, C = REALCAV;
    let hr = null, hm = null, HA = null, seat = null;   // Z293 on a war ride there is no horse to dress: the ride is already the real model
    if(!H.bike){
    // ---- the horse: the real body on the procedural root (it cancels the root's size), the seat a node on its back bone
    hr = skClone(hg.scene); const K = H.root.scale.x || 1; hr.name = 'realHorse'; hr.scale.setScalar(1 / K);
    hr.traverse(o => { if(o.isSkinnedMesh) o.frustumCulled = false; });
    seat = new THREE.Object3D(); seat.name = 'realSeat'; seat.position.fromArray(C.seat); hr.add(seat); hr.updateMatrixWorld(true);
    const sb = hr.getObjectByName(C.seatBone); if(sb) sb.attach(seat);
    H.root.traverse(o => { if(o.isMesh && !under(o, G)) o.visible = false; });
    H.root.add(hr);
    hm = new THREE.AnimationMixer(hr); HA = actions(hm, hg.animations.map(c => inPlace(c, 'root.position')), n => n.replace(/^horse_/, '')); }
    // ---- the operator inside the general's rig group (its scale cancelled to metres), every procedural mesh hidden
    const op = skClone(og.scene); op.name = 'realOp'; op.scale.setScalar(C.opH / 1.88 / HUMAN_SCALE);
    op.traverse(o => { if(o.isSkinnedMesh) o.frustumCulled = false; });
    G.traverse(o => { if(o.isMesh) o.visible = false; });
    G.add(op);
    // Z294 the second soldier (the special-forces Tripo model) wears the operator's moves: the operator stays, unseen, and drives him bone by bone
    let pup = null; if(sg && C.s2.on && (PROFILE.trooper || 's2') === 's2'){ const sw = new THREE.Group(), s2 = skClone(sg.scene); sw.name = 'realS2'; sw.rotation.y = C.s2.yaw; sw.scale.setScalar(C.opH / HUMAN_SCALE * (C.s2.k || 1));   // (Z300 a touch bigger and taller)
      s2.traverse(o => { if(o.isSkinnedMesh){ o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; } }); sw.add(s2); G.add(sw); G.updateMatrixWorld(true); pup = makePuppet(op, s2);   // (Z301 he takes his own shadows: arms across the chest, the helmet over the face)
      if(pup) op.traverse(o => { if(o.isMesh) o.visible = false; }); else G.remove(sw); }
    else if((PROFILE.trooper || 's2') === 'op'){ const seen = skClone(og.scene); seen.name = 'realOpSeen'; seen.scale.copy(op.scale);   // Z330 THE STEEL OPERATOR HOLDS IT THE SAME WAY: a second copy of him is the one
      seen.traverse(o => { if(o.isSkinnedMesh){ o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; } }); G.add(seen); G.updateMatrixWorld(true); pup = makePuppet(op, seen);   //   seen, worn by the clips like the special-forces soldier, so the gun-first hold (bore on the aim, butt in the shoulder, hands by IK) is his too
      if(pup) op.traverse(o => { if(o.isMesh) o.visible = false; }); else G.remove(seen); }
    const clips = [...og.animations, ...rg.animations, ...rw.animations].map(c => inPlace(c, 'mixamorigHips.position')), byName = n => clips.find(c => c.name === n);
    // the standing aim: the shouldered rifle of the walk-and-fire clip over the square stance of the standing reload (one held frame)
    const UP = /Spine|Neck|Head|Shoulder|Arm|Hand/;
    clips.push(poseClip('Aim_Stand', [[byName('Walk_Forward_While_Shooting'), 0.1, t => UP.test(t.name)], [byName('Standing_Reload'), 0, t => !UP.test(t.name)]]));
    clips.push(poseClip('Kneeling_Aim', [[byName('Walk_Forward_While_Shooting'), 0.1, t => UP.test(t.name) && !/Spine$/.test(t.name)], [byName('Kneeling_Reload'), 0, t => !UP.test(t.name) || /Spine$/.test(t.name)]]));   // Z295 on one knee with the rifle shouldered (the reload clip's legs, the aim's arms)
    const om = new THREE.AnimationMixer(op), OA = actions(om, clips);
    // Z254 a hit: the upper body of the gunshot-reaction clip laid over whatever he is doing (legs stay in the saddle / on the ground)
    const hitClip = byName('Gunshot_Reaction'), HIT = hitClip ? om.clipAction(new THREE.AnimationClip('Hit_Upper', hitClip.duration, hitClip.tracks.filter(t => UP.test(t.name)))) : null;
    if(HIT){ HIT.setLoop(THREE.LoopOnce, 1); HIT.clampWhenFinished = true; HIT.enabled = true; HIT.setEffectiveWeight(0); HIT.play(); }
    const bone = n => op.getObjectByName('mixamorig' + n);
    // ---- the carbine: laid between the hands each frame; the game's muzzle point moves onto its muzzle
    // Z295 the hold: the carbine and the infantry arsenal share one frame (the carbine's: muzzle toward −X, stock +X, the grip where the right hand goes)
    const cb = new THREE.Group(); cb.name = 'realCarbine'; G.add(cb); const carb = cg.scene.clone(true); cb.add(carb);
    if(u.muzzle){ cb.add(u.muzzle); u.muzzle.position.fromArray(C.carbine.muzzle); }
    const arms = { _carbine:carb, _G:G }; armInfantry(arms, cb, C);
    CV.real = { hr, hm, HA, seat, op, om, OA, HIT, hitW:0, wasHit:false, deadOn:false, cb, arms, armK:'_carbine', csc: C.carbine.len / 0.954,
      hips: bone('Hips'), spine: ['Spine', 'Spine1', 'Spine2'].map(bone), rh: bone('RightHand'), rhm: bone('RightHandMiddle1'), lh: bone('LeftHand'), lhm: bone('LeftHandMiddle1'), pup };
    if(pup){ const D = pup.D; Object.assign(CV.real, { rh:D.RightHand, rhm:D.RightHandMiddle1 || null, lh:D.LeftHand, lhm:D.LeftHandMiddle1 || null }); }   // Z294 the gun goes in the hands that are seen
    u.realOp = op;
    return true; })); }

// P = { twist (aim − facing, rad), footV (m/s on foot), stance ('stand' | 'crouch' | 'prone'), trans (getting on / off), hit (he was just struck), dead }
// POSE 1 after everything that lays him on his gun, his seat and the ground (two-bone IK turns a bone the short way: its roll falls where it may), the
//   seen soldier's elbows and knees are hinged on the plane each limb folds in and the twist shared along it (actors/puppet.js) — no joint or hand moves
//   · sat on a ride his head is brought back near upright: his shoulders are his own now (they were shrugged 9 cm up), the saddle's cheek weld bowed him 35° to the sights
const _lf = new THREE.Vector3(), _lr = new THREE.Vector3(), _lu = new THREE.Vector3(), _lq = new THREE.Quaternion();
export function updateRealCav(CV, dt, P){ const R = CV.real; if(!R || !dt) return; poseRealCav(CV, dt, P); const U = R.pup; if(!U) return;
  if(PUPPET.full && U.F && !U.F.same && R.sat && R.gunYaw != null && U.D.Head && U.D.Neck){ CV.G.getWorldQuaternion(_lq); _lu.set(0, 1, 0).applyQuaternion(_lq); const y = R.gunYaw;
    headLevel(U.D, _lu, _lf.set(Math.sin(y), 0, Math.cos(y)), _lr.set(-Math.cos(y), 0, Math.sin(y)), PUPPET.head.level, 1); }
  limbTwist(U); }
function poseRealCav(CV, dt, P){
  const R = CV.real; if(!R || !dt) return; const H = CV.H, G = CV.G, C = REALCAV;
  // the horse
  const g = H.gait, v = Math.abs(H.v || 0), leap = H.air && H.air.y > 0.02 && R.HA && R.HA.Jump_Sprint, hk = leap ? 'Jump_Sprint' : g === 'idle' ? 'Idle' : g === 'walk' ? 'Walk' : (g === 'trot' || g === 'canter') ? 'Canter' : 'Sprint';   // (Z321 in mid-leap it jumps)
  if(leap && H.air.jumpNew){ H.air.jumpNew = false; R.HA.Jump_Sprint.time = 0; }   // (from take-off, played over just the time it is in the air)
  const HS = !H.bike && H.stop, sk = HS ? HS.k : 0; if(R.hr) haunchOff(R);
  const SWH = R.hr && !H.bike ? horseSwimClip(R, H, v) : null;   // HSWIM 1 afloat it paddles: the walk at a shortened stride (game/horse-swim.js)
  if(R.hm){ blend(R.HA, HS && HS.on ? '' : SWH ? SWH.hk : hk, SWH ? SWH.ts : hk === 'Idle' ? 1 : leap ? R.HA.Jump_Sprint.getClip().duration / (H.air.flight || 0.7) : clamp(v / C.horseV[hk], 0.6, 1.5), HS && HS.on ? dt * 3 : dt); if(SWH) horseSwimMix(R, H); R.hm.update(dt); }
  if(R.hr){ haunchPose(R, H, sk, HS ? HS.about : 0, dt); if(!H.bike) horseSwimPose(R, H, dt); }   // (HSWIM 1 afloat: nose-up about the seat, neck and head out of the water)
  // the rider: on the real horse's back while mounted (every mount / respawn puts the rig on the procedural body bone — move it to the seat)
  const bike = H.bike, stand = bike && XEOM[bike].pose === 'stand';   // Z293 on a war ride he keeps the ride's own seat (seatRider): sat on it, or standing in the bed
  if(!bike && G.parent === H.B){ R.seat.add(G); G.rotation.set(0, 0, 0); }
  const mounted = bike ? G.parent === (H.body || H.B) : G.parent === R.seat;
  if(mounted && !bike){ G.position.set(0, 0, 0); G.scale.setScalar(HUMAN_SCALE); }
  let ok, ts = 1, freeze = null; const fv = P.footV || 0, s = P.stance;
  if(P.dead && !R.deadOn){ R.deadOn = true; const a = R.OA.dying_backwards; if(a){ a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } }   // Z254 killed: falls backwards, once
  if(!P.dead && R.deadOn){ R.deadOn = false; const a = R.OA.dying_backwards; if(a){ a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; } }
  const MV = !mounted && !P.dead && P.move;   // Z336 jumping / rolling / just landed
  if(P.dead && R.OA.dying_backwards){ ok = 'dying_backwards'; ts = 1; }
  else if(P.climb && P.climb !== 'top' && P.climb !== 'fall'){ ok = 'Aim_Stand'; freeze = 0; }   // Z451 on a wall's face: his own climb (actors/soldier-climb-pose.js)
  else if(MV && MV.roll >= 0){ ok = 'Cautious_Crouch_Walk_Forward'; freeze = 0.42; }   // tucked: knees up, head down
  else if(MV && (MV.air || MV.land > 0)){ ok = 'Aim_Stand'; freeze = 0; }   // Z341 in the air and landing the rifle stays up; his legs tuck and give (actors/soldier-legs.js)
  else if(P.trans && CV.trans && !CV.trans.crash && R.pup){ ok = 'Aim_Stand'; freeze = 0; }   // Z342 getting on / off: his own climb (actors/soldier-mount.js), the rifle carried low
  else if(P.trans && P.trans.k === 'off'){ if(P.trans.e < 0.55){ ok = 'Cautious_Crouch_Walk_Forward'; ts = 1.3; } else { ok = 'Kneeling_Aim'; freeze = 0; } }   // Z295 getting off: a crouched step down, landing on one knee, rifle up
  else if(P.trans && P.trans.k === 'on'){ if(P.trans.e < 0.45){ ok = 'Walk_Forward_While_Shooting'; ts = 1.1; } else { ok = 'Kneeling_Aim'; freeze = 0; } }   // getting on: a step to it, then gathered up onto the seat
  else if(mounted && stand){ if(R.step){ ok = 'Walk_Forward_While_Shooting'; ts = 1.35; } else { ok = 'Aim_Stand'; freeze = 0; } }   // braced in the bed, rifle shouldered (Z303 his feet step round when he turns his body)
  else if(mounted && bike){ ok = 'Ride_Walk'; ts = 0.35; }   // sat on the pillion: the gentle sway of the riding clip
  else if(mounted){ ok = (g === 'gallop' || g === 'canter') ? 'Ride_Gallop' : 'Ride_Walk'; ts = g === 'idle' ? 0.45 : 1; }
  else if(P.trans || s === 'stand' && fv < 0.3){ ok = 'Aim_Stand'; freeze = 0; }   // the rifle shouldered, feet square
  else if(s === 'prone'){ ok = 'Prone_Reload'; if(fv < 0.2) freeze = 0; else ts = 0.7; }
  else if(s === 'crouch'){ if(fv < 0.3){ ok = 'Kneeling_Aim'; freeze = 0; } else if(R.ownLegs && R.ownLegs.on && R.ownLegs.mode === 'crouch'){ ok = 'Aim_Stand'; freeze = 0; } else { ok = 'Cautious_Crouch_Walk_Forward'; ts = clamp(fv / C.footV.crouch, 0.6, 1.6); } }   // (Z339 crouched on the move: rifle up, his own legs under him)
  else if(fv < C.gaitAt[0]){ if(R.ownLegs && R.ownLegs.on){ ok = 'Aim_Stand'; freeze = 0; } else { ok = 'Walk_Forward_While_Shooting'; ts = clamp(fv / C.footV.walk, 0.6, 1.8); } }   // (Z339 walking, his legs are his own: the rifle held steady over them)
  else if(fv < C.gaitAt[1]){ ok = 'Run_and_Shoot'; ts = clamp(fv / C.footV.run, 0.7, 1.6); }   // (Z304 thresholds for a man's real walk / run / sprint)
  else { ok = 'Rifle_Charge'; ts = clamp(fv / C.footV.charge, 0.7, 1.4); }
  { const SWc = swimClip(CV, R, dt, P, mounted); if(SWc){ ok = SWc; ts = R.swm.ts; freeze = null; } }   // SWIM 1 afloat: treading water / the stroke (game/swim.js)
  const BL = bladeClip(CV, R, G, dt, P, mounted);   // BLADE 2 the blade in his hands: his body plays the blade's own clips (actors/blade.js), the rifle's fade out
  blend(R.OA, BL ? '' : ok, ts, dt, freeze);
  if(R.HIT){ if(P.hit && !R.wasHit && !P.dead){ R.HIT.reset(); R.HIT.play(); R.hitW = 1; } R.wasHit = !!P.hit; R.hitW = Math.max(0, R.hitW - dt / C.hitT); R.HIT.setEffectiveWeight(R.hitW * C.hitK); }   // the flinch fades back into the clip
  // GRAPH 1 the player's soldier on his feet (ANIMGRAPH.on / ?animgraph): the motion graph has his hips and legs — it runs this mixer itself (the clip chosen above still
  //   poses his upper body), then lays its own over (actors/anim-graph.js). Off, or anyone else's soldier: the line below, as ever
  const GA = (ANIMGRAPH.on || ANIMGRAPH_STAT.live) && graphPose(CV, R, G, dt, P, mounted, ok);
  if(!GA) R.om.update(dt);
  // hips onto the seat (the riding clips carry their own hip height); feet on the ground on foot
  // Z299 sat on a ride, past a quarter turn he swings his hips round on the seat (slower than his shoulders) to bring the gun to bear behind him
  // Z303 WHERE HE LOOKS, CALMLY: the aim relative to the ride is unwrapped (no snapping from +180° to −180° as the target passes behind — he stays on the
  //   side he turned to until it is well past, `flip`), then swung toward at a human pace (`aimRate`): a ride whipping through a bend no longer spins him
  // Z340 TURNED ROUND IN THE SADDLE (horse or pillion, RIDER_TURN): hips swung on the seat and the chest twisted on them reach `max` (~170°) either way, so he
  //   can turn to shoot behind; the gap straight behind is beyond him — the aim there, he holds at the limit; once it is `flip` past the middle he swings
  //   back the long way round the front (faster, `swing`), never right round. On the horse his legs stay along its flanks as his hips turn.
  const seated = mounted && bike && !stand, braced = mounted && bike && stand, sat = mounted && !stand, RT = RIDER_TURN; if(R.opRY == null) R.opRY = R.op.rotation.y;
  const ready = (!mounted && !P.trans && fv > C.ready[0] && !S.firing && !CV.aimUp) || !!(P.trans && CV.trans && !CV.trans.crash && R.pup) || !!R.sprDev; R.rdy = (R.rdy || 0) + ((ready ? 1 : 0) - (R.rdy || 0)) * Math.min(1, dt * 5);
  { const spr = !mounted && !P.trans && fv > (C.carryAt ?? C.gaitAt[1]) && !S.firing && !(P.move && (P.move.roll >= 0 || P.move.air)); R.spr = (R.spr || 0) + (((R.sprDev ?? spr) ? 1 : 0) - (R.spr || 0)) * Math.min(1, dt * GUNFIT.carry.rate); }   // Z360 at a sprint: the gun across his chest (R.sprDev: the pose studio's)   // Z304 running and not shooting: eyes and muzzle where he runs
  const raw = (P.twist || 0) * (1 - R.rdy);
  R.tu = R.tu == null ? raw : R.tu + Math.atan2(Math.sin(raw - R.tu), Math.cos(raw - R.tu)); const TAU = Math.PI * 2;
  if(!braced){ const L = Math.PI + (sat ? RT.flip : C.flip); if(R.tu > L) R.tu -= TAU; else if(R.tu < -L) R.tu += TAU; }   // sat, he can't turn past his back: well past it, he comes round the front
  else if(Math.abs(R.tu) > TAU && R.av != null){ const w = Math.sign(R.tu) * TAU; R.tu -= w; R.av -= w; R.hy = (R.hy || 0) - w; if(R.step){ R.step.from -= w; R.step.to -= w; } }   // standing he can step right round: keep the numbers small
  const tgt = sat ? clamp(R.tu, -RT.max, RT.max) : R.tu, far = Math.abs(tgt - (R.av ?? tgt)), rate = sat ? C.aimRate + (RT.swing - C.aimRate) * clamp((far - 0.8) / 1.5, 0, 1) : mounted ? C.aimRate : XHAIR.aimRate;   // (Z376 on his feet the shoulders come round to the crosshair quickly)   // (a long way round: quicker)
  R.av = R.av == null ? tgt : R.av + clamp(tgt - R.av, -rate * dt, rate * dt); const twAll = R.av;
  // the body: sat, the hips swing round on the seat (slowly); standing in a bed, he turns his whole body by stepping round — a step at a time, feet moving
  if(braced){ const want = twAll; R.hy = R.hy || 0;   // (on his feet any way round, the short way · Z339 from 0: unset it made his whole body NaN)
    if(!R.step && Math.abs(want - (R.hy || 0)) > C.standTurn[1]){ R.step = { from:R.hy || 0, to:(R.hy || 0) + clamp(want - (R.hy || 0), -C.standTurn[2], C.standTurn[2]), t:0 }; }
    if(R.step){ R.step.t = Math.min(1, R.step.t + dt / C.standTurn[3]); R.hy = R.step.from + (R.step.to - R.step.from) * smooth(R.step.t); if(R.step.t >= 1) R.step = null; } }
  else { R.step = null; const hipMax = sat ? (bike ? C.seatTurn[1] : RT.hip) : 0, hyT = sat ? clamp(Math.sign(twAll) * Math.max(0, Math.abs(twAll) - C.seatTurn[0]), -hipMax, hipMax) : 0;
    R.hy = (R.hy || 0) + clamp((hyT - (R.hy || 0)) * Math.min(1, dt * C.seatTurn[2]), -C.hipRate * dt, C.hipRate * dt); }
  if(GA) R.hy = graphHipYaw(CV, R.hy);   // GRAPH 1 stood still his legs stay planted while the body turns over them (the chest's twist below takes it back)
  R.op.rotation.y = R.opRY + R.hy + (R.blYaw || 0);   // (BLADE 2 a spinning cut turns his whole body: the clip's own root yaw)
  R.op.position.set(0, 0, 0); G.updateWorldMatrix(true, false); R.op.updateMatrixWorld(true);
  if(mounted && !stand){ R.hips.getWorldPosition(_v); G.worldToLocal(_v); R.op.position.sub(_v); R.op.updateMatrixWorld(true); }
  else if(s === 'prone' && !P.trans){ R.op.position.y = -(GA && graphOwned(CV) ? ANIMGRAPH.prone.drop : C.proneDrop) / HUMAN_SCALE; R.op.updateMatrixWorld(true); }   // the clip lies a hand's breadth above the ground
  // the torso turns toward the aim (spread over three spine bones, about the body's up)
  const twLim = sat ? RT.max - (bike ? C.seatTurn[1] : RT.hip) : C.twistMax;   // (Z340 sat: the chest takes the rest of the turn)
  R.tw = (R.tw || 0) + clamp((clamp(twAll - R.hy, -twLim, twLim) - (R.tw || 0)) * Math.min(1, dt * C.seatTurn[3]), -C.twistRate * dt, C.twistRate * dt); const tw = R.tw;   // the shoulders follow the eyes, the hips follow the shoulders
  if(Math.abs(tw) > 1e-3){ G.getWorldQuaternion(_q); _up.set(0, 1, 0).applyQuaternion(_q);
    for(const b of R.spine){ if(!b) continue; b.parent.getWorldQuaternion(_qp); _qd.setFromAxisAngle(_up, tw / 3); _q.copy(_qp).invert().multiply(_qd).multiply(_qp); b.quaternion.premultiply(_q); b.updateMatrixWorld(true); } }
  if(sat && !bike && Math.abs(R.hy) > 1e-3){ R.legs = R.legs || ['LeftUpLeg', 'RightUpLeg'].map(n => R.op.getObjectByName('mixamorig' + n)); G.getWorldQuaternion(_q); _up.set(0, 1, 0).applyQuaternion(_q);   // Z340 his hips turn on the saddle, his thighs stay along the horse
    for(const b of R.legs){ if(!b) continue; b.parent.getWorldQuaternion(_qp); _qd.setFromAxisAngle(_up, -R.hy); _q.copy(_qp).invert().multiply(_qd).multiply(_qp); b.quaternion.premultiply(_q); b.updateMatrixWorld(true); } }
  if(R.pup){ R.pup.ground = !(mounted && !stand); drivePuppet(R.pup); bladePre(R); }   // (BLADE 2 the clip's pose as the puppet took it, kept for bladeHold)
  if(R.pup && !P.dead && mounted && bike && !stand && !P.trans) sitTall(R, G);   // Z304 sat up straight on the seat, not slumped over the gun
  if(R.pup && !P.dead && mounted && !stand && !P.trans) seatUpright(R, G, Math.abs(CV.speed || 0));   // Z348 the back straight, the chest out, on the horse and the pillion alike (actors/soldier-upper.js)
  if(R.pup && !P.dead) rideSway(R, G, dt, mounted ? P.ride : null, H);
  if(R.pup && !P.dead && bike) seatFeet(R, H, dt, mounted && !stand && !P.trans);   // Z302 his feet on the passenger pegs   // Z299 thrown forward under the brakes, back on the throttle, out in the bend, jolted by the road   // Z294 the second soldier takes the operator's pose (before the gun is put in his hands)
  if(R.pup && !P.dead && !bike && mounted && !P.trans) stirrupFeet(R, H);   // Z371 his feet in the stirrups, his legs out of the horse's barrel (actors/soldier-stirrups.js)
  R.H = H; R.seated = seated && !P.trans; R.sat = sat && !P.trans && !P.dead; R.bed = braced && !P.trans && !P.dead; if(!R.sat && !R.bed) R.gunYaw = null;   // (Z335 for the hold: the ride and its driver · Z340 in the saddle · Z391 standing in a bed: the trigger waits for the bore there too)
  if(GA && R.pup && !P.dead && graphFeet(CV, R, G, dt, P)){ /* GRAPH 1 the graph has his legs: its own foot lock, in place of the line below (actors/anim-graph.js) */ }
  else if(R.pup && !P.dead) soldierLegs(R, G, dt, P, mounted);   // Z339 his feet planted, stepping the way he goes (actors/soldier-legs.js)
  if(R.pup && !P.dead) soldierUpper(R, G, dt, P, mounted);   // Z343 shoulders, trunk, head and the rifle's weight in time with the legs (actors/soldier-upper.js)
  holdGun(R, G);   // Z295 the hand weapon for the gun in use
  if(R.pup && !P.dead && swimPose(CV, R, G, dt, P)){ steadyHead(R, dt); return; }   // SWIM 1 swimming: his arms are the stroke's, the rifle on his back (game/swim.js)
  const cw = R.pup && !P.dead ? climbW() : 0;   // Z451 on a wall: the rifle slung across his back, his hands on the face — eased off his hold and back into it
  if(cw >= 0.999 && climbArms(R, G, 1)){ steadyHead(R, dt); return; }
  if(R.pup && !P.dead && holdReal(R, G, dt, P)){ carryAfter(R, G, dt, P); bladeHold(CV, R, G, dt, P);   /* BLADE 2 the blade worn / in his fist, over the rifle's layers */ if(cw > 0.001) climbArms(R, G, cw); mountHand(R); steadyHead(R, dt); return; }   // (Z342 climbing on / off, the left hand takes hold of the ride · Z343 the head held steady)   // Z297 the special-forces soldier holds his weapon for real
  // the carbine: grip in the right palm, barrel through the left hand (or straight ahead when the left hand is off the gun), pushed back by the recoil
  R.rh.getWorldPosition(_a); if(R.rhm){ R.rhm.getWorldPosition(_b); _a.lerp(_b, 0.5); }
  (R.lhm || R.lh).getWorldPosition(_b); _d.subVectors(_b, _a); const span = _d.length();
  G.getWorldQuaternion(_q); _up.set(0, 1, 0).applyQuaternion(_q);
  if(span < 0.15 || span > 0.8){ _d.set(Math.sin(tw), -0.05, Math.cos(tw)).applyQuaternion(_q); }
  _d.normalize();
  { const h = Math.hypot(_d.x, _d.z), pt = clamp(Math.atan2(_d.y, h), -C.pitch[1], C.pitch[0]); if(h > 1e-4) _d.set(_d.x / h * Math.cos(pt), Math.sin(pt), _d.z / h * Math.cos(pt)); }   // keep the barrel near level
  _x.copy(_d).negate();                                            // model +X runs to the stock
  _y.copy(_up).addScaledVector(_x, -_up.dot(_x)).normalize(); _z.crossVectors(_x, _y);
  _m.makeBasis(_x, _y, _z); _qd.setFromRotationMatrix(_m);
  const sc = R.csc;
  _v.fromArray(C.carbine.grip).multiplyScalar(sc).applyQuaternion(_qd); _a.sub(_v).addScaledVector(_d, -(G.userData.kick || 0) * 0.05);
  _m.compose(_a, _qd, _s.set(sc, sc, sc)); _mi.copy(G.matrixWorld).invert(); _m.premultiply(_mi);
  _m.decompose(R.cb.position, R.cb.quaternion, R.cb.scale); }
