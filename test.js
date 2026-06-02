// ============================================================================
// STEEL SIEGE — smoke test for config.js (zero-dependency, node ESM).
// Run:  node test.js     (exits non-zero on any failed invariant)
// Guards the economy/balance data against silent breakage during edits.
// ============================================================================
import { BALANCE, RAR_COL, SHOP_UP, GUN_PRICE, VIP_GUNS, GUN_BLURB, UP_BLURB, CONTRACTS } from './config.js';

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
// sustained DPS = mag·dmg / (mag·fireCd + reload) — strong support, not a wave-wipe
const droneDps = D.mag * D.dmg / (D.mag * D.fireCd + D.reload);
ok(droneDps > 15 && droneDps < 90, `drone sustained DPS (${droneDps.toFixed(1)}) sits in a balanced band (15–90)`);
ok(D.hp >= 60 && D.hp <= 300, `drone HP (${D.hp}) is killable-but-durable (60–300) so enemy fire matters`);

grp('BLURBS — present for every item');
for (const u of SHOP_UP) {
  ok(typeof UP_BLURB[u.key] === 'string' && UP_BLURB[u.key].length > 0, `UP_BLURB has copy for upgrade "${u.key}"`);
}
for (const id of Object.keys(GUN_PRICE)) {
  ok(typeof GUN_BLURB[id] === 'string' && GUN_BLURB[id].length > 0, `GUN_BLURB has copy for gun "${id}"`);
}

console.log(`\n${fail === 0 ? '✓ PASS' : '✗ FAIL'} — ${pass} checks passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
