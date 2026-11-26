// fx/soldier-fx.js — Z306 A MAN IS HIT, NOT A HULL: blood off the side the round came from, a flinch of the view and the red marker pointing back at the shooter —
//   no sparks, no armour shards, no plate-sized flash, no hull rocking. HIT 1 and never fire on him: a round → a mist of blood at the height it struck him, drops
//   thrown along the shot, stains round his feet, darker the less health he has; a blast → the same, less; fire → the screen's edge goes hot and his clothes
//   smoulder (a few sparks, under a second, once) — he does not burn; a fall → nothing to see. On the horse a share of the rounds strike the horse (it bleeds),
//   on the motorbike a share strike the bike (a spark off its steel). The red edge flashes on a hit and stands, darker, while his health is low (BODYHIT).
import { BODYHIT } from '../../config.js';
import { CV, S, bodyLowSound, decalBlood, gradePass, heightAt, hitMarker, sfx, spawnPart } from '../hub.js';

// what was shown (dev / probes read it)
export const BHFX = { n:{ blood:0, drops:0, stains:0, horse:0, bike:0, heat:0, sparks:0 }, vig:0, vigW:-1, heat:0, heatW:-1, inFireAt:-9, smoulderTo:-9, feetAt:-9 };
const R = () => Math.random() - 0.5, _hp = { x:0, z:0 };
function mixHex(a, b, k){ const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * k, g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * k, l = (a & 255) + ((b & 255) - (a & 255)) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(l); }
// blood out of a body at (x, z) at height y, the round travelling (ux, uz): a mist at the entry, drops out of the far side along the shot; k = how hard
function bleed(x, z, y, ux, uz, k, col){ const B = BODYHIT.blood, n = Math.round(B.drops * k);
  for(let i = 0; i < B.mist; i++) spawnPart(x - ux * 0.12 + R() * 0.16, y + R() * 0.15, z - uz * 0.12 + R() * 0.16, -ux * 0.6 + R() * 0.8, 0.3 + Math.random() * 0.5, -uz * 0.6 + R() * 0.8,
    { color:col, size:0.18 + Math.random() * 0.16 * k, life:0.22 + Math.random() * 0.14, grav:-2.5, drag:4, op:0.55 });                                        // the puff where it went in
  for(let i = 0; i < n; i++){ const sp = 1.6 + Math.random() * 3.2 * k; spawnPart(x + ux * 0.15, y, z + uz * 0.15, ux * sp + R() * 1.6, 0.6 + Math.random() * 2, uz * sp + R() * 1.6,
    { color:Math.random() < 0.55 ? col : mixHex(col, 0x000000, 0.35), size:0.07 + Math.random() * 0.08 * k, life:0.4 + Math.random() * 0.25, grav:-16, drag:0.8 }); }   // drops, out along the shot, onto the ground
  BHFX.n.blood++; BHFX.n.drops += n; }

// ---- a hit on HIM (game/player-damage.js): kind 'shot' | 'blast' | 'fire' | 'fall'; dx, dz = the way it travelled; hy = how high over his feet it struck (or undefined) ----
export function soldierHitFX(p, dx, dz, dmg, kind, hy, now){ const L = Math.hypot(dx || 0, dz || 0), B = BODYHIT.blood; kind = kind || 'shot'; now = now || performance.now() / 1000;
  if(kind === 'fire'){ bodyHeat(now); return; }
  if(L && kind !== 'fall') hitMarker(-dx / L, -dz / L, dmg);
  BHFX.vig = Math.max(BHFX.vig, BODYHIT.vig.hit * Math.min(1, 0.55 + dmg * 0.03));
  if(kind === 'fall') return;
  const ux = L ? dx / L : Math.sin(p.facing || 0), uz = L ? dz / L : Math.cos(p.facing || 0), f = Math.max(0, Math.min(1, p.hp / (p.maxHp || 1))), col = mixHex(B.dark[0], B.dark[1], 1 - f);
  const k = (kind === 'blast' ? 0.6 : 0.75) + Math.min(1.1, dmg * 0.025), gy = heightAt(p.pos.x, p.pos.z) + (p.lift || 0), mounted = CV.H && CV.mounted, lift = mounted ? (CV.H.bike ? 0.55 : 1.05) : 0;
  const y = gy + lift + (hy != null && isFinite(hy) ? Math.max(0.3, Math.min(1.75, hy - lift)) : B.y[0] + Math.random() * (B.y[1] - B.y[0]));
  if(mounted && !CV.H.bike && Math.random() < BODYHIT.horse.share){ const s = Math.random() < 0.5 ? -1 : 1;                                  // the round struck the horse: its flank bleeds
    bleed(p.pos.x - uz * 0.35 * s, p.pos.z + ux * 0.35 * s, gy + 1.15 + R() * 0.25, ux, uz, k * 0.9, B.dark[0]); decalBlood(p.pos.x + ux * 0.8 + R(), p.pos.z + uz * 0.8 + R(), 0.3); BHFX.n.horse++; }
  else if(mounted && CV.H.bike && Math.random() < BODYHIT.bike.share){ _hp.x = p.pos.x - ux * 0.3; _hp.z = p.pos.z - uz * 0.3; sfx('hit', _hp, 0.5); BHFX.n.bike++;   // …or the motorbike: a tick of steel, a spark
    for(let i = 0; i < 3; i++) spawnPart(_hp.x, gy + 0.45, _hp.z, -ux * 2 + R() * 3, 1 + Math.random() * 2, -uz * 2 + R() * 3, { color:0xffe0a0, size:0.08, life:0.18, grav:-14, drag:1.5 }); }
  bleed(p.pos.x, p.pos.z, y, ux, uz, k, col);
  if(now - BHFX.feetAt >= B.feetGap){ BHFX.feetAt = now; const n = 1 + (Math.random() < 0.5 ? 1 : 0) + (f < 0.4 ? 1 : 0), r = B.pool[0] + (B.pool[1] - B.pool[0]) * (1 - f);   // stains round his feet
    for(let i = 0; i < Math.min(B.feet + 1, n); i++){ const a = Math.random() * 6.283, d = 0.2 + Math.random() * B.feetR; decalBlood(p.pos.x + Math.cos(a) * d + ux * 0.3, p.pos.z + Math.sin(a) * d + uz * 0.3, r * (0.7 + Math.random() * 0.5)); BHFX.n.stains++; } }
  if(gradePass && gradePass.uniforms.flash) gradePass.uniforms.flash.value = Math.min(0.1, gradePass.uniforms.flash.value + 0.012 + dmg * 0.0012); }

