// data/guns.js — GUNS registry: damage type, damage, fire rate, magazine, reload, projectile per gun

// ===== GUNS =====
// Stat model: dmg (per fragment) · fireCd (s/shot) · mag (rounds) · reload (s)
// · frags (pellets/shot, 1 ammo) · spread · bspeed · aoe (m) + splash (share of dmg the blast adds, the struck target included).
// Z149 TIER LADDER — every gun is budgeted on SUSTAINED damage per second (mag + reload cycle) against one medium tank:
//   BẬC 1 (starter)  ≈ 50–55   rifle · smg
//   BẬC 2 (1.3–3k)   ≈ 60–76   each with a role: point-blank (shotgun) · freeze (cryo) · anti-air/crowd (flak) · tank-killer (cannon) · burn (flamer) · grenades (agl) · bunker-buster (hesh) · indirect (mortar)
//   BẬC 3 (4–5.5k)   ≈ 76–108  the same roles, harder: rotary (minigun) · never-miss (missile) · chain (tesla) · fuel-air (thermo) · heavy indirect (arty)
//   VIP              ≈ 100+    railgun (pierces a column) · siege rocket (wipes an area)
//   Lower-DPS guns in a tier pay it back with area, control or reach — never with raw numbers above the next tier.
//   How many tubes a gun has (GUN_BARRELS) only changes which muzzle fires — two barrels never means double damage.
export const GUNS = {   // ARMS DOCTRINE (Z75): type = damage class (config DMG_TYPE) · rng = reach × combat range · fall = damage left at full reach
  // ---- BẬC 1 ----
  rifle:   { name:'PHÁO TỰ ĐỘNG 30', svg:'rifle', tier:1, type:'KIN', dmg:14, fireCd:0.2, mag:24, reload:1.9, bspeed:68, frags:1, spread:0.03, color:0xaef0a0, r:0.42, life:2.0, recoil:0.9, knock:1.0, fx:'spark', flash:'auto', rng:1.0, fall:0.7 },
  smg:     { name:'ĐẠI LIÊN ĐÔI',   svg:'smg', tier:1, type:'KIN', dmg:7,  fireCd:0.075,mag:45, reload:2.6, bspeed:74, frags:1, spread:0.08, color:0xfff0a0, r:0.32, life:1.6, recoil:0.3, knock:0.6, fx:'spark', flash:'small', rng:0.8, fall:0.5 },   // twin HMG: fast but short and light — no longer out-damages tier 2
  // ---- BẬC 2 ----
  shotgun: { name:'PHÁO CHÙM 152',    svg:'shotgun', tier:2, type:'FRAG', dmg:10, fireCd:0.65, mag:6,  reload:2.4, bspeed:58, frags:8, spread:0.55, color:0xff8a38, r:0.36, life:0.7, recoil:2.4, knock:1.9, fx:'frag', flash:'heavy', rng:0.6, fall:0.25 },
  cryo:    { name:'SÚNG BĂNG',  svg:'snow', tier:2, type:'CRYO', dmg:18, fireCd:0.28, mag:20, reload:2.4, bspeed:60, frags:1, spread:0.05, color:0x9fe8ff, r:0.42, life:1.8, freeze:2.0, recoil:0.9, knock:0.8, fx:'ice', flash:'frost', rng:0.85, fall:0.8 },          // control: freezes (half on heavy armour)
  flak:    { name:'PHÁO PHÒNG KHÔNG',   svg:'flak', tier:2, type:'HE', dmg:8, fireCd:0.6, mag:10, reload:2.8, bspeed:54, frags:5, spread:0.34, color:0x8fc8ff, r:0.46,  life:0.9, aoe:2.2, splash:0.35, recoil:1.4, knock:1.2, fx:'frag', flash:'auto', rng:0.9, fall:0.75 },   // airbursts: small blasts, ×aaBonus on aircraft
  cannon:  { name:'PHÁO 120',  svg:'cannon', tier:2, type:'AP', dmg:85, fireCd:1.0,  mag:5,  reload:3.0, bspeed:76, frags:1, spread:0.01, color:0xffb83a, r:0.55, life:2.0, aoe:2.4, splash:0.25, pierce:1, recoil:3.6, knock:2.6, fx:'blast', flash:'heavy', rng:1.2, fall:1 },   // tank-killer: AP ×1.45 on heavy armour
  flamer:  { name:'SÚNG PHUN LỬA', svg:'flame', tier:2, type:'FIRE', dmg:1, fireCd:0.05, mag:140, reload:3.2, bspeed:0, frags:1, spread:0, color:0xff6a1c, r:0, life:0, special:'flame', range:20, recoil:0.12, knock:0, fx:'spark', rng:1, fall:1 },   // burn DoT (BALANCE.flame) — now scales with your damage upgrades
  agl:     { name:'PHÓNG LỰU 40', svg:'agl', tier:2, type:'HE', dmg:20, fireCd:0.24, mag:18, reload:2.8, bspeed:0, frags:1, spread:0, color:0xc8e070, r:0.4, life:0, special:'mortar', small:true, aoeR:2.9, bossDmg:14, recoil:0.5, knock:0, fx:'blast', rng:1, fall:1 },   // Z81 40 mm automatic grenade launcher — lobs a stream of small HE grenades onto the cursor
  hesh:    { name:'PHÁO HESH 105', svg:'hesh', tier:2, type:'HESH', dmg:64, fireCd:0.9, mag:6, reload:2.8, bspeed:62, frags:1, spread:0.02, color:0xe0b080, r:0.55, life:2.0, aoe:2.8, splash:0.3, recoil:3.0, knock:2.2, fx:'blast', flash:'heavy', rng:1.05, fall:0.9 },   // bunker-buster
  mortar:  { name:'SÚNG CỐI', svg:'mortar', tier:2, type:'HE', dmg:52, fireCd:0.8, mag:6, reload:3.0, bspeed:0, frags:1, spread:0, color:0xffc24a, r:0.5, life:0, special:'mortar', aoeR:5.0, bossDmg:34, recoil:1.1, knock:0, fx:'blast', rng:1, fall:1 },
  // ---- BẬC 3 ----
  minigun: { name:'PHÁO NÒNG XOAY',    svg:'minigun', tier:3, type:'KIN', dmg:9.5, fireCd:0.05, mag:110, reload:4.2, bspeed:80, frags:1, spread:0.11, color:0xfff4e0, r:0.34, life:1.8, recoil:0.25, knock:0.5, fx:'spark', flash:'small', rng:0.9, fall:0.6, spinUp:0.7 },   // must spin up
  missile: { name:'TÊN LỬA KHOÁ',     svg:'missile', tier:3, type:'HE', dmg:56, fireCd:0.55, mag:8,  reload:3.0, bspeed:95, frags:1, spread:0.05, color:0xff6a28, r:0.5,  life:3.2, homing:9, lock:true, aoe:3.0, splash:0.35, recoil:1.4, knock:2.0, fx:'blast', flash:'launch', rng:1.3, fall:1 },
  tesla:   { name:'SÚNG SÉT TESLA', svg:'bolt', tier:3, type:'ELEC', dmg:40, fireCd:0.34, mag:16, reload:2.6, bspeed:110, frags:1, spread:0.04, color:0x5aa0ff, r:0.4,  life:1.2, chain:3, chainR:9, recoil:0.5, knock:0.7, fx:'shock', flash:'arc', rng:0.8, fall:0.8 },    // chain lightning
  thermo:  { name:'ROCKET NHIỆT ÁP', svg:'thermo', tier:3, type:'TBX', dmg:120, fireCd:1.5, mag:3, reload:3.8, bspeed:46, frags:1, spread:0.01, color:0xff9a3a, r:0.6, life:2.4, aoe:6.5, splash:0.8, recoil:2.4, knock:2.4, fx:'blast', flash:'launch', rng:1.1, fall:1 },   // Z81 fuel-air rocket: huge blast + burns everything in it
  arty:    { name:'LỰU PHÁO', svg:'howitzer', tier:3, type:'HE', dmg:110, fireCd:0.95, mag:5, reload:3.2, bspeed:0, frags:1, spread:0, color:0xffd24a, r:0.6, life:0, special:'mortar', aoeR:6.0, bossDmg:70, recoil:1.6, knock:0, fx:'blast', rng:1, fall:1 },
  // ---- VIP ----
  railgun: { name:'PHÁO ĐIỆN TỪ',     svg:'rail', tier:3, type:'AP', dmg:150, fireCd:0.85, mag:5, reload:3.0, bspeed:160,frags:1, spread:0.0,  color:0xd0a0ff, r:0.55, life:1.4, pierce:6, recoil:3.0, knock:3.2, fx:'pierce', flash:'rail', rng:1.5, fall:1 },
  rocket:  { name:'TÊN LỬA CÔNG THÀNH', svg:'rocket', tier:3, type:'HE', dmg:0, fireCd:5.0, mag:10, reload:30, bspeed:0, frags:1, spread:0, color:0xff4533, r:0.6, life:0, special:'rocket', aoeR:15, bossDmg:360, recoil:2.0, knock:0, fx:'blast', rng:1, fall:1 },  // lobbed, 2s fuse, wipes a big radius
};
// Z149 what the blast adds on top of a direct hit (0 for guns without a contact blast; mortar-type shells hit by area only)
export function gunSplash(g){ return g && g.aoe && !g.special ? (g.splash??0.8) : 0; }
// one trigger pull on a single target the round strikes: pellets × damage, plus its blast
export function gunShotDmg(g){ return (g.dmg||0)*(g.frags||1)*(1+gunSplash(g)); }
