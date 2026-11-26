// world/solid-shape.js — Z337 THE SHAPE A THING REALLY HAS, for whatever bumps into it: a block is kept as a circle for the bullets and the AI, but a
//   long wall, a fortress wall section and a city building are not round. Treated as circles, a fortress wall section (3 m long, its stone foot 6 m
//   thick) stopped a man 2 m out from its face in one place and let him half into it at the next joint; a building (a grid of 2 m circles) stood 0.5 m
//   proud of its facade in places and left a 1 m gap at its far edge — a soldier or a ride stuck in the open, or walked into the wall and the camera
//   saw inside. Here each gets its true footprint as an oriented box { x, z, obb:{ f, hl, hw } } (along (sin f, cos f) ± hl, across ± hw) — or null
//   for one that really is round — and the push of a body (a circle) out of it, and the first point a sight line meets a building (NO-TANKS 10 or a big rock).
import * as THREE from 'three';
import { FORT } from '../../config.js';
import { blocks, cityBuildings, heightAt, scene, sceneDims } from '../hub.js';

const SHAPE = Symbol('shape'), FOOT = Symbol('foot');
// Z378 foot = asked for the soldier or his ride: a fortress wall section cut back from a breach (pc.cut0 at its start, cut1 at its end — world/fortress.js
//   dressFort) ends where its stone does, so the breach is open to them; a tank still meets the whole section
// Z413 a fort wall section's thickness: the procedural wall's battered talus (wallT + 3 m at its foot) — or, once the fort is dressed in its real model
//   (world/fortress.js dressFort, every battlefield now), that model's own thickness (wallT × REALFORT.thick): the 6.2 m box stood 1.1–1.9 m clear of
//   the drawn stone on both faces — and each section as thick as its own stretch of that model (a buttress here, plain curtain there). Along the run
//   nothing changes (the sections still meet end to end), so a fort stays sealed.
const fortHW = bl => { const f = bl.fort, sl = f && f.wallSl && f.wallSl[bl.piece.i], g = sl && sl[0].geometry;
  if(g){ if(!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox; if(!b.isEmpty()) return Math.min(f.wallHW || 9, Math.max(-b.min.z, b.max.z) + 0.05); }
  return (f && f.wallHW) || (FORT.wallT + 3.0) / 2; };
// SYNC 1 plan = the shape the LAYOUT gives a thing, whatever model is drawn on it at the moment: a seeded battle's tracks are laid round these (world/trails.js),
//   so the same seed gives the same tracks whether the scans were in when the field was built or not. A piece of cover is its own box when the layout gave
//   it one (a container, a wreck), else its circle; a fort wall section is the drawn wall's thickness; a watchtower's circle is not read off its model here.
function planShape(bl){ if(bl.obb) return bl; if(bl.kind === 'fortwall' && bl.piece){ const pc = bl.piece; return { x:bl.x, z:bl.z, obb:{ f:Math.atan2(pc.ux, pc.uz), hl:Math.max(0.1, pc.pl / 2 + 0.02), hw:(FORT.wallT + 3.0) / 2 } }; }
  if(bl.kind === 'building' && bl.bld){ const B = bl.bld; return B[SHAPE] || (B[SHAPE] = { x:B.x, z:B.z, obb:{ f:B.ry, hl:B.d / 2, hw:B.w / 2 }, bld:B }); } return null; }
export function solidShape(bl, foot, plan){ if(!bl) return null; if(plan) return planShape(bl); if(bl.cover && bl.mesh && bl.mesh.isMesh) return coverShape(bl); if(bl.obb) return bl;
  if(bl.kind === 'fortwall' && bl.piece){ const pc = bl.piece, hw = fortHW(bl), cut = foot && (pc.cut0 || pc.cut1), K = cut ? FOOT : SHAPE, c = bl[K]; if(c && c.obb.hw === hw) return c;
    const c0 = cut ? pc.cut0 || 0 : 0, c1 = cut ? pc.cut1 || 0 : 0, sh = (c0 - c1) / 2;   // (Z378 foot: cut back from a breach, for the soldier and his ride)
    return (bl[K] = { x:bl.x + pc.ux * sh, z:bl.z + pc.uz * sh, obb:{ f:Math.atan2(pc.ux, pc.uz), hl:Math.max(0.1, (pc.pl - c0 - c1) / 2 + 0.02), hw } }); }
  if(bl.fitR) fitCircle(bl); const c = bl[SHAPE]; if(c !== undefined) return c; let s = null;
  if(bl.kind === 'building' && bl.bld){ const B = bl.bld; s = B[SHAPE] || (B[SHAPE] = { x:B.x, z:B.z, obb:{ f:B.ry, hl:B.d / 2, hw:B.w / 2 }, bld:B }); }
  bl[SHAPE] = s; return s; }
// Z413 A ROUND THING AS BIG AS IT IS DRAWN: an objective (r from its table, 4.8 m round a 2.8 m bunker) or a watchtower (2.4 m round 1.6 m of legs)
//   stopped a vehicle in front of nothing. Its circle is read off the drawn model — what stands 0.25–3 m over the ground (walls, legs, sandbags; not the
//   men on it, nor a glowing beam), 95 % of it inside — never bigger than it was set, and read again (at most once a second) whenever the model changes
//   (a scanned tower or ruin swaps in when its file arrives). Bullets and the AI use the same r.
const _fv = new THREE.Vector3();
const drawn = (o, top) => { for(let q = o; q && q !== top.parent; q = q.parent) if(!q.visible) return false; const mt = [].concat(o.material)[0]; return !(mt && (mt.transparent || mt.depthWrite === false)); };
export function fitCircle(bl){ const now = performance.now(); if(now < (bl._fitT || 0)) return; bl._fitT = now + 1000; const m = bl.mesh; if(!m || !m.isObject3D) return;
  const L = []; let sig = 0; m.traverse(o => { if(o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && o.geometry && drawn(o, m)){ L.push(o); sig += o.geometry.id * 7 + 1; } });
  if(sig === bl._fitSig) return; bl._fitSig = sig; if(bl._r0 == null) bl._r0 = bl.r; m.updateWorldMatrix(true, true); const g0 = heightAt(bl.x, bl.z), d = [];
  for(const o of L){ const P = o.geometry.attributes.position; if(!P) continue; const st = Math.max(1, (P.count / 4000) | 0);
    for(let i = 0; i < P.count; i += st){ _fv.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); const h = _fv.y - g0; if(h > 0.25 && h < 3) d.push(Math.hypot(_fv.x - bl.x, _fv.z - bl.z)); } }
  if(d.length < 8) return; d.sort((a, b) => a - b); bl.r = Math.max(0.6, Math.min(bl._r0, d[Math.floor(d.length * 0.95)] + 0.1)); }
