// game/ride-collide.js — Z311 WHAT A RIDE RUNS INTO: the xe ôm (or the horse) is held by everything a tank simply rolls over — trees, poles and
// street lamps, parked cars and scooters, the bigger stones, the city's street furniture and every coil and bay of wire. Head-on it stops dead (it
// is pushed back out and its speed goes with it); a glancing blow slides it along; hard enough, a bike goes down. The light pieces (bins, chairs,
// café tables, barriers, stalls) go over when it hits them fast enough, and a wire bay or coil is flattened by a hard charge — then it goes on, slowed.
// Only in the air above a thing does it pass it (a wheelie's leap over a low one; game/xeom.js).
// Z404 a long ride meets things with its whole outline (rideHull), a tree with its drawn trunk (world/tree-fall.js trunkR), and the bán tải has its
// weight (ridePower): it climbs over what is low, smashes light cover, bursts brick walls, knocks the street's props and the wire flat.
import * as THREE from 'three';
import { RIDE_HIT, XEOM } from '../../config.js';
import { BUMPS, CITY_PROPS, CV, OUTPOST_WIRE, S, TRUNKS_DOWN, bikeHop, blocks, burst, crushAt, crushables, heightAt, knockProp, ramBlock, ramWall, rideBump, rideFence, rideWear, sfx, carShape, pushOutShape, trunkR } from '../hub.js';

// push the ride (pos, vel, radius R) back out of a circle; the closing speed it hit at (0 if it was moving away, -1 if clear of it)
function solid(p, x, z, r, R){ const dx = p.pos.x - x, dz = p.pos.z - z, rr = r + R, d2 = dx * dx + dz * dz; if(d2 >= rr * rr || d2 < 1e-6) return -1;
  const d = Math.sqrt(d2), nx = dx / d, nz = dz / d; p.pos.x += nx * (rr - d); p.pos.z += nz * (rr - d); const vn = p.vel.x * nx + p.vel.z * nz;
  if(vn < 0){ p.vel.x -= nx * vn; p.vel.z -= nz * vn; return -vn; } return 0; }
const dust = (x, z, n) => burst({ x, z }, 0xb8a888, n, 2.2, { y:heightAt(x, z) + 0.3, life:0.7, size:0.9, smoke:true, grav:-0.2, drag:2, op:0.4 });
// how tall each kind of thing a tank rolls over stands to a ride (m) — Infinity: never cleared; null: not in its way at all (grass, shrubs, pebbles)
const tall = c => c.kind === 'tree' || c.kind === 'topple' ? Infinity : c.kind === 'car' ? 1.5 : c.kind === 'moto' ? 1.1 : c.kind === 'rock' && c.r >= RIDE_HIT.rock ? c.r * 1.1 : null;
// Z404 THE RIDE'S OUTLINE: the circles (XEOM.hull, [x, z, r] m, +z ahead) laid over a long ride's drawn footprint — null: it is one circle (p.radius).
//   Its nose, tail and corners stop at a wall or a trunk, not its middle (the bán tải, 4.7 m long, used to run 1.4 m of bonnet into a tree first)
export const rideHull = H => H && H.bike && XEOM.hull[H.bike] || null;
export const ridePower = H => H && H.bike && XEOM.power[H.bike] || null;   // the bán tải's weight (null: a ride without it)
// what the bán tải rides over this frame — a footprint (a circle, or a box S) and its drawn height h — its wheels take it for ground (game/xeom.js)
export const RIDE_LOW = [];
export function rideLowReset(){ RIDE_LOW.length = 0; }
const lowAdd = (key, o) => { if(!RIDE_LOW.some(q => q.key === key)) RIDE_LOW.push(Object.assign(o, { key })); };
// how tall a block stands as drawn (m over the ground; Infinity: not a thing to drive over), read again whenever its model changes
const _lb = new THREE.Box3();
export function rideDrawnH(b){ const m = b.mesh; if(!m || !m.isObject3D || b.ridge || b.fort || b.wall || b.hp === Infinity) return Infinity; const g = m.geometry || m;
  if(b._dhG === g && b._dhS === m.scale.y) return b._dh; m.updateWorldMatrix(true, true); _lb.setFromObject(m); b._dhG = g; b._dhS = m.scale.y;
  return (b._dh = _lb.isEmpty() ? Infinity : _lb.max.y - heightAt(b.x, b.z)); }
