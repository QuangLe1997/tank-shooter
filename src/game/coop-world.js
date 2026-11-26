// game/coop-world.js — COOP 9 ONE SHARED BATTLE: what stands, what lies on the ground and the Core's health are the HOST's, on both pages.
//   BLOCKS (cover, towers, gates, fort walls, the objective): both pages built the same list (the fingerprint), so a block's id is its place in the build order + 1
//     (a position would do too, but an index is exact, costs 2 bytes and needs no search). Every damage on the host goes through world/cover.js damageBlock →
//     coopBlockDamage: what is left of the block (or the damage, for the kinds that keep no plain health) is passed on, the last state at most every
//     COOP2.block.every s, "gone" at once; the guest applies it through the same damageBlock (the same collapse, the same loot-less rubble). The guest's own
//     rounds do NOT break anything on his page: they are reported and the host judges them (net/rules.js coopJudgeBlock).
//   LOOT: a pick-up is the host's — given an id when it lands, sent, taken by whoever touches it first: the host's soldier at once, the guest's when the host
//     agrees he is near it (coopJudgeNear). The HQ's ammunition crate is one for both (whoever opens it, both get its rounds).
//   TOWER GUARDS: a guard shot off / thrown and each of his shots are the host's events; the guest's round on a guard is a report.
//   THE CORE: its health follows the host's.
//   Nothing here runs without a live room: every caller is behind CO.live / CO.ai / CO.puppet.
import { COOP, COOP2, LOGISTICS } from '../../config.js';
import { AMMO, CO, FT, GIFTS, GUNS, LOGI, MATE, MEDAL, NET_EV, NET_LOOT, NET_STATE, OBJ, POWERUPS, S, addTrail, ammoCrate, ammoDropFor, applyPowerup, blocks, coopAmmoCls, coopAmmoIdx, coopBlockP, coopHitOf, coopHitP, coopJudgeBlock, coopJudgeNear, coopSendEvent, core, damageBlock, disposePickup, dropGuard, dropPowerup, floatText, gunFlash, heightAt, lootToast, makeCoopWorldTrust, mateGunId, mateGunIndex, mateProxy, mateRange, pickups, pouchDef, ringPulse, sfx, shootGuard, soldiers, spawnGift, towers, updateHUD, wpnDef } from '../hub.js';

// what the page knows of the shared world (dev probes read it): all — the blocks as built (index + 1 = id) · tw — the towers as built · dirty — blocks whose state
// waits for the next flush · apply — the block the host's word is being applied to · mine — true while the guest's own rounds are stepped · loot / crates — by id
export const CW = { sw:COOP2.world, all:[], tw:[], dirty:[], apply:null, mine:false, word:false, lootIn:false, loot:new Map(), lootSeq:1, crates:new Map(), crateSeq:1, coreHp:-1, coreAt:0, flushAt:0, sweepAt:0, needAt:0, stamp:1, wt:makeCoopWorldTrust(),
  n:{ blkOut:0, blkIn:0, blkRep:0, blkTaken:0, blkNoId:0, blkForce:0, blkStuck:0, lootOut:0, lootIn:0, lootNoCode:0, taken:0, asks:0, crates:0, opened:0, guardOut:0, guardIn:0, shots:0, drops:0 }, dropWhy:'', err:0, lastErr:'' };
const _q = { now:0, dmg:0, weaponOk:false, alive:false, dist:0, gunDmg:0, gunRange:0, guestDown:false }, _j = { ok:false, dmg:0, why:'' }, _h = { dmg:0, heavy:false };
function fail(e){ CW.err++; CW.lastErr = String(e && e.message || e).slice(0, 200); if(CW.err <= 3) console.warn('coop: world', e); }
function drop(why){ CW.n.drops++; CW.dropWhy = why; }
const on = k => !!CW.sw[k];

// a new battlefield stands (game/coop-glue.js coopFieldBuilt, both pages): ids in the build's order
export function coopWorldReset(){ const W = CW; W.all = blocks.slice(); W.tw = towers.slice(); W.dirty.length = 0; W.apply = null; W.mine = false; W.word = false; W.coreHp = -1;
  for(const [lid, u] of W.loot) if(!CO.host && !pickups.includes(u)) W.loot.delete(lid); for(const [cid, u] of W.crates) if(!GIFTS.includes(u)) W.crates.delete(cid);   // (what lies on the ground outlives a stage: its ids are kept — the host's flush says GONE for whatever a new battle cleared)
  W.coreAt = W.flushAt = W.sweepAt = 0; W.wt = makeCoopWorldTrust();
  for(let i = 0; i < W.all.length; i++){ const b = W.all[i]; b.bid = i + 1; b._nd = 0; b._nq = false; b._nf = false; b._ng = false; } for(let i = 0; i < W.tw.length; i++) W.tw[i].tid = i + 1; }
