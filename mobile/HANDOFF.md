# Bàn giao: build Steel Siege lên iPhone từ máy khác

Viết ngày 2026-11-11, ở commit `706bbe3` (nhánh `main` = `refactor/modules-v2`). Cách dùng chung xem ở [README.md](README.md). File này ghi trạng thái hiện tại và các việc còn dở.

## Trạng thái

| Phần | Trạng thái |
|---|---|
| Web app trên Màn hình chính (`manifest.webmanifest`, `sw.js`, `assets/icons/`) | **Đã live** trên GitHub Pages. Đã thử ở Chrome: SW đăng ký được, lưu cache 148 file, tắt server vẫn khởi động offline. **Chưa thử trên iPhone thật.** |
| Gói offline cho app (`npm run sync` → `mobile/www/`) | Đã chạy thử: game khởi động, 145 file đều đọc từ máy, không gọi ra ngoài lần nào, đủ 6 phông chữ. |
| Project Xcode (`mobile/ios/`) | Tạo bằng Capacitor 8.6 (Swift Package Manager, không dùng CocoaPods). **Chưa build lần nào**, vì máy cũ không có Xcode. |
| Code Swift tự viết | `GameViewController` ở cuối `ios/App/App/SceneDelegate.swift`. Chưa được biên dịch lần nào, nên lần build đầu có thể phải sửa lỗi nhỏ. |
| Rung (Z118) | Đã thêm plugin `@capacitor/haptics` 8.0.2 (vào `mobile/package.json` và `ios/App/CapApp-SPM/Package.swift`). Game gọi `Capacitor.Plugins.Haptics.impact` khi có plugin. Sau `npm install` và `npm run ios`, Xcode tự kéo gói này. **Chưa thử trên iPhone thật.** |
| Hiệu năng | Chỉ đo bằng giả lập khung điện thoại trong Chrome headless: logic ~2 ms/khung, 280–400 lệnh vẽ, 0,4–0,6 triệu tam giác. **Chưa đo fps trên iPhone thật.** |

## Các bước trên máy mới (Mac)

1. Cài **Xcode** từ App Store (cần ~25 GB trống), mở một lần để đồng ý giấy phép và cài iOS platform.
2. Cài Node 20 trở lên (máy cũ dùng Node 22).
3. Lấy code về:
   ```bash
   git clone https://github.com/QuangLe1997/tank-shooter.git
   ```
   ```bash
   cd tank-shooter && git checkout refactor/modules-v2
   ```
4. Trỏ dòng lệnh về Xcode:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
5. Build:
   ```bash
   cd mobile && npm install && npm run ios
   ```
   Lệnh này tải phông chữ Google (cần mạng), gói game vào `www/`, đồng bộ vào `ios/` rồi mở Xcode. Lần đầu, Xcode tự tải gói `capacitor-swift-pm` 8.6.0 từ GitHub và mất vài phút.
6. Trong Xcode:
   1. Chọn project **App** → target **App** → **Signing & Capabilities**.
   2. Mục **Team**: chọn Apple ID (thêm tại Xcode → Settings → Accounts). Nếu báo trùng **Bundle Identifier** `vn.quangle.steelsiege` thì đổi thành tên khác, ví dụ `vn.<tên>.steelsiege`.
7. Cắm iPhone, chọn máy ở thanh trên cùng, bấm ▶.
   - Trên iPhone, bật **Cài đặt → Quyền riêng tư & Bảo mật → Chế độ nhà phát triển**, máy sẽ khởi động lại.
   - Sau đó vào **Cài đặt → Cài đặt chung → VPN & Quản lý thiết bị** → tin cậy Apple ID của bạn.
   - Dùng Apple ID miễn phí thì app chạy được 7 ngày. Hết hạn thì bấm ▶ lại.

Muốn thử nhanh khi chưa có iPhone: chọn một máy iPhone Simulator rồi bấm ▶. Simulator vẽ WebGL chậm hơn máy thật, nên đừng dùng nó để đo fps.

## Lỗi có thể gặp

- **`xcodebuild` báo cần Xcode:** chưa chạy bước 4.
- **Lỗi Swift ở `GameViewController`:** mọi thuộc tính override trong đó đều là `open` trong `CAPBridgeViewController` của Capacitor 8.6. Nếu Xcode vẫn báo lỗi, xoá dòng lỗi; app vẫn chạy được, chỉ mất tinh chỉnh tương ứng.
- **Màn hình trắng hoặc đen khi mở app:**
  1. Bật Safari trên Mac → Cài đặt → Nâng cao → hiện menu Nhà phát triển.
  2. Mở menu **Nhà phát triển → [iPhone] → Steel Siege** để xem console.
  3. Thường gặp nhất là thiếu file trong `www/`: chạy lại `npm run sync`.
- **Không nghe tiếng:** công tắc im lặng đang bật. Web Audio trong WKWebView tuân theo công tắc này.

## Đo độ mượt trên máy thật (việc tiếp theo)

1. Chạy app từ Xcode, rồi mở Safari → **Nhà phát triển → [iPhone] → Steel Siege** → tab **Timelines**, ghi lại khoảng 30 giây ở trận có thành (cấp 3 trở lên).
2. Đo thêm từ console:
   - `devicePixelRatio`;
   - độ phân giải thật đang vẽ: `document.querySelector('canvas').width`;
   - fps: game tự hạ độ phân giải (`S.dpr`, sàn 0,7) khi dưới 47 fps.
3. Ghi lại fps theo đời iPhone, kèm cấp độ, số địch và nhiệt độ máy sau 5 phút chơi.

Việc nên làm nếu fps chưa đạt:

- **Mô hình xe tăng ở xa:** mỗi xe khoảng 6–7 nghìn tam giác. Mô hình đơn giản hơn cho xe ở xa sẽ giảm nhiều nhất số tam giác và lệnh vẽ còn lại.
- **Vật liệu:** `MeshStandardMaterial` (PBR) là shader nặng nhất trên điện thoại. Có thể đổi sang Lambert cho đạo cụ nhỏ trên điện thoại.
- **Chế độ tiết kiệm pin:** iOS khoá rAF ở 30 fps khi bật Low Power Mode, và bộ điều tiết sẽ tưởng máy yếu nên hạ chất lượng. Cần đo trên máy thật mới phân biệt được với trường hợp GPU quá tải.

## File quan trọng

| File | Vai trò |
|---|---|
| `mobile/build.mjs` | Gói game, `cap sync`, mở Xcode |
| `mobile/capacitor.config.json` | appId, nền tối, tắt cuộn và tự thụt lề của WebView |
| `mobile/ios/App/App/SceneDelegate.swift` | `GameViewController`: khoá ngang, ẩn thanh trạng thái và thanh Home, chặn vuốt mép, giữ màn hình sáng |
| `mobile/ios/App/App/Info.plist` | Game Mode, thể loại action-games, arm64 + Metal, toàn màn hình, ProMotion |
| `tools/stage-offline.mjs` | Gói offline dùng chung với bản Mac (`desktop/`) |
| `sw.js` | Cache offline cho web app. File game chỉ lấy từ cache khi mất mạng |
| `src/game/loop.js` | Bộ tự điều tiết chất lượng theo fps |
| `src/audio/engine-music.js` | `dprCap()`: giới hạn số điểm ảnh trên điện thoại |
| `src/world/perimeter.js` | Vòng đá chia 12 cung để không vẽ phần ngoài màn hình |

Tài liệu tổng: `DOCS.md`, các mục Z107 (bản Mac) và Z108 (bản iPhone).
