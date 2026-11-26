// game/stealth.js — Z377 A MAN FLAT ON THE GROUND IS HARD TO SEE (soldier mode, on foot): every enemy gun used to take the player as its target by distance
//   alone, so a soldier lying in the dirt was hosed by a tower MG 25 m off exactly as if he stood. Now each gun asks playerSeen() first. Standing, kneeling,
//   rolling or on the ride he is always seen; lying flat — still or crawling — only by a man close enough to make him out (a short distance measured from the
//   shooter's eyes, so a guard on a tower or a wall top, 6–11 m up, sees him only near its foot; shorter at night), or once he has been spotted: picked out
//   close by, caught in a searchlight's pool, or given away by his own muzzle flash — then every enemy within STEALTH.alertR knows where he lies for a while.
//   The combat roll is also a dodge: a round that would hit him while he goes over usually misses (dodgeShot; running fast dodges a few).
import { EQUIP, STEALTH, TENT } from '../../config.js';
import { CV, NIGHT, S, awareNoise, floatText, heightAt, lineClear, quietShot, tentHides } from '../hub.js';

const now_ = () => performance.now() / 1000;
let _sayAt = -9, _dodgeAt = -9;
function say(txt, col, size){ const p = S.player; if(!p) return; floatText(txt, col, { x:p.pos.x, y:heightAt(p.pos.x, p.pos.z) + 2.2, z:p.pos.z }, size || 15); }
// lying flat on foot (not rolling, not getting on or off the ride): the only way he can go unseen
export function playerHidden(){ const p = S.player; return !!(p && p.cav && !CV.mounted && !CV.trans && (CV.stance === 'prone' && !CV.roll || CV.diving === true)); }   /* SWIM 1 under the water (game/swim.js sets CV.diving): as hard to make out as a man lying flat */
// he has been spotted: every enemy close enough (alertR) knows where he is for keep s
function spot(p, t, keep, why){ const was = (p.spotUntil || 0) > t; p.spotUntil = Math.max(p.spotUntil || 0, t + keep);
  if(!was && why && playerHidden() && t - _sayAt > STEALTH.say){ _sayAt = t; say(why, '#ff7a5a'); } }
// Z380 is the line from a shooter's eyes to the top of the soldier's head (or to either shoulder) open — no wall, house, rock or cover standing in it higher than the line
//   (lying flat his head is a hand off the ground, kneeling a little over a metre); remembered a moment per shooter (STEALTH.sightT) while he stays put
const _sight = new Map();
function inSight(x, y, z){ const p = S.player, t = now_(), C = STEALTH, st = CV.mounted ? 'mounted' : CV.roll ? 'prone' : (CV.stance || 'stand'), k = (Math.round(x * 2) + 1000) * 4e6 + (Math.round(z * 2) + 1000) * 2000 + Math.round(y * 2) + 500;   // (one per shooter's spot)
  const c = _sight.get(k); if(c && t - c.t < C.sightT && c.st === st && Math.abs(c.px - p.pos.x) < 0.25 && Math.abs(c.pz - p.pos.z) < 0.25) return c.v;
  const hy = heightAt(p.pos.x, p.pos.z) + (C.head[st] || C.head.stand) + (p.lift || 0), dx = p.pos.x - x, dz = p.pos.z - z, L = Math.hypot(dx, dz) || 1, sx = dz / L * C.side, sz = -dx / L * C.side;   // (Z451 up on a wall: his head is up there)
  const v = lineClear(x, y, z, p.pos.x, hy, p.pos.z) || lineClear(x, y, z, p.pos.x + sx, hy - C.drop, p.pos.z + sz) || lineClear(x, y, z, p.pos.x - sx, hy - C.drop, p.pos.z - sz);   // (his head, or either shoulder: a post or a pole hides no man)
  if(_sight.size > 800) _sight.clear(); _sight.set(k, { t, v, st, px:p.pos.x, pz:p.pos.z }); return v; }
