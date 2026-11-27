// campaign/fort-boss.js — BOSS 1 A BOSS IN EVERY FORT (FORTBOSS; his look: actors/fort-boss-look.js). Every fort holds ONE boss, a modern heavy operator
//   2.6–2.9 m tall in heavy plates with a heavy gun. He waits until the fort's first force is dead (world/fortress.js calls fortBossWake once its pool is
//   spent, nobody of it is left inside and the tunnels are empty), then the event: a war horn, the alarm, a burst of dust at the keep's / the command
//   post's door, a short slow-motion beat and his name on the boss bar — he strides out (no hit lands for intro.hold s; the camera is left alone).
//   THE FIGHT: he fights like a rifleman from cover and from the spots this file gives him (kept inside his walls: the leash; a new spot when a wall holds
//   him up), turns slowly (a heavy man: his flanks and his back can be reached), and every big move is warned:
//     phase 1 (100–60 %): the heavy gun's SWEEP — a red glint, a laser sight crossing the arc, then a fan of rounds across it (cover stops them);
//     phase 2 (60–30 %): he calls his bodyguards, throws his second weapon (hand grenades · a grenade launcher's volley · shoulder rockets) and CHARGES
//       down a lane his laser marks (contact: a heavy hit; a wall in his way: he staggers);
//     phase 3 (< 30 %): enraged — helmet and pauldrons blown off, faster feet, faster fire, two passes a sweep.
//   ARMOUR (fortBossDmg, from actors/damage.js): a hit is placed by the way it came — the front's helmet / chest plate, a flank's pauldron, the back's
//   power pack — a plate soaks it (armK through) until it is shot off (it flies off, he staggers); the bare head and the pack are weak points; a blade
//   cut while he staggers hits × blade.k, and below blade.finish of his health it is the killing blow.
//   HIS DEATH takes the fort (fortTake; the capital's is the stage's general: bossStageWon) — slow motion, the banner, the line on the radio, his plates
//   and gun scattered, his guards running, and the HQ's 3D gift crate (loot/gift-crate.js: a reward and ammunition).
//   CO-OP: the host runs him; the guest's page sees the host's puppet dressed as him (APPEAR), his plates as they go and his phase (PLATE), the warning
//   of each move (ATK) and the fort taken (TAKEN) — CUE events, FORTBOSS.cue, allowed host → guest only (net/rules.js).
import * as THREE from 'three';
import { FORT, FORTBOSS, TROOPS } from '../../config.js';
import { fortBossAct, fortBossAnim, fortBossCorpseTick, fortBossCorpsesClear, fortBossFlash, fortBossLookId, fortBossPreload, fortBossWarm } from '../hub.js';   // BOSS 2 (actors/fort-boss-glb.js)
import { BIOME, CO, FORTS, MATE, NET_EV, S, ammoCrate, animateSoldier, bigExplode, blastAllies, bossForStage, bossStageWon, burst, clampFieldXZ, coopEnemyById, coopHostCrate, coopHurtMate, coopSendEvent, damagePlayer, diffHpMul, disposeArtZone, enemies, floatText, fortBossGlow, fortBossLook, fortBossLookClear, fortBossLookTick, fortBossPlateOff, fortBossStrip, fortFlagsTick, fortIntactCross, fortTake, freeEnemyBar, heightAt, infPushBlocks, launchEnemyMissile, loopHpMul, losBlocked, makeArtLock, nemFell, nemMeet, nemPlateEl, poseSoldier, radio, ringPulse, scene, sfx, showBanner, soldierStagePerks, spawnBullet, spawnEnemy, spawnGift, spawnPart, storyCue, tickArtLock, wakeFort, killEnemy } from '../hub.js';
import { muzzleFX } from '../hub.js';   // GUNFX 1 (fx/gunfx.js)
import { conqBossDef } from '../hub.js';   // CONQ 1 (campaign/conquest.js)

const C = FORTBOSS, NOW = () => performance.now() / 1000, PL = ['helmet', 'chest', 'shL', 'shR', 'pack'];
// the page's bosses (dev / probes read it): list = this battle's (host / solo) · guest = the host's, as this guest's page draws them (by fort index) ·
//   log = the co-op cues sent [code, a, b] (also without a room: the probes read them) · seq = the battle (a pending timer of an old one does nothing)
export const FBOSS = { list:[], guest:new Map(), log:[], seq:0, barK:'', barB:null };
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), _m = new THREE.Vector3();
// ---- the pure rules (test.js checks them) ----
// where a hit lands: rel = the bearing of where it came from, off his facing (rad); pl = his plates' health; r = a roll 0–1
export function fortBossZone(rel, pl, r, belt){ const a = Math.abs(rel);   // (BOSS 4 belt: his weak point is a device on his hip — a share of the front hits, beltShare, strike it; his back is plain back)
  if(a > C.back) return pl.pack > 0 && !belt ? 'pack' : 'back';
  if(a < C.front){ if(r < C.headShare) return pl.helmet > 0 ? 'helmet' : 'head'; if(belt && r < C.headShare + C.beltShare && pl.pack > 0) return 'pack'; return pl.chest > 0 ? 'chest' : 'body'; }
  const side = rel > 0 ? 'shL' : 'shR'; return r < C.sideShare && pl[side] > 0 ? side : 'body'; }   // (+X of him is his left: the Mixamo frame)
// his health: by tier, the stage, the difficulty, the NG+ loop, the players
export function fortBossHp(tier, stage, diffK, loopK, players){ return Math.round((C.hp[tier - 1] || C.hp[0]) * (1 + C.stageK * Math.max(0, (stage || 1) - 1)) * (diffK || 1) * (loopK || 1) * (1 + C.coopK * Math.max(0, (players || 1) - 1))); }
// the plates' state as one number for the wire: bit i = plate PL[i] gone, bits 5–6 = the phase, bit 7 = staggering
export function fortBossBits(pl, phase, stag){ let b = 0; for(let i = 0; i < PL.length; i++) if(!(pl[PL[i]] > 0)) b |= 1 << i; return b | ((phase & 3) << 5) | (stag ? 128 : 0); }
// who he is, by his fort: name, gun, colour (the capital's: the stage's general)
export function fortBossDef(f){ const L = C.lands[BIOME.name] || C.lands._, K = C.kinds[f.tier] || C.kinds[1], cap = f.tier === 3, bd = cap ? bossForStage(S.stage || 1) : null;
  const d = { tier:f.tier, land:L, kind:K, capital:cap, bdef:bd, id:bd ? bd.id : '', name:bd ? bd.name : L.t + ' · ' + (f.chief || 'TƯỚNG GIỮ THÀNH'), sub:K.gun + ' · GIÁP NẶNG' };
  if(cap) conqBossDef(d);   // CONQ 1 a fort of the conquest: its general's name and look (campaign/conquest.js)
  const LK = C.model === 'glb' && C.looks[fortBossLookId(d)]; if(LK){ if(LK.name && !bd) d.name = LK.name + ' ' + String(f.chief || '').replace(/^TƯỚNG /, ''); if(LK.sub) d.sub = LK.sub; if(LK.glow != null) d.land = { ...L, glow:LK.glow }; } return d; }   // BOSS 2 a look's own name / gun line / glow

