// campaign/drone-raid.js — DRONE 3 THE ENEMY'S DRONES, AND THE JAMMER. A raid is one draw of the surprises' hat (campaign/surprises.js EV.drone, from stage
//   DRONEWAR.enemy.from; never in the general's duel, never while another raid or a shell of theirs is live, never inside `gap` s of the last; the hat's own
//   clock and the director's own surprise are pushed back while it lasts). Each drone comes in from OUTSIDE the frame, far out, and is announced the moment it
//   is in the air: its buzz, a line on the radio, a marker on the screen (ui/drone-hud.js).
//   · SPOT, a quadcopter: it circles the last place it knows, a look a few times a second — he is seen inside its view (nearer when he lies flat: the eyes'
//     own rule, ai/awareness.js PL.r), the line from it to his head open, no roof over him, no smoke in the way. Held in view for hold s he is GIVEN AWAY:
//     every enemy soldier round him knows the spot and a mortar round may follow (the surprises' own shell: ring and whistle).
//   · KAMI, an FPV with a charge: it cruises in high, and may not dive before DRONEWAR.enemy.kami.warn s have passed since its first buzz (a rule of the code,
//     not of the distances: armAt). The dive tracks him at a limited turn rate (slower until its line is on him) and goes off on him, the
//     ground, or whatever solid it meets (a wall between halves… the blast asks the line). Sight of him lost, it goes for where it last saw him, loiters,
//     then dives there blind.
//   What he can do: SHOOT it (his rounds are laid on it like on a helicopter — combat/air-aim.js takes droneHigh() — and a generous sphere, droneShot; his
//   squad's men fire on it too), break its LINE (cover, a roof), lie in SMOKE, or JAM it: the jammer (skill `jammer`, its own clock) makes every enemy drone
//   within DRONEWAR.jam.r lose its link for a few seconds — it sinks, sparking, and a drone that reaches the ground like that is a wreck, not a blast.
import { DRONEWAR } from '../../config.js';
import { DIR, DW, FT, MOBILE, PAD, PL, S, SURP, UNDER, addScore, alertEnemy, bigExplode, blastAllies, burst, camera, damagePlayer, droneBuzz, droneFree, droneHurt, droneKill, droneSay, droneSpawn, duelOn, enemies, floatText, heightAt, hitConfirm, inCamView, lineClear, lineHit, playerSight, ringPulse, roofOver, sfx, showBanner, spawnPart, spellList, tone, updateSpellHUD } from '../hub.js';

const D = DRONEWAR, E = D.enemy, R2 = a => a[0] + Math.random() * (a[1] - a[0]), _tg = [], _pos = { x:0, y:0, z:0 };
// the raid (dev / probes read it): at — when the last one began · q — drones still to come · n — what happened this stage (minWarn: the shortest first-buzz-to-impact)
export const RAID = { at:-1e9, q:[], matesAt:0, armed:-1, n:{ raids:0, spot:0, kami:0, fixes:0, mortars:0, hits:0, misses:0, downed:0, jammed:0, minWarn:1e9 } };
const foes = () => { let n = 0; for(let i = 0; i < DW.list.length; i++) if(DW.list[i].foe) n++; return n; };

// ---- the hat's side (campaign/surprises.js) ----
export function droneRaidW(){ return E.w; }
export function droneRaidOk(now){ const p = S.player; return DW.on && !!p && p.hp > 0 && S.stage >= E.from && !UNDER.on && !duelOn() && DIR.phase !== 'finale' && now - RAID.at > E.gap && !RAID.q.length && !SURP.shells.length && foes() === 0; }
// a raid begins: which drones, when (the first at once; from stage `two` a second kamikaze twoGap s behind). Nothing else of the hat's while it lasts.
export function droneRaid(now, kind){ if(!droneRaidOk(now) && !kind) return false; const K = E.kinds; kind = kind || (Math.random() * (K.spot + K.kami) < K.spot ? 'spot' : 'kami');
  RAID.at = now; RAID.n.raids++; RAID.q.push({ kind, at:now }); if(kind === 'kami' && S.stage >= E.two) RAID.q.push({ kind, at:now + E.twoGap });
  SURP.next = Math.max(SURP.next || 0, now + E.hold); DIR.surAt = now; return true; }
