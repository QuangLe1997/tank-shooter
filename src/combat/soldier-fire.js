// combat/soldier-fire.js — Z306 THE SOLDIER FIRES HIS OWN RIFLE (soldier mode only; the tank keeps combat/flame.js fireGun): a small-arms round out of
//   the carbine's muzzle — a thin tracer, a spark or a puff of blood where it lands, no blast, no shell's smoke ribbon — a rifle's flash, its brass and its
//   crack, and a light kick of the view: no recoil shove, no hot-barrel smoke, no "too close for the main gun".
// Z329 HIS WHOLE ARSENAL: the nine hand weapons (data/guns.js, trooper:true; the Tripo models in config INFGUN) — he starts with the carbine and a B41, picks
//   the rest up from the "SÚNG MỚI" crate, switches with the number keys / Q / E like the tank. Each fires its own way from his own muzzle: rounds (the
//   PKM, the minigun), eight pellets (the shotgun), a slug through two men (the 12.7), a rocket that bursts (the B41), a grenade lobbed onto the aim point (the
//   M79), a flame (the thrower), an arc that jumps to the next man (the energy rifle). Not the tank's: never in its shop, never kept in its arsenal.
import * as THREE from 'three';
import { RIDER_TURN, TROOPER, XHAIR, REAL } from '../../config.js';
import { GUNS, MOBILE, PAD, PROFILE, S, fpvFire, boreNow, burstRound, burstSpread, camKick, shotCase, aimTarget, cMod, fireFlame, gunFlash, gunLight, fireMortar, floatText, magCap, playerRange, rifleFX, ringPulse, sfx, spawnBullet, spawnPart, startReload, updateGunHUD, airShot, CV, fireLine, climbPerch } from '../hub.js';

const _v = new THREE.Vector3();
// Z359 the rifle he may carry in from the start (CHUẨN BỊ TRẬN · TRANG BỊ, and Z411 KHO SÚNG in soldier mode) · Z411 every hand weapon of his, by tier — it listed
//   only the carbine, AK-47, M4 and MP5, so the PKM, minigun, shotgun, 12.7, M79, flamer, energy rifle and the four Z387 guns were never in the menu; the B41
//   (KIT_GUN) is not: it always comes with him
export const KIT_GUN = 't_rpg';
export const PRIMARY_GUNS = Object.keys(GUNS).filter(id => GUNS[id].trooper && id !== KIT_GUN).sort((a, b) => (GUNS[a].tier || 1) - (GUNS[b].tier || 1));
export function trooperGuns(){ const main = PRIMARY_GUNS.includes(PROFILE.trooperGun) ? PROFILE.trooperGun : 'carbine'; return [main, 't_rpg'].map(id => ({ id, ammo:GUNS[id].mag, rU:0, rD:0 })); }
// the guns the "SÚNG MỚI" crate can bring him: one he has not got yet, the heavier ones later in the campaign
export function trooperGunPick(){ const p = S.player, have = new Set(p.guns.map(g => g.id)), stage = S.stage || 1;
  const pool = Object.keys(GUNS).filter(id => GUNS[id].trooper && !have.has(id) && (GUNS[id].tier || 1) <= Math.min(3, 1 + stage));
  return pool.length ? pool[(Math.random() * pool.length) | 0] : p.guns[(Math.random() * p.guns.length) | 0].id; }
// into his hands' rack (a gun he has is filled up again); his kit is his, the tank's arsenal is not touched
export function trooperGive(id){ const p = S.player, g = GUNS[id]; if(!p || !g) return; const inst = p.guns.find(x => x.id === id);
  if(inst){ const st = Math.min(TROOPER.star.max, (inst.star || 1) + 1), up = st > (inst.star || 1); inst.star = st; inst.ammo = magCap(g); inst.rU = 0;   // Z352 the same gun again: a star up (more damage, a quicker trigger), and full
    floatText(g.name + (up ? ' ★' + st : ' — ĐẦY ĐẠN'), up ? '#ffd24a' : '#9be04a', p.pos, up ? 20 : 16); if(up){ ringPulse(p.pos, 0xffd24a, 2.4); sfx('levelup'); } }
  else { p.guns.push({ id, ammo:magCap(g), rU:0, rD:0 }); floatText(g.name + ' — NHẶT ĐƯỢC (' + p.guns.length + ')', '#ffd24a', p.pos, 20); }
  updateGunHUD(); }
