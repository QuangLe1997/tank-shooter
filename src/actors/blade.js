// actors/blade.js — BLADE 2 THE WUXIA BLADE (config BLADE; ?noblade: none of it runs). The soldier always owns ONE ancient blade (PROFILE.blade: the long-shafted
//   guandao or the two-handed dadao). ONE thing in his hands, ONE on his back: with the rifle in his hands the blade is WORN — hung rigid on the Spine1 bone in the back's
//   own frame (the guandao blade up above his right shoulder, butt by the left hip; the dadao hilt up over the right shoulder), no cost a frame; with the blade in his hands
//   the rifle is slung by CARRY (actors/gun-carry.js why = 'blade', the quick sling).
//   THE BODY. In blade mode his whole body plays the blade's own library clips (assets/anim blade group: the axe pack for the pole, the great-sword pack for the dadao) on
//   the operator's mixer — a stance / walk / run set blended by his pace and heading, a guard, and ONE move at a time (cross-faded) — while the rifle's own pipeline (legs,
//   upper body, the hold, the carry) runs on underneath untouched: bladePre keeps the clip's pose as the puppet took it, bladeHold lays it back over what the rifle's layers
//   made, by the blade's weight (so the change of weapon is one smooth blend and nothing of GUN / CARRY / POSE is altered when the weight is 0).
//   THE HOLD. The weapon is laid in the main (right) fist every frame from the hand's own bones — the handle across the palm along the knuckle line (blade out of the thumb
//   side), its edge the way the knuckles face; a pole (two:true) lies along the line through BOTH palms — then the other hand is put on its stretch of the handle by two-bone IK
//   (hands.js ik2), turned round the shaft, and both fists closed on it (curlHand).
//   DRAW / SHEATH (BLADE.draw / sheath s): the right hand reaches over the shoulder to the grip where it hangs, takes it, and brings it down into the guard as the body
//   blends into the stance; the trigger held meanwhile is kept (the first cut starts the moment the blade is in hand).
//   THE FIGHT (the page's own soldier): fire = the light chain (buffered), held = the heavy, at a sprint = the running attack, the skill key = the special (cooldown), the
//   reload key / right button held = the guard (fire from it = the counter); AUTO draws and cuts when he fires with an enemy at arm's length and goes back to the rifle by
//   itself. A move's hit windows sweep a bearing arc: every enemy inside reach × the part of the arc already swept × the height band is cut once a swing (one line-of-sight
//   test per man per swing) — damage, stagger and knock-back along the cut, hit-stop, camera kick, blood or sparks, cover chipped. Root travel and step-ins go through his
//   own velocity (the game's collision moves him). One ribbon follows the tip and mid-blade through the windows.
//   Hooks: real-cav (bladeClip before the mixer's blend, bladePre after the puppet, bladeHold after the carry, R.blYaw), gun-carry why(), cavalry (bladeFoot, bladeTick),
//   soldier-fire (bladeFire), flame.js selectGun / cycleGun (bladeSelect / bladeCycle), spells trySpell (bladeSpecial), player-damage (bladeGuardK), bindings ('blade').
//   Nothing allocates per frame.
import * as THREE from 'three';
import { BLADE, CAV, REALCAV } from '../../config.js';
import { CV, MOBILE, PROFILE, RDRAG, S, animClip, animInfo, animRootAt, bloodSpurt, blocksNear, climbing, curlHand, damageBlock, damageEnemy, enemies, floatText, fpvFlying, heightAt, heldAction, ik2, lineClear, loadAnimGroup, loadGLTF, saveProfile, scene, selectGun, sfx, spawnPart } from '../hub.js';

const V3 = () => new THREE.Vector3(), Q4 = () => new THREE.Quaternion(), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), D2R = Math.PI / 180;
const _a = V3(), _b = V3(), _c = V3(), _d = V3(), _k = V3(), _m = V3(), _n = V3(), _x = V3(), _y = V3(), _z = V3(), _p = V3(), _t = V3(), _u = V3(), _r = V3(), _bk = V3(), _ws = V3(), _one = V3();
const _hp = V3(), _hz = V3(), _hy = V3(), _wp = V3(), _op = V3(), _pl = V3(), _tip = V3(), _mid = V3(), _q = Q4(), _q2 = Q4(), _hq = Q4(), _wq = Q4(), _oq = Q4(), _mat = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _root = [0, 0, 0], _root0 = [0, 0, 0], _bn = [];
const _tg = new Float32Array(8);

// ---- the page's own soldier: what he is doing with it ----
//   held: the blade is (to be) in his hands · auto: AUTO drew it · sw: 0 on his back … 1 in his hands (the rig's weight, mirrored) · act: the move in hand
//   { mv, t (clip s), rate, dmgK, f0 (the bearing it is aimed along), wi (the window he is in), hit (who it has cut) } · chain: the next light · buf: the move asked for
export const BLADEST = { kind:null, held:false, auto:false, sw:0, act:null, chain:0, chainAt:-9, buf:null, bufAt:0, trigF:-9, down:false, pressT:0, heavied:false, st:BLADE.stamina.max, stAt:-9, spAt:0, guard:false,
  nearAt:0, killAt:-9, flDone:true, frame:0, hits:0, kills:0, swings:0, firstHit:-1, drawAt:-9, ready:{}, tipV:0 };
const ACT = { mv:null, what:'', t:0, rate:1, dmgK:1, f0:0, rk:1, wi:-1, hit:new Set(), lunge:0, lx:0, lz:0 };
export const bladeKind = () => BLADE.kinds[PROFILE.blade] ? PROFILE.blade : BLADE.def;
export const bladeHeld = cv => !!BLADE.on && (!cv || cv === CV ? BLADEST.held : !!cv.blade);
const bodyK = () => REALCAV.opH * (REALCAV.s2 && REALCAV.s2.on ? REALCAV.s2.k || 1 : 1) / 1.8;   // his metres → the world's (his height over 1.8 m)
const rootK = () => REALCAV.opH / 1.88 * (REALCAV.s2 && REALCAV.s2.on ? REALCAV.s2.k || 1 : 1);   // the library's root travel (the operator's own scale) → the world
const afoot = () => { const p = S.player; return !!(p && !p.downed && !CV.mounted && !CV.trans && !CV.dead); };
function load(k){ const B = BLADEST; if(B.ready[k] !== undefined) return; B.ready[k] = false; Promise.all([loadGLTF(BLADE.kinds[k].file), loadAnimGroup('blade')]).then(([gl, ok]) => { B.ready[k] = gl && ok ? gl : null; }).catch(() => { B.ready[k] = null; }); }

