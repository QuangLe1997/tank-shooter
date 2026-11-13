// ============================================================================
// STEEL SIEGE — smoke test for config.js (zero-dependency, node ESM).
// Run:  node test.js     (exits non-zero on any failed invariant)
// Guards the economy/balance data against silent breakage during edits.
// ============================================================================
import { HARD, TANK_DEATH, GUN_MODS, HIJACK, GORE, BALANCE, RAR_COL, SHOP_UP, GUN_PRICE, VIP_GUNS, GUN_BLURB, UP_BLURB, CONTRACTS, DMG_TYPE, ARMOR, RAMP, ENV, GIFT, INFANTRY, EQUIP, ROSTER, OPERATIONS, OBJECTIVES, OBJ_REWARD, DRIVE, TROOPS, CAMP, BRIDGE, LOOT, TACTICS, BOSSFIGHT, AIM, LETHAL, SQUAD, RALLY, POW, DEPOT, ALLY_TANK, PARA, DEPLOY, RELIEF, FIELD, CAMPAIGN, WEATHER, SPACE, FORT, COMMAND, KEYS_HELP, TOUCH_HELP, HEADING, TERRAIN_FLAT, POWER, RAM } from './config.js';
import { GUNS } from './src/data/guns.js';
import { ENEMY_DEFS, SOLDIER, RIDER, TOWER } from './src/data/enemies.js';
import { BOSS_DEFS } from './src/data/bosses.js';
import { BIOMES, ATMOS, GROUND_STYLE, TERRAIN_STYLE, BRICK_PAL, COVER_HP, TOD_ORDER } from './src/data/world.js';
import { BIOME_VI, CAT_VI, DIFF_META, STAGE_TAGS, TOD_LABEL } from './src/data/text-vi.js';
import { PLAYER } from './src/data/player.js';

const PLAYER_MAXSPEED = 26;   // index.html PLAYER.maxSpeed — keep in sync (used to prove artillery stays dodgeable)

let pass = 0, fail = 0;
const ok  = (c, msg) => { if (c) { pass++; } else { fail++; console.error('  ✗ ' + msg); } };
const grp = (name) => console.log('• ' + name);

// 1 diamond is worth this many coins of value (design benchmark — keep in sync with config comment)
const DIA = 200;
const coinValue = (cost) => (cost.c || 0) + (cost.d || 0) * DIA;
const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);

// recursively assert every numeric leaf in BALANCE is a finite number (catches typos → NaN/undefined)
function assertFiniteTree(obj, path) {
  for (const [k, v] of Object.entries(obj)) {
    const p = path + '.' + k;
    if (v && typeof v === 'object') assertFiniteTree(v, p);
    else ok(isFiniteNum(v), `BALANCE${p} should be a finite number (got ${v})`);
  }
}

grp('BALANCE — all knobs are finite numbers');
assertFiniteTree(BALANCE, '');

grp('BALANCE — values in sane ranges');
ok(BALANCE.loop.hp > 0 && BALANCE.loop.boss > 0 && BALANCE.loop.reward > 0, 'loop multipliers are positive');
ok(BALANCE.loop.boss >= BALANCE.loop.hp, 'boss HP ramps at least as fast as enemy HP per loop');
for (const key of ['brick', 'enemy', 'gem', 'gun']) {
  ok(BALANCE.drop[key] > 0 && BALANCE.drop[key] <= 1, `drop.${key} is a probability in (0,1]`);
}
ok(BALANCE.drop.gem < BALANCE.drop.gun, 'gem drop is rarer than gun drop (gem<gun in the cumulative roll)');
ok(BALANCE.elite.capChance > 0 && BALANCE.elite.capChance <= 1, 'elite.capChance is in (0,1]');
ok(BALANCE.elite.hpMul > 1 && BALANCE.elite.sizeMul > 1, 'elites are tankier & bigger than base');
ok(BALANCE.wave.base > 0 && BALANCE.wave.capBase > 0, 'wave base counts are positive');
ok(BALANCE.wave.eventChance > 0 && BALANCE.wave.eventChance < 1, 'wave.eventChance is a probability');
for (const [k, v] of Object.entries(BALANCE.up)) ok(v > 0, `up.${k} upgrade coefficient is positive`);
ok(BALANCE.coinBountyDiv > 0 && BALANCE.stageClearCoin > 0, 'coin earning divisors/bonuses are positive');

grp('SHOP_UP — schema + cost ladder integrity');
const seenKeys = new Set();
for (const u of SHOP_UP) {
  ok(u.key && u.cat && u.name && u.per && Array.isArray(u.costs), `${u.key||'?'} has key/cat/name/per/costs`);
  ok(!seenKeys.has(u.key), `${u.key} key is unique`);
  seenKeys.add(u.key);
  ok(u.costs.length >= 1, `${u.key} has at least one level`);
  // each cost is coins XOR diamonds, positive
  for (const c of u.costs) {
    const hasC = c.c > 0, hasD = c.d > 0;
    ok((hasC || hasD) && !(hasC && hasD), `${u.key} cost ${JSON.stringify(c)} is coins XOR diamonds, positive`);
  }
  // value rises monotonically across levels (cheap coin tiers → pricey diamond/VIP tiers)
  for (let i = 1; i < u.costs.length; i++) {
    ok(coinValue(u.costs[i]) > coinValue(u.costs[i - 1]),
       `${u.key} level ${i + 1} costs more value than level ${i}`);
  }
  // coin tiers must all precede diamond tiers (no coin level after a diamond level)
  let sawDia = false, ordered = true;
  for (const c of u.costs) { if (c.d > 0) sawDia = true; else if (sawDia) ordered = false; }
  ok(ordered, `${u.key} lists all coin tiers before diamond tiers`);
}

grp('GUN_PRICE — positive prices, VIP value ordering');
let bestCoinGun = 0;
for (const [id, cost] of Object.entries(GUN_PRICE)) {
  const hasC = cost.c > 0, hasD = cost.d > 0;
  ok((hasC || hasD) && !(hasC && hasD), `${id} price is coins XOR diamonds, positive`);
  if (hasC) bestCoinGun = Math.max(bestCoinGun, cost.c);
}
ok(Array.isArray(VIP_GUNS) && VIP_GUNS.length > 0, 'VIP_GUNS is a non-empty list');
for (const id of VIP_GUNS) {
  ok(GUN_PRICE[id], `VIP gun ${id} exists in GUN_PRICE`);
  ok(GUN_PRICE[id] && GUN_PRICE[id].d > 0 && !GUN_PRICE[id].c, `VIP gun ${id} is diamond-only (never coin-buyable)`);
  ok(coinValue(GUN_PRICE[id]) > bestCoinGun,
     `VIP gun ${id} value (${coinValue(GUN_PRICE[id])}) exceeds best coin gun (${bestCoinGun})`);
}

grp('RAR_COL — valid hex colours');
for (const [k, v] of Object.entries(RAR_COL)) {
  ok(Number.isInteger(v) && v >= 0 && v <= 0xffffff, `RAR_COL.${k} is a valid 24-bit hex colour`);
}

grp('MASTERY — gun leveling config integrity');
const M = BALANCE.mastery;
ok(Array.isArray(M.xp) && M.xp.length === M.maxLevel, `mastery.xp has one threshold per level (${M.maxLevel})`);
ok(M.xp[0] === 0, 'mastery level 1 needs 0 xp (free on first ownership)');
for (let i = 1; i < M.xp.length; i++) ok(M.xp[i] > M.xp[i - 1], `mastery.xp[${i}] threshold is strictly increasing`);
ok(M.maxLevel >= 2 && M.maxLevel <= 6, 'mastery.maxLevel is a sane small integer');
ok(M.dmgPerLevel > 0 && M.dmgPerLevel < 1, 'mastery.dmgPerLevel is a sane fraction');
ok(M.fireCdPerLevel > 0 && M.fireCdPerLevel * (M.maxLevel - 1) < 1, 'mastery.fireCdPerLevel never zeroes/inverts fireCd at max level');
ok(M.reloadPerLevel > 0 && M.reloadPerLevel * (M.maxLevel - 1) < 1, 'mastery.reloadPerLevel never zeroes/inverts reload at max level');
for (let i = 1; i < M.xp.length; i++) { const step = M.xp[i] - M.xp[i - 1]; ok(step >= 8 && step <= 24, `mastery level ${i + 1} needs ${step} dups (within 8-24 design window)`); }

grp('CONTRACTS — stage-modifier integrity');
ok(Array.isArray(CONTRACTS) && CONTRACTS.length >= 3, 'CONTRACTS has at least 3 options to choose from');
ok(CONTRACTS.some(c => c.id === 'steady'), 'a neutral/safe "steady" contract exists (always offered)');
const KNOWN_MODS = new Set(['coinMul','enemyHpMul','enemyDmgMul','playerDmgMul','lootChanceMul','eliteEveryWave','bossDiaBonus']);
const seenContractIds = new Set();
for (const c of CONTRACTS) {
  ok(c.id && c.name && c.icon && c.tag && c.desc && c.mods && typeof c.mods === 'object', `${c.id||'?'} has id/name/icon/tag/desc/mods`);
  ok(!seenContractIds.has(c.id), `contract id "${c.id}" is unique`);
  seenContractIds.add(c.id);
  for (const [k, v] of Object.entries(c.mods)) {
    ok(KNOWN_MODS.has(k), `${c.id} mod "${k}" is a recognized modifier (must be wired at a use-site)`);
    if (typeof v === 'number') ok(Number.isFinite(v) && v > 0, `${c.id} mod ${k} is a finite positive number`);
    else ok(typeof v === 'boolean', `${c.id} mod ${k} is a number or boolean`);
  }
  // every non-steady contract should have a real tradeoff (a downside mod), not be pure upside
  if (c.id !== 'steady') {
    const harms = (c.mods.enemyHpMul > 1) || (c.mods.enemyDmgMul > 1);
    ok(harms, `${c.id} has a downside (tougher/deadlier enemies) — risk/reward, not free power`);
  }
}

grp('ARTILLERY — lock-strike balance + dodgeability');
const A = BALANCE.artillery;
for (const k of ['radius','dmgMax','dmgMin','lockTime','flightTime','gravity','warnLead','restMin','restMax','shotSpacing','shotsBase','shotsMax'])
  ok(typeof A[k] === 'number' && A[k] > 0, `artillery.${k} is a positive number`);
ok(A.innerFrac > 0 && A.innerFrac < 1, 'artillery.innerFrac (direct-hit zone) is a fraction in (0,1)');
ok(A.dmgMax > A.dmgMin, 'artillery: bullseye damage exceeds edge (graze) damage');
ok(A.restMax >= A.restMin, 'artillery rest window is well-ordered (max ≥ min)');
ok(A.shotsMax >= A.shotsBase && A.shotsBase >= 1, 'artillery barrage size is sane (max ≥ base ≥ 1)');
// DODGEABLE: the player must be able to clear the blast radius within the lock+flight window at base speed
const dodgeWindow = A.lockTime + A.flightTime;
ok(A.radius <= PLAYER_MAXSPEED * dodgeWindow, `artillery blast radius (${A.radius}) is escapable in the ${dodgeWindow.toFixed(2)}s window at base speed`);
ok(dodgeWindow >= 1.2, 'artillery gives at least ~1.2s to react+move (not impossible)');
ok(dodgeWindow <= 3.5, 'artillery window is tight enough to matter (not trivially long)');

grp('SUPPORT DRONE — gunship combat tuning');
const D = BALANCE.drone;
for (const k of ['dur','orbit','height','detect','hp','dmg','bspeed','mag','fireCd','reload','fireRot','idleRot','hitR'])
  ok(typeof D[k] === 'number' && isFinite(D[k]) && D[k] > 0, `drone.${k} is a positive finite number`);
ok(D.detect > D.orbit, 'drone detect radius reaches beyond its orbit (can engage past the player)');
ok(D.fireRot > D.idleRot, 'gatling spins faster firing than idle (visible spin-up)');
ok(D.mag >= 1 && D.fireCd < D.reload, 'belt is sane: ≥1 round & per-round gap shorter than the reload');
ok(D.reload >= 4, `drone reload is deliberately long (${D.reload}s ≥ 4) — can't lean on it to win fights`);
ok(D.fireCd >= 0.3, `drone cadence is slow (${D.fireCd}s ≥ 0.3) — a helper, not a primary weapon`);
// sustained DPS = mag·dmg / (mag·fireCd + reload) — SUPPORT tier: low chip damage, far below the tank's own output
const droneDps = D.mag * D.dmg / (D.mag * D.fireCd + D.reload);
ok(droneDps > 1 && droneDps < 12, `drone sustained DPS (${droneDps.toFixed(1)}) is support-tier (1–12, well under a tank's)`);
// it must take MANY rounds to down a basic grunt (~32 HP) → clearly a chipper, not a killer
ok(32 / D.dmg >= 4, `drone needs ≥4 hits to kill a grunt (${Math.ceil(32/D.dmg)} hits) — chips, doesn't delete`);
ok(D.hp >= 60 && D.hp <= 300, `drone HP (${D.hp}) is killable-but-durable (60–300) so enemy fire matters`);

grp('SUPPORT UPGRADES — buyable drone + guard tracks');
const SUP = BALANCE.support;
for (const k of ['dronePowPerLvl','droneRofPerLvl','droneArmPerLvl','guardRofPerLvl','guardArmPerLvl','mulFloor'])
  ok(typeof SUP[k] === 'number' && isFinite(SUP[k]) && SUP[k] > 0, `support.${k} is a positive finite number`);