function emit(p, a, b, x, z){ FBOSS.log.push([p, a, b]); if(FBOSS.log.length > 60) FBOSS.log.shift(); if(CO.host && CO.live) coopSendEvent(NET_EV.CUE, a, b, x || 0, 0, z || 0, p); }
function foe(e){ const p = S.player; let x = p.pos.x, z = p.pos.z, mate = false;
  if(CO.ai && MATE.on && !(CO.gd && CO.gd.on)){ const dm = Math.hypot(MATE.x - e.pos.x, MATE.z - e.pos.z), dp = Math.hypot(x - e.pos.x, z - e.pos.z); if(dm < dp){ x = MATE.x; z = MATE.z; mate = true; } }
  return { x, z, mate, d:Math.hypot(x - e.pos.x, z - e.pos.z) }; }
// a blow at (x, z) radius R: the soldier, the guest's, our men
function hurtAt(x, z, R, dmg, now, kind){ const p = S.player; { const dx = p.pos.x - x, dz = p.pos.z - z, d = Math.hypot(dx, dz); if(d < R) damagePlayer(dmg * (1 - 0.5 * d / R), now, dx || 0.01, dz, kind || 'blast'); }
  if(CO.ai && MATE.on){ const dx = MATE.x - x, dz = MATE.z - z, d = Math.hypot(dx, dz); if(d < R) coopHurtMate(dmg * (1 - 0.5 * d / R), dx || 0.01, dz); }
  blastAllies(x, z, R, dmg); }
// BOSS 2 the battle's boss looks fetched once its forts stand (the host's and the guest's page alike)
function preload(){ if(FBOSS.pre || !FORTS.length || !C.on) return; FBOSS.pre = true; fortBossPreload([...new Set(FORTS.map(f => fortBossLookId(fortBossDef(f))))]); }
function home(f){ return { x:f.x, z:f.z, r:(f.Rin || f.R) - C.move.leash }; }
// where he comes out: the keep's door (the capital) or the command post's, toward the gate, stepped clear of the building
function doorOf(f){ const gx = f.gx - f.x, gz = f.gz - f.z, gl = Math.hypot(gx, gz) || 1, ux = gx / gl, uz = gz / gl; let cx = f.x, cz = f.z, r = 0;
  if(f.keepR){ cx = f.x + f.keepX; cz = f.z + f.keepZ; r = f.keepR + 2; } else if(f.coreR){ cx = f.x + f.coreX; cz = f.z + f.coreZ; r = f.coreR + 1.5; }
  const p = { x:cx + ux * r, z:cz + uz * r }; infPushBlocks(p); return { x:p.x, z:p.z, ux, uz }; }

// ================= HOST / SOLO =================
// the fort's first force is dead (world/fortress.js): the horn, then he comes out (once a fort)
export function fortBossWake(f, now){ if(!C.on || f.boss || f.captured) return null; const fi = FORTS.indexOf(f), def = fortBossDef(f), door = doorOf(f);
  const B = { f, fi, def, door, e:null, look:null, st:'pending', until:now + 0.9, phase:1, pl:{}, plMax:{}, next:{ sweep:0, nade:0, charge:0 }, gap:0, guards:[], zones:[], rk:null,
    postAt:0, stuckAt:0, sx:0, sz:0, stuckN:0, stepD:0, dmgIn:0, t0:now, tDown:0, act:null, laser:null, hitTxtAt:0 };
  f.boss = B; FBOSS.list.push(B); fortBossWarm(def);
  sfx('horn', { x:door.x, z:door.z }); sfx('alarm'); S.shake = Math.max(S.shake || 0, 0.5);
  showBanner('⚠ ' + def.name + ' XUẤT TRẬN!', '#ff7a3a');
  burst({ x:door.x, z:door.z }, BIOME.ground, 10, 4, { y:heightAt(door.x, door.z) + 1, life:1.4, size:2.4, smoke:true, grav:-0.2, drag:1.4, up:2, op:0.55 });
  return B; }
function spawn(B, now){ const f = B.f, D = B.door, def = B.def, K = def.kind, e = spawnEnemy('rifle', D.x, D.z, 'door'); if(!e) return false;
  const players = CO.live ? 2 : 1, hp = fortBossHp(def.tier, S.stage, diffHpMul(), loopHpMul(), players); if(def.capital) nemMeet(def.id, def.name);
  e.general = true; e.commander = f; e.fortOf = f; e.fortBoss = B; e.loot = false; e.elite = false;   // (general: he knows at once — ai/awareness.js)
 
  e.def = { ...e.def, dmg:C.fire.dmg * (K.dmgK || 1), fireCd:C.fire.fireCd, range:C.move.range, keep:C.move.keep, speed:C.move.speed, score:1500 + 1000 * def.tier, burst:[4, 7], scale:(e.def.scale || TROOPS.look.scale) * (C.h[def.tier - 1] / C.baseH) };
  e.maxHp = e.hp = hp; e.hitCap = hp * C.hitCap * C.blade.k * C.headK; e.turnK = C.move.turn; e.upright = true;
  freeEnemyBar(e.bar); e.bar = null;
  B.look = fortBossLook(e, def); e.rK = B.look.k; e.facing = Math.atan2(D.ux, D.uz); e.mesh.rotation.y = e.facing;
  for(const k of PL){ B.pl[k] = B.plMax[k] = hp * C.plates[k]; }
  e.guard = { kind:'fort', x:f.x, z:f.z, r:f.R, fort:f }; e.post = [D.x + D.ux * 6, D.z + D.uz * 6];
  B.e = e; B.st = 'intro'; B.until = now + C.intro.hold; e.held = true; const t = now + C.intro.hold; B.next.sweep = t + 2.5; B.next.nade = t + 4; B.next.charge = t + 5;
  S.timeScale = Math.min(S.timeScale || 1, C.intro.slow); S.shake = Math.max(S.shake || 0, 0.9);
  bigExplode({ x:D.x, z:D.z }, 0xffa050, 0.6); ringPulse({ x:D.x, z:D.z }, 0xff6a3a, 4);
  floatText(def.name, '#ff9a4a', { x:D.x, y:heightAt(D.x, D.z) + 3.6, z:D.z }, 24);
  if(def.capital){ storyCue('general', def.id); } radio(def.name + ': Thằng lính đó đây rồi. Tới nộp mạng à?', 'gen_meet');
  bar(B, true); return true; }
