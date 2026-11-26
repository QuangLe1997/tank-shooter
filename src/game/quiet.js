// game/quiet.js — SUPPLY 3 QUIET OR LOUD (soldier mode, on foot): the suppressed gun, the knife, the bodies left behind, the alarm, and the eye that says whether he is still unseen.
//   · A SUPPRESSED gun (GUNS.supp — the M4 GIẢM THANH) is heard a dozen metres off instead of seventy and its flash gives no position away (game/stealth.js stealthShot →
//     quietShot); the man it drops alerts only the mates right beside him (ai/awareness.js awareDeath → quietDeath).
//   · The KNIFE (its key, the takedown prompt — a button on phones — or the mount key while the prompt shows): a short lunge at the nearest man in arm's reach. One who is
//     not alerted, taken from the side or from behind, goes down without a sound and leaves his pouch; from the front, or a man who knows, it is a weak stab (and he knows).
//   · A man downed in silence LIES where he fell (actors/infantry.js). An enemy who comes on the BODY turns suspicious with the men near him and searches from it.
//   · The ALARM: a sentry (a man holding a post) or a man searching from a body who SEES him or HEARS his shot (never one roused by our own men's fire) raises it a moment later — a red ring on him says so; silence him first
//     and it is not raised (unless another alerted sentry stands close). Raised: a whistle, a siren where there are towers, the whole camp alerted, and the director is asked
//     for one more squad (campaign/director.js dirAlarm). A few a stage at most: the clean approach earns the quieter fight, the botched one is punished where he can read it.
//   · The EYE chip (loot/powerups.js updateBuffHUD → game/logistics.js hudChips → QUIET.eye): closed — nobody suspects; half — a man is suspicious; open — a man is alerted.
//   Everything is read LOGISTICS.quiet.every s apart on one pass over the enemies (no sight line a frame; one ray when a takedown is on offer).
import { AWARE, BLADE, LOGISTICS } from '../../config.js';
import { ambushBodySeen, ambushDeath, ambushTick, CV, GUNS, MOBILE, PL, S, UGRID, alertEnemy, awareNoise, damageEnemy, dirAlarm, edgeEntry, enemies, entrySeen, floatText, hatchEntry, heightAt, inField, keyLabel, keysFor, killEnemy, lineClear, radio, ringPulse, sfx, showBanner, spawnSquad, squadTypes, suspectEnemy, towers, unitsNear, wrapAngle } from '../hub.js';

const Q = LOGISTICS.quiet, SAY = LOGISTICS.say, NOW = () => performance.now() / 1000;
// eye: −1 not on foot · 0 unseen · 1 suspected · 2 seen — can: the man a takedown is on offer for — bodies: { x, z, t, found } — pend: the alarm about to be raised { e, at, ring, x, z }
export const QUIET = { eye:-1, suppAt:-9, knifeAt:0, can:null, tickAt:0, bodyAt:0, bodies:[], pend:null, alarmN:0, alarmAt:-1e9, key:'', saidAt:-9,
  stats:{ suppShots:0, quiet:0, knife:0, stabs:0, found:0, raised:0, silenced:0, squads:0 } };
const _nb = [], _nb2 = [], _at = { x:0, y:0, z:0 };
function over(e, dy){ _at.x = e.pos.x; _at.z = e.pos.z; _at.y = heightAt(e.pos.x, e.pos.z) + dy; return _at; }

// game/stealth.js stealthShot: one of his rounds has left a suppressed gun — heard only close by, no flash to give him away. true: handled here
export function quietShot(p){ const gi = p.guns && p.guns[p.gunIdx], g = gi && GUNS[gi.id]; if(!g || !g.supp) return false; const t = NOW(); QUIET.suppAt = t; QUIET.stats.suppShots++; awareNoise(p.pos.x, p.pos.z, t, Q.suppR); return true; }
// ai/awareness.js awareDeath: this man has just fallen — to the knife, or within a moment of a suppressed shot. true: a quiet death (the wide alert is not given):
//   only the men right beside him know (a takedown: only one looking that way); a man who had not been alerted drops where he stood and his body stays
export function quietDeath(e){ const p = S.player; if(!p) return false; const now = NOW(), knife = e._knife === true, blade = e._blade === true; if(!knife && !blade && !(now - QUIET.suppAt < Q.killT)) return false;
  const r = knife ? Q.knife.seenR : Q.deathR, r2 = r * r, er = AWARE.death.err;
  if(blade){ if(!e._ambDone) ambushDeath(e, now); }   // AMBUSH 1 the blade (a man who knew, too): who SEES it done is alerted, nobody else — game/ambush.js
  else for(const o of unitsNear(UGRID.inf, e.pos.x, e.pos.z, r, _nb)){ if(o === e || !(o.hp > 0)) continue; const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z; if(dx * dx + dz * dz > r2) continue;
    if(knife && (Math.abs(wrapAngle(Math.atan2(dx, dz) - o.facing)) > Q.knife.cone || !ambushBodySeen(o, e.pos))) continue;   // (AMBUSH 1 …and not through a wall)
    alertEnemy(o, now, 'see', p.pos.x + (Math.random() - 0.5) * er, p.pos.z + (Math.random() - 0.5) * er); }   // (he saw it done: a sentry among them raises the alarm)
  if(knife || blade || !(e.alert >= 2)){ e._quietKill = true; QUIET.stats.quiet++; const B = QUIET.bodies; if(B.length >= Q.body.max) B.shift(); B.push({ x:e.pos.x, z:e.pos.z, t:now, found:false, life:e._bladeCut && BLADE.sever.on ? BLADE.sever.life : 0 }); }   // (AMBUSH 1 a man cut apart is ONE body, there for as long as he lies)
  return true; }

