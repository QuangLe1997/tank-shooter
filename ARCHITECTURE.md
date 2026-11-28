# KIẾN TRÚC MÃ NGUỒN — XUNG KÍCH (Z98 · Z103)

> Tài liệu này là **luật** cho mọi thay đổi mã. Đọc §4 (Quy tắc) và §5 (Công thức) trước khi thêm súng / địch / tướng / màn / truyện.
> Kiểm tra tự động: **`npm test`** (cú pháp mọi module → luật kiến trúc R1–R7, R12, R13 → kiểm tra phạm vi sâu R8–R11 → 1.000+ test dữ liệu & cân bằng).
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
config.js             ← SỐ CÂN BẰNG (BALANCE, DRIVE, LOOT, TACTICS, CAV, OPERATIONS, …) — thuần dữ liệu
src/
  main.js             ← entry: import './hub.js'
  hub.js              ← DUY NHẤT nơi quyết định thứ tự chạy các module (export * theo thứ tự)
  boot/               ← script cổ điển chạy trước khi vẽ (viewport, safety net)
  data/               ← REGISTRY thuần: súng, địch, tướng, biome, chữ tiếng Việt, thông số xe
  net/                ← CO-OP 2 NGƯỜI (COOP 2): giao thức nhị phân, bộ đệm nội suy, đường truyền, phiên — THUẦN như data/ (không hub, không three, không DOM) nên chạy được bằng node; ngủ yên khi địa chỉ không có ?room=. Code nối vào game nằm ở game/*, không nằm ở đây
  core/ render/ audio/ world/ fx/ combat/ actors/ ai/ campaign/ loot/ input/ ui/ game/
  game/startup.js     ← GỐC KHỞI ĐỘNG (composition root): module hệ thống cuối cùng — nơi DUY NHẤT thực sự bật game
  dev/                ← móc kiểm thử window._* (Playwright, #dev) — gameplay không đọc; bản phát hành có thể bỏ
tools/
  verify.mjs          ← npm test: cú pháp + kiến trúc + test
  archcheck.mjs       ← luật kiến trúc R1–R7, R12, R13 (§4)
  lan-room.mjs        ← npm run lan-room: server phòng LAN cho co-op (phát game + chuyển tiếp WebSocket) — docs/COOP.md
  coop-test.mjs       ← npm run coop-test: test tầng mạng co-op bằng node (không trình duyệt)
  where.mjs           ← npm run where -- <tên>: tìm module sở hữu một hàm/biến
  refactor/           ← công cụ tái cấu trúc an toàn (Z103, cần npm install) — §4.4
    deepcheck.mjs     ← luật R8–R11 bằng phân tích phạm vi (acorn + eslint-scope)
    move.mjs          ← npm run move: chuyển khai báo giữa module, tự sửa import + hub
    fix-imports.mjs   ← npm run imports: tính lại dòng import hub của mọi module
    modmap.mjs        ← npm run modmap: sinh bảng §2.1 từ dòng đầu mỗi module
test.js               ← test cân bằng + HỢP ĐỒNG DỮ LIỆU (§4.3)
```

### 2.1 Danh mục module (334 module theo thứ tự hub · 35.844 dòng)

<!-- MODULES:BEGIN (npm run modmap) -->
| # | Module | Dòng | Nội dung |
|---:|---|---:|---|
| | **data/** — DỮ LIỆU THUẦN (registry) — không logic, test được bằng node | | |
| 1 | `src/data/world.js` | 77 | TIME OF DAY: each stage fights at a different hour — morning · harsh noon · golden sunset · moonlit night un… |
| 2 | `src/data/scene-solids.js` | 28 | Z433 WHAT STOPS A BODY AT AN ARCH, A GATE, A RUIN: each scenery model's footprint at body height (0.3–3 m ab… |
| 3 | `src/data/text-vi.js` | 48 | Vietnamese player-facing labels: time of day, difficulty, stage tags, biome & shop-category names |
| 4 | `src/data/player.js` | 8 | PLAYER tank handling constants (accel, speed, dash, turn, base combat range) |
| 5 | `src/data/guns.js` | 37 | GUNS registry: damage type, damage, fire rate, magazine, reload, projectile per gun |
| 6 | `src/data/enemies.js` | 33 | ENEMY_DEFS registry: hp, speed, score, scale, weapon and role per enemy type |
| 7 | `src/data/bosses.js` | 17 | THE GENERALS: the commander who holds each stage's citadel and meets the soldier on foot (campaign/general-d… |
| 8 | `src/data/nemesis-mem.js` | 65 | NEMESIS 1 WHAT A GENERAL REMEMBERS, AS DATA (pure — test.js calls it): the record he keeps of the player, it… |
| 9 | `src/data/voice-lines.js` | 249 | VOICE 2 GENERATED by tools/voice/build.mjs from tools/voice/lines.json + config.js RIDE_TALK: every spoken l… |
| 10 | `src/data/medal-rules.js` | 83 | MEDAL 1 THE CAREER'S RULES, AS DATA (pure — test.js calls it): the rank an amount of experience is, the insi… |
| 11 | `src/data/mode-math.js` | 53 | MODE 1–2 THE TWO EXTRA MODES' ARITHMETIC, AS DATA (pure — test.js calls it; the game side is campaign/mode-r… |
| 12 | `src/data/knob-stack.js` | 16 | MIX 1 THE ONE KNOB STACK (pure: no hub, no DOM — test.js and tools/spec.mjs load it in node). |
| 13 | `src/data/mixer-math.js` | 340 | MIX 1 THE BATTLE MIXER'S ARITHMETIC (pure: config + data only — tools/spec.mjs and test.js run it in node; t… |
| | **net/** — Co-op 2 người: giao thức, đường truyền, phiên — thuần, chạy được bằng node | | |
| 14 | `src/net/protocol.js` | 208 | COOP 2 THE WIRE FORMAT of two-player co-op: message kinds, version, quantisers, the frame a snapshot is buil… |
| 15 | `src/net/interp.js` | 61 | COOP 2 THE RECEIVING SIDE'S SNAPSHOT BUFFER: keeps the last few snapshots, draws the world a little in the p… |
| 16 | `src/net/transport.js` | 61 | COOP 2 THE LINE between the two players: the transport interface the game talks to (never to a socket direct… |
| 17 | `src/net/coop.js` | 142 | COOP 2 THE CO-OP SESSION: idle → connecting → lobby → ready → playing → ended, who is host, the seed and bat… |
| 18 | `src/net/rules.js` | 172 | COOP 4 THE RULES BOTH PAGES MUST AGREE ON, AS PLAIN FUNCTIONS (they run in Node: tools/coop-test.mjs): the c… |
| | **core/** — Hằng số runtime, trạng thái, hồ sơ, tiện ích | | |
| 19 | `src/core/config.js` | 29 | runtime constants derived from config + device: arena size, MOBILE, the aircraft's draw scale, player range,… |
| 20 | `src/core/dice.js` | 82 | SYNC 1 TWO DICE: in a seeded battle (the daily challenge, a co-op room, ?seed) the battlefield's LAYOUT is t… |
| 23 | `src/core/state.js` | 21 | S — the single runtime game state (mode, stage, wave, score, player, spell, recall …) |
| 262 | `src/core/helpers.js` | 73 | shared helpers: control scheme + tank input → move direction, main HUD refresh, world-space HP bars |
| 269 | `src/core/profile.js` | 50 | PLAYER PROFILE (nickname · campaign save · settings) |
| 270 | `src/core/cloud.js` | 63 | Z162 CLOUDSAVE SAVE: Firebase Auth (anonymous first, Google link later) + the profile mirrored to Firestore … |
| 271 | `src/core/score-report.js` | 25 | Z163 THE LEADERBOARD'S RUN REPORT: at the end of each stage (and when a run ends) the score so far goes to t… |
| | **render/** — Three.js renderer + hậu kỳ | | |
| 25 | `src/render/clouds.js` | 33 | Z145 CLOUD LIGHT: big cloud shadows drift across the whole battlefield (forts, tanks, fields go dim and brig… |
| 26 | `src/render/aerial.js` | 76 | Z427 AIR AND DISTANCE: the haze every fogged material draws through is rebuilt (the stock fog chunk replaced… |
| 27 | `src/render/shafts.js` | 47 | Z276 SUNLIGHT IN THE AIR: light shafts on every battlefield. A full-screen pass right after the scene is dra… |
| 28 | `src/render/renderer.js` | 195 | THREE SETUP |
| 29 | `src/render/air-post.js` | 126 | AIR 1 ONE CINEMATIC PASS: the frame's tail (NaN guard, bloom's additive write-back, tone map + sRGB, the gra… |
| 30 | `src/render/air-aa.js` | 22 | AIR 4 LESS SHIMMER: what sparkled while the camera moves. Specular anti-aliasing in every lit physical mater… |
| 32 | `src/render/surface.js` | 103 | Z145 REAL SURFACES: what makes a built wall read as stone instead of painted plastic. |
| 34 | `src/render/lod.js` | 56 | Z107 RENDER BUDGET: trims draw calls where the eye can't tell — soldier shadows only near the tank, tower / … |
| 35 | `src/render/asset-diet.js` | 120 | DIET 1 ONE LOADER FOR EVERY MODEL FILE: meshopt geometry always (EXT_meshopt_compression), and KTX2 maps (KH… |
| 36 | `src/render/far-lod.js` | 111 | Z328 FAR LOD: a big static model (a fort's towers and gatehouse, our HQ) swaps to a simplified copy of itsel… |
| 37 | `src/render/shadow-split.js` | 86 | SPLIT 1 (A1) THE SUN'S SHADOW IN TWO PARTS: what stands still (ground, walls, houses, rocks, trees, the fiel… |
| 38 | `src/render/quality.js` | 44 | SPLIT 3 (A9) THREE QUALITY LEVELS + A FALL-BACK AFTER A CRASHED LOAD. Thấp / Vừa / Cao are the same battlefi… |
| 39 | `src/render/fight-warm.js` | 51 | SPLIT 2 (A6) NOTHING COMPILED OR UPLOADED IN THE FIGHT'S FIRST FRAMES, AND THE LOAD NEVER WAITS FOR IT. Two … |
| 40 | `src/render/inst-view.js` | 124 | VIEW 1 AN INSTANCED MESH SPREAD OVER THE WHOLE FIELD DRAWS ONLY WHAT IS NEAR. One InstancedMesh of 2000 ston… |
| 41 | `src/render/near-detail.js` | 124 | Z395 NEAR DETAIL: every model the game ships was packed small (1K maps), so up close a palm's fronds fray wh… |
| 42 | `src/render/cover-batch.js` | 61 | Z338 COVER IN A FEW DRAWS: every piece of cover (sandbags, crates, drums, concrete, HESCO, jersey, pipes, te… |
| 43 | `src/render/static-batch.js` | 60 | PERF 14 THE SAME PIECE, ONE DRAW: a battlefield holds hundreds of plain meshes that are copies of one anothe… |
| 44 | `src/render/shadow-twin.js` | 39 | PERF 20 ONE SHADOW DRAW FOR A MANY-MATERIAL MODEL: a street lamp, a kerb set, a café table, a traffic car ar… |
| 46 | `src/render/see-through.js` | 50 | CAM 3 SEE-THROUGH: what stands between the follow camera and the soldier — a fort's wall, tower or keep, its… |
| 47 | `src/render/cam-arm.js` | 60 | VIS 2 THE SPRING ARM: the follow camera never sits inside a rock, a ruin's pillar or a wall, nor presses its… |
| 48 | `src/render/perfhud.js` | 38 | Z240 PERFORMANCE PROBE + HUD: per-frame logic / draw-submit / GPU time (EXT_disjoint_timer_query_webgl2), wo… |
| 54 | `src/render/mat-norm.js` | 132 | MAT 1 ONE LIGHT FOR EVERY MODEL: the field is furnished from Poly Haven scans, Sketchfab scans, Meshy and Tr… |
| 55 | `src/render/blend-in.js` | 60 | Z325 EVERYTHING BELONGS TO THE FIELD: forts, the real city, ruins, wonders, props and the 3D models were eac… |
| 77 | `src/render/materials.js` | 49 | procedural textures the world shares: the welded-panel albedo (panelTex), a height map → normal map (_height… |
| 105 | `src/render/night-marks.js` | 23 | Z137 NIGHT VISIBILITY: at night every tank wears lamps so it can be read in the dark — enemy hulls: white he… |
| | **audio/** — Âm thanh tổng hợp | | |
| 81 | `src/audio/synth.js` | 276 | AUDIO (Web Audio synth) |
| 82 | `src/audio/engine-music.js` | 104 | DIESEL ENGINE + TRACK CLATTER (player): idle burble → roar under load; climbing a mound makes it SCREAM, coa… |
| 83 | `src/audio/voice.js` | 58 | Z161 RADIO VOICES: the commander (SCH) and the generals speak Vietnamese over the radio · Z169 only danger c… |
| 84 | `src/audio/banter.js` | 137 | VOICE 2 THE FUN TALK: the xe ôm driver, the soldier, his squad and the enemy SPEAK (the commander's radio st… |
| 85 | `src/audio/music.js` | 88 | Z161 ADAPTIVE BATTLE SCORE: five looped stems rendered offline (pad · war drums · bass ostinato · string spi… |
| 86 | `src/audio/ambience.js` | 197 | NATURE AMBIENCE (AMBIENCE): a quiet bed under the battle (wind · leaves on the green fields · the sea's wash… |
| 87 | `src/audio/afx-math.js` | 190 | AUDIO 1 the battle sound layer's PURE maths (no AudioContext, no hub, no DOM — it runs in Node: tools/audio-… |
| 88 | `src/audio/afx.js` | 150 | AUDIO 1 THE BATTLE'S SOUND LAYER over audio/synth.js: every world sound becomes a VOICE with a place — level… |
| 89 | `src/audio/afx-space.js` | 42 | AUDIO 2 THE SPACE THE LISTENER STANDS IN: a ring of rays round him (one ray a tick, never a burst) and the l… |
| 90 | `src/audio/afx-move.js` | 35 | AUDIO 2 MEN ON THE MOVE: a footstep by the ground under it (sand hisses, rock scrapes, the shallows splash, … |
| 91 | `src/audio/afx-mix.js` | 69 | AUDIO 3 THE MIXER, THE SCORE AND THE SQUAD'S CALLS: the music dips under gunfire and under a close blast and… |
| 92 | `src/audio/body-math.js` | 36 | HIT 1 the takes of a man's body struck, pure maths (no imports: runs in Node, test.js): each returns a mono … |
| 93 | `src/audio/body-hit.js` | 51 | HIT 1 A MAN IS HIT, NOT A HULL: what HE hears when he is struck (game/player-damage.js), synthesised, no fil… |
| | **world/** — Bản đồ: địa hình, khí quyển, vật cản, công trình | | |
| 24 | `src/world/field.js` | 63 | Z106 FIELD BOUNDARY: the playable area is an irregular outline (radius per bearing around the Core) — bays, … |
| 49 | `src/world/atmosphere.js` | 184 | Z97 VISIBLE SKY: a real gradient dome (zenith → horizon haze that melts into the fog), sun glow by day, moon… |
| 50 | `src/world/sky-photo.js` | 27 | Z255 PHOTOGRAPHED SKY: a real pure-sky HDRI (Poly Haven, CC0; tools/sky-hdri.mjs → assets/sky) laid into the… |
| 51 | `src/world/ground.js` | 227 | ARENA ground: procedural ground maps per biome, macro variation + patch textures (cached) |
| 52 | `src/world/ground-photo.js` | 37 | Z250 PHOTO GROUND: the battlefield floor wears photo-scanned CC0 materials (Poly Haven, see config GROUND_PH… |
| 53 | `src/world/grass-carpet.js` | 115 | Z251 GRASS CARPET → Z263 PHOTOGRAPHED GRASS: on grassy battlefields a carpet of real grass grows round the c… |
| 56 | `src/world/heightfield.js` | 251 | HEIGHTFIELD: rolling mounds, shell craters & wind drifts; everything (tanks, props, shells, particles) sits … |
| 57 | `src/world/river.js` | 194 | Z405 RIVERS: a river and its side stream across the battlefields that have one (config RIVERS) — the bed car… |
| 58 | `src/world/decals.js` | 95 | GROUND SCARS: tread marks (fade over time) + scorch/craters/impact dirt (permanent per stage) painted into a… |
| 59 | `src/world/props.js` | 257 | BATTLEFIELD PROPS (procedural, merged geometry, cached) |
| 60 | `src/world/real-props.js` | 65 | Z252 REAL COVER: the Meshy-generated low-poly cover pieces (sandbags, concrete block, container, crates, dru… |
| 61 | `src/world/perimeter.js` | 85 | perimeter: concrete jersey barriers (instanced) topped with concertina razor wire on steel pickets |
| 62 | `src/world/decor.js` | 66 | TERRAIN DECOR (ambient scatter: rocks · grass · ice · slag · rubble) |
| 63 | `src/world/magma.js` | 85 | Z258 REAL MAGMA + A REAL VOLCANO. One shader for molten rock: a skin of dark basalt crust broken into plates… |
| 64 | `src/world/stone.js` | 126 | Z259 PHOTO STONE for built and natural rock: a material that starts in a plain stone colour and takes a phot… |
| 65 | `src/world/lava.js` | 32 | Z187 LAVA in the volcanic caldera: glowing pools that light the ground, spit embers, and burn any tank that … |
| 66 | `src/world/horizon.js` | 125 | Z189 THE HORIZON (Z209 sculpted, lit, never the same twice): the battlefield is not alone in the world. Thre… |
| 67 | `src/world/backdrop.js` | 121 | Z427 THE FAR RANGES: the land and the mountains kilometres away, at their true distance and height. They are… |
| 68 | `src/world/forest.js` | 44 | Z440 WOODS PAST THE FENCE: the land round the field wears real woods of the scanned tree species, not a scat… |
| 69 | `src/world/biome.js` | 32 | Z103 split from world/physics.js: apply a battlefield biome (ground maps, terrain, sky, perimeter, |
| 70 | `src/world/cover.js` | 242 | TERRAIN BLOCKS (cover) |
| 71 | `src/world/rubble.js` | 44 | Z193 WHAT A BROKEN OBSTACLE LEAVES BEHIND: a low heap of its own material where it stood (torn sacks and spi… |
| 72 | `src/world/supply.js` | 338 | Z194 ENEMY SUPPLY BASES: a FUEL STATION (tank farm behind a bund wall, pump house, dispensers, tanker trucks… |
| 73 | `src/world/camp-life.js` | 53 | Z196 A LIVED-IN BARRACKS: the troop camp is where the enemy feeds, clothes and treats its men — the mess ten… |
| 74 | `src/world/radar.js` | 79 | Z197 THE RADAR STATION: the enemy's eyes. A 20 m tapered steel lattice tower on a concrete pad, an equipment… |
| 75 | `src/world/ridges.js` | 30 | Z106 INNER RIDGES: rock spines across the field that split it into sectors with passes between them — |
| 76 | `src/world/brick-walls.js` | 126 | Z86 RUINED BRICK WALLS — tall, shell-torn, never whole; ram them down at speed |
| 99 | `src/world/skylife.js` | 184 | Z235 A LIVING SKY over the battlefield: |
| 106 | `src/world/landmarks.js` | 17 | Z139 BATTLEFIELD LANDMARKS (Z327: the old box-city and hill-woods builders are gone — the real city and flor… |
| 107 | `src/world/regional.js` | 173 | Z140 REGIONAL ARCHITECTURE: every battlefield builds its strongholds its own way — our Core compound and the… |
| 108 | `src/world/core-walls.js` | 182 | Z140 OUR STRONGHOLD: the Core sits inside a walled compound built in the land's own style (regional.js) — an… |
| 109 | `src/world/env-events.js` | 60 | Z140 SURPRISES OF THE LAND: every minute or two the battlefield itself does something — the village river fl… |
| 111 | `src/world/flora.js` | 236 | Z141 LIVING SCENERY: proper trees (layered conifers, round-crowned broadleaf, curved coconut palms, bamboo c… |
| 112 | `src/world/cars.js` | 54 | Z206 STREET VEHICLES: which body each parked car takes (sedan · hatchback · SUV · pickup · minivan · taxi · … |
| 113 | `src/world/city.js` | 449 | Z142 · Z216 A REAL CITY THAT BREAKS. The street plan has a hierarchy: wide BOULEVARDS every third line (two … |
| 115 | `src/world/wonders.js` | 133 | Z144 WORLD LANDMARKS: every battlefield has one landmark of its land's architecture on the high ground just … |
| 129 | `src/world/tunnels.js` | 132 | Z225 ĐỊA ĐẠO: the enemy has dug a tunnel network under the battlefield (from stage 2 and every custom battle). |
| 130 | `src/world/underbase.js` | 239 | Z226 THE UNDERGROUND BASE: under every battlefield the enemy keeps a buried base — its barracks, its vehicle… |
| 143 | `src/world/towers.js` | 139 | WATCHTOWERS: wood towers with guards who fire plunging rounds + night searchlights; shoot them down to colla… |
| 144 | `src/world/tower-fall.js` | 158 | Z452 A TOWER COMES DOWN FOR REAL: a watchtower, a guard post or the radar mast shot down topples about the s… |
| 145 | `src/world/tower-kinds.js` | 125 | Z175 WATCHTOWER TYPES: seven real guard-tower builds in timber, steel and concrete — each land raises the ki… |
| 146 | `src/world/camps.js` | 157 | Z90 · ENEMY TROOP CAMPS — a Quonset barracks, canvas tents, sandbag ring, flag & cookfire; squads keep pouri… |
| 147 | `src/world/zones.js` | 38 | Z104 BATTLEFIELD PLAN: reserves ground for the rally point, POW stockades and depots before cover is scattered |
| 148 | `src/world/zone-mark.js` | 39 | VIS 8 A HOLD ZONE'S MARK ON THE GROUND: a painted band draped over the ground (it follows every rise and dip… |
| 149 | `src/world/fortress.js` | 690 | Z107 FORTRESSES (đại bản doanh): 3–4 named strongholds a stage — crenellated walls with riflemen on top, cor… |
| 150 | `src/world/fort-hill.js` | 182 | Z453 CASTLES ON CRAGS (config FORTHILL, the limestone quarry first; Z455 the whole land: crags joined by rid… |
| 151 | `src/world/hill-trees.js` | 35 | Z455 TREES ON THE CRAGS (FORTHILL.trees): on the limestone hills dead trees cling at the lip of a drop — fou… |
| 152 | `src/world/hill-climb.js` | 40 | Z456 THE WAY UP (FORTHILL…spur.path): the capital's crag is sheer all round but for a narrow tongue toward i… |
| 153 | `src/world/iceberg.js` | 101 | Z462 THE ICEBERG CITADELS (FORTHILL.biomes.ARCTIC.berg): the arctic's capital, and the fort with the most ro… |
| 154 | `src/world/rally.js` | 26 | Z104 KHU TẬP KẾT (rally point): soldiers carry the loot they find back here; it waits (never expires) for th… |
| 155 | `src/world/pow.js` | 57 | Z104 POW STOCKADES along our fence: our captured men behind barbed wire, enemy guards around them. |
| 156 | `src/world/depots.js` | 58 | Z104 ENEMY WEAPON DEPOTS in their half of the field, each with a guard post (no-tanks: the motor pool is gon… |
| 157 | `src/world/bridges.js` | 53 | Z90 · ROPE BRIDGES between paired watchtowers — plank walkway on a catenary, rope handrails, a sentry patrol… |
| 171 | `src/world/tree-fall.js` | 52 | Z262 A TREE GOES DOWN FOR REAL: rammed by a tank, struck by a shell or caught in a blast, a tree topples abo… |
| 172 | `src/world/real-trees.js` | 118 | Z262 REAL TREES: thirteen Meshy-generated species (oak, linden, birch, poplar, Scots pine, snowy spruce, coc… |
| 173 | `src/world/real-city.js` | 60 | Z264 THE REAL CITY: Meshy-generated buildings (glass tower, stone office tower, apartment tower, mid-rise ho… |
| 174 | `src/world/traffic.js` | 446 | Z268 THE CITY MOVES (Z269: app-driver liveries — green, yellow, teal on an electric scooter — plain jackets,… |
| 176 | `src/world/ruins3d.js` | 31 | Z275 RUINS OF WAR: Tripo-built ruins stand about the battlefields — a gothic chapel fallen in (built from th… |
| 177 | `src/world/defense.js` | 159 | Z420 THE DEFENCE IN DEPTH → Z423 EVERY LAND ITS OWN DOCTRINE. The forts stand in a ring round our base and t… |
| 178 | `src/world/trails.js` | 135 | Z432 TRAILS: the tracks worn between the places of a battlefield (our gates, the spawn, the forts' gates, th… |
| 179 | `src/world/real-turrets.js` | 61 | Z424 REAL GUNS ON THE DRAWN MOUNTS, REAL ROCKETS ON THE DRAWN ROUNDS. Our base's guard cannons (the fort gun… |
| 180 | `src/world/real-fit.js` | 40 | Z426 A DRAWN PIECE WEARING A SCAN FITTED TO ITS OWN BOX: the enemy camps' Quonset barracks and sleeping tent… |
| 181 | `src/world/scenery.js` | 300 | Z374 THE BATTLEFIELD AS A PICTURE: every land is composed from the Meshy community scans (config SCENERY, fi… |
| 189 | `src/world/solid-shape.js` | 160 | Z337 THE SHAPE A THING REALLY HAS, for whatever bumps into it: a block is kept as a circle for the bullets a… |
| 220 | `src/world/outposts.js` | 36 | Z285 ENEMY OUTPOSTS: round every enemy fort a camp of real things (Tripo): a long barracks, field tents, a r… |
| 306 | `src/world/sidepaint.js` | 42 | Z179 BATTLEFIELD-AWARE PAINT: soldiers and vehicles of both sides are recoloured for each battlefield so the… |
| | **fx/** — Hiệu ứng hình ảnh | | |
| 31 | `src/fx/battle-light.js` | 73 | Z318 BATTLEFIELD LIGHT: one palette, one pulse clock and one glowing-ring material for every gameplay light |
| 33 | `src/fx/searchlight.js` | 69 | Z146 SEARCHLIGHTS that read as real light in night air, not a glowing plastic cone: |
| 78 | `src/fx/hud-fx.js` | 55 | FX (rings, float text, screen) |
| 79 | `src/fx/particles.js` | 94 | PARTICLES (juice) |
| 80 | `src/fx/gore.js` | 68 | Z121 GORE: blood on the ground as real soft-edged splats (one instanced draw, they fade out) and bodies torn… |
| 96 | `src/fx/fire-wrecks.js` | 39 | REAL FIRE / FLASH: the flame and flash textures, particle layers and the rolling fireball (no-tanks: the bur… |
| 97 | `src/fx/flames.js` | 40 | Z235 LIVING FLAMES: every standing fire (camp fires, braziers, torches) is a flame that breathes and dances,… |
| 98 | `src/fx/smoketrail.js` | 81 | Z236 SMOKE RIBBONS: a tank-gun round no longer leaves a string of separate puffs behind it but one unbroken … |
| 110 | `src/fx/celebrate.js` | 24 | Z140 VICTORY CELEBRATION: a fort taken or a battle won — fireworks over the field, every soldier of ours lea… |
| 122 | `src/fx/realwar.js` | 37 | Z223 REAL WAR: the small things that make a firefight read as real. |
| 160 | `src/fx/cinematic.js` | 41 | Z189 CINEMATIC COMBAT FX: a shock dome that rips out of every tank kill, real fire light (blasts flash the g… |
| 161 | `src/fx/soldier-fx.js` | 81 | Z306 A MAN IS HIT, NOT A HULL: blood off the side the round came from, a flinch of the view and the red mark… |
| 162 | `src/fx/fire-fx.js` | 209 | FIRE 1 THE FIRE / SMOKE PARTICLE LAYER: every flame, fireball, dust and smoke puff of the new effects (fx/bl… |
| 163 | `src/fx/blasts.js` | 142 | FIRE 2–4 THE STAGED EFFECTS on the fire / smoke layer (fx/fire-fx.js; numbers in config FIREFX), each the wa… |
| 164 | `src/fx/hitfx.js` | 77 | Z192 REAL ROUNDS & REAL HITS: a shell flies as a hot streak pointed along its path (not a glowing ball), a m… |
| 165 | `src/fx/explosions.js` | 89 | COMBAT FX / EXPLOSIONS (juiced in P4) |
| 166 | `src/fx/wallmarks.js` | 44 | Z204 A ROUND THAT HITS SOMETHING SOLID: every strike on a wall, rock, fortress, cover piece or structure — b… |
| 167 | `src/fx/gunfx.js` | 296 | Z149 GUN EFFECTS that read like the real weapon, per firing class (GUNS[id].flash): |
| 168 | `src/fx/feel-fx.js` | 40 | FEEL 1–4 THE CRITIC'S ROUND 1 (config FEELFX; FEELFX.on:false = all as before): |
| 169 | `src/fx/debris.js` | 88 | Z103 split from fx/explosions.js: flying fragments (pooled) — chunks, plates, splinters (no-tanks: the tank … |
| 170 | `src/fx/shatter.js` | 103 | Z261 REAL BREAKAGE: a destroyed prop breaks into pieces of ITSELF — its own (real, textured) mesh cut into f… |
| 182 | `src/fx/dust.js` | 35 | Z278 DUST IN THE SUNLIGHT: a few thousand motes drift in a box of air that follows the camera's view (world-… |
| 183 | `src/fx/footfall.js` | 145 | LIGHT 1 GROUNDED: the soldier stands IN the world. A soft contact shade (the sky the body hides from the gro… |
| 194 | `src/fx/water-spray.js` | 106 | HSWIM 2 WATER THAT READS AS WATER (config HSWIM2): the splash of a boot, a stroke or a swimming horse's ches… |
| 221 | `src/fx/weather.js` | 101 | Z107 WEATHER: rain squalls (streaks + wet, glossy ground + lightning), sandstorms (driven grit + thick ochre… |
| | **combat/** — Vũ khí, đạn, kỹ năng | | |
| 94 | `src/combat/projectiles.js` | 23 | PROJECTILES |
| 95 | `src/combat/ballistics.js` | 43 | Z228b A ROUND THAT FLIES LIKE ONE: velocity curves for every projectile. |
| 100 | `src/combat/lock-on.js` | 174 | EVERY ROUND IN FLIGHT: spawning a round, flying it (straight line / lob / rocket), striking men, aircraft, b… |
| 195 | `src/combat/solid-line.js` | 40 | Z380 NOTHING GOES THROUGH A WALL: a round was tested against the obstacles only where it stood at the end of… |
| 228 | `src/combat/abilities.js` | 19 | ABILITIES (stubs filled in later phases) |
| 229 | `src/combat/guns.js` | 93 | ARMS DOCTRINE helpers: damage class × armour, range falloff, battlefield conditions, smart gun pick |
| 230 | `src/combat/aim.js` | 32 | Z104 aim policy: desktop aims with the mouse; MOBILE: Z233 the turret tracks the enemy itself (AIM.mobileFix… |
| 231 | `src/combat/siege-rocket.js` | 74 | LOBBED ROUNDS: the M79 grenade and the hand grenade in an arc (fireMortar), the aim arc drawn on the ground,… |
| 232 | `src/combat/flame.js` | 60 | the soldier's FLAMETHROWER cone (fireFlame), lobbed rounds in flight (the M79, the hand grenade: updateRocke… |
| 233 | `src/combat/soldier-fire.js` | 58 | Z306 THE SOLDIER FIRES HIS OWN RIFLE (soldier mode only; the tank keeps combat/flame.js fireGun): a small-ar… |
| 234 | `src/combat/air-aim.js` | 64 | Z313 SHOOTING AT HELICOPTERS IN 3D (tank and soldier alike): the gun is laid on an aircraft, height and all.… |
| 235 | `src/combat/crosshair.js` | 147 | Z376 THE CROSSHAIR IS WHERE THE ROUND GOES. The mouse's aim used to be the GROUND under the cursor: laid on … |
| 236 | `src/combat/trooper-spells.js` | 28 | Z307 THE SOLDIER'S OWN SKILLS (soldier mode only; the tank keeps combat/spells.js SPELLS): a hand grenade lo… |
| 237 | `src/combat/spells.js` | 65 | the soldier's SKILLS in hand (one picked, cast on cooldown: combat/trooper-spells.js), his smoke screen, and… |
| 274 | `src/combat/drone-skills.js` | 147 | DRONE 1 HIS OWN DRONES (the soldier's skills, combat/trooper-spells.js; each on a clock of its own, combat/s… |
| | **actors/** — Đơn vị trên sân (địch, lính, drone, Lõi) | | |
| 101 | `src/actors/core.js` | 176 | CORE (base to defend) |
| 102 | `src/actors/enemies.js` | 63 | ENEMY units: spawn (infantry, helicopters; elites, loot), pooled meshes and floating HP bars (no-tanks: no a… |
| 103 | `src/actors/fireteam.js` | 261 | Z89/Z100 friendly FIRETEAM: called in on foot (no-tanks: no APC, no hull to board), free-roam inside the sol… |
| 104 | `src/actors/escalade.js` | 46 | Z145 ESCALADE: while the gate still holds, every third man of an assault carries a scaling ladder on his sho… |
| 114 | `src/actors/wildlife.js` | 142 | Z143 WILDLIFE (Z208 real anatomy and coats): herds that graze, wander and bolt from tanks — gazelles, zebras… |
| 116 | `src/actors/crew.js` | 9 | Z245 the G key and the crew button: get on / off the ride (no-tanks: there is no tank crew to seat on the hu… |
| 118 | `src/actors/infantry.js` | 221 | Z79 · ENEMY INFANTRY — riflemen & RPG teams on foot. They fan out, take pot-shots, kneel to fire rockets… |
| 119 | `src/actors/enemy-missiles.js` | 81 | ENEMY ROCKETS & GUIDED MISSILES — real objects in flight: dodge them, SHOOT THEM DOWN, or blind them with sm… |
| 120 | `src/actors/vehicles.js` | 138 | Z80 the enemy's ATTACK GUNSHIP (its airframe, flight, guns and rockets, its fall) and the laser-beam pool (n… |
| 121 | `src/actors/helis.js` | 207 | Z222 THE HELICOPTER FLEET: two more airframes beside the attack gunship, each with its own shape, paint and … |
| 131 | `src/actors/paradrop.js` | 105 | Z104 PARATROOPERS: every so often an enemy transport helicopter crosses the field and drops a stick of |
| 132 | `src/actors/command.js` | 39 | Z107 SQUAD COMMANDS: muster everyone on the map to the tank (T), storm the nearest fortress (X), call our he… |
| 142 | `src/actors/damage.js` | 36 | DAMAGE AND DEATH of an enemy unit: hits (the general's hit cap), the kill (score, coins, loot, the soldier's… |
| 175 | `src/actors/real-air.js` | 57 | Z272 REAL AIRCRAFT: Tripo models take the place of the procedural airframes — the attack gunship, the swooping |
| 205 | `src/actors/squad-mates.js` | 60 | Z351 HIS OWN SQUAD (soldier mode only): he does not fight alone. He starts with two men of his own — a machi… |
| 211 | `src/actors/fort-boss-look.js` | 92 | BOSS 1 THE FORT BOSS'S LOOK (campaign/fort-boss.js drives him): the enemy rifleman's rig scaled to a 2.6–2.9… |
| 212 | `src/actors/fort-boss-glb.js` | 136 | BOSS 2 THE FORT BOSS AS A REAL RIGGED MODEL (FORTBOSS.model 'glb', FORTBOSS.looks): a Meshy community charac… |
| 214 | `src/actors/hands.js` | 42 | Z296 HANDS THAT HOLD: the Tripo / Mixamo rigs carry every finger (four joints each, both hands — 40 bones) b… |
| 215 | `src/actors/face-mask.js` | 128 | Z305 A MASK THAT FITS THE FACE: no new model needed. When a rigged character loads, its face is read from it… |
| 216 | `src/actors/driver.js` | 288 | Z296 THE DRIVER, A CHARACTER OF HIS OWN: the xe ôm / ba gác driver is no longer baked into the ride. He is h… |
| 217 | `src/actors/driver-acts.js` | 241 | Z331 THE DRIVER OFF THE RIDE: the crawl to a downed bike, the heave that rights it, and giving himself up wh… |
| 218 | `src/actors/driver-rant.js` | 252 | Z361 THE DRIVER'S TEMPER: the bike dies under him and he takes it personally. |
| 219 | `src/actors/driver-break.js` | 178 | Z363 THE DRIVER'S BREAK: after a long stretch of quiet riding he has had enough. He pulls over, the soldier … |
| 273 | `src/actors/drone.js` | 119 | DRONE 1 THE DRONE WAR'S AIRFRAMES. The old "support drone" power-up (a sci-fi gatling gunship circling a man… |
| 278 | `src/actors/soldiers.js` | 339 | infantryman: jointed legs (walk cycle), plate carrier + pouches, covered helmet w/ NVG mount, gloves, boots,… |
| 279 | `src/actors/loft.js` | 68 | Z246 SCULPTED SURFACES: one smooth skin lofted through key cross-sections (a horse's barrel, neck, head and … |
| 280 | `src/actors/horse.js` | 191 | Z245/Z246 THE WAR HORSE: one sculpted, skinned body (barrel, neck, head, four legs and tail lofted through r… |
| 281 | `src/actors/models.js` | 118 | Z247/Z248 REAL MODELS: glTF files put onto the procedural rigs — the photo-scanned CC0 rifle (Poly Haven) an… |
| 282 | `src/actors/general.js` | 227 | Z245/Z246 THE GENERAL: a big, modern heavy operator on the soldier's rig — one continuous skinned body (camo… |
| 283 | `src/actors/puppet.js` | 229 | Z294 A SECOND SOLDIER WEARING THE FIRST ONE'S MOVES: the Tripo special-forces soldier has his own Mixamo ske… |
| 284 | `src/actors/anim-lib.js` | 72 | ANIM 1 THE SOLDIER'S MOTION LIBRARY: some 290 Mixamo motions (walk / run / sprint / strafe / crouch-walk eig… |
| 285 | `src/actors/anim-graph.js` | 446 | GRAPH 1 THE SOLDIER'S MOTION GRAPH (the PLAYER'S soldier, on his feet; ANIMGRAPH.on — on by default since GR… |
| 286 | `src/actors/foe-bake.js` | 192 | FOE 1 THE ENEMY'S FULL SKELETON, BAKED ONCE A BATTLE (FOEANIM): the trooper (assets/models/real/trooper.glb … |
| 287 | `src/actors/foe-skin.js` | 46 | FOE 1 THE ENEMY'S SKELETON ON THE GPU: two instanced meshes of the trooper's own body (actors/foe-bake.js ge… |
| 288 | `src/actors/foe-anim.js` | 294 | FOE 1 THE ENEMY MOVES LIKE A MAN (FOEANIM; ?nofoeanim → none of it runs): every enemy rifleman on screen wit… |
| 289 | `src/actors/soldier-legs.js` | 218 | Z339 THE SOLDIER'S FEET ON THE GROUND: his clips only ever walk him forward, so backing up or moving sideway… |
| 290 | `src/actors/soldier-mount.js` | 83 | Z342 GETTING ON AND OFF THE WAY A RIDER DOES: he used to walk to the ride's right side and glide on a straig… |
| 291 | `src/actors/soldier-climb-pose.js` | 72 | Z451 HIS BODY ON THE FACE (game/soldier-climb.js runs the climb; the soldier's model has no climbing clip, s… |
| 292 | `src/actors/soldier-upper.js` | 105 | Z343 HIS UPPER BODY IN TIME WITH HIS LEGS: walking under his own legs (Z339) the rifle, shoulders and head w… |
| 293 | `src/actors/soldier-stirrups.js` | 47 | Z371 THE RIDER'S FEET IN THE STIRRUPS: the riding clips sit the soldier with his knees drawn up and his feet… |
| 294 | `src/actors/real-cav.js` | 460 | Z248 THE REAL CAVALRY: the Meshy-generated war horse, operator and carbine dressed over the procedural horse… |
| 295 | `src/actors/gun-feel.js` | 75 | GUN 3 THE FEEL OF A SHOT (config GUNFEEL.shot / .cycle; the soldier's own guns — combat/soldier-fire.js, act… |
| 296 | `src/actors/gun-reload.js` | 161 | GUN 2 THE RELOAD AS A SEQUENCE OF REAL STEPS, per weapon family (config GUNFEEL.reload; driven by actors/rea… |
| 297 | `src/actors/gun-hands.js` | 79 | GUN 1 THE HANDS ON THE GUN, HELD TO A MAN'S OWN JOINTS (config GUNFEEL.hold; the soldier on his feet — actor… |
| 298 | `src/actors/gun-carry.js` | 285 | CARRY 1 HOW A RIFLEMAN CARRIES HIS WEAPONS WHEN HE IS NOT AIMING THEM (config GUNCARRY; the soldier that is … |
| 299 | `src/actors/hang.js` | 19 | HANG 1 WHAT HE WEARS ON HIS BACK HANGS (config HANG): one damped pendulum in the back's own plane, shared by… |
| 300 | `src/actors/blade.js` | 559 | BLADE 2 THE WUXIA BLADE (config BLADE; ?noblade: none of it runs). The soldier always owns ONE ancient blade… |
| 301 | `src/actors/gun-fit.js` | 76 | Z360 THE HOLD READ OFF THE GUN ITSELF: no common template — every hand weapon's model is measured once when … |
| 302 | `src/actors/real-troops.js` | 150 | Z249 REAL INFANTRY at batch cost: one Meshy soldier (Z254: the ~10k-triangle, 2K-texture pass), posed once (… |
| 303 | `src/actors/troop-skin.js` | 34 | Z344 THE INFANTRY SKINNED ON THE GPU: every man of a side is one InstancedMesh of the whole body (actors/rea… |
| 304 | `src/actors/ragdoll.js` | 56 | Z254 A REAL FALL for a man shot down (enemy infantry, our fireteam, a general without his real model): the k… |
| | **ai/** — Trí tuệ địch | | |
| 134 | `src/ai/tactics.js` | 45 | THE ENEMY'S FRAME: every enemy unit's HP bar, burning, stun and first sighting; then the infantry (actors/in… |
| 135 | `src/ai/foe-sleep.js` | 25 | PERF 2 THE ACTIVE-ENEMY BUDGET (C1-024): a fort's garrison, its camps, its towers and the waves together put… |
| 136 | `src/ai/cover.js` | 14 | Z104 COVER: a soldier who sees a tank coming puts a wall, rock or sandbag line between it and himself (both … |
| 137 | `src/ai/spatial.js` | 25 | Z172 UNIT GRID: a uniform hash of every unit (rebuilt once a frame) and of the obstacles (rebuilt when they … |
| 138 | `src/ai/squads.js` | 136 | Z173 SQUAD TACTICS: enemy foot squads get a leader, a formation and one shared plan (advance → fire-and-mano… |
| 139 | `src/ai/tiers.js` | 118 | DIR 2 TACTICS BY TIER: what the enemy's foot squads know how to do grows with the stage (tacTier 1…3; DIRECT… |
| 140 | `src/ai/awareness.js` | 92 | AI 1 WHAT EACH ENEMY SOLDIER KNOWS. Every man on foot used to know where the player was the moment he existe… |
| 141 | `src/ai/fieldcraft.js` | 88 | Z220 FIELDCRAFT, for the soldiers of BOTH sides: |
| | **campaign/** — Chiến dịch, đợt, tướng, pháo kích | | |
| 123 | `src/campaign/surprises.js` | 67 | Z223 THE FIGHT SURPRISES YOU: every minute or so, out of a weighted, stage-gated hat, something you didn't p… |
| 124 | `src/campaign/story.js` | 107 | STORY 1–3 THE CAMPAIGN'S STORY AND THE RADIO THAT FOLLOWS THE FIGHT (config.js STORY: the cast, the five sta… |
| 125 | `src/campaign/director.js` | 181 | DIR 1 THE BATTLE'S DIRECTOR: reinforcements, surprises and the finale are released by the STATE of the fight… |
| 126 | `src/campaign/entries.js` | 53 | AI 2 NOBODY POPS INTO EXISTENCE. Every enemy soldier raised during a battle comes onto the field by a way th… |
| 127 | `src/campaign/side-missions.js` | 217 | EVENT 1 SIDE MISSIONS IN THE MIDDLE OF A FIGHT (config.js SIDEMISSION): when the director has room for more,… |
| 128 | `src/campaign/big-events.js` | 198 | EVENT 2 BIG BATTLEFIELD EVENTS (config.js BIGEVENT): now and then the battle itself does something big — dra… |
| 133 | `src/campaign/operations.js` | 125 | Z83 · CAMPAIGN OPERATIONS — named operation per stage: briefing, radio chatter, scripted waves and a high-va… |
| 158 | `src/campaign/waves.js` | 110 | WAVES: difficulty / NG+ loop multipliers, wave queue per stage, random wave events, edge spawn points |
| 159 | `src/campaign/boss.js` | 41 | THE STAGE'S GENERAL (no-tanks: Z96 the super-heavy, its weak points, armour arcs, phases, shield pylons, min… |
| 202 | `src/campaign/soldier-war.js` | 24 | Z309 A SOLDIER'S WAR: the waves are men — riflemen and RPG teams, squads, troop helicopters dropping more me… |
| 209 | `src/campaign/general-duel.js` | 84 | Z353 THE GENERAL ON FOOT (no-tanks: the stage's boss fight): the general waits in his citadel and takes the … |
| 210 | `src/campaign/fort-boss.js` | 287 | BOSS 1 A BOSS IN EVERY FORT (FORTBOSS; his look: actors/fort-boss-look.js). Every fort holds ONE boss, a mod… |
| 213 | `src/campaign/nemesis.js` | 191 | NEMESIS 1–3 THE ENEMY GENERAL REMEMBERS YOU (config.js NEMESIS; the record, its sanitiser and the rules are … |
| 238 | `src/campaign/artillery.js` | 31 | ARTILLERY STRIKES: a locked spot (the objective battery's), the shell in flight, the burst, shrapnel hit vs … |
| 275 | `src/campaign/drone-raid.js` | 135 | DRONE 3 THE ENEMY'S DRONES, AND THE JAMMER. A raid is one draw of the surprises' hat (campaign/surprises.js … |
| 307 | `src/campaign/mode-run.js` | 115 | MODE 3 THE RUN KIT of the two extra modes (night defence: campaign/night-defence.js · the daily challenge: c… |
| 308 | `src/campaign/night-defence.js` | 192 | MODE 1 NIGHT DEFENCE ("THỦ ĐÊM", config NIGHTDEF; the run kit: campaign/mode-run.js; its arithmetic: data/mo… |
| 309 | `src/campaign/daily.js` | 84 | MODE 2 THE DAILY CHALLENGE ("THỬ THÁCH HÔM NAY", config DAILY; the run kit: campaign/mode-run.js; the genera… |
| 310 | `src/campaign/conquest.js` | 172 | CONQ 1 CHINH PHẠT 10 THÀNH (config CONQUEST; the road on the battle setup: ui/conquest-map.js). The campaign… |
| 312 | `src/campaign/sectors.js` | 261 | SECTOR 1 A LONG BATTLE IS A CHAIN OF SECTORS (config.js SECTOR · the rail and the transit's overlay: ui/sect… |
| 313 | `src/campaign/mixer.js` | 83 | MIX 1 composeBattle(spec): ONE BATTLE FROM A BattleSpec (the arithmetic: data/mixer-math.js · the numbers: c… |
| 315 | `src/campaign/sector-goals.js` | 200 | SECTOR 2 THE FOUR NEW SECTOR MISSIONS (config.js SECTOR.types · the run and its flow: campaign/sectors.js). … |
| 316 | `src/campaign/sector-route.js` | 86 | SECTOR 4 THE ROUTE OF A LONG BATTLE (config.js SECROUTE · the run itself: campaign/sectors.js · the card, th… |
| 317 | `src/campaign/conq-story.js` | 43 | SECTOR 6 THE CONQUEST'S STORY, FORT BY FORT (config.js CONQSTORY · text only). A fort's battle is a sector r… |
| 318 | `src/campaign/tyrant.js` | 37 | SECTOR 6 BẠO CHÚA, THE LAST FORT'S GENERAL (config.js CONQSTORY.tyrant). He is the citadel's boss of campaig… |
| | **loot/** — Vật phẩm, rơi đồ, nâng cấp roguelite | | |
| 206 | `src/loot/soldier-arms.js` | 37 | Z352 ARMS OFF THE FIELD (soldier mode only): what a dead enemy carried is his to take. A rifleman sometimes … |
| 207 | `src/loot/gift-crate.js` | 90 | Z369 / Z370 THE RANK'S SUPPLY BUNDLE (soldier mode): what the HQ drops when he climbs a rank — a real airdro… |
| 208 | `src/loot/loot-real.js` | 46 | LOOT 1 THE LOOT IS REAL: every pick-up wears a downloaded 3D model at its real size (tools/loot-pack.mjs → a… |
| 239 | `src/loot/powerups.js` | 166 | Z93 DROPS: the loot is a real object — it pops out of the wreck in an arc, bounces, raises dust, then sits u… |
| 240 | `src/loot/relic.js` | 101 | Z153 THÁNH TÍCH: one ancient relic per stage — a floating crystal over a rune plinth under a pillar of light. |
| 241 | `src/loot/upgrades.js` | 53 | THE STAGE WON: pick 1 of 3 of the soldier's perks (game/soldier-rank.js), then the next battlefield is built… |
| 277 | `src/loot/beacons.js` | 38 | LOOT MARKERS (crates / towers / huts / tanks that hide a power-up) · Z177 no light columns · Z211 the object… |
| | **input/** — Bàn phím, chuột, cảm ứng | | |
| 224 | `src/input/input.js` | 186 | INPUT: mouse aim raycast, keyboard, touch joysticks + action buttons, auto-fire |
| 225 | `src/input/bindings.js` | 119 | Z118 ONE BINDING TABLE for the keyboard and the controller: every action (drive, fire, skill, guns, squad or… |
| 226 | `src/input/gamepad.js` | 155 | Z117/Z118 GAMEPAD + HAPTICS. Plays the whole game from a controller through the Gamepad API ("standard" mapp… |
| 227 | `src/input/padmap.js` | 75 | Z123 LEARN A PAD'S LAYOUT. Over USB on a Mac (and for many DInput pads) the browser hands back a GENERIC HID… |
| | **ui/** — Giao diện DOM (menu, shop, HUD phụ, gợi ý) | | |
| 21 | `src/ui/icons.js` | 137 | CUSTOM ICON SET (military line-art; no emoji) |
| 22 | `src/ui/gunart.js` | 71 | Z150 ONE PICTURE PER GUN, EVERYWHERE: the KHO SÚNG cards, the battle HUD, the deploy list and the "new gun" … |
| 45 | `src/ui/build-watch.js` | 25 | PERF 19 (critic C2-026) A NEW BUILD IS OFFERED, NEVER MIXED IN: the page runs the build index.html read from… |
| 117 | `src/ui/tips.js` | 45 | Z94 · FIRST-TIME TIPS — the first time something new happens, a short field note explains it (Z168: a side c… |
| 242 | `src/ui/briefing.js` | 155 | STAGE BRIEFING: choose 1 of 3 contracts before the stage's waves begin; XK-UI its back button: to the battle… |
| 243 | `src/ui/deploy.js` | 78 | Z105 DEPLOYMENT before every stage: troop strength, key points to post men at, |
| 245 | `src/ui/menus.js` | 44 | title screen: greeting, the hero (CHƠI NGAY / CHƠI TIẾP), nickname dialog, and the shared tap helpers (tapBt… |
| 246 | `src/ui/terrain-picker.js` | 50 | Z103 split from ui/menus.js. TERRAIN PICKER — start-screen battlefield choice (AUTO campaign rotation or a f… |
| 247 | `src/ui/battle-setup.js` | 87 | Z107 BATTLE SETUP: PLAY opens it. CAMPAIGN = a ladder of levels in rising difficulty (win one to open the ne… |
| 248 | `src/ui/load-veil.js` | 44 | NO-TANKS 8 THE DEPLOYMENT ORDER: the screen between XUẤT KÍCH and the battle (#loadVeil) is the order the so… |
| 249 | `src/ui/setup-units.js` | 65 | Z354 WHO GOES INTO BATTLE (TRANG BỊ, the first step of CHUẨN BỊ TRẬN, ui/battle-setup.js runs the steps; no-… |
| 250 | `src/ui/padview.js` | 70 | Z125 CONTROLLER DIAGRAM: a shaded (pseudo-3D) gamepad drawn in SVG with a label on every control showing wha… |
| 251 | `src/ui/keys.js` | 35 | Z107 CONTROLS SHEET: every key / touch control in one place — from the home menu (PHÍM TẮT), the pause menu,… |
| 252 | `src/ui/guide.js` | 40 | Z103 split from ui/menus.js. FIELD MANUAL — the how-to-play screen (first launch + re-openable) and the firs… |
| 253 | `src/ui/settings.js` | 122 | Z103 split from ui/menus.js · XK-UI SETTINGS in tabs (Trò chơi · Hình ảnh · Âm thanh · Điều khiển · Tay cầm … |
| 254 | `src/ui/confirm.js` | 13 | XK-UI ONE CONFIRMATION DIALOG (#xkConfirm) for the choices that throw something away: leaving a battle, rest… |
| 255 | `src/ui/hud-prefs.js` | 12 | Z324 WHAT THE BATTLE HUD SHOWS (CÀI ĐẶT): the dialogue on screen (the radio box, the driver's and the soldie… |
| 256 | `src/ui/nocenter.js` | 56 | NOCENTER · no words over the aim. In a battle nothing textual is drawn inside the aim zone (NOCENTER.zone, t… |
| 257 | `src/ui/hudux.js` | 100 | HUDUX the critic's HUD / UI-UX round 1: one small clock (4×/s) that keeps the battle HUD honest, and the rul… |
| 258 | `src/ui/loadout.js` | 37 | Z103 split from ui/menus.js. KHO SÚNG — Z411 THE SOLDIER'S ARSENAL (from the start screen, CHUẨN BỊ TRẬN or … |
| 259 | `src/ui/medals-ui.js` | 116 | MEDAL 3 THE CAREER ON SCREEN: the shoulder board a rank wears, the medal discs, a medal's toast and the rank… |
| 260 | `src/ui/result-fx.js` | 24 | UIX 3 the end-of-battle numbers count up: when a result screen opens (#gameover, #victory, #modeEnd, the bat… |
| 261 | `src/ui/ranking.js` | 30 | Z163 BẢNG XẾP HẠNG: this week's and all-time best runs (lb/{uid}, lbw/{week}/e/{uid} — written only by the s… |
| 266 | `src/ui/radar.js` | 51 | RADAR / MINIMAP |
| 267 | `src/ui/instruments.js` | 67 | Z228 the soldier's instrument panel (desktop HUD, bottom-right): a north-up azimuth dial with him and his ri… |
| 268 | `src/ui/squad-hud.js` | 25 | Z220 TỔ BỘ BINH panel (desktop HUD, bottom-left): the squad order in force ([U] cycles it), how the squad re… |
| 272 | `src/ui/alarm.js` | 34 | CORE-UNDER-ATTACK ALARM. Z133 early warning: the moment the core takes damage a banner shows its HP and dist… |
| 276 | `src/ui/drone-hud.js` | 77 | DRONE 1 WHAT THE DRONE WAR SHOWS HIM: the red diamond over every marked enemy (one instanced mesh drawn over… |
| 311 | `src/ui/conquest-map.js` | 41 | CONQ 1 THE CONQUEST'S ROAD on the battle setup's "Chiến dịch" tab (config CONQUEST; the battles: campaign/co… |
| 319 | `src/ui/sector-hud.js` | 86 | SECTOR 1 what a sector run shows (css/sector.css): THE RAIL — one small line at the top of the HUD, "1 NGOẠI… |
| 320 | `src/ui/threat-edge.js` | 47 | BAL 3 A SHOOTER OFF THE SCREEN IS SHOWN AT ITS EDGE: a red chevron on the screen's rim toward every man off … |
| 324 | `src/ui/coop-lobby.js` | 48 | COOP 4 THE CO-OP LOBBY'S SCREEN (shown instead of the home screen when the address has ?room=CODE) and the t… |
| | **game/** — Luồng game, vòng lặp, khởi động | | |
| 184 | `src/game/xeom.js` | 199 | Z282 XE ÔM MODE (Z332 the xích lô is gone): the cavalry mode (game/cavalry.js) with a Vietnamese ride instea… |
| 185 | `src/game/ride-wear.js` | 41 | Z303 THE RIDE WEARS OUT: the xe ôm / ba gác / bán tải has its own health. Hits taken while riding (a share o… |
| 186 | `src/game/ride-collide.js` | 97 | Z311 WHAT A RIDE RUNS INTO: the xe ôm (or the horse) is held by everything a tank simply rolls over — trees,… |
| 187 | `src/game/ride-avoid.js` | 97 | RIDE 1 THE MOUNT PICKS ITS OWN LINE (the war horse and the xe ôm alike; game/cavalry.js asks once a frame). … |
| 188 | `src/game/ride-feel.js` | 50 | RIDE 2 THE HARD STOP (both mounts; game/cavalry.js asks once a frame in the saddle). Reined in from speed — … |
| 190 | `src/game/soldier-moves.js` | 54 | Z336 THE SOLDIER ON HIS FEET MOVES LIKE ONE (soldier mode, off the ride): Space jumps (a spring off both fee… |
| 191 | `src/game/soldier-climb.js` | 156 | Z451 THE SOLDIER CLIMBS (soldier mode, on foot): with a rock, a fortress wall or gate, a ruin, a container, … |
| 192 | `src/game/swim.js` | 182 | SWIM 1 THE SOLDIER IN THE RIVER (soldier mode, on foot; config SWIM): the water's depth at his feet (RIVER.y… |
| 193 | `src/game/horse-swim.js` | 93 | HSWIM 1 THE HORSE SWIMS (config HORSESWIM): the war horse in the river by the depth under it (RIVER.y − the … |
| 196 | `src/game/logistics.js` | 173 | SUPPLY 1 AMMUNITION IS A SUPPLY LINE (soldier mode): the reserve of rounds behind every magazine, what a rel… |
| 197 | `src/game/ambush.js` | 77 | AMBUSH 1 THE BLADE DOES NOT GIVE HIM AWAY: hide behind a rock or a container, dart out, cut one man down, ge… |
| 198 | `src/game/quiet.js` | 116 | SUPPLY 3 QUIET OR LOUD (soldier mode, on foot): the suppressed gun, the knife, the bodies left behind, the a… |
| 199 | `src/game/stealth.js` | 56 | Z377 A MAN FLAT ON THE GROUND IS HARD TO SEE (soldier mode, on foot): every enemy gun used to take the playe… |
| 200 | `src/game/ride-impact.js` | 30 | Z306 THE RIDE MEETS THE STREET (soldier mode only; the tank keeps its own run-over in world/traffic.js): wha… |
| 201 | `src/game/ride-call.js` | 67 | Z306 CALL THE RIDE (soldier mode only): on foot, a button (and G) tells you where your ride stands — LÊN XE … |
| 203 | `src/game/medals.js` | 83 | MEDAL 2 THE BATTLE'S LEDGER: who killed what and how (his round, his blade, his grenade, his charge — or his… |
| 204 | `src/game/soldier-rank.js` | 97 | Z350 THE SOLDIER'S CAREER (soldier mode only): every man he or his squad drops is experience, and experience… |
| 222 | `src/game/score.js` | 24 | SCORE / COMBO |
| 223 | `src/game/player-damage.js` | 99 | PLAYER DAMAGE / DEATH |
| 244 | `src/game/flow.js` | 145 | GAME FLOW: start / pause / quit-to-menu, loadout guns for the run, menu ↔ HUD state, show/hide panels |
| 263 | `src/game/update.js` | 194 | the camera that follows the soldier, the enemy vehicles' rigs, Vietnamese label helpers (no-tanks: the tank'… |
| 264 | `src/game/intro-clouds.js` | 49 | Z322 THE INTRO'S SKY: high over the field the air is hazy and a thin deck of soft clouds drifts between the … |
| 265 | `src/game/intro.js` | 172 | INTRO CINEMATIC (deploy showcase) |
| 305 | `src/game/cavalry.js` | 237 | Z245 CAVALRY MODE: the player is a general in full plate — on his armoured war horse (walk · trot · canter ·… |
| 321 | `src/game/loop.js` | 170 | MAIN LOOP: per-frame update + render orchestration, frame pacing, ability cooldown dials |
| 322 | `src/game/viewport.js` | 30 | Z103 split from game/loop.js: canvas/render-target sizing, the soft-keyboard guard, landscape gate, |
| 323 | `src/game/boot-gate.js` | 69 | Z103 split from game/loop.js: the branded splash, real boot progress, sliced shader warm-up, |
| 325 | `src/game/coop-remote.js` | 113 | COOP 5 THE OTHER PLAYER'S SOLDIER on this page: the same rig the local soldier wears (buildGeneral + his hor… |
| 326 | `src/game/coop-puppets.js` | 137 | COOP 6 ONE BATTLE: the host is the authority for the enemy. HOST: every enemy unit into the snapshot (coopHo… |
| 327 | `src/game/coop-world.js` | 139 | COOP 9 ONE SHARED BATTLE: what stands, what lies on the ground and the Core's health are the HOST's, on both… |
| 328 | `src/game/coop-team.js` | 97 | COOP 9 WHAT TWO PLAYERS DO TOGETHER (numbers: config COOP2; rules: net/rules.js). |
| 329 | `src/game/coop-glue.js` | 229 | COOP 4–7 THE GAME'S SIDE OF TWO-PLAYER CO-OP (the net layer is src/net/*; the screen ui/coop-lobby.js; the o… |
| 330 | `src/game/startup.js` | 25 | Z103 COMPOSITION ROOT. Last system module in hub.js: everything is defined, so this is where the |
| | **dev/** — Móc kiểm thử / gỡ lỗi (không ảnh hưởng gameplay) | | |
| 314 | `src/dev/mixer-desk.js` | 141 | MIX 3 THE MIXER DESK (mixer.html): ten macro faders, the channel strips, live scores / clamps / warnings / t… |
| 331 | `src/dev/hooks.js` | 72 | Z103 split from game/loop.js: window._* inspection/driving hooks used by Playwright smoke tests and the |
| 332 | `src/dev/bot.js` | 225 | BOT 1 THE FIGHTING BOT: a player at the keyboard and mouse for calibrating the battle mixer (tools/calib.mjs… |
| 333 | `src/dev/gltf-trace.js` | 49 | GLTF 1 THE MODEL LOADER'S BLOB LEDGER (dev only, asleep unless ?gltftrace): every blob: URL made and revoked… |
| 334 | `src/dev/pose-studio.js` | 129 | Z349 THE POSE STUDIO: calibrate and judge how a soldier holds each of his weapons — for every new soldier mo… |
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
| R1 | Module hệ thống chỉ import từ: `three`, `three/addons/…`, `config.js`, `data/*`, `hub.js`. **Không import thẳng module hệ thống khác** (giữ thứ tự ở một chỗ). Ngoại lệ: `data/*` và `net/*` được import anh em cùng tầng (`./x.js`). |
| R2 | `data/*` **thuần**: không import hub, không three.js, không DOM / `window` / `localStorage`. |
| R3 | Mỗi module có mặt trong `hub.js` **đúng một lần**. |
| R4 | Tên export **duy nhất toàn dự án** (`export *` âm thầm bỏ tên trùng → lỗi rất khó thấy). |
| R5 | Module > 700 dòng → cảnh báo, tách tiếp. |
| R6 | Mọi `data/*` đứng trước module hệ thống đầu tiên trong hub. |
| R7 | `index.html` không còn `<script type="module">` hay `<style>` inline. |
| R12 | Dòng đầu mỗi module: `// tầng/file.js — <module này sở hữu gì>` — nguồn của bảng §2.1 (`npm run modmap`). |
| R13 | `net/*` (co-op) **thuần và tự đứng được**: không import hub, không three.js, không DOM / `window` / `localStorage` (cần thì `globalThis.x` có kiểm tra, hoặc truyền vào). Được import module anh em `./x.js` và `config.js`. Nhờ vậy `npm run coop-test` chạy cả tầng mạng bằng node, không cần trình duyệt. |

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
- **Súng** (vũ khí cầm tay của lính, `trooper:true`): có `name`, icon, loại sát thương tồn tại trong `DMG_TYPE`, `mag/reload/fireCd > 0`, mô hình + tư thế cầm trong `INFGUN` / `GUNHOLD`.
- **Địch**: chỉ bộ binh (`rifle`, `rpg`) và trực thăng (`gunship`, `heliBomb`, `heliTroop`); `hp/speed/score` hợp lệ. Bảng cũ xin một loại không còn → ra lính súng trường.
- **Tướng**: một tướng cho mỗi chiến dịch, chỉ `id` + `name` — giữ thành trung tâm và đấu tay đôi với người lính (`campaign/general-duel.js`).
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
2. Súng cầm tay (`trooper:true`): mô hình `assets/models/real/gun/inf/` + `config.js` → `INFGUN.map/guns` và `GUNHOLD` (cách cầm); biểu tượng: `src/ui/icons.js`.
3. Hành vi đặc biệt dùng trường dữ liệu có sẵn (`aoe`, `homing`, `pierce`, `chain`, `special`) trước khi viết code mới trong `combat/`.
4. `npm test` → chạy thử → DOCS/LEVELS.

### 5.2 Thêm một loại địch `abc`
`data/enemies.js` (`ENEMY_DEFS.abc`, `inf:true` cho bộ binh, `air` cho trực thăng) → hành vi trong `actors/infantry.js` / `actors/helis.js` hoặc module mới `actors/abc.js` (+1 dòng hub) → xuất hiện trong đợt: `campaign/soldier-war.js` (`CAV.soldier.war.w`).

### 5.3 Thêm / đổi tướng
`data/bosses.js`: `{ id, name }` (`BOSS_DEFS` theo màn, `BOSS_NEW` + `BOSS_ALT` cho vòng NG+ lẻ). Người lính bước vào thành trung tâm (`world/fortress.js`) → `campaign/boss.js` `startBoss` → `generalStart` trong `campaign/general-duel.js`; hạ tướng là thắng màn (`bossStageWon`).

### 5.4 Đổi chiến lược sức mạnh / độ khó
Chỉ sửa `config.js`: `BALANCE` (máu/sát thương/đợt), `RAMP` (tăng theo màn), `BALANCE.difficulty` (3 mức), `TACTICS` (IQ địch), `LOOT` (vật phẩm), `DRIVE` (lái). Test cân bằng trong `test.js` phải vẫn xanh.

### 5.5 Đổi / thêm cốt truyện, chiến dịch
`config.js` → `OPERATIONS` (story, brief, radio theo đợt, win, script đợt) + `OBJECTIVES`. Test bắt buộc có chữ tiếng Việt. Thêm màn thứ 6 = thêm 1 operation + 1 tướng + (tuỳ chọn) 1 biome — test "một tướng mỗi chiến dịch" sẽ nhắc nếu thiếu.

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
| **F. Chế độ** | co-op chiến dịch 2–4 người, PvP bộ binh, thử thách ngày (cùng seed), xếp hạng | sau E |

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
