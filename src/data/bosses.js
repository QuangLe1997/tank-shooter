// data/bosses.js — BOSS (Z96 rework)

// ----------------------------- BOSS (Z96 rework) -----------------------------
// Every general is a puzzle with its own answer: ARMOUR ARCS (rear hits ×1.6, some fronts nearly immune), BREAKABLE SYSTEMS that switch
// attacks off, THREE PHASES with a shockwave + escort squad between them, a STUN window when a charge slams into cover, an OVERHEAT window
// after every third big attack, SHIELD PYLONS that must be razed, a LASER that walls block, and a walking ARTILLERY line.
export const BOSS_DEFS = [
  { id:'bull',     name:'BÒ THÉP',  hp:1300, scale:3.0, front:0.6, rear:1.8, pal:{hull:0x2e1512,turret:0x3a1a15,barrel:0x2a2420,tread:0x140a08,accent:0xff4a14},
    parts:[ {id:'plow',  vi:'MŨI HÚC',   at:[0,0.35,2.35], r:1.0, hp:0.1, fx:'Đòn húc yếu đi một nửa'},
            {id:'trackL',vi:'XÍCH TRÁI', at:[-1.45,0.15,0.4], r:0.85, hp:0.08, fx:'Chậm hơn'}, {id:'trackR',vi:'XÍCH PHẢI', at:[1.45,0.15,0.4], r:0.85, hp:0.08, fx:'Chậm hơn'} ],
    phases:['CƠN GIẬN BÒ THÉP','HÚC ĐIÊN CUỒNG','ĐÒN CUỐI'], shield:[] ,
    taunt:['Mày nghĩ trốn sau tường là thoát à?','Tao sẽ nghiền nát cái Lõi đó!'] },
  { id:'tempest',  name:'CUỒNG PHONG',    hp:1700, scale:3.0, front:0.85, rear:1.6, pal:{hull:0x141c28,turret:0x1b2636,barrel:0x232c38,tread:0x0a0e14,accent:0x38d6ff},
    parts:[ {id:'podL',vi:'BỆ TÊN LỬA TRÁI',at:[-1.05,1.35,0.1], r:0.75, hp:0.09, fx:'Ít tên lửa hơn'}, {id:'podR',vi:'BỆ TÊN LỬA PHẢI',at:[1.05,1.35,0.1], r:0.75, hp:0.09, fx:'Ít tên lửa hơn'},
            {id:'radar',vi:'RADAR DẪN ĐƯỜNG',at:[0,1.9,-0.7], r:0.6, hp:0.07, fx:'Tên lửa mất dẫn đường'} ],
    phases:['MƯA TÊN LỬA','BÃO XOÁY','TẬN DIỆT'], shield:[] ,
    taunt:['Radar của tao thấy mày rồi.','Không chỗ nào trên bầu trời này là an toàn!'] },
  { id:'goliath',  name:'KHỔNG LỒ',    hp:2400, scale:3.8, front:0.35, rear:2.0, pal:{hull:0x24262b,turret:0x2c2f35,barrel:0x3a3d44,tread:0x101114,accent:0xcfe0ff},
    parts:[ {id:'gun',vi:'PHÁO CHÍNH',at:[0,1.05,2.9], r:0.75, hp:0.08, fx:'Hết bắn toả'}, {id:'mines',vi:'MÁY RẢI MÌN',at:[0,0.6,-2.35], r:0.8, hp:0.07, fx:'Hết rải mìn'} ],
    phases:['PHÁO ĐÀI DI ĐỘNG','LÁ CHẮN THÉP','PHÁO ĐÀI SỤP ĐỔ'], shield:[1],
    taunt:['Giáp của tao dày hơn tường thành.','Bắn nữa đi — tao còn chưa thấy nhột.'] },
  { id:'reaper',   name:'TỬ THẦN',     hp:2600, scale:3.0, front:0.85, rear:1.7, pal:{hull:0x130e19,turret:0x1b1424,barrel:0x261d33,tread:0x0a070e,accent:0xb070ff},
    parts:[ {id:'emitter',vi:'ĐẦU PHÁT LASER',at:[0,1.55,1.4], r:0.7, hp:0.08, fx:'Hết laser'}, {id:'drive',vi:'LÕI DỊCH CHUYỂN',at:[0,0.9,-1.9], r:0.75, hp:0.08, fx:'Hết dịch chuyển'} ],
    phases:['BÓNG MA','LƯỠI HÁI ĐÔI','LIỀM TỬ THẦN'], shield:[2],
    taunt:['Mày không thấy tao, nhưng tao thấy mày.','Tường gạch không cứu được mày mãi đâu.'] },
  { id:'overlord', name:'BẠO CHÚA',   hp:3600, scale:3.8, front:0.6, rear:1.7, pal:{hull:0x17130e,turret:0x201a12,barrel:0x2a2318,tread:0x0c0a07,accent:0xffb84a},
    parts:[ {id:'podL',vi:'BỆ TÊN LỬA TRÁI',at:[-1.2,1.4,0], r:0.8, hp:0.06, fx:'Ít tên lửa hơn'}, {id:'podR',vi:'BỆ TÊN LỬA PHẢI',at:[1.2,1.4,0], r:0.8, hp:0.06, fx:'Ít tên lửa hơn'},
            {id:'emitter',vi:'ĐẦU PHÁT LASER',at:[0,1.7,1.3], r:0.7, hp:0.06, fx:'Hết laser'}, {id:'gun',vi:'PHÁO CHÍNH',at:[0,1.1,3.0], r:0.75, hp:0.06, fx:'Hết bắn toả'} ],
    phases:['KẺ THỐNG TRỊ','PHÁO ĐÀI KHIÊN','TRẬN CUỐI CÙNG'], shield:[1,2],
    taunt:['Cả đất nước mày sẽ quỳ dưới xích tao.','Ngươi đã đi xa lắm rồi, chỉ huy. Đây là điểm dừng.'] },
];

