// actors/real-cav.js — Z248 THE REAL CAVALRY: the Meshy-generated war horse, operator and carbine dressed over the procedural horse and general. The procedural rigs keep running unseen (gait engine, hoof falls, positions, aim, recoil) and drive the real ones: the horse plays its library gaits (idle / walk / canter / sprint) blended by gait and paced by speed; the rider sits on the real horse's back bone and plays the riding clips (Text-to-Motion) or, on foot, rifle walk / run / charge / crouch-walk and frozen aim / kneel / prone frames, his torso twisting toward the aim; the carbine is laid between his hands every frame (grip in the right palm, barrel through the left hand) and carries the muzzle point. Nothing changes until every file has loaded; if one fails the procedural models stay.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { GUNHOLD, HUMAN_SCALE, INFGUN, REALCAV, XEOM, AIRAIM, AIRPOSE, RIDER_TURN } from '../../config.js';
import { PROFILE, S, curlHand, drivePuppet, heightAt, ik2, loadGLTF, makePuppet, rollHand, sfx, spawnPart, turnBone, airPitch, soldierLegs, soldierUpper, steadyHead, mountHand } from '../hub.js';

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
    m.position.sub(c); const turn = new THREE.Group(); turn.add(m); turn.rotation.y = g.muzzle > 0 ? -Math.PI / 2 : Math.PI / 2;   // muzzle → −X
    const wl = g.len / K, s = wl / L, w = new THREE.Group(); w.add(turn); w.scale.setScalar(s); w.position.set(C.carbine.grip[0] - g.grip * wl, C.carbine.grip[1] + 0.05 + (g.lift || 0) / K, 0); w.visible = false;
    m.traverse(o => { if(o.isMesh){ o.castShadow = true; o.frustumCulled = false; } }); cb.add(w); arms[k] = w; w.userData.muzzle = [w.position.x - wl / 2, w.position.y + 0.02, 0];
    // Z297 the same weapon at its true size in metres (muzzle −X, centred): the special-forces soldier holds this one, aimed, with his hands on it
    const m2 = gl.scene.clone(true); m2.position.sub(c); const t2 = new THREE.Group(); t2.add(m2); t2.rotation.y = turn.rotation.y; const met = new THREE.Group(); met.add(t2); met.scale.setScalar(g.len / L);
    const hold = new THREE.Group(); hold.add(met); hold.visible = false; hold.userData = { k, len:g.len, muzzle:[-g.len / 2, 0.02, 0] }; m2.traverse(o => { if(o.isMesh){ o.castShadow = true; o.frustumCulled = false; } });
    if(arms._G) arms._G.add(hold); (arms._metric || (arms._metric = {}))[k] = hold; }); }
function holdGun(R, G){ const p = S.player, id = p && p.guns && p.guns.length ? p.guns[p.gunIdx].id : 'rifle', want = R.arms[INFGUN.map[id]] ? INFGUN.map[id] : '_carbine';
  const met = R.pup && R.arms._metric && R.arms._metric[want], mode = met ? 'met' : 'cb';
  if(want === R.armK && mode === R.armMode) return; R.armK = want; R.armMode = mode; const u = G.userData;
  for(const [k, o] of Object.entries(R.arms)) if(o && o.isObject3D && k[0] !== '_' || k === '_carbine') o.visible = mode === 'cb' && k === want;
  for(const [k, o] of Object.entries(R.arms._metric || {})) o.visible = mode === 'met' && k === want;
  if(!u.muzzle) return; if(mode === 'met'){ met.add(u.muzzle); u.muzzle.position.fromArray(met.userData.muzzle); }
  else { R.cb.add(u.muzzle); u.muzzle.position.fromArray(want === '_carbine' ? REALCAV.carbine.muzzle : R.arms[want].userData.muzzle); } }