ok(SUP.mulFloor > 0 && SUP.mulFloor < 1, 'support.mulFloor is a fraction in (0,1) — reload/fire mult never reaches 0');
for (const k of ['dronePow','droneRof','droneArm','guardRof','guardArm']) {
  const u = SHOP_UP.find(x => x.key === k);
  ok(u && u.cat === 'SUPPORT', `SHOP_UP has a SUPPORT-tab entry "${k}"`);
}
const dronePow = SHOP_UP.find(x => x.key === 'dronePow');
ok(dronePow && dronePow.costs[0] && dronePow.costs[0].c > 0, 'STRIKE DRONE L1 is coin-buyable (you can OWN the escort without diamonds)');
// reload mults stay in a fair band even when fully maxed
const droneRofLvls = SHOP_UP.find(x => x.key === 'droneRof').costs.length;
const guardRofLvls = SHOP_UP.find(x => x.key === 'guardRof').costs.length;
ok(Math.max(SUP.mulFloor, 1 - droneRofLvls*SUP.droneRofPerLvl) >= SUP.mulFloor, 'maxed drone reload mult respects the floor');
ok(Math.max(SUP.mulFloor, 1 - guardRofLvls*SUP.guardRofPerLvl) >= SUP.mulFloor, 'maxed guard fire mult respects the floor');

grp('FLAMETHROWER (PYRO) — reach + burn balance');
const FL = BALANCE.flame;
for (const k of ['dps','lvlMax','add','grow','duration','range','cone'])
  ok(typeof FL[k] === 'number' && isFinite(FL[k]) && FL[k] > 0, `flame.${k} is a positive finite number`);
ok(FL.cone > 0 && FL.cone < 1, 'flame.cone is a valid cosine threshold in (0,1)');
ok(FL.range >= 16, `flame reaches far enough (range ${FL.range} ≥ 16 — a real jet, not a nuzzle)`);
ok(FL.duration >= 8, `burn lingers long enough (duration ${FL.duration}s ≥ 8 — slow self-immolation)`);
// a single light touch (one spray-tick) must eventually finish a weak grunt (~32 HP) on its own:
const lightTouchDmg = FL.dps * (FL.add*FL.duration + FL.grow*FL.duration*FL.duration/2);
ok(lightTouchDmg > 32, `one light touch burns a grunt to death over time (${lightTouchDmg.toFixed(0)} dmg > 32)`);
ok(FL.dps * FL.lvlMax >= 24, `sustained spray melts fast (max DoT ${FL.dps*FL.lvlMax}/s ≥ 24)`);

grp('DIFFICULTY — preset scaling sanity');
const DF = BALANCE.difficulty;
for (const k of ['recruit','soldier','veteran']){ const d=DF[k];
  ok(d && isFinite(d.hp) && isFinite(d.dmg) && isFinite(d.reward) && d.hp>0 && d.dmg>0 && d.reward>0, `difficulty.${k} has positive finite hp/dmg/reward`);
}
ok(DF.soldier.hp===1 && DF.soldier.dmg===1 && DF.soldier.reward===1, 'SOLDIER is the 1.0 baseline');
ok(DF.recruit.hp < DF.soldier.hp && DF.soldier.hp < DF.veteran.hp, 'enemy HP ramps recruit < soldier < veteran');
ok(DF.recruit.dmg < DF.soldier.dmg && DF.soldier.dmg < DF.veteran.dmg, 'enemy damage ramps recruit < soldier < veteran');
ok(DF.veteran.reward > DF.soldier.reward && DF.soldier.reward >= DF.recruit.reward, 'reward: veteran > soldier ≥ recruit (harder pays more)');

// ----- ARMS DOCTRINE (Z75): damage types × armour, ramp, environment, gift -----
grp('ARMS DOCTRINE — damage types, armour classes, ramp, environment, gifts');
for (const [t, m] of Object.entries(DMG_TYPE)) {
  for (const k of ['L','M','H','struct']) ok(typeof m[k]==='number' && m[k]>0.2 && m[k]<=3.2, `DMG_TYPE.${t}.${k} in (0.2,3.2]`);
  ok(typeof m.label==='string' && m.label.length>0, `DMG_TYPE.${t} has a label`);
}
ok(DMG_TYPE.AP.H > DMG_TYPE.AP.L, 'AP is best against HEAVY armour');
ok(DMG_TYPE.KIN.H < DMG_TYPE.KIN.L, 'KINETIC is weak against HEAVY armour');
ok(DMG_TYPE.FRAG.L >= DMG_TYPE.HE.L, 'FRAG shreds LIGHT targets at least as well as HE');
ok(DMG_TYPE.HESH.struct === Math.max(...Object.values(DMG_TYPE).map(m=>m.struct)), 'HESH is the best structure-breaker');
for (const [e, a] of Object.entries(ARMOR)) ok(['L','M','H','A'].includes(a), `ARMOR.${e} is L/M/H/A`);
for (const [t, m] of Object.entries(DMG_TYPE)) ok(m.A > 0 && m.A <= 1.5, `DMG_TYPE.${t}.A (vs aircraft) is in (0,1.5]`);

grp('CAMPAIGN OPERATIONS (Z83)');
ok(OPERATIONS.length === 5, 'one operation per campaign stage');
const EVENTS = ['ambush','column','pyro','airraid'];
OPERATIONS.forEach((op, i) => { const st = i + 1;
  ok(op.title && op.brief && op.boss && op.win, `stage ${st} operation has title/brief/boss/win lines`);
  ok(OBJECTIVES[op.obj], `stage ${st} objective '${op.obj}' exists`);
  for (const [w, ev] of Object.entries(op.script)) { ok(EVENTS.includes(ev), `stage ${st} wave ${w} event '${ev}' is known`); ok(+w >= 1 && +w <= 5, `stage ${st} scripted wave ${w} is within 1..5`);
    if (ev === 'airraid') ok(st >= 3, `air raids are scripted only from stage 3 (gunships unlock late)`);
    if (ev === 'pyro') ok(st >= ROSTER.unlock.pyro, 'flame tanks scripted only once unlocked'); }
  for (const w of Object.keys(op.radio)) ok(+w >= 1 && +w <= 5, `stage ${st} radio line for wave ${w}`); });
ok(!OPERATIONS[0].script[1], 'stage 1 wave 1 stays unscripted (gentle start)');
for (const [k, o] of Object.entries(OBJECTIVES)) { ok(o.hp > 0 && o.r > 1 && o.name && o.effect && o.mods && Object.keys(o.mods).length, `objective ${k} has hp/r/name/effect/mods`); }
ok(OBJECTIVES.command.hp >= OBJECTIVES.depot.hp, 'the final command bunker is the toughest target');
ok(OBJ_REWARD.coin > 0 && OBJ_REWARD.dia >= 1, 'objectives pay coins and at least one diamond');
ok(OBJECTIVES.radio.mods.cadenceMul < 1 && OBJECTIVES.depot.mods.enemySpeedMul > 1 && OBJECTIVES.command.mods.enemyDmgMul > 1, 'objective buffs push in the enemy favour');

grp('NEW VEHICLES (Z80)');
for (const k of Object.keys(ROSTER.unlock)) { ok(ARMOR[k], `ROSTER.${k} has an armour class`); ok(ROSTER.unlock[k] >= 2 && ROSTER.unlock[k] <= 5, `${k} unlocks between stage 2 and 5`);
  ok(Array.isArray(ROSTER.weight[k]) && ROSTER.weight[k][0] > 0 && ROSTER.weight[k][1] >= 0, `${k} has a positive wave weight`); }
ok(ROSTER.atgm.aimT >= 1, 'ATGM laser-paint telegraph ≥ 1s');
ok(ROSTER.atgm.speed < PLAYER_MAXSPEED, 'guided missile is slower than the tank — it can be out-turned');
ok(ROSTER.atgm.turn < 3, 'ATGM turn rate is limited (a sharp dodge shakes it)');
ok(ROSTER.pyro.cone > 0.5 && ROSTER.pyro.cone < 1, 'flame cone is a valid cosine');
ok(ROSTER.pyro.dps * 3 < 60, 'standing 3s in the flames is costly but not instant death');
ok(ROSTER.gunship.alt > 4 && ROSTER.gunship.range > ROSTER.gunship.orbit, 'gunship flies high and engages from its orbit');
ok(ROSTER.aaBonus > 1, 'flak gets a bonus against aircraft');
ok(ARMOR.gunship === 'A', 'gunship uses the aircraft armour class');

grp('INFANTRY + EQUIPMENT (Z79/Z82)');
for (const k of ['rifle','rpg']) { const d = INFANTRY[k];
  ok(d.hp > 0 && d.speed > 0 && d.range > d.keep && d.dmg > 0 && d.score > 0, `INFANTRY.${k} has sane hp/speed/range>keep/dmg/score`);
  ok(ARMOR[k] === 'L', `INFANTRY.${k} is light armour`); }
ok(INFANTRY.rpg.aimT >= 0.6, 'RPG kneel telegraph ≥ 0.6s (fair warning before the rocket)');
ok(INFANTRY.rpg.dmg <= 30, 'one RPG never deals more than 30');
ok(INFANTRY.crushSpeed > 0 && INFANTRY.crushSpeed < PLAYER_MAXSPEED * 0.3, 'crushing needs a roll, not a crawl — well under top speed');
ok(INFANTRY.squad.size[0] >= 2 && INFANTRY.squad.size[1] >= INFANTRY.squad.size[0], 'squad size range is valid');
ok(INFANTRY.bail > 0 && INFANTRY.bail <= 1, 'APC bail-out chance is a probability');
{ const sq=(s,w)=> w>=INFANTRY.squad.fromWave ? Math.floor(INFANTRY.squad.base + w*INFANTRY.squad.perWave + (s-1)*INFANTRY.squad.perStage) : 0;
  ok(sq(1,1) === 0, 'no squads in the very first wave'); ok(sq(5,5) >= sq(1,2) && sq(5,5) <= 4, 'squads ramp gently (≤4 per wave)'); }
ok(EQUIP.smoke.dur > 0 && EQUIP.smoke.spreadMul > 1, 'smoke lasts and worsens enemy aim');
ok(EQUIP.aps.charges >= 1 && EQUIP.aps.radius > 3, 'APS has charges and a sensible radius');
ok(EQUIP.mines.count >= 1 && EQUIP.mines.dmg > 0 && EQUIP.mines.arm > 0, 'mines have count/damage/arm delay');
ok(RAMP.hpPerStage > 0 && RAMP.hpPerStage < 0.4, 'enemy HP ramps gently per stage');
ok(ENV.night.range > 0.5 && ENV.night.range < 1, 'night shortens reach (but not to nothing)');
ok(Array.isArray(ENV.night.exempt) && ENV.night.exempt.includes('railgun'), 'railgun keeps its reach at night (thermal)');
ok(ENV.cold.freeze > 1 && ENV.hot.freeze < 1, 'cold helps cryo, heat hurts it');
ok(ENV.hot.fire > 1 && ENV.cold.fire < 1, 'heat helps fire, cold hurts it');
ok(GIFT.gunBase > 0 && GIFT.gunBase < GIFT.pityCap && GIFT.pityCap <= 1, 'gun gift chance: base < pity cap ≤ 1');
ok(GIFT.pityStep > 0, 'pity timer raises the gun chance after dry loot');

grp('DRIVING (Z85) — tracked drive, momentum, ramming');
ok(DRIVE.launch > 0.5 && DRIVE.launch < 0.9, 'Z107 light launch: most of the power from a dead stop (no 50-t creep)');
ok(DRIVE.launchV > 0 && DRIVE.launchV < PLAYER_MAXSPEED, 'full power arrives before top speed');
{ // simulate the throttle curve: 0 → 90% top speed should take a real tank's second or two, not an instant
  let v=0, t=0; const top=PLAYER_MAXSPEED; while(v<top*0.9 && t<10){ const launch=DRIVE.launch+(1-DRIVE.launch)*Math.min(1,v/DRIVE.launchV), fall=Math.max(0,1-(v/top)**2); v+=DRIVE.accel*launch*fall*(1/60); t+=1/60; }
  ok(t > 0.9 && t < 2.6, `0→90% top speed in ${t.toFixed(2)}s (0.9–2.6s: weighty but playable)`); }
ok(DRIVE.coast > 0 && DRIVE.coast < DRIVE.brake, 'coasting rolls on; braking bites harder');
{ let v=PLAYER_MAXSPEED, t=0, s=0; while(v>0.01 && t<5){ v-=Math.min(v,(DRIVE.coast+v*DRIVE.coastLin)/60); s+=v/60; t+=1/60; }
  ok(t > 0.4 && t < 1.0 && s < 10, 'Z107 coast-down from top speed settles in <1 s and <10 m (little inertia)'); }
ok(DRIVE.accel < 23, 'Z107 calmer peak acceleration than Z99');
ok(DRIVE.reverseMul > 0.3 && DRIVE.reverseMul < 0.8, 'reverse is slower than forward');
ok(DRIVE.pivot > DRIVE.turnAtSpeed, 'hull pivots faster standing still than flat out');
ok(DRIVE.wallBreak > 6 && DRIVE.wallBreak < PLAYER_MAXSPEED*0.75, 'walls need a run-up, but are breakable well below top speed');
ok(DRIVE.climb > 6 && DRIVE.climb < PLAYER_MAXSPEED*0.75, 'rocks need a run-up to climb');
ok(DRIVE.ram.minImpact > 3, 'gentle bumps never hurt');
ok(DRIVE.ram.toPlayer < DRIVE.ram.toEnemy, 'ramming favours the player (it is your weapon, not a trap)');
ok(DRIVE.ram.aggressor > 0 && DRIVE.ram.aggressor < 1, 'the rammer takes less than the rammed');
{ const ex=26+3-DRIVE.ram.minImpact, share=2*1/(1+1.25), toPlayer=ex*share*DRIVE.ram.toPlayer*(1-DRIVE.ram.aggressor);
  ok(toPlayer < 10, `full-speed ram into a light tank costs the player ${toPlayer.toFixed(1)} HP (< 10)`); }

