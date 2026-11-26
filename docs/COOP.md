# Co-op 2 người qua LAN — XUNG KÍCH (COOP 1–9)

**Chơi được bây giờ:** hai máy cùng mạng vào một phòng, qua phòng chờ, vào **cùng một trận**: thấy lính của nhau, đánh **chung một đám địch** do máy chủ phòng điều khiển, ngã thì người kia cứu. Từ COOP 9 là **một trận chung**: công sự / tháp / cổng / mục tiêu vỡ như nhau trên hai máy, Lõi và mục tiêu cùng máu, vật phẩm rơi cùng chỗ (ai chạm trước thì được — máy chủ quyết), thùng đạn thả dù mở một lần cả hai cùng nhận, quân ta + lính gác tháp + drone hiện trên máy khách; **TAB** đánh dấu chỗ đang ngắm cho đồng đội, **`** ném một băng đạn cho người đứng gần.
**Mới kiểm bằng:** `npm run coop-test` (116 kiểm, Node) + 9 lượt chạy hai trang trong **một** Chrome trên một máy. **Chưa hề chạy trên hai máy thật.**
**Lỗi đã biết:** màn 1 hai máy dựng giống hệt nhau (4 / 4 lượt), nhưng **từ màn 2 công sự có thể lệch** giữa hai máy (2 / 2 lượt thử) — game phát hiện và hiện dòng cảnh báo đỏ; xem mục 8. Chơi một người không đổi: không có `?room=` thì `coopBoot()` thoát ngay dòng đầu.

## 1. Chơi trên hai máy, từng bước
1. **Máy chủ phòng** (máy mạnh hơn — nó chạy cả trận): mở Terminal trong thư mục game, gõ `node tools/lan-room.mjs` (hoặc `npm run lan-room -- --port 8777`). Lần đầu macOS hỏi "cho phép *node* nhận kết nối đến?" → **Cho phép**.
2. Lệnh in ra mã phòng 5 ký tự và hai loại địa chỉ. Trên chính máy đó mở dòng **Chủ phòng**: `http://localhost:8777/?room=MÃ&seed=N&coop=host`.
3. **Máy thứ hai** (cùng Wi-Fi) mở dòng **Khách**: `http://<IP máy chủ>:8777/?room=MÃ&seed=N` — phòng chờ của chủ phòng cũng hiện sẵn dòng này. Lần đầu máy khách tải model qua LAN (vài trăm MB mỗi chiến trường).
4. **Phòng chờ** hiện tên hai người, ping, chiến trường. Chủ phòng chọn bãi / màn / giờ / thời tiết; khách thấy ngay. Cả hai bấm **Sẵn sàng**, chủ phòng bấm **Bắt đầu**.
5. Mỗi máy xem đoạn mở màn và chọn hợp đồng như thường (ai xong trước thì đếm 3-2-1 xong hiện "CHỜ ĐỒNG ĐỘI…"), rồi **cùng vào trận**.
6. Trong trận: đồng đội có **tên + thanh máu trên đầu**, **mũi tên mép màn hình kèm số mét** khi ngoài khung hình, **chấm có vòng** trên bản đồ nhỏ, hình viền khi bị che.
7. Hết máu thì **ngã** (bò được, không bắn được): người kia tới đứng cạnh ~4 giây là dậy với 40 % máu. **Cả hai cùng ngã = thua màn.**
8. Thắng màn: cả hai chọn phần thưởng riêng, mỗi máy dựng màn sau rồi lại chờ nhau ở 3-2-1 (nếu hiện dòng đỏ "chiến trường KHÁC nhau" thì vẫn đánh tiếp được, nhưng vài công sự lệch chỗ — muốn chắc thì rời phòng, mở phòng mới và chọn thẳng màn đó). Ctrl+C ở Terminal để đóng phòng.

