// ai/awareness.js — AI 1 WHAT EACH ENEMY SOLDIER KNOWS. Every man on foot used to know where the player was the moment he existed, and then did little about
//   it. Now each carries an alert level (e.alert): 0 UNAWARE — he marches on a rough report of where we are (e.lk) and sweeps the ground when he gets there;
//   1 SUSPICIOUS — he heard a run / a horse / an engine, or half made a man out: he stops, turns and walks to that spot; 2 ALERTED — combat. A man is made out
//   by distance against how visible the player is this moment (stance, movement, tucked behind cover, in bushes, night — playerLook, once for everybody) and
//   by where the man is looking (a front cone; next to nothing behind him); the sight line itself is asked on each man's own staggered tick (AWARE.tick),
//   never per frame. Lying flat is the model's prone row (STEALTH.see): the old stealth rule, now one rule. The player's own SHOT alerts every man in earshot
//   and gives them the spot; a HIT alerts the man hit; a mate FALLING alerts the men round him; an alerted man SHOUTS and his squad and the men near him are
//   alerted too. Alerted men stay in the fight: out of sight they fire on the last place they saw him, then close on it; only after AWARE.keep.alert seconds
//   without contact do they drop to searching it, and after keep.search more give the search up. The first shot waits a reaction delay (AWARE.react).
//   The group of an alerted man's bursts (e.zero, 0 wide … 1 tight) closes while the player stands in his sight and opens when he runs or breaks the line.
import { AWARE, STEALTH } from '../../config.js';
import { CV, NIGHT, S, UGRID, aiIQ, clampFieldXZ, crushables, enemies, floatText, heightAt, playerSight, quietDeath, sfx, sneakK, stealthSpot, tierK, unitsNear, wrapAngle } from '../hub.js';

const A = AWARE, R2 = a => a[0] + Math.random() * (a[1] - a[0]), mix = (a, k) => a[0] + (a[1] - a[0]) * k;
// the player as the enemy's eyes get him this moment: r = how far off a man looking his way makes him out
export const PL = { at:0, r:A.see.r, st:'stand', v:0, cover:false, bush:false, spotted:false };
const SHOUTS = [], _nb = [], _pos = { x:0, y:0, z:0 }; let _noiseAt = -9, _sayAt = -9;

function inBush(x, z){ const C = A.see; for(let i = 0; i < crushables.length; i++){ const c = crushables[i]; if(!c.alive || !c.flora || (c.s || 1) < C.bushS) continue;
    const dx = c.x - x, dz = c.z - z, r = c.r + C.bushPad; if(dx * dx + dz * dz < r * r) return true; } return false; }
function playerLook(now){ const p = S.player, C = A.see; PL.at = now + 0.15; if(!p){ PL.r = 0; return; }
  const foot = !!p.cav && !CV.mounted, st = !p.cav ? 'stand' : CV.mounted ? 'mounted' : CV.roll ? 'crouch' : (CV.stance || 'stand'), v = Math.hypot(p.vel.x, p.vel.z), nk = NIGHT.k || 0;
  PL.st = st; PL.v = v; PL.cover = foot && !!CV.cover; PL.bush = foot && inBush(p.pos.x, p.pos.z); PL.spotted = (p.spotUntil || 0) > now;
  const r = st === 'prone' ? STEALTH.see[v > STEALTH.crawlV ? 1 : 0] * (1 - (1 - STEALTH.night) * nk)                     // lying flat: the stealth ranges (still / crawling)
    : C.r * (C.stance[st] || 1) * (v < 0.4 ? C.still : v > C.runV ? C.run : 1) * (1 - (1 - C.night) * nk);
  PL.r = r * (PL.cover ? C.cover : 1) * (PL.bush ? C.bush : 1); }
// where an unaware man is looking: his front in full, his flanks less, behind him next to nothing — and anyone within arm's reach
function coneK(e, dx, dz){ const C = A.see, a = Math.abs(wrapAngle(Math.atan2(dx, dz) - e.facing)); return a < C.cone[0] ? 1 : a < C.cone[1] ? C.side : C.rear; }
function bark(e, txt, col, now){ const p = S.player, Y = A.say; if(!p || now - _sayAt < Y.gap || (e.pos.x - p.pos.x) ** 2 + (e.pos.z - p.pos.z) ** 2 > Y.r * Y.r) return;
  _sayAt = now; _pos.x = e.pos.x; _pos.z = e.pos.z; _pos.y = heightAt(e.pos.x, e.pos.z) + 2.3; floatText(txt, col, _pos, Y.size); sfx(txt === '!' ? 'beep' : 'click', e.pos, 0.5); }
function init(e, now){ const p = S.player, k = e.lk || (e.lk = { x:0, z:0 }), hot = !!(e.alert0 || e.general || e.genGuard || e.relicGuard);   // (an ambush, the general and his guards, the relic's attackers know)
  e.alert = 0; e.det = 0; e.sees = false; e.zero = 0; e.reactAt = 0; e.awT = now; e.awAt = now + Math.random() * A.tick[1]; e.actAt = now; e.lkAt = -1e9; e.srAt = 0;
  if(p && !e.guard){ const a = Math.random() * 6.283, r = hot ? 0 : Math.random() * A.intel.err; k.x = p.pos.x + Math.cos(a) * r; k.z = p.pos.z + Math.sin(a) * r; } else { k.x = e.pos.x; k.z = e.pos.z; }
  if(hot) alertEnemy(e, now, 'order'); }
