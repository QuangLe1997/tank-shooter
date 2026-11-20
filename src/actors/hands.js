// actors/hands.js — Z296 HANDS THAT HOLD: the Tripo / Mixamo rigs carry every finger (four joints each, both hands — 40 bones) but nothing ever moved
// them, so hands on a handlebar or a rifle hung open. curlHand closes a hand round what it holds: each finger joint turns about the knuckle line
// (index root → little-finger root), toward the thing gripped, the root joints most and the tips less; the thumb wraps across.
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _k = new THREE.Vector3(), _f = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const FING = ['Index', 'Middle', 'Ring', 'Pinky'], SEG = [0.95, 1.05, 0.75];
function turn(b, axis, ang){ if(!b) return; _q.setFromAxisAngle(axis, ang); b.getWorldQuaternion(_qw); _qw.premultiply(_q); b.parent.getWorldQuaternion(_qp); b.quaternion.copy(_qp.invert().multiply(_qw)); b.updateMatrixWorld(true); }

// B: bones by Mixamo name (no prefix) · side 'Left' | 'Right' · amt 0 (open) … 1 (a full fist) · toward: a world point inside the grip (bar, gun)
export function curlHand(B, side, amt, toward, spread = 0, trigger = 1){ const h = B[side + 'Hand'], i1 = B[side + 'HandIndex1'], p1 = B[side + 'HandPinky1'], m1 = B[side + 'HandMiddle1'], m2 = B[side + 'HandMiddle2'];
  if(!h || !i1 || !p1 || !m1 || !m2 || amt <= 0) return;
  i1.getWorldPosition(_a); p1.getWorldPosition(_b); _k.subVectors(_b, _a).normalize();                  // the knuckle line
  m1.getWorldPosition(_a); m2.getWorldPosition(_b); _f.subVectors(_b, _a).normalize();                  // the way the fingers point
  _n.crossVectors(_k, _f); h.getWorldPosition(_c); _t.copy(toward).sub(_c);                             // turning +θ about the knuckle line sends the fingers along k × f
  const sg = _n.dot(_t) >= 0 ? 1 : -1, ax = _k.clone();
  for(const F of FING){ const sp = (F === 'Index' ? -1 : F === 'Pinky' ? 1 : F === 'Ring' ? 0.4 : 0) * spread;
    const fk = F === 'Index' ? trigger : 1;   // the trigger finger lies straighter, along the guard
    for(let s = 1; s <= 3; s++){ const b = B[side + 'Hand' + F + s]; if(!b) continue; turn(b, ax, sg * amt * fk * SEG[s - 1] * 1.45); if(s === 1 && sp) turn(b, _f, sp * 0.12); } }
  // the thumb: across the front of the grip, its joints folding toward the palm
  for(let s = 1; s <= 3; s++) turn(B[side + 'HandThumb' + s], _f, -sg * (side === 'Left' ? -1 : 1) * amt * (s === 1 ? 0.35 : 0.55)); }

// two-bone IK (shoulder → elbow → wrist, hip → knee → ankle): the end reaches t, the middle joint bending toward pole — shared by the driver and the soldier
const _ia = new THREE.Vector3(), _ib = new THREE.Vector3(), _ic = new THREE.Vector3(), _id = new THREE.Vector3(), _if = new THREE.Vector3(), _ig = new THREE.Vector3(), _it = new THREE.Vector3(), _ie = new THREE.Vector3(), _ix = new THREE.Vector3();
function aimBone(b, c, dir){ b.getWorldPosition(_ix); c.getWorldPosition(_ie); _ie.sub(_ix); if(_ie.lengthSq() < 1e-10) return; _ie.normalize();
  _q.setFromUnitVectors(_ie, dir); b.getWorldQuaternion(_qw); _qw.premultiply(_q); b.parent.getWorldQuaternion(_qp); b.quaternion.copy(_qp.invert().multiply(_qw)); b.updateMatrixWorld(true); }
export function ik2(a, b, c, t, pole){ if(!a || !b || !c) return; a.getWorldPosition(_ia); b.getWorldPosition(_ib); c.getWorldPosition(_ic);
  const l1 = _ia.distanceTo(_ib), l2 = _ib.distanceTo(_ic); _id.subVectors(t, _ia); const dist = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(l1 + l2 - 1e-3, _id.length())); _id.normalize();
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _if.subVectors(pole, _ia); _if.addScaledVector(_id, -_if.dot(_id)); if(_if.lengthSq() < 1e-8) _if.set(0, -1, 0); _if.normalize();
  _ig.copy(_ia).addScaledVector(_id, x).addScaledVector(_if, h); _it.copy(_ia).addScaledVector(_id, dist);
  aimBone(a, b, _ig.clone().sub(_ia).normalize()); b.getWorldPosition(_ib); aimBone(b, c, _it.clone().sub(_ib).normalize()); }
export function turnBone(b, axis, ang){ if(b && Math.abs(ang) > 1e-6) turn(b, axis, ang); }
