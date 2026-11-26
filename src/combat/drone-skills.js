// combat/drone-skills.js — DRONE 1 HIS OWN DRONES (the soldier's skills, combat/trooper-spells.js; each on a clock of its own, combat/spells.js spellReady).
//   RECON (reconDrone): thrown from the hand, it climbs and circles a point ahead of where he aims — turn the aim and its circle follows. A few times a
//   second (never per frame, and a third of the men at a time) every enemy soldier inside the circle under it whom it can see from above — the line from the
//   drone to his head open, no roof over him — is MARKED: e.markUntil. A mark is a diamond over his head through any wall and a blip on the map
//   (ui/drone-hud.js), and his squad's men count a marked man as nearer when they pick a target (actors/fireteam.js droneMarkK). It alerts nobody. The men
//   under it may notice it: one looks up (he holds his fire for a moment — the look costs him), then puts a round at it (a tracer, a crack); a few hits and it
//   is a wreck. Its time left rides in the buff bar.
//   DRONE 2 the FPV strike (fpvDrone) — below, with its own note.
import * as THREE from 'three';
import { DRONEWAR } from '../../config.js';
import { CV, DW, MOBILE, PAD, S, STICK_R, VIEW, XH, aoeDamage, bigExplode, burst, camera, climbing, damageBlock, damageEnemy, droneChip, droneFree, droneHurt, droneKill, droneSay, droneSpawn, droneWhine, enemies, floatText, fpvHud, fpvHudTick, heightAt, heldAction, lineClear, lineHit, move, roofOver, sfx, spawnPart, spellHold, updateSpellHUD } from '../hub.js';

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
  if(L > 0.01){ d.vx = dx / L * R.speed; d.vz = dz / L * R.speed; d.x += dx / L * st; d.z += dz / L * st; const w = Math.atan2(dx, dz), da = Math.atan2(Math.sin(w - d.yaw), Math.cos(w - d.yaw)); d.yaw += da * Math.min(1, dt * 4); d.roll = Math.max(-0.45, Math.min(0.45, -da * 0.5)); }
  const ty = heightAt(d.x, d.z) + R.alt, dy = ty - d.y, cl = R.climb * dt; d.vy = dy > cl ? R.climb : dy < -cl ? -R.climb : 0; d.y += dy > cl ? cl : dy < -cl ? -cl : dy; d.pitch = -0.12 * Math.min(1, L / 4);
  if(now >= RECON.tickAt){ RECON.tickAt = now + R.tick; reconScan(d, now); }
  noticed(d, R.notice, now, 1); }
// how much nearer a marked man counts for his squad's men picking a target (actors/fireteam.js allyTarget): × mateK while the mark lasts
export function droneMarkK(e){ return e.markUntil > performance.now() / 1000 ? D.recon.mateK : 1; }