// where it comes in: enterD m from him on any bearing that is out of the frame — a flank as often as the rear, so it can cross into view and be shot at; the
//   last try is straight behind the camera (atan2(m[8], m[10]): the lens's own back), which never is in the frame
function entry(){ const p = S.player, m = camera.matrixWorld.elements, back = Math.atan2(m[8], m[10]); let x = 0, z = 0;
  for(let k = 0; k < 7; k++){ const a = k < 6 ? Math.random() * 6.283 : back, r = R2(E.enterD); x = p.pos.x + Math.sin(a) * r; z = p.pos.z + Math.cos(a) * r; if(!inCamView(x, z, 0.3)) break; }
  _pos.x = x; _pos.z = z; return _pos; }
function launch(kind, now){ const p = S.player, q = entry(), C = E[kind], x = q.x, z = q.z, a = Math.atan2(p.pos.x - x, p.pos.z - z), d = droneSpawn(kind, x, heightAt(x, z) + C.alt, z, a); if(!d) return null;
  d.hp = C.hp; d.t0 = now; d.ux = Math.sin(a); d.uy = 0; d.uz = Math.cos(a); d.lkx = p.pos.x; d.lkz = p.pos.z; d.sees = false; d.seenAt = now; d.tickAt = 0; d.jam = false; d.spAt = 0; d.ang = Math.random() * 6.283;
  d.tg = { _drn:true, d, pos:{ x, y:d.y, z }, def:{ air:true }, r:C.hitR, hp:1 };   // what the gun is laid on (combat/air-aim.js)
  if(kind === 'kami'){ d.st = 'cruise'; d.armAt = now + C.warn; d.loT = 0; d.dvT = 0; d.blind = false; RAID.n.kami++; showBanner(D.say.hint.kami, '#ff5a3a'); droneSay('kami', true); }
  else { d.st = 'watch'; d.life = C.dur; d.fix = 0; d.refixAt = 0; d.lkx += (Math.random() - 0.5) * 30; d.lkz += (Math.random() - 0.5) * 30; RAID.n.spot++; showBanner(D.say.hint.spot, '#ffb070'); droneSay('spot', true); }
  sfx('alarm'); armJammer(true); return d; }
// on a phone or a pad there is no key of its own for the jammer: while their drones are up it is the skill in hand (the one he had comes back after)
function armJammer(on){ if(!MOBILE && !PAD.active) return; const L = spellList(), j = L.findIndex(s => s.id === 'jammer'); if(j < 0) return;
  if(on){ if(RAID.armed < 0 && S.spell !== j){ RAID.armed = S.spell; S.spell = j; updateSpellHUD(); } }
  else if(RAID.armed >= 0){ if(S.spell === j) S.spell = RAID.armed; RAID.armed = -1; updateSpellHUD(); } }

// ---- flying ----
// its line of flight turns toward (tx, ty, tz) by at most `turn` rad/s; returns how far that point is
function steer(d, tx, ty, tz, turn, dt){ let dx = tx - d.x, dy = ty - d.y, dz = tz - d.z; const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
  const dot = Math.max(-1, Math.min(1, dx * d.ux + dy * d.uy + dz * d.uz)), ang = Math.acos(dot), k = ang < 1e-4 ? 1 : Math.min(1, turn * dt / ang); d.al = dot;   // (al: how well its line already points there)
  d.ux += (dx - d.ux) * k; d.uy += (dy - d.uy) * k; d.uz += (dz - d.uz) * k; const n = Math.hypot(d.ux, d.uy, d.uz);
  if(n < 0.05){ d.ux = dx; d.uy = dy; d.uz = dz; } else { d.ux /= n; d.uy /= n; d.uz /= n; } return L; }