// Z297 THE SOLDIER'S HOLD: the gun first — its butt in his shoulder pocket (on top of the shoulder for the RPG, at the hip for the minigun and flamethrower),
//   its bore along where he aims (up / down to the target too) — then his hands onto it by IK: the right on the pistol grip, trigger finger along the guard,
//   the left under the handguard; fingers closed round both. Every shot kicks it STRAIGHT BACK along the bore with a little muzzle climb, a spring
//   brings it home, and his shoulders take the push.
const _gp = new THREE.Vector3(), _gq = new THREE.Quaternion(), _gx = new THREE.Vector3(), _gy = new THREE.Vector3(), _gz = new THREE.Vector3(), _gr = new THREE.Vector3(), _gu = new THREE.Vector3(), _gf = new THREE.Vector3(), _gt = new THREE.Vector3(), _gm = new THREE.Matrix4(), _gw = new THREE.Vector3();
function gunPoint(out, pts, len, o, q){ return out.set(pts[0] * len, pts[1], 0).applyQuaternion(q).add(o); }
function holdReal(R, G, dt, P){ const met = R.arms._metric && R.arms._metric[R.armK]; if(!met || !met.visible) return false; const H = GUNHOLD, g = H[R.armK] || H.ar, D = R.pup.D, p = S.player, len = met.userData.len;
  // recoil: a shot is a new fireAt; the impulse goes into a damped spring (back along the bore, muzzle up)
  const rc = R.rc || (R.rc = { z:0, zv:0, a:0, av:0, last:0 }); if(p && p.fireAt > rc.last + 1e-4){ if(rc.last) { rc.zv += g.kick[0] * H.k * 0.12; rc.av += g.kick[1] * H.k * 0.12; } rc.last = p.fireAt; }
  const c = 2 * Math.sqrt(H.k) * H.damp; for(const [x, v] of [['z', 'zv'], ['a', 'av']]){ rc[v] += (-H.k * rc[x] - c * rc[v]) * dt; rc[x] += rc[v] * dt; }
  const prone = !!(p && p.cav && !p.cav.mounted && p.cav.stance === 'prone');   // (Z326 lying flat he cannot lean back to an aircraft)
  // the body frame: up, and his facing turned by the aim twist
  G.getWorldQuaternion(_gq); _gu.set(0, 1, 0).applyQuaternion(_gq);
  _gf.set(0, 0, 1).applyQuaternion(_gq); const gy = Math.atan2(_gf.x, _gf.z), ay = p ? p.aimSmoothed : gy, dyw = R.av ?? Math.atan2(Math.sin(ay - gy), Math.cos(ay - gy));   // (Z303 the calmed, unwrapped aim: the gun never flips sides)
  const hy = R.hy || 0, chest = hy + (R.tw || 0), yaw = R.sat ? gy + chest + clamp(dyw - chest, -RIDER_TURN.lead, RIDER_TURN.lead) : gy + hy + clamp(dyw - hy, -1.15, 1.15); let pitch = 0;   // no further round than his shoulders (and, sat on a ride, his hips) can turn (Z340 in the saddle: where his chest is turned, the arms a little ahead)
  // the shoulders take the kick before the gun is laid in them
  _gr.set(Math.cos(yaw), 0, -Math.sin(yaw)); for(const n of ['Spine1', 'Spine2']) turnBone(D[n], _gr, -rc.a * H.body);   // (about his left: the kick rocks him back)
  // Z326 an aircraft above: he leans back from the waist, up the spine, so the butt stays in his shoulder as the muzzle climbs past its usual tip-up
  { let want = 0; if(D.RightArm){ D.RightArm.getWorldPosition(_gt); const a0 = airPitch(_gt.x, _gt.y, _gt.z); if(a0 != null && !prone) want = clamp((a0 - H.pitch[1]) * AIRPOSE.k, 0, AIRPOSE.max); }
    R.lean = (R.lean || 0) + (want - (R.lean || 0)) * Math.min(1, dt * AIRPOSE.rate); if(R.lean > 1e-3) ['Spine', 'Spine1', 'Spine2'].forEach((n, i) => turnBone(D[n], _gr, -R.lean * AIRPOSE.split[i])); }
  // Z298 reloading: how far through (0…1), only when the reload is long enough to show; the gun comes down and in for it, and back up at the end
  const inst = p && p.guns && p.guns[p.gunIdx], nowS = performance.now() / 1000, RL = H.reload;
  const rk = inst && inst.rU && inst.rD >= RL.min ? clamp(1 - (inst.rU - nowS) / inst.rD, 0, 1) : -1, low = rk < 0 ? 0 : smooth(Math.min(rk / 0.14, (1 - rk) / 0.12, 1));
  // the pocket the butt sits in
  const sh = D.RightArm, hip = D.RightUpLeg; if(!sh || !D.RightHand || !D.LeftHand) return false; _gf.set(Math.sin(yaw), 0, Math.cos(yaw)); _gr.set(-Math.cos(yaw), 0, Math.sin(yaw));   // ahead · his right
  if(g.hold === 'hip'){ hip.getWorldPosition(_gp); _gp.addScaledVector(_gu, 0.22).addScaledVector(_gf, 0.12).addScaledVector(_gr, 0.05); }
  else { sh.getWorldPosition(_gp); _gp.addScaledVector(_gr, -H.pocket[0]).addScaledVector(_gu, g.hold === 'top' ? 0.1 : H.pocket[1]).addScaledVector(_gf, H.pocket[2]); }
  overDriver(R, _gp, yaw);   // Z335 sat behind the driver, a gun laid forward goes over his shoulder, not into his back
  const MV = P && P.move, CR = REALCAV.cv; if(MV && MV.cover != null){ const want = MV.cover + CR.rest; if(_gp.y < want) _gp.y += Math.min(want - _gp.y, CR.restMax); }   // Z336 behind cover: the rifle laid on top of it
  if(R.gunLag) _gp.add(R.gunLag);   // Z343 the rifle's weight: it lags the chest a moment (actors/soldier-upper.js)
  const tuck = MV && MV.roll >= 0;   // Z336 going over in a roll: the rifle held in to the chest, along the body
  // where he aims: the pointer's ground point lifted to a man's chest, or straight ahead
  if(p && S.aimPoint && S.pointerActive){ const tx = S.aimPoint.x, tz = S.aimPoint.z, ty = heightAt(tx, tz) + 1.1, hd = Math.hypot(tx - _gp.x, tz - _gp.z); if(hd > 1.5) pitch = Math.atan2(ty - _gp.y, hd); }
  const airP = airPitch(_gp.x, _gp.y, _gp.z); if(airP != null) pitch = airP;   // Z313 laid on an aircraft: up to its height
  if(g.hold === 'hip') pitch *= 0.5; pitch = clamp(pitch, H.pitch[0], airP != null ? (prone ? AIRPOSE.prone : AIRAIM.manUp) : H.pitch[1]) + rc.a - low * RL.low - (R.rdy || 0) * REALCAV.ready[1]; const yw = yaw + low * RL.turn; R.gunYaw = yw;   // (Z304 running, not firing: the muzzle carried low · Z340 where the bore really points, for the trigger)
  if(low > 0){ _gp.addScaledVector(_gu, -0.07 * low).addScaledVector(_gr, -0.06 * low); }   // drawn down and in to the chest
  const ywS = yw + (R.gunSway ? R.gunSway.y : 0), ptS = pitch + (R.gunSway ? R.gunSway.p : 0);   // Z343 the muzzle's small figure of eight with the stride (looks only: the rounds go where he aims)
  _gx.set(Math.sin(ywS) * Math.cos(ptS), Math.sin(ptS), Math.cos(ywS) * Math.cos(ptS)).negate();   // the gun's +X runs back to the butt
  _gy.set(0, 1, 0).addScaledVector(_gx, -_gx.y).normalize();
  if(tuck){ _gx.set(0, 0, -1).applyQuaternion(_gq).addScaledVector(_gu, 0.6).normalize(); _gy.copy(_gu).addScaledVector(_gx, -_gu.dot(_gx)).normalize(); D.Spine2.getWorldPosition(_gp); _gp.addScaledVector(_gu, -0.05).addScaledVector(_gr, 0.12); } if(low > 0 && !g.back) _gy.applyAxisAngle(_gx, -RL.cant * low);   // canted: the mag well to his left hand
  _gz.crossVectors(_gx, _gy); _gm.makeBasis(_gx, _gy, _gz); _gq.setFromRotationMatrix(_gm);
  // butt into the pocket, then the whole gun pushed straight back by the kick
  gunPoint(_gt, g.butt, len, _gw.set(0, 0, 0), _gq); _gp.sub(_gt).addScaledVector(_gx, rc.z);
  _gm.compose(_gp, _gq, _gt.set(1, 1, 1)); _mi.copy(G.matrixWorld).invert(); _gm.premultiply(_mi); _gm.decompose(met.position, met.quaternion, met.scale); met.updateMatrixWorld(true);
  // hands onto it: the wrist just behind / above each contact, so the grip sits in the palm; elbows down (the right one out)
  const grip = gunPoint(new THREE.Vector3(), g.grip, len, _gp, _gq), fore = gunPoint(new THREE.Vector3(), g.fore, len, _gp, _gq);
  const wr = grip.clone().addScaledVector(_gy, 0.045).addScaledVector(_gx, 0.035); let wl = fore.clone().addScaledVector(_gy, -0.035).addScaledVector(_gx, 0.02).addScaledVector(_gz, g.hold === 'hip' ? 0 : 0.02), lc = 0.8;
  if(rk >= 0){ // the left hand's round: the mag out (it drops), a fresh one from the chest pouch (the RPG: a round from over the shoulder), in, the bolt racked, back to the handguard
    const mag = gunPoint(new THREE.Vector3(), g.mag || H.mag, len, _gp, _gq).addScaledVector(_gy, -0.04), bolt = gunPoint(new THREE.Vector3(), g.bolt || H.bolt, len, _gp, _gq).addScaledVector(_gy, 0.03);
    D.Spine2.getWorldPosition(_gt); const pouch = g.back ? _gt.clone().addScaledVector(_gu, 0.22).addScaledVector(_gf, -0.22).addScaledVector(_gr, -0.12) : _gt.clone().addScaledVector(_gf, 0.2).addScaledVector(_gr, -0.06).addScaledVector(_gu, -0.16);
    const K = g.back ? [[0, wl], [0.2, pouch], [0.42, pouch], [0.66, mag], [0.8, mag], [1, wl]] : [[0, wl], [0.17, mag], [0.27, mag], [0.44, pouch], [0.52, pouch], [0.68, mag], [0.75, mag.clone().addScaledVector(_gy, 0.03)], [0.83, bolt], [0.88, bolt.clone().addScaledVector(_gx, 0.06)], [1, wl]];
    for(let i = 0; i + 1 < K.length; i++){ const [t0, a] = K[i], [t1, b] = K[i + 1]; if(rk <= t1){ wl = a.clone().lerp(b, smooth((rk - t0) / Math.max(1e-3, t1 - t0))); break; } }
    lc = 0.55; if(!g.back && R.rlDrop !== inst.rU && rk >= RL.drop){ R.rlDrop = inst.rU; spawnPart(mag.x, mag.y - 0.05, mag.z, (Math.random() - 0.5) * 0.6, -0.4, (Math.random() - 0.5) * 0.6, { color:0x1e1f1c, size:0.16, life:1.1, grav:-14, drag:0.4 }); sfx('click'); }
    D.Neck && turnBone(D.Neck, _gr, -0.32 * low); }   // and he looks down at it (about his right: negative is down)
  sh.getWorldPosition(_gt); ik2(D.RightArm, D.RightForeArm, D.RightHand, wr, _gt.clone().addScaledVector(_gu, -0.45).addScaledVector(_gr, 0.3).addScaledVector(_gf, -0.1));
  D.LeftArm.getWorldPosition(_gt); ik2(D.LeftArm, D.LeftForeArm, D.LeftHand, wl, _gt.clone().addScaledVector(_gu, -0.5).addScaledVector(_gr, -0.15).addScaledVector(_gf, 0.15));
  rollHand(D, 'Right', _gt.copy(_gy).negate()); if(rk < 0) rollHand(D, 'Left', _gx);   // Z304 knuckles down the pistol grip; the support hand's along the handguard
  curlHand(D, 'Right', 0.85, grip, 0, 0.35); curlHand(D, 'Left', lc, rk >= 0 ? wl.clone().addScaledVector(_gy, -0.05) : fore.clone().addScaledVector(_gy, 0.02));
  // Z299 the head leads: the eyes are on the target before the shoulders get there, up / down to it, and held level when the ride banks and pitches
  const lead = clamp(dyw - hy - (R.tw || 0), -0.65, 0.65) * (1 - low);   // (_gu is still his up)
  turnBone(D.Neck, _gu, lead * 0.45); turnBone(D.Head, _gu, lead * 0.55);
  if(airP != null){ const up = Math.max(0, pitch * AIRPOSE.sight - (R.lean || 0) - rc.a) * (1 - low); turnBone(D.Neck, _gr, up * AIRPOSE.neck); turnBone(D.Head, _gr, up * (1 - AIRPOSE.neck)); }   // Z326 cheek to the stock: head and neck tip back to sight along the barrel
  else turnBone(D.Head, _gr, (pitch - rc.a) * 0.55 * (1 - low));
  if(D.Head){ _gt.crossVectors(_gu, _gw.set(0, 1, 0)); const sn = _gt.length(); if(sn > 1e-4) turnBone(D.Head, _gt.normalize(), Math.asin(Math.min(1, sn)) * 0.65); }
  return true; }
