// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.

// ----------------------------- BOSS (Z96 rework) -----------------------------
// Every general is a puzzle with its own answer: ARMOUR ARCS (rear hits ×1.6, some fronts nearly immune), BREAKABLE SYSTEMS that switch
// attacks off, THREE PHASES with a shockwave + escort squad between them, a STUN window when a charge slams into cover, an OVERHEAT window
// after every third big attack, SHIELD PYLONS that must be razed, a LASER that walls block, and a walking ARTILLERY line.
export const BOSS_DEFS = [
  { id:'bull',     name:'IRON BULL',  hp:1300, scale:3.0, front:0.6, rear:1.8, pal:{hull:0x5a2a22,turret:0x6a3028,barrel:0x7a3a30,tread:0x2a1410,accent:0xff5028},
    parts:[ {id:'plow',  vi:'MŨI HÚC',   at:[0,0.35,2.35], r:1.0, hp:0.1, fx:'Đòn húc yếu đi một nửa'},
            {id:'trackL',vi:'XÍCH TRÁI', at:[-1.45,0.15,0.4], r:0.85, hp:0.08, fx:'Chậm hơn'}, {id:'trackR',vi:'XÍCH PHẢI', at:[1.45,0.15,0.4], r:0.85, hp:0.08, fx:'Chậm hơn'} ],
    phases:['CƠN GIẬN BÒ THÉP','HÚC ĐIÊN CUỒNG','ĐÒN CUỐI'], shield:[] ,
    taunt:['Mày nghĩ trốn sau tường là thoát à?','Tao sẽ nghiền nát cái Lõi đó!'] },
  { id:'tempest',  name:'TEMPEST',    hp:1700, scale:3.0, front:0.85, rear:1.6, pal:{hull:0x243a52,turret:0x2c4762,barrel:0x365a7a,tread:0x101c2a,accent:0x4fd1ff},
    parts:[ {id:'podL',vi:'BỆ TÊN LỬA TRÁI',at:[-1.05,1.35,0.1], r:0.75, hp:0.09, fx:'Ít tên lửa hơn'}, {id:'podR',vi:'BỆ TÊN LỬA PHẢI',at:[1.05,1.35,0.1], r:0.75, hp:0.09, fx:'Ít tên lửa hơn'},
            {id:'radar',vi:'RADAR DẪN ĐƯỜNG',at:[0,1.9,-0.7], r:0.6, hp:0.07, fx:'Tên lửa mất dẫn đường'} ],
    phases:['MƯA TÊN LỬA','BÃO XOÁY','TẬN DIỆT'], shield:[] ,
    taunt:['Radar của tao thấy mày rồi.','Không chỗ nào trên bầu trời này là an toàn!'] },
  { id:'goliath',  name:'GOLIATH',    hp:2400, scale:3.8, front:0.35, rear:2.0, pal:{hull:0x3a3a44,turret:0x46464f,barrel:0x55555f,tread:0x18181c,accent:0xb0b0c0},
    parts:[ {id:'gun',vi:'PHÁO CHÍNH',at:[0,1.05,2.9], r:0.75, hp:0.08, fx:'Hết bắn toả'}, {id:'mines',vi:'MÁY RẢI MÌN',at:[0,0.6,-2.35], r:0.8, hp:0.07, fx:'Hết rải mìn'} ],
    phases:['PHÁO ĐÀI DI ĐỘNG','LÁ CHẮN THÉP','PHÁO ĐÀI SỤP ĐỔ'], shield:[1],
    taunt:['Giáp của tao dày hơn tường thành.','Bắn nữa đi — tao còn chưa thấy nhột.'] },
  { id:'reaper',   name:'REAPER',     hp:2600, scale:3.0, front:0.85, rear:1.7, pal:{hull:0x2a1a3a,turret:0x35224a,barrel:0x452e5e,tread:0x140c20,accent:0xa066ff},
    parts:[ {id:'emitter',vi:'ĐẦU PHÁT LASER',at:[0,1.55,1.4], r:0.7, hp:0.08, fx:'Hết laser'}, {id:'drive',vi:'LÕI DỊCH CHUYỂN',at:[0,0.9,-1.9], r:0.75, hp:0.08, fx:'Hết dịch chuyển'} ],
    phases:['BÓNG MA','LƯỠI HÁI ĐÔI','LIỀM TỬ THẦN'], shield:[2],
    taunt:['Mày không thấy tao, nhưng tao thấy mày.','Tường gạch không cứu được mày mãi đâu.'] },
  { id:'overlord', name:'OVERLORD',   hp:3600, scale:3.8, front:0.6, rear:1.7, pal:{hull:0x3a2410,turret:0x4a3018,barrel:0x5e3e20,tread:0x18100a,accent:0xffae5c},
    parts:[ {id:'podL',vi:'BỆ TÊN LỬA TRÁI',at:[-1.2,1.4,0], r:0.8, hp:0.06, fx:'Ít tên lửa hơn'}, {id:'podR',vi:'BỆ TÊN LỬA PHẢI',at:[1.2,1.4,0], r:0.8, hp:0.06, fx:'Ít tên lửa hơn'},
            {id:'emitter',vi:'ĐẦU PHÁT LASER',at:[0,1.7,1.3], r:0.7, hp:0.06, fx:'Hết laser'}, {id:'gun',vi:'PHÁO CHÍNH',at:[0,1.1,3.0], r:0.75, hp:0.06, fx:'Hết bắn toả'} ],
    phases:['KẺ THỐNG TRỊ','PHÁO ĐÀI KHIÊN','TRẬN CUỐI CÙNG'], shield:[1,2],
    taunt:['Cả đất nước mày sẽ quỳ dưới xích tao.','Ngươi đã đi xa lắm rồi, chỉ huy. Đây là điểm dừng.'] },
];