// ---- a rig's own state (the other player's soldier has his): the mesh, its weight, the clips' actions, the pose kept, the worn slot ----
function rigState(R){ const k = R.cvBlade || bladeKind(); let L = R.bl; if(L && L.k === k) return L; if(L){ for(const a of L.A.values()) if(a) a.setEffectiveWeight(0); if(L.m && L.m.parent) L.m.parent.remove(L.m); }
  const S0 = BLADE.kinds[k].set; L = R.bl = { k, K:BLADE.kinds[k], m:null, w:0, bw:0, A:new Map(), ph:0, ids:null, zl:V3(), zOk:false, ey:V3(), tp:V3(), tpOk:false, bwt:new Float32Array(8), mv:[{ id:null, t:0, w:0 }, { id:null, t:0, w:0 }], yaw:0, bones:null, snap:null, hips:V3(), seated:false, pr:-1, sp:V3(), sq:Q4(), sk:1, }; L.ids = [S0.idle, S0.guard, S0.walk[0], S0.walk[1], S0.walk[2], S0.walk[3], S0.run[0], S0.run[1]]; load(k); return L; }
function mesh(R, L){ if(L.m) return true; const gl = BLADEST.ready[L.k]; if(!gl) return false; const m = gl.scene.clone(true); m.name = 'blade_' + L.k; m.traverse(o => { if(o.isMesh){ o.castShadow = true; o.frustumCulled = false; } }); L.m = m;
  const D = R.pup.D; L.bones = Object.values(D).filter(b => b && b.isBone); L.snap = new Float32Array(L.bones.length * 4); return true; }
function action(R, L, id){ let a = L.A.get(id); if(a !== undefined) return a; const clip = animClip(id); a = clip ? R.om.clipAction(clip) : null; if(a){ a.enabled = true; a.setEffectiveWeight(0); a.timeScale = 0; a.play(); } L.A.set(id, a); return a; }

// the weapon worn: hung on Spine1 in the back's own frame (as CARRY builds it: origin at the Spine2 joint, up = Spine1 → Spine2, his right = collar bone → collar bone at
//   rest, their cross out of his back); worked out when it changes — nothing a frame
function seat(R, L, prone){ const D = R.pup.D, b = D.Spine1, W = L.K.worn, q2 = R.pup.rest && R.pup.rest.get(D.Spine2) || D.Spine2.quaternion, ks = bodyK(); if(!b || !D.Spine2 || !D.RightShoulder || !D.LeftShoulder) return;
  _u.copy(D.Spine2.position).normalize(); _r.copy(D.RightShoulder.position).sub(D.LeftShoulder.position).applyQuaternion(q2); _r.addScaledVector(_u, -_r.dot(_u)).normalize(); _bk.crossVectors(_r, _u);
  b.getWorldScale(_ws); const un = ks / (_ws.x || 1), tl = (prone ? W.prone[1] : W.tilt) * D2R, dz = W.at[2] + (prone ? W.prone[0] : 0);
  _z.copy(_u).multiplyScalar(Math.cos(tl)).addScaledVector(_r, Math.sin(tl)).multiplyScalar(W.tip); _x.copy(_bk).multiplyScalar(W.flat); _y.crossVectors(_z, _x);
  L.sq.setFromRotationMatrix(_mat.makeBasis(_x, _y, _z)); L.sp.copy(D.Spine2.position).addScaledVector(_r, W.at[0] * un).addScaledVector(_u, W.at[1] * un).addScaledVector(_bk, dz * un).addScaledVector(_z, -W.zAt * un); L.sk = un;
  if(L.m.parent !== b) b.add(L.m); L.m.position.copy(L.sp); L.m.quaternion.copy(L.sq); L.m.scale.setScalar(un); L.m.visible = true; L.m.updateMatrixWorld(true); L.seated = true; L.pr = prone ? 1 : 0; }
function wornWorld(R, L, op, oq){ const b = R.pup.D.Spine1; _mat.compose(L.sp, L.sq, _one.setScalar(L.sk)).premultiply(b.matrixWorld); _mat.decompose(op, oq, _ws); }

