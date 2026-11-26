// net/rules.js — COOP 4 THE RULES BOTH PAGES MUST AGREE ON, AS PLAIN FUNCTIONS (they run in Node: tools/coop-test.mjs): the cue codes, whether two machines can
// build the same battlefield, the seed in the address, a hit report's parameter, which of the two players an enemy regards, and going down / being stood up again
import { AMBUSH, BLADE, COOP, COOP2, LOGISTICS } from '../../config.js';
import { NET_EV } from './protocol.js';

export const NET_CUE = COOP.cue;
// ---- the lobby: can these two pages build the same land? mine / theirs = { mobile, arena, quality }. '' = yes · 'mobile' (a phone with a desktop: the field's size
//   and half the world's builders branch on it) · 'arena' (another field size) — both refuse the battle; 'quality' only warns (it changes what is drawn)
export function coopLobbyClash(mine, theirs){ if(!mine || !theirs) return ''; if(theirs.mobile != null && !!mine.mobile !== !!theirs.mobile) return 'mobile';
  if(theirs.arena != null && (mine.arena | 0) !== (theirs.arena | 0)) return 'arena'; if(theirs.quality != null && String(mine.quality) !== String(theirs.quality)) return 'quality'; return ''; }
export function coopClashFatal(code){ return code === 'mobile' || code === 'arena'; }
// the page's address with seed=N set (the seed is read before any module runs — boot/safety.js — so a page that must change it reloads at this address)
export function coopSeedUrl(href, seed){ const s = String(href || ''), h = s.indexOf('#'), hash = h >= 0 ? s.slice(h) : '', base = h >= 0 ? s.slice(0, h) : s, q = base.indexOf('?'), path = q >= 0 ? base.slice(0, q) : base;
  const parts = (q >= 0 ? base.slice(q + 1) : '').split('&').filter(p => p && !/^seed=/.test(p)); parts.push('seed=' + ((+seed >>> 0) || 1)); return path + '?' + parts.join('&') + hash; }
// a 32-bit score in a CUE's two 16-bit fields
export function coopScoreAB(score){ const v = Math.max(0, Math.min(0xffffffff, Math.round(+score || 0))); return [v & 0xffff, (v >>> 16) & 0xffff]; }
export function coopScoreOf(a, b){ return ((b & 0xffff) * 65536) + (a & 0xffff); }
// ---- a hit the guest reports: HIT a = who fired (COOP.ids.guest), b = the enemy's id, x / z = the way the round flew (a unit vector), y = the weapon's index / 100,
//   p = damage × 10 in 15 bits (≤ 3276.7) + bit 15 = a heavy round (it throws the man). The host caps what one report may take (COOP.puppet.hitMax).
export function coopHitP(dmg, heavy){ const v = Math.round((+dmg || 0) * 10); return (v > 32767 ? 32767 : v > 0 ? v : 0) | (heavy ? 0x8000 : 0); }
export function coopHitOf(p, out){ out = out || {}; out.dmg = Math.min(COOP.puppet.hitMax, (p & 0x7fff) / 10); out.heavy = !!(p & 0x8000); return out; }
// ---- which of the two players an enemy soldier regards on the host: 0 = the host's soldier, 1 = the guest's. A man who is down is nobody's target while the other
//   stands; the one regarded is kept until the other is `stick` × nearer (so a man does not flick between two players the same distance off)
export function coopFocusPick(cur, dHost, dGuest, hostDown, guestDown, stick){ if(guestDown && !hostDown) return 0; if(hostDown && !guestDown) return 1;
  const k = stick == null ? COOP.focus.stick : stick; if(cur === 1) return dHost < dGuest * k ? 0 : 1; return dGuest < dHost * k ? 1 : 0; }
