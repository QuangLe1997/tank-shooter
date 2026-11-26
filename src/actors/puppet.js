// actors/puppet.js — Z294 A SECOND SOLDIER WEARING THE FIRST ONE'S MOVES: the Tripo special-forces soldier has his own Mixamo skeleton, but
// its rest pose, bone axes and units differ from the Meshy operator's, so the operator's rifle clips cannot simply be played on him (the
// limbs twist off). Instead the operator keeps running unseen with every clip he has (walk and fire, run and fire, charge, reloads standing /
// kneeling / prone, crouch-walk, throw, hit, fall, the two riding clips) and each frame the soldier's bones are turned, from the hips out to
// the hands and feet, to point the same way as the operator's in the world — direction by direction, so neither the units nor the rest pose
// matter. Each frame starts from his rest pose, so nothing drifts.
//
// POSE 1 THE WHOLE TURN, NOT ONLY THE DIRECTION (PUPPET.full; `?oldpuppet` = the copy above, for comparison). Pointing each bone at the operator's next
// joint lost two things. (1) Where a rigger PUT the joints: the operator's spine joints zig-zag (the lowest bone leans 49° back, the top one 50° forward),
// the soldier's run straight up — so the copy bent his waist 44° back and his chest 58° forward in every pose, his collar bones 62–67°, and tipped his
// feet 13° toe-down (his ankles sit lower). (2) The ROLL about each bone: shortest-arc turns from his rest left his elbows hinging 72° (mean) off the
// plane the arm really folds in, his knees 20°, his palms 88° round. Now:
//   · trunk, head, collar bones, feet, toes take the operator's turn AWAY FROM HIS REST laid over the soldier's own rest (both rest upright and square,
//     soles flat: Qd = Qs·K, K = Qs(rest)⁻¹·Qd(rest), one quaternion a bone, found once at load) — his own shape, the operator's movement;
//   · upper arms, forearms, thighs, shins keep the operator's direction (K's rest is swung to the operator's rest direction first), and their roll is
//     taken from the SECOND AXIS, the hinge: the plane the limb folds in (upper × lower) is where the elbow / knee must hinge, so the soldier's own hinge
//     axis (his side axis at rest, square to the bone — his own run / walk clips hinge within 3° of it) is turned onto it. A full copy of the operator's
//     roll would not do: his own ten clips hinge his elbows 45° off where the library's clips do (he is never seen, nobody noticed). Nearly straight
//     (PUPPET.hinge.bend) there is no plane: the roll eases back to the copied one;
//   · hands: the fingers' direction and the knuckle line (index → little finger root) matched at rest, then the whole turn copied;
//   · the twist is SHARED so the skin does not wring at one joint (neither rig has twist bones: 65 / 66 joints, all Mixamo's): the forearm takes
//     PUPPET.twist.fore of the wrist's twist, the shin .shin of the ankle's; a shoulder / hip twisted past .free hands .share of the rest to the elbow / knee;
//   · his legs are not the operator's length: each foot is brought to the height the operator's is off the ground (its lowest joint against where that
//     joint rests) — the hips set by the straighter leg (a straight leg cannot give), the other leg by a small two-bone correction, softened near full reach.
// limbTwist(P) re-seats the limbs' rolls the same way AFTER the gun hold / leg IK (shortest-arc IK leaves the roll wherever it fell) without moving a
// joint or a hand. Nothing is allocated per frame; each frame still starts from his rest pose.
//
// BODY 1 TWIST JOINTS (BODYFIX.twist; the soldier's file now carries <bone>Twist1…n under each forearm — tools/skin-repair.mjs addTwist). Sharing the
// wrist's roll half and half between elbow and wrist still wrung the skin at both: his decimated forearm is a dozen long triangles, and the support hand
// is rolled 120° and more on it. Where a limb has twist joints the bone itself keeps its hinge (no roll at the elbow: a forearm cannot roll there) and
// joint i is turned i/n of the hand's roll about the bone — the roll runs evenly down the forearm, as pronation does. The roll is read continuously (no
// flip from +180° to −180°), no more than `max` of it is laid along the forearm (a man's ±85°; the rest stays at the wrist), and after the gun hold an
// arm whose hand is rolled past `swivel.lim` on its forearm (or whose upper arm is rolled past `swivel.root` at the shoulder) has its ELBOW swung round
// the shoulder → wrist line (at most `swivel.max`) until the two carry the same share of what each can take: neither the shoulder nor the hand moves.
// BODY 4 read on from the last frame only up to BODYMEND.wrap (a little past 180°): read on further, a roll that went round in a reload stayed "+219°"
// when the hand was back on the gun at −141°, and the swivel swung the elbow the wrong way — both hands rolled 140–160° until the next stance change.
import * as THREE from 'three';
import { BODYFIX, BODYMEND, PUPPET } from '../../config.js';

