// data/enemies.js — ENEMY_DEFS registry: hp, speed, score, scale, weapon and role per enemy type
import { INFANTRY, TROOPS } from '../../config.js';

// ----------------------------- ENEMIES -----------------------------
export const ENEMY_DEFS = {
  grunt:  { hp:32,  speed:6,  keep:18, range:32, fireCd:2.0,  dmg:8,  bspeed:24, score:100, scale:1.0,  ram:6,  canShoot:true,  pal:{hull:0x8a3a2a,turret:0x9b4030,barrel:0xb05040,tread:0x3a1c14,accent:0xe0603a} },
  scout:  { hp:16,  speed:12, keep:0,  range:0,  fireCd:0,    dmg:0,  bspeed:0,  score:120, scale:0.82, ram:9,  canShoot:false, pal:{hull:0xb0552a,turret:0xc06530,barrel:0xd07540,tread:0x44260f,accent:0xffa040} },
  gunner: { hp:46,  speed:5,  keep:15, range:28, fireCd:0.46, dmg:4,  bspeed:26, score:170, scale:1.08, ram:7,  canShoot:true,  burst:3, reload:2.3, pal:{hull:0x7a2f3a,turret:0x8a3540,barrel:0x9b4050,tread:0x331018,accent:0xe04060} },
  mortar: { hp:38,  speed:4,  keep:34, range:48, fireCd:2.9,  dmg:0,  bspeed:0,  score:220, scale:1.05, ram:6,  canShoot:false, mortar:true, pal:{hull:0x4a5a2a,turret:0x586a30,barrel:0x6a7a3a,tread:0x202810,accent:0xc0e060} },
  shield: { hp:64,  speed:5,  keep:16, range:30, fireCd:1.9,  dmg:8,  bspeed:25, score:240, scale:1.12, ram:8,  canShoot:true,  shield:true, pal:{hull:0x44586a,turret:0x4f667c,barrel:0x5a6a78,tread:0x141c24,accent:0x6fb0ff} },
  bomber: { hp:22,  speed:10, keep:0,  range:0,  fireCd:0,    dmg:0,  bspeed:0,  score:180, scale:0.9,  ram:0,  canShoot:false, bomber:true, pal:{hull:0x8a2a2a,turret:0x9a3030,barrel:0xaa3838,tread:0x300f0f,accent:0xff3020} },
  heavy:  { hp:140, speed:3,  keep:20, range:30, fireCd:2.8,  dmg:22, bspeed:40, score:340, scale:1.36, ram:11, canShoot:true,  heavy:true, pal:{hull:0x5a6066,turret:0x666d74,barrel:0x5c6268,tread:0x1a1c20,accent:0xff9a3a} },   // BRUISER: huge HP, slow, heavy slow shells (big knockback)
  chief:  { hp:120, speed:10, keep:22, range:46, fireCd:3.0,  dmg:30, bspeed:110,score:900, scale:0.92, ram:8,  canShoot:true,  accurate:true, chief:true, pal:{hull:0x45464a,turret:0x505157,barrel:0x2c2d31,tread:0x121214,accent:0xffd24a} },   // Z107 FORTRESS COMMANDER: small, fast, circle-strafes, slow but deadly leading shots
  sniper: { hp:34,  speed:5,  keep:36, range:52, fireCd:2.9,  dmg:16, bspeed:128,score:250, scale:0.98, ram:5,  canShoot:true,  accurate:true, pal:{hull:0x3a2f52,turret:0x453a60,barrel:0x564a72,tread:0x18142a,accent:0xc060ff} },   // MARKSMAN: long range, pin-point accurate, fast tracer, slow fire
  rifle:  { ...INFANTRY.rifle, scale:TROOPS.look.scale, ram:0, canShoot:false, inf:true, pal:{hull:0x8a7048,turret:0x8a7048,barrel:0x2a2a22,tread:0x3a3020,accent:0xc8b080} },   // Z79 foot soldiers
  rpg:    { ...INFANTRY.rpg,   scale:TROOPS.look.scale, ram:0, canShoot:false, inf:true, rpg:true, pal:{hull:0x8a7048,turret:0x8a7048,barrel:0x4a5530,tread:0x3a3020,accent:0xff6a3a} },
  pyro:   { hp:74,  speed:5.4, keep:7,  range:12, fireCd:0, dmg:0, bspeed:0, score:240, scale:1.1,  ram:8, canShoot:false, pyro:true, pal:{hull:0x3e3a2a,turret:0x4a4430,barrel:0x2a2a22,tread:0x1c1a12,accent:0xff7a1c} },   // Z80 FLAME TANK: closes in and hoses you with fire
  atgm:   { hp:52,  speed:4,   keep:30, range:46, fireCd:6.5, dmg:0, bspeed:0, score:290, scale:1.06, ram:6, canShoot:false, atgm:true, pal:{hull:0x8a7a52,turret:0x9a8a5e,barrel:0x3a3a30,tread:0x2e2818,accent:0xff3030} },   // Z80 TANK-DESTROYER: laser-guided missile
  engineer:{ hp:62, speed:5,   keep:26, range:0,  fireCd:0, dmg:0, bspeed:0, score:270, scale:1.04, ram:5, canShoot:false, engineer:true, pal:{hull:0x8a7a2a,turret:0x9a8a30,barrel:0x2a2a22,tread:0x2a2610,accent:0xffc020} },   // Z80 COMBAT ENGINEER: repairs damaged tanks
  gunship:{ hp:96,  speed:9,   keep:0,  range:34, fireCd:0, dmg:0, bspeed:0, score:420, scale:1.0,  ram:0, canShoot:false, air:true, pal:{hull:0x4a5040,turret:0x4a5040,barrel:0x22261e,tread:0x22261e,accent:0xff4ad0} },   // Z80 ATTACK HELICOPTER
  launcher:{ hp:70, speed:4.2, keep:40, range:58, fireCd:7, dmg:0, bspeed:0, score:340, scale:1.18, ram:6, canShoot:false, truck:true, pal:{hull:0x9a8656,turret:0x86744a,barrel:0x2c2c24,tread:0x2a2418,accent:0xff6a3a} },   // Z116 ROCKET TRUCK: 6×6 with an 8-tube pod — siege & anti-air rockets
  carrier:{ hp:96,  speed:3.4, keep:24, range:0, fireCd:0,    dmg:0,  bspeed:0,  score:360, scale:1.34, ram:8,  canShoot:false, carrier:true, crew:3, pal:{hull:0x6a6234,turret:0x7a7240,barrel:0x8a8048,tread:0x282410,accent:0xd7c24a} },   // APC: carries 3 riflemen on top; kill the chassis OR all crew → it's down
};
// ----------------------------- Z158 ENEMY CLASSES: what each unit really is, and how it fights -----------------------------
//   trav = turret traverse (rad/s; it fires only once the gun is laid) · stab = gun stabiliser (1 = fires on the move as well as halted)
//   armF / armR = damage taken on the FRONT arc / the REAR arc (sides = ×1) · smoke = pops a smoke screen and reverses when badly hit
//   aps = chance an active protection system kills an incoming rocket / missile · halt = must stop to fire · scoot = moves after every shot
//   orbit = circles you at its standoff · ifv = hunts our infantry first
export const ENEMY_CLASS = {
  grunt:   { vi:'XE TĂNG CHỦ LỰC',          model:'T-90M',            tip:'giáp trước dày, bắn được khi đang chạy — đánh vào sườn và đuôi' },
  scout:   { vi:'XE TRINH SÁT',             model:'BRM-3K',           tip:'đánh dấu vị trí ta cho cả đội địch bắn chính xác hơn — hạ nó trước' },
  gunner:  { vi:'XE CHIẾN ĐẤU BỘ BINH',     model:'BMP-3',            tip:'pháo 30 ly bắn loạt, ưu tiên diệt bộ binh của ta; giáp mỏng' },
  mortar:  { vi:'PHÁO TỰ HÀNH',             model:'2S19 MSTA-S',      tip:'đứng xa gọi pháo kích — xông vào gần là nó yếu' },
  shield:  { vi:'XE TĂNG ĐỘT KÍCH',         model:'MERKAVA MK.4',     tip:'giáp trước cực dày + Trophy chặn tên lửa — vòng ra sau mà bắn' },
  bomber:  { vi:'XE CẢM TỬ ĐIỀU KHIỂN',     model:'URAN-9 (BIẾN THỂ NỔ)', tip:'lao thẳng vào xe ta rồi kích nổ — bắn hạ từ xa' },
  heavy:   { vi:'XE TĂNG ĐỘT PHÁ',          model:'T-14 ARMATA',      tip:'tháp xoay chậm, giáp trước gần như không xuyên, Afghanit chặn tên lửa — đánh sườn' },
  chief:   { vi:'XE CHỈ HUY',               model:'K2 (BẢN CHỈ HUY)', tip:'cả đội quanh nó bắn nhanh và chính xác hơn — hạ nó là đội hình rối loạn' },
  sniper:  { vi:'PHÁO CHỐNG TĂNG TỰ HÀNH',  model:'2S25 SPRUT-SD',    tip:'dừng lại mới bắn, bắn xong là đổi chỗ — áp sát khi nó đang ngắm' },
  pyro:    { vi:'XE TĂNG PHUN LỬA',         model:'T-90 PHUN LỬA',    tip:'chỉ nguy hiểm ở gần — giữ khoảng cách' },
  atgm:    { vi:'XE PHÓNG TÊN LỬA CHỐNG TĂNG', model:'9P157 KHRIZANTEMA-S', tip:'phải đứng yên dẫn tên lửa — bắn trúng là cắt đường dẫn' },
  engineer:{ vi:'XE CÔNG BINH CỨU KÉO',     model:'BREM-1',           tip:'hàn sửa xe địch bị thương — diệt nó để địch hết hồi máu' },
  carrier: { vi:'XE THIẾT GIÁP CHỞ QUÂN',   model:'BTR TÍCH XÍCH',    tip:'dừng lại thả bộ binh — diệt trước khi lính xuống' },
  launcher:{ vi:'XE PHÓNG ROCKET',          model:'BM-21 GRAD',       tip:'bắn loạt rocket vòng cầu từ rất xa' },
  gunship: { vi:'TRỰC THĂNG TẤN CÔNG',      model:'MI-28',            tip:'chỉ súng bắn thẳng, pháo phòng không và tên lửa với tới' },
};
export const ENEMY_TRAITS = {
  grunt:   { trav:1.7, stab:0.85, armF:0.7,  armR:1.45, smoke:true },
  scout:   { trav:3.2, stab:0.65, armF:0.9,  armR:1.3,  orbit:true, canShoot:true, dmg:3, fireCd:0.14, burst:5, reload:2.2, range:28, bspeed:60, keep:24, ram:4 },
  gunner:  { trav:2.6, stab:0.7,  armF:0.85, armR:1.35, ifv:true },
  mortar:  { trav:1.0, armF:0.9,  armR:1.35 },
  shield:  { trav:1.4, stab:0.85, armF:0.45, armR:1.4,  aps:0.5, smoke:true },
  bomber:  { armF:1,   armR:1 },
  heavy:   { trav:0.9, stab:0.8,  armF:0.5,  armR:1.5,  aps:0.35, smoke:true },
  chief:   { trav:2.4, stab:0.95, armF:0.7,  armR:1.45, smoke:true },
  sniper:  { trav:1.2, stab:0.3,  armF:0.85, armR:1.4,  halt:true, scoot:true },
  pyro:    { trav:1.8, armF:0.7,  armR:1.5 },
  atgm:    { trav:1.4, armF:0.85, armR:1.4 },
  engineer:{ armF:0.8, armR:1.4 },
  carrier: { armF:0.85, armR:1.35 },
  launcher:{ armF:1,   armR:1.2 },
};
for(const k in ENEMY_TRAITS) Object.assign(ENEMY_DEFS[k], ENEMY_TRAITS[k]);
// ----------------------------- WATCHTOWERS: enemy riflemen fire DOWN on your tank — shoot the tower down and they fall with it -----------------------------
export const TOWER = { hp:150, guardDmg:4, range:28, fireCd:1.7, h:6.2, getUp:1.4 };   // Z112 getUp: seconds a guard lies stunned after riding a rammed tower down
// ----------------------------- FRIENDLY SOLDIERS (squad that guards the Core) -----------------------------
// Up to 5 infantry hold a ring around the monument, auto-fire at the nearest enemy, intercept incoming
// shots (body-block) and brawl. One soldier out-DPSes a tank, but a swarm of tanks will overwhelm them.
// They fight to the death; power-ups reinforce the squad and upgrade their weapons.
export const SOLDIER = { cap:8, base:3, hp:44, dmg:8, fireCd:0.7, range:17, ringR:7.8, scale:1.9 };
// ----------------------------- TANK CREW / RIDERS (infantry mounted on the player's tank, unlocked at Stage 3) -----------------------------
// Riders stand on the tank roof and auto-fire at enemies — short range, slow fire, each with its own HP/upgrades.
// They're exposed: shots that hit the tank can wound them and crowding tanks chew them up. Dead = gone; power-ups reinforce.
export const RIDER = { guardR:23, guardHit:0.3, cap:12, base:5, perUp:2, hp:30,   // Z111b 12 seats (roof + fenders + rear deck), 5 filled + 2 per KÍP LÍNH XE level
  dmg:7, fireCd:0.9, range:14, scale:0.82 };