// ---- down and up again. D = { on, k, lost } (makeCoopDown()). A player at no health: coopDownEnter(D, mate) → 'down' (the other stands: he crawls and waits),
//   'lost' (the other is down too, or nobody is there to stand him up: mate.present false → 'alone', the single-player death takes over).
//   Every frame while down: coopDownStep(D, dt, mate) with mate = { present, down, dist (m) } → '' | 'up' (stood up: the caller gives him hpK of his health) |
//   'lost' (the other went down too) | 'alone' (the other left). D.k = 0–1 how far the other has got with it (both pages show it).
export function makeCoopDown(){ return { on:false, k:0, lost:false }; }
export function coopDownEnter(D, mate){ D.k = 0; if(!mate || !mate.present){ D.on = false; return 'alone'; } if(mate.down){ D.on = true; D.lost = true; return 'lost'; } D.on = true; D.lost = false; return 'down'; }
export function coopDownStep(D, dt, mate){ if(!D.on) return ''; const C = COOP.down;
  if(!mate || !mate.present){ D.on = false; D.k = 0; return 'alone'; } if(mate.down){ D.lost = true; return 'lost'; }
  if(mate.dist <= C.r) D.k = Math.min(1, D.k + dt / C.reviveS); else D.k = Math.max(0, D.k - dt / C.reviveS * C.decay);
  if(D.k >= 1){ D.on = false; D.k = 0; return 'up'; } return ''; }
// what the OTHER page shows meanwhile (it sees only his DOWNED flag and where he lies): the same count, kept by the same rule
export function coopReviveShow(k, dt, dist, mateDown){ const C = COOP.down; if(!mateDown) return 0; return dist <= C.r ? Math.min(1, k + dt / C.reviveS) : Math.max(0, k - dt / C.reviveS * C.decay); }
// ---- a grenade in the air (GRENADE): a / b = where it left the hand (x, z as centimetres + 32768 in the event's two 16-bit fields), x / z = where it comes down,
//   y = how high its arc goes (m), p = its flight time in ms
export function coopU16M(m){ const v = Math.round((+m || 0) * 100) + 32768; return v > 65535 ? 65535 : v > 0 ? v : 0; }
export function coopMU16(a){ return ((a & 0xffff) - 32768) / 100; }
// ---- an explosion (EXPLOSION): x, y, z = where, a = its colour's upper 16 bits, b = the lower 8, p = its size × 100
export function coopBlastAB(color){ const c = (color >>> 0) & 0xffffff; return [c >>> 8, c & 0xff]; }
export function coopBlastColor(a, b){ return ((a & 0xffff) << 8) | (b & 0xff); }

// ================= COOP 7 WHO MAY SAY WHAT: the host is the authority, the guest's word is checked =================
// May an event of this kind, with these fields, be acted on by the page that RECEIVED it? recvIsHost = it came from the guest. From the guest the host takes
// only a hit report against an enemy id and "I stand at the gate of stage b"; never a hit on a player, a death, a blast, a score, a wave, a stage won or lost,
// down or up. From the host the guest takes every kind, with its numbers in range. Anything else is dropped (counted, never thrown).
export function coopEventAllowed(recvIsHost, type, a, b, p){ const C = NET_CUE, T = COOP.trust, first = COOP.ids.firstEntity, G = COOP.ids.guest, stage = v => v >= 1 && v <= T.stageMax;
  if(type >= NET_EV.BLOCK && type <= NET_EV.STATE) return coopWorldAllowed(recvIsHost, type, a, b, p);   // COOP 9 the shared world's events: their own table below
  if(recvIsHost){ if(type === NET_EV.HIT) return a === G && b >= first; if(type === NET_EV.CUE) return p === C.GATE && a === G && stage(b); return false; }
  if(type === NET_EV.HIT) return b === G && a !== G; if(type === NET_EV.DEATH) return a >= first; if(type === NET_EV.EXPLOSION) return p >= 1; if(type === NET_EV.GRENADE) return p >= 1 && p <= T.nadeMs;
  if(type === NET_EV.MARK) return a === 0 || a === 1; if(type === NET_EV.RADIO || type === NET_EV.SHOT) return true;
  if(type === NET_EV.CUE){ if(p === C.GATE || p === C.GO) return stage(b); if(p === C.WON) return stage(a); return p === C.LOST || p === C.SCORE || p === C.WAVE || p === C.PHASE || p === C.UP || p === C.DOWN; }
  return false; }
