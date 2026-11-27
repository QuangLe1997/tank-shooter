// game/medals.js — MEDAL 2 THE BATTLE'S LEDGER: who killed what and how (his round, his blade, his grenade, his charge — or his mate's, or the squad's),
//   the play-style counts the medals read, the career's experience earned live (a rank-up in the middle of a fight), and the battle's end into the career
//   (config.js MEDALS, the rules in data/medal-rules.js, the toasts and screens in ui/medals-ui.js). Credit is marked on the enemy by the hit that is his
//   (medalShot / medalHit: a few fields on the unit, no allocation) and read when he dies (game/soldier-rank.js soldierKill → medalKill). In co-op the HOST
//   decides every kill: a kill its own judgment gave the guest goes back with the death's event (coop-puppets.js coopHostDeath → medalCreditFor) and the
//   guest counts only that (medalHostWord) — a guest's page never credits itself a kill. Every count is clamped (statCap), kills to perS a second, the
//   battle's experience to xp.cap.
import { MEDALS } from '../../config.js';
import { AMBST, CO, CV, MATE, NEM, PROFILE, S, battleXp, carRank, carRankName, gunsOpenedBy, medalBoardLater, medalCareerAdd, medalCareerClean, medalCreditRead, medalCreditWord, medalLedger, medalLedgerClean,
  medalRankCard, medalTierOf, medalToast, paintChip, saveProfile } from '../hub.js';

const M = () => MEDALS, NOW = () => performance.now() / 1000;
export const MDL = { L:medalLedger(), kr:null, ks:0, kl:0, on:false, done:false, base:0, rank:0, live:0, tiers:{}, lastKill:-9, multiN:0, lastHp:-1, low:0, armed:true, ride:null, rx:0, rz:0,
  kSec:0, kSecT:-9, mateDown:false, mateRev:0, dirty:false, checkAt:0, tPrev:0, last:null, stats:{ marks:0, kills:0, mine:0, mate:0, team:0, dropped:0, words:0, toasts:0, ranks:0 } };
// the career, always valid (a save, a cloud copy: medalCareerClean); the gun he already carries in stays open the first time
export function medalCareer(){ const c = PROFILE.career = medalCareerClean(PROFILE.career, PROFILE.trooperGun); return c; }
export function medalRankNow(){ return MDL.on ? MDL.rank : carRank(medalCareer().xp).r; }
export function medalRankName(){ return carRankName(medalRankNow()); }
// ---- credit marks: by 1 = him, 2 = his co-op mate (the host's judged report); how: gun · blade · nade · trample ----
export function medalHit(e, by, how, d){ if(!e) return; e._mkT = NOW(); e._mkBy = by; e._mkH = how; e._mkD = d || 0; MDL.stats.marks++; }
// combat/lock-on.js: his own round struck (b.reach: the soldier's guns pass their reach; the squad's rounds do not)
export function medalShot(e, b){ const p = S.player; if(!b.reach || !p || !e) return; medalHit(e, 1, 'gun', Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z)); }
const fresh = e => e._mkT && NOW() - e._mkT < M().markT;
// game/coop-puppets.js coopHostDeath (the host, BEFORE the kill is counted): the credit word for a unit the guest killed, 0 for any other
export function medalCreditFor(e){ if(!M().on || !e || !fresh(e) || e._mkBy !== 2) return 0; MDL.stats.words++;
  return medalCreditWord({ how:e._mkH, d:e._mkD, quiet:!!e._mateSilent, elite:!!e.elite, boss:!!e.fortBoss, general:!!e.general }); }
// ---- the battle begins (the first frame in play of a new run / stage / loop) ----
function begin(){ const c = medalCareer(), L = MDL.L; for(const k in L) L[k] = typeof L[k] === 'number' ? 0 : ''; MDL.kr = S.runId; MDL.ks = S.stage || 1; MDL.kl = S.loop || 0; MDL.on = true; MDL.done = false;
  MDL.base = c.xp; MDL.rank = carRank(c.xp).r; MDL.live = 0; MDL.tiers = {}; MDL.lastKill = -9; MDL.multiN = 0; MDL.lastHp = -1; MDL.low = 0; MDL.armed = true; MDL.ride = null;
  MDL.kSec = 0; MDL.kSecT = -9; MDL.mateDown = false; MDL.mateRev = 0; MDL.dirty = false; MDL.tPrev = NOW(); paintChip(); }
