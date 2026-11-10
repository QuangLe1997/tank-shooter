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
  up:     { damage:0.08, boss:0.12, range:0.10, reload:0.12, mag:0.15, hp:20, armor:0.06, engine:0.10, turbo:0.12, ramplate:0.25, ramguard:0.12 },
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
  squad:{ fromWave:2, base:0.6, perWave:0.3, perStage:0.4, size:[4,6], rpgFrom:2, maxOnField:22, maxMobile:14 },   // Z104 more men on the wider field
  crushSpeed:3.5, crushBonus:50, bail:0.7,
  coverThreat: 20, coverSearch: 12,   // Z104 a rifleman who sees a tank this close runs for the far side of the nearest cover
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
  { title:'CHIẾN DỊCH BÃO CÁT', code:'SANDSTORM', obj:'depot', script:{ 2:'ambush', 4:'column' },
    story:'Rạng sáng, Liên minh Hắc Thiết vượt biên dưới màn bão cát. Tiền đồn Sao Đỏ chỉ còn một Lõi năng lượng — và Đại đội Thép 7 của anh.',
    brief:'Thiết giáp địch đang tập kết sau đồi cát. Giữ Lõi, đốt kho nhiên liệu đang tiếp sức cho đoàn xe của chúng.',
    radio:{ 1:'Phát hiện địch phía trước — thiết giáp trong đồi cát!', 2:'Bộ binh đang băng qua bãi trống. Cán qua chúng!', 3:'Trinh sát báo: chúng có một chỉ huy tên "Bò Thép".', 4:'Đoàn thiết giáp trên đường phía đông!', 5:'Đợt cuối trước khi xe chỉ huy của chúng tới. Giữ vững!' },
    boss:'IRON BULL đang lao tới. Nó húc rất mạnh nhưng ngu — dụ nó đâm vào tường gạch hay đá, nó sẽ choáng. Bắn vào đuôi xe!',
    win:'Kho nhiên liệu cháy rồi — xe tăng của chúng sắp cạn xăng!' },
  { title:'CHIẾN DỊCH THÀNH PHỐ ĐỔ NÁT', code:'BROKEN CITY', obj:'radio', script:{ 2:'pyro', 4:'ambush' },
    story:'Bò Thép gục ngã, nhưng từ thành phố đổ nát phía bắc, một trạm tiếp sóng vẫn liên tục gọi viện binh Hắc Thiết đổ về.',
    brief:'Đống đổ nát che một trạm tiếp sóng gọi viện binh không ngừng. Bịt miệng nó, rồi dọn sạch các con phố.',
    radio:{ 1:'Có chuyển động trong đống gạch vụn.', 2:'Xe phun lửa! Giữ khoảng cách!', 3:'Bắt được sóng địch: chỉ huy TEMPEST đang dẫn đội tên lửa tới.', 4:'Tổ RPG trong hẻm — coi chừng rocket!', 5:'Trạm tiếp sóng vẫn phát? Hạ nó ngay!' },
    boss:'TEMPEST đang lượn quanh quảng trường. Hai bệ tên lửa hai bên tháp pháo là mắt xích yếu — bắn nát chúng, thả khói khi bị khoá!',
    win:'Trạm tiếp sóng đã sập — viện binh của chúng im bặt.' },
  { title:'CHIẾN DỊCH IM LẶNG TRẮNG', code:'WHITE SILENCE', obj:'radar', script:{ 3:'airraid', 5:'column' },
    story:'Tín hiệu cuối của TEMPEST dẫn về vùng băng giá: một trạm radar đang dẫn đường cho trực thăng tấn công. Đây là nơi Hắc Thiết giấu cỗ xe pháo đài GOLIATH.',
    brief:'Trạm radar trên băng đang dẫn trực thăng vào đội hình ta. Phá nó để giành lại bầu trời.',
    radio:{ 1:'Tầm nhìn kém. Tập trung cao độ.', 2:'Băng nứt khắp nơi — đừng để bị dồn vào góc.', 3:'Tiếng cánh quạt — trực thăng vũ trang!', 4:'Công binh đang hàn xe cho chúng. Diệt công binh trước!', 5:'Đoàn xe hạng nặng vượt băng!' },
    boss:'GOLIATH đã chọc thủng tuyến băng. Giáp trước của nó gần như không xuyên nổi — vòng ra sau lưng mà đánh!',
    win:'Radar thành sắt vụn. Hết trực thăng trên đầu ta.' },
  { title:'CHIẾN DỊCH LÒ LỬA THÉP', code:'IRON FURNACE', obj:'battery', script:{ 2:'column', 4:'airraid' },
    story:'Giữa tro tàn của GOLIATH, ta tìm thấy bản đồ: Hắc Thiết đúc xe ngay trong khu lò luyện, có pháo binh canh giữ — và REAPER, sát thủ tàng hình của chúng.',
    brief:'Một trận địa pháo trong khu lò đúc đang nã vào phòng tuyến ta. Luôn di chuyển, và đánh sập những khẩu pháo đó.',
    radio:{ 1:'Đạn pháo đang tới — di chuyển liên tục!', 2:'Thiết giáp tràn ra từ các xưởng lò!', 3:'REAPER có thể dịch chuyển. Đừng đứng yên một chỗ.', 4:'Không kích! Tìm chỗ nấp!', 5:'Xe diệt tăng trên sườn đồi — bị khoá laser thì thả khói.' },
    boss:'REAPER đang trong lò rèn. Tia laser của nó không xuyên tường — nấp sau tường gạch khi nó nạp năng lượng!',
    win:'Trận địa pháo đã câm. Pháo kích ngừng rồi.' },
  { title:'CHIẾN DỊCH THÀNH LUỸ CUỐI', code:'LAST CITADEL', obj:'command', script:{ 1:'ambush', 3:'airraid', 5:'column' },
    story:'Hầm chỉ huy của Hắc Thiết nằm sau thành luỹ cuối cùng. OVERLORD — kẻ khơi mào cuộc chiến — đang chờ. Kết thúc nó, và chiến tranh kết thúc hôm nay.',
    brief:'Đây là hầm chỉ huy của chúng. Mọi thứ còn lại của Hắc Thiết dồn cả về đây. Phá nó, chiến tranh sẽ kết thúc.',
    radio:{ 1:'Chúng đã chờ sẵn — phục kích!', 2:'Giữ Lõi. Bằng mọi giá.', 3:'Toàn bộ trực thăng của chúng đã cất cánh!', 4:'Đại đội Thép 7, cả nước đang dõi theo các anh.', 5:'Đoàn xe cuối cùng. Chính là lúc này.' },
    boss:'OVERLORD ra trận. Nó có khiên năng lượng nhờ các trụ phát — phá trụ rồi dồn hoả lực. Kết thúc nó!',
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
  {key:'damage', cat:'FIREPOWER', icon:'burst',  name:'SÁT THƯƠNG',       per:'+8% sát thương đạn', costs:[{c:300},{c:800},{c:2000},{d:14},{d:26}]},
  {key:'boss',   cat:'FIREPOWER', icon:'shell',   name:'ĐẦU ĐẠN',      per:'+12% sát thương lên tướng',  costs:[{c:400},{c:1100},{c:2600},{d:15},{d:28}]},
  {key:'range',  cat:'FIREPOWER', icon:'target', name:'NÒNG DÀI',  per:'+10% tầm bắn',   costs:[{c:250},{c:700},{c:1700},{d:12},{d:22}]},
  {key:'reload', cat:'AMMO',      icon:'mag',    name:'NẠP NHANH',  per:'−12% thời gian nạp',  costs:[{c:300},{c:800},{c:2000},{d:14},{d:26}]},
  {key:'mag',    cat:'AMMO',      icon:'mag',    name:'BĂNG ĐẠN LỚN', per:'+15% băng đạn',     costs:[{c:250},{c:700},{c:1700},{d:12},{d:22}]},
  {key:'hp',     cat:'CHASSIS',   icon:'heart',  name:'BỌC THÂN XE', per:'+20 máu tối đa',        costs:[{c:300},{c:800},{c:2000},{d:14},{d:26}]},
  {key:'armor',  cat:'CHASSIS',   icon:'shield', name:'GIÁP',        per:'−6% sát thương nhận',  costs:[{c:400},{c:1000},{c:2500},{d:16},{d:30}]},
  {key:'engine', cat:'CHASSIS',   icon:'dash',   name:'ĐỘNG CƠ',    per:'+10% tốc độ',   costs:[{c:250},{c:700},{c:1700},{d:12},{d:22}]},
  {key:'turbo',  cat:'CHASSIS',   icon:'dash',   name:'TĂNG ÁP TURBO', per:'+12% gia tốc',  costs:[{c:400},{c:1000},{c:2400}]},
  {key:'ramplate',cat:'CHASSIS',  icon:'shield', name:'MŨI HÚC',    per:'+25% sát thương húc · −12% chịu húc', costs:[{c:500},{c:1200},{c:2800}]},
  // ----- SUPPORT units: buy & upgrade the guard squad and the escort drone -----
  {key:'guards',   cat:'SUPPORT', icon:'shield', name:'LÍNH GÁC LÕI',   per:'+1 lính gác Lõi',          costs:[{c:900},{c:2400},{d:16}]},
  {key:'troops',   cat:'SUPPORT', icon:'up',     name:'LÍNH GÁC: HOẢ LỰC', per:'+22% sát thương lính gác',      costs:[{c:600},{c:1500},{d:12}]},
  {key:'guardRof', cat:'SUPPORT', icon:'dash',   name:'LÍNH GÁC: THAO LUYỆN',  per:'−10% thời gian nạp của lính gác',      costs:[{c:700},{c:1800},{d:12}]},
  {key:'guardArm', cat:'SUPPORT', icon:'heart',  name:'LÍNH GÁC: GIÁP',  per:'+18 máu mỗi lính gác',       costs:[{c:700},{c:1800},{d:12}]},
  {key:'crew',     cat:'SUPPORT', icon:'shield', name:'KÍP LÍNH XE',     per:'+1 lính trên xe',           costs:[{c:900},{c:2400},{d:16}]},
  {key:'dronePow', cat:'SUPPORT', icon:'drone',  name:'DRONE TẤN CÔNG',  per:'Mở drone hộ tống · +12% sát thương/cấp', costs:[{c:1500},{c:3200},{c:5000},{d:28},{d:40}]},
  {key:'droneRof', cat:'SUPPORT', icon:'dash',   name:'DRONE: CÁNH QUẠT', per:'−10% thời gian nạp drone',      costs:[{c:1200},{c:2800},{d:16}]},
  {key:'droneArm', cat:'SUPPORT', icon:'heart',  name:'DRONE: BỌC GIÁP',per:'+40 máu drone',          costs:[{c:1200},{c:2800},{d:16}]},
];

