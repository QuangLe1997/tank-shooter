// world/real-fit.js — Z426 A DRAWN PIECE WEARING A SCAN FITTED TO ITS OWN BOX: the enemy camps' Quonset barracks and sleeping tents, the rocket
//   truck. The scan's long side is laid along the piece's, it is scaled to fill the piece's footprint (× fit, never taller than the piece × hMax) and
//   stood on the piece's foot; the drawn meshes hide, the piece's own groups (the truck's turntable, its muzzle) carry on. The rocket truck's scan is
//   cut in two where its launcher begins (REALFIT.launcher.pod: behind that share of its length, above that share of its height) — the pod turns
//   with the turntable, the truck stays. Until a file is in, or without it, the drawn piece stays.
import * as THREE from 'three';
import { REALFIT, REALTURRET } from '../../config.js';
import { loadGLTF, turretPiece } from '../hub.js';

const PREP = {};
// one scan as one geometry standing on its foot, centred, turned yaw about Y first (its front onto +z)
function prep(key, yaw){ const id = key + ':' + (yaw || 0); if(PREP[id]) return PREP[id];
  return (PREP[id] = loadGLTF(key).then(gl => { if(!gl) return null; let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; }); if(!src) return null;
    const g = src.geometry.clone().applyMatrix4(src.matrixWorld); if(yaw) g.rotateY(yaw); g.computeBoundingBox(); const b = g.boundingBox;
    g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.computeBoundingBox(); g.computeBoundingSphere();
    const mat = src.material.clone(); mat.envMapIntensity = REALFIT.env; return { geo:g, mat }; })); }
// the drawn meshes' box in the piece's own frame (its groups' meshes too) and the list of them
const _m = new THREE.Matrix4(), _b = new THREE.Box3();
function drawnBox(g){ g.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), box = new THREE.Box3(), list = [];
  g.traverse(o => { if(!o.isMesh || o.userData.realFit) return; if(!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _b.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld)); box.union(_b); list.push(o); });
  return { box, list }; }
// the scale that fills the box (the long sides laid the same way), and where the scan's foot goes
function fitTo(geo, box, fit){ const fs = geo.boundingBox.getSize(new THREE.Vector3()), bs = box.getSize(new THREE.Vector3());
  const turn = (bs.x > bs.z * 1.2 && fs.z > fs.x * 1.2) || (bs.z > bs.x * 1.2 && fs.x > fs.z * 1.2), fx = turn ? fs.z : fs.x, fz = turn ? fs.x : fs.z;
  return { k:Math.min(bs.x / fx, bs.z / fz, bs.y * REALFIT.hMax / fs.y) * (fit || 1), turn, c:box.getCenter(new THREE.Vector3()).setY(box.min.y) }; }
const wear = (geo, mat, f) => { const m = new THREE.Mesh(geo, mat); m.userData.realFit = true; m.scale.setScalar(f.k); if(f.turn) m.rotation.y = Math.PI / 2; m.position.copy(f.c); m.castShadow = m.receiveShadow = true; return m; };
// a camp's barracks or tent (REALFIT[kind]: the scan, how much of the footprint it fills); only = just these drawn meshes (Z429 a pillbox under its gun)
export function dressFit(g, kind, only){ const C = REALFIT[kind]; if(!C || typeof window === 'undefined' || (!only && g.userData.realFit)) return g; if(!only) g.userData.realFit = true;
  prep(C.k, C.yaw).then(F => { if(!F) return; let { box, list } = drawnBox(g); if(only){ list = list.filter(o => only.includes(o)); box = new THREE.Box3(); for(const o of list){ o.geometry.computeBoundingBox(); _b.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(new THREE.Matrix4().copy(g.matrixWorld).invert(), o.matrixWorld)); box.union(_b); } }
    if(box.isEmpty()) return; const f = fitTo(F.geo, box, C.fit); for(const q of list) q.visible = false; g.add(wear(F.geo, F.mat, f)); }); return g; }
// Z429 a scan stood where a drawn piece was (REALFIT[kind]): at (x, y, z) in par's frame, turned ry, w m across its widest side; the drawn meshes in hide go
export function placeScan(par, kind, x, y, z, ry, w, hide){ const C = REALFIT[kind]; if(!C || typeof window === 'undefined') return;
  prep(C.k, C.yaw).then(F => { if(!F) return; const s = F.geo.boundingBox.getSize(new THREE.Vector3()), m = wear(F.geo, F.mat, { k:w / Math.max(s.x, s.z), turn:false, c:new THREE.Vector3(x, y, z) });
    m.rotation.y = ry || 0; for(const q of hide || []) q.visible = false; par.add(m); }); }

// the rocket truck's scan in two: the launcher (behind pod[0] of its length from the back, above pod[1] of its height) and the rest
let LP = null;
function launcherParts(){ const C = REALFIT.launcher; if(LP) return LP;
  return (LP = prep(C.k, C.yaw).then(F => { if(!F) return null; const g = F.geo, P = g.attributes.position, I = g.index ? g.index.array : null, b = g.boundingBox, n = I ? I.length : P.count;
    const zc = b.min.z + (b.max.z - b.min.z) * C.pod[0], yc = b.min.y + (b.max.y - b.min.y) * C.pod[1], pod = [], rest = [];
    for(let t = 0; t < n; t += 3){ let y = 0, z = 0; for(let k = 0; k < 3; k++){ const v = I ? I[t + k] : t + k; y += P.getY(v); z += P.getZ(v); }
      (z / 3 < zc && y / 3 > yc ? pod : rest).push(I ? I[t] : t, I ? I[t + 1] : t + 1, I ? I[t + 2] : t + 2); }
    const part = L => { const q = new THREE.BufferGeometry(); for(const a in g.attributes) q.setAttribute(a, g.attributes[a]); q.setIndex(L); q.boundingBox = g.boundingBox.clone(); q.computeBoundingSphere(); return q; };
    return { whole:g, pod:part(pod), rest:part(rest), mat:F.mat }; })); }
export function dressLauncher(g){ const T = g.userData.turret; if(!REALFIT.launcher || !T || typeof window === 'undefined' || g.userData.realFit) return g; g.userData.realFit = true;
  launcherParts().then(P => { if(!P) return; const { box, list } = drawnBox(g); if(box.isEmpty()) return; const f = fitTo(P.whole, box, REALFIT.launcher.fit);
    for(const q of list) q.visible = false; g.add(wear(P.rest, P.mat, f)); const pod = wear(P.pod, P.mat, f); pod.position.sub(T.position); T.add(pod); }); return g; }
// Z429 the underground gate's guns: the remote weapon station scan on the drawn head (it turns with it); the drawn box and barrels hide, the red eye stays
export function dressHeadRWS(head, hide){ const C = REALTURRET.mg; if(!C || typeof window === 'undefined') return;
  turretPiece(C.k, C.w).then(T => { if(!T || head.userData.realFit) return; head.userData.realFit = true; const m = new THREE.Mesh(T.geo, T.mat); m.position.y = -0.35; m.castShadow = m.receiveShadow = true; head.add(m); for(const o of hide) o.visible = false; }); }