grp('TROOPS & INSTALLATIONS (Z89–Z90)');
{ const D0=TROOPS.dismount; ok(D0.fromStage >= 2, 'stage 1 APCs never dismount (a gentle start)');
  ok(D0.troops[0] >= 2 && D0.troops[1] <= 6 && D0.troops[1] >= D0.troops[0], 'an APC carries 2–6 troops');
  ok(D0.range > 15 && D0.range < 40, 'APC dismounts at a readable mid range');
  ok(D0.interval >= 0.2 && D0.interval <= 1, 'troops pile out one by one (0.2–1s apart)'); }
{ const F=TROOPS.fireteam; ok(F.size >= 3 && F.cap >= F.size && F.cap <= 14 && F.capMobile <= F.cap, 'fireteam 3+ soldiers, capped ≤ 14 (Z104 wider field), phones ≤ desktop');
  ok(F.sprint > F.speed && F.speed < PLAYER_MAXSPEED, 'fireteam jogs slower than the tank and sprints to catch up');
  ok(F.dmg > 0 && F.range > 10 && F.fireCd > 0.3, 'fireteam has real but modest firepower');
  ok(F.cd >= 15, 'FIRETEAM call-in has a meaningful cooldown (≥15s)'); }
ok(TROOPS.ridersFrom >= 1 && TROOPS.ridersFrom <= 3, 'your crew rides the tank from an early stage');
ok(CAMP.perStage.every(n=>n>=1 && n<=3), '1–3 enemy camps per stage');
ok(CAMP.every >= 8, 'camps reinforce at a fair pace (≥8s between squads)');
ok(CAMP.infCap >= 8 && CAMP.infCap <= 26, 'camps stop feeding when the field already holds many soldiers (Z104: ≤ 26 on the wider field)');
ok(CAMP.hp > 150 && CAMP.coin > 0 && CAMP.score > 0, 'a camp is a tough, rewarding target');
ok(BRIDGE.minD > 6 && BRIDGE.maxD > BRIDGE.minD && BRIDGE.maxD <= 24, 'bridged tower pairs sit 6–24 apart');
ok(BRIDGE.pairChance > 0 && BRIDGE.pairChance <= 1, 'tower pairing is a probability');

grp('LOOT (Z93) — engine & armour pickups, stacking, sources');
{ const R=LOOT.rules; ok(R.extendShare>0 && R.extendShare<1, 'a repeat pickup extends by a fraction of its timer');
  ok(R.maxDurMul>1 && R.maxDurMul<=2, 'extensions are capped (≤2× a full timer) — no infinite buffs');
  const worst=1.3*LOOT.speed.top*(1+5*BALANCE.up.engine); ok(worst>R.speedCap && R.speedCap<=1.8, `speed sources stack to ×${worst.toFixed(2)} uncapped → hard cap ×${R.speedCap}`);
  ok(LOOT.speed.top>1 && LOOT.speed.top<=1.4, 'ENGINE OVERDRIVE: a clear but modest boost');
  ok(LOOT.turbo.maxLv>=1 && LOOT.turbo.maxLv<=3 && LOOT.turbo.accel*LOOT.turbo.maxLv<=1, 'TURBO levels capped; at most doubles acceleration');
  ok(LOOT.turbo.launch>0 && LOOT.turbo.launch*LOOT.turbo.maxLv>=1, 'max TURBO removes the heavy launch entirely');
  ok(LOOT.ram.dealt>1 && LOOT.ram.taken<1 && LOOT.ram.mass>1, 'DOZER BLADE: hits harder, takes less, shoves more');
  ok(DRIVE.wallBreak*LOOT.ram.wall>5, 'even with the blade a wall still needs a roll, not a crawl');
  ok(LOOT.era.cap>=LOOT.era.charges && LOOT.era.absorb>0 && LOOT.era.absorb<1, 'ERA tiles stack to a cap and never make you immune');
  ok(LOOT.era.minHit>=5, 'ERA ignores chip damage (tiles are spent on real hits)');
  const maxChance=BALANCE.drop.enemy*LOOT.source.chanceCap; ok(maxChance<=0.5, `toughest enemy drops at most ${(maxChance*100).toFixed(0)}%`);
  ok(LOOT.source.rareHp<LOOT.source.epicHp, 'epic sources are tougher than rare ones');
  ok(LOOT.cache.perStage.every(n=>n>=1&&n<=4) && LOOT.cache.hp>0, '1–4 guarded caches per stage'); }
for(const k of ['turbo','ramplate']){ const u=SHOP_UP.find(x=>x.key===k); ok(!!u && u.costs.length>=2 && u.costs.every((c,i,a)=>!i||((c.c||0)>=(a[i-1].c||0))), `shop ${k} exists with rising prices`); }
ok(BALANCE.up.ramguard*3<0.5, 'RAM PLATE max still leaves ≥50% ram damage taken');

grp('VIETNAMESE CAMPAIGN (Z94)');
const VI=/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
for(const [i,op] of OPERATIONS.entries()){ ok(typeof op.story==='string' && op.story.length>40 && VI.test(op.story), `operation ${i+1} has a Vietnamese story beat`);
  ok(VI.test(op.brief) && VI.test(op.boss) && VI.test(op.win), `operation ${i+1} brief/boss/win lines are Vietnamese`); }
for(const k of Object.keys(OBJECTIVES)) ok(VI.test(OBJECTIVES[k].vi||'') && VI.test(OBJECTIVES[k].effectVi||''), `objective ${k} has a Vietnamese name + effect`);
for(const c of CONTRACTS) ok(VI.test(c.name+c.desc), `contract ${c.id} is in Vietnamese`);
for(const u of SHOP_UP) ok(VI.test(u.name+u.per) || /^[A-Z ]+$/.test(u.name)===false, `shop item ${u.key} is in Vietnamese`);

grp('TACTICS (Z95) — enemy IQ climbs with stage & difficulty');
{ const T=TACTICS, iq=(st,d,l)=>Math.max(0,Math.min(T.iq.cap, T.iq.base+T.iq.perStage*(st-1)+(T.iq[d]||0)+(l||0)*T.iq.loop));
  ok(iq(1,'recruit') < T.flankFrom && iq(1,'soldier') < T.flankFrom, 'stage 1 enemies never flank (they just charge)');
  ok(iq(1,'soldier') < T.coverFrom, 'stage 1 enemies do not use cover');
  ok(iq(3,'soldier') >= T.flankFrom && iq(3,'soldier') < iq(5,'soldier'), 'flanking appears mid-campaign and keeps sharpening');
  ok(iq(5,'veteran') >= 0.95, 'stage 5 veterans fight at (near) full IQ');
  ok(iq(5,'recruit') < iq(5,'veteran'), 'difficulty changes how smart they are, not just HP');
  for(let st=1;st<5;st++) ok(iq(st+1,'soldier') > iq(st,'soldier') || iq(st,'soldier')===T.iq.cap, `IQ never drops from stage ${st} to ${st+1}`);
  ok(T.flankShare>0 && T.flankShare<=0.5, 'at most half the line flanks — someone still holds your front');
  ok(T.retreatHp>0 && T.retreatHp<0.5, 'only badly hurt tanks fall back');
  ok(T.press.keep<1 && T.press.keep>0.3, 'pressing closes the range but does not ram into you');
  ok(T.dodge.cd>=1 && T.dodge.time<1, 'dodges are short and on a cooldown (still hittable)');
  ok(T.leadMax>0 && T.leadMax<=1, 'shot lead never exceeds a perfect intercept'); }

grp('BOSS FIGHTS (Z96) — phases, arcs, windows, pylons');
{ const B=BOSSFIGHT; ok(B.phases.length===2 && B.phases[0]>B.phases[1] && B.phases[1]>0, 'three phases split at descending HP marks');
  ok(B.arc.rear>1 && B.arc.front<1, 'rear hits reward flanking, frontal hits are blunted');
  ok(B.stun.mul>1 && B.stun.time>=2 && B.stun.time<=5, 'a stun is a real but short punish window');
  ok(B.vent.every>=2 && B.vent.mul>1 && B.vent.time<B.stun.time+1, 'overheat windows come after several big attacks');
  ok(B.part.share>0 && B.part.share<1, 'hitting a subsystem still hurts the hull a little');
  ok(B.pylon.n>=2 && B.pylon.n<=4 && B.pylon.hp>0, '2–4 shield pylons, each breakable');
  ok(B.transition.invuln<3 && B.transition.blastDmg<25, 'phase change is a breather, not a one-shot');
  ok(B.barrage.lead>=0.8, 'walking barrage gives ≥0.8s before the first shell lands');
  ok(B.barrage.r < B.barrage.step*1.2, 'barrage shells leave gaps you can slip through'); }

grp('DATA CONTRACTS (Z98) — every registry entry is complete, so adding content cannot half-break the game');
// GUNS ↔ economy ↔ copy
for(const [id,g] of Object.entries(GUNS)){
  ok(typeof g.name==='string' && g.name.length>0 && typeof g.svg==='string', `gun ${id}: has name + icon`);
  ok(DMG_TYPE[g.type] !== undefined, `gun ${id}: damage type "${g.type}" exists in DMG_TYPE`);
  ok(g.mag>0 && g.reload>0 && g.fireCd>0, `gun ${id}: mag/reload/fireCd are positive`);
  ok(id==='rifle' || GUN_PRICE[id] !== undefined, `gun ${id}: has a shop price (GUN_PRICE)`);
  ok(typeof GUN_BLURB[id]==='string', `gun ${id}: has a shop blurb (GUN_BLURB)`); }
for(const id of Object.keys(GUN_PRICE)) ok(GUNS[id] !== undefined, `GUN_PRICE.${id} points at a real gun`);
// ENEMIES ↔ armour classes
for(const [id,d] of Object.entries(ENEMY_DEFS)){
  ok(d.hp>0 && d.speed>=0 && d.score>0, `enemy ${id}: hp/speed/score sane`);
  ok(['L','M','H','A'].includes(ARMOR[id]), `enemy ${id}: has an armour class in ARMOR`);
  ok(d.inf || d.air || d.pal, `enemy ${id}: vehicles carry a colour palette`); }
// BOSSES ↔ campaign
ok(BOSS_DEFS.length === OPERATIONS.length, 'one boss per campaign operation');
for(const b of BOSS_DEFS){
  ok(b.hp>0 && b.scale>0 && b.pal && b.pal.accent!==undefined, `boss ${b.id}: hp/scale/palette`);
  ok(Array.isArray(b.phases) && b.phases.length===3, `boss ${b.id}: names all 3 phases`);
  ok(Array.isArray(b.parts) && b.parts.length>=1 && b.parts.every(q=>q.id && q.vi && q.at && q.at.length===3 && q.r>0 && q.hp>0 && q.hp<0.2), `boss ${b.id}: weak points are complete (id, label, position, radius, hp share <20%)`);
  ok(b.parts.reduce((a,q)=>a+q.hp,0) < 0.4, `boss ${b.id}: weak points hold < 40% of its HP in total`);
  ok(b.front>0 && b.front<=1 && b.rear>=1, `boss ${b.id}: front ≤1 ≤ rear armour multipliers`);
  ok((b.shield||[]).every(ph=>ph>=1 && ph<=2), `boss ${b.id}: shield phases are 1 or 2`);
  ok(Array.isArray(b.taunt) && b.taunt.length>=1, `boss ${b.id}: has taunt lines`); }
// WORLD — every biome is fully described everywhere it is looked up
for(const b of BIOMES){ const n=b.name;
  ok(ATMOS[n]!==undefined, `biome ${n}: has an atmosphere (ATMOS)`);
  ok(GROUND_STYLE[n]!==undefined, `biome ${n}: has ground albedo (GROUND_STYLE)`);
  ok(TERRAIN_STYLE[n]!==undefined, `biome ${n}: has relief style (TERRAIN_STYLE)`);
  ok(BRICK_PAL[n]!==undefined, `biome ${n}: has a brick palette (BRICK_PAL)`);
  ok(typeof BIOME_VI[n]==='string', `biome ${n}: has a Vietnamese display name (BIOME_VI)`); }
for(const t of new Set(TOD_ORDER)) ok(typeof TOD_LABEL[t]==='string', `time of day ${t}: has a Vietnamese label`);
for(const k of ['recruit','soldier','veteran']) ok(DIFF_META[k] && BALANCE.difficulty[k], `difficulty ${k}: label + balance numbers`);
for(const c of new Set(SHOP_UP.map(u=>u.cat))) ok(typeof CAT_VI[c]==='string', `shop category ${c}: has a Vietnamese tab name`);
ok(STAGE_TAGS.length >= OPERATIONS.length, 'a stage tag line for every operation');
ok(PLAYER.maxSpeed === PLAYER_MAXSPEED, 'test constant PLAYER_MAXSPEED matches data/player.js');
ok(SOLDIER.hp>0 && RIDER.hp>0 && TOWER.hp>0, 'support/tower units have HP');
for(const [k,v] of Object.entries(COVER_HP)) ok(v>0, `cover ${k}: positive HP`);

grp('SQUAD (Z100) — free-roam inside the tank zone, hold-to-recall, on-tank healing');
{ const F=TROOPS.fireteam; ok(F.zoneMul>0.5 && F.zoneMul<=1 && F.zoneMin>=12, 'squad zone tracks the tank fire range (never tiny)');
  ok(F.detect>=F.range, 'soldiers spot enemies at least as far as they can shoot');
  ok(F.patrol[0]>3 && F.patrol[1]<F.zoneMin, 'idle posts sit inside the smallest zone');
  ok(F.spread>1 && F.spread<5, 'soldiers keep personal space');
  ok(F.tapMax>0.1 && F.tapMax<0.6, 'tap vs hold threshold feels natural (0.1–0.6s)');
  ok(TROOPS.crewHeal>0 && TROOPS.crewHeal*10 < 60, 'riding heals gradually (not an instant refill)'); }