// ---- DRONE 2 THE FPV STRIKE (fpvDrone) ----
//   The view goes to the drone's NOSE. A camera switch, not a second view: the follow camera (game/update.js) is simply not run while it flies
//   (game/loop.js asks fpvCam first), and its pose and lens as they were at the launch are put back the moment the flight ends — the follow camera then takes up
//   from there by its own "back from a cinematic" glide. He steers with the mouse as a stick (how far the pointer is off the middle of the screen), WASD / the
//   arrows, the pad's left stick or the phone's stick; pointing down it gathers speed. It goes off on what it strikes — the ground, a wall, a man, a helicopter
//   — or on FIRE / any skill key once armed: the blast (the grenade's rule, bigger), a direct hit on what it flew into, a jet along its line. Meanwhile the
//   soldier stays where he is (on foot, or his ride reined in): no step (core/helpers.js), no aim (input/input.js: the mouse is the stick), no shot (combat/soldier-fire.js), no other action
//   (input/bindings.js fpvKey) — the risk is the price. Every way out goes through fpvEnd: the impact, the trigger, the battery (it goes off where it is), shot
//   down, the link lost (too far; he took a hard hit), his death, the end of the stage, the field cleared. A pause holds the flight as it is.
export const FPV = { on:false, d:null, t:0, v:0, sx:0, sy:0, mx:0, my:0, bank:0, hp0:0, fov0:54, sig:1, stock:0, whAt:0, end:'', cp:new THREE.Vector3(), cq:new THREE.Quaternion(), n:{ flown:0, hit:0, kills:0, lost:0 } };
const _e = new THREE.Euler(0, 0, 0, 'YXZ'), clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export function fpvFlying(){ return FPV.on; }
export function fpvStock(){ return FPV.stock; }
// the mouse moved (input/input.js): while it flies the pointer is the stick, not the soldier's aim
export function fpvMouse(cx, cy){ if(!FPV.on) return false; FPV.mx = cx / VIEW.w * 2 - 1; FPV.my = 1 - cy / VIEW.h * 2; return true; }
// a bound action went down (input/bindings.js): while it flies FIRE and the skill keys set it off, the pause / key sheet / music go through, the rest waits
export function fpvKey(id){ if(!FPV.on) return false; if(id === 'pause' || id === 'keys' || id === 'music') return false; if(id === 'fire' || id === 'skill' || id === 'droneFpv') fpvDetonate(); return true; }
// the soldier's trigger (combat/soldier-fire.js): he cannot shoot while he flies it — a held trigger sets it off (the phone's auto-fire does not)
export function fpvFire(){ if(!FPV.on) return false; if(S.firing) fpvDetonate(); return true; }
function fpvRefuse(txt){ const p = S.player; floatText(txt, '#ffcf5a', p.pos, 14); sfx('click'); return false; }
// the skill's cast: launch one — or, one in the air, set it off. Its clock is its own: the lock between two runs from the END of a flight (fpvEnd), so it always
//   answers false to combat/spells.js
export function fpvCast(now){ const p = S.player, F = D.fpv; if(!DW.on || !p) return false; if(FPV.on){ fpvDetonate(); return false; }
  if(FPV.stock <= 0) return fpvRefuse('HẾT DRONE FPV — CHỜ THÙNG DRONE / MÀN SAU'); if(!p.cav || CV.trans || CV.dead || climbing()) return fpvRefuse('ĐỨNG VỮNG ĐÃ MỚI LÁI ĐƯỢC FPV');   // (in the saddle or on the pillion he may: the ride is reined in — no push reaches it while he flies)
  const a = p.aimSmoothed ?? p.facing ?? 0, gy = heightAt(p.pos.x, p.pos.z) + (p.lift || 0) + (CV.mounted ? 0.7 : 0), d = droneSpawn('fpv', p.pos.x + Math.sin(a) * 0.8, gy + 1.8, p.pos.z + Math.cos(a) * 0.8, a); if(!d) return fpvRefuse('TRỜI ĐÃ KÍN DRONE');
  d.hp = F.hp; d.pitch = 0.32; d.g.visible = false; FPV.on = true; FPV.d = d; FPV.t = 0; FPV.v = F.v0; FPV.bank = 0; FPV.sx = FPV.sy = 0; FPV.hp0 = p.hp; FPV.sig = 1; FPV.end = ''; FPV.stock--; FPV.n.flown++;
  FPV.mx = XH.mx >= 0 ? XH.mx / VIEW.w * 2 - 1 : 0; FPV.my = XH.my >= 0 ? 1 - XH.my / VIEW.h * 2 : 0; FPV.cp.copy(camera.position); FPV.cq.copy(camera.quaternion); FPV.fov0 = camera.fov;
  S.firing = false; p.vel.set(0, 0, 0); droneChip('fpv', now + F.dur); fpvHud(true); sfx('whoosh'); droneSay('fpv'); updateSpellHUD(); return false; }
