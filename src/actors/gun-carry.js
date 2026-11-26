// actors/gun-carry.js — CARRY 1 HOW A RIFLEMAN CARRIES HIS WEAPONS WHEN HE IS NOT AIMING THEM (config GUNCARRY; the soldier that is seen — actors/real-cav.js holdReal).
//   Every position is a right-handed rifleman's with a two-point sling, set on soldier2's own body (pack, plate carrier, pouches measured on his skin):
//   · SLUNG ON HIS BACK (hands free), muzzle DOWN: the rifle lies diagonally from his RIGHT shoulder blade (the butt plate no higher than the top of the
//     shoulder) down past his LEFT hip, its flat side on the pack, the magazine out to his right. It is laid in THE BACK'S OWN FRAME — rigid with Spine1,
//     the bone his pack hangs on — a fixed distance behind the spine that clears the pack by a couple of centimetres in every pose, so it cannot go
//     through him; lying down it swings in along the spine (the helmet comes back there). It hangs from its upper end and rocks a little in the back's
//     plane with his stride and his chest's sideways shove (a damped spring — it does not flap). WHEN: on a wall's face (the climb's own special case is
//     gone — actors/soldier-climb-pose.js asks here), flying the FPV drone (hands on the controller), and ON PATROL: nobody has suspected him for
//     sling.quiet s, he is stood, not firing, not aiming, not reloading. Sat on a ride it is as before (sling.mounted).
//   · HUNG IN FRONT (hands off for a moment — the knife's thrust, standing a downed mate up): across his belly on the sling, the muzzle down toward the
//     outside of his left foot, the grip by the right of his belly, in easy reach.
//   · THE SECOND WEAPON: owning two, the one not in his hands is worn on his back as above (the mesh the game already has for it, hung on the Spine1
//     bone: no cost a frame beyond its rock; it falls with him). When the one in his hands must go on his back too, it takes the MIRROR diagonal (left
//     shoulder blade → right hip), a little further out: the two cross, they do not lie on top of each other. cycleGun is a SWAP: the right hand brings
//     the worn one round the right shoulder by its grip while the left takes the old one round the left side; on his back it then slides across to the
//     right-shoulder diagonal (swap.t s; the trigger waits swap.block s and a held trigger hurries it).
//   · REAL TRANSITIONS: the gun travels a path round the OUTSIDE of his shoulder (in his hands → muzzle down at his side → behind the shoulder, flat to
//     his back → the slot): it only twists about its own length going round him and only tilts in the back's plane going in, so the muzzle never sweeps
//     through his head or legs. The carrying hand stays on the gun by IK for as far as it can follow, the other lets go first; let go, an arm eases to
//     where it hangs / to the controller / to the mate. The hold itself (holdReal) is never touched: it is computed as ever and FADED — with both hands'
//     weight on the gun and the gun in his hands this module changes no bone and no number (GUN 1–4 stay exact).
//   · LOW READY (moving, not firing): the muzzle down ready.pitch (the stock stays in the pocket: the gun turns about its butt), finger straight.
//   · THE RUN CARRY (a run, not a sprint, not firing): both hands, the rifle across the front of his trunk — the stock up by the right of his chest,
//     the muzzle down toward the left knee — rising and falling with each footfall, the arms pumping with it (the motion graph's stride phase with
//     ?animgraph, his legs' otherwise). It blends into port arms at a sprint and into the shoulder the moment he aims or fires (shoulder.k).
//   · THE SLING ITSELF (sling.strap): one thin dark ribbon per weapon, rebuilt each frame from ten points — a shallow loop under the gun in his hands;
//     over the shoulder, across the chest and round the far side for one on his back; round the neck for one hung in front.
//   Hooks: holdReal calls carryGun (once the gun's place is decided, before the hands go on) and updateRealCav calls carryAfter (after the hold);
//   climbArms calls carryBack. Nothing allocates per frame. GUNCARRY.on false / ?oldcarry: none of it runs.
import * as THREE from 'three';
import { GUNCARRY, GUNFEEL, GUNHOLD, INFGUN, LOGISTICS, REALCAV } from '../../config.js';
import { bladeHeld, CV, FIT, LEGKIT, MATE, QUIET, S, climbW, fpvFlying, graphOwned, graphState, headLevel } from '../hub.js';

const V3 = () => new THREE.Vector3(), Q4 = () => new THREE.Quaternion(), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }, seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
const SIDE = ['Right', 'Left'], FING = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'], UP = new THREE.Vector3(0, 1, 0), NP = 10;
const _co = V3(), _cr = V3(), _cu = V3(), _cb = V3(), _cq = Q4(), _cm = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _one = new THREE.Vector3(1, 1, 1);   // the back's frame
const _f = V3(), _r = V3(), _x = V3(), _y = V3(), _z = V3(), _p = V3(), _t = V3(), _t2 = V3(), _q = Q4(), _q2 = Q4(), _q3 = Q4(), _qa = Q4();
const _hp = V3(), _hq = Q4(), _hs = V3(), _sp = V3(), _sq = Q4(), _np = V3(), _nq = Q4(), _op = V3(), _oq = Q4(), _g0 = V3(), _g3 = V3(), _w1 = V3(), _w2 = V3(), _q1 = Q4(), _fq = Q4(), _fpos = V3();
const _ia = V3(), _ib = V3(), _ic = V3(), _id = V3(), _if = V3(), _ig = V3(), _it = V3(), _ie = V3(), _ix = V3(), _iq = Q4(), _iqw = Q4(), _iqp = Q4();
const _tg = V3(), _pl = V3(), _fr = V3(), _fp = V3(), _el = V3(), _sh = V3(), _hw = Q4(), _wg = V3(), _ws = V3(), _a = V3(), _b = V3(), _n = V3(), _w = V3();
const _A = Array.from({ length:8 }, V3), _P = Array.from({ length:NP }, V3), _L = Array.from({ length:NP }, V3);

// ---- his state (kept on the rig: the other player's soldier has his own) ----
//   s: the gun in his hands, 0 held … 1 on his back · h: 0 … 1 hung in front · why: what for · run: the run carry · sg: the diagonal the gun in his
//   hands slings to (+1 = from his right shoulder blade, −1 the mirror) · bK: the kind worn on his back, bs its diagonal (it slides to +1), bz its extra
//   depth · sw: the swap's clock 0…1 (1 = none), oK: the kind being stowed, nS / nZ: where the new one comes from · pw: lying down 0…1
function state(R){ return R.cy || (R.cy = { cf:null, aL:null, B:null, fs:null, runW:0, s:0, h:0, why:'', run:0, quiet:0, k:null, sg:1, nz:0, bK:null, bs:1, bz:0, wK:null, wS:9, wZ:9, wP:9, wa:V3(), wq:Q4(), wk:1, sw:1, oK:null, nS:1, nZ:0,
  hOk:false, kAt:0, knifeAt:-9, ang:0, angV:0, pw:0, done:false, tN:0, hrp:V3(), hrq:Q4(), orp:V3(), orq:Q4(), wl:[V3(), V3()], wq2:[Q4(), Q4()], ol:[V3(), V3()], oq:[Q4(), Q4()], fb:null, fq:null, w:[1, 1], st:[null, null] }); }
