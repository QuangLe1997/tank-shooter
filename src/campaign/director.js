// campaign/director.js — DIR 1 THE BATTLE'S DIRECTOR: reinforcements, surprises and the finale are released by the STATE of the fight round the player, not by the clock.
//   A few times a second (DIRECTOR.sample — never per frame) it reads the fight: the damage he took lately, his health, how many alerted men are near and how many of
//   them are firing, how long since he was last hit and since the last enemy fell — one PRESSURE value 0…1 (DIR.P, smoothed). The battle then moves through phases:
//   BUILD-UP — the wave's queue is metered (it flows while he has little to do, waits while he is busy; its tail is kept as a reserve); pressure low for a while →
//     ESCALATE (one thing the first time, one more each time it still has not risen): the reserve comes at once, knowing where he is, from where he is NOT looking (his left, his right, behind — over the edge out of the frame or up out of a hatch, campaign/entries.js), named on the radio a
//     moment later; the men who have not found him are told where he is (the hunt closes in); a hostile surprise is played now; the nearest fortress sends its next
//     squad out now. A fortress's sallies (their own clock) wait for a build-up with room for more.
//   PEAK — pressure high for a moment: nothing more is sent in, no surprise is played; it lasts DIRECTOR.peak seconds at most.
//   RELEASE — after a peak, or at once when he is nearly dead: the men in contact go to ground for a few seconds, the queue and the surprises wait out a real lull
//     (DIRECTOR.lull.t), a medkit and ammunition come down when he is badly hurt. Then the build-up again: never two peaks back to back (DIRECTOR.build.min).
//   FINALE — on a field without a citadel the general comes after a last announced lull; in a citadel his coming out grounds the men in contact for a breath.
//   It WRAPS the wave queue (campaign/waves.js), the surprise timer (campaign/surprises.js) and the general's entrance — the same enemies overall, their timing
//   and direction reactive. DIRECTOR.on / ?nodirector: off, it still reads the fight (DIR.P, the peaks it would have called) and decides nothing.
import * as THREE from 'three';
import { DIRECTOR, ENTRY } from '../../config.js';
import { FORTS, PROFILE, S, SURP, WAVE, saveProfile, surpriseNow, camera, duelOn, edgeFrom, enemies, entrySeen, inCamView, inField, isFoot, radio, reliefDrop, storyCue, tacticsReset, tacticsTick, wetAt } from '../hub.js';

const D = DIRECTOR, R2 = a => a[0] + Math.random() * (a[1] - a[0]), sat = x => x < 0 ? 0 : x > 1 ? 1 : x, _v = new THREE.Vector3();
const OFF = typeof location !== 'undefined' && /nodirector/.test(location.search + location.hash);
// what the director knows and has decided (dev/probes read it): P the pressure · phase build | peak | release | finale · stats: what it did this stage
export const DIR = { on:false, phase:'build', P:0, raw:0, hurt:0, hp:1, hp0:0, alerted:0, near:0, firing:0, lowT:0, hiT:0, t0:0, at:0, prev:0, phaseAt:0, lullUntil:0, lullMax:0, escAt:0, escN:0,
  hitAt:-1e9, killAt:-1e9, sayAt:-1e9, dropAt:-1e9, surAt:-1e9, sallyPass:0, heldAt:0, pass:0, bore:0, waveNo:-1, reserve:0, reserveAt:0, resDone:false, fin:0, ease:1, flank:null, cue:null, lastSide:'', contact:[], log:[],
  stats:{ peaks:0, lulls:0, esc:0, flanks:0, pulled:0, intel:0, sallies:0, drops:0, grounded:0, held:0, trickle:0, entries:0, seen:0, fromFlank:0 } };

