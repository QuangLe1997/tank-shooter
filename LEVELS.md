# STEEL SIEGE — Bảng Màn chơi · Độ khó · Phần thưởng

> Tham chiếu **số liệu thực tế đang chạy trong `index.html`** (đồng bộ tới **Z83**). Khác với `GAME_DESIGN.md` (mô tả ý tưởng gốc v1), file này ghi đúng con số code dùng để cân bằng. Cập nhật khi đổi balance.

---

## 1. Có bao nhiêu màn?

- **5 màn (Stage 1 → 5)**, mỗi màn 1 biome + 1 boss. Hạ boss **OVERLORD (Stage 5)** → **VICTORY**.
- **NEW GAME+ (leo thang vô hạn)**: hạ Overlord → vào **NG+1, NG+2…** (giữ nguyên tài khoản). Mỗi vòng `loop` **mạnh hơn VÀ thưởng nhiều hơn**:
  - Địch HP ×`(1 + loop×0.45)` · Địch sát thương ×`(1 + loop×0.22)` · Boss HP ×`(1 + loop×0.55)`.
  - Xu/điểm ×`(1 + loop×0.6)` · Boss rơi **`2 + loop` 💎**.
  - ⇒ Có chỗ dùng kho vũ khí/nâng cấp đã cày + cày kim cương VIP có ý nghĩa vô hạn. CONTINUE/checkpoint nhớ cả `loop`.
- Cấu trúc 1 màn = **5 đợt (wave) + 1 boss**.

| Stage | Biome | Boss | Boss HP |
|---|---|---|---|
| 1 | DESERT | IRON BULL | 1.300 |
| 2 | RUINS | TEMPEST | 1.700 |
| 3 | TUNDRA | GOLIATH | 2.400 |
| 4 | FOUNDRY | REAPER | 2.600 |
| 5 | CITADEL | OVERLORD | 3.600 |

> **ĐỘ KHÓ (Z53 — SETTINGS):** chọn ở bảng **SETTINGS**, nhân lên trên NG+/hợp đồng:
> - **RECRUIT** (dễ): địch HP ×0.65 · sát thương ×0.6 · thưởng ×0.8 — cho người mới.
> - **SOLDIER** (chuẩn): ×1.0 toàn bộ (mặc định).
> - **VETERAN** (khó): địch HP ×1.5 · sát thương ×1.4 · **thưởng ×1.6** (khó hơn = thưởng cao hơn).
> Số liệu ở `config.js → BALANCE.difficulty`. (VD grunt 32 HP → 21 / 32 / 48.)

> **CHỌN ĐỊA HÌNH (Z40, dialog 3D Z48):** nút **BATTLEFIELD** ở màn Start mở **dialog gallery 3D** (thẻ nghiêng phối cảnh, thẻ chọn nhô lên + viền sáng "✓ ĐÃ CHỌN", mỗi thẻ có preview biome) — chọn **AUTO** (xoay 5 biome theo màn như bảng trên) hoặc **khoá 1 loại** cho cả lượt chơi; luôn có mặc định chọn sẵn. Có **6 địa hình**: DESERT · RUINS · TUNDRA · FOUNDRY · CITADEL + **MEADOW (đồng cỏ)**. Mỗi địa hình có nền gồ ghề + chi tiết riêng (cỏ / băng nứt / khe nham thạch / đá vỡ), **vật trang trí rải** (đá·bụi cỏ·băng·xỉ·gạch — tránh Core & điểm spawn nên không cản đường), tường viền + sương + ánh sáng đổi màu. Lưu ở `PROFILE.terrain` (-1 = AUTO).

---

## 1b. Chiến dịch & mục tiêu chiến lược (Z83)

| Màn | Chiến dịch | Mục tiêu (khi còn đứng) | Wave kịch bản |
|---|---|---|---|
| 1 | OPERATION SANDSTORM | FUEL DEPOT — xe địch +15% tốc độ (HP 260) | W2 phục kích · W4 đoàn xe |
| 2 | OPERATION BROKEN CITY | RADIO RELAY — tiếp viện nhanh 25% (HP 220) | W2 xe phun lửa · W4 phục kích |
| 3 | OPERATION WHITE SILENCE | RADAR SITE — +1 trực thăng mỗi wave (HP 260) | W3 không kích · W5 đoàn xe |
| 4 | OPERATION IRON FURNACE | ARTILLERY BATTERY — pháo khoá vị trí bạn mỗi 9s (HP 320) | W2 đoàn xe · W4 không kích |
| 5 | OPERATION LAST CITADEL | COMMAND BUNKER — địch +15% sát thương (HP 440) | W1 phục kích · W3 không kích · W5 đoàn xe |

- HP mục tiêu × NG+ loop × độ khó × `(1 + 0.14×(màn−1))`. Thưởng phá: **300 + 120×màn xu** (× loop × độ khó × hợp đồng) **+ 1 💎 + 1.500 điểm**.
- Wave có kịch bản thay cho sự kiện ngẫu nhiên. **Phục kích:** 2 tổ (3 từ màn 3) bộ binh xuất hiện cách xe ~17. **Đoàn xe:** heavy + grunt + gunner + grunt (+ heavy + atgm từ màn 3, + shield + heavy từ màn 5) vào cùng 1 hướng, nhịp ×0.4.

## 1c. Lái xe, va chạm & địa vật (Z85–Z86)
| Thông số (`DRIVE`, config.js) | Giá trị | Ý nghĩa |
|---|---|---|
| `accel` / `launch` / `launchV` | 23 / 0,32 / 11 | từ đứng yên chỉ 32% lực, đủ lực ở 11 u/s → 0→90% tốc tối đa ≈2,4 s (Z99) |
| `coast` / `brake` | 14 / 44 | nhả ga trôi ~1,8 s; kéo ngược = phanh |
| `reverseMul` / `reverseAngle` | 0,5 / 2,25 rad | cần kéo ra sau thân ≥129° → lùi 50% tốc |
| `pivot` / `turnAtSpeed` | 2,6 / 1,55 rad/s | xoay tại chỗ (A/D), chạy nhanh ôm cua rộng (Z99) |
| `ram.minImpact` | 7 u/s | dưới mức này va chạm không mất máu |
| `ram.toEnemy` / `toPlayer` / `toBoss` | 1,15 / 0,42 / 0,7 | × (tốc áp sát − 7) × 2·m_bên_kia/(m₁+m₂) × (1 − 0,5·phần chủ động), địch/boss +22%/màn |
| `wallBreak` | 14 u/s | húc tường gạch ≥ mức này → đổ; chậm hơn chỉ sứt (2,2 × tốc) |
| `climb` | 15,5 u/s | leo qua đá thấp (bán kính < 1,8) |

Ví dụ: xe bạn (khối lượng 1,25) chạy hết tốc 26 húc xe nhẹ (1,0) đang lao tới 3 u/s → địch mất ≈ 28 máu × (1 + 0,22·(màn−1)), bạn mất ≈ 4–5. Boss (khối lượng ~21) lao vào bạn ở 30 u/s → bạn mất ≈ 18.
Tường gạch: 4–7 dãy/màn (mobile ít hơn 1), mỗi dãy 3–6 đoạn 3 m; máu mỗi đoạn = 140 + 30 × chiều cao còn lại (≈ 240–270); sập tầng ở 66% và 33%.

