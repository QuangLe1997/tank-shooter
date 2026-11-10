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
            hpMul:2.6, sizeMul:1.32, dmgMul:1.3, coinMul:3, dia:1 },
  // shop upgrade per-level effects (used by applyUpgrades)
  up:     { damage:0.08, boss:0.12, range:0.10, reload:0.12, mag:0.15, hp:20, armor:0.06, engine:0.10 },
  // gun MASTERY: each duplicate gun pickup = +1 xp; cross a threshold → that gun levels up (1→4, permanent).
  // Higher level = more damage, faster fire (lower fireCd), faster reload. Long grind: ~12/15/18 dups per level.
  mastery:{ xp:[0,12,27,45], maxLevel:4, dmgPerLevel:0.10, fireCdPerLevel:0.06, reloadPerLevel:0.08 },
  // ARTILLERY LOCK strike (stage≥2 mortar barrage): locks your spot → red ring warns → arcing missile slams in.
  // Dodge window = lockTime+flightTime (move out of `radius`). Damage falls off by distance: bullseye = dmgMax, edge = dmgMin, outside = 0.
  // Designed dodgeable: player base maxSpeed 26 clears radius 6.5 in ~0.25s, far under the ~2s window — threat is REACTION + barrage density.
  artillery:{ radius:6.5, innerFrac:0.4, dmgMax:32, dmgMin:8, coreMul:0.5,
    lockTime:0.9, flightTime:1.2, gravity:26,
    warnLead:1.3, restMin:5, restMax:8, shotSpacing:0.65, shotsBase:2, shotsPerMortar:1, shotsMax:6 },
  // enemy AGGRESSION & ACCURACY — both ramp with stage (diffScale 0→1 over S1→S5) and NG+ loop.
  // fireChance = how proactively they shoot (early = hesitant, late = relentless); spread shrinks → far more accurate late.
  aggro:{ fireChanceBase:0.55, fireChanceRamp:0.55, spreadBase:0.5, spreadDrop:0.82, leadFrom:0.3, rateBase:2.2, rateDrop:0.95, accurateMul:0.22, loopAcc:0.12 },
  // FLAMETHROWER burn (damage-over-time): DoT = dps × level × dt. Each spray-tick adds `add` to level (caps at lvlMax);
  // level also creeps up on its own (`grow`/s) so any fire "cháy càng ngày càng lớn". `duration` resets on every tick.
  // → a light touch burns slowly (~3s to kill a grunt) but eventually finishes weak foes; sustained spray ramps to max → melts fast.
  flame:{ dps:8, lvlMax:4, add:0.55, grow:0.2, duration:10, range:20, cone:0.7 },
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
  drone:{ dur:22, orbit:4.8, height:3.0, detect:26, hp:120, dmg:6, bspeed:78,
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
  KIN:  { L:1.15, M:1.00, H:0.55, A:1.10, struct:0.6, label:'KINETIC' },      // autocannons / MGs / rotary — shreds light armour, bounces off heavy
  AP:   { L:0.85, M:1.10, H:1.45, A:0.70, struct:1.2, label:'ARMOR-PIERCING' },// sabot / rail slug — built to kill tanks; over-penetrates light targets
  HE:   { L:1.20, M:1.00, H:0.85, A:1.00, struct:1.5, label:'HIGH-EXPLOSIVE' },// blast + splinters — crowds, light vehicles, structures
  FRAG: { L:1.35, M:0.95, H:0.55, A:1.10, struct:0.7, label:'FRAGMENTATION' }, // canister / pellets — brutal close on soft targets
  FIRE: { L:1.30, M:1.00, H:0.75, A:0.40, struct:0.3, tower:1.6, label:'INCENDIARY' },
  CRYO: { L:1.00, M:1.00, H:0.85, A:0.90, struct:0.5, label:'CRYOGENIC' },
  ELEC: { L:1.00, M:1.10, H:1.00, A:1.25, struct:0.4, label:'ELECTRIC' },
  HESH: { L:1.00, M:1.25, H:1.05, A:0.60, struct:3.0, label:'HESH' },         // squash-head: spalls medium armour, levels cover & towers
  TBX:  { L:1.40, M:1.10, H:0.70, A:0.80, struct:1.8, tower:2.2, label:'THERMOBARIC' },   // Z81 fuel-air: wrecks crowds, infantry & bunkers; poor vs heavy armour
};
export const ARMOR = { scout:'L', bomber:'L', gunner:'L', grunt:'M', mortar:'M', sniper:'M', carrier:'M', shield:'H', heavy:'H', boss:'H',
  rifle:'L', rpg:'L', engineer:'L', pyro:'M', atgm:'M', gunship:'A' };   // A = aircraft (Z80): only direct fire / flak / missiles reach it