// Z404 A PIECE OF COVER IS THE BOX OF WHAT IS DRAWN: its collision was a circle of COVER_R × 1.3 ≈ 2.2 m round each piece of a line — a sandbag
//   wall 1.2 m deep, a jersey barrier, a row of tyres — and the real models (Z252) are fitted inside the old piece, often narrower, so the circle
//   stood up to 1.3 m clear of a face: a ride, a tank or a man stopped in front of nothing (and rounds struck the air). The box is read off the
//   mesh's own geometry as it stands — its turn, its scale (it shrinks as it is shot down), the real model once that is swapped in
const COVER = Symbol('cover'), _cc = new THREE.Vector3();
function coverShape(bl){ const m = bl.mesh, g = m.geometry, c = bl[COVER];
  if(c && c.g === g && c.px === m.position.x && c.pz === m.position.z && c.ry === m.rotation.y && c.sc === m.scale.x) return c.s;
  if(!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox; if(b.isEmpty()) return bl.obb ? bl : null;
  m.updateWorldMatrix(true, false); const e = m.matrixWorld.elements; _cc.set((b.min.x + b.max.x) / 2, 0, (b.min.z + b.max.z) / 2).applyMatrix4(m.matrixWorld);
  const sx = Math.hypot(e[0], e[1], e[2]), sz = Math.hypot(e[8], e[9], e[10]);
  const s = { x:_cc.x, z:_cc.z, obb:{ f:Math.atan2(e[8], e[10]), hl:Math.max(0.2, (b.max.z - b.min.z) / 2 * sz), hw:Math.max(0.2, (b.max.x - b.min.x) / 2 * sx) }, cover:bl };
  bl[COVER] = { g, px:m.position.x, pz:m.position.z, ry:m.rotation.y, sc:m.scale.x, s }; return s; }
// a parked car (crushables entry): the box of its own model, turned as it stands
const _bb = new THREE.Box3();
export function carShape(c){ const k = c[SHAPE]; if(k !== undefined) return k; let s = null; const g = c.im && c.im.geometry;
  if(g){ if(!g.boundingBox) g.computeBoundingBox(); g.boundingBox && _bb.copy(g.boundingBox); const hw = (_bb.max.x - _bb.min.x) / 2, hl = (_bb.max.z - _bb.min.z) / 2;
    if(hw > 0.3 && hl > 0.6 && hl < 4) s = { x:c.x, z:c.z, obb:{ f:c.ry || 0, hl, hw } }; }
  c[SHAPE] = s; return s; }
// push a body at p.pos (radius R) out of a shape; returns the closing speed it hit at (0 moving away, -1 clear). Its velocity loses what goes into it.
export function pushOutShape(p, S, R, vel = p.vel){ const o = S.obb, s = Math.sin(o.f), c = Math.cos(o.f), dx = p.pos.x - S.x, dz = p.pos.z - S.z;
  const al = dx * s + dz * c, ac = dx * c - dz * s;   // along · across
  if(Math.abs(al) > o.hl + R || Math.abs(ac) > o.hw + R) return -1;
  const qa = Math.max(-o.hl, Math.min(o.hl, al)), qc = Math.max(-o.hw, Math.min(o.hw, ac)); let ea = al - qa, ec = ac - qc, d = Math.hypot(ea, ec), pen;
  if(d > 1e-5){ if(d >= R) return -1; pen = R - d; ea /= d; ec /= d; }
  else { const pa = o.hl - Math.abs(al), pc = o.hw - Math.abs(ac); if(pa < pc){ ea = Math.sign(al) || 1; ec = 0; pen = pa + R; } else { ea = 0; ec = Math.sign(ac) || 1; pen = pc + R; } }   // inside it: out the nearest side
  const nx = ea * s + ec * c, nz = ea * c - ec * s; p.pos.x += nx * pen; p.pos.z += nz * pen;
  if(!vel) return 0; const vn = vel.x * nx + vel.z * nz; if(vn < 0){ vel.x -= nx * vn; vel.z -= nz * vn; return -vn; } return 0; }
// where a straight sight line (a → b, world) first enters a standing building (share 0…1 of the way), or 1 if it meets none — for the follow camera
export function sightToBuildings(ax, ay, az, bx, by, bz, pad = 0.4){ let t0 = 1; const B = cityBuildings(); if(!B || !B.length) return 1;
  const minX = Math.min(ax, bx) - 40, maxX = Math.max(ax, bx) + 40, minZ = Math.min(az, bz) - 40, maxZ = Math.max(az, bz) + 40;
  for(const Bd of B){ if(Bd.dead || Bd.top < 0 || Bd.x < minX || Bd.x > maxX || Bd.z < minZ || Bd.z > maxZ) continue; const f = Bd.floors[Bd.top], top = f ? f.y1 : Bd.y0; if(!(top > Bd.y0 + 1)) continue;
    const s = Math.sin(Bd.ry), c = Math.cos(Bd.ry), hl = Bd.d / 2 + pad, hw = Bd.w / 2 + pad;
    const la = (ax - Bd.x) * s + (az - Bd.z) * c, lc = (ax - Bd.x) * c - (az - Bd.z) * s, lb = (bx - Bd.x) * s + (bz - Bd.z) * c, ld = (bx - Bd.x) * c - (bz - Bd.z) * s;
    let u0 = 0, u1 = 1, ok = true;   // slab clip in its own frame, then the height
    for(const [p0, p1, h] of [[la, lb, hl], [lc, ld, hw]]){ const d = p1 - p0; if(Math.abs(d) < 1e-9){ if(Math.abs(p0) > h){ ok = false; break; } continue; }
      let e0 = (-h - p0) / d, e1 = (h - p0) / d; if(e0 > e1) [e0, e1] = [e1, e0]; u0 = Math.max(u0, e0); u1 = Math.min(u1, e1); if(u0 > u1){ ok = false; break; } }
    if(!ok) continue; const yIn = ay + (by - ay) * u0, yOut = ay + (by - ay) * u1; if(Math.min(yIn, yOut) > top + pad || Math.max(yIn, yOut) < Bd.y0 - 1) continue;
    if(u0 < t0) t0 = u0; }
  return t0; }
// NO-TANKS 10 THE ROCKS IN THE CAMERA'S WAY: on the crag lands (the quarry's, the desert's, the arctic's) a photographed cliff face, a spire or a
//   perched boulder 6–20 m tall stood between the follow camera and the soldier, and the view was rock. Every piece of scenery (world/scenery.js
//   scenePiece, tagged userData.scene) and every solid rock of the land drawn as its own mesh (a 'crag' block) that stands 2.2 m or more over the
//   ground is kept as an upright box (what it draws, in its own frame — the file's size until the file is in — turned with it) and, inside it, the
//   rock's own height on a grid of about a metre (the highest of its drawn points over each cell, spread a cell): a cliff face is a long, thin,
//   ragged slab and its box is mostly air, so a sight line is in the rock only where it passes under that height. Gathered every 2.5 s (a piece's
//   box and grid are worked out once per set of levels it has loaded); the metre round the soldier himself never counts (he stands against it).
const CAMROCK = { list:[], at:-1e9 }, ROCKBOX = new WeakMap(), _rb = new THREE.Box3(), _rbo = new THREE.Box3(), _rm = new THREE.Matrix4(), _ri = new THREE.Matrix4(), _rc = new THREE.Vector3();
function rockGrid(o, R){ const cs = Math.max(0.8, Math.max(R.hl, R.hw) / 20), na = Math.ceil(2 * R.hl / cs), nc = Math.ceil(2 * R.hw / cs), raw = new Float32Array(na * nc).fill(-1e9), s = Math.sin(R.f), c = Math.cos(R.f); let any = false;
  let nv = 0; o.traverse(q => { if(q.isMesh && !q.isInstancedMesh && q.geometry && q.geometry.attributes.position) nv += q.geometry.attributes.position.count; }); const st = Math.max(1, (nv / 2500) | 0);   // ~2500 points a rock, all its levels together
  o.traverse(q => { if(!q.isMesh || q.isInstancedMesh || !q.geometry) return; const P = q.geometry.attributes.position; if(!P) return;
    for(let i = 0; i < P.count; i += st){ _rc.fromBufferAttribute(P, i).applyMatrix4(q.matrixWorld); const la = (_rc.x - R.x) * s + (_rc.z - R.z) * c, lc = (_rc.x - R.x) * c - (_rc.z - R.z) * s;
      const ia = Math.min(na - 1, Math.max(0, ((la + R.hl) / cs) | 0)), ic = Math.min(nc - 1, Math.max(0, ((lc + R.hw) / cs) | 0)), k = ia * nc + ic; if(_rc.y > raw[k]){ raw[k] = _rc.y; any = true; } } });
  if(!any) return null; const top = new Float32Array(na * nc).fill(-1e9);
  for(let a = 0; a < na; a++) for(let b = 0; b < nc; b++){ let m = -1e9; for(let da = -1; da <= 1; da++) for(let db = -1; db <= 1; db++){ const A = a + da, B = b + db; if(A >= 0 && A < na && B >= 0 && B < nc && raw[A * nc + B] > m) m = raw[A * nc + B]; } top[a * nc + b] = m; }
  return { cs, na, nc, top, raw }; }
function rockBox(o, key){ const sig = o.children.length, had = ROCKBOX.get(o); if(had && had.sig === sig) return had.box;
  o.updateWorldMatrix(true, true); _ri.copy(o.matrixWorld).invert(); _rb.makeEmpty();
  o.traverse(q => { if(q.isMesh && !q.isInstancedMesh && q.geometry){ const g = q.geometry; if(!g.boundingBox) g.computeBoundingBox(); if(g.boundingBox.isEmpty()) return; _rbo.copy(g.boundingBox).applyMatrix4(_rm.multiplyMatrices(_ri, q.matrixWorld)); _rb.union(_rbo); } });
  const drawn = !_rb.isEmpty(); if(!drawn){ if(!key) return null; const D = sceneDims(key); _rb.min.set(-D.x / 2, 0, -D.z / 2); _rb.max.set(D.x / 2, D.y, D.z / 2); }
  _rb.getCenter(_rc).applyMatrix4(o.matrixWorld); const s = o.scale, hy = (_rb.max.y - _rb.min.y) / 2 * s.y, top = _rc.y + hy;
  const box = top - heightAt(_rc.x, _rc.z) < 2.2 ? null : { x:_rc.x, z:_rc.z, f:o.rotation.y, hl:(_rb.max.z - _rb.min.z) / 2 * s.z, hw:(_rb.max.x - _rb.min.x) / 2 * s.x, y0:_rc.y - hy, y1:top, g:null };
  if(box && drawn) box.g = rockGrid(o, box);
  ROCKBOX.set(o, { sig, box }); return box; }
export function camRocks(){ const t = performance.now(); if(t - CAMROCK.at < 2500) return CAMROCK.list; CAMROCK.at = t; const L = CAMROCK.list, at = new Map(); L.length = 0;
  for(const o of scene.children){ const k = o.userData && o.userData.scene; if(k && o.visible !== false){ const b = rockBox(o, k); if(b){ L.push(b); at.set(spot(o.position.x, o.position.z), b); } } }
  for(const bl of blocks){ if(!ROCKY[bl.kind] || !bl.mesh) continue;
    if(bl.mesh.isMesh){ if(bl.mesh.parent === scene){ const b = rockBox(bl.mesh, null); if(b) L.push(b); } }
    else if(!bl.mesh.children.length){ const b = at.get(spot(bl.x, bl.z)); if(b && b.g) rockSolid(b); } }   // a crag's block stands where its rock is drawn
  return L; }
// NO-TANKS 10 A CRAG IS AS BIG AS ITS ROCK: a crag's block (world/fort-hill.js, world/iceberg.js) is a circle as wide as 45 % of the rock's narrow
//   side — a cliff face 22 m long was solid only in its middle 6 m, and a man walked into either end of it and stood inside the stone, the camera in it
//   with him. The block stays as it is (the bullets, the AI and the climb keep their circle); the soldier and his ride are also kept out of the rock as
//   it is drawn: a cell of its grid where the rock stands a metre or more over the ground under it, and over his feet (he can stand on top of it).
const ROCKY = { crag:1, shard:1 }, spot = (x, z) => Math.round(x * 20) + ',' + Math.round(z * 20);
function rockSolid(R){ const G = R.g; R.solid = true; if(G.solid) return; const s = Math.sin(R.f), c = Math.cos(R.f), M = new Uint8Array(G.na * G.nc);
  for(let a = 0; a < G.na; a++) for(let b = 0; b < G.nc; b++){ const k = a * G.nc + b, la = -R.hl + (a + 0.5) * G.cs, lc = -R.hw + (b + 0.5) * G.cs;
    if(G.raw[k] > -1e8 && G.raw[k] - heightAt(R.x + la * s + lc * c, R.z + la * c - lc * s) >= 1.0) M[k] = 1; }
  G.solid = M; }
function rockHit(R, G, la, lc, rad, feet){ const i0 = Math.max(0, Math.floor((la - rad + R.hl) / G.cs)), i1 = Math.min(G.na - 1, Math.floor((la + rad + R.hl) / G.cs)), j0 = Math.max(0, Math.floor((lc - rad + R.hw) / G.cs)), j1 = Math.min(G.nc - 1, Math.floor((lc + rad + R.hw) / G.cs));
  for(let i = i0; i <= i1; i++) for(let j = j0; j <= j1; j++){ const k = i * G.nc + j; if(!G.solid[k] || G.raw[k] < feet + 0.6) continue;
    const a0 = -R.hl + i * G.cs, b0 = -R.hw + j * G.cs, qa = Math.max(a0, Math.min(a0 + G.cs, la)) - la, qc = Math.max(b0, Math.min(b0 + G.cs, lc)) - lc; if(qa * qa + qc * qc < rad * rad) return true; }
  return false; }
// a body at p.pos (radius rad, its feet lift m over the ground) set back out of any crag's rock it has gone into: to the nearest place clear of it
//   (rings of 16 ways, 0.3 m apart); its velocity loses what goes into the rock. Returns the closing speed it hit at (0 moving away, -1 clear).
export function pushOutRocks(p, rad, lift = 0){ const L = camRocks(); let hit = -1; if(!L.length) return hit;
  for(const R of L){ const G = R.g; if(!R.solid || !G || !G.solid) continue; const x = p.pos.x, z = p.pos.z, e = R.hl + R.hw + rad; if(Math.abs(x - R.x) > e || Math.abs(z - R.z) > e) continue;
    const s = Math.sin(R.f), c = Math.cos(R.f), la = (x - R.x) * s + (z - R.z) * c, lc = (x - R.x) * c - (z - R.z) * s; if(Math.abs(la) > R.hl + rad || Math.abs(lc) > R.hw + rad) continue;
    const feet = heightAt(x, z) + lift; if(!rockHit(R, G, la, lc, rad, feet)) continue;
    let oa = 0, oc = 0, out = false; for(let d = 0.3; d <= 9 && !out; d += 0.3) for(let k = 0; k < 16; k++){ const w = k * 0.3927, qa = la + Math.cos(w) * d, qc = lc + Math.sin(w) * d; if(!rockHit(R, G, qa, qc, rad, feet)){ oa = qa - la; oc = qc - lc; out = true; break; } }
    if(!out) continue; const wx = oa * s + oc * c, wz = oa * c - oc * s, n = Math.hypot(wx, wz) || 1, nx = wx / n, nz = wz / n; p.pos.x += wx; p.pos.z += wz; hit = Math.max(hit, 0);
    const v = p.vel; if(v){ const vn = v.x * nx + v.z * nz; if(vn < 0){ v.x -= nx * vn; v.z -= nz * vn; hit = Math.max(hit, -vn); } } }
  return hit; }
// RIDE 1 is a body of radius rad stood at (x, z) inside a crag's rock as it is drawn? (a ride's feelers look ahead with it: game/ride-avoid.js) · is one near?
export function rockAt(x, z, rad){ for(const R of camRocks()){ const G = R.g; if(!R.solid || !G || !G.solid) continue; const e = R.hl + R.hw + rad; if(Math.abs(x - R.x) > e || Math.abs(z - R.z) > e) continue;
    const s = Math.sin(R.f), c = Math.cos(R.f), la = (x - R.x) * s + (z - R.z) * c, lc = (x - R.x) * c - (z - R.z) * s; if(Math.abs(la) > R.hl + rad || Math.abs(lc) > R.hw + rad) continue;
    if(rockHit(R, G, la, lc, rad, heightAt(x, z))) return true; } return false; }
export function rockNear(x, z, reach){ for(const R of camRocks()){ if(!R.solid) continue; const e = R.hl + R.hw + reach; if(Math.abs(x - R.x) < e && Math.abs(z - R.z) < e) return true; } return false; }
export function camRocksStale(){ CAMROCK.at = -1e9; }   // a new field: gather them again on the next look
// where the sight line a → b (world) first meets one of those rocks (share 0…1 of the way), or 1 if it meets none — for the follow camera
export function sightToRocks(ax, ay, az, bx, by, bz, pad = 0.3){ const L = camRocks(); if(!L.length) return 1; let t0 = 1;
  const minX = Math.min(ax, bx), maxX = Math.max(ax, bx), minZ = Math.min(az, bz), maxZ = Math.max(az, bz), len = Math.hypot(bx - ax, bz - az) || 1;
  for(const R of L){ const e = R.hl + R.hw + pad; if(R.x + e < minX || R.x - e > maxX || R.z + e < minZ || R.z - e > maxZ) continue;
    const s = Math.sin(R.f), c = Math.cos(R.f), hl = R.hl + pad, hw = R.hw + pad, la = (ax - R.x) * s + (az - R.z) * c, lc = (ax - R.x) * c - (az - R.z) * s, inside = Math.abs(la) <= hl && Math.abs(lc) <= hw;
    const G = R.g; if(inside && !G) continue;   // he stands on it or against it, and its shape is not in yet
    const lb = (bx - R.x) * s + (bz - R.z) * c, ld = (bx - R.x) * c - (bz - R.z) * s; let u0 = 0, u1 = 1, ok = true;
    for(const [p0, p1, lo, hi] of [[la, lb, -hl, hl], [lc, ld, -hw, hw], [ay, by, R.y0, R.y1 + pad]]){ const d = p1 - p0;
      if(Math.abs(d) < 1e-9){ if(p0 < lo || p0 > hi){ ok = false; break; } continue; }
      let e0 = (lo - p0) / d, e1 = (hi - p0) / d; if(e0 > e1) [e0, e1] = [e1, e0]; u0 = Math.max(u0, e0); u1 = Math.min(u1, e1); if(u0 > u1){ ok = false; break; } }
    if(!ok || u0 >= t0) continue; if(!G){ t0 = u0; continue; }
    const du = Math.min(0.5 / len, (u1 - u0) / 2 + 1e-6), near = 1.0 / len;   // walk the stretch inside the box against the rock's own height
    for(let u = Math.max(u0, near); u <= Math.min(u1, t0); u += du){ const pa = la + (lb - la) * u, pc = lc + (ld - lc) * u, y = ay + (by - ay) * u;
      const ia = Math.floor((pa + R.hl) / G.cs), ic = Math.floor((pc + R.hw) / G.cs); if(ia < 0 || ia >= G.na || ic < 0 || ic >= G.nc) continue;
      if(y <= (u * len < 3 ? G.raw : G.top)[ia * G.nc + ic] + pad && y >= R.y0){ t0 = u; break; } } }   // (by him the rock as drawn, unspread: it does not crowd him)
  return t0; }
