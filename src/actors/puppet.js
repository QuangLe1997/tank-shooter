// actors/puppet.js — Z294 A SECOND SOLDIER WEARING THE FIRST ONE'S MOVES: the Tripo special-forces soldier has his own Mixamo skeleton, but
// its rest pose, bone axes and units differ from the Meshy operator's, so the operator's rifle clips cannot simply be played on him (the
// limbs twist off). Instead the operator keeps running unseen with every clip he has (walk and fire, run and fire, charge, reloads standing /
// kneeling / prone, crouch-walk, throw, hit, fall, the two riding clips) and each frame the soldier's bones are turned, from the hips out to
// the hands and feet, to point the same way as the operator's in the world — direction by direction, so neither the units nor the rest pose
// matter. Each frame starts from his rest pose, so nothing drifts.
import * as THREE from 'three';

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
  return { S, D, chains, rest, dst, legK }; }

// every frame, after the operator has been animated (and turned toward the aim)
export function drivePuppet(P){ if(!P) return; const { S, D, chains, rest, dst } = P;
  for(const [b, q] of rest) b.quaternion.copy(q); dst.updateMatrixWorld(true);
  // the hips: same place, same frame
  hipFrame(S, _qs); hipFrame(D, _qd); _q.copy(_qs).multiply(_qd.invert());
  const H = D.Hips; H.getWorldQuaternion(_qw); _qw.premultiply(_q); H.parent.getWorldQuaternion(_qp); H.quaternion.copy(_qp.invert().multiply(_qw));
  S.Hips.getWorldPosition(_a); if(P.offset) _a.add(P.offset); H.parent.worldToLocal(_a); H.position.copy(_a); H.updateMatrixWorld(true);
  // then each bone toward where the operator's points
  for(const [b, c] of chains){ const sb = S[b], sc = S[c], db = D[b], dc = D[c];
    sb.getWorldPosition(_a); sc.getWorldPosition(_b); _e.subVectors(_b, _a); if(_e.lengthSq() < 1e-10) continue; _e.normalize();
    db.getWorldPosition(_c); dc.getWorldPosition(_d); _f.subVectors(_d, _c); if(_f.lengthSq() < 1e-10) continue; _f.normalize();
    _q.setFromUnitVectors(_f, _e); db.getWorldQuaternion(_qw); _qw.premultiply(_q); db.parent.getWorldQuaternion(_qp); db.quaternion.copy(_qp.invert().multiply(_qw)); db.updateMatrixWorld(true); }
  // standing, walking, kneeling, lying: his lowest foot onto the operator's (seated, the hips on the seat rule instead)
  if(P.ground){ const low = B => { let y = Infinity; for(const n of FEET) if(B[n]){ B[n].getWorldPosition(_a); y = Math.min(y, _a.y); } return y; }, dy = low(S) - low(D);
    if(isFinite(dy) && Math.abs(dy) > 1e-4){ H.getWorldPosition(_a); _a.y += dy; H.parent.worldToLocal(_a); H.position.copy(_a); H.updateMatrixWorld(true); } } }
const FEET = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'];
