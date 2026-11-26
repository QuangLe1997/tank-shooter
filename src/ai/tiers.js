// ai/tiers.js — DIR 2 TACTICS BY TIER: what the enemy's foot squads know how to do grows with the stage (tacTier 1…3; DIRECTOR.tactics, ?notactics = as before).
//   TIER 1 — riflemen who advance, take cover and fire (the squad bounds straight in: no flank).
//   TIER 2 — PIN AND FLANK: a squad in contact splits into a base of fire that lies down and pins him and a flanking team that works round one side — low, silent,
//     cover to cover on a widening arc — and opens up from there. He is told: the squad leader's shout, and the radio names the side as he sees it.
//   TIER 3 — GRENADES flush a man who has sat in the same spot too long (a shout of "LỰU ĐẠN!", a sparking arc, a fuse on the ground: time to move) · a MARKSMAN
//     who keeps his distance and holds a lane (a white glint off his scope ~1 s before the one heavy round, aimed where the man was a moment before it) · a
//     MACHINE-GUN man who stays down and hoses long tracer bursts while the others move.
//   Every tier: a squad that breaks FALLS BACK TO COVER (not a line across the open), and the LAST MAN of a squad may throw down his rifle and put his hands
//     up — he stands there, then walks off the field (shoot him and he dies like any other).
//   The tier also scales what each man knows (ai/awareness.js: reaction delay, time to make him out, how far a shout carries) and how often a squad thinks.
import { AWARE, DIRECTOR } from '../../config.js';
import { DIR, PL, S, _cv, addScore, animateSoldier, camera, canThrow, clampField, coverSpot, dirDiff, dirSay, dropSoldierGun, enemies, enemyPool, fieldEdgePoint, floatText, freeEnemyBar, gunFlash, heightAt, inCamView, inField, infPushBlocks, losBlocked, poseSoldier, radio, reviveSoldierMesh, sfx, spawnBullet, spawnPart, throwNade } from '../hub.js';

const T = DIRECTOR.tactics, R2 = a => a[0] + Math.random() * (a[1] - a[0]);
const OFF = typeof location !== 'undefined' && /notactics/.test(location.search + location.hash);
const _pos = { x:0, y:0, z:0 }, _glint = { tex:'flash', color:0xeaf6ff, size:1, life:0.07, grav:0, drag:0, keep:true };
// what the tactics did this stage (probes read it), the camping clock, what the radio has already named
export const TAC = { pins:0, cues:0, nades:0, mkShots:0, mg:0, marksman:0, gaveUp:0, left:0, fellBack:0, campT:0, cx:0, cz:0, nadeAt:0, cueAt:-1e9, said:{} };
export function tacticsReset(){ Object.assign(TAC, { pins:0, cues:0, nades:0, mkShots:0, mg:0, marksman:0, gaveUp:0, left:0, fellBack:0, campT:0, cx:0, cz:0, nadeAt:0, cueAt:-1e9, said:{} }); }
// the tier of this battle: 0 = the tactics are off (the squads as they were), else 1…3 by the stage on the difficulty's own row (DIR 3 DIRECTOR.diff: recruit never
//   past tier 1, veteran the whole book from stage 1), one more each NG+ loop
export function tacTier(){ if(!T.on || OFF) return 0; const a = dirDiff().tier; return Math.min(3, a[Math.max(0, Math.min(a.length - 1, (S.stage || 1) - 1))] + (S.loop || 0)); }
// a knob scaled by the tier (DIRECTOR.tactics.scale: one value a tier) × the difficulty's own factor for it (DIR 3)
export function tierK(k){ const t = tacTier(), a = T.scale[k]; return (t && a ? a[t - 1] : 1) * (dirDiff().k[k] || 1); }

// ---- roles (tier 3): one man of a fresh squad may carry the machine gun, one may be a marksman who leaves the squad to hold a lane of his own ----
function count(role){ let n = 0; for(let i = 0; i < enemies.length; i++) if(enemies[i].role === role) n++; return n; }
function makeMG(e){ const M = T.mg; e.role = 'mg'; e.def = { ...e.def, mg:true, range:M.range, keep:M.keep, dmg:e.def.dmg * M.dmgK, burst:M.burst, gap:M.gap, rest:M.rest, spreadK:M.spreadK, score:e.def.score * 2 };
  e.maxHp = e.hp = Math.round(e.maxHp * M.hpK); TAC.mg++; }