// [bone, the child it points at] — parents before children
const CHAINS = [['Spine','Spine1'],['Spine1','Spine2'],['Spine2','Neck'],['Neck','Head'],
  ['LeftShoulder','LeftArm'],['LeftArm','LeftForeArm'],['LeftForeArm','LeftHand'],['LeftHand','LeftHandMiddle1'],
  ['RightShoulder','RightArm'],['RightArm','RightForeArm'],['RightForeArm','RightHand'],['RightHand','RightHandMiddle1'],
  ['LeftUpLeg','LeftLeg'],['LeftLeg','LeftFoot'],['LeftFoot','LeftToeBase'],['RightUpLeg','RightLeg'],['RightLeg','RightFoot'],['RightFoot','RightToeBase']];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qs = new THREE.Quaternion(), _qd = new THREE.Quaternion(), _m = new THREE.Matrix4();

// the frame of the hips: up (to the spine), side (left thigh to right thigh)
function hipFrame(B, out){ B.Hips.getWorldPosition(_a); B.Spine.getWorldPosition(_b); B.LeftUpLeg.getWorldPosition(_c); B.RightUpLeg.getWorldPosition(_d);
  _e.subVectors(_b, _a).normalize(); _f.subVectors(_d, _c); _f.addScaledVector(_e, -_f.dot(_e)).normalize(); _c.crossVectors(_f, _e);
  return out.setFromRotationMatrix(_m.makeBasis(_f, _e, _c)); }
const bones = (root, pre) => { const B = {}; root.traverse(o => { if(o.isBone && o.name.startsWith(pre)) B[o.name.slice(pre.length)] = o; }); return B; };

// src: the (hidden) operator's scene; dst: the soldier's scene — both under the same parent frame, facing the same way
export function makePuppet(src, dst, pre = 'mixamorig'){ const S = bones(src, pre), D = bones(dst, pre);
  const chains = CHAINS.filter(([b, c]) => S[b] && S[c] && D[b] && D[c]);
  if(!S.Hips || !D.Hips || !S.Spine || !D.Spine || !S.LeftUpLeg || !D.LeftUpLeg) return null;
  const rest = new Map(); for(const b of Object.values(D)) rest.set(b, b.quaternion.clone());
  // his limbs are not the operator's length (legs +10%, arms +11%, torso −13%): he keeps his own true height; on his feet he is set down so his feet meet the ground
  const len = (B, c) => { let s = 0; for(let i = 0; i + 1 < c.length; i++){ B[c[i]].getWorldPosition(_a); B[c[i + 1]].getWorldPosition(_b); s += _a.distanceTo(_b); } return s; }, LEG = ['LeftUpLeg', 'LeftLeg', 'LeftFoot'];
  src.updateMatrixWorld(true); dst.updateMatrixWorld(true); const legK = D.LeftFoot && S.LeftFoot ? len(S, LEG) / Math.max(1e-6, len(D, LEG)) : 1;
  return { S, D, chains, rest, restB:[...rest.keys()], restQ:[...rest.values()], dst, src, legK, F:fullSetup(S, D, src) }; }

// every frame, after the operator has been animated (and turned toward the aim)
export function drivePuppet(P){ if(!P) return; if(PUPPET.full && P.F) return driveFull(P); const { S, D, chains, rest, dst } = P;
  for(const [b, q] of rest) b.quaternion.copy(q); dst.updateMatrixWorld(true);
  // the hips: same place, same frame
  hipFrame(S, _qs); hipFrame(D, _qd); _q.copy(_qs).multiply(_qd.invert());
  const H = D.Hips; H.getWorldQuaternion(_qw); _qw.premultiply(_q); H.parent.getWorldQuaternion(_qp); H.quaternion.copy(_qp.invert().multiply(_qw));
  S.Hips.getWorldPosition(_a); if(P.offset) _a.add(P.offset); H.parent.worldToLocal(_a); H.position.copy(_a); H.updateMatrixWorld(true);
  // then each bone toward where the operator's points — Z304 and, once the spine is laid, the chest TWIST too (pointing a bone the same way says nothing
  //   of its turn about itself: without this his chest stayed square while the shoulders slid round it — the 'wrung-out' look)
  let twisted = false;
  for(const [b, c] of chains){ if(!twisted && !SPINE.has(b)){ twisted = true; chestTwist(S, D); }
    const sb = S[b], sc = S[c], db = D[b], dc = D[c];
    sb.getWorldPosition(_a); sc.getWorldPosition(_b); _e.subVectors(_b, _a); if(_e.lengthSq() < 1e-10) continue; _e.normalize();
    db.getWorldPosition(_c); dc.getWorldPosition(_d); _f.subVectors(_d, _c); if(_f.lengthSq() < 1e-10) continue; _f.normalize();
    _q.setFromUnitVectors(_f, _e); db.getWorldQuaternion(_qw); _qw.premultiply(_q); db.parent.getWorldQuaternion(_qp); db.quaternion.copy(_qp.invert().multiply(_qw)); db.updateMatrixWorld(true); }
  // standing, walking, kneeling, lying: his lowest foot onto the operator's (seated, the hips on the seat rule instead)
  if(P.ground){ const low = B => { let y = Infinity; for(const n of FEET) if(B[n]){ B[n].getWorldPosition(_a); y = Math.min(y, _a.y); } return y; }, dy = low(S) - low(D);
    if(isFinite(dy) && Math.abs(dy) > 1e-4){ H.getWorldPosition(_a); _a.y += dy; H.parent.worldToLocal(_a); H.position.copy(_a); H.updateMatrixWorld(true); } } }
