// combat/soldier-fire.js — Z306 THE SOLDIER FIRES HIS OWN RIFLE (soldier mode only; the tank keeps combat/flame.js fireGun): a small-arms round out of
//   the carbine's muzzle — a thin tracer, a spark or a puff of blood where it lands, no blast, no shell's smoke ribbon — a rifle's flash, its brass and its
//   crack, and a light kick of the view: no recoil shove, no hot-barrel smoke, no "too close for the main gun".
// Z329 HIS WHOLE ARSENAL: the nine hand weapons (data/guns.js, trooper:true; the Tripo models in config INFGUN) — he starts with the carbine and a B41, picks
//   the rest up from the "SÚNG MỚI" crate, switches with the number keys / Q / E like the tank. Each fires its own way from his own muzzle: rounds (the
//   PKM, the minigun), eight pellets (the shotgun), a slug through two men (the 12.7), a rocket that bursts (the B41), a grenade lobbed onto the aim point (the
//   M79), a flame (the thrower), an arc that jumps to the next man (the energy rifle). Not the tank's: never in its shop, never kept in its arsenal.
import * as THREE from 'three';
import { RIDER_TURN, TROOPER } from '../../config.js';
import { GUNS, MOBILE, PAD, S, aimTarget, cMod, fireFlame, fireMortar, floatText, magCap, playerRange, rifleFX, ringPulse, sfx, spawnBullet, spawnPart, startReload, updateGunHUD, airShot, CV } from '../hub.js';

const _v = new THREE.Vector3();
export function trooperGuns(){ return ['carbine', 't_rpg'].map(id => ({ id, ammo:GUNS[id].mag, rU:0, rD:0 })); }
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
export function soldierFire(now, range){ const p = S.player; if(!p || !p.guns.length) return; const inst = p.guns[p.gunIdx], g = GUNS[inst.id];
  if(!g || inst.rU) return; if(!p.infiniteAmmo && inst.ammo <= 0){ startReload(now, inst); return; } if(now < p.fireAt) return;
  const R = CV.mounted && CV.real; if(R && R.sat && R.gunYaw != null){ const off = R.gunYaw - p.aimSmoothed; if(Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > RIDER_TURN.fire) return; }   // Z340 turning round in the saddle: the trigger waits for the bore to come onto the aim
  const rapid = (now < p.overUntil || now < p.buffUntil.rapid) ? 0.5 : 1, st = (inst.star || 1) - 1, SK = TROOPER.star; p.fireAt = now + g.fireCd * rapid * p.fireMul * (1 - SK.rate * st); if(!p.infiniteAmmo) inst.ammo--;   // Z352 each star: a quicker trigger
  p.muzzle.getWorldPosition(_v); const air = g.special ? null : airShot(_v.x, _v.z, g.bspeed), a0 = air ? air.a : p.aimSmoothed, crit = Math.random() < p.crit, power = now < p.buffUntil.power ? 1.6 : 1;
  const dmg = g.dmg * p.dmgMul * power * (crit ? 2 : 1) * cMod('playerDmgMul') * (1 + SK.dmg * st), reach = (range || playerRange()) * (g.rng || 1) + 2, t = aimTarget(reach);
  if(g.special === 'flame'){ fireFlame(now, g, _v.x, _v.z, a0, dmg / (g.dmg || 1)); if(Math.random() < 0.12) sfx(g.snd, p.pos); }
  else if(g.special === 'mortar'){ fireMortar(now, g, dmg); sfx(g.snd || 'shoot_agl', p.pos); }
  else { const aimD = ((!MOBILE || PAD.active) && S.pointerActive) ? Math.hypot(S.aimPoint.x - p.pos.x, S.aimPoint.z - p.pos.z) : (t ? Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) : reach), n = g.frags || 1;
    for(let i = 0; i < n; i++){ const a = a0 + (n > 1 ? (i - (n - 1) / 2) * (g.spread / (n - 1)) + (Math.random() - 0.5) * g.spread * 0.15 : (Math.random() - 0.5) * g.spread);
      spawnBullet(_v.x, _v.z, a, { owner:'p', inf:!g.aoe && g.type !== 'AP', dmg, speed:g.bspeed, color:g.color, r:g.r, life:g.life, maxDist:reach, reach, y:_v.y, dropTo:air ? air.dropTo : 1.2, dropDist:air ? air.dropDist : Math.max(4, Math.min(aimD, reach)), airAim:air ? air.e : null, arcDist:air ? air.dropDist : 0,
        noArc:true, type:g.type, fall:g.fall ?? 1, knock:g.knock || 0.4, fx:g.fx || 'spark', from:p.pos, pierce:g.pierce || 0, aoe:g.aoe || 0, aoeDmg:g.aoe ? dmg * (g.splash || 0.5) : 0, rocket:!!g.rocket, chain:g.chain || 0, chainR:g.chainR || 0 }); }
    if(g.rocket){ spawnPart(_v.x, _v.y, _v.z, Math.sin(a0) * 4, 0.3, Math.cos(a0) * 4, { tex:'fire', color:0xfff0c0, color2:0xff6a14, size:0.9, life:0.12, grav:0, drag:6, grow:0.8 }); for(let k = 0; k < 6; k++) spawnPart(_v.x - Math.sin(a0) * 1.1, _v.y, _v.z - Math.cos(a0) * 1.1, -Math.sin(a0) * (4 + Math.random() * 4), 0.6 + Math.random(), -Math.cos(a0) * (4 + Math.random() * 4), { color:0xd8d2c4, size:0.7, life:1.0, smoke:true, grav:-0.3, drag:1.4, grow:1.6, op:0.35 }); }   // the back-blast out of the tube's rear
    else spawnPart(_v.x, _v.y, _v.z, Math.sin(a0) * 6, 0.4, Math.cos(a0) * 6, { tex:'flash', color:g.type === 'ELEC' ? 0xbfe0ff : 0xfff0b0, size:0.5 * (n > 1 ? 1.5 : 1), life:0.05, grav:0, drag:9 });   // a rifle's flash, not a cannon's
    if(!g.rocket && g.type !== 'ELEC') rifleFX(_v.x, _v.y, _v.z, a0, g.dmg * n >= 40);
    sfx(g.snd || 'rifleShot', p.pos); }
  const kick = Math.min(0.9, 0.06 + (g.dmg * (g.frags || 1)) / 160); S.camKick = Math.min(1.2, (S.camKick || 0) + kick); S.kickAng = a0; S.shake = Math.min(3.2, S.shake + kick * 0.2);
  if(!p.infiniteAmmo && inst.ammo <= 0) startReload(now, inst); updateGunHUD(); }
