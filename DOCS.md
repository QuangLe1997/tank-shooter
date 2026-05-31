# TANK SHOOTER — Tài liệu game (Game Bắn Xe Tăng)

> Đọc file này là hiểu toàn bộ game + biết chỗ nào để sửa, **không cần scan lại `index.html`**. Mục tiêu: 1 file duy nhất [`index.html`](index.html), zero-build.
>
> ✅ **Trạng thái: HOÀN THÀNH (P1–P9) + REWORK v2 (R1–R7) + TINH CHỈNH v3/v4 + VISUAL OVERHAUL v4 (G1–G5).** Game chơi trọn vẹn, live tại https://quangle1997.github.io/tank-shooter/. Kịch bản ở **[`GAME_DESIGN.md`](GAME_DESIGN.md)**. File này theo dõi bản đồ code (§0) + lịch sử (§14). **Toàn bộ chữ trong game là tiếng Anh; icon là bộ SVG tự vẽ (không emoji).**

### Rework v2 (R1–R7) — hệ thống hiện hành
| Mục | Trạng thái | Ở đâu |
|---|---|---|
| Xe tăng **không bao giờ chồng nhau** (tách cứng + hất văng) | ✅ | `separateTanks()` |
| **Súng kiểu mới**: băng đạn + nạp đạn (3-4s) + mảnh vỡ + auto-fire | ✅ | `GUNS`, `fireGun()`, `startReload()` |
| **Auto-aim** (mobile nòng tự khoá địch gần nhất) · desktop ngắm chuột | ✅ | `nearestTarget()`, `updatePlayer` |
| **Kho súng**: bắt đầu 1 súng cơ bản, nhặt thêm, đổi liên tục (1-8/cuộn/nút) | ✅ | `p.guns[]`, `giveGun/selectGun/cycleGun`, HUD `#gunlist` |
| **Buff theo thời gian (≤15s)**: ⚡bắn nhanh 💥sát thương 🏃tốc độ 📦băng đạn ∞vô hạn | ✅ | `POWERUPS`, `applyPowerup()`, `p.buffUntil`, `#buffbar` |
| Đạn nhiều → di chuyển chậm hơn xíu | ✅ | `updatePlayer` (heavy factor) |
| **Địa hình**: tường gạch (phá được) + khối thép (chắn) — cản xe & đạn | ✅ | `buildBlocks()`, `damageBlock()`, va chạm trong `updateBullets`+`separateTanks` |
| Xe tăng đẹp/hoành tráng hơn + camera thấp/chân thực hơn | ✅ | `buildTank()`, `updateCamera()` |
| Địch dễ hơn cho người mới, khó tăng dần theo màn | ✅ | `diffScale()`, `buildWaveQueue`, fire scaling |

**8 súng** (tier 1→3): rifle · smg · shotgun · flak · cannon · minigun · missile · railgun — mỗi súng = bộ thông số (dmg/fireCd/mag/reload/frags/spread/bspeed). Sửa cân bằng → chỉ chỉnh `GUNS`.

### Tinh chỉnh v3 (T1–T5)
| Mục | Ở đâu |
|---|---|
| **Phạm vi tác chiến**: vòng tròn mờ quanh player; chỉ bắn khi địch vào vùng; đạn chỉ tới trong vùng; mở theo màn + buff 🎯 + nâng cấp | `playerRange()`, `rangeRing`, gate trong `updatePlayer`, `maxDist` đạn |
| **Nổ xe hoành tráng** (flash+cầu lửa+mảnh văng+cột khói) + impact theo cỡ đạn | `tankExplode()` |
| **Vật phẩm** nhấp nháy + icon riêng từng loại + vòng đếm ngược (hết → biến mất) | `dropPowerup/updatePickups`, `emojiTex()` |
| **Đánh boss**: player **to bằng boss** (radius động) + tông húc văng nhau, không xuyên qua | `p.scale/p.radius`, `separateTanks` boss |
| **Khoảng cách min** giữa mọi xe (không dính sát) | `separateTanks` (GAP=0.7) |
| **Địa hình mê cung** dạng I/L/U/T/Z để ẩn nấp | `MAZE_SHAPES`, `buildBlocks()` |

