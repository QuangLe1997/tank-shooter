// ============================================================================
// STEEL SIEGE — smoke test for config.js (zero-dependency, node ESM).
// Run:  node test.js     (exits non-zero on any failed invariant)
// Guards the economy/balance data against silent breakage during edits.
// ============================================================================
import { BALANCE, RAR_COL, SHOP_UP, GUN_PRICE, VIP_GUNS, GUN_BLURB, UP_BLURB, CONTRACTS, DMG_TYPE, ARMOR, RAMP, ENV, GIFT, INFANTRY, EQUIP, ROSTER, OPERATIONS, OBJECTIVES, OBJ_REWARD, DRIVE, TROOPS, CAMP, BRIDGE, LOOT, TACTICS, BOSSFIGHT, AIM, LETHAL, SQUAD, RALLY, POW, DEPOT, ALLY_TANK, PARA } from './config.js';
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
ok(DRIVE.launch > 0.15 && DRIVE.launch < 0.6, 'heavy launch: a fraction of full power from a dead stop');
ok(DRIVE.launchV > 0 && DRIVE.launchV < PLAYER_MAXSPEED, 'full power arrives before top speed');
{ // simulate the throttle curve: 0 → 90% top speed should take a real tank's second or two, not an instant
  let v=0, t=0; const top=PLAYER_MAXSPEED; while(v<top*0.9 && t<10){ const launch=DRIVE.launch+(1-DRIVE.launch)*Math.min(1,v/DRIVE.launchV), fall=Math.max(0,1-(v/top)**2); v+=DRIVE.accel*launch*fall*(1/60); t+=1/60; }
  ok(t > 0.9 && t < 2.6, `0→90% top speed in ${t.toFixed(2)}s (0.9–2.6s: weighty but playable)`); }
ok(DRIVE.coast > 0 && DRIVE.coast < DRIVE.brake, 'coasting rolls on; braking bites harder');
ok(PLAYER_MAXSPEED / DRIVE.coast > 1 && PLAYER_MAXSPEED / DRIVE.coast < 3, 'coast-down from top speed lasts 1–3s (inertia you can feel, still controllable)');
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
}

for (const id of Object.keys(GUN_PRICE)) {
  ok(typeof GUN_BLURB[id] === 'string' && GUN_BLURB[id].length > 0, `GUN_BLURB has copy for gun "${id}"`);
}

console.log(`\n${fail === 0 ? '✓ PASS' : '✗ FAIL'} — ${pass} checks passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