## 1d. Lính, trại & cầu (Z89–Z90)
| Thông số | Giá trị | Ghi chú |
|---|---|---|
| APC địch thả quân (`TROOPS.dismount`) | từ màn 2 · trong 28 · 3–5 lính · 0,38 s/người | lính đầu là RPG từ màn 3 |
| Kíp lính trên xe (`RIDER`, `TROOPS.ridersFrom`) | từ màn 1 · 3 người (+nâng cấp TANK CREW) | G / CREW: xuống đánh bộ, bấm lại: lên xe |
| FIRETEAM (`TROOPS.fireteam`) | **Z104:** 6 lính + 0,8/màn (tối đa 12, điện thoại 9) · 42 máu · 7 dmg (+12%/màn) · tầm 21 · hồi chiêu 24 s | APC ta chở tới rồi rút |
| Trại lính (`CAMP`) | **Z104:** màn 1–3: 2 trại, màn 4+: 3 · 420 máu (+18%/màn) | ~16 s ra 2–4 lính khi đang có wave, dừng nếu sân ≥ 22 lính |
| Thưởng phá trại | 900 điểm · 220 xu (+25%/màn) · vật phẩm | cán lều +60 điểm |
| Cầu treo (`BRIDGE`) | 75% tháp ghép cặp, cách 12–18 | 1 lính gác tuần tra 1,6 u/s, bắn như lính tháp |

## 1e. Chiến trường rộng, tổ lính tự chủ, trại giam, kho & lính dù (Z104)
| Thông số | Giá trị | Ghi chú |
|---|---|---|
| Bản đồ (`ARENA`) | nửa cạnh **84** (trước 60) → diện tích ×1,96 | gò, hố, vật cản, đá, tường gạch, tháp nhân theo diện tích (`AREA_K`) |
| Nòng súng trên điện thoại (`AIM`) | **cố định đầu xe** · nón ngắm ±0,17 rad (pháo/cối ±0,32) · làn 1,8 | đẩy cần nhẹ (< 38%) = xoay tại chỗ để ngắm |
| Độ sát thương lên lính (`LETHAL`) | **1 phát đạn xe tăng = chết** · nổ: chết trong 45% bán kính, bị thương giảm dần tới 125% (tối thiểu 25%) | đạn súng trường/MG/drone (`inf`) vẫn trừ máu thường · áp dụng cả lính ta lẫn lính địch |
| Kích thước lính (`TROOPS.look`) | 1,85 cho mọi lính (lính ta trước đây 1,15) | ta: rằn ri xanh, mũ ô liu, băng tay xanh chanh · địch: kaki, mũ đỏ sẫm, băng tay đỏ |
| Bộ binh địch / sân (`INFANTRY.squad`) | tổ 4–6 · tối đa 22 (điện thoại 14) | lính súng trường **nấp** khi xe tăng trong 20 |
| Tổ lính tự chủ (`SQUAD`) | nghĩ lại mỗi 0,4 s · săn địch trong 62 · nấp xe tăng trong 20 (tìm chỗ nấp trong 13) | hạ lính gác tháp: 32%/phát · nhặt đồ trong 26 → KHU TẬP KẾT |
| Súng chống tăng (kho vũ khí) | 34 dmg (+12%/màn) · nổ 2,4 · tầm 26 · nạp 3,4 s | súng trường ×1,35 |
| Khu tập kết (`RALLY`) | bán kính 6, phía ta cạnh điểm xuất phát | đồ để ở đây **không hết hạn** |
| Trại giam (`POW`) | màn 1–3: 1, màn 4+: 2 · 3–5 tù binh · 3–4 lính canh (đt 2–3, RPG từ màn 3) | giải cứu: 600 điểm + 120 xu (+25%/màn); tù binh lên xe, đầy chỗ thì đi bộ theo |
| Kho vũ khí / kho xe tăng (`DEPOT`) | mỗi loại 1/màn · 4–5 lính canh (đt 3) · chiếm 4 s (nhanh hơn khi nhiều lính) | 800 điểm + 150 xu · kho xe: 1–2 xe đỗ |
| Xe tăng đồng minh (`ALLY_TANK`) | 260 máu (xe nặng ×1,6, +15%/màn) · 30 dmg · tầm 30 · nạp 1,7 s · tối đa 3 | tự chọn mục tiêu (xe trước), về cạnh bạn khi hết địch (dây 58) |
| Lính dù (`PARA`) | từ đợt 2 · mỗi 42–62 s (đt 55–80) · 4–6 lính (đt 3–4) · rơi 3,6 s | vòng đỏ báo trước chỗ tiếp đất · không thả khi sân đã quá đông |

## 1f. Bố trí trận địa, tư thế & binh chủng, địa hình rõ nét (Z105)
| Thông số | Giá trị | Ghi chú |
|---|---|---|
| Quân số khi bố trí | ghế trên xe (3 + nâng cấp, tối đa 7) + tổ bộ binh (6 + 0,8/màn) | mỗi màn tiếp tế đủ quân; lần sau nhớ cách chia |
| Trọng điểm | đi cùng xe · giữ Lõi (≤6) · khu tập kết (≤4) · mỗi trại giam / kho (≤6) · hai cánh (≤5) | điểm tập kết dừng ở 62% đường tới mục tiêu địch; lính giữ khu vực bán kính 30 |
| Binh chủng tối đa (`DEPLOY.roleMax`) | súng máy 1–2–2–2–3 · cối 0–1–1–2–2 · công binh 1–1–2–2–2 (theo màn) | phần còn lại là súng trường; dư → giao cho lính nhảy khỏi xe |
| Súng máy (`SQUAD.mg`) | loạt 8 viên · 0,1 s/viên · nghỉ 1,8 s · 4,2 dmg · tầm 28 | luôn nằm bắn |
| Cối (`SQUAD.mortar`) | 30 dmg (+12%/màn) · nổ 4 · tầm 12–44 · nạp 3,4 s · bay 1,5 s | ưu tiên cụm lính, tháp, nhà lính, xe |
| Công binh (`SQUAD.sapper`) | đặt thuốc 2,6 s · ngòi 2,4 s · tìm mục tiêu trong 50 · chạy ra ≥ 10 | đánh sập tháp canh / nhà lính |
| Tư thế (`SQUAD`) | lao 1–1,6 s rồi giữ 2,4–4,2 s · nằm bắn khi cách > 13 | nằm: bán kính trúng 0,42 (đứng 0,75); địch cũng nằm/quỳ |
| Địa hình (`RELIEF`) | lõm tối + ẩm + che sáng · sườn dốc lộ đất · đỉnh/vành hố sáng hơn | máy tính: địa hình đổ bóng thật |

## 1g. Chiến trường rộng, ranh giới phức tạp (Z106)
| Thông số | Giá trị | Ghi chú |
|---|---|---|
| Khung (`ARENA`) | nửa cạnh **130** (Z104: 84, gốc: 60) | sân chơi thật ≈ **40–44 nghìn m²** (×3 bản gốc, ×1,5 bản Z104) |
| Ranh giới (`FIELD`) | đường viền bất quy tắc: nửa tròn nửa vuông + 6 hoạ âm + 2–4 vịnh lõm (sâu 16–30%) | đổi hình mỗi màn; phía ta rộng nhất (≥ 90%), phía mục tiêu địch ≥ 78%, nơi khác ≥ 66% |
| Ngoài hàng rào | cao nguyên đá cao 5,5 m trong 9 m, đá tảng rải dọc | không đi vào được; hàng rào, dây thép gai đi theo đường viền |
| Sống đá trong sân | 3–5 dải (điện thoại 2–3), dài 22–46 m, dải dài có **khe vượt** 7–10 m | chắn xe, chắn đạn, làm chỗ nấp → chia khu, tạo điểm nghẽn |
| Địch vào sân | qua hàng rào, ưu tiên điểm cách xe 40–85 m | đỡ phải chạy xa trên sân lớn |