// ---- the host's judgment of a guest's hit report. TR = makeCoopTrust() (the rate buckets, the weapons his state named, counters).
//   q = { now (s), dmg, heavy, weapon (the index the report names), enemyAlive, dist (m: where he last said he was → the enemy), gunDmg (one round of that
//   weapon in the HOST's own table), gunRange (m, the host's own), gunHeavy (that weapon fires heavy rounds), guestDown } → out { ok, dmg, heavy, why }:
//   ok false = dropped (why: 'down' 'no-enemy' 'no-damage' 'weapon' 'range' 'rate'); else dmg is what the host takes off — the report's, cut to the weapon's most
export function makeCoopTrust(){ const T = COOP.trust; return { tok:T.hitsPerS, heavyTok:T.heavyBurst, at:-1, w:[-1, -1], ok:0, dropped:0, clamped:0, why:'' }; }
export function coopTrustWeapon(TR, w){ if(TR.w[0] !== w){ TR.w[1] = TR.w[0]; TR.w[0] = w; } }   // (the last two: a report may cross a change of weapon)
export function coopJudgeHit(TR, q, out){ const T = COOP.trust; out = out || {}; out.ok = false; out.dmg = 0; out.heavy = false; out.why = '';
  if(TR.at >= 0){ const dt = Math.max(0, Math.min(5, q.now - TR.at)); TR.tok = Math.min(T.hitsPerS, TR.tok + dt * T.hitsPerS); TR.heavyTok = Math.min(T.heavyBurst, TR.heavyTok + dt * T.heavyPerS); } TR.at = q.now;
  let why = ''; if(q.guestDown) why = 'down'; else if(!q.enemyAlive) why = 'no-enemy'; else if(!(q.dmg > 0) || !isFinite(q.dmg)) why = 'no-damage'; else if(q.weapon !== TR.w[0] && q.weapon !== TR.w[1]) why = 'weapon';
  else if(!(q.dist <= Math.max(T.rangeMin, (q.gunRange || 0) * T.rangeK))) why = 'range'; else if(TR.tok < 1) why = 'rate';
  if(why){ TR.dropped++; TR.why = out.why = why; return out; } TR.tok -= 1;
  let heavy = !!q.heavy, cap = Math.max(T.dmgMin, (q.gunDmg || 0) * T.dmgK);
  if(heavy && !q.gunHeavy){ if(TR.heavyTok >= 1) TR.heavyTok -= 1; else heavy = false; }   // (a grenade, the knife, a trample: a few a second, no more)
  if(heavy) cap = Math.max(cap, T.heavyDmg); let dmg = q.dmg; if(dmg > cap){ dmg = cap; TR.clamped++; }
  out.ok = true; out.dmg = dmg; out.heavy = heavy; TR.ok++; return out; }