const FEET = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'];
const SPINE = new Set(['Spine', 'Spine1', 'Spine2']), TWIST = [['Spine', 0.3], ['Spine1', 0.3], ['Spine2', 0.4]];
const _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _tx = new THREE.Vector3(), _tq = new THREE.Quaternion();
// the turn of the chest about the spine: the shoulder line (left arm → right arm) of the soldier brought round to the operator's, spread up the spine
function chestTwist(S, D){ if(!S.LeftArm || !S.RightArm || !D.LeftArm || !D.RightArm || !D.Spine2 || !D.Neck) return;
  D.Spine2.getWorldPosition(_ta); D.Neck.getWorldPosition(_tb); _tx.subVectors(_tb, _ta); if(_tx.lengthSq() < 1e-10) return; _tx.normalize();
  S.RightArm.getWorldPosition(_ta); S.LeftArm.getWorldPosition(_tb); _ta.sub(_tb); D.RightArm.getWorldPosition(_tb); D.LeftArm.getWorldPosition(_e); _tb.sub(_e);
  _ta.addScaledVector(_tx, -_ta.dot(_tx)); _tb.addScaledVector(_tx, -_tb.dot(_tx)); if(_ta.lengthSq() < 1e-8 || _tb.lengthSq() < 1e-8) return;
  const th = Math.atan2(_e.crossVectors(_tb, _ta).dot(_tx), _tb.dot(_ta)); if(Math.abs(th) < 1e-3) return;
  for(const [n, f] of TWIST){ const b = D[n]; if(!b) continue; _tq.setFromAxisAngle(_tx, th * f); b.getWorldQuaternion(_qw); _qw.premultiply(_tq); b.parent.getWorldQuaternion(_qp); b.quaternion.copy(_qp.invert().multiply(_qw)); b.updateMatrixWorld(true); } }

// ---- POSE 1 the whole turn ----
const TRUNK = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder'], LIMBS = [['Arm', 'ForeArm', 'Hand', 'Shoulder'], ['UpLeg', 'Leg', 'Foot', null]], ENDS = ['Foot', 'ToeBase'];
const _mr = new THREE.Matrix4(), _u = new THREE.Vector3(), _v = new THREE.Vector3(), _h = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _pc = new THREE.Vector3(), _pt = new THREE.Vector3(), _kn = new THREE.Vector3();
const _sv = new THREE.Vector3(), _sh2 = new THREE.Vector3();   // BODY 5 the swing's wrist check
const _qu = new THREE.Quaternion(), _ql = new THREE.Quaternion(), _qe = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _q0 = new THREE.Quaternion(), _ps = [new THREE.Vector3(), new THREE.Vector3()], _sh = [0, 0], _ex = [0, 0];
const smooth = k => (k = k < 0 ? 0 : k > 1 ? 1 : k, k * k * (3 - 2 * k)), wpos = (o, out) => out.setFromMatrixPosition(o.matrixWorld);
// a node's world turn off its world matrix (its scale taken out; no parent walked, nothing allocated)
function wquat(o, out){ const e = o.matrixWorld.elements, sx = 1 / Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]), sy = 1 / Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]), sz = 1 / Math.sqrt(e[8] * e[8] + e[9] * e[9] + e[10] * e[10]);
  return out.setFromRotationMatrix(_mr.set(e[0] * sx, e[4] * sy, e[8] * sz, 0, e[1] * sx, e[5] * sy, e[9] * sz, 0, e[2] * sx, e[6] * sy, e[10] * sz, 0, 0, 0, 0, 1)); }