## 1h. Đại bản doanh & chiến dịch vượt cấp (Z107)
- **Mỗi màn 3–4 thành** (điện thoại 3): 1 THÀNH chính (bậc 3, cổng 3600, 30–40 lính + 3–5 xe trong kho quân), các ĐỒN/PHÁO ĐÀI (cổng 1500/2300, 16–32 lính, 1–3 xe). Cổng ×(1+0.22·(màn−1)) × vòng NG+ × độ khó.
- **Trong trận:** tới gần 72 m hoặc bắn cổng → thành báo động, tướng (xe hạng nặng tinh nhuệ ×7 máu) xuất hiện; tối đa 16 lính + 3 xe cùng lúc (điện thoại 9 + 2), chết bao nhiêu bù bấy nhiêu từ kho quân. Mỗi 10–16 s thành tung một tổ lính/xe ra chiến trường; 70% viện binh của các đợt ra từ cổng thành.
- **Thắng màn:** chiếm hết các thành (diệt tướng). Thành chính mở phong toả cuối cùng; phá cổng → trùm màn xuất hiện giữa thành.
- **Phần thưởng chiếm thành:** (700 + 260×màn) × bậc xu · 1–3 ◆ · 3–5 vật phẩm · 35%×bậc cơ hội nhận một khẩu súng chưa có.
- **Chiến dịch:** cấp L = vòng ⌊(L−1)/5⌋, màn (L−1)%5+1; thời tiết theo `CAMPAIGN.weather`; thắng màn → mở cấp kế. Trận tự chọn không ghi đè điểm lưu chiến dịch.

## 2. Rải quân (wave) — số lượng & loại địch

**Số địch mỗi wave** = `floor(3 + wave + (stage-1)×1.5)`

| | W1 | W2 | W3 | W4 | W5 | Tổng/màn |
|---|---|---|---|---|---|---|
| Stage 1 | 4 | 5 | 6 | 7 | 8 | ~30 |
| Stage 2 | 5 | 6 | 7 | 8 | 9 | ~35 |
| Stage 3 | 7 | 8 | 9 | 10 | 11 | ~45 |
| Stage 4 | 8 | 9 | 10 | 11 | 12 | ~50 |
| Stage 5 | 10 | 11 | 12 | 13 | 14 | ~60 |

→ Một lượt chơi xuyên 5 màn ≈ **220 lính thường + 5 boss**.

- **Giới hạn địch cùng lúc trên sân** = `floor(5 + stage×1.5)` → S1 = 6 · S2 = 8 · S3 = 9 · S4 = 11 · S5 = 12 (không bao giờ flood người mới).
- **Nhịp spawn** = `1.15 − 0.4×diffScale` giây/con (càng về sau spawn càng nhanh).
- **Clear 1 wave**: +200 điểm. Giữa các wave nghỉ ~2.2s.

**Tỉ lệ loại địch (trọng số, bốc ngẫu nhiên):**
- `grunt` 5 (luôn có) · `scout` `2 + wave×0.4` · `gunner` `1 + wave×0.4 + (stage−1)` ← gunner tăng mạnh theo màn.
- **Stage ≥ 2** mở thêm: `bomber` `1+(stage−1)×0.5`, `mortar` `1+(stage−1)×0.6`.
- **Stage ≥ 3** mở thêm: `shield` `1+(stage−2)×0.7`.

### 6 loại địch — màu sắc, mục đích & tập tính

| Loại | Màu | HP | Bắn? | Mục đích & tập tính |
|---|---|---|---|---|
| **GRUNT** | đỏ-nâu | 32 | ✅ đạn đơn | Bộ binh cơ bản (xương sống mọi wave). Tiến tới giữ khoảng cách ~18, bắn 1 viên mỗi ~2s, tầm 32. |
| **SCOUT** | cam | 16 | ❌ | Trinh sát **nhanh nhất** (tốc 12). Không bắn — **lao vào HÚC** (ram). Áp sát gây rối, dễ chết. |
| **GUNNER** | đỏ-mận | 46 | ✅ **loạt 3 viên** | Xạ thủ liên thanh: bắn burst 3 viên (0.46s/viên) rồi nạp 2.3s, tầm 28. Sát thương dồn — tăng mạnh theo màn. |
| **MORTAR** | **xanh lá** | 38 | ❌ (spotter) | Pháo binh: KHÔNG bắn thẳng — giữ xa (34) & **GỌI PHÁO KÍCH** (artillery khoá mục tiêu). Từ Z32 **bắn shell lên trời thấy được**. Diệt hết mortar = tắt pháo kích. |
| **SHIELD** | xanh dương | 64 | ✅ đạn đơn | Lính khiên (trâu nhất thường) — **giáp trước**: đạn bắn từ phía trước chỉ 0.28× → phải đánh **sườn/sau**. Mở từ màn 3. |
| **BOMBER** | **đỏ** | 22 | ❌ (cảm tử) | Kamikaze: KHÔNG bắn — **lao thẳng vào xe**; **chạm trúng xe user là NỔ NGAY** (Z57: không còn bị giữ khoảng cách standoff, không còn delay 0.5s) → bán kính 4.6, **34 sát thương** + hất tung. Mở từ màn 2. **Hào quang đỏ + tia lửa + vòng cảnh báo + nháy gấp dần** khi lao tới → né hoặc bắn hạ kịp (HP chỉ 22). |
| **HEAVY** (Z33) | xám sắt | 140 | ✅ đạn nặng | **Bruiser**: máu trâu nhất, chậm, bắn **đạn to chậm sát thương cao (22) + đẩy lùi mạnh**. 2 nòng to + giáp hông. Mở từ màn 3. |
| **SNIPER** (Z33) | tím-than | 34 | ✅ bắn tỉa | **Marksman**: tầm xa nhất (52), **chính xác cao + đạn nhanh (đỏ)**, bắn chậm. Nòng dài + ống ngắm phát sáng tím. Mở từ màn 4. |
| **CARRIER** (Z33) | vàng-olive | 96 + 3×26 | ❌ (chở lính) | **APC chở 3 lính** bắn súng trường trên thùng xe. **Hạ vỏ xe HOẶC hạ hết 3 lính → xe gục** (bắn vào vừa bào vỏ vừa tỉa lính). Mở từ màn 3. |

### Xe địch mới (Z80)

| Loại | HP | Mở từ | Vai trò | Cách khắc chế |
|---|---|---|---|---|
| **FLAME TANK** | 74 | màn 2 | Lao sát, phun lửa nón tầm 11 (~15/s) | Giữ khoảng cách, CRYO/đạn xuyên; chết thì bình xăng nổ (6 m) |
| **ATGM** | 52 | màn 3 | Chiếu laser 1.2s → tên lửa dẫn đường (tốc 21, rẽ 1.5 rad/s, 30 sát thương) | Bắn hạ tên lửa, rẽ gắt, SMOKE; diệt khi đang ngắm (đứng yên) |
| **ENGINEER** | 62 | màn 3 | Hàn sửa xe bị thương nhất (~15% máu/s), tự hồi 3/s | Diệt trước tiên |
| **GUNSHIP** | 96 | màn 4 (AIR RAID từ màn 3) | Bay cao 7.5, quỹ đạo 19: súng mũi 9 viên/loạt + 2 rocket mỗi ~5s | FLAK ×1.8, MISSILE khoá được, KIN/ELEC; cối/pháo/lửa không chạm tới |