// ============================================================================
// BATTLEFIELD ROSTER v2 (Z79) — enemy infantry on foot. Squads join waves from W2; RPG teams from stage 2.
//   squads per wave = floor(base + wave·perWave + (stage−1)·perStage)   (S1W2 = 1 … S5W5 = 3)
//   a tank moving faster than crushSpeed (or dashing) runs a soldier over (+crushBonus score)
// ============================================================================
export const INFANTRY = {
  rifle:{ hp:18, speed:4.4, keep:15, range:24, fireCd:1.5, dmg:4, bspeed:50, score:60 },
  rpg:  { hp:24, speed:3.8, keep:20, range:30, fireCd:5.0, aimT:1.0, dmg:22, rspeed:26, aoe:3.0, score:110 },
  squad:{ fromWave:2, base:0.5, perWave:0.25, perStage:0.35, size:[3,5], rpgFrom:2, maxOnField:14 },
  crushSpeed:3.5, crushBonus:50, bail:0.7,
};
// NEW ENEMY VEHICLES (Z80). unlock = first stage it appears; weight = [base, +per stage after unlock] in the wave mix.
export const ROSTER = {
  pyro:    { range:11, dps:15, cone:0.82, tick:0.35 },                     // flame tank: close-range fire hose (dps on the player while inside the cone)
  atgm:    { aimT:1.2, speed:21, turn:1.5, dmg:30, aoe:3.2, life:5.5, cd:6.5 },   // laser-painted wire-guided missile: shoot it down, dodge sharply, or pop SMOKE
  engineer:{ heal:9, range:16, selfHeal:3 },                               // heal = % of the patient's max HP ×(60/100)… per second (≈15%/s) — kill the medic first
  gunship: { alt:7.5, orbit:19, speed:9, range:34, gunDmg:3, gunCd:0.13, burst:9, burstCd:3.4, salvo:2, salvoCd:5, rocketDmg:12, rocketSpeed:28 },
  unlock:  { pyro:2, engineer:3, atgm:3, gunship:4 },
  weight:  { pyro:[1.0,0.5], engineer:[0.6,0.3], atgm:[0.8,0.5], gunship:[0.45,0.3] },
  aaBonus: 1.8,                                                            // FLAK airburst vs aircraft
};
// ============================================================================
// CAMPAIGN OPERATIONS (Z83) — every stage is a named operation: briefing, radio chatter, scripted waves and a
// high-value OBJECTIVE. While the objective stands it buffs the enemy (mods); destroying it pays a bounty + 1 diamond.
//   script = { wave: event }   events: ambush (squads drop in close) · column (armoured column from one edge) · pyro · airraid
// ============================================================================
export const OPERATIONS = [
  { title:'OPERATION SANDSTORM', obj:'depot', script:{ 2:'ambush', 4:'column' },
    brief:'Enemy armour is massing behind the dunes. Hold the Core, and burn the fuel depot that keeps their tanks rolling.',
    radio:{ 1:'Contact front — armour in the dunes!', 2:'Infantry in the open. Run them down!', 4:'Armoured column on the east road!', 5:'Last push before their command tank arrives.' },
    boss:'IRON BULL is rolling in. Hit its flanks.', win:'Depot is burning — their tanks are running dry!' },
  { title:'OPERATION BROKEN CITY', obj:'radio', script:{ 2:'pyro', 4:'ambush' },
    brief:'The ruins hide a radio relay calling in endless reinforcements. Silence it, then clear the streets.',
    radio:{ 1:'Movement in the rubble.', 2:'Flame tanks! Keep your distance!', 4:'RPG teams in the alleys — watch the rockets!', 5:'Relay still transmitting? Take it down!' },
    boss:'TEMPEST is circling the square.', win:'Relay is down — their reinforcements just went quiet.' },
  { title:'OPERATION WHITE SILENCE', obj:'radar', script:{ 3:'airraid', 5:'column' },
    brief:'A radar site on the ice is vectoring attack helicopters onto our position. Destroy it to clear the skies.',
    radio:{ 1:'Visibility is poor. Stay sharp.', 3:'Rotors inbound — gunships!', 4:'Engineers are patching their tanks. Kill the medics first.', 5:'Heavy column crossing the ice!' },
    boss:'GOLIATH has broken through the frost line.', win:'Radar is scrap. No more gunships on our heads.' },
  { title:'OPERATION IRON FURNACE', obj:'battery', script:{ 2:'column', 4:'airraid' },
    brief:'An artillery battery in the foundry is shelling our lines. Keep moving, and knock out those guns.',
    radio:{ 1:'Incoming shells — keep moving!', 2:'Armour pouring out of the furnace halls!', 4:'Air raid! Get to cover!', 5:'Tank-destroyers on the ridge — pop smoke if they paint you.' },
    boss:'REAPER is in the forge. Watch the beam.', win:'Battery silenced. The shelling has stopped.' },
  { title:'OPERATION LAST CITADEL', obj:'command', script:{ 1:'ambush', 3:'airraid', 5:'column' },
    brief:'This is their command bunker. Everything they have left is here. Break it, and the war ends today.',
    radio:{ 1:'They were waiting for us — ambush!', 2:'Hold the Core. Whatever it takes.', 3:'Every gunship they own is in the air!', 5:'Final column. This is it.' },
    boss:'OVERLORD has taken the field. End this.', win:'Command bunker destroyed — their lines are breaking!' },
];
export const OBJECTIVES = {
  depot:  { name:'FUEL DEPOT',        hp:260, r:6.2, effect:'Enemy tanks move 15% faster',          mods:{ enemySpeedMul:1.15 } },
  radio:  { name:'RADIO RELAY',       hp:220, r:3.6, effect:'Reinforcements arrive 25% faster',      mods:{ cadenceMul:0.75 } },
  radar:  { name:'RADAR SITE',        hp:260, r:4.8, effect:'A gunship joins every wave',            mods:{ gunshipPerWave:1 } },
  battery:{ name:'ARTILLERY BATTERY', hp:320, r:6.8, effect:'Shells your position every 9 seconds',  mods:{ shellEvery:9 } },
  command:{ name:'COMMAND BUNKER',    hp:440, r:6.6, effect:'Enemies deal 15% more damage',          mods:{ enemyDmgMul:1.15 } },
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
  hot:    { biomes:['DESERT','FOUNDRY'], hours:['noon'], fire:1.25, freeze:0.7 },   // heat: fires rage, ice melts off fast
  cold:   { biomes:['TUNDRA'], fire:0.75, freeze:1.5, cryo:1.2 },                  // frost: cryo locks targets for longer, flames gutter
  urban:  { biomes:['RUINS','CITADEL'], he:1.2 },                                  // rubble & walls: blast and splinters wreck more
  open:   { biomes:['MEADOW','DESERT'], longRange:1.1, guns:['cannon','railgun','hesh'] },   // long sight lines favour the big guns
};
// battlefield gun gifts: pity timer + counter-pick + prefer guns you don't hold yet (duplicates still feed MASTERY)
export const GIFT = { gunBase:0.30, pityStep:0.12, pityCap:0.85, counterW:1.6, newGunW:1.6 };