grp('BLURBS — present for every item');
for (const u of SHOP_UP) {
  ok(typeof UP_BLURB[u.key] === 'string' && UP_BLURB[u.key].length > 0, `UP_BLURB has copy for upgrade "${u.key}"`);
}
// ---------------------------------------------------------------------------
// Z104 DATA CONTRACTS — wider battlefield, squad AI, installations, paratroopers
// ---------------------------------------------------------------------------
{ const N=OPERATIONS.length, perStage=(arr)=>Array.isArray(arr) && arr.length===N && arr.every(n=>Number.isInteger(n) && n>=0);
  const range=(r,lo,hi)=>Array.isArray(r) && r.length===2 && r[0]<=r[1] && r[0]>=lo && r[1]<=hi;
  // mobile aim: a narrow forward cone (wide enough to hit, narrow enough to mean "where the hull points")
  ok(AIM.mobileFixed===true || AIM.mobileFixed===false, 'AIM.mobileFixed is a switch');
  ok(AIM.cone>0.05 && AIM.cone<0.45, 'AIM.cone is a narrow forward cone (0.05–0.45 rad)');
  ok(AIM.artyCone>=AIM.cone && AIM.artyCone<0.8, 'lobbed weapons get a slightly wider cone than direct fire');
  ok(AIM.lane>0.5 && AIM.lane<4, 'AIM.lane (near-target tolerance) is a hull-width-ish strip');
  ok(AIM.pivotOnly>0.1 && AIM.pivotOnly<0.6, 'a light stick push only pivots; a real push still drives');
  // lethality: the core kills, the ring wounds, and the numbers are ordered
  ok(LETHAL.core>0 && LETHAL.core<1, 'blast kill-core is a fraction of the radius');
  ok(LETHAL.reach>=1 && LETHAL.reach<2, 'blast wound ring reaches a little past the radius (1–2×)');
  ok(LETHAL.edgeMin>0 && LETHAL.edgeMin<1, 'wounds at the edge are partial, never zero inside the ring');
  { const k=(d,r)=>{ const c=r*LETHAL.core, R=r*LETHAL.reach; return d<=c?1:(d>=R?0:LETHAL.edgeMin+(1-LETHAL.edgeMin)*(1-(d-c)/(R-c))); };
    let mono=true, prev=2; for(let d=0; d<=6; d+=0.25){ const v=k(d,4); if(v>prev+1e-9) mono=false; prev=v; }
    ok(mono && k(0,4)===1 && k(4*LETHAL.reach,4)===0, 'blast lethality falls off monotonically: dead at the core, untouched past reach'); }
  // soldier look + squad AI
  ok(TROOPS.look.scale>=1.4 && TROOPS.look.scale<=2.4, 'soldiers are one readable size for both sides (1.4–2.4)');
  ok(TROOPS.look.barY > TROOPS.look.scale*1.5, 'soldier HP bar floats above the helmet');
  ok(SQUAD.think>0.1 && SQUAD.think<=1, 'soldiers re-plan several times a second');
  ok(SQUAD.huntR > TROOPS.fireteam.detect, 'idle soldiers advance on enemies beyond what they can already see');
  ok(SQUAD.cover.threat>8 && SQUAD.cover.search>4, 'soldiers react to armour at a sane distance and look for nearby cover');
  ok(SQUAD.guardHit>0 && SQUAD.guardHit<1, 'shooting a tower guard off is a chance, not a certainty');
  ok(SQUAD.lootDetect>5, 'soldiers notice loot a few metres away');
  ok(SQUAD.at.dmg>TROOPS.fireteam.dmg && SQUAD.at.aoe>0 && SQUAD.at.cd>TROOPS.fireteam.fireCd && SQUAD.at.range>0, 'AT launcher hits harder but reloads slower than a rifle');
  ok(SQUAD.armedMul>1 && SQUAD.armedMul<2, 're-armed rifles are better, not absurd');
  ok(INFANTRY.coverThreat>8 && INFANTRY.coverSearch>4, 'enemy riflemen also take cover from tanks');
  ok(INFANTRY.squad.maxMobile<=INFANTRY.squad.maxOnField && CAMP.infCap<=INFANTRY.squad.maxOnField+4, 'phones carry fewer soldiers; camps stop feeding near the field cap');
  // installations
  ok(RALLY.r>=3 && RALLY.offX>0 && RALLY.offX<0.6 && RALLY.offZ>0.3 && RALLY.offZ<0.9, 'rally point sits on our side, inside the arena');
  ok(perStage(POW.perStage), 'POW stockades defined for every stage');
  ok(range(POW.prisoners,1,8) && range(POW.guards,1,8) && range(POW.guardsMobile,1,POW.guards[1]), 'POW prisoners / guards in range; phones get no more guards than desktop');
  ok(POW.freeR>3 && POW.score>0 && POW.coin>0, 'freeing prisoners pays and has a reachable gate radius');
  ok(perStage(DEPOT.arms) && perStage(DEPOT.motor), 'weapon + tank depots defined for every stage');
  ok(range(DEPOT.guards,1,10) && range(DEPOT.guardsMobile,1,DEPOT.guards[1]) && range(DEPOT.tanks,1,4), 'depot guards / parked tanks in range');
  ok(DEPOT.capT>0.5 && DEPOT.capT<15 && DEPOT.r>=6, 'depot capture takes a few seconds inside a usable ring');
  ok(ALLY_TANK.hp>0 && ALLY_TANK.dmg>0 && ALLY_TANK.fireCd>0.3 && ALLY_TANK.range>ALLY_TANK.keep, 'captured tanks can fight and keep their stand-off inside gun range');
  ok(ALLY_TANK.leash>ALLY_TANK.keep && ALLY_TANK.cap>=1 && ALLY_TANK.cap<=6, 'captured tanks stay near you and are capped');
  ok(PARA.fromStage>=1 && PARA.fromWave>=1 && range(PARA.every,15,180) && range(PARA.everyMobile,15,240), 'paratroop drops are periodic, not constant');
  ok(PARA.everyMobile[0]>=PARA.every[0], 'phones see drops no more often than desktop');
  ok(range(PARA.troops,1,10) && range(PARA.troopsMobile,1,PARA.troops[1]), 'paratroop stick size in range; phones no bigger than desktop');
  ok(PARA.alt>8 && PARA.fall>1 && PARA.speed>4 && PARA.gap>0.1, 'drops are visible: high enough, slow enough to react');
  // Z105 ground relief, stances, specialists, deployment
  ok(RELIEF.R>=1 && RELIEF.R<=8 && RELIEF.bowlK>0 && RELIEF.crestK>0 && RELIEF.slopeK>0, 'relief shading has a sane neighbourhood and ranges');
  ok([RELIEF.bowlDark,RELIEF.bowlAO,RELIEF.crestLift,RELIEF.slopeEarth].every(v=>v>=0 && v<=1), 'relief strengths are 0–1 blends (never inverted or blown out)');
  ok(RELIEF.bowlTint.length===3 && RELIEF.earth.length===3 && RELIEF.bowlTint.every(v=>v>0 && v<=1), 'relief tints are rgb multipliers ≤ 1 (hollows only ever get darker)');
  ok(range(SQUAD.rush,0.2,4) && range(SQUAD.hold,0.5,10) && SQUAD.proneR>4, 'soldiers rush briefly, hold longer, go prone only at range');
  ok(SQUAD.proneHitR < SQUAD.standHitR && SQUAD.proneHitR>0, 'a man lying flat is a smaller target than one standing');
  ok(SQUAD.mg.burst>=3 && SQUAD.mg.gap<SQUAD.mg.pause && SQUAD.mg.range>TROOPS.fireteam.range, 'HMG fires bursts with pauses and outranges a rifle');
  ok(SQUAD.mortar.min<SQUAD.mortar.max && SQUAD.mortar.aoe>1 && SQUAD.mortar.flight>0.5 && SQUAD.mortar.cd>1, 'mortar: min < max band, real blast, flight time, reload');
  ok(SQUAD.sapper.plant>0.5 && SQUAD.sapper.fuse>0.5 && SQUAD.sapper.safe>3 && SQUAD.sapper.reach>10, 'sapper plants, gets clear, then it blows');
  ok(SQUAD.mix.length>=4 && SQUAD.mix.every(r=>['rifle','mg','mortar','sapper'].includes(r)) && SQUAD.mix.filter(r=>r==='rifle').length*2>=SQUAD.mix.length, 'reinforcement mix uses known roles and stays mostly riflemen');
  for(const k of ['mg','mortar','sapper']) ok(perStage(DEPLOY.roleMax[k]), `DEPLOY.roleMax.${k} defined for every stage`);
  ok(DEPLOY.holdR>10 && DEPLOY.stage>0.2 && DEPLOY.stage<0.95, 'posted men hold a real sector; staging points stop short of the enemy site');
  // Z106 irregular battlefield
  ok(FIELD.N>=90 && FIELD.harmonics>=2 && FIELD.amp>0 && FIELD.amp<0.3, 'field outline: enough bearings, gentle harmonics');
  ok(FIELD.minAny>0.4 && FIELD.minAny<FIELD.minTheirs && FIELD.minTheirs<FIELD.minOurs && FIELD.minOurs<=FIELD.max && FIELD.max<1, 'outline floors keep our side widest, the enemy objective side next, never past the square');
  ok(range(FIELD.bays,0,8) && range(FIELD.bayDepth,0,0.5) && range(FIELD.bayWidth,0.05,1), 'bays are bounded (depth < half the radius)');
  ok(FIELD.ridgeH>1 && FIELD.ridgeW>2, 'highland beyond the fence is visible (height, width)');
  ok(range(FIELD.innerRidges,0,10) && range(FIELD.innerRidgesMobile,0,FIELD.innerRidges[1]) && range(FIELD.ridgeLen,8,120) && range(FIELD.ridgeRock,0.5,5), 'inner ridges: count (phones ≤ desktop), length, rock size in range');
  ok(FIELD.minAny*0.5*(1+1) > 0.55*0.6, 'the field is always wide enough to hold the spawn line (minAny of the base edge)');
}

for (const id of Object.keys(GUN_PRICE)) {
  ok(typeof GUN_BLURB[id] === 'string' && GUN_BLURB[id].length > 0, `GUN_BLURB has copy for gun "${id}"`);
}

grp('Z107 BATTLE SETUP — campaign ladder, weather, space');
ok(CAMPAIGN.levels >= 10 && CAMPAIGN.perLoop === 5, 'campaign ladder: ≥10 levels, 5 stages per loop (matches the boss roster)');
ok(CAMPAIGN.weather.length >= CAMPAIGN.perLoop && CAMPAIGN.weather.every(w=>WEATHER[w]), 'every campaign level has a known weather');
ok(CAMPAIGN.weather[0]==='clear' && CAMPAIGN.weather[1]==='clear', 'the first two levels are fought in clear weather (learn first)');
ok(Object.values(WEATHER).every(w=>w.fogK>=1 && w.sunK>0 && w.sunK<=1 && w.range>0.75 && w.range<=1), 'weather only thickens haze / dims the sun / trims reach a little');
ok(WEATHER.clear.range===1 && WEATHER.clear.n[0]===0, 'clear weather changes nothing');
ok(Object.values(WEATHER).every(w=>w.n[1]<=w.n[0] && w.n[1]<=450), 'phones get fewer weather particles (≤450)');
ok(SPACE.wide.k===1 && SPACE.small.k>=0.65 && SPACE.small.k<SPACE.mid.k && SPACE.mid.k<1, 'space: narrow < medium < wide (= the full Z106 field)');
ok(SPACE.small.k*FIELD.minOurs*(130-6) > 130*0.55+3, 'even the narrow field keeps the player spawn inside the fence');

grp('Z107 FORTRESSES · SQUAD COMMANDS · CONTROLS SHEET');
ok(FORT.count.every(n=>n>=3 && n<=4) && FORT.countMobile.every(n=>n>=2 && n<=4), '3–4 fortresses a stage (phones ≥2)');
ok([1,2,3].every(t=>FORT.tiers[t] && FORT.tiers[t].gate>0 && FORT.tiers[t].inf[0]>=12), 'every tier has a gate to batter and a crowded garrison (≥12 men)');
ok(FORT.tiers[1].gate < FORT.tiers[2].gate && FORT.tiers[2].gate < FORT.tiers[3].gate, 'gates get tougher with the fortress tier');
ok(FORT.tiers[3].r[1] > FORT.tiers[1].r[1] && FORT.tiers[3].inf[1] > FORT.tiers[1].inf[1], 'the citadel is the biggest and the most crowded');
ok(FORT.gateW > 5 && FORT.gateW < 10 && FORT.wallH > 3, 'a gate a tank fits through; walls taller than a tank');
ok(FORT.liveInfMobile < FORT.liveInf && FORT.liveTanksMobile <= FORT.liveTanks, 'phones keep fewer garrison soldiers alive at once');
ok(FORT.names.length >= 8 && FORT.chiefs.length >= 6, 'enough fortress names and commanders to vary every stage');
ok(FORT.fromGate > 0.5 && FORT.fromGate < 1, 'most (not all) reinforcements march out of a fortress gate');
ok(COMMAND.para.cd >= 20 && COMMAND.para.troopsMobile[1] <= COMMAND.para.troops[1], 'paratroopers on a cooldown; phones get fewer');
ok(['t','x','b','h','g','e','q'].every(k=>KEYS_HELP.some(r=>r[0].some(x=>x.toLowerCase()===k))), 'the controls sheet lists every hotkey (T X B H G E Q)');
ok(TOUCH_HELP.length >= 6, 'the controls sheet explains the touch controls too');
ok(HEADING.idle < HEADING.moving && HEADING.dist > 2, 'the heading chevron sits ahead of the nose and brightens on the move');