function blockOf(id){ const b = CW.all[id - 1]; return b && b.bid === id ? b : null; }

// ================= BLOCKS =================
// world/cover.js damageBlock, with a live room: fn = the game's own damage. HOST: applied, then passed on. GUEST: only the host's word is applied (CW.apply);
// his own round (CW.mine) is reported; anything else — a chain of fuel drums, a wall that falls on another — waits for the host's event for that block
export function coopBlockDamage(b, dmg, fn){ const W = CW;
  if(CO.puppet && on('blocks')){ if(W.apply === b || !b.bid){ fn(b, dmg); return; } if(W.apply || !W.mine || !(dmg > 0)) return;
    const pl = S.player, gi = pl && pl.guns && pl.guns[pl.gunIdx]; W.n.blkRep++; coopSendEvent(NET_EV.BLOCK, COOP.ids.guest, b.bid, 0, (gi ? mateGunIndex(gi.id) : 0) / 100, 0, coopHitP(dmg, false)); return; }
  if(!CO.ai || !on('blocks')){ fn(b, dmg); return; }
  const h0 = b.hp; fn(b, dmg); if(!b.bid){ W.n.blkNoId++; return; }
  if(!blocks.includes(b)){ sayGone(b); return; }
  if(b.maxHp > 0 && typeof b.hp === 'number' && b.hp !== h0) b._nf = true; else if(dmg > 0) b._nd += dmg;   // (a kind that keeps no plain health — a building's floors, a tent: the damage itself is replayed)
  if(!b._nq){ b._nq = true; W.dirty.push(b); } }
function sayGone(b){ if(b._ng) return; b._ng = true; b._nq = false; CW.n.blkOut++; coopSendEvent(NET_EV.BLOCK, b.bid, 1, b.x, 0, b.z, 1); }
function flushBlocks(){ const W = CW, D = W.dirty; for(let i = 0; i < D.length; i++){ const b = D[i]; if(!b._nq) continue; b._nq = false;
    if(b._nf){ b._nf = false; W.n.blkOut++; coopSendEvent(NET_EV.BLOCK, b.bid, 2, b.x, 0, b.z, coopBlockP(true, Math.max(0, b.hp) / b.maxHp)); }
    if(b._nd >= 0.5){ const v = Math.min(65535, Math.round(b._nd)); b._nd -= v; W.n.blkOut++; coopSendEvent(NET_EV.BLOCK, b.bid, 0, b.x, 0, b.z, coopBlockP(false, v)); } }
  D.length = 0; }
// a block that left the host's field by another road than damage (a fort taken, an objective cleared): found by a sweep, said gone all the same
function sweepBlocks(){ const W = CW, st = ++W.stamp; if(!blocks.length || S.awaitingUpgrade) return; for(let i = 0; i < blocks.length; i++) blocks[i]._ns = st; let n = 0;   // (a field being torn down is not a field of blocks gone; 48 a sweep at most)
  for(let i = 0; i < W.all.length && n < 48; i++){ const b = W.all[i]; if(b._ns !== st && !b._ng){ sayGone(b); n++; } } }
// the guest: the host's word on a block
function blockWord(id, flags, p){ const W = CW, b = blockOf(id); W.n.blkIn++; if(!b || !blocks.includes(b)) return; W.apply = b;
  try{ if(flags & 2){ const target = p / 65535 * (b.maxHp || 0), d = b.hp - target; if(d > 1e-3) damageBlock(b, d); if(b.hp > target && blocks.includes(b)) b.hp = target; }
    else if(!(flags & 1)) damageBlock(b, p);
    if(flags & 1){ for(let k = 0; k < COOP2.block.force && blocks.includes(b); k++){ W.n.blkForce++; damageBlock(b, Math.max(1e5, (b.maxHp || 0) * 4)); }
      const i = blocks.indexOf(b); if(i >= 0){ W.n.blkStuck++; blocks.splice(i, 1); if(b.mesh) b.mesh.visible = false; } }   // (a kind no damage brings down: taken off the field as it is)
  }catch(e){ fail(e); }finally{ W.apply = null; } }