- Trọng số xuất hiện trong wave = `base + (stage − màn_mở)×per`: pyro 1.0+0.5 · engineer 0.6+0.3 · atgm 0.8+0.5 · gunship 0.45+0.3.
- Giáp **A** (máy bay): KIN 1.10 · AP 0.70 · HE 1.00 · FRAG 1.10 · FIRE 0.40 · CRYO 0.90 · ELEC 1.25 · HESH 0.60.
- Sự kiện **AIR RAID** (màn ≥ 3): +2 gunship vào wave (+1 nữa từ màn 5).

### Thiết bị (Z82) — trên vòng SPELL

| Thiết bị | Hồi | Hiệu quả | Khắc chế |
|---|---|---|---|
| **SMOKE** | 12s | Màn khói bán kính 9, 7s. Trong khói: địch bắn lệch ×4.5, tên lửa dẫn đường mất khoá, laser ATGM bị cắt | ATGM, sniper, trực thăng |
| **APS** | 16s | 12s, tự bắn hạ 4 vật thể bay vào bán kính 7 (rocket, tên lửa, đạn pháo nặng r ≥ 0.6) | RPG, ATGM, trực thăng, heavy |
| **MINES** | 14s | 3 mìn sau đuôi, kích hoạt 0.8s, 90 sát thương AP bán kính 4.2, sống 45s | Xe phun lửa, scout, bomber đuổi theo |

### Bộ binh địch (Z79) — đi bộ, theo tổ

| Loại | HP | Tầm | Sát thương | Tập tính |
|---|---|---|---|---|
| **RIFLEMAN** | 18 | 24 | 4/viên, ~1.5s | Dàn hàng, đi zig-zag, giữ cách ~15. Thấy xe lao tới (<10, tốc >7) thì nhảy sang ngang. |
| **RPG** | 24 | 30 | 22 trực tiếp, nổ lan 3 | Quỳ ngắm **1s có chớp đỏ** rồi phóng rocket (tốc 26, bắn đón). Rocket **bắn hạ được**. Từ màn 2. |

- **Số tổ mỗi wave** = `floor(0.5 + wave×0.25 + (stage−1)×0.35)` từ W2 → S1W2 = 1 … S5W5 = 3. Mỗi tổ 3–5 người (1 RPG từ S2, 2 RPG từ S4).
- **Nghiền:** xe player chạy >3.5 (hoặc đang dash) chạm lính → chết ngay, +50 điểm. Chạy chậm thì chỉ đẩy lính ra.
- **APC bị hạ:** mỗi lính còn sống có 70% nhảy ra thành rifleman.
- Tối đa 14 lính bộ cùng lúc (mobile 10) — không tính vào giới hạn xe tăng.

> **Lưu ý:** 3 loại **không nổ súng** (scout/mortar/bomber) vẫn tấn công — bằng **húc / gọi pháo / cảm tử**. Ngoài ra mỗi loại có thể thành **ELITE** (champion: HP×2.6, to hơn, hào quang vàng, thưởng béo) + 5 **BOSS** riêng mỗi màn.

> **Hình thù riêng (Z33):** mỗi loại có **silhouette khác nhau** dễ phân biệt — mortar = **ống pháo chĩa lên** (bắn đạn vọt lên từ nòng), gunner = **3 nòng**, shield = **tấm khiên trước**, bomber = **đầu đạn tròn + ngòi nổ sáng**, scout = **mũi húc nhọn**, grunt = nòng đơn cơ bản.

---

## 3. Đường cong độ khó

`diffScale = min(1, (stage−1)/4)` → **0 ở Stage 1, đạt tối đa 1.0 ở Stage 5**. Độ khó tăng từ:
1. **Số lượng** địch/wave tăng (bảng §2).
2. **Giới hạn cùng lúc** + **nhịp spawn** nhanh hơn.
3. **Cơ cấu địch nặng dần**: gunner nhiều hơn, mở mortar/bomber (S2), shield/heavy/carrier (S3), sniper (S4).
4. **Địch CHỦ ĐỘNG & CHÍNH XÁC tăng theo màn (Z34, `BALANCE.aggro`):** **tỉ lệ chủ động bắn** ramp `0.55 + 0.55×diffScale` (S1 hay ngập ngừng → S5 bắn dồn dập liên tục); **độ chính xác** siết mạnh `spread×(1 − 0.82×diffScale)` + còn tăng theo **NG+ loop** → late-game bắn rất chuẩn; **bắn đón đầu** từ sớm (diffScale > 0.3) và lead mạnh hơn về sau; sát thương `def.dmg×(0.65 + 0.35×diffScale)`. (Vẫn giữ chút lệch nhỏ để né được.)
5. **Boss to & trâu dần** (HP nền 1.300 → 3.600; HP thực = `HP_nền × (1 + (stage−1)×0.18) × 0.9` — **đã giảm ~10-18%** cho dễ thở hơn).

> **Mẹo hạ tướng:** mua **WARHEAD** (Shop·FIREPOWER, +12% sát thương lên boss/cấp, tối đa +60%) + **ENGINE x2** (+10% tốc độ/cấp, tối đa +50% để né) + dùng **DASH** (né + i-frame). Power-up trong trận: BOMB (120 dmg boss), SIEGE ROCKET (360 dmg boss).
6. Giữa màn có **màn chọn nâng cấp roguelite (3 thẻ)** = nhịp nghỉ + thưởng.

> **Lưu ý:** HP của lính thường **KHÔNG** nhân theo stage (cố định theo loại) — độ khó đến từ *số lượng + cơ cấu + độ chính xác + boss*, không phải bơm máu từng con. Tránh cảm giác "bắn mãi không chết".

---

## 3d. Trí tuệ địch theo màn (Z95)
IQ = 0,2 + 0,16·(màn−1) + độ khó (Tân binh −0,15 · Chiến sĩ 0 · Lão luyện +0,18) + 0,12·vòng NG+, tối đa 1.
| Màn | IQ (Chiến sĩ) | Hành vi mở khoá |
|---|---|---|
| 1 | 0,20 | lao thẳng, ngắm đón nhẹ |
| 2 | 0,36 | vu hồi (≈14% đội hình), né khi bị ngắm, rút lui khi máu thấp |
| 3 | 0,52 | nấp sau vật cản, dồn lên khi bạn < 35% máu, vòng vây ~44% vòng tròn |
| 4 | 0,68 | vu hồi ≈27%, vòng vây ~58% |
| 5 | 0,84 | vu hồi ≈34%, vòng vây ~71%, ngắm đón 76% |

