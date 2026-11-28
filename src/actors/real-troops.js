// actors/real-troops.js — Z249 REAL INFANTRY at batch cost: one Meshy soldier (Z254: the ~10k-triangle, 2K-texture pass), posed once (rifle shouldered, feet square), baked to a static mesh and cut along its bones into the batched rig's joints (torso, head, arms, left hand, rifle, each thigh and shin). Every man on the field keeps his plain-Object3D skeleton and all of the existing walk / stance / reload / flinch / death code; only the geometry the troop batch instances changes — no skinning, no mixer per man, the same ~30 draw calls. Ours wear the woodland texture, theirs the retextured desert / crimson one (same mesh, same UVs). Until the files load (or if one fails) the procedural kit stays.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { REALTROOP } from '../../config.js';
import { MODEL_FILES, SOLDIER_KIT, TROOP_BATCH, foeNightTint, loadGLTF, poseClip } from '../hub.js';

// the batched rig's joints at rest (body frame, before the 0.84 body scale) — the same numbers as makeSoldierMesh
const J = { up:[0, 0.74, 0], head:[0, 1.34, 0], arm:[0, 1.22, 0.02], lh:[-0.2, 1.07, 0.22], gun:[0.04, 1.16, 0.18], hipR:[0.12, 0.74, 0], hipL:[-0.12, 0.74, 0], kneeR:[0.12, 0.36, 0], kneeL:[-0.12, 0.36, 0] };
// which joint carries each bone (after the left/right mirror below: the model's right side lands on the rig's +X, the rifle side)
function jointOf(name){ const n = name.replace(/^mixamorig:?/, '');
  if(/^(Neck|Head|HeadTop|headfront)/.test(n)) return 'head';
  if(/^Left(ForeArm|Hand)/.test(n)) return 'lh';
  if(/^(Right(Shoulder|Arm|ForeArm|Hand)|Left(Shoulder|Arm))/.test(n)) return 'arm';
  if(/^LeftUpLeg/.test(n)) return 'hipL'; if(/^RightUpLeg/.test(n)) return 'hipR';
  if(/^Left(Leg|Foot|Toe)/.test(n)) return 'kneeL'; if(/^Right(Leg|Foot|Toe)/.test(n)) return 'kneeR';
  return 'up'; }

let _rt = null;
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4();
export function loadRealTroops(){
  if(_rt) return _rt;
  const tex = url => new THREE.TextureLoader().loadAsync(url).then(t => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; return t; }).catch(() => null);
  return (_rt = Promise.all([loadGLTF('trooper'), loadGLTF('troopGun'), typeof window === 'undefined' ? null : tex(MODEL_FILES.trooperEnemyTex)]).then(([tg, gg, eTex]) => {
    if(!tg || !gg || !eTex) return false;
    const B = bakeTrooper(tg, gg);
    for(const [key, map] of [['f', B.map], ['e', eTex]]){
      const mat = new THREE.MeshStandardMaterial({ map, normalMap:B.nrm, roughness:REALTROOP.rough, metalness:0 }); mat.color.setRGB(...REALTROOP.team[key]);   // Z254 each side its own cast
      swapKit({ real:true, key, mat, mats:{ gun:B.gunMat }, geo:B.geo, muz:B.muz, anchor:B.anchor, bodyK:B.bodyK, joints:B.joints, legs:B.legs, skin:B.skin, aimTrim:B.aimTrim }); }
    foeNightTint();   // VIS 10 a night battle's enemy kit dimmed (world/atmosphere.js)
    return true; })); }