const gunOf = k => FIT[k] || GUNHOLD[k] || GUNHOLD.ar, kindOf = id => INFGUN.map[id], upOf = k => GUNCARRY.slot.up.includes(k) ? -1 : 1;
const afoot = cv => !!(cv && !cv.mounted && !cv.trans);
// the stride's phase, rad (0 = the left foot swinging forward, π = the right): the motion graph's when it has his legs, his own legs' otherwise
function stride(R, cv){ return graphOwned(cv) ? graphState().ph * Math.PI * 2 : R.upper && R.upper.ph || 0; }

// ---- THE BACK'S OWN FRAME, rigid with the Spine1 bone (measured on the soldier's skin: his pack hangs on Spine + Spine1, 13–20 cm behind them from the
//   belt to the shoulder blades, the same stood, kneeling, lying and at a sprint; Spine2 carries his shoulders and neck, and the clips bend it up to
//   50° forward of the pack): the origin at the Spine2 joint, up = Spine1 → Spine2, his right = collar bone → collar bone as they lie at rest, their
//   cross out of his back. Worked out once in the bone's own frame (joint offsets: the rig's constants), then one quaternion a frame ----
function chest(R, cy, D){ const b = D.Spine1; if(!cy.cf){ const q = R.pup.rest && R.pup.rest.get(D.Spine2) || D.Spine2.quaternion;
    _cu.copy(D.Spine2.position).normalize(); _cr.copy(D.RightShoulder.position).sub(D.LeftShoulder.position).applyQuaternion(q); _cr.addScaledVector(_cu, -_cr.dot(_cu)).normalize();
    _cb.crossVectors(_cr, _cu); cy.cf = new THREE.Quaternion().setFromRotationMatrix(_cm.makeBasis(_cr, _cu, _cb)); }
  D.Spine2.getWorldPosition(_co); b.getWorldQuaternion(_cq).multiply(cy.cf); _cr.set(1, 0, 0).applyQuaternion(_cq); _cu.set(0, 1, 0).applyQuaternion(_cq); _cb.set(0, 0, 1).applyQuaternion(_cq); }
const pt = (out, x, y, z) => out.copy(_co).addScaledVector(_cr, x).addScaledVector(_cu, y).addScaledVector(_cb, z);   // a point of the back's frame [his right, up, behind] → the world
// a gun's turn laid along the line e (its lower end → its upper end, in the back's plane): flat to his back, the same side out on either diagonal
function flatQ(up, a, oq){ _x.copy(_cu).multiplyScalar(Math.cos(a) * up).addScaledVector(_cr, Math.sin(a) * up); _z.copy(_cb).multiplyScalar(up); _y.crossVectors(_z, _x); return oq.setFromRotationMatrix(_cm.makeBasis(_x, _y, _z)); }
// A SLOT ON HIS BACK → the gun's place (op, oq) in the world. sig = the diagonal (+1 its upper end at his right shoulder blade, −1 the mirror; between,
//   it is sliding across); depth m behind the spine; ang = its rock; pw = lying down (in along the spine). What is pinned is the gun's UPPER END (the
//   butt; a kind in slot.up — the B41 — hangs the other way up, its warhead there): no weapon stands over the shoulder, a long one hangs lower
function slot(k, len, sig, depth, ang, pw, op, oq){ const K = GUNCARRY.slot, up = upOf(k), a0 = clamp(Math.acos(Math.min(1, K.drop / len)), K.tilt, K.tiltMax), a = (a0 + (K.prone[0] - a0) * pw) * sig + ang;
  flatQ(up, a, oq); pt(op, sig * (K.at[0] + (K.prone[1] - K.at[0]) * pw), K.at[1] + K.prone[4] * pw, depth + K.prone[2] * pw).addScaledVector(_x, -up * len / 2); }
// THE WAY ROUND HIS SHOULDER: t = 0 where the hold has it (hp, hq) … 1 in the slot (sp, sq) → (op, oq). The grip's station goes through two points of
//   the back's frame on a spline — out at his side (via[0]: the gun stood on its muzzle there, its top ahead), then behind the shoulder (via[1]: turned
//   flat to his back, still upright) — sd = +1 round his right, −1 his left
function path(t, k, sd, gx, hp, hq, sp, sq, op, oq){ const K = GUNCARRY.slot, e = smooth(t), A = K.via[0], B = K.via[1], up = upOf(k), dy = up < 0 ? K.upVia : 0;   // (a weapon worn the other way up goes round that much lower: its length is over the grip)
  _g0.set(gx, 0, 0).applyQuaternion(hq).add(hp); _g3.set(gx, 0, 0).applyQuaternion(sq).add(sp); pt(_w1, sd * A[0], A[1] + dy, A[2]); pt(_w2, sd * B[0], B[1] + dy, B[2]);
  const u = e * 3, i = u >= 2 ? 2 : u >= 1 ? 1 : 0, f = u - i, f2 = f * f, f3 = f2 * f, P0 = i === 2 ? _w1 : _g0, P1 = i === 0 ? _g0 : i === 1 ? _w1 : _w2, P2 = i === 0 ? _w1 : i === 1 ? _w2 : _g3, P3 = i === 0 ? _w2 : _g3;   // (Catmull–Rom, the ends doubled)
  _t.set(0, 0, 0).addScaledVector(P0, -0.5 * f3 + f2 - 0.5 * f).addScaledVector(P1, 1.5 * f3 - 2.5 * f2 + 1).addScaledVector(P2, -1.5 * f3 + 2 * f2 + 0.5 * f).addScaledVector(P3, 0.5 * f3 - 0.5 * f2);
  if(sd < 0 && i === 0) _t.addScaledVector(_cb, -K.cross * 4 * f * (1 - f));   // (round his LEFT from the right shoulder: across his chest, held out ahead of it)
  if(i < 2){ _x.copy(_cu).multiplyScalar(up); _y.copy(_cb).negate(); _z.crossVectors(_x, _y); _q1.setFromRotationMatrix(_cm.makeBasis(_x, _y, _z)); }
  if(i === 0) oq.copy(hq).slerp(_q1, f); else if(i === 1) oq.copy(_q1).slerp(flatQ(up, 0, _qa), f); else oq.copy(flatQ(up, 0, _qa)).slerp(sq, f);
  op.set(-gx, 0, 0).applyQuaternion(oq).add(_t); }
