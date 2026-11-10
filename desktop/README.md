# Steel Siege — bản app macOS (Apple Silicon)

Vỏ Electron cho game web (game vẫn là file tĩnh, không build). Chạy offline: three.js + phông chữ được gói sẵn.

```bash
cd desktop && npm install      # lần đầu: tải Electron + packager + three.js
npm run mac                    # build arm64 → dist/…/Steel Siege.app và cài vào ~/Applications
npm start                      # chạy thử không đóng gói
```

- GPU: ANGLE trên **Metal**, ưu tiên GPU hiệu năng cao, không bị hãm tốc khi cửa sổ nằm nền.
- `window.__NATIVE` báo cho game biết đang chạy trong app → bóng đổ 4096 (web: 2048), Retina ×2.
- App chưa ký (unsigned): build trên chính máy này thì mở được ngay; copy sang máy khác thì chuột phải → Mở lần đầu.