// the host: a guest's round on a block, judged by the host's own numbers
function blockReport(bid, y, p, now){ const W = CW, b = blockOf(bid), h = coopHitOf(p, _h), w = Math.round(y * 100), g = GUNS[mateGunId(w)] || null, T = CO.trust;
  _q.now = now; _q.dmg = h.dmg; _q.weaponOk = w === T.w[0] || w === T.w[1]; _q.alive = !!b && blocks.includes(b); _q.dist = b ? Math.max(0, Math.hypot(b.x - MATE.x, b.z - MATE.z) - (b.r || 0)) : 0; _q.gunDmg = g ? g.dmg || 0 : 0; _q.gunRange = mateRange();
  _q.guestDown = CO.gd.on || !MATE.on || S.mode !== 'playing'; const j = coopJudgeBlock(W.wt, _q, _j); if(!j.ok){ drop('block ' + j.why); return; } W.n.blkTaken++; damageBlock(b, j.dmg); }   // (→ coopBlockDamage: applied, and passed back)

// ================= LOOT =================
// what a pick-up is, in 10 bits: a POWERUPS index · 60 the medal · 61 the ammunition crate · 80 + class an enemy's pouch · 256 + gun index his weapon. -1 = cannot be named (stays the host's own)
export function coopLootCode(def){ if(!def) return -1; let i = POWERUPS.indexOf(def); if(i >= 0 && i < 60) return i; if(def === MEDAL) return 60; if(def === AMMO) return 61; if(def.gun && GUNS[def.gun]){ i = 256 + mateGunIndex(def.gun); return i < 1024 ? i : -1; }
  if(typeof def.id === 'string' && def.id.slice(0, 6) === 'pouch_'){ i = coopAmmoIdx(def.id.slice(6)); return i >= 0 ? 80 + i : -1; } return -1; }
export function coopLootDef(code){ if(code < 60) return POWERUPS[code] || null; if(code === 60) return MEDAL; if(code === 61) return AMMO; if(code >= 256){ const id = mateGunId(code - 256); return id && GUNS[id] ? wpnDef(id) : null; }
  if(code >= 80 && code < 112){ const c = coopAmmoCls(code - 80); return c ? pouchDef(c) : null; } return null; }
// loot/powerups.js dropPowerup asks first: false = this page makes no pick-up of its own (the guest: the host's will come)
export function coopLootMay(){ return !(CO.puppet && on('loot')) || CW.lootIn; }
// …and tells afterwards. The host: an id; it is sent at the next flush, still in the air, with its flight (where it is, how high, which way and how fast) so the
// guest's copy comes down in the same place (a stashed one is slowed right after the drop: by then it is)
export function coopLootDropped(u){ const W = CW; if(!CO.ai || !on('loot')) return; if(coopLootCode(u.def) < 0){ W.n.lootNoCode++; return; } if(W.lootSeq > 65535) W.lootSeq = 1; u.lid = W.lootSeq++; u._nsent = false; W.loot.set(u.lid, u); }
function hostLoot(){ const W = CW; for(const [lid, u] of W.loot){
    if(!pickups.includes(u)){ W.loot.delete(lid); if(u._nsent) coopSendEvent(NET_EV.LOOT, lid, 0, 0, 0, 0, NET_LOOT.GONE); continue; }   // (the host's soldier took it, one of our men carried it off, its time ran out)
    if(!u._nsent){ u._nsent = true; W.n.lootOut++; const fly = !u.landed, sp = fly ? Math.hypot(u.vx, u.vz) : 0, dir = fly ? Math.round((Math.atan2(u.vx, u.vz) + 6.283185307) % 6.283185307 / 6.283185307 * 128) & 127 : 0, hq = fly ? Math.max(0, Math.min(31, Math.round((u.y - heightAt(u.x, u.z)) * 4))) : 0;
      coopSendEvent(NET_EV.LOOT, lid, coopLootCode(u.def) | (hq << 10) | (u.stash ? 0x8000 : 0), u.x, fly ? Math.max(-300, Math.min(300, u.vy)) : 0, u.z, NET_LOOT.DROP | (dir << 4) | (Math.min(31, Math.round(sp * 4)) << 11)); } } }