// pose → bake → mirror into the rig's handedness → scale so the hips sit on the rig's hips → cut per joint (each piece in its joint's frame)
function bakeTrooper(tg, gg){
  const root = skClone(tg.scene); let sm = null; root.traverse(o => { if(o.isSkinnedMesh && !sm) sm = o; });
  const clip = n => tg.animations.find(c => c.name === n), UP = /Spine|Neck|Head|Shoulder|Arm|Hand/;
  const bone = n => root.getObjectByName('mixamorig' + n), W = (o, out) => o.getWorldPosition(out);
  const g0 = sm.geometry, P = g0.attributes.position, SI = g0.attributes.skinIndex, SW = g0.attributes.skinWeight, UV = g0.attributes.uv, N = P.count;
  const bones = sm.skeleton.bones, names = bones.map(b => b.name);
  // the auto-rig gives some thigh vertices to the arm (the hands hung against the legs in the A-pose): posed, they stream after the rifle.
  //   At rest (world space) each vertex is checked against the bones' segments; when the nearest one belongs to another joint than its weights
  //   say, it follows that bone rigidly into the pose instead
  root.updateMatrixWorld(true);
  const rest = new Float32Array(N * 3); for(let i = 0; i < N; i++){ _v.fromBufferAttribute(P, i); sm.applyBoneTransform(i, _v); _v.applyMatrix4(sm.matrixWorld); rest.set([_v.x, _v.y, _v.z], i * 3); }
  const restB = bones.map(b => b.matrixWorld.clone()), bp = restB.map(m => new THREE.Vector3().setFromMatrixPosition(m));
  const seg = bones.map((b, k) => { const c = b.children.find(ch => ch.isBone), kc = c ? bones.indexOf(c) : -1; return [bp[k], kc >= 0 ? bp[kc] : bp[k]]; });
  const near = v => { let best = 0, d = 1e9; for(let k = 0; k < seg.length; k++){ const [a, b] = seg[k], ab = _b.subVectors(b, a), L2 = ab.lengthSq(), t = L2 ? Math.max(0, Math.min(1, _a.subVectors(v, a).dot(ab) / L2)) : 0, dd = _a.copy(a).addScaledVector(ab, t).distanceToSquared(v); if(dd < d){ d = dd; best = k; } } return best; };
  const mixer = new THREE.AnimationMixer(root); mixer.clipAction(poseClip('Aim', [[clip('Walk_Forward_While_Shooting'), 0.1, t => UP.test(t.name)], [clip('Standing_Reload'), 0, t => !UP.test(t.name)]])).play(); mixer.update(0);
  root.updateMatrixWorld(true);
  // Z344 his legs straight under his hips, each foot flat and pointing ahead: the reload clip stood him astride (the left foot well forward, the
  //   knee 16 cm ahead of where the rig bends it), and the rig swings and bends every leg from straight — so they are cut straight
  { const DN = new THREE.Vector3(0, -1, 0), q = new THREE.Quaternion(), qp = new THREE.Quaternion(), qb = new THREE.Quaternion(), a = new THREE.Vector3(), b = new THREE.Vector3();
    const aimB = (bn, cn, dir) => { const B = bone(bn); B.getWorldPosition(a); bone(cn).getWorldPosition(b); q.setFromUnitVectors(b.sub(a).normalize(), dir);
      B.parent.getWorldQuaternion(qp); B.getWorldQuaternion(qb); B.quaternion.copy(qp.invert().multiply(q).multiply(qb)); B.updateMatrixWorld(true); };
    for(const [sd, sx] of [['Left', 1], ['Right', -1]]){ aimB(sd + 'UpLeg', sd + 'Leg', DN); aimB(sd + 'Leg', sd + 'Foot', DN);   // (the model's left is +X, facing +Z)
      bone(sd + 'Foot').getWorldPosition(a); bone(sd + 'ToeBase').getWorldPosition(b); b.sub(a); const el = Math.atan2(b.y, Math.hypot(b.x, b.z)), to = REALTROOP.toeOut;
      aimB(sd + 'Foot', sd + 'ToeBase', new THREE.Vector3(sx * Math.sin(to) * Math.cos(el), Math.sin(el), Math.cos(to) * Math.cos(el))); } }
  root.updateMatrixWorld(true);
  // posed positions (model metres, facing +Z) and each vertex's joint
  const pos = new Float32Array(N * 3), jv = new Array(N), re = new Uint8Array(N); let top = 0;
  for(let i = 0; i < N; i++){ let wb = 0, w = -1; for(let k = 0; k < 4; k++){ const ww = SW.getComponent(i, k); if(ww > w){ w = ww; wb = SI.getComponent(i, k); } }
    _v.fromArray(rest, i * 3); const nb = near(_v), jw = jointOf(names[wb]), jg = jointOf(names[nb]);
    if(jw !== jg){ _v.applyMatrix4(_m.copy(restB[nb]).invert()).applyMatrix4(bones[nb].matrixWorld); jv[i] = jg; re[i] = 1; }
    else { _v.fromBufferAttribute(P, i); sm.applyBoneTransform(i, _v); _v.applyMatrix4(sm.matrixWorld); jv[i] = jw; }
    pos.set([_v.x, _v.y, _v.z], i * 3); if(_v.y > top) top = _v.y; }
  let gy = 1e9; for(let i = 1; i < N * 3; i += 3) if(pos[i] < gy) gy = pos[i];   // Z344 the soles: the ground under him (straightened, his legs reach a little lower than the clip's)
  const hipY = (W(bone('LeftUpLeg'), _a).y + W(bone('RightUpLeg'), _b).y) / 2 - gy, s = J.up[1] / hipY;
  const T = (x, y, z, out) => out.set(-x * s, (y - gy) * s, z * s);        // mirror X: the rig holds the rifle on +X
  // Z344 THE RIG'S PIVOTS ON HIS OWN JOINTS: each piece is cut around the point it turns on in his body — each hip and knee, the neck, the middle of
  //   the shoulders, the left elbow (the reload's forearm), the right palm (the rifle) — not the old blocky soldier's (a hip 6 cm wide of his,
  //   a knee 8–18 cm off his, a neck 11 cm above his): a shin swung about a point a hand's breadth from its knee is what left it standing apart
  const at = n => { W(bone(n), _v); T(_v.x, _v.y, _v.z, _v); return _v.toArray(); }, mid = (a, b) => a.map((x, i) => (x + b[i]) / 2);
  const RJ = { hipL:at('LeftUpLeg'), hipR:at('RightUpLeg'), kneeL:at('LeftLeg'), kneeR:at('RightLeg'), head:at('Neck'), arm:mid(at('LeftArm'), at('RightArm')), lh:at('LeftForeArm'), gun:J.gun.slice() };
  RJ.up = mid(RJ.hipL, RJ.hipR);
  const legs = { th:(Math.hypot(...RJ.hipL.map((x, i) => x - RJ.kneeL[i])) + Math.hypot(...RJ.hipR.map((x, i) => x - RJ.kneeR[i]))) / 2, sh:(RJ.kneeL[1] + RJ.kneeR[1]) / 2 };   // thigh, and knee to sole
  // smooth posed normals over the whole body, then cut
  const idx = g0.index ? g0.index.array : Array.from({ length:N }, (_, i) => i), tp = new Float32Array(N * 3);
  for(let i = 0; i < N; i++){ T(pos[i*3], pos[i*3+1], pos[i*3+2], _v); tp.set([_v.x, _v.y, _v.z], i * 3); }
  const flipped = new Uint32Array(idx.length); for(let t = 0; t < idx.length; t += 3){ flipped[t] = idx[t]; flipped[t+1] = idx[t+2]; flipped[t+2] = idx[t+1]; }
  const tmp = new THREE.BufferGeometry(); tmp.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tmp.setIndex(new THREE.BufferAttribute(flipped, 1)); tmp.computeVertexNormals(); const nrm = tmp.attributes.normal.array;
  const buck = {}, skIdx = []; for(const k of Object.keys(J)) buck[k] = { p:[], n:[], uv:[] };
  for(let t = 0; t < flipped.length; t += 3){ const a = flipped[t], b = flipped[t+1], c = flipped[t+2];
    const k = jv[a] === jv[b] || jv[a] === jv[c] ? jv[a] : jv[b] === jv[c] ? jv[b] : jv[a], o = RJ[k], B = buck[k];
    skIdx.push(a, b, c);   // (Z344 the skinned body keeps every triangle: skinned, a seam stretches with the joint instead of tearing)
    const others = [...new Set([jv[a], jv[b], jv[c]])].filter(q => q !== k);   // Z254 a seam triangle goes to every joint it touches (an inset copy for the others) → no gap opens as the joint bends
    { const ed = (P0, i, j) => _a.fromArray(P0, i*3).distanceTo(_b.fromArray(P0, j*3)), e = Math.max(ed(tp, a, b), ed(tp, b, c), ed(tp, c, a)), r = Math.max(ed(rest, a, b), ed(rest, b, c), ed(rest, c, a)) * s;
      if(e > REALTROOP.stretch[1] && e > r * REALTROOP.stretch[0]) continue; }   // a sliver the pose stretched between two parts (true seams barely stretch)
    for(const i of [a, b, c]){ B.p.push(tp[i*3] - o[0], tp[i*3+1] - o[1], tp[i*3+2] - o[2]); B.n.push(nrm[i*3], nrm[i*3+1], nrm[i*3+2]); B.uv.push(UV.getX(i), UV.getY(i)); }
    for(const q of others){ const oq = RJ[q], Bq = buck[q], ins = REALTROOP.seamInset;
      for(const i of [a, b, c]){ Bq.p.push(tp[i*3] - nrm[i*3] * ins - oq[0], tp[i*3+1] - nrm[i*3+1] * ins - oq[1], tp[i*3+2] - nrm[i*3+2] * ins - oq[2]); Bq.n.push(nrm[i*3], nrm[i*3+1], nrm[i*3+2]); Bq.uv.push(UV.getX(i), UV.getY(i)); } } }
  const geo = {}, skin = REALTROOP.skin ? skinGeo(N, tp, nrm, UV, skIdx, SI, SW, names, jv, re) : null;
  for(const [k, B] of Object.entries(buck)){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2)); g.computeBoundingSphere(); geo[k] = g; }
  // the rifle: grip in the right palm, barrel through the left hand, in the posed model; then the same mirror + scale, into the gun joint's frame
  const G = REALTROOP.gun; let gm = null, gmat = null; gg.scene.updateMatrixWorld(true);
  const parts = []; gg.scene.traverse(o => { if(o.isMesh){ const g = o.geometry.clone().applyMatrix4(o.matrixWorld); parts.push(g); gmat = gmat || o.material; } });
  gm = parts.length === 1 ? parts[0] : null; if(!gm) throw new Error('troop gun: expected one mesh');
  const box = new THREE.Box3().setFromBufferAttribute(gm.attributes.position), gs = G.len / (box.max.x - box.min.x);
  const palm = (h, f, out) => { W(bone(h), out); const fa = W(bone(f), new THREE.Vector3()); return out.addScaledVector(out.clone().sub(fa).normalize(), G.palm); };   // Z254 the palm: past the wrist along the forearm
  palm('RightHand', 'RightForeArm', _a); palm('LeftHand', 'LeftForeArm', _b); const dir = _b.clone().sub(_a).normalize(), grip = _a.clone(), bore = new THREE.Vector3(-dir.x, dir.y, dir.z);   // (Z346 the rifle lies along the palm line: its bore in the rig's frame)
  RJ.gun = T(grip.x, grip.y, grip.z, new THREE.Vector3()).toArray();   // Z344 the rifle turns (the kick) about his right palm
  const up = new THREE.Vector3(0, 1, 0), X = dir.clone().negate(), Y = up.clone().addScaledVector(X, -up.dot(X)).normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
  const R = new THREE.Matrix4().makeBasis(X, Y, Z), off = new THREE.Vector3().fromArray(G.grip).multiplyScalar(gs).applyMatrix4(R);
  const M = new THREE.Matrix4().makeScale(gs, gs, gs).premultiply(R).setPosition(grip.clone().sub(off));
  gm.applyMatrix4(M); const gp = gm.attributes.position, gn = gm.attributes.normal, o = RJ.gun;
  for(let i = 0; i < gp.count; i++){ T(gp.getX(i), gp.getY(i), gp.getZ(i), _v); gp.setXYZ(i, _v.x - o[0], _v.y - o[1], _v.z - o[2]); if(gn) gn.setX(i, -gn.getX(i)); }
  if(gm.index){ const a = gm.index.array; for(let t = 0; t < a.length; t += 3){ const q = a[t+1]; a[t+1] = a[t+2]; a[t+2] = q; } }
  gm.computeBoundingSphere(); geo.gun = gm;
  const mz = new THREE.Vector3(box.min.x, G.boreY * (box.max.x - box.min.x) / 0.954, 0).applyMatrix4(M); T(mz.x, mz.y, mz.z, mz); mz.sub(new THREE.Vector3().fromArray(o));
  // anchors for the kit some men carry (up-joint frame): an RPG on the right shoulder, an AT tube slung on the left, mortar / satchels on the pack
  const A = REALTROOP.anchor, rel = (n, add) => { W(bone(n), _v); T(_v.x, _v.y, _v.z, _v); return [_v.x - RJ.up[0] + add[0], _v.y - RJ.up[1] + add[1], _v.z - RJ.up[2] + add[2]]; };
  const anchor = { shoulderR:rel('RightArm', A.shoulderR), shoulderL:rel('LeftArm', A.shoulderL), back:rel('Spine2', A.back), muzzle:mz.toArray() };
  { const gp = new THREE.Vector3().fromArray(G.grip).applyMatrix4(M); T(gp.x, gp.y, gp.z, gp); gp.sub(new THREE.Vector3().fromArray(o));   // Z254 the barrel's way in the gun joint: an MG barrel / bipod hung on the muzzle follows the real rifle
    anchor.muzzleQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), bore).toArray(); anchor.grip = [0, 0, 0]; anchor.gripQ = anchor.muzzleQ; }   // (Z346 the bore's own line — grip → muzzle ran 18° up off it; a launcher held as the rifle is: on its line, from the palm)
  return { geo, map:sm.material.map, nrm:sm.material.normalMap || null, gunMat:gmat, muz:mz, anchor, bodyK:REALTROOP.top / ((top - gy) * s), joints:RJ, legs, skin, aimTrim:Math.asin(bore.y) }; }

