// combat/soldier-fire.js — Z306 THE SOLDIER FIRES HIS OWN RIFLE (soldier mode only; the tank keeps combat/flame.js fireGun): a small-arms round out of
//   the carbine's muzzle — a thin tracer, a spark or a puff of blood where it lands, no blast, no shell's smoke ribbon — a rifle's flash, its brass and its
//   crack, and a light kick of the view: no recoil shove, no hot-barrel smoke, no "too close for the main gun". His kit is the carbine, not the tank's arsenal.
import * as THREE from 'three';
import { GUNS, MOBILE, PAD, S, aimTarget, cMod, playerRange, rifleFX, sfx, spawnBullet, spawnPart, startReload, updateGunHUD, airShot } from '../hub.js';

const _v = new THREE.Vector3();
export function trooperGuns(){ return [{ id:'carbine', ammo:GUNS.carbine.mag, rU:0, rD:0 }]; }
export function soldierFire(now, range){ const p = S.player; if(!p || !p.guns.length) return; const inst = p.guns[p.gunIdx], g = GUNS[inst.id];
  if(!g || inst.rU) return; if(!p.infiniteAmmo && inst.ammo <= 0){ startReload(now, inst); return; } if(now < p.fireAt) return;
  const rapid = (now < p.overUntil || now < p.buffUntil.rapid) ? 0.5 : 1; p.fireAt = now + g.fireCd * rapid * p.fireMul; if(!p.infiniteAmmo) inst.ammo--;
  p.muzzle.getWorldPosition(_v); const air = airShot(_v.x, _v.z, g.bspeed), a = (air ? air.a : p.aimSmoothed) + (Math.random() - 0.5) * g.spread, crit = Math.random() < p.crit, power = now < p.buffUntil.power ? 1.6 : 1;
  const dmg = g.dmg * p.dmgMul * power * (crit ? 2 : 1) * cMod('playerDmgMul'), reach = (range || playerRange()) * (g.rng || 1) + 2, t = aimTarget(reach);
  const aimD = ((!MOBILE || PAD.active) && S.pointerActive) ? Math.hypot(S.aimPoint.x - p.pos.x, S.aimPoint.z - p.pos.z) : (t ? Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) : reach);
  spawnBullet(_v.x, _v.z, a, { owner:'p', inf:true, dmg, speed:g.bspeed, color:g.color, r:g.r, life:g.life, maxDist:reach, reach, y:_v.y, dropTo:air ? air.dropTo : 1.2, dropDist:air ? air.dropDist : Math.max(4, Math.min(aimD, reach)), airAim:air ? air.e : null, arcDist:air ? air.dropDist : 0,
    noArc:true, type:g.type, fall:g.fall ?? 1, knock:g.knock || 0.4, fx:g.fx || 'spark', from:p.pos });
  spawnPart(_v.x, _v.y, _v.z, Math.sin(a) * 6, 0.4, Math.cos(a) * 6, { tex:'flash', color:0xfff0b0, size:0.5, life:0.05, grav:0, drag:9 });   // a rifle's flash, not a cannon's
  rifleFX(_v.x, _v.y, _v.z, a); sfx('rifleShot', p.pos);
  S.camKick = Math.min(0.5, (S.camKick || 0) + 0.08); S.kickAng = a; S.shake = Math.min(3.2, S.shake + 0.015);
  if(!p.infiniteAmmo && inst.ammo <= 0) startReload(now, inst); updateGunHUD(); }
