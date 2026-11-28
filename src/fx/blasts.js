// fx/blasts.js — FIRE 2–4 THE STAGED EFFECTS on the fire / smoke layer (fx/fire-fx.js; numbers in config FIREFX), each the way it looks on film:
//   · heatBlast — a B41's shaped charge: a white-yellow flash for a frame or two, a compact fireball gone to black-brown smoke within a third of a
//     second, a fast low ring of dust along the ground, sparks, a few glowing fragments on their arcs each with its own thin smoke, earth thrown up and
//     falling back, then a column of dark smoke that greys and widens as it climbs and leans on the wind; the crater smokes thinly for ten seconds; embers at night.
//   · heBlast — a grenade, a mortar shell, a bomb: mostly EARTH — a dark column of soil (taller the bigger the charge) and grey-brown dust, a brief
//     flash, grey smoke; no ball of orange fire.
//   · fuelBurst — fuel going up: a rolling orange-yellow fireball with sooty edges that rises and curls into a black mushroom, patches of ground left burning.
//   · burnPatch — ground that burns: flame tongues that lick up and tear off, smoke (black for fuel, grey for grass and wood), embers at night, its own light.
//   · rpgLaunchFX / rocketFlight — the launch's back-blast (a cone of grey-white dust and a brief orange flash behind him, dust kicked off the ground),
//     the booster's flash at the muzzle, then the sustainer lighting a few metres out: a hard white-yellow point and a thin grey-white trail on a slight
//     corkscrew that hangs, opens and drifts for seconds.
//   · flameJet — the flamethrower: burning fuel drawn out along its flight, yellow at the nozzle, orange, red, then black smoke rolling off the far end; it leaves the ground burning.
//   · tracerHit, lobTrail, dirtSpout, dustRing, smokeRoll — the small ones. Every particle is scheduled at the burst and never touched again.
import * as THREE from 'three';
import { FEELFX, FIREFX } from '../../config.js';
import { camera, BIOME, CINE, FXK, MOBILE, NIGHT, S, blastFeel, blastLight, decalAsh, decalCrater, decalScorch, fireLight, fxLight, fxTier, fxp, gunLight, heightAt, muzzleLight, wetAt } from '../hub.js';

const F = FIREFX, R = (a, b) => a + Math.random() * (b - a), RR = a => a[0] + Math.random() * (a[1] - a[0]), TAU = 6.2832, N = fxTier;
const isNight = () => NIGHT.on || S.tod === 'night', glowK = () => isNight() ? 1 : F.light.glowDay;   // (by day a blast barely lights the ground)
// the colour of the EARTH here (a blast throws soil, not the grass's green or the road's paint): [dust, dark soil]
const _e = { n:null, dust:0, soil:0 }, _c = new THREE.Color(), _d = new THREE.Color();
export function earthCol(){ if(_e.n === BIOME.name) return _e; _e.n = BIOME.name; _c.setHex(BIOME.ground); const snow = _c.r > 0.6 && _c.g > 0.6 && _c.b > 0.6;
  if(_c.g > _c.r * 1.04 && _c.g > _c.b) _c.setHex(0xa89474); else if(!snow) _c.lerp(_d.setHex(0x8a7a66), 0.35);   // under grass: brown soil; sand, stone, ash: their own, a little greyed
  _e.dust = _c.getHex(); _e.soil = snow ? _d.setHex(0x9aa4aa).getHex() : _d.copy(_c).multiplyScalar(0.42).getHex(); return _e; }
function mark(x, z, s, k, crater){ decalAsh(x, z, 2 + s * 1.7, 0.5); decalScorch(x, z, 1.3 + s * 1.3, k); if(crater) decalCrater(x, z, 0.5 + s * 0.55, 0.8); }   // a light grey burn round a charred heart, and the pit
function flashAt(x, y, z, s, t){ fxp('flash', x, y, z, 0, 0, 0, 5 * s, t, 0); fxp('glow', x, y, z, 0, 0, 0, 8.5 * s, t * 1.7, 0); }
function sparks(x, y, z, n, sp, life, q, gy){ for(let i = 0; i < n; i++){ const a = Math.random() * TAU, el = R(0.05, 1.25), v = RR(sp) * q, ce = Math.cos(el); fxp('spark', x, y, z, Math.cos(a) * ce * v, Math.sin(el) * v, Math.sin(a) * ce * v, R(0.1, 0.18) * q, RR(life), 0, null, 1, gy); } }
// a ring of dust thrown out along the ground: the blast wave you can see
export function dustRing(x, z, q, n, sp, life, gy, col){ gy = gy ?? heightAt(x, z); col = col ?? earthCol().dust;
  for(let i = 0; i < n; i++){ const a = i / n * TAU + Math.random() * 0.3, c = Math.cos(a), s = Math.sin(a), v = RR(sp) * q; fxp('ring', x + c * 0.5, gy + 0.3, z + s * 0.5, c * v, R(0.2, 0.9), s * v, 2.6 * q * R(0.8, 1.25), RR(life), 0.02, col, 1, gy); } }
