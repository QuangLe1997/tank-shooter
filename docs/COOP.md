# Co-op 2 người qua LAN — XUNG KÍCH (COOP 1–3)

**Đã có (kiểm bằng Node, chưa chạy trong trình duyệt):** server phòng LAN, tầng mạng `src/net/` (giao thức, nội suy, đường truyền, phiên), test `npm run coop-test`.
**Chưa có:** game chưa gọi tầng mạng ở đâu cả — không phòng chờ, không thấy nhau. Chơi một người không đổi gì (không `?room=` thì `coopStart()` trả `null`).
Bước sau (K2 "thấy nhau", K3 "đánh chung") làm theo **§5 Danh sách móc**.

## 1. Mở phòng LAN và vào từ máy thứ hai
```bash
node tools/lan-room.mjs            # hoặc: npm run lan-room -- --port 8777 --seed 7 --code ABCDE --root <thư mục game>
```
Lệnh in ra mã phòng 5 ký tự và các địa chỉ:
- **Chủ phòng** (máy chạy lệnh): `http://localhost:8777/?room=MÃ&seed=N&coop=host`
- **Khách** (máy / điện thoại cùng mạng): `http://<IP LAN của máy chủ>:8777/?room=MÃ&seed=N` — mỗi IPv4 của máy một dòng; chọn dòng cùng dải với máy khách (thường `192.168.x.x`).
- `seed=N` giống nhau ở hai link để hai trang dựng **cùng một chiến trường** (`boot/safety.js` đọc tham số này trước mọi module). Ctrl+C để đóng phòng.

Lưu ý đã biết:
- Khách phải mở **địa chỉ `http://` của máy chủ phòng**, không mở bản GitHub Pages: trang `https` không được nối `ws://` trong LAN.
- **Wi-Fi văn phòng (10.234.56.0/21) bật client isolation**, chặn mọi kết nối máy-tới-máy → không chạy được. Dùng Wi-Fi nhà, hotspot điện thoại hoặc router riêng.
- Lần đầu macOS hỏi "cho phép *node* nhận kết nối đến?" → **Cho phép** (lỡ bấm Từ chối: Cài đặt hệ thống → Mạng → Tường lửa → Tuỳ chọn).
- Mở `http` qua IP không phải "ngữ cảnh an toàn": không có micro (giọng nói để sau). Lần đầu khách tải model qua LAN (vài trăm MB mỗi chiến trường), lần sau có cache.
- Server chỉ phát file trong thư mục game (không `.git`, không `node_modules`), chỉ nhận WebSocket từ chính trang nó phát (kiểm `Origin`); phòng tự xoá 20 s sau khi cả hai rời.
- **Điện thoại ↔ máy tính chưa dùng được với cách "cùng seed":** `core/config.js` đặt `ARENA` 130 (cảm ứng) / 184 (máy tính) và nhiều hàm dựng trong `world/*` rẽ theo `MOBILE` / `PROFILE.quality` → hai chiến trường khác nhau. Xem móc M3–M4.

## 2. Tầng mạng `src/net/` (thuần — luật R13: không hub, không three, không DOM; chạy được bằng Node)
| File | Việc | Hàm chính |
|---|---|---|
| `net/protocol.js` | định dạng gói, lượng tử hoá, khung dựng ảnh chụp, delta, hàng sự kiện, JSON phòng chờ | `makeNetFrame` `netFrameReset/Add/Player/Find/Ent` `packSnapshot/unpackSnapshot` `packInput/unpackInput` `packPlayerState/unpackPlayerState` `createSnapEncoder/Decoder` `createEventOutbox/Inbox` `netHashStep` `CoopProtocolError` |
| `net/interp.js` | bộ đệm ảnh chụp bên nhận | `createSnapInterp().push(frame, now) / .sample(now, out)` → `out.n, id[], kind[], x[], y[], z[], heading[], state[], hp[], born[], gone[], pl[]` |
| `net/transport.js` | giao diện đường truyền + bản WebSocket + cặp trong bộ nhớ | `createWsTransport(url)` · `open / send(data, volatile) / onOpen / onMessage / onNotice / onClose / close` |
| `net/coop.js` | phiên + móc cho game | `coopStart()` `coopActive()` `coopPlaying()` `coopIsHost()` `coopSetSettings/SetReady/Begin` `coopFrame()` `coopBroadcast(f)` `coopSnapDue(ms)` `coopSendInput(st)` `coopInputDue(ms)` `coopSample(ms)` `coopSendEvent(…)` `coopOnState/Snapshot/Input/Event/Settings/Peer/Field` `coopSetFieldHash` `coopInfo()` |