// HUNG IN FRONT on the sling → (op, oq), in his PELVIS' frame (his belly is not turned with his chest: hip joint → hip joint is his right, the world's
//   up, their cross ahead; the origin at the Spine joint): the grip's station by the right of his belly, the butt up to his right, the muzzle down to
//   his left (hang.pitch under the level), the gun's left side to him, its top up
function hangPose(D, k, len, ang, op, oq){ const K = GUNCARRY.hang, g = gunOf(k), pch = K.pitch + ang;
  D.RightUpLeg.getWorldPosition(_a).sub(D.LeftUpLeg.getWorldPosition(_b)); _a.y = 0; _a.normalize(); _n.set(_a.z, 0, -_a.x);   // (_a his right, _n ahead)
  _x.copy(_a).multiplyScalar(Math.cos(pch)).addScaledVector(UP, Math.sin(pch)); _z.copy(_n).negate(); _y.crossVectors(_z, _x); oq.setFromRotationMatrix(_cm.makeBasis(_x, _y, _z));
  D.Spine.getWorldPosition(op).addScaledVector(_a, K.at[0]).addScaledVector(UP, K.at[1]).addScaledVector(_n, K.at[2]).sub(_t.set(g.grip[0] * len, 0, 0).applyQuaternion(oq)); }
// a gun put where (p, q) says, under the frame the hold lays it in (G)
function place(m, G, p, q){ _cm.compose(p, q, _one); _mi.copy(G.matrixWorld).invert(); _cm.premultiply(_mi); _cm.decompose(m.position, m.quaternion, m.scale); m.updateMatrixWorld(true); }

// ---- bones ----
function aimB(b, c, dir){ b.getWorldPosition(_ix); c.getWorldPosition(_ie).sub(_ix); if(_ie.lengthSq() < 1e-10) return; _iq.setFromUnitVectors(_ie.normalize(), dir); b.getWorldQuaternion(_iqw).premultiply(_iq); b.parent.getWorldQuaternion(_iqp); b.quaternion.copy(_iqp.invert().multiply(_iqw)); b.updateMatrixWorld(true); }
// two-bone IK that never straightens the arm past `reach` of its length (actors/hands.js ik2, without its two clones a call)
function ikArm(a, b, c, t, pole, reach){ a.getWorldPosition(_ia); b.getWorldPosition(_ib); c.getWorldPosition(_ic); const l1 = _ia.distanceTo(_ib), l2 = _ib.distanceTo(_ic); _id.subVectors(t, _ia);
  const dist = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min((l1 + l2) * reach, _id.length())); _id.normalize(); const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _if.subVectors(pole, _ia); _if.addScaledVector(_id, -_if.dot(_id)); if(_if.lengthSq() < 1e-8) _if.set(0, -1, 0); _if.normalize();
  _ig.copy(_id).multiplyScalar(x).addScaledVector(_if, h).normalize(); aimB(a, b, _ig); _ig.copy(_ia).addScaledVector(_id, x).addScaledVector(_if, h); _it.copy(_ia).addScaledVector(_id, dist).sub(_ig).normalize(); aimB(b, c, _it); }
// his arms' bones, looked up once (a name put together from two strings every frame is an allocation), and each arm's length
function bonesOf(cy, D){ if(cy.B) return; const B = cy.B = { a:[], f:[], h:[], m:[], i:[], p:[] }; cy.aL = [0, 0];
  for(let i = 0; i < 2; i++){ const s = SIDE[i]; B.a[i] = D[s + 'Arm']; B.f[i] = D[s + 'ForeArm']; B.h[i] = D[s + 'Hand']; B.m[i] = D[s + 'HandMiddle1'] || null; B.i[i] = D[s + 'HandIndex1'] || null; B.p[i] = D[s + 'HandPinky1'] || null;
    B.a[i].getWorldPosition(_t); B.f[i].getWorldPosition(_t2); cy.aL[i] = _t.distanceTo(_t2) + _t2.distanceTo(B.h[i].getWorldPosition(_t)); } }
// a hand turned about its own length until its knuckle line runs along `along` (actors/hands.js rollHand, on the cached bones)
function roll(cy, i, along){ const h = cy.B.h[i], m = cy.B.m[i], i1 = cy.B.i[i], p1 = cy.B.p[i]; if(!m || !i1 || !p1) return; h.getWorldPosition(_ia); m.getWorldPosition(_ib); _ia.subVectors(_ib, _ia); if(_ia.lengthSq() < 1e-10) return; _ia.normalize();
  i1.getWorldPosition(_ic); p1.getWorldPosition(_ib); _ic.subVectors(_ib, _ic); _ic.addScaledVector(_ia, -_ic.dot(_ia)); _id.copy(along).addScaledVector(_ia, -along.dot(_ia)); if(_ic.lengthSq() < 1e-10 || _id.lengthSq() < 1e-10) return;
  const th = Math.atan2(_ib.crossVectors(_ic, _id).dot(_ia), _ic.dot(_id)); if(Math.abs(th) > 1e-4){ _iq.setFromAxisAngle(_ia, th); h.getWorldQuaternion(_iqw).premultiply(_iq); h.parent.getWorldQuaternion(_iqp); h.quaternion.copy(_iqp.invert().multiply(_iqw)); h.updateMatrixWorld(true); } }
// the way a hand should point eased toward its forearm until the wrist bends no more than max (actors/gun-hands.js wristGive, on the cached bones)
function give(fa, h, want, max, out){ out.copy(want); fa.getWorldPosition(_ia); h.getWorldPosition(_ib); _ib.sub(_ia); if(_ib.lengthSq() < 1e-8) return out; _ib.normalize(); const th = Math.acos(clamp(_ib.dot(want), -1, 1)); if(th <= max || th < 1e-3) return out;
  const k = (th - max) / th, s = Math.sin(th); return out.multiplyScalar(Math.sin((1 - k) * th) / s).addScaledVector(_ib, Math.sin(k * th) / s).normalize(); }