### Visual overhaul v4 (G1–G5) — đánh bóng giao diện
| Mục | Ở đâu |
|---|---|
| **Toàn bộ chữ → tiếng Anh** (HUD, menu, tên súng/phép/buff/nâng cấp/boss/biome, banner) | `GUNS/SPELLS/POWERUPS/UPGRADES/BOSS_DEFS/BIOMES`, HTML overlay, `showBanner` |
| **Skin xe tăng chân thực**: texture tôn thép (panel/rivet/xước) + tread; PBR bắt phản chiếu; chạy gầm chi tiết; nòng có ống nhiệt + hút khói + hãm đầu nòng; tier `detail` (player+boss) thêm giỏ sau tháp/ống phóng khói/MG/đinh tán/móc kéo/ống xả | `panelTex()/trackTex()`, `buildTank({detail})` |
| **Camera mở màn điện ảnh**: hero thấp khoe nòng → vòng quanh kiểu duyệt binh → toàn cảnh → khớp đúng khung gameplay; letterbox + hạ-tiêu-đề + nút bỏ qua; ẩn HUD khi diễn; bỏ qua bằng input | `startIntro/updateIntro/endIntro`, biến `intro`, mode `'intro'` |
| **Bộ icon SVG tự vẽ (bỏ hết emoji)**: 33 glyph line-art quân sự; HUD/menu/nâng cấp dùng chung; badge tròn cho vật phẩm rơi | `GLYPH`, `iconEl/setIcon/initIcons`, `svgBadgeTex()` |
| **HUD/menu theme nhất quán + icon chuẩn** cho súng/đạn/máu/căn cứ/tốc/phép; vị trí gọn dễ quan sát; màu HP đỏ · căn cứ hổ phách · sẵn-sàng xanh · nạp-đạn đỏ | CSS `.ic/.gunicon/#weaponchip/.buffchip/.upcard`, `updateGunHUD/updateSpellHUD/updateBuffHUD` |
| **Mobile (chỉ ngang)**: 1 joystick lái (nòng tự ngắm + tự bắn → bỏ cần ngắm/nút bắn); nút **SWAP** (hiện súng đang dùng) / **DASH** / **SKILL** có nhãn; ẩn gunlist + chỉ báo phím desktop; HP/căn cứ lên góc trái khỏi vùng ngón cái; menu thu gọn; cổng xoay máy khi cầm dọc + tự pause | `onTouchStart/Move/End` (`move`), `body.touch` CSS, `#rotate`, `checkOrientation()` |

---

## 0. TRẠNG THÁI TÍNH NĂNG (đọc cái này trước)

Cột "Ở đâu" = tên hàm / marker để `grep`. Trạng thái: ✅ xong · 🚧 đang làm · ⬜ chưa làm.

### Khung dự án (đã có)
| Mục | Trạng thái | Ở đâu |
|---|---|---|
| Repo + GitHub Pages | ✅ | `main`/root → https://quangle1997.github.io/tank-shooter/ |
| Single-file zero-build (Three.js CDN) | ✅ | `index.html` (`<script type="module">`) |
| Kịch bản game đầy đủ | ✅ | `GAME_DESIGN.md` |
| Tài liệu + luật dự án | ✅ | `DOCS.md`, `CLAUDE.md` |