// can a shooter whose eyes are at (x, y, z) see the player now — every enemy gun asks before it takes him as its target
export function playerSeen(x, y, z){ const p = S.player; if(!p) return true; if(!p.cav) return !tentHides(x, y, z, p.pos.x, heightAt(p.pos.x, p.pos.z) + TENT.eye.mid, p.pos.z);   // Z402 a tent hides the tank too
  if(!inSight(x, y, z)) return false;   // Z380 not through anything solid, standing or lying (a tent included — it is a block)
  if(!playerHidden()) return true; const t = now_(), C = STEALTH;
  const d = Math.hypot(p.pos.x - x, heightAt(p.pos.x, p.pos.z) + 0.3 - y, p.pos.z - z);
  if((p.spotUntil || 0) > t) return d < C.alertR;
  const r = C.see[Math.hypot(p.vel.x, p.vel.z) > C.crawlV ? 1 : 0] * (1 - (1 - C.night) * (NIGHT.k || 0));   // (crawling is easier to see than lying still)
  if(d < r){ spot(p, t, C.keep.near, 'BỊ PHÁT HIỆN!'); return true; }
  return false; }
// AI 1 the bare sight line from a man's eyes to him (no stance rule): ai/awareness.js weighs distance, stance, movement, cover, night and the view cone itself
// SMOKE 1 the smoke screen hides him from whoever must look THROUGH it, not only while he stands inside it: a sight line that passes within
//   EQUIP.smoke.radius × sightK of the cloud's centre is shut (a man standing in the cloud sees nothing either) — the enemy loses him and goes searching (ai/awareness.js)
// EVENT 2 …and so does any other bank of smoke on the field: VEILS — { x, z, R, until } — a burning field's (campaign/big-events.js), a handful at most
export const VEILS = [];
function crosses(x, z, cx, cz, R){ const p = S.player, ax = p.pos.x - x, az = p.pos.z - z, L2 = ax * ax + az * az || 1; let u = ((cx - x) * ax + (cz - z) * az) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u; const dx = x + ax * u - cx, dz = z + az * u - cz; return dx * dx + dz * dz < R * R; }
function smokeShuts(x, z){ const p = S.player, t = now_(); if(t < (p.smokeUntil || 0) && crosses(x, z, p.smokeX, p.smokeZ, EQUIP.smoke.radius * EQUIP.smoke.sightK)) return true;
  for(let i = 0; i < VEILS.length; i++){ const v = VEILS[i]; if(t < v.until && crosses(x, z, v.x, v.z, v.R)) return true; } return false; }
export function playerSight(x, y, z){ const p = S.player; if(!p) return false; if(smokeShuts(x, z)) return false; return p.cav ? inSight(x, y, z) : !tentHides(x, y, z, p.pos.x, heightAt(p.pos.x, p.pos.z) + TENT.eye.mid, p.pos.z); }
// AI 1 a rifleman made him out lying flat (ai/awareness.js): every gun within alertR knows where he lies for a moment, as when a guard spots him
export function stealthSpot(why){ const p = S.player; if(p && p.cav && !CV.mounted) spot(p, now_(), STEALTH.keep.near, why); }
// he fired (combat/lock-on.js, a round of the player's): the flash gives him away — AI 1 and the report alerts every enemy soldier in earshot (on foot or in the saddle)
export function stealthShot(){ const p = S.player; if(!p) return; if(quietShot(p)) return;   /* SUPPLY 3 a suppressed gun: heard only close by, no flash (game/quiet.js) */ awareNoise(p.pos.x, p.pos.z, now_()); if(p.cav && !CV.mounted) spot(p, now_(), STEALTH.keep.shot, 'LỘ VỊ TRÍ!'); }
// a searchlight's pool on the ground (fx/searchlight.js leaves its size, stretch and heading on it): is he inside it
export function stealthLight(L){ const p = S.player; if(!p || !p.cav || CV.mounted || !L || !L.on || !(L.r > 0)) return;
  const dx = p.pos.x - L.hit.x, dz = p.pos.z - L.hit.z, al = dx * L.ux + dz * L.uz, ac = dx * L.uz - dz * L.ux, k = STEALTH.lit;
  if((al / (L.r * L.st * k)) ** 2 + (ac / (L.r * k)) ** 2 < 1) spot(p, now_(), STEALTH.keep.lit, 'BỊ ĐÈN SOI!'); }
// a round that would hit him (combat/lock-on.js): going over in a roll he is very hard to hit; running fast a little harder
export function dodgeShot(p){ if(!p || !p.cav || CV.mounted) return false; const E = STEALTH.evade; let k = 0;
  if(CV.roll) k = E.roll; else if(CV.stance === 'stand') k = E.run * Math.max(0, Math.min(1, (Math.hypot(p.vel.x, p.vel.z) - E.v[0]) / (E.v[1] - E.v[0])));
  if(!(Math.random() < k)) return false; const t = now_(); if(t - _dodgeAt > E.say){ _dodgeAt = t; say('NÉ!', '#9be04a', 13); } return true; }
