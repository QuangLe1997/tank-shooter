# XUNG KÍCH (repo tank-shooter) — Luật dự án (Project Instructions)

> File này được Claude Code **tự động đọc** mỗi phiên làm việc trong repo. Mọi agent phải tuân thủ. Đây là repo **chơi game vui + test model AI**.

---

## 1. Quy trình làm việc (BẮT BUỘC)

1. **Tự quyết, không hỏi xác nhận.** Repo này để thử nghiệm — KHÔNG cần confirm gì cả. Gặp lựa chọn (kỹ thuật, thiết kế, thư viện, cách làm) → **tự chọn phương án tối ưu nhất** cho chủ dự án rồi làm luôn. Chỉ hỏi khi thực sự bế tắc/mâu thuẫn không thể tự giải.
2. **Code xong tính năng nào → commit + push lên git NGAY.** Mỗi tính năng hoàn thành là một commit riêng, push lên `main` liền (GitHub Pages tự deploy). Không gom dồn, không chờ nhắc.
3. **Commit message** rõ ràng, một dòng tóm tắt + bullet nếu cần. Kết thúc bằng dòng:
   `Co-Authored-By: <tên model đang chạy phiên này> <noreply@anthropic.com>` (ví dụ `Claude Fable 5.2`; lấy đúng tên model của phiên, không chép tên cũ).
4. **An toàn git:** chỉ `git add <file cụ thể>` (KHÔNG `git add -A`/`.`); repo dùng remote **HTTPS** (SSH key không chạy trong môi trường agent).
5. **Verify trước khi push — test theo bậc, đừng test thừa:** **Bậc 1 (mọi thay đổi, ~5 s):** `npm test` phải PASS (cú pháp mọi module + luật kiến trúc `tools/archcheck.mjs` + test dữ liệu/cân bằng `test.js`). **Bậc 2 (thay đổi nhìn thấy / chạm vào lối chơi, ~20 s):** `node tools/ts.mjs <BIOME> 5 --seed 7 [--eval probe.js] [--shot out.jpg]` — một trận trong Chrome headless có GPU, vào thẳng trận (`?test=`), in MỘT dòng JSON; `errors` phải rỗng. Đo bằng probe (con số), chỉ chụp ảnh khi con số không nói được. Không viết script test mới — thiếu gì thì thêm vào `tools/ts.mjs`. **Bậc 3 (chỉ khi đụng hiệu năng, hoặc cuối một đợt lớn):** so trước/sau cùng seed, thêm `--novsync`. Đọc **`ARCHITECTURE.md`** trước khi thêm hệ thống mới. Tìm hàm ở file nào: `npm run where -- <tên>`; đừng đọc cả `config.js` (275 KB) hay `DOCS.md` (900 KB) — grep. Mở nhanh một trận để nhìn bằng mắt: `http://localhost:<cổng>/?test=DESERT&seed=7` (thêm `&at=x,z` để đặt lính tại chỗ cần xem).
6. **Cập nhật tài liệu — ngắn:** mỗi tính năng một mục 4–8 dòng tiếng Việt trong **`DOCS.md`** (chèn ngay trước dòng `- **Z322 INTRO…`), nói người chơi thấy gì khác + object config + file. **`LEVELS.md`** nếu đổi số liệu màn/địch/súng. Số cân bằng → một object trong **`config.js`**, không hardcode rải rác. Thêm vài kiểm tra cho object config mới vào `test.js` (trước dòng `// Z141 realistic water + flora`).

---

## 2. Triết lý thiết kế game (gameplay)

Game phải **có ý nghĩa & cuốn người chơi**:

