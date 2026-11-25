// game/ride-avoid.js — RIDE 1 THE MOUNT PICKS ITS OWN LINE (the war horse and the xe ôm alike; game/cavalry.js asks once a frame). The rider says WHERE
// (the direction pushed); the animal — or the driver — says HOW: a few feelers fanned round its heading look ahead, farther the faster it goes, for what
// would stop it (walls, buildings, cover, crags, trees, poles, parked cars, the bigger stones, street furniture, wire, a big animal, the field's edge) and
// what it would rather not take (deep water, a drop, a bank too steep). The way pushed is clear: nothing changes. It is not: it takes the open feeler
// nearest the way pushed (and keeps to that side, so it does not dither in front of a stone), eases off for what is coming and in a narrow gap, looks
// over both shoulders when the fan is shut, and stands only when every way is. A charge (Space) rides at what it can leap or flatten, as before.
// Cheap: one look every RIDEFEEL.avoid.every s — the things within reach gathered once into flat arrays, each feeler a ray against those few; nothing allocated.
import { RIDEFEEL, RIDE_HIT, RIVERS, XEOM } from '../../config.js';
import { CITY_PROPS, OUTPOST_WIRE, RIVER, SUPPLY, WILD, blocks, carShape, core, crushables, fieldDepth, heightAt, rideBlockH, rideDrawnH, rideHull, ridePower, rideTall, rockAt, rockNear, solidShape, trunkR, wildRadius } from '../hub.js';

const NC = 96, NB = 72, NF = 7, CIR = new Float32Array(NC * 3), BOX = new Float32Array(NB * 6), OFF = new Float32Array(NF), LEN = new Float32Array(NF), FREE = new Float32Array(NF), EFF = new Float32Array(NF);
const NBR = [[1, 2], [0, 3], [0, 4], [1, 5], [2, 6], [3, -1], [4, -1]];   // each feeler's neighbours either side (the fan is [0, +a, −a, +b, −b], then the shoulders)
let nc = 0, nb = 0, gx = 0, gz = 0, gr = 0, rocky = false;
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// what it decided at its last look: act — it is steering its own line, toward heading head (rad, world) with gain (× the turn) · vcap — no faster than this
//   (m/s; Infinity: as it likes) · shut — every way is · tight — in a narrow gap · side — the side it took round the thing · looks / halts: counted for the probes
export const AVOID = { t:0, act:false, head:0, gain:2, vcap:Infinity, shut:false, tight:false, side:0, clearT:0, n:0, looks:0, halts:0, near:0 };
export function rideAvoidReset(){ const O = AVOID; O.t = 0; O.act = O.shut = O.tight = false; O.vcap = Infinity; O.side = 0; O.clearT = 0; return O; }

function addC(x, z, r){ const dx = x - gx, dz = z - gz, e = gr + r; if(nc >= NC || dx * dx + dz * dz > e * e) return; const i = nc++ * 3; CIR[i] = x; CIR[i + 1] = z; CIR[i + 2] = r; }
function addB(x, z, s, c, hl, hw){ const e = gr + hl + hw; if(nb >= NB || Math.abs(x - gx) > e || Math.abs(z - gz) > e) return; const i = nb++ * 6; BOX[i] = x; BOX[i + 1] = z; BOX[i + 2] = s; BOX[i + 3] = c; BOX[i + 4] = hl; BOX[i + 5] = hw; }
// everything solid to this ride within reach of (x, z), as circles and boxes — the same things, the same sizes game/cavalry.js collide and rideCollide hold it with
function gather(x, z, reach, H, v, charge){ nc = nb = 0; gx = x; gz = z; gr = reach; const PW = ridePower(H), C = RIDE_HIT, LW = XEOM.air.low;
  const leapH = !charge ? 0 : H.bike ? (H.drv && H.drv.wheelT > 0 && v > LW.v ? LW.h : 0) : (v > C.horse.v ? C.horse.h : 0);   // charging, what it will leap is not in its way
  for(const b of blocks){ if(b.kind === 'parked') continue; const SH = solidShape(b, true), o = SH && SH.obb, bx = SH ? SH.x : b.x, bz = SH ? SH.z : b.z, e = reach + (o ? o.hl + o.hw : (b.r || 1));
    if(Math.abs(bx - x) > e || Math.abs(bz - z) > e || leapH && rideBlockH(b) < leapH || PW && !PW.never.includes(b.kind) && rideDrawnH(b) <= PW.climbH) continue;
    if(o) addB(bx, bz, Math.sin(o.f), Math.cos(o.f), o.hl, o.hw); else addC(bx, bz, b.r || 1); }
  for(const c of crushables){ if(!c.alive || Math.abs(c.x - x) > reach + 3.4 || Math.abs(c.z - z) > reach + 3.4) continue; const h = rideTall(c);
    if(h == null || leapH && h < leapH || PW && (h <= PW.climbH || c.kind === 'topple')) continue; const B = c.kind === 'car' ? carShape(c) : null;
    if(B) addB(B.x, B.z, Math.sin(B.obb.f), Math.cos(B.obb.f), B.obb.hl, B.obb.hw); else addC(c.x, c.z, c.kind === 'tree' ? trunkR(c) : c.r * 0.9); }
  for(const P of CITY_PROPS){ if(P.down || leapH && P.h < leapH || PW && (P.knock || P.h <= PW.climbH + 0.4)) continue; addC(P.x, P.z, P.r); }
  if(v < (PW ? PW.wireV : C.wireV) && leapH <= 1){   // (fast enough it flattens the wire: it rides at it)
    for(const w of OUTPOST_WIRE){ if(w.down || !w.f.g || !w.f.g.parent) continue; addB(w.x, w.z, w.dx, w.dz, w.L / 2, C.wireW / 2); }
    for(const B of SUPPLY.bases){ const F = B.fence, q = B.R * 1.6 + reach; if(!F || (x - B.x) ** 2 + (z - B.z) ** 2 > q * q) continue;
      for(const sp of F.spans) if(!sp.down) addB(sp.x0 + sp.dx * sp.Lw / 2, sp.z0 + sp.dz * sp.Lw / 2, sp.dx, sp.dz, sp.Lw / 2, 0.06); } }
  if(core) addC(core.pos.x, core.pos.z, core.r || 3);
  for(const a of WILD.list) if(!a.dead && a.sp.leg > XEOM.impact.bigLeg) addC(a.x, a.z, wildRadius(a));   // (a buffalo in the road brings a bike down)
  rocky = rockNear(x, z, reach); }
