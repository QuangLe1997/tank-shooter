// actors/real-air.js — Z272 REAL AIRCRAFT: Tripo models take the place of the procedural airframes — the attack gunship, the swooping
// "swallow-wing" bomber, the heavy transport (troop carrier and paradrop ship), the sci-fi support UAV — and the paratroopers' canopies. The
// procedural airframe is hidden, the model is fitted to its size and centre inside the same group, so every flight, bank, tilt and crash
// animation carries it; what moves stays procedural and visible: main and tail rotors (the model's own static blades are cut away above the
// cabin), the gunship's chin cannon, bombs, nav lights, the UAV's gatling and ring. A paratrooper's canopy is the model's canopy (its own
// hanging soldier cut away below): the game's soldier hangs under it. Airframes built before the files arrive are dressed when they do.
import * as THREE from 'three';
import { REALAIR, VISLOOK } from '../../config.js';
import { loadGLTF } from '../hub.js';

const M = {}, WAIT = []; let _p = null;
const KEEP = ['rotor', 'trot', 'rotors', 'chin', 'muzzle', 'nav', 'bombs', 'gat', 'ring', 'turret', 'el'];

export function loadRealAir(){ if(_p) return _p; if(typeof window === 'undefined' || /procair/.test(location.search + location.hash)) return (_p = Promise.resolve(false));
  return (_p = Promise.all(Object.keys(REALAIR.models).map(k => loadGLTF(k).then(gl => [k, gl]))).then(L => {
    for(const [k, gl] of L){ if(gl) try{ M[k] = prep(gl, k); } catch(e){ console.warn('[air]', k, e.message); } }
    for(const [g, k] of WAIT.splice(0)) dress(g, k); return true; })); }

// the triangles of g listed in tris, as a new geometry
function subset(g, tris){ const out = new THREE.BufferGeometry();
  for(const a of ['position', 'normal', 'uv']){ const A = g.attributes[a]; if(!A) continue; const sz = A.itemSize, arr = new Float32Array(tris.length * 3 * sz); let o = 0;
    for(const t of tris) for(let j = 0; j < 3; j++) for(let q = 0; q < sz; q++) arr[o++] = A.getComponent(t * 3 + j, q);
    out.setAttribute(a, new THREE.BufferAttribute(arr, sz)); }
  return out; }
// one geometry, nose toward +z (config yaw), centred; the static rotor disc or the hanging soldier cut away
function prep(gl, k){ const S = REALAIR.models[k]; let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; });
  let g = src.geometry.clone().applyMatrix4(src.matrixWorld); g = g.index ? g.toNonIndexed() : g;
  for(const a of Object.keys(g.attributes)) if(a !== 'position' && a !== 'normal' && a !== 'uv') g.deleteAttribute(a);
  if(S.yaw) g.rotateY(S.yaw); g.computeBoundingBox(); let b = g.boundingBox;
  const H = b.max.y - b.min.y, W = Math.max(b.max.x - b.min.x, b.max.z - b.min.z); let cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  if(S.cutRotor){ const P = g.attributes.position, top = new THREE.Box3(), v = new THREE.Vector3(); for(let i = 0; i < P.count; i++) if(P.getY(i) > b.max.y - S.cutRotor * H) top.expandByPoint(v.fromBufferAttribute(P, i)); cx = (top.min.x + top.max.x) / 2; cz = (top.min.z + top.max.z) / 2; }   // the mast: the middle of the blade disc
  if(S.cutRotor || S.keepAbove != null){ const P = g.attributes.position, keep = [];
    for(let t = 0; t < P.count / 3; t++){ let x = 0, y = 0, z = 0; for(let j = 0; j < 3; j++){ x += P.getX(t * 3 + j); y += P.getY(t * 3 + j); z += P.getZ(t * 3 + j); } x /= 3; y /= 3; z /= 3;
      if(S.keepAbove != null && y < b.min.y + S.keepAbove * H) continue;
      if(S.cutRotor && y > b.max.y - S.cutRotor * H && Math.hypot(x - cx, z - cz) > S.hubR * W) continue;
      keep.push(t); }
    g = subset(g, keep); }
  g.computeBoundingBox(); b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2); g.computeBoundingBox(); g.computeBoundingSphere();
  const mat = src.material.clone(); mat.envMapIntensity = S.env ?? 1; mat.side = S.double ? THREE.DoubleSide : THREE.FrontSide;
  { const C = VISLOOK.r2.cloth[k]; if(C){ mat.metalness = C[0]; mat.roughness = C[1]; } }   // VIS 10 a canopy is cloth, not polished metal (a flat cream disc at night)
  return { geo:g, mat, size:g.boundingBox.getSize(new THREE.Vector3()) }; }

// dress a procedural airframe group (or a parachute) as model k: now if it is in, else as soon as it is
export function realAir(g, k){ if(!g || !REALAIR.models[k] || typeof window === 'undefined') return g; if(M[k]) dress(g, k); else { WAIT.push([g, k]); loadRealAir(); } return g; }
const _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4(), _tb = new THREE.Box3();
function dress(g, k){ const R = M[k], S = REALAIR.models[k], ud = g.userData || (g.userData = {}); if(!R || ud.realAir) return;
  const host = ud.body || g, keep = new Set(), names = S.keep || KEEP;
  for(const n of names){ const v = ud[n]; for(const o of (Array.isArray(v) ? v : v ? [v] : [])) if(o && o.traverse) o.traverse(c => keep.add(c)); }
  g.updateMatrixWorld(true); _inv.copy(host.matrixWorld).invert(); const box = new THREE.Box3(), hide = [];
  host.traverse(o => { if(keep.has(o) || o === host || !(o.isMesh || o.isLineSegments || o.isSprite)) return; hide.push(o);
    if(o.isMesh && o.geometry){ if(!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _rel.multiplyMatrices(_inv, o.matrixWorld); box.union(_tb.copy(o.geometry.boundingBox).applyMatrix4(_rel)); } });
  if(box.isEmpty()) return; for(const o of hide) o.visible = false;
  const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), f = (S.fit || 1) * Math.max(sz.x, sz.z) / Math.max(R.size.x, R.size.z);
  const m = new THREE.Mesh(R.geo, R.mat); m.scale.setScalar(f); m.position.set(c.x, c.y + (S.dy || 0) * sz.y, c.z); m.castShadow = true; m.receiveShadow = true; host.add(m);
  if(ud.rotor && S.rotorUp != null) ud.rotor.position.y = c.y + R.size.y * f * S.rotorUp;
  ud.realAir = m; }