function note(now, k, why){ const L = DIR.log; if(L.length >= D.logMax) L.shift(); L.push({ t:+(now - DIR.t0).toFixed(1), k, why:why || '', P:+DIR.P.toFixed(2) }); }
function setPhase(ph, now, why){ DIR.phase = ph; DIR.phaseAt = now; DIR.lowT = 0; DIR.hiT = 0; note(now, ph, why); }
const thrHi = () => D.thr.high * DIR.ease, thrLo = () => D.thr.low * DIR.ease;
// one radio line of the director's (sparingly: radio.gap s apart unless it must be heard)
export function dirSay(now, key, must){ const L = D.say[key]; if(!L || !must && now - DIR.sayAt < D.radio.gap) return false; DIR.sayAt = now; if(storyCue('dir_' + key, null, must)) return true; radio(typeof L === 'string' ? L : L[(Math.random() * L.length) | 0]); return true; }   // (STORY 2 the story's own variants of the line, the squad's voices among them)
// DIR 3 the difficulty's row (DIRECTOR.diff): the tier of tactics by stage, the thresholds' multiplier, the head-count multiplier, the awareness knobs' own factors
export function dirDiff(){ return D.diff[PROFILE.difficulty] || D.diff.soldier; }
export function dirCount(){ return dirDiff().count; }
// the thresholds' multiplier now: the difficulty's × the stage's (DIRECTOR.arc: the campaign tightens stage by stage) × the gentle step once he has died adapt.deaths
//   times on this stage (PROFILE.dirEase, kept on this machine until the stage is won).
//   Under 1 everything is kinder: a peak is called (and released) at less pressure, "little to do" asks for less, the lulls are longer, the escalations slower
function easeNow(){ const a = PROFILE.dirEase, A = D.adapt; return dirDiff().ease * D.arc[Math.max(0, Math.min(D.arc.length - 1, (S.stage || 1) - 1))] * (a && a.key === (S.loop || 0) + ':' + (S.stage || 1) && a.deaths >= A.deaths ? A.ease : 1); }
// he has lost a life (game/player-damage.js): counted for this stage; the second one eases the thresholds from here on
export function dirDeath(){ const key = (S.loop || 0) + ':' + (S.stage || 1), a = PROFILE.dirEase && PROFILE.dirEase.key === key ? PROFILE.dirEase : (PROFILE.dirEase = { key, deaths:0 }); a.deaths++; saveProfile(true);
  const e = easeNow(); if(e !== DIR.ease){ DIR.ease = e; note(performance.now() / 1000, 'eased', 'deaths ' + a.deaths + ' → × ' + e.toFixed(2)); } }
// the stage is won (campaign/boss.js): the step is taken back
export function dirWin(){ if(PROFILE.dirEase){ PROFILE.dirEase = null; saveProfile(true); } }
// a stage begins (ui/briefing.js): everything forgotten but the deaths on it
export function directorReset(now){ const st = DIR.stats; for(const k in st) st[k] = 0; DIR.log.length = 0; DIR.contact.length = 0; tacticsReset();
  Object.assign(DIR, { on:D.on && !OFF, phase:'build', P:0, raw:0, hurt:0, hp:1, hp0:S.player ? S.player.hp : 0, alerted:0, near:0, firing:0, lowT:0, hiT:0, t0:now, at:now, prev:now, phaseAt:now, lullUntil:0, lullMax:0,
    escAt:now + D.build.first, escN:0, hitAt:-1e9, killAt:now, sayAt:-1e9, dropAt:-1e9, surAt:-1e9, sallyPass:0, heldAt:0, pass:0, bore:0, waveNo:-1, reserve:0, reserveAt:0, resDone:false, fin:0, ease:easeNow(), flank:null, cue:null, lastSide:'' }); }
// an enemy has fallen (actors/damage.js)
export function dirKill(){ DIR.killAt = performance.now() / 1000; }

