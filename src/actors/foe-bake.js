// actors/foe-bake.js — FOE 1 THE ENEMY'S FULL SKELETON, BAKED ONCE A BATTLE (FOEANIM): the trooper (assets/models/real/trooper.glb — the body every
//   enemy rifleman wears) keeps its own 22-bone Mixamo skeleton and its own skin weights (four a vertex) instead of the nine-joint rig's cut, and the
//   library's clips (actors/anim-lib.js — retargeted off line onto the operator, the player's hidden model) are carried over onto it here:
//   · THE RETARGET operator → trooper. Both are Meshy auto-rigs (same bone names, same armature turn, both rest in an A pose) with their own joint axes and
//     proportions. Each trooper bone takes the operator bone's WORLD turn away from its rest (W_tr(t) = W_op(t)·C, C = W_op(rest)⁻¹·W_tr(ref)), where his
//     ref pose is his rest with the upper arms, forearms, hands, thighs and shins swung (shortest way) to point where the operator's do — so a clip's
//     limb directions, not its joint axes, are what is copied. In local terms that is a constant on each side: L_tr = C_parent⁻¹·L_op·C. The hips'
//     path is scaled by the ratio of the two hip heights and lifted so his soles stand where the clip's do (his ankles sit lower than the operator's).
//   · THE CLIPS (FOEANIM.clips, ~50): resampled at 30 fps into flat arrays — 22 local quaternions + the hips a frame — with their root track (x, z, yaw:
//     the turns, the transitions), their stride phase (each loop's offset measured from his own feet, the fundamental of left toe − right toe along its
//     way) and their speed on his scale. Sampling one at run time is two frames and a lerp, no three mixer, no allocation (foeSample).
//   · THE CROWD'S TEXTURE (foeVatData): every frame of every clip as the 22 skinning matrices (3 rows each) in one float texture — a man far enough
//     off is drawn straight from it by the GPU (actors/foe-skin.js), nothing per bone on the CPU; with each frame his right hand's matrix (the rifle).
//   · THE BODY: the trooper's mesh in its bind pose (= its rest: checked, |W·IBM − I| < 1e-5), each vertex's four joints mapped onto the 22 (a finger tip,
//     the head's top, a toe's end belong to their hand / head / toe), and the light rifle laid in his right palm along the palm-to-palm line of the
//     aim pose — a frame of the hand bone, so it goes wherever the clip takes the hand (a reload, a throw, a point).
// Nothing here runs per frame except foeSample / foeFK / foeSkin (flat arrays in, flat arrays out, scratch scalars only).
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { FOEANIM, REALTROOP } from '../../config.js';
import { animClip, animInfo, animRootAt } from '../hub.js';

// the library's 22 bones, parents before children (the order of anim-lib's tracks and of every pose array here)
export const FOE_NB = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
export const FOE_PAR = Int8Array.from([-1, 0, 1, 2, 3, 4, 3, 6, 7, 8, 3, 10, 11, 12, 0, 14, 15, 16, 0, 18, 19, 20]);
const N = 22, PQ = N * 4, FPS = 30, ALIGN = { LeftArm:'LeftForeArm', LeftForeArm:'LeftHand', LeftHand:'LeftHandMiddle4', RightArm:'RightForeArm', RightForeArm:'RightHand', RightHand:'RightHandMiddle4',
  LeftUpLeg:'LeftLeg', LeftLeg:'LeftFoot', RightUpLeg:'RightLeg', RightLeg:'RightFoot' };
const ALIGN_OP = { LeftHand:'LeftHandMiddle1', RightHand:'RightHandMiddle1' };   // (the operator's hand points along its middle finger's root)
export const FOE_BONE = Object.fromEntries(FOE_NB.map((n, i) => [n, i]));

// ---- quaternions in flat arrays ----
let QX = 0, QY = 0, QZ = 0, QW = 1, VX = 0, VY = 0, VZ = 0;
export function fqMul(a, ao, b, bo, o, oo){ const ax = a[ao], ay = a[ao + 1], az = a[ao + 2], aw = a[ao + 3], bx = b[bo], by = b[bo + 1], bz = b[bo + 2], bw = b[bo + 3];
  o[oo] = ax * bw + aw * bx + ay * bz - az * by; o[oo + 1] = ay * bw + aw * by + az * bx - ax * bz; o[oo + 2] = az * bw + aw * bz + ax * by - ay * bx; o[oo + 3] = aw * bw - ax * bx - ay * by - az * bz; }
