# Steel Siege — bản app iPhone / iPad

> Build trên máy khác: xem trạng thái hiện tại, các bước và lỗi hay gặp trong [HANDOFF.md](HANDOFF.md).

Hai cách đưa game lên iPhone. Cả hai đều chạy WebGL qua **Metal** (mọi trình duyệt trên iOS đều dùng WebKit), nên tốc độ khung hình như nhau. Khác nhau ở phần vỏ.

## 1. Thêm vào Màn hình chính (không cần Xcode)

1. Mở https://quangle1997.github.io/tank-shooter/ bằng Safari.
2. Bấm Chia sẻ → **Thêm vào Màn hình chính**.

Game mở toàn màn hình, không có thanh địa chỉ. Sau lần mở đầu (có mạng), game chơi được **offline**: `sw.js` lưu toàn bộ game, three.js và phông chữ. Mỗi lần mở có mạng, game tự lấy bản mới nhất.

## 2. App native (Capacitor → WKWebView)

Cần **Xcode** bản đầy đủ từ App Store (~15 GB, thêm ~8 GB cho iOS runtime). Command Line Tools không đủ.

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer   # một lần, sau khi cài Xcode
cd mobile && npm install                                           # lần đầu
npm run ios                                                        # gói game vào www/, đồng bộ vào ios/, mở Xcode
```

Trong Xcode:
1. Chọn target **App** → **Signing & Capabilities** → **Team**: chọn Apple ID của bạn.
2. Cắm iPhone, chọn máy ở thanh trên cùng, bấm ▶.
3. Lần đầu trên iPhone: **Cài đặt → Cài đặt chung → VPN & Quản lý thiết bị** → tin cậy nhà phát triển. Bật **Chế độ nhà phát triển** nếu iOS yêu cầu.

Với Apple ID miễn phí, app hết hạn sau 7 ngày, chạy lại ▶ để gia hạn. Tài khoản Apple Developer (99 USD/năm) thì không hết hạn và dùng được TestFlight.

Khi sửa game, chạy lại `npm run ios` (hoặc `npm run sync` nếu Xcode đang mở), rồi bấm ▶. Không cần sửa gì trong `ios/`.

### Bản native được tinh chỉnh những gì

| | |
|---|---|
| **Game Mode** (iOS 18+) | `GCSupportsGameMode` + thể loại `action-games`: iOS ưu tiên CPU/GPU cho game, giảm độ trễ tay cầm và tai nghe Bluetooth. |
| **Toàn màn hình, khoá ngang** | Ẩn thanh trạng thái. Thanh Home tự ẩn. Vuốt từ mép phải vuốt 2 lần mới thoát, nên ngón cái đặt sát viền không lỡ thoát game. |
| **Không tắt màn hình** | Màn hình không tự tối trong lúc chơi. |
| **Offline 100%** | three.js và phông chữ được gói sẵn (`tools/stage-offline.mjs`, dùng chung với bản Mac). Mọi file đọc từ máy nên khởi động nhanh. |
| **WebView đặc, nền tối** | Không chớp trắng khi mở, không cuộn hay nảy, không tự thụt lề. |
| **ProMotion** | `CADisableMinimumFrameDurationOnPhone`. |
| **Chỉ máy 64-bit có Metal** | |

Chất lượng hình tự điều chỉnh như bản web (`src/game/loop.js`): giới hạn số điểm ảnh theo màn hình, glow nửa độ phân giải, không bóng đổ, và tự hạ độ phân giải khi fps tụt.