Trạng thái phiên: `idle → connecting → lobby → ready → playing → ended` (`coopOnState(fn(state, trước, lý do))`; lý do kết thúc: `left`, `no-room`, `room-full`, `version`, `same-role`, `peer-lost`, `host-restarted`, `link-lost`). Số tinh chỉnh: `config.js` → `COOP`.
Đường truyền là giao diện: lên internet sau này chỉ cần viết `createRtcTransport()` cùng các hàm đó (WebRTC DataChannel + bắt tay Firestore); `coop.js` không đổi.

## 3. Giao thức (phiên bản `COOP.proto` = 1; số little-endian)
| Gói | Chiều | Nội dung | Cỡ |
|---|---|---|---|
| `SNAP` (1) nhị phân | chủ → khách, 20 / s | tick, `back` (0 = đầy đủ, khác 0 = delta so với ảnh `tick − back` khách đã báo nhận), giờ chủ (ms), `ackInput`, `ackEv`, `evSeq`; **người chơi × 26 B**; id đã mất; bản ghi thực thể; sự kiện × 13 B | đầu 21 B; đầy đủ 80 thực thể ≈ 966 B; delta ≈ 414 B |
| bản ghi thực thể | | đầy đủ: id (varint khoảng cách) · loại · x, z, y (int16 cm) · hướng (1 byte = 1,4°) · byte trạng thái · byte máu. Delta: id · mặt nạ · chỉ trường đổi (dx, dz 1 byte khi < 1,27 m) | 11 B / ≈ 4–5 B khi chỉ di chuyển |
| `INPUT` (2) nhị phân | khách → chủ, 30 / s | seq, `ackTick` (ảnh mới nhất đang giữ), giờ khách, `ackEv`, `evSeq`, **người chơi 26 B**, sự kiện của khách | 43 B + 13 B / sự kiện |
| người chơi (26 B) | | id · x, y, z (cm) · hướng thân, hướng ngắm (16 bit) · độ ngẩng · vx, vz (cm/s) · tư thế (`NET_STANCE`) · súng · cờ (`NET_PFLAG`: bắn, nạp, cưỡi, ngã, ngắm, chạy nước rút, trên không, chết) · máu, máu tối đa · id thú cưỡi | |
| sự kiện (13 B) | cả hai | loại (`NET_EV`: SHOT, HIT, DEATH, EXPLOSION, GRENADE, RADIO, MARK, CUE) · a · b (id) · x, y, z (cm) · p (tham số 16 bit). Đánh số, **gửi lại trong mọi gói tới khi bên kia báo nhận; giao đúng một lần, đúng thứ tự** | |
| `PING` / `PONG` (3 / 4) | cả hai, 1 / s | giờ người gửi → độ trễ tới người chơi kia | 6 B |
| chữ JSON `{"k":…,"v":1}` | cả hai | `hello` (sid, tên, vai) · `settings` (seed, battle) · `ready` · `start` · `field` (dấu vân tay chiến trường) · `end` (lý do) | ≤ 4 KB |
| chữ `{"sys":…}` | server ↔ trang | `joined` · `peer-join` · `peer-leave` · `error` (`no-room` 4404 · `room-full` 4409 · `bad-request` 4400) · `ping` / `pong` | |

Byte trạng thái thực thể (`NET_ESTATE`): bit 0–2 tư thế (`NET_POSE`: STAND, RUN, CROUCH, PRONE, CLIMB, MOUNTED, STUNNED, DOWN) · 0x08 đang bắn · 0x10 nạp đạn · 0x20 trong chỗ nấp · 0x40 tinh nhuệ · 0x80 quân ta.
Mất gói không sao: delta luôn dựa trên ảnh khách **đã báo nhận** nên gói sau tự chữa; quá 24 ảnh không có báo nhận thì gửi ảnh đầy đủ. Byte hỏng → `CoopProtocolError` (`TRUNCATED`, `VERSION`, `KIND`, `LIMIT`, `NO_BASE`, `DELTA`, `ORDER`, `TRAILING`, `JSON`), phiên đếm lỗi và bỏ gói, không ném vào vòng lặp.