function makeMarksman(e){ const M = T.marksman; e.role = 'marksman'; e.def = { ...e.def, mk:true, range:M.range, keep:M.keep, aimT:M.tel, fireCd:M.cd, dmg:M.dmg, bspeed:M.bspeed, score:e.def.score * 2 }; e.sq = null; TAC.marksman++; }
// ai/squads.js makeSquad: the men of a new squad → the men who stay in it
export function tierRoles(m){ if(tacTier() < 3 || m.length < T.roles.minMen) return m; const rf = m.filter(e => !e.def.rpg && !e.role && !e.general && !e.genGuard); if(rf.length < 3) return m;
  if(count('mg') < T.mg.max && Math.random() < T.mg.chance) makeMG(rf[1]);
  if(rf.length > 3 && count('marksman') < T.marksman.max && Math.random() < T.marksman.chance){ const e = rf[rf.length - 1]; makeMarksman(e); return m.filter(x => x !== e); }
  return m; }
// the marksman takes aim (actors/infantry.js, where a rifleman would open a burst): only ever at the player; the telegraph starts — a beep, the glint
export function markAim(e, Tg, now){ if(!Tg.you){ e.fireAt = now + 0.8; return; } e.aimT = e.def.aimT; e.mkx = Tg.pos.x; e.mkz = Tg.pos.z; sfx('beep', e.pos, 0.7);
  if(!TAC.said.marksman){ TAC.said.marksman = 1; radio(T.say.marksman); } }
// one frame of his aim: the glint off the scope grows; he follows his man until lock s before the shot — then one heavy, fast round at where he was. true: fired
export function markStep(e, Tg, dt, now, dmgMul){ const M = T.marksman, mz = e.mesh.userData.muzzle; e.aimT -= dt; if(Tg.lost || !Tg.you){ e.aimT = 0; e.fireAt = now + 1; return false; }   // lost him: the shot is not taken
  mz.getWorldPosition(_cv); const k = 1 - Math.max(0, e.aimT) / e.def.aimT; _glint.size = M.glint[0] + (M.glint[1] - M.glint[0]) * k + Math.random() * 0.3; spawnPart(_cv.x, _cv.y + 0.1, _cv.z, 0, 0, 0, _glint);
  if(e.aimT > M.lock){ e.mkx = Tg.pos.x; e.mkz = Tg.pos.z; } if(e.aimT > 0) return false;
  const a = Math.atan2(e.mkx - _cv.x, e.mkz - _cv.z) + (Math.random() - 0.5) * M.err;
  spawnBullet(_cv.x, _cv.z, a, { owner:'e', inf:true, dmg:e.def.dmg * dmgMul, speed:e.def.bspeed, color:0xfff2c0, r:0.3, trailK:3, tr:1, life:1.4, maxDist:e.def.range * 1.5, noArc:true, y:_cv.y, dropTo:1.3 });
  gunFlash(_cv.x, _cv.y, _cv.z, a, 0.9, 0.4, 0xfff0c0, 1.2); sfx('rifleShot', e.pos); e.shotAt = now; e.fireAt = now + e.def.fireCd * (0.8 + Math.random() * 0.4); TAC.mkShots++; return true; }