// Z344 ONE SKINNED BODY (actors/troop-skin.js draws it): the whole man in one piece, each vertex carried by its two strongest joints of the rig —
//   blended where two meet (knee, hip, waist, neck, shoulder, left elbow), so a joint bends like flesh instead of two cut pieces pivoting past
//   each other (the spikes at a bent knee, the gap at the waist). A vertex the rig had to re-home (an auto-rig weight on the wrong limb) keeps
//   its one joint; a second joint not next to the first in the rig is dropped (a stray weight would drag a thigh after the hand)
const NEXT = { up:['head', 'arm', 'hipL', 'hipR'], head:['up'], arm:['up', 'lh'], lh:['arm'], hipL:['up', 'kneeL'], hipR:['up', 'kneeR'], kneeL:['hipL'], kneeR:['hipR'] };
function skinGeo(N, tp, nrm, UV, idx, SI, SW, names, jv, re){ const KI = TROOP_BATCH.kinds, jab = new Float32Array(N * 2), jw = new Float32Array(N);
  for(let i = 0; i < N; i++){ const acc = {};
    if(re[i]) acc[jv[i]] = 1; else for(let k = 0; k < 4; k++){ const w = SW.getComponent(i, k); if(w > 0){ const j = jointOf(names[SI.getComponent(i, k)]); acc[j] = (acc[j] || 0) + w; } }
    const by = Object.entries(acc).sort((x, y) => y[1] - x[1]), A = by[0] || [jv[i], 1], B = by.find(e => e !== A && (NEXT[A[0]] || []).includes(e[0])) || [A[0], 0];
    jab[i * 2] = KI.indexOf(A[0]); jab[i * 2 + 1] = KI.indexOf(B[0]); jw[i] = B[1] / (A[1] + B[1]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(tp, 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3));
  g.setAttribute('uv', UV.clone()); g.setAttribute('jAB', new THREE.BufferAttribute(jab, 2)); g.setAttribute('jWt', new THREE.BufferAttribute(jw, 1)); g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5); return g; }