// the one way out: the soldier's camera, lens, HUD and controls as they were; why — hit · boom · time · down · lost · dead · stage
function fpvEnd(why){ if(!FPV.on) return; const d = FPV.d, now = performance.now() / 1000; FPV.on = false; FPV.d = null; FPV.end = why; S.firing = false;
  camera.position.copy(FPV.cp); camera.quaternion.copy(FPV.cq); if(camera.fov !== FPV.fov0){ camera.fov = FPV.fov0; camera.updateProjectionMatrix(); }
  fpvHud(false); droneChip('fpv', 0); spellHold('fpvDrone', now + D.fpv.lock); updateSpellHUD();
  if(d && !d.dead){ if(why === 'lost' || why === 'dead' || why === 'stage'){ d.g.visible = true; if(why === 'stage') droneFree(d); else droneKill(d); } else droneFree(d); }
  if(why === 'lost' || why === 'down'){ FPV.n.lost++; DW.n.lost++; if(S.player) floatText(why === 'down' ? 'FPV BỊ BẮN RƠI' : 'MẤT TÍN HIỆU FPV', '#ff7a4a', S.player.pos, 15); droneSay('fpvLost'); } }
// the charge goes off at the drone: the blast on the ground under it (fading with its height: an airburst does little), the direct hit, the jet ahead
function fpvBlast(d, direct, now){ const B = D.fpv.blast, gy = heightAt(d.x, d.z), h = d.y - gy, k = h <= B.airH[0] ? 1 : h >= B.airH[1] ? 0 : 1 - (h - B.airH[0]) / (B.airH[1] - B.airH[0]), n0 = enemies.length;
  let G = null, g0 = 0; for(let i = 0; i < enemies.length; i++) if(enemies[i].hitCap){ G = enemies[i]; g0 = G.hp; break; }   // the general: one capped slice a drone, whichever part reaches him first
  _pos.x = d.x; _pos.y = d.y; _pos.z = d.z;
  if(k > 0.05){ aoeDamage(d.x, d.z, B.r * (0.5 + 0.5 * k), B.dmg * k, false, now, 'HE', false, B.struct); bigExplode({ x:d.x, y:d.y, z:d.z }, 0xffae5c, B.fx * (0.6 + 0.4 * k)); }
  else { spawnPart(d.x, d.y, d.z, 0, 0, 0, { tex:'flash', color:0xfff2d0, size:5, life:0.09, grav:0, drag:0 }); burst(_pos, 0xffb050, 14, 10, { y:d.y, life:0.4, size:0.8, grav:-6, drag:2.5 }); burst(_pos, 0x2a2420, 6, 4, { y:d.y, life:1, size:2.2, smoke:true, grav:-0.4, drag:1.6, op:0.5 }); sfx('explode', _pos, 0.9); }
  let paid = !!G && G.hp < g0; const cp = Math.cos(d.pitch), ux = Math.sin(d.yaw) * cp, uy = Math.sin(d.pitch), uz = Math.cos(d.yaw) * cp, ul = Math.hypot(ux, uz) || 1, cc = Math.cos(B.cone);
  if(direct && direct.hp > 0 && enemies.includes(direct) && !(direct === G && paid)){ if(direct === G) paid = true; direct._fx = 'blast'; damageEnemy(direct, B.direct * (direct.def.air ? B.vehK : 1)); }
  for(const e of enemies.slice()){ if(e === direct || !(e.hp > 0)) continue; const dx = e.pos.x - d.x, dz = e.pos.z - d.z, dd = Math.hypot(dx, dz); if(dd > B.jet || dd < 0.01 || (dx * ux + dz * uz) / (dd * ul) < cc) continue;
    if(e.def.air ? Math.abs((e.pos.y || 0) - d.y - uy * dd) > 3 : h > B.airH[1]) continue; if(e === G){ if(paid) continue; paid = true; }
    e._fx = 'blast'; damageEnemy(e, B.jetDmg * (e.def.air ? B.vehK : 1) * (1 - 0.5 * dd / B.jet)); }
  { const hit = lineHit(d.x, d.y, d.z, d.x + ux * B.jet, d.y + uy * B.jet, d.z + uz * B.jet, 0.2, 0, null); if(hit && hit.bl) damageBlock(hit.bl, B.jetDmg * B.struct); }
  const kills = n0 - enemies.length; FPV.n.hit++; FPV.n.kills += Math.max(0, kills);
  if(kills > 0){ floatText('FPV: HẠ ' + kills, '#ffcf5a', _pos, 18); if(kills >= 2) droneSay('fpvHit'); } }
