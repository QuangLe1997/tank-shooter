// actors/hang.js — HANG 1 WHAT HE WEARS ON HIS BACK HANGS (config HANG): one damped pendulum in the back's own plane, shared by the slung rifle (actors/gun-carry.js) and the worn
//   blade (actors/blade.js). The thing is pressed to his back (it can only turn IN that plane) and hangs from its upper attachment — the sling over the shoulder, the blade's frog:
//   its lower end is pulled by gravity and thrown by the attachment's own acceleration (a footfall, a stop, a turn, a landing), held toward its rest diagonal by the strap (ks) and
//   damped (z) — so it leans to stay hanging when he bends or leans, nudges with each step, swings on after a stop and settles in about half a second. No allocation.
import { HANG } from '../../config.js';

export function hangState(){ return { o:0, v:0, x:0, y:0, z:0, vx:0, vy:0, vz:0, ax:0, ay:0, az:0, ok:false }; }
// → the angle (rad) to add to the thing's rest angle. a0: the rest angle of its UPPER end's direction in the back's plane, from the back's up toward his right · p: its upper
//   attachment (world) · r, u: the back's right and up (world, unit) · len: metres from the attachment to its lower end
export function hangStep(H, dt, a0, p, r, u, len){ const C = HANG; if(!C.on || !(dt > 0)) return C.on ? H.o : 0;
  if(!H.ok || dt > 0.2){ H.x = p.x; H.y = p.y; H.z = p.z; H.vx = H.vy = H.vz = H.ax = H.ay = H.az = 0; H.ok = true; return H.o; }   // (a first frame, a long pause: start from rest where he is now)
  const vx = (p.x - H.x) / dt, vy = (p.y - H.y) / dt, vz = (p.z - H.z) / dt; let ax = (vx - H.vx) / dt, ay = (vy - H.vy) / dt, az = (vz - H.vz) / dt; H.x = p.x; H.y = p.y; H.z = p.z; H.vx = vx; H.vy = vy; H.vz = vz;
  const am = Math.hypot(ax, ay, az); if(am > C.accMax){ const k = C.accMax / am; ax *= k; ay *= k; az *= k; } const lp = Math.min(1, dt * C.lp); H.ax += (ax - H.ax) * lp; H.ay += (ay - H.ay) * lp; H.az += (az - H.az) * lp;
  // on its lower end, a unit of mass: gravity less the attachment's acceleration — what of it lies along the way that end can go (the tangent of its arc in the back's plane)
  const fx = -H.ax * C.k, fy = -C.g - H.ay * C.k, fz = -H.az * C.k, L = Math.max(0.3, len * C.len), n = Math.max(1, Math.ceil(dt / C.step)), h = dt / n, cd = 2 * C.z * Math.sqrt(C.ks);
  for(let i = 0; i < n; i++){ const a = a0 + H.o, s = Math.sin(a), c = Math.cos(a), tq = (fx * (u.x * s - r.x * c) + fy * (u.y * s - r.y * c) + fz * (u.z * s - r.z * c)) / L;
    H.v += (tq - C.ks * H.o - cd * H.v) * h; H.o += H.v * h; if(H.o > C.max){ H.o = C.max; if(H.v > 0) H.v = 0; } else if(H.o < -C.max){ H.o = -C.max; if(H.v < 0) H.v = 0; } }
  return H.o; }