// fire on him: the screen's edge hot; the first moment in it, a few sparks smoulder on his clothes (under a second) — never a torch
export function bodyHeat(now){ const H = BODYHIT.heat; if(now - BHFX.inFireAt > H.reK) BHFX.smoulderTo = now + H.spark; BHFX.inFireAt = now; BHFX.heat = Math.max(BHFX.heat, H.op); BHFX.n.heat++; }

// the overlay for the heat, made on first use (the red one is index.html's #vignette)
function heatEl(){ let el = document.getElementById('bodyHeat'); if(el) return el; el = document.createElement('div'); el.id = 'bodyHeat';
  el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:11;opacity:0;background:radial-gradient(ellipse at 50% 55%,transparent 38%,rgba(255,138,40,.35) 78%,rgba(255,90,20,.6) 100%);';
  document.body.appendChild(el); return el; }
let _sparkT = 0;
// ---- every frame (fx/cinematic.js updateCinematic, in a fight): the red edge, the heat fading, the smoulder, his heart and breath low on health ----
export function updateBodyHit(dt, now){ const p = S.player; if(!p || S.mode !== 'playing') return; const V = BODYHIT.vig, f = Math.max(0, Math.min(1, p.hp / (p.maxHp || 1)));
  const base = f < V.low ? V.top * (1 - f / V.low) * (0.85 + 0.15 * Math.sin(now * 7.5)) : 0; BHFX.vig = Math.max(base, BHFX.vig - dt * V.fade);
  const v = document.getElementById('vignette'); if(v && Math.abs(BHFX.vig - BHFX.vigW) > 0.015){ BHFX.vigW = BHFX.vig; v.style.opacity = BHFX.vig.toFixed(3); }
  if(BHFX.heat > 0 || BHFX.heatW > 0){ BHFX.heat = Math.max(0, BHFX.heat - dt * BODYHIT.heat.fade); if(Math.abs(BHFX.heat - BHFX.heatW) > 0.015 || BHFX.heat === 0){ BHFX.heatW = BHFX.heat; heatEl().style.opacity = BHFX.heat.toFixed(3); } }
  if(now < BHFX.smoulderTo && (_sparkT -= dt) <= 0){ _sparkT = 0.1; const gy = heightAt(p.pos.x, p.pos.z) + (p.lift || 0) + (CV.H && CV.mounted ? 0.9 : 0);   // a few sparks off his clothes, rising, gone
    for(let i = 0; i < BODYHIT.heat.n; i++){ spawnPart(p.pos.x + R() * 0.45, gy + 0.2 + Math.random() * 1.1, p.pos.z + R() * 0.45, R() * 0.6, 0.8 + Math.random() * 0.9, R() * 0.6, { color:Math.random() < 0.5 ? 0xffb050 : 0xff7a24, size:0.05 + Math.random() * 0.04, life:0.3 + Math.random() * 0.2, grav:1.2, drag:1.5 }); BHFX.n.sparks++; } }
  bodyLowSound(f, now); }
