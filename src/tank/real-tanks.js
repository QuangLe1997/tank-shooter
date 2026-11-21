// tank/real-tanks.js — Z256 REAL TANKS: one Meshy-generated vehicle per family (western MBT, T-90-type, Merkava, Armata, IFV, SPG, UGV) dressed onto every procedural vehicle of that family. The model comes in separate parts (Smart Topology t2): they are sorted by shape — the gun (thin pieces chained along the centre line; its far end tells which way the model faces), the turret (the broadest part above the deck and everything standing on or built against it), the running gear (low parts along the sides, dropped: the procedural tracks and wheels stay, they animate), the hull (the rest). One transform keeps the model's own proportions and layout: the hull spans the procedural tracks, the turret and gun are slid level onto the game's turret pivot, the gun pivot and the muzzle points move to the real gun — so the suspension, the turret's traverse, the gun's elevation and recoil, the paint per side / battlefield, the hit flash and any barrel mounted later all keep working. Tanks built before the files load are tracked and dressed (in their rest pose) when they arrive; until then, or on failure, the procedural vehicle stays.
import * as THREE from 'three';
import { REALTANK } from '../../config.js';
import { loadGLTF, seatBarrel } from '../hub.js';

const LIVE = new Map(), FAM = {}, _m = new THREE.Matrix4(), _b = new THREE.Box3(), _v = new THREE.Vector3();
let _p = null;
export const REAL_TANK_FAM = FAM;   // the prepared families (hull / turret / gun geometry per family), for the tests and the lab
const famOf = id => { for(const [k, f] of Object.entries(REALTANK.fams)) if(f.designs.includes(id)) return k; return null; };

// called at the end of buildTank: dress now if the family is ready, else as soon as it is
export function realTank(g, opts){ const k = opts && opts.model ? famOf(opts.model) : null; if(!k || typeof window === 'undefined' || /proctank/.test(location.search + location.hash)) return g;
  g.traverse(o => { if(o.isMesh) o.userData.proc = true; });   // what the build made — kit hung on afterwards (the player's dozer blade, ERA bricks, flag) is left alone
  if(FAM[k]) dress(g, FAM[k]); else { LIVE.set(g, k); loadRealTanks(); } return g; }
export function loadRealTanks(){ if(_p) return _p;
  return (_p = Promise.all(Object.keys(REALTANK.fams).map(k => loadGLTF('tank_' + k).then(gl => [k, gl]))).then(L => {
    for(const [k, gl] of L){ if(!gl) continue; try{ FAM[k] = prepare(gl); } catch(e){ console.warn('[tanks]', k, e.message); } }
    for(const [g, k] of LIVE) if(FAM[k]) dress(g, FAM[k]); LIVE.clear(); return true; })); }

