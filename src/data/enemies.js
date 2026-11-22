// data/enemies.js — ENEMY_DEFS registry: hp, speed, score, scale, weapon and role per enemy type
import { HUMAN_SCALE, INFANTRY, TROOPS } from '../../config.js';

// ----------------------------- ENEMIES -----------------------------
export const ENEMY_DEFS = {
  rifle:  { ...INFANTRY.rifle, scale:TROOPS.look.scale, canShoot:false, inf:true, pal:{hull:0x8a7048,turret:0x8a7048,barrel:0x2a2a22,tread:0x3a3020,accent:0xc8b080} },   // Z79 foot soldiers
  rpg:    { ...INFANTRY.rpg,   scale:TROOPS.look.scale, canShoot:false, inf:true, rpg:true, pal:{hull:0x8a7048,turret:0x8a7048,barrel:0x4a5530,tread:0x3a3020,accent:0xff6a3a} },
  gunship:{ hp:96,  speed:9,   keep:0,  range:34, fireCd:0, dmg:0, bspeed:0, score:420, scale:1.0,  canShoot:false, air:true, pal:{hull:0x4a5040,turret:0x4a5040,barrel:0x22261e,tread:0x22261e,accent:0xff4ad0} },   // Z80 ATTACK HELICOPTER
  heliBomb:{ hp:84, speed:18,  keep:0,  range:0,  fireCd:0, dmg:0, bspeed:0, score:400, scale:1.0,  canShoot:false, air:true, bombHeli:true, pal:{hull:0x3a4434,turret:0x3a4434,barrel:0x1e221a,tread:0x1e221a,accent:0xff5a2a} },   // Z222 BOMBER HELICOPTER: bomb runs, no guns
  heliTroop:{ hp:130, speed:13, keep:0,  range:0,  fireCd:0, dmg:0, bspeed:0, score:460, scale:1.0,  canShoot:false, air:true, troopHeli:true, pal:{hull:0x5a6040,turret:0x5a6040,barrel:0x22261e,tread:0x22261e,accent:0xffc84a} },   // Z222 TRANSPORT: hovers, a squad climbs down a rope ladder
};
// ----------------------------- Z158 ENEMY CLASSES: what each unit really is, and how it fights -----------------------------
//   trav = turret traverse (rad/s; it fires only once the gun is laid) · stab = gun stabiliser (1 = fires on the move as well as halted)
//   armF / armR = damage taken on the FRONT arc / the REAR arc (sides = ×1) · smoke = pops a smoke screen and reverses when badly hit
//   aps = chance an active protection system kills an incoming rocket / missile · halt = must stop to fire · scoot = moves after every shot
//   orbit = circles you at its standoff · ifv = hunts our infantry first
export const ENEMY_CLASS = {
  heliBomb:{ vi:'TRỰC THĂNG NÉM BOM',       model:'MI-24 HIND (BOM)', tip:'không bắn — lao thẳng qua đầu rải một chuỗi bom; thấy nó vào đường bay thì bẻ lái tránh' },
  heliTroop:{ vi:'TRỰC THĂNG ĐỔ QUÂN',      model:'MI-8 HIP',         tip:'dừng lơ lửng thả lính xuống thang dây — bắn hạ khi nó đang treo, lính trên thang rơi theo' },
  gunship: { vi:'TRỰC THĂNG TẤN CÔNG',      model:'MI-28',            tip:'chỉ súng bắn thẳng, pháo phòng không và tên lửa với tới' },
};
export const ENEMY_TRAITS = {
};
for(const k in ENEMY_TRAITS) Object.assign(ENEMY_DEFS[k], ENEMY_TRAITS[k]);
// ----------------------------- WATCHTOWERS: enemy riflemen fire DOWN on your tank — shoot the tower down and they fall with it -----------------------------
export const TOWER = { hp:150, guardDmg:4, range:20, fireCd:1.7, h:8.2, getUp:1.4 };   // Z112 getUp: seconds a guard lies stunned after riding a rammed tower down · Z403 range 28 → 20 m (rounds reach +4): under a rifleman's 24 m, he sits 6–11 m up and sees over cover; the soldier's own rifle (26 m) now opens up first
// ----------------------------- FRIENDLY SOLDIERS (squad that guards the Core) -----------------------------
// Up to 5 infantry hold a ring around the monument, auto-fire at the nearest enemy, intercept incoming
// shots (body-block) and brawl. One soldier out-DPSes a tank, but a swarm of tanks will overwhelm them.
// They fight to the death; power-ups reinforce the squad and upgrade their weapons.
export const SOLDIER = { cap:8, base:3, hp:44, dmg:8, fireCd:0.7, range:17, ringR:7.8, scale:HUMAN_SCALE };
// ----------------------------- TANK CREW / RIDERS (infantry mounted on the player's tank, unlocked at Stage 3) -----------------------------
