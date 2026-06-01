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
  {key:'guards', cat:'TROOPS',    icon:'shield', name:'CORE GUARDS',  per:'+1 base guard',     costs:[{c:900},{c:2400},{d:16}]},
  {key:'crew',   cat:'TROOPS',    icon:'shield', name:'TANK CREW',    per:'+1 base crew',      costs:[{c:900},{c:2400},{d:16}]},
  {key:'troops', cat:'TROOPS',    icon:'up',     name:'TROOP ARMS',   per:'+15% troop damage', costs:[{c:600},{c:1500},{d:12}]},
];

// ----- gun unlocks. T1/T2/T3 in coins; railgun & rocket are VIP (diamonds only, never gifted in battle).
// VIP coin-equiv (28◆=5,600 / 34◆=6,800) sits ABOVE the best T3 coin gun (5,000) — value stays ordered. -----
export const GUN_PRICE = { smg:{c:500}, shotgun:{c:1400}, cryo:{c:1600}, flak:{c:1700}, cannon:{c:2000},
  minigun:{c:4000}, missile:{c:4500}, tesla:{c:5000}, railgun:{d:28}, rocket:{d:34} };
export const VIP_GUNS = ['railgun','rocket'];

// ----- punchy marketing blurbs (kept short) -----
export const GUN_BLURB = {
  rifle:'Trusty all-rounder — never jams, never quits.', smg:'A blistering storm of lead up close.',
  shotgun:'Point-blank devastation — eight pellets, one trigger.', flak:'Bursts of shrapnel that shred whole packs.',
  cannon:'One colossal shell. Heavy armour just folds.', cryo:'Freeze them solid — then shatter them.',
  minigun:'Endless barrels, endless fire. Hold the line.', missile:'Lock on. It hunts. It never misses.',
  tesla:'Lightning that arcs from foe to foe.', railgun:'A single shot punches clean through a whole column.',
  rocket:'Lob it in — a whole zone simply vanishes.' };
export const UP_BLURB = {
  damage:'Every round bites harder.', range:'Strike first, from way out.', reload:'Back in the fight in a blink.',
  mag:'More rounds, far fewer reloads.', hp:'Soak up serious punishment.', armor:'Shrug off incoming fire.',
  engine:'Outrun anything on the battlefield.', guards:'More boots standing on the Core.',
  crew:'More gunners riding into battle.', troops:'Your troops hit a whole lot harder.',
  boss:'Tear through bosses far faster.' };