## 3e. Trận tướng (Z96)
| Tướng | Giáp trước / đuôi | Bộ phận (máu = % máu tướng) | Pha 2 (≤66%) | Pha 3 (≤33%) | Cách đánh |
|---|---|---|---|---|---|
| IRON BULL | ×0,6 / ×1,8 | mũi húc 10% · xích trái/phải 8% | húc 2 lần liên tiếp + dậm đất, 2 hộ tống | húc 3 lần | dụ húc vào tường/đá → choáng ×2 |
| TEMPEST | ×0,85 / ×1,6 | 2 bệ tên lửa 9% · radar 7% | mưa tên lửa + pháo kích hàng + 2 hộ tống | gọi trực thăng, xoắn đạn dày | phá bệ & radar, thả khói |
| GOLIATH | ×0,35 / ×2,0 | pháo chính 8% · máy rải mìn 7% | **khiên + 3 trụ phát** | toả 16 viên | vòng ra sau lưng |
| REAPER | ×0,85 / ×1,7 | đầu phát laser 8% · lõi dịch chuyển 8% | laser đôi | **khiên + 3 trụ**, laser quét nhanh | nấp sau tường khi nó nạp laser |
| OVERLORD | ×0,6 / ×1,7 | 2 bệ 6% · laser 6% · pháo 6% | **khiên + 3 trụ** | **khiên lần nữa**, mọi đòn nhanh 25% | tổng hợp mọi kỹ năng |

Chuyển pha: bất tử 1,8 s, sóng xung kích bán kính 9 (đẩy 20, 14 sát thương nếu trong vòng), hộ tống 2 / 3 xe. Choáng 3,2 s ×2; xả nhiệt 2,6 s ×1,6 sau mỗi 3 đòn lớn; phá hết trụ → xả nhiệt 4 s. Trụ phát 240 máu (+15%/màn). Pháo kích hàng: 6 phát, cách 4,2, bán kính 4,2, 22 sát thương, phát đầu sau 1,1 s.

## 3a. Pháo kích khoá mục tiêu (ARTILLERY — từ màn 2, Z29)

Khi còn **mortar (spotter)** sống ở **stage ≥ 2**, một "đạo diễn pháo kích" chạy theo nhịp **nghỉ → cảnh báo → dồn dập**:
- **Nghỉ** 7-11s → **banner cảnh báo** "⚠ PHÁO KÍCH — DI CHUYỂN!" (1.6s) → **loạt bắn** `2 + số_mortar` phát (cap 6), mỗi phát cách 0.6s.
- Mỗi phát **khoá vị trí hiện tại của xe** → vòng đỏ nhấp nháy báo trước **~1.05s** → tên lửa **bay vòng cung từ hướng ngẫu nhiên** cắm vào điểm khoá (~0.95s).
- **Sát thương theo khoảng cách:** trúng tâm (≤40% bán kính) = **32** (nặng nhất) · trong bán kính 6.5 = giảm dần xuống **8** (sượt) · ngoài = **0**.
- **Né được:** cửa sổ ~2s, xe ra khỏi bán kính chỉ mất ~0.25s ở tốc tối đa → thử thách là **phản xạ + né loạt khoá liên tiếp** (đứng yên/bị dồn góc = ăn đủ). ⇒ Lý do **ưu tiên diệt mortar** (hết mortar = hết pháo kích).

## 3b. Sự kiện ngẫu nhiên & Elite (bất ngờ)

**Sự kiện wave** (~34% mỗi wave từ S1-W2 trở đi, có banner báo trước):
| Sự kiện | Hiệu ứng |
|---|---|
| ⚠ ELITE WAVE | spawn `1..4` lính **elite** (số tăng theo stage/loop) |
| HORDE | +50% số địch trong wave |
| TREASURE WAVE | **mọi kill đều rơi loot** |
| RELENTLESS ASSAULT | spawn nhanh gấp đôi + cap +4 (sân đông nghẹt) |
| BOMBER BLITZ (S≥2) | cả wave là bomber cảm tử — thử thách né |

**Lính Elite (champion):** ngoài ELITE WAVE còn có **xác suất nền** mỗi spawn = `min(25%, 2.5%×(stage−1) + 6%×loop)` (không áp cho bomber). Elite: **HP ×2.6, to hơn 32%, hào quang vàng**, **+1 💎 + xu ×3** khi hạ, luôn rơi loot. → mục tiêu ưu tiên, phần thưởng béo.

## 3c. Hợp đồng màn chơi (STAGE BRIEFING — Z26)

**Trước mỗi màn** (màn 1 sau intro; màn 2-5 sau thẻ nâng cấp) hiện **briefing**: báo boss/biome + cho **chọn 1 trong 3 hợp đồng** = modifier áp **cả màn đó**. Luôn có **STEADY** (an toàn) + 2 ngẫu nhiên. Mỗi cái là **đánh đổi** (risk/reward), giúp người chơi định hướng farm:

| Hợp đồng | Lợi | Hại | Dùng khi |
|---|---|---|---|
| **STEADY ADVANCE** | +10% xu | — | chơi an toàn |
| **BOUNTY RUN** | +70% xu | địch +20% máu | cày xu mua shop |
| **GLASS CANNON** | +40% sát thương bạn | địch +30% sát thương | tự tin, qua nhanh |
| **ELITE HUNT** | mỗi wave 1 elite + 50% rơi đồ | địch +10% máu | cày elite (💎 + loot) |
| **SCAVENGER** | ×2 rơi đồ | địch +20% sát thương | **cày súng → lên mastery** |
| **WARLORD'S CUT** | boss +2 💎 | địch +15% máu | cày kim cương VIP |

→ Hợp đồng đổi **chiến thuật mỗi lượt** (không còn auto-tiến giống hệt). Chip góc trên giữa nhắc hợp đồng đang chạy. Số liệu ở `config.js · CONTRACTS`.

## 4. Tỉ lệ quà tặng / vật phẩm rơi

**Khi nào rơi đồ (loot ẩn, có đèn hiệu báo trước = beacon → chắc chắn rơi khi phá):**
- **Tường gạch:** 18% viên gạch giấu 1 vật phẩm.
- **Xe địch:** 16% xe mang 1 vật phẩm.

**Mỗi vật phẩm rơi ra cái gì (phân bổ):**
| Tình huống | Kết quả |
|---|---|
| HP người chơi/Core < 40% (60% lúc đó) | Ưu tiên **HỒI MÁU / SỬA CORE / KHIÊN** |
| 6% | **💎 KIM CƯƠNG** (báu vật — tiền VIP) |
| ~39% | **SÚNG** (theo pool mở khoá theo màn, xem dưới) |
| ~55% còn lại | **Power-up** ngẫu nhiên (rapid/power/speed/∞ammo/range/mag/bomb/freeze/drone/troops/armory…) |

> **SUPPORT DRONE (Z37, cân bằng lại Z41):** power-up `drone` triệu hồi 1 gunship bay quanh xe **22s**: 4 rotor xoay + **gatling 6 nòng xoáy** tự khoá địch gần nhất trong **bán kính 26** (bay cách xe **4.8**). **Đây là công cụ HỖ TRỢ, không phải vũ khí chính:** sát thương thấp (**6/viên** → cần ≥6 phát mới hạ 1 lính thường), **nhả đạn chậm** (0.4s), băng **6 viên**, **nạp cực lâu 5s** → DPS bền ≈ **5** (chỉ bào máu / kết liễu địch yếu). Drone có **120 HP** — đạn địch bay trúng sẽ **bắn rơi được** (hiện thanh máu khi trúng), 0 HP → nổ lớn. Số liệu ở `config.js → BALANCE.drone`.