// a low block in the bán tải's way (no higher than climbH, not made to stop vehicles): it rolls on over it — true
export function rideOver(b, PW, SH){ if(PW.never.includes(b.kind) || rideDrawnH(b) > PW.climbH) return false;
  lowAdd(b, SH ? { S:SH, h:b._dh } : { x:b.x, z:b.z, r:b.r, h:b._dh }); return true; }
// the bán tải rammed block b at closing speed vn (where it was, and its velocity, before it was pushed out: px, pz, vx, vz): a brick wall bursts at
//   PW.wallV (slower it is only knocked about), a light piece of cover is smashed (world/cover.js ramBlock, the blow × ramK) — and through it, on it drives: true
export function rideRam(p, b, vn, PW, px, pz, vx, vz){ const pl = S.player;
  if(b.wall){ if(vn < PW.wallV){ ramWall(pl, b, vn); return false; } ramWall(pl, b, 1e3); }
  else if(b.cover && !PW.never.includes(b.kind)){ ramBlock(b, vn * PW.ramK, pl); if(blocks.includes(b)) return false; }
  else return false;
  p.pos.x = px; p.pos.z = pz; p.vel.x = vx * PW.passK; p.vel.z = vz * PW.passK; CV.speed *= PW.passK; rideWear(CV.H, PW.wear); S.shake = Math.min(2.2, S.shake + 0.6); sfx('crunch'); return true; }
// the height (m) of what lies under a wheel at (x, z): what the bán tải is riding over, a heap of rubble, a fallen trunk (no higher than cap) — o.o: which
export function rideBumpAt(x, z, cap, o){ let h = 0, top = null;
  for(const q of RIDE_LOW){ let v = 0; if(q.S){ const B = q.S.obb, s = Math.sin(B.f), c = Math.cos(B.f), dx = x - q.S.x, dz = z - q.S.z, u = Math.max(Math.abs(dx * s + dz * c) / B.hl, Math.abs(dx * c - dz * s) / B.hw); if(u < 1) v = q.h * Math.min(1, (1 - u) * 5); }
    else { const dx = x - q.x, dz = z - q.z, u = (dx * dx + dz * dz) / (q.r * q.r); if(u < 1) v = q.h * (1 - u) * (1 - u * 0.4); } if(v > h){ h = v; top = q; } }
  for(const b of BUMPS){ if(b.rock) continue; const dx = x - b.x, dz = z - b.z, u = (dx * dx + dz * dz) / (b.r * b.r); if(u < 1){ const v = Math.min(cap, b.h * (1 - u) * (1 - u * 0.4)); if(v > h){ h = v; top = b; } } }   // (a climbable boulder is solid to a ride)
  for(const t of TRUNKS_DOWN){ const qx = x - t.x, qz = z - t.z, al = qx * t.dx + qz * t.dz; if(al < -t.r || al > t.L) continue; const r = t.r * (1 - 0.45 * Math.max(0, al) / t.L) * 1.15, ac = Math.abs(qx * t.dz - qz * t.dx);
    if(ac >= r) continue; const v = Math.min(cap, 2 * r / 1.15) * Math.sqrt(1 - (ac / r) ** 2); if(v > h){ h = v; top = t; } }
  if(o) o.o = top; return h; }