function move(d, sp, dt){ d.vx = d.ux * sp; d.vy = d.uy * sp; d.vz = d.uz * sp; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
  d.yaw = Math.atan2(d.ux, d.uz); d.pitch = Math.asin(Math.max(-1, Math.min(1, d.uy))) - 0.18; d.roll = 0; }
// a point a little way round the circle (cx, cz, r) from where it is: chasing it, it circles
function round(d, cx, cz, r, alt, turn, dt){ const a = Math.atan2(d.x - cx, d.z - cz) + 0.6, tx = cx + Math.sin(a) * r, tz = cz + Math.cos(a) * r; return steer(d, tx, heightAt(d.x, d.z) + alt, tz, turn, dt); }
// does it see him now (asked a few times a second, never per frame): the eye's line (smoke shuts it), and no roof over him
function look(d, now, every){ if(now < d.tickAt) return; d.tickAt = now + every; const p = S.player; d.sees = playerSight(d.x, d.y, d.z) && !roofOver(p.pos.x, p.pos.z); if(d.sees){ d.lkx = p.pos.x; d.lkz = p.pos.z; d.seenAt = now; } }

// KAMI
function kamiBlast(d, now){ const B = E.kami.blast, p = S.player, gy = heightAt(d.x, d.z), py = heightAt(p.pos.x, p.pos.z) + 1.2 + (p.lift || 0), dd = Math.hypot(p.pos.x - d.x, py - d.y, p.pos.z - d.z);
  if(d.y - gy < 3) bigExplode({ x:d.x, y:d.y, z:d.z }, 0xff7a3d, B.r / 3);
  else { _pos.x = d.x; _pos.y = d.y; _pos.z = d.z; spawnPart(d.x, d.y, d.z, 0, 0, 0, { tex:'flash', color:0xfff2d0, size:4, life:0.09, grav:0, drag:0 }); burst(_pos, 0xffb050, 12, 9, { y:d.y, life:0.4, size:0.7, grav:-6, drag:2.5 }); sfx('explode', _pos, 0.9); }
  blastAllies(d.x, d.z, B.r, B.dmg);
  if(dd < B.r){ let k = 1 - (1 - B.edge) * dd / B.r; if(!lineClear(d.x, d.y + 0.3, d.z, p.pos.x, py, p.pos.z)) k *= 0.3;   // (a wall between him and it takes most of it)
    damagePlayer(B.dmg * k, now, p.pos.x - d.x, p.pos.z - d.z, 'blast'); RAID.n.hits++; } else RAID.n.misses++;
  RAID.n.minWarn = Math.min(RAID.n.minWarn, now - d.t0); droneFree(d); }