// the turn about unit axis d that brings a round to b (both put square to d), rad
function about(a, b, d){ _x.copy(a).addScaledVector(d, -a.dot(d)); _y.copy(b).addScaledVector(d, -b.dot(d)); if(_x.lengthSq() < 1e-10 || _y.lengthSq() < 1e-10) return 0; return Math.atan2(_h.crossVectors(_x, _y).dot(d), _x.dot(_y)); }
// how far q turns about unit axis d (the twist of its swing-twist split), rad in −π…π
function twistOf(q, d){ let t = 2 * Math.atan2(q.x * d.x + q.y * d.y + q.z * d.z, q.w); return t > Math.PI ? t - 2 * Math.PI : t < -Math.PI ? t + 2 * Math.PI : t; }

// once, both in their rest pose under the same parent, facing the same way: K for every bone that is copied, each limb's hinge, where the feet rest
function fullSetup(S, D, src){ const need = ['Hips', 'Spine', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand'];
  if(need.some(n => !S[n] || !D[n])) return null; const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion(), wp = b => b.getWorldPosition(V()), wq = b => b.getWorldQuaternion(Q());
  for(const B of [S, D]){ const sc = B.Hips.getWorldScale(V()); if(Math.abs(sc.x - sc.y) > 1e-3 * sc.x || Math.abs(sc.x - sc.z) > 1e-3 * sc.x || B.Hips.matrixWorld.determinant() < 0) return null; }   // (a stretched or mirrored rig: the old copy)
  const up = V().set(0, 1, 0).transformDirection(src.parent ? src.parent.matrixWorld : src.matrixWorld), left = wp(D.LeftUpLeg).sub(wp(D.RightUpLeg)); left.addScaledVector(up, -left.dot(up)).normalize(); const fwd = V().crossVectors(left, up);
  const bones = [], at = {}, add = (n, K) => { const d = D[n], par = d.parent === D.Hips.parent ? -1 : bones.findIndex(e => e.d === d.parent); if(n !== 'Hips' && par < 0) return false; at[n] = bones.length; bones.push({ n, s:S[n], d, K, par, Q:Q(), r0:d.quaternion.clone(), hk:n === 'Neck' ? 0 : n === 'Head' ? 1 : null }); return true; };
  const delta = n => wq(S[n]).invert().multiply(wq(D[n])), dir = (B, a, b) => wp(B[b]).sub(wp(B[a])).normalize();
  const swung = (n, c) => wq(S[n]).invert().multiply(Q().setFromUnitVectors(dir(D, n, c), dir(S, n, c))).multiply(wq(D[n]));   // his rest swung (the short way) to point where the operator's rests
  // the hand: the fingers' direction, then the knuckle line about it (as tools/mixamo-clips.mjs lays Mixamo's hands on the operator)
  const hand = h => { const m = h + 'Middle1', i = h + 'Index1', p = h + 'Pinky1'; if([m, i, p].some(n => !S[n] || !D[n])) return delta(h); const ds = dir(S, h, m), a1 = Q().setFromUnitVectors(dir(D, h, m), ds);
    const kd = dir(D, i, p).applyQuaternion(a1), ks = dir(S, i, p); return wq(S[h]).invert().multiply(Q().setFromAxisAngle(ds, about(kd, ks, ds))).multiply(a1).multiply(wq(D[h])); };
  let ok = true; for(const n of TRUNK.slice(0, 6)) if(S[n] && D[n]) ok = add(n, delta(n)) && ok;
  for(const s of ['Left', 'Right']){ const sh = s + 'Shoulder'; if(S[sh] && D[sh]) ok = add(sh, delta(sh)) && ok; ok = add(s + 'Arm', swung(s + 'Arm', s + 'ForeArm')) && add(s + 'ForeArm', swung(s + 'ForeArm', s + 'Hand')) && add(s + 'Hand', hand(s + 'Hand')) && ok; }
  for(const s of ['Left', 'Right']){ ok = add(s + 'UpLeg', swung(s + 'UpLeg', s + 'Leg')) && add(s + 'Leg', swung(s + 'Leg', s + 'Foot')) && add(s + 'Foot', delta(s + 'Foot')) && ok; if(S[s + 'ToeBase'] && D[s + 'ToeBase']) ok = add(s + 'ToeBase', delta(s + 'ToeBase')) && ok; }
  if(!ok) return null;   // (a joint between two copied bones that the names do not know: the old copy)
  // each limb: its hinge axis in the upper and the lower bone's own frame — his side axis at rest, square to the bone (elbows fold forward, knees back);
  //   how the upper bone sits on its parent and the end (hand / foot) on the lower bone at rest (the twist across a joint is counted from there)
  const limbs = []; for(const s of ['Left', 'Right']) for(const [un, ln, en, pn] of LIMBS){ const u = D[s + un], l = D[s + ln], e = D[s + en], p = u.parent, arm = un === 'Arm', du = dir(D, s + un, s + ln), dl = dir(D, s + ln, s + en);
    const a = arm ? V().crossVectors(du, fwd) : V().crossVectors(fwd, du); if(a.lengthSq() < 1e-6) return null; a.normalize(); const al = a.clone().addScaledVector(dl, -a.dot(dl)).normalize();
    const tj = []; for(let i = 1; D[s + ln + 'Twist' + i] && D[s + ln + 'Twist' + i].parent === l; i++) tj.push(D[s + ln + 'Twist' + i]);   // BODY 1 (none in a file without them: the roll is shared as before)
    limbs.push({ u, l, e, p, arm, au:a.applyQuaternion(wq(u).invert()), al:al.applyQuaternion(wq(l).invert()), relU:wq(p).invert().multiply(wq(u)).invert(), relE:wq(l).invert().multiply(wq(e)).invert(), iu:at[s + un], il:at[s + ln], ie:at[s + en], tj:tj.length ? tj : null, ta:e.position.clone().normalize(), tm:0, sw:0, hm:0, hd:arm && D[s + 'HandMiddle1'] ? dir(D, s + 'Hand', s + 'HandMiddle1').applyQuaternion(wq(e).invert()) : null }); }   // (BODY 5 hd: the hand's own pointing — to the middle finger's root — in its frame)
  // where each foot joint rests over the ground (the parent frame's up), in the world's metres; the operator's hips over his feet
  const P0 = src.parent || src, k = V().setFromMatrixColumn(P0.matrixWorld, 1).length(), hy = (B, n) => P0.worldToLocal(wp(B[n])).y * k, feet = [];
  for(const s of ['Left', 'Right']){ const J = ENDS.map(e => s + e).filter(n => S[n] && D[n]); feet.push({ s:J.map(n => S[n]), d:J.map(n => D[n]), rs:J.map(n => hy(S, n)), rd:J.map(n => hy(D, n)), it:at[s + 'UpLeg'], is:at[s + 'Leg'], ik:at[s + 'Foot'], au:limbs[s === 'Left' ? 1 : 3].au }); }
  const hipH = hy(S, 'Hips') - Math.min(...feet.flatMap(f => f.rs));
  // his own flat foot (actors/soldier-legs.js stands him on it): the slope of ankle → ball and the ball joint's height, as his sole rests on the ground
  const fl = ['Left', 'Right'].filter(s => D[s + 'ToeBase']).map(s => [Math.asin(Math.max(-1, Math.min(1, dir(D, s + 'Foot', s + 'ToeBase').dot(up)))), hy(D, s + 'ToeBase')]), foot = fl.length ? { slope:fl.reduce((t, f) => t + f[0], 0) / fl.length, toeH:fl.reduce((t, f) => t + f[1], 0) / fl.length, up:new Map(['Left', 'Right'].map(s => [D[s + 'Foot'], up.clone().applyQuaternion(wq(D[s + 'Foot']).invert())])) } : null;
  // the same rig on both sides (the steel operator worn by his own clips): a plain copy, nothing to match and no hinge of his own to impose
  const same = bones.every(e => 2 * Math.acos(Math.min(1, Math.abs(e.K.w))) < 0.01);
  return { bones, limbs, feet, hipH, same, foot }; }

function driveFull(P){ const S = P.S, D = P.D, F = P.F, src = P.src, B = F.bones, H = D.Hips, n = B.length, rb = P.restB, rq = P.restQ;
  for(let i = 0; i < rb.length; i++) rb[i].quaternion.copy(rq[i]);
  src.updateMatrixWorld(true); H.parent.updateWorldMatrix(true, false); wquat(H.parent, _qp);
  // every copied bone, parents first: its world turn = the operator's · K, laid in under its parent's
  for(let i = 0; i < n; i++){ const e = B[i], pq = e.par < 0 ? _qp : B[e.par].Q; wquat(e.s, e.Q).multiply(e.K);
    if(e.hk != null){ const k = (P.ground ? PUPPET.head.foot : PUPPET.head.sat)[e.hk]; if(k < 1) e.Q.copy(_q.copy(pq).multiply(e.r0).slerp(e.Q, k)); }   // (neck / head: only a share of the clip's turn on the chest — the hold lays his eyes on the aim)
    e.d.quaternion.copy(pq).invert().multiply(e.Q); }
  wpos(S.Hips, _a); if(P.offset) _a.add(P.offset); H.parent.worldToLocal(_a); H.position.copy(_a); H.updateMatrixWorld(true);
  if(P.ground && PUPPET.feet.on) plant(P);
  if(!F.same) limbs(F, true); }

// his feet at the height the operator's are off the ground (standing, walking, kneeling; lying down the lowest foot joint, as before)
function plant(P){ const S = P.S, D = P.D, F = P.F, C = PUPPET.feet, H = D.Hips, B = F.bones; let loY = Infinity, loD = Infinity;
  for(let i = 0; i < 2; i++){ const f = F.feet[i]; let cs = Infinity, cd = Infinity; for(let j = 0; j < f.s.length; j++){ const ys = f.s[j].matrixWorld.elements[13], yd = f.d[j].matrixWorld.elements[13]; cs = Math.min(cs, ys - f.rs[j]); cd = Math.min(cd, yd - f.rd[j]); loY = Math.min(loY, ys); loD = Math.min(loD, yd); }
    _sh[i] = cs - cd;   // (how far up this foot has to go)
    const t = B[f.it].d, s = B[f.is].d, k = B[f.ik].d; wpos(t, _pa); wpos(s, _pb); wpos(k, _pc); _ex[i] = _pa.distanceTo(_pc) / (_pa.distanceTo(_pb) + _pb.distanceTo(_pc)); }
  // upright (his hips well over his feet) the straighter leg sets the hips; down on the ground the lowest joint does
  const up = isFinite(_sh[0]) && isFinite(_sh[1]) ? smooth(((S.Hips.matrixWorld.elements[13] - loY) / F.hipH - C.upright[0]) / (C.upright[1] - C.upright[0])) : 0;
  const wl = Math.max(0, Math.min(1, 0.5 + (_ex[0] - _ex[1]) * C.lead)), low = loY - loD, dy = isFinite(low) ? low + ((up ? _sh[0] * wl + _sh[1] * (1 - wl) : 0) - low) * up : 0;
  if(!isFinite(dy)) return; if(Math.abs(dy) > 1e-5){ wpos(H, _a); _a.y += dy; H.parent.worldToLocal(_a); H.position.copy(_a); }
  if(up > 0.001) for(let i = 0; i < 2; i++){ const f = F.feet[i], c = Math.max(-C.max, Math.min(C.max, (_sh[i] - dy) * up)); if(Math.abs(c) < 1e-4) continue;
    const T = B[f.it], Sn = B[f.is], K = B[f.ik]; wpos(T.d, _pa); wpos(Sn.d, _pb); wpos(K.d, _pc); const l1 = _pa.distanceTo(_pb), l2 = _pb.distanceTo(_pc), L = l1 + l2;
    _u.subVectors(_pb, _pa).divideScalar(l1); _v.subVectors(_pc, _pb).divideScalar(l2); _pt.copy(_pc); _pt.y += c; _x.subVectors(_pt, _pa); let d = _x.length(); if(d < 1e-4) continue; _x.divideScalar(d);
    // a leg near its full length is corrected less and less (none at `reach`: there a millimetre is degrees of knee — it would snap), and never stretched past it
    const dc = _pa.distanceTo(_pc), d1 = L * C.reach; d = dc + (d - dc) * (1 - smooth((dc / L - C.reach + C.soft) / C.soft)); d = Math.max(Math.min(d, Math.max(dc, d1)), Math.abs(l1 - l2) + 1e-3);
    const ax = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - ax * ax));
    _y.subVectors(_pb, _pa); _y.addScaledVector(_x, -_y.dot(_x)); if(_y.lengthSq() < 1e-8) _y.crossVectors(_x, _h.copy(f.au).applyQuaternion(T.Q)); _y.normalize();   // (the knee stays on the side it is on; dead straight: ahead of his own hinge)
    _kn.copy(_pa).addScaledVector(_x, ax).addScaledVector(_y, hh); _pt.copy(_pa).addScaledVector(_x, d);
    _h.subVectors(_kn, _pa).normalize(); T.Q.premultiply(_q.setFromUnitVectors(_u, _h)); _h.subVectors(_pt, _kn).normalize(); Sn.Q.premultiply(_q.setFromUnitVectors(_v, _h));
    T.d.quaternion.copy(B[T.par].Q).invert().multiply(T.Q); Sn.d.quaternion.copy(T.Q).invert().multiply(Sn.Q); K.d.quaternion.copy(Sn.Q).invert().multiply(K.Q); }
  H.updateMatrixWorld(true); }