// Z321 A LEAP: does the ride clear a thing h m tall — already in the air above it (it took off for something at least as tall, or it is flying high over it),
//   or taking off for it now: a bike only in a wheelie, fast, over a low thing (XEOM.air.low); a horse at a gallop over anything up to RIDE_HIT.horse.h, its
//   spring enough both to lift its hooves over it and to carry it the whole span m to the far side (A.flight = its time in the air, for the jump clip)
export function rideLeap(H, h, span){ if(!H || !(h < Infinity)) return false; const A = H.air || (H.air = { y:0, vy:0, landT:0, over:null, leapH:0 });
  if(A.y > 0.001) return h <= (A.leapH || 0) + 0.01 || A.y > h + 0.12;
  const v = Math.abs(CV.speed);
  if(H.bike){ const L = XEOM.air.low; if(h >= L.h || v <= L.v || !(H.drv && H.drv.wheelT > 0) || !bikeHop(H, Math.sqrt(2 * XEOM.air.g * (h + L.over)))) return false; A.leapH = h; return true; }
  const J = RIDE_HIT.horse; if(h >= J.h || v <= J.v) return false;
  A.vy = Math.max(J.vy[0], Math.min(J.vy[1], Math.max(Math.sqrt(2 * J.g * Math.max(0.3, h - J.tuck)), J.g * (span || 0) / (2 * v))));
  A.y = 0.001; A.leapH = h; A.jumpT = 0; A.flight = 2 * A.vy / J.g; A.jumpNew = true; sfx('whoosh'); return true; }
// the horse in the air (each frame from cavalry.js): it falls under RIDE_HIT.horse.g and comes down with a thud and a burst of dust; its height off the ground
export function horseAir(H, dt){ const A = H && H.air; if(!A || !(A.y > 0)) return 0; const J = RIDE_HIT.horse; A.jumpT = (A.jumpT || 0) + dt; A.vy -= J.g * dt; A.y += A.vy * dt;
  if(A.y <= 0){ const imp = -A.vy, p = S.player; A.y = 0; A.vy = 0; A.leapH = 0; if(imp > 2 && p){ sfx('thud', { x:p.pos.x, z:p.pos.z }, Math.min(1, imp / 6)); dust(p.pos.x, p.pos.z, 6); S.shake = Math.min(1.2, S.shake + imp * 0.06); } }
  return A.y; }
// Z321 the ride on its own (called, or standing by): it goes round what it would not ride through — a point q (x, z) of radius R pushed out of the trees,
//   poles, parked vehicles and bigger stones, the street furniture still standing and the wire (no leaps, nothing knocked down)
const _qp = { pos:null }, _still = { x:0, z:0 }, out = (q, x, z, rr) => { const dx = q.x - x, dz = q.z - z, d2 = dx * dx + dz * dz; if(d2 >= rr * rr || d2 < 1e-6) return; const d = Math.sqrt(d2); q.x += dx / d * (rr - d); q.z += dz / d * (rr - d); };
export function rideClear(q, R){
  for(const c of crushables){ if(!c.alive || tall(c) == null) continue; const B = c.kind === 'car' ? carShape(c) : null; if(B){ _qp.pos = q; pushOutShape(_qp, B, R, null); continue; } out(q, c.x, c.z, (c.kind === 'tree' ? trunkR(c) : c.r * 0.9) + R); }   // (Z337 a parked car: its own box · Z404 a tree: its drawn trunk)
  for(const P of CITY_PROPS) if(!P.down) out(q, P.x, P.z, P.r + R);
  for(const w of OUTPOST_WIRE){ if(w.down || !w.f.g || !w.f.g.parent) continue; const qx = q.x - w.x, qz = q.z - w.z; if(Math.abs(qx * w.dx + qz * w.dz) > w.L / 2 + R) continue;
    const nx = -w.dz, nz = w.dx, side = qx * nx + qz * nz, rr = R + RIDE_HIT.wireW / 2; if(Math.abs(side) >= rr) continue; const sg = side >= 0 ? 1 : -1; q.x += nx * sg * (rr - Math.abs(side)); q.z += nz * sg * (rr - Math.abs(side)); }
  _still.x = _still.z = 0; rideFence({ pos:q, vel:_still }, R, Infinity); }