// earth thrown up and falling back: a column of soil `up` m/s tall, its clods
export function dirtSpout(x, z, s, n, clods, up, life, gy){ gy = gy ?? heightAt(x, z); const E = earthCol(), q = Math.sqrt(s);
  for(let i = 0; i < n; i++) fxp('dirt', x + R(-0.4, 0.4) * s, gy + 0.3, z + R(-0.4, 0.4) * s, R(-1.7, 1.7) * q, RR(up) * q * R(0.6, 1), R(-1.7, 1.7) * q, 2 * Math.pow(s, 0.8) * R(0.8, 1.25), RR(life) * (0.8 + 0.2 * q), R(0, 0.05), i % 3 ? E.soil : E.dust, 1, gy);
  for(let i = 0; i < clods; i++){ const a = Math.random() * TAU, v = R(2, 7) * q; fxp('clod', x, gy + 0.3, z, Math.cos(a) * v, R(6, 13) * q, Math.sin(a) * v, R(0.1, 0.24), R(1, 1.6), 0, E.soil, 1, gy); } }
// a column of smoke of `kind` rising out of (x, y, z) over born s
export function smokeRoll(kind, x, y, z, s, n, born, rise, life, size, gy, opK){ const q = Math.sqrt(s);
  for(let i = 0; i < n; i++){ const a = Math.random() * TAU, r = Math.random() * 0.5 * s, d = born[0] + Math.pow(i / Math.max(1, n - 1), 1.6) * (born[1] - born[0]);
    fxp(kind, x + Math.cos(a) * r, y + R(0.3, 1.2) * s, z + Math.sin(a) * r, Math.cos(a) * R(0.2, 0.9), RR(rise) * q, Math.sin(a) * R(0.2, 0.9), size * s * R(0.8, 1.3), RR(life), d, null, opK ?? 1, gy); } }
function aftermath(x, z, s, C, gy, emb){ const q = Math.sqrt(s);   // the crater smokes thinly for a while; at night the last embers drift up out of it
  for(let i = 0, n = N(C.wisps.n); i < n; i++) fxp('wisp', x + R(-0.5, 0.5) * s, gy + 0.2, z + R(-0.5, 0.5) * s, R(-0.15, 0.15), R(0.5, 1), R(-0.15, 0.15), 1.5 * q * R(0.8, 1.2), RR(C.wisps.life), RR(C.wisps.born), 0xb9b5ad, 1, gy);
  if(emb && isNight()) for(let i = 0, n = N(emb.n); i < n; i++) fxp('ember', x + R(-1, 1) * s, gy + 0.15, z + R(-1, 1) * s, R(-0.4, 0.4), R(0.6, 1.6), R(-0.4, 0.4), R(0.07, 0.12), R(1.4, 2.6), RR(emb.born), null, 1, gy); }
const lightUp = (x, y, z, L, q) => { fxLight(x, y + 0.6, z, 0xffc070, L[0] * q, L[1] * q, L[2]); muzzleLight.position.set(x, y + 1.2, z); muzzleLight.color.setHex(0xffc070); muzzleLight.intensity = Math.max(muzzleLight.intensity, 3.4 * Math.min(1.5, q)); };

