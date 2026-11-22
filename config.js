// ============================================================================
// STEEL SIEGE — CONFIG / BALANCE  (single source of truth for tuning + economy data)
// Plain ES module: imported by index.html (browser) AND test.js (node, zero-deps).
// Edit numbers HERE — keep LEVELS.md in sync. No Three.js/DOM deps (pure data).
// ============================================================================

// ----- BALANCE: every tunable knob in one place -----
export const BALANCE = {
  // NG+ loop escalation: per-loop multipliers (loop 0 = first run)
  loop:   { hp:0.45, dmg:0.22, boss:0.55, reward:0.6, bossDia:1 },
  // boss HP = def.hp × (1 + (stage-1)·stageRamp) × flat × loopBossMul
  boss:   { stageRamp:0.18, flat:0.9, coinBase:150, coinPerStage:90, dia:2 },
  // earning
  coinBountyDiv:10,        // coin per kill ≈ enemy.score / this
  stageClearCoin:60,       // × stage on clearing a stage
  // drop table (per loot pickup); loot spawn chance on bricks/enemies
  drop:   { brick:0.18, enemy:0.16, gem:0.06, gun:0.45 },
  // waves
  wave:   { base:3, perWave:1, perStage:1.5, perStageCount:5,
            capBase:5, capPerStage:1.5, cadence:1.15, cadenceDiff:0.4,
            eventChance:0.34, assaultCadenceMul:0.5, assaultCapBonus:4, hordeMul:0.5 },
  // elite enemies
  elite:  { chancePerStage:0.025, chancePerLoop:0.06, capChance:0.25,
            hpMul:2.6, sizeMul:1.0, dmgMul:1.3, coinMul:3, dia:1 },
  // shop upgrade per-level effects (used by applyUpgrades)
  up:     { damage:0.08, boss:0.12, range:0.10, reload:0.12, mag:0.15, hp:20, armor:0.06, engine:0.10, turbo:0.12, ramplate:0.25, ramguard:0.12 },
  // gun MASTERY: each duplicate gun pickup = +1 xp; cross a threshold → that gun levels up (1→4, permanent).
  // Higher level = more damage, faster fire (lower fireCd), faster reload. Long grind: ~12/15/18 dups per level.
  mastery:{ xp:[0,12,27,45], maxLevel:4, dmgPerLevel:0.10, fireCdPerLevel:0.06, reloadPerLevel:0.08 },
  // ARTILLERY LOCK strike (stage≥2 mortar barrage): locks your spot → red ring warns → arcing missile slams in.
  // Dodge window = lockTime+flightTime (move out of `radius`). Damage falls off by distance: bullseye = dmgMax, edge = dmgMin, outside = 0.
  // Designed dodgeable: player base maxSpeed 26 clears radius 6.5 in ~0.25s, far under the ~2s window — threat is REACTION + barrage density.
  artillery:{ radius:6.5, innerFrac:0.4, dmgMax:32, dmgMin:8, coreMul:0.5,
    lockTime:0.9, flightTime:1.2, gravity:38,   /* Z218 a higher, plunging arc */
    warnLead:1.3, restMin:5, restMax:8, shotSpacing:0.65, shotsBase:2, shotsPerMortar:1, shotsMax:6 },
  // enemy AGGRESSION & ACCURACY — both ramp with stage (diffScale 0→1 over S1→S5) and NG+ loop.
  // fireChance = how proactively they shoot (early = hesitant, late = relentless); spread shrinks → far more accurate late.
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
  // SUPPORT DRONE (power-up): a 22s orbiting escort with a gatling. It is a HELPER, NOT a primary weapon —
  // low per-round damage (chips HP / finishes weak foes; it takes MANY rounds to down a tank), a slow cadence,
  // a small belt and a DELIBERATELY long reload so the player can't lean on it to win fights. It auto-acquires the
  // nearest enemy inside `detect` (reaches beyond the player). NOT invincible — enemy fire crossing its orbit
  // chips `hp`; at 0 it detonates. Sustained DPS ≈ mag·dmg / (mag·fireCd + reload) ≈ 5 (≈ a fraction of the tank's).
  // `fireRot`/`idleRot` = gatling barrel spin (rad/s) when firing vs idle (the "nòng xoáy").
  drone:{ guardR:44, guardHit:0.55, strikeR:3.4, strikeFireR:14, dur:22, orbit:4.8, height:3.0, detect:26, hp:120, dmg:6, bspeed:78,
          mag:6, fireCd:0.4, reload:5.0, fireRot:18, idleRot:6, hitR:1.0 },
  // SUPPORT-UNIT upgrades (shop). DRONE: owning `dronePow` L1 deploys a permanent escort gunship each stage;
  // each level scales its stats. GUARDS: reload/armor tracks on top of the existing count (`guards`) + power (`troops`).
  // per-level effect: power = +damage, rof = −reload/fire-cooldown (multiplicative, floored), arm = +flat HP.
  support:{ dronePowPerLvl:0.12, droneRofPerLvl:0.10, droneArmPerLvl:40,
            guardRofPerLvl:0.10, guardArmPerLvl:18, mulFloor:0.4 },
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
  CRYO: { L:1.00, M:1.00, H:0.85, A:0.90, struct:0.5, label:'CRYOGENIC', vi:'BĂNG' },
  ELEC: { L:1.00, M:1.10, H:1.00, A:1.25, struct:0.4, label:'ELECTRIC', vi:'ĐIỆN' },
  HESH: { L:1.00, M:1.25, H:1.05, A:0.60, struct:3.0, label:'HESH', vi:'PHÁ CÔNG SỰ' },         // squash-head: spalls medium armour, levels cover & towers
  TBX:  { L:1.40, M:1.10, H:0.70, A:0.80, struct:1.8, tower:2.2, label:'THERMOBARIC', vi:'NHIỆT ÁP' },   // Z81 fuel-air: wrecks crowds, infantry & bunkers; poor vs heavy armour
};
export const ARMOR = { chief:'M', scout:'L', bomber:'L', gunner:'L', grunt:'M', mortar:'M', sniper:'M', carrier:'M', shield:'H', heavy:'H', boss:'H',
  rifle:'L', rpg:'L', engineer:'L', pyro:'M', atgm:'M', gunship:'A', heliBomb:'A', heliTroop:'A', launcher:'L' };   // Z116 the rocket truck is soft-skinned   // A = aircraft (Z80): only direct fire / flak / missiles reach it
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
export const LOCKON = { cone:1.2, minP:9, allyR:3.2, range:42, clear:1.5, look:[5,30] };   // Z221 the lock-on seeker: looks ±cone rad round its flight line, never picks a mark within minP m of our tank or allyR m of our men
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
export const UNDERBASE = { off:170, W:75, D:55, gate:{ lockHp:[380,80], turretHp:300, turretR:24, turretCd:[0.09,1.5], turretDmg:3, burst:8, guards:[5,1], tanks:[1,0.5] },   // Z403 gate MG turretR 36 → 24 m (a rifleman's reach)
  hp:{ inf:520, veh:620, ammo:420, power:800 }, cut:{ inf:0.17, veh:0.17, ammo:0.1 }, spawn:{ squad:[20,26], tank:[38,48], maxTanks:3 }, lights:{ desk:8, mob:3, I:50, range:34 }, score:{ target:400, all:2000, lock:300 } };