function setWorldQ(b, q){ b.parent.getWorldQuaternion(_iqp); b.quaternion.copy(_iqp.invert().multiply(q)); b.updateMatrixWorld(true); }
// his fingers as the clip left them (before the hold closes them round the gun): a hand that lets go opens back to this
function snap(cy, D){ if(!cy.fb){ cy.fb = []; for(const s of SIDE) for(const F of FING) for(let j = 1; j <= 4; j++){ const b = D[s + 'Hand' + F + j]; if(b) cy.fb.push(b); } cy.fq = new Float32Array(cy.fb.length * 4); cy.fs = cy.fb.map(b => b.name.includes('Right') ? 0 : 1); }
  for(let i = 0; i < cy.fb.length; i++) cy.fb[i].quaternion.toArray(cy.fq, i * 4); }

// ---- LOW READY and THE RUN CARRY (holdReal: the gun's place is decided, the hands are not on it yet). FR = the gun's frame and his own (p, q, x, y, z · r, u, f) ----
export function carryGun(R, D, FR, g, len, dt, P, low){ const C = GUNCARRY; if(!C.on) return; const cy = state(R), met = R.arms._metric[R.armK], p = S.player, cv = p && p.cav, foot = afoot(cv);
  if(met.parent !== R.arms._G){ R.arms._G.add(met); if(cy.wK === R.armK) cy.wK = null; }   // (it was worn on his back: back under the frame the hold lays it in)
  snap(cy, D); if(!foot) return;
  if((R.rdy || 0) > 1e-3 && (S.firing || cv.aimUp)) R.rdy *= Math.exp(-dt * C.shoulder.k);   // he aims / fires: the gun comes to his shoulder quicker than the low-ready fell (real-cav eases it at 5 /s)
  const K = C.run, fv = P && P.footV || 0, tuck = !!(P && P.move && P.move.roll >= 0), rd = (R.rdy || 0) * (1 - (R.spr || 0)) * (1 - low);
  const want = K.on && cv.stance === 'stand' && !tuck && !g.hold && !S.firing && !cv.aimUp && (R.rdy || 0) > 0.5 ? smooth((fv - K.v[0]) / (K.v[1] - K.v[0])) : 0;
  cy.run += (want - cy.run) * Math.min(1, dt * (want > cy.run ? K.rate[0] : K.rate[1])); const w = cy.run * (1 - (R.spr || 0)) * (1 - low); cy.runW = w;
  // low ready: the muzzle down to ready.pitch in all (real-cav gave it 0.35), turned about the butt — the stock stays in his shoulder
  const ex = cv.stance !== 'prone' && !g.hold && !tuck ? (C.ready.pitch - REALCAV.ready[1]) * rd * (1 - w) : 0;
  if(ex > 1e-3){ _t.set(g.butt[0] * len, g.butt[1], 0); _p.copy(_t).applyQuaternion(FR.q).add(FR.p); FR.q.premultiply(_q.setFromAxisAngle(FR.r, -ex)); FR.p.copy(_p).sub(_t.applyQuaternion(FR.q)); }
  if(w >= 0.002){ const ph = stride(R, cv), fall = Math.cos(2 * ph), pch = K.pitch + K.bob[1] * fall, yw = K.yaw + K.bob[2] * Math.sin(ph);   // (fall: +1 as a foot comes down)
    _x.copy(FR.f).multiplyScalar(Math.cos(pch) * Math.cos(yw)).addScaledVector(FR.r, -Math.cos(pch) * Math.sin(yw)).addScaledVector(FR.u, -Math.sin(pch)).negate();   // (+X runs back to the butt)
    _y.copy(FR.u).addScaledVector(_x, -FR.u.dot(_x)).normalize().applyAxisAngle(_x, K.roll); _z.crossVectors(_x, _y); _q.setFromRotationMatrix(_cm.makeBasis(_x, _y, _z));
    (D.Spine1 || D.Spine2).getWorldPosition(_p).addScaledVector(FR.r, K.at[0]).addScaledVector(FR.u, K.at[1] - K.bob[0] * fall).addScaledVector(FR.f, K.at[2] + K.bob[3] * Math.sin(ph)); if(R.gunLag) _p.add(R.gunLag);
    _p.sub(_t.set(g.grip[0] * len, g.grip[1], 0).applyQuaternion(_q)); FR.q.slerp(_q, w); FR.p.lerp(_p, w);
    const sp = R.spr || 0; if(sp > 0.01 && sp < 0.99) FR.p.addScaledVector(FR.f, K.clear * 4 * sp * (1 - sp) * cy.run); }   // (muzzle down ↔ muzzle up at a sprint: swung through out ahead of his chest, not through it)
  if(ex > 1e-3 || w >= 0.002){ FR.x.set(1, 0, 0).applyQuaternion(FR.q); FR.y.set(0, 1, 0).applyQuaternion(FR.q); FR.z.set(0, 0, 1).applyQuaternion(FR.q); } }

// ---- what his hands leave it for ('' = it stays in them). Only the page's own soldier decides; the other player's comes over the wire (cv.slung) ----
const FRONT = { knife:1, revive:1 };
function why(R, cy, P, p, cv, dt, now){ const K = GUNCARRY.sling; if(R.cyDev) return R.cyDev.why || '';   // (dev / the pose studio: CV.real.cyDev = { why:'patrol' | 'drone' | 'revive' | 'knife' | '' })
  if(bladeHeld(cv)) return 'blade';   // BLADE 2 the blade is in his hands (actors/blade.js): the rifle on his back, by the quick sling
  if(cv.mate) return cv.slung ? 'mate' : ''; if(cv !== CV) return '';
  const cw = climbW(); if(K.climb && cw > 0.001) return 'climb'; if(cv.mounted || cv.trans){ cy.quiet = 0; if(!K.mounted || cv.trans) return ''; }
  if(K.drone && fpvFlying()) return 'drone';
  if(QUIET.knifeAt !== cy.kAt){ cy.kAt = QUIET.knifeAt; if(cy.kAt > now && cy.kAt - now > LOGISTICS.quiet.knife.cd - 0.1) cy.knifeAt = now; }   // (game/quiet.js quietKnife has just struck)
  const inst = p.guns && p.guns[p.gunIdx], busy = S.firing || !!(inst && inst.rU) || !!(P && P.hit);
  if(K.knife && now - cy.knifeAt < K.knifeT && !S.firing) return 'knife';
  if(K.revive && MATE.on && MATE.down && MATE.revive > 0 && !busy) return 'revive';
  // on patrol: nobody has suspected him, he has not fired / aimed / reloaded / been hit, for quiet s; stood (crouching or lying down he means business)
  const calm = QUIET.eye === 0 && !busy && !cv.aimUp && cv.stance === 'stand' && !(P && P.move && (P.move.roll >= 0 || P.move.air)) && (P && P.footV || 0) < K.maxV;
  cy.quiet = calm ? cy.quiet + dt : 0; return K.patrol && cy.quiet >= K.quiet ? 'patrol' : ''; }

