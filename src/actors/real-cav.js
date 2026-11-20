// actors/real-cav.js — Z248 THE REAL CAVALRY: the Meshy-generated war horse, operator and carbine dressed over the procedural horse and general. The procedural rigs keep running unseen (gait engine, hoof falls, positions, aim, recoil) and drive the real ones: the horse plays its library gaits (idle / walk / canter / sprint) blended by gait and paced by speed; the rider sits on the real horse's back bone and plays the riding clips (Text-to-Motion) or, on foot, rifle walk / run / charge / crouch-walk and frozen aim / kneel / prone frames, his torso twisting toward the aim; the carbine is laid between his hands every frame (grip in the right palm, barrel through the left hand) and carries the muzzle point. Nothing changes until every file has loaded; if one fails the procedural models stay.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { HUMAN_SCALE, REALCAV } from '../../config.js';
import { loadGLTF } from '../hub.js';

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
export function fitRealCav(CV){
  if(CV.realP) return CV.realP;
  return (CV.realP = Promise.all(['horse', 'operator', 'rideGallop', 'rideWalk', 'carbine'].map(loadGLTF)).then(L => {
    if(L.some(x => !x) || !CV.H || !CV.G) return false;
    const [hg, og, rg, rw, cg] = L, H = CV.H, G = CV.G, u = G.userData, C = REALCAV;
    // ---- the horse: the real body on the procedural root (it cancels the root's size), the seat a node on its back bone
    const hr = skClone(hg.scene), K = H.root.scale.x || 1; hr.name = 'realHorse'; hr.scale.setScalar(1 / K);
    hr.traverse(o => { if(o.isSkinnedMesh) o.frustumCulled = false; });
    const seat = new THREE.Object3D(); seat.name = 'realSeat'; seat.position.fromArray(C.seat); hr.add(seat); hr.updateMatrixWorld(true);
    const sb = hr.getObjectByName(C.seatBone); if(sb) sb.attach(seat);
    H.root.traverse(o => { if(o.isMesh && !under(o, G)) o.visible = false; });
    H.root.add(hr);
    const hm = new THREE.AnimationMixer(hr), HA = actions(hm, hg.animations.map(c => inPlace(c, 'root.position')), n => n.replace(/^horse_/, ''));
    // ---- the operator inside the general's rig group (its scale cancelled to metres), every procedural mesh hidden
    const op = skClone(og.scene); op.name = 'realOp'; op.scale.setScalar(C.opH / 1.88 / HUMAN_SCALE);
    op.traverse(o => { if(o.isSkinnedMesh) o.frustumCulled = false; });
    G.traverse(o => { if(o.isMesh) o.visible = false; });
    G.add(op);
    const clips = [...og.animations, ...rg.animations, ...rw.animations].map(c => inPlace(c, 'mixamorigHips.position')), byName = n => clips.find(c => c.name === n);
    // the standing aim: the shouldered rifle of the walk-and-fire clip over the square stance of the standing reload (one held frame)
    const UP = /Spine|Neck|Head|Shoulder|Arm|Hand/;
    clips.push(poseClip('Aim_Stand', [[byName('Walk_Forward_While_Shooting'), 0.1, t => UP.test(t.name)], [byName('Standing_Reload'), 0, t => !UP.test(t.name)]]));
    const om = new THREE.AnimationMixer(op), OA = actions(om, clips);
    // Z254 a hit: the upper body of the gunshot-reaction clip laid over whatever he is doing (legs stay in the saddle / on the ground)
    const hitClip = byName('Gunshot_Reaction'), HIT = hitClip ? om.clipAction(new THREE.AnimationClip('Hit_Upper', hitClip.duration, hitClip.tracks.filter(t => UP.test(t.name)))) : null;
    if(HIT){ HIT.setLoop(THREE.LoopOnce, 1); HIT.clampWhenFinished = true; HIT.enabled = true; HIT.setEffectiveWeight(0); HIT.play(); }
    const bone = n => op.getObjectByName('mixamorig' + n);
    // ---- the carbine: laid between the hands each frame; the game's muzzle point moves onto its muzzle
    const cb = cg.scene.clone(true); cb.name = 'realCarbine'; G.add(cb);
    if(u.muzzle){ cb.add(u.muzzle); u.muzzle.position.fromArray(C.carbine.muzzle); }
    CV.real = { hr, hm, HA, seat, op, om, OA, HIT, hitW:0, wasHit:false, deadOn:false, cb, csc: C.carbine.len / 0.954,
      hips: bone('Hips'), spine: ['Spine', 'Spine1', 'Spine2'].map(bone), rh: bone('RightHand'), rhm: bone('RightHandMiddle1'), lh: bone('LeftHand'), lhm: bone('LeftHandMiddle1') };
    u.realOp = op;
    return true; })); }