// ---- BEFORE THE MIXER: which clips, how much (real-cav poseRealCav). true: the rifle's own clips fade out ----
export function bladeClip(cv, R, G, dt, P, mounted){ if(!BLADE.on || !R.pup || !R.om) return false; const L = rigState(R); if(!mesh(R, L)) return false;
  const mine = cv === CV, B = BLADEST, K = L.K, S0 = K.set, can = !mounted && !P.dead && !P.trans && !P.climb && !(P.move && P.move.roll >= 0), want = can && (mine ? B.held : !!cv.blade);
  L.w = clamp(L.w + (want ? dt / BLADE.draw : -dt / BLADE.sheath), 0, 1); if(!can && (P.dead || mounted)) L.w = 0; if(mine) B.sw = L.w; const bw = L.bw = smooth(L.w * 1.7);
  if(L.w <= 0){ if(L.on){ L.on = false; for(const a of L.A.values()) if(a) a.setEffectiveWeight(0); L.bwt.fill(0); L.mv[0].w = L.mv[1].w = 0; L.yaw = 0; R.blYaw = 0; } return false; } L.on = true;
  // the stance set by his pace and heading (his own velocity in his body's frame; the other player's: straight ahead)
  const v = P.footV || 0; let fz = 1, fx = 0; if(mine && v > 0.2){ const p = S.player, f = p.facing; fz = (p.vel.x * Math.sin(f) + p.vel.z * Math.cos(f)) / v; fx = (p.vel.x * Math.cos(f) - p.vel.z * Math.sin(f)) / v; }
  const guard = mine && B.guard, mvK = smooth((v - 0.25) / 0.5), runK = smooth((v - S0.runV + 0.4) / 0.8), W8 = L.bwt, kf = Math.min(1, dt / BLADE.locoFade), gk = guard ? 0.5 : 1;
  const wf = Math.max(0, fz) ** 2, wb = Math.max(0, -fz) ** 2, wl = Math.max(0, fx) ** 2, wr = Math.max(0, -fx) ** 2, ws = wf + wb + wl + wr || 1, back = fz < -0.35, wk = mvK * gk * (1 - runK) / ws, rn = mvK * gk * runK;
  _tg[0] = guard ? 0 : 1 - mvK; _tg[1] = guard ? 1 - mvK * 0.5 : 0; _tg[2] = wk * wf; _tg[3] = wk * wb; _tg[4] = wk * wl; _tg[5] = wk * wr; _tg[6] = back ? 0 : rn; _tg[7] = back ? rn : 0;
  let lead = 0, sum = 0; for(let i = 0; i < 8; i++){ W8[i] += (_tg[i] - W8[i]) * kf; if(W8[i] < 0.002 && _tg[i] === 0) W8[i] = 0; if(_tg[i] > _tg[lead]) lead = i; sum += W8[i]; } sum = sum || 1;
  // one phase for the whole set (the feet of two gaits fall together), paced by the leading clip's own speed
  { const I = animInfo(L.ids[lead]), sp = I && I.speed > 0.3 ? clamp(v / (I.speed * rootK()), S0.rate[0], S0.rate[1]) : 1; L.ph = (L.ph + dt * sp / (I ? I.dur : 1)) % 1; }
  // the move in hand (the page's own soldier): cross-faded with the one before
  const M0 = L.mv[0], M1 = L.mv[1], A = mine && B.act ? ACT : null, id = A ? A.mv.clip : null;
  if(id !== M0.id && id){ M1.id = M0.id; M1.t = M0.t; M1.w = M0.w; M0.id = id; M0.w = 0; } if(id) M0.t = A.t;
  M0.w = clamp(M0.w + (id ? dt / BLADE.fade[0] : -dt / BLADE.fade[1]), 0, 1); M1.w = clamp(M1.w - dt / BLADE.fade[0], 0, 1 - M0.w); if(!id && M0.w <= 0) M0.id = null;
  const mw = Math.min(1, M0.w + M1.w), tn = S.timeNow || performance.now() / 1000;
  for(let i = 0; i < 8; i++){ const a = action(R, L, L.ids[i]); if(!a) continue; a.setEffectiveWeight(bw * (1 - mw) * W8[i] / sum); if(W8[i] > 0){ const du = a.getClip().duration; a.time = i < 2 ? tn % du : L.ph * du; } }
  for(let i = 0; i < 2; i++){ const M = L.mv[i]; if(!M.id) continue; const a = action(R, L, M.id); if(a){ a.setEffectiveWeight(bw * M.w); a.time = Math.min(M.t, a.getClip().duration - 1e-3); } }
  // a spinning move turns his whole body: the clip's root yaw (the hips keep only their sway); what is left of a turn at its end eases away
  if(A && animInfo(id).travels){ animRootAt(id, A.t, _root); animRootAt(id, A.mv.from, _root0); L.yaw = wrapA(_root[2] - _root0[2]); } else L.yaw *= Math.max(0, 1 - dt * 9);
  R.blYaw = L.yaw * bw; return want; }

// ---- AFTER THE PUPPET: the clip's pose kept (real-cav, right after drivePuppet) ----
export function bladePre(R){ const L = R.bl; if(!L || !L.m || L.w <= 0) return; const B = L.bones, s = L.snap; for(let i = 0; i < B.length; i++) B[i].quaternion.toArray(s, i * 4); if(R.pup.D.Hips) L.hips.copy(R.pup.D.Hips.position); }

// the handle's centre in a fist (→ out), the knuckle line toward the thumb side (→ _k), wrist → knuckles (→ _m), out of the palm (→ _n)
function fist(D, s, out){ const h = D[s + 'Hand'], m = D[s + 'HandMiddle1'], i1 = D[s + 'HandIndex1'], p1 = D[s + 'HandPinky1'], H = BLADE.hand; h.getWorldPosition(_a); m.getWorldPosition(_b); i1.getWorldPosition(_c); p1.getWorldPosition(_d);
  _k.subVectors(_c, _d).normalize(); _m.subVectors(_b, _a); out.copy(_a).addScaledVector(_m, H.palm); _m.normalize(); if(s === 'Right') _n.crossVectors(_m, _k); else _n.crossVectors(_k, _m); _n.normalize(); return out; }
const _tq = Q4(), _tw = Q4();
// the handle's centre line in a fist: the palm's skin + the handle's own radius out of it
function grip(D, s, K, ks, out){ fist(D, s, out); return out.addScaledVector(_n, (BLADE.hand.out + K.r) * ks); }
function setWorldQ(b, q){ b.parent.getWorldQuaternion(_q2); b.quaternion.copy(_q2.invert().multiply(q)); b.updateMatrixWorld(true); }
function turnTo(b, from, to, w){ _tq.setFromUnitVectors(from, to); if(w < 1) _tq.slerp(_tw.identity(), 1 - w); b.getWorldQuaternion(_tw).premultiply(_tq); setWorldQ(b, _tw); }