Lỗi hay gặp (phòng chờ nói bằng chữ): *không có phòng này* (chủ phòng chưa vào / sai mã), *phòng đã đủ hai người*, *chủ phòng đã rời*, *điện thoại và máy tính chưa chơi chung được*.
- Khách phải mở địa chỉ `http://` của máy chủ phòng, không mở bản GitHub Pages (trang `https` không nối được `ws://` trong LAN).
- **Wi-Fi văn phòng (10.234.56.0/21) bật client isolation** → không chạy được; dùng Wi-Fi nhà, hotspot điện thoại, router riêng.
- **Điện thoại ↔ máy tính bị từ chối** ở phòng chờ: `ARENA` 130 / 184 và nhiều hàm dựng trong `world/*` rẽ theo `MOBILE` → hai sân khác nhau.
- Dòng đỏ "hai máy dựng hai chiến trường KHÁC nhau" **ngay màn đầu**: rời phòng, tải lại cả hai trang (cùng phiên bản), vào lại.

## 2. Cái gì chạy, cái gì chưa
| | Có | Chưa |
|---|---|---|
| Phòng chờ (COOP 4) | tên, sẵn sàng, ping, chọn chiến trường, link cho máy 2, lỗi bằng chữ, từ chối điện thoại ↔ máy tính, so dấu vân tay chiến trường, chờ nhau ở 3-2-1 | mã QR, chọn vai, tự tạo phòng trong app |
| Lính của người kia (COOP 5) | cùng model + code tư thế (đi, chạy, quỳ, nằm, ngắm, cưỡi xe / ngựa), đúng súng, chớp lửa + vệt đạn, thẻ tên, mũi tên, chấm bản đồ, viền khi bị che | leo trèo / nhảy / lăn, lên xuống xe có động tác, xe để lại khi xuống, lựu đạn của khách bên máy chủ |
| Địch (COOP 6, `COOP.puppets` bật) | mọi lính địch + trực thăng theo máy chủ, chết / nổ / lựu đạn bay, điểm, đợt, pha đạo diễn, lời điện đài, chỗ nhiệm vụ phụ; khách bắn → báo trúng → máy chủ trừ máu | hình riêng của tướng, hố bom, kinh nghiệm của khách |
| Ngã / cứu (COOP 7) | máy chủ quyết ai ngã, đếm cứu, ai dậy, thua khi cả hai ngã; hai máy cùng hiện tiến độ | kéo vào chỗ nấp, băng bó, phím nhìn sang đồng đội |
| Chiến trường chung (COOP 9, `COOP2.world.*`) | mọi khối dựng lúc đầu màn (công sự, tháp, cổng, tường đồn, mục tiêu): hư hại + sập theo máy chủ; máu Lõi; vật phẩm rơi (cùng đường bay, cùng chỗ rơi), ai nhặt do máy chủ quyết; thùng đạn thả dù chung, khách thiếu đạn thì gọi; quân ta (gác Lõi + tổ bộ binh), lính gác tháp (ngã, phát bắn), drone hai phe | khối sinh ra **sau** khi dựng màn (đống đổ nát, tường xây lại), cây đổ, hố bom, thánh tích (relic), thùng quà thăng cấp (riêng từng người), kho / trại đổi chủ, lính dù, drone của chính khách |
| Phối hợp (COOP 9) | **ping** (TAB / nút ◎): vòng sáng + cột sáng 6 s, tối đa 3 / người, hiện trên bản đồ, máy kia nghe "Địch hướng 2 giờ!" theo hướng nhìn của chính họ; **đạo diễn cho hai người**: địch × 1,6, phục kích người đứng lẻ, dồn ép người gây sát thương nhiều nhất, đang cứu thì bị để ý; **ném băng đạn** (phím ` / nút ▮) | chọn loại ping bằng bánh xe, ping của quân ta AI, kéo người ngã vào chỗ nấp |
| Mạng | LAN qua `tools/lan-room.mjs`, tự nối lại khi rớt | internet (WebRTC + Firestore + TURN), giọng nói |

`COOP.puppets:false` = mỗi máy tự đánh địch của mình, chỉ thấy nhau (dùng khi con rối địch có lỗi).

## 3. Tầng mạng `src/net/` (thuần — luật R13: không hub, không three, không DOM)
| File | Việc |
|---|---|
| `net/protocol.js` | định dạng gói, lượng tử hoá, ảnh chụp đầy đủ / delta, hàng sự kiện gửi-lại-tới-khi-nhận, JSON phòng chờ (`hello settings ready start end field say`) |
| `net/interp.js` | bộ đệm ảnh chụp bên nhận: `createSnapInterp().push / .sample` |
| `net/transport.js` | giao diện đường truyền + bản WebSocket + cặp trong bộ nhớ (lên internet: viết `createRtcTransport()` cùng giao diện) |
| `net/coop.js` | phiên `idle → connecting → lobby → ready → playing → ended` + các móc `coopStart / coopBroadcast / coopSendInput / coopSendEvent / coopSample / coopSay…` |
| `net/rules.js` | luật hai máy cùng giữ, hàm thuần: `coopLobbyClash`, `coopSeedUrl`, `coopFocusPick`, `coopDownEnter / coopDownStep`, `coopEventAllowed`, `coopJudgeHit`, `coopLedger`, mã `NET_CUE` |

Phía game: `src/ui/coop-lobby.js` (màn phòng chờ + hai dòng HUD), `src/game/coop-glue.js` (`CO`, `coopBoot`, `coopTick`, cổng, sự kiện, ngã / cứu), `src/game/coop-remote.js` (`MATE`, lính người kia), `src/game/coop-puppets.js` (`PUPS`, ảnh chụp của chủ, con rối của khách). Số tinh chỉnh: `config.js` → `COOP`. COOP 9: `src/game/coop-world.js` (`CW`: khối, vật phẩm, thùng đạn, lính gác, Lõi), `src/game/coop-team.js` (`CT`: ping, đạo diễn, băng đạn); số: `config.js` → `COOP2`.

## 4. Giao thức (phiên bản `COOP.proto` = 2)
| Gói | Chiều | Nội dung |
|---|---|---|
| `SNAP` nhị phân | chủ → khách, 20 / s | đầu 21 B · người chơi 26 B · bản ghi thực thể (đầy đủ 11 B, delta ≈ 4–5 B) · sự kiện × 13 B |
| `INPUT` nhị phân | khách → chủ, 30 / s | 17 B + lính của khách 26 B + sự kiện |
| người chơi (26 B) | | id · x y z (cm) · hướng thân, hướng ngắm · độ ngẩng · vx vz · tư thế · súng · cờ (bắn, nạp, cưỡi, ngã, ngắm, chạy nước rút, trên không, chết) · máu · mã xe |
| sự kiện (13 B) | | loại · a · b · x y z · p — đánh số, gửi lại tới khi bên kia báo nhận, giao đúng một lần, đúng thứ tự |
| `HIT` | khách → chủ | a = 2 (khách), b = mã địch, x z = hướng đạn, y = chỉ số súng / 100, p = sát thương × 10 (+ bit 15: đạn nặng) |
| `HIT` | chủ → khách | b = 2: sát thương **cuối cùng** máy chủ quyết cho lính của khách |
| `DEATH` `EXPLOSION` `GRENADE` `MARK` | chủ → khách | địch chết (hướng ngã, kiểu) · nổ (màu, cỡ) · lựu đạn (điểm ném, điểm rơi, độ cao, thời gian bay) · chỗ nhiệm vụ phụ |
| `CUE` (p = `COOP.cue`) | chủ → khách | `GO` `WON` `LOST` `SCORE` `WAVE` `PHASE` `DOWN` `UP`; khách → chủ chỉ có `GATE` ("tôi đã tới cổng 3-2-1 của màn b") |
| JSON `say` | chủ → khách | một dòng điện đài (≤ `COOP.sayMax` ký tự) |
| `BLOCK` | chủ → khách | a = **mã khối = thứ tự dựng + 1** (hai máy dựng cùng danh sách — đã so vân tay — nên chỉ số là đủ, chính xác hơn so theo toạ độ và chỉ tốn 2 byte), b = 1 đã sập / 2 p là phần máu còn lại (0–65535), còn lại p = sát thương; gom tối đa 4 lần / s mỗi khối, "sập" gửi ngay |
| `BLOCK` `GUARD` | khách → chủ | **báo** một phát trúng khối / lính gác (a = 2, b = mã) — máy chủ xét rồi mới trừ |
| `GUARD` `SHOT` `STATE` | chủ → khách | lính gác rơi khỏi tháp (tháp, người, hướng) · phát bắn của lính gác (nòng, hướng) · máu Lõi |
| `LOOT` | hai chiều | chủ: `DROP` (mã, loại, chỗ, đường bay) `TAKEN` `GONE` `CRATE` `OPEN` · khách chỉ được **xin**: `ASK` `ASKCRATE` `NEED` |
| `PING` `GIVE` | hai chiều | ping (ai, loại, chỗ, mã địch / vật phẩm) · băng đạn ném (số viên, loại đạn) |
| thực thể | chủ → khách | quân ta = bit `ALLY` + loại theo `COOP2.ally.roles`; drone = loại ≥ `COOP2.drone.kind0`, y = độ cao |

## 5. Tin cậy — ai được nói gì (COOP 7)
Máy **chủ phòng là nơi quyết định**; lời của máy khách luôn bị kiểm. Mọi sự kiện tới đều qua **một cổng** (`coopEventAllowed` — dòng đầu của `onEvent` trong `coop-glue.js`); thứ không qua thì **bỏ, đếm vào `CO.drops`, không bao giờ ném lỗi**.
- **Máy chủ chỉ nhận từ khách hai thứ:** báo trúng vào **mã địch** (≥ 16) và "tôi đã tới cổng". `HIT` nhắm vào người chơi (kể cả lính của chủ), `DEATH`, nổ, điểm, đợt, thắng / thua màn, ngã / dậy, lời điện đài từ khách → bỏ.
- **Báo trúng bị xét bằng số của chính máy chủ** (`coopJudgeHit`, `COOP.trust`): địch còn sống; súng là một trong hai khẩu gần nhất khách đã báo đang cầm; khách không đang ngã; địch nằm trong tầm súng × `rangeK` tính từ chỗ khách báo đang đứng; không quá `hitsPerS` báo / giây; sát thương bị cắt còn tối đa `dmgK` × sát thương một viên của khẩu đó trong bảng của máy chủ; "đạn nặng" từ súng nhẹ (lựu đạn, dao, giẫm) tốn thẻ `heavyBurst`.
- **Máu và ngã / dậy của khách do máy chủ giữ sổ** (`CO.led`, `coopLedger`): máy chủ tự trừ sát thương nó gây ra (đã tính tư thế theo bảng của nó), sổ tụt ngay theo máu khách báo, chỉ tăng tối đa `healPerS` / giây; sổ về 0 thì máy chủ nói `DOWN`, đếm đủ thì nói `UP`, cả hai ngã thì nói `LOST`. Máy khách chỉ hiển thị.
- **Máy khách chỉ nhận lệnh từ máy chủ** (phòng chỉ có đúng một chủ một khách, server kiểm `Origin` và vai), và vẫn kiểm khoảng giá trị.
- **COOP 9 — thế giới chung:** khách không tự phá được gì trên máy mình: đạn của khách trúng khối / lính gác là **báo cáo** (`coopJudgeBlock`: ≤ `COOP2.block.perS` / s, khối trong tầm súng × `rangeK` tính từ chỗ khách báo đang đứng, sát thương bị cắt); nhặt đồ / mở thùng là **xin** (`coopJudgeNear`: trong `loot.takeR` m, không khi đang ngã); ping bị giới hạn `ping.perS` / s. "Khối 40 đã sập", "tôi đã nhặt", "Lõi còn 1 máu", "lính gác đã ngã" từ khách → bỏ ở cổng.
- **Vẫn phải tin khách:** vị trí lính của khách (di chuyển chạy trên máy khách). Co-op bạn bè, không phải đấu xếp hạng — nhưng một trang hỏng không phá được trận của chủ phòng.

## 6. Số đo
- Node (`coop-test`, 80 thực thể đều di chuyển): chủ → khách ≈ 8,4 KB/s, khách → chủ ≈ 1,4 KB/s; sai số nội suy 0,7 cm ở trễ 100 ms; mất 20 % gói vẫn đủ và đúng thứ tự.
- Trận thật (2 trang, 1 Chrome): ảnh chụp ≈ **174 B** với ~50 địch, **237 B** với 75–97 địch → ≈ **3,5–4,7 KB/s** ở 20 / s; lính của khách ≈ **43–45 B** → ≈ **1,3 KB/s** ở 30 / s. Các lượt đo chỉ chạy 4–15 khung / giây (máy bận, hai trang chung GPU) nên số gói thực gửi ít hơn mức danh định.
- Cứu đồng đội (lượt 4): khách ngã → máy chủ đếm → `UP` → khách dậy với 70 / 175 máu (40 %), 2,4 s an toàn, sổ của máy chủ = máu khách báo; thẻ tên nằm đúng trên đầu (lệch 0 px).
- **COOP 9, lượt 5–9** (DESERT, seed 7, 4–6 khung / s vì máy bận): sau 40 s hai trang trùng nhau — khối đã sập 8 / 8 (cùng mã 120 121 122 124 351 425 513 523), máu Lõi 390 / 390, mục tiêu 70 % / 70 %, 14 khối hư hại cùng phần trăm, quân ta 16 / 16, lính gác 40 / 40, drone 1 / 1, vật phẩm 4 / 4 → 3 / 3 (chỗ rơi lệch 0,06–0,30 m). Sang màn 2: 573 khối, 15 khối sập cùng mã, lính gác 37 / 37, vật phẩm nằm lại giữ nguyên mã (4 / 4, 1 / 1).
- Ảnh chụp: chỉ địch 254 B (61 thực thể) → thêm 16 quân ta 261 B (75 thực thể); cả trận 253–299 B ≈ 5–6 KB/s ở 20 / s (lúc đo chỉ gửi được ~8,5 ảnh / s: 1,64 → 2,15 KB/s). Node: 80 địch 409 B → + 16 quân ta + 2 drone 462 B (8,0 → 9,0 KB/s).
- Giả mạo từ trang khách (lượt 5): 100 ping một lúc → nhận 5, bỏ 95; báo trúng khối cách 263 m → bỏ (`range`); xin vật phẩm cách 164 m → bỏ; 3 lệnh kiểu máy chủ (khối sập, đã nhặt, máu Lõi) → bỏ ở cổng. Ping: khách đánh dấu (4,29; 99,45) → máy chủ thấy đúng toạ độ đó; chủ đánh dấu địch số 16 → khách thấy đúng chỗ con rối số 16, điện đài "CHU: Địch hướng 5 giờ!". Ném băng: 30 viên mỗi chiều. Lượt 9 bấm **phím thật** (TAB, `) trên từng trang: ping và băng đạn sang đúng máy kia. Đạo diễn: × 1,6; khách gây 79 sát thương → số địch nhắm khách 5 → 12 (trong ~55).

