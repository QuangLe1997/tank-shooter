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
// VIP coin-equiv (28◆=5,600 / 34◆=6,800) sits ABOVE the best T3 coin gun (5,000) — value stays ordered. -----
export const GUN_PRICE = { smg:{c:500}, shotgun:{c:1400}, cryo:{c:1600}, flak:{c:1700}, cannon:{c:2000},
  flamer:{c:2200}, minigun:{c:4000}, missile:{c:4500}, tesla:{c:5000}, arty:{c:5500}, railgun:{d:28}, rocket:{d:34} };
export const VIP_GUNS = ['railgun','rocket'];

// ----- punchy marketing blurbs (kept short) -----
export const GUN_BLURB = {
  rifle:'Trusty all-rounder — never jams, never quits.', smg:'A blistering storm of lead up close.',
  shotgun:'Point-blank devastation — eight pellets, one trigger.', flak:'Bursts of shrapnel that shred whole packs.',
  cannon:'One colossal shell. Heavy armour just folds.', cryo:'Freeze them solid — then shatter them.',
  minigun:'Endless barrels, endless fire. Hold the line.', missile:'Lock on. It hunts. It never misses.',
  tesla:'Lightning that arcs from foe to foe.', railgun:'A single shot punches clean through a whole column.',
  rocket:'Lob it in — a whole zone simply vanishes.',
  arty:'Rains shells from the sky — drops right onto cowards hiding behind cover.',
  flamer:'Set them ablaze — the fire only spreads, and it never lets go.' };
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