### Tiến độ build (theo phase trong GAME_DESIGN §14)
| Phase | Nội dung | Trạng thái | Ở đâu |
|---|---|---|---|
| **P1** | Engine + player tank (move/aim 360°/dash i-frame) + camera follow + twin-stick mobile + HUD skeleton | ✅ | `CONFIG/STATE/THREE SETUP/ARENA/PLAYER TANK/INPUT/UPDATE/MAIN LOOP` |
| **P2** | Bắn (Cannon) + đạn pool + va chạm + hit flash + damage/float text + muzzle light + shockwave ring | ✅ | `PROJECTILES`, `fireWeapon()`, `FX` |
| **P3** | 3 loại địch (grunt/scout/gunner) + AI + wave spawner + Core (căn cứ) bảo vệ + score/combo + chết/mạng/respawn + game-over | ✅ | `ENEMIES`, `WAVES`, `CORE`, `SCORE/COMBO`, `PLAYER DAMAGE` |
| **P4** | Juice: particle pool (sparks/smoke/debris) cho nổ/muzzle/hit/dash + screen shake + bloom; Audio: synth SFX (bắn/nổ/trúng/đau/core/wave/dash) + nhạc nền procedural 128 BPM (kick+bass+lead+hat), resume trong gesture | ✅ | `PARTICLES`, `AUDIO`, `bigExplode()`, `renderSong()` |
| **P5** | 6 vũ khí (đại bác/liên thanh/súng hoa/railgun/tên lửa dò/flak AoE) đổi bằng 1-6 hoặc cuộn/nút; 6 phép (tăng tốc/khiên/EMP/sửa chữa/không kích/ngưng đọng) cast E/nút + cooldown; power-up rơi (⭐💣⏱🛡❤️🔧) + nam châm hút + comeback-bias; weaponLvl nâng cấp | ✅ | `WEAPONS`, `SPELLS`, `POWERUPS`, `fireWeapon()`, `trySpell()`, `dropPowerup()` |
| **P6** | Khung boss đa pha + Boss S1 **Mãnh Ngưu** (húc telegraph + quạt/đạn vòng, pha 2 khi <50% HP) + thanh máu boss + wave→boss (sau đợt 5) + slow-mo khi hạ + lên màn | ✅ | `BOSS_DEFS`, `startBoss/updateBoss/killBoss()`, `bossSpread()` |
| **P7** | 5 biome (sa mạc/đô thị/băng/công xưởng/thành trì — đổi bg/fog/đất/đèn) + **màn nâng cấp roguelite (chọn 1/3 thẻ)** sau mỗi boss + 3 loại địch mới (mortar telegraph/shield chắn trước/bomber tự nổ) + wave theo màn + Victory + NG+ | ✅ | `BIOMES`, `applyBiome()`, `UPGRADES`, `openUpgrade/chooseUpgrade()`, `victory()`, mortar/shield/bomber trong `ENEMY_DEFS`/`updateEnemies` |
| **P8** | 5 boss phân hoá: Mãnh Ngưu (húc), Phong Bão (xoáy ốc+tên lửa dò+triệu quân), Cự Thần (đạn vòng+dậm đất+mìn), Tử Thần (laser quét+dịch chuyển+triệu), Bá Vương (tổng hợp+cuồng nộ) + Victory + NG+ | ✅ | `bossAttack()`, `groundPound/bossMine/bossMissiles/bossSummon`, laser trong `updateBoss` |
| **P9** | Auto-aim assist (mobile) + nút tắt tiếng + adaptive FPS (tự giảm độ phân giải khi lag) + cân bằng độ khó + gỡ dev-cheat | ✅ | `updatePlayer` (aim assist), `setMuted()`, `_fpsAcc` trong `loop()` |

### Điều khiển đã chạy (P1)
- Desktop: WASD/mũi tên di chuyển · chuột ngắm (raycast → mặt đất) · Space lướt (dash + i-frame, cooldown) · Esc/P pause.
- Mobile: nửa trái = joystick di chuyển (origin động nơi chạm) · nửa phải = joystick ngắm twin-stick · nút 💨 Dash / 🪄 Phép · ⏸ pause. `body.touch` tự bật.

---

## 1. Tổng quan & Context

- **Thể loại:** Game bắn xe tăng (tank shooter). Góc nhìn / 2D-3D: **chưa chốt** — sẽ quyết theo mô tả.
- **Mục tiêu (dự kiến):** điều khiển xe tăng, bắn hạ mục tiêu/địch, sống sót & ghi điểm.
- **Triết lý kế thừa từ neon-serpent-3d:** 1 file tự chạy, zero-build, không chói, chữ rõ, mobile-friendly.

