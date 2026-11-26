// game/ambush.js — AMBUSH 1 THE BLADE DOES NOT GIVE HIM AWAY: hide behind a rock or a container, dart out, cut one man down, get back in — and nobody who did
//   not SEE it knows. The blade was already "quiet" on paper (BLADE 5 / 8) and in the game it was not: a swing beside any block within a grid cell "clanged"
//   and that clang was a SHOT's alert to every man inside 10 m (the man about to be cut among them — so the ambush never happened), and a man who knew, cut
//   down, alerted everybody inside 20 m through walls as if he had been shot. Here noise and sight are two rules (config AMBUSH):
//   · NOISE: no cut is a noise men are alerted by. Steel that really meets cover, a wounded man's cry, the death cry of a man who already knew and his own
//     sprint with the blade out only turn the men near SUSPICIOUS (ambushClang · actors/blade.js cut · ambushDeath · ambushStepR); a staggered man cannot shout.
//   · SIGHT: a blade kill alerts who SEES it — in his view cone, inside the witness range, a clear line to the body (ambushDeath); a body is found only with a
//     clear line to it (ambushBodySeen); behind an unaware man only the arm's-length sense works (ai/awareness.js coneK reads AMBUSH.see.rear).
//   · THE MOVE: the man an ambush is begun on from outside his front is flat-footed for the dash and the wind-up (e.flatAt — ambushFlat), nobody dives out of
//     the way of a man they do not know is coming (ambushScatter), his own squad holds its fire while the blade is out and nobody is alerted (ambushHold).
//   · CO-OP: the guest's cut is a HIT report with the blade's weapon index; the host judges it by the same rules against ITS knowledge of the man
//     (net/rules.js coopJudgeBlade → ambushGuestCut) and the kill's witnesses are told where the GUEST stood.
//   Nothing here runs per enemy per frame: every sight line is asked at an event (a kill, a body looked at on the bodies' own 0.5 s pass, a swing's window).
import { AMBUSH, AWARE, BLADE, LOGISTICS } from '../../config.js';
import { BLADEST, CV, MATE, NIGHT, QUIET, S, UGRID, alertEnemy, coopJudgeBlade, enemies, floatText, heightAt, inShape, lineClear, ringPulse, suspectEnemy, tip, unitsNear, wrapAngle } from '../hub.js';

const M = AMBUSH, D2R = Math.PI / 180, _nb = [], _j = {}, _q = {};
// seenBy: how many saw the last blade kill · the counts are for the probes (ambushProbe)
export const AMBST = { seenBy:0, kills:0, seen:0, clangs:0, cries:0, thuds:0, marks:0, held:0, mateShotAt:-99, mateCuts:0, mateAmbush:0, saidKey:'' };
const mine = () => { const p = S.player; return !(p && p.mate); };   // (false while the host's AI regards the co-op guest: "the player" is his proxy for that man's update)
// is the blade the quiet weapon in his hands now (the page's own soldier — or the guest's, for the man regarding him)
export function bladeQuiet(){ if(!M.on || !BLADE.on || !BLADE.quiet.on) return false; return mine() ? !!BLADEST.held : !!(MATE.RC && MATE.RC.blade); }
// actors/blade.js bladeGlimpseK, for the guest: his blade is out and he has not fired for quiet.shotT s
export function ambushMateK(){ const Q = BLADE.quiet; return M.on && BLADE.on && Q.on && MATE.RC && MATE.RC.blade && performance.now() / 1000 - AMBST.mateShotAt > Q.shotT ? Q.glimpse : 1; }
// ai/awareness.js: how far his sprint is heard (r = AWARE.hear.run) — with the blade out stepR, the dash-in not at all
export function ambushStepR(r){ if(!bladeQuiet()) return r; if(mine() && BLADEST.dashing) return 0; return Math.min(r, M.noise.stepR); }
// ai/awareness.js: the man an ambush was begun on has no time to sense it; actors/infantry.js: nor does anybody dive out of the way of a man they do not know of
export function ambushFlat(e, now){ return now < (e.flatAt || 0); }
export function ambushScatter(e, now){ return !(now < (e.flatAt || 0)) && (e.alert > 0 || CV.mounted || !bladeQuiet()); }
// actors/blade.js windows: does the cut's arc (bearings lo…hi degrees off f0, out to reach) really meet block bl — the grid's neighbours are not "struck"
export function ambushTouch(bl, px, pz, f0, lo, hi, reach){ const T = M.noise.touch, nB = Math.max(2, T[0] | 0), nR = Math.max(1, T[1] | 0), span = Math.min(360, hi - lo);
  for(let i = 0; i < nB; i++){ const a = f0 + (lo + span * i / (nB - 1)) * D2R, sx = Math.sin(a), cz = Math.cos(a);
    for(let k = 0; k < nR; k++){ const d = reach * (nR > 1 ? 0.55 + 0.4 * k / (nR - 1) : 0.8); if(inShape(bl, px + sx * d, pz + cz * d)) return true; } }
  return false; }