export const REAL = {
  concuss:{ reach:2.2, t:[0.9,1.9], push:7 },                   // a blast's survivors within r*reach are thrown flat and dazed t s, shoved push m/s
  tracer:{ every:3, enemy:0x6dff4a, ally:0xff5a2a },             // every Nth round a tracer: theirs burn green, ours red-orange
  brass:{ R:44 },                                                // spent casings only near the player (cheap)
  death:{ fwd:0.3, spin:0.22, crawl:0.16 }, crawl:{ t:[3.2,5.5], sp:0.42 },   // small-arms death: fall forward / spin down / crawl wounded, else back
  look:{ h:[0.93,1.07], w:[0.93,1.08], tint:[0.8,1.1] },         // no two men the same height, build or shade of kit
  shock:{ minScale:1.0 },                                        // blasts this big send a dust skirt racing out along the ground
  surprise:{ first:[60,85], every:[50,90], from:{ mortar:1, ambush:1, armour:2, vbied:2, friendly:1, heli:2 }, w:{ mortar:1, ambush:1.1, armour:0.7, vbied:0.7, friendly:0.6, heli:0.5 },
    mortar:{ shells:7, gap:0.5, walk:3.0, R:4.2, dmg:20, warn:1.3 },
    ambush:{ r:[14,19], squads:[1,2] }, armour:{ r:[44,56] }, vbied:{ n:[2,3] },
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
export const OUTPOST = { size:{ base_barracks:{ w:16 }, base_tent:{ w:7 }, base_radar:{ h:9 }, base_bunker:{ w:7 }, base_wire:{ w:6 }, mil_truck:{ w:8 }, mil_apc:{ w:7.6 }, mil_jeep:{ w:4.3 }, mil_humvee:{ w:4.9 } }, veh:['mil_truck','mil_apc','mil_jeep','mil_humvee'], nVeh:2, tents:2, ring:[10, 22], laneA:0.5, wireRows:2, wireAt:9, solid:['base_barracks','base_bunker','base_radar','mil_truck','mil_apc','mil_jeep','mil_humvee'] };
// Z292 PHONE LOD: phones load the light copies under …/m/ (trees ~3k triangles with their leaf cards thinned, fort pieces 2.5–3.5k, the city's
//   buildings halved) and keep the block skyline — measured on the emulated phone: 5.0M → 2.5M triangles a frame on the meadow and savanna
export const PHONE_LOD = { on:true, trees:true, forts:true, city:['bld_office','bld_glass','bld_hotel','bld_apart','bld_shophouse','bld_shoprow2','bld_villa'] };
// Z286 real wildlife (actors/wildlife.js; Tripo, rigged + walk cycle): height (m) per species, turn fix (rad), walk-cycle speed limits, off on phones
export const REALWILD = { h:{ deer:2.1, zebra:2.0, giraffe:5.0, elephant:3.3, reindeer:2.4, bear:1.5 }, yaw:{}, cycle:[0.7, 2.6], mobile:false };
// Z284 real wonders (world/wonders.js dressWonder; Tripo): which battlefield's landmark becomes which model, its size against the procedural one, turn, sink
export const REALWONDER = { windmill:{ key:'wonder_windmill', h:30, sink:0.02, yaw:-Math.PI / 2 },   // Z410 MEADOW's three windmills as the Tripo model (h m tall to its top sail; its sails face +X → yaw)
  biomes:{ CITADEL:'wonder_taj', RUINS:'wonder_colosseum', SAVANNA:'wonder_djenne', FOUNDRY:'wonder_volklingen', DESERT:'wonder_giza', QUARRY:'wonder_quarry' },
  fit:{ wonder_taj:1.0, wonder_colosseum:1.0, wonder_djenne:1.0, wonder_volklingen:1.0, wonder_giza:1.0, wonder_quarry:1.0 }, yaw:{}, sink:0.02,
  // Z426 the Giza pyramids and the Carrara terraces as models too; multi = a landmark of several pieces (world/wonders.js dressMulti): one model at each
  //   [x, z, size m, 'w' width | 'h' height] in the drawn landmark's frame, scan pieces beside them (k, x, z, h) — the Inuit village's igloos and its lighthouse
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
// Z296 what the driver and the soldier say to each other, by event (d = the driver, s = the soldier's answer) — on screen now, voices to be laid on later
export const RIDE_TALK = { gap:7, reply:1.3, col:{ d:'#ffe9a8', s:'#b8e3ff' },
  start:{ d:['Lên xe đi con, chú chở!', 'Ngồi chắc nha, mình đi!'], s:['Đi chú!', 'Chạy đi chú, em yểm trợ!'] },
  wheelie:{ d:['Bốc đầu nè!', 'Ôm chặt vô!', 'Coi chú nè!'], s:['Trời đất ơi chú!', 'Từ từ thôi chú!'] },
  turn:{ d:['Ôm cua nha!', 'Nghiêng theo chú!'], s:['Rõ!'] },
  fast:{ d:['Lên số nè!', 'Vít ga luôn!'], s:['Nhanh nữa chú!'] },
  underfire:{ d:['Cúi xuống! Đạn kìa!', 'Trời ơi nó bắn!', 'Nấp sau lưng chú!'], s:['Để em xử nó!', 'Chú cứ chạy, em lo!'] },
  crash:{ d:['Té rồi! Té rồi!', 'Ui da!', 'Xe ngã rồi con ơi!'], s:['Chú có sao không?!', 'Em yểm trợ, chú dựng xe đi!'] },
  getup:{ d:['Không sao… còn sống!', 'Đau quá mà không chết!'], s:['Nhanh lên chú!'] },
  lift:{ d:['Dựng xe dậy cái đã!', 'Một… hai… ba… lên!'], s:['Em canh cho!'] },
  slip:{ d:['Hự… tuột tay!', 'Nặng quá trời đất ơi…', 'Ối… thêm cái nữa!'], s:['Cố lên chú!', 'Lẹ lên chú ơi!'] },   // Z331 the first heave slips back
  surrender:{ d:['Đừng bắn! Tôi đầu hàng!', 'Tôi chỉ chạy xe ôm thôi mà!', 'Tha cho tôi, nhà còn vợ con!'], s:[] },   // Z331 the soldier is down: he gives himself up
  remount:{ d:['Lên xe! Chạy tiếp!', 'Ngon rồi, đi thôi!', 'Lên xe! Cuốc này chú tính gấp đôi nha!'], s:['Đi!', 'Dạ… ghi sổ nha chú!'] },
  // Z361 the bike dies: on the seat · the kick-start · the tyre booted · the hurt foot · the row (argue: the soldier answers the line of the same index)
  //   · giving in · the spark-plug mutter at the repair · fired up, urging the soldier on · a panicked look back under fire
  stall:{ d:['Ơ… ơ… tắt máy rồi!', 'Thôi xong, chết máy!', 'Ủa ủa… sao vậy trời!'], s:['Gì nữa vậy chú?!', 'Chú đừng nói hết xăng nha!'] },
  kickstart:{ d:['Nổ đi mà… nổ đi cưng!', 'Một cái nữa thôi… nổ!', 'Đạp muốn rụng giò mà không nổ!'], s:[] },
  kick:{ d:['Đồ xe cà tàng!', 'Mày phản tao hả!', 'Hư hoài vậy mậy!'], s:[] },
  ouch:{ d:['Á á! Đau chân!', 'Ui da… cái giò tui!', 'Ối… trật khớp rồi!'], s:['Đá chi cho đau vậy chú…', 'Xe có lỗi gì đâu chú!', 'Chú… có sao không?'] },
  argue:{ d:['Tại con bắn nhau ầm ầm nên nó mới hư đó!', 'Xe này chú chạy hai chục năm chưa hư bữa nào nghe!', 'Tiền sửa xe ai trả? Con trả nha!', 'Chở con có một cuốc mà tui mất cái xe!', 'Lần sau tui chở khách đi chợ thôi, hết chở lính!'],
    s:['Tại xe chú cũ rích chứ bộ!', 'Thì bữa nay nó hư đó chú!', 'Dạ… ghi sổ quân đội đi chú!', 'Xe còn nguyên đó chú, sửa lẹ đi!', 'Câu đó chú nói lần thứ ba rồi đó!'] },
  giveup:{ d:['Thôi được rồi… để chú coi máy.', 'Đứng canh cho chú sửa đó nghe chưa!', 'Hừ… nói không lại con!'], s:['Rõ!', 'Chú lẹ lẹ nha!'] },
  fixing:{ d:['Chắc tại cái bugi…', 'Lau cái bugi là chạy liền!', 'Bình xăng con lại nghẹt rồi…'], s:['Sửa được không chú?', 'Lẹ lên chú ơi, địch tới!'] },
  charge:{ d:['Quậy đục nước nó cho tao! Tiến lên!!', 'Xông lên con! Bắn nát tụi nó!', 'Đằng kia kìa! Bắn! Bắn!', 'Tiến lên!! Có chú đây!', 'Cho tụi nó biết tay dân xe ôm!'], s:['Rõ, chú!', 'Xông lên!!', 'Chú cứ chạy, em lo!'] },   // (fired up, the hand thrust ahead)
  // Z363 the hammer · his break: a smoke (the lines as he pulls over, mid-drag), a pee, done, cut short by the fighting
  bang:{ d:['Đồ quỷ! Đồ quỷ!', 'Chạy coi! Chạy coi!', 'Tao cho mày biết tay!'], s:['Từ từ chú ơi, gãy xe bây giờ!', 'Đập vậy hư thêm đó chú!'] },
  smoke:{ d:['Mệt quá… cho chú làm điếu thuốc cái đã!', 'Nghỉ chút con, chú run tay quá rồi!', 'Hút điếu thuốc cho tỉnh cái đầu…'], s:['Chú ơi đang đánh nhau mà!', 'Hút lẹ đi chú!', 'Trời đất, giờ này mà hút thuốc!'] },
  puff:{ d:['Phù… sướng…', 'Đời xe ôm, có điếu thuốc là vui rồi…', 'Hút xong điếu này chú chở con tới chân trời luôn!'], s:[] },
  pee:{ d:['Chờ chú xíu… mắc quá rồi!', 'Chú đi giải quyết nỗi buồn cái!', 'Nín không nổi nữa con ơi!'], s:['Trời đất, ngay lúc này hả chú?!', 'Lẹ lẹ nha chú!', 'Chú ra xa xa chút!'] },
  peeing:{ d:['Aaa… nhẹ cả người…', 'Phù… sống lại rồi…'], s:[] },
  rested:{ d:['Rồi, đi tiếp! Lên xe con!', 'Tỉnh rồi! Đi thôi!'], s:['Lẹ lên chú!', 'Đi!'] },
  cut:{ d:['Ối! Tụi nó tới! Về xe, về xe!', 'Chưa kịp xong nữa trời ơi!'], s:['Lẹ lên chú!'] },
  behind:{ d:['Phía sau! Nó đuổi sau lưng kìa!', 'Má ơi, còn nữa kìa!', 'Chết rồi chết rồi!'], s:['Chú nhìn đường dùm em!', 'Em thấy rồi, chú cứ chạy!'] } };
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
// Z279 colossal forts (world/fortress.js dressFort; Tripo 4K): each battlefield's style (fort_<style>_{wall,tower,gate}.glb), wall height / thickness ×,
//   tower width ×, extra height, the donjon's size ×, the gatehouse width ×, and the doorway cut out of the gatehouse (share of its width, height)
export const REALFORT = { biomes:{ CITADEL:'citadel', MEADOW:'meadow', RUINS:'ruins', HILLS:'meadow', VILLAGE:'meadow', DESERT:'desert', SAVANNA:'savanna', QUARRY:'quarry', ARCTIC:'arctic', TUNDRA:'arctic', VOLCANO:'volcano', FOUNDRY:'foundry', STEELMILL:'foundry', CITY:'foundry' },   // Z399 the city's fort too: the works' concrete and steel (it stood as plain boxes in a stone wrap)
  wallUp:1.5, thick:1.25, towerW:1.35, towerUp:3, keepW:1.3, keepH:1.15, gateW:1.15, door:[0.2, 0.55] };
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
export const REALFIT = { env:0.8, hMax:1.3, hut:{ k:'quonset', fit:0.98 }, tent:{ k:'base_tent', fit:0.86 }, launcher:{ k:'mil_launcher', yaw:-Math.PI / 2, pod:[0.6, 0.5], fit:1 } };
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
  crushSpeed:1.2, crushBonus:50, bail:0.7,   // Z113 a tank rolling over a man at any real speed kills him (was 3.5)
  vsArmour:0.3,
  fling:{ speed:13, up:8.5, gib:1.0, maxK:1.7, tearK:1.9 },   // Z121 a direct tank round (or the core of a blast, hitK ≥ tearK) TEARS the man apart instead  // Z112 killed by a heavy round / blast: thrown away from the hit (speed, lift m/s), breaks apart ~0.75 s later and is gone
                       // Z111b small-arms rounds (riflemen, tower / wall guards, MG nests) do 30% to a tank's armour; RPG rockets keep full damage
  coverThreat: 20, coverSearch: 12,   // Z104 a rifleman who sees a tank this close runs for the far side of the nearest cover
};
// NEW ENEMY VEHICLES (Z80). unlock = first stage it appears; weight = [base, +per stage after unlock] in the wave mix.
export const ROSTER = {
  pyro:    { range:11, dps:15, cone:0.82, tick:0.35 },                     // flame tank: close-range fire hose (dps on the player while inside the cone)
  atgm:    { aimT:1.2, speed:21, turn:1.5, dmg:30, aoe:3.2, life:5.5, cd:6.5 },   // laser-painted wire-guided missile: shoot it down, dodge sharply, or pop SMOKE
  engineer:{ heal:9, range:16, selfHeal:3 },                               // heal = % of the patient's max HP ×(60/100)… per second (≈15%/s) — kill the medic first
  gunship: { alt:8.5, orbit:19, speed:9, range:34, gunDmg:3, gunCd:0.13, burst:9, burstCd:3.4, salvo:2, salvoCd:5, rocketDmg:12, rocketSpeed:28, flareDecoy:0.45 },   // Z198 flares pull a locked missile off 45% of the time
  unlock:  { pyro:2, engineer:3, atgm:3, gunship:4, launcher:2 },
  weight:  { pyro:[1.0,0.5], engineer:[0.6,0.3], atgm:[0.8,0.5], gunship:[0.45,0.3], launcher:[0.5,0.3] },
  launcher:{ salvo:4, gap:0.22, speed:24, dmg:22, aoe:3.2, spread:2.4 },   // Z116 ROCKET TRUCK: lobs a 4-rocket salvo from long range (weak armour, high value)
  aaBonus: 1.8,                                                            // FLAK airburst vs aircraft
};
// ============================================================================
// CAMPAIGN OPERATIONS (Z83) — every stage is a named operation: briefing, radio chatter, scripted waves and a
// high-value OBJECTIVE. While the objective stands it buffs the enemy (mods); destroying it pays a bounty + 1 diamond.
//   script = { wave: event }   events: ambush (squads drop in close) · column (armoured column from one edge) · pyro · airraid
// ============================================================================
export const OPERATIONS = [
  { title:'CHIẾN DỊCH BÃO CÁT', code:'SANDSTORM', obj:'depot', script:{ 2:'ambush', 4:'column' },
    story:'Rạng sáng, Liên minh Hắc Thiết vượt biên dưới màn bão cát. Tiền đồn Sao Đỏ chỉ còn một Lõi năng lượng — và Đại đội Thép 7 của anh.',
    brief:'Thiết giáp địch đang tập kết sau đồi cát. Giữ Lõi, đốt kho nhiên liệu đang tiếp sức cho đoàn xe của chúng.',
    radio:{ 1:'Phát hiện địch phía trước — thiết giáp trong đồi cát!', 2:'Bộ binh đang băng qua bãi trống. Cán qua chúng!', 3:'Trinh sát báo: chúng có một chỉ huy tên "Bò Thép".', 4:'Đoàn thiết giáp trên đường phía đông!', 5:'Đợt cuối trước khi xe chỉ huy của chúng tới. Giữ vững!' },
    boss:'BÒ THÉP đang lao tới. Nó húc rất mạnh nhưng ngu — dụ nó đâm vào tường gạch hay đá, nó sẽ choáng. Bắn vào đuôi xe!',
    win:'Kho nhiên liệu cháy rồi — xe tăng của chúng sắp cạn xăng!' },
  { title:'CHIẾN DỊCH THÀNH PHỐ ĐỔ NÁT', code:'BROKEN CITY', obj:'radio', script:{ 2:'pyro', 4:'ambush' },
    story:'Bò Thép gục ngã, nhưng từ thành phố đổ nát phía bắc, một trạm tiếp sóng vẫn liên tục gọi viện binh Hắc Thiết đổ về.',
    brief:'Đống đổ nát che một trạm tiếp sóng gọi viện binh không ngừng. Bịt miệng nó, rồi dọn sạch các con phố.',
    radio:{ 1:'Có chuyển động trong đống gạch vụn.', 2:'Xe phun lửa! Giữ khoảng cách!', 3:'Bắt được sóng địch: chỉ huy CUỒNG PHONG đang dẫn đội tên lửa tới.', 4:'Tổ RPG trong hẻm — coi chừng tên lửa!', 5:'Trạm tiếp sóng vẫn phát? Hạ nó ngay!' },
    boss:'CUỒNG PHONG đang lượn quanh quảng trường. Hai bệ tên lửa hai bên tháp pháo là mắt xích yếu — bắn nát chúng, thả khói khi bị khoá!',
    win:'Trạm tiếp sóng đã sập — viện binh của chúng im bặt.' },
  { title:'CHIẾN DỊCH IM LẶNG TRẮNG', code:'WHITE SILENCE', obj:'radar', script:{ 3:'airraid', 5:'column' },
    story:'Tín hiệu cuối của CUỒNG PHONG dẫn về vùng băng giá: một trạm radar đang dẫn đường cho trực thăng tấn công. Đây là nơi Hắc Thiết giấu cỗ xe pháo đài KHỔNG LỒ.',
    brief:'Trạm radar trên băng đang dẫn trực thăng vào đội hình ta. Phá nó để giành lại bầu trời.',
    radio:{ 1:'Tầm nhìn kém. Tập trung cao độ.', 2:'Băng nứt khắp nơi — đừng để bị dồn vào góc.', 3:'Tiếng cánh quạt — trực thăng vũ trang!', 4:'Công binh đang hàn xe cho chúng. Diệt công binh trước!', 5:'Đoàn xe hạng nặng vượt băng!' },
    boss:'KHỔNG LỒ đã chọc thủng tuyến băng. Giáp trước của nó gần như không xuyên nổi — vòng ra sau lưng mà đánh!',
    win:'Radar thành sắt vụn. Hết trực thăng trên đầu ta.' },
  { title:'CHIẾN DỊCH LÒ LỬA THÉP', code:'IRON FURNACE', obj:'battery', script:{ 2:'column', 4:'airraid' },
    story:'Giữa tro tàn của KHỔNG LỒ, ta tìm thấy bản đồ: Hắc Thiết đúc xe ngay trong khu lò luyện, có pháo binh canh giữ — và TỬ THẦN, sát thủ tàng hình của chúng.',
    brief:'Một trận địa pháo trong khu lò đúc đang nã vào phòng tuyến ta. Luôn di chuyển, và đánh sập những khẩu pháo đó.',
    radio:{ 1:'Đạn pháo đang tới — di chuyển liên tục!', 2:'Thiết giáp tràn ra từ các xưởng lò!', 3:'TỬ THẦN có thể dịch chuyển. Đừng đứng yên một chỗ.', 4:'Không kích! Tìm chỗ nấp!', 5:'Xe diệt tăng trên sườn đồi — bị khoá laser thì thả khói.' },
    boss:'TỬ THẦN đang trong lò rèn. Tia laser của nó không xuyên tường — nấp sau tường gạch khi nó nạp năng lượng!',
    win:'Trận địa pháo đã câm. Pháo kích ngừng rồi.' },
  { title:'CHIẾN DỊCH THÀNH LUỸ CUỐI', code:'LAST CITADEL', obj:'command', script:{ 1:'ambush', 3:'airraid', 5:'column' },
    story:'Hầm chỉ huy của Hắc Thiết nằm sau thành luỹ cuối cùng. BẠO CHÚA — kẻ khơi mào cuộc chiến — đang chờ. Kết thúc nó, và chiến tranh kết thúc hôm nay.',
    brief:'Đây là hầm chỉ huy của chúng. Mọi thứ còn lại của Hắc Thiết dồn cả về đây. Phá nó, chiến tranh sẽ kết thúc.',
    radio:{ 1:'Chúng đã chờ sẵn — phục kích!', 2:'Giữ Lõi. Bằng mọi giá.', 3:'Toàn bộ trực thăng của chúng đã cất cánh!', 4:'Đại đội Thép 7, cả nước đang dõi theo các anh.', 5:'Đoàn xe cuối cùng. Chính là lúc này.' },
    boss:'BẠO CHÚA ra trận. Nó có khiên năng lượng nhờ các trụ phát — phá trụ rồi dồn hoả lực. Kết thúc nó!',
    win:'Hầm chỉ huy sập rồi — phòng tuyến địch đang tan vỡ!' },
];
export const OBJECTIVES = {
  depot:  { name:'FUEL DEPOT', vi:'KHO NHIÊN LIỆU', effectVi:'Xe địch chạy nhanh hơn 15%',        hp:260, r:6.2, effect:'Enemy tanks move 15% faster',          mods:{ enemySpeedMul:1.15 } },
  radio:  { name:'RADIO RELAY', vi:'TRẠM TIẾP SÓNG', effectVi:'Viện binh tới nhanh hơn 25%',       hp:220, r:3.6, effect:'Reinforcements arrive 25% faster',      mods:{ cadenceMul:0.75 } },
  radar:  { name:'RADAR SITE', vi:'TRẠM RADAR', effectVi:'Mỗi đợt có thêm một trực thăng',        hp:260, r:4.8, effect:'A gunship joins every wave',            mods:{ gunshipPerWave:1 } },
  battery:{ name:'ARTILLERY BATTERY', vi:'TRẬN ĐỊA PHÁO', effectVi:'Nã pháo vào vị trí bạn mỗi 9 giây', hp:320, r:6.8, effect:'Shells your position every 9 seconds',  mods:{ shellEvery:9 } },
  command:{ name:'COMMAND BUNKER', vi:'HẦM CHỈ HUY', effectVi:'Địch gây thêm 15% sát thương',    hp:440, r:6.6, effect:'Enemies deal 15% more damage',          mods:{ enemyDmgMul:1.15 } },
};
export const OBJ_REWARD = { coin:300, coinPerStage:120, dia:1, score:1500 };
// EQUIPMENT (Z82) — tank-mounted support kit on the SPELL wheel. Each is a counter to a specific threat.
export const EQUIP = {
  smoke:{ dur:7, radius:9, spreadMul:4.5 },       // smoke grenades: enemy aim ×spreadMul, guided missiles lose lock
  aps:  { dur:12, charges:4, radius:7 },          // active protection (hard-kill): shoots down rockets/missiles/shells in radius
  mines:{ count:3, dmg:90, radius:4.2, arm:0.8, life:45 },   // anti-tank mines dropped behind the tank
};
// enemy toughness grows with the campaign so later stages stay a fight even as the arsenal grows
export const RAMP = { hpPerStage:0.14 };
// battlefield conditions — the same gun performs differently depending on WHERE and WHEN you fight
export const ENV = {
  night:  { range:0.85, enemySpread:1.3, exempt:['railgun','missile'] },   // short sight lines; thermal (railgun) & lock-on (missile) unaffected; enemies shoot worse too
  hot:    { biomes:['DESERT','FOUNDRY','SAVANNA','VOLCANO'], hours:['noon'], fire:1.25, freeze:0.7 },   // heat: fires rage, ice melts off fast
  cold:   { biomes:['TUNDRA','ARCTIC'], fire:0.75, freeze:1.5, cryo:1.2 },                  // frost: cryo locks targets for longer, flames gutter
  urban:  { biomes:['RUINS','CITADEL','CITY','STEELMILL'], he:1.2 },                                  // rubble & walls: blast and splinters wreck more
  open:   { biomes:['MEADOW','DESERT','SAVANNA','ARCTIC','QUARRY'], longRange:1.1, guns:['cannon','railgun','hesh'] },   // long sight lines favour the big guns
};
// battlefield gun gifts: pity timer + counter-pick + prefer guns you don't hold yet (duplicates still feed MASTERY)
export const GIFT = { gunBase:0.30, pityStep:0.12, pityCap:0.85, counterW:1.6, newGunW:1.6 };

// ----- rarity colours (tier/VIP) -----
export const RAR_COL = { t1:0x9fb07a, t2:0x5aa9ff, t3:0xc08bff, vip:0x7fe7ff, up:0x9bd14a };

// ----- shop: leveled stat upgrades (L1-L3 coins, L4-L5 diamonds = VIP) -----
export const SHOP_UP = [
  {key:'damage', cat:'FIREPOWER', icon:'burst',  name:'SÁT THƯƠNG',       per:'+8% sát thương đạn', costs:[{c:300},{c:800},{c:2000},{d:14},{d:26}]},
  {key:'boss',   cat:'FIREPOWER', icon:'shell',   name:'ĐẦU ĐẠN',      per:'+12% sát thương lên tướng',  costs:[{c:400},{c:1100},{c:2600},{d:15},{d:28}]},
  {key:'range',  cat:'FIREPOWER', icon:'target', name:'NÒNG DÀI',  per:'+10% tầm bắn',   costs:[{c:250},{c:700},{c:1700},{d:12},{d:22}]},
  {key:'reload', cat:'AMMO',      icon:'mag',    name:'NẠP NHANH',  per:'−12% thời gian nạp',  costs:[{c:300},{c:800},{c:2000},{d:14},{d:26}]},
  {key:'mag',    cat:'AMMO',      icon:'mag',    name:'BĂNG ĐẠN LỚN', per:'+15% băng đạn',     costs:[{c:250},{c:700},{c:1700},{d:12},{d:22}]},
  {key:'hp',     cat:'CHASSIS',   icon:'heart',  name:'BỌC THÂN XE', per:'+20 máu tối đa',        costs:[{c:300},{c:800},{c:2000},{d:14},{d:26}]},
  {key:'armor',  cat:'CHASSIS',   icon:'shield', name:'GIÁP',        per:'−6% sát thương nhận',  costs:[{c:400},{c:1000},{c:2500},{d:16},{d:30}]},
  {key:'engine', cat:'CHASSIS',   icon:'dash',   name:'ĐỘNG CƠ',    per:'+10% tốc độ',   costs:[{c:250},{c:700},{c:1700},{d:12},{d:22}]},
  {key:'turbo',  cat:'CHASSIS',   icon:'dash',   name:'TĂNG ÁP', per:'+12% gia tốc',  costs:[{c:400},{c:1000},{c:2400}]},
  {key:'ramplate',cat:'CHASSIS',  icon:'shield', name:'MŨI HÚC',    per:'+25% sát thương húc · −12% chịu húc', costs:[{c:500},{c:1200},{c:2800}]},
  // ----- SUPPORT units: buy & upgrade the guard squad and the escort drone -----
  {key:'guards',   cat:'SUPPORT', icon:'shield', name:'LÍNH GÁC LÕI',   per:'+1 lính gác Lõi',          costs:[{c:900},{c:2400},{d:16}]},
  {key:'troops',   cat:'SUPPORT', icon:'up',     name:'LÍNH GÁC: HOẢ LỰC', per:'+22% sát thương lính gác',      costs:[{c:600},{c:1500},{d:12}]},
  {key:'guardRof', cat:'SUPPORT', icon:'dash',   name:'LÍNH GÁC: THAO LUYỆN',  per:'−10% thời gian nạp của lính gác',      costs:[{c:700},{c:1800},{d:12}]},
  {key:'guardArm', cat:'SUPPORT', icon:'heart',  name:'LÍNH GÁC: GIÁP',  per:'+18 máu mỗi lính gác',       costs:[{c:700},{c:1800},{d:12}]},
  {key:'crew',     cat:'SUPPORT', icon:'shield', name:'KÍP LÍNH XE',     per:'+2 lính trên xe',           costs:[{c:900},{c:2400},{d:16}]},
  {key:'dronePow', cat:'SUPPORT', icon:'drone',  name:'DRONE TẤN CÔNG',  per:'Mở drone hộ tống · +12% sát thương/cấp', costs:[{c:1500},{c:3200},{c:5000},{d:28},{d:40}]},
  {key:'droneRof', cat:'SUPPORT', icon:'dash',   name:'DRONE: CÁNH QUẠT', per:'−10% thời gian nạp drone',      costs:[{c:1200},{c:2800},{d:16}]},
  {key:'droneArm', cat:'SUPPORT', icon:'heart',  name:'DRONE: BỌC GIÁP',per:'+40 máu drone',          costs:[{c:1200},{c:2800},{d:16}]},
];

// ----- gun unlocks. T1/T2/T3 in coins; railgun & rocket are VIP (diamonds only, never gifted in battle).
// VIP coin-equiv (28◆=5,600 / 34◆=6,800) sits ABOVE the best T3 coin gun (5,500) — value stays ordered. -----
export const GUN_PRICE = { smg:{c:600}, shotgun:{c:1300}, cryo:{c:1500}, flak:{c:1800}, cannon:{c:2100},   // Z149 price climbs with tier: BẬC 1 ≤ 600 · BẬC 2 1.3–3k · BẬC 3 4–5.5k
  flamer:{c:2300}, agl:{c:2500}, hesh:{c:2800}, mortar:{c:3000}, minigun:{c:4000}, missile:{c:4400}, tesla:{c:4800}, thermo:{c:5200}, arty:{c:5500}, railgun:{d:28}, rocket:{d:34},
  orbital:{d:60}, plasma:{d:48}, hydra:{d:42}, singularity:{d:55}, photon:{d:50} };   // Z186 ultimates
export const VIP_GUNS = ['railgun','rocket','orbital','plasma','hydra','singularity','photon'];

// ----- punchy marketing blurbs (kept short) -----
export const GUN_BLURB = {
  rifle:'Bền bỉ, đa năng — không bao giờ kẹt đạn.', carbine:'Súng trường của người lính: đạn thẳng, chính xác, không nổ.', t_lmg:'Đại liên của lính: băng 100 viên, giữ cò quét cả tổ địch.', t_minigun:'Súng nòng xoay ôm ngang hông: mưa đạn, nạp lâu.', t_shotgun:'Súng săn: 8 viên chì một phát, cực mạnh ở gần.', t_sniper:'Súng bắn tỉa 12.7: một phát xuyên hai người, bắn xa.', t_rpg:'B41 vác vai: rocket nổ, phá xe và ổ súng.', t_gl:'Súng phóng lựu M79: lựu đạn câu đúng chỗ ngắm, nổ lan.', t_flamer:'Súng phun lửa: đốt cháy người và xe trong tầm gần.', t_energy:'Súng xung điện: tia sét nhảy sang người đứng gần.', t_rust:'Súng trường thép gỉ: đạn nặng, giật mạnh, hạ người nhanh.', t_dmr:'Súng tỉa bán tự động: kính ngắm, viên đạn xuyên qua một người.', t_rail:'Súng ray: viên đạn điện từ xuyên cả tổ địch, nạp chậm.', t_saw:'Súng bắn lưỡi cưa: lưỡi cưa quay xé qua ba người ở cự ly gần.', t_ak:'AK-47 nhặt của địch: đạn 7.62 nặng tay, giật mạnh, hạ người nhanh.', t_m4:'Súng trường M4 có ống giảm thanh và ống ngắm: chính xác, bắn xa, nhịp nhanh.', t_mp5:'Tiểu liên MP5: nhẹ, xả đạn rất nhanh — vua cự ly gần, đuối khi bắn xa.', smg:'Cơn mưa đạn dữ dội ở cự ly gần.',
  shotgun:'Tàn phá cự ly gần — tám viên chì, một lần bóp cò.', flak:'Mảnh đạn nổ tung xé nát cả bầy.',
  cannon:'Một phát đạn khổng lồ. Giáp dày cũng phải gập.', cryo:'Đóng băng chúng — rồi đập vỡ vụn.',
  minigun:'Nòng xoay không ngừng, lửa không ngừng. Giữ vững phòng tuyến.', missile:'Khoá mục tiêu. Nó tự săn. Không bao giờ trượt.',
  tesla:'Sét nhảy từ kẻ địch này sang kẻ địch khác.', railgun:'Một phát xuyên thủng cả đoàn xe.',
  rocket:'Phóng một quả — cả khu vực biến mất.',
  orbital:'Đánh dấu một điểm — một ngọn thương ánh sáng từ quỹ đạo giáng xuống, san phẳng cả tường thành.',
  plasma:'Một mặt trời nhỏ trôi qua chiến trường, thiêu xuyên mọi thứ — rồi bùng nổ siêu tân tinh.',
  hydra:'Mười đầu rắn lửa: mười tên lửa tự săn mười mục tiêu khác nhau.',
  singularity:'Xé toạc không gian — hút cả đoàn xe vào tâm, nghiền nát, rồi sụp đổ.',
  photon:'Một chùm quang tử liên tục — vung nòng là cắt đôi mọi thứ trên đường.',
  arty:'Đạn pháo hạng nặng rơi đúng điểm đánh dấu — phá tường, nổ ngay khi chạm đất.',
  mortar:'Bắn vòng qua mọi bức tường — cối bắn nhanh, nổ khi chạm đất.',
  flamer:'Thiêu rụi chúng — lửa chỉ lan rộng, không bao giờ buông tha.',
  hesh:'Đạn đầu bẹt — san phẳng công sự, quật đổ tháp canh, nứt giáp trung bình.',
  agl:'Mưa lựu đạn 40 mm — bộ binh và xe nhẹ tan tác.',
  thermo:'Tên lửa nhiệt áp: một vụ nổ chói loà, mọi thứ bên trong bốc cháy.' };
// ----- STAGE CONTRACTS: pre-stage strategic choice (pick 1 of 3 each stage; applies for that stage only).
// mods are read live at use-sites via cMod() — pure data, no runtime coupling. Every contract is a risk/reward. -----
export const CONTRACTS = [
  { id:'steady',  name:'TIẾN CHẮC',      icon:'shield', tag:'AN TOÀN',   desc:'+10% xu · không thêm rủi ro',                       mods:{ coinMul:1.1 } },
  { id:'bounty',  name:'SĂN TIỀN THƯỞNG', icon:'coin',  tag:'XU',        desc:'+70% xu · nhưng địch +20% máu',                 mods:{ coinMul:1.7, enemyHpMul:1.2 } },
  { id:'glass',   name:'PHÁO THUỶ TINH', icon:'burst',  tag:'RỦI RO CAO', desc:'+40% sát thương của bạn · địch +30% sát thương',           mods:{ playerDmgMul:1.4, enemyDmgMul:1.3 } },
  { id:'elite',   name:'SĂN TINH NHUỆ',  icon:'shell',  tag:'TINH NHUỆ', desc:'Mỗi đợt 1 xe tinh nhuệ · +50% đồ rơi · địch +10% máu',  mods:{ eliteEveryWave:true, lootChanceMul:1.5, enemyHpMul:1.1 } },
  { id:'scav',    name:'NHẶT NHẠNH',     icon:'mag',    tag:'ĐỒ RƠI',    desc:'×2 đồ rơi (cày súng/cấp) · địch +20% sát thương', mods:{ lootChanceMul:2, enemyDmgMul:1.2 } },
  { id:'warlord', name:'PHẦN CỦA TƯỚNG', icon:'target', tag:'KIM CƯƠNG', desc:'Tướng rơi thêm 2 💎 · nhưng địch +15% máu',           mods:{ bossDiaBonus:2, enemyHpMul:1.15 } },
];

export const UP_BLURB = {
  damage:'Mỗi viên đạn cắn sâu hơn.', range:'Ra đòn trước, từ thật xa.', reload:'Trở lại trận chỉ trong chớp mắt.',
  mag:'Nhiều đạn hơn, ít lần nạp hơn.', hp:'Chịu đòn nặng mà vẫn đứng vững.', armor:'Gạt phăng hoả lực địch.',
  engine:'Vượt mặt mọi thứ trên chiến trường.', turbo:'Bứt tốc như vận động viên — 50 tấn mà không chờ đợi.', ramplate:'Mũi xe tôi cứng: thân xe chính là vũ khí.', guards:'Thêm lính đứng gác bên Lõi.',
  crew:'Thêm xạ thủ ngồi trên xe ra trận.', troops:'Lính của bạn đánh mạnh hơn hẳn.',
  boss:'Xé nát tướng địch nhanh hơn nhiều.',
  guardRof:'Xạ thủ thao luyện bắn nhanh hơn.', guardArm:'Lính gác bọc giáp trụ lâu hơn.',
  dronePow:'Triển khai drone hộ tống — và nó cắn mạnh hơn.', droneRof:'Quay nòng nhanh — băng đạn nạp trong chớp mắt.',
  droneArm:'Cánh quạt bọc giáp giữ drone trên trời lâu hơn.' };

// DRIVING (Z85) — the player's tank is a 50-tonne machine: hull-steered tracks, a heavy launch, momentum that carries,
// and collisions that hurt by mass × closing speed. Speeds in world units/s (top speed = PLAYER.maxSpeed 26).
export const DRIVE = {
  smoke: { until: 7, every: 0.06, big: 4 },   // Z116 diesel soot when the tank pulls away under load: below `until` m/s with throttle on; a dead-stop launch belches `big` puffs at once
  accel: 19,          // peak tractive acceleration once rolling (Z99: 34→23; Z107: 23→19 — no mid-range surge)
  launch: 0.7,        // share of that available from a dead stop (Z107: 0.32→0.7 — moves off at once, no 50-t creep)
  launchV: 6,         // speed by which full power has come in
  reverseMul: 0.72,   // reverse top speed / accel vs forward (Z121: 0.5 → 0.72 — backing out of a fight is a real move)
  reverseAngle: 2.0,  // push this far (rad, ≈115°) behind the hull → BACK UP straight, no turning round (Z121: at any speed — it brakes, then reverses)
  reverseKeep: 1.3,   // …and it keeps reversing until the push comes back within this of the hull's rear-to-front line
  coast: 32,          // rolling resistance with the throttle off (Z107: 14→32 — settles in ~0.7 s / 8 m, was 1.6 s / 19 m)
  coastLin: 0.45,     // extra resistance per unit of speed while coasting (Z107: 0.12→0.45)
  brake: 62,          // braking against the motion (Z107: 44→62)
  slopeSlide: 9,      // pull down into hollows/craters (Z107: 14→9 — less drifting on bumpy ground)
  pivot: 2.6,         // hull turn rate standing still (neutral steer, rad/s) — Z99: steadier for A/D steering
  turnAtSpeed: 1.55,  // hull turn rate at top speed — wide arcs when flat out
  grip: 14,           // sideways track grip — kills lateral slide (Z107: 10→14)
  screenPivot: 4.4,   // Z107 screen-relative keys: the hull swings round to the pressed direction this fast (rad/s, standing) — snappy, no fiddly steering
  screenTurnAtSpeed: 2.6,  // … and while rolling
  screenReverse: true,     // Z121 keys back you up too: pressing the way opposite to the hull reverses straight (it used to spin the tank round)
  ram: { minImpact: 7, toEnemy: 1.15, toPlayer: 0.42, toBoss: 0.7, aggressor: 0.5, perStage: 0.22 },   // dmg = k × (closing speed − min) × mass share
  wallBreak: 14,      // closing speed that smashes a brick wall section; slower just thumps it
  climb: 15.5,        // closing speed needed to ride over a low rock; slower → stopped dead, back up and take a run
};

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
export const LETHAL = { tankRoundKills: true, core: 0.45, reach: 1.25, edgeMin: 0.25 };

// Z104 MOBILE AIM — phones have no mouse, so the barrel is FIXED to the hull: the tank shoots straight where it faces.
//   Auto-fire / rockets / mortar / artillery only take a target inside this forward cone (half-angle in rad) or lane (world units).
export const AIM = { rockR: 16, mobileFixed: false, mobileTrack: true, trackTol: 0.1, trackSticky: 1.35,   // Z233 phones: the turret tracks the enemy on its own (was: barrel fixed to the hull)
   cone: 0.17, lane: 1.8, artyCone: 0.32,
  pivotOnly: 0.38 };   // a LIGHT push of the stick only turns the hull on the spot (aim without driving off); push further to drive
// Z313 SHOOTING AT HELICOPTERS IN 3D (combat/air-aim.js): the mouse snaps to an aircraft within snapPx of the cursor (keeps it within keepPx); a pad
//   or phone lays on the one within padCone (rad) of the aim; rounds lead it and climb to its height; a round aimed at it hits within hitR (m) across
//   (the airframe and rotor, not the hub) and hTol (m) up or down of it;
//   how far a tank gun / a man's rifle may tip up (rad); the reticle: ring colour, label
// Z314 A GUN'S ROUND FLIES A STRAIGHT LINE (combat/lock-on.js): it hits a body only at that body's real height — a man (m), a tank (m at TANK_SCALE),
//   from floor (m) below its feet — and flies over an obstacle when it passes over m clear of its top
//   Z316 one of our men lying flat / crouched stands only body.prone / body.crouch (m) high, and the enemy lays its aim on aim.prone / aim.crouch (m)
export const LINE = { manH:2.1, tankH:2.8, floor:0.4, over:1.2, body:{ prone:0.7, crouch:1.4 }, aim:{ prone:0.35, crouch:0.85 } };
export const AIRAIM = { snapPx:70, keepPx:120, padCone:0.28, hTol:2.2, hitR:2.6, tankUp:0.55, manUp:1.05, col:0xff5a3a };
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
export const XHAIR = { reach:180, step:[0.3, 0.012], man:{ r:0.5, h:1.85, low:1.35, prone:0.6, lo:0.35, hi:0.2 }, chest:1.2, tankUp:1.3, pad:{ lat:1.8, near:2 },
  awake:2.2, fireTol:0.3, tankTol:0.05, anchor:{ cam:3 }, turn:{ twist:1.0, walk:0.8, backV:2.2 }, aimRate:6.5, stop:{ min:1.5, px:22 } };
// Z326 AIMING UP AT AN AIRCRAFT (actors/real-cav.js): past the rifle's normal tip-up he leans back from the waist — k × the extra, at most max (rad),
//   shared [Spine, Spine1, Spine2] — so the butt stays in his shoulder as the muzzle climbs; his head and neck (neck's share) tip back the rest of the
//   way to sight along the barrel (sight × the gun's angle); eased at rate /s; lying flat he can't lean back — the muzzle comes up no further than prone
export const AIRPOSE = { k:0.6, max:0.55, split:[0.25, 0.35, 0.4], neck:0.4, sight:0.95, rate:6, prone:0.35 };

// Z174 REAL-WORLD SCALE — 1 world unit = 1 metre. The tanks are the reference (≈ a real MBT: ~7.5 m with the gun, 3.7 m tall to the cupola); a soldier model is
//   1.407 units tall at scale 1 → HUMAN_SCALE makes every man, ours and theirs, 1.78 m. Fortress curtain walls 7 m + 1.3 m merlons, 2.4 m thick; watchtowers 8 m to the deck;
//   brick compound walls ~2.4 m; sandbag lines 1.2 m; trees 10–17 m.
// Z174b real MBT proportions (×TANK_SCALE 1.2): hull ~7.6 m long, 3.6 m wide over the tracks, turret roof ~2.4 m, gun ~2.5 m past the nose (~10 m overall) —
//   the hull + tracks stretch along, the hull and turret sit a little lower, the turret a touch longer, the gun longer. The generals' super-heavies keep their own size.
export const TANK_REAL = { L:1.36, H:0.9, tH:0.9, tL:1.1, gun:1.38 };
export const HUMAN_SCALE = 1.78/1.407;
export const TROOPS = {
  ridersFrom: 1,   // stage from which riflemen ride on your tank (G / CREW button drops them to fight on foot)
  dismount: { fromStage: 2, range: 28, troops: [3, 5], interval: 0.38, rpgFrom: 3 },   // enemy APC stops inside `range`, drops the ramp, troops pile out
  fireteam: { size: 6, perStage: 0.8, cap: 12, capMobile: 9, hp: 42, dmg: 7, range: 21, fireCd: 0.8, speed: 7.5, sprint: 12, follow: 7, cd: 24,   // friendly squad
    zoneMul: 0.9, zoneMin: 18,   // Z100 they roam FREELY inside the tank's combat zone (= 90% of its fire range, never under 18)
    detect: 30,                  // how far a soldier spots enemies (it only chases ones it can reach without leaving the zone)
    patrol: [6, 15],             // with nothing to shoot they take up posts this far from the tank
    spread: 2.6,                 // personal space between soldiers (no conga lines)
    tapMax: 0.3 },               // CREW/G pressed shorter than this = dismount; held = recall (release ends it)
  crewHeal: 5,                   // Z100 riding the tank heals a soldier this many HP per second (the tank is their aid station)
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
export const DEPLOY = { roleMax: { mg: [1, 2, 2, 2, 3], mortar: [0, 1, 1, 2, 2], sapper: [1, 1, 2, 2, 2] }, holdR: 30, stage: 0.62 };   // stage = staging point at this fraction of the way to an enemy site

// Z104 BATTLEFIELD ZONES (world/zones.js plans the ground before cover is scattered)
export const RALLY = { r: 6, offX: 0.34, offZ: 0.64 };          // KHU TẬP KẾT on our side: soldiers drop carried loot here (it never expires) for the tank to collect
export const POW = { perStage: [2, 2, 3, 3, 3], r: 9, prisoners: [3, 5], guards: [3, 4], guardsMobile: [2, 3], freeR: 10, score: 600, coin: 120 };
export const DEPOT = { arms: [1, 1, 1, 1, 1], motor: [1, 1, 1, 1, 1], r: 10, guards: [4, 5], guardsMobile: [3, 3], capT: 4, tanks: [1, 2], score: 800, coin: 150 };
export const ALLY_TANK = { hp: 260, speed: 9.5, turn: 1.9, sight: 46, range: 30, keep: 15, leash: 58, dmg: 30, fireCd: 1.7, bspeed: 72, cap: 4 };
// Z116 HIJACK: a badly hit enemy vehicle may be ABANDONED — the crew bails out and it sits smoking. Drive up to it (or walk a soldier
//   onto it) before it is scuttled and it fights for you in our colours. APC → drops 3 of our men + an MG; rocket truck → anti-air first, then siege.
export const HIJACK = { hp:0.3, chance:0.5, window:20, r:6.5, hold:1.2, footR:3.4, bail:2, types:['grunt','gunner','shield','heavy','sniper','atgm','carrier','launcher','pyro','mortar'], keepHp:0.45,
  apc:{ dmg:6, range:26, gap:0.12, burst:6, pause:1.2, troops:3 }, rocket:{ cd:6, salvo:4, gap:0.22, dmg:40, aoe:3.4, siegeR:60, airR:60, range:58 } };
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
  alertR:46, leash:40, guards:[3,6], tanks:[1,1], heli:[1,3], heliCd:40, reinf:2, tankCd:30, aa:{ range:26 },   // Z403 the radar's twin AA guns hose a man on the ground within aa.range m (was 62: they cut him down before he got near; now no further than his own rifle reaches)
  cut:{ speed:0.12, tanks:0.18, dmg:0.12, rate:0.15, inf:0.25, min:0.7 }, coin:380, score:2200 };
export const CAMP = { perStage: [2, 2, 2, 3, 3], hp: 420, hpPerStage: 0.18, every: 16, squad: [2, 4], infCap: 22, coin: 220, score: 900, tentScore: 60 };
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
  rarity:{ rareShare: 0.55, epicShare: 0.5 },                                // a RARE source rolls rare 55% of the time, an EPIC source epic 50%
  cache: { perStage: [2, 2, 3, 3, 3], hp: 70 },                              // guarded supply caches beside camps & towers (always rare+)
};

// TACTICS (Z95) — enemy armour fights as a unit. A director re-reads the battle twice a second and hands every engaged tank a ROLE.
// IQ (0..1) = base + perStage·(stage−1) + difficulty + NG+ loop — it decides how many tanks flank, how cleanly they encircle,
// whether they use cover, dodge your aim, fall back to their engineers, lead their shots and press when you are hurt.
export const TACTICS = {
  iq: { base: 0.2, perStage: 0.16, recruit: -0.15, soldier: 0, veteran: 0.18, loop: 0.12, cap: 1 },
  tick: 0.45,               // seconds between director passes
  engage: 40,               // tanks inside this radius of the player join the plan
  flankShare: 0.4,          // at IQ 1, up to 40% of the engaged tanks are sent round your rear
  flankFrom: 0.3,           // below this IQ nobody flanks (stage 1 recruits just charge)
  encircle: 0.85,           // at IQ 1 the ring closes to ~85% of a full circle around you
  coverFrom: 0.45,          // IQ needed before tanks park behind walls/rocks
  retreatHp: 0.3, retreatFrom: 0.35,   // badly hurt tanks fall back (toward an engineer if one lives)
  dodge: { from: 0.35, cd: 2.2, speed: 9, time: 0.45 },   // sidestep when your gun lines up on them
  press: { hp: 0.35, keep: 0.6, from: 0.5 },              // you are below 35% HP → the line closes to 60% range
  leadMax: 0.9,             // shot lead at IQ 1 (fraction of a perfect intercept)
  // Z185 SMARTER TANKS — evade: they watch your shells and break sideways out of the line (heavy hulls react less) ·
  //   jink: in a fight they weave while closing · punish: you reload → they rush in and fire faster · volley: the pack fires together (telegraphed)
  evade:  { from:0.2, look:1.0, cd:[1.0,2.0], speed:20, heavyMul:0.4, react:[0.4,0.92] },
  jink:   { from:0.45, amp:0.6, per:[2.4,3.8] },
  // Z192 line of fire: a crew this smart checks the round's path first — cover in the way → hold the shot, slide sideways (peek s) to open a line
  los:    { from:0.25, wait:0.45, peek:0.9 },
  punish: { from:0.4, keep:0.55, rate:0.55, radioGap:45 },
  volley: { from:0.55, every:[10,16], warn:0.75, minTanks:3, radioGap:35 },
};

// BOSS FIGHTS (Z96) — every general is a puzzle: armour arcs, breakable systems, three phases, stun & overheat windows, shield pylons.
export const BOSSFIGHT = {
  phases: [0.66, 0.33],                       // HP fractions where the next phase begins
  transition: { invuln: 1.8, push: 20, blastR: 9, blastDmg: 14, escorts: [0, 2, 3] },   // phase change: shockwave + escort squad
  arc: { rear: 1.6, front: 0.85 },            // hit from behind (×1.6) / head-on (×0.85) — per-boss overrides below
  stun: { time: 3.2, mul: 2.0, minImpact: 8 },   // a charge that slams into a wall/rock/tower/edge → stunned, takes ×2
  vent: { every: 3, time: 2.6, mul: 1.6 },    // after every 3rd big attack the hull overheats: stops, vents, takes ×1.6
  part: { share: 0.5 },                       // a hit on a subsystem: the part takes it all, the hull takes half
  pylon: { n: 3, hp: 240, perStage: 0.15, ring: 24 },   // shield pylons: the general is immune until every pylon falls
  barrage: { shells: 6, step: 4.2, r: 4.2, dmg: 22, lead: 1.1, gap: 0.16 },   // walking artillery line toward you
};

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
// SPACE — how much of the arena the fence encloses (custom battles); the campaign always fights on the full field
export const SPACE = { small:{ vi:'HẸP', k:0.72, tx:'đánh giáp lá cà' }, mid:{ vi:'VỪA', k:0.86, tx:'cân bằng' }, wide:{ vi:'RỘNG', k:1, tx:'cơ động, bắn xa' } };
// Z107 HULL FRONT MARKER — at speed the hull's heading is hard to read from above: a glowing chevron on the ground just ahead of the nose
//   (brighter while moving, dim at rest) + a bright stripe across the upper glacis. dist/size in hull units (× TANK_SCALE).
export const BARREL_SCALE = { r:1.22, len:1.12, slide:1.25 };   // Z235 every mounted gun: thicker (r) and longer (len) — grander — and its recoil slide longer (slide)
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
export const GUNSEAT = { rear:0.3, rearK:0.25, slim:0.32, ring:[0.8, 1.2], rays:8, grid:[-0.6, 0, 0.6], hitK:0.5, hitBulk:0.4, bulkReach:0.4, floorK:0.3, look:3, reach:1.2, deep:6, drop:1.4, side:6, peek:0.06, band:0.7, pick:0.3, slidePick:0.7, embed:0.08, back:0.12, recoil:1.2, maxShift:2.2,
  sleeve:{ min:0.03, r:[0.08, 0.45], k:1.12, flare:1.08, over:0.15 }, block:{ w:0.8, d:0.6, k:0.75, tube:2.2, lip:0.18, over:0.15, up:0.75 } };
export const HEADING = { show: false, dist: 3.9, size: 2.4, color: 0x9be04a, idle: 0.32, moving: 0.8, stripe: 0xd8ff6a };
// Z107 CONTROLS SHEET — one list, shown from the home menu, the pause menu and in battle (H / F1 / ?). [keys, what it does, group]
export const KEYS_HELP = [
  [['W','A','S','D'], 'Đi lên · trái · xuống · phải THEO MÀN HÌNH — xe tự quay đầu về hướng đó (↑←↓→ cũng được)', 'LÁI XE'], [['Cách'], 'Lướt né — bứt tốc ngắn', 'LÁI XE'],
  [['Chuột'], 'Ngắm tháp pháo', 'CHIẾN ĐẤU'], [['Giữ chuột trái'], 'Bắn liên tục', 'CHIẾN ĐẤU'], [['1','…','8'], 'Chọn súng trong kho mang theo', 'CHIẾN ĐẤU'], [['Lăn chuột'], 'Đổi súng kế tiếp', 'CHIẾN ĐẤU'],
  [['E'], 'Dùng kỹ năng', 'KỸ NĂNG'], [['Q'], 'Đổi kỹ năng', 'KỸ NĂNG'], [['Chuột phải'], 'Dùng kỹ năng (nhanh)', 'KỸ NĂNG'],
  [['G'], 'Chạm: lính xuống / lên xe · Giữ: gọi lính trong tầm về', 'QUÂN TA'], [['T'], 'TẬP KẾT — gọi toàn bộ lính trên bản đồ về bên xe', 'QUÂN TA'],
  [['X'], 'XUNG PHONG — cả đội đánh thẳng vào thành gần nhất', 'QUÂN TA'], [['B'], 'Gọi trực thăng thả lính dù xuống cạnh xe', 'QUÂN TA'],
  [['Esc','P'], 'Tạm dừng', 'KHÁC'], [['−','='], 'Camera: thu xa · phóng gần', 'CAMERA'], [['[',']'], 'Camera: xoay trái · xoay phải 45°', 'CAMERA'], [['Giữ chuột giữa + kéo'], 'Camera: xoay tự do quanh xe', 'CAMERA'], [['Ctrl/Shift + cuộn','Chụm 2 ngón'], 'Camera: zoom mượt (trackpad / chuột)', 'CAMERA'], [['Vuốt ngang 2 ngón'], 'Camera: xoay góc nhìn (trackpad)', 'CAMERA'], [['C'], 'Bật / tắt CAMERA TỰ ĐỘNG (tự lùi xa khi đông địch, chạy nhanh, gần thành, gặp trùm)', 'CAMERA'], [['V'], 'Đặt lại camera (độ zoom mặc định, hướng thẳng)', 'CAMERA'], [['M'], 'Bật / tắt nhạc nền (tiếng súng, tiếng nổ vẫn giữ)', 'KHÁC'], [['F3'], 'Bảng đo hiệu năng: FPS, thời gian khung, logic, GPU, lệnh vẽ', 'KHÁC'], [['G'], 'Lên / xuống ngựa · ngựa ở xa: huýt sáo gọi về', 'KỴ SĨ THÉP'], [['Space'], 'Trên ngựa: phi nước đại 5 s · đi bộ: chạy nước rút', 'KỴ SĨ THÉP'], [['C'], 'Đi bộ: quỳ / đứng dậy', 'KỴ SĨ THÉP'], [['Z'], 'Đi bộ: nằm / đứng dậy (nằm + di chuyển = bò)', 'KỴ SĨ THÉP'],
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
export const CAM_AUTO = { max:0.6, speedK:0.15, nearR:42, crowd:8, crowdK:0.32, fortPad:30, fortK:0.18, bossR:70, bossK:0.3, ease:0.9, every:0.25 };
// Z239 SMOOTH CAMERA — spring smoothing times (s, ~time to settle 60%): follow = the tank, lead = aim/motion look-ahead, yaw = turning the
//   view, zoom = zoom steps / pinch, dash = the pull-back during a dash (dashPull m), resume = glide back from a cinematic, kick = recoil shove ×,
//   fovEase = how fast the lens breathes with speed (1/s), orbit = mouse-drag / swipe turn rate (rad per px), wheelZoom = zoom per wheel notch ·
//   Z241 lift = heights (m) tried, lowest first, to see the tank over a wall in the way; liftT = how fast the camera rises / settles (s)
export const CAM_FEEL = { lift:[0,3,6,9,12,16], liftT:0.32, follow:0.09, lead:0.38, yaw:0.24, zoom:0.2, dash:0.22, dashPull:3.2, resume:0.6, kick:0.55, fovEase:5, orbit:0.0065, wheelZoom:0.0016,
  ride:{ heave:0.55, buzz:0.012, bank:0.22, pitch:0.5, fovAcc:0.45, ease:6 } };   // Z301 the riding camera (heave share, road buzz m, bank share of the bike's lean, pitch share, FOV ° per m/s² of throttle)
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
    war:{ sizeK:1.5, squads:1, tankFrom:3, w:{ rifle:6, rpg:1.2, scout:0.8, carrier:0.6, mortar:0.3, heli:0.3 }, shell:{ lock:1.1, flight:0.3, R:3.2, dmgK:2 }, arty:false, rings:false } },   // Z403 arty: enemy artillery at all (barrages, spotter SPGs, a battery, a boss's barrage) · rings: red rings on the ground warning of a blast   // Z309 his waves (campaign/soldier-war.js): size × the tank's, extra squads, a tank from wave tankFrom (or stage 2), weights; a tank's shell: s laying its gun, s in flight, burst radius m, damage × · Z307 soldier mode (game/mode.js): his health (no tank upgrades on him), rifle rounds at full weight on a man (a hull takes INFANTRY.vsArmour), animals let him this much closer than a tank; his skills (combat/trooper-spells.js): grenade cooldown s / blast radius m / damage, smoke cooldown / toss m, dressing cooldown / health
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
export const REALTANK = { gearK:0.72, dev:[0.82, 1.22], overGear:1.02, tint:0.85, shade:0.88, env:0.6, gun:[0.3, 0.13, 0.4, 3, 0.12],
  fams:{ west:{ designs:['abrams','leo2a7','leclerc','ch3','k2','colossus'] }, east:{ designs:['lqt','t90m','type99','flametank','arv'] }, merkava:{ designs:['merkava'] },
    armata:{ designs:['t14','ghost'] }, ifv:{ designs:['ifv','recon','atgmv'] }, spg:{ designs:['spg','td'] }, ugv:{ designs:['ugv'] } } };   // a vehicle built without a model name (launcher truck, fireteam APC) stays procedural
// Z403 SIDE ID (world/sidepaint.js markSide · tank/materials.js sideCoat): ours and theirs told apart at a glance and at range. coat = how much of a real model's
//   own colour gives way to its side's paint, laid over the texture's light and shade (gain [min, max] = 1 / the texture's mean luminance, clamped); metal = how
//   much of the texture's metal the coat knocks back (paint is not bare steel); detail = how much of the texture's light and shade the coat keeps; bright = the coat's albedo × the paint colour; sat = its saturation × (paint, not plastic); paint = each side's colour before the battlefield shift (f ours olive drab,
//   e theirs desert tan — the shift still pulls them off the ground: theirs crimson on sand, ours only lighter or darker); rim = the side's colour round the silhouette (× rimK,
//   rimPow = how tight to the edge; the player's own tank keeps its skin and wears the rim); panel = the lime recognition panel on our captured tanks' turret roof (m)
export const SIDE_ID = { coat:0.75, metal:0.5, detail:1, bright:0.42, sat:0.65, gain:[1.5, 14], paint:{ f:0x5a6e38, e:0xa47a4a }, rim:{ f:0x8cff4a, e:0xff3a22 }, rimK:{ f:0.28, e:0.2 }, rimPow:4, panel:0.95 };
// Z262 REAL TREES (world/real-trees.js): thirteen Meshy species, each at its true height h (m) before the tree's own ± scale; map = which species a
//   battlefield's procedural tree kinds become (variant i takes species i mod the list; `_` = everywhere else); wind = its direction, how far the top
//   sways (m), how far the leaves flutter (m); env = reflections; tint = albedo × per species
export const REALTREE = { trans:1.6, env:0.45, wind:{ dir:[1, 0.35], sway:0.45, leaf:0.06 }, tint:{},
  h:{ oak:15, linden:12, birch:11, poplar:18, pine:17, spruce_snow:14, palm:12, acacia:8, baobab:13, dead:9, cypress:14, olive:7, giant:20 },
  map:{ _:{ broadleaf:['oak','linden','birch','poplar'], conifer:['pine'], coniferSnow:['spruce_snow'], palm:['palm'], acacia:['acacia'], baobab:['baobab'], dead:['dead'], ancient:['giant'] },
    MEADOW:{ broadleaf:['oak','linden','birch','poplar','oak','pine','linden','birch'] }, CITADEL:{ broadleaf:['olive','cypress','oak','cypress','olive','linden','olive','cypress'] },
    QUARRY:{ broadleaf:['olive','cypress','pine','olive'] }, RUINS:{ broadleaf:['linden','birch','oak','birch'] },
    CITY:{ broadleaf:['linden','oak','birch','poplar','linden','cypress'], palm:['palm'] } }, citySize:1.3 };   // Z266 street trees: a city mix, a little smaller than in the wild (÷ citySize)
// Z262 TREE FALL (world/tree-fall.js): push = the starting swing (rad/s) a tank's ram gives, shotPush = a shell's / blast's; trunk = the trunk's hit
//   radius (m × the tree's scale), hitH = the height a round still strikes the tree; minDmg = the least damage a round needs to fell one; a blast of
//   radius r fells trees within blastK·r (blasts under minBlast m don't); g, cg = where its weight sits (× height); bounce = what is left after it lands
export const TREEFALL = { push:0.18, shotPush:0.7, trunk:0.75, hitH:9, minDmg:20, minBlast:2.5, blastK:0.75, g:9.8, cg:0.45, bounce:0.18,
  band:[0.4, 1.3], giantBand:[0.6, 2.2] };   // Z404 the trunk a vehicle meets: the drawn bark between band m over the foot (a giant's higher, over its roots), its median distance from the axis
// Z265 REAL STREETS (world/stone.js streetSurface): wet = the share of the street under puddles (0 = dry), wheel = how much darker the wheel paths,
//   oil = the drip line's strength, patch = the share of 3 m cells re-laid with newer asphalt, dampDark = how dark the damp rims, rough = roughness ×,
//   nrm = photo normal strength, env = reflection strength (the puddles mirror the sky), puddle = the wetness-noise level above which water stands (lower = more), mirror = extra sky reflection in it
export const STREET = { wet:0.9, puddle:0.55, mirror:3.5, wheel:0.2, oil:0.6, patch:0.08, dampDark:0.42, rough:1.0, nrm:1.4, env:1.0 };
// Z264 REAL CITY (world/real-city.js): Meshy buildings by role (tower / apartment / row — cut into floor slices) and vehicles (carFor = which model a
//   procedural car body becomes; L = its length in m, carTint = how far a car's paint colour tints the model); yaw = the turn that brings the model's front to +Z; share = the chance a lot takes a Meshy building
export const REALCITY = { pools:{ r:5.5, reach:1.5, col:0xffc888, k:0.55 }, env:0.8, share:1, asphalt:[0.62, 0.62, 0.64], pavement:[0.72, 0.72, 0.72], lawn:[0.78, 0.9, 0.62],   // street photo albedo ×
 
  blds:{ bld_glass:{ role:'tower', env:1.3 }, bld_apart:{ role:'apartment' }, bld_hotel:{ role:'apartment' }, bld_office:{ role:'apartment' }, bld_shophouse:{ role:'row' }, bld_shoprow2:{ role:'row' }, bld_villa:{ role:'villa' }, bld_landmark:{ role:'landmark', env:1.2 }, bld_spire:{ role:'skyline', env:1.25 }, bld_palmspire:{ role:'skyline', env:1.2 },
    bld_burj:{ role:'skyline', env:1.25 }, bld_needle:{ role:'skyline', env:1.1 }, bld_curve:{ role:'skyline', env:1.25 }, bld_nexus:{ role:'skyline', env:1.1 }, bld_rise:{ role:'skyline', env:1.1 }, bld_lm81:{ role:'skyline', env:1.2 } }, landmarkH:150, landmarkSink:0.035,   // Z268 the Tripo tower stands on a lawn plate: that sinks into the plaza (Z426 the rest of the downloaded towers: skyline)
 
  // Z267 the street furniture (world/real-city.js prepProp): h = height, w = width, s = scale (the Poly Haven scans are true size), glow = the material that lights at night
  props:{ prop_lamp:{ h:4.6, glow:'glass' }, prop_gate:{ s:1 }, prop_hydrant:{ s:1.1 }, prop_bin:{ s:1 }, prop_bench:{ s:1 }, prop_cafe:{ s:1 }, prop_chair:{ s:1 }, prop_barrier:{ s:1.3 }, prop_tarpcar:{ s:1.05 },
    city_fountain:{ w:11, sink:0.12 }, city_signal:{ h:2.1 }, city_stall:{ h:2.7 } }, glowCol:0xffd9a0, signalAt:2.5,
  // Z268 → Z420 the towers that stand with Landmark 81 on the skyline (world/wonders.js): k = the model, h = its height (m), turn = its bearing off the landmark's
  //   (rad), out = its distance × the landmark's, sink. The CBD reads as a cluster: the glass spire to one side (where the Bitexco stood), the Palmspire
  //   just behind and beside the landmark, the centre of the far city
  skyline:[ { k:'bld_spire', h:124, turn:0.5, out:1.22, sink:0.03 }, { k:'bld_palmspire', h:136, turn:-0.2, out:1.42, sink:0.02 },
    { k:'bld_nexus', h:68, turn:-0.42, out:1.12, sink:0.02 }, { k:'bld_curve', h:108, turn:0.24, out:1.58, sink:0.02 }, { k:'bld_needle', h:74, turn:-0.78, out:1.3, sink:0.01 },
    { k:'bld_rise', h:150, turn:-1.05, out:1.72, sink:0.02 }, { k:'bld_lm81', h:118, turn:0.78, out:1.9, sink:0.02 }, { k:'bld_burj', h:172, turn:1.08, out:2.05, sink:0.03 } ],   // Z426 a far CBD: the curved tower, the Space Needle, the tower still in its cranes, the purple-lit spire and the Burj far out
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
export const REALGUN = { dev:[0.55, 2.6], env:0.7, tankTint:0x83867e,
  fams:{ cannon:{ fromTank:'west', guns:['cannon'] }, hesh:{ fromTank:'east', guns:['hesh'] }, canister:{ fromTank:'spg', guns:['shotgun'] }, auto:{ fromTank:'ifv', dev:[0.3, 0.5], guns:['rifle'] },
    mg:{ front:'-x', guns:['smg','agl'] }, flak:{ front:'+x', pair:true, guns:['flak'] }, pod:{ front:'+z', guns:['missile','hydra','thermo'] }, flamer:{ front:'+x', guns:['flamer','cryo'] },
    energy:{ front:'+x', glow:true, guns:['railgun','photon','plasma','tesla'] } } };   // procedural: mortar, arty, rocket (tilted lobbers), minigun (spinning barrels), orbital, singularity
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
  hex:{ on:true, mobile:true, s:0.7, rot:0, exp:5, con:0.6 }, nrmVar:0.35, hexPer:{},   // Z263 stochastic sampling (no repeat grid); ntFreq = patches per photo tile; hi = the base set at 2K (colour + normal) off phones
  // albedo × per battlefield: the scene's sun and exposure were tuned for the darker procedural ground — a photo albedo needs bringing down
  tint:{ _:[0.58, 0.6, 0.54], MEADOW:[0.9, 1.0, 0.72], HILLS:[0.47, 0.6, 0.39], VILLAGE:[0.52, 0.6, 0.44], SAVANNA:[0.7, 0.6, 0.5], DESERT:[0.76, 0.64, 0.5],
    TUNDRA:[0.8, 0.83, 0.88], ARCTIC:[0.84, 0.87, 0.92], CITY:[0.66, 0.66, 0.66], FOUNDRY:[1.02, 0.97, 0.92], STEELMILL:[1.02, 0.97, 0.92], VOLCANO:[0.72, 0.66, 0.62] },   // Z394 the works' concrete is a darker photo; the volcano's scree under its red light
  biomes:{
  MEADOW:['sparse_grass','forest_ground_04'], HILLS:['leafy_grass','rock_ground'], VILLAGE:['grass_path_2','brown_mud_02'], SAVANNA:['dry_ground_rocks','mud_cracked_dry_03'],
  DESERT:['aerial_sand','dry_ground_rocks'], TUNDRA:['snow_01','rock_ground_02'], ARCTIC:['snow_01','snow_03'], VOLCANO:['rocks_ground_02','brown_mud_rocks_01'],
  QUARRY:['rocks_ground_05','rocks_ground_06'], FOUNDRY:['concrete_floor_damaged_01','burned_ground_01'], STEELMILL:['concrete_floor_damaged_01','burned_ground_01'], CITY:['asphalt_01','cracked_concrete'],
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
export const INFGUN = { map:{ rifle:'ar', carbine:'ar', t_lmg:'lmg', t_minigun:'minigun', t_shotgun:'shotgun', t_sniper:'sniper', t_rpg:'rpg', t_gl:'gl', t_flamer:'flamer', t_energy:'energy', t_ak:'ak', t_m4:'m4', t_mp5:'mp5', t_rust:'rust', t_dmr:'dmr', t_rail:'rail', t_saw:'saw', smg:'lmg', flak:'lmg', minigun:'minigun', shotgun:'shotgun', cannon:'sniper', hesh:'sniper', railgun:'sniper', missile:'rpg', rocket:'rpg', thermo:'rpg', hydra:'rpg',
    agl:'gl', mortar:'gl', arty:'gl', flamer:'flamer', cryo:'flamer', tesla:'energy', plasma:'energy', photon:'energy', orbital:'energy', singularity:'energy' },
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
  sniper:{ palm:-0.068, butt:[0.5, -0.02], grip:[0.27, -0.08], fore:[0.02, -0.05], kick:[0.09, 0.16] }, rpg:{ hold:'top', palm:-0.1, butt:[0.4, 0.0], grip:[0.31, -0.08], fore:[-0.06, -0.12], kick:[0.05, 0.1], mag:[-0.5, 0.0],
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
// Z340 TURNED ROUND IN THE SADDLE (actors/real-cav.js, combat/soldier-fire.js): sat on the horse or a pillion his hips and chest together turn up to `max`
//   either way from the mount's heading (rad, ~170°: nearly all the way round, never right round); hip = how far the hips swing on the horse's saddle
//   (the chest twists the rest; a pillion keeps REALCAV.seatTurn[1]); flip = how far past straight behind the aim must be before he swings back the
//   other way, round the front; swing = how fast that long way round (rad/s); lead = how far his arms lay the gun ahead of his chest; fire = the trigger
//   waits while the bore is more than this off the aim (no rounds out of his back while he turns)
export const RIDER_TURN = { max:2.97, hip:1.0, flip:0.3, swing:4.4, lead:0.35, fire:0.4 };
// Z243 shield pylon SITES (round the general): metres clear of our citadel's wall ring (coreGap) / a fortress (fortGap) / any wall, cover or building (clear) /
//   the fence (edge) / each other (apart); rings = radii tried (× pylon.ring), steps = angles tried per ring; pillar = height of the light pillar (m)
export const PYLON_SITE = { coreGap:14, fortGap:10, clear:4, edge:8, apart:16, rings:[1,1.35,0.8,1.7], steps:16, pillar:60 };
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
export const SHAKE = { levels:{ off:0, low:0.32, mid:0.6, high:1 }, def:'low', pos:0.7, roll:0.018, aberr:0.0035 };
export const TOUCH_HELP = [
  ['Cần lái (nửa phải màn hình)', 'Đẩy về hướng muốn đi — tháp pháo tự xoay bám địch, xe đi đâu nòng vẫn ngắm mục tiêu'],
  ['BẮN (trái)', 'Giữ để bắn · TỰ BẮN: tự khai hoả khi nòng đã chĩa trúng địch'], ['LƯỚT', 'Bứt tốc né đòn'], ['SÚNG', 'Đổi súng'], ['KỸ NĂNG', 'Dùng / đổi kỹ năng'],
  ['LÍNH', 'Chạm: lính xuống / lên xe · Giữ: gọi lính về'], ['TẬP KẾT / XUNG PHONG / LÍNH DÙ', 'Ba nút chỉ huy quân ta'], ['TỰ ĐỘNG', 'Camera tự động: tự lùi xa khi đông địch / gần thành, tự gần lại khi yên'], ['1.5× · ⟳', 'Đổi độ zoom · xoay góc nhìn 45°'], ['⏸', 'Tạm dừng — có nút bật/tắt nhạc nền và nút xem bảng điều khiển'] ];
// Z107 FORTRESSES (ĐẠI BẢN DOANH) — every stage the enemy holds 3–4 walled strongholds, each with a name and a commander.
//   Walls (solid, block fire) with riflemen along the top, watchtowers at the corners, ONE heavy gate that must be shot
//   continuously to break. Inside: a crowded garrison (it pours out once you come near or the gate falls) + the commander.
//   Troops and tanks on the open field SALLY from these gates. Take every fortress = win the stage: the main citadel's gate
//   stays sealed until the others have fallen, and its commander is the stage boss.
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
  curtain:{ k:'castle_wall', w:20, gate:'gatehouse', gateS:0.75 }, bocage:{ step:6.5, trees:['tree_oak', 'tree_pine'], s:[0.5, 0.7], bank:'logs' },
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
  tiers:{ 1:[ ['bunker_green|bunker_store', 0, 0, 0, 'main'], ['bunker_sandbag', 2.5, 9.5, 0.35, 'mg'] ],
          2:[ ['bunker_hangar|bunker_store', 0, 0, 0, 'main'], ['radar_sentinel', -3, -11, 0, 'comms'], ['bunker_dome', 11, 7, -0.3, 'pillbox'], ['bunker_sandbag', -11, 8.5, 0.3, 'mg'] ],
          3:[ ['hq_modular', 0, 0, 0, 'main'], ['antenna_twin', 15, -6, 1.5708, 'comms'], ['radar_sentinel', -12, -9, 0, 'comms'], ['gun_turret', 13, 10, -0.35, 'gun'], ['bunker_sandbag', -12, 10, 0.35, 'mg'] ] },
  name:{ 1:'TRẠM CHỈ HUY', 2:'SỞ CHỈ HUY', 3:'BỘ TỔNG HÀNH DINH' } };
export const FORT = {
  count:[3,3,4,4,4], countMobile:[2,2,3,3,3],   // Z234 phones: the 130 m field holds fewer forts now that they stand clear of our citadel
  tiers:{ 1:{ r:[31,35], sides:[6,8], towers:2, gunners:[8,10],  inf:[16,22], tanks:[1,2], gate:600,  cover:[8,11],  name:'ĐỒN' },        // Z107 roomy: room to manoeuvre and dodge inside
          2:{ r:[35,40], sides:[6,8], towers:4, gunners:[10,14], inf:[24,32], tanks:[2,3], gate:950,  cover:[11,14],  name:'PHÁO ĐÀI' },
          3:{ r:[41,45], sides:[8,8], towers:4, gunners:[14,18], inf:[30,40], tanks:[3,5], gate:1450, cover:[14,18], name:'THÀNH' } },
  gatePerStage:0.22, mobileMul:0.6, mobileR:0.8, minR:26,   // Z234 mobileR: fort radius on phones (the 130 m field) · minR: never smaller (the gate wall needs its length)
   wallH:11.0, wallT:3.2, gateW:7.0, seg:3,   // Z241 great walls: 7 → 11 m high, 2.4 → 3.2 m thick
  // Z241 ARCHITECTURE (m): tall corner towers rise `tall` above the wall-walk (width tallW), the other corners are squat bastions (bastW, +bastH);
  //   curtain walls longer than flankMin get a flanking tower (flankW, +flankH) proud of the outer face; gate towers +gateH[tier<3, capital], gateW2 wide;
  //   the capital's donjon keepW wide, keepH high, its four turrets +turret above it
  arch:{ tall:12, tallW:5.2, bastW:4.4, bastH:4.5, flankMin:22, flankW:6.0, flankH:6.5, gateH:[12,16], gateTW:[5.2,6.4], keepW:15, keepH:34, turret:8, flagH:[20,24] },
  wakeR:52, liveInf:16, liveInfMobile:9, liveTanks:3, liveTanksMobile:2,     // wake distance (+ the fortress radius) · garrison on the field at once (refilled from the fortress pool)
  sally:[10,16], sallyInf:[3,6], sallyTank:0.4, fromGate:0.7,                  // seconds between sallies per fortress · squad size · tank chance · share of wave spawns out of a gate
  cmdType:'chief', cmdHp:8, tunnel:[1,2], cmdScale:1.0, escort:[6,10], escortMobile:[4,6], escortR:[4,8],   // Z107 the commander: a SMALL nimble tank (slow, deadly, leading shots) ringed by bodyguards
  ram:{ minV:6, fullV:15, gate:0.5, wall:0.55, buffMul:1.5, cd:0.4 },    // Z111 RAMMING: a hit at 15+ takes 50% of a gate / 55% of a wall section → 2 rams open either
  gate:{ open:4.5, speed:0.9, inner:5, outer:6, exitMax:18 },                       // Z111b the gate swings open for every sortie (stays open while troops file through) and shuts behind them
  posture:{ near:40, tank:10, inf:1, allyTank:4, gInf:0.6, gTank:3, holdK:0.6, every:[5,8], waveInf:4, waveTank:1 },   // Z111b we come close: our strength (tank 10×hp% + 1/soldier + 4/captured tank) ≥ 0.6× the garrison's → they SHUT THE GATE and hold; weaker → they open up and sally in waves
  wallHpK:0.8, wallShotK:1, shotStructMin:1,                            // Z111 easier sieges: a wall section has 0.8× the gate's HP and takes full shell damage; vs gate/wall every gun hits at least ×1 (the rifle's KIN ×0.6 no longer applies)
  loot:{ coins:[700,260], dia:[1,2], drops:3, gunChance:0.35 },
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
export const TANK_BLAST = { r:4.2, dmg:70, edge:0.25 };   // Z113 a tank's magazine going up kills men within r × tank scale (edge = damage share at the rim) — theirs and ours
// Z402 A KILLED TANK BLOWS APART AND IS GONE (fx/dying.js — enemy tanks and vehicles, our captured tanks, the boss): no burning phase, no wreck — the blast,
//   its torn steel thrown out (fx/debris.js spawnTankWreck: glowing, lands, gone within chunkLife s, the last fade s fading), a smoke puff (smokeK = the
//   blast's rolling cloud lasts this share of its usual life) and in that same frame the hull leaves the field and its collider. wreck = the life of
//   fx/fire-wrecks.js spawnWreck's burning hulk (no kill leaves one any more)
export const TANK_DEATH = { chunkLife:[1.3, 2.1], fade:0.6, smokeK:0.45, wreck:[9,13] };
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
export const TENT = { burn:2.2, sag:0.45, eye:{ tank:2.4, man:1.5, mid:1.1 } };
// Z115 GUN PARTS (linh kiện súng) — pickups that upgrade a gun FOR GOOD, per gun, stacking up to `max` levels each:
//   barrel = NÒNG TINH CHẾ (+dmg, +range) · action = KHOÁ NÒNG (faster fire + reload) · mag = BĂNG ĐẠN MỞ RỘNG (+rounds)
//   They fit the gun in your hands; if it is maxed they go to another carried gun, else they pay coins. Rare from tough kills, one per fortress taken.
export const GUN_MODS = { max:5, barrel:{ dmg:0.06, rng:0.04 }, action:{ fire:0.05, reload:0.06 }, mag:{ mag:0.12 }, rareShare:0.15, epicShare:0.25, fortDrops:1, coins:150 };
// how many tubes each gun really has (shown on the gun card)
export const GUN_BARRELS = { smg:2, flak:2, minigun:7, missile:2, thermo:4, rocket:1 };
// Z117 GAMEPAD (Gamepad API "standard" mapping — Xbox-layout pads: Flydigi Direwolf 4 in XInput/Switch mode, Xbox, DualSense, Switch Pro…)
//   def = the player's settings (PROFILE.pad): vib on/off · vibK strength · engine hum · dead zone · auto-aim on release · swap A/B (Nintendo labels)
export const PAD_CFG = { def:{ vib:true, vibK:0.8, dead:0.15, assist:true, swapAB:false, phone:true, sens:1, lob:true },
  lob:{ min:10, maxMul:1.5, speed:26, dead:0.1, arc:Math.PI/2, ease:10 },   // Z128 high-angle guns (mortar / rocket) on a pad: the barrel is tied to the hull's FRONT 180° arc; right stick ←/→ swings inside it, ↑/↓ lengthens / shortens the shot (m/s)
  aim:{ slew:4.2 /* Z145 superseded by TURRET.rate */, k:9, minMag:0.3, smooth:0.035 },   // Z124 right stick: the gun follows the stick angle with an eased, rate-capped swing (rad/s) — no snap, no jitter near the dead zone
  hull:{ k:6, ease:9, speedFull:0.92 },              // Z124 left stick: the hull turns in proportion to the angle error (eased); stick tilt sets the TOP SPEED (full tilt = full speed)
  sensSteps:[['THẤP',0.7],['VỪA',1],['CAO',1.35]], rtFire:0.35, assistAfter:0.45, phoneTick:{ ms:14, gap:150 }, navFirst:0.26, navRepeat:0.14 };
// Z145 TURRET TRAVERSE: the gun swings at a real, capped rate (rad/s) — mouse a little quicker than the stick — and the player sets the speed
//   (PROFILE.turretK, Settings → TỐC ĐỘ XOAY NÒNG: presets or ± 10% steps)
export const TURRET = { rate:2.6, mouseMul:1.7, k:9, min:0.3, max:2.5, step:0.1, steps:[['CHẬM',0.6],['VỪA',1],['NHANH',1.5]] };
export const PAD_HELP = [
  ['Cần trái', 'Lái xe (theo màn hình, hoặc kiểu xe tăng nếu chọn trong Cài đặt)'], ['Cần phải', 'Xoay nòng ngắm — thả ra: tự ngắm địch gần nhất. Cối / tên lửa tầm xa: ←→ xoay trong cung 180° trước mũi xe, ↑↓ chỉnh tầm bắn'],
  ['RT', 'Bắn (giữ = liên thanh)'], ['LT', 'Dùng kỹ năng'], ['A', 'Lướt né'], ['B', 'Chạm: lính xuống xe · Giữ: gọi lính về'], ['X', 'Đổi kỹ năng'], ['Y', 'Bật / tắt tự bắn'],
  ['LB · RB', 'Súng trước · súng sau'], ['D-pad ↑', 'Tập kết toàn quân'], ['D-pad ←', 'Xung phong vào thành'], ['D-pad ↓', 'Gọi lính dù'], ['D-pad →', 'Camera tự động'],
  ['L3 (nhấn cần trái)', 'Đổi mức thu phóng'], ['R3 (nhấn cần phải)', 'Đặt lại camera'], ['☰ Menu', 'Tạm dừng'], ['⧉ View', 'Bảng phím'],
  ['Trong menu', 'D-pad / cần trái chọn · A bấm · B quay lại'], ['M1 · M2 (nút sau)', 'Gán trong ứng dụng Flydigi Space Station, ví dụ M1 = A (lướt), M2 = B (lính)'] ];
// Z119 BATTLE INTRO: cinematic view distance + fog (the sweep no longer draws the whole field), shader warm-up time budget, skip guard
// Z288 the city opens on film: Landmark 81 from its foot (tilt up), then a tracking shot down the busiest boulevard (seconds, lens fov, camera speed m/s)
export const INTRO_CITY = { on:true, l81:{ dur:3.4, fov:36, back:0.95 }, street:{ dur:3.2, fov:48, v:9, h:1.5, off:4.2 } };
// Z322 THE INTRO'S SKY (game/intro-clouds.js): band = the cloud deck between these shares of the descent's height (0 = landing, 1 = high orbit);
//   puffs laid along the swoop (it flies through them) + wisps over the field; size (m), opacity of each, sideways drift (m/s); haze = the screen
//   mist at the top of the flight; inside = the whiteout inside a puff; tintK = how far the fog colour is lifted toward white (day; a third at night)
// Z325 BLEND-IN (render/blend-in.js): every lit opaque material on the field, once the stage is built — hue = share of the field's hue (the floor's
//   average colour over its brightness, clamped tintMin..tintMax per channel), desat = saturation taken off, dust = share of ground colour at the
//   foot of things, fading out over dustH metres above where each stands
export const BLEND = { on:true, hue:0.25, desat:0.12, dust:0.36, dustH:1.4, tintMin:0.7, tintMax:1.45, aoH:0.9, ao:0.5 };
// Z400 CONTACT (world/decals.js paintContact, read by the ground's shader): things stood on the floor like cut-outs — a hard line where a wall met the grass, no
//   shade under a rock, the same clean sand right up to a pipe. Once a stage is built every solid footprint (blocks: walls, cover, rocks, camps,
//   buildings; the scenery's pieces) is painted into a field-wide map: shade = the floor darkened tight round it (pad m out, blurred over shadeB m:
//   the light the thing takes from the ground), skirt = trodden, dirtied earth further out (skirtW m + ragged blotches, blurred over skirtB m), tinted
//   by col (× the floor's own colour, per battlefield). BLEND.aoH / ao: the thing's own foot darkened over aoH m from where it truly meets the ground.
export const CONTACT = { on:true, res:[2048, 1024], pad:0.2, shadeB:0.8, shade:0.62, skirtW:1.5, skirtB:1.5, skirt:0.68, rK:0.85, sceneK:0.5, blot:[0.5, 1.4],
  col:{ _:[0.64, 0.56, 0.46], MEADOW:[0.58, 0.47, 0.32], RUINS:[0.6, 0.5, 0.38], CITADEL:[0.66, 0.56, 0.44], SAVANNA:[0.66, 0.54, 0.42], DESERT:[0.74, 0.62, 0.5],
    ARCTIC:[0.7, 0.72, 0.76], TUNDRA:[0.7, 0.72, 0.76], CITY:[0.6, 0.58, 0.56], FOUNDRY:[0.58, 0.54, 0.5], STEELMILL:[0.58, 0.54, 0.5], VOLCANO:[0.66, 0.6, 0.56], QUARRY:[0.66, 0.62, 0.56] } };
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
  ['fire','Bắn (giữ = liên thanh) · chuột trái','CHIẾN ĐẤU',[],7,1], ['dash','Lướt né · lính đi bộ: nhảy','CHIẾN ĐẤU',[' '],0,0], ['sprint','Lính: chạy nhanh (giữ)','CHIẾN ĐẤU',['shift'],null,1], ['roll','Lính: lăn né đạn','CHIẾN ĐẤU',['alt','l'],null,0], ['skill','Dùng kỹ năng · chuột phải','CHIẾN ĐẤU',['e'],6,0], ['skillNext','Đổi kỹ năng','CHIẾN ĐẤU',['q'],2,0],
  ['gunPrev','Súng trước · cuộn chuột','CHIẾN ĐẤU',['r'],4,0], ['gunNext','Súng sau · cuộn chuột','CHIẾN ĐẤU',['f'],5,0], ['autoFire','Bật / tắt tự bắn','CHIẾN ĐẤU',['y'],3,0], ['gunDefault','Về súng mặc định (tay cầm: LB + RB cùng lúc)','CHIẾN ĐẤU',['0'],null,0], ['autoAim','Bật / tắt tự ngắm (nhấn cần phải)','CHIẾN ĐẤU',['k'],11,0],
  ['crew','Lính xuống xe · giữ: gọi về','QUÂN',['g'],1,1], ['muster','Tập kết toàn quân','QUÂN',['t'],12,0], ['assault','Xung phong vào thành (L3)','QUÂN',['x'],10,0], ['para','Gọi lính dù','QUÂN',['b'],13,0], ['sqOrder','Lệnh tổ bộ binh: tự do → giữ vị trí → tiến công → vòng trái → vòng phải','QUÂN',['u'],null,0],
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
// Z395 NEAR DETAIL (render/near-detail.js): the originals' sharp maps (assets/models/real/hd, tools/hd-maps.mjs) put on a model while the camera is within
//   its reach — radius × rK m from its surface, at least min, at most at (each instance of an instanced mesh counts) — handed back past reach × out for hold s,
//   or when maxKeys closer models hold theirs (GPU memory) · every: how often the nearest is measured (s) · maxInst: instances measured per mesh ·
//   shapes: placed meshes drawn from their whole original at once (render/near-detail.js nearShape: camps, parked vehicles, ruins, animals, the soldier's gun) ·
//   hero: the reach (m) of the player's own ride and its driver (the chase camera sits ~6 m behind them)
//   Z411 frame: an original whose extents miss the shipped mesh's axes by more than tol (share of its longest side) is turned axis-aligned back over it
//   (render/near-detail.js sameFrame) — the turn whose surface lands most in the shipped surface's cells (grid³ of its box, samples of its vertices)
export const NEARDETAIL = { on:true, rK:3, min:5, at:30, out:1.4, hold:4, every:0.3, maxKeys:8, maxInst:4000, shapes:16, hero:12,
  trees:{ n:12, at:34, every:0.2 }, frame:{ tol:0.04, grid:16, samples:6000 } };   // trees: the n standing nearest the camera within at m drawn whole from the original (world/real-trees.js), re-picked every s
export const LOD = { shadowR: 26, guardR: 70, every: 0.25, tankDetailR: 38, smallR: 0.9,
  detailR: 3, detailPx: 1.6, detailHys: 1.35, rescan: 2 };   // Z240 pieces under detailR m are skipped once their on-screen size × fog transparency drops under detailPx px (back in above ×detailHys); the list is rebuilt every rescan s   // Z233 enemy tanks past tankDetailR (from the camera) drop fittings smaller than smallR
// Z107 POWER RATING — one number for how strong YOUR tank is, and what each level asks of it, on the same scale.
//   Fight ratio F = time-to-die ÷ time-to-clear-a-wave. Your side: sustained DPS (mag + reload, mastery, upgrades, armour-type
//   effectiveness vs that level's wave mix, crowd bonus for blast/pierce/chain) and effective HP (HP ÷ (1−armour), dodge from speed).
//   Level side: the real wave composition (wavePool) × HP ramp × NG+ × difficulty, and the damage it pours in (accuracy → hit
//   chance, fire chance, rate, burst, specials). 1000 = a brand-new tank (rifle, no upgrades) on campaign level 1 = "even".
export const POWER = { waves:[2,3,4,5], hitHalfW:0.085, engaged:0.55, infHit:0.3, dodgeK:0.5, eliteK:true,
  special:{ scout:1.0, bomber:3.0, mortar:1.8, carrier:2.4, atgm:2.3, pyro:3.8, gunship:3.0, engineer:0 },   // est. DPS on you from non-gun attackers (ROSTER/def numbers)
  crowd:{ aoe:1.35, pierce:1.15, chain:1.25 }, mix0:{ L:0.3, M:0.4, H:0.3, A:0 },
  calib:1.18,   // measured in simulated waves: level 1→3 got ~20× harder vs the formula's 12.6× (fortress sallies) → threat growth ^1.18
  bands:[[1.2,'DỄ','#9be04a'],[0.92,'VỪA SỨC','#ffd24a'],[0.75,'KHÓ','#ff9a4a'],[0,'QUÁ SỨC','#ff5a4a']] };
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

// Z162 SPECIAL AMMO — bought in boxes (one box = one battle stage), one kind loaded per stage from the shop's ĐẠN tab
export const AMMO_SHOP = [
  { id:'ap',  vi:'ĐẠN XUYÊN GIÁP', desc:'+15% sát thương · +20% lên tướng · giáp trước tướng không còn chặn nhiều', box:3, price:{ c:900 },  fx:{ dmg:0.15, boss:0.20, front:0.8 } },
  { id:'he',  vi:'ĐẠN NỔ MẠNH',    desc:'+10% sát thương · vụ nổ đạn rộng hơn 40%',                              box:3, price:{ c:800 },  fx:{ dmg:0.10, splash:0.40 } },
  { id:'inc', vi:'ĐẠN CHÁY',       desc:'1/4 phát trúng làm xe địch bốc cháy, cháy âm ỉ vài giây',               box:3, price:{ c:1000 }, fx:{ burn:0.25 } },
  { id:'sup', vi:'HỘP TIẾP ĐẠN',   desc:'băng đạn lớn gấp rưỡi · nạp nhanh hơn 15%',                              box:3, price:{ c:700 },  fx:{ mag:0.5, reload:0.15 } },
];
// Z162 what one run may pay out — the server clamps every report to this (minutes are measured by the server, not the client)
export const PAYOUT_CAP = { coinPerMin:600, coinBucket:6000, coinPerClear:2500, diaPerMin:0.3, diaBucket:20, diaPerClear:6, loopMul:0.6, minClearGap:90, gunGap:120, migrateCoins:300000, migrateDia:1000, migrateReach:10, migrateValue:250000, migrateUntil:Date.UTC(2026,11,31), gunPerReach:1200,
  scorePerMin:9000, scoreBucket:60000, scorePerClear:25000, runBase:30000, runPerClear:40000, runMaxH:3 };   // a run's total is also capped by the stages it validly cleared, and a run closes after runMaxH hours   // Z163 leaderboard: a run's score is accepted from its own refilling bucket too   // migration: only until the window closes, wallet + inventory worth at most migrateValue coins   // token buckets: bursts are fine, the average rate is capped
// Z167 ROOF MACHINE GUN — a pintle MG on the turret roof, worked by the crewman in the hatch: 360° traverse, elevates onto towers, shoots ONLY infantry
//   (and the men on walls / towers), shorter reach and lighter hits than the main gun. Belt-fed: a box empties, the gunner swaps it by hand.
export const ROOF_MG = [
  { id:'pkt',  vi:'PKT 7,62 LY',          origin:'NGA',  desc:'Súng máy đồng trục quen thuộc của tăng Nga, gắn lên giá nóc: nhẹ, xoay nhanh, bắn rát.',             cal:7.62, dmg:4.0, rof:11, mag:100, reload:3.6, range:20, spread:0.055, trav:3.0, elev:2.0, price:null },
  { id:'m240', vi:'M240 7,62 LY',         origin:'MỸ',   desc:'Súng máy đa năng của Mỹ, giá xoay có tấm chắn: chính xác hơn, thay hộp đạn nhanh.',                cal:7.62, dmg:4.6, rof:10, mag:100, reload:3.0, range:21, spread:0.045, trav:2.8, elev:2.0, price:{ c:1800 } },
  { id:'m2hb', vi:'M2HB 12,7 LY "BÀ GIÀ"', origin:'MỸ',  desc:'Súng máy hạng nặng huyền thoại: mỗi phát đủ quật ngã một người sau bao cát, nhưng nặng và xoay chậm.', cal:12.7, dmg:9.0, rof:8.5, mag:80, reload:4.4, range:24, spread:0.05, trav:2.0, elev:1.5, price:{ c:3600 } },
  { id:'nsvt', vi:'NSVT UTYOS 12,7 LY',   origin:'NGA',  desc:'Súng phòng không trên nóc T-72: tốc độ bắn cao cho cỡ 12,7, nâng nòng rất cao để quét lính trên tháp.', cal:12.7, dmg:8.5, rof:11, mag:60, reload:4.0, range:24, spread:0.055, trav:2.3, elev:2.4, price:{ c:4400 } },
  { id:'kord', vi:'KORD 6P50 12,7 LY',    origin:'NGA',  desc:'Thế hệ mới, giảm giật: bắn loạt dài vẫn chụm, nòng ít nóng — súng máy nóc tốt nhất.',              cal:12.7, dmg:10,  rof:10.5, mag:90, reload:3.8, range:26, spread:0.038, trav:2.4, elev:2.2, price:{ d:18 } },
];
export const ROOF_MG_UP = [   // per gun, 3 levels each; the numbers are per level
  { key:'dmg', vi:'ĐẦU ĐẠN',   per:'+12% sát thương',   fx:0.12, cost:[{ c:400 },{ c:1100 },{ d:10 }] },
  { key:'rof', vi:'BỘ KHOÁ NÒNG', per:'+10% tốc độ bắn', fx:0.10, cost:[{ c:400 },{ c:1100 },{ d:10 }] },
  { key:'mag', vi:'HỘP ĐẠN LỚN', per:'+20% băng đạn',   fx:0.20, cost:[{ c:300 },{ c:900 },{ d:8 }] },
  { key:'rel', vi:'KÍP NẠP',    per:'−12% thời gian thay hộp', fx:0.12, cost:[{ c:300 },{ c:900 },{ d:8 }] },
];
export const ROOF_MG_BLOCK = ['agl','missile','rocket'];
export const FENCE = { hp:34, ramV:9 };   // Z205 a compound's wire: HP per 3 m bay, and the closing speed (m/s) a hull needs to ram through
// Z201 the roof gun as the tank's AIR DEFENCE and anti-infantry gun: helicopters first (it reaches up and out further — rangeK — and a share of the burst
//   connects), then paratroopers still hanging under their canopies, men on the ground, tower guards, and last of all armour (rifle-calibre rounds only
//   chip it); hits harder all round (dmgK); and when the gunner is killed with nobody left on the roof a reserve man climbs up out of the hull
export const ROOF_MG_AI = { dmgK:1.3, air:{ rangeK:1.7, hit:0.55, dmgK:0.9, pri:0.55 }, para:{ rangeK:1.9, hit:0.32 }, armour:true, reserve:2, relieve:2.4 };   // grenade-launcher / missile turrets: the launcher takes the roof, no pintle
// Z228b BALLISTICS — every round has a real velocity curve, but still arrives where (and when) it was aimed:
//   gun rounds leave the muzzle at v0× the gun's speed and bleed speed to drag over the flight (k = decay/T);
//   rockets are kicked out slow by the booster, the motor lights and pushes them up past the gun's speed.
export const BALLISTIC = { gun:{ v0:1.5, decay:3 }, rocket:{ v0:0.3, k:6, cap:1.6 }, T:{ def:1.1, lifeK:0.5, rocket:1.0, min:0.12, max:2.5 },
  sabot:{ petals:3, out:7, life:0.5 }, vapor:{ t:0.12, every:0.02 }, enemyMissile:{ v0:0.3, k:5, T:1.1 } };
// Z236 SMOKE RIBBONS — a tank-gun round lays one unbroken ribbon of smoke along its real path (a strip that always faces the camera, wispy
//   and torn by noise, widening, rising, drifting on the wind and curling as it fades). Per kind: w0 = width at the muzzle (m), grow = how
//   fast it spreads (m per √s), life (s), op = opacity, col = colour; step = metres between laid points. cap = ribbons alive at once.
export const SMOKE_TRAIL = { points:64, cap:36, capMobile:14, step:1.0, stepMobile:1.7, wind:[0.32,0.12], rise:0.18, curl:0.22,
  kinds:{ shell:{ w0:0.16, grow:0.5, life:2.8, op:0.68, col:0xdedcd6 }, heavy:{ w0:0.22, grow:0.66, life:3.4, op:0.76, col:0xd6d3cc },
    rail:{ w0:0.08, grow:0.26, life:3.4, op:0.68, col:0xeeeaff }, enemy:{ w0:0.16, grow:0.5, life:2.4, op:0.64, col:0x948f87 },
    frost:{ w0:0.2, grow:0.55, life:1.8, op:0.45, col:0xe6f8ff } } };
// Z230 GUN STATS — one model of what a gun really does in a fight (combat/gunstats.js), used by the arsenal, the shop and the power rating:
//   engage = typical fighting distance (fraction of reach, capped) · W = target width (tank / man) · rho = enemies per m² around an impact
//   (a loose battle line) · hitsCap = most targets one trigger pull is credited with · ref = the targets time-to-kill is quoted against
export const GUNSTAT = { engage:{ frac:0.65, max:22 }, W:{ tank:3.2, man:0.9 }, rho:1/50, hitsCap:3, pierceK:0.3, lineW:3.4,
  ref:{ tank:'heavy', light:'grunt' }, minHit:0.3 };
// Z350–Z353 THE SOLDIER'S CAREER (soldier mode only — game/soldier-rank.js, actors/squad-mates.js, loot/soldier-arms.js, campaign/general-duel.js):
//   xp.kill = experience per kill by enemy type (_inf / _air / _veh = any other man / aircraft / vehicle; boss = the general's machine), eliteK × for an elite;
//   step = [a, b, c]: XP from rank n-1 to n is a + b·(n-1) + c·(n-1)²; ranks = Binh nhì … Đại tá (past the last one every step pays a medal = one more perk);
//   rankUp: max health + per rank, share of max health given back; gift = Z367 each rank's gift crate lands this far (m) ahead of him (no cards mid-battle: walking over it
//   gives one reward picked for him); perk: share of picks that offer a call for help, the +1 life card's chance;
//   milestone = what a rank brings by itself (at / mg = a man for the squad, supply = a drop by the HQ, tank = one of ours, para = a stick of paratroopers, barrage = a strike);
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
export const TROOPER = {
  xp:{ kill:{ rifle:10, rpg:16, _inf:12, scout:28, carrier:40, mortar:34, heliTroop:45, _air:45, _veh:55, grunt:80, heavy:120, boss:260, general:420 }, eliteK:2 },
  step:[200, 110, 10],
  ranks:['BINH NHÌ','BINH NHẤT','HẠ SĨ','TRUNG SĨ','THƯỢNG SĨ','THIẾU ÚY','TRUNG ÚY','THƯỢNG ÚY','ĐẠI ÚY','THIẾU TÁ','TRUNG TÁ','THƯỢNG TÁ','ĐẠI TÁ'],
  rankUp:{ hp:8, heal:0.3 }, gift:{ ahead:4 }, perk:{ callShare:0.35, lifeChance:0.1 },
  milestone:{ 2:'at', 4:'supply', 5:'mg', 7:'tank', 9:'para', 12:'barrage' },
  squad:{ start:['mg','medic'], names:['Hùng','Dũng','Tuấn','Nam','Minh','Long','Sơn','Hải','Lan','Thắng','Quân','Bình'], hpK:0.12, dmgK:0.1, leadK:0.25, max:6,
    medic:{ r:12, cd:9, hp:20, perRank:2.5, below:0.72, mateBelow:0.5 } },
  star:{ max:5, dmg:0.18, rate:0.06 },
  drop:{ rifle:0.05, rpg:0.2, _veh:0.28, item:0.3, medalXp:45 },
  general:{ hpK:70, dmg:7, fireCd:0.4, range:30, keep:13, speed:4.6, scale:1.18, hitCap:0.06, guards:3, callAt:0.5, callN:4, guardHpK:4, rageAt:0.3, rageFire:0.6, rageRun:1.3,
    fan:{ cd:6.5, n:9, arc:0.75, dmg:6, tel:0.75 }, nade:{ cd:8.5, n:3, R:3.4, dmg:36, lock:1.35, scatter:4.5 } },
};
// Z374 SCENERY (world/scenery.js): every battlefield composed from the Meshy community scans (tools/scene-import.mjs → assets/models/real/scene) — a
//   skyline beyond the fence, one landmark the field turns on, framing pairs, groves, a rail siding, a pole line, a tank farm, rocks to fight from.
//   lod: a model is drawn whole (the near file, fetched once the camera comes within mid + near m) up to mid m, then its mid copy, past far m its far copy
//   ([m, × its radius] — the larger) · models: size (h = height or w = widest side, m), ar = its x : y : z, sink = share of its height below ground, solid =
//   what stops a tank / a man (box: its footprint × k · pillars: the two ends of an arch, k of its width each · disc: a circle k × its width · r: a trunk m ·
//   null: scenery only), one = a light scan with no distance copies, env, lava = the melt's share of its width (a lava pit burns like a pool), yaw = turn so its front (+Z) faces the way it is set ·
//   biomes: what each battlefield is built from — at: far (beyond the fence at bearing a, d m out) · edge (inside it, inset m) · free (open ground; north:
//   the enemy half) · pair (either side of the piece `of`, side m across, fwd m ahead of its front) · line (n along a straight line gap m apart) · cluster
//   (n round one centre within r) · around (n round the piece `of`, r [min, max] out); s = scale range; face: core (default) · out · along · rand; Z393 solid = this beat's own collision (else the
//   model's), top = the most detail it ever draws ('l' mid / 'f' far: a small piece never fetches the whole scan)
export const SCENERY = { on:true, tone:0.55,   // Z420 tone: how far the forts' bunkers and guard towers lean to the land's tone (REALPROP.cast.tint)
  lod:{ mid:[30, 2.0], far:[90, 5], near:20, hys:0.1 }, env:0.85, clearCore:34, clearSpawn:30, gap:6, wonderR:{ _:48, VOLCANO:92 }, wonderGap:0.75, supply:{ fueltank:{ h:6.7 }, depot:{ w:9.5, z:7.6 }, radar:{ k:'radar_lattice', h:24, split:0.8, lv:'d' }, yard:{ radome:'radar_dome', shelter:'mil_shelter', radartruck:'radar_truck', genset:'field_gen', dish:'sat_dish' } },
  objective:{ depot:'fuel_depot', radio:'relay_post', radar:'radar_sentinel', battery:'gun_turret', command:'bunker_door' }, bricks:{ h:3.0, slices:6, lv:'l', fill:0.72 }, city:{ pole:{ h:8.4, lv:'f' }, roof:{ tank:{ h:2.6, share:0.45, kinds:['tube', 'apartment'], back:0.22, sink:0.15 }, mast:{ h:10, share:0.35, kinds:['tower', 'apartment'], minFloors:6, back:0.1, sink:0.1 } } },   // wonderR: open ground kept round the land's wonder (m from where it stands) · wonderGap: the skyline pieces keep this far (rad) off its bearing · supply: the enemy depot's fuel tanks drawn as the steel tank scan, h = the drawn tank's height (m, before the depot's scale); radar = the station's tower as the dish scan, · objective (Z426): the campaign's targets as scans (campaign/operations.js → world/scenery.js realObjective), each as wide as the target's ring
//   h tall, split = the share of its height where the dish (which sweeps with the head) begins; yard (Z425) = the scan each of the station's drawn pieces wears (piece kind → model) · bricks: the ruined brick walls in the breached wall's stone (h, how many
//   3 m slices, which copy, fill = the least share of a slice that must be wall — the breach and the ragged ends are left out) · city: the power poles as the transformer pole scan (h, copy), roof water tanks / masts (h, share of the roofs of those kinds, set back d ×, sunk m)
  models:{
    volcano:{ one:true, h:44, ar:[2.44, 1, 2.41], sink:0.08, solid:null },
    lava_pit:{ one:true, w:24, ar:[6.08, 1, 6.34], sink:0.18, solid:null, lava:0.34 },
    lava_arch:{ one:true, h:13, ar:[1.71, 1, 0.9], sink:0.04, solid:{ pillars:0.26 } },
    ice_peak:{ h:64, ar:[0.77, 1, 0.78], sink:0.05, solid:null },
    sea_stack:{ one:true, h:12, ar:[1.52, 1, 1.39], sink:0.06, solid:{ box:0.6 } },
    rock_outcrop:{ w:24, ar:[4.88, 1, 2.68], sink:0.12, solid:{ box:0.62 } },
    stone_ring:{ one:true, h:8, ar:[1.71, 1, 0.51], sink:0.02, solid:{ pillars:0.3 } },
    mtn_gate:{ w:64, ar:[2.07, 1, 1.89], sink:0.05, solid:{ box:0.62 } },
    temple:{ one:true, w:26, ar:[1.77, 1, 2.47], sink:0.03, solid:{ box:0.8 } },
    lion:{ w:6.2, ar:[0.68, 1, 1.17], sink:0, solid:{ box:0.92 } },
    wall_breach:{ w:22, ar:[2.64, 1, 0.17], sink:0.02, solid:{ box:1 } },
    wt_lean:{ h:17, ar:[0.83, 1, 0.82], sink:0.02, solid:{ box:0.42 } },
    neon_tower:{ h:28, ar:[0.97, 1, 0.45], sink:0, solid:{ r:1.4 }, env:1 },
    radar_dish:{ h:25, ar:[0.61, 1, 0.55], sink:0.01, solid:{ box:0.55 } },
    tank_water:{ h:9.5, ar:[0.86, 1, 0.77], sink:0, solid:{ disc:0.46 } },
    tank_steel:{ h:11, ar:[0.97, 1, 0.97], sink:0, solid:{ disc:0.48 }, fuel:'steel' },   // Z414 fuel: shot, it goes up (FUEL_TANK.steel)
    rail_tanker:{ w:16, ar:[3.9, 1, 1.09], sink:0, solid:{ box:0.95 }, fuel:'rail' },   // Z414 (FUEL_TANK.rail)
    oil_drum:{ w:0.95, ar:[1.58, 1, 0.99], sink:0, solid:{ disc:0.5 }, fuel:true },   // Z380 a drum on its side is cover too: rounds stop at it · Z402 fuel: shot, it goes up (FUEL_DRUM)
    power_pole:{ h:11, ar:[0.49, 1, 0.21], sink:0, solid:{ r:0.35 } },
    fence_gate:{ w:5.6, ar:[1.22, 1, 0.1], sink:0, solid:{ box:1 } },
    watchtower:{ h:13, ar:[0.35, 1, 0.35], sink:0, solid:null }, wt_steel:{ one:true, h:16, ar:[0.28, 1, 0.33], sink:0, solid:null }, wt_rust:{ h:15, ar:[0.41, 1, 0.42], sink:0, solid:null },   // Z375 the real guard towers (world/tower-kinds.js mtower / wtower / wrust)
    tree_twisted:{ one:true, h:9, ar:[0.66, 1, 0.56], sink:0.02, solid:{ r:0.7 } },
    tree_ember:{ one:true, h:7, ar:[1.66, 1, 1.39], sink:0.03, solid:{ r:1.0 }, env:0.7 },
    tree_bare:{ one:true, h:12, ar:[0.6, 1, 0.43], sink:0.02, solid:{ r:0.6 } },
    tree_remnant:{ w:7, ar:[1.82, 1, 1.83], sink:0.03, solid:{ box:0.4 } },
    tree_sentinel:{ h:24, ar:[1.01, 1, 0.89], sink:0.02, solid:{ r:1.9 } },
    tree_cedar:{ h:26, ar:[0.62, 1, 0.46], sink:0.02, solid:{ r:1.2 } },
    tree_oak:{ h:18, ar:[0.97, 1, 0.97], sink:0.02, solid:{ r:1.2 } },
    tree_world:{ h:30, ar:[1.02, 1, 0.81], sink:0.02, solid:{ r:2.4 } },
    tree_pine:{ h:22, ar:[0.47, 1, 0.47], sink:0.02, solid:{ r:0.8 } },
    // Z420 the forts' command compounds (world/fortress.js buildCore, FORT_CMD) and the fuel depot's store (world/supply.js) — solid: null, their own blocks carry them
    hq_modular:{ one:true, w:17, ar:[1.84, 1, 1.72], sink:0.01, solid:null }, bunker_hangar:{ w:15, ar:[2.11, 1, 1.02], sink:0.02, solid:null }, bunker_store:{ w:13, ar:[1.81, 1, 1.4], sink:0.01, solid:null },
    bunker_green:{ h:7.5, ar:[0.97, 1, 0.84], sink:0.03, solid:null }, bunker_dome:{ w:12, ar:[2.6, 1, 2.6], sink:0.05, solid:null }, bunker_sandbag:{ w:11, ar:[2.04, 1, 2.04], sink:0.03, solid:null },
    radar_sentinel:{ h:15, ar:[0.67, 1, 0.62], sink:0.01, solid:null }, gun_turret:{ w:11, ar:[2.29, 1, 2.06], sink:0.03, solid:null }, antenna_twin:{ h:28, ar:[0.55, 1, 0.3], sink:0, solid:null },
    fuel_depot:{ w:17, ar:[1.7, 1, 1.29], sink:0.02, solid:null },
    radar_dome:{ one:true, h:15, ar:[0.37, 1, 0.37], sink:0, solid:null }, mil_shelter:{ w:6.1, ar:[1.33, 1, 0.68], sink:0.01, solid:null }, radar_truck:{ w:8.6, ar:[1.96, 1, 0.65], sink:0.01, solid:null },   // Z425 the radar yard (SCENERY.supply.yard): pieces of the base, they stop and break as its pieces do
    field_gen:{ one:true, w:3.2, ar:[2.21, 1, 1], sink:0.01, solid:null }, sat_dish:{ h:4.2, ar:[0.97, 1, 0.71], sink:0.01, solid:null },
    // Z420 the guard towers (world/tower-kinds.js gt_*): the model IS the tower; ar measured off the packed scans
    gt_sentinel:{ h:15, ar:[0.42, 1, 0.42], sink:0.01, solid:null }, gt_concrete:{ h:14, ar:[0.54, 1, 0.53], sink:0.01, solid:null }, gt_round:{ h:11, ar:[0.77, 1, 0.77], sink:0.01, solid:null },
    gt_limes:{ h:12.5, ar:[0.54, 1, 0.57], sink:0.01, solid:null }, gt_stone:{ h:14, ar:[0.40, 1, 0.65], sink:0.01, solid:null }, gt_castle:{ h:12.5, ar:[1.29, 1, 0.43], sink:0.01, solid:null },
    gt_winter:{ h:18, ar:[0.53, 1, 0.61], sink:0.01, solid:null }, gt_broken:{ h:11, ar:[0.53, 1, 0.53], sink:0.01, solid:null },
    // Z422 the set pieces of the second batch (each land composed below), the radar station's lattice tower, the city's cell tower
    radar_lattice:{ one:true, h:24, ar:[0.35, 1, 0.24], sink:0, solid:null }, cell_tower:{ h:18, ar:[0.95, 1, 0.95], sink:0.01, solid:{ box:0.55 } },
    gothic_gate:{ w:16, ar:[1.1, 1, 0.49], sink:0.02, solid:{ pillars:0.24 } }, moss_arch:{ one:true, h:8, ar:[0.83, 1, 0.28], sink:0.02, solid:{ pillars:0.3 } },
    stone_gate:{ w:26, ar:[1.42, 1, 0.54], sink:0.03, solid:{ box:0.8 } }, ruin_overgrown:{ h:30, ar:[0.82, 1, 0.82], sink:0.03, solid:{ box:0.85 } },
    sphinx_great:{ w:46, ar:[1.06, 1, 3.06], sink:0.03, solid:{ box:0.8 } }, sphinx_small:{ one:true, h:4.2, ar:[0.63, 1, 1.71], sink:0.01, solid:{ box:0.9 } },
    ice_castle:{ w:60, ar:[1.1, 1, 0.7], sink:0.04, solid:{ box:0.8 }, env:1.2 }, duga_hall:{ w:24, ar:[1.67, 1, 1.71], sink:0.01, solid:{ box:0.95 } },
    water_tower_brick:{ h:20, ar:[0.24, 1, 0.26], sink:0, solid:{ r:1.6 } }, generator:{ one:true, w:5, ar:[1.35, 1, 1.35], sink:0, solid:{ box:0.9 } },
    crane_stack:{ h:34, ar:[0.52, 1, 0.25], sink:0, solid:{ box:0.7 } }, dam_gate:{ h:22, ar:[0.59, 1, 0.72], sink:0.02, solid:{ box:0.9 } },
    culvert:{ w:9, ar:[1.86, 1, 1.48], sink:0.12, solid:{ box:0.9 } }, tunnel_mouth:{ w:16, ar:[1.15, 1, 1.73], sink:0.05, solid:{ box:0.9 } },
    rock_arch:{ w:18, ar:[2.0, 1, 1.42], sink:0.05, solid:{ box:0.7 } }, moss_archway:{ h:14, ar:[0.99, 1, 0.48], sink:0.03, solid:{ pillars:0.28 } },
    belfry:{ h:16, ar:[0.28, 1, 0.32], sink:0.01, solid:{ r:2.0 } }, lava_crater:{ one:true, w:20, ar:[4.48, 1, 4.52], sink:0.1, solid:null, lava:0.3 },
    lava_rock_a:{ one:true, w:4, ar:[1.68, 1, 1.58], sink:0.08, solid:{ disc:0.45 }, env:0.7 }, lava_rock_b:{ one:true, w:4, ar:[0.96, 1, 1.02], sink:0.08, solid:{ disc:0.45 }, env:0.7 },
    lava_rock_c:{ one:true, w:6, ar:[1.61, 1, 1.03], sink:0.08, solid:{ disc:0.45 }, env:0.7 }, ember_ruin:{ one:true, w:14, ar:[2.17, 1, 1.7], sink:0.04, solid:{ box:0.6 } },
    gargoyle_wall:{ one:true, w:22, ar:[2.11, 1, 0.81], sink:0.03, solid:{ box:0.8 } }, keep_fortress:{ w:34, ar:[1.44, 1, 0.81], sink:0.02, solid:{ box:0.85 } },
    citadel_tower:{ h:18, ar:[0.68, 1, 0.72], sink:0.01, solid:{ r:4.0 } }, castle_wall:{ w:20, ar:[1.65, 1, 0.36], sink:0.03, solid:{ box:1 } },
    gatehouse:{ w:26, ar:[2.35, 1, 1.21], sink:0.02, solid:{ pillars:0.3 } }, skeleton_block:{ h:26, ar:[0.96, 1, 0.58], sink:0.02, solid:{ box:0.85 } },
    corner_store:{ h:18, ar:[0.8, 1, 0.67], sink:0.01, solid:{ box:0.9 } }, road_barrier:{ w:7, ar:[2.75, 1, 2.13], sink:0.02, solid:{ box:0.8 } },
    tire_wall:{ w:6, ar:[2.64, 1, 0.6], sink:0.02, solid:{ box:0.9 } }, rebar_wall:{ w:7, ar:[2.35, 1, 0.74], sink:0.02, solid:{ box:0.9 } },
    // Z426 the rest of the 94 (the 23 left over): city blocks, castle pieces, a lighthouse, the relay outpost and the bunker door (the campaign's targets too)
    block_white:{ w:20, ar:[1.42, 1, 1.17], sink:0.02, solid:{ box:0.9 } }, bastion_gate:{ w:14, ar:[1.25, 1, 0.67], sink:0.02, solid:{ pillars:0.28 } }, brownstone:{ h:22, ar:[0.58, 1, 0.57], sink:0.01, solid:{ box:0.92 } },
    parapet:{ one:true, w:8, ar:[2.24, 1, 0.36], sink:0.02, solid:{ box:0.9 } }, horn_arch:{ w:22, ar:[1.23, 1, 0.9], sink:0.05, solid:{ disc:0.22 } }, iron_barricade:{ w:6, ar:[2.09, 1, 0.6], sink:0.02, solid:{ box:0.9 } },
    scaffold_ruin:{ h:24, ar:[0.61, 1, 0.55], sink:0.01, solid:{ box:0.9 } }, lighthouse:{ h:22, ar:[0.46, 1, 0.46], sink:0.01, solid:{ disc:0.42 } }, relay_post:{ w:14, ar:[1.41, 1, 1.41], sink:0.02, solid:{ box:0.82 } },
    keep_medieval:{ h:24, ar:[0.52, 1, 0.93], sink:0.02, solid:{ box:0.85 } }, stone_block:{ one:true, w:10, ar:[2.18, 1, 1.46], sink:0.04, solid:{ box:0.95 } }, fountain_vintage:{ h:5, ar:[0.82, 1, 0.82], sink:0.02, solid:{ disc:0.45 } },
    bunker_door:{ w:10, ar:[1.38, 1, 1.34], sink:0.03, solid:{ box:0.88 } }, fountain_temple:{ w:12, ar:[1.4, 1, 0.54], sink:0.02, solid:{ box:0.6 } }, tower_mage:{ h:30, ar:[0.43, 1, 0.44], sink:0.01, solid:{ disc:0.4 } },
    wall_tall:{ one:true, w:10, ar:[1, 1, 0.23], sink:0.02, solid:{ box:0.95 } }, elevador:{ h:42, ar:[0.21, 1, 0.54], sink:0.01, solid:{ box:0.45 } },
    blast_furnace:{ h:30, ar:[1, 1, 0.41], sink:0.01, solid:{ box:0.55 } } },
  biomes:{
    // fire and black rock: two cones smoking on the skyline, craters of live melt in the field, the road in through basalt arches, trees burning from the roots
    VOLCANO:[ { k:'lava_crater', at:'free', n:3, s:[0.8, 1.2], face:'rand' }, { k:'lava_rock_a', at:'free', n:8, s:[0.7, 1.3], face:'rand' }, { k:'lava_rock_b', at:'free', n:6, s:[0.7, 1.3], face:'rand' }, { k:'lava_rock_c', at:'free', n:5, s:[0.8, 1.2], face:'rand' }, { k:'ember_ruin', at:'free', n:2, face:'rand' },
      { k:'volcano', at:'far', a:[[-2.75, -2.3], [-0.85, -0.4]], d:[30, 55], s:[0.9, 1.25] }, { k:'volcano', at:'far', a:[[2.6, 3.1], [0.05, 0.5]], d:[45, 70], s:[0.7, 0.95] },
      { k:'lava_pit', at:'free', n:2, s:[0.85, 1.15] }, { k:'lava_arch', at:'free', n:3, north:true, s:[0.9, 1.15] },
      { k:'tree_ember', at:'free', n:7, s:[0.8, 1.2], face:'rand' }, { k:'tree_twisted', at:'free', n:5, s:[0.8, 1.2], face:'rand' }, { k:'tree_bare', at:'free', n:3, s:[0.85, 1.1], face:'rand' }, { k:'horn_arch', at:'free', n:1, s:[0.9, 1.1], face:'rand' } ],
    // ice: white summits standing over the fence, a signal mast glowing blue in the snow, groves of snow-laden cedar, the bare trees frosted
    ARCTIC:[ { k:'ice_castle', at:'edge', a:[[-2.6, -2.0], [-1.1, -0.5]], inset:30 },
      { k:'ice_peak', at:'far', a:[[-2.8, -2.3]], d:[25, 45], s:[0.95, 1.2] }, { k:'ice_peak', at:'far', a:[[-0.85, -0.35]], d:[25, 45], s:[0.95, 1.2] }, { k:'ice_peak', at:'far', a:[[2.7, 3.1], [0.0, 0.45]], d:[40, 60], s:[0.75, 0.95] },
      { k:'cell_tower', at:'free', id:'mast', north:true }, { k:'tree_cedar', at:'cluster', id:'g1', n:3, r:12, s:[0.85, 1.1], face:'rand' }, { k:'tree_cedar', at:'cluster', id:'g2', n:3, r:12, s:[0.85, 1.1], face:'rand' },
      { k:'tree_bare', at:'free', n:5, s:[0.8, 1.15], face:'rand' }, { k:'rock_outcrop', at:'free', n:2, s:[0.8, 1] },
      { k:'ice_peak', at:'free', n:16, s:[0.034, 0.066], face:'rand', solid:{ disc:0.42 }, top:'l' }, { k:'bastion_gate', at:'free', n:1 }, { k:'bunker_door', at:'free', n:1, face:'rand' } ],   // Z393 snow-capped crags 2–4 m out on the ice (the summit scan small) in place of flora.js's cone 'ice spires'
    // sand and oil: a fuel farm of steel tanks with drums stacked round it, a siding of rail tankers, a pole line marching off, a leaning water tower, limestone kopjes
    DESERT:[ { k:'sphinx_great', at:'free', id:'sphinx', north:true, s:[0.95, 1.05] }, { k:'sphinx_small', at:'avenue', of:'sphinx', n:4, from:30, gap:12, side:10 }, { k:'rock_arch', at:'free', n:1, s:[0.9, 1.1] },
      { k:'tank_steel', at:'cluster', id:'farm', n:3, r:13, s:[0.9, 1.1] }, { k:'oil_drum', at:'around', of:'farm', n:12, r:[9, 17], s:[0.95, 1.05], face:'rand' },
      { k:'rail_tanker', at:'line', n:3, gap:17.5, face:'along' }, { k:'power_pole', at:'line', n:7, gap:24, face:'along' },
      { k:'wt_lean', at:'free', n:1 }, { k:'rock_outcrop', at:'free', n:3, s:[0.8, 1.15] }, { k:'tree_twisted', at:'free', n:4, s:[0.8, 1.1], face:'rand' }, { k:'tree_bare', at:'free', n:2, face:'rand' }, { k:'horn_arch', at:'free', n:1, s:[0.8, 1.0], face:'rand' } ],
    // the great tree of the plain with its shade, broad oaks, kopjes of weathered stone, stumps and dead wood, a farm's leaning water tower, a pole line
    SAVANNA:[ { k:'rock_arch', at:'free', n:2, s:[0.8, 1.05] },
      { k:'tree_world', at:'free', id:'great', n:1, s:[1, 1.1] }, { k:'tree_oak', at:'free', n:3, s:[0.85, 1.1], face:'rand' }, { k:'rock_outcrop', at:'free', n:4, s:[0.75, 1.1] },
      { k:'tree_remnant', at:'free', n:3, face:'rand' }, { k:'tree_twisted', at:'free', n:3, face:'rand' }, { k:'wt_lean', at:'free', n:1 }, { k:'power_pole', at:'line', n:5, gap:26, face:'along' }, { k:'relay_post', at:'free', n:1, north:true } ],
    // green country: oak and pine woods, the old tree on the rise, a mossy moon gate and a breached garden wall, rock stacks, the overgrown dish on the far side
    MEADOW:[ { k:'belfry', at:'free', n:1 }, { k:'moss_archway', at:'free', n:1 },
      { k:'tree_world', at:'free', n:1, north:true }, { k:'tree_oak', at:'cluster', id:'w1', n:3, r:14, s:[0.85, 1.1], face:'rand' }, { k:'tree_pine', at:'cluster', id:'w2', n:4, r:12, s:[0.85, 1.15], face:'rand' },
      { k:'moss_arch', at:'free', n:1 }, { k:'gothic_gate', at:'free', n:2 }, { k:'sea_stack', at:'free', n:2, s:[0.85, 1.1] }, { k:'radar_dish', at:'free', n:1, north:true }, { k:'keep_medieval', at:'free', n:1, north:true }, { k:'stone_block', at:'free', n:2, face:'rand' } ],
    // the ruined city of old: a temple on the far side with its two lions at the steps, breached walls, moon gates, dead giants, stumps, the dish gone to moss
    RUINS:[ { k:'ruin_overgrown', at:'free', n:1, north:true }, { k:'skeleton_block', at:'free', n:1 }, { k:'gargoyle_wall', at:'free', n:2 }, { k:'corner_store', at:'free', n:1 },
      { k:'mtn_gate', at:'far', a:[[-2.8, -2.3], [-0.85, -0.35]], d:[8, 22], s:[1, 1.2] }, { k:'temple', at:'free', id:'temple', north:true }, { k:'lion', at:'pair', of:'temple', side:8.5, fwd:15 },
      { k:'gothic_gate', at:'free', n:4 }, { k:'moss_arch', at:'free', n:2 }, { k:'tree_sentinel', at:'free', n:2, face:'rand' }, { k:'tree_bare', at:'free', n:4, face:'rand' },
      { k:'tree_remnant', at:'free', n:4, face:'rand' }, { k:'radar_dish', at:'free', n:1 }, { k:'block_white', at:'free', n:1 }, { k:'wall_tall', at:'free', n:3, face:'rand' }, { k:'fountain_temple', at:'free', n:1 } ],
    // the citadel's country: a mountain with a temple gate cut in it at the fence, a marble temple with its lions, broken walls, moon gates, pines, rock stacks
    CITADEL:[ { k:'keep_fortress', at:'free', id:'keep', north:true }, { k:'parapet', at:'around', of:'keep', n:4, r:[21, 26], face:'out' }, { k:'castle_wall', at:'around', of:'keep', n:3, r:[26, 32], face:'out' }, { k:'citadel_tower', at:'around', of:'keep', n:2, r:[27, 34] }, { k:'gatehouse', at:'free', n:1 },
      { k:'stone_gate', at:'edge', a:[[-2.6, -2.1], [-1.0, -0.55]], inset:18 }, { k:'temple', at:'free', id:'temple', north:true }, { k:'lion', at:'pair', of:'temple', side:8.5, fwd:15 },
      { k:'gothic_gate', at:'free', n:2 }, { k:'moss_arch', at:'free', n:2 }, { k:'tree_pine', at:'free', n:4, face:'rand' }, { k:'sea_stack', at:'free', n:2 }, { k:'keep_medieval', at:'free', n:1 }, { k:'tower_mage', at:'free', n:1, north:true }, { k:'fountain_temple', at:'free', n:1 }, { k:'stone_block', at:'free', n:2, face:'rand' } ],
    // white stone: outcrops and stacks everywhere, the old cave temple in the quarry wall, a rail siding, a water tank, drums, the pole line
    QUARRY:[ { k:'tunnel_mouth', at:'edge', a:[[2.3, 2.9], [0.3, 0.9]], inset:12 }, { k:'culvert', at:'free', n:2 }, { k:'rock_arch', at:'free', n:2 },
      { k:'stone_gate', at:'edge', a:[[-2.7, -2.1], [-1.0, -0.45]], inset:18 }, { k:'rock_outcrop', at:'free', n:6, s:[0.8, 1.2] }, { k:'sea_stack', at:'free', n:4, s:[0.85, 1.2] },
      { k:'rail_tanker', at:'line', n:3, gap:17.5, face:'along' }, { k:'tank_water', at:'cluster', id:'yard', n:1, r:2 }, { k:'oil_drum', at:'around', of:'yard', n:8, r:[7, 13], face:'rand' },
      { k:'power_pole', at:'line', n:6, gap:24, face:'along' }, { k:'tree_twisted', at:'free', n:2, face:'rand' }, { k:'lighthouse', at:'free', n:1, north:true }, { k:'wall_tall', at:'free', n:2, face:'rand' }, { k:'stone_block', at:'free', n:2, face:'rand' } ],
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
export const SKYLINE = { on:true, haze:[0.24, 0.58], y:-6, stacks:10, arcs:10, keep:0.2,   // Z412 arcs: the horizon's instanced rings split by bearing (the camera culls the arcs behind it) · keep: share of triangles a skyline piece keeps (simplified; 50–300 m off)
    // stacks: the works' concrete chimneys left among the real pieces
  biomes:{
    ARCTIC:{ set:[ { k:'ice_peak', n:7, h:[115, 180], r:[45, 85], y:-14, sea:1 }, { k:'tree_cedar', lv:'f', n:64, h:[22, 34], r:[-80, 40], y:-3, clump:[9, 42] }, { k:'mil_shelter', lv:'f', n:6, w:[6, 6.5], r:[-50, 20], y:-0.5, clump:[2, 22] }, { k:'sat_dish', lv:'f', n:2, h:[4, 5], r:[-50, 20], y:-0.5, clump:[2, 18] } ] }, TUNDRA:'ARCTIC',
    VOLCANO:{ skyline:true, rings:'peak', set:[ { k:'volcano', n:5, h:[78, 118], r:[0, 45], y:-16, hz:0.22 }, { k:'lava_arch', n:7, h:[30, 50], r:[-10, 22], hz:0.2 }, { k:'tree_twisted', n:24, h:[14, 22], r:[-80, 8], y:-3, clump:[6, 30] } ] },
    QUARRY:{ set:[ { k:'lighthouse', lv:'f', n:2, h:[24, 30], r:[0, 18], y:-2, hz:0.25, sea:1 }, { k:'rock_outcrop', n:9, w:[120, 210], r:[30, 70], y:-10, sea:1 }, { k:'sea_stack', n:7, h:[38, 70], r:[0, 30], hz:0.3, sea:1 }, { k:'mtn_gate', n:1, w:[170, 200], r:[45, 60], y:-10, sea:1 } ] },
    CITADEL:{ set:[ { k:'mtn_gate', n:1, w:[180, 210], r:[48, 70], y:-10 }, { k:'tower_mage', lv:'f', n:3, h:[34, 48], r:[0, 24], y:-2 }, { k:'tree_pine', lv:'f', n:56, h:[18, 28], r:[-80, 40], y:-3, clump:[8, 40] }, { k:'ruin_house', n:8, h:[10, 14], r:[-60, 20], y:-1, clump:[2, 30] } ] },
    MEADOW:{ set:[ { k:'keep_medieval', lv:'f', n:2, h:[26, 34], r:[0, 20], y:-2 }, { k:'tree_pine', lv:'f', n:60, h:[22, 34], r:[-80, 40], y:-3, clump:[9, 40] }, { k:'tree_oak', lv:'f', n:36, h:[16, 26], r:[-80, 30], y:-3, clump:[7, 34] }, { k:'tree_world', lv:'f', n:3, h:[40, 52], r:[0, 14], y:-3 },
      { k:'ruin_house', n:10, h:[10, 14], r:[-60, 20], y:-1, clump:[3, 30] }, { k:'ruin_villa', n:3, w:[14, 18], r:[-60, 20], y:-1, clump:[3, 20] },
    ] },
    SAVANNA:{ set:[ { k:'tree_world', lv:'f', n:18, h:[24, 38], r:[-80, 30], y:-3, clump:[6, 46] }, { k:'tree_oak', lv:'f', n:16, h:[14, 24], r:[-80, 30], y:-3, clump:[5, 36] }, { k:'water_tower_brick', lv:'f', n:2, h:[14, 18], r:[-60, 10], y:-1, clump:[2, 10] }, { k:'ruin_house', n:6, h:[8, 11], r:[-60, 10], y:-1, clump:[2, 26] }, { k:'rock_outcrop', n:7, w:[70, 130], r:[10, 45], y:-8 } ] },
    DESERT:{ set:[ { k:'rock_outcrop', n:8, w:[90, 170], r:[20, 60], y:-10 }, { k:'wt_lean', lv:'f', n:4, h:[28, 36], r:[-6, 8], y:-3 }, { k:'tree_twisted', n:14, h:[12, 18], r:[-80, 20], y:-3, clump:[4, 26] }, { k:'ruin_house', n:8, h:[8, 11], r:[-60, 10], y:-1, clump:[2, 30] } ] },
    RUINS:{ skyline:true, set:[ { k:'ruin_block', n:10, h:[34, 58], r:[0, 40] }, { k:'ruin_tower', n:8, h:[30, 48], r:[0, 40] }, { k:'ruin_chapel', n:6, h:[26, 40], r:[0, 40] },
      { k:'ruin_villa', n:6, h:[18, 28], r:[-6, 30] }, { k:'ruin_house', n:6, h:[14, 22], r:[-8, 24] }, { k:'wall_breach', lv:'f', n:10, w:[50, 80], r:[-10, 20] }, { k:'tree_sentinel', lv:'f', n:8, h:[26, 40], r:[-8, 24], y:-3 } ] },
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
//   ring = the battlefield's gold perimeter line fades out between these camera heights (m); farK: up high the camera's far plane reaches farK × its height
//   (the land below it all drawn, not cut off into the backdrop); farTone = [share of the zenith blue, brightness ×] of the far haze against the sky's horizon band
export const AERIAL = { on:true, fall:1 / 55, h0:12, keep:[0.42, 0.06], keepH:[50, 260], blue:1 / 650, warm:0.32, land:[0.84, 0.985], landK:1, ring:[60, 150], farK:2.7, farTone:[0.18, 0.84] };
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
//   endless city or works). tint / rock / snow = the land's colour, its rock where it is steep, snow above snow m; ridge × FIELD.ridgeH (the bank inside
//   the field's square), rocks × the boulder rows; plain = what the backdrop's plain shows to the horizon (sea · dunes · savanna · fields · forest ·
//   lava · city · ruins · industry), its colour; roads: tracks lead away. far = the camera's least far plane (m): the near mountains must not be cut
export const LANDFORM = { on:true, far:1400,
  biomes:{ DESERT:{ form:'bowl', h:46, w:300, dune:1, tint:0xe39a62, rock:0xb87048, ridge:0.6, rocks:0, plain:'dunes', col:0xd88a52, roads:1 },
    SAVANNA:{ form:'plateau', h:120, w:40, tint:0xc8a060, rock:0xa4542e, ridge:0.25, rocks:0.12, plain:'savanna', col:0xa88a4c },
    ARCTIC:{ form:'plateau', h:70, w:26, tint:0xf4f8fb, rock:0x9cc2dc, ridge:0.25, rocks:0, plain:'sea', col:0x14263a, floes:1 },
    QUARRY:{ form:'plateau', h:58, w:24, tint:0xece6d8, rock:0xd4ccbe, ridge:0.25, rocks:0.2, plain:'sea', col:0x184a5e },
    CITADEL:{ form:'plateau', h:90, w:170, tint:0xa0905c, rock:0x8a7860, ridge:0.5, rocks:0.3, plain:'fields', col:0x6e7a4a },
    MEADOW:{ form:'bowl', h:260, w:360, tint:0x4e6c34, rock:0x6c6c64, snow:175, ridge:1, rocks:0.4, plain:'forest', col:0x34502c },
    VOLCANO:{ form:'bowl', h:160, w:230, tint:0x2e2826, rock:0x1e1a18, ridge:1, rocks:0.6, plain:'lava', col:0x241c1a },
    CITY:{ form:'flat', h:3, w:300, tint:0x5c6066, rock:0x5c6066, ridge:0.2, rocks:0, plain:'city', col:0x7a7e86 },
    RUINS:{ form:'flat', h:9, w:220, tint:0x6e6a66, rock:0x5a5654, ridge:0.3, rocks:0.3, plain:'ruins', col:0x76706a },
    FOUNDRY:{ form:'flat', h:6, w:260, tint:0x6a645e, rock:0x5a524c, ridge:0.3, rocks:0.2, plain:'industry', col:0x4a4440, roads:1 } } };
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