export function soldierFire(now, range){ const p = S.player; if(!p || !p.guns.length) return; if(fpvFire()) return;   // DRONE 2 no shot while he flies the FPV drone: the trigger sets it off (combat/drone-skills.js)
  const inst = p.guns[p.gunIdx], g = GUNS[inst.id];
  if(!g || inst.rU) return; if(!p.infiniteAmmo && inst.ammo <= 0){ startReload(now, inst); return; } if(now < p.fireAt) return;
  const R = CV.mounted && (CV.real || CV.G && CV.G.userData); if(R && (R.sat || R.bed) && R.gunYaw != null){ const off = R.gunYaw - p.aimSmoothed; if(Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > RIDER_TURN.fire) return; }   // Z340 turning round in the saddle: the trigger waits for the bore to come onto the aim (Z388 on the fallback rig too: actors/general.js · Z389 and stepping round in a bed)
  p.muzzle.getWorldPosition(_v); const L = g.special ? null : fireLine(_v.x, _v.y, _v.z), RF = !CV.mounted && CV.real;   // (Z451 up on a wall the muzzle is up there: the rounds leave it, past what he stands on — ignore)   // Z376 the round from the muzzle straight to the crosshair (combat/crosshair.js)
  if(L && RF && RF.gunYaw != null){ const off = RF.gunYaw - L.a; if(Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > XHAIR.fireTol) return; }   // (on his feet: the trigger waits a moment for the rifle to come round onto it)
  const rapid = (now < p.overUntil || now < p.buffUntil.rapid) ? 0.5 : 1, st = (inst.star || 1) - 1, SK = TROOPER.star; p.fireAt = now + g.fireCd * rapid * p.fireMul * (1 - SK.rate * st); if(!p.infiniteAmmo) inst.ammo--;   // Z352 each star: a quicker trigger
  const bn = burstRound(p, now), B = boreNow();   // GUN 3 which round of a burst this is (the first land tighter, kick the view harder), and how the gun lies (actors/gun-feel.js)
  const air = g.special ? null : airShot(_v.x, _v.z, g.bspeed), a0 = air ? air.a : L ? L.a : p.aimSmoothed, crit = Math.random() < p.crit, power = now < p.buffUntil.power ? 1.6 : 1;
  const dmg = g.dmg * p.dmgMul * power * (crit ? 2 : 1) * cMod('playerDmgMul') * (1 + SK.dmg * st), reach = (range || playerRange()) * (g.rng || 1) + 2, t = aimTarget(reach);
  if(g.special === 'flame'){ fireFlame(now, g, _v.x, _v.z, a0, dmg / (g.dmg || 1)); if(Math.random() < 0.12) sfx(g.snd, p.pos); }
  else if(g.special === 'mortar'){ fireMortar(now, g, dmg); sfx(g.snd || 'shoot_agl', p.pos); }
  else { const aimD = ((!MOBILE || PAD.active) && S.pointerActive) ? Math.hypot(S.aimPoint.x - p.pos.x, S.aimPoint.z - p.pos.z) : (t ? Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) : reach), n = g.frags || 1;
    const belt = n === 1 && g.type === 'KIN' && g.fireCd < 0.3 && !g.rocket;   // Z419 an automatic rifle / MG: a tracer every REAL.tracer.every rounds (buckshot carries none)
    for(let i = 0; i < n; i++){ const a = a0 + (n > 1 ? (i - (n - 1) / 2) * (g.spread / (n - 1)) + (Math.random() - 0.5) * g.spread * 0.15 : (Math.random() - 0.5) * g.spread * burstSpread(bn)), tr = n > 1 ? 0 : belt ? ((p._trN = (p._trN || 0) + 1) % REAL.tracer.every === 0 ? 1 : 0) : undefined;
      spawnBullet(_v.x, _v.z, a, { owner:'p', inf:!g.aoe && g.type !== 'AP', dmg, speed:g.bspeed, color:g.color, r:g.r, life:g.life, maxDist:reach, reach, y:_v.y, dropTo:air ? air.dropTo : L ? L.dropTo : 1.2, dropDist:air ? air.dropDist : L ? L.dropDist : Math.max(4, Math.min(aimD, reach)), airAim:air ? air.e : null, arcDist:air ? air.dropDist : 0,
        noArc:true, ignore:climbPerch(), type:g.type, fall:g.fall ?? 1, knock:g.knock || 0.4, fx:g.fx || 'spark', from:p.pos, tr, pierce:g.pierce || 0, aoe:g.aoe || 0, aoeDmg:g.aoe ? dmg * (g.splash || 0.5) : 0, rocket:!!g.rocket, chain:g.chain || 0, chainR:g.chainR || 0 }); }
    if(g.rocket){ spawnPart(_v.x, _v.y, _v.z, Math.sin(a0) * 4, 0.3, Math.cos(a0) * 4, { tex:'fire', color:0xfff0c0, color2:0xff6a14, size:0.9, life:0.12, grav:0, drag:6, grow:0.8 }); for(let k = 0; k < 6; k++) spawnPart(_v.x - Math.sin(a0) * 1.1, _v.y, _v.z - Math.cos(a0) * 1.1, -Math.sin(a0) * (4 + Math.random() * 4), 0.6 + Math.random(), -Math.cos(a0) * (4 + Math.random() * 4), { color:0xd8d2c4, size:0.7, life:1.0, smoke:true, grav:-0.3, drag:1.4, grow:1.6, op:0.35 }); }   // the back-blast out of the tube's rear
    else { const fk = (n > 1 ? 1.5 : 1) * (g.flashK ?? 1); gunFlash(_v.x, _v.y, _v.z, a0, 0.62 * fk, 0.34 * fk, g.type === 'ELEC' ? 0xbfe0ff : 0xfff0c0, 1, B ? B.pit : 0); gunLight(_v.x + Math.sin(a0) * 0.6, _v.y + 0.2, _v.z + Math.cos(a0) * 0.6, 0xffc87a, 1.8 * Math.min(1.4, fk)); }   // a rifle's flash, not a cannon's (Z355 each gun its own size: the AK's big, the suppressed M4's faint) · Z419 shaped along the bore, a strobe of light
    if(!g.rocket && g.type !== 'ELEC'){ if(B) shotCase(B, g, _v.x, _v.y, _v.z, a0); else rifleFX(_v.x, _v.y, _v.z, a0, g.dmg * n >= 40, g.supp); }   // GUN 3 the case out of the gun's own ejection port (a bolt / a pump gun: when he works it)   // (Z355 a suppressor swallows the muzzle smoke; the brass still flies)
    sfx(g.snd || 'rifleShot', p.pos); }
  const kick = Math.min(0.9, (0.06 + (g.dmg * (g.frags || 1)) / 160) * (g.kickK || 1)) * camKick(bn); S.camKick = Math.min(1.2, (S.camKick || 0) + kick); S.kickAng = a0; S.shake = Math.min(3.2, S.shake + kick * 0.2);   // (Z355 the AK climbs, the suppressed M4 and the MP5 sit still)
  if(!p.infiniteAmmo && inst.ammo <= 0) startReload(now, inst); updateGunHUD(); }
