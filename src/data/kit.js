// data/kit.js — Z161 WORKSHOP + CREW data: per-tank upgrade tracks, each tank's signature module, crew seats, traits and recruits (pure data)

// ---- WORKSHOP: four tracks every tank can improve (3 levels each); the numbers are per level ----
export const KIT_TRACKS = [
  { key:'armor',  icon:'shield', vi:'GIÁP',            per:'+8% máu',                     fx:{ hp:0.08 } },
  { key:'engine', icon:'bolt',   vi:'ĐỘNG CƠ',         per:'+5% tốc độ · +6% bứt tốc',    fx:{ spd:0.05, acc:0.06 } },
  { key:'fcs',    icon:'target', vi:'ĐIỀU KHIỂN BẮN',  per:'+5% sát thương · +5% nạp đạn', fx:{ dmg:0.05, reload:0.05 } },
  { key:'susp',   icon:'gear',   vi:'HỆ THỐNG TREO',   per:'+6% xoay xe · −8% hồi lướt',   fx:{ turn:0.06, dashCd:-0.08 } },
];
export const KIT_MAX = 3;            // levels per track
export const KIT_SIG_NEED = 2;       // every track at ≥ this level unlocks the signature module
// price of a level: L1/L2 in coins scaled to the tank's value, L3 in diamonds
export const KIT_COST = { base:320, perCoin:0.22, perDia:40, l2:2.4, dia0:6, diaPer:420 };
export function kitPrice(tankPrice, L){ if(L>=KIT_MAX) return null; const p=tankPrice, val = !p ? 0 : (p.c||0) + (p.d||0)*KIT_COST.perDia*10, B=Math.round((KIT_COST.base + val*KIT_COST.perCoin)/50)*50;   // Z162 one formula for the game and the server
  return L===0 ? { c:B } : L===1 ? { c:Math.round(B*KIT_COST.l2/50)*50 } : { d:KIT_COST.dia0 + Math.floor(B/KIT_COST.diaPer) }; }

// ---- SIGNATURE MODULES: what makes each machine itself (bought with diamonds once every track is at level 2) ----
//   fx keys are multipliers/additions (see tank/kit.js applyTankKit); flags: era (reactive tiles at every stage start), shtora (chance a guided
//   missile loses you), trophy (APS cooldown, s), capsule (survive one lethal hit per stage)
export const KIT_SIG = {
  lqt:      { vi:'GIÁP PHẢN ỨNG TÁI NẠP',   d:10, desc:'Mỗi màn xe ra trận với 4 tấm giáp phản ứng nổ, mỗi tấm nuốt 60% một đòn lớn.', fx:{ era:4 } },
  t90m:     { vi:'SHTORA-1',                d:10, desc:'Đèn gây nhiễu hồng ngoại: một nửa số tên lửa dẫn đường bắn vào xe mất dấu và bay lạc.', fx:{ shtora:0.5 } },
  ghost:    { vi:'VỎ TÀNG HÌNH',            d:12, desc:'Khó khoá mục tiêu: +10% tốc độ, +10% tỉ lệ chí mạng khi đánh úp.', fx:{ spd:0.10, crit:0.10 } },
  leo2a7:   { vi:'NÒNG L55A1',              d:12, desc:'Nòng dài hơn, đạn đầu ra nhanh hơn: +15% tầm bắn, +10% sát thương.', fx:{ range:0.15, dmg:0.10 } },
  leclerc:  { vi:'NẠP ĐẠN TỰ ĐỘNG',         d:12, desc:'Băng nạp đạn cơ khí: nạp nhanh hơn 20%, băng đạn lớn hơn 20%.', fx:{ reload:0.20, mag:0.20 } },
  abrams:   { vi:'TUA-BIN AGT-1500',        d:12, desc:'Tua-bin khí bứt tốc như xe đua: hồi lướt nhanh hơn 30%, bứt tốc +10%.', fx:{ dashCd:-0.30, acc:0.10 } },
  type99:   { vi:'LASER LÀM LOÁ',           d:14, desc:'Laser làm mù kính ngắm địch rồi nã 125 ly: +15% sát thương lên tướng, +5% chí mạng.', fx:{ boss:0.15, crit:0.05 } },
  k2:       { vi:'TREO THUỶ KHÍ',           d:14, desc:'Thân xe nghiêng theo địa hình, bắn khi đang chạy vẫn chuẩn: +12% xoay xe, +10% tốc độ bắn.', fx:{ turn:0.12, fire:0.10 } },
  ch3:      { vi:'GIÁP EPSILON',            d:14, desc:'Lớp giáp composite mới nhất: giảm thêm 8% mọi sát thương nhận vào.', fx:{ armor:0.08 } },
  merkava:  { vi:'TROPHY APS',              d:16, desc:'Hệ thống bảo vệ chủ động: tự bắn hạ một tên lửa lao vào xe, hồi 8 giây.', fx:{ trophy:8 } },
  t14:      { vi:'KHOANG KÍP BỌC THÉP',     d:16, desc:'Kíp xe ngồi trong khoang bọc thép riêng: mỗi màn sống sót qua một đòn chí mạng với 1 máu.', fx:{ capsule:1 } },
  colossus: { vi:'ỦI THÉP',                 d:16, desc:'Lưỡi ủi 110 tấn: húc mạnh hơn 60%, chịu sát thương khi húc ít hơn 30%.', fx:{ ramDeal:0.60, ramTake:-0.30 } },
};