// the damage hook (actors/damage.js damageEnemy): the armour, the weak points, the blade's finish
export function fortBossDmg(e, dmg){ const B = e.fortBoss; if(!B || B.st === 'dead') return dmg; if(B.st === 'intro' || B.st === 'pending') return 0;
  const hp = e.maxHp, now = NOW(); let raw = Math.min(dmg, hp * C.hitCap);
  if(e._bladeHit > 0 && B.st === 'stagger'){ if(e.hp / hp < C.blade.finish){ e._quietKill = true; floatText('KẾT LIỄU!', '#ffd24a', { x:e.pos.x, y:heightAt(e.pos.x, e.pos.z) + 3.4, z:e.pos.z }, 26); B.finish = true; return e.hp + 1; }
    raw = Math.min(dmg * C.blade.k, hp * C.hitCap * C.blade.k); }
  let bx, bz; if(e._blast){ bx = e._blast.x - e.pos.x; bz = e._blast.z - e.pos.z; } else { bx = -(e._hx || 0); bz = -(e._hz || 0); }
  const rel = (bx || bz) ? wrapA(Math.atan2(bx, bz) - e.facing) : 0, z = fortBossZone(rel, B.pl, Math.random(), !!(B.look && B.look.look && B.look.look.pack === 'belt')); let out;
  if(z === 'head'){ out = raw * C.headK; mark(B, 'ĐẦU!', '#ff6a4a', now); }
  else if(z === 'body') out = raw;
  else if(z === 'back'){ out = raw * C.backK; mark(B, 'LƯNG HỞ!', '#ffb04a', now); }
  else { const pack = z === 'pack'; B.pl[z] -= raw; out = raw * (pack ? C.packK : C.armK);
    if(pack) mark(B, 'ĐIỂM YẾU!', '#ffd24a', now); else if(Math.random() < 0.3){ e.mesh.updateMatrixWorld(); const g = B.look.plates[z]; if(g){ g.getWorldPosition(_m); spawnPart(_m.x, _m.y, _m.z, (Math.random() - 0.5) * 5, 2 + Math.random() * 3, (Math.random() - 0.5) * 5, { color:0xffe0a0, size:0.22, life:0.2, grav:10, drag:1 }); } if(Math.random() < 0.15) sfx('ricochet', e.pos, 0.5); }
    if(B.pl[z] <= 0){ B.pl[z] = 0; plateGone(B, z, now, -bx, -bz); if(pack) out += hp * C.packBoom; } }
  if(out >= e.hp) e._quietKill = true;   // (he does not fly: he folds forward like a felled tree — actors/infantry.js infantryDown)
  B.dmgIn += out; if(out > 0) fortBossFlash(B.look); return out; }
function mark(B, t, col, now){ if(now < B.hitTxtAt) return; B.hitTxtAt = now + 0.7; const e = B.e; floatText(t, col, { x:e.pos.x, y:heightAt(e.pos.x, e.pos.z) + 3.2, z:e.pos.z }, 15); }
const PLATE_VI = { helmet:'MŨ SẮT', chest:'GIÁP NGỰC', shL:'GIÁP VAI TRÁI', shR:'GIÁP VAI PHẢI', pack:'BỘ NGUỒN LƯNG' };
function plateGone(B, z, now, ux, uz){ fortBossAct(B.look, 'hit', now); const e = B.e, L = Math.hypot(ux || 0, uz || 0) || 1; fortBossPlateOff(B.look, z, (ux || 0) / L, (uz || 0) / L, z === 'pack'); sfx('clang', e.pos); sfx('hitHeavy', e.pos, 0.8);
  floatText('VỠ ' + PLATE_VI[z] + '!', '#ffd24a', { x:e.pos.x, y:heightAt(e.pos.x, e.pos.z) + 3.8, z:e.pos.z }, 18);
  if(z === 'pack'){ e.mesh.updateMatrixWorld(); bigExplode({ x:e.pos.x - Math.sin(e.facing) * 0.6, z:e.pos.z - Math.cos(e.facing) * 0.6 }, 0x6ad8ff, 0.9); stagger(B, now, C.stagger.pack); showBanner('BỘ NGUỒN NỔ — ' + B.def.name + ' CHOÁNG!', '#ffd24a'); }
  else { if(z === 'helmet') showBanner('MŨ SẮT VỠ — BẮN VÀO ĐẦU!', '#ffb04a'); stagger(B, now, C.stagger.plate); }
  sync(B); }
function sync(B){ emit(C.cue.PLATE, B.fi, fortBossBits(B.pl, B.phase, B.st === 'stagger')); }
function stagger(B, now, T){ if(B.st === 'dead') return; const was = B.st === 'stagger' ? B.until : 0; endAct(B); B.st = 'stagger'; B.until = Math.max(was, now + T); B.e.held = true; B.gap = Math.max(B.gap, now + T + 1); floatText('CHOÁNG!', '#9be0ff', { x:B.e.pos.x, y:heightAt(B.e.pos.x, B.e.pos.z) + 3, z:B.e.pos.z }, 18); }
function endAct(B){ B.act = null; laser(B, false); }
// ---- once a frame in battle (game/loop.js) ----
export function updateFortBoss(dt, now){ fortBossLookTick(dt); fortBossCorpseTick(dt); preload(); if(!FBOSS.list.length) return;
  for(const B of FBOSS.list){ if(B.st === 'gone') continue;
    if(B.st === 'pending'){ if(now >= B.until && S.player && !spawn(B, now)) B.until = now + 1; continue; }
    const e = B.e; if(!e) continue; tickZones(B, dt, now);
    if(!B.told && (e.nid || !(CO.host && CO.live))){ B.told = true; emit(C.cue.APPEAR, B.fi, e.nid || 0, B.door.x, B.door.z); }   // (co-op: once the snapshot has given him an id)
    if(B.st === 'dead') continue;
    if(!enemies.includes(e) || !(e.hp > 0)){ down(B, now); continue; }
    step(B, dt, now); } }