// Z335 OVER THE DRIVER'S SHOULDER: sat on the pillion behind the driver, a gun laid ahead (within fw of straight ahead, eased in) is carried at the height of the
//   driver's shoulder plus `up` — on it, not into his back or his head; turned to the side or behind there is nothing in the way and it sits in his own shoulder
const _od = new THREE.Vector3(), _oq = new THREE.Quaternion();
function overDriver(R, gp, yaw){ const Hh = R.H, D = Hh && Hh.drv, B = D && D.ok && D.state === 'ride' && D.B, C = REALCAV.overDrv; if(!B || !R.seated || !C) return;
  const ds = B.RightShoulder || B.RightArm; if(!ds) return; (Hh.body || Hh.B).getWorldQuaternion(_oq); _od.set(0, 0, 1).applyQuaternion(_oq);
  const c = _od.x * Math.sin(yaw) + _od.z * Math.cos(yaw), w = smooth((c - C.fw[0]) / (C.fw[1] - C.fw[0])); if(w <= 0) return;
  ds.getWorldPosition(_od); const need = _od.y + C.up - gp.y; if(need > 0) gp.y += need * w; }
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
  const two = !!(H && H.two), pT = I ? clamp(-I.acc * C.acc, -C.max, C.max) : 0, rT = I && !two ? clamp(I.lat * C.lat, -C.max, C.max) : 0, hT = I ? clamp(-I.vy * C.heave, -0.3, 0.3) : 0;
  const spr = (x, v, t, k, z) => v + (-k * (x - t) - 2 * z * Math.sqrt(k) * v) * dt;
  W.vp = spr(W.p, W.vp, pT, C.k, C.z); W.p += W.vp * dt; W.vr = spr(W.r, W.vr, rT, C.k, C.z); W.r += W.vr * dt; W.vh = spr(W.h, W.vh, hT, C.k * 1.8, C.z); W.h += W.vh * dt;
  if(!I && Math.abs(W.p) + Math.abs(W.r) + Math.abs(W.h) < 1e-3) return;
  G.getWorldQuaternion(_sq); _sr.set(-1, 0, 0).applyQuaternion(_sq); _sf.set(0, 0, 1).applyQuaternion(_sq);   // his right · ahead
  const sp = [['Spine', 0.45], ['Spine1', 0.33], ['Spine2', 0.22]]; for(const [n, f] of sp){ turnBone(D[n], _sr, -W.p * f); turnBone(D[n], _sf, W.r * f); }
  turnBone(D.Neck, _sr, -W.h); }
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
export function updateRealCav(CV, dt, P){
  const R = CV.real; if(!R || !dt) return; const H = CV.H, G = CV.G, C = REALCAV;
  // the horse
  const g = H.gait, v = Math.abs(H.v || 0), leap = H.air && H.air.y > 0.02 && R.HA && R.HA.Jump_Sprint, hk = leap ? 'Jump_Sprint' : g === 'idle' ? 'Idle' : g === 'walk' ? 'Walk' : (g === 'trot' || g === 'canter') ? 'Canter' : 'Sprint';   // (Z321 in mid-leap it jumps)
  if(leap && H.air.jumpNew){ H.air.jumpNew = false; R.HA.Jump_Sprint.time = 0; }   // (from take-off, played over just the time it is in the air)
  if(R.hm){ blend(R.HA, hk, hk === 'Idle' ? 1 : leap ? R.HA.Jump_Sprint.getClip().duration / (H.air.flight || 0.7) : clamp(v / C.horseV[hk], 0.6, 1.5), dt); R.hm.update(dt); }
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
  blend(R.OA, ok, ts, dt, freeze);
  if(R.HIT){ if(P.hit && !R.wasHit && !P.dead){ R.HIT.reset(); R.HIT.play(); R.hitW = 1; } R.wasHit = !!P.hit; R.hitW = Math.max(0, R.hitW - dt / C.hitT); R.HIT.setEffectiveWeight(R.hitW * C.hitK); }   // the flinch fades back into the clip
  R.om.update(dt);
  // hips onto the seat (the riding clips carry their own hip height); feet on the ground on foot
  // Z299 sat on a ride, past a quarter turn he swings his hips round on the seat (slower than his shoulders) to bring the gun to bear behind him
  // Z303 WHERE HE LOOKS, CALMLY: the aim relative to the ride is unwrapped (no snapping from +180° to −180° as the target passes behind — he stays on the
  //   side he turned to until it is well past, `flip`), then swung toward at a human pace (`aimRate`): a ride whipping through a bend no longer spins him
  // Z340 TURNED ROUND IN THE SADDLE (horse or pillion, RIDER_TURN): hips swung on the seat and the chest twisted on them reach `max` (~170°) either way, so he
  //   can turn to shoot behind; the gap straight behind is beyond him — the aim there, he holds at the limit; once it is `flip` past the middle he swings
  //   back the long way round the front (faster, `swing`), never right round. On the horse his legs stay along its flanks as his hips turn.
  const seated = mounted && bike && !stand, braced = mounted && bike && stand, sat = mounted && !stand, RT = RIDER_TURN; if(R.opRY == null) R.opRY = R.op.rotation.y;
  const ready = (!mounted && !P.trans && fv > C.ready[0] && !S.firing) || !!(P.trans && CV.trans && !CV.trans.crash && R.pup); R.rdy = (R.rdy || 0) + ((ready ? 1 : 0) - (R.rdy || 0)) * Math.min(1, dt * 5);   // Z304 running and not shooting: eyes and muzzle where he runs
  const raw = (P.twist || 0) * (1 - R.rdy);
  R.tu = R.tu == null ? raw : R.tu + Math.atan2(Math.sin(raw - R.tu), Math.cos(raw - R.tu)); const TAU = Math.PI * 2;
  if(!braced){ const L = Math.PI + (sat ? RT.flip : C.flip); if(R.tu > L) R.tu -= TAU; else if(R.tu < -L) R.tu += TAU; }   // sat, he can't turn past his back: well past it, he comes round the front
  else if(Math.abs(R.tu) > TAU && R.av != null){ const w = Math.sign(R.tu) * TAU; R.tu -= w; R.av -= w; R.hy = (R.hy || 0) - w; if(R.step){ R.step.from -= w; R.step.to -= w; } }   // standing he can step right round: keep the numbers small
  const tgt = sat ? clamp(R.tu, -RT.max, RT.max) : R.tu, far = Math.abs(tgt - (R.av ?? tgt)), rate = sat ? C.aimRate + (RT.swing - C.aimRate) * clamp((far - 0.8) / 1.5, 0, 1) : C.aimRate;   // (a long way round: quicker)
  R.av = R.av == null ? tgt : R.av + clamp(tgt - R.av, -rate * dt, rate * dt); const twAll = R.av;
  // the body: sat, the hips swing round on the seat (slowly); standing in a bed, he turns his whole body by stepping round — a step at a time, feet moving
  if(braced){ const want = twAll; R.hy = R.hy || 0;   // (on his feet any way round, the short way · Z339 from 0: unset it made his whole body NaN)
    if(!R.step && Math.abs(want - (R.hy || 0)) > C.standTurn[1]){ R.step = { from:R.hy || 0, to:(R.hy || 0) + clamp(want - (R.hy || 0), -C.standTurn[2], C.standTurn[2]), t:0 }; }
    if(R.step){ R.step.t = Math.min(1, R.step.t + dt / C.standTurn[3]); R.hy = R.step.from + (R.step.to - R.step.from) * smooth(R.step.t); if(R.step.t >= 1) R.step = null; } }
  else { R.step = null; const hipMax = sat ? (bike ? C.seatTurn[1] : RT.hip) : 0, hyT = sat ? clamp(Math.sign(twAll) * Math.max(0, Math.abs(twAll) - C.seatTurn[0]), -hipMax, hipMax) : 0;
    R.hy = (R.hy || 0) + clamp((hyT - (R.hy || 0)) * Math.min(1, dt * C.seatTurn[2]), -C.hipRate * dt, C.hipRate * dt); }
  R.op.rotation.y = R.opRY + R.hy;
  R.op.position.set(0, 0, 0); G.updateWorldMatrix(true, false); R.op.updateMatrixWorld(true);
  if(mounted && !stand){ R.hips.getWorldPosition(_v); G.worldToLocal(_v); R.op.position.sub(_v); R.op.updateMatrixWorld(true); }
  else if(s === 'prone' && !P.trans){ R.op.position.y = -C.proneDrop / HUMAN_SCALE; R.op.updateMatrixWorld(true); }   // the clip lies a hand's breadth above the ground
  // the torso turns toward the aim (spread over three spine bones, about the body's up)
  const twLim = sat ? RT.max - (bike ? C.seatTurn[1] : RT.hip) : C.twistMax;   // (Z340 sat: the chest takes the rest of the turn)
  R.tw = (R.tw || 0) + clamp((clamp(twAll - R.hy, -twLim, twLim) - (R.tw || 0)) * Math.min(1, dt * C.seatTurn[3]), -C.twistRate * dt, C.twistRate * dt); const tw = R.tw;   // the shoulders follow the eyes, the hips follow the shoulders
  if(Math.abs(tw) > 1e-3){ G.getWorldQuaternion(_q); _up.set(0, 1, 0).applyQuaternion(_q);
    for(const b of R.spine){ if(!b) continue; b.parent.getWorldQuaternion(_qp); _qd.setFromAxisAngle(_up, tw / 3); _q.copy(_qp).invert().multiply(_qd).multiply(_qp); b.quaternion.premultiply(_q); b.updateMatrixWorld(true); } }
  if(sat && !bike && Math.abs(R.hy) > 1e-3){ R.legs = R.legs || ['LeftUpLeg', 'RightUpLeg'].map(n => R.op.getObjectByName('mixamorig' + n)); G.getWorldQuaternion(_q); _up.set(0, 1, 0).applyQuaternion(_q);   // Z340 his hips turn on the saddle, his thighs stay along the horse
    for(const b of R.legs){ if(!b) continue; b.parent.getWorldQuaternion(_qp); _qd.setFromAxisAngle(_up, -R.hy); _q.copy(_qp).invert().multiply(_qd).multiply(_qp); b.quaternion.premultiply(_q); b.updateMatrixWorld(true); } }
  if(R.pup){ R.pup.ground = !(mounted && !stand); drivePuppet(R.pup); }
  if(R.pup && !P.dead && mounted && bike && !stand && !P.trans) sitTall(R, G);   // Z304 sat up straight on the seat, not slumped over the gun
  if(R.pup && !P.dead) rideSway(R, G, dt, mounted ? P.ride : null, H);
  if(R.pup && !P.dead && bike) seatFeet(R, H, dt, mounted && !stand && !P.trans);   // Z302 his feet on the passenger pegs   // Z299 thrown forward under the brakes, back on the throttle, out in the bend, jolted by the road   // Z294 the second soldier takes the operator's pose (before the gun is put in his hands)
  R.H = H; R.seated = seated && !P.trans; R.sat = sat && !P.trans && !P.dead; if(!R.sat) R.gunYaw = null;   // (Z335 for the hold: the ride and its driver · Z340 in the saddle)
  if(R.pup && !P.dead) soldierLegs(R, G, dt, P, mounted);   // Z339 his feet planted, stepping the way he goes (actors/soldier-legs.js)
  if(R.pup && !P.dead) soldierUpper(R, G, dt, P, mounted);   // Z343 shoulders, trunk, head and the rifle's weight in time with the legs (actors/soldier-upper.js)
  holdGun(R, G);   // Z295 the hand weapon for the gun in use
  if(R.pup && !P.dead && holdReal(R, G, dt, P)){ mountHand(R); steadyHead(R, dt); return; }   // (Z342 climbing on / off, the left hand takes hold of the ride · Z343 the head held steady)   // Z297 the special-forces soldier holds his weapon for real
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