// loot/powerups.js updatePickups, this page's soldier touches u: true = not his to take by himself (the guest asks the host; a downed man takes nothing)
export function coopLootTouch(u, now){ if(CO.down.on) return true; if(!CO.puppet || !on('loot')) return false; if(!u.lid) return false;
  if(now >= (u._askAt || 0)){ u._askAt = now + COOP2.loot.askEvery; CW.n.asks++; coopSendEvent(NET_EV.LOOT, COOP.ids.guest, u.lid, 0, 0, 0, NET_LOOT.ASK); } return true; }
// on the guest a pick-up's time is the host's (loot/powerups.js): true = it does not run out here
export function coopLootKeeps(u){ return CO.puppet && !!u.lid; }
function lootAsk(lid, now){ const W = CW, u = W.loot.get(lid), i = u ? pickups.indexOf(u) : -1; _q.now = now; _q.alive = i >= 0 && !!u.landed; _q.dist = u ? Math.hypot(u.x - MATE.x, u.z - MATE.z) : 0; _q.guestDown = CO.gd.on || !MATE.on || S.mode !== 'playing';
  const why = coopJudgeNear(W.wt, W.wt.loot, _q, COOP2.loot.takeR); if(why){ drop('loot ' + why); return; }
  W.loot.delete(lid); const def = u.def; disposePickup(u); pickups.splice(i, 1); W.n.taken++; if(COOP2.loot.world.includes(def.id)){ try{ def.apply(S.player); }catch(e){ fail(e); } }   // (what it does to the shared battle is done here, once)
  ringPulse({ x:MATE.x, z:MATE.z }, def.color, 3); coopSendEvent(NET_EV.LOOT, lid, COOP.ids.guest, MATE.x, 0, MATE.z, NET_LOOT.TAKEN); }
function lootWord(a, b, x, y, z, pp, now){ const W = CW, L = NET_LOOT, p = pp & 15;
  if(p === L.DROP){ if(W.loot.has(a)) return; const def = coopLootDef(b & 1023); if(!def) return; let u = null; W.lootIn = true; try{ u = dropPowerup({ x, z }, 0, def); }finally{ W.lootIn = false; } if(!u) return;
    const dir = ((pp >> 4) & 127) / 128 * 6.283185307, sp = (pp >> 11) / 4; u.lid = a; u.x = x; u.z = z; u.y = heightAt(x, z) + ((b >> 10) & 31) / 4; u.vx = Math.sin(dir) * sp; u.vz = Math.cos(dir) * sp; u.vy = y; if(b & 0x8000) u.stash = true; W.loot.set(a, u); W.n.lootIn++; return; }
  if(p === L.GONE || p === L.TAKEN){ const u = W.loot.get(a); if(!u) return; W.loot.delete(a); const i = pickups.indexOf(u); if(i < 0) return; disposePickup(u); pickups.splice(i, 1);
    if(p === L.TAKEN && b === CO.me && S.player){ const def = u.def, pl = S.player; W.n.taken++; if(COOP2.loot.world.includes(def.id)) lootToast(def, 'Cho cả đội'); else applyPowerup(def); sfx('powerup'); ringPulse(pl.pos, def.color, 3); } return; }
  if(p === L.CRATE){ if(W.crates.has(a)) return; const u = spawnGift({ x, z }, () => { ammoCrate(LOGISTICS.drop.share); W.n.opened++; if(S.player) floatText(LOGISTICS.say.dropGot, '#ffd86a', S.player.pos, 18); }); u.cid = a; W.crates.set(a, u); LOGI.drops.push({ x, z, u, t:now }); W.n.crates++; return; }
  if(p === L.OPEN){ const u = W.crates.get(a); if(u){ u.forceOpen = true; W.crates.delete(a); } } }
