// actors/real-cav.js — Z248 THE REAL CAVALRY: the Meshy-generated war horse, operator and carbine dressed over the procedural horse and general. The procedural rigs keep running unseen (gait engine, hoof falls, positions, aim, recoil) and drive the real ones: the horse plays its library gaits (idle / walk / canter / sprint) blended by gait and paced by speed; the rider sits on the real horse's back bone and plays the riding clips (Text-to-Motion) or, on foot, rifle walk / run / charge / crouch-walk and frozen aim / kneel / prone frames, his torso twisting toward the aim; the carbine is laid between his hands every frame (grip in the right palm, barrel through the left hand) and carries the muzzle point. Nothing changes until every file has loaded; if one fails the procedural models stay.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { GUNHOLD, HUMAN_SCALE, INFGUN, REALCAV, XEOM } from '../../config.js';
import { PROFILE, S, curlHand, drivePuppet, heightAt, ik2, loadGLTF, makePuppet, turnBone } from '../hub.js';

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qd = new THREE.Quaternion(), _m = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _s = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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
  // the body frame: up, and his facing turned by the aim twist
  G.getWorldQuaternion(_gq); _gu.set(0, 1, 0).applyQuaternion(_gq);
  _gf.set(0, 0, 1).applyQuaternion(_gq); const gy = Math.atan2(_gf.x, _gf.z), ay = p ? p.aimSmoothed : gy, dyw = Math.atan2(Math.sin(ay - gy), Math.cos(ay - gy));
  const yaw = gy + clamp(dyw, -1.15, 1.15); let pitch = 0;   // no further round than his shoulders can turn
  // the shoulders take the kick before the gun is laid in them
  _gr.set(Math.cos(yaw), 0, -Math.sin(yaw)); for(const n of ['Spine1', 'Spine2']) turnBone(D[n], _gr, -rc.a * H.body);
  // the pocket the butt sits in
  const sh = D.RightArm, hip = D.RightUpLeg; if(!sh || !D.RightHand || !D.LeftHand) return false; _gf.set(Math.sin(yaw), 0, Math.cos(yaw)); _gr.set(-Math.cos(yaw), 0, Math.sin(yaw));   // ahead · his right
  if(g.hold === 'hip'){ hip.getWorldPosition(_gp); _gp.addScaledVector(_gu, 0.22).addScaledVector(_gf, 0.12).addScaledVector(_gr, 0.05); }
  else { sh.getWorldPosition(_gp); _gp.addScaledVector(_gr, -H.pocket[0]).addScaledVector(_gu, g.hold === 'top' ? 0.1 : H.pocket[1]).addScaledVector(_gf, H.pocket[2]); }
  // where he aims: the pointer's ground point lifted to a man's chest, or straight ahead
  if(p && S.aimPoint && S.pointerActive){ const tx = S.aimPoint.x, tz = S.aimPoint.z, ty = heightAt(tx, tz) + 1.1, hd = Math.hypot(tx - _gp.x, tz - _gp.z); if(hd > 1.5) pitch = Math.atan2(ty - _gp.y, hd); }
  if(g.hold === 'hip') pitch *= 0.5; pitch = clamp(pitch, H.pitch[0], H.pitch[1]) + rc.a;
  _gx.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).negate();   // the gun's +X runs back to the butt
  _gy.set(0, 1, 0).addScaledVector(_gx, -_gx.y).normalize(); _gz.crossVectors(_gx, _gy); _gm.makeBasis(_gx, _gy, _gz); _gq.setFromRotationMatrix(_gm);
  // butt into the pocket, then the whole gun pushed straight back by the kick
  gunPoint(_gt, g.butt, len, _gw.set(0, 0, 0), _gq); _gp.sub(_gt).addScaledVector(_gx, rc.z);
  _gm.compose(_gp, _gq, _gt.set(1, 1, 1)); _mi.copy(G.matrixWorld).invert(); _gm.premultiply(_mi); _gm.decompose(met.position, met.quaternion, met.scale); met.updateMatrixWorld(true);
  // hands onto it: the wrist just behind / above each contact, so the grip sits in the palm; elbows down (the right one out)
  const grip = gunPoint(new THREE.Vector3(), g.grip, len, _gp, _gq), fore = gunPoint(new THREE.Vector3(), g.fore, len, _gp, _gq);
  const wr = grip.clone().addScaledVector(_gy, 0.045).addScaledVector(_gx, 0.035), wl = fore.clone().addScaledVector(_gy, -0.035).addScaledVector(_gx, 0.02).addScaledVector(_gz, g.hold === 'hip' ? 0 : 0.02);
  sh.getWorldPosition(_gt); ik2(D.RightArm, D.RightForeArm, D.RightHand, wr, _gt.clone().addScaledVector(_gu, -0.45).addScaledVector(_gr, 0.3).addScaledVector(_gf, -0.1));
  D.LeftArm.getWorldPosition(_gt); ik2(D.LeftArm, D.LeftForeArm, D.LeftHand, wl, _gt.clone().addScaledVector(_gu, -0.5).addScaledVector(_gr, -0.15).addScaledVector(_gf, 0.15));
  curlHand(D, 'Right', 0.85, grip, 0, 0.35); curlHand(D, 'Left', 0.8, fore.clone().addScaledVector(_gy, 0.02));
  return true; }
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
    let pup = null; if(sg && C.s2.on && (PROFILE.trooper || 's2') === 's2'){ const sw = new THREE.Group(), s2 = skClone(sg.scene); sw.name = 'realS2'; sw.rotation.y = C.s2.yaw; sw.scale.setScalar(C.opH / HUMAN_SCALE);
      s2.traverse(o => { if(o.isSkinnedMesh){ o.frustumCulled = false; o.castShadow = true; } }); sw.add(s2); G.add(sw); G.updateMatrixWorld(true); pup = makePuppet(op, s2);
      if(pup) op.traverse(o => { if(o.isMesh) o.visible = false; }); else G.remove(sw); }
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
  const g = H.gait, v = Math.abs(H.v || 0), hk = g === 'idle' ? 'Idle' : g === 'walk' ? 'Walk' : (g === 'trot' || g === 'canter') ? 'Canter' : 'Sprint';
  if(R.hm){ blend(R.HA, hk, hk === 'Idle' ? 1 : clamp(v / C.horseV[hk], 0.6, 1.5), dt); R.hm.update(dt); }
  // the rider: on the real horse's back while mounted (every mount / respawn puts the rig on the procedural body bone — move it to the seat)
  const bike = H.bike, stand = bike && XEOM[bike].pose === 'stand';   // Z293 on a war ride he keeps the ride's own seat (seatRider): sat on it, or standing in the bed
  if(!bike && G.parent === H.B){ R.seat.add(G); G.rotation.set(0, 0, 0); }
  const mounted = bike ? G.parent === H.B : G.parent === R.seat;
  if(mounted && !bike){ G.position.set(0, 0, 0); G.scale.setScalar(HUMAN_SCALE); }
  let ok, ts = 1, freeze = null; const fv = P.footV || 0, s = P.stance;
  if(P.dead && !R.deadOn){ R.deadOn = true; const a = R.OA.dying_backwards; if(a){ a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } }   // Z254 killed: falls backwards, once
  if(!P.dead && R.deadOn){ R.deadOn = false; const a = R.OA.dying_backwards; if(a){ a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; } }
  if(P.dead && R.OA.dying_backwards){ ok = 'dying_backwards'; ts = 1; }
  else if(P.trans && P.trans.k === 'off'){ if(P.trans.e < 0.55){ ok = 'Cautious_Crouch_Walk_Forward'; ts = 1.3; } else { ok = 'Kneeling_Aim'; freeze = 0; } }   // Z295 getting off: a crouched step down, landing on one knee, rifle up
  else if(P.trans && P.trans.k === 'on'){ if(P.trans.e < 0.45){ ok = 'Walk_Forward_While_Shooting'; ts = 1.1; } else { ok = 'Kneeling_Aim'; freeze = 0; } }   // getting on: a step to it, then gathered up onto the seat
  else if(mounted && stand){ ok = 'Aim_Stand'; freeze = 0; }   // braced in the bed, rifle shouldered
  else if(mounted && bike){ ok = 'Ride_Walk'; ts = 0.35; }   // sat on the pillion / the cyclo's bench: the gentle sway of the riding clip
  else if(mounted){ ok = (g === 'gallop' || g === 'canter') ? 'Ride_Gallop' : 'Ride_Walk'; ts = g === 'idle' ? 0.45 : 1; }
  else if(P.trans || s === 'stand' && fv < 0.3){ ok = 'Aim_Stand'; freeze = 0; }   // the rifle shouldered, feet square
  else if(s === 'prone'){ ok = 'Prone_Reload'; if(fv < 0.2) freeze = 0; else ts = 0.7; }
  else if(s === 'crouch'){ if(fv < 0.3){ ok = 'Kneeling_Aim'; freeze = 0; } else { ok = 'Cautious_Crouch_Walk_Forward'; ts = clamp(fv / C.footV.crouch, 0.6, 1.6); } }
  else if(fv < 1.8){ ok = 'Walk_Forward_While_Shooting'; ts = clamp(fv / C.footV.walk, 0.6, 1.8); }
  else if(fv < 3.2){ ok = 'Run_and_Shoot'; ts = clamp(fv / C.footV.run, 0.7, 1.6); }
  else { ok = 'Rifle_Charge'; ts = clamp(fv / C.footV.charge, 0.7, 1.4); }
  blend(R.OA, ok, ts, dt, freeze);
  if(R.HIT){ if(P.hit && !R.wasHit && !P.dead){ R.HIT.reset(); R.HIT.play(); R.hitW = 1; } R.wasHit = !!P.hit; R.hitW = Math.max(0, R.hitW - dt / C.hitT); R.HIT.setEffectiveWeight(R.hitW * C.hitK); }   // the flinch fades back into the clip
  R.om.update(dt);
  // hips onto the seat (the riding clips carry their own hip height); feet on the ground on foot
  R.op.position.set(0, 0, 0); G.updateWorldMatrix(true, false); R.op.updateMatrixWorld(true);
  if(mounted && !stand){ R.hips.getWorldPosition(_v); G.worldToLocal(_v); R.op.position.sub(_v); R.op.updateMatrixWorld(true); }
  else if(s === 'prone' && !P.trans){ R.op.position.y = -C.proneDrop / HUMAN_SCALE; R.op.updateMatrixWorld(true); }   // the clip lies a hand's breadth above the ground
  // the torso turns toward the aim (spread over three spine bones, about the body's up)
  const tw = clamp(P.twist || 0, -C.twistMax, C.twistMax);
  if(Math.abs(tw) > 1e-3){ G.getWorldQuaternion(_q); _up.set(0, 1, 0).applyQuaternion(_q);
    for(const b of R.spine){ if(!b) continue; b.parent.getWorldQuaternion(_qp); _qd.setFromAxisAngle(_up, tw / 3); _q.copy(_qp).invert().multiply(_qd).multiply(_qp); b.quaternion.premultiply(_q); b.updateMatrixWorld(true); } }
  if(R.pup){ R.pup.ground = !(mounted && !stand); drivePuppet(R.pup); }   // Z294 the second soldier takes the operator's pose (before the gun is put in his hands)
  holdGun(R, G);   // Z295 the hand weapon for the gun in use
  if(R.pup && !P.dead && holdReal(R, G, dt, P)) return;   // Z297 the special-forces soldier holds his weapon for real
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