// ---- the reading: one pass over the enemies, DIRECTOR.sample s apart ----
function sample(now, dt){ const p = S.player, C = DIR.contact, r2 = D.nearR * D.nearR, a2 = D.airR * D.airR, W = D.w, Rf = D.ref; C.length = 0; let al = 0, near = 0, fire = 0;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i], dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, q = dx * dx + dz * dz;
    if(!e.def.inf){ if(e.def.air && q < a2){ near += 2; fire++; } continue; }                                  // (a helicopter over him is two men's worth of trouble)
    if(e.gaveUp || e.rise || !(e.alert >= 2)) continue; al++; if(q > r2) continue; near++; C.push(e);
    if(now - (e.shotAt || -9) < D.fireT || e.aimT > 0) fire++; }
  DIR.alerted = al; DIR.near = near; DIR.firing = fire; DIR.hp = Math.max(0, p.hp / (p.maxHp || 1));
  const lost = DIR.hp0 - p.hp; DIR.hp0 = p.hp; if(lost > 0.01){ DIR.hurt += lost / (p.maxHp || 1); DIR.hitAt = now; }
  DIR.hurt *= Math.exp(-dt / D.tau.hurt);
  const hpT = sat((1 - DIR.hp - Rf.hp[0]) / (Rf.hp[1] - Rf.hp[0])), stall = near ? sat((now - DIR.killAt - Rf.stall[0]) / (Rf.stall[1] - Rf.stall[0])) : 0, calm = sat((now - DIR.hitAt) / Rf.calm) * (1 - hpT);
  DIR.raw = sat(W.hurt * sat(DIR.hurt / Rf.hurt) + W.hp * hpT + W.near * sat(near / Rf.near) + W.fire * sat(fire / Rf.fire) + W.stall * stall - W.calm * calm);
  DIR.P += (DIR.raw - DIR.P) * (1 - Math.exp(-dt / D.tau.smooth)); }
// off: the peaks it would have called, for the comparison — and nothing done about them
function observe(now, dt){ const hi = thrHi(); if(DIR.phase !== 'peak'){ DIR.hiT = DIR.P >= hi ? DIR.hiT + dt : 0; if(DIR.hiT >= D.thr.hold){ DIR.stats.peaks++; setPhase('peak', now, 'observed'); } }
  else if(DIR.P < hi * D.thr.off) setPhase('build', now, 'observed'); }

// ---- the decisions ----
// the men in contact go to ground for a few seconds: flat where they are, not a shot (actors/infantry.js reads e.groundUntil)
function ground(now, t){ const C = DIR.contact, p = S.player, r2 = D.lull.contactR * D.lull.contactR; let n = 0;
  for(let i = 0; i < C.length; i++){ const e = C[i]; if(e.general || !(e.hp > 0) || (e.pos.x - p.pos.x) ** 2 + (e.pos.z - p.pos.z) ** 2 > r2) continue; e.groundUntil = now + R2(t); e.burstLeft = 0; e.actAt = e.groundUntil; n++; }
  DIR.stats.grounded += n; return n; }
function release(now, why){ const L = D.lull, st = DIR.stats, bad = DIR.hp < D.thr.crit, k = bad ? 1 : Math.random(), len = Math.max(L.t[0], (L.t[0] + (L.t[1] - L.t[0]) * k) / DIR.ease);   // (a harder setting shortens the lull, never under its floor)
  st.lulls++; DIR.bore = 0; setPhase('release', now, why); DIR.lullUntil = now + len; DIR.lullMax = now + len + L.extra; DIR.flank = null; DIR.cue = null; DIR.pass = 0;
  ground(now, L.ground); SURP.next = Math.max(SURP.next || 0, DIR.lullUntil + L.surprise);
  if(DIR.hp < L.drop.hp && now - DIR.dropAt > L.drop.cd){ DIR.dropAt = now; st.drops++; reliefDrop(); dirSay(now, 'drop', true); note(now, 'drop', 'hp ' + DIR.hp.toFixed(2)); }
  else dirSay(now, 'lull', true); }
// where he is not looking: his left, his right or behind him (never the same twice running) — the next flankN entries come from there
function flankFrom(now){ const B = D.build; camera.getWorldDirection(_v); const f = Math.atan2(_v.x, _v.z); let tot = 0, side = 'rear';
  for(const k in B.sides) if(k !== DIR.lastSide) tot += B.sides[k]; let r = Math.random() * tot;
  for(const k in B.sides){ if(k === DIR.lastSide) continue; r -= B.sides[k]; if(r <= 0){ side = k; break; } }
  DIR.lastSide = side; DIR.flank = { a:f + (side === 'left' ? Math.PI / 2 : side === 'right' ? -Math.PI / 2 : Math.PI), side, n:Math.round(R2(B.flankN)), said:false }; return side; }