// ---- AMBUSH 1–2 A GUEST'S BLADE CUT. Nothing the guest says decides anything: his report names a man and a move and says where he stood — no damage, no "he did not
//   see me", no health. THE REPORT (a HIT from the guest, through coopEventAllowed like any hit): a = his id, b = the man, x / z = where he says he stood,
//   y = (AMBUSH.net.w + 64 × the move's code) / 100 — the weapon number's low 6 bits are the blade's (no gun's), p = the way the cut throws the man (0–65535 a turn; looks only).
//   The move's code = the kind's place in BLADE.kinds × 8 + its slot (0–2 the lights, 3 heavy, 4 run, 5 special, 6 counter) + 32 when it was struck tired.
//   THE FACTS are the HOST's (coopBladeFacts): man = its own record of the enemy { alive, hp, maxHp, x, z, facing, alert (undefined: no soldier's awareness), general,
//   commander, elite, hitCap }, mate = its own record of the guest { x, z (his last smoothed, authoritative place), bladeAt (s: when the host first saw the blade's stance
//   bit of this draw, < 0: not up), down }, claim = { x, z } from the report → q { now, code, enemyAlive, enemyHp, enemyMaxHp, guestDown, dist (the HOST's place for him →
//   the man), claimOff (m between what he claims and the host's record), bladeFor (s the bit has been up), unaware, outside (his front, by the HOST's place for him), big, capped }.
//   THE JUDGMENT (coopJudgeBlade) → out { ok, dmg, why, ambush, hush, sever }: dropped ('down' · 'no-enemy' · 'move' an unknown code · 'weapon' the bit not up for
//   BLADE.draw s · 'position' the claim further than net.posTol from the host's record · 'range' further than the move reaches × reachK + the dash-in + slack · 'rate'
//   the blade's own bucket: net.perS a second, net.burst at once — not the rifle's 40); else dmg = that move's damage in the HOST's table (× tiredDmg), cut to
//   BLADE.hit.gen × his most for a general / a capped man; ambush (the one cut kills) only for a man who does not know, struck from outside his front, neither big nor capped.
export const coopBladeW = () => AMBUSH.net.w;
const B_KINDS = Object.keys(BLADE.kinds), B_SLOT = ['light', 'light', 'light', 'heavy', 'run', 'special', 'counter'], _bm = {}, wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));
export function coopBladeY(code){ return (AMBUSH.net.w + 64 * (code & 63)) / 100; }
export function coopBladeCode(wy){ return Number.isInteger(wy) && wy >= 0 && wy < 4096 && (wy & 63) === AMBUSH.net.w ? wy >> 6 : -1; }   // (−1: not the blade's)
export function coopBladeCodeOf(kind, mv, tired){ const ki = B_KINDS.indexOf(kind), M = ki >= 0 && ki < 4 ? BLADE.kinds[kind].moves : null; if(!M || !mv) return -1; let s = M.light.indexOf(mv); if(s > 2) return -1;
  if(s < 0) s = mv === M.heavy ? 3 : mv === M.run ? 4 : mv === M.special ? 5 : mv === M.counter ? 6 : -1; return s < 0 ? -1 : ki * 8 + s + (tired ? 32 : 0); }
export function coopBladeMove(code, out){ out = out || {}; out.mv = null; if(!Number.isInteger(code) || code < 0 || code > 63) return null; const K = BLADE.kinds[B_KINDS[(code & 31) >> 3]], s = code & 7; if(!K || s > 6) return null;
  const mv = s < 3 ? K.moves.light[s] : K.moves[B_SLOT[s]]; if(!mv || !(mv.dmg > 0)) return null; out.mv = mv; out.kind = K; out.tired = !!(code & 32); return out; }
export function coopBladeFacts(q, now, code, man, mate, claim){ q.now = now; q.code = code; q.enemyAlive = !!(man && man.alive); q.enemyHp = man ? +man.hp || 0 : 0; q.enemyMaxHp = man ? +man.maxHp || q.enemyHp : 0; q.guestDown = !mate || !!mate.down;
  q.dist = man && mate ? Math.hypot(man.x - mate.x, man.z - mate.z) : NaN; q.claimOff = mate && claim ? Math.hypot(claim.x - mate.x, claim.z - mate.z) : NaN; q.bladeFor = mate && mate.bladeAt >= 0 ? now - mate.bladeAt : -1;
  q.unaware = !!(man && man.alert !== undefined && man.alert < 2); q.outside = !!(man && mate) && Math.abs(wrapPi(Math.atan2(mate.x - man.x, mate.z - man.z) - (+man.facing || 0))) > LOGISTICS.quiet.knife.front;
  q.big = !!(man && (man.general || man.commander || man.elite)); q.capped = !!(man && (man.general || man.hitCap)); return q; }
