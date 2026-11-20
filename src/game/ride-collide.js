// game/ride-collide.js — Z311 WHAT A RIDE RUNS INTO: the xe ôm (or the horse) is held by everything a tank simply rolls over — trees, poles and
// street lamps, parked cars and scooters, the bigger stones, the city's street furniture and every coil and bay of wire. Head-on it stops dead (it
// is pushed back out and its speed goes with it); a glancing blow slides it along; hard enough, a bike goes down. The light pieces (bins, chairs,
// café tables, barriers, stalls) go over when it hits them fast enough, and a wire bay or coil is flattened by a hard charge — then it goes on, slowed.
// Only in the air above a thing does it pass it (a wheelie's leap over a low one; game/xeom.js).
import { RIDE_HIT, XEOM } from '../../config.js';
import { CITY_PROPS, CV, OUTPOST_WIRE, S, bikeHop, burst, crushables, heightAt, knockProp, rideBump, rideFence, sfx } from '../hub.js';

// push the ride (pos, vel, radius R) back out of a circle; the closing speed it hit at (0 if it was moving away, -1 if clear of it)
function solid(p, x, z, r, R){ const dx = p.pos.x - x, dz = p.pos.z - z, rr = r + R, d2 = dx * dx + dz * dz; if(d2 >= rr * rr || d2 < 1e-6) return -1;
  const d = Math.sqrt(d2), nx = dx / d, nz = dz / d; p.pos.x += nx * (rr - d); p.pos.z += nz * (rr - d); const vn = p.vel.x * nx + p.vel.z * nz;
  if(vn < 0){ p.vel.x -= nx * vn; p.vel.z -= nz * vn; return -vn; } return 0; }
const dust = (x, z, n) => burst({ x, z }, 0xb8a888, n, 2.2, { y:heightAt(x, z) + 0.3, life:0.7, size:0.9, smoke:true, grav:-0.2, drag:2, op:0.4 });
// how tall each kind of thing a tank rolls over stands to a ride (m) — Infinity: never cleared; null: not in its way at all (grass, shrubs, pebbles)
const tall = c => c.kind === 'tree' || c.kind === 'topple' ? Infinity : c.kind === 'car' ? 1.5 : c.kind === 'moto' ? 1.1 : c.kind === 'rock' && c.r >= RIDE_HIT.rock ? c.r * 1.1 : null;
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
const _still = { x:0, z:0 }, out = (q, x, z, rr) => { const dx = q.x - x, dz = q.z - z, d2 = dx * dx + dz * dz; if(d2 >= rr * rr || d2 < 1e-6) return; const d = Math.sqrt(d2); q.x += dx / d * (rr - d); q.z += dz / d * (rr - d); };
export function rideClear(q, R){
  for(const c of crushables) if(c.alive && tall(c) != null) out(q, c.x, c.z, c.r * (c.kind === 'tree' ? 0.75 : 0.9) + R);
  for(const P of CITY_PROPS) if(!P.down) out(q, P.x, P.z, P.r + R);
  for(const w of OUTPOST_WIRE){ if(w.down || !w.f.g || !w.f.g.parent) continue; const qx = q.x - w.x, qz = q.z - w.z; if(Math.abs(qx * w.dx + qz * w.dz) > w.L / 2 + R) continue;
    const nx = -w.dz, nz = w.dx, side = qx * nx + qz * nz, rr = R + RIDE_HIT.wireW / 2; if(Math.abs(side) >= rr) continue; const sg = side >= 0 ? 1 : -1; q.x += nx * sg * (rr - Math.abs(side)); q.z += nz * sg * (rr - Math.abs(side)); }
  _still.x = _still.z = 0; rideFence({ pos:q, vel:_still }, R, Infinity); }
export function rideCollide(p, now){ const H = CV.H, R = p.radius, C = RIDE_HIT; let hard = 0;
  const hit = v => { if(v > hard) hard = v; }, slow = () => { p.vel.x *= C.slow; p.vel.z *= C.slow; };
  // trees, poles, parked vehicles, the bigger stones
  for(const c of crushables){ if(!c.alive) continue; const rr = c.r + R + 0.2, dx = p.pos.x - c.x, dz = p.pos.z - c.z; if(Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
    const h = tall(c); if(h == null) continue; const r = c.r * (c.kind === 'tree' ? 0.75 : 0.9), d = Math.hypot(dx, dz); if(d >= r + R || rideLeap(H, h, d + r + R)) continue; hit(solid(p, c.x, c.z, r, R)); }
  // the city's street furniture: the light pieces knocked over at speed, the rest solid
  for(const P of CITY_PROPS){ if(P.down) continue; const dx = p.pos.x - P.x, dz = p.pos.z - P.z, rr = P.r + R; if(Math.abs(dx) > rr || Math.abs(dz) > rr || dx * dx + dz * dz >= rr * rr || rideLeap(H, P.h, Math.hypot(dx, dz) + rr)) continue;
    const d = Math.hypot(dx, dz) || 1, closing = -(p.vel.x * dx + p.vel.z * dz) / d;
    if(P.knock && closing > C.knockV){ knockProp(P, -dx, -dz); slow(); sfx('crunch', { x:P.x, z:P.z }, 0.6); dust(P.x, P.z, 4); continue; }
    hit(solid(p, P.x, P.z, P.r, R)); }
  // the coils of wire across the outposts' approaches
  for(let i = OUTPOST_WIRE.length - 1; i >= 0; i--){ const w = OUTPOST_WIRE[i]; if(!w.f.g || !w.f.g.parent){ OUTPOST_WIRE.splice(i, 1); continue; } if(w.down) continue;
    const qx = p.pos.x - w.x, qz = p.pos.z - w.z, along = qx * w.dx + qz * w.dz; if(Math.abs(along) > w.L / 2 + R) continue;
    const nx = -w.dz, nz = w.dx, side = qx * nx + qz * nz, rr = R + C.wireW / 2; if(Math.abs(side) >= rr || rideLeap(H, 1, Math.abs(side) + rr)) continue; const sg = side >= 0 ? 1 : -1, closing = -(p.vel.x * nx + p.vel.z * nz) * sg;
    if(closing >= C.wireV){ w.down = true; w.m.scale.y *= 0.3; w.m.position.y -= 0.25; slow(); sfx('clang', { x:w.x, z:w.z }, 0.6); dust(w.x, w.z, 5); continue; }   // (rammed flat)
    const pen = rr - Math.abs(side); p.pos.x += nx * sg * pen; p.pos.z += nz * sg * pen; if(closing > 0){ p.vel.x += nx * sg * closing; p.vel.z += nz * sg * closing; hit(closing); } }
  // the compounds' wire fences
  hit(rideFence(p, R, C.wireV));
  if(hard > 0 && H && H.bike) rideBump(hard);   // (hard enough, the bike goes down)
  return hard; }
