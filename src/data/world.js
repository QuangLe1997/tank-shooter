// data/world.js — TIME OF DAY: each stage fights at a different hour — morning · harsh noon · golden sunset · moonlit night under electric floodlights
   // ARMS DOCTRINE: each gun has its own reach; night shortens it
// Battlefields — bg/fog/ground/grid/accent/sky + fog density + sun + scatter-deco theme + perimeter-wall tint.
// Indices 0-4 = the campaign (one per stage S1-S5). MEADOW (5) is a bonus terrain only via the picker.
// Z253 ten battlefields: VILLAGE, HILLS, STEELMILL and the CAVERN retired, TUNDRA merged into ARCTIC (their tables / code stay, unused)
export const BIOMES = [
  { name:'DESERT',  bg:0x1c160c, fog:0x2a2112, ground:0xb89a5e, grid:0x8a6f3c, accent:0xe7b54a, sky:0x3a3320, fogD:0.0075, sun:0xfff0d0, deco:'rock',   wall:0x6b5a36 },
  { name:'RUINS',   bg:0x14161a, fog:0x20242a, ground:0x6e7178, grid:0x474b52, accent:0xd0d6dc, sky:0x2a2e36, fogD:0.0090, sun:0xdfe6ee, deco:'rubble', wall:0x55585e },
  { name:'ARCTIC',  bg:0x101820, fog:0x1c2a36, ground:0xe4eef4, grid:0x9ab4c8, accent:0x9fe8ff, sky:0x2a4058, fogD:0.0070, sun:0xf4f8ff, deco:'ice',    wall:0x8aa0b0 },   // Z253 the one ice battlefield (TUNDRA merged in): campaign stage 3
  { name:'FOUNDRY', bg:0x18100c, fog:0x241410, ground:0x6e6862, grid:0x6e4030, accent:0xff6a3a, sky:0x301812, fogD:0.0110, sun:0xffcaa0, deco:'slag',   wall:0x4a3a32 },
  { name:'CITADEL', bg:0x140d06, fog:0x231406, ground:0x9a8668, grid:0x7a5420, accent:0xffae5c, sky:0x2a1c0a, fogD:0.0120, sun:0xffd9a0, deco:'rubble', wall:0x6a5424 },
  { name:'MEADOW',  bg:0x0e150b, fog:0x1a2613, ground:0x8aa64e, grid:0x46602a, accent:0x9be25a, sky:0x35451f, fogD:0.0072, sun:0xeaffcf, deco:'grass',  wall:0x4a5a30 },
  // Z139 a city of buildings (picker / custom battle only)
  { name:'CITY',    bg:0x13161b, fog:0x1f242b, ground:0x5b5f66, grid:0x3e434b, accent:0xffc84a, sky:0x2a313c, fogD:0.0085, sun:0xeaf0f8, deco:'rubble', wall:0x4a4e56 },
  // Z143 dry-season African savanna (golden grass, reeds, baobabs, acacias, herds)
  { name:'SAVANNA', bg:0x1a140a, fog:0x2a2112, ground:0xb89a58, grid:0x8a6a34, accent:0xffc45a, sky:0x3a3020, fogD:0.0062, sun:0xfff0c8, deco:'grass',  wall:0x7a5a34 },
  // Z187 a volcanic caldera valley and a vast centuries-old marble quarry (picker / custom battle only)
  { name:'VOLCANO',   bg:0x120806, fog:0x2a120a, ground:0x3a3230, grid:0x5a1e10, accent:0xff5a1a, sky:0x2a120c, fogD:0.0075, sun:0xffb080, deco:'rock',  wall:0x2e2624 },
  { name:'QUARRY',    bg:0x1a1a18, fog:0x2c2c28, ground:0xd8d2c4, grid:0xa8a090, accent:0xfff0c8, sky:0x3a3a34, fogD:0.0062, sun:0xfff8ec, deco:'rock',  wall:0x9a948a },
];
// per-battlefield atmosphere: sky dome (→ environment reflections), sun angle/colour/strength, haze, grade
export const ATMOS = {
  DESERT: { top:0x3d74b4, hor:0xc9b48c, fog:0xb6a07a, fogD:0.0042, sun:0xfff1d6, sunI:3.1, el:0.98, az:0.62, hemiG:0x8a6c44, lift:[0.0,0.008,0.022], gain:[1.02,1.0,0.95], sat:0.9,  con:1.16, exp:0.96, sh:[-0.035,-0.005,0.045], hi:[0.025,0.008,-0.018], vib:0.3 },
  RUINS:  { top:0x76808a, hor:0x9a9e9f, fog:0x7c8186, fogD:0.0065, sun:0xe8eef4, sunI:2.1, el:0.82, az:0.4,  hemiG:0x4a4c4e, lift:[0.006,0.012,0.022], gain:[0.98,1.0,1.03], sat:0.74, con:1.16, exp:1.02, sh:[-0.02,0.0,0.03], hi:[0.03,0.012,-0.01], vib:0.15 },
  TUNDRA: { top:0x8fb0cc, hor:0xd0dce4, fog:0xb4c4d0, fogD:0.006, sun:0xf2f6ff, sunI:2.5, el:0.5,  az:0.9,  hemiG:0x8494a6, lift:[0.0,0.01,0.03],   gain:[0.96,1.0,1.06], sat:0.84, con:1.12, exp:0.84, sh:[-0.025,0.0,0.045], hi:[0.03,0.015,0.0], vib:0.2 },
  FOUNDRY:{ top:0x6a7684, hor:0xa8a296, fog:0x8a8274, fogD:0.0058, sun:0xffe6cc, sunI:2.6, el:0.7,  az:0.3,  hemiG:0x56504a, lift:[0.004,0.004,0.006], gain:[1.02,1.0,0.97], sat:0.9, con:1.15, exp:1.0, sh:[-0.025,0.006,0.03], hi:[0.045,0.016,-0.025], vib:0.25 },   // Z97 industrial overcast haze (was a red-brown murk)
  CITADEL:{ top:0x5476a6, hor:0xd9bc98, fog:0xbca88e, fogD:0.0055, sun:0xffe2bc, sunI:2.8, el:0.62, az:1.15, hemiG:0x6e5c46, lift:[0.004,0.004,0.008], gain:[1.03,1.0,0.95], sat:0.94,  con:1.14, exp:0.98, sh:[-0.03,0.0,0.035], hi:[0.04,0.016,-0.03], vib:0.28 },   // Z97 sunlit sandstone fortress (was a dark red dusk)
  MEADOW: { top:0x6596cc, hor:0xc4d0c0, fog:0xa9b8b0, fogD:0.0036, sun:0xfff6e0, sunI:2.9, el:1.0,  az:0.7,  hemiG:0x4a5a30, lift:[0.0,0.01,0.02],   gain:[1.01,0.99,0.98], sat:0.9, con:1.18, exp:0.93, sh:[-0.02,0.006,0.035], hi:[0.012,0.018,-0.012], vib:0.12 },   // Z287 spring pasture: green-gold light, a touch more life
  CITY:   { top:0x6f87a6, hor:0xb4b8bc, fog:0x8c9096, fogD:0.0040, sun:0xf0f3f8, sunI:2.4, el:0.8,  az:0.5,  hemiG:0x4e5258, lift:[0.004,0.008,0.016], gain:[0.99,1.0,1.03], sat:0.86,  con:1.17, exp:0.98, sh:[-0.03,0.008,0.04], hi:[0.045,0.016,-0.03], vib:0.3 },
  HILLS:  { top:0x5c93cf, hor:0xcfd8c4, fog:0xaebfb0, fogD:0.0036, sun:0xfff3d8, sunI:3.0, el:0.85, az:0.9,  hemiG:0x4f5f34, lift:[0.0,0.01,0.02],   gain:[1.01,0.99,0.98], sat:0.86, con:1.16, exp:0.93, sh:[-0.03,0.004,0.055], hi:[0.012,0.01,0.01], vib:0.06 },   // Z287 highland air: cooler, bluer shadows, a little mist
  VILLAGE:{ top:0x6aa0d4, hor:0xd0dccc, fog:0xb4c8b8, fogD:0.0036, sun:0xfff6e2, sunI:2.9, el:1.0,  az:0.6,  hemiG:0x56703a, lift:[0.0,0.012,0.02],  gain:[1.01,0.99,0.98], sat:0.92, con:1.17, exp:0.93, sh:[-0.02,0.0,0.03], hi:[0.035,0.016,-0.022], vib:0.1 },   // Z287 the village in late sun: warm, golden
  SAVANNA:{ top:0x5a8ec4, hor:0xe0c89a, fog:0xc8b088, fogD:0.0036, sun:0xfff0cc, sunI:3.2, el:0.9,  az:0.7,  hemiG:0x8a6c40, lift:[0.01,0.006,0.0],  gain:[1.06,1.0,0.9],  sat:0.96, con:1.16, exp:0.97, sh:[-0.03,0.0,0.035], hi:[0.045,0.016,-0.035], vib:0.3 },
  ARCTIC: { top:0x7aa8d8, hor:0xdce8f2, fog:0xa9bccd, fogD:0.0048, sun:0xf8fbff, sunI:2.6, el:0.32, az:1.0,  hemiG:0x7f93a8, lift:[0.0,0.01,0.03],   gain:[0.96,1.0,1.07], sat:0.9, con:1.18, exp:0.74, sh:[-0.03,0.0,0.06], hi:[0.035,0.016,-0.005], vib:0.25 },
  STEELMILL:{ top:0x6a6e74, hor:0xb09a86, fog:0x8a7c70, fogD:0.0056, sun:0xffe0c0, sunI:2.5, el:0.62, az:0.45, hemiG:0x4a3e36, lift:[0.006,0.004,0.002], gain:[1.04,0.99,0.94], sat:0.86, con:1.15, exp:1.0, sh:[-0.03,0.008,0.03], hi:[0.05,0.016,-0.03], vib:0.25 },   // Z187 rust haze over dead furnaces
  VOLCANO:  { top:0x54424c, hor:0xc0745a, fog:0x6a3e34, fogD:0.0055, sun:0xffc8a0, sunI:2.6, el:0.55, az:0.8,  hemiG:0x3a2420, lift:[0.012,0.004,0.0], gain:[1.08,0.96,0.88], sat:0.98, con:1.17, exp:1.0, sh:[-0.01,-0.012,0.035], hi:[0.05,0.012,-0.035], vib:0.2 },          // ash-red sky, lava glow from below
  CAVERN:   { top:0x0a0a10, hor:0x141218, fog:0x14131a, fogD:0.0052, sun:0xa8c4f0, sunI:0.32, el:1.38, az:0.5, hemiG:0x1a140c, lift:[0.012,0.01,0.018], gain:[1.05,1.0,0.92], sat:0.98, con:1.12, exp:1.15, sh:[-0.02,0.004,0.04], hi:[0.07,0.03,-0.03], vib:0.32, cave:1 },   // Z225 black rock, warm torchlight, cool shafts
  QUARRY:   { top:0x6e9ccc, hor:0xd8cfbe, fog:0xc4b8a4, fogD:0.0042, sun:0xfff2dc, sunI:2.7, el:0.85, az:0.6,  hemiG:0x9a907e, lift:[0.008,0.004,0.0], gain:[1.03,1.0,0.94], sat:0.92, con:1.14, exp:0.92, sh:[-0.025,0.0,0.04], hi:[0.04,0.016,-0.02], vib:0.25 },           // white stone glare under a clear sky
};
// ---- TIME OF DAY: each stage fights at a different hour — morning · harsh noon · golden sunset · moonlit night under electric floodlights ----
export const TOD_ORDER = ['day','noon','sunset','night','night'];
export const GROUND_STYLE = {   // c0 dark · c1 mid · c2 light (sRGB), roughness, normal strength, detail tile size (world units)
  DESERT: { c:[[132,104,66],[188,156,108],[222,196,150]], rough:0.96, nrm:2.6, tile:22 },
  RUINS:  { c:[[70,70,70],[112,110,104],[150,146,138]],   rough:0.92, nrm:3.0, tile:20 },
  TUNDRA: { c:[[150,166,182],[206,220,232],[244,248,252]],rough:0.72, nrm:1.8, tile:24 },
  FOUNDRY:{ c:[[66,62,58],[104,98,90],[146,138,126]],      rough:0.9,  nrm:3.2, tile:18 },   // ash & clinker grey (was near-black)
  CITADEL:{ c:[[104,90,70],[150,132,104],[192,172,140]],   rough:0.95, nrm:2.8, tile:20 },   // weathered sandstone dust
  // Z147 green fields: sunlit pasture, well clear of the tanks' olive drab · Z235 a natural grass green (was a yellow, glaring lime) — buildings stand off it, not lost in it
  MEADOW: { c:[[52,80,42],[84,114,62],[120,138,88]],       rough:0.95, nrm:2.4, tile:20 },   // Z242 muted pasture · Z244 a true leaf green, not chartreuse (less red)
  CITY:   { c:[[62,64,68],[96,98,102],[136,138,142]],       rough:0.9,  nrm:2.8, tile:20 },
  HILLS:  { c:[[56,80,46],[90,114,70],[128,142,100]],        rough:0.95, nrm:2.6, tile:22 },   // Z242
  VILLAGE:{ c:[[54,84,42],[86,118,62],[122,142,90]],       rough:0.95, nrm:2.2, tile:20 },   // Z242
  SAVANNA:{ c:[[140,104,58],[190,156,92],[222,196,130]],    rough:0.96, nrm:2.4, tile:22 },
  ARCTIC: { c:[[176,196,214],[224,234,242],[250,252,255]],  rough:0.6,  nrm:1.6, tile:26 },
  STEELMILL:{ c:[[58,46,38],[104,84,68],[150,124,100]],   rough:0.85, nrm:3.0, tile:18 },
  VOLCANO:{ c:[[24,22,22],[58,52,50],[96,86,80]],         rough:0.9,  nrm:3.4, tile:20 },
  CAVERN: { c:[[46,40,36],[86,76,66],[128,116,100]],      rough:0.9,  nrm:3.4, tile:18 },   // Z225 wet limestone mud, flowstone
  QUARRY: { c:[[150,140,124],[190,180,162],[222,214,198]], rough:0.85, nrm:2.8, tile:22 },   // warm grey-cream marble dust (not snow)
};
export const TERRAIN_STYLE = { DESERT:{mounds:13, mh:1.6, craters:6, cd:1.0, noise:0.22}, RUINS:{mounds:6, mh:0.9, craters:12, cd:1.2, noise:0.12}, TUNDRA:{mounds:11, mh:1.3, craters:5, cd:0.8, noise:0.18},
  FOUNDRY:{mounds:7, mh:1.1, craters:9, cd:1.1, noise:0.14}, CITADEL:{mounds:8, mh:1.2, craters:13, cd:1.3, noise:0.12}, MEADOW:{mounds:12, mh:1.4, craters:7, cd:0.9, noise:0.16},
  CITY:{mounds:2, mh:0.4, craters:8, cd:0.8, noise:0.06}, HILLS:{mounds:14, mh:2.4, craters:2, cd:0.8, noise:0.2}, VILLAGE:{mounds:6, mh:0.8, craters:3, cd:0.7, noise:0.1},
  SAVANNA:{mounds:7, mh:0.8, craters:3, cd:0.8, noise:0.12}, ARCTIC:{mounds:12, mh:1.4, craters:3, cd:0.7, noise:0.16},
  STEELMILL:{mounds:5, mh:0.9, craters:10, cd:1.1, noise:0.12}, VOLCANO:{mounds:14, mh:2.2, craters:9, cd:1.3, noise:0.24}, QUARRY:{mounds:9, mh:1.8, craters:4, cd:0.9, noise:0.14},
  CAVERN:{mounds:10, mh:1.5, craters:2, cd:0.7, noise:0.22} };