// the limbs' rolls: each hinge onto the plane its limb folds in, the twist shared along the limb. Turns bones about their own length only: no joint,
//   hand or foot moves. clip = the pose came from a clip (a limb found bent the wrong way round keeps the copied roll); after IK the fold is always the pole's
// BODY 1 the end's (hand's / foot's) roll on its lower bone once that bone's hinge is on the fold: rad, about _v; from _u _v _ql _qe as they stand
function endRoll(L, HG){ _kn.crossVectors(_u, _v); const sn = _kn.length(), w = smooth((Math.atan2(sn, _u.dot(_v)) - HG.bend[0]) / (HG.bend[1] - HG.bend[0])); _qs.copy(_ql);
  if(w > 0){ _kn.divideScalar(sn); _qs.premultiply(_q.setFromAxisAngle(_v, about(_pt.copy(L.al).applyQuaternion(_ql), _kn, _v) * w)); }
  return twistOf(_qr.copy(_qe).multiply(L.relE).multiply(_q0.copy(_qs).invert()), _v); }
// … and the upper bone's roll on its parent (shoulder / hip), its own hinge on the fold: rad, about _u
function rootRoll(L, HG){ _kn.crossVectors(_u, _v); const sn = _kn.length(), w = smooth((Math.atan2(sn, _u.dot(_v)) - HG.bend[0]) / (HG.bend[1] - HG.bend[0])); _qs.copy(_qu);
  if(w > 0){ _kn.divideScalar(sn); _qs.premultiply(_q.setFromAxisAngle(_u, about(_pt.copy(L.au).applyQuaternion(_qu), _kn, _u) * w)); }
  return twistOf(_qr.copy(_qs).multiply(L.relU).multiply(_q0.copy(_qp).invert()), _u); }
