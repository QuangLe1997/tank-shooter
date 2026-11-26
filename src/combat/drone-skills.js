// combat/drone-skills.js — DRONE 1 HIS OWN DRONES (the soldier's skills, combat/trooper-spells.js; each on a clock of its own, combat/spells.js spellReady).
//   RECON (reconDrone): thrown from the hand, it climbs and circles a point ahead of where he aims — turn the aim and its circle follows. A few times a
//   second (never per frame, and a third of the men at a time) every enemy soldier inside the circle under it whom it can see from above — the line from the
//   drone to his head open, no roof over him — is MARKED: e.markUntil. A mark is a diamond over his head through any wall and a blip on the map
//   (ui/drone-hud.js), and his squad's men count a marked man as nearer when they pick a target (actors/fireteam.js droneMarkK). It alerts nobody. The men
//   under it may notice it: one looks up (he holds his fire for a moment — the look costs him), then puts a round at it (a tracer, a crack); a few hits and it
//   is a wreck. Its time left rides in the buff bar.
import { DRONEWAR } from '../../config.js';
import { DW, S, droneChip, droneFree, droneHurt, droneSay, droneSpawn, enemies, floatText, heightAt, lineClear, roofOver, sfx, spawnPart } from '../hub.js';

const D = DRONEWAR, R2 = a => a[0] + Math.random() * (a[1] - a[0]), _pos = { x:0, y:0, z:0 };
// the recon drone in the air (d: its record, or null), where its circle is centred, and until when anybody is marked (dev / probes read it)
export const RECON = { d:null, cx:0, cz:0, ang:0, life:0, tickAt:0, k:0, noticeAt:0, markedUntil:0, marked:0, look:[] };

// ---- enemy soldiers under one of his drones notice it: a look up (fire held), then a round at it — N = DRONEWAR.recon.notice, pK scales the chance ----
function noticed(d, N, now, pK){ const L = RECON.look;
  for(let i = L.length - 1; i >= 0; i--){ const o = L[i]; if(now < o.at) continue; L.splice(i, 1); const e = o.e; if(o.d !== d || d.dead || !(e.hp > 0) || !enemies.includes(e)) continue;
    const ey = heightAt(e.pos.x, e.pos.z) + 1.5, dx = d.x - e.pos.x, dy = d.y - ey, dz = d.z - e.pos.z, dd = Math.hypot(dx, dy, dz) || 1;
    spawnPart(e.pos.x, ey, e.pos.z, dx / dd * 90, dy / dd * 90, dz / dd * 90, { tex:'flash', color:0xff5a24, size:0.3, life:dd / 90, grav:0, drag:0 }); sfx('rifleShot', e.pos, 0.7);
    if(Math.random() < N.hit * (pK < 1 ? 0.6 : 1) && droneHurt(d, 1)) return true; }
  if(now < RECON.noticeAt) return false; RECON.noticeAt = now + N.every; if(L.length >= N.max) return false; const r2 = N.r * N.r;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!e.def.inf || !(e.hp > 0) || e.rise || now < (e.stunUntil || 0)) continue; const dx = e.pos.x - d.x, dz = e.pos.z - d.z; if(dx * dx + dz * dz > r2) continue;
    if(Math.random() > N.p * pK * (e.alert >= 2 ? N.alertK : 1)) continue; let has = false; for(let k = 0; k < L.length; k++) if(L[k].e === e) has = true; if(has) continue;
    const t = R2(N.look); e.fireAt = Math.max(e.fireAt || 0, now + t); e.burstLeft = 0; L.push({ e, d, at:now + t });   // he looks up: no shot at us meanwhile
    _pos.x = e.pos.x; _pos.z = e.pos.z; _pos.y = heightAt(e.pos.x, e.pos.z) + 2.3; floatText('DRONE!', '#ffd86a', _pos, 12); if(L.length >= N.max) break; }
  return false; }
export function droneNoticed(d, now, pK){ return noticed(d, D.recon.notice, now, pK); }

// ---- RECON ----
export function reconLaunch(now){ const p = S.player, R = D.recon; if(!DW.on || !p) return false;
  if(RECON.d && !RECON.d.dead){ floatText('DRONE TRINH SÁT ĐANG BAY', '#7fe6ff', p.pos, 14); return false; }
  const a = p.aimSmoothed ?? p.facing ?? 0, gy = heightAt(p.pos.x, p.pos.z) + (p.lift || 0), d = droneSpawn('recon', p.pos.x + Math.sin(a) * 0.7, gy + 1.7, p.pos.z + Math.cos(a) * 0.7, a);
  if(!d){ floatText('TRỜI ĐÃ KÍN DRONE', '#ffcf5a', p.pos, 14); return false; }
  d.hp = R.hp; RECON.d = d; RECON.life = R.dur; RECON.ang = a + Math.PI; RECON.cx = p.pos.x + Math.sin(a) * R.ahead; RECON.cz = p.pos.z + Math.cos(a) * R.ahead; RECON.tickAt = now + 0.6; RECON.noticeAt = now + 2; RECON.k = 0;
  droneChip('recon', now + R.dur); sfx('whoosh'); floatText('THẢ DRONE TRINH SÁT', '#7fe6ff', p.pos, 15); droneSay('recon'); return true; }