// ---- a kill (game/soldier-rank.js soldierKill: every enemy that falls on this page — single player or the co-op host) ----
export function medalKill(e){ if(!M().on || !MDL.on || MDL.done || !e) return; const L = MDL.L; L.total++; MDL.stats.kills++;
  let by = 0, how = '', d = 0; if(fresh(e)){ by = e._mkBy; how = e._mkH; d = e._mkD; } else if(e._knife === true || e._blade === true){ by = 1; how = 'blade'; }
  e._mkT = 0; if(by !== 1){ L.team++; MDL.stats[by === 2 ? 'mate' : 'team']++; MDL.dirty = true; return; }
  const quiet = !!e._quietKill && (how === 'blade' ? e._knife === true && AMBST.seenBy === 0 : how === 'gun');
  let nem = false; if(e.general && NEM.live && NEM.e === e){ const g = PROFILE.nemesis && PROFILE.nemesis.g, r = g && g[NEM.id]; nem = !!(r && r.fled > 0); }
  credit(e, how, d, quiet, !!e.elite, !!e.fortBoss, !!e.general, nem); }
// the guest: the host's word for a death (game/coop-puppets.js coopGuestDeath) — his own kill only when the host says so
export function medalHostWord(e, p){ if(!M().on || !MDL.on || MDL.done) return; const L = MDL.L, c = medalCreditRead(p); L.total++;
  if(!c){ L.team++; MDL.dirty = true; return; } credit(e, c.how, c.d, c.quiet, c.elite, c.boss, c.general, false); }
function credit(e, how, d, quiet, elite, boss, general, nem){ const L = MDL.L, C = M(), now = NOW();
  if(now - MDL.kSecT >= 1){ MDL.kSecT = now; MDL.kSec = 0; } if(++MDL.kSec > C.perS){ MDL.stats.dropped++; L.team++; return; }   // (a sanity bound: more than perS a second is not his)
  MDL.stats.mine++; L.kills++; const def = e && e.def || {}; if(def.air) L.air++; else if(def.inf) L.inf++; else L.veh++;
  if(elite) L.elite++; if(boss) L.boss++; if(general) L.general++; if(nem) L.nemesis++; if(quiet) L.stealth++;
  if(how === 'blade') L.blade++; else if(how === 'nade') L.nade++; else if(how === 'trample') L.trample++;
  else if(how === 'gun' && d >= C.longM){ L.long++; }
  if(how === 'gun' && d > L.longest){ L.longest = Math.round(d); const p = S.player, gi = p && p.guns && p.guns[p.gunIdx]; L.longGun = gi ? gi.id : ''; }
  if(now - MDL.lastKill <= C.multiT) MDL.multiN++; else MDL.multiN = 1; MDL.lastKill = now; if(MDL.multiN >= 3) L.multiX++; if(MDL.multiN > L.multiBest) L.multiBest = MDL.multiN;
  L.streak++; if(L.streak > L.streakBest) L.streakBest = L.streak; MDL.dirty = true; }