// ---- where a free hand goes (the wrist → _fr, the elbow's pole → _fp), by what he let the gun go for ----
function freeHand(R, cy, D, i, cv, P, now){ const H = GUNCARRY.hands, sd = i ? -1 : 1, sh = cy.B.a[i], L = cy.aL[i], st = cv.stance, w = cy.why; sh.getWorldPosition(_sh);
  if(w === 'drone'){ _fr.copy(_co).addScaledVector(_r, sd * H.drone[0]).addScaledVector(UP, H.drone[1]).addScaledVector(_f, H.drone[2]); _fp.copy(_sh).addScaledVector(UP, -0.4).addScaledVector(_r, sd * 0.3).addScaledVector(_f, -0.05); return; }
  if(w === 'revive'){ _fr.copy(_sh).addScaledVector(_r, -sd * H.revive[0]).addScaledVector(UP, H.revive[1]).addScaledVector(_f, H.revive[2]); _fp.copy(_sh).addScaledVector(UP, -0.2).addScaledVector(_r, sd * 0.4).addScaledVector(_f, 0.1); return; }
  if(w === 'knife' && i === 0){ const u = (now - cy.knifeAt) / GUNCARRY.sling.knifeT, k = u < 0.3 ? smooth(u / 0.3) : 1 - smooth((u - 0.3) / 0.7);   // (the thrust: out in a third of it, back over the rest)
    _fr.copy(_sh).addScaledVector(_f, H.knife[0] + (H.knife[1] - H.knife[0]) * k).addScaledVector(UP, H.knife[2]).addScaledVector(_r, -0.08 * k); _fp.copy(_sh).addScaledVector(UP, -0.3).addScaledVector(_r, 0.35).addScaledVector(_f, -0.2); return; }
  if(st === 'prone'){ _fr.copy(_sh).addScaledVector(_f, 0.34).addScaledVector(_r, sd * 0.06).addScaledVector(UP, -0.1); _fp.copy(_sh).addScaledVector(_r, sd * 0.5).addScaledVector(UP, -0.2); return; }   // (lying: forearms on the ground ahead of him)
  // hanging at his side, swinging against the leg of that side with his pace; crouched, a little ahead of the thigh
  const sp = Math.min(1, (P && P.footV || 0) / 3), a = (st === 'crouch' ? H.crouch : H.hang[2]) + H.swing * sp * Math.sin(stride(R, cv) + (i ? Math.PI : 0));
  _fr.copy(_sh).addScaledVector(UP, -Math.cos(a) * L * H.hang[1]).addScaledVector(_f, Math.sin(a) * L * H.hang[1]).addScaledVector(_r, sd * H.hang[0]);
  _fp.copy(_sh).addScaledVector(_f, -0.35).addScaledVector(UP, -0.25).addScaledVector(_r, sd * 0.12); }

// one arm: its wrist to the mix of the gun it holds (wn on the gun in his hands, wo on the one being stowed) and where it goes free
function arm(R, cy, D, i, wn, wo, tN, cv, P, now){ const sd = i ? -1 : 1, a = cy.B.a[i], b = cy.B.f[i], h = cy.B.h[i], m = cy.B.m[i], H = GUNCARRY.hands, wf = clamp(1 - wn - wo, 0, 1);
  b.getWorldPosition(_el); h.getWorldQuaternion(_hw); _tg.set(0, 0, 0); _pl.set(0, 0, 0);
  if(wn > 0){ _t.copy(cy.wl[i]).applyQuaternion(_nq).add(_np); _tg.addScaledVector(_t, wn); a.getWorldPosition(_sh).addScaledVector(UP, 0.25).addScaledVector(_r, sd * 0.4).addScaledVector(_cb, 0.1); _pl.addScaledVector(_el.lerp(_sh, smooth(tN * 1.5)), wn); }   // (the elbow where the hold has it; up and out as the gun goes round the shoulder)
  if(wo > 0){ _t.copy(cy.ol[i]).applyQuaternion(_oq).add(_op); _tg.addScaledVector(_t, wo); a.getWorldPosition(_sh).addScaledVector(UP, 0.25).addScaledVector(_r, sd * 0.4).addScaledVector(_cb, 0.1); _pl.addScaledVector(_sh, wo); }
  if(wf > 0){ freeHand(R, cy, D, i, cv, P, now); _tg.addScaledVector(_fr, wf); _pl.addScaledVector(_fp, wf); }
  ikArm(a, b, h, _tg, _pl, H.reach);
  // the hand: along its forearm and palm in when free, turned with the gun it is on
  if(m){ b.getWorldPosition(_t); h.getWorldPosition(_t2); _t2.sub(_t).normalize(); LEGKIT.aim(h, m, _t2); roll(cy, i, cy.why === 'drone' || cy.why === 'revive' ? _r : _f); }
  if(wn + wo > 0.001){ h.getWorldQuaternion(_q); if(wo > 0){ _q2.copy(_oq).multiply(cy.oq[i]); _q.slerp(_q2, wo); } if(wn > 0){ _q2.copy(_nq).multiply(cy.wq2[i]); _q.slerp(_q2, wn / Math.max(1e-4, wn + wf)); } setWorldQ(h, _q);
    if(m){ h.getWorldPosition(_t); m.getWorldPosition(_t2).sub(_t).normalize(); give(b, h, _t2, GUNFEEL.hold.wrist[i ? 1 : 0], _wg); LEGKIT.aim(h, m, _wg); } }   // (no wrist bent past a man's as the gun turns in his hand)
  // the fingers open back to the clip's as the hand comes off
  const on = clamp(wn + wo, 0, 1); if(on < 0.999) for(let j = 0; j < cy.fb.length; j++) if(cy.fs[j] === i) cy.fb[j].quaternion.slerp(_q.fromArray(cy.fq, j * 4), 1 - on); }

// ---- THE WEAPON WORN ON HIS BACK: hung on the Spine1 bone at its slot (its place in the bone's own frame worked out when it changes), rocking about its upper end ----
function backKind(R, p, cy){ const B = GUNCARRY.back, M = R.arms._metric, G = p && p.guns; if(!B.on || !G || G.length < 2 || !M) return null;
  let first = null; for(let i = 0; i < G.length; i++){ const k = kindOf(G[i].id); if(!k || k === R.armK || !M[k] || B.skip.includes(k)) continue; if(k === cy.bK) return k; if(!first) first = k; } return first; }