// how far a body of half-width rr gets from (x, z) along (ux, uz) before it meets one of them, L at most. Already inside a thing's margin (squeezing
//   past, or just pushed back out of it) it is shut only heading into it — along it or away it is free to go
function cast(x, z, ux, uz, L, rr){ let t = L;
  for(let i = 0, n = nc * 3; i < n; i += 3){ const mx = CIR[i] - x, mz = CIR[i + 1] - z, R = CIR[i + 2] + rr, b = mx * ux + mz * uz, m2 = mx * mx + mz * mz, c2 = m2 - R * R;
    if(c2 <= 0){ if(b > 0.25 * Math.sqrt(m2)) return 0; continue; } if(b <= 0) continue; const q = b * b - c2; if(q <= 0) continue; const h = b - Math.sqrt(q); if(h < t) t = h; }
  for(let i = 0, n = nb * 6; i < n; i += 6){ const dx = x - BOX[i], dz = z - BOX[i + 1], s = BOX[i + 2], c = BOX[i + 3], hl = BOX[i + 4] + rr, hw = BOX[i + 5] + rr;
    const al = dx * s + dz * c, ac = dx * c - dz * s, ua = ux * s + uz * c, uc = ux * c - uz * s, aa = Math.abs(al), ab = Math.abs(ac);   // along · across (world/solid-shape.js pushOutShape)
    if(aa < hl && ab < hw){ if((hl - aa < hw - ab ? -Math.sign(al) * ua : -Math.sign(ac) * uc) > 0.25) return 0; continue; }
    let t0 = 0, t1 = t;
    if(Math.abs(ua) < 1e-6){ if(aa >= hl) continue; } else { let a = (-hl - al) / ua, b = (hl - al) / ua; if(a > b){ const k = a; a = b; b = k; } if(a > t0) t0 = a; if(b < t1) t1 = b; if(t0 > t1) continue; }
    if(Math.abs(uc) < 1e-6){ if(ab >= hw) continue; } else { let a = (-hw - ac) / uc, b = (hw - ac) / uc; if(a > b){ const k = a; a = b; b = k; } if(a > t0) t0 = a; if(b < t1) t1 = b; if(t0 > t1) continue; }
    if(t0 < t) t = t0; }
  return t; }
const deep = h => RIVER.on && RIVER.y + 0.15 - h >= RIVERS.wade.fordD;   // (world/heightfield.js wadeAt: the deep channel)
// feeler i from (x, z) at heading a: FREE — to the first solid thing (a crag's drawn rock and the field's edge with them) · EFF — what it will make of
//   that way: cut back where the ground turns bad (a bank steeper than slope, a drop over drop, deep water it is not already in) — a way it takes last
function feel(i, x, z, a, rr, R, h0, wet0){ const A = RIDEFEEL.avoid, ux = Math.sin(a), uz = Math.cos(a), L = LEN[i]; let hard = cast(x, z, ux, uz, L, rr), soft = hard;
  if(rocky) for(let t = 1; t < hard; t += 0.9) if(rockAt(x + ux * t, z + uz * t, R + (rr - R) * 0.5)){ hard = Math.max(0, t - 0.6); break; }
  const st = L / 3; let hp = h0; if(soft > hard) soft = hard;
  for(let k = 1; k <= 3; k++){ const t = st * k; if(t - st >= hard) break; const px = x + ux * t, pz = z + uz * t;
    if(fieldDepth(px, pz) < A.edge){ hard = Math.min(hard, t - st * 0.5); if(soft > hard) soft = hard; break; }
    const h = heightAt(px, pz), sl = (h - hp) / st; hp = h; if(sl > A.slope || sl < -A.drop || !wet0 && deep(h)){ soft = Math.min(soft, t - st); break; } }
  FREE[i] = hard; EFF[i] = soft + (hard - soft) * A.softPass; }
