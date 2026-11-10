# KIẾN TRÚC MÃ NGUỒN — STEEL SIEGE (Z98 · Z103)

> Tài liệu này là **luật** cho mọi thay đổi mã. Đọc §4 (Quy tắc) và §5 (Công thức) trước khi thêm súng / địch / tướng / màn / truyện.
> Kiểm tra tự động: **`npm test`** (cú pháp mọi module → luật kiến trúc R1–R7, R12 → kiểm tra phạm vi sâu R8–R11 → 1.000+ test dữ liệu & cân bằng).
> Lần đầu trên máy mới: **`npm install`** (chỉ cài công cụ kiểm tra `acorn` + `eslint-scope`; game vẫn zero-build, không nạp gì từ `node_modules`).

---

## 1. Đánh giá cấu trúc cũ (trước Z98)

| Chỉ số | Giá trị | Hệ quả |
|---|---:|---|
| `index.html` | 7.689 dòng · 764 KB | một file chứa HTML + 1.074 dòng CSS + 6.623 dòng JS |
| Hàm cấp đỉnh | 563 | tất cả dùng chung một phạm vi — sửa một tên có thể đè tên khác |
| Biến cấp đỉnh (`const` / `let`) | 268 / 95 | trạng thái toàn cục rải khắp file |
| Câu lệnh chạy ngay khi tải | 272 | **thứ tự dòng = thứ tự khởi tạo** — chuyển một đoạn lên/xuống là có thể vỡ ngầm |
| Khu vực (section) | 111 | ranh giới chỉ là comment, không có gì cưỡng chế |
| Tham chiếu chéo giữa khu vực | 4.031 (1.144 cặp) | mọi thứ phụ thuộc mọi thứ |
| Biến bị **ghi** từ khu vực khác | 15 biến · 25 chỗ | `boss`, `BIOME`, `muted`, `soldierLvl`, `ridersUnlocked`… — nguồn lỗi chéo khó lần |
| Bảng dữ liệu (súng, địch, tướng, biome) | nằm lẫn trong logic | **không test được bằng node**; thêm súng quên một chỗ → vỡ khi chạy |

**Kết luận**: chạy được, nhưng mỗi thay đổi đều phải "nhớ" toàn bộ 7.700 dòng; không có cơ chế nào ngăn xung đột chéo; không thể tái dùng logic cho máy chủ.

---

## 2. Cấu trúc mới

```
index.html            ← CHỈ markup (≈340 dòng): <link> css, importmap, <script src>
css/                  ← 8 file, nạp ĐÚNG THỨ TỰ (thứ tự = độ ưu tiên cascade)
  base · hud · menus · shop · cinematic-mobile · boot-home · theme · polish
config.js             ← SỐ CÂN BẰNG (BALANCE, DRIVE, LOOT, TACTICS, BOSSFIGHT, OPERATIONS, …) — thuần dữ liệu
src/
  main.js             ← entry: import './hub.js'
  hub.js              ← DUY NHẤT nơi quyết định thứ tự chạy các module (export * theo thứ tự)
  boot/               ← script cổ điển chạy trước khi vẽ (viewport, safety net)
  data/               ← REGISTRY thuần: súng, địch, tướng, biome, chữ tiếng Việt, thông số xe
  core/ render/ audio/ world/ tank/ fx/ combat/ actors/ ai/ campaign/ loot/ input/ ui/ game/
  game/startup.js     ← GỐC KHỞI ĐỘNG (composition root): module hệ thống cuối cùng — nơi DUY NHẤT thực sự bật game
  dev/                ← móc kiểm thử window._* (Playwright, #dev) — gameplay không đọc; bản phát hành có thể bỏ
tools/
  verify.mjs          ← npm test: cú pháp + kiến trúc + test
  archcheck.mjs       ← luật kiến trúc R1–R7 (§4)
  where.mjs           ← npm run where -- <tên>: tìm module sở hữu một hàm/biến
  refactor/           ← công cụ tái cấu trúc an toàn (Z103, cần npm install) — §4.4
    deepcheck.mjs     ← luật R8–R11 bằng phân tích phạm vi (acorn + eslint-scope)
    move.mjs          ← npm run move: chuyển khai báo giữa module, tự sửa import + hub
    fix-imports.mjs   ← npm run imports: tính lại dòng import hub của mọi module
    modmap.mjs        ← npm run modmap: sinh bảng §2.1 từ dòng đầu mỗi module
test.js               ← test cân bằng + HỢP ĐỒNG DỮ LIỆU (§4.3)
```