function kamiFly(d, dt, now){ const K = E.kami, p = S.player, py = heightAt(p.pos.x, p.pos.z) + 1.2 + (p.lift || 0); look(d, now, 0.15); const lost = now - d.seenAt > K.lost;
  if(d.st === 'dive'){ const px = d.x, pyy = d.y, pz = d.z, live = d.sees && !d.blind; d.dvT += dt; if(d.dvT > 6){ kamiBlast(d, now); return; }   // (a dive that found nothing: it goes off where it is)
    steer(d, live ? p.pos.x + p.vel.x * 0.2 : d.lkx, live ? py : heightAt(d.lkx, d.lkz) + 0.3, live ? p.pos.z + p.vel.z * 0.2 : d.lkz, K.turn, dt); move(d, K.dive * (0.45 + 0.55 * Math.max(0, d.al)), dt);   // (slower while it is still turning in: at full speed its turn is too wide to come round onto him from the circle — it would ring him for ever)
    if(Math.hypot(p.pos.x - d.x, py - d.y, p.pos.z - d.z) < 1.3){ kamiBlast(d, now); return; }
    if(d.y <= heightAt(d.x, d.z) + 0.25){ d.y = heightAt(d.x, d.z) + 0.25; kamiBlast(d, now); return; }
    const hit = lineHit(px, pyy, pz, d.x, d.y, d.z, 0.25, 0, null); if(hit){ d.x = px + (d.x - px) * hit.t; d.y = pyy + (d.y - pyy) * hit.t; d.z = pz + (d.z - pz) * hit.t; kamiBlast(d, now); }
    return; }
  if(d.st === 'loiter'){ round(d, d.lkx, d.lkz, 9, K.alt, K.turn * 1.4, dt); move(d, K.speed * 0.7, dt); d.loT -= dt;
    if(d.sees){ d.st = 'cruise'; d.armAt = Math.max(d.armAt, now + 1); } else if(d.loT <= 0){ d.st = 'dive'; d.blind = true; d.dvT = 0; }
    return; }
  // cruise: in high toward where he is (or was); close enough, armed and seeing him — the dive; not armed yet — round him; sight lost — to the last place, and loiter
  const tx = d.sees ? p.pos.x : d.lkx, tz = d.sees ? p.pos.z : d.lkz, far = Math.hypot(tx - d.x, tz - d.z);
  if(far < K.diveR * 1.15 && d.sees && now >= d.armAt){ d.st = 'dive'; d.blind = false; d.dvT = 0; _pos.x = p.pos.x; _pos.y = py + 1.4; _pos.z = p.pos.z; floatText('FPV LAO XUỐNG!', '#ff5a3a', _pos, 16); sfx('alarm'); return; }
  if(lost && far < 9){ d.st = 'loiter'; d.loT = K.loiter; return; }
  if(far < K.diveR * 1.05 && !lost) round(d, tx, tz, K.diveR, K.alt, K.turn * 1.4, dt); else steer(d, tx, heightAt(d.x, d.z) + K.alt, tz, K.turn * 1.4, dt);
  move(d, K.speed, dt); }
// SPOT
function spotFix(d, now){ const C = E.spot, p = S.player, r2 = C.alertR * C.alertR; let n = 0; d.fix = 0; d.refixAt = now + C.refix; RAID.n.fixes++;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!e.def.inf || !(e.hp > 0)) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; if(dx * dx + dz * dz > r2) continue; alertEnemy(e, now, 'order', p.pos.x, p.pos.z); n++; }
  if(Math.random() < C.mortarP){ const M = C.mortar; SURP.shells.push({ x:p.pos.x + p.vel.x * 0.6, z:p.pos.z + p.vel.z * 0.6, t:M.t, warn:M.warn, R:M.R, dmg:M.dmg, ours:false, pulse:0, wh:false }); RAID.n.mortars++; }   // (campaign/surprises.js lands it: ring, whistle)
  showBanner(D.say.hint.fix, '#ff5a3a'); droneSay('fix', true); sfx('alarm'); return n; }
function spotFly(d, dt, now){ const C = E.spot, p = S.player;
  if(d.st === 'leave'){ steer(d, d.x + (d.x - p.pos.x), d.y + 6, d.z + (d.z - p.pos.z), 1.2, dt); move(d, C.speed * 1.6, dt); if(Math.hypot(d.x - p.pos.x, d.z - p.pos.z) > E.enterD[1] + 15 && !inCamView(d.x, d.z, 0.1) || d.t > C.dur + 25) droneFree(d); return; }
  d.life -= dt; if(d.life <= 0){ d.st = 'leave'; return; }
  if(now >= d.tickAt){ const was = d.sees, far = Math.hypot(p.pos.x - d.x, p.pos.z - d.z); look(d, now, 0.2); d.sees = d.sees && far < Math.min(C.view, PL.r * 1.5);
    if(!d.sees && !was){ d.lkx += (p.pos.x - d.lkx) * 0.08; d.lkz += (p.pos.z - d.lkz) * 0.08; } }   // (it has not got him: its search drifts his way)
  if(d.sees){ d.fix += dt; if(d.fix >= C.hold && now >= d.refixAt) spotFix(d, now); } else d.fix = Math.max(0, d.fix - dt * C.decay);
  round(d, d.lkx, d.lkz, C.orbit, C.alt, 1.6, dt); move(d, C.speed, dt); }