## 4. Số đo thật (`npm run coop-test`, 80 thực thể **đều đang di chuyển**, 20 ảnh / s, 10 giây mô phỏng, qua `lan-room` trên 127.0.0.1)
- **Chủ → khách: ≈ 8,4 KB/s** dữ liệu (≈ 9,4 KB/s tính cả đầu khung WebSocket + TCP/IP); nếu không delta: 19,3 KB/s. **Khách → chủ: ≈ 1,4 KB/s** (≈ 3,2 KB/s trên dây). Ước tính trong kế hoạch là 10–20 KB/s.
- **Sai số nội suy** ở độ trễ 100 ms, chuyển động thẳng: **0,7 cm** (đi bộ ≤ 6 m/s), 0,8 cm (trực thăng 18 m/s); đi vòng tròn 4 m/s: 0,7 cm; mất 10 % ảnh + trễ lệch 0–30 ms vẫn 0,7 cm. Giới hạn đặt ra: 5 cm.
- Mất 20 % gói cả hai chiều: mọi ảnh tới nơi giải ra đúng từng số, sự kiện vẫn đủ và đúng thứ tự. Server cắt cả hai socket giữa trận: hai bên tự nối lại (≈ 0,1 s với cấu hình của test; mặc định lần thử đầu sau 0,4 s), trận chạy tiếp bằng delta, không phải gửi lại ảnh đầy đủ.
- Đây là số của Node trên một máy (độ trễ ≈ 0,2 ms). Wi-Fi thật, trình duyệt thật: chưa đo.

## 5. DANH SÁCH MÓC cho bước sau — nối tầng mạng vào game
Nguyên tắc: code nối đặt ở tầng `game/` (đề xuất `game/coop-host.js`, `game/coop-guest.js`, `game/coop-ids.js`, `ui/coop-lobby.js`), import từ `'../hub.js'`; **không** import hub trong `net/*`. Mọi chỗ chèn bọc `if(coopActive())` để chơi một người không đổi. Tầng mạng không dùng `Math.random` (khi có `?seed=` đó là bộ sinh của chiến trường) — code nối **trên máy khách** cũng không được gọi `Math.random` giữa `__reseed` và lúc dựng xong.

**A. Khởi động, seed, phòng chờ**
| # | Ở đâu (file : hàm) | Việc |
|---|---|---|
| M1 | `src/game/startup.js` (cuối file) | gọi `coopStart({ name:PROFILE.nickname })`; có phiên → mở phòng chờ thay cho menu. Chủ: `coopSetSettings({ seed:coopParseUrl(location.search).seed, battle:{ biome, level, tod, wx, diff, unit } })` |
| M2 | `src/game/flow.js : startGame` (dòng 11–12, đã có `__reseed(0)`) | `coopOnState('playing')` → cả hai gọi `launchGame({ mode, level })` với `battle` đã chốt. Khách thiếu `?seed=` hoặc khác seed của chủ → tự tải lại trang với `&seed=` đúng (seed chỉ cài được lúc tải trang: `src/boot/safety.js`) |
| M3 | `src/core/config.js : ARENA, MOBILE` · `PROFILE.quality` · `PROFILE.difficulty` | phải bằng nhau ở hai máy: đưa vào `battle` (`arena`, `mobile`, `quality`, `diff`); khác → báo "chưa chơi chéo được" thay vì vào trận |
| M4 | sau khi dựng xong: `flow.js : startGame` dòng 56, `src/loot/upgrades.js : chooseUpgrade` dòng 43 | tính dấu vân tay bằng `netHashStep`: `heightAt` trên lưới 16 × 16, `blocks.length` + (x, z, kind) từng cái, `towers`, `FORTS`, `TREES.length` → `coopSetFieldHash(h, 'stage ' + S.stage)`; `coopOnField(same)` sai → dừng và báo. **Đây là phép thử đầu tiên phải chạy trên hai trình duyệt** |
| M5 | `src/loot/upgrades.js : chooseUpgrade` (trước `applyBiome`, dòng 43) | sang màn mới **không** reseed → hai máy lệch. Thêm `if(globalThis.__reseed) globalThis.__reseed(S.stage)` (cả hai máy, vô hại khi chơi một người có `?seed=`); chủ chọn nâng cấp, gửi CUE cho khách dựng màn |
| M6 | `src/ui/briefing.js` dòng 58 (`S.mode='playing'` sau đếm ngược) · `src/game/intro.js : startIntro` | hai máy vào `playing` cùng lúc: chủ gửi `CUE go`; khách chờ nó (bỏ đếm ngược riêng) |
| M7 | `src/game/flow.js : togglePause` (72), `askLeave`, `quitToMenu` · `src/game/player-damage.js : gameOver` (56) | co-op không dừng thế giới: tạm dừng chỉ mở menu; thoát → `coopStop('left')`; `gameOver` / `campaign/boss.js : victory` → chủ gửi CUE, khách hiện cùng màn |