// ---- the knife ----
// ai/awareness.js awareTick: how much of AWARE.see.near an unaware man has — all of it for anyone in front of him, or coming fast, or riding; crept up on from the
//   side or from behind (dx, dz: from him to the player) only senseK of it, so a man can be reached with the knife at all
export function sneakK(e, dx, dz){ const K = Q.knife; return e.alert >= 2 || CV.mounted || PL.v > K.senseV || Math.abs(wrapAngle(Math.atan2(dx, dz) - e.facing)) <= K.front ? 1 : K.senseK; }
// the man in arm's reach along his aim (nearest), or null
function knifeTarget(p){ const K = Q.knife, a = p.aimSmoothed ?? p.facing; let best = null, bd = K.reach * K.reach;
  for(const e of unitsNear(UGRID.inf, p.pos.x, p.pos.z, K.reach, _nb)){ if(!(e.hp > 0) || e.rise) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d2 = dx * dx + dz * dz;
    if(d2 > bd || Math.abs(wrapAngle(Math.atan2(dx, dz) - a)) > K.arc) continue; bd = d2; best = e; }
  return best; }
// may this man be taken in silence: he does not know, he is no general / commander / elite, and the player is outside his front
function silent(e, p){ return !(e.alert >= 2) && !e.general && !e.commander && !e.elite && Math.abs(wrapAngle(Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z) - e.facing)) > Q.knife.front; }
const afoot = p => !!(p && p.cav && S.mode === 'playing' && !CV.mounted && !CV.trans && !CV.dead && !CV.roll && !CV.jump && !(CV.climb && CV.climb.ph !== 'top'));
// nothing solid between his chest and the man's (a wall, a parapet he stands on)
function clearTo(p, e){ return lineClear(p.pos.x, heightAt(p.pos.x, p.pos.z) + 1.1 + (p.lift || 0), p.pos.z, e.pos.x, heightAt(e.pos.x, e.pos.z) + 1.1, e.pos.z); }
// the knife action (input/bindings.js 'knife', the prompt button, actors/crew.js while the prompt shows). true: a man was struck
export function quietKnife(){ const p = S.player, now = NOW(), K = Q.knife; if(!afoot(p) || now < QUIET.knifeAt) return false; QUIET.knifeAt = now + K.cd; QUIET.can = null;
  const e = knifeTarget(p); if(!e || !enemies.includes(e) || !clearTo(p, e)){ sfx('whoosh', p.pos, 0.3); return false; }
  const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1; p.vel.x += dx / d * K.lunge; p.vel.z += dz / d * K.lunge; CV.cover = null;   // the lunge
  if(silent(e, p)){ QUIET.stats.knife++; e._knife = true; floatText(SAY.knifeDown, '#9be04a', over(e, 2.3), 17); sfx('thud', e.pos, 0.35); e.hp = 0; killEnemy(e); }   // (his pouch is his: loot/soldier-arms.js armsDrop → ammoPouch, always for a man the knife took)
  else { QUIET.stats.stabs++; e._hx = dx / d; e._hz = dz / d; floatText(SAY.knifeHit, '#ffd86a', over(e, 2.3), 14); sfx('flesh', e.pos, 0.5); damageEnemy(e, K.dmg); }
  return true; }