export function coopJudgeBlade(TR, q, out){ const N = AMBUSH.net, BQ = BLADE.quiet; out = out || {}; out.ok = false; out.dmg = 0; out.heavy = false; out.why = ''; out.ambush = false; out.hush = false; out.sever = '';
  const Bk = TR.blade || (TR.blade = makeCoopBucket(N.perS, N.burst)), M = coopBladeMove(q.code, _bm); let why = '';
  if(q.guestDown) why = 'down'; else if(!q.enemyAlive) why = 'no-enemy'; else if(!M) why = 'move'; else if(!(q.bladeFor >= BLADE.draw)) why = 'weapon'; else if(!(q.claimOff <= N.posTol)) why = 'position';
  else if(!(q.dist <= (M.mv.reach || M.kind.reach) * N.reachK + BQ.dashR + N.slack)) why = 'range'; else if(!coopBucketTake(Bk, q.now)) why = 'rate';
  if(why){ TR.dropped++; TR.why = out.why = why; return out; }
  let dmg = M.mv.dmg * (M.tired ? BLADE.stamina.tiredDmg : 1); if(q.capped) dmg = Math.min(dmg, (q.enemyMaxHp || q.enemyHp || 0) * BLADE.hit.gen);
  out.ambush = !!(AMBUSH.on && BQ.on && BQ.ambush && q.unaware && q.outside && !q.big && !q.capped); if(out.ambush) dmg = Math.max(dmg, (q.enemyHp || 0) + 1); out.hush = !!(AMBUSH.on && BQ.on && q.unaware && dmg >= (q.enemyHp || 0));
  out.ok = true; out.dmg = dmg; out.sever = M.mv.sever || 'waist'; TR.ok++; return out; }
// ---- the host's own ledger of the guest's health (he is DOWN when the HOST says so). led = the ledger, rep = what his state reports, max = his most
//   (already cut to COOP.trust.hpMax): it falls with his report at once (he may hurt himself: a fall, lava) and rises no faster than healPerS; hold = inside the
//   syncS after the host hurt him or stood him up, when a report may still be the staler one → the ledger does not move
export function coopLedger(led, rep, max, dt, hold){ const T = COOP.trust; rep = Math.max(0, Math.min(max, rep)); if(led < 0) return rep; if(hold) return Math.min(led, max); return rep < led ? rep : Math.min(rep, led + T.healPerS * dt, max); }