- **Cân bằng độ khó:** KHÔNG quá dễ (chán), KHÔNG quá khó (nản), KHÔNG khó thao tác (ức chế). Khó tăng dần mượt mà theo tiến trình (ramping). Người mới chơi được ngay, người giỏi vẫn có thử thách.
- **Kích thích người chơi:** có mục tiêu rõ, phần thưởng tức thì (điểm/combo/vật phẩm), cảm giác tiến bộ (level/nâng cấp), và "just one more try".
- **Mỗi tính năng phải hợp lý** — phục vụ trải nghiệm, không thêm cho có. Cân nhắc: nó làm game vui hơn / công bằng hơn / đẹp hơn ở điểm nào?
- **Phản hồi tốt (juice):** mọi hành động có phản hồi hình + âm + rung/hiệu ứng (bắn, trúng, nổ, nhặt đồ, lên cấp).
- **Công bằng:** không chết oan; có cảnh báo trước (telegraph) cho mối nguy; điều khiển nhạy & chính xác.

---

## 3. Giao diện & hình ảnh (BẮT BUỘC đẹp)

- **3D + bắt mắt:** ưu tiên đồ hoạ 3D (Three.js qua importmap CDN, zero-build) trừ khi có lý do rõ để dùng 2D.
- **Hiệu ứng càng sống động càng tốt:** particle, nổ, khói, ánh sáng động, bloom (vừa phải — không chói), screen shake, vệt đạn, đổ bóng, camera động.
- **Đẹp & sang:** bảng màu nhất quán (tông quân sự: olive/amber/thép/đỏ-nguy-hiểm), UI rõ ràng, HUD gọn gàng, menu/game-over chỉn chu.
- **Mượt:** giữ FPS ổn (tự giảm chất lượng nếu máy yếu); mobile-friendly (responsive, safe-area, joystick/nút cảm ứng).

---

## 4. Kỹ thuật

- **Zero-build, ES modules** (không bundler, npm chỉ là task runner): `index.html` chỉ là vỏ markup; CSS ở `css/`; mã game ở `src/` chia theo tầng (`data/ core/ render/ audio/ world/ tank/ fx/ combat/ actors/ ai/ campaign/ loot/ input/ ui/ game/ dev/`), thứ tự chạy do **`src/hub.js`** quyết định; game được *bật* ở một chỗ duy nhất **`src/game/startup.js`**. Dòng đầu mỗi module = `// tầng/file.js — mô tả` (R12). Three.js + addons nạp qua `<script type="importmap">` từ CDN jsDelivr. **Luật chi tiết + công thức thêm súng/địch/tướng/màn: `ARCHITECTURE.md`.** Tìm hàm: `npm run where -- <tên>`. Tách/chuyển code giữa module: **`npm run move -- --to tầng/file.js tên…`** rồi `npm test` (không cắt dán tay import).
- Âm thanh: Web Audio API synth (không file ngoài). Nhạc nền có nhịp điệu, hấp dẫn.
- Lưu tiến trình/kỷ lục bằng `localStorage`.
- **Tham khảo repo anh em `neon-serpent-3d`** cho các pattern đã chạy tốt: HUD chip, joystick + chống tap-leak, audio resume cho iOS, cosmic/particle FX, fixed-tick + interpolation, gore/death cinematic, evolution/biome.
- Mobile: `viewport-fit=cover` + `env(safe-area-inset-*)`; `actx.resume()` trong user gesture.

---

## 5. Định hướng game

**XUNG KÍCH** — game bắn súng bộ binh góc nhìn thứ ba: người chơi là MỘT người lính (đi bộ, cưỡi ngựa chiến, hoặc ngồi sau xe ôm do bác tài lái), đánh qua các chiến trường theo chiến dịch, hạ tướng địch cuối mỗi màn. **Không còn xe tăng** (mode xe tăng đã gỡ hẳn — đừng thêm lại). Ưu tiên hiện tại của chủ dự án: (1) nhẹ máy, (2) trận đánh có kịch bản và chiến thuật — địch khôn, quyết liệt, xuất hiện có nguồn (hầm, nhà, trực thăng, mép bản đồ), (3) chuyển động chân thực của lính / ngựa / xe. Không làm thêm bản đồ mới khi chưa được yêu cầu.

> **Last updated:** 2026-11-25 · test theo bậc (`tools/ts.mjs`, `?test=`, `?seed=`), tài liệu ngắn, định hướng lính bộ binh.