// ---- split the model into parts (connected pieces), sort them, turn it to face +Z, return one geometry per role
function prepare(gl){ let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; });
  const geo = src.geometry.clone().applyMatrix4(src.matrixWorld), P = geo.attributes.position, idx = geo.index.array, N = P.count;
  const rep = new Int32Array(N), seen = new Map(); for(let i = 0; i < N; i++){ const k = P.getX(i).toFixed(4) + ',' + P.getY(i).toFixed(4) + ',' + P.getZ(i).toFixed(4); if(!seen.has(k)) seen.set(k, i); rep[i] = seen.get(k); }
  const par = new Int32Array(N).map((_, i) => i), F = x => { while(par[x] !== x){ par[x] = par[par[x]]; x = par[x]; } return x; };
  for(let t = 0; t < idx.length; t += 3){ for(const j of [1, 2]){ const a = F(rep[idx[t]]), b = F(rep[idx[t + j]]); if(a !== b) par[a] = b; } }
  const parts = new Map();
  for(let t = 0; t < idx.length; t += 3){ const r = F(rep[idx[t]]); let c = parts.get(r); if(!c){ c = { tris:[], box:new THREE.Box3() }; parts.set(r, c); } c.tris.push(t); for(let j = 0; j < 3; j++) c.box.expandByPoint(_v.fromBufferAttribute(P, idx[t + j])); }
  const all = [...parts.values()], whole = new THREE.Box3(); for(const c of all) whole.union(c.box);
  const size = c => c.box.getSize(new THREE.Vector3()), L = Math.max(whole.max.x - whole.min.x, whole.max.z - whole.min.z);
  // the gun: thin pieces lying along the centre line in the upper part, chained end to end (a barrel often comes as sleeve + tube); the longest chain wins, a short one only
  // if nothing long is there (an IFV's autocannon); its far end is the front
  const wc = whole.getCenter(new THREE.Vector3()), wsz = whole.getSize(new THREE.Vector3()), H0 = wsz.y, G = REALTANK.gun, lat = Math.min(wsz.x, wsz.z) * 0.15;
  const segs = all.filter(c => { const s = size(c), cc = c.box.getCenter(new THREE.Vector3()), len = Math.max(s.x, s.z), thick = Math.max(s.y, Math.min(s.x, s.z));
    return cc.y >= whole.min.y + H0 * G[2] && Math.min(Math.abs(cc.x - wc.x), Math.abs(cc.z - wc.z)) <= lat && len >= thick * G[3] && thick < L * G[1]; });   // not a skirt rail, not an antenna
  const chains = []; for(const c of segs){ const ax = size(c).x >= size(c).z ? 'x' : 'z', o = ax === 'x' ? 'z' : 'x', cc = c.box.getCenter(new THREE.Vector3());
    const ch = chains.find(h => h.ax === ax && Math.abs(h.y - cc.y) < L * 0.03 && Math.abs(h.o - cc[o]) < L * 0.03 && c.box.min[ax] <= h.box.max[ax] + L * 0.02 && c.box.max[ax] >= h.box.min[ax] - L * 0.02);
    if(ch){ ch.parts.push(c); ch.box.union(c.box); } else chains.push({ ax, y:cc.y, o:cc[o], parts:[c], box:c.box.clone() }); }
  const clen = h => h.box.max[h.ax] - h.box.min[h.ax], aspect = h => { const s = h.box.getSize(new THREE.Vector3()); return clen(h) / Math.max(s.y, h.ax === 'x' ? s.z : s.x); };
  let gch = chains.filter(h => clen(h) > L * G[0]).sort((a, b) => clen(b) - clen(a))[0];
  if(!gch) gch = chains.filter(h => clen(h) > L * G[4] && aspect(h) >= 6 && h.y > whole.min.y + H0 * 0.6).sort((a, b) => clen(b) - clen(a))[0];
  const gunSet = new Set(gch ? gch.parts : []), gun = gch || null;
  const ctr = whole.getCenter(new THREE.Vector3()), gc = gun ? gun.box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0, 1);
  let fx = 0, fz = 1; if(gun){ if(gun.ax === 'x') fx = Math.sign(gc.x - ctr.x) || 1, fz = 0; else fz = Math.sign(gc.z - ctr.z) || 1; }
  const yaw = Math.atan2(-fx, fz) || 0;   // turn the front onto +Z
  // the turret: the broadest part above the hull's mid-height (not the gun), then everything resting on it within its footprint
  const midY = (whole.min.y + whole.max.y) / 2; let shell = null, area = 0;
  for(const c of all){ if(gunSet.has(c) || c.box.getCenter(_v).y < midY - (whole.max.y - whole.min.y) * 0.08) continue; const s = size(c), a = s.x * s.z; if(a > area){ area = a; shell = c; } }
  const shellMid = shell ? (shell.box.min.y + shell.box.max.y) / 2 : whole.max.y, deck = shell ? shell.box.min.y - (whole.max.y - whole.min.y) * 0.015 : whole.max.y, foot = shell ? shell.box.clone().expandByScalar(L * 0.03) : null;
  const gearTop = whole.min.y + (deck - whole.min.y) * REALTANK.gearK, halfW = (fz ? (whole.max.x - whole.min.x) : (whole.max.z - whole.min.z)) / 2;
  const role = c => { if(gunSet.has(c)) return 'gun'; const cc = c.box.getCenter(new THREE.Vector3());
    if(shell && c.box.min.y >= deck && (cc.x >= foot.min.x && cc.x <= foot.max.x && cc.z >= foot.min.z && cc.z <= foot.max.z || c.box.intersectsBox(foot) && c.box.max.y > shellMid)) return 'turret';   // standing on it, or built against it and rising past its middle (a casemate box)
    const side = fz ? Math.abs(cc.x - ctr.x) : Math.abs(cc.z - ctr.z); if(c.box.max.y <= gearTop && side > halfW * 0.4) return 'gear';
    return 'hull'; };
  const out = { hull:[], turret:[], gun:[] }; for(const c of all){ const r = role(c); if(out[r]) out[r].push(...c.tris); }
  const R = new THREE.Matrix4().makeRotationY(yaw), build = tris => { const g2 = new THREE.BufferGeometry(); for(const name of ['position', 'normal', 'uv']){ const A = geo.attributes[name]; if(!A) continue; const n = A.itemSize, arr = new Float32Array(tris.length * 3 * n);
      let o = 0; for(const t of tris) for(let j = 0; j < 3; j++){ const v = idx[t + j]; for(let q = 0; q < n; q++) arr[o++] = A.array[v * n + q]; } g2.setAttribute(name, new THREE.BufferAttribute(arr, n)); }
    g2.applyMatrix4(R); g2.computeBoundingBox(); g2.computeBoundingSphere(); return g2; };
  return { hull:build(out.hull), turret:build(out.turret), gun:out.gun.length ? build(out.gun) : null, mat:src.material, counts:{ hull:out.hull.length / 3, turret:out.turret.length / 3, gun:out.gun.length / 3, parts:all.length } }; }