function rot(q, qo, x, y, z){ const qx = q[qo], qy = q[qo + 1], qz = q[qo + 2], qw = q[qo + 3], tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  VX = x + qw * tx + qy * tz - qz * ty; VY = y + qw * ty + qz * tx - qx * tz; VZ = z + qw * tz + qx * ty - qy * tx; }
// o = a slerped toward b by k (nlerp, the short way: two library frames 1/30 s apart, or two poses of one man)
export function fqLerp(a, ao, b, bo, k, o, oo){ let bx = b[bo], by = b[bo + 1], bz = b[bo + 2], bw = b[bo + 3]; if(a[ao] * bx + a[ao + 1] * by + a[ao + 2] * bz + a[ao + 3] * bw < 0){ bx = -bx; by = -by; bz = -bz; bw = -bw; }
  const x = a[ao] + (bx - a[ao]) * k, y = a[ao + 1] + (by - a[ao + 1]) * k, z = a[ao + 2] + (bz - a[ao + 2]) * k, w = a[ao + 3] + (bw - a[ao + 3]) * k, l = 1 / (Math.hypot(x, y, z, w) || 1);
  o[oo] = x * l; o[oo + 1] = y * l; o[oo + 2] = z * l; o[oo + 3] = w * l; }
// a turn about the world's up of `ang` laid in front of a world rotation: o = Ry(ang)·q
export function fqYaw(q, qo, ang){ const s = Math.sin(ang / 2), c = Math.cos(ang / 2), x = q[qo], y = q[qo + 1], z = q[qo + 2], w = q[qo + 3];
  q[qo] = c * x + s * z; q[qo + 1] = c * y + s * w; q[qo + 2] = c * z - s * x; q[qo + 3] = c * w - s * y; }

