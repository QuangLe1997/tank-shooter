// data/enemies.js — ENEMY_DEFS registry: hp, speed, score, scale, weapon and role per enemy type
import { INFANTRY, TROOPS } from '../../config.js';

// ----------------------------- ENEMIES -----------------------------
export const ENEMY_DEFS = {
  grunt:  { hp:32,  speed:6,  keep:18, range:32, fireCd:2.0,  dmg:8,  bspeed:24, score:100, scale:1.0,  ram:6,  canShoot:true,  pal:{hull:0x8a3a2a,turret:0x9b4030,barrel:0xb05040,tread:0x3a1c14,accent:0xe0603a} },
  scout:  { hp:16,  speed:12, keep:0,  range:0,  fireCd:0,    dmg:0,  bspeed:0,  score:120, scale:0.82, ram:9,  canShoot:false, pal:{hull:0xb0552a,turret:0xc06530,barrel:0xd07540,tread:0x44260f,accent:0xffa040} },
  gunner: { hp:46,  speed:5,  keep:15, range:28, fireCd:0.46, dmg:4,  bspeed:26, score:170, scale:1.08, ram:7,  canShoot:true,  burst:3, reload:2.3, pal:{hull:0x7a2f3a,turret:0x8a3540,barrel:0x9b4050,tread:0x331018,accent:0xe04060} },
  mortar: { hp:38,  speed:4,  keep:34, range:48, fireCd:2.9,  dmg:0,  bspeed:0,  score:220, scale:1.05, ram:6,  canShoot:false, mortar:true, pal:{hull:0x4a5a2a,turret:0x586a30,barrel:0x6a7a3a,tread:0x202810,accent:0xc0e060} },
  shield: { hp:64,  speed:5,  keep:16, range:30, fireCd:1.9,  dmg:8,  bspeed:25, score:240, scale:1.12, ram:8,  canShoot:true,  shield:true, pal:{hull:0x2f4a6a,turret:0x365a82,barrel:0x4070a0,tread:0x101c2a,accent:0x6fb0ff} },
  bomber: { hp:22,  speed:10, keep:0,  range:0,  fireCd:0,    dmg:0,  bspeed:0,  score:180, scale:0.9,  ram:0,  canShoot:false, bomber:true, pal:{hull:0x8a2a2a,turret:0x9a3030,barrel:0xaa3838,tread:0x300f0f,accent:0xff3020} },
  heavy:  { hp:140, speed:3,  keep:20, range:30, fireCd:2.8,  dmg:22, bspeed:40, score:340, scale:1.36, ram:11, canShoot:true,  heavy:true, pal:{hull:0x3a3e44,turret:0x464b52,barrel:0x565c64,tread:0x16181c,accent:0xff9a3a} },   // BRUISER: huge HP, slow, heavy slow shells (big knockback)
  sniper: { hp:34,  speed:5,  keep:36, range:52, fireCd:2.9,  dmg:16, bspeed:128,score:250, scale:0.98, ram:5,  canShoot:true,  accurate:true, pal:{hull:0x3a2f52,turret:0x453a60,barrel:0x564a72,tread:0x18142a,accent:0xc060ff} },   // MARKSMAN: long range, pin-point accurate, fast tracer, slow fire
  rifle:  { ...INFANTRY.rifle, scale:TROOPS.look.scale, ram:0, canShoot:false, inf:true, pal:{hull:0x8a7048,turret:0x8a7048,barrel:0x2a2a22,tread:0x3a3020,accent:0xc8b080} },   // Z79 foot soldiers
  rpg:    { ...INFANTRY.rpg,   scale:TROOPS.look.scale, ram:0, canShoot:false, inf:true, rpg:true, pal:{hull:0x8a7048,turret:0x8a7048,barrel:0x4a5530,tread:0x3a3020,accent:0xff6a3a} },
  pyro:   { hp:74,  speed:5.4, keep:7,  range:12, fireCd:0, dmg:0, bspeed:0, score:240, scale:1.1,  ram:8, canShoot:false, pyro:true, pal:{hull:0x3e3a2a,turret:0x4a4430,barrel:0x2a2a22,tread:0x1c1a12,accent:0xff7a1c} },   // Z80 FLAME TANK: closes in and hoses you with fire
  atgm:   { hp:52,  speed:4,   keep:30, range:46, fireCd:6.5, dmg:0, bspeed:0, score:290, scale:1.06, ram:6, canShoot:false, atgm:true, pal:{hull:0x8a7a52,turret:0x9a8a5e,barrel:0x3a3a30,tread:0x2e2818,accent:0xff3030} },   // Z80 TANK-DESTROYER: laser-guided missile
  engineer:{ hp:62, speed:5,   keep:26, range:0,  fireCd:0, dmg:0, bspeed:0, score:270, scale:1.04, ram:5, canShoot:false, engineer:true, pal:{hull:0x8a7a2a,turret:0x9a8a30,barrel:0x2a2a22,tread:0x2a2610,accent:0xffc020} },   // Z80 COMBAT ENGINEER: repairs damaged tanks
  gunship:{ hp:96,  speed:9,   keep:0,  range:34, fireCd:0, dmg:0, bspeed:0, score:420, scale:1.0,  ram:0, canShoot:false, air:true, pal:{hull:0x4a5040,turret:0x4a5040,barrel:0x22261e,tread:0x22261e,accent:0xff4ad0} },   // Z80 ATTACK HELICOPTER
  carrier:{ hp:96,  speed:3.4, keep:24, range:0, fireCd:0,    dmg:0,  bspeed:0,  score:360, scale:1.34, ram:8,  canShoot:false, carrier:true, crew:3, pal:{hull:0x6a6234,turret:0x7a7240,barrel:0x8a8048,tread:0x282410,accent:0xd7c24a} },   // APC: carries 3 riflemen on top; kill the chassis OR all crew → it's down
};
// ----------------------------- WATCHTOWERS: enemy riflemen fire DOWN on your tank — shoot the tower down and they fall with it -----------------------------
export const TOWER = { hp:150, guardDmg:4, range:36, fireCd:1.7, h:6.2 };
// ----------------------------- FRIENDLY SOLDIERS (squad that guards the Core) -----------------------------
// Up to 5 infantry hold a ring around the monument, auto-fire at the nearest enemy, intercept incoming
// shots (body-block) and brawl. One soldier out-DPSes a tank, but a swarm of tanks will overwhelm them.
// They fight to the death; power-ups reinforce the squad and upgrade their weapons.
export const SOLDIER = { cap:8, base:3, hp:44, dmg:8, fireCd:0.7, range:17, ringR:7.8, scale:1.9 };
// ----------------------------- TANK CREW / RIDERS (infantry mounted on the player's tank, unlocked at Stage 3) -----------------------------
// Riders stand on the tank roof and auto-fire at enemies — short range, slow fire, each with its own HP/upgrades.
// They're exposed: shots that hit the tank can wound them and crowding tanks chew them up. Dead = gone; power-ups reinforce.
export const RIDER = { cap:7, base:3, hp:30, dmg:7, fireCd:0.9, range:14, scale:0.82 };