**B. Vòng lặp `src/game/loop.js : loop` (nhánh `S.mode==='playing'`, dòng 44–86)**
| # | Việc |
|---|---|
| M8 | **Chủ:** sau `updateFireteam` (dòng 69) thêm `if(coopSnapDue(nowMs)) coopHostSnapshot()` — dựng `coopFrame()` rồi `coopBroadcast(f)`. Thứ tự thêm vào khung: người chơi → địch gần hai người nhất → quân ta → còn lại (quá 120 thì `netFrameAdd` bỏ phần sau) |
| M9 | **Khách** không chạy mô phỏng: bỏ `updateSoldierWar, updateSquads, updateDirector, updateSurprises, updateEnemies, updateEnemyMissiles, updateTowers, updateForts, updateWaves, updateSoldiers, updateFireteam, updateCoreGuns, updateHeliCrew, updateEnvEvents, updateTunnels, updatePOWs, updateDepots, updateRally, updateParadrops, updatePickups`; thay bằng `coopGuestApply(coopSample(nowMs))`. **Giữ**: `updateReload, updateCrosshair, updateCavalry` (lính của mình chạy ngay trên máy mình), `updateBullets` (chỉ đạn của mình), `updateFieldcraft` (chỉ phần bay / nổ của lựu đạn), camera, HUD, mọi `update*` hiệu ứng sau nhánh `playing`, `updateTroopBatch` (vẽ mọi lính đã được đặt tư thế — không cần sửa) |
| M10 | **Khách:** `if(coopInputDue(nowMs)) coopSendInput(trạng thái lính mình)` ngay sau `updateCavalry` (dòng 50) |

