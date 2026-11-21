// tank/real-guns.js — Z257 REAL GUNS: the player's weapons (the barrel assembly makeGunBarrel builds, on the player's tank, the showroom tank and the
// shop photos) wear a real model per family: the tube guns take the real gun off a tank model (120 mm off the western MBT, 105 mm HESH off the T-90
// type, the 152 mm canister gun off the howitzer, the 30 mm autocannon off the IFV), the rest come from their own Meshy model (twin MG, twin AA
// cannon, launcher pod, flame / cryo projector, rail weapon). Each model is laid along the assembly — front on the muzzle, its length filling the
// assembly's, its width / height within REALGUN.dev of that scale — and the procedural parts it covers are hidden; the muzzle points, the turret
// hardware (`mount`), the recoil and elevation stay as they were, and an energy weapon keeps its glowing parts on top. The lobbers (mortar, howitzer,
// siege rocket — tilted tubes), the rotary cannon (its barrels spin) and the two exotic ultimates stay procedural.
import * as THREE from 'three';
import { REALGUN } from '../../config.js';
import { REAL_TANK_FAM, barrelRoot, loadGLTF, loadRealTanks, seatBarrel } from '../hub.js';

const LIVE = new Map(), FAM = {}, _m = new THREE.Matrix4(), _b = new THREE.Box3();
let _p = null;
const famOf = id => { for(const [k, f] of Object.entries(REALGUN.fams)) if(f.guns.includes(id)) return k; return null; };
const YAW = { '+z':0, '-z':Math.PI, '+x':-Math.PI / 2, '-x':Math.PI / 2 };   // turns that model direction onto +Z (the muzzle)

// called at the end of makeGunBarrel: dress now if the family is ready, else as soon as it is
export function realGun(g, id){ const k = famOf(id); if(!k || typeof window === 'undefined' || /procgun/.test(location.search + location.hash)) return g;
  g.traverse(o => { if(o.isMesh) o.userData.proc = true; });
  if(FAM[k]) dressGun(g, REALGUN.fams[k], FAM[k]); else { LIVE.set(g, k); loadRealGuns(); } return g; }
export function loadRealGuns(){ if(_p) return _p;
  const own = Object.keys(REALGUN.fams).filter(k => !REALGUN.fams[k].fromTank);
  return (_p = Promise.all([loadRealTanks().catch(() => false)].concat(own.map(k => loadGLTF('gun_' + k).then(gl => [k, gl])))).then(([, ...L]) => {
    for(const [k, gl] of L){ if(!gl) continue; try{ FAM[k] = prepGun(gl, REALGUN.fams[k]); } catch(e){ console.warn('[guns]', k, e.message); } }
    for(const [k, f] of Object.entries(REALGUN.fams)){ const T = f.fromTank && REAL_TANK_FAM[f.fromTank]; if(T && T.gun) FAM[k] = { geo:T.gun, mat:T.mat }; }   // the real gun taken off that tank model
    for(const [g, k] of LIVE) if(FAM[k]) dressGun(g, REALGUN.fams[k], FAM[k]); LIVE.clear(); return true; })); }

// the model as one geometry, its muzzle turned onto +Z
function prepGun(gl, f){ let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; });
  const geo = src.geometry.clone().applyMatrix4(src.matrixWorld).applyMatrix4(new THREE.Matrix4().makeRotationY(YAW[f.front || '+z']));
  geo.computeBoundingBox(); geo.computeBoundingSphere(); return { geo, mat:src.material }; }

const pc_x = b => (b.min.x + b.max.x) / 2, glows = m => m && m.emissive && m.emissiveIntensity > 0 && m.emissive.r + m.emissive.g + m.emissive.b > 0.05;
function dressGun(g, f, F){ const u = g.userData; if(u.realGun) return; u.realGun = true; g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), box = new THREE.Box3(), list = [];
  g.traverse(o => { if(!o.isMesh || !o.userData.proc) return; if(!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _b.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld)); box.union(_b); list.push(o); });
  if(box.isEmpty()) return;
  const mb = F.geo.boundingBox, ms = mb.getSize(new THREE.Vector3()), ps = box.getSize(new THREE.Vector3()), D = f.dev || REALGUN.dev;
  const xs = f.pair && u.muzzles ? u.muzzles.map(o => o.position.x) : [pc_x(box)];   // a pair: one gun on each muzzle (the twin AA cannons)
  const sl = ps.z / ms.z, cl = v => Math.min(sl * D[1], Math.max(sl * D[0], v)), sx = cl(ps.x / xs.length / ms.x), sy = cl(ps.y / ms.y), mc = mb.getCenter(new THREE.Vector3()), pc = box.getCenter(new THREE.Vector3());
  const mat = F.mat.clone(); mat.envMapIntensity = REALGUN.env; if(f.tint || f.fromTank) mat.color.setHex(f.tint || REALGUN.tankTint);
  for(const x of xs){ const m = new THREE.Mesh(F.geo, mat); m.scale.set(sx, sy, sl); m.position.set(x - mc.x * sx, pc.y - mc.y * sy, box.max.z - mb.max.z * sl);   // front on the muzzle
    m.castShadow = m.receiveShadow = true; m.userData.real = true; m.userData.sharedGeo = true; m.name = 'real_gun'; g.add(m); }
  for(const o of list){ if(f.glow && glows(o.material)) continue; o.visible = false; o.userData.realHidden = true; }
  const root = barrelRoot(g); if(root) seatBarrel(root); }   // Z381 the real model came late: seat it again (its breech may differ from the procedural one's)
