// game/ride-impact.js — Z306 THE RIDE MEETS THE STREET (soldier mode only; the tank keeps its own run-over in world/traffic.js): what the xe ôm / ba gác /
//   xích lô / bán tải — or the horse — runs into. An animal it runs down is killed (a big one brings the ride down too). On foot nothing is wrecked by
//   walking into it: cars and scooters are solid, and they wait for you in their lane.
// Z320 A RAM IS A COLLISION OF MASSES: the ride (by kind: a xe ôm lighter than a car, a bán tải much heavier) and the car (1) or scooter (moto) meet along the
//   line between them — the blow shoves what it hits out of its lane and turns it by the lever it struck (a car spins out, a scooter goes over and skids on
//   its side; a bán tải's blow rolls a car over), the ride loses only what the masses say and drives on through: you take the road, you do not go over
//   the bars. A scooter lying in the road is kicked aside and ridden over; a slow touch on a car is only solid (only a ride heavier than a car bulldozes one).
import { RIDE, XEOM } from '../../config.js';
import { CV, S, WILD, bikeCrash, killWild, sfx, trafficContacts, trafficShove, trafficPush, trafficVel, wildRadius } from '../hub.js';

const _hits = [];
export function rideImpacts(p){ const I = XEOM.impact, H = CV.H, mounted = CV.mounted && !CV.trans;
  for(const c of trafficContacts(p.pos.x, p.pos.z, p.radius, _hits)){ const v = c.v, ux = -c.nx, uz = -c.nz, [wx, wz] = trafficVel(v), vc = (p.vel.x - wx) * ux + (p.vel.z - wz) * uz;   // u: from us into it · how fast we close on it
    const mr = I.mass[p.bike || 'horse'] || 1, mv = v.moto ? I.moto : 1, kr = (1 / mr) / (1 / mr + 1 / mv), now = performance.now() / 1000;   // (kr: our share of the push apart)
    if(mounted && v.st === 'down'){ if(vc > 1 && !(now < v.kickAt)){ v.kickAt = now + 0.7; const hx = Math.sin(CV.facing), hz = Math.cos(CV.facing), sd = (ux * hz - uz * hx) > 0 ? 1 : -1, k = vc * (1 + I.e) * mr / (mr + mv);   // a scooter lying in the road: one kick aside, and over it we go
        trafficShove(v, (hz * sd * 0.8 + hx * 0.6) * k, (-hx * sd * 0.8 + hz * 0.6) * k, p.pos.x - c.nx * p.radius, p.pos.z - c.nz * p.radius, false); CV.speed *= 0.85; S.shake = Math.min(2, S.shake + 0.3); sfx('crunch', { x:v.x, z:v.z }, 0.5); }
      continue; }
    if(!mounted || (vc < I.knockV * 0.5 && (!v.st || mv > mr))){ p.pos.x += c.nx * c.d; p.pos.z += c.nz * c.d; if(vc > 0){ p.vel.x -= ux * vc; p.vel.z -= uz * vc; if(mounted) CV.speed *= 0.8; } continue; }   // on foot, or a touch: it is solid (only a heavier ride bulldozes a struck car along)
    if(vc > 0){ const j = (1 + I.e) * vc / (1 / mr + 1 / mv), hard = vc > I.knockV;   // the blow: an impulse along the line between us
      trafficShove(v, ux * j / mv, uz * j / mv, p.pos.x - c.nx * p.radius, p.pos.z - c.nz * p.radius, hard);
      p.vel.x -= ux * j / mr; p.vel.z -= uz * j / mr; CV.speed = p.vel.x * Math.sin(CV.facing) + p.vel.z * Math.cos(CV.facing);
      if(hard){ S.shake = Math.min(2, S.shake + 0.35 + vc * 0.05); sfx(v.moto ? 'crunch' : 'clang', { x:v.x, z:v.z }, Math.min(1, 0.4 + vc * 0.05)); } }
    p.pos.x += c.nx * c.d * kr; p.pos.z += c.nz * c.d * kr; trafficPush(v, ux * c.d * (1 - kr), uz * c.d * (1 - kr)); CV.hPos.copy(p.pos); }
  if(!mounted || Math.abs(CV.speed) < I.animalV || !WILD.list.length) return;
  for(const a of WILD.list){ if(a.dead) continue; const r = wildRadius(a) + p.radius, dx = a.x - p.pos.x, dz = a.z - p.pos.z; if(dx * dx + dz * dz > r * r) continue;
    const sp = Math.abs(CV.speed), big = a.sp.leg > I.bigLeg; killWild(a, p.vel.x, p.vel.z); sfx('thud', { x:a.x, z:a.z }, 0.9); S.shake = Math.min(2, S.shake + (big ? 0.9 : 0.4));
    CV.speed *= big ? 0.3 : 0.8; if(big && sp > RIDE.crash.v * 0.8) spill(H, 'animal'); } }
// a spill: the ride goes over (a light knock to it, not a crash's)
function spill(H, why){ if(!H || !H.drv){ CV.speed = 0; return; } bikeCrash(H, why, XEOM.wear.spill); }