// ---- AFTER THE CARRY: the clip's pose laid back by the blade's weight, the weapon in his fist, the other hand on it (real-cav) ----
export function bladeHold(cv, R, G, dt, P){ const L = R.bl; if(!L || !L.m) return; const D = R.pup.D, K = L.K, prone = P.stance === 'prone' && !P.trans ? 1 : 0;
  if(L.w <= 0){ if(!L.seated || L.pr !== prone) seat(R, L, !!prone); return; }
  const bw = L.bw, ks = bodyK(), H = BLADE.hand, mine = cv === CV;
  { const B = L.bones, s = L.snap; if(bw >= 0.999) for(let i = 0; i < B.length; i++) B[i].quaternion.fromArray(s, i * 4); else for(let i = 0; i < B.length; i++) B[i].quaternion.slerp(_q.fromArray(s, i * 4), bw);
    if(D.Hips) D.Hips.position.lerp(L.hips, bw); R.pup.dst.updateMatrixWorld(true); }
  // where it hangs (the world), lifted off his back as the hand takes it
  wornWorld(R, L, _wp, _wq); const a = 0.3, reach = smooth(L.w / a) * (1 - smooth((L.w - a) / (1 - a))), inHand = L.w >= a, hq = smooth((L.w - a) / (1 - a) * 1.5);
  // DRAW / SHEATH: the right hand goes over the shoulder to the grip where it hangs
  _z.set(0, 0, 1).applyQuaternion(_wq); const slide = clamp(K.worn.grab - 0, K.butt + 0.1, K.root - 0.1); _wp.addScaledVector(_z, slide * ks);   // (where his hand can take it: `grab` m along it from the grip; it slides to the grip as it comes to hand)
  if(reach > 0.001){ grip(D, 'Right', K, ks, _hp); D.RightHand.getWorldPosition(_a); D.RightHand.getWorldQuaternion(_hq); _t.copy(_wp).sub(_hp).multiplyScalar(reach).add(_a);
    D.RightArm.getWorldPosition(_pl).addScaledVector(_y.set(0, 1, 0), 0.35); G.getWorldQuaternion(_q); _pl.addScaledVector(_x.set(-1, 0, 0).applyQuaternion(_q), 0.3); ik2(D.RightArm, D.RightForeArm, D.RightHand, _t, _pl); setWorldQ(D.RightHand, _hq); }
  // THE WEAPON IN THE MAIN FIST: along the knuckle line (a pole: along the line through both palms), the edge the way the knuckles face
  grip(D, 'Right', K, ks, _hp); _hz.copy(_k); _hy.copy(_m);
  if(K.two && D.LeftHand){ grip(D, 'Left', K, ks, _p); _d.subVectors(_p, _hp).multiplyScalar(K.off[0] >= 0 ? 1 : -1); const d = _d.length() / ks, w2 = d < 1.6 ? smooth((d - 0.3) / 0.14) : 0; D.RightHand.getWorldQuaternion(_q);   // (the pole runs from his left palm, the butt hand,
    if(w2 > 0.999){ _hz.copy(_d).normalize(); L.zl.copy(_hz).applyQuaternion(_q2.copy(_q).invert()); L.zOk = true; }                                                                     //   through his right up by the blade — the axe pack's hold. As his hands come together
    else if(L.zOk){ _hz.copy(L.zl).applyQuaternion(_q); if(w2 > 0) _hz.lerp(_d.normalize(), w2).normalize(); } else if(w2 > 0) _hz.copy(_d).normalize(); }                                     //   the line is too short to trust: it stays as it lay in his right fist)
  _hy.addScaledVector(_hz, -_hy.dot(_hz)).normalize(); if(K.roll) _hy.applyAxisAngle(_hz, K.roll * D2R);
  // THE EDGE LEADS THE CUT: at rest it lies as his fist has it; as the tip gathers speed across the weapon's line the edge is rolled (at a wrist's pace) to face the way it travels
  { const E = BLADE.edge; _tip.copy(_hp).addScaledVector(_hz, K.tip * ks); if(E.on && L.tpOk && dt > 0 && inHand){ _t.copy(_tip).sub(L.tp).divideScalar(dt); _t.addScaledVector(_hz, -_t.dot(_hz)); const sp = _t.length(), w = smooth((sp - E.v[0]) / (E.v[1] - E.v[0]));
      if(w > 0){ _t.divideScalar(sp); _b.copy(_hy).lerp(_t, w); if(_b.lengthSq() < 0.01) _b.copy(_t); _b.addScaledVector(_hz, -_b.dot(_hz)).normalize(); } else _b.copy(_hy);
      _a.copy(L.ey).addScaledVector(_hz, -L.ey.dot(_hz)); if(_a.lengthSq() < 1e-6) _a.copy(_hy); _a.normalize(); const ang = Math.atan2(_c.crossVectors(_a, _b).dot(_hz), _a.dot(_b)), st = E.rate * dt; _hy.copy(_a).applyAxisAngle(_hz, clamp(ang, -st, st)); }
    L.ey.copy(_hy); L.tp.copy(_tip); L.tpOk = inHand; }
  _x.crossVectors(_hy, _hz); _hq.setFromRotationMatrix(_mat.makeBasis(_x, _hy, _hz));
  if(inHand){ _oq.copy(_wq).slerp(_hq, hq); _op.copy(_hp).addScaledVector(_z.set(0, 0, 1).applyQuaternion(_oq), -slide * ks * (1 - hq)); } else { _op.copy(_wp).addScaledVector(_z, -slide * ks); _oq.copy(_wq); }
  // THE OTHER HAND on its stretch of the handle: the fist turned round the shaft, then two-bone IK
  const ho = smooth((L.w - 0.55) / 0.45); _z.set(0, 0, 1).applyQuaternion(_oq);
  if(ho > 0.001 && D.LeftHand && D.LeftArm && D.LeftForeArm){ grip(D, 'Left', K, ks, _p); _tip.copy(_op).addScaledVector(_z, clamp(_p.sub(_op).dot(_z) / ks, K.off[0], K.off[1]) * ks);   // (where along the handle his hand already is, kept on its own stretch of it: the hand closes on the shaft, it is not dragged along it)
    fist(D, 'Left', _p); turnTo(D.LeftHand, _k, _b.copy(_z).multiplyScalar(_k.dot(_z) >= 0 ? 1 : -1), ho); D.LeftHand.getWorldQuaternion(_hq);   // (the fist round the shaft first; the wrist then put where that fist's palm lies on the grip, the fist kept as it was turned: exact)
    grip(D, 'Left', K, ks, _p); D.LeftHand.getWorldPosition(_a); _t.copy(_tip).sub(_p).multiplyScalar(ho).add(_a); D.LeftForeArm.getWorldPosition(_pl); ik2(D.LeftArm, D.LeftForeArm, D.LeftHand, _t, _pl); setWorldQ(D.LeftHand, _hq);
    // his arm could not bring the hand all the way (the clips were made on longer arms): the weapon comes the rest of the way to it — the right wrist moved by what is left, its fist kept as it lay
    grip(D, 'Left', K, ks, _p); _d.copy(_tip).sub(_p).multiplyScalar(ho); if(inHand && _d.lengthSq() > 4e-6){ D.RightHand.getWorldPosition(_a); D.RightHand.getWorldQuaternion(_hq); _t.copy(_a).sub(_d); D.RightForeArm.getWorldPosition(_pl);
      ik2(D.RightArm, D.RightForeArm, D.RightHand, _t, _pl); setWorldQ(D.RightHand, _hq); D.RightHand.getWorldPosition(_b).sub(_a); _op.add(_b); _tip.add(_b); } }
  if(inHand){ curlHand(D, 'Right', H.curl * hq, _op); if(ho > 0.3) curlHand(D, 'Left', H.curl * ho, _tip); }
  // laid under the rig group (his own size in the world)
  if(L.seated){ L.seated = false; G.add(L.m); } _mat.compose(_op, _oq, _one.setScalar(ks)); _mi.copy(G.matrixWorld).invert(); _mat.premultiply(_mi); _mat.decompose(L.m.position, L.m.quaternion, L.m.scale); L.m.updateMatrixWorld(true);
  if(mine){ _tip.copy(_op).addScaledVector(_z, K.tip * ks); _mid.copy(_op).addScaledVector(_z, (K.root + K.tip) / 2 * ks); trail(dt, !!(BLADEST.act && ACT.wi >= 0)); } }