export const COVER_HP = { sandbag:85, drums:22, tires:95, crates:55,
  logs:110, concrete:260, pipes:200, hesco:220, jersey:170, teeth:240, container:320, wreck:140 };   // Z193 every piece of cover can be shot to pieces (concrete takes a lot)
// Z193 field cover is built at the same scale as the tanks (TANK_SCALE 1.2 + a little): a 3 m sandbag cell becomes ~3.9 m, a T-wall ~2.9 m tall
export const COVER_K = 1.3;
export const COVER_R = { jersey:1.45, teeth:1.85, logs:1.6 };   // collision radius per cell (before COVER_K; default 1.7)
export const HEAVY_KINDS = new Set(['concrete','pipes','hesco','jersey','teeth','container','wreck']);   // solid: rifle rounds only chip them, enemy shells wear them slowly
export const BRICK_PAL={ DESERT:[0xb7825a,0xc79a6c,0xa86e4a,0xd1ab7e], RUINS:[0x9c5a40,0xae6a4c,0x8a4c36,0xb87c5c], TUNDRA:[0x8a7a6c,0x9a8a7a,0x766a5e,0xa89a8a],
  FOUNDRY:[0x7a3e2c,0x8a4a34,0x5e3024,0x96583e], CITADEL:[0xa09684,0xb0a692,0x8c8272,0xbcb2a0], MEADOW:[0xa4583c,0xb46848,0x924a32,0xc07a58],
  CITY:[0x8f8a84,0xa19a92,0x7a746e,0xb0a89c], HILLS:[0x8a7a62,0x9a8a70,0x766a56,0xa89a80], VILLAGE:[0xb06a48,0xc27a54,0x9a5a3c,0xd08a62],
  SAVANNA:[0xa86a42,0xb87a4e,0x965a36,0xc48a5a], ARCTIC:[0x9aa8b4,0xaab6c2,0x8a98a6,0xbac4ce],
  STEELMILL:[0x7a3a26,0x8a4630,0x5e2c1e,0x9a5640], VOLCANO:[0x3a3432,0x4a4240,0x2c2826,0x5a504c], QUARRY:[0xd8d2c4,0xe6e0d4,0xc4bcae,0xf0ebe0],
  CAVERN:[0x7a7264,0x8a8272,0x665e52,0x968e7e] };