**C. Chủ phòng ĐỌC trạng thái ở đâu**
| # | Thứ | Nguồn (file : biến / hàm) | Trường → gói |
|---|---|---|---|
| M11 | Địch (bộ binh + trực thăng) | `src/actors/enemies.js : enemies[]`, tạo ở `spawnEnemy` (37) | `e.pos.x/z`, `e.pos.y` (chỉ `def.air`; bộ binh gửi y = 0, khách tự `heightAt`), `e.facing`, `e.hp/e.maxHp`, loại = thứ tự `Object.keys(ENEMY_DEFS)` của `e.type`, `e.elite`; tư thế = `e.mesh.userData.stance` (`stand/low/crouch/prone` — đặt ở `infantry.js : updateInfantry` dòng 158 `poseSoldier`), STUNNED khi `now < e.stunUntil` hoặc `dazed(e, now)` (`fx/realwar.js` 15), FIRING khi vừa `fireRound` (infantry.js 65) trong 50 ms qua, COVER = `e.inCover` |
| M12 | Quân ta | `src/actors/fireteam.js : FT[]` (`spawnAlly` 16: `a.pos, a.facing, a.hp, a.role`) · `src/actors/soldiers.js : soldiers[]` (`spawnSoldier` 276: `s.pos, s.hp`) | như M11 + cờ ALLY; loại = 64 + thứ tự vai (`SQUAD.mix`), lính gác Lõi = 96 |
| M13 | Lính của chủ phòng | `S.player` + `CV` (`src/game/cavalry.js` dòng 6, `updateCavalry` 65) | `p.pos`, `p.lift` (leo: `game/soldier-climb.js`), `p.vel`, `CV.mounted ? CV.facing : p.facing`, `p.aimSmoothed`, `CV.stance`, `p.guns[p.gunIdx].id` → thứ tự trong `Object.keys(GUNS)`, `S.firing`, `p.guns[p.gunIdx].rU` (đang nạp), `CV.mounted`, `CV.dead` / `S.mode==='dying'`, `p.hp/p.maxHp`, `p.bike` |
| M14 | Lính của khách (trên máy chủ) | `coopOnInput(st)` / `coopSample(nowMs).pl[0]` (đã nội suy, trễ 70 ms) | chủ giữ một "người chơi thứ hai" (vị trí, bán kính, máu) để AI thấy và bắn: xem M20–M21 |
| M15 | Đạn | `src/combat/lock-on.js : spawnBullet` (35), `updateBullets` (80), `combat/projectiles.js : bullets[]` | **không đồng bộ từng viên.** Địch / quân ta bắn: khách tự vẽ đường đạn từ cờ FIRING. Đạn nặng (B40 `actors/enemy-missiles.js : launchEnemyMissile` 23, bắn tỉa `ai/tiers.js : markStep` 40): một sự kiện SHOT (a = người bắn, x y z = đích) |
| M16 | Lựu đạn, khói | `src/ai/fieldcraft.js : throwNade` (51 — tách phần ngẫu nhiên: gửi điểm rơi **sau** sai số), `throwSmoke` (31), `NADES`, `SMOKES` | sự kiện GRENADE (a = người ném, x y z = điểm rơi, p = thời gian bay × 100) |
| M17 | Nổ, hố bom | `src/fx/explosions.js : bigExplode` (6), `vehicleExplode` (46) · `src/world/heightfield.js : deformCrater` (80) | sự kiện EXPLOSION (x y z, p = bán kính × 10); khách gọi cùng hàm — hố bom đổi `heightAt` nên **bắt buộc** đồng bộ |
| M18 | Vật phá được | `world/cover.js : damageBlock` (96) / `destroyCover` (209) · `world/towers.js : collapseTower` (107) · `world/tree-fall.js : fellTree` (25) · `world/brick-walls.js : collapseWall` (112) · `world/fortress.js : damageGate` (362), `breachFort` (366) · `actors/core.js : damageCore` (118) | sự kiện CUE (p = loại, b = id cố định — mục F) |
| M19 | Đạo diễn trận, đợt, điện đài | `src/campaign/director.js : dirSay` (29), `DIR.phase`, `DIR.cue` · `campaign/waves.js : startWave` (35), `S.wave` · `campaign/operations.js : radio` (11) · `audio/voice.js : sayVoice` (28) · `campaign/boss.js : startBoss` (9), `bossStageWon` (12) | sự kiện RADIO (p = số thứ tự khoá trong `DIRECTOR.say` / khoá giọng); CUE `wave` (p = `S.wave`), CUE `phase`, CUE `boss`, CUE `stage-won`. Đạo diễn chỉ chạy trên máy chủ; `sample()` trong director.js đọc `S.player` — về sau cho nó nhìn cả hai (K-g) |

**D. Áp lên máy và sát thương**
| # | Thứ | Ở đâu | Việc |
|---|---|---|---|
| M20 | Khách vẽ địch / quân ta | `out.born[]` → `getEnemyMesh(type)` (`enemies.js` 19) hoặc `makeSoldierMesh()` (`soldiers.js` 121) + `makeSoldierBar()`; mỗi khung: `mesh.position.set(x, heightAt(x, z) hoặc y, z)`, `mesh.rotation.y = heading`, `animateSoldier(mesh, quãng đi / scale, dt, đangBắn)` (180), `poseSoldier(mesh, tư thế, dt)` (220), STUNNED → `dazePose` (`fx/realwar.js` 17); `out.gone[]` → trả mesh về `enemyPool` | nên đẩy bản ghi `{ type, def, mesh, pos, hp, maxHp, r, facing, nid }` vào chính `enemies[]` của khách để ngắm (`combat/aim.js : trackTarget`), radar, thanh máu, `updateBullets` dùng lại không sửa |
| M21 | Khách bắn trúng | `src/combat/soldier-fire.js : soldierFire` (29) → `spawnBullet` → `lock-on.js` dòng 129 `damageEnemy(e, dmg)` | trên máy khách thay bằng `coopSendEvent(NET_EV.HIT, COOP.ids.guest, e.nid, x, y, z, dmg × 10)`; chủ nhận → `damageEnemy(tìmTheoNid(b), p / 10)` (`actors/damage.js` 6) |
| M22 | Địch chết | `src/actors/damage.js : killEnemy` (11) | chủ gửi DEATH (a = nid, x z = hướng trúng `e._hx / e._hz`, p = nặng `_big / _blast`); khách gọi `infantryDown` (`infantry.js` 161) / `gunshipDown` (`actors/vehicles.js` 123) cho mesh đó. Điểm, kinh nghiệm (`soldierKill`), rơi đồ: chủ quyết, gửi CUE |
| M23 | Địch bắn trúng người chơi | `lock-on.js : updateBullets` dòng 134–149 (kiểm `S.player` và `FT`) · `infantry.js : infTarget` (53), `infThreat` (62) · `ai/awareness.js` | chủ thêm lính của khách vào danh sách mục tiêu; trúng → trừ máu của khách **trên máy chủ**, gửi HIT (b = `COOP.ids.guest`, p = sát thương); khách chỉ chạy phần cảm giác của `player-damage.js : damagePlayer` (7); máu thật đọc từ khối người chơi trong ảnh chụp |
| M24 | Hình người chơi kia | `src/actors/general.js : buildGeneral` (24), `poseRider` (173) · `actors/horse.js : buildHorse` (22) · `game/xeom.js : buildBikeMount` (58) · `game/soldier-moves.js : footPose` (43) | **việc lớn nhất:** `CV` là đối tượng duy nhất cho một người. K2 bản đầu: vẽ người kia bằng `makeSoldierMesh()` + `animateSoldier / poseSoldier` (đi bộ) và một `buildHorse()` / `buildBikeMount(kind)` thứ hai khi `MOUNTED`; bản đẹp: tách trạng thái `CV` thành đối tượng truyền vào |
| M25 | Ngã / hồi sinh / hết mạng | `src/game/player-damage.js : playerDie` (27), `beginDeath` (32), `respawnPlayer` (43), `gameOver` (56) | cờ DOWNED / DEAD trong khối người chơi; thua khi **cả hai** hết mạng (K-b) |