// ----- gun unlocks. T1/T2/T3 in coins; railgun & rocket are VIP (diamonds only, never gifted in battle).
// VIP coin-equiv (28◆=5,600 / 34◆=6,800) sits ABOVE the best T3 coin gun (5,500) — value stays ordered. -----
export const GUN_PRICE = { smg:{c:500}, shotgun:{c:1400}, cryo:{c:1600}, flak:{c:1700}, cannon:{c:2000},
  flamer:{c:2200}, agl:{c:2600}, hesh:{c:3000}, mortar:{c:3800}, minigun:{c:4000}, missile:{c:4500}, tesla:{c:5000}, arty:{c:5500}, thermo:{c:5400}, railgun:{d:28}, rocket:{d:34} };
export const VIP_GUNS = ['railgun','rocket'];

// ----- punchy marketing blurbs (kept short) -----
export const GUN_BLURB = {
  rifle:'Bền bỉ, đa năng — không bao giờ kẹt đạn.', smg:'Cơn mưa đạn dữ dội ở cự ly gần.',
  shotgun:'Tàn phá cự ly gần — tám viên chì, một lần bóp cò.', flak:'Mảnh đạn nổ tung xé nát cả bầy.',
  cannon:'Một phát đạn khổng lồ. Giáp dày cũng phải gập.', cryo:'Đóng băng chúng — rồi đập vỡ vụn.',
  minigun:'Nòng xoay không ngừng, lửa không ngừng. Giữ vững phòng tuyến.', missile:'Khoá mục tiêu. Nó tự săn. Không bao giờ trượt.',
  tesla:'Sét nhảy từ kẻ địch này sang kẻ địch khác.', railgun:'Một phát xuyên thủng cả đoàn xe.',
  rocket:'Phóng một quả — cả khu vực biến mất.',
  arty:'Đạn pháo hạng nặng rơi đúng điểm đánh dấu — phá tường, nổ ngay khi chạm đất.',
  mortar:'Bắn vòng qua mọi bức tường — cối bắn nhanh, nổ khi chạm đất.',
  flamer:'Thiêu rụi chúng — lửa chỉ lan rộng, không bao giờ buông tha.',
  hesh:'Đạn đầu bẹt — san phẳng công sự, quật đổ tháp canh, nứt giáp trung bình.',
  agl:'Mưa lựu đạn 40 mm — bộ binh và xe nhẹ tan tác.',
  thermo:'Rocket nhiệt áp: một vụ nổ chói loà, mọi thứ bên trong bốc cháy.' };
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
  accel: 19,          // peak tractive acceleration once rolling (Z99: 34→23; Z107: 23→19 — no mid-range surge)
  launch: 0.7,        // share of that available from a dead stop (Z107: 0.32→0.7 — moves off at once, no 50-t creep)
  launchV: 6,         // speed by which full power has come in
  reverseMul: 0.5,    // reverse top speed / accel vs forward
  reverseAngle: 2.25, // push the stick this far (rad) behind the hull → back up instead of pivoting round
  coast: 32,          // rolling resistance with the throttle off (Z107: 14→32 — settles in ~0.7 s / 8 m, was 1.6 s / 19 m)
  coastLin: 0.45,     // extra resistance per unit of speed while coasting (Z107: 0.12→0.45)
  brake: 62,          // braking against the motion (Z107: 44→62)
  slopeSlide: 9,      // pull down into hollows/craters (Z107: 14→9 — less drifting on bumpy ground)
  pivot: 2.6,         // hull turn rate standing still (neutral steer, rad/s) — Z99: steadier for A/D steering
  turnAtSpeed: 1.55,  // hull turn rate at top speed — wide arcs when flat out
  grip: 14,           // sideways track grip — kills lateral slide (Z107: 10→14)
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
  bowlTint: [0.66, 0.56, 0.47], earth: [0.5, 0.36, 0.24], selfShadow: true };   // tint multipliers (rgb); earth = raw soil exposed on steep faces