// its link is jammed: it sinks, turning, sparking; on the ground like that it is a wreck. Through it alive: its fix forgotten, no dive for a while
function jammed(d, dt, now){ const J = D.jam, kami = d.kind === 'kami'; d.jam = true; d.x += d.vx * dt * 0.35; d.z += d.vz * dt * 0.35; d.y -= (kami ? J.sink[1] : J.sink[0]) * dt; d.yaw += dt * 5; d.roll = Math.sin(now * 17) * 0.5; d.pitch = Math.sin(now * 13) * 0.3;
  if(now >= d.spAt){ d.spAt = now + 0.12; spawnPart(d.x, d.y, d.z, (Math.random() - 0.5) * 5, 1 + Math.random() * 2, (Math.random() - 0.5) * 5, { color:0x7fe6ff, size:0.3, life:0.25, grav:-6, drag:2 }); }
  if(d.y <= heightAt(d.x, d.z) + 0.3){ down(d, 'jam'); droneKill(d); } }
function recover(d, now){ d.jam = false; d.roll = 0; const a = d.yaw; d.ux = Math.sin(a); d.uy = 0; d.uz = Math.cos(a); d.sees = false; d.seenAt = now; d.tickAt = now + 0.3;
  if(d.kind === 'kami'){ d.st = 'cruise'; d.blind = false; d.armAt = Math.max(d.armAt, now + D.jam.rearm); } else { d.fix = 0; d.refixAt = Math.max(d.refixAt, now + D.jam.rearm); } }
// one of theirs is down (his round, a mate's, the jammer): the score, a word
function down(d, why){ const C = E[d.kind]; RAID.n.downed++; _pos.x = d.x; _pos.y = d.y; _pos.z = d.z; addScore(C.score, _pos); floatText(d.kind === 'kami' ? 'HẠ FPV ĐỊCH!' : 'HẠ DRONE TRINH SÁT!', '#9be04a', _pos, 17); if(why !== 'jam') droneSay('kamiDown'); }

// ---- what he does about it ----
// his round's stretch this frame (combat/lock-on.js; wy = its height now): does it pass through one of their drones' spheres — true: the round is spent
export function droneShot(b, wy){ for(let i = 0; i < DW.list.length; i++){ const d = DW.list[i]; if(!d.foe || d.dead) continue; const C = E[d.kind], br = b.r || 0.3; if(Math.abs(wy - d.y) > C.hitY + br) continue;
    const ax = b._hx ?? b.x, az = b._hz ?? b.z, ex = b.x - ax, ez = b.z - az, L2 = ex * ex + ez * ez; let u = L2 > 1e-6 ? ((d.x - ax) * ex + (d.z - az) * ez) / L2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
    const qx = ax + ex * u - d.x, qz = az + ez * u - d.z, r = C.hitR + br; if(qx * qx + qz * qz > r * r) continue;
    const dead = droneHurt(d, b.aoe || b.dmg >= 40 ? 2 : 1); if(b.reach) hitConfirm(dead); if(dead) down(d, 'shot'); return true; }
  return false; }