// ----- rarity colours (tier/VIP) -----
export const RAR_COL = { t1:0x9fb07a, t2:0x5aa9ff, t3:0xc08bff, vip:0x7fe7ff, up:0x9bd14a };

// ----- shop: leveled stat upgrades (L1-L3 coins, L4-L5 diamonds = VIP) -----
export const SHOP_UP = [
  {key:'damage', cat:'FIREPOWER', icon:'burst',  name:'DAMAGE',       per:'+8% bullet damage', costs:[{c:300},{c:800},{c:2000},{d:14},{d:26}]},
  {key:'boss',   cat:'FIREPOWER', icon:'shell',   name:'WARHEAD',      per:'+12% boss damage',  costs:[{c:400},{c:1100},{c:2600},{d:15},{d:28}]},
  {key:'range',  cat:'FIREPOWER', icon:'target', name:'LONG BARREL',  per:'+10% fire range',   costs:[{c:250},{c:700},{c:1700},{d:12},{d:22}]},
  {key:'reload', cat:'AMMO',      icon:'mag',    name:'FAST RELOAD',  per:'-12% reload time',  costs:[{c:300},{c:800},{c:2000},{d:14},{d:26}]},
  {key:'mag',    cat:'AMMO',      icon:'mag',    name:'BIG MAGAZINE', per:'+15% magazine',     costs:[{c:250},{c:700},{c:1700},{d:12},{d:22}]},
  {key:'hp',     cat:'CHASSIS',   icon:'heart',  name:'HULL PLATING', per:'+20 max HP',        costs:[{c:300},{c:800},{c:2000},{d:14},{d:26}]},
  {key:'armor',  cat:'CHASSIS',   icon:'shield', name:'ARMOR',        per:'-6% damage taken',  costs:[{c:400},{c:1000},{c:2500},{d:16},{d:30}]},
  {key:'engine', cat:'CHASSIS',   icon:'dash',   name:'ENGINE x2',    per:'+10% move speed',   costs:[{c:250},{c:700},{c:1700},{d:12},{d:22}]},
  // ----- SUPPORT units: buy & upgrade the guard squad and the escort drone -----
  {key:'guards',   cat:'SUPPORT', icon:'shield', name:'CORE GUARDS',   per:'+1 Core guard',          costs:[{c:900},{c:2400},{d:16}]},
  {key:'troops',   cat:'SUPPORT', icon:'up',     name:'GUARD: STRIKE', per:'+22% guard damage',      costs:[{c:600},{c:1500},{d:12}]},
  {key:'guardRof', cat:'SUPPORT', icon:'dash',   name:'GUARD: DRILL',  per:'-10% guard reload',      costs:[{c:700},{c:1800},{d:12}]},
  {key:'guardArm', cat:'SUPPORT', icon:'heart',  name:'GUARD: ARMOR',  per:'+18 HP per guard',       costs:[{c:700},{c:1800},{d:12}]},
  {key:'crew',     cat:'SUPPORT', icon:'shield', name:'TANK CREW',     per:'+1 tank crew',           costs:[{c:900},{c:2400},{d:16}]},
  {key:'dronePow', cat:'SUPPORT', icon:'drone',  name:'STRIKE DRONE',  per:'Unlock escort drone · +12% damage/lvl', costs:[{c:1500},{c:3200},{c:5000},{d:28},{d:40}]},
  {key:'droneRof', cat:'SUPPORT', icon:'dash',   name:'DRONE: ROTORS', per:'-10% drone reload',      costs:[{c:1200},{c:2800},{d:16}]},
  {key:'droneArm', cat:'SUPPORT', icon:'heart',  name:'DRONE: PLATING',per:'+40 HP drone',          costs:[{c:1200},{c:2800},{d:16}]},
];