// ---- the HQ's ammunition crate (game/logistics.js): one for both ----
export function coopHostCrate(u){ const W = CW; if(!CO.ai || !on('loot') || !u) return; if(W.crateSeq > 65535) W.crateSeq = 1; u.cid = W.crateSeq++; W.crates.set(u.cid, u); W.n.crates++; coopSendEvent(NET_EV.LOOT, u.cid, 0, u.x, 0, u.z, NET_LOOT.CRATE); }
export function coopCrateOpened(u){ if(!CO.ai || !u || !u.cid) return; CW.crates.delete(u.cid); CW.n.opened++; coopSendEvent(NET_EV.LOOT, u.cid, 0, u.x, 0, u.z, NET_LOOT.OPEN); }
// loot/gift-crate.js updateGifts, this page's soldier reaches a crate: true = it is not his to open by himself (the guest asks)
export function coopCrateTouch(u, now){ if(!CO.puppet || !u.cid || !on('loot')) return false; if(now >= (u._askAt || 0)){ u._askAt = now + COOP2.loot.askEvery; CW.n.asks++; coopSendEvent(NET_EV.LOOT, COOP.ids.guest, u.cid, 0, 0, 0, NET_LOOT.ASKCRATE); } return true; }
function crateAsk(cid, now){ const W = CW, u = W.crates.get(cid); _q.now = now; _q.alive = !!u && u.st === 'wait' && GIFTS.includes(u); _q.dist = u ? Math.hypot(u.x - MATE.x, u.z - MATE.z) : 0; _q.guestDown = CO.gd.on || !MATE.on || S.mode !== 'playing';
  const why = coopJudgeNear(W.wt, W.wt.loot, _q, COOP2.loot.crateR); if(why){ drop('crate ' + why); return; } u.forceOpen = true; }   // (it opens on the host's page next frame: its rounds for the host, OPEN for the guest)
// game/logistics.js: the guest is short of rounds — he says so (the host's HQ decides and drops near him)
export function coopNeedAmmo(now){ if(now < CW.needAt) return; CW.needAt = now + COOP2.loot.needCd; coopSendEvent(NET_EV.LOOT, COOP.ids.guest, 0, 0, 0, 0, NET_LOOT.NEED); }
function needAsk(now){ const W = CW, m = mateProxy(); if(now < W.needAt || !m || CO.gd.on || S.mode !== 'playing') return; W.needAt = now + COOP2.loot.needCd * 0.8; try{ ammoDropFor(m, now); }catch(e){ fail(e); } }

// ================= TOWER GUARDS =================
// world/towers.js dropGuard on the host: a guard leaves his tower (shot off it, thrown by its fall)
export function coopHostGuardDown(t, gd, ux, uz, live){ if(!on('guards') || !t.tid) return; const gi = t.guards.indexOf(gd); if(gi < 0 || gi > 15) return; CW.n.guardOut++; coopSendEvent(NET_EV.GUARD, t.tid, gi | (live ? 16 : 0), ux, 0, uz, 0); }
// …and each of his shots (the guest draws the flash and the streak; whether it struck the guest's soldier is a HIT from the host as ever)
export function coopHostGuardShot(t, gd, x, y, z, ang){ if(!on('guards') || !t.tid) return; const gi = t.guards.indexOf(gd); if(gi < 0) return; coopSendEvent(NET_EV.SHOT, t.tid, gi, x, y, z, Math.round(((ang % 6.283185307) + 6.283185307) % 6.283185307 / 6.283185307 * 65535)); }
// world/towers.js shootGuard on the guest: his round on a guard is reported (true = the round is spent, the guard stays until the host says so)
export function coopGuardReport(t, gd){ if(!on('guards') || !t.tid) return false; const gi = t.guards.indexOf(gd); if(gi < 0 || gi > 15) return false; coopSendEvent(NET_EV.GUARD, COOP.ids.guest, t.tid * 16 + gi, 0, 0, 0, 0); return true; }
function guardReport(b, now){ const W = CW, t = W.tw[(b >> 4) - 1], gd = t && t.guards[b & 15]; _q.now = now; _q.alive = !!gd && gd.alive && !t.falling; _q.dist = t ? Math.hypot(t.x - MATE.x, t.z - MATE.z) : 0; _q.guestDown = CO.gd.on || !MATE.on || S.mode !== 'playing';
  const why = coopJudgeNear(W.wt, W.wt.guard, _q, Math.max(COOP2.guard.rangeMin, mateRange() * COOP2.guard.rangeK)); if(why){ drop('guard ' + why); return; } shootGuard(t, gd, MATE.x, MATE.z); }
function guardWord(a, b, x, z){ const t = CW.tw[a - 1], gd = t && t.guards[b & 15]; CW.n.guardIn++; if(!gd || !gd.alive) return; CW.word = true; try{ dropGuard(t, gd, x, z, !!(b & 16)); }finally{ CW.word = false; } }
// world/towers.js dropGuard on the guest: true = not now — this guard (of a tower both pages built) comes off it when the host's event says so
export function coopGuardWaits(t){ return on('guards') && !!t.tid && !CW.word; }
function guardShot(a, b, x, y, z, p){ const t = CW.tw[a - 1], gd = t && t.guards[b], ang = p / 65535 * 6.283185307; CW.n.shots++; if(gd && gd.alive && t.body) gd.g.rotation.y = ang - t.body.rotation.y;
  gunFlash(x, y, z, ang, 0.6, 0.34, 0xfff0c0, 0.9); sfx('rifleShot', { x, z }); const sx = Math.sin(ang), sz = Math.cos(ang); for(let k = 1; k <= 8; k++){ const d = k * 2.6; addTrail(x + sx * d, Math.max(heightAt(x + sx * d, z + sz * d) + 1.2, y - d * 0.16), z + sz * d, 0xffb04a, 0.3, 0.1 + k * 0.012); } }