// P = { twist (aim − facing, rad), footV (m/s on foot), stance ('stand' | 'crouch' | 'prone'), trans (getting on / off), hit (he was just struck), dead }
export function updateRealCav(CV, dt, P){
  const R = CV.real; if(!R || !dt) return; const H = CV.H, G = CV.G, C = REALCAV;
  // the horse
  const g = H.gait, v = Math.abs(H.v || 0), hk = g === 'idle' ? 'Idle' : g === 'walk' ? 'Walk' : (g === 'trot' || g === 'canter') ? 'Canter' : 'Sprint';
  blend(R.HA, hk, hk === 'Idle' ? 1 : clamp(v / C.horseV[hk], 0.6, 1.5), dt); R.hm.update(dt);
  // the rider: on the real horse's back while mounted (every mount / respawn puts the rig on the procedural body bone — move it to the seat)
  if(G.parent === H.B){ R.seat.add(G); G.rotation.set(0, 0, 0); }
  const mounted = G.parent === R.seat;
  if(mounted){ G.position.set(0, 0, 0); G.scale.setScalar(HUMAN_SCALE); }
  let ok, ts = 1, freeze = null; const fv = P.footV || 0, s = P.stance;
  if(P.dead && !R.deadOn){ R.deadOn = true; const a = R.OA.dying_backwards; if(a){ a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } }   // Z254 killed: falls backwards, once
  if(!P.dead && R.deadOn){ R.deadOn = false; const a = R.OA.dying_backwards; if(a){ a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; } }
  if(P.dead && R.OA.dying_backwards){ ok = 'dying_backwards'; ts = 1; }
  else if(mounted){ ok = (g === 'gallop' || g === 'canter') ? 'Ride_Gallop' : 'Ride_Walk'; ts = g === 'idle' ? 0.45 : 1; }
  else if(P.trans || s === 'stand' && fv < 0.3){ ok = 'Aim_Stand'; freeze = 0; }   // the rifle shouldered, feet square
  else if(s === 'prone'){ ok = 'Prone_Reload'; if(fv < 0.2) freeze = 0; else ts = 0.7; }
  else if(s === 'crouch'){ if(fv < 0.3){ ok = 'Kneeling_Reload'; freeze = 0; } else { ok = 'Cautious_Crouch_Walk_Forward'; ts = clamp(fv / C.footV.crouch, 0.6, 1.6); } }
  else if(fv < 1.8){ ok = 'Walk_Forward_While_Shooting'; ts = clamp(fv / C.footV.walk, 0.6, 1.8); }
  else if(fv < 3.2){ ok = 'Run_and_Shoot'; ts = clamp(fv / C.footV.run, 0.7, 1.6); }
  else { ok = 'Rifle_Charge'; ts = clamp(fv / C.footV.charge, 0.7, 1.4); }
  blend(R.OA, ok, ts, dt, freeze);
  if(R.HIT){ if(P.hit && !R.wasHit && !P.dead){ R.HIT.reset(); R.HIT.play(); R.hitW = 1; } R.wasHit = !!P.hit; R.hitW = Math.max(0, R.hitW - dt / C.hitT); R.HIT.setEffectiveWeight(R.hitW * C.hitK); }   // the flinch fades back into the clip
  R.om.update(dt);
  // hips onto the seat (the riding clips carry their own hip height); feet on the ground on foot
  R.op.position.set(0, 0, 0); G.updateWorldMatrix(true, false); R.op.updateMatrixWorld(true);
  if(mounted){ R.hips.getWorldPosition(_v); G.worldToLocal(_v); R.op.position.sub(_v); R.op.updateMatrixWorld(true); }
  else if(s === 'prone' && !P.trans){ R.op.position.y = -C.proneDrop / HUMAN_SCALE; R.op.updateMatrixWorld(true); }   // the clip lies a hand's breadth above the ground
  // the torso turns toward the aim (spread over three spine bones, about the body's up)
  const tw = clamp(P.twist || 0, -C.twistMax, C.twistMax);
  if(Math.abs(tw) > 1e-3){ G.getWorldQuaternion(_q); _up.set(0, 1, 0).applyQuaternion(_q);
    for(const b of R.spine){ if(!b) continue; b.parent.getWorldQuaternion(_qp); _qd.setFromAxisAngle(_up, tw / 3); _q.copy(_qp).invert().multiply(_qd).multiply(_qp); b.quaternion.premultiply(_q); b.updateMatrixWorld(true); } }
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
