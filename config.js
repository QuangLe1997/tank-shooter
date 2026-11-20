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
// Z225 UNDERGROUND — the CAVERN battlefield (HANG NGẦM, after Sơn Đoòng) and the enemy TUNNEL NETWORK (địa đạo) dug under every battlefield
export const CAVE_DEF = { wallH:30, wallW:12, shafts:[4,5], shaftR:[9,15], lights:{ desk:8, mob:3, range:24, I:34, big:70 }, shaftLight:{ desk:4, mob:2, I:5.5 },
  torchStep:15, braziers:6, pillars:[2,3], crystals:[22,12], mouths:3, caveIn:{ every:[40,65], warn:1.7, R:4.6, dmg:16, rocks:[3,5] } };
export const TUNNEL = { from:2, n:[3,4], caveN:3, hp:{ hatch:70, bunker:280, mouth:520 }, seeR:20, under:[4,8], hurtK:0.6, suppK:0.5, grabR:7, heal:0.25,
  ambush:{ first:[35,55], every:[30,48], r:[24,70], cap:90 }, score:{ seal:250, all:800, buried:60 } };
// Z226 the UNDERGROUND BASE under every battlefield, reached through the guarded MAIN TUNNEL GATE (electronic lock)
// Z234 HOME GROUND: every enemy installation (fortress, barracks camp, fuel/ammo/radar compound, the underground gate, bunkers, watchtowers)
//   stands well clear of OUR citadel — gap = open ground between our wall (wall: its radius, world/core-walls.js) and the edge of theirs,
//   wider than our guard cannons' reach past the wall (54 − 24 = 30 m); small posts (bunkers, towers) keep a shorter gap. spawn: the same from our spawn point.
export const HOME_GAP = { wall:24, gap:46, gapMobile:26, small:34, smallMobile:20, spawn:36, spawnMobile:24, minK:0.7, campMobileK:0.5 };   // campMobileK: on the small phone field the first barracks camp may relax to half the gap rather than not exist   // minK: when the field is too crowded to place a site, the gap relaxes step by step to this share, never below
export const UNDERBASE = { off:170, W:75, D:55, gate:{ lockHp:[380,80], turretHp:300, turretR:36, turretCd:[0.09,1.5], turretDmg:3, burst:8, guards:[5,1], tanks:[1,0.5] },
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
  rifle:'Bền bỉ, đa năng — không bao giờ kẹt đạn.', smg:'Cơn mưa đạn dữ dội ở cự ly gần.',
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
  hp:{ radartower:560, radome:220, aagun:150, fueltank:300, tanker:120, pumphouse:320, bunker:480, ammostack:90, supplytruck:110 },
  alertR:46, leash:40, guards:[3,6], tanks:[1,1], heli:[1,3], heliCd:40, reinf:2, tankCd:30,
  cut:{ speed:0.12, tanks:0.18, dmg:0.12, rate:0.15, inf:0.25, min:0.7 }, coin:380, score:2200 };
