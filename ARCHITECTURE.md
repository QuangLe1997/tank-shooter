# KIẾN TRÚC MÃ NGUỒN — STEEL SIEGE (Z98)

> Tài liệu này là **luật** cho mọi thay đổi mã. Đọc §4 (Quy tắc) và §5 (Công thức) trước khi thêm súng / địch / tướng / màn / truyện.
> Kiểm tra tự động: **`npm test`** (cú pháp mọi module → luật kiến trúc → 1.000+ test dữ liệu & cân bằng).

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
tools/
  verify.mjs          ← npm test: cú pháp + kiến trúc + test
  archcheck.mjs       ← luật kiến trúc R1–R7 (§4)
  where.mjs           ← npm run where -- <tên>: tìm module sở hữu một hàm/biến
test.js               ← test cân bằng + HỢP ĐỒNG DỮ LIỆU (§4.3)
```

### 2.1 Danh mục module (80 file · ~7.000 dòng)

| Module | Dòng | Nội dung |
|---|---:|---|
| **actors/** — Đơn vị trên sân (địch, lính, drone, Lõi) | | |
| `src/actors/core.js` | 104 | CORE (base to defend) |
| `src/actors/damage.js` | 39 | HARD TANK SEPARATION: tanks never overlap; a bump knocks the other away |
| `src/actors/drone.js` | 117 | SUPPORT DRONE (power-up) |
| `src/actors/enemies.js` | 149 | floating HP bar over each enemy tank (pooled; reuses the soldier billboard-bar m |
| `src/actors/enemy-missiles.js` | 55 | ENEMY ROCKETS & GUIDED MISSILES — real objects in flight: dodge them, SHOOT THEM |
| `src/actors/infantry.js` | 92 | ===== Z79 · ENEMY INFANTRY — riflemen & RPG teams on foot. They fan out, take po |
| `src/actors/riders.js` | 41 |  |
| `src/actors/soldiers.js` | 128 | infantryman: jointed legs (walk cycle), plate carrier + pouches, covered helmet  |
| `src/actors/troops.js` | 103 | Z89 · TROOP CARRIERS — enemy APCs dismount squads; your FIRETEAM rides in on a f |
| `src/actors/vehicles.js` | 133 | Z80 · NEW ENEMY VEHICLES — flame tank, ATGM tank-destroyer, combat-engineer repa |
| **ai/** — Trí tuệ địch | | |
| `src/ai/tactics.js` | 171 | Z95 · TACTICAL DIRECTOR — the enemy fights as a unit: encircle, flank your rear, |
| **audio/** — Âm thanh tổng hợp | | |
| `src/audio/engine-music.js` | 79 | DIESEL ENGINE + TRACK CLATTER (player): idle burble → roar under load; climbing  |
| `src/audio/synth.js` | 119 | AUDIO (Web Audio synth) |
| **boot/** — Script khởi động (không phải module) | | |
| `src/boot/safety.js` | 5 |  |
| `src/boot/viewport.js` | 30 |  |
| **campaign/** — Chiến dịch, đợt, tướng, pháo kích | | |
| `src/campaign/artillery.js` | 143 | ARTILLERY LOCK — mortar barrage: lock the player's spot → red warning ring → arc |
| `src/campaign/boss.js` | 278 | phase change: invulnerable roar, shockwave shoves you back, escorts roll in, shi |
| `src/campaign/operations.js` | 126 | Z83 · CAMPAIGN OPERATIONS — named operation per stage: briefing, radio chatter,  |
| `src/campaign/waves.js` | 97 | WAVES |
| **combat/** — Vũ khí, đạn, kỹ năng | | |
| `src/combat/abilities.js` | 17 | ABILITIES (stubs filled in later phases) |
| `src/combat/flame.js` | 183 | continuous FLAME JET: one cohesive COLUMN of fire (a flamethrower stream, not sc |
| `src/combat/guns.js` | 106 | ARMS DOCTRINE helpers: damage class × armour, range falloff, battlefield conditi |
| `src/combat/lock-on.js` | 147 | MISSILE LOCK-ON — a hi-tech targeting reticle that snaps onto the locked target |
| `src/combat/mastery.js` | 18 | GUN MASTERY: duplicate pickups level a gun up (permanent, per-gun). Boosts dmg / |
| `src/combat/projectiles.js` | 21 | PROJECTILES |
| `src/combat/siege-rocket.js` | 127 | SIEGE ROCKET: a lobbed shell that plants a 2s fuse on landing, then wipes a big  |
| `src/combat/spells.js` | 81 | SPELLS (one equipped; cast on cooldown) |
| **core/** — Hằng số runtime, trạng thái, hồ sơ, tiện ích | | |
| `src/core/config.js` | 25 | CONFIG |
| `src/core/helpers.js` | 51 | HELPERS |
| `src/core/profile.js` | 85 | PLAYER PROFILE (nickname · arsenal · loadout · campaign save) |
| `src/core/state.js` | 18 | STATE |
| **data/** — DỮ LIỆU THUẦN (registry) — không logic, test được bằng node | | |
| `src/data/bosses.js` | 31 | BOSS (Z96 rework) |
| `src/data/enemies.js` | 32 | ENEMIES |
| `src/data/guns.js` | 25 | GUNS |
| `src/data/player.js` | 7 |  |
| `src/data/text-vi.js` | 8 | player-chosen DIFFICULTY (RECRUIT/SOLDIER/VETERAN) — scales enemy HP/damage + re |
| `src/data/world.js` | 36 | TIME OF DAY: each stage fights at a different hour — morning · harsh noon · gold |
| **fx/** — Hiệu ứng hình ảnh | | |
| `src/fx/dying.js` | 16 | KNOCKED-OUT tanks: engine dies, fire bursts from the hatches with thick black sm |
| `src/fx/explosions.js` | 161 | COMBAT FX / EXPLOSIONS (juiced in P4) |
| `src/fx/fire-wrecks.js` | 73 | REAL FIRE / FLASH / WRECKS |
| `src/fx/hud-fx.js` | 42 | FX (rings, float text, screen) |
| `src/fx/particles.js` | 86 | PARTICLES (juice) |
| **game/** — Luồng game, người chơi, vòng lặp | | |
| `src/game/flow.js` | 92 | GAME FLOW |
| `src/game/intro.js` | 40 | INTRO CINEMATIC (deploy showcase) |
| `src/game/loop.js` | 208 | MAIN LOOP |
| `src/game/player-damage.js` | 102 | PLAYER DAMAGE / DEATH |
| `src/game/score.js` | 15 | SCORE / COMBO |
| `src/game/update.js` | 173 | UPDATE |
| `src/hub.js` | 79 | Z98 HUB — the single place that fixes MODULE EVALUATION ORDER (same order the co |
| **input/** — Bàn phím, chuột, cảm ứng | | |
| `src/input/input.js` | 135 | INPUT |
| **loot/** — Vật phẩm, rơi đồ, nâng cấp roguelite | | |
| `src/loot/beacons.js` | 31 | LOOT BEACONS (mark crates/tanks that hide a power-up) |
| `src/loot/powerups.js` | 150 | POWER-UPS (drops) |
| `src/loot/upgrades.js` | 61 | ROGUELITE UPGRADES (pick 1 of 3 after each boss) |
| `src/main.js` | 2 | Z98 entry point: evaluating the hub runs every module in order (scene build → wo |
| **render/** — Three.js renderer + hậu kỳ | | |
| `src/render/renderer.js` | 110 | THREE SETUP |
| **tank/** — Mô hình xe tăng, nòng, khiên, rig | | |
| `src/tank/barrels.js` | 183 | per-gun barrel assemblies (real-world analogues): authored in TURRET space, hung |
| `src/tank/materials.js` | 115 | PLAYER TANK |
| `src/tank/model.js` | 167 | shared tank geometries (built once; every tank references them) |
| `src/tank/rig.js` | 45 | living tank rig: track scroll + wheel spin (skid-steer aware), suspension pitch/ |
| `src/tank/shield.js` | 55 | premium energy SHIELD: hex force-field + rim glow + orbiting rings (animated in  |
| **ui/** — Giao diện DOM (menu, shop, HUD phụ, gợi ý) | | |
| `src/ui/alarm.js` | 11 | CORE-UNDER-ATTACK ALARM |
| `src/ui/briefing.js` | 91 | STAGE BRIEFING: choose 1 of 3 contracts before the stage's waves begin |
| `src/ui/icons.js` | 77 | CUSTOM ICON SET (military line-art; no emoji) |
| `src/ui/menus.js` | 162 | PROFILE UI: nickname · arsenal/loadout · continue · reset |
| `src/ui/radar.js` | 23 | RADAR / MINIMAP |
| `src/ui/shop.js` | 275 | SHOP (buy guns + leveled upgrades with coins / diamonds) |
| `src/ui/tips.js` | 36 | Z94 · FIRST-TIME TIPS — the first time something new happens, the battle PAUSES  |
| **world/** — Bản đồ: địa hình, khí quyển, vật cản, công trình | | |
| `src/world/atmosphere.js` | 56 | Z97 VISIBLE SKY: a real gradient dome (zenith → horizon haze that melts into the |
| `src/world/brick-walls.js` | 130 | Z86 RUINED BRICK WALLS — tall, shell-torn, never whole; ram them down at speed |
| `src/world/bridges.js` | 51 | Z90 · ROPE BRIDGES between paired watchtowers — plank walkway on a catenary, rop |
| `src/world/camps.js` | 100 | Z90 · ENEMY TROOP CAMPS — a Quonset barracks, canvas tents, sandbag ring, flag & |
| `src/world/cover.js` | 99 | TERRAIN BLOCKS (cover) |
| `src/world/decals.js` | 61 | GROUND SCARS: tread marks (fade over time) + scorch/craters/impact dirt (permane |
| `src/world/decor.js` | 58 | TERRAIN DECOR (ambient scatter: rocks · grass · ice · slag · rubble) |
| `src/world/ground.js` | 85 | ARENA |
| `src/world/heightfield.js` | 93 | HEIGHTFIELD: rolling mounds, shell craters & wind drifts; everything (tanks, pro |
| `src/world/perimeter.js` | 64 | perimeter: concrete jersey barriers (instanced) topped with concertina razor wir |
| `src/world/physics.js` | 120 | PHYSICS: oriented hull boxes (SAT) — tanks touch for real, shove by mass, slide  |
| `src/world/props.js` | 140 | BATTLEFIELD PROPS (procedural, merged geometry, cached) |
| `src/world/towers.js` | 99 | guards spot your tank and fire plunging rifle rounds; searchlights sweep at nigh |

---

## 3. Cơ chế HUB — vì sao tách được mà không vỡ

1. Mỗi module **`export`** mọi khai báo cấp đỉnh của nó và **`import {…} from '../hub.js'`** những tên của module khác mà nó dùng.
2. `hub.js` là chuỗi `export * from './x.js'` **theo đúng thứ tự mã đã chạy khi còn một file**. Vì mọi module đều import hub (vòng tròn), trình duyệt đánh giá module **theo thứ tự trong hub** → hành vi khởi tạo giữ nguyên 100%.
3. Hàm được "hoist" khi liên kết module, nên gọi chéo lúc chạy luôn an toàn; chỉ **mã cấp đỉnh** mới phụ thuộc thứ tự — và thứ tự đó nằm ở một chỗ duy nhất.
4. Binding nhập khẩu là **chỉ đọc**. Biến nào cần đổi từ module khác thì module chủ cung cấp setter `__set_<tên>(v)` (hiện có cho 15 biến: `BIOME`, `boss`, `muted`, `soldierLvl`, `ridersUnlocked`, …). Ghi trực tiếp từ nơi khác → lỗi ngay khi tải trang, không còn lỗi ngầm.
5. `data/*` đứng **đầu** hub và không import gì ngoài `config.js` → node đọc được → test được.

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

### 4.2 Quy ước (review bằng mắt)
1. **Một nguồn sự thật**: số cân bằng → `config.js`; bảng nội dung (súng/địch/tướng/biome) → `src/data/`; chữ hiển thị tiếng Việt → `data/text-vi.js` hoặc trường `vi:` của bản ghi. Không hard-code số rải rác.
2. **Sở hữu trạng thái**: biến `let` thuộc module khai báo nó. Module khác chỉ đọc; muốn đổi → gọi hàm của module chủ (hoặc setter `__set_x`).
3. **Hệ thống mới = module mới** trong đúng tầng, thêm **một dòng** vào `hub.js` ở vị trí hợp lý (sau những gì nó cần lúc khởi tạo).
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
1. `npm test` (cú pháp 80+ file · luật kiến trúc · test dữ liệu/cân bằng) — phải xanh.
2. `npm run serve` → mở `http://127.0.0.1:8765` (desktop 1280×800 + mobile 390×844 / 844×390), console không lỗi (bỏ qua favicon 404).
3. Cập nhật `DOCS.md` (§14 + bảng hệ thống), `LEVELS.md` nếu đổi số, file này nếu đổi cấu trúc/luật.
4. Chỉ stage đúng từng file đã sửa (file mới trong thư mục mới cũng liệt kê từng file), không stage cả cây.

## 8. Nợ kỹ thuật còn lại (ưu tiên)
1. **Giai đoạn B** (sim/view) — xem §6.
2. Một số module gom nhiều hệ thống do tách theo khu vực liền mạch: `actors/troops.js` (APC địch + tổ bộ binh + kíp lính), `world/physics.js` (va chạm + `applyBiome`), `fx/explosions.js` (nổ + mảnh vỡ + xác xe). Tách tiếp khi sửa tới.
3. `config.js` nằm ở gốc (giữ để không vỡ test & tài liệu cũ); về sau chuyển thành `src/data/balance.js`.
4. Bảng có hàm (`POWERUPS`, `SPELLS`, `UPGRADES`, `TIPS`) chưa vào `data/` vì chứa logic/`MOBILE` — tách phần chữ & số ra data, giữ hàm ở module hệ thống.