// ---- a B41's HEAT warhead (s = the charge: 1 = the B41) at (x, y, z); y left out / on the ground: a ground burst ----
export function heatBlast(x, y, z, s){ const C = F.heat, gy = heightAt(x, z), q = Math.sqrt(s); y = y == null ? gy + 0.5 : Math.max(y, gy + 0.3); const air = y - gy > 2.5, wet = wetAt(x, z);
  flashAt(x, y + 0.2, z, s, C.flash);
  if(!air && !wet){ dustRing(x, z, q, N(C.ring.n), C.ring.sp, C.ring.life, gy); dirtSpout(x, z, s * 0.8, N(C.dirt.n), N(C.dirt.clods), [5, 9], [1, 1.4], gy); }
  smokeRoll('column', x, y, z, s, N(C.column.n * q), C.column.born, C.column.rise, C.column.life, C.column.size, gy);
  for(let i = 0, n = N(C.ball.n * q); i < n; i++){ const a = Math.random() * TAU, el = Math.random() * 1.3, v = R(2, 6.5) * q, ce = Math.cos(el);   // the fireball: out and up, and already smoke as it stops
    fxp('heat', x + Math.cos(a) * 0.3 * s, y + Math.random() * 0.6 * s, z + Math.sin(a) * 0.3 * s, Math.cos(a) * ce * v, Math.sin(el) * v + 1.5, Math.sin(a) * ce * v, C.ball.size * s * R(0.8, 1.25), RR(C.ball.life), R(0, 0.04), null, 1, gy); }
  sparks(x, y, z, N(C.sparks.n), C.sparks.sp, C.sparks.life, q, gy);
  for(let i = 0, n = N(C.frags.n), K = FXK.frag; i < n; i++){ const a = Math.random() * TAU, v = RR(C.frags.sp) * q, vx = Math.cos(a) * v, vz = Math.sin(a) * v, up = RR(C.frags.up) * q, life = C.frags.life * R(0.8, 1.2);   // glowing fragments on their arcs…
    fxp('frag', x, y, z, vx, up, vz, 0.2, life, 0, null, 1, gy);
    if(!MOBILE) for(let j = 1; j <= C.frags.puffs; j++){ const t = j * life * 0.9 / (C.frags.puffs + 1), e = Math.exp(-K.drag * t), f = (1 - e) / K.drag, py = y + up * f + K.grav / K.drag * (t - f); if(py < gy + 0.1) break;   // …each laying its own thin smoke where it will have been
      fxp('wisp', x + vx * f, py, z + vz * f, vx * e * 0.05, 0.2, vz * e * 0.05, 0.55, R(0.9, 1.5), t, 0x8a8480, 0.9, gy); } }
  lightUp(x, y, z, C.light, q); blastLight(x, z, (70 + s * 25) * glowK(), 0.5);
  if(!air && !wet){ mark(x, z, s, 0.85, true); aftermath(x, z, s, C, gy, C.embers); }
  blastFeel(x, z, s * C.shake); }
// ---- high explosive (a grenade ≈ 0.9, a mortar shell ≈ 1.6, a bomb 2–3.5): earth first ----
export function heBlast(x, y, z, s){ const C = F.he, gy = heightAt(x, z), q = Math.sqrt(s), E = earthCol(); y = y == null ? gy + 0.5 : Math.max(y, gy + 0.3); const air = y - gy > 2.5, wet = wetAt(x, z);
  const FB = FEELFX.blast, on = FEELFX.on, cp = camera.position, hk = on && (cp.x - x) ** 2 + (cp.z - z) ** 2 < FB.nearR * FB.nearR ? FB.nearK : 1;   // FEEL 2 near the lens: less of the dust that hangs
  flashAt(x, y + 0.2, z, s * 0.66, C.flash);
  if(on && !wet) feelBall(x, y, z, s, q, gy);   // FEEL 2 a fireball in layers, then its debris
  if(!air && !wet){ dustRing(x, z, q, N(C.ring.n), C.ring.sp, C.ring.life, gy);
    for(let i = 0, n = N(C.hang.n * q * hk); i < n; i++){ const a = Math.random() * TAU, r = R(0.5, 2) * s, v = R(0.5, 2); fxp('dust', x + Math.cos(a) * r, gy + 0.5, z + Math.sin(a) * r, Math.cos(a) * v, R(0.3, 1), Math.sin(a) * v, 3.2 * s * R(0.8, 1.2), RR(on ? FB.hang : C.hang.life), RR(C.hang.born), E.dust, 1, gy); }   // the dust that hangs when the earth has fallen back
    dirtSpout(x, z, s, N(C.dirt.n * s), N(C.clods * q), C.dirt.up, C.dirt.life, gy); }
  smokeRoll('grey', x, y, z, s, N(C.smoke.n * q), C.smoke.born, [1.2, 2.4], C.smoke.life, 3.4, gy);
  for(let i = 0, n = N(C.core.n * q); i < n; i++){ const a = Math.random() * TAU, v = R(1, 3.5) * q; fxp('heat', x, y + Math.random() * 0.4 * s, z, Math.cos(a) * v, R(1, 3), Math.sin(a) * v, C.core.size * s * R(0.8, 1.2), RR(C.core.life), 0, null, 1, gy); }   // the charge's own fire: a blink
  sparks(x, y, z, N(C.sparks), [10, 22], [0.2, 0.4], q, gy);
  lightUp(x, y, z, C.light, q); blastLight(x, z, (50 + s * 22) * glowK(), 0.35);
  if(!air && !wet){ mark(x, z, s, 0.6, s >= 0.9); aftermath(x, z, s, C, gy, null); }
  blastFeel(x, z, s * C.shake); }