function limbs(F, clip){ const HG = PUPPET.hinge, TW = PUPPET.twist, BT = BODYFIX.twist, SW = BT.swivel;
  for(let i = 0; i < F.limbs.length; i++){ const L = F.limbs[i], u = L.u, l = L.l, e = L.e, p = L.p; if(!clip){ p.updateWorldMatrix(true, false); u.updateWorldMatrix(false, true); }
    wpos(u, _pa); wpos(l, _pb); wpos(e, _pc); _u.subVectors(_pb, _pa); _v.subVectors(_pc, _pb); if(_u.lengthSq() < 1e-10 || _v.lengthSq() < 1e-10) continue; _u.normalize(); _v.normalize();
    wquat(p, _qp); wquat(u, _qu); wquat(l, _ql); wquat(e, _qe);
    // BODY 1 after the hold: a hand rolled past what a forearm takes — the elbow swung round the shoulder → wrist line (the hand and the shoulder stay)
    if(!clip && L.arm && L.tj && SW.on){ let r = endRoll(L, HG); if(r - L.tm > Math.PI) r -= 2 * Math.PI; else if(r - L.tm < -Math.PI) r += 2 * Math.PI; const s = rootRoll(L, HG), k = Math.max(Math.abs(r) / SW.lim, Math.abs(s) / SW.root); let want = 0;
      // (swung by ψ the forearm's roll falls by ψ·a and the upper arm's rises by ψ·b: the two are brought to the same share of what each takes)
      if(k > 1){ _x.subVectors(_pc, _pa).normalize(); const a = Math.max(0.35, _x.dot(_v)), b = Math.max(0.2, _x.dot(_u)); want = Math.max(-SW.max, Math.min(SW.max, (r * SW.root - s * SW.lim) / (a * SW.root + b * SW.lim))) * smooth((k - 1) / SW.soft); }
      // BODY 5 swinging the elbow turns the forearm under a hand that stays put: the wrist bends by it. The swing is cut back (halved toward 0) until the
      //   wrist bends no more than BODYMEND.swivelWrist, or no more than it already did — the right hand on an AK's grip had its wrist bent 65–73°
      if(Math.abs(want) > 1e-4 && L.hd && BODYMEND.swivelWrist){ _x.subVectors(_pc, _pa).normalize(); _sh2.copy(L.hd).applyQuaternion(_qe); const bend = a => Math.acos(Math.max(-1, Math.min(1, _sv.copy(_v).applyAxisAngle(_x, a).dot(_sh2)))), lim = Math.max(BODYMEND.swivelWrist, bend(0));
        if(bend(want) > lim){ let lo = 0, hi = want; for(let it = 0; it < 8; it++){ const mid = (lo + hi) / 2; if(bend(mid) > lim) hi = mid; else lo = mid; } want = lo; } }
      L.sw = want; if(Math.abs(want) > 1e-4){ _x.subVectors(_pc, _pa).normalize(); _q.setFromAxisAngle(_x, want); _qu.premultiply(_q); _ql.premultiply(_q); _u.applyQuaternion(_q); _v.applyQuaternion(_q); } }
    _kn.crossVectors(_u, _v); const sn = _kn.length(); let w = smooth((Math.atan2(sn, _u.dot(_v)) - HG.bend[0]) / (HG.bend[1] - HG.bend[0])), tu = 0, tl = 0;
    if(w > 0){ _kn.divideScalar(sn); tu = about(_pt.copy(L.au).applyQuaternion(_qu), _kn, _u); tl = about(_pt.copy(L.al).applyQuaternion(_ql), _kn, _v);
      if(clip) w *= 1 - smooth((Math.abs(tu) - HG.flip[0]) / (HG.flip[1] - HG.flip[0])); tu *= w; tl *= w; }
    // the root joint (shoulder / hip) twisted past what the skin there takes: a share of the excess is handed down to the elbow / knee
    const R = L.arm ? TW.upper : TW.thigh; _qu.premultiply(_q.setFromAxisAngle(_u, tu)); _qr.copy(_qu).multiply(L.relU).multiply(_q0.copy(_qp).invert()); const tr = twistOf(_qr, _u), over = Math.abs(tr) - R.free;
    if(over > 0) _qu.premultiply(_q.setFromAxisAngle(_u, -Math.sign(tr) * Math.min(R.cap, over * R.share)));
    // the lower bone: its hinge, then its share of the twist the end (hand / foot) has on it
    _ql.premultiply(_q.setFromAxisAngle(_v, tl)); _qr.copy(_qe).multiply(L.relE).multiply(_q0.copy(_ql).invert()); let tw = twistOf(_qr, _v);
    if(L.tj){ if(!clip){ if(tw - L.tm > Math.PI) tw -= 2 * Math.PI; else if(tw - L.tm < -Math.PI) tw += 2 * Math.PI; if(Math.abs(tw) > BODYMEND.wrap) tw = twistOf(_qr, _v); L.tm = tw; }   // (read on from last frame: a hand right round does not flip the forearm)
      tw = Math.max(-BT.max, Math.min(BT.max, tw)); const J = L.tj, nj = J.length; for(let k = 0; k < nj; k++) J[k].quaternion.setFromAxisAngle(L.ta, tw * (k + 1) / nj); }   // BODY 1 the roll laid along the bone's twist joints; the bone keeps its hinge
    else { const te = Math.max(-TW.max, Math.min(TW.max, tw)) * (L.arm ? TW.fore : TW.shin); if(Math.abs(te) > 1e-5) _ql.premultiply(_q.setFromAxisAngle(_v, te)); }
    u.quaternion.copy(_qp).invert().multiply(_qu); l.quaternion.copy(_qu).invert().multiply(_ql); e.quaternion.copy(_ql).invert().multiply(_qe); u.updateMatrixWorld(true); } }