**E. Giao diện:** phòng chờ (tên, sẵn sàng, ping từ `coopInfo().rtt`, địa chỉ + QR từ `GET /lan-room/info`), tên trên đầu + mũi tên mép màn hình + chấm radar (`ui/radar.js : drawRadar`) cho người kia, MARK một phím (`input/bindings.js`), dòng "mất kết nối — đang chờ" khi `coopSession().peerLost`.

**F. Cái gì phải có id cố định** (hiện **không thực thể nào có id**; id 1–65535, không dùng lại trong một trận; 1 = chủ, 2 = khách, thực thể từ 16)
- Do **chủ** cấp lúc tạo (`e.nid = nextNid++`): địch ở `enemies.js : spawnEnemy`, quân ta ở `fireteam.js : spawnAlly` và `soldiers.js : spawnSoldier`, ngựa / xe của mỗi người chơi, lính nhảy dù / leo dây (`actors/paradrop.js : PARAS`, `actors/helis.js : CLIMBERS`), vật phẩm (`loot/powerups.js : dropPowerup` 106).
- **Thứ tự dựng = id** (hai máy cùng seed nên trùng nhau; gán `nid = chỉ số` NGAY sau khi dựng vì các mảng bị `splice` khi vật bị phá): `world/cover.js : blocks[]` sau `buildBlocks`, `world/towers.js : towers[]`, `world/tree-fall.js : TREES[]`, `world/fortress.js : FORTS[]`, đoạn tường của `world/brick-walls.js`, `world/depots.js : DEPOTS[]`, `world/pow.js : POWS[]`.

**G. Thứ tự nên làm:** M1–M6 (phòng chờ + cùng chiến trường, kiểm bằng M4) → M13, M10, M14, M24 (thấy nhau) → M8, M9, M11, M20 (thấy địch) → M21–M23, M25 (đánh chung) → M15–M19 (sự kiện) → E.
Test hai trang: thêm `tools/ts.mjs coop` mở 2 tab cùng một Chrome (chủ + khách) vào `lan-room`, probe đọc `coopInfo()` và so `fieldHash`.

## 6. Chưa kiểm được (không có trình duyệt lúc làm)
- Trang thật nạp `src/net/*` qua hub: mới chứng minh bằng luật phạm vi R8–R11 + cú pháp, chưa mở game.
- WebSocket của trình duyệt (Chrome / Safari / điện thoại) với `lan-room` — test dùng WebSocket của Node 22 và một client TCP tự viết.
- Hai máy thật trên Wi-Fi: hộp thoại tường lửa macOS, độ trễ và mất gói thật, tải model qua LAN.
- "Cùng seed → cùng chiến trường" trên hai máy (M3–M4): model nạp bất đồng bộ hoặc thiết lập chất lượng có thể làm lệch; chưa đo.
