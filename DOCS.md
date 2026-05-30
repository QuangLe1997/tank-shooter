# TANK SHOOTER — Tài liệu game (Game Bắn Xe Tăng)

> Đọc file này là hiểu toàn bộ game + biết chỗ nào để sửa, **không cần scan lại `index.html`**. Mục tiêu: 1 file duy nhất [`index.html`](index.html), zero-build.
>
> ⚠️ **Trạng thái: ĐANG IMPLEMENT theo kịch bản.** Kịch bản gameplay đầy đủ ở **[`GAME_DESIGN.md`](GAME_DESIGN.md)** ("THIẾT GIÁP CHIẾN" — 3D twin-stick + wave + roguelite + boss, 5 màn). File này (`DOCS.md`) theo dõi **đã build tới đâu** (§0) + bản đồ code. Mỗi phase xong → cập nhật §0 + §14.

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
| P5 | 6 vũ khí + 6 phép + power-up | ⬜ | |
| P6 | Khung boss đa pha + Boss S1 (Mãnh Ngưu) | ⬜ | |
| P7 | 5 biome + chuyển màn + upgrade pick (roguelite) + đủ loại địch | ⬜ | |
| P8 | Boss S2–S5 + Victory + New Game+ | ⬜ | |
| P9 | HUD/menu hoàn chỉnh + mobile polish + cân bằng | ⬜ | |

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
- **2026-05-31 · P2+P3:** Combat core — Cannon + đạn pool + va chạm; 3 loại địch (grunt/scout/gunner) + AI đuổi/bắn/đâm; wave spawner ramp; **Core (căn cứ)** phải bảo vệ; score + combo (×8); player nhận sát thương/chết/mất mạng/respawn + game-over (HẾT MẠNG / CĂN CỨ BỊ PHÁ). Game đã chơi được.
- **2026-05-31 · P1:** Engine 3D (Three.js) + player tank (di chuyển, ngắm 360°, dash i-frame) + camera follow + twin-stick mobile + HUD skeleton + màn Title/Pause. Arena sa mạc.
- **2026-05-31:** khởi tạo repo + GitHub Pages + kịch bản `GAME_DESIGN.md` + luật `CLAUDE.md`.

> **Last updated:** 2026-05-31 · nhánh `main` · trạng thái: P1 xong, đang làm P2