export function fpvDetonate(){ const d = FPV.d; if(!FPV.on || !d || FPV.t < D.fpv.arm) return false; fpvBlast(d, null, performance.now() / 1000); fpvEnd('boom'); return true; }
// the stick: the pad's left stick, the phone's stick, or the mouse off the middle of the screen (a still zone, full over at three quarters out) plus the keys
function fpvStick(){ const F = D.fpv; let x = 0, y = 0;
  if(PAD.active && (PAD.lx || PAD.ly)){ x = PAD.lx; y = -PAD.ly; }
  else if(MOBILE){ if(move.id !== null){ x = move.x / STICK_R; y = -move.y / STICK_R; } }
  else { const ax = Math.abs(FPV.mx), ay = Math.abs(FPV.my); if(ax > F.dead) x = Math.sign(FPV.mx) * Math.min(1, (ax - F.dead) / (0.75 - F.dead)); if(ay > F.dead) y = Math.sign(FPV.my) * Math.min(1, (ay - F.dead) / (0.75 - F.dead));
    if(heldAction('left')) x -= 1; if(heldAction('right')) x += 1; if(heldAction('up')) y += 1; if(heldAction('down')) y -= 1; }
  FPV.sx = clamp(x, -1, 1); FPV.sy = clamp(y, -1, 1); }
function fpvFly(dt, now){ const d = FPV.d, p = S.player, F = D.fpv; if(d.dead){ fpvEnd('down'); return; }
  FPV.t += dt; if(FPV.t >= F.dur){ fpvBlast(d, null, now); fpvEnd('time'); return; }
  if(p.hp < FPV.hp0 - p.maxHp * F.hitExit){ fpvEnd('lost'); return; }   // he took a hard hit: the set is knocked from his hands
  fpvStick(); const in0 = Math.min(1, FPV.t / 0.4), gy0 = heightAt(d.x, d.z);
  d.yaw -= FPV.sx * F.yaw * dt * in0; d.pitch = clamp(d.pitch + FPV.sy * F.pitch * dt * in0, F.pitchMin, F.pitchMax); if(d.y > gy0 + F.ceil && d.pitch > -0.2) d.pitch -= dt * 2;
  FPV.bank += (FPV.sx * F.bank - FPV.bank) * Math.min(1, dt * 6); d.roll = FPV.bank;
  const sp = Math.sin(d.pitch), cp = Math.cos(d.pitch), want = F.cruise + F.dive * Math.max(0, -sp) - F.climbK * Math.max(0, sp); FPV.v += clamp(want - FPV.v, -F.acc * dt, F.acc * dt);
  const px = d.x, py = d.y, pz = d.z; d.vx = Math.sin(d.yaw) * cp * FPV.v; d.vy = sp * FPV.v; d.vz = Math.cos(d.yaw) * cp * FPV.v; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
  const gy = heightAt(d.x, d.z) + 0.3, armed = FPV.t >= F.arm, far = Math.hypot(d.x - p.pos.x, d.z - p.pos.z); FPV.sig = clamp((F.range - far) / (F.range * 0.35), 0, 1);
  if(far > F.range){ fpvEnd('lost'); return; }
  if(d.y <= gy){ d.y = gy; if(armed){ fpvBlast(d, null, now); fpvEnd('hit'); return; } d.pitch = Math.max(d.pitch, 0.1); }
  if(armed){ const hit = lineHit(px, py, pz, d.x, d.y, d.z, 0.3, 0, null); if(hit){ d.x = px + (d.x - px) * hit.t; d.y = py + (d.y - py) * hit.t; d.z = pz + (d.z - pz) * hit.t; fpvBlast(d, null, now); fpvEnd('hit'); return; }
    for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!(e.hp > 0)) continue; const dx = e.pos.x - d.x, dz = e.pos.z - d.z, r = (e.r || 0.6) + 0.7; if(dx * dx + dz * dz > r * r) continue;
      if(e.def.air){ if(Math.abs((e.pos.y || 0) - d.y) > 2.4) continue; } else { const ey = heightAt(e.pos.x, e.pos.z); if(d.y < ey - 0.2 || d.y > ey + 2.4) continue; }
      fpvBlast(d, e, now); fpvEnd('hit'); return; } }
  if(noticed(d, D.recon.notice, now, 0.5)){ fpvEnd('down'); return; }   // the men it flies over may bring it down (half as likely to look up, harder to hit: it is fast)
  if(now >= FPV.whAt){ FPV.whAt = now + 0.09; droneWhine(150 + FPV.v * 9, 0.035); } }