> **MUA & NÂNG CẤP đơn vị hỗ trợ — Shop·SUPPORT (Z38):**
> - **STRIKE DRONE** (1.500 xu mua cấp 1 = **sở hữu drone hộ tống**, tự triển khai **mỗi màn**, bền cả màn thay vì 22s; +12% sát thương/cấp, tối đa 5 cấp). **DRONE: ROTORS** (−10% hồi đạn/cấp) · **DRONE: PLATING** (+40 HP/cấp).
> - **CORE GUARDS** (+1 lính/cấp) · **GUARD: STRIKE** (+22% sát thương/cấp) · **GUARD: DRILL** (−10% hồi đạn/cấp) · **GUARD: ARMOR** (+18 HP/cấp) · **TANK CREW** (+1 lính cưỡi xe).
> - Drone hộ tống bị bắn rơi sẽ **tái triển khai ở màn kế** (hoặc nhặt power-up `drone` để sửa ngay) → cấp ARMOR giúp drone "sống" lâu hơn = nhiều thời gian bắn hơn. Số liệu ở `config.js → BALANCE.support`.

**Súng rơi mở khoá dần theo màn (chỉ rơi súng thường, KHÔNG bao giờ rơi VIP):**
- **Stage 1:** SMG · SHOTGUN · CRYO (súng **khống chế**: dmg thấp 10 nhưng **đóng băng 2.4s/phát** — Z45, địch đứng im hoàn toàn; boss miễn nhiễm)
- **Stage ≥ 2:** + FLAK · CANNON · MINIGUN
- **Stage ≥ 3:** + MISSILE · TESLA · PYRO (**luồng lửa chuyển động** — lửa bay ra như đạn, nguội trắng→đỏ; tầm **20**, đốt cháy **~10s**; Shop 2.200 xu) · **ARC MORTAR** (Shop 3.800 xu)
- **Stage ≥ 4:** + HOWITZER (pháo hạng nặng ngắm con trỏ, nổ-khi-chạm — cũng mua được ở Shop 5.500 xu)
- **RAILGUN · SIEGE ROCKET (VIP):** không rơi — chỉ mua bằng kim cương ở Shop.

> **SIEGE ROCKET (Z55–Z60):** nòng = **ống phóng chĩa lên trời, hơi xéo** (warhead ló ra). **Z59:** dựng lại ống phóng thành **1 khối tròn 3D đặc** — vỏ trụ 32 cạnh (tròn mượt), **lòng ống tối render 2 mặt (DoubleSide) nên nhìn THẤY VÀO trong ống = có chiều sâu thật**, vành miệng (torus), 3 đai gia cố, warhead nằm trong nòng ló mũi ra; cả cụm là 1 group cứng nghiêng 1 lần (hết cảnh hở/dẹt/lệch như cũ). **Z60:** quả tên lửa bay làm **to & dài hơn + ngầu/phát sáng** (đầu đạn phát sáng + chóp trắng-nóng + đai hazard sáng + nozzle + 2 lớp plume lửa nhấp nháy) và kéo theo **vệt lửa cháy phía sau** (hạt lửa nguội trắng→đỏ phụt ngược + khói). **Rơi ĐÚNG vị trí con trỏ chuột** (desktop) — bắn vào ô trống cũng được; mobile thì auto-khoá địch gần nhất. Lốp lên → cầu chì 2s → **nổ xoá vùng bán kính 15** (boss 360 dmg). **Z56:** khi cầm khẩu này có **xem trước đường đạn giả định**; lúc phóng **rung xe mạnh (shake 2.4) + giật lùi ~5.5** + **lửa/khói phụt ngược dưới ống** (backblast). **Z57:** tên lửa **phóng ra ĐÚNG từ miệng ống** (muzzle = miệng nòng) và bay **đúng độ nghiêng của ống (~60° lên trời)** — tốc độ được giải để vẫn rơi trúng đích; preview + đạn thật dùng chung điểm xuất phát & quỹ đạo nên luôn khớp. **Z58:** preview giờ **chỉ là 1 vòng cung chấm đỏ nhỏ & mờ** (26 chấm, tương phản đủ thấy, hơi mờ dần về điểm rơi) — **BỎ vòng tròn/đĩa đỏ bán kính nổ** (vùng nguy hiểm chỉ hiện SAU khi đã bắn ra, lúc đạn đang bay/đếm ngược).

> **PYRO — vòi phun lửa (Z36):** cone lửa **tầm gần (14)** → đốt xe địch **CHÁY (DoT)**. Cháy **lớn dần theo thời gian** (`lvl` creep), **phun liên tục** thì cháy bùng nhanh (`lvl` cap 4) → chết nhanh (~1s); **dính 1 cái nhẹ** thì cháy rĩ rĩ ~7s tự chết (grunt ~4.4s). Xe **vẫn tấn công bình thường khi cháy** (không choáng). DoT = 8×lvl/s. Trâu (heavy 140) cần phun thêm.

> **HOWITZER (Z35, làm lại Z62):** pháo hạng nặng **bắn gián tiếp** — **lốp đạn theo vòng cung VỪA PHẢI (~43°) rồi rơi xuống đúng vị trí con trỏ chuột** (mobile = địch gần nhất), **xuyên qua tường chắn, đánh mục tiêu tầm xa/núp sau cover**. **Z62:** giờ **NGẮM THEO CON TRỎ CHUỘT** (không còn auto-nhắm xe xa nhất), **NỔ NGAY khi chạm đất** (bỏ cầu chì), **bắn liên thanh** (hồi 1.05s, băng 5) + **bay nhanh hơn** (đường đạn phẳng & nhanh, ~1s thay vì ~2s → địch không kịp di chuyển khỏi điểm rơi). Nổ AoE bán kính **6**, dmg 36 (mạnh hơn ARC MORTAR). Nòng = ống pháo to nghiêng vừa (khoá nòng + hãm đầu nòng). Shop 5.500 xu / rơi từ màn 4.

> **ARC MORTAR (Z61, chỉnh Z62):** súng pháo **bắn vòng cung như SIEGE ROCKET** (cùng cách ngắm: desktop = con trỏ chuột / mobile = địch gần nhất; lốp qua tường, đánh tầm xa/núp sau cover) — **nổ NGAY khi chạm đất** + **bắn liên thanh** (băng 6, hồi 0.85s, nạp 3.4s). **Sức mạnh thấp hơn rocket** (dmg 30 + AoE bán kính 5, KHÔNG xoá sổ vùng). **Z62:** nòng dựng lại thành **ống mảnh & dài hơn, tinh tế**, **nghiêng VỪA PHẢI (~43°, không quá thẳng đứng)** → đường đạn **phẳng & nhanh hơn (~1s)**, giảm delay để địch không né kịp. Shop 3.800 xu / rơi từ màn 3.

**GUN MASTERY — nhặt trùng = lên cấp súng (Z25):** nhặt 1 khẩu **đã sở hữu** = **+1 xp** cho khẩu đó (không phí). Ngưỡng `xp=[0,12,27,45]` → **cấp 1→2→3→4** (cần 12/15/18 dup mỗi cấp, vĩnh viễn, lưu `PROFILE.gunXp`). Mỗi cấp trên 1: **+10% sát thương · +6% nhịp bắn · −8% thời gian nạp** ⇒ **LV4 = +30% dmg / +22% rate / −24% reload**. Áp live trong trận. Xem cấp ở: chip vũ khí ("SMG ·L4"), lưới shop ("★ LV n/4"), panel detail (★ MASTERY + chỉ số đã buff). VIP (railgun/rocket) không rơi nên không lên cấp qua nhặt.