// the men who do not know where he is are told (their rough report sharpened): up to intelN of them within intelR m march onto him
function intel(){ const p = S.player, B = D.build, r2 = B.intelR * B.intelR; let n = 0;
  for(let i = 0; i < enemies.length && n < B.intelN; i++){ const e = enemies[i]; if(!e.def.inf || e.guard || e.gaveUp || !e.lk || e.alert >= 2 && e.sees || (e.pos.x - p.pos.x) ** 2 + (e.pos.z - p.pos.z) ** 2 > r2) continue;
    e.lk.x = p.pos.x + (Math.random() - 0.5) * B.intelErr; e.lk.z = p.pos.z + (Math.random() - 0.5) * B.intelErr; e.srAt = 0; if(e.alert >= 2) e.lkAt = performance.now() / 1000; n++; }
  return n; }
// the nearest fortress that still sends men out does so now (world/fortress.js sally, its own clock brought forward)
function sallyNow(now){ const p = S.player; let best = null, bd = D.build.sallyR; for(const f of FORTS){ if(f.captured || f.leaderless || f.posture === 'hold' || !f.active) continue; const d = Math.hypot(f.x - p.pos.x, f.z - p.pos.z); if(d < bd){ bd = d; best = f; } }
  if(!best) return false; best.sallyAt = Math.min(best.sallyAt, now + 0.5); DIR.sallyPass = now + 3; return true; }
// he has had little to do for a while: the wave's men from where he is not looking, the hunt, a hostile surprise, a fortress's sally — one of them the first time,
//   one more each time the pressure has still not risen (DIR.bore, at most maxActs), a different one leading each time, whichever the battle has to give
function escalate(now){ const B = D.build, st = DIR.stats; DIR.escAt = now + B.cd; DIR.lowT = 0; DIR.escN++; DIR.bore = Math.min(B.maxActs, DIR.bore + 1);
  const queued = WAVE.active && WAVE.spawnQueue.length > 0, between = !WAVE.active && !S.awaitingUpgrade; let did = '', acts = 0, n = 0;
  for(let k = 0; k < 4 && acts < DIR.bore; k++){ const a = (k + DIR.escN - 1) % 4;
    if(a === 0){ if(queued || between){ did += ' flank-' + flankFrom(now); st.flanks++; acts++; DIR.pass = Math.max(DIR.pass, DIR.flank.n); if(queued) WAVE.spawnAt = Math.min(WAVE.spawnAt, now + 0.3); else WAVE.betweenUntil = Math.min(WAVE.betweenUntil, now + 0.3); } }
    else if(a === 1){ if((n = intel()) >= B.intelMin){ did += ' hunt-' + n; st.intel += n; acts++; dirSay(now, 'hunt'); } }
    else if(a === 2){ if(now - DIR.surAt > B.surCd && (n = surpriseNow(now, true))){ DIR.surAt = now; did += ' surprise-' + n; st.pulled++; acts++; } }
    else if(sallyNow(now)){ did += ' sally'; st.sallies++; acts++; } }
  if(did){ st.esc++; note(now, 'escalate', did.slice(1)); } else DIR.escAt = now + 3; }