// FEEL 2 a grenade's / a shell's own fire, in layers: rolling puffs that burn out to soot over half a second, flame tongues licking up out of them,
//   then the debris — lumps of earth and hot fragments on their arcs (all on the fire / smoke layer's budget, scheduled once)
function feelBall(x, y, z, s, q, gy){ const B = FEELFX.blast, Fi = B.fire;
  for(let i = 0, n = N(Fi.n * q); i < n; i++){ const a = Math.random() * TAU, v = R(0.8, 2.6) * q; fxp('fuel', x + Math.cos(a) * R(0, 0.5) * s, y + R(0, 0.6) * s, z + Math.sin(a) * R(0, 0.5) * s, Math.cos(a) * v, R(1.2, 3.6) * q, Math.sin(a) * v, Fi.size * s * R(0.75, 1.3), RR(Fi.life), R(0, Fi.born), null, 1, gy); }
  for(let i = 0, n = N(B.lick); i < n; i++) fxp('lick', x + R(-0.5, 0.5) * s, y + 0.1, z + R(-0.5, 0.5) * s, R(-0.6, 0.6), R(2, 4) * q, R(-0.6, 0.6), 0.9 * s * R(0.8, 1.2), R(0.25, 0.45), R(0, 0.06), null, 1, gy);
  for(let i = 0, n = N(B.debris * q); i < n; i++){ const a = Math.random() * TAU, v = R(3, 9) * q; fxp(i % 3 ? 'clod' : 'frag', x, y + 0.2, z, Math.cos(a) * v, R(5, 12) * q, Math.sin(a) * v, i % 3 ? R(0.16, 0.34) : R(0.08, 0.14), R(0.9, 1.6), 0, i % 3 ? earthCol().soil : null, 1, gy); } }
// ---- fuel (a drum, a truck, an aircraft): the rolling fireball and the black mushroom over it; the ground left burning ----
export function fuelBurst(x, y, z, s){ const C = F.fuel, gy = heightAt(x, z), q = Math.sqrt(s); y = y == null ? gy + 1.2 : Math.max(y, gy + 0.4); const air = y - gy > 4;
  flashAt(x, y + 0.3, z, s * 0.8, C.flash);
  if(!air) dustRing(x, z, q, N(10), [6, 10], [0.8, 1.2], gy);
  smokeRoll('black', x, y + 1.5 * s, z, s, N(C.smoke.n * q), C.smoke.born, [2.6, 4.6], C.smoke.life, C.smoke.size, gy);
  for(let i = 0, n = N(C.ball.n * q); i < n; i++){ const a = Math.random() * TAU, el = Math.random() * 1.2, v = R(2, 5.5) * q, ce = Math.cos(el);
    fxp('fuel', x + Math.cos(a) * 0.4 * s, y + Math.random() * s, z + Math.sin(a) * 0.4 * s, Math.cos(a) * ce * v, Math.sin(el) * v + 2.5, Math.sin(a) * ce * v, C.ball.size * s * R(0.8, 1.25), RR(C.ball.life), R(0, 0.06), null, 1, gy); }
  for(let i = 0, n = N(C.stem.n * q); i < n; i++) fxp('fuel', x + R(-0.4, 0.4) * s, y + R(0, 0.8) * s, z + R(-0.4, 0.4) * s, R(-0.8, 0.8), R(4, 7) * q, R(-0.8, 0.8), C.ball.size * 0.8 * s * R(0.8, 1.2), RR(C.ball.life), RR(C.stem.born), null, 1, gy);   // the stem that feeds the cap
  sparks(x, y, z, N(8), [8, 18], [0.3, 0.6], q, gy);
  if(isNight()) for(let i = 0, n = N(C.embers); i < n; i++) fxp('ember', x + R(-1.5, 1.5) * s, y + R(0, 2) * s, z + R(-1.5, 1.5) * s, R(-1, 1), R(1.5, 4), R(-1, 1), R(0.07, 0.13), R(1.6, 3), R(0.2, 2.5), null, 1, gy);
  fxLight(x, y + 1.5 * s, z, 0xff9a40, C.light[0] * q, C.light[1] * q, C.light[2]); blastLight(x, z, (80 + s * 30) * glowK(), 0.9);
  if(!air && !wetAt(x, z)) for(let i = 0, n = Math.round(RR(C.patches) * Math.min(1.6, q)); i < n; i++){ const a = Math.random() * TAU, r = R(0.6, 2.2) * q; burnPatch(x + Math.cos(a) * r, z + Math.sin(a) * r, R(0.8, 1.3), RR(F.patch.life), true, true); }
  blastFeel(x, z, s * C.shake); }