// ---- THE RIBBON: n pairs (mid-blade, tip), the newest first, fading; one mesh, one draw call ----
const TR = { mesh:null, pos:null, col:null, n:0, k:0, live:0, lt:V3(), lm:V3() };
function trail(dt, on){ const T = BLADE.trail; if(!T.on || !scene) return; if(!TR.mesh){ if(!on) return; const n = TR.n = T.n, g = new THREE.BufferGeometry(), ix = []; TR.pos = new Float32Array(n * 6); TR.col = new Float32Array(n * 6);
    g.setAttribute('position', new THREE.BufferAttribute(TR.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(TR.col, 3)); for(let i = 0; i < n - 1; i++) ix.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); g.setIndex(ix);
    TR.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:T.op, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false })); TR.mesh.name = 'bladeTrail'; TR.mesh.frustumCulled = false; TR.mesh.renderOrder = 5; scene.add(TR.mesh); }
  const n = TR.n, P = TR.pos, C = TR.col; if(on){ if(TR.live <= 0){ for(let i = 0; i < n; i++){ _mid.toArray(P, i * 6); _tip.toArray(P, i * 6 + 3); } TR.live = 0; } TR.live = Math.min(n, TR.live + 1); TR.k = 1; } else { TR.k = Math.max(0, TR.k - dt / T.life); if(TR.k <= 0){ if(TR.mesh.visible){ TR.mesh.visible = false; TR.live = 0; } return; } }
  if(dt > 0){ P.copyWithin(6, 0, (n - 1) * 6); _mid.toArray(P, 0); _tip.toArray(P, 3); } const col = _a.setScalar(1), c = T.color; col.set((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255);
  for(let i = 0; i < n; i++){ const f = i < TR.live ? (1 - i / (n - 1)) ** 2 * TR.k : 0; C[i * 6] = col.x * f * 0.25; C[i * 6 + 1] = col.y * f * 0.25; C[i * 6 + 2] = col.z * f * 0.25; C[i * 6 + 3] = col.x * f; C[i * 6 + 4] = col.y * f; C[i * 6 + 5] = col.z * f; }
  TR.mesh.visible = true; TR.mesh.geometry.attributes.position.needsUpdate = true; TR.mesh.geometry.attributes.color.needsUpdate = true; }

// ---- THE FIGHT (the page's own soldier) ----
// the nearest man within r m (his edge) and cone° either side of a bearing: → _near { e, d, a }
const _near = { e:null, d:0, a:0 };
function nearest(p, r, cone, bear, inf){ let be = null, bd = 1e9, ba = 0; const c = cone * D2R; for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!(e.hp > 0) || e._under || (inf && !(e.def && e.def.inf))) continue;
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz) - (e.radius || 0.4); if(d > r || d >= bd) continue; const a = Math.atan2(dx, dz); if(cone < 180 && Math.abs(wrapA(a - bear)) > c) continue; be = e; bd = d; ba = a; }
  _near.e = be; _near.d = bd; _near.a = ba; return be; }
function begin(what, now){ const B = BLADEST, p = S.player, K = BLADE.kinds[B.kind], MV = K.moves, SM = BLADE.stamina; let mv = null;
  if(what === 'light'){ const i = (B.act || now - B.chainAt < BLADE.chainT) && B.chain < MV.light.length ? B.chain : 0; mv = MV.light[i]; B.chain = (i + 1) % MV.light.length; B.chainAt = now; } else mv = MV[what]; if(!mv) return false;
  let tired = B.st < (mv.st || 0); if(tired && what !== 'light' && what !== 'flourish'){ mv = MV.light[0]; B.chain = 1; tired = B.st < mv.st; what = 'light'; }
  B.st = Math.max(0, B.st - (mv.st || 0)); B.stAt = now; if(what === 'special') B.spAt = now + mv.cd; if(what !== 'light') B.chain = 0;
  const A = ACT; A.mv = mv; A.t = mv.from; A.rate = mv.rate * (tired ? SM.tiredRate : 1); A.dmgK = tired ? SM.tiredDmg : 1; A.wi = -1; A.hit.clear(); A.lunge = 0; A.what = what;
  // aimed along the crosshair — or at the man it is about to reach, when one stands near that line
  const reach = (mv.reach || K.reach) * bodyK(), I = animInfo(mv.clip), far = mv.root && I && I.end ? Math.hypot(I.end[0], I.end[1]) * rootK() : (mv.lunge || 0), e = mv.win.length ? nearest(p, reach + far + 0.8, BLADE.assist, p.aimSmoothed, false) : null; A.f0 = e ? _near.a : p.aimSmoothed; A.rk = 1;
  if(e && mv.root && I && I.travels){ animRootAt(mv.clip, mv.win[0][0], _root); animRootAt(mv.clip, mv.from, _root0); const go = Math.hypot(_root[0] - _root0[0], _root[1] - _root0[1]) * rootK(); A.rk = go > 0.1 ? clamp((_near.d - reach * 0.6) / go, 0.12, 1) : 1; }   // (a leap lands him at the man, not past him)
  if(e && mv.lunge){ const gap = _near.d - reach * 0.72; if(gap > 0.05){ A.lunge = Math.sqrt(2 * CAV.foot.decel * Math.min(mv.lunge, gap)); A.lx = Math.sin(A.f0); A.lz = Math.cos(A.f0); } }
  B.act = A; B.buf = null; B.flDone = what === 'flourish' ? true : B.flDone; if(what !== 'flourish') B.swings++; return true; }