### Tech stack (zero build — TBD chi tiết)
- Hiện tại: **Canvas 2D thuần** (không thư viện) cho nền placeholder.
- Có thể nâng lên Three.js (qua importmap CDN) nếu chọn hướng 3D — quyết sau.
- Âm thanh: dự kiến Web Audio API synth (không file ngoài).
- Lưu trữ: `localStorage`.

### Chạy / Deploy
- **Chạy qua HTTP server** (tránh chặn module ở `file://`):
  - `cd tank-shooter` → `python3 -m http.server 8765` → mở `http://localhost:8765/index.html`.
- **GitHub Pages:** bật sẵn từ nhánh `main`, thư mục `/` → **https://quangle1997.github.io/tank-shooter/** (tự cập nhật mỗi lần push `main`).
- Repo: `github.com/QuangLe1997/tank-shooter` (public).

---

## 2. Cấu trúc file `index.html` (hiện tại)

| Vùng | Nội dung |
|---|---|
| `<style>` | Theme tông quân sự (xanh olive `--green`, hổ phách `--amber`, thép `--steel`), title card, badge "Đang phát triển", responsive + safe-area |
| HTML body | `#bg` (canvas nền), `.stage` (title + subtitle + badge), `.hint` |
| `<script>` IIFE | nền canvas động: `resize()`, `drawGrid()`, `drawTank()`, vòng lặp `frame()` |

> Khi dựng gameplay thật, đề xuất tách rõ các vùng bằng comment `// ----- TÊN -----` giống neon-serpent-3d (CONFIG / STATE / SETUP / INPUT / UPDATE / RENDER / LOOP / UI) để dễ điều hướng.

---

## 3. Vòng đời / State machine (dự kiến)

`menu → playing → (paused) → gameover → menu/playing` — **sẽ chi tiết khi có gameplay.**

---

## 4. Gameplay & quy tắc
_(chờ mô tả)_

## 5. Cấp độ / Độ khó
_(chờ mô tả)_

## 6. Điểm / Combo / Phần thưởng
_(chờ mô tả)_

## 7. Vật phẩm / Power-up
_(chờ mô tả)_

## 8. Hiệu ứng / Âm thanh
_(chờ mô tả)_

---

## 9. Quy ước thiết kế (giữ khi sửa)
- File phải **tự chạy** (zero-build); không thêm bước build/đóng gói.
- Mobile-friendly: viewport `viewport-fit=cover`, dùng `env(safe-area-inset-*)`.
- Bảng màu quân sự: olive `--green #7fae3a`, amber `--amber #e7b54a`, steel `--steel #9bb0c0`, danger `--danger #e0603a`, nền `#0c1108`.
- Không chói; chữ tương phản cao; UI panel kính tối.
- Tham khảo pattern (HUD chip, joystick, audio synth, cosmic FX…) ở repo anh em **neon-serpent-3d**.

---

## 10. State (sẽ định nghĩa object `S` khi có gameplay)
_(chờ mô tả)_

## 11. localStorage keys (dự kiến)
| key | ý nghĩa |
|---|---|
| `tank_best` | điểm kỷ lục (dự kiến) |

## 12. Điều khiển (dự kiến)
- **Desktop:** WASD/mũi tên di chuyển · chuột ngắm/bắn (hoặc Space) — **chốt sau**.
- **Mobile:** joystick + nút bắn — **chốt sau**.

---

## 13. Cách test nhanh
- `python3 -m http.server 8765` rồi mở Chrome local; test tự động qua **Playwright MCP** (`browser_navigate`/`browser_evaluate`/`browser_take_screenshot`, `browser_resize` giả mobile 390×844 / desktop 1280×800).
- Kiểm cú pháp: trích `<script>` ra `.mjs` rồi `node --check`.

---