// ----------------------------- Z161 THREE NEW GENERALS — they take over stages 1 / 3 / 4 on every odd NG+ loop (levels 6, 8, 9 …) -----------------------------
export const BOSS_NEW = [
  { id:'inferno',  name:'HOẢ THẦN',  hp:2000, scale:3.0, front:0.75, rear:1.9, pal:{hull:0x1c120c,turret:0x24170f,barrel:0x2c221c,tread:0x0e0906,accent:0xff8a1a},
    parts:[ {id:'launcher',vi:'DÀN ROCKET NHIỆT ÁP',at:[0,1.5,0.2], r:0.9, hp:0.09, fx:'Hết mưa rocket nhiệt áp'},
            {id:'fuelL',vi:'THÙNG NHIÊN LIỆU TRÁI',at:[-0.9,0.6,-2.0], r:0.7, hp:0.06, fx:'Lửa tắt nhanh hơn'}, {id:'fuelR',vi:'THÙNG NHIÊN LIỆU PHẢI',at:[0.9,0.6,-2.0], r:0.7, hp:0.06, fx:'Lửa tắt nhanh hơn'} ],
    phases:['BIỂN LỬA','HOẢ NGỤC','THIÊU RỤI'], shield:[],
    intro:'HOẢ THẦN tới — xe phóng rocket nhiệt áp. Đừng đứng trong vùng lửa, bắn nổ hai thùng nhiên liệu sau lưng nó!',
    taunt:['Đất này sẽ thành biển lửa.','Chạy đi, chỉ huy. Lửa của tao nhanh hơn.'] },
  { id:'serpent',  name:'MÃNG XÀ',   hp:2800, scale:3.1, front:0.5, rear:1.7, pal:{hull:0x0f1812,turret:0x142018,barrel:0x1e2c24,tread:0x080d0a,accent:0x6dff7a},
    parts:[ {id:'joint',vi:'KHỚP NỐI',at:[0,0.5,-2.1], r:0.8, hp:0.08, fx:'Thân sau tê liệt — chậm hẳn, hết cối'},
            {id:'mortar',vi:'DÀN SÚNG CỐI',at:[0,1.3,-3.8], r:0.85, hp:0.08, fx:'Hết pháo cối'} ],
    phases:['QUẤN SIẾT','NỌC ĐỘC','CÚ ĐỚP CUỐI'], shield:[1],
    intro:'MÃNG XÀ — siêu tăng hai thân khớp nối, thân sau mang dàn cối. Bắn gãy khớp nối, thân sau sẽ tê liệt!',
    taunt:['Một khúc gãy, khúc kia vẫn cắn.','Mày bị quấn chặt rồi.'] },
  { id:'thunder',  name:'LÔI THẦN',  hp:3000, scale:3.1, front:0.8, rear:1.6, pal:{hull:0x13141a,turret:0x1a1c24,barrel:0x262a34,tread:0x09090c,accent:0xfff04a},
    parts:[ {id:'rail',vi:'PHÁO ĐIỆN TỪ',at:[0,1.1,3.2], r:0.75, hp:0.08, fx:'Hết bắn pháo điện từ'},
            {id:'capL',vi:'DÀN TỤ ĐIỆN TRÁI',at:[-1.2,1.3,-0.3], r:0.7, hp:0.06, fx:'Nạp chậm hơn'}, {id:'capR',vi:'DÀN TỤ ĐIỆN PHẢI',at:[1.2,1.3,-0.3], r:0.7, hp:0.06, fx:'Nạp chậm hơn'} ],
    phases:['TÍCH ĐIỆN','SẤM RỀN','THIÊN LÔI'], shield:[2],
    intro:'LÔI THẦN — pháo điện từ bắn xuyên cả bản đồ. Thấy vạch ngắm đỏ thì né ngang ngay! Phá dàn tụ điện để nó nạp chậm lại.',
    taunt:['Một phát. Chỉ cần một phát.','Sấm sét không báo trước đâu.'] },
];
export const BOSS_ALT = { 1:'inferno', 3:'serpent', 4:'thunder' };   // stage → the general who replaces the original on odd loops