const open = i => EFF[i] >= LEN[i] - 0.01;   // nothing solid, nothing bad, the whole look ahead
function pick(n, d, dRaw){ const A = RIDEFEEL.avoid, O = AVOID; let best = -1, bs = -1e9;
  for(let i = 0; i < n; i++){ if(EFF[i] < A.halt || Math.abs(wrapA(OFF[i] - dRaw)) > A.maxDev) continue;   // (never a way that turns its back on where it was told to go)
    const s = EFF[i] / LEN[i] - A.devW * Math.abs(OFF[i] - d) + (O.side && (OFF[i] - d) * O.side > 0.01 ? A.stick : 0); if(s > bs){ bs = s; best = i; } }
  return best; }
// the ride H carrying p (pos, radius), heading `facing`, told to go toward heading tgt, at v m/s (charge: Space's gallop / wheelie) → AVOID
export function rideAvoid(H, p, dt, facing, tgt, v, charge){ const A = RIDEFEEL.avoid, O = AVOID; if(!A.on) return rideAvoidReset();
  if((O.t -= dt) > 0) return O; O.t = A.every; O.looks++;
  const bike = !!H.bike, hull = rideHull(H), kind = bike ? 'bike' : 'horse'; let R = p.radius; if(hull){ R = 0; for(const q of hull) R = Math.max(R, Math.abs(q[0]) + q[2]); }
  const rr = R + A.margin[kind], x = p.pos.x, z = p.pos.z, av = Math.abs(v), L = Math.min(A.look[2], A.look[0] + A.look[1] * av), n0 = A.fan.length, fanMax = A.fan[n0 - 2];
  gather(x, z, L + rr + 0.5, H, av, charge); O.near = nc + nb;
  const dRaw = wrapA(tgt - facing), d = clamp(dRaw, -fanMax, fanMax), h0 = heightAt(x, z), wet0 = deep(h0); let direct = 0, dd = 9;
  for(let i = 0; i < n0; i++){ OFF[i] = A.fan[i]; LEN[i] = L * A.lenK[i]; feel(i, x, z, facing + OFF[i], rr, R, h0, wet0); const q = Math.abs(OFF[i] - d); if(q < dd){ dd = q; direct = i; } }
  O.n = n0; let best = direct;
  if(open(direct)){ O.act = false; O.shut = false; O.vcap = Infinity; if((O.clearT += A.every) > A.forget) O.side = 0; }   // the way pushed is clear: the rider's hand alone
  else { O.clearT = 0; best = pick(n0, d, dRaw);
    if(best < 0 || !open(best)){ for(let s = 0; s < 2; s++){ const i = n0 + s; OFF[i] = s ? -A.shoulder : A.shoulder; LEN[i] = L * A.lenK[n0 - 1]; feel(i, x, z, facing + OFF[i], rr, R, h0, wet0); } O.n = n0 + 2; best = pick(O.n, d, dRaw); }   // the fan is shut: a look over each shoulder
    if(best < 0){ if(!O.shut) O.halts++; O.act = false; O.shut = true; O.vcap = 0; O.tight = false; O.side = 0; return O; }   // every way shut: it stands (the rider turns it)
    O.shut = false; O.act = true; O.head = facing + OFF[best]; O.gain = A.gain[0] + (A.gain[1] - A.gain[0]) * clamp(1 - EFF[direct] / LEN[direct], 0, 1);   // the nearer the thing, the harder it swerves
    if(Math.abs(OFF[best] - d) > 0.01) O.side = Math.sign(OFF[best] - d);
    let vc = open(best) ? Infinity : Math.sqrt(2 * A.brake * Math.max(0, EFF[best] - A.halt));   // down the way it took: no faster than it can still pull up in
    if(best !== 0 && FREE[0] < LEN[0]) vc = Math.min(vc, Math.sqrt(2 * A.brake * FREE[0]) * A.swerve + A.swerveV);   // and round what is dead ahead: eased off, not stopped
    O.vcap = Math.max(vc, A.creep); }
  const N = NBR[best], a = N[0], b = N[1]; O.tight = a >= 0 && b >= 0 && a < O.n && b < O.n && FREE[a] < A.gapD && FREE[b] < A.gapD;   // shut close on both sides: a gap, taken gently
  if(O.tight) O.vcap = Math.min(O.vcap, A.gapV[kind]);
  return O; }
