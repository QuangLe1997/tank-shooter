// game/ride-impact.js — Z306 THE RIDE MEETS THE STREET (soldier mode only; the tank keeps its own run-over in world/traffic.js): what the xe ôm / ba gác /
//   xích lô — or the horse — runs into. A scooter it rams goes over and skids off on its side; a car it rams stops dead and the ride goes over instead:
//   a spill, no harm done — the driver picks it up and, if you stayed by it, rides up to you and you climb back on. An animal it runs down is killed
//   (a big one brings the ride down too). Slower than a knock it is only a nudge: pushed clear, speed lost. On foot nothing is wrecked by walking into
//   it: cars and scooters are solid, and they wait for you in their lane.
import { RIDE, XEOM } from '../../config.js';
import { CV, S, WILD, bikeCrash, killWild, sfx, trafficContacts, trafficKnock, wildRadius } from '../hub.js';

const _hits = [];
export function rideImpacts(p){ const I = XEOM.impact, H = CV.H, mounted = CV.mounted && !CV.trans;
  for(const c of trafficContacts(p.pos.x, p.pos.z, p.radius, _hits)){ const v = c.v, vn = -(p.vel.x * c.nx + p.vel.z * c.nz);   // how fast we close on it
    p.pos.x += c.nx * c.d; p.pos.z += c.nz * c.d; if(vn > 0){ p.vel.x += c.nx * vn; p.vel.z += c.nz * vn; }   // pushed clear of it
    if(!mounted) continue;   // on foot it is only solid
    CV.hPos.copy(p.pos);
    if(v.st === 'down' || v.st === 'burn' || vn < I.knockV){ if(vn > 0.5) CV.speed *= 0.6; continue; }   // a nudge
    trafficKnock(v, p.vel.x, p.vel.z); S.shake = Math.min(2, S.shake + 0.5 + vn * 0.06);
    if(v.moto){ CV.speed *= I.motoKeep; if(vn > RIDE.crash.v) spill(H, 'moto'); }   // it goes over; we ride on, unless we hit it hard
    else { CV.speed = 0; p.vel.set(0, 0, 0); if(vn > I.flipV) spill(H, 'car'); else sfx('thud'); } }   // a car stops dead, and so do we — over the top if we were going
  if(!mounted || Math.abs(CV.speed) < I.animalV || !WILD.list.length) return;
  for(const a of WILD.list){ if(a.dead) continue; const r = wildRadius(a) + p.radius, dx = a.x - p.pos.x, dz = a.z - p.pos.z; if(dx * dx + dz * dz > r * r) continue;
    const sp = Math.abs(CV.speed), big = a.sp.leg > I.bigLeg; killWild(a, p.vel.x, p.vel.z); sfx('thud', { x:a.x, z:a.z }, 0.9); S.shake = Math.min(2, S.shake + (big ? 0.9 : 0.4));
    CV.speed *= big ? 0.3 : 0.8; if(big && sp > RIDE.crash.v * 0.8) spill(H, 'animal'); } }
// a spill: the ride goes over (a light knock to it, not a crash's)
function spill(H, why){ if(!H || !H.drv){ CV.speed = 0; return; } bikeCrash(H, why, XEOM.wear.spill); }
