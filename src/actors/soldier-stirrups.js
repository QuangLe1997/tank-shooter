// actors/soldier-stirrups.js — Z371 THE RIDER'S FEET IN THE STIRRUPS: the riding clips sit the soldier with his knees drawn up and his feet only a
//   quarter of a metre out from the horse's middle — inside its barrel at that height (measured: the flank is 0.33–0.42 m out), so his shins and boots
//   vanished into the horse and behind the saddle bags. The war horse gets its stirrups back — a leather on each side from the saddle's skirt down
//   past the barrel to a steel iron, hung on the horse's back bone so they ride with it — and every frame on the horse his legs are laid to them:
//   hip → knee (out over the saddle flap, a little forward) → the ankle just behind the iron, the ball of the foot on its tread, the heel down and the
//   toe turned a touch out. At the gallop the clip lifts him out of the saddle; his feet stay in the irons and his knees take it.
import * as THREE from 'three';
import { REALCAV, STIRRUP } from '../../config.js';
import { LEGKIT, ik2, scene } from '../hub.js';

const V3 = () => new THREE.Vector3();
const _p = V3(), _a = V3(), _b = V3(), _d = V3(), FWD = V3(), UPV = V3(), LFT = V3(), _q = new THREE.Quaternion();

// the stirrups, made once on the real horse: hung from its seat bone (they move with its back), each with a marker on the iron's tread
function makeStirrups(R, H){ const sb = R.hr && R.hr.getObjectByName(REALCAV.seatBone); if(!sb) return null; const ST = STIRRUP, root = H.root; root.updateMatrixWorld(true); R.hr.updateMatrixWorld(true);
  const q = root.getWorldQuaternion(new THREE.Quaternion()), o = root.getWorldPosition(V3()), W = a => V3().set(a[0], a[1], a[2]).applyQuaternion(q).add(o), fw = V3().set(0, 0, 1).applyQuaternion(q);
  const leather = new THREE.MeshStandardMaterial({ color:ST.leather, roughness:0.85 }), steel = new THREE.MeshStandardMaterial({ color:ST.steel, roughness:0.35, metalness:0.85 }), out = {};
  for(const [k, sd] of [['Left', 1], ['Right', -1]]){ const top = W([sd * ST.top[0], ST.top[1], ST.top[2]]), tread = W([sd * ST.iron[0], ST.iron[1], ST.iron[2]]), up = V3().set(0, 1, 0).applyQuaternion(q);
    const eye = tread.clone().addScaledVector(up, ST.r * 2);   // (the iron's eye, where the leather goes through)
    // the leather: a flat strip, its flat face to the horse's side
    const dir = top.clone().sub(eye), len = dir.length(); dir.normalize(); const ax = fw.clone().addScaledVector(dir, -fw.dot(dir)).normalize(), az = V3().crossVectors(ax, dir);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(ST.w, len, ST.t), leather); strap.matrixAutoUpdate = true; strap.position.copy(top).lerp(eye, 0.5);
    strap.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax, dir, az)); strap.castShadow = true;
    // the iron: a loop hanging off the leather, its opening along the horse, a flat tread at the bottom
    const iron = new THREE.Group(), ring = new THREE.Mesh(new THREE.TorusGeometry(ST.r, ST.tube, 6, 16), steel), bar = new THREE.Mesh(new THREE.BoxGeometry(ST.r * 2.1, ST.tube * 2.2, ST.tread), steel);
    bar.position.y = -ST.r; iron.add(ring, bar); iron.position.copy(tread).addScaledVector(up, ST.r); iron.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3().crossVectors(up, fw).normalize(), up, fw));
    iron.traverse(m => { if(m.isMesh) m.castShadow = true; });
    const mark = new THREE.Object3D(); mark.position.set(0, -ST.r, 0); iron.add(mark);
    scene.add(strap, iron); strap.updateMatrixWorld(true); iron.updateMatrixWorld(true); sb.attach(strap); sb.attach(iron); out[k] = mark; }   // (placed in the world, then hung on the bone as they are)
  return out; }

// every frame sat on the horse (from actors/real-cav.js, after the clip, before the upper body): both legs to the irons
export function stirrupFeet(R, H){ const D = R.pup && R.pup.D, ST = STIRRUP; if(!D || !D.LeftUpLeg || !D.RightUpLeg || !R.hr || H.bike) return;
  const S = R.stirrups || (R.stirrups = makeStirrups(R, H)); if(!S) return;
  H.root.getWorldQuaternion(_q); FWD.set(0, 0, 1).applyQuaternion(_q); UPV.set(0, 1, 0).applyQuaternion(_q); LFT.set(1, 0, 0).applyQuaternion(_q);   // (+x is the horse's left)
  // the gallop clip stands him up a long way out of the saddle — further than his legs reach down to the irons: he comes down until they do, knees soft
  if(!R.legLen){ const P1 = V3(), P2 = V3(), P3 = V3(); D.LeftUpLeg.getWorldPosition(P1); D.LeftLeg.getWorldPosition(P2); D.LeftFoot.getWorldPosition(P3); R.legLen = P1.distanceTo(P2) + P2.distanceTo(P3); }
  let drop = 0; for(const [L] of [['Left'], ['Right']]){ S[L].getWorldPosition(_p); _p.addScaledVector(UPV, ST.ankle).addScaledVector(FWD, -ST.ball); D[L + 'UpLeg'].getWorldPosition(_b);
    const over = _b.distanceTo(_p) - R.legLen * ST.reach; if(over > drop) drop = over; }
  if(drop > 1e-3){ D.Hips.getWorldPosition(_b).addScaledVector(UPV, -Math.min(drop, ST.drop)); D.Hips.parent.worldToLocal(_b); D.Hips.position.copy(_b); D.Hips.updateMatrixWorld(true); }
  for(const [L, sd] of [['Left', 1], ['Right', -1]]){ const up = D[L + 'UpLeg'], kn = D[L + 'Leg'], ft = D[L + 'Foot'], toe = D[L + 'ToeBase']; if(!up || !kn || !ft) continue;
    S[L].getWorldPosition(_p);
    _a.copy(_p).addScaledVector(UPV, ST.ankle).addScaledVector(FWD, -ST.ball);   // the ankle: over the tread, behind the ball of the foot
    up.getWorldPosition(_b); _b.addScaledVector(LFT, sd * ST.knee[0]).addScaledVector(FWD, ST.knee[1]).addScaledVector(UPV, -0.15);   // the knee out over the flap, a little forward
    ik2(up, kn, ft, _a.clone(), _b.clone());
    if(toe) LEGKIT.aim(ft, toe, _d.copy(FWD).addScaledVector(UPV, Math.tan(ST.heel)).addScaledVector(LFT, sd * ST.out).normalize()); } }   // (the heel down, the toe a touch out)