function ask(what, now){ const B = BLADEST; B.buf = what; B.bufAt = now; }
function cut(e, A, K, p, now, bear){ const B = BLADEST, mv = A.mv, HT = BLADE.hit, sw = mv.arc[1] - mv.arc[0], heavy = mv.dmg >= 90; let dx, dz;
  if(Math.abs(sw) < 1){ dx = Math.sin(bear); dz = Math.cos(bear); } else { const s = sw > 0 ? 1 : -1; dx = Math.cos(bear) * s * 0.85 + Math.sin(bear) * 0.5; dz = -Math.sin(bear) * s * 0.85 + Math.cos(bear) * 0.5; }   // (a sweep carries him along it and away)
  let dmg = mv.dmg * A.dmgK * (p.dmgMul || 1); if(e.general || e.hitCap) dmg = Math.min(dmg, (e.maxHp || e.hp) * HT.gen);
  e._hx = dx; e._hz = dz; if(e.def && e.def.inf){ e.dazeUntil = Math.max(e.dazeUntil || 0, now + mv.daze); e.kbx = (e.kbx || 0) + dx * mv.push; e.kbz = (e.kbz || 0) + dz * mv.push; e.aimT = 0; }
  const ex = e.pos.x, ez = e.pos.z, flesh = !!(e.def && e.def.inf) && !mv.blunt; damageEnemy(e, dmg); B.hits++; if(B.firstHit < 0) B.firstHit = now; if(!(e.hp > 0)){ B.kills++; B.killAt = now; B.flDone = false; }
  if(flesh){ bloodSpurt(ex, ez, dx, dz, heavy ? 1.8 : 1.1); sfx(heavy ? 'crunch' : 'hit', e.pos, 0.75); } else { sparks(ex, heightAt(ex, ez) + 1.1, ez, HT.sparks); sfx(mv.blunt ? 'thud' : 'clang', e.pos, 0.6); }
  S.hitStop = Math.max(S.hitStop || 0, (S.timeNow || now) + HT.stop[heavy ? 1 : 0]); S.shake = Math.min(2.4, (S.shake || 0) + HT.shake[heavy ? 1 : 0]); S.camKick = Math.min(1.2, (S.camKick || 0) + HT.kick[heavy ? 1 : 0]); S.kickAng = A.f0; }
function sparks(x, y, z, n){ for(let i = 0; i < n; i++) spawnPart(x, y, z, (Math.random() - 0.5) * 6, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 6, { color:0xffd9a0, size:0.09 + Math.random() * 0.08, life:0.22 + Math.random() * 0.2, grav:9, drag:0.6 }); }
function windows(p, K, A, now){ const mv = A.mv, HT = BLADE.hit; let wi = -1; for(let i = 0; i < mv.win.length; i++) if(A.t >= mv.win[i][0] && A.t <= mv.win[i][1]) wi = i;
  if(wi < 0){ A.wi = -1; return; } const W = mv.win[wi], u = (A.t - W[0]) / Math.max(1e-3, W[1] - W[0]), a0 = mv.arc[0], cur = a0 + (mv.arc[1] - a0) * u, tol = mv.tol ?? HT.tol, lo = Math.min(a0, cur) - tol, hi = Math.max(a0, cur) + tol;
  const reach = (mv.reach || K.reach) * bodyK(), py = heightAt(p.pos.x, p.pos.z) + (p.lift || 0), fx = Math.sin(A.f0), fz = Math.cos(A.f0);
  if(A.wi !== wi){ A.wi = wi; sfx('whoosh', p.pos, mv.dmg >= 90 ? 0.7 : 0.45);   // the window opens: the air, and what solid cover stands in the arc is chipped once
    let nb = 0; for(const bl of blocksNear(p.pos.x + fx * reach * 0.55, p.pos.z + fz * reach * 0.55, reach * 0.5, _bn)){ if(bl.ours || bl.ridge || bl.dead || nb >= 2) continue; nb++; damageBlock(bl, HT.chip * A.dmgK); sparks(bl.x, py + 1, bl.z, 4); if(nb === 1) sfx('clang', p.pos, 0.5); } }
  for(let i = enemies.length - 1; i >= 0; i--){ const e = enemies[i]; if(!e || !(e.hp > 0) || e._under || A.hit.has(e)) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz) - (e.radius || 0.4); if(d > reach) continue;
    const bear = Math.atan2(dx, dz); let rel = wrapA(bear - A.f0) / D2R; rel += 360 * Math.ceil((lo - rel) / 360); if(rel > hi) continue;   // (the first turn of his bearing at or past the arc's low end: inside it or not)
    const ey = heightAt(e.pos.x, e.pos.z) + (e.air ? e.pos.y || 0 : 0) - py; if(ey < mv.y[0] || ey > mv.y[1]) continue; A.hit.add(e);   // (in reach, in the arc, at his height: one look for a wall between, then never again this swing)
    if(!lineClear(p.pos.x, py + 1.15, p.pos.z, e.pos.x, py + ey + 1.0, e.pos.z)) continue; cut(e, A, K, p, now, bear); } }

// soldier-fire: the trigger is down this frame. true: the round is not fired (the blade has it)
export function bladeFire(now){ const B = BLADEST, p = S.player, AU = BLADE.auto; if(!BLADE.on || !afoot() || !B.kind || !B.ready[B.kind] || climbing() || fpvFlying()) return false;
  if(B.held){ if(B.auto && !B.act && !B.buf && !nearest(p, AU.keep, 180, 0, true)){ B.held = false; B.auto = false; return false; } B.trigF = B.frame; return true; }   // (AUTO-drawn, nobody near: the rifle again, and this press is its shot)
  if(AU.on && CV.stance !== 'prone' && nearest(p, AU.r, AU.cone, p.aimSmoothed, true)){ B.held = true; B.auto = true; B.nearAt = now; B.drawAt = now; B.trigF = B.frame; return true; }
  return false; }
