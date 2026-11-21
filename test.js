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
ok(BALANCE.elite.hpMul > 1 && BALANCE.elite.sizeMul === 1, 'elites are tankier; same real-size hull (Z174: the gold aura marks them, not a bigger tank)');
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
  ok(id==='rifle' || g.trooper || GUN_PRICE[id] !== undefined, `gun ${id}: has a shop price (GUN_PRICE)`);   // (Z306 the soldier's rifle is never sold)
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
  ok(Math.abs(TROOPS.look.scale*1.407-1.78)<0.02, 'soldiers are one real size for both sides (Z174: 1.78 m)');
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
ok(FORT.tiers[1].gate/(GUNS.rifle.dmg*(1+(GUNS.rifle.splash||0))*Math.max(FORT.shotStructMin, DMG_TYPE[GUNS.rifle.type].struct)) <= 50, 'Z111 the starter rifle opens a tier-1 gate in under ~50 shots');
ok(RIDER.cap >= 12 && RIDER.base + 3*RIDER.perUp <= RIDER.cap, 'Z111b 12 seats on the tank; base + 3 crew upgrades fit');
ok(INFANTRY.vsArmour > 0 && INFANTRY.vsArmour <= 0.35, 'Z111b rifle rounds barely scratch a tank');
ok(FORT.posture.holdK > 0 && FORT.gate.exitMax > 0 && LOOT.siege.mul > 1, 'Z111b fortress posture / gate / siege-rounds tuning present');
ok(HARD.boulder/(60*DMG_TYPE.AP.struct) > 2 && HARD.boulder/(60*DMG_TYPE.AP.struct) <= 3 && 95*DMG_TYPE.AP.struct >= HARD.oneShot, 'Z112 a boulder takes 3 cannon shells, one railgun slug');
ok(TANK_DEATH.chunkLife[0] > 0.5 && TANK_DEATH.chunkLife[1] <= 2.5 && TANK_DEATH.fade < TANK_DEATH.chunkLife[0] && TANK_DEATH.smokeK > 0 && TANK_DEATH.smokeK < 1, 'Z402 a killed tank blows apart at once (no burning phase, no wreck): its torn steel is gone within ~2 s, its smoke a short puff');
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
  ok(/defaultGunIdx\(\)/.test(fw+(await import('node:fs')).readFileSync('src/game/mode.js','utf8')) && /selectDefaultGun/.test(fl) && /'gunDefault'/.test(g), 'start with the default gun; LB+RB jumps back to it'); }

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
  for(const n of ['CITY']) ok(new RegExp("name:'"+n+"'").test(w) && new RegExp(n+":\\{").test(w) && new RegExp(n+":'").test(t), 'biome '+n+' is fully defined (data, atmosphere, ground, name)');
  ok(/buildSceneSet\(\)/.test(l) && /carveRivers/.test(h) && /wetAt/.test(h), 'landmarks + river carving exist');
  ok(/_mbBusy/.test(b), 'menuBack cannot recurse'); }

// Z140 regional strongholds, guard cannons, tour, events, flag fall, celebration
{ const fs=await import('node:fs'); const r=fs.readFileSync('src/world/regional.js','utf8'), cw=fs.readFileSync('src/world/core-walls.js','utf8'), fo=fs.readFileSync('src/world/fortress.js','utf8'), it=fs.readFileSync('src/game/intro.js','utf8'), ev=fs.readFileSync('src/world/env-events.js','utf8'), ce=fs.readFileSync('src/fx/celebrate.js','utf8'), lo=fs.readFileSync('src/combat/lock-on.js','utf8');
  ok(/export function fortStyle/.test(r) && /REGION_ALT/.test(r) && /laterite/.test(r) && /bamboo/.test(r), 'every biome has regional fort styles, several per map');
  ok(/buildCoreWalls/.test(cw) && /updateCoreGuns/.test(cw) && /ours:true/.test(cw) && /bl\.ours && b\.owner==='p'/.test(lo), 'our walled core with guard cannons; our walls never stop our fire');
  ok(/fortStyle\(BIOME\.name, fi\+\+\)/.test(fo) && /leaderless/.test(fo) && /animFlag/.test(fo), 'forts: own architecture each, commander down = no reinforcements, flag topples');
  ok(/function build(Grand)?Tour/.test(it) && /flood\(|function flood/.test(ev) && /rockslide/.test(ev) && /collapse/.test(ev) && /export function celebrate/.test(ce), 'battlefield tour, land events and victory celebration exist'); }

// Z239 smooth camera + gentle shake + one wide intro move
{ const fs=await import('node:fs'); const up=fs.readFileSync('src/game/update.js','utf8'), it=fs.readFileSync('src/game/intro.js','utf8'), inp=fs.readFileSync('src/input/input.js','utf8'), C=await import('./config.js');
  ok(/function sd\(o, k, target, st, dt\)/.test(up) && /sd\(CAM, 'ya'/.test(up) && /sd\(CAM, 'zl'/.test(up) && /wrapAngle\(yt-CAM\.ya\)/.test(up), 'camera: follow, look-ahead, zoom and view turn are damped springs; the turn takes the shortest arc');
  ok(/export function camRestPose/.test(up) && /camRestPose\(_rp, _rl\)/.test(it) && /CAM\.blend/.test(up), 'intro lands on the exact play framing; the follow camera glides back after any cinematic');
  ok(/S\.camYawT/.test(inp) && /S\.zoomT=z/.test(inp) && !/S\.camYaw=\(/.test(inp) && /e\.ctrlKey \|\| e\.shiftKey/.test(inp) && /e\.button!==1/.test(inp), 'inputs set camera TARGETS (pinch / shift-wheel zoom, swipe / middle-drag orbit)');
  ok(C.SHAKE && C.SHAKE.levels.off===0 && C.SHAKE.levels[C.SHAKE.def]<=0.4 && C.SHAKE.pos<1.15 && C.SHAKE.roll<0.035, 'screen shake: player level (off…strong), gentle by default, smaller than before');
  const sm=u=>u*u*u*(u*(u*6-15)+10); ok(Math.abs(sm(0))<1e-9 && Math.abs(sm(1)-1)<1e-9 && Math.abs(sm(0.5)-0.5)<1e-9, 'smootherstep endpoints');
  ok(/wAt/.test(it) && /TOUR\.dur/.test(it) && /TOUR = \{ dur:7\.2/.test(it), 'desktop intro: one wide move reparameterised by perceived motion, ~7 s'); }

// Z240 performance: AO reads the main depth (no second scene render), perf HUD, detail cull, dynamic resolution upward
{ const fs=await import('node:fs'); const rd=fs.readFileSync('src/render/renderer.js','utf8'), lod=fs.readFileSync('src/render/lod.js','utf8'), ph=fs.readFileSync('src/render/perfhud.js','utf8'), lp=fs.readFileSync('src/game/loop.js','utf8'), hub=fs.readFileSync('src/hub.js','utf8'), C=await import('./config.js');
  ok(/this\.rt\.depthTexture = new THREE\.DepthTexture/.test(rd) && /aoPass\.setGBuffer\(renderPass\.rt\.depthTexture\)/.test(rd), 'AO reads the depth of the frame just drawn (no normal re-render of the scene) — Z412 the scene pass\'s own resolved depth');
  ok(/EXT_disjoint_timer_query_webgl2/.test(ph) && /QUERY_RESULT_AVAILABLE/.test(ph) && /'F3'/.test(ph) && /render\/perfhud\.js/.test(hub), 'perf HUD: GPU timer read back without stalls, F3 toggle, in the hub');
  ok(/perfFrameBegin\(\)/.test(lp) && /perfRenderBegin\(\); composer\.render\(\); perfFrameEnd\(rawMs\)/.test(lp), 'the main loop is probed around the render');
  ok(/export function detailCull/.test(lod) && /Math\.exp\(-fd\*fd\)/.test(lod) && C.LOD.detailPx>=1 && C.LOD.detailPx<=3 && C.LOD.detailHys>1, 'detail cull by on-screen size × fog, with hysteresis');
  ok(/perfGpuMs\(60\)/.test(lp) && /upHold/.test(lp) && C.PERF_HUD && C.PERF_HUD.n>=60, 'dynamic resolution steps back up from measured GPU headroom'); }

// Z243 shield pylons stand clear of our citadel and carry a beacon + screen markers
{ const fs=await import('node:fs'); const bo=fs.readFileSync('src/campaign/boss.js','utf8'), pm=fs.readFileSync('src/ui/pylon-marks.js','utf8'), lp=fs.readFileSync('src/game/loop.js','utf8'), rd=fs.readFileSync('src/ui/radar.js','utf8'), C=await import('./config.js');
  ok(/function pylonSpots/.test(bo) && /CORE_DEF\.R\+PS\.coreGap/.test(bo) && /f\.R\+PS\.fortGap/.test(bo) && !/Math\.cos\(a\)\*P\.ring, z=Math\.sin\(a\)\*P\.ring\*0\.85/.test(bo), 'pylons are sited round the general, outside our citadel and every fortress (not on a ring round the map centre = our walls)');
  ok(C.PYLON_SITE && C.PYLON_SITE.coreGap>=10 && C.PYLON_SITE.apart>=12 && C.PYLON_SITE.pillar>=40, 'pylon site rules: citadel gap, spacing, a tall light pillar');
  ok(/function pylonMarker/.test(bo) && /updatePylonBeacons/.test(bo) && /export function updatePylonMarks/.test(pm) && /updatePylonMarks\(\)/.test(lp) && /PYLONS\.length/.test(rd), 'every pylon: light pillar + pulsing ring + diamond, an on-screen / edge marker with its distance, a radar blip'); }

// Z245 cavalry mode: the war horse (gait engine + IK), the general in plate, mount / dismount, stances
{ const fs=await import('node:fs'); const ho=fs.readFileSync('src/actors/horse.js','utf8'), ge=fs.readFileSync('src/actors/general.js','utf8'), cv=fs.readFileSync('src/game/cavalry.js','utf8'), lp=fs.readFileSync('src/game/loop.js','utf8'), fl=fs.readFileSync('src/game/flow.js','utf8'), C=await import('./config.js');
  ok(/walk:\s*\{ off:\[0, 0\.25, 0\.5, 0\.75\]/.test(ho) && /trot:\s*\{ off:\[0, 0\.5, 0\.5, 0\]/.test(ho) && /canter:\{ off:/.test(ho) && /gallop:\{ off:/.test(ho), 'four gaits with their real footfall order (walk lateral 4-beat, trot diagonal pairs, canter 3-beat, gallop transverse)');
  ok(/function solveLeg/.test(ho) && /function footTarget/.test(ho) && /heightAt\(wx, wz\)/.test(ho) && /S\.onStep/.test(ho), 'two-bone IK legs planted on the ground, footfall events');
  ok(/breast panel/.test(ho) && /face shield/.test(ho) && /splint boots/.test(ho) && /saddlebags/.test(ho) && /reins/.test(ho), 'the horse wears modern military tack');
  ok(/visor/.test(ge) && /plate carrier/.test(ge) && /headset/.test(ge) && /knee pad/.test(ge) && /function rightHand/.test(ge) && /function battleRifle/.test(ge) && /export function poseRider/.test(ge), 'the general: modern helmet with visor, plate carrier, pads, gloved hands on a battle rifle, a riding pose');
  ok(/export function cavToggleMount/.test(cv) && /export function cavStance/.test(cv) && /export function cavDash/.test(cv) && /trample/.test(cv) && /whistle\(\)/.test(cv), 'mount / dismount, kneel / prone / crawl, gallop surge / sprint, trampling, whistle the horse');
  ok(/MODE\.update\(gdt, now\)/.test(lp) && /updateCavalry\(dt, now\)/.test((await import('node:fs')).readFileSync('src/game/mode.js','utf8')) && /PROFILE\.unit==='cav'/.test(fl) && C.CAV && C.CAV.horse.gallop>=14 && C.CAV.defK.prone<C.CAV.defK.stand && C.HORSE && C.HORSE.gaitV.length===3, 'cavalry mode wired in: the loop, the unit pick, speeds, armour by posture'); }

// Z246 sculpted bodies: one lofted, skinned skin for the horse and the general (no stuck-on primitives), muscle relief, hands that grip
{ const fs=await import('node:fs'); const lo=fs.readFileSync('src/actors/loft.js','utf8'), ho=fs.readFileSync('src/actors/horse.js','utf8'), ge=fs.readFileSync('src/actors/general.js','utf8');
  ok(/export function loftGeo/.test(lo) && /export function secAt/.test(lo) && /skinIndex/.test(lo) && /export function skinMesh/.test(lo) && /bump/.test(lo), 'loft: Catmull-Rom sections, bone weights, skinned meshes, relief');
  ok(/new THREE\.Skeleton\(bones\)/.test(ho) && /new THREE\.Bone\(\)/.test(ho) && /const relief=/.test(ho) && /bump:relief/.test(ho) && /mane falls/.test(ho), 'the horse is one skinned body with muscle relief and a mane');
  ok(/new THREE\.Skeleton\(bones\)/.test(ge) && /u\.parts=\[\]/.test(ge) && /function leftHand/.test(ge) && /function finger/.test(ge) && /GOFF/.test(ge), 'the general is one skinned body, not the batched infantry kit; fingers round grip and handguard; rifle forward of the carrier');
  const C=await import('./config.js'); ok(/L\.hip\.rotation\.z=L\.sx\*0\.62/.test(ge), 'the rider straddles the barrel (legs down the horse\'s sides)'); }

// Z247 real glTF models: the photo-scanned CC0 rifle on the general (loaded once, cloned; the procedural rifle stays if it fails)
{ const fs=await import('node:fs'); const mo=fs.readFileSync('src/actors/models.js','utf8'), ge=fs.readFileSync('src/actors/general.js','utf8');
  ok(/GLTFLoader/.test(mo) && /export function loadModel/.test(mo) && /export function fitRealRifle/.test(mo) && /catch\(/.test(mo) && /CC0/.test(mo), 'real models: glTF loader, cached, falls back to the procedural model, licence noted');
  ok(/fitRealRifle\(G, u, GOFF\)/.test(ge), 'the general carries the scanned rifle');
  const m=JSON.parse(fs.readFileSync('assets/models/rifle/bolt_action_rifle_7_62_1k.gltf','utf8')); ok(m.buffers.every(b=>fs.existsSync('assets/models/rifle/'+b.uri)) && m.images.every(i=>fs.existsSync('assets/models/rifle/'+i.uri)), 'the rifle model ships with its buffer and textures'); }

// Z248 real cavalry: Meshy-generated war horse, operator and carbine over the procedural rigs (loaded together; procedural stays on failure)
{ const fs=await import('node:fs'); const rc=fs.readFileSync('src/actors/real-cav.js','utf8'), cv=fs.readFileSync('src/game/cavalry.js','utf8'), mo=fs.readFileSync('src/actors/models.js','utf8'), C=await import('./config.js');
  ok(/export function fitRealCav/.test(rc) && /export function updateRealCav/.test(rc) && /AnimationMixer/.test(rc) && /SkeletonUtils/.test(rc) && /L\.slice\(1, 5\)\.some\(x => !x\)/.test(rc), 'real cavalry: skinned clones with mixers, all-or-nothing load (Z294: the second soldier optional, no horse on a ride)');
  ok(/'Ride_Gallop'/.test(rc) && /'Rifle_Charge'/.test(rc) && /'Kneeling_Reload'/.test(rc) && /'Prone_Reload'/.test(rc) && /poseClip\('Aim_Stand'/.test(rc) && /'Sprint'/.test(rc) && /'Canter'/.test(rc), 'clips per state: riding, rifle walk / run / charge, kneel, prone, the composed standing aim; horse gaits');
  ok(/inPlace\(/.test(rc) && /R\.seat\.add\(G\)/.test(rc) && /R\.cb/.test(rc) && /u\.muzzle/.test(rc), 'root motion pinned, the rider rides the real horse\'s back, the carbine carries the muzzle');
  ok(/fitRealCav\(CV\)/.test(cv) && (cv.match(/updateRealCav\(CV, dt/g)||[]).length>=2, 'cavalry dresses its rigs and drives them each frame (play + intro idle)');
  ok(C.REALCAV && C.REALCAV.seatBone && C.REALCAV.horseV.Sprint>C.REALCAV.horseV.Canter && C.REALCAV.carbine.len>0.6, 'REALCAV calibration in config');
  const glb=f=>{ const b=fs.readFileSync(f); return b.readUInt32LE(0)===0x46546C67 && b.readUInt32LE(8)===b.length; };
  ok(['horse','operator','rideGallop','rideWalk','carbine'].every(k=>{ const m=mo.match(new RegExp(k+": '([^']+)'")); return m && fs.existsSync(m[1]) && glb(m[1]); }), 'every real model ships as a valid GLB');
  const sp=JSON.parse(fs.readFileSync('tools/meshy-assets.json','utf8')); ok(sp.rifle && sp.operator && sp.horse2 && sp.operator.rig.skeleton_template==='mixamo' && sp.horse2.rig.animation_type==='quadruped', 'the Meshy generation spec is in the repo'); }

// Z249 real infantry at batch cost: the Meshy trooper baked into the batched rig's joints; role gear on kit anchors
{ const fs=await import('node:fs'); const rt=fs.readFileSync('src/actors/real-troops.js','utf8'), so=fs.readFileSync('src/actors/soldiers.js','utf8'), inf=fs.readFileSync('src/actors/infantry.js','utf8'), ft=fs.readFileSync('src/actors/fireteam.js','utf8'), C=await import('./config.js');
  ok(/export function loadRealTroops/.test(rt) && /applyBoneTransform/.test(rt) && /function swapKit/.test(rt) && !/AnimationMixer\(root\)[^;]*update\(dt/.test(rt), 'real troops: one pose baked once, no skinning per man');
  ok(/const near = /.test(rt) && /REALTROOP\.stretch/.test(rt) && /mirror X/.test(rt), 'mis-weighted vertices follow their nearest bone; stretched slivers dropped; mirrored into the rig\'s handedness');
  ok(/kinds:\['up','head','arm','lh','gun','hipL','hipR','kneeL','kneeR'\]/.test(so) && /K\.mats && K\.mats\[kind\]/.test(so) && /loadRealTroops\(\)/.test(so), 'the batch: a piece per leg, a material per piece, the real kit loads in');
  ok(/kitAttach\(u, u\.gun, L, 'grip'/.test(inf) && /'muzzle'/.test(ft) && /'back'/.test(ft) && /'shoulderL'/.test(ft), 'RPG, MG, mortar, satchels and the AT tube sit on kit anchors');
  ok(C.REALTROOP && C.REALTROOP.anchor && C.REALTROOP.stretch.length===2, 'REALTROOP calibration in config');
  const sp=JSON.parse(fs.readFileSync('tools/meshy-assets.json','utf8')); ok(sp.trooper && sp.trooper.retex && sp.trooper2.preview.target_polycount<=12000 && sp.rifle.remesh, 'the trooper spec: low-poly, enemy retexture, a light carbine');
  ok(['assets/models/real/trooper.glb','assets/models/real/carbine-light.glb','assets/models/real/trooper-enemy.jpg'].every(f=>fs.existsSync(f) && fs.statSync(f).size<3e6), 'the troop files ship small (Z254: 2K textures)'); }

// Z250 photo ground: CC0 photo-scanned sets per battlefield, a second layer on slopes / bowls / patches, dual-scale anti-tiling
{ const fs=await import('node:fs'); const gp=fs.readFileSync('src/world/ground-photo.js','utf8'), gr=fs.readFileSync('src/world/ground.js','utf8'), bi=fs.readFileSync('src/world/biome.js','utf8'), C=await import('./config.js');
  ok(/export function applyGroundPhoto/.test(gp) && /_want !== b\.name/.test(gp) && /catch\(/.test(gp) && /procground/.test(gp), 'photo ground: per battlefield, late loads ignored, procedural fallback');
  ok(/altOn>0\.5 \? altC : patchCol/.test(gr) && /altOn>0\.5 \? altC : earthCol/.test(gr) && /vMapUv\*0\.29/.test(gr), 'second layer on patches and steep faces; the base blended with itself at another scale');
  ok(/applyGroundPhoto\(BIOME\)/.test(bi), 'applyBiome swaps the photo ground in');
  const Z=JSON.parse(fs.readFileSync('assets/ground/sizes.json','utf8')), sets=[...new Set(Object.values(C.GROUND_PHOTO.biomes).flat())];
  ok(sets.every(n=>Z[n]>0 && ['diff','nor','arm'].every(k=>fs.existsSync('assets/ground/'+n+'/'+k+'.jpg'))), 'every battlefield\'s photo sets ship with their real-world size');
  ok(Object.keys(C.GROUND_PHOTO.biomes).length>=14 && C.GROUND_PHOTO.tint._, 'all battlefields mapped, albedo tints in config'); }

// Z251 grass carpet: one instanced mesh of blade clumps round the camera, world-anchored, rim-faded, wind in world space
{ const fs=await import('node:fs'); const gc=fs.readFileSync('src/world/grass-carpet.js','utf8'), lp=fs.readFileSync('src/game/loop.js','utf8'), C=await import('./config.js');
  ok(/export function updateGrass/.test(gc) && /InstancedMesh/.test(gc) && /wetAt\(/.test(gc) && /GRASS\.rim/.test(gc) && /transpose\(gIm\)/.test(gc), 'grass carpet: instanced, off water, rim-faded, one world-space wind');
  ok(/updateGrass\(dt\)/.test(lp), 'the loop grows it round the camera');
  ok(C.GRASS && C.GRASS.biomes.MEADOW && C.GRASS.Rm<C.GRASS.R && !C.GRASS.biomes.DESERT, 'grass only on grassy battlefields; a smaller carpet on phones'); }

// Z252 real cover: Meshy pieces fitted into the procedural footprints, tracked and swapped in place
{ const fs=await import('node:fs'); const rp=fs.readFileSync('src/world/real-props.js','utf8'), pr=fs.readFileSync('src/world/props.js','utf8'), cv=fs.readFileSync('src/world/cover.js','utf8'), C=await import('./config.js');
  ok(/export function loadRealCover/.test(rp) && /export function trackCover/.test(rp) && /REALPROP\.hMax/.test(rp) && /old\.userData\.own/.test(rp) && !/old\.dispose\(\)/.test(rp), 'real cover: fitted to the footprint, own hit materials keep their tint, nothing disposed mid-compile');
  ok(/trackCover\(m\); batchCover\(m\); loadRealCover\(\)/.test(pr) && /trackCover\(up\)/.test(cv), 'every cover mesh (the stacked container too) is tracked');
  ok(!C.REALPROP.kinds.includes('hedgehog') && !C.REALPROP.kinds.includes('hesco') && C.REALPROP.kinds.flatMap(k=>C.REALPROP.variants[k]||[k]).every(k=>fs.existsSync('assets/models/real/cover/'+k+'.glb') && fs.statSync('assets/models/real/cover/'+k+'.glb').size<2e6), 'eleven Meshy cover pieces (and the container\'s variants) ship under 2 MB; hedgehog and HESCO stay procedural'); }   // Z420 the second batch carries 1K normal + roughness maps

// Z254 soldiers finished: a high-detail trooper, seams covered, per-side cast, palm grip; a real fall for the dead; the general shot off his horse
{ const fs=await import('node:fs'); const rd=fs.readFileSync('src/actors/ragdoll.js','utf8'), inf=fs.readFileSync('src/actors/infantry.js','utf8'), ft=fs.readFileSync('src/actors/fireteam.js','utf8'), rt=fs.readFileSync('src/actors/real-troops.js','utf8'), cv=fs.readFileSync('src/game/cavalry.js','utf8'), pd=fs.readFileSync('src/game/player-damage.js','utf8'), rc=fs.readFileSync('src/actors/real-cav.js','utf8'), C=await import('./config.js');
  ok(/export function startFall/.test(rd) && /export function stepFall/.test(rd) && /'buckle'/.test(rd) && /F\.g \/ F\.len \* Math\.sin\(d\.th\)/.test(rd) && /bounce/.test(rd) && /function endAngle/.test(rd), 'ragdoll: knees give, topples under gravity, bounces, settles on the slope, limbs on springs');
  ok(/export function flingDead\(/.test(inf) && /export function stepFlung\(/.test(inf) && /flingDead\(a\.g, ux, uz/.test(ft) && /stepFlung\(d, m, dt\)/.test(ft), 'enemy and ally riflemen: Z402 thrown along the shot, then gone in a burst (the ragdoll fall stays for the general)');
  ok(/seamInset/.test(rt) && /REALTROOP\.team\[key\]/.test(rt) && /palm\('RightHand', 'RightForeArm'/.test(rt) && /muzzleQ/.test(rt), 'trooper bake: seams covered, each side its own cast, rifle in the palms, muzzle gear follows the barrel');
  ok(/export function cavDeathStart/.test(cv) && /export function cavDeathUpdate/.test(cv) && /scene\.attach\(G\)/.test(cv) && /if\(p\.cav\)\{ cavDeathStart/.test(pd) && /if\(p\.cav\)\{ cavDeathUpdate/.test(pd), 'the general killed: thrown from the saddle, no tank wreck, the horse runs on');
  ok(/dying_backwards/.test(rc) && /Hit_Upper/.test(rc) && C.CAV.death && C.RAGDOLL && C.REALCAV.hitT>0, 'real general: falls backwards once, flinches (upper body) when hit');
  const sp=JSON.parse(fs.readFileSync('tools/meshy-assets.json','utf8')); ok(sp.trooper2 && sp.trooper2.preview.target_polycount>=9000, 'the trooper re-made at ~10k triangles'); }

// Z255 photographed skies: CC0 pure-sky HDRIs laid into the dome per hour (+ an overcast one for storms), turned onto our sun
{ const fs=await import('node:fs'); const sp=fs.readFileSync('src/world/sky-photo.js','utf8'), at=fs.readFileSync('src/world/atmosphere.js','utf8'), C=await import('./config.js');
  ok(/export function applySkyPhoto/.test(sp) && /hdrRot\.value = \(m\.sunU - 0\.5\)/.test(sp) && /SKY_PHOTO\.minEl/.test(sp) && /A\.night \|\| A\.cave/.test(sp) && /procsky/.test(sp), 'photo sky: turned onto our sun, shadows take its elevation, none at night / underground, procedural fallback');
  ok(/uniform sampler2D hdrTex/.test(at) && /c=mix\(c, h, hdrAmt/.test(at) && /applySkyPhoto\(A\)/.test(at), 'the dome mixes the photo over the procedural sky');
  const M=JSON.parse(fs.readFileSync('assets/sky/skies.json','utf8')); ok(Object.values(C.SKY_PHOTO.tod).concat(Object.values(C.SKY_PHOTO.mood)).every(n=>M[n] && fs.existsSync('assets/sky/'+n+'.jpg') && fs.existsSync('assets/sky/'+n+'_2k.jpg')), 'every photo sky ships (4K + 2K) with its sun position'); }

// Z256 real tanks: one Meshy vehicle per family, split into hull / turret / gun by shape, fitted onto the procedural rig (tracks, traverse, elevation, recoil kept)
{ const fs=await import('node:fs'); const rt=fs.readFileSync('src/tank/real-tanks.js','utf8'), md=fs.readFileSync('src/tank/model.js','utf8'), lod=fs.readFileSync('src/render/lod.js','utf8'), dp=fs.readFileSync('src/world/depots.js','utf8'), ga=fs.readFileSync('src/ui/gunart.js','utf8'), C=await import('./config.js'), tm=fs.readFileSync('src/tank/models.js','utf8');
  ok(/export function realTank/.test(rt) && /export function loadRealTanks/.test(rt) && /function prepare/.test(rt) && /chains/.test(rt) && /gunSet/.test(rt) && /'gear'/.test(rt), 'real tanks: parts sorted by shape — the gun chained from its pieces, the running gear dropped');
  ok(/tur\.rotation\.set\(0, 0, 0\)/.test(rt) && /procBox\(g, g, \[body\]\)/.test(rt) && /o\.userData\.proc/.test(rt) && /p\.z = tip\.z/.test(rt) && /gp\.position\.copy/.test(rt), 'fitted in the rest pose, the hull spans the tracks, only the build\'s own parts hidden, the muzzle and the gun pivot moved to the real gun');
  ok((md.match(/realTank\([a-z]+, opts\)/g)||[]).length===2 && /!c\.visible\) continue/.test(md) && /mm\.userData\.proc=true/.test(md), 'every model-named build is dressed; a bake never folds hidden parts back in');
  ok(/realHidden/.test(lod) && /model:ENEMY_MODEL\[role\]/.test(dp) && /loadRealTanks\(\)\.catch/.test(ga), 'LOD keeps them hidden; parked depot tanks and garage photos wear the real model too');
  const all=Object.values(C.REALTANK.fams).flatMap(f=>f.designs), tmb=tm.slice(tm.indexOf('export const TANK_MODELS'), tm.indexOf('\n};', tm.indexOf('export const TANK_MODELS'))), em=tm.match(/export const ENEMY_MODEL = \{([^}]*)\}/)[1];
  const used=new Set([...tmb.matchAll(/^  ([a-z0-9]+): ?\{/gm)].map(m=>m[1]).concat([...em.matchAll(/'([a-z0-9]+)'/g)].map(m=>m[1]))); ok(used.size>=13, 'the design list was read ('+used.size+')');
  ok([...used].every(id=>all.includes(id)) && new Set(all).size===all.length, 'every garage and enemy design belongs to exactly one family');
  ok(Object.keys(C.REALTANK.fams).every(k=>fs.existsSync('assets/models/real/tank/'+k+'.glb') && fs.statSync('assets/models/real/tank/'+k+'.glb').size<2.2e6), 'seven family models ship small (≤2.2 MB each)'); }

// Z257 real guns: the player's weapons wear a real model per family (tube guns off the tank models, the rest from their own Meshy files)
{ const fs=await import('node:fs'); const rg=fs.readFileSync('src/tank/real-guns.js','utf8'), br=fs.readFileSync('src/tank/barrels.js','utf8'), ga=fs.readFileSync('src/ui/gunart.js','utf8'), md=fs.readFileSync('src/actors/models.js','utf8'), C=await import('./config.js'), G=C.REALGUN;
  ok(/export function realGun/.test(rg) && /export function loadRealGuns/.test(rg) && /REAL_TANK_FAM\[f\.fromTank\]/.test(rg) && /box\.max\.z - mb\.max\.z \* sl/.test(rg) && /f\.pair && u\.muzzles/.test(rg) && /f\.glow && glows/.test(rg), 'real guns: front on the muzzle, twin guns one per muzzle, energy glow kept, tube guns taken off the tanks');
  ok(/return realGun\(g, id\)/.test(br) && /if\(!o\.userData\.sharedGeo\) o\.geometry\.dispose\(\)/.test(br) && /loadRealGuns\(\)\.catch/.test(ga) && /MODEL_FILES\['gun_' \+ k\]/.test(md), 'every barrel built is dressed; a remount never frees the shared model; gun photos wait for it');
  const all=Object.values(G.fams).flatMap(f=>f.guns), keep=['minigun','mortar','arty','rocket','orbital','singularity'];
  ok(all.length===16 && new Set(all).size===16 && keep.every(id=>!all.includes(id)), 'sixteen guns in nine families, each in one; the lobbers, the rotary cannon and two ultimates stay procedural');
  ok(Object.entries(G.fams).every(([k,f])=>f.fromTank ? C.REALTANK.fams[f.fromTank] : (fs.existsSync('assets/models/real/gun/'+k+'.glb') && fs.statSync('assets/models/real/gun/'+k+'.glb').size<8e5 && ['+x','-x','+z','-z'].includes(f.front))), 'each family has its model (a tank family, or its own file under 0.8 MB with a muzzle direction)'); }

// Z258 real magma + a real volcano: one molten-rock shader (crust plates on the melt, glowing cracks, temperature ramp) for the pools, the crater lake and the cone's lava flows
{ const fs=await import('node:fs'); const mg=fs.readFileSync('src/world/magma.js','utf8'), lv=fs.readFileSync('src/world/lava.js','utf8'), wd=fs.readFileSync('src/world/wonders.js','utf8'), lp=fs.readFileSync('src/game/loop.js','utf8'), C=await import('./config.js');
  ok(/export function magmaMat/.test(mg) && /float mT\(vec2 p/.test(mg) && /vec2 mV\(vec2 p, float t\)/.test(mg) && /vec3 mRamp/.test(mg) && /totalEmissiveRadiance \+= mRamp\(T\)/.test(mg) && /mRim \* smoothstep/.test(mg), 'magma: Voronoi crust plates drifting on a warped melt, a temperature ramp into the emissive, a cooler rim');
  ok(/export function buildVolcano/.test(mg) && /Math\.pow\(t, 1\.65\)/.test(mg) && /radial gullies/.test(mg) && /for\(int k = 0; k < 3; k\+\+\)/.test(mg) && /the lathe's seam/.test(mg) && /export function updateMagma/.test(mg), 'the volcano: concave lathed cone, gullies, three lava flows, crater lake, seam closed, lava bombs');
  ok(/magmaMat\(\{ hot:0\.06 \}\)/.test(lv) && /buildVolcano\(\)/.test(wd) && /placeVolcano\(v\)/.test(wd) && /clearVolcano\(\)/.test(wd) && /updateMagma\(dt, now\)/.test(lp), 'the caldera pools and the wonder use it; the melt moves every frame');
  ok(C.MAGMA_FX && C.MAGMA_FX.cone.H>20 && C.MAGMA_FX.cone.rc<C.MAGMA_FX.cone.R/3, 'magma + volcano settings'); }

// Z259 photo stone: the Giza pyramids in photographed limestone courses, every boulder in a triplanar rock-face photo, photo detail on the far hills
{ const fs=await import('node:fs'); const st=fs.readFileSync('src/world/stone.js','utf8'), wd=fs.readFileSync('src/world/wonders.js','utf8'), pr=fs.readFileSync('src/world/props.js','utf8'), hz=fs.readFileSync('src/world/horizon.js','utf8'), tl=fs.readFileSync('tools/ground-photos.mjs','utf8'), C=await import('./config.js');
  ok(/export function stoneMat/.test(st) && /export function worldUV/.test(st) && /export function pyramidGeos/.test(st) && /sd % 2 \? core : w/.test(st) && /P\.capFrom/.test(st), 'pyramid: courses of photo limestone, ragged edge strips that never overlap at the corners, a smooth casing cap');
  ok(/pyramidGeos\(x, z, s, cap, Math\.random\)/.test(wd) && /stoneMat\('large_sandstone_blocks'\)/.test(wd), 'the Giza wonder builds its pyramids from it');
  ok(/export function stoneTriMat/.test(st) && /stoneTriMat\(bn==='CITY'\?'cracked_concrete':'rock_face', bn\)/.test(pr) && /export function hillDetail/.test(st) && /hillDetail\(new THREE\.MeshLambertMaterial/.test(hz), 'boulders take the triplanar rock face; the far ranges take photo detail fading with the haze');
  ok(/GROUND_PHOTO\.extra/.test(tl) && C.GROUND_PHOTO.extra.every(n=>fs.existsSync('assets/ground/'+n+'/diff.jpg')) && C.STONE.pyramid.tile>0, 'the stone and aerial sets ship with the ground sets'); }

// Z260 trees: recursive limbs, more variants per species, ancient giants with solid trunks, snowy spruce in the merged Arctic, trees in citadel and ruins
{ const fs=await import('node:fs'); const fl=fs.readFileSync('src/world/flora.js','utf8');
  ok(/function branch\(P, p0, dir, len, r0, depth/.test(fl) && /branch\(P, end\.clone\(\)/.test(fl) && /vars\('bl2', MOBILE\?4:8/.test(fl) && /vars\('con'\+\(snow\?1:0\), MOBILE\?3:6/.test(fl), 'broadleaf trees grow recursive limbs; eight / six random variants a species');
  ok(/const ancient=\(\)=>vars\('anc'/.test(fl) && /buttress roots/.test(fl) && /if\(opt\.fixed\) blocks\.push/.test(fl) && /blocks\[i\]\.kind==='trunk'\) blocks\.splice/.test(fl), 'ancient giants: buttress roots, spreading limbs, a trunk that stops tanks, cleared with the flora');
  ok(/n==='ARCTIC'\)\{ plant\(conifer\(true\)/.test(fl) && /n==='CITADEL'\)\{ plant\(ancient\(\)/.test(fl) && /n==='RUINS'\)\{ plant\(ancient\(\)/.test(fl) && /n==='MEADOW'\)\{ plant\(ancient\(\)/.test(fl), 'giants on the meadow, the citadel, the ruins and the quarry; spruce in the Arctic'); }

// Z261 shatter: a destroyed prop breaks into pieces of its own mesh (clustered triangles), thrown, bouncing, settling, sinking; capped
{ const fs=await import('node:fs'); const sh=fs.readFileSync('src/fx/shatter.js','utf8'), cv=fs.readFileSync('src/world/cover.js','utf8'), lp=fs.readFileSync('src/game/loop.js','utf8'), C=await import('./config.js');
  ok(/export function cutGeometry/.test(sh) && /relax: even, chunky pieces/.test(sh) && /export function shatter/.test(sh) && /DoubleSide/.test(sh) && /LIVE\.length >= cap/.test(sh) && /s\.v\.y = -s\.v\.y \* s\.bounce/.test(sh), 'shatter: own-mesh pieces, two-sided, capped, bounce and settle');
  ok(/shatter\(b\.mesh, \{ \.\.\.SHATTER\.kinds\[b\.kind\], solid:solidKind\(b\.kind\) \}\); scene\.remove\(b\.mesh\); const i=blocks\.indexOf\(b\)/.test(cv) && /clearShatter\(\); for\(const b of blocks\)/.test(cv) && /export function buildBlocks\(\)\{\n  clearShatter\(\)/.test(cv) && /updateShatter\(dt\)/.test(lp), 'every destroyed cover piece and rock breaks apart; cleared with the blocks');
  ok(C.SHATTER.kinds.drums.fire && C.SHATTER.kinds.tires.bounce>C.SHATTER.bounce && C.SHATTER.maxMobile<C.SHATTER.max, 'fuel drums throw burning pieces, tyres bounce, fewer pieces on phones'); }

// Z262 trees fall for real: tanks, shells and blasts fell them with a gravity topple
{ const fs=await import('node:fs'); const tf=fs.readFileSync('src/world/tree-fall.js','utf8'), dc=fs.readFileSync('src/world/decor.js','utf8'), lo=fs.readFileSync('src/combat/lock-on.js','utf8'), sp=fs.readFileSync('src/combat/spells.js','utf8');
  ok(/export function fellTree/.test(tf) && /F\.g \/ \(f\.h \* F\.cg\) \* Math\.sin\(f\.th\)/.test(tf) && /export function shotTree/.test(tf) && /export function blastTrees/.test(tf) && /function impact/.test(tf), 'tree fall: gravity topple about the foot, crown strike, bounce, settle');
  ok(/fellTree\(c, dx, dz, TREEFALL\.push\)/.test(dc) && /shotTree\(b\.x, b\.z, b\.by, b\.vx, b\.vz\)/.test(lo) && /blastTrees\(x, z, r\)/.test(sp), 'rammed, shot through or blasted, a tree goes down the right way'); }

// Z263 photographed grass + no-tile ground: scanned grass clump cards, stochastic photo sampling, the base set at 2K on desktops
{ const fs=await import('node:fs'); const gc=fs.readFileSync('src/world/grass-carpet.js','utf8'), gd=fs.readFileSync('src/world/ground.js','utf8'), gp=fs.readFileSync('src/world/ground-photo.js','utf8'), C=await import('./config.js');
  ok(/aRect/.test(gc) && /alphaMap:alpha/.test(gc) && /vMapUv = aRect\.xy \+ uv \* aRect\.zw/.test(gc) && /normal = normalize\(\(viewMatrix \* vec4\(0\.0, 1\.0, 0\.0, 0\.0\)\)\.xyz\)/.test(gc) && C.GRASS.cards.length===5 && fs.existsSync(C.GRASS.dir+'alpha.jpg') && fs.existsSync(C.GRASS.dir+'dry.jpg'), 'grass: five photographed clumps cut by their alpha, lit evenly on both faces, a dry version');
  ok(/vec4 ntTex\(sampler2D s, vec2 uv\)/.test(gd) && /textureGrad/.test(gd) && /ntTex\( normalMap, vNormalMapUv \)/.test(gd) && /noTile\(sh\.fragmentShader\)/.test(gd), 'ground: stochastic no-tile lookup for colour, normal, roughness, AO');
  ok(/photoSet\(pair\[0\], GROUND_PHOTO\.hi && !MOBILE && \(GROUND_PHOTO\.hi2k \|\| \[\]\)\.includes\(pair\[0\]\)\)/.test(gp) && Object.values(C.GROUND_PHOTO.biomes).every(p=>fs.existsSync('assets/ground/'+p[1]+'/diff.jpg')) && ['MEADOW','SAVANNA','ARCTIC','VOLCANO','QUARRY','CITY','CITADEL','RUINS','DESERT','FOUNDRY'].every(b=>{ const s=C.GROUND_PHOTO.biomes[b][0]; return !fs.existsSync('assets/ground/'+s+'/2k/diff.jpg') || C.GROUND_PHOTO.hi2k.includes(s); }), 'every battlefield has its sets on disk; a base set with its 2K maps on disk loads them (Z394: the richer sets swapped in have only 1K)'); }

// Z264 photo skins + the real city: fortress / Core walls and camps in photographed sets; Meshy buildings cut into breakable floors, Meshy cars, photo streets, a real skyline
{ const fs=await import('node:fs'); const rg=fs.readFileSync('src/world/regional.js','utf8'), cp=fs.readFileSync('src/world/camps.js','utf8'), ct=fs.readFileSync('src/world/city.js','utf8'), cr=fs.readFileSync('src/world/cars.js','utf8'), rc=fs.readFileSync('src/world/real-city.js','utf8'), hz=fs.readFileSync('src/world/horizon.js','utf8'), st=fs.readFileSync('src/world/stone.js','utf8'), bg=fs.readFileSync('src/game/boot-gate.js','utf8'), C=await import('./config.js');
  ok(/function skinWall/.test(rg) && /skinWall\(m, st/.test(rg) && /const rep=4\/\(Z\[set\]\|\|2\)/.test(rg) && /function skinCamp/.test(cp) && Object.values(C.WALLSKIN.pat).every(n=>fs.existsSync('assets/ground/'+n+'/diff.jpg')), 'walls and camps take photographed skins at the walls\' 4 m tile');
  ok(/export function floorBands/.test(rc) && /function meshyBuilding/.test(ct) && /floorPiece\(Bd, y0\+H\*i\/n/.test(ct) && /realOrWait\('tower'/.test(ct) && /realOrWait\('apartment'/.test(ct) && /realOrWait\('row'/.test(ct), 'Meshy buildings join the breakable-floor system, one slice a floor');
  ok(/function drawReal/.test(cr) && /carModel\(m\.name\)/.test(cr) && /streetSurface\(new THREE\.MeshStandardMaterial/.test(ct) && /function realSkyline/.test(hz) && /loadRealCity\(\)/.test(bg), 'Meshy cars, photographed asphalt and paving, a skyline of real towers, loaded from boot');
  ok(Object.keys(C.REALCITY.blds).concat(Object.keys(C.REALCITY.cars)).every(k=>fs.existsSync('assets/models/real/city/'+k+'.glb') && fs.statSync('assets/models/real/city/'+k+'.glb').size<2.5e6), 'the city models ship (≤2.5 MB each)'); }

// Z265 real streets: photographed 2K asphalt with wheel paths, oil, gutters, repairs, cracks, worn paint and sky-mirror puddles; paving; street ironwork
{ const fs=await import('node:fs'); const st=fs.readFileSync('src/world/stone.js','utf8'), ct=fs.readFileSync('src/world/city.js','utf8'), C=await import('./config.js');
  ok(/export function streetSurface/.test(st) && /ssWheel = exp/.test(st) && /float oil = /.test(st) && /float gut = /.test(st) && /patchK/.test(st) && /float crack/.test(st) && /ssPud = smoothstep/.test(st) && /roughnessFactor = mix\(roughnessFactor, 0\.04, ssPud\)/.test(st) && /textureGrad/.test(st), 'street shader: wheel paths, oil, gutters, patches, cracks, worn paint, mirror puddles, no repeats');
  ok(/roadMat=\(\)=>streetSurface/.test(ct) && /bvdMat=\(\)=>streetSurface/.test(ct) && /walkMat=\(\)=>streetSurface/.test(ct) && /zebMat=\(\)=>streetSurface/.test(ct), 'roads, boulevards, zebras and pavements all take it');
  ok(/function drawFixtures/.test(ct) && /k:'mh'/.test(ct) && /k:'dr'/.test(ct) && C.STREET.wet>0, 'manhole covers down the lanes, drain grates at the kerbs'); }

// Z266 the whole city in real models: every lot Meshy (towers, apartments / offices, townhouse rows, French villas), street trees and palms as Meshy species
{ const fs=await import('node:fs'); const ct=fs.readFileSync('src/world/city.js','utf8'), rt=fs.readFileSync('src/world/real-trees.js','utf8'), bg=fs.readFileSync('src/game/boot-gate.js','utf8'), C=await import('./config.js');
  ok(C.REALCITY.share===1 && /realOrWait\('villa'/.test(ct) && /function flushPending/.test(ct) && /loadRealCity\(\)\.then\(\(\)=>\{[^}]*flushPending\(\)/.test(ct) && C.REALCITY.blds.bld_villa && C.REALCITY.blds.bld_office && C.REALCITY.blds.bld_shoprow2, 'every lot takes a Meshy building (villa, office and a second townhouse row added)');
  ok(/export function trackTrees/.test(rt) && /trackTrees\(im\)/.test(ct) && /TREES\.push\(c\)/.test(ct) && C.REALTREE.map.CITY && /loadRealTrees\(\)/.test(bg), 'street trees and palms become Meshy species, sway, and fall; the species load from boot'); }

// Z267 no blocky stand-ins: a lot waits for its Meshy building, the Meshy supertall as the city's wonder, real street furniture (Poly Haven scans + Meshy)
{ const fs=await import('node:fs'); const ct=fs.readFileSync('src/world/city.js','utf8'), rc=fs.readFileSync('src/world/real-city.js','utf8'), wd=fs.readFileSync('src/world/wonders.js','utf8'), bg=fs.readFileSync('src/game/boot-gate.js','utf8'), md=fs.readFileSync('src/actors/models.js','utf8'), C=await import('./config.js');
  ok(/function realOrWait/.test(ct) && /PENDING\.push/.test(ct) && /CITY_GEN\+\+; \}/.test(ct) && /!anchor\.parent/.test(ct) && /loadRealCity\(\)/.test(bg), 'a lot waits for its Meshy building instead of a procedural block; nothing late lands in a battlefield that replaced the city');
  ok(C.REALCITY.blds.bld_landmark && C.REALCITY.blds.bld_landmark.role==='landmark' && /REAL_CITY\.bld_landmark/.test(wd) && C.REALCITY.landmarkH>=100 && fs.existsSync('assets/models/real/city/bld_landmark.glb'), 'the city wonder is a Meshy supertall');
  ok(/function prepProp/.test(rc) && /export const cityProp/.test(rc) && /Object\.keys\(REALCITY\.props\)/.test(md) && /function placeProps/.test(ct) && /function dressPoles/.test(ct) && ['prop_gate','city_fountain','city_stall','prop_bench','prop_bin','prop_hydrant','prop_cafe','prop_barrier','prop_tarpcar','prop_chair'].every(k=>ct.includes("prop('"+k+"'")) && /stoneMat\('t_concrete_wall_002'\)/.test(ct), 'street furniture, gates, fountains, stalls, lamp posts and signals take real models; villa walls are photographed concrete');
  ok(Object.keys(C.REALCITY.props).every(k=>fs.existsSync('assets/models/real/city/'+k+'.glb') && fs.statSync('assets/models/real/city/'+k+'.glb').size<1.5e6) && /export const PROPS/.test(fs.readFileSync('tools/city-props.mjs','utf8')), 'the furniture models ship (≤1.5 MB each), rebuilt by tools/city-props.mjs'); }

// Z268 the city alive: traffic (Tripo scooter + rigged xe-ôm driver baked seated, Meshy cars), Landmark 81 and Bitexco rebuilt from photos, a flat Saigon horizon
{ const fs=await import('node:fs'); const ct=fs.readFileSync('src/world/city.js','utf8'), tf=fs.readFileSync('src/world/traffic.js','utf8'), wd=fs.readFileSync('src/world/wonders.js','utf8'), hz=fs.readFileSync('src/world/horizon.js','utf8'), hub=fs.readFileSync('src/hub.js','utf8'), C=await import('./config.js');
  ok(/export async function buildTraffic/.test(tf) && /export function updateTraffic/.test(tf) && /export function trafficBlast/.test(tf) && /function aim\(bone/.test(tf) && /applyBoneTransform/.test(tf) && /traffic\.js/.test(hub) && /buildTraffic\(roads\)/.test(ct) && /trafficBlast\(x, z, r\)/.test(ct) && /updateTraffic\(dt\)/.test(ct), 'scooters with a seated rider and cars drive the streets, brake for the tank, wreck in blasts');
  ok(C.REALCITY.traffic.files.every(k=>fs.existsSync('assets/models/real/city/'+k+'.glb')) && C.REALCITY.skyline.every(t=>C.REALCITY.blds[t.k] && C.REALCITY.blds[t.k].role==='skyline') && /for\(const BC of REALCITY\.skyline\)/.test(wd) && C.REALCITY.landmarkSink>0 && fs.existsSync('assets/models/real/city/SOURCES.txt'), 'Landmark 81 from a photo (credited) with its skyline towers (Z420: the glass spire where the Bitexco stood, the Palmspire), the traffic models ship');
  ok(Array.isArray(C.REALCITY.flatHorizon) && /flatCity/.test(hz) && /function realSkyline\(R, H, fogC, mix, count, depth\)/.test(hz), 'a flat horizon of city fading into the haze, no peaks behind Saigon'); }

// Z269 the cyclo from a real photo: parked on the pavements and waiting at the markets
{ const fs=await import('node:fs'); const ct=fs.readFileSync('src/world/city.js','utf8'), C=await import('./config.js');
  ok(!C.REALCITY.props.prop_cyclo && !fs.existsSync('assets/models/real/city/prop_cyclo.glb') && !/prop_cyclo/.test(ct), 'Z333 the cyclo is gone from the pavements and the markets'); }

// Z270 app-driver liveries (green / yellow / teal on an electric scooter, plain jackets), head and tail lamps, the field HQ at the heart of our base
{ const fs=await import('node:fs'); const tf=fs.readFileSync('src/world/traffic.js','utf8'), co=fs.readFileSync('src/actors/core.js','utf8'), md=fs.readFileSync('src/actors/models.js','utf8'), C=await import('./config.js');
  ok(/function livery\(tex, L\)/.test(tf) && /function lampGeo/.test(tf) && /lm\.instanceMatrix = im\.instanceMatrix/.test(tf) && C.REALCITY.traffic.liveries.length>=5 && C.REALCITY.traffic.liveries.some(l=>l.bike==='moto_escooter') && fs.existsSync('assets/models/real/city/moto_escooter.glb'), 'riders in app-driver greens, yellows and teals (no brand marks), lamps that light at dusk');
  ok(/function dressCore\(c\)/.test(co) && /loadGLTF\('camp_hq'\)/.test(co) && /camp_hq/.test(md) && C.REALCAMP.hq.w>=15 && fs.existsSync('assets/models/real/camp/hq.glb') && fs.statSync('assets/models/real/camp/hq.glb').size<2.5e6, 'our base centre is a real fortified field headquarters'); }

// Z271 seated on the street: vehicles and props lifted onto the raised road / pavement, soft contact shadows on the vehicles' own matrices
{ const fs=await import('node:fs'); const cr=fs.readFileSync('src/world/cars.js','utf8'), tf=fs.readFileSync('src/world/traffic.js','utf8'), ct=fs.readFileSync('src/world/city.js','utf8'), C=await import('./config.js');
  ok(C.REALCITY.lift.road>0.04 && C.REALCITY.lift.walk>0.12 && /export function contactShadow/.test(cr) && /im\.instanceMatrix=matrix/.test(cr) && /contactShadow\(q\.size/.test(tf) && /REALCITY\.lift\.prop/.test(ct) && /REALCITY\.lift\.road-\(o\.sink\|\|0\)/.test(cr), 'cars, bikes and street furniture stand on the road and pavement, with contact shadows'); }
// Z272 real aircraft: Tripo gunship, swallow-wing bomber, heavy transport, sci-fi UAV, paratrooper canopies — fitted into the procedural airframes, rotors still spinning
{ const fs=await import('node:fs'); const ra=fs.readFileSync('src/actors/real-air.js','utf8'), C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8');
  ok(/export function realAir\(g, k\)/.test(ra) && /cutRotor/.test(ra) && /keepAbove/.test(ra) && /realAir\(g, 'heli_attack'\)/.test(R('src/actors/vehicles.js')) && /realAir\(g, 'heli_swallow'\)/.test(R('src/actors/helis.js')) && /realAir\(g, 'heli_bomber'\)/.test(R('src/actors/paradrop.js')) && /realAir\(g, 'para_trooper'\)/.test(R('src/actors/paradrop.js')) && /realAir\(g, 'air_uav'\)/.test(R('src/actors/drone.js')), 'every airframe and canopy takes its real model');
  ok(Object.keys(C.REALAIR.models).every(k=>fs.existsSync('assets/models/real/air/'+k+'.glb') && fs.statSync('assets/models/real/air/'+k+'.glb').size<1.5e6) && /loadRealAir\(\)/.test(R('src/game/boot-gate.js')), 'the aircraft models ship and load at boot'); }
// Z273 the compound in concrete: blast-wall sections and guard towers round the HQ, guns / flags / collision unchanged
{ const fs=await import('node:fs'); const cw=fs.readFileSync('src/world/core-walls.js','utf8'), C=await import('./config.js');
  ok(/function dressWalls\(g, spans, towers, hideMats\)/.test(cw) && /WSP\.push\(\[cx,cz,len,ry\]\)/.test(cw) && /TWR\.push\(\[x,z,h,ry\|\|0\]\)/.test(cw) && C.REALCAMP.walls && ['base_wall','base_tower'].every(k=>fs.existsSync('assets/models/real/camp/'+k+'.glb')), 'the base walls and towers are concrete models'); }

// Z274 the first Tripo trees: oak, coconut palm and Scots pine replace their Meshy versions (open crowns of leaf clusters, real bark)
{ const fs=await import('node:fs'); ok(['oak','palm','pine'].every(k=>{ const f='assets/models/real/tree/'+k+'.glb'; return fs.existsSync(f) && fs.statSync(f).size<1.5e6; }) && /Z274/.test(fs.readFileSync('DOCS.md','utf8')), 'oak, palm and pine are the Tripo trees'); }

// Z275 all thirteen tree species are Tripo models · Z276 light shafts through the sun's shadow map, leaves and grass glowing against the sun · Z277 ruins of war
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8');
  ok(Object.keys(C.REALTREE.h).every(k=>fs.existsSync('assets/models/real/tree/'+k+'.glb')), 'every tree species ships');
  ok(/export function makeShaftPass/.test(R('src/render/shafts.js')) && /unpackRGBAToDepth/.test(R('src/render/shafts.js')) && /composer\.insertPass\(shaftPass, 1\)/.test(R('src/render/renderer.js')) && C.SHAFTS.on && /uSunView/.test(R('src/world/real-trees.js')) && /uSunView/.test(R('src/world/grass-carpet.js')), 'light shafts on every battlefield; backlit leaves and grass');
  ok(/export function buildRuins/.test(R('src/world/ruins3d.js')) && /buildRuins\(\)/.test(R('src/world/landmarks.js')) && Object.keys(C.REALRUIN.models).every(k=>fs.existsSync('assets/models/real/ruin/'+k+'.glb')) && Object.keys(C.REALRUIN.biomes).length>=8, 'ruins of war on the open battlefields, with collision'); }

// Z278 sharper and livelier: full anisotropy on every texture, a denser grass carpet, dust glinting in the sunlight
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8');
  ok(/THREE\.Texture\.DEFAULT_ANISOTROPY/.test(R('src/render/renderer.js')) && C.GRASS.perCell>=3 && /export function initDust/.test(R('src/fx/dust.js')) && /initDust\(\)/.test(R('src/game/boot-gate.js')) && C.DUST.on, 'sharp textures, dense grass, sunlit dust'); }

// Z279 colossal forts: each battlefield's forts in a Tripo style (granite citadel, desert kasbah, arctic ice, volcanic obsidian), wall sections still fall one by one
{ const fs=await import('node:fs'); const C=await import('./config.js'), F=fs.readFileSync('src/world/fortress.js','utf8');
  ok(/function dressFort\(f, stone\)/.test(F) && /dressFort\(f, wall\)/.test(F) && /function sliceX\(g, x0, x1, mid\)/.test(F) && /f\.wallSl\[pc\.i\]/.test(F) && !/discard/.test(F) && ['citadel','desert','arctic','volcano'].every(st=>['wall','tower','gate'].every(p=>fs.existsSync('assets/models/real/fort/fort_'+st+'_'+p+'.glb'))) && C.REALFORT.biomes.CITADEL, 'forts dressed in their battlefield style, destructible as before'); }

// Z280 windows at night on the Meshy buildings, the skyline and the two landmark towers
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8');
  ok(/export function windowLights/.test(R('src/world/city.js')) && /WIN_K\.value=NIGHT\.k/.test(R('src/world/landmarks.js')) && /windowLights\(mat\)/.test(R('src/world/horizon.js')) && /windowLights\(M\.mat\.clone\(\)\)/.test(R('src/world/wonders.js')) && C.REALCITY.windows.share>0, 'lit windows at night'); }

// Z281 the base's main gatehouse lowered, its short wall runs clipped not squeezed · Z282 the xe ôm / xích lô mode
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8');
  ok(/th=main\?H\+9:H\+7/.test(R('src/world/core-walls.js')) && /coreClip/.test(R('src/world/core-walls.js')), 'base walls: no squeezed runs, a sane gatehouse');
  ok(/export function buildBikeMount/.test(R('src/game/xeom.js')) && /export async function mountModel/.test(R('src/world/traffic.js')) && /makeCavPlayer\(kind\)/.test(R('src/game/cavalry.js')) && /if\(S\.bike\) return animateBike/.test(R('src/actors/horse.js')) && /xeom: +\{ nm:'XE ÔM'/.test(R('src/ui/setup-units.js')) && /MODE\.makePlayer\(cavKind\)/.test(R('src/game/flow.js')) && /makeCavPlayer\(kind\)/.test(R('src/game/mode.js')) && C.XEOM.xeom && !C.XEOM.xichlo, 'ride into battle on a xe ôm (Z332 the xích lô is gone)'); }

// Z283 every battlefield its own fort style: limestone castle, Roman, marble, dry-stone, industrial joined the first four
{ const fs=await import('node:fs'); const C=await import('./config.js');
  ok(['meadow','ruins','quarry','savanna','foundry'].every(st=>['wall','tower','gate'].every(p=>fs.existsSync('assets/models/real/fort/fort_'+st+'_'+p+'.glb'))) && C.REALFORT.biomes.SAVANNA==='savanna' && C.REALFORT.biomes.FOUNDRY==='foundry', 'nine fort styles'); }

// Z284 real wonders · Z285 enemy outposts round the forts
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8');
  ok(Object.values(C.REALWONDER.biomes).every(k=>fs.existsSync('assets/models/real/wonder/'+k+'.glb')) && /function dressWonder/.test(R('src/world/wonders.js')) && /dressWonder\(g, m\)/.test(R('src/world/wonders.js')), 'four real wonders fitted over the old ones');
  ok(fs.existsSync('assets/models/real/wonder/'+C.REALWONDER.windmill.key+'.glb') && C.REALWONDER.windmill.h>20 && /dressWindmills\(g, w, windmills\(w\)\)/.test(R('src/world/wonders.js')) && /WONDER\.spin\.splice/.test(R('src/world/wonders.js')), 'Z410 MEADOW\'s windmills as the real model (still sails), the hand-built ones only as a fallback');
  ok(Object.keys(C.OUTPOST.size).every(k=>fs.existsSync('assets/models/real/camp/'+k+'.glb')) && /export function buildOutpost/.test(R('src/world/outposts.js')) && /buildOutpost\(f\)/.test(R('src/world/fortress.js')) && /!o\.userData\.outpost/.test(R('src/world/fortress.js')), 'enemy camps round the forts, kept visible when the fort dresses'); }

// Z286 real wildlife, rigged and walking
{ const fs=await import('node:fs'); const C=await import('./config.js'), w=fs.readFileSync('src/actors/wildlife.js','utf8');
  ok(Object.keys(C.REALWILD.h).every(k=>fs.existsSync('assets/models/real/wild/'+k+'.glb')) && /function dressWild/.test(w) && /AnimationMixer/.test(w) && /a\.mix\.update/.test(w), 'six real animals walk their own cycle in the herds'); }

// Z287 grades of their own for meadow / hills / village, cỏ lau on the hills and meadow, lamp pools at night
{ const fs=await import('node:fs'); const C=await import('./config.js'), W=await import('./src/data/world.js'), R=f=>fs.readFileSync(f,'utf8');
  ok(JSON.stringify(W.ATMOS.MEADOW.hi)!==JSON.stringify(W.ATMOS.HILLS.hi) && JSON.stringify(W.ATMOS.HILLS.hi)!==JSON.stringify(W.ATMOS.VILLAGE.hi), 'meadow, hills and village each graded their own way');
  ok((R('src/world/flora.js').match(/reedPlume\(\), N\(/g)||[]).length>=3 && /function lampPools/.test(R('src/world/city.js')) && /POOL_K\.value=NIGHT\.k/.test(R('src/world/landmarks.js')) && C.REALCITY.pools.r>0, 'cỏ lau in three battlefields, warm pools under the street lamps'); }

// Z288 the city opens on film: Landmark 81 tilt-up, a boulevard tracking shot
{ const fs=await import('node:fs'); const C=await import('./config.js'), i=fs.readFileSync('src/game/intro.js','utf8');
  ok(C.INTRO_CITY.on && /function cityShots/.test(i) && /function streetShot/.test(i) && /function playShot/.test(i) && /updateTraffic\(dt\); \}/.test(fs.readFileSync('src/game/loop.js','utf8')), 'city intro: two cut shots before the grand tour, traffic moving'); }

// Z289 no black shards: weak normals repaired on load; skyline spread evenly
{ const fs=await import('node:fs'); const m=fs.readFileSync('src/actors/models.js','utf8'), h=fs.readFileSync('src/world/horizon.js','utf8');
  ok(/export function fixNormals/.test(m) && /fixNormals\(o\.geometry\)/.test(m) && (h.match(/\(i\+0\.15\+Math\.random\(\)\*0\.7\)\/n/g)||[]).length===2, 'weak normals fixed on load, skyline towers spread round the ring'); }

// Z290 rolling wheels in the city traffic · Z291 military vehicles parked in the enemy camps
{ const fs=await import('node:fs'); const C=await import('./config.js'), t=fs.readFileSync('src/world/traffic.js','utf8');
  ok(/function wheelGeo/.test(t) && /function wheelMat/.test(t) && /aRoll/.test(t) && C.REALCITY.traffic.wheel.length===2, 'traffic wheels roll with the distance driven');
  ok(C.OUTPOST.veh.every(k=>fs.existsSync('assets/models/real/camp/'+k+'.glb') && C.OUTPOST.size[k] && C.OUTPOST.solid.includes(k)) && /C\.nVeh/.test(fs.readFileSync('src/world/outposts.js','utf8')), 'trucks, APCs and jeeps parked in every enemy camp'); }

// Z292 phones load light trees, fort pieces and city buildings; block skyline on phones
{ const fs=await import('node:fs'); const C=await import('./config.js'), m=fs.readFileSync('src/actors/models.js','utf8');
  ok(C.PHONE_LOD.on && Object.keys(C.REALTREE.h).every(k=>fs.existsSync('assets/models/real/tree/m/'+k+'.glb')) && ['citadel','desert','arctic','volcano','meadow','ruins','quarry','savanna','foundry'].every(st=>['wall','tower','gate'].every(p=>fs.existsSync('assets/models/real/fort/m/fort_'+st+'_'+p+'.glb'))) && C.PHONE_LOD.city.every(k=>fs.existsSync('assets/models/real/city/m/'+k+'.glb')), 'every phone model is there');
  ok(/PHONE && PHONE_LOD\.trees/.test(m) && /PHONE && PHONE_LOD\.forts/.test(m) && /PHONE_LOD\.city\.includes/.test(m) && /realCityReady\(\) && !MOBILE/.test(fs.readFileSync('src/world/horizon.js','utf8')) && /--thin/.test(fs.readFileSync('tools/city-props.mjs','utf8')), 'phones take the light copies'); }

// Z293 the war rides: xe ôm, xích lô, ba gác, pickup — real models, the soldier seated / standing in his true place
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8');
  ok(['xeom','bagac','bantai'].every(k=>fs.existsSync('assets/models/real/ride/'+k+'.glb') && C.XEOM[k].len>1 && C.XEOM.poses[C.XEOM[k].pose]) && /function heroGeo/.test(R('src/game/xeom.js')), 'four ride models fitted to their true length');
  ok(/function seatRider/.test(R('src/game/cavalry.js')) && !/G\.scale\.setScalar\(HUMAN_SCALE\/HORSE\.size\);\s*H\.root/.test(R('src/game/cavalry.js')) && /XEOM\.poses\[XEOM\[H\.bike\]\.pose\]/.test(R('src/actors/general.js')) && /'bagac','bantai'/.test(R('src/game/flow.js')) && /BÁN TẢI/.test(R('src/ui/setup-units.js')), 'seated / standing poses, remount keeps the seat, two new rides to pick'); }

// Z294 the second soldier: a detailed special-forces model wearing the operator's moves (puppet), on every war ride and on foot
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8');
  ok(fs.existsSync('assets/models/real/soldier2.glb') && /export function makePuppet/.test(R('src/actors/puppet.js')) && /export function drivePuppet/.test(R('src/actors/puppet.js')) && /drivePuppet\(R\.pup\)/.test(R('src/actors/real-cav.js')) && C.REALCAV.s2.on, 'the special-forces soldier follows the operator bone by bone');
  ok(/CV\.realP=null; fitRealCav\(CV\)/.test(R('src/game/cavalry.js')) && /if\(!H\.bike\)\{/.test(R('src/actors/real-cav.js')) && /PROFILE\.trooper = k/.test(R('src/ui/setup-units.js')), 'real riders on the war rides, soldier picked in battle setup'); }

// Z295 the infantry arsenal and the pose review: nine hand weapons, kneeling aim, feet on the ground, getting on / off a ride for real
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8');
  ok(Object.keys(C.INFGUN.guns).length===16 && Object.keys(C.INFGUN.guns).every(k=>fs.existsSync('assets/models/real/gun/inf/'+k+'.glb')) && Object.values(C.INFGUN.map).every(k=>C.INFGUN.guns[k]) && /function holdGun/.test(R('src/actors/real-cav.js')), 'nine infantry weapons (Z355 twelve, Z387 sixteen), one for every gun of the game, swapped with the gun in use');
  ok(/'Kneeling_Aim'/.test(R('src/actors/real-cav.js')) && /P\.ground/.test(R('src/actors/puppet.js')) && /XEOM\.pegY/.test(R('src/game/cavalry.js')) && C.CAV.mountT>=0.8 && ['xeom','bagac','bantai'].every(k=>C.XEOM[k].side>0), 'kneeling aim, grounded feet, a real step off / onto each ride'); }

// Z296 the driver: his own rigged man riding his own machine — IK hands / feet / hips, lean, wheelie, weave, throttle, gears, ducking, crash → up → lift → back on, the talk table
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), d=R('src/actors/driver.js');
  ok(['export function makeDriver','export function driveDriver','function ik2','function ridePose','function crashStep','export function bikeCrash','export function bikeWheelie','export function rideHit','export const RIDE_VOICE'].every(k=>d.includes(k)), 'driver module: IK riding pose, actions, crash sequence, voice hook');
  ok(['xeom','bagac'].every(k=>C.RIDE.fit[k] && C.RIDE.model[k]) && C.RIDE.fit.xeom.wheelie && ['start','wheelie','underfire','crash','getup','lift','remount'].every(e=>C.RIDE_TALK[e] && C.RIDE_TALK[e].d.length && C.RIDE_TALK[e].s.length), 'every ride fitted, the xe ôm wheelies, every event has both voices');
  ok(/bikeWheelie\(CV\.H\)/.test(R('src/game/cavalry.js')) && /rideBump\(-vn\)/.test(R('src/game/cavalry.js')) && /rideHit\(dmg(, dx, dz)?\)/.test(R('src/game/player-damage.js')) && /driveDriver\(H, dt, v, yawRate\)/.test(R('src/game/xeom.js')) && /H\.drv\.onCrash/.test(R('src/game/cavalry.js')), 'Space wheelies, crashes and hits reach the driver, the soldier jumps clear and is called back'); }

// Z297 the gun first, the hands onto it, recoil straight back along the bore
{ const fs=await import('node:fs'); const C=await import('./config.js'), r=fs.readFileSync('src/actors/real-cav.js','utf8');
  ok(/function holdReal/.test(r) && /ik2\(D\.RightArm/.test(r) && /ik2\(D\.LeftArm/.test(r) && /curlHand\(D, 'Right', 0\.85, grip, 0, 0\.35\)/.test(r) && /addScaledVector\(_gx, rc\.z\)/.test(r), 'the gun laid along the aim, hands IK onto grip and handguard, kick straight back');
  ok(Object.keys(C.INFGUN.guns).every(k=>C.GUNHOLD[k] && C.GUNHOLD[k].butt && C.GUNHOLD[k].grip && C.GUNHOLD[k].fore && C.GUNHOLD[k].kick) && C.GUNHOLD.rpg.hold==='top' && C.GUNHOLD.minigun.hold==='hip', 'every weapon has its butt, grip, handguard, kick and hold'); }

// Z298 real wheels, the reload drill
{ const fs=await import('node:fs'); const C=await import('./config.js'), x=fs.readFileSync('src/game/xeom.js','utf8'), r=fs.readFileSync('src/actors/real-cav.js','utf8');
  ok(/function cutWheels/.test(x) && /function realWheel/.test(x) && /function buildWheels/.test(x) && ['xeom','bagac'].every(k=>C.XEOM[k].wheels && C.XEOM[k].wheels.every(w=>w.c.length===3 && w.r>0.1 && Math.abs(w.c[1]-w.r)<0.01)), 'model wheels cut, real tyres/rims/spokes built, every wheel standing on the ground');
  ok(C.GUNHOLD.reload && C.GUNHOLD.reload.min>0 && /inst\.rD >= RL\.min/.test(r) && /RL\.drop/.test(r) && /turnBone\(D\.Neck/.test(r), 'the reload drill plays only when there is time for it'); }

// Z299 parts, suspension, riders moving with the ride
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), x=R('src/game/xeom.js'), d=R('src/actors/driver.js'), r=R('src/actors/real-cav.js'), cv=R('src/game/cavalry.js');
  ok(/function splitBar/.test(x) && /function suspension/.test(x) && /B\.add\(body\)/.test(x) && /H\.toWorld = /.test(x) && /setFromAxisAngle\(H\.axis, H\.steer\)/.test(x) && C.XEOM.sus && C.XEOM.xeom.steer && C.XEOM.bagac.steer, 'wheels unsprung on B, the body sprung, the steering head split off and turned about its raked axis');
  ok(/onRide\(H, R\.grip\[i\], _a, true\)/.test(d) && /\(H\.body \|\| H\.B\)\.add\(w\)/.test(d) && /I\.acc \* Z\.acc/.test(d) && C.RIDE.sway && C.RIDE.sway.glance, 'the driver rides the sprung body, his hands on the turning bars, his trunk thrown by the ride, glancing about');
  ok(/function rideSway/.test(r) && /R\.op\.rotation\.y = R\.opRY \+ R\.hy/.test(r) && /gy \+ hy \+ clamp\(dyw - hy/.test(r) && C.REALCAV.seatTurn && C.REALCAV.sway && /ride: CV\.mounted && CV\.H\.inert/.test(cv) && /\(H\.bike && H\.body \|\| H\.B\)\.add\(G\)/.test(cv), 'the soldier swings his hips round on the seat, his head leads, his trunk sways with the ride'); }

// Z300 seated true, feet on the real ground, the racer's dab, dodging, wheels on the terrain
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), d=R('src/actors/driver.js'), x=R('src/game/xeom.js'), cv=R('src/game/cavalry.js');
  ok(/function flatFoot/.test(d) && /heightAt\(_c\.x, _c\.z\) \+ D\.ankle/.test(d) && /D\.fdab\[i\]/.test(d) && C.RIDE.feet && C.RIDE.feet.dabV>0 && C.RIDE.fit.xeom.hip[1]>0.38, 'hips above the seat, both feet planted on the real ground when stopped, the inside foot out in a hard bend');
  ok(/turn\(B\[n\], RIGHT, -bend \/ 3\)/.test(d) && /D\.storm/.test(d) && /rideHit\(dmg, dx, dz\)/.test(R('src/game/player-damage.js')) && C.RIDE.dodge && C.RIDE.dodge.n>=2, 'bending to the bars leans him forward; a storm of fire has him ducked, face down and away, jinking');
  ok(/function groundFit/.test(x) && /function wheelDust/.test(x) && /T\.add\(B\)/.test(x) && /H\.lie = lie/.test(x) && /H\.lie\[D\.roll < 0/.test(d) && /if\(!H\.bike\)\{ H\.root\.position\.copy/.test(cv), 'the machine laid on the ground under its wheels; down on its side it lies on the ground; a ride works in its true place');
  ok(C.RIDE.h>=1.74 && C.RIDE.legK>1 && C.REALCAV.s2.k>1 && /endsWith\('\.scale'\)/.test(d), 'driver taller and longer in the leg, soldier a touch bigger'); }

// Z301 lamps on the ride, the riding camera
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), x=R('src/game/xeom.js'), u=R('src/game/update.js');
  ok(/function buildLamps/.test(x) && /function lampUpdate/.test(x) && /const par = H\.bar \|\| H\.body/.test(x) && /beamMat\(/.test(x) && C.XEOM.lamp && C.XEOM.lamp.brake > C.XEOM.lamp.run && C.XEOM.xeom.lamps && C.XEOM.bagac.lamps, 'headlamp in the steering head (its beam turns with the bars), tail lamp flaring under the brakes');
  ok(/function rideCam/.test(u) && /rideCam\(p, dt, now, g\)/.test(u) && C.CAM_FEEL.ride && C.CAM_FEEL.ride.bank > 0, 'the riding camera heaves, buzzes, banks and breathes with the throttle, scaled by the shake setting'); }

// Z302 cyclo steering, physical lean, passenger feet, tyre tracks, the bike's engine, day stages without night lights
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), x=R('src/game/xeom.js'), r=R('src/actors/real-cav.js'), e=R('src/audio/engine-music.js'), b=R('src/game/boot-gate.js');
  ok(/Math\.atan\(wb \/ \(Rt - w\.x \* XEOM\.k\)\)/.test(x) && C.XEOM.bantai.wheels.filter(w=>w.steer).length===2 && /Math\.atan\(v \* yawRate \/ 9\.81\)/.test(x), 'the bán tải steers Ackermann-true; two wheels lean as the bend asks (atan v·ω/g)');
  ok(/function seatFeet/.test(r) && C.XEOM.xeom.feet && /function tyreTrail/.test(x) && /MultiplyBlending/.test(x), 'passenger feet on the pegs; tyre tracks laid on the ground');
  ok(/function updateBikeEngine/.test(e) && /updateBikeEngine\(dt, p, t\)/.test(e) && C.RIDE.gears.length===3 && C.RIDE.gears[2] < 7.7, 'the ride has its own single-cylinder engine through all four gears');
  ok(/wasN=NIGHT\.on/.test(b) && /setNightLights\(wasN\)/.test(b), 'the warm-up puts back the stage\'s own day / night lights'); }

// Z303 walk away / call the ride / a broken ride; no spinning riders
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), w=R('src/game/ride-wear.js'), cv=R('src/game/cavalry.js'), d=R('src/actors/driver.js'), r=R('src/actors/real-cav.js');
  ok(!/if\(d<=CAV\.mountR\) CV\.trans=\{ k:'on', t:0 \}; else \{ CV\.call=true; floatText\('BẤM G LÊN XE'/.test(cv) && /BÁC TÀI ĐANG CHỜ/.test(cv) && /callRide\(p\)/.test(cv), 'back up, the driver waits: no dragging aboard, no chasing; G climbs on or calls the ride');
  ok(['export function rideWear','export function rideBreak','export function rideFixed','export function rideSmoke','export function rideSpeedK'].every(k=>w.includes(k)) && C.XEOM.wear && C.XEOM.wear.hp.xeom>0 && /function fixPose/.test(d) && /else if\(D\.state === 'fix'\) fixStep/.test(d) && C.RIDE.fix && C.RIDE.fix.xeom && /rideSpeedK\(CV\.H\)/.test(cv), 'the ride wears, smokes, limps, breaks down and is repaired by the driver');
  ok(/R\.tu \+ Math\.atan2\(Math\.sin\(raw - R\.tu\)/.test(r) && /C\.aimRate \+ \(RT\.swing - C\.aimRate\)/.test(r) && /-rate \* dt, rate \* dt/.test(r) && /R\.step = \{ from/.test(r) && /dyw = R\.av \?\?/.test(r) && C.REALCAV.aimRate>0 && C.REALCAV.flip>0, 'the aim relative to the ride is unwrapped and swung at a human pace; standing riders step round'); }

// Z304 the chest turns with the aim, hands rolled onto what they hold, sitting tall, a man's running pace, the driver peeks between ducks
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), pu=R('src/actors/puppet.js'), ha=R('src/actors/hands.js'), r=R('src/actors/real-cav.js'), d=R('src/actors/driver.js'), cv=R('src/game/cavalry.js');
  ok(/function chestTwist/.test(pu) && /chestTwist\(S, D\)/.test(pu) && /export function rollHand/.test(ha) && /rollHand\(D, 'Right'/.test(r) && /rollHand\(B, L,/.test(d), 'the chest carries the twist; hands roll onto the grip, the handguard, the bar');
  ok(/function sitTall/.test(r) && C.REALCAV.sit && C.XEOM.xeom.seat[0] > 0.4 && C.CAV.foot.walk < 2 && C.CAV.foot.run < 5.5 && C.CAV.foot.sprint < 6.5 && C.CAV.foot.accel > 0 && /F\.accel:F\.decel/.test(cv) && /T\.to \|\| CV\.hPos/.test(cv), 'sat up straight on the pillion; on foot a man\'s pace with momentum; thrown clear on his own line');
  ok(/D\.peek = !D\.peek/.test(d) && C.RIDE.dodge.peek && C.RIDE.alert && C.RIDE.alert.snap > 5, 'under fire the driver ducks and bobs up to watch the road, eyes darting'); }

// Z305 the driver's mask: fitted to his own face, under the eyes, skinned to his skeleton, an elastic round each real ear
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), fm=R('src/actors/face-mask.js'), d=R('src/actors/driver.js'), hub=R('src/hub.js');
  ok(/export function fitFaceMask/.test(fm) && /new THREE\.SkinnedMesh\(/.test(fm) && /bind\(host\.skeleton/.test(fm) && /fitFaceMask\(D\.B\.Head/.test(d) && /actors\/face-mask\.js/.test(hub), 'the mask is read off his face and bound to his own skeleton');
  const M=C.RIDE.mask && C.RIDE.mask.drv_xeom; ok(M && M.top < 0.32 && M.top - M.dip < 0.27 && M.halfW < 0.36 && M.ear && M.ear.top < M.helmet && M.ear.lobe < M.ear.top && M.ear.back < M.ear.front, 'its top runs under his eyes (lower lids at 0.32), its sides stop on the cheeks; his ear sits under the helmet rim');
  ok(/upperHull\(rows\[j\]\)/.test(fm) && /G0\[k\] \+ lift/.test(fm) && /CatmullRomCurve3\(path/.test(fm) && !/earU/.test(fm) && !/__maskDbg/.test(fm), 'taut over the hollows, never puffed out; one elastic per side round the configured ear, not the helmet');
  ok(/export function outfitColor/.test(fm) && /function clothTexture/.test(fm) && /outfitColor\(ms,/.test(d) && M.wear && M.wear.fade > 0 && M.wear.grime > 0 && M.wear.creases > 0, 'made in his own shirt\'s colour, read off his texture, and painted worn: faded, dusty, grubby, creased'); }

// Z306 the ride rams traffic and animals, shot vehicles burn, the call-the-ride button; soldier mode fires its own rifle
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), tr=R('src/world/traffic.js'), im=R('src/game/ride-impact.js'), rc=R('src/game/ride-call.js'), cv=R('src/game/cavalry.js'), sf=R('src/combat/soldier-fire.js'), G=(await import('./src/data/guns.js')).GUNS;
  ok(['export function trafficShove','export function trafficBurn','export function trafficShot','export function trafficContacts'].every(k=>tr.includes(k)) && /p && MODE\.crushes && Math\.hypot/.test(tr) && /trafficShot\(b, dt\)/.test(R('src/combat/lock-on.js')) && C.REALCITY.traffic.hit.hp[0]>C.REALCITY.traffic.hit.hp[1], 'traffic: knocked over, halted, shot and burnt; only a tank flattens it; rounds strike it (swept)');
  ok(/export function rideImpacts/.test(im) && /trafficShove\(v, ux \* j \/ mv/.test(im) && /killWild\(a/.test(im) && /export function killWild/.test(R('src/actors/wildlife.js')) && /hullEach\(p, rideImpacts\)/.test(cv) && C.XEOM.impact.mass.bantai>1 && C.XEOM.wear.spill<C.XEOM.wear.crash, 'the ride: scooters go over, cars are shoved aside (Z320), animals are run down');
  ok(/export function callRide/.test(rc) && /export function rideCallUi/.test(rc) && /function hop\(p\)/.test(rc) && /callRide\(p\)/.test(cv) && /CV\.autoOn/.test(cv) && C.XEOM.call.farR>C.XEOM.call.dropR, 'call the ride: a button with the ETA, a call that waits for a repair, round by the streets when far; stay by a spill and climb back on');
  ok(G.carbine && G.carbine.trooper && !G.carbine.aoe && /inf:!g\.aoe/.test(sf) && /soldierFire\(now, range\)/.test(cv) && !/fireGun\(/.test(cv) && /p\.guns = trooperGuns\(\)/.test(R('src/game/mode.js')) && /trooperLoot/.test(R('src/loot/powerups.js')) && /soldierHitFX/.test(R('src/game/mode.js')), 'soldier mode: his own rifle and fire path, his own kit, loot and hit effect — not the tank\'s'); }

// Z307 soldier mode is a mode of its own: one object per mode, every soldier check asks MODE
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), md=R('src/game/mode.js'), ts=R('src/combat/trooper-spells.js');
  ok(/export const MODES = \{ tank:TANK, soldier:SOLDIER \}/.test(md) && /export function __set_MODE/.test(md) && /__set_MODE\(cavWanted \? MODES\.soldier : MODES\.tank\)/.test(R('src/game/flow.js')) && /MODE\.setupRun\(p\)/.test(R('src/game/flow.js')) && /MODE\.update\(gdt, now\)/.test(R('src/game/loop.js')), 'one mode at a time: its player, its run setup, its frame');
  ok(/MODE\.fire\(/.test(R('src/input/bindings.js')) && (R('src/input/input.js').match(/MODE\.fire\(/g)||[]).length===2 && /MODE\.hitTest\(p, _sw\.x/.test(R('src/combat/lock-on.js')) && /MODE\.rifleK\(\)/.test(R('src/combat/lock-on.js')) && /MODE\.hitTest\(p, r\.x/.test(R('src/actors/enemy-missiles.js')) && /MODE\.finalDeath\(p\)/.test(R('src/game/player-damage.js')), 'fire, hits on him and his last fall go through the mode');
  ok(/p\.maxHp = CAV\.soldier\.hp/.test(md) && !/applyUpgrades|applyTankKit|tankModel/.test(md.slice(md.indexOf('const SOLDIER'))) && C.CAV.soldier.rifleK>C.INFANTRY.vsArmour && /Math\.hypot\(x - p\.pos\.x, z - p\.pos\.z\) < p\.radius \+ r/.test(md), 'the soldier: his own health, none of the tank\'s progression, a man\'s outline hit at full rifle weight');
  ok(['grenade','smokeHand','medkit'].every(k=>ts.includes("id:'"+k+"'")) && /export function spellNow/.test(R('src/combat/spells.js')) && /MODE\.powerHud/.test(R('src/combat/power.js')) && /function man\(c, p, k, R\)/.test(R('src/ui/instruments.js')) && /MODE\.crushes/.test(R('src/world/decor.js')) && /MODE\.riders/.test(R('src/world/pow.js')) && /MODE\.fleeK/.test(R('src/actors/wildlife.js')), 'his skills, HUD, loot, no crushing, no riders, animals let him closer'); }

// Z309 a soldier's war: waves of men, armour as a set piece, a tank's shell as a warned burst
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), sw=R('src/campaign/soldier-war.js'), md=R('src/game/mode.js');
  ok(/if\(MODE\.waveQueue\) return MODE\.waveQueue\(stage, wave\)/.test(R('src/campaign/waves.js')) && /waveQueue\(stage, wave\)\{ return soldierWaveQueue/.test(md) && /\['rifle', w\.rifle\]/.test(sw) && /q\.push\(stage >= 4 \? 'heavy' : 'grunt'\)/.test(sw) && C.CAV.soldier.war.sizeK>1, 'soldier waves: men first, a tank last as a set piece, announced');
  ok(/MODE\.tankShell && def\.fireCd >= 1\.4 && MODE\.tankShell\(e, aimA, d, dmg/.test(R('src/ai/tactics.js')) && /makeArtLock\(tx, tz, R/.test(sw) && /s\.dud = true/.test(sw) && /if\(d < s\.R\) damagePlayer/.test(sw) && C.CAV.soldier.war.shell.lock>0.5, 'a tank\'s main gun on a soldier: a red ring while it lays, then a burst there — step out and it misses'); }

// Z308 hands on the real grips (back of the hand up, along a swept bar), the headlamp glow shaped and placed on the real glass
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), x=R('src/game/xeom.js'), d=R('src/actors/driver.js'), F=C.RIDE.fit;
  ok(F.xeom.grip[0][2] < 0.13 && F.xeom.grip[0][1] < 0.45 && F.bagac.grip[0][2] < 0.4 && F.bagac.grip[0][0] < 0.2 && F.bagac.sweep > 0 && /applyAxisAngle\(UP, \(i \? -1 : 1\) \* \(R\.sweep \|\| 0\)\)/.test(d), 'the hands close round the middle of each grip, knuckles following a swept bar');
  const L=C.XEOM.xeom.lamps; ok(L.lens && L.lens.top > L.lens.bot && L.head[1] > 0.44 && /function lensShape/.test(x) && /L\.lens \? lensShape\(L\.lens\)/.test(x) && /rotation\.x = -L\.lens\.tilt/.test(x), 'the headlamp glow fills the glass itself, its shape, its centre and its lean'); }

// Z313 shooting at helicopters in 3D: snap / cone lock, rounds lead and climb, the gun tips up, a ring and a drop line
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), aa=R('src/combat/air-aim.js'), lo=R('src/combat/lock-on.js');
  ok(['export function updateAirAim','export function airShot','export function airPitch','export function airMouse'].every(k=>aa.includes(k)) && /airMouse\(cx, cy\)/.test(R('src/input/input.js')) && /updateAirAim\(gdt\); MODE\.update/.test(R('src/game/loop.js')) && C.AIRAIM.keepPx>C.AIRAIM.snapPx && C.AIRAIM.padCone>0, 'the gun is laid on an aircraft: the mouse snaps to it, a pad or phone takes the one on the aim line');
  ok(/arcDist:air \? air\.dropDist : arcD, noArc:!!air/.test(R('src/combat/flame.js')) && /airAim:air \? air\.e : null, arcDist:air \? air\.dropDist : 0/.test(R('src/combat/soldier-fire.js')) && /airAim:o\.airAim\|\|null/.test(lo) && /aaHigh = !!b\.airAim && b\.by>3\.0/.test(lo) && /Math\.abs\(_wy-e\.pos\.y\) < Math\.max\(AIRAIM\.hTol/.test(lo), 'rounds lead it and climb to its height, clear the cover on the way up, and hit it only near it in the air');
  ok(/airPitch\(_gp\.x, _gp\.y, _gp\.z\)/.test(R('src/actors/real-cav.js')) && /AIRAIM\.tankUp/.test(R('src/game/update.js')) && /RingGeometry\(0\.85, 1, 48\)/.test(aa) && /LineDashedMaterial/.test(aa) && C.AIRAIM.manUp>C.AIRAIM.tankUp, 'the tank gun and the rifle tip up to it; a red ring, a dashed drop line, its height and range'); }

// Z312 real breakage: the wreck is the tank's own model, no box parts or coloured rings, a lit lumpy smoke puff, stone breaks into solid lumps, men die whole
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), fw=R('src/fx/fire-wrecks.js'), ex=R('src/fx/explosions.js'), sh=R('src/fx/shatter.js'), inf=R('src/actors/infantry.js');
  ok(/export function spawnWreck\(pos, facing, ms, pal, toss, src\)/.test(fw) && /src\.clone\(true\)/.test(fw) && /function charred\(root\)/.test(fw) && !/spawnWreck\(/.test(R('src/fx/dying.js')) && !/spawnWreck\(/.test(R('src/campaign/boss.js')), 'the wreck is the tank itself, burnt (spawnWreck) — Z402 though no kill leaves one any more');
  ok(!/spawnTankWreck\(/.test(ex) && !/ringPulse\(pos, cf\.r1/.test(ex) && !/0xb088ff/.test(ex) && /export function rollSmoke/.test(ex) && /dustSkirt\(pos\.x, pos\.z, scale\*1\.2\)/.test(ex), 'blasts: no painted box parts, no flat coloured rings, no violet; dust skirt and a rolling smoke cloud');
  ok(/const N=128/.test(R('src/fx/particles.js')) && /solidKind/.test(R('src/world/cover.js')) && /function stoneLump\(src\)/.test(sh) && !/gibBody\(/.test(inf) && !/gibBody\(/.test(R('src/actors/fireteam.js')) && /d\.flat=/.test(inf), 'smoke with volume, stone in solid lumps, men thrown whole and lying where they fall'); }

// Z314 a gun's round flies a straight line in the world, bites into the ground where the line meets it, and hits a body only at its height
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), lo=R('src/combat/lock-on.js');
  ok(/const lineRound = !o\.lockOn && !o\.smart && !o\.homing && !\(vy>0\.5\)/.test(lo) && /if\(b\.line\)\{ b\.by=b\.wy0\+b\.slope\*Math\.hypot\(b\.x-b\.ox, b\.z-b\.oz\)-heightAt\(b\.x,b\.z\); if\(b\.by<0\.05\)\{ b\.by=0\.05; landed=true; \} \}/.test(lo), 'a straight line in the world, into the ground where it meets it — no hugging the ground');
  ok(/function aimAlong\(x, z, a, o\)/.test(lo) && /dropTo = o\.dropTo \?\? \(o\.owner==='e' \? 1\.2 : null\)/.test(lo) && /noArc:true, dropTo:1\.2/.test(R('src/ai/tactics.js')) && /noArc:true, dropTo:1\.3\}\)/.test(R('src/actors/enemies.js')) && /dropTo:1\.1, dropDist:T/.test(R('src/tank/roofmg.js')), 'enemy guns fire straight at the chest, no lob; unmarked rounds aim at whoever is on their line');
  ok(/function lineH\(b, wy, t, man\)/.test(lo) && /hitsHull\(e, _sw\.x, _sw\.z, b\.r\)\) && lineH\(b, _wy, e\)/.test(lo) && /MODE\.hitTest\(p, _sw\.x, _sw\.z, b\.r\) && lineH\(b, _wy, p\)/.test(lo) && /b\.line \? LINE\.over : 1e4, _bskip\)/.test(lo) && C.LINE.tankH>C.LINE.manH, 'a body is hit only at its real height; a round well over an obstacle flies on'); }

// Z315 soldier mode: every fortress gate stands open (the citadel's too); the tank keeps shut gates to breach
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), fo=R('src/world/fortress.js'), md=R('src/game/mode.js');
  ok(/fortsOpen:true/.test(md) && /fortsOpen:false/.test(md) && /if\(MODE\.fortsOpen\)\{ if\(f\.gv < 1 \|\| f\.gateShut\)/.test(fo) && /return !MODE\.fortsOpen && f\.tier===3/.test(fo) && /MODE\.fortsOpen\?'<em>CỔNG MỞ<\/em>'/.test(fo), 'soldier mode: gates open, no sealed citadel, no wall to blast'); }

// Z310 wheels that roll whole (a car's are its own pieces, a scooter's tyres measured and both turning), riders' hands on their bike's grips, the bán tải's wheels
{ const fs=await import('node:fs'); const C=await import('./config.js'), t=fs.readFileSync('src/world/traffic.js','utf8');
  ok(/function pieceWheels\(P, b\)/.test(t) && /function discWheels\(P, b, moto, sc\)/.test(t) && /function cut\(P, x0, h\)/.test(t) && !/its body hides the rear/.test(t) && /c\.r \* 1\.12\) break/.test(t), 'a wheel turns whole: car wheels are their own pieces, scooter tyres are fitted circles, only triangles wholly inside a tyre turn');
  const G=C.REALCITY.traffic.grips; ok(G && G.moto_scooter.length === 3 && G.moto_escooter.length === 3 && /ik2\(H\[n \+ 'Arm'\]/.test(t) && /riderGeo\(C\.grips && C\.grips\[key\]\)/.test(t) && /curlHand\(H, n,/.test(t), 'the baked street rider reaches each scooter\'s own grips and closes his hands on them');
  const W=C.XEOM.bantai.wheels; ok(W && W.length === 4 && W.filter(w => w.steer).length === 2 && W.every(w => w.r > 0.1 && w.r < 0.25), 'the bán tải has four measured wheels, the front pair steering'); }

// Z316 the enemy aims low at one of ours lying flat or crouched; our men are as tall as their stance
{ const fs=await import('node:fs'); const C=await import('./config.js'), lo=fs.readFileSync('src/combat/lock-on.js','utf8');
  ok(/function stanceOf\(t\)/.test(lo) && /function manHigh\(t\)/.test(lo) && /const h = inf \? manHigh\(t\)/.test(lo) && /dropTo=Math\.min\(dropTo, LINE\.aim\[st\]\)/.test(lo) && C.LINE.aim.prone<C.LINE.body.prone && C.LINE.aim.crouch<C.LINE.body.crouch && C.LINE.body.crouch<C.LINE.manH, 'a man lying flat is low and the enemy lays its aim low on him; one aimed at him standing goes over'); }

// Z317 stone breaks into pieces that add up to the stone (count by its size, fill × its volume) and clears away sooner
{ const fs=await import('node:fs'); const C=await import('./config.js'), sh=fs.readFileSync('src/fx/shatter.js','utf8');
  ok(/Math\.round\(Rv \* 2 \* F\.stone\.perM\)/.test(sh) && /F\.stone\.fill \* V \* \(pc\.r \*\* 3 \/ wSum\)/.test(sh) && !/m\.scale\.multiplyScalar\(pc\.r \* 0\.6\)/.test(sh) && /s\.r \* 2\.2 \/ F\.sinkT/.test(sh) && C.SHATTER.stone.fill<1 && C.SHATTER.stone.life<C.SHATTER.life && C.SHATTER.life<9, 'a stone breaks into its own volume (no lump bigger than the stone), by its size, and the pieces clear away sooner'); }

// Z319 broken things blow up and are gone: no lumps, sheets or chunks — a flash, dust, smoke, fire for what burns, fine grit
{ const fs=await import('node:fs'); const C=await import('./config.js'), sh=fs.readFileSync('src/fx/shatter.js','utf8'), db=fs.readFileSync('src/fx/debris.js','utf8');
  ok(C.SHATTER.pieces===false && /if\(!SHATTER\.pieces\) return blowUp\(obj, o \|\| \{\}\)/.test(sh) && /function blowUp\(obj, o\)/.test(sh) && /if\(!SHATTER\.pieces\)\{ grit\(pos, scale, color\); return; \}/.test(db) && /function grit\(pos, scale, color\)/.test(db), 'what is destroyed goes up in dust, smoke and fire and is gone; blasts throw grit, not chunks'); }

// Z318 battlefield light: one palette, one pulse clock and one glowing-ring material for every gameplay light; warnings smooth, never a hard strobe
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=k=>fs.readFileSync(k,'utf8'), bl=R('src/fx/battle-light.js'), B=C.BLIGHT;
  ok(B && ['danger','alert','threat','friend','ally','loot'].every(k => typeof B.col[k] === 'number') && B.hz.idle < B.hz.notice && B.hz.notice < B.hz.warn && B.hz.warn < B.hz.alert && B.hz.alert < B.hz.crit && B.hz.crit <= 6 && B.floor > 0 && B.floor < 0.5, 'battle light: one palette and rising pulse rates (critical ≤ 6 Hz), a pulse never goes fully dark');
  ok(['day','dusk','night'].every(k => B.bloom[k].length === 3) && B.bloom.night[0] > B.bloom.day[0] && B.bloom.night[2] < B.bloom.day[2] && /bloom\.strength=B\[0\]/.test(R('src/world/atmosphere.js')), 'bloom per time of day: the lights bloom more at night');
  ok(/export function holoRing\(R, o = \{\}\)/.test(bl) && /blendSrc:THREE\.OneFactor, blendDst:THREE\.OneMinusSrcAlphaFactor/.test(bl) && /gl_FragColor \*= 1\.0 - fogFactor/.test(bl) && /export function blRamp\(o, dt, k, a, b, floor\)/.test(bl) && /^export \* from '\.\/fx\/battle-light\.js';/m.test(R('src/hub.js')), 'one ring material: a hot core line, soft halo, dark backing, fog dims it (no fog-coloured square); pulses quicken without phase jumps');
  const users={ 'src/campaign/artillery.js':'holoRing', 'src/combat/flame.js':'holoRing', 'src/ai/fieldcraft.js':'holoRing', 'src/loot/powerups.js':'holoArc', 'src/world/rally.js':'holoRing', 'src/world/depots.js':'holoArc', 'src/actors/paradrop.js':'holoRing', 'src/world/tunnels.js':'holoRing', 'src/world/perimeter.js':'holoRing', 'src/combat/ultimate.js':'holoRing', 'src/loot/relic.js':'holoArc', 'src/campaign/boss.js':'holoRing', 'src/fx/hud-fx.js':'holoRing', 'src/actors/enemy-missiles.js':'holoRing' };
  ok(Object.entries(users).every(([f, k]) => R(f).includes(k + '(')) && !/RingGeometry/.test(R('src/loot/powerups.js') + R('src/world/rally.js') + R('src/world/depots.js') + R('src/fx/hud-fx.js') + R('src/ai/fieldcraft.js')), 'every ground ring (danger zones, grenades, loot, rally, depots, drop zones, tunnels, range, strikes, relic, pylons, shockwaves, missile lock) is battle light');
  const em=R('src/actors/enemy-missiles.js'), lo=R('src/combat/lock-on.js'), sw=R('src/campaign/soldier-war.js');
  ok(/id='lockAlert'/.test(em) && !/fillText\('⚠ BỊ KHOÁ'/.test(em) && /blSolid\('friend'/.test(lo) && /blTag\('◆ KHOÁ', 'friend'\)/.test(lo) && /tickArtLock\(s\.zone, k, null, now, dt\)/.test(sw) && !/Math\.floor\(now \* \(2 \+ k \* 9\) \* 2\) % 2/.test(sw), 'our lock is cyan, a missile on us is red with its words on the HUD (not over the action); a tank laying on a man pulses like a barrage ring');
  const css=R('css/battle-light.css'), html=R('index.html');
  ok(/href="css\/battle-light\.css"/.test(html) && /id="hpEdge"/.test(html) && !/steps\(/.test(css) && /body\.hpcrit #hpEdge/.test(css) && /#lockAlert\.on/.test(css) && /classList\.toggle\('hpcrit', low\)/.test(R('src/ui/instruments.js')) && B.hpCrit > 0 && B.hpCrit < 0.5, 'HUD warnings share the palette and smooth pulses (no stepped blinks); low health lights a slow red screen edge'); }

// Z311 the ride's feel (lean only at speed, drift, stones, airborne hops, springy landings) and what it runs into (stops dead, knocks light things over, flattens wire)
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), x=R('src/game/xeom.js'), rc=R('src/game/ride-collide.js'), cv=R('src/game/cavalry.js'), d=R('src/actors/driver.js'), hub=R('src/hub.js');
  const A=C.XEOM.air; ok(A && A.lean[0] > 1 && A.lean[1] > A.lean[0] && A.slip.max > 0 && A.g > 9 && A.land > 0 && A.landZ < C.XEOM.sus.z && /export function bikeHop/.test(x) && /function airborne/.test(x) && /function rideRocks/.test(x) && /bikeHop\(H, P\.vy\[0\]/.test(d), 'it banks only once going, slips when fast, jolts over stones, hops off a fast wheelie and lands on bouncing springs');
  ok(/export function rideCollide/.test(rc) && /game\/ride-collide\.js/.test(hub) && /if\(CV\.mounted\) rideCollide\(p, now\)/.test(cv) && /H\.drv && H\.drv\.wheelT > 0\) \|\| !bikeHop/.test(rc) && C.RIDE_HIT && C.RIDE_HIT.knock.includes('prop_bin') && C.RIDE_HIT.wireV > C.RIDE_HIT.knockV, 'trees, poles, parked cars, street furniture and wire stop a ride; light things go over, wire is flattened by a charge; a low thing is only leapt in a wheelie');
  const ci=R('src/world/city.js'), op=R('src/world/outposts.js'), su=R('src/world/supply.js'); ok(/export const CITY_PROPS/.test(ci) && /export function knockProp/.test(ci) && /export const OUTPOST_WIRE/.test(op) && /export function rideFence/.test(su), 'the street furniture, the outposts\' wire and the compounds\' fences are known to the ride'); }

// Z322 the intro: far ground wears the grass carpet's colour, the veil waits for the finished floor and models, haze + a cloud deck flown through
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=k=>fs.readFileSync(k,'utf8'), gr=R('src/world/ground.js'), gc=R('src/world/grass-carpet.js'), it=R('src/game/intro.js'), ic=R('src/game/intro-clouds.js');
  ok(/export const GRASS_FAR/.test(gr) && /smoothstep\(grassC\.z, grassC\.w, distance\(vWXZ, grassC\.xy\)\)/.test(gr) && /macroGround5/.test(gr) && /function avgOf\(img, alpha\)/.test(gc) && /GRASS_FAR\.c\.value\.set\(/.test(gc) && C.GRASS.far.cover > 0 && C.GRASS.far.cover <= 1 && C.GRASS.far.rim0 < C.GRASS.far.rim1, 'past the grass carpet the floor wears the carpet\'s own averaged colour, fading in at its rim — far and near read the same');
  ok(/async function assetsReady\(\)/.test(it) && /GROUND_READY\.p, grassReady\(\), loadRealTrees\(\)/.test(it) && /await assetsReady\(\)/.test(it) && /DefaultLoadingManager/.test(it) && C.INTRO.assetWait >= 3000 && /export const GROUND_READY/.test(R('src/world/ground-photo.js')), 'the intro waits (capped) for the photo floor, the grass photos, real trees / city and the loader queue before it flies');
  const K=C.INTRO_CLOUDS; ok(K && K.on && K.band[0] < K.band[1] && K.haze < 0.6 && K.inside <= 1 && /buildIntroClouds\(intro\.tour, T\)/.test(it) && /clearIntroClouds\(\)/.test(it) && /inside \*= below/.test(ic) && /BIOME\.name === 'CAVERN'/.test(ic) && /#introMist/.test(R('css/cinematic-mobile.css')), 'high up: haze and a cloud deck the swoop flies through; below the deck the air is clear; none underground'); }

// Z326 the soldier aims up at an aircraft with his whole body: his own rifle held for real, leaning back, head up along the barrel
{ const fs=await import('node:fs'); const C=await import('./config.js'), r=fs.readFileSync('src/actors/real-cav.js','utf8');
  ok(C.INFGUN.map.carbine==='ar' && /R\.lean = \(R\.lean \|\| 0\) \+ \(want - \(R\.lean \|\| 0\)\) \* Math\.min\(1, dt \* AIRPOSE\.rate\)/.test(r) && /\['Spine', 'Spine1', 'Spine2'\]\.forEach\(\(n, i\) => turnBone\(D\[n\], _gr, -R\.lean \* AIRPOSE\.split\[i\]\)\)/.test(r) && /turnBone\(D\.Head, _gr, up \* \(1 - AIRPOSE\.neck\)\)/.test(r) && /prone \? AIRPOSE\.prone : AIRAIM\.manUp/.test(r) && C.AIRPOSE.max>0 && C.AIRPOSE.prone<C.AIRAIM.manUp, 'his rifle is held for real again; at an aircraft he leans back from the waist and sights along the barrel; lying flat he cannot'); }

// Z325 forts, the real city, ruins, wonders, props and models graded into the field's colour once a stage is built
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=k=>fs.readFileSync(k,'utf8'), bi=R('src/render/blend-in.js'), B=C.BLEND;
  ok(B && B.on && B.hue > 0 && B.hue <= 0.35 && B.desat >= 0 && B.desat <= 0.25 && B.dust > 0 && B.dust <= 0.5 && B.tintMin < 1 && B.tintMax > 1, 'blend-in is light: a share of the field\'s hue, a touch less saturation, a dusty foot');
  ok(/export function blendIn\(m\)/.test(bi) && /m\.transparent/.test(bi) && /m === groundMat/.test(bi) && /grassPhoto\|macroGround/.test(bi) && /key0 \+ '\|blendIn2'/.test(bi) && /if\(f0\) f0\.call\(this, sh, r\)/.test(bi) && /isSkinnedMesh/.test(bi) && /p === skip/.test(bi), 'each material keeps its own shader work and program key; the ground, grass, glass, skinned men and our own tank are left alone');
  ok(/try\{ blendScene\(scene\); \}catch\(e\)\{\} if\(!intro\.active\) return;/.test(R('src/game/intro.js')) && /blendWhenReady\(scene\)/.test(R('src/loot/upgrades.js')) && /^export \* from '\.\/render\/blend-in\.js';/m.test(R('src/hub.js')), 'graded when a stage is built: in the intro warm-up (even a skipped one) and on the next stage'); }

// Z323 no shader compiles once the fight is on: the countdown waits for a guarded compile; the burnt wreck keeps its model's own shader
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), br=R('src/ui/briefing.js'), fw=R('src/fx/fire-wrecks.js');
  ok(/function compileQuiet\(\)/.test(br) && /renderer\.properties\.get\(m\)\.currentProgram/.test(br) && /if\(!pr \|\| pr\.isReady\(\)\)/.test(br) && /if\(_warm && S\.cd-dt<=0\.05\)/.test(br) && !/compileAsync\(scene, camera\)/.test(br), 'the countdown holds until the stage shaders are compiled; the compile wait cannot throw or hang');
  ok(!/c\.emissiveMap = emberTex\(\)/.test(fw) && /c\.emissive\.setHex\(0xff4a12\); c\.emissiveIntensity = 0\.4/.test(fw), 'a burnt wreck glows by colour only, so its model keeps the shader it already has'); }

// Z324 the battle HUD: dialogue / cards / banners each switchable, see-through glass cards, a slim banner band, a compact reload ring
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), hp=R('src/ui/hud-prefs.js'), cs=R('css/hud-slim.css'), ix=R('index.html');
  ok(/talk:false, cards:true, banners:true/.test(hp) && /export function applyHud/.test(hp) && /id="setHudTalk"/.test(ix) && /id="setHudCards"/.test(ix) && /id="setHudBanners"/.test(ix) && /setHud\(k, true\)/.test(R('src/ui/settings.js')) && /if\(show\) floatText/.test(R('src/actors/driver.js')), 'HUD switches: on-screen dialogue off by default (voices still play), cards and banners on/off');
  ok(/hud-slim\.css/.test(ix) && ix.indexOf('hud-slim.css') > ix.indexOf('battle-light.css') && /body\.hud-no-talk #radio\{display:none/.test(cs) && /backdrop-filter:blur\(3px\)/.test(cs) && /reloadSprite\.scale\.set\(2\.1,2\.1,1\)/.test(R('src/combat/guns.js')) && !/NẠP ĐẠN/.test(R('src/combat/guns.js')), 'glass cards loaded last, a slim reload ring with no label'); }

// Z321 the cavalry: the rider seated on the real horse again; a galloping horse leaps what is low enough, its jump clip in the air; nothing ridden or led through
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), rc=R('src/game/ride-collide.js'), cv=R('src/game/cavalry.js'), rv=R('src/actors/real-cav.js'), x=R('src/game/xeom.js');
  ok(/function seatRider\(G, H\)\{ \(H\.bike && H\.body \|\| H\.B\)\.add\(G\)/.test(cv), 'on a horse the rider sits on H.B (the real horse\'s saddle takes him from there), not in the hidden hand-made horse\'s skin');
  const J=C.RIDE_HIT.horse; ok(J && J.h > 1 && J.h < 2.5 && J.v > 3 && J.vy[0] < J.vy[1] && J.g > 9 && J.tuck >= 0 && /export function rideLeap\(H, h, span\)/.test(rc) && /export function horseAir\(H, dt\)/.test(rc) && /A\.leapH = 0/.test(x), 'a horse at a gallop leaps anything up to RIDE_HIT.horse.h, its spring sized to the span; it comes down under its own gravity');
  ok(/rideLeap\(H, blockH\(b\), Math\.sqrt\(d2\)\+rr\)/.test(cv) && /rideLeap\(H, h, d \+ r \+ R\)/.test(rc) && /rideLeap\(H, P\.h,/.test(rc) && /rideLeap\(H, 1,/.test(rc) && /horseAir\(H, dt\)/.test(cv) && /'Jump_Sprint'/.test(rv) && /Jump_Sprint\.time = 0/.test(rv), 'the leap is asked of every block, stone, prop and wire; the horse rides above the ground in it, its jump clip from take-off');
  ok(/export function rideClear\(q, R\)/.test(rc) && /rideClear\(CV\.hPos, 0\.9\)/.test(cv) && /CV\.H\.air\.y>0/.test(cv), 'a horse on its own goes round trees, props and wire; no getting off in mid-leap'); }

// Z320 the street's own rules: lanes, gaps (IDM), steering round what stands, junctions one road at a time, U-turns; rams are collisions of masses; shot vehicles are thrown, burn and sink away
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), tr=R('src/world/traffic.js'), im=R('src/game/ride-impact.js'), ct=R('src/world/city.js'), T=C.REALCITY.traffic;
  ok(/function netOf\(segs\)/.test(tr) && /function grant\(v, j\)/.test(tr) && /function roomBeyond/.test(tr) && /J\.wantT > Y\.yieldT/.test(tr) && /roads\.xing=new Set\(\)/.test(ct) && /w:W, med:MED, g:G/.test(ct) && T.junc.yieldT>0, 'every crossing is one box, one road at a time, never entered without room past it');
  ok(/function drive\(v, dt, p, now\)/.test(tr) && /function clearBand/.test(tr) && /function parkedOn/.test(tr) && /Math\.min\(v\.v, Math\.max\(0, gap - 0\.1\) \/ dt/.test(tr) && T.lane.blvdMoto[0]>T.lane.blvdCar+1.31*2+1.3 && T.lane.street[1]+0.36<2.7-1.2 && T.lane.street[0]-0.36>0, 'cars by the median, scooters by the kerb lane, clear of each other and of parked cars; never into what is ahead; round what stands in the lane');
  ok(/function startU\(v, tu\)/.test(tr) && /the rear axle on the circle/.test(tr) && /one U-turn at a time/.test(tr) && /the inner lane turns first/.test(tr) && /function freeAt/.test(tr) && T.spawnR>=40, 'U-turns round the rear axle, one at a time, inner lane first; nobody spawns on anyone or in sight');
  ok(/const j = \(1 \+ I\.e\) \* vc \/ \(1 \/ mr \+ 1 \/ mv\)/.test(im) && !/spill\(H, 'car'\)/.test(im) && /v\.st === 'down'/.test(im) && C.XEOM.impact.mass.bantai>C.XEOM.impact.mass.xeom && /a heavy blow rolls a car onto its side/.test(tr) && /function bumps\(\)/.test(tr), 'a ram shoves and spins the car, puts a scooter down (ridden over after), the ride drives on; a heavy one rolls a car; a sliding wreck passes the blow on');
  ok(/C\.shotThrow/.test(tr) && /function gone\(v\)/.test(tr) && T.hit.burnT<=6 && T.hit.hp[1]<=22 && /trafficCone\(x, z, cx, cz, range/.test(R('src/combat/flame.js')) && /trafficBeam\(ax, az, ex, ez/.test(R('src/combat/ultimate.js')), 'rounds, flames and beams set vehicles alight; the killing round throws it; it burns a few seconds and sinks away'); }

// Z327 no freeze on a kill (a clone no longer serialises its userData), fort walls cut once per section, dead code gone
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), rd=R('src/render/renderer.js'), F=R('src/world/fortress.js');
  ok(/for\(const C of \[THREE\.Object3D, THREE\.Material, THREE\.Texture\]\)/.test(rd) && /if\(heavy\(v\)\) return \{\};/.test(rd) && /src\.userData=\{\};\s*try\{ _copy\.call\(this, src, \.\.\.a\); \} finally \{ src\.userData=u; \}/.test(rd), 'a clone copies plain userData and leaves three objects out (no toDataURL of a whole tank per wreck)');
  ok(/function sliceX\(g, x0, x1, mid\)/.test(F) && /new THREE\.InstancedMesh\(sg, (mat|mt), list\.length\)/.test(F) && /im\.computeBoundingSphere\(\); im\.castShadow=im\.receiveShadow=true;/.test(F) && !/fortClip/.test(F), 'each wall section draws only its own stretch, culled to the view and the shadow');
  ok(/if\(f\.wallSl && f\.wallSl\[pc\.i\]\)\{ const \[im,j\]=f\.wallSl\[pc\.i\]; im\.setMatrixAt\(j, _m\);/.test(F) && /for\(const g of f\.wallGeos\|\|\[\]\) g\.dispose\(\);/.test(F), 'a fallen section hides its slice; a stage change frees the slices');
  ok(!/export function buildGunModel/.test(R('src/ui/shop.js')) && !/thumbTank|pumpThumbs/.test(R('src/ui/showroom.js')) && !/id="terrainDlg"/.test(R('index.html')) && !/function buildCity\(/.test(R('src/world/landmarks.js')) && !/\.tcard/.test(R('css/menus.css')), 'dead features are gone: the old 3D gun model, card photos, the old battlefield dialog, the box city'); }

// Z329 the soldier's arsenal: the nine Tripo hand weapons are his guns, each fired its own way; the gun crate brings him one · Z330 the steel operator holds it gun-first too · Z332 no xích lô
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), G=(await import('./src/data/guns.js')).GUNS, sf=R('src/combat/soldier-fire.js'), rc=R('src/actors/real-cav.js');
  const T=Object.keys(G).filter(k=>G[k].trooper); ok(T.length===16 && new Set(T.map(k=>C.INFGUN.map[k])).size===16 && T.every(k=>C.INFGUN.guns[C.INFGUN.map[k]]), 'nine soldier guns (Z355 twelve: + AK-47, M4, MP5; Z387 sixteen: + the rust rifle, the marksman, the rail rifle, the saw launcher), one per hand-weapon model, each one held in his hands');
  ok(/g\.special === 'flame'\)\{ fireFlame/.test(sf) && /g\.special === 'mortar'\)\{ fireMortar/.test(sf) && /pierce:g\.pierce/.test(sf) && /chain:g\.chain/.test(sf) && /export function trooperGive/.test(sf) && /\[main, 't_rpg'\]/.test(sf) && /PRIMARY_GUNS = Object\.keys\(GUNS\)\.filter\(id => GUNS\[id\]\.trooper && id !== KIT_GUN\)/.test(sf) && /MODE\.id==='soldier'\)\{ const id=trooperGunPick\(\)/.test(R('src/loot/powerups.js')), 'each fires its own way (rounds, pellets, a slug through, a rocket, a lobbed grenade, a flame, an arc); he starts with a carbine (Z359 or the AK / M4 / MP5 he picked) and a B41 and picks up the rest');
  ok(/\(PROFILE\.trooper \|\| 's2'\) === 'op'\)\{ const seen = skClone\(og\.scene\)/.test(rc) && /pup = makePuppet\(op, seen\)/.test(rc), 'the steel operator is worn by the clips like the special-forces soldier, so he holds every gun gun-first, bore on the aim');
  ok(!C.XEOM.xichlo && !C.RIDE.fit.xichlo && !/xichlo/.test(R('src/ui/battle-setup.js')) && !fs.existsSync('assets/models/real/ride/xichlo.glb') && /PROFILE\.unit==='xichlo'\) PROFILE\.unit='xeom'/.test(R('src/game/flow.js')), 'the xích lô is gone (a saved pick rides the xe ôm)'); }

// Z328 far models swap to a light copy (meshoptimizer), the ground scars are read by the ground's own shader
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), fl=R('src/render/far-lod.js'), C=await import('./config.js');
  ok(/meshoptimizer@0\.21\.0\/meshopt_simplifier\.module\.js/.test(fl) && /S\.simplify\(idx, pos, 3, target, FARLOD\.err, \[\]\)/.test(fl) && /new THREE\.LOD\(\)/.test(fl) && /lod\.addLevel\(lm, d, FARLOD\.hys\)/.test(fl) && C.FARLOD.on && C.FARLOD.keep<0.3 && C.FARLOD.far>=40, 'far LOD: a simplified copy past FARLOD.far, the model whole up close');
  ok(/host\.add\(m\); return farLOD\(m\); \}/.test(R('src/world/fortress.js')) && /farLOD\(hq\)/.test(R('src/actors/core.js')) && /render\/far-lod\.js/.test(R('src/hub.js')), 'fort towers, gatehouses, keeps and the HQ get their far copies');
  const d=R('src/world/decals.js'), g=R('src/world/ground.js');
  ok(!/terrainGeo\(\)/.test(d) && /DECAL_U\.decalS\.value = decalTex\(DECAL\.stat\)/.test(d) && /vec2 duv = vec2\(vWXZ\.x \* decalK \+ 0\.5, 0\.5 - vWXZ\.y \* decalK\)/.test(g) && /'macroGround5'/.test(g), 'ground scars are drawn by the ground shader, not by two extra copies of the terrain'); }

// Z338 cover pieces keep their own meshes but are drawn a few instanced draws at a time
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), cb=R('src/render/cover-batch.js');
  ok(/export const BATCH_LAYER = 6;/.test(cb) && /new THREE\.InstancedMesh\(g\.geo, g\.mat, cap\)/.test(cb) && /g\.im\.instanceMatrix\.array\.set\(e, g\.n \* 16\); g\.im\.setColorAt\(g\.n, m\.material\.color\)/.test(cb) && /mt\.userData\._e0 === undefined/.test(cb) && /scene\.onBeforeRender = function/.test(cb) && /nobatch/.test(cb), 'cover is batched per kind, a flashing piece draws itself, ?nobatch switches it off');
  ok(/trackCover\(m\); batchCover\(m\); loadRealCover\(\);/.test(R('src/world/props.js')) && /if\(u\.cb\) continue;/.test(R('src/render/lod.js')) && /render\/cover-batch\.js/.test(R('src/hub.js')), 'every cover mesh joins the batch; the fog cull leaves it to the batch'); }

// Z334 aiming at the men up high (towers, walls) like aircraft · Z335 sat tall on the xe ôm, the gun over the driver's shoulder · Z336 jump, sprint, combat roll, cover
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), aa=R('src/combat/air-aim.js'), lo=R('src/combat/lock-on.js'), rc=R('src/actors/real-cav.js'), sm=R('src/game/soldier-moves.js'), cv=R('src/game/cavalry.js');
  ok(/function\* high\(\)/.test(aa) && /liveGuards\(\)/.test(aa) && /b\.airAim\._twr/.test(lo) && /shootGuard\(G\.t, G\.gd, b\.ox, b\.oz\)/.test(lo), 'a rifleman on a tower or a wall is laid on like an aircraft; the round climbs to him and drops him');
  ok(/function overDriver\(R, gp, yaw\)/.test(rc) && C.REALCAV.overDrv.up>0 && C.REALCAV.sit.lean===0 && C.XEOM.xeom.seat[0]>0.415, 'on the xe ôm he sits tall and straight, the gun laid ahead over the driver\'s shoulder');
  ok(['export function soldierJump','export function soldierRoll','export function footStance','export function footMotion','export function footPose'].every(k=>sm.includes(k)) && /else soldierJump\(\)/.test(cv) && /heldAction\('sprint'\)/.test(cv) && C.ACTIONS.some(a=>a[0]==='roll') && C.ACTIONS.some(a=>a[0]==='sprint') && C.CAV.moves.roll.defK<C.CAV.defK.crouch, 'Space jumps, Shift sprints, Alt / L rolls (hard to hit going over), cover pulls him down behind it');
  ok(/if\(tuck\)\{/.test(rc) && /MV\.cover \+ CR\.rest/.test(rc) && /MV\.roll >= 0\)\{ ok = 'Cautious_Crouch_Walk_Forward'; freeze = 0\.42/.test(rc), 'tucked in a roll with the rifle held in, the rifle laid on the cover'); }

// Z331 the driver off the ride: the crawl to a downed bike, the two-try heave, giving himself up beside the fallen soldier
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), a=R('src/actors/driver-acts.js'), d=R('src/actors/driver.js'), pd=R('src/game/player-damage.js'), md=R('src/game/mode.js'), cv=R('src/game/cavalry.js');
  ok(['export function driverAct','export function driverSurrender','export function driverBack','export function driverDone','export function snapPose','export function blendPose','export function downedRide','function crawlPose','function heaveCurve','function kneelStep','function handsUp','function kneelSpot'].every(k=>a.includes(k)) && /actors\/driver-acts\.js/.test(R('src/hub.js')), 'driver-acts: crawl, heave, surrender, back on the seat, every change of pose eased');
  ok(/snapPose\(D, C\.getup\); D\.state = 'crawl'/.test(d) && /else if\(DRIVER_ACTS\.has\(D\.state\)\) driverAct\(H, D, dt\)/.test(d) && /if\(D\.state === 'mount'\)\{ blendPose\(D, dt\)/.test(d) && !/st === 'walk'/.test(d), 'a spill: off his back onto all fours and crawling (no stiff stand-up, walk and rest-pose lift); eased back onto the seat');
  const A=C.RIDE_ACT, Hv=A.heave; ok(Hv.h1[1] > Hv.slip[1] && Hv.slip[1] > 0 && Hv.hip[0] < Hv.hip[1] && Hv.bend[0] > Hv.bend[1] && Hv.off[0] > Hv.off[1] && C.RIDE.crash.getup <= 0.6 && A.crawl.v > 0.8 && A.give.beside > 0.5 && A.give.show < A.give.wait && ['slip','surrender'].every(e=>C.RIDE_TALK[e] && C.RIDE_TALK[e].d.length), 'the heave comes up part way, slips back, then up from a deep squat; a quick scramble; he kneels beside the body, not on it');
  ok(/driverSurrender\(CV\.H\)/.test(pd) && /cavRespawn\(p\); driverBack\(CV\.H\)/.test(pd) && /if\(MODE\.finalDeath\(p\)\) beginDeath\(now, true\)/.test(pd) && /driverDone\(CV\.H\) \|\| DEATH\.t >= CAV\.death\.dur \+ RIDE_ACT\.give\.wait/.test(pd), 'the soldier shot down: the driver gives himself up; a respawn puts him back on the seat; the last life plays out until he kneels');
  ok(/finalDeath\(\)\{ return true; \}/.test(md) && /if\(CV\.dead \|\| !CV\.mounted\) cavRespawn\(p\); driverBack\(CV\.H\)/.test(md), 'a new run: the soldier back in the saddle, the driver on his seat, however the last run ended');
  ok(/pos:G\.getWorldPosition\(new THREE\.Vector3\(\)\)/.test(cv) && /G\.getWorldPosition\(D\.pos\)/.test(cv) && /if\(!D\.from\)\{ H\.root\.position\.set\(CV\.hPos\.x/.test(cv), 'killed on foot: the death camera circles where he fell, the ride stays where it stood'); }

// Z337 bumping into things by their true shape: fortress wall sections, buildings and parked cars are boxes for the soldier, the rides, the tanks; the camera never inside a building; men in the soldier's war bleed, never burn
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), ss=R('src/world/solid-shape.js'), cv=R('src/game/cavalry.js'), ph=R('src/world/physics.js'), up=R('src/game/update.js'), rc=R('src/game/ride-collide.js');
  ok(['export function solidShape','export function carShape','export function pushOutShape','export function sightToBuildings'].every(k=>ss.includes(k)) && /FORT\.wallT \+ 3\.0/.test(ss) && /hl:B\.d \/ 2, hw:B\.w \/ 2/.test(ss), 'a fortress wall section is the box of its stone foot, a building the box of its footprint');
  ok(/vn=pushOutShape\(p, SH, R\)/.test(cv) && /else rideClear\(p\.pos, R\)/.test(cv) && /SH \? tankVsWall\(p, SH\) : tankVsCircle/.test(ph) && /carShape\(c\)/.test(rc), 'the soldier, the rides and the tanks are held by those boxes; on foot trees, parked cars and street furniture are solid too');
  ok(/sightToBuildings\(p\.pos\.x, hy, p\.pos\.z, camBase\.x/.test(up) && /sightToBuildings\(p\.pos\.x, hy, p\.pos\.z, pos\.x, y, pos\.z\) >= 1/.test(up) && /CAM\.top/.test(up), 'the camera rises over a building in the way, else comes in on its sight line, else goes up over you');
  ok(/MODE\.id==='soldier' && e\.def\.inf\)\{ e\.hp -= F\.dps/.test(R('src/ai/tactics.js')), 'in the soldier\'s war a man hit by fire is wounded and bleeds, never set alight'); }

// Z340 turned round in the saddle: nearly all the way round (hips + chest), held at the limit, back round the front once the aim is past it; the trigger waits for the bore
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), r=R('src/actors/real-cav.js'), f=R('src/combat/soldier-fire.js'), T=C.RIDER_TURN;
  ok(T && T.max > 2.8 && T.max < Math.PI && T.flip > 0 && Math.PI + T.flip > T.max && T.hip > 0.5 && T.hip < T.max && T.swing > C.REALCAV.aimRate && T.fire > 0 && T.fire < 0.8 && T.lead < T.fire, 'he turns to about 170° either way, never right round; swings back quicker; the trigger tolerance is tighter than a quarter turn');
  ok(/sat = mounted && !stand/.test(r) && /const L = Math\.PI \+ \(sat \? RT\.flip : C\.flip\)/.test(r) && /const tgt = sat \? clamp\(R\.tu, -RT\.max, RT\.max\)/.test(r) && /hipMax = sat \? \(bike \? C\.seatTurn\[1\] : RT\.hip\) : 0/.test(r) && /const twLim = sat \? RT\.max - /.test(r), 'on the horse too: hips swing on the saddle, the chest takes the rest, held at the limit, unwrapped past the gap');
  ok(/_qd\.setFromAxisAngle\(_up, -R\.hy\)/.test(r) && /R\.sat \? gy \+ chest \+ clamp\(dyw - chest, -RIDER_TURN\.lead, RIDER_TURN\.lead\)/.test(r) && /R\.gunYaw = yw/.test(r), 'his thighs stay along the horse; the gun goes where his chest is turned; the bore yaw is kept for the trigger');
  ok(/R\.sat( \|\| R\.bed\))? && R\.gunYaw != null/.test(f) && /> RIDER_TURN\.fire\) return;/.test(f) && f.indexOf('RIDER_TURN.fire') < f.indexOf('p.fireAt = now'), 'no round out of his back: the trigger waits (before the shot is spent) until the bore is on the aim'); }

// Z339 the soldier's own legs: planted feet stepping the way he goes — forward, backward, sideways (hips open, crossing over), crouched
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), lg=R('src/actors/soldier-legs.js'), rc=R('src/actors/real-cav.js'), L=C.SOLDIER_LEGS;
  ok(/export function soldierLegs\(R, G, dt, P, mounted\)/.test(lg) && /if\(R\.pup && !P\.dead\) soldierLegs\(R, G, dt, P, mounted\)/.test(rc) && /actors\/soldier-legs\.js/.test(R('src/hub.js')), 'his legs laid over the clips every frame, before the hold');
  ok(/best = 1 - L\.lastFoot/.test(lg) && /function step\(f, to, yaw, dur, h, cross = 0\)/.test(lg) && /f\.p\.addScaledVector\(F2, w\.cross \* A\.crossArc/.test(lg) && /A\.maxDrop/.test(lg), 'left, right, left; a crossing step swung round the other foot; the pelvis never drops into a squat');
  ok(/R\.ownLegs && R\.ownLegs\.on\)\{ ok = 'Aim_Stand'/.test(rc) && /R\.ownLegs\.mode === 'crouch'\)\{ ok = 'Aim_Stand'/.test(rc) && /R\.hy = R\.hy \|\| 0;/.test(rc), 'walking or crouched on the move under his own legs, the rifle held steady (no clip legs, no hunched crouch-walk)');
  ok(L.stand.maxStride >= 1.4 && L.stand.cad[2] > L.stand.cad[0] && L.stand.turn > 0.6 && L.stand.turnBack < L.stand.turn && L.crouch.hipK < L.stand.hipK && L.maxDrop <= 0.15 && L.slope < -0.5, 'a whole stride per foot, quicker steps when faster, hips open more to the side than backing up, crouched lower'); }

// Z341 the firing positions: kneeling (right knee down, left shin upright, bladed, square shoulders), prone (legs in a V), the jump, cover
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), lg=R('src/actors/soldier-legs.js'), rc=R('src/actors/real-cav.js'), L=C.SOLDIER_LEGS, Mv=C.CAV.moves.cover;
  ok(['function kneelPose','function pronePose','function airPose','function setHips','function torso','function finish'].every(k=>lg.includes(k)) && /mode = s > \(L\.mode === 'crouch'/.test(lg) && /if\(MV && MV\.air\) mode = 'air'; else if\(P\.stance === 'prone'\) mode = 'prone'/.test(lg), 'each position its own pose, chosen by stance and speed; every change eased from the last pose');
  ok(/if\(st > mx\) _d\.copy\(f\.p\)\.addScaledVector\(_e, mx \/ st\);   \/\/ \(a foot travels/.test(lg) && !/\/\/[^\n]*if\(st > mx\)/.test(lg), 'the stride cap runs (it had slipped into a comment)');
  ok(L.kneel.turn > 0.3 && L.kneel.torso > 0 && L.kneel.kneeH < 0.1 && L.kneel.hipK < 1 && L.prone.spread > 0.15 && L.air.tuck < L.air.ext && L.landDip > 0.05 && L.coverRest > 0, 'bladed on one knee, legs in a V, tucked in the air, a give on landing, the bore over the cover');
  ok(Mv.probe[Mv.probe.length - 1] <= 1.1 && Mv.kneel <= 0.85 && /MV\.cover \+ A\.coverRest - A\.pocket/.test(lg) && /if\(MV && MV\.land > 0\) hipY -= A\.landDip/.test(lg), 'cover only close enough to lay the rifle on; kneeling or crouched to just the height that puts it on top');
  ok(/MV && \(MV\.air \|\| MV\.land > 0\)\)\{ ok = 'Aim_Stand'/.test(rc), 'in the air and landing the rifle stays shouldered'); }

// Z342 getting on and off from the near (left) side the way a rider does: foot in the stirrup, the leg swung over the croup; over a pillion; up into a bed
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), mt=R('src/actors/soldier-mount.js'), cv=R('src/game/cavalry.js'), rc=R('src/actors/real-cav.js'), lg=R('src/actors/soldier-legs.js'), SM=C.SOLDIER_MOUNT;
  ok(['export function mountOwn','export function mountDur','export function mountMove','export function mountPose','export function mountHand','function keysAt','function frame'].every(k=>mt.includes(k)) && /actors\/soldier-mount\.js/.test(R('src/hub.js')), 'a timeline of key poses in the ride\'s own frame, eased, reached by IK');
  ok(/own=!T\.crash && mountOwn\(\)/.test(cv) && /if\(own\)\{ mountMove\(p, T\); animateHorse\(H, dt, 0, 0\); \}/.test(cv) && /mountHand\(R\);( steadyHead\(R, dt\);)? return;/.test(rc) && /mode = T\.k === 'on' && T\.t < \(T\.walkT \|\| 0\) \? 'stand' : 'mount'/.test(lg), 'the transition hands the climb to it (a crash still throws him clear); he walks there on his own legs; the left hand takes hold');
  const ok3 = ['horse','pillion','bed'].every(k => { const M = SM[k]; return ['on','off'].every(d => { const K = M[d]; return K[0].u === 0 && K[K.length - 1].u === 1 && K.every((x, i) => !i || x.u > K[i - 1].u); }) && M.dur.on > 0.8 && M.grab; });
  ok(ok3 && SM.horse.on[0].yaw < -1.2 && SM.horse.on[0].hips[0] > 0.4 && SM.pillion.on[0].hips[0] > 0.4, 'every timeline runs 0 → 1 in order; he starts at the ride\'s LEFT side, facing it');
  const sw = SM.horse.on.filter(k => k.ra[3] && k.ra[2] < -0.5); ok(sw.length >= 2 && sw.every(k => k.ra[1] > -0.05), 'the right leg goes over the croup above the horse\'s back (from the seat\'s height), not through it');
  ok(/T\.path\.push\(_b\.copy\(F\.O\)\.addScaledVector\(F\.Fm, end\)\.addScaledVector\(F\.Lm, Math\.min\(side, -out\)\)/.test(mt) && /const glide = /.test(mt) && /if\(mode === 'mount' && !L\.mode\) L\.w = 1;/.test(lg) && /lastT/.test(mt), 'from the far side round the head / tail; an even walk; no sinking at the start of a dismount, no snap at the end of a mount'); }

// Z343 the upper body in time with the legs: shoulders against the stride, sway, lean into a change of pace, breathing, a steady head, the rifle's weight
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), up=R('src/actors/soldier-upper.js'), rc=R('src/actors/real-cav.js'), U=C.SOLDIER_UPPER;
  ok(['export function soldierUpper','export function steadyHead','export function lookAtHold','const spring'].every(k=>up.includes(k)) && /actors\/soldier-upper\.js/.test(R('src/hub.js')), 'the upper-body layer, the steady head, eyes on the hold');
  ok(/soldierLegs\(R, G, dt, P, mounted\);[^\n]*\n  if\(R\.pup && !P\.dead\) soldierUpper\(R, G, dt, P, mounted\)/.test(rc) && /mountHand\(R\); steadyHead\(R, dt\); return;/.test(rc) && /if\(R\.gunLag\) _gp\.add\(R\.gunLag\)/.test(rc) && /const ywS = yw \+ \(R\.gunSway \? R\.gunSway\.y : 0\)/.test(rc), 'after the legs, before the hold; the rifle carried by its own spring; the head steadied last');
  ok(/turnBone\(D\.Neck, RA, pitch \* g\); turnBone\(D\.Neck, FA, -roll \* g\); turnBone\(D\.Neck, UP, -yaw \* g\)/.test(up) && U.gaze > 0.6 && U.gaze <= 1, 'every turn added to the trunk taken back at the neck: the eyes stay on the target');
  ok(U.gun.max <= 0.04 && U.gun.dead > 0.5 && U.gun.fire < 1 && U.leanMax <= 0.2 && U.twist < 0.1 && U.sway < 0.06 && U.head.steady < 1 && /S\.player, pv = pl && pl\.vel/.test(up), 'small and settling: a few cm of rifle lag, no shiver at a standstill, less sway firing; the lean read off the pace he is set to, not a jittery position'); }

// Z350–Z353 the soldier's career: rank + perk cards, his own squad, the enemy's guns and stars, the general on foot
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), rk=R('src/game/soldier-rank.js'), sq=R('src/actors/squad-mates.js'), ar=R('src/loot/soldier-arms.js'), gd=R('src/campaign/general-duel.js'), T=C.TROOPER, hub=R('src/hub.js');
  ok(['game/soldier-rank.js','actors/squad-mates.js','loot/soldier-arms.js','campaign/general-duel.js'].every(f=>hub.includes(f)), 'the four career modules are in the hub');
  const need=r=>T.step[0]+T.step[1]*r+T.step[2]*r*r; ok(T.ranks.length===13 && T.ranks[0]==='BINH NHÌ' && T.ranks[12]==='ĐẠI TÁ' && need(0)===200 && need(1)>need(0) && need(11)<3000, 'thirteen ranks, Binh nhì to Đại tá, each a little further than the last (Z367 about three times further apart)');
  ok(T.xp.kill.rifle<T.xp.kill.rpg && T.xp.kill.rpg<T.xp.kill.grunt && T.xp.kill.grunt<T.xp.kill.heavy && T.xp.kill.boss<T.xp.kill.general, 'experience follows how hard the kill was, the general most of all');
  ok(/bumpCombo\(\); soldierKill\(e\);/.test(R('src/actors/damage.js')) && /if\(MODE\.id !== 'soldier'/.test(rk) && !/S\.mode = 'perk'/.test(rk) && /function giftDrop\(nm\)/.test(rk) && /  giftDrop\(nm\); \}/.test(rk) && /spawnGift\(\{ x, z \}, \(\) => \{ const k = pickPerks\(1\)\[0\]; if\(!k\) return; take\(k, S\.player\)/.test(rk) && T.gift.ahead>0, 'every kill counts (soldier mode only); Z367 a rank never stops the battle: a gift crate lands by him, one reward picked for him when he walks over it');
  ok(['tough','marks','quick','reload','bigmag','eagle','legs','vest','leech','tactic','nade','medic','leader','recruit','life','c_tank','c_para','c_strk','c_sup'].every(k=>rk.includes("id:'"+k+"'")) && /soldierStagePerks\(\)/.test(R('src/loot/upgrades.js')), 'stat perks in levels, calls for help, the stage-won cards are his');
  ok(T.squad.start.join()==='mg,medic' && T.squad.max>=5 && /medKit\(a\)/.test(sq) && /r\.dead && newWave/.test(sq) && /\(a\.dmgK\|\|1\)/.test(R('src/actors/fireteam.js')), 'a machine-gunner and a medic from the start, the fallen back next wave, their damage grows with him');
  ok(T.star.max===5 && /inst\.star = st/.test(R('src/combat/soldier-fire.js')) && /\(1 \+ SK\.dmg \* st\)/.test(R('src/combat/soldier-fire.js')) && /lv=inst\.star\|\|gunLevel/.test(R('src/ui/briefing.js')), 'a gun picked up again climbs a star: more damage, a quicker trigger, shown on the chip');
  ok(/e\.general\)\{ for\(const id of heavyPick\(2\)\)/.test(ar) && T.drop.rpg>T.drop.rifle && /MEDAL/.test(ar) && /AMMO/.test(ar), 'the enemy drops his weapon; the general his two best and a medal');
  ok(/if\(generalBail\(pos, bdef, n=>bossStageWon\(n, bdef\)\)\) return;/.test(R('src/campaign/boss.js')) && /export function bossStageWon/.test(R('src/campaign/boss.js')) && /if\(e\.hitCap\) dmg=Math\.min\(dmg, e\.hitCap\)/.test(R('src/actors/damage.js')), 'the general jumps out of his burning machine, the duel decides the stage, no hit takes more than a slice');
  ok(T.general.fan.tel>=0.5 && T.general.nade.lock>=1 && T.general.callAt>T.general.rageAt && /makeArtLock/.test(gd) && /floatText\('!'/.test(gd), 'his fan of rounds and his grenades are both warned; guards at half health, rage at a third'); }

// Z344 the batched infantry cut at its own joints and skinned on the GPU: legs straightened for the cut, pivots where the model's bones are, a kneel that fits the legs, feet planted
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), rt=R('src/actors/real-troops.js'), so=R('src/actors/soldiers.js'), sk=R('src/actors/troop-skin.js'), T=C.REALTROOP;
  ok(/actors\/troop-skin\.js/.test(R('src/hub.js')) && ['export function troopSkinMesh','export function troopSkinWrite','gl_InstanceID','customDepthMaterial'].every(k=>sk.includes(k)), 'one skinned body a side, its joints read from a float texture, in the shadow pass too');
  ok(/aimB\(sd \+ 'UpLeg', sd \+ 'Leg', DN\)/.test(rt) && /const RJ = \{ hipL:at\('LeftUpLeg'\)/.test(rt) && /o = RJ\[k\]/.test(rt) && /function realPivots/.test(rt) && /joints:RJ, legs, skin/.test(rt), 'legs straightened before the cut; every piece cut and turned about the joint it has in the model');
  ok(/makeSoldierMesh\(\{ enemy:false, own:true \}\)/.test(R('src/actors/general.js')) && /soldierKneel\(s, on\)/.test(R('src/world/pow.js')), 'the general keeps his blocky joints; the prisoners kneel through the same legs');
  { const L={ th:0.336, sh:0.424 }, K=T.kneel, H=L.th*Math.cos(K.rear)+K.kg, fa=K.front, b=Math.acos(Math.min(1,(H-L.th*Math.cos(fa))/L.sh)), front=L.th*Math.cos(-fa)+L.sh*Math.cos(b), rear=L.th*Math.cos(K.rear)+K.kg;
    ok(Math.abs(front-H)<0.005 && Math.abs(rear-H)<0.005 && b>0 && b<0.9 && H<0.5, 'kneeling: the right knee down, the left sole flat, the hips brought down onto them'); }
  ok(!so.includes('0.5*P.kw') && /u\.up\.position\.y = u\.base\.upY/.test(so) && /legReach\(u\)/.test(so) && T.stride.amp[0]<=0.6 && T.stride.drop<=0.06, 'the torso stays on the hips; the hips come down onto the legs, a foot on the ground');
  ok(T.skin===true && /tbKinds=K=>K\.skin \? \['body','gun'\]/.test(so), 'the real kit drawn as the skinned body and its rifle');
}
// Z345 the support hand on every weapon: the palm on the handguard's own underside (found from the model), cupped, the fingers curled up round it; out of reach, the gun comes across
{ const fs=await import('node:fs'); const C=await import('./config.js'), rc=fs.readFileSync('src/actors/real-cav.js','utf8'), G=C.GUNHOLD;
  ok(['ar','lmg','minigun','shotgun','sniper','rpg','gl','flamer','energy'].every(k=>typeof G[k].palm==='number' && G[k].palm>-0.3 && G[k].palm<0.05), 'every weapon has its support spot ahead of the magazine (Z348: the minigun too, under its barrels)');
  ok(/function palmSpot\(met, g, len\)/.test(rc) && /_ray\.intersectObject\(met, true\)/.test(rc) && G.palmGap>0 && G.palmGap<0.03, 'the spot found on the surface of the model, the palm just under it');
  ok(/for\(let it = 0; it < 2; it\+\+\)\{ if\(cup\)/.test(rc) && /LEGKIT\.aim\(D\.LeftHand, D\.LeftHandMiddle1, cup\)/.test(rc) && /palmP \? palmP\.clone\(\)\.addScaledVector\(_gz, -H\.wrap\[0\]\)/.test(rc), 'the palm itself put on the spot, the hand round the handguard, the fingers curled round it');
  ok(/if\(d > reach\)\{ _pd\.subVectors\(_pa, wl\)\.setLength\(d - reach\)/.test(rc) && G.reach>0.9 && G.reach<1, 'beyond the reach of the left arm (turned right round) the gun is brought across to the hand');
}

// Z354 into battle in three steps: who (tank / soldier), with what (hull + guns · trooper + ride + driver), where — XUẤT KÍCH from any step
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), bs=R('src/ui/battle-setup.js'), su=R('src/ui/setup-units.js'), html=R('index.html'), css=R('css/setup.css');
  ok(/id="bsRail"/.test(html) && /id="bsS1"/.test(html) && /id="bsS2"/.test(html) && /id="bsS3"/.test(html) && /id="bsNext"/.test(html) && /id="br-team"/.test(html) && /ui\/setup-units\.js/.test(R('src/hub.js')), 'the rail, the three steps, TIẾP and the briefing team strip are in the page');
  ok(/export function setStep/.test(bs) && /setStep\(tab \? 3 : 1\)/.test(bs) && /tapBtn\('bsGo', goBattle\)/.test(bs) && /ov\.dataset\.step = BS\.step/.test(bs), 'PLAY opens at step 1, the battlefield buttons at step 3, XUẤT KÍCH goes in from any step');
  ok(['tank','s2','op','cav','xeom','bagac','bantai'].every(k=>fs.existsSync('assets/units/'+k+'.webp')) && /assets\/units\//.test(su), 'every card is a photo from the game');
  ok(/drv:false/.test(su) && (su.match(/drv:true/g)||[]).length===3 && /BÁC TÀI LÁI/.test(su) && /TỰ CƯỠI/.test(su) && /bác quỳ xuống đầu hàng/.test(su), 'the horse is ridden by him, the three rides by the bác tài — and the card says what the driver does');
  ok(/_garFrom==='battleSetup'\) setupBack\(\)/.test(R('src/ui/garage.js')) && /_ldFrom==='battleSetup'\)\{ show\('battleSetup'\); setupBack\(\); \}/.test(R('src/ui/loadout.js')), 'the garage and the arsenal come back to the gear step');
  ok(/\.btn\.btn-primary\{--plate:linear-gradient\(180deg,#e2b443/.test(R('css/mil.css')) && /#battleSetup\[data-step="1"\] \.bs-s1/.test(css) && /@media \(max-height:560px\)\{\n  #briefing/.test(css), 'primary buttons stay yellow everywhere; one step shown at a time; the phone briefing fits'); }

// Z346 the infantry look up and carry at the ready (no faces and muzzles in the ground), the baked rifle laid level, the enemy's B40 the real launcher
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), so=R('src/actors/soldiers.js'), inf=R('src/actors/infantry.js'), rt=R('src/actors/real-troops.js'), CA=C.REALTROOP.carry;
  ok(CA.walk<0.2 && CA.run<0.35 && CA.keep>0.5 && CA.head>0.6 && /u\.armAdd = ready\*\(CA\.walk\+\(CA\.run-CA\.walk\)\*run\)/.test(so), 'not firing, the muzzle only a little under the horizon (it hung 25 to 50 degrees at the ground)');
  ok(/lean=\(P\.up\+\(u\.upAdd\|\|0\)\+P\.rx\)\*\(1-P\.pw\)/.test(so) && /-lean\*keep\+\(u\.aimTrim\|\|0\)/.test(so) && /u\.head\.rotation\.x=\(u\.hx\|\|0\)-lean\*CA\.head-P\.pw\*CA\.prone/.test(so), 'bent forward, the neck and the arms take the lean back: eyes on the horizon, the rifle up');
  ok(/aimTrim:Math\.asin\(bore\.y\)/.test(rt) && /setFromUnitVectors\(new THREE\.Vector3\(0, 0, 1\), bore\)/.test(rt) && /anchor\.gripQ = anchor\.muzzleQ/.test(rt), 'the baked rifle (cut 11 degrees muzzle-up along the palm line) laid level; attachments on the bore itself');
  ok(/if\(type==='rpg'\) rpgKit\(u\)/.test(inf) && /loadGLTF\('inf_rpg'\)/.test(inf) && /kitAttach\(u, u\.gun, L, 'grip'/.test(inf) && !inf.includes('ConeGeometry(0.12,0.34,10)'), 'the B40 is the real launcher, its grip in the right palm on the rifle line (no bare tube and cone)');
}
// Z347 the soldier's fighting stance: feet a shoulder's width apart, the left a step ahead, knees bent, leaning into the gun
{ const C=await import('./config.js'), up=(await import('node:fs')).readFileSync('src/actors/soldier-upper.js','utf8'), L=C.SOLDIER_LEGS.stand;
  ok(C.SOLDIER_UPPER.stance>0.1 && C.SOLDIER_UPPER.stance<0.3 && /\+ K\.stance \* fw/.test(up) && L.stance>=0.19 && L.stagger>=0.12 && L.hipK<0.96, 'stood or walking he leans into the gun from the hips, feet apart and staggered, knees bent');
}

// Z348 sat up straight on the horse and the pillion (no hunched back), the support hand round the handguard (not palm-up under it)
{ const fs=await import('node:fs'); const C=await import('./config.js'), up=fs.readFileSync('src/actors/soldier-upper.js','utf8'), rc=fs.readFileSync('src/actors/real-cav.js','utf8'), K=C.SOLDIER_UPPER.seat, G=C.GUNHOLD;
  ok(/export function seatUpright\(R, G, speed\)/.test(up) && /\[D\.Spine2, D\.Neck, lean - K\.chest\]/.test(up) && /mounted && !stand && !P\.trans\) seatUpright\(R, G, Math\.abs\(CV\.speed/.test(rc) && K.k>0.7 && K.lean<0.1 && K.chest>0, 'every link of the spine laid straight up from the hips on the horse and the pillion, the chest a touch proud');
  ok(G.cup[1]<0 && G.cup[0]>0.5 && G.wrap[0]>0.01 && G.wrap[0]<0.04 && /addScaledVector\(_gz, H\.wrap\[0\]\)\.addScaledVector\(_gy, H\.wrap\[1\]\)/.test(rc) && G.sniper.palm<-0.06 && /if\(moved\)\{ ik2\(D\.RightArm/.test(rc) && G.gripR && /LEGKIT\.aim\(D\.RightHand, D\.RightHandMiddle1, axR\)/.test(rc), 'the support palm on the handguard lower near side, the hand wrapped round it, the sniper hand off the magazine, no arm locked straight, the firing palm on the pistol grip');
}
// Z349 the pose studio: window.poseStudio measures and photographs how a soldier holds each weapon; tools/pose-studio.mjs runs it headless into report.html
{ const fs=await import('node:fs'); const C=await import('./config.js'), ps=fs.readFileSync('src/dev/pose-studio.js','utf8'), cli=fs.readFileSync('tools/pose-studio.mjs','utf8'), V=C.POSE_STUDIO.views;
  ok(/dev\/pose-studio\.js/.test(fs.readFileSync('src/hub.js','utf8')) && /export const poseStudio = \{ start, guns, equip, stance, measure, view, resume, suggest, sheet, aim, kick, reloadAt, reloadEnd, carry \}/.test(ps) && /window\.poseStudio = poseStudio/.test(ps), 'the studio in the page: start, guns, equip, stance, measure, view, resume, suggest (Z360 and each gun\'s fit sheet)');
  ok(['stand34','handsL','handsR','left','kneel','prone','mount','mountSide'].every(k=>V[k] && typeof V[k].side==='number') && C.POSE_STUDIO.ok.palm<=5 && /closestPointToPoint/.test(ps), 'named views round the soldier; palms measured to the gun surface itself');
  ok(/report\.html/.test(cli) && /report\.json/.test(cli) && /poseStudio\.measure\(\)/.test(cli) && /--suggest|SUGGEST/.test(cli) && /studio-shots/.test(fs.readFileSync('.gitignore','utf8')), 'the headless run writes pictures, report.json and report.html (kept out of git)');
}

// Z356 aiming for real: the chest squared to the target, the butt high in the pocket, the cheek on the stock (the eye behind the sight), the B41 grip
{ const fs=await import('node:fs'); const C=await import('./config.js'), rc=fs.readFileSync('src/actors/real-cav.js','utf8'), G=C.GUNHOLD;
  ok(/SQUARE TO THE TARGET/.test(rc) && G.square>0 && G.square<0.35 && /turnBone\(D\.Spine1, _gu, dq \* 0\.35\)/.test(rc), 'on his feet the chest faces the aim (the stand clip stood him bladed 60 degrees, the arms crossed)');
  ok(/function sightLine\(met, g, len\)/.test(rc) && /const weld = rk < 0 && !g\.hold && !tuck \? \(1 - \(R\.rdy \|\| 0\)\) \* \(1 - low\) : 0/.test(rc) && G.cheek.k>0.5 && G.pocket[1]>0, 'aiming, the neck bows and the head tilts the right eye onto the sight line found on the model; at the ready or reloading the head stays up');
  ok(G.rpg.butt[0]>G.rpg.grip[0] && G.rpg.grip[0]>0.25, 'the B41 grip is its real pistol grip, the shoulder behind it');
}

// Z355 three real guns for the soldier (AK-47 · M4 · MP5) · Z357 a humvee in the enemy camps and a ruined house among the ruins — Meshy community, CC0, cut down locally
{ const fs=await import('node:fs'); const C=await import('./config.js'), G=(await import('./src/data/guns.js')).GUNS, R=f=>fs.readFileSync(f,'utf8'), sz=f=>fs.statSync(f).size;
  ok(['ak','m4','mp5'].every(k=>fs.existsSync('assets/models/real/gun/inf/'+k+'.glb') && sz('assets/models/real/gun/inf/'+k+'.glb')<1.2e6 && C.INFGUN.guns[k] && C.GUNHOLD[k]) && ['t_ak','t_m4','t_mp5'].every(id=>G[id] && G[id].trooper && G[id].tier===2 && C.INFGUN.map[id] && C.GUN_BLURB[id]), 'three new hand weapons, each a light model with its length, grip and hold');
  ok(G.t_m4.spread<G.carbine.spread && G.t_m4.rng>G.t_ak.rng && G.t_ak.dmg>G.carbine.dmg && G.t_mp5.fireCd<G.t_ak.fireCd && G.t_mp5.rng<1, 'each its own role: the M4 precise and long, the AK heavy, the MP5 fast and short');
  ok(/id = e\.def\.rpg \? 't_rpg' : 't_ak'/.test(R('src/loot/soldier-arms.js')), 'an enemy rifleman drops his AK-47');
  ok(C.OUTPOST.veh.includes('mil_humvee') && C.OUTPOST.solid.includes('mil_humvee') && sz('assets/models/real/camp/mil_humvee.glb')<3.5e6 && C.REALRUIN.models.ruin_house && sz('assets/models/real/ruin/ruin_house.glb')<3.5e6 && C.REALRUIN.biomes.RUINS.keys.includes('ruin_house'), 'the humvee parks in the camps, the ruined house stands among the ruins, both kept small');
  ok(/CC0/.test(R('assets/models/real/SOURCES-community.txt')) && /meshy\.ai\/posts\//.test(R('assets/models/real/SOURCES-community.txt')), 'every community model is recorded with its source and licence'); }

// Z358 the new guns each sound, flash and kick their own way; every soldier's gun photographed from its own model
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), G=(await import('./src/data/guns.js')).GUNS, sy=R('src/audio/synth.js'), sf=R('src/combat/soldier-fire.js'), ga=R('src/ui/gunart.js');
  ok(G.t_ak.snd==='shoot_ak' && G.t_m4.snd==='shoot_m4s' && G.t_mp5.snd==='shoot_mp5' && /ak: +\{ r:.*sample:'rifleE', rate:0\.84/.test(sy) && /m4s: +\{ r:.*crack:0\.04, mech:1500/.test(sy) && /mp5: +\{ r:.*rate:1\.2/.test(sy) && /case 'shoot_ak': return play\('ak'/.test(sy) && /playbackRate\.value=\(D\.rate\|\|1\)/.test(sy), 'three voices: the AK deeper, the M4 a suppressed thup and clack, the MP5 quicker');
  ok(G.t_ak.flashK>1 && G.t_m4.flashK<0.5 && G.t_m4.supp && G.t_ak.kickK>1 && G.t_m4.kickK<1 && /\(g\.flashK \?\? 1\)/.test(sf) && /\(g\.kickK \|\| 1\)/.test(sf) && /rifleFX\(_v\.x, _v\.y, _v\.z, a0, g\.dmg \* n >= 40, g\.supp\)/.test(sf) && /if\(!noSmoke && /.test(R('src/fx/realwar.js')), 'each its own flash and kick; the suppressor swallows the smoke, the brass still flies');
  ok(/function renderHand\(id\)/.test(ga) && /loadGLTF\('inf_'\+k\)/.test(ga) && /GUNS\[id\]\.trooper && INFGUN\.map\[id\]/.test(ga), 'a soldier\'s gun is photographed from the model in his hands'); }

// Z358 the xe ôm driver sits tall: a straight back on the trunk's line (not curled over the bars), an upright Cub lean, braced not flung under the brakes
{ const fs=await import('node:fs'); const C=await import('./config.js'), dr=fs.readFileSync('src/actors/driver.js','utf8'), R=C.RIDE;
  ok(/SAT TALL, BACK STRAIGHT/.test(dr) && /\[B\.Spine2, B\.Neck, S2\.chest\]/.test(dr) && R.straight && R.straight.k>0.6 && R.straight.chest>0, 'each link of his spine laid on the trunk line, the upper back a touch proud');
  ok(R.fit.xeom.bend<=0.15 && R.fit.bagac.bend<=0.22 && R.sway.max<=0.22, 'a Cub ridden upright; the brakes throw him only a little forward');
}

// Z359 the soldier picks his primary rifle before the battle (the B41 always comes; the rest he finds)
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), su=R('src/ui/setup-units.js'), sf=R('src/combat/soldier-fire.js');
  ok(/PRIMARY_GUNS\.includes\(PROFILE\.trooperGun\) \? PROFILE\.trooperGun : 'carbine'; return \[main, 't_rpg'\]/.test(sf) && /PROFILE\.trooperGun = id; saveProfile\(\)/.test(su) && /SÚNG CHÍNH/.test(su) && /\.su-pgrid\{display:grid;grid-auto-flow:column;grid-auto-columns:calc\(\(100% - 24px\) \/ 4\)/.test(R('css/setup.css')), 'his guns to pick in the gear step (four in view, Z411 every one of them), the one picked goes in with the B41'); }

// Z361 the xe ôm driver's temper: his head turned to the soldier as he talks, panicked looks back under fire, fired up (a hand thrust ahead); the bike dies:
//   the kick-start, a boot to the tyre and a hop on one foot, a row with the soldier, then the repair
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), rn=R('src/actors/driver-rant.js'), dr=R('src/actors/driver.js'), da=R('src/actors/driver-acts.js'), rw=R('src/game/ride-wear.js'), T=C.RIDE_TALK, A=C.RIDE_RANT;
  ok(['export function driverStall','export function drvStallStep','export function drvStallLook','export function driverRant','export function driverLine','function kickStep','function argueStep','function giveupStep','function gestPoint','function gestHip','function gestShrug','function gestSlap','function walkTo'].every(k=>rn.includes(k)) && /actors\/driver-rant\.js/.test(R('src/hub.js')) && /export const drvHips = setHips/.test(da), 'driver-rant: the stall on the seat, the walk, the boot, the row, the wave-off, on the pelvis and limbs of driver-acts');
  ok(/D\.state === 'ride'\) driverStall\(H\)/.test(rw) && /if\(H\.broken\) driverStall\(H\)/.test(dr) && /else if\(DRIVER_RANT\.has\(D\.state\)\) driverRant\(H, D, dt\)/.test(dr) && /drvStallStep\(H, D, dt, v\); ridePose/.test(dr) && /DRIVER_RANT\.has\(D\.state\)[^;]*\) driverBack\(H\)/.test(rw), 'the engine dies under him (or will not go after a spill): he takes it badly first; a reset puts him back on the seat');
  ok(/D\.state === 'stall' && D\.hipUp/.test(dr) && /D\.state === 'stall' && D\.kickW > 0 && D\.kickFoot/.test(dr) && A.stall.n>=2 && A.stall.top[0]-A.stall.bot[0]>0.25 && A.stall.rise>0, 'the kick-start: his right foot on the lever, stamped down a good 30 cm, stood up off the seat on it');
  ok(A.argue.rounds[0]>=1 && A.argue.rounds[1]>=A.argue.rounds[0] && T.argue.d.length===T.argue.s.length && /!S\.firing && Math\.hypot/.test(rn) && A.giveup.fixK<1 && /D\.fixT \|\| XEOM\.wear\.fixT/.test(dr), 'the row: each answer paired with its line; none with the guns going; the repair after it is quicker');
  ok(['stall','kickstart','kick','ouch','argue','giveup','fixing','charge','behind'].every(e=>T[e] && T[e].d.length) && T.remount.d.some(l=>/gấp đôi/.test(l)), 'his lines: the dead engine, the kick-start, the boot, the hurt foot, the row, giving in, the spark plug, urging the soldier on, a look back in a panic');
  ok(C.RIDE.chat.yaw>0.4 && C.RIDE.chat.yaw<0.9 && C.RIDE.chat.fastYaw<C.RIDE.chat.yaw && /D\.chatT = now; D\.chatS =/.test(dr) && /D\.heardT = performance\.now\(\)/.test(dr), 'talking: his head turned back toward his passenger, less at speed; a nod at the answer');
  ok(C.RIDE.panic.yaw>1.2 && C.RIDE.panic.twist>0 && /talk\(D, 'behind'\)/.test(dr) && C.RIDE.charge.dur>1 && /function chargeArm/.test(dr) && /talk\(D, 'charge', true\)/.test(dr), 'panic: looks back over each shoulder; fired up: the left hand off the bar, jabbed ahead or a fist in the air'); }

// Z362 the driver on the saddle point again (a comment had swallowed his hips line in Z361), and stopped, his feet down under his hips
{ const fs=await import('node:fs'); const C=await import('./config.js'), dr=fs.readFileSync('src/actors/driver.js','utf8');
  ok(/hips\.parent\.worldToLocal\(_a\); hips\.position\.copy\(_a\); hips\.updateMatrixWorld\(true\);/.test(dr) && !/\/\/[^\n]*hips\.position\.copy\(_a\)/.test(dr), 'his hips laid on the saddle point every frame (no comment swallowing the line)');
  ok(/R\.hip\[2\] \+ FT\.hipFwd/.test(dr) && C.RIDE.feet.hipFwd>=0 && C.RIDE.feet.hipFwd<0.1 && C.RIDE.fit.xeom.hip[2]===-0.05, 'stopped, a foot down nearly under the hip (the leg straight, the knee soft), not stuck out ahead'); }

// Z360 the hold read off each gun's own model (actors/gun-fit.js): a made-up rifle profile read back into its parts and hands; the soldier's own arm slides
//   the left palm back rather than dragging the gun through his shoulder; the profile works out its own matrices (a gun is measured hidden, as it loads)
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), src=R('src/actors/gun-fit.js'), rc=R('src/actors/real-cav.js'), ps=R('src/dev/pose-studio.js'), G=C.GUNFIT;
  const GF=await import('data:text/javascript,'+encodeURIComponent(src.replace("import * as THREE from 'three';", 'const THREE = null;').replace("'../../config.js'", JSON.stringify(new URL('./config.js', import.meta.url).href))));
  const len=0.9, N=40, at=x=>x<-0.25?[0.06,0.1]:x<-0.05?[0.03,0.12]:x<0.08?[-0.17,0.12]:x<0.2?[0.02,0.12]:x<0.3?[-0.12,0.1]:x<0.44?[0,0.1]:[-0.06,0.1];
  const f=GF.fitHold([...Array(N)].map((_,k)=>{ const x=-0.5+(k+0.5)/N, [lo,hi]=at(x); return { x, lo, hi }; }), len, { kick:2 });
  ok(f && f.parts.grip[0]>=0.2 && f.parts.grip[1]<0.3 && f.parts.mag[0]>=-0.05 && f.parts.mag[1]<0.08 && f.parts.stock && !f.parts.vfg && Math.abs(f.bore-0.075)<1e-3, 'a rifle profile read into its parts: the bore at the muzzle, the pistol grip, the magazine ahead of it, the stock out to the butt, no foregrip');
  ok(Math.abs(f.palm-(f.parts.mag[0]-G.palmAhead/len))<1e-3 && f.slideTo>f.palm && f.slideTo<f.parts.mag[0] && Math.abs(f.grip[0]-(f.parts.grip[0]-G.gripAhead/len))<1e-3, 'the left palm a hand ahead of the magazine (sliding back no nearer than half a palm to it), the right hand at the grip front');
  ok(Math.abs(GF.underAt(f,-0.15)-0.03)<1e-3 && GF.underAt(f,0)>=f.bore-G.depth-1e-9 && f.rows.length===N && f.magDrop && Math.abs(f.mag[0]-(f.parts.mag[0]+f.parts.mag[1])/2)<1e-3 && f.bolt[0]>f.parts.mag[1] && f.bolt[0]<f.parts.grip[0], 'the palm height off the handguard underside, never down the magazine; the reload takes the magazine at its middle and racks the bolt between it and the grip');
  ok(/c\.updateMatrix\(\); const W = _M\(\)\.multiplyMatrices\(M, c\.matrix\)/.test(src) && !/root\.updateMatrixWorld/.test(src) && /const e = \(a, b\) =>/.test(src), 'the profile builds each part\'s matrix itself (hidden things are skipped by the renderer\'s matrix update) and samples along the edges');
  ok(['ar','lmg','shotgun','sniper','gl','energy','ak','m4','mp5','minigun','flamer'].every(k=>C.INFGUN.guns[k].fit) && !C.INFGUN.guns.rpg.fit && C.GUNHOLD.minigun.hold==='hip' && C.GUNHOLD.flamer.hold==='hip' && /hold:h\.hold, butt:\[\+\(fit\.grip\[0\] \+ h\.butt\[0\] - h\.grip\[0\]\)/.test(rc), 'every gun but the RPG (on the shoulder) held by the formula; the minigun and flamer still carried at the hip');
  ok(/g\.rows \? palmFit\(R, g, len, D, wl, fore, dt\) : palmSpot\(met, g, len\)/.test(rc) && /s = clamp\(s, 0, Math\.max\(0, \(g\.slideTo - g\.palm\) \* len\)\)/.test(rc) && /muzzle:\[-g\.len \/ 2, bore, 0\]/.test(rc) && /FIT\[k\] = Object\.assign\(fit, h\.hold/.test(rc) && !/\bg\.back\b[^\n]*slideTo/.test(rc), 'his left palm slid back along the handguard as far as his own arm needs; every muzzle on the real bore; the RPG reload flag kept apart');
  ok(/R\.pull = Math\.max\(0, d - reach\)/.test(rc) && /out\.pull = cm\(R\.pull/.test(ps) && /function sheet\(kind\)/.test(ps) && /sheet, aim, kick, reloadAt, reloadEnd, carry \}/.test(ps) && /--actions/.test(R('tools/pose-studio.mjs')) && /--sheet/.test(R('tools/pose-studio.mjs')) && G.ok.pull>0 && G.ok.muzzle>0, 'the studio measures how far the gun is dragged off the shoulder and draws each gun\'s fit sheet');
  { const r1=GF.gunRecoil({ dmg:12 }, 0.92), r2=GF.gunRecoil({ dmg:10, frags:8 }, 1.0), r3=GF.gunRecoil({ dmg:9, kickK:0.75 }, 0.68), r4=GF.gunRecoil({ dmg:95 }, 1.42);
    ok(r1.s===1 && r1.kick[0]===G.recoil.back && r1.shake[1]===G.recoil.roll && r2.s>r4.s && r4.s>r1.s && r3.s<1.2 && r2.s<=G.recoil.s[1], 'recoil from the round over the gun\'s weight: the carbine the unit, the shotgun\'s eight pellets hardest, the long 12.7 next, the light 9 mm SMG about the carbine'); }
  ok(/rc\.yv \+= \(Math\.random\(\) \* 2 - 1\) \* sh\[0\] \* j/.test(rc) && /_gy\.applyAxisAngle\(_gx, rc\.r\)/.test(rc) && /GUNKICK\[k\] = gunRecoil\(/.test(rc) && /g\.magDrop !== false/.test(rc) && /function carryPose\(R, D, g, len\)/.test(rc) && /R\.spr > 0\.001 && !g\.hold && !tuck && rk < 0\) carryPose/.test(rc) && /fv > \(C\.carryAt \?\? C\.gaitAt\[1\]\) && !S\.firing/.test(rc) && G.carry.yaw>0 && G.carry.up>0, 'each shot: the gun\'s own kick and a random twitch aside and round its bore; only a magazine drops; at a sprint the gun goes across his chest');
  ok(/sq = H\.square \+ \(R\.bx \|\| 0\)/.test(rc) && /R\.bx = clamp\(/.test(rc) && C.GUNHOLD.blade[3]>0 && C.GUNHOLD.blade[3]<1 && /const B = H\.blade; R\.bx = clamp\(/.test(rc) && /else if\(\(R\.bx \|\| 0\) > 1e-3\)\{ turnBone\(D\.Spine1/.test(rc) && C.GUNHOLD.blade[4]>0 && C.GUNHOLD.blade[4]<=1 && /const reach = armLen\(D, 'Left'\) \* H\.reach; D\.LeftArm\.getWorldPosition\(_pa\); const d = _pa\.distanceTo\(wl\);/.test(rc) && /bore - F\.boreUp/.test(src) && Math.abs(f.butt[1]-(f.bore-G.boreUp))<1e-3, 'a gun still too long for his arm: he turns further side-on (left shoulder forward) instead; every butt set by the bore, so each sight line sits alike over his shoulder'); }

// Z363 the driver's hammer, the ride coming to pick the soldier up, his breaks (a smoke on his heels, a pee), an old Honda's putter and its exhaust
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), br=R('src/actors/driver-break.js'), rn=R('src/actors/driver-rant.js'), dr=R('src/actors/driver.js'), rw=R('src/game/ride-wear.js'), cv=R('src/game/cavalry.js'), rc=R('src/game/ride-call.js'), em=R('src/audio/engine-music.js'), T=C.RIDE_TALK, K=C.RIDE_BREAK;
  ok(['export function driverBreakCheck','export function driverBreakStart','export function drvBreakPull','export function driverBreak','function smokeAct','function peeAct','function remount','function cigAt'].every(k=>br.includes(k)) && /actors\/driver-break\.js/.test(R('src/hub.js')), 'driver-break: the tired check, pulling over, the smoke, the pee, back on the seat');
  ok(/D\.tired = \(D\.tired \|\| 0\) \+/.test(br) && K.every[0]>=60 && K.calm>=10 && K.safeR>=20 && /quietAround\(H, K\.safeR\)/.test(br) && /D\.cut = true; driverLine\(D, 'cut'\)/.test(br), 'a break only after a long quiet ride (never on the first quiet moment), cut short by shots or an enemy close');
  ok(/if\(H && H\.onBreak\) return 0;/.test(rw) && /CV\.H\.onBreak \? 'BÁC TÀI ĐANG NGHỈ/.test(cv) && /BÁC TÀI ĐANG NGHỈ/.test(rc), 'pulled over: the ride held to a stop; the button and the mount say he is on his break');
  ok(/if\(pick\)\{ callRide\(p, true\); CV\.autoOn=true;/.test(cv) && /D\.pickup = true; if\(D\.onBack\) D\.onBack\(\)/.test(dr) && /H\.onBreak = false; D\.pickup = true;/.test(br) && /export function callRide\(p, quiet\)/.test(rc), 'the repair done or the break over: he rides over and the soldier climbs on');
  ok(/function bangStep/.test(rn) && /export function drvHammer/.test(rn) && /drvHammer\(D, k > 0\.6\)/.test(dr) && C.RIDE_RANT.bang.n>=2 && /D\.fixSide = p &&/.test(rn) && /const sd = D\.fixSide \|\| 1, rot = a =>/.test(dr), 'the hammer: three angry blows, then the repair with it in his fist, on the side of the bike away from the soldier');
  ok(/function maskDown\(D, down\)/.test(br) && ['smoke','puff','pee','peeing','rested','cut','bang'].every(e=>T[e] && T[e].d.length), 'his mask pulled down to smoke; his lines for the hammer and the break');
  ok(/export function cubLoop/.test(em) && /src\.playbackRate\.setTargetAtTime\(f\/CUB\.f0/.test(em) && /Math\.max\(0, ENGB\.rpm-0\.18\)\*58/.test(em) && C.XEOM.exhaust && C.XEOM.exhaust.xeom && /export function rideExhaust/.test(rw) && /keep:true \}\); \}/.test(rw) && /rideExhaust\(H, dt\)/.test(R('src/game/xeom.js')), 'an old Honda putter (each firing drawn, a weak one, the tappets) at a lazy idle; blue-grey smoke out of the muffler, never thinned away'); }

// Z365 the hold finished: the left arm's reach measured from the shoulder (not last frame's hand), a seated soldier turns side-on too, the hip guns on the formula,
//   a recoil close-up fixed to his body
{ const fs=await import('node:fs'); const C=await import('./config.js'), rc=fs.readFileSync('src/actors/real-cav.js','utf8'), cli=fs.readFileSync('tools/pose-studio.mjs','utf8');
  ok(/const reach = armLen\(D, 'Left'\) \* H\.reach; D\.LeftArm\.getWorldPosition\(_pa\);/.test(rc) && !/D\.LeftArm\.getWorldPosition\(_pa\); const reach = armLen/.test(rc), 'the reach checked from his shoulder: armLen reuses _pa, so the shoulder is read after it');
  ok(C.INFGUN.guns.minigun.fit && C.INFGUN.guns.flamer.fit && C.GUNHOLD.blade[3]>=0.7 && C.POSE_STUDIO.views.kick && C.POSE_STUDIO.views.kick.dist<1.6 && !C.POSE_STUDIO.views.kick.on && /shoot\('giat', 'kick'\)/.test(cli), 'the minigun and flamer on the formula; long guns turn him further side-on; the recoil seen from a camera fixed to him');
  ok(/g\.hold === 'hip' && D\.RightArm\)\{ const rR = armLen\(D, 'Right'\) \* H\.reach/.test(rc), 'a gun carried at the hip lifted toward his right shoulder until his right hand reaches the grip (short arms)'); }

// Z364 the smoke for real: the mask pulled down under his chin by hand (a second fitted copy), a cigarette out of his shirt pocket into his lips, lit off a lighter in his cupped hand, held between two fingers to his lips, the tip glowing with a thread of smoke
{ const fs=await import('node:fs'); const C=await import('./config.js'), br=fs.readFileSync('src/actors/driver-break.js','utf8'), dr=fs.readFileSync('src/actors/driver.js','utf8'), SM=C.RIDE_BREAK.smoke;
  ok(C.RIDE_MASK.drv_xeom.down>0.2 && /D\.maskDown = fitFaceMask\(/.test(dr) && /D\.maskDown\.material = D\.mask\.material/.test(dr) && /function maskDown\(D, down\)\{ if\(D\.mask\) D\.mask\.visible = !down;/.test(br), 'the mask pulled down under his chin (its own fit, the worn one\'s material); never left up while he smokes');
  ok(/D\.mouthL = D\.B\.Head\.worldToLocal/.test(dr) && /_mo\.copy\(D\.mouthL\)\.applyMatrix4\(B\.Head\.matrixWorld\)/.test(br), 'his mouth found on the mask cloth and carried on his head');
  ok(SM.mask>0 && SM.pack>0 && SM.light>0 && /function fingersTo/.test(br) && /function cigInHand/.test(br) && /function lighterAt/.test(br) && /toneMapped:false/.test(br) && /D\.cigTip/.test(br), 'out of the pocket, lit off the lighter, between two fingers to his lips, the tip glowing, a thread of smoke off it'); }

// Z366 the smoke leaning back on the saddle (the cool way): hips on its edge, the trunk tipped back, the ankles crossed, the free arm folded under the smoking elbow
{ const fs=await import('node:fs'); const C=await import('./config.js'), br=fs.readFileSync('src/actors/driver-break.js','utf8'), LN=C.RIDE_BREAK.lean;
  ok(LN && LN.hipY>0.6 && LN.hipY<0.95 && LN.feet>0.15 && LN.feet<0.45 && LN.back>0 && LN.cross>0 && /function leanPose/.test(br) && /function armAcross/.test(br) && /if\(br\.hip\) leanPose\(D, k, br\); else squat\(D, k, SM\.lean\)/.test(br) && /D\.br = \{ down, hip, spot:/.test(br), 'leaning on the saddle to smoke: hips on its edge, feet out a little, ankles crossed, the arm folded under the elbow'); }

// Z369 the rank's gift crate for real: under a parachute, floating with a glow, opened by walking into it; on the loop and cleared with the battle
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), g=R('src/loot/gift-crate.js'), G=C.GIFTBOX;
  ok(/loot\/gift-crate\.js/.test(R('src/hub.js')) && /updateGifts\(gdt, now\)/.test(R('src/game/loop.js')) && (R('src/game/flow.js').match(/clearGifts\(\)/g)||[]).length===2 && /spawnGift\(\{ x, z \}/.test(R('src/game/soldier-rank.js')), 'the crate is spawned on a rank-up, run every frame, cleared with each battle');
  ok(['export function spawnGift','export function updateGifts','export function clearGifts','function openGift','RoundedBoxGeometry'].every(k=>g.includes(k)) && /u\.st === 'fall'/.test(g) && /u\.st === 'wait'/.test(g) && /openGift\(u\)/.test(g) && !/PointLight/.test(g) && !/AdditiveBlending/.test(g) && /planks\('TIẾP TẾ'\)/.test(g) && /G\.smoke\.col/.test(g), 'Z370 a real airdrop: an olive crate down under a cargo chute, on the ground with a smoke marker, the lid swinging open; nothing glows');
  ok(G.drop.h>10 && G.size[0]<0.7 && G.reach>1 && G.smoke.every>0 && G.open>0 && C.TROOPER.gift.ahead>0, 'its numbers: the drop height, a small crate, how near he must come'); }

// Z368 the soldier on foot: a walk as he sets off, a run once the key is held; running tall (a runner's lean, his eyes on the way ahead, not his boots), the gun at the ready, across his chest only at a sprint
{ const fs=await import('node:fs'); const C=await import('./config.js'), cv=fs.readFileSync('src/game/cavalry.js','utf8'), up=fs.readFileSync('src/actors/soldier-upper.js','utf8'), rc=fs.readFileSync('src/actors/real-cav.js','utf8'), F=C.CAV.foot, RN=C.SOLDIER_UPPER.run;
  ok(F.walk>0.8 && F.walk<2 && F.walkT>0.2 && F.walkT<1.2 && F.run>F.walk*2.5 && F.sprint>F.run && /CV\.moveT = inp>0\.1 && CV\.stance==='stand' \? \(CV\.moveT\|\|0\)\+dt : 0;/.test(cv) && /CV\.moveT<F\.walkT\?F\.walk:back\?Math\.min\(F\.run, XHAIR\.turn\.backV\):F\.run/.test(cv), 'a walk as he sets off; the key held a moment and he runs (Z376: backing off from the crosshair at a walk)');
  ok(RN && RN.lean[1]>RN.lean[0] && RN.lean[1]<0.3 && RN.tilt<0.2 && /RUNNING TALL/.test(up) && /turnBone\(D\.Neck, RA, lift \* RN\.neck\)/.test(up), 'running: the trunk brought back to a runner\'s lean, the head lifted till his eyes are on the way ahead');
  ok(C.REALCAV.ready[1]<0.45 && /\(R\.rdy \|\| 0\) \* REALCAV\.ready\[1\]\) \* 0\.55/.test(rc) && C.REALCAV.carryAt>F.run && C.REALCAV.gaitAt[1]<F.run && /fv > \(C\.carryAt \?\? C\.gaitAt\[1\]\)/.test(rc), 'the gun at the ready running (the muzzle a little down, his eyes not following it), across his chest only at a sprint'); }

// Z370 the loot made real and simple: a dropped weapon is the gun itself, an olive aid bag, a medal; no light beam, no spinning; a small plain glyph
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), pw=R('src/loot/powerups.js');
  ok(/else if\(def\.gun && INFGUN\.map\[def\.gun\]\) realGun\(g, def\.gun\)/.test(pw) && /function realGun\(g, id\)/.test(pw) && /id:'wpn_' \+ id, gun:id/.test(R('src/loot/soldier-arms.js')) && /else if\(def\.id==='medal'\) medal\(g\)/.test(pw) && /lootMat\('medOlive'/.test(pw), 'an enemy weapon lies on the ground as itself; an olive aid bag with its red cross; a medal, not a glowing gem');
  ok(/svgGlyphTex\(def\.svg\|\|'star'\)/.test(pw) && /export function svgGlyphTex/.test(R('src/ui/icons.js')) && /u\.icon\.visible=u\.ring\.visible=true;/.test(pw) && !/u\.model\.rotation\.y \+= dt\*0\.9/.test(pw), 'no light beam, it lies where it fell, a small plain glyph over it'); }

// Z371 the war horse's stirrups and the rider's feet in them: his shins and boots out of the horse's barrel (the riding clips had them inside it), heels down, the gallop's stand-up brought down to the irons
{ const fs=await import('node:fs'); const C=await import('./config.js'), st=fs.readFileSync('src/actors/soldier-stirrups.js','utf8'), rc=fs.readFileSync('src/actors/real-cav.js','utf8'), T=C.STIRRUP;
  ok(T && T.iron[0]>0.4 && T.iron[1]>0.9 && T.iron[1]<1.25 && T.top[0]<T.iron[0] && T.reach<1 && T.drop>0.2 && T.heel>0, 'the irons hang outside the barrel at the belly, the leather from the saddle skirt; a gallop that lifts him out of reach brings him down');
  ok(/export function stirrupFeet/.test(st) && /function makeStirrups/.test(st) && /scene\.add\(strap, iron\)/.test(st) && /sb\.attach\(strap\); sb\.attach\(iron\)/.test(st) && /ik2\(up, kn, ft,/.test(st) && /actors\/soldier-stirrups\.js/.test(fs.readFileSync('src/hub.js','utf8')), 'stirrups made in the world and hung on the horse\'s seat bone; each leg laid by IK to its iron');
  ok(/if\(R\.pup && !P\.dead && !bike && mounted && !P\.trans\) stirrupFeet\(R, H\)/.test(rc), 'on the horse (not a ride, not climbing on or off) his feet go to the stirrups every frame'); }

// Z372 the soldier's HUD plain: his vitals alone (no tank compass, speed or range), one smooth health bar; the weapon chip without the damage-class tag
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'), ins=R('src/ui/instruments.js'), css=R('css/mil.css');
  ok(/INSTR\.el\.classList\.toggle\('sold', sold\); document\.body\.classList\.toggle\('m-soldier', sold\)/.test(ins) && /#instr\.sold \.in-dial,#instr\.sold \.in-row:not\(\.in-a\)\{display:none;\}/.test(css) && /body\.m-soldier #weaponchip \.wc-ty\{display:none;\}/.test(css), 'a soldier reads his health alone, in one bar; his gun chip has no damage-class tag'); }

// Z376 the crosshair is where the round goes: the point under it in the world (a man, a hull, a wall, the ground — not the ground behind them), for the mouse and the pad alike; the round from the muzzle straight to it; the rifle, chest, hips and feet come round to it
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), X=C.XHAIR, xh=R('src/combat/crosshair.js'), sf=R('src/combat/soldier-fire.js'), fl=R('src/combat/flame.js'), rc=R('src/actors/real-cav.js'), cv=R('src/game/cavalry.js');
  ok(X && X.reach>=120 && X.man.r>=0.3 && X.man.h>X.man.low && X.man.low>X.man.prone && X.man.lo+X.man.hi<X.man.prone+0.5 && X.fireTol>0 && X.fireTol<0.6 && X.turn.twist>0.5 && X.turn.twist<C.REALCAV.twistMax && X.turn.backV<C.SOLDIER_LEGS.stand.maxV && X.awake>0.5 && X.aimRate>C.REALCAV.aimRate, 'a man is a body his height to the eye; the chest takes less than it can before the hips turn; backing off is slow enough for his own legs');
  // the ray maths, lifted out of the module: a camera 10 m back and 5 m up looking at a man's chest 10 m out meets him; the same ray past a man 1 m aside misses; a box across the line stops it first
  { const pick=n=>{ const i=xh.indexOf('function '+n+'('); let d=0, k=xh.indexOf('{', i); for(;;k++){ if(xh[k]==='{') d++; else if(xh[k]==='}' && --d===0) break; } return xh.slice(i, k+1); };
    const mk=new Function('return (()=>{ let _t0=0, _t1=0; '+pick('rayCyl')+' '+pick('slab')+' '+pick('rayBox')+' return { rayCyl, rayBox }; })()')(), o={x:0,y:5,z:-10}, L=Math.hypot(10, 3.8), d={x:0,y:-3.8/L,z:10/L};
    const t=mk.rayCyl(o, d, 0, 0, 0.5, 0, 1.85), miss=mk.rayCyl(o, d, 1.2, 0, 0.5, 0, 1.85), wall=mk.rayBox(o, d, 0, -5, Math.PI/2, 2, 0.2, 0, 4);
    ok(t>0 && Math.abs(o.y+d.y*t-1.2)<0.3 && miss<0 && wall>0 && wall<t, 'the eye\'s ray meets the man it is laid on, not one beside him, and a wall in front of him first'); }
  ok(/export function eyeRay/.test(xh) && /export function updateCrosshair/.test(xh) && /_rc\.setFromCamera\(_n, XH\.camOk \? XCAM : camera\); _o\.copy\(_rc\.ray\.origin\); _d\.copy\(_rc\.ray\.direction\);/.test(xh) && /h\.e && h\.e\.def && h\.e\.def\.inf/.test(xh) && /export function fireLine/.test(xh) && /dropTo:a\.y - heightAt\(a\.x, a\.z\), dropDist:d/.test(xh), 'every frame the ray under the cursor is followed to the first thing it meets; a round is laid from the muzzle to that point');
  ok(/function padAim/.test(xh) && /ap\.y = heightAt\(ap\.x, ap\.z\) \+ XHAIR\.chest/.test(xh) && /put\(xe, ap\.x, ap\.y, ap\.z\)/.test(xh) && /crosshairPad\(\)/.test(R('src/input/gamepad.js')) && /crosshairMouse\(cx, cy\)/.test(R('src/input/input.js')), 'the pad takes up a man near its line or aims chest high, and draws the same crosshair on the screen');
  ok(/export function lineStop/.test(xh) && /inBlock\(bl, x, z, 0\.2\) && y < blockTop\(bl\) \+ LINE\.over/.test(xh) && /XH\.stop = st/.test(xh), 'where the line of fire meets something short of the crosshair, a red mark (a round never goes through)');
  ok(/export function camAimA/.test(xh) && /const la=camAimA\(p\)/.test(R('src/game/update.js')) && /updateCrosshair\(gdt, now\); updateAirAim\(gdt\)/.test(R('src/game/loop.js')), 'the camera leans the way the mouse last laid the aim (it no longer drags the point under a still cursor away)');
  ok(/const L = g\.special \? null : fireLine\(_v\.x, _v\.y, _v\.z\)/.test(sf) && /a0 = air \? air\.a : L \? L\.a : p\.aimSmoothed/.test(sf) && /dropTo:air \? air\.dropTo : L \? L\.dropTo : 1\.2/.test(sf) && /RF\.gunYaw - L\.a/.test(sf) && /fireLine\(sx0, sy0, sz0\)/.test(fl), 'the soldier\'s round (and the tank\'s shell) go from the muzzle to the crosshair; on foot the trigger waits for the rifle to come onto it');
  ok(/ty = XH\.live \? S\.aimPoint\.y/.test(rc) && /!S\.firing && !CV\.aimUp\)/.test(rc) && /mounted \? C\.aimRate : XHAIR\.aimRate/.test(rc) && /awake=CV\.aimUp=!sprint && \(aimAwake\(now\) \|\| offA>XHAIR\.turn\.twist\)/.test(cv) && /runA\+Math\.sign\(dA\)\*\(Math\.abs\(dA\)-XHAIR\.turn\.twist\)/.test(cv), 'the rifle laid on the crosshair\'s own point and kept up on it; past what the chest can take the hips and feet turn'); }

// Z377 a soldier lying flat (still or crawling) is not seen by far or high enemy guns until close, caught in a searchlight's pool or firing; the combat roll dodges rounds better than running
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), T=C.STEALTH, st=R('src/game/stealth.js'), lk=R('src/combat/lock-on.js'), tw=R('src/world/towers.js'), inf=R('src/actors/infantry.js'), tac=R('src/ai/tactics.js');
  ok(T && T.see[0]>0 && T.see[0]<T.see[1] && T.see[1]<TOWER.range*0.65 && T.see[1]<=C.INFANTRY.rifle.range/2 && T.night>0 && T.night<1 && T.alertR>T.see[1] && T.alertR<=Math.max(TOWER.range, C.INFANTRY.rifle.range)+6 && T.keep.lit>=T.keep.near && T.keep.shot>0 && T.lit>=1, 'lying flat he is made out only well inside a guard\'s or rifleman\'s range (less at night); once spotted, every gun within alertR knows where he lies for a few seconds');
  ok(T.evade.roll>=0.5 && T.evade.roll<1 && T.evade.run>0 && T.evade.run<=T.evade.roll/3 && T.evade.v[0]<C.CAV.foot.run && T.evade.v[1]>=C.CAV.foot.sprint-0.01, 'a round that would hit him misses most of the time while he rolls, only now and then while he sprints');
  ok(/export function playerSeen\(x, y, z\)/.test(st) && /export function stealthShot\(\)/.test(st) && /export function stealthLight\(L\)/.test(st) && /export function dodgeShot\(p\)/.test(st) && /CV\.stance === 'prone' && !CV\.roll/.test(st) && /game\/stealth\.js/.test(R('src/hub.js')), 'one place decides whether the enemy can see him (only lying flat, not rolling, not on the ride, can he go unseen)');
  // the decision itself, lifted out of the module: a man lying 9 m from a guard 7 m up is unseen by day, seen once he crawls 3 m from its foot, seen by anyone within alertR once spotted, always seen standing
  { const pick=(src, n)=>{ const i=src.indexOf('function '+n+'('); let d=0, k=src.indexOf('{', i); for(;;k++){ if(src[k]==='{') d++; else if(src[k]==='}' && --d===0) break; } return src.slice(i, k+1); };
    const env={ CV:{ mounted:false, trans:false, stance:'prone', roll:null }, S:{ player:{ cav:true, pos:{ x:0, z:0 }, vel:{ x:0, z:0 }, spotUntil:0 } }, NIGHT:{ k:0 }, STEALTH:T, heightAt:()=>0, floatText:()=>{} };
    const mk=new Function(...Object.keys(env), 'let _sayAt=-9; const now_=()=>performance.now()/1000; function say(){} function inSight(){ return true; } '+pick(st,'playerHidden')+pick(st,'spot')+pick(st,'playerSeen')+' return { playerSeen };');
    const { playerSeen }=mk(...Object.values(env)), P=env.S.player, at=(x, y, v)=>{ P.pos.x=x; P.vel.x=v||0; P.spotUntil=0; return playerSeen(0, y, 0); };
    const farProne=at(9, 7.2), farStill=at(15, 1.6), nearCrawl=at(3, 7.2, 0.7), nearGround=at(5, 1.6); env.CV.stance='stand'; const stand=at(25, 7.2); env.CV.stance='prone';
    env.NIGHT.k=1; const nightNear=at(6, 1.6); env.NIGHT.k=0; P.pos.x=20; P.spotUntil=performance.now()/1000+5; const spotted=playerSeen(0, 7.2, 0); P.pos.x=T.alertR+2; const spottedFar=playerSeen(0, 1.6, 0);
    ok(!farProne && !farStill && nearCrawl && nearGround && stand && !nightNear && spotted && !spottedFar, 'prone 9 m from a guard 7 m up / 15 m from a rifleman: unseen; crawling at the tower\'s foot or 5 m from a man: seen; 6 m off at night: unseen; spotted: seen within alertR, not beyond; standing: always'); }
  ok(/export function towerGuardAim\(x, z, y\)/.test(tw) && /seen=y==null \|\| playerSeen\(x, y, z\)/.test(tw) && /towerGuardAim\(_tw\.x, _tw\.z, _tw\.y\+1\.5\)/.test(tw) && /if\(!tg\)\{/.test(tw) && /updateSearchlight\(t\.light, NIGHT\.k\); stealthLight\(t\.light\);/.test(tw) && /L\.r=r\*1\.15; L\.st=stretch; L\.ux=_d\.x\/hl; L\.uz=_d\.z\/hl;/.test(R('src/fx/searchlight.js')), 'tower and wall-top guards hold fire on a man they cannot see and watch their sector; a searchlight\'s pool on him gives him away');
  for(const [f, re] of [['src/world/bridges.js', /aiming=d<TOWER\.range && playerSeen\(/], ['src/world/radar.js', /if\(d>SUPPLYB\.aa\.range \|\| !playerSeen\(/], ['src/world/underbase.js', /if\(d>C\.turretR \|\| !playerSeen\(/], ['src/world/supply.js', /dp < SUPPLYB\.alertR && playerSeen\(/], ['src/actors/enemies.js', /if\(d > 30 \|\| !playerSeen\(/], ['src/actors/helis.js', /if\(d>T\.gunR \|\| !playerSeen\(/], ['src/actors/vehicles.js', /d > R\.range \|\| !playerSeen\(/]])
    ok(re.test(R(f)), f+': this gun (or alarm) asks first whether it can see him');
  ok(/seen=playerSeen\(e\.pos\.x, heightAt\(e\.pos\.x,e\.pos\.z\)\+1\.6, e\.pos\.z\)/.test(inf) && /return best \|\| \{ pos:e\.lk \|\| \{ x:e\.pos\.x, z:e\.pos\.z \}, vel:_INF0, tank:false, lost:true \}/.test(inf) && /!\(e\.aimT>0\) && !T\.lost && S\.mode==='playing'/.test(inf), 'a rifleman who cannot see him goes to look where he last saw him and never fires at nothing');
  ok(/if\(targetPlayer\)\{ if\(playerSeen\(/.test(tac) && /else \{ targetPlayer=false; target = e\.lk \|\| \(core \? core\.pos : \(e\.lk=e\.pos\.clone\(\)\)\); \}/.test(tac) && /laid && !e\._idle && target!==e\.lk\)/.test(tac) && /d < def\.range && target!==e\.lk\)/.test(tac), 'an enemy tank\'s crew that cannot see him makes for where they last saw him and holds its gun');
  ok(/t\.cav\.mounted \? 'mounted' : t\.cav\.roll \? 'prone' :/.test(lk) && /!\(dodgeShot\(p\) && \(b\.dodged=true\)\)\)\{ const _was=now>=p\.invincibleUntil; damagePlayer/.test(lk) && /if\(!b\.dodged && !\(wb && pastFace\(b, p\.pos\.x, p\.pos\.z\)\) && dpx\*dpx/.test(lk) && /o\.owner==='p' && o\.reach!=null\)\{ const P=S\.player; if\(P && P\.cav && \(x-P\.pos\.x\)\*\*2\+\(z-P\.pos\.z\)\*\*2 < 9\) stealthShot\(\);/.test(lk) && /reach, y:_v\.y/.test(R('src/combat/soldier-fire.js')), 'going over in a roll he is as low as a man lying flat and a round that would hit him mostly flies on past; his own shots (not his mates\') give him away'); }

// Z378 the see-through seams in the fortress walls opened into real breaches: the soldier and the xe ôm through them, a tank not
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), G=C.FORT_GAP, fo=R('src/world/fortress.js'), ss=R('src/world/solid-shape.js');
  ok(G && G.w>2*C.CAV.radius.mounted+0.3 && G.w<3 && G.minRep>=3 && G.bin>0 && G.bin<=0.5 && G.guard>0, 'a breach wide enough for the ride\'s collider with room to steer, too narrow for a tank\'s hull');
  ok(/function cutFace\(g, xc, dir, mid, like\)/.test(fo) && /const G=FORT_GAP, open=rep>=G\.minRep, half=G\.w\/2;/.test(fo) && /open && s===0 && pc\.prev \? 1 : open && s===rep-1 && pc\.next \? 2 : 0/.test(fo) && /if\(v===1\) pc\.cut0=half\*sx-0\.03; if\(v===2\) pc\.cut1=half\*sx-0\.03;/.test(fo) && /mt=\[mat, f\.wallIM\.material\]/.test(fo), 'only inside a run of wall (never at a tower or the gate), the two stretches either side cut back and their cut faces filled, their sections\' stone ends recorded');
  ok(/export function solidShape\(bl, foot\)/.test(ss) && /if\(foot && bl\.kind === 'fortwall' && bl\.piece && \(bl\.piece\.cut0 \|\| bl\.piece\.cut1\)\)/.test(ss) && /const SH=solidShape\(b, true\);/.test(R('src/game/cavalry.js')) && !/solidShape\([a-z]+, true\)/.test(R('src/world/physics.js')), 'the soldier and his ride meet the cut-back sections; tanks (world/physics.js) still meet the whole ones');
  // the shape itself, lifted out: a 3 m section cut back 1.3 m at its start is 1.7 m of stone starting 1.3 m in for the soldier, the whole 3 m for a tank
  { const i=ss.indexOf('export function solidShape('); let d=0, k=ss.indexOf('{', i); for(;;k++){ if(ss[k]==='{') d++; else if(ss[k]==='}' && --d===0) break; }
    const fn=new Function('FORT', 'cityBuildings', 'const SHAPE=Symbol(), FOOT=Symbol(); '+ss.slice(i+7, k+1)+' return solidShape;')(C.FORT, ()=>[]);
    const pc={ ux:1, uz:0, pl:3, cut0:1.3 }, bl={ kind:'fortwall', piece:pc, x:10, z:0 }, foot=fn(bl, true), tank=fn(bl);
    ok(Math.abs(foot.obb.hl-0.87)<1e-6 && Math.abs(foot.x-10.65)<1e-6 && Math.abs(tank.obb.hl-1.52)<1e-6 && tank.x===10 && foot.obb.hw===tank.obb.hw, 'cut back 1.3 m: the soldier meets 1.7 m of stone from 1.3 m in; a tank the whole section'); } }

// Z382 one crosshair, its colour telling the shot (yellow there · red stopped short · grey out of reach) instead of a red X beside it; the crosshair looks through a steady camera (the shot's kick and the shake no longer drag its point); a burst holds the point it was fired at; the tank's shot waits for the turret to be on it
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), X=C.XHAIR, xh=R('src/combat/crosshair.js'), up=R('src/game/update.js'), fl=R('src/combat/flame.js');
  ok(X.tankTol>0 && X.tankTol<0.1 && X.anchor.cam>1 && X.anchor.cam<8, 'the turret within a few degrees of the crosshair fires; a burst holds its mark until the camera has really moved');
  ok(/export const XCAM = new THREE\.PerspectiveCamera/.test(xh) && /export function steadyCam/.test(xh) && /camera\.position\.copy\(camBase\);\n  steadyCam\(camBase, camTarget\.x, /.test(up) && up.indexOf('steadyCam(camBase')<up.indexOf('const g=camShakeGain()'), 'the crosshair\'s camera is the follow camera\'s pose before the kick and the shake');
  ok(/const RING = \{ ok:'#ffce4a', block:'#ff3b2a', far:'#9a9a9a' \}/.test(xh) && /XH\.state = st \? 'block' : far \? 'far' : 'ok'/.test(xh) && /pointer\(CURSOR\[XH\.state\]\)/.test(xh) && !/xhairStop|STOPSVG/.test(xh) && /far = !st && d > shotReach\(g\)/.test(xh), 'one crosshair: yellow / red (stopped short) / grey (out of reach), no second mark');
  ok(/if\(A && \(!S\.firing \|\| XH\.mouseAt > A\.t \|\| XCAM\.position\.distanceTo\(A\.cam\) > XHAIR\.anchor\.cam/.test(xh) && /if\(!pad && S\.firing && !XH\.anchor\)/.test(xh), 'the trigger held and the mouse still: the burst stays on its point (or its man)');
  ok(/if\(Math\.abs\(off\)>XHAIR\.tankTol\) return; \}/.test(fl) && fl.indexOf('XHAIR.tankTol')<fl.indexOf('p.fireAt = now + g.fireCd'), 'the tank\'s shot waits for the turret (before any ammunition is spent)'); }

// Z388 the fallback rig turns round in the saddle as the real one: hips + chest to ±170°, thighs along the horse, held / swung back, the trigger reads its bore
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), g=R('src/actors/general.js'), f=R('src/combat/soldier-fire.js'), cv=R('src/game/cavalry.js');
  ok(/import \{[^}]*REALCAV, RIDER_TURN[^}]*\} from '\.\.\/\.\.\/config\.js'/.test(g) && /const lead = RP && RP\.stand \? bedTurn\(u, dt, twist\) : seatTwist\(u, H, dt, twist\)/.test(g) && /const tgt = cl\(u\.tu, -RT\.max, RT\.max\)/.test(g) && /const L = Math\.PI \+ RT\.flip/.test(g) && /hipMax = H\.bike \? C\.seatTurn\[1\] : RT\.hip/.test(g) && /const twLim = RT\.max - hipMax/.test(g), 'the fallback rig: the same limits as the real one (max, flip, hips on the seat, the chest the rest)');
  ok(/Lg\.hip\.rotation\.set\(Lg\.hip\.rotation\.x, -u\.hy, Lg\.hip\.rotation\.z, 'YXZ'\)/.test(g) && /u\.body\.rotation\.y = u\.hy; u\.up\.rotation\.y = u\.tw/.test(g) && /u\.gunYaw = Math\.atan2\(_sf\.x, _sf\.z\)/.test(g) && !/Math\.max\(-2\.0, Math\.min\(2\.0, twist\)\) - u\.up\.rotation\.y\)\*Math\.min\(1, dt\*10\);\n  if\(u\.arms\)/.test(g), 'his hips turn on the saddle, his thighs stay along the horse, the old ±2.0 chest clamp is only for standing in a bed; the bore is kept for the trigger');
  ok(/CV\.mounted && \(CV\.real \|\| CV\.G && CV\.G\.userData\)/.test(f) && /seatTurnOff\(G\)/.test(cv) && /export function seatTurnOff/.test(g), 'the trigger waits on the fallback rig too; off the horse his hips square again'); }

// Z381 the gun seated in its turret: a weapon mounted on a real Meshy turret slides back into its face (the procedural turret's trunnion left it floating
//   in front of the T-90 / Type 99 turrets, the pods and twin mounts out in the air, the rail gun over the dome), never so far its full recoil leaves the turret's back; the air left closed by a sleeve, a mantlet or a pedestal that lays with the gun
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), G=C.GUNSEAT, sg=R('src/tank/seat-gun.js');
  ok(G && G.embed>0 && G.embed<0.3 && G.maxShift>=1.6 && G.rays>=6 && G.ring.every(k=>k>0.5 && k<2) && G.pick>=0 && G.pick<=0.5 && G.recoil>=1 && G.sleeve.r[0]<G.sleeve.r[1] && G.sleeve.k>1, 'the breech goes a little into the face; far enough for the T-14; rays on rings round the breech, not down its bore');
  ok(/export function seatBarrel/.test(sg) && /export function barrelRoot/.test(sg) && /_rc\.intersectObjects\(turM, false\)/.test(sg) && /room = zMin - \(tail \+ G\.back \+ travel\)/.test(sg) && /bu\.z0 -= dz; bu\.seatDz = dz;/.test(sg) && /if\(bu\.seatDz\)\{ bu\.z0 \+= bu\.seatDz; bu\.seatDz = 0; \}/.test(sg) && /want = zMin - \(near - G\.embed\)/.test(sg) && G.slidePick>G.pick, 'the face measured round the breech; a tube slides in no further than the face needs, capped by the turret\'s back at full recoil; seated again from where it was authored');
  ok(/backed = \[-G\.band, 0, G\.band\]\.every\(k => behind\(ay \+ k \* rh\)\) && \[-G\.band, 0, G\.band\]\.every\(k => over\(ax \+ k \* rw\)\)/.test(sg) && /if\(backed \|\| \(face == null && floor == null\)\)/.test(sg) && /if\(bu\.elevates === false\) return null;/.test(sg), 'a gun whose back the turret already hides (from the side and from above) is left be — no block grows on every tank; the roof-mounted lobbers are left alone');
  ok(G.hitBulk>0.25 && G.hitBulk<G.hitK && G.bulkReach>0.1 && G.bulkReach<1 && /if\(face == null && !slim && floor == null && back\.length >= pts\.length \* G\.hitBulk && zMin - f0 <= G\.bulkReach\) face = f0;/.test(sg), 'Z381b a bulky gun\'s back (a launcher pod wider than the turret\'s face) with nothing under it finds the face from fewer of its rays when it is close behind it — the Ghost\'s pod is joined, every other joint stays as it was');
  ok(/gp\.add\(m\); u\.gunSleeve = m;/.test(sg) && /const mat = turM\[0\]\.material/.test(sg) && /put\(geo, 'gun_sleeve'\)/.test(sg) && /put\(geo, 'gun_mantlet'\)/.test(sg) && /const floor = below\.length >= /.test(sg) && /const bot = floor != null \? floor - G\.embed/.test(sg) && G.block.w>0.3 && G.drop>0.5 && G.slim>0.1 && G.slim<0.6, 'the air left is closed in the turret\'s own paint, on the gun\'s pivot: a sleeve round a tube with only air behind it, else a mantlet round the gun\'s back from the face and down onto the turret under it');
  ok(/ud\.gunId=id; seatBarrel\(mesh\);/.test(R('src/tank/barrels.js')) && /if\(u\.gunId\) seatBarrel\(g\); \}/.test(R('src/tank/real-tanks.js')) && /const root = barrelRoot\(g\); if\(root\) seatBarrel\(root\); \}/.test(R('src/tank/real-guns.js')) && /bg\.position\.z = \(bg\.userData\.z0 \?\? -TRUNNION_Z\) - rig\.recoil\*rig\.recoilLen/.test(R('src/tank/rig.js')), 'seated when a weapon is mounted, when the real turret comes late and when the real gun model comes late; the rig recoils it from its seat'); }

// Z389 the fallback rig standing in a bed turns any way round by stepping, as the real one; the trigger waits for its bore there too
{ const fs=await import('node:fs'), C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), g=R('src/actors/general.js'), f=R('src/combat/soldier-fire.js'), ST=C.REALCAV.standTurn;
  ok(ST[1] > 0.5 && ST[2] >= ST[1] && ST[3] > 0.2 && ST[3] < 1 && C.REALCAV.twistMax > ST[1], 'a step when the aim is well off his hips, a step at least as big as that, in under a second; his chest reaches past the step point');
  ok(/function bedTurn\(u, dt, twist\)/.test(g) && /if\(Math\.abs\(u\.tu\) > TAU\)\{ const w = Math\.sign\(u\.tu\)\*TAU; u\.tu -= w; u\.av -= w; u\.hy -= w;/.test(g) && /if\(!u\.step && Math\.abs\(u\.av - u\.hy\) > ST\[1\]\) u\.step = \{ from:u\.hy, to:u\.hy \+ cl\(u\.av - u\.hy, -ST\[2\], ST\[2\]\), t:0 \}/.test(g) && /cl\(u\.av - u\.hy, -C\.twistMax, C\.twistMax\)/.test(g), 'in a bed: no limit and no flip, he steps his hips round the short way, the chest twists the rest');
  ok(/Lg\.sx === side \? \(S\.t < 0\.5/.test(g) && /Lg\.hip\.rotation\.x -= k\*0\.35; Lg\.knee\.rotation\.x \+= k\*0\.7/.test(g), 'each step lifts the turning-side foot first, then the other');
  ok(/if\(\(u\.sat \|\| u\.bed\) && !u\.realOp\)/.test(g) && /R && \(R\.sat \|\| R\.bed\) && R\.gunYaw != null/.test(f) && /u\.sat = u\.bed = false/.test(g), 'the bore kept in a bed too, the trigger waits for it; off the ride all forgotten'); }

// Z380 no round goes through anything solid: every round tested along its whole stretch each frame against the true shape and height of what it crosses; enemy guns hold fire with no clear line to the soldier
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), sl=R('src/combat/solid-line.js'), lk=R('src/combat/lock-on.js'), st=R('src/game/stealth.js'), T=C.STEALTH;
  ok(/export function segBlock\(bl, ax, az, bx, bz, pad, out\)/.test(sl) && /export function blocksAlong\(/.test(sl) && /export function lineHit\(ax, ay, az, bx, by, bz, pad, over, skip\)/.test(sl) && /export function lineClear\(/.test(sl) && /export function inShape\(bl, x, z\)/.test(sl) && /combat\/solid-line\.js/.test(R('src/hub.js')), 'one place finds the first solid thing on a stretch, by its true box or circle and its height');
  // the maths, lifted out: a round 1.5 m along a frame crossing a brick wall 0.62 m thick is stopped (testing only where it ends up, it stepped clean over);
  // 4.5 m up it clears the 2.7 m wall; a guard's eye 7.2 m up looking at a man just behind the wall is blocked, at a man 15 m past it is not
  { const pick=n=>{ const i=sl.indexOf('function '+n+'('); let d=0, k=sl.indexOf('{', i); for(;;k++){ if(sl[k]==='{') d++; else if(sl[k]==='}' && --d===0) break; } return sl.slice(i, k+1); };
    const wall={ x:0, z:0, r:1.55, obb:{ f:0, hl:1.5, hw:0.31 }, top:2.7 }, B=[wall];
    const env={ solidShape:bl=>bl.obb ? bl : null, blockTop:bl=>bl.top, blocksNear:(x, z, r, out)=>{ out.length=0; for(const b of B) if(Math.hypot(b.x-x, b.z-z)<r+3) out.push(b); return out; } };
    const mk=new Function(...Object.keys(env), 'const _near=[], _seen=new Set(), _hit={ bl:null, t:1 }, _sb={ t0:0, t1:1 }, _cand=[]; '+pick('segBlock')+pick('inShape')+pick('blocksAlong')+pick('lineHit')+' return { lineHit, inShape };');
    const { lineHit, inShape }=mk(...Object.values(env)), end=(x)=>Math.abs(x)<0.31+0.22;   // (the old test: only where the round ends up)
    const got=h=>h && { bl:h.bl, t:h.t }, h1=got(lineHit(-0.7, 1.3, 0, 0.8, 1.3, 0, 0.22, 1.2, null)), h2=got(lineHit(-0.7, 4.5, 0, 0.8, 4.5, 0, 0.22, 1.2, null)), h3=got(lineHit(-20, 7.2, 0, 0.8, 1.75, 0, 0, 0, null)), h4=got(lineHit(-20, 7.2, 0, 16, 1.75, 0, 0, 0, null));   // (its answer is one shared object: read it at once)
    const own=lineHit(0, 1.3, 0, 5, 1.3, 0, 0.22, 1.2, bl=>inShape(bl, 0, 0));
    ok(!end(0.8) && h1 && h1.bl===wall && h1.t>0.05 && h1.t<0.2 && !h2 && h3 && !h4 && !own, 'a fast round no longer steps over a thin wall; a high one clears it; an eye up a tower sees past a wall only far enough beyond it; what the shooter stands in never stops him'); }
  ok(/lineHit\(b\._hx, py, b\._hz, b\.x, _wy, b\.z, b\.r, b\.line \? LINE\.over : 1e4, _bskip\)/.test(lk) && /else if\(wb\)\{ strikeBlock\(b, wb\); recycleBullet\(i\); \}/.test(lk) && /inShape\(bl, b\.ox, b\.oz\)/.test(lk) && !/let blocked=false;/.test(lk) && /function pastFace\(b, x, z\)/.test(lk) && /if\(!b\.dodged && !\(wb && pastFace\(b, p\.pos\.x, p\.pos\.z\)\)/.test(lk) && /if\(wb && pastFace\(b, e\.pos\.x, e\.pos\.z\)\) continue;/.test(lk), 'each round is stopped at the face of the first solid thing on this frame\'s stretch, and strikes it only after anyone standing in front of it has had his chance to be hit — nobody behind the face, however close to it');
  ok(/if\(!inSight\(x, y, z\)\) return false;/.test(st) && st.indexOf('if(!inSight(x, y, z)) return false;')<st.indexOf('if(!playerHidden()) return true;') && /hy = heightAt\(p\.pos\.x, p\.pos\.z\) \+ \(C\.head\[st\]/.test(st) && /lineClear\(x, y, z, p\.pos\.x, hy, p\.pos\.z\) \|\| lineClear\(x, y, z, p\.pos\.x \+ sx, hy - C\.drop, p\.pos\.z \+ sz\) \|\| lineClear\(x, y, z, p\.pos\.x - sx/.test(st) && T.side>0.1 && T.side<0.5 && T.drop>0 && T.drop<T.head.crouch && T.head.prone<T.head.crouch && T.head.crouch<T.head.stand && T.head.stand<T.head.mounted && T.sightT>0 && T.sightT<0.5, 'no enemy gun takes him through a wall, a house, a rock or cover — standing or lying — the eye must reach his head or a shoulder (a post hides no man)');
  ok(/b\.supply\|\|b\.hp===Infinity\)/.test(R('src/world/supply.js')) && /if\(b\.hp===Infinity \|\| KEEP\.has\(b\.kind\) \|\| b\.fort \|\| b\.supply \|\| Math\.hypot\(b\.x-x,b\.z-z\)>=b\.r\+R\) continue;/.test(R('src/world/supply.js')) && C.SCENERY.models.oil_drum.solid && C.SCENERY.models.oil_drum.solid.disc>0 && /export function blockTop\(bl\)\{ if\(bl\.bld\)\{ const B=bl\.bld, f=!B\.dead && B\.top>=0 \? B\.floors\[B\.top\] : null; return f && f\.y1!=null \? f\.y1/.test(lk) && /kind:'keep', _top:f\.gy\+KH, _topHp:Infinity/.test(R('src/world/fortress.js')), 'every circle of a village house as tall as the house; a supply base never clears away a house, a ruin or a scanned model\'s solid (its model stayed: men and rounds went through it); the scanned drums are cover; a city block is as tall as its highest floor still standing, the donjon as tall as the donjon (both stood 2 m high to rounds and eyes)'); }

// Z391 the real rig standing in a bed waits on the trigger for its bore too (it fired mid-turn with the bore 125° off the aim)
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), r=R('src/actors/real-cav.js'), f=R('src/combat/soldier-fire.js');
  ok(/R\.bed = braced && !P\.trans && !P\.dead; if\(!R\.sat && !R\.bed\) R\.gunYaw = null;/.test(r) && /R && \(R\.sat \|\| R\.bed\) && R\.gunYaw != null/.test(f) && r.indexOf('R.bed = braced') < r.indexOf('holdReal(R, G, dt, P)){'), 'standing in a bed the bore is kept (set again by the hold after) and the trigger waits for it'); }

// Z392 the scenery's distance copies light, the near scan whole but only up close, its maps to the GPU one a frame; phones' radar light; no raw Tripo in the app
{ const fs=await import('node:fs'), C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), sc=R('src/world/scenery.js'), J=JSON.parse(R('tools/scene-import.json')), im=R('tools/scene-import.mjs'), L=C.SCENERY.lod;
  ok(L.mid[0]<=30 && L.mid[1]<=2 && L.far[0]<=90 && L.far[1]<=5, 'the near scan shows only within ~30 m, the far copy from ~90 m');
  ok(/near = Math\.min\(idx\.length \/ 3, L\.base \|\| Infinity\)/.test(im) && /name:'d', tris:S\.tris, err:S\.err \?\? 0\.05, base:S\.lodBase, loose:S\.looseNear/.test(im) && /loose:S\.loose \|\| S\.looseMid/.test(im), 'the mid / far copies follow lodBase, looseMid lets a hard surface thin its mid copy');
  const heavy=Object.keys(J).filter(k=>J[k].tris===0||J[k].tris>200000).filter(k=>!J[k].out&&fs.existsSync('assets/models/real/scene/l/'+k+'.glb'));
  const tri=f=>{ const b=fs.readFileSync(f), j=JSON.parse(b.slice(20,20+b.readUInt32LE(12))); let t=0; for(const m of j.meshes) for(const p of m.primitives) t+=(p.indices!=null?j.accessors[p.indices].count:j.accessors[p.attributes.POSITION].count)/3; return t; };
  const fat=heavy.filter(k=>tri('assets/models/real/scene/l/'+k+'.glb')>80000);
  ok(heavy.length>15 && !fat.length, 'every mid copy of a heavy scan under 80k triangles' + (fat.length?' — over: '+fat.join(','):''));
  ok(/sceneLevel\(this\.key, 'd'\)\.then\(warmMaps\)\.then/.test(sc) && /renderer\.initTexture\(t\); await _frame\(\);/.test(sc), 'a near scan\'s maps go to the GPU one a frame before it shows');
  ok(/sceneLevel\('radar_dish', MOBILE \? 'm' : C\.lv\)/.test(sc), 'phones draw the radar from the light copy');
  ok(/\['meshy','tripo'\]\.some/.test(R('tools/stage-offline.mjs')), 'the app bundles leave out the raw Tripo downloads'); }

// Z396 a battlefield rebuilt releases the old one: geometries / maps off the GPU, rockets share their shapes, no list keeps an old field alive
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), rd=R('src/render/renderer.js'), fl=R('src/game/flow.js'), up=R('src/loot/upgrades.js'), sr=R('src/combat/siege-rocket.js'), so=R('src/actors/soldiers.js'), op=R('src/world/outposts.js'), rp=R('src/world/real-props.js');
  ok(/export function gpuHeld\(\)/.test(rd) && /export function gpuRelease\(was\)/.test(rd) && /!t\.isRenderTargetTexture/.test(rd), 'what the scene drew before and after a rebuild compared, the rest released (never a render target\'s texture)');
  ok(/const held=gpuHeld\(\);/.test(fl) && /buildUnderground\(\); gpuRelease\(held\);/.test(fl) && fl.indexOf('const held=gpuHeld()') < fl.indexOf('applyBiome(stStage)'), 'a new battle releases the last battlefield');
  ok(/parkAtSpawn\(\); const held=gpuHeld\(\);/.test(up) && /rebuildCore\(S\.stage\); gpuRelease\(held\);/.test(up), 'so does the next stage');
  ok(/const _G=\{\}, G=\(C, \.\.\.a\)=>/.test(sr) && !/new THREE\.\w+Geometry/.test(sr.slice(sr.indexOf('export function makeRocketMesh'), sr.indexOf('// dedicated ENEMY ARTILLERY'))), 'rockets and mortar shells share one geometry per shape');
  ok(/while\(q\.parent\) q=q\.parent; if\(q!==scene\)\{ TROOP_BATCH\.roots\.delete\(r\); continue; \}/.test(so), 'a man gone with his fort leaves the troop batch');
  ok(/if\(!OUTPOST_WIRE\[i\]\.f\.g \|\| !OUTPOST_WIRE\[i\]\.f\.g\.parent\) OUTPOST_WIRE\.splice\(i, 1\)/.test(op) && /REAL_COVER\.live\.delete\(m\)/.test(rp), 'the old field\'s wire coils and cover leave their lists'); }

// Z411 every gun in the menus · the AK / M4 / MP5 originals laid back over the shipped mesh (no 90° swing up close) · the B41 loaded at its muzzle, never behind his back
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), G=(await import('./src/data/guns.js')).GUNS, sf=R('src/combat/soldier-fire.js'), su=R('src/ui/setup-units.js'), ld=R('src/ui/loadout.js'), nd=R('src/render/near-detail.js'), rc=R('src/actors/real-cav.js');
  const T=Object.keys(G).filter(k=>G[k].trooper && k!=='t_rpg');
  ok(/export const KIT_GUN = 't_rpg';/.test(sf) && /PRIMARY_GUNS = Object\.keys\(GUNS\)\.filter\(id => GUNS\[id\]\.trooper && id !== KIT_GUN\)\.sort\(/.test(sf) && T.length===15 && ['t_rust','t_dmr','t_rail','t_saw','t_lmg','t_sniper','t_energy'].every(k=>T.includes(k)), 'the soldier\'s gun list is every one of his guns (15 + the B41 he always carries), not the four Z359 rifles');
  ok(/for\(const id of \[\.\.\.PRIMARY_GUNS, KIT_GUN\]\)/.test(su) && /LUÔN MANG THEO/.test(su) && /querySelector\('\.su-pgun\.on'\)/.test(su) && /new ResizeObserver/.test(su), 'the gear step shows them all, the B41 last, the one picked slid into view');
  ok(/_ldSol = _ldFrom==='pause' \? MODE\.id==='soldier' : isSoldier\(\)/.test(ld) && /if\(_ldSol\) return renderSoldierArms\(grid\)/.test(ld) && /if\(_ldSol\) applySoldierMain\(\); else applyLoadoutToRun\(\)/.test(ld) && /PROFILE\.trooperGun=_solSel/.test(ld), 'KHO SÚNG in soldier mode is his arsenal (never the tank\'s guns put in his hands)');
  ok(Object.keys(C.GUN_PRICE).length===Object.keys(G).filter(k=>!G[k].trooper && k!=='rifle').length && Object.keys(G).filter(k=>!G[k].trooper && k!=='rifle').every(k=>C.GUN_PRICE[k]), 'the tank\'s shop still sells every tank gun but the starting one');
  const js=f=>{ const b=fs.readFileSync(f); return JSON.parse(b.slice(20,20+b.readUInt32LE(12))); }, turned=k=>js('assets/models/real/gun/inf/'+k+'.glb').nodes.some(n=>n.rotation && Math.abs(n.rotation[1])>0.5) && !js('assets/models/real/hd/inf_'+k+'.glb').nodes.some(n=>n.rotation);
  ok(['ak','m4','mp5'].every(turned), 'the cause: the shipped AK / M4 / MP5 lie along X turned by a node, their originals along Z with none');
  ok(/sameFrame\(b\.geometry\.clone\(\)\.applyMatrix4\(a\.matrixWorld\.clone\(\)\.invert\(\)\.multiply\(b\.matrixWorld\)\), a\.geometry\)/.test(nd) && /function sameFrame\(g, lo\)/.test(nd) && /if\(m\.determinant\(\) > 0\) ROTS\.push/.test(nd) && C.NEARDETAIL.frame.tol>0 && C.NEARDETAIL.frame.tol<0.1 && C.NEARDETAIL.frame.grid>=8, 'an original off the shipped mesh\'s axes is turned back over it (a proper rotation, the one whose surface fills the shipped one\'s cells)');
  const L=C.GUNHOLD.rpg.load; ok(L && !C.GUNHOLD.rpg.back && L.at[1]<0 && L.pitch>0 && L.pouch[0]>0 && L.pouch[2]>0 && L.ahead[0]>L.ahead[1] && L.prone && L.prone.at[2]<0 && L.floor>0, 'the B41 is loaded off his shoulder: the grip by his hip, the round from a bag on his front (left, ahead), held out then pushed home; lying down along his side');
  ok(/if\(g\.load && low > 0\.001 && !tuck\) loadPose\(D, g, len, low, yaw, prone\)/.test(rc) && /function loadPose\(D, g, len, low, yaw, prone\)/.test(rc) && /const pouch = L \? _gt\.clone\(\)\.addScaledVector\(_gr, -L\.pouch\[0\]\)/.test(rc) && !/g\.back/.test(rc) && !/addScaledVector\(_gf, -0\.22\)/.test(rc), 'the reload uses it — no pouch behind his shoulder any more'); }
// Z403 soldier mode: no enemy artillery, no red warning rings (tank mode keeps both) · guard-post guns open up inside a rifleman's reach · our tanks and theirs painted apart (coat + rim + roof panel)
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), W=C.CAV.soldier.war;
  const md=R('src/game/mode.js'), ar=R('src/campaign/artillery.js'), sw=R('src/campaign/soldier-war.js'), sq=R('src/ai/squads.js'), wv=R('src/campaign/waves.js'), su=R('src/campaign/surprises.js'), op=R('src/campaign/operations.js'), fc=R('src/ai/fieldcraft.js'), tc=R('src/ai/tactics.js'), em=R('src/actors/enemy-missiles.js'), bo=R('src/campaign/boss.js'), bn=R('src/campaign/boss-new.js');
  ok(W.arty===false && W.rings===false && /fortsOpen:false, arty:true, rings:true,/.test(md) && /get arty\(\)\{ return CAV\.soldier\.war\.arty; \}, get rings\(\)\{ return CAV\.soldier\.war\.rings; \}/.test(md), 'Z403 the soldier\'s war has no artillery and no warning rings; the tank\'s keeps both');
  ok(/mort===0 \|\| boss \|\| !MODE\.arty\)/.test(ar) && /export function artLockStrike\(tx,tz\)\{ if\(!MODE\.arty\) return;/.test(ar) && /root\.visible=!!MODE\.rings;/.test(ar) && /if\(MODE\.rings\) ringPulse\(new THREE\.Vector3\(ax,0,az\)/.test(ar), 'Z403 no barrage, no locked strike, no zone drawn, no strike rings without them');
  ok(/if\(stage >= 2 && C\.arty\) pool\.push\(\['mortar'/.test(sw) && /if\(!p \|\| !MODE\.arty\) return;/.test(sq) && /S\.stage>=2 && MODE\.arty\)\{ WAVE\.plan='prep'; prepBarrage\(\);/.test(wv) && /k==='mortar' && !MODE\.arty/.test(su) && /O\.kind==='battery' && MODE\.arty/.test(op), 'Z403 no spotter SPG in his waves, no prep barrage, no surprise mortars, a silent battery');
  ok(/g\.side==='e' && MODE\.rings\)/.test(fc) && /if\(MODE\.rings\) ringPulse\(e\.pos, 0xff2a14, 2\.0\)/.test(tc) && /def\.truck && MODE\.arty/.test(tc) && /W\.g\.visible=on && !!MODE\.rings;/.test(em), 'Z403 no ring on an enemy grenade, round a kamikaze or round a locked missile; no rocket truck salvo');
  ok(/export function artyBarrage\(now\)\{ if\(!MODE\.arty\) return bossSpread\(/.test(bo) && /if\(MODE\.rings\)\{ ringPulse\(\{x,z\},0xffffff,8\);/.test(bo) && /if\(MODE\.rings\)\{ ringPulse\(\{x,z\}, 0xff3020, o\.r\);/.test(bn) && /MODE\.arty && bossAlive\('launcher'\)/.test(bn) && /MODE\.arty && bossAlive\('mortar'\)/.test(bn), 'Z403 a general fights a soldier with his guns, not his artillery, and warns with no rings');
  const tw=R('src/world/towers.js'), rd=R('src/world/radar.js'), ub=R('src/world/underbase.js');
  ok(TOWER.range<=C.INFANTRY.rifle.range-4 && TOWER.range<PLAYER.rangeBase && C.SUPPLYB.aa.range<=PLAYER.rangeBase && C.UNDERBASE.gate.turretR<=C.INFANTRY.rifle.range, `Z403 guard-post guns reach no further than a rifleman (tower ${TOWER.range} m, AA ${C.SUPPLYB.aa.range} m, gate ${C.UNDERBASE.gate.turretR} m vs rifle ${C.INFANTRY.rifle.range} m, ours ${PLAYER.rangeBase} m)`);
  ok(/near=seen && dp<TOWER\.range; let best=near\?p\.pos:null/.test(tw) && /maxDist:TOWER\.range\+4/.test(tw) && /if\(d>SUPPLYB\.aa\.range \|\| !playerSeen\(/.test(rd) && /maxDist:SUPPLYB\.aa\.range\+4/.test(rd) && /maxDist:C\.turretR\+4/.test(ub), 'Z403 a guard does not track or fire beyond his reach; the rounds stop just past it');
  const S=C.SIDE_ID, hue=h=>{ const r=(h>>16&255)/255, g=(h>>8&255)/255, b=(h&255)/255, mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn; if(!d) return 0; const x=mx===r?((g-b)/d+6)%6:mx===g?(b-r)/d+2:(r-g)/d+4; return x/6; };
  const hd=(a,b)=>{ const d=Math.abs(hue(a)-hue(b))%1; return Math.min(d, 1-d); };
  ok(S && S.coat>0 && S.coat<=1 && S.metal>=0 && S.metal<=1 && S.gain[0]>0 && S.gain[1]>S.gain[0] && hd(S.paint.f, S.paint.e)>0.1 && hd(S.rim.f, S.rim.e)>0.2 && S.rimK.f>0 && S.rimK.e>0 && S.panel>0.7, 'Z403 the two sides\' paint and rim are far apart in hue');
  const sp=R('src/world/sidepaint.js'), mt=R('src/tank/materials.js'), rt=R('src/tank/real-tanks.js'), ml=R('src/tank/model.js'), at=R('src/actors/ally-tanks.js');
  ok(/export function sideCoat\(mat, U\)/.test(mt) && /coatK/.test(mt) && /totalEmissiveRadiance \+= rimCol \* pow\(1\.0 - clamp\(dot\(normal, normalize\(vViewPosition\)\)/.test(mt) && /export function markSide\(mesh, side, own\)/.test(sp) && /sideCoat\(m, U\)/.test(sp) && /markSide\(mesh, side\); \}/.test(sp) && /c1=SIDE_ID\.paint\[side==='e'\?'e':'f'\]/.test(sp), 'Z403 every painted vehicle wears its side: a coat over the real model, a rim round it');
  ok(/gain:coatGain\(src\.material\.map\)/.test(rt) && /if\(u\.side\)\{ if\(u\.own\) markSide\(g, 'f', true\); else paintVehicle\(g, u\.side\); \}/.test(rt) && /\[\[mat, base\.getHex\(\)\]\]\.concat\(gm/.test(rt) && /u\.roofTop = roofTop\(tm, tur\)/.test(rt) && (ml.match(/if\(KIT\) opts = \{ \.\.\.opts, own:true \};/g)||[]).length===2 && /if\(opts\.own\)\{ g\.userData\.side = 'f'; g\.userData\.own = true; \}/.test(rt), 'Z403 a model dressed late still gets its side; our own tank keeps its skin and wears our rim');
  ok(/id\.userData\.roofMark=id\.userData\.keep=true; tur\.add\(id\); seatRoofMark\(m\);/.test(at) && /export function seatRoofMark\(g\)/.test(rt), 'Z403 our captured tank\'s lime panel lies on the real turret roof and stays at range'); }
// Z402 a killed tank blows apart and is gone (no wreck, no burning hulk to drive into) · a man shot dead is thrown and bursts · fuel drums go up and vanish · tents are walls that hide both sides until a hit burns them away
{ const fs=await import('node:fs'), C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), dy=R('src/fx/dying.js'), ph=R('src/world/physics.js'), inf=R('src/actors/infantry.js'), ft=R('src/actors/fireteam.js'), cv=R('src/world/cover.js'), sc=R('src/world/scenery.js'), cp=R('src/world/camps.js'), st=R('src/game/stealth.js');
  ok(!/spawnWreck\(/.test(dy) && !/DYING/.test(ph) && !/updateDying/.test(R('src/game/loop.js')) && /spawnTankWreck\(e\.pos, s, e\.def\.pal/.test(dy) && /m\.visible=false; \(enemyPool\[e\.type\]=enemyPool\[e\.type\]\|\|\[\]\)\.push\(m\); \}/.test(dy) && /spawnTankWreck\(t\.pos/.test(R('src/actors/ally-tanks.js')) && /spawnTankWreck\(pos, bms, bpal\)/.test(R('src/campaign/boss.js')), 'a killed tank (theirs, ours, the boss) blows apart in the frame it dies: torn steel, its hull back in the pool, no wreck and no solid hulk left');
  ok(C.TANK_DEATH.chunkLife[1] <= 2.5 && /life:L\[0\]\+Math\.random\(\)\*\(L\[1\]-L\[0\]\), fade:TANK_DEATH\.fade/.test(R('src/fx/debris.js')) && /rollSmoke\(pos, scale, sM, TANK_DEATH\.smokeK\)/.test(R('src/fx/explosions.js')), 'its steel fades within ~2 s, its smoke is a short puff');
  ok(C.DEATH_POP.max <= 2 && C.DEATH_POP.lie < 0.6 && C.DEATH_POP.speed[0] > 4 && C.DEATH_POP.up[0] > 3 && /INF_DEAD\.push\(\{ e, t:0, \.\.\.flingDead\(m, ux, uz, e\._hitK\|\|1, heavy\) \}\)/.test(inf) && /if\(\(d\.down && d\.lie>=P\.lie\) \|\| d\.t>=P\.max\)\{ popBody\(m, d\.pw\|\|1\); return true; \}/.test(inf) && /infPushBlocks\(m\.position\)/.test(inf) && /flingDead\(a\.g, ux, uz/.test(ft) && /if\(stepFlung\(d, m, dt\)\)/.test(ft), 'a man shot dead (theirs or ours) is thrown along the shot, stopped by cover, and bursts and is gone within ~1.6 s');
  ok(C.FUEL_DRUM.hp > 0 && C.FUEL_DRUM.r > 3 && C.FUEL_DRUM.chain > C.FUEL_DRUM.r && C.SCENERY.models.oil_drum.fuel && /if\(M\(p\.k\)\.fuel\)\{ for\(const q of out\) blocks\.push\(\{ mesh:lod, \.\.\.q, hp:FUEL_DRUM\.hp/.test(sc) && /export function dropScenePiece\(lod\)/.test(sc) && /if\(b\.kind==='fueldrum'\)\{ fuelDrumHit\(b, dmg\); return; \}/.test(cv) && /blocks\.splice\(i,1\); dropScenePiece\(b\.mesh\);/.test(cv) && /aoeDamage\(b\.x, b\.z, R, D\.dmg, false, now\); blastAllies/.test(cv) && !/leaveRubble\(b, big\?9:12\)/.test(cv) && !/b\.kind==='drums'\|\|b\.kind==='tires'\) leaveRubble/.test(cv), 'a fuel drum shot goes up — splash, a chain through the drums beside it — and leaves nothing: scan, collider and (stacks, tyres, containers, wrecks) no heap');
  ok(C.TENT.burn >= 1.5 && C.TENT.burn <= 3 && /addTent\(tn, tx, tz, ang,/.test(cp) && /addTent\(m, wx, wz, q\.ry/.test(R('src/world/outposts.js')) && /if\(b\.kind==='tent'\)\{ tentHit\(b\); return; \}/.test(cv) && /function dropTent\(T\)\{ const i=blocks\.indexOf\(T\.b\); if\(i>=0\) blocks\.splice\(i, 1\);/.test(cp) && /o\.geometry\.dispose\(\)/.test(cp) && /m\.dispose\(\)/.test(cp) && !/MODE\.crushes && hitsHull\(p, t\.x, t\.z/.test(cp), 'a tent is a block (it stops tanks, men and rounds) until a hit sets it alight; it burns burn s and leaves with its collider and its own GPU data');
  ok(/if\(!p\.cav\) return !tentHides\(x, y, z,/.test(st) && /if\(!inSight\(x, y, z\)\) return false;/.test(st) && /bl\.kind==='tent'; \}/.test(R('src/ai/fieldcraft.js')) && /'tent'\]\)/.test(R('src/ai/cover.js')) && /!tentHidesFromPlayer\(e\)/.test(R('src/combat/guns.js')) && (R('src/combat/aim.js').match(/tentHidesFromPlayer/g)||[]).length >= 3 && /if\(tentHides\(b\.x/.test(R('src/combat/lock-on.js')), 'a tent hides both ways: enemy eyes (tank and soldier mode), riflemen\'s fire lines and cover, the player\'s auto-aim and the missile seeker');
  // the sight test itself, lifted out: a tent 4 × 3 m, 2.3 m high between two men hides them; a man up a tower 8 m sees over it; from inside it, it does not count
  { const pick=(src, n)=>{ const i=src.indexOf('export function '+n+'('); let d=0, k=src.indexOf('{', i); for(;;k++){ if(src[k]==='{') d++; else if(src[k]==='}' && --d===0) break; } return src.slice(i+7, k+1); };
    const b={ x:0, z:0, obb:{ f:0, hl:2, hw:1.5 } }, env={ TENTS:[{ b }], _sb:{ t0:0, t1:1 }, blockTop:()=>2.3, inShape:(bl, x, z)=>Math.abs(x)<1.5 && Math.abs(z)<2, segBlock:(bl, ax, az, bx, bz, pad, out)=>{ if(Math.sign(ax)===Math.sign(bx)) return null; const t=(-1.5*Math.sign(ax)-ax)/(bx-ax), t2=(1.5*Math.sign(ax)-ax)/(bx-ax); out.t0=Math.min(t, t2); out.t1=Math.max(t, t2); return Math.abs(az+(bz-az)*out.t0)<2 ? out : null; } };
    const tentHides=new Function(...Object.keys(env), pick(cp, 'tentHides')+' return tentHides;')(...Object.values(env));
    ok(tentHides(-6, 1.6, 0, 6, 1.1, 0) && !tentHides(-6, 8, 0, 6, 1.1, 0) && !tentHides(-6, 1.6, 0, -3, 1.1, 0) && !tentHides(-1, 1.6, 0, 6, 1.1, 0), 'a tent between two men hides them; a guard 8 m up sees over it; nothing on one side; a man standing in it is not hidden by it'); } }
// Z405 ground without a tile grid (hex tiling) + rivers: flowing water, the frozen river, bridge spots, fords
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=k=>fs.readFileSync(k,'utf8'), gd=R('src/world/ground.js'), gp=R('src/world/ground-photo.js'), rv=R('src/world/river.js'), hf=R('src/world/heightfield.js');
  const X=C.GROUND_PHOTO.hex; ok(X && X.on && X.s>0.2 && X.s<2 && X.rot>=0 && X.rot<=1 && X.exp>=1 && X.con>=0 && X.con<=1 && C.GROUND_PHOTO.nrmVar>=0 && C.GROUND_PHOTO.nrmVar<1, 'hex tiling config: lattice size, turn, seam sharpness, relief drift');
  ok(/void hxGrid\(vec2 st/.test(gd) && /'hxMap\( map, vMapUv \)'/.test(gd) && /'hxNrm\( normalMap, vNormalMapUv \)'/.test(gd) && /'hxDom\( roughnessMap, vRoughnessMapUv \)'/.test(gd) && /hxTex\(altMap, vWXZ\*altScale\)/.test(gd) && /hxTex\(map, vMapUv\*0\.29/.test(gd) && /#define HX_CHEAP/.test(gd) && /mapN\.xy \*= normalScale \* hxNv;/.test(gd) && /PHOTO_U\.hex\.value\.set\(/.test(gp), 'the photo floor, its normals, roughness, second set and second scale are all read through the hex lattice (phones: a cheaper second set)');
  const RV=C.RIVERS; ok(RV && ['MEADOW','SAVANNA','RUINS','CITADEL','ARCTIC'].every(b=>RV.biomes[b]) && !['DESERT','VOLCANO','FOUNDRY','CITY','QUARRY'].some(b=>RV.biomes[b]) && RV.biomes.ARCTIC.frozen[0]===true && RV.cross.some(c=>c[2]==='bridge') && RV.cross.some(c=>c[2]==='ford') && RV.main.z<0 && RV.wade.deep<RV.wade.ford && RV.wade.ford<1 && 'model' in RV.bridge && RV.bridge.deckAt>=0 && RV.bridge.deckAt<=1, 'rivers: which battlefields, the enemy half, a bridge spot + fords, wading speeds, the bridge-model hook');
  ok(/export function carveRivers\(h, b\)/.test(rv) && /RIVER\.flow = F/.test(rv) && /fract\(t0 \+ 0\.5\)/.test(rv) && /float shore =/.test(rv) && /white = rap/.test(rv) && /if\(wFrz > 0\.5\)/.test(rv) && /pow\(1\.0 - clamp\(V\.y, 0\.0, 1\.0\), 4\.0\)/.test(rv) && /MODEL_FILES\.river_bridge = B\.model/.test(rv) && /#define W_CHEAP/.test(rv), 'water carried along a baked flow field (two phases), shore foam, white water, ice, fresnel, the bridge model loader, a cheaper phone path');
  ok(/export function bedAt/.test(hf) && /export function wadeAt/.test(hf) && /export function nearCrossing/.test(hf) && /al=dx\*b\.ca\+dz\*b\.sa, ac=dz\*b\.ca-dx\*b\.sa/.test(hf) && /if\(I\[k\]\) return RIVER\.y\+0\.05/.test(hf) && /if\(bedAt\(x,z\)<W\) return true/.test(hf), 'the bridge deck runs bank to bank, the ice carries the hull, nothing is built on a bridge or the ice');
  ok(/wadeAt\(p\.pos\.x, p\.pos\.z\)/.test(R('src/game/update.js')) && /wadeAt\(p\.pos\.x, p\.pos\.z\)/.test(R('src/game/cavalry.js')) && /!nearCrossing\(x, z, m\)/.test(R('src/world/field.js')) && /wadeAt\(x,z\)>RIVERS\.wade\.deep/.test(R('src/ai/squads.js')) && /wetAt\(x, z, 3\) \? 1e4 : 0/.test(R('src/campaign/waves.js')) && /export \* from '\.\/world\/river\.js';/.test(R('src/hub.js')), 'wading speeds for the hull and the rider, crossings kept clear, squads cross at crossings, no spawns out of the river'); }
// Z404 the bán tải rides alone (no xe ôm driver left from the last battle); long rides meet the world with their whole outline, trees with their drawn trunk,
//   cover with its drawn box; ridge rocks never go invisible; the bán tải climbs low things, smashes light cover and bursts brick walls
{ const fs=await import('node:fs'), C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), cv=R('src/game/cavalry.js'), rc=R('src/game/ride-collide.js'), tf=R('src/world/tree-fall.js'), ss=R('src/world/solid-shape.js'), sp=R('src/world/supply.js'), co=R('src/world/cover.js'), xe=R('src/game/xeom.js'), dc=R('src/world/decor.js'), ph=R('src/world/physics.js'), rt=R('src/world/real-trees.js');
  ok(/export function dropCavPlayer\(p\)\{ if\(!p \|\| !p\.cav\) return; const D=CV\.H && CV\.H\.drv; if\(D\)\{ driverBack\(CV\.H\); if\(D\.w && D\.w\.parent\) D\.w\.parent\.remove\(D\.w\);/.test(cv) && /CV\.H\.drv=null;/.test(cv), 'a ride dropped for another unit takes its driver (and his cigarette, lighter, hammer) out of the world');
  ok(['bagac','bantai'].every(k=>C.XEOM.hull[k].length>=5 && C.XEOM.hull[k].every(c=>c.length===3 && c[2]>0)) && !C.XEOM.hull.xeom && Math.max(...C.XEOM.hull.bantai.map(c=>c[1]+c[2]))>=2.3 && Math.max(...C.XEOM.hull.bantai.map(c=>Math.abs(c[0])+c[2]))>=0.95 && /hullEach\(p, q=>collide\(q, now\)\); hullEach\(p, rideImpacts\)/.test(cv), 'the ba gác / bán tải meet the world with circles over their whole drawn outline (nose 2.35 m, side 0.97 m on the bán tải)');
  ok(/export function trunkR\(c\)/.test(tf) && /if\(L && L\.getX\(i\) > 0\.3\) continue;/.test(tf) && C.TREEFALL.band[0]<C.TREEFALL.band[1] && /c\.kind === 'tree' \? trunkR\(c\) : c\.r \* 0\.9/.test(rc) && /cr=c\.kind==='tree' \? trunkR\(c\) : c\.r\*0\.3/.test(dc) && /b\.kind === 'trunk' && b\.im === im/.test(rt), 'a tree stops a ride, and goes over under a tank, at its drawn trunk; a giant\'s solid trunk is the real one\'s girth');
  ok(/if\(bl\.cover && bl\.mesh && bl\.mesh\.isMesh\) return coverShape\(bl\);/.test(ss) && /SH=solidShape\(bl\), vn=tankVsWall\(p, SH\)/.test(ph) && /D=\{ hw:\(gb\.max\.x-gb\.min\.x\)\/2, hl:\(gb\.max\.z-gb\.min\.z\)\/2 \}/.test(co), 'a piece of cover is the box of its drawn model; the wreck\'s box is no longer turned 90°');
  ok(/if\(b\.ridge\) ridgeRockDown\(b\); else scene\.remove\(b\.mesh\);/.test(sp) && /KEEP\.has\(b\.kind\) \|\| b\.fort \|\| b\.supply/.test(sp), 'a supply site cleared over a ridge hides that rock alone, never the whole spine (left solid and invisible)');
  const P=C.XEOM.power.bantai; ok(P && P.climbH>0.5 && P.climbH<1.5 && P.never.includes('hedgehog') && P.wallV<C.CAV.horse.cruise && P.knockV<C.RIDE_HIT.knockV && P.wireV<C.RIDE_HIT.wireV && P.passK>0 && P.passK<1 && !C.XEOM.power.xeom && /if\(PW && rideOver\(b, PW, null\)\) continue;/.test(cv) && /rideRam\(p, b, vn, PW, px, pz, vx, vz\)/.test(cv) && /export function rideBumpAt/.test(rc) && /heightAt\(_sa\.x, _sa\.z\) \+ Math\.max\(rideBumpAt\(_sa\.x, _sa\.z, cap\), mid\)/.test(xe) && C.XEOM.air.rock.clear>0 && /TRUNKS_DOWN\.push\(/.test(tf), 'the bán tải climbs stones, fallen trunks and low cover (its wheels on them), smashes light cover, bursts a brick wall at cruising speed, flattens props and wire sooner'); }

// Z412 GPU: MSAA on the scene pass only, horizon rings culled by arc + simplified, shadow pass draws light copies, radar mid level
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), rd=R('src/render/renderer.js'), fl=R('src/render/far-lod.js'), hz=R('src/world/horizon.js'), sc=R('src/world/scenery.js'), sh=R('src/render/shafts.js');
  ok(/class SceneRenderPass extends RenderPass/.test(rd) && /samples:MSAA \}\);/.test(rd) && /new EffectComposer\(renderer, new THREE\.WebGLRenderTarget\(1, 1, \{ type:THREE\.HalfFloatType \}\)\)/.test(rd) && /depth:\(\)=>renderPass\.rt\.depthTexture/.test(rd) && /o\.depth \? o\.depth\(\) : rd\.depthTexture/.test(sh), 'Z412 only the scene pass is multisampled; the post chain runs on plain buffers; AO and shafts read the scene pass depth');
  ok(C.SKYLINE.arcs>=4 && C.SKYLINE.keep>0 && C.SKYLINE.keep<1 && /export function sectorize\(im, n, keep\)/.test(fl) && /sectorize\(im, SKYLINE\.arcs, SKYLINE\.keep\)/.test(hz) && /sectorize\(im, SKYLINE\.arcs,/.test(sc) && !/im\.frustumCulled = false; im\.renderOrder = -7; im\.userData\.skyline/.test(sc), 'Z412 the horizon rings are split by bearing (culled) and simplified');
  ok(C.SHADOWLOD.on && C.SHADOWLOD.min>0 && C.SHADOWLOD.keep>0 && C.SHADOWLOD.keep<1 && /export function shadowLOD\(renderer\)/.test(fl) && /shadowLOD\(renderer\);/.test(rd) && /worn\[i\]\.geometry = worn\[i \+ 1\]/.test(fl) && /isInterleavedBufferAttribute\)\{ const f = new Float32Array/.test(fl), 'Z412 the shadow pass wears light copies and gives the geometry back');
  ok(C.SCENERY.supply.radar.lv==='l', 'Z412 the radar dish is drawn from its mid level'); }

// Z415 the enemy goes round the river by a bridge or a ford and wades slowly; the fence stops at the river banks
{ const fs=await import('node:fs'); const C=await import('./config.js'), R=k=>fs.readFileSync(k,'utf8'), rv=R('src/world/river.js'), tc=R('src/ai/tactics.js'), inf=R('src/actors/infantry.js'), sq=R('src/ai/squads.js'), pm=R('src/world/perimeter.js');
  const Q=C.RIVERS.route; ok(Q && Q.every>0.2 && Q.every<3 && Q.step>0.5 && Q.step<6 && Q.reach>0 && Q.margin>0 && C.RIVERS.fenceGap>=0 && C.RIVERS.fenceGap<1.5, 'river routing + fence gap config');
  ok(/export function riverWay\(u, tx, tz, now\)/.test(rv) && /function deepOnWay/.test(rv) && /wadeAt\(x, z\) > RIVERS\.wade\.deep && deepOnWay/.test(rv) && /fieldDepth\(nx, nz\) < 2/.test(rv) && /ax:-p\.tz, az:p\.tx/.test(rv), 'a way over the river through the best bridge or ford, only when the deep channel is in the way, never from mid-stream, ends inside the fence');
  ok(/riverWay\(e, goal\.x, goal\.z, now\)/.test(tc) && /goal=dst/.test(tc) && /wk=wadeAt\(e\.pos\.x, e\.pos\.z\)/.test(tc) && /riverWay\(e, p\.pos\.x, p\.pos\.z, now\)/.test(tc) && /riverWay\(e, T\.pos\.x, T\.pos\.z, now\)/.test(inf) && /const wk=wadeAt\(e\.pos\.x, e\.pos\.z\)/.test(inf) && /riverWay\(e, g\[0\], g\[1\]/.test(sq), 'enemy tanks, bombers, riflemen and squads route over crossings and are slowed wading');
  ok(/wet=P\.map\(q=>RIVER\.on && bedAt\(q\.x,q\.z\)<RIVER\.y\+RIVERS\.fenceGap\)/.test(pm) && /wet\[i\]\?Z0:Sc/.test(pm) && /for\(const RU of runs\)/.test(pm) && /CatmullRomCurve3\(pts, closed\)/.test(pm), 'the fence leaves a clean gap where a river runs out through it'); }

// Z141 realistic water + flora
{ const fs=await import('node:fs'); const h=fs.readFileSync('src/world/heightfield.js','utf8'), f=fs.readFileSync('src/world/flora.js','utf8'), d=fs.readFileSync('src/world/decor.js','utf8');
  ok(/depthTex/.test(h) && /foam/.test(h) && /WTIME/.test(h), 'water is depth-tinted with foam and moving ripples');
  ok(/export function buildFlora/.test(f) && /bamboo/.test(f) && /palm/.test(f) && /reeds/.test(f) && /sway/.test(f) && /c\.kind==='tree'/.test(d), 'flora per biome, swaying, trees topple under tanks'); }

// Z142 city district
{ const fs=await import('node:fs'); const c=fs.readFileSync('src/world/city.js','utf8');
  ok(/tubeHouse/.test(c) && /apartment/.test(c) && /officeTower/.test(c) && /villaHouse/.test(c) && /drawStreetVehicles/.test(c) && /zebra/.test(c) && /LineSegments/.test(c), 'city: street grid, varied buildings, cars, motorbikes, crossings, power lines'); }

// Z143 savanna, arctic, wildlife
{ const fs=await import('node:fs'); const w=fs.readFileSync('src/data/world.js','utf8'), f=fs.readFileSync('src/world/flora.js','utf8'), a=fs.readFileSync('src/actors/wildlife.js','utf8');
  ok(/name:'SAVANNA'/.test(w) && /name:'ARCTIC'/.test(w) && /baobab/.test(f) && /acacia/.test(f) && /reedPlume/.test(f) && /tk:'coniferSnow'/.test(f) && /floe\(\)/.test(f), 'savanna and arctic biomes with their own plants');   // (Z393 the arctic's cone spires gone for summit crags, world/scenery.js)
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
  ok(/f\.Rin/.test(fo) && /Math\.random\(\)-0\.5\)\*0\.5\)\/sides/.test(fo) && /GH=H\+FORT\.arch\.gateH\[CAP\?1:0\]/.test(fo) && /portcullis/.test(fo), 'irregular fort outlines, tall towers, fierce gatehouse');
  ok(/f\.keepR/.test(fo) && /kind:'keep'/.test(fo), 'the capital raises a solid donjon with the flag on its roof');
  ok(/export function tryClimb/.test(es) && /isClimber/.test(R('src/actors/command.js')) && /updateClimb/.test(R('src/actors/fireteam.js')), 'assault troops carry ladders and scale an unbreached wall');
  ok(/TURRET\.rate\*tk/.test(up) && /id="setTurret"/.test(R('index.html')), 'turret traverse speed is moderate and player-adjustable');
  ok(!/#da251d/.test(hf) && /LIÊN QUÂN THÉP/.test(hf), 'our flag is a fictional banner (no real national flag)');
  ok(/ZOOM_LEVELS=\[0\.34, 0\.44, 0\.55, 0\.75, 1\.0, 1\.5, 2\.0, 2\.6, 3\.3\]/.test(ip) && /fitShadow/.test(rd), 'one more zoom-out level, shadows widen with it'); }

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
  ok(/card\(r\*_R\(1\.0,1\.3\), 0\.9, 2, 0, y-1\.6/.test(fl), 'spruce sprays lean their normals up to the sky (no black trees)'); }

// Z149 gun ladder: a higher BẬC always out-fights a lower one; extra barrels never mean extra damage
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const GM=await import('./src/data/guns.js'), G=GM.GUNS;
  const CF=await import('./config.js'), PL=await import('./src/data/player.js'), GS=CF.GUNSTAT;   // Z230 measured like combat/gunstats.js: at the fighting distance (pellets that land, falloff)
  const sus=id=>{ const g=G[id], reach=PL.PLAYER.rangeBase*(g.rng||1), d=Math.min(reach*GS.engage.frac, GS.engage.max), fr=g.frags||1;
    const acc = fr>1 ? Math.max(GS.minHit, Math.min(1, GS.W.tank/(2*d*Math.tan((g.spread||0)/2)))) : g.spread>0 ? Math.max(0.55, Math.min(1, GS.W.tank/(2*d*Math.tan(g.spread)))) : 1;
    const f=Math.max(0, Math.min(1, (d/reach-0.55)/0.45)), fallK=1-f*(1-(g.fall??1)), shot=g.dmg*fr*acc*(1+GM.gunSplash(g))*fallK*(g.lock?0.9:1);
    return shot*g.mag/(g.mag*g.fireCd+g.reload); };
  const direct=['rifle','smg','shotgun','flak','cannon','hesh','minigun','missile','tesla','thermo'], T=t=>direct.filter(id=>G[id].tier===t).map(sus);
  ok(Math.max(...T(1)) < Math.min(...T(2)), 'every tier-2 direct-fire gun out-damages the best tier-1 gun (the SMG no longer beats tier 2)');
  ok(Math.max(...T(2)) <= Math.min(...T(3)), 'every tier-3 direct-fire gun matches or beats the best tier-2 gun');
  ok(sus('arty') > sus('mortar') && sus('railgun') > sus('cannon'), 'heavy versions beat their lighter cousins (howitzer > mortar, railgun > cannon)');
  const coin=t=>Object.keys(G).filter(id=>G[id].tier===t && GUN_PRICE[id] && GUN_PRICE[id].c).map(id=>GUN_PRICE[id].c);
  ok(Math.max(...coin(1)) < Math.min(...coin(2)) && Math.max(...coin(2)) < Math.min(...coin(3)), 'shop prices climb with the tier');
  ok(GM.gunSplash(G.flak) < 0.5 && /dmg\*gunSplash\(g\)/.test(R('src/combat/flame.js')), 'flak airbursts no longer stack five full blasts on one target');
  ok(/p\.muzzles\[\(p\.mzI=/.test(R('src/combat/flame.js')) && /userData\.muzzles=MZ/.test(R('src/tank/barrels.js')), 'twin / multi-tube guns fire from each real tube in turn');
  ok(/e\.burn\.k/.test(R('src/ai/tactics.js')) && /gunStats\(id, K\)/.test(R('src/combat/power.js')), 'flame burn scales with damage upgrades; the power rating counts splash');
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
  ok(/tapBtn\('playBtn', \(\)=>openBattleSetup\(\)\)/.test(R('src/game/flow.js')), 'PLAY opens CHUẨN BỊ TRẬN at its first step (Z354; XUẤT KÍCH there goes in at once)');
  ok(/intro\.quick = !!\(PROFILE\.introSeen/.test(R('src/game/intro.js')) && /if\(intro\.quick\) endIntro\(\)/.test(R('src/game/intro.js')), 'the battlefield tour plays once per map, then the warm-up leads straight to the briefing');
  ok(/export function launchStage/.test(R('src/ui/briefing.js')) && /if\(quick\)\{ confirmDeploy\(\); return; \}/.test(R('src/ui/deploy.js')) && /id="brGo"/.test(R('index.html')), 'briefing: a contract is pre-chosen, XUẤT KÍCH posts the troops by plan without another screen');
  ok(/css\/ui152\.css/.test(R('index.html')) && /\.brcard\.on::after/.test(R('css/ui152.css')) && /--card-sh-hover/.test(R('css/ui152.css')), 'shared card surface, hover lift, chosen state'); }

// Z153 recorded-quality sound set (ElevenLabs), levelled to the Z151 mix
{ const fs=await import('node:fs'); const sy=fs.readFileSync('src/audio/synth.js','utf8'), SS=(await import('./src/audio/synth.js').catch(()=>null));
  const files=fs.readdirSync('assets/sfx').filter(f=>f.endsWith('.mp3'));
  ok(files.length>=25 && files.every(f=>fs.statSync('assets/sfx/'+f).size>1500), 'assets/sfx holds the generated set (every file is real audio)');
  ok(/export function loadSamples/.test(sy) && /SAMPLE_LU\[k\]\?\?-24\)-L\)\/20\)\/g/.test(sy) && /sampleGet\(D\.sample\|\|k\) \|\| \(D\.sampleOnly \? null : bankGet\(k\)\)/.test(sy), 'samples are loudness-matched to the measured mix, synth plays until they load (Z355 a key may borrow another\'s sample, retuned)');
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
  ok(/stats:\{ hp:[\d.]+, spd:[\d.]+, acc:[\d.]+, turn:[\d.]+, size:[\d.]+ \}/.test(md) && /p\.turnMul = TS\.turn/.test(R('src/game/mode.js')) && /\(p\.turnMul\|\|1\)/.test(R('src/game/update.js')), 'each model changes armour, speed, acceleration, turning and size in battle');
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
  { const md=(await import('node:fs')).readFileSync('src/game/mode.js','utf8'); ok(/applyTankKit\(p, p\.modelId\); refill\(p\)/.test(md) && /gi\.ammo = magCap/.test(md) && /MODE\.setupRun\(p\)/.test(flow), 'workshop + crew are baked in after the model stats, then mags refilled'); }
  ok(/shtora/.test(R('src/actors/enemy-missiles.js')) && /p\.sig\.trophy/.test(R('src/actors/enemy-missiles.js')) && /capsuleSave/.test(R('src/game/player-damage.js')) && /addEra/.test(kit), 'signature modules work in battle: Shtora, Trophy, crew capsule, reactive tiles');
  ok(KD.CREW_SEATS.length===4 && KD.CREW_SEATS.every(s=>s.l5&&s.l10) && KD.CREW_RECRUITS.filter(r=>!r.price).length===4 && KD.CREW_RECRUITS.every(r=>!r.trait||KD.CREW_TRAITS[r.trait]), 'four crew seats with level-5/10 skills; four starting crewmen; every trait exists');
  ok(/grantCrewXp\(true\)/.test(bs) && /grantCrewXp\(false\)/.test(R('src/game/player-damage.js')) && /S\.kitKills/.test(R('src/actors/damage.js')), 'the crew earns XP from stages, kills and (half) from lost battles');
  ok(/id="kitshop"/.test(R('index.html')) && /id="garKit"/.test(R('index.html')) && /openKitShop/.test(ui) && /hireCrew/.test(ui) && /buySig/.test(ui), 'workshop + crew screen reachable from the garage');
  ok(BD.BOSS_NEW.length===3 && BD.BOSS_NEW.every(b=>new RegExp('\\n  b_'+b.id+':').test(ds) && new RegExp('\\n  b_'+b.id+'\\(K\\)\\{').test(ds) && b.intro && b.taunt.length===2), 'three new generals, each with its own machine, intro and taunts');
  ok(/BOSS_ALT\[st\]/.test(bs) && Object.values(BD.BOSS_ALT).every(id=>BD.BOSS_NEW.some(b=>b.id===id)), 'odd NG+ loops hand stages to the new generals');
  ok(/thermoSalvo/.test(bn) && /FIREZ\.push/.test(bn) && /mortarBarrage/.test(bn) && /U\.tail/.test(bn) && /railTel/.test(bn) && /empBurst/.test(bn) && /teslaArcs/.test(bn), 'new generals fight with their own weapons (thermobaric fire, mortars + tail, railgun + EMP + tesla)');
  ok(/radio\(msg, vkey\)/.test(ops) && /const vk=vkey \|\| voiceKeyFor\(msg\); if\(!\(vk && sayVoice\(vk\)\)\) sfx\('beep'\)/.test(ops) && VOICE_FILES_OK(), 'radio lines are spoken; every voice file exists');
  ok(/OfflineAudioContext/.test(mu) && /updateScore\(dt\)/.test(R('src/game/loop.js')) && Object.keys(BD.BOSS_DEFS.concat(BD.BOSS_NEW).reduce((a,b)=>(a[b.id]=1,a),{})).every(id=>new RegExp('\\b'+id+':\\[').test(mu)), 'adaptive score: stems rendered offline, faded with the fight, a motif per general');
  function VOICE_FILES_OK(){ const T=Object.fromEntries([...vo.match(/VOICE_TAKES = \{([^}]+)\}/)[1].matchAll(/(\w+):(\d+)/g)].map(m=>[m[1],+m[2]])); const keys=[...vo.matchAll(/, '([a-z_]+)'\]/g)].map(m=>m[1]).concat('open','streak','boss_phase','f_rally_1','f_rally_2','f_rally_3'); for(const b of BD.BOSS_DEFS.concat(BD.BOSS_NEW)) keys.push('boss_'+b.id,'t_'+b.id+'_1','t_'+b.id+'_2'); const files=keys.flatMap(k=>T[k]?Array.from({length:T[k]},(_,i)=>k+'_'+(i+1)):[k]); return files.length>40 && files.every(k=>fs.existsSync('assets/voice/'+k+'.mp3')); } }

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

// Z164 Google sign-in on: provider in firebase.json, link button on the web build, a failed link never marks the save broken
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const cfg=await import('./config.js'), fb=JSON.parse(R('firebase.json'));
  ok(cfg.CLOUD_CFG.google===true && fb.auth.providers.anonymous && !/@/.test(R('firebase.json')), 'Google on (enabled in the project, not in firebase.json — no personal email in the repo); anonymous provider in config');
  ok(/linkWithPopup/.test(R('src/core/cloud.js')) && !/set\('error', e\.code\|\|e\.message\); return false; \} \}/.test(R('src/core/cloud.js')) && /LIÊN KẾT GOOGLE/.test(R('src/ui/settings.js')), 'link Google from Settings; a cancelled link leaves the cloud state alone'); }

// Z167 roof machine gun (manned by the first rider), its shop/upgrades on the server, fortress rally cries, death scream, victory cheer
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const cfg=await import('./config.js'), E=await import('./functions/economy.js'), cat=JSON.parse(R('functions/catalog.json')), mg=R('src/tank/roofmg.js');
  ok(cfg.ROOF_MG.length>=4 && cfg.ROOF_MG.every(m=>m.range<28 && m.dmg<15) && cfg.ROOF_MG.find(m=>m.id==='pkt').price===null && cfg.ROOF_MG_BLOCK.includes('agl') && cfg.ROOF_MG_BLOCK.includes('missile'), 'roof MGs: short reach, light hits, PKT free; blocked on grenade-launcher / missile turrets');
  ok(/def\.inf/.test(mg) && /t\.guards/.test(mg) && /shootGuard/.test(mg) && /Math\.min\(1\.05, wantPitch\)/.test(mg) && /vmax=D\.trav/.test(mg) && /-D\.elev, Math\.min\(D\.elev/.test(mg), 'it hunts infantry and tower guards (Z201: helicopters, paratroopers, armour too), swung at the gun own traverse / elevation rates (Z201b damped spring)');
  ok(/MGR\.burst=6\+/.test(mg) && /reloadUntil=now\+D\.reload/.test(mg) && /finish the reload BEFORE/.test(mg) && /color:0xd8a840/.test(mg) && /smoke:true/.test(mg) && /swapUntil=now\+1\.3/.test(mg), 'bursts, hand reload that finishes, brass + smoke at the muzzle, the next rider takes over');
  ok(/MGR\.gunner===r/.test(R('src/actors/riders.js')) && /mountRoofMG\(p\)/.test(R('src/game/mode.js')) && /updateRoofMG\(gdt, now\)/.test(R('src/game/loop.js')) && /data-kt="mg"/.test(R('index.html')), 'mounted every run, the gunner leaves the rider seats, shop tab in the workshop');
  { const s=E.freshState(); s.coins=5000; ok(E.purchase(s,{ type:'mg', id:'m2hb' },cat).ok && s.mgs.includes('m2hb') && !E.purchase(s,{ type:'mg', id:'kord' },cat).ok && E.purchase(s,{ type:'mgup', id:'m2hb', track:'dmg' },cat).ok && s.mgUp.m2hb.dmg===1 && !E.purchase(s,{ type:'mgup', id:'kord', track:'dmg' },cat).ok, 'server: buy an MG once, VIP needs diamonds, upgrade only what you own'); }
  ok(['f_rally_1','f_rally_2','f_rally_3','x_scream','x_cheer'].every(k=>fs.existsSync('assets/voice/'+k+'.mp3')) && /'f_rally_1'\)/.test(R('src/world/fortress.js')) && /playClip\('x_scream'/.test(R('src/game/mode.js')) && /playClip\('x_cheer'/.test(R('src/fx/celebrate.js')), 'fortress commanders rally their men, a scream when your tank goes, the army cheers a victory'); }

// Z168 smoother battle start, steadier controller focus, UI fit pass, weightier shots
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const tips=R('src/ui/tips.js'), br=R('src/ui/briefing.js'), gp=R('src/input/gamepad.js'), css=R('css/ui152.css'), mcss=R('css/menus.css');
  ok(!/S\.mode='tip'/.test(tips) && /tickTip/.test(R('src/game/loop.js')) && /#tipCard\.hidden,#tipCard\.away/.test(css), 'first-time tips no longer pause the battle (a pad could not close them): a side card that times out and hides under menus');
  ok(/prewarmStage\(\)/.test(br) && /renderer\.compile\(scene, camera\)/.test(br) && /function compileQuiet/.test(br) && /typeof pr\.introSeen!=='object'/.test(R('src/core/profile.js')), 'stage shaders compile in the background during the briefing and the 3-2-1; a bad introSeen value can no longer crash the intro');
  ok(/PAD\.ensAt=now\+0\.25/.test(gp) && !/filter:brightness\(1\.38\)/.test(mcss) && /body\.pad :is\(/.test(css), 'controller menus: no per-frame re-scan, no full-card filter pulse, mouse hover off while a pad drives');
  ok(/#start #shopBtn \.lg/.test(css) && /\.case \.case-price\{margin-top:auto/.test(css) && /'-170 0 1420 448'/.test(R('src/ui/padview.js')), 'main menu labels fit, shop prices sit in a button, the pad diagram keeps its left labels');
  ok(/S\.camKick/.test(R('src/combat/flame.js')) && /S\.hitStop/.test(R('src/actors/damage.js')) && /hitStop/.test(R('src/game/loop.js')) && /export function groundBlast/.test(R('src/fx/gunfx.js')) && /glowing fragments/.test(R('src/fx/explosions.js')), 'shots kick the camera by gun weight, heavy kills hit-stop, muzzle ground blast, hot fragments on hard hits'); }

// Z169 radio voice v2: only danger calls and big moments are spoken, 2–3 takes each, danger cuts in, a fresh slate every battle
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const vo=R('src/audio/voice.js'), lines=JSON.parse(R('tools/voice/lines.json'));
  ok(!/'(contact|infantry|rpg|flank|scout|shield|pow|relic|hold|obj_down|camp_down|ally_down|flame)'/.test(vo) && /if\(!\(vk && sayVoice\(vk\)\)\) sfx\('beep'\)/.test(R('src/campaign/operations.js')), 'routine radio chatter is text + beep only; just danger and climax lines are spoken');
  ok(/arty:\[3,30,1\]/.test(vo) && /if\(urgent \|\| force\)\{ cutVoice\(\)/.test(vo) && /HYPE\[k\] && \(VOICE\.playing/.test(vo), 'per-battle caps and gaps; a danger call cuts in over calmer talk; hype lines only into silence');
  ok(/voiceStage\(\)/.test(R('src/ui/briefing.js')) && /sayVoice\('open'\)/.test(R('src/ui/briefing.js')) && /voiceKill\(\)/.test(R('src/actors/damage.js')) && /sayVoice\('lowhp'\)/.test(R('src/game/player-damage.js')), 'new moments: opening call, three-kill streak, armour under 30%');
  ok(lines.length>=45 && lines.every(([,k])=>fs.existsSync('assets/voice/'+k+'.mp3')) && fs.readdirSync('assets/voice').every(f=>/^(x_|f_rally_)/.test(f) || lines.some(([,k])=>k+'.mp3'===f)), 'every scripted line has its file and no stale voice files remain');
  ok(/i===VOICE\.lastTake\[k\]/.test(vo), 'a line never repeats the same take twice running'); }

// Z170 real place names per terrain; sealed forts; lights stop at walls; rubble; basement squads + tunnel ambush; tougher home-bound commanders
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const tv=await import('./src/data/text-vi.js'), wd=await import('./src/data/world.js'), cfg=await import('./config.js'), fo=R('src/world/fortress.js');
  ok(wd.BIOMES.every(b=>tv.BIOME_PLACE[b.name] && tv.BIOME_PLACE[b.name].forts.length>=8 && / · /.test(tv.BIOME_PLACE[b.name].at)) && /BIOME_PLACE\[BIOME\.name\]/.test(fo) && /biomePlace\(BIOME\.name\)/.test(R('src/ui/briefing.js')), 'every terrain is a real place: its region on the briefing and its fortresses named after famous sites there');
  ok(/fortIntactCross\(px, pz, b\.x, b\.z\)/.test(R('src/combat/lock-on.js')) && /fortShellHit\(wb/.test(R('src/combat/flame.js')) && /fortIntactCross\(x, z, e\.pos\.x, e\.pos\.z\)\) continue/.test(R('src/combat/spells.js')) && /if\(f\.breached \|\| f\.captured/.test(fo), 'an unbroken fort is sealed: direct rounds, lobbed shells, rockets, blasts, fire and chain lightning all stop at its wall');
  ok(/sp\.castShadow=true/.test(R('src/render/renderer.js')) && /SPOT\.castShadow=true/.test(R('src/fx/searchlight.js')) && /fortBeamBlocked\(/.test(R('src/fx/searchlight.js')), 'floodlights and the searchlight cast shadows; a searchlight pool never shows behind a wall');
  ok(/  rubble\(f, pc\);/.test(fo) && /function heapGround/.test(fo) && /twisted rebar/.test(fo), 'a fallen wall section leaves broken slabs, rebar and heaped ground across the breach');
  ok(/popHatch\(h\); squadAt\(f, h\.x, h\.z, n, true\)/.test(fo) && /if\(f\.tunnel>0\) tunnelAmbush\(f, now\)/.test(fo) && Array.isArray(cfg.FORT.tunnel), 'the garrison comes up from basement hatches in squads; once the yard is cleared, tunnel squads ambush the tank before the fort falls');
  ok(cfg.FORT.cmdHp>=8 && /fortSendOut\(f, e, now\)\{ if\(!enemies\.includes\(e\) \|\| e\.commander\) return;/.test(fo) && /const H=e\.home\|\|e\.hold/.test(fo) && /boss\.fort===f\)\{ const lim/.test(fo), 'fort commanders are tougher and never leave their walls (the citadel general included)'); }

// Z172 batched troops (one InstancedMesh per body part per side), richer soldier detail + handling animations, unit grid
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const so=R('src/actors/soldiers.js');
  const mk=so.slice(so.indexOf('export function makeSoldierMesh'), so.indexOf('const _tbWhite'));
  ok(!/new THREE\.Mesh\(/.test(mk) && /TROOP_BATCH\.roots\.add\(g\)/.test(mk) && /new THREE\.InstancedMesh\(K\.geo\[kind\]/.test(so) && /updateTroopBatch\(now\)/.test(R('src/game/loop.js')), 'soldiers are joint skeletons drawn through per-part instanced meshes (draw calls no longer grow with the troop count)');
  ok(/intersectsSphere/.test(so) && /RoundedBoxGeometry\(w,h,d,1,/.test(so), 'off-screen men are skipped and the parts stay light');
  ok(/parts\.head/.test(so) && /parts\.lh/.test(so) && /u\.reload=1\.7/.test(so) && /soldierReloading\(e\.mesh\)/.test(R('src/actors/infantry.js')) && /a crawl when flat/.test(so), 'own head + left hand joints: head scan, magazine change (no firing mid-reload), rifle at the ready while running, crouch-walk, crawl, flinch on a hit');
  ok(/buildUnitGrid\(now\)/.test(R('src/game/loop.js')) && /unitsNear\(UGRID\.inf/.test(R('src/actors/infantry.js')) && /blocksAt\(pos\.x, pos\.z\)/.test(R('src/actors/fireteam.js')) && /bulletCands\(b\)/.test(R('src/combat/lock-on.js')), 'spacing, obstacles, crush checks and bullet hits read a unit grid, not every unit'); }

// Z173 squad tactics: enemy squads (leader, wedge, fire-and-manoeuvre with a flank, assault, fall back), suppression, escorts, wave plans, nav grid, our teams + orders
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const sq=R('src/ai/squads.js'), inf=R('src/actors/infantry.js'), ft=R('src/actors/fireteam.js'), wv=R('src/campaign/waves.js'), cfg=await import('./config.js');
  ok(/return makeSquad\(enemies\.slice\(n0\)/.test(inf) && /_sm=squadMove\(e\)/.test(inf) && /'advance'/.test(sq) && /'fm'/.test(sq) && /'assault'/.test(sq) && /'fallback'/.test(sq) && /'escort'/.test(sq), 'enemy foot squads share one plan: wedge advance → fire-and-manoeuvre round a flank → assault, fall back when broken, escort a tank');
  ok(/suppress\(e, dt\*/.test(R('src/combat/lock-on.js')) && /suppress\(e, 0\.6\)/.test(R('src/combat/spells.js')) && /PINNED/.test(inf) && /shoot wild/.test(inf), 'near misses and blasts suppress: pinned men hug the ground, fire slower and wilder');
  ok(/tankEscorted\(g\.e\)/.test(R('src/ai/tactics.js')) && /WAVE\.lastTank/.test(wv) && /'pincer'/.test(wv) && /'probe'/.test(wv) && /prepBarrage\(\)/.test(wv), 'combined arms and wave plans: escorted tanks fix you while the men flank; pincer / probe / artillery-prep waves');
  ok(/export function navPath/.test(sq) && /string-pull/.test(sq) && /navPath\(L\.pos\.x/.test(sq), 'squads route round fortress walls and buildings on an A* nav grid');
  ok(/FTSQ\.bound/.test(ft) && /FTSQ\.focus/.test(ft) && /orderGoal\(a, foe, now\)/.test(ft) && cfg.ACTIONS.some(a=>a[0]==='sqOrder') && /cycleSquadOrder\(\)/.test(R('src/input/bindings.js')), 'our fireteam: two teams alternate bounding / covering, one focus target, squad orders (hold · push · flank left · flank right)'); }

// Z174 real-world scale: 1 unit = 1 m; every man 1.78 m; real wall / tower / cover / tree heights; vehicles and elites at their real size
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const cfg=await import('./config.js'), ED=await import('./src/data/enemies.js');
  ok(Math.abs(cfg.HUMAN_SCALE*1.407-1.78)<0.01 && ED.SOLDIER.scale===cfg.HUMAN_SCALE && ED.RIDER.scale===cfg.HUMAN_SCALE && /setScalar\(HUMAN_SCALE\)/.test(R('src/world/towers.js')) && /setScalar\(HUMAN_SCALE\)/.test(R('src/world/fortress.js')) && /HUMAN_SCALE\/\(ENEMY_DEFS\.carrier\.scale\*TANK_SCALE\)/.test(R('src/actors/enemies.js')), 'every man in the game is 1.78 m — infantry, our squad, guards on walls / towers / bridges, riders, APC passengers');
  ok(cfg.FORT.wallH>=11 && cfg.FORT.wallT>=3.2 && /stoneBox\(0\.98, 1\.45/.test(R('src/world/fortress.js')) && cfg.FORT.arch.keepH>=34 && /KH=FORT\.arch\.keepH/.test(R('src/world/fortress.js')) && ED.TOWER.h>=8, 'Z241 great curtain walls ≥ 11 m with 1.45 m merlons on a corbelled gallery, ≥ 3.2 m thick, a ≥ 34 m donjon; watchtowers 8 m to the deck');
  ok(/h:2\.1\+Math\.random\(\)\*0\.6/.test(R('src/world/brick-walls.js')) && /sandbag:0\.7/.test(R('src/world/props.js')) && /real:1\.4/.test(R('src/world/flora.js')), 'compound walls ~2.4 m, sandbag lines 1.2 m, trees 10–17 m');
  ok(ED.ENEMY_DEFS.heavy.scale<=1.1 && ED.ENEMY_DEFS.carrier.scale<=1.0 && cfg.BALANCE.elite.sizeMul===1, 'enemy vehicles at their real size (T-14 ≈ an MBT, APCs not bigger than tanks); elites are not bigger'); }

// Z174b real tank proportions · Z175 watchtower kinds (timber / steel / concrete by land), garrison = firepower, our rocket men hit towers
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const cfg=await import('./config.js'), tk=R('src/world/tower-kinds.js'), WD=await import('./src/data/world.js'); const md=R('src/tank/model.js'), ds=R('src/tank/designs.js'), ft=R('src/actors/fireteam.js');
  ok(cfg.TANK_REAL.L>1.3 && /startsWith\('b_'\) \? null : TANK_REAL/.test(md) && /export function realDesign/.test(ds) && /id\.startsWith\('b_'\)\) return d0/.test(ds) && /turMount\.scale\.set\(1\/W, 1\/H, 1\/L\)/.test(md) && /HULL_HL=2\.05\*1\.36/.test(R('src/world/physics.js')), 'every tank at real MBT proportions (long low hull, longer gun; turret never shears); the generals keep their super-heavies');
  const kinds=[...tk.matchAll(/\n  (\w+): \{ vi:'[^']+', mat:'(\w+)', h:([\d.]+), r:[\d.]+, hp:([\d.]+), guards:\[((?:\[[^\]]+\],?)+)\]/g)], mats=new Set(kinds.map(k=>k[2])), tb=tk.slice(tk.indexOf('export const TOWER_BIOME'));
  ok(kinds.length>=7 && ['wood','steel','conc','bamboo'].every(m=>mats.has(m)) && WD.BIOMES.every(b=>new RegExp('\\b'+b.name+':\\{').test(tb)) && kinds.every(k=>(k[5].match(/\[/g)||[]).length>=2 && +k[3]>=6 && +k[4]>0), 'seven watchtower builds in timber, bamboo, steel and concrete; every land raises the kinds it would really have');
  ok(/posts\.length-\(posts\.length>2/.test(R('src/world/towers.js')) && /K\.hp\*loopHpMul/.test(R('src/world/towers.js')), 'a tower is manned post by post (its firepower is its garrison) and its strength follows its material');
  ok(/kind:'towerAT'/.test(ft) && /function rocketHitsTower/.test(ft) && /n=all\?live\.length:Math\.ceil\(live\.length\/2\)/.test(ft), 'our soldiers with a launcher fire up into a manned tower: half its guards — or all of them — are killed'); }

// Z176 fortress gates carry a carved name stone; flags fly on every great tower; a command post in every fort that can be shelled to ruins
{ const fs=await import('node:fs'); const R=f=>fs.readFileSync(f,'utf8'); const fo=R('src/world/fortress.js');
  ok(/function plaqueMat\(name, place, tier\)/.test(fo) && /plaqueMat\(f\.name, biomePlace\(BIOME\.name\), f\.tier\)/.test(fo), 'every gate has a carved, gilded name stone: the fort and the place');
  ok(/FLAGS\.push\(\[px,pz,TH2\]\)/.test(fo) && /f\.towerFlags\.push\(fl\)/.test(fo) && /for\(const fl of \(f\.towerFlags\|\|\[\]\)\) fl\.material\.map=vnTex\(\)/.test(fo), 'flags fly from the great towers and turn to our colours when the fort is taken');
  ok(/buildCore\(f, g, WM\)/.test(fo) && /kind:'fortcore'/.test(fo) && /fortCoreHit\(b, dmg\)/.test(R('src/world/cover.js')) && /function coreRuins/.test(fo) && /f\.coreDown\) return;/.test(fo), 'a command post in every fort (main and lesser) — shelled to ruins it burns, and the fort loses its reserves and its sorties'); }

// Z177 loot markers: no light columns — the object blinks gold; a loot tank shows one small blinking light at its hatch
{ const fs=await import('node:fs'); const b=fs.readFileSync('src/loot/beacons.js','utf8');
  ok(!/CylinderGeometry\(0\.14,0\.55/.test(b) && /function topDot\(owner\)/.test(b) && /function hatchLight/.test(b) && !/ownMats|_gold/.test(b), 'Z211 loot shows as ONE blinking gold point above the crate / tower / hut (the object is never recoloured), a tank carrying loot a small light at its hatch — no light columns'); }

// Z178 hidden overlays leave the compositor (they used to stay as see-through blurred layers and starve GPU tile memory → menus lost pieces on hover)
{ const fs=await import('node:fs'); const c=fs.readFileSync('css/menus.css','utf8');
  ok(/\.overlay\.hidden\{visibility:hidden;backdrop-filter:none !important/.test(c) && /visibility 0s linear \.4s/.test(c) && /\.overlay\.hidden \*\{animation:none !important;\}/.test(c), 'a hidden menu fades out, then stops painting: no blur, no animation, nothing left to eat GPU memory'); }

// Z179 battlefield-aware paint: each side is re-dyed per battlefield so it separates from the ground
{ const fs=await import('node:fs'); const sp=fs.readFileSync('src/world/sidepaint.js','utf8'), so=fs.readFileSync('src/actors/soldiers.js','utf8'), tm=fs.readFileSync('src/tank/model.js','utf8'), en=fs.readFileSync('src/actors/enemies.js','utf8'), bi=fs.readFileSync('src/world/biome.js','utf8');
  ok(/export function sideShift/.test(sp) && /export function paintTroops/.test(sp) && /export function paintVehicle/.test(sp) && /hue:\{ f:0\.5, e:0\.985 \}/.test(sp), 'paint rules: same hue as the ground → ours slate-teal, theirs crimson; light ground → darker paint; grey ground → richer colour');
  ok(/x\.fillRect\(64,0,16,64\)/.test(so) && /88\/256/.test(so) && /paintTroops\(\)/.test(so), 'soldier atlas has its own gear + helmet stripes, repainted per battlefield');
  ok((tm.match(/userData\.paint = CAMO/g)||[]).length===2 && /paintVehicle\(m, 'e'\)/.test(en) && /paintTroops\(\);/.test(bi), 'every enemy / allied hull carries a paint list and is repainted when it enters a battle; troops re-dyed on each new battlefield'); }

// Z180 a stage won inside a fort: the next stage starts at the spawn, not inside the new battlefield's walls
{ const fs=await import('node:fs'); const up=fs.readFileSync('src/loot/upgrades.js','utf8'), fl=fs.readFileSync('src/game/flow.js','utf8');
  ok(/parkAtSpawn\(\);[^\n]*\n  applyBiome\(S\.stage\)/.test(up) && /export function parkAtSpawn\(\)\{[^]*?p\.pos\.set\(0,0,sz\)[^]*?ALLY_TANKS\.forEach[^]*?clearLadders\(\)/.test(fl), 'next stage: our tank + captured tanks roll back to the clear spawn before the new battlefield is built'); }

// Z181 battle setup shows every battlefield by a real in-game photo + one-line story; UI pro pass stylesheet is loaded last
{ const fs=await import('node:fs'); const bs=fs.readFileSync('src/ui/battle-setup.js','utf8'), tv=fs.readFileSync('src/data/text-vi.js','utf8'), html=fs.readFileSync('index.html','utf8');
  const names=['DESERT','RUINS','ARCTIC','FOUNDRY','CITADEL','MEADOW','CITY','SAVANNA','VOLCANO','QUARRY'];   // Z253 ten battlefields
  ok(/export function mapShot\(b\)\{ return 'assets\/maps\/'\+b\.name\.toLowerCase\(\)\+'\.webp'; \}/.test(bs) && names.every(n=>fs.existsSync('assets/maps/'+n.toLowerCase()+'.webp')), 'every battlefield has its photo (assets/maps/<biome>.webp) and the setup screen uses it');
  ok(names.every(n=>new RegExp('\\n  '+n+":'[^']{20,}'").test(tv)) && /id="bsShotImg"/.test(html) && /id="bsFacts"/.test(html), 'each battlefield has a one-line story; the hero card shows photo + facts');
  ok(/<link rel="stylesheet" href="css\/ui152\.css" \/>\n<link rel="stylesheet" href="css\/ui181\.css" \/>/.test(html), 'UI pro pass (options, buttons, item text) loads after every other stylesheet'); }
// Z182 first-run onboarding: call-up card → guided training in a trial tank with two trial guns → showcase with the way to own them
{ const fs=await import('node:fs'); const tr=fs.readFileSync('src/ui/training.js','utf8'), ga=fs.readFileSync('src/ui/garage.js','utf8'), fl=fs.readFileSync('src/game/flow.js','utf8'), br=fs.readFileSync('src/ui/briefing.js','utf8'), lp=fs.readFileSync('src/game/loop.js','utf8'), st=fs.readFileSync('src/game/startup.js','utf8'), mn=fs.readFileSync('src/ui/menus.js','utf8');
  const steps=(tr.match(/\{ id:'(drive|shoot|rail|dash|skill|crew|tesla)'/g)||[]).length;
  ok(steps===7 && /TRAIN_REWARD = \{ step:150, finish:450 \}/.test(tr), 'training: 7 guided steps (drive · shoot · railgun · dash · skill · crew · tesla), 7×150 + 450 = 1.500 xu = the cheapest real tank');
  ok(/if\(TRIAL\.on && TANK_MODELS\[TRIAL\.tank\]\) return TRIAL\.tank;/.test(ga) && /if\(TRIAL\.on\) return \['rifle', \.\.\.TRIAL\.guns\]/.test(fl), 'the trial tank + guns are only lent for the run (ownership untouched)');
  ok(/if\(TRAIN\.on\)\{ hide\('briefing'\); launchStage\(false\); return; \}/.test(br) && /if\(TRAIN\.on\) trainTick\(gdt, now\);/.test(lp) && /if\(TRAIN\.on\)\{ TRAIN\.on=false; TRIAL\.on=false;/.test(fl), 'training skips contract + troop plan, is watched every frame, and ends cleanly when you leave');
  ok(/openTrainInvite\(\)/.test(st) && /openTrainInvite\(\)/.test(mn) && /S\.player\.modelId !== currentTank\(\)\)\{ scene\.remove\(S\.player\.mesh\); S\.player=makePlayer\(\); \}/.test(fl), 'a new player gets the call-up card after the call sign; afterwards their own tank rolls back out'); }

// Z183 phone HUD: nothing big above the tank — notes small at the right, radio one line at the bottom, timers + pickup card in the left column; notes spaced far apart
{ const fs=await import('node:fs'); const c=fs.readFileSync('css/ui181.css','utf8'), t=fs.readFileSync('src/ui/tips.js','utf8');
  ok(/body\.touch #tipCard\{inset:auto !important;top:calc\(max\(8px,env\(safe-area-inset-top\)\) \+ 168px\) !important;/.test(c) && /-webkit-line-clamp:2/.test(c) && /body\.touch #radio\{top:auto !important;bottom:/.test(c) && /body\.touch #buffbar\{left:/.test(c) && /body\.touch #lootToast \.lt-ds\{display:none !important;\}/.test(c), 'phone HUD keeps the space above the tank clear');
  ok(/TIP_SECS_TOUCH=8, TIP_GAP_TOUCH=20/.test(t) && /MOBILE\?TIP_GAP_TOUCH:6/.test(t), 'on a phone a first-time note lasts 8 s and the next waits 20 s'); }

// Z184 camera: a low cinematic chase view by default (old high view kept as CHIẾN THUẬT) + the player's own pitch / distance / FOV / look-ahead
{ const fs=await import('node:fs'); const cf=fs.readFileSync('config.js','utf8'), up=fs.readFileSync('src/game/update.js','utf8'), st=fs.readFileSync('src/ui/settings.js','utf8');
  ok(/cine:     \{ off:\[0,9\.4,18\.2\]/.test(cf) && /tactical: \{ off:\[0,28,23\]/.test(cf) && /export const CAM_TUNE = \{ pitch:\[16,72,4\]/.test(cf), 'two camera styles + tuning ranges');
  ok(/export function camParams\(\)/.test(up) && /camOff\.set\(0, P\.dist\*Math\.sin\(r\), P\.dist\*Math\.cos\(r\)\)/.test(up) && /try\{ k=PROFILE\.camStyle; \}catch\(e\)\{\}/.test(up), 'the camera is built from pitch + distance, safe before the profile loads');
  ok(['setCamPitch','setCamDist','setCamFov','setCamAhead'].every(id=>st.includes("'"+id+"'")), 'settings: pitch, distance, field of view and look-ahead steppers'); }
// Z185 smarter enemy tanks: dodge your shells, weave in a fight, rush you while you reload, fire telegraphed volleys
{ const fs=await import('node:fs'); const t=fs.readFileSync('src/ai/tactics.js','utf8'), cf=fs.readFileSync('config.js','utf8');
  ok(/export function aiEvade\(e, now, iq\)/.test(t) && /if\(def\.canShoot && !def\.truck\) aiEvade\(e, now, _iq\);/.test(t), 'tanks read incoming shells and break sideways');
  ok(/AID\.punish = iq>=T\.punish\.from && !!\(g && g\.rU>now\)/.test(t) && /e\.volleyAt=now\+V\.warn/.test(t) && /if\(!e\.forceShot && Math\.random\(\)/.test(t), 'reload punish + coordinated volley with a muzzle-glint telegraph');
  ok(/evade:  \{ from:0\.2/.test(cf) && /volley: \{ from:0\.55/.test(cf), 'tunable in TACTICS'); }
// Z186 five ultimate weapons
{ const fs=await import('node:fs'); const gd=fs.readFileSync('src/data/guns.js','utf8'), u=fs.readFileSync('src/combat/ultimate.js','utf8'), cf=fs.readFileSync('config.js','utf8'), br=fs.readFileSync('src/tank/barrels.js','utf8');
  const ids=['orbital','plasma','hydra','singularity','photon'];
  ok(ids.every(id=>new RegExp('\\n  '+id+':\\s+\\{ name:[^\\n]*ulti:true[^\\n]*special:\''+id+'\'').test(gd)), 'five ultimates, each with its own special mechanic');
  ok(['fireOrbital','firePlasma','fireHydra','fireSingularity','firePhoton','updateUltimates','clearUltimates'].every(f=>u.includes('function '+f)) && /b\.tgt=e/.test(u), 'orbital lance · plasma sun · Hydra (one target per head) · black hole · photon beam');
  ok(ids.every(id=>cf.includes(id+':{d:')) && /VIP_GUNS = \['railgun','rocket','orbital','plasma','hydra','singularity','photon'\]/.test(cf) && ids.every(id=>br.includes("id==='"+id+"'")), 'diamond-priced, VIP, each with its own barrel model'); }

// Z187 three new battlefields: abandoned steelworks · volcanic caldera (lava burns) · Carrara marble quarry — present in every per-battlefield table
{ const fs=await import('node:fs'); const files=['src/data/world.js','src/data/text-vi.js','src/world/ground.js','src/world/regional.js','src/world/tower-kinds.js','src/world/env-events.js','src/world/props.js','src/world/wonders.js','src/world/flora.js','src/world/atmosphere.js'];
  const src=files.map(f=>[f, fs.readFileSync(f,'utf8')]); const miss=[];
  for(const n of ['VOLCANO','QUARRY']) for(const [f,s] of src) if(!s.includes(n)) miss.push(n+' @ '+f);
  ok(!miss.length, 'every per-battlefield table knows VOLCANO / QUARRY'+(miss.length?' — missing: '+miss.join(', '):''));
  const lv=fs.readFileSync('src/world/lava.js','utf8'), fl=fs.readFileSync('src/game/flow.js','utf8'), lp=fs.readFileSync('src/game/loop.js','utf8');
  ok(/export function buildLava\(\)/.test(lv) && /BIOME\.name!=='VOLCANO'/.test(lv) && /damagePlayer\(LAVA\.dps\.player\*dt, now\)/.test(lv) && /buildObjective\(\); buildLava\(\);/.test(fl) && /updateLava\(gdt, now\)/.test(lp), 'caldera lava pools are placed clear of forts, glow, and burn tanks that drive in'); }

// Z188 strike & lock visuals: a readable artillery zone (disc, hazard band, closing chevrons, countdown arc, label, shell shadow), flame tongues + smoke ribbons, a "BỊ KHOÁ" warning, a KHOÁ label on our locks
{ const fs=await import('node:fs'); const a=fs.readFileSync('src/campaign/artillery.js','utf8'), m=fs.readFileSync('src/actors/enemy-missiles.js','utf8'), l=fs.readFileSync('src/combat/lock-on.js','utf8'), sy=fs.readFileSync('src/audio/synth.js','utf8'), lp=fs.readFileSync('src/game/loop.js','utf8');
  ok(/function tickArtLock\(zone, k, fly, now, dt\)/.test(a) && /holoRing\(R, \{ kind:'danger', flat:false/.test(a) && /u\.shadow\.material\.opacity/.test(a) && /sfx\('whistle'\)/.test(a), 'Z213 artillery zone: one thin blinking red ring (faster as the shell nears), shell shadow, falling whistle');
  ok(/export function updateLockWarn\(dt, now\)/.test(m) && /BỊ KHOÁ/.test(m) && /updateLockWarn\(gdt, now\)/.test(lp) && /case 'lockwarn'/.test(sy), 'guided missile → red brackets + BỊ KHOÁ round your tank, beeping faster as it closes');
  ok(/◆ KHOÁ/.test(l) && /dgrp/.test(l), 'our missile lock: dashed ring + KHOÁ label once the brackets snap'); }

// Z189 cinematic upgrade: the horizon (ranges per battlefield, smoke columns, flashes, jets), a lower chase camera that shows it, rim-lit shock domes,
//   real fire light, long-burning wrecks with tall smoke columns, sparks + a direction marker when we are hit, smoke / fire as our tank is wrecked
{ const fs=await import('node:fs'); const h=fs.readFileSync('src/world/horizon.js','utf8'), c=fs.readFileSync('src/fx/cinematic.js','utf8'), ex=fs.readFileSync('src/fx/explosions.js','utf8'), pd=fs.readFileSync('src/game/player-damage.js','utf8'), bi=fs.readFileSync('src/world/biome.js','utf8'), lp=fs.readFileSync('src/game/loop.js','utf8');
  const names=['DESERT','RUINS','ARCTIC','FOUNDRY','CITADEL','MEADOW','CITY','SAVANNA','VOLCANO','QUARRY'];   // Z253 ten battlefields
  ok(names.every(n=>new RegExp('\\b'+n+':\\[0x').test(h)) && /export function buildHorizon\(b\)/.test(h) && /launchJets/.test(h) && /buildHorizon\(BIOME\)/.test(bi) && /updateHorizon\(dt, now\)/.test(lp), 'every battlefield has distant ranges, war smoke on the horizon, flashes and jet flyovers');
  ok(/pow\(f,3\.0\)/.test(c) && /shockDome\(pos\.x, pos\.z/.test(ex) && /blastLight\(pos\.x, pos\.z/.test(ex) && /fireLight\(w, w\.life\*0\.7\)/.test(fs.readFileSync('src/fx/fire-wrecks.js','utf8')), 'tank kills: rim-lit shock dome, the ground lit by the blast, burning hulks light their surroundings');
  ok(/playerHitFX\(p, dx, dz, dmg\)/.test((await import('node:fs')).readFileSync('src/game/mode.js','utf8')) && /MODE\.onHit\(p, dmg, dx, dz\)/.test(pd) && /function hitMarker/.test(c) && /f<0\.25\?0x14110e:0x6a645c/.test(c), 'our tank hit: sparks + shards off the struck side, a red direction marker, smoke grey then black + fire as it is wrecked'); }

// Z190 no freeze + calmer strike visuals: fire light is a ground glow (never a PointLight added mid-fight → no shader recompiles), far objects lost
//   in the fog are culled from the low cinematic camera, the artillery zone and the lock warning are toned down
{ const fs=await import('node:fs'); const c=fs.readFileSync('src/fx/cinematic.js','utf8'), lv=fs.readFileSync('src/world/lava.js','utf8'), lod=fs.readFileSync('src/render/lod.js','utf8'), a=fs.readFileSync('src/campaign/artillery.js','utf8');
  ok(!/new THREE\.PointLight/.test(c) && !/new THREE\.PointLight/.test(lv) && /export function groundGlowMesh/.test(c) && /groundGlowMesh\(/.test(lv), 'fire light and lava glow add no lights mid-fight (no shader recompile freeze)');
  ok(/export function fogCull\(\)/.test(lod) && /fogCull\(\);/.test(lod) && /CULL_LAYER=7/.test(lod) && /isPoints/.test(lod), 'objects lost in the fog are not drawn; particle layers / big pieces are never culled');
  ok(!/PHÁO KÍCH'|chev|hazard|ringPulse\(\{x:s\.tx,z:s\.tz\}, 0xff4632/.test(a), 'Z213 artillery zone: no label, chevrons, hazard band or warning waves'); }

// Z191 cinematic colour: film split-tone + vibrance + a soft highlight shoulder in the grade, and every battlefield / hour has its own palette
{ const fs=await import('node:fs'); const r=fs.readFileSync('src/render/renderer.js','utf8'), at=fs.readFileSync('src/world/atmosphere.js','utf8'); const W=await import('./src/data/world.js');
  ok(/shTint\*\(1\.0-smoothstep/.test(r) && /hiTint\*smoothstep/.test(r) && /vib\*\(1\.0-s0\)/.test(r) && /step\(0\.8,c\)/.test(r), 'grade: split-tone, vibrance and a film shoulder');
  ok(Object.values(W.ATMOS).every(A=>Array.isArray(A.sh) && Array.isArray(A.hi) && typeof A.vib==='number' && A.exp>0.6 && A.exp<1.2), 'every battlefield has its own exposure, shadow / highlight tint and vibrance');
  ok(/u\.shTint\.value\.set/.test(at) && /o\.sh=\[/.test(at) && /ek=\(A\.exp\|\|1\.08\)\/1\.08/.test(at), 'the palette is applied per battle; sunset and night have their own tints, exposure carries through every hour'); }

// Z192 combat: true-intercept lead, no rounds wasted into cover, grid-based obstacle tests; real-looking rounds, missiles and armour hits
{ const fs=await import('node:fs'); const t=fs.readFileSync('src/ai/tactics.js','utf8'), lo=fs.readFileSync('src/combat/lock-on.js','utf8'), hx=fs.readFileSync('src/fx/hitfx.js','utf8'), sp=fs.readFileSync('src/ai/spatial.js','utf8'), pt=fs.readFileSync('src/fx/particles.js','utf8');
  const m=t.match(/export function interceptT\(([^)]*)\)\{([\s\S]*?Math\.min\(flat, 1\.6\); \})/); const iT=m && new Function(...m[1].split(',').map(x=>x.trim()), m[2].replace(/\}\s*$/,''));
  ok(!!iT, 'interceptT can be lifted out for a math check');
  if(iT){ const tt=iT(0,0, 30,0, 0,10, 60), hx2=30, hz2=10*tt; ok(Math.abs(Math.hypot(hx2,hz2)-60*tt)<1e-6 && tt>0.5 && tt<0.52, 'intercept: the round and the moving target meet (|T+V·t| = s·t)');
    ok(Math.abs(iT(0,0, 40,0, 0,0, 50)-0.8)<1e-9, 'intercept: a still target → plain flight time');
    ok(iT(0,0, 30,0, 80,0, 60) <= 1.6, 'intercept: an uncatchable target never gives a wild lead (capped)'); }
  ok(/fireBlocked\(_v\.x, _v\.z, _v\.y, target\.x, target\.z, def\.bspeed\)/.test(t) && /e\.scootUntil=now\+TACTICS\.los\.peek/.test(t) && /interceptT\(_v\.x, _v\.z/.test(t), 'enemy gunners check the line of fire, slide out to peek, lead with the true intercept');
  ok(/export function blocksNear/.test(sp) && /b\._bst!==st/.test(sp) && /blocksNear\(b\.x, b\.z, b\.r, _bnb\)/.test(lo) && /blocksNear\(e\.pos\.x, e\.pos\.z, look\+6, _nb\)/.test(t), 'rounds and steering test only the obstacles in nearby grid cells (each once)');
  ok(/orientShell\(b, _wy, dt\)/.test(lo) && /core\.scale\.set\(0\.38, 0\.38, shellStretch/.test(lo) && /rocketExhaust\(b, b\.x, _wy, b\.z\)/.test(lo), 'rounds fly as streaks pointed along their path; missiles lay a smoke ribbon');
  ok(/keep:true/.test(hx) && /!o\.keep/.test(pt) && /armourHit\(e, b\.x/.test(lo) && /export function enemyDamageFX/.test(hx) && /rockHull\(p, ux, uz, dmg\)/.test(fs.readFileSync('src/fx/cinematic.js','utf8')), 'armour hits rock the hull + spall / glance; hurt tanks smoke; the ribbon is never randomly thinned'); }

// Z193 field obstacles at the tanks' scale, five new kinds, every piece breakable, broken pieces leave rubble
{ const fs=await import('node:fs'); const W=await import('./src/data/world.js'); const pr=fs.readFileSync('src/world/props.js','utf8'), cv=fs.readFileSync('src/world/cover.js','utf8'), rb=fs.readFileSync('src/world/rubble.js','utf8'), lo=fs.readFileSync('src/combat/lock-on.js','utf8');
  ok(W.COVER_K>=1.2 && /SEG=3\*COVER_K/.test(cv) && /m\.scale\.setScalar\(COVER_K\)/.test(cv), 'field cover is built at the scale of the tanks');
  ok(['jersey','teeth','logs','wreck','container'].every(k=>pr.includes("kind==='"+k+"'") && W.COVER_HP[k]>0), 'jersey barriers, dragon\'s teeth, log barricades, car wrecks, containers exist and have HP');
  ok(['concrete','pipes','hesco'].every(k=>isFinite(W.COVER_HP[k])) && !/const hp = steel \? Infinity/.test(cv) && /export function heavyDamage/.test(cv), 'concrete / pipes / HESCO break under fire (no more shell-proof cover)');
  ok(/export function leaveRubble/.test(rb) && /leaveRubble\(b/.test(cv) && /clearRubble\(\)/.test(cv), 'a broken piece leaves a heap of its own material; heaps are cleared each battle');
  ok(/\(bl\.hard \|\| bl\.heavy\) && b\.inf/.test(lo) && /bl\.heavy\?0\.4:1/.test(lo), 'rifle rounds only chip solid cover; enemy shells wear it slowly'); }

// Z194 enemy supply bases: fuel station, ammo depot, bigger camps — guarded, reinforced, and losing them weakens the enemy
{ const fs=await import('node:fs'); const C=await import('./config.js'); const su=fs.readFileSync('src/world/supply.js','utf8'), cp=fs.readFileSync('src/world/camps.js','utf8'), tc=fs.readFileSync('src/ai/tactics.js','utf8'), wv=fs.readFileSync('src/campaign/waves.js','utf8'), cv=fs.readFileSync('src/world/cover.js','utf8');
  ok(C.SUPPLYB && C.SUPPLYB.perStage.total.every(n=>n>=3 && n<=4), 'every battle has 3–4 enemy compounds (fuel and ammo alternating)');
  ok(/function fuelTank\(/.test(su) && /function igloo\(/.test(su) && /function tankerTruck\(/.test(su) && /function ammoStack\(/.test(su) && /SUPPLY_K=1\.25/.test(su) && /CAMP_K=1\.35/.test(cp), 'big, detailed installations (tank farm, igloo magazines, trucks, crate stacks) and bigger camps');
  ok(/garrisonSupply\(\)/.test(cv) && /e\.guardBase=B/.test(su) && /spawnEnemy\('gunship'/.test(su) && /coverSpot\(/.test(su) && /guardLeash\(e, dt, p\)/.test(tc), 'guards spread behind cover, guard tanks hold a leash, gunships and armour are called in');
  ok(/supplySpeed\(\)/.test(tc) && /supplyRate\(\)/.test(tc) && /supplyDmg\(\)/.test(wv) && /trimWaveForSupply\(WAVE\.spawnQueue\)/.test(wv), 'losing fuel / ammo / barracks slows enemy tanks, softens their fire, thins their waves');
  ok(/\(bl\.kind==='obj' \|\| bl\.supply\) && b\.owner==='e'/.test(fs.readFileSync('src/combat/lock-on.js','utf8')), 'enemy fire never hurts its own bases');
  const S={ fuel:0, ammo:0, camp:0 }; ok(Math.max(C.SUPPLYB.cut.min, 1-C.SUPPLYB.cut.speed*2)<1 && C.SUPPLYB.cut.min>=0.6, 'the cuts are capped (the enemy is weakened, never crippled)'); }

// Z195 the compounds stand in the map corners behind a real fence: chain-link + barbed wire (tanks flatten it), a steel gate, warning signs, steel frames
{ const fs=await import('node:fs'); const su=fs.readFileSync('src/world/supply.js','utf8');
  ok(/export function scanSite\(R0, score, o\)/.test(su) && /scanSite\(R, \(x,z\)=>Math\.hypot\(x-sx\*\(ARENA-jx\)/.test(su), 'compounds go to the free spot nearest each map corner (Z196 grid scan: never misses a gap)');
  ok(/function fenceBase\(/.test(su) && /TorusGeometry\(0\.42,0\.013/.test(su) && /alphaTest:0\.35/.test(su) && /sp\.down=true/.test(su), 'chain-link + barbed-wire fence with a razor concertina; the hull flattens a bay');
  ok(['fire','nosmoke','ammo','military','mines'].every(k=>su.includes("kind==='"+k+"'")) && /CẤM LỬA/.test(su) && /KHU VỰC QUÂN SỰ/.test(su), 'Vietnamese warning signs: flammable, no fire, explosives, military zone, mines');
  ok(/function lattice\(/.test(su) && /function gate\(/.test(su) && /storage shed/.test(su), 'steel lattice light towers, a steel gate portal with a boom, a steel-frame storage shed'); }

// Z196 lived-in barracks (mess, quartermaster, medical post, rest area, a crowd that scrambles on the alarm), grid-scanned sites, levelled pads, readable signs
{ const fs=await import('node:fs'); const cl=fs.readFileSync('src/world/camp-life.js','utf8'), cp=fs.readFileSync('src/world/camps.js','utf8'), su=fs.readFileSync('src/world/supply.js','utf8'), zn=fs.readFileSync('src/world/zones.js','utf8');
  ok(['messHall','quartermaster','medical','restArea','latrines'].every(f=>cl.includes('export function '+f+'(') && cp.includes(f+'(L,')), 'the camp feeds, clothes, treats and rests its men (mess, stores, medical post, rest area, latrines)');
  ok(/export function person\(/.test(cl) && /'sit'/.test(cp) && /'lie'/.test(cp) && /'drill'/.test(cp) && /'walk'/.test(cp) && /'guard'/.test(cp) && /scrambleCrowd\(c\)/.test(cp), 'the camp is full of men (eating, by the fire, drilling, wounded, walking, a sentry) who run for the barracks on the alarm');
  ok(/export function flattenPad\(/.test(su) && /flattenPad\(x, z, CAMP_R/.test(cp) && /buildSupply\('far'\)/.test(fs.readFileSync('src/world/cover.js','utf8')), 'compounds sit on levelled ground; far corners → camps → near corners');
  ok(/signBack\(\)/.test(su) && /\[Math\.PI,-0\.2\]/.test(su) && /SUPPLY\.bases\) if\(Math\.hypot/.test(zn), 'signs read right from both sides; nothing is scattered inside a compound'); }

// Z197 the radar station: a sweeping phased array high on a lattice tower, AA guns, artillery blinded when it falls
{ const fs=await import('node:fs'); const rd=fs.readFileSync('src/world/radar.js','utf8'), su=fs.readFileSync('src/world/supply.js','utf8'), ar=fs.readFileSync('src/campaign/artillery.js','utf8');
  ok(/function taperLattice\(/.test(rd) && /export function radarTower\(/.test(rd) && /panelMat\(\)/.test(rd) && /B\.head\.rotation\.y\+=dt\*/.test(su), 'a tall lattice radar tower whose phased array sweeps without stopping');
  ok(/export function aaGun\(/.test(rd) && /updateAAGun\(pc\.mesh, pc, dt, now, p\)/.test(su) && /export function radome\(/.test(rd), 'twin AA guns swing onto you and fire; a radome; the usual wire, gate and garrison');
  ok(/artyShotCut\(\)/.test(ar) && /artyErr\(\)/.test(ar) && /artyRestMul\(\)/.test(ar) && /toppleTower\(b, dir, now\)/.test(su), 'the tower topples; with the radar gone the barrages come less often, with fewer and wilder shells'); }

// Z198 the attack helicopter: a modern armoured gunship model, a chin gun that tracks, exhaust haze, flares against a locked missile
{ const fs=await import('node:fs'); const v=fs.readFileSync('src/actors/vehicles.js','utf8'), lo=fs.readFileSync('src/combat/lock-on.js','utf8');
  ok(/stepped tandem canopy/.test(v) && /quad ATGM rack/.test(v) && /5-blade main rotor/.test(v) && /_mergeColored\(P\[k\]\)/.test(v), 'gunship: armoured fuselage, tandem canopy, engines, stub wings with pods + ATGMs, 5-blade rotor (merged per material)');
  ok(/the chin gun tracks you/.test(v) && /FLARES/.test(v) && /b\.flared && now<b\.flared/.test(lo), 'the chin gun tracks; flares can pull a locked missile off'); }

// Z199 the airborne assault: a formation of transports, sticks from the ramp, real canopies filling the sky, a cargo bundle, an escort
{ const fs=await import('node:fs'); const C=await import('./config.js'); const pd=fs.readFileSync('src/actors/paradrop.js','utf8');
  ok(C.PARA.helos.every(n=>n>=1) && Math.max(...C.PARA.helos)>=3 && C.PARA.troops[0]>=6 && C.PARA.alt>=25, 'a formation of up to 3 transports, 6–9 jumpers each, from high up');
  ok(/the lowered ramp/.test(pd) && /jumpmaster/.test(pd) && /freefall a beat, then the canopy cracks open/.test(pd) && /the canopy breathes/.test(pd), 'tandem-rotor transport with the ramp down; jumpers freefall, then the canopy opens and breathes');
  ok(/SMOKE_ZONES\.push/.test(pd) && /spawnEnemy\('gunship'/.test(pd) && /a supply bundle: cover to fight from/.test(pd) && /CANOPIES\.push/.test(pd), 'red smoke on the drop zone, an escort gunship, a cargo bundle that lands as cover, canopies left lying on the ground'); }

// Z199b painted helicopters (splinter camo, red bands, roundels, numbers, yellow tips) and enemy soldiers that stand out
{ const fs=await import('node:fs'); const v=fs.readFileSync('src/actors/vehicles.js','utf8'), pd=fs.readFileSync('src/actors/paradrop.js','utf8'), sp=fs.readFileSync('src/world/sidepaint.js','utf8'), so=fs.readFileSync('src/actors/soldiers.js','utf8');
  ok(/export function heliCamoTex\(/.test(v) && /insigniaMat\(\)/.test(v) && /yellow blade tips/.test(v) && /heliCamoTex\(\)/.test(pd) && /insigniaMat\(\)/.test(pd), 'helicopters wear camo, red bands, the faction roundel, a number and yellow blade tips');
  ok(/sat:\[0\.38,0\.72\]/.test(sp) && /0xa02a20/.test(so) && /emissiveIntensity:M\.band\.emissiveIntensity/.test(so), 'soldiers wear richer colours; the enemy has a clearer crimson helmet and a brighter armband'); }

// Z200 a smarter squad: shoots helicopters and tower guards, weighs its strength (advance / hold / fall back), the wounded patch up behind the tank
{ const fs=await import('node:fs'); const C=await import('./config.js'); const ft=fs.readFileSync('src/actors/fireteam.js','utf8');
  ok(C.SQUAD.ai && C.SQUAD.ai.airHit>0 && /kind:'air', ref:e/.test(ft) && /bullets\[bullets\.length-1\]\.tgt=e/.test(ft) && /the tracer climbs to it/.test(ft), 'riflemen / MG fire tracers up at helicopters, AT men fire a guided rocket locked on it');
  ok(/function squadPosture\(now\)/.test(ft) && /FTSQ\.posture==='fallback'/.test(ft) && /FTSQ\.posture==='advance'/.test(ft) && /RÚT LUI/.test(ft) && /TIẾN LÊN!/.test(ft), 'the squad advances when it has the upper hand and falls back behind the tank when outgunned (with a call)');
  ok(/function fallbackSpot\(a, now\)/.test(ft) && /a\.healing=true/.test(ft) && /SQUAD\.ai\.heal\*dt/.test(ft) && /a\.fcov=coverSpot/.test(ft) && C.SQUAD.guardHit>=0.4, 'the wounded pull back to patch up; covering men fight from cover; tower guards are shot first'); }

// Z201 the roof MG as air defence + reserve gunners · Z201b a gunner who works the gun, a detailed, living gun
{ const fs=await import('node:fs'); const C=await import('./config.js'); const mg=fs.readFileSync('src/tank/roofmg.js','utf8');
  ok(C.ROOF_MG_AI && C.ROOF_MG_AI.air.rangeK>1 && /air:true/.test(mg) && /para:q/.test(mg) && /HẠ LÍNH DÙ/.test(mg) && /nothing softer: hose the armour/.test(mg), 'the roof gun shoots helicopters first, then paratroopers in the air, infantry, guards, and chips armour');
  ok(/PHÁO THỦ DỰ BỊ ĐANG LÊN THAY/.test(mg) && /MGR\.reserve--/.test(mg) && /spawnRider\(\)/.test(mg), 'a reserve crewman climbs out of the hull to man the gun when the roof is empty');
  ok(/climbs up out of the hatch/.test(mg) && /hands on the spade grips/.test(mg) && /a hot barrel smokes/.test(mg) && /racks the charging handle/.test(mg) && /beltG/.test(mg) && /hatch lid/.test(mg), 'the gunner leans in, grips, tracks, reloads, racks; the gun has sights, a moving belt, an open hatch lid, a smoking barrel'); }

// Z202 real vegetation: bark + grass in the atlas, several variants per species, bending tapered limbs, a bottle baobab, blade-card grass, gusts
{ const fs=await import('node:fs'); const fl=fs.readFileSync('src/world/flora.js','utf8'), dc=fs.readFileSync('src/world/decor.js','utf8');
  ok(/const AREG=4/.test(fl) && /bark: long wandering fissures/.test(fl) && /grass blades: thin, tapering/.test(fl), 'the leaf atlas carries bark and real grass blades');
  ok(/function vars\(k, n, f\)/.test(fl) && /instances spread across the species' variants/.test(fl) && /function limb\(pts, r0, r1/.test(fl) && /LatheGeometry\(pts, 14\)/.test(fl), 'several variants per species, tapered bending limbs, a lathe-turned bottle baobab');
  ok(/function grassCards\(/.test(fl) && /gusts roll across the field/.test(fl) && /lx:_R\(-lean,lean\)/.test(fl) && /drier here, lusher there/.test(fl), 'grass is crossed blade cards; gusts; every plant leans, stretches and tints a little differently, in patches');
  ok(/try\{ V=grass\(tone\)/.test(dc) && /catch\(err\)\{ V=\[tuftGeo/.test(dc), 'the boot-time backdrop never touches flora.js before it is loaded (no stuck loading screen)'); }

// Z203 debris: fractured shapes by material, a flash, a dust cloud, sparks, grit, dust trails and landing puffs — no more cubes
{ const fs=await import('node:fs'); const db=fs.readFileSync('src/fx/debris.js','utf8');
  ok(/export const DEBRIS_GEOS = \{ chunk:/.test(db) && /function plateGeo\(/.test(db) && /function splinterGeo\(/.test(db) && !/debrisGeo = new THREE\.BoxGeometry/.test(db), 'debris is fractured chunks, torn plates, splinters and slivers (no unit cubes)');
  ok(/function material\(col\)/.test(db) && /blastLight\(pos\.x, pos\.z/.test(db) && /grit/.test(db) && /a puff where it lands/.test(db) && /trails a little dust/.test(db), 'each break lights the ground, throws its own dust, sparks off metal; pieces trail dust and puff on landing');
  ok(/torn armour plate \(jagged outline\)/.test(db), 'tank wrecks shed jagged torn plates, not slabs'); }

// Z204 rounds go off against walls / cover / forts (breakable or not) and leave pocks or charred, cracked craters
{ const fs=await import('node:fs'); const wm=fs.readFileSync('src/fx/wallmarks.js','utf8'), lo=fs.readFileSync('src/combat/lock-on.js','utf8');
  ok(/export function surfaceHit\(bl, b\)/.test(wm) && /export function wallMark\(/.test(wm) && /radial cracks/.test(wm) && /InstancedMesh\(geo, mat, CAP\)/.test(wm), 'impact flash / fireball / chips / dust and a lasting mark, one instanced draw call');
  ok((lo.match(/surfaceHit\(/g)||[]).length>=3 && !/ringPulse\(b\.mesh\.position, 0xc89060, 0\.9\)/.test(lo), 'every block strike (fort wall line, unbreakable rock / wall, breakable cover) gets the impact + mark'); }

// Z205 the compound wire is a real barrier: rammed through only at speed, torn down by rounds and blasts
{ const fs=await import('node:fs'); const C=await import('./config.js'); const su=fs.readFileSync('src/world/supply.js','utf8');
  ok(C.FENCE && C.FENCE.ramV>=8 && /function fenceCollide\(B, p, now\)/.test(su) && /closing>=FENCE\.ramV/.test(su) && /LẤY ĐÀ HÚC MẠNH/.test(su), 'an upright bay stops the hull unless it rams at speed');
  ok(/export function fenceShot\(b\)/.test(su) && /export function fenceBlast\(x, z, r\)/.test(su) && /fenceShot\(b\)/.test(fs.readFileSync('src/combat/lock-on.js','utf8')) && /fenceBlast\(x, z, r\)/.test(fs.readFileSync('src/combat/spells.js','utf8')), 'rounds and blasts tear the wire down'); }

// Z206 street vehicles are real bodies: side silhouettes with wheel arches, cabin + glass, lathed tyres on alloys, lamps; paint + trim draws; crushable
{ const fs=await import('node:fs'); const ca=fs.readFileSync('src/world/cars.js','utf8');
  ok(['sedan','hatch','suv','pickup','van','taxi','truck'].every(n=>ca.includes(`name:'${n}'`)) && !/function carBody\(|function scooter\(|ExtrudeGeometry|LatheGeometry/.test(ca) && /drawReal\(R, list, m\.cr/.test(ca), 'seven car bodies, drawn only as their real models (Z401: the hand-built bodies are gone)');
  ok(/o\.wreck/.test(ca) && /export function crushVehicle\(c\)/.test(ca) && /crushVehicle\(c\)/.test(fs.readFileSync('src/world/decor.js','utf8')), 'glass gleams, rubber does not; wrecks; tanks pancake them'); }

// Z207 village homes are real Vietnamese houses (classic tiled 3-bay · thatched · two-storey) with yards; city facades get street life
{ const fs=await import('node:fs'); const ci=fs.readFileSync('src/world/city.js','utf8');
  ok(!fs.existsSync('src/world/houses.js') && !/villageHouse/.test(fs.readFileSync('src/world/landmarks.js','utf8')), 'Z401 the retired VILLAGE homes are gone');
  ok(/chuồng cọp/.test(ci) && /AC condenser/.test(ci), 'yards, kitchens, lacquered boards; AC units and window cages in town'); }

// Z208 wildlife has real anatomy (ellipsoid masses, jointed tapered legs + hooves, horns / antlers / tusks / trunk) and per-pixel coats
{ const fs=await import('node:fs'); const w=fs.readFileSync('src/actors/wildlife.js','utf8');
  ok(/function blob\(/.test(w) && /function chain\(/.test(w) && /function mergeVC\(/.test(w) && /trunk/.test(w) && !/const box=\(P,w,h,d/.test(w), 'animals are modelled from organic parts, not boxes');
  ok(/aPat/.test(w) && /PAT\.set\(zebraCoat,1\)/.test(w) && /PAT\.set\(giraffeCoat,2\)/.test(w) && /customProgramCacheKey=\(\)=>'wildCoat'/.test(w), 'zebra stripes and giraffe patches drawn per pixel'); }

// Z209 horizon ranges are lit 3D relief with random hero massifs (never the same twice), rock on steep faces, snow caps, haze by distance
{ const fs=await import('node:fs'); const h=fs.readFileSync('src/world/horizon.js','utf8');
  ok(/const heroes=\[\]/.test(h) && /Math\.random\(\)\*1000/.test(h) && /function ridged\(/.test(h) && /computeVertexNormals/.test(h) && /MeshLambertMaterial/.test(h), 'mountains are sculpted relief, seeded fresh each match, lit by the sun');
  ok(/snowLine/.test(h) && /banded cliff strata/.test(h) && /soft-capped/.test(h), 'rock, strata and snow by slope and height; summits soft-capped'); }

// Z210 every round leaves its own light smoke line by ammo type; near misses crack past; shells in the dirt throw up a geyser; big guns leave a hanging cloud
{ const fs=await import('node:fs'); const h=fs.readFileSync('src/fx/hitfx.js','utf8'), lo=fs.readFileSync('src/combat/lock-on.js','utf8');
  ok(/export function shellTrail\(b, x, y, z\)/.test(h) && /export function trailKind\(b\)/.test(h) && ['wisp','auto','shell','heavy','frag','frost','rail','enemy'].every(k=>new RegExp(k+':\\{ s:').test(h)) && /type==='ELEC'/.test(h) && /else shellTrail\(b, b\.x, _wy, b\.z\)/.test(lo), 'a smoke line per ammo type (tesla none), gap-free');
  ok(/export function nearMiss\(b, P\)/.test(h) && /nearMiss\(b, S\.player\)/.test(lo) && /case 'flybyHeavy'/.test(fs.readFileSync('src/audio/synth.js','utf8')) && /dirtGeyser\(b\.x, b\.z/.test(lo) && /muzzleLinger\(/.test(fs.readFileSync('src/fx/gunfx.js','utf8')), 'near-miss crack, dirt geysers, lingering muzzle cloud'); }
// Z211 parked vehicles are cheap to draw (Z401: the real models, one instanced draw per body)
{ const fs=await import('node:fs'); const ca=fs.readFileSync('src/world/cars.js','utf8');
  ok(/new THREE\.InstancedMesh\(_RG\[k\], R\.mat, list\.length\), shadow=!MOBILE/.test(ca), 'street vehicles are cheap to draw (one instanced draw per body, no shadow on phones)'); }

// Z214 the lock-on gun fires smart mini-missiles: own model, eject → ignite → streak, hard homing, climbs to aircraft and bursts in the air; a 2×2 smart pod
{ const fs=await import('node:fs'); const lo=fs.readFileSync('src/combat/lock-on.js','utf8'), ba=fs.readFileSync('src/tank/barrels.js','utf8');
  ok(/function smartMissile\(\)/.test(lo) && /function smartIgnite\(b\)/.test(lo) && /function airDetonate\(b, t\)/.test(lo) && /smart:!!o\.smart, ign:o\.smart\?0\.13:0, vmax:sp\*1\.45/.test(lo) && /smart:!!g\.lock/.test(fs.readFileSync('src/combat/flame.js','utf8')), 'smart missile: model, ignition, airburst on aircraft');
  ok(/SMART-MISSILE POD/.test(ba) && /missile:\[\[-0\.24,Y\+0\.41,3\.08\]/.test(ba) && /case 'whoosh'/.test(fs.readFileSync('src/audio/synth.js','utf8')) && /function smartExhaust\(/.test(fs.readFileSync('src/fx/hitfx.js','utf8')), 'a 2×2 smart pod, whoosh, thin clean exhaust'); }

// Z215 lock rings lie on the surface they mark: on the slope under a ground target, upright facing you round an aircraft; the artillery ring follows the slope
{ const fs=await import('node:fs'); const lo=fs.readFileSync('src/combat/lock-on.js','utf8');
  ok(/function seatLock\(L\)/.test(lo) && /export function groundNormal\(x, z, out\)/.test(lo) && /camera\.position\)\.sub\(L\.grp\.position\)/.test(lo) && /groundNormal\(x, z, new THREE\.Vector3\(\)\)/.test(fs.readFileSync('src/campaign/artillery.js','utf8')), 'lock rings sit on the surface they mark'); }

// Z216 the city is rebuilt and BREAKS: boulevards + streets, villas / tube houses / apartments / towers / parks / squares / a pitch; floors are
//   pieces (vertex-shader cull, shadows too) that come down from the top under fire, leaving scars, rubble and a ruin; poles / lamps / lights topple
{ const fs=await import('node:fs'); const c=fs.readFileSync('src/world/city.js','utf8');
  ok(/const isBlvd=/.test(c) && /function villaLot\(/.test(c) && /function fountain\(/.test(c) && /function stall\(/.test(c) && /pitchT/.test(c) && /function busStop\(/.test(c), 'boulevards, villas in walled gardens, parks, market stalls, a pitch, bus stops');
  ok(/function pieceHook\(mat\)/.test(c) && /texelFetch\(uPieces/.test(c) && /customDepthMaterial=depthMat\(\)/.test(c) && /export function buildingHit\(b, dmg\)/.test(c) && /function brokenEdge\(/.test(c) && /function addRubble\(/.test(c), 'floors are pieces that fall from the top, scars + rubble + ruin');
  ok(/kind==='building'\)\{ buildingHit\(b, dmg\)/.test(fs.readFileSync('src/world/cover.js','utf8')) && /cityBlast\(x, z, r\)/.test(fs.readFileSync('src/combat/spells.js','utf8')) && /kind==='topple'/.test(fs.readFileSync('src/world/decor.js','utf8')) && /cityCollapse\(S\.player\)/.test(fs.readFileSync('src/world/env-events.js','utf8')) && /updateCity\(gdt\)/.test(fs.readFileSync('src/game/loop.js','utf8')), 'shells / blasts / rams / the collapse event all reach the city'); }

// Z217 smart missiles hunt heat only — aircraft › armour › tower guards › foot soldiers — and fly over bricks, stone, cover and walls
{ const fs=await import('node:fs'); const lo=fs.readFileSync('src/combat/lock-on.js','utf8');
  ok(/function guardTarget\(t, gd\)/.test(lo) && /if\(b\.smart\)\{ for\(const e of enemies\)/.test(lo) && /for\(const t of towers\)/.test(lo) && /\(b\.lockOn && \(b\.smart \|\| b\.by>2\.6\)\)/.test(lo) && /\(\(!airborne \|\| low\) && !b\.smart\)/.test(lo), 'smart missiles: heat targets incl. tower guards, never cover'); }

// Z218 the enemy artillery rocket is a real field rocket: burns then coasts, a continuous lingering smoke trail, a real launch and impact
{ const fs=await import('node:fs'); const sr=fs.readFileSync('src/combat/siege-rocket.js','utf8'), ar=fs.readFileSync('src/campaign/artillery.js','utf8');
  ok(/function artRocketTemplate\(\)/.test(sr) && /LatheGeometry\(prof,16\)/.test(sr) && /g\._inner=inner/.test(sr), 'a 122 mm field rocket model with a short white-hot flame');
  ok(/const burn=s\.age<C\.flightTime\*0\.55/.test(ar) && /s\.lx==null/.test(ar) && /shockwave dust ring/.test(ar) && /dirtGeyser\(tx, tz/.test(ar) && /the black smoke column/.test(ar) && !/ringPulse\(\{x:tx,z:tz\}/.test(ar), 'burn → coast, gap-free trail, flash / fireball / geyser / dust ring / smoke column — no neon rings'); }

// Z219 a tower-guard missile target is tagged _twr — depot / stockade soldiers carry their own e.guard, and mistaking them for one threw every frame (the game froze)
{ const fs=await import('node:fs'); const lo=fs.readFileSync('src/combat/lock-on.js','utf8');
  ok(/\{ _twr:true, t, gd,/.test(lo) && /if\(t && t\._twr\) return t\.gd\.alive/.test(lo) && !/t\.guard\b/.test(lo), 'smart missile: tower-guard targets use their own tag, never an enemy\'s guard field'); }

// Z220 FIELDCRAFT (both sides): line of fire + peek, frag grenades + dodge, smoke screens; escort formation; squad panel; squads on the radar
{ const fs=await import('node:fs'); const fc=fs.readFileSync('src/ai/fieldcraft.js','utf8'), inf=fs.readFileSync('src/actors/infantry.js','utf8'), ft=fs.readFileSync('src/actors/fireteam.js','utf8'), sq=fs.readFileSync('src/ai/squads.js','utf8'), hud=fs.readFileSync('src/ui/squad-hud.js','utf8'), rd=fs.readFileSync('src/ui/radar.js','utf8'), html=fs.readFileSync('index.html','utf8');
  ok(/export function losBlocked\(/.test(fc) && /export function peekSpot\(/.test(fc) && /losBlocked\(e\.pos\.x, e\.pos\.z, T\.pos\.x, T\.pos\.z\)\)\{ e\.fireAt=now\+0\.6; wantPeek/.test(inf) && /losBlocked\(a\.pos\.x, a\.pos\.z, T\.pos\.x, T\.pos\.z\)\)\{ wantPeek\(a/.test(ft), 'no rounds into walls: a blocked line means edging out to a clear one (both sides)');
  ok(/export function throwNade\(side/.test(fc) && /function enemyNade\(e, now\)/.test(inf) && /function allyNade\(a, now\)/.test(ft) && /nadeFlee\(e\.pos, _fl\)/.test(inf) && /nadeFlee\(a\.pos, _fl\)/.test(ft) && /blastAllies\(x, z, N\.R/.test(fc), 'frag grenades into cover / knots of men, and everyone runs from a live one');
  ok(/export function throwSmoke\(/.test(fc) && /throwSmoke\(sx, sz, 'e', now\)/.test(sq) && /throwSmoke\(sx, sz, 'p', now\)/.test(ft) && /smokeSpreadK\(e\.pos\.x/.test(inf) && /smokeSpreadK\(a\.pos\.x/.test(ft), 'smoke screens to fall back / cross open ground; fire through smoke goes wild');
  ok(/function formationSlot\(a\)/.test(ft) && /a\.goalKind==='form' && a\.ringOut!=null/.test(ft) && /FIELDCRAFT\.target\.coverMul/.test(inf), 'escort files on the move, all-round ring at a halt; the enemy shoots the man in the open first');
  ok(/id="sqHud"/.test(html) && /export function updateSquadHud\(now\)/.test(hud) && /for\(const sq of SQUADS\)/.test(rd) && /for\(const sm of SMOKES\)/.test(rd), 'squad panel (order, posture, one tile per man) + enemy squad arrows and smoke on the radar'); }

// Z221 lock-on missiles: forward seeker cone, never a mark danger-close to our tank or our men; enemy artillery hits say so
{ const fs=await import('node:fs'); const lk=fs.readFileSync('src/combat/lock-on.js','utf8'), ar=fs.readFileSync('src/campaign/artillery.js','utf8'), cf=fs.readFileSync('config.js','utf8');
  ok(/export const LOCKON = \{ cone:/.test(cf) && /function seekOK\(b, x, z, inf\)/.test(lk) && /LOCKON\.cone/.test(lk) && /LOCKON\.minP/.test(lk) && /LOCKON\.allyR/.test(lk), 'the seeker looks ahead only and skips marks next to our tank / our men');
  ok(/\|\| dangerClose\(b\.tgt\)\) b\.tgt =/.test(lk) && /PHÁO ĐỊCH TRÚNG!/.test(ar), 'a mark that closes on us is dropped; enemy artillery hits are labelled'); }

// Z222 helicopter fleet (bomber run, rope-ladder troop drop, weaving gunship), allies fire up at helicopters, brighter roof-MG tracers
{ const fs=await import('node:fs'); const hl=fs.readFileSync('src/actors/helis.js','utf8'), en=fs.readFileSync('src/actors/enemies.js','utf8'), vh=fs.readFileSync('src/actors/vehicles.js','utf8'), ft=fs.readFileSync('src/actors/fireteam.js','utf8'), so=fs.readFileSync('src/actors/soldiers.js','utf8'), mg=fs.readFileSync('src/tank/roofmg.js','utf8'), cf=fs.readFileSync('config.js','utf8'), E=await import('./src/data/enemies.js');
  ok(E.ENEMY_DEFS.heliBomb && E.ENEMY_DEFS.heliBomb.air && E.ENEMY_DEFS.heliTroop && E.ENEMY_DEFS.heliTroop.air && E.ENEMY_CLASS.heliBomb && E.ENEMY_CLASS.heliTroop && /heliBomb:'A', heliTroop:'A'/.test(cf), 'two new airframes: bomber helicopter + troop transport (aircraft armour)');
  ok(/export function buildHind\(/.test(hl) && /export function buildHip\(/.test(hl) && /_d\.bombHeli \? buildHind\(\) : _d\.troopHeli \? buildHip\(\)/.test(en) && /if\(type==='gunship'\) type=heliRoll\(\)/.test(en), 'each has its own model; an air-support call rolls one of the three');
  ok(/function bombRun\(/.test(hl) && /dropBomb\(e\)/.test(hl) && /enemyGroundStrike\(b\.x, b\.z, B\.R/.test(hl) && /function troopRun\(/.test(hl) && /h\.st='hover'/.test(hl) && /buildLadder\(/.test(hl) && /startClimber\(e,/.test(hl) && /c\.st='fall'/.test(hl), 'bomb runs; the transport stops, lowers a ladder, men climb down (and fall if it is shot down)');
  ok(/HELI\.jink/.test(vh) && /u\.aimEl=/.test(ft) && /T\.kind==='air'\) st='stand'/.test(ft) && /u\.armAdd-=u\.elS/.test(so), 'the gunship weaves; our men stand, raise their rifles and track a helicopter');
  ok(/MGR\.shots\+\+%2/.test(mg) && /trailK:tr\?2\.6:1\.7/.test(mg) && /muzzleLight\.intensity=2\.4/.test(mg), 'roof MG: a tracer every other round, fat bright trails, a muzzle flash that lights the hull'); }

// Z223 real war: blast concussion, side-coloured tracers + brass, varied deaths, men of different build, battlefield surprises, a harder Core
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const rw=R('src/fx/realwar.js'), sp=R('src/combat/spells.js'), inf=R('src/actors/infantry.js'), ft=R('src/actors/fireteam.js'), so=R('src/actors/soldiers.js'), su=R('src/campaign/surprises.js'), co=R('src/actors/core.js'), lp=R('src/game/loop.js'), C=R('config.js');
  ok(/export const REAL = \{/.test(C) && /export function concuss\(/.test(rw) && /concuss\(e, x, z,/.test(sp) && /concuss\(a, x, z, now\)/.test(ft) && /if\(dazed\(e, now\)\)/.test(inf) && /dazePose\(a\.g, now, dt\)/.test(ft), 'a blast throws its survivors flat and dazed (both sides)');
  ok(/REAL\.tracer\.enemy/.test(inf) && /REAL\.tracer\.ally/.test(ft) && /rifleFX\(/.test(inf) && /rifleFX\(/.test(ft) && /b\.owner==='e' && b\.tk<=1/.test(R('src/combat/lock-on.js')) && /dustSkirt\(pos\.x, pos\.z, scale\)/.test(R('src/fx/explosions.js')), 'green enemy / red-orange allied tracers, brass + muzzle smoke, dust skirt on big blasts');
  ok(/g\.userData\.tint=/.test(so) && /u\.tint\|\|_tbWhite/.test(so), 'each man has his own height, build and kit shade (Z402: the dead no longer fall forward / spin / crawl — every one is thrown and bursts)');
  ok(['mortar','ambush','armour','vbied','heli','friendly'].every(k=>new RegExp('function '+k+'\\(').test(su)) && /updateSurprises\(gdt, now\)/.test(lp) && /\(C\.w\[k\]\?\?1\)>0/.test(su), 'six weighted, stage-gated battlefield surprises on a timer');
  ok(/export const CORE_DEF/.test(C) && /dmg\*=CORE_DEF\.armour/.test(co) && /coreShield\(now\)/.test(co) && /if\(c\.hp<=0\) c\.hp=1/.test(co) && /CORE_DEF\.regen\*dt/.test(co), 'the Core: thicker, armoured, self-mending, emergency shield that turns a killing blow once'); }

// Z224 drilled movement (crouch-run, dive at the end of a bound, wedge approach) + cinematic weather (film grade per sky, splashes, visible bolts, gusts, drifting sheets)
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const so=R('src/actors/soldiers.js'), inf=R('src/actors/infantry.js'), ft=R('src/actors/fireteam.js'), wx=R('src/fx/weather.js'), C=R('config.js');
  ok(/low:\{ rx:0\.12/.test(so) && /\? \(low \? 'low' : 'stand'\)/.test(inf) && /\? 'low' : 'stand';/.test(ft) && /combatDive\(e\.mesh/.test(inf) && /combatDive\(a\.g/.test(ft), 'men run bent low under fire and drop flat at the end of a bound');
  ok(/WEDGE/.test(ft) && /row\*3\.2/.test(ft), 'our squad closes on the enemy in a wedge');
  ok(/export const WXFX/.test(C) && /WXFX\.grade\[WX\.id\]/.test(wx) && /function skyBolt\(/.test(wx) && /function airLife\(/.test(wx) && /WX\.gustE/.test(wx), 'each weather its own grade (never stacked), visible lightning + thunder, gusts, splashes, drifting sand/fog/snow'); }

// Z225 underground: the CAVERN battlefield (walls, torches, shafts of daylight, pillars, roof falls) + the enemy tunnel network on every battlefield
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const tn=R('src/world/tunnels.js'), hf=R('src/world/heightfield.js'), at=R('src/world/atmosphere.js'), bi=R('src/world/biome.js'), sp=R('src/combat/spells.js'), cov=R('src/world/cover.js'), C=R('config.js'), W=await import('./src/data/world.js');
  ok(!W.BIOMES.find(b=>b.name==='CAVERN') && W.ATMOS.CAVERN && W.ATMOS.CAVERN.cave, 'the CAVERN battlefield is retired (Z253) — its tables and code stay for the tunnels');
  ok(!fs.existsSync('src/world/cavern.js') && !/CAVE_DEF|caveN/.test(C) && !/caveNotch|CAVE_DEF/.test(hf) && !/planCavern/.test(bi) && !/function mouth\(|CAVE\b/.test(tn), 'Z401 the cavern builder (walls, torches, shafts, mine mouths) is gone; the tunnels stand on their own');
  ok(/if\(A\.cave\)\{ o\.night=1; return o; \}/.test(at) && /SKY\.visible=!A\.cave/.test(at) && /BIOME\.cave \? 'night'/.test(bi) && /BIOME\.cave \? 'clear'/.test(bi), 'underground: no sky, no weather, always dark');
  ok(/function goUnder\(/.test(tn) && /function comeUp\(/.test(tn) && /export function tunnelSquad\(/.test(tn) && /tunnelBlast\(x, z, r, dmg\)/.test(sp) && /b\.kind==='tunnel'\)\{ hitTunnel/.test(cov) && /damageEnemy\(e, e\.hp\+999\)/.test(tn), 'enemies drop into the tunnels and come up elsewhere; blasts cave the ways in; sealing all buries those below'); }

// Z226 the underground base: the guarded main tunnel gate with an electronic lock → drive down → wreck barracks / vehicle lifts / arsenal / generator → fewer reinforcements up top
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const ub=R('src/world/underbase.js'), fd=R('src/world/field.js'), wv=R('src/campaign/waves.js'), cov=R('src/world/cover.js'), lk=R('src/combat/lock-on.js'), tn=R('src/world/tunnels.js'), C=R('config.js');
  ok(/export const UNDERBASE/.test(C) && /function buildGate\(/.test(ub) && /kind:'ugatelock'/.test(ub) && /function openGate\(/.test(ub) && /function turret\(/.test(ub) && /e\.guardBase=fake/.test(ub), 'every battlefield has a main tunnel gate: electronic lock, MG pillboxes, posted guards, guard tanks');
  ok(/export const UNDER = \{/.test(fd) && /if\(underActive\(p\.x\)\) return underClamp\(p, m\)/.test(fd) && /if\(underActive\(x\)\) return underInside/.test(fd) && /UNDER\.on \? 1e4 : ARENA-1/.test(lk), 'below ground the field functions and the bullets follow the base\'s own walls');
  ok(/function stashSurface\(/.test(ub) && /function restoreSurface\(/.test(ub) && /function moveAllies\(/.test(ub) && /goUp\(true\)/.test(ub) && /if\(UNDER\.on\) return;/.test(wv), 'going down freezes the surface (enemies + blocks stashed), our squad and tanks come along, death below brings you back up');
  ok(/role==='inf'/.test(ub) && /U\.cut\.inf=Math\.min/.test(ub) && /function powerDown\(/.test(ub) && /if\(underCut\(t\)\)/.test(wv) && /UNDER\.targets\.some\(o=>o\.role==='inf' && o\.alive\)/.test(tn) && /if\(b\.ub\)\{ underHit\(b, dmg\)/.test(cov), 'wrecked barracks / lifts / arsenal cut the waves and the tunnel squads; the generator kills the lights and the base guns'); }

// Z227 our citadel (taller, grander, five land styles with one shared look, MG towers, honour guard), the Core's marble podium + colonnade, a well-lit underground base
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const cw=R('src/world/core-walls.js'), co=R('src/actors/core.js'), ub=R('src/world/underbase.js');
  ok(/const OUR_STYLE = \{/.test(cw) && ['hue','dome','spire','steel','basalt'].every(k=>new RegExp('\\b'+k+':\\s*\\{').test(cw)) && /export function ourStyle\(/.test(cw) && /wallMat\(ST\)/.test(cw) && /function emblemTex\(/.test(cw), 'our citadel: five styles by land, one shared look (pale stone, gold, lime ID, our emblem)');
  ok(/R:24, H:9\.4, T:2\.8/.test(cw) && /function makeMG\(/.test(cw) && /function updateCoreMG\(/.test(cw) && /CORE_DEF\.mgs\.push/.test(cw) && /makeSoldierMesh\(\{ enemy:false \}\)/.test(cw), 'bigger, taller walls; automatic MG towers beside the cannon towers; an honour guard at the Core');
  ok(/function podium\(/.test(co) && /core = \{ mesh:G0,/.test(co) && /TorusGeometry\(4\.6,0\.26/.test(co), 'the Core stands on a three-tier marble podium under a colonnade and a gilt dome');
  ok(/U\.poolM=new THREE\.MeshBasicMaterial/.test(ub) && /floodlight poles/.test(ub) && /scene\.fog\.density=0\.0055/.test(ub), 'the underground base is clearly lit: floor pools, floodlight poles, lit wall strips'); }

// Z228 real military HUD (plates, stencil, fire-control digits, radio set, tactical map grid, commander's instrument panel) + the war kit on our tank
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const html=R('index.html'), mc=R('css/mil.css'), ins=R('src/ui/instruments.js'), wk=R('src/tank/warkit.js'), md=R('src/tank/model.js'), rm=R('src/tank/roofmg.js');
  ok(/<link rel="stylesheet" href="css\/ui181\.css" \/>\n<link rel="stylesheet" href="css\/mil\.css" \/>/.test(html) && /Saira\+Stencil\+One/.test(html) && /Share\+Tech\+Mono/.test(html), 'the military HUD sheet loads last, with the stencil + fire-control fonts');
  ok(/--m-screws:/.test(mc) && /#combo\.warn\{/.test(mc) && /#instr\{/.test(mc) && /body\.touch #instr\{display:none;\}/.test(mc), 'plates with screw heads, hazard-striped warnings, the instrument panel (desktop only)');
  ok(/export function updateInstr\(/.test(ins) && /export function headingDeg\(/.test(ins) && /function laze\(/.test(ins) && /export function radioType\(/.test(ins) && /updateInstr\(now\)/.test(R('src/game/loop.js')) && /radioType\(el, msg\)/.test(R('src/campaign/operations.js')), 'heading / speed / rangefinder / armour gauges and the teleprinter radio are wired in');
  { const hd=f=>((Math.atan2(Math.sin(f), -Math.cos(f))*180/Math.PI)+360)%360; ok(Math.round(hd(Math.PI))===0 && Math.round(hd(Math.PI/2))===90 && Math.round(hd(0))===180, 'heading: −z is north, clockwise'); }
  ok(/rd-fq/.test(html) && /'ABCDEFGH'/.test(R('src/ui/radar.js')), 'radio set shows its net + frequency; the map carries a lettered grid');
  ok(/export function warKit\(/.test(wk) && /mine plough/.test(wk) && /slat-armour cage/.test(wk) && /noRoof=true/.test(wk) && /if\(KIT\) warKit\(out,/.test(md) && /if\(KIT\) warKit\(g,/.test(md) && /a\.userData\.noRoof/.test(rm), 'our tank carries the war kit on every model; the roof MG ignores it'); }

// Z228b ballistics: every round on a real velocity curve that still arrives where (and when) it was aimed; sabot, vapour wake, swept hits, boosted enemy rockets
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const bl=R('src/combat/ballistics.js'), lo=R('src/combat/lock-on.js'), em=R('src/actors/enemy-missiles.js'), cf=R('config.js');
  ok(/export const BALLISTIC = \{ gun:\{ v0:1\.5, decay:3 \}, rocket:\{ v0:0\.3, k:6, cap:1\.6 \}/.test(cf), 'ballistics tuning lives in config (gun: 1.5× out of the muzzle; rocket: 0.3× booster kick)');
  { const sp=76, T=60/76, v0=sp*1.5, k=3/T, q=(1-Math.exp(-3))/3, vE=sp*(1-1.5*q)/(1-q); let x=0; for(let t=0;t<T;t+=1/2000) x+=(vE+(v0-vE)*Math.exp(-k*t))/2000;
    ok(Math.abs(x-60)<0.3 && vE<sp && v0>sp, 'a gun round starts fast, ends slow, and still covers the aimed 60 m in the aimed time'); }
  { const sp=30, T=1, kk=6, v0=sp*0.3, g=(1-Math.exp(-kk*T))/kk, vM=(sp*T-v0*g)/(T-g); let x=0; for(let t=0;t<T;t+=1/2000) x+=(vM-(vM-v0)*Math.exp(-kk*t))/2000;
    ok(Math.abs(x-30)<0.2 && vM>sp, 'a rocket leaves slow, the motor pushes it past the gun speed, same arrival'); }
  ok(/export function ballisticInit\(/.test(bl) && /export function sabotDiscard\(/.test(bl) && /export function vaporWake\(/.test(bl) && /export function sweepPoint\(/.test(bl) && /export function missileBoost\(/.test(bl), 'curves + sabot petals + shock-vapour wake + swept hits + enemy missile boost');
  ok(/ballisticInit\(B0, o, sp\)/.test(lo) && /ballisticStep\(b, dt\)/.test(lo) && /hitsHull\(e, _sw\.x, _sw\.z, b\.r\)/.test(lo) && /MODE\.hitTest\(p, _sw\.x, _sw\.z, b\.r\)/.test(lo) && /missileBoost\(r, dt\)/.test(em), 'wired into every round, its hit tests and the enemy rockets'); }

// Z229 → Z421 the dust / snow / leaf devils and the avalanches are gone (they read as fake): no module, no tuning, no land event calls them
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const ev=R('src/world/env-events.js'), cf=R('config.js'), hub=R('src/hub.js');
  ok(!fs.existsSync('src/world/whirlwinds.js') && !/whirlwinds\.js/.test(hub) && !/export const (WHIRL|AVALANCHE) =/.test(cf) && !/updateWhirls|clearWhirls|startAvalanche|WHIRLS/.test(ev), 'no dust devils, no avalanches'); }

// Z230 one gun model (combat/gunstats.js) for the arsenal, the shop and the power rating — real mechanics at the fighting distance
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const gs=R('src/combat/gunstats.js'), si=R('src/ui/shop-info.js'), sh=R('src/ui/shop.js'), cf=R('config.js'), G=(await import('./src/data/guns.js')).GUNS;
  ok(/export const GUNSTAT = \{ engage:\{ frac:0\.65, max:22 \}/.test(cf), 'gun-model yardsticks (fighting distance, target width, battle-line density) live in config');
  ok(/export function gunStats\(id, K\)/.test(gs) && ['flame','mortar','orbital','plasma','hydra','singularity','photon','rocket'].every(k=>gs.includes("S==='"+k+"'")), 'every special mechanic is modelled (flame, shells, the five ultimates, the siege rocket)');
  ok(/sus = flame \? shot\*duty : shot\*mag\/cycle/.test(gs) && /hits=Math\.min\(C\.hitsCap, hits\)/.test(gs) && /typed:!!g\.small, air:false/.test(gs), 'sustained DPS over the mag + reload cycle; targets per pull capped; shells ignore armour type and never reach aircraft');
  ok(/export function gunNums\(id\)\{ const s=gunStats\(id\)/.test(si) && /st \? st\.vs\[k\]/.test(si) && /spBar\('Mục tiêu \/ phát'/.test(sh) && /Hạ xe tăng nặng/.test(sh) && /Math\.round\(me\.rng\)\+' m'/.test(sh), 'the arsenal shows the model: sustained + burst DPS, reach in metres, targets per pull, muzzle velocity, time to kill a heavy tank');
  ok(G.shotgun.dmg===14 && G.flak.dmg===12, 'shotgun + flak pellets rebalanced back onto their tier (half their pellets miss at their fighting distance)'); }

// Z231 the starter 30 mm autocannon looks and fires like a weapon: armoured cradle, dual-feed boxes, cooling jacket, 3-port brake; amber tracer, brake jets, HE-I pop
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const br=R('src/tank/barrels.js'), G=(await import('./src/data/guns.js')).GUNS;
  ok(/RIFLE \(default\) — Z231/.test(br) && /dual-feed ammo boxes/.test(br) && /cooling holes/.test(br) && /three-port muzzle brake/.test(br) && /return id==='rifle'\?1:0/.test(br), 'the 30 mm is a real autocannon mount, worn at grade 1');
  ok(G.rifle.flash==='auto30' && G.rifle.fx==='he30' && G.rifle.color===0xffa646 && /kind==='auto30'/.test(R('src/fx/gunfx.js')) && /fx==='he30'/.test(R('src/fx/explosions.js')), 'amber tracer, brake side-jets, HE-I impact pop'); }

// Z232 HE-I 30 mm + HE ammo bursts; the swept-hit start point must not share fields with the smoke-trail code (it did → rounds stopped hitting)
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const lo=R('src/combat/lock-on.js'), hf=R('src/fx/hitfx.js'), sp=R('src/combat/spells.js'), G=(await import('./src/data/guns.js')).GUNS;
  const own=f=>new Set([...f.matchAll(/\bb\.(_[a-z]{2})\s*=/g)].map(m=>m[1]));
  const sweepVars=[...lo.matchAll(/sweepPoint\(b\.(_[a-z]+), b\.(_[a-z]+),/g)].flatMap(m=>[m[1],m[2]]), trail=own(hf);
  ok(sweepVars.length>=4 && sweepVars.every(v=>!trail.has(v)), 'swept hits read their own path start (_hx/_hz), never the smoke trail’s _sx/_sz');
  ok(G.rifle.aoe===1.3 && G.rifle.splash===0.45 && G.rifle.dmg===10 && /function smallBurst\(b\)/.test(sp) && /if\(b\.aoe<2\)\{ smallBurst\(b\); return; \}/.test(sp), 'the 30 mm fires HE-I: a 1.3 m burst on every strike (struck target ≈14, neighbours a share), a small pop instead of a shell blast');
  ok(/export const HE_AMMO = \{ R:1\.4, share:0\.35 \}/.test(lo) && /aoe:heAoe\(o\)/.test(lo), 'HE ammo makes every direct-fire gun burst on impact'); }

// Z233 phones: the turret tracks the enemy itself · render budget: sandbag walls 27k → ~10k tris, far enemy tanks drop fittings, the Core podium + citadel baked
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const aim=R('src/combat/aim.js'), up=R('src/game/update.js'), cf=R('config.js'), lod=R('src/render/lod.js');
  ok(/mobileFixed: false, mobileTrack: true/.test(cf) && /export function turretTracks\(\)/.test(aim) && /export function trackTarget\(maxR\)/.test(aim) && /export function trackOnTarget\(t\)/.test(aim) && /trackSticky/.test(aim), 'phones: the turret picks, keeps and lays itself on the enemy');
  ok(/else if\(turretTracks\(\)\)\{ const t=trackTarget\(playerRange\(\)\)/.test(up) && /turretTracks\(\) \|\| trackOnTarget\(t\)/.test(up), 'the hull drives free; auto-fire waits until the barrel is on target');
  ok(/RoundedBoxGeometry\(0\.96,0\.34,0\.48,1,0\.14\)/.test(R('src/world/props.js')), 'sandbag walls built with one bevel segment (27k → ~10k triangles each)');
  ok(/export function tankDetail\(m, on\)/.test(lod) && /tankDetailR: 38, smallR: 0\.9/.test(cf) && /bakeGroup\(G0\); (return G0; )?\}/.test(R('src/actors/core.js')) && /bakeGroup\(g\);   \/\/ Z233/.test(R('src/world/core-walls.js')) && /c\.isInstancedMesh \|\| c\.isSkinnedMesh/.test(R('src/tank/model.js')), 'far tanks drop their fittings; the podium and citadel are baked; baking never folds instanced fields or flags'); }

// Z234 home ground: every enemy installation stands clear of our citadel (forts, camps, compounds, underground gate, bunkers, towers, depots)
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const cf=R('config.js'), fd=R('src/world/field.js'), ft=R('src/world/fortress.js'), sp=R('src/world/supply.js'), cp=R('src/world/camps.js');
  const wall=+/HOME_GAP = \{ wall:(\d+)/.exec(cf)[1], citR=+/CORE_DEF = \{ R:(\d+)/.exec(R('src/world/core-walls.js'))[1];
  ok(wall===citR, 'HOME_GAP.wall matches our citadel radius ('+wall+' vs '+citR+')');
  const gap=+/HOME_GAP = \{[^}]*\bgap:(\d+)/.exec(cf)[1], minK=+/minK:([\d.]+)/.exec(cf)[1];
  ok(gap*minK > 54-citR, 'even relaxed, the gap is wider than our guard cannons reach past the wall ('+(gap*minK).toFixed(1)+' m > '+(54-citR)+' m)');
  ok(/export function homeGap\(x, z, R\)/.test(fd) && /export function homeClear\(x, z, R, small, k\)/.test(fd), 'homeGap / homeClear live in world/field.js');
  ok(/!homeClear\(x, z, R, false, hk\)/.test(ft) && !/Math\.hypot\(x,z\)<R\+18/.test(ft) && /dMin=HOME_GAP\.wall\+R\+/.test(ft), 'forts are placed past our home ground (the old 18 m rule is gone)');
  ok((sp.match(/!homeClear\(x,z,R0/g)||[]).length===1 && /export function scanSite/.test(sp) && !/o\.core\?\?48/.test(sp), 'supply compounds and camps test the full site radius against our home ground');
  ok(/homeClear\(x,z,16\)/.test(R('src/world/underbase.js')) && /!homeClear\(x,z,need,true\)/.test(R('src/world/tunnels.js')) && /homeClear\(x,z,4,true\)/.test(R('src/world/towers.js')) && /DEPOT\.r, true\)/.test(R('src/world/zones.js')), 'the underground gate, bunkers, watchtowers and depots keep off it too');
  ok(/function campOverDepot\(tx, tz\)/.test(cp) && /countMobile:\[2,2,3,3,3\]/.test(cf) && /mobileR:0\.8, minR:26/.test(cf), 'the small phone field: smaller, fewer forts; one camp may take a depot\'s ground'); }

// Z235 the battlefield's look: a real sky (blue deepening above a pale horizon, sun disc + glow, moon in phase, twinkling stars, Milky Way), lit
//   distant ranges, natural grass, living flames, swallows / raptors / high aircraft with contrails, grander guns with a harder kick, no heading chevron
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const at=R('src/world/atmosphere.js'), hz=R('src/world/horizon.js'), cf=R('config.js'), sl=R('src/world/skylife.js'), fl=R('src/fx/flames.js');
  ok(/float k=1\.0-exp\(-yy\*/.test(at) && /moonPh/.test(at) && /starL\(d,260\.0/.test(at) && /the Milky Way/.test(at) && /uniform float night,cFlash,time,moonPh/.test(at), 'the sky: optical-depth blue, moon phase, layered twinkling stars, the Milky Way');
  ok(/idx\.push\(k,k2,k\+1, k\+1,k2,k2\+1\)/.test(hz), 'the distant ranges are wound with their normals up (lit from the sky, not from underground)');
  ok(/MEADOW: \{ c:\[\[52,80,42\]/.test(R("src/data/world.js")), "Z244 meadow grass is a true leaf green, not a glaring lime or chartreuse");
  ok(/export function flameFX\(h, w\)/.test(fl) && /updateFlames\(dt\)/.test(R('src/game/loop.js')) && /flameFX\(/.test(R('src/world/camps.js')) && /flameFX\(/.test(R('src/actors/core.js')) && /flameFX\(/.test(R('src/world/fortress.js')), 'camp fires, braziers and fort torches are living flames');
  ok(/export function updateSkyLife\(dt, now\)/.test(sl) && /export function scareBirds\(x, z\)/.test(sl) && /scareBirds\(pos\.x, pos\.z\)/.test(R('src/fx/explosions.js')), 'swallows, raptors and high aircraft; birds scatter from blasts');
  ok(/BARREL_SCALE = \{ r:1\.22, len:1\.12, slide:1\.25 \}/.test(cf) && /userData\.z0 \?\? -TRUNNION_Z/.test(R('src/tank/rig.js')), 'guns are thicker and longer and still pivot on the trunnion; the recoil slide is longer');
  ok(/HEADING = \{ show: false/.test(cf) && /if\(HEADING\.show\)\{/.test(R('src/tank/shield.js')), 'the heading chevron and nose stripe are gone'); }

// Z236 a real tank and crew: tank-gun rounds lay one unbroken smoke ribbon (wind, rise, curl, fade); crew with faces and rounded limbs;
//   the hull's lamps are dark glass in steel housings, plain hessian sandbags, braided tow cables, smoked-glass laser-warning domes
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const st=R('src/fx/smoketrail.js'), hf=R('src/fx/hitfx.js'), cf=R('config.js'), so=R('src/actors/soldiers.js'), wk=R('src/tank/warkit.js');
  ok(/export const SMOKE_TRAIL = \{ points:64/.test(cf) && /export function smokeRibbon\(b, kind, x, y, z\)/.test(st) && /updateSmokeTrails\(dt\)/.test(R('src/game/loop.js')), 'smoke ribbons: config, the ribbon layer and its clock in the loop');
  ok(/smokeKind\(k\) && b\._rb!==null && smokeRibbon\(b, k, x, y, z\)\) return;/.test(hf), 'a tank-gun round lays a ribbon; the puff trail is only the fallback when the pool is spent');
  ok(/carry on in a fresh one/.test(st) && /RIB\.length<\(MOBILE\?ST\.capMobile:ST\.cap\)/.test(st), 'a long flight chains into a fresh ribbon; the pool is capped (smaller on phones)');
  ok(/const cap=\(w,h,d\)=>/.test(so) && /\/\/ Z236 eyes \+ brows/.test(so) && /mouth \+ jaw/.test(so), 'soldiers have rounded limbs and a face (eyes, brows, nose, mouth, jaw)');
  ok(/tow cables/.test(wk) && /smoked-glass domes/.test(wk) && !/propTex/.test(wk), 'the war kit: tow cables, smoked-glass LWR domes, plain hessian bags');
  ok((R('src/tank/model.js').match(/color:0x2a2a26/g)||[]).length===2 && /flattened into the hull so it bakes with it/.test(R('src/tank/designs.js')), 'headlights are dark glass in a housing, baked into the hull (no glowing puck)'); }

// Z237 props and buildings that read as the real thing: a burnt-out car with arches, an open cabin and bare rims; containers in faded paint with a
//   stencil once per wall; HESCO cages; pine ammo crates; steel hedgehogs; weathered steel / drum / tin textures without rust polka dots;
//   painted props no longer near-black (dielectric paint, not bare metal); a textured tunnel bunker with sandbags, a door frame and a sign
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const pr=R('src/world/props.js'), tu=R('src/world/tunnels.js'), ca=R('src/world/camps.js');
  ok(/export function boxUV\(g, su, sv\)/.test(pr) && /boxUV\(g, 1\/\(Lh\*2\), 1\/H\)/.test(pr) && /propTex\('container'\)/.test(pr), 'containers: planar UVs, their own stencilled texture');
  ok(/a burnt-out car that reads as one/.test(pr) && /absarc\(-0\.95,0\.32,0\.4,Math\.PI,0,true\)/.test(pr) && /seat frames/.test(pr), 'the wreck has wheel arches, an open cabin and seat frames');
  ok(/HESCO bastion/.test(pr) && /cage corner posts/.test(pr) && /name==='crate'/.test(pr) && /name==='tin'/.test(pr), 'HESCO cages, pine crate and corrugated tin textures');
  ok(/kind==='drums' \? M\(\{ map:propTex\('drum'\), roughness:0\.6, metalness:0\.2 \}\)/.test(pr) && /kind==='container' \? M\(\{ map:propTex\('container'\), roughness:0\.62, metalness:0\.12 \}\)/.test(pr), 'painted props are dielectric (no near-black drums / containers)');
  ok(/detailize\(new THREE\.MeshStandardMaterial\(\{ map:propTex\('concrete'\)/.test(tu) && /HẦM B-3/.test(tu) && /RoundedBoxGeometry/.test(tu), 'the tunnel bunker is textured concrete with sandbags and a sign');
  ok(/propTex\('tin'\)/.test(ca) && /metalness:0\.35/.test(ca), 'camp huts in corrugated grey tin'); }

// Z237b our own guided / lofted missile never strikes our tank: the bullet loop's enemy branch is only for rounds that are not ours
{ const fs=await import('node:fs'); const lo=fs.readFileSync('src/combat/lock-on.js','utf8');
  ok(/\} else if\(b\.owner!=='p'\)\{ \/\/ enemy bullet/.test(lo) && !/\} else \{ \/\/ enemy bullet/.test(lo), 'an airborne round of ours no longer falls through into the enemy-round branch (it used to hit our own tank as it flew over the hull)'); }

// Z238 the lock-on missile: never through a wall (climbs over what is in its path, strikes a wall too close to clear), a capped reach, a slower rate
{ const fs=await import('node:fs'), R=k=>fs.readFileSync(k,'utf8'); const lo=R('src/combat/lock-on.js'), cf=R('config.js'), G=(await import('./src/data/guns.js')).GUNS;
  ok(/LOCKON = \{ cone:1\.2, minP:9, allyR:3\.2, range:42, clear:1\.5, look:\[5,30\] \}/.test(cf), 'lock-on range cap, climb clearance and look-ahead in config');
  ok(/export function smartClear\(b, toTgt\)/.test(lo) && /hold=Math\.max\(desiredY, clr\)/.test(lo), 'the missile climbs over anything standing between it and its mark');
  ok(/_wy < blockTop\(bl\)\+0\.15\)\{ wb=bl; break; \}/.test(lo) && /if\(!wb && b\.by < FORT\.wallH\+0\.3\) wb=fortIntactCross/.test(lo), 'a wall it could not climb takes the hit — it never passes through');
  ok(/bl\.kind==='fortwall' \|\| bl\.kind==='gate'\)\) bl\._top=heightAt\(bl\.x,bl\.z\)\+FORT\.wallH/.test(lo), 'a fortress wall is measured at its parapet (not the whole fort’s towers and flags)');
  ok(/const mD=g\.lock \? Math\.min\(maxDist, LOCKON\.range\) : maxDist;/.test(R('src/combat/flame.js')) && /GUNS\[gid\]\.lock \? Math\.min\(r, LOCKON\.range\)/.test(R('src/core/config.js')) && /const left=b\.maxDist-/.test(lo), 'reach capped at fire, in the range ring / auto-fire, and in the seeker');
  ok(G.missile.fireCd===0.75 && G.missile.dmg===64, 'the lock-on launcher fires slower (0.55 → 0.75 s), each missile a little heavier'); }

// Z373–Z375 the battlefields composed from the Meshy community scans: high-detail files with mid / far / phone copies, each land's set laid out round
//   its wonder, the real watchtower and water towers as guard towers
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), SC=C.SCENERY, tk=R('src/world/tower-kinds.js'), D='assets/models/real/scene/';
  const tool=R('tools/scene-import.mjs'), spec=JSON.parse(R('tools/scene-import.json')), sc=R('src/world/scenery.js');
  ok(/EXT_meshopt_compression/.test(tool) && /KHR_mesh_quantization/.test(tool) && /reorderMesh/.test(tool) && /S\.simplify\(G\.idx, G\.pos, 3/.test(tool) && /'Permissive'/.test(tool), 'the import tool: seam-locked simplify (loose only for foliage copies), quantized + meshopt-compressed GLBs');
  const keys=Object.keys(SC.models), head=f=>{ const b=fs.readFileSync(f), n=b.readUInt32LE(12); return JSON.parse(b.slice(20,20+n)); };
  ok(keys.every(k=>spec[k]) && Object.keys(spec).filter(k=>k!=='_' && !spec[k].out).every(k=>SC.models[k]), 'every scanned model has its import spec and its scenery entry (the hand weapons, out: gun/inf, are the arsenal\'s)');
  ok(keys.every(k=>fs.existsSync(D+k+'.glb') && fs.existsSync(D+'m/'+k+'.glb') && (SC.models[k].one || (fs.existsSync(D+'l/'+k+'.glb') && fs.existsSync(D+'f/'+k+'.glb')))), 'each has its near file, its phone copy and (unless light) its mid and far copies');
  ok(keys.every(k=>{ const j=head(D+k+'.glb'); return j.extensionsRequired.includes('EXT_meshopt_compression') && fs.statSync(D+k+'.glb').size<50e6; }), 'the near files are compressed and each under 50 MB');
  const beats=Object.values(SC.biomes).flat(); ok(beats.every(b=>SC.models[b.k]) && Object.entries(SC.biomes).every(([n,L])=>L.every((b,i)=>!b.of || L.slice(0,i).some(q=>q.id===b.of))), 'every beat names a known model; pairs / rings follow the piece they hang on');
  ok(['export function buildSceneSet','export class SceneLOD','export function scenePiece','export function towerModel'].every(k=>sc.includes(k)) && /setMeshoptDecoder\(MeshoptDecoder\)/.test(sc) && /sceneLevel\(this\.key, 'd'\)/.test(sc), 'scenery.js: levels by distance, the near scan fetched on approach');
  ok(/buildSceneSet\(\); buildRuins\(\);/.test(R('src/world/landmarks.js')) && /WONDER\.a0 \?\?/.test(R('src/world/wonders.js')) && /WONDER\.a0 = a;/.test(sc), 'the set is laid out first, round the bearing the wonder then stands at');
  ok(/LAVA\.pools\.push\(\{ x:p\.x, z:p\.z, r, y, glow \}\)/.test(sc) && SC.models.lava_pit.lava>0, 'a lava pit holds live melt that burns like a pool');
  ok(/function realSupply\(gen\)/.test(sc) && /b\.kind !== 'fueltank'/.test(sc) && SC.supply.fueltank.h>0, 'the enemy fuel depot\'s tanks are the steel tank scan, inside each tank\'s own group');
  ok([['mtower','watchtower'],['wtower','wt_steel'],['wrust','wt_rust']].every(([k,m])=>new RegExp(k+": \\{ vi:'[^']+', mat:'steel', model:'"+m+"', deck:0\\.\\d+").test(tk) && SC.models[m]) && /K\.h=SCENERY\.models\[K\.model\]\.h\*K\.deck; K\.dress=body=>towerModel\(body, K\)/.test(tk) && /if\(K\.dress\) mats\.push\(K\.dress\(body\)\)/.test(R('src/world/towers.js')), 'the real towers: guards at the measured deck height, the scan stood in the tower body');
  ok(['DESERT','FOUNDRY','QUARRY','RUINS','ARCTIC','CITADEL','MEADOW','CITY'].every(b=>new RegExp(b+':\\{\\s*gt_\\w+:\\d+(,\\s*gt_\\w+:\\d+)*\\s*\\}').test(tk)), 'the lands raise only the new guard posts (Z420 gt_*), each its own architecture'); }

// Z383 the horizon for real: scanned summits / cones between the ranges, forest edges, a ruined city and the works in place of the box skylines (desktop)
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), K=C.SKYLINE, hz=R('src/world/horizon.js'), sc=R('src/world/scenery.js');
  const sets=Object.values(K.biomes).filter(v=>typeof v==='object'); ok(sets.every(b=>b.set.every(e=>(C.SCENERY.models[e.k] || /^ruin_/.test(e.k)) && e.n>0 && (e.h||e.w) && e.r.length===2)) && Object.values(K.biomes).filter(v=>typeof v==='string').every(v=>K.biomes[v]), 'every horizon piece names a scan (or a ruin) with a size and a distance; aliases point at a land');
  ok(/export function realHorizon\(g, name, R0, fogC\)/.test(sc) && /new THREE\.InstancedMesh\(L\.geo, hazeMat\(L\.mat, hz, fogC\)/.test(sc) && /HZN\.g !== g/.test(sc) && /!MOBILE && SKYLINE\.biomes\[name\]/.test(sc), 'one instanced, veiled mesh per scan, dropped if the horizon was rebuilt meanwhile; phones keep the old one');
  ok(/Promise\.resolve\(\)\.then\(\(\)=>realHorizon\(g, b\.name, R0, fogC\)\)/.test(hz) && /if\(!real\) g\.add\(skyline\(R0\+30/.test(hz) && /else if\(!real\) g\.add\(ring\(R0\+30/.test(hz) && /SK && SK\.rings \|\|/.test(hz), 'horizon.js: the real pieces a tick later, in place of the near range / box skyline when they are it, the ranges behind of the kind asked');
  ok(K.biomes.RUINS.skyline && K.biomes.FOUNDRY.skyline && K.biomes.VOLCANO.skyline && K.biomes.VOLCANO.rings==='peak' && K.biomes.TUNDRA==='ARCTIC' && K.biomes.STEELMILL==='FOUNDRY', 'ruins, works and volcano stand in for the near range; the tundra and the steel mill borrow their neighbours’');
  const sp=JSON.parse(R('tools/scene-import.json')); ok(['tank_steel','rail_tanker','radar_dish'].every(k=>sp[k].looseFar) && /loose:S\.loose \|\| S\.looseFar/.test(R('tools/scene-import.mjs')), 'the hard surfaces too cut up to thin get loose far / phone copies only'); }

// Z384–Z386 the radar station's tower as the dish scan (its dish sweeping with the head), the brick walls in the breached wall's stone (solid slices,
//   band for band), the city's power poles as the transformer pole scan and roofs with water tanks / masts
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=(await import('./config.js')).SCENERY, sc=R('src/world/scenery.js');
  ok(/function realRadar\(b, gen\)/.test(sc) && /head\.add\(dish\)/.test(sc) && /dish\.position\.y = -head\.position\.y/.test(sc) && C.supply.radar.split>0.3 && C.supply.radar.split<0.7, 'the radar: the scan\'s lattice in the tower, its dish in the turning head');
  ok(/function brickSlices\(\)/.test(sc) && /f < C\.fill/.test(sc) && /b\.wall\.bands\.forEach\(\(m, i\) =>/.test(sc) && C.bricks.slices>=3 && C.bricks.fill>0.5, 'brick walls: the scan cut into its most solid 3 m slices, each section band for band');
  ok(/function realCity\(gen\)/.test(sc) && /c\.kind === 'topple' && c\.T && c\.T\.pole/.test(sc) && /im\.geometry = g; im\.material = L\.mat;/.test(sc) && /lod\.watch = \(\) => Bd\.dead \|\| Bd\.top < top/.test(sc), 'the city: poles drawn as the scan (still toppling), roof pieces gone with their roof');
  ok(/if\(this\.watch && this\.watch\(\)\)\{ this\.visible = false; return; \}/.test(sc) && /realSupply\(gen\); realBricks\(gen\); realCity\(gen\);/.test(sc), 'all three dressed in the tick after the field is built'); }

// Z387 the four downloaded guns in his hands: plain GLBs laid along Z (tools/scene-import.mjs out/file/rot), each wired the way the AK is — its GUNS record,
//   the INFGUN map and length (muzzle at −z), the hold fitted off the model (fit:true) with GUNHOLD fallbacks, an icon, a blurb, a sound it already has
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), G=(await import('./src/data/guns.js')).GUNS, ic=R('src/ui/icons.js'), sp=JSON.parse(R('tools/scene-import.json'));
  const K={ t_rust:'rust', t_dmr:'dmr', t_rail:'rail', t_saw:'saw' };
  ok(Object.values(K).every(k=>fs.existsSync('assets/models/real/gun/inf/'+k+'.glb') && sp['gun_'+k] && sp['gun_'+k].out==='gun/inf' && sp['gun_'+k].rot===-90) && /'mp5','rust','dmr','rail','saw'\]\) MODEL_FILES\['inf_' \+ k\]/.test(R('src/actors/models.js')), 'the four scans are in the arsenal folder, laid along Z by the import tool, loaded as inf_<k>');
  ok(Object.entries(K).every(([id,k])=>G[id] && G[id].trooper && C.INFGUN.map[id]===k && C.INFGUN.guns[k].fit && C.INFGUN.guns[k].muzzle===-1 && C.GUNHOLD[k] && C.GUN_BLURB[id] && new RegExp('\\b'+G[id].svg+":'").test(ic)), 'each has its record, its place in the INFGUN map (fitted, muzzle −z), a hold, a blurb and an icon');
  ok(G.t_rust.dmg>G.t_ak.dmg && G.t_dmr.pierce>=1 && G.t_dmr.fireCd<G.t_sniper.fireCd && G.t_rail.pierce>G.t_sniper.pierce && G.t_saw.pierce>=2 && G.t_saw.rng<1, 'each its own role: the rust rifle heavier than the AK, the marksman quicker than the 12.7, the rail through a squad, the saw short and through three');
  ok(['shoot_ak','shoot_rifle','shoot_railgun','shoot_shotgun'].every(n=>new RegExp("case '"+n+"'").test(R('src/audio/synth.js'))) && [G.t_rust.snd,G.t_dmr.snd,G.t_rail.snd,G.t_saw.snd].join()==='shoot_ak,shoot_rifle,shoot_railgun,shoot_shotgun', 'each fires a sound the synth already makes'); }

// Z390 two guns the hold fit misread: the rail rifle's muzzle inside a thick shroud (its bore through the middle, bore:'mid'), the marksman rifle's pistol
//   grip grown into its thumbhole stock (taken where it is, gripAt) — passed by real-cav.js, judged by the same rule in the pose studio
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), gf=R('src/actors/gun-fit.js'), ps=R('src/dev/pose-studio.js');
  ok(/export function boreOf\(front, mode\)/.test(gf) && /bore = boreOf\(front, o\.bore\)/.test(gf) && /if\(o\.gripAt != null\)\{/.test(gf) && /ahead = parts\.filter\(p => p\.b < o\.gripAt - 1 \/ N\)/.test(gf), 'gun-fit: the bore rule per gun, a grip taken where it is said to be');
  ok(/\{ gun:kid \? GUNS\[kid\] : null, bore:g\.bore, gripAt:g\.gripAt \}/.test(R('src/actors/real-cav.js')) && /boreOf\(rows, \(INFGUN\.guns\[R\.armK\] \|\| \{\}\)\.bore\)/.test(ps) && (ps.match(/gripAt:\(INFGUN\.guns\[k\] \|\| \{\}\)\.gripAt/g)||[]).length===2, 'the soldier holds by them and the studio judges by them');
  ok(C.INFGUN.guns.rail.bore==='mid' && C.INFGUN.guns.dmr.gripAt>0.1 && C.INFGUN.guns.dmr.gripAt<0.3 && C.INFGUN.guns.dmr.len>=1.15 && C.INFGUN.guns.rail.len>=1.2, 'the two at their true lengths again, each with its override'); }

// Z393 the arctic's hand-built cone 'ice spires' gone: small snow-capped crags from the summit scan out on the ice, solid, never fetching the whole scan
{ const fs=await import('node:fs'), C=await import('./config.js'), R=f=>fs.readFileSync(f,'utf8'), fl=R('src/world/flora.js'), sc=R('src/world/scenery.js'), B=C.SCENERY.biomes.ARCTIC.find(b=>b.k==='ice_peak'&&b.at==='free');
  ok(!/iceSpire/.test(fl), 'no cone spires left in the arctic\'s flora');
  ok(B && B.n>=8 && B.s[0]>0.02 && B.s[1]<0.1 && B.solid && B.solid.disc>0 && B.top==='l', 'crags out on the ice: the summit scan a few metres tall, its own solid disc, at most the mid copy');
  ok(/solid:beat && beat\.solid, top:beat && beat\.top/.test(sc) && /const C = p\.solid \|\| M\(p\.k\)\.solid/.test(sc) && /nearAt:MOBILE \|\| one \|\| o\.top \? 0/.test(sc) && /if\(o\.top !== 'f'\) sceneLevel\(k, 'l'\)/.test(sc) && /scenePiece\(p\.k, p\.s, \{ shadow:!p\.far, top:p\.top \}\)/.test(sc), 'a beat\'s solid and top reach the piece: its collision, no near scan streamed in'); }

// Z394 the ground made real: the flat-looking floors (trodden snow, the works' brown road, grey ash, the savanna's fine laterite) on richer photo sets, per battlefield relief and patches
{ const fs=await import('node:fs'), C=await import('./config.js'), G=C.GROUND_PHOTO, gp=fs.readFileSync('src/world/ground-photo.js','utf8'), Z=JSON.parse(fs.readFileSync('assets/ground/sizes.json','utf8')), has=f=>fs.existsSync('assets/ground/'+f);
  ok(G.biomes.ARCTIC[0]==='snow_01' && G.biomes.FOUNDRY[0]==='concrete_floor_damaged_01' && G.biomes.STEELMILL[0]==='concrete_floor_damaged_01' && G.biomes.VOLCANO[0]==='rocks_ground_02' && G.biomes.SAVANNA[0]==='dry_ground_rocks', 'the snow, the works, the volcano and the savanna on the richer sets');
  ok(Object.values(G.biomes).flat().every(s=>has(s+'/diff.jpg') && has(s+'/nor.jpg') && has(s+'/arm.jpg') && Z[s]>0), 'every set a battlefield names is on disk with its tile size');
  ok(G.hi2k.every(s=>has(s+'/2k/diff.jpg') && has(s+'/2k/nor.jpg')), 'the 2K list names only sets whose 2K maps are on disk');
  ok(Object.entries(G.per).every(([b, p])=>G.biomes[b] && Object.keys(p).every(k=>['nrm','patchK','dual','altRep'].includes(k)) && (p.nrm==null || (p.nrm>0.5 && p.nrm<2)) && (p.patchK==null || (p.patchK>0 && p.patchK<=1.2)) && (p.dual==null || (p.dual>=0 && p.dual<=1))), 'per-battlefield overrides: known battlefields, known keys, sane values');
  ok(/G = k => PB\[k\] \?\? GROUND_PHOTO\[k\]/.test(gp) && /normalScale\.set\(G\('nrm'\), G\('nrm'\)\)/.test(gp) && /MACRO\.pamt\.value \*= G\('patchK'\)/.test(gp) && /G\('altRep'\)/.test(gp) && /PHOTO_U\.dual\.value = G\('dual'\)/.test(gp) && /\(GROUND_PHOTO\.hi2k \|\| \[\]\)\.includes\(pair\[0\]\)/.test(gp), 'the ground reads the overrides, and asks for 2K only where it is on disk'); }

// Z395 near detail: the originals' sharp maps on whatever the camera is close to (each model's reach by its size, a cap on how many at once); the
//   few trees nearest the camera drawn whole from the original, hidden in the shipped mesh's shader (its matrices untouched)
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), N=C.NEARDETAIL, nd=R('src/render/near-detail.js'), rt=R('src/world/real-trees.js'), T=JSON.parse(R('tools/hd-maps.json')), IX=JSON.parse(R('assets/models/real/hd/index.json')), keys=Object.keys(T).filter(k=>!k.startsWith('_'));
  ok(N.on && N.min>0 && N.min<N.at && N.at<=40 && N.rK>1 && N.out>1 && N.hold>0 && N.maxKeys>=4 && N.maxKeys<=12 && N.trees.n>0 && N.trees.n<=16 && N.trees.at>N.min, 'near detail: a reach by size between min and at m, a cap on sharp models at once, a dozen whole trees at most');
  ok(keys.length>=70 && keys.every(k=>((IX[k]||[]).includes('0.map') ? fs.existsSync('assets/models/real/hd/'+k+'.0.map.webp') : (IX[k]||[]).includes('geo')) && fs.existsSync('assets/models/real/'+T[k].file+'.glb')), 'every model in the table has its sharp base colour (or, shipped at its original\'s 2K already, its whole shape) on disk beside its shipped file');
  ok(Object.keys(IX).every(k=>IX[k].every(s=>fs.existsSync('assets/models/real/hd/'+(s==='geo' ? k+'.glb' : k+'.'+s+'.webp')))), 'the index the game reads names only files on disk');
  ok(Object.keys(C.REALTREE.h).every(k=>(IX['tree_'+k]||[]).includes('geo') && T['tree_'+k] && T['tree_'+k].geo===0), 'every tree species has its whole shape (all its triangles) for up close');
  ok(/nearTag\(key, gl\); return gl;/.test(R('src/actors/models.js')) && /render\/near-detail\.js/.test(R('src/hub.js')) && /t\.dispose\(\); t\.source = src; t\.needsUpdate = true;/.test(nd) && /THREE\.Mesh\.prototype\.onBeforeRender = function/.test(nd) && /nohd/.test(nd) && /!MOBILE/.test(nd), 'shipped models are tagged as they load; a swap is a fresh upload on a new Source; desktop only, ?nohd switches it off');
  ok(/attribute float aHide;/.test(rt) && /if\(aHide > 0\.5\) transformed = vec3\(0\.0\);/.test(rt) && /nim\.castShadow = false/.test(rt) && !/\bim\.setMatrixAt\(/.test(rt) && /copyNear\(im, N\)/.test(rt), 'near trees: the shipped tree hidden in its own shader, its matrices (felling, collisions) never written, the copy follows them every frame');
}
// Z397 the 27 fort pieces at their originals' full triangles (they shipped at half: 14–20 thousand), the original's 4K colour swapped in up close
//   (the normal stays the shipped 2K: at 4K it looked no different, at twice the memory)
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), T=JSON.parse(R('tools/hd-maps.json')), IX=JSON.parse(R('assets/models/real/hd/index.json')), hm=R('tools/hd-maps.mjs');
  const tris=f=>{ const B=fs.readFileSync(f), jl=B.readUInt32LE(12), J=JSON.parse(B.toString('utf8',20,20+jl)); return J.meshes.reduce((s,m)=>s+m.primitives.reduce((t,p)=>t+(p.indices!=null ? J.accessors[p.indices].count : J.accessors[p.attributes.POSITION].count)/3,0),0); };
  const P=['arctic','citadel','desert','foundry','meadow','quarry','ruins','savanna','volcano'].flatMap(st=>['wall','tower','gate'].map(p=>'fort_'+st+'_'+p));
  ok(P.every(k=>tris('assets/models/real/fort/'+k+'.glb') >= (k.endsWith('gate') ? 35000 : 28000)), 'every fort piece at its original\'s full triangles');
  ok(P.every(k=>T[k] && T[k].file==='fort/'+k && T[k].tex===4096 && JSON.stringify(T[k].maps)==='["map"]' && JSON.stringify(IX[k])==='["0.map"]'), 'each wears its original\'s colour at 4K up close, its normal left at the shipped 2K');
  ok(/\(S\.maps && !S\.maps\.includes\(s\)\)\) continue;/.test(hm), 'the hd tool cuts only the slots a table entry names'); }

// Z395b near shapes: the camps' buildings and parked vehicles, the ruins, the animals and the soldier's gun drawn from their whole originals up close
//   (each system's own preparing function run on the original; a rigged body keeps its bones, so it is never quantized)
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), nd=R('src/render/near-detail.js'), T=JSON.parse(R('tools/hd-maps.json')), IX=JSON.parse(R('assets/models/real/hd/index.json')), tool=R('tools/hd-maps.mjs');
  const keys=['base_barracks','base_bunker','base_radar','base_tent','base_tower','base_wire','mil_truck','mil_apc','mil_jeep','mil_humvee','ruin_block','ruin_tower','ruin_villa','ruin_wall','ruin_house','wild_bear','wild_deer','wild_elephant','wild_reindeer','wild_zebra','wild_giraffe','inf_ar','inf_energy','inf_flamer','inf_gl','inf_lmg','inf_minigun','inf_rpg','inf_shotgun','inf_sniper','inf_ak','inf_mp5','inf_m4'];
  ok(keys.every(k=>T[k] && T[k].geo!=null && T[k].geo<=70000 && (IX[k]||[]).includes('geo') && fs.existsSync('assets/models/real/hd/'+k+'.glb')), 'every camp piece, parked vehicle, ruin, animal and soldier gun has its whole shape on disk (≤ 70k triangles)');
  ok(C.NEARDETAIL.shapes>=4 && C.NEARDETAIL.shapes<=32 && /export function nearShape\(m, key, prep, o = \{\}\)/.test(nd) && /export const asShipped = key =>/.test(nd) && /if\(b\.isSkinnedMesh\) return a\.skeleton\.bones\.map\(x => x\.name\)\.join\(\) === b\.skeleton\.bones\.map\(x => x\.name\)\.join\(\) \? b\.geometry : null;/.test(nd) && /m\.geometry === S\.hd\) m\.geometry = S\.lo/.test(nd), 'a placed mesh swaps only its geometry, hands it back unless the system changed it since; a rigged body keeps the shipped bones');
  ok(/if\(!doc\.getRoot\(\)\.listSkins\(\)\.length\)\{/.test(tool), 'a rigged original is written in plain floats (quantizing would move its frame into the bind matrices)');
  ok(/nearShape\(m, q\.k, gl => piece\(gl, q\.k, true\)\.geo\)/.test(R('src/world/outposts.js')) && /nearShape\(m, s\.k, gl => prep\(gl, s\.k, true\)\.geo\)/.test(R('src/world/ruins3d.js')) && /nearShape\(o, 'wild_'\+id, asShipped\('wild_'\+id\)\)/.test(R('src/actors/wildlife.js')) && /nearShape\(o, 'inf_' \+ k, asShipped\('inf_' \+ k\)\)/.test(R('src/actors/real-cav.js')), 'the camps, ruins, animals and the soldier\'s guns register their meshes');
}
// Z398 the four wonders at their originals' full triangles (they shipped at 24 thousand of 36–39), the original's 4K colour swapped in up close
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), T=JSON.parse(R('tools/hd-maps.json')), IX=JSON.parse(R('assets/models/real/hd/index.json'));
  const tris=f=>{ const B=fs.readFileSync(f), jl=B.readUInt32LE(12), J=JSON.parse(B.toString('utf8',20,20+jl)); return J.meshes.reduce((s,m)=>s+m.primitives.reduce((t,p)=>t+(p.indices!=null ? J.accessors[p.indices].count : J.accessors[p.attributes.POSITION].count)/3,0),0); };
  const W=['colosseum','djenne','taj','volklingen'].map(k=>'wonder_'+k);
  ok(W.every(k=>tris('assets/models/real/wonder/'+k+'.glb') >= 35000), 'every wonder at its original\'s full triangles');
  ok(W.every(k=>T[k] && T[k].file==='wonder/'+k && T[k].tex===4096 && JSON.stringify(T[k].maps)==='["map"]' && JSON.stringify(IX[k])==='["0.map"]'), 'each wears its original\'s colour at 4K up close'); }

// Z395c the player's own ride (xe ôm, ba gác, bán tải: wheels cut and bars split the same way), its driver, a dropped gun and the enemy's B40 drawn from
//   their whole originals up close; a shape is exported only from the very model shipped (its atlas checked), clips dropped; a mesh is held weakly
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), nd=R('src/render/near-detail.js'), T=JSON.parse(R('tools/hd-maps.json')), IX=JSON.parse(R('assets/models/real/hd/index.json')), tool=R('tools/hd-maps.mjs'), xe=R('src/game/xeom.js');
  ok(['ride_xeom','ride_bagac','ride_bantai','drv_xeom'].every(k=>T[k] && T[k].geo===0 && (IX[k]||[]).includes('geo') && fs.existsSync('assets/models/real/hd/'+k+'.glb')) && T.ride_xeom.src==='tripo/hb_xeom' && T.ride_bagac.src==='tripo/hb_bagac', 'the three war rides and the driver have their whole shapes, from the originals they were shipped from (hb_xeom / hb_bagac, not the hero_ retries)');
  ok(/line\.geo = 'refused: the original is not the shipped model/.test(tool) && /for\(const a of doc\.getRoot\(\)\.listAnimations\(\)\) a\.dispose\(\);/.test(tool), 'a shape is refused when its original\'s atlas is not the shipped one; the clips stay in the shipped file');
  ok(C.NEARDETAIL.hero>=C.NEARDETAIL.min && C.NEARDETAIL.hero<=C.NEARDETAIL.at && /new window\.WeakRef\(m\)/.test(nd) && /score\(_c\.distanceTo\(_s\.center\), _s\.radius, S\.min\)/.test(nd), 'the player\'s ride and driver reach further than their size gives; meshes held weakly');
  ok(/function heroGeo\(gl, kind, hd\)\{ const id = hd \? kind \+ ':hd' : kind;/.test(xe) && /nearShape\(mesh, 'ride_' \+ kind, gl => heroGeo\(gl, kind, true\)\.geo, \{ min:NEARDETAIL\.hero \}\)/.test(xe) && /nearShape\(bm, 'ride_' \+ kind, gl => heroGeo\(gl, kind, true\)\.bar, \{ min:NEARDETAIL\.hero \}\)/.test(xe), 'the ride\'s body and its steering head both swap, cut the same way');
  ok(/nearShape\(o, RIDE\.model\[kind\], asShipped\(RIDE\.model\[kind\]\), \{ min:NEARDETAIL\.hero \}\)/.test(R('src/actors/driver.js')) && /nearShape\(o, 'inf_'\+k, asShipped\('inf_'\+k\)\)/.test(R('src/loot/powerups.js')) && /nearShape\(o, 'inf_rpg', asShipped\('inf_rpg'\)\)/.test(R('src/actors/infantry.js')), 'the driver, a dropped gun and the enemy B40 register too');
}
// Z399 the city's structures: its fort in the works' real style (it stood as plain boxes in a stone wrap), the far city rebuilt with the real towers
//   once they have loaded (the first stage built it from flat untextured blocks and pale peaks), less veiled, the glass towers' curtain wall drawn crisp,
//   Landmark 81 / Bitexco in their originals' 4K colour up close
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), hz=R('src/world/horizon.js'), ct=R('src/world/city.js'), T=JSON.parse(R('tools/hd-maps.json')), IX=JSON.parse(R('assets/models/real/hd/index.json'));
  ok(C.REALFORT.biomes.CITY==='foundry' && ['wall','tower','gate'].every(p=>fs.existsSync('assets/models/real/fort/fort_foundry_'+p+'.glb')), 'the city\'s fort wears the works\' real style');
  ok(/if\(kind==='city' && !MOBILE && !realCityReady\(\) && typeof window!=='undefined'\) loadRealCity\(\)\.then\(ok => \{ if\(ok && realCityReady\(\) && BIOME===b && HZN\.g===g\) buildHorizon\(b\); \}\);/.test(hz), 'a city horizon built before the city\'s models is built again once they are in');
  ok(C.REALCITY.flatHorizon.every(r=>r[2]<=0.5), 'the far city rings veiled at most half');
  ok(C.REALCITY.windows.frame>0 && /const FACADE_GLSL = /.test(ct) && /\$\{FACADE_GLSL\}/.test(ct) && /export const WIN_F=/.test(ct) && /fwidth\(q\)/.test(ct) && /k = glassy \* vert \* uWinF/.test(ct), 'the curtain wall\'s frame on the glass only, on vertical faces, faded by its own screen size');
  ok(['bld_landmark'].every(k=>T[k] && T[k].tex===4096 && JSON.stringify(T[k].maps)==='["map"]' && JSON.stringify(IX[k])==='["0.map"]' && fs.existsSync('assets/models/real/hd/'+k+'.0.map.webp')), 'Landmark 81 wears its original\'s 4K colour up close (Z420 the Bitexco is gone)'); }

// Z400 things stand ON the floor: every solid footprint painted once a stage is built into a contact map (shade tight round it, trodden earth further
//   out) that the ground and the grass read; each thing's foot dusted and shaded from where the real ground meets it (the terrain's heights)
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), K=C.CONTACT, dc=R('src/world/decals.js'), gr=R('src/world/ground.js'), bl=R('src/render/blend-in.js'), gc=R('src/world/grass-carpet.js');
  ok(K.on && K.shade>0 && K.shade<1 && K.skirt>0 && K.skirt<1 && K.skirtW>K.pad && K.skirtB>K.shadeB && K.res[0]>=K.res[1] && Object.values(K.col).every(c=>c.length===3 && c.every(v=>v>0.3 && v<1)) && C.BLEND.ao>0 && C.BLEND.ao<0.8 && C.BLEND.aoH>0, 'contact: a shade tight round things, a wider skirt of trodden earth, per battlefield earth colours; a foot shade on the things');
  ok(/export function paintContact\(\)/.test(dc) && /solidShape\(b\)/.test(dc) && /SCENE\.pieces/.test(dc) && /x\.shadowBlur = blur \* P \* 2; x\.shadowOffsetX = W;/.test(dc) && /globalCompositeOperation = 'lighter'/.test(dc), 'every solid footprint (true wall / building shapes, the scenery) painted once, its edges soft by the canvas shadow');
  ok(/try\{ paintContact\(\); \}catch/.test(bl) && bl.indexOf('paintContact()') < bl.indexOf('if(!BLEND.on) return 0;'), 'painted whenever a stage\'s field is graded (the intro warm-up, the next stage)');
  ok(/vec2 ct = texture2D\(decalC, duv\)\.rg;/.test(gr) && /diffuseColor\.rgb \*= 1\.0 - ct\.r \* contK\.x;/.test(gr) && /decalC:\{ value:null \}/.test(gr), 'the ground darkened and dirtied by it');
  ok(/vGc = texture2D\(decalC,/.test(gc) && /transformed\.y \*= 1\.0 - clamp\(vGc\.g \* 0\.6 \+ vGc\.r \* 0\.5, 0\.0, 0\.85\);/.test(gc) && /'grassPhoto2'/.test(gc), 'the grass trodden down and shaded round what stands in it');
  ok(/hT = min\(hT, vBlendW\.y - texture2D\(blendTT, tuv\)\.r\);/.test(bl) && /function terrainTex\(\)/.test(bl) && /THREE\.HalfFloatType/.test(bl) && /'\|blendIn2'/.test(bl), 'a thing\'s foot measured from the real ground under it (a sunk wall, a slope), shaded where they meet'); }

// Z420 the second Meshy batch and the battlefield's design: cover pieces, the container's three boxes, cast concrete in the land's tone, the forts'
//   command compounds of real bunkers (one HP), the fuel store, the skyline towers, the new guard posts, the defence in depth, each land's own film
{ const fs=await import('node:fs'), R=f=>fs.readFileSync(f,'utf8'), C=await import('./config.js'), df=R('src/world/defense.js'), ft=R('src/world/fortress.js'), cv=R('src/world/cover.js'), zn=R('src/world/zones.js'), rp=R('src/world/real-props.js'), at=R('src/world/atmosphere.js'), sc=R('src/world/scenery.js'), tk=R('src/world/tower-kinds.js'), op=R('src/world/outposts.js');
  const scene=k=>['','l/','f/','m/'].every(d=>fs.existsSync('assets/models/real/scene/'+d+k+'.glb'));
  ok(C.REALPROP.variants.container.every(v=>fs.existsSync('assets/models/real/cover/'+v+'.glb')) && /export function coverVariant\(m\)/.test(rp) && /coverVariant\(m\);/.test(cv) && /REAL_COVER\.fits\[k\] = fits;/.test(rp), 'every container picks one of three real boxes (and keeps its own paint)');
  ok(C.REALPROP.trueH.jersey>0.8 && C.REALPROP.trueH.jersey<1.1 && /REALPROP\.trueH\[k\] \? REALPROP\.trueH\[k\] \/ COVER_K \/ h/.test(rp), 'the jersey barrier stands at its real height');
  ok(C.REALPROP.cast.kinds.includes('concrete') && ['DESERT','FOUNDRY','ARCTIC','CITY','VOLCANO'].every(b=>C.REALPROP.cast.tint[b]) && /REALPROP\.cast\.tint\[BIOME\.name\]/.test(R('src/world/props.js')), 'cast concrete takes the land\'s tone');
  ok([1,2,3].every(t=>C.FORT_CMD.tiers[t][0][4]==='main' && C.FORT_CMD.tiers[t].every(p=>p[0].split('|').every(k=>C.SCENERY.models[k] && (C.SCENERY.models[k].one ? fs.existsSync('assets/models/real/scene/'+k+'.glb') : scene(k))))), 'each fort tier\'s command compound is real bunkers, all on disk');
  ok(/if\(cmdCompound\(f, g, WM, lx, lz, ry, -side\)\) return;/.test(ft) && /const c=f\.coreBlock\|\|b; c\.hp-=dmg; for\(const q of \(f\.coreBlocks\|\|\[\]\)\) q\.hp=c\.hp;/.test(ft) && /for\(const q of \(f\.coreBlocks\|\|\[b\]\)\)/.test(ft), 'one HP for the whole compound, every piece of it goes when it falls');
  ok(scene('fuel_depot') && C.SCENERY.supply.depot.w>0 && /b\.kind === 'pumphouse'/.test(sc), 'the fuel station\'s store is the weathered platform scan');
  ok(C.REALCITY.skyline.length===2 && C.REALCITY.skyline.every(t=>fs.existsSync('assets/models/real/city/'+t.k+'.glb') && fs.statSync('assets/models/real/city/'+t.k+'.glb').size<2.5e6) && !fs.existsSync('assets/models/real/city/bld_bitexco.glb'), 'the Bitexco is gone; the glass spire and the Palmspire stand with Landmark 81');
  ok(['gt_sentinel','gt_concrete','gt_round','gt_limes','gt_stone','gt_castle','gt_winter','gt_broken'].every(k=>scene(k) && new RegExp(k+": \\{[^}]*model:'"+k+"', deck:0\\.\\d+").test(tk)), 'eight new guard posts, each standing its guards on its measured deck');
  ok(C.DEFENSE.on && /planForts\(\); planDefense\(\);/.test(zn) && /buildDefense\(\);/.test(cv) && cv.indexOf('buildDefense();') < cv.indexOf('MAZE_SHAPES[') && /DEFENSE\.maze\.cut/.test(cv), 'the defence is planned after the forts and laid before the scatter, which thins behind it');
  ok(/function chords\(\)/.test(df) && /B\.spawnGap/.test(df) && /short = len < DEFENSE\.laneW \+ 12/.test(df) && /function wall\(kind, at, u0, v0, u1, v1, tag\)/.test(df) && C.DEFENSE.cp.walls.length>=6 && C.DEFENSE.cp.len.concrete>3, 'belts run fort to fort (not across our spawn), short gaps are lanes, checkpoints are whole walls');
  ok(/b\.def && Math\.hypot\(b\.x - f\.x - lx/.test(op), 'a fort\'s outpost keeps off the belt that joins it');
  ok(C.SCENERY.tone>0 && C.SCENERY.tone<1 && /export function landTone\(\)/.test(sc) && /scenePiece\(K\.model, 1, \{ mat, tone:landTone\(\) \}\)/.test(sc) && /scenePiece\(key, 1, \{ tone \}\)/.test(ft) && /mat\.map !== mat\.userData\.tonedMap/.test(sc), 'the forts\' bunkers and the guard towers wear the land\'s tone (once per set of maps)');
  ok(['DESERT','ARCTIC','FOUNDRY','VOLCANO','CITADEL','RUINS','MEADOW','CITY','SAVANNA','QUARRY'].every(b=>C.ART_TONE[b] && C.ART_TONE[b].mood && C.ART_TONE[b].sh && C.ART_TONE[b].hi) && /artTone\(b\.name, A\);/.test(at) && at.indexOf('artTone(b.name, A);') > at.indexOf('Z242 realistic light'), 'each battlefield its own film, applied last'); }

console.log(`\n${fail === 0 ? '✓ PASS' : '✗ FAIL'} — ${pass} checks passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