// ================= THE FRAME, THE EVENTS, THE PROBE =================
// game/coop-glue.js coopTick, the host, while the fight is on: what changed goes out
export function coopWorldTick(dt, now){ const W = CW; if(!CO.ai) return;
  try{ if(now >= W.flushAt){ W.flushAt = now + COOP2.block.every; if(on('blocks')) flushBlocks(); if(on('loot')) hostLoot(); }
    if(now >= W.sweepAt){ W.sweepAt = now + 1; if(on('blocks')) sweepBlocks(); }
    if(on('core') && core && now >= W.coreAt){ const hp = Math.max(0, Math.min(65535, Math.round(core.hp))); if(hp !== W.coreHp){ W.coreHp = hp; W.coreAt = now + COOP2.core.every; coopSendEvent(NET_EV.STATE, NET_STATE.CORE, hp, 0, 0, 0, Math.max(1, Math.min(65535, Math.round(core.maxHp)))); } }
  }catch(e){ fail(e); } }
// an event of the shared world that passed the gate (game/coop-glue.js onEvent): true = it was one of these
export function coopWorldEvent(host, type, a, b, x, y, z, p, now){ const E = NET_EV;
  try{ if(host){ if(type === E.BLOCK){ if(on('blocks')) blockReport(b, y, p, now); return true; } if(type === E.GUARD){ if(on('guards')) guardReport(b, now); return true; }
      if(type === E.LOOT){ if(!on('loot')) return true; if(p === NET_LOOT.ASK) lootAsk(b, now); else if(p === NET_LOOT.ASKCRATE) crateAsk(b, now); else needAsk(now); return true; } return false; }
    if(type === E.BLOCK){ if(CO.puppet) blockWord(a, b, p); return true; } if(type === E.GUARD){ if(CO.puppet) guardWord(a, b, x, z); return true; } if(type === E.SHOT){ if(CO.puppet) guardShot(a, b, x, y, z, p); return true; }
    if(type === E.LOOT){ if(CO.puppet) lootWord(a, b, x, y, z, p, now); return true; }
    if(type === E.STATE){ if(CO.puppet && core){ core.maxHp = p; if(b < core.hp - 0.5){ core.flash = 0.16; if(core.cu && core.cu.flash) core.cu.flash.value = 0.85; } core.hp = b; updateHUD(); } return true; }
  }catch(e){ fail(e); return true; } return false; }
// what both pages must agree on (the two-page runner compares them)
export function coopWorldProbe(){ const W = CW, st = ++W.stamp, gone = []; for(let i = 0; i < blocks.length; i++) blocks[i]._ns = st; for(let i = 0; i < W.all.length; i++) if(W.all[i]._ns !== st) gone.push(i + 1);
  let guards = 0, up = 0; for(let i = 0; i < W.tw.length; i++){ const t = W.tw[i]; if(!t.falling && !t.gone) up++; for(const gd of t.guards) if(gd.alive) guards++; } const lids = []; for(const [lid, u] of W.loot) if(u._nsent !== false) lids.push(lid); lids.sort((p, q) => p - q);
  return { built:W.all.length, gone, core:core ? [Math.round(core.hp), Math.round(core.maxHp)] : null, obj:OBJ && OBJ.b ? [OBJ.alive ? Math.round(OBJ.b.hp / OBJ.b.maxHp * 1000) : 0, OBJ.alive ? 1 : 0] : null, pickups:pickups.length, lids, crates:W.crates.size, gifts:GIFTS.length,
    allies:soldiers.length + FT.length, towers:W.tw.length, towersUp:up, guards, n:Object.assign({}, W.n), trust:{ ok:W.wt.ok, dropped:W.wt.dropped, why:W.wt.why }, dropWhy:W.dropWhy, err:W.err, lastErr:W.lastErr }; }
