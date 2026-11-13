// ui/tips.js — Z94 · FIRST-TIME TIPS — the first time something new happens, the battle PAUSES and a short field note explains it. Once per lifetime (saved).
import { MOBILE, PROFILE, S, iconEl, saveProfile, sfx, tapEl } from '../hub.js';

// ===== Z94 · FIRST-TIME TIPS — the first time something new happens, the battle PAUSES and a short field note explains it. Once per lifetime (saved). =====
export const TIPS={
  drive2:  ['tank','Lái xe tăng', (MOBILE ? 'Đẩy cần về hướng muốn đi — thân xe tự quay theo. Kéo cần ngược ra sau khi đang đứng để <b>lùi</b>. <b>Nòng pháo gắn cố định đầu xe</b>: quay mũi xe vào địch là bắn trúng hướng đó.' : '<b>W</b> tiến · <b>S</b> lùi · <b>A</b>/<b>D</b> quay thân xe sang trái/phải (như xe tăng thật) · <b>chuột</b> ngắm tháp pháo.')+' Xe <b>tăng tốc từ từ</b> và <b>trôi tiếp</b> khi nhả ga. Muốn lái theo hướng màn hình: CÀI ĐẶT → ĐIỀU KHIỂN.'],
  crew2:   ['team','Kíp lính của bạn', 'Lính ngồi trên nóc xe tự bắn và <b>được hồi máu dần</b> (xe là trạm cứu thương). '+(MOBILE?'<b>Chạm</b> nút <b>LÍNH</b>':'<b>Bấm nhanh G</b>')+' để họ nhảy xuống: họ <b>tự tác chiến khắp chiến trường</b> — đánh bộ binh, hạ lính gác, <b>nấp khi thấy xe tăng</b>, nhặt đồ mang về khu tập kết. '+(MOBILE?'<b>Giữ</b> nút':'<b>Giữ G</b>')+' để <b>gom lính trong vòng tầm bắn</b> về xe (đầy chỗ thì đứng quanh xe) — lính ngoài vòng vẫn tiếp tục chiến đấu; nhả ra là kết thúc.'],
  infantry:['tank','Bộ binh địch', 'Lính đi bộ yếu nhưng đông. <b>Lái đè qua</b> khi đang chạy để cán nát (+điểm). Tổ <b>RPG</b> quỳ ngắm 1 giây có <b>chớp đỏ</b> — né hoặc bắn hạ tên lửa.'],
  loot:    ['spark','Vật phẩm rơi', 'Đồ rơi văng ra từ xác xe. <b>Quầng sáng</b> quanh món đồ cho biết độ hiếm: <b>xanh lá</b> thường · <b>xanh dương</b> hiếm · <b>tím</b> quý. Xe càng trâu, chỗ càng khó thì đồ càng xịn. Lại gần là đồ tự hút vào.'],
  stack:   ['bolt','Cộng dồn vật phẩm', 'Nhặt lại hiệu ứng đang có thì được <b>gia hạn thêm nửa thời gian</b> (tối đa 1,5 lần), không mạnh thêm. <b>TĂNG ÁP</b> lên tới cấp 2, <b>giáp phản ứng</b> tối đa 6 tấm. Tốc độ tối đa có trần ×1,7.'],
  wall:    ['tank','Tường gạch', 'Đi chậm thì xe bị dội lại. <b>Lùi ra, lấy đà</b> (trên ~55% tốc độ) rồi húc thẳng — cả đoạn tường sẽ đổ. Bắn cũng làm tường sập dần từng tầng.'],
  climb:   ['tank','Đá chắn đường', 'Hòn đá thấp này <b>leo qua được</b> nếu bạn lao tới đủ nhanh. Lùi lại vài thân xe, tăng tốc rồi chạy thẳng vào.'],
  arty:    ['alert','Pháo kích!', 'Vòng <b>đỏ</b> trên mặt đất là nơi đạn pháo sắp rơi. <b>Rời khỏi vòng ngay</b> — tâm vòng đau nhất.'],
  objective:['bunker','Mục tiêu chiến dịch', 'Công trình viền vàng làm địch mạnh hơn khi còn đứng (xem dòng mô tả trên màn hình). <b>Phá nó</b> để nhận xu + 💎 và cắt nguồn sức mạnh của địch.'],
  camp:    ['bunker','Trại lính địch', 'Nhà vòm tôn liên tục tung lính ra. <b>San phẳng nhà lính</b> để chặn nguồn quân. Lều thì cán bẹp được. Phá trại rơi đồ <b>quý</b>.'],
  apc:     ['team','Xe chở quân', 'Xe bọc thép đang <b>dừng lại thả lính</b>. Diệt nó trước khi cửa sau hạ xuống, hoặc cán đám lính vừa chạy ra.'],
  gunship: ['drone','Trực thăng vũ trang', 'Đạn pháo vòng cung không với tới. Dùng <b>súng bắn thẳng, PHÁO PHÒNG KHÔNG</b> (×1,8 vào máy bay) hoặc <b>tên lửa</b>.'],
  atgm:    ['target','Bị khoá laser!', 'Tia đỏ là xe diệt tăng đang khoá bạn. <b>Rẽ gắt</b>, <b>thả khói</b> hoặc <b>bắn hạ tên lửa</b> khi nó bay tới.'],
  engineer:['wrench','Công binh địch', 'Xe công binh <b>hàn sửa</b> xe địch bị thương bằng tia xanh. <b>Diệt nó trước</b>, nếu không bạn sẽ bắn mãi không hết máu.'],
  elite:   ['star','Xe tinh nhuệ', 'Xe có hào quang vàng: trâu hơn, mạnh hơn nhưng <b>luôn rơi đồ quý</b> và +1 💎.'],
  core:    ['bunker','Lõi đang nguy!', 'Nếu <b>LÕI</b> bị phá là thua. Quay về đánh bật địch quanh Lõi, dùng kỹ năng <b>SỬA CHỮA</b> hoặc nhặt <b>SỬA CĂN CỨ</b>.'],
  boss:    ['alert','Trận đánh tướng', 'Tướng địch có <b>nhiều pha</b> và <b>điểm yếu</b>. Bắn vào <b>đuôi xe</b> gây thêm sát thương; phá các <b>bộ phận</b> (thanh nhỏ trên đầu) để vô hiệu đòn của nó. Khi nó <b>choáng</b> hoặc <b>xả nhiệt</b> — dồn hết hoả lực!'],
  deploy:  ['team','Bố trí trận địa', 'Trước mỗi màn bạn <b>chia quân</b>: bao nhiêu người <b>đi cùng xe</b>, bao nhiêu <b>giữ Lõi</b>, áp sát <b>trại giam / kho</b>, giữ <b>hai cánh</b>. Chọn thêm <b>súng máy</b>, <b>cối</b>, <b>công binh</b> (đánh sập tháp canh). Lính được bố trí sẽ <b>giữ khu vực</b> của mình. Lần sau tự nhớ cách bố trí.'],
  pow:     ['team','Trại giam lính ta', 'Lính ta bị giam sau hàng rào thép gai. <b>Diệt hết lính canh</b>, rồi <b>lái xe tới cổng</b> (hoặc cho lính đi bộ vào): tù binh <b>lên xe</b> — đầy chỗ thì họ <b>cầm súng theo bạn</b>.'],
  depot:   ['bunker','Kho vũ khí & kho xe tăng', 'Diệt lính canh, rồi <b>thả lính xuống</b> trong vòng xanh vài giây để <b>chiếm kho</b>. Kho vũ khí phát <b>súng chống tăng</b> cho lính; kho xe tăng: lính ta <b>lái xe địch</b> và tự chiến đấu.'],
  rally:   ['spark','Khu tập kết', 'Lính nhặt được vật phẩm sẽ <b>mang về khu tập kết</b> (vòng xanh có cờ, bên phía ta). Đồ ở đó <b>không biến mất</b> — lái xe tới để nhận.'],
  paradrop:['alert','Lính dù địch!', 'Trực thăng vận tải thả lính dù xuống <b>vòng đỏ</b>. Đón lõng chỗ họ tiếp đất — <b>một phát pháo</b> là đủ hạ một lính.'],
  allytank:['tank','Xe tăng đồng minh', 'Lính ta đã lái một xe tăng chiến lợi phẩm (tấm đánh dấu <b>xanh chanh</b> trên tháp pháo). Nó <b>tự tìm mục tiêu</b> và quay về cạnh bạn khi hết địch.'],
  cover:   ['team','Lính ta nấp xe tăng', 'Thấy xe tăng địch, lính ta <b>chạy nấp sau tường, đá, bao cát</b> và chỉ bắn bộ binh. Họ chỉ đánh xe tăng khi có <b>súng chống tăng</b> từ kho vũ khí.'],
  shield:  ['shield','Khiên năng lượng', 'Tướng đang được <b>trụ phát khiên</b> bảo vệ — đạn không xuyên qua. <b>Phá hết các trụ</b> (đánh dấu trên radar) để tắt khiên.'],
};
export const TIPQ=[]; export let _tipOpen=null;
// Z104 only the notes that change how you play stop the battle; simple sightings stay quiet (still in the field manual)
export const TIP_SHOW={ deploy:1, drive2:1, crew2:1, arty:1, atgm:1, core:1, boss:1, shield:1, pow:1, depot:1, rally:1, paradrop:1, allytank:1 };
export function tip(id){ if(!TIPS[id] || !TIP_SHOW[id]) return; const P=PROFILE.tips||(PROFILE.tips={}); if(P[id] || TIPQ.includes(id) || _tipOpen===id) return; TIPQ.push(id); }
export const TIP_URGENT={ arty:1, atgm:1, boss:1, shield:1, core:1 }; export let _tipNextAt=0;
export function pumpTips(){ if(_tipOpen || !TIPQ.length || S.mode!=='playing') return; const nowT=performance.now()/1000;
  let qi=TIPQ.findIndex(k=>TIP_URGENT[k]); if(qi<0){ if(nowT<_tipNextAt) return; qi=0; }      // urgent notes jump the queue; the rest wait 6 s of play between them
  const id=TIPQ.splice(qi,1)[0], T=TIPS[id], el=document.getElementById('tipCard'); if(!el) return;
  _tipOpen=id; S.mode='tip'; S.firing=false; S.keys={};
  el.querySelector('.tc-ic').replaceChildren(iconEl(T[0])); el.querySelector('.tc-ttl').textContent=T[1]; el.querySelector('.tc-body').innerHTML=T[2];
  const seen=Object.keys(TIP_SHOW).filter(k=>(PROFILE.tips||{})[k]).length+1; el.querySelector('.tc-n').textContent='Ghi chú '+Math.min(seen, Object.keys(TIP_SHOW).length)+'/'+Object.keys(TIP_SHOW).length;
  el.classList.remove('hidden'); sfx('beep'); }
export function closeTip(){ if(!_tipOpen) return; (PROFILE.tips||(PROFILE.tips={}))[_tipOpen]=1; saveProfile(); _tipOpen=null; _tipNextAt=performance.now()/1000+6; document.getElementById('tipCard').classList.add('hidden'); if(S.mode==='tip') S.mode='playing'; sfx('click'); }
{ const ok=document.getElementById('tipOk'); if(ok) tapEl(ok, closeTip); addEventListener('keydown', e=>{ if(_tipOpen && (e.key==='Enter'||e.key===' '||e.key==='Escape')){ e.preventDefault(); closeTip(); } }); }