function step(B, dt, now){ const e = B.e, f = B.f, H = home(f), fo = foe(e), ox = e.pos.x, oz = e.pos.z, k = e.hp / e.maxHp;
  e.dazeUntil = 0; if(e.burn) e.burn.k = 0.3; e.stunUntil = 0;
  if(B.phase < 2 && k < C.phase[0]) phase(B, 2, now); if(B.phase < 3 && k < C.phase[1]) phase(B, 3, now);
  if(B.st === 'intro'){ const D = B.door; e.pos.x += D.ux * C.intro.walk * dt; e.pos.z += D.uz * C.intro.walk * dt; infPushBlocks(e.pos); place(e, Math.atan2(D.ux, D.uz), dt, 'stand', false, ox, oz);
    if(now >= B.until){ B.st = 'free'; e.held = false; } }
  else if(B.st === 'stagger'){ place(e, e.facing, dt, 'crouch', false, ox, oz); const u = e.mesh.userData; if(u.head) u.head.rotation.z = Math.sin(now * 3.1) * 0.3;
    if(Math.random() < dt * 8) spawnPart(e.pos.x + (Math.random() - 0.5), heightAt(e.pos.x, e.pos.z) + 2.4, e.pos.z + (Math.random() - 0.5), 0, 1.4, 0, { color:0x30302c, size:1.2, life:1, smoke:true, grav:-0.4, drag:1, op:0.4 });
    if(now >= B.until){ B.st = 'free'; e.held = false; sync(B); } }
  else if(B.st === 'sweep') sweepStep(B, dt, now, ox, oz);
  else if(B.st === 'charge') chargeStep(B, dt, now, ox, oz, fo);
  else if(B.st === 'rocket') rocketStep(B, dt, now, ox, oz, fo);
  else free(B, dt, now, fo, H);
  { const dx = e.pos.x - H.x, dz = e.pos.z - H.z, q = Math.hypot(dx, dz); if(q > H.r + 2){ e.pos.x = H.x + dx / q * (H.r + 2); e.pos.z = H.z + dz / q * (H.r + 2); } }   // the leash: never out of his walls
  B.stepD += Math.hypot(e.pos.x - ox, e.pos.z - oz); if(B.stepD > C.step){ B.stepD = 0; footfall(e); }
  fortBossGlow(B.look, dt, 1 - k, B.phase === 3); guardsFollow(B, now); bar(B, true);
  { const v = dt > 0 && B.lx != null ? Math.hypot(e.pos.x - B.lx, e.pos.z - B.lz) / dt : 0, A = B.act, cs = B.st === 'charge' && A && A.t < C.charge.tel ? 'chargeT' : B.st;   // BOSS 2 his motion
    B.lx = e.pos.x; B.lz = e.pos.z; if(B.look){ B.look.aimX = fo.x; B.look.aimZ = fo.z; }   /* BGUN his gun pitched to his man (actors/fort-boss-glb.js hold) */ fortBossAnim(B.look, dt, cs, v, now - (e.shotAt || -9) < 0.3 || (B.st === 'sweep' && A && A.t > C.sweep.tel) || (B.st === 'rocket' && A && A.t > C.rocket.tel), now); } }
// pose and draw him this frame when this file moves him (held: the infantry AI skips him — ai/tactics.js)
function place(e, face, dt, st, firing, ox, oz){ e.facing = face; e.mesh.position.set(e.pos.x, heightAt(e.pos.x, e.pos.z), e.pos.z); e.mesh.rotation.y = face;
  animateSoldier(e.mesh, Math.hypot(e.pos.x - ox, e.pos.z - oz) / e.def.scale, dt, firing); poseSoldier(e.mesh, st, dt); }
function footfall(e){ const pd = S.player ? Math.hypot(S.player.pos.x - e.pos.x, S.player.pos.z - e.pos.z) : 99; const gy = heightAt(e.pos.x, e.pos.z); sfx('thud', e.pos, 0.55); burst({ x:e.pos.x, z:e.pos.z }, BIOME.ground, 3, 1.2, { y:gy + 0.15, life:0.7, size:1.1, smoke:true, grav:-0.2, drag:2.4, up:0.6, op:0.35 });
  if(pd < 24) S.shake = Math.max(S.shake || 0, 0.12 * (1 - pd / 24)); }
function phase(B, n, now){ B.phase = n; const e = B.e, nm = B.def.name;
  if(n === 2){ showBanner(nm + ' GỌI CẬN VỆ!', '#ff9a4a'); radio(nm + ': Cận vệ đâu! Giết thằng lính đó cho ta!', 'gen_guard'); sfx('alarm'); if(B.def.capital) storyCue('general_half', B.def.id); callGuards(B, now); B.next.charge = Math.max(B.next.charge, now + 3); }
  else { showBanner(nm + ' NỔI ĐIÊN — GIÁP VỠ GẦN HẾT!', '#ff4a3a'); radio(nm + ': Ta chưa thua đâu!', 'gen_rage'); if(B.def.capital) storyCue('general_rage', B.def.id);
    for(const z of ['helmet', 'shL', 'shR']) if(B.pl[z] > 0){ B.pl[z] = 0; fortBossPlateOff(B.look, z, 0, 0, true); }
    bigExplode({ x:e.pos.x, z:e.pos.z }, 0xff5a2a, 0.5); sfx('clang', e.pos);
    e.def = { ...e.def, speed:C.move.speed * C.move.rage, fireCd:C.fire.fireCd * C.fire.rage }; stagger(B, now, 1.2); }
  sync(B); }
function callGuards(B, now){ const f = B.f, D = B.door, n = (C.guards.n[B.def.tier - 1] || 3);
  for(let i = 0; i < n; i++){ const a = Math.random() * 6.283, [x, z] = clampFieldXZ(D.x + Math.cos(a) * 2, D.z + Math.sin(a) * 2, 4), g = spawnEnemy(i % 3 === 2 ? 'rpg' : 'rifle', x, z, 'door'); if(!g) continue;
    g.genGuard = true; g.fortOf = f; g.maxHp = g.hp = Math.round(g.maxHp * C.guards.hpK); g.loot = Math.random() < 0.3; g.escA = i / n * 6.283; g.escR = 4 + Math.random() * 3; g.guard = { kind:'escort', fort:f }; g.post = [x, z]; B.guards.push(g); }
  emit(C.cue.ATK, B.fi, 4, D.x, D.z); }
