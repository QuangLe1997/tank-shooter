# STEEL SIEGE — Bảng Màn chơi · Độ khó · Phần thưởng

> Tham chiếu **số liệu thực tế đang chạy trong `index.html`** (đồng bộ tới **Z36**). Khác với `GAME_DESIGN.md` (mô tả ý tưởng gốc v1), file này ghi đúng con số code dùng để cân bằng. Cập nhật khi đổi balance.

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

---

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
| **BOMBER** | **đỏ** | 22 | ❌ (cảm tử) | Kamikaze: KHÔNG bắn — **lao thẳng vào xe** rồi **tự nổ** (bán kính 4.5, 32 sát thương). Mở từ màn 2. Từ Z32 có **hào quang đỏ + tia lửa + vòng cảnh báo** quanh nó → né kịp. |
| **HEAVY** (Z33) | xám sắt | 140 | ✅ đạn nặng | **Bruiser**: máu trâu nhất, chậm, bắn **đạn to chậm sát thương cao (22) + đẩy lùi mạnh**. 2 nòng to + giáp hông. Mở từ màn 3. |
| **SNIPER** (Z33) | tím-than | 34 | ✅ bắn tỉa | **Marksman**: tầm xa nhất (52), **chính xác cao + đạn nhanh (đỏ)**, bắn chậm. Nòng dài + ống ngắm phát sáng tím. Mở từ màn 4. |
| **CARRIER** (Z33) | vàng-olive | 96 + 3×26 | ❌ (chở lính) | **APC chở 3 lính** bắn súng trường trên thùng xe. **Hạ vỏ xe HOẶC hạ hết 3 lính → xe gục** (bắn vào vừa bào vỏ vừa tỉa lính). Mở từ màn 3. |

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

> **SUPPORT DRONE (Z37):** power-up `drone` triệu hồi 1 gunship bay quanh xe **22s**: 4 rotor xoay + **gatling 6 nòng xoáy** tự khoá địch gần nhất trong **bán kính 26** (bay cách xe **4.8**), xả băng **10 viên @ 0.11s** (≈11 dmg/viên) rồi **nạp 1.2s** → DPS bền ≈ **48**. Drone có **120 HP** — đạn địch bay trúng sẽ **bắn rơi được** (hiện thanh máu khi trúng), 0 HP → nổ lớn. Số liệu ở `config.js → BALANCE.drone`.

> **MUA & NÂNG CẤP đơn vị hỗ trợ — Shop·SUPPORT (Z38):**
> - **STRIKE DRONE** (1.500 xu mua cấp 1 = **sở hữu drone hộ tống**, tự triển khai **mỗi màn**, bền cả màn thay vì 22s; +12% sát thương/cấp, tối đa 5 cấp). **DRONE: ROTORS** (−10% hồi đạn/cấp) · **DRONE: PLATING** (+40 HP/cấp).
> - **CORE GUARDS** (+1 lính/cấp) · **GUARD: STRIKE** (+22% sát thương/cấp) · **GUARD: DRILL** (−10% hồi đạn/cấp) · **GUARD: ARMOR** (+18 HP/cấp) · **TANK CREW** (+1 lính cưỡi xe).
> - Drone hộ tống bị bắn rơi sẽ **tái triển khai ở màn kế** (hoặc nhặt power-up `drone` để sửa ngay) → cấp ARMOR giúp drone "sống" lâu hơn = nhiều thời gian bắn hơn. Số liệu ở `config.js → BALANCE.support`.

**Súng rơi mở khoá dần theo màn (chỉ rơi súng thường, KHÔNG bao giờ rơi VIP):**
- **Stage 1:** SMG · SHOTGUN · CRYO
- **Stage ≥ 2:** + FLAK · CANNON · MINIGUN
- **Stage ≥ 3:** + MISSILE · TESLA · PYRO (vòi lửa vòng cung — tia dày, tầm **20**, đốt cháy **~10s**; Shop 2.200 xu)
- **Stage ≥ 4:** + HOWITZER (pháo cầu vồng — cũng mua được ở Shop 5.500 xu)
- **RAILGUN · SIEGE ROCKET (VIP):** không rơi — chỉ mua bằng kim cương ở Shop.

> **PYRO — vòi phun lửa (Z36):** cone lửa **tầm gần (14)** → đốt xe địch **CHÁY (DoT)**. Cháy **lớn dần theo thời gian** (`lvl` creep), **phun liên tục** thì cháy bùng nhanh (`lvl` cap 4) → chết nhanh (~1s); **dính 1 cái nhẹ** thì cháy rĩ rĩ ~7s tự chết (grunt ~4.4s). Xe **vẫn tấn công bình thường khi cháy** (không choáng). DoT = 8×lvl/s. Trâu (heavy 140) cần phun thêm.

> **HOWITZER (Z35):** súng **bắn gián tiếp** — tự nhắm xe địch xa nhất, **lốp đạn lên trời theo vòng cung cao (~9.6) rồi rơi thẳng xuống** → **xuyên qua tường chắn, đánh mục tiêu núp sau cover**. Nổ AoE bán kính 5.2 sát thương vừa (không xoá sổ như SIEGE ROCKET VIP). Nòng chĩa lên + ống ngắm.

**GUN MASTERY — nhặt trùng = lên cấp súng (Z25):** nhặt 1 khẩu **đã sở hữu** = **+1 xp** cho khẩu đó (không phí). Ngưỡng `xp=[0,12,27,45]` → **cấp 1→2→3→4** (cần 12/15/18 dup mỗi cấp, vĩnh viễn, lưu `PROFILE.gunXp`). Mỗi cấp trên 1: **+10% sát thương · +6% nhịp bắn · −8% thời gian nạp** ⇒ **LV4 = +30% dmg / +22% rate / −24% reload**. Áp live trong trận. Xem cấp ở: chip vũ khí ("SMG ·L4"), lưới shop ("★ LV n/4"), panel detail (★ MASTERY + chỉ số đã buff). VIP (railgun/rocket) không rơi nên không lên cấp qua nhặt.

**Kiếm tiền (tích luỹ vĩnh viễn, xem chi tiết economy):**
- **Xu (coins):** ≈ `điểm gốc địch / 10` mỗi kill (grunt 10 … shield 24) + boss `150+90×stage` + clear màn `60×stage`. ~2.000 xu / lượt tới màn 3.
- **Kim cương:** **+2 / boss** + 6% loot rơi gem. ~4–6 viên / lượt tới màn 3, ~14 / clear hết.

---

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

**Last updated:** 2026-06-02 · khớp code tới **Z39** (9 loại địch, 13 súng, hợp đồng, pháo kích, mastery, drone gunship gatling, mua+nâng cấp drone & lính canh ở Shop·SUPPORT, **PYRO vòi lửa vòng cung tầm xa**). Số liệu là **tunable** — từ Z24 mọi con số cân bằng nằm trong **`config.js` (`BALANCE`)**; đổi balance thì sửa ở đó **và** cập nhật file này (chạy `node test.js` để kiểm tra nhất quán).