// game/loop.js, in place of the follow camera: the view from the nose (true = it has the camera this frame)
export function fpvCam(dt, now){ const d = FPV.d; if(!FPV.on || !d) return false; const F = D.fpv, cp = Math.cos(d.pitch);
  camera.position.set(d.x + Math.sin(d.yaw) * cp * 0.3, d.y + 0.1 + Math.sin(d.pitch) * 0.3, d.z + Math.cos(d.yaw) * cp * 0.3);
  _e.set(d.pitch + Math.sin(now * 31) * 0.003, d.yaw + Math.PI, -FPV.bank * 0.9 + Math.sin(now * 43) * 0.004, 'YXZ'); camera.quaternion.setFromEuler(_e);
  const f = F.fov + Math.max(0, FPV.v - F.cruise) * 0.4; if(Math.abs(camera.fov - f) > 0.05){ camera.fov = f; camera.updateProjectionMatrix(); }
  S.shake = Math.max(0, S.shake - dt * (S.shake * 2.6 + 1.2)); fpvHudTick(now, FPV, F.dur - FPV.t, FPV.v, d.y - heightAt(d.x, d.z)); return true; }

// the DRONE crate (loot/powerups.js — it used to bring the gatling gunship): one more FPV drone, and the recon drone ready at once
export function droneCrate(){ const p = S.player; if(!p) return; if(p.ownCd) p.ownCd.reconDrone = 0; FPV.stock = Math.min(D.fpv.stockMax, FPV.stock + 1); updateSpellHUD(); floatText('+1 DRONE FPV · TRINH SÁT SẴN SÀNG', '#7fe6ff', p.pos, 15); }

// ---- the frame, the stage, the end ----
export function updateDroneSkills(dt, now){ if(!S.player) return; reconFly(dt, now); if(FPV.on) fpvFly(dt, now); }
// out of play and not paused (the death, a won stage, a menu): what he was flying is over
export function droneSkillsIdle(){ if(FPV.on) fpvEnd(S.mode === 'dying' ? 'dead' : 'stage'); }
export function clearDroneSkills(){ if(FPV.on) fpvEnd('stage'); RECON.d = null; RECON.look.length = 0; RECON.markedUntil = 0; RECON.marked = 0; const p = S.player; if(p){ p.ownCd = null; if(p.buffUntil){ p.buffUntil.recon = 0; p.buffUntil.fpv = 0; } } }
export function droneSkillsReset(now){ RECON.tickAt = RECON.noticeAt = now; FPV.stock = D.fpv.stock; FPV.n.flown = FPV.n.hit = FPV.n.kills = FPV.n.lost = 0; updateSpellHUD(); }