// the targets a gun may be laid on (combat/air-aim.js high()): their drones in the air, where they are now
export function droneHigh(){ _tg.length = 0; for(let i = 0; i < DW.list.length; i++){ const d = DW.list[i]; if(!d.foe || d.dead || !d.tg) continue; d.tg.pos.x = d.x; d.tg.pos.y = d.y; d.tg.pos.z = d.z; _tg.push(d.tg); } return _tg; }
// THE JAMMER (skill `jammer`): every enemy drone within jam.r m loses its link for jam.t s. Nothing in reach: nothing spent (false)
export function jamBurst(now){ const J = D.jam, p = S.player; if(!DW.on || !p) return false; let n = 0;
  for(let i = 0; i < DW.list.length; i++){ const d = DW.list[i]; if(!d.foe || d.dead || Math.hypot(d.x - p.pos.x, d.z - p.pos.z) > J.r) continue; d.jamT = J.t; d.fix = 0; d.sees = false; n++; }
  if(!n){ floatText(D.say.jamNone, '#ffcf5a', p.pos, 13); sfx('click'); return false; }
  RAID.n.jammed += n; ringPulse(p.pos, 0x3ee8ff, J.r * 1.6); ringPulse(p.pos, 0x3ee8ff, 12); tone(2600, 0.45, { type:'square', vol:0.05, slideTo:240 }); tone(90, 0.5, { type:'sawtooth', vol:0.06, slideTo:40 });
  floatText('GÂY NHIỄU! ×' + n, '#7fe6ff', p.pos, 17); droneSay('jam', true); return true; }
// his squad's men fire on a drone of theirs in reach (a tracer, a crack, now and then a hit)
function mates(now){ const M = E.mates; if(now < RAID.matesAt) return; RAID.matesAt = now + M.every; if(!FT.length) return;
  for(let i = 0; i < DW.list.length; i++){ const d = DW.list[i]; if(!d.foe || d.dead) continue; const a = FT[(Math.random() * FT.length) | 0]; if(!a || a.dead || !a.pos) continue; const dx = d.x - a.pos.x, dz = d.z - a.pos.z; if(dx * dx + dz * dz > M.r * M.r) continue;
    const ay = heightAt(a.pos.x, a.pos.z) + 1.4, dy = d.y - ay, dd = Math.hypot(dx, dy, dz) || 1; spawnPart(a.pos.x, ay, a.pos.z, dx / dd * 90, dy / dd * 90, dz / dd * 90, { tex:'flash', color:0xffe08a, size:0.28, life:dd / 90, grav:0, drag:0 }); sfx('shoot_rifle', a.pos, 0.6);
    if(Math.random() < M.p && droneHurt(d, 1)){ down(d, 'mate'); return; } } }

// ---- the frame, the stage, the end ----
export function updateDroneRaid(dt, now){ const p = S.player; if(!p) return;
  for(let i = RAID.q.length - 1; i >= 0; i--) if(now >= RAID.q[i].at){ const k = RAID.q[i].kind; RAID.q.splice(i, 1); if(p.hp > 0 && !duelOn()) launch(k, now); }
  let n = 0;
  for(let i = DW.list.length - 1; i >= 0; i--){ const d = DW.list[i]; if(!d.foe || d.dead) continue; n++;
    if(d.jamT > 0) jammed(d, dt, now); else { if(d.jam) recover(d, now); if(d.kind === 'kami') kamiFly(d, dt, now); else spotFly(d, dt, now); }
    if(!d.dead) droneBuzz(d, now, d.kind === 'kami' ? E.kami.buzz : E.spot.hum, d.st === 'dive' ? 1.3 : d.jamT > 0 ? 0.6 : 1); }
  if(n){ mates(now); SURP.next = Math.max(SURP.next || 0, now + 4); } else if(RAID.armed >= 0 && !RAID.q.length) armJammer(false); }
export function clearDroneRaid(){ RAID.q.length = 0; armJammer(false); }
export function droneRaidReset(now){ RAID.at = now - E.gap * 0.5; RAID.q.length = 0; RAID.matesAt = now; RAID.armed = -1; const n = RAID.n; n.raids = n.spot = n.kami = n.fixes = n.mortars = n.hits = n.misses = n.downed = n.jammed = 0; n.minWarn = 1e9; }