function think(now, dt){ const hi = thrHi(), t = now - DIR.phaseAt, crit = DIR.hp < D.thr.crit, st = DIR.stats;
  if(DIR.cue && now >= DIR.cue.at && !radio.jam){ dirSay(now, DIR.cue.side, true); DIR.cue = null; }   // (EVENT 2 the net jammed: the flank's cue is held until it is back)
  if(DIR.heldAt) st.held += dt;
  if(S.awaitingUpgrade) return;                                                                                    // the stage is won: nothing more is sent at him
  if(duelOn()){ if(DIR.fin !== -1){ if(DIR.phase !== 'finale') setPhase('finale', now, 'the general'); else DIR.phaseAt = now; DIR.fin = -1; DIR.flank = null; ground(now, D.finale.ground); } return; }   // (fin: 0 none · > 0 the last lull, until then · −1 the duel is on)
  if(DIR.phase === 'finale'){ if(DIR.fin === -1){ DIR.fin = 0; setPhase('build', now, 'the duel is over'); } return; }   // (fin > 0: waves.js asks dirFinale when he may come)
  if(DIR.phase === 'build'){ const busy = DIR.P >= D.build.meter * DIR.ease; if(busy) DIR.bore = 0;   // (little to do: the clock runs in full; something but not much: at midK; busy: it runs back)
    DIR.lowT = DIR.P < thrLo() ? DIR.lowT + dt : busy ? Math.max(0, DIR.lowT - dt * 2) : DIR.lowT + dt * D.build.midK; DIR.hiT = DIR.P >= hi ? DIR.hiT + dt : 0;
    if(crit && now - DIR.hitAt < D.thr.critT){ release(now, 'nearly dead'); return; }                             // nearly dead: no peak is asked of him — the release at once
    if(DIR.hiT >= D.thr.hold && t >= D.build.min){ st.peaks++; setPhase('peak', now, 'pressure'); if(Math.random() < D.radio.peakP) dirSay(now, 'peak'); return; }
    if(DIR.lowT >= D.build.escalate / DIR.ease && now >= DIR.escAt) escalate(now);
    return; }
  if(DIR.phase === 'peak'){ if(crit || t >= D.peak.max || t >= D.peak.min && DIR.P < hi * D.thr.off) release(now, crit ? 'nearly dead' : t >= D.peak.max ? 'a long peak' : 'pressure fell'); return; }
  if(now >= DIR.lullUntil){                                                                                        // release: the lull runs out
    if(DIR.P >= hi && now < DIR.lullMax){ DIR.lullUntil = now + 2; ground(now, D.lull.ground); return; }           // (still under heavy fire: a little longer, and down they go again)
    setPhase('build', now, 'the lull is over'); DIR.escAt = now + D.build.cd * 0.5; if(DIR.near && Math.random() < D.radio.buildP) dirSay(now, 'build'); } }
// once a frame in battle (game/loop.js); the work is done DIRECTOR.sample s apart
export function updateDirector(dt, now){ const p = S.player; if(!p || now < DIR.at) return; const sdt = Math.min(1, now - DIR.prev); DIR.prev = now; DIR.at = now + D.sample;
  sample(now, sdt); if(DIR.on) think(now, sdt); else observe(now, sdt); tacticsTick(now, sdt); }   // (DIR 2 the tier tactics' own slow tick: the grenade that flushes him, the radio's first sighting of a machine gun)

// ---- what the waves, the surprises and the general ask ----
// must the wave's queue wait? (peak, release, the last lull — or he simply has enough on his hands; in the build-up a held queue still lets a few through every holdMax s)
export function dirWaveHold(now){ if(!DIR.on) return false; const ph = DIR.phase, B = D.build;
  if(S.wave !== DIR.waveNo){ DIR.waveNo = S.wave; DIR.reserve = Math.floor(WAVE.spawnQueue.length * B.reserve); DIR.reserveAt = now + B.reserveMax; DIR.resDone = false; }   // a new wave: its tail (the set piece with it) is the director's reserve
  if(!DIR.resDone && now >= DIR.reserveAt){ DIR.resDone = true; if(ph === 'build' && !DIR.flank){ flankFrom(now); note(now, 'reserve', 'flank-' + DIR.flank.side); } }                    // (nobody asked for it in reserveMax s: it comes anyway, round a flank)
  const hold = ph === 'peak' || ph === 'release' || (ph === 'finale' ? DIR.fin > 0 || now - DIR.phaseAt < D.finale.quiet || DIR.P >= B.meter * DIR.ease : DIR.P >= B.meter * DIR.ease);
  if(!hold){ DIR.heldAt = 0; return DIR.pass <= 0 && ph === 'build' && WAVE.spawnQueue.length <= DIR.reserve && now < DIR.reserveAt; }   // (the reserve waits for an escalation's pass)
  if(DIR.pass > 0 && (ph === 'build' || ph === 'finale')) return false;
  if(!DIR.heldAt) DIR.heldAt = now;
  if(ph !== 'peak' && ph !== 'release' && now - DIR.heldAt > B.holdMax){ DIR.pass = B.group; DIR.heldAt = 0; DIR.stats.trickle++; note(now, 'trickle', 'held ' + B.holdMax + ' s'); return false; }
  return true; }
