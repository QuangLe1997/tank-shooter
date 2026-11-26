# Test nhanh — XUNG KÍCH

Nguyên tắc: **chạy bậc thấp nhất đủ để tin thay đổi của mình**. Chủ dự án tự chơi thử; đừng test thừa, đừng viết script test mới.

## Bậc 1 — mọi thay đổi (~5 giây, không cần trình duyệt)
```bash
node tools/verify.mjs
```
Phải kết thúc bằng `✓ verify: all checks passed`. Nó kiểm cú pháp mọi module, luật kiến trúc (`tools/archcheck.mjs`), test dữ liệu / cân bằng (`test.js`) và — khi đã `npm install` một lần — luật phạm vi sâu R8–R11 (mọi tên dùng trong code đều phải tồn tại: bắt được lỗi import thiếu mà không cần chạy game).

Đổi một con số trong `config.js`, sửa chữ, sửa tài liệu: **dừng ở bậc 1**.

## Bậc 2 — thay đổi nhìn thấy được hoặc chạm vào lối chơi (~20–40 giây, cần GPU)
```bash
node tools/ts.mjs DESERT 5 --seed 7
```
In MỘT dòng JSON: `ok`, thời gian vào trận, khung hình p50 / p95 / max, số lệnh vẽ, tam giác, `errors`. `errors` phải rỗng.

- Chiến trường: `DESERT RUINS ARCTIC FOUNDRY CITADEL MEADOW CITY SAVANNA VOLCANO QUARRY`.
- `--seed 7`: cùng seed thì địa hình, vật chắn, pháo đài ra y hệt — so trước / sau được.
- `--at x,z`: đặt lính tại chỗ cần xem. `--profile '{"unit":"xeom","lastRide":"xeom"}'` (xe ôm) hoặc `"cav"` (ngựa).
- `--eval probe.js`: nội dung file là THÂN hàm `async (H, S) => { … }` chạy trong trang (H = mọi symbol của hub, S = trạng thái game); giá trị `return` được in ra ở `eval`. **Đo bằng probe (con số)**; trong probe có thể tự lái game một lúc (`await new Promise(r => setTimeout(r, 15000))`) rồi lấy mẫu.
- `--shot out.jpg`: chỉ chụp khi con số không nói được (tư thế, màu sắc). Mỗi tính năng tối đa 1–2 ảnh.
- Tự mở bằng mắt: `http://localhost:<cổng>/?test=DESERT&seed=7` (thêm `&at=x,z`).

Công cụ tự phát repo qua http, giữ một hồ sơ Chrome giữa các lần chạy, tự khoá để mỗi lúc chỉ một test dùng GPU và luôn đóng trình duyệt. Probe và ảnh để NGOÀI repo.

## Bậc 3 — chỉ khi đụng hiệu năng
So **bật / tắt trong cùng một trận**, vài lượt xen kẽ (mỗi trận sinh ngẫu nhiên; hai trận riêng lệch nhau vài ms):
```bash
node tools/ts.mjs CITY 3 --seed 7 --novsync --size 1440x900 --dpr 2 --eval probe-ab.js
```
`--novsync` (kèm `?nopace`) để khung hình không bị khoá 30 / 60. Trong probe đọc `H.PH.frm` (thời gian giữa hai khung game vẽ). Công tắc sẵn có để so: `?noview` (render/inst-view.js), `?notrooplod`, `?nodirector`, `?notactics`, `?nodiet`, `?nogov`.

## Khi máy đang bận (train model, build khác) hoặc chủ dự án bảo hạn chế GPU / trình duyệt
Chỉ chạy bậc 1. Ghi rõ trong báo cáo và trong DOCS phần nào **chưa chạy thật**, đừng báo số đo lấy lúc máy bận.

## Tìm code mà không tốn công đọc
- Hàm / hằng ở file nào: `npm run where -- <một phần tên>`.
- Danh mục mọi module theo tầng: `ARCHITECTURE.md` §2.1 (làm mới bằng `npm run modmap`).
- Đừng đọc cả `config.js` (≈ 280 KB) hay `DOCS.md` (≈ 950 KB) — `grep -n` rồi `sed -n 'a,bp' | cut -c1-300` (nhiều dòng rất dài).
- Số tinh chỉnh nằm trong `config.js` dưới dạng một object có tên (ví dụ `AWARE`, `DIRECTOR`, `RIDEFEEL`, `GUNFEEL`, `INSTVIEW`); module lấy symbol game từ `'../hub.js'`.

## Trước khi commit
1. `node tools/verify.mjs` pass.
2. Thêm vài kiểm tra cho object config mới vào `test.js` (trước dòng `// Z141 realistic water + flora`).
3. Một mục 4–8 dòng tiếng Việt trong `DOCS.md` (trước dòng `- **Z322 INTRO…`): người chơi thấy gì khác, object config, file, và phần nào chưa đo.
4. Chỉ stage đúng file mình sửa (theo tên), xem lại `git diff --staged`, rồi commit — lệnh stage và lệnh commit chạy riêng.