export function bladeSwitch(on, auto){ const B = BLADEST; if(!BLADE.on) return false; on = !!on && afoot() && !climbing() && !!B.ready[B.kind || bladeKind()]; if(on === B.held){ B.auto = B.auto && !!auto; return on; }
  B.held = on; B.auto = !!auto && on; if(on){ B.drawAt = performance.now() / 1000; B.nearAt = B.drawAt; } else { B.act = null; B.buf = null; B.guard = false; } sfx(on ? 'dash' : 'click', S.player && S.player.pos, 0.4); hud(); return on; }
export function bladeToggle(){ return bladeSwitch(!BLADEST.held, false); }
// flame.js: the blade is the slot after his guns (the number row), and one more stop on the weapon cycle (the wheel, the cycle keys, LB / RB)
export function bladeSelect(i){ const p = S.player, B = BLADEST; if(!BLADE.on || !p) return false; if(i === p.guns.length){ bladeSwitch(true, false); return true; } if(B.held && i >= 0 && i < p.guns.length) bladeSwitch(false); return false; }
export function bladeCycle(d){ const p = S.player, B = BLADEST; if(!BLADE.on || !p || !p.guns.length) return false; if(B.held){ bladeSwitch(false); selectGun(d > 0 ? 0 : p.guns.length - 1); return true; }
  const n = p.gunIdx + d; if(n >= p.guns.length || n < 0) return bladeSwitch(true, false); return false; }
// spells.js: in blade mode the skill key is the blade's special. true: no spell is cast
export function bladeSpecial(){ const B = BLADEST, p = S.player; if(!BLADE.on || !B.held || !p) return false; const now = S.timeNow || performance.now() / 1000;
  if(now < B.spAt){ floatText('CHIÊU ĐẶC BIỆT: ' + Math.ceil(B.spAt - now) + ' s', '#ffcf5a', p.pos, 13); return true; } ask('special', now); return true; }
// player-damage.js: what a hit is multiplied by (dx, dz: the way it travelled) — the guard takes the edge off what comes at his front
export function bladeGuardK(dx, dz){ const B = BLADEST, p = S.player; if(!BLADE.on || !B.guard || !p || !(dx || dz)) return 1; const a = Math.atan2(-dx, -dz); return Math.abs(wrapA(a - p.facing)) <= BLADE.guard.arc / 2 * D2R ? BLADE.guard.front : 1; }
// cavalry.js, on his feet, once his pace and facing are set: the move's own pace, its step-in, its root travel, and his front kept on the cut
export function bladeFoot(p, dt){ const B = BLADEST; if(!BLADE.on || !B.held) return; if(CV.stance !== 'stand' || CV.want !== 'stand') CV.stance = CV.want = 'stand';   /* (the blade is fought on his feet) */ const A = B.act, cap = (A ? A.mv.move : B.guard ? BLADE.guard.moveK : 1) * CAV.foot.run;
  if(A){ p.facing = wrapA(p.facing + wrapA(A.f0 - p.facing) * Math.min(1, dt * 14)); const I = animInfo(A.mv.clip);
    if(A.mv.root && I && I.travels && dt > 0){ animRootAt(A.mv.clip, A.t, _root); animRootAt(A.mv.clip, Math.max(A.mv.from, A.t - dt * A.rate), _root0); const k = rootK() * A.rk / dt, rx = (_root[0] - _root0[0]) * k, rz = (_root[1] - _root0[1]) * k, s = Math.sin(A.f0), c = Math.cos(A.f0);
      p.vel.x = c * rx + s * rz; p.vel.z = -s * rx + c * rz; return; }
    if(A.lunge > 0 && A.t >= A.mv.from){ p.vel.x += A.lx * A.lunge; p.vel.z += A.lz * A.lunge; A.lunge = -1; } if(A.lunge < 0 && A.wi < 0 && A.t < (A.mv.win[0] ? A.mv.win[0][0] : 0)) return; }
  const v = Math.hypot(p.vel.x, p.vel.z); if(v > cap && cap < CAV.foot.run){ const k = Math.max(cap, v - CAV.foot.decel * 2 * dt) / v; p.vel.x *= k; p.vel.z *= k; } }
// cavalry.js, every frame of the page's own soldier: the kind, the trigger's presses, the move in hand, its windows, AUTO's way back, the flourish
export function bladeTick(p, dt, now){ const B = BLADEST; B.frame++; if(!BLADE.on || !p) return; const k = bladeKind(); if(B.kind !== k){ B.kind = k; B.act = null; B.buf = null; } load(k);
  const K = BLADE.kinds[k], SM = BLADE.stamina, AU = BLADE.auto;
  if(B.held && (!afoot() || climbing() || fpvFlying())){ B.held = false; B.auto = false; B.act = null; B.buf = null; }
  if(!B.held){ B.down = false; B.guard = false; B.act = null; if(B.st < SM.max) B.st = Math.min(SM.max, B.st + SM.regen * dt); if(B.frame % 6 === 0) hud(); return; }
  if(now - B.stAt > SM.delay && !B.act) B.st = Math.min(SM.max, B.st + SM.regen * dt);
  // the trigger: a press = the light (at a sprint the running attack, from the guard the counter); held past `hold` = the heavy, at once if the light has not yet cut
  const down = B.trigF >= B.frame - 1, sprint = heldAction('sprint') && Math.hypot(p.vel.x, p.vel.z) > BLADE.runAt;
  if(down && !B.down){ B.pressT = now; B.heavied = false; ask(B.guard ? 'counter' : sprint ? 'run' : 'light', now); }
  if(down && !B.heavied && now - B.pressT >= BLADE.hold){ B.heavied = true; if(B.act && ACT.what === 'light' && ACT.wi < 0 && ACT.t < ACT.mv.win[0][0] && B.st >= K.moves.heavy.st){ B.chain = 0; begin('heavy', now); } else ask('heavy', now); }
  if(!down && B.down) B.pressT = 0; B.down = down;
  B.guard = B.sw > 0.9 && !B.act && !B.buf && (heldAction('reload') || !!(RDRAG && RDRAG.down));
  // the move in hand
  if(B.act){ const A = ACT, mv = A.mv; A.t += dt * A.rate; if(mv.win.length) windows(p, K, A, now);
    if(B.buf && (A.what === 'flourish' || A.t >= mv.next)){ begin(B.buf, now); } else if(A.t >= mv.to){ B.act = null; B.chainAt = now; } }
  if(!B.act && B.buf){ if(B.sw < BLADE.cutAt) B.bufAt = now; else if(now - B.bufAt > BLADE.buffer) B.buf = null; else begin(B.buf, now); }
  // AUTO's way back: nobody within `back` for `wait` s
  if(B.auto && !B.act){ if(nearest(p, AU.back, 180, 0, true)) B.nearAt = now; else if(now - B.nearAt > AU.wait){ B.held = false; B.auto = false; } }
  // the flourish: after a kill, nobody near, nothing asked of him
  if(!B.flDone && !B.act && !B.buf && !down && now - B.killAt > BLADE.flourish.wait && B.sw >= 1){ if(now - B.killAt > 3 || nearest(p, BLADE.flourish.r, 180, 0, false)) B.flDone = true; else begin('flourish', now); }
  if(B.frame % 6 === 0) hud(); }