// ---- tier 2: pin and flank (ai/squads.js squadThink, in contact: true = the plan has given every man his order) ----
function pinEndNow(sq, now){ const m = sq.m; for(let i = 0; i < m.length; i++) m[i].pinF = false; if(sq.pin){ sq.pin = null; sq.pinAt = now + R2(T.pin.cd); sq.flank = -sq.flank; } }
export function pinEnd(sq, now){ if(sq.pin) pinEndNow(sq, now); }
// the cue he can act on: the leader's shout over his head, and our radio naming the side as the player sees it (cueGap s apart)
function flankCue(sq, fx, fz, now){ const p = S.player, P = T.pin, L = sq.leader; if(!p || now - TAC.cueAt < P.cueGap || (L.pos.x - p.pos.x) ** 2 + (L.pos.z - p.pos.z) ** 2 > P.cueR * P.cueR) return;
  TAC.cueAt = now; TAC.cues++; camera.getWorldDirection(_cv); const dx = fx - p.pos.x, dz = fz - p.pos.z, cr = _cv.x * dz - _cv.z * dx, dot = _cv.x * dx + _cv.z * dz, side = dot < -Math.abs(cr) ? 'rear' : cr > 0 ? 'right' : 'left';
  _pos.x = L.pos.x; _pos.z = L.pos.z; _pos.y = heightAt(L.pos.x, L.pos.z) + 2.6; floatText('VÒNG SƯỜN!', '#ffb070', _pos, 16); sfx('click', L.pos, 0.6); dirSay(now, side, true); }
export function pinPlan(sq, now, tx, tz, d, R){ const P = T.pin, m = sq.m, n = m.length, Tg = sq.T; if(tacTier() < 2 || Tg && Tg.you === false && !Tg.lost){ if(sq.pin) pinEndNow(sq, now); return false; }
  let pl = sq.pin;
  if(!pl){ if(n < P.minMen || now < (sq.pinAt || 0) || d < P.minD) return false; const want = Math.max(1, Math.round(n * P.share)); let k = 0;
    for(let i = n - 1; i >= 0; i--){ const e = m[i]; e.pinF = k < want && e !== sq.leader && !e.def.rpg && !e.def.mg; if(e.pinF) k++; }
    if(!k) return false; pl = sq.pin = { t0:now, until:now + R2(P.t), side:sq.flank, cue:false }; TAC.pins++; }
  let nf = 0, nb = 0; for(let i = 0; i < n; i++){ if(m[i].pinF) nf++; else nb++; }
  if(now > pl.until || !nf || !nb || d < P.endD){ pinEndNow(sq, now); return false; }
  const L = sq.leader, base = Math.atan2(L.pos.x - tx, L.pos.z - tz), fa = base + pl.side * (P.arc[0] + (P.arc[1] - P.arc[0]) * Math.min(1, (now - pl.t0) / P.sweep)), rr = Math.max(P.r[0], Math.min(P.r[1], d * P.rK)), fx = tx + Math.sin(fa) * rr, fz = tz + Math.cos(fa) * rr;
  if(!pl.cue && now - pl.t0 > P.cueT){ pl.cue = true; flankCue(sq, fx, fz, now); }
  for(let i = 0; i < n; i++){ const e = m[i];
    if(e.pinF){ const bx = fx - e.pos.x, bz = fz - e.pos.z, bd = Math.hypot(bx, bz) || 1;                              // the flanking team: hop by hop to the next cover along the arc, not a shot until it is there
      if(bd > P.arrive && (e.supp || 0) < 0.8){ if(!e.sqGoal || now >= (e.hopAt || 0)){ e.hopAt = now + P.hop; const st = Math.min(bd, P.step), gx = e.pos.x + bx / bd * st, gz = e.pos.z + bz / bd * st, cv = coverSpot(gx, gz, tx, tz, 4); e.sqGoal = cv ? [cv.x, cv.z] : [gx, gz]; }
        e.sqStance = null; e.sqNoFire = true; e.sqFireK = 1; }
      else { e.sqGoal = null; e.sqStance = 'crouch'; e.sqNoFire = false; e.sqFireK = P.flankFireK; } }
    else { const ex = e.pos.x - tx, ez = e.pos.z - tz, ed = Math.hypot(ex, ez) || 1, Re = e.def.range || R;                // the base of fire: inside its range, down, firing fast
      if(ed > Re * AWARE.squad.closeK && (e.supp || 0) < 0.6){ const kk = Re * 0.7, cv = coverSpot(tx + ex / ed * kk, tz + ez / ed * kk, tx, tz, 4); e.sqGoal = cv ? [cv.x, cv.z] : [tx + ex / ed * kk, tz + ez / ed * kk]; e.sqStance = null; e.sqNoFire = false; e.sqFireK = 1; }
      else { e.sqGoal = null; e.sqStance = (e.supp || 0) > 0.4 || d > R * 0.6 ? 'prone' : 'crouch'; e.sqNoFire = false; e.sqFireK = e.def.mg ? P.mgFireK : P.baseFireK; } } }
  return true; }

