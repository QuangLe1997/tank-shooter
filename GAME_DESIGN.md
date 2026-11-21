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

## 15. Kịch bản tác chiến của người lính (chế độ lính · Z350–Z353)

**Ý tưởng chính:** người lính bắt đầu trận là một **binh nhì** có hai đồng đội và một khẩu súng trường, và kết thúc màn bằng một **trận đấu tay đôi với viên tướng địch**. Ở giữa, mỗi tên địch bị hạ vừa là kinh nghiệm, vừa có thể là một khẩu súng nằm trên đất. Mỗi lần thăng cấp là một lần chọn sức mạnh. Một số quân hàm tự mang tới viện binh.

### 15.1 Một màn chơi, từ đầu đến cuối
1. **Xuất kích:** quân hàm Binh nhì, máu 150. Có súng trường 7.62 và B41. Tổ có xạ thủ máy và y tá, mỗi người có tên riêng (Hùng, Lan, Dũng…).
2. **Đợt 1–2:** bộ binh và xe trinh sát tràn tới. Hạ địch thì thanh vàng mảnh dưới thanh máu đầy dần. Lính địch đôi khi đánh rơi súng trường, lính RPG hay đánh rơi B41. Nhặt khẩu đã có thì súng **lên ★**.
3. **Thăng cấp:** trận dừng lại, hiện 3 thẻ (bấm phím 1/2/3 hoặc chạm để chọn). Đa số là thẻ chỉ số. Thỉnh thoảng có một thẻ **VIỆN BINH** dùng ngay, hiếm hơn là thẻ **+1 MẠNG**.
4. **Lên Hạ sĩ:** bộ chỉ huy bổ sung một **lính B40 chống tăng**, đúng lúc xe tăng địch đầu tiên tới.
5. **Lên Thượng sĩ:** bộ chỉ huy **thả dù tiếp tế** ngay trước mặt: một súng mới, một hộp cứu thương, một thùng đạn.
6. **Đồng đội ngã:** người đó được đưa về tuyến sau, đầu đợt tới quay lại tổ. Y tá băng bó cho anh và cho đồng đội bị thương ở gần.
7. **Tướng xuất hiện:** đánh siêu xe tăng của tướng. Xe bốc cháy thì **tướng nhảy ra** cùng 3 cận vệ. Trận đấu tay đôi trên mặt đất quyết định màn.
8. **Hạ tướng:** cận vệ bỏ chạy, tướng rơi hai khẩu súng tốt nhất và một huy chương. Qua màn thì chọn thêm 1 trong 3 thẻ của người lính.

### 15.2 Cấp bậc (Z350 · `game/soldier-rank.js`)
- **13 quân hàm:** Binh nhì → Binh nhất → Hạ sĩ → Trung sĩ → Thượng sĩ → Thiếu úy → Trung úy → Thượng úy → Đại úy → Thiếu tá → Trung tá → Thượng tá → Đại tá. Phù hiệu (vạch, gạch, sao) và tên quân hàm hiện ngay trên thanh máu của lính.
- **Kinh nghiệm theo con mồi:**

  | Mục tiêu | Kinh nghiệm |
  |---|---|
  | Lính súng trường | 10 |
  | Lính RPG | 16 |
  | Xe trinh sát | 28 |
  | Xe chở quân | 40 |
  | Trực thăng | 45 |
  | Xe tăng | 80 |
  | Xe tăng hạng nặng | 120 |
  | Xe của tướng | 260 |
  | Tướng | 420 |
  | Tinh nhuệ / cận vệ | ×2 |

  Đồng đội hay không kích hạ địch cũng được tính.
- **Mỗi lần thăng cấp:** +8 máu tối đa, hồi 30% máu, và được chọn 1 trong 3 thẻ. Bảng chọn chỉ mở khi an toàn: không lúc đang chết, không lúc đang qua màn. Lên được quân hàm cuối rồi thì mỗi lần đủ kinh nghiệm là một **HUÂN CHƯƠNG**, tức thêm một lần chọn.
- **Thẻ chỉ số (cộng dồn theo cấp):**

  | Thẻ | Hiệu quả | Cấp tối đa |
  |---|---|---|
  | THÂN THÉP | +25 máu | V |
  | XẠ THỦ | +15% sát thương | V |
  | TAY NHANH | bắn nhanh hơn 12% | IV |
  | THAY BĂNG NHANH | nạp đạn nhanh hơn 20% | III |
  | BĂNG ĐẠN LỚN | +25% băng đạn | III |
  | MẮT ƯNG | +8% chí mạng | IV |
  | CHÂN CHẠY | nhanh hơn 10% | III |
  | ÁO CHỐNG ĐẠN | nhận ít hơn 10% sát thương | IV |
  | KHÁT MÁU | +4 máu mỗi mạng hạ | III |
  | CHIẾN THUẬT | hồi kỹ năng nhanh hơn 18% | III |
  | LÍNH NÉM LỰU | lựu đạn +35% sát thương và nổ rộng hơn | III |
  | CỨU THƯƠNG GIỎI | băng bó và y tá hồi mạnh hơn | II |
  | CHỈ HUY | đồng đội +25% máu và sát thương | III |
  | THÊM ĐỒNG ĐỘI | +1 người vào tổ | IV |
  | +1 MẠNG | thêm một lần đứng dậy (hiếm) | II |