ok(FORT.ram.gate*2 >= 1 && FORT.ram.wall*2 >= 1 && FORT.ram.fullV <= 15, 'Z111 two rams at 15+ break a gate or a wall section');
ok(FORT.wallHpK <= 1 && FORT.wallShotK === 1 && FORT.shotStructMin >= 1, 'Z111 wall sections no tougher than the gate; shells hit them in full, no gun weak vs fortresses');
ok(FORT.tiers[1].gate/(GUNS.rifle.dmg*Math.max(FORT.shotStructMin, DMG_TYPE[GUNS.rifle.type].struct)) <= 50, 'Z111 the starter rifle opens a tier-1 gate in under ~50 shots');
ok(RIDER.cap >= 12 && RIDER.base + 3*RIDER.perUp <= RIDER.cap, 'Z111b 12 seats on the tank; base + 3 crew upgrades fit');
ok(INFANTRY.vsArmour > 0 && INFANTRY.vsArmour <= 0.35, 'Z111b rifle rounds barely scratch a tank');
ok(FORT.posture.holdK > 0 && FORT.gate.exitMax > 0 && LOOT.siege.mul > 1, 'Z111b fortress posture / gate / siege-rounds tuning present');
ok(HARD.boulder/(60*DMG_TYPE.AP.struct) > 2 && HARD.boulder/(60*DMG_TYPE.AP.struct) <= 3 && 95*DMG_TYPE.AP.struct >= HARD.oneShot, 'Z112 a boulder takes 3 cannon shells, one railgun slug');
ok(TANK_DEATH.blast[1] < TANK_DEATH.spark[0] && TANK_DEATH.wreck[1] <= 3, 'Z112 heavy shells blow a tank at once; wrecks clear fast');
ok(GUN_MODS.max===5 && (1+GUN_MODS.max*GUN_MODS.barrel.dmg) <= 1.35 && (1-GUN_MODS.max*GUN_MODS.action.fire) >= 0.7 && GUN_MODS.mag.mag*GUN_MODS.max <= 0.6, 'Z115 gun parts cap at +30% dmg, −25% fire gap, +60% magazine');
ok(HIJACK.hp>0 && HIJACK.hp<0.5 && HIJACK.window>=10 && HIJACK.types.includes('launcher') && ENEMY_DEFS.launcher && ENEMY_DEFS.launcher.truck, 'Z116 abandoned vehicles can be hijacked; the rocket truck exists');
ok(HARD.hits===3 && HARD.lightHits>HARD.hits && GORE.speed[1]>GORE.speed[0] && DRIVE.screenReverse===true && DRIVE.reverseKeep<DRIVE.reverseAngle, 'Z121 rocks break in 3 shots; gore tuning present; tank reverses straight');
ok(FORT.ram.minV > 4 && FORT.ram.fullV > FORT.ram.minV && FORT.ram.fullV < 26, 'a ram needs a run-up but full effect comes below top speed');
ok(TERRAIN_FLAT.noiseK === 0 && TERRAIN_FLAT.blastK === 0, 'the battlefield stays flat and stable (no micro-bumps, shells do not reshape it)');

grp('Z107 POWER RATING · RAM ANYTHING');
ok(POWER.bands.every((b,i,a)=>i===0||b[0]<a[i-1][0]) && POWER.bands[POWER.bands.length-1][0]===0, 'power verdict bands run from easy to overwhelming and cover every ratio');
ok(POWER.calib>=1 && POWER.calib<1.6, 'threat calibration only steepens harder levels (measured ~1.18)');
ok(POWER.waves.every(w=>w>=1 && w<=5) && POWER.hitHalfW>0 && POWER.engaged>0 && POWER.engaged<=1, 'power model samples real waves and a sane hit / engagement model');
ok(Math.abs(Object.values(POWER.mix0).reduce((s,v)=>s+v,0)-1)<1e-9, 'the neutral armour mix sums to 1');
ok(['sandbag','drums','crates','tires'].every(k=>COVER_HP[k] <= RAM.weakHp), 'flimsy cover (sandbags, drums, crates, tyres) breaks in ONE solid ram');
ok(RAM.frac*3 >= 1 && RAM.frac*2 < 1, 'sturdy structures take about three full rams (not one, not ten)');
ok(RAM.steelHp*RAM.frac*3 >= RAM.steelHp*0.99, 'steel / concrete cover gives way after ~3 rams');
ok(RAM.minV < RAM.fullV && RAM.fullV < 26, 'a ram needs speed, and full effect comes below top speed');

// Z123 generic HID pad (Flydigi Direwolf 4 over USB on a Mac): the layout wizard learns raw buttons/axes/hat and reads them as a standard pad
{ const fs=await import('node:fs'); const pm=fs.readFileSync('src/input/padmap.js','utf8'), gpd=fs.readFileSync('src/input/gamepad.js','utf8');
  ok(/export function virtualPad/.test(pm) && /export function wizPoll/.test(pm), 'padmap: learned pads are read through virtualPad, learned by wizPoll');
  ok(/padMapFor\(gp\)/.test(gpd) && /PAD\.seen\s*=/.test(gpd), 'gamepad: polls through the learned map and records what the browser sees (PAD.seen)');
  ok(/openPadWizard\(gp\); PAD\.prev=cur; return;/.test(gpd), 'the waking press never also clicks the wizard it opens');
  ok(/tgt>=12 \? 0\.4/.test(pm), 'hat D-pad levels (← is only 0.57 from rest) are detected');
  ok(fs.readFileSync('index.html','utf8').includes('id="padWiz"'), 'the wizard overlay exists'); }