// actors/crew.js: the mount key while a takedown is on offer is the knife (phones: no new button to lay out). true: the key is spent
export function knifeContext(){ if(!QUIET.can || !(QUIET.can.hp > 0)) return false; quietKnife(); return true; }
// the prompt — a pill over the bottom of the screen, shown only while a takedown is on offer; a button (phones tap it)
let _btn = null;
function knifeUi(on){ if(typeof document === 'undefined' || !_btn && !on) return;
  if(!_btn){ _btn = document.createElement('div'); _btn.id = 'knifeBtn';
    _btn.style.cssText = 'position:fixed;left:50%;bottom:' + Q.btn[MOBILE ? 1 : 0] + 'px;transform:translateX(-50%);z-index:40;display:none;padding:9px 18px;border-radius:999px;' +
      'background:rgba(12,16,10,0.8);border:1.5px solid #9be04a;color:#eaffd0;font:700 14px/1.2 system-ui,sans-serif;letter-spacing:0.04em;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;box-shadow:0 2px 10px rgba(0,0,0,0.45)';
    _btn.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); quietKnife(); }); document.body.appendChild(_btn); }
  const k = keysFor('crew')[0] || keysFor('knife')[0], txt = on ? SAY.knife + (MOBILE || !k ? '' : '  [' + keyLabel(k) + ']') : '';
  if(_btn._t !== txt){ _btn._t = txt; if(on) _btn.textContent = txt; _btn.style.display = on ? 'block' : 'none'; } }

// ---- the bodies: an unalerted man who comes on one (looking that way, or all but stepping on it) — he and the men near him turn suspicious and search from it ----
function bodies(now){ const B = Q.body, L = QUIET.bodies;
  for(let i = L.length - 1; i >= 0; i--){ const b = L[i]; if(now - b.t > (b.life || B.life)){ L.splice(i, 1); continue; } if(b.found) continue;
    for(const o of unitsNear(UGRID.inf, b.x, b.z, B.r, _nb)){ if(!(o.hp > 0) || o.alert >= 2 || o.rise) continue; const dx = b.x - o.pos.x, dz = b.z - o.pos.z, d2 = dx * dx + dz * dz;
      if(d2 > B.r * B.r || d2 > B.near * B.near && Math.abs(wrapAngle(Math.atan2(dx, dz) - o.facing)) > B.cone || !ambushBodySeen(o, b)) continue;   // (AMBUSH 1 a clear line from his eyes to it: never found through a wall)
      found(b, o, now); break; } } }
function found(b, o, now){ const B = Q.body, r2 = B.callR * B.callR; b.found = true; QUIET.stats.found++;
  for(const m of unitsNear(UGRID.inf, o.pos.x, o.pos.z, B.callR, _nb2)){ if(!(m.hp > 0) || m.alert >= 2 || (m.pos.x - o.pos.x) ** 2 + (m.pos.z - o.pos.z) ** 2 > r2) continue; suspectEnemy(m, now, b.x, b.z); m.bodyAt = now; m.suWhy = 'body'; }
  suspectEnemy(o, now, b.x, b.z, 'body'); o.bodyAt = now; floatText(SAY.body, '#ffd86a', over(o, 2.5), 16); sfx('beep', o.pos, 0.5);
  if(S.player && now - QUIET.saidAt > 8){ QUIET.saidAt = now; floatText(SAY.bodyTip, '#ffb35a', S.player.pos, 15); } }

// ---- the alarm ----
// a man who may raise it: he holds a post, or he is searching from a body — never the men of a set piece (an ambush, the general's and the relic's guards)
function sentry(e, now){ return (!!e.guard || now - (e.bodyAt ?? -1e9) < Q.body.searchT) && !e.alert0 && !e.general && !e.genGuard && !e.relicGuard; }
// one extra squad for the place the alarm names: over the field's edge near it, out of his frame — else up out of a hatch he cannot see (campaign/entries.js)
function reinforce(x, z){ const p = S.player, q = edgeEntry(Math.atan2(z, x), 1.2); if(q){ spawnSquad({ x:q.x, z:q.z, how:'edge', alert:true }); return true; }
  const a = Math.atan2(x - p.pos.x, z - p.pos.z);
  for(let k = 0; k < 6; k++){ const b = a + (Math.random() - 0.5) * 1.6, d = 38 + Math.random() * 16, hx = p.pos.x + Math.sin(b) * d, hz = p.pos.z + Math.cos(b) * d; if(!inField(hx, hz, 4) || entrySeen(hx, hz)) continue; hatchEntry(hx, hz, squadTypes(), { alert:true }); return true; }
  return false; }
