# STEEL SIEGE — Bảng Màn chơi · Độ khó · Phần thưởng

> Tham chiếu **số liệu thực tế đang chạy trong `index.html`** (tính tới Z22). Khác với `GAME_DESIGN.md` (mô tả ý tưởng), file này ghi đúng con số code dùng để cân bằng. Cập nhật khi đổi balance.

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

---

## 3. Đường cong độ khó

`diffScale = min(1, (stage−1)/4)` → **0 ở Stage 1, đạt tối đa 1.0 ở Stage 5**. Độ khó tăng từ:
1. **Số lượng** địch/wave tăng (bảng §2).
2. **Giới hạn cùng lúc** + **nhịp spawn** nhanh hơn.
3. **Cơ cấu địch nặng dần**: gunner nhiều hơn, mở mortar/bomber (S2), shield (S3).
4. **Địch bắn chính xác & mạnh hơn**: sát thương đạn `def.dmg×(0.65 + 0.35×diffScale)`; bắn đón đầu chỉ bật từ giữa game, vẫn giữ độ lệch để né được.
5. **Boss to & trâu dần** (HP nền 1.300 → 3.600; HP thực = `HP_nền × (1 + (stage−1)×0.18) × 0.9` — **đã giảm ~10-18%** cho dễ thở hơn).

> **Mẹo hạ tướng:** mua **WARHEAD** (Shop·FIREPOWER, +12% sát thương lên boss/cấp, tối đa +60%) + **ENGINE x2** (+10% tốc độ/cấp, tối đa +50% để né) + dùng **DASH** (né + i-frame). Power-up trong trận: BOMB (120 dmg boss), SIEGE ROCKET (360 dmg boss).
6. Giữa màn có **màn chọn nâng cấp roguelite (3 thẻ)** = nhịp nghỉ + thưởng.

> **Lưu ý:** HP của lính thường **KHÔNG** nhân theo stage (cố định theo loại) — độ khó đến từ *số lượng + cơ cấu + độ chính xác + boss*, không phải bơm máu từng con. Tránh cảm giác "bắn mãi không chết".

---

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

**Súng rơi mở khoá dần theo màn (chỉ rơi súng thường, KHÔNG bao giờ rơi VIP):**
- **Stage 1:** SMG · SHOTGUN · CRYO
- **Stage ≥ 2:** + FLAK · CANNON · MINIGUN
- **Stage ≥ 3:** + MISSILE · TESLA
- **RAILGUN · SIEGE ROCKET (VIP):** không rơi — chỉ mua bằng kim cương ở Shop.

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

**Last updated:** 2026-06-01 · khớp code Z22. Số liệu là **tunable** — đổi balance thì cập nhật file này.