// ================= COOP 9 ONE SHARED WORLD · THE PING · THE DIRECTOR FOR TWO · A MAGAZINE THROWN (numbers: config COOP2) =================
// The events (type · host → guest · guest → host):
//   BLOCK  a = the block's id (its place in the build order + 1: both pages built the same list — the fingerprint says so), b = 1 gone | 2 p is what is left of
//          it (0–65535 = none–all of its health), else p = the damage in whole points · a = guest, b = the block's id, y = his weapon's index / 100, p = damage × 10 (a REPORT)
//   GUARD  a = the tower's id, b = which guard (+ 16: he rides the fall and lives), x / z = the way he is thrown · a = guest, b = tower id × 16 + guard (a REPORT)
//   SHOT   a = the tower's id, b = which guard, x y z = his muzzle, p = the round's bearing (0–65535 a turn) · (never from the guest)
//   LOOT   p = COOP2.lootOp: DROP a = the pick-up's id, b = what it is (10 bits: coopLootCode) + its height × 4 << 10 + 32768 stashed, x z = where it is, y = its
//          climb (m/s), p's upper bits = its flight (bearing in 128ths of a turn << 4, speed × 4 << 11) · TAKEN a = id, b = who ·
//          GONE a = id · CRATE a = the crate's id, x z · OPEN a = id · from the guest ASK / ASKCRATE a = guest, b = id · NEED a = guest ("I am short of rounds")
//   PING   a = who, b = kind (0 place, 1 enemy, 2 loot), x y z = where, p = the enemy's / pick-up's id (0 = none) — both ways
//   GIVE   a = who throws, b = rounds, p = the ammunition class's index (LOGISTICS.start's order), x z = where he stands — both ways
//   STATE  a = COOP2.stateOp.CORE, b = the Core's health, p = its most · (never from the guest)
export const NET_LOOT = COOP2.lootOp, NET_STATE = COOP2.stateOp;
const AMMO_CLS = Object.keys(LOGISTICS.start);
export function coopAmmoIdx(c){ return AMMO_CLS.indexOf(c); }
export function coopAmmoCls(i){ return AMMO_CLS[i] || ''; }
// the gate for those types (coopEventAllowed sends them here): from the guest only a report or a request with his own id on it — what it asks for is judged after
function coopWorldAllowed(host, type, a, b, p){ const E = NET_EV, G = COOP.ids.guest, L = NET_LOOT, W = COOP2, id = v => v >= 1 && v <= 65535, give = () => b >= 1 && b <= W.give.maxRounds && p >= 0 && p < AMMO_CLS.length;
  if(host){ if(type === E.BLOCK) return a === G && id(b); if(type === E.GUARD) return a === G && b >= 0 && b <= 65535;
    if(type === E.LOOT) return a === G && (p === L.NEED || ((p === L.ASK || p === L.ASKCRATE) && id(b)));
    if(type === E.PING) return a === G && b >= 0 && b < W.ping.kinds; if(type === E.GIVE) return a === G && give(); return false; }   // (STATE: the Core's health is the host's to say)
  if(type === E.BLOCK) return id(a) && b >= 0 && b <= 3; if(type === E.GUARD) return id(a) && b >= 0 && b < 32;
  if(type === E.LOOT){ const op = p & 15; return id(a) && (op === L.DROP || (p < 16 && (op === L.TAKEN || op === L.GONE || op === L.CRATE || op === L.OPEN))); }   // (a DROP's upper bits: its flight)
  if(type === E.PING) return a === COOP.ids.host && b >= 0 && b < W.ping.kinds; if(type === E.GIVE) return a === COOP.ids.host && give();
  if(type === E.STATE) return a === NET_STATE.CORE && b >= 0 && p >= 1; return false; }
// ---- a rate: perS a second, `burst` at once ----
export function makeCoopBucket(perS, burst){ return { tok:burst, perS, burst, at:-1, ok:0, dropped:0 }; }
export function coopBucketTake(B, now){ if(B.at >= 0){ const dt = Math.max(0, Math.min(10, now - B.at)); B.tok = Math.min(B.burst, B.tok + dt * B.perS); } B.at = now; if(!(B.tok >= 1)){ B.dropped++; return false; } B.tok -= 1; B.ok++; return true; }
// the host's memory for judging what the guest asks of the shared world (one a battle)
export function makeCoopWorldTrust(){ const W = COOP2; return { block:makeCoopBucket(W.block.perS, W.block.perS), loot:makeCoopBucket(W.loot.asksPerS, W.loot.asksPerS), guard:makeCoopBucket(W.guard.perS, W.guard.perS),
  ping:makeCoopBucket(W.ping.perS, W.ping.burst), give:makeCoopBucket(W.give.perS, W.give.burst), ok:0, dropped:0, why:'' }; }
// ---- a guest's round on a block: q = { now, dmg, weaponOk (his state named that weapon), alive (the host still has the block), dist (m from where he said he
//   was to its edge), gunDmg, gunRange (the host's own table), guestDown } → out { ok, dmg, why }: dropped ('down' 'no-block' 'no-damage' 'weapon' 'range'
//   'rate') or taken with its damage cut to what such a gun could do to a structure
export function coopJudgeBlock(WT, q, out){ const B = COOP2.block; out = out || {}; out.ok = false; out.dmg = 0; let why = '';
  if(q.guestDown) why = 'down'; else if(!q.alive) why = 'no-block'; else if(!(q.dmg > 0) || !isFinite(q.dmg)) why = 'no-damage'; else if(!q.weaponOk) why = 'weapon';
  else if(!(q.dist <= Math.max(B.rangeMin, (q.gunRange || 0) * B.rangeK))) why = 'range'; else if(!coopBucketTake(WT.block, q.now)) why = 'rate';
  out.why = WT.why = why; if(why){ WT.dropped++; return out; } WT.ok++; out.ok = true; out.dmg = Math.min(q.dmg, Math.max(B.dmgMin, (q.gunDmg || 0) * B.dmgK)); return out; }