## 7. Danh sách móc M1–M25 (của COOP 3) — tình trạng
| Móc | Tình trạng |
|---|---|
| M1 M2 M3 M4 M5 M6 | **xong**: `startup.js` → `coopBoot`; `launchGame` khi `playing`; `arena / mobile / quality` trong `battle`; dấu vân tay ở `flow.js` + `upgrades.js`; gieo lại seed theo màn; cổng ở `briefing.js updateCountdown` |
| M7 | một phần: thua màn chiếu sang khách; **tạm dừng của chủ vẫn dừng cả trận**, thoát chưa hỏi lại |
| M8 M9 M10 | **xong**: `coopTick` + `coopGuestFrame` trong `loop.js` (chưa xếp ưu tiên "địch gần trước" khi quá 120 thực thể) |
| M11 M13 M14 | **xong** (địch + trực thăng; lính hai bên) · M12 quân ta: **xong** (COOP 9, con rối trong `FT` / `soldiers`) |
| M15 M16 M17 | đạn: vẽ từ cờ FIRING · lựu đạn + nổ: **xong** (hố bom `deformCrater` chưa đồng bộ) |
| M18 | vật phá được: **xong** (COOP 9: mã = thứ tự dựng, `world/cover.js damageBlock` → `coopBlockDamage`) |
| M19 | điểm, đợt, pha, điện đài, thắng màn: **xong**; banner tướng, thanh máu tướng: chưa |
| M20 M21 M22 M23 | **xong** (`coop-puppets.js`, `actors/damage.js`, `combat/lock-on.js`, `ai/tactics.js`) |
| M24 | **xong** bằng cách dựng bộ rig thứ hai và đổi tạm `S.player` / vài trường `CV` khi đặt tư thế (`asMate`) — tách hẳn trạng thái `CV` thì chưa |
| M25 | **xong** theo hướng máy chủ quyết (mục 5) |