// the batch takes the new kit: drop that side's instanced meshes (rebuilt from the new geometry on the next frame) and refit the men already out
function swapKit(K){
  SOLDIER_KIT[K.key] = K;
  for(const id of Object.keys(TROOP_BATCH.im)) if(id.startsWith(K.key + '_')){ const m = TROOP_BATCH.im[id]; m.parent && m.parent.remove(m); m.dispose(); delete TROOP_BATCH.im[id]; }
  for(const r of TROOP_BATCH.roots){ const u = r.userData; if(!u.parts || !u.parts.length || u.kitKey !== K.key || u.realKit) continue; fitRealMan(u, K); } }
export function fitRealMan(u, K, pivots = true){ u.body.scale.multiplyScalar(K.bodyK); if(u.muzzle && u.muzzle.parent === u.gun) u.muzzle.position.copy(K.muz); u.realKit = true;
  if(pivots && K.joints) realPivots(u, K);
  for(const a of u.kitAtt || []) placeAtt(K, a); }
// Z344 his joints moved onto the kit's own (the pieces were cut around them): hips and knees, the waist, neck, shoulders, left elbow, the rifle in
//   his right palm — and what the walk and the stances read: where they rest, how long his legs are
function realPivots(u, K){ const J = K.joints, d = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  for(const l of u.legs){ const h = J[l.sx > 0 ? 'hipR' : 'hipL'], k = J[l.sx > 0 ? 'kneeR' : 'kneeL']; l.hip.position.fromArray(h); l.knee.position.fromArray(d(k, h)); }
  u.up.position.fromArray(J.up); u.head.position.fromArray(d(J.head, J.up)); u.arms.position.fromArray(d(J.arm, J.up)); u.lh.position.fromArray(d(J.lh, J.arm)); u.gun.position.fromArray(d(J.gun, J.arm));
  u.base = { upY:J.up[1], gunZ:u.gun.position.z, lhY:u.lh.position.y }; u.legLen = K.legs; u.kn = null; u.aimTrim = K.aimTrim || 0; }   // (Z346 the arms' tilt that lays the baked rifle level: it was cut 11° muzzle-up)