function wear(R, D, cy, k, sig, depth){ const m = R.arms._metric[k], b = D.Spine1, len = m.userData.len, up = upOf(k);
  if(cy.wK !== k || m.parent !== b || cy.wS !== sig || cy.wZ !== depth || cy.wP !== cy.pw){ if(cy.wK && cy.wK !== k && cy.wK !== R.armK) unwear(R, cy.wK);
    slot(k, len, sig, depth, 0, cy.pw, _sp, _sq); b.getWorldQuaternion(_q).invert(); b.getWorldScale(_ws); cy.wk = 1 / (_ws.x || 1); cy.wq.copy(_q).multiply(_sq);
    cy.wa.set(up * len / 2, 0, 0).applyQuaternion(_sq).add(_sp); b.worldToLocal(cy.wa); m.scale.setScalar(cy.wk); if(m.parent !== b) b.add(m); cy.wK = k; cy.wS = sig; cy.wZ = depth; cy.wP = cy.pw; }
  m.visible = true; m.quaternion.copy(cy.wq).multiply(_q.setFromAxisAngle(_z.set(0, 0, 1), -cy.ang * up)); m.position.set(-up * len / 2 * cy.wk, 0, 0).applyQuaternion(m.quaternion).add(cy.wa); m.updateMatrixWorld(true); }
function unwear(R, k){ const m = R.arms._metric[k]; if(!m) return; if(m.parent !== R.arms._G) R.arms._G.add(m); if(k !== R.armK) m.visible = false; }

// ---- THE SLING ITSELF: a ribbon of NP points from the gun's rear swivel to its front one, laid in G's frame. Three ways it runs, mixed by weight:
//   a shallow loop under the gun (what is left of wb + wh) · wb round his trunk for a gun on his back (over the shoulder its upper end is at, across
//   the chest, round the far side) · wh round his neck for a gun hung in front ----
let _mat = null;
function strapMesh(R, cy, j){ if(cy.st[j]) return cy.st[j]; const g = new THREE.BufferGeometry(), ix = []; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 6), 3));
  for(let i = 0; i + 1 < NP; i++) ix.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2); g.setIndex(ix);
  const m = new THREE.Mesh(g, _mat || (_mat = new THREE.MeshLambertMaterial({ color:GUNCARRY.strap.color, side:THREE.DoubleSide }))); m.name = 'gunSling'; m.frustumCulled = false; m.castShadow = false; R.arms._G.add(m); return (cy.st[j] = m); }
function anchors(n){ for(let i = 0; i < NP; i++){ const u = i / (NP - 1) * (n - 1), a = Math.min(n - 2, Math.floor(u)); _L[i].lerpVectors(_A[a], _A[a + 1], u - a); } }
function strap(R, cy, D, G, j, m, k, sig, wb, wh){ const K = GUNCARRY.strap, mesh = strapMesh(R, cy, j), len = m.userData.len, up = upOf(k), wl = clamp(1 - wb - wh, 0, 1); mesh.visible = true;
  m.updateWorldMatrix(true, false); _a.set(K.rear * len, K.under, 0).applyMatrix4(m.matrixWorld); _b.set(K.front * len, K.under, 0).applyMatrix4(m.matrixWorld);   // the two swivels
  for(let i = 0; i < NP; i++) _P[i].set(0, 0, 0);
  if(wl > 0) for(let i = 0; i < NP; i++){ const u = i / (NP - 1); _P[i].addScaledVector(_t.lerpVectors(_a, _b, u).addScaledVector(UP, -K.sag * 4 * u * (1 - u)), wl); }
  if(wb > 0){ const T = K.back, sd = sig >= 0 ? 1 : -1, hi = up > 0 ? _a : _b, lo = up > 0 ? _b : _a; _A[0].copy(hi); cy.B.a[sd > 0 ? 0 : 1].getWorldPosition(_A[1]).addScaledVector(UP, K.top).addScaledVector(_r, -sd * 0.04);   // (over the top of that shoulder)
    for(let i = 0; i < T.length; i++) pt(_A[2 + i], sd * T[i][0], T[i][1], T[i][2]); _A[2 + T.length].copy(lo); anchors(3 + T.length);
    if(up < 0) for(let i = 0; i < NP; i++) _P[i].addScaledVector(_L[NP - 1 - i], wb); else for(let i = 0; i < NP; i++) _P[i].addScaledVector(_L[i], wb); }
  if(wh > 0){ const T = K.neck; _A[0].copy(_a); cy.B.a[0].getWorldPosition(_A[1]).addScaledVector(UP, K.top).addScaledVector(_r, -0.04); (D.Neck || D.Spine2).getWorldPosition(_A[2]).addScaledVector(_f, -T[0]).addScaledVector(UP, T[1]);
    cy.B.a[1].getWorldPosition(_A[3]).addScaledVector(UP, K.top).addScaledVector(_r, 0.04); _A[4].copy(_b); anchors(5); for(let i = 0; i < NP; i++) _P[i].addScaledVector(_L[i], wh); }
  // the ribbon: its width lies along the surface it is on (square to its run and to the way out from his spine)
  const pos = mesh.geometry.attributes.position, arr = pos.array; _mi.copy(G.matrixWorld).invert();
  for(let i = 0; i < NP; i++){ _t.subVectors(_P[Math.min(NP - 1, i + 1)], _P[Math.max(0, i - 1)]); _n.subVectors(_P[i], _co); _n.addScaledVector(_cu, -_n.dot(_cu)); _w.crossVectors(_t, _n); if(_w.lengthSq() < 1e-10) _w.copy(_cu); _w.setLength(K.w / 2);
    _t2.copy(_P[i]).add(_w).applyMatrix4(_mi).toArray(arr, i * 6); _t2.copy(_P[i]).sub(_w).applyMatrix4(_mi).toArray(arr, i * 6 + 3); }
  pos.needsUpdate = true; }