export const CAMP = { perStage: [2, 2, 2, 3, 3], hp: 420, hpPerStage: 0.18, every: 16, squad: [2, 4], infCap: 22, coin: 220, score: 900, tentScore: 60 };
export const BRIDGE = { pairChance: 0.75, minD: 12, maxD: 18, patrolSpeed: 1.6 };

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
export const CAM_FEEL = { lift:[0,3,6,9,12,16], liftT:0.32, follow:0.09, lead:0.38, yaw:0.24, zoom:0.2, dash:0.22, dashPull:3.2, resume:0.6, kick:0.55, fovEase:5, orbit:0.0065, wheelZoom:0.0016 };
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
// Z245 CAVALRY MODE (game/cavalry.js) — the general in full plate on his armoured charger, or on foot.
//   horse: walk / cruise (canter) / gallop (surge, dur s, cd s) speeds, back-up, accel/decel m/s², turn rate rad/s low → high speed · foot: run, sprint (dur, cd),
//   crouch-walk, crawl · radius (collision + hit size) · defK = damage taken × by posture (plate armour + a smaller target) · camK = camera distance × ·
//   mountR = reach to climb back on · call = the horse trots to your whistle at this speed · trample: galloping over infantry · recoilK = recoil × (no tank to soak it)
export const CAV = { horse:{ walk:1.8, cruise:7.5, gallop:16, back:1.4, accel:4.2, surgeAccel:6.5, decel:6.5, turnLow:2.6, turnHigh:1.05 }, surge:{ dur:5, cd:7 },
  foot:{ run:5.2, sprint:7.4, crouch:2.0, crawl:0.9, sprintDur:3, sprintCd:4 }, radius:{ mounted:1.0, foot:0.45, prone:0.38 },
  defK:{ mounted:0.55, stand:0.6, crouch:0.45, prone:0.3 }, camK:{ mounted:0.62, foot:0.5, prone:0.44 }, mountR:3.4, mountT:0.5, call:{ speed:9, arrive:2.6 },
  trample:{ v:8, dmg:70, r:1.4, cd:0.6 }, recoilK:0.25, atk:1.8, crit:0.18, fireK:0.85,
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
// Z259 PHOTO STONE (world/stone.js): env / ao strengths; per set the colour shown until the photo loads, the albedo × once it has (the scene's
//   exposure was tuned for darker procedural surfaces), the normal strength; pyramid = course height (m), texture tile (m), edge-strip depth (m),
//   share of edge strips cut short (ragged corners), share robbed out, where the smooth casing cap starts (× courses), its colour, tumbled blocks,
//   course tones (× the photo); rockTile = photo tiles per unit of a boulder's own size (triplanar); rockTint = albedo × on the boulders (their vertex
//   colours carry the battlefield's rock tint); hills = the far ranges' photo detail: aerial-photo tile (m) on gentle slopes, rock-face tile (m) on steep
//   ones, their mean brightness (the detail is brightness about 1), gain = its contrast, near = the detail strength × (1 − the ring's haze), the aerial set per battlefield
export const STONE = { env:0.5, ao:0.85, rockTile:0.55,
  sets:{ large_sandstone_blocks:{ fallback:0xc8a878, tint:[1.0, 0.89, 0.72], nrm:1.1 }, rock_face:{ fallback:0x6e6458, tint:[0.8, 0.76, 0.7], rockTint:[1.7, 1.7, 1.7], nrm:1.3 } },
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
// Z252 REAL COVER (world/real-props.js): the cover kinds that wear a Meshy model (the Czech hedgehog and the HESCO stay procedural), the share of the procedural
//   footprint they fill, the height cap (× the procedural height), environment-reflection strength; tint = albedo × for a piece whose texture came
//   out the wrong colour (logs grey, concrete white); matte = pieces of fabric / wood / concrete whose generated metal map must be ignored;
//   stretch = pieces filled to the footprint on each axis (the container came out nearly cubic)
export const REALPROP = { kinds:['sandbag','concrete','container','crates','drums','jersey','logs','pipes','teeth','tires','wreck'], fit:0.96, hMax:1.35, env:0.6,
  tint:{ logs:0xa07a52, pipes:0x9c9a92, teeth:0xa6a49c, concrete:0xb4b2aa, jersey:0xb4b2aa }, matte:['sandbag','logs','teeth','concrete','jersey','pipes'], stretch:['container'] };
// Z251 GRASS CARPET (world/grass-carpet.js): blades round the camera on grassy battlefields — radius (m; Rm on phones, mobile:false = none there), grid cell (m),
//   where (× radius) the carpet starts thinning out, clumps tried per cell, blades per clump, blade half-width at the root (m), clump height range (m), how far ahead of the camera the carpet centres (m), re-lay step (m);
//   per battlefield: density (0–1) and colours [root, tip, dry tips]
export const GRASS = { R:26, Rm:12, rim:0.45, mobile:true, cell:0.6, perCell:2, blades:9, bladeW:0.042, h:[0.3, 0.6], ahead:8, step:1.5,
  biomes:{ MEADOW:{ dens:0.92, col:[0x243c14, 0x5f8a30, 0x98a052] }, HILLS:{ dens:0.8, col:[0x223a16, 0x5a8030, 0x94985a] },
    VILLAGE:{ dens:0.65, col:[0x2a3e16, 0x648a34, 0x9ea25a] }, SAVANNA:{ dens:0.75, col:[0x5a4c22, 0xb09a58, 0xd2bc80] } } };
// Z250 PHOTO GROUND (world/ground-photo.js): per battlefield the photo-scanned CC0 sets (Poly Haven, fetched by tools/ground-photos.mjs) — [base, second]:
//   the base covers the field, the second shows through on steep faces, crater bowls and the field's bare patches. dual = how much the base is
//   blended with itself at another scale (breaks the tiling); nrm = normal strength; altRep = the second layer's tile × the base's
export const GROUND_PHOTO = { dual:0.45, nrm:0.9, altRep:0.8, patchK:0.55,
  // albedo × per battlefield: the scene's sun and exposure were tuned for the darker procedural ground — a photo albedo needs bringing down
  tint:{ _:[0.58, 0.6, 0.54], MEADOW:[0.46, 0.62, 0.38], HILLS:[0.47, 0.6, 0.39], VILLAGE:[0.52, 0.6, 0.44], SAVANNA:[0.62, 0.58, 0.5], DESERT:[0.76, 0.64, 0.5],
    TUNDRA:[0.8, 0.83, 0.88], ARCTIC:[0.84, 0.87, 0.92], CITY:[0.66, 0.66, 0.66], FOUNDRY:[0.6, 0.58, 0.56], STEELMILL:[0.6, 0.58, 0.56] },
  biomes:{
  MEADOW:['leafy_grass','brown_mud_02'], HILLS:['leafy_grass','rock_ground'], VILLAGE:['grass_path_2','brown_mud_02'], SAVANNA:['dry_ground_01','dry_ground_rocks'],
  DESERT:['aerial_sand','sandy_gravel'], TUNDRA:['snow_01','rock_ground_02'], ARCTIC:['snow_01','dark_rock'], VOLCANO:['burned_ground_01','dark_rock'],
  QUARRY:['gravel_ground_01','rock_ground'], FOUNDRY:['gravel_road','asphalt_02'], STEELMILL:['gravel_road','asphalt_02'], CITY:['asphalt_02','concrete_floor_damaged_01'],
  CITADEL:['gravel_floor','dirt'], RUINS:['dry_ground_rocks','concrete_rock_path'], CAVERN:['rock_ground_02','brown_mud_rocks_01'] },
  extra:['large_sandstone_blocks','rock_face','aerial_grass_rock','aerial_rocks_02'] };   // Z259 not floors: the pyramids' limestone courses and the cliff / hill rock (world/stone.js)
// Z249 REAL INFANTRY (actors/real-troops.js): material roughness; Z254 seamInset = how far (rig units) a seam triangle's copy sits inside the next part;
//   team = albedo × per side (ours a cooler green cast, theirs a warmer red one); the old rig's helmet-top height (rig units) the real man is sized to; the troop carbine:
//   length (m), pistol-grip point (model units, +X to the stock), how far past the wrist bone the palm closes on it (m), bore height (model units);
//   stretch = [×, min length]: a triangle the pose made that many times longer than at rest (and longer than that, rig units) is dropped as a sliver; anchor = offsets (rig units) from the
//   right / left upper-arm and upper-spine bones to where an RPG, a slung AT tube and the pack-borne kit sit
export const REALTROOP = { rough:0.85, top:1.62, stretch:[2, 0.05], seamInset:0.004, team:{ f:[0.9, 1.0, 0.86], e:[1.08, 0.93, 0.84] }, anchor:{ shoulderR:[0, 0.1, 0.06], shoulderL:[0, 0.09, -0.04], back:[0, -0.02, -0.24] }, gun:{ len:0.84, grip:[0.205, -0.07, 0], palm:0.07, boreY:0.045 } };
export const REALCAV = { opH:1.84, seat:[0, 1.80, -0.15], seatBone:'spine_04', carbine:{ len:0.86, grip:[0.205, -0.07, 0], muzzle:[-0.476, 0.045, 0] },
  horseV:{ Walk:1.6, Canter:6.0, Sprint:13.2 }, footV:{ walk:1.2, run:2.1, charge:6.5, crouch:1.6 }, fade:0.22, twistMax:1.3, pitch:[0.06, 0.3], proneDrop:0.15, hitT:0.7, hitK:0.85 };   // Z254 hitT / hitK = how long the upper-body flinch of a hit lasts (s) and how much of it shows
// Z243 shield pylon SITES (round the general): metres clear of our citadel's wall ring (coreGap) / a fortress (fortGap) / any wall, cover or building (clear) /
//   the fence (edge) / each other (apart); rings = radii tried (× pylon.ring), steps = angles tried per ring; pillar = height of the light pillar (m)
export const PYLON_SITE = { coreGap:14, fortGap:10, clear:4, edge:8, apart:16, rings:[1,1.35,0.8,1.7], steps:16, pillar:60 };
//   Z244 CLEAR AIR: no milky veil — the grade's shadow lift goes (liftK 0: blacks stay black, shadows stay deep), the split-tone tints halve (tintK),
//   the haze is thinner again and tinted sky-blue instead of whitened (fogBlue = share of the zenith colour, no white mix), crisper contrast + sharpening
export const LIGHT = { tone:'agx', expK:1.0, sunK:1.35, hemiK:0.55, ambient:0.03, envK:0.6, conK:1.12, satK:1.12, vib:0, fogK:0.4, nightHemiK:0.8, flora:[0.8,0.84,0.72],
  liftK:0, tintK:0.5, fogBlue:0.22, bloom:0.24, sharp:0.58, duskHemiK:0.85, duskAmbient:0.08 };   // sunset keeps more sky fill + its lift
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
export const TANK_DEATH = { blast:[0.1,0.22], pierce:[0.25,0.4], ice:[0.05,0.1], shock:[0.35,0.5], frag:[0.4,0.55], spark:[0.5,0.7], fire:[0.45,0.65], wreck:[9,13] };   // Z189 wrecks burn for a while: the field fills with burning hulks and smoke columns
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
export const INTRO = { cullR:85, bigR:40, fog:0.0095, compileWait:2500, skipGuard:0.35 };
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
  ['fire','Bắn (giữ = liên thanh) · chuột trái','CHIẾN ĐẤU',[],7,1], ['dash','Lướt né','CHIẾN ĐẤU',[' '],0,0], ['skill','Dùng kỹ năng · chuột phải','CHIẾN ĐẤU',['e'],6,0], ['skillNext','Đổi kỹ năng','CHIẾN ĐẤU',['q'],2,0],
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
// Z229 WIND ON THE LAND — dust devils (and snow devils / leaf whirls) that spin up at random, wander with the wind and die away;
//   avalanches that pour off the mountains onto the snow battlefields.
export const WHIRL = { first:[5,12], every:[14,34], max:2, maxMobile:1, life:[13,24], dist:[20,55], speed:[2.2,5.2], R:[0.9,1.9], H:[8,15],
  grains:120, puffs:30, grainsMobile:55, puffsMobile:12, spin:[5.5,8.5], rise:[2.6,4.6], shove:5 };
export const AVALANCHE = { warn:2.6, width:30, run:[48,64], v0:3, vmax:15, accel:5, band:3.2, dmg:{ inf:80, veh:30, player:14 }, push:9, mounds:14, moundLife:40 };
// Z230 GUN STATS — one model of what a gun really does in a fight (combat/gunstats.js), used by the arsenal, the shop and the power rating:
//   engage = typical fighting distance (fraction of reach, capped) · W = target width (tank / man) · rho = enemies per m² around an impact
//   (a loose battle line) · hitsCap = most targets one trigger pull is credited with · ref = the targets time-to-kill is quoted against
export const GUNSTAT = { engage:{ frac:0.65, max:22 }, W:{ tank:3.2, man:0.9 }, rho:1/50, hitsCap:3, pierceK:0.3, lineW:3.4,
  ref:{ tank:'heavy', light:'grunt' }, minHit:0.3 };