// he is in the fight from now: (x, z) is where he believes the player to be (default: where he is). why: see · shot · hit · death · shout · order
export function alertEnemy(e, now, why, x, z){ const p = S.player; if(!p || !e.def || !e.def.inf) return; if(e.alert === undefined) init(e, now); const k = e.lk, was = e.alert;
  if(was >= 2){ if(!e.sees){ k.x = x ?? p.pos.x; k.z = z ?? p.pos.z; e.lkAt = now; } return; }   // already fighting: news of him only matters while he is out of sight
  k.x = x ?? p.pos.x; k.z = z ?? p.pos.z; e.lkAt = now; e.alert = 2; e.alWhy = why; e.det = 1; e.zero = 0; e.actAt = now; e.srAt = 0; e.tgtAt = 0; e.burstLeft = 0; e.coverAt = 0;
  e.reactAt = Math.max(e.reactAt || 0, now + (why === 'hit' ? A.reactHit : R2(A.react) * mix(A.reactK, aiIQ()) * tierK('react'))); e.fireAt = Math.max(e.fireAt || 0, e.reactAt);
  if(why === 'see' || why === 'hit' || why === 'death'){ e.shoutAt = now + A.shout.delay; SHOUTS.push(e); }   // (a shot is heard by all of them at once; a shout does not echo on)
  bark(e, '!', '#ff5a3a', now); }
// he heard or glimpsed something at (x, z): he stops, turns to it and goes to look (his squad's leader takes the spot as the squad's next search point)
export function suspectEnemy(e, now, x, z){ if(!e.def || !e.def.inf) return; if(e.alert === undefined) init(e, now); if(e.alert >= 2) return; const k = e.lk; k.x = x; k.z = z; e.lkAt = now; e.srAt = 0;
  if(e.alert < 1){ e.alert = 1; e.reactAt = now + A.react[1]; e.tgtAt = 0; bark(e, '?', '#ffd86a', now);
    const L = e.sq && e.sq.leader; if(L && L !== e && L.alert !== undefined && L.alert < 2){ L.lk.x = x; L.lk.z = z; L.srAt = 0; } } }
// one man's look (called every frame; does its work on his own staggered tick)
export function awareTick(e, now){ if(e.alert === undefined) init(e, now); if(now < e.awAt) return;
  const dtk = Math.min(1, now - e.awT), p = S.player; e.awT = now; e.awAt = now + R2(A.tick); if(!p || S.mode !== 'playing' || e.rise){ e.sees = false; return; }
  const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1, al = e.alert >= 2, C = A.see, k = e.lk;
  let R = al ? Math.max(PL.r * C.alertK, PL.spotted ? STEALTH.alertR : 0) : PL.r * coneK(e, dx, dz), vis = 0;
  if(al && e.sees) R = Math.max(R, C.r * C.track * (1 - (1 - C.night) * (NIGHT.k || 0)) * (PL.bush ? C.bush : 1));   // a man he is watching does not vanish by dropping flat in the open
  const nr = C.near * sneakK(e, dx, dz);   // SUPPLY 3 (crept up on from behind he senses a man only at arm's length — game/quiet.js)
  if(d < Math.max(R, nr) && playerSight(e.pos.x, heightAt(e.pos.x, e.pos.z) + 1.6, e.pos.z)) vis = d < nr ? 1 : Math.max(0.03, 1 - d / R);
  if(vis > 0){
    if(al){ if(!e.sees && e.sq) for(const o of e.sq.m){ if(o !== e && o.alert >= 2 && !o.sees){ o.lk.x = p.pos.x; o.lk.z = p.pos.z; o.lkAt = now; } }   // he has him again: his squad knows (no second shout)
      e.sees = true; k.x = p.pos.x; k.z = p.pos.z; e.lkAt = now; }
    else { e.det += dtk / ((A.spot.t[0] + (A.spot.t[1] - A.spot.t[0]) * (1 - vis)) * tierK('spot'));
      if(e.det >= 1){ alertEnemy(e, now, 'see'); e.sees = true; if(PL.st === 'prone') stealthSpot('BỊ PHÁT HIỆN!'); }
      else if(e.det >= A.spot.sus) suspectEnemy(e, now, p.pos.x, p.pos.z); } }
  else { e.sees = false;
    if(!al){ e.det = Math.max(0, e.det - dtk * A.spot.decay); const H = A.hear;   // his ears: a sprint, hooves, an engine
      const hr = !p.cav ? 0 : CV.mounted ? (p.bike ? H.bike : H.horse) * Math.min(1, PL.v / H.runV) : (PL.v > H.runV && PL.st === 'stand' ? H.run : 0);
      if(d < hr) suspectEnemy(e, now, p.pos.x, p.pos.z);
      else if(e.alert === 1 && now - e.lkAt > A.keep.search){ e.alert = 0; e.det = 0; } }
    else if(now - e.lkAt > A.keep.alert){ e.alert = 1; e.lkAt = now; e.det = A.spot.sus; e.zero = 0; } }   // a long time without contact: he drops to searching the last place
  if(e.alert >= 2){ const Z = A.zero;   // the group of his bursts closes on a man who stands in his sight, opens on one who runs or breaks the line
    if(e.sees && PL.v < Z.runV) e.zero = Math.min(1, e.zero + dtk * Z.gain * (PL.v < Z.slowV ? 1 : Z.walkK) * (PL.cover || PL.bush ? Z.coverK : 1) * mix(Z.iqK, aiIQ()));
    else e.zero = Math.max(0, e.zero - dtk * Z.loss); }
  else if(now > (e.scanAt || 0)){ e.scanAt = now + 2 + Math.random() * 3; e.scanA = e.facing + (Math.random() - 0.5) * 2.4; }   // (a man who does not know looks about: where he faces is what he can see)
  if((e.alert < 2 || !e.sees && now - e.lkAt > A.keep.suppress) && !e.guard && !e.exit && (!e.sq || e.sq.leader === e)){ const Sr = A.search;   // nobody at the spot (an alerted man too, once his suppressing fire is spent): on to the next piece of ground, drifting toward where we really are
    if((k.x - e.pos.x) ** 2 + (k.z - e.pos.z) ** 2 < Sr.reach * Sr.reach){ if(!e.srAt) e.srAt = now + R2(Sr.wait);
      else if(now > e.srAt){ e.srAt = 0; const step = Math.max(Sr.step[0], Math.min(Sr.step[1], d * Sr.far)), a = Math.random() * 6.283, w = Sr.drift * Math.min(1, PL.r / (C.r * Sr.hidK));   // (a man well hidden — flat, in the bushes — is swept for almost blind)
        const c = clampFieldXZ(k.x + dx / d * step * w + Math.cos(a) * step * (1 - w), k.z + dz / d * step * w + Math.sin(a) * step * (1 - w), 4); k.x = c[0]; k.z = c[1]; } }
    else e.srAt = 0; } }
