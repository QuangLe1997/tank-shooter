// actors/hands.js — Z296 HANDS THAT HOLD: the Tripo / Mixamo rigs carry every finger (four joints each, both hands — 40 bones) but nothing ever moved
// them, so hands on a handlebar or a rifle hung open. curlHand closes a hand round what it holds: each finger joint turns about the knuckle line
// (index root → little-finger root), toward the thing gripped, the root joints most and the tips less; the thumb wraps across.
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _k = new THREE.Vector3(), _f = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const FING = ['Index', 'Middle', 'Ring', 'Pinky'], SEG = [0.95, 1.05, 0.75];
function turn(b, axis, ang){ if(!b) return; _q.setFromAxisAngle(axis, ang); b.getWorldQuaternion(_qw); _qw.premultiply(_q); b.parent.getWorldQuaternion(_qp); b.quaternion.copy(_qp.invert().multiply(_qw)); b.updateMatrixWorld(true); }

// B: bones by Mixamo name (no prefix) · side 'Left' | 'Right' · amt 0 (open) … 1 (a full fist) · toward: a world point inside the grip (bar, gun)
export function curlHand(B, side, amt, toward, spread = 0){ const h = B[side + 'Hand'], i1 = B[side + 'HandIndex1'], p1 = B[side + 'HandPinky1'], m1 = B[side + 'HandMiddle1'], m2 = B[side + 'HandMiddle2'];
  if(!h || !i1 || !p1 || !m1 || !m2 || amt <= 0) return;
  i1.getWorldPosition(_a); p1.getWorldPosition(_b); _k.subVectors(_b, _a).normalize();                  // the knuckle line
  m1.getWorldPosition(_a); m2.getWorldPosition(_b); _f.subVectors(_b, _a).normalize();                  // the way the fingers point
  _n.crossVectors(_k, _f); h.getWorldPosition(_c); _t.copy(toward).sub(_c);                             // turning +θ about the knuckle line sends the fingers along k × f
  const sg = _n.dot(_t) >= 0 ? 1 : -1, ax = _k.clone();
  for(const F of FING){ const sp = (F === 'Index' ? -1 : F === 'Pinky' ? 1 : F === 'Ring' ? 0.4 : 0) * spread;
    for(let s = 1; s <= 3; s++){ const b = B[side + 'Hand' + F + s]; if(!b) continue; turn(b, ax, sg * amt * SEG[s - 1] * 1.45); if(s === 1 && sp) turn(b, _f, sp * 0.12); } }
  // the thumb: across the front of the grip, its joints folding toward the palm
  for(let s = 1; s <= 3; s++) turn(B[side + 'HandThumb' + s], _f, -sg * (side === 'Left' ? -1 : 1) * amt * (s === 1 ? 0.35 : 0.55)); }