// ----- gun unlocks. T1/T2/T3 in coins; railgun & rocket are VIP (diamonds only, never gifted in battle).
// VIP coin-equiv (28◆=5,600 / 34◆=6,800) sits ABOVE the best T3 coin gun (5,500) — value stays ordered. -----
export const GUN_PRICE = { smg:{c:500}, shotgun:{c:1400}, cryo:{c:1600}, flak:{c:1700}, cannon:{c:2000},
  flamer:{c:2200}, agl:{c:2600}, hesh:{c:3000}, mortar:{c:3800}, minigun:{c:4000}, missile:{c:4500}, tesla:{c:5000}, arty:{c:5500}, thermo:{c:5400}, railgun:{d:28}, rocket:{d:34} };
export const VIP_GUNS = ['railgun','rocket'];

// ----- punchy marketing blurbs (kept short) -----
export const GUN_BLURB = {
  rifle:'Trusty all-rounder — never jams, never quits.', smg:'A blistering storm of lead up close.',
  shotgun:'Point-blank devastation — eight pellets, one trigger.', flak:'Bursts of shrapnel that shred whole packs.',
  cannon:'One colossal shell. Heavy armour just folds.', cryo:'Freeze them solid — then shatter them.',
  minigun:'Endless barrels, endless fire. Hold the line.', missile:'Lock on. It hunts. It never misses.',
  tesla:'Lightning that arcs from foe to foe.', railgun:'A single shot punches clean through a whole column.',
  rocket:'Lob it in — a whole zone simply vanishes.',
  arty:'Heavy shells lobbed onto your mark — clears walls, bursts the instant they land.',
  mortar:'Lob shells over any wall — rapid indirect fire that bursts on impact.',
  flamer:'Set them ablaze — the fire only spreads, and it never lets go.',
  hesh:'Squash-head shells — flatten cover, topple towers, crack medium armour.',
  agl:'A hail of 40 mm grenades — squads and light armour scatter.',
  thermo:'Fuel-air rocket: one blinding blast, and everything inside burns.' };
