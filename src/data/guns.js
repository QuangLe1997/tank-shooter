// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.

// ===== GUNS =====
// Stat model: dmg (per fragment) · fireCd (s/shot) · mag (rounds) · reload (s)
// · frags (pellets/shot, 1 ammo) · spread · bspeed · weight (mag→move penalty).
// Tiers: 1 dễ kiếm/cân bằng → 3 mạnh/khan hiếm. Player chỉ bắt đầu với 'rifle'.
export const GUNS = {   // ARMS DOCTRINE (Z75): type = damage class (config DMG_TYPE) · rng = reach × combat range · fall = damage left at full reach
  rifle:   { name:'RIFLE', svg:'rifle', tier:1, type:'KIN', dmg:14, fireCd:0.2, mag:24, reload:1.9, bspeed:68, frags:1, spread:0.03, color:0xaef0a0, r:0.42, life:2.0, recoil:0.9, knock:1.0, fx:'spark', rng:1.0, fall:0.7 },
  smg:     { name:'SMG',   svg:'smg', tier:1, type:'KIN', dmg:8,  fireCd:0.07,mag:50, reload:2.4, bspeed:74, frags:1, spread:0.08, color:0xfff0a0, r:0.34, life:1.7, recoil:0.3, knock:0.6, fx:'spark', rng:0.8, fall:0.5 },
  shotgun: { name:'SHOTGUN',    svg:'shotgun', tier:2, type:'FRAG', dmg:9,  fireCd:0.6, mag:6,  reload:2.4, bspeed:58, frags:8, spread:0.55, color:0xff8a38, r:0.36, life:0.7, recoil:2.4, knock:1.9, fx:'frag', rng:0.6, fall:0.25 },
  flak:    { name:'FLAK',   svg:'flak', tier:2, type:'HE', dmg:10, fireCd:0.55, mag:10, reload:2.8, bspeed:54, frags:5, spread:0.34, color:0x8fc8ff, r:0.5,  life:0.9, aoe:3.2, recoil:1.4, knock:1.2, fx:'frag', rng:0.9, fall:0.75 },
  cannon:  { name:'CANNON',  svg:'shell', tier:2, type:'AP', dmg:60, fireCd:0.9,  mag:5,  reload:3.2, bspeed:70, frags:1, spread:0.01, color:0xffb83a, r:0.55, life:2.0, aoe:2.4, pierce:1, recoil:3.6, knock:2.6, fx:'blast', rng:1.2, fall:1 },
  hesh:    { name:'HESH 105', svg:'shell', tier:2, type:'HESH', dmg:44, fireCd:0.8, mag:6, reload:3.0, bspeed:60, frags:1, spread:0.02, color:0xe0b080, r:0.55, life:2.0, aoe:2.8, recoil:3.0, knock:2.2, fx:'blast', rng:1.05, fall:0.9 },   // NEW: bunker-buster
  minigun: { name:'MINIGUN',    svg:'minigun', tier:3, type:'KIN', dmg:9,  fireCd:0.05, mag:100, reload:4.2, bspeed:76, frags:1, spread:0.12, color:0xfff4e0, r:0.34, life:1.8, recoil:0.25, knock:0.5, fx:'spark', rng:0.9, fall:0.6, spinUp:0.7 },   // must spin up
  missile: { name:'MISSILE',     svg:'missile', tier:3, type:'HE', dmg:34, fireCd:0.55, mag:8,  reload:3.2, bspeed:95, frags:1, spread:0.05, color:0xff6a28, r:0.5,  life:3.2, homing:9, lock:true, aoe:3.4, recoil:1.4, knock:2.0, fx:'blast', rng:1.3, fall:1 },
  railgun: { name:'RAILGUN',     svg:'rail', tier:3, type:'AP', dmg:95, fireCd:0.9,  mag:5,  reload:3.4, bspeed:140,frags:1, spread:0.0,  color:0xd0a0ff, r:0.55, life:1.5, pierce:6, recoil:3.0, knock:3.2, fx:'pierce', rng:1.5, fall:1 },
  cryo:    { name:'CRYO',  svg:'snow', tier:2, type:'CRYO', dmg:11, fireCd:0.3, mag:18, reload:2.6, bspeed:60, frags:1, spread:0.05, color:0x9fe8ff, r:0.42, life:1.8, freeze:2.0, recoil:0.9, knock:0.8, fx:'ice', rng:0.85, fall:0.8 },          // control: freezes (half on heavy armour)
  tesla:   { name:'TESLA', svg:'bolt', tier:3, type:'ELEC', dmg:22, fireCd:0.38, mag:14, reload:2.8, bspeed:92, frags:1, spread:0.04, color:0x5aa0ff, r:0.4,  life:1.4, chain:3, chainR:9, recoil:0.5, knock:0.7, fx:'shock', rng:0.8, fall:0.8 },    // chain lightning
  rocket:  { name:'SIEGE ROCKET', svg:'rocket', tier:3, type:'HE', dmg:0, fireCd:5.0, mag:10, reload:30, bspeed:0, frags:1, spread:0, color:0xff4533, r:0.6, life:0, special:'rocket', aoeR:15, bossDmg:360, recoil:2.0, knock:0, fx:'blast', rng:1, fall:1 },  // lobbed, 2s fuse, wipes a big radius
  arty:    { name:'HOWITZER', svg:'target', tier:3, type:'HE', dmg:40, fireCd:1.05, mag:5, reload:3.6, bspeed:0, frags:1, spread:0, color:0xffd24a, r:0.6, life:0, special:'mortar', aoeR:6.0, bossDmg:90, recoil:1.6, knock:0, fx:'blast', rng:1, fall:1 },
  mortar:  { name:'ARC MORTAR', svg:'target', tier:2, type:'HE', dmg:30, fireCd:0.85, mag:6, reload:3.4, bspeed:0, frags:1, spread:0, color:0xffc24a, r:0.5, life:0, special:'mortar', aoeR:5.0, bossDmg:60, recoil:1.1, knock:0, fx:'blast', rng:1, fall:1 },
  agl:     { name:'AGL-40', svg:'agl', tier:2, type:'HE', dmg:16, fireCd:0.26, mag:16, reload:3.0, bspeed:0, frags:1, spread:0, color:0xc8e070, r:0.4, life:0, special:'mortar', small:true, aoeR:2.9, bossDmg:12, recoil:0.5, knock:0, fx:'blast', rng:1, fall:1 },   // Z81 40 mm automatic grenade launcher — lobs a stream of small HE grenades onto the cursor: infantry & clustered light armour
  thermo:  { name:'THERMOBARIC', svg:'thermo', tier:3, type:'TBX', dmg:70, fireCd:1.6, mag:3, reload:4.4, bspeed:46, frags:1, spread:0.01, color:0xff9a3a, r:0.6, life:2.4, aoe:6.5, recoil:2.4, knock:2.4, fx:'blast', rng:1.1, fall:1 },   // Z81 fuel-air rocket: huge blast + burns everything in it; levels cover & towers
  flamer:  { name:'PYRO', svg:'burst', tier:2, type:'FIRE', dmg:1, fireCd:0.05, mag:140, reload:3.2, bspeed:0, frags:1, spread:0, color:0xff6a1c, r:0, life:0, special:'flame', range:20, recoil:0.12, knock:0, fx:'spark', rng:1, fall:1 },
};