## 14. Lịch sử cập nhật lớn
- **2026-05-31 · MOBILE UX (chỉ hỗ trợ ngang):** **1 joystick** lái xe (origin động — chạm đâu hiện đó); nòng **tự ngắm địch gần nhất + tự bắn** nên bỏ cần ngắm phải + nút bắn (gỡ code `aimS`/`stickR` thừa). Nút **SWAP** (hiện icon súng đang dùng, chạm để đổi) / **DASH** / **SKILL** có nhãn rõ; ẩn thanh kho súng (`#gunlist`) + chỉ báo phím desktop (`#abilities`); dời HP/căn cứ lên góc trái khỏi vùng ngón cái; menu thu gọn cho màn ngang; joystick to hơn. **Chỉ landscape** — cổng `#rotate` “ROTATE YOUR DEVICE” khi cầm dọc + `checkOrientation()` tự pause. Help đổi theo nền tảng (`.desktop-only/.touch-only`). Verify portrait gate + landscape HUD, 0 lỗi console.
- **2026-05-31 · VISUAL OVERHAUL v4 (G1–G5):** (G1) dịch **toàn bộ** chữ sang tiếng Anh (tên game → STEEL SIEGE; HUD/menu/banner/tên súng-phép-buff-nâng-cấp-boss-biome); (G5) skin xe tăng chân thực hơn — texture tôn thép (panel/rivet/xước) + tread, PBR bắt phản chiếu môi trường, chạy gầm + nòng (ống nhiệt/hút khói/hãm đầu nòng) chi tiết, tier `detail` cho player+boss (giỏ sau tháp, ống phóng khói, MG, đinh tán, móc kéo, ống xả); (G4) **camera mở màn điện ảnh** (hero thấp khoe nòng → vòng quanh kiểu duyệt binh → toàn cảnh → khớp đúng khung gameplay; letterbox + hạ-tiêu-đề + nút skip; ẩn HUD khi diễn; bỏ qua bằng input sau grace); (G2/G3) **bộ icon SVG tự vẽ thay toàn bộ emoji** (33 glyph line-art quân sự) cho HUD/menu/vật phẩm/nâng cấp + theme nhất quán + vị trí tối ưu. Verify desktop 1280×800 + mobile 390×844, 0 lỗi console (trừ favicon 404).
- **2026-05-31 · Boss locomotion kiểu xe tăng:** boss chỉ tiến/lùi theo hướng thân; muốn tông phải **quay đầu xe về phía user** trước (telegraph để né) rồi mới lao thẳng theo hướng đã khoá (không bẻ lái giữa chừng → né được). State machine `aim → charge` trong `updateBoss`; nòng (turret) vẫn xoay theo user độc lập.
- **2026-05-31 · TINH CHỈNH v4 (U1–U3):** xe địch cũng có vùng tác chiến theo cỡ xe (er = def.range·r/1.5) — chỉ bắn khi mục tiêu trong vùng + đạn địch giới hạn tầm; vòng tầm player mảnh & nhạt hơn. Đổ bóng thật (PCF soft shadow, desktop) + đèn mạnh hơn → chân thực hơn. Buff lâu hơn (28s); 🎯 tầm bắn + 📦 băng đạn **vĩnh viễn (∞)**; nhặt trùng nhóm thì thay thế (không cộng dồn); HUD hiện ∞.
- **2026-05-31 · TINH CHỈNH v3 (T1–T5):** phạm vi tác chiến (vòng mờ + chỉ bắn khi địch trong vùng + đạn giới hạn tầm, mở theo màn/buff); nổ xe tăng hoành tráng + impact theo cỡ đạn; vật phẩm nhấp nháy + icon riêng + vòng đếm ngược; đánh boss player to bằng boss + tông húc văng nhau; min-gap giữa các xe; địa hình mê cung I/L/U/T/Z.
- **2026-05-31 · REWORK v2 (R1–R7):** sửa theo phản hồi sau khi chơi —
  (R1) xe tăng không còn dính/chồng vào nhau, va chạm hất văng;
  (R2) làm lại súng: băng đạn + nạp đạn + mảnh vỡ + **auto-fire**, mobile **auto-aim**, kho súng nhặt/đổi, bắt đầu 1 súng cơ bản;
  (R3) buff theo thời gian (bắn nhanh/sát thương/tốc độ/băng đạn/vô hạn) + rơi súng ngẫu nhiên;
  (R4) địa hình tường gạch phá được + khối thép chắn (cản xe & đạn);
  (R5/R6) mô hình xe tăng chi tiết hơn + camera thấp/chân thực hơn;
  (R7) địch nhẹ tay với người mới, khó tăng dần theo màn.