**Kiếm tiền (tích luỹ vĩnh viễn, xem chi tiết economy):**
- **Xu (coins):** ≈ `điểm gốc địch / 10` mỗi kill (grunt 10 … shield 24) + boss `150+90×stage` + clear màn `60×stage`. ~2.000 xu / lượt tới màn 3.
- **Kim cương:** **+2 / boss** + 6% loot rơi gem. ~4–6 viên / lượt tới màn 3, ~14 / clear hết.

---

## 4b. Vật phẩm động cơ & giáp — luật cộng dồn (Z93)
| Vật phẩm | Hiệu ứng | Thời lượng | Nhặt lại khi đang có |
|---|---|---|---|
| ĐỘNG CƠ VƯỢT TẢI | tốc tối đa & lực kéo ×1,3 | 22 s | gia hạn +11 s, tối đa 33 s |
| TURBO TĂNG ÁP | gia tốc +35%/cấp, bù 60% độ ì khởi động/cấp | 20 s | lên cấp (tối đa 2) + làm mới 20 s |
| LƯỠI ỦI | húc gây ×2,2 · chịu húc ×0,35 · khối lượng ×1,8 · phá tường ở 7,7 u/s · leo đá ở 10 u/s | 20 s | gia hạn +10 s, tối đa 30 s |
| GIÁP PHẢN ỨNG | +3 tấm; phát ≥ 8 sát thương mất 1 tấm, chặn 60% | tới khi dùng hết/mất mạng | cộng tấm, tối đa 6 |
| Buff vĩnh viễn (NÒNG DÀI, BĂNG ĐẠN LỚN) | — | tới khi mất mạng | đã có → +120 xu × (1 + 0,2·màn) |

Trần tốc độ: OVERDRIVE (kỹ năng ×1,3) × ĐỘNG CƠ (×1,3) × shop ENGINE (tới ×1,5) = ×2,5 → **cắt ở ×1,7**.
Nguồn rơi: tỉ lệ = 16% × min(2,4; 0,5 + máu gốc/60) — lính trinh sát 16 máu ≈ 10%, xe nặng 140 máu ≈ 38%. Máu gốc ≥ 70 → 55% đồ HIẾM; ≥ 130 hoặc elite → 50% đồ QUÝ (55% súng · 25% bom chùm · 20% kim cương). Tháp → hiếm; trại → 1 quý + 1 hiếm; kho tiếp tế (2/2/3/3/3 theo màn, 70 máu) → 2 món.

## 5. Tóm tắt phần thưởng theo màn

| Stage | Địch/màn | Boss HP | Súng mở khoá rơi | 💎 từ boss |
|---|---|---|---|---|
| 1 | ~30 | 1.300 | SMG · SHOTGUN · CRYO | +2 |
| 2 | ~35 | 1.700 | +FLAK · CANNON · MINIGUN | +2 |
| 3 | ~45 | 2.400 | +MISSILE · TESLA | +2 |
| 4 | ~50 | 2.600 | (như S3) | +2 |
| 5 | ~60 | 3.600 | (như S3) | +2 |

> Tỉ lệ rơi (18%/16%/6%/39%) là **cố định mọi màn**; chỉ *chất lượng súng* rơi tăng theo màn. Đồ VIP/đỉnh phải đổi bằng kim cương ở Shop (chủ ý: cày nhiều ngày mới đủ).

---

**Last updated:** 2026-06-02 · khớp code tới **Z42** (9 loại địch, 14 súng, hợp đồng, pháo kích, mastery, drone gunship gatling **(đã hạ về hỗ-trợ)**, mua+nâng cấp drone & lính canh ở Shop·SUPPORT, PYRO vòi lửa vòng cung tầm xa, 6 địa hình chọn được + scatter trang trí, đạn phát sáng + tracer theo súng, xe tăng player uy lực hơn, khiên năng lượng hex cao cấp — *Z42–44 thuần hình ảnh*; **CRYO đóng băng 1.4→2.4s — Z45**; **PYRO luồng cột lửa liền mạch — Z46**; **bảng màu đạn 12 khẩu khác nhau — Z47**; **dialog chọn địa hình 3D hoành tráng — Z48**; **PYRO luồng lửa chuyển động — Z49**; **thoát ván về Home từ Pause/Game-over — Z50**; **onboarding HOW TO PLAY — Z52**; **SETTINGS + 3 độ khó — Z53**; **SIEGE ROCKET rơi đúng con trỏ chuột — Z55**; **SIEGE ROCKET xem trước đường đạn + rung xe/giật lùi + lửa phụt ngược — Z56**; **SIEGE ROCKET phóng đúng từ miệng ống + đúng độ nghiêng; BOMBER chạm xe là nổ ngay + 34 dmg — Z57**; **SIEGE ROCKET preview gọn lại còn 1 vòng cung chấm đỏ nhỏ & mờ, bỏ vòng tròn bán kính nổ — Z58**; **ống phóng SIEGE ROCKET dựng lại thành khối tròn 3D đặc, lòng ống có chiều sâu thật — Z59**; **quả tên lửa SIEGE ROCKET to/dài/phát sáng hơn + vệt lửa cháy phía sau — Z60**; **súng mới ARC MORTAR: lốp vòng cung như rocket nhưng nổ-khi-chạm + liên thanh + sức mạnh thấp hơn — Z61**; **HOWITZER làm lại = ngắm con trỏ + nổ-khi-chạm + liên thanh + bay nhanh; cả 2 pháo dùng vòng cung VỪA PHẢI ~43° nhanh hơn (giảm delay); ống ARC MORTAR mảnh-dài-tinh tế — Z62**). Số liệu là **tunable** — từ Z24 mọi con số cân bằng nằm trong **`config.js` (`BALANCE`)**; đổi balance thì sửa ở đó **và** cập nhật file này (chạy `node test.js` để kiểm tra nhất quán).

## 6. HỌC THUYẾT VŨ KHÍ (Z75) — sức mạnh, tầm, nạp đạn, băng đạn có công thức

> Số liệu nằm ở `index.html` (`GUNS`) + `config.js` (`DMG_TYPE`, `ARMOR`, `RAMP`, `ENV`, `GIFT`). `node test.js` kiểm tra các bất biến (AP mạnh nhất vs giáp nặng, KIN yếu vs giáp nặng, HESH phá công trình tốt nhất, đêm giảm tầm nhưng railgun miễn trừ…).

**Sát thương cuối** = `dmg × DMG_TYPE[loại][giáp] × falloff(tầm) × ENV(loại) × (shop · thông thạo · roguelite · buff · hợp đồng)`
- **falloff**: 100% trong 55% tầm của súng, rồi giảm tuyến tính còn `fall` ở cuối tầm.
- **tầm (reach)** = `(26 + 3·(màn−1)) × LONG BARREL × buff RANGE × gun.rng × (đêm ? 0.85 : 1) × (đồng trống & súng lớn ? 1.1 : 1)`.
- **Máu địch** = `def.hp × (1 + 0.14·(màn−1)) × NG+ × độ khó × hợp đồng` → màn 5 dày hơn ×1.56 để sức mạnh súng tăng dần vẫn còn thử thách.

