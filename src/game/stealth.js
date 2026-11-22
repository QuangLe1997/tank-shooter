// game/stealth.js — Z377 A MAN FLAT ON THE GROUND IS HARD TO SEE (soldier mode, on foot): every enemy gun used to take the player as its target by distance
//   alone, so a soldier lying in the dirt was hosed by a tower MG 25 m off exactly as if he stood. Now each gun asks playerSeen() first. Standing, kneeling,
//   rolling or on the ride he is always seen; lying flat — still or crawling — only by a man close enough to make him out (a short distance measured from the
//   shooter's eyes, so a guard on a tower or a wall top, 6–11 m up, sees him only near its foot; shorter at night), or once he has been spotted: picked out
//   close by, caught in a searchlight's pool, or given away by his own muzzle flash — then every enemy within STEALTH.alertR knows where he lies for a while.
//   The combat roll is also a dodge: a round that would hit him while he goes over usually misses (dodgeShot; running fast dodges a few).
import { STEALTH, TENT } from '../../config.js';
import { CV, NIGHT, S, floatText, heightAt, lineClear, tentHides } from '../hub.js';

const now_ = () => performance.now() / 1000;
let _sayAt = -9, _dodgeAt = -9;
function say(txt, col, size){ const p = S.player; if(!p) return; floatText(txt, col, { x:p.pos.x, y:heightAt(p.pos.x, p.pos.z) + 2.2, z:p.pos.z }, size || 15); }
// lying flat on foot (not rolling, not getting on or off the ride): the only way he can go unseen
export function playerHidden(){ const p = S.player; return !!(p && p.cav && !CV.mounted && !CV.trans && CV.stance === 'prone' && !CV.roll); }
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
// he fired (combat/lock-on.js, a round of the player's): the flash gives him away
export function stealthShot(){ const p = S.player; if(p && p.cav && !CV.mounted) spot(p, now_(), STEALTH.keep.shot, 'LỘ VỊ TRÍ!'); }
// a searchlight's pool on the ground (fx/searchlight.js leaves its size, stretch and heading on it): is he inside it
export function stealthLight(L){ const p = S.player; if(!p || !p.cav || CV.mounted || !L || !L.on || !(L.r > 0)) return;
  const dx = p.pos.x - L.hit.x, dz = p.pos.z - L.hit.z, al = dx * L.ux + dz * L.uz, ac = dx * L.uz - dz * L.ux, k = STEALTH.lit;
  if((al / (L.r * L.st * k)) ** 2 + (ac / (L.r * k)) ** 2 < 1) spot(p, now_(), STEALTH.keep.lit, 'BỊ ĐÈN SOI!'); }
// a round that would hit him (combat/lock-on.js): going over in a roll he is very hard to hit; running fast a little harder
export function dodgeShot(p){ if(!p || !p.cav || CV.mounted) return false; const E = STEALTH.evade; let k = 0;
  if(CV.roll) k = E.roll; else if(CV.stance === 'stand') k = E.run * Math.max(0, Math.min(1, (Math.hypot(p.vel.x, p.vel.z) - E.v[0]) / (E.v[1] - E.v[0])));
  if(!(Math.random() < k)) return false; const t = now_(); if(t - _dodgeAt > E.say){ _dodgeAt = t; say('NÉ!', '#9be04a', 13); } return true; }
