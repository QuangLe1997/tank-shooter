// ============================================================================
// XUNG KÍCH — CONFIG / BALANCE  (single source of truth for tuning + economy data)
// Plain ES module: imported by index.html (browser) AND test.js (node, zero-deps).
// Edit numbers HERE — keep LEVELS.md in sync. No Three.js/DOM deps (pure data).
// ============================================================================

// ----- BALANCE: every tunable knob in one place -----
export const BALANCE = {
  // NG+ loop escalation: per-loop multipliers (loop 0 = first run)
  loop:   { hp:0.45, dmg:0.22, boss:0.55, reward:0.6 },
  // boss HP = def.hp × (1 + (stage-1)·stageRamp) × flat × loopBossMul
  boss:   { stageRamp:0.18, flat:0.9 },
  // loot spawn chance on bricks / enemies
  drop:   { brick:0.18, enemy:0.16 },
  // waves
  wave:   { base:3, perWave:1, perStage:1.5, perStageCount:5,
            capBase:5, capPerStage:1.5, cadence:1.15, cadenceDiff:0.4,
            eventChance:0.34, assaultCadenceMul:0.5, assaultCapBonus:4, hordeMul:0.5 },
  // elite enemies
  elite:  { chancePerStage:0.025, chancePerLoop:0.06, capChance:0.25,
            hpMul:2.6, sizeMul:1.0, dmgMul:1.3, scoreMul:3 },
  // gun MASTERY: each duplicate gun pickup = +1 xp; cross a threshold → that gun levels up (1→4, permanent).
  // Higher level = more damage, faster fire (lower fireCd), faster reload. Long grind: ~12/15/18 dups per level.
  aggro:{ fireChanceBase:0.55, fireChanceRamp:0.55, spreadBase:0.5, spreadDrop:0.82, leadFrom:0.3, rateBase:2.2, rateDrop:0.95, accurateMul:0.22, loopAcc:0.12 },
  // FLAMETHROWER burn (damage-over-time): DoT = dps × level × dt. Each spray-tick adds `add` to level (caps at lvlMax);
  // level also creeps up on its own (`grow`/s) so any fire "cháy càng ngày càng lớn". `duration` resets on every tick.
  // → a light touch burns slowly (~3s to kill a grunt) but eventually finishes weak foes; sustained spray ramps to max → melts fast.
  flame:{ dps:10, lvlMax:4, add:0.55, grow:0.2, duration:8, range:20, cone:0.7 },   // Z149 burn per level × your damage upgrades (it used to ignore them); burning fuel gutters out in 8 s
  // DIFFICULTY presets (player-chosen). Scale enemy HP/damage + reward payout. soldier = baseline (1.0); recruit
  // eases new players in; veteran ramps the threat AND the rewards. Multiplies on top of NG+ loop & contract mods.
  difficulty:{
    recruit:{ hp:0.65, dmg:0.6, reward:0.8 },
    soldier:{ hp:1.0,  dmg:1.0, reward:1.0 },
    veteran:{ hp:1.5,  dmg:1.4, reward:1.6 },
  },
};

// ============================================================================
// ARMS DOCTRINE (Z75) — why each gun exists and when it shines.
//   finalDamage = gun.dmg × DMG_TYPE[type][armor] × rangeFalloff × ENV(type) × (player mults: shop/mastery/roguelite/buffs/contract)
//   rangeFalloff = 1 inside 55% of the gun's reach, then linear down to gun.fall at full reach.
//   reach = playerRange() × gun.rng × (night ? ENV.night.range : 1)   (railgun/missile ignore night: thermal sight / lock-on)
// ============================================================================
// damage type × armour class (L = light: scout/bomber/gunner/infantry · M = medium: grunt/mortar/sniper/carrier · H = heavy: shield/heavy/boss · A = aircraft)
// `struct` = vs cover/towers (HESH is the dedicated bunker-buster; fire torches wooden towers but not sandbags/concrete).
export const DMG_TYPE = {
  KIN:  { L:1.15, M:1.00, H:0.55, A:1.10, struct:0.6, label:'KINETIC', vi:'ĐỘNG NĂNG' },      // autocannons / MGs / rotary — shreds light armour, bounces off heavy
  AP:   { L:0.85, M:1.10, H:1.45, A:0.70, struct:1.2, label:'ARMOR-PIERCING', vi:'XUYÊN GIÁP' },// sabot / rail slug — built to kill tanks; over-penetrates light targets
  HE:   { L:1.20, M:1.00, H:0.85, A:1.00, struct:1.5, label:'HIGH-EXPLOSIVE', vi:'NỔ MẠNH' },// blast + splinters — crowds, light vehicles, structures
  FRAG: { L:1.35, M:0.95, H:0.55, A:1.10, struct:0.7, label:'FRAGMENTATION', vi:'MẢNH' }, // canister / pellets — brutal close on soft targets
  FIRE: { L:1.30, M:1.00, H:0.75, A:0.40, struct:0.3, tower:1.6, label:'INCENDIARY', vi:'CHÁY' },
  ELEC: { L:1.00, M:1.10, H:1.00, A:1.25, struct:0.4, label:'ELECTRIC', vi:'ĐIỆN' },
};
export const ARMOR = { rifle:'L', rpg:'L', gunship:'A', heliBomb:'A', heliTroop:'A' };   // Z116 the rocket truck is soft-skinned   // A = aircraft (Z80): only direct fire / flak / missiles reach it
// ============================================================================
// BATTLEFIELD ROSTER v2 (Z79) — enemy infantry on foot. Squads join waves from W2; RPG teams from stage 2.
//   squads per wave = floor(base + wave·perWave + (stage−1)·perStage)   (S1W2 = 1 … S5W5 = 3)
//   a tank moving faster than crushSpeed (or dashing) runs a soldier over (+crushBonus score)
// ============================================================================
// Z173 SQUAD TACTICS — enemy squads: think rate · bound duration · bound length · how far round the flank they work (rad per bound, max) · wedge spacing ·
//   assault range · morale that breaks them · regroup time · suppression decay /s · covering-team fire-rate multiplier · A* node budget ·
//   our side: focus-target radius · order reach · flank offset
export const SQUAD_AI = { think:0.35, boundT:[3.2,4.6], boundStep:7, flankStep:0.25, flankMax:1.1, spacing:3, assaultR:12, breakMorale:0.3, rallyT:[6,9], suppDecay:0.3, suppressFireK:0.65, navBudget:6000, focusR:40, orderR:60, flankR:22 };
// Z220 FIELDCRAFT (both sides): no rounds into a wall — a man whose line is blocked edges out to a spot with a clear shot · frag grenades into men behind
//   cover or bunched up (everyone near a live grenade runs) · smoke screens to fall back or cross open ground under fire (fire through smoke goes wild)
//   Z238 a lock-on missile flies at most `range` m whatever the range upgrades (it used to reach nearly the whole screen late on) and only locks what
//   it can still reach; it never passes through a wall — it looks ahead (look = [min, max] m) and climbs to `clear` m over anything in its path,
//   then dives on the mark; a wall too close to climb over takes the hit (and the damage)
// Z223 REAL WAR — blast concussion, side-coloured tracers, brass, varied deaths, men of different build, surprises
// Z225 UNDERGROUND — the enemy TUNNEL NETWORK (địa đạo) dug under every battlefield (Z401 the CAVERN battlefield's builder is gone)
export const TUNNEL = { from:2, n:[3,4], hp:{ hatch:70, bunker:280 }, seeR:20, under:[4,8], hurtK:0.6, suppK:0.5, grabR:7, heal:0.25,
  ambush:{ first:[35,55], every:[30,48], r:[24,70], cap:90 }, score:{ seal:250, all:800, buried:60 } };
// Z226 the UNDERGROUND BASE under every battlefield, reached through the guarded MAIN TUNNEL GATE (electronic lock)
// Z234 HOME GROUND: every enemy installation (fortress, barracks camp, fuel/ammo/radar compound, the underground gate, bunkers, watchtowers)
//   stands well clear of OUR citadel — gap = open ground between our wall (wall: its radius, world/core-walls.js) and the edge of theirs,
//   wider than our guard cannons' reach past the wall (54 − 24 = 30 m); small posts (bunkers, towers) keep a shorter gap. spawn: the same from our spawn point.
export const HOME_GAP = { wall:24, gap:46, gapMobile:26, small:34, smallMobile:20, spawn:36, spawnMobile:24, minK:0.7, campMobileK:0.5 };   // campMobileK: on the small phone field the first barracks camp may relax to half the gap rather than not exist   // minK: when the field is too crowded to place a site, the gap relaxes step by step to this share, never below
export const UNDERBASE = { off:170, W:75, D:55, gate:{ portalW:15, lockHp:[380,80], turretHp:300, turretR:24, turretCd:[0.09,1.5], turretDmg:3, burst:8, guards:[5,1], tanks:[1,0.5] },   // Z403 gate MG turretR 36 → 24 m (a rifleman's reach) · Z429 gate.portalW: the bastion gate scan over the ramp (m across)
  hp:{ inf:520, veh:620, ammo:420, power:800 }, cut:{ inf:0.17, veh:0.17, ammo:0.1 }, spawn:{ squad:[20,26] }, lights:{ desk:8, mob:3, I:50, range:34 }, score:{ target:400, all:2000, lock:300 } };
// Z419 GUNFIRE THAT READS REAL (fx/gunfx.js): the muzzle flash is a shaped, bore-aligned flash (crossed petals along the barrel + a face-on star) that lives
//   1–2 frames, a muzzle brake throws its own side jets and smoke sideways; the light is a strobe, not a glow; machine-gun belts carry a tracer every
//   REAL.tracer.every rounds (thin, bright, short) and the ball rounds between are unseen; brass tumbles out and bounces; a bullet strike throws up what it hit
export const GUNFX = {
  flash:{ pool:28, poolMob:14, life:0.045, hot:2.6 },              // pooled flash instances (one draw call) · life s (always ≥ 1 rendered frame) · hot = HDR brightness ×
  light:{ decay:42 },                                              // a gun's muzzle light drops this much intensity per second (explosions keep the slow 12/s)
  tracer:{ core:0.2, halo:0.55, trail:0.5, mgCore:0.11, mgHalo:0.32, mgTrail:0.3, mgLife:0.6 },   // round width × (was 0.38), glow ×, trail-dot size × — MG / rifle tracers thinner still
  brass:{ pool:140, poolMob:48, life:1.15, bounce:0.32, grav:-24 },   // spent cases + the chips / clods / splinters a strike throws: real meshes, one pool recycled oldest-first · life s · ground restitution · gravity
  case:{ rifle:[0.13,0.045], mg:[0.2,0.06], auto:[0.36,0.11], shell:[0.62,0.26] },   // case [length, diameter] m (drawn ~2.5× real so it reads at battle distance)
  hit:{ chips:2, chipsMob:1, dust:0.55, splash:4 },                // a bullet strike: chips / sparks thrown, dust puff size, water-splash droplets (Z419 2, not 5: a handful of solid bits read as blocks — the dust and sparks carry it)
  mat:{ metal:['container','car','wreck','fueltank','tanker','drums','fueldrum','hedgehog','plates','parked','apc','tank','radar','pylon','motor','rocket'],   // what a struck block is made of
    wood:['crates','logs','tree','trunk','fence','tent','post','stacks'], sand:['sandbag','hesco'], stone:['keep','ruin','rock','fortcore','corewall','uwall','bunker','slab','landmark','teeth','mesa','karst'] },   // (else: a stone / steel / heavy block → stone, the rest → dirt)
};
// GUNFX 1 GUNFIRE OF BOTH SIDES, CINEMATIC BUT BELIEVABLE (fx/gunfx.js): every shooter goes through muzzleFX(cls) — a flash shaped by its class (row of the
//   flash atlas), the light it throws (one pooled point light near the camera + a warm splash on the ground at night), smoke heavier for the MG / cannon and a
//   hot barrel that smokes on after a burst; small-arms rounds are no longer a sphere + a sprite each: most fly unseen, every Nth is a TRACER drawn as one
//   motion-blurred streak (speed × shutter, ≥ minPx wide on screen, brighter coming at the camera) in ONE instanced draw; ours red-orange, theirs green;
//   a sniper's round leaves only a faint trace; an unseen round passing close by shows a faint shimmer; sparks and ricochets are streaks of the same pool
export const SHOTFX = { on:true,
  cls:{ rifle:{ row:0, f:[0.46, 0.3, 1], light:1.6, splash:3.2, smoke:0, heat:0.10 }, smg:{ row:2, f:[0.34, 0.24, 0.8], light:0.9, splash:2.2, smoke:0, heat:0.07 },
    supp:{ row:2, f:[0.14, 0.12, 0.35], light:0.25, splash:0, smoke:0, heat:0.05 }, mg:{ row:1, f:[0.9, 0.5, 0.95], light:2.4, splash:4.5, smoke:0.2, heat:0.12 },
    sniper:{ row:0, f:[0.75, 0.45, 1.1], light:2.6, splash:4.5, smoke:0.7, heat:0.3 }, shotgun:{ row:1, f:[0.7, 0.45, 0.95], light:2.2, splash:4, smoke:0.6, heat:0.25 },
    cannon:{ row:3, f:[1.6, 0.9, 0.85], light:3.4, splash:9, smoke:1.2, heat:0.4 }, aa:{ row:1, f:[1.0, 0.5, 0.95], light:2.6, splash:5, smoke:0.7, heat:0.12 } },   // row = the flash atlas row (0 rifle star + side ports, 1 MG blossom, 2 suppressed / SMG, 3 cannon) · f = flash [length m, width m, brightness] · light = point-light intensity · splash = ground glow m · smoke = per-shot puff × · heat = barrel heat per shot
  tracer:{ every:{ mg:4, smg:5, aa:2, def:4 }, ours:0xff6a2a, theirs:0x86ff4c, hot:3.4, toward:1.6, ignite:3, minPx:1.3, width:0.012, glow:3.4 },   // every Nth round of the class (rifle = REAL.tracer.every) · tints · HDR × · × brighter head-on · m before full burn · min screen px · core m · glow × the core
  streak:{ pool:220, poolMob:90, shutter:0.016, min:1.2, max:2.6 },   // instanced streaks · a short virtual shutter s · length clamp m (GUNFX 2 a dash, not a bar)
  trace:{ k:0.05, w:2, col:0xe8ecf0 },                          // a sniper / DMR round: a faint grey trace (× brightness, × width)
  shimmer:{ R:5, k:0.06, w:3, col:0xdfe6ec },                     // an unseen enemy round passing within R m of the camera: a faint streak
  rico:{ stone:0.12, metal:0.3, k:1.6, w:0.01, v:[38, 70], life:[0.1, 0.22] },   // a strike off stone / steel skips away as a bright streak this often
  spark:{ metal:5, stone:2, mob:0.5, k:2.6, w:0.005, v:[7, 16], life:[0.12, 0.3] },   // spark streaks off a strike
  splash:{ day:0.03, night:0.32, dusk:0.14, pool:24 },                // the ground glow under a muzzle by light (× brightness)
  light:{ R:26, Rday:12 },                                        // a shot nearer the camera than this m lights the scene (one shared light)
  barrel:{ n:6, th:0.35, max:1.6, decay:0.32, every:0.11, R:34 },   // hot barrels tracked · heat before it smokes · cap · heat lost /s · a wisp every s · only this near the camera
  marks:{ hold:45, fade:12 },                                     // a bullet pock / shell scar stays hold s, then fades out over fade s
};
export const REAL = {
  concuss:{ reach:2.2, t:[0.9,1.9], push:7 },                   // a blast's survivors within r*reach are thrown flat and dazed t s, shoved push m/s
  tracer:{ every:3, enemy:0x6dff4a, ally:0xff5a2a },             // every Nth round a tracer: theirs burn green, ours red-orange
  brass:{ R:44 },                                                // spent casings only near the player (cheap)  · Z419 now real brass meshes (GUNFX.brass)
  death:{ fwd:0.3, spin:0.22, crawl:0.16 }, crawl:{ t:[3.2,5.5], sp:0.42 },   // small-arms death: fall forward / spin down / crawl wounded, else back
  look:{ h:[0.93,1.07], w:[0.93,1.08], tint:[0.8,1.1] },         // no two men the same height, build or shade of kit
  shock:{ minScale:1.0 },                                        // blasts this big send a dust skirt racing out along the ground
  surprise:{ first:[60,85], every:[50,90], from:{ ambush:1, friendly:1, heli:2 }, w:{ ambush:1.1, friendly:0.6, heli:0.5 },
    ambush:{ r:[14,19], squads:[1,2] },
    friendly:{ shells:8, R:5, dmg:80, minFoes:4 } } };
// Z272 real aircraft (actors/real-air.js; Tripo): yaw turns the nose to +z, cutRotor = top share of the height whose blades are cut (ours spin) except
//   within hubR × width of the mast, rotorUp = where our rotor sits (× model height above its middle), keepAbove = cut everything below that share
//   (the paratrooper's own soldier), keep = the procedural parts that stay visible
export const REALAIR = { models:{ heli_attack:{ yaw:-1.5708, cutRotor:0.24, hubR:0.06, rotorUp:0.5 }, heli_swallow:{ yaw:0, cutRotor:0.24, hubR:0.06, rotorUp:0.5 },
  heli_bomber:{ yaw:-1.5708, cutRotor:0.24, hubR:0.06, rotorUp:0.5 }, air_uav:{ yaw:0, keep:['ring'], env:1.2 }, para_trooper:{ keepAbove:0.3, double:true } } };
// Z275 ruins of war (world/ruins3d.js; Tripo): size (w = footprint, h = height, m), sink = share of the height under ground (base plates), and each
//   battlefield's mix: n ruins of these keys; clearCore = metres kept clear beyond our base walls
export const REALRUIN = { clearCore:24, models:{ ruin_chapel:{ w:22, sink:0.04 },   // Z420 the chapel's model is now the Silent Ruins (a low walled ruin, Meshy community): the chapel never read as one
    ruin_wall:{ w:18, sink:0.03 }, ruin_block:{ w:16, sink:0.02 }, ruin_tower:{ h:14, sink:0.03 }, ruin_villa:{ w:15, sink:0.03 }, ruin_house:{ w:11, sink:0.02 } },   // Z357 a burnt-out two-storey house (Meshy community, CC0)
  biomes:{ RUINS:{ n:7, keys:['ruin_chapel','ruin_wall','ruin_tower','ruin_block','ruin_house'] }, CITADEL:{ n:4, keys:['ruin_wall','ruin_tower','ruin_chapel'] }, MEADOW:{ n:3, keys:['ruin_chapel','ruin_tower','ruin_villa','ruin_house'] },
    DESERT:{ n:3, keys:['ruin_wall','ruin_tower'] }, QUARRY:{ n:3, keys:['ruin_wall','ruin_block'] }, SAVANNA:{ n:3, keys:['ruin_tower','ruin_villa','ruin_house'] }, FOUNDRY:{ n:3, keys:['ruin_block','ruin_wall','ruin_house'] },
    ARCTIC:{ n:2, keys:['ruin_tower','ruin_wall'] }, VOLCANO:{ n:2, keys:['ruin_wall','ruin_tower'] } } };
// Z285 enemy outposts (world/outposts.js): sizes (w = length, h = height, m), tents per fort, the ring round the walls (m beyond R), the gate lane kept clear (rad), wire rows and distance, solid pieces
export const OUTPOST = { radarSpin:{ at:0.72, rate:1.1 }, size:{ base_barracks:{ w:16 }, base_tent:{ w:7 }, base_radar:{ h:9 }, base_bunker:{ w:7 }, base_wire:{ w:6 }, mil_truck:{ w:8 }, mil_apc:{ w:7.6 }, mil_jeep:{ w:4.3 }, mil_humvee:{ w:4.9 } }, veh:['mil_truck','mil_apc','mil_jeep','mil_humvee'], nVeh:2, tents:2, ring:[10, 22], laneA:0.5, wireRows:2, wireAt:9, solid:['base_barracks','base_bunker','base_radar','mil_truck','mil_apc','mil_jeep','mil_humvee'] };
// Z292 PHONE LOD: phones load the light copies under …/m/ (trees ~3k triangles with their leaf cards thinned, fort pieces 2.5–3.5k, the city's
//   buildings halved) and keep the block skyline — measured on the emulated phone: 5.0M → 2.5M triangles a frame on the meadow and savanna
export const PHONE_LOD = { on:true, trees:true, forts:true, city:['bld_office','bld_glass','bld_hotel','bld_apart','bld_shophouse','bld_shoprow2','bld_villa'] };
// Z286 real wildlife (actors/wildlife.js; Tripo, rigged + walk cycle): height (m) per species, turn fix (rad), walk-cycle speed limits, off on phones
export const REALWILD = { h:{ deer:2.1, zebra:2.0, giraffe:5.0, elephant:3.3, reindeer:2.4, bear:1.5 }, yaw:{}, cycle:[0.7, 2.6], mobile:false };
// Z284 real wonders (world/wonders.js dressWonder; Tripo): which battlefield's landmark becomes which model, its size against the procedural one, turn, sink
export const REALWONDER = { windmill:{ key:'wonder_windmill', h:30, sink:0.02, yaw:-Math.PI / 2 },   // Z410 MEADOW's three windmills as the Tripo model (h m tall to its top sail; its sails face +X → yaw)
  biomes:{ CITADEL:'wonder_taj', RUINS:'wonder_colosseum', SAVANNA:'wonder_djenne', FOUNDRY:'wonder_volklingen', DESERT:'wonder_giza', QUARRY:'wonder_quarry' },
  fit:{ wonder_taj:1.0, wonder_colosseum:1.0, wonder_djenne:1.0, wonder_volklingen:1.0, wonder_giza:1.6, wonder_quarry:1.0 }, yaw:{}, sink:0.02, sinkK:{ wonder_giza:0.12 }, clear:28,   // Z434 clear = m between the fence and the landmark's nearest edge (it stands wholly outside the field, never over a fort), sinkK = how deep a scan's own rough plinth goes under the sand
  // Z426 the desert pyramids and the marble quarry's terraces as models too; multi = a landmark of several pieces (world/wonders.js dressMulti): one model at each
  //   [x, z, size m, 'w' width | 'h' height] in the drawn landmark's frame, scan pieces beside them (k, x, z, h) — the polar village's igloos and its lighthouse
  multi:{ ARCTIC:{ key:'wonder_igloo', at:[[0, 0, 11, 'w'], [12, 6, 8.8, 'w'], [-11, 8, 9.7, 'w'], [4, -12, 7.9, 'w'], [-6, -9, 7, 'w']], scene:[{ k:'lighthouse', x:26, z:-6, h:32 }] } } };
// Z282 xe-ôm / xích-lô mode (game/xeom.js): driver seat [y, z] on the bike (m), where the player's soldier sits, the bike's lean in turns, livery (traffic livery index)
// Z296 THE DRIVER (actors/driver.js): his own rigged model per ride; where his body meets the machine, in the mount's units (m ÷ XEOM.k, +z ahead, +x his left):
//   hip = the saddle point · grip = [left, right] hands · peg = [left, right] feet · rear = the rear axle (wheelie pivot)
//   bend = how far his back leans to the bars · wheelie / gearFoot = what this machine can do · Z308 grip = the middle of each rubber grip (measured on
//   the model: the hands close round it, back of the hand up); sweep = how far (rad) the grips sweep back from straight across, so the knuckles follow the bar
// Z311 WHAT A RIDE RUNS INTO (game/ride-collide.js — a bike or a horse): trees, poles, parked cars, a stone knee-high or more (rock m radius), the city's
//   street furniture and every wire stop it — head-on it stops dead, a glancing blow slides it along, hard enough a bike goes down (RIDE.crash.v); the light
//   pieces (knock) go over at knockV m/s, a wire bay or coil is flattened at wireV (wireW m deep); each costs slow of its speed. A low thing (XEOM.air.low)
//   is only leapt in a wheelie (a horse jumps it: horse) — Z321 horse = the tallest thing a horse clears at a gallop (m), the speed it must be going (m/s), its spring
//   off the ground (m/s, least and most), its fall (m/s²), how much higher than its hooves at rest it can lift them (tuck m)
export const RIDE_HIT = { rock:0.45, knock:['prop_bin','prop_chair','prop_cafe','prop_barrier','city_stall'], knockV:3.5, wireV:5.5, wireW:0.7, slow:0.75,
  horse:{ h:1.6, v:6, vy:[3.6, 6.2], g:14, tuck:0.35 } };
// Z305 cloth masks fitted to a driver's face (by model), all as shares of h = Head bone → HeadTop_End, measured from the Head bone (u right, v up, f ahead):
//   cols / rows = the grid the face is read on · halfW = half-width (the cheek sides, where the face turns) · top = the edge over the nose bridge (his lower
//   eyelids are at v 0.32), dipping by dip under the eyes once noseW of the half-width out (an inverted V over the nose) · bottom = under the chin, rising
//   by rise at the sides · off = stand-off, pleat = pleat depth · ear = where his ear is (top of the root, lobe, front root, back edge: read off the model,
//   not searched for — his helmet band sticks out further than the ear) · helmet = nothing above this is skin (the loops stay under the rim) ·
//   loop = elastic radius, clear = how far it rides off the skin · made in the colour of his own shirt (read off his texture; color if it can't be read),
//   worn: fade = washed out toward grey, dust = the road's dust in it, sun = bleached along the top, grime = grubby edges, breath = the stain over the mouth,
//   specks / creases = how many stains / worn-in wrinkles · Z364 down = how far (head heights) it is pulled down under his chin to smoke
export const RIDE_MASK = { drv_xeom:{ cols:20, rows:12, halfW:0.33, top:0.3, noseW:0.4, dip:0.055, bottom:-0.06, rise:0.14, off:0.03, pleat:0.008,
  ear:{ top:0.285, lobe:0.13, front:0.01, back:-0.075 }, helmet:0.295, loop:0.007, clear:0.012, color:0x8fa88a, down:0.34,
  wear:{ fade:0.18, dust:0.16, sun:0.1, grime:0.45, breath:0.22, specks:10, creases:7 } } };
// Z358 the driver sits tall: bend = his forward lean to the bars (xe ôm 0.13 rad — a Cub is ridden upright — ba gác 0.2); straight = each link of his spine
//   laid on the trunk's line (k of the way), the upper back proud of it by chest; sway.max = the most the brakes / throttle throw his trunk (braced, not flung)
export const RIDE = { mask:RIDE_MASK, h:1.76, legK:1.07, yaw:-Math.PI / 2, model:{ xeom:'drv_xeom', bagac:'drv_xeom' },
  fit:{ xeom:{ hip:[0, 0.4, -0.05], grip:[[0.135, 0.44, 0.113], [-0.135, 0.44, 0.113]], peg:[[0.11, 0.11, 0.08], [-0.11, 0.11, 0.08]], rear:-0.28, bend:0.13, wheelie:true, gearFoot:true },
    bagac:{ hip:[0, 0.395, 0.19], grip:[[0.175, 0.467, 0.386], [-0.175, 0.467, 0.386]], sweep:0.4, peg:[[0.12, 0.13, 0.32], [-0.12, 0.13, 0.32]], rear:-0.338, bend:0.2, gearFoot:true } },
  grip:0.85, lean:{ body:0.22, head:0.6 }, straight:{ k:0.9, chest:0.06 }, sway:{ acc:0.02, lat:0.022, heave:0.3, max:0.2, k:50, z:0.38, glance:[3, 5, 0.5, 0.7] },
  // Z303 the repair: squatting on the ride's left side facing it (mount units): hips (height above the ground in m), feet, the hand braced on the frame,
  //   the hand at work on the engine / chain; how far forward he bends, how far he looks down, the hammer's lift and its rate
  fix:{ xeom:{ hip:[0.33, 0, -0.02], foot:[[0.35, 0, 0.08], [0.35, 0, -0.12]], brace:[0.12, 0.33, 0.06], tool:[0.1, 0.17, -0.04] },
    bagac:{ hip:[0.35, 0, 0.3], foot:[[0.37, 0, 0.4], [0.37, 0, 0.2]], brace:[0.13, 0.36, 0.38], tool:[0.1, 0.2, 0.3] },
    hipH:0.44, bend:0.75, look:0.4, hammer:0.1, rate:6.5, ease:1.6 },
  // Z300 feet on the road (mount units, m/s, m/s²): both down below stopV (out to the side, Z362 hipFwd ahead of the hip: nearly under it); the inside foot out ahead skimming the road
  //   through a bend taken faster than dabV with more than dabLat of cornering; under a storm of fire (n hits in win s): ducked, face down and away, jinking
  feet:{ stopV:1.1, rate:6, out:0.04, fwd:0.05, hipFwd:0.04, dabV:4.5, dabLat:5.5, dabOut:0.17, dabFwd:0.17, hover:0.015, dust:2.2, dustC:0xbfa88a },
  dodge:{ win:2.2, n:3, flinch:1.6, jink:2.2, every:[0.35, 0.45], bend:0.14, face:0.2, away:0.45, lean:0.2, peek:[0.7, 0.5], hide:[0.8, 0.7] },
  // Z304 in a fight: how long it stays (s after a hit), the glances then (every / +random / held / +random), the darting eyes when peeking, how fast his head snaps
  alert:{ t:6, glance:[0.9, 1.1, 0.25, 0.3], sac:[0.22, 0.3], snap:14 },
  // Z361 talking: his head turned back toward his passenger (yaw rad stopped, fastYaw at fast m/s and over), held hold s (less at speed), the chest twist
  //   with it, eased at rate; his words nodded out (bob rad for speak s); a double nod (nod rad over nodT s) at the answer.
  //   panic: for t s after a hit, snatched looks back over a shoulder (yaw rad of neck and head, twist rad of the chest) held back s, eyes on the road
  //   ahead s between; toward the shots toThreat of the time; a shout (RIDE_TALK.behind) say of the looks; how fast his head snaps round
  chat:{ yaw:0.62, fastYaw:0.34, fast:7, hold:1.25, twist:0.14, rate:7, speak:1.1, bob:0.035, nod:0.09, nodT:0.75 },
  // Z361 fired up: now and then (every [s, +random s]; in a fight fight[...]; the first first s in), riding faster than v m/s and not in a hard turn
  //   (yr rad/s), his left hand off the bar for dur s — jabbed ahead (up rad above level, pumping at pump rad/s) or, fist of the time, a fist punched up;
  //   chin up chin rad; eased at rate
  charge:{ every:[16, 12], fight:[7, 6], first:9, v:2.5, yr:0.6, dur:1.9, up:0.32, pump:11, fist:0.35, chin:0.12, rate:7 },
  panic:{ t:4.5, yaw:1.45, twist:0.34, back:[0.32, 0.25], ahead:[0.45, 0.55], toThreat:0.4, say:0.35, snap:16 }, wheelie:{ pitch:0.42, dur:1.15 }, weave:{ amp:0.12, f:1.3 }, duck:{ t:1.6, bend:0.36 }, gears:[2.2, 4.4, 6.4],
  crash:{ v:7.5, hit:22, p:0.3, down:1.3, getup:0.5, mount:0.45, cool:8, throwSoldier:true, callR:9 } };   // (Z331 getup = the scramble off his back onto all fours, mount = easing onto the seat)
// Z331 THE DRIVER OFF THE RIDE (actors/driver-acts.js; m, s, rad, m/s). crawl: his speed on hands and knees, how far each hand / knee reaches per stride,
//   how high a limb lifts, knees ahead of the hips, knee spread, hands ahead of the shoulders, turn rate, the scramble before he gets going, give-up time.
//   heave (righting the bike): grab, first heave [s, how far up it comes], it slips back [s, down to], a breath, the big heave (s), stood a moment; hips
//   [squatting, stood] height off the ground, back bent [squatting, stood], hips behind his feet [squatting, stood], feet out from his hands [at the
//   start, stood], feet apart, a foot steps in once it is step from where it should be (stepT s, stepH m high, aimed lead s ahead), how hard he trembles, the seat hand
//   (mount units from the saddle point: out to the side, up, back). give (the soldier shot down): the jump off [sideways, up, share of the ride's
//   speed carried], run speed and clip rate, how far beside the body he kneels, farther than far he kneels where he lands, the drop to his knees (s),
//   hands up for up s then behind his head over behind s, how far he sinks back, head bowed [neck, head], tremble, the last beat lingers show s on
//   him on his knees (wait s at most) before the battle is lost
export const RIDE_ACT = { crawl:{ v:1.3, reach:0.11, lift:0.07, kneeF:0.08, kneeW:0.11, handF:0.05, turn:5, scramble:0.5, max:7 },
  heave:{ grab:0.35, h1:[0.75, 0.42], slip:[0.35, 0.22], breath:0.4, h2:1.05, hold:0.4, hip:[0.52, 0.86], bend:[0.85, 0.22], back:[0.18, 0.06], off:[0.42, 0.3], feet:0.19,
    step:0.13, stepT:0.17, stepH:0.07, lead:0.2, shake:0.012, seat:[0.13, 0, -0.06] },
  give:{ jump:[2.4, 2.6, 0.5], run:3.4, runClip:1.1, beside:0.9, far:18, drop:0.45, up:1.1, behind:0.5, sink:0.1, bow:[0.55, 0.3], shake:0.01, show:1.6, wait:5 } };
// Z296 what the driver and the soldier say to each other, by event (d = the driver, s = the soldier's answer) — on screen (THOẠI TRÊN MÀN HÌNH) and spoken: VOICE 2 files d_<event>_<n> / s_<event>_<n>, n = index + 1 (tools/voice/build.mjs)
export const RIDE_TALK = { gap:7, reply:1.3, col:{ d:'#ffe9a8', s:'#b8e3ff' },
  start:{ d:['Lên xe đi con, chú chở!', 'Ngồi chắc nha, mình đi!', 'Cuốc này mười lăm nghìn nha, đạn bay thì tính phụ thu!'], s:['Đi chú!', 'Chạy đi chú, em yểm trợ!', 'Chạy đi chú, tiền xăng con bao!'] },
  wheelie:{ d:['Bốc đầu nè!', 'Ôm chặt vô!', 'Coi chú nè!', 'Hồi trẻ chú đua xe đó nghe!'], s:['Trời đất ơi chú!', 'Từ từ thôi chú!'] },
  turn:{ d:['Ôm cua nha!', 'Nghiêng theo chú!'], s:['Rõ!'] },
  fast:{ d:['Lên số nè!', 'Vít ga luôn!'], s:['Nhanh nữa chú!'] },
  underfire:{ d:['Cúi xuống! Đạn kìa!', 'Trời ơi nó bắn!', 'Nấp sau lưng chú!', 'Trời đất ơi, cuốc mười lăm nghìn mà chạy vô lửa vầy nè!', 'Thủng lốp là con đền nghen!', 'Tụi nó bắn xe chú kìa! Xe trả góp chưa xong đó!'], s:['Để em xử nó!', 'Chú cứ chạy, em lo!'] },
  crash:{ d:['Té rồi! Té rồi!', 'Ui da!', 'Xe ngã rồi con ơi!'], s:['Chú có sao không?!', 'Em yểm trợ, chú dựng xe đi!'] },
  getup:{ d:['Không sao… còn sống!', 'Đau quá mà không chết!'], s:['Nhanh lên chú!'] },
  lift:{ d:['Dựng xe dậy cái đã!', 'Một… hai… ba… lên!'], s:['Em canh cho!'] },
  slip:{ d:['Hự… tuột tay!', 'Nặng quá trời đất ơi…', 'Ối… thêm cái nữa!'], s:['Cố lên chú!', 'Lẹ lên chú ơi!'] },   // Z331 the first heave slips back
  surrender:{ d:['Đừng bắn! Tôi đầu hàng!', 'Tôi chỉ chạy xe ôm thôi mà!', 'Tha cho tôi, nhà còn vợ con!', 'Thôi xong… ai trả tiền cuốc này đây trời!'], s:[] },   // Z331 the soldier is down: he gives himself up
  remount:{ d:['Lên xe! Chạy tiếp!', 'Ngon rồi, đi thôi!', 'Lên xe! Cuốc này chú tính gấp đôi nha!', 'Đó! Đã nói rồi, xe chú lì lắm!'], s:['Đi!', 'Dạ… ghi sổ nha chú!'] },
  // Z361 the bike dies: on the seat · the kick-start · the tyre booted · the hurt foot · the row (argue: the soldier answers the line of the same index)
  //   · giving in · the spark-plug mutter at the repair · fired up, urging the soldier on · a panicked look back under fire
  stall:{ d:['Ơ… ơ… tắt máy rồi!', 'Thôi xong, chết máy!', 'Ủa ủa… sao vậy trời!', 'Lại chết máy! Con xe này nó ghét chú!'], s:['Gì nữa vậy chú?!', 'Chú đừng nói hết xăng nha!'] },
  kickstart:{ d:['Nổ đi mà… nổ đi cưng!', 'Một cái nữa thôi… nổ!', 'Đạp muốn rụng giò mà không nổ!'], s:[] },
  kick:{ d:['Đồ xe cà tàng!', 'Mày phản tao hả!', 'Hư hoài vậy mậy!'], s:[] },
  ouch:{ d:['Á á! Đau chân!', 'Ui da… cái giò tui!', 'Ối… trật khớp rồi!'], s:['Đá chi cho đau vậy chú…', 'Xe có lỗi gì đâu chú!', 'Chú… có sao không?'] },
  argue:{ d:['Tại con bắn nhau ầm ầm nên nó mới hư đó!', 'Xe này chú chạy hai chục năm chưa hư bữa nào nghe!', 'Tiền sửa xe ai trả? Con trả nha!', 'Chở con có một cuốc mà tui mất cái xe!', 'Lần sau tui chở khách đi chợ thôi, hết chở lính!'],
    s:['Tại xe chú cũ rích chứ bộ!', 'Thì bữa nay nó hư đó chú!', 'Dạ… ghi sổ quân đội đi chú!', 'Xe còn nguyên đó chú, sửa lẹ đi!', 'Câu đó chú nói lần thứ ba rồi đó!'] },
  giveup:{ d:['Thôi được rồi… để chú coi máy.', 'Đứng canh cho chú sửa đó nghe chưa!', 'Hừ… nói không lại con!'], s:['Rõ!', 'Chú lẹ lẹ nha!'] },
  fixing:{ d:['Chắc tại cái bugi…', 'Lau cái bugi là chạy liền!', 'Bình xăng con lại nghẹt rồi…'], s:['Sửa được không chú?', 'Lẹ lên chú ơi, địch tới!'] },
  charge:{ d:['Quậy đục nước nó cho tao! Tiến lên!!', 'Xông lên con! Bắn nát tụi nó!', 'Đằng kia kìa! Bắn! Bắn!', 'Tiến lên!! Có chú đây!', 'Cho tụi nó biết tay dân xe ôm!', 'Bám chặt! Chú lách sát tụi nó, con cứ bắn!', 'Chú áp sát, con bắn chết tụi nó đi!', 'Bắn đi, đừng tiếc đạn, tiền đạn không tính vô cuốc!'], s:['Rõ, chú!', 'Xông lên!!', 'Chú cứ chạy, em lo!'] },   // (fired up, the hand thrust ahead)
  // Z363 the hammer · his break: a smoke (the lines as he pulls over, mid-drag), a pee, done, cut short by the fighting
  bang:{ d:['Đồ quỷ! Đồ quỷ!', 'Chạy coi! Chạy coi!', 'Tao cho mày biết tay!', 'Đợi xíu, dộng nó mấy búa là chạy liền!'], s:['Từ từ chú ơi, gãy xe bây giờ!', 'Đập vậy hư thêm đó chú!'] },
  smoke:{ d:['Mệt quá… cho chú làm điếu thuốc cái đã!', 'Nghỉ chút con, chú run tay quá rồi!', 'Hút điếu thuốc cho tỉnh cái đầu…'], s:['Chú ơi đang đánh nhau mà!', 'Hút lẹ đi chú!', 'Trời đất, giờ này mà hút thuốc!'] },
  puff:{ d:['Phù… sướng…', 'Đời xe ôm, có điếu thuốc là vui rồi…', 'Hút xong điếu này chú chở con tới chân trời luôn!', 'Con hút không? À thôi, lính đang trực.'], s:[] },
  pee:{ d:['Chờ chú xíu… mắc quá rồi!', 'Chú đi giải quyết nỗi buồn cái!', 'Nín không nổi nữa con ơi!'], s:['Trời đất, ngay lúc này hả chú?!', 'Lẹ lẹ nha chú!', 'Chú ra xa xa chút!'] },
  peeing:{ d:['Aaa… nhẹ cả người…', 'Phù… sống lại rồi…', 'Đừng có ngó nghen!'], s:[] },
  rested:{ d:['Rồi, đi tiếp! Lên xe con!', 'Tỉnh rồi! Đi thôi!'], s:['Lẹ lên chú!', 'Đi!'] },
  cut:{ d:['Ối! Tụi nó tới! Về xe, về xe!', 'Chưa kịp xong nữa trời ơi!', 'Trời ơi, cho người ta tè cũng không yên!'], s:['Lẹ lên chú!'] },
  behind:{ d:['Phía sau! Nó đuổi sau lưng kìa!', 'Má ơi, còn nữa kìa!', 'Chết rồi chết rồi!'], s:['Chú nhìn đường dùm em!', 'Em thấy rồi, chú cứ chạy!'] } };
// VOICE 2 THE FUN TALK (audio/banter.js; the lines and who reads them: tools/voice/lines.json → src/data/voice-lines.js): the driver, the soldier, the squad and the
//   enemy SPEAK — RIDE_TALK's lines and the extra events below — one speaker at a time, under the commander's radio (prio: a higher speaker cuts a lower one, an equal
//   or lower one is dropped; a soldier's answer waits for the line it answers, hold s at most). gap: s between two lines of a group ([min, max] = a fresh draw each
//   time; scene: the driver's own acts — the rant, the break, the spill — only need sceneGap s after the last line ended); budget: at most n chatter lines in win s
//   (the acts and the danger calls are not counted); a group's lines are cycled (none again until all were said). tick: s between two looks at the game (reload,
//   grenades, hits, the ride, the quiet counters). streak: n kills inside win s → the commander's streak call (a helicopter counts air). kill: the chance he calls
//   his own kill · hurt: a hit of dmg or more → a gasp (the commander's low-health call wins under 30 %) · ammoCmd: the chance a dry magazine gets the commander's
//   joke instead of the soldier's shout · knifeCmd: from the nth silent blade kill in a row the commander may say "gọn gàng" (p) · nadeR: an enemy grenade within
//   this many m → the squad's warning · brake: H.stop.k over this = a hard stop · ride: s on the seat before the night / rain line · near: the "xe ôm" shout of the
//   enemy at first contact on the bike, cd s apart · pos: the driver off his bike / an enemy is heard from where he is (full within ref m, then × ref / d, never under
//   min; farther than max m: not said) · gain: by group · sub: the subtitle (s on screen after the line, colour by speaker). PROFILE.banter === false (Cài đặt →
//   Âm thanh → Thoại vui) mutes all of it; the danger calls stay.
export const VOICE_CHAT = { on:true, tick:0.25, hold:3, sceneGap:0.6,
  prio:{ cmd:4, drv:3, sol:3, mate:2, foe:1 },
  gap:{ drv:[8, 12], sol:[5, 8], mate:[10, 16], foe:[9, 14], cmd:[25, 40] }, budget:{ n:6, win:60 },
  scene:['crash', 'getup', 'lift', 'slip', 'surrender', 'remount', 'stall', 'kickstart', 'kick', 'ouch', 'argue', 'giveup', 'fixing', 'bang', 'smoke', 'puff', 'pee', 'peeing', 'rested', 'cut', 'call', 'drop', 'pickup', 'win'],
  streak:{ n:4, win:7, air:3 }, kill:{ p:0.3 }, hurt:{ dmg:9 }, ammoCmd:0.35, knifeCmd:{ n:2, p:0.5 }, nadeR:22, brake:0.55, ride:8, near:{ cd:90 },
  pos:{ ref:6, min:0.3, max:45 }, gain:{ cmd:0.95, drv:0.95, sol:0.85, mate:0.85, foe:0.8 },
  sub:{ t:1.2, who:{ c:['SCH', '#9fd0ff'], v:['TƯỚNG ĐỊCH', '#ff8a6a'], f:['TƯỚNG GIỮ THÀNH', '#ff8a6a'], d:['BÁC TÀI', '#ffe9a8'], s:['BẠN', '#b8e3ff'], m:['ĐỒNG ĐỘI', '#cfe6a8'], e:['LÍNH ĐỊCH', '#ffb0a0'] } } };
// Z361 THE BIKE DIES UNDER HIM (actors/driver-rant.js; s, m, rad). stall, on the seat: the throttle wrung in vain (wring s, twist rad at twistF rad/s),
//   the bike let roll to a stop (below still m/s, or roll s more at most), then n kicks on the kick-start, kick s each (the foot on the pad until at[0]
//   of it, stamped down by at[1], the lever let back up), the pad up and down [up, along] m from the right peg and out from it, how far he stands up
//   off the seat on the stamp, a beat after the last; his eyes [neck down, head down, turned to the lever]. off: the step down (s) to side m out
//   from the seat, then walked (m/s, clip rate, walkMax s at most) to a tyre's outer quarter (of its radius along the bike), stood out m from it,
//   angle rad off the bike's side (stepped down lead m toward that end). kick: wind-up, swing, recoil (s), the foot drawn back [behind, up] and clutched [ahead of the hip, below it, in across] (hands grab m above
//   it), the hop (s, hops/s, m high, turning rad/s), bent over it (rad), sunk on the standing knee (m); the bike rocks (rad, damping, rad/s).
//   argue: [fewest, most] rounds of words (none with the soldier firing), each round s, his line say s in and the answer answer s after, gestures eased over blend s, turn rate, the soldier's
//   face m up, farther than far no row. giveup: the wave (s), all of it (s), the turn back, eased down into the repair squat (s), the mutter s into it;
//   the repair after a rant takes fixK of XEOM.wear.fixT (the row ate into it)
export const RIDE_RANT = { stall:{ wring:1.2, twist:0.6, twistF:13, still:0.6, roll:2.5, n:3, kick:0.85, at:[0.4, 0.56], top:[0.25, -0.14], bot:[-0.09, -0.04], out:0.05, rise:0.1, after:0.35, look:[0.4, 0.25, 0.35] },
  off:{ step:0.55, side:0.42, lead:0.25, walkV:0.95, clip:1.0, walkMax:4, quarter:0.55, angle:0.75, out:0.6 },
  kick:{ wind:0.42, swing:0.13, back:0.22, wb:[0.32, 0.22], held:[0.3, 0.25, 0.07], grab:0.03, hop:2.0, hopF:2.6, hopH:0.06, spin:0.9, bow:0.68, sink:0.07, rock:0.08, rockD:2.6, rockF:15 },
  argue:{ rounds:[1, 2], round:3.4, say:0.3, answer:1.9, blend:0.22, turn:7, eye:1.55, far:14 },
  giveup:{ wave:0.75, dur:1.25, turn:5, squat:0.55, mutter:1.2, fixK:0.55 },
  // Z363 the hammer: stood side m out from the saddle facing it, the hammer drawn from his back pocket (s), n overhead blows of blow s each (the slam
  //   the last slam of it, landing at hit of it, the fist over m above the strike point at — mount units, the saddle's left flank), bent bow rad into each, put away (s);
//   on the bike's right (the soldier on its left) the strike point is mirrored and the free hand braces on the pillion seat (brace)
  bang:{ side:0.42, at:[0.11, 0.33, -0.14], brace:[-0.09, 0.37, -0.3], draw:0.5, n:3, blow:0.75, slam:0.14, hit:0.62, over:0.12, bow:0.42, stow:0.45 } };
// Z363 THE DRIVER'S BREAK (actors/driver-break.js; s, m, rad): after every[0] + random every[1] s of riding he wants one — once it has been quiet calm s
//   (no hit on the ride, the soldier's gun quiet half that, no enemy within safeR m; an enemy within 0.6 of it or a shot cuts it short); peeK of the time
//   a pee, else a smoke. Stopped still s, the soldier steps down; he gets off side m out on the bike's right (eased over step s) and walks away m (smoke)
//   / peeAway m (pee) at angle rad ahead of straight out. smoke: squat / stand up (s) to hips hipH m off the ground, back m behind his heels, feet wide m
//   apart, the trunk lean rad; Z364 the mask pulled down / back up (s), the cigarette out of his pocket (s), light (s), n drags of drag s, the flick (s).
//   Z366 lean (the smoke, leaning on the saddle): its right edge at (mount units), his hips out m from it at hipY m off the ground, his feet
//   feet m further out, the trunk tipped back rad, the right ankle crossed over to cross m left of his middle.
//   pee: open (s), the stream (s, drops/s, v m/s out), the shiver, close (s)
export const RIDE_BREAK = { every:[150, 120], calm:25, safeR:40, peeK:0.4, still:0.35, side:0.42, step:0.5, away:3.2, peeAway:4.6, angle:0.9,
  smoke:{ squat:0.6, hipH:0.33, back:0.2, wide:0.18, lean:0.55, mask:0.8, pack:0.9, light:1.4, n:3, drag:2.6, flick:0.6 },
  lean:{ at:[-0.1, 0.33, -0.18], out:0.12, hipY:0.84, feet:0.3, back:0.08, cross:0.15 }, pee:{ open:0.6, stream:4.2, rate:30, v:1.5, shiver:0.6, close:0.5 } };
// Z293 the war rides (Tripo P2 from reference photos, driver posed on the vehicle): len = true length (m), yaw = turn so the nose faces +z, seat = [height, along] in
//   the mount's units (m ÷ k) where the soldier's hips (or, standing, his feet) go; pose = how he rides; lean = how far it banks in a turn
//   Z310 the bán tải's four wheels measured off its model (each tyre its own round piece: centre, radius, width) — they roll, the front pair steers
export const XEOM = { k:2.3, xeom:{ len:1.95, side:0.85, wheels:[{ c:[0, 0.148, 0.285], r:0.148, w:0.042, steer:true }, { c:[0, 0.148, -0.278], r:0.148, w:0.044 }], yaw:0, seat:[0.44, -0.31], feet:[0.125, 0.2, -0.19], pose:'straddle', lean:0.35, steer:{ a:[0.285, 0.148], b:[0.16, 0.44], back:0.025, top:0.4, z:0.02 }, lamps:{ head:[0, 0.446, 0.199], lens:{ top:0.072, bot:0.05, h:0.047, r:0.011, tilt:0.33 }, tail:[[0, 0.318, -0.384]] }, driver:[0.78, 0.05], livery:0 },
  bagac:{ len:3.3, side:1.15, wheels:[{ c:[0, 0.13, 0.595], r:0.13, w:0.05, steer:true }, { c:[0.272, 0.128, -0.338], r:0.128, w:0.075, spoke:false }, { c:[-0.272, 0.128, -0.338], r:0.128, w:0.075, spoke:false }], yaw:3.1416, seat:[0.33, -0.36], pose:'stand', lean:0.12, steer:{ a:[0.595, 0.13], b:[0.46, 0.44], back:0.025, top:0.4, z:0.36 }, lamps:{ head:[0, 0.41, 0.538], tail:[[0.24, 0.27, -0.72], [-0.24, 0.27, -0.72]] } }, bantai:{ len:4.7, side:1.45, wheels:[{ c:[0.32, 0.166, 0.681], r:0.165, w:0.105, steer:true, spoke:false }, { c:[-0.32, 0.166, 0.681], r:0.165, w:0.105, steer:true, spoke:false },
    { c:[0.32, 0.166, -0.507], r:0.165, w:0.105, spoke:false }, { c:[-0.32, 0.166, -0.507], r:0.165, w:0.105, spoke:false }], yaw:-1.5708, seat:[0.37, -0.54], pose:'stand', lean:0 },
  // Z299 the sprung body on its wheels (metres, seconds): heave / pitch / roll springs (k stiffness, z damping ratio); squat and dive per m/s² of
  //   acceleration; trikes roll outward per m/s² of cornering; rough road kicks (per metre at speed, m/s); the steer angle from the turn rate and wheelbase
  sus:{ k:190, z:0.32, kp:120, zp:0.36, kr:110, zr:0.4, pitchAcc:0.006, pitch:[-0.075, 0.045], rollLat:0.005, rollMax:0.055, rough:0.5, bump:0.32, kickP:0.5, gY:0.6, buzz:0.0012, steerMax:0.55, steerRate:9, restLean:0.06, leanK:1, leanMax:0.72, dustRun:0.9, dustHard:1.6, dustAcc:4, dustC:0xbfa88a },
  // Z311 the ride's feel: lean = it banks into a bend only from lean[0] m/s, fully from lean[1] (slow or standing it stays upright); slip = fast and turning
  //   hard the rear steps out (rad per m/s over v per rad/s of turn, at most max) · rock = a stone under a tyre jolts it (k × the stone's radius, nose up off the
  //   front wheel, down off the rear), and at speed over hopV a stone bigger than hop throws it off the ground (Z404 cap: the most a fallen trunk or a heap of rubble lifts a wheel, m — the bán tải: its power.climbH; clear: the frame's height over the road — a thing passing between the wheels taller than that lifts the axle) · hop = Space at over v m/s: the wheelie leaves
  //   the ground (launch vy m/s, the faster the higher) · g = its fall (m/s²); land = how hard a landing squashes the springs, which bounce on less damped
  //   (landZ) for landT s, and may squash further (sag m) · low = an obstacle under h m: over v m/s it is jumped (clearing it by over m), slower it still blocks
  air:{ lean:[3, 6.5], slip:{ v:5, k:0.05, max:0.2 }, rock:{ k:1.4, hop:0.42, hopV:5.5, cap:0.4, clear:0.22 }, hop:{ v:4.5, vy:[2.0, 3.0] }, g:15, land:0.5, landZ:0.12, landT:1.1, sag:0.11,
    low:{ h:0.85, v:4.5, over:0.25 } },
  // Z303 the ride's health (hp per ride; share of each hit on the soldier it takes while he rides; a crash's damage), smoke below `smoke` of it, a limp
  //   (top speed × limpK, a coughing engine) below `limp`; broken, the driver repairs it in fixT s and it comes back at fixHp of its health; engine smoke points
  // Z363 the exhaust (game/ride-wear.js rideExhaust): the muffler's tip (mount units) per ride, puffs a second [idle, + at speed, + on the throttle], how fast
  //   they leave the pipe (m/s), their colour (blue-grey; dark on the throttle), size (m), life (s), opacity
  exhaust:{ xeom:[-0.075, 0.14, -0.31], bagac:[-0.12, 0.12, -0.55], rate:[9, 8, 14], v:0.9, col:0xa9b0b8, dark:0x404145, size:0.75, life:1.6, op:1.35 },
  wear:{ hp:{ xeom:150, bagac:190 }, share:0.5, crash:28, spill:6, smoke:0.6, limp:0.3, limpK:0.7, fixT:7, fixHp:0.35, engine:{ xeom:[0, 0.17, -0.03], bagac:[0, 0.2, 0.3] } },
  // Z306 the ride on the street (game/ride-impact.js): closing speed (m/s) above which a blow is a knock (sparks, glass, a scooter over); animals: run down
  //   above animalV, a big one (legs longer than bigLeg) brings the ride down (spill: wear above). Z320 a ram is a collision of masses (a car = 1, a scooter
  //   moto): the ride's mass by kind, e = how much they spring apart — the blow shoves and spins what it hits and takes speed off the ride by the masses, no spill
  impact:{ knockV:2.5, mass:{ xeom:0.8, bagac:1.1, bantai:2.6, horse:0.9 }, moto:0.35, e:0.25, animalV:3, bigLeg:1.1 },
  // Z306 calling the ride (game/ride-call.js): farther than farR (m) he comes round by the streets — after delay s he turns up dropR m away and rides in; no
  //   closer for stuckT s → he comes round too; after a spill you climb straight back on if you stayed within stayR m of where you landed
  call:{ farR:55, delay:4, dropR:26, stuckT:3, stayR:4 },
  // Z404 a long ride's outline (game/ride-collide.js rideHull): [x across, z along, r] circles in metres over its drawn footprint (ba gác 3.3 × 1.7 m,
  //   bán tải 4.7 × 1.95 m) — a spine down the middle and its four corners — that everything it meets is pushed out of; the xe ôm and the horse keep one circle
  hull:{ bagac:[[0, 0, 0.8], [0, 0.85, 0.8], [0, -0.85, 0.8], [0.42, 1.25, 0.42], [-0.42, 1.25, 0.42], [0.42, -1.25, 0.42], [-0.42, -1.25, 0.42]],
    bantai:[[0, 0, 0.95], [0, 1.4, 0.95], [0, -1.4, 0.95], [0.52, 1.9, 0.45], [-0.52, 1.9, 0.45], [0.52, -1.9, 0.45], [-0.52, -1.9, 0.45]] },
  // Z404 THE BÁN TẢI'S WEIGHT (game/ride-collide.js): it rides over anything drawn no higher than climbH m (stones, a fallen trunk, rubble, low
  //   cover — never the anti-vehicle teeth / hedgehogs of `never`), its wheels climbing it, losing climbDrag of its speed a second while on it; it
  //   smashes light cover (its closing speed × ramK into the tank's ram, game/cover.js ramBlock), bursts a brick wall at wallV m/s closing (slower it
  //   only thumps it), knocks street props over at knockV and flattens wire at wireV; through a wall or a piece it keeps passK of its speed and takes
  //   wear of damage
  power:{ bantai:{ climbH:1.05, climbDrag:0.9, never:['hedgehog', 'teeth'], ramK:1.6, wallV:6, knockV:2, wireV:3, passK:0.6, wear:6 } },
  // Z301 the lamps (mount units; HDR colour multipliers, so the bright ones bloom): headlamp lens radius, its glow by day / by night, the beam by night
  //   (a spot on the bars: it swings with the steering); tail lens size, its running glow and its brake flare (braking harder than brakeAcc m/s²)
  //   Z308 a ride's own lamps.lens = the shape of its headlamp glass, so the glow fills exactly that (at lamps.head, its centre): widths across the top
  //   and the bottom, height, corner radius, and how far its face leans back (rad, with the steering head); without it the glow is a disc of headR
  lamp:{ headR:0.026, day:2.2, night:7, beam:{ i:4.2, dist:28, ang:0.5, pen:0.6, ahead:6, drop:0.55, r0:0.02, r1:0.9, len:4.4, op:0.2 }, tail:[0.034, 0.02], run:1.1, brake:4.5, brakeAcc:1.2, ease:14 },
  pegY:0.22, poses:{ straddle:{ hip:-1.3, knee:1.5, spread:0.3 }, stand:{ hip:0, knee:0.1, spread:0.12, stand:true } }, lean:0.35, lines:['Bám chắc nha con!', 'Ngồi im, chú chạy đây!', 'Trời ơi, đạn bay vèo vèo!', 'Tới nơi rồi, xuống bắn đi!'] };
// RIDE 1–3 THE MOUNTS MOVE LIKE THE REAL THING (game/ride-avoid.js · game/ride-feel.js · game/cavalry.js · game/xeom.js · actors/horse.js; m, s, m/s, rad).
//   avoid — the horse's / the driver's own line round what is in the way: one look every `every` s, feelers look[0] + look[1]·speed m long (look[2] at most)
//   at headings fan (rad off its own, each × lenK) and, the fan shut, over each shoulder; a body's half-width + margin must pass (the xe ôm's is small: it
//   squeezes through); a way is scored free share − devW·(rad off the way pushed) + stick for the side already taken (forgotten forget s after the way is
//   clear), never more than maxDev off it; under halt m free it is no way at all; gain = [far, near] × the turn; brake m/s² it trusts itself to pull up
//   with; round what is dead ahead no faster than swerve × that + swerveV; shut within gapD m on both sides it is a gap, taken at gapV; creep = its slowest
//   while a way is open; bad ground (a rise steeper than slope, a drop over drop per metre, the deep channel) counts softPass of the way beyond it; edge =
//   m inside the field's edge; the margin shrinks to squeeze × itself as it slows from squeezeV; shut for escWait s and still pushed on it comes round on
//   the spot (escTurn rad at a time) and for escKeep s may take a way up to escDev off the push · bike.hull — the xe ôm's outline ([x, z, r] m, nose to tail: as narrow as it is drawn)
//   stop — the hard stop (game/ride-feel.js): faster than minV and asked for under rein × its speed (the push let go, the way shut) — or told to go more
//   than aboutA rad behind it — it brakes at decel m/s² × the ground's grip (by battlefield; wet = in a ford) until under endV (an about-turn: aboutV, then
//   it comes round pivot × as fast), unless he pushes on again by resume m/s; the pose's depth k runs from kMin at minV to 1 at fullV, in at inRate /s, out
//   at outRate /s. horse: nose-up pitch rad, croup drop and forward shift m (about its forefeet), hind-leg fold femur / tibia / cannon rad, neck up and
//   nose tucked rad, roll into an about-turn rad, the rider's lean back (as a push, m/s²), feet = where its hooves stand [hind z, fore z, half-track] and
//   plant = how far they slide forward [hind, fore] m, mark = a furrow's [width m, darkness], dust per metre slid. bike: the fork's extra dive rad, zp =
//   the damper through the stop and hold s after it, rebound = how far past level the fork is let go at rest (rad, eased out at rebRate /s: one rebound), slip = the tail's step-out rad, mark = the skid's [× the tyre's width, darkness],
//   rear = the rear tyre behind the centre m
//   bike — cornering, springs, wheelie (game/xeom.js, actors/driver.js): foot = under slowV m/s and turning faster than slowYr rad/s the driver's inside foot
//   is off the peg, out m to the side, fwd m ahead, hover m off the road · pillion = the passenger's share of the driver's lean into a bend · squat × the
//   nose-up under power (squatMax rad) · crest / heave = how hard a change of slope under the wheels pitches / heaves the body · wheelie: wind s loading
//   the fork (nose dip rad, his crouch rad), up at rise /s, held with wobble [rad, rad/s], coming down over drop s at fall /s onto bounce [pitch rad/s, heave
//   m/s] with the stiff damper hold s · slope (both mounts): the rise over probe m ahead takes up × it off the top speed (down gives a little), within [min, max]
//   horse.body — the real horse on the ground: pitched to the slope over ± len m (maxPitch rad), eased at rate /s, leant into its turns bank × the rig's own
export const RIDEFEEL = {
  avoid:{ on:true, every:0.09, look:[3.4, 0.95, 20], fan:[0, 0.36, -0.36, 0.8, -0.8], lenK:[1, 0.92, 0.92, 0.66, 0.66], shoulder:1.45, margin:{ horse:0.4, bike:0.14 },
    devW:0.45, stick:0.22, forget:0.5, maxDev:1.75, halt:0.7, gain:[0.9, 2.6], squeeze:0.25, squeezeV:5, escWait:0.35, escTurn:1.2, escDev:2.9, escKeep:3, brake:6, swerve:1.5, swerveV:2.5, gapD:3, gapV:{ horse:3.6, bike:5 }, creep:1.3,
    slope:0.8, drop:0.9, softPass:0.35, edge:3.6, awayA:2, awayV:3.2 },
  stop:{ minV:4.2, rein:0.3, endV:0.35, resume:0.8, aboutA:2.1, aboutV:1.6, shake:0.3, kMin:0.55,
    grip:{ DESERT:0.7, ARCTIC:0.55, SAVANNA:0.82, MEADOW:0.85, VOLCANO:0.78, QUARRY:0.9, wet:0.7 },
    horse:{ decel:11.5, fullV:11, inRate:11, outRate:2.6, pivot:1.7, pitch:0.2, drop:0.13, shift:0.27, femur:0.84, tibia:1.02, cannon:0.1, neck:0.26, head:0.38, roll:0.16, lean:8,
      feet:[-0.92, 0.6, 0.18], plant:[0.46, 0.26], mark:[0.12, 0.42], dust:2.6 },
    bike:{ decel:9.5, fullV:9, inRate:14, outRate:14, pivot:1.35, hold:1.1, dive:0.05, zp:0.5, rebound:0.06, rebRate:4, slip:0.09, mark:[1.6, 0.3], rear:0.62, dust:2.2 } },
  bike:{ hull:{ xeom:[[0, 0.6, 0.42], [0, 0, 0.45], [0, -0.6, 0.42]] }, foot:{ slowV:4.2, slowYr:0.85, out:0.2, fwd:0.06, hover:0.035 }, pillion:0.6,
    squat:1.8, squatMax:0.07, crest:2.4, heave:0.9, wheelie:{ wind:0.26, dip:0.045, crouch:0.16, rise:7, drop:0.2, fall:13, wobble:[0.025, 5.5], bounce:[0.9, 0.5], hold:1 },
    slope:{ probe:2.2, up:0.55, down:0.2, min:0.62, max:1.06 } },
  horse:{ slope:{ probe:2, up:0.9, down:0.15, min:0.55, max:1.05 }, body:{ len:0.75, maxPitch:0.32, rate:7, bank:1 } } };
// Z279 colossal forts (world/fortress.js dressFort; Tripo 4K): each battlefield's style (fort_<style>_{wall,tower,gate}.glb), wall height / thickness ×,
//   tower width ×, extra height, the donjon's size ×, the gatehouse width ×, and the doorway cut out of the gatehouse (share of its width, height)
export const REALFORT = { biomes:{ CITADEL:'citadel', MEADOW:'meadow', RUINS:'ruins', HILLS:'meadow', VILLAGE:'meadow', DESERT:'desert', SAVANNA:'savanna', QUARRY:'quarry', ARCTIC:'arctic', TUNDRA:'arctic', VOLCANO:'volcano', FOUNDRY:'foundry', STEELMILL:'foundry', CITY:'city' },   // Z399 the city's fort too: the works' concrete and steel (it stood as plain boxes in a stone wrap)
  wallUp:1.5, thick:1.25, towerW:1.35, towerUp:3, keepW:1.3, keepH:1.15, gateW:1.15, door:[0.2, 0.55],
  // Z435 THE FORTS IN PHOTOGRAPHED STONE AND STEEL (Poly Haven "Modular Fort 01" + a CC0 photo material per land; the AI-made walls read as soft clay):
  //   arch = the kit's pieces for the land's architecture — castle (thick ramparts, round towers), bastion (plainer ramparts, square corner bastions),
  //   works (thin curtain walls pierced by windows, square bastions: the steel works and the city); style = its stone or steel: the wall face wears the
  //   material in fortkit/<style>/ at rep repeats over the kit's ~12 m tile (photo m across), metal = a steel plate (how metallic; its ARM map's metalness counts, the copings in the plate too at trimRep of the face's repeat), tint = × the face,
  //   trim = the tint on the kit's own cut-stone copings and merlons. key = MODEL_FILES; the tower towerUp m over the wall top, at least towerW m
  //   across, never squeezed thinner than squash × its own proportions; the keep the tower whole (keepW × the drawn keep's width, ≥ keepH × a tower's scale)
  kit:{ on:true, key:'fort_kit', towerW:12, towerUp:2.5, squash:0.8, keepW:1.25, keepH:1.25, env:0.7, gate:'modular_fort_01_wall_thin_gate_01',
    arch:{ castle:{ wall:'modular_fort_01_wall_thick_straight_02', tower:'modular_fort_01_tower_round' },
      bastion:{ wall:'modular_fort_01_wall_thick_straight_01', tower:'modular_fort_01_wall_thick_corner_01', towerW:10 },
      works:{ wall:'modular_fort_01_wall_thin_straight_02', tower:'modular_fort_01_wall_thick_corner_01', towerW:9 } },
    style:{ citadel:{ arch:'castle', rep:6, trim:[0.95, 0.9, 0.82] }, meadow:{ arch:'castle', rep:6, trim:[0.82, 0.86, 0.74] }, quarry:{ arch:'castle', rep:6, trim:[1.06, 1.05, 1.02] },
      arctic:{ arch:'castle', rep:6.3, trim:[0.82, 0.86, 0.92] }, desert:{ arch:'bastion', rep:6, trim:[1.08, 0.94, 0.72] }, savanna:{ arch:'bastion', rep:6, trim:[0.98, 0.8, 0.6] },
      ruins:{ arch:'bastion', rep:6, trim:[0.7, 0.66, 0.6] }, volcano:{ arch:'bastion', rep:6.6, trim:[0.4, 0.37, 0.36] },
      foundry:{ arch:'works', rep:5, trim:[0.55, 0.53, 0.52], metal:0.65, tint:[0.62, 0.64, 0.68], trimRep:0.22 }, city:{ arch:'works', rep:6, trim:[0.72, 0.7, 0.68] } } },
  // Z457 EVERY FORT ITS OWN (world/fortress.js; the capital takes the first, the others the rest in a shuffled turn): st = the kit's stone (kit.style key) and
  //   arch = its architecture, tint / trim × over the style's (kept in the land's tones), keep = a real castle model where the keep stands (SCENERY.models:
  //   the Meshy community's, CC0) h m tall (over the walls), at most w × the fort's inner radius across and wardK × the capital's ward, at × Rin back from the centre opposite the gate,
  //   turn rad more about its axis, solid = its footprint's share that stops men and shells (an oriented box), flag = the banner's height × its top, tone = × its colour (a grey keep warmed to the land's stone)
  looks:{ QUARRY:[ { st:'quarry', arch:'castle', keep:'keep_castel', h:32, w:0.8, wardK:1.2, at:0.42, flag:1.0, solid:0.8 },
    { st:'citadel', arch:'bastion', keep:'keep_stonehall', h:27, w:0.95, at:0.4, flag:1.0, solid:0.92, tint:[1.04, 1.02, 1.0] },
    { st:'citadel', arch:'castle', keep:'keep_fortress', h:24, w:1.05, at:0.36, flag:0.95, solid:0.85, tint:[1.08, 1.06, 1.03], tone:[1.1, 1.02, 0.9] },
    { st:'quarry', arch:'bastion', keep:'keep_medieval', h:34, w:1.0, at:0.42, turn:1.5708, flag:0.92, solid:0.85, tone:[1.08, 1.02, 0.92] } ],
    // Z458 the other stone battlefields the same way, each keep toned to its land (sand, ochre, moss, ice, red earth, soot, basalt); the fit of each keep in keepFit
    DESERT:[ { st:'desert', arch:'bastion', keep:'keep_castel', h:32, tone:[1.1, 1.0, 0.84] }, { st:'desert', arch:'castle', keep:'keep_stonehall', h:26, tone:[1.12, 1.0, 0.82] },
      { st:'citadel', arch:'bastion', keep:'citadel_tower', h:26, tone:[1.12, 1.0, 0.84] }, { st:'desert', arch:'castle', keep:'keep_fortress', h:22, tone:[1.15, 1.02, 0.84] } ],
    CITADEL:[ { st:'citadel', arch:'castle', keep:'keep_castel', h:34, tone:[1.08, 1.0, 0.88] }, { st:'desert', arch:'bastion', keep:'keep_medieval', h:32, tone:[1.1, 1.0, 0.86] },
      { st:'citadel', arch:'bastion', keep:'keep_stonehall', h:26, tone:[1.06, 1.0, 0.9] }, { st:'citadel', arch:'castle', keep:'citadel_tower', h:26, tone:[1.08, 1.0, 0.88] } ],
    MEADOW:[ { st:'meadow', arch:'castle', keep:'keep_medieval', h:36, tone:[0.96, 1.0, 0.92] }, { st:'meadow', arch:'bastion', keep:'keep_castel', h:28, tone:[0.95, 0.98, 0.9] },
      { st:'quarry', arch:'castle', keep:'keep_fortress', h:22, tone:[0.95, 1.0, 0.92], tint:[0.9, 0.95, 0.86] }, { st:'meadow', arch:'castle', keep:'keep_stonehall', h:26, tone:[0.96, 1.0, 0.92] } ],
    ARCTIC:[ { st:'arctic', arch:'castle', keep:'keep_fortress', h:26, tone:[0.95, 0.98, 1.06] }, { st:'arctic', arch:'bastion', keep:'keep_medieval', h:32, tone:[0.94, 0.97, 1.05] },
      { st:'quarry', arch:'castle', keep:'keep_castel', h:28, tone:[0.95, 0.98, 1.06], tint:[0.9, 0.93, 0.98] }, { st:'arctic', arch:'castle', keep:'citadel_tower', h:24, tone:[0.95, 0.98, 1.06] } ],
    SAVANNA:[ { st:'savanna', arch:'bastion', keep:'keep_stonehall', h:28, tone:[1.08, 0.94, 0.78] }, { st:'desert', arch:'bastion', keep:'keep_fortress', h:22, tone:[1.1, 0.96, 0.8] },
      { st:'savanna', arch:'castle', keep:'citadel_tower', h:24, tone:[1.08, 0.94, 0.78] }, { st:'desert', arch:'castle', keep:'keep_castel', h:28, tone:[1.08, 0.96, 0.8] } ],
    RUINS:[ { st:'ruins', arch:'bastion', keep:'keep_castel', h:32, tone:[0.78, 0.74, 0.7] }, { st:'ruins', arch:'castle', keep:'keep_medieval', h:32, tone:[0.8, 0.76, 0.72] },
      { st:'quarry', arch:'bastion', keep:'keep_fortress', h:22, tone:[0.8, 0.76, 0.72], tint:[0.7, 0.68, 0.64] }, { st:'ruins', arch:'bastion', keep:'keep_stonehall', h:26, tone:[0.8, 0.76, 0.72] } ],
    VOLCANO:[ { st:'volcano', arch:'bastion', keep:'keep_fortress', h:26, tone:[0.6, 0.55, 0.52] }, { st:'volcano', arch:'castle', keep:'keep_medieval', h:32, tone:[0.62, 0.56, 0.52] },
      { st:'ruins', arch:'bastion', keep:'keep_stonehall', h:26, tone:[0.62, 0.56, 0.52] }, { st:'volcano', arch:'bastion', keep:'citadel_tower', h:24, tone:[0.6, 0.55, 0.52] } ] },
  // Z458 how each keep model sits in a yard (a look's own values win): w × Rin across at most, at × Rin back, turn, solid share, flag × its top
  // Z460 EACH BATTLEFIELD ITS OWN SET (world/fortress.js dressFort; Meshy community, CC0 — credits in assets/models/real/fort/SOURCES.txt): the forts' walls,
  //   towers and gatehouse from one set of models in the land's style instead of the photographed kit (fort_<st>_{wall,tower,gate}.glb, …/m/ for phones);
  //   tower = its height × the wall's (at its own proportions, its width kept between towerW × the drawn tower's), tint = × its colour (kept in the land's
  //   tones), closed = its wall ends cleanly (no breach opened at the seam where the model repeats). The looks' keeps still crown the yards.
  sets:{ ARCTIC:{ st:'m_arctic', tower:1.5, towerW:[0.75, 1.5], closed:true }, MEADOW:{ st:'m_meadow', tower:1.35, towerW:[0.8, 1.5], closed:true },
    CITADEL:{ st:'m_citadel', tower:1.55, towerW:[0.8, 1.5], closed:true, tint:[1.08, 1.02, 0.9] }, DESERT:{ st:'m_desert', tower:1.5, towerW:[0.8, 1.5], closed:true, tint:[1.16, 1.02, 0.8] },
    VOLCANO:{ st:'m_volcano', tower:1.25, towerW:[0.9, 1.6], closed:true, tint:[0.85, 0.78, 0.74] }, RUINS:{ st:'m_ruins', tower:1.4, towerW:[0.75, 1.5], closed:true, tint:[0.9, 0.86, 0.82] },
    SAVANNA:{ st:'m_savanna', tower:1.0, towerW:[0.9, 1.6], closed:true, tint:[1.12, 0.96, 0.8] } },
  keepFit:{ keep_castel:{ w:0.8, wardK:1.2, at:0.42, solid:0.8, flag:1.0 }, keep_stonehall:{ w:0.95, at:0.4, solid:0.92, flag:1.0 }, keep_fortress:{ w:1.05, at:0.36, solid:0.85, flag:0.95 },
    keep_medieval:{ w:1.0, at:0.42, turn:1.5708, solid:0.85, flag:0.92 }, citadel_tower:{ w:0.7, at:0.4, solid:0.75, flag:0.95 } } };
// Z378 the see-through seams in a dressed fort's wall (dressFort: where the model's ragged end meets its own start again, every rep sections) opened into
//   a clean breach w m wide, the soldier and the xe ôm through it, a tank not — only between two sections of one run of wall, and only when the model spans
//   at least minRep sections · bin = the height of the rows the cut faces are filled in (m) · guard = how far a wall-top rifleman stands off its edge (m)
export const FORT_GAP = { w:2.6, minRep:4, bin:0.2, guard:0.8 };
// Z269 the field headquarters at the heart of our base (actors/core.js dressCore; Tripo, from a generated concept): w = footprint (m), sink = share of its height under the pad, hitR = the core's hit radius with it
// Z424 REAL GUNS ON THE DRAWN MOUNTS (world/real-turrets.js): k = MODEL_FILES key, w = its width across (m, in the mount's own units — the base's guns are
//   scaled ×1.4 / ×1.25 after), spread = where the two muzzles sit across it; aa: the radar station's AA gun in its pit (a 40 mm Bofors-type gun in a ring
//   of concrete and sandbags, one scan): w = the pit across (m); the gun is the part inside gunR × its radius above gunY × its height, or anything above
//   top × its height — it turns, the pit stays; proj: the missile scan the rockets and missiles wear in flight
// Z425 the other rounds in flight (combat/siege-rocket.js): art = the enemy artillery's 122 mm field rocket, siege = our SIEGE rocket (a finned tactical
//   rocket), mortar = every mortar bomb (ours, our fire teams', the towers'); len = the scan's length (m) on the drawn round, before its group's scale
// Z426 A DRAWN PIECE WEARING A SCAN FITTED TO ITS OWN BOX (world/real-fit.js): k = the model, fit = the share of the drawn footprint it fills, yaw = its
//   front turned onto +z first; hMax = never taller than the drawn piece × this; launcher = the rocket truck, its scan cut where the launcher begins
//   (pod: behind that share of its length from the back, above that share of its height) so the pod turns with the drawn turntable
export const REALFIT = { env:0.8, hMax:1.3, hut:{ k:'quonset', fit:0.98 }, tent:{ k:'base_tent', fit:0.86 }, launcher:{ k:'mil_launcher', yaw:-Math.PI / 2, pod:[0.6, 0.5], fit:1 },
  // Z429 the camps' mess, quartermaster's and medical tents; the depots' camouflage canopy (arms racks, parked tanks) and the vehicle bunker behind the tanks;
  //   the underground base's pillboxes under their guns (world/real-fit.js placeScan / dressFit)
  mess:{ k:'tent_mess', fit:0.95 }, qm:{ k:'tent_qm', fit:0.95 }, med:{ k:'tent_med', fit:0.95 }, canopy:{ k:'canopy' }, pillbox:{ k:'pillbox', fit:1.02 } };
export const REALTURRET = { gun:{ k:'turret_cannon', w:4.2, spread:0 }, mg:{ k:'turret_rws', w:3.2, spread:0.26 }, aa:{ k:'turret_aa', w:6.6, gunR:0.62, gunY:0.17, top:0.55 }, proj:{ k:'proj_missile' },
  art:{ k:'proj_rocket122', file:'rocket122', len:3.3, nose:'up' }, siege:{ k:'proj_tactical', file:'tactical', len:3.6, nose:'up' }, mortar:{ k:'proj_mortar', file:'mortar', len:1.45, nose:'up' } };
export const REALCAMP = { hq:{ w:21, sink:0.01, yaw:0, env:0.9, lightY:9, hitR:9 },
  walls:{ wallUp:0.4, thick:1.0, sink:-0.4, towerUp:-0.6, towerW:0.85 } };   // Z273 the concrete compound (world/core-walls.js dressWalls): wall height over CORE_DEF.H, thickness ×, tower height / width
export const CORE_DEF = { hp:420, perStage:50, armour:0.72, regen:2.4, regenDelay:6, shield:{ at:0.35, t:9, cd:70 } };   // Z223 the Core is harder to break: thicker, armoured, mends itself when left alone, and throws up an emergency shield (also saves it from a killing blow) once per cd s
export const FIELDCRAFT = {
  los: { step: 1.5, endSkip: 1.8, peekOff: [3, -3, 5.5, -5.5, 8, -8], peekHold: 3.2, peekR: 0.9 },
  nade: { minD: 8, maxD: 20, cdE: [11, 17], cdA: [12, 18], liveE: 3, liveA: 3, gapE: 1.4, gapA: 1.0, fromStage: 2, iqMin: 0.3,
          R: 4.4, dmgE: 30, dmgA: 46, fuseGround: 0.75, err: [0.8, 2.6], flee: 6.8, warnT: 2.4, score: 1.5 },
  smoke: { R: 5.2, life: 10, ahead: 6.5, cdE: 24, cdA: 22, spreadMul: 2.6, puffEvery: 0.32 },
  form: { moveV: 2.5, file: 4.2, file2: 2.6, rowGap: 3.2, lead: 0.55, ringR: 7.5, ringR2: 1.6 },
  target: { coverMul: 1.35, proneMul: 1.18 },
};
export const INFANTRY = {
  rifle:{ hp:18, speed:4.4, keep:15, range:24, fireCd:1.5, dmg:4, bspeed:50, score:60 },
  rpg:  { hp:24, speed:3.8, keep:20, range:30, fireCd:5.0, aimT:1.0, dmg:22, rspeed:26, aoe:3.0, score:110 },
  squad:{ fromWave:2, base:0.6, perWave:0.3, perStage:0.4, size:[4,6], rpgFrom:2, maxOnField:22, maxMobile:14 },   // Z104 more men on the wider field
  bail:0.7,   // Z113 a tank rolling over a man at any real speed kills him (was 3.5)
  fling:{ speed:13, up:8.5, gib:1.0, maxK:1.7, tearK:1.9 },   // Z121 a direct tank round (or the core of a blast, hitK ≥ tearK) TEARS the man apart instead  // Z112 killed by a heavy round / blast: thrown away from the hit (speed, lift m/s), breaks apart ~0.75 s later and is gone
                       // Z111b small-arms rounds (riflemen, tower / wall guards, MG nests) do 30% to a tank's armour; RPG rockets keep full damage
  coverThreat: 20, coverSearch: 12,   // Z104 a rifleman who sees a tank this close runs for the far side of the nearest cover
};
// NEW ENEMY VEHICLES (Z80). unlock = first stage it appears; weight = [base, +per stage after unlock] in the wave mix.
export const ROSTER = {
  atgm:    { aimT:1.2, speed:21, turn:1.5, dmg:30, aoe:3.2, life:5.5, cd:6.5 },   // laser-painted wire-guided missile: shoot it down, dodge sharply, or pop SMOKE
  gunship: { alt:8.5, orbit:19, speed:9, range:34, gunDmg:3, gunCd:0.13, burst:9, burstCd:3.4, salvo:2, salvoCd:5, rocketDmg:12, rocketSpeed:28, flareDecoy:0.45 },   // Z198 flares pull a locked missile off 45% of the time
  launcher:{ salvo:4, gap:0.22, speed:24, dmg:22, aoe:3.2, spread:2.4 },   // Z116 ROCKET TRUCK: lobs a 4-rocket salvo from long range (weak armour, high value)
};
// ============================================================================
// CAMPAIGN OPERATIONS (Z83) — every stage is a named operation: briefing, radio chatter, scripted waves and a
// high-value OBJECTIVE. While the objective stands it buffs the enemy (mods); destroying it pays a bounty + 1 diamond.
//   script = { wave: event }   events: ambush (squads drop in close) · column (an infantry column from one edge) · airraid
// ============================================================================
export const OPERATIONS = [   // STORY 1 one story across the five (texts name the cast by key — STORY below; campaign/story.js storyOp fills them)
  { title:'CHIẾN DỊCH BÃO CÁT', code:'SANDSTORM', obj:'depot', script:{ 2:'ambush', 4:'column' },
    story:'Rạng sáng, {foe} vượt biên dưới màn bão cát; tiền đồn {us} chỉ còn một {core} và tổ {squad} của anh. Giữa tiếng gió, {cmd} nhận ra điều lạ: địch không nã pháo vào {core} — chúng đang tìm cách tới thật gần nó.',
    brief:'Giữ {core} bằng mọi giá và đốt kho nhiên liệu đang tiếp sức cho trực thăng, viện binh của địch. Rồi tìm {boss} mà hạ.',
    radio:{ 1:'{cmd} gọi {squad}: bộ binh địch sau đồi cát. Giữ {core}, bắn chắc tay.', 2:'Phục kích! Chúng trồi lên từ cát, sát ngay {core}!', 3:'Chúng không đặt bộc phá. Chúng muốn lấy {core} nguyên vẹn — chặn lại!', 4:'Một đoàn bộ binh đang kéo vào từ một hướng — bắn chặn đầu!', 5:'Đợt cuối trước khi {boss} ra mặt. Giữ vững!' },
    win:'Kho nhiên liệu cháy rồi — hết xăng, chúng khỏi chở {core} đi đâu!' },
  { title:'CHIẾN DỊCH THÀNH PHỐ ĐỔ NÁT', code:'BROKEN CITY', obj:'radio', script:{ 2:'ambush', 4:'column' },
    story:'{cmd} không ngồi chờ lần cướp thứ hai: tổ {squad} mang theo {core}, bám đường rút của {foe} vào thành phố đổ nát. Giữa đống gạch, một trạm tiếp sóng vẫn đều đặn phát đi vị trí của ta, và {boss} đang đọc từng dòng. {scout} đi trước dò đường, như mọi lần.',
    brief:'Bịt miệng trạm tiếp sóng đang gọi viện binh, dọn sạch các con phố và giữ {core} sống.',
    radio:{ 1:'Có chuyển động trong đống gạch vụn. Đi chậm, soát từng ô cửa.', 2:'Phục kích! Chúng nằm chờ đúng lối ta vào!', 3:'Bắt được sóng địch: {boss} đang dẫn cận vệ tới.', 4:'Một đoàn bộ binh, có tổ B41 trong hẻm — coi chừng rocket!', 5:'Đợt cuối! Trạm tiếp sóng còn phát thì hạ nó ngay!' },
    win:'Trạm tiếp sóng đã sập — kẻ đưa tin cho chúng phải tìm đường khác.' },
  { title:'CHIẾN DỊCH IM LẶNG TRẮNG', code:'WHITE SILENCE', obj:'radar', script:{ 3:'airraid', 5:'column' },
    story:'Tín hiệu cuối của {g2} dẫn lên vùng băng, nơi {boss} gác một trạm radar dẫn đường cho trực thăng. Tổ {squad} xuất phát lúc ba giờ sáng, không báo ai ngoài sở chỉ huy — vậy mà trên băng, địch đã nằm chờ sẵn. Có người đang bán từng bước chân của ta.',
    brief:'Phá trạm radar để giành lại bầu trời và giữ {core} qua bão tuyết. Coi chừng trực thăng và lính dù.',
    radio:{ 1:'Tầm nhìn kém. Bám sát nhau, bắn theo ánh lửa đầu nòng.', 2:'Băng nứt khắp nơi — đừng để bị dồn vào góc.', 3:'Tiếng cánh quạt — trực thăng vũ trang!', 4:'Lính dù đang thả xuống sườn băng!', 5:'Đợt cuối: cả một đoàn bộ binh vượt băng. Chặn chúng trước {core}!' },
    win:'Radar thành sắt vụn. Bầu trời lại là của ta.' },
  { title:'CHIẾN DỊCH LÒ LỬA THÉP', code:'IRON FURNACE', obj:'battery', script:{ 2:'column', 4:'airraid' },
    story:'Bản đồ trong áo {g3} chỉ về khu lò luyện: trận địa pháo của {boss}, kẻ chưa bao giờ cần bắn phát thứ hai. Giữa tiếng búa máy, một làn sóng yếu ớt gọi tên tổ {squad} — kèm tiếng huýt sáo mà cả tổ đều nhận ra.',
    brief:'Đánh sập trận địa pháo đang yểm trợ bộ binh địch. Luôn di chuyển, giữ {core}, đừng đứng yên cho chúng ngắm.',
    radio:{ 1:'Pháo địch đang yểm trợ — di chuyển liên tục!', 2:'Cả một đoàn bộ binh tràn ra từ các xưởng lò!', 3:'{boss} rất khó lường. Đừng đứng yên một chỗ.', 4:'Không kích! Tìm chỗ nấp!', 5:'Đợt cuối! Xạ thủ trên sườn đồi — nấp sau gạch đá mà tiến!' },
    win:'Trận địa pháo đã câm. Hết pháo che, chúng chỉ còn lò lửa sau lưng.' },
  { title:'CHIẾN DỊCH THÀNH LUỸ CUỐI', code:'LAST CITADEL', obj:'command', script:{ 1:'ambush', 3:'airraid', 5:'column' },
    story:'Thành Luỹ Cuối sống nhờ một {core} sắp tắt; {boss} — thầy cũ của {cmd}, người vẽ nên {core} đầu tiên — cần {core} của ta để thắp lại nó. {intel} ngồi lại bàn máy, gửi cho địch bức điện cuối: một toạ độ sai. Khi cận vệ của {boss} lao về hướng đó, tổ {squad} có đúng một cơ hội.',
    brief:'Phá hầm chỉ huy, hạ {boss}, và đừng để {core} rơi vào tay hắn. Chiến tranh kết thúc ở đây.',
    radio:{ 1:'Phục kích! Chúng vẫn còn người nằm chờ!', 2:'Giữ {core}. Bằng mọi giá. Hắn chỉ cần đúng thứ đó.', 3:'Không kích! Toàn bộ máy bay của chúng đã cất cánh!', 4:'{squad}, cả {us} đang nghe các anh trên sóng này.', 5:'Đợt cuối của chúng. Chính là lúc này.' },
    win:'Hầm chỉ huy sập rồi — phòng tuyến {foe} đang tan vỡ!' },
];
export const OBJECTIVES = {
  depot:  { name:'FUEL DEPOT', vi:'KHO NHIÊN LIỆU', effectVi:'Trực thăng & viện binh tới nhanh hơn 15%', hp:260, r:6.2, effect:'Reinforcements arrive 15% faster', mods:{ cadenceMul:0.85 } },
  radio:  { name:'RADIO RELAY', vi:'TRẠM TIẾP SÓNG', effectVi:'Viện binh tới nhanh hơn 25%',       hp:220, r:3.6, effect:'Reinforcements arrive 25% faster',      mods:{ cadenceMul:0.75 } },
  radar:  { name:'RADAR SITE', vi:'TRẠM RADAR', effectVi:'Mỗi đợt có thêm một trực thăng',        hp:260, r:4.8, effect:'A gunship joins every wave',            mods:{ gunshipPerWave:1 } },
  battery:{ name:'ARTILLERY BATTERY', vi:'TRẬN ĐỊA PHÁO', effectVi:'Pháo yểm trợ: địch gây thêm 10% sát thương', hp:320, r:6.8, effect:'Enemies deal 10% more damage', mods:{ enemyDmgMul:1.1 } },
  command:{ name:'COMMAND BUNKER', vi:'HẦM CHỈ HUY', effectVi:'Địch gây thêm 15% sát thương',    hp:440, r:6.6, effect:'Enemies deal 15% more damage',          mods:{ enemyDmgMul:1.15 } },
};
export const OBJ_REWARD = { score:1500 };
// ============================================================================
// THE CAMPAIGN'S STORY (STORY 1–3, campaign/story.js) — one story across the five operations, a named cast, and a radio that follows the fight.
//   NAMES ARE WRITTEN ONCE: every text (here and in OPERATIONS) names people by key — {cmd} {squad} {mg} {medic} {at} {scout} {intel} {us} {foe} {core}
//     → cast[key].name · {boss} = this stage's general, {g1}…{g5} = the five original generals (data/bosses.js) · {name} = the squad-mate a cue is about.
//   cast: tag = the net shown in the radio's header ("<TAG>: text") · field: a mate who stands on the field with the player — the squad's first man of
//     that role carries the name (actors/squad-mates.js), and his lines are said only while he is on his feet · trait: how he talks.
//   THE ARC — act I (stage 1) a holding action: the enemy is not after ground, it wants our Core intact, and somebody drew them our vault · act II
//     (stages 2–3) the pursuit: the scout goes missing after a "cleared" alley, the enemy knows our hour of departure, the squad suspects the scout ·
//     act III (stage 4) the reversal: the scout is alive and names the leak — the intelligence officer whose every message ends "xác nhận", whose family
//     the enemy holds; the commander turns the leak round · (stage 5) the last citadel: the leak's last false message opens the way and costs him his life.
//   generals: a one-line dossier by general id (the briefing) · heir: the dossier of a man who carries an original's name on an NG+ loop.
//   stages[i]: act (index into acts) · prev: the briefing's "previously" · loop: the framing on NG+ loops (it replaces prev and the story paragraph) ·
//     epi: the two lines over the rewards when the stage is won (loopEpi on NG+ loops) · beats: the plot on the radio by wave ('who|text', first time
//     through only) — each waits its turn: beat.first s after the wave begins, beat.next s apart, dropped after beat.hold s.
//   lines[event]: p = priority — 4 said at once (it replaces a line the game says at that instant) · 3 must be heard: queued until the radio has been
//     quiet gapMust s (given up after hold s) · 2 a danger call: said if the radio has been quiet gapDanger s, else dropped · 1 flavour: quiet gap s,
//     else dropped · cd: s between two of that event · max: a stage · first: only the first time through the campaign · q: queue it (not before q s).
//     t: the variants ('who|text'; none = the commander), one picked at random among the voices on the net, never the same twice running. An event
//     with a sub-key (a general's id, a named mate's role) uses lines[event_sub] when there is one.
//   gap / gapDanger / gapMust: s of radio silence a line needs · queueMax: lines waiting at most · tick: s between two looks at the player's state ·
//     hp: nearly dead under low, back on his feet over back · mate: wounded under hurt, mended over ok · streak: n enemies down inside t s within r m ·
//     maxLen: a radio line's longest (the teleprinter box; test.js) · noVoice: the voice key that keeps a line text-only (audio/voice.js speaks none).
// ============================================================================
export const STORY = { on:true, gap:12, gapDanger:6, gapMust:4.6, hold:40, queueMax:6, tick:0.5, maxLen:90, noVoice:'text',
  beat:{ first:9, next:14, hold:80 }, hp:{ low:0.3, back:0.6 }, mate:{ hurt:0.35, ok:0.6 }, streak:{ n:5, t:8, r:60 },
  cast:{
    cmd:   { name:'Đại Bàng', tag:'SCH', role:'chỉ huy', trait:'không bao giờ cao giọng; học trò cũ của vị tướng cuối cùng' },
    squad: { name:'Xung Kích', role:'tổ của người chơi' }, us:{ name:'Sao Đỏ' }, core:{ name:'Lõi' },
    mg:    { name:'Hùng', tag:'HÙNG', role:'mg', hud:'ĐL', field:true, trait:'to mồm, đùa cay, đếm từng băng đạn' },
    medic: { name:'Lan', tag:'LAN', role:'medic', hud:'YT', field:true, trait:'điềm tĩnh, hay mắng, không bỏ ai lại' },
    at:    { name:'Sơn', tag:'SƠN', role:'at', hud:'B41', field:true, trait:'trẻ nhất tổ, hăng, hay viết thư về nhà' },
    scout: { name:'Minh', tag:'MINH', role:'rifle', hud:'BB', trait:'trinh sát đi đầu, ít lời, hay huýt sáo' },
    intel: { name:'Khang', tag:'TÌNH BÁO', role:'sĩ quan tình báo', trait:'mười năm bên chỉ huy; câu nào cũng chốt "xác nhận"' },
    foe:   { name:'Hắc Thiết', tag:'SÓNG ĐỊCH', role:'điện đài địch bị nghe trộm' } },
  generals:{
    bull:'Chưa từng lùi một bước, chưa từng đọc hết một mệnh lệnh. Thua {cmd} ba ván cờ, lần nào cũng lật bàn.',
    tempest:'Đánh nhanh, rút nhanh, không ngủ hai đêm một chỗ. Sợ nhất bị vây: {cmd} từng vây hắn chín ngày.',
    goliath:'Mười năm gác băng, đêm nào cũng tự cầm đèn đi tuần. Từng cõng {cmd} qua đèo tuyết, hồi còn chung màu áo.',
    reaper:'Không bao giờ bắn phát thứ hai. Có thói gửi ảnh cho gia đình kẻ hắn săn. {cmd} mất cả một tổ trinh sát vì hắn.',
    overlord:'Thầy cũ của {cmd}, người vẽ nên {core} đầu tiên. Sợ bóng tối từ ngày thành của hắn bắt đầu mất điện.',
    inferno:'Em ruột {g1}, đến đòi nợ máu cho anh. Thứ gì anh hắn không giữ nổi, hắn đốt.',
    serpent:'Phó tướng cũ của {g3}. Kiên nhẫn như băng: chờ con mồi mỏi rồi mới siết.',
    thunder:'Học trò của {g4}, nóng hơn thầy: bắn trước, ngắm sau, ghét phải chờ.' },
  heir:'Kẻ kế vị mang danh {boss}. Hồ sơ còn trống — chỉ biết hắn đến để rửa hận.',
  acts:['Hồi I · Giữ chốt', 'Hồi II · Truy kích', 'Hồi III · Lật ngược'],
  stages:[
    { act:0, prev:'Rạng sáng nay chiến tranh bắt đầu. Chưa ai hiểu vì sao.',
      loop:'{boss} dựng lại cờ {foe} và kéo quân về đúng bãi cát cũ. Chiến tranh chưa xong.',
      epi:['{g1} ngã trên cát. Trong túi áo hắn: sơ đồ hầm {core} và giờ đổi gác của ta.', 'Nét mực còn mới. Có ai đó vừa vẽ nó cho hắn.'],
      beats:{ 1:['intel|Sau đồi cát chỉ có tốp thăm dò. Sườn phải sạch. Xác nhận.'], 2:['mg|Sạch cái gì mà sạch! Tình báo ngủ gật à?'],
        3:['foe|…lấy {core} nguyên vẹn. Nhắc lại: nguyên vẹn. {g5} cần nó còn sống.'], 4:['scout|Chúng mang cáng thép, không mang bộc phá. Tôi bám theo xem chúng đi đâu.'],
        5:['at|Giữ được {core} là em viết thư kể cho mẹ ngay. Mà phải giữ được đã!'] } },
    { act:1, prev:'Trước đó: {g1} ngã ở Bão Cát, trong túi là sơ đồ hầm {core} do người phe ta vẽ.',
      loop:'Một kẻ khác đã nhận danh hiệu {boss}. Trạm tiếp sóng dựng lại giữa đống gạch cũ.',
      epi:['{g2} gục giữa phố. {scout} vẫn không trả lời — trong hẻm bắc chỉ còn chiếc mũ sắt của cậu.', 'Bức điện cuối của trạm tiếp sóng: "Nguồn tin xác nhận." Người của ta, trên sóng của ta.'],
      beats:{ 1:['intel|Hẻm phía bắc đã quét sạch. Cho trinh sát vào trước đi. Xác nhận.'],
        2:['scout|Hẻm bắc có người! Không sạch — chúng nằm chờ s…', '{scout}, trả lời đi! … Mất liên lạc với {scout}. Cả tổ, đánh tiếp.'],
        3:['at|Anh {scout} hứa dạy em huýt sáo. Anh ấy đã dạy xong đâu…'], 4:['foe|Nguồn tin vẫn đều. Toạ độ tổ xung kích: đã nhận.'],
        5:['mg|Chúng biết lối ta vào trước cả ta. Ai mách chúng?'] } },
    { act:1, prev:'Trước đó: {scout} mất tích trong thành phố. Địch biết trước từng bước của ta.',
      loop:'{boss} lên gác băng thay người đã ngã. Radar mới, trực thăng mới, cái lạnh vẫn cũ.',
      epi:['{g3} nằm lại trên băng, tay vẫn nắm chiếc đèn đi tuần.', '{scout} mất tích trước khi có giờ xuất phát — cậu không thể là kẻ đưa tin. Kẻ đó vẫn ngồi trên sóng.'],
      beats:{ 1:['foe|Nguồn tin báo: chúng rời trại lúc ba giờ. Đúng từng phút.'],
        2:['mg|Thằng {scout} khai rồi! Không nó thì ai biết đường mình đi?', 'medic|{scout} mất tích trước khi có giờ xuất phát. Không phải cậu ấy, {mg}.'],
        4:['intel|Đừng nghi nhau giữa trận. Tôi sẽ rà lại đường dây. Xác nhận.'], 5:['Giờ xuất phát chỉ ba người biết. Tôi là một. Xong trận ta nói tiếp.'] } },
    { act:2, prev:'Trước đó: {g3} ngã trên băng. Kẻ đưa tin chưa lộ mặt, {scout} vẫn chưa về.',
      loop:'Lò luyện đỏ lửa trở lại dưới tay {boss}. Pháo của chúng đã kịp đúc nòng mới.',
      epi:['{g4} ngã cạnh xấp ảnh chưa kịp gửi. {scout} được cáng ra khỏi lò, vẫn huýt sáo.', '{intel} nộp súng. {cmd} không còng tay anh — chỉ đẩy lại chiếc máy điện đài.'],
      beats:{ 1:['scout|{squad}… {scout} đây. Còn sống. Tôi nằm trong lò, nghe hết sóng của chúng.'],
        2:['scout|Kẻ đưa tin dùng mã của Tình Báo. Câu chốt lúc nào cũng là: "xác nhận".'],
        3:['{intel}… mười năm. Vì sao?', 'intel|Chúng giữ vợ con tôi, thủ trưởng. Mỗi tuần {g4} gửi cho tôi một tấm ảnh.'],
        4:['{intel}, gửi tiếp đi. Lần này toạ độ do tôi đọc.', 'foe|Nguồn tin xác nhận toạ độ mới. Pháo, bắn!'],
        5:['mg|Pháo chúng nã vào đầu chúng kìa! {scout} ơi, tao xin lỗi mày!'] } },
    { act:2, prev:'Trước đó: {intel} lộ mặt, {scout} còn sống, pháo địch đã câm. Chỉ còn {g5}.',
      loop:'Kẻ kế vị khoác áo {boss} và thắp lại Thành Luỹ Cuối. Chiến tranh chưa chịu dừng.',
      epi:['{g5} ngã, Thành Luỹ Cuối tắt đèn. Chiến tranh dừng lại hôm nay.', 'Dưới hầm, vợ con {intel} còn sống. Sóng của anh thì đã tắt từ rạng sáng.'],
      beats:{ 1:['foe|Nguồn tin xác nhận: chúng đánh cổng đông. Dồn hết cận vệ sang đông!'],
        2:['intel|Chúng tin rồi, thủ trưởng. Cổng tây bỏ trống. Lần cuối tôi nói: xác nhận.'], 3:['at|Thư về nhà em viết xong rồi. Hết trận em gửi. Nhất định gửi.'],
        4:['foe|Nguồn tin nói dối! Tìm nó! Cắt sóng nó ngay!'], 5:['{intel}? {intel}, trả lời… Mất sóng rồi. {squad} — làm cho xong.'] } } ],
  loopEpi:['{boss} ngã, nhưng {foe} vẫn còn kẻ kế vị.', 'Tổ {squad} lau súng, đếm lại quân số, rồi đi tiếp.'],
  lines:{
    // the director's phases (campaign/director.js dirSay → 'dir_' + its key; its `must` lines are said at once)
    dir_lull:{ p:1, t:['Tạm lắng — nạp đạn đi!', 'Chúng chững lại rồi — thay băng đạn, băng bó nhanh!', 'Địch nằm im — tranh thủ nạp đạn, đổi vị trí!', 'medic|Lặng rồi. Ai dính đạn thì lên tiếng — nhanh!', 'mg|Chúng thở thì mình cũng thở. Thay băng!', 'at|Em đếm lại đạn đây. Anh uống ngụm nước đi.'] },
    dir_drop:{ p:2, t:['Anh sắp gục rồi — dù cứu thương và đạn rơi ngay trước mặt, ra lấy!', 'Thả dù tiếp tế cho anh đấy: túi cứu thương trước, đạn sau!', 'medic|Dù tiếp tế kìa! Lấy túi cứu thương ngay, tôi bắn che!'] },
    dir_peak:{ p:2, t:['Chúng dồn lên rồi — bám công sự, giữ vững!', 'Hoả lực địch rất mạnh — đừng đứng một chỗ!', 'mg|Đông quá! Băng này chưa hết, lũ khác đã tới!', 'at|Chúng lên cả đàn! Em nạp không kịp bắn!', 'medic|Cúi thấp xuống! Tôi không vá kịp cả tổ đâu!'] },
    dir_build:{ p:1, t:['Chúng lại lên — vào vị trí!', 'Hết lặng rồi — địch đang áp sát!', 'mg|Hết giờ nghỉ. Khách tới!', 'at|Chúng quay lại kìa anh! Em sẵn sàng rồi!'] },
    dir_hunt:{ p:2, t:['Địch đã lần ra chỗ anh — chúng đang kéo tới!', 'Chúng biết anh ở đâu rồi — coi chừng các hướng!', 'mg|Lại biết chỗ mình rồi! Có ma dẫn đường cho chúng à?', 'medic|Chúng đi thẳng tới đây. Như có người chỉ lối vậy.'] },
    dir_left:{ p:2, t:['Chúng đang vòng sườn trái!', 'Một tốp tách ra, bò sang trái anh — chặn lại!', 'mg|Sườn trái! Chúng bò sang trái kìa!', 'at|Bên trái, anh ơi! Bên trái!'] },
    dir_right:{ p:2, t:['Chúng đang vòng sườn phải!', 'Một tốp tách ra, bò sang phải anh — chặn lại!', 'mg|Sườn phải! Chúng bò sang phải kìa!', 'at|Bên phải, anh ơi! Bên phải!'] },
    dir_rear:{ p:2, t:['Địch vòng ra sau lưng — quay lại!', 'medic|Sau lưng! Chúng ở ngay sau lưng ta!', 'mg|Đằng sau! Quay súng lại!'] },
    dir_finale:{ p:3, t:['Trận địa lặng rồi — tướng địch sắp ra trận. Nạp đạn, băng bó, chuẩn bị!', 'Lính thường rút hết rồi. Kẻ sắp ra là {boss} — nạp đạn, sẵn sàng!'] },
    // the enemy's tactics (ai/tiers.js, ai/squads.js)
    marksman:{ p:4, t:['Có xạ thủ bắn tỉa — thấy ánh kính loé lên là lăn đi ngay!', 'mg|Bắn tỉa! Kính nó loé kìa — cúi xuống!', 'medic|Ánh kính bên kia! Đừng ló đầu — phát đó tôi không vá nổi đâu.'] },
    mg:{ p:4, t:['Đại liên địch bắn kiềm chế — đừng đứng ngoài trống, vòng vào sườn nó!', 'mg|Đại liên chúng lên tiếng rồi. Để tôi đáp lời — anh vòng sườn đi!', 'at|Đại liên! Ghìm đầu nó cho em, em thổi một quả B41!'] },
    nade:{ p:2, cd:10, t:['Lựu đạn — rời vị trí ngay!', 'mg|Lựu đạn dưới chân — lăn đi!', 'at|Lựu đạn! Chạy khỏi chỗ đó, anh ơi!'] },
    surrender:{ p:1, cd:40, t:['Hắn buông súng rồi — đừng bắn người đầu hàng.', 'medic|Nó giơ tay rồi. Để nó đi.', 'mg|Một thằng biết điều. Hiếm đấy.'] },
    enemy_break:{ p:1, cd:45, t:['Tốp địch vỡ rồi, đang lùi về công sự — ép tiếp!', 'mg|Chúng chạy rồi! Bám theo, đừng cho chúng gom lại!', 'at|Chúng rút kìa! Mình thắng tốp này rồi anh ơi!'] },
    // the player's own state (campaign/story.js storyTick, actors/damage.js)
    first_kill:{ p:1, max:1, t:['Phát đầu trúng đích. Cứ thế mà đánh.', 'mg|Thằng đầu tiên! Mở hàng rồi đấy!', 'at|Trúng rồi! Anh bắn đẹp quá!'] },
    streak:{ p:1, cd:50, max:3, t:['Chúng đang vỡ đội hình. Đánh tiếp, đừng cho chúng gom lại!', 'mg|Một hơi cả tốp! Để phần tôi với chứ!', 'at|Anh chậm thôi, em đếm không kịp!', 'medic|Bắn hay lắm. Cứ thế thì tôi đỡ phải vá ai.'] },
    hurt:{ p:2, cd:35, max:3, t:['{squad}, anh sắp gục. Rút vào chỗ nấp, ngay!', 'medic|Anh trúng đạn rồi! Nằm xuống, tôi tới ngay!', 'medic|Máu ra nhiều quá — lùi sau công sự, chờ tôi!', 'mg|Tổ trưởng dính đạn! Tôi bắn che, lùi lại đi!'] },
    recovered:{ p:1, cd:60, max:2, t:['Tốt. Còn thở là còn đánh.', 'medic|Đứng được rồi đấy. Lần sau đừng lấy thân đỡ đạn.', 'mg|Tưởng mất anh rồi chứ. Vào hàng đi, tổ trưởng!'] },
    dry:{ p:1, cd:60, max:2, t:['mg|Thay băng đi, tôi ghìm chúng cho!', 'at|Anh hết đạn à? Em che cho, thay nhanh!'] },
    // the squad (actors/squad-mates.js): wounded, down, back from the rear, patched up
    mate_hurt:{ p:1, cd:40, t:['{name} bị thương — bắn che cho đồng đội lùi về sau!', 'medic|{name} dính đạn! Nằm yên đó, tôi tới!'] },
    mate_hurt_mg:{ p:1, cd:40, t:['mg|Dính một phát! Không sao, vẫn bóp cò được!', 'medic|{mg} trúng đạn rồi! Ngồi im cho tôi băng, đừng cãi!'] },
    mate_hurt_medic:{ p:1, cd:40, t:['medic|Tôi dính đạn… vẫn băng được. Lo cho các anh trước.', 'mg|{medic} bị thương! Ai băng cho người băng bó bây giờ?!'] },
    mate_hurt_at:{ p:1, cd:40, t:['at|Em bị bắn rồi! Chị {medic} ơi!', 'medic|{at} trúng đạn! Thằng bé còn tỉnh — bắn che cho tôi!'] },
    mate_down:{ p:2, cd:8, t:['{name} trúng đạn, đã đưa về tuyến sau — đợt tới sẽ quay lại.', 'medic|{name} gục rồi! Tôi kéo về sau — giữ lấy chỗ này!', 'mg|{name} ngã rồi! Bắn che cho cáng thương!'] },
    mate_down_mg:{ p:2, t:['{mg} trúng đạn, đã về tuyến sau. Thiếu đại liên — bám công sự mà đánh.', 'medic|{mg} ngã rồi! Cái mồm đó mà im là tôi sợ đấy — cõng về sau!', 'at|Anh {mg}! Anh ấy còn thở… để em giữ khẩu đại liên!'] },
    mate_down_medic:{ p:2, t:['{medic} bị thương, đã về tuyến sau. Tự băng bó lấy, đánh cẩn thận hơn.', 'mg|{medic} trúng đạn! Từ giờ cấm ai bị thương nữa, nghe chưa!', 'at|Chị {medic}! Ai giúp chị ấy với!'] },
    mate_down_at:{ p:2, t:['{at} trúng đạn, đã về tuyến sau. Hết B41 — coi chừng máy bay.', 'medic|{at}! Thằng bé còn thở. Đưa nó về sau, nhanh!', 'mg|Thằng nhóc dính đạn rồi! Đứa nào bắn nó, tao tính sổ!'] },
    mate_back:{ p:1, q:2, t:['Tổ của anh đủ quân số trở lại — {name} đã về hàng.', 'medic|{name} về rồi. Vết thương tôi khâu đấy, đừng làm bung chỉ.'] },
    mate_back_mg:{ p:1, q:2, t:['{mg} đã trở lại vị trí. Đại liên lại lên tiếng.', 'mg|Tôi về rồi đây! Chưa chết được — còn nợ {medic} một lời cảm ơn.'] },
    mate_back_medic:{ p:1, q:2, t:['{medic} đã trở lại. Tổ có y tá rồi — nhưng đừng ỷ lại.', 'medic|Tôi quay lại rồi. Lúc tôi vắng có ai làm liều không đấy?'] },
    mate_back_at:{ p:1, q:2, t:['{at} đã trở lại, B41 trên vai. Tổ đủ quân số.', 'at|Em về rồi! Chị {medic} bảo em mạng lớn lắm!'] },
    mate_saved:{ p:1, cd:45, t:['medic|{name} ổn rồi. Đứng dậy, bắn tiếp!', 'medic|Vá xong cho {name}. Người tiếp theo làm ơn đừng là tổ trưởng.'] },
    patched:{ p:1, cd:60, t:['medic|Băng xong. Đừng làm tôi tốn thêm cuộn nào nữa.', 'medic|Xong rồi đấy. Đau thì kêu, đừng có gồng.', 'medic|Cầm máu rồi. Anh mà gục là cả tổ gục theo, nhớ lấy.'] },
    // the stage's general (campaign/general-duel.js): he takes the field · he calls more guards at half health · he goes for broke · he is down
    general:{ p:3, t:['{boss} ra trận rồi. Bám công sự, bắn khi hắn thay đạn.', 'mg|{boss} kìa! Tướng thì cũng chỉ có một mạng thôi!'] },
    general_bull:{ p:3, first:1, t:['{boss} không biết lùi. Cứ để hắn lao tới rồi bắn.', 'mg|{boss} kìa! To thế kia thì khó mà bắn trượt!'] },
    general_tempest:{ p:3, first:1, t:['{boss} ghét bị vây. Ép hắn vào góc, đừng cho hắn chạy.', 'at|Hắn nhanh quá! Anh ghìm chân hắn, em vòng ra sau!'] },
    general_goliath:{ p:3, first:1, t:['{boss} đấy. Ngày xưa ông ấy cõng tôi qua đèo… Hôm nay thì bắn đi.', 'medic|Ông ta to thật. Nhưng to mấy thì cũng chảy máu.'] },
    general_reaper:{ p:3, first:1, t:['{boss} không bắn phát thứ hai. Đừng cho hắn bắn phát thứ nhất.', 'mg|Thằng gửi ảnh cho vợ con người ta đây à? Để nó cho tôi!'] },
    general_overlord:{ p:3, first:1, t:['Thầy… Hôm nay học trò đến trả bài. {squad}, nổ súng.', 'at|Kia là {boss}… Hạ được hắn là em gửi được thư rồi!'] },
    general_inferno:{ p:3, t:['{boss} — em ruột {g1}. Hắn đến đòi nợ máu, đừng để lửa của hắn chạm tới anh.'] },
    general_serpent:{ p:3, t:['{boss} chờ ta mỏi rồi mới siết. Đừng cho hắn thời gian.'] },
    general_thunder:{ p:3, t:['{boss} nóng hơn cả thầy hắn. Dụ hắn bắn hụt rồi áp sát.'] },
    general_half:{ p:3, t:['Hắn gọi thêm cận vệ — nghĩa là hắn đang núng. Đánh tiếp!', 'mg|Gọi thêm người à? Tức là run rồi đấy!', 'medic|Cận vệ ra thêm! Đừng để bị kẹp giữa hai tốp!'] },
    general_rage:{ p:4, t:['boss|Ta chưa thua đâu!', 'boss|Chưa xong đâu! Cận vệ, theo ta!'] },
    general_rage_bull:{ p:4, first:1, t:['boss|Lùi à? Cả đời ta chưa học chữ đó!'] },
    general_rage_tempest:{ p:4, first:1, t:['boss|Không ai vây được ta lần thứ hai! Không ai!'] },
    general_rage_goliath:{ p:4, first:1, t:['boss|{cmd}… ngày đó lẽ ra ta nên để ngươi lại trên đèo!'] },
    general_rage_reaper:{ p:4, first:1, t:['boss|Ta chưa từng cần phát thứ hai. Hôm nay ta bắn cả băng!'] },
    general_rage_overlord:{ p:4, first:1, t:['boss|{cmd}! Trò đâu biết bóng tối lạnh đến mức nào!'] },
    general_down:{ p:4, t:['{boss} đã gục! Cận vệ tan rã — trận này là của anh!'] },
    general_down_bull:{ p:4, first:1, t:['{boss} gục rồi. Ván này hắn hết lật bàn.'] },
    general_down_tempest:{ p:4, first:1, t:['{boss} hết đường chạy rồi. Làm tốt lắm, {squad}.'] },
    general_down_goliath:{ p:4, first:1, t:['{boss} ngã rồi… Yên nghỉ, bạn cũ. Làm tốt lắm, {squad}.'] },
    general_down_reaper:{ p:4, first:1, t:['{boss} đã gục. Hắn không kịp bắn phát thứ hai.'] },
    general_down_overlord:{ p:4, first:1, t:['Thầy ngã rồi. Tắt đèn đi, thầy… {squad}, hết chiến tranh rồi.'] } } };
// EQUIPMENT (Z82) — tank-mounted support kit on the SPELL wheel. Each is a counter to a specific threat.
export const EQUIP = {
  smoke:{ dur:10, radius:9, spreadMul:4.5, sightK:0.8 },       // smoke grenades: enemy aim ×spreadMul, guided missiles lose lock
  aps:  { dur:12, charges:4, radius:7 },          // active protection (hard-kill): shoots down rockets/missiles/shells in radius
  mines:{ count:3, dmg:90, radius:4.2, arm:0.8, life:45 },   // anti-tank mines dropped behind the tank
};
// enemy toughness grows with the campaign so later stages stay a fight even as the arsenal grows
export const RAMP = { hpPerStage:0.14 };
// battlefield conditions — the same gun performs differently depending on WHERE and WHEN you fight
export const ENV = {
  night:  { range:0.85, enemySpread:1.3 },   // short sight lines; enemies shoot worse too
  hot:    { biomes:['DESERT','FOUNDRY','SAVANNA','VOLCANO'], hours:['noon'], fire:1.25 },   // heat: fires rage
  cold:   { biomes:['TUNDRA','ARCTIC'], fire:0.75 },                  // frost: flames gutter
  urban:  { biomes:['RUINS','CITADEL','CITY','STEELMILL'], he:1.2 },                                  // rubble & walls: blast and splinters wreck more
};
// ----- shop: leveled stat upgrades (L1-L3 coins, L4-L5 diamonds = VIP) -----

// ----- gun unlocks. T1/T2/T3 in coins; railgun & rocket are VIP (diamonds only, never gifted in battle).
// VIP coin-equiv (28◆=5,600 / 34◆=6,800) sits ABOVE the best T3 coin gun (5,500) — value stays ordered. -----

// ----- punchy marketing blurbs (kept short) -----
// ----- STAGE CONTRACTS: pre-stage strategic choice (pick 1 of 3 each stage; applies for that stage only).
// mods are read live at use-sites via cMod() — pure data, no runtime coupling. Every contract is a risk/reward. -----
export const CONTRACTS = [
  { id:'steady',  name:'Tiến chắc',      icon:'shield', tag:'An toàn',   desc:'Trận bình thường, không thêm rủi ro',               mods:{} },
  { id:'glass',   name:'Pháo thuỷ tinh', icon:'burst',  tag:'Rủi ro cao', desc:'Bạn +40% sát thương, địch +30% sát thương',           mods:{ playerDmgMul:1.4, enemyDmgMul:1.3 } },
  { id:'elite',   name:'Săn tinh nhuệ',  icon:'shell',  tag:'Tinh nhuệ', desc:'Mỗi đợt một lính tinh nhuệ, +50% đồ rơi, địch +10% máu',  mods:{ eliteEveryWave:true, lootChanceMul:1.5, enemyHpMul:1.1 } },
  { id:'scav',    name:'Nhặt nhạnh',     icon:'mag',    tag:'Đồ rơi',    desc:'Gấp đôi đồ rơi, địch +20% sát thương', mods:{ lootChanceMul:2, enemyDmgMul:1.2 } },
];


// DRIVING (Z85) — the player's tank is a 50-tonne machine: hull-steered tracks, a heavy launch, momentum that carries,
// and collisions that hurt by mass × closing speed. Speeds in world units/s (top speed = PLAYER.maxSpeed 26).
export const DRIVE = { wallBreak:14 };   // a ride hitting a brick wall faster than this (m/s) bursts through it; slower just thumps it (world/brick-walls.js ramWall)

// TROOPS (Z89) — APCs that drive in and DISMOUNT a squad; your own FIRETEAM call-in (equipment wheel).
// Z106 BATTLEFIELD BOUNDARY — the playable field is no longer a square: an irregular outline (a radius per bearing) with bays,
//   bulges and highland ridges outside the fence. A new outline every stage. min* keep the key ground inside (our spawn side,
//   the enemy objective side, everything else).
export const FIELD = { N: 360, base: 0.92, harmonics: 6, amp: 0.1, bays: [2, 4], bayDepth: [0.16, 0.3], bayWidth: [0.14, 0.3],
  minOurs: 0.9, minTheirs: 0.78, minAny: 0.66, max: 0.985, ridgeH: 5.5, ridgeW: 9,
  innerRidges: [3, 5], innerRidgesMobile: [2, 3], ridgeLen: [22, 46], ridgeRock: [1.5, 2.4] };

// Z105 GROUND RELIEF SHADING — craters / mounds read by colour, not just by geometry (phones have no shadows at all).
//   relief = height − ring average (R cells away): <0 = bowl (crater floor, hollow), >0 = crest (mound top, crater rim)
export const RELIEF = { R: 3, bowlDark: 0.85, bowlAO: 0.32, crestLift: 0.3, slopeEarth: 0.5, bowlK: 0.45, crestK: 0.4, slopeK: 0.6,
  bowlTint: [0.66, 0.56, 0.47], earth: [0.5, 0.36, 0.24], selfShadow: false };   // Z107 off: terrain self-shadow shimmered (acne) as the shadow frame followed the tank   // tint multipliers (rgb); earth = raw soil exposed on steep faces

// Z104 INFANTRY LETHALITY — a soldier is soft: ONE round from a tank gun kills him (rifles still trade hits),
//   and a blast kills outright inside its core (core × radius) and wounds — fading — out to reach × radius.
export const LETHAL = { heavyKills: true, core: 0.45, reach: 1.25, edgeMin: 0.25 };

// Z104 MOBILE AIM — phones have no mouse, so the barrel is FIXED to the hull: the tank shoots straight where it faces.
//   Auto-fire / rockets / mortar / artillery only take a target inside this forward cone (half-angle in rad) or lane (world units).
export const AIM = { rockR: 16, mobileFixed: false, mobileTrack: true, trackTol: 0.1, trackSticky: 1.35,   // Z233 phones: the turret tracks the enemy on its own (was: barrel fixed to the hull)
   cone: 0.17, lane: 1.8, artyCone: 0.32 };   // a LIGHT push of the stick only turns the hull on the spot (aim without driving off); push further to drive
// Z313 SHOOTING AT HELICOPTERS IN 3D (combat/air-aim.js): the mouse snaps to an aircraft within snapPx of the cursor (keeps it within keepPx); a pad
//   or phone lays on the one within padCone (rad) of the aim; rounds lead it and climb to its height; a round aimed at it hits within hitR (m) across
//   (the airframe and rotor, not the hub) and hTol (m) up or down of it;
//   how far a tank gun / a man's rifle may tip up (rad); the reticle: ring colour, label
// Z314 A GUN'S ROUND FLIES A STRAIGHT LINE (combat/lock-on.js): it hits a body only at that body's real height — a man (m), a tank (m at TANK_SCALE),
//   from floor (m) below its feet — and flies over an obstacle when it passes over m clear of its top
//   Z316 one of our men lying flat / crouched stands only body.prone / body.crouch (m) high, and the enemy lays its aim on aim.prone / aim.crouch (m)
export const LINE = { manH:2.1, floor:0.4, over:1.2, body:{ prone:0.7, crouch:1.4 }, aim:{ prone:0.35, crouch:0.85 } };
export const AIRAIM = { snapPx:70, keepPx:120, padCone:0.28, hTol:2.2, hitR:2.6, manUp:1.05, col:0xff5a3a };
// Z376 THE CROSSHAIR IS WHERE THE ROUND GOES (combat/crosshair.js): the point under it in the world (a man, a hull, a wall, a house, the ground — not
//   the ground behind them), the same for the mouse and the pad, the round flown from the muzzle straight to it. reach = how far the eye looks (m);
//   step = the ground march [first, per metre]; man = a man as the eye sees him (radius, standing / crouched / lying height, his aim point kept
//   off his feet and head); chest = the pad's aim height over the ground; pad.lat = how far off the stick's line a man is still taken up (m);
//   awake = s after the crosshair last moved that the rifle stays up on it while he runs; fireTol = how far off the aim the bore may be for the
//   trigger (rad); turn.twist = what the chest takes before the hips turn (rad), turn.walk = hips that far off the run: he backs / side-steps off at backV m/s (under SOLDIER_LEGS.stand.maxV: his own legs walk it — the clips only
//   ever run forward); aimRate = the
//   chest's swing (rad/s); stop.min = a block nearer the crosshair than this (m) is the target itself, not in the way (Z382: then the crosshair turns red);
//   tankTol = how far off the crosshair the turret may still be for the tank's shot (rad: it waits until it is on); anchor.cam = a burst holds the
//   point (or man) it was fired at while the mouse is still, until the camera has moved this far (m)
export const XHAIR = { reach:180, step:[0.3, 0.012], man:{ r:0.5, h:1.85, low:1.35, prone:0.6, lo:0.35, hi:0.2 }, chest:1.2, pad:{ lat:1.8, near:2 },
  awake:2.2, fireTol:0.3, anchor:{ cam:3 }, turn:{ twist:1.0, walk:0.8, backV:2.2 }, aimRate:6.5, stop:{ min:1.5, px:22 } };
// Z326 AIMING UP AT AN AIRCRAFT (actors/real-cav.js): past the rifle's normal tip-up he leans back from the waist — k × the extra, at most max (rad),
//   shared [Spine, Spine1, Spine2] — so the butt stays in his shoulder as the muzzle climbs; his head and neck (neck's share) tip back the rest of the
//   way to sight along the barrel (sight × the gun's angle); eased at rate /s; lying flat he can't lean back — the muzzle comes up no further than prone
export const AIRPOSE = { k:0.6, max:0.55, split:[0.25, 0.35, 0.4], neck:0.4, sight:0.95, rate:6, prone:0.35 };

// Z174 REAL-WORLD SCALE — 1 world unit = 1 metre. The tanks are the reference (≈ a real MBT: ~7.5 m with the gun, 3.7 m tall to the cupola); a soldier model is
//   1.407 units tall at scale 1 → HUMAN_SCALE makes every man, ours and theirs, 1.78 m. Fortress curtain walls 7 m + 1.3 m merlons, 2.4 m thick; watchtowers 8 m to the deck;
//   brick compound walls ~2.4 m; sandbag lines 1.2 m; trees 10–17 m.
// Z174b real MBT proportions (×TANK_SCALE 1.2): hull ~7.6 m long, 3.6 m wide over the tracks, turret roof ~2.4 m, gun ~2.5 m past the nose (~10 m overall) —
//   the hull + tracks stretch along, the hull and turret sit a little lower, the turret a touch longer, the gun longer. The generals' super-heavies keep their own size.
export const HUMAN_SCALE = 1.78/1.407;
export const TROOPS = {
  fireteam: { size: 6, perStage: 0.8, cap: 12, capMobile: 9, hp: 42, dmg: 7, range: 21, fireCd: 0.8, speed: 7.5, sprint: 12, follow: 7, cd: 24,   // friendly squad
    zoneMul: 0.9, zoneMin: 18,   // Z100 they roam FREELY inside the tank's combat zone (= 90% of its fire range, never under 18)
    detect: 30,                  // how far a soldier spots enemies (it only chases ones it can reach without leaving the zone)
    patrol: [6, 15],             // with nothing to shoot they take up posts this far from the tank
    spread: 2.6,                 // personal space between soldiers (no conga lines)
    tapMax: 0.3 },               // CREW/G pressed shorter than this = dismount; held = recall (release ends it)
  look: { scale: HUMAN_SCALE, barY: 2.45 },   // Z174 a 1.78 m man (was 2.6 m)   // Z104 every foot soldier (ours + theirs) at the same, slightly bigger size; HP bar height above them
};

// Z104 SQUAD AI — our soldiers fight on their own across the whole field (no longer leashed to the tank's ring).
//   Priorities each re-plan: recall (only men inside the ring answer) → carry loot home → take cover from enemy armour →
//   fight infantry / tower guards → fetch loot → depot / POW jobs → advance on the nearest enemy → regroup on the tank.
export const SQUAD = {
  think: 0.4,                                  // seconds between re-plans (staggered per soldier)
  huntR: 62,                                   // with nothing in sight they advance on the nearest enemy within this
  cover: { threat: 20, search: 13 },           // enemy armour this close → run for the far side of a wall / rock / sandbags within `search`
  guardHit: 0.4,                               // chance one rifle shot drops a guard up on a watchtower (Z200 0.32 → 0.4: they aim for the platform first)
  // Z200 SMARTER SQUAD: helicopters are shot at (tracers climb; a share connect — AT men fire a guided rocket), the squad weighs its strength against
  //   what is around it (advance / hold / fall back behind the tank), a badly hurt man pulls back to the tank to patch up, covering men use cover
  ai: { airHit:0.42, airHitMg:0.52, airDmgK:0.75, airPri:0.45, airRng:16, woundedHp:0.35, healed:0.85, heal:3.5, postureEvery:1.2, threatR:34, fallK:2.2, advK:0.8, barkGap:18 },
  lootDetect: 26,                              // soldiers spot dropped items this far away, carry them to the RALLY POINT
  at: { dmg: 34, aoe: 2.4, speed: 34, cd: 3.4, range: 26 },   // anti-tank launcher handed out by a captured weapon depot
  armedMul: 1.35,                              // rifle damage after re-arming at a captured weapon depot
  // Z105 how they fight: rush 1–1.5 s, then hold and fire (kneeling at cover, prone in the open beyond proneR); prone men are harder to hit
  rush: [1.0, 1.6], hold: [2.4, 4.2], proneR: 13, proneHitR: 0.42, standHitR: 0.75,
  // Z105 specialists (picked on the deployment screen; default mix below for reinforcements)
  mg:     { burst: 8, gap: 0.1, pause: 1.8, dmg: 4.2, range: 28, spread: 0.06 },                    // heavy machine gun: fires prone in long bursts
  mortar: { cd: 3.4, min: 12, max: 44, dmg: 30, aoe: 4.0, flight: 1.5, spread: 1.6 },                         // mortar team: stays back, lobs shells (kills infantry, cracks towers/camps)
  sapper: { plant: 2.6, fuse: 2.4, reach: 50, safe: 10 },                                        // sapper: runs to a watchtower / camp hut, plants a charge, gets clear → it comes down
  mix: ['rifle','rifle','mg','rifle','sapper','rifle','mortar','rifle'],
};
// Z105 DEPLOYMENT (before every stage): how many specialists you may field, and where posted men hold
export const DEPLOY = { men:5, roleMax: { mg: [1, 2, 2, 2, 3], mortar: [0, 1, 1, 2, 2], sapper: [1, 1, 2, 2, 2] }, holdR: 30, stage: 0.62 };   // stage = staging point at this fraction of the way to an enemy site

// Z104 BATTLEFIELD ZONES (world/zones.js plans the ground before cover is scattered)
export const RALLY = { r: 6, offX: 0.34, offZ: 0.64 };          // KHU TẬP KẾT on our side: soldiers drop carried loot here (it never expires) for the tank to collect
export const POW = { perStage: [2, 2, 3, 3, 3], r: 9, prisoners: [3, 5], guards: [3, 4], guardsMobile: [2, 3], freeR: 10, score: 600 };
export const DEPOT = { arms: [1, 1, 1, 1, 1], motor: [1, 1, 1, 1, 1], r: 10, guards: [4, 5], guardsMobile: [3, 3], capT: 4, score: 800 };
// Z116 HIJACK: a badly hit enemy vehicle may be ABANDONED — the crew bails out and it sits smoking. Drive up to it (or walk a soldier
//   onto it) before it is scuttled and it fights for you in our colours. APC → drops 3 of our men + an MG; rocket truck → anti-air first, then siege.
// Z222 THE HELICOPTER FLEET — three airframes, three ways to fight. mix = [type, weight, from stage]: an enemy "gunship" call rolls one of them.
//   jink: the attack gunship weaves — every few seconds a hard lateral jink in/out of its orbit, a change of height, sometimes it reverses round.
//   bomb: the bomber helicopter carries no guns — it lines up on you, runs in level and fast, lays a string of bombs across your position, overshoots,
//   swings round wide and comes again. troop: the transport flies to a spot near you, STOPS in a hover, lowers a rope ladder and its squad climbs
//   down one man at a time; then it lifts off, repositions and does it again (drops), and finally circles with its door gunner firing.
export const HELI = { mix:[['gunship',1,1],['heliBomb',0.65,2],['heliTroop',0.75,2]], maxBomb:2, maxTroop:1,
  jink:{ every:[1.3,2.8], side:9, alt:2.4, rev:0.3, rate:1.9 },
  bomb:{ alt:12, speed:22, cruise:16, turn:1.15, bombs:6, gap:0.16, dmg:30, R:4.4, over:52, lead:1.3, g:22 },
  troop:{ cruise:14, alt:13, turn:1.3, standoff:[22,38], ladder:7, deploy:1.1, men:[4,6], menMobile:[3,4], climb:3.0, gap:0.8, drops:3, recon:12, rpgEvery:3,
    gunR:40, gunDmg:2.2, gunCd:0.15, burst:6, burstCd:3.4, loiterR:44 } };
// Z104 PARATROOPERS — an enemy transport helicopter crosses the field every so often and drops a stick of paratroopers
export const PARA = { fromStage: 1, fromWave: 2, every: [50, 72], everyMobile: [60, 85], troops: [6, 9], troopsMobile: [4, 5], alt: 27, speed: 15, fall: 6.0, gap: 0.3, rpgFrom: 2,
  helos:[1,2,2,3,3], helosMobile:[1,1,2,2,2], spread:10, trail:9, escortFrom:3, cargoFrom:2 };   // Z199 an airborne assault: a formation of transports, sticks of 6–9 from the ramp, canopies filling the sky, a cargo bundle, an escort gunship

// BATTLEFIELD INSTALLATIONS (Z90) — enemy troop camps that keep feeding infantry, and rope bridges linking paired watchtowers.
// Z194 ENEMY SUPPLY BASES — a fuel station and an ammo depot (count per stage), piece HP (× stage/loop/difficulty), alarm radius, how far a guard tank
//   strays, garrison (riflemen [min,max], guard tanks [early,late]), gunships called per base [min,max], armour called in, and what losing each costs the enemy
export const SUPPLYB = { perStage:{ total:[3,3,4,4,4] }, hpPerStage:0.15,   // Z195 3–4 compounds, fuel and ammo alternating, in the corners of the map
  hp:{ radartower:560, radome:220, aagun:150, fueltank:300, tanker:120, pumphouse:320, bunker:480, ammostack:90, supplytruck:110, shelter:160, radartruck:130, genset:80, dish:60 },   // (Z425 the radar yard's shelter, truck, generator and dishes stand as pieces)
  alertR:46, guards:[3,6], heli:[1,3], heliCd:40, reinf:2, reinfCd:30, aa:{ range:26 },   // Z403 the radar's twin AA guns hose a man on the ground within aa.range m (was 62: they cut him down before he got near; now no further than his own rifle reaches)
  cut:{ speed:0.12, air:0.18, dmg:0.12, rate:0.15, inf:0.25, min:0.7 }, score:2200 };
export const CAMP = { perStage: [2, 2, 2, 3, 3], hp: 420, hpPerStage: 0.18, every: 16, squad: [2, 4], infCap: 22, score: 900, tentScore: 60 };
export const BRIDGE = { pairChance: 0.75, minD: 12, maxD: 18, patrolSpeed: 1.6 };
// Z405 RIVERS (world/river.js — the bed is carved into the heightfield by genTerrain): the battlefields a river crosses and their water. Per battlefield:
//   sh / dp = shallow / deep water colour (linear RGB: clear green-blue, the savanna's muddy brown, the ruins' murky grey-green), wet = how dark and glossy
//   the banks just above the waterline are, frozen = [main, stream] frozen hard (you drive on the ice; the arctic's side stream stays an open lead),
//   cross = that battlefield's own crossings. The main river runs across the enemy half (z = share of the half-extent, ± amp m of meander, the flow west → east
//   or back), the stream comes in from the enemy's edge on one flank (x = share) and joins it — our half stays dry; w = half width, D = depth below the banks.
//   cross = [line (0 main · 1 stream), u along it, kind]: 'bridge' — a deck you drive over at full speed (THE BRIDGE SPOT: see bridge below), 'ford' — the bed
//   raised to a stony run fordDepth m under the surface, fordLen m long, white water over it. wade = hull / rider speed: in water deeper than fordD (deep) or
//   shallower (ford, the banks too); on a bridge or the ice 1. flow = m/s mid-channel (the stream × streamK), cycle = s per ripple phase, ripple = m per tile
//   of the big / small ripples (phones: the big only), foam = [shore foam depth m, streaks in the current, white water over the fords], env = sky reflection;
//   sh / dp here = any battlefield's own default; clear = m kept free of cover and buildings round a crossing (its approaches, both banks)
//   bridge: the player's bridge model goes here — model = a .glb path (e.g. 'assets/models/bridge.glb'; null = the temporary plank deck): every bridge spot
//   gets a copy, its long side laid across the river and scaled to len m (0 = the deck's span), turned yaw rad more, its road surface (deckAt × its height
//   from its base) set on the walkable deck at deckY; keepDeck = leave the planks under it. hw = the walkable deck's half width, over = how far it runs onto each bank
export const RIVERS = {
  biomes:{ VILLAGE:{}, MEADOW:{ sh:[0.12, 0.22, 0.17], dp:[0.015, 0.055, 0.06] }, SAVANNA:{ sh:[0.25, 0.2, 0.12], dp:[0.09, 0.07, 0.035] },
    RUINS:{ sh:[0.15, 0.19, 0.16], dp:[0.03, 0.06, 0.06] }, CITADEL:{ sh:[0.14, 0.26, 0.24], dp:[0.02, 0.08, 0.10] },
    ARCTIC:{ sh:[0.10, 0.20, 0.24], dp:[0.01, 0.04, 0.06], wet:0.3, frozen:[true, false], cross:[[1, 0.42, 'ford']] } }, sh:[0.13, 0.24, 0.21], dp:[0.015, 0.06, 0.07],
  y:-0.85, D:1.7, main:{ w:5.5, z:-0.5, amp:10 }, stream:{ w:3.2, x:0.46 },
  cross:[[0, 0.5, 'bridge'], [0, 0.32, 'ford'], [0, 0.68, 'ford'], [1, 0.45, 'ford']], jitter:0.04, clear:10,
  fordDepth:0.3, fordLen:7, wade:{ deep:0.55, ford:0.8, fordD:0.6 },
  flow:1.2, streamK:1.3, cycle:1.6, ripple:[5.5, 1.7], foam:[0.09, 0.4, 0.85], wet:[0.42, 0.5], env:1.8,
  route:{ every:0.7, step:2.5, reach:3, margin:3, cell:3, keep:24, gap:12, reuse:7, seed:15, wide:{ deck:0.9, ford:0.4 } }, fenceGap:0.35,   // Z417 cell: the way-round grid's cell (m) — dry ground vs the deep channel · keep: distance fields (one per goal cell) kept · gap: ms between two fields laid (one a frame) · reuse: a field laid to within this many m of the goal (same bank) serves · seed: a goal in the water is reached at the dry cells within this many m of it · wide: a bridge's way is its deck less deck m each side, a ford's is ford × fordLen along the stream
    // Z415 the enemy's way over (world/river.js riverWay): looked at every s, sampled every step m, a waypoint reached within reach m, margin m onto dry land past a crossing · fenceGap: the fence stops where its line is under water + this m
  bridge:{ model:null, len:0, yaw:0, deckAt:0.5, keepDeck:false, deckY:0.14, hw:3.6, over:2.5 },
  ice:{ col:[0.34, 0.46, 0.52], deep:[0.07, 0.15, 0.2], snow:0.6, crack:0.32 } };
// SWIM 1 THE SOLDIER IN THE RIVER (game/swim.js): the water's depth at his feet (RIVER.y − the ground there, a bridge or the ice dry) sets what he can do.
//   bands  depth (m) where each band starts: ankle (splashes), knee (a wade: slower, a splash a step, a wake), waist (slow, the rifle kept at his shoulder,
//          turns slower), chest — deep: deeper than deep[0] he leaves the bed and swims (out again under deep[1]: no flicker on the edge)
//   speed  [depth, × his pace] wading (between the points: straight lines) · turn rad/s his body turns at most in a waist-deep wade
//   crouch / prone  the deepest water he may kneel / lie down in (deeper: he stands) · jump: no jump or roll deeper than this
//   swim   v m/s a stroke (the library's underwater stroke, at the surface) · head m his head over the surface · bob [m, rad/s] · yRate how fast his height follows
//          defK what reaches him of a round (only his head and shoulders show) · fireMsg s between "no firing while swimming" notes · slingT s for the rifle to go on his back first
//          clips: tread (still) / stroke (moving, faster than moveV) · ts the stroke's pace [min, max] · strokeRate the clip's strokes a cycle (splash + sound each)
//   dive   holding C (crouch) while swimming ducks him under: depth m his head under the surface (never nearer the bed than floor m) · v m/s · breath s held
//          · back s/s it comes back at the surface · defK a round's leftover energy after ~1 m of water · tint the blue over the screen · lp Hz the world heard under
//   wade   defLoss: a round that would strike under the waterline is spent in it — his defK × (1 − defLoss × depth / deep[0])
//   fx     step splash particles (ankle / knee) thrown up m/s, a wake puff every wake s (wakeOp), a ripple ring every ring s (ringR m wide, ringT s, ringOp at its start), the ring pool's size
//   pool   SWIM 1 the rivers as carved were 0.85 m deep mid-channel (1.27 m at the deepest in MEADOW): no stretch to swim in. A pool is dug into the main
//          channel's middle (u: share of its half width), deep m deeper, kept gap m off every bridge and ford and eased in over ramp m — the crossings stay as they were
//   foe    enemy infantry and the fireteam do not swim with their kit: a man does not step on into water deeper than maxD (he wades up to it); look m ahead
export const SWIM = { on:true, bands:[0.03, 0.25, 0.6, 0.95], deep:[1.35, 1.2], speed:[[0, 1], [0.25, 0.9], [0.6, 0.62], [0.95, 0.38], [1.35, 0.3]], turn:4.2, crouch:0.7, prone:0.18, jump:0.62,
  swim:{ v:1.05, head:0.14, bob:[0.035, 2.1], yRate:3.2, defK:0.45, fireMsg:3, slingT:0.38, tread:'social-tread-water', stroke:'social-swim-underwater', moveV:0.35, ts:[0.75, 1.5], strokeRate:2, armRate:[5, 40], armT:0.7, breathT:2.4 },
  dive:{ depth:0.85, floor:0.35, v:0.9, breath:14, back:2.5, defK:0.06, tint:'rgba(18,84,104,0.42)', lp:420, msgAt:0.25 },
  wade:{ defLoss:0.55 },
  fx:{ step:[3, 5], up:2.2, wake:0.11, wakeOp:0.28, ring:0.6, ringR:[0.3, 1.9], ringT:1.6, ringOp:0.14, rings:8, col:0xe8f2f4 },
  pool:{ on:true, u:0.92, flat:0.5, deep:1.15, gap:10, ramp:6 },   // (HSWIM 2 widened: was u 0.55 · deep 1.05 · gap 12 · ramp 10, its full depth only inside 0.35 of it — ~3.5 m of swimming across; flat: the share of u at full depth)
  foe:{ maxD:1.15, look:0.9 } };
// HSWIM 1 THE HORSE SWIMS (game/horse-swim.js): the depth at the war horse (RIVER.y − the bed under it) sets how it goes. Measured on the real horse (actors/real-cav.js):
//   belly ~0.95 m over its hooves, the back / saddle ~1.75–1.9, the seat 1.8, the head's top ~2.2 (the nose ~1.4).
//   wadeV  [depth, m/s at most] the horse wading (between the points: straight lines; on top of the old ×wadeAt) — splashes at each hoof, a wake and rings deeper than wakeD
//   deep   deeper than deep[0] it loses the bed and SWIMS (back on its feet under deep[1]): its body floats `float` m under the surface (its root — the hooves' plane;
//          the back line and the saddle stay just over the water, the head and neck well over), eased at yRate, bobbing [m, rad/s], rolling roll rad; never under the bed
//          · v m/s at most afloat (a horse swims ~1.5–2), turn × its turn rate · k s to ease the swim in / out (legs, pitch) · defK × what reaches the rider (the water takes some)
//   pose   nose-up pitch rad about the seat (pivot m over the hooves: the rider is not swung) · neck / head rad raised (the head stretched up out of it) · tail rad laid back onto the water
//          · clip the library gait it paddles with (Walk), ts its pace [still, at v], idleW the Idle clip mixed in (the stride shortened to a paddle)
//   fx     splash [shallow, deep] drops a hoof (in water), paddle s between two splashes at its chest, wake s a puff astern off each flank (wakeOp), ring s a ripple ring
//   noFire the rider does not fire from a swimming horse (one hand on the mane, one on the reins; the carbine held clear of the water) — nor throw, nor use a medkit; msg s between notes
export const HORSESWIM = { on:true, wadeV:[[0.45, 16], [1.0, 5.5], [1.5, 2.6]], wakeD:0.6,
  deep:[1.5, 1.38], float:1.55, yRate:2.2, bob:[0.035, 1.6], roll:0.03, v:1.8, turn:0.55, k:0.6, defK:0.8,
  pose:{ pitch:0.13, pivot:1.7, neck:0.45, head:-0.06, tail:0.55, clip:'Walk', ts:[0.8, 1.3], idleW:0.55 },
  fx:{ splash:[3, 6], paddle:0.62, wake:0.16, wakeOp:0.13, ring:0.55 }, noFire:true, msg:2.5 };
// HSWIM 2 THE WATER POLISHED (fx/water-spray.js, game/horse-swim.js, actors/gun-carry.js, game/swim.js): the rider of a swimming horse and the water's splashes.
//   reins  afloat the rider cannot fire, so he does not hold the rifle up: he slings it on his back (actors/gun-carry.js, why 'reins' — the quick sling) and
//          takes the reins in both hands, low over the withers — each wrist fwd m ahead of its shoulder, down m under it, in m toward the middle; the elbow's
//          pole [out, down, back] m. Once the horse has swum in to at (its swim eased in, 0–1) — and back to the rifle as it finds its feet (the sling's own pace)
//   drops  a splash's spray (one instanced draw, its own shader): n drops per unit of the splash's size, thrown at v m/s [min, max] × its up, each a thin streak
//          w m wide [min, max] stretched along its flight by stretch s of its speed, life s [min, max], gravity grav, op its opacity; a drop that falls back into
//          the river is gone (max alive at once)
//   sheet  the thin crown of water thrown up round a foot, a stroke or the horse's chest (splashes of size ≥ min): an open, flared ring of streaked water r m
//          [start, end] wide, h m tall × its size [min, max], rising and falling back over life s, op (max at once)
//   foam   the white water left on the surface where it broke (and the wake's patches, instead of puffs of smoke): r m [start, end] × its size, life s [min, max],
//          op · wake [r start, r end] of a wake patch · ring: the ripple rings (game/swim.js) drawn with a soft edge, not a hard white line (edge: share of the radius, op × SWIM.fx.ringOp)
//   col / light  the water's white, lit by the sun (× sun) and the sky (× sky, the ambient with it) as the scene is — dull at dusk, dark at night (clamped [min, max])
export const HSWIM2 = { on:true,
  reins:{ on:true, fwd:0.34, down:0.52, in:0.12, pole:[0.3, 0.32, 0.12], at:0.35 },
  drops:{ n:9, v:[1.1, 3.0], w:[0.014, 0.03], stretch:0.06, life:[0.45, 0.8], grav:-9.8, op:0.8, max:360 },
  sheet:{ min:0.4, r:[0.16, 0.5], h:[0.2, 0.42], life:0.4, op:0.34, max:12 },
  foam:{ r:[0.22, 0.7], life:[1.0, 1.6], op:0.42, max:48, wake:[0.2, 0.55] },
  ring:{ soft:true, edge:0.3, op:1.4 },
  col:0xe4eef0, light:{ sun:0.2, sky:0.6, min:0.06, max:1.2 } };

// LOOT (Z93) — engine & armour pickups, stacking rules and where the good stuff hides.
// STACKING: picking a buff you already have EXTENDS it by `extendShare` of its duration (never past `maxDurMul`× a full timer) —
// it never multiplies its own power. TURBO and ERA are the only LEVEL/CHARGE stacks (capped). Different buffs combine, but every
// speed source (OVERDRIVE spell × ENGINE pickup × ENGINE shop) is clamped to `speedCap` so the tank never becomes uncontrollable.
export const LOOT = {
  rules: { extendShare: 0.5, maxDurMul: 1.5, speedCap: 1.7 },
  speed: { dur: 22, top: 1.3 },                                              // ENGINE OVERDRIVE: +30% top speed & pull
  siege: { dur: 25, mul: 2.5 },                                              // Z111b SIEGE ROUNDS: ×2.5 damage to fortress walls & gates, barricades, towers, camps (shots + blasts)
  turbo: { dur: 20, accel: 0.35, launch: 0.6, maxLv: 2 },                    // TURBO: per level +35% acceleration, +60% of the missing launch torque
  ram:   { dur: 20, dealt: 2.2, taken: 0.35, mass: 1.8, wall: 0.55, climb: 0.65 },   // DOZER BLADE: hits like a train, shrugs off rams, bursts walls at a trot
  era:   { charges: 3, cap: 6, absorb: 0.6, minHit: 8 },                     // REACTIVE ARMOUR: each tile eats 60% of one hit ≥8, then blows off
  source:{ chanceBase: 0.5, chancePerHp: 1/60, chanceCap: 2.4, rareHp: 70, epicHp: 130 },   // tougher enemies drop more often and roll better loot
  cache: { perStage: [2, 2, 3, 3, 3], hp: 70 },                              // guarded supply caches beside camps & towers (always rare+)
};

// TACTICS (Z95) — enemy armour fights as a unit. A director re-reads the battle twice a second and hands every engaged tank a ROLE.
// IQ (0..1) = base + perStage·(stage−1) + difficulty + NG+ loop — it decides how many tanks flank, how cleanly they encircle,
// whether they use cover, dodge your aim, fall back to their engineers, lead their shots and press when you are hurt.
export const TACTICS = {
  iq: { base: 0.2, perStage: 0.16, recruit: -0.15, soldier: 0, veteran: 0.18, loop: 0.12, cap: 1 },
  tick: 0.45,               // seconds between director passes
  dodge: { from: 0.35, cd: 2.2, speed: 9, time: 0.45 },   // sidestep when your gun lines up on them
  evade:  { from:0.2, look:1.0, cd:[1.0,2.0], speed:20, heavyMul:0.4, react:[0.4,0.92] },
  jink:   { from:0.45, amp:0.6, per:[2.4,3.8] },
  // Z192 line of fire: a crew this smart checks the round's path first — cover in the way → hold the shot, slide sideways (peek s) to open a line
  los:    { from:0.25, wait:0.45, peek:0.9 },
};

// BOSS FIGHTS (Z96) — every general is a puzzle: armour arcs, breakable systems, three phases, stun & overheat windows, shield pylons.

// Z107 BATTLE SETUP — PLAY opens a setup screen: CAMPAIGN (levels in order of rising difficulty, each must be won to open
//   the next; map/hour/weather fixed per level) or CUSTOM (pick map · hour · weather · space · enemy level among those unlocked).
//   Level L ↔ (loop, stage): loop = ⌊(L−1)/5⌋, stage = (L−1)%5+1 — the same stages + NG+ loops the run already had.
export const CAMPAIGN = { levels: 15, perLoop: 5,
  weather: ['clear','clear','snow','fog','sand',  'sand','rain','snow','rain','fog',  'sand','fog','snow','rain','rain'] };
// WEATHER — look (fog ×, sun ×, haze tint, particles desktop/phone) + a light gameplay touch (your guns' reach ×)
// Z224 CINEMATIC WEATHER — each sky its own film stock (grade offsets on top of the battlefield's look) + life in the air near the camera
export const WXFX = {
  grade:{ rain:{ sat:-0.1, con:0.07, sh:[-0.025,0.006,0.035], hi:[-0.01,0,0.012], vig:0.1, exp:0.94 },
          sand:{ sat:-0.04, con:-0.05, sh:[0.03,0.012,-0.02], hi:[0.035,0.012,-0.03], vig:0.08, exp:1.02 },
          snow:{ sat:-0.08, con:0.02, sh:[-0.02,0,0.04], hi:[-0.01,0.004,0.02], vig:0.04, exp:1.05 },
          fog:{ sat:-0.08, con:-0.06, sh:[-0.01,0,0.015], hi:[0.008,0.006,0], vig:0.12, exp:1.0 } },
  splash:{ R:22, rate:[70,30] },            // rain: droplets bouncing off the ground around you (per s, desktop / phone)
  bolt:{ r:[45,110], h:70, thunder:[0.6,2.6] },   // a visible bolt somewhere off in the storm; the thunder rolls in a beat later
  gust:{ every:[5,11], k:[1.6,2.6], t:2.2 },        // wind gusts lean the rain, drive the sand, stir the snow
  drift:{ sand:[9,4], fog:[4,2], snow:[3,1] } };  // ground-hugging sheets of sand / fog / snow-smoke per s (desktop / phone)
export const WEATHER = {
  clear:{ vi:'QUANG ĐÃNG', icon:'sun',  fogK:1,   sunK:1,    hemiK:1,    tint:null,     n:[0,0],     range:1 },
  rain: { vi:'MƯA GIÔNG',  icon:'rain', fogK:1.45, sunK:0.5,  hemiK:0.82, tint:0x8a96a2, n:[1100,420], range:0.92, wet:0.42, bolt:[7,16] },
  sand: { vi:'BÃO CÁT',    icon:'sand', fogK:1.8, sunK:0.72, hemiK:0.92, tint:0xc9a06a, n:[700,300],  range:0.85 },
  snow: { vi:'TUYẾT RƠI',  icon:'snow', fogK:1.6, sunK:0.78, hemiK:1.05, tint:0xd4dde6, n:[1000,400], range:0.95 },
  fog:  { vi:'SƯƠNG MÙ',   icon:'fog',  fogK:2.2, sunK:0.66, hemiK:0.95, tint:0xc4c8cc, n:[0,0],     range:0.82 },
};
// NATURE AMBIENCE + FLOCKS (yêu cầu: "lâu lâu thêm tiếng chim hót, rừng rú nhẹ vào cho vui ta. biển bắc thì tiếng chim hải âu... âm thanh rừng... ở các
//   ngọn đồi thêm chim én chim bay lượn chao liêng theo bầy vào cho đẹp"). audio/ambience.js: a quiet bed under the battle and now and then a call placed
//   round the listener, all synthesised (no recordings); ducked under every shot and blast, quiet while the fight is hot, up in the lulls and behind the
//   menus; it rides the master (the effects level and the mute apply); PROFILE.ambience false (CÀI ĐẶT) turns it off. world/skylife.js: the flocks.
//   vol = the whole layer's level into the master
//   bed: each layer's level at full lull — wind (band noise, gusting) · leaves (a rustle riding the gusts) · sea (the wash below the shelf, one wave every
//     wave s; louder near the edge: full at the fence, far at edge[1] m in) · rain (while it rains); fade s in / out
//   heat: the fight's heat 0…1 — each sound as heard (its level after distance) adds × shot (small arms) or × boom (blasts), cooling with tau s; foes
//     within near m add perFoe each (up to foeMax); calls wait until the heat has stayed under quiet for calm s; the bed is down to lull.fight at hot
//   duck: a sound as heard pulls the layer down at once by depth × its level (a blast counts big ×), never under min, back up over release s;
//     voice = the level while the radio speaks
//   lull: the level in a hot fight (fight), behind the menus (menu), paused (pause)
//   calls: seconds between two at full lull (gap; ÷ the biome's rate and the weather's calls), the first first s into a field; ref = m where a call is at
//     half its level; lp = [floor Hz, top Hz, m] the air's low-pass with distance; verb = the reverb send [near, far, at m]; detune = ± pitch share;
//     answer = the chance a second bird of the kind answers after answerT s; max = calls sounding at once; variants = takes rendered per kind
//   kinds: g = level (measured K-weighted: a songbird at its middle distance ≈ −40 LUFS before the master, 16 LU under the soldier's own rifle and
//     no louder than an enemy's carbine 40 m off; a gull ≈ −38, a cricket ≈ −44), d = [m] how far off it is placed, h = [m] how high over the
//     ground (surf: out = [m] past the edge, h under it)
//   biomes: the bed's layers ×, rate (0 = no calls at all), the day's and the night's kinds with their weights (_ = any other battlefield)
//   wx: per weather (S.weather) the wind ×, the calls ×, rain on
//   flock (world/skylife.js) — swal: the swallow flocks over the hills (biomes where they fly; flocks of size birds, phones fewer): each flock follows a
//     leader circling a hilltop, a fort's crag, a knoll, a ridge's crest or the land's own high points (peaks) at alt m over it, R m round (a fort or a knoll: by its size), v m/s, for
//     dwell s, then darts on (pick: a next anchor near…far m away is likelier, others × off); each bird trails the leader by a lag s at its own offset
//     (spread m), weaving (jit m), banked into its turns (at most bank rad); weave = the leader's darting (m), swoop = its dives and pull-ups (m),
//     low = the least m over the ground; fly = the wings' bias (−1 glide … +1 beat); rate / glide / amp = the wingbeat (rad/s), the glide gate, the
//     flap's depth; scale = [near, far] size × from scaleD[0] to scaleD[1] m off the camera (small up close, readable far off); pass: every so often
//     (first, every s) a flock sweeps low round the soldier (alt, R, dur) when the heat is under heat; call: a flock within r m twitters (cd s)
//   gull: the gull flocks (flocks per biome) gliding along the shelf's edge out over the sea (out m past the fence, alt m over the shelf: lower
//     and the lip hides them from the field), round the icebergs (berg = weight, bergAlt m over the berg's top), now and then across the field (cross = the chance, crossAlt m).
//     The gameplay camera rides ~5 m up, pitched 16° down with a 58° view: the frame's top edge is ~10 m up at 20 m off, ~15 m at 40, ~28 m at
//     100 — flocks fly low enough to be seen
//   peaks: the land's high points (a grid m scan, edge m inside the fence, the n highest at least minH m over the field's mean, gap m apart)
//   scare: a blast within r m sends a flock up lift m and away, for t s
export const AMBIENCE = { on:true, vol:0.55,
  bed:{ wind:0.11, leaves:0.05, sea:0.17, rain:0.07, wave:[6, 10], edge:[20, 150], fade:2.5 },
  heat:{ shot:0.06, boom:0.5, tau:7, near:35, perFoe:0.06, foeMax:0.5, quiet:0.3, calm:4, hot:0.8 },
  duck:{ depth:0.6, big:2, min:0.12, release:3.5, voice:0.6 },
  lull:{ fight:0.25, menu:0.85, pause:0.5 },
  calls:{ gap:[7, 18], first:[3, 7], ref:20, lp:[1800, 16000, 70], verb:[0.12, 0.55, 80], detune:0.04, answer:0.3, answerT:[0.8, 2.5], max:3, variants:3 },
  kinds:{ trill:{ g:0.094, d:[12, 45], h:[3, 12] }, whistle:{ g:0.071, d:[14, 50], h:[4, 14] }, chip:{ g:0.083, d:[8, 30], h:[1, 6] }, dove:{ g:0.14, d:[18, 55], h:[3, 10] },
    gull:{ g:0.23, d:[25, 80], h:[8, 30] }, raptor:{ g:0.114, d:[60, 130], h:[35, 70] }, owl:{ g:0.18, d:[25, 70], h:[4, 12] }, cricket:{ g:0.086, d:[5, 22], h:[0, 0.5] },
    swallow:{ g:0.087 }, surf:{ g:0.43, out:[25, 45], h:[-40, -30] } },
  biomes:{
    MEADOW:{ bed:{ wind:0.8, leaves:1 }, rate:1, day:{ trill:3, whistle:3, chip:2, dove:2 }, night:{ cricket:4, owl:1 } },
    CITADEL:{ bed:{ wind:0.9, leaves:0.8 }, rate:0.9, day:{ whistle:3, trill:2, chip:2, dove:1 }, night:{ cricket:3, owl:2 } },
    RUINS:{ bed:{ wind:1, leaves:0.6 }, rate:0.8, day:{ chip:3, whistle:2, trill:1, dove:2 }, night:{ cricket:3, owl:1 } },
    SAVANNA:{ bed:{ wind:1, leaves:0.4 }, rate:0.8, day:{ chip:3, trill:2, dove:2, raptor:1 }, night:{ cricket:4 } },
    DESERT:{ bed:{ wind:1.2 }, rate:0.3, day:{ raptor:2, chip:1 }, night:{ cricket:1 } },
    QUARRY:{ bed:{ wind:1.1, sea:0.45 }, rate:0.45, day:{ raptor:1, chip:2, whistle:1, gull:1 }, night:{ owl:1 } },
    ARCTIC:{ bed:{ wind:1.2, sea:1 }, rate:0.9, day:{ gull:5, surf:3 }, night:{ surf:3 } },
    CITY:{ bed:{ wind:0.6 }, rate:0.3, day:{ chip:3, dove:1 }, night:{} },
    FOUNDRY:{ bed:{ wind:0.7 }, rate:0.15, day:{ chip:1 }, night:{} },
    VOLCANO:{ bed:{ wind:1.1 }, rate:0, day:{}, night:{} },
    _:{ bed:{ wind:1 }, rate:0.5, day:{ chip:2, whistle:1 }, night:{ cricket:2 } } },
  wx:{ rain:{ wind:1.3, calls:0.25, rain:1 }, sand:{ wind:1.7, calls:0.15 }, snow:{ wind:1.25, calls:0.6 }, fog:{ wind:0.6, calls:0.9 } },
  flock:{
    swal:{ biomes:['MEADOW', 'CITADEL', 'RUINS', 'SAVANNA', 'DESERT', 'QUARRY', 'CITY'], flocks:3, size:[8, 20], phone:{ flocks:2, size:[6, 10] },
      alt:[6, 22], R:[14, 30], v:[9, 13], dwell:[10, 24], lags:[0.05, 0.75], spread:[2.5, 6], weave:2.4, swoop:5, jit:1.6, low:2.5, fly:0, bank:0.95,
      rate:26, glide:0.42, amp:0.85, scale:[0.6, 2.4], scaleD:[8, 70],
      pass:{ first:[15, 30], every:[35, 80], alt:[3.5, 6], R:[10, 16], dur:[6, 9], heat:0.3 }, call:{ r:22, cd:[6, 11] } },
    gull:{ flocks:{ ARCTIC:3, QUARRY:1 }, size:[4, 9], phone:{ flocks:1, size:[4, 6] }, out:[8, 34], berg:2, bergAlt:[-4, 8], cross:0.2, crossAlt:[10, 18],
      alt:[2, 14], R:[24, 46], v:[6, 8.5], dwell:[14, 30], lags:[0.1, 2], spread:[5, 12], weave:1.5, swoop:3, jit:2.5, low:3, fly:-0.35, bank:0.7,
      rate:15, glide:0.6, amp:0.5, scale:[0.8, 1.6], scaleD:[10, 60], call:{ r:45, cd:[5, 10] } },
    pick:{ near:40, far:220, off:0.3 },
    peaks:{ grid:12, edge:15, n:10, minH:3, gap:40 },
    scare:{ r:45, lift:12, t:6 } } };
// AUDIO 1–3 · THE BATTLE'S SOUND (src/audio/afx*.js): a layer OVER audio/synth.js — every world sound a voice with a place. Realism through detail and space, never
//   through level (the Z151 ear-safe mix stays: its bank gains, its shelf, compressor and limiter). on:false / Cài đặt → Âm thanh → "Âm thanh chân thực" / ?oldaudio:
//   the layer sleeps and sfx() plays exactly what it played before. Distances are game units; unit = metres a unit for the speed of sound (c m/s).
//   voices: the pool (max, phone), his own gun holds at most `same` of it and one family of everybody else's `family` (past that a shot takes over the
//     family's oldest), a same sound within mergeMs at mergeR units merges
//     (× mergeUp, at most mergeMax), a stolen voice fades over `fade` s; tau = how fast
//     a playing voice's level is taken to have fallen when the quietest is looked for; hold = s a slot is kept after its last sample. floor = a level not worth a voice
//   prio: who is heard when the pool is full (high wins): rounds coming at him, a blast near, the radio > his own gun > the squad > the enemy > the far battle > foley
//   cls: the distance model of each class — level 1/(1+(d/ref)^pow) · low-pass lp[0]·e^(−d/lp[2]), never under lp[1] Hz · late by d·unit/c, at most cap s ·
//     tail[near, per unit, max] = the share sent to the reverb · near[full, gone] = where the close layers (the action's click) live · slap = its send to the slap-back
//   occl: one line check per sounding cell (cell units square) every `every` s, at most perFrame a frame (nearest first), from eye m over the listener's ground to src m
//     over the source's; a wall between → × gain and a low-pass down to lp Hz, eased over tau s (the voice follows in steps of `step`, gliding `glide` s);
//     not nearer than minD, not farther than maxD; a cell nobody has sounded in for keep s is forgotten; wetK = how much of its reverb send is left behind a wall
//   guns: one family per sfx name — key = the bank / recording (SND), mech { f Hz, g, at s } = the action's click (0 none: a bolt / a pump gun has its own stroke
//     sound, actors/gun-feel.js), tail { k: which of `tails`, g × the body } — its own low-priority voice, one per family every tailGap s (a burst rolls away once),
//     tailNear of it at the muzzle and all of it far off, × tailWet into the reverb — var = its own round-robin [rate, start offset s, low-pass ×] (else `vars`),
//     dens: the same family fired n times inside win s plays each at 1/√n (not under min): a volley is wide, not loud (his own gun is never thinned),
//     supp = a suppressed gun (no tail, little reverb, no slap-back), foe = an unnamed caller's shot of this family is the enemy's
//   who: whose gun — g, rate, lpK, tailK (× the tail and the reverb), mech (× the click), eq [Hz, Q, dB] a peak that sets the enemy's rifles apart from ours
//   crack: an enemy round within R of the ear — g (× heavyK, rate heavyRate for a shell), harder the closer (pow, never under floor); the thump of its shot comes
//     gap[min, max] s later (a round at v m/s against sound), from the muzzle, low-passed at thumpLp, only from thumpMin units off, at most thumpCap of them
//     sounding; rush = a shell's wake
//   impact: a round on a material (fx/gunfx.js) within R, the same material at most once every gap s — g per material, rico = the chance it whines off (the recorded ricochet × ricoG)
//   space (AUDIO 2): the listener's place, read by `rays` rays of R units (one a tick, a ring every `every` s; kinds in `skip` are no wall): wallN of them hit within
//     wallR → 'walls' (a fort's yard, a street) · the land valley.h higher at valley.r in valley.n directions → 'valley' · the underground base / a cave → 'roof' ·
//     else 'open'. kinds: each space's generated impulse response (len s, rt = its −60 dB time, pre-delay, lp Hz darkening over damp s, early [s, level] reflections,
//     echo [s, level] = a far face answering) and `send` = the level into it; cross-faded over fade s; wet = the reverbs' return (0.45: a shot's reverb
//     about where the Z151 mix had it — the old send was × 0.32 into one outdoor response). A phone keeps the old outdoor
//     reverb, its send × phone[kind]. slap: a shot off the nearest `max` walls between min and R units (apart units between them): delay there and back within
//     t[min, max] s, level g[first, second] and low-pass lp[near, far] by distance; a line is retimed only when its wall moved by `move` of its delay
//   step (AUDIO 2): footsteps — the player's at each foot-plant (by cadence cad [base, per unit/s, max] steps/s when none came for fallback s; crawlCad drags/s),
//     men within R on their own cadence (× npc, at most `max` foley voices); own = the level, × gait g (rate = its pitch) × surf; runV / sprintV = the gaits' speeds;
//     kit: his kit rattling (chance a step at a run / a sprint), land: a jump's landing (the step × `step`, the breath `grunt`), hoof: a horse's by the ground
//   limit (AUDIO 3): the soft limiter at the master's end — straight up to thr, bent over toward top (never past it), its table of n points over ±head
//   duck: the music × (1 − gun·heat) under gunfire (heat = what he hears × heatK, a blast × bigK more; it falls over `down` s), × (1 − blast·k) under a close blast
//     (near = the dip of any blast inside blast.nearD; back over blastDown s), never under min; the fight × worldSpeech under a spoken radio line
//   deaf: a blast within R units — strength (1 − d/R)^pow × size/ref; from `min` up the whole mix is low-passed lp[open → at full strength] within `down` s, held
//     hold[min, max] s, back over `back` s, and a ringing (ring × strength × the effects level, ringHz, two tones `beat` Hz apart) fades over ringT[min, max] s.
//     Cài đặt → Âm thanh → "Ù tai khi nổ gần" (PROFILE.tinnitus) turns both off
//   music: the director's phase → what the score is asked for: heat (which stems audio/music.js brings in; + byP × the pressure), lp = a low-pass on the whole score
//     (gliding over tau s), gain. build / peak / lull (the release) / held (the last lull before the general: a held breath) / duel
//   barks: the squad's calls — text over the mate who says it + a radio click (no voice is synthesised, no file added): gap s between any two, cd per kind, not
//     within `radio` s of a radio line, a mate within R units; lines by kind ({who} = the fallen mate's name)
//   surface: the ground's sound — the shallows 'water', a bridge's deck, a paved yard, else the land's own
//   brass: a case's first bounce — g (× softK on the grounds in `soft`), at most one every gap s · blast: nearD = inside it a blast is never ducked and the small arms
//     dip under it (duck [to, down s, hold s, back s], as Z151), tail × its long rumble
export const AUDIOFX = { on:true, unit:1.3, c:343, seed:20261126, variants:3, pan:0.85, panD:6, floor:0.004, farD:45, tailNear:0.4, tailGap:0.2, tailWet:1.4, dens:{ win:0.05, min:0.4 },
  voices:{ max:26, phone:12, same:6, family:14, mergeMs:14, mergeR:3, mergeUp:1.2, mergeMax:1.5, fade:0.012, tau:0.35, hold:0.3 },
  prio:{ incoming:5, blast:5, radio:5, own:4, squad:3, enemy:2, far:1, foley:0 },
  cls:{ gun:{ ref:20, pow:1.25, lp:[17000, 700, 30], cap:0.32, tail:[0.16, 0.012, 0.85], near:[10, 34], slap:0.5 },
    supp:{ ref:9, pow:1.6, lp:[9000, 600, 16], cap:0.2, tail:[0.05, 0.004, 0.2], near:[6, 16], slap:0 },
    big:{ ref:30, pow:1.1, lp:[15000, 320, 46], cap:0.6, tail:[0.24, 0.011, 0.95], near:[16, 60], slap:0.6 },
    impact:{ ref:11, pow:1.5, lp:[16000, 900, 22], cap:0.2, tail:[0.1, 0.008, 0.5], near:[6, 20], slap:0 },
    thump:{ ref:22, pow:1.1, lp:[15000, 500, 30], cap:0.4, tail:[0.18, 0.01, 0.8], near:[10, 40], slap:0 },
    foley:{ ref:6, pow:1.7, lp:[14000, 1200, 14], cap:0.08, tail:[0.05, 0.006, 0.3], near:[4, 12], slap:0 },
    crack:{ ref:60, pow:1, lp:[18000, 8000, 300], cap:0, tail:[0.05, 0, 0.05], near:[8, 12], slap:0 } },
  occl:{ every:0.15, perFrame:4, perFramePhone:2, cell:4, keep:2.5, minD:3, maxD:90, gain:0.5, lp:900, tau:0.12, step:0.05, glide:0.04, eye:1.6, src:1.4, wetK:0.8 },
  jit:{ rate:0.02, gain:0.08 }, vars:[[1, 0, 1], [0.965, 0.003, 0.9], [1.04, 0.001, 1.12], [0.985, 0.006, 1]],
  tails:{ s:{ len:0.7, lp:900 }, m:{ len:1.1, lp:700 }, l:{ len:1.8, lp:480 }, x:{ len:2.6, lp:340 } }, supp:{ wet:0.25, slap:0 },
  guns:{ rifleShot:{ key:'rifleE', foe:1, mech:{ f:1100, g:0.035, at:0.04 }, tail:{ k:'s', g:0.22 } },
    shoot_ak:{ key:'ak', mech:{ f:850, g:0.04, at:0.045 }, tail:{ k:'m', g:0.26 }, var:[[1, 0, 1], [0.97, 0.004, 0.92], [1.03, 0.002, 1.1], [0.99, 0.007, 0.96]] },
    shoot_m4s:{ key:'m4s', cls:'supp', supp:1, mech:{ f:1500, g:0.05, at:0.012 }, tail:null },
    shoot_mp5:{ key:'mp5', mech:{ f:1300, g:0.03, at:0.03 }, tail:{ k:'s', g:0.16 } },
    shoot:{ key:'rifle', mech:{ f:800, g:0.04, at:0.06 }, tail:{ k:'m', g:0.3 } }, shoot_rifle:{ key:'rifle', mech:{ f:800, g:0.04, at:0.06 }, tail:{ k:'m', g:0.3 } },
    shoot_minigun:{ key:'minigun', mech:0, tail:{ k:'s', g:0.12 }, var:[[1, 0, 1], [0.975, 0.002, 0.94], [1.025, 0.004, 1.08], [1.01, 0.001, 0.97]] },
    shoot_shotgun:{ key:'shotgun', mech:0, tail:{ k:'l', g:0.3 }, var:[[1, 0, 1], [0.95, 0.003, 0.9], [1.05, 0.001, 1.1]] },
    shoot_cannon:{ key:'cannon', cls:'big', mech:0, tail:{ k:'l', g:0.35 }, var:[[1, 0, 1], [0.96, 0.004, 0.92], [1.04, 0.002, 1.08]] },
    shoot_agl:{ key:'agl', mech:0, tail:{ k:'s', g:0.2 } }, rocketlaunch:{ key:'launch', mech:0, tail:{ k:'m', g:0.25 } },
    enemyShoot:{ key:'enemy', foe:1, mech:0, tail:{ k:'l', g:0.3 } } },
  who:{ p:{ g:1, rate:1, lpK:1, tailK:1, mech:1, prio:'own' }, ally:{ g:0.85, rate:1.03, lpK:1, tailK:1, mech:0.6, prio:'squad' },
    e:{ g:0.95, rate:0.9, lpK:0.82, tailK:1.35, mech:0, prio:'enemy', eq:[650, 1.1, 5] }, x:{ g:1, rate:1, lpK:1, tailK:1, mech:0, prio:'enemy' } },
  crack:{ R:2.8, pow:1.6, floor:0.35, g:0.32, heavyK:1.3, heavyRate:0.72, rush:0.5, wet:0.6, v:740, gap:[0.045, 0.3], thump:0.75, thumpLp:520, thumpRate:0.85, thumpMin:14, thumpWet:1.3, thumpCap:3 },
  impact:{ R:60, gap:0.03, g:{ dirt:0.1, sand:0.09, stone:0.13, metal:0.12, wood:0.12, water:0.13 }, rico:{ metal:0.35, stone:0.14 }, ricoG:0.8 },
  brass:{ g:0.05, gap:0.05, soft:['sand', 'grass', 'snow', 'water'], softK:0.6 },
  blast:{ nearD:28, tail:0.4, duck:[0.5, 0.008, 0.09, 0.22] },
  map:{ explode:{ key:'boom', blast:1 }, bigexplode:{ key:'bigboom', blast:2 }, hit:{ key:'hitM', rico:0.12 }, hitHeavy:{ key:'hitH' }, ricochet:{ key:'ricochet' }, clang:{ key:'clang', cls:'thump' },
    thud:{ key:'thud', cls:'thump' }, crunch:{ key:'crunch', cls:'thump' }, reload:{ key:'reload', cls:'foley', own:1 } },
  space:{ every:0.5, rays:8, R:26, wallR:14, eye:2, wallN:3, skip:['tree', 'trunk', 'grass', 'tent', 'post'], valley:{ r:24, h:5, n:5 }, fade:0.7, wet:0.45, buildGap:220,
    phone:{ open:1, walls:1.25, roof:1.5, valley:1.3 },
    kinds:{ open:{ send:0.8, len:1.5, rt:1.0, pre:0.012, lp:5200, damp:0.5, build:0.02, spread:0.006, early:[[0.018, 0.4], [0.033, 0.28], [0.052, 0.22]], echo:[[0.34, 0.14], [0.62, 0.08]] },
      walls:{ send:1.15, len:1.1, rt:0.8, pre:0.004, lp:7000, damp:0.35, build:0.006, spread:0.004, early:[[0.009, 0.6], [0.016, 0.5], [0.024, 0.42], [0.037, 0.34], [0.055, 0.26]], echo:[] },
      roof:{ send:1.3, len:1.9, rt:1.6, pre:0.003, lp:4200, damp:0.8, build:0.004, spread:0.003, early:[[0.006, 0.6], [0.011, 0.5], [0.019, 0.45], [0.028, 0.36]], echo:[] },
      valley:{ send:1.0, len:2.8, rt:2.2, pre:0.03, lp:3600, damp:0.9, build:0.05, spread:0.011, early:[[0.03, 0.3], [0.07, 0.2]], echo:[[0.42, 0.3], [0.78, 0.2], [1.25, 0.13], [1.8, 0.07]] } },
    slap:{ min:3, R:26, apart:4, max:2, maxPhone:1, t:[0.02, 0.45], g:[0.34, 0.2], lp:[3200, 1400], glide:0.08, move:0.15 } },
  step:{ R:15, minV:0.35, runV:3, sprintV:5.4, maxV:30, cad:[1.8, 0.55, 2.9], crawlCad:1.1, fallback:0.7, own:0.085, npc:0.6, max:5, maxPhone:2,
    gait:{ walk:{ g:0.7, rate:1.05 }, run:{ g:1, rate:1 }, sprint:{ g:1.35, rate:0.93 }, crouch:{ g:0.4, rate:1.08 }, crawl:{ g:0.3, rate:0.8 } },
    surf:{ sand:1, grass:0.8, dirt:1, rock:1.1, snow:1, water:1.3, metal:1.1, wood:1.1 },
    kit:{ g:0.045, run:0.45, sprint:1, at:0.03 }, land:{ step:1.6, grunt:0.075, at:0.04 }, hoof:{ g:0.15, gap:0.045, slow:0.45, fullV:12, rate:[0.85, 1.05] } },
  limit:{ thr:0.8, top:0.98, head:2, n:2049 },
  duck:{ min:0.3, gun:0.45, speech:1, worldSpeech:0.8, blast:0.6, near:0.5, heatK:2.2, bigK:1.5, down:0.9, blastDown:0.5, glide:0.06, back:0.35 },
  deaf:{ R:9, pow:1.5, ref:1, min:0.12, lp:[20000, 480], hold:[0.25, 1.4], down:0.03, back:1.1, ring:0.02, ringUp:0.05, ringHz:[3300, 4100], ringT:[1.2, 4.5], beat:7 },
  music:{ tick:0.1, tau:1.2, open:20000, build:{ heat:0.2, byP:0.45, lp:9000, gain:1 }, peak:{ heat:1, lp:18000, gain:1.06 }, lull:{ heat:0.05, lp:2400, gain:0.8 }, held:{ heat:0, lp:600, gain:0.3 }, duel:{ heat:1, lp:18000, gain:1 } },
  barks:{ on:true, gap:5, radio:2.5, R:28, tick:0.25, h:2.5, size:13, color:'#cfe6a8', click:0.05, cd:{ reload:14, nade:9, down:6, kill:11, flank:15 },
    lines:{ reload:['Thay đạn đi, tôi yểm trợ!', 'Yểm trợ! Đội trưởng đang thay đạn!', 'Bắn kìm chân chúng — đội trưởng thay đạn!'],
      nade:['Lựu đạn ném đi!', 'Coi chừng — lựu đạn ra!', 'Lựu đạn! Cúi xuống!'],
      down:['{who} trúng đạn rồi!', '{who} ngã rồi — cứu thương!', 'Mất {who} rồi, giữ vị trí!'],
      kill:['Hạ một tên!', 'Trúng rồi!', 'Bớt một đứa!', 'Gục rồi, tên tiếp theo!'],
      flank_left:['Chúng vòng bên trái!', 'Bên trái! Bên trái có địch!'], flank_right:['Chúng vòng bên phải!', 'Bên phải! Bên phải có địch!'], flank_rear:['Sau lưng! Chúng vòng ra sau!', 'Địch phía sau, quay lại!'] } },
  surface:{ paved:'rock', bridge:'wood', biome:{ DESERT:'sand', RUINS:'dirt', ARCTIC:'snow', FOUNDRY:'metal', CITADEL:'rock', MEADOW:'grass', CITY:'rock', SAVANNA:'grass', VOLCANO:'rock', QUARRY:'rock', _:'dirt' } } };
// HIT 1 A MAN IS HIT, NOT A HULL — what HE hears and shows when he is struck (audio/body-hit.js, fx/soldier-fx.js, game/player-damage.js). No metal, no fire on him.
//   heavy = damage from which a round is a heavy hit (louder, a short ringing, the world muffled a moment) · plate = his plate carrier: a round arriving lo..hi m over
//   his feet ticks the plate with pIn, anywhere else pOut · snd = levels (thud the flesh / kevlar thwack, tick the plate, grunt his breath knocked out, gruntGap s apart;
//   blast his body thumped by a blast, debris the grit raining on him; gasp the sharp breath in fire, fireGap s apart; fall a landing gone wrong; ring the ringing ear,
//   ringHz, ringT s; muffle / muffleB = the whole mix low-passed to lp Hz for hold s, back in back s — a heavy round / a blast that hurt him; the sound layer only)
//   blood = on his body: mist puffs, drops thrown along the shot, y = the hit's height band (m) when it is not known, pool = splat radius on the ground at full / no
//   health, feet = how many stains land round his feet per hit (at most), within feetR m, every feetGap s at most; dark = colour at full → no health ·
//   horse / bike = the share of the hits on him that also strike the horse (it bleeds) / the motorbike (a spark, a tick of steel) · heat = fire on him: the screen's
//   warm edge op, its fade /s; smoulder sparks on his clothes for spark s after he first stands in it (n a tenth of a second), never again until he has been out reK s
//   vig = the red edge: a hit's flash and its fade /s, the standing edge from low (health share) up to its top · low = under this share of his health: heart (beat
//   period s at low → near nothing), breath s apart, their levels
export const BODYHIT = { heavy:22, plate:{ lo:0.95, hi:1.55, pIn:0.5, pOut:0.3 },
  snd:{ thud:0.62, tick:0.3, grunt:0.4, gruntGap:0.42, heavyK:1.45, blast:0.75, debris:0.35, gasp:0.32, fireGap:0.75, fall:0.6, ring:0.03, ringHz:[3500, 4300], ringT:[0.45, 1.0],
    muffle:{ lp:1100, hold:0.22, back:0.45 }, muffleB:{ lp:650, hold:0.5, back:0.9 } },
  blood:{ mist:5, drops:7, y:[0.95, 1.5], pool:[0.2, 0.36], feet:2, feetR:0.85, feetGap:0.35, dark:[0x8a1410, 0x3a0605] },
  horse:{ share:0.35 }, bike:{ share:0.3 },
  heat:{ op:0.6, fade:1.6, spark:0.8, n:2, reK:1.5 },
  vig:{ hit:1, fade:5.5, low:0.5, top:0.55 },
  low:{ below:0.3, beat:[0.62, 0.95], breath:2.6, beatG:0.5, breathG:0.22 } };
// SPACE — how much of the arena the fence encloses (custom battles); the campaign always fights on the full field
export const SPACE = { small:{ vi:'HẸP', k:0.72, tx:'đánh giáp lá cà' }, mid:{ vi:'VỪA', k:0.86, tx:'cân bằng' }, wide:{ vi:'RỘNG', k:1, tx:'cơ động, bắn xa' } };
// Z107 HULL FRONT MARKER — at speed the hull's heading is hard to read from above: a glowing chevron on the ground just ahead of the nose
//   (brighter while moving, dim at rest) + a bright stripe across the upper glacis. dist/size in hull units (× TANK_SCALE).
// Z381 THE GUN SEATED IN ITS TURRET (tank/seat-gun.js): a weapon mounted on a real Meshy turret is joined to it — a slim tube slides back into the
//   turret's face, a bulky gun (a pod, a twin mount) stays put; a gun whose back is still in the open then gets a mantlet round its back (a tube with
//   only air behind it, a sleeve). rear / rearK = the gun's back section (m, × its length) that gives its girth; slim = a tube's girth (half-size, m);
//   ring / rays = the rings of rays round a tube (× its girth), grid = the rays over a bulky back (× its half-size), hitK = the share that must meet
//   the turret's face (hitBulk: fewer will do over a bulky gun with no turret under it, its back wider than the face, when the face is within bulkReach m
//   of it; floorK: the turret under the gun); look = how far in front of the breech they start, reach = how far behind it they look (m);
//   deep = the line from behind to the turret's back; drop = how far below the gun the turret is looked for; side / peek / band = the rays that tell
//   whether its back is already in the turret (from how far out, how far behind its back, at ± band × its half-height / half-width); pick = which
//   face hit counts (0 the deepest, 1 the nearest; slidePick: how far a tube slides in); embed = how far a joint goes into the turret; back = what
//   stays between a tube's breech at full recoil (recoil × its slide) and the turret's back; maxShift = the most a tube slides; sleeve = a tube's
//   collar (a gap over min, girth k × the breech's within r, flared at the face, over = its run over the gun); block = the mantlet round a gun's
//   back (at most w wide; d of its back section; k × a bulky gun's half-size, tube × a tube's; lip = how far it stands over / under a tube, up = how
//   far up a bulky gun's back it reaches; over = how far forward it runs over the gun)
// Z107 CONTROLS SHEET — one list, shown from the home menu, the pause menu and in battle (H / F1 / ?). [keys, what it does, group]
export const KEYS_HELP = [
  [['W','A','S','D'], 'Đi lên · trái · xuống · phải THEO MÀN HÌNH — xe tự quay đầu về hướng đó (↑←↓→ cũng được)', 'LÁI XE'], [['Cách'], 'Lướt né — bứt tốc ngắn', 'LÁI XE'],
  [['Chuột'], 'Ngắm', 'CHIẾN ĐẤU'], [['Giữ chuột trái'], 'Bắn liên tục', 'CHIẾN ĐẤU'], [['1','…','8'], 'Chọn súng trong kho mang theo', 'CHIẾN ĐẤU'], [['Lăn chuột'], 'Đổi súng kế tiếp', 'CHIẾN ĐẤU'], [['R'], 'Nạp đạn — băng chưa cạn thì thay nhanh hơn (không phải lên đạn)', 'CHIẾN ĐẤU'],
  [['E'], 'Dùng kỹ năng', 'KỸ NĂNG'], [['Q'], 'Đổi kỹ năng', 'KỸ NĂNG'], [['Bấm chuột phải'], 'Dùng kỹ năng (nhanh)', 'KỸ NĂNG'],
  [['9'], 'Drone trinh sát — bay vòng phía trước điểm ngắm, đánh dấu địch (dấu đỏ xuyên tường, hiện trên bản đồ)', 'KỸ NĂNG'],
  [['0'], 'Drone FPV cảm tử — nhìn qua mũi drone: chuột lệch khỏi tâm hoặc WASD để lái, chúi xuống thì tăng tốc; chuột trái / E / 0 cho nổ. Đang lái thì lính đứng yên, không bắn được', 'KỸ NĂNG'],
  [['I'], 'Gây nhiễu — mọi drone địch trong 40 m mất lái, chìm xuống vài giây (rơi chạm đất là hỏng). Không có drone địch trong tầm thì không tốn lượt', 'KỸ NĂNG'],
  [['G'], 'Chạm: lính xuống / lên xe · Giữ: gọi lính trong tầm về', 'QUÂN TA'], [['T'], 'TẬP KẾT — gọi toàn bộ lính trên bản đồ về bên xe', 'QUÂN TA'],
  [['X'], 'XUNG PHONG — cả đội đánh thẳng vào thành gần nhất', 'QUÂN TA'], [['B'], 'Gọi trực thăng thả lính dù xuống cạnh xe', 'QUÂN TA'],
  [['Esc','P'], 'Tạm dừng', 'KHÁC'], [['−','='], 'Camera: thu xa · phóng gần', 'CAMERA'], [['[',']'], 'Camera: xoay trái · xoay phải 45°', 'CAMERA'], [['Giữ chuột phải + kéo','Giữ chuột giữa + kéo'], 'Camera: kéo ngang xoay quanh lính · kéo dọc nghiêng cao / thấp', 'CAMERA'], [['Giữ chuột phải + lăn chuột'], 'Camera: lăn lên gần · lăn xuống xa', 'CAMERA'], [['Tay cầm: giữ LT + cần phải'], 'Camera: xoay và nghiêng góc nhìn (bấm nhanh LT vẫn là kỹ năng)', 'CAMERA'], [['Ctrl/Shift + cuộn','Chụm 2 ngón'], 'Camera: zoom mượt (trackpad / chuột)', 'CAMERA'], [['Vuốt ngang 2 ngón'], 'Camera: xoay góc nhìn (trackpad)', 'CAMERA'], [['C'], 'Bật / tắt CAMERA TỰ ĐỘNG (tự lùi xa khi đông địch, chạy nhanh, gần thành, gặp trùm)', 'CAMERA'], [['V'], 'Đặt lại camera (độ zoom mặc định, hướng thẳng)', 'CAMERA'], [['M'], 'Bật / tắt nhạc nền (tiếng súng, tiếng nổ vẫn giữ)', 'KHÁC'], [['F3'], 'Bảng đo hiệu năng: FPS, thời gian khung, logic, GPU, lệnh vẽ', 'KHÁC'], [['G'], 'Lên / xuống ngựa · ngựa ở xa: huýt sáo gọi về', 'KỴ SĨ THÉP'], [['Space'], 'Trên ngựa: phi nước đại 5 s · đi bộ: chạy nước rút', 'KỴ SĨ THÉP'], [['C'], 'Đi bộ: quỳ / đứng dậy', 'KỴ SĨ THÉP'], [['Z'], 'Đi bộ: nằm / đứng dậy (nằm + di chuyển = bò)', 'KỴ SĨ THÉP'],
  [['H'], 'Mở / đóng bảng phím tắt này', 'KHÁC'], [['Enter'], 'Xác nhận bố trí trận địa', 'KHÁC'] ];
// Z110 AUTO CAMERA — on top of the zoom you picked, the camera pulls back by itself when the fight needs a wider view and eases
// back in when it's calm: speed, enemies close by, a fortress ahead, the boss. It never rotates by itself (screen-relative driving).
// Z184 CAMERA STYLE — cine (default): a low chase angle, the tank in the lower third, the battlefield and its forts ahead up to the horizon ·
//   tactical: the old high overview. off = camera offset from the look point [x, up, back] (phone: offM) · ahead = how far in front of the tank it looks ·
//   lookY = height it aims at · fov + speedFov = the lens widens a little at full speed
export const CAM_STYLE = {
  cine:     { off:[0,9.4,18.2], offM:[0,8.6,16.2], ahead:9.5, aheadM:6.5, lookY:3.4, fov:58, speedFov:4 },   // Z189 ~27°: a strip of horizon at the top of the frame
  tactical: { off:[0,28,23],  offM:[0,18,14.5],   ahead:0,  aheadM:0, lookY:1,   fov:54, speedFov:0 },
};
// Z184 player camera tuning (CÀI ĐẶT → GÓC MÁY): pitch in degrees, distance and look-ahead as × of the style, field of view in degrees
export const CAM_TUNE = { pitch:[16,72,4], distK:[0.55,1.9,0.1], fov:[40,80,3], aheadK:[0,2,0.25] };   // [min, max, step]
export const CAM_AUTO = { max:0.6, speedK:0.15, nearR:42, crowd:8, crowdK:0.32, fortPad:30, fortK:0.18, ease:0.9, every:0.25 };
// Z239 SMOOTH CAMERA — spring smoothing times (s, ~time to settle 60%): follow = the tank, lead = aim/motion look-ahead, yaw = turning the
//   view, zoom = zoom steps / pinch, dash = the pull-back during a dash (dashPull m), resume = glide back from a cinematic, kick = recoil shove ×,
//   fovEase = how fast the lens breathes with speed (1/s), orbit = mouse-drag / swipe turn rate (rad per px), wheelZoom = zoom per wheel notch ·
//   Z241 lift = heights (m) tried, lowest first, to see the tank over a wall in the way; liftT = how fast the camera rises / settles (s) ·
//   NO-TANKS 10 ground = how fast the lens follows the soldier's ground up a hill and down (s); the lift also clears a hill's crest and a big rock;
//   occIn = how fast it comes in past what the lift cannot clear (1/s); with no room to come in (his back to it) it goes up over him at topIn (1/s)
//   and stays up topHold s after it was last needed
// CAM 1 ("giữ chuột phải kéo để xoay góc camera tự nhiên · tay cầm giữ cò trái rồi dùng cần để đổi góc nhìn"): tilt = the view's elevation
//   offset (rad, min…max from the chase angle — ~27° on a ride, ~40° on foot), k rad a pixel dragged, the elevation itself kept within low…top
//   (12°…68°); tilted up, the look-ahead shrinks by ahead × and the aim / motion lead by lead × (at max) so he stays in frame; rdrag = the
//   right button turns into a drag past px pixels, a press let go inside tap s with no drag is still the skill; CAM 2 the wheel while it is held
//   zooms (zoomK × CAM_FEEL.wheelZoom a pixel: ~1.3× a mouse notch; down farther, up nearer) instead of changing gun; padLook = LT held, the right stick
//   turns (yaw rad/s) and tilts (rad/s) the view at full tilt, past dead; an LT let go inside tap s with no look is still LT's own action
export const CAM_FEEL = { lift:[0,3,6,9,12,16], liftT:0.32, ground:0.22, occIn:9, topIn:6, topHold:1, follow:0.09, lead:0.38, yaw:0.24, zoom:0.2, dash:0.22, dashPull:3.2, resume:0.6, kick:0.55, fovEase:5, orbit:0.0065, tilt:{ min:-0.3, max:0.65, k:0.004, low:0.21, top:1.19, ahead:0.9, lead:0.6 }, rdrag:{ px:6, tap:0.35, zoomK:1.6 }, padLook:{ yaw:2.6, tilt:1.5, dead:0.15, tap:0.3 }, wheelZoom:0.0016,
  ride:{ heave:0.55, buzz:0.012, bank:0.22, pitch:0.5, fovAcc:0.45, ease:6 } };   // Z301 the riding camera (heave share, road buzz m, bank share of the bike's lean, pitch share, FOV ° per m/s² of throttle)
// CAM 3 ROOM TO FIGHT ("tường thành chật, vào đồn camera bị tường che") — see: what stands between the lens and him (render/see-through.js) is cut
//   away round him and the ground he aims at (ahead m out): r = the cut's radius on screen (share of half its height; rM on a phone's wide, short screen), soft = its feathered share, far / ramp =
//   only what is more than far m nearer than him (feathered over ramp m), near = anything this close to the lens goes whole, k = the most cut, sweep =
//   how often new solids are let in (s), minH / maxW = a solid at least this tall, no wider (m: the ground and field-wide meshes never) ·
//   fort: inside a fort's walls (within inR m of its inner wall, feathered out to outR m past its outer radius) the lens climbs to pitch ° over him
//   at distK × its distance, its look-ahead cut by lead × (he stays off the screen's foot), easing at ease 1/s; the walls, towers and keep are cut, not climbed over (no lift for its walls) ·
//   occ (CAM 4): a building / rock face between them pulls the lens in only after it has blocked for delay s, holds hold s, eases in at inK 1/s; with
//   no room (his back to it) the lens stays out and rises at most rise m (the old leap to a top view is gone); buildings and rocks lift it at most
//   liftObj m (fort walls, our walls and a hill's crest still lift it the whole ladder); trees, branches and trunks never move it (they are cut) ·
//   yard (CAM 5, "không gian trong đồn ×2"): every fort's radius × rK (phones rKMobile, on top of FORT.mobileR: ×1.15 left the capital out of 1 in 4
//   of the 130 m fields — measured — so they keep their size) — twice the yard — and the desktop
//   field × arenaK (phones arenaKMobile) so the bigger forts still stand clear of our base, the fence and each other (FORT.count unchanged); the
//   yard's cover × coverK (the same density over the bigger yard), none within keepGap m of the keep / command post nor lane m of the line from
//   the gate to it (the assault's road in, the sally's road out)
export const CAM_ROOM = { see:{ on:true, r:0.5, rM:0.65, ahead:8, soft:0.45, far:0.5, ramp:1.2, near:2.0, k:0.94, sweep:1.5, minH:0.6, maxW:150 },
  fort:{ pitch:46, distK:1.0, lead:0.45, inR:1, outR:8, ease:1.4 },
  occ:{ delay:0.18, hold:0.6, inK:2.5, rise:1.6, liftObj:3 },
  yard:{ rK:1.4, rKMobile:1, arenaK:1.1, arenaKMobile:1, coverK:1.55, keepGap:7, lane:6 } };
// Z239 SCREEN SHAKE — the player's level (CÀI ĐẶT → RUNG MÀN HÌNH) scales every quake; NHẸ is the default. pos = metres at full trauma,
//   roll = radians, aberr = chromatic fringe at full trauma
// Z242 REALISTIC LIGHT — AgX tone mapping (film-like roll-off: highlights desaturate the way a camera does, no neon greens), a stronger sun against a
//   weaker sky / ambient / environment fill (real light-and-shadow modelling instead of flat, evenly lit "toy" scenes), a grade that keeps contrast and
//   colour but adds no vibrance boost, thinner haze. The per-battlefield ATMOS values are multiplied by these (expK × exposure, sunK × sun, …).
//   flora = colour multiplier on every leaf, frond and grass blade (muted, darker natural greens)
// Z245 THE WAR HORSE (actors/horse.js), metres: bodyY = barrel centre height · leg segment lengths [upper, cannon, pastern+hoof] · leg pivots ·
//   neckX / headX carriage · gaitV = speeds (m/s) where walk→trot→canter→gallop change over (gaitHys either side) · blendT = seconds to blend two gaits
export const HORSE = { size:1.12, coat:0x3a2416, bodyY:1.3, saddleY:0.37, neckX:0.72, headX:0.25, front:[0.58,0.35,0.22], hind:[0.6,0.42,0.2],
  legs:{ fx:0.19, fy:-0.2, fz:0.55, hx:0.2, hy:-0.14, hz:-0.6 }, gaitV:[2.0,4.8,9.5], gaitHys:0.35, blendT:0.35 };
// Z377 STEALTH (game/stealth.js): lying flat the soldier is seen only within see m of a shooter's eyes ([lying still, crawling faster than crawlV m/s]; measured
//   in 3D, so a guard up a tower or on a wall top sees less of him) × night at full dark; once spotted (close by, caught in a searchlight's pool lit × its
//   size, or by his own muzzle flash) every enemy within alertR m knows where he lies for keep s · say = s between his warnings · evade = the chance a round
//   that would hit him misses: going over in a combat roll, or running (run at full sprint, rising from v[0] to v[1] m/s), say = s between the "NÉ!" tags
export const STEALTH = { see:[8, 12], crawlV:0.3, night:0.7, alertR:30, keep:{ near:1.6, lit:3, shot:1.5 }, lit:1.15, say:2.5,
  evade:{ roll:0.7, run:0.15, v:[2, 6.2], say:0.35 },
  head:{ prone:0.45, crouch:1.15, stand:1.75, mounted:2.2 }, side:0.3, drop:0.3, sightT:0.15 };   // Z380 the top of his head over the ground by stance (m), his shoulders side m either way and drop m lower — the eye must reach one of them past every wall / house / cover; a shooter's look is kept sightT s
// AI 1 WHAT EACH ENEMY SOLDIER KNOWS, AND HOW HE FIGHTS ONCE HE KNOWS (ai/awareness.js, actors/infantry.js, ai/squads.js). Every man is UNAWARE (marches on a rough
//   report of where we are), SUSPICIOUS (heard or glimpsed something: stops, turns, walks to that spot) or ALERTED (combat). m, s, rad.
//   tick: s between one man's looks (each on his own phase — never a sight line per man per frame).
//   see: r = how far a man standing still-ish in daylight is made out; × stance, × still / run (over runV m/s), × cover (tucked behind a wall) × bush (among
//     bushes, reeds, under a tree: bushPad m round a plant at least bushS big), × night; an unaware man sees his front cone[0] rad either side in full, out to
//     cone[1] at × side, behind him × rear; inside near m he senses anyone; an alerted man looks all round (× alertK) and keeps a man he is watching in sight
//     out to r × track even if he drops flat. Lying flat the range is STEALTH.see (still / crawling) — the old stealth rule is this model's prone row.
//   spot: s of clear view to make him out at point-blank … at the edge of sight (t), the share at which he turns to look (sus), what fades a second unseen.
//   react: s between realising and the first shot (× reactK by the enemy's IQ: dull … sharp); reactHit when a round has just hit him.
//   hear: his own shots carry shot m (every man inside is alerted and knows the spot within shotErr m; gap s between two reports); a sprint run m, a horse
//     horse m and a motorbike bike m at full speed (runV m/s) make men suspicious. hit / death: a man hit knows within err m; a mate falling inside r m alerts.
//   shout: an alerted man shouts after delay s — his squad and every man within r m are alerted. keep: s without contact before alerted → searching (alert),
//     before the search is given up (search); for suppress s after losing sight he still fires at the last place he saw him.
//   search: he walks to within reach m of the last known spot, waits wait s, then moves on step m (far × the distance when we are far off), drift of it toward us (less the better hidden he is: in full only when he shows over see.r × hidK).
//   intel: a fresh man is told where we are to within err m. idle: an alerted man who has neither moved nor fired for max s goes for him for push s.
//   cover: seen inside threat m he runs to cover within search m and holds it hold s after losing sight; a new cover only once we moved repick m.
//   fire: an alerted rifleman reaches range × reachK (wider × farK past his own range), fires bursts of burst rounds gap s apart, rest s between them, each
//     round × dmgK on the player, leading him by lead of the flight; the group is wide rad across to begin with and tightens to tight (× stageK from stage 1
//     to 5+; blind fire at a lost man × blindK; × runK on a man running over zero.runV, and the rests × runRest: he is tracked, not hosed). zero: the group closes by gain a second while he stands (under slowV m/s; × walkK up to runV, × coverK behind
//     cover or in bushes, × iqK by IQ) and opens by loss a second once he runs or is out of sight. squad: the covering team closes to range × closeK; a broken
//     squad that has put breakR m between itself and us rallies at once.
export const AWARE = { tick:[0.22, 0.34],
  see:{ r:46, stance:{ stand:1, crouch:0.62, mounted:1.3 }, still:0.85, run:1.2, runV:5.2, cover:0.7, bush:0.5, bushPad:0.8, bushS:0.6, night:0.55, cone:[1.05, 2.1], side:0.55, rear:0.16, near:4, alertK:1.25, track:0.75 },
  spot:{ t:[0.25, 2.4], sus:0.45, decay:0.35 }, react:[0.4, 1.0], reactK:[1.25, 0.75], reactHit:0.25,
  hear:{ shot:70, shotErr:3, gap:0.2, run:14, horse:24, bike:42, runV:5.2 }, hit:{ err:4 }, death:{ r:20, err:6 }, shout:{ r:24, delay:0.45 },
  keep:{ alert:26, search:45, suppress:5 }, search:{ reach:5, wait:[1.2, 2.4], step:[8, 40], far:0.4, drift:0.6, hidK:0.6 }, intel:{ err:16 }, idle:{ max:1.5, push:2.6 },
  cover:{ threat:30, search:13, hold:5, repick:7 }, say:{ gap:0.6, r:55, size:17 },
  fire:{ reachK:1.35, farK:1.6, burst:[3, 5], gap:0.11, rest:[0.8, 1.3], dmgK:1.6, lead:0.5, wide:0.3, tight:0.04, stageK:[1.25, 0.75], blindK:1.3, runK:1.9, runRest:1.5 },
  zero:{ gain:0.42, loss:1.1, slowV:1.6, runV:4.5, walkK:0.35, coverK:0.5, iqK:[0.7, 1.3] }, squad:{ closeK:0.85, breakR:55 } };
// AI 2 HOW AN ENEMY SOLDIER COMES ONTO THE FIELD (campaign/entries.js) — never out of thin air inside the frame. minD: an edge entry is at least this far from the
//   player (m) and out of the camera's frame (pad: a margin round the frame, in half-screens; tries candidates; edgeIn m inside the fence); a man appearing is
//   "seen" inside the frame nearer than seeD m, or anywhere within nearD m of the player — such a man climbs out of a hatch instead: rise s coming up from
//   depth m below ground, hold s more before his first shot; the lid opens open s before the first man, one man every gap s; the tunnel network's own hatch
//   within reuse m is used, else a spider hole opens there and is filled in hole s later; ambush: the scripted ring of holes this far from the player (m).
export const ENTRY = { minD:45, pad:0.12, tries:12, edgeIn:4, seeD:130, nearD:30, rise:0.8, depth:1.75, hold:0.3, open:0.5, gap:0.45, reuse:7, hole:22, ambush:[17, 23] };
// DRONE 1–3 THE DRONE WAR (actors/drone.js the airframes, their wrecks and the buzz · combat/drone-skills.js his own three skills · campaign/drone-raid.js the
//   enemy's · ui/drone-hud.js what he is shown). on: false (or ?nodrones) = no drone flies, the three skills are off the list, the hat never draws a raid.
//   max: drones in the air at once, both sides (a launch past it is refused; wrecks: burning wrecks kept) · wreck: a downed drone falls at fall m/s², burns burn s.
//   size: how many times life size a quadcopter (0.6 m across) and the recon airframe are drawn — a real one is a speck from the follow camera.
//   recon (skill reconDrone, its own clock cd s): thrown from the hand, climbs climb m/s to alt m and circles (orbit m, spin rad/s) a point `ahead` m along his aim for
//     dur s; every tick s each enemy soldier within r m of the spot under it, the line from the drone to his head open and no roof over him (a block he stands in whose
//     top is roof m above the ground under him), is MARKED for mark s (at most markMax): a diamond over him through walls, a blip on the map, and his squad's men count a marked man
//     as × mateK as far when they pick a target. A marked man is not alerted. notice: every `every` s an enemy within r m may look up (p; × alertK once alerted) — he
//     holds his fire for look s, then puts a round at it (hit: the chance); at most max of them at once; hp rounds bring it down.
//   fpv (skill fpvDrone): a STOCK of stock a stage (the old DRONE crate gives one more, at most stockMax) and lock s between two — not a cooldown: a fixed stock makes
//     each strike a decision, bounds what one stage's general can lose to it, and gives the retired gunship crate a job. The view goes to the drone's nose (fov°): up
//     to dur s; it starts at v0 m/s and settles at cruise + dive × how steeply it points down − climbK × how steeply up (acc m/s²); the mouse off the middle of the
//     screen (dead: the still zone, in half-screens), WASD / the arrows, the pad's left stick or the phone's stick turn it (yaw, pitch rad/s; bank: the roll into a
//     turn); it goes off on whatever it strikes, or on FIRE / the skill pressed again once armed (arm s). Lost past range m from him, above ceil m it is pushed down,
//     and it is lost when he has taken hitExit of his health since the launch. mobile: false keeps it off phones (the view from the nose is unseen there).
//     blast: r m / dmg (the grenade's rule: a man in the core is dead), × struct on cover, towers and walls, direct on what it flew into, and a jet ahead of it —
//     jetDmg on every enemy within jet m inside cone rad of its line (× vehK on an aircraft) and on the first solid thing there; an airburst fades between airH m up.
//     The general: one capped slice a drone, like any other hit (actors/damage.js hitCap).
//   jam (skill jammer, cd s): every enemy drone within r m loses its link for t s — it sinks (sink m/s: the spotter, the kamikaze), sparks, forgets its fix; one
//     that lives through it needs rearm s before it may dive.
//   enemy (from stage `from`; the surprises' hat draws a raid with weight w, never within gap s of the last one, never in the general's duel; hold: no other
//     surprise for this long after one starts): kinds — spot: a quadcopter that comes in enterD m out, off the screen, circles him (orbit m at alt m) and, having
//     held him in view (within view m, the line open, no roof, no smoke) for hold s, gives him away: every enemy soldier within alertR m knows the spot and (mortarP)
//     a mortar round is laid on it (the surprises' own shell: ring, whistle; t s, the ring for the last warn s); it stays dur s, a new fix no sooner than refix s.
//     kami: an FPV with a charge — the buzz from the moment it is in the air (buzz: hz from far to near within r m, a chunk every `every` s, vol), a shout on the
//     radio, a marker on the screen's edge; it cruises at speed m/s, alt m up, and may not dive before warn s have passed (test.js: ≥ 3) — then down at dive m/s,
//     turning at most turn rad/s; sight of him lost for lost s it goes for the last place it saw him, loiters loiter s and dives there. hitR / hitY: the sphere
//     his rounds must pass through. From stage `two` a second one twoGap s behind the first. mates: his squad's men within r m fire on a drone (p every `every` s).
//   say: the radio lines (their own clock: gap s apart unless it must be heard) and the floating words.
export const DRONEWAR = { on:!(typeof location !== 'undefined' && /[?&]nodrones\b/.test(location.search)), max:5, wrecks:4, wreck:{ fall:14, burn:3.2, smoke:0.07 }, size:{ quad:2.2, recon:2.6 },
  recon:{ cd:35, dur:20, hp:3, alt:18, climb:7, speed:13, ahead:22, orbit:9, spin:0.75, r:35, tick:0.3, mark:9, markMax:24, mateK:0.6, roof:1.9,
    notice:{ r:34, every:0.7, p:0.2, alertK:1.6, look:[0.7, 1.2], hit:0.3, max:2 } },
  fpv:{ stock:2, stockMax:4, lock:6, dur:12, hp:2, arm:0.45, fov:84, v0:9, cruise:17, dive:16, climbK:6, acc:16, yaw:1.9, pitch:1.5, pitchMin:-1.35, pitchMax:0.85, bank:0.5, dead:0.08,
    ceil:45, range:150, hitExit:0.18, mobile:false, blast:{ r:5.5, dmg:260, struct:2.4, direct:420, jet:10, cone:0.5, jetDmg:240, vehK:1.8, fx:1.9, airH:[2.5, 9] } },
  jam:{ cd:30, r:40, t:4, sink:[2.5, 5.5], rearm:1.5 },
  enemy:{ from:2, w:1.3, gap:70, hold:14, enterD:[78, 95], kinds:{ spot:1, kami:1.2 }, two:4, twoGap:5,
    spot:{ hp:3, alt:17, speed:11, orbit:13, spin:0.55, view:30, hold:3, decay:1.5, dur:38, refix:12, alertR:60, mortarP:0.7, mortar:{ t:3.4, warn:2.6, R:5, dmg:40 }, hitR:1.7, hitY:1.9, score:120,
      hum:{ hz:[95, 150], every:0.11, vol:[0.01, 0.045], r:60 } },
    kami:{ hp:2, alt:13, speed:18, dive:25, turn:1.5, diveR:24, warn:3.2, lost:1.2, loiter:5, blast:{ r:4.2, dmg:62, edge:0.4 }, hitR:1.6, hitY:1.9, score:150,
      buzz:{ hz:[150, 420], every:0.085, vol:[0.025, 0.15], r:125 } },
    mates:{ r:38, every:0.6, p:0.16 } },
  say:{ gap:9,
    recon:['TỔ: Drone trinh sát đã lên — địch hiện trên bản đồ!', 'TỔ: Mắt thần đang quét phía trước — bám theo dấu đỏ!'], reconDown:['TỔ: Mất drone trinh sát — chúng bắn rơi rồi!'],
    fpv:['TỔ: FPV xuất kích — anh lo lái, bọn tôi che!'], fpvLost:['TỔ: Mất tín hiệu FPV!'], fpvHit:['TỔ: Trúng đích! Đẹp lắm!'],
    spot:['TỔ: Drone trinh sát địch trên đầu — bắn hạ nó hoặc tìm chỗ nấp!', 'TỔ: Có con mắt trên trời — nấp dưới mái, thả khói đi!'],
    fix:['SCH: Drone địch đã bắt được vị trí của anh — cối sắp rót, đổi chỗ ngay!', 'SCH: Anh bị lộ rồi — rời vị trí, địch đang kéo tới!'],
    kami:['TỔ: FPV cảm tử! Nghe tiếng vo ve — nấp ngay, bắn hạ nó!', 'TỔ: Drone tự sát đang lao tới — vào dưới mái, bật gây nhiễu!', 'TỔ: Có FPV! Thả khói, tìm công sự!'],
    kamiDown:['TỔ: Hạ được FPV rồi!', 'TỔ: Rơi rồi — bắn đẹp!'], jam:['TỔ: Gây nhiễu bật — drone địch mất lái!'], jamNone:'KHÔNG CÓ DRONE ĐỊCH TRONG TẦM',
    hint:{ kami:'⚠ FPV CẢM TỬ ĐỊCH!', kamiSub:'BẮN HẠ · NẤP DƯỚI MÁI · KHÓI · GÂY NHIỄU', spot:'⚠ DRONE TRINH SÁT ĐỊCH', fix:'⚠ BỊ DRONE ĐỊCH SOI — ĐỔI VỊ TRÍ!' } } };
// DIR 1 THE BATTLE'S DIRECTOR (campaign/director.js) — the fight round the player is read `sample` s apart (never per frame) into one PRESSURE 0…1 and the waves,
//   the surprises and the general are released by it. on: false (or ?nodirector) = it reads and decides nothing (the old clocks).
//   The reading: alerted men within nearR m count as near (an aircraft within airR m as two), a man who fired in the last fireT s as firing; the damage he took is
//   kept as a share of his health fading over tau.hurt s; pressure = w.hurt × that / ref.hurt + w.hp × how low his health is (from 1 − ref.hp[0] down to 1 − ref.hp[1])
//   + w.near × near / ref.near + w.fire × firing / ref.fire + w.stall × (men near and nobody fallen for ref.stall s) − w.calm × (not hit for ref.calm s), smoothed
//   over tau.smooth s. thr: under low it is "little to do", over high for hold s a PEAK (gone once under high × off); crit: health under this (hit in the last critT s) = nearly dead.
//   build: a peak is called no sooner than min s after a lull (never two back to back); the first escalation waits first s; pressure low for escalate s (the clock
//     runs × midK while there is something but not much to do) → escalate (cd s apart; one of these the first time, one more each time the pressure has still not
//     risen, up to maxActs): the next flankN entries of the wave come, knowing where he is, from his left / right / rear (sides: weights; spread rad round the bearing;
//     over the edge when that is ENTRY.minD…maxD m off and out of the frame, else a hatch hatchD m off), named on the radio cueT s later · up to intelN men within
//     intelR m who have not found him are told where he is (to intelErr m; at least intelMin of them) · a hostile surprise is played (no more often than surCd s) ·
//     the nearest fortress within sallyR m sends its next squad out now. reserve: the last share of each wave's queue (its set piece with it) waits for an escalation —
//     reserveMax s at most, then it comes round a flank anyway. meter: over this pressure the wave's queue and the fortresses' sallies wait — the queue at most
//     holdMax s, then `group` entries pass. peak: min…max s. lull: t s (the long end when he is nearly dead; extra s more while the pressure stays high), the men within contactR m
//     go to ground for ground s and every rifleman's rests between bursts are × fireK for as long as it lasts, no surprise until `surprise` s after it; drop: a medkit and ammunition when his health is under hp (cd s apart).
//   finale: on a field without a citadel the general comes lull s after the last wave, announced; the men in contact go to ground for ground s as he comes out; no
//     reinforcement and no surprise in the duel's first quiet s. radio: the director's own lines gap s apart; a peak is named peakP of the time, a new build-up buildP.
export const DIRECTOR = { on:true, sample:0.25, nearR:48, airR:70, fireT:1.6, logMax:80,
  tau:{ hurt:5, smooth:1.2 }, w:{ hurt:0.34, hp:0.22, near:0.14, fire:0.22, stall:0.08, calm:0.12 }, ref:{ hurt:0.3, hp:[0.15, 0.6], near:6, fire:4, calm:10, stall:[10, 30] },
  thr:{ low:0.18, high:0.58, off:0.8, hold:1.2, crit:0.3, critT:4 },
  build:{ min:14, first:18, escalate:8, cd:11, midK:0.4, maxActs:3, meter:0.36, holdMax:18, group:3, reserve:0.4, reserveMax:28, flankN:[3, 5], spread:0.7, maxD:95, hatchD:[40, 55], cueT:1.5, sides:{ left:1, right:1, rear:1.2 }, surCd:45, intelR:150, intelN:10, intelMin:3, intelErr:5, sallyR:160 },
  peak:{ min:5, max:16 }, lull:{ t:[10, 20], extra:6, ground:[3, 5], contactR:42, fireK:1.8, surprise:8, drop:{ hp:0.45, cd:90 } }, finale:{ lull:12, ground:[2.5, 4], quiet:25 }, radio:{ gap:14, peakP:0.5, buildP:0.4 },
  say:{ lull:['SCH: Tạm lắng — nạp đạn đi!', 'SCH: Chúng chững lại rồi — thay băng đạn, băng bó nhanh!', 'SCH: Địch nằm im — tranh thủ nạp đạn, đổi vị trí!'],
    drop:['SCH: Anh bị thương nặng — đã thả dù cứu thương và đạn ngay trước mặt!'], peak:['SCH: Chúng dồn lên rồi — bám công sự, giữ vững!', 'SCH: Hoả lực địch rất mạnh — đừng đứng một chỗ!'],
    build:['SCH: Chúng lại lên — vào vị trí!', 'SCH: Hết lặng rồi — địch đang áp sát!'], hunt:['SCH: Địch đã lần ra chỗ anh — chúng đang kéo tới!', 'SCH: Chúng biết anh ở đâu rồi — coi chừng các hướng!'], left:'SCH: Chúng đang vòng sườn trái!', right:'SCH: Chúng đang vòng sườn phải!', rear:'SCH: Địch vòng ra sau lưng — quay lại!',
    finale:'SCH: Trận địa lặng rồi — tướng địch sắp ra trận. Nạp đạn, băng bó, chuẩn bị!' },
  // DIR 2 TACTICS BY TIER (ai/tiers.js) — what the enemy's squads know grows with the stage (the tier: DIRECTOR.diff, a row a difficulty). on: false (or ?notactics) = the squads as before.
  //   scale: one value a tier — the reaction delay ×, the time to make him out ×, how far a shout carries ×, the squad's think interval ×, how far round a bounding squad flanks × (tier 1: not at all).
  //   pin (tier 2+): a squad of minMen or more, in contact farther than minD m, splits — `share` of it flanks for t s (then cd s of plain fire and manoeuvre, and the other side next time; over
  //     when he is closer than endD m): the flankers hop `step` m every hop s to the next cover along an arc that widens from arc[0] to arc[1] rad round him over sweep s at r m (rK × the range),
  //     silent until within `arrive` m of its end; the base fires with its rests × baseFireK (the machine gun × mgFireK), the flankers once there × flankFireK. The cue (the leader's shout +
  //     the radio naming the side) comes cueT s after they set off, at most once every cueGap s, for a squad within cueR m.
  //   nade (tier 3): he has stayed within campR m of one spot for camp s (the clock runs × openK when he is not behind cover) → a rifleman minD…maxD m off with a clear lob throws: "LỰU ĐẠN!",
  //     a sparking arc, FIELDCRAFT.nade's fuse + fuse s on the ground, dmg at its centre (× 1 + perStage a stage); the thrower holds his fire pause s; the next one cd s later, the clock restarted at `again` × camp.
  //   marksman (tier 3): `chance` a squad that one rifleman leaves it as a marksman (max alive): he keeps `keep` m off, reaches `range` m, and every cd s shows a glint (size glint m, growing)
  //     for tel s, following his man until lock s before the one round (dmg, bspeed m/s, err rad). mg (tier 3): `chance` a squad that one rifleman carries the machine gun (max alive): hp × hpK,
  //     bursts of `burst` rounds gap s apart, rest s between, each round × dmgK and the group × spreadK wide, every round a tracer; he never bounds — he covers.
  //   break: a squad falling back goes for a cover within search m of the point `back` m behind each man. surrender: the last man of a squad that started with minN0 or more, alerted and within
  //     r m of the player, gives himself up `chance` of the time (by tier): hands up for hold s, then he walks off the field (gone after leaveMax s once out of the frame); score for the prisoner.
  tactics:{ on:true, scale:{ react:[1.15, 1, 0.8], spot:[1.2, 1, 0.85], shout:[0.8, 1, 1.3], think:[1.25, 1, 0.8], flank:[0, 1, 1] },
    pin:{ minMen:4, minD:14, endD:9, share:0.4, t:[14, 20], cd:[8, 14], arc:[0.5, 1.45], sweep:9, r:[15, 26], rK:0.75, step:7, hop:1.5, arrive:4.5, cueT:1.2, cueGap:12, cueR:70, baseFireK:0.55, mgFireK:0.45, flankFireK:0.9 },
    nade:{ camp:8, campR:3.5, openK:0.6, again:0.45, minD:8, maxD:26, cd:[7, 11], fuse:0.5, dmg:70, perStage:0.08, pause:1.2 },
    marksman:{ chance:0.35, max:1, range:58, keep:44, tel:1.0, lock:0.3, cd:4.5, dmg:75, bspeed:140, err:0.012, glint:[1.1, 2.2] },
    mg:{ chance:0.5, max:2, range:40, keep:28, dmgK:0.6, hpK:1.4, burst:[9, 14], gap:0.085, rest:[1.0, 1.5], spreadK:1.5 }, roles:{ minMen:4 },
    break:{ back:16, search:9 }, surrender:{ minN0:3, chance:[0.6, 0.5, 0.4], r:45, hold:[5, 8], score:120, leaveMax:25 },
    say:{ mg:'SCH: Đại liên địch bắn kiềm chế — đừng đứng ngoài trống, vòng vào sườn nó!', marksman:'SCH: Có xạ thủ bắn tỉa — thấy ánh kính loé lên là lăn đi ngay!' } },
  // DIR 3 DIFFICULTY THAT CHANGES BEHAVIOUR (on top of BALANCE.difficulty's health / damage / reward): a row a setting — tier: the tactics tier by stage (recruit: riflemen who advance,
  //   take cover and fire, whatever the stage; veteran: the whole book from stage 1; one tier more each NG+ loop) · ease: × the director's pressure thresholds (under 1 = kinder: a peak
  //   is called and released at less pressure, the lulls are longer, the escalations slower) · count: × the men and squads of every wave · k: × the tier's awareness knobs (reaction
  //   delay, time to make him out, shout reach, squad think interval). arc: × the thresholds by stage (the campaign tightens). adapt: after `deaths` lives lost on the same stage the
  //   thresholds are × ease from then on (kept in the profile on this machine; taken back when the stage is won).
  diff:{ recruit:{ tier:[1, 1, 1, 1, 1], ease:0.85, count:0.8, k:{ react:1.3, spot:1.25, shout:0.85, think:1.2 } }, soldier:{ tier:[1, 2, 3, 3, 3], ease:1, count:1, k:{} },
    veteran:{ tier:[3, 3, 3, 3, 3], ease:1.12, count:1.2, k:{ react:0.8, spot:0.85, shout:1.2, think:0.85 } } },
  arc:[0.92, 1, 1.04, 1.08, 1.12], adapt:{ deaths:2, ease:0.85 } };
// EVENT 1 SIDE MISSIONS IN THE MIDDLE OF A FIGHT (campaign/side-missions.js) — optional, one at a time, at most perStage a stage, offered when the director has
//   room for more (campaign/director.js dirOfferOk: a build-up under the queue's meter — never a peak, a lull, the last lull or the duel) and no big event runs:
//   the first no sooner than first s into the stage, the next every s after the last one ended (asked again retry s later while the answer is no). Each has a
//   ring + a badge on the field, a mark on the minimap and a card with its timer; ignored, it costs nothing but its reward. on: false (or ?noevents) = none.
//   from: first stage · w: weight in the draw (never the same twice running) · its spot is minD…maxD m from him · tick: s between two looks · ring / badgeY:
//   the marker's drawn radius and the badge's height (m) · endHold: s the card shows the outcome · maxFoes: with this many enemies on the field a mission sends no more.
//   pilot — one of our aircraft crosses the sky trailing smoke (fly s at speed m/s, alt m up, gliding down over the last glide m) and goes down `past` m beyond
//     the pilot, who bails out over a spot crashD m from him and comes down under a canopy (sink m/s); a flare goes up every flareEvery s. An enemy patrol is
//     sent for him through the entries (campaign/entries.js): a man of it within catchR m of the pilot for catchT s with the player not beside him takes him.
//     Stay within r m for patch s in all: he joins the squad at hp of a man's health; strike: an air strike on the thickest knot of enemies. t: the timer (s).
//   truck — a supply truck of ours is bogged (sink m into the ground): be inside the circle (r m) for hold s in all while its crew digs. Every pull s up to pullN
//     enemies within pullR m who have not found him are sent to it, and `squads` come over the edge the first time he arrives; enemies within overrunR m with him
//     outside the circle for overrunT s set it on fire. Out, it drives off (speed m/s, gone after leave s) and leaves a medkit and an ammunition crate.
//   pows — an escort marches n prisoners (gap m apart, following at walk m/s) march m along the field's edge to its way out; the whole escort down before a man
//     of it is within exitR m of that point frees them: each takes up a rifle (hp of a man's health) and joins. score / xp: each mission's reward.
export const SIDEMISSION = { on:true, perStage:2, fromStage:1, first:[40, 60], every:[50, 80], retry:5, tick:0.25, minD:40, maxD:95, ring:6, badgeY:5.4, endHold:4, maxFoes:90,
  from:{ pilot:1, truck:1, pows:2 }, w:{ pilot:1, truck:1, pows:0.9 },
  pilot:{ t:90, r:5, patch:6, crashD:[50, 90], alt:38, speed:36, fly:7, glide:110, past:40, sink:4.2, flareEvery:2.4, catchR:4.5, catchT:2, hp:0.7, score:900, xp:60, strike:true },
  truck:{ t:85, r:12, hold:25, sink:0.3, pull:5, pullN:4, pullR:110, squads:1, overrunR:7, overrunT:6, leave:9, speed:8, block:3, score:800, xp:50 },
  pows:{ t:80, n:3, march:[55, 105], gap:1.6, walk:3.4, exitR:7, hp:0.6, score:1000, xp:60 } };
// EVENT 2 BIG BATTLEFIELD EVENTS (campaign/big-events.js) — they are drawn out of the surprises' hat with the others (campaign/surprises.js surpriseAdd), only
//   where the director allows a surprise and his health is over hpMin (campaign/director.js dirEventOk), never while a side mission runs: one at a time, at most
//   perStage a stage, gap s apart. from: first stage · w: weight in the hat. Each is announced `warn` s before it can hurt (never under 2.5 s: a banner, the
//   radio, a siren or an engine, and the danger drawn on the ground and the minimap). A blast takes no side: enemies, our men and the player (× playerK) alike —
//   never nearer than coreR m to the base's core. on: false (or ?noevents) = none.
//   bombing — `planes` bombers (wing m apart, alt m up) fly a line len m long through the thickest knot of enemies knotR m from him (else `ahead` m in front of
//     him): n bombs gap s apart from warn s on, each fall s in the air, across a lane `lane` m wide; a blast of R m, dmg at its centre. The line is drawn on the
//     ground from the first second and, when another line will do, is laid at least `clear` m from where he stands; the bombers fly on `off` m past it.
//   crash — a burning transport comes in (alt m up, speed m/s) and hits the ground minD…maxD m from him, its skid (skid m in skidT s, no nearer than `clear` m
//     to him) drawn on the ground: a blast (R, dmg) where it hits, fire along the skid (a cell every cellGap m: skidR m, skidDmg, burning burnSkid s), then a
//     wreck that stops rounds (block m) and cooks off: cookN blasts (cookR m, cookDmg) over cook s, the first cookWarn s after it stops; it burns for burn s.
//   fire — on the dry fields (biomes; not in the weather `wet`) a stray shell lands d m from him where the scrub is thickest of `tries` places (at least minFuel tufts within
//     fuelR m) and lit s later the grass is alight: a cell (cell m) smoulders warn s, then burns for burn s — dps to whoever stands in it (enemies × enemyK),
//     looked at every tick s — and every step s each burning cell lights the next with probability p (at most perStep a step), downwind inside a cone of ± cone
//     rad (creep: the share that goes any way), only where a tuft that has not burnt stands within near m, off the trails and out of the water; at most max cells, no farther than reach m
//     from where it began (× mobileK cells on a phone), no new cell after life s. Its smoke shuts sight lines: `veils` banks of smokeR m (game/stealth.js VEILS).
//   jam — warn s after the broken-up warning the radio falls silent, the minimap and the squad's cards show static for t s (the director holds the flank's cue).
export const BIGEVENT = { on:true, perStage:3, gap:55, hpMin:0.45, playerK:1, coreR:26,
  from:{ bombing:2, crash:1, fire:1, jam:2 }, w:{ bombing:0.45, crash:0.4, fire:0.45, jam:0.4 },
  bombing:{ warn:5.5, len:110, n:14, gap:0.28, fall:2, R:6, dmg:75, lane:6, planes:3, wing:12, alt:40, knotR:[20, 80], ahead:22, clear:14, off:160 },
  crash:{ warn:4.5, minD:38, maxD:75, clear:24, alt:42, speed:44, skid:30, skidT:1.8, R:7, dmg:80, cellGap:3.5, skidR:3, skidDmg:40, burnSkid:14, block:3.2, cook:10, cookWarn:2.5, cookN:[4, 6], cookR:6.5, cookDmg:45, burn:35 },
  fire:{ warn:2.5, lit:1.2, biomes:['DESERT', 'SAVANNA', 'MEADOW', 'QUARRY', 'VOLCANO'], wet:['rain', 'snow'], d:[24, 55], fuelR:12, minFuel:5, tries:16, near:4.5, cell:3.2, max:34, reach:42, step:1.1, p:0.55, perStep:3, cone:1.1, creep:0.15,
    burn:[10, 15], life:45, dps:12, enemyK:1.5, tick:0.5, veils:4, smokeR:8, mobileK:0.6 },
  jam:{ warn:3, t:20 } };
// EVENT 1–2 the radio lines of the side missions and the big events, added to the story's pools (campaign/story.js storyCue; STORY.lines' rules: p, cd, 'who|text')
Object.assign(STORY.lines, {
  ev_pilot:{ p:3, t:['Máy bay ta trúng đạn, phi công nhảy dù! Tới chỗ pháo sáng trước tốp địch!', 'mg|Máy bay mình cháy kìa! Phi công bung dù rồi — chạy tới chỗ pháo sáng!'] },
  ev_pilot_ok:{ p:3, t:['Đón được phi công rồi. Anh ấy cầm súng theo tổ — làm tốt lắm!', 'medic|Băng xong cho phi công. Còn bắn được — cho anh ấy vào hàng!'] },
  ev_pilot_lost:{ p:2, t:['Địch tới trước rồi — mất phi công. Đánh tiếp, đừng ngoái lại.', 'medic|Chậm mất rồi… Chúng tới chỗ phi công trước ta.'] },
  ev_truck:{ p:3, t:['Xe tiếp tế của ta sa lầy, địch đang kéo tới — vào giữ vòng tròn quanh xe!', 'at|Xe đạn của mình kẹt kìa anh! Ra giữ cho tổ lái đào bánh!'] },
  ev_truck_ok:{ p:3, t:['Xe ra khỏi lầy rồi. Tổ lái để lại thùng đạn và túi cứu thương cho anh.', 'mg|Xe chạy rồi! Có quà để lại kìa — đạn với bông băng!'] },
  ev_truck_lost:{ p:2, t:['Xe tiếp tế cháy rồi. Không còn gì ở đó — quay lại trận.', 'mg|Cháy mất xe đạn rồi! Tiếc đứt ruột!'] },
  ev_pows:{ p:3, t:['Địch đang giải tù binh của ta ra mép trận — chặn tốp áp giải lại!', 'medic|Người mình bị trói tay kìa! Hạ tốp áp giải trước khi chúng ra khỏi trận!'] },
  ev_pows_ok:{ p:3, t:['Tù binh tự do rồi! Họ nhặt súng và theo anh.', 'at|Các anh ấy nhặt súng rồi! Tổ mình đông thêm rồi anh ơi!'] },
  ev_pows_lost:{ p:2, t:['Tốp áp giải ra khỏi trận rồi. Ta sẽ tìm họ sau — đánh tiếp.', 'mg|Chúng lôi người mình đi mất rồi! Nợ này tôi nhớ!'] },
  ev_side_gone:{ p:1, t:['Hết thời gian — nhiệm vụ phụ huỷ. Trận chính vẫn còn đó.'] },
  ev_bomb:{ p:4, t:['Máy bay ném bom rải thảm đang vào! Rời khỏi vệt đỏ, ngay!', 'mg|Bom rải thảm! Chạy khỏi vệt đỏ — ta với địch đều dính cả!'] },
  ev_crash:{ p:4, t:['Một máy bay cháy đang lao xuống trận địa — tránh xa vệt đỏ!', 'at|Máy bay rơi! Nó lao xuống kìa — tránh ra anh ơi!'] },
  ev_crash_cook:{ p:2, t:['Xác máy bay còn nổ đạn — đừng lại gần vòng đỏ!', 'medic|Xác máy bay đang nổ lụp bụp. Tránh xa ra, tôi không muốn vá bỏng!'] },
  ev_fire:{ p:4, t:['Cỏ khô bắt lửa rồi, lửa lan theo gió — ra bãi trống hoặc đường mòn!', 'medic|Cháy đồng! Khói che hết tầm nhìn — đừng đứng trong lửa!'] },
  ev_jam:{ p:4, t:['Địch gây nh…ễu! …sắp mất liên l…c — bám địa hình, tự đ…nh…'] },
  ev_jam_end:{ p:3, t:['Liên lạc lại rồi. Bản đồ và tổ của anh đã lên sóng — đánh tiếp!', 'mg|Liên lạc lại rồi! Tưởng điếc luôn chứ!'] } });
// Z245 CAVALRY MODE (game/cavalry.js) — the general in full plate on his armoured charger, or on foot.
//   horse: walk / cruise (canter) / gallop (surge, dur s, cd s) speeds, back-up, accel/decel m/s², turn rate rad/s low → high speed · foot: run, sprint (dur, cd),
//   crouch-walk, crawl · radius (collision + hit size) · defK = damage taken × by posture (plate armour + a smaller target) · camK = camera distance × ·
//   mountR = reach to climb back on · call = the horse trots to your whistle at this speed · trample: galloping over infantry · recoilK = recoil × (no tank to soak it)
export const CAV = { horse:{ walk:1.8, cruise:7.5, gallop:16, back:1.4, accel:4.2, surgeAccel:6.5, decel:6.5, turnLow:2.6, turnHigh:1.05 }, surge:{ dur:5, cd:7 },
  foot:{ walk:1.5, walkT:0.55, run:4.8, sprint:6.2, fire:1.9, crouch:1.6, crawl:0.7, accel:7, decel:11, sprintDur:3, sprintCd:4 },   // Z368 a walk as he sets off; the key held walkT s and he runs
  // Z336 on his feet (game/soldier-moves.js): jump = take-off m/s, fall m/s², the landing's give s · roll = how long the roll lasts s, its speed m/s, how hard he is
  //   to hit going over (defK), cooldown s, its pivot height and how low it goes m, the kneel after it s · cover = how far ahead along his aim (probe points m) a
  //   block counts, its height band [min, max] m (up to kneel he kneels behind it), how slow he must be m/s (REALCAV.cv: the rifle laid rest m over its top, raised at most restMax)
  moves:{ jump:{ vy:4.4, g:15, land:0.25 }, roll:{ dur:0.8, v:4.6, defK:0.2, cd:1.1, pivot:0.68, sink:0.38, rise:0.4 }, cover:{ reach:1.4, probe:[0.45, 0.65, 0.85, 1.05], h:[0.5, 1.6], kneel:0.8, maxV:1.3 } }, radius:{ mounted:1.0, foot:0.45, prone:0.38 }, radius:{ mounted:1.0, foot:0.45, prone:0.38 },
  defK:{ mounted:0.55, stand:0.6, crouch:0.45, prone:0.3 }, camK:{ mounted:0.62, foot:0.5, prone:0.44 }, mountR:3.4, mountT:0.85, call:{ speed:9, arrive:2.6 },
  trample:{ v:8, dmg:70, r:1.4, cd:0.6 }, recoilK:0.25, atk:1.8, crit:0.18, fireK:0.85,
  soldier:{ hp:150, rifleK:1, fleeK:0.55, grenade:{ cd:9, r:4.2, dmg:85 }, smoke:{ cd:12, toss:5 }, medkit:{ cd:16, hp:45 },
    war:{ sizeK:1.5, squads:1, airFrom:3, w:{ rifle:6, rpg:1.2, heli:0.9, truck:0.3 } } },   // Z403 arty: enemy artillery at all (barrages, spotter SPGs, a battery, a boss's barrage) · rings: red rings on the ground warning of a blast   // Z309 his waves (campaign/soldier-war.js): size × the base wave, extra squads, an attack helicopter from wave airFrom (or stage 2), weights (no-tanks) · Z307 soldier mode (game/mode.js): his health (no tank upgrades on him), rifle rounds at full weight on a man (a hull takes INFANTRY.vsArmour), animals let him this much closer than a tank; his skills (combat/trooper-spells.js): grenade cooldown s / blast radius m / damage, smoke cooldown / toss m, dressing cooldown / health
  death:{ dur:3.8, carry:0.6, side:1.8, up:1.4, slow:0.7, swerve:1.6 } };   // Z254 killed: how long the death beat lasts (s), the share of the horse's speed he keeps as he is thrown, the sideways push and the hop (m/s), the riderless horse slowing (/s) and swerving (rad/s)   // atk = damage ×, crit = critical-hit chance, fireK = time between shots ×
// Z248 REAL CAVALRY (actors/real-cav.js) — calibration of the Meshy models: the operator's height (m); the saddle seat in the horse model (m, bind pose)
//   and the bone it rides on; the carbine's length (m), its pistol-grip and muzzle points in model units (+X to the stock); each clip's own speed (m/s at
//   timeScale 1, measured from its root motion) so feet and hooves keep pace with the game speed; cross-fade (s); the torso twist toward the aim (rad);
//   the carbine's pitch kept within [up, down] (rad, the clips aim a touch high); the prone clip lowered (m) onto the ground
// Z256 REAL TANKS (tank/real-tanks.js): one Meshy vehicle per family, dressed onto the designs listed; gearK = how high (× the deck height) the dropped
//   running-gear parts reach; dev = how far the width scale may stray from the length scale (the height keeps the model's proportion); overGear =
//   the hull's length over the procedural tracks' (fenders, the glacis and the rear plates run a little past them); tint = how much of the old hull colour the
//   texture keeps (the side still reads; the battlefield repaint tints it), shade = albedo × on top (the generated paint came out light); env = reflection strength; gun = [min length, max thickness] (× the
//   model's length) of the pieces taken as the main gun, [2] the lowest they may sit (× the model's height), [3] the least length / thickness of a
//   piece, [4] the shortest gun taken when nothing long is there (an IFV's autocannon)
// Z403 SIDE ID (world/sidepaint.js markSide · tank/materials.js sideCoat): ours and theirs told apart at a glance and at range. coat = how much of a real model's
//   own colour gives way to its side's paint, laid over the texture's light and shade (gain [min, max] = 1 / the texture's mean luminance, clamped); metal = how
//   much of the texture's metal the coat knocks back (paint is not bare steel); detail = how much of the texture's light and shade the coat keeps; bright = the coat's albedo × the paint colour; sat = its saturation × (paint, not plastic); paint = each side's colour before the battlefield shift (f ours olive drab,
//   e theirs desert tan — the shift still pulls them off the ground: theirs crimson on sand, ours only lighter or darker); rim = the side's colour round the silhouette (× rimK,
//   rimPow = how tight to the edge; the player's own tank keeps its skin and wears the rim); panel = the lime recognition panel on our captured tanks' turret roof (m)
// Z262 REAL TREES (world/real-trees.js): thirteen Meshy species, each at its true height h (m) before the tree's own ± scale; map = which species a
//   battlefield's procedural tree kinds become (variant i takes species i mod the list; `_` = everywhere else); wind = its direction, how far the top
//   sways (m), how far the leaves flutter (m); env = reflections; tint = albedo × per species
export const REALTREE = { trans:1.6, env:0.45, wind:{ dir:[1, 0.35], sway:0.45, leaf:0.06 }, tint:{},
  h:{ oak:15, linden:12, birch:11, poplar:18, pine:17, spruce_snow:14, palm:12, acacia:8, baobab:13, dead:9, cypress:14, olive:7, giant:30, quiver:3.4, rooibos:1, othonna:1 },
  map:{ _:{ broadleaf:['oak','linden','birch','poplar'], conifer:['pine'], coniferSnow:['spruce_snow'], palm:['palm'], acacia:['acacia'], baobab:['baobab'], dead:['dead'], ancient:['giant'],
    quiver:['quiver'], bushDry:['rooibos:0','rooibos:1','rooibos:2','rooibos:3','rooibos:4'], bushGreen:['othonna:0','othonna:1','othonna:2','othonna:3','othonna:4'] },
    MEADOW:{ broadleaf:['oak','linden','birch','poplar','oak','pine','linden','birch'] }, CITADEL:{ broadleaf:['olive','cypress','oak','cypress','olive','linden','olive','cypress'] },
    QUARRY:{ broadleaf:['olive','cypress','pine','olive'] }, RUINS:{ broadleaf:['linden','birch','oak','birch'] },
    CITY:{ broadleaf:['linden','oak','birch','poplar','linden','cypress'], palm:['palm'] } }, citySize:1.3,
  parts:{ rooibos:[1.3, 1.25, 1.05, 0.95, 0.7], othonna:[1.7, 1.4, 1.2, 0.9, 0.65] }, sway:{ rooibos:0.3, othonna:0.35, quiver:0.1 } };
// Z450 REAL BUSHES + SUCCULENTS (Poly Haven scans, CC0 — assets/models/real/tree/SOURCES.txt): quiver = the quiver tree (an aloe on a trunk, the
//   desert's / savanna's 'cactus'), rooibos = the dry wild-rooibos shrubs (every dry battlefield's bushes), othonna = the green Othonna shrubs (the
//   meadow's, the green verges'). A file of `parts` holds several plants, one mesh each: species 'rooibos:i' is part i, parts[i] its true height (m)
//   at the bush's mid scale; sway = × how far the wind bends it and flutters its leaves (a bush is not a 15 m tree; an aloe's leaves are stiff)
// Z450 PHOTO TUFTS (world/flora.js grass): every grass clump planted as flora or decor (the savanna's tall grass, the scattered tufts, the trails'
//   verges) is n crossed cards of the photographed clumps the carpet wears (GRASS.dir / cards) instead of the drawn blade atlas — h = the variants'
//   heights (m, × the clump's own scale), n = cards per variant, w = card width × its photo's aspect, lean = random tilt (rad), sway = tip bend (× height),
//   rootDark = the shade among the stems; per tone: the photo (dry = the dried grass) and its tint ×
export const TUFT = { h:[0.42, 0.58, 0.78, 1.0], n:[3, 3, 4, 4], w:0.72, lean:0.14, sway:0.12, rootDark:0.62,
  tone:{ green:{ tex:'diff', tint:[1.0, 1.06, 0.9] }, dry:{ tex:'dry', tint:[1.02, 0.95, 0.8] }, straw:{ tex:'dry', tint:[1.12, 1.03, 0.8] }, tundra:{ tex:'dry', tint:[0.85, 0.82, 0.74] } } };   // Z266 street trees: a city mix, a little smaller than in the wild (÷ citySize)
// Z262 TREE FALL (world/tree-fall.js): push = the starting swing (rad/s) a tank's ram gives, shotPush = a shell's / blast's; trunk = the trunk's hit
//   radius (m × the tree's scale), hitH = the height a round still strikes the tree; minDmg = the least damage a round needs to fell one; a blast of
//   radius r fells trees within blastK·r (blasts under minBlast m don't); g, cg = where its weight sits (× height); bounce = what is left after it lands
export const TREEFALL = { push:0.18, shotPush:0.7, trunk:0.75, hitH:9, minDmg:20, minBlast:2.5, blastK:0.75, g:9.8, cg:0.45, bounce:0.18,
  band:[0.4, 1.3], giantBand:[0.6, 2.2] };   // Z404 the trunk a vehicle meets: the drawn bark between band m over the foot (a giant's higher, over its roots), its median distance from the axis
// Z452 TOWER FALL (world/tower-fall.js): a watchtower / guard post / the radar mast shot down topples about the front edge of its base — g × gK (a little
//   quicker than life), cg = where its weight sits (× height), lean = how far it already leans as the legs give, kick = the starting swing (rad/s) the
//   hit gives, bounce = what is left of the swing after it strikes, restW = below this it stays down; bins = height bands its falling face is read in;
//   tearAt = the angle the footing tears out at; twist = its slew while falling (rad), yawSlope = its top slewing down a cross slope, slide = how far
//   (m) it skids on; roll: spring k, damping d, max (rad) about its own length, askew = the random part, lat = sideways travel × its half-width;
//   settle = s on the ground before it sleeps; foot = the torn footing (pad t m thick, piers to d m deep, rebar per pier, bar radius, colours);
//   pit = the hole (× footprint radius, depth / rim in m, decal ×); dust along the impact; shake by distance; keep = remains a battle keeps; chunk = a torn-off piece
export const TOWERFALL = { g:9.8, gK:1.3, cg:0.5, lean:0.05, kick:[0.28, 0.42], spread:0.3, bounce:0.22, restW:0.18, bins:10, tearAt:0.14, twist:0.12, yawSlope:0.5, slide:[0.3, 0.9],
  roll:{ k:9, d:3.2, max:0.38, askew:0.16, lat:0.55 }, settle:2.2, foot:{ t:0.55, d:1.3, pier:0.95, bars:[5, 9], barR:0.03, color:0xb9b3a5, rebar:0x6b4a33 },
  pit:{ r:1.05, depth:0.6, rim:0.22, decal:1.25 }, dust:{ n:12, size:[2.2, 3.8], life:[2.4, 4.2], op:0.42, cloud:4 }, shake:{ k:1.1, max:1.6, r:70 }, keep:12, chunk:{ g:9.8, e:0.28, mu:0.55 } };
// Z265 REAL STREETS (world/stone.js streetSurface): wet = the share of the street under puddles (0 = dry), wheel = how much darker the wheel paths,
//   oil = the drip line's strength, patch = the share of 3 m cells re-laid with newer asphalt, dampDark = how dark the damp rims, rough = roughness ×,
//   nrm = photo normal strength, env = reflection strength (the puddles mirror the sky), puddle = the wetness-noise level above which water stands (lower = more), mirror = extra sky reflection in it
export const STREET = { wet:0.9, puddle:0.55, mirror:3.5, wheel:0.2, oil:0.6, patch:0.08, dampDark:0.42, rough:1.0, nrm:1.4, env:1.0 };
// Z264 REAL CITY (world/real-city.js): Meshy buildings by role (tower / apartment / row — cut into floor slices) and vehicles (carFor = which model a
//   procedural car body becomes; L = its length in m, carTint = how far a car's paint colour tints the model); yaw = the turn that brings the model's front to +Z; share = the chance a lot takes a Meshy building
export const REALCITY = { pools:{ r:5.5, reach:1.5, col:0xffc888, k:0.55 }, env:0.8, share:1, asphalt:[0.62, 0.62, 0.64], pavement:[0.72, 0.72, 0.72], lawn:[0.78, 0.9, 0.62],   // street photo albedo ×
 
  blds:{ bld_glass:{ role:'tower', env:1.3 }, bld_apart:{ role:'apartment' }, bld_hotel:{ role:'apartment' }, bld_office:{ role:'apartment' }, bld_shophouse:{ role:'row' }, bld_shoprow2:{ role:'row' }, bld_villa:{ role:'villa' }, bld_spire:{ role:'skyline', env:1.25 }, bld_palmspire:{ role:'skyline', env:1.2 },
    bld_curve:{ role:'skyline', env:1.25 }, bld_nexus:{ role:'skyline', env:1.1 }, bld_rise:{ role:'skyline', env:1.1 } }, landmarkH:150, landmarkSink:0.035,   // Z268 the city's tower sinks a little into the plaza (Z426 the rest of the downloaded towers: skyline; NAMES 1 the real-tower scans retired)
 
  // Z267 the street furniture (world/real-city.js prepProp): h = height, w = width, s = scale (the Poly Haven scans are true size), glow = the material that lights at night
  props:{ prop_lamp:{ h:4.6, glow:'glass' }, prop_gate:{ s:1 }, prop_hydrant:{ s:1.1 }, prop_bin:{ s:1 }, prop_bench:{ s:1 }, prop_cafe:{ s:1 }, prop_chair:{ s:1 }, prop_barrier:{ s:1.3 }, prop_tarpcar:{ s:1.05 },
    city_fountain:{ w:11, sink:0.12 }, city_signal:{ h:2.1 }, city_stall:{ h:2.7 } }, glowCol:0xffd9a0, signalAt:2.5,
  // Z268 → Z420 the towers that stand with the city's tower (NAMES.cityTower) on the skyline (world/wonders.js): k = the model, h = its height (m), turn = its
  //   bearing off the landmark's (rad), out = its distance × the landmark's, sink. The CBD reads as a cluster: the glass spire to one side, the Palmspire
  //   just behind and beside the landmark, the centre of the far city
  skyline:[ { k:'bld_spire', h:124, turn:0.5, out:1.22, sink:0.03 }, { k:'bld_palmspire', h:136, turn:-0.2, out:1.42, sink:0.02 },
    { k:'bld_nexus', h:68, turn:-0.42, out:1.12, sink:0.02 }, { k:'bld_curve', h:108, turn:0.24, out:1.58, sink:0.02 }, { k:'bld_nexus', h:80, turn:-0.78, out:1.3, sink:0.01 },
    { k:'bld_spire', h:140, turn:-1.05, out:1.72, sink:0.02 }, { k:'bld_palmspire', h:118, turn:0.78, out:1.9, sink:0.02 }, { k:'bld_spire', h:165, turn:1.08, out:2.05, sink:0.03 } ],   // Z426 a far CBD (NAMES 1: generic towers only — the real-skyscraper scans are retired)
  // Z268 traffic (world/traffic.js): n vehicles (scooters motoShare of them), speeds m/s, lane offsets from the road's centre line [car, scooter]
  traffic:{ wheel:[0.33, 0.26], files:['moto_scooter','moto_escooter','rider_driver'], n:110, nMobile:44, motoShare:0.72,
    // Z310 wheel = the starting tyre radius [car, scooter] m (each model's own is measured from its mesh); grips = the middle of each scooter's rubber grip
    //   (its own frame as normalised to motoL: x out to his left, y up, z ahead), where the baked rider's hands close
    grips:{ moto_scooter:[0.335, 1.02, 0.245], moto_escooter:[0.32, 1.05, 0.34] },
    // Z306 struck / shot (world/traffic.js): health [car, scooter]; a knocked-down scooter lies downT s (gone once you are clearR m off); a struck or shot-at car
    //   stops haltT s; a burnt-out one burns burnT s, sunk sink m on its rims. Z320 hp: a carbine round (≈22) sets a scooter alight, a car takes four (it smokes
    //   below smoke of its health); a wreck sinks away in fadeT s; a blow slides it (the tarmac takes mu [car, scooter] of its speed a second) and turns it
    //   (spinK × the blow's lever, at most spinMax rad/s); a scooter goes over at tipV m/s, a car rolls onto its side at flipV; motoM = a scooter's mass to a car's; blastV = a blast's throw (m/s); flameK = a flame's bite on a vehicle × its bite on a man; the round that sets it alight throws it shotThrow m/s along its flight and hop m/s up [car, scooter]
    hit:{ hp:[70, 20], downT:8, clearR:25, haltT:6, burnT:5, sink:0.12, smoke:0.6, fadeT:1.6, mu:[2.0, 1.7], spinK:1.0, spinMax:4, tipV:0.6, flipV:7, motoM:0.35, blastV:9, flameK:3, shotThrow:5, hop:[2.6, 3.4] },
    // Z320 the lanes (m from the road's centre line): a street's scooters keep street (min, max); a boulevard's cars keep blvdCar off the median's kerb, its
    //   scooters blvdMoto; kerb = the room kept off a kerb; gap = the side clearance [car, scooter]. carStreets: cars on the narrow streets too (no: parked cars
    //   leave one car's width). drive: acc / brake m/s², T = time gap s, s0 = standing gap m, lat = sideways m/s [car, scooter], uturnV m/s; junc.yieldT = how
    //   long one road waits at a crossing before the other must let it through; stuckT = s stopped (out of farR m of you) before it goes round another way;
    //   spawnR = never closer to you than this
    lane:{ street:[0.85, 1.05], blvdCar:0.3, blvdMoto:[4.65, 5.35], kerb:0.3, gap:[0.28, 0.16] }, carStreets:false,
    drive:{ acc:[2.2, 3.0], brake:4, T:[0.9, 0.6], s0:[1.8, 0.9], lat:[1.0, 1.4], uturnV:[4, 4.5] }, junc:{ yieldT:2 }, stuckT:12, farR:50, spawnR:45,
    // Z269 rider liveries (jacket + helmet hue °, saturation, lightness ×), the bike each rides, share: app drivers in green, yellow, teal (electric scooter), plain navy / red jackets
    liveries:[{ name:'xanh-la', h:146, s:0.9, l:0.95, bike:'moto_scooter', w:0.28 }, { name:'vang', h:48, s:1.0, l:1.12, bike:'moto_scooter', w:0.2 }, { name:'xanh-ngoc', h:183, s:0.85, l:0.95, bike:'moto_escooter', w:0.22 },
      { name:'navy', h:222, s:0.4, l:0.55, bike:'moto_scooter', w:0.15 }, { name:'do', h:2, s:0.6, l:0.8, bike:'moto_scooter', w:0.15 }], lamp:{ carX:0.62, carY:0.42 }, motoV:[6,11], carV:[7,12], motoL:1.85, riderH:1.68, seatK:0.62, seat:[0.78,-0.12], respawn:14 }, skyHaze:0.3, windows:{ share:0.38, cell:[2.6, 3.2], k:0.85, frame:1 },   // Z280 lit windows at night: share of rooms on, room cell (w, storey) m, brightness
  lift:{ road:0.045, walk:0.125, prop:0.11 }, contact:{ op:0.55 },   // Z271 the city's raised surfaces (strips: road +0.04, pavement +0.12) — what stands on them is lifted onto them; contact-shadow strength
  flatHorizon:[[230, 0.42, 0.5, 140, 120], [130, 0.62, 0.34, 110, 90]],   // Z268 the city's far rings [distance, height ×, haze, count, depth] (Z399 haze 0.72 / 0.55 → 0.5 / 0.34: so veiled they read as flat card)
    // Z267 the skyline's distance veil (was ~0.62: flat pale blocks)
    // (the stone tower came out with a broken diagonal glass panel: left out)
  carTint:0.55, cars:{ car_sedan:{ yaw:1.5708, L:4.8 }, car_taxi:{ yaw:1.5708, L:4.6 }, car_suv:{ yaw:1.5708, L:4.9 }, car_van:{ yaw:1.5708, L:5.4 }, car_bus:{ yaw:1.5708, L:11 } },
  carFor:{ sedan:'car_sedan', hatch:'car_sedan', suv:'car_suv', pickup:'car_suv', van:'car_van', taxi:'car_taxi', truck:'car_van', bus:'car_bus' } };
// Z264 WALL SKINS (world/regional.js): the photographed set a fortress / Core wall pattern takes (`biome` overrides per battlefield); tint = how much of
//   the land's own stone colour tints the photo, bright = albedo ×, nrm / ao = normal and AO strength
export const WALLSKIN = { tint:0.35, bright:0.92, nrm:1.2, ao:0.8,
  pat:{ ashlar:'sandstone_blocks_08', brick:'red_brick_03', concrete:'t_concrete_wall_002', plate:'rusty_metal_02', log:'bark_brown_02', adobe:'red_plaster_weathered' },
  biome:{ CITADEL:{ ashlar:'sandstone_blocks_05' }, QUARRY:{ ashlar:'medieval_blocks_03' }, VOLCANO:{ ashlar:'medieval_blocks_03' }, HILLS:{ ashlar:'medieval_blocks_03' }, CAVERN:{ ashlar:'medieval_blocks_03' }, STEELMILL:{ brick:'factory_brick' } } };
// Z261 SHATTER (fx/shatter.js): a destroyed prop breaks into n pieces of its own mesh — thrown at `power` m/s out of the blast plus `up`, spinning
//   up to `spin` rad/s, falling at g, bouncing back `bounce` × the impact speed (above bounceMin m/s), lying `life` s, then sinking (sink m/s for
//   sinkT s); at most max pieces at once (maxMobile on phones); per kind overrides (fire = the pieces burn as they fly)
//   Z317 stone: perM pieces per metre of the stone (at least minN, at most its kind's n), all of them together fill × the stone's own volume — no lump
//   bigger than the stone it came from — gone after life s; every piece sinks at least as fast as it needs to be under in sinkT
//   Z319 pieces:false — nothing breaks into lumps, sheets or chunks any more: it blows up (a flash, dust, smoke, fire for what burns, fine grit) and is gone
// Z418 WHAT BREAKS, AND HOW IT GOES: sand = what a sandbag wall stands up to — it takes no harm from small arms (rifles, MGs, the 30 mm autocannon, shot,
//   fire), only from these round types (B41 / grenades / shells: HE, AP, HESH, TBX), an untyped round at least minDmg (their tanks' shells) and a blast at
//   least aoeMin m wide; a ram still crushes it · heaps: no heap of chunks is left where a thing broke (world/rubble.js, the brick walls, the city's
//   floors, a fort's breach) — it bursts into dust, smoke or fire and is gone · scar: a big thing broken leaves the ground torn up where it stood — a crater
//   (crater × its size + 0.8 m), a light grey burn (ash × its size + 1 m, ashK strong), a soil spray (geyser), and smoke [puffs, life s] at smokeOp
export const BREAKUP = { sand:{ by:['HE','AP'], minDmg:20, aoeMin:1.8 }, heaps:false, scar:{ crater:0.55, ash:1.35, ashK:0.8, geyser:0.9, smoke:[4, 5], smokeOp:0.24 } };
export const SHATTER = { pieces:false, n:10, power:7, up:3, spin:6, bounce:0.32, bounceMin:2.2, g:9.8, life:6, sink:0.35, sinkT:1.6, max:220, maxMobile:70, stone:{ perM:5, minN:3, fill:0.7, life:3.5 },
  kinds:{ drums:{ n:14, power:13, up:6, fire:true }, tires:{ n:9, power:8, up:5, bounce:0.6 }, crates:{ n:14, power:6.5, up:3 }, logs:{ n:9, power:7, up:3 }, sandbag:{ n:10, power:4, up:2 },
    concrete:{ n:10, power:5, up:2.5 }, jersey:{ n:9, power:5, up:2.5 }, pipes:{ n:10, power:6, up:3 }, teeth:{ n:8, power:5, up:2.5 }, hesco:{ n:9, power:4, up:2 },
    container:{ n:14, power:9, up:5, fire:true }, wreck:{ n:14, power:9, up:5, fire:true }, boulder:{ n:12, power:7, up:4 }, hedgehog:{ n:8, power:8, up:4 }, wire:{ n:10, power:6, up:3, spin:9 } } };
// Z259 PHOTO STONE (world/stone.js): env / ao strengths; per set the colour shown until the photo loads, the albedo × once it has (the scene's
//   exposure was tuned for darker procedural surfaces), the normal strength; pyramid = course height (m), texture tile (m), edge-strip depth (m),
//   share of edge strips cut short (ragged corners), share robbed out, where the smooth casing cap starts (× courses), its colour, tumbled blocks,
//   course tones (× the photo); rockTile = photo tiles per unit of a boulder's own size (triplanar); rockTint = albedo × on the boulders (their vertex
//   colours carry the battlefield's rock tint); hills = the far ranges' photo detail: aerial-photo tile (m) on gentle slopes, rock-face tile (m) on steep
//   ones, their mean brightness (the detail is brightness about 1), gain = its contrast, near = the detail strength × (1 − the ring's haze), the aerial set per battlefield
export const STONE = { env:0.5, ao:0.85, rockTile:0.55,
  sets:{ t_concrete_wall_002:{ fallback:0xe0d8c4, tint:[1.3, 1.24, 1.12], nrm:0.9 }, large_sandstone_blocks:{ fallback:0xc8a878, tint:[1.0, 0.89, 0.72], nrm:1.1 }, rock_face:{ fallback:0x6e6458, tint:[0.8, 0.76, 0.7], rockTint:[1.7, 1.7, 1.7], nrm:1.3 } },
  hills:{ tileA:45, tileR:18, meanA:0.42, meanR:0.38, gain:2.6, near:1.5, sets:{ _:'aerial_rocks_02', MEADOW:'aerial_grass_rock', SAVANNA:'aerial_grass_rock', CITADEL:'aerial_grass_rock', DESERT:'aerial_sand', QUARRY:'aerial_rocks_02' } },
  pyramid:{ course:1.25, tile:3, edge:2.2, ragged:0.55, gap:0.06, capFrom:0.82, casing:0xfff4e0, tumbled:14, tones:[0xffffff, 0xf4ece0, 0xfff8ee, 0xece2d2] } };
// Z258 MAGMA (world/magma.js): glow = emissive strength of the hottest melt (the bloom catches it); scale = crust plates per metre (≈ 1 / plate size);
//   bombEvery = seconds between the crater's lava-bomb bursts; cone = the volcano: foot radius R, rim height H, crater radius rc, lake depth below the
//   rim, gully depth (× radius)
export const MAGMA_FX = { glow:2.6, scale:0.55, bombEvery:1.4, cone:{ R:52, H:34, rc:11, lake:5, gully:0.06 } };
// Z257 REAL GUNS (tank/real-guns.js): the player's weapons per family — fromTank = take the real gun off that tank family's model, else the family's own
//   Meshy file (assets/models/real/gun/<family>.glb) with `front` = the model direction its muzzle points; dev = how far the width / height scale may
//   stray from the length scale (a tank's slim barrel fattens to a stubby gun's); glow = the procedural glowing parts stay on top; pair = one copy on each muzzle (twin guns); env = reflection strength;
//   tankTint = the colour a gun taken off a tank model is multiplied by (its texture patch came out pale)
// Z255 PHOTO SKY (world/sky-photo.js): a photographed pure-sky HDRI (Poly Haven, CC0; tools/sky-hdri.mjs) laid into the sky dome per hour of the day, and an
//   overcast one for storms — amt = how much of the photo shows (the procedural sky, clouds and lightning stay underneath), cloudK = how much of
//   the procedural cloud layer survives under the photo, fogMix = how far the fog takes the photo's horizon colour, midGrey = the exposure target
//   for the upper sky (tool), minEl = the lowest sun elevation the shadows take from a photo (rad)
export const SKY_PHOTO = { midGrey:0.24, cloudK:0.18, fogMix:0.5, minEl:0.2,
  tod:{ day:'kloofendal_48d_partly_cloudy_puresky', noon:'qwantani_noon_puresky', sunset:'kloppenheim_06_puresky' },   // night: the procedural stars / Milky Way / moon beat the photo
  mood:{ storm:'kloofendal_overcast_puresky' }, amt:{ clear:1, fair:1, dramatic:0.85, storm:0.9 } };
// Z254 RAGDOLL (actors/ragdoll.js) — a man shot down: gravity (m/s²) over the fall length (m); the round's push (rad/s at the start); twist while falling (rad);
//   how long the knees take to give (s); bounce on striking the ground (× speed) and the speed below which he does not bounce; limb spring stiffness /
//   damping; body thickness lying down and the sag as the knees go (× the man's scale); how long he lies before he sinks away (s)
export const RAGDOLL = { g:9.8, len:1.0, push:[0.5, 1.8], twist:0.45, buckle:[0.12, 0.3], bounce:0.22, bounceMin:1.1, k:36, damp:6.5, thick:0.13, sag:0.22, hold:4.2 };
// Z429 REAL ROCKS (world/real-props.js dressRock / realStones, world/cover.js): the field's boulders and loose stones as rock scans — a set per land (each
//   stone takes one at random), sunk a share of their height into the ground (sink), tinted per land; the boulders stand as outcrops: on the highest-sloped of
//   `tries` clear spots, a big stone (big m radius) with 0–around smaller ones (small m) gap m off its flank; sites = outcrops per lone rock the field used to get
//   · PERF 2 stoneKeep = the share of a scan's triangles the loose stones (instanced, everywhere) are drawn with
export const REALROCK = { biomes:{ DESERT:['rock_sandy', 'rock_slab'], SAVANNA:['rock_sandy', 'rock_slab'], MEADOW:['rock_mossy', 'rock_slab'], CITADEL:['rock_mossy', 'rock_slab'], RUINS:['rock_slab', 'rock_mossy'],
    QUARRY:['rock_slab', 'rock_sandy'], ARCTIC:['rock_slab', 'rock_dark'], VOLCANO:['rock_dark'], FOUNDRY:['rock_dark', 'rock_slab'], CITY:['rock_slab'], _:['rock_slab', 'rock_mossy'] },
  files:['rock_mossy', 'rock_sandy', 'rock_dark', 'rock_slab'], sink:0.22, env:0.45, stoneKeep:0.12, tint:{ ARCTIC:0xe6ecf2, VOLCANO:0x9a9290, QUARRY:0xe8e2d6 }, tries:9, sites:0.55, big:[1.7, 2.8], around:[0, 2], small:[0.8, 1.4], gap:[1.2, 2.6] };
// Z252 REAL COVER (world/real-props.js): the cover kinds that wear a Meshy model (Z426 the Czech hedgehog and the HESCO too), the share of the procedural
//   footprint they fill, the height cap (× the procedural height), environment-reflection strength; tint = albedo × for a piece whose texture came
//   out the wrong colour (logs grey, concrete white); matte = pieces of fabric / wood / concrete whose generated metal map must be ignored;
//   stretch = pieces filled to the footprint on each axis (the container came out nearly cubic)
//   Z420 the second Meshy batch: sandbag = a low sandbag barricade, concrete = a T-wall blast section, jersey = a weathered jersey barrier, container = three
//   real boxes (variants: each container takes one by its cv, its own paint — the drawn one's paint tint is not laid over a textured box; shade = how far its
//   brightness may wander, so a row of the same box does not read as clones)
export const REALPROP = { kinds:['sandbag','concrete','container','crates','drums','jersey','logs','pipes','teeth','tires','wreck','hesco','hedgehog'], fit:0.96, hMax:1.35, env:0.6,
  tint:{ logs:0xa07a52, pipes:0x9c9a92, teeth:0xa6a49c }, matte:['sandbag','logs','teeth','concrete','jersey','pipes','hesco'], stretch:['container'],
  variants:{ container:['container', 'container_teal', 'container_red'] }, shade:{ container:[0.82, 1.0] }, trueH:{ jersey:1.0 },   // trueH: m, the piece at its real-world height (a jersey barrier stands ~0.8–1.07 m; fitted to the drawn box it stood 1.84)
  // Z420 cast concrete takes the land's tone (× its texture): sand-washed in the desert, soot-dark at the works, cold in the snow — never a white slab on the field
  cast:{ kinds:['concrete', 'jersey', 'teeth'], tint:{ _:0xcbc5b9, DESERT:0xd9c29c, SAVANNA:0xcfb592, CITADEL:0xcdb89a, QUARRY:0xd4cfc3, RUINS:0xb2ac9e, MEADOW:0xbcb7a9, HILLS:0xbcb7a9, VILLAGE:0xbcb7a9,
    FOUNDRY:0x8c877f, STEELMILL:0x8c877f, VOLCANO:0x86796f, CITY:0xb4b2ac, ARCTIC:0xcfd5db, TUNDRA:0xc5c9cb, CAVERN:0x9a948a } } };
// Z251 GRASS CARPET → Z263 PHOTOGRAPHED GRASS (world/grass-carpet.js): clumps round the camera on grassy battlefields — radius (m; Rm on phones,
//   mobile:false = none there), grid cell (m), where (× radius) the carpet starts thinning out, clumps tried per cell, clump height range (m), how far
//   ahead of the camera the carpet centres (m), re-lay step (m), alpha cut-off, root shade; the photo strip (dir, its size in px, the five clump cards
//   [x, y, w, h] in px); per battlefield: density (0–1), tex 'dry' = the dry grass photo, tint = colour ×, dryTint = × on the odd drier clump
// Z322 far = how the carpet reads past its own radius: the floor there takes the carpet's colour (the clumps' photo average × tint) over `cover` × the
//   battlefield's density, fading in from rim0 × R to rim1 × R round the carpet's centre; k = brightness of that colour against the lit blades
export const GRASS = { far:{ cover:0.92, rim0:0.55, rim1:0.95, k:1.0 }, trans:1.4, R:40, Rm:12, rim:0.45, mobile:true, cell:0.5, perCell:3, h:[0.42, 0.78], ahead:8, step:1.5, alphaTest:0.42, rootDark:0.72,
  dir:'assets/grass/medium01/', atlas:[2048, 518], cards:[[402, 4, 598, 262], [1201, 20, 499, 218], [61, 254, 351, 264], [474, 272, 549, 246], [1181, 248, 436, 270]],
  biomes:{ MEADOW:{ dens:0.9, tint:[1.02, 1.1, 0.92], dryTint:[1.2, 1.05, 0.72] }, SAVANNA:{ dens:0.8, tex:'dry', tint:[1.0, 0.94, 0.82], dryTint:[1.1, 1.0, 0.85] },
    CITADEL:{ dens:0.32, tex:'dry', tint:[0.95, 0.92, 0.82], dryTint:[1.1, 1.0, 0.85] }, RUINS:{ dens:0.3, tint:[0.95, 0.98, 0.85], dryTint:[1.2, 1.05, 0.75] }, QUARRY:{ dens:0.22, tex:'dry', tint:[0.95, 0.92, 0.85], dryTint:[1.1, 1.0, 0.85] } } };
// Z250 PHOTO GROUND (world/ground-photo.js): per battlefield the photo-scanned CC0 sets (Poly Haven, fetched by tools/ground-photos.mjs) — [base, second]:
//   the base covers the field, the second shows through on steep faces, crater bowls and the field's bare patches. dual = how much the base is
//   blended with itself at another scale (breaks the tiling); nrm = normal strength; altRep = the second layer's tile × the base's
// Z405 hex = the hex-tiled lookup that replaced the Z263 patches (world/ground.js HX_GLSL): s = hexes per photo tile (bigger hexes keep more of the photo whole),
//   rot = share of a full random turn per hex (0: a photo's relief has a grain — turned hexes catch a low sun differently and the lattice shows as a honeycomb
//   from above, tried at 1 and 0.2; the random slide alone breaks the repeat), exp / con = how sharp the seams between hexes are and how much the photo's own
//   light / dark steers them; mobile = phones too (their second set and second scale take one turned lookup instead of their own lattice); hexPer = a
//   battlefield's own s / rot. nrmVar = how far the relief's strength drifts over the field (0 = even)
export const GROUND_PHOTO = { dual:0.45, nrm:0.9, altRep:0.8, patchK:0.55, noTile:true, ntFreq:0.32, hi:true,
  hex:{ on:true, mobile:true, s:0.7, rot:0, exp:5, con:0.6, lite:{ alt:1, dual:1, nrm:1 } }, nrmVar:0.35, hexPer:{},   // Z263 stochastic sampling (no repeat grid); ntFreq = patches per photo tile; hi = the base set at 2K (colour + normal) off phones
  // albedo × per battlefield: the scene's sun and exposure were tuned for the darker procedural ground — a photo albedo needs bringing down
  tint:{ _:[0.58, 0.6, 0.54], MEADOW:[0.9, 1.0, 0.72], HILLS:[0.47, 0.6, 0.39], VILLAGE:[0.52, 0.6, 0.44], SAVANNA:[0.7, 0.6, 0.5], DESERT:[0.76, 0.64, 0.5],
    TUNDRA:[0.8, 0.83, 0.88], ARCTIC:[0.84, 0.87, 0.92], CITY:[0.66, 0.66, 0.66], FOUNDRY:[1.02, 0.97, 0.92], STEELMILL:[1.02, 0.97, 0.92], VOLCANO:[0.72, 0.66, 0.62] },   // Z394 the works' concrete is a darker photo; the volcano's scree under its red light
  biomes:{
  MEADOW:['sparse_grass','forest_ground_04'], HILLS:['leafy_grass','rock_ground'], VILLAGE:['grass_path_2','brown_mud_02'], SAVANNA:['dry_ground_rocks','mud_cracked_dry_03'],
  DESERT:['aerial_sand','dry_ground_rocks'], TUNDRA:['snow_01','rock_ground_02'], ARCTIC:['snow_01','snow_03'], VOLCANO:['rocks_ground_02','brown_mud_rocks_01'],
  QUARRY:['rocks_ground_05','gray_rocks'], FOUNDRY:['concrete_floor_damaged_01','burned_ground_01'], STEELMILL:['concrete_floor_damaged_01','burned_ground_01'], CITY:['asphalt_01','cracked_concrete'],
  CITADEL:['rocky_trail','gravel_floor'], RUINS:['rocks_ground_02','rocks_ground_04'], CAVERN:['rock_ground_02','brown_mud_rocks_01'] },
  // Z394 the floors that read as paint (a near-featureless photo stretched over 370 m: trodden-flat snow, a brown road, smooth grey ash, plain sand) are
  //   built from the richer sets — the snow trampled and churned to earth in patches, the works a broken concrete yard black with soot and cinders, the
  //   volcano a scree of broken rock and cinder gravel (dark_rock's layered bands laid a tile grid on the floor), the desert's sand with its pebble beds, the savanna's red earth
  //   (a laterite photo so fine-grained it read as flat orange paint from the tank) now dry ground with its pebbles and dark patches — and these take more of their second set and a deeper relief:
  //   per = nrm (normal strength), patchK (share of the field the second set shows on), dual (the base blended with itself at another scale), altRep
  //   hi2k = the sets that have their 2K colour + normal on disk (assets/ground/<set>/2k, tools/ground-photos.mjs); any other base set loads at 1K
  //   (Z394c the new arctic, works and savanna bases fetched at 2K too)
  hi2k:['aerial_sand', 'asphalt_01', 'concrete_floor_damaged_01', 'dry_ground_rocks', 'gravel_road', 'ground_grey', 'red_laterite_soil_stones', 'rocks_ground_02', 'rocks_ground_05', 'rocky_trail', 'snow_01', 'snow_02', 'sparse_grass'],
  per:{ ARCTIC:{ nrm:1.3, patchK:0.95, dual:0.55 }, TUNDRA:{ nrm:1.3, patchK:0.9 }, FOUNDRY:{ nrm:1.2, patchK:0.8, dual:0.55 }, STEELMILL:{ nrm:1.2, patchK:0.8, dual:0.55 },
    VOLCANO:{ nrm:1.25, patchK:0.8, dual:0.5 }, DESERT:{ nrm:1.1, patchK:0.75 }, SAVANNA:{ nrm:1.25, patchK:0.85, dual:0.5 },
    CITADEL:{ nrm:1.3, patchK:0.9, dual:0.55 } },
  extra:['large_sandstone_blocks','rock_face','aerial_grass_rock','aerial_rocks_02','sandstone_blocks_08','sandstone_blocks_05','medieval_blocks_03','red_brick_03','factory_brick','t_concrete_wall_002','rusty_metal_02','bark_brown_02','red_plaster_weathered','pavement_02','corrugated_iron','weathered_brown_planks'], retired:['HILLS','VILLAGE','TUNDRA','STEELMILL','CAVERN'] };   // retired battlefields: no 2K copies   // Z259 not floors: the pyramids' limestone courses and the cliff / hill rock (world/stone.js)
// Z249 REAL INFANTRY (actors/real-troops.js): material roughness; Z254 seamInset = how far (rig units) a seam triangle's copy sits inside the next part;
//   team = albedo × per side (ours a cooler green cast, theirs a warmer red one); the old rig's helmet-top height (rig units) the real man is sized to; the troop carbine:
//   length (m), pistol-grip point (model units, +X to the stock), how far past the wrist bone the palm closes on it (m), bore height (model units);
//   stretch = [×, min length]: a triangle the pose made that many times longer than at rest (and longer than that, rig units) is dropped as a sliver; anchor = offsets (rig units) from the
//   right / left upper-arm and upper-spine bones to where an RPG, a slung AT tube and the pack-borne kit sit
// Z344 toeOut = each foot turned out (rad) when the legs are straightened for the cut; kneel = [kg the kneecap below the knee joint (rig m), front = the
//   left thigh's lift (rad, ~level), rear = the right thigh back from upright, shin = the right shin back from straight down (~along the ground)];
//   skin = the real kit drawn as one GPU-skinned body a side (actors/troop-skin.js) instead of nine rigid pieces a man; stride = the walk's thigh swing [walking, + running] (rad) and how far
//   the hips may dip at the widest of a stride (rig m: upright / in the combat crouch); Z346 carry = not firing, the rifle's dip under the horizon walking / running (rad), how
//   much of a forward lean the arms take back (firing: all), the chin lifted off the sights, how much of the lean the neck takes back, lying down the chin up
export const REALTROOP = { rough:0.85, top:1.62, stretch:[2, 0.05], seamInset:0.004, toeOut:0.12, kneel:{ kg:0.05, front:1.42, rear:0.12, shin:1.62 }, skin:true, stride:{ amp:[0.52, 0.18], drop:0.05, low:0.14 }, carry:{ walk:0.1, run:0.26, keep:0.75, look:0.1, head:0.85, prone:0.72 }, team:{ f:[0.9, 1.0, 0.86], e:[1.08, 0.93, 0.84] }, anchor:{ shoulderR:[0, 0.1, 0.06], shoulderL:[0, 0.09, -0.04], back:[0, -0.02, -0.24] }, gun:{ len:0.84, grip:[0.205, -0.07, 0], palm:0.07, boreY:0.045 } };
// Z295 the infantry arsenal (actors/real-cav.js; Tripo P2): which hand weapon the soldier carries for each of the game's guns, and each weapon's true length (m),
//   which end is the muzzle in the model (+z / −z), how far behind its middle the pistol grip sits (share of the length), lift = raised (m: the RPG rides the shoulder)
//   Z329 the soldier's own guns (data/guns.js t_*) map onto them too: each weapon he picks up is the one in his hands
export const INFGUN = { map:{ carbine:'ar', t_lmg:'lmg', t_minigun:'minigun', t_shotgun:'shotgun', t_sniper:'sniper', t_rpg:'rpg', t_gl:'gl', t_flamer:'flamer', t_energy:'energy', t_ak:'ak', t_m4:'m4', t_mp5:'mp5', t_rust:'rust', t_dmr:'dmr', t_rail:'rail', t_saw:'saw' },
  guns:{ ar:{ len:0.92, muzzle:1, grip:0.2, fit:true }, lmg:{ len:1.12, muzzle:-1, grip:0.18, fit:true }, minigun:{ len:1.15, muzzle:1, grip:0.22, fit:true }, shotgun:{ len:1.0, muzzle:-1, grip:0.22, fit:true }, sniper:{ len:1.42, muzzle:-1, grip:0.24, fit:true },
    rpg:{ len:1.05, muzzle:1, grip:0.05, lift:0.1 }, gl:{ len:0.82, muzzle:1, grip:0.18, fit:true }, flamer:{ len:1.0, muzzle:1, grip:0.14, fit:true }, energy:{ len:0.95, muzzle:1, grip:0.2, fit:true },
    ak:{ len:0.88, muzzle:1, grip:0.21, fit:true }, m4:{ len:0.95, muzzle:1, grip:0.21, fit:true }, mp5:{ len:0.68, muzzle:1, grip:0.1, fit:true },
    rust:{ len:0.98, muzzle:-1, grip:0.2, fit:true }, dmr:{ len:1.18, muzzle:-1, grip:0.24, fit:true, gripAt:0.2 }, rail:{ len:1.25, muzzle:-1, grip:0.24, fit:true, bore:'mid' }, saw:{ len:1.0, muzzle:-1, grip:0.22, fit:true } } };   // Z387 the four downloaded scans (their barrels laid along Z by the import tool, the muzzle at −z) · Z390 gripAt = where a pistol grip grown into its (thumbhole) stock is, share of the length; bore:'mid' = the bore through the middle of a thick muzzle shroud (actors/gun-fit.js)   // Z360 fit:true — held by the numbers read off its own model (GUNFIT, actors/gun-fit.js; the minigun and flamer still carried at the hip, their GUNHOLD hold and butt kept); the rpg (on the shoulder) keeps its hand-set GUNHOLD   // Z355 three real guns off Meshy's free (CC0) community gallery, cut to ~10k triangles
// Z297 HOLDING THE GUN FOR REAL (the special-forces soldier): where each weapon meets the body — butt (in the shoulder pocket), grip (the right hand, trigger
//   finger on the guard), fore (the left hand) as [share of the length from the middle toward the butt, metres above the middle]; hold = shoulder | top (the RPG
//   rides ON the shoulder) | hip (minigun, flamethrower); kick = [straight back (m), muzzle climb (rad)] per shot, rate = the recoil spring's stiffness
// Z298 reload: done only when it lasts long enough to be seen (min s — a quick-reload bonus skips it); the gun lowered (low rad), turned in (turn), canted (cant);
//   mag = where the magazine goes in (the RPG: its muzzle, the round goes in the front), bolt = the charging handle
// Z411 load = a weapon loaded at its muzzle (the B41): for the reload it comes off his shoulder — its pistol grip at [his right, up, ahead] (m) of his right
//   shoulder joint (no lower than floor m over the ground: kneeling, lying), the tube raised pitch rad muzzle-up and turned turn rad in across him — and the
//   left hand takes a round from the bag on his front (pouch: [his left, up, ahead] of his chest), holds it ahead[0] m out in front of the muzzle, pushes it
//   home to ahead[1] m; he looks down look rad at it; lying down (prone) the tube is drawn back along his right side, its muzzle low ahead of his head.
//   (It came from behind his back over his shoulder: the left arm swung round behind him.)
// Z416 clear = sat behind a driver aiming ahead (REALCAV.overDrv), the loading tube swung that much further out to his left, beside the ride — not over the driver's head
// Z345 palm = where along the weapon (share of its length from the middle, + toward the butt) the support palm takes the handguard from below — its height
//   found from the model (actors/real-cav.js palmSpot: rays cast up from below at the spot ± palmRays [along, across] m, the middle of what they meet), the palm's
//   middle palmGap m under it; reach = the share of the left arm's full length it may stretch to before the gun is brought across to the hand;
//   Z416 reachProne = the same lying down (the elbow planted, the arm out straighter: the 12.7's long handguard no longer drags it 3.5 cm back off the shoulder);
//   cup = the support hand's way [across to the far side, up, ahead] and how tight the fingers close (Z348: down and across from the near side, so the
//   hand wraps the handguard — it lay palm-up under it, catching it), wrap = the palm moved to the handguard's lower near side [toward him, up] (m);
//   gripR = the firing hand round the pistol grip [fingers ahead, across, down] and its palm moved [to his right, up] (m) off the grip point;
//   Z356 square = how far his chest stays bladed from the aim (rad, his right shoulder back); pocket [in from the shoulder joint, up, ahead] — the butt high
//   in the pocket; cheek = the cheek weld: the right eye from the head joint [right, up, ahead] (m), the neck's reach (m), the most bow / tilt (rad), how
//   much of the gap it closes, where the sight is (share behind the middle) and how far under the gun's top the eye looks through it (m)
// Z360 blade = a gun too long for his left arm even with the palm slid back: he turns further side-on to it [the pull (m) it starts at, his shoulders'
//   width (m: the left shoulder comes forward this much per radian), the ease back (rad/s) once it no longer pulls, the most (rad) on top of square, the share of it lying prone (Z365)]
export const GUNHOLD = { k:220, damp:0.75, body:0.35, pitch:[-0.42, 0.3], pocket:[0.05, 0.02, 0.03], palmRays:[[-0.012, 0, 0.012], [-0.012, 0, 0.012]], palmGap:0.014, reach:0.97, reachProne:0.99, cup:[0.7, -0.62, 0.25, 1.1], wrap:[0.024, 0.012], gripR:[0.75, 0.45, 0.35, 0.012, 0.0], square:0.2, blade:[0.005, 0.35, 0.15, 0.8, 0.9], cheek:{ eye:[0.03, 0.075, 0.09], reach:0.16, max:[0.75, 0.3], k:0.9, sightX:0.08, under:0.025 }, reload:{ min:0.75, low:0.5, turn:0.38, cant:0.55, drop:0.28 }, mag:[0.06, -0.12], bolt:[0.12, 0.04],
  ar:{ palm:-0.1, butt:[0.5, -0.01], grip:[0.215, -0.08], fore:[-0.1, -0.035], kick:[0.022, 0.03] }, lmg:{ palm:-0.12, butt:[0.5, -0.01], grip:[0.24, -0.08], fore:[-0.04, -0.05], kick:[0.02, 0.025] },
  minigun:{ palm:-0.14, hold:'hip', butt:[0.45, 0.0], grip:[0.28, -0.1], fore:[-0.02, 0.1], kick:[0.008, 0.008] }, shotgun:{ palm:-0.15, butt:[0.5, -0.02], grip:[0.27, -0.07], fore:[-0.12, -0.04], kick:[0.07, 0.14] },
  sniper:{ palm:-0.068, butt:[0.5, -0.02], grip:[0.27, -0.08], fore:[0.02, -0.05], kick:[0.09, 0.16] }, rpg:{ hold:'top', palm:-0.1, butt:[0.5, 0.0], grip:[0.31, -0.08], fore:[-0.06, -0.12], kick:[0.05, 0.1], mag:[-0.5, 0.0],   // GUN 1 butt 0.4 → 0.5: the tube's end on his shoulder, its pistol grip a forearm ahead of it (10 cm ahead, his right arm was folded to 15 % of its length)
   
    load:{ at:[0.06, -0.45, -0.06], pitch:0.6, turn:0.8, pouch:[0.15, -0.3, 0.18], ahead:[0.14, 0.05], look:0.2, floor:0.15, clear:0.7, prone:{ at:[0.06, -0.1, -0.3], pitch:0.15, turn:0.6 } } },
  gl:{ palm:-0.24, butt:[0.5, -0.01], grip:[0.18, -0.08], fore:[-0.12, -0.05], kick:[0.05, 0.09] }, flamer:{ palm:-0.12, hold:'hip', butt:[0.45, 0.0], grip:[0.26, -0.08], fore:[-0.05, -0.06], kick:[0.004, 0.004] },
  energy:{ palm:-0.14, butt:[0.5, -0.01], grip:[0.2, -0.08], fore:[-0.1, -0.04], kick:[0.015, 0.02] },
  ak:{ palm:-0.2, butt:[0.5, -0.01], grip:[0.21, -0.08], fore:[-0.2, -0.04], kick:[0.03, 0.045] }, m4:{ palm:-0.12, butt:[0.5, -0.01], grip:[0.21, -0.08], fore:[-0.12, -0.06], kick:[0.018, 0.024] },
  mp5:{ palm:-0.24, butt:[0.5, -0.01], grip:[0.1, -0.08], fore:[-0.24, -0.04], kick:[0.014, 0.018] },
  rust:{ palm:-0.15, butt:[0.5, -0.01], grip:[0.21, -0.08], fore:[-0.15, -0.04], kick:[0.032, 0.048] }, dmr:{ palm:-0.08, butt:[0.5, -0.02], grip:[0.25, -0.08], fore:[-0.04, -0.05], kick:[0.06, 0.1] },
  rail:{ palm:-0.1, butt:[0.5, -0.01], grip:[0.24, -0.08], fore:[-0.06, -0.05], kick:[0.05, 0.08] }, saw:{ palm:-0.16, butt:[0.5, -0.02], grip:[0.22, -0.08], fore:[-0.12, -0.05], kick:[0.05, 0.09] } };   // Z387 the four scans (fit:true: read off the models; these are the fallbacks)   // Z355 AK-47 · M4 · MP5
// Z339 THE SOLDIER'S OWN LEGS (actors/soldier-legs.js; m, s, rad, m/s): his speed smoothed (/s), the legs eased in / out (/s), moving above moveV;
//   the pelvis turns toward a sideways move above turnV (all of it by turnFull m/s, at turnRate rad/s, the forward / backward branch kept hyst past
//   the side); toes out; a foot more than urgent × a stride behind steps at once (the other's swing overlap done); the pelvis down at most maxDrop; a crossing step allowed once the feet are crossF apart fore / aft, swung crossArc round the other; stood still a foot steps back under him once it is yawStep off his heading or idle m off its place (idleT s a step, idleGap
//   apart); sway = how far the pelvis rides over the standing foot, roll / gaitYaw = its tilt and swing with the stride; the foot: slope = ankle → ball
//   when flat, toeH = the ball's height, toeFlat = the toes' slope with the heel up; reach = how straight a leg may go; backing up: cadence × backCad,
//   steps × backStep. Per stance: hips height (× the leg) over the ankle, the dip walking, the bob per step, feet half a track apart walking / stood
//   (stance, the left foot stagger ahead), never closer than gap, the longest stride a foot travels, the lift, cadence [min steps/s, + per m/s, max], the swing's
//   share of a step, how far ahead of the hips a foot lands (× a stride), how far the pelvis turns to a side move / a move backward; crouched, the lean forward
export const SOLDIER_LEGS = { velK:10, fade:7, moveV:0.15, turnV:0.35, turnFull:1.0, turnRate:5, hyst:0.26, toeOut:0.12, crossF:0.22, crossArc:0.14, urgent:0.35, overlap:0.6, maxDrop:0.12, yawStep:0.55, idleT:0.3, idleGap:0.2, sway:0.3, roll:0.05, gaitYaw:0.07,
  slope:-0.9, toeH:0.012, toeFlat:-0.12, reach:0.99, backCad:1.15, backStep:0.75,
  stand:{ maxV:2.4, hipK:0.945, dip:0.035, bob:0.026, half:0.1, stance:0.2, stagger:0.14, gap:0.12, maxStride:1.5, lift:0.07, cad:[1.8, 0.55, 2.9], swing:0.78, lead:0.45, idle:0.15, turn:0.95, turnBack:0.4 },
  // Z341 the firing positions: switchT = how long each change of position eases in (s); behind cover the rifle's bore lies coverRest over the top, the
  //   butt pocket is `pocket` over the hip joints, crouching behind higher cover by at most coverDrop; landing, the knees give landDip.
  //   kneel: hips turned right (rad), the pelvis' and the torso's lean, the knee pad's height, hips over the knee (× the thigh; lowest `low` m over it),
  //   the hips' place (ahead, right), the left foot out to the left and its toe turned toward the aim. prone: the legs' V (rad from straight back),
  //   how far they reach (× the leg), the ankle's height, crawling a knee drawn in (× the leg) and out (m), the crawl's rate (rad/s).
  //   air: the legs' reach at take-off and tucked (× the leg), how fast they tuck going up and reach going down, the knees forward, the left foot leading,
  //   out to the side, the toes pointed at take-off
  switchT:{ kneel:0.35, prone:0.5, air:0.12, stand:0.3, crouch:0.3, mount:0.25 }, coverRest:0.08, pocket:0.31, coverDrop:0.45, landDip:0.14,
  kneel:{ turn:0.55, lean:0.1, torso:0.2, kneeH:0.06, hipK:0.92, low:0.22, hipF:-0.02, hipR:0.06, footOut:0.06, footYaw:0.35 },
  prone:{ spread:0.28, reach:0.96, ankleY:0.09, pullIn:0.45, pullOut:0.3, crawlRate:5 },
  air:{ ext:0.97, tuck:0.55, rise:1.8, reachK:1.5, fwd:0.12, lead:0.1, out:0.03, point:0.6 },
  crouch:{ minV:0.25, hipK:0.68, lean:0.24, dip:0, bob:0.016, half:0.12, stance:0.18, stagger:0.08, gap:0.14, maxStride:1.0, lift:0.06, cad:[1.6, 0.4, 2.3], swing:0.8, lead:0.45, idle:0.15, turn:0.9, turnBack:0.4 } };
// Z342 GETTING ON AND OFF (actors/soldier-mount.js): the walk to the stirrup (m/s; at least walkMin, at most walkMax s), how far round the ride's end he
//   goes from its far side (m); per ride: its length (m), the climb on / off (s), where the left hand takes hold, and the key poses — u = 0…1 through
//   the climb; hips = the hip joints' middle, la / ra = the left / right ankle's spot (0 up = on the ground), all [left, up, ahead] of the point on the
//   ground under the seat (a 4th 1: up measured from the seat — the hips' height on a saddle or pillion, the floor of a bed); yaw = the hips' heading
//   off the ride's (−1.57: facing it from its left side); lean = the torso's lean forward (rad); lh = the left hand on its hold (0…1)
export const SOLDIER_MOUNT = { walkV:1.6, walkMin:0.25, walkMax:3.5, clear:0.7,
  horse:{ len:2.6, dur:{ on:1.8, off:1.5 }, grab:[0.06, 0.16, 0.3, 1],
    on:[{ u:0, hips:[0.62, 0.96, 0.1], yaw:-1.42, lean:0.05, la:[0.58, 0, 0.26], ra:[0.66, 0, -0.04] },
      { u:0.16, hips:[0.58, 0.93, 0.08], yaw:-1.42, lean:0.2, la:[0.3, 0.8, 0.14], ra:[0.66, 0, -0.04], lh:1 },
      { u:0.3, hips:[0.5, 1.02, 0.08], yaw:-1.42, lean:0.3, la:[0.3, 0.8, 0.14], ra:[0.62, 0, -0.06], lh:1 },
      { u:0.48, hips:[0.36, -0.07, 0.06, 1], yaw:-1.4, lean:0.5, la:[0.3, 0.8, 0.14], ra:[0.42, 0.92, -0.12], lh:1 },
      { u:0.62, hips:[0.24, 0.03, 0.02, 1], yaw:-1.15, lean:0.45, la:[0.3, 0.82, 0.14], ra:[0.02, 0.02, -0.84, 1], lh:1 },
      { u:0.75, hips:[0.08, 0.07, 0, 1], yaw:-0.5, lean:0.3, la:[0.28, 0.95, 0.16], ra:[-0.45, 0.04, -0.68, 1], lh:1 },
      { u:0.88, hips:[0, 0.04, 0, 1], yaw:-0.1, lean:0.12, la:[0.27, -0.6, 0.17, 1], ra:[-0.3, -0.5, 0.05, 1], lh:0.6 },
      { u:1, hips:[0, 0, 0, 1], yaw:0, lean:0, la:[0.27, -0.52, 0.17, 1], ra:[-0.27, -0.52, 0.17, 1] }],
    off:[{ u:0, hips:[0, 0, 0, 1], yaw:0, lean:0, la:[0.27, -0.52, 0.17, 1], ra:[-0.27, -0.52, 0.17, 1] },
      { u:0.14, hips:[0.02, 0.05, 0.02, 1], yaw:0, lean:0.35, la:[0.27, -0.6, 0.17, 1], ra:[-0.28, -0.56, 0.1, 1], lh:0.8 },
      { u:0.3, hips:[0.08, 0.07, 0, 1], yaw:-0.45, lean:0.38, la:[0.28, 0.95, 0.16], ra:[-0.45, 0.04, -0.68, 1], lh:1 },
      { u:0.44, hips:[0.22, 0.04, 0.02, 1], yaw:-1.15, lean:0.42, la:[0.3, 0.82, 0.14], ra:[0.02, 0.02, -0.84, 1], lh:1 },
      { u:0.56, hips:[0.36, -0.07, 0.06, 1], yaw:-1.4, lean:0.45, la:[0.3, 0.8, 0.14], ra:[0.44, 0.9, -0.12], lh:1 },
      { u:0.72, hips:[0.54, 0.98, 0.08], yaw:-1.42, lean:0.25, la:[0.3, 0.8, 0.14], ra:[0.64, 0, -0.04], lh:1 },
      { u:0.86, hips:[0.6, 0.94, 0.1], yaw:-1.42, lean:0.08, la:[0.58, 0, 0.26], ra:[0.64, 0, -0.04], lh:0.4 },
      { u:1, hips:[0.62, 0.97, 0.1], yaw:-1.42, lean:0.03, la:[0.58, 0, 0.26], ra:[0.66, 0, -0.04] }] },
  pillion:{ len:1.95, dur:{ on:1.25, off:1.05 }, grab:[0.15, -0.2, -0.38, 1],
    on:[{ u:0, hips:[0.56, 0.96, -0.06], yaw:-1.42, lean:0.05, la:[0.52, 0, 0.12], ra:[0.6, 0, -0.18] },
      { u:0.22, hips:[0.52, 0.94, -0.06], yaw:-1.35, lean:0.15, la:[0.52, 0, 0.12], ra:[0.48, 0.55, -0.42], lh:1 },
      { u:0.42, hips:[0.36, 0.97, -0.04], yaw:-1, lean:0.15, la:[0.48, 0, 0.12], ra:[0.05, -0.05, -0.52, 1], lh:1 },
      { u:0.6, hips:[0.16, -0.01, -0.02, 1], yaw:-0.45, lean:0.1, la:[0.42, 0, 0.14], ra:[-0.32, -0.42, -0.25, 1], lh:0.8 },
      { u:0.78, hips:[0, 0, 0, 1], yaw:0, lean:0.03, la:[0.38, 0, 0.15], ra:[-0.3, -0.54, 0.28, 1], lh:0.3 },
      { u:1, hips:[0, 0, 0, 1], yaw:0, lean:0, la:[0.26, -0.56, 0.28, 1], ra:[-0.3, -0.54, 0.28, 1] }],
    off:[{ u:0, hips:[0, 0, 0, 1], yaw:0, lean:0, la:[0.26, -0.56, 0.28, 1], ra:[-0.3, -0.54, 0.28, 1] },
      { u:0.2, hips:[0.03, -0.01, 0, 1], yaw:0, lean:0.05, la:[0.38, 0, 0.15], ra:[-0.3, -0.54, 0.28, 1], lh:0.5 },
      { u:0.4, hips:[0.16, -0.01, -0.02, 1], yaw:-0.45, lean:0.1, la:[0.44, 0, 0.13], ra:[-0.32, -0.36, -0.3, 1], lh:1 },
      { u:0.6, hips:[0.36, 0.97, -0.04], yaw:-1, lean:0.15, la:[0.5, 0, 0.12], ra:[0.05, -0.05, -0.52, 1], lh:1 },
      { u:0.8, hips:[0.52, 0.95, -0.06], yaw:-1.35, lean:0.12, la:[0.52, 0, 0.12], ra:[0.48, 0.5, -0.4], lh:0.6 },
      { u:1, hips:[0.56, 0.96, -0.06], yaw:-1.42, lean:0.05, la:[0.52, 0, 0.12], ra:[0.6, 0, -0.18] }] },
  bed:{ len:3.3, dur:{ on:1.2, off:1.05 }, grab:[0.55, 0.45, 0.1, 1],
    on:[{ u:0, hips:[0.95, 0.96, 0], yaw:-1.42, lean:0.05, la:[0.92, 0, 0.12], ra:[0.98, 0, -0.12] },
      { u:0.25, hips:[0.88, 0.98, 0], yaw:-1.42, lean:0.25, la:[0.5, 0, 0.1, 1], ra:[0.98, 0, -0.12], lh:1 },
      { u:0.5, hips:[0.55, 0.85, 0.02, 1], yaw:-1.3, lean:0.35, la:[0.5, 0, 0.1, 1], ra:[0.8, 0.35, -0.15], lh:1 },
      { u:0.72, hips:[0.3, 0.95, 0, 1], yaw:-0.8, lean:0.15, la:[0.4, 0, 0.1, 1], ra:[0.2, 0, -0.15, 1], lh:0.4 },
      { u:1, hips:[0, 0.97, 0, 1], yaw:0, lean:0, la:[0.12, 0, 0.1, 1], ra:[-0.12, 0, -0.1, 1] }],
    off:[{ u:0, hips:[0, 0.97, 0, 1], yaw:0, lean:0, la:[0.12, 0, 0.1, 1], ra:[-0.12, 0, -0.1, 1] },
      { u:0.3, hips:[0.35, 0.96, 0, 1], yaw:1.2, lean:0.05, la:[0.42, 0, 0.12, 1], ra:[0.3, 0, -0.12, 1], lh:0.5 },
      { u:0.6, hips:[0.7, 0.55, 0, 1], yaw:1.42, lean:0.2, la:[0.45, 0, 0.12, 1], ra:[0.95, 0, -0.1], lh:1 },
      { u:0.85, hips:[0.95, 0.95, 0.02], yaw:1.45, lean:0.05, la:[0.95, 0, 0.14], ra:[0.97, 0, -0.12], lh:0.3 },
      { u:1, hips:[0.98, 0.97, 0.02], yaw:1.45, lean:0.03, la:[0.95, 0, 0.14], ra:[1, 0, -0.12] }] } };
// Z451 CLIMBING (soldier mode, on foot: game/soldier-climb.js, actors/soldier-climb-pose.js) — J / the LEO button with a rock, a wall, a gate, a container,
//   a ruin within reach ahead. reach = how far past his body a face may be (m), cone = how square to it he must face (cos), scanT = how often the prompt
//   looks (s) · minH: lower is nothing to climb · stepH: up to it a vault / step up (vaultT s) · maxH: higher is too high · minW: the narrowest top he
//   stands on · flat: the least upward share of a top's normal he stands on · surf: m/s up each kind of face (hiK: slower each m over hiFrom m)
//   · stride: how far a hand-and-foot pair moves up at a time · off: hips / hands / feet / where he stands off the face (m) · hipStand: his hips stood
//   (m over his soles) · mantleT / mantleIn: the pull-over (s), where he stands up on top in from the edge (m) · reachT / edgeT / unslingT: the step to
//   the face, the walk to an edge to climb down, the rifle back off his back (s) · descK: climbing down × the climb's pace · deck: on top, a surface
//   up to stepUp higher is a wall, down to stepTol lower is the same deck, down to stepDown a hop, padIn = how far in from its rim he can stand ·
//   edge: pushing over the rim held s before he steps off · fall: g m/s², hurt over h m, perM HP each m past it, max HP, landing give s (×long over far m)
//   · cam: the lens pulled back × while on the face (rate /s) · range: the reach of his rifle +perM per m up, at most max · dome: a ridge rock's top
//   sags sag m to its rim
export const CLIMB = { reach:0.8, cone:0.45, scanT:0.12, minH:0.55, stepH:1.35, maxH:12.5, minW:0.45, flat:0.72, vaultT:0.75,
  kinds:{ boulder:'rock', fortwall:'stone', gate:'stone', ruin:'stone', building:'block', brick:'block', concrete:'block', hesco:'block', jersey:'block', bunker:'block', pumphouse:'block',
    container:'steel', wreck:'steel', shelter:'steel', genset:'steel', radartruck:'steel', sandbag:'crate', crates:'crate', drums:'crate', tires:'crate', ammostack:'crate' },
  rayKinds:['rock', 'stone'], noScene:/tree|pine|palm|oak|birch|bush|cactus|flag|pole|lamp|mast|antenna|wire|fuel|statue_soldier/, rockScene:/rock|stack|cliff|mesa|boulder|crag|arch_rock|horn/,
  surf:{ rock:0.75, stone:0.95, block:1.05, steel:0.9, crate:1.2 }, hiK:0.04, hiFrom:4,
  stride:0.42, off:{ hip:0.36, hand:0.07, foot:0.12, stand:0.52, handW:0.25, footW:0.14, handY:0.62, footY:-0.74 }, hipStand:0.95,
  mantleT:1.15, mantleIn:0.7, reachT:0.45, edgeT:0.45, unslingT:0.4, descK:1.25,
  deck:{ stepUp:0.55, stepTol:0.45, stepDown:1.7, padIn:0.14, q:0.3, scanRays:1 }, edge:0.45,   // (scanRays: new top rays the 8-a-second prompt may cast per look — the rest guess by the box until the climb itself measures)
  fall:{ g:15, hurt:6, perM:7, max:60, land:0.25, long:0.55, far:3 },
  cam:{ pull:1.35, rate:2.5 }, range:{ perM:0.025, max:0.25 }, dome:{ sag:0.35 } };
// Z349 THE POSE STUDIO (dev/pose-studio.js, tools/pose-studio.mjs): ok = a palm further than palm cm from the gun's surface, or an arm stretched past
//   that share of its length, is flagged; settle = seconds to wait after a weapon change / a stance; views = cameras round the soldier relative to where
//   he aims (side rad: − = his left; dist / up m; on = feet · hips · handL · handR; look = m above that)
// Z360 THE HOLD READ OFF THE GUN (actors/gun-fit.js; a weapon flagged fit:true in INFGUN.guns): its side profile in 40 slices along its length (x share:
//   −0.5 the muzzle … +0.5 the butt; y m). Lengths in metres. barrel = the most of a slice's height counted as barrel at the muzzle (a front sight does not
//   lift the bore); depth = how far under the bore a slice must hang to be part of a grip, a magazine, a foregrip or the stock; front = the length share
//   ahead of which nothing is looked for (muzzle brakes, flash hiders); split = a hang comes apart where it rises [0] above both deeper sides and is no deeper
//   than depth + [1] (the magazine from the grip, the grip from the stock); minW = the narrowest a part is (a sling swivel is not one); firm = the pistol
//   grip starts where it hangs this share of its full depth (its front edge, not the trigger guard); vfgW = the longest a foregrip is; vfgReach = the furthest
//   a foregrip is ahead of the magazine (further: a bipod); gripAhead = the right hand this far ahead of the grip's front edge; gripDown = down this share
//   of the grip's depth from the bore; vfgBehind = the left palm this far behind a foregrip; palmAhead = else this far ahead of the magazine; noMag = with
//   neither, this far ahead of the right hand (a pump's forend); hand = half a palm's width: a soldier whose arm is too short for the palm's spot slides it
//   back along the handguard, no nearer than this to the magazine; boreUp = the butt's contact this far under the bore (the sight line at one height over his shoulder on every gun; kept inside the butt pad); sight = the length shares the sight
//   (optic / rear sight: the highest point) is looked for between; loadPort = a gun without a magazine is reloaded this far ahead of the right hand.
//   recoil (every hand weapon, actors/gun-fit.js gunRecoil): s = ((dmg × frags / dmg₀ × kickK) / (len / ref)²) ^ pow, kept within s[0…1] — the round's push
//   over the gun's weight (the carbine: dmg₀ 12, ref 0.92 m → 1); per shot the gun kicks back back × s (m), its muzzle climbs climb × s (rad), and it twitches
//   a random yaw × s aside and roll × s round its bore (rad). carry = Z360 the gun carried across his chest at a sprint (port arms): its grip at [his right,
//   up, ahead] (m) of his chest, the muzzle turned yaw (rad) across to his left and up (rad, × (ref / len)^½: a long gun lies flatter), rolled (rad);
//   rate = how quickly he brings it there and back (1/s).
//   Calibrated on the hand-tuned carbine (palm −0.1, grip [0.215, −0.08], butt −0.01, sight 0.08): the fit gives them back within a centimetre.
//   ok = the thresholds the studio's report holds every soldier × weapon × stance to: palm = a palm off the gun's surface (cm); stretch = an arm out to this
//   share of its length; pull = the gun dragged off his shoulder pocket for the left hand to reach it (cm); muzzle = the muzzle point off the model's bore (cm)
export const GUNFIT = { barrel:0.03, depth:0.115, front:-0.42, split:[0.05, 0.04], minW:0.035, firm:0.7, vfgW:0.065, vfgReach:0.25, gripAhead:0.018, gripDown:0.76,
  vfgBehind:0.028, palmAhead:0.09, noMag:0.27, hand:0.045, boreUp:0.089, sight:[-0.15, 0.3], loadPort:0.1, recoil:{ dmg:12, ref:0.92, pow:0.8, s:[0.3, 3.5], back:0.02, climb:0.03, yaw:0.012, roll:0.03 },
  carry:{ at:[0.08, -0.16, 0.3], yaw:0.95, up:0.75, roll:0.55, rate:6 }, ok:{ palm:4, stretch:0.995, pull:3, muzzle:1.5 } };
export const POSE_STUDIO = { ok:{ palm:4, stretch:0.995 }, settle:{ equip:0.6, stand:1.4, crouch:1.6, prone:2.0, mount:1.2 },
  views:{ stand34:{ side:-0.55, dist:2.5, up:1.35, look:1.05 }, front:{ side:0, dist:2.6, up:1.4, look:1.1 }, left:{ side:-1.57, dist:2.6, up:1.25, look:1.0 }, right:{ side:1.57, dist:2.6, up:1.25, look:1.0 },
    back:{ side:3.0, dist:2.4, up:1.6, look:1.15 }, handsL:{ side:-0.8, dist:0.65, up:0.12, on:'handL', look:-0.02 }, handsR:{ side:1.1, dist:0.8, up:0.18, on:'handR', look:-0.05 },
    kneel:{ side:-0.6, dist:2.2, up:1.0, look:0.7 }, prone:{ side:1.2, dist:2.4, up:0.9, look:0.2 }, mount:{ side:-1.2, dist:3.8, up:1.9, look:1.5 }, mountBack:{ side:2.4, dist:3.6, up:2.0, look:1.5 }, mountSide:{ side:-1.75, dist:3.4, up:1.7, look:1.45 }, kick:{ side:1.57, dist:1.2, up:1.4, look:1.35 } } };   // (Z360 kick: close on his right side, fixed to him — a shot's recoil seen against his body)
// GUN 1 HANDLING THE GUN LIKE AN INFANTRYMAN — the soldier on his feet (actors/gun-hands.js, actors/real-cav.js holdReal; m, rad, s). hold: what the
//   audit of both soldiers × 16 weapons × stand / kneel / prone found wrong, as rules:
//   grip = the firing hand's palm moved [back onto the pistol grip, up it] from the fitted grip point (it sat ahead of the grip, low: the fingers closed on
//   air under the trigger guard), gripPole = where the right elbow goes [up, his right, ahead] of the shoulder (out a little: a forearm nearer level);
//   wrist = the most [the firing, the support] wrist may bend — past it the hand gives toward the forearm;
//   trig = the trigger: `ahead` of the grip's front edge, `up` over the bottom of the guard there, within lo…hi under the bore; the finger's last joint
//   `side` to its right and `face` ahead of it, its pad curled [across, back]; off the trigger (running, carrying, reloading) laid safe = [over the
//   guard, ahead, out on the right side]; bare = a hand-set weapon's trigger [ahead of, over] its grip point;
//   reach = the support arm: comfortable out to comfort of its length (prone: the elbow on the ground), past it by dead[0] the left collar bone comes
//   forward (proK rad/s per unit, at most protract rad, back at `back` rad/s once it is dead[1] inside) and then the chest turns further side-on (k rad/s
//   per unit, at most blade rad more: GUNHOLD.blade's own pull rule may still go beyond); hardProne = the reach lying down before the gun is drawn to the hand;
//   cheek = the cheek weld: the head first brought near upright (head = bowed forward at most, tilted at most, bowed back at most −), then bowed / lifted
//   within bow and tilted at most tilt for the sights (iter passes); the gun comes the rest of the way to the eye — the butt up to `up` (m: lower / higher
//   than the pocket; BODY 5 −0.11 / bow −0.3: lying down behind a tall scope — DMR, 12.7, SAW, rail — his eye stood 7–10 cm under the sight line) and `in` toward his neck, at rate /s; the eye still `side` m left of the sights turns the chest side-on (bladeK rad/s per m); hipProne = lying down a hip-fired gun (minigun, flamer) goes to the shoulder;
//   carry = port arms at a sprint: the handguard no nearer the left shoulder than min of the left arm's length, the grip no further from the right
//   shoulder than max of the right arm's
export const GUNFEEL = {
  hold:{ grip:[0.034, 0.022], gripPole:[-0.36, 0.4, -0.12], wrist:[0.8, 0.8],
    trig:{ ahead:0.024, up:0.02, lo:0.09, hi:0.035, side:0.011, face:0.004, pad:[0.9, 0.35], safe:[0.032, 0.014, 0.018], bare:[0.03, 0.03] },
    reach:{ comfort:0.9, prone:0.95, dead:[0.012, 0.04], proK:10, protract:0.3, back:0.4, k:8, blade:0.5, hardProne:0.985 },
    cheek:{ head:[0.28, 0.17, -0.08], bow:[-0.3, 0.3], tilt:0.2, iter:3, up:[-0.11, 0.07], in:[0, 0.06], rate:8, side:0.015, bladeK:8 }, hipProne:true, carry:{ min:0.65, max:0.84 },
    ok:{ trig:3.5, wrist:60, eye:4, stretch:0.97 } },   // what the pose studio flags (dev/pose-studio.js measure): the fingertip off the trigger (cm), a wrist's bend (deg), the eye off the sight line (cm), an arm's stretch
  // GUN 2 THE RELOAD IN REAL STEPS (actors/gun-reload.js): family = which way each hand weapon (INFGUN.guns key) is loaded; steps = each family's steps as
  //   shares of that gun's own reload time (GUNS[id].reload — they add up to 1: a gun that ran dry reloads in exactly the time it always did); a step named
  //   in `dry` is done only when the gun ran dry (a magazine changed with a round still chambered has no rack: it takes that much less — R reloads
  //   early); `shells` is scaled by the share of the rounds missing (shellMax = the most hand movements shown). pose = the gun brought off the aim for it:
  //   muzzle up (+) / down pitch, turned in, canted (the magazine well to the left hand), the butt down / in (m), how far he looks down (prone: lying
  //   down). at = where the hand goes: the vest pouch and the dump pouch / belt as [his left, up, ahead] of the chest / the hips, how far the magazine
  //   comes clear of the well, the charging handle's pull, the feed cover's lift, the pump's stroke, the bolt handle [to the right of, over] the bolt
  //   point and its lift. prop = what the left hand is seen to hold: a magazine [along, deep, thick] (sized off the gun's own when it has one), an ammo
  //   box, a shell / a 40 mm round [long, across], a rocket; cells = the guns whose magazine is a power cell; col = their colours; a magazine let go
  //   falls at grav and lies `lie` s. ease = a hand or the gun that would jump (faster than hand / v m/s, w rad/s in his chest's frame) is eased out at rate /s
  reload:{ family:{ ar:'mag', ak:'mag', m4:'mag', mp5:'mag', rust:'mag', dmr:'mag', energy:'mag', rail:'mag', saw:'mag', lmg:'belt', minigun:'belt', flamer:'belt', sniper:'bolt', shotgun:'shell', gl:'shell', rpg:'tube' },
    steps:{ mag:[['off', 0.09], ['out', 0.11], ['stow', 0.16], ['fetch', 0.12], ['in', 0.15], ['seat', 0.07], ['rack', 0.17], ['back', 0.13]],
      belt:[['off', 0.06], ['open', 0.08], ['out', 0.10], ['stow', 0.13], ['fetch', 0.09], ['in', 0.14], ['belt', 0.10], ['close', 0.07], ['rack', 0.13], ['back', 0.10]],
      bolt:[['off', 0.08], ['out', 0.11], ['stow', 0.15], ['fetch', 0.11], ['in', 0.14], ['seat', 0.07], ['rack', 0.22], ['back', 0.12]],
      shell:[['off', 0.10], ['shells', 0.62], ['rack', 0.16], ['back', 0.12]],
      tube:[['off', 0.20], ['fetch', 0.18], ['in', 0.18], ['seat', 0.08], ['push', 0.14], ['hold', 0.08], ['back', 0.14]] },
    dry:['rack'], shellMax:8,
    pose:{ mag:{ pitch:0.2, turn:0.34, cant:0.5, down:0.05, in:0.05, look:0.3, prone:{ pitch:0.02, turn:0.22, cant:0.8, down:0.02, in:0.03, look:0.2 } },
      belt:{ pitch:-0.3, turn:0.3, cant:0.12, down:0.09, in:0.04, look:0.4, prone:{ pitch:-0.02, turn:0.2, cant:0.15, down:0.02, in:0.02, look:0.25 } },
      bolt:{ pitch:-0.1, turn:0.18, cant:0.35, down:0.03, in:0.03, look:0.22, prone:{ pitch:0, turn:0.12, cant:0.5, down:0.01, in:0.02, look:0.15 } },
      shell:{ pitch:-0.16, turn:0.26, cant:0.95, down:0.06, in:0.05, look:0.3, prone:{ pitch:0, turn:0.18, cant:1.0, down:0.02, in:0.03, look:0.2 } },
      tube:{ pitch:-0.5, turn:0.38, cant:0, down:0.07, in:0.06, look:0.2 } },
    at:{ pouch:[0.06, -0.16, 0.2], dump:[0.2, 0.04, 0.03], clear:0.05, rack:0.06, lid:0.09, pump:0.07, handle:[0.035, 0.02], lift:0.03 },
    prop:{ mag:[0.045, 0.13, 0.024], belt:[0.15, 0.1, 0.08], shell:[0.065, 0.022], gl:[0.1, 0.04], rocket:[0.55, 0.085], cells:['energy', 'rail'],
      col:{ mag:0x1e1f1c, belt:0x4a5236, shell:0x9c2b22, gl:0x7c8450, rocket:0x4c5a3a, cell:0x3f78c8 }, lie:4, grav:-12 },
    ease:{ v:4, w:20, hand:5, rate:14 } },
  // GUN 3 THE FEEL OF A SHOT (actors/gun-feel.js): climb = a burst's muzzle climb on top of each shot's own kick — every shot adds per × that gun's climb
  //   (at most cap rad), it eases off at hold /s while he fires (rest /s once gap s have passed with no shot), and he takes comp of it back after lag s:
  //   it climbs, then settles; body = how much of it rocks his trunk; shoulder = his right shoulder driven back by the kick (rad per m);
  //   bloom = the gun's spread × first for a burst's first `tight` rounds, rising to × max by round `full` (a pause of reset s starts a new burst);
  //   cam = the camera's kick × first for a burst's first `after` rounds, × auto from then on; low = the least height over the ground his own round may
  //   leave from (lying down: the real muzzle, not 0.6 m); eject = the spent case: none = the guns that throw none, the port `ahead` of the grip when the
  //   gun has no magazine (else over the magazine well), `up` over the bore, `side` out on its right; thrown v = [right, + random, up, + random] m/s and
  //   `back`; link = belt guns drop a link too; hit = the mark at the crosshair when his round strikes: ms shown (a kill: killMs, × killK, its own colour),
  //   no more than one every gap s, size px.
  // cycle = a gun worked by hand after every shot (INFGUN.guns key): which hand, when it starts and how long it takes (shares of the gun's fire
  //   interval), when in it the case is thrown, its sound
  shot:{ climb:{ per:0.55, cap:0.09, hold:2.2, rest:7, gap:0.3, lag:0.28, comp:0.65, body:0.5 }, shoulder:3.2, bloom:{ reset:0.32, tight:3, full:10, first:0.6, max:1.2 }, cam:{ first:1, auto:0.62, after:3 }, low:0.2,
    eject:{ none:['rpg', 'energy', 'rail', 'flamer', 'gl', 'saw'], ahead:0.1, up:0.012, side:0.03, back:0.6, v:[1.6, 1.4, 2, 1.5], link:['lmg', 'minigun'] },
    hit:{ ms:120, killMs:260, killK:1.35, gap:0.07, size:28, col:['#ffffff', '#ff5a4a'] } },
  cycle:{ sniper:{ hand:'R', at:0.14, dur:0.5, eject:0.42, snd:'boltRack' }, shotgun:{ hand:'L', at:0.14, dur:0.5, eject:0.4, snd:'boltRack' } },
  // GUN 4 HIS FEET (actors/soldier-legs.js): turnStep = stood still a foot steps round once it is this far (rad) off where he faces (SOLDIER_LEGS.yawStep
  //   0.55 before: he wound up 31 deg before a foot moved); hips = the most his pelvis stays behind his chest with his feet (rad), hipsK = how much of the
  //   feet's lag it keeps; slope = a foot's pitch follows the ground under it: k of the rise from `back` m behind the ankle to `ahead` m ahead of it, at
  //   most max rad, eased at rate /s, none while the foot is lifted more than clear m
  feet:{ turnStep:0.4, hips:0.4, hipsK:0.7, slope:{ k:0.85, max:0.4, ahead:0.14, back:0.06, rate:12, clear:0.04 } },
};
// CARRY 1 HOW A RIFLEMAN CARRIES HIS WEAPONS WHEN HE IS NOT AIMING THEM (actors/gun-carry.js; on false / ?oldcarry = none of it: the gun is always in his hands as before).
//   sling = when his hands leave the gun. ON HIS BACK: climb / drone = on a wall's face, flying the FPV drone; patrol = nobody has suspected him (the eye chip
//     closed), he is stood and has not fired, aimed, reloaded or been hit for quiet s, going no faster than maxV m/s; mounted = sat on a ride too (off:
//     as it was). HUNG IN FRONT: knife = the knife's thrust (knifeT s), revive = standing a downed mate up. strap = the sling itself is drawn.
//     t = s to sling it / to bring it round / to bring it round the moment he fires or aims; the trigger waits for it at most block s, and only while it
//     is more than `clear` of the way off
//   slot = where a gun lies on his back, in the back's own frame (rigid with Spine1, the bone his pack hangs on; origin at the Spine2 joint): at = its
//     UPPER END (the butt plate) [toward the shoulder blade it hangs from, up, behind the spine] m — just under the top of the shoulder, clear of the pack;
//     tilt = off the spine (rad), more for a long weapon so its muzzle hangs no more than drop m under the butt (at most tiltMax); prone = lying down
//     [tilt, upper end's side m, extra depth m, eased /s, up m] — in along the spine and up it (his legs work under it, the helmet comes back); stack = the extra depth of the one slung OVER the
//     one worn (the mirror diagonal); a kind in `up` hangs the other way up (the B41: its warhead at the shoulder) and goes round upVia m lower;
//     via = the two points the grip passes on its way round [side, up, behind] m (out at his side, behind the shoulder), cross m further ahead while it crosses his chest to go round the left; slide = how fast the worn one
//     crosses to the right-shoulder diagonal after a swap (diagonals /s); its rock in the back's plane: sway rad with the stride, lag rad per m/s² of the
//     chest's sideways shove, at most max, on a spring k / z (damped: it does not flap)
//   hang = hung in front on the sling, in his pelvis' frame (his belly does not turn with his chest): the grip's station [his right, up, ahead] of the
//     Spine joint m (the right of his belly), the muzzle pitch rad under the level to his left, t s in / out, let down `clear` m out ahead of his chest on the way
//   back = THE SECOND WEAPON worn on his back when he owns two (mounted: on a ride too, seat m further out — sat upright his shoulders come back; skip = kinds never worn)
//   swap = cycleGun as a real swap: t s for the whole of it (the old one is on his back by `out` of it, the new one leaves at `in`); the trigger waits
//     block s (it was 0.1 s, with the gun changing in no time at all) and a held trigger hurries the swap to be done by then
//   ready = LOW READY (moving, not firing): the muzzle down pitch rad in all (REALCAV.ready gave it 0.35), turned about the butt
//   run = THE RUN CARRY (stood, running, not firing, not aiming): weighed in over v m/s; the grip at [his right, up, ahead] of Spine1, the muzzle turned
//     yaw to his left and pitch down, canted roll; bob = with the stride [the grip's drop at each footfall m, the muzzle's nod rad, its swing rad, the
//     grip's pump ahead / back m]; rate = in / out per s; clear = how far out ahead it swings going to / from port arms
//   shoulder.k = how much faster (per s, on top of the 5 /s the low-ready falls at) the gun comes to his shoulder once he aims or fires
//   hands = a hand's weight on the gun over the way round: off = [the other hand lets go from…to, the carrying hand from…to]; reach = the most an arm
//     straightens (of its length); hang = [out from the shoulder m, of the arm's length, forward rad], swing rad with the stride, crouch = forward rad
//     kneeling; drone = each wrist [out, up, ahead] of the Spine2 joint m (the controller); revive = [in from the shoulder, up, ahead] m (down to the
//     mate); knife = the thrust [from, to m ahead of the shoulder, up]
//   strap = the sling's ribbon: w wide; its swivels at rear / front (shares of the gun's length from its middle) and `under` the bore; in his hands it
//     sags `sag` m; on his back it runs over the shoulder (top m over the joint) and through `back` [toward that shoulder, up, behind] of the back's
//     frame — the chest, the breastbone, the far ribs, under the far arm, behind the far hip; hung in front it goes behind the neck [back, up] m
export const GUNCARRY = { on:!(typeof location !== 'undefined' && /[?&]oldcarry\b/.test(location.search)),
  sling:{ climb:true, drone:true, revive:true, knife:true, patrol:false, mounted:false, strap:true, quiet:6, maxV:5.2, t:[0.35, 0.25, 0.15], block:0.25, clear:0.12, knifeT:0.5 },
  slot:{ at:[0.2, 0.02, 0.24], tilt:0.42, tiltMax:0.5, drop:0.655, prone:[0.12, 0.05, 0.02, 4, 0.1], stack:0.06, up:['rpg'], upVia:-0.3, via:[[0.36, -0.10, -0.27], [0.44, 0.04, 0.24]], cross:0.1, slide:2.2, sway:0.03, lag:0.004, max:0.05, k:60, z:0.7 },
  hang:{ at:[0.05, 0.0, 0.27], pitch:0.9, t:0.15, clear:0.1 },
  back:{ on:false, mounted:true, seat:0.07, skip:[] },
  swap:{ on:true, t:0.3, block:0.1, out:0.6, in:0.3 },
  ready:{ pitch:0.68 },
  run:{ on:true, v:[2.6, 3.6], at:[0.2, -0.22, 0.42], yaw:0.8, pitch:0.62, roll:0.25, bob:[0.025, 0.04, 0.03, 0.02], rate:[6, 14], clear:0.08 },
  shoulder:{ k:4 },
  hands:{ off:[0.02, 0.3, 0.45, 0.8], reach:0.95, hang:[0.07, 0.93, 0.1], swing:0.3, crouch:0.55, drone:[0.1, -0.12, 0.26], revive:[0.06, -0.5, 0.38], knife:[0.2, 0.58, -0.08] },
  strap:{ color:0x23241f, w:0.028, rear:0.4, front:-0.24, under:-0.03, sag:0.09, top:0.09, back:[[0.1, 0.02, -0.25], [0, -0.1, -0.29], [-0.12, -0.2, -0.35], [-0.26, -0.3, -0.1], [-0.2, -0.38, 0.2]], neck:[0.07, 0.03] } };
// Z343 HIS UPPER BODY IN TIME WITH HIS LEGS (actors/soldier-upper.js): the chest's speed and acceleration smoothed (/s), the acceleration capped (m/s²),
//   a jump of more than `reset` m starts it afresh; the lean into a change of pace (rad per m/s² ahead / to the side, at most leanMax, on a spring of
//   stiffness leanK and damping leanZ); the shoulders' turn against each stride and the trunk's sway over the standing foot (rad); breathing (rad, Hz);
//   how much of the trunk's added turn the neck takes back (the head held steady). gun: the rifle's lag on a spring (stiffness, damping, how much it
//   feels the chest's acceleration — less `dead` m/s² — at most max m), the dip at each footfall (m/s), the muzzle's figure of eight walking (yaw, pitch rad),
//   × fire firing. head: how much of a quick jolt of the head is taken out, how fast its eased turn follows (/s), past `snap` rad it is a new start
// Z347 stance = the forward lean into the gun from the hips stood / walking on his feet (rad; half of it kneeling) — the fighting stance, not upright behind it;
//   SOLDIER_LEGS.stand: the feet a shoulder's width apart, the left a step ahead, the knees a little more bent
// Z348 seat = sat on the horse / a pillion, the spine laid straight up from the hips: the lean forward (rad) stood still, + pace × (speed / fast m/s),
//   the upper back proud of it by chest, how much of the way (k)
export const SOLDIER_UPPER = { velK:8, accK:5, accMax:25, reset:0.6, lean:0.03, leanSide:0.025, leanMax:0.14, stance:0.2, leanK:45, leanZ:0.55, twist:0.06, sway:0.035,
  breath:0.012, breathHz:0.25, gaze:0.85, gun:{ k:90, c:11, m:0.8, dead:1.2, max:0.028, kick:0.05, yaw:0.012, pitch:0.008, fire:0.35 },
  head:{ steady:0.6, rate:12, snap:0.9 }, seat:{ lean:0.05, pace:0.14, fast:12, chest:0.07, k:0.9 },
  // Z368 running tall (on his feet, moving, not firing; weighed in from m/s over span m/s at rate): the trunk brought back to a runner's lean (rad,
  //   [slow, at speed] between v m/s), the head lifted till it tips forward no more than tilt rad — eyes on the way ahead, not his boots
  run:{ from:1.0, span:0.8, rate:6, lean:[0.1, 0.24], v:[1.5, 6], tilt:0.12, neck:0.45 } };
// Z371 THE STIRRUPS (actors/soldier-stirrups.js; m, horse frame: x out to the side, y up from the ground, z along): the leather from the saddle's skirt at
//   top down to the iron's tread at iron (outside the barrel, at the belly), w wide, t thick; the iron a loop of radius r, tube thick, its tread tread deep;
//   the rider's ankle ankle m over the tread and ball m behind it, his knee drawn out knee[0] and forward knee[1] over the flap, the heel down heel rad,
//   the toe turned out out; out of reach (the gallop stands him up), he is brought down till the irons are reach of his leg's length away (at most drop m)
export const STIRRUP = { top:[0.31, 1.6, -0.06], iron:[0.46, 1.03, 0.0], w:0.035, t:0.006, r:0.075, tube:0.011, tread:0.055, ankle:0.075, ball:0.06, knee:[0.55, 0.45], heel:0.18, out:0.18, reach:0.96, drop:0.45,
  leather:0x3b2a1c, steel:0xbcbcbc };
export const REALCAV = { s2:{ on:true, yaw:-Math.PI / 2, k:1.06 }, opH:1.84, seat:[0, 1.80, -0.15], seatBone:'spine_04', carbine:{ len:0.86, grip:[0.205, -0.07, 0], muzzle:[-0.476, 0.045, 0] },
  horseV:{ Walk:1.6, Canter:6.0, Sprint:13.2 }, footV:{ walk:1.2, run:2.1, charge:6.5, crouch:1.6 }, fade:0.22, twistMax:1.3, seatTurn:[0.75, 1.05, 2.6, 7], aimRate:2.6, flip:0.55, sit:{ lean:0, k:0.95 }, overDrv:{ up:0.05, fw:[0.25, 0.75] }, cv:{ rest:0.08, restMax:0.3 }, ready:[1.0, 0.35], gaitAt:[2.3, 4.0], carryAt:5.4, twistRate:2.8, hipRate:1.6, standTurn:[0, 1.05, 1.3, 0.42], sway:{ acc:0.022, lat:0.016, heave:0.35, max:0.4, k:42, z:0.32 }, pitch:[0.06, 0.3], proneDrop:0.15, hitT:0.7, hitK:0.85 };   // Z254 hitT / hitK = how long the upper-body flinch of a hit lasts (s) and how much of it shows
// POSE 1 THE SEEN SOLDIER TAKES THE OPERATOR'S WHOLE TURN (actors/puppet.js): full = the new copy (trunk / head / feet: the operator's turn away from his
//   rest over the soldier's own rest; limbs: the operator's direction + the roll from the plane the limb folds in; hands by the knuckle line) — `?oldpuppet`
//   in the address = the old direction-only copy, for comparison. head = the share of the clip's own turn [of the neck on the chest, of the head on the
//   neck] that is copied — on his feet (the clips keep the face on the target over a bladed body), sat on a ride (the riding clips look about: none;
//   his head is then kept within `level` = [bowed, tilted, thrown back] rad of upright after the hold, as GUNFEEL.hold.cheek.head does on foot). hinge: bend = [rad the limb must be folded before its plane counts, rad at which it
//   rules alone] (straighter: the copied roll), flip = [from, to] rad the plane may lie off the copied hinge before a clip's limb is taken as bent the
//   wrong way and keeps the copied roll. twist (no twist bones in either rig): fore / shin = the share of the wrist's / ankle's twist the forearm / shin
//   takes (the rest stays at the joint), max = the most twist read at a joint (rad); upper / thigh = a shoulder / hip may be twisted `free` rad from rest
//   before `share` of the excess is handed to the elbow / knee (`cap` rad at most: the hinge stays near its plane). feet (on his feet): each foot to the operator's height off the ground — lead = how fast
//   the straighter leg takes charge of the hips (per unit of stretch difference), max = the most a leg is corrected (m), reach / soft = a leg is never
//   asked past reach × its length and closes on that softly over the last `soft`, upright = [from, to] hips height over the feet (share of standing)
//   between which he counts as on his feet (lower: lying — the lowest foot joint sets the hips, as before)
export const PUPPET = { full:!(typeof location !== 'undefined' && /[?&]oldpuppet\b/.test(location.search)), head:{ foot:[1, 0.5], sat:[0, 0], level:[0.2, 0.17, -0.08] }, hinge:{ bend:[0.1, 0.35], flip:[1.75, 2.45] },
  twist:{ fore:0.5, shin:0.3, max:2.2, upper:{ free:0.9, share:0.5, cap:0.2 }, thigh:{ free:0.7, share:0.5, cap:0.2 } }, feet:{ on:true, lead:6, max:0.08, reach:0.99, soft:0.04, upright:[0.25, 0.45] } };
// Z340 TURNED ROUND IN THE SADDLE (actors/real-cav.js, combat/soldier-fire.js): sat on the horse or a pillion his hips and chest together turn up to `max`
//   either way from the mount's heading (rad, ~170°: nearly all the way round, never right round); hip = how far the hips swing on the horse's saddle
//   (the chest twists the rest; a pillion keeps REALCAV.seatTurn[1]); flip = how far past straight behind the aim must be before he swings back the
//   other way, round the front; swing = how fast that long way round (rad/s); lead = how far his arms lay the gun ahead of his chest; fire = the trigger
//   waits while the bore is more than this off the aim (no rounds out of his back while he turns)
export const RIDER_TURN = { max:2.97, hip:1.0, flip:0.3, swing:4.4, lead:0.35, fire:0.4 };
// Z243 shield pylon SITES (round the general): metres clear of our citadel's wall ring (coreGap) / a fortress (fortGap) / any wall, cover or building (clear) /
//   the fence (edge) / each other (apart); rings = radii tried (× pylon.ring), steps = angles tried per ring; pillar = height of the light pillar (m)
//   Z244 CLEAR AIR: no milky veil — the grade's shadow lift goes (liftK 0: blacks stay black, shadows stay deep), the split-tone tints halve (tintK),
//   the haze is thinner again and tinted sky-blue instead of whitened (fogBlue = share of the zenith colour, no white mix), crisper contrast + sharpening
// Z276 light shafts (render/shafts.js): ray steps through the sun's shadow map, gain, air density (/m), how far the ray is walked (m), forward
//   scattering g, the even haze share, and per-battlefield strength
// Z276 leaf / grass translucency strength (real-trees.js, grass-carpet.js) lives in REALTREE.trans and GRASS.trans
// Z278 dust motes in the sunlight (fx/dust.js): count, the box of air round the view (m), how far ahead of the camera it sits, size, glow, colour
export const DUST = { on:true, n:2600, box:[70, 16, 70], ahead:22, size:0.09, gain:1.0, col:0xfff1d0 };
export const SHAFTS = { on:true, steps:24, gain:0.14, dens:0.009, maxD:150, g:0.62, even:0.08, biome:{ CITY:0.85, ARCTIC:0.7, DESERT:0.7, VOLCANO:1.25, FOUNDRY:1.15 } };
// Z420 ART DIRECTION — every battlefield its own film (world/atmosphere.js artTone, the last word after ATMOS and LIGHT): mood = what it should feel
//   like; sh / hi = the split-tone the shadows / highlights end on (rgb shifts, display-referred), satK / conK / expK = × saturation, contrast,
//   exposure, vig = the vignette by day, sun = [colour, share] the sun's light leans toward, fogK = × the haze. By night the split-tone is halved
//   and the sun is left alone; at sunset the sun keeps the hour's colour.
export const ART_TONE = {
  DESERT:{ mood:'nắng thiêu, cô độc — vàng cháy, bóng xanh lạnh', sh:[-0.04, -0.005, 0.05], hi:[0.05, 0.022, -0.03], satK:1.0, conK:1.04, expK:1.02, vig:0.3, sun:[0xffe2b0, 0.35] },
  SAVANNA:{ mood:'chiều bụi đỏ — hổ phách, khói bụi', sh:[-0.02, -0.012, 0.04], hi:[0.065, 0.025, -0.045], satK:1.04, conK:1.03, vig:0.32, sun:[0xffc890, 0.4], fogK:1.15 },
  ARCTIC:{ mood:'lạnh câm lặng — lam băng, nắng xiên nhợt', sh:[-0.035, 0, 0.065], hi:[0.02, 0.018, 0.006], satK:0.9, conK:1.02, expK:0.98, vig:0.26, sun:[0xe8f0ff, 0.3] },
  TUNDRA:{ mood:'tê buốt — xám bạc, sương', sh:[-0.03, 0.005, 0.055], hi:[0.015, 0.015, 0.01], satK:0.84, vig:0.28, fogK:1.2 },
  FOUNDRY:{ mood:'ngột ngạt công nghiệp — cam natri, bóng xanh rêu, khói', sh:[-0.04, 0.02, 0.03], hi:[0.07, 0.03, -0.04], satK:0.88, conK:1.06, vig:0.34, sun:[0xffcf9a, 0.45], fogK:1.25 },
  STEELMILL:{ mood:'lò nguội gỉ sét — đồng gỉ, khói xám', sh:[-0.035, 0.015, 0.025], hi:[0.075, 0.028, -0.045], satK:0.86, conK:1.06, vig:0.34, sun:[0xffc898, 0.45], fogK:1.25 },
  VOLCANO:{ mood:'địa ngục — đỏ máu, đen than, bóng tím', sh:[0.01, -0.025, 0.03], hi:[0.08, 0.012, -0.05], satK:1.06, conK:1.08, expK:0.96, vig:0.38 },
  CITADEL:{ mood:'sử thi cổ thành — nắng chiều vàng son trên sa thạch', sh:[-0.035, 0, 0.05], hi:[0.06, 0.026, -0.04], satK:1.03, conK:1.04, vig:0.3, sun:[0xffd9a8, 0.35] },
  RUINS:{ mood:'u buồn tàn phá — bạc màu, nâu nhạt, trời đục', sh:[-0.02, 0.008, 0.035], hi:[0.04, 0.025, -0.005], satK:0.85, conK:1.03, vig:0.34, fogK:1.15 },
  MEADOW:{ mood:'yên bình bị xé toạc — xanh non, nắng mật', sh:[-0.025, 0.012, 0.04], hi:[0.025, 0.03, -0.02], satK:1.02, vig:0.24 },
  HILLS:{ mood:'sương núi — xanh lạnh, xa mờ', sh:[-0.03, 0.008, 0.055], hi:[0.015, 0.02, 0], satK:0.94, vig:0.26, fogK:1.3 },
  VILLAGE:{ mood:'chiều quê — vàng ấm, khói bếp', sh:[-0.02, 0.005, 0.035], hi:[0.05, 0.03, -0.03], satK:1.02, vig:0.26, sun:[0xffe6b8, 0.35] },
  CITY:{ mood:'căng thẳng đô thị — thép xanh, bóng lạnh, kính ấm', sh:[-0.045, 0.012, 0.06], hi:[0.045, 0.022, -0.02], satK:0.88, conK:1.06, vig:0.32 },
  QUARRY:{ mood:'chói gắt đá trắng — sáng, khô, bụi', sh:[-0.02, 0.004, 0.035], hi:[0.03, 0.02, -0.01], satK:0.92, conK:0.98, expK:1.03, vig:0.24 } };
export const LIGHT = { tone:'agx', expK:1.0, sunK:1.35, hemiK:0.55, ambient:0.03, envK:0.6, conK:1.12, satK:1.12, vib:0, fogK:0.4, nightHemiK:0.8, flora:[0.8,0.84,0.72],
  liftK:0, tintK:0.5, fogBlue:0.22, bloom:0.24, sharp:0.58, duskHemiK:0.85, duskAmbient:0.08 };   // sunset keeps more sky fill + its lift
// LIGHT 1 GROUNDED (fx/footfall.js, render/renderer.js, world/atmosphere.js) — the soldier stands IN the world, not over it.
//   shadow: the sun's normal offset (m) and depth bias — 0.25 m of normal offset lifted every receiver a quarter metre, so at a low sun the feet's
//     shadow began ~0.6 m away from the boots; lift: a contact quad's height off the ground (m); spread: a shade widens by 1 + h × spread as its joint rises;
//   joint: the contact shades (the sky the body hides from the ground, black, soft) — ankle / toe = those joints' height over the ground with the foot flat;
//     foot = [length, width, alpha, full at h0, gone at h1] (h = the sole over the ground); knee / hips / chest / hand = [length, width, alpha, h0, h1,
//     the joint's own height over what touches]; body: the broad faint shade from the head to the feet — alpha, width, + pad on its length, the hips'
//     standing height (hip) and how fast it fades above it (fade); nightK × every shade and print by night; capShade(M) instances (desktop / phone);
//   plant: a footfall = the sole was up past `up` m and comes down below `down` m (no sooner than gap s after the last), moving faster than minV m/s;
//   print: boot prints on soft ground — life / fade s, cap(M) prints kept, size [length, width] m, dark = the pressed sole's shade, rim = the ridge of
//     pushed-up ground (rimCol per battlefield), surf = strength per ground (afxSurfaceAt; rock, steel, wood, water: none);
//   kick: the ground kicked up at every footfall (fire-fx kinds: 'dust' the haze that hangs, 'dirt' the spray off the toe, 'clod' grit / wet clods /
//     torn blades, seed fluff on grass) — from minV m/s; walk below walkV, run, sprint from sprintV: counts per foot (dust / spray / clod), size m,
//     opacity, up × the throw upward, life s; thrown back at throwK × his pace (capped at vCap m/s); skid = a hard stop (from fromV to below toV m/s;
//     the peak pace decays at decay m/s²): thrown forward, a print len × longer; surf = per ground: × each count, size, opacity, clodS = a clod's size
//     m, its colour (clodC) and the haze's (tint, or the battlefield's own sand / earth in biome); mud = wet ground within mudR m of the water or in rain;
//     npc × the counts for the men round him, npcP = the share of their steps that kick; grass: the grass round his hips parts (r m) and lies down (k);
//   npc: the men round the camera within r m — body shade (a, len, w), a print every stride / strideRun m (runV m/s) within printR m, side = half the
//     gait's width; cloth: the uniform's roughness map remapped to lo…1 (the Tripo soldier's 0.26–0.51 made the fabric shine like wet plastic);
//   night.spotShadows: floodlights that cast shadows (each one more shadow map in every lit shader: four took the ground's past the GPU's 16 texture
//     units and the whole field went undrawn at night — only the fog colour under the men); fill: the sky / bounce light — hemiK × the day sky fill, desat = share of the sky colour greyed (a clear sky's light is pale, not cobalt), bounce =
//     the hemisphere's ground colour = the battlefield's ground (ground) lit by the sun's colour × bounce; envK × the sky reflections by day
export const GROUNDED = { on:true, lift:0.025, spread:1.6, nightK:0.85, capShade:96, capShadeM:40,
  shadow:{ normalBias:0.035, bias:-0.0004 },
  joint:{ ankle:0.145, toe:0.035, foot:[0.34, 0.17, 0.75, 0.01, 0.2], knee:[0.3, 0.24, 0.45, 0.03, 0.25, 0.07], hips:[0.5, 0.42, 0.45, 0.04, 0.3, 0.12],
    chest:[0.55, 0.45, 0.4, 0.05, 0.3, 0.15], hand:[0.18, 0.14, 0.3, 0.02, 0.15, 0.04] },
  body:{ a:0.34, w:0.75, pad:0.55, hip:0.9, fade:0.8 },
  plant:{ up:0.07, down:0.035, gap:0.18, minV:0.6 },
  print:{ life:45, fade:15, cap:360, capM:90, size:[0.31, 0.12], dark:0.5, rim:0.14, surf:{ sand:1, snow:1.1, dirt:0.75, mud:1.2, grass:0.3 }, rimCol:{ _:0xd8c8a8, ARCTIC:0xf4f8ff, TUNDRA:0xe8eef4 } },
  kick:{ minV:0.6, walkV:2.2, sprintV:5.6, vCap:7, throwK:0.32, spraySize:0.16, npc:0.5, npcP:0.6, mudR:1.2, fluffC:0xeee8d0,
    walk:{ dust:1, spray:0, clod:0.4, size:0.45, op:0.45, up:0.7, life:0.9 }, run:{ dust:2, spray:3, clod:3, size:0.75, op:0.8, up:1, life:1.2 },
    sprint:{ dust:3, spray:5, clod:5, size:0.9, op:0.85, up:1.15, life:1.4 }, skid:{ dust:5, spray:6, clod:5, size:0.85, op:0.85, up:0.6, life:1.4, throwK:0.4, len:1.9, fromV:4.2, toV:1.2, decay:5 },
    grass:{ r:0.65, k:0.8 },
    surf:{ sand:{ dust:1, spray:1, clod:0.7, size:1, op:1, clodS:0.04, tint:0xd2b48a }, dirt:{ dust:0.9, spray:0.9, clod:0.8, size:0.95, op:0.9, clodS:0.04, tint:0x9a8a70 },
      grass:{ dust:0.25, spray:0, clod:1, size:0.7, op:0.5, clodS:0.05, clodC:0x5f7a34, fluff:0.6, tint:0x9c8e6a }, snow:{ dust:1, spray:1, clod:0.8, size:0.8, op:0.75, clodS:0.045, tint:0xeef2fa },
      mud:{ dust:0.1, spray:0.5, clod:1.6, size:0.8, op:0.9, clodS:0.05, clodC:0x2e2418, tint:0x4a3a28 }, rock:{ dust:0.3, spray:0, clod:0.3, size:0.6, op:0.6, clodS:0.025, tint:0xb0a89a } },
    biome:{ DESERT:0xd6b88c, SAVANNA:0xc49a68, RUINS:0x9a8a74, MEADOW:0x8a7656, CITY:0x9a958c, QUARRY:0xd0ccc0, VOLCANO:0x5a4a44, FOUNDRY:0x5a5048, CITADEL:0xb89e7a } },
  npc:{ r:32, printR:16, a:0.32, len:0.85, w:0.7, fade:0.6, stride:0.72, strideRun:1.05, runV:3, side:0.11 },
  cloth:{ on:true, lo:0.55, rimPow:3.0 }, night:{ spotShadows:0 },
  fill:{ on:true, desat:0.55, bounce:1.5, rim:{ day:0.1, noon:0.08, sunset:0.4, night:0.25 }, tod:{ day:{ hemiK:1.2, envK:1.0, expK:1.06 }, noon:{ hemiK:1.2, envK:1.0, expK:1.06 },
    sunset:{ hemiK:1.1, envK:1.0, expK:1.0 }, night:{ hemiK:1.0 } } } };
// LOOK 1 THE WORLD SEEN FROM THE GAME CAMERA (fx/footfall.js, world/atmosphere.js, world/ground-photo.js, render/see-through.js) —
//   kick: the footfall's dust read from the follow camera (~7 m off at the default zoom, 12+ zoomed out): every puff × sizeK, × (1 + (d − near) ×
//     distK) more for d m from the lens (at most max), lives lifeK × longer, opacity × opK (capped at 1); core = one denser, lower, slower puff right at
//     the foot per footfall (n × [walk, run, sprint, skid]; size / op / up / life / spread × the gait's) so it reads as a tuft of sand, not a haze
//   tone: a battlefield's light per hour / weather on top of ATMOS + ART_TONE (the desert's sand read purple-grey: a pink-beige photo × a cobalt sky
//     fill × blue-pushed shadows; at golden hour mauve) — tint = the photo floor's albedo ×, and per hour (noon / day / sunset) or weather (fog /
//     sand / rain), `all` for every hour: sh / hi = the grade's split-tone (replaces ART_TONE's), sky = the sky fill's colour pulled toward [colour,
//     share], bounce = × the ground's warm bounce, expK = × exposure, fog = the haze pulled toward [colour, share], satK = × saturation. (A passing
//     sandstorm used to leave the floor untinted — the raw pale photo — for the rest of the battle: fx/weather.js now keeps the floor's own tint)
//   knee (world/grass-carpet.js): a grass-photo texel (linear lum.) brighter than knee[0] keeps knee[1] of the excess and leans greenward by up to
//     knee[2] — the photo's pale dry blades and stem sheaths (lum. 0.2–0.58, the green ones ~0.09) went white-yellow at noon: the meadow's streaks
//   cards: the grass photo's five clumps [x, y, w, h] in its 2048×518 atlas (replaces GRASS.cards) — the bottoms of three of them (and the tail of a
//     fourth) are the photo's padding smeared straight down: opaque yellow-brown bars 16–48 px tall under the stems, drawn at the foot of every
//     carpet clump and tuft as yellow streaks. Each card now ends a few px above its first smeared row · edge: a grass card seen edge-on (|its face ·
//     the view| below edge[0], faded in by edge[1]) is not drawn (squeezed into a pixel or two its stems stand as bars; three crossed cards a clump:
//     one always faces the lens). Knee + edge took the meadow's noon yellow-pixel share 17.8 % → 11.5 % — thin bright bars still remain (not the sun,
//     the shadows, the mips, alpha-to-coverage or the sharpening: measured, cause open)
//   dome (LOOK 2, actors/core.js): the Core shield dome's idle shimmer is gone with the lens `in` m inside its radius, whole `out` m outside (from
//     inside, its far wall laid hex lines over the base's sand); the emergency shield still glows from inside
//   grade (LOOK 3, render/renderer.js): the film grade's contrast was a straight line about 0.45 — at a noon contrast of ~1.4 every display value
//     under ~0.13 came out 0: a shadowed wall near the lens (the desert HQ's face, dark metal-mapped scan) drew as a flat black slab. toe 1 = below
//     the pivot a power curve of the same slope at the pivot that keeps 0 at 0 (shadows deep, never clipped); 0 = the old straight line
//   (phones keep CAM_ROOM.yard rKMobile / arenaKMobile 1: ×1.4 forts fit only on a ×1.2 field, which cost +3.1 ms median / +3.3 ms p95 a frame — measured)
export const LOOK = { kick:{ on:true, sizeK:1.7, opK:1.2, lifeK:1.3, near:6, distK:0.06, max:1.8, core:{ n:[1, 1.4, 2, 2.5], size:0.8, op:1.4, up:0.45, life:1.15, sp:0.12 } },
  tone:{ DESERT:{ tint:[0.82, 0.68, 0.45], all:{ sh:[-0.006, 0, 0.012], hi:[0.035, 0.018, -0.022], sky:[0xe6dccb, 0.5], bounce:1.25 },
    sunset:{ sh:[0.004, 0.006, -0.002], hi:[0.03, 0.024, -0.012], sky:[0xe8dcc8, 0.45], expK:1.3, satK:0.9 }, fog:{ fog:[0xc8b494, 0.6], satK:1.06 } } },
  cards:[[402, 4, 598, 262], [1201, 20, 499, 196], [61, 254, 351, 216], [474, 272, 549, 212], [1181, 248, 436, 255]], edge:[0.1, 0.32], knee:[0.13, 0.3, 0.35],
  dome:{ on:true, in:1.5, out:0.5 }, grade:{ toe:0.7 } };   // (MERGE 31 0.7: keeps detail in the shadows without washing out night)
// Z318 BATTLEFIELD LIGHT (fx/battle-light.js): the palette every gameplay light uses (danger red, alert amber, threat orange, our systems cyan,
//   allies / objectives green, loot gold, rarities, ice, arcane); gain = HDR multiple a ring's core line burns at (above ~1 it blooms); pulse
//   rates (Hz) per urgency — idle breathing → notice → warn → alert → critical — and the floor a pulse never drops below (never fully dark);
//   dark = the backing under a ring (so it reads on sunlit sand); fogK = how much fog dims it; loot = the gold double-flash cycle (s);
//   ring presets (metres): core = half-width of the hot line, halo = falloff length, fill = inner glow depth, ticks / tickLen / spin = hologram
//   tick marks; hpCrit = our health share that lights the red screen edge; bloom per time of day [strength, radius, threshold] (night lets more bloom)
export const BLIGHT = { col:{ danger:0xff2a1e, alert:0xffa424, threat:0xff6a1c, friend:0x3ee8ff, ally:0x5cff9a, loot:0xffcf4a, rare:0x5aa9ff, epic:0xc08bff, common:0x9fe07a, ice:0x9fe8ff, arcane:0xb07cff, white:0xfff4e0 },
  gain:2.4, hz:{ idle:0.55, notice:1.1, warn:2.2, alert:3.4, crit:5.2 }, floor:0.3, dark:0.24, fogK:0.65, loot:1.3, hpCrit:0.25,
  ring:{ danger:{ col:'danger', core:0.05, halo:0.24, fill:1.4, gain:2.6, dark:0.44, scan:0.5, fog:false, depthTest:false, order:18 },
    alert:{ col:'alert', core:0.045, halo:0.22, fill:1.0, gain:2.4, dark:0.36, fog:false, depthTest:false, order:18 },
    ally:{ col:'ally', core:0.05, halo:0.26, fill:1.2, gain:2.0, dark:0.18, ticks:48, tickLen:0.32, spin:0.012 },
    friend:{ col:'friend', core:0.04, halo:0.2, fill:0, gain:2.0, dark:0.12, ticks:60, tickLen:0.25, spin:0.006 },
    loot:{ core:0.035, halo:0.14, fill:0.5, gain:2.2, dark:0.14, ticks:24, tickLen:0.14, spin:0.08, depthTest:false, order:5 },
    shock:{ col:'white', core:0.035, halo:0.1, fill:0.25, gain:2.2, dark:0, fog:true } },
  bloom:{ day:[0.3, 0.5, 0.86], dusk:[0.34, 0.52, 0.82], night:[0.42, 0.55, 0.76] } };
// Z242 OPEN GROUND — town and countryside battlefields keep more open space: cover shapes × cover, city blocks built up to `built` (was 0.66),
//   village homes × houses, village trees × trees
export const OPEN_LAND = { CITY:{ cover:0.55, built:0.42 }, VILLAGE:{ cover:0.6, houses:0.6, trees:0.68 }, MEADOW:{ cover:0.8 } };
// Z240 PERFORMANCE HUD (F3 / ?perf): frames averaged, refresh interval (s), frame-time colour bands (ms) — green ≤ good, amber ≤ warn, red above
export const PERF_HUD = { n:120, every:0.5, good:16.7, warn:25 };
// FLAGS GONE (yêu cầu: "xoá các lá cờ trong game đi, k cần nữa"): no flag, banner or flagpole is drawn anywhere — the forts, the depots, the camps, the
//   rally point, our walls and command post (world/heightfield.js makeFlag hands back a hidden mesh, nothing waves; the poles are not put up)
export const WORLD_FLAGS = { on:false };
// PERF 9 THE HEAVY BATTLEFIELDS ON A DIET (yêu cầu: "giảm nhẹ loại bỏ bớt những thứ k cần ở các trận nặng… miễn game còn đẹp"): measured on an M4, a
//   meadow frame was ~50 ms — the woods past the fence 7 ms, the grass carpet 4.5, the trees 5.3, cover 4.7, bushes / reeds / stones 2.3. Cut where the
//   eye does not miss it: forest = the woods reach `near` m past the fence (was 260: the rest sits in the haze) with at most `max` trees, and they take
//   no shadow (the sun's shadow map covers ~44 m round the soldier); grass = the photographed carpet `R` m round the camera (was 40; beyond it the
//   floor's own grass tint carries on) at `perCell` clumps a cell (was 3); flora = the share of bushes, reeds, hay and tufts each land keeps (not its
//   trees). ?nodiet turns it all off (for measuring)
export const DIET = { on:!(typeof location !== 'undefined' && /[?&]nodiet\b/.test(location.search)), forest:{ near:170, max:1400 }, grass:{ R:30, perCell:2 },
  flora:{ MEADOW:0.65, SAVANNA:0.65, RUINS:0.7, CITADEL:0.75, CITY:0.8, VILLAGE:0.7, HILLS:0.7 },
  land:{ MEADOW:{ near:130, max:800, R:26, flora:0.5, trees:0.7 } } };   // the heaviest land (couldn't hold an even 30 at ×1.0 without AO): its own, deeper cuts — trees = the share of its field trees kept
// MEM 1 the models a new battlefield neither asks for nor draws leave the GPU and their caches once it stands (actors/models.js releaseModels):
//   without it the Mac app grew ~2 GB a battle to 11 GB and the machine swapped. ?nomemtrim keeps everything (for measuring)
export const MEM_TRIM = { on:!(typeof location !== 'undefined' && /[?&]nomemtrim\b/.test(location.search)) };
// PERF 8 frame pacing (game/loop.js paceSkip, CÀI ĐẶT → KHUNG HÌNH: tự động · 60 · 30): slackMs = how early a tick still counts as the frame's turn (ms);
//   auto drops 60 → an even 30 after slowS s under low60 fps, holds 30 at least hold s (doubled each failed try, up to ×16), and tries 60 again once
//   upShare of probeN display ticks right after a frame came within probeMs (the GPU was done inside one tick)
export const FRAME_PACE = { slackMs:4, low60:52, slowS:2, hold:15, probeMs:21, probeN:90, upShare:0.9, warmS:8, roomK:0.75, roomS:6, upEvery:10 };   // warmS: a fight's first seconds the governor does not judge · locked at 30, roomK of the display ticks after a frame inside probeMs for roomS s in a row gives back AO, then resolution a step every upEvery s
export const SHAKE = { levels:{ off:0, low:0.32, mid:0.6, high:1 }, def:'low', pos:0.7, roll:0.018, aberr:0.0035 };
export const TOUCH_HELP = [
  ['Cần lái (nửa phải màn hình)', 'Đẩy về hướng muốn đi — súng tự bám địch gần nhất, anh đi đâu súng vẫn ngắm mục tiêu'],
  ['BẮN (trái)', 'Giữ để bắn · TỰ BẮN: tự khai hoả khi súng đã chĩa trúng địch'], ['LƯỚT', 'Bứt tốc / phi nước đại'], ['SÚNG', 'Đổi súng'], ['KỸ NĂNG', 'Dùng / đổi kỹ năng — có drone địch thì nút này tự chuyển sang GÂY NHIỄU'],
  ['LÍNH', 'Chạm: xuống / lên xe, ngựa'], ['HẠ GỤC (chỉ hiện khi áp sát sau lưng / bên sườn địch chưa hay biết)', 'Dao găm: hạ gục lặng lẽ — chạm nút đó, hoặc nút LÍNH'], ['TẬP KẾT / XUNG PHONG / LÍNH DÙ', 'Ba nút chỉ huy quân ta'], ['TỰ ĐỘNG', 'Camera tự động: tự lùi xa khi đông địch / gần thành, tự gần lại khi yên'], ['1.5× · ⟳', 'Đổi độ zoom · xoay góc nhìn 45°'], ['⏸', 'Tạm dừng — có nút bật/tắt nhạc nền và nút xem bảng điều khiển'] ];
// Z107 FORTRESSES (ĐẠI BẢN DOANH) — every stage the enemy holds 3–4 walled strongholds, each with a name and a commander.
//   Walls (solid, block fire) with riflemen along the top, watchtowers at the corners, ONE heavy gate. Inside: a crowded garrison (it pours out once you come near or the gate falls) + the commander.
//   Troops on the open field SALLY from these gates (no-tanks: every gate stands open); the main citadel's commander is the stage's general,
//   who takes the field when the soldier walks in or a wall falls.
// Z420 THE DEFENCE IN DEPTH (world/defense.js): the forts ring our base; the enemy closes the ring as an army holds a line — between every two
//   neighbouring forts an obstacle belt of dragon's teeth runs wall to wall (never inside our home ground: Rb = HOME_GAP.wall + gap + rb m from the
//   Core), broken once at its middle — the LANE (at most `lanes`), closed by a CHECKPOINT (a jersey funnel on our side, a T-wall chicane, a sandbag MG
//   nest behind it and a guard tower); FIGHTING POSITIONS — sandbag crescents facing our base — sit behind each belt and in the depth, and the random
//   maze cover past the ring thins (maze.cut). On a field with a river the river is the line: every crossing gets the checkpoint on its far bank and
//   short wings of teeth. belt: step / row = spacing along a belt and between its two staggered rows (m), run / hole = teeth in a run, spaces left out
//   between runs, wob = its wander (m), wall = where it leaves a fort (m past its wall), fortPad = how near a fort's wall a tooth may stand, maxSpan =
//   the widest gap round the Core between two forts still joined (rad), spawnGap = the sector round our spawn's bearing left open (rad, either side)
export const DEFENSE = { on:true, rb:8, rbMobile:6,
  belt:{ step:4.2, row:3.1, run:[6, 10], hole:[1, 2], wob:5, wall:10, fortPad:3, maxSpan:4.2, spawnGap:0.6, twoLanes:150, kinds:{ _:['teeth'], ARCTIC:['teeth','teeth','hedgehog'], TUNDRA:['teeth','hedgehog'], VOLCANO:['teeth','hedgehog'], FOUNDRY:['teeth','jersey'], STEELMILL:['teeth','jersey'], CITY:['jersey'] } },   // Z423 twoLanes: a belt longer than this (m) opens twice
  lanes:5, laneW:17,
  // Z423 each land its doctrine (world/defense.js header): style per battlefield and each style's numbers — line: half the arc (rad), teeth spacing, a pillbox
  //   every pill m (box, its scale); hedge: a cluster every step m, its three hedgehogs [u, v]; crate: a container's length, the share stacked; curtain:
  //   the wall section (k, w m), the gatehouse in the lane (its scale); bocage: a tree every other step, the log bank between; lava: a crater every step
  //   m (scale), glowing rocks between; terraces: rows, their spacing (m), wall run / gap (m), half the arc; kopje: strongpoints per stage, the sandbag
  //   ring's radius and sections, spacing; pockets: the ruins that hold nests, sniper towers; streets: checkpoints, spacing, the side-street blocks
  style:{ DESERT:'line', SAVANNA:'kopje', ARCTIC:'hedgehog', TUNDRA:'hedgehog', FOUNDRY:'containers', STEELMILL:'containers', CITY:'streets', CITADEL:'curtain',
    RUINS:'pockets', MEADOW:'bocage', HILLS:'bocage', VILLAGE:'bocage', VOLCANO:'lava', QUARRY:'terraces' },
  line:{ step:3.4, pill:40, box:'bunker_dome', boxS:0.55 }, hedge:{ step:7, tri:[[0, 0], [1.9, 1.6], [-1.9, 1.6]] }, crate:{ len:6.0, stack:0.3 },
  curtain:{ k:'castle_wall', w:20, gate:'gatehouse', gateS:0.75 }, bocage:{ step:6.5, trees:['tree_oak', 'tree_pine'], s:[0.5, 0.7], bank:'sandbag' },   // (Z431 the bank: sandbags, not a log pile — log piles read fake)
  lava:{ step:18, s:[0.65, 0.95], rocks:['lava_rock_a', 'lava_rock_b', 'lava_rock_c'] }, terraces:{ rows:3, gap:15, run:18, hole:11, span:1.2 },
  kopje:{ n:[4, 4, 5, 5, 6], ring:5.2, bags:8, gap:50 }, pockets:{ keys:['ruin_overgrown', 'skeleton_block', 'gargoyle_wall', 'corner_store', 'temple', 'gothic_gate'], towers:2, tower:'gt_broken' },
  streets:{ n:4, gap:55, block:['road_barrier', 'tire_wall'] },
  // the men who hold the posts (garrisonDefense): at most max[stage] (× mobileK on phones), rpg = share with a launcher from stage 2, loot = share that drop something
  garrison:{ max:[10, 14, 18, 22, 26], mobileK:0.5, rpg:0.25, loot:0.2 },
  // a checkpoint, an entry control point drawn as one piece of architecture in the lane's frame (u across it, v along it, + toward the enemy): WALLS =
  //   continuous runs [kind, u0, v0, u1, v1] laid section against section at each kind's true length (len, m: the fitted scans × COVER_K, a hair under
  //   so no seam opens) — the jersey funnel narrowing on our side, the T-wall chicane (two staggered walls: a vehicle must weave), the sandbag MG nest
  //   (a U, open to the rear) — and its guard tower behind; r = the ground it claims; wing = teeth either side on a river's far bank
  cp:{ r:12, wing:4, len:{ concrete:3.55, jersey:2.3, sandbag:3.7 },
    walls:[ ['jersey', -10.5, -17, -6.2, -8.6], ['jersey', 10.5, -17, 6.2, -8.6], ['concrete', -9.4, -2.2, 2.0, -2.2], ['concrete', -2.0, 4.6, 9.4, 4.6],
      ['sandbag', -9.6, 11, -2.6, 11], ['sandbag', -9.9, 11.6, -9.9, 15], ['sandbag', -2.3, 11.6, -2.3, 15] ], tower:[7.2, 13.5],
    posts:[[-7.2, 13.2, 'mg'], [-4.8, 13.2, 'mg'], [1.4, 7.0, 'cp']] },   // Z423 where its men stand: the MG nest, behind the chicane
  pos:{ n:[4, 5, 6, 7, 8], mobileK:0.6, gap:34, pad:12, fortPad:12, walls:[[-3.7, 0, 3.7, 0], [-4.1, -0.6, -4.1, -4.2], [4.1, -0.6, 4.1, -4.2]], kinds:{ _:['sandbag'], FOUNDRY:['sandbag','jersey'], STEELMILL:['sandbag','jersey'], CITY:['sandbag','jersey'], QUARRY:['sandbag','concrete'] }, back:0.35 },
  maze:{ cut:0.55 },
  biomes:{ CITY:{ belt:false } } };
// Z420 THE COMMAND COMPOUND (world/fortress.js buildCore): every fort's command post is a compound of real bunkers instead of the drawn stone block-house —
//   the main building faces the gate, its comms stand behind it (out of the gate's line of fire), its guns cover the approach from the gate; one HP for the
//   whole compound (any piece hit wears it), all of it goes up together. Per tier: [scene key | alternatives, x across (+ = the fort's outer side), z toward
//   the gate, yaw (rad, 0 = facing the gate), role]; the first is the main building. k = the offsets' scale on phones (the smaller forts); off = ?procbase
export const FORT_CMD = { on:true, k:{ mobile:0.82 }, rim:1.5,
  tiers:{ 1:[ ['bunker_green', 0, 0, 0, 'main'] ], 2:[ ['bunker_store', 0, 0, 0, 'main'] ], 3:[ ['hq_modular', 0, 0, 0, 'main'] ] },   // Z434 one building each, no ring of bunkers, masts and guns round it: the yard is for the fight
  scale:{ 1:1.1, 2:1.15, 3:1.1 }, board:false,   // Z434 the building a little bigger than its scan's size (it is the fort's heart), no name board on legs before the door
  name:{ 1:'TRẠM CHỈ HUY', 2:'SỞ CHỈ HUY', 3:'BỘ TỔNG HÀNH DINH' } };
// Z453 CASTLES ON CRAGS (world/fort-hill.js): per battlefield, every fort on a rocky hill — h m [capital, tier 2, tier 1] over a plateau top m wider than
//   the fort, its flanks base m (× (1 + ramp) on the gate's side, × cliff behind, ragged ± rag, crag m of ledges), rocks scans r m on the flanks (none
//   within roadA rad of the road up) — the capital open (its walls only within keepArc rad of the rear) with its keep on a ward h m up (r m, edge m of
//   steep side, a ramp rampW × rampL m toward the gate, at × the fort's radius behind its centre); every yard paved (pave/, tile m, tint)
export const FORTHILL = { on:true, biomes:{
  // Z461 THE DESERT'S DUNES (world/fort-hill.js with no rock in it): the forts on sand hills — the capital crowning the greatest dune, gentle toward its gate,
  //   a steep slip face behind — sharp-crested seif dunes running between them (ridge: sharp = the crest's profile power), barchan dunes over the field
  //   (knolls: lee = the slip face's width × to leeward of the wind's bearing, sharp = the profile), a soft ripple (bump); our compound and the spawn kept flat
  DESERT:{ h:[17, 9, 6], top:9, base:52, ramp:1.0, cliff:0.5, rag:0.18, land:{ ridge:{ k:0.8, saddle:0.55, w:38, steep:0.42, wander:22, sharp:1.25 },
    knolls:{ n:14, h:[5, 12], r:[24, 46], lee:0.42, wind:0.33, sharp:1.35, near:-28, gap:-6, edge:0.25 }, bump:0.55, clear:[34, 52] } },   // (near / gap < 0: a dune runs up onto a fort's sand hill, into the next dune)
  // Z462 THE ARCTIC'S ICEBERG CITADELS (world/iceberg.js — no hills: h 0): the capital, and the fort with most room round it, cut off on icebergs. berg:
  //   n forts (phones 1) · top = the berg's height over the ground · rim = its lip past the walls (+ rag ± m, wandering; back = how far past the fence it
  //   may run, fence = m inside it where the water fades out) · sheer = the ice wall's run · moat = the open water's width (m, varying round it) · bank =
  //   the shore rising back · bed = the moat's floor under the water level · the shore's landing for the bridge: land = how far below the berg's top,
  //   pad = its radius; its ramp down along the shore: ramp = the grade, rampW = half width, side = their slopes' run · cracks: how many, L = how far in,
  //   w = how wide at the lip · faces: photographed ice fronting the walls (lip = how far over the top, sink = share under the floor, o = out from the lip,
  //   deep = their thickness ×, overlap, gap = rad kept clear round the bridge, those beside it narrowed to no less than minW m) · shards: tall ice stood on the lip (lip = that share) and out in the
  //   water, h = how far over the top, thin = width × per model · floes: adrift in the moat, w = their width · span: the rope bridge (hw = deck half
  //   width, sag = share of the span [, at most m], plank = spacing, gaps = planks missing, rail = hand rope height, post = the anchor posts' height,
  //   path = the track's width)
  ARCTIC:{ h:[0, 0, 0], top:0, base:1, ramp:0, cliff:1, rag:0, land:{ bump:0, clear:[30, 44] },
    berg:{ n:2, top:12, rim:7, rag:1.5, back:6, fence:[1, 6], sheer:3, moat:[9, 16], bank:5, bed:-3, land:4, ramp:0.4, rampW:4, pad:6, side:9, cracks:[3, 5], crack:{ L:[3, 5.5], w:[2.2, 3.6] },
      faces:{ keys:['ice_block', 'ice_serac', 'ice_block'], lip:[0.6, 2.2], sink:0.12, o:[1, 2.6], deep:0.32, overlap:0.6, gap:0.11, minW:4 },
      shards:{ n:16, keys:['ice_pillar', 'ice_serac', 'ice_pillar'], h:[12, 28], lip:0.55, gap:0.45, thin:{ ice_pillar:0.3, ice_serac:0.42 } },
      floes:{ n:12, keys:['ice_floe', 'ice_floe', 'ice_block'], w:[3, 9], sink:0.3, flat:0.6 },
      span:{ hw:1.25, sag:[0.05, 1.6], plank:0.36, gaps:0.05, rail:1.05, post:1.6, path:4 } } },
  QUARRY:{ h:[12, 8, 5], top:14, base:30, ramp:0.9, cliff:0.26, rag:0.22, crag:0.7, rocks:14, rock:[2.4, 4.5], roadA:0.4, cliffs:['hill_cliff', 'hill_crag', 'hill_ledge', 'hill_cliff'], outcrops:9, outS:[0.55, 1.0], outSink:0.28, tone:[1.25, 1.22, 1.2], road:['road_rocks', 'road_boulder'], roadN:0.16, roadS:[[0.9, 1.8], [1.4, 3.2]], open:true, keepArc:1.35, keep:'modular_fort_01_wall_thick_corner_01', mix:'modular_fort_01_wall_thick_corner_01', bury:1.4,
  ward:{ h:4.5, r:13, edge:2.6, rampW:9, rampL:20, at:0.36 }, paveTile:4.5, paveTint:[1.0, 0.98, 0.95], paveSteep:0.6, kerbW:1.6, kerbK:0.72,
    spur:{ top:7, p:4, cliff:0.15, ramp:0.25, path:{ w:5, W:[13, 8], grade:0.18, legs:[3, 6], sh:3, foot:4 }, gate:{ k:'gate_stone', w:14, pillars:0.32, back:3 } },   // Z456 the capital on a spur (world/hill-climb.js): its plateau top m past the walls, sheer all round (cliff × base wide) but a tongue toward the gate (cos^p of the bearing), ramp 0: the tongue too steep to drive straight up — one track winds up it, w m wide, its hairpins W m either side of the tongue's line (foot, rim), as many legs as keep the grade under grade, the bank above blended over sh m, foot m out onto the plain
    edge:{ keys:['hill_ledge', 'hill_cliff', 'hill_crag'], h:[26, 42], o:[6, 16], lip:0.9, drop:18, overlap:0.62 },
    land:{ ridge:{ k:0.75, saddle:0.6, w:26, steep:0.32, wander:14 }, knolls:{ n:6, h:[4, 8.5], r:[18, 32] }, bench:{ h:2.4, edge:0.72, min:1.4, share:0.5, jag:0.8 }, bump:0.5, clear:[34, 50] },   // Z455 the land: ridges joining the crags (crest × the crags' height, dip to a saddle, one flank × steep, wandering m), knolls, quarry benches (riser every h m, on a share of the flanks), fbm knobs bump m, clear of our compound [r0, r1] m
    perch:{ n:10, keys:['road_boulder', 'road_rocks'], h:[2.5, 5], sink:0.08 },
    steep:{ min:0.75, grid:5, n:46, gap:11, reach:6, h:[4, 13] }, spire:{ n:12, share:0.7, perKnoll:1, keys:['hill_cliff', 'hill_crag'], h:[7, 12], thin:0.85 }, lime:{ desat:0.72, tint:[1.16, 1.12, 1.05] },   // Z455 rock faces on every steep flank (rise ≥ min per m, sampled every grid m, gap m apart, as tall as the drop over reach m) · rock spires on the crests
    trees:{ grid:4, min:0.75, lip:0.4, reach:12, drop:3, gap:20, wall:5, n:12, keys:['tree_snag_lean', 'tree_snag_tall'], h:[9, 14], lean:[0.16, 0.38], back:1.2, oak:{ n:2, h:[17, 23], off:[0.15, 0.35] } },   // Z455 trees on the crags (world/hill-trees.js): dead trees at the lip of a drop (slope over min, walked uphill up to reach m till it eases under lip, at least drop m above the slope's foot), back m in from the edge, leaning out over it, no nearer a fort than wall m outside its walls (its crag's lip is the best ledge); ancient oaks on the knolls' crowns, off × R from the top where the footpath ends
    scatter:{ n:46, group:3, big:0.35, bigS:[2.5, 5.5], smallS:[1.2, 3] } } } };
export const FORT = {
  coverK:0.55, coreFire:55, crater:{ rim:0.7, depth:2.4 },   // Z434 the yard's cover × (a fort's yard was a junk pile) · how long (s) the command post's wreck burns · its crater: rim raised, pit sunk (m)
  count:[3,3,4,4,4], countMobile:[2,2,3,3,3],   // Z234 phones: the 130 m field holds fewer forts now that they stand clear of our citadel
  tiers:{ 1:{ r:[31,35], sides:[6,8], towers:2, gunners:[8,10],  inf:[16,22], tanks:[1,2], gate:600,  cover:[8,11],  name:'ĐỒN' },        // Z107 roomy: room to manoeuvre and dodge inside
          2:{ r:[35,40], sides:[6,8], towers:4, gunners:[10,14], inf:[24,32], tanks:[2,3], gate:950,  cover:[11,14],  name:'PHÁO ĐÀI' },
          3:{ r:[41,45], sides:[8,8], towers:4, gunners:[14,18], inf:[30,40], tanks:[3,5], gate:1450, cover:[14,18], name:'THÀNH' } },
  gatePerStage:0.22, mobileMul:0.6, mobileR:0.8, minR:26,   // Z234 mobileR: fort radius on phones (the 130 m field) · minR: never smaller (the gate wall needs its length)
   wallH:8.0, wallT:2.8, gateW:4.6, seg:3,   // Z241 great walls: 7 → 11 m high, 2.4 → 3.2 m thick · TO SCALE (no tanks): 8 m high, 2.8 m thick, a 4.6 m gate — a 1.78 m man against real castle walls
  // Z241 ARCHITECTURE (m): tall corner towers rise `tall` above the wall-walk (width tallW), the other corners are squat bastions (bastW, +bastH);
  //   curtain walls longer than flankMin get a flanking tower (flankW, +flankH) proud of the outer face; gate towers +gateH[tier<3, capital], gateW2 wide;
  //   the capital's donjon keepW wide, keepH high, its four turrets +turret above it
  arch:{ tall:7, tallW:4.6, bastW:4.0, bastH:3, flankMin:22, flankW:5.0, flankH:4, gateH:[6,8], gateTW:[4.6,5.4], keepW:12, keepH:22, turret:5, flagH:[15,18] },   // (TO SCALE: towers ~15 m, gate towers 14–16, the donjon 22 + 5; were 23, 23–27, 34 + 8 — sized round tanks)
  wakeR:52, liveInf:16, liveInfMobile:9, sally:[10,16], sallyInf:[3,6], fromGate:0.7,                  // seconds between sallies per fortress · squad size · tank chance · share of wave spawns out of a gate
  cmdType:'rifle', cmdHp:8, tunnel:[1,2], cmdScale:1.0, escort:[6,10], escortMobile:[4,6], escortR:[4,8],   // Z107 the commander: an officer on foot (no-tanks), tough, ringed by bodyguards
  ram:{ minV:6, fullV:15, gate:0.5, wall:0.55, buffMul:1.5, cd:0.4 },    // Z111 RAMMING: a hit at 15+ takes 50% of a gate / 55% of a wall section → 2 rams open either
  gate:{ open:4.5, speed:0.9, inner:5, outer:6, exitMax:18 },                       // Z111b the gate swings open for every sortie (stays open while troops file through) and shuts behind them
  posture:{ near:40, you:10, inf:1, gInf:0.6, gCmd:6, holdK:0.6, every:[5,8], waveInf:4 },   // Z111b we come close: our strength (you 10×hp% + 1/soldier) ≥ 0.6× the garrison's → they SHUT THE GATE and hold; weaker → they open up and sally in waves
  wallHpK:0.8, wallShotK:1, shotStructMin:1,                            // Z111 easier sieges: a wall section has 0.8× the gate's HP and takes full shell damage; vs gate/wall every gun hits at least ×1 (the rifle's KIN ×0.6 no longer applies)
  loot:{ drops:3, armoury:1 },   // a taken fort: power-ups by its tier, plus one from its armoury
  names:['HẮC SƠN','ƯNG SẮT','ĐẦU LÂU','LANG NHA','XÍCH VĨ','BÃO LỬA','CỔ THẠCH','HẮC LONG','THIẾT BÍCH','HUYẾT NGUYỆT'],
  chiefs:['BÁ ĐỒ','HOẢ LANG','THIẾT ƯNG','KHÔ LÂU','HẮC HỔ','BÃO CÁT','ĐỘC NHÃN','SẮT ĐÁ'] };
// Z112 HARD OBSTACLES — lone boulders and steel hedgehogs on the road can be shot apart to open a lane (the rock ridges stay: terrain)
//   ~3 main-gun shells crack a boulder, one heavy round (≥ oneShot after the structure multiplier) shatters it; the burst of stone wounds men close by.
//   Enemy fire never breaks them (they are your cover too).
export const HARD = { boulder:150, hedgehog:110, oneShot:90, shardR:3.6, shardDmg:28,
  hits:3, lightHits:6, lightDmg:8, ridgeK:1.3 };   // Z121 ANY tank gun breaks a rock in `hits` shots (rapid light guns: `lightHits`), whatever its damage; ridge rocks are breakable too (×ridgeK stone)
// Z121 GORE: ground blood splats [desktop, phone] · body chunks [desktop, phone] · seconds a splat stays (last `fade` s fading) · chunk life ·
//   chunk speed m/s (× the round's power) and lift · spread cone (rad) · blood colour / opacity
export const GORE = { splats:[160,70], chunks:[64,28], splatLife:24, fade:6, chunkLife:2.4, speed:[12,27], up:[4,11], cone:0.9, color:0x7a0a0a, alpha:0.82 };
// Z112 KNOCKED-OUT TANKS by the killing gun (seconds of fire before the magazine goes): heavy shells blow them at once, small arms let them burn a moment
// Z402 A KILLED TANK BLOWS APART AND IS GONE (fx/dying.js — enemy tanks and vehicles, our captured tanks, the boss): no burning phase, no wreck — the blast,
//   its torn steel thrown out (fx/debris.js spawnTankWreck: glowing, lands, gone within chunkLife s, the last fade s fading), a smoke puff (smokeK = the
//   blast's rolling cloud lasts this share of its usual life) and in that same frame the hull leaves the field and its collider. wreck = the life of
//   fx/fire-wrecks.js spawnWreck's burning hulk (no kill leaves one any more)
export const BLAST_DEATH = { chunkLife:[1.3, 2.1], fade:0.6, smokeK:0.45, wreck:[9,13] };
// Z402 A MAN SHOT DEAD IS THROWN AND GONE (actors/infantry.js, ours in actors/fireteam.js): small arms throw him speed / up m/s along the shot (× the round's
//   weight, clamped to k) — heavy rounds and blasts throw him INFANTRY.fling; he tumbles with his limbs flung out, lands, slides lie s and bursts (blood mist,
//   dust) — gone; never later than max s after the kill (off a wall or a tower); a man crushed under tracks bursts after crush s
export const DEATH_POP = { speed:[6.5, 9], up:[5.5, 7], k:[0.8, 1.3], lie:0.35, max:1.6, crush:0.5 };
// Z402 FUEL DRUMS GO UP (world/scenery.js oil drums, world/cover.js drum stacks): hp, then a blast of radius r m — dmg at its heart, edge share at the rim,
//   fire = fireball size; drums within chain m go up after it (delay s); nothing is left where it stood (no heap, no collider)
export const FUEL_DRUM = { hp:30, r:5.5, dmg:50, edge:0.3, fire:1.2, chain:6.5, delay:[0.15, 0.4] };
// Z414 THE BIG FUEL GOES UP TOO (world/cover.js fuelDrumHit, world/supply.js pieceDown): the scanned fuel-farm tanks (steel) and rail tankers (rail) of the
//   land's set, as fuel blocks with hp like the supply base's own (SUPPLYB.hp fueltank / tanker); boom = blast size, r / dmg / edge / fire as FUEL_DRUM, chain m
//   = the fuel round it set off after it (drums go up, a tank / tanker takes spread × its max hp — so a farm burns through in two or three blasts, not one);
//   the supply base's fuel tanks and tankers blow the same way and are gone (no charred hulk), the ground burning burn s where they stood
export const FUEL_TANK = { steel:{ hp:300, boom:3.2, r:9, dmg:80, edge:0.3, fire:3.0, chain:13, spread:0.5, delay:[0.3, 0.7] }, rail:{ hp:140, boom:2.2, r:6.5, dmg:60, edge:0.3, fire:2.0, chain:10, spread:0.5, delay:[0.25, 0.6] },
  drumSpread:0.15, burn:4 };
// Z402 TENTS ARE WALLS UNTIL THEY BURN (world/camps.js — the camps' tents, the outposts'): a tent stops tanks and men and both sides' eyes (enemy sight,
//   the player's auto-aim and lock-on); one hit sets it alight — it burns burn s (the canvas chars, and sags over the last sag share) and is gone with
//   its collider. Sight lines run from / to eye m above the ground: a tank's [tank], a man's [man], a target's middle [mid]
export const TENT = { burn:2.2, sag:0.45, eye:{ man:1.5, mid:1.1 } };
// how many tubes each gun really has (shown on the gun card)
// Z117 GAMEPAD (Gamepad API "standard" mapping — Xbox-layout pads: Flydigi Direwolf 4 in XInput/Switch mode, Xbox, DualSense, Switch Pro…)
//   def = the player's settings (PROFILE.pad): vib on/off · vibK strength · engine hum · dead zone · auto-aim on release · swap A/B (Nintendo labels)
export const PAD_CFG = { def:{ vib:true, vibK:0.8, dead:0.15, assist:true, swapAB:false, phone:true, sens:1, lob:true },
  lob:{ min:10, maxMul:1.5, speed:26, dead:0.1, arc:Math.PI/2, ease:10 },   // Z128 high-angle guns (mortar / rocket) on a pad: the barrel is tied to the hull's FRONT 180° arc; right stick ←/→ swings inside it, ↑/↓ lengthens / shortens the shot (m/s)
  aim:{ slew:4.2 /* Z145 superseded by TURRET.rate */, k:9, minMag:0.3, smooth:0.035 },   // Z124 right stick: the gun follows the stick angle with an eased, rate-capped swing (rad/s) — no snap, no jitter near the dead zone
  hull:{ k:6, ease:9, speedFull:0.92 },              // Z124 left stick: the hull turns in proportion to the angle error (eased); stick tilt sets the TOP SPEED (full tilt = full speed)
  sensSteps:[['THẤP',0.7],['VỪA',1],['CAO',1.35]], rtFire:0.35, assistAfter:0.45, phoneTick:{ ms:14, gap:150 }, navFirst:0.26, navRepeat:0.14 };
// Z145 TURRET TRAVERSE: the gun swings at a real, capped rate (rad/s) — mouse a little quicker than the stick — and the player sets the speed
//   (PROFILE.turretK, Settings → TỐC ĐỘ XOAY NÒNG: presets or ± 10% steps)
export const TURRET = { rate:2.6, k:9, min:0.3, max:2.5, step:0.1, steps:[['CHẬM',0.6],['VỪA',1],['NHANH',1.5]] };
// XK-UI SETTINGS DEFAULTS — Cài đặt → Mặc định puts the open tab back to these (the pad's own are PAD_CFG.def, the HUD's live in ui/hud-prefs.js,
//   the shake's SHAKE.def). fps: 'auto' | '60' | '30' (game/loop.js paceMode). (TURRET above is no longer read: the soldier has no turret, its row left Settings.)
export const SETTINGS_DEF = { difficulty:'soldier', quality:'high', fps:'auto', sfxVol:'mid', ctrl:'screen', camStyle:'cine' };
export const PAD_HELP = [
  ['Cần trái', 'Đi (theo màn hình, hoặc xoay thân nếu chọn trong Cài đặt)'], ['Cần phải', 'Ngắm — thả ra: tự ngắm địch gần nhất. Súng phóng lựu M79: ←→ xoay hướng, ↑↓ chỉnh tầm ném'],
  ['RT', 'Bắn (giữ = liên thanh)'], ['LT', 'Dùng kỹ năng'], ['A', 'Bứt tốc / phi nước đại'], ['B', 'Xuống / lên xe'], ['X', 'Đổi kỹ năng'], ['Y', 'Bật / tắt tự bắn'],
  ['LB · RB', 'Súng trước · súng sau'], ['D-pad ↑', 'Tập kết toàn quân'], ['D-pad ←', 'Xung phong vào thành'], ['D-pad ↓', 'Gọi lính dù'], ['D-pad →', 'Camera tự động'],
  ['L3 (nhấn cần trái)', 'Đổi mức thu phóng'], ['R3 (nhấn cần phải)', 'Đặt lại camera'], ['☰ Menu', 'Tạm dừng'], ['⧉ View', 'Bảng phím'],
  ['Trong menu', 'D-pad / cần trái chọn · A bấm · B quay lại'], ['M1 · M2 (nút sau)', 'Gán trong ứng dụng Flydigi Space Station, ví dụ M1 = A (bứt tốc), M2 = B (xuống / lên xe)'] ];
// Z119 BATTLE INTRO: cinematic view distance + fog (the sweep no longer draws the whole field), shader warm-up time budget, skip guard
// Z288 the city opens on film: the city's tower from its foot (tilt up), then a tracking shot down the busiest boulevard (seconds, lens fov, camera speed m/s)
export const INTRO_CITY = { on:true, tower:{ dur:3.4, fov:36, back:0.95 }, street:{ dur:3.2, fov:48, v:9, h:1.5, off:4.2 } };
// NAMES 1 FICTIONAL PLACES ONLY (data/text-vi.js BIOME_PLACE, world/wonders.js): a war game must not set its fights in a real country, city or monument —
//   above all none at home. banned = every real name the game once showed, and the usual spellings of the home country's own (with and without
//   diacritics); test.js fails when one comes back in any player-visible text (src, config, index.html, css, voice lines, store / app text) — whole
//   words, any case. cityTower = the generic scan that stands as the harbour city's landmark; retired = scans of real buildings, kept on disk, never placed.
export const NAMES = { cityTower:'bld_rise', retired:['bld_landmark', 'bld_lm81', 'bld_burj', 'bld_needle'],
  banned:[ 'Việt Nam', 'Viet Nam', 'Vietnam', 'Sài Gòn', 'Sai Gon', 'Saigon', 'Hồ Chí Minh', 'Ho Chi Minh', 'TP. HCM', 'Hà Nội', 'Ha Noi', 'Hanoi', 'Huế', 'Đà Nẵng', 'Da Nang',
    'Hải Phòng', 'Cần Thơ', 'Điện Biên', 'Khe Sanh', 'Củ Chi', 'Quảng Trị', 'Quảng Bình', 'Trường Sơn', 'Bạch Đằng', 'Hoàng Sa', 'Trường Sa',
    'Landmark 81', 'Bitexco', 'Chùa Một Cột', 'One Pillar', 'Ngọ Môn', 'Cổ Loa', 'Sơn Đoòng', 'Phong Nha', 'Kẻ Bàng', 'Hang Én', 'Tú Làn', 'Bến Thành', 'Chợ Lớn', 'Thủ Thiêm',
    'Bến Nghé', 'Tân Định', 'Phú Mỹ Hưng', 'Gia Định', 'Thảo Điền', 'Sơn Tây', 'Đường Lâm', 'Bát Tràng', 'Hương Sơn', 'Vạn Phúc', 'Phù Đổng', 'Ba Vì', 'Bắc Bộ',
    'Giza', 'Cairo', 'Ai Cập', 'Egypt', 'Luxor', 'Karnak', 'Abu Simbel', 'Aswan', 'Saqqara', 'El Alamein', 'Djenné', 'Djenne', 'Timbuktu', 'Tây Phi', 'Châu Phi',
    'Moskva', 'Moscow', 'Kremlin', 'Thánh Basil', 'Saint Basil', 'Novgorod', 'Smolensk', 'Völklingen', 'Volklingen', 'Ruhr', 'Zollverein', 'Dortmund', 'Taj Mahal', 'Agra', 'Ấn Độ',
    'Mehrangarh', 'Jaisalmer', 'Kinderdijk', 'Zaanse Schans', 'Haarlem', 'Bourtange', 'Hà Lan', 'Vạn Lý Trường Thành', 'Great Wall of China', 'Bắc Kinh', 'Beijing',
    'Trung Quốc', 'Colosseum', 'Colosseo', 'Roma', 'Pompeii', 'Palatino', 'Carrara', 'Tuscany', 'Kīlauea', 'Kilauea', 'Hawaii', 'Mauna Loa', 'Nunavut', 'Iqaluit', 'Inuit',
    'Canada', 'Bethlehem', 'Pennsylvania', 'Burj', 'Khalifa', 'Space Needle', 'Mississauga' ] };
// Z322 THE INTRO'S SKY (game/intro-clouds.js): band = the cloud deck between these shares of the descent's height (0 = landing, 1 = high orbit);
//   puffs laid along the swoop (it flies through them) + wisps over the field; size (m), opacity of each, sideways drift (m/s); haze = the screen
//   mist at the top of the flight; inside = the whiteout inside a puff; tintK = how far the fog colour is lifted toward white (day; a third at night)
// Z325 BLEND-IN (render/blend-in.js): every lit opaque material on the field, once the stage is built — hue = share of the field's hue (the floor's
//   average colour over its brightness, clamped tintMin..tintMax per channel), desat = saturation taken off, dust = share of ground colour at the
//   foot of things, fading out over dustH metres above where each stands
export const BLEND = { on:true, hue:0.25, desat:0.12, dust:0.36, dustH:1.4, tintMin:0.7, tintMax:1.45, aoH:0.9, ao:0.5 };
// MAT 1–3 ONE WORLD (render/mat-norm.js, render/blend-in.js; fx/fire-fx.js; world/ground.js): norm = every model file measured when it loads (mean linear
//   albedo luminance, HSV saturation, roughness, metalness over the UV area it really wears) and pulled into its kind's band (rules: key pattern → kind,
//   first match; 'skip' = left as made: men, horses, guns, what he rides); k = share of the way to the band, gain / satK / roughK = the limits of the
//   correction; ref = the kind's middle its spread is squeezed toward (share sq; else the band's middle); upFrame = materials a frame whose maps it may send
//   to the GPU itself outside a fight; biome = a battlefield's extra gain per kind (rocks of the desert's own sand, the volcano's black); except = per-model overrides ({ skip:true } or its own lum / sat / rough / metal); keepStats = measurements kept for a probe
export const MATLOOK = {
  norm:{ on:true, k:0.8, sq:0.15, gain:[0.55, 1.9], satK:[0.65, 1.15], roughK:[0.6, 2.6], upFrame:1, keepStats:400, fallback:'prop',
    rules:[['^(trooper|operator|soldier|horse|carbine|rifle|blade_|inf_|drv_|ride_|wild_|boss|troopgun|ride(gallop|walk)|proj|missile|art_|siege_|mortar_|loot_)', 'skip'],
      ['^(bld_|sc:brownstone|sc:corner_store|sc:duga|sc:elevador)', 'building'], ['^(heli_|air_|mil_|car_|turret_|sc:radar|sc:tank_|sc:rail_)', 'metal'],
      ['tree|palm|bush|grove|hedge(?!hog)', 'foliage'], ['ice_|snow|igloo|iceberg', 'ice'],
      ['rock|stone|boulder|cliff|crag|ledge|outcrop|sea_stack|lava_|volcano|sphinx|lion|gargoyle|arch|skeleton|wonder_giza|quarry', 'stone'],
      ['tire', 'rubber'],
      ['fort|keep_|castle|castel|citadel|gate|wall|ruin|wonder_|temple|bastion|parapet|tower|belfry|lighthouse|fountain|bunker|pillbox|gt_|block|culvert|tunnel|dam_|jersey|concrete|teeth|hesco|sandbag', 'masonry'],
      ['camp_hq|hq_|quonset|barracks|store|furnace|crane|scaffold|house|villa|shelter', 'building'],
      ['truck|apc|jeep|humvee|launcher|wreck|generator|antenna|dish|cell_|relay|power_pole|pipes|drum|fuel|container|barrier|barricade|hedgehog', 'metal'],
      ['tent|canopy|tarp|flag|para_', 'fabric']],
    cats:{ stone:{ ref:0.12, lum:[0.10, 0.40], sat:[0, 0.32], rough:[0.6, 1], metal:0.05 }, masonry:{ ref:0.14, lum:[0.11, 0.45], sat:[0, 0.32], rough:[0.55, 1], metal:0.08 },
      building:{ ref:0.17, lum:[0.09, 0.50], sat:[0, 0.4], rough:[0.25, 1], metal:0.4 }, metal:{ ref:0.12, lum:[0.04, 0.45], sat:[0, 0.5], rough:[0.3, 0.9], metal:0.7 },
      foliage:{ ref:0.095, lum:[0.045, 0.16], sat:[0.1, 0.6], rough:[0.6, 1], metal:0 }, fabric:{ ref:0.12, lum:[0.06, 0.35], sat:[0, 0.45], rough:[0.7, 1], metal:0.02 },
      ice:{ lum:[0.30, 0.80], sat:[0, 0.3], rough:[0.2, 0.9], metal:0.02, sq:0 }, rubber:{ lum:[0.02, 0.12], sat:[0, 0.3], rough:[0.6, 1], metal:0.02, sq:0 },
      prop:{ ref:0.12, lum:[0.035, 0.50], sat:[0, 0.45], rough:[0.4, 1], metal:0.5, sq:0.15 } },
    except:{ prop_lamp:{ skip:true }, prop_gate:{ lum:[0.02, 0.3] } },
    biome:{ DESERT:{ stone:1.35, masonry:1.1 }, SAVANNA:{ stone:1.2 }, QUARRY:{ stone:1.25, masonry:1.1 }, VOLCANO:{ stone:0.85 } } },
  // MAT 2 the particle layer (fx/fire-fx.js): shimGlow = the old layers' glow sparks, flashes and odd-coloured fire drawn there too; softDepth = soft against the scene's
  //   depth (desktop), soft[0] = its fade length × the particle's size; near = the lens inside a puff: fade length × size, at least m, from m; shadow = how much of
  //   the sun's shadow a puff takes (desktop), shadowTap = its 4 taps' spread in texels, shadowBias; ramps / kinds = the shim's own (as FIREFX), white: the caller's colour
  pfx:{ on:true, shimGlow:true, softDepth:true, soft:[0.5], near:[0.6, 0.35, 0.25], shadow:0.85, shadowTap:1.5, shadowBias:0.003,
    ramps:{ pGlow:[[0, 0xffffff, 1, 1], [0.45, 0xffffff, 1, 1], [1, 0xffffff, 0, 1]] },
    kinds:{ pSpark:{ ramp:'pGlow', cells:[14, 1], layer:1, s:[1.6, 0.1], hot:0.8, stretch:0.025, prio:1 }, pFlash:{ ramp:'pGlow', cells:[13, 1], layer:1, s:[1, 0.05], hot:0.7, prio:2 },
      pFire:{ ramp:'pGlow', cells:[0, 7], layer:1, s:[1, 0.55], sit:0.42, spin:0.6, hot:0.55, prio:1 } } },
  // MAT 3 no two stretches alike (world/ground.js; render/blend-in.js for big rocks): hue = how far the land drifts between its dry and lush colour over hueM
  //   metres; damp patches over dampM m (from dampAt of the noise, hollows pulled in by hollow), darker and glossier (gloss = roughness taken off); bare dirt over
  //   dirtM m; biome = the land's colours (dry / lush × its colour, dirt colour, damp share, dirt share; _ = the rest); rock = the world-space drift on a kind
  //   of model (kinds: share of brightness swing, m = [blotch, warmth] scale in metres, warm = the warm / cool swing)
  tile:{ on:true, hue:0.34, hueM:260, dampM:70, dampAt:0.58, hollow:0.6, gloss:0.45, dirtM:38,
    biome:{ _:{ dry:[1.1, 1.04, 0.88], lush:[0.92, 0.98, 1.0], dirt:0x5a4a38, damp:0.4, dirtK:0.35 },
      MEADOW:{ dry:[1.24, 1.12, 0.7], lush:[0.82, 1.0, 0.8], dirt:0x4a3a28, damp:0.6, dirtK:0.5 }, SAVANNA:{ dry:[1.14, 1.06, 0.82], lush:[0.9, 1.0, 0.86], dirt:0x6a4a30, damp:0.25, dirtK:0.3 },
      DESERT:{ dry:[1.08, 1.04, 0.94], lush:[1.04, 0.9, 0.8], dirt:0x6e5840, damp:0.12, dirtK:0.22 }, ARCTIC:{ dry:[1.02, 1.02, 1.04], lush:[0.92, 0.96, 1.03], dirt:0x5c6066, damp:0.3, dirtK:0.15 },
      VOLCANO:{ dry:[1.1, 1.0, 0.92], lush:[0.9, 0.9, 0.95], dirt:0x2a2522, damp:0.1, dirtK:0.3 }, CITY:{ dry:[1.04, 1.02, 0.98], lush:[0.95, 0.97, 1.0], dirt:0x3e3a34, damp:0.45, dirtK:0.2 } },
    rock:{ kinds:{ stone:0.2, masonry:0.1 }, m:[22, 70], warm:0.06 } },
  // MAT 4 the far ranges (world/backdrop.js): smoothCols = their skyline low-passed over ± this many columns (~10 m each) for the light only — the silhouette keeps its detail;
  //   ao = the box the ambient occlusion is kept to (r × ARENA round the centre, y [from, to] m): past it the depth is too coarse for AO and it striped the ranges
  horizon:{ smoothCols:4, ao:{ r:1.6, y:[-150, 450] } },
  // MAT 4 ruins (world/ruins3d.js): clearStart = metres kept between a ruin's footprint and the soldier's start (his follow camera stands ~6 m behind him)
  ruins:{ clearStart:22 },
};
// Z400 CONTACT (world/decals.js paintContact, read by the ground's shader): things stood on the floor like cut-outs — a hard line where a wall met the grass, no
//   shade under a rock, the same clean sand right up to a pipe. Once a stage is built every solid footprint (blocks: walls, cover, rocks, camps,
//   buildings; the scenery's pieces) is painted into a field-wide map: shade = the floor darkened tight round it (pad m out, blurred over shadeB m:
//   the light the thing takes from the ground), skirt = trodden, dirtied earth further out (skirtW m + ragged blotches, blurred over skirtB m), tinted
//   by col (× the floor's own colour, per battlefield). BLEND.aoH / ao: the thing's own foot darkened over aoH m from where it truly meets the ground.
export const CONTACT = { on:true, res:[2048, 1024], pad:0.2, shadeB:0.8, shade:0.62, skirtW:1.5, skirtB:1.5, skirt:0.68, rK:0.85, sceneK:0.5, blot:[0.5, 1.4],
  col:{ _:[0.64, 0.56, 0.46], MEADOW:[0.58, 0.47, 0.32], RUINS:[0.6, 0.5, 0.38], CITADEL:[0.66, 0.56, 0.44], SAVANNA:[0.66, 0.54, 0.42], DESERT:[0.74, 0.62, 0.5],
    ARCTIC:[0.7, 0.72, 0.76], TUNDRA:[0.7, 0.72, 0.76], CITY:[0.6, 0.58, 0.56], FOUNDRY:[0.58, 0.54, 0.5], STEELMILL:[0.58, 0.54, 0.5], VOLCANO:[0.66, 0.6, 0.56], QUARRY:[0.66, 0.62, 0.56] } };
// Z432 TRAILS (world/trails.js): the tracks worn between the places of a battlefield — our four gates, the spawn, every fort's gate, the supply bases,
//   the depots, the underground gate, the checkpoints, the objective — joined by the shortest tree (Prim) and each leg routed on a cell grid (A*: what
//   stands is solid, slopes and water cost, a stretch already worn costs reuse × — so legs merge into trunks), cut into the fence where a track runs out to
//   the roads over the hills (heightfield.js ROAD_EXITS). Painted into the contact map's blue channel (decals.js paintContact): the body (b·body) and two
//   wheel ruts (+ rut) — the floor's shader lays a gravel photo there (set, its tile m, tint), the ruts darker and bare, mid = how much grass keeps the
//   crown and shoulders (a two-track meadow lane vs a gravel desert road); the grass carpet goes flat and thin on it. Along both sides: loose stones (per m
//   [pebbles, kerb stones]), grass clumps, a bush here and there, wild flowers (per m, both sides). w = [lane, the trunks to the gates and off the field] m,
//   rut = the ruts' half spacing ×w. No trails in the city (it has its streets) or below ground.
export const TRAILS = { on:true, path:2.2, cell:[3, 3.5], slope:5, grade:30, wet:10, out:2.5, reuse:0.45, pad:1.4, core:35, w:[3.4, 5], rut:0.24, rutW:0.85, body:150, rutV:105, blur:0.9, rutB:0.25, rutDark:0.28, wig:0.9,
  stones:[[1.4, 0.2], [0.4, 0.08]], verge:[0.7, 0.25], bush:[0.035, 0.012], flower:0.08, mask:1.6,
  biomes:{ MEADOW:{ set:'gravel_road', tile:2, tint:[0.62, 0.6, 0.52], mid:0.62, tone:'green', bush:'green', flowers:1 }, SAVANNA:{ set:'sandy_gravel', tile:2.1, tint:[0.74, 0.6, 0.48], mid:0.45, tone:'dry', bush:'dry' },
    CITADEL:{ set:'gravel_road', tile:2, tint:[0.64, 0.6, 0.54], mid:0.2, tone:'dry', bush:'dry' }, RUINS:{ set:'gravel_floor', tile:2.25, tint:[0.6, 0.58, 0.54], mid:0.35, tone:'green', bush:'green' },
    DESERT:{ set:'sandy_gravel', tile:2.1, tint:[0.8, 0.68, 0.54], mid:0, tone:'dry', bush:'dry', thin:0.35 }, QUARRY:{ set:'gravel_ground_01', tile:3, tint:[0.72, 0.7, 0.66], mid:0, tone:'dry', thin:0.3 },
    ARCTIC:{ set:'gravel_road', tile:2, tint:[0.5, 0.55, 0.62], mid:0.35 }, VOLCANO:{ set:'gravel_floor', tile:2.25, tint:[0.34, 0.31, 0.3], mid:0 },
    FOUNDRY:{ set:'gravel_ground_01', tile:3, tint:[0.46, 0.44, 0.42], mid:0 } } };
export const INTRO_CLOUDS = { on:true, band:[0.3, 0.82], puffs:16, wisps:16, size:[26, 46], op:0.55, wispOp:0.26, drift:1.6, haze:0.34, inside:0.82, tintK:0.55 };
export const INTRO = { cullR:85, bigR:40, fog:0.0095, compileWait:2500, skipGuard:0.35, assetWait:9000 };   // Z322 assetWait (ms): the longest the veil waits for the photo ground, grass and real models before the move
// Z118 HAPTIC RHYTHMS — step = [strong (heavy left motor), weak (light right motor), ms, gap-after ms]. The same patterns drive phone vibration.
//   Z125: firing does NOT rumble any more (the old per-gun rhythm table is gone), so every kick is a hit, a blast or a crash.
export const FEEL = {
  hit:     [[1,0.12,60,8],[0.12,1,60,8],[0.7,0.1,55,8],[0.1,0.55,55]],                               // shot hits you: left ↔ right shake
  hitHeavy:[[1,0.2,70,6],[0.2,1,70,6],[1,0.15,65,6],[0.15,0.9,65,6],[0.6,0.1,60,6],[0.1,0.45,60]],     // a big shell: longer, harder
  impact:  [[0.9,0.65,70],[0.4,0.3,110]],                                                             // ram a wall / a tank: a bang + a short tail
  blast:   [[0.75,0.6,90],[0.4,0.32,150]],                                                            // an explosion near you
  connect: [[0.35,0.35,120,60],[0.2,0.5,90]], test:[[1,0.1,240,80],[0.1,1,240,80],[0.6,0.6,200]] };
// Z118 ACTIONS — the one binding table (rebindable in the key sheet; PROFILE.binds overrides): [id, label, group, keys[], padButton|null, hold]
//   pad buttons = standard mapping by position: 0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 6 LT · 7 RT · 8 View · 9 Menu · 10 L3 · 11 R3 · 12-15 D-pad ↑↓←→
export const ACTIONS = [
  ['up','Tiến / đi lên','DI CHUYỂN',['w','arrowup'],null,1], ['down','Lùi / đi xuống','DI CHUYỂN',['s','arrowdown'],null,1], ['left','Quay / sang trái','DI CHUYỂN',['a','arrowleft'],null,1], ['right','Quay / sang phải','DI CHUYỂN',['d','arrowright'],null,1],
  ['fire','Bắn (giữ = liên thanh) · chuột trái','CHIẾN ĐẤU',[],7,1], ['dash','Nhảy · trên ngựa / xe: bứt tốc','CHIẾN ĐẤU',[' '],0,0], ['sprint','Chạy nhanh (giữ)','CHIẾN ĐẤU',['shift'],null,1], ['roll','Lăn né đạn','CHIẾN ĐẤU',['alt','l'],null,0], ['blade','Đao ⇄ súng (đao không gây tiếng động) · bấm chuột giữa (không kéo) / nút cạnh chuột · cuộn chuột · tay cầm: LB / RB đi qua đao, hoặc nút M1 / touchpad','CHIẾN ĐẤU',[],17,0], ['knife','Lính: dao găm — áp sát sau lưng / bên sườn địch chưa hay biết: hạ gục lặng lẽ — khi hiện nút HẠ GỤC thì bấm phím lên / xuống xe (G); chưa gán phím riêng (phím I đã là GÂY NHIỄU drone) · còn lại: đâm yếu','CHIẾN ĐẤU',[],null,0], ['climb','Lính: leo lên đá / tường / cổng / container (bấm lại: buông tay · trên cao: tụt xuống)','CHIẾN ĐẤU',['j'],null,0], ['skill','Dùng kỹ năng · bấm chuột phải · bấm nhanh LT (giữ LT = xoay camera)','CHIẾN ĐẤU',['e'],6,0], ['skillNext','Đổi kỹ năng','CHIẾN ĐẤU',['q'],2,0],
  ['droneRecon','Drone trinh sát: thả lên, đánh dấu địch quanh điểm ngắm (hồi riêng)','CHIẾN ĐẤU',['9'],null,0], ['droneFpv','Drone FPV cảm tử: lái bằng chuột / WASD · BẮN hoặc bấm lại = cho nổ (có hạn mỗi màn)','CHIẾN ĐẤU',['0'],null,0], ['droneJam','Gây nhiễu: drone địch trong 40 m mất lái vài giây (hồi riêng)','CHIẾN ĐẤU',['i'],null,0],
  ['reload','Nạp đạn (băng chưa cạn: thay nhanh, không lên đạn)','CHIẾN ĐẤU',['r'],null,0], ['gunPrev','Súng trước · cuộn chuột','CHIẾN ĐẤU',['o'],4,0], ['gunNext','Súng sau · cuộn chuột','CHIẾN ĐẤU',['f'],5,0], ['autoFire','Bật / tắt tự bắn','CHIẾN ĐẤU',['y'],3,0], ['autoAim','Bật / tắt tự ngắm (nhấn cần phải)','CHIẾN ĐẤU',['k'],11,0],
  ['crew','Xuống / lên xe, ngựa (sát lưng địch chưa hay: dao găm)','QUÂN',['g'],1,1], ['muster','Tập kết toàn quân','QUÂN',['t'],12,0], ['assault','Xung phong vào thành (L3)','QUÂN',['x'],10,0], ['para','Gọi lính dù','QUÂN',['b'],13,0], ['sqOrder','Lệnh tổ bộ binh: tự do → giữ vị trí → tiến công → vòng trái → vòng phải','QUÂN',['u'],null,0],
  ['zoomPing','Camera: phóng to ⇄ thu nhỏ · chạm đôi = về mặc định (D-pad ← = M1)','CAMERA',['z'],14,0], ['camTurn','Camera: xoay 45° · chạm đôi = về góc đầu (D-pad → = M2)','CAMERA',['n'],15,0], ['zoomOut','Camera: thu xa (cuối thì quay về gần)','CAMERA',['-'],null,0], ['zoomIn','Camera: phóng gần','CAMERA',['='],null,0], ['rotL','Camera: xoay trái 45°','CAMERA',['['],null,0], ['rotR','Camera: xoay phải 45°','CAMERA',[']'],null,0],
  ['camAuto','Camera tự động','CAMERA',['c'],null,0], ['camReset','Đặt lại camera','CAMERA',['v'],null,0],
  ['pause','Tạm dừng','KHÁC',['escape','p'],9,0], ['keys','Bảng phím','KHÁC',['h','f1'],8,0], ['music','Bật / tắt nhạc nền','KHÁC',['m'],null,0] ];
// Z107 SQUAD COMMANDS — T: muster every soldier on the map to the tank · X: assault the nearest open fortress · B: our helicopter drops paratroopers
export const COMMAND = { musterT:14, assaultT:120, fightNear:{ muster:8, assault:16 }, para:{ cd:38, cdMobile:45, troops:[4,6], troopsMobile:[3,4], extraCap:6 } };

// Z107 FLATTER BATTLEFIELD — mostly level ground so the tank drives freely: only a handful of big rolling hills, very few old craters,
//   a whisper of surface noise, and shells dig shallower craters (blastK) — the ground no longer fills up with pits.
export const TERRAIN_FLAT = { hills:[3,5], hillR:[10,18], hillH:[2.2,3.6], craters:[1,3], noiseK:0, blastK:0, nrmK:0.55 };   // Z107 noiseK 0: no micro-bumps at all · nrmK: calmer detail normals (less sparkle while driving)   // blastK 0 = shells no longer reshape the ground (no mesh rebuilds / popping) — the scorch decal stays
// Z107 RENDER BUDGET (LOD) — what is worth drawing: only soldiers near the tank cast shadows, tower / wall riflemen out of
//   range are not drawn at all, and HP bars show once a unit is hurt (elites and commanders always). Checked 4× a second.
// Z328 FAR LOD (render/far-lod.js): big static models (fort towers / gatehouse, the HQ) swap to a simplified copy past far m (or rK × their radius if more;
//   ×mobileK on phones); keep = share of triangles kept, err = allowed deviation (share of the model's size), hys = LOD hysteresis
export const FARLOD = { on:true, far:60, rK:6, mobileK:0.7, keep:0.15, err:0.02, hys:0.1 };
// Z412 SHADOW LOD (render/far-lod.js shadowLOD): in the sun's shadow pass every opaque caster of at least `min` triangles wears a welded, position-only copy
//   simplified to `keep` of its triangles (error `err`); the scene is rescanned for casters every `rescan` shadow passes
export const SHADOWLOD = { on:true, min:1500, keep:0.25, err:0.03, rescan:90 };
// VIEW 1 (render/inst-view.js) a field-wide instanced mesh draws only what is near: minN / minTris / minSpread — which meshes are taken (instances, triangles in all, the radius
//   they are spread over, m); maxR — a thing bigger than this (a ridge, a backdrop piece) is left alone. A thing of radius r: within liteK × r m (clamped liteMin…liteMax) its own
//   geometry and shadows; past that a copy of keep of its triangles (keepCut for leaf cards; only for things of liteMinTris or more); past hideK × r m (at least hideMin) nothing —
//   unless that is beyond `never` m (a wall, a tower: never hidden). step: the soldier's metres between rebuilds; perFrame: rebuilds a frame; scan: seconds between looks for new
//   meshes; ref / maxK / kStep: the distances stretch with the camera's distance from the soldier (÷ ref, at most maxK; a change of kStep rebuilds). ?noview turns it off (to compare).
export const INSTVIEW = { on:!(typeof location !== 'undefined' && /[?&]noview\b/.test(location.search)), minN:8, minTris:40000, minSpread:30, maxR:16, dynMax:128,
  liteMinTris:900, liteK:14, liteMin:50, liteMax:140, keep:0.3, keepCut:0.5, hideK:260, hideMin:90, never:500, step:6, perFrame:2, scan:1.5, ref:30, maxK:3, kStep:0.12 };
// TROOP 1 (actors/soldiers.js updateTroopBatch) the batched infantry by distance from the soldier: past `far` m a man wears a copy of `keep` of his body's triangles; past the sun's
//   shadow box (its half-width × shadowK + shadowPad m) he casts no shadow — he was drawn into the shadow map whole wherever he stood. ?notrooplod turns it off (to compare).
export const TROOPLOD = { on:!(typeof location !== 'undefined' && /[?&]notrooplod\b/.test(location.search)), far:55, keep:0.3, shadowK:1.25, shadowPad:6 };
// Z395 NEAR DETAIL (render/near-detail.js): the originals' sharp maps (assets/models/real/hd, tools/hd-maps.mjs) put on a model while the camera is within
//   its reach — radius × rK m from its surface, at least min, at most at (each instance of an instanced mesh counts) — handed back past reach × out for hold s,
//   or when maxKeys closer models hold theirs (GPU memory) · every: how often the nearest is measured (s) · maxInst: instances measured per mesh ·
//   shapes: placed meshes drawn from their whole original at once (render/near-detail.js nearShape: camps, parked vehicles, ruins, animals, the soldier's gun) ·
//   hero: the reach (m) of the player's own ride and its driver (the chase camera sits ~6 m behind them)
//   Z411 frame: an original whose extents miss the shipped mesh's axes by more than tol (share of its longest side) is turned axis-aligned back over it
//   (render/near-detail.js sameFrame) — the turn whose surface lands most in the shipped surface's cells (grid³ of its box, samples of its vertices)
export const NEARDETAIL = { on:true, rK:3, min:5, at:30, out:1.4, hold:4, every:0.3, maxKeys:8, maxInst:4000, shapes:16, hero:12,
  trees:{ n:12, at:34, every:0.2 }, frame:{ tol:0.04, grid:16, samples:6000 } };   // trees: the n standing nearest the camera within at m drawn whole from the original (world/real-trees.js), re-picked every s
export const LOD = { shadowR: 26, guardR: 70, every: 0.25,
  detailR: 3, detailPx: 1.6, detailHys: 1.35, rescan: 2 };   // Z240 pieces under detailR m are skipped once their on-screen size × fog transparency drops under detailPx px (back in above ×detailHys); the list is rebuilt every rescan s   // Z233 enemy tanks past tankDetailR (from the camera) drop fittings smaller than smallR
// Z107 POWER RATING — one number for how strong YOUR tank is, and what each level asks of it, on the same scale.
//   Fight ratio F = time-to-die ÷ time-to-clear-a-wave. Your side: sustained DPS (mag + reload, mastery, upgrades, armour-type
//   effectiveness vs that level's wave mix, crowd bonus for blast/pierce/chain) and effective HP (HP ÷ (1−armour), dodge from speed).
//   Level side: the real wave composition (wavePool) × HP ramp × NG+ × difficulty, and the damage it pours in (accuracy → hit
//   chance, fire chance, rate, burst, specials). 1000 = a brand-new tank (rifle, no upgrades) on campaign level 1 = "even".
// Z107 RAM ANYTHING — a ram does max(flat, frac × max HP) × impact (impact 0 at minV → 1 at fullV): flimsy things (sandbags, crates,
//   drums, tyres) go in ONE hit, sturdy ones (watchtowers, huts, objectives) take a few. Shell-proof steel / concrete / HESCO have a
//   ram-only strength (steelHp). Natural rock (boulders, ridges) stays put.
export const RAM = { minV:6, fullV:16, weakHp:120, weakK:0.3, frac:0.4, steelHp:420, cd:0.4, buffMul:1.5 };   // weak (≤120 HP): any solid ram (≥30% impact) smashes it · sturdy: 40% max HP per full ram (~3) · steel: 420 ram-HP (~3)
// Z162 CLOUD SAVE — Firebase project "steel-siege" (web config is public by design; access is guarded by Firestore rules + Auth)
export const CLOUD_CFG = {
  sdk:'https://www.gstatic.com/firebasejs/12.4.0/',
  app:{ apiKey:'AIzaSyAYPbafNmjt60TdetcJqjkfmoBNfauX6Gg', authDomain:'steel-siege.firebaseapp.com', projectId:'steel-siege', storageBucket:'steel-siege.firebasestorage.app', messagingSenderId:'1084345642980', appId:'1:1084345642980:web:4f8e62047785332f8fe1f1' },   // allowlist secret — Firebase web API key is a public identifier (shipped to every browser); data access is enforced by firestore.rules + Auth
  google:true,           // Z164 Google provider on (support email = the Firebase account); link button shows on the web build only
  pushEvery:20,          // s — at most one cloud write per this many seconds while playing
  localOnly:['perfDpr','perfAO','quality','pad','padmap','padAsk','binds','autoFs','sfxVol','sound','music','voice','ctrl','turretK','tips','introSeen','_rev','_syncedRev','_cloudUid'],
};

export const SCORE_CAP = { loopMul:0.6, minClearGap:90, migrateReach:10, migrateUntil:Date.UTC(2026,11,31), scorePerMin:9000, scoreBucket:60000, scorePerClear:25000, runBase:30000, runPerClear:40000, runMaxH:3 };   // Z163 the leaderboard (functions/score.js via catalog.json): a run's score is accepted from a refilling bucket (scorePerMin up to scoreBucket, ×loopMul per NG+ loop, +scorePerClear × level on a validated clear at most every minClearGap s), capped by the stages the run cleared (runBase + runPerClear each) and closed after runMaxH hours; a save's reach comes across (≤ migrateReach) until migrateUntil
// Z167 ROOF MACHINE GUN — a pintle MG on the turret roof, worked by the crewman in the hatch: 360° traverse, elevates onto towers, shoots ONLY infantry
//   (and the men on walls / towers), shorter reach and lighter hits than the main gun. Belt-fed: a box empties, the gunner swaps it by hand.
export const FENCE = { hp:34, ramV:9 };   // Z205 a compound's wire: HP per 3 m bay, and the closing speed (m/s) a hull needs to ram through
// Z201 the roof gun as the tank's AIR DEFENCE and anti-infantry gun: helicopters first (it reaches up and out further — rangeK — and a share of the burst
//   connects), then paratroopers still hanging under their canopies, men on the ground, tower guards, and last of all armour (rifle-calibre rounds only
//   chip it); hits harder all round (dmgK); and when the gunner is killed with nobody left on the roof a reserve man climbs up out of the hull
// Z228b BALLISTICS — every round has a real velocity curve, but still arrives where (and when) it was aimed:
//   gun rounds leave the muzzle at v0× the gun's speed and bleed speed to drag over the flight (k = decay/T);
//   rockets are kicked out slow by the booster, the motor lights and pushes them up past the gun's speed.
export const BALLISTIC = { gun:{ v0:1.5, decay:3 }, rocket:{ v0:0.3, k:6, cap:1.6 }, T:{ def:1.1, lifeK:0.5, rocket:1.0, min:0.12, max:2.5 },
  vapor:{ t:0.12, every:0.02 }, enemyMissile:{ v0:0.3, k:5, T:1.1 } };
// Z236 SMOKE RIBBONS — a tank-gun round lays one unbroken ribbon of smoke along its real path (a strip that always faces the camera, wispy
//   and torn by noise, widening, rising, drifting on the wind and curling as it fades). Per kind: w0 = width at the muzzle (m), grow = how
//   fast it spreads (m per √s), life (s), op = opacity, col = colour; step = metres between laid points. cap = ribbons alive at once.
export const SMOKE_TRAIL = { points:64, cap:36, capMobile:14, step:1.0, stepMobile:1.7, wind:[0.32,0.12], rise:0.18, curl:0.22,
  kinds:{ shell:{ w0:0.16, grow:0.5, life:2.8, op:0.68, col:0xdedcd6 }, heavy:{ w0:0.22, grow:0.66, life:3.4, op:0.76, col:0xd6d3cc },
    rail:{ w0:0.08, grow:0.26, life:3.4, op:0.68, col:0xeeeaff }, enemy:{ w0:0.16, grow:0.5, life:2.4, op:0.64, col:0x948f87 },
    frost:{ w0:0.2, grow:0.55, life:1.8, op:0.45, col:0xe6f8ff } } };
// FIRE 1–4 REAL FIRE, SMOKE AND BLASTS (fx/fire-fx.js the particle layer · fx/blasts.js the staged effects; ?oldfx = the old look):
//   max / maxMobile = the hard budget of live + scheduled particles (one instanced buffer, two draw calls: smoke under, flame over) · thin = the load
//   (share of the budget) from which the cheap kinds start to be dropped … at which all of them are · tierMobile = a phone's share of every count ·
//   atlas = the procedural sprite sheet (grid × grid cells of cell px: puffs, wisps, flame tongues, a flash, a dot, a clod) · soft = a puff fades into
//   the ground over this many m · wind = × the weather's wind, capped m/s · light = how a puff takes the sun (× its intensity), how far round it wraps,
//   the sky's share, × both at night (the game's night is exposed up: white smoke must not shine), a fire's light on smoke, × the blasts' glow on the ground by day · hot = flame brightness by day / night (above 1 it blooms) · shim = the old spawnPart smoke / fire drawn here.
//   ramps: colour over life, each stop [t 0–1, colour, opacity, glow share (1 = flame, 0 = smoke that only takes light)] — the temperature ramp.
//   kinds: ramp · cells [first, count] of the sheet · layer 0 smoke / 1 flame · drag, dragY /s · grav m/s² (+ rises) · s [start, end] × the size given ·
//   grow = how early it reaches its full size · thin = it fades by thinning as it swells (opacity ∝ size^−thin) · cool = its rim is this much further
//   along the ramp than its heart · sit = held this share of its size above the ground · turb m · wind share · hot × · stretch along its flight ·
//   spin rad/s · up = kept upright (a flame) · prio 0 dropped first under load … 2 never.
export const FIREFX = { on:true, max:2600, maxMobile:900, thin:[0.6, 0.92], tierMobile:0.5, atlas:{ grid:4, cell:128, cellMobile:64 }, soft:0.6, lights:4,
  wind:{ k:1, max:3.2 }, light:{ sun:0.3, wrap:0.3, amb:0.42, night:0.5, fire:0.35, glowDay:0.45 }, hot:{ day:1.15, night:1.5 }, shim:{ smoke:true, fire:true, op:1.25 },
  ramps:{
    flash:[[0, 0xffffff, 1, 1], [0.4, 0xfff0c0, 1, 1], [1, 0xffa840, 0, 1]],
    heat:[[0, 0xfff6d8, 1, 1], [0.07, 0xffd060, 1, 0.9], [0.16, 0xff8a1e, 1, 0.8], [0.26, 0xe0500c, 0.95, 0.5], [0.36, 0x7a2408, 0.92, 0.2], [0.48, 0x241812, 0.9, 0.03], [0.7, 0x241a14, 0.75, 0], [1, 0x4a443e, 0, 0]],   // a HEAT burst: white-yellow → orange → deep red → black-brown smoke by a third of its life
    fuel:[[0, 0xfff2c0, 1, 0.9], [0.12, 0xffb030, 1, 0.75], [0.35, 0xff7a14, 1, 0.62], [0.55, 0xd0480c, 0.95, 0.45], [0.7, 0x6a2008, 0.92, 0.18], [0.82, 0x1a120c, 0.85, 0.03], [0.92, 0x14100c, 0.7, 0], [1, 0x1c1814, 0, 0]],   // burning fuel: it stays alight, rolls, soots over
    flame:[[0, 0xfff4cc, 0.9, 1], [0.25, 0xffc040, 1, 1], [0.55, 0xff7a14, 0.9, 1], [0.8, 0xc02c08, 0.6, 0.9], [1, 0x400c04, 0, 0.6]],
    jet:[[0, 0xfffbe0, 0.9, 0.9], [0.15, 0xffd65a, 1, 0.7], [0.45, 0xff9320, 1, 0.6], [0.68, 0xe25a0c, 0.95, 0.42], [0.84, 0x55180a, 0.8, 0.1], [1, 0x14100d, 0, 0]],
    motor:[[0, 0xffffff, 1, 1], [0.5, 0xfff0a8, 1, 1], [1, 0xffa030, 0, 1]], spark:[[0, 0xfff8dc, 1, 1], [0.4, 0xffc050, 1, 1], [1, 0xd03a08, 0, 1]], ember:[[0, 0xffc860, 1, 1], [0.5, 0xff7018, 1, 1], [1, 0x7a1604, 0, 1]],
    solid:[[0, 0xffffff, 1, 0], [0.8, 0xffffff, 1, 0], [1, 0xffffff, 0, 0]], dirt:[[0, 0xffffff, 0.95, 0], [0.6, 0xffffff, 0.85, 0], [1, 0xffffff, 0, 0]], dust:[[0, 0xffffff, 0, 0], [0.08, 0xffffff, 1, 0], [0.45, 0xffffff, 0.75, 0], [1, 0xffffff, 0, 0]],
    blast:[[0, 0x1c1612, 0, 0], [0.07, 0x1c1612, 1, 0], [0.35, 0x38302a, 0.92, 0], [0.7, 0x6a635b, 0.7, 0], [1, 0x8f8981, 0, 0]],   // an explosive's smoke: black-brown, greying as it cools
    black:[[0, 0x0c0a08, 0, 0], [0.06, 0x0c0a08, 1, 0], [0.5, 0x191512, 0.95, 0], [0.8, 0x2e2a27, 0.7, 0], [1, 0x45413d, 0, 0]],        // fuel / rubber: black and thick
    grey:[[0, 0x5a5248, 0, 0], [0.07, 0x5a5248, 1, 0], [0.4, 0x7d766c, 0.85, 0], [1, 0xa9a39a, 0, 0]],                                    // high explosive with nothing burning: grey-brown
    trail:[[0, 0xf4f1ea, 0, 0], [0.03, 0xf4f1ea, 1, 0], [0.3, 0xe2ded6, 0.9, 0], [1, 0xc9c6bf, 0, 0]], wisp:[[0, 0xd8d5ce, 0, 0], [0.15, 0xd8d5ce, 1, 0], [0.6, 0xcfccc5, 0.7, 0], [1, 0xc4c1ba, 0, 0]],
    smoke:[[0, 0xffffff, 0.15, 0], [0.14, 0xffffff, 1, 0], [0.38, 0xffffff, 1, 0], [1, 0xffffff, 0, 0]] },
  kinds:{
    flash:{ ramp:'flash', cells:[13, 1], layer:1, s:[0.6, 1.25], grow:0.5, hot:1.7, prio:2 }, glow:{ ramp:'flash', cells:[14, 1], layer:1, s:[0.8, 1.3], hot:0.8, op:0.7, prio:2 },
    heat:{ ramp:'heat', cells:[0, 7], layer:1, drag:3.4, dragY:2.4, grav:3, s:[0.45, 1], grow:2.6, thin:0.4, cool:0.42, sit:0.3, turb:0.35, wind:0.5, hot:1.2, spin:0.9, prio:2 },
    fuel:{ ramp:'fuel', cells:[0, 7], layer:1, drag:1.8, dragY:1.1, grav:3.2, s:[0.4, 1], grow:2, thin:0.35, cool:0.5, sit:0.3, turb:0.8, wind:0.6, hot:0.85, spin:1.2, prio:2 },
    lick:{ ramp:'flame', cells:[9, 4], layer:1, drag:1.2, dragY:0.6, grav:2, s:[0.75, 1.15], grow:1.2, cool:0.35, sit:0.42, turb:0.2, wind:0.5, up:1, prio:1 },
    jet:{ ramp:'jet', cells:[0, 7], layer:1, drag:1.7, dragY:0, grav:2.5, s:[0.22, 1], grow:1.6, thin:0.3, cool:0.4, sit:0.2, turb:0.45, wind:0.2, hot:0.8, stretch:0.035, prio:2 },
    motor:{ ramp:'motor', cells:[14, 1], layer:1, drag:5, dragY:5, s:[1, 0.5], hot:2.2, stretch:0.05, prio:2 },
    spark:{ ramp:'spark', cells:[14, 1], layer:1, drag:1.4, dragY:1.4, grav:-14, s:[1, 0.55], hot:2, stretch:0.07, prio:1 },
    frag:{ ramp:'ember', cells:[14, 1], layer:1, drag:0.35, dragY:0.35, grav:-15, s:[1, 0.6], hot:1.8, stretch:0.03, prio:1 },
    ember:{ ramp:'ember', cells:[14, 1], layer:1, drag:0.8, dragY:0.8, grav:0.9, s:[1, 0.5], hot:1.5, turb:0.9, wind:1, prio:0 },
    clod:{ ramp:'solid', cells:[15, 1], layer:0, drag:0.5, dragY:0.5, grav:-19, s:[1, 1], stretch:0.02, prio:0 },
    dirt:{ ramp:'dirt', cells:[0, 7], layer:0, drag:1, dragY:0.9, grav:-10, s:[0.5, 1], grow:1.6, thin:0.55, sit:0.3, turb:0.2, wind:0.4, op:0.95, spin:0.8, prio:2 },
    ring:{ ramp:'dust', cells:[0, 9], layer:0, drag:3, dragY:2, grav:0.2, s:[0.4, 1], grow:1.8, thin:0.8, sit:0.34, turb:0.3, wind:0.6, op:0.6, spin:0.5, prio:1 },
    dust:{ ramp:'dust', cells:[0, 9], layer:0, drag:1.6, dragY:1.2, grav:0.15, s:[0.45, 1], grow:1.5, thin:0.9, sit:0.36, turb:0.5, wind:1, op:0.5, spin:0.5, prio:1 },
    column:{ ramp:'blast', cells:[0, 7], layer:0, drag:0.7, dragY:0.45, grav:0.5, s:[0.35, 1], grow:1.5, thin:0.85, sit:0.35, turb:0.7, wind:1, op:0.85, spin:0.6, prio:1 },
    black:{ ramp:'black', cells:[0, 7], layer:0, drag:0.7, dragY:0.45, grav:0.6, s:[0.35, 1], grow:1.5, thin:0.7, sit:0.35, turb:0.8, wind:1, op:0.92, spin:0.6, prio:1 },
    grey:{ ramp:'grey', cells:[0, 7], layer:0, drag:0.8, dragY:0.5, grav:0.35, s:[0.4, 1], grow:1.5, thin:0.9, sit:0.35, turb:0.6, wind:1, op:0.7, spin:0.5, prio:1 },
    wisp:{ ramp:'wisp', cells:[0, 9], layer:0, drag:1, dragY:0.6, grav:0.25, s:[0.4, 1], grow:1.2, thin:1.1, sit:0.3, turb:0.5, wind:1, op:0.35, spin:0.4, prio:0 },
    trail:{ ramp:'trail', cells:[0, 7], layer:0, drag:0.9, dragY:0.9, grav:0.12, s:[0.32, 1], grow:1.3, thin:1, sit:0.3, turb:0.22, wind:1, op:0.66, spin:0.4, prio:1 },
    back:{ ramp:'trail', cells:[0, 9], layer:0, drag:4.6, dragY:3, grav:0.5, s:[0.25, 1], grow:2.2, thin:1, sit:0.3, turb:0.4, wind:0.8, op:0.6, spin:0.6, prio:2 },
    shimSmoke:{ ramp:'smoke', cells:[0, 7], layer:0, s:[1, 1], grow:1, thin:0.3, sit:0.42, turb:0.2, wind:0.4, spin:0.4, prio:1 },
    shimFire:{ ramp:'flame', cells:[0, 7], layer:1, s:[1, 1], grow:1, cool:0.35, sit:0.42, spin:0.6, prio:1 } },
  // the staged effects (times in s from the burst; born [from, to] = when the particles of a stage appear; counts are a desktop's, at charge scale 1)
  heat:{ flash:0.07, ball:{ n:9, life:[0.5, 0.8], size:2.7 }, ring:{ n:16, sp:[9, 14], life:[0.9, 1.4] }, sparks:{ n:18, sp:[12, 28], life:[0.25, 0.5] }, frags:{ n:5, sp:[5, 11], up:[6, 11], life:1.3, puffs:7 },
    dirt:{ n:6, clods:10 }, column:{ n:16, born:[0.1, 2.2], rise:[2.4, 4.2], life:[4.5, 7], size:4.2 }, wisps:{ n:8, born:[2.2, 10], life:[2.5, 3.6] }, embers:{ n:12, born:[0.3, 5] }, light:[3.2, 16, 0.4], shake:0.7 },   // the B41's shaped charge
  he:{ flash:0.06, core:{ n:3, life:[0.28, 0.4], size:1.6 }, dirt:{ n:10, up:[8, 15], life:[1.2, 1.8] }, clods:14, ring:{ n:14, sp:[8, 13], life:[0.9, 1.4] }, hang:{ n:6, born:[0.1, 0.5], life:[3, 5] }, smoke:{ n:6, born:[0.1, 1.2], life:[2.6, 4.2] },
    sparks:8, wisps:{ n:5, born:[2, 7], life:[2.4, 3.4] }, light:[2.2, 12, 0.25], shake:0.7 },   // a grenade, a mortar shell, a bomb: earth first
  fuel:{ flash:0.09, ball:{ n:12, life:[1, 1.6], size:3 }, stem:{ n:6, born:[0.08, 0.45] }, smoke:{ n:10, born:[0.45, 2.6], life:[4, 7], size:5.5 }, patches:[2, 4], embers:10, light:[4, 22, 1.3], shake:0.5 },   // fuel going up: the rolling fireball, the black mushroom
  patch:{ lick:4, smoke:1.2, ember:0.8, life:[6, 10], max:8, gap:2.2, light:[0.9, 6] },   // burning ground: flame licks / smoke puffs / embers a second, how long, how many at once, how far apart
  rpg:{ back:{ n:12, sp:[9, 22], cone:0.28, life:[0.9, 1.6], size:2.3 }, dust:6, ign:0.11, step:0.3, stepMobile:0.7, helix:[0.07, 1.9, 0.5], trail:{ life:[3, 4.5], size:1.1 } },   // the launch's back-blast · the sustainer lights ign s out · a puff every step m on a corkscrew [radius m, rad / m, opening m/s]
  jet:{ n:4, life:[0.36, 0.6], spread:0.2, size:[1.4, 2.2], smoke:0.5, ember:0.25, patchEvery:0.3, light:[1.6, 13] },   // the flamethrower, per trigger tick
  feel:{ near:22, flash:0.16, flashMax:0.3, instant:12, sound:343, shakeMax:3 } };   // shake and the exposure kick fall off with distance (÷ (1 + (d / near)²)); past instant m the shake arrives with the blast wave
// Z230 GUN STATS — one model of what a gun really does in a fight (combat/gunstats.js), used by the arsenal, the shop and the power rating:
//   engage = typical fighting distance (fraction of reach, capped) · W = target width (tank / man) · rho = enemies per m² around an impact
//   (a loose battle line) · hitsCap = most targets one trigger pull is credited with · ref = the targets time-to-kill is quoted against
// Z350–Z353 THE SOLDIER'S CAREER (soldier mode only — game/soldier-rank.js, actors/squad-mates.js, loot/soldier-arms.js, campaign/general-duel.js):
//   xp.kill = experience per kill by enemy type (_inf / _air / _veh = any other man / aircraft / vehicle; boss = the general's machine), eliteK × for an elite;
//   step = [a, b, c]: XP from rank n-1 to n is a + b·(n-1) + c·(n-1)²; ranks = Binh nhì … Đại tá (past the last one every step pays a medal = one more perk);
//   rankUp: max health + per rank, share of max health given back; gift = Z367 each rank's gift crate lands this far (m) ahead of him (no cards mid-battle: walking over it
//   gives one reward picked for him); perk: share of picks that offer a call for help, the +1 life card's chance;
//   milestone = what a rank brings by itself (at / mg = a man for the squad, supply = a drop by the HQ, para = a stick of paratroopers, barrage = a strike);
//   squad: who he starts with, the names they go by, health / damage × per rank and per LEADER level, the most men, medic (heal reach m, cooldown s, health, + per rank,
//   the player's health share below which he is treated, a mate's); star: a gun picked up again climbs a star (max) — damage and rate of fire per star;
//   drop: chance a dead enemy leaves his weapon (by type, _veh any vehicle), share of a soldier's loot that is a medal / an ammo crate, a medal's XP;
//   general: when his machine burns he jumps out and fights on foot — health × a rifleman's, his rifle (damage, s between shots, reach, the distance he keeps,
//   speed), size ×, the most one hit takes of his health, bodyguards at the start / at callAt of his health, rage below rageAt (fire faster ×, run ×),
//   his fan of rounds (cooldown s, rounds, arc rad, damage, s of warning), his grenades (cooldown, how many, blast m, damage, s of warning, scatter m round you)
// Z369 / Z370 GIFTBOX = the rank's supply bundle (loot/gift-crate.js): size = the crate [w, h, d] (m); it comes down under a cargo parachute from drop.h m at
//   drop.v m/s, swaying drop.sway rad at drop.swayF rad/s, the canopy drop.canopy m across on lines drop.lines m long; on the ground the canopy sags and
//   slides off over chute s, lies there chuteStay s and fades; ring = the faint ring round it on the ground (m); smoke = the marker beside it (off m away, a
//   puff every s, each living life s at size, its colour); he opens it within reach m, and open s later it sinks away
export const GIFTBOX = { size:[0.56, 0.38, 0.42], reach:1.6, chute:1.4, chuteStay:6, ring:1.1, open:2.0,
  smoke:{ off:0.7, every:0.22, life:3.2, size:1.6, col:0x7fb069 }, drop:{ h:22, v:3.6, sway:0.12, swayF:1.7, canopy:1.15, lines:1.6 } };
// LOOT 1 LOOT_REAL = the real models a pick-up wears (loot/loot-real.js; packed by tools/loot-pack.mjs into dir, each standing on y = 0 at its real size
//   in metres): ground = by the drop's id (pouch: an enemy's pouch), else byCat = by its category; icon = the picture a drop shows where it differs from its
//   model (its toast, its glyph over it); buff = the HUD chip of a running buff; skill = the soldier's skill button; gift = the rank's / the HQ's air-dropped
//   crate (its lid opens on its hinge: openRot rad), the parachute over it and the smoke marker beside it (smokeY: the can's radius as it lies);
//   relic = the stone altar and the floating crystal (crystalY its base, glow the crystal's own glow, ×wake as the relic wakes); inst = one InstancedMesh a
//   model for every drop wearing it (cap each); icons = 128 px renders of the same models (transparent WebP in iconDir). ?nolootreal: the drawn ones (before /
//   after) · ?nolootinst: one mesh a drop
export const LOOT_REAL = { on:!(typeof location !== 'undefined' && /[?&]nolootreal\b/.test(location.search)), inst:!(typeof location !== 'undefined' && /[?&]nolootinst\b/.test(location.search)), cap:32,
  dir:'assets/models/real/loot/', iconDir:'assets/models/real/loot/icon/',
  keys:['ammo', 'medkit', 'toolbox', 'vest', 'nadecrate', 'radio', 'drone', 'binoculars', 'riflebox', 'medal', 'grenade', 'smoke', 'round', 'rounds', 'crate', 'chute', 'altar', 'crystal'],
  ground:{ heal:'medkit', repair:'toolbox', shield:'vest', bomb:'nadecrate', freeze:'radio', drone:'drone', range:'binoculars', gun:'riflebox', medal:'medal', ammobox:'ammo', pouch:'ammo' },
  byCat:{ ammo:'ammo', med:'medkit', tool:'toolbox', tech:'radio', bomb:'nadecrate', gun:'riflebox', gem:'medal', armor:'vest' },
  icon:{ power:'round', inf:'rounds' },
  buff:{ rapid:'ammo', power:'round', infammo:'rounds', ammoup:'ammo', range:'binoculars' },
  skill:{ grenade:'grenade', smokeHand:'smoke', medkit:'medkit', reconDrone:'drone' },
  gift:{ size:[0.82, 0.3, 0.54], openRot:-1.9, smokeY:0.032 },
  relic:{ crystalY:2.15, glow:0.9, wake:2.2 } };
export const TROOPER = {
  xp:{ kill:{ rifle:10, rpg:16, _inf:12, scout:28, carrier:40, mortar:34, heliTroop:45, _air:45, _veh:55, grunt:80, heavy:120, boss:260, general:420 }, eliteK:2 },
  step:[200, 110, 10],
  ranks:['BINH NHÌ','BINH NHẤT','HẠ SĨ','TRUNG SĨ','THƯỢNG SĨ','THIẾU ÚY','TRUNG ÚY','THƯỢNG ÚY','ĐẠI ÚY','THIẾU TÁ','TRUNG TÁ','THƯỢNG TÁ','ĐẠI TÁ'],
  rankUp:{ hp:8, heal:0.3 }, gift:{ ahead:4 }, perk:{ callShare:0.35, lifeChance:0.1 },
  milestone:{ 2:'at', 4:'supply', 5:'mg', 7:'supply', 9:'para', 12:'barrage' },
  squad:{ start:['mg','medic'], names:['Hùng','Dũng','Tuấn','Nam','Minh','Long','Sơn','Hải','Lan','Thắng','Quân','Bình'], hpK:0.12, dmgK:0.1, leadK:0.25, max:6,
    medic:{ r:12, cd:9, hp:20, perRank:2.5, below:0.72, mateBelow:0.5 } },
  star:{ max:5, dmg:0.18, rate:0.06 },
  drop:{ rifle:0.05, rpg:0.2, _veh:0.28, item:0.3, medalXp:45 },
  general:{ hpK:70, dmg:7, fireCd:0.4, range:30, keep:13, speed:4.6, scale:1.18, hitCap:0.06, guards:3, callAt:0.5, callN:4, guardHpK:4, rageAt:0.3, rageFire:0.6, rageRun:1.3,
    fan:{ cd:6.5, n:9, arc:0.75, dmg:6, tel:0.75 }, nade:{ cd:8.5, n:3, R:3.4, dmg:36, lock:1.35, scatter:4.5 } },
};
// MEDAL 1–4 REWARDS AND PROGRESSION (C8): the soldier's CAREER across battles — experience, a Vietnamese army rank, guns opened by rank, medals by play
//   style, the end-of-battle report (data/medal-rules.js the pure rules · game/medals.js the battle's ledger · ui/medals-ui.js the screens). The save:
//   PROFILE.career = { v, xp, battles, won, kills, time, best:{ longest, multi }, m:{ <medal id>:[best tier, times] }, keep:[gun ids] } (medalCareerClean).
//   ranks: the career's ladder, Binh nhì → Đại tướng. need: experience from rank r to r + 1 = need[0] + need[1]·r + need[2]·r².
//   The battle's own ladder (TROOPER, game/soldier-rank.js: the perks, the gift crates) now reads BẬC 1… — only the career wears rank names.
//   xp: what each line of the battle's ledger is worth (kills by kind, the play-style feats, a stage won / the campaign won, a medal by its tier) —
//     cap: the most one battle can earn, live or at its end. statCap: the most any one count of a ledger can reach (a sanity bound, cleaned on every read).
//   unlock: the career rank that opens each gun in the pre-battle gun strip (CHUẨN BỊ TRẬN · Kho súng). There is no shop any more (NO-TANKS 6), so nothing is
//     ever bought twice: a locked gun is still picked up on the field (enemy drops, supply crates) — the rank only opens it as the gun he carries IN. The gun a
//     save already carried in when the career began is kept open (keep).
//   longM: a long shot (m from him to the man he killed) · markT: s a hit stays his (or his mate's) for the kill to be credited · multiT: s between kills of one
//     multi-kill · rideM: m a ride must cover to count · lowHp / liveS / reset: a "near death" is health under lowHp of max, alive liveS s later (again only after
//     it was back over reset) · perS: the most kills credited to one soldier in one second (more is dropped: a sanity bound, host-side in co-op).
//   list: the medals — id, nm (name), ic (an icon of ui/icons.js or the screen's own: blade, bike), stat (the ledger's count it reads), tiers [đồng, bạc, vàng]
//     (null = no such tier: a gold-only medal), ds (the rule, the tier numbers are added by the screen).
//   toast: s a medal's toast stays, s between two, the most waiting · rankUp: s the career's rank-up card stays in battle · board: ms before the report opens
//     over an end screen, ms the XP bar takes to fill.
export const MEDALS = { on:true, v:1,
  ranks:['BINH NHÌ','BINH NHẤT','HẠ SĨ','TRUNG SĨ','THƯỢNG SĨ','THIẾU ÚY','TRUNG ÚY','THƯỢNG ÚY','ĐẠI ÚY','THIẾU TÁ','TRUNG TÁ','THƯỢNG TÁ','ĐẠI TÁ','THIẾU TƯỚNG','TRUNG TƯỚNG','THƯỢNG TƯỚNG','ĐẠI TƯỚNG'],
  need:[600, 400, 60],
  xp:{ inf:10, veh:25, air:30, elite:15, general:300, boss:400, nemesis:200, long:5, stealth:8, blade:4, nade:3, trample:3, multi:5, team:2, save:50, side:80, escape:20,
    won:150, final:500, tier:[0, 30, 70, 150], cap:6000 },
  statCap:{ kills:400, inf:400, veh:120, air:60, elite:80, long:300, longest:600, stealth:200, blade:300, nade:300, trample:200, multiBest:30, multiX:400, streak:400, streakBest:400,
    team:800, save:20, side:6, boss:4, general:4, nemesis:2, rides:40, rideM:20000, escape:20, hits:2000, dmg:100000, total:1200, t:7200 },
  unlock:{ carbine:0, t_ak:0, t_m4:0, t_mp5:0, t_shotgun:1, t_rust:1, t_lmg:2, t_gl:2, t_flamer:3, t_saw:3, t_dmr:4, t_sniper:4, t_minigun:5, t_energy:5, t_rail:6 },
  longM:45, markT:2, multiT:2.5, rideM:30, lowHp:0.15, liveS:10, reset:0.5, perS:12,
  list:[
    { id:'xathu',   nm:'XẠ THỦ',             ic:'crosshair', stat:'long',       tiers:[3, 8, 15],   ds:'Hạ địch từ 45 m trở lên' },
    { id:'matung',  nm:'MẮT ƯNG',            ic:'sniper',    stat:'longest',    tiers:[60, 90, 130], ds:'Một phát hạ địch thật xa (m)' },
    { id:'bongma',  nm:'BÓNG MA',            ic:'eyeOpen',   stat:'stealth',    tiers:[2, 5, 10],   ds:'Hạ gục mà không ai hay biết' },
    { id:'thandao', nm:'THẦN ĐAO',           ic:'blade',     stat:'blade',      tiers:[5, 12, 25],  ds:'Hạ địch bằng đao hoặc dao găm' },
    { id:'mualuu',  nm:'MƯA LỰU ĐẠN',        ic:'bomb',      stat:'nade',       tiers:[4, 10, 20],  ds:'Hạ địch bằng lựu đạn, M79' },
    { id:'dasat',   nm:'ĐA SÁT',             ic:'burst',     stat:'multiBest',  tiers:[3, 5, 8],    ds:'Hạ liền nhiều địch, mỗi tên cách nhau dưới 2,5 giây' },
    { id:'khongxx', nm:'KHÔNG VẾT XƯỚC',     ic:'shield',    stat:'streakBest', tiers:[10, 25, 50], ds:'Hạ liền bấy nhiêu địch mà không trúng một viên' },
    { id:'cuutinh', nm:'CỨU TINH',           ic:'heart',     stat:'save',       tiers:[1, 2, 4],    ds:'Đỡ đồng đội đứng dậy, phá trại giải cứu tù binh' },
    { id:'phathanh',nm:'PHÁ THÀNH',          ic:'bunker',    stat:'boss',       tiers:[1, 2, 3],    ds:'Hạ trùm giữ thành' },
    { id:'hatuong', nm:'HẠ TƯỚNG',           ic:'star',      stat:'general',    tiers:[1, 2, 3],    ds:'Hạ tướng địch' },
    { id:'kethu',   nm:'KẺ THÙ TRUYỀN KIẾP', ic:'alert',     stat:'nemesis',    tiers:[null, null, 1], ds:'Hạ viên tướng từng thoát khỏi tay anh' },
    { id:'bactai',  nm:'BÁC TÀI THÂN THIẾT', ic:'bike',      stat:'rides',      tiers:[2, 4, 8],    ds:'Những chuyến xe ôm trên 30 m' },
    { id:'xungphong',nm:'XUNG PHONG',        ic:'dash',      stat:'trample',    tiers:[3, 8, 15],   ds:'Lao ngựa, lao xe húc ngã địch' },
    { id:'chienbinh',nm:'CHIẾN BINH',        ic:'rifle',     stat:'kills',      tiers:[25, 60, 120],ds:'Địch do chính tay anh hạ' },
    { id:'dietxe',  nm:'DIỆT XE',            ic:'shell',     stat:'veh',        tiers:[2, 5, 10],   ds:'Xe địch bị anh phá huỷ' },
    { id:'phongkhong',nm:'PHÒNG KHÔNG',      ic:'flak',      stat:'air',        tiers:[1, 3, 6],    ds:'Trực thăng, máy bay địch bị anh bắn rơi' },
    { id:'tinhnhue',nm:'SĂN TINH NHUỆ',      ic:'target',    stat:'elite',      tiers:[2, 5, 10],   ds:'Lính tinh nhuệ bị anh hạ' },
    { id:'chihuy',  nm:'CHỈ HUY',            ic:'team',      stat:'team',       tiers:[10, 25, 50], ds:'Địch do tổ của anh, đồng đội, pháo kích hạ' },
    { id:'thoatchet',nm:'THOÁT CHẾT',        ic:'hourglass', stat:'escape',     tiers:[1, 2, 4],    ds:'Còn dưới 15% máu mà vẫn sống thêm 10 giây' },
    { id:'dacnhiem',nm:'ĐẶC NHIỆM',          ic:'pack',      stat:'side',       tiers:[1, 2, 3],    ds:'Nhiệm vụ phụ hoàn thành' },
  ],
  toast:{ hold:3.4, gap:0.45, max:5 }, rankUp:{ hold:3.8 }, board:{ delay:900, fill:1600 },
};
// NEMESIS 1–3 THE ENEMY GENERAL REMEMBERS YOU (campaign/nemesis.js + the pure rules in data/nemesis-mem.js; the save: PROFILE.nemesis = { v, g:{ <general id>:
//   { met, kills, fled, falls, out, loop, rank, how, gun, scar, traits, last } } }, cleaned by nemClean whenever it is read from a save or the cloud — it syncs).
//   cap: the most a record counts (meetings, times he killed the player, escapes), his rank, the kill marks drawn beside his name, the traits he keeps.
//   escape: when the duel would kill him he gets away instead with `chance` — once a general a campaign loop, never on the last stage, never on the `never`
//     difficulty, never in a custom battle: he keeps hpLeft of his health, runs at × run for the field's edge behind him (of three bearings `fan` rad apart the
//     one farthest from the player) under `smokes` canisters, a puff every `puff` s; he is gone at the edge, out of the frame after leaveMin s, or after leaveMax s
//     — and when a wall holds him up for `stuck` s he pops one more canister at his feet and is gone inside it `vanish` s later (the same at leaveMax);
//     the stage is called won winDelay s later (he is still running); loot: he drops his guns and the medal as he goes, and xpK of a general's experience.
//   rank: + perFled each escape (back to 0 when he falls). Per rank: health + hp, his fan's and grenades' cooldowns × cd, the rests between his bursts × rest,
//     his group × spread (AWARE.fire's own per-man knobs), the fan's warning × tel (never under telMin s).
//   how: what the player did to him when he went down — a blast, else a shot from splitR m or further (far) or nearer (close) — gives the scar he carries and
//     the ONE thing he changes next time (adapt): mobile = he never stands (his distance swings by swing m every `every` s, no cover, × speed) and his guards
//     come out × spread wider, each stagger m further back · rush = he closes to keep m (× speed) behind a smoke canister thrown `ahead` m toward the player
//     whenever he is over smokeD m off (smokeCd s apart) · wall = n close-quarter guards hold a post `front` m in front of him, `wide` m apart: a blast of
//     burst rounds gap s apart out to range m, rest s between blasts, a group × spreadK, each round × dmgK, health × hpK.
//   scar: rig = the dressing is hung on his rig (actors/real-troops.js kitAttach: the anchor `at`, off, a ball / band of size m, a blood blot [x, y, z, size]) —
//     on TOP of a shoulder (under it the raised arm of a man aiming hides it: seen in the one test run) or flat on his back where the medic's satchel sits;
//     always: his star and his name plate in the scar's colour (star), his kit's tint (× tint), its name on the plate (vi); keep s on his body after he falls.
//   join: a general at large comes out beside the next stage's own general when that one calls his guards — health × hpK of a general's, the most one hit
//     takes (hitCap), off m from him. He leaves again if the stage's general falls first (and can be shot as he runs).
//   say: his lines (first · again · killed · fled · death · fall · escape; by[id] = his own, picked ownP of the time) and our commander's (join, withdraw, paid,
//     hint by adaptation; epi = the epilogue's first line when he got away). {nick} the player's call-sign (anon when he has none), {n} the meeting's number,
//     {k} the times he killed him, {name} the general. gap: s of radio silence one of these lines waits for (and s between two of them) — but a line that
//     has waited `wait` s cuts in once the line on the air is `cut` s old (a busy net never starves him); hold: s before it is dropped; queue: lines waiting
//     at most; maxLen with its tag. won = our commander's word when the stage is won while he ran.
export const NEMESIS = { on:true, v:1, tick:0.25,
  cap:{ met:999, kills:999, fled:99, rank:3, marks:5, traits:3 },
  escape:{ chance:0.4, never:'recruit', hpLeft:0.1, run:1.9, fan:0.6, smokes:2, puff:0.35, leaveMin:1.5, leaveMax:9, stuck:0.7, vanish:0.9, winDelay:4.2, loot:true, xpK:0.5 },
  rank:{ perFled:1, hp:0.22, cd:0.9, rest:0.88, spread:0.9, tel:0.93, telMin:0.55 },
  how:{ splitR:12, blast:{ scar:'burn', adapt:'mobile' }, far:{ scar:'shoulder', adapt:'rush' }, close:{ scar:'gash', adapt:'wall' } },
  adapt:{ mobile:{ every:2.2, swing:[-4, 5], speed:1.15, spread:2.2, stagger:4 }, rush:{ keep:6, speed:1.2, smokeD:14, smokeCd:11, ahead:6 },
    wall:{ n:2, front:5, wide:2.4, range:12, dmgK:0.8, hpK:1.4, burst:[4, 4], gap:0.035, rest:[1.5, 2.1], spreadK:3 } },
  scar:{ rig:true, keep:4, cloth:0xe9e4d6, blood:0x8a1c16,
    burn:{ vi:'SẸO BỎNG', star:'#ff7a2a', tint:[0.55, 0.5, 0.47], at:'shoulderL', off:[-0.02, -0.04, 0.04], shape:'ball', size:[0.18, 0.11, 0.2], blot:[0, 0.03, 0.05, 0.07] },
    shoulder:{ vi:'VAI NÁT', star:'#8fd0ff', tint:[0.86, 0.96, 1.15], at:'shoulderR', off:[0.02, -0.05, -0.06], shape:'ball', size:[0.18, 0.11, 0.2], blot:[0, 0.03, 0.05, 0.07] },
    gash:{ vi:'SẸO LƯNG', star:'#ff5a7a', tint:[1.2, 0.82, 0.8], at:'back', off:[0, -0.1, 0.05], shape:'band', size:[0.3, 0.2, 0.07], blot:[0.04, 0, -0.035, 0.09] } },
  join:{ hpK:0.45, hitCap:0.12, off:6 },
  say:{ gap:5, wait:8, cut:2.2, hold:45, queue:6, ownP:0.5, maxLen:90, anon:'thằng lính',
    first:['{nick}? Tên lạ. Sau hôm nay sẽ chẳng ai gọi nữa.', 'Ra là mày, {nick}. Lính quèn mà dám gõ cửa thành ta.', '{nick}… Ta sẽ nhớ tên này, để khắc lên báng súng.',
      'Sóng bên mày réo tên {nick} cả ngày. Giờ ta xem mặt.', 'Lại đây, {nick}. Cận vệ của ta đang đói.'],
    again:['Lại là mày, {nick}. Lần thứ {n} rồi đấy.', '{nick}! {n} lần chạm mặt. Lần này là lần chót.', 'Ta đếm rồi, {nick}: lần thứ {n}. Mày dai thật.',
      'Lần thứ {n}, {nick}. Lối đánh của mày ta thuộc rồi.', 'Lần thứ {n}, {nick}. Hôm nay một trong hai nằm lại.'],
    killed:['Lần trước ta bắn mày gục rồi mà, {nick}. Muốn nằm nữa à?', '{nick}, mày chết dưới tay ta {k} lần. Thêm một vạch nhé.', 'Ta còn giữ vỏ đạn hôm hạ mày, {nick}. Hôm nay thêm cái nữa.',
      'Báng súng ta có {k} vạch tên {nick}. Còn chỗ khắc tiếp.', 'Chết rồi còn quay lại, {nick}? Ta tiễn thêm lần nữa.'],
    fled:['Vết sẹo mày tặng vẫn còn ngứa, {nick}. Ta về để gãi đây.', '{nick}! Hôm đó mày để ta thoát. Sai lầm lớn nhất đời mày.', 'Nhìn kỹ vết này đi, {nick}. Tay mày làm đấy. Giờ ta trả.',
      'Ta bò ra khỏi khói với một lời thề, {nick}: mày phải chết.', 'Đêm nào vết thương cũng nhắc tên {nick}. Hôm nay cho nó im.'],
    death:['Nằm xuống đi, {nick}. Thêm một vạch trên báng súng ta.', 'Thế thôi à, {nick}? Ta tưởng mày khá hơn.', 'Nhắn về sở chỉ huy: gửi đứa khác. {nick} hỏng rồi.',
      '{nick} gục rồi. Kéo nó ra cổng cho quân nó nhìn.', 'Vạch thứ {k}, {nick}. Mày chết quen tay ta rồi đấy.'],
    fall:['Khá lắm… {nick}… Tên mày… ta mang theo…', '{nick}… Rốt cuộc… vẫn là mày…', 'Ta thua… một thằng lính tên {nick}… Nực cười…',
      'Bắn đẹp đấy… {nick}… Đừng để kẻ khác… lấy đầu mày…', '{n} lần… rồi cũng tới lúc này… Đi đi, {nick}…'],
    escape:['Chưa xong đâu, {nick}! Nhớ mặt ta. Ta sẽ quay lại!', 'Khói! Cận vệ, chặn nó! {nick}, hẹn mày ở thành sau!', 'Mày chỉ thắng trận này thôi, {nick}. Ta còn sống là còn nợ!',
      'Ta nhớ tên mày rồi, {nick}. Giữ mạng mà chờ ta!'],
    by:{
      bull:{ first:['Ta chưa từng lùi một bước, {nick}. Hôm nay cũng không.'], again:['Ta không lùi, {nick}. Lần thứ {n}: ta vẫn đứng đây.'], fled:['Cả đời ta lùi đúng một bước, {nick}. Vì mày. Giờ ta đòi lại.'] },
      tempest:{ first:['Gió thì không ai vây được, {nick}. Cứ thử xem.'], fled:['Mày suýt vây được ta, {nick}. Suýt thôi. Không có lần hai.'] },
      goliath:{ first:['Mười năm gác băng, {nick}. Chưa đứa nào qua nổi đèn của ta.'], fled:['Băng giữ vết thương rất lâu, {nick}. Ta cũng nhớ rất lâu.'] },
      reaper:{ first:['Ta chỉ bắn một phát, {nick}. Nhà mày sẽ nhận được ảnh.'], killed:['Ảnh mày ta gửi về rồi, {nick}. Chụp thêm tấm nữa nhé.'], fled:['Lần đầu ta cần phát thứ hai, {nick}. Mày nên tự hào.'] },
      overlord:{ first:['Học trò ta gửi mày tới à, {nick}? Nó vẫn không dám tự đến.'], killed:['Bài lần trước chưa thuộc sao, {nick}? Ta giảng lại.'] },
      inferno:{ first:['Anh ta không giữ nổi thứ gì, {nick}. Ta thì đốt sạch.'], fled:['Lửa không chết, {nick}. Nó chỉ lùi lại để lấy gió.'] },
      serpent:{ first:['Ta chờ mày mỏi rồi mới siết, {nick}. Cứ chạy đi.'], fled:['Ta chờ được, {nick}. Chờ vết thương lành. Chờ mày mỏi.'] },
      thunder:{ first:['Bắn trước, hỏi tên sau. À, {nick} hả? Muộn rồi.'], fled:['Sét không đánh hai lần một chỗ? {nick}, ta đánh mười lần!'] } },
    join:['Cẩn thận! {name} quay lại rồi, hắn nhập bọn với tướng giữ thành!', '{name} còn sống! Hắn vừa ra khỏi hầm, và hắn đang tìm anh.', 'Tình báo đúng rồi: {name} ở trong thành này. Hắn đến để trả nợ.'],
    withdraw:['{name} lại rút rồi. Hắn còn sống thì còn tìm anh.', 'Tướng giữ thành gục, {name} chuồn mất. Món nợ vẫn còn đó.'],
    paid:['{name} gục hẳn rồi. Món nợ đã trả xong, {nick}.', 'Lần này {name} không dậy nữa. Làm tốt lắm, {nick}.'],
    won:['Thành đã hạ! Nhưng {name} thoát rồi. Hắn sẽ quay lại tìm anh, {nick}.', 'Thắng trận này, {nick}. Nhưng {name} còn sống, và hắn nhớ mặt anh.', 'Cờ đã cắm! Riêng {name} thì chuồn mất. Món nợ này để lần sau, {nick}.'],
    hint:{ mobile:['{name} khôn ra rồi: hắn không đứng yên, cận vệ tản rộng. Lựu đạn khó trúng.', 'Lần trước anh cho {name} ăn lựu đạn. Giờ hắn chạy suốt. Dùng súng mà hạ.'],
      rush:['{name} sợ bị bắn xa: hắn thả khói rồi áp sát. Giữ cự ly, có khói thì đổi chỗ.', 'Lần trước anh bắn {name} từ xa. Giờ hắn lao vào sau khói. Sẵn lựu đạn mà đón.'],
      wall:['{name} đặt hai cận vệ áp sát chắn trước mặt. Đừng lao vào, hạ chúng từ xa.', 'Lần trước anh xáp lá cà với {name}. Giờ hắn có hai tay súng gần chờ sẵn.'] },
    epi:['{name} biến mất trong khói, bỏ lại hầm chỉ huy: bản đồ, điện đài, tách trà còn ấm.', 'Thành đã hạ, nhưng {name} thoát. Trên bàn hắn còn tấm bản đồ và mẩu giấy ghi tên {nick}.',
      '{name} chạy thoát qua cửa sau, bỏ lại bản đồ và cả cận vệ. {cmd} chỉ nói: "Hắn sẽ quay lại."'],
    brief:{ met:'Hắn nhớ anh: chạm mặt {n} lần', kills:'hạ anh {k} lần', fled:'tẩu thoát {f} lần', rank:'cấp {r}', large:'Trinh sát: {name}, kẻ đã tẩu thoát, đang ẩn trong thành này.' } } };
// BOSS 1 A BOSS IN EVERY FORT (campaign/fort-boss.js, his look actors/fort-boss-look.js): every fort holds ONE boss — a heavy-armoured giant on the
//   soldier's rig — who comes out only when the fort's first force is dead (its pool spent, nobody of it left inside, the tunnels emptied); his death
//   takes the fort (the capital's is the stage's general: his death wins the stage). on = the switch (off: the old commander / duel rules); model = his
//   look ('rig': the enemy rifleman's rig scaled to h m [tier 1, 2, 3], baseH = that man's own height, armour plates bolted to his bones — one function,
//   fortBossLook, to swap for a downloaded rigged model later). hp [tier 1, 2, 3] × (1 + stageK per stage past the first) × difficulty × NG+ loop ×
//   (1 + coopK per extra player); hitCap = the most raw damage one hit can do (share of his health). ARMOUR: a hit is placed by where it came from (his
//   front within front rad: the helmet takes headShare of them while it holds, the chest plate the rest; his flanks: that shoulder's plate takes
//   sideShare; his back past back rad: the power pack) — a plate takes the whole hit off its own health (plates: share of his health) and lets armK of
//   it through; with the helmet gone headShare of the front hits are head shots × headK, the pack × packK while it holds (its blast: packBoom of his
//   health, a long stagger), the bare back × backK. stagger s: a plate gone, the pack gone, a charge into a wall. blade: while he staggers a cut takes
//   × k — and below finish of his health it is the killing blow. phase = the health shares where phase 2 and 3 start (3: enraged, the plates left
//   blown off, × rage faster). move: m/s, keep m from his man, the leash m inside his fort's wall, turn = how fast the heavy man swings round (rad/s ×),
//   stuck s without getting nearer → a new spot. fire: his own bursts (dmg a round, s between). Telegraphed moves per phase [1, 2, 3] (cd s, 0 = not
//   in that phase): sweep = the heavy gun's fan (tel s of red fan first, dur s, arc rad, n rounds a pass, pass count); nade = a clutch of grenades
//   (rings tighten lock s); charge = a straight rush (tel s of a red lane, v m/s for t s, dmg + push on contact; into a wall: a stagger). guards = men
//   called in phase 2 [by tier], their health × hpK. first = the fort's first force: its pool held to [min, max] men by tier when it wakes (× FORT.mobileMul). intro: slow-mo timeScale, hold s walking out (no hits land), step = metres between heavy footfalls.
//   BOSS 2 model 'glb' = a real rigged model (actors/fort-boss-glb.js; 'rig' = the BOSS 1 armoured rifleman rig, also while the file loads): looks = the
//   models packed by tools/boss-pack.mjs (file, h = its own height m, hipK = its hip height over the library operator's — the clips' speeds × it), pick =
//   which look a fort gets (_ = any, capital = the stage's general, lands = by battlefield; the two female bosses to come are more rows); anim = cross-fade s,
//   plate = his plates' steel; a look may carry its own hK (× the tier's height), gun / gunK, name (+ the fort chief's) and sub (the bar's line), glow (the
//   pack's cells), plateK / helm:'mask' (its own plate size; a mask over the eyes in place of the helmet) and sway (wings flapping [standing, running] rad at hz [standing, running] Hz, tail rad — the demon commander's wings and tail); walk / run above walkV / runV m/s, the library clips' own speeds (m/s on the operator), lie = s the fallen lies before he sinks; gun = the INFGUN scan
//   in his hands × gunK of its length (on his scale), plateK = the plates' size on the model; h = his height m by tier (the guards stand 1.8)
//   kinds = by tier his heavy gun (n = rounds ×, r = round size, dmgK, arcK) and his second weapon (alt: nade = hand grenades, gl = a grenade launcher's
//   wider volley gl.n rounds over gl.scatter m, rocket = a shoulder launcher, rocket.n rockets gap s apart after a tel s red glint) — every boss a modern
//   heavy operator (helmet and visor, plate carrier, heavy plates; never a sword or a robe); lands = his name and armour colour per battlefield; cue = co-op event codes (host → guest)
export const FORTBOSS = { on:true, model:'glb', h:[3.0, 3.15, 3.3], baseH:1.82,
  looks:{ titan:{ file:'assets/models/real/boss/titan-exosuit.glb', h:2.0, hipK:1.168, plate:0x8c97a6 }, revenant:{ file:'assets/models/real/boss/cyborg-revenant.glb', h:1.95, hipK:1.266, plate:0x3c3836 },
    demon:{ file:'assets/models/real/boss/demon-commander.glb', h:1.9, hipK:1.249, plate:0x5c1f28, hK:0.95, plateK:0.85, helm:'mask', gun:'mp5', gunK:1.3, name:'NỮ QUỶ', sub:'TIỂU LIÊN · GIÁP QUỶ', glow:0xff3a7a, sway:{ wing:[0.12, 0.35], hz:[1.1, 2.6], tail:0.3 } } },
  pick:{ _:'titan', capital:'revenant', lands:{ VOLCANO:'revenant', FOUNDRY:'revenant', STEELMILL:'revenant', RUINS:'revenant', CITY:'demon', SAVANNA:'demon', QUARRY:'demon', ARCTIC:'demon', TUNDRA:'demon' } },
  anim:{ fade:0.25, walkV:0.35, runV:4.2, v:{ walk:1.645, run:4.113, fireWalk:0.85 }, lie:5 }, gun:'lmg', gunK:1.15, plateK:1.35,
  hp:[4400, 5000, 5600], stageK:0.08, coopK:0.7, hitCap:0.03,
  front:0.95, back:2.25, headShare:0.25, sideShare:0.7, armK:0.2, headK:1.6, packK:1.5, backK:1.15, packBoom:0.04,
  plates:{ helmet:0.05, chest:0.10, shL:0.05, shR:0.05, pack:0.07 },
  stagger:{ plate:0.9, pack:3.0, wall:2.5 }, blade:{ finish:0.35, k:3 }, phase:[0.6, 0.3],
  move:{ speed:3.3, rage:1.35, keep:14, range:34, leash:5, turn:1.6, stuck:1.8 }, fire:{ dmg:5, fireCd:0.45, rage:0.65 },
  sweep:{ cd:[8, 9.5, 6], tel:1.0, dur:1.5, arc:1.3, n:24, dmg:8, speed:55, pass:[1, 1, 2] },
  nade:{ cd:[0, 9, 7], n:3, R:3.4, dmg:30, lock:1.4, scatter:4 },
  charge:{ cd:[0, 11, 8], tel:0.9, v:12, t:1.6, dmg:30, r:1.9, push:9, min:7, max:30 },
  first:{ min:[8, 10, 12], max:[14, 18, 22] },
  guards:{ n:[3, 4, 5], hpK:2.5 }, intro:{ slow:0.5, hold:1.6, walk:2.2 }, step:1.35,
  kinds:{ 1:{ gun:'ĐẠI LIÊN', alt:'nade', n:1, r:0.2 }, 2:{ gun:'TRỌNG LIÊN', alt:'gl', n:1.15, r:0.26, dmgK:1.2 }, 3:{ gun:'SÚNG NÒNG XOAY', alt:'rocket', n:1.6, r:0.18, dmgK:0.8, arcK:1.15 } },
  gl:{ n:5, scatter:6 }, rocket:{ n:2, tel:0.9, gap:0.45, speed:30, dmg:34, aoe:3.2 },
  lands:{ _:{ t:'THIẾT GIÁP', c:0x55584e }, DESERT:{ t:'BỌ CẠP CÁT', c:0xa88a58 }, SAVANNA:{ t:'SƯ TỬ ĐẤT', c:0x8c7046 }, ARCTIC:{ t:'GẤU TUYẾT', c:0xc4ccd2 },
    TUNDRA:{ t:'GẤU TUYẾT', c:0xc4ccd2 }, VOLCANO:{ t:'HOẢ NGỤC', c:0x35231f, glow:0xff5a1a }, FOUNDRY:{ t:'LÒ LUYỆN', c:0x463a32, glow:0xff7a22 },
    STEELMILL:{ t:'LÒ LUYỆN', c:0x463a32, glow:0xff7a22 }, QUARRY:{ t:'THẠCH QUỶ', c:0x837c70 }, CITY:{ t:'THÉP ĐÔ THỊ', c:0x50565e }, CITADEL:{ t:'THIẾT VỆ', c:0x4e4e48 },
    RUINS:{ t:'BÓNG MA', c:0x5e5e52 }, MEADOW:{ t:'HẮC MỘC', c:0x44503a }, HILLS:{ t:'HẮC MỘC', c:0x44503a }, VILLAGE:{ t:'HẮC MỘC', c:0x44503a } },
  cue:{ APPEAR:40, PLATE:41, ATK:42, TAKEN:43 } };
// Z374 SCENERY (world/scenery.js): every battlefield composed from the Meshy community scans (tools/scene-import.mjs → assets/models/real/scene) — a
//   skyline beyond the fence, one landmark the field turns on, framing pairs, groves, a rail siding, a pole line, a tank farm, rocks to fight from.
//   lod: a model is drawn whole (the near file, fetched once the camera comes within mid + near m) up to mid m, then its mid copy, past far m its far copy
//   ([m, × its radius] — the larger) · models: size (h = height or w = widest side, m), ar = its x : y : z, sink = share of its height below ground, solid =
//   what stops a tank / a man (Z433 cut: its measured footprint at body height, data/scene-solids.js — an arch's legs, its opening free · box: its footprint × k · pillars: the two ends of an arch, k of its width each · disc: a circle k × its width · r: a trunk m ·
//   null: scenery only), one = a light scan with no distance copies, env, lava = the melt's share of its width (a lava pit burns like a pool), yaw = turn so its front (+Z) faces the way it is set ·
//   biomes: what each battlefield is built from — at: far (beyond the fence at bearing a, d m out) · edge (inside it, inset m) · free (open ground; north:
//   the enemy half) · pair (either side of the piece `of`, side m across, fwd m ahead of its front) · line (n along a straight line gap m apart) · cluster
//   (n round one centre within r) · around (n round the piece `of`, r [min, max] out); s = scale range; face: core (default) · out · along · rand; Z393 solid = this beat's own collision (else the
//   model's), top = the most detail it ever draws ('l' mid / 'f' far: a small piece never fetches the whole scan)
export const SCENERY = { on:true, tone:0.55,   // Z420 tone: how far the forts' bunkers and guard towers lean to the land's tone (REALPROP.cast.tint)
  lod:{ mid:[30, 2.0], far:[90, 5], near:20, hys:0.1 }, env:0.85, clearCore:34, clearSpawn:30, gap:6, wonderR:{ _:48, VOLCANO:92 }, wonderGap:0.75, supply:{ magazine:{ k:'bunker_green', w:8.6 }, fueltank:{ h:6.7 }, depot:{ w:9.5, z:7.6 }, radar:{ k:'radar_lattice', h:24, split:0.8, lv:'d' }, yard:{ radome:'radar_dome', shelter:'mil_shelter', radartruck:'radar_truck', genset:'field_gen', dish:'sat_dish' } },
  objective:{ depot:'fuel_depot', radio:'relay_post', radar:'radar_sentinel', battery:'gun_turret', command:'bunker_door' }, bricks:{ h:3.0, slices:6, lv:'l', fill:0.72 }, city:{ pole:{ h:8.4, lv:'f' }, roof:{ tank:{ h:2.6, share:0.45, kinds:['tube', 'apartment'], back:0.22, sink:0.15 }, mast:{ h:10, share:0.35, kinds:['tower', 'apartment'], minFloors:6, back:0.1, sink:0.1 } } },   // wonderR: open ground kept round the land's wonder (m from where it stands) · wonderGap: the skyline pieces keep this far (rad) off its bearing · supply: the enemy depot's fuel tanks drawn as the steel tank scan, h = the drawn tank's height (m, before the depot's scale); radar = the station's tower as the dish scan, · objective (Z426): the campaign's targets as scans (campaign/operations.js → world/scenery.js realObjective), each as wide as the target's ring
//   h tall, split = the share of its height where the dish (which sweeps with the head) begins; yard (Z425) = the scan each of the station's drawn pieces wears (piece kind → model) · bricks: the ruined brick walls in the breached wall's stone (h, how many
//   3 m slices, which copy, fill = the least share of a slice that must be wall — the breach and the ragged ends are left out) · city: the power poles as the transformer pole scan (h, copy), roof water tanks / masts (h, share of the roofs of those kinds, set back d ×, sunk m)
  models:{
    volcano:{ one:true, h:44, ar:[2.44, 1, 2.41], sink:0.08, solid:null },
    lava_pit:{ one:true, w:24, ar:[6.08, 1, 6.34], sink:0.18, solid:null, lava:0.34 },
    lava_arch:{ one:true, h:13, ar:[1.71, 1, 0.9], sink:0.04, solid:{ cut:1 } },
    ice_peak:{ h:64, ar:[0.77, 1, 0.78], sink:0.05, solid:null },
    sea_stack:{ one:true, h:12, ar:[1.52, 1, 1.39], sink:0.06, solid:{ cut:1 } },
    rock_outcrop:{ w:24, ar:[4.88, 1, 2.68], sink:0.12, solid:{ box:0.62 } },
    // Z453 photographed cliffs and boulders (Poly Haven CC0: Namaqualand cliff 02, mountainside, coastal cliff 02, Namaqualand boulder 02, boulder 01) for the crags' flanks and the roadsides
    hill_cliff:{ w:20, ar:[2.82, 1, 0.92], sink:0.1, solid:null }, hill_crag:{ h:10, ar:[0.97, 1, 0.5], sink:0.08, solid:null }, hill_ledge:{ w:40, ar:[4.07, 1, 0.86], sink:0.1, solid:null },
    road_rocks:{ one:true, w:2.5, ar:[2.88, 1, 1.4], sink:0.05, solid:null }, road_boulder:{ h:1, ar:[1.27, 1, 1.82], sink:0.08, solid:null },
    stone_ring:{ one:true, h:8, ar:[1.71, 1, 0.51], sink:0.02, solid:{ cut:1 } },
    mtn_gate:{ w:64, ar:[2.07, 1, 1.89], sink:0.05, solid:{ cut:1 } },
    temple:{ one:true, w:26, ar:[1.77, 1, 2.47], sink:0.03, solid:{ cut:1 } },
    lion:{ w:6.2, ar:[0.68, 1, 1.17], sink:0, solid:{ box:0.92 } },
    wall_breach:{ w:22, ar:[2.64, 1, 0.17], sink:0.02, solid:{ cut:1 } },
    wt_lean:{ h:17, ar:[0.83, 1, 0.82], sink:0.02, solid:{ box:0.42 } },
    neon_tower:{ h:28, ar:[0.97, 1, 0.45], sink:0, solid:{ r:1.4 }, env:1 },
    radar_dish:{ spin:{ at:0.62, rate:0.3 }, h:25, ar:[0.61, 1, 0.55], sink:0.01, solid:{ box:0.55 } },
    tank_water:{ h:9.5, ar:[0.86, 1, 0.77], sink:0, solid:{ disc:0.46 } },
    tank_steel:{ h:11, ar:[0.97, 1, 0.97], sink:0, solid:{ disc:0.48 }, fuel:'steel' },   // Z414 fuel: shot, it goes up (FUEL_TANK.steel)
    rail_tanker:{ w:16, ar:[3.9, 1, 1.09], sink:0, solid:{ box:0.95 }, fuel:'rail' },   // Z414 (FUEL_TANK.rail)
    oil_drum:{ w:0.95, ar:[1.58, 1, 0.99], sink:0, solid:{ disc:0.5 }, fuel:true },   // Z380 a drum on its side is cover too: rounds stop at it · Z402 fuel: shot, it goes up (FUEL_DRUM)
    power_pole:{ h:11, ar:[0.49, 1, 0.21], sink:0, solid:{ r:0.35 } },
    fence_gate:{ w:5.6, ar:[1.22, 1, 0.1], sink:0, solid:{ box:1 } },
    watchtower:{ h:13, ar:[0.35, 1, 0.35], sink:0, solid:null }, wt_steel:{ one:true, h:16, ar:[0.28, 1, 0.33], sink:0, solid:null }, wt_rust:{ h:15, ar:[0.41, 1, 0.42], sink:0, solid:null },   // Z375 the real guard towers (world/tower-kinds.js mtower / wtower / wrust)
    tree_twisted:{ one:true, h:12, ar:[0.66, 1, 0.56], sink:0.02, solid:{ r:0.9 } },   // Z455 the old trees 1.3× taller, their trunks with them
    tree_ember:{ one:true, h:9, ar:[1.66, 1, 1.39], sink:0.03, solid:{ r:1.3 }, env:0.7 },
    tree_bare:{ one:true, h:15, ar:[0.6, 1, 0.43], sink:0.02, solid:{ r:0.75 } },
    tree_remnant:{ w:9, ar:[1.82, 1, 1.83], sink:0.03, solid:{ box:0.4 } },
    tree_sentinel:{ h:32, ar:[1.01, 1, 0.89], sink:0.02, solid:{ r:2.5 } },
    tree_cedar:{ h:32, ar:[0.62, 1, 0.46], sink:0.02, solid:{ r:1.5 } },
    tree_oak:{ h:24, ar:[0.97, 1, 0.97], sink:0.02, solid:{ r:1.6 } },
    tree_world:{ h:40, ar:[1.02, 1, 0.81], sink:0.02, solid:{ r:3.2 } },
    tree_pine:{ h:22, ar:[0.47, 1, 0.47], sink:0.02, solid:{ r:0.8 } },
    tree_oak_old:{ h:19, ar:[1.06, 1, 1.03], sink:0.03, solid:{ r:2.5 } }, tree_snag_tall:{ h:15, ar:[0.83, 1, 1.0], sink:0.02, solid:{ r:0.45 } }, tree_snag_lean:{ h:12, ar:[1.02, 1, 0.95], sink:0.02, solid:{ r:0.5 } },   // Z455 photographed dead trees (Sketchfab, CC BY 4.0, via Objaverse — credits in assets/models/real/scene/SOURCES.txt): a gnarled ancient oak (its colour built from the scan's own roughness: it shipped without one), a tall bare tree, a broken-limbed snag
    ice_pillar:{ one:true, h:10, ar:[1.32, 1, 1.29], sink:0, solid:null }, ice_serac:{ h:14, ar:[0.92, 1, 0.83], sink:0, solid:null }, ice_block:{ h:8, ar:[1.88, 1, 1.69], sink:0, solid:null }, ice_floe:{ one:true, h:2, ar:[2, 1, 2.05], sink:0, solid:null },   // Z462 the icebergs' ice (world/iceberg.js)
    keep_castel:{ h:26, ar:[0.99, 1, 1.0], sink:0.015, solid:{ box:0.8 } }, keep_stonehall:{ h:20, ar:[1.04, 1, 0.81], sink:0.015, solid:{ box:0.92 } }, gate_stone:{ w:14, ar:[1.01, 1, 0.69], sink:0.02, solid:{ pillars:0.32 } },   // Z457 Meshy community castles (CC0 — credits in assets/models/real/scene/SOURCES.txt): a many-towered castle, a stone keep hall, a stone gatehouse (its arch open)
    // Z420 the forts' command compounds (world/fortress.js buildCore, FORT_CMD) and the fuel depot's store (world/supply.js) — solid: null, their own blocks carry them
    hq_modular:{ one:true, w:17, ar:[1.84, 1, 1.72], sink:0.01, solid:null }, bunker_hangar:{ w:15, ar:[2.11, 1, 1.02], sink:0.02, solid:null }, bunker_store:{ w:13, ar:[1.81, 1, 1.4], sink:0.01, solid:null },
    bunker_green:{ h:7.5, ar:[0.97, 1, 0.84], sink:0.03, solid:null }, bunker_dome:{ w:12, ar:[2.6, 1, 2.6], sink:0.05, solid:{ cut:1 } }, bunker_sandbag:{ w:11, ar:[2.04, 1, 2.04], sink:0.03, solid:{ cut:1 } },
    radar_sentinel:{ spin:{ at:0.69, rate:0.9 }, h:15, ar:[0.67, 1, 0.62], sink:0.01, solid:null }, gun_turret:{ w:11, ar:[2.29, 1, 2.06], sink:0.03, solid:null }, antenna_twin:{ h:28, ar:[0.55, 1, 0.3], sink:0, solid:null },
    fuel_depot:{ w:17, ar:[1.7, 1, 1.29], sink:0.02, solid:null },
    radar_dome:{ one:true, h:15, ar:[0.37, 1, 0.37], sink:0, solid:null }, mil_shelter:{ w:6.1, ar:[1.33, 1, 0.68], sink:0.01, solid:null }, radar_truck:{ w:8.6, ar:[1.96, 1, 0.65], sink:0.01, solid:null },   // Z425 the radar yard (SCENERY.supply.yard): pieces of the base, they stop and break as its pieces do
    field_gen:{ one:true, w:3.2, ar:[2.21, 1, 1], sink:0.01, solid:null }, sat_dish:{ h:4.2, ar:[0.97, 1, 0.71], sink:0.01, solid:null },
    // Z420 the guard towers (world/tower-kinds.js gt_*): the model IS the tower; ar measured off the packed scans
    gt_sentinel:{ h:15, ar:[0.42, 1, 0.42], sink:0.01, solid:null }, gt_concrete:{ h:14, ar:[0.54, 1, 0.53], sink:0.01, solid:null }, gt_round:{ h:11, ar:[0.77, 1, 0.77], sink:0.01, solid:null },
    gt_limes:{ h:12.5, ar:[0.54, 1, 0.57], sink:0.01, solid:null }, gt_stone:{ h:14, ar:[0.40, 1, 0.65], sink:0.01, solid:null }, gt_castle:{ h:12.5, ar:[1.29, 1, 0.43], sink:0.01, solid:null },
    gt_winter:{ h:18, ar:[0.53, 1, 0.61], sink:0.01, solid:null }, gt_broken:{ h:11, ar:[0.53, 1, 0.53], sink:0.01, solid:null },
    // Z422 the set pieces of the second batch (each land composed below), the radar station's lattice tower, the city's cell tower
    radar_lattice:{ one:true, h:24, ar:[0.35, 1, 0.24], sink:0, solid:null }, cell_tower:{ h:18, ar:[0.95, 1, 0.95], sink:0.01, solid:{ box:0.55 } },
    gothic_gate:{ w:16, ar:[1.1, 1, 0.49], sink:0.02, solid:{ cut:1 } }, moss_arch:{ one:true, h:8, ar:[0.83, 1, 0.28], sink:0.02, solid:{ cut:1 } },
    stone_gate:{ w:26, ar:[1.42, 1, 0.54], sink:0.03, solid:{ cut:1 } }, ruin_overgrown:{ h:30, ar:[0.82, 1, 0.82], sink:0.03, solid:{ cut:1 } },
    sphinx_great:{ w:46, ar:[1.06, 1, 3.06], sink:0.03, solid:{ box:0.8 } }, sphinx_small:{ one:true, h:4.2, ar:[0.63, 1, 1.71], sink:0.01, solid:{ box:0.9 } },
    ice_castle:{ w:60, ar:[1.1, 1, 0.7], sink:0.04, solid:{ box:0.8 }, env:1.2 }, duga_hall:{ w:24, ar:[1.67, 1, 1.71], sink:0.01, solid:{ box:0.95 } },
    water_tower_brick:{ h:20, ar:[0.24, 1, 0.26], sink:0, solid:{ r:1.6 } }, generator:{ one:true, w:5, ar:[1.35, 1, 1.35], sink:0, solid:{ box:0.9 } },
    crane_stack:{ h:34, ar:[0.52, 1, 0.25], sink:0, solid:{ box:0.7 } }, dam_gate:{ h:22, ar:[0.59, 1, 0.72], sink:0.02, solid:{ box:0.9 } },
    culvert:{ w:9, ar:[1.86, 1, 1.48], sink:0.12, solid:{ cut:1 } }, tunnel_mouth:{ w:16, ar:[1.15, 1, 1.73], sink:0.05, solid:{ box:0.9 } },
    rock_arch:{ w:18, ar:[2.0, 1, 1.42], sink:0.05, solid:{ cut:1 } }, moss_archway:{ h:14, ar:[0.99, 1, 0.48], sink:0.03, solid:{ cut:1 } },
    belfry:{ h:16, ar:[0.28, 1, 0.32], sink:0.01, solid:{ r:2.0 } }, lava_crater:{ one:true, w:20, ar:[4.48, 1, 4.52], sink:0.1, solid:null, lava:0.3 },
    lava_rock_a:{ one:true, w:4, ar:[1.68, 1, 1.58], sink:0.08, solid:{ disc:0.45 }, env:0.7 }, lava_rock_b:{ one:true, w:4, ar:[0.96, 1, 1.02], sink:0.08, solid:{ disc:0.45 }, env:0.7 },
    lava_rock_c:{ one:true, w:6, ar:[1.61, 1, 1.03], sink:0.08, solid:{ disc:0.45 }, env:0.7 }, ember_ruin:{ one:true, w:14, ar:[2.17, 1, 1.7], sink:0.04, solid:{ cut:1 } },
    gargoyle_wall:{ one:true, w:22, ar:[2.11, 1, 0.81], sink:0.03, solid:{ box:0.8 } }, keep_fortress:{ w:34, ar:[1.44, 1, 0.81], sink:0.02, solid:{ box:0.85 } },
    citadel_tower:{ h:18, ar:[0.68, 1, 0.72], sink:0.01, solid:{ r:4.0 } }, castle_wall:{ w:20, ar:[1.65, 1, 0.36], sink:0.03, solid:{ box:1 } },
    gatehouse:{ w:26, ar:[2.35, 1, 1.21], sink:0.02, solid:{ cut:1 } }, skeleton_block:{ h:26, ar:[0.96, 1, 0.58], sink:0.02, solid:{ box:0.85 } },
    corner_store:{ h:18, ar:[0.8, 1, 0.67], sink:0.01, solid:{ box:0.9 } }, road_barrier:{ w:7, ar:[2.75, 1, 2.13], sink:0.02, solid:{ box:0.8 } },
    tire_wall:{ w:6, ar:[2.64, 1, 0.6], sink:0.02, solid:{ box:0.9 } }, rebar_wall:{ w:7, ar:[2.35, 1, 0.74], sink:0.02, solid:{ box:0.9 } },
    // Z426 the rest of the 94 (the 23 left over): city blocks, castle pieces, a lighthouse, the relay outpost and the bunker door (the campaign's targets too)
    block_white:{ w:20, ar:[1.42, 1, 1.17], sink:0.02, solid:{ box:0.9 } }, bastion_gate:{ w:14, ar:[1.25, 1, 0.67], sink:0.02, solid:{ cut:1 } }, brownstone:{ h:22, ar:[0.58, 1, 0.57], sink:0.01, solid:{ box:0.92 } },
    parapet:{ one:true, w:8, ar:[2.24, 1, 0.36], sink:0.02, solid:{ box:0.9 } }, horn_arch:{ w:22, ar:[1.23, 1, 0.9], sink:0.05, solid:{ cut:1 } }, iron_barricade:{ w:6, ar:[2.09, 1, 0.6], sink:0.02, solid:{ box:0.9 } },
    scaffold_ruin:{ h:24, ar:[0.61, 1, 0.55], sink:0.01, solid:{ cut:1 } }, lighthouse:{ h:22, ar:[0.46, 1, 0.46], sink:0.01, solid:{ disc:0.42 } }, relay_post:{ w:14, ar:[1.41, 1, 1.41], sink:0.02, solid:{ box:0.82 } },
    keep_medieval:{ h:24, ar:[0.52, 1, 0.93], sink:0.02, solid:{ box:0.85 } }, stone_block:{ one:true, w:10, ar:[2.18, 1, 1.46], sink:0.04, solid:{ box:0.95 } }, fountain_vintage:{ h:5, ar:[0.82, 1, 0.82], sink:0.02, solid:{ disc:0.45 } },
    bunker_door:{ w:10, ar:[1.38, 1, 1.34], sink:0.03, solid:{ box:0.88 } }, fountain_temple:{ w:12, ar:[1.4, 1, 0.54], sink:0.02, solid:{ box:0.6 } }, tower_mage:{ h:30, ar:[0.43, 1, 0.44], sink:0.01, solid:{ disc:0.4 } },
    wall_tall:{ one:true, w:10, ar:[1, 1, 0.23], sink:0.02, solid:{ box:0.95 } }, elevador:{ h:42, ar:[0.21, 1, 0.54], sink:0.01, solid:{ box:0.45 } },
    blast_furnace:{ h:30, ar:[1, 1, 0.41], sink:0.01, solid:{ box:0.55 } } },
  biomes:{
    // fire and black rock: two cones smoking on the skyline, craters of live melt in the field, the road in through basalt arches, trees burning from the roots
    VOLCANO:[ { k:'tree_snag_tall', at:'free', n:3, s:[0.8, 1.1], face:'rand' }, { k:'tree_snag_lean', at:'free', n:3, s:[0.8, 1.1], face:'rand' }, { k:'lava_crater', at:'free', n:3, s:[0.8, 1.2], face:'rand' }, { k:'lava_rock_a', at:'free', n:8, s:[0.7, 1.3], face:'rand' }, { k:'lava_rock_b', at:'free', n:6, s:[0.7, 1.3], face:'rand' }, { k:'lava_rock_c', at:'free', n:5, s:[0.8, 1.2], face:'rand' }, { k:'ember_ruin', at:'free', n:2, face:'rand' },
      { k:'volcano', at:'far', a:[[-2.75, -2.3], [-0.85, -0.4]], d:[30, 55], s:[0.9, 1.25] }, { k:'volcano', at:'far', a:[[2.6, 3.1], [0.05, 0.5]], d:[45, 70], s:[0.7, 0.95] },
      { k:'lava_pit', at:'free', n:2, s:[0.85, 1.15] }, { k:'lava_arch', at:'free', n:3, north:true, s:[0.9, 1.15] },
      { k:'tree_ember', at:'free', n:7, s:[0.8, 1.2], face:'rand' }, { k:'tree_twisted', at:'free', n:5, s:[0.8, 1.2], face:'rand' }, { k:'tree_bare', at:'free', n:3, s:[0.85, 1.1], face:'rand' }, { k:'horn_arch', at:'free', n:1, s:[0.9, 1.1], face:'rand' } ],
    // ice: white summits standing over the fence, a signal mast glowing blue in the snow, groves of snow-laden cedar, the bare trees frosted
    ARCTIC:[ { k:'tree_snag_tall', at:'free', n:3, s:[0.8, 1.1], face:'rand' }, { k:'ice_castle', at:'edge', a:[[-2.6, -2.0], [-1.1, -0.5]], inset:30 },
      { k:'ice_peak', at:'far', a:[[-2.8, -2.3]], d:[25, 45], s:[0.95, 1.2] }, { k:'ice_peak', at:'far', a:[[-0.85, -0.35]], d:[25, 45], s:[0.95, 1.2] }, { k:'ice_peak', at:'far', a:[[2.7, 3.1], [0.0, 0.45]], d:[40, 60], s:[0.75, 0.95] },
      { k:'cell_tower', at:'free', id:'mast', north:true }, { k:'tree_cedar', at:'cluster', id:'g1', n:3, r:12, s:[0.85, 1.1], face:'rand' }, { k:'tree_cedar', at:'cluster', id:'g2', n:3, r:12, s:[0.85, 1.1], face:'rand' },
      { k:'tree_bare', at:'free', n:5, s:[0.8, 1.15], face:'rand' }, { k:'rock_outcrop', at:'free', n:2, s:[0.8, 1] },
      { k:'ice_peak', at:'free', n:16, s:[0.034, 0.066], face:'rand', solid:{ disc:0.42 }, top:'l' }, { k:'bastion_gate', at:'free', n:1 }, { k:'bunker_door', at:'free', n:1, face:'rand' } ],   // Z393 snow-capped crags 2–4 m out on the ice (the summit scan small) in place of flora.js's cone 'ice spires'
    // sand and oil: a fuel farm of steel tanks with drums stacked round it, a siding of rail tankers, a pole line marching off, a leaning water tower, limestone kopjes
    DESERT:[ { k:'tree_snag_lean', at:'free', n:2, s:[0.7, 0.9], face:'rand' }, { k:'sphinx_great', at:'free', id:'sphinx', north:true, s:[0.95, 1.05] }, { k:'sphinx_small', at:'avenue', of:'sphinx', n:4, from:30, gap:12, side:10 }, { k:'rock_arch', at:'free', n:1, s:[0.9, 1.1] },
      { k:'tank_steel', at:'cluster', id:'farm', n:3, r:13, s:[0.9, 1.1] }, { k:'oil_drum', at:'around', of:'farm', n:5, r:[9, 17], s:[0.95, 1.05], face:'rand' },
      { k:'power_pole', at:'line', n:7, gap:24, face:'along' },
      { k:'wt_lean', at:'free', n:1 }, { k:'rock_outcrop', at:'free', n:3, s:[0.8, 1.15] }, { k:'tree_twisted', at:'free', n:4, s:[0.8, 1.1], face:'rand' }, { k:'tree_bare', at:'free', n:2, face:'rand' }, { k:'horn_arch', at:'free', n:1, s:[0.8, 1.0], face:'rand' } ],
    // the great tree of the plain with its shade, broad oaks, kopjes of weathered stone, stumps and dead wood, a farm's leaning water tower, a pole line
    SAVANNA:[ { k:'tree_snag_tall', at:'free', n:2, s:[0.9, 1.15], face:'rand' }, { k:'rock_arch', at:'free', n:2, s:[0.8, 1.05] },
      { k:'tree_world', at:'free', id:'great', n:1, s:[1, 1.1] }, { k:'tree_oak', at:'free', n:3, s:[0.85, 1.1], face:'rand' }, { k:'rock_outcrop', at:'free', n:4, s:[0.75, 1.1] },
      { k:'tree_remnant', at:'free', n:3, face:'rand' }, { k:'tree_twisted', at:'free', n:3, face:'rand' }, { k:'wt_lean', at:'free', n:1 }, { k:'power_pole', at:'line', n:5, gap:26, face:'along' }, { k:'relay_post', at:'free', n:1, north:true } ],
    // green country: oak and pine woods, the old tree on the rise, a mossy moon gate and a breached garden wall, rock stacks, the overgrown dish on the far side
    MEADOW:[ { k:'tree_oak_old', at:'free', n:2, s:[1, 1.25], face:'rand' }, { k:'belfry', at:'free', n:1 }, { k:'moss_archway', at:'free', n:1 },
      { k:'tree_world', at:'free', n:1, north:true }, { k:'tree_oak', at:'cluster', id:'w1', n:3, r:14, s:[0.85, 1.1], face:'rand' }, { k:'tree_pine', at:'cluster', id:'w2', n:4, r:12, s:[0.85, 1.15], face:'rand' },
      { k:'moss_arch', at:'free', n:1 }, { k:'gothic_gate', at:'free', n:1 }, { k:'radar_dish', at:'free', n:1, north:true }, { k:'keep_medieval', at:'free', n:1, north:true } ],
    // the ruined city of old: a temple on the far side with its two lions at the steps, breached walls, moon gates, dead giants, stumps, the dish gone to moss
    RUINS:[ { k:'tree_oak_old', at:'free', n:1, s:[1, 1.2], face:'rand' }, { k:'tree_snag_lean', at:'free', n:3, s:[0.85, 1.15], face:'rand' }, { k:'ruin_overgrown', at:'free', n:1, north:true }, { k:'skeleton_block', at:'free', n:1 }, { k:'gargoyle_wall', at:'free', n:2 }, { k:'corner_store', at:'free', n:1 },
      { k:'mtn_gate', at:'far', a:[[-2.8, -2.3], [-0.85, -0.35]], d:[8, 22], s:[1, 1.2] }, { k:'temple', at:'free', id:'temple', north:true }, { k:'lion', at:'pair', of:'temple', side:8.5, fwd:15 },
      { k:'gothic_gate', at:'free', n:4 }, { k:'moss_arch', at:'free', n:2 }, { k:'tree_sentinel', at:'free', n:2, face:'rand' }, { k:'tree_bare', at:'free', n:4, face:'rand' },
      { k:'tree_remnant', at:'free', n:4, face:'rand' }, { k:'radar_dish', at:'free', n:1 }, { k:'block_white', at:'free', n:1 }, { k:'wall_tall', at:'free', n:3, face:'rand' }, { k:'fountain_temple', at:'free', n:1 }, { k:'stone_block', at:'free', n:1, face:'rand' } ],
    // the citadel's country: a mountain with a temple gate cut in it at the fence, a marble temple with its lions, broken walls, moon gates, pines, rock stacks
    CITADEL:[ { k:'tree_oak_old', at:'free', n:1, s:[1, 1.15], face:'rand' }, { k:'keep_fortress', at:'free', id:'keep', north:true }, { k:'parapet', at:'around', of:'keep', n:2, r:[21, 26], face:'out' }, { k:'castle_wall', at:'around', of:'keep', n:2, r:[26, 32], face:'out' }, { k:'citadel_tower', at:'around', of:'keep', n:2, r:[27, 34] }, { k:'gatehouse', at:'free', n:1 },
      { k:'stone_gate', at:'edge', a:[[-2.6, -2.1], [-1.0, -0.55]], inset:18 }, { k:'temple', at:'free', id:'temple', north:true }, { k:'lion', at:'pair', of:'temple', side:8.5, fwd:15 },
      { k:'gothic_gate', at:'free', n:1 }, { k:'moss_arch', at:'free', n:1 }, { k:'tree_pine', at:'free', n:4, face:'rand' }, { k:'keep_medieval', at:'free', n:1 }, { k:'tower_mage', at:'free', n:1, north:true }, { k:'fountain_temple', at:'free', n:1 } ],
    // white stone: outcrops and stacks everywhere, the old cave temple in the quarry wall, a rail siding, a water tank, drums, the pole line
    QUARRY:[ { k:'tunnel_mouth', at:'edge', a:[[2.3, 2.9], [0.3, 0.9]], inset:12 }, { k:'culvert', at:'free', n:2 }, { k:'rock_arch', at:'free', n:2 },
      { k:'stone_gate', at:'edge', a:[[-2.7, -2.1], [-1.0, -0.45]], inset:18 }, { k:'rock_outcrop', at:'free', n:6, s:[0.8, 1.2] }, { k:'sea_stack', at:'free', n:4, s:[0.85, 1.2] },
      { k:'rail_tanker', at:'line', n:3, gap:17.5, face:'along' }, { k:'tank_water', at:'cluster', id:'yard', n:1, r:2 }, { k:'oil_drum', at:'around', of:'yard', n:8, r:[7, 13], face:'rand' },
      { k:'power_pole', at:'line', n:6, gap:24, face:'along' }, { k:'tree_twisted', at:'free', n:2, face:'rand' }, { k:'lighthouse', at:'free', n:1, north:true }, { k:'wall_tall', at:'free', n:2, face:'rand' } ],
    // the works: a tank farm, a rail siding of tankers, a signal mast, the dish, two pole lines, compound gates, drums everywhere
    FOUNDRY:[ { k:'duga_hall', at:'cluster', id:'works', n:1, r:2 }, { k:'generator', at:'around', of:'works', n:3, r:[15, 21], face:'rand' }, { k:'water_tower_brick', at:'free', n:1 }, { k:'crane_stack', at:'far', a:[[-2.4, -1.9], [-1.2, -0.7]], d:[10, 25] }, { k:'dam_gate', at:'edge', a:[[2.2, 2.9], [0.2, 0.9]], inset:14 }, { k:'culvert', at:'free', n:2 },
      { k:'tank_steel', at:'cluster', id:'farm', n:3, r:16 }, { k:'tank_water', at:'around', of:'farm', n:2, r:[16, 22] }, { k:'oil_drum', at:'around', of:'farm', n:14, r:[10, 24], face:'rand' },
      { k:'rail_tanker', at:'line', n:4, gap:17.5, face:'along' }, { k:'cell_tower', at:'free', n:1, north:true }, { k:'radar_dish', at:'free', n:1 },
      { k:'power_pole', at:'line', n:8, gap:22, face:'along' }, { k:'power_pole', at:'line', n:6, gap:22, face:'along' }, { k:'fence_gate', at:'free', n:2 },
      { k:'wt_lean', at:'free', n:1 }, { k:'tree_bare', at:'free', n:3, face:'rand' }, { k:'bastion_gate', at:'free', n:1 }, { k:'iron_barricade', at:'free', n:2, face:'rand' }, { k:'bunker_door', at:'free', n:1, face:'rand' }, { k:'blast_furnace', at:'around', of:'works', n:2, r:[26, 32], face:'rand' } ],
    // Z422 the city's outskirts: a block gone to the creepers, a gutted frame, the cell tower, the road blocks of the checkpoints
    CITY:[ { k:'ruin_overgrown', at:'free', n:1, north:true }, { k:'skeleton_block', at:'free', n:1 }, { k:'cell_tower', at:'free', n:1, north:true }, { k:'brownstone', at:'free', n:2 }, { k:'scaffold_ruin', at:'free', n:1 }, { k:'fountain_vintage', at:'free', n:1 }, { k:'elevador', at:'free', n:1, north:true }, { k:'iron_barricade', at:'free', n:2, face:'rand' } ] } };
// Z383 SKYLINE (world/scenery.js realHorizon, desktop): the horizon for real — the scanned summits, cones and crags stand between world/horizon.js's
//   ranges (the near range hides their feet: a real massif behind its foothills), forests line the near hills, and the ruined city / the works stand
//   round the field in place of the hazed boxes (skyline). Each entry: n pieces spread evenly round the circle (jittered), h = height or w = widest side
//   range (m), r = distance range past the horizon's base radius (ARENA × 1.55, m), lv = which copy (l mid · f far · d whole; the light scans have one),
//   y = foot height, hz = its own veil. haze = the veil toward the fog colour, from the nearest entries to the farthest. skyline: they stand in place of
//   the near range (and of the box skylines); rings = the kind of the ranges behind (world/horizon.js). A string = the same as that land.
export const SKYLINE = { on:true, haze:[0.24, 0.58], y:-6, stacks:10, arcs:10, keep:0.2,   // (Z440 trees at their species' true height, in the air's own haze, never simplified) Z412 arcs: the horizon's instanced rings split by bearing (the camera culls the arcs behind it) · keep: share of triangles a skyline piece keeps (simplified; 50–300 m off)
    // stacks: the works' concrete chimneys left among the real pieces
  biomes:{
    ARCTIC:{ set:[ { k:'ice_peak', n:7, h:[115, 180], r:[45, 85], y:-14, sea:1 }, { k:'tree_cedar', lv:'f', n:64, h:[14, 21], r:[-118, 40], y:-3, clump:[9, 42] }, { k:'mil_shelter', lv:'f', n:6, w:[6, 6.5], r:[-50, 20], y:-0.5, clump:[2, 22] }, { k:'sat_dish', lv:'f', n:2, h:[4, 5], r:[-50, 20], y:-0.5, clump:[2, 18] } ] }, TUNDRA:'ARCTIC',
    VOLCANO:{ skyline:true, rings:'peak', set:[ { k:'volcano', n:5, h:[78, 118], r:[0, 45], y:-16, hz:0.22 }, { k:'lava_arch', n:7, h:[30, 50], r:[-10, 22], hz:0.2 }, { k:'tree_twisted', n:24, h:[9, 14], r:[-118, 8], y:-3, clump:[6, 30] } ] },
    QUARRY:{ set:[ { k:'lighthouse', lv:'f', n:2, h:[24, 30], r:[0, 18], y:-2, hz:0.25, sea:1 }, { k:'rock_outcrop', n:9, w:[120, 210], r:[30, 70], y:-10, sea:1 }, { k:'sea_stack', n:7, h:[38, 70], r:[0, 30], hz:0.3, sea:1 }, { k:'mtn_gate', n:1, w:[170, 200], r:[45, 60], y:-10, sea:1 } ] },
    CITADEL:{ set:[ { k:'mtn_gate', n:1, w:[180, 210], r:[48, 70], y:-10 }, { k:'tower_mage', lv:'f', n:3, h:[34, 48], r:[0, 24], y:-2 }, { k:'tree_pine', lv:'f', n:56, h:[11, 17], r:[-118, 40], y:-3, clump:[8, 40] }, { k:'ruin_house', n:8, h:[10, 14], r:[-60, 20], y:-1, clump:[2, 30] } ] },
    MEADOW:{ set:[ { k:'keep_medieval', lv:'f', n:2, h:[26, 34], r:[0, 20], y:-2 }, { k:'tree_pine', lv:'f', n:60, h:[14, 21], r:[-118, 40], y:-3, clump:[9, 40] }, { k:'tree_oak', lv:'f', n:36, h:[10, 16], r:[-118, 30], y:-3, clump:[7, 34] }, { k:'tree_world', lv:'f', n:3, h:[25, 32], r:[0, 14], y:-3 },
      { k:'ruin_house', n:10, h:[10, 14], r:[-60, 20], y:-1, clump:[3, 30] }, { k:'ruin_villa', n:3, w:[14, 18], r:[-60, 20], y:-1, clump:[3, 20] },
    ] },
    SAVANNA:{ set:[ { k:'tree_world', lv:'f', n:18, h:[15, 24], r:[-118, 30], y:-3, clump:[6, 46] }, { k:'tree_oak', lv:'f', n:16, h:[9, 15], r:[-118, 30], y:-3, clump:[5, 36] }, { k:'water_tower_brick', lv:'f', n:2, h:[14, 18], r:[-60, 10], y:-1, clump:[2, 10] }, { k:'ruin_house', n:6, h:[8, 11], r:[-60, 10], y:-1, clump:[2, 26] }, { k:'rock_outcrop', n:7, w:[70, 130], r:[10, 45], y:-8 } ] },
    DESERT:{ set:[ { k:'rock_outcrop', n:8, w:[90, 170], r:[20, 60], y:-10 }, { k:'wt_lean', lv:'f', n:4, h:[28, 36], r:[-6, 8], y:-3 }, { k:'tree_twisted', n:14, h:[7, 11], r:[-118, 20], y:-3, clump:[4, 26] }, { k:'ruin_house', n:8, h:[8, 11], r:[-60, 10], y:-1, clump:[2, 30] } ] },
    RUINS:{ skyline:true, set:[ { k:'skeleton_block', lv:'f', n:14, h:[16, 26], r:[-118, -30], y:-1, clump:[6, 30] }, { k:'scaffold_ruin', lv:'f', n:6, h:[18, 26], r:[-110, -20], y:-1, clump:[3, 24] }, { k:'ruin_block', n:10, h:[34, 58], r:[0, 40] }, { k:'ruin_tower', n:8, h:[30, 48], r:[0, 40] }, { k:'ruin_chapel', n:6, h:[26, 40], r:[0, 40] },
      { k:'ruin_villa', n:6, h:[18, 28], r:[-6, 30] }, { k:'ruin_house', n:6, h:[14, 22], r:[-8, 24] }, { k:'wall_breach', lv:'f', n:10, w:[50, 80], r:[-10, 20] }, { k:'tree_sentinel', lv:'f', n:8, h:[16, 25], r:[-8, 24], y:-3 } ] },
    FOUNDRY:{ skyline:true, set:[ { k:'tank_steel', lv:'f', n:12, h:[18, 28], r:[-6, 30] }, { k:'tank_water', lv:'f', n:6, h:[16, 24], r:[-6, 30] }, { k:'wt_rust', lv:'f', n:6, h:[34, 46], r:[0, 34] },
      { k:'wt_steel', n:4, h:[36, 48], r:[0, 34] }, { k:'neon_tower', lv:'f', n:5, h:[60, 80], r:[10, 40] }, { k:'radar_dish', lv:'f', n:3, h:[40, 55], r:[10, 40] }, { k:'rail_tanker', lv:'f', n:8, w:[30, 36], r:[-8, 20] } ] },
    STEELMILL:'FOUNDRY' } };
// Z427 AIR AND DISTANCE — the world past the fence as a cinematographer would light it (render/aerial.js, world/backdrop.js, world/heightfield.js):
//   AERIAL: the haze is no longer one colour at one density everywhere. fall = how fast the air thins with height (1/m: it halves every ~0.7/fall m above
//   h0), so a camera up high looks down through clear air instead of a grey veil; keep = the share of the plain distance haze that stays whatever the
//   height, [low camera, high camera] between keepH (m); blue = 1/m over which the haze turns from the land's fog colour to the sky's horizon colour
//   (the far reads cool and melts into the sky); warm = how much sunlight the air scatters toward the eye when looking toward the sun; land = from
//   which share of the far plane on things take on the far land's tone (landK × the battlefield's ground colour as the sun and sky light it, a quarter fogged: where the near world
//   ends, the backdrop's ground carries on unseen);
//   ring = the battlefield's gold perimeter line fades out between these camera heights (m); Z440 near = the battlefield's own haze holds to this distance (m),
//   past it the air thins by ext per m (the land kilometres out stays in sight, as from a helicopter, instead of turning white past 1 km); nearUp =
//   that distance for a camera high up (between keepH); farK: up high the camera's far plane reaches farK × its height
//   (the land below it all drawn, not cut off into the backdrop); farTone = [share of the zenith blue, brightness ×] of the far haze against the sky's horizon band
export const AERIAL = { on:true, fall:1 / 55, h0:12, keep:[0.42, 0.06], keepH:[50, 260], blue:1 / 650, warm:0.32, land:[0.84, 0.985], landK:1, ring:[60, 150], farK:2.7, farTone:[0.18, 0.84], near:480, nearUp:190, ext:1 / 9000 };
// AIR 1–4 (render/air-post.js) THE PICTURE AS A CAMERA SEES IT. post: the frame's last passes (NaN guard, bloom's write-back, tone map + sRGB, grade) folded
//   into ONE full-screen pass (on:false = the old chain). ae: auto exposure — the frame's mean log brightness (a 12 × 8 grid, centre-weighted) followed
//   fast (fast s) and slow (slow s): exposure × 2^(k × (slow − fast)), held to [lo, hi] — walking into a building's shade or a smoke bank opens the
//   lens a little, back in the sun it closes, and over slow s it settles on the battlefield's own grade again. bloom: selective — what really shines
//   (saturated light: fire, flashes, tracers, lamps; or over hot × the threshold) blooms in full, bright plain surfaces (sunlit sand, snow, white
//   walls, the sky) keep only keep of it; knee = the soft threshold's width. grain: film grain strongest in the mid-tones, lo × in the shadows and
//   highlights. mist (AIR 2, render/aerial.js): a ground-hugging layer per battlefield — density k per m at the ground, falling off as exp(−y / h)
//   above base m; tint mixed into the haze colour by mix (× bright); patch = how much it gathers into drifting banks of scale m (0 = an even layer),
//   moved at drift × the cloud wind; tod = × per hour (global, then the battlefield's own). Off on phones / the low setting.
//   haze (AIR 3, render/air-post.js): heat shimmer on the far ground (near..far m), px = its sway in pixels × the battlefield's share, the sun high,
//   never at night; desktop only. motes (AIR 3, fx/dust.js): the sunlit dust's colour / brightness per battlefield (ice crystals over the Arctic).
//   aa (AIR 4, render/air-aa.js): spec = [σ², cap] of the specular anti-aliasing (roughness² + σ² × the normal's change over a pixel, ≤ cap);
//   cas = [how far the sharpening eases off, from local contrast lo .. hi, clamp to the neighbours 0/1]; motePx = the smallest dust mote in pixels.
export const AIR = { post:{ on:true }, ae:{ on:true, fast:0.7, slow:40, k:0.5, lo:0.86, hi:1.4 }, bloom:{ sel:true, sat:0.4, hot:3.5, keep:0.3, knee:0.4 },
  grain:{ shape:true, lo:0.4 },
  mist:{ on:true, drift:0.6, tod:{ day:0.8, noon:0.55, sunset:0.9, night:1 },
    ARCTIC:{ k:0.0045, h:3.2, tint:0xe4eef8, mix:0.55, bright:0.96, patch:0.7, scale:55 }, MEADOW:{ k:0.0035, h:2.2, tint:0xd8e0dc, mix:0.3, patch:0.75, scale:45, tod:{ noon:0.4, sunset:1.4 } },
    DESERT:{ k:0.0028, h:3.5, tint:0xd8b888, mix:0.45, patch:0.6, scale:70 }, SAVANNA:{ k:0.0025, h:3, tint:0xd0b080, mix:0.4, patch:0.6, scale:70 },
    CITY:{ k:0.003, h:7, tint:0xa8a49c, mix:0.35, patch:0.5, scale:80 }, RUINS:{ k:0.0032, h:4, tint:0xb0a898, mix:0.35, patch:0.6, scale:60 },
    FOUNDRY:{ k:0.0035, h:6, tint:0x9a9088, mix:0.4, patch:0.55, scale:70 }, VOLCANO:{ k:0.003, h:5, tint:0x8a7468, mix:0.45, bright:0.9, patch:0.6, scale:60 },
    CITADEL:{ k:0.0025, h:3, tint:0xd0c0a8, mix:0.35, patch:0.6, scale:60 }, QUARRY:{ k:0.003, h:3.5, tint:0xc8c0b0, mix:0.4, patch:0.6, scale:55 } },
  haze:{ on:true, px:1.6, near:45, far:150, DESERT:1, SAVANNA:0.6, VOLCANO:0.7, CITADEL:0.4 },
  motes:{ ARCTIC:{ col:0xe6f3ff, gain:1.5 }, DESERT:{ col:0xffe2b0, gain:1.1 }, VOLCANO:{ col:0xffb070, gain:1.2 } },
  aa:{ on:true, spec:[0.25, 0.18], cas:[0.75, 0.08, 0.32, 1], motePx:1.5 } };
// OUTSKIRTS: the land between the fence and the far ranges rolls instead of lying flat — hills that rise from the field's edge over ramp × ARENA, crest,
//   and sink back to the plain by fade × ARENA past the edge (so where the near world is cut off at the far plane, it is flat land like the backdrop's);
//   amp = the crests' height (m), wave = their spacing (m), dune = long wind-shaped ridges instead of round hills; seg = [round, radial] mesh resolution
export const OUTSKIRTS = { on:true, out:5, ramp:0.5, crest:1.1, fade:2.4, seg:[256, 56], phone:[128, 28],
  biomes:{ _:{ amp:20, wave:190 }, DESERT:{ amp:24, wave:240, dune:1 }, SAVANNA:{ amp:16, wave:260 }, ARCTIC:{ amp:40, wave:200 }, TUNDRA:'ARCTIC', CITY:{ amp:5, wave:320 },
    VOLCANO:{ amp:36, wave:180 }, CITADEL:{ amp:34, wave:190 }, MEADOW:{ amp:26, wave:210 }, HILLS:{ amp:34, wave:200 }, VILLAGE:{ amp:30, wave:170 }, QUARRY:{ amp:32, wave:180 },
    RUINS:{ amp:14, wave:220 }, FOUNDRY:{ amp:9, wave:260 }, STEELMILL:'FOUNDRY' } };
// Z428 LANDFORM: each battlefield stands IN a piece of real geography, which is also its border (the drawn earth bank and the rows of boulders give way):
//   form = hills (OUTSKIRTS' rolling land) · bowl (a ring of mountains or dunes rising h m over w m past the field: a valley, a caldera, a hollow in a
//   dune sea) · plateau (the field on top, a cliff dropping h m over w m: a mesa, an ice shelf, a headland, a hilltop) · flat (the field one block of an
//   endless city or works). Z464 a bowl's crest stands rise × w past the fence (0.45: a wall right behind it, the sky hidden), its foothills
//   kept low by foot (the rise's power: a valley's floor climbs gently, then steepens to the ridge). tint / rock / snow = the land's colour, its rock where it is steep, snow above snow m; ridge × FIELD.ridgeH (the bank inside
//   the field's square), rocks × the boulder rows; plain = what the backdrop's plain shows to the horizon (sea · dunes · savanna · fields · forest ·
//   lava · city · ruins · industry), its colour; roads: tracks lead away. far = the camera's least far plane (m): Z430 16 km, the whole land, the ranges and
//   the far battlefields drawn at their true depth (depth precision lives at the near plane: the far one costs nothing there); Z440 shift / plainShift = how far
//   the land past the fence / the far plain lean from the field's own ground colour toward the landform's tint / col (one palette, as from a helicopter)
export const LANDFORM = { on:true, far:16000, shift:0.3, plainShift:0.35,
  biomes:{ DESERT:{ form:'bowl', h:46, w:300, dune:1, tint:0xe39a62, rock:0xb87048, ridge:0.6, rocks:0, plain:'dunes', col:0xd88a52, roads:1 },
    SAVANNA:{ form:'plateau', h:120, w:40, tint:0xc8a060, rock:0xa4542e, ridge:0.25, rocks:0.12, plain:'savanna', col:0xa88a4c },
    ARCTIC:{ form:'plateau', h:70, w:26, tint:0xf4f8fb, rock:0x9cc2dc, ridge:0.25, rocks:0, plain:'sea', col:0x14263a, floes:1 },
    QUARRY:{ form:'plateau', h:58, w:24, tint:0xece6d8, rock:0xd4ccbe, ridge:0.25, rocks:0.2, plain:'sea', col:0x184a5e },
    CITADEL:{ form:'plateau', h:90, w:170, tint:0xa0905c, rock:0x8a7860, ridge:0.5, rocks:0.3, plain:'fields', col:0x6e7a4a },
    MEADOW:{ form:'bowl', h:260, w:360, rise:1.05, foot:1.5, tint:0x3e5a2c, rock:0x6c6a60, snow:238, ridge:1, rocks:0.4, plain:'forest', col:0x34502c },
    VOLCANO:{ form:'bowl', h:160, w:230, rise:0.9, foot:1.35, tint:0x2e2826, rock:0x1e1a18, ridge:1, rocks:0.6, plain:'lava', col:0x241c1a },
    CITY:{ form:'flat', h:3, w:300, tint:0x5c6066, rock:0x5c6066, ridge:0.2, rocks:0, plain:'city', col:0x7a7e86 },
    RUINS:{ form:'flat', h:9, w:220, tint:0x6e6a66, rock:0x5a5654, ridge:0.3, rocks:0.3, plain:'ruins', col:0x76706a },
    FOUNDRY:{ form:'flat', h:6, w:260, tint:0x6a645e, rock:0x5a524c, ridge:0.3, rocks:0.2, plain:'industry', col:0x8a837a, roads:1 } } };
// Z440 WOODS (world/forest.js): the woods on the land past the fence, of the scanned tree species (REALTREE, their 3k-triangle copies) — cover =
//   share of the land under forest (laid by a noise map of scale patch m: woods, groves, clearings), space = m between trees in a wood (crowns
//   touching), h = the trees' heights (m), kinds = shares of the species. near = m past the fence the woods reach; max = trees (thinned evenly
//   over it); gap = m clear of the fence (closer in, the skyline's scans); slope = the steepest ground a tree stands on (rise per m); treeline =
//   m under the snow line the woods give out; sectors = arcs by bearing (culled behind the camera). Desktop only
export const FOREST = { on:true, near:260, max:2600, gap:40, slope:0.95, treeline:70, sectors:12,
  biomes:{ MEADOW:{ cover:0.55, patch:240, space:9, h:[12, 18], kinds:{ oak:0.3, linden:0.3, birch:0.15, poplar:0.15, pine:0.1 } },
    CITADEL:{ cover:0.32, patch:200, space:9, h:[7, 14], kinds:{ cypress:0.4, olive:0.4, oak:0.2 } }, QUARRY:'CITADEL',
    RUINS:{ cover:0.38, patch:200, space:9, h:[10, 16], kinds:{ linden:0.4, birch:0.3, oak:0.3 } },
    SAVANNA:{ cover:0.45, patch:300, space:26, h:[6, 11], kinds:{ acacia:0.85, baobab:0.15 } },
    ARCTIC:{ cover:0.4, patch:200, space:8, h:[10, 15], kinds:{ spruce_snow:1 } },
    CITY:{ cover:0.12, patch:160, space:10, h:[9, 14], kinds:{ linden:0.6, poplar:0.4 } },
    FOUNDRY:{ cover:0.1, patch:160, space:10, h:[8, 13], kinds:{ poplar:0.5, birch:0.5 } } } };
// Z430 FAR BATTLEFIELDS (world/scenery.js farSites): the war is not only here — other fights, bases and towns stand 0.9–5 km out at their true size,
//   hazed as far as they are (haze [near, far]): a cluster of a kit's pieces (kits), on the plain, on islets in a sea (isle) or on mesas of their own
//   (mesa), some burning (smoke = share of them with a column of black smoke and fire). Desktop; the intro still looks at our field
export const FARSITES = { on:true, d:[900, 5000], haze:[0.34, 0.8], smoke:0.55, size:[4, 8], spread:[35, 90],
  kits:{ fort:['castle_wall', 'citadel_tower', 'gatehouse', 'keep_fortress', 'gt_stone'], base:['bunker_store', 'bunker_hangar', 'bunker_dome', 'mil_shelter', 'radar_dish', 'tank_steel', 'gt_concrete', 'radar_truck'],
    works:['tank_steel', 'tank_water', 'wt_rust', 'crane_stack', 'duga_hall', 'blast_furnace'], ruin:['ruin_overgrown', 'skeleton_block', 'gt_broken', 'scaffold_ruin', 'block_white'], ice:['gt_winter', 'mil_shelter', 'sat_dish', 'radar_sentinel', 'bunker_green'],
    town:['brownstone', 'corner_store', 'belfry', 'block_white', 'water_tower_brick'], city:['skeleton_block', 'neon_tower', 'cell_tower', 'elevador', 'brownstone'] },
  biomes:{ DESERT:{ n:8, kits:['base', 'ruin', 'fort'] }, SAVANNA:{ n:8, kits:['base', 'ruin', 'town'], mesa:1 }, ARCTIC:{ n:8, kits:['ice', 'base'], isle:1 }, QUARRY:{ n:8, kits:['fort', 'town', 'base'], isle:1 },
    CITADEL:{ n:9, kits:['fort', 'town', 'ruin'] }, MEADOW:{ n:9, kits:['fort', 'town', 'base'] }, VOLCANO:{ n:6, kits:['base', 'works'] }, CITY:{ n:7, kits:['city', 'ruin'] },
    RUINS:{ n:8, kits:['ruin', 'base'] }, FOUNDRY:{ n:8, kits:['works', 'base'] } } };
// BACKDROP: the ranges far away, at their true distance and height, drawn at the sky's depth (never cut by the far plane, always behind the world):
//   ground = the radius (m) of the hazy land they stand on; each layer [r m, lowest m, highest m, kind, masses round the circle, haze share] — far
//   layers taller and paler; the tallest mass of the nearest two stands where the attack looks (toward the enemy, a third off the centre line: lead,
//   rad); kinds: peak (ridged, snow over snow × height) · hill · mesa (cliffs and flat tops) · dune · volcano (cones) · karst (towers) · city · stacks;
//   phone = which layer phones keep
export const BACKDROP = { on:true, ground:14000, lead:-Math.PI / 2 + 0.42, snow:0.62, phone:1,
  biomes:{ _:[[1400, 60, 200, 'hill', 7, 0.2], [3500, 150, 460, 'hill', 5, 0.32], [8500, 600, 1500, 'peak', 4, 0.42]],
    DESERT:[[1400, 40, 120, 'dune', 9, 0.18], [3300, 90, 280, 'dune', 7, 0.3], [7800, 420, 1050, 'mesa', 5, 0.42]],
    SAVANNA:[[1600, 50, 190, 'mesa', 6, 0.2], [3800, 110, 380, 'hill', 5, 0.32], [9200, 600, 1500, 'peak', 3, 0.43]],
    ARCTIC:[[1500, 220, 620, 'peak', 8, 0.17], [3800, 520, 1300, 'peak', 6, 0.28], [9000, 1200, 2600, 'peak', 5, 0.4]], TUNDRA:'ARCTIC',
    CITADEL:[[1500, 130, 400, 'peak', 7, 0.2], [3800, 320, 900, 'peak', 6, 0.3], [9000, 900, 2200, 'peak', 5, 0.41]], QUARRY:'CITADEL',
    MEADOW:[[1400, 60, 200, 'hill', 8, 0.2], [3500, 160, 460, 'hill', 6, 0.3], [8500, 650, 1700, 'peak', 5, 0.41]], HILLS:'MEADOW',
    VILLAGE:[[1400, 120, 380, 'karst', 9, 0.2], [3400, 220, 620, 'karst', 7, 0.32], [8500, 600, 1500, 'peak', 5, 0.42]],
    VOLCANO:[[1500, 140, 420, 'volcano', 4, 0.2], [4000, 380, 1000, 'peak', 5, 0.3], [9000, 900, 2000, 'volcano', 3, 0.41]],
    RUINS:[[1300, 40, 150, 'hill', 8, 0.22], [3400, 120, 380, 'hill', 6, 0.32], [8000, 450, 1100, 'peak', 5, 0.42]],
    CITY:[[1200, 40, 170, 'city', 0, 0.2], [2900, 50, 260, 'city', 0, 0.3], [8000, 220, 640, 'hill', 5, 0.43]],
    FOUNDRY:[[1400, 40, 150, 'stacks', 0, 0.22], [3500, 110, 360, 'hill', 6, 0.32], [8500, 520, 1300, 'peak', 5, 0.42]], STEELMILL:'FOUNDRY' } };

// COOP 2 CO-OP FOR TWO OVER A LAN — the net layer's numbers (src/net/*, tools/lan-room.mjs). NOTHING reads them in a single-player game: the layer only
//   wakes when the address has ?room=CODE. The host's page runs the battle and sends world snapshots; the guest sends his own soldier's state.
//   proto = the wire version (both pages must match — bump it with any change to net/protocol.js's layouts)
//   snapHz / inputHz = host → guest snapshots a second · guest → host states a second
//   interp: delayMs = how far in the past the guest draws the world (two snapshots: one may be lost and the motion stays smooth) · inputDelayMs = the
//     same for the guest's soldier on the host · extrapMs = at most this long a thing keeps its last velocity when snapshots stop · keep = snapshots held ·
//     teleportM = a jump longer than this between two snapshots is not walked (respawn, mount) · driftMs = how much the clock offset may sink a snapshot,
//     offsetUp = the share of a higher reading it takes at once
//   quant: pos = steps a metre (100 = centimetres; int16 → ±327 m, the field is ±184) · head / aim = steps a turn (entity heading a byte, a player's 16 bit)
//   limits: entities / events a snapshot · eventQueue = unacknowledged events kept for resending · ctlBytes = a lobby (JSON) message · battleKeys = fields
//     of the battle settings agreed in the lobby
//   delta: history = snapshots each side remembers as delta bases · maxBack = older than this many snapshots → a full one
//   link (net/transport.js): pingMs / deadMs = the relay is pinged, silence this long = dead → reconnect · queueMax = lobby messages kept while closed ·
//     retry* = reconnect back-off (base × k^n up to max, ± jitter), retries = then give up
//   session (net/coop.js): tickMs = housekeeping step · pingMs = peer round-trip · helloMs = no hello from the peer → say so again · peerLostMs = a battle
//     waits this long for a dropped peer before it ends
//   ids: the two players' ids in a snapshot; battle entities start at firstEntity (ids are 1–65535, never reused within a battle)
// COOP 4–7 THE GAME'S SIDE OF IT (game/coop-glue.js, coop-remote.js, coop-puppets.js, ui/coop-lobby.js, net/rules.js):
//   puppets: true = on the GUEST the enemy is drawn from the host's snapshots and his own enemy AI / waves / director do not run (false = each page fights its own
//     enemy: the two only see each other) · sayMax = letters of a radio line the host passes on
//   cue: the codes of a CUE event (p): at the gate of a stage · go · stage won (a = the next stage, b = 1 the campaign) · lost · score (a low, b high 16 bits) ·
//     wave (a) · director's phase (a) · stood up again · down (the host's word to the guest)
//   lobby: levelMax = stages the host may start at · tod / wx = the hours and weathers on offer · gateWaitS = a page waits this long at the 3-2-1 for the other
//   mate (the other player's soldier): tagY / rideTagY = his name over his head (m; mounted) · arrowPad = px the edge arrow keeps from the screen's edge ·
//     losEvery = s between two looks whether something hides him (losStep m between samples of the ground, losClear m of earth over the line = hidden) ·
//     fireEvery = s between two of his muzzle flashes while he holds the trigger, tracer* = his rounds as drawn (m/s, s, how many at once) · hex / css his
//     colour, downCss when he is down · hitR / rideR = how big a target he is for the enemy's rounds on the host (m) · xrayH / xrayW = the outline seen through walls (m) ·
//     spawnGap = m the guest starts to the side of the host (both would stand on the one spawn point)
//   focus: on the host each enemy soldier regards ONE of the two players — looked at again every `every` s, changed only for one `stick` × nearer
//   down: at no health a player is DOWN (crawls, cannot fire) — the other within r m for reviveS s stands him up with hpK of his health and safeS s of
//     safety; the count falls back at `decay` of its pace when he steps away; both down = the stage is lost
//   puppet (the guest's drawn enemy): fireMs = a man who fired within this long is sent as firing · fireEvery = s between two drawn shots of his ·
//     goneS = a man gone from the snapshots without a death is taken off after this long · blastPerS = explosions passed on a second at most ·
//     nadeN = grenades in the air drawn at once · hitMax = the most one reported hit may take (a guard against a broken page)
//   trust (COOP 7 who may say what — net/rules.js coopEventAllowed / coopJudgeHit; the HOST is the authority, a guest's word is checked): the guest may send only
//     hit REPORTS against enemy ids and "I am at the gate"; a report is dropped when its enemy is gone, its weapon is not one of the last two his state named, he
//     is down, the enemy is further than max(rangeMin, the gun's reach × rangeK) from where he last said he was, or he is over hitsPerS reports a second; its
//     damage is cut to max(dmgMin, the weapon's own round × dmgK); a heavy hit from a light gun (a grenade, the knife, a trample) spends one of heavyBurst
//     tokens (heavyPerS back a second) and takes heavyDmg at most · stageMax = the highest stage number a cue may name · nadeMs = the longest grenade flight ·
//     hpMax = the most health the host believes a guest has, healPerS = how fast the host lets his reported health rise (it falls at once), syncS = after the host
//     stands him up or hurts him it does not follow a staler report for this long
export const COOP = { proto:2, snapHz:20, inputHz:30,
  interp:{ delayMs:100, inputDelayMs:70, extrapMs:120, keep:10, teleportM:6, driftMs:0.05, offsetUp:0.25 },
  quant:{ pos:100, head:256, aim:65536 },
  limits:{ entities:160, events:48, eventQueue:256, players:2, ctlBytes:4096, battleKeys:16, name:24 },
  delta:{ history:32, maxBack:24 },
  link:{ pingMs:2000, deadMs:8000, queueMax:64, retryBaseMs:400, retryMaxMs:5000, retryK:1.8, retryJitter:0.25, retries:20 },
  session:{ tickMs:250, pingMs:1000, helloMs:3000, peerLostMs:15000 },
  ids:{ host:1, guest:2, firstEntity:16 },
  puppets:true, sayMax:160,
  cue:{ GATE:1, GO:2, WON:3, LOST:4, SCORE:5, WAVE:6, PHASE:7, UP:8, DOWN:9 },
  lobby:{ levelMax:5, tod:['day', 'noon', 'sunset', 'night'], wx:['clear', 'rain', 'sand', 'fog', 'snow'], gateWaitS:120 },
  mate:{ tagY:2.25, rideTagY:3.0, arrowPad:54, losEvery:0.25, losStep:3, losClear:1.2, fireEvery:0.12, tracerV:230, tracerLife:0.16, tracerN:24, hex:0x6fd0ff, css:'#6fd0ff', downCss:'#ff8a5a', hitR:0.55, rideR:1.2, xrayH:2.0, xrayW:1.05, spawnGap:3.2 },
  focus:{ every:0.7, stick:0.75 },
  down:{ r:2.6, reviveS:4, hpK:0.4, safeS:2.5, decay:0.5 },
  puppet:{ fireMs:220, fireEvery:0.14, goneS:0.6, blastPerS:6, nadeN:8, hitMax:3000 },
  trust:{ hitsPerS:40, heavyBurst:8, heavyPerS:3, dmgK:16, dmgMin:20, heavyDmg:600, rangeK:1.6, rangeMin:60, stageMax:999, nadeMs:8000, hpMax:600, healPerS:25, syncS:1.2 } };
// COOP 9 ONE SHARED BATTLE · THE PING · THE DIRECTOR FOR TWO · A MAGAZINE THROWN (game/coop-world.js, game/coop-team.js, game/coop-puppets.js, net/rules.js).
//   Nothing here is read without a live room. The HOST decides; a guest REPORTS (a round on a block, on a tower guard, "I touch this pick-up") and the host judges it.
//   world: switches — blocks (cover / towers / gates / the objective damaged and destroyed alike) · loot (pick-ups and the HQ's ammunition crate) · allies (our AI
//     soldiers as the host's puppets) · guards (tower guards) · drones · core (the Core's health)
//   block: a damaged block is passed on at most every `every` s (the last state wins; gone = at once) · a guest's report: perS a second, the block within
//     max(rangeMin, his gun's reach × rangeK) m of where he said he was, its damage cut to max(dmgMin, the gun's round × dmgK) · force = tries to bring down on the
//     guest what the host says is gone
//   core: the Core's health is sent when it changed, at most every `every` s
//   loot: the guest may take a pick-up within takeR m of where he said he was — on HIS page it slid the last 8 m to him, on the host's it lies where it fell —
//     (he asks every askEvery s while he touches it; asksPerS a second at most) ·
//     world = pick-ups whose effect is on the shared battle (the host applies it whoever took it) · crateR = the same reach for the ammunition crate (both get its
//     rounds) · needCd = s between two "I am short of ammunition" from the guest (the host's HQ answers with a crate by parachute near HIM)
//   guard: a guest's round on a tower guard — perS a second, the tower within max(rangeMin, reach × rangeK) m
//   ally (our men on the guest): roles = the kind byte's meaning (0 = a Core guard, the rest the fireteam's roles) · fireMs / fireEvery / goneS as COOP.puppet's ·
//     hex = their tracer's colour
//   drone: kinds = the airframes (kind byte kind0 + index) · goneS
//   ping: one key marks what he aims at — snapR m round the aim point an enemy is taken, else lootR m a pick-up, else the place · lifeS s · max alive a player ·
//     cdS between two of his own · the other page takes perS a second (burst at once) · ringR / hex / css by kind (0 place, 1 enemy, 2 loot) · beamH = the
//     marker's height (m) · say = the shout, {h} = the clock bearing from the LISTENER's view, {d} = metres
//   director (the host's, with a guest in the room): countK × the wave's head count · apart by more than aloneD m the flank entry goes at the one with fewer of
//     our men within menR m · the one who dealt most lately (what he dealt decays over dmgTau s; at least pressMin, pressLead × the other's) is PRESSED: to an
//     enemy choosing whom to regard he counts as pressK × as far · a revive in progress is heard: every reviveEvery s up to reviveN idle men within reviveR m
//     go and look
//   give: one key throws a magazine of the class the other holds to him — within r m (the receiving page allows r × rK), every cdS s, `mags` magazines of his
//     gun but maxRounds at most, out of the giver's own LOGISTICS reserve · flyS = its flight as drawn · perS / burst = what the other page takes
//   keys: the two actions' rows for the key sheet (pushed into ACTIONS only once a room is joined; every letter was taken: TAB and the backquote)
export const COOP2 = {
  world:{ blocks:true, loot:true, allies:true, guards:true, drones:true, core:true },
  block:{ every:0.25, perS:30, rangeK:1.6, rangeMin:40, dmgK:40, dmgMin:600, force:4 },
  core:{ every:0.5 },
  loot:{ takeR:10, askEvery:0.4, asksPerS:6, world:['repair', 'bomb', 'freeze', 'troops', 'armory'], crateR:8, needCd:60 },
  lootOp:{ DROP:1, TAKEN:2, GONE:3, ASK:4, CRATE:5, OPEN:6, ASKCRATE:7, NEED:8 },
  stateOp:{ CORE:1 },
  guard:{ perS:8, rangeK:1.6, rangeMin:60 },
  ally:{ roles:['guard', 'rifle', 'mg', 'mortar', 'sapper', 'at'], fireMs:260, fireEvery:0.16, goneS:0.8, hex:0xe8ef86 },
  drone:{ kinds:['recon', 'fpv', 'spot', 'kami'], kind0:200, goneS:0.6 },
  ping:{ kinds:3, lifeS:6, max:3, snapR:6, lootR:5, cdS:0.35, perS:2, burst:4, ringR:[1.5, 1.1, 0.9], hex:[0x6fd0ff, 0xff5a3a, 0xffd24a], css:['#6fd0ff', '#ff5a3a', '#ffd24a'], beamH:7,
    say:['Tới điểm hướng {h} giờ — {d} mét!', 'Địch hướng {h} giờ!', 'Đồ tiếp tế hướng {h} giờ — {d} mét!'], mine:['ĐÃ ĐÁNH DẤU ĐIỂM', 'ĐÃ ĐÁNH DẤU ĐỊCH', 'ĐÃ ĐÁNH DẤU ĐỒ'] },
  director:{ countK:1.6, aloneD:45, menR:22, pressK:0.72, dmgTau:12, pressMin:40, pressLead:1.25, reviveR:60, reviveEvery:2.5, reviveN:4 },
  give:{ r:7, rK:1.6, cdS:4, mags:1, maxRounds:250, flyS:0.55, perS:1, burst:2 },
  keys:[['coopPing', 'Co-op: đánh dấu chỗ đang ngắm cho đồng đội (địch / điểm / đồ)', 'CO-OP', ['tab'], null, 0], ['coopGive', 'Co-op: ném một băng đạn cho đồng đội đứng gần', 'CO-OP', ['`'], null, 0]] };
// SUPPLY 1 AMMUNITION IS A SUPPLY LINE (game/logistics.js; a gun's ammunition class: data/guns.js ammoKind) — "magazines" = × the gun's own magazine; rounds, s, m, kg.
//   start: the reserve he sets out with by class, in magazines of the gun he carries in it (× diff by the difficulty setting); a new stage and a new life bring every class
//     back up to it · capK: a class's reserve holds at most capK × that · warn: the reserve at or under `low` magazines = ÍT ĐẠN, none = BĂNG CUỐI, none and an empty
//     magazine = HẾT ĐẠN (a dry trigger says so at most every `say` s) · regen: the way out — the reserve of his issue weapon (the first gun of his rack) fills back by
//     itself up to `mags` magazines, one magazine every magT s (loose rounds from the bottom of his pack) · give: a gun picked up brings `fresh` magazines of its own
//     (one he had already: `again`) · crate: the THÙNG ĐẠN loot (the supply truck's crate, the relief drop) brings `share` of every class's start load, a magazine at least ·
//   tick: s between two looks of the module (never per frame) · say: every line of text of the modules ({n} a number or a name, {c} the class's name, {d} m, {b} a bearing).
// SUPPLY 2 RESUPPLY HE PLAYS FOR, AND THE WEIGHT OF IT (game/logistics.js):
//   pouch: a fallen enemy soldier leaves his pouch with chance p (pLow while that class's reserve is under lowMags magazines): n[0]…n[1] rounds for the first class of
//     `fits` he carries (× the difficulty), a B40 man a rocket with chance `rocket` — walked over like any loot; none from a man who falls over maxD m from him.
//   depot: the ammunition point at our base (crates at the rally point `off` m from its centre; no rally point: coreOff m from the core) — standing within r m one
//     magazine every `every` s to the gun in his hands first, then to the emptiest class, without end; a captured depot (within fwdR m) and a captured fortress (within
//     fortK × its radius, fwdR at least) do the same out of fwdStock magazines each a stage.
//   drop: the director's parachute — his reserves under `low` of the start loads on average (or under a magazine behind the issue weapon), nothing waiting, cd s since the
//     last, wait s into the stage, and a phase that allows (campaign/director.js dirSupplyOk): it lands d[0]…d[1] m from him on the side away from the enemy within
//     sideR m (`tries` bearings; the first spot with at most `foes` enemies within foeR m), named on the radio with distance and bearing, and brings `share` of every
//     class's start load; up to noticeN men who are not alerted and hold no post within noticeR m of the canopy go to look; one left unopened `stale` s no longer holds the next back.
//   mate: nothing behind the gun in his hands and `magK` of a magazine or less in it → a squad-mate within r m hands one over (`rounds` at most; classes `cls`; a rocket
//     only from the B40 man), cd s apart, `stock` a man a wave.
//   weight: a gun by class (gun, kg) and every round carried (round, kg); over `comfort` kg the sprint is slower and the combat roll comes back later — in proportion, up to
//     `max` at comfort + span kg; the chip shows from `show` up. Firing it off lightens him.
// SUPPLY 3 QUIET OR LOUD (game/quiet.js) — quiet: a suppressed gun (GUNS.supp) is heard suppR m off, not AWARE.hear.shot, and its flash gives no position away; a man who
//     falls within killT s of such a shot alerts only the men within deathR m, and if he had not been alerted he drops where he stood and LIES there.
//   knife: the nearest enemy soldier within reach m and arc rad of his aim, cd s between two uses, a lunge of `lunge` m/s. A man who is not alerted, taken from outside his
//     front `front` rad (the side, the back), goes down in silence — never the general, a fortress commander, an elite; anyone else takes dmg (and knows). A takedown is
//     seen only by a man within seenR m who is looking that way (cone rad either side). Creeping up: a man who does not know sensed anyone within AWARE.see.near m —
//     now, from outside his front and slower than senseV m/s (a walk, a crouch, a crawl — not a run, not a ride), only within near × senseK m (ai/awareness.js awareTick).
//   body: a man downed in silence lies `life` s (the last `sink` s of it sinking away; `max` on the field). An unalerted man within r m looking that way (cone rad) or
//     within near m FINDS it: he and the unalerted men within callR m of him turn suspicious and search from the body (looked for every `every` s); for searchT s any of
//     them who then makes the player out raises the alarm, like a sentry.
//   alarm: a SENTRY (a man holding a post: a fortress's, a camp's, a depot's garrison) or a searcher who becomes alerted within r m of him BY HIS OWN DOING — he is seen,
//     his shot is heard, a takedown is witnessed; never by our own men's fire — raises it `delay` s later, a red ring on him every ringT s; kill him first and it passes to another alerted sentry within passR m (pass s more) or is SILENCED.
//     Raised: a whistle (a siren too when he is a fortress's man or a watchtower stands within sirenR m), every enemy soldier within r m alerted (knowing where he is to
//     err m), and the director asked for ONE more squad (campaign/director.js dirAlarm: not in a lull, not while he is nearly dead; none with maxFoes men on the field).
//     At most `max` a stage, cd s apart — a clean approach earns the quieter fight.
//   eye: the chip on foot — closed: nobody within r m suspects anything; half: a man is suspicious or is making him out (his detection over det); open: a man is alerted.
//   btn: the takedown prompt's distance from the bottom of the screen (px: desktop, phones) — it is a button there.
export const LOGISTICS = { tick:0.25,
  start:{ rifle:5, pistol:5, belt:2, shot:5, heavy:5, rocket:4, shell:3, fuel:2, cell:4, blade:4 }, diff:{ recruit:1.3, soldier:1, veteran:0.8 }, capK:1.6,
  warn:{ low:1, say:5 }, regen:{ mags:1, magT:28 }, give:{ fresh:2, again:1 }, crate:{ share:0.6 },
  pouch:{ p:0.3, pLow:0.75, lowMags:2, n:[8, 15], rocket:0.35, maxD:45, fits:['rifle', 'belt', 'pistol'] },
  depot:{ r:4.5, every:0.6, off:[2.7, 0.6], coreOff:[6, 3], fwdR:7, fortK:0.55, fwdStock:10 },
  drop:{ low:0.3, cd:80, wait:40, d:[30, 46], sideR:60, tries:8, foes:1, foeR:18, share:0.7, noticeR:55, noticeN:5, stale:100 },
  mate:{ r:7, magK:0.34, rounds:60, cd:14, stock:2, cls:['rifle', 'pistol', 'belt', 'shot'] },
  weight:{ comfort:28, span:25, max:0.12, show:0.02,
    gun:{ rifle:3.5, pistol:2.6, belt:8.5, shot:3.4, heavy:8, rocket:6.3, shell:2.7, fuel:9, cell:5, blade:5 },
    round:{ rifle:0.017, pistol:0.012, belt:0.028, shot:0.05, heavy:0.11, rocket:2.2, shell:0.23, fuel:0.03, cell:0.05, blade:0.1 } },
  quiet:{ suppR:12, killT:1.2, deathR:7, every:0.25, btn:[286, 316],
    knife:{ reach:2.2, arc:1.5, cd:0.8, lunge:4.5, front:1.05, dmg:14, seenR:6, cone:1.3, senseK:0.3, senseV:2.2 },
    body:{ life:60, sink:1.5, max:8, r:9, near:2.5, cone:1.3, callR:16, searchT:45, every:0.5 },
    alarm:{ delay:2.6, ringT:0.5, passR:14, pass:1, r:60, err:5, sirenR:75, max:2, cd:80, maxFoes:80 },
    eye:{ r:70, det:0.15 } },
  say:{ cls:{ rifle:'ĐẠN 7.62', pistol:'ĐẠN 9 MM', belt:'ĐẠN DÂY', shot:'ĐẠN GHÉM', heavy:'ĐẠN 12.7', rocket:'ĐẠN B41', shell:'LỰU 40 MM', fuel:'XĂNG ĐẶC', cell:'PIN', blade:'LƯỠI CƯA' },
    low:'ÍT ĐẠN', last:'BĂNG CUỐI', dry:'HẾT ĐẠN', dryTip:'HẾT ĐẠN — ĐỔI SÚNG HOẶC RÚT DAO!', got:'+{n} {c}', full:'ĐẦY ĐẠN',
    crateDs:'Đầy băng mọi súng · thêm đạn dự trữ · kỹ năng sẵn sàng ngay',
    pouch:'TÚI ĐẠN ĐỊCH', pouchDs:'Đạn nhặt từ lính địch ngã xuống', depotOut:'KHO Ở ĐÂY ĐÃ CẠN', depotIn:'ĐIỂM TIẾP ĐẠN',
    drop:['SCH: Thả dù đạn cách anh {d} m về hướng {b} — ra lấy trước khi địch mò tới!', 'SCH: Đạn đang xuống, {d} m hướng {b} — địch cũng thấy dù đấy, nhanh lên!'],
    dropTip:'Dù đạn: {d} m hướng {b}', dropGot:'ĐÃ NHẬN ĐẠN TIẾP TẾ', bearings:['bắc', 'đông bắc', 'đông', 'đông nam', 'nam', 'tây nam', 'tây', 'tây bắc'],
    mate:['{n}: BẮT LẤY BĂNG ĐẠN!', '{n}: ĐẠN ĐÂY, ANH!'], mateRocket:'{n}: ĐẠN B41 ĐÂY!', load:'−{n}%',
    eye:['ẨN', 'NGHI', 'LỘ'], knife:'DAO GĂM — HẠ GỤC', knifeDown:'HẠ GỤC LẶNG LẼ', knifeHit:'ĐÂM!', body:'CÓ XÁC! CÓ ĐỊCH!', bodyTip:'ĐỊCH THẤY XÁC — CHÚNG ĐANG LÙNG',
    raise:'SẮP BÁO ĐỘNG!', silenced:'BỊT MIỆNG KỊP — KHÔNG BÁO ĐỘNG', alarm:'⚠ BÁO ĐỘNG!',
    alarmSquad:'SCH: Địch đã báo động — một toán tăng viện đang kéo tới chỗ anh!', alarmHold:'SCH: Địch đã báo động — cả vị trí biết anh ở đâu rồi!' } };
// MODE 1 NIGHT DEFENCE — "THỦ ĐÊM" (campaign/night-defence.js; the run kit both modes share: campaign/mode-run.js; pure arithmetic: data/mode-math.js) — a custom
//   battle at night on any battlefield: hold our base from h0:00 to h1:00, the night squeezed into len seconds (the clock runs × fastK while the field is quiet and
//   the next assault is more than lull.max s off). at: when each assault begins (s of the night); warn: s before it its direction is given away — an enemy flare
//   going up on that side, a sentry on the radio — never a marker. assaults[i]: n men (rpg: the share with a B41), squads, heli (troop helicopters: their engines
//   are the warning), tier (+ to the tactics tier for this assault: marksmen and MG teams come with tier 3), extra: what else the director plays and when (t s
//   into the assault) — mortar (a barrage on the base and on him), drone (kind), hatch (men up out of a hatch inside the wire, on the far side), general (the
//   stage's general leads it). An assault's queue is cut lull.min s before the next: there is always a lull. nightK: head count + per night of the endless run;
//   the next night is the same battlefield one campaign loop harder (+1 tactics tier, health, damage), at most maxNight.
//   push: every `every` s the men who have not found him are sent at the base (their report of where we are = a point ringR m round the Core).
//   sap: an enemy soldier within r m of the Core for arm s is laying charges: dps to the Core each (at most maxN counted) every tick s, said every sayT s.
//   mortar: n shells gap s apart from t s on (warn s of red ring each), R / dmg; ring m from the Core within arc rad of the assault's side, or (share pP) within
//     nearP m of him. hatch: r m from the Core, these men. general: he takes the field `inset` m inside the fence on that side.
//   gun: the base's guns have a night's ammunition each — a guard cannon `shells`, an MG tower `rounds` — then stand silent until he stands within r m of one
//     for t s (full again); a dry gun says so over itself every tag s when he is within tagR m, and on the radio at most every sayT s.
//   flare (his new skill, in the skill wheel for the night): cd s; it bursts alt m over the point he aims at (at most reach m off; `ahead` m in front of him with no
//     pointer), climbing `rise` s, burns `burn` s sinking sink m/s and drifting; enemy soldiers within R m of the point under it are marked (as the recon drone
//     marks, `mark` s a tick) — and inside it he is lit too (game/stealth.js stealthLight); lift: how much the field's fill light rises while it burns (flick: its
//     flicker); pool: the ground glow's opacity; at most max up at once. sig: the enemy's own signal flare. dawn: the hour really changes at the end
//     (world/atmosphere.js, tod → `tod`), then hold s of cheering before the result; pre: the last share of the night the east is said to be greying.
//   score (data/mode-math.js ndScore): the battle's own score + assault a seen-off assault + (dawn + core × the base's health left) on a win + acc × accuracy +
//     general if he fell, all × (1 + nightK a night after the first).
export const NIGHTDEF = { len:480, h0:21, h1:5, clockStep:5, fastK:3, warn:7, lull:{ min:30, max:40 }, at:[12, 90, 168, 246, 322, 398], nightK:0.15, maxNight:9,
  assaults:[
    { n:5,  rpg:0,    squads:1, heli:0, tier:0, extra:[] },
    { n:6,  rpg:0.15, squads:1, heli:0, tier:0, extra:[{ k:'mortar', t:0 }] },
    { n:7,  rpg:0.2,  squads:2, heli:0, tier:1, extra:[{ k:'drone', t:10, kind:'spot' }] },
    { n:8,  rpg:0.25, squads:2, heli:1, tier:1, extra:[{ k:'mortar', t:0 }, { k:'drone', t:16, kind:'kami' }] },
    { n:9,  rpg:0.25, squads:2, heli:0, tier:2, extra:[{ k:'hatch', t:14 }, { k:'drone', t:24, kind:'kami' }] },
    { n:11, rpg:0.3,  squads:3, heli:1, tier:2, extra:[{ k:'mortar', t:0 }, { k:'hatch', t:20 }, { k:'general', t:26 }] } ],
  push:{ every:1.5, ringR:[16, 30] }, sap:{ r:30, arm:3, dps:2.4, maxN:5, tick:1, sayT:6 },
  mortar:{ n:8, t:3.2, gap:0.7, warn:2.6, R:5, dmg:38, ring:[16, 36], arc:1.2, pP:0.4, nearP:9 }, hatch:{ r:[32, 40], types:['rifle', 'rifle', 'rifle', 'rpg'] }, general:{ inset:14 },
  gun:{ shells:6, rounds:70, r:6.5, t:1.2, tag:7, tagR:90, sayT:18 },
  flare:{ cd:22, reach:60, ahead:32, alt:30, rise:0.9, burn:15, sink:1.1, drift:1.2, R:30, tick:0.3, mark:1.2, lift:1.3, flick:0.12, pool:0.34, size:9, max:3, col:0xfff0c8, sig:{ col:0xff3a22, alt:46, burn:6, size:7 } },
  dawn:{ tod:'day', hold:5.5, pre:0.92 }, hud:0.25, score:{ assault:400, dawn:1500, core:1500, acc:1000, general:1200, nightK:0.25 },
  say:{ name:'Thủ đêm', tabSub:'giữ căn cứ đến sáng', dirs:['bắc', 'nam', 'tây', 'đông'], night:'đêm thứ {n}',
    sum:'<b>Thủ đêm</b> {b} · {wx} · bản đồ {sp} · địch cấp {lvl}', kick:'Thủ đêm · giữ căn cứ từ {h0} đến {h1}',
    briefOp:'Thủ đêm — giữ căn cứ tới {h1}',
    brief:'Đêm nay địch đánh {n} đợt, đợt cuối do tướng của chúng dẫn. Không ai báo trước hướng địch tới: nhìn pháo hiệu đỏ của chúng bốc lên phía nào, nghe chòi gác gọi trên máy. Pháo và súng máy trên tường chỉ có cơ số đạn một đêm: khẩu nào hết đạn thì lại đứng cạnh nó hơn một giây để tiếp đạn, không thì địch áp sát tường đặt bộc phá. Giữa hai đợt có nửa phút — về điểm đạn, băng bó, tiếp đạn cho pháo. Kỹ năng mới trong vòng kỹ năng: PHÁO SÁNG — soi một vùng 15 giây; địch trong vùng sáng bị đánh dấu, và anh đứng trong đó cũng lộ.',
    obj:'Giữ Lõi căn cứ từ {h0} đến {h1}. Lõi còn đứng lúc trời sáng là thắng; mất Lõi hoặc hết mạng là thua.',
    first:'SCH: Trời tối rồi. Về giữ căn cứ — đêm nay chúng sẽ tới, chưa biết từ hướng nào.',
    warn:['Chòi gác {d}: có động ngoài hàng rào — pháo hiệu của chúng vừa bốc lên!', 'Chòi gác {d}: nghe tiếng chân, rất đông — chúng sắp vào từ hướng {d}!', 'Chòi gác {d}: thấy bóng người ngoài rào — chuẩn bị đón chúng!'],
    warnHeli:'Chòi gác {d}: có tiếng động cơ trực thăng bay thấp — chúng đổ quân từ hướng {d}!',
    go:['SCH: Chúng xông vào rồi — giữ lấy tường!', 'SCH: Địch vượt rào — đừng để chúng áp sát Lõi!', 'SCH: Chúng tới rồi. Bắn có chọn lọc, giữ đạn!'],
    lull:['SCH: Chúng lùi rồi. Nửa phút — tiếp đạn, băng bó!', 'SCH: Tạm yên. Về điểm đạn, xem lại các khẩu pháo!', 'SCH: Đẩy lui được một đợt. Tranh thủ nạp đạn — chúng sẽ quay lại.'],
    cut:'SCH: Đợt này chúng chùn rồi — bọn còn lại bám quanh rào, quét cho sạch!',
    mortar:'Chòi gác {d}: cối địch bắn! Tránh xa các vòng đỏ!', hatch:'SCH: Nắp hầm bật mở ngay trong hàng rào, phía {d} — quay lại!',
    general:'SCH: {g} đích thân dẫn đợt cuối — hạ hắn trước khi trời sáng!', generalDown:'ĐÃ HẠ {g} — ĐỢT CUỐI MẤT ĐẦU!',
    gunDry:'Pháo thủ: khẩu phía {d} hết đạn — ai lại tiếp đạn giúp!', gunTag:'HẾT ĐẠN — LẠI GẦN ĐỂ NẠP', gunLoad:'ĐANG NẠP PHÁO…', gunUp:'ĐÃ NẠP — PHÁO BẮN LẠI',
    sap:'ĐẶT BỘC PHÁ!', sapRadio:'SCH: Địch áp sát tường đặt bộc phá — đánh bật chúng ra!',
    flare:'PHÁO SÁNG', flareUp:'PHÁO SÁNG LÊN!', flareMax:'ĐÃ ĐỦ PHÁO SÁNG TRÊN TRỜI',
    predawn:'SCH: Phía đông hửng rồi — giữ thêm chút nữa!', dawn:'TRỜI SÁNG — CĂN CỨ CÒN ĐỨNG!', dawnRadio:'SCH: Trời sáng rồi! Chúng rút — anh em giữ được căn cứ!',
    hud:{ first:'Trời vừa tối — về giữ căn cứ', lull:'Tạm lắng — tiếp đạn, băng bó', gun:' · {n} khẩu pháo hết đạn', warn:'Chòi gác {d} báo động', assault:'Đợt {k}/{n} · còn {e} địch', wait:'Chờ trời sáng' },
    pause:'Thủ đêm · {clock} · đợt {k}/{n}',
    end:{ kickWon:'Trời sáng — căn cứ còn đứng', kickLost:'Căn cứ thất thủ lúc {clock}', won:'Giữ vững', lost:'Thất thủ',
      whyWon:'{b}, {night}: đẩy lui {k} đợt, hạ {kills} địch.{gen}', gen:' Tướng địch gục trước tường.', whyCore:'<b>Lõi bị phá.</b> {b}, {night}: trụ được {k}/{n} đợt, hạ {kills} địch. Đừng để địch áp sát tường đặt bộc phá.',
      whyDead:'<b>Hết mạng.</b> {b}, {night}: trụ được {k}/{n} đợt, hạ {kills} địch.', stats:['Điểm', 'Đợt đẩy lui', 'Lõi còn', 'Chính xác'],
      best:'Chuỗi dài nhất: {n} đêm · điểm một đêm cao nhất {s}', newBest:'Kỷ lục mới — ', next:'Đêm tiếp theo', retry:'Thủ lại từ đêm 1', hintWon:'Đêm sau: cùng căn cứ, địch tinh hơn một bậc.', hintLost:'Thủ lại bắt đầu từ đêm thứ nhất.' },
    copy:'Chép kết quả', copied:'Đã chép', copyFail:'Không chép được',
    share:{ head:'XUNG KÍCH — Thủ đêm', where:'{b} · {wx}', rule:'{night} · đợt đẩy lui {k}/{n}', won:'★ {score} điểm · GIỮ VỮNG · Lõi còn {core}%', lost:'✖ {score} điểm · thất thủ lúc {clock}', stats:'Hạ {kills} · chính xác {acc}% · độ khó {diff}', practice:'', by:'— {name}' } } };
// MODE 2 THE DAILY CHALLENGE — "THỬ THÁCH HÔM NAY" (campaign/daily.js; the generator: data/mode-math.js dailyChallenge) — one battle a day, the same for everyone:
//   the day is the calendar day in UTC+tz; from its number alone come the battlefield (biomes), the hour (tod), the weather (wx, + wxBiome's own), the size
//   (space), the enemy level (level: a campaign level, so its stage's general), the seed of the battlefield, the modifier (mods, each once per cycle, never two
//   days running) and the gun he is issued (guns, + kit). A modifier changes how the day plays through knobs the game already has:
//     set: [path, op, value] on a config object (op '=' | '*' | '+'; a last segment '*' = every number in it) — put back when the run ends ·
//     guns (+ strict: nothing else may be carried) · lives (the lives he starts with: 0 = the first death is the last) · tod / wx (the day's hour / weather) ·
//     spellsOff (skills taken out of the wheel) · lootOff (pickups that do nothing) · general (the stage's general takes the field hunterAt s in) ·
//     event (a big battlefield event forced every `every` s; busy: again in `retry` s). strictTick: how often a strict loadout is checked. hold: s of cheering
//     before a win's result card. bannerAt: s into the fight the day's rule is put on the banner (the first wave's own banner goes up before it).
//   One scored attempt a day — spent the moment the fight goes live — then any number of practice attempts, marked as practice. The day's result is kept in the
//   profile (PROFILE.modes.daily, the last `keep` days). score (data/mode-math.js dailyScore): the battle's score + win + perSec a second under par on a win +
//   acc × accuracy.
//   THE BOARD IS LOCAL (the Cloud Functions are not to be changed for this). A shared board would need, server side: (1) the generator run by the server
//   (functions/: the same dailyChallenge + this object) so the day and its seed are the server's, not the client's clock; (2) a callable `dailyRun({ day, score,
//   secs, kills, acc, won, runId, name })` that accepts ONE scored run per uid per day (a doc daily/{day}/runs/{uid} written once, a second call refused), holds
//   the score to what the day's level can be worth (functions/score.js's ceiling × the modifier), and (3) a board collection daily/{day}/top read by
//   ui/ranking.js. Until then core/score-report.js sends nothing for a mode's run (S.run.offBoard).
export const DAILY = { tz:7, keep:14, level:[2, 5], tod:['day', 'noon', 'sunset', 'night'], wx:['clear', 'clear', 'rain', 'fog'], wxBiome:{ DESERT:'sand', SAVANNA:'sand', QUARRY:'sand', ARCTIC:'snow', CITADEL:'snow' }, space:['mid', 'wide'],
  biomes:['DESERT', 'RUINS', 'ARCTIC', 'FOUNDRY', 'CITADEL', 'MEADOW', 'CITY', 'SAVANNA', 'VOLCANO', 'QUARRY'], guns:['carbine', 't_ak', 't_m4', 't_shotgun', 't_lmg', 't_dmr', 't_rust'], kit:['t_rpg'], hunterAt:6, strictTick:0.5, hold:5.4, bannerAt:3.4,
  mods:[
    { id:'knife',    vi:'Dao và MP5',        ds:'Chỉ dao găm và tiểu liên MP5 bắn đạn súng ngắn — không B41, không nhặt súng khác.', guns:['t_mp5'], strict:true },
    { id:'nomed',    vi:'Không cứu thương',  ds:'Không băng bó, không túi cứu thương, không dù cứu thương: máu chỉ hồi khi thăng cấp.', spellsOff:['medkit'], lootOff:['heal'], set:[['DIRECTOR.lull.drop.hp', '=', 0]] },
    { id:'drones',   vi:'Bầy drone',         ds:'Drone địch tới dày gấp đôi, ngay từ màn đầu, và cảm tử luôn đi hai chiếc.', set:[['DRONEWAR.enemy.gap', '*', 0.5], ['DRONEWAR.enemy.w', '*', 2], ['DRONEWAR.enemy.from', '=', 1], ['DRONEWAR.enemy.two', '=', 1]] },
    { id:'fognight', vi:'Đêm sương mù',      ds:'Đánh trong đêm sương: tầm nhìn và tầm bắn đều ngắn lại.', tod:'night', wx:'fog' },
    { id:'halfammo', vi:'Đạn giảm nửa',      ds:'Cơ số đạn mang theo chỉ còn một nửa: nhặt túi đạn của địch, về điểm đạn mà tiếp.', set:[['LOGISTICS.start.*', '*', 0.5]] },
    { id:'onelife',  vi:'Một mạng',          ds:'Không có lượt hồi sinh: ngã một lần là hết trận.', lives:0 },
    { id:'hunter',   vi:'Tướng săn người',   ds:'Tướng địch rời thành săn anh ngay từ đầu trận, cùng cận vệ. Hạ hắn là thắng.', general:true },
    { id:'nogive',   vi:'Không ai đầu hàng', ds:'Địch không buông súng: tên cuối cùng của mỗi tốp đánh tới chết.', set:[['DIRECTOR.tactics.surrender.chance.*', '=', 0]] },
    { id:'triple',   vi:'Nhiệm vụ phụ ×3',   ds:'Nhiệm vụ phụ thưởng gấp ba điểm và đến thêm một lần.', set:[['SIDEMISSION.pilot.score', '*', 3], ['SIDEMISSION.truck.score', '*', 3], ['SIDEMISSION.pows.score', '*', 3], ['SIDEMISSION.perStage', '+', 1]] },
    { id:'blackout', vi:'Mất liên lạc',      ds:'Cứ hai phút địch lại gây nhiễu: mất bản đồ, mất điện đàm một lúc.', event:{ kind:'jam', every:120, retry:6 } } ],
  score:{ win:2500, par:600, perSec:4, acc:1000 },
  say:{ name:'Thử thách hôm nay', homeDone:'Thử thách ✓ {s}', line:'Hôm nay: {b} · {m}', lineOpen:' — chưa đánh', lineDone:' — đã đánh, {s} điểm',
    ask:{ title:'Thử thách {date}', body:'{b} · {tod} · {wx} · địch cấp {lvl}. Luật hôm nay — {m}: {ds} Súng được phát: {guns}. {state}',
      scored:'Lượt này TÍNH ĐIỂM — mỗi ngày chỉ một lượt, tính từ lúc nổ súng.', practice:'Lượt tính điểm hôm nay đã dùng ({s} điểm) — lần này là đánh tập.', yes:'Xuất kích', yesP:'Đánh tập', no:'Để sau' },
    briefOp:'Thử thách {date} — {m}', brief:'{ds} Súng được phát hôm nay: {guns}. Hôm nay ai cũng đánh đúng chiến trường này, đúng luật này. {state}',
    obj:'Hạ tướng địch giữ thành để hoàn thành. Điểm = điểm trận + thưởng thắng (thắng càng nhanh càng cao) + độ chính xác.',
    go:'THỬ THÁCH: {m}', goP:'ĐÁNH TẬP: {m}', radio:'SCH: ', pause:'Thử thách {date} · {m}{p}', pauseP:' · đánh tập', noMed:'KHÔNG CỨU THƯƠNG HÔM NAY', strict:'HÔM NAY CHỈ DAO VÀ MP5', hunter:'SCH: Hôm nay tướng địch không chờ trong thành — hắn đang tìm anh!', wonBanner:'ĐÃ HẠ {g} — HOÀN THÀNH THỬ THÁCH!',
    end:{ kick:'Thử thách {date}', kickP:'Thử thách {date} · đánh tập', won:'Hoàn thành', lost:'Gục ngã', why:'{b} · {tod} · {wx} — luật: <b>{m}</b>. {res}',
      resWon:'Tướng địch đã gục.', resCore:'Lõi căn cứ bị phá.', resDead:'Người lính ngã xuống.', stats:['Điểm', 'Thời gian', 'Hạ địch', 'Chính xác'],
      best:'Điểm tính của hôm nay: {s}', bestP:'Đánh tập không tính điểm — điểm tính của ngày này vẫn là {s}', bestNone:'Đánh tập — không tính điểm.', hist:' · {n} ngày gần đây cao nhất {top}', go:'Đánh tập', hint:'Mai có thử thách mới. Đánh tập bao nhiêu lần cũng được.' },
    copy:'Chép kết quả', copied:'Đã chép', copyFail:'Không chép được',
    share:{ head:'XUNG KÍCH — Thử thách {date}', where:'{b} · {tod} · {wx}', rule:'Luật: {m}', won:'★ {score} điểm · HOÀN THÀNH · {time}', lost:'✖ {score} điểm · gục ngã · {time}', stats:'Hạ {kills} · chính xác {acc}% · độ khó {diff}', practice:'(đánh tập — không tính điểm)', by:'— {name}' } } };

// ANIM 1 THE SOLDIER'S MOTION LIBRARY (src/actors/anim-lib.js; built by tools/mixamo-clips.mjs from the Mixamo FBX set — assets/anim/SOURCE.txt):
//   where the packed clips are, which groups there are (one file each) and which a battle fetches first; the rest come when asked (loadAnimGroup).
//   decode: hips — the clip moves the hips (height, sway; off = turns only) · root — keep the root track of the clips that travel (animRootAt)
//   · eager — build every clip of a group the moment its file is in (off: each clip the first time it is asked for).
export const ANIMLIB = { on:true, version:1, path:'assets/anim/', index:'index.json',
  groups:['loco', 'stance', 'air', 'combat', 'react', 'social', 'blade'], preload:['loco', 'stance'],
  decode:{ hips:true, root:true, eager:false } };
// SYNC 1 THE SAME SEED, THE SAME BATTLEFIELD — on a fresh page, on a relaunch, on both co-op pages (core/dice.js). A seeded battle (the daily challenge, a
//   co-op room, ?seed) draws its LAYOUT from the seeded generator; what is not layout no longer does:
//   uuid      three.js spends `Math.random` on every object's uuid (4 draws each): handed back to the seeded generator as they are spent (uuidOf: the
//             three classes whose constructor writes one; uuidBuf: the tag three puts on an interleaved model's ArrayBuffer at its first clone).
//             false = they shift the layout again (before / after).
//   cosmetic  cosmetic(fn) runs on the page's own generator: what is made once and kept, a fall-back mesh, a pooled piece. false = on the seeded dice again.
//   trace     keep every build's steps (draws + field hash per step: fieldSteps(), fieldStepsDiff(a, b)) — also ?fieldtrace, or DICE.trace = true in the
//             console before a launch. Off: nothing is computed.
//   waitMs    a seeded battle waits this long at most, under the loading veil, for the real cover pieces before it builds: a container's / a wreck's
//             collider is sized off its model (world/cover.js placeLone), the drawn stand-in's box differs. 0 = no wait.
//   steps     the builders behind each modeSeed(k) step, for the trace's report; last = the step that closes a build; from = the step at which each
//             list is the new field's (before it, it still holds the last battle's and stays out of the step's hash).
//   (?nofieldsync turns uuid + cosmetic off for one page.)
export const FIELD_SYNC = { uuid:true, uuidBuf:true, cosmetic:true, trace:false, last:20, waitMs:4000, from:{ blocks:4, forts:4, towers:8, trees:13 },
  uuidOf:['Object3D', 'BufferGeometry', 'Material', 'Texture', 'Source', 'Shape', 'Skeleton', 'AnimationClip', 'InterleavedBuffer', 'AnimationObjectGroup'],
  steps:{ 1:'field outline + terrain (genField, genTerrain)', 2:'perimeter + horizon (buildPerimeter, buildHorizon)', 3:'terrain decor (buildTerrainDecor)', 4:'zones + forts planned, our compound (planZones, buildCoreWalls)',
    5:'landmarks (buildLandmarks)', 6:'the enemy defence (buildDefense)', 7:'cover scatter', 8:'watchtowers, hedgehogs, rock outcrops (buildTowers)', 9:'containers + wrecks (placeLone)', 10:'ridges + brick walls (buildRidges, buildBrickWalls)',
    11:'supply, camps, caches (buildSupply, buildCamps, placeCaches)', 12:'zones + forts built (buildZones)', 13:'scenery (buildScenery)', 14:'garrisons (garrisonSupply, garrisonDefense)', 15:'(end of buildBlocks)',
    16:'objective (buildObjective)', 17:'lava (buildLava)', 18:'underground (buildUnderground)', 19:'trails (buildTrails)' } };
// GRAPH 1 THE SOLDIER'S MOTION GRAPH (src/actors/anim-graph.js; the PLAYER'S soldier on his feet). on = the switch: off by default, ?animgraph in
//   the address turns it on (off: nothing is fetched, built or run — the game is exactly as before). groups = the library files it fetches.
//   THE BLEND SPACE: dirs = the eight bearings in the order they turn (from ahead round by his left; a clip's name = a gait's prefix + a bearing);
//   sets = for standing and for crouched: the idle, the gaits slowest first, the two turn-on-the-spot clips [left, right]. band = a gait is played
//   alone (only its rate changes) from [0] of its own speed under it to [1] over it, blended with the next in between (never over less than
//   bandMin m/s: run and sprint are close) — so the game's own paces (walk 1.5, run 4.8, sprint 6.2, crouch 1.6 m/s) are each ONE clip · slowAt, slowExp = under a walk the idle is
//   mixed in: the walk's share = (speed / (slowAt × the walk's low edge))^slowExp, whole from slowAt on (real steps early; the foot lock takes up the rest); startW =
//   once the stride's share has been under 0.6 × this, it starts again (at the phase nearest his standing feet) as it comes back over this · rate = the stride's play-rate limits ·
//   velHalf = half-life (s) of the smoothing on the velocity that picks the clips · calib = each clip's ground speed measured from its own planted
//   foot (off: the index's) · maxClips / phoneClips = the most clips blended at once (phones: 2).
//   LAYERS: spine = how much of Spine / Spine1 / Spine2 is the graph's (0 = the game's pose as today, 1 = the locomotion clip's) — the neck, head
//   and arms are never the graph's · sync = the game's own stride clips whose upper body keeps the graph's stride phase.
//   CUTS: inert.half / .stance = half-life (s) of the offset left by a cut (an ordinary one / a change of stance or of who poses him) · jump = a
//   clip whose weight moved more than this in one frame counts as a cut · vmax = the most turn rate (rad/s) carried across one.
//   turn = stood still: the legs stay planted until the body has turned `at` rad over them, then a turn clip at `rate` (cut at `end` of its
//   length, turning him `max` rad at most — a wider turn takes a second one); on the move they come back under him at `settle` /s · kneel = crouched and still for `wait` s (under stillV m/s) he goes onto a knee ·
//   prone = idle + crawl by speed (crawlV = full crawl; rate limits; drop = how far the operator is sunk lying down: REALCAV.proneDrop is for the
//   old clip) · trans = the stance clips [id, from s, to s, rate] (fast = × on the first leg of stand → prone; cutV = setting off faster than this
//   ends one early) · air = take-off [id, from, to] over upT s, the tucked loop, the landing [id, from, the moment the feet touch, end] (landRate; coming
//   down faster than trans.cutV he goes straight back into his stride) · feet = the foot lock: a foot is held once the clip has it within hOn m of its standing
//   height and its ball slower over the ground than vOn[0] + vOn[1]·speed (or, going faster than landV, under vLand and braking harder than `brake` m/s²: a
//   run's foot lands still skidding in the clip), let go above hOff or once it is carried off faster than vOff[0] + vOff[1]·speed and speeding up (under slowV m/s a foot
//   the clip has down is simply held, and steps — lifted — when the leg runs out of reach); half =
//   half-life (s) of what it was held back by; peel = the most speed (m/s) it is released with; stretch = the leg's reach (× its length);
//   retro = it is held where it was shown the frame before it landed, at most this far back (m: at a low frame
//   rate a foot travels far in a frame) ·
//   heel = the ankle must be this much lower than the ball to count (m: a heel
//   comes down toes-up); rest / restT / stepHalf / lift / liftMax = stood still restT s (on a knee or changing stance: at once) on feet left
//   more than `rest` m from where the clip stands them, the further one steps there (half-life stepHalf s), lifted lift × the distance (liftMax at most); stepV / stepGap = a footfall is heard above this speed, no two from one
//   foot closer than this (s) · shot = graphPlay's defaults.
//   GRAPH 2 · sets.*.wide = the about-turn clips [left, right], taken whole when the body has turned more than turn.wide rad over his legs ·
//   stop = pulling up from a run: the library's run-to-stop (a braking step), laid on the ground he still has to cover (v² / 2a at CAV.foot.decel) —
//   taken only within `late` s of the push being let go, between minV and maxV m/s, going ahead (`ahead` = share of his speed along his facing) and
//   only while the stride is in `phase` (right foot standing, left swinging through: where the clip begins); otherwise he pulls up on his own
//   stride, feet planted. stillV = under this the clip runs on by the clock (`rate`); maxRate = the most it may be hurried; end = the share of it played ·
//   air.snapV = down from a jump slower than this (and faster than trans.cutV) the stride starts where its feet are nearest the pair he lands on ·
//   feet.flyT = the most a foot lifted off at such a landing is kept from being planted again (s) · slope = the ground under each foot (the old
//   legs' numbers: GUNFEEL.feet.slope for the foot's pitch, SOLDIER_LEGS.maxDrop for the hips): vmax = how fast a foot's ground may rise or fall
//   under it (m/s: a kerb is climbed, not jumped) · fade = a foot this high in its swing no longer reaches down into a dip (m) · max = the most
//   a foot is moved off the level through his middle (m) · rate = how fast the hips come back up (/s; three times that going down).
// GRAPH 5 the motion graph is ON by default (?noanimgraph: the old legs)
export const ANIMGRAPH = { on:typeof location !== 'undefined' && !/[?&]noanimgraph\b/.test(location.search), groups:['loco', 'stance', 'air'],
  dirs:['forward', 'forward-left', 'left', 'backward-left', 'backward', 'backward-right', 'right', 'forward-right'],
  sets:{ stand:{ idle:'stance-rifle-idle-aim', gaits:['loco-rifle-walk-', 'loco-rifle-run-', 'loco-rifle-sprint-'], turn:['loco-rifle-turn-90-left', 'loco-rifle-turn-90-right'], wide:['loco-rifle-turn-180-deg-left', 'loco-rifle-turn-180-deg-right'] },
    crouch:{ idle:'stance-idle-crouch-aim', gaits:['loco-rifle-walk-crouch-'], turn:['loco-rifle-crouch-turn-90-left', 'loco-rifle-crouch-turn-90-right'], wide:['loco-rifle-crouch-turn-180-deg-left', 'loco-rifle-crouch-turn-180-deg-right'] } },
  band:[0.24, 0.12], bandMin:0.4, slowAt:0.45, slowExp:0.6, startW:0.3, rate:[0.55, 1.5], velHalf:0.035, calib:true, maxClips:4, phoneClips:2,
  spine:[1, 0.7, 0.4], sync:{ Run_and_Shoot:1, Rifle_Charge:1, Walk_Forward_While_Shooting:1, Cautious_Crouch_Walk_Forward:1 },
  inert:{ half:0.08, stance:0.13, jump:0.15, vmax:25 },
  turn:{ at:1.0, early:0.25, max:1.75, wide:2.0, rate:1.5, lag:0.7, catchUp:3, end:0.95, moveV:0.3, settle:9 }, stop:{ clip:'loco-adv-run-to-stop', phase:[0.5, 0.76], late:0.07, minV:2.2, maxV:5.6, ahead:0.85, stillV:0.15, rate:1.2, maxRate:3, end:0.92, hipMin:0.86, hipSoft:0.04 }, kneel:{ idle:'stance-rifle-kneel-idle', stillV:0.25, wait:0.2 },
  prone:{ idle:'stance-prone-idle', crawl:'stance-prone-forward', crawlV:0.3, rate:[0.6, 3], drop:0, match:true, band:[0.45, 1.6], blendT:0.25, stopV:0.08, holdT:1.2, outT:0.9 },
  trans:{ standKneel:['stance-pistol-stand-to-kneel', 0.12, 0.75, 1.4], kneelStand:['stance-rifle-kneel-to-stand', 0.1, 0.95, 1.5], kneelProne:['stance-rifle-kneel-to-prone', 0.1, 1.95, 1.6], proneKneel:['stance-rifle-prone-to-kneel', 0, 1.85, 1.6], fast:1.6, cutV:1.0, crouchKneel:true },
  air:{ up:['air-jump-up', 0.27, 0.533], loop:'air-jump-loop', down:['air-jump-down', 0.07, 0.33, 0.66], upT:0.22, landRate:1.3, snapV:3 },
  feet:{ on:true, hOn:0.05, hOff:0.065, retro:0.12, heel:0.02, rest:0.12, restT:0.35, stepHalf:0.09, lift:0.45, liftMax:0.07, flyT:0.2, vOn:[0.5, 0.6], slowV:1.0, landV:3, vLand:[1.5, 1.2], brake:8, vOff:[1.8, 0.9], vRelV:3, walkLock:false, pull:0.45, drag:[0.35, 0.5, 0.05, 4.2], dragRate:40, proneLock:true, arc:true, stepT:[0.16, 0.5, 0.32], stepWin:[0.3, 0.75], liftMin:0.045, half:0.05, peel:3, stretch:0.985, stepV:0.4, stepGap:0.16 },
  slope:{ on:true, rate:14, vmax:3, fade:0.2, max:0.45 }, shot:{ half:0.1, rate:1 },
  // GRAPH 3 leap: a jump off at a run (above v m/s) is the stride carried through the air, the next footfall at least `min` of a stride on timed to the landing ·
  //   lean (rad per m/s², caps in rad): the trunk into his acceleration (k: ahead / behind, fwd / back caps) and into a bend (kr × speed × turn rate), on a spring of
  //   half-life `half`; accHalf smooths the acceleration; × aim while firing, × stop in the braking clip · stop.hipMin / hipSoft: the hips' floor pulling up (m) ·
  //   roll: the library's dive-roll played from t[0] to t[1] s over the game's own roll, cut in / out with half-life `half`
  leap:{ on:true, v:2.6, min:0.3 }, roll:{ on:true, clip:'air-sprint-roll-to-sprint', t:[0.36, 1.1], half:0.1 }, lean:{ on:true, k:0.018, kr:0.012, fwd:0.12, back:0.09, side:0.1, accHalf:0.06, half:0.12, turnV:1, omMax:4, aim:0.4, stop:0.3 } };
// GRAPH 6 HIS FEET ON THE GROUND (actors/anim-graph.js, actors/soldier-upper.js, actors/soldiers.js; ?nofit in the address = GRAPH 5 exactly) ·
//   reach: a leg the graph lays out (two-bone IK) straightens softly from soft × its length toward max × and never locks dead straight — a planted foot the
//     leg can hold no further turns on its ball, heel up, the ball kept where it was put (GRAPH 7; GRAPH 6 carried the ball along: it slid) — past heel
//     (cos of the turn, ~50°: a sprint's footfall held 30 cm back) it is let go from where the leg got, as before GRAPH 6 ·
//   land: between v[0] and v[1] m/s (a run; the sprint's own slide measured worse than its snap) a foot that touches down is held loosely for t s — the hold eases onto where the clip stands it (time constant tau s): the clip's
//     foot lands still travelling, and the gap a hard hold kept through the stance was flung back at toe-off ·
//   release: let go at a run, the gap between the hold and the clip closes on a spring of half-life half s (ANIMGRAPH.feet.half otherwise) ·
//   hipDrop: GRAPH 7 GRAPH 2's hips down for a standing leg that would run out (SOLDIER_LEGS.maxDrop) — it read a leg length never set and never ran ·
//   (land.t 0 since GRAPH 7: the settle slid the foot 0.64 m/s at a run)
//   (contact.flight / half back to GRAPH 6's first: hips pulled down harder in a sprint's flight skimmed the feet low and fast over the ground, slip 1.1–1.3 m/s)
//   contact: the boot's lowest point, read off the skinned mesh (a hull of points on each foot / toe bone) — a planted foot is put ON the ground, any foot in
//     the air (kneeling, lying, changing stance: every foot) never under it; on the move the hips come down when even the lower foot floats over
//     flight[0] + flight[1] × (speed − flight[2]) m (a run's own flight left alone) and up when it would go in; hip: the most down / up (m) · half: the hips'
//     spring (s) · max: the most one foot is moved (m) · foot: its spring (s) ·
//   crawl: on his belly the clip plays at one steady rate (his speed ÷ its own) and his body rides the clip's own surge — ahead of / behind the man by what
//     its root has covered beyond / short of him, at most max m, the drift bled off at leak /s (crawling, after) — so the knees and toes stay where they dig in ·
//   upright: the trunk's lean into the gun (BODYFIX.stance) fades out as he tips over (the neck's rise over the hips as a share of the trunk: none under [0],
//     all over [1]) — upside down in the roll it wrapped through ±180° and threw the spine round in one frame ·
//   enemy: the batched infantry's feet placed on the ground and the legs laid to them by IK (actors/soldiers.js strideFit) — g: [from, over] his pace
//     (body units /s) from a walk to a run · duty: the share of a stride a foot stands (walk, run: under ½ both feet leave the ground) · a: half the
//     standing foot's travel as a share of his leg (walk, run), at most aV × pace · reach: the standing leg's longest · lift: the swinging foot's
//     clearance (walk, run; full from moveV) · low: bent low, the hips down / the feet ahead (body units)
export const GRAPHFIT = { on:typeof location === 'undefined' || !/[?&]nofit\b/.test(location.search), reach:{ soft:0.955, max:0.995, let:0.12, heel:0.64 }, land:{ v:[3, 5.5], t:0, tau:0.025 }, release:{ half:0.05 }, hipDrop:true, contact:{ on:true, flight:[0.025, 0.012, 3], hip:[0.12, 0.06], half:0.035, max:0.1, foot:0.02 },
  crawl:{ on:true, max:0.22, leak:[0.3, 2] }, upright:[0.2, 0.5], enemy:{ on:true, g:[1.3, 2.5], duty:[0.5, 0.32], a:[0.36, 0.5], aV:0.34, reach:0.995, lift:[0.06, 0.16], moveV:0.5, low:[0.1, 0.05] } };
// FOE 1 THE ENEMY MOVES LIKE A MAN (actors/foe-bake.js · foe-skin.js · foe-anim.js; ?nofoeanim turns it all off — the nine-joint rig draws every man as before):
//   each enemy rifleman's body is the trooper's own 22-bone skeleton playing the Mixamo library (clips: ~50 of them, retargeted onto him once a battle),
//   driven from what his AI is doing. near: within this many metres of the soldier, the `cap` nearest men on screen get the full graph on the CPU (blend
//   space, stance changes, turns by stepping, layers, inertialized cuts, planted feet); the rest out to TROOPLOD.far are the CROWD — drawn from the baked
//   texture by the GPU (two clips crossfaded over crowdFade s, nothing per bone on the CPU); past TROOPLOD.far the nine-joint rig and its far body (TROOP 1)
//   as before. hyst: a near man's distance counts × this when ranking (he is not handed back and forth). vatW: texels a row of the baked texture.
//   gaits (his metres a second, on his own scale): idle below `still`, the walk / run sets blended by speed, sprint over `sprint`; low: the crouch-walk set
//   up to `lowMax` × its pace, then the run set bent forward by lowLean rad. blend: an inertialized cut's length (s) · turn: still, his legs stay put until
//   the chest is `deg` off them, then a turn-90 clip steps them round (≤ `max`°, `rate` ×) · swing: rad/s at most — the chest and rifle after the aim, the head,
//   the legs; `bearing` the blend space's heading; k its easing · lead: the head at most `max` rad ahead of the chest, `neck` its share · twist: the legs'
//   lag taken back up Spine / Spine1 / Spine2 · tr: the stance clips' play rates (dive: stand → prone through the knee) · layer: an upper-body clip's fade
//   in / out (s) · reloadRate / throwRate / throwLead: the reload clip's fastest rate, the throw's rate and how long before the grenade leaves his hand the
//   swing starts · kick: the rifle's recoil on the arms / chest (rad) and how fast it settles · cover: hidden he sits with his back to it (`yaw` off the
//   enemy), leans out `lean` s before his first round, back `hold` s after his last · signal: the squad's first man points the others on when the plan
//   changes (`cd` s apart, `chance`) · foot: the hips down for the lower foot on a slope (≤ drop), a foot the clip puts down (ankle within lockH of its
//   rest) locked where it landed until lifted or over-reached (reach, his metres), then eased back over `ease` s; the leg never IK'd straighter than `soft`.
export const FOEANIM = { on:!(typeof location !== 'undefined' && /[?&]nofoeanim\b/.test(location.search)), near:40, cap:24, capMobile:8, hyst:0.85, crowd:true, crowdCap:192, vatW:1024,
  groups:['loco', 'stance', 'combat', 'react', 'social'],
  clips:{ idle:'stance-rifle-idle', aimIdle:'stance-rifle-aim-idle-stand', look:'stance-rifle-idle-look-around',
    walk:{ f:'loco-rifle-walk-forward', fl:'loco-rifle-walk-forward-left', fr:'loco-rifle-walk-forward-right', l:'loco-rifle-walk-left', r:'loco-rifle-walk-right', b:'loco-rifle-walk-backward', bl:'loco-rifle-walk-backward-left', br:'loco-rifle-walk-backward-right' },
    run:{ f:'loco-rifle-run-forward', fl:'loco-rifle-run-forward-left', fr:'loco-rifle-run-forward-right', l:'loco-rifle-run-left', r:'loco-rifle-run-right', b:'loco-rifle-run-backward' },
    low:{ f:'loco-rifle-walk-crouch-forward', fl:'loco-rifle-walk-crouch-forward-left', fr:'loco-rifle-walk-crouch-forward-right', l:'loco-rifle-walk-crouch-left', r:'loco-rifle-walk-crouch-right', b:'loco-rifle-walk-crouch-backward' },
    sprint:'loco-rifle-sprint-forward',
    kneel:'stance-rifle-kneel-idle', kneelAim:'stance-idle-crouch-aim', kneelFire:'combat-fire-rifle-crouch', prone:'stance-prone-idle', crawl:'stance-prone-forward', proneFire:'combat-prone-fire-rifle-upper-body',
    toKneel:'stance-rifle-aim-to-kneel', toStand:'stance-rifle-kneel-to-stand', toProne:'stance-rifle-kneel-to-prone', fromProne:'stance-rifle-prone-to-kneel',
    turnL:'loco-rifle-turn-90-left', turnR:'loco-rifle-turn-90-right', kTurnL:'loco-rifle-crouch-turn-90-left', kTurnR:'loco-rifle-crouch-turn-90-right',
    cover:'combat-cover-idle-crouch-against-object',
    reload:'combat-reload-rifle-stand', kReload:'combat-reload-rifle-crouch', pReload:'combat-prone-reload',
    toss:'combat-toss-grenade-rifle-aimed', kToss:'combat-throw-grenade-crouch', pToss:'combat-throw-grenade-prone',
    point:'social-point-forward', onward:'social-charge-point-onward', flinch:'react-hit-react-hold-rifle', knock:'react-knocked-down-to-stomach' },
  gaits:{ still:0.22, sprint:5.3, lowMax:1.7 }, lowLean:0.32, blend:0.24, turn:{ deg:55, max:100, rate:1.25 }, swing:{ chest:4.5, head:9, legs:6, k:10, bearing:5 }, lead:{ max:1.0, neck:0.4 }, twist:[0.35, 0.3, 0.35],
  tr:{ toKneel:1.1, toStand:1.5, toProne:1.7, fromProne:1.6, dive:2.2, knock:1.3 }, layer:{ in:0.18, out:0.28 }, reloadRate:2.2, throwRate:1.2, throwLead:0.35,
  kick:{ arm:0.09, chest:0.035, back:11 }, cover:{ yaw:2.4, lean:0.32, hold:0.7 }, signal:{ cd:7, chance:0.7 }, crowdFade:0.3, foot:{ on:true, drop:0.22, lockH:0.035, reach:0.32, ease:0.24, soft:0.955 } };
// HANG 1 WHAT HE WEARS ON HIS BACK HANGS (actors/hang.js — the slung rifle and the worn blade alike): a damped pendulum in the back's plane from the upper attachment.
//   g: gravity · k: how much of the attachment's own acceleration throws it · len: its lower part's length that swings (share) · ks: the strap's pull back to the rest diagonal
//   (1/s²: √ks ≈ 12 rad/s, a swing settles in about half a second) · z: damping ratio · max: the most it may swing either way (rad) · accMax / lp: the acceleration's cap (m/s²) and
//   smoothing (1/s) · step: the longest sub-step (s)
export const HANG = { on:true, g:9.8, k:1, len:0.6, ks:140, z:0.42, max:0.4, accMax:45, lp:30, step:0.012 };
// BLADE 2 THE WUXIA BLADE (actors/blade.js; ?noblade turns it all off). He always owns ONE blade (PROFILE.blade, `def` when unset): worn on his back while the rifle is in
//   his hands, in his hands while the rifle is slung by CARRY (GUNCARRY's why = 'blade'). Lengths in HIS metres (× scale = his height / 1.8 in the world), angles in degrees,
//   times in seconds of the CLIP unless said (a move plays `rate` × as fast: its real length is (to − from) / rate).
//   draw / sheath: seconds to and from a usable guard · cutAt: how far through the draw (0…1) a cut already asked for may start (the blade is in his hand from 0.3: draw and
//     cut are one motion) · buffer: how long a press waits for the move in hand to let go · hold: the trigger held this long = the heavy · chainT: a light within this many
//     seconds of the last carries the chain on · assist: a cut is aimed at the man about to be reached when he stands within this many degrees of the crosshair ·
//   auto: fire with an enemy within r m and inside cone° of his front draws and cuts in one motion; drawn that way he goes back to the rifle when no enemy has been within
//     back m for wait s, or when he fires with none within keep m · stamina: max, regained /s after delay s, a move started without its cost plays tired × as fast and cuts tiredDmg ×
//   hit: stop = hit-stop s on a solid hit · shake / kick = camera · chip = damage a cut does to cover in its arc · gen = the cap on one cut into a general (his own hit cap stands too)
//   guard: front = what frontal damage is multiplied by (inside arc° of his facing), moveK = his pace while guarding · trail: the ribbon (n points, life s, from mid to tip)
//   edge: the edge leads the cut — as the tip crosses the weapon's line faster than v[0] … v[1] m/s the edge is rolled to face its travel, at most rate rad/s (at rest it lies as his fist has it)
//   body: his body as the weapon must clear it — capsule radii on his own joints (chest, the pack [how far behind the spine, radius], head, hips, thigh, shin) + margin, his metres;
//     the weapon in his hands or on its way is pushed bodily out of them · path: the draw / sheath — a: the share of it his hand takes to reach the weapon where it hangs, via: the
//     point outside his right shoulder [his right, up, ahead of the shoulder joint] it is carried round, clear: the share of the way over which the push-out comes in
//   sever: A MAN CUT DOWN IS CUT APART — max bodies lying severed at once, life s they lie (the last sink s sinking), slide m the upper half slides off along the cut, wait s the
//     other half stands, tip [upper, other] s to go over, cap: the red face's radius by where he is parted (cloth: the colour of its rim); a move's sever: 'waist' (default) | 'neck' | 'leg' | 'none'
//   quiet: THE QUIET WEAPON — a cut is never a shot's noise; a man who does not know (alert < 2) dies by the knife's quiet path, and struck from outside his front dies to any
//     cut (ambush); a wounded man's cry turns his mates within cryR m suspicious; steel on cover is heard clangR m off; started at a sprint or from cover with such a man within
//     dashR m ahead, the cut begins with a dash-in of dashT s (at most dashV m/s); glimpse: with the blade out and no shot fired for shotT s, an unaware man
//     who has him in view makes him out this × as fast (suspicious — a search — long before alerted; out of sight it decays as ever)
//   hand: the grip in his fist — palm: how far along wrist → knuckle the handle crosses, out: the palm's skin off the hand bones' plane (the kind's r, the handle's radius, is added), curl: how far the fingers close
//   A KIND: len / butt / tip / root / edge / back / com are the packed model's own numbers (tools/blade-pack.mjs prints them; z along the weapon from the main hand's grip) ·
//     off: [from, to] the stretch of the handle the other hand holds, m along the weapon from the main hand's grip (− = toward the butt; the guandao's main hand is the one by the blade,
//     the other a metre down by the butt: the axe pack's wide hold) — it closes on the shaft where it already is, within that · two: the weapon lies along the line through both palms (a pole) rather
//     than rigid in the main fist · reach: how far a cut reaches from his centre · worn: on his back, BLADE DOWN, hung from the frog at his right shoulder — at: the frog in the back's own frame [his right, up from
//     the shoulder joint, behind: pressed to the pack], zAt: the weapon's point that sits in it, tilt°: how far its UPPER end (the butt / hilt) leans to his right at rest (the blade
//     goes down across his back to the outside of the left leg), flat: which flat lies on his back (the edge turned away from his leg); it HANGS (HANG: a pendulum in the back's
//     plane); low: [m it rides up, tilt°] crouched, prone: tilt° lying down (level along his spine), clear / shiftMax: the lower end is kept clear m above the ground by riding
//     up to shiftMax m; grab: where along it (m from the grip) his hand takes it to draw · roll: the edge turned this many degrees about the weapon from the way his knuckles face · set: the clips he stands, guards and moves by
//     (speed m/s each was made at comes from the library's index) · THE POLE (two:true) — spread: [at rest, slid right down] m between his hands on it; slide / slideV: how far
//     (m) and how fast (m/s) they slide toward the butt; pose: its line standing (guard), at a run (carry) and blocking, each [where the lead hand's grip is, a point the line runs
//     back through] in his body's frame [his right, up from the hips, ahead] · a move's sl: [from, full by, held to, back by (clip s), how far (m)] the slide through its extension, ext: m the lead hand reaches out along the pole with it · moves: light chain, heavy, run (fire at a sprint), special (the skill key, cd s), counter (fire from the
//     guard), flourish (after a kill with nobody near). A MOVE: clip · rate · from / to: the part played · win: [start, end] of each hit window · arc: [from, to] the bearing
//     the cut sweeps through in that window (0 = straight ahead, + = his left, measured off line on the move as it is played — a spin's arc runs on past ±180; from = to: a chop or thrust, tol wide) · reach (m, replaces the kind's) · y: [lo, hi] the height
//     band against his feet a target's feet must be in · dmg · push (m/s knock-back along the cut) · daze (s he staggers) · st: stamina · next: the earliest a chained move may
//     take over · move: his pace × during it · lunge: metres of step-in toward the nearest target in front (through his own velocity: collision-safe) when its window opens
export const BLADE = { on:!(typeof location !== 'undefined' && /[?&]noblade\b/.test(location.search)), def:'guandao', draw:0.3, sheath:0.3, cutAt:0.45, buffer:0.4, hold:0.3, chainT:0.9, assist:38, fade:[0.09, 0.16], locoFade:0.14,
  auto:{ on:true, r:2.6, cone:75, back:5, wait:2, keep:4.5 }, stamina:{ max:100, regen:28, delay:0.7, tiredRate:0.78, tiredDmg:0.7 },
  hit:{ stop:[0.06, 0.09], shake:[0.22, 0.5], kick:[0.12, 0.3], chip:14, gen:0.34, sparks:6, tol:14 }, guard:{ front:0.45, arc:120, moveK:0.45 },
  trail:{ on:true, n:14, life:0.16, color:0xdfe9ff, op:0.55 }, edge:{ on:true, v:[2.5, 7], rate:30 },
  body:{ chest:0.185, pack:[0.1, 0.17], head:0.14, hips:0.19, thigh:0.115, shin:0.085, margin:0.012 }, path:{ a:0.25, via:[0.42, 0.22, -0.02], clear:0.15 }, hand:{ palm:0.62, out:0.012, curl:0.9 }, runAt:3.6, flourish:{ r:6, wait:0.4, moveV:0.7 }, sever:{ on:true, max:6, life:24, sink:1.5, slide:0.35, wait:0.06, tip:[0.5, 0.5], cap:{ waist:0.2, neck:0.08, leg:0.1 }, cloth:[0.36, 0.33, 0.24], diag:{ neck:0.25, side:0.55, depth:0.6 } }, gore:{ low:0.3 }, palm:{ on:true, under:0.06, diag:[40, 65], from:0.7, cant:0.8 }, front:{ on:true, back:0.12, run:[2.2, 5.0], min:{ guandao:0.6, dadao:0.3 } }, skin:{ on:true, cell:0.03, margin:0.006, blade:0.006, slabs:16, depth:0.12, skip:/Hand|Foot|Toe/, arm:/Arm/ },
  quiet:{ on:true, ambush:true, cryR:10, clangR:10, dashR:5.5, dashT:0.25, dashV:16, glimpse:0.45, shotT:6 }, btn:[18, 250], gbtn:[18, 316],
  kinds:{
    guandao:{ name:'ĐẠI ĐAO (Quan đao)', file:'blade_guandao', len:2.048, butt:-1.049, tip:0.998, root:0.313, edge:0.051, back:-0.085, com:0.157, off:[-1.0, -0.2], two:true, reach:2.55, r:0.019, spread:[0.62, 0.2], slide:0.8, slideV:5.5,
      hold:{ rear:0.33, stand:[[0.2, 0.12, 0.08], 32, 10], run:[[0.2, 0.12, 0.24], 30, 8], sprint:[[0.16, 0.06, 0.28], 42, 4], block:[[0.16, 0.14, 0.14], 52, 0] },
      roll:0, worn:{ at:[0.25, 0.02, 0.2], zAt:-0.35, grab:-0.43, tilt:23, tip:-1, flat:1, low:[0.15, 50], prone:6, clear:0.14, shiftMax:0.6 },
      set:{ idle:'blade-axe-idle', guard:'blade-axe-block-idle', walk:['blade-axe-walk-forward', 'blade-axe-walk-back', 'blade-axe-walk-left', 'blade-axe-walk-right'], run:['blade-axe-run-forward', 'blade-axe-run-back'], runV:2.6, rate:[0.7, 2.2] },
      moves:{
        light:[
          { id:'sweep', sl:[0.5, 0.76, 1.08, 1.45, 0.8], ext:0.16, clip:'blade-axe-attack-horizontal', rate:1.35, from:0.38, to:1.55, win:[[0.77, 1.05]], arc:[-105, 70], y:[-0.6, 1.3], dmg:70, push:5.5, daze:0.7, st:22, next:1.2, move:0.35, lunge:0.9 },
          { id:'rise', sl:[0.66, 0.9, 1.22, 1.6, 0.6], ext:0.08, clip:'blade-axe-attack-backhand', rate:1.45, from:0.5, to:1.75, win:[[0.92, 1.2]], arc:[-78, 20], y:[-0.6, 1.5], dmg:78, push:6, daze:0.75, st:24, next:1.35, move:0.35, lunge:0.8 },
          { id:'chop', sl:[0.46, 0.74, 1.0, 1.35, 0.8], clip:'blade-axe-attack-downward', rate:1.3, from:0.3, to:1.55, win:[[0.76, 0.98]], arc:[0, 0], tol:24, y:[-1.2, 1.8], dmg:120, push:3, daze:1.0, st:28, next:1.15, move:0.25, lunge:1.0 } ],
        heavy:{ id:'spin', sever:'neck', sl:[0.58, 0.82, 1.3, 1.75, 0.8], ext:0.16, clip:'blade-axe-attack-360-high', rate:1.55, from:0.45, to:2.0, win:[[0.83, 1.27]], arc:[-140, -395], y:[-0.6, 1.4], dmg:105, push:8, daze:1.1, st:42, next:1.6, move:0.3, lunge:0.5 },
        run:{ id:'leap', sl:[1.2, 1.5, 1.88, 2.3, 0.7], clip:'blade-axe-run-jump-attack', rate:1.6, from:0.95, to:2.7, win:[[1.66, 1.86]], arc:[0, 0], tol:32, reach:2.1, y:[-1.5, 1.8], dmg:135, push:5, daze:1.1, st:36, next:2.2, move:0, root:true },
        special:{ id:'whirl', sever:'leg', sl:[0.42, 0.64, 1.18, 1.55, 0.7], clip:'blade-axe-attack-360-low', rate:1.5, from:0.3, to:1.8, win:[[0.65, 1.15]], arc:[-172, -372], reach:2.0, y:[-0.9, 1.1], dmg:90, push:9, daze:1.5, st:30, cd:9, next:1.45, move:0.2 },
        counter:{ id:'strike', sever:'none', sl:[0.62, 0.84, 1.17, 1.6, 0.55], clip:'blade-misc-smash', rate:1.7, from:0.5, to:1.95, win:[[0.85, 1.15]], arc:[-105, 12], y:[-0.6, 1.5], dmg:60, push:7, daze:1.3, st:14, next:1.4, move:0.3, lunge:0.4 },
        flourish:{ id:'mua', clip:'blade-misc-spinning', rate:1.5, from:0, to:1.7, win:[], move:0.2 } } },
    dadao:{ name:'ĐAO HAI TAY (Đại đao)', hold:{ stand:[[0.08, 0.2, 0.36], 40, 8], run:[[0.1, 0.2, 0.36], 38, 8], sprint:[[0.08, 0.22, 0.4], 45, 4], block:[[0.06, 0.32, 0.3], 60, 0] }, file:'blade_dadao', len:1.05, butt:-0.275, tip:0.775, root:0.077, edge:0.039, back:-0.124, com:0.303, off:[-0.2, -0.1], two:false, reach:1.45, r:0.022,
      roll:0, worn:{ at:[0.14, 0.0, 0.22], zAt:-0.12, grab:-0.02, tilt:30, tip:-1, flat:1, low:[0, 36], prone:8, clear:0.14, shiftMax:0.2 },
      set:{ idle:'blade-gs-idle', guard:'blade-gs-blocking-2', walk:['blade-gs-walk', 'blade-gs-walk-2', 'blade-gs-strafe', 'blade-gs-strafe-2'], run:['blade-gs-run-2', 'blade-gs-run'], runV:2.6, rate:[0.7, 1.9] },
      moves:{
        light:[
          { id:'cut1', clip:'blade-gs-slash', rate:1.8, from:0.2, to:1.05, win:[[0.63, 0.77]], arc:[-60, 30], y:[-0.8, 1.4], dmg:46, push:2.2, daze:0.35, st:11, next:0.82, move:0.6, lunge:0.6 },
          { id:'cut2', clip:'blade-gs-slash-3', rate:1.9, from:0.42, to:1.45, win:[[0.84, 1.1]], arc:[70, -70], y:[-0.6, 1.3], dmg:50, push:2.4, daze:0.35, st:12, next:1.14, move:0.6, lunge:0.5 },
          { id:'cut3', clip:'blade-gs-slash-5', rate:1.5, from:0.12, to:1.0, win:[[0.37, 0.58]], arc:[-45, 30], y:[-0.6, 1.3], dmg:68, push:3.2, daze:0.55, st:15, next:0.64, move:0.5, lunge:0.6 } ],
        heavy:{ id:'power', sever:'neck', clip:'blade-gs-slash-4', rate:1.5, from:0.25, to:1.45, win:[[0.72, 1.02]], arc:[-230, -456], y:[-0.6, 1.4], dmg:92, push:4.5, daze:0.8, st:30, next:1.1, move:0.3, root:true },
        run:{ id:'slide', sever:'leg', clip:'blade-gs-slide-attack', rate:1.6, from:0.5, to:1.95, win:[[1.1, 1.68]], arc:[-114, 236], y:[-1.0, 1.3], dmg:74, push:3.5, daze:0.7, st:24, next:1.75, move:0, root:true },
        special:{ id:'jump', sever:'diag', clip:'blade-gs-jump-attack', rate:1.5, from:0.4, to:2.0, win:[[1.0, 1.48]], arc:[174, 404], reach:1.6, y:[-1.6, 1.8], dmg:125, push:4.5, daze:1.2, st:28, cd:7, next:1.6, move:0, root:true },
        counter:{ id:'riposte', clip:'blade-misc-stable-sword-outward-slash', rate:1.7, from:0.55, to:1.5, win:[[0.85, 1.0]], arc:[-72, 32], y:[-0.6, 1.4], dmg:58, push:3, daze:0.6, st:12, next:1.05, move:0.5, lunge:0.4 },
        flourish:{ id:'pose', clip:'blade-misc-stable-sword-inward-slash', rate:1.5, from:0.7, to:2.0, win:[], move:0.3 } } } } };
// BLADE 15 THE BLADE'S MENDS (actors/blade.js). wrist: each fist on the handle is picked for the straightest wrist (blade.js fistPick) — knuckles up
//   or down the handle, turned round it off the palm's way by at most roll° (n steps a side; only past lim° of bend does it pay: kRoll per rad of roll), the other way round
//   taken only when hyst° better (pref° for the other than grip's [left, right] way), the roll [guandao, dadao] and the turn of the fist eased at rate rad/s in the weapon's frame;
//   on false: BLADE 14's pick (the way round whose straight elbow the upper arm reaches) · rifle: the slung rifle (blade in hand) kept out of his skin (actors/blade.js,
//   by its real shape, turned out about the sling's upper end) · worn: the worn blade lies in the plane of his whole back — 'up' the chord from the `from` joint to the neck (× chord;
//   prone, × line toward the neck → knees line), lying prone it slides slide[kind] m down his back ([guandao, dadao]); crouched low[kind] = [ride up m, tilt°] (instead of
//   BLADE's own low); its swing × sway[kind]; what his skin pushes it out by is taken at once and given back at release /s (kept in the back's frame)
// BLADE 16 free: the dadao's left hand lets go in a cut when the hilt is farther from its shoulder than
//   reach × the arm's length or its wrist would bend past bend° (eased in at go /s, back at back /s), and comes to his chest at at [his right, up, ahead] m off Spine2, curled curl
export const BLADEMEND = { wrist:{ on:true, grip:[-1, -1], pref:15, hyst:30, lim:60, roll:[55, 90], n:4, kRoll:1, rate:40 }, rifle:{ on:true }, free:{ on:true, reach:0.97, bend:95, go:10, back:4, at:[-0.1, -0.1, 0.28], curl:0.6 }, worn:{ on:true, from:'Hips', chord:1, line:1, slide:[0.6, 0], low:[[0.05, 58], [0, 36]], sway:[1, 0.5], release:5 } };
// AMBUSH 1 THE BLADE DOES NOT GIVE HIM AWAY — HIT AND RUN FROM COVER (game/ambush.js; the blade's own numbers stay in BLADE.quiet). Noise and sight are two rules:
//   noise: a swing, a cut and a silent kill make NO sound an enemy acts on. What does carry only makes men SUSPICIOUS (they turn and come to look), never alerted:
//     steel really striking cover (BLADE.quiet.clangR m — and only when the blade's arc truly meets the block: touch = how many bearings × radii of the arc are tried),
//     a wounded man's cry (BLADE.quiet.cryR), the death cry of a man who already knew (cryR again), his own sprint with the blade out (stepR m instead of AWARE.hear.run — under BLADE.quiet.dashR, so a dash-in can
//     begin before he is heard; the dash-in itself is not heard). A staggered man cannot shout until his daze is over (shoutDazed false).
//   sight: rear = what an unaware man makes out BEHIND him (× the player's visible range; AWARE.see.rear's 0.16 let a man 6–9 m behind his back be sensed) — now only
//     AWARE.see.near, the arm's-length sense, works there. witness: who SEES a blade kill is alerted at once — within r m (× night at full dark) in his front cone,
//     side × r on his flanks, and only with a clear line to the body (bodyY m off the ground); a man within near m who was not looking hears him fall and turns (suspicious). Nobody else knows.
//   flat: the man an ambush is begun on from outside his front is caught flat-footed — he senses nothing for the dash, the cut's wind-up and flat s more (he cannot
//     turn in a quarter second), and nobody dives out of the way of a man they do not know is coming.
//   dash: the dash-in homes on the man and pulls up at stop × the weapon's reach from him (no running through him), may run over s past BLADE.quiet.dashT when a corner
//     slides him off line (the cut waits for it); auto: with the RIFLE in his hands, sprint (or low cover) + fire with an unaware man within dashR draws and dashes.
//   body: a body is found only with a clear line from the finder's eyes (eyeY) to it (los) — never through a wall; a man cut apart lies as ONE body, to be found for as long as he lies (BLADE.sever.life).
//   squad: while the blade is out and nobody within the eye's reach is alerted his own men hold their fire and an enemy who does not know does not pick them out either (hold) — the first alerted man ends it. say: what he reads. net: a co-op guest's cut is a
//     report with weapon number w in its low 6 bits (no gun's) that carries a move's code and the place he claims — never damage. The host judges it on its OWN facts:
//     perS cuts a second (burst at once: a sweep through several men spends one each), the claim within posTol m of the host's place for him, the man within the move's
//     reach × reachK + the dash-in + slack m of that place, the blade's stance bit up for BLADE.draw s, the damage from the host's own move table.
export const AMBUSH = { on:true,
  noise:{ stepR:5, touch:[5, 2], shoutDazed:false }, see:{ rear:0.05 }, witness:{ r:26, side:0.5, near:3, night:0.5, bodyY:1.0, err:3 }, flat:0.3,
  dash:{ stop:0.6, over:0.2, auto:true }, body:{ los:true, eyeY:1.6, y:0.4 }, squad:{ hold:true },
  say:{ seen:'BỊ NHÌN THẤY!', quiet:'ĐAO IM LẶNG — ĐỊCH KHÔNG NGHE THẤY', tip:['mute', 'Đao là vũ khí im lặng', 'Đao <b>không gây tiếng động</b>: chém không làm lộ vị trí như tiếng súng. Nấp sau đá hay công-ten-nơ, giữ <b>chạy nhanh</b> rồi <b>bắn</b> khi địch chưa hay biết ở trong tầm vài mét — anh <b>lao ra, một nhát hạ gục</b>, rồi lùi về chỗ nấp. Chỉ kẻ <b>nhìn thấy</b> nhát chém hoặc cái xác mới báo động.'] },
  net:{ w:63, perS:3, burst:4, posTol:6, reachK:1.2, slack:3 } };
// SKIN 1 the soldier's body mended offline (tools/skin-repair.mjs — not read by the game). Every length is in millimetres of a 1.8 m soldier.
//   snap / crack: a border point this close to another shell's surface is laid on it / two border points this close are welded · sealed: "resting on another shell" for the counters
//   holePerim / holeMax: closed border loops up to this round (and this many edges) are capped · fin*: non-manifold fans removed when hidden (≤ finHidden triangles) or tiny (≤ finTris, ≤ finArea mm²)
//   capArea: a flat cap across the trunk or a limb, hidden at rest and larger than this (mm²), is removed (it swings out when the joint bends) — OFF (1e9): with the puppet of POSE 1 the lids stay in, and taking them out shows more of the hollow behind them than they hid
//   buried: a whole shell is an inner layer, and removed, when this share of the rays cast from its faces end on other shells
//   bodyVote: a shell is BODY when it is the first surface met by this share of the rays cast from the bone axes · reach: how far gear looks for the body under it · contact: resting on it
//   slideMm / stretch: a gear shell is mended when its contact pairs spread more than this in a test pose, or its own edges stretch more than this · stretchMm: mm of spread one unit of stretch is worth · tear: an edge stretched past this × its length in a test pose has its end points' weights evened out (gear only; undone if the contact pairs' spread grows by more than tearCost mm, and never moving a point more than tearMove mm) · tornW: mm of spread one torn edge is worth · liftW: mm of spread one mm of lift off the trunk is worth · stretchCap: no new weights may stretch a shell past this (or 1.25 × what its own did)
//   compact: only pieces smaller than this may become one stiff blend / one joint · under: a joint the body under a shell uses less than this is a stray joint · clavCap: the most the two collar-bones together may carry of trunk kit re-weighted from the body ·  stray: islands of a joint's weight (above each of these levels) cut off from where the joint rules are taken out · touch / rimTouch: shells this close are tied · tuck: a body point this deep inside another body shell moves wholly with it
//   ways: the new weights a sliding gear shell may be offered — 'trunk' (its own, on the trunk's joints alone: for kit worn on the trunk), 'clean' (its own, stray joints out), 'body' (the surface under it), 'half', 'stiff' (one blend), 'joint' (rigid on its own main joint: a plate or a pouch is a stiff thing).
//         'clean', 'body', 'half', 'trunk' are offered (never one that tears more of the shell's own edges, or lifts it liftStep farther off the trunk, than its own weights did): the others score better on the gap counter but move pouches about in ways the pictures show as worse than the fault
//   kit: what every piece of kit worn on the trunk gets, sick or not — 'trunk' (collar-bone weight moved to the top of the spine, arm and leg weight out), 'joint' (rigid), '' (only the sick ones, by the sum)
//   hem: (off) a border edge standing min … reach off another shell is joined to it by a dark strip (stretches of at least minEdges edges and minLen; in the colour of the cloth under it unless darker than minLum of 255), `reserve` triangles kept for it
//   liner: ring spacing, fit (share of the sounded radius), inset, thinner by `joint` at elbows and knees, sides per tube, pull-in factor / rounds / rebuild passes, eps (outside by more than this is a poke), views × viewPx: the directions and tile size of the eye check, margin: how far behind an outward face it must stay, `reserve` triangles kept for it
//   deep: in the pictures a back face counts as the INSIDE OF A HOLLOW unless an outward face, a hem or the liner lies within this behind it (then it is the reverse of a sheet)
//   liftNear / liftMax: the LIFT counter follows every kit point that rested within liftNear of the body; more than liftMax farther off in a pose is a strap or a pack that has left him; no weight change may lift a point liftStep more than it stood
//   budgetTris / budgetBytes: the repaired file may grow by at most this
export const SKINREPAIR = { snap:4, crack:2.5, sealed:0.6, holePerim:150, holeMax:28, finTris:10, finHidden:40, finArea:60, capArea:1e9, buried:0.97, bodyVote:0.01, reach:200, contact:3, slideMm:15, smooth:30, stretch:0.8, stretchMm:30, liftW:1, tornW:0.5, stretchCap:1, tear:2.5, tearCost:2, tearMove:40,
  compact:260, under:0.08, clavCap:0.3, trunkOnly:false, relax:0.5, stray:[0.02, 0.12], touch:5, rimTouch:15, tuck:12, hardDeg:60, ways:['clean', 'body', 'half', 'trunk'], kit:'', hem:{ on:false, min:2, reach:30, minEdges:3, minLen:60, minLum:70, reserve:500 }, liner:{ step:55, fit:0.85, inset:5, joint:0.6, sides:{ torso:10, arm:6, leg:7 }, shrink:0.8, rounds:10, passes:6, eps:0.5, views:22, viewPx:320, margin:4, reserve:800 }, deep:60, liftNear:30, liftMax:30, liftStep:10, budgetTris:0.08, budgetBytes:0.10 };
// BODY 1 THE SOLDIER'S BODY ROUND AND UPRIGHT (the player's Tripo soldier; tools/skin-repair.mjs, src/actors/puppet.js, src/actors/soldier-upper.js).
//   rig (offline, tools/skin-repair.mjs addTwist — soldier2.glb only): limbs = per arm / leg bone the twist joints added as its children: n joints laid
//     along bone → end, the bone's weight handed along them between `from` and `to` (shares of the bone's length: before `from` the bone itself, at `to`
//     the last joint — the whole roll); cuts = where the long triangles of that limb are cut into rings (shares of its length), a triangle counting as
//     long past `long`, an edge not cut within `gap` of one of its ends (no slivers), only skin within r × the bone's length of its axis; round = how
//     many times the edges running round the limb are then halved (those between span[0] and span[1] of its length, longer than `edge` mm of a bone
//     `mm` long, slanted along the bone by less than `slant` of their length); a new point is lifted lift × the way to the surface its two ends'
//     normals describe, round the limb only (at most liftMax of the edge's length across the bone): the forearm's round section back;
//     hang = belt kit weighted to a thigh (≥ thigh of its weight, ≤ maxVerts vertices, its middle no more than `top` and its lowest point `span` down the
//     thigh, shares of its length) is hung from the hips: thigh weight 0 above at[0], rising to `max` at at[1] down the thigh
//   twist (src/actors/puppet.js limbs — a limb whose file has twist joints): max = the most of the hand's roll laid along the forearm (rad: a man's
//     pronation / supination; the rest stays at the wrist), wrap = the roll is read on from the last frame until it passes this (rad), then afresh;
//     swivel = after the gun hold an arm whose hand is rolled more than lim rad on its forearm, or whose upper arm more than root rad at the shoulder,
//     has its elbow swung round the shoulder → wrist line until both carry the same share of their limit (eased in over `soft` past it, at most max
//     rad) — on:false keeps the elbow where the hold's pole put it
//   hold (src/actors/real-cav.js holdReal, on his feet): poleL = where the support arm's elbow is sent [up, to his right, ahead] of the shoulder (m) —
//     under the gun, not out to his left: out there the hand had to be rolled 120° and more on the forearm to lie under the handguard
//     freeRoll = reloading, the left hand (off the gun: the magazine is drawn where its palm is) is rolled no more than this on its forearm (rad)
//   stance (on his feet, not lying): lean = the line hips → neck is kept between lean[0] and lean[1] rad forward of upright IN THE AIM'S FRAME (kneeling
//     up to `kneel`, running — between runV m/s — up to `run`), and `roll` of any lean to one side is taken out (actors/soldier-upper.js trunkLean:
//     gain × the error over the three spine joints, iter passes, eased in / out at rate /s); stood still his hips ride `hips` m ahead of the middle of
//     his feet (over the front foot) and `tall` × his leg higher (actors/soldier-legs.js: the knees only just bent)
export const BODYFIX = {
  rig:{ models:['soldier2'], mm:240, limbs:[{ bone:'ForeArm', end:'Hand', n:3, from:0.12, to:0.96, cuts:[0.26, 0.4, 0.54, 0.68, 0.82], long:0.22, gap:0.045, r:0.45, round:2, span:[0.18, 1.02], edge:14, slant:0.45, lift:0.75, liftMax:0.22 }],
    hang:{ thigh:0.9, top:0.06, span:0.2, at:[-0.05, 0.15], max:0.3, maxVerts:1500 } },
  twist:{ max:1.5, wrap:4.6, swivel:{ on:true, lim:1.3, root:1.3, soft:0.3, max:0.6 } },
  hold:{ poleL:[-0.5, 0.35, 0.15], freeRoll:0.6 },
  stance:{ lean:[0.1, 0.16], kneel:0.26, run:0.33, runV:[2.4, 4.4], roll:0.8, gain:1.4, iter:2, rate:6, hips:0.04, tall:0.025 } };
// BODY 4–8 THE SOLDIER'S LIMBS KEEP THEIR OWN SKIN, THE HANDS SIT ON THE GUN AS A MAN'S DO (tools/skin-repair.mjs cleanBleed — soldier2.glb;
//   src/actors/puppet.js, src/actors/real-cav.js).
//   bleed = per limb (both sides) the weights the auto-rigger let run across from what it rests against: a vertex within r × the bone's length of limb →
//     end, between t[0] and tMax of its length, carrying `foreign` weight (bone names, or 'other': the OTHER leg) is sorted by the way its normal faces:
//     out from the limb's axis (more than `face`) it is the limb's own skin — the foreign weight goes to the limb's bones (in the share they hold);
//     facing the axis (less than −face) it is the surface beside it — the limb's weight goes there (only where that already holds more); one call a
//     welded place, smoothed `smooth` (3) times over its neighbours, eased in from t[0] to t[1] (the groin keeps its blend). The inner thighs carried
//     0.1–0.5 of the other leg. shell = only big shells (this many welded points or more) are cleaned: gear (a pouch, a strap, a sleeve piece) keeps
//     the weights the gear step gave it (the left upper arm's 0.3–0.4 of the spine sits on such pieces: left as it is)
//   wrap = the hand's roll on its forearm is read on from the last frame only up to this (rad; then afresh): read on to 4.6 rad (BODY 1) a roll that had
//     gone past 180° in a reload stayed "+219°" when the hand was back on the gun at −141°, and the elbow was swung the wrong way (rolled 140–160°)
//   swivelWrist = the elbow's swing (BODYFIX.twist.swivel) is cut back until the wrist under the hand it turns bends no more than this (rad), or no more
//     than it already did: the swing turns the forearm under a hand that stays on the grip (AK, shotgun, GL, MP5 right wrist 61–73° → ≤ 55°)
//   collar = lying down, a collar bone raised more than this (rad) over the chest → neck line is lowered to it before the arms go on the gun (the prone
//     clip shrugged the support shoulder 48° up: a hump, and the support hand rolled 120° to reach the handguard; at rest it sits 5° down)
//   rideWrist = on the horse and on the pillion the hands are laid on the gun as on foot — the wrists give toward the forearm (GUNFEEL.hold.wrist) and
//     the index finger goes to the trigger (actors/gun-hands.js): both wrists stood bent 79–83°, the finger 18 cm off the trigger
export const BODYMEND = {
  bleed:[{ limb:'UpLeg', end:'Leg', own:['UpLeg', 'Leg', 'Foot'], foreign:'other', t:[0.06, 0.25], tMax:1.0, r:0.45, face:0.25 }],
  shell:1500,
  wrap:3.39,
  swivelWrist:0.96,
  collar:0.1,
  rideWrist:true };
// BODY 10 THE SOLDIER WHOLE IN EVERY POSE: NO SKIN THROUGH THE SLEEVE, NO PAD OR POUCH LIFTED OFF HIM, THE UPPER ARM ROLLED ALONG ITS LENGTH, THE EYE ON
//   THE SIGHTS IN THE SADDLE, THE SUPPORT HAND ON THE B41 AS IT IS LOADED (tools/skin-repair.mjs addTwist / followBase — soldier2.glb; src/actors/puppet.js,
//   src/actors/real-cav.js, src/actors/gun-reload.js).
//   rig.limbs = twist joints laid as BODYFIX.rig.limbs lays the forearms', here on the upper arms; counter = the joints turn AGAINST the bone's roll (the
//     first, at `from` of its length, by all of it; none at `to`): the shoulder's end of the sleeve stays where the shoulder is, the elbow's end goes with it
//   follow = what lies on the body moves with it. The body layer = the pieces rays from the bones meet first; gear = the rest (pieces of up to `rigid`
//     points, mostly ruled by `bones`): each of its points takes the weights of the nearest point of the body on its outer side within `gear` mm — only the
//     bones of the part it sits on (trunk / each arm / each leg: the part whose bones' line is nearest its middle, `girth` × his height each; the thigh's
//     line from legFrom down it) — evened out over the piece in `even` passes. Skin of the arm (`cover` bones) under another piece of the body within
//     `reach` mm (the forearm in the rolled sleeve; facing it by cos ≥ face) takes the cover's weights, eased out over `smooth` rings. collar = a body piece
//     whose middle is within r × his height of the neck joint hands k of its collar-bone weight to the chest. waist = the body's (and the liner's) points
//     from waist[0] to waist[1] × his height above the hip joints hand their thigh weight to the pelvis, eased in (the trousers' waist under the belt)
//   twist.upper = the upper arm's roll on its shoulder (from rest) laid along its counter joints: `keep` of it stays at the shoulder's end, the elbow's end
//     takes all of it; no more than max rad is countered; read on from the last frame as BODYMEND.wrap
//   ride = on the horse and the pillion the cheek is laid on the stock as on foot (actors/real-cav.js: the head bowed / tilted within his range, then the gun
//     brought the rest of the way, GUNFEEL.hold.cheek): the eye stood 10–11 cm off the sight line
//   tube = loading the B41: the left hand takes the rocket at `pouch` [his left, up, ahead] of his chest (m) — by the tube — instead of GUNHOLD's own (by
//     his belt, 30 cm off the tube); palm = the palm, not the wrist, is put on each point of the reload (it stood a hand's length short of the muzzle)
export const BODYFULL = {
  rig:{ limbs:[{ bone:'Arm', end:'ForeArm', n:3, from:0.08, to:0.9, counter:true }],
    follow:{ reach:22, gear:40, even:6, girth:{ trunk:0.09, arm:0.035, leg:0.06, legFrom:0.25 }, rigid:1500, smooth:2, face:0, bones:['Spine', 'Spine1', 'Spine2', 'Shoulder', 'Arm', 'ForeArm', 'Hips', 'UpLeg'], cover:['Arm', 'ForeArm'], collar:{ r:0.07, k:0.8 }, waist:[0.02, 0.05] } },
  twist:{ upper:{ keep:0.25, max:1.4 } },
  ride:true,
  tube:{ pouch:[0.0, -0.05, 0.22], palm:true } };
// SPLIT 1–3 RUNTIME PERFORMANCE (plan A1 · A6 · A9): the sun's shadow in a still part drawn once + the movers every frame, nothing uploaded in a fight's first seconds, three quality levels + one down after a crashed load
export const PERF_SPLIT = {
  // A1 render/shadow-split.js (off unless on / ?split — SPLIT 4: no GPU gain measured, +1–4.5 ms CPU): re-centre the box `step` m off (and `pad` m wider) · a caster still for `settle` frames joins the still part (doubled, up to settleMax, each time it moves again)
  //   · the still part is drawn again ≥ minGap s after something in it changed, ≥ promoteGap s for newly still ones · edited twice inside editWin s = it moves · casters re-listed every `rescan` frames
  shadow:{ on:false, step:3, pad:1.5, settle:20, settleMax:600, minGap:0.2, promoteGap:1.5, editWin:2, rescan:30 },
  // A6 render/fight-warm.js: the battlefield's maps the GPU does not hold yet, uploaded during the 3-2-1 only — ms of work a frame; what rises at GO compiled then, its models awaited ≤ propWait s · render/perfhud.js PH.long: a fight's frames over hitchMs (hitchKeep kept)
  warm:{ on:true, ms:6, propWait:1.5 }, hitchMs:50, hitchKeep:24,
  // A9 render/quality.js: Thấp / Vừa / Cao — top render scale (desktop / phone), the occlusion pass, the sun's map size (0 = SHADOW_MAP), light shafts, × LOD.detailPx
  tiers:{ low:{ dpr:1, dprPhone:0.8, ao:false, shadow:1024, shafts:false, detailK:1.6 },
    medium:{ dpr:1.25, dprPhone:1.25, ao:false, shadow:0, shafts:true, detailK:1.25 },
    high:{ dpr:2, dprPhone:2, ao:true, shadow:0, shafts:true, detailK:1 } },
  // a load that never finished (the note still in localStorage[key] at the next start) → one level down; the note goes once the fight has run okS s; the notice stays sayS s
  crash:{ on:true, key:'xk.loading', okS:4, sayS:7 } };
// HUDCLEAN 1 — nothing about the ride or a fort's name in the middle of the view (game/ride-call.js, game/cavalry.js, game/ride-wear.js, game/horse-swim.js,
//   world/fortress.js, game/player-damage.js):
//   chip = the ride's one status line (was a pill above the gun bar and toasts over the soldier): a small chip at the screen's lower left, above the camera
//     buttons — an icon, 2–4 words, a hairline ETA bar while he comes. desk / touch = its corner offsets (px); noteT = how long a ride note (XE CHẾT MÁY,
//     CHẠY CHẬM LẠI…) holds the chip, s; idleT = after so long with nothing new it sinks to op.idle (op.touch on a phone, where it is also the call button);
//     op.live = while he is called, held up or a note shows
//   fort.label = the fort's name floating over its keep (false: gone — the fort list, the radar and the boss bar carry it); fort.plaque = the gilded name
//     on the gate's name stone (false: the stone stays blank); fort.wake = the alarm as you come near: a small line at the top edge (size px, hold s,
//     fadeIn s) in place of the big banner
export const HUDCLEAN = {
  chip:{ desk:{ left:14, bottom:62 }, touch:{ left:12, top:156 }, noteT:2.6, idleT:3, op:{ idle:0.42, touch:0.62, live:0.86 } },
  fort:{ label:false, plaque:false, wake:{ size:10, hold:3.2, fadeIn:1.5 } } };
// HUDCLEAN 2 — the fight's own words off the line of sight (game/score.js, game/player-damage.js, game/loop.js, world/fortress.js, ui/medals-ui.js):
//   combo.lineT = how long the small "+240" / "HẠ TỐP TRƯỞNG" holds beside the ×N on the score bar's right, s (the LIÊN HOÀN banner and the +score pops
//     over the enemy are gone; the multiplier is a small "×4" by the score)
//   banner.bigHold = the big centred banner, kept only for the rare moments (a general / boss down, a fort taken, the battle won — showBanner(…, true)), s;
//     banner.miniHold = every other banner: one small line under the score bar, no plate, no pop, s
//   chiefLabel = a fort commander's name floating over his head (fort modes without the boss; false: gone — the boss bar and the fort list carry it)
//   medal.touchHoldK = on a phone a medal is a compact chip at the top right, held this share of MEDALS.toast.hold
export const HUDCLEAN2 = {
  combo:{ lineT:1.1 },
  banner:{ bigHold:1.1, miniHold:1.6 },
  chiefLabel:false,
  medal:{ touchHoldK:0.55 } };
// DIET 1–3 resource diet (render/asset-diet.js, tools/asset-diet.mjs): KTX2 maps read compressed (ktx2: off = every texture reads its fallback picture),
//   the vendored Basis transcoder and meshopt simplifier (basis, simplifier: the shells run offline), the test file's time limit, transcoder workers
//   A3 treeFar: past `at` m (stretched as the camera pulls back) a tree wears its species' phone copy (dir) when that has at most `max` × its triangles
//   DIET 4 drop: a KTX2 map's CPU copy is dropped once it is on the GPU (and the parsed files' buffers once built; refilled from the file when needed), pxHold: s the fallback pictures are kept
//   DIET 9 pxFrom: the files whose colour maps' small pictures are read in the page (trees' leaf masks; any rigged body: its shirt colour) — no other file decodes them
//   DIET 6 offThread: render/far-lod.js welds and simplifies in a worker (one big geometry held a frame 690 ms)
export const ASSETDIET = { ktx2:true, basis:'assets/lib/basis/', simplifier:'assets/lib/meshopt/meshopt_simplifier.module.js', workers:4, probeMs:8000, offThread:true, pxFrom:['/tree/'], drop:!(typeof location !== 'undefined' && /[?&]nodrop\b/.test(location.search)), pxHold:20,
  treeFar:{ on:!(typeof location !== 'undefined' && /[?&]notreefar\b/.test(location.search)), dir:'assets/models/real/tree/m/', at:80, max:0.6 } };
