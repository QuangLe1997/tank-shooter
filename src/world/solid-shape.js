// world/solid-shape.js — Z337 THE SHAPE A THING REALLY HAS, for whatever bumps into it: a block is kept as a circle for the bullets and the AI, but a
//   long wall, a fortress wall section and a city building are not round. Treated as circles, a fortress wall section (3 m long, its stone foot 6 m
//   thick) stopped a man 2 m out from its face in one place and let him half into it at the next joint; a building (a grid of 2 m circles) stood 0.5 m
//   proud of its facade in places and left a 1 m gap at its far edge — a soldier or a ride stuck in the open, or walked into the wall and the camera
//   saw inside. Here each gets its true footprint as an oriented box { x, z, obb:{ f, hl, hw } } (along (sin f, cos f) ± hl, across ± hw) — or null
//   for one that really is round — and the push of a body (a circle) out of it, and the first point a sight line meets a building.
import * as THREE from 'three';
import { FORT } from '../../config.js';
import { cityBuildings } from '../hub.js';

const SHAPE = Symbol('shape');
export function solidShape(bl){ if(!bl) return null; if(bl.obb) return bl; const c = bl[SHAPE]; if(c !== undefined) return c; let s = null;
  if(bl.kind === 'fortwall' && bl.piece){ const pc = bl.piece; s = { x:bl.x, z:bl.z, obb:{ f:Math.atan2(pc.ux, pc.uz), hl:pc.pl / 2 + 0.02, hw:(FORT.wallT + 3.0) / 2 } }; }   // (its battered stone foot)
  else if(bl.kind === 'building' && bl.bld){ const B = bl.bld; s = B[SHAPE] || (B[SHAPE] = { x:B.x, z:B.z, obb:{ f:B.ry, hl:B.d / 2, hw:B.w / 2 }, bld:B }); }
  bl[SHAPE] = s; return s; }
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