// the procedural meshes of one group (not of the sub-groups that move on their own), their box in the tank's frame
function procBox(g, grp, skip){ const box = new THREE.Box3(), list = [], inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  grp.traverse(o => { if(!o.isMesh || !o.userData.proc) return; for(let q = o.parent; q && q !== grp; q = q.parent) if(skip.includes(q)) return; if(o === g.userData.blob) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _b.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld)); box.union(_b); list.push(o); });
  return { box, list }; }
// one transform for the whole model (front +Z → the tank's frame): the hull spans the procedural running gear (the tracks stay and keep turning — the
// hull's length and width follow them, not the procedural hull, whose war kit and add-ons make it bigger than the vehicle), its height keeps the model's own
// proportion, the width may stray from the length scale within REALTANK.dev; it stands on the procedural hull's bottom
function fitHull(F, gear, hull){ const box = gear.isEmpty() ? hull : gear, mb = F.hull.boundingBox, ms = mb.getSize(new THREE.Vector3()), ps = box.getSize(new THREE.Vector3()), D = REALTANK.dev;
  const mc = mb.getCenter(new THREE.Vector3()), pc = box.getCenter(new THREE.Vector3()), sl = ps.z * (gear.isEmpty() ? 1 : REALTANK.overGear) / ms.z, sx = Math.min(sl * D[1], Math.max(sl * D[0], ps.x / ms.x)), sy = sl;
  return new THREE.Matrix4().compose(new THREE.Vector3(pc.x - mc.x * sx, hull.min.y - mb.min.y * sy, pc.z - mc.z * sl), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sl)); }
// hang a part under a group so that it sits where `M` (model → tank frame) puts it
function place(g, grp, geo, M, mat, name){ const inGrp = new THREE.Matrix4().copy(grp.matrixWorld).invert().multiply(g.matrixWorld).multiply(M);
  const holder = new THREE.Group(); holder.name = 'real_' + name; holder.userData.real = true; inGrp.decompose(holder.position, holder.quaternion, holder.scale);
  const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; m.userData.real = true; m.userData.keep = true; holder.add(m); grp.add(holder); return m; }