function reconEnd(now, why){ const d = RECON.d; RECON.d = null; RECON.look.length = 0; droneChip('recon', 0); if(d && !d.dead){ _pos.x = d.x; _pos.y = d.y; _pos.z = d.z; floatText(why, '#9fd0ff', _pos, 14); droneFree(d); } }
// the marks: a third of the men each tick (RECON.k turns), the line from the drone to each man's head asked once
function reconScan(d, now){ const R = D.recon, r2 = R.r * R.r, ph = RECON.k = (RECON.k + 1) % 3; let n = 0, fresh = 0;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(e.markUntil > now) n++; if(i % 3 !== ph || !e.def.inf || !(e.hp > 0) || e.rise) continue;
    const dx = e.pos.x - d.x, dz = e.pos.z - d.z; if(dx * dx + dz * dz > r2) continue; const was = e.markUntil > now; if(!was && n >= R.markMax) continue;
    if(roofOver(e.pos.x, e.pos.z) || !lineClear(d.x, d.y, d.z, e.pos.x, heightAt(e.pos.x, e.pos.z) + 1.5, e.pos.z)) continue;
    e.markUntil = now + R.mark; if(!was){ n++; fresh++; } if(e.markUntil > RECON.markedUntil) RECON.markedUntil = e.markUntil; }
  RECON.marked = n; if(fresh) sfx('beep', null, 0.5); }
function reconFly(dt, now){ const d = RECON.d, p = S.player, R = D.recon; if(!d) return; if(d.dead){ RECON.d = null; RECON.look.length = 0; droneChip('recon', 0); DW.n.lost++; floatText('DRONE TRINH SÁT BỊ BẮN RƠI', '#ff7a4a', p.pos, 15); droneSay('reconDown', true); return; }
  RECON.life -= dt; if(RECON.life <= 0){ reconEnd(now, 'DRONE HẾT PIN'); return; }
  const a = p.aimSmoothed ?? p.facing ?? 0, k = Math.min(1, dt * 1.3); RECON.cx += (p.pos.x + Math.sin(a) * R.ahead - RECON.cx) * k; RECON.cz += (p.pos.z + Math.cos(a) * R.ahead - RECON.cz) * k; RECON.ang += R.spin * dt;
  const tx = RECON.cx + Math.sin(RECON.ang) * R.orbit, tz = RECON.cz + Math.cos(RECON.ang) * R.orbit, dx = tx - d.x, dz = tz - d.z, L = Math.hypot(dx, dz), st = Math.min(L, R.speed * dt);
  if(L > 0.01){ d.vx = dx / L * R.speed; d.vz = dz / L * R.speed; d.x += dx / L * st; d.z += dz / L * st; const w = Math.atan2(dx, dz), da = Math.atan2(Math.sin(w - d.yaw), Math.cos(w - d.yaw)); d.yaw += da * Math.min(1, dt * 4); d.roll = -da * 0.5; }
  const ty = heightAt(d.x, d.z) + R.alt, dy = ty - d.y, cl = R.climb * dt; d.vy = dy > cl ? R.climb : dy < -cl ? -R.climb : 0; d.y += dy > cl ? cl : dy < -cl ? -cl : dy; d.pitch = -0.12 * Math.min(1, L / 4);
  if(now >= RECON.tickAt){ RECON.tickAt = now + R.tick; reconScan(d, now); }
  noticed(d, R.notice, now, 1); }
// how much nearer a marked man counts for his squad's men picking a target (actors/fireteam.js allyTarget): × mateK while the mark lasts
export function droneMarkK(e){ return e.markUntil > performance.now() / 1000 ? D.recon.mateK : 1; }

// ---- the frame, the stage, the end ----
export function updateDroneSkills(dt, now){ if(S.player) reconFly(dt, now); }
export function droneSkillsIdle(){ }
export function clearDroneSkills(){ RECON.d = null; RECON.look.length = 0; RECON.markedUntil = 0; RECON.marked = 0; const p = S.player; if(p){ p.ownCd = null; if(p.buffUntil){ p.buffUntil.recon = 0; p.buffUntil.fpv = 0; } } }
export function droneSkillsReset(now){ RECON.tickAt = RECON.noticeAt = now; }
// the DRONE crate (loot/powerups.js — it used to bring the gatling gunship): the recon drone is ready at once
export function droneCrate(){ const p = S.player; if(!p) return; if(p.ownCd) p.ownCd.reconDrone = 0; floatText('DRONE TRINH SÁT SẴN SÀNG', '#7fe6ff', p.pos, 15); }
