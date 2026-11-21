// world/solid-shape.js — Z337 THE SHAPE A THING REALLY HAS, for whatever bumps into it: a block is kept as a circle for the bullets and the AI, but a
//   long wall, a fortress wall section and a city building are not round. Treated as circles, a fortress wall section (3 m long, its stone foot 6 m
//   thick) stopped a man 2 m out from its face in one place and let him half into it at the next joint; a building (a grid of 2 m circles) stood 0.5 m
//   proud of its facade in places and left a 1 m gap at its far edge — a soldier or a ride stuck in the open, or walked into the wall and the camera
//   saw inside. Here each gets its true footprint as an oriented box { x, z, obb:{ f, hl, hw } } (along (sin f, cos f) ± hl, across ± hw) — or null
//   for one that really is round — and the push of a body (a circle) out of it, and the first point a sight line meets a building.
import * as THREE from 'three';
import { FORT } from '../../config.js';
import { cityBuildings } from '../hub.js';

const SHAPE = Symbol('shape'), FOOT = Symbol('foot');
// Z378 foot = asked for the soldier or his ride: a fortress wall section cut back from a breach (pc.cut0 at its start, cut1 at its end — world/fortress.js
//   dressFort) ends where its stone does, so the breach is open to them; a tank still meets the whole section
export function solidShape(bl, foot){ if(!bl) return null; if(bl.cover && bl.mesh && bl.mesh.isMesh) return coverShape(bl); if(bl.obb) return bl;
  if(foot && bl.kind === 'fortwall' && bl.piece && (bl.piece.cut0 || bl.piece.cut1)){ if(bl[FOOT]) return bl[FOOT]; const pc = bl.piece, c0 = pc.cut0 || 0, c1 = pc.cut1 || 0, sh = (c0 - c1) / 2;
    return (bl[FOOT] = { x:bl.x + pc.ux * sh, z:bl.z + pc.uz * sh, obb:{ f:Math.atan2(pc.ux, pc.uz), hl:Math.max(0.1, (pc.pl - c0 - c1) / 2 + 0.02), hw:(FORT.wallT + 3.0) / 2 } }); } const c = bl[SHAPE]; if(c !== undefined) return c; let s = null;
  if(bl.kind === 'fortwall' && bl.piece){ const pc = bl.piece; s = { x:bl.x, z:bl.z, obb:{ f:Math.atan2(pc.ux, pc.uz), hl:pc.pl / 2 + 0.02, hw:(FORT.wallT + 3.0) / 2 } }; }   // (its battered stone foot)
  else if(bl.kind === 'building' && bl.bld){ const B = bl.bld; s = B[SHAPE] || (B[SHAPE] = { x:B.x, z:B.z, obb:{ f:B.ry, hl:B.d / 2, hw:B.w / 2 }, bld:B }); }
  bl[SHAPE] = s; return s; }
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