// may the next wave begin — or, the last one done, may waves.js ask for the general (dirFinale)? (not in a peak, not in a lull; the last lull itself is asked about)
export function dirWaveGo(now){ return !DIR.on || DIR.phase === 'build' || DIR.phase === 'finale' && DIR.fin > 0; }
// may a fortress send a squad out of its gate now? (world/fortress.js: its sallies ran on a clock of their own) — only in a build-up with room for more
export function dirSallyOk(now){ return !DIR.on || now < DIR.sallyPass || DIR.phase === 'build' && DIR.P < D.build.meter * DIR.ease; }
// in a lull every rifleman's rests between bursts are this much longer (actors/infantry.js): the fire slackens for as long as the lull lasts
export function dirFireK(){ return DIR.on && DIR.phase === 'release' ? D.lull.fireK : 1; }
// may a surprise be played now? (never on top of a peak or in a lull; in the duel only once it has run a while)
export function dirSurpriseOk(now){ if(!DIR.on) return true; const hi = thrHi();
  return DIR.phase === 'build' ? DIR.P < hi * D.thr.off : DIR.phase === 'finale' && DIR.fin < 0 && now - DIR.phaseAt > D.finale.quiet && DIR.P < hi * D.thr.off; }
// EVENT 1 may a side mission be offered now (campaign/side-missions.js)? In a build-up with room for more — where a release ends too — never in a peak, a lull,
//   the last lull or the duel, never while he is nearly dead
export function dirOfferOk(now){ if(duelOn() || DIR.fin || S.awaitingUpgrade) return false; return !DIR.on || DIR.phase === 'build' && DIR.P < D.build.meter * DIR.ease && DIR.hp >= D.thr.crit; }
// EVENT 2 may a big battlefield event begin now (campaign/big-events.js)? Only where a surprise may (a build-up under the peak's threshold), never in the last lull
//   or the duel, never while his health is under hpMin (nearly dead at the least)
export function dirEventOk(now, hpMin){ if(duelOn() || DIR.fin || S.awaitingUpgrade) return false; return dirSurpriseOk(now) && DIR.hp >= Math.max(hpMin || 0, D.thr.crit); }
// the last wave is done on a field without a citadel: the general comes after one last lull, announced. true: now
export function dirFinale(now){ if(!DIR.on) return true;
  if(!(DIR.fin > 0)){ DIR.fin = now + D.finale.lull / DIR.ease; setPhase('finale', now, 'the last lull'); DIR.flank = null; ground(now, D.finale.ground); dirSay(now, 'finale', true); return false; }
  return now >= DIR.fin; }
// the way in the director wants for the next man or squad of the wave (type t), or null: its own. Over the field's edge on the bearing he is not looking along when
//   that is out of the frame and neither too near nor too far; else up out of a hatch on that bearing, out of the frame
export function dirEntry(t){ const F = DIR.flank, p = S.player, B = D.build; if(!DIR.on || !F || F.n <= 0 || !p || t !== 'squad' && !isFoot(t)) return null; let q = null;
  for(let k = 0; k < 4 && !q; k++){ const e = edgeFrom(p.pos.x, p.pos.z, F.a + (Math.random() - 0.5) * B.spread * (1 + k * 0.4)); if(e && e.d >= ENTRY.minD && e.d <= B.maxD && !wetAt(e.x, e.z, 3) && !entrySeen(e.x, e.z)) q = e; }
  for(let k = 0; k < 5 && !q; k++){ const a = F.a + (Math.random() - 0.5) * B.spread, d = R2(B.hatchD), x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; if(inField(x, z, 4) && !wetAt(x, z, 3) && !inCamView(x, z)) q = { x, z, hatch:true }; }
  if(!q) return null; F.n--; DIR.stats.fromFlank++; q.dir = F.side; q.alert = true;   // (they come knowing where he is: a flank that wanders off looking for him is no flank)
  if(!F.said){ F.said = true; DIR.cue = { at:performance.now() / 1000 + B.cueT, side:F.side }; }   // the radio names the side a moment after the first of them is on the field
  return q; }
// one entry of the wave has been made at sp (waves.js): counted, and checked — an edge entry inside the frame would be a pop-in
export function dirSpawned(sp){ const st = DIR.stats; st.entries++; if(DIR.pass > 0) DIR.pass--; if(sp && !sp.hatch && sp.how === 'edge' && entrySeen(sp.x, sp.z)) st.seen++; }