// may the guest have what he asks for (a pick-up, the crate, a round on a tower guard): q = { now, alive, dist, guestDown }, r = the reach → '' yes, else why
export function coopJudgeNear(WT, bucket, q, r){ const why = q.guestDown ? 'down' : !q.alive ? 'gone' : !(q.dist <= r) ? 'range' : !coopBucketTake(bucket, q.now) ? 'rate' : ''; WT.why = why; if(why) WT.dropped++; else WT.ok++; return why; }
// what the host sends of a damaged block: what is left of it when it keeps a plain health (frac), else the damage itself (whole points: the host keeps the rest for the next one)
export function coopBlockP(frac, v){ return frac ? Math.max(0, Math.min(65535, Math.round(v * 65535))) : Math.max(1, Math.min(65535, Math.round(v))); }
// ---- THE PING ----
// the clock bearing of a point (dx, dz from the listener) for one who looks along yaw (the game's angles: forward = (sin yaw, cos yaw), his right hand = −x when he looks along +z): 12 = dead ahead, 3 = to his right
export function coopClock(dx, dz, yaw){ const rel = Math.atan2(dx, dz) - (yaw || 0); let h = Math.round(-rel / (Math.PI / 6)) % 12; if(h < 0) h += 12; return h || 12; }
export function coopPingText(kind, clock, dist){ const Y = COOP2.ping.say; return String(Y[kind] || Y[0]).replace('{h}', clock).replace('{d}', Math.max(5, Math.round((+dist || 0) / 5) * 5)); }
// one player's pings (oldest first): a new one in, the oldest out past `max` → the one dropped, or null
export function coopPingPush(list, ping, max){ list.push(ping); return list.length > (max == null ? COOP2.ping.max : max) ? list.shift() : null; }
// ---- THE DIRECTOR FOR TWO ----
export function coopCountK(two){ return two ? COOP2.director.countK : 1; }
// whom the host's director goes for: q = { dist (m between the two), hostMen / guestMen (our men round each), hostDmg / guestDmg (what each dealt lately),
//   hostDown, guestDown } → out.ambush (the flank entry: the one who is alone) / out.press (whom the enemy leans on: the one hurting it most — or the one
//   standing over a downed man): 0 = the host's soldier, 1 = the guest's, -1 = nobody in particular
export function coopDirPick(q, out){ const D = COOP2.director; out = out || {}; out.ambush = -1; out.press = -1;
  if(q.hostDown || q.guestDown){ out.ambush = out.press = q.hostDown && !q.guestDown ? 1 : q.guestDown && !q.hostDown ? 0 : -1; return out; }   // (a revive draws fire: the one still standing)
  if(q.dist > D.aloneD) out.ambush = q.guestMen < q.hostMen ? 1 : q.hostMen < q.guestMen ? 0 : q.guestDmg <= q.hostDmg ? 1 : 0;   // (as many men round both: the one fighting less)
  const hi = Math.max(q.hostDmg || 0, q.guestDmg || 0), lo = Math.min(q.hostDmg || 0, q.guestDmg || 0); if(hi >= D.pressMin && hi > lo * D.pressLead) out.press = q.guestDmg > q.hostDmg ? 1 : 0;
  return out; }
// ---- A MAGAZINE THROWN: may this page take the rounds the other says he throws: q = { now, dist (m between the two), down (the thrower), rounds } → '' yes
export function coopJudgeGive(WT, q){ const Gv = COOP2.give, why = q.down ? 'down' : !(q.dist <= Gv.r * Gv.rK) ? 'range' : !(q.rounds >= 1 && q.rounds <= Gv.maxRounds) ? 'rounds' : !coopBucketTake(WT.give, q.now) ? 'rate' : ''; WT.why = why; if(why) WT.dropped++; else WT.ok++; return why; }