export function rideCollide(p, now){ const H = CV.H, R = p.radius, C = RIDE_HIT, PW = ridePower(H); let hard = 0;
  const hit = v => { if(v > hard) hard = v; }, slow = () => { p.vel.x *= C.slow; p.vel.z *= C.slow; };
  // trees, poles, parked vehicles, the bigger stones
  for(const c of crushables){ if(!c.alive) continue; const rr = (c.kind === 'car' ? 3.2 : c.kind === 'tree' ? Math.max(c.r, trunkR(c)) : c.r) + R + 0.2, dx = p.pos.x - c.x, dz = p.pos.z - c.z; if(Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
    const h = tall(c); if(h == null) continue; const B = c.kind === 'car' ? carShape(c) : null;   // Z337 a parked car is a box its own size, not a circle 0.7 m out from its doors
    if(PW && h <= PW.climbH){ if(Math.hypot(dx, dz) < c.r + R) lowAdd(c, { x:c.x, z:c.z, r:c.r * 1.1, h }); continue; }   // Z404 a stone under the bán tải: over it, its wheels climbing it
    if(PW && c.kind === 'topple'){ const d = Math.hypot(dx, dz) || 1; if(d < c.r + R && -(p.vel.x * dx + p.vel.z * dz) / d > PW.knockV){ crushAt(c); slow(); sfx('crunch', { x:c.x, z:c.z }, 0.7); dust(c.x, c.z, 4); continue; } }   // Z404 a pole / lamp rammed over
    if(B){ const o = B.obb, ex = o.hl + o.hw + R; if(Math.abs(dx) > ex || Math.abs(dz) > ex || rideLeap(H, h, Math.hypot(dx, dz) + R)) continue; const v = pushOutShape(p, B, R); if(v >= 0) hit(v); continue; }
    const r = c.kind === 'tree' ? trunkR(c) : c.r * 0.9, d = Math.hypot(dx, dz); if(d >= r + R || rideLeap(H, h, d + r + R)) continue; hit(solid(p, c.x, c.z, r, R)); }   // Z404 a tree: its drawn trunk
  // the city's street furniture: the light pieces knocked over at speed, the rest solid
  for(const P of CITY_PROPS){ if(P.down) continue; const dx = p.pos.x - P.x, dz = p.pos.z - P.z, rr = P.r + R; if(Math.abs(dx) > rr || Math.abs(dz) > rr || dx * dx + dz * dz >= rr * rr || rideLeap(H, P.h, Math.hypot(dx, dz) + rr)) continue;
    const d = Math.hypot(dx, dz) || 1, closing = -(p.vel.x * dx + p.vel.z * dz) / d;
    if((P.knock || PW && P.h <= PW.climbH + 0.4) && closing > (PW ? PW.knockV : C.knockV)){ knockProp(P, -dx, -dz); slow(); sfx('crunch', { x:P.x, z:P.z }, 0.6); dust(P.x, P.z, 4); continue; }   // (Z404 the bán tải: anything of a man's height, and sooner)
    hit(solid(p, P.x, P.z, P.r, R)); }
  // the coils of wire across the outposts' approaches
  for(let i = OUTPOST_WIRE.length - 1; i >= 0; i--){ const w = OUTPOST_WIRE[i]; if(!w.f.g || !w.f.g.parent){ OUTPOST_WIRE.splice(i, 1); continue; } if(w.down) continue;
    const qx = p.pos.x - w.x, qz = p.pos.z - w.z, along = qx * w.dx + qz * w.dz; if(Math.abs(along) > w.L / 2 + R) continue;
    const nx = -w.dz, nz = w.dx, side = qx * nx + qz * nz, rr = R + C.wireW / 2; if(Math.abs(side) >= rr || rideLeap(H, 1, Math.abs(side) + rr)) continue; const sg = side >= 0 ? 1 : -1, closing = -(p.vel.x * nx + p.vel.z * nz) * sg;
    if(closing >= (PW ? PW.wireV : C.wireV)){ w.down = true; w.m.scale.y *= 0.3; w.m.position.y -= 0.25; slow(); sfx('clang', { x:w.x, z:w.z }, 0.6); dust(w.x, w.z, 5); continue; }   // (rammed flat)
    const pen = rr - Math.abs(side); p.pos.x += nx * sg * pen; p.pos.z += nz * sg * pen; if(closing > 0){ p.vel.x += nx * sg * closing; p.vel.z += nz * sg * closing; hit(closing); } }
  // the compounds' wire fences
  hit(rideFence(p, R, PW ? PW.wireV : C.wireV));
  if(hard > 0 && H && H.bike) rideBump(hard);   // (hard enough, the bike goes down)
  return hard; }
