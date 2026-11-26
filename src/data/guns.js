// data/guns.js — GUNS registry: damage type, damage, fire rate, magazine, reload, projectile per gun

// ===== GUNS — the soldier's hand weapons (no-tanks: the tank's 22 guns, its tier ladder, VIP and ultimate guns are gone) =====
// Stat model: dmg (per fragment) · fireCd (s/shot) · mag (rounds) · reload (s)
// · frags (pellets/shot, 1 ammo) · spread · bspeed · aoe (m) + splash (share of dmg the blast adds, the struck target included).
export const GUNS = {   // ARMS DOCTRINE (Z75): type = damage class (config DMG_TYPE) · rng = reach × combat range · fall = damage left at full reach
  carbine: { name:'SÚNG TRƯỜNG 7.62', svg:'carbine', tier:1, trooper:true, type:'KIN', dmg:12, fireCd:0.15, mag:30, reload:2.2, bspeed:95, frags:1, spread:0.025, color:0xffd27a, r:0.16, life:1.1, recoil:0, knock:0.4, fx:'spark', rng:1.0, fall:0.6 },   // Z306 the soldier's own rifle (soldier mode only): a rifle round, not the tank's 30 mm shell
  // Z329 THE SOLDIER'S ARSENAL (soldier mode only; never sold to the tank, never in its arsenal): one hand weapon per Tripo model (config INFGUN), each fired
  //   by combat/soldier-fire.js — rounds, pellets, a slug that goes through, a rocket, a lobbed grenade, a flame, an arc. snd = its shot sound
  t_lmg:     { name:'ĐẠI LIÊN PKM', svg:'pkm', tier:2, trooper:true, type:'KIN', dmg:11, fireCd:0.09, mag:100, reload:4.6, bspeed:92, frags:1, spread:0.06, color:0xffd27a, r:0.18, life:1.2, knock:0.5, fx:'spark', rng:1.05, fall:0.6, snd:'rifleShot' },
  t_minigun: { name:'SÚNG NÒNG XOAY', svg:'minigunH', tier:3, trooper:true, type:'KIN', dmg:8, fireCd:0.045, mag:240, reload:5.6, bspeed:88, frags:1, spread:0.09, color:0xfff0c0, r:0.17, life:1.1, knock:0.5, fx:'spark', rng:0.95, fall:0.55, snd:'shoot_minigun' },
  t_shotgun: { name:'SÚNG SĂN 12', svg:'shotgunH', tier:2, trooper:true, type:'FRAG', dmg:10, fireCd:0.75, mag:7, reload:2.8, bspeed:72, frags:8, spread:0.42, color:0xffb070, r:0.14, life:0.6, knock:1.2, fx:'spark', rng:0.55, fall:0.25, snd:'shoot_shotgun' },
  t_sniper:  { name:'SÚNG BẮN TỈA 12.7', svg:'sniper', tier:3, trooper:true, type:'AP', dmg:95, fireCd:1.3, mag:5, reload:3.2, bspeed:170, frags:1, spread:0, color:0xfff4d0, r:0.2, life:1.4, pierce:2, knock:1.6, fx:'pierce', rng:1.5, fall:1, snd:'shoot_cannon' },
  t_rpg:     { name:'B41 (RPG-7)', svg:'b41', tier:2, trooper:true, type:'HE', dmg:70, fireCd:1.2, mag:1, reload:2.8, bspeed:48, frags:1, spread:0.01, color:0xff8a3a, r:0.3, life:2.2, aoe:3.2, splash:0.6, rocket:true, knock:1.8, fx:'blast', rng:1.1, fall:1, snd:'rocketlaunch' },
  t_gl:      { name:'SÚNG PHÓNG LỰU M79', svg:'m79', tier:2, trooper:true, type:'HE', dmg:40, fireCd:0.9, mag:6, reload:3.0, bspeed:0, frags:1, spread:0, color:0xc8e070, r:0.3, life:0, special:'mortar', small:true, aoeR:3.0, bossDmg:24, knock:0, fx:'blast', rng:1, fall:1, snd:'shoot_agl' },
  t_flamer:  { name:'SÚNG PHUN LỬA', svg:'flamerH', tier:2, trooper:true, type:'FIRE', dmg:1, fireCd:0.05, mag:120, reload:3.4, bspeed:0, frags:1, spread:0, color:0xff6a1c, r:0, life:0, special:'flame', range:14, knock:0, fx:'spark', rng:1, fall:1, snd:'shoot_flame' },
  // Z355 three real guns (Meshy community, CC0; models in assets/models/real/gun/inf): the AK-47 the enemy riflemen drop, an M4 with suppressor and optic, an MP5
  //   (flashK = muzzle-flash size ×, kickK = the view's kick ×, supp = suppressed: a faint flash, no muzzle smoke)
  t_ak:      { name:'AK-47', svg:'ak', tier:2, trooper:true, type:'KIN', dmg:16, fireCd:0.13, mag:30, reload:2.4, bspeed:92, frags:1, spread:0.035, color:0xffc870, r:0.18, life:1.15, knock:0.55, fx:'spark', rng:1.05, fall:0.6, snd:'shoot_ak', flashK:1.35, kickK:1.45 },
  t_m4:      { name:'M4 GIẢM THANH', svg:'m4', tier:2, trooper:true, type:'KIN', dmg:13, fireCd:0.1, mag:30, reload:2.0, bspeed:108, frags:1, spread:0.014, color:0xfff0c8, r:0.15, life:1.2, knock:0.4, fx:'spark', rng:1.15, fall:0.65, snd:'shoot_m4s', flashK:0.2, kickK:0.7, supp:true },
  t_mp5:     { name:'TIỂU LIÊN MP5', svg:'mp5', tier:2, trooper:true, type:'KIN', dmg:9, fireCd:0.068, mag:30, reload:1.7, bspeed:84, frags:1, spread:0.05, color:0xffe0a0, r:0.15, life:0.8, knock:0.35, fx:'spark', rng:0.75, fall:0.5, snd:'shoot_mp5', flashK:0.8, kickK:0.75, ammo:'pistol' },
  t_energy:  { name:'SÚNG XUNG ĐIỆN', svg:'arc', tier:3, trooper:true, type:'ELEC', dmg:30, fireCd:0.3, mag:20, reload:2.6, bspeed:120, frags:1, spread:0.03, color:0x5aa0ff, r:0.22, life:1.0, chain:2, chainR:7, knock:0.6, fx:'shock', rng:0.85, fall:0.8, snd:'shoot_tesla' },
  // Z387 the four downloaded Meshy community scans as his weapons (assets/models/real/gun/inf, tools/scene-import.mjs): a heavy rust-iron assault rifle, a scoped
  //   marksman's rifle that punches through a man, a green-coiled rail rifle whose slug goes through a squad, a saw launcher hurling a spinning blade at short range
  t_rust:    { name:'SÚNG TRƯỜNG THÉP GỈ', svg:'rustAr', tier:2, trooper:true, type:'KIN', dmg:19, fireCd:0.14, mag:30, reload:2.6, bspeed:94, frags:1, spread:0.04, color:0xffc060, r:0.19, life:1.15, knock:0.65, fx:'spark', rng:1.05, fall:0.6, snd:'shoot_ak', flashK:1.45, kickK:1.6 },
  t_dmr:     { name:'SÚNG TỈA BÁN TỰ ĐỘNG', svg:'dmr', tier:3, trooper:true, type:'AP', dmg:52, fireCd:0.55, mag:10, reload:2.8, bspeed:150, frags:1, spread:0.004, color:0xfff0c8, r:0.18, life:1.3, pierce:1, knock:1.1, fx:'pierce', rng:1.35, fall:0.9, snd:'shoot_rifle', flashK:1.1, kickK:1.3 },
  t_rail:    { name:'SÚNG RAY NGỌC', svg:'railH', tier:3, trooper:true, type:'AP', dmg:120, fireCd:1.6, mag:4, reload:3.4, bspeed:240, frags:1, spread:0, color:0x7dffb0, r:0.24, life:1.2, pierce:4, knock:2.0, fx:'pierce', rng:1.55, fall:1, snd:'shoot_railgun', flashK:1.2, kickK:1.2 },
  t_saw:     { name:'SÚNG BẮN LƯỠI CƯA', svg:'saw', tier:2, trooper:true, type:'KIN', dmg:36, fireCd:0.42, mag:12, reload:2.6, bspeed:58, frags:1, spread:0.02, color:0xd8d8d0, r:0.34, life:0.75, pierce:3, knock:1.4, fx:'spark', rng:0.7, fall:0.5, snd:'shoot_shotgun', flashK:0.6, kickK:1.1, ammo:'blade' },
};
// Z149 what the blast adds on top of a direct hit (0 for guns without a contact blast; mortar-type shells hit by area only)
export function gunSplash(g){ return g && g.aoe && !g.special ? (g.splash??0.8) : 0; }
// one trigger pull on a single target the round strikes: pellets × damage, plus its blast
export function gunShotDmg(g){ return (g.dmg||0)*(g.frags||1)*(1+gunSplash(g)); }
// SUPPLY 1 the class of ammunition a gun eats (config LOGISTICS.start: one reserve a class) — read off the entry; `ammo` names it only where the entry cannot say
//   (the MP5's pistol rounds, the saw launcher's blades)
export function ammoKind(g){ return !g ? 'rifle' : g.ammo || (g.rocket ? 'rocket' : g.special === 'mortar' ? 'shell' : g.special === 'flame' ? 'fuel' : g.type === 'ELEC' ? 'cell' : (g.frags || 1) > 1 ? 'shot' : g.type === 'AP' ? 'heavy' : g.mag >= 100 ? 'belt' : 'rifle'); }