// steel on cover at (x, z): the men within clangR who do not know turn to it and come to look — a sound, not a shot
export function ambushClang(x, z, now){ const r = BLADE.quiet.clangR, r2 = r * r; AMBST.clangs++;
  for(const o of unitsNear(UGRID.inf, x, z, r, _nb)){ if(!(o.hp > 0) || o.alert >= 2 || o.rise || (o.pos.x - x) ** 2 + (o.pos.z - z) ** 2 > r2) continue; suspectEnemy(o, now, x, z, 'clang'); } }
// game/quiet.js quietDeath: the blade has just killed e. Who SAW it done — his own eyes, his view cone, a clear line — is alerted and knows where the man with the
//   blade stood (e._by: the co-op guest's place, else the player's); a man right beside him who was not looking hears him fall and turns; if e already knew, his
//   death cry turns the men within cryR who saw nothing suspicious. Nobody else learns anything. → how many saw
export function ambushDeath(e, now){ const p = S.player, W = M.witness, C = AWARE.see, by = e._by || (p && p.pos), ex = e.pos.x, ez = e.pos.z, R = W.r * (1 - (1 - W.night) * (NIGHT.k || 0)), cr = BLADE.quiet.cryR, knew = e.alert >= 2;
  const ey = heightAt(ex, ez) + W.bodyY; let n = 0; if(!by) return 0;
  for(const o of unitsNear(UGRID.inf, ex, ez, Math.max(R, cr), _nb)){ if(o === e || !(o.hp > 0) || o.rise || !o.def || !o.def.inf) continue; const dx = ex - o.pos.x, dz = ez - o.pos.z, d2 = dx * dx + dz * dz; let saw = false;
    if(d2 <= R * R && !(now < (o.dazeUntil || 0))){ const a = Math.abs(wrapAngle(Math.atan2(dx, dz) - o.facing)), k = a < C.cone[0] ? 1 : a < C.cone[1] ? W.side : 0;
      saw = k > 0 && d2 <= R * R * k * k && lineClear(o.pos.x, heightAt(o.pos.x, o.pos.z) + M.body.eyeY, o.pos.z, ex, ey, ez); }
    if(saw){ n++; alertEnemy(o, now, 'see', by.x + (Math.random() - 0.5) * W.err, by.z + (Math.random() - 0.5) * W.err); ringPulse(o.pos, 0xff5a3a, 1.8); }
    else if(o.alert >= 2) continue;
    else if(d2 < W.near * W.near){ AMBST.thuds++; suspectEnemy(o, now, ex, ez, 'thud'); }
    else if(knew && d2 < cr * cr){ AMBST.cries++; suspectEnemy(o, now, ex, ez, 'cry'); } }
  AMBST.seenBy = n; AMBST.kills++; if(n) AMBST.seen++; return n; }
// game/quiet.js bodies: has this man a clear line from his eyes to the body — a body behind a wall is not found through it
export function ambushBodySeen(o, b){ return !M.on || !M.body.los || lineClear(o.pos.x, heightAt(o.pos.x, o.pos.z) + M.body.eyeY, o.pos.z, b.x, heightAt(b.x, b.z) + M.body.y, b.z); }
// actors/fireteam.js allyFire: his own men hold their fire while the blade is out and nobody within the eye's reach is alerted (a man under fire shoots back)
export function ambushHold(a){ return M.on && M.squad.hold && BLADE.on && BLADEST.held && QUIET.eye >= 0 && QUIET.eye < 2 && !((a && a.supp || 0) > 0.15); }
// actors/blade.js cut: what he reads over his head after a blade kill — seen (by how many) or nothing; the silent kill's own line is the blade's
export function ambushSaySeen(p, n){ floatText(M.say.seen + (n > 1 ? ' ×' + n : ''), '#ff5a3a', p.pos, 17); }
// game/quiet.js updateQuiet, on its own tick: the guest's last shot (his glimpse rule), the first-time note and the once-a-battle line that the blade is the quiet weapon
export function ambushTick(now){ if(!M.on) return; if(MATE.on && MATE.firing && !(MATE.RC && MATE.RC.blade)) AMBST.mateShotAt = now;
  if(!BLADE.on || !BLADEST.held || QUIET.eye !== 0) return; const key = (S.loop || 0) + ':' + (S.stage || 1); if(key === AMBST.saidKey) return; const p = S.player;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!e.def.inf || !(e.hp > 0) || (e.pos.x - p.pos.x) ** 2 + (e.pos.z - p.pos.z) ** 2 > 1600) continue; AMBST.saidKey = key; floatText(M.say.quiet, '#9be04a', p.pos, 15); tip('blade'); return; } }
