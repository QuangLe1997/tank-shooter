# TANK SHOOTER — Kịch bản game chi tiết: "THIẾT GIÁP CHIẾN" (Steel Siege)

> ⚠️ **ĐÂY LÀ KỊCH BẢN GỐC v1 (2026-05-31) — TẦM NHÌN BAN ĐẦU, KHÔNG PHẢI TRẠNG THÁI HIỆN TẠI.** Game đã **mở rộng vượt xa** spec này (Z14→Z36): kinh tế xu/💎 + shop 3D + 11 nâng cấp, gun mastery, hợp đồng màn chơi, NG+ vô hạn, pháo kích khoá mục tiêu, **9 loại địch** (thêm heavy/sniper/carrier-chở-lính), **13 súng** (thêm howitzer/pyro…), cinematic chết, phản ứng trúng đòn. Mục §4 (vũ khí)/§7 (địch)/§9 (điểm) ở dưới chỉ phản ánh v1.
> 👉 **Trạng thái HIỆN HÀNH:** hệ thống & bản đồ code ở **[`DOCS.md`](DOCS.md)** (§0 + bảng "Lớp nội dung Z14→Z36" + §14 lịch sử); số liệu màn/địch/súng/balance ở **[`LEVELS.md`](LEVELS.md)**; con số tunable ở **[`config.js`](config.js)**.
>
> Kịch bản gameplay (tầm nhìn). `DOCS.md` = tài liệu kỹ thuật/triển khai; file này = thiết kế chơi gốc. Phần nào chưa rõ → tự chọn phương án tối ưu (theo `CLAUDE.md`).

## 0. Tóm tắt 1 dòng
Game bắn xe tăng **3D twin-stick arena** lai DNA *Battle City* (bảo vệ căn cứ, phá tường, power-up) + *twin-stick hiện đại* (né/dash, ngắm 360°) + *roguelite* (chọn nâng cấp giữa màn) + **boss đa pha cuối mỗi màn**. 5 màn (biome riêng), khó tăng dần, kích thích & căng thẳng cân bằng.

---

## 1. Nghiên cứu nền (rút gọn)
- **Battle City (NES):** diệt đủ số địch/đợt; địch có nhiều **tier HP** (1–4 phát); **bảo vệ căn cứ** (vỡ = thua); power-up: ⭐ nâng súng (bắn nhanh→2 đạn→xuyên thép), 💣 bom dọn màn, ⏱ đóng băng địch, 🛡 bất tử, 🔧 gia cố căn cứ, 🚙 thêm mạng; terrain: gạch (phá được), thép (cần mạnh), bụi (ẩn), nước (chặn), băng (trượt); địch biết **đánh lạc hướng** để phá căn cứ. → Lấy: căn cứ, tier HP, power-up, terrain.
- **Roguelite twin-stick:** nâng cấp giữa lượt tạo cảm giác tiến bộ; **cẩn thận cân bằng** (đừng để đầu quá khó, cuối quá dễ). → Lấy: chọn 1/3 nâng cấp sau mỗi màn; scale địch theo nâng cấp.
- **Boss design:** **telegraph** mọi đòn (cue hình/âm trước khi đánh); **đa pha** tăng dần; **đường cong căng→nghỉ**; pattern đoán được → thưởng kỹ năng, tránh cảm giác "ngẫu nhiên/bất công". → Lấy: boss 2–4 pha, telegraph rõ, có nhịp nghỉ.

