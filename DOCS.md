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
| Single-file zero-build (canvas placeholder) | ✅ | `index.html` |
| Màn title + nền canvas động (xe tăng chạy + lưới) | ✅ | IIFE cuối `index.html` (`frame()`, `drawTank()`) |
| Tài liệu | ✅ | `DOCS.md` (file này) |

### Gameplay (chưa thiết kế — sẽ mô tả sau)
| Tính năng (dự kiến) | Trạng thái | Ghi chú |
|---|---|---|
| Điều khiển xe tăng (di chuyển + xoay nòng) | ⬜ | bàn phím + chuột (desktop), joystick/nút (mobile) |
| Bắn đạn / cơ chế va chạm | ⬜ | |
| Kẻ địch / AI | ⬜ | |
| Màn chơi / vật cản / địa hình | ⬜ | |
| Điểm / mạng / level | ⬜ | |
| HUD + menu + game-over | ⬜ | |
| Âm thanh (synth, zero-asset) | ⬜ | tham khảo cách làm ở repo neon-serpent-3d |
| Mobile controls + responsive | ⬜ | |
| Lưu localStorage (best score…) | ⬜ | |

> 👉 Khi chủ dự án mô tả gameplay, điền chi tiết vào các §4–§8 và đổi ⬜→🚧→✅.

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
- **2026-05-31:** khởi tạo repo `tank-shooter` (public) + GitHub Pages + bản dựng title/canvas placeholder + tài liệu này. Chờ mô tả gameplay.

> **Last updated:** 2026-05-31 · nhánh `main` · trạng thái: khởi tạo