// ---- co-op, on the HOST: the guest reports a cut on e (game/coop-glue.js, a HIT whose weapon index is AMBUSH.net.w). Judged by net/rules.js coopJudgeBlade against
//   what the host knows — his state's blade bit, where he said he stood, the host's own reach, whether the man knew and which way he faced. A cut that kills
//   marks the man as the blade's (the quiet death, the witnesses told where the GUEST stood, cut apart); one that does not: his cry. → { ok, dmg, why, ambush, hush }
let _reach = 0;
export function ambushGuestCut(TR, e, dmg, now, guestDown){ if(!_reach){ for(const k in BLADE.kinds){ const K = BLADE.kinds[k]; let r = K.reach; for(const m of [].concat(K.moves.light, K.moves.heavy, K.moves.run, K.moves.special, K.moves.counter)) if(m && m.reach > r) r = m.reach; if(r > _reach) _reach = r; } }
  const inf = !!(e && e.def && e.def.inf), q = _q; q.now = now; q.dmg = dmg; q.enemyAlive = !!(e && e.hp > 0); q.enemyHp = e ? e.hp : 0; q.dist = e ? Math.hypot(e.pos.x - MATE.x, e.pos.z - MATE.z) : 0; q.bladeOut = !!(MATE.RC && MATE.RC.blade);
  q.reach = _reach * 1.2 + BLADE.quiet.dashR; q.guestDown = !!guestDown; q.unaware = inf && BLADE.quiet.on && M.on && e.alert !== undefined && e.alert < 2;
  q.outside = inf && Math.abs(wrapAngle(Math.atan2(MATE.x - e.pos.x, MATE.z - e.pos.z) - (e.facing || 0))) > LOGISTICS.quiet.knife.front; q.big = !!(e && (e.general || e.commander || e.elite || e.hitCap)) || !BLADE.quiet.ambush;
  const j = coopJudgeBlade(TR, q, _j); if(!j.ok) return j; AMBST.mateCuts++; if(j.ambush) AMBST.mateAmbush++;
  if(inf && j.dmg >= e.hp){ e._blade = true; e._by = { x:MATE.x, z:MATE.z }; if(j.hush) e._knife = true; if(BLADE.sever.on) e._bladeCut = 'waist';
    const seen = ambushDeath(e, now); e._ambDone = true; e._mateSilent = j.hush && !seen; }   // (the witnesses now, so the death's event can tell the guest whether it went unseen)
  else if(inf && BLADE.quiet.on){ const r = BLADE.quiet.cryR, ex = e.pos.x, ez = e.pos.z; for(const o of unitsNear(UGRID.inf, ex, ez, r, _nb)){ if(o !== e && o.hp > 0 && (o.pos.x - ex) ** 2 + (o.pos.z - ez) ** 2 < r * r) suspectEnemy(o, now, ex, ez, 'cry'); } }
  return j; }
// co-op, on the GUEST: the host says a man died; flag 8 = by this page's own blade, in silence and unseen
export function ambushGuestKill(e, flags){ const p = S.player; if(!(flags & 8) || !p || !BLADEST.held || !e || !e.pos || (e.pos.x - p.pos.x) ** 2 + (e.pos.z - p.pos.z) ** 2 > 36) return; BLADEST.silent++; floatText('HẠ GỤC ÊM', '#9be04a', p.pos, 16); }
export function ambushProbe(){ return { seenBy:AMBST.seenBy, kills:AMBST.kills, seen:AMBST.seen, clangs:AMBST.clangs, cries:AMBST.cries, thuds:AMBST.thuds, marks:AMBST.marks, mateCuts:AMBST.mateCuts, mateAmbush:AMBST.mateAmbush, quiet:bladeQuiet(), dashing:!!BLADEST.dashing, hold:ambushHold(null) }; }