// Z124 analogue pad control: stick tilt = top speed, eased hull / gun swing, sensitivity setting, camera combo, button legend
{ const fs=await import('node:fs'); const up=fs.readFileSync('src/game/update.js','utf8'), gpd=fs.readFileSync('src/input/gamepad.js','utf8'), cfg=fs.readFileSync('config.js','utf8');
  ok(/PAD_CFG\.hull\.speedFull/.test(up) && /top = \(thr<0/.test(up), 'stick tilt scales the top speed (not just the acceleration)');
  ok(/p\.yawV/.test(up) && /TURRET\.rate\*tk/.test(up), 'pad: hull turn and gun swing are eased and rate-capped (Z145 player-set traverse)');
  ok(/minMag/.test(gpd) && /CAMC/.test(gpd) && /padHud/.test(gpd), 'pad: dead-tilt holds the gun, View+D-pad = camera, button legend');
  ok(/sens:1/.test(cfg) && fs.readFileSync('index.html','utf8').includes('id="setSens"') && fs.readFileSync('index.html','utf8').includes('id="padHud"'), 'sensitivity setting + legend exist'); }

// Z125 firing no longer rumbles; controller diagram in the key sheet, settings and wizard
{ const fs=await import('node:fs'); const fl=fs.readFileSync('src/combat/flame.js','utf8'), gpd=fs.readFileSync('src/input/gamepad.js','utf8'), cfg=fs.readFileSync('config.js','utf8'), idx=fs.readFileSync('index.html','utf8');
  ok(!/padShot|GUN_FEEL/.test(fl+gpd+cfg), 'no per-shot rumble code left (padShot / GUN_FEEL removed)');
  ok(!/haptic\(6\+rec/.test(fl), 'the recoil of a shot no longer vibrates the pad or the phone');
  const pv=fs.readFileSync('src/ui/padview.js','utf8'), keys=fs.readFileSync('src/ui/keys.js','utf8'), st=fs.readFileSync('src/ui/settings.js','utf8'), pm=fs.readFileSync('src/input/padmap.js','utf8');
  ok(/export function padDiagram/.test(pv) && /data-b/.test(pv) && /WIZ\.tgt/.test(pv), 'padview: diagram with per-button hooks, live + wizard target');
  ok(/padDiagram\(\)/.test(keys) && /padDiagram\(\)/.test(st) && /padDiagram\(true\)/.test(pm), 'diagram is used by the key sheet, the settings and the wizard');
  ok(idx.includes('id="setPadView"') && idx.includes('id="padWizView"'), 'diagram containers exist'); }

// Z126 pad menus: the focus ring survives a menu redraw and is easy to see
{ const fs=await import('node:fs'); const b=fs.readFileSync('src/input/bindings.js','utf8'), css=fs.readFileSync('css/menus.css','utf8'), gpd=fs.readFileSync('src/input/gamepad.js','utf8');
  ok(/restoreFocus/.test(b) && /NAV\.sig/.test(b), 'menu focus is restored to the same spot after a redraw (no jump to the bottom button)');
  ok(/@keyframes padfocus/.test(css) && /scrollPane\(root\)/.test(gpd), 'focus ring pulses; right stick scrolls the list that holds the focus'); }

// Z127 pad: A only picks — start buttons are on ☰, the ring starts on the choices, deploy steppers answer ←/→
{ const fs=await import('node:fs'); const b=fs.readFileSync('src/input/bindings.js','utf8'), g=fs.readFileSync('src/input/gamepad.js','utf8');
  ok(/PAD_FIRST/.test(b) && /PAD_GO/.test(b) && /PAD_GO\[root\.id\]/.test(g), 'pad: ring starts on the choices, ☰ starts the battle / deploy');
  ok(/dp-step'\)\)\{ const b=NAV\.focus/.test(b) && /b\[b\.length-1\]\.click/.test(b), 'pad: a deploy stepper row answers ←/→ (−1/+1) and A (+1)'); }

// Z128 high-angle guns, R3 auto-aim, back paddles, nothing fires behind a menu
{ const fs=await import('node:fs'); const g=fs.readFileSync('src/input/gamepad.js','utf8'), cfg=fs.readFileSync('config.js','utf8'), b=fs.readFileSync('src/input/bindings.js','utf8'), css=fs.readFileSync('css/menus.css','utf8');
  ok(/function lobAim/.test(g) && /PAD_CFG\.lob/.test(g) && /lob:\{/.test(cfg), 'pad: mortar / rocket range on the right stick (↑↓), 180° front arc (←→)');
  ok(/'autoAim'[^\]]*\],?[^\]]*11,0\]|\['autoAim'.*?,11,0\]/.test(cfg) && /case 'autoAim'/.test(b), 'R3 toggles auto-aim');
  ok(/\['zoomPing'.*?,14,0\]/.test(cfg) && /\['camTurn'.*?,15,0\]/.test(cfg) && /PADDLE/.test(g) && /function dbl\(/.test(b), 'back paddles M1 / M2 = zoom ping-pong / rotate, double tap = reset');
  ok(/fireHeld/.test(g) && /padplay/.test(g) && /body\.pad\.padplay/.test(css), 'a held trigger cannot keep shooting behind a menu; legends only show in a live battle'); }

// Z129 default gun
{ const fs=await import('node:fs'); const fl=fs.readFileSync('src/combat/flame.js','utf8'), fw=fs.readFileSync('src/game/flow.js','utf8'), g=fs.readFileSync('src/input/gamepad.js','utf8');
  ok(!/p\.guns\.push\(\{id, ammo:magCap\(g\), rU:0, rD:0\}\); p\.gunIdx=/.test(fl), 'a gift gun does not take over the hands');
  ok(/defaultGunIdx\(\)/.test(fw) && /selectDefaultGun/.test(fl) && /'gunDefault'/.test(g), 'start with the default gun; LB+RB jumps back to it'); }

// Z133 early core warning
{ const fs=await import('node:fs'); const a=fs.readFileSync('src/ui/alarm.js','utf8'), h=fs.readFileSync('index.html','utf8');
  ok(/coreatk/.test(a) && /coredanger/.test(a) && /coreArrow/.test(a) && h.includes('id="coreArrow"') && h.includes('id="corewarnT"'), 'the core warns on the first hit (banner, siren, arrow) — not only under 35%'); }

// Z134 the squad razes the boss shield pylons
{ const fs=await import('node:fs'); const f=fs.readFileSync('src/actors/fireteam.js','utf8');
  ok(/boss\.shielded/.test(f) && /PYLONS/.test(f) && /kind:at\?'tank':'pylon'/.test(f), 'soldiers / AT target the pylons while the boss is shielded');
  ok(/kind==='pylon'/.test(f) && /\*0\.6/.test(f), 'sappers charge pylons (60% of their health per charge); mortars shell them'); }

// Z135 smarter allied tanks
{ const fs=await import('node:fs'); const f=fs.readFileSync('src/actors/ally-tanks.js','utf8');
  ok(/function clearShot/.test(f) && /jinkUntil/.test(f) && /isPylon/.test(f) && /shotOk/.test(f), 'ally tanks: cover-aware targets, jink when hit, pylons, no shooting into walls'); }

// Z136 countdown
{ const fs=await import('node:fs'); const b=fs.readFileSync('src/ui/briefing.js','utf8'), l=fs.readFileSync('src/game/loop.js','utf8'), v=fs.readFileSync('src/game/viewport.js','utf8');
  ok(/S\.mode='countdown'/.test(b) && /function goLive/.test(b) && /updateCountdown/.test(l) && /countdown:1/.test(v) && fs.readFileSync('index.html','utf8').includes('id="countdown"'), '3-2-1 countdown freezes the world before the battle goes live'); }

// Z137 night visibility
{ const fs=await import('node:fs'); const n=fs.readFileSync('src/render/night-marks.js','utf8'), a=fs.readFileSync('src/world/atmosphere.js','utf8');
  ok(/updateNightMarks/.test(n) && /ALLY_TANKS/.test(n) && fs.readFileSync('src/game/loop.js','utf8').includes('updateNightMarks'), 'night: enemy / ally tanks wear lamps (pooled sprites)');
  ok(/o\.exp=1\.45; o\.night=1/.test(a) && /ambient\.intensity=0\.36/.test(a), 'night is brighter than before (exposure, moon, ambient)'); }

// Z138 nothing after GO, 5 lives
{ const fs=await import('node:fs'); const b=fs.readFileSync('src/ui/briefing.js','utf8'), u=fs.readFileSync('src/loot/upgrades.js','utf8'), f=fs.readFileSync('src/game/flow.js','utf8');
  ok(/cdSub/.test(b) && /if\(quiet\) return;/.test(u) && /p\.lives=5/.test(f), 'mission line rides the countdown; no card after GO; 5 starting lives'); }

// Z139 three new battlefields
{ const fs=await import('node:fs'); const w=fs.readFileSync('src/data/world.js','utf8'), l=fs.readFileSync('src/world/landmarks.js','utf8'), h=fs.readFileSync('src/world/heightfield.js','utf8'), b=fs.readFileSync('src/input/bindings.js','utf8'), t=fs.readFileSync('src/data/text-vi.js','utf8');
  for(const n of ['CITY','HILLS','VILLAGE']) ok(new RegExp("name:'"+n+"'").test(w) && new RegExp(n+":\\{").test(w) && new RegExp(n+":'").test(t), 'biome '+n+' is fully defined (data, atmosphere, ground, name)');
  ok(/buildCity/.test(l) && /buildHills/.test(l) && /buildVillage/.test(l) && /carveRivers/.test(h) && /wetAt/.test(h), 'landmarks + river carving exist');
  ok(/_mbBusy/.test(b), 'menuBack cannot recurse'); }

// Z140 regional strongholds, guard cannons, tour, events, flag fall, celebration
{ const fs=await import('node:fs'); const r=fs.readFileSync('src/world/regional.js','utf8'), cw=fs.readFileSync('src/world/core-walls.js','utf8'), fo=fs.readFileSync('src/world/fortress.js','utf8'), it=fs.readFileSync('src/game/intro.js','utf8'), ev=fs.readFileSync('src/world/env-events.js','utf8'), ce=fs.readFileSync('src/fx/celebrate.js','utf8'), lo=fs.readFileSync('src/combat/lock-on.js','utf8');
  ok(/export function fortStyle/.test(r) && /REGION_ALT/.test(r) && /laterite/.test(r) && /bamboo/.test(r), 'every biome has regional fort styles, several per map');
  ok(/buildCoreWalls/.test(cw) && /updateCoreGuns/.test(cw) && /ours:true/.test(cw) && /bl\.ours && b\.owner==='p'/.test(lo), 'our walled core with guard cannons; our walls never stop our fire');
  ok(/fortStyle\(BIOME\.name, fi\+\+\)/.test(fo) && /leaderless/.test(fo) && /animFlag/.test(fo), 'forts: own architecture each, commander down = no reinforcements, flag topples');
  ok(/function buildTour/.test(it) && /flood\(|function flood/.test(ev) && /rockslide/.test(ev) && /collapse/.test(ev) && /export function celebrate/.test(ce), 'battlefield tour, land events and victory celebration exist'); }

// Z141 realistic water + flora
{ const fs=await import('node:fs'); const h=fs.readFileSync('src/world/heightfield.js','utf8'), f=fs.readFileSync('src/world/flora.js','utf8'), d=fs.readFileSync('src/world/decor.js','utf8');
  ok(/depthTex/.test(h) && /foam/.test(h) && /WTIME/.test(h), 'water is depth-tinted with foam and moving ripples');
  ok(/export function buildFlora/.test(f) && /bamboo/.test(f) && /palm/.test(f) && /reeds/.test(f) && /sway/.test(f) && /c\.kind==='tree'/.test(d), 'flora per biome, swaying, trees topple under tanks'); }

// Z142 city district
{ const fs=await import('node:fs'); const c=fs.readFileSync('src/world/city.js','utf8');
  ok(/tubeHouse/.test(c) && /apartment/.test(c) && /officeTower/.test(c) && /villaHouse/.test(c) && /motoGeo/.test(c) && /zebra/.test(c) && /LineSegments/.test(c), 'city: street grid, varied buildings, cars, motorbikes, crossings, power lines'); }

// Z143 savanna, arctic, wildlife
{ const fs=await import('node:fs'); const w=fs.readFileSync('src/data/world.js','utf8'), f=fs.readFileSync('src/world/flora.js','utf8'), a=fs.readFileSync('src/actors/wildlife.js','utf8');
  ok(/name:'SAVANNA'/.test(w) && /name:'ARCTIC'/.test(w) && /baobab/.test(f) && /acacia/.test(f) && /reedPlume/.test(f) && /iceSpire/.test(f), 'savanna and arctic biomes with their own plants');
  ok(/export function updateWildlife/.test(a) && /giraffe/.test(a) && /elephant/.test(a) && /reindeer/.test(a) && /flee/.test(a), 'wildlife herds graze and flee'); }

// Z144 landmarks, country styles, weather reset, roomier field
{ const fs=await import('node:fs'); const w=fs.readFileSync('src/world/wonders.js','utf8'), r=fs.readFileSync('src/world/regional.js','utf8'), wx=fs.readFileSync('src/fx/weather.js','utf8'), cc=fs.readFileSync('src/core/config.js','utf8');
  ok(/GIZA/.test(w) && /DJENNÉ/.test(w) && /VẠN LÝ/.test(w) && /MỘT CỘT/.test(w) && /export function buildWonder/.test(w), 'world landmarks per battlefield');
  ok(/'swallow'/.test(r) && /'tent'/.test(r) && /'pagoda'/.test(r) && /'chhatri'/.test(r) && /'toron'/.test(r), 'country-inspired fort caps and roofs');
  ok(/WX\.base/.test(wx) && /applyWeather\(id, k\)/.test(wx), 'weather starts from the base atmosphere each time (no stacking)');
  ok(/ARENA = _TOUCH \? 130 : 184/.test(cc), 'desktop battlefield has twice the area'); }

// Z145 real surfaces, cinematic sky, irregular forts, capital keep, escalade, turret traverse, fictional flag
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const su=R('src/render/surface.js'), cl=R('src/render/clouds.js'), at=R('src/world/atmosphere.js'), fo=R('src/world/fortress.js'), es=R('src/actors/escalade.js'), rd=R('src/render/renderer.js'), up=R('src/game/update.js'), hf=R('src/world/heightfield.js'), ip=R('src/input/input.js');
  ok(/export function detailize/.test(su) && /export function hiResMaps/.test(su) && /normalMap:M\.normalMap/.test(R('src/world/regional.js')), 'walls: hi-res colour + normal + roughness maps and a world-space detail layer');
  ok(/GTAOPass/.test(rd) && /sharp/.test(rd) && /AO\.on && \(?PERF\.slowT/.test(R('src/game/loop.js')), 'ambient occlusion (shed first when slow) + sharpening');
  ok(/cloudShade/.test(cl) && /MOODS/.test(at) && /storm/.test(at) && /cTex/.test(at), 'cloud deck in the sky, drifting cloud shadows, per-battle sky moods');
  ok(/f\.Rin/.test(fo) && /Math\.random\(\)-0\.5\)\*0\.5\)\/sides/.test(fo) && /GH=H\+\(CAP\?12:8\.5\)/.test(fo) && /portcullis/.test(fo), 'irregular fort outlines, tall towers, fierce gatehouse');
  ok(/f\.keepR/.test(fo) && /kind:'keep'/.test(fo), 'the capital raises a solid donjon with the flag on its roof');
  ok(/export function tryClimb/.test(es) && /isClimber/.test(R('src/actors/command.js')) && /updateClimb/.test(R('src/actors/fireteam.js')), 'assault troops carry ladders and scale an unbreached wall');
  ok(/TURRET\.rate\*tk/.test(up) && /id="setTurret"/.test(R('index.html')), 'turret traverse speed is moderate and player-adjustable');
  ok(!/#da251d/.test(hf) && /LIÊN QUÂN THÉP/.test(hf), 'our flag is a fictional banner (no real national flag)');
  ok(/ZOOM_LEVELS=\[1\.0, 1\.5, 2\.0, 2\.6, 3\.3\]/.test(ip) && /fitShadow/.test(rd), 'one more zoom-out level, shadows widen with it'); }

// Z146 volumetric searchlights, leaf-card trees
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const sl=R('src/fx/searchlight.js'), tw=R('src/world/towers.js'), fl=R('src/world/flora.js'), rd=R('src/render/renderer.js'), hub=R('src/hub.js');
  ok(/export function beamMat/.test(sl) && /pow\(edge/.test(sl) && /uFloor/.test(sl) && /makeSearchlight\(sl, bg/.test(tw) && /beamMat\(0xfff0d0/.test(rd), 'searchlights: soft volumetric shaft with dust, fades into the ground (towers + masts)');
  ok(/updateSearchSpot/.test(tw) && /SpotLight/.test(sl) && /sp\.visible=NIGHT\.on;/.test(sl), 'one real spotlight rides the nearest beam (visibility fixed per night: no recompiles)');
  ok(hub.indexOf("fx/searchlight.js") < hub.indexOf("world/biome.js"), 'searchlight module loads before the boot-time floodlights');
  ok(/leafAtlas/.test(fl) && /alphaTest:0\.42/.test(fl) && /normalize\( vNormal \) : normal/.test(fl) && /_LA\.set\(/.test(fl), 'trees: alpha-tested leaf cards with outward crown normals');
  ok(/nanPass/.test(rd) && /isnan/.test(rd) && rd.indexOf('composer.addPass(nanPass)') < rd.indexOf('composer.addPass(bloom)'), 'a NaN pixel is cleaned before bloom can smear it into a black block');
  ok(/'MEADOW'\|\|/.test(fs.readFileSync('src/world/ground.js','utf8')) && /0x6e5a3c/.test(fs.readFileSync('src/world/biome.js','utf8')), 'grass reads clear of the olive tanks (sunlit pasture, brown mud grime)'); }

// Z148 real tower roofs
{ const fs=await import('node:fs'); const r=fs.readFileSync('src/world/regional.js','utf8'), fl=fs.readFileSync('src/world/flora.js','utf8');
  ok(/function hipRoof/.test(r) && /function lathe/.test(r) && /function ridgeOrn/.test(r) && /idx\.push\(a,c,b, b,c,d\)/.test(r), 'hipped roofs with sweep, curled corners, fascia + soffit (outward winding)');
  ok(/st\.roof==='tile'\)\{ const h=s\*0\.55, g=hipRoof/.test(r) && /roof==='onion'\)\{[^\n]*CylinderGeometry/.test(r) && /roof==='tent'\)\{[^\n]*CylinderGeometry\(s\*0\.5,s\*0\.52,s\*0\.55,8\)/.test(r), 'gate, onion and tent roofs are built from real profiles');
  ok(/card\(r\*1\.15, 0\.9, 2, 0, y-1\.6/.test(fl), 'spruce sprays lean their normals up to the sky (no black trees)'); }

// Z149 gun ladder: a higher BẬC always out-fights a lower one; extra barrels never mean extra damage
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const GM=await import('./src/data/guns.js'), G=GM.GUNS;
  const sus=id=>{ const g=G[id]; return GM.gunShotDmg(g)*g.mag/(g.mag*g.fireCd+g.reload); };
  const direct=['rifle','smg','shotgun','flak','cannon','hesh','minigun','missile','tesla','thermo'], T=t=>direct.filter(id=>G[id].tier===t).map(sus);
  ok(Math.max(...T(1)) < Math.min(...T(2)), 'every tier-2 direct-fire gun out-damages the best tier-1 gun (the SMG no longer beats tier 2)');
  ok(Math.max(...T(2)) <= Math.min(...T(3)), 'every tier-3 direct-fire gun matches or beats the best tier-2 gun');
  ok(sus('arty') > sus('mortar') && sus('railgun') > sus('cannon'), 'heavy versions beat their lighter cousins (howitzer > mortar, railgun > cannon)');
  const coin=t=>Object.keys(G).filter(id=>G[id].tier===t && GUN_PRICE[id] && GUN_PRICE[id].c).map(id=>GUN_PRICE[id].c);
  ok(Math.max(...coin(1)) < Math.min(...coin(2)) && Math.max(...coin(2)) < Math.min(...coin(3)), 'shop prices climb with the tier');
  ok(GM.gunSplash(G.flak) < 0.5 && /dmg\*gunSplash\(g\)/.test(R('src/combat/flame.js')), 'flak airbursts no longer stack five full blasts on one target');
  ok(/p\.muzzles\[\(p\.mzI=/.test(R('src/combat/flame.js')) && /userData\.muzzles=MZ/.test(R('src/tank/barrels.js')), 'twin / multi-tube guns fire from each real tube in turn');
  ok(/e\.burn\.k/.test(R('src/ai/tactics.js')) && /gunShotDmg\(g\)\*dM/.test(R('src/combat/power.js')), 'flame burn scales with damage upgrades; the power rating counts splash');
  const fx=R('src/fx/gunfx.js'); ok(/export function lightning/.test(fx) && /export function railBeam/.test(fx) && /function smokeRing/.test(fx) && /kind==='launch'/.test(fx) && /updateBolts\(dt\)/.test(R('src/game/loop.js')), 'per-class muzzle fx: smoke rings, backblast, rail beam, forked lightning'); }

// Z150 one picture per gun everywhere, stronger controller focus, smooth battle start, Vietnamese text
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const ga=R('src/ui/gunart.js'), G=(await import('./src/data/guns.js')).GUNS;
  ok(/export function gunPicHTML/.test(ga) && /readRenderTargetPixels/.test(ga) && /RoomEnvironment/.test(ga), 'gun art: a studio render of each real barrel model, cached, painted into every <img data-gunpic>');
  ok(/gunPicHTML\(id,'gp-ld'\)/.test(R('src/ui/loadout.js')) && /gunPicHTML\(it\.id,'gp-case'\)/.test(R('src/ui/shop.js')) && /gunPicEl\(inst\.id, 'wc-ic'\)/.test(R('src/ui/briefing.js')) && /gunPicHTML\(inst\.id,'gp-dp'\)/.test(R('src/ui/deploy.js')) && /gunPicEl\(gid,'gp-loot'\)/.test(R('src/loot/powerups.js')), 'arsenal, shop, HUD, deploy list and the new-gun card all show the same gun photo');
  ok(new Set(Object.values(G).map(g=>g.svg)).size === Object.keys(G).length, 'every gun has its own line icon (no two guns share one)');
  ok(Object.values(G).every(g=>!/^(RIFLE|SMG|SHOTGUN|CANNON|MISSILE|RAILGUN|MINIGUN|SIEGE ROCKET|HOWITZER)$/.test(g.name)), 'gun names are Vietnamese');
  ok(/\.seg-chip\.padfocus/.test(R('css/menus.css')) && /outline:5px/.test(R('css/menus.css')), 'controller focus: thicker ring, small options turn solid amber');
  ok(/const calib = S\.mode==='countdown'/.test(R('src/game/loop.js')) && /PROFILE\.perfDpr/.test(R('src/audio/engine-music.js')) && /SHADOW_MAP = 2048/.test(R('src/core/config.js')), 'battle start: resolution settles in the countdown and is remembered (no resize hitches in the first seconds)');
  ok(!/IRON BULL|OVERLORD/.test(R('src/data/bosses.js')) && !/NIGHT — reach/.test(R('src/combat/guns.js')), 'boss names and battle conditions in Vietnamese'); }

// Z151 ear-safe, punchier sound: measured levels, limiter, duck bus, effects level
{ const fs=await import('node:fs'); const sy=fs.readFileSync('src/audio/synth.js','utf8');
  const g=k=>+(new RegExp('\\n  '+k+':\\s*\\{[^\\n]*g:([0-9.]+)').exec(sy)||[])[1];
  ok(/limiter\.ratio\.value=20/.test(sy) && /type='highshelf'/.test(sy), 'master: high-shelf softening + brick-wall limiter (no clipping, no fizz)');
  ok(g('clang') < g('bigboom')*0.5 && g('launch') < 0.5 && g('hitM') < 0.3, 'the collision clang, rocket launch and armour hits no longer outshout the explosions');
  ok(/D\.big \? master : \(duck\|\|master\)/.test(sy) && /duck\.gain\.setTargetAtTime\(0\.5/.test(sy), 'big blasts duck the small-arms bus so they punch through');
  ok(/SFX_LEVELS=\{ low:0\.32, mid:0\.5, high:0\.68 \}/.test(sy) && /\['low','NHỎ'\],\['mid','VỪA'\],\['high','LỚN'\]/.test(fs.readFileSync('src/ui/settings.js','utf8')), 'settings: effects level TẮT / NHỎ / VỪA / LỚN'); }

// Z152 one-press battle entry + one design language for the dialogs
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8');
  ok(/tapBtn\('playBtn', \(\)=>\{ hide\('start'\); launchGame\(\{ mode:'campaign', level:campaignMax\(\) \}\)/.test(R('src/game/flow.js')), 'PLAY goes straight into the next campaign level');
  ok(/intro\.quick = !!\(PROFILE\.introSeen/.test(R('src/game/intro.js')) && /if\(intro\.quick\) endIntro\(\)/.test(R('src/game/intro.js')), 'the battlefield tour plays once per map, then the warm-up leads straight to the briefing');
  ok(/export function launchStage/.test(R('src/ui/briefing.js')) && /if\(quick\)\{ confirmDeploy\(\); return; \}/.test(R('src/ui/deploy.js')) && /id="brGo"/.test(R('index.html')), 'briefing: a contract is pre-chosen, XUẤT KÍCH posts the troops by plan without another screen');
  ok(/css\/ui152\.css/.test(R('index.html')) && /\.brcard\.on::after/.test(R('css/ui152.css')) && /--card-sh-hover/.test(R('css/ui152.css')), 'shared card surface, hover lift, chosen state'); }

// Z153 recorded-quality sound set (ElevenLabs), levelled to the Z151 mix
{ const fs=await import('node:fs'); const sy=fs.readFileSync('src/audio/synth.js','utf8'), SS=(await import('./src/audio/synth.js').catch(()=>null));
  const files=fs.readdirSync('assets/sfx').filter(f=>f.endsWith('.mp3'));
  ok(files.length>=25 && files.every(f=>fs.statSync('assets/sfx/'+f).size>1500), 'assets/sfx holds the generated set (every file is real audio)');
  ok(/export function loadSamples/.test(sy) && /SAMPLE_LU\[k\]\?\?-24\)-L\)\/20\)\/g/.test(sy) && /sampleGet\(k\) \|\| \(D\.sampleOnly \? null : bankGet\(k\)\)/.test(sy), 'samples are loudness-matched to the measured mix, synth plays until they load');
  const set=sy.match(/SAMPLE_SET = \{([\s\S]*?)\};/)[1]; const names=[...set.matchAll(/'([a-zA-Z_0-9]+)'/g)].map(m=>m[1]);
  ok(names.every(n=>files.includes(n+'.mp3')), 'every sample the code asks for exists on disk');
  ok(!files.some(f=>/key|secret/i.test(f)) && !/sk_[0-9a-f]{20,}/.test(sy), 'no API key in the shipped code'); }

// Z154 relic: wake it under fire, pick one big power for the stage
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const rl=R('src/loot/relic.js');
  ok(/export function spawnRelic/.test(rl) && /function challenge/.test(rl) && /RELIC\.prog>=1\) awaken\(\)/.test(rl), 'relic: hold the ring to wake it; waking calls a strike team');
  const ids=[...rl.matchAll(/\{ id:'(\w+)'/g)].map(m=>m[1]); ok(['life','dmg','speed','range','mag'].every(k=>ids.includes(k)), 'relic powers include +1 life, ×2 damage, hard acceleration, ×2 range, ×2 magazine');
  ok(/spawnRelic\(\)/.test(R('src/ui/briefing.js')) && /clearRelic\(\)/.test(R('src/loot/upgrades.js')) && /clearRelic\(\)/.test(R('src/game/flow.js')) && /updateRelic\(gdt, now\)/.test(R('src/game/loop.js')), 'one relic per stage; its power ends with the stage / run');
  ok(/id="relicDlg"/.test(R('index.html')) && /#relicCards > \*/.test(R('src/input/bindings.js')) && /RELIC\.live/.test(R('src/ui/radar.js')), 'pick dialog (pad-navigable) + radar marker'); }

// Z155 tank collection: real MBTs + our designs, a garage, models on enemies
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const md=R('src/tank/models.js');
  const real=['T-90M PRORYV','LEOPARD 2A7V','M1A2 SEPv3 ABRAMS','K2 BLACK PANTHER','LECLERC','CHALLENGER 3','MERKAVA MK.4M','TYPE 99A','T-14 ARMATA'];
  ok(real.every(n=>md.includes("name:'"+n+"'")), 'nine real main battle tanks, named after the vehicles');
  ok(/real:false/.test(md) && /BÓNG MA S-7/.test(md) && /KHỔNG TƯỢNG K-8/.test(md), 'our own designs (stealth light tank, super-heavy) alongside');
  ok(/stats:\{ hp:[\d.]+, spd:[\d.]+, acc:[\d.]+, turn:[\d.]+, size:[\d.]+ \}/.test(md) && /p\.turnMul=TS\.turn/.test(R('src/game/flow.js')) && /\(p\.turnMul\|\|1\)/.test(R('src/game/update.js')), 'each model changes armour, speed, acceleration, turning and size in battle');
  ok(/turretGeo\(SP\.turret\)/.test(R('src/tank/model.js')) && /MD\.dress\(/.test(R('src/tank/model.js')) && /camoTex\(/.test(R('src/tank/model.js')), 'builder: per-model turret silhouette, dress kit and camouflage');
  ok(/model:ENEMY_MODEL\[type\]/.test(R('src/actors/enemies.js')) && /id="garage"/.test(R('index.html')) && /export function openGarage/.test(R('src/ui/garage.js')), 'enemies wear real silhouettes; garage to buy / pick your tank'); }

// Z157 every model its own vehicle: hull, running gear, lofted turret, gun mount
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const ds=R('src/tank/designs.js'); const M=await import('./src/tank/designs.js').catch(()=>null);
  const ids=['abrams','leo2a7','t90m','leclerc','ch3','merkava','type99','k2','t14','ghost','colossus'];
  ok(ids.every(id=>new RegExp('\\n  '+id+':\\s*\\{ W:').test(ds)) && ids.every(id=>new RegExp('\\n  '+id+'\\(K\\)\\{').test(ds)), 'eleven models each have their own design + their own kit');
  ok(/export function loft\(/.test(ds) && /function beltGeo\(/.test(ds) && /circleHull/.test(ds), 'lofted sloped turrets; track belts wrapped round each model\'s own wheels');
  ok(/spr:\{ z:2\.05/.test(ds) && /mantlet==='slot'/.test(ds) && /mantlet==='round'/.test(ds) && /mantlet==='exposed'/.test(ds), 'different gun mounts (slot / box / cast / wedge / exposed) and the Merkava\'s front sprocket');
  ok(/hasDesign\(opts\.model\)/.test(R('src/tank/model.js')) && /rig\.elev0/.test(R('src/tank/rig.js')) && /ud\.mountY/.test(R('src/tank/barrels.js')), 'builder routes models to their design; weapon barrels follow each mount'); }

// Z158 enemy classes: real role vehicles + combat traits per class
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const E=await import('./src/data/enemies.js');
  ok(['grunt','scout','gunner','mortar','shield','bomber','heavy','chief','sniper','pyro','atgm','engineer','carrier','launcher','gunship'].every(k=>E.ENEMY_CLASS[k] && E.ENEMY_CLASS[k].vi && E.ENEMY_CLASS[k].model), 'every enemy class has a real role name, a vehicle and a counter-tip');
  ok(E.ENEMY_DEFS.heavy.armF<=0.5 && E.ENEMY_DEFS.heavy.armR>=1.4 && E.ENEMY_DEFS.shield.aps>0 && E.ENEMY_DEFS.sniper.halt && E.ENEMY_DEFS.scout.canShoot, 'traits: armour arcs, APS, halt-to-fire, armed scout');
  const ds=R('src/tank/designs.js'); ok(['ifv','recon','atgmv','spg','td','flametank','arv','ugv'].every(k=>new RegExp('\\n  '+k+':').test(ds)), 'role vehicles: IFV, recon, ATGM carrier, SP howitzer, tank destroyer, flame tank, recovery vehicle, demolition UGV');
  ok(/export function armourArc/.test(R('src/combat/lock-on.js')) && /export function apsKill/.test(R('src/combat/lock-on.js')) && /laid/.test(R('src/ai/tactics.js')) && /export function popSmoke/.test(R('src/ai/tactics.js')) && /S\.spotted=spot/.test(R('src/ai/tactics.js')), 'combat: arcs, APS, turret traverse before firing, smoke screens, scout spotting');
  ok(/K\.g\.userData\.nozzle=nz/.test(ds) && /K\.g\.userData\.launcher=lo/.test(ds) && /K\.g\.userData\.arm=tip/.test(ds), 'flame / missile / crane hooks live on the real vehicles'); }

// Z159 the generals' super-heavies: own machines, weak points on real parts
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const ds=R('src/tank/designs.js'), bs=R('src/campaign/boss.js'); const B=(await import('./src/data/bosses.js')).BOSS_DEFS;
  ok(B.every(b=>new RegExp('\\n  b_'+b.id+':').test(ds) && new RegExp('\\n  b_'+b.id+'\\(K\\)\\{').test(ds)), 'each general has its own super-heavy design and kit');
  ok(B.every(b=>b.parts.every(pt=>new RegExp('hard(\\.|\\[sd<0\\?\\x27)'+pt.id.replace(/[LR]$/,'')).test(ds))), 'every weak point is recorded on a real part of its machine');
  ok(/model:'b_'\+def\.id/.test(bs) && /hp2\.on==='turret'\?mesh\.userData\.turret/.test(bs) && !/hornMat/.test(bs), 'boss spawns its machine; turret weak points turn with the turret; no stuck-on horns');
  ok(/twin:true/.test(ds) && /const units = d\.twin/.test(ds), 'the Overlord runs on four tracks'); }

// Z160 the generals fire from their real guns: every mounted weapon works, with FX at boss scale; mysterious liveries
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const ds=R('src/tank/designs.js'), bs=R('src/campaign/boss.js'); const B=(await import('./src/data/bosses.js')).BOSS_DEFS;
  ok(/function mnt\(K, kind/.test(ds) && ['mg','sec','podL','podR','emitter','mines','stack'].every(k=>new RegExp("'"+k+"'").test(ds)), 'super-heavies record a mount for every weapon on the hull');
  ok(/bossMounts\('main'\)/.test(bs) && /mains\.forEach/.test(bs) && !/n>3/.test(bs.slice(bs.indexOf('export function bossSpread'), bs.indexOf('export function bossBlast'))), 'main guns fire aimed fans out of every real barrel, not a ring from the centre');
  ok(/export function bossMG/.test(bs) && /bossMounts\('mg'\)\.concat\(bossMounts\('coax'\)\)/.test(bs) && /bossMounts\('sec'\)/.test(bs) && /bossMG\(now\)/.test(bs), 'hull MGs, coax and the 75 mm secondary fire bursts');
  ok(/bossMounts\('podL'\)/.test(bs) && /flash:'launch'/.test(bs) && /bossLayMine/.test(bs) && /bossMounts\('emitter'\)/.test(bs) && /bossMounts\('stack'\)/.test(bs), 'missiles leave the launch tubes, mines are thrown from the rack, the laser leaves the emitter, stacks smoke');
  ok(/U\.aimers\) for/.test(bs) && /accMat\.emissiveIntensity=/.test(bs) && /core, glow, flare/.test(bs), 'sub-turrets track, glowing seams breathe, the beam has core + glow + lens flare');
  ok(B.every(b=>b.pal && b.pal.accent!=null && b.pal.hull<0x404040), 'each general wears a dark livery with its own glowing accent'); }

// Z161 workshop per tank, the crew, three new generals, radio voices, the adaptive score
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const KD=await import('./src/data/kit.js'), BD=await import('./src/data/bosses.js');
  const kit=R('src/tank/kit.js'), ui=R('src/ui/kitshop.js'), flow=R('src/game/flow.js'), bs=R('src/campaign/boss.js'), bn=R('src/campaign/boss-new.js'), ds=R('src/tank/designs.js'), vo=R('src/audio/voice.js'), mu=R('src/audio/music.js'), ops=R('src/campaign/operations.js'), mdl=R('src/tank/models.js');
  const order=(mdl.match(/TANK_ORDER = \[([^\]]+)\]/)||[])[1].split(',').map(x=>x.trim().replace(/'/g,''));
  ok(KD.KIT_TRACKS.length===4 && order.every(id=>KD.KIT_SIG[id] && KD.KIT_SIG[id].d>0 && KD.KIT_SIG[id].fx), 'every tank in the garage has 4 upgrade tracks and its own signature module');
  ok(/applyTankKit\(p, p\.modelId\)/.test(flow) && /gi\.ammo = magCap/.test(flow.slice(flow.indexOf('applyTankKit'))), 'workshop + crew are baked in after the model stats, then mags refilled');
  ok(/shtora/.test(R('src/actors/enemy-missiles.js')) && /p\.sig\.trophy/.test(R('src/actors/enemy-missiles.js')) && /capsuleSave/.test(R('src/game/player-damage.js')) && /addEra/.test(kit), 'signature modules work in battle: Shtora, Trophy, crew capsule, reactive tiles');
  ok(KD.CREW_SEATS.length===4 && KD.CREW_SEATS.every(s=>s.l5&&s.l10) && KD.CREW_RECRUITS.filter(r=>!r.price).length===4 && KD.CREW_RECRUITS.every(r=>!r.trait||KD.CREW_TRAITS[r.trait]), 'four crew seats with level-5/10 skills; four starting crewmen; every trait exists');
  ok(/grantCrewXp\(true\)/.test(bs) && /grantCrewXp\(false\)/.test(R('src/game/player-damage.js')) && /S\.kitKills/.test(R('src/actors/damage.js')), 'the crew earns XP from stages, kills and (half) from lost battles');
  ok(/id="kitshop"/.test(R('index.html')) && /id="garKit"/.test(R('index.html')) && /openKitShop/.test(ui) && /hireCrew/.test(ui) && /buySig/.test(ui), 'workshop + crew screen reachable from the garage');
  ok(BD.BOSS_NEW.length===3 && BD.BOSS_NEW.every(b=>new RegExp('\\n  b_'+b.id+':').test(ds) && new RegExp('\\n  b_'+b.id+'\\(K\\)\\{').test(ds) && b.intro && b.taunt.length===2), 'three new generals, each with its own machine, intro and taunts');
  ok(/BOSS_ALT\[st\]/.test(bs) && Object.values(BD.BOSS_ALT).every(id=>BD.BOSS_NEW.some(b=>b.id===id)), 'odd NG+ loops hand stages to the new generals');
  ok(/thermoSalvo/.test(bn) && /FIREZ\.push/.test(bn) && /mortarBarrage/.test(bn) && /U\.tail/.test(bn) && /railTel/.test(bn) && /empBurst/.test(bn) && /teslaArcs/.test(bn), 'new generals fight with their own weapons (thermobaric fire, mortars + tail, railgun + EMP + tesla)');
  ok(/radio\(msg, vkey\)/.test(ops) && /sayVoice\(vkey \|\| voiceKeyFor\(msg\)\)/.test(ops) && VOICE_FILES_OK(), 'radio lines are spoken; every voice file exists');
  ok(/OfflineAudioContext/.test(mu) && /updateScore\(dt\)/.test(R('src/game/loop.js')) && Object.keys(BD.BOSS_DEFS.concat(BD.BOSS_NEW).reduce((a,b)=>(a[b.id]=1,a),{})).every(id=>new RegExp('\\b'+id+':\\[').test(mu)), 'adaptive score: stems rendered offline, faded with the fight, a motif per general');
  function VOICE_FILES_OK(){ const keys=[...vo.matchAll(/, '([a-z_]+)'\]/g)].map(m=>m[1]); for(const b of BD.BOSS_DEFS.concat(BD.BOSS_NEW)) keys.push('boss_'+b.id,'t_'+b.id+'_1','t_'+b.id+'_2'); keys.push('boss_phase'); return keys.length>40 && keys.every(k=>fs.existsSync('assets/voice/'+k+'.mp3')); } }

// Z162 cloud save (Firebase phase 1): anonymous sign-in, profile mirrored to Firestore users/{uid}, owner-only rules
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const cl=R('src/core/cloud.js'), rules=R('firestore.rules'), cfg=await import('./config.js');
  ok(cfg.CLOUD_CFG && /steel-siege/.test(cfg.CLOUD_CFG.app.projectId) && cfg.CLOUD_CFG.localOnly.includes('perfDpr') && cfg.CLOUD_CFG.pushEvery>=10, 'cloud config: project, device-only keys stay local, writes rate-limited');
  ok(/signInAnonymously/.test(cl) && /indexedDBLocalPersistence/.test(cl) && /import\(U\+'firebase-firestore\.js'\)/.test(cl), 'Firebase loads lazily from the CDN and signs in anonymously, persisting the player');
  ok(/backupLocal\(\)/.test(cl) && /progressOf\(remote\.profile\)>=progressOf\(PROFILE\)/.test(cl) && /await push\(true\)/.test(cl), 'first sync picks the save that got further and keeps the other as a local backup');
  ok(/if\(!quiet\) cloudDirty\(\)/.test(R('src/core/profile.js')) && /initCloud\(\)/.test(R('src/game/boot-gate.js')) && /id="setCloud"/.test(R('index.html')), 'every save queues a cloud write; sign-in after boot; account row in Settings');
  ok(/request\.auth\.uid == uid/.test(rules) && /match \/\{document=\*\*\} \{\s*allow read, write: if false;/.test(rules) && /allow delete: if false/.test(rules), 'Firestore rules: only the owner reads/writes their save; everything else is closed'); }

// Z162b server economy (Firebase phase 2): pure rules shared with Cloud Functions; client routes every spend through them once linked
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const E=await import('./functions/economy.js'), cat=JSON.parse(R('functions/catalog.json')), cfg=await import('./config.js');
  ok(JSON.stringify(cat.cap)===JSON.stringify(cfg.PAYOUT_CAP) && Object.keys(cat.ammo).length===cfg.AMMO_SHOP.length && cat.guns.railgun && cat.kit.lqt.length===3, 'server catalog is built from the game data (prices, caps, ammo, kit) — run `node tools/catalog.mjs` after changing them');
  { const s=E.migrate({ coins:9e9, diamonds:9e9, ownedGuns:['rifle','smg','hack'], ownedTanks:['lqt','t90m','x'], upgrades:{ damage:99, nope:3 }, kit:{ t90m:{ armor:9, engine:2, fcs:2, susp:2, sig:true } } }, cat);
    ok(s.coins+E.inventoryValue(s,cat)<=cat.cap.migrateValue && s.coins>0 && !s.guns.includes('hack') && !s.tanks.includes('x') && s.upgrades.damage===cat.upgrades.damage.length && !('nope' in s.upgrades) && s.kit.t90m.armor===3 && s.kit.t90m.sig===true, 'migration clamps the wallet, drops unknown items, clamps levels'); }
  { const all={ coins:1, ownedGuns:Object.keys(cat.guns), ownedTanks:Object.keys(cat.tanks), upgrades:Object.fromEntries(Object.entries(cat.upgrades).map(([k,v])=>[k,v.length])) }, f=E.migrate(all,cat,Date.now()), late=E.migrate({ coins:5000 },cat,cat.cap.migrateUntil+1);
    ok(f.guns.length===1 && f.meta.rejected>0 && late.coins===0, 'a forged everything-unlocked save is refused; after the window new players start fresh'); }
  { const s=E.freshState(); s.meta={ createdAt:0, reach:2 }; const a=E.payout(s,{ coins:1e6, loop:50, stage:5, cleared:1, guns:['arty'] },600000,cat);
    ok(a.coins<=cat.cap.coinBucket && s.meta.reach===2 && !a.gun, 'a forged NG+ loop / far-ahead clear earns no multiplier, no progress and no gun'); }
  { const s=E.freshState(); s.coins=1000; ok(!E.purchase(s,{type:'gun',id:'railgun'},cat).ok && E.purchase(s,{type:'gun',id:'smg'},cat).ok && s.coins===400 && !E.purchase(s,{type:'gun',id:'smg'},cat).ok, 'purchases: VIP needs diamonds, a gun is bought once, the price is taken');
    ok(E.purchase(s,{type:'kit',id:'lqt',track:'armor'},cat).ok===(400>=cat.kit.lqt[0].c) && !E.purchase(s,{type:'sig',id:'lqt'},cat).ok && !E.purchase(s,{type:'kit',id:'t14',track:'armor'},cat).ok, 'workshop: only owned tanks; the signature needs every track at level 2'); }
  { const s=E.freshState(); s.meta={ createdAt:0 }; const t=60000, a=E.payout(s,{ coins:500 },t,cat), b=E.payout(s,{ coins:99999 },2*t,cat), c=E.payout(s,{ coins:99999 },3*t,cat);
    ok(a.coins===500 && b.coins<=cat.cap.coinBucket && c.coins<=cat.cap.coinPerMin+1 && c.clamped, 'payouts come from a refilling bucket: bursts paid, a farming client is held to the average rate'); }
  const ec=R('src/core/econ.js'), rules=R('firestore.rules');
  ok(/match \/econ\/\{uid\}[\s\S]*allow write: if false/.test(rules) && /econBootstrap/.test(R('functions/index.js')) && /maxInstances:5/.test(R('functions/index.js')), 'econ/{uid} is server-only (owner may read); functions capped at 5 instances');
  ok(/econBuy\('tank'/.test(R('src/ui/garage.js')) && /econBuy\(isUp\?'up':'gun'/.test(R('src/ui/shop.js')) && /econBuy\('kit'/.test(R('src/tank/kit.js')) && /econBuy\('ammo'/.test(R('src/tank/kit.js')) && /econReportRun\(\{ cleared:true \}\)/.test(R('src/campaign/boss.js')), 'every spend goes through econBuy; each cleared stage is reported');
  ok(/stageAmmo\(p\)/.test(R('src/tank/kit.js')) && /ammoSplash/.test(R('src/combat/lock-on.js')) && /ammoBurn/.test(R('src/combat/lock-on.js')) && /ammoFront/.test(R('src/campaign/boss.js')) && /data-kt="ammo"/.test(R('index.html')), 'special ammo: shop tab, one box loaded per stage, AP / HE / incendiary / resupply effects'); }

// Z163 leaderboard: scores validated by the server (per-run bucket), weekly + all-time boards written only by Cloud Functions
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const E=await import('./functions/economy.js'), cat=JSON.parse(R('functions/catalog.json'));
  ok(E.weekKey(Date.UTC(2026,10,13,5))==='2026-W46' && E.weekKey(Date.UTC(2026,10,15,18))==='2026-W47', 'week key follows Vietnam time (a Sunday evening UTC is already Monday)');
  { const s=E.freshState(); s.meta={ createdAt:0, reach:3 }; const a=E.scoreUpdate(s,{ runId:'r1', score:20000 },5*60000,cat,0,2), b=E.scoreUpdate(s,{ runId:'r1', score:9e8 },6*60000,cat,0,2);
    ok(a.best===20000 && b.clamped && b.best<20000+cat.cap.scoreBucket*2, 'a forged score is cut to what the run bucket allows'); }
  { const s=E.freshState(); s.meta={ createdAt:0, reach:3 }; let r; for(let i=1;i<=60;i++) r=E.scoreUpdate(s,{ runId:'idle', score:i*9000 },i*60000,cat,0,1);
    const late=E.scoreUpdate(s,{ runId:'idle', score:9e6 },(cat.cap.runMaxH+1)*3600e3,cat,1,1);
    ok(r.best<=cat.cap.runBase && late.closed, 'a run with no cleared stage stays small, and a run kept open for hours is closed'); }
  ok(E.cleanName('<script>x','u1')==='scriptx' && E.cleanName('','abcd')==='CHỈ HUY ABCD', 'player names are cleaned server-side');
  ok(/match \/lb\/\{uid\} \{ allow read: if signedIn\(\); allow write: if false; \}/.test(R('firestore.rules')) && /lbw\/'\+sc\.week/.test(R('functions/index.js')), 'leaderboards are readable by players, writable only by the server');
  ok(/escapeHtml\(r\.name/.test(R('src/ui/ranking.js')) && /getCountFromServer/.test(R('src/ui/ranking.js')) && /id="rankBtn"/.test(R('index.html')) && /score:S\.score\|0, runId:S\.runId/.test(R('src/core/econ.js')), 'ranking screen: top 50, your own rank, names escaped; runs report their score'); }

console.log(`\n${fail === 0 ? '✓ PASS' : '✗ FAIL'} — ${pass} checks passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