### Bảng loại sát thương × lớp giáp
| Loại | Nhẹ (scout·bomber·gunner) | Vừa (grunt·mortar·sniper·carrier) | Nặng (shield·heavy·boss) | Công trình | Ghi chú |
|---|---|---|---|---|---|
| KIN (động năng) | 1.15 | 1.00 | **0.55** | 0.6 | băm xe nhẹ, dội ra trên giáp dày |
| AP (xuyên giáp) | 0.85 | 1.10 | **1.45** | 1.2 | sinh ra để diệt tăng |
| HE (nổ) | 1.20 | 1.00 | 0.85 | 1.5 | đám đông + công trình |
| FRAG (mảnh) | **1.35** | 0.95 | 0.55 | 0.7 | tầm gần vs mục tiêu mềm |
| FIRE (lửa) | 1.30 | 1.00 | 0.75 | 0.3 (tháp gỗ ×1.6) | DoT cháy lan |
| CRYO (băng) | 1.00 | 1.00 | 0.85 | 0.5 | đóng băng (giáp nặng chỉ ½ thời gian) |
| ELEC (điện) | 1.00 | 1.10 | 1.00 | 0.4 | sét lan 3 mục tiêu |
| HESH | 1.00 | **1.25** | 1.05 | **3.0** | phá chướng ngại & tháp canh |

### Chỉ số súng sau cân bằng
DPS duy trì = `dmg·frags·mag / (mag·fireCd + reload)`; cột L/M/H = DPS duy trì nhân hệ số giáp.

| Súng | Loại | Sát thương | Nhịp (s) | Băng | Nạp (s) | DPS bùng | DPS duy trì | vs L / M / H | Tầm | Còn ở cuối tầm | |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rifle | KIN | 14 | 0.2 | 24 | 1.9 | 70 | 50 | 58 / 50 / 28 | ×1 | 0.7 | |
| smg | KIN | 8 | 0.07 | 50 | 2.4 | 114 | 68 | 78 / 68 / 37 | ×0.8 | 0.5 | |
| shotgun | FRAG | 9×8 | 0.6 | 6 | 2.4 | 120 | 72 | 97 / 68 / 40 | ×0.6 | 0.25 | |
| flak | HE | 10×5 | 0.55 | 10 | 2.8 | 91 | 60 | 72 / 60 / 51 | ×0.9 | 0.75 | |
| cannon | AP | 60 | 0.9 | 5 | 3.2 | 67 | 39 | 33 / 43 / 56 | ×1.2 | 1 | |
| hesh | HESH | 44 | 0.8 | 6 | 3 | 55 | 34 | 34 / 42 / 36 | ×1.05 | 0.9 | |
| minigun | KIN | 9 | 0.05 | 100 | 4.2 | 180 | 98 | 113 / 98 / 54 | ×0.9 | 0.6 | |
| missile | HE | 34 | 0.55 | 8 | 3.2 | 62 | 36 | 43 / 36 / 30 | ×1.3 | 1 | |
| railgun | AP | 95 | 0.9 | 5 | 3.4 | 106 | 60 | 51 / 66 / 87 | ×1.5 | 1 | |
| cryo | CRYO | 11 | 0.3 | 18 | 2.6 | 37 | 25 | 25 / 25 / 21 | ×0.85 | 0.8 | |
| tesla | ELEC | 22 | 0.38 | 14 | 2.8 | 58 | 38 | 38 / 42 / 38 | ×0.8 | 0.8 | |
| rocket | HE | 0 | 5 | 10 | 30 | — | — | — | — | — | gián tiếp (rocket) |
| arty | HE | 40 | 1.05 | 5 | 3.6 | — | — | — | — | — | gián tiếp (mortar) |
| mortar | HE | 30 | 0.85 | 6 | 3.4 | — | — | — | — | — | gián tiếp (mortar) |
| flamer | FIRE | 1 | 0.05 | 140 | 3.2 | — | — | — | — | — | gián tiếp (flame) |

Vai trò: **RIFLE** đa năng · **SMG** cận chiến xe nhẹ · **SHOTGUN** canister cực mạnh ≤ 10 m · **FLAK** đám đông · **CANNON** diệt tăng (+xuyên 1) · **HESH (mới)** phá chướng ngại/tháp canh, nứt giáp vừa · **MINIGUN** phải **quay lên tốc** (~0.7 s) rồi xả 180 DPS · **MISSILE** tự dẫn, bất chấp đêm · **RAILGUN** VIP diệt tăng xuyên 6 · **CRYO/TESLA** khống chế · **cối/lựu pháo/SIEGE** gián tiếp vượt tường.

### Súng mới (Z81)

| Súng | Loại | Sát thương | Nhịp | Băng / nạp | Đặc tính |
|---|---|---|---|---|---|
| **AGL-40** | HE | 16 (nổ lan 2.9) | 0.26s | 16 / 3.0s | Lựu vòng cung vào con trỏ, liên thanh. Khắc chế bộ binh và xe nhẹ đứng cụm. Không trúng trực thăng. Giá 2.600 xu, rơi từ màn 2. |
| **THERMOBARIC** | TBX | 70 trực tiếp, 56 lan (bán kính 6.5) + đốt cháy | 1.6s | 3 / 4.4s | Tên lửa nhiệt áp: phá công sự/tháp (×1.8/×2.2), yếu với giáp nặng (×0.7). Giá 5.400 xu, rơi từ màn 4. |

### Điều kiện chiến trường (`ENV`) — báo trên màn chuyển
| Điều kiện | Khi nào | Hiệu ứng |
|---|---|---|
| NIGHT | giờ đêm | tầm −15% (railgun nhờ ống nhiệt, missile nhờ khoá mục tiêu: miễn), địch ngắm kém ×1.3 |
| HEAT | DESERT/FOUNDRY hoặc trưa | lửa +25%, đóng băng −30% |
| FROST | TUNDRA | đóng băng +50%, cryo +20%, lửa −25% |
| URBAN | RUINS/CITADEL | HE +20% |
| OPEN | MEADOW/DESERT ban ngày | CANNON/RAILGUN/HESH tầm +10% |

### Thuật toán tặng súng (`GIFT`)
1. Mỗi vật phẩm rơi: 6% kim cương; cơ hội ra súng = `min(0.85, 0.30 + 0.12 × số lần rơi liên tiếp không ra súng)` (**pity timer**).
2. Súng được chọn theo trọng số: `1 + 1.6 × Σ_lớp (tỉ lệ địch lớp đó trên sân + hàng chờ) × max(0, hệ số−1) × 2`, × **1.6 nếu chưa có trong kho** → đợt nhiều xe nặng thường cho AP/HESH, đợt bầy xe nhẹ cho FRAG/KIN/HE.
3. Súng trùng vẫn cộng THÔNG THẠO (cấp 1→4: +10% sát thương, −6% nhịp, −8% nạp mỗi cấp).

### Quỹ đạo đạn
- **Súng bắn thẳng** (mọi súng trừ cối/lựu pháo/SIEGE/PYRO): quỹ đạo **phẳng** như đạn xuyên giáp tốc độ cao, chỉ chúc nhẹ về độ cao thân xe; trúng/không trúng tính theo **hộp thân xe thật** (OBB), không còn vòng tròn nhỏ.
- **Đạn hạng nặng bắn cầu vồng** (góc nòng cố định θ): `v² = g·D² / (2·cos²θ·(D·tanθ + y_nòng − y_đích))`, thời gian bay `T = D/(v·cosθ)`, với `y_đích` = độ cao mặt đất thật tại điểm ngắm; nổ tại **điểm chạm đất thật** (mô đất chắn giữa đường sẽ hứng đạn). Mobile bắn đón: `đích = vị trí + vận tốc·T` (lặp 2 lần). Đo kiểm: sai số điểm rơi 0.3–1.0 đơn vị (≈ quãng bay 1 khung hình), nằm trong bán kính nổ 5–6.