const toTank = (g, o, p) => o.localToWorld(p).applyMatrix4(_m.copy(g.matrixWorld).invert());
const fromTank = (g, o, p) => o.worldToLocal(p.applyMatrix4(g.matrixWorld));

function dress(g, F){ const u = g.userData; if(u.realDressed || !u.body || !u.turret) return; u.realDressed = true;
  const tur = u.turret, gp = u.gunPivot, bg = u.barrelG, body = u.body;
  // measure and fit in the rest pose (a tank dressed late may already be turning its turret, laying its gun, rocking on its springs)
  const pose = [tur.rotation.clone(), gp && gp.rotation.clone(), body.rotation.clone()];
  tur.rotation.set(0, 0, 0); if(gp) gp.rotation.set(0, 0, 0); body.rotation.set(0, 0, 0); g.updateMatrixWorld(true);
  const H = procBox(g, body, [tur]), T = procBox(g, tur, [bg].filter(Boolean)), B = bg ? procBox(g, bg, []) : null;   // the turret set includes the mantlet on the gun pivot (the real turret brings its own)
  if(!H.box.isEmpty() && !T.box.isEmpty()){
    // each vehicle its own material (the paint per side, the hit flash), a light tint of its old hull colour so the side still reads
    const P = u.paint && u.paint[0], base = new THREE.Color(1, 1, 1).lerp(new THREE.Color(P ? P[1] : 0x8a8a7a), REALTANK.tint).multiplyScalar(REALTANK.shade), mat = F.mat.clone(); mat.color.copy(base); mat.envMapIntensity = REALTANK.env;
    const M = fitHull(F, procBox(g, g, [body]).box, H.box); place(g, body, F.hull, M, mat, 'hull');
    // the turret and its gun keep the model's layout, slid level so the turret's middle sits on the game's turret pivot (it turns about it)
    const tc = F.turret.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(M), q = toTank(g, tur, new THREE.Vector3());
    const MT = new THREE.Matrix4().makeTranslation(q.x - tc.x, 0, q.z - tc.z).multiply(M); place(g, tur, F.turret, MT, mat, 'turret');
    for(const o of H.list.concat(T.list)){ o.visible = false; o.userData.realHidden = true; }
    if(F.gun && gp && B && !B.box.isEmpty()){
      // the gun pivot goes to the height of the real gun's axis (any barrel mounted later — the player's weapons — comes out of the real mantlet)
      const gb = F.gun.boundingBox, axis = new THREE.Vector3(0, (gb.min.y + gb.max.y) / 2, 0).applyMatrix4(MT), pv = toTank(g, gp, new THREE.Vector3()); pv.y = axis.y;
      gp.position.copy(fromTank(g, gp.parent, pv)); g.updateMatrixWorld(true);
      place(g, bg, F.gun, MT, mat.clone(), 'gun'); for(const o of B.list){ o.visible = false; o.userData.realHidden = true; }
      // the shells leave from the real muzzle: every muzzle point on the barrel moves to its tip (height and reach; a twin mount keeps its side offset)
      const tip = new THREE.Vector3((gb.min.x + gb.max.x) / 2, (gb.min.y + gb.max.y) / 2, gb.max.z).applyMatrix4(MT);
      const mz = new Set([u.muzzle].concat(u.mounts && u.mounts.main || [])); for(const o of mz){ if(!o || !isUnder(o, bg)) continue; o.updateMatrixWorld(true);
        const p = toTank(g, o, new THREE.Vector3()); p.y = tip.y; p.z = tip.z + 0.05; o.position.copy(fromTank(g, o.parent, p)); } }
    u.paint = [[mat, base.getHex()]]; u._small = null; }
  tur.rotation.copy(pose[0]); if(gp) gp.rotation.copy(pose[1]); body.rotation.copy(pose[2]); g.updateMatrixWorld(true);
  if(u.gunId) seatBarrel(g); }   // Z381 a weapon mounted before the real turret came: seated in it now (tank/seat-gun.js)
const isUnder = (o, p) => { for(let q = o; q; q = q.parent) if(q === p) return true; return false; };