// world/pow.js (he freed a camp), game/coop-glue.js (he stood his mate up), campaign/side-missions.js (a side mission won)
export function medalEvent(k){ if(!M().on || !MDL.on || MDL.done) return; const L = MDL.L; if(k === 'save') L.save++; else if(k === 'side') L.side++; MDL.dirty = true; }
// ---- once a frame in battle (game/soldier-rank.js updateRank, host and guest) ----
export function medalTick(){ if(!M().on) return; const p = S.player, now = NOW(); if(S.mode !== 'playing' || !p){ MDL.tPrev = now; return; }
  if(!MDL.on || S.runId !== MDL.kr || (S.stage || 1) !== MDL.ks || (S.loop || 0) !== MDL.kl) begin(); if(MDL.done) return;   // (a new run, stage or loop: a new battle — compared field by field, no string a frame)
  const L = MDL.L, C = M(), dt = Math.min(0.25, Math.max(0, now - MDL.tPrev)); MDL.tPrev = now; L.t += dt;
  // what he takes: a hit ends the clean streak; under lowHp and still alive liveS s later is a near death
  const hp = p.hp, max = p.maxHp || 1; if(MDL.lastHp >= 0 && hp < MDL.lastHp - 0.01 && !p.downed){ L.hits++; L.dmg += MDL.lastHp - hp; L.streak = 0; } MDL.lastHp = hp;
  if(hp <= 0 || p.downed) MDL.low = 0; else { if(MDL.armed && hp / max < C.lowHp){ MDL.low = now; MDL.armed = false; } if(MDL.low && now - MDL.low >= C.liveS){ MDL.low = 0; L.escape++; MDL.dirty = true; }
    if(hp / max > C.reset) MDL.armed = true; }
  // a ride on the xe ôm (any ride with a driver): from climbing on to stepping off, the ground it covered
  const bike = CV.mounted && !CV.trans && CV.H && CV.H.bike; if(bike){ if(!MDL.ride){ MDL.ride = { m:0 }; MDL.rx = p.pos.x; MDL.rz = p.pos.z; }
    const s = Math.hypot(p.pos.x - MDL.rx, p.pos.z - MDL.rz); if(s < 3) MDL.ride.m += s; MDL.rx = p.pos.x; MDL.rz = p.pos.z; }
  else if(MDL.ride){ if(MDL.ride.m >= C.rideM){ L.rides++; L.rideM += Math.round(MDL.ride.m); MDL.dirty = true; } MDL.ride = null; }
  // the guest stood the host up: the host's word is his standing again (the count it showed was nearly full)
  if(CO.live && !CO.host && MATE.on){ if(MDL.mateDown && !MATE.down && MDL.mateRev > 0.6) medalEvent('save'); MDL.mateDown = !!MATE.down; MDL.mateRev = MATE.revive || 0; }
  if(MDL.dirty || now > MDL.checkAt){ MDL.dirty = false; MDL.checkAt = now + 0.5; check(); } }
// new medal tiers this battle → a toast each; the experience so far → the career's rank, live
function check(){ const L = medalLedgerClean(MDL.L);
  for(const d of M().list){ const t = medalTierOf(d, L[d.stat] || 0); if(t > (MDL.tiers[d.id] || 0)){ MDL.tiers[d.id] = t; MDL.stats.toasts++; medalToast(d, t, L[d.stat]); } }
  MDL.live = battleXp(L, '').total; const r = carRank(MDL.base + MDL.live).r;
  if(r > MDL.rank){ const was = MDL.rank; MDL.rank = r; MDL.stats.ranks++; medalRankCard(r, gunsOpenedBy(was, r)); paintChip(); } }
// ---- the battle ends: won · final (the campaign) · lost · quit. The ledger goes into the career, the report opens over the end screen ----
export function medalEnd(outcome){ if(!M().on || !MDL.on || MDL.done) return null; MDL.done = true; if(MDL.ride && MDL.ride.m >= M().rideM){ MDL.L.rides++; MDL.L.rideM += Math.round(MDL.ride.m); } MDL.ride = null;
  const c = medalCareer(), L = Object.assign({}, MDL.L), res = medalCareerAdd(c, L, outcome, L.t); PROFILE.career = c; saveProfile();
  MDL.last = { res, L, outcome, stage:S.stage || 1, score:S.score | 0, t:L.t }; if(outcome !== 'quit') medalBoardLater(MDL.last); return MDL.last; }
// what a probe reads
export function medalProbe(){ return { on:MDL.on, done:MDL.done, stage:MDL.ks, rank:MDL.rank, live:MDL.live, L:Object.assign({}, MDL.L), tiers:Object.assign({}, MDL.tiers), stats:Object.assign({}, MDL.stats), career:medalCareer() }; }