- **2026-05-31 · P9:** Auto-aim assist cho mobile (hút nhẹ về địch trong nón ngắm), nút tắt tiếng, adaptive FPS (tự hạ độ phân giải khi <45fps), cân bằng độ khó, gỡ dev-cheat. → Hoàn thành P1–P9.
- **2026-05-31 · P8:** 5 boss phân hoá hành vi (húc / xoáy ốc + tên lửa dò + triệu quân / đạn vòng + dậm đất shockwave + mìn / laser quét + dịch chuyển + triệu / tổng hợp cuồng nộ) + màn CHIẾN THẮNG + New Game+. Verify đủ 5 boss xuất hiện đúng thứ tự + victory.
- **2026-05-31 · P7:** 5 biome đổi theo màn (đất/nền/fog/đèn) + **màn chọn nâng cấp roguelite (1/3 thẻ)** sau mỗi boss (11 nâng cấp: máu/sát thương/nhịp bắn/tốc độ/dash/hút máu/chí mạng/phép/mạng/căn cứ/vũ khí) + 3 địch mới (mortar lốp đạn telegraph, shield chắn đòn trước, bomber lao tự nổ) + Victory + New Game+. (Terrain gạch/thép/băng: hoãn — sẽ thêm ở polish nếu cần.)
- **2026-05-31 · P6:** Khung boss đa pha + Boss S1 Mãnh Ngưu (húc có telegraph + bắn quạt/vòng, pha cuồng nộ <50% HP) + thanh máu, wave→boss sau đợt 5, slow-mo khi hạ, lên màn kế (boss scale theo màn; S2–S5 phân hoá ở P8).
- **2026-05-31 · P5:** 6 vũ khí (cannon/auto/shotgun/railgun/missile-homing/flak-AoE) + đổi súng (1-6/cuộn/nút) + weaponLvl; 6 phép (overdrive/aegis/EMP/repair/airstrike/timewarp) + cooldown; power-up rơi có nam châm hút + ưu tiên hồi máu khi nguy. HUD vũ khí/phép.
- **2026-05-31 · P4:** Juice (particle nổ/khói/spark + shake + bloom) + audio synth (SFX + nhạc nền 128 BPM).
- **2026-05-31 · P2+P3:** Combat core — Cannon + đạn pool + va chạm; 3 loại địch (grunt/scout/gunner) + AI đuổi/bắn/đâm; wave spawner ramp; **Core (căn cứ)** phải bảo vệ; score + combo (×8); player nhận sát thương/chết/mất mạng/respawn + game-over (HẾT MẠNG / CĂN CỨ BỊ PHÁ). Game đã chơi được.
- **2026-05-31 · P1:** Engine 3D (Three.js) + player tank (di chuyển, ngắm 360°, dash i-frame) + camera follow + twin-stick mobile + HUD skeleton + màn Title/Pause. Arena sa mạc.
- **2026-05-31:** khởi tạo repo + GitHub Pages + kịch bản `GAME_DESIGN.md` + luật `CLAUDE.md`.

> **Last updated:** 2026-05-31 · nhánh `main` · trạng thái: HOÀN THÀNH P1–P9 + R1–R7 + T1–T5 + Visual Overhaul v4 (G1–G5) + Mobile UX (1 joystick, landscape-only). Toàn bộ chữ tiếng Anh, icon SVG tự vẽ.
