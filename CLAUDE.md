# TANK SHOOTER — Luật dự án (Project Instructions)

> File này được Claude Code **tự động đọc** mỗi phiên làm việc trong repo. Mọi agent phải tuân thủ. Đây là repo **chơi game vui + test model AI**.

---

## 1. Quy trình làm việc (BẮT BUỘC)

1. **Tự quyết, không hỏi xác nhận.** Repo này để thử nghiệm — KHÔNG cần confirm gì cả. Gặp lựa chọn (kỹ thuật, thiết kế, thư viện, cách làm) → **tự chọn phương án tối ưu nhất** cho chủ dự án rồi làm luôn. Chỉ hỏi khi thực sự bế tắc/mâu thuẫn không thể tự giải.
2. **Code xong tính năng nào → commit + push lên git NGAY.** Mỗi tính năng hoàn thành là một commit riêng, push lên `main` liền (GitHub Pages tự deploy). Không gom dồn, không chờ nhắc.
3. **Commit message** rõ ràng, một dòng tóm tắt + bullet nếu cần. Kết thúc bằng dòng:
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
4. **An toàn git:** chỉ `git add <file cụ thể>` (KHÔNG `git add -A`/`.`); repo dùng remote **HTTPS** (SSH key không chạy trong môi trường agent).
5. **Verify trước khi push:** chạy thử (HTTP server + Playwright MCP, test cả desktop 1280×800 và mobile 390×844), không lỗi console (favicon 404 bỏ qua), rồi mới commit.
6. **Cập nhật `DOCS.md`** (§0 bảng trạng thái + §14 lịch sử) mỗi khi thêm/đổi tính năng để phiên sau không phải scan lại code.

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

- **1 file `index.html`, zero-build** (không npm/bundler). Three.js + addons nạp qua `<script type="importmap">` từ CDN jsDelivr.
- Âm thanh: Web Audio API synth (không file ngoài). Nhạc nền có nhịp điệu, hấp dẫn.
- Lưu tiến trình/kỷ lục bằng `localStorage`.
- **Tham khảo repo anh em `neon-serpent-3d`** cho các pattern đã chạy tốt: HUD chip, joystick + chống tap-leak, audio resume cho iOS, cosmic/particle FX, fixed-tick + interpolation, gore/death cinematic, evolution/biome.
- Mobile: `viewport-fit=cover` + `env(safe-area-inset-*)`; `actx.resume()` trong user gesture.

---

## 5. Định hướng game

**Thể loại:** Game bắn xe tăng (tank shooter). Chi tiết gameplay do chủ dự án mô tả — bám sát mô tả, phần nào chưa nói thì tự chọn phương án hợp lý nhất theo §2–§3.

> **Last updated:** 2026-05-31 · khởi tạo bộ luật dự án