// once a frame, before the men move: how visible the player is, and the shouts that are due
export function awareFrame(dt, now){ if(now >= PL.at) playerLook(now);
  for(let i = SHOUTS.length - 1; i >= 0; i--){ const e = SHOUTS[i]; if(now < e.shoutAt) continue; SHOUTS.splice(i, 1); if(e.alert !== 2 || !enemies.includes(e)) continue;
    const k = e.lk, r = A.shout.r * tierK('shout'), r2 = r * r;
    if(e.sq) for(const o of e.sq.m) if(o !== e && o.hp > 0) alertEnemy(o, now, 'shout', k.x, k.z);
    for(const o of unitsNear(UGRID.inf, e.pos.x, e.pos.z, r, _nb)){ if(o === e || !(o.hp > 0) || (o.pos.x - e.pos.x) ** 2 + (o.pos.z - e.pos.z) ** 2 > r2) continue; alertEnemy(o, now, 'shout', k.x, k.z); } } }
// the player's own shot at (x, z): every enemy soldier in earshot is alerted and knows the spot (a man already fighting and out of sight of him: updated)
export function awareNoise(x, z, now, r){ now = now || performance.now() / 1000; const H = A.hear; if(now - _noiseAt < H.gap) return; _noiseAt = now; const r2 = (r || H.shot) ** 2;   // (SUPPLY 3 r: a suppressed gun's short reach — game/quiet.js)
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!e.def.inf) continue; const dx = e.pos.x - x, dz = e.pos.z - z; if(dx * dx + dz * dz > r2) continue;
    alertEnemy(e, now, 'shot', x + (Math.random() - 0.5) * H.shotErr, z + (Math.random() - 0.5) * H.shotErr); } }
// a round has just hit this man and he lives: alerted at once, a short reaction
export function awareHit(e){ const p = S.player; if(!p || !e.def.inf || !(e.hp > 0)) return; const er = A.hit.err; alertEnemy(e, performance.now() / 1000, 'hit', p.pos.x + (Math.random() - 0.5) * er, p.pos.z + (Math.random() - 0.5) * er); }
// this man has just fallen: the men round him know they are under fire
export function awareDeath(e){ const p = S.player; if(!p || !e.def.inf || quietDeath(e)) return;   /* SUPPLY 3 the knife, a suppressed round: only the men right beside him know (game/quiet.js) */ const D = A.death, now = performance.now() / 1000, r2 = D.r * D.r;
  for(const o of unitsNear(UGRID.inf, e.pos.x, e.pos.z, D.r, _nb)){ if(o === e || !(o.hp > 0) || (o.pos.x - e.pos.x) ** 2 + (o.pos.z - e.pos.z) ** 2 > r2) continue;
    alertEnemy(o, now, 'death', p.pos.x + (Math.random() - 0.5) * D.err, p.pos.z + (Math.random() - 0.5) * D.err); } }