// ---- what he sees of it: a pill with the kind, the stamina and the special's cooldown (only while it is in his hands); phones get a round button ----
let _hud = null, _btn = null, _hs = '';
function hud(){ if(typeof document === 'undefined') return; const B = BLADEST, K = BLADE.kinds[B.kind || bladeKind()], now = S.timeNow || performance.now() / 1000, on = B.held && S.mode === 'playing';
  if(MOBILE && !_btn && S.mode === 'playing'){ _btn = document.createElement('div'); _btn.id = 'bladeBtn'; _btn.style.cssText = 'position:fixed;right:' + BLADE.btn[0] + 'px;bottom:' + BLADE.btn[1] + 'px;z-index:40;width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 12px/1 system-ui,sans-serif;letter-spacing:.04em;color:#f3ead2;background:rgba(40,44,34,.72);border:1px solid rgba(255,207,90,.6);touch-action:none;user-select:none';
    _btn.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); bladeToggle(); }); document.body.appendChild(_btn); }
  if(_btn){ _btn.style.display = S.mode === 'playing' && afoot() ? 'flex' : 'none'; const t = B.held ? 'SÚNG' : 'ĐAO'; if(_btn.textContent !== t) _btn.textContent = t; }
  if(!on){ if(_hud && _hs){ _hud.style.display = 'none'; _hs = ''; } return; }
  if(!_hud){ _hud = document.createElement('div'); _hud.id = 'bladeHud'; _hud.style.cssText = 'position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:30;display:none;padding:6px 14px 8px;border-radius:10px;font:700 12px/1.2 system-ui,sans-serif;letter-spacing:.05em;color:#f3ead2;background:rgba(30,33,26,.66);border:1px solid rgba(255,207,90,.45);pointer-events:none;text-align:center;min-width:150px';
    _hud.innerHTML = '<div id="bladeNm"></div><div style="height:4px;margin-top:5px;border-radius:2px;background:rgba(255,255,255,.16)"><div id="bladeSt" style="height:4px;border-radius:2px;background:#9be04a;width:100%"></div></div>'; document.body.appendChild(_hud); }
  const cd = Math.max(0, B.spAt - now), st = Math.round(B.st / BLADE.stamina.max * 20), sig = K.name + '|' + st + '|' + Math.ceil(cd) + (B.guard ? 'g' : '') + (B.auto ? 'a' : ''); if(sig === _hs) return; _hs = sig; _hud.style.display = 'block';
  _hud.firstChild.textContent = '⚔ ' + K.name + (B.auto ? ' · TỰ ĐỘNG' : '') + (B.guard ? ' · THỦ' : '') + (cd > 0 ? ' · chiêu ' + Math.ceil(cd) + ' s' : ' · chiêu sẵn sàng'); const bar = _hud.lastChild.firstChild; bar.style.width = st * 5 + '%'; bar.style.background = st < 5 ? '#ff6a4a' : '#9be04a'; }
// the middle button TAPPED (a drag still turns the view) and the mouse's side buttons: blade ⇄ rifle
if(typeof addEventListener === 'function' && typeof document !== 'undefined'){ let mt = 0, mx = 0, my = 0;
  addEventListener('mousedown', e => { if(e.button === 1){ mt = performance.now(); mx = e.clientX; my = e.clientY; } else if((e.button === 3 || e.button === 4) && S.mode === 'playing'){ e.preventDefault(); bladeToggle(); } });
  addEventListener('mouseup', e => { if(e.button === 1 && S.mode === 'playing' && performance.now() - mt < 260 && Math.hypot(e.clientX - mx, e.clientY - my) < 6) bladeToggle(); else if(e.button === 3 || e.button === 4) e.preventDefault(); }); }
// the loadout screen's picker and anything else that changes his blade
export function bladePick(k){ if(!BLADE.kinds[k]) return false; PROFILE.blade = k; try{ saveProfile(); }catch(e){} return true; }
// numbers for a probe / the pose studio
export function bladeProbe(){ const B = BLADEST, R = CV.real, L = R && R.bl; return { kind:B.kind, held:B.held, auto:B.auto, sw:+B.sw.toFixed(3), act:B.act ? ACT.mv.id : null, t:B.act ? +ACT.t.toFixed(3) : 0, win:B.act ? ACT.wi : -1, buf:B.buf, chain:B.chain, st:+B.st.toFixed(1), guard:B.guard, hits:B.hits, kills:B.kills, swings:B.swings,
    ready:!!B.ready[B.kind], mesh:!!(L && L.m), seated:!!(L && L.seated), cd:+Math.max(0, B.spAt - (S.timeNow || performance.now() / 1000)).toFixed(2) }; }