// ---- the bake ----
let _rig = null;
// tg the trooper, og the operator, gg the light rifle (gltf results) → (a promise of) the rig, or null (a bone missing: the nine-joint rig stays).
//   The clips are baked a few at a time, a frame apart (no hitch: ~0.1–0.2 s of work in all)
const breathe = () => new Promise(r => setTimeout(r, 0));
export async function bakeFoeRig(tg, og, gg){
  const tr = skClone(tg.scene), op = skClone(og.scene); tr.updateMatrixWorld(true); op.updateMatrixWorld(true);
  let sm = null; tr.traverse(o => { if(o.isSkinnedMesh && !sm) sm = o; }); if(!sm) return null;
  const bt = n => tr.getObjectByName('mixamorig' + n), bo = n => op.getObjectByName('mixamorig' + n), TB = FOE_NB.map(bt), OB = FOE_NB.map(bo);
  if(TB.some(b => !b) || OB.some(b => !b)) return null;
  const arm = TB[0].parent, armO = OB[0].parent, _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const AQ = arm.getWorldQuaternion(new THREE.Quaternion()), AP = arm.getWorldPosition(new THREE.Vector3()), AQo = armO.getWorldQuaternion(new THREE.Quaternion());
  const T = new Float32Array(N * 3); TB.forEach((b, i) => { T[i * 3] = b.position.x; T[i * 3 + 1] = b.position.y; T[i * 3 + 2] = b.position.z; });
  const IBM = new Float32Array(N * 16); TB.forEach((b, i) => IBM.set(_m4.copy(b.matrixWorld).invert().elements, i * 16));   // (rest = bind on this model: W·IBM = I)
  // his ref pose: the limbs swung onto the operator's directions, parents first
  const Wop = OB.map(b => b.getWorldQuaternion(new THREE.Quaternion()));
  const dirOf = (root, b, cn, out) => { const c = root.getObjectByName('mixamorig' + cn); b.getWorldPosition(_a); if(!c) return null; c.getWorldPosition(out); return out.sub(_a).normalize(); };
  const qp = new THREE.Quaternion(), qb = new THREE.Quaternion(), d1 = new THREE.Vector3(), d2 = new THREE.Vector3();
  for(let i = 0; i < N; i++){ const n = FOE_NB[i], cn = ALIGN[n]; if(!cn) continue; const want = dirOf(op, OB[i], ALIGN_OP[n] || cn, d2), have = dirOf(tr, TB[i], cn, d1); if(!want || !have) continue;
    _q.setFromUnitVectors(have, want); TB[i].parent.getWorldQuaternion(qp); TB[i].getWorldQuaternion(qb); TB[i].quaternion.copy(qp.invert().multiply(_q).multiply(qb)); TB[i].updateMatrixWorld(true); }
  const Wref = TB.map(b => b.getWorldQuaternion(new THREE.Quaternion())), C = new Float32Array(N * 4), CI = new Float32Array(N * 4);
  for(let i = 0; i < N; i++){ _q.copy(Wop[i]).invert().multiply(Wref[i]); _q.toArray(C, i * 4); _q.invert().toArray(CI, i * 4); }
  const PRE = AQ.clone().invert().multiply(AQo).toArray(new Float32Array(4));   // (the hips' parents: the two armatures — the same turn on these models)
  // the hips: the operator's rest height → his, and what lifts his soles onto the clip's ground
  const hipT = TB[0].getWorldPosition(new THREE.Vector3()).y, hipO = OB[0].getWorldPosition(new THREE.Vector3()).y, K = hipT / hipO;
  // his body: rest positions, normals, uv, the four joints mapped onto the 22
  const g0 = sm.geometry, SI = g0.attributes.skinIndex, SW = g0.attributes.skinWeight, NV = g0.attributes.position.count, sb = sm.skeleton.bones;
  const map = sb.map(b => { let o = b; while(o && !(o.isBone && FOE_BONE[o.name.replace(/^mixamorig/, '')] !== undefined)) o = o.parent; return o ? FOE_BONE[o.name.replace(/^mixamorig/, '')] : 0; });
  const fj = new Float32Array(NV * 4), fw = new Float32Array(NV * 4), acc = new Float32Array(N);
  for(let v = 0; v < NV; v++){ acc.fill(0); for(let k = 0; k < 4; k++){ const w = SW.getComponent(v, k); if(w > 0) acc[map[SI.getComponent(v, k)]] += w; }
    let s = 0; for(let k = 0; k < 4; k++){ let bi = -1, bw = 0; for(let j = 0; j < N; j++) if(acc[j] > bw){ bw = acc[j]; bi = j; } if(bi < 0){ fj[v * 4 + k] = fj[v * 4]; fw[v * 4 + k] = 0; continue; } fj[v * 4 + k] = bi; fw[v * 4 + k] = bw; s += bw; acc[bi] = 0; }
    for(let k = 0; k < 4; k++) fw[v * 4 + k] /= s || 1; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', g0.attributes.position.clone()); geo.setAttribute('normal', g0.attributes.normal.clone()); geo.setAttribute('uv', g0.attributes.uv.clone());
  geo.setAttribute('fJ', new THREE.BufferAttribute(fj, 4)); geo.setAttribute('fW', new THREE.BufferAttribute(fw, 4)); if(g0.index) geo.setIndex(g0.index.clone());
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const box = new THREE.Box3().setFromBufferAttribute(g0.attributes.position), H = box.max.y - box.min.y;
  const R = { geo, T, IBM, C, CI, PRE, AQ:AQ.toArray(new Float32Array(4)), AP:AP.toArray(new Float32Array(3)), K, H, hipT, foot0:0, clips:new Map(), gun:null, hand:null, F:0 };
  // the rest pose of his own bones (what a missing track holds)
  R.L0 = new Float32Array(PQ); TB.forEach((b, i) => b.quaternion.toArray(R.L0, i * 4));   // (after the ref swing: a clip always overrides every one of the 22)
  // the ground under his soles: the rest ankles' height over the mesh's lowest point
  { const fy = [16, 20].map(i => { TB[i].getWorldPosition(_p); return _p.y - box.min.y; }); R.ankle = Math.min(fy[0], fy[1]); }
  // the clips
  const ids = foeClipIds(); let t0 = performance.now(); const pace = async () => { if(performance.now() - t0 > 6){ await breathe(); t0 = performance.now(); } };
  for(const id of ids){ const c = bakeClip(R, id, OB); if(c) R.clips.set(id, c); await pace(); }
  // his soles onto the clip's ground: in the standing idle the lower ankle stands at its rest height
  { const c = R.clips.get(FOEANIM.clips.idle) || R.clips.values().next().value; if(c){ foeSample(c, 0, PS, 0); foeFK(R, PS, 0, WQ, WP); R.foot0 = R.ankle - Math.min(WP[16 * 3 + 1], WP[20 * 3 + 1]);
    const AI = new THREE.Quaternion().fromArray(R.AQ).invert().toArray(new Float32Array(4)); rot(AI, 0, 0, 1, 0); const ux = VX, uy = VY, uz = VZ;   // (world up in his armature's frame)
    for(const cc of R.clips.values()) for(let f = 0; f < cc.n; f++){ const k = R.foot0 * cc.lift; cc.P[f * 3] += ux * k; cc.P[f * 3 + 1] += uy * k; cc.P[f * 3 + 2] += uz * k; } } }   // (lying, the operator's retarget already put his lowest joint on the ground: only half of it)
  for(const c of R.clips.values()){ loopPhase(R, c); peakHand(R, c); await pace(); }
  // the rifle in his right palm (the hand bone's frame): laid as the aim pose holds it
  R.gun = bakeGun(R, gg); _rig = R;
  return R; }
export const foeRig = () => _rig;
const _m4 = new THREE.Matrix4();
// the clip ids FOEANIM asks for, once each
export function foeClipIds(){ const out = new Set(), walk = v => { if(typeof v === 'string') out.add(v); else if(Array.isArray(v)) v.forEach(walk); else if(v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(FOEANIM.clips); return [...out]; }

// one library clip → his frames: L_tr = C_parent⁻¹ · L_op · C (the hips: the armature turn in front), the hips scaled and lifted, the root track kept
const PS = new Float32Array(PQ + 3), WQ = new Float32Array(PQ), WP = new Float32Array(N * 3), _r3 = [0, 0, 0];
function bakeClip(R, id, OB){ const clip = animClip(id), info = animInfo(id); if(!clip || !info) return null;
  const n = Math.max(2, Math.round(info.dur * FPS) + 1), Q = new Float32Array(n * PQ), P = new Float32Array(n * 3), RT = info.travels ? new Float32Array(n * 3) : null, tracks = {};
  for(const t of clip.tracks){ const m = /mixamorig(\w+)\.(quaternion|position)$/.exec(t.name); if(m) tracks[m[1] + '.' + m[2]] = t; }
  const L = new Float32Array(4), tmp = new Float32Array(4), A = new Float32Array(R.AQ), AI = new THREE.Quaternion().fromArray(R.AQ).invert().toArray(new Float32Array(4));
  const samp = (t, time, out, w) => { const T = t.times, V = t.values, k = T.length; let i = 0; while(i < k - 1 && T[i + 1] <= time) i++; const j = Math.min(k - 1, i + 1), u = j > i ? Math.min(1, Math.max(0, (time - T[i]) / (T[j] - T[i]))) : 0;
    if(w === 4) fqLerp(V, i * 4, V, j * 4, u, out, 0); else for(let c = 0; c < 3; c++) out[c] = V[i * 3 + c] + (V[j * 3 + c] - V[i * 3 + c]) * u; };
  const op0 = OB.map(b => b.quaternion.toArray(new Float32Array(4))), hp = new Float32Array(3);
  for(let f = 0; f < n; f++){ const time = Math.min(info.dur, f / FPS);
    for(let b = 0; b < N; b++){ const tk = tracks[FOE_NB[b] + '.quaternion']; if(tk) samp(tk, time, L, 4); else L.set(op0[b]);
      if(b === 0){ fqMul(R.PRE, 0, L, 0, tmp, 0); } else fqMul(R.CI, FOE_PAR[b] * 4, L, 0, tmp, 0);
      fqMul(tmp, 0, R.C, b * 4, Q, f * PQ + b * 4); }
    const ht = tracks['Hips.position']; if(ht) samp(ht, time, hp, 3); else { hp[0] = 0; hp[1] = 0; hp[2] = 0; }
    rot(A, 0, hp[0], hp[1], hp[2]); rot(AI, 0, VX * R.K, VY * R.K, VZ * R.K); P[f * 3] = VX; P[f * 3 + 1] = VY; P[f * 3 + 2] = VZ;   // (world, scaled, back into his armature)
    if(RT){ animRootAt(id, time, _r3); RT[f * 3] = _r3[0] * R.K; RT[f * 3 + 1] = _r3[1] * R.K; RT[f * 3 + 2] = _r3[2]; } }
  // hips' world height over his soles in frame 0: lying (below 30% of the standing hips) the lift is halved
  rot(A, 0, P[0], P[1], P[2]); const lie = VY + R.AP[1] < 0.3 * R.hipT;
  return { id, n, dur:(n - 1) / FPS, loop:!!info.loop, Q, P, RT, speed:(info.speed || 0) * R.K, dir:info.dir || null, yaw:RT ? RT[(n - 1) * 3 + 2] : 0, ph0:0, lift:lie ? 0.5 : 1, row:0 }; }
// a loop's stride phase: 0 where his left toe is furthest along the clip's way ahead of the right (the fundamental of that difference over a cycle)
//   — and its speed on his own legs: how fast the lower toe goes back along the way while it is on the ground (the index's speed is the operator's × the hip ratio)
function loopPhase(R, c){ if(!c.loop || !c.dir || !(c.speed > 0.05)) return; const dx = c.dir[0], dz = c.dir[1]; let sc = 0, ss = 0, pv = 0, pn = 0, l0 = 0, r0 = 0;
  for(let f = 0; f < c.n; f++){ foeSample(c, f / FPS, PS, 0); foeFK(R, PS, 0, WQ, WP); const s = (WP[17 * 3] - WP[21 * 3]) * dx + (WP[17 * 3 + 2] - WP[21 * 3 + 2]) * dz, a = 2 * Math.PI * f / (c.n - 1);
    if(f < c.n - 1){ sc += s * Math.cos(a); ss += s * Math.sin(a); }
    const l = WP[17 * 3] * dx + WP[17 * 3 + 2] * dz, r = WP[21 * 3] * dx + WP[21 * 3 + 2] * dz, lo = WP[17 * 3 + 1] < WP[21 * 3 + 1];
    if(f && Math.min(WP[17 * 3 + 1], WP[21 * 3 + 1]) < 0.06){ pv += (lo ? l - l0 : r - r0) * FPS; pn++; } l0 = l; r0 = r; }
  c.ph0 = ((Math.atan2(ss, sc) / (2 * Math.PI)) % 1 + 1) % 1; if(pn > 4 && -pv / pn > 0.05) c.speed = -pv / pn; }

// a one-shot's moment of release: when his right hand moves fastest (a throw lets the grenade go there)
function peakHand(R, c){ let best = 0, at = 0, x0 = 0, y0 = 0, z0 = 0;
  for(let f = 0; f < c.n; f++){ foeSample(c, f / FPS, PS, 0); foeFK(R, PS, 0, WQ, WP); const x = WP[39], y = WP[40], z = WP[41], v = f ? Math.hypot(x - x0, y - y0, z - z0) : 0; if(v > best){ best = v; at = f / FPS; } x0 = x; y0 = y; z0 = z; }
  c.rel = at; }
// ---- run time: a clip at time t → a pose (22 quats + hips), FK → world quats / positions (his model space: metres, feet on y = 0, facing +z), → skin rows ----
// o: pose array (PQ + 3), oo: offset. A loop wraps; a one-shot holds its ends
export function foeSample(c, t, o, oo){ let x = t * FPS; const last = c.n - 1; if(c.loop){ x %= last; if(x < 0) x += last; } else x = x < 0 ? 0 : x > last ? last : x;
  const i = Math.floor(x), j = Math.min(last, i + 1), k = x - i, Q = c.Q, a = i * PQ, b = j * PQ;
  for(let q = 0; q < PQ; q += 4) fqLerp(Q, a + q, Q, b + q, k, o, oo + q);
  const P = c.P; o[oo + PQ] = P[i * 3] + (P[j * 3] - P[i * 3]) * k; o[oo + PQ + 1] = P[i * 3 + 1] + (P[j * 3 + 1] - P[i * 3 + 1]) * k; o[oo + PQ + 2] = P[i * 3 + 2] + (P[j * 3 + 2] - P[i * 3 + 2]) * k; }
// a root track at time t → out [x, z, yaw] (his metres)
export function foeRootAt(c, t, out){ out[0] = out[1] = out[2] = 0; if(!c.RT) return out; let x = t * FPS; const last = c.n - 1; x = x < 0 ? 0 : x > last ? last : x;
  const i = Math.floor(x), j = Math.min(last, i + 1), k = x - i, R = c.RT; for(let q = 0; q < 3; q++) out[q] = R[i * 3 + q] + (R[j * 3 + q] - R[i * 3 + q]) * k; return out; }
// a turn about his model's x (his left–right axis as he faces +z) laid in front of a world rotation: o = Rx(ang)·q (+ leans him forward)
export function fqPitch(q, qo, ang){ const s = Math.sin(ang / 2), c = Math.cos(ang / 2), x = q[qo], y = q[qo + 1], z = q[qo + 2], w = q[qo + 3];
  q[qo] = c * x + s * w; q[qo + 1] = c * y - s * z; q[qo + 2] = c * z + s * y; q[qo + 3] = c * w - s * x; }
// forward kinematics: pose → each bone's world turn (WQ) and place (WP); `tw` / `tp` (optional, N floats) a turn about the up axis / his x axis laid on each
//   bone's world turn as it is reached (the bone turns about its own joint, its children with it)
export function foeFK(R, Pz, po, wq, wp, tw, tp){ const T = R.T;
  fqMul(R.AQ, 0, Pz, po, wq, 0); rot(R.AQ, 0, Pz[po + PQ], Pz[po + PQ + 1], Pz[po + PQ + 2]); wp[0] = R.AP[0] + VX; wp[1] = R.AP[1] + VY; wp[2] = R.AP[2] + VZ;
  if(tw && tw[0]){ fqYaw(wq, 0, tw[0]); const c = Math.cos(tw[0]), s = Math.sin(tw[0]), x = wp[0], z = wp[2]; wp[0] = c * x + s * z; wp[2] = -s * x + c * z; }
  for(let b = 1; b < N; b++){ const p = FOE_PAR[b]; fqMul(wq, p * 4, Pz, po + b * 4, wq, b * 4); if(tw && tw[b]) fqYaw(wq, b * 4, tw[b]); if(tp && tp[b]) fqPitch(wq, b * 4, tp[b]);
    rot(wq, p * 4, T[b * 3], T[b * 3 + 1], T[b * 3 + 2]); wp[b * 3] = wp[p * 3] + VX; wp[b * 3 + 1] = wp[p * 3 + 1] + VY; wp[b * 3 + 2] = wp[p * 3 + 2] + VZ; } }
// the skinning rows: bone b's [world | place] · IBM_b → 3 rows of 4 into o at oo (12 floats a bone)
export function foeSkin(R, wq, wp, o, oo){ const I = R.IBM;
  for(let b = 0; b < N; b++){ const x = wq[b * 4], y = wq[b * 4 + 1], z = wq[b * 4 + 2], w = wq[b * 4 + 3], x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    const r00 = 1 - (yy + zz), r01 = xy - wz, r02 = xz + wy, r10 = xy + wz, r11 = 1 - (xx + zz), r12 = yz - wx, r20 = xz - wy, r21 = yz + wx, r22 = 1 - (xx + yy), e = b * 16, px = wp[b * 3], py = wp[b * 3 + 1], pz = wp[b * 3 + 2], q = oo + b * 12;
    for(let c = 0; c < 4; c++){ const m0 = I[e + c * 4], m1 = I[e + c * 4 + 1], m2 = I[e + c * 4 + 2], m3 = I[e + c * 4 + 3];   // (column c of IBM)
      o[q + c] = r00 * m0 + r01 * m1 + r02 * m2 + px * m3; o[q + 4 + c] = r10 * m0 + r11 * m1 + r12 * m2 + py * m3; o[q + 8 + c] = r20 * m0 + r21 * m1 + r22 * m2 + pz * m3; } } }
// bone b's world matrix as 12 floats (3 rows of 4) — the right hand, for the rifle
export function foeBoneRows(wq, wp, b, o, oo){ const x = wq[b * 4], y = wq[b * 4 + 1], z = wq[b * 4 + 2], w = wq[b * 4 + 3], x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  o[oo] = 1 - (yy + zz); o[oo + 1] = xy - wz; o[oo + 2] = xz + wy; o[oo + 3] = wp[b * 3]; o[oo + 4] = xy + wz; o[oo + 5] = 1 - (xx + zz); o[oo + 6] = yz - wx; o[oo + 7] = wp[b * 3 + 1];
  o[oo + 8] = xz - wy; o[oo + 9] = yz + wx; o[oo + 10] = 1 - (xx + yy); o[oo + 11] = wp[b * 3 + 2]; }

// ---- the crowd's texture: every frame of every clip, 22 bones × 3 rows; plus the right hand's rows a frame (CPU: the rifle of a crowd man) ----
export async function foeVatData(R){ let F = 0; for(const c of R.clips.values()){ c.row = F; F += c.n; } R.F = F;
  const W = FOEANIM.vatW, H = Math.ceil(F * N * 3 / W), D = new Float32Array(W * H * 4), HD = new Float32Array(F * 12);
  for(const c of R.clips.values()){ for(let f = 0; f < c.n; f++){ foeSample(c, f / FPS, PS, 0); foeFK(R, PS, 0, WQ, WP); foeSkin(R, WQ, WP, D, (c.row + f) * N * 12); foeBoneRows(WQ, WP, 13, HD, (c.row + f) * 12); } await breathe(); }
  R.hand = HD; return { data:D, w:W, h:H }; }

// the light rifle (gg) in the right hand's frame: the aim pose's palms (past each wrist along its forearm) give the bore's line, the grip in the right one
function bakeGun(R, gg){ const G = REALTROOP.gun, c = R.clips.get(FOEANIM.clips.aimIdle) || R.clips.get(FOEANIM.clips.idle); if(!gg || !c) return null;
  foeSample(c, 0, PS, 0); foeFK(R, PS, 0, WQ, WP);
  const at = (b, out) => out.set(WP[b * 3], WP[b * 3 + 1], WP[b * 3 + 2]), palm = (h, f, out) => { at(h, out); const fa = at(f, new THREE.Vector3()); return out.addScaledVector(out.clone().sub(fa).normalize(), G.palm); };
  const pR = palm(13, 12, new THREE.Vector3()), pL = palm(9, 8, new THREE.Vector3()), dir = pL.clone().sub(pR).normalize();
  gg.scene.updateMatrixWorld(true); const parts = []; let gmat = null; gg.scene.traverse(o => { if(o.isMesh){ parts.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); gmat = gmat || o.material; } }); if(parts.length !== 1) return null;
  const gm = parts[0], box = new THREE.Box3().setFromBufferAttribute(gm.attributes.position), gs = G.len / (box.max.x - box.min.x);
  // the model: muzzle at its −x, the grip at G.grip → world: −x along `dir`, up kept up, the grip on the right palm
  const X = dir.clone().negate(), Y = new THREE.Vector3(0, 1, 0).addScaledVector(X, -X.y).normalize(), Z = new THREE.Vector3().crossVectors(X, Y), Rm = new THREE.Matrix4().makeBasis(X, Y, Z);
  const off = new THREE.Vector3().fromArray(G.grip).multiplyScalar(gs).applyMatrix4(Rm), M = new THREE.Matrix4().makeScale(gs, gs, gs).premultiply(Rm).setPosition(pR.clone().sub(off));
  // into the hand's frame: hand world (rows) inverted
  const hr = new Float32Array(12); foeBoneRows(WQ, WP, 13, hr, 0); const Hm = new THREE.Matrix4().set(hr[0], hr[1], hr[2], hr[3], hr[4], hr[5], hr[6], hr[7], hr[8], hr[9], hr[10], hr[11], 0, 0, 0, 1);
  const toHand = Hm.clone().invert().multiply(M); gm.applyMatrix4(toHand); gm.computeBoundingSphere();
  const mz = new THREE.Vector3(box.min.x, G.boreY * (box.max.x - box.min.x) / 0.954, 0).applyMatrix4(toHand);   // (as real-troops.js finds the muzzle)
  // the frame the game's gun joint is laid in (its origin the right palm, the bore its +z) — in the hand's frame
  const palmH = pR.clone().applyMatrix4(Hm.clone().invert()), boreH = dir.clone().transformDirection(Hm.clone().invert());
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), boreH), upH = new THREE.Vector3(0, 1, 0).transformDirection(Hm.clone().invert()), y0 = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const yW = upH.addScaledVector(boreH, -upH.dot(boreH)).normalize(), tw = Math.atan2(new THREE.Vector3().crossVectors(y0, yW).dot(boreH), y0.dot(yW)); q.premultiply(new THREE.Quaternion().setFromAxisAngle(boreH, tw));
  const joint = new THREE.Matrix4().compose(palmH, q, new THREE.Vector3(1, 1, 1));
  return { geo:gm, mat:gmat, muz:mz, joint }; }