// ---- CREW: four seats; each crewman levels 1..10 from battle experience ----
export const CREW_SEATS = [
  { key:'cmd', vi:'TRƯỞNG XE', icon:'star',   per:'+4 máu · +3% kinh nghiệm cả kíp / cấp', fx:{ hpFlat:4, xp:0.03 },
    l5:{ vi:'QUAN SÁT',  desc:'+10% tầm bắn',        fx:{ range:0.10 } }, l10:{ vi:'LÃNH ĐẠO',     desc:'giảm 5% sát thương nhận', fx:{ armor:0.05 } } },
  { key:'gun', vi:'PHÁO THỦ',  icon:'target', per:'+1,5% sát thương / cấp',              fx:{ dmg:0.015 },
    l5:{ vi:'THIỆN XẠ',  desc:'+5% chí mạng',         fx:{ crit:0.05 } },  l10:{ vi:'XUYÊN GIÁP',   desc:'+10% sát thương lên tướng', fx:{ boss:0.10 } } },
  { key:'drv', vi:'LÁI XE',    icon:'bolt',   per:'+1,2% tốc độ · +1,5% xoay xe / cấp',  fx:{ spd:0.012, turn:0.015 },
    l5:{ vi:'TAY LÁI LỤA', desc:'hồi lướt nhanh hơn 15%', fx:{ dashCd:-0.15 } }, l10:{ vi:'ĐUA ĐỊA HÌNH', desc:'+8% bứt tốc', fx:{ acc:0.08 } } },
  { key:'ldr', vi:'NẠP ĐẠN',   icon:'shell',  per:'+1,5% tốc độ nạp / cấp',              fx:{ reload:0.015 },
    l5:{ vi:'NHANH TAY', desc:'+10% băng đạn',        fx:{ mag:0.10 } },   l10:{ vi:'NẠP NÓNG',     desc:'nạp nhanh thêm 10%', fx:{ reload:0.10 } } },
];
export const CREW_TRAITS = {
  eagle:     { vi:'MẮT ĐẠI BÀNG', desc:'+4% chí mạng',                  fx:{ crit:0.04 } },
  steady:    { vi:'BÌNH TĨNH',    desc:'+5% tốc độ nạp',                fx:{ reload:0.05 } },
  daredevil: { vi:'LIỀU MẠNG',    desc:'+7% sát thương, −3% giáp',      fx:{ dmg:0.07, armor:-0.03 } },
  mechanic:  { vi:'THỢ MÁY',      desc:'+12 máu',                       fx:{ hpFlat:12 } },
  racer:     { vi:'TAY ĐUA',      desc:'+5% tốc độ',                    fx:{ spd:0.05 } },
  veteran:   { vi:'CỰU BINH',     desc:'+25% kinh nghiệm cho cả kíp',    fx:{ xp:0.25 } },
  tough:     { vi:'GAN LÌ',       desc:'giảm 3% sát thương nhận',        fx:{ armor:0.03 } },
  quick:     { vi:'NHANH TAY',    desc:'+8% băng đạn',                  fx:{ mag:0.08 } },
  hunter:    { vi:'SĂN TƯỚNG',    desc:'+8% sát thương lên tướng',       fx:{ boss:0.08 } },
};
// the four you start with + volunteers you can recruit (lvl = level they join at)
export const CREW_RECRUITS = [
  { id:'d_cmd', seat:'cmd', name:'Trần Văn Hùng',    lvl:1, trait:null,        price:null },
  { id:'d_gun', seat:'gun', name:'Lê Quốc Bảo',      lvl:1, trait:null,        price:null },
  { id:'d_drv', seat:'drv', name:'Phạm Đức Minh',    lvl:1, trait:null,        price:null },
  { id:'d_ldr', seat:'ldr', name:'Đỗ Thành Tâm',     lvl:1, trait:null,        price:null },
  { id:'r_lan', seat:'gun', name:'Nguyễn Thị Lan',   lvl:2, trait:'eagle',     price:{ c:2200 } },
  { id:'r_son', seat:'drv', name:'Vũ Hoàng Sơn',     lvl:2, trait:'racer',     price:{ c:2000 } },
  { id:'r_khoa',seat:'ldr', name:'Bùi Anh Khoa',     lvl:2, trait:'steady',    price:{ c:1800 } },
  { id:'r_tuan',seat:'cmd', name:'Hoàng Minh Tuấn',  lvl:3, trait:'veteran',   price:{ c:4200 } },
  { id:'r_dung',seat:'gun', name:'Đặng Tiến Dũng',   lvl:4, trait:'hunter',    price:{ d:14 } },
  { id:'r_hai', seat:'drv', name:'Mai Văn Hải',      lvl:3, trait:'mechanic',  price:{ c:3600 } },
  { id:'r_thu', seat:'ldr', name:'Trịnh Hoài Thu',   lvl:4, trait:'quick',     price:{ d:12 } },
  { id:'r_long',seat:'cmd', name:'Lý Thanh Long',    lvl:5, trait:'tough',     price:{ d:20 } },
  { id:'r_nam', seat:'gun', name:'Cao Hữu Nam',      lvl:3, trait:'daredevil', price:{ c:3800 } },
];
export const CREW_XP = { max:10, base:120, step:70, stage:60, kill:2, boss:80, lossMul:0.5 };   // need(L→L+1)=base+step·(L−1)