function guardsFollow(B, now){ if(((now * 4) | 0) === B._gf) return; B._gf = (now * 4) | 0; const e = B.e, H = home(B.f);
  for(let i = B.guards.length - 1; i >= 0; i--){ const g = B.guards[i]; if(!enemies.includes(g)){ B.guards.splice(i, 1); continue; } g.escA += 0.08; let x = e.pos.x + Math.cos(g.escA) * g.escR, z = e.pos.z + Math.sin(g.escA) * g.escR;
    const q = Math.hypot(x - H.x, z - H.z); if(q > H.r){ x = H.x + (x - H.x) / q * H.r; z = H.z + (z - H.z) / q * H.r; } g.post = [x, z]; } }
// FREE: the rifleman's own AI moves and fires him (actors/infantry.js), to the spot set here; the big moves start from here
function free(B, dt, now, fo, H){ const e = B.e; e.held = false;
  if(now >= B.postAt){ B.postAt = now + 0.9; e.post = spotFor(B, fo, H); }
  if(now >= B.stuckAt){ const mv = Math.hypot(e.pos.x - B.sx, e.pos.z - B.sz), far = Math.hypot(e.pos.x - e.post[0], e.pos.z - e.post[1]);
    if(B.stuckAt && far > 3 && mv < 0.5){ B.stuckN++; const a = Math.random() * 6.283, r = H.r * (0.2 + Math.random() * 0.35); e.post = [H.x + Math.cos(a) * r, H.z + Math.sin(a) * r]; B.postAt = now + 2.5; }
    B.sx = e.pos.x; B.sz = e.pos.z; B.stuckAt = now + C.move.stuck; }
  if(now < B.gap || !S.player) return; const P = B.phase - 1, d = fo.d, clear = !fortIntactCross(e.pos.x, e.pos.z, fo.x, fo.z) && !losBlocked(e.pos.x, e.pos.z, fo.x, fo.z);
  if(C.charge.cd[P] && now > B.next.charge && d > C.charge.min && d < C.charge.max && clear){ startCharge(B, now, fo); return; }
  if(now > B.next.sweep && d < C.move.range && clear){ startSweep(B, now, fo); return; }
  if(C.nade.cd[P] && now > B.next.nade && d < 30 && clear) alt(B, now, fo); }
// his spot: keep m from his man on the line between them, inside his walls, clear of the keep / the command post
function spotFor(B, fo, H){ const e = B.e, f = B.f; let x, z; const dx = e.pos.x - fo.x, dz = e.pos.z - fo.z, d = Math.hypot(dx, dz) || 1;
  if(Math.hypot(fo.x - H.x, fo.z - H.z) > f.R + 4){ const a = Math.atan2(fo.x - H.x, fo.z - H.z); x = H.x + Math.sin(a) * H.r * 0.8; z = H.z + Math.cos(a) * H.r * 0.8; }   // his man outside: he holds the yard on that side
  else { x = fo.x + dx / d * C.move.keep; z = fo.z + dz / d * C.move.keep; }
  const q = Math.hypot(x - H.x, z - H.z); if(q > H.r){ x = H.x + (x - H.x) / q * H.r; z = H.z + (z - H.z) / q * H.r; }
  for(const [cx, cz, r] of [[f.keepX, f.keepZ, (f.keepR || 0) + 1.5], [f.coreX, f.coreZ, (f.coreR || 0) + 1]]){ if(!(r > 2) || cx == null) continue; const kx = f.x + cx, kz = f.z + cz, kd = Math.hypot(x - kx, z - kz); if(kd < r){ x = kx + (x - kx) / (kd || 1) * r; z = kz + (z - kz) / (kd || 1) * r; } }
  const p = { x, z }; infPushBlocks(p); return [p.x, p.z]; }