// ---- a broken squad: back to the next cover; the last man may give himself up ----
// where a man of a squad falling back goes (ux, uz: toward the enemy): the far side of a cover behind him, picked once a fall-back (tactics off: the old 14 m straight back)
export function fallSpot(e, sq, ux, uz, tx, tz){ if(!tacTier()) return [e.pos.x - ux * 14 + (Math.random() - 0.5) * 4, e.pos.z - uz * 14 + (Math.random() - 0.5) * 4];
  if(e.fbKey !== sq.fallAt || !e.fb){ const B = T.break, x = e.pos.x - ux * B.back + (Math.random() - 0.5) * 4, z = e.pos.z - uz * B.back + (Math.random() - 0.5) * 4, c = coverSpot(x, z, tx, tz, B.search);
    e.fbKey = sq.fallAt; e.fb = c ? [c.x, c.z] : [x, z]; if(c) TAC.fellBack++; }
  return e.fb; }
// squadThink, a squad down to one man: asked once — does he give himself up? (alerted, the player within r m, not a role man). true: he has; the squad is no more
export function lastMan(sq, now){ const G = T.surrender, e = sq.m[0], p = S.player, t = tacTier(); if(sq.asked || !t || sq.n0 < G.minN0) return false; sq.asked = true;
  if(!p || e.role || e.general || e.genGuard || e.guard || e.def.rpg && e.aimT > 0 || !(e.alert >= 2) || (e.pos.x - p.pos.x) ** 2 + (e.pos.z - p.pos.z) ** 2 > G.r * G.r || Math.random() > G.chance[t - 1]) return false;
  e.gaveUp = { until:now + R2(G.hold), tx:0, tz:0, go:false, end:0 }; e.abandoned = true; e.loot = false; e.burstLeft = 0; e.aimT = 0; e.sqGoal = null; e.pinF = false; e.groundUntil = 0; TAC.gaveUp++;
  dropSoldierGun(e.mesh); _pos.x = e.pos.x; _pos.z = e.pos.z; _pos.y = heightAt(e.pos.x, e.pos.z) + 2.5; floatText('ĐẦU HÀNG!', '#e8e4d0', _pos, 17); sfx('click', e.pos, 0.6); addScore(G.score, _pos); return true; }
// a man who has given himself up (actors/infantry.js, instead of everything else he does): hands up where he stands, facing the player; then he walks to the field's
//   edge and is gone (past leaveMax s still on the way: gone the moment he is out of the frame)
export function giveUpStep(e, dt, now, edt){ const g = e.gaveUp, m = e.mesh, u = m.userData, p = S.player, x0 = e.pos.x, z0 = e.pos.z; let want = e.facing;
  if(now < g.until){ if(p) want = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z); }
  else { if(!g.go){ g.go = true; const q = fieldEdgePoint(Math.atan2(e.pos.z, e.pos.x), 1.5); g.tx = q[0]; g.tz = q[1]; g.end = now + T.surrender.leaveMax; }
    const dx = g.tx - e.pos.x, dz = g.tz - e.pos.z, d = Math.hypot(dx, dz) || 1, sp = e.def.speed * 0.85;
    if(d < 2.5 || !inField(e.pos.x, e.pos.z, 2.2) || now > g.end && !inCamView(e.pos.x, e.pos.z)){ leave(e); return; }
    e.pos.x += dx / d * sp * edt; e.pos.z += dz / d * sp * edt; infPushBlocks(e.pos); clampField(e.pos, 1.5); want = Math.atan2(dx, dz); }
  let a = want - e.facing; while(a > Math.PI) a -= 6.283185; while(a < -Math.PI) a += 6.283185; e.facing += a * Math.min(1, dt * 6);
  m.position.set(e.pos.x, heightAt(e.pos.x, e.pos.z), e.pos.z); m.rotation.y = e.facing; e.intent = 'surrender'; e.r = 0.55;
  animateSoldier(m, Math.hypot(e.pos.x - x0, e.pos.z - z0) / (e.def.scale || 1), dt, false); poseSoldier(m, 'stand', dt); if(u.arms) u.arms.rotation.x = -2.5 + Math.sin(now * 3 + e.ph) * 0.06; }