- **Thẻ viện binh (dùng ngay):**
  - **XE TĂNG YỂM TRỢ:** một xe tăng ta tới đánh cạnh anh.
  - **LÍNH DÙ:** trực thăng thả một tiểu đội lính dù xuống cạnh anh.
  - **PHÁO KÍCH:** không kích vào cụm địch đông nhất trong bán kính 9–48 m.
  - **THẢ DÙ TIẾP TẾ:** súng mới, cứu thương và thùng đạn rơi cạnh anh.
- **Quân hàm tự mang phần thưởng (qua bộ đàm):**

  | Quân hàm | Phần thưởng |
  |---|---|
  | Hạ sĩ | lính B40 vào tổ |
  | Thượng sĩ | thả dù tiếp tế |
  | Thiếu úy | thêm một xạ thủ máy |
  | Thượng úy | một xe tăng ta |
  | Thiếu tá | một tiểu đội lính dù (xe tăng ta tới từ đây là xe hạng nặng) |
  | Đại tá | pháo kích hai loạt liền |

### 15.3 Tổ đồng đội (Z351 · `actors/squad-mates.js`)
- **Mở đầu có 2 người:** xạ thủ máy và y tá (đeo túi trắng chữ thập đỏ). Tổ tối đa 6 người, thêm vào theo thứ tự lính B40, xạ thủ, xạ thủ máy, y tá…
- **Đồng đội mạnh lên cùng anh:** máu +12% và sát thương +10% mỗi quân hàm. Mỗi cấp thẻ CHỈ HUY thêm 25%.
- **Y tá:**
  - Anh dưới 72% máu và đứng trong vòng 12 m thì y tá băng bó, hồi 20 máu cộng 2,5 máu mỗi quân hàm. Hồi chiêu 9 giây.
  - Không có anh để chữa thì y tá chữa đồng đội dưới 50% máu, hồi 45% máu.
- **Người ngã xuống** được đưa về tuyến sau và đầu đợt sau quay lại. Bộ đàm báo "Tổ của anh đã được bổ sung N người".
- Lệnh GỌI TỔ BỘ BINH vẫn gọi được cả một tổ hoả lực thêm vào.

### 15.4 Súng của địch, sao súng, vật phẩm (Z352 · `loot/soldier-arms.js`)
- **Tỉ lệ rơi súng khi hạ địch:**

  | Địch | Rơi gì | Tỉ lệ |
  |---|---|---|
  | Lính súng trường | súng trường | 5% |
  | Lính RPG | B41 | 20% |
  | Xe | một khẩu tay mà anh chưa có | 28% |
  | Tướng | 2 khẩu nặng nhất anh chưa có, kèm huy chương | luôn rơi |

- **Sao súng:** nhặt lại khẩu đã có thì súng lên một sao (tối đa ★5). Mỗi sao thêm +18% sát thương và bắn nhanh hơn 6%. Số sao hiện trên ô súng.
- **Vật phẩm riêng của lính:**
  - **HUY CHƯƠNG:** 45 kinh nghiệm, nhiều hơn ở các màn sau.
  - **THÙNG ĐẠN:** đầy đạn mọi súng, kỹ năng sẵn sàng ngay.
  - Ngoài ra vẫn có máu, khiên, bắn nhanh… như trước.

### 15.5 Tướng bộ chiến (Z353 · `campaign/general-duel.js`)
- **Pha 1 — xe của tướng:** siêu xe tăng như trước.
- **Pha 2 — tướng nhảy ra:**
  - Thanh máu đổi thành "TÊN TƯỚNG · BỘ CHIẾN". Tướng to hơn lính thường, trên đầu có sao vàng, dưới chân có vòng đỏ nhịp.
  - Tướng giữ khoảng cách và núp như lính thường, nhưng súng nặng hơn.
  - Mỗi phát trúng chỉ trừ tối đa 6% máu tướng, nên không thể hạ bằng một quả lựu đạn.
- **Hai đòn có báo trước:**
  - **Quạt đạn:** chớp đỏ ở nòng và dấu "!" trên đầu trong 0,75 giây, rồi 9 viên quạt ngang chỗ anh đứng. Cách tránh: lăn hoặc nằm xuống.
  - **Chùm lựu đạn:** 3 vòng đỏ siết dần quanh chỗ anh đứng, nổ sau khoảng 1,35 giây. Cách tránh: chạy ra khỏi vòng.
- **Dưới 50% máu:** tướng gọi thêm 4 cận vệ.
- **Dưới 30% máu:** tướng **LIỀU MẠNG**, bắn nhanh hơn 40%, chạy nhanh hơn 30%, các đòn ra dày hơn.
- **Hạ tướng:** chiếu chậm, cận vệ bỏ chạy, rơi súng hay nhất cùng huy chương. Sau đó mới tính qua màn: thưởng xu và kim cương, thành địch thất thủ, mở màn kế, chọn thẻ.

### 15.6 Hướng mở rộng (chưa làm)
- Ra lệnh cho tổ: bắn tập trung vào mục tiêu đang ngắm, giữ vị trí, xung phong.
- Gắn phụ kiện cho súng: ống ngắm, giảm thanh, báng gấp.
- Mỗi tướng có tính cách riêng khi bộ chiến, ví dụ tướng HOẢ THẦN cầm súng phun lửa.
- Giải cứu tù binh để họ gia nhập tổ.
- Bảng huân chương giữ lại giữa các lượt chơi.