// ---- every frame after the hold (actors/real-cav.js): the sling, the front hang, the swap, the weapon on his back, the hands, the straps ----
export function carryAfter(R, G, dt, P){ const C = GUNCARRY, D = R.pup && R.pup.D, M = R.arms._metric, met = M && M[R.armK]; if(!C.on || !D || !met || !met.visible || !D.Spine || !D.Spine1 || !D.Spine2 || !D.LeftShoulder || !D.RightShoulder || !D.LeftUpLeg || !D.RightUpLeg) return;
  const cy = state(R), p = S.player, cv = p && p.cav; if(!cv) return; const now = performance.now() / 1000, foot = afoot(cv), K = C.sling, SL = C.slot, len = met.userData.len, g = gunOf(R.armK), gx = g.grip[0] * len, mine = cv === CV && !R.cyDev, Z = SL.at[2];
  chest(R, cy, D); G.getWorldQuaternion(_q); _f.set(0, 0, 1).applyQuaternion(_q); _f.y = 0; _f.normalize(); _r.set(-_f.z, 0, _f.x);
  bonesOf(cy, D);
  cy.pw += ((foot && cv.stance === 'prone' ? 1 : 0) - cy.pw) * Math.min(1, dt * SL.prone[3]); if(cy.pw < 0.004) cy.pw = 0; else if(cy.pw > 0.996) cy.pw = 1;
  // a new gun in his hands: his right hand brings it round the right shoulder from where it was worn, his left takes the old one round the left side
  if(cy.k !== R.armK){ const old = cy.k; cy.k = R.armK;
    if(old && M[old] && cy.hOk && p.guns.length > 1 && C.swap.on){ const worn = cy.wK === R.armK || cy.bK === R.armK;
      if(cy.s > 0.5){ const s0 = cy.sg, z0 = cy.nz; cy.sg = worn ? Math.sign(cy.bs) || 1 : -s0; cy.nz = worn ? cy.bz : 0; cy.bs = s0; cy.bz = z0; cy.sw = 1; cy.oK = null; }   // (both on his back already: they stay where they lie, only whose is whose changes)
      else { cy.oK = old; cy.sw = 0; cy.nS = worn ? cy.bs : 1; cy.nZ = worn ? cy.bz : 0; cy.orp.copy(cy.hrp); cy.orq.copy(cy.hrq); for(let i = 0; i < 2; i++){ cy.ol[i].copy(cy.wl[i]); cy.oq[i].copy(cy.wq2[i]); }
        if(mine && foot){ const t = now + C.swap.block; if(p.fireAt < t){ p.fireAt = t; if(R.rc) R.rc.last = t; } } }   // (the trigger waits for it — no kick of a shot that was not fired)
      if(M[old].parent !== R.arms._G) R.arms._G.add(M[old]); M[old].visible = true; cy.bK = old; if(cy.wK === old) cy.wK = null; }
    else { cy.sw = 1; cy.oK = null; } cy.hOk = false; }
  const swap = cy.sw < 1; if(swap) cy.sw = Math.min(1, cy.sw + dt / (S.firing && mine ? Math.min(C.swap.t, C.swap.block) : C.swap.t));   // (a held trigger hurries it: done as the trigger frees)
  // the sling's weight: on (sling.t[0] s), off (t[1]; t[2] the moment he fires or aims); on a wall it keeps time with the climb. The front hang's: hang.t
  const wy = foot || K.mounted ? why(R, cy, P, p, cv, dt, now) : '', front = !!FRONT[wy], back = !!wy && !front; if(wy) cy.why = wy; const fast = S.firing || cv.aimUp || cy.why === 'blade';   // (BLADE 2 to the blade and back from it: the quick sling)
  const bK = swap ? null : backKind(R, p, cy), wears = !!(bK || swap) && (C.back.mounted || foot);
  if(back && cy.s <= 0){ cy.sg = wears ? -(Math.sign(cy.bs) || 1) : 1; cy.nz = wears ? SL.stack : 0; }   // (he slings it: to the diagonal that is free, over the one already there)
  cy.s = back ? Math.min(1, cy.s + dt / (fast ? K.t[2] : K.t[0])) : Math.max(0, cy.s - dt / (fast ? K.t[2] : K.t[1])); if(wy === 'climb') cy.s = Math.max(cy.s, climbW());
  cy.h = front ? Math.min(1, cy.h + dt / C.hang.t) : Math.max(0, cy.h - dt / C.hang.t); if(cy.s <= 0 && cy.h <= 0 && !wy) cy.why = '';
  const tIn = swap ? 1 - seg(cy.sw, C.swap.in, 1) : 0, tN = Math.max(cy.s, tIn), tO = swap ? seg(cy.sw, 0, C.swap.out) : 1; cy.tN = tN;
  // the rock of what hangs on him: a spring toward the stride's sway and the chest's sideways shove
  { const U = R.upper, sp = Math.min(1, (P && P.footV || 0) / 3), to = SL.sway * sp * Math.sin(stride(R, cv)) + (U ? clamp(-U.a.dot(_r) * SL.lag, -SL.max, SL.max) : 0);
    cy.angV += (-SL.k * (cy.ang - to) - 2 * SL.z * Math.sqrt(SL.k) * cy.angV) * dt; cy.ang = clamp(cy.ang + cy.angV * dt, -SL.max * 2, SL.max * 2); }
  // the gun in his hands as the hold left it, in the world; kept in the back's frame for a swap
  met.matrixWorld.decompose(_hp, _hq, _hs);
  if(tN < 1e-4 && cy.h < 1e-4 && !swap){ _t.copy(_hp).sub(_co); cy.hrp.set(_t.dot(_cr), _t.dot(_cu), _t.dot(_cb)); cy.hrq.copy(_cq).invert().multiply(_hq); cy.hOk = true; _q.copy(_hq).invert();
    for(let i = 0; i < 2; i++){ const h = cy.B.h[i]; h.getWorldPosition(cy.wl[i]).sub(_hp).applyQuaternion(_q); h.getWorldQuaternion(cy.wq2[i]).premultiply(_q); } }
  _np.copy(_hp); _nq.copy(_hq); const own = cy.s >= tIn;   // (own: it goes to / comes from its own sling slot; else it is coming off where it was worn)
  if(tN >= 1e-4){ slot(R.armK, len, own ? cy.sg : cy.nS, Z + (own ? cy.nz : cy.nZ), cy.ang, cy.pw, _sp, _sq); path(tN, R.armK, own ? cy.sg : 1, gx, _hp, _hq, _sp, _sq, _np, _nq); }
  if(cy.h >= 1e-4){ hangPose(D, R.armK, len, cy.ang, _fpos, _fq); const e = smooth(cy.h); _np.lerp(_fpos, e).addScaledVector(_f, C.hang.clear * 4 * e * (1 - e)); _nq.slerp(_fq, e); }   // (let down out ahead of his chest, not through it)
  if(tN >= 1e-4 || cy.h >= 1e-4) place(met, G, _np, _nq);
  // the one being stowed: from where his hands had it (kept in the back's frame) round his left to the mirror diagonal, over the one coming off
  if(swap){ const O = M[cy.oK], ol = O.userData.len; pt(_t2, cy.orp.x, cy.orp.y, cy.orp.z); _q3.copy(_cq).multiply(cy.orq);
    slot(cy.oK, ol, -1, Z + SL.stack, cy.ang, cy.pw, _sp, _sq); path(tO, cy.oK, -1, gunOf(cy.oK).grip[0] * ol, _t2, _q3, _sp, _sq, _op, _oq); O.visible = true; place(O, G, _op, _oq);
    if(K.strap) strap(R, cy, D, G, 1, O, cy.oK, -1, smooth(tO), 0); if(cy.sw >= 1){ cy.bs = -1; cy.bz = SL.stack; cy.oK = null; } }
  else if(bK && wears){ if(cy.bK !== bK){ cy.bK = bK; cy.bs = cy.s > 0.01 ? -cy.sg : 1; cy.bz = 0; }
    // worn: it slides across to the right-shoulder diagonal (the mirror while the other one lies there) and in under
    const to = cy.s > 0.01 ? -cy.sg : 1, st = dt * SL.slide; cy.bs += clamp(to - cy.bs, -st, st); cy.bz = Math.max(0, cy.bz - st * SL.stack); wear(R, D, cy, bK, cy.bs, Z + cy.bz + SL.stack * (1 - cy.bs * cy.bs) + (foot ? 0 : C.back.seat));
    if(K.strap) strap(R, cy, D, G, 1, M[bK], bK, cy.bs, 1, 0); }
  else { if(cy.wK){ unwear(R, cy.wK); cy.wK = null; } if(cy.bK){ unwear(R, cy.bK); cy.bK = null; } if(cy.st[1]) cy.st[1].visible = false; }   // (MERGE 13 one gun on him at a time — GUNCARRY.back.on false: the one a swap put away is not left drawn on his back)
  // the hands. In his hands with both on it: nothing is touched — the hold stands exactly as holdReal left it
  const cN = swap || !own || cy.sg > 0 ? 0 : 1, off = C.hands.off, hf = smooth(seg(cy.h, 0, 0.6)); let touched = false;
  for(let i = 0; i < 2; i++){ let wn = i === cN ? 1 - smooth(seg(tN, off[2], off[3])) : 1 - smooth(seg(tN, off[0], off[1])), wo = 0;
    if(swap){ wo = i === 1 ? 1 - smooth(seg(tO, off[2], off[3])) : 1 - smooth(seg(cy.sw, 0, 0.15)); wn = Math.min(wn, 1 - wo); }
    if(cy.h > 0 && !(cy.why === 'knife' && i === 1)) wn *= 1 - hf;   // (hung in front: both hands off it — the knife: the left stays on the handguard)
    cy.w[i] = wn; if(wn > 0.999 && tN < 1e-4 && cy.h < 1e-4) continue; if(cy.why === 'blade' && !swap) continue;   /* BLADE 2 his hands are the blade's: it lays his arms itself (bladeHold, next) */ touched = true; arm(R, cy, D, i, wn, wo, tN, cv, P, now); }
  if(touched){ const hs = clamp(Math.max(tN, cy.h) * 1.5, 0, 1); if(hs > 0.01 && foot && D.Head && cy.why !== 'climb') headLevel(D, UP, _f, _r, GUNFEEL.hold.cheek.head, hs); }   // (no gun at his cheek: the aim clip's hung head is brought up)
  const tE = Math.max(tN, cy.h); if(tE > 0.01 && foot) R.rdy = Math.max(R.rdy || 0, Math.min(1, tE * 2));   // (and the hold under it stays at the ready: no weld to a gun that is not at his shoulder, eyes where he walks)
  if(K.strap) strap(R, cy, D, G, 0, met, R.armK, own ? cy.sg : 1, smooth(tN) * (1 - smooth(cy.h)), smooth(cy.h)); else if(cy.st[0]){ cy.st[0].visible = false; if(cy.st[1]) cy.st[1].visible = false; }
  // the trigger waits while it comes back to his hands — never longer than sling.block (on a wall and flying the drone it is as it was)
  if(mine && foot && tE > K.clear && cy.why !== 'climb' && cy.why !== 'drone'){ const t = now + Math.min(K.block, tE * K.t[2]); if(p.fireAt < t){ p.fireAt = t; if(R.rc) R.rc.last = t; } }
  cy.done = true; }