function leave(e){ const i = enemies.indexOf(e), m = e.mesh; if(i < 0) return; enemies.splice(i, 1); freeEnemyBar(e.bar); e.bar = null; m.visible = false; reviveSoldierMesh(m); (enemyPool[e.type] = enemyPool[e.type] || []).push(m); TAC.left++; }

// ---- tier 3: a grenade to flush a man who has sat in one spot too long; and the radio names a machine gun the first time one opens up near him ----
function flush(now){ const p = S.player, N = T.nade, C = DIR.contact; let best = null, bd = 1e9;
  for(let i = 0; i < C.length; i++){ const e = C[i]; if(e.def.rpg || e.role || e.gaveUp || e.general || !(e.hp > 0) || e.aimT > 0 || now < (e.groundUntil || 0) || (e.supp || 0) > 0.6 || !enemies.includes(e)) continue;
    const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z); if(d >= N.minD && d <= N.maxD && d < bd){ bd = d; best = e; } }
  if(!best || losBlocked(best.pos.x, best.pos.z, p.pos.x, p.pos.z)){ TAC.nadeAt = now + 1; return; }   // (nobody in reach with a clear lob: asked again in a second)
  const g = throwNade('e', best.pos.x, best.pos.z, p.pos.x, p.pos.z, now); g.you = true; g.dmg = N.dmg * (1 + N.perStage * ((S.stage || 1) - 1)); g.boomAt += N.fuse;
  best.facing = Math.atan2(p.pos.x - best.pos.x, p.pos.z - best.pos.z); best.fireAt = Math.max(best.fireAt || 0, now + N.pause); best.burstLeft = 0; best.actAt = now;
  _pos.x = best.pos.x; _pos.z = best.pos.z; _pos.y = heightAt(best.pos.x, best.pos.z) + 2.6; floatText('LỰU ĐẠN!', '#ff9a4a', _pos, 18); sfx('whoosh', best.pos);
  _pos.x = p.pos.x; _pos.z = p.pos.z; _pos.y = heightAt(p.pos.x, p.pos.z) + 3; floatText('LỰU ĐẠN — RỜI CHỖ NGAY!', '#ff6a4a', _pos, 19);
  TAC.nades++; TAC.nadeAt = now + R2(N.cd); TAC.campT = N.camp * N.again; }
// DIRECTOR.sample s apart (campaign/director.js, after its reading — DIR.contact: the alerted men near him)
export function tacticsTick(now, dt){ const p = S.player, N = T.nade, t = tacTier(); if(!p || !t) return;
  const dx = p.pos.x - TAC.cx, dz = p.pos.z - TAC.cz; if(dx * dx + dz * dz > N.campR * N.campR){ TAC.cx = p.pos.x; TAC.cz = p.pos.z; TAC.campT = 0; } else TAC.campT += dt * (PL.cover ? 1 : N.openK);
  if(t >= 3 && TAC.campT >= N.camp && now >= TAC.nadeAt && DIR.phase !== 'release' && DIR.contact.length && canThrow('e', now)) flush(now);
  if(t >= 3 && !TAC.said.mg){ const C = DIR.contact; for(let i = 0; i < C.length; i++){ const e = C[i]; if(e.def.mg && now - (e.shotAt || -9) < 1){ TAC.said.mg = 1; _pos.x = e.pos.x; _pos.z = e.pos.z; _pos.y = heightAt(e.pos.x, e.pos.z) + 2.6; floatText('ĐẠI LIÊN!', '#ffb070', _pos, 17); radio(T.say.mg); break; } } } }