// a foot that has just been pointed (actors/soldier-legs.js): its sole's side edge laid level — turned about ankle → ball until what is up at rest is up
//   again as far as that line allows (pointing a bone says nothing of its roll: a sole stood tipped up to 17° on its edge)
export function footLevel(P, foot, toe){ const F = P && P.F, up = PUPPET.full && F && !F.same && F.foot && F.foot.up.get(foot); if(!up || !toe) return;
  foot.updateWorldMatrix(true, false); toe.updateWorldMatrix(false, false); wpos(foot, _pa); wpos(toe, _pb); _u.subVectors(_pb, _pa); if(_u.lengthSq() < 1e-10) return; _u.normalize();
  wquat(foot, _qu); const th = about(_pt.copy(up).applyQuaternion(_qu), _kn.set(0, 1, 0), _u); if(Math.abs(th) < 1e-4) return;
  wquat(foot.parent, _qp); _qu.premultiply(_q.setFromAxisAngle(_u, th)); foot.quaternion.copy(_qp).invert().multiply(_qu); foot.updateMatrixWorld(true); }
// BODY 1 a hand that holds nothing fixed (the left hand in a reload: a magazine goes where the palm is, whichever way it is turned) is turned about its
//   forearm until it is rolled no more than max rad on it — the wrist does not move. side = 'Left' / 'Right'; after that arm's IK
export function handRoll(P, side, max){ const F = P && P.F; if(!F || !PUPPET.full || F.same) return; const L = F.limbs[side === 'Left' ? 0 : 2], u = L.u, l = L.l, e = L.e; if(!L.arm) return;
  L.p.updateWorldMatrix(true, false); u.updateWorldMatrix(false, true); wpos(u, _pa); wpos(l, _pb); wpos(e, _pc); _u.subVectors(_pb, _pa); _v.subVectors(_pc, _pb); if(_u.lengthSq() < 1e-10 || _v.lengthSq() < 1e-10) return; _u.normalize(); _v.normalize();
  wquat(l, _ql); wquat(e, _qe); let r = endRoll(L, PUPPET.hinge); if(r - L.hm > Math.PI) r -= 2 * Math.PI; else if(r - L.hm < -Math.PI) r += 2 * Math.PI; if(Math.abs(r) > BODYMEND.wrap) r = endRoll(L, PUPPET.hinge); L.hm = r;
  const over = r - Math.max(-max, Math.min(max, r)); if(Math.abs(over) < 1e-4) return; _qe.premultiply(_q.setFromAxisAngle(_v, -over)); e.quaternion.copy(_ql).invert().multiply(_qe); e.updateMatrixWorld(true); }
// after the hold and the leg IK (real-cav.js): the same, on the pose as it stands
export function limbTwist(P){ if(P && P.F && PUPPET.full && !P.F.same) limbs(P.F, false); }