## 8. Chưa kiểm được
- **Hai máy thật**: Wi-Fi, hộp thoại tường lửa macOS, độ trễ và mất gói thật, tải model qua LAN, Safari / điện thoại.
- **COOP 9 chưa thấy trong trình duyệt:** phần "đang cứu thì lính địch rảnh tới xem" (3 lượt đều không có lính rảnh trong 60 m — chỉ thấy đạo diễn chọn đúng người đang đứng); nút cảm ứng ◎ / ▮ (chưa mở trên điện thoại); đạn thật của khách bắn khối (probe gọi thẳng `damageBlock`); trận dài: hàng đợi 256 sự kiện khi rất nhiều khối vỡ cùng lúc. Vài khối loại đặc biệt không sập được bằng sát thương trên máy khách thì bị gỡ thẳng (`CW.n.blkStuck`, 1–2 / lượt).
- **(SYNC 1 — đã sửa, xem DOCS.md) Màn 2 trở đi lệch công sự.** Gốc rễ không phải trạng thái riêng của máy chủ mà là số lần rút `Math.random` phụ thuộc thứ đã tải / đã tạo (kể cả 4 số cho mỗi `uuid` của three.js); `core/dice.js` tách hai bộ số, hai lượt chạy hai trang cho vân tay trùng ở màn 1 và màn 2. Các seed riêng `coopSeedStep(10…13)` và `warmLand()` giờ thừa (mỗi bước `modeSeed` đã gieo lại trong co-op) nhưng vô hại, vẫn để. Cách dò: `?fieldtrace` + `fieldSteps()` / `fieldStepsDiff()` gọi tên bước lệch. Ghi chú cũ: Lượt 3: lệch toàn bộ. Sau khi sửa (model lính mới không rút số của chiến trường, mỗi bước dựng một seed, dọn địch cũ), lượt 4: độ cao địa hình, đá rải, hầm ngầm **trùng**; chỉ còn `buildBlocks` lệch (534 so với 532 khối; số lần rút ngẫu nhiên của bước đó 86 987 so với 84 608). Nguyên nhân còn lại chưa tìm ra — nghi một trạng thái chỉ máy chủ có sau trận (đồn đã chiếm, tướng, kho, tường Lõi). Sau lượt 4 đã chia tiếp `buildBlocks` thành 4 bước seed riêng (`coopSeedStep(10…13)` trong `world/cover.js`) — **chưa chạy lại**. Cách dò tiếp: `CO.parts` (vân tay từng phần) + đếm số lần `Math.random` giữa các lần `__reseed` trên hai trang.
- "Cùng seed → cùng chiến trường" ở màn 1 mới thấy trùng trên **cùng một máy, cùng hồ sơ** (DESERT, MEADOW). Hai máy thật có hồ sơ khác nhau (bãi nền menu khác) có thể lệch vì những thứ tạo-một-lần-rồi-giữ (đã tạo sẵn đá + nền của bãi trước khi gieo seed; các thứ khác chưa rà hết) — khi đó game báo dòng đỏ.
- Dáng lính kia nhìn gần khi đi bộ, viền xuyên tường, ngựa; trận dài nhiều màn; rớt mạng giữa trận trong trình duyệt; khách tải lại trang giữa trận.