// ---- ground that burns for `life` s over r m: fuel = black smoke (else a grass fire's grey); force = even right beside another patch ----
const PATCH = [];
export function burnPatch(x, z, r, life, fuel, force){ const C = F.patch, now = S.timeNow || 0; if(wetAt(x, z)) return false; let n = 0;
  for(let i = PATCH.length - 1; i >= 0; i--){ const p = PATCH[i]; if(p.until <= now || p.until > now + 60){ PATCH[i] = PATCH[PATCH.length - 1]; PATCH.pop(); continue; } n++; if(!force && (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < C.gap * C.gap) return false; }
  if(n >= (MOBILE ? C.max >> 1 : C.max)) return false; PATCH.push({ x, z, until:now + life }); const gy = heightAt(x, z);
  for(let i = 0, m = N(life * C.lick); i < m; i++){ const t = Math.random() * life, k = t / life; if(Math.random() < k * k * 0.75) continue;   // it burns down: fewer, shorter flames toward the end
    fxp('lick', x + R(-r, r) * 0.7, gy + 0.1, z + R(-r, r) * 0.7, R(-0.2, 0.2), R(1, 2.2), R(-0.2, 0.2), R(0.9, 1.9) * (1 - 0.5 * k), R(0.45, 0.8), t, null, 1, gy); }
  for(let i = 0, m = N(life * C.smoke); i < m; i++) fxp(fuel ? 'black' : 'grey', x + R(-r, r) * 0.5, gy + R(0.8, 1.4), z + R(-r, r) * 0.5, R(-0.2, 0.2), R(1.4, 2.4), R(-0.2, 0.2), R(2.2, 3.2), R(2.2, 3.4), Math.random() * life, null, 0.55, gy);
  if(isNight()) for(let i = 0, m = N(life * C.ember); i < m; i++) fxp('ember', x + R(-r, r) * 0.6, gy + 0.3, z + R(-r, r) * 0.6, R(-0.5, 0.5), R(1, 2.6), R(-0.5, 0.5), R(0.06, 0.1), R(1.2, 2.2), Math.random() * life, null, 1, gy);
  decalScorch(x, z, r * 1.5, 0.7); fxLight(x, gy + 0.6, z, 0xff8a30, C.light[0], C.light[1] + r * 2, life, 9 + Math.random() * 4); { let busy = 0; for(const L of CINE.lights) if(L.busy) busy++; if(busy < 4) fireLight({ x, z, ms:0.35 + r * 0.25 }, life); }   // (the ground-glow pool keeps room for the blasts' flashes)
  return true; }

// ---- the B41 leaves the tube (muzzle x, y, z; a = the bore) ----
export function rpgLaunchFX(x, y, z, a){ const C = F.rpg, fx = Math.sin(a), fz = Math.cos(a), gy = heightAt(x, z), E = earthCol(), bx = x - fx * 1.25, bz = z - fz * 1.25;   // (the tube's rear, behind his shoulder)
  for(let i = 0, n = N(C.back.n); i < n; i++){ const da = a + Math.PI + R(-C.back.cone, C.back.cone), v = RR(C.back.sp); fxp('back', bx, y + R(-0.08, 0.08), bz, Math.sin(da) * v, R(-0.6, 1.4), Math.cos(da) * v, C.back.size * R(0.75, 1.25), RR(C.back.life), R(0, 0.03), 0xdcd7cc, 1, gy); }   // the back-blast: a cone of grey-white gas
  fxp('flash', bx - fx * 0.3, y, bz - fz * 0.3, 0, 0, 0, 1.9, 0.06, 0); for(let i = 0; i < 3; i++) fxp('motor', bx, y, bz, -fx * R(10, 18), R(-1, 1), -fz * R(10, 18), R(0.5, 0.8), R(0.07, 0.11), 0);   // …and its brief orange flash
  for(let i = 0, n = N(C.dust); i < n; i++){ const d = R(2, 5), sd = R(-1, 1); fxp('dust', x - fx * d + fz * sd, gy + 0.3, z - fz * d - fx * sd, -fx * R(1, 3.5) + fz * sd * 1.5, R(0.4, 1.2), -fz * R(1, 3.5) - fx * sd * 1.5, R(1.6, 2.6), R(1.4, 2.4), R(0.04, 0.14), E.dust, 0.9, gy); }   // the ground's dust kicked up behind him
  fxp('flash', x + fx * 0.2, y, z + fz * 0.2, 0, 0, 0, 1.3, 0.05, 0); for(let i = 0; i < 2; i++) fxp('back', x, y, z, fx * R(2, 5), R(0, 0.6), fz * R(2, 5), 1, R(0.5, 0.9), 0, 0xdcd7cc, 0.6, gy);   // the booster charge at the muzzle
  fxLight(bx, y, bz, 0xffb060, 1.6, 9, 0.12); gunLight(x, y + 0.2, z, 0xffc070, 2.6); }
// ---- a rocket in flight (round b at x, y, z this frame): nothing until the sustainer lights, then the flame point and the corkscrew trail ----
export function rocketFlight(b, x, y, z){ const C = F.rpg, sp = Math.hypot(b.vx, b.vz) || 1, ux = b.vx / sp, uz = b.vz / sp, nx = x - ux * 0.7, nz = z - uz * 0.7;
  if(b._tx == null){ b._tx = nx; b._ty = y; b._tz = nz; b._td = 0; b._ig = false; }
  const rk = b.mesh.userData.rk, gs = rk && rk.userData.glow;
  if(b.bk === 'r' && b.bt < C.ign){ b._tx = nx; b._ty = y; b._tz = nz; if(gs) gs.scale.setScalar(0.12); return; }   // still on the booster's shove: no motor, no glow at its tail yet
  if(!b._ig){ b._ig = true; fxp('flash', nx, y, nz, 0, 0, 0, 1.6, 0.05, 0); for(let i = 0; i < 3; i++) fxp('back', nx, y, nz, -ux * R(3, 7) + R(-1, 1), R(-0.5, 0.8), -uz * R(3, 7) + R(-1, 1), 0.9, R(0.5, 0.8), 0, 0xe6e2da, 0.7); }   // the sustainer lights
  fxp('motor', nx, y, nz, -ux * 6, 0, -uz * 6, R(0.42, 0.62), 0.05, 0);
  const dx = nx - b._tx, dy = y - b._ty, dz = nz - b._tz, L = Math.hypot(dx, dy, dz), step = MOBILE ? C.stepMobile : C.step;
  if(L >= step){ const n = Math.min(28, Math.floor(L / step)), gy = heightAt(nx, nz), H = C.helix;
    for(let i = 1; i <= n; i++){ const f = i * step / L, ph = (b._td + i * step) * H[1], cs = Math.cos(ph), sn = Math.sin(ph);
      fxp('trail', b._tx + dx * f + uz * cs * H[0], b._ty + dy * f + sn * H[0], b._tz + dz * f - ux * cs * H[0], uz * cs * H[2] - ux * 0.6, sn * H[2] + 0.1, -ux * cs * H[2] - uz * 0.6, C.trail.size * R(0.85, 1.2), RR(C.trail.life), 0, null, 1, gy); }
    if(L / step > 28){ b._tx = nx; b._ty = y; b._tz = nz; } else { const f = n * step / L; b._tx += dx * f; b._ty += dy * f; b._tz += dz * f; } b._td += n * step; }
  if(gs) gs.scale.setScalar(0.5 + Math.random() * 0.35); }
// a lobbed round (the M79's grenade, a mortar shell) in the air: a body, not a flame — only a breath of grey behind it
export function lobTrail(r, x, y, z){ if((r._lt = (r._lt || 0) + 1) % 3) return; fxp('wisp', x, y, z, 0, 0.1, 0, 0.5, R(0.5, 0.8), 0, 0xbdb9b2, 0.8); }
// a tube's thump (the M79, a mortar): a small flash and grey gas out along the bore
export function lobLaunchFX(x, y, z, vx, vy, vz){ const L = Math.hypot(vx, vy, vz) || 1; fxp('flash', x, y, z, 0, 0, 0, 1, 0.05, 0);
  for(let i = 0; i < N(5); i++){ const v = R(2, 6); fxp('back', x, y, z, vx / L * v + R(-1, 1), vy / L * v + R(-0.5, 1), vz / L * v + R(-1, 1), 1.1, R(0.6, 1), 0, 0xcfcac0, 0.7); } gunLight(x, y, z, 0xffd24a, 2.2); }

// ---- the flamethrower's stream, one trigger tick: from the nozzle (x, y, z) along `ang`, as far as `range` ----
let _patchAt = 0;
export function flameJet(x, y, z, ang, range, now){ const C = F.jet, cx = Math.sin(ang), cz = Math.cos(ang), gy = heightAt(x, z);
  for(let i = 0, n = N(C.n); i < n; i++){ const a = ang + R(-C.spread, C.spread) * Math.random(), v = range * (2.8 + Math.random()); fxp('jet', x, y + R(-0.05, 0.05), z, Math.sin(a) * v, R(0.6, 2.2), Math.cos(a) * v, RR(C.size), RR(C.life), R(0, 0.045), null, 1, gy); }
  fxp('motor', x, y, z, cx * 8, 0, cz * 8, 0.5, 0.06, 0);                                                                // the hard bright root at the nozzle
  if(Math.random() < C.smoke){ const d = range * R(0.6, 0.95), sx = x + cx * d + R(-1, 1), sz = z + cz * d + R(-1, 1); fxp('black', sx, y + R(0.8, 1.8), sz, cx * 2 + R(-0.6, 0.6), R(1.6, 2.8), cz * 2 + R(-0.6, 0.6), R(3, 4.4), R(2.2, 3.4), R(0.25, 0.5), null, 0.7, heightAt(sx, sz)); }   // black smoke rolling off the far end
  if(Math.random() < C.ember){ const d = range * R(0.35, 0.85); fxp('ember', x + cx * d + R(-1, 1), y + R(0, 0.6), z + cz * d + R(-1, 1), R(-1.5, 1.5), R(1.5, 3.5), R(-1.5, 1.5), R(0.06, 0.1), R(0.8, 1.5), 0.2, null, 1, gy); }
  if(now - _patchAt > C.patchEvery || now < _patchAt){ _patchAt = now; const d = range * R(0.5, 0.95); burnPatch(x + cx * d + R(-0.8, 0.8), z + cz * d + R(-0.8, 0.8), R(0.8, 1.3), RR(F.patch.life), true); }   // the fuel that reaches the ground goes on burning
  fxLight(x + cx * range * 0.45, y + 0.5, z + cz * range * 0.45, 0xff9a3a, C.light[0], C.light[1], 0.18, 0, 'jet'); }
// a tracer goes in: a spark or two, a lick of its burning compound for a quarter of a second, a wisp
export function tracerHit(x, y, z){ for(let i = 0; i < 2; i++){ const a = Math.random() * TAU, v = R(3, 8); fxp('spark', x, y, z, Math.cos(a) * v, R(2, 6), Math.sin(a) * v, 0.08, R(0.15, 0.3), 0); }
  fxp('lick', x, y, z, 0, 0.6, 0, 0.38, R(0.2, 0.32), 0); fxp('wisp', x, y + 0.1, z, R(-0.2, 0.2), 0.5, R(-0.2, 0.2), 0.6, R(0.7, 1.1), 0.1, 0x9a968f, 1); }