// gear hung on a man by role (RPG, AT tube, MG barrel, mortar, satchels) sits on an anchor of whichever kit he wears — the procedural kit's numbers
//   until the real one arrives, then moved onto the real body's shoulder / pack / muzzle
const DEF_ANCHOR = { shoulderR:[0.17, 0.66, 0.08], shoulderL:[-0.2, 0.7, -0.05], back:[0, 0.47, -0.35], muzzle:[0, 0.01, 0.7], grip:[0, 0, 0] };   // (Z346 grip: the gun joint's own point, the right palm)
function placeAtt(K, a){ const p = (K && K.anchor && K.anchor[a.anchor]) || DEF_ANCHOR[a.anchor], q = K && K.anchor && K.anchor[a.anchor + 'Q'];
  if(q){ const Q = new THREE.Quaternion().fromArray(q), off = new THREE.Vector3().fromArray(a.off).applyQuaternion(Q); a.obj.position.set(p[0] + off.x, p[1] + off.y, p[2] + off.z); a.obj.quaternion.copy(Q).multiply(a.q0); }   // turned with the anchor (the barrel's way)
  else { a.obj.position.set(p[0] + a.off[0], p[1] + a.off[1], p[2] + a.off[2]); a.obj.quaternion.copy(a.q0); } }
export function kitAttach(u, parent, obj, anchor, off){ const a = { obj, anchor, off:off || [0, 0, 0], q0:obj.quaternion.clone() }; (u.kitAtt || (u.kitAtt = [])).push(a); parent.add(obj);
  placeAtt(u.realKit ? SOLDIER_KIT[u.kitKey] : null, a); return obj; }