// Z104 INFANTRY LETHALITY — a soldier is soft: ONE round from a tank gun kills him (rifles still trade hits),
//   and a blast kills outright inside its core (core × radius) and wounds — fading — out to reach × radius.
export const LETHAL = { tankRoundKills: true, core: 0.45, reach: 1.25, edgeMin: 0.25 };

// Z104 MOBILE AIM — phones have no mouse, so the barrel is FIXED to the hull: the tank shoots straight where it faces.
//   Auto-fire / rockets / mortar / artillery only take a target inside this forward cone (half-angle in rad) or lane (world units).
export const AIM = { mobileFixed: true, cone: 0.17, lane: 1.8, artyCone: 0.32,
  pivotOnly: 0.38 };   // a LIGHT push of the stick only turns the hull on the spot (aim without driving off); push further to drive

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
  look: { scale: 1.85, barY: 3.6 },   // Z104 every foot soldier (ours + theirs) at the same, slightly bigger size; HP bar height above them
};

// Z104 SQUAD AI — our soldiers fight on their own across the whole field (no longer leashed to the tank's ring).
//   Priorities each re-plan: recall (only men inside the ring answer) → carry loot home → take cover from enemy armour →
//   fight infantry / tower guards → fetch loot → depot / POW jobs → advance on the nearest enemy → regroup on the tank.
export const SQUAD = {
  think: 0.4,                                  // seconds between re-plans (staggered per soldier)
  huntR: 62,                                   // with nothing in sight they advance on the nearest enemy within this
  cover: { threat: 20, search: 13 },           // enemy armour this close → run for the far side of a wall / rock / sandbags within `search`
  guardHit: 0.32,                              // chance one rifle shot drops a guard up on a watchtower
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
export const POW = { perStage: [1, 1, 2, 2, 2], r: 9, prisoners: [3, 5], guards: [3, 4], guardsMobile: [2, 3], freeR: 10, score: 600, coin: 120 };
export const DEPOT = { arms: [1, 1, 1, 1, 1], motor: [1, 1, 1, 1, 1], r: 10, guards: [4, 5], guardsMobile: [3, 3], capT: 4, tanks: [1, 2], score: 800, coin: 150 };
export const ALLY_TANK = { hp: 260, speed: 9.5, turn: 1.9, sight: 46, range: 30, keep: 15, leash: 58, dmg: 30, fireCd: 1.7, bspeed: 72, cap: 3 };
// Z104 PARATROOPERS — an enemy transport helicopter crosses the field every so often and drops a stick of paratroopers
export const PARA = { fromStage: 1, fromWave: 2, every: [42, 62], everyMobile: [55, 80], troops: [4, 6], troopsMobile: [3, 4], alt: 19, speed: 15, fall: 3.6, gap: 0.45, rpgFrom: 3 };

// BATTLEFIELD INSTALLATIONS (Z90) — enemy troop camps that keep feeding infantry, and rope bridges linking paired watchtowers.
export const CAMP = { perStage: [2, 2, 2, 3, 3], hp: 420, hpPerStage: 0.18, every: 16, squad: [2, 4], infCap: 22, coin: 220, score: 900, tentScore: 60 };
export const BRIDGE = { pairChance: 0.75, minD: 12, maxD: 18, patrolSpeed: 1.6 };

// LOOT (Z93) — engine & armour pickups, stacking rules and where the good stuff hides.
// STACKING: picking a buff you already have EXTENDS it by `extendShare` of its duration (never past `maxDurMul`× a full timer) —
// it never multiplies its own power. TURBO and ERA are the only LEVEL/CHARGE stacks (capped). Different buffs combine, but every
// speed source (OVERDRIVE spell × ENGINE pickup × ENGINE shop) is clamped to `speedCap` so the tank never becomes uncontrollable.
export const LOOT = {
  rules: { extendShare: 0.5, maxDurMul: 1.5, speedCap: 1.7 },
  speed: { dur: 22, top: 1.3 },                                              // ENGINE OVERDRIVE: +30% top speed & pull
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
export const WEATHER = {
  clear:{ vi:'QUANG ĐÃNG', icon:'sun',  fogK:1,   sunK:1,    hemiK:1,    tint:null,     n:[0,0],     range:1 },
  rain: { vi:'MƯA GIÔNG',  icon:'rain', fogK:1.7, sunK:0.5,  hemiK:0.82, tint:0x8a96a2, n:[1100,420], range:0.92, wet:0.42, bolt:[7,16] },
  sand: { vi:'BÃO CÁT',    icon:'sand', fogK:2.7, sunK:0.62, hemiK:0.9,  tint:0xc9a06a, n:[900,360],  range:0.85 },
  snow: { vi:'TUYẾT RƠI',  icon:'snow', fogK:1.6, sunK:0.78, hemiK:1.05, tint:0xd4dde6, n:[1000,400], range:0.95 },
  fog:  { vi:'SƯƠNG MÙ',   icon:'fog',  fogK:3.4, sunK:0.66, hemiK:0.95, tint:0xc4c8cc, n:[0,0],     range:0.82 },
};
// SPACE — how much of the arena the fence encloses (custom battles); the campaign always fights on the full field
export const SPACE = { small:{ vi:'HẸP', k:0.72, tx:'đánh giáp lá cà' }, mid:{ vi:'VỪA', k:0.86, tx:'cân bằng' }, wide:{ vi:'RỘNG', k:1, tx:'cơ động, bắn xa' } };
// Z107 HULL FRONT MARKER — at speed the hull's heading is hard to read from above: a glowing chevron on the ground just ahead of the nose
//   (brighter while moving, dim at rest) + a bright stripe across the upper glacis. dist/size in hull units (× TANK_SCALE).
export const HEADING = { dist: 3.9, size: 2.4, color: 0x9be04a, idle: 0.32, moving: 0.8, stripe: 0xd8ff6a };
