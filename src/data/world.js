// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
   // ARMS DOCTRINE: each gun has its own reach; night shortens it
// Battlefields — bg/fog/ground/grid/accent/sky + fog density + sun + scatter-deco theme + perimeter-wall tint.
// Indices 0-4 = the campaign (one per stage S1-S5). MEADOW (5) is a bonus terrain only via the picker.
export const BIOMES = [
  { name:'DESERT',  bg:0x1c160c, fog:0x2a2112, ground:0xb89a5e, grid:0x8a6f3c, accent:0xe7b54a, sky:0x3a3320, fogD:0.0075, sun:0xfff0d0, deco:'rock',   wall:0x6b5a36 },
  { name:'RUINS',   bg:0x14161a, fog:0x20242a, ground:0x6e7178, grid:0x474b52, accent:0xd0d6dc, sky:0x2a2e36, fogD:0.0090, sun:0xdfe6ee, deco:'rubble', wall:0x55585e },
  { name:'TUNDRA',  bg:0x121c24, fog:0x1c2e3a, ground:0xaecbe0, grid:0x6f93ad, accent:0x9fe0ff, sky:0x2a4055, fogD:0.0100, sun:0xeaf6ff, deco:'ice',    wall:0x6f8597 },
  { name:'FOUNDRY', bg:0x18100c, fog:0x241410, ground:0x6e6862, grid:0x6e4030, accent:0xff6a3a, sky:0x301812, fogD:0.0110, sun:0xffcaa0, deco:'slag',   wall:0x4a3a32 },
  { name:'CITADEL', bg:0x140d06, fog:0x231406, ground:0x9a8668, grid:0x7a5420, accent:0xffae5c, sky:0x2a1c0a, fogD:0.0120, sun:0xffd9a0, deco:'rubble', wall:0x6a5424 },
  { name:'MEADOW',  bg:0x0e150b, fog:0x1a2613, ground:0x5f7d3a, grid:0x46602a, accent:0x9be25a, sky:0x35451f, fogD:0.0072, sun:0xeaffcf, deco:'grass',  wall:0x4a5a30 },
];
// per-battlefield atmosphere: sky dome (→ environment reflections), sun angle/colour/strength, haze, grade
export const ATMOS = {
  DESERT: { top:0x5b84b8, hor:0xc9b48c, fog:0xb6a07a, fogD:0.0048, sun:0xfff1d6, sunI:3.1, el:0.98, az:0.62, hemiG:0x8a6c44, lift:[0.0,0.008,0.022], gain:[1.04,1.0,0.92], sat:0.9,  con:1.1  },
  RUINS:  { top:0x76808a, hor:0x9a9e9f, fog:0x7c8186, fogD:0.0065, sun:0xe8eef4, sunI:2.1, el:0.82, az:0.4,  hemiG:0x4a4c4e, lift:[0.006,0.012,0.022], gain:[0.98,1.0,1.03], sat:0.76, con:1.1  },
  TUNDRA: { top:0x8fb0cc, hor:0xd0dce4, fog:0xb4c4d0, fogD:0.006, sun:0xf2f6ff, sunI:2.5, el:0.5,  az:0.9,  hemiG:0x9aaab8, lift:[0.0,0.01,0.03],   gain:[0.96,1.0,1.06], sat:0.84, con:1.06 },
  FOUNDRY:{ top:0x6a7684, hor:0xa8a296, fog:0x938c80, fogD:0.0058, sun:0xffe6cc, sunI:2.6, el:0.7,  az:0.3,  hemiG:0x56504a, lift:[0.004,0.004,0.006], gain:[1.02,1.0,0.97], sat:0.84, con:1.05 },   // Z97 industrial overcast haze (was a red-brown murk)
  CITADEL:{ top:0x5476a6, hor:0xd9bc98, fog:0xbca88e, fogD:0.0055, sun:0xffe2bc, sunI:2.8, el:0.62, az:1.15, hemiG:0x6e5c46, lift:[0.004,0.004,0.008], gain:[1.03,1.0,0.95], sat:0.9,  con:1.05 },   // Z97 sunlit sandstone fortress (was a dark red dusk)
  MEADOW: { top:0x6596cc, hor:0xc4d0c0, fog:0xa9b8b0, fogD:0.0042, sun:0xfff6e0, sunI:2.9, el:1.0,  az:0.7,  hemiG:0x4a5a30, lift:[0.0,0.01,0.02],   gain:[1.0,1.02,0.95], sat:0.95, con:1.08 },
};
// ---- TIME OF DAY: each stage fights at a different hour — morning · harsh noon · golden sunset · moonlit night under electric floodlights ----
export const TOD_ORDER = ['day','noon','sunset','night','night'];
export const GROUND_STYLE = {   // c0 dark · c1 mid · c2 light (sRGB), roughness, normal strength, detail tile size (world units)
  DESERT: { c:[[132,104,66],[188,156,108],[222,196,150]], rough:0.96, nrm:2.6, tile:22 },
  RUINS:  { c:[[70,70,70],[112,110,104],[150,146,138]],   rough:0.92, nrm:3.0, tile:20 },
  TUNDRA: { c:[[150,166,182],[206,220,232],[244,248,252]],rough:0.72, nrm:1.8, tile:24 },
  FOUNDRY:{ c:[[66,62,58],[104,98,90],[146,138,126]],      rough:0.9,  nrm:3.2, tile:18 },   // ash & clinker grey (was near-black)
  CITADEL:{ c:[[104,90,70],[150,132,104],[192,172,140]],   rough:0.95, nrm:2.8, tile:20 },   // weathered sandstone dust
  MEADOW: { c:[[58,72,34],[88,112,52],[126,148,74]],       rough:0.95, nrm:2.4, tile:20 },
};
export const TERRAIN_STYLE = { DESERT:{mounds:13, mh:1.6, craters:6, cd:1.0, noise:0.22}, RUINS:{mounds:6, mh:0.9, craters:12, cd:1.2, noise:0.12}, TUNDRA:{mounds:11, mh:1.3, craters:5, cd:0.8, noise:0.18},
  FOUNDRY:{mounds:7, mh:1.1, craters:9, cd:1.1, noise:0.14}, CITADEL:{mounds:8, mh:1.2, craters:13, cd:1.3, noise:0.12}, MEADOW:{mounds:12, mh:1.4, craters:7, cd:0.9, noise:0.16} };
export const COVER_HP = { sandbag:85, drums:22, tires:95, crates:55 };
export const BRICK_PAL={ DESERT:[0xb7825a,0xc79a6c,0xa86e4a,0xd1ab7e], RUINS:[0x9c5a40,0xae6a4c,0x8a4c36,0xb87c5c], TUNDRA:[0x8a7a6c,0x9a8a7a,0x766a5e,0xa89a8a],
  FOUNDRY:[0x7a3e2c,0x8a4a34,0x5e3024,0x96583e], CITADEL:[0xa09684,0xb0a692,0x8c8272,0xbcb2a0], MEADOW:[0xa4583c,0xb46848,0x924a32,0xc07a58] };