Nguồn: [Battle City – StrategyWiki](https://strategywiki.org/wiki/Battle_City/Gameplay) · [Boss Battle Design – Game Developer](https://www.gamedeveloper.com/design/boss-battle-design-and-structure) · [Roguelite progression – Steam discussion](https://steamcommunity.com/app/1315610/discussions/0/4814903332727851503/).

---

## 2. Vòng lặp chơi (core loop)
1. **Title → Chọn xe/phép khởi đầu → Vào Màn 1.**
2. Mỗi **Màn (Stage)** = `N` **Đợt (Wave)** + **Boss**.
3. Trong đợt: địch spawn từ rìa, vừa tấn công **người chơi** vừa lao vào **CĂN CỨ (Core)**. Diệt sạch đợt → đợt sau (khó hơn).
4. Sau đợt cuối → **BOSS** (đa pha, telegraph).
5. Hạ boss → **Màn chọn nâng cấp** (3 thẻ roguelite) → **Stage kế** (biome mới, khó hơn).
6. Hạ **Overlord (Stage 5)** → **CHIẾN THẮNG** → mở **New Game+** (vòng lặp khó tăng vĩnh viễn, giữ nâng cấp).

**Thua khi:** hết mạng **HOẶC** Core bị phá. → tạo 2 trục căng thẳng (vừa công vừa thủ).

---

## 3. Người chơi (Player Tank)
- **Bộ phận:** thân (di chuyển), **nòng/tháp pháo** (ngắm 360° độc lập), xích.
- **Máu:** `HP` (mặc định 100) + **Armor regen** nhẹ sau ~3s không trúng đòn. **Mạng (Lives)** = 3.
- **Chết:** HP=0 → nổ tung (tháp pháo văng, cháy, shake mạnh) → trừ 1 mạng → hồi sinh tại chỗ + **bất tử ~2s**; hết mạng → GAME OVER.
- **Dash (lướt):** Space/Shift (desktop) / nút (mobile) — lướt nhanh + **i-frame ~0.3s**, cooldown ~1.5s (nâng cấp giảm cd/thêm charge). Là kỹ năng né cốt lõi.
- **Di chuyển:** mượt, có quán tính nhẹ; trên **băng** trượt hơn (DNA Battle City).

### Điều khiển
| | Desktop | Mobile |
|---|---|---|
| Di chuyển thân | WASD / mũi tên | Joystick trái |
| Ngắm nòng | Chuột (vị trí con trỏ) | Joystick phải (twin-stick) |
| Bắn | Giữ LMB | Kéo joystick phải = tự bắn (+ auto-aim assist nhẹ) hoặc nút 🔥 |
| Phép | RMB / E | Nút Phép |
| Dash | Space / Shift | Nút Dash |
| Đổi vũ khí | 1 / 2 / 3 / cuộn chuột | Nút vũ khí |
| Pause | Esc / P | Nút ⏸ |

> Mobile có **auto-aim assist** (hút nhẹ về địch gần hướng ngắm) để "không quá khó chơi" — vẫn cho phép ngắm tay.

---

## 4. Vũ khí (Weapons) — đổi/nâng qua roguelite & power-up ⭐
| # | Tên | Đặc tính | Vai trò |
|---|---|---|---|
| 1 | **CANNON** (mặc định) | đạn thẳng, nổ nhỏ, cân bằng | all-round |
| 2 | **AUTOCANNON** | liên thanh, dmg thấp, spread nhẹ | DPS bầy |
| 3 | **SHOTGUN** | chùm 5–7 viên, tầm gần mạnh | cận chiến/né-vào-mặt |
| 4 | **RAILGUN** | **sạc** rồi bắn **xuyên**, dmg cao | xuyên hàng/giáp |
| 5 | **MISSILE** | đạn **dò mục tiêu**, nổ AoE | truy đuổi scout/drone |
| 6 | **FLAK** | đạn nổ **AoE rộng** | chống bầy/đám đông |

- Nâng cấp ⭐ (như Battle City): cấp 1 bắn nhanh hơn → cấp 2 +1 viên/đa nòng → cấp 3 **xuyên thép/tường**.

---

## 5. Phép / Bùa (Spells — active, cooldown) 🪄
Mang 1 phép; đổi/khoá thêm qua nâng cấp. Cooldown 8–18s tùy phép.
| Phép | Hiệu ứng |
|---|---|
| **OVERDRIVE** ⚡ | +tốc độ & +nhịp bắn 5s |
| **AEGIS** 🛡 | khiên **bất tử 3s** |
| **EMP** 🌀 | nổ điện AoE: **choáng** địch 2s + dmg |
| **NANO REPAIR** ❤️ | hồi máu tức thì (và +Core nếu đứng gần) |
| **AIRSTRIKE** 🎯 | gọi bom rải khu vực (telegraph bóng → nổ) |
| **TIME WARP** ⏳ | làm **chậm địch** 4s (player giữ tốc) |

---

## 6. Nâng cấp Passive (roguelite — chọn 1/3 sau mỗi màn)
+Max HP · +Damage · +Fire rate · +Move speed · Dash (−cd / +charge) · **Lifesteal** · **Ricochet** (đạn nảy) · **Crit** (x2 ngẫu nhiên) · **Pierce** · **Explosive rounds** · −Spell cd · **Coin magnet** · **Thorns** (phản dmg khi bị đâm) · **+1 Mạng** · **Gia cố Core** (+Core HP & tự hồi).
> Cân bằng: mỗi nâng cấp ~+8–15%; địch cũng scale theo stage để không "quá dễ về sau".

---

## 7. Địch (Enemies)
| Loại | Hành vi | Tier HP | Telegraph |
|---|---|---|---|
| **GRUNT** | tank cơ bản, bắn chậm | 1 | nhá nòng |
| **SCOUT** | nhanh, **lao đâm** (ram) | 1 | tăng tốc + vệt |
| **GUNNER** | liên thanh tầm trung | 2 | nhá liên hồi |
| **MORTAR** | đứng xa, **lốp đạn vòng cung** | 2 | **bóng đỏ** điểm rơi |
| **SHIELD** | giáp trước, **phải vòng sau** | 3 | khiên loé khi chặn |
| **TURRET** | mọc từ đất, cố định, dmg cao | 3 | vạch ngắm laser |
| **BOMBER** | lao vào **tự nổ** | 1 | **nhấp nháy đỏ** + bíp |
| **DRONE** (stage ≥3) | bay, nhỏ, bắn tia | 1 | nhá tia |
- Địch **đánh lạc hướng** lao Core khi player ở xa (DNA Battle City) → buộc người chơi xoay xở.
- Rơi **coin**; tỉ lệ nhỏ rơi **power-up** (⭐/💣/⏱/🛡/❤️/🔧).

---

## 8. Boss (cuối mỗi màn — đa pha, telegraph)
| Stage | Boss | Pha & Pattern |
|---|---|---|
| 1 | **MÃNH NGƯU** (Iron Bull) | P1: húc thẳng (rung + vạch hướng) + quạt đạn 3 hướng. P2 (<50% HP): húc nhanh hơn + rải đạn vòng. |
| 2 | **PHONG BÃO** (Tempest) | P1: nòng xoay bắn vòng ốc. P2: salvo **tên lửa dò**. P3: triệu **Scout** + bão đạn. |
| 3 | **CỰ THẦN** (Goliath) | Pháo đài **nhiều nòng** — phá lần lượt từng nòng; rải **mìn**; đạp sàn (shockwave telegraph). 3 pha. |
| 4 | **TỬ THẦN** (Reaper) | Nhanh, **quét laser** (telegraph line), **dịch chuyển**, triệu **Drone**. 3 pha. |
| 5 | **BÁ VƯƠNG** (Overlord) | Tổng hợp mọi pattern + **pha cuồng nộ** (bullet-hell nhẹ). 4 pha. Có **nhịp nghỉ** giữa pha. |
- Thanh máu boss + tên hiện trên đỉnh; chuyển pha có **cảnh báo** + đổi nhạc.

---

## 9. Tính điểm & Phần thưởng
- **Diệt địch:** `base × tier × comboMult`.
- **Combo:** diệt liên tiếp trong **~3s** → mult tăng (mỗi 2 kill +1), tối đa **x8**; hết giờ reset. Hiển thị to giữa màn hình (kích thích).
- **Bonus:** clear wave (+), **no-hit wave** (++), boss kill (+++), nhặt coin.
- **Coin:** rơi từ địch → ví; **meta lưu:** best score, tổng coin, stage cao nhất, boss đã hạ.
- **Hiển thị "+điểm" bay lên** tại vị trí diệt (juice).

---

## 10. Đường cong khó (kích thích ↔ ức chế — cân bằng)
- **Trong wave:** ramp số lượng + thêm loại địch.
- **Trong stage:** mỗi đợt khó hơn; boss scale theo stage.
- **Giữa stage:** màn **chọn nâng cấp** = nhịp nghỉ + thưởng (giảm ức chế).
- **Comeback:** khi HP/Core thấp → **tăng tỉ lệ rơi ❤️/🛡/🔧** (cứu vớt, đỡ nản).
- **Công bằng:** mọi mối nguy **telegraph**; dash có i-frame → "thua là tại mình". Không spawn đè đầu người chơi.
- **Cảm giác mạnh dần:** nâng cấp + vũ khí xịn hơn theo thời gian, nhưng địch cũng nguy hiểm hơn → giữ thử thách.

---

## 11. Màn chơi / Biome (5 stage)
| Stage | Biome | Sắc thái | Đặc trưng |
|---|---|---|---|
| 1 | **SA MẠC** | nắng vàng, cát | dạy cơ bản, ít vật cản |
| 2 | **ĐÔ THỊ ĐỔ NÁT** | bê tông, khói xám | nhiều tường gạch (phá được), góc khuất |
| 3 | **BĂNG GIÁ** | trắng-lam, lạnh | **mặt băng trơn** (trượt), drone xuất hiện |
| 4 | **CÔNG XƯỞNG** | kim loại, neon đỏ | khối thép, băng chuyền/đèn, turret nhiều |
| 5 | **THÀNH TRÌ** | tối, hùng vĩ, vàng-đỏ | tổng lực, Overlord |
- Mỗi biome đổi **nền/fog/ánh sáng/obstacle + nhạc**; có **terrain**: gạch (phá), thép (cần railgun/explosive/⭐3), bụi (ẩn), nước/hố (chặn), băng (trượt).

---

## 12. UI / UX (mobile + desktop)
- **HUD:** thanh **HP + Armor**, **Mạng**, **Core HP**, icon **Phép + cooldown**, icon **Vũ khí + đạn/charge**, **Wave/Stage**, **Score + Combo mult**, **minimap/chỉ hướng** địch & boss & Core.
- **Màn hình:** Title · Stage Intro (tên màn) · **Upgrade Pick (3 thẻ)** · Boss Intro (tên + thanh máu) · Pause · Game Over (điểm/màn/coin + Chơi lại) · Victory.
- **Mobile:** twin-stick + nút Phép + nút Dash; HUD co gọn; `viewport-fit=cover` + safe-area; auto-aim assist.
- **Mượt:** fixed-tick + interpolation; particle pool; tự giảm chất lượng nếu FPS thấp.

---

## 13. Tech & Juice (xem chi tiết ở DOCS.md)
- Three.js (CDN, zero-build), 1 file. Tank/đạn/địch dựng từ primitive + vật liệu PBR.
- **Juice:** muzzle flash, tracer, **nổ** (particle + flash sáng + shockwave + khói), debris, tread marks, **screen shake**, bloom (vừa), hit flash, damage numbers, camera follow + lookahead theo nòng, **slow-mo nhẹ** khi hạ boss.
- **Âm thanh:** synth (bắn/nổ/trúng/nhặt/báo động) + **nhạc nền có nhịp** theo biome, dồn dập khi boss.

---

## 14. Lộ trình implement (mỗi phase 1 commit)
1. **Engine lõi:** scene/render/camera/lights/arena + player tank (move + aim + dash) + input desktop & mobile twin-stick.
2. **Bắn & va chạm:** đạn (pool), Cannon, collision, hit flash, damage numbers.
3. **Địch + Wave:** 3–4 loại đầu, AI, spawner theo đợt, Core + bảo vệ Core, score + combo, chết người chơi.
4. **Juice & Audio:** nổ/particle/shake/bloom + sfx + nhạc nền.
5. **Vũ khí & Phép:** đủ 6 vũ khí + 6 phép + power-up rơi.
6. **Boss S1 + khung boss đa pha** + Boss Intro + slow-mo.
7. **Stage/Biome + chuyển màn + Upgrade Pick (roguelite)** + đủ loại địch còn lại.
8. **Boss S2–S5** + Victory + New Game+.
9. **HUD/Menu hoàn chỉnh + mobile polish + cân bằng số liệu** (playtest qua Playwright cả mobile/desktop).
10. **Pass cân bằng & tối ưu FPS cuối.**

> **Last updated:** 2026-05-31 · kịch bản **v1 gốc** (đã implement xong + mở rộng vượt xa — xem banner đầu file; trạng thái hiện tại ở `DOCS.md`/`LEVELS.md`, tới Z36).