// ----- STAGE CONTRACTS: pre-stage strategic choice (pick 1 of 3 each stage; applies for that stage only).
// mods are read live at use-sites via cMod() — pure data, no runtime coupling. Every contract is a risk/reward. -----
export const CONTRACTS = [
  { id:'steady',  name:'STEADY ADVANCE', icon:'shield', tag:'SAFE',      desc:'+10% coins · no extra risk',                       mods:{ coinMul:1.1 } },
  { id:'bounty',  name:'BOUNTY RUN',     icon:'coin',   tag:'COINS',     desc:'+70% coins · but enemies +20% HP',                 mods:{ coinMul:1.7, enemyHpMul:1.2 } },
  { id:'glass',   name:'GLASS CANNON',   icon:'burst',  tag:'HIGH RISK', desc:'+40% your damage · enemies +30% damage',           mods:{ playerDmgMul:1.4, enemyDmgMul:1.3 } },
  { id:'elite',   name:'ELITE HUNT',     icon:'shell',  tag:'ELITE',     desc:'1 elite every wave · +50% loot · enemies +10% HP',  mods:{ eliteEveryWave:true, lootChanceMul:1.5, enemyHpMul:1.1 } },
  { id:'scav',    name:'SCAVENGER',      icon:'mag',    tag:'LOOT',      desc:'×2 loot drops (farm guns/levels) · enemies +20% damage', mods:{ lootChanceMul:2, enemyDmgMul:1.2 } },
  { id:'warlord', name:"WARLORD'S CUT",  icon:'target', tag:'DIAMONDS',  desc:'Boss drops +2 💎 · but enemies +15% HP',           mods:{ bossDiaBonus:2, enemyHpMul:1.15 } },
];

export const UP_BLURB = {
  damage:'Every round bites harder.', range:'Strike first, from way out.', reload:'Back in the fight in a blink.',
  mag:'More rounds, far fewer reloads.', hp:'Soak up serious punishment.', armor:'Shrug off incoming fire.',
  engine:'Outrun anything on the battlefield.', guards:'More boots standing on the Core.',
  crew:'More gunners riding into battle.', troops:'Your troops hit a whole lot harder.',
  boss:'Tear through bosses far faster.',
  guardRof:'Drilled gunners fire far faster.', guardArm:'Hardened guards hold the line longer.',
  dronePow:'Deploy a gunship escort — and it bites harder.', droneRof:'Spin those barrels — the belt reloads in a blink.',
  droneArm:'Armoured rotors keep your drone in the sky longer.' };

// DRIVING (Z85) — the player's tank is a 50-tonne machine: hull-steered tracks, a heavy launch, momentum that carries,
// and collisions that hurt by mass × closing speed. Speeds in world units/s (top speed = PLAYER.maxSpeed 26).
export const DRIVE = {
  accel: 34,          // peak tractive acceleration once rolling
  launch: 0.32,       // share of that available from a dead stop (low gear, 50 t of inertia) → it CREEPS off the line
  launchV: 11,        // speed by which full power has come in
  reverseMul: 0.5,    // reverse top speed / accel vs forward
  reverseAngle: 2.25, // push the stick this far (rad) behind the hull → back up instead of pivoting round
  coast: 14,          // rolling resistance with the throttle off (it rolls on, then settles)
  brake: 44,          // braking against the motion
  pivot: 3.3,         // hull turn rate standing still (neutral steer, rad/s)
  turnAtSpeed: 1.9,   // hull turn rate at top speed — wide arcs when flat out
  grip: 10,           // sideways track grip — kills lateral slide
  ram: { minImpact: 7, toEnemy: 1.15, toPlayer: 0.42, toBoss: 0.7, aggressor: 0.5, perStage: 0.22 },   // dmg = k × (closing speed − min) × mass share
  wallBreak: 14,      // closing speed that smashes a brick wall section; slower just thumps it
  climb: 15.5,        // closing speed needed to ride over a low rock; slower → stopped dead, back up and take a run
};

// TROOPS (Z89) — APCs that drive in and DISMOUNT a squad; your own FIRETEAM call-in (equipment wheel).
export const TROOPS = {
  ridersFrom: 1,   // stage from which riflemen ride on your tank (G / CREW button drops them to fight on foot)
  dismount: { fromStage: 2, range: 28, troops: [3, 5], interval: 0.38, rpgFrom: 3 },   // enemy APC stops inside `range`, drops the ramp, troops pile out
  fireteam: { size: 4, perStage: 0.5, cap: 7, hp: 42, dmg: 7, range: 21, fireCd: 0.8, speed: 7.5, sprint: 12, follow: 7, cd: 24 },   // friendly squad that moves with your tank
};

// BATTLEFIELD INSTALLATIONS (Z90) — enemy troop camps that keep feeding infantry, and rope bridges linking paired watchtowers.
export const CAMP = { perStage: [1, 1, 2, 2, 2], hp: 420, hpPerStage: 0.18, every: 16, squad: [2, 3], infCap: 14, coin: 220, score: 900, tentScore: 60 };
export const BRIDGE = { pairChance: 0.75, minD: 12, maxD: 18, patrolSpeed: 1.6 };