// ---- the laser sight: the warning of a sweep / a charge / a rocket (a thin red beam from his gun, no ring on the ground) ----
let _beamG = null;
function laser(B, on, a, len){ if(!on){ if(B.laser) B.laser.visible = false; return; }
  if(!B.laser){ _beamG = _beamG || new THREE.CylinderGeometry(0.035, 0.035, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const m = new THREE.Mesh(_beamG, new THREE.MeshBasicMaterial({ color:0xff2a1a, transparent:true, opacity:0.75, blending:THREE.AdditiveBlending, depthWrite:false })); m.frustumCulled = false; scene.add(m); B.laser = m; }
  const e = B.e, mz = muzzle(e), L = B.laser; L.visible = true; L.position.copy(mz); L.rotation.set(0, a, 0); L.scale.set(1, 1, len || 26); L.material.opacity = 0.45 + Math.random() * 0.4; }
function muzzle(e){ const m = e.mesh.userData.muzzle; if(m){ e.mesh.updateMatrixWorld(); m.getWorldPosition(_m); } else _m.set(e.pos.x, heightAt(e.pos.x, e.pos.z) + 2, e.pos.z); return _m; }
// ---- SWEEP: tel s of glint + the laser crossing the arc, then n rounds a pass across it ----
function startSweep(B, now, fo){ const e = B.e, K = B.def.kind, a0 = Math.atan2(fo.x - e.pos.x, fo.z - e.pos.z), arc = C.sweep.arc * (K.arcK || 1), pass = C.sweep.pass[B.phase - 1] || 1;
  B.st = 'sweep'; e.held = true; B.act = { a0, arc, t:0, pass, n:Math.round(C.sweep.n * (K.n || 1)), fired:0, dir:Math.random() < 0.5 ? -1 : 1, mate:{ hit:0 } };
  B.next.sweep = now + C.sweep.cd[B.phase - 1] + C.sweep.tel + C.sweep.dur * pass; B.gap = now + C.sweep.tel + C.sweep.dur * pass + 1.2;
  sfx('beep', e.pos); sfx('lockwarn'); floatText('!', '#ff4a3a', { x:e.pos.x, y:heightAt(e.pos.x, e.pos.z) + 3.4, z:e.pos.z }, 30); emit(C.cue.ATK, B.fi, 1, fo.x, fo.z); }
function sweepStep(B, dt, now, ox, oz){ const e = B.e, A = B.act, T = C.sweep.tel, Du = C.sweep.dur; A.t += dt;
  if(A.t < T){ const u = A.t / T, a = A.a0 + A.dir * (Math.sin(u * Math.PI * 2) * 0.5) * A.arc; laser(B, true, a, C.move.range); place(e, A.a0, dt, 'stand', false, ox, oz);
    if(Math.random() < 0.6){ const m = muzzle(e); spawnPart(m.x, m.y, m.z, 0, 0, 0, { tex:'flash', color:0xff3a2a, size:0.7 + Math.random() * 0.4, life:0.06, grav:0, drag:0 }); } return; }
  laser(B, false); const s = A.t - T, i = Math.floor(s / Du), u = (s - i * Du) / Du; if(i >= A.pass){ endAct(B); B.st = 'free'; e.held = false; return; }
  const dir = A.dir * (i % 2 ? -1 : 1), a = A.a0 + dir * (u - 0.5) * A.arc; place(e, a, dt, 'stand', true, ox, oz);
  const want = Math.floor((i + u) * A.n); const K = B.def.kind, dmg = C.sweep.dmg * (K.dmgK || 1) * (1 + 0.1 * ((S.stage || 1) - 1));
  while(A.fired < want){ A.fired++; const m = muzzle(e), aa = A.a0 + dir * ((A.fired - i * A.n) / A.n - 0.5) * A.arc + (Math.random() - 0.5) * 0.03;
    spawnBullet(m.x, m.z, aa, { owner:'e', inf:true, dmg, speed:C.sweep.speed, color:0xffb050, r:K.r || 0.2, trailK:2, life:1.4, maxDist:C.move.range + 6, noArc:true, y:m.y, dropTo:1.3 });
    if(CO.ai && MATE.on){ const am = Math.atan2(MATE.x - m.x, MATE.z - m.z), dm = Math.hypot(MATE.x - m.x, MATE.z - m.z); if(dm < C.move.range && Math.abs(wrapA(am - aa)) < 0.5 / Math.max(2, dm) && !losBlocked(m.x, m.z, MATE.x, MATE.z)) coopHurtMate(dmg, Math.sin(aa), Math.cos(aa)); }
    muzzleFX(m.x, m.y, m.z, aa, 'mg', 'e', 0, e.mesh.userData.muzzle || null); if(A.fired % 3 === 0) sfx('rifleShot', e.pos, 0.8); } }   // GUNFX 1 every round of the sweep flashes (an MG's blossom), 1 in 4 a tracer
// ---- CHARGE: tel s crouched behind his laser down the lane, then a straight rush; contact = a heavy blow, a wall = he staggers ----
function startCharge(B, now, fo){ const e = B.e, a = Math.atan2(fo.x - e.pos.x, fo.z - e.pos.z); B.st = 'charge'; e.held = true;
  B.act = { a, t:0, hit:false, len:Math.min(C.charge.v * C.charge.t, fo.d + 6) }; B.next.charge = now + C.charge.cd[B.phase - 1] + C.charge.tel + C.charge.t; B.gap = now + C.charge.tel + C.charge.t + 1.5;
  sfx('horn', e.pos); floatText('XUNG PHONG!', '#ff4a3a', { x:e.pos.x, y:heightAt(e.pos.x, e.pos.z) + 3.4, z:e.pos.z }, 20); emit(C.cue.ATK, B.fi, 3, fo.x, fo.z); }
function chargeStep(B, dt, now, ox, oz, fo){ const e = B.e, A = B.act, T = C.charge.tel; A.t += dt;
  if(A.t < T){ laser(B, true, A.a, A.len); place(e, A.a, dt, 'low', false, ox, oz); if(Math.random() < dt * 10) burst({ x:e.pos.x, z:e.pos.z }, BIOME.ground, 1, 1, { y:heightAt(e.pos.x, e.pos.z) + 0.2, life:0.5, size:0.8, smoke:true, grav:-0.2, drag:2, up:0.5, op:0.3 }); return; }
  laser(B, false); const vx = Math.sin(A.a) * C.charge.v, vz = Math.cos(A.a) * C.charge.v, px = e.pos.x, pz = e.pos.z, nx = px + vx * dt, nz = pz + vz * dt;
  const H = home(B.f); let wall = !!fortIntactCross(px, pz, nx, nz); if(!wall){ e.pos.x = nx; e.pos.z = nz; infPushBlocks(e.pos); const got = Math.hypot(e.pos.x - px, e.pos.z - pz); wall = got < C.charge.v * dt * 0.35; }
  place(e, A.a, dt, 'stand', false, ox, oz);
  if(!A.hit){ const p = S.player, R = C.charge.r + 0.5; for(const t of [p.pos, CO.ai && MATE.on ? MATE : null]){ if(!t) continue; const dx = t.x - e.pos.x, dz = t.z - e.pos.z, d = Math.hypot(dx, dz); if(d > R) continue;
      A.hit = true; if(t === p.pos){ damagePlayer(C.charge.dmg, now, vx, vz, 'blast'); S.shake = Math.max(S.shake || 0, 1.4); S.camKick = Math.min(1.2, (S.camKick || 0) + 0.8); if(p.vel){ p.vel.x += Math.sin(A.a) * C.charge.push; p.vel.z += Math.cos(A.a) * C.charge.push; } }
      else coopHurtMate(C.charge.dmg, vx, vz); sfx('crunch', e.pos); } }
  if(wall){ sfx('crunch', e.pos); sfx('clang', e.pos); S.shake = Math.max(S.shake || 0, 0.8); burst({ x:e.pos.x, z:e.pos.z }, 0x8a7a60, 8, 3, { y:heightAt(e.pos.x, e.pos.z) + 1.5, life:1, size:1.6, smoke:true, grav:-0.3, drag:1.6, up:1.5, op:0.5 });
    showBanner(B.def.name + ' ĐÂM VÀO TƯỜNG — CHOÁNG!', '#9be0ff'); stagger(B, now, C.stagger.wall); sync(B); return; }
  if(A.t > T + C.charge.t || Math.hypot(e.pos.x - H.x, e.pos.z - H.z) > H.r + 1){ endAct(B); B.st = 'free'; e.held = false; } }
// ---- his second weapon: hand grenades · the launcher's volley · shoulder rockets ----
function alt(B, now, fo){ const e = B.e, K = B.def.kind, P = B.phase - 1; B.next.nade = now + C.nade.cd[P]; B.gap = now + 1.4;
  if(K.alt === 'rocket'){ B.st = 'rocket'; e.held = true; B.act = { t:0, n:0, fo }; sfx('beep', e.pos); floatText('TÊN LỬA!', '#ff4a3a', { x:e.pos.x, y:heightAt(e.pos.x, e.pos.z) + 3.4, z:e.pos.z }, 18); emit(C.cue.ATK, B.fi, 5, fo.x, fo.z); B.gap = now + C.rocket.tel + C.rocket.n * C.rocket.gap + 1.2; return; }
  fortBossAct(B.look, 'throw', now); const gl = K.alt === 'gl', n = gl ? C.gl.n : C.nade.n, sc = gl ? C.gl.scatter : C.nade.scatter, m = muzzle(e), dmg = C.nade.dmg * (1 + 0.1 * ((S.stage || 1) - 1));
  floatText(gl ? 'PHÓNG LỰU!' : 'LỰU ĐẠN!', '#ff9a4a', { x:e.pos.x, y:heightAt(e.pos.x, e.pos.z) + 3.2, z:e.pos.z }, 16); sfx(gl ? 'shoot_agl' : 'whoosh', e.pos); emit(C.cue.ATK, B.fi, 2, fo.x, fo.z);
  for(let i = 0; i < n; i++){ const a = Math.random() * 6.283, r = i === 0 ? 0.5 : 1.6 + Math.random() * sc, Tt = C.nade.lock + i * (gl ? 0.15 : 0.2), [x, z] = clampFieldXZ(fo.x + Math.cos(a) * r, fo.z + Math.sin(a) * r, 2);
    spawnPart(m.x, m.y, m.z, (x - m.x) / Tt, 0.5 * 14 * Tt, (z - m.z) / Tt, { color:0x3a4020, size:0.2, life:Tt, grav:-14, drag:0 });
    B.zones.push({ x, z, R:C.nade.R, t:Tt, T:Tt, dmg, zone:makeArtLock(x, z, C.nade.R, C.nade.R * 0.4) }); } }
function rocketStep(B, dt, now, ox, oz, fo){ const e = B.e, A = B.act, R = C.rocket; A.t += dt; const a = Math.atan2(fo.x - e.pos.x, fo.z - e.pos.z); place(e, a, dt, 'crouch', false, ox, oz);
  if(A.t < R.tel){ laser(B, true, a, Math.min(fo.d, C.move.range)); return; } laser(B, false);
  if(A.t >= R.tel + A.n * R.gap && A.n < R.n){ A.n++; const m = muzzle(e), aa = a + (Math.random() - 0.5) * 0.08; launchEnemyMissile(m.x, m.y, m.z, aa, { speed:R.speed, dmg:R.dmg, aoe:R.aoe, life:2.6, kind:'rpg' }); sfx('rocketlaunch', e.pos);
    spawnPart(m.x - Math.sin(aa) * 1.2, m.y, m.z - Math.cos(aa) * 1.2, -Math.sin(aa) * 6, 0.5, -Math.cos(aa) * 6, { color:0xd8d0c0, size:1.6, life:0.6, smoke:true, grav:0.3, drag:2, op:0.5 }); }
  if(A.n >= R.n && A.t > R.tel + R.n * R.gap){ endAct(B); B.st = 'free'; e.held = false; } }
function tickZones(B, dt, now){ for(let i = B.zones.length - 1; i >= 0; i--){ const s = B.zones[i]; s.t -= dt; tickArtLock(s.zone, 1 - Math.max(0, s.t) / s.T, null, now, dt); if(s.t > 0) continue;
    disposeArtZone(s.zone); B.zones.splice(i, 1); bigExplode({ x:s.x, z:s.z }, 0xffb060, 0.55); sfx('boom', { x:s.x, z:s.z }, 0.7); hurtAt(s.x, s.z, s.R, s.dmg, now, 'blast'); } }
// ---- HE FALLS: the fort is taken ----
function down(B, now){ const e = B.e, f = B.f, def = B.def; B.st = 'dead'; B.tDown = now; endAct(B); if(B.laser){ scene.remove(B.laser); B.laser.material.dispose(); B.laser = null; }
  fortBossStrip(B.look, true); bar(B, false); S.timeScale = 0.3; S.shake = Math.max(S.shake || 0, 1.2);
  bigExplode({ x:e.pos.x, z:e.pos.z }, 0xffa040, 1.1); ringPulse({ x:e.pos.x, z:e.pos.z }, 0xffd24a, 6); sfx('levelup');
  showBanner('ĐÃ HẠ ' + def.name + '!', '#ffd24a', true);
  if(!(def.capital && nemFell()) && !(def.capital && storyCue('general_down', def.id))) radio('SCH: Tướng giữ thành đã gục! Quét sạch tàn quân!', 'fort_chief');
  for(const g of B.guards) if(enemies.includes(g)){ g.def = { ...g.def, range:0, keep:90, speed:g.def.speed * 1.3 }; g.genGuard = false; g.guard = null; g.post = null; floatText('BỎ CHẠY!', '#e0e0d0', { x:g.pos.x, y:2.4, z:g.pos.z }, 13); }
  { const p = S.player, dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1, [x, z] = clampFieldXZ(e.pos.x + dx / d * 3, e.pos.z + dz / d * 3, 6);   // the HQ's gift: a reward and ammunition
    const u = spawnGift({ x, z }, () => { const c = soldierStagePerks()[0]; if(c){ c.apply(S.player); showBanner('CHIẾN LỢI PHẨM: ' + c.nm, '#ffd86a'); } ammoCrate(1); }); if(u && CO.ai) coopHostCrate(u); FBOSS.crate = !!u; }
  const k = FBOSS.seq; setTimeout(() => { if(k !== FBOSS.seq || S.mode === 'gameover') return; emit(C.cue.TAKEN, B.fi, 0, f.x, f.z);
    if(def.capital) bossStageWon(NOW(), def.bdef); else fortTake(f, false); B.st = 'gone'; }, 1400); }
// CONQ 1 the ice core: he stands frozen T s (a stagger: his plates, his pack and the blade's finish open to him)
export function fortBossFreeze(e, now, T){ const B = e && e.fortBoss; if(!B || B.st === 'dead' || B.st === 'intro' || B.st === 'pending') return false; stagger(B, now, T); return true; }
// the boss bar (index.html #bossbar): his name, his health, what is going on
function bar(B, on){ const bb = document.getElementById('bossbar'); if(!bb) return; if(!on){ if(FBOSS.barB === B){ bb.style.display = 'none'; FBOSS.barB = null; } return; }
  if(FBOSS.barB !== B){ FBOSS.barB = B; FBOSS.barK = ''; bb.style.display = 'block'; const nm = document.getElementById('boss-name'); if(nm){ if(B.def.capital) nemPlateEl(nm, B.def.id, B.def.name); else nm.textContent = B.def.name; } }
  const e = B.e, hp = document.getElementById('boss-hp'), k = e ? Math.max(0, e.hp / e.maxHp) : 1; if(hp) hp.style.width = (k * 100).toFixed(1) + '%';
  const live = B.guards ? B.guards.filter(g => enemies.includes(g)).length : 0, nPl = PL.filter(z => B.pl[z] > 0).length, key = B.phase + '|' + nPl + '|' + (B.st === 'stagger') + '|' + live, st = document.getElementById('boss-st');
  if(st && FBOSS.barK !== key){ FBOSS.barK = key; st.textContent = ''; const b = document.createElement('b'); b.className = B.phase === 3 ? 'vu' : 'sh';
    b.textContent = (B.st === 'stagger' ? 'CHOÁNG! · ' : B.phase === 3 ? 'NỔI ĐIÊN · ' : '') + B.def.sub + ' · GIÁP ' + nPl + '/5' + (live ? ' · CẬN VỆ ' + live : ''); st.appendChild(b); } }
// a new battlefield (world/fortress.js clearForts)
export function fortBossReset(){ FBOSS.seq++; for(const B of FBOSS.list){ for(const z of B.zones) disposeArtZone(z.zone); if(B.laser){ scene.remove(B.laser); B.laser.material.dispose(); } if(B.look) fortBossStrip(B.look, false); }
  FBOSS.list.length = 0; for(const g of FBOSS.guest.values()) if(g.look) fortBossStrip(g.look, false); FBOSS.guest.clear(); fortBossLookClear(); fortBossCorpsesClear(); FBOSS.pre = false; const bb = document.getElementById('bossbar'); if(bb && FBOSS.barB) bb.style.display = 'none'; FBOSS.barB = null; }
// dev / probes: the fort's first force dies at once (it wakes first if it slept) — the boss comes out by the ordinary rule
export function fortBossDebugClear(f){ const now = NOW(); if(!f.active) wakeFort(f, now); for(const e of f.units.slice()) if(enemies.includes(e)){ e.hp = 0; killEnemy(e); }
  f.pool.inf = 0; f.tunnel = 0; f.tunnelWait = 0; f.leaderless = true; }

// ================= THE GUEST'S PAGE =================
// the host's word (game/coop-glue.js, a CUE event): true when it was one of ours
export function fortBossCue(p, a, b, x, z){ const Q = C.cue; if(p !== Q.APPEAR && p !== Q.PLATE && p !== Q.ATK && p !== Q.TAKEN) return false; const f = FORTS[a]; if(!f) return true; const now = NOW();
  let G = FBOSS.guest.get(a);
  if(p === Q.APPEAR){ if(G) return true; G = { f, fi:a, nid:b, def:fortBossDef(f), e:null, look:null, bits:0, phase:1, pl:{ helmet:1, chest:1, shL:1, shR:1, pack:1 }, guards:[], st:'free', laser:null, act:null, dead:false };
    FBOSS.guest.set(a, G); f.boss = G; sfx('horn'); sfx('alarm'); showBanner('⚠ ' + G.def.name + ' XUẤT TRẬN!', '#ff7a3a'); return true; }
  if(!G) return true;
  if(p === Q.PLATE){ for(let i = 0; i < PL.length; i++) if((b & (1 << i)) && G.pl[PL[i]] > 0){ G.pl[PL[i]] = 0; if(G.look) fortBossPlateOff(G.look, PL[i], 0, 0, PL[i] === 'pack'); }
    const ph = (b >> 5) & 3; if(ph > G.phase){ G.phase = ph; showBanner(G.def.name + (ph === 2 ? ' GỌI CẬN VỆ!' : ' NỔI ĐIÊN!'), '#ff6a3a'); } G.st = (b & 128) ? 'stagger' : 'free'; return true; }
  if(p === Q.ATK){ if(G.e){ G.act = { k:b, t:0, a:Math.atan2(x - G.e.pos.x, z - G.e.pos.z) }; floatText(b === 1 ? '!' : b === 3 ? 'XUNG PHONG!' : b === 5 ? 'TÊN LỬA!' : b === 2 ? 'LỰU ĐẠN!' : 'CẬN VỆ!', '#ff4a3a', { x:G.e.pos.x, y:heightAt(G.e.pos.x, G.e.pos.z) + 3.4, z:G.e.pos.z }, 20); } return true; }
  if(p === Q.TAKEN){ G.dead = true; if(G.look) fortBossStrip(G.look, true); bar(G, false); fortTake(f, true); return true; }
  return true; }
// once a frame on the guest's page (game/coop-puppets.js coopGuestPlay)
export function fortBossGuest(dt, now){ fortBossLookTick(dt); fortBossCorpseTick(dt); fortFlagsTick(dt); preload(); if(!FBOSS.guest.size) return;
  for(const G of FBOSS.guest.values()){ if(G.dead) continue; if(!G.e){ const e = coopEnemyById(G.nid); if(!e) continue; G.e = e; G.look = fortBossLook(e, G.def); e.rK = G.look.k; e.def = { ...e.def, scale:(e.def.scale || 1) * G.look.k };
      for(const k of PL) if(!(G.pl[k] > 0)) fortBossPlateOff(G.look, k, 0, 0, false); }
    const e = G.e; if(!enemies.includes(e) || !(e.hp > 0)){ G.dead = true; fortBossStrip(G.look, true); bar(G, false); continue; }
    { const v = dt > 0 && G.lx != null ? Math.hypot(e.pos.x - G.lx, e.pos.z - G.lz) / dt : 0, a = G.act, k = a && a.k; G.lx = e.pos.x; G.lz = e.pos.z;   // BOSS 2 his motion from what the host says he does
      fortBossAnim(G.look, dt, G.st === 'stagger' ? 'stagger' : k === 3 ? (a.t < C.charge.tel ? 'chargeT' : 'charge') : k === 1 ? 'sweep' : k === 5 ? 'rocket' : 'free', v, !!a && (k === 1 && a.t > C.sweep.tel || k === 5 && a.t > C.rocket.tel), now); }
    fortBossGlow(G.look, dt, 1 - e.hp / e.maxHp, G.phase === 3); if(G.act){ G.act.t += dt; const tel = G.act.k === 1 ? C.sweep.tel : G.act.k === 3 ? C.charge.tel : G.act.k === 5 ? C.rocket.tel : 0; const keep = G.act.t < tel, dur = G.act.k === 1 ? C.sweep.dur * (C.sweep.pass[G.phase - 1] || 1) : G.act.k === 3 ? C.charge.t : G.act.k === 5 ? C.rocket.n * C.rocket.gap : 0; if(keep) laserG(G, G.act.a + (G.act.k === 1 ? Math.sin(G.act.t / tel * Math.PI * 2) * 0.5 * C.sweep.arc : 0)); else { if(G.laser) G.laser.visible = false; if(G.act.t > tel + dur) G.act = null; } }
    bar(G, true); } }
function laserG(G, a){ laser(G, true, a, C.move.range); }