function raise(e, now){ const A = Q.alarm, p = S.player, x = e.pos.x, z = e.pos.z, r2 = A.r * A.r; QUIET.alarmN++; QUIET.alarmAt = now; QUIET.stats.raised++;
  let siren = !!(e.guard && e.guard.fort); for(let i = 0; i < towers.length && !siren; i++){ const t = towers[i]; siren = !t.falling && !t.gone && (t.x - x) ** 2 + (t.z - z) ** 2 < A.sirenR * A.sirenR; }
  sfx('whistle', e.pos); if(siren) sfx('alarm'); showBanner(SAY.alarm, '#ff5a3a'); floatText(SAY.alarm, '#ff5a3a', p.pos, 20);   // (the banner is shared with the combo counter: said over his head too)
  for(let i = 0; i < enemies.length; i++){ const o = enemies[i]; if(!o.def.inf || !(o.hp > 0) || (o.pos.x - x) ** 2 + (o.pos.z - z) ** 2 > r2) continue; o._al2 = true;   // (the men it alerts do not raise it again)
    alertEnemy(o, now, 'order', p.pos.x + (Math.random() - 0.5) * A.err, p.pos.z + (Math.random() - 0.5) * A.err); }
  const sent = enemies.length < A.maxFoes && dirAlarm(now) && reinforce(x, z); if(sent) QUIET.stats.squads++; radio(sent ? SAY.alarmSquad : SAY.alarmHold); }
// the man about to raise it: a ring on him until he does; dead first → it passes to an alerted sentry close by, or it is silenced
function pending(p, now){ const P = QUIET.pend, A = Q.alarm; if(!P) return;
  if(!(P.e.hp > 0) || !enemies.includes(P.e)){ let nx = null, bd = A.passR * A.passR;
    for(let i = 0; i < enemies.length; i++){ const o = enemies[i]; if(!o.def.inf || !(o.hp > 0) || !(o.alert >= 2) || !sentry(o, now)) continue; const d2 = (o.pos.x - P.x) ** 2 + (o.pos.z - P.z) ** 2; if(d2 < bd){ bd = d2; nx = o; } }
    if(!nx){ QUIET.pend = null; QUIET.stats.silenced++; floatText(SAY.silenced, '#9be04a', p.pos, 16); return; }
    P.e = nx; P.at = Math.max(P.at, now + A.pass); }
  P.x = P.e.pos.x; P.z = P.e.pos.z; if(now >= P.at){ QUIET.pend = null; raise(P.e, now); return; }
  if(now >= P.ring){ P.ring = now + A.ringT; ringPulse(P.e.pos, 0xff5a3a, 2.2); if(!P.said){ P.said = true; floatText(SAY.raise, '#ff7a5a', over(P.e, 2.7), 16); sfx('beep', P.e.pos, 0.6); } } }

// once a frame in battle (game/loop.js); the work is done LOGISTICS.quiet.every s apart: one pass over the enemies (the eye, who has just been alerted), the alarm
//   in hand, the bodies, the takedown on offer
export function updateQuiet(dt, now){ const p = S.player; if(!p || !p.cav || now < QUIET.tickAt) return; QUIET.tickAt = now + Q.every; const A = Q.alarm, E = Q.eye, er2 = E.r * E.r;
  const key = (S.loop || 0) + ':' + (S.stage || 1); if(key !== QUIET.key){ QUIET.key = key; QUIET.alarmN = 0; QUIET.alarmAt = -1e9; QUIET.pend = null; QUIET.bodies.length = 0; }
  let eye = (p.spotUntil || 0) > now ? 2 : 0;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!e.def.inf || !(e.hp > 0)) continue; const al = e.alert >= 2, d2 = (e.pos.x - p.pos.x) ** 2 + (e.pos.z - p.pos.z) ** 2;
    if(eye < 2 && d2 < er2){ const k = al ? 2 : e.alert === 1 || e.det > E.det ? 1 : 0; if(k > eye) eye = k; }
    if(al && !e._al2 && !QUIET.pend && !S.awaitingUpgrade && (e.alWhy === 'see' || e.alWhy === 'shot') && d2 < A.r * A.r && QUIET.alarmN < A.max && now - QUIET.alarmAt > A.cd && sentry(e, now)) QUIET.pend = { e, at:now + A.delay, ring:0, said:false, x:e.pos.x, z:e.pos.z };
    e._al2 = al; }
  QUIET.eye = CV.mounted || CV.dead ? -1 : eye; ambushTick(now);   // (AMBUSH 1 the quiet weapon's note, the guest's last shot)
  pending(p, now); if(now >= QUIET.bodyAt){ QUIET.bodyAt = now + Q.body.every; bodies(now); }
  let can = null; if(afoot(p) && now >= QUIET.knifeAt){ const e = knifeTarget(p); if(e && silent(e, p) && clearTo(p, e)) can = e; } QUIET.can = can; knifeUi(!!can); }
// a new battle, the menu (game/flow.js)
export function clearQuiet(){ QUIET.pend = null; QUIET.bodies.length = 0; QUIET.can = null; QUIET.eye = -1; QUIET.key = ''; QUIET.alarmN = 0; QUIET.alarmAt = -1e9; knifeUi(false); }