// ---- on a wall (actors/soldier-climb-pose.js climbArms): true = the gun is this module's (it has just been laid by carryAfter, or — the hold skipped at the
//   top of the climb — is laid here, wholly in its slot, with the weapon worn on his back) ----
export function carryBack(R, G){ const C = GUNCARRY, D = R.pup && R.pup.D, M = R.arms._metric, met = M && M[R.armK]; if(!C.on || !C.sling.climb || !D || !met || !met.visible || !D.Spine1 || !D.Spine2 || !D.LeftShoulder || !D.RightShoulder) return false;
  const cy = state(R); if(cy.done){ cy.done = false; return true; } const p = S.player, Z = C.slot.at[2]; bonesOf(cy, D); chest(R, cy, D); G.getWorldQuaternion(_q); _f.set(0, 0, 1).applyQuaternion(_q); _f.y = 0; _f.normalize(); _r.set(-_f.z, 0, _f.x);
  if(met.parent !== R.arms._G){ R.arms._G.add(met); if(cy.wK === R.armK) cy.wK = null; } cy.k = R.armK; cy.sw = 1; cy.oK = null; cy.h = 0; cy.why = 'climb'; cy.pw = 0;
  const bK = backKind(R, p, cy); if(cy.s < 1){ cy.s = 1; cy.sg = bK ? -(Math.sign(cy.bs) || 1) : 1; cy.nz = bK ? C.slot.stack : 0; }
  slot(R.armK, met.userData.len, cy.sg, Z + cy.nz, 0, 0, _sp, _sq); place(met, G, _sp, _sq); if(C.sling.strap) strap(R, cy, D, G, 0, met, R.armK, cy.sg, 1, 0);
  if(bK){ cy.bK = bK; cy.ang = 0; cy.bs = -cy.sg; cy.bz = 0; wear(R, D, cy, bK, cy.bs, Z); if(C.sling.strap) strap(R, cy, D, G, 1, M[bK], bK, cy.bs, 1, 0); } return true; }

// ---- co-op (game/coop-glue.js myState): is this page's soldier's rifle on his back? One bit of the stance byte carries it to the other page ----
export function carrySlung(){ const R = CV.real, cy = R && R.cy; return !!(GUNCARRY.on && cy && cy.s > 0.5 && !CV.mounted); }
// dev: what the carry is doing (a probe, the pose studio)
export function carryProbe(){ const R = CV.real, cy = R && R.cy; return cy ? { s:+cy.s.toFixed(3), hang:+cy.h.toFixed(3), why:cy.why, run:+(cy.runW || 0).toFixed(3), swap:+cy.sw.toFixed(3), back:cy.wK, diag:cy.sg, backDiag:+cy.bs.toFixed(2), hands:[+cy.w[0].toFixed(3), +cy.w[1].toFixed(3)], quiet:+cy.quiet.toFixed(1) } : null; }