### 2.1 Danh mục module (96 module theo thứ tự hub · 7.847 dòng)

<!-- MODULES:BEGIN (npm run modmap) -->
| # | Module | Dòng | Nội dung |
|---:|---|---:|---|
| | **data/** — DỮ LIỆU THUẦN (registry) — không logic, test được bằng node | | |
| 1 | `src/data/world.js` | 37 | TIME OF DAY: each stage fights at a different hour — morning · harsh noon · golden sunset · moonlit night un… |
| 2 | `src/data/text-vi.js` | 9 | Vietnamese player-facing labels: time of day, difficulty, stage tags, biome & shop-category names |
| 3 | `src/data/player.js` | 8 | PLAYER tank handling constants (accel, speed, dash, turn, base combat range) |
| 4 | `src/data/guns.js` | 26 | GUNS registry: damage type, damage, fire rate, magazine, reload, projectile per gun |
| 5 | `src/data/enemies.js` | 33 | ENEMY_DEFS registry: hp, speed, score, scale, weapon and role per enemy type |
| 6 | `src/data/bosses.js` | 32 | BOSS (Z96 rework) |
| | **core/** — Hằng số runtime, trạng thái, hồ sơ, tiện ích | | |
| 7 | `src/core/config.js` | 27 | runtime constants derived from config + device: arena size, MOBILE, tank scale, player palette, current BIOME |
| 9 | `src/core/state.js` | 19 | S — the single runtime game state (mode, stage, wave, score, player, spell, recall …) |
| 82 | `src/core/helpers.js` | 63 | shared helpers: control scheme + tank input → move direction, main HUD refresh, world-space HP bars |
| 86 | `src/core/profile.js` | 86 | PLAYER PROFILE (nickname · arsenal · loadout · campaign save) |
| | **render/** — Three.js renderer + hậu kỳ | | |
| 10 | `src/render/renderer.js` | 117 | THREE SETUP |
| | **audio/** — Âm thanh tổng hợp | | |
| 29 | `src/audio/synth.js` | 224 | AUDIO (Web Audio synth) |
| 30 | `src/audio/engine-music.js` | 80 | DIESEL ENGINE + TRACK CLATTER (player): idle burble → roar under load; climbing a mound makes it SCREAM, coa… |
| | **world/** — Bản đồ: địa hình, khí quyển, vật cản, công trình | | |
| 11 | `src/world/atmosphere.js` | 57 | Z97 VISIBLE SKY: a real gradient dome (zenith → horizon haze that melts into the fog), sun glow by day, moon… |
| 12 | `src/world/ground.js` | 97 | ARENA ground: procedural ground maps per biome, macro variation + patch textures (cached) |
| 13 | `src/world/heightfield.js` | 107 | HEIGHTFIELD: rolling mounds, shell craters & wind drifts; everything (tanks, props, shells, particles) sits … |
| 14 | `src/world/decals.js` | 62 | GROUND SCARS: tread marks (fade over time) + scorch/craters/impact dirt (permanent per stage) painted into a… |
| 15 | `src/world/props.js` | 141 | BATTLEFIELD PROPS (procedural, merged geometry, cached) |
| 16 | `src/world/perimeter.js` | 65 | perimeter: concrete jersey barriers (instanced) topped with concertina razor wire on steel pickets |
| 17 | `src/world/decor.js` | 59 | TERRAIN DECOR (ambient scatter: rocks · grass · ice · slag · rubble) |
| 18 | `src/world/physics.js` | 101 | PHYSICS: oriented hull boxes (SAT) — tanks touch for real, shove by mass, slide with friction, never overlap |
| 19 | `src/world/biome.js` | 25 | Z103 split from world/physics.js: apply a battlefield biome (ground maps, terrain, sky, perimeter, |
| 20 | `src/world/cover.js` | 103 | TERRAIN BLOCKS (cover) |
| 21 | `src/world/brick-walls.js` | 132 | Z86 RUINED BRICK WALLS — tall, shell-torn, never whole; ram them down at speed |
| 48 | `src/world/towers.js` | 112 | WATCHTOWERS: wood towers with guards who fire plunging rounds + night searchlights; shoot them down to colla… |
| 49 | `src/world/camps.js` | 101 | Z90 · ENEMY TROOP CAMPS — a Quonset barracks, canvas tents, sandbag ring, flag & cookfire; squads keep pouri… |
| 50 | `src/world/zones.js` | 37 | Z104 BATTLEFIELD PLAN: reserves ground for the rally point, POW stockades and depots before cover is scattered |
| 51 | `src/world/rally.js` | 29 | Z104 KHU TẬP KẾT (rally point): soldiers carry the loot they find back here; it waits (never expires) for th… |
| 52 | `src/world/pow.js` | 58 | Z104 POW STOCKADES along our fence: our captured men behind barbed wire, enemy guards around them. |
| 53 | `src/world/depots.js` | 73 | Z104 ENEMY DEPOTS in their half of the field: a WEAPON depot and a TANK depot (motor pool), each with a guar… |
| 54 | `src/world/bridges.js` | 52 | Z90 · ROPE BRIDGES between paired watchtowers — plank walkway on a catenary, rope handrails, a sentry patrol… |
| | **tank/** — Mô hình xe tăng, nòng, khiên, rig | | |
| 22 | `src/tank/materials.js` | 116 | procedural PBR textures for armour: welded panels (albedo/height/normal/rough), tracks, wheels, blob shadow |
| 23 | `src/tank/model.js` | 168 | shared tank geometries (built once; every tank references them) |
| 24 | `src/tank/rig.js` | 46 | living tank rig: track scroll + wheel spin (skid-steer aware), suspension pitch/roll, gun elevation, recoil … |
| 25 | `src/tank/barrels.js` | 184 | per-gun barrel assemblies (real-world analogues): authored in TURRET space, hung off the gun pivot so they e… |
| 26 | `src/tank/shield.js` | 56 | premium energy SHIELD: hex force-field + rim glow + orbiting rings (animated in the loop) |
| | **fx/** — Hiệu ứng hình ảnh | | |
| 27 | `src/fx/hud-fx.js` | 43 | FX (rings, float text, screen) |
| 28 | `src/fx/particles.js` | 87 | PARTICLES (juice) |
| 32 | `src/fx/fire-wrecks.js` | 74 | REAL FIRE / FLASH / WRECKS |
| 55 | `src/fx/dying.js` | 17 | KNOCKED-OUT tanks: engine dies, fire bursts from the hatches with thick black smoke, a few rounds pop… then … |
| 58 | `src/fx/explosions.js` | 70 | COMBAT FX / EXPLOSIONS (juiced in P4) |
| 59 | `src/fx/debris.js` | 96 | Z103 split from fx/explosions.js: flying hull fragments (pooled) and the charred multi-part tank WRECK. |
| | **combat/** — Vũ khí, đạn, kỹ năng | | |
| 31 | `src/combat/projectiles.js` | 22 | PROJECTILES |
| 33 | `src/combat/lock-on.js` | 150 | MISSILE LOCK-ON — a hi-tech targeting reticle that snaps onto the locked target |
| 63 | `src/combat/abilities.js` | 19 | ABILITIES (stubs filled in later phases) |
| 64 | `src/combat/guns.js` | 107 | ARMS DOCTRINE helpers: damage class × armour, range falloff, battlefield conditions, smart gun pick |
| 65 | `src/combat/aim.js` | 18 | Z104 aim policy: desktop aims with the mouse; MOBILE has the barrel FIXED to the hull (shoot where you face) |
| 66 | `src/combat/siege-rocket.js` | 130 | SIEGE ROCKET: a lobbed shell that plants a 2s fuse on landing, then wipes a big radius |
| 67 | `src/combat/flame.js` | 184 | continuous FLAME JET: one cohesive COLUMN of fire (a flamethrower stream, not scattered sparks) |
| 68 | `src/combat/mastery.js` | 19 | GUN MASTERY: duplicate pickups level a gun up (permanent, per-gun). Boosts dmg / fire-rate / reload. |
| 69 | `src/combat/spells.js` | 86 | SPELLS (one equipped; cast on cooldown) |
| | **actors/** — Đơn vị trên sân (địch, lính, drone, Lõi) | | |
| 34 | `src/actors/core.js` | 105 | CORE (base to defend) |
| 35 | `src/actors/enemies.js` | 150 | ENEMY tanks: spawn (roster, elites, carrier troops, loot), pooled meshes and floating HP bars |
| 36 | `src/actors/fireteam.js` | 209 | Z89/Z100 friendly FIRETEAM: the APC that brings them, free-roam inside the tank's combat zone, recall. |
| 37 | `src/actors/ally-tanks.js` | 63 | Z104 ALLIED TANKS: enemy tanks taken at a motor pool, driven by our soldiers. They pick their own fights |
| 38 | `src/actors/crew.js` | 31 | Z89/Z100 YOUR CREW command: tap = riders jump down and fight, hold = recall everyone on foot, + the crew but… |
| 40 | `src/actors/infantry.js` | 116 | Z79 · ENEMY INFANTRY — riflemen & RPG teams on foot. They fan out, take pot-shots, kneel to fire rockets… |
| 41 | `src/actors/enemy-missiles.js` | 58 | ENEMY ROCKETS & GUIDED MISSILES — real objects in flight: dodge them, SHOOT THEM DOWN, or blind them with sm… |
| 42 | `src/actors/vehicles.js` | 152 | Z80 enemy VEHICLES: flame tank, ATGM tank-destroyer, engineer repair truck, attack gunship, APC dismount (Z89) |
| 43 | `src/actors/paradrop.js` | 57 | Z104 PARATROOPERS: every so often an enemy transport helicopter crosses the field and drops a stick of |
| 47 | `src/actors/damage.js` | 40 | HARD TANK SEPARATION: tanks never overlap; a bump knocks the other away |
| 88 | `src/actors/drone.js` | 118 | SUPPORT DRONE (power-up) |
| 90 | `src/actors/soldiers.js` | 144 | infantryman: jointed legs (walk cycle), plate carrier + pouches, covered helmet w/ NVG mount, gloves, boots,… |
| 91 | `src/actors/riders.js` | 44 | TANK RIDERS: riflemen on the hull roof — spawn, fire from the tank, take hits, heal while riding (Z100) |
| | **ai/** — Trí tuệ địch | | |
| 45 | `src/ai/tactics.js` | 173 | Z95 · TACTICAL DIRECTOR — the enemy fights as a unit: encircle, flank your rear, hold range, use cover, fall… |
| 46 | `src/ai/cover.js` | 14 | Z104 COVER: a soldier who sees a tank coming puts a wall, rock or sandbag line between it and himself (both … |
| | **campaign/** — Chiến dịch, đợt, tướng, pháo kích | | |
| 44 | `src/campaign/operations.js` | 127 | Z83 · CAMPAIGN OPERATIONS — named operation per stage: briefing, radio chatter, scripted waves and a high-va… |
| 56 | `src/campaign/waves.js` | 98 | WAVES: difficulty / NG+ loop multipliers, wave queue per stage, random wave events, edge spawn points |
| 57 | `src/campaign/boss.js` | 279 | BOSS FIGHT (Z96): weak-point parts, angle armour, multi-phase attacks, shield pylons, stuns, escorts |
| 70 | `src/campaign/artillery.js` | 145 | ENEMY ARTILLERY: spotter locks, mortar strike zones with warning markers, shrapnel hit vs miss |
| | **loot/** — Vật phẩm, rơi đồ, nâng cấp roguelite | | |
| 71 | `src/loot/powerups.js` | 154 | Z93 DROPS: the loot is a real object — it pops out of the wreck in an arc, bounces, raises dust, then sits u… |
| 72 | `src/loot/upgrades.js` | 62 | ROGUELITE UPGRADES (pick 1 of 3 after each boss) |
| 89 | `src/loot/beacons.js` | 32 | LOOT BEACONS (mark crates/tanks that hide a power-up) |
| | **input/** — Bàn phím, chuột, cảm ứng | | |
| 62 | `src/input/input.js` | 136 | INPUT: mouse aim raycast, keyboard, touch joysticks + action buttons, auto-fire |
| | **ui/** — Giao diện DOM (menu, shop, HUD phụ, gợi ý) | | |
| 8 | `src/ui/icons.js` | 78 | CUSTOM ICON SET (military line-art; no emoji) |
| 39 | `src/ui/tips.js` | 46 | Z94 · FIRST-TIME TIPS — the first time something new happens, the battle PAUSES and a short field note expla… |
| 73 | `src/ui/briefing.js` | 96 | STAGE BRIEFING: choose 1 of 3 contracts before the stage's waves begin |
| 74 | `src/ui/deploy.js` | 76 | Z105 DEPLOYMENT before every stage: troop strength, key points to post men at, how many ride the tank, |
| 76 | `src/ui/menus.js` | 30 | title screen: greeting + CONTINUE, nickname dialog, and the shared tap helpers (tapBtn / tapEl / escapeHtml). |
| 77 | `src/ui/terrain-picker.js` | 52 | Z103 split from ui/menus.js. TERRAIN PICKER — start-screen battlefield choice (AUTO campaign rotation or a f… |
| 78 | `src/ui/guide.js` | 41 | Z103 split from ui/menus.js. FIELD MANUAL — the how-to-play screen (first launch + re-openable) and the firs… |
| 79 | `src/ui/settings.js` | 23 | Z103 split from ui/menus.js. SETTINGS — difficulty · sound · music · quality · fullscreen. |
| 80 | `src/ui/loadout.js` | 39 | Z103 split from ui/menus.js. ARSENAL / LOADOUT — pick up to LOADOUT_MAX guns from the collection (from the s… |
| 81 | `src/ui/shop.js` | 276 | SHOP (buy guns + leveled upgrades with coins / diamonds) |
| 85 | `src/ui/radar.js` | 31 | RADAR / MINIMAP |
| 87 | `src/ui/alarm.js` | 12 | CORE-UNDER-ATTACK ALARM |
| | **game/** — Luồng game, vòng lặp, khởi động | | |
| 60 | `src/game/score.js` | 16 | SCORE / COMBO |
| 61 | `src/game/player-damage.js` | 103 | PLAYER DAMAGE / DEATH |
| 75 | `src/game/flow.js` | 93 | GAME FLOW: start / pause / quit-to-menu, loadout guns for the run, menu ↔ HUD state, show/hide panels |
| 83 | `src/game/update.js` | 179 | per-frame PLAYER update (drive, aim, fire), tank rigs, camera follow; Vietnamese label helpers |
| 84 | `src/game/intro.js` | 41 | INTRO CINEMATIC (deploy showcase) |
| 92 | `src/game/loop.js` | 88 | MAIN LOOP: per-frame update + render orchestration, frame pacing, ability cooldown dials |
| 93 | `src/game/viewport.js` | 28 | Z103 split from game/loop.js: canvas/render-target sizing, the soft-keyboard guard, landscape gate, |
| 94 | `src/game/boot-gate.js` | 64 | Z103 split from game/loop.js: the branded splash, real boot progress, sliced shader warm-up, |
| 95 | `src/game/startup.js` | 22 | Z103 COMPOSITION ROOT. Last system module in hub.js: everything is defined, so this is where the |
| | **dev/** — Móc kiểm thử / gỡ lỗi (không ảnh hưởng gameplay) | | |
| 96 | `src/dev/hooks.js` | 42 | Z103 split from game/loop.js: window._* inspection/driving hooks used by Playwright smoke tests and the |
<!-- MODULES:END -->

---

## 3. Cơ chế HUB — vì sao tách được mà không vỡ

1. Mỗi module **`export`** mọi khai báo cấp đỉnh của nó và **`import {…} from '../hub.js'`** những tên của module khác mà nó dùng.
2. `hub.js` là chuỗi `export * from './x.js'` **theo đúng thứ tự mã đã chạy khi còn một file**. Vì mọi module đều import hub (vòng tròn), trình duyệt đánh giá module **theo thứ tự trong hub** → hành vi khởi tạo giữ nguyên 100%.
3. Hàm được "hoist" khi liên kết module, nên gọi chéo lúc chạy luôn an toàn; chỉ **mã cấp đỉnh** mới phụ thuộc thứ tự — và thứ tự đó nằm ở một chỗ duy nhất.
4. Binding nhập khẩu là **chỉ đọc**. Biến nào cần đổi từ module khác thì module chủ cung cấp setter `__set_<tên>(v)` (ví dụ `BIOME`, `boss`, `muted`, `soldierLvl`, `ridersUnlocked`, `last`, …). Ghi trực tiếp từ nơi khác sẽ ném `TypeError` khi dòng đó chạy — **R10** (`npm test`) bắt trước, không đợi tới lúc chơi.
5. `data/*` đứng **đầu** hub và không import gì ngoài `config.js` → node đọc được → test được.
6. **Khai báo ≠ khởi động** (Z103): module hệ thống chỉ *định nghĩa* (hàm, bảng, pool, listener). Việc *bật game* (dựng Lõi, xe người chơi, áp cài đặt đã lưu, mở hộp thoại lần đầu, cổng boot, khung hình đầu) nằm trong **`game/startup.js`**, module hệ thống cuối hub. Muốn đổi cách game khởi động (vd. client mạng, chế độ thi đấu) → sửa ở đây, không rải vào hệ thống.

---

## 4. Quy tắc (BẮT BUỘC)

### 4.1 Luật được máy kiểm (`tools/archcheck.mjs`, chạy trong `npm test`)
| Mã | Luật |
|---|---|
| R1 | Module hệ thống chỉ import từ: `three`, `three/addons/…`, `config.js`, `data/*`, `hub.js`. **Không import thẳng module hệ thống khác** (giữ thứ tự ở một chỗ). |
| R2 | `data/*` **thuần**: không import hub, không three.js, không DOM / `window` / `localStorage`. |
| R3 | Mỗi module có mặt trong `hub.js` **đúng một lần**. |
| R4 | Tên export **duy nhất toàn dự án** (`export *` âm thầm bỏ tên trùng → lỗi rất khó thấy). |
| R5 | Module > 700 dòng → cảnh báo, tách tiếp. |
| R6 | Mọi `data/*` đứng trước module hệ thống đầu tiên trong hub. |
| R7 | `index.html` không còn `<script type="module">` hay `<style>` inline. |
| R12 | Dòng đầu mỗi module: `// tầng/file.js — <module này sở hữu gì>` — nguồn của bảng §2.1 (`npm run modmap`). |

**Luật sâu (`tools/refactor/deepcheck.mjs`, phân tích phạm vi — cũng chạy trong `npm test`):**

| Mã | Luật | Lỗi nó chặn |
|---|---|---|
| R8 | Dòng `import {…} from hub` **khớp đúng** tên module dùng: thiếu → lỗi; thừa → cảnh báo. Sửa: `npm run imports`. | `ReferenceError` lúc chạy (chỉ lộ khi nhánh code đó chạy) |
| R9 | Mọi tên tự do phải là export của hub hoặc global trình duyệt/JS đã biết (`GLOBALS` trong `tools/refactor/lib.mjs`). | gõ sai tên, quên export |
| R10 | **Không gán vào binding đã import** — ghi qua setter `__set_x(v)` của module chủ. | `TypeError: Assignment to constant variable` |
| R11 | Mã **cấp đỉnh** chỉ đọc `let/const/class` của module **đứng trước** trong hub (hàm thì được — đã hoist). | `ReferenceError` TDZ lúc tải trang → trắng màn hình |

> Ví dụ thật: khi tách `game/loop.js`, R10 bắt được móc `#dev` `tick()` gán `last=…` — sau khi tách sẽ ném `TypeError`; đã sửa bằng `__set_last`. R9 bắt được `RoundedBoxGeometry` / `THREE` / `CONTRACTS` thiếu import ở module mới.

### 4.2 Quy ước (review bằng mắt)
1. **Một nguồn sự thật**: số cân bằng → `config.js`; bảng nội dung (súng/địch/tướng/biome) → `src/data/`; chữ hiển thị tiếng Việt → `data/text-vi.js` hoặc trường `vi:` của bản ghi. Không hard-code số rải rác.
2. **Sở hữu trạng thái**: biến `let` thuộc module khai báo nó. Module khác chỉ đọc; muốn đổi → gọi hàm của module chủ (hoặc setter `__set_x`).
3. **Hệ thống mới = module mới** trong đúng tầng, thêm **một dòng** vào `hub.js` ở vị trí hợp lý (sau những gì nó cần lúc khởi tạo), dòng đầu file theo R12. Module > ~250 dòng hoặc chứa 2 hệ thống không liên quan → tách bằng `npm run move` (§4.4).
4. **Không phá tương thích**: đổi tên một export → `npm run where -- tên` để tìm mọi nơi dùng; R4 + lỗi liên kết module của trình duyệt sẽ báo nếu sót.
5. **Mỗi tính năng một tag Z**: comment `// Z99 …` cạnh mã mới để lần lịch sử (DOCS.md §14).
6. **Tiếng Việt cho người chơi, tiếng Anh cho mã**: khoá nội bộ (`'DESERT'`, `'cannon'`) giữ tiếng Anh; chỉ chữ hiển thị là tiếng Việt.

### 4.3 Hợp đồng dữ liệu (test.js — "DATA CONTRACTS")
Thêm nội dung mà thiếu trường là **test đỏ ngay**, không đợi tới lúc chơi mới vỡ:
- **Súng**: có `name`, icon, loại sát thương tồn tại trong `DMG_TYPE`, `mag/reload/fireCd > 0`, có giá `GUN_PRICE` (trừ súng khởi đầu), có lời giới thiệu `GUN_BLURB`; mọi giá trỏ tới súng có thật.
- **Địch**: `hp/speed/score` hợp lệ, có lớp giáp trong `ARMOR`, xe có bảng màu.
- **Tướng**: một tướng cho mỗi chiến dịch, đủ 3 tên pha, bộ phận đủ trường (tổng < 40% máu), giáp trước ≤ 1 ≤ giáp đuôi, câu khiêu khích.
- **Biome**: có khí quyển, màu nền, kiểu địa hình, màu gạch, tên tiếng Việt.
- **Shop / độ khó / giờ trong ngày**: có nhãn tiếng Việt và số cân bằng.

### 4.4 Công cụ tái cấu trúc (Z103) — tách / gộp module không vỡ

| Lệnh | Làm gì |
|---|---|
| `npm run move -- --to ui/abc.js f1 f2 x …` | Chuyển **khai báo cấp đỉnh** (hàm, `let`/`const`, class) sang module khác. Comment ngay trên khai báo đi theo; `let x` mang theo setter `__set_x`; import three/config/data cần thiết được chép theo; module mới tự thêm vào hub **ngay sau module nguồn** (đổi bằng `--after tầng/file`). Cuối cùng tự chạy `fix-imports`. |
| `npm run imports` | Tính lại dòng import hub của **mọi** module + bỏ tên thừa ở import three/config/data. Chạy sau mọi lần di chuyển code bằng tay. |
| `npm run deep` | Chỉ chạy R8–R11 (nhanh hơn `npm test`). |
| `npm run modmap` | Sinh lại bảng §2.1 từ dòng đầu mỗi module (R12). |
| `npm run where -- tên` | Module nào sở hữu một tên. |

**Quy trình tách một module** (đã dùng cho Z103): `npm run move …` → sửa dòng đầu module mới (R12) → **câu lệnh cấp đỉnh** (gắn listener, vòng lặp dựng pool) thì chuyển bằng tay *cùng* khai báo của nó, đặt module mới ngay sau module cũ trong hub để giữ thứ tự → `npm test` (R11 báo nếu thứ tự sai) → chạy thử trình duyệt → `npm run modmap`.

**Giới hạn đã biết**: `move` không chuyển câu lệnh cấp đỉnh (chỉ khai báo) — cố ý, vì thứ tự chạy của chúng là ngữ nghĩa; R11 không thấy được truy cập *gián tiếp* lúc tải (gọi một hàm của module sau, hàm đó lại đọc `const` chưa khởi tạo) → luôn chạy thử trình duyệt sau khi đổi thứ tự hub.

---

## 5. Công thức mở rộng (làm đúng thứ tự, `npm test` sau mỗi bước)

### 5.1 Thêm một khẩu súng `xyz`
1. `src/data/guns.js` → thêm `xyz: { name, svg, tier, type, dmg, fireCd, mag, reload, bspeed, … }`.
2. `config.js` → `GUN_PRICE.xyz` + `GUN_BLURB.xyz` (test bắt buộc).
3. (tuỳ chọn) nòng riêng: `src/tank/barrels.js` → nhánh `else if(id==='xyz')` trong `makeGunBarrel` (không có → nòng mặc định, cấp trang trí vẫn áp dụng); biểu tượng: `src/ui/icons.js`.
4. Hành vi đặc biệt dùng trường dữ liệu có sẵn (`aoe`, `homing`, `pierce`, `chain`, `special`) trước khi viết code mới trong `combat/`.
5. `npm test` → chạy thử → DOCS/LEVELS.

### 5.2 Thêm một loại địch `abc`
`data/enemies.js` (`ENEMY_DEFS.abc`) → `config.js` (`ARMOR.abc`, và `ROSTER` nếu là xe đặc biệt) → dáng xe trong `actors/enemies.js` (`decorateEnemyMesh`) → hành vi riêng trong `actors/vehicles.js` hoặc module mới `actors/abc.js` (+1 dòng hub) → xuất hiện trong đợt: `campaign/waves.js`.

### 5.3 Thêm / đổi tướng
`data/bosses.js`: `parts` (điểm yếu), `phases` (3 tên), `shield` (pha có trụ khiên), `front/rear`, `taunt`. Đòn đánh theo pha: `campaign/boss.js` → `bossAttack` (mỗi tướng một nhánh `id===`). Số chung (choáng, xả nhiệt, trụ): `config.js` → `BOSSFIGHT`.

### 5.4 Đổi chiến lược sức mạnh / độ khó
Chỉ sửa `config.js`: `BALANCE` (máu/sát thương/đợt), `RAMP` (tăng theo màn), `BALANCE.difficulty` (3 mức), `TACTICS` (IQ địch), `LOOT` (vật phẩm), `DRIVE` (lái). Test cân bằng trong `test.js` phải vẫn xanh.

### 5.5 Đổi / thêm cốt truyện, chiến dịch
`config.js` → `OPERATIONS` (story, brief, radio theo đợt, boss, win, script đợt) + `OBJECTIVES`. Test bắt buộc có chữ tiếng Việt. Thêm màn thứ 6 = thêm 1 operation + 1 boss + (tuỳ chọn) 1 biome — test "một tướng mỗi chiến dịch" sẽ nhắc nếu thiếu.

### 5.6 Thêm vật phẩm
`loot/powerups.js` (`POWERUPS`: `vi`, `ds`, `cat` cho mô hình 3D, `tier` độ hiếm, `buff`/`apply`), số → `config.js` (`LOOT`). Luật cộng dồn dùng chung `applyPowerup` — không viết luật riêng.

### 5.7 Thêm màn hình / chữ giao diện
Markup → `index.html`; style → file `css/` phù hợp (thêm cuối file, không chèn giữa để khỏi đảo cascade); logic → `src/ui/`. Chữ tiếng Việt viết thẳng hoặc đặt trong `data/text-vi.js`.

---

## 6. Lộ trình lên GAME SERVER (đồng đội · thi đấu · màn chơi online)

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| **A. Module hoá** | tách file, hub, data registry, hợp đồng dữ liệu, luật kiến trúc | ✅ Z98 |
| **B. Tách MÔ PHỎNG khỏi HIỂN THỊ** | tạo `src/sim/` (vị trí, máu, đạn, AI, va chạm — **không three.js, không DOM**) và `src/view/` (mesh, hạt, HUD đọc trạng thái sim). Hiện còn 1.138 `new THREE.` · 66 `scene.add` · 236 `document.` lẫn trong logic | tiếp theo |
| **C. Mô phỏng tất định** | nhịp cố định 30–60 Hz + nội suy khi vẽ; thay ~800 `Math.random` trong sim bằng RNG có seed; đầu vào người chơi thành **lệnh** (`{t, move, aim, fire, skill}`) | sau B |
| **D. Nhiều người chơi trong sim** | `S.player` (144 chỗ) → mảng `players[]`; mọi hệ thống (AI nhắm, vật phẩm, kíp lính, camera) chọn mục tiêu theo người | sau C |
| **E. Máy chủ uỷ quyền** | Node chạy **cùng** `src/sim/` + `src/data/` + `config.js`; client gửi lệnh, nhận snapshot/delta; client dự đoán xe mình, nội suy xe người khác; kinh tế/hồ sơ lưu trên server (chống gian lận) | sau D |
| **F. Chế độ** | co-op chiến dịch 2–4 người, PvP xe tăng, thử thách ngày (cùng seed), xếp hạng | sau E |

**Vì sao A là điều kiện bắt buộc**: không có ranh giới module thì không thể chọn ra phần "sim" để chạy trên Node; không có `data/` thuần thì server và client không dùng chung được bảng súng/địch → lệch số liệu giữa hai bên.

---

## 7. Quy trình trước khi commit
0. Máy mới: `npm install` một lần (công cụ kiểm tra; không có thì `npm test` bỏ qua R8–R11 và báo ⚠).
1. `npm test` (cú pháp 90+ file · luật kiến trúc · luật sâu · test dữ liệu/cân bằng) — phải xanh.
2. `npm run serve` → mở `http://127.0.0.1:8765` (desktop 1280×800 + mobile 390×844 / 844×390), console không lỗi (bỏ qua favicon 404).
3. Cập nhật `DOCS.md` (§14 + bảng hệ thống), `LEVELS.md` nếu đổi số, file này nếu đổi cấu trúc/luật.
4. Chỉ stage đúng từng file đã sửa (file mới trong thư mục mới cũng liệt kê từng file), không stage cả cây.

## 8. Nợ kỹ thuật còn lại (ưu tiên)
1. **Giai đoạn B** (sim/view) — xem §6.
2. ~~Module gom nhiều hệ thống~~ — **xong ở Z103**: `actors/troops.js` → `actors/fireteam.js` + `actors/crew.js` (+ dismount APC về `actors/vehicles.js`); `world/physics.js` → + `world/biome.js`; `fx/explosions.js` → + `fx/debris.js`; `ui/menus.js` → + `ui/terrain-picker.js` · `ui/guide.js` · `ui/settings.js` · `ui/loadout.js`; `game/loop.js` → + `game/viewport.js` · `game/boot-gate.js` · `game/startup.js` · `dev/hooks.js`. Ứng viên kế tiếp khi sửa tới: `core/helpers.js` (điều khiển + HUD — nên tách `input/drive-input.js` và `ui/hud.js`), `game/update.js` (người chơi + camera + nhãn tiếng Việt).
3. `config.js` nằm ở gốc (giữ để không vỡ test & tài liệu cũ); về sau chuyển thành `src/data/balance.js`.
4. Bảng có hàm (`POWERUPS`, `SPELLS`, `UPGRADES`, `TIPS`) chưa vào `data/` vì chứa logic/`MOBILE` — tách phần chữ & số ra data, giữ hàm ở module hệ thống.
